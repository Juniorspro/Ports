//! El contenido para bajar (la ventana «Contenido de JXMod», de vidrio como las de Vista): la primera vez que se abre el juego
//! deja elegir qué bajar de una —la biblioteca de GMod (modelos, texturas y sonidos de GMod y Half-Life 2), los mapas, los
//! personajes y los extras— con el tamaño de cada cosa, y lo baja de a tres archivos a la vez (bajas.rs) con su barra de
//! progreso, también con la ventana cerrada (la barra de tareas del inicio muestra cómo va). Lo que no se baja ahora se baja
//! solo cuando hace falta, como siempre. Se vuelve a abrir desde «Contenido de GMod» en la barra de tareas
use super::*;
use super::aero::{self, hex, negro, Est, OpVentana, GRIS, LINEA, TITULO, TXT};
use super::inicio_juego::{prog, Nivel};
use crate::bajas::Estado;
use crate::pincel::{self, Cara, Pincel};
use std::collections::VecDeque;

/// los grupos: nombre, ícono
pub const GRUPOS: [(&str, &str); 4] = [("Biblioteca de GMod", "ico_gmod"), ("Mapas del juego", "mapa"), ("Personajes", "persona"), ("Extras", "estrella")];
/// cuántos archivos se bajan a la vez
const A_LA_VEZ: usize = 3;
/// lo que pesa la biblioteca de GMod (el índice y los tres trozos), para mostrarlo antes de bajar el índice
const LIB_APROX: u64 = 86_400_000;

/// lo que se toca en la ventana
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum AccC { Marcar(usize), Bajar, AhoraNo, Cerrar, Fondo, Reintentar, Listo }

#[derive(Default)]
pub struct Contenido {
    pub abierta: bool, pub t0: f32, iniciado: bool, auto: bool,
    /// lo marcado para bajar
    pub marcado: [bool; 4],
    /// lo que falta pedir (de a tres) y lo pedido de cada grupo
    cola: VecDeque<String>, pub pedidos: [Vec<String>; 4],
    /// los archivos de la biblioteca de GMod (del índice, cuando está)
    lib: Vec<String>, lib_leido: bool,
    pub zonas: Vec<([f32; 4], AccC)>, pub apretado: Option<AccC>, dedo: Option<i32>,
}

/// cómo va un grupo
#[derive(Clone, Debug, Default)]
pub struct Info { pub n: usize, pub tam: u64, pub listos: usize, pub va: u64, pub falla: bool, pub bajando: bool, pub aprox: bool }
impl Info {
    pub fn instalado(&self) -> bool { self.n > 0 && self.listos == self.n && !self.aprox }
    pub fn frac(&self) -> f32 { if self.instalado() { 1.0 } else if self.tam > 0 { (self.va as f64 / self.tam as f64).min(0.99) as f32 } else { 0.0 } }
}

/// «11,7 MB» (como se escribe acá: con coma)
pub fn mb(b: u64) -> String { let v = b as f64 / 1e6; if v >= 10.0 { format!("{v:.0} MB") } else { format!("{v:.1} MB").replace('.', ",") } }

impl Juego {
    /// los archivos de un grupo con lo que pesa cada uno (0: no se sabe todavía)
    pub(super) fn cont_archivos(&self, g: usize) -> Vec<(String, u64)> {
        if g == 0 { return if self.cont.lib.is_empty() { vec![(gmod_juego::GM_LIB.to_string(), 0)] } else { self.cont.lib.iter().map(|n| (n.clone(), 0)).collect() }; }
        let Some(paq) = self.paq.as_ref() else { return vec![] };
        let Some(o) = paq.d["rbp"].as_object() else { return vec![] };
        let es = |k: &str| match g { 1 => k.starts_with("m_"), 2 => k.starts_with("s_"), _ => k.starts_with("a_") || k.starts_with("p_") };
        let mut v: Vec<(String, u64)> = o.iter().filter(|(k, _)| es(k)).filter_map(|(_, x)| Some((x[0].as_str()?.to_string(), x[1].as_u64().unwrap_or(0)))).collect();
        v.sort(); v
    }
    /// cómo va un grupo (lo que está en la APK cuenta como bajado)
    pub(super) fn cont_info(&self, g: usize) -> Info {
        let arch = self.cont_archivos(g); let mut i = Info { n: arch.len(), aprox: g == 0 && self.cont.lib.len() <= 1, ..Default::default() };
        if g == 0 && self.gmod.lib.is_some() { return Info { n: 1, tam: LIB_APROX, listos: 1, va: LIB_APROX, ..Default::default() }; }
        let Some(b) = self.bajas.as_ref() else { i.tam = if g == 0 { LIB_APROX } else { arch.iter().map(|a| a.1).sum() }; return i };
        for (n, t) in &arch {
            match b.estado(n) {
                Some(Estado::Listo) => { i.listos += 1; i.va += if *t > 0 { *t } else { b.archivo(n).and_then(|p| p.metadata().ok()).map(|m| m.len()).unwrap_or(0) }; }
                Some(Estado::Bajando { va, .. }) => { i.bajando = true; i.va += va; }
                Some(Estado::Falla) => i.falla = true,
                None => { if self.cont.cola.contains(n) { i.bajando = true; } }
            }
        }
        i.tam = if g == 0 { LIB_APROX.max(i.va) } else { arch.iter().map(|a| a.1).sum() };
        i
    }
    /// lo pedido, en 0..1 (None: no se está bajando nada)
    pub fn cont_progreso(&self) -> Option<f32> {
        let gs: Vec<usize> = (0..4).filter(|g| !self.cont.pedidos[*g].is_empty()).collect(); if gs.is_empty() { return None; }
        let is: Vec<Info> = gs.iter().map(|g| self.cont_info(*g)).collect();
        if is.iter().all(|i| i.instalado() || (!i.bajando && i.falla)) { return None; }
        let (va, tam) = is.iter().fold((0u64, 0u64), |a, i| (a.0 + if i.instalado() { i.tam } else { i.va.min(i.tam) }, a.1 + i.tam));
        Some(if tam > 0 { va as f32 / tam as f32 } else { 0.0 })
    }

    pub fn cont_abrir(&mut self) {
        if !self.cont.iniciado { self.cont.iniciado = true; self.cont.marcado = [true, true, true, false]; }
        for g in 0..4 { if self.cont_info(g).instalado() { self.cont.marcado[g] = false; } }
        self.cont.abierta = true; self.cont.t0 = self.ini.reloj; self.cont.apretado = None; self.cont.dedo = None;
    }
    fn cont_cerrar(&mut self) { self.cont.abierta = false; self.cont.zonas.clear(); self.cont_visto(); }
    /// ya la vio: no sale sola otra vez
    fn cont_visto(&mut self) { if !self.aj.cont { self.aj.cont = true; if let Some(d) = &self.datos { let _ = std::fs::write(d.join("ajustes.txt"), self.aj.texto()); } } }

    /// cada cuadro (con el inicio o jugando): la ventana sale sola la primera vez, el índice de la biblioteca y la cola
    pub(super) fn cont_paso(&mut self) {
        let Some(b) = self.bajas.clone() else { return };
        if !self.aj.cont && !self.cont.auto && self.ini.abierto && self.ini.panel.is_none() && self.ini.reloj - self.ini.entrada > 1.2 { self.cont.auto = true; self.cont_abrir(); }
        // (el índice de la biblioteca: cuando está, se sabe qué trozos tiene; si ya se pidió la biblioteca, se piden también)
        if !self.cont.lib_leido && b.disponible(gmod_juego::GM_LIB) { if let Some(l) = self.gmod.lector_rb.clone() {
            self.cont.lib_leido = true; self.cont.lib = gmod_juego::gmod_base_archivos_lib(&l);
            if !self.cont.pedidos[0].is_empty() { for n in self.cont.lib.clone() { if !self.cont.pedidos[0].contains(&n) && !b.disponible(&n) { self.cont.pedidos[0].push(n.clone()); self.cont.cola.push_back(n); } } }
        } }
        if self.cont.cola.is_empty() { return; }
        let activos = self.cont.pedidos.iter().flatten().filter(|n| matches!(b.estado(n), Some(Estado::Bajando { .. }))).count();
        let mut libres = A_LA_VEZ.saturating_sub(activos);
        while libres > 0 { let Some(n) = self.cont.cola.pop_front() else { break }; if b.disponible(&n) { continue; } b.pedir(&n); libres -= 1; }
    }
    fn cont_bajar(&mut self) {
        let Some(b) = self.bajas.clone() else { self.avisar("Sin conexión: el contenido se baja en el celular".into()); return };
        for g in 0..4 { if !self.cont.marcado[g] { continue; }
            for (n, _) in self.cont_archivos(g) { if !b.disponible(&n) && !self.cont.pedidos[g].contains(&n) { self.cont.pedidos[g].push(n.clone()); self.cont.cola.push_back(n); } } }
        self.cont_visto();
    }
    fn cont_reintentar(&mut self) {
        let Some(b) = self.bajas.clone() else { return };
        let fallados: Vec<String> = self.cont.pedidos.iter().flatten().filter(|n| matches!(b.estado(n), Some(Estado::Falla))).cloned().collect();
        for n in fallados.into_iter().rev() { if !self.cont.cola.contains(&n) { self.cont.cola.push_front(n); } }
    }
    fn cont_accion(&mut self, a: AccC) {
        match a {
            AccC::Marcar(g) => { let i = self.cont_info(g); if !i.instalado() && self.cont.pedidos[g].is_empty() { self.cont.marcado[g] = !self.cont.marcado[g]; } }
            AccC::Bajar => self.cont_bajar(),
            AccC::Reintentar => self.cont_reintentar(),
            AccC::AhoraNo | AccC::Cerrar | AccC::Fondo | AccC::Listo => self.cont_cerrar(),
        }
    }

    // —— el tacto ——
    pub(super) fn cont_dedo_abajo(&mut self, id: i32, x: f32, y: f32) {
        let a = self.cont.zonas.iter().rev().find(|(r, _)| aero::dentro(*r, x, y)).map(|z| z.1);
        self.cont.apretado = a; self.cont.dedo = Some(id);
    }
    pub(super) fn cont_dedo_mueve(&mut self, id: i32, x: f32, y: f32) {
        if self.cont.dedo != Some(id) { return; }
        let a = self.cont.zonas.iter().rev().find(|(r, _)| aero::dentro(*r, x, y)).map(|z| z.1);
        if a != self.cont.apretado { self.cont.apretado = None; }
    }
    pub(super) fn cont_dedo_arriba(&mut self, id: i32) {
        if self.cont.dedo != Some(id) { return; } self.cont.dedo = None;
        if let Some(a) = self.cont.apretado.take() { self.sonido.tocar("Click", 0.5, 1.0, None); self.cont_accion(a); }
    }

    // —— el dibujo ——
    pub(super) fn cont_dibujar(&self, p: &mut Pincel, w: f32, h: f32) -> Vec<([f32; 4], AccC)> {
        let u = aero::unidad(w, h); let g = (0.75 * u).max(1.0);
        let t = self.ini.reloj - self.cont.t0; let k = if self.ini.nivel != Nivel::Quieto { let x = prog(t, 0.0, 0.22); 1.0 - (1.0 - x).powi(3) } else { 1.0 };
        let apr = |a: AccC| self.cont.apretado == Some(a);
        let mut z: Vec<([f32; 4], AccC)> = vec![];
        p.rect(0.0, 0.0, w, h, negro(0.4 * k));
        let (ww, wh) = ((560.0 * u).min(w - 24.0 * u), (336.0 * u).min(h - 14.0 * u)); let (wx, wy) = ((w - ww) / 2.0, (h - wh) / 2.0);
        let infos: Vec<Info> = (0..4).map(|gr| self.cont_info(gr)).collect();
        let pedido = self.cont.pedidos.iter().any(|v| !v.is_empty());
        let bajando = (0..4).any(|gr| !self.cont.pedidos[gr].is_empty() && infos[gr].bajando);
        let falla = (0..4).any(|gr| !self.cont.pedidos[gr].is_empty() && infos[gr].falla && !infos[gr].instalado());
        let s = 0.94 + 0.06 * k;
        p.con_alfa(k, |p| p.con(pincel::escalar_en(s, s, w / 2.0, h / 2.0), |p| {
            let v = aero::ventana(p, [wx, wy, ww, wh], u, &OpVentana { titulo: "Contenido de JXMod", ico: Some("ico_gmod"), atras: false, cerrar: true, blanco: true, apretado: if apr(AccC::Cerrar) { 1 } else { 0 } });
            if let Some(c) = v.cerrar { z.push((c, AccC::Cerrar)); }
            let c = v.cliente; let pad = 14.0 * u;
            // (la barra de abajo, con los botones: como la de los cuadros de diálogo)
            let ca_h = 42.0 * u; let ca = [c[0], c[1] + c[3] - ca_h, c[2], ca_h];
            p.rect(ca[0], ca[1], ca[2], ca[3], hex(0xf0f0f0)); p.rect(ca[0], ca[1], ca[2], g, hex(0xdfdfdf));
            // (el título azul y la explicación)
            let mut y = c[1] + pad;
            p.texto(Cara::S4, 15.0 * u, c[0] + pad, y + 13.0 * u, TITULO, 0.0, "Elegí qué contenido bajar"); y += 22.0 * u;
            let sub = "Se baja una sola vez y queda en el celular. Lo que no bajes ahora se baja solo cuando haga falta.";
            for l in p.at.renglones(Cara::S4, 11.5 * u, 0.0, sub, c[2] - 2.0 * pad).iter().take(2) { p.texto(Cara::S4, 11.5 * u, c[0] + pad, y + 11.0 * u, GRIS, 0.0, l); y += 15.0 * u; }
            y += 6.0 * u;
            // (la lista: una fila por grupo, con la casilla, el ícono, el nombre, qué trae y el tamaño o cómo va)
            let rh = ((ca[1] - 6.0 * u - y) / 4.0).min(46.0 * u); let lx = c[0] + pad; let lw = c[2] - 2.0 * pad;
            p.rect(lx, y, lw, g, LINEA);
            for gr in 0..4 {
                let i = &infos[gr]; let r = [lx, y, lw, rh]; let inst = i.instalado(); let pedido_g = !self.cont.pedidos[gr].is_empty();
                if apr(AccC::Marcar(gr)) { aero::fila_sel(p, [r[0], r[1] + g, r[2], r[3] - g], u, true); }
                let mut x = r[0] + 8.0 * u; let cy = y + rh / 2.0;
                if inst { p.icono("si", x, cy - 8.0 * u, 16.0 * u, 2.6, hex(0x2a8a2a)); }
                else { aero::casilla(p, x, cy - 8.0 * u, u, self.cont.marcado[gr] || pedido_g, apr(AccC::Marcar(gr))); }
                x += 26.0 * u;
                let (nom, ico) = GRUPOS[gr];
                p.icono(ico, x, cy - 13.0 * u, 26.0 * u, 2.0, hex(0x2b5797)); x += 36.0 * u;
                let desc = match gr { 0 => "Modelos, texturas y sonidos de GMod y Half-Life 2 (addons, props y mapas del Workshop)".to_string(),
                    1 => format!("{} mapas, para jugarlos sin esperar a que bajen", i.n), 2 => format!("{} skins para tu personaje", i.n), _ => "Memes, la pastilla y la bomba".to_string() };
                let col_d = 150.0 * u; let rx = r[0] + r[2] - col_d;
                p.texto_max(Cara::S7, 13.0 * u, x, cy - 3.0 * u, TXT, 0.0, nom, rx - x - 8.0 * u);
                p.texto_max(Cara::S4, 11.0 * u, x, cy + 12.0 * u, GRIS, 0.0, &desc, rx - x - 8.0 * u);
                let d = r[0] + r[2] - 8.0 * u;
                if inst { p.texto_d(Cara::S4, 12.0 * u, d, cy + 4.5 * u, hex(0x2a8a2a), 0.0, "Instalado"); }
                else if pedido_g && (i.bajando || i.va > 0) && !(i.falla && !i.bajando) {
                    let bw = 96.0 * u; aero::progreso(p, [rx, cy - 6.0 * u, bw, 12.0 * u], u, i.frac(), self.ini.reloj, false);
                    p.texto_d(Cara::S4, 12.0 * u, d, cy + 4.5 * u, TXT, 0.0, &format!("{:.0} %", i.frac() * 100.0));
                }
                else if pedido_g && i.falla { p.texto_d(Cara::S4, 12.0 * u, d, cy + 4.5 * u, hex(0xc42b1c), 0.0, "No se pudo bajar"); }
                else { p.texto_d(Cara::S4, 12.0 * u, d, cy + 4.5 * u, GRIS, 0.0, &if i.aprox || gr == 0 { format!("{} aprox.", mb(i.tam)) } else { mb(i.tam - i.va.min(i.tam)) }); }
                p.rect(lx, y + rh, lw, g, LINEA);
                if !inst && !pedido_g { z.push((r, AccC::Marcar(gr))); }
                y += rh;
            }
            // (abajo: lo elegido o cómo va, y los botones)
            let tb = 12.0 * u; let base = p.at.base_centrada(Cara::S4, tb, ca_h, ca[1], ca_h);
            let elegido: u64 = (0..4).filter(|gr| self.cont.marcado[*gr] && !infos[*gr].instalado() && self.cont.pedidos[*gr].is_empty()).map(|gr| infos[gr].tam - infos[gr].va.min(infos[gr].tam)).sum();
            let texto = if bajando { format!("Bajando… {:.0} %  ·  podés seguir jugando", self.cont_progreso().unwrap_or(0.0) * 100.0) }
                else if pedido && !falla { "Listo: el contenido quedó en el celular".to_string() }
                else if falla { "Algo no se pudo bajar: revisá la conexión".to_string() }
                else { format!("Seleccionado: {}", mb(elegido)) };
            p.texto_max(Cara::S4, tb, ca[0] + pad, base, if falla { hex(0xc42b1c) } else { TXT }, 0.0, &texto, ca[2] * 0.5);
            let botones: Vec<(&str, AccC, Est)> = if bajando { vec![("En segundo plano", AccC::Fondo, Est::Normal), ("Bajando…", AccC::Bajar, Est::Apagado)] }
                else if falla { vec![("Cerrar", AccC::AhoraNo, Est::Normal), ("Reintentar", AccC::Reintentar, Est::Elegido)] }
                else if pedido { vec![("Listo", AccC::Listo, Est::Elegido)] }
                else { vec![("Ahora no", AccC::AhoraNo, Est::Normal), ("Descargar", AccC::Bajar, if elegido > 0 { Est::Elegido } else { Est::Apagado })] };
            let bh = 26.0 * u; let by = ca[1] + (ca_h - bh) / 2.0; let mut bx = ca[0] + ca[2] - pad;
            for (txt, a, e) in botones.iter().rev() {
                let bw = (p.at.ancho(Cara::S4, 13.0 * u, 0.0, txt) + 30.0 * u).max(86.0 * u); bx -= bw;
                let e = if *e != Est::Apagado && apr(*a) { Est::Apretado } else { *e };
                aero::boton(p, [bx, by, bw, bh], u, txt, None, e);
                if e != Est::Apagado { z.push((aero::agrandar([bx, by, bw, bh], 2.0 * u, 7.0 * u), *a)); }
                bx -= 8.0 * u;
            }
        }));
        z
    }
}
