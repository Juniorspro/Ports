//! El tutorial (tutorial.js de la web): un paso por botón. Se oscurece la pantalla, se resalta el botón con su borde azul
//! titilando y una tarjeta blanca explica qué hace, con Anterior, Siguiente y Saltear. Recorre los botones que se ven en
//! ese momento; sale solo la primera vez que se entra a jugar (después de 2 s sin menús) y se vuelve a ver desde la pausa.
use super::*;
use super::hud_web::{self, Editor};
use super::jugabilidad::Bj;
use super::personajes::Bp;

/// a qué apunta un paso: nada (una tarjeta en el medio), la palanca, la pausa o un botón
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Blanco { Nada, Palanca, Pausa, B(Boton) }
/// los pasos: [qué es, a qué apunta, título, texto] (los textos de la web; «volar» en el lugar de «correr», que acá es volar)
pub const PASOS: [(&str, Blanco, &str, &str); 23] = [
    ("bienv", Blanco::Nada, "¡Bienvenido a JXMod!", "Te muestro en un minuto qué hace cada botón. Podés saltearlo y volver a verlo desde la pausa."),
    ("mover", Blanco::Palanca, "Moverte", "Caminá arrastrando el joystick. Empujalo hasta el borde para ir más rápido."),
    ("mirar", Blanco::Nada, "Mirar", "Deslizá el dedo por la pantalla (donde no hay botones) para mirar alrededor."),
    ("disparo", Blanco::B(Boton::Disparo), "Disparar / usar el arma", "Usa lo que tenés en la mano. Con la Physics Gun agarrás objetos y los llevás."),
    ("disp2", Blanco::B(Boton::Disparo2), "Acción secundaria", "La segunda función del arma: con la Physics Gun congela lo que agarrás; con otras apunta o lanza."),
    ("saltar", Blanco::B(Boton::Saltar), "Saltar", "Salta. En el agua, mantenelo para subir."),
    ("agachar", Blanco::B(Boton::Agachar), "Agacharse", "Te agachás para pasar por lugares bajos o esconderte."),
    ("volar", Blanco::B(Boton::Volar), "Volar (noclip)", "Volá atravesando paredes. Tocalo otra vez para volver a caminar."),
    ("usar", Blanco::B(Boton::Usar), "Usar", "Aparece cuando mirás algo que se puede usar: puertas, botones, autos, sillas."),
    ("recargar", Blanco::B(Boton::Recargar), "Recargar", "Recarga el arma. Con la Physics Gun gira lo que agarrás."),
    ("arma", Blanco::B(Boton::Arma), "Tu arma", "Tocá acá para elegir otra arma o herramienta."),
    ("menu", Blanco::B(Boton::Objetos), "Menú de props", "El menú para poner cosas: objetos, NPCs, vehículos, personajes y lo de los addons."),
    ("deshacer", Blanco::B(Boton::Deshacer), "Deshacer", "Deshace lo último que pusiste."),
    ("chat", Blanco::B(Boton::Chat), "Chat", "Escribile a la gente de la sala."),
    ("celular", Blanco::B(Boton::Pj(Bp::Celular)), "Celular", "Tu celular: la gente de la sala (y agregarlos de amigo), objetos, cámara, memes y más."),
    ("mods", Blanco::B(Boton::Jg(Bj::Mod)), "Menú MOD", "Los mods de la partida: prendelos, apagalos y cambiá sus ajustes."),
    ("emotes", Blanco::B(Boton::Emotes), "Emotes", "Bailes y gestos. Algunos se hacen de a dos con otro jugador."),
    ("camara", Blanco::B(Boton::Camara), "Cámara", "Cambia entre primera y tercera persona."),
    ("camLibre", Blanco::B(Boton::Jg(Bj::CamLibre)), "Cámara libre", "Cámara libre: volá con la cámara para mirar o sacar fotos sin mover a tu personaje."),
    ("linterna", Blanco::B(Boton::Jg(Bj::Linterna)), "Linterna", "Prende y apaga la linterna. Los demás de la sala ven su luz."),
    ("patada", Blanco::B(Boton::Jg(Bj::Patada)), "Patada", "Pateá objetos, NPCs y puertas."),
    ("pausa", Blanco::Pausa, "Pausa", "Ajustes, Social, cambiar de personaje y salir. Desde acá también volvés a ver este tutorial."),
    ("fin", Blanco::Nada, "¡Listo!", "Ya sabés lo básico. ¡A jugar!"),
];

/// el tutorial abierto: en qué paso va, cuáles pasos quedaron (los botones que se ven), cuánto se esperó y el reloj del titileo
#[derive(Default)]
pub struct Tut { pub on: bool, pub i: usize, pub pasos: Vec<usize>, espera: f32, t: f32 }
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum AccTut { Saltear, Anterior, Siguiente }
/// la tarjeta armada: la caja, los renglones del texto (con su alto de letra y su y) y los botones
pub struct Carta { pub caja: [f32; 4], pub renglones: Vec<(String, f32, f32, [f32; 4])>, pub botones: Vec<(AccTut, &'static str, [f32; 4])> }

/// un texto partido en renglones que entren en `ancho`
fn partir(l: &Letras, tam: f32, s: &str, ancho: f32) -> Vec<String> {
    let mut v = vec![]; let mut r = String::new();
    for p in s.split(' ') { let c = if r.is_empty() { p.to_string() } else { format!("{r} {p}") }; if l.ancho(tam, &c) > ancho && !r.is_empty() { v.push(std::mem::take(&mut r)); r = p.to_string(); } else { r = c; } }
    if !r.is_empty() { v.push(r); } v
}
const fn rgb(c: u32) -> [f32; 4] { [((c >> 16) & 255) as f32 / 255.0, ((c >> 8) & 255) as f32 / 255.0, (c & 255) as f32 / 255.0, 1.0] }

impl Juego {
    /// abrir el tutorial (desde la pausa, o solo la primera vez): con los botones que se ven ahora
    pub fn tut_abrir(&mut self) {
        if self.mapa.is_none() { self.avisar("Entrá a un mapa para ver el tutorial".into()); return; }
        self.ini.pz.abierta = false; self.menu = None; self.ajustes = None; self.dedos.clear(); self.ed = Editor::default();
        let pasos = (0..PASOS.len()).filter(|&i| match PASOS[i].1 { Blanco::Nada | Blanco::Palanca | Blanco::Pausa => true, Blanco::B(b) => self.boton_visible(b) }).collect();
        self.tut = Tut { on: true, i: 0, pasos, espera: 0.0, t: 0.0 };
    }
    fn tut_cerrar(&mut self) {
        self.tut.on = false; self.aj.tut = true;
        if let Some(d) = &self.datos { let _ = std::fs::write(d.join("ajustes.txt"), self.aj.texto()); }
    }
    /// cada cuadro: el titileo y, la primera vez que se juega, abrirlo solo a los 2 s sin menús (no en las pruebas
    /// automáticas, que van con el reloj fijo)
    pub(super) fn tut_paso(&mut self, dt: f32) {
        if self.tut.on { self.tut.t += dt; return; }
        let libre = self.mapa.is_some() && !self.recargar && self.menu.is_none() && self.ajustes.is_none() && self.npc_panel.is_none() && !self.en_red.panel && !self.gmod.panel && !self.emotes_panel
            && !self.jg.panel() && !self.pjs.panel() && !self.ini.pz.abierta && self.ini.panel.is_none() && !self.ini.abierto && !self.ed.activo && !self.gfxa.midiendo();
        if self.aj.tut || self.dt_fijo.is_some() || !libre { self.tut.espera = 0.0; return; }
        self.tut.espera += dt; if self.tut.espera > 2.0 { self.tut_abrir(); }
    }
    /// dónde está lo que se explica: centro y radio del hueco (el botón más 8 px)
    fn tut_blanco(&self, w: f32, h: f32) -> Option<(f32, f32, f32)> {
        let k = *self.tut.pasos.get(self.tut.i)?; let c = hud_web::css(w, h); let m = 8.0 * c;
        match PASOS[k].1 {
            Blanco::Nada => None,
            Blanco::Palanca => { let (x, y, p) = hud_web::palanca(w, h); Some((x, y, p / 2.0 + m)) }
            Blanco::Pausa => { let p = hud_web::disposicion(w, h, 0).1; Some((p[0], p[1], p[2] / 2.0 + m)) }
            Blanco::B(b) => botones(w, h).into_iter().find(|x| x.b == b).map(|x| (x.x, x.y, x.w.max(x.h) / 2.0 + m)),
        }
    }
    /// la tarjeta: 360 px de ancho, al lado del botón (abajo o arriba, a la izquierda o a la derecha) sin salirse
    pub fn tut_carta(&self, w: f32, h: f32) -> Option<Carta> {
        let l = self.letras.as_ref()?; let k = *self.tut.pasos.get(self.tut.i)?; let c = hud_web::css(w, h);
        let (_, _, tit, txt) = PASOS[k]; let (px, py) = (14.0 * c, 12.0 * c); let cw = (360.0 * c).min(w - 24.0 * c);
        let (tn, tt, tp, tb) = (11.0 * c, 17.0 * c, 14.0 * c, 13.0 * c);
        let lineas = partir(l, tp, txt, cw - 2.0 * px);
        let bh = tb + 16.0 * c; let ch = py + tn * 1.3 + 2.0 * c + tt * 1.3 + 6.0 * c + lineas.len() as f32 * tp * 1.38 + 10.0 * c + bh + py;
        let (mut x, mut y) = (w / 2.0 - cw / 2.0, h / 2.0 - ch / 2.0);
        if let Some((bx, by, r)) = self.tut_blanco(w, h) {
            let (rx, ry, rw, rh) = (bx - r + 8.0 * c, by - r + 8.0 * c, 2.0 * r - 16.0 * c, 2.0 * r - 16.0 * c);
            x = bx - cw / 2.0; y = ry + rh + 16.0 * c; if y + ch > h - 8.0 * c { y = ry - ch - 16.0 * c; }
            if y < 8.0 * c { y = (by - ch / 2.0).clamp(8.0 * c, h - ch - 8.0 * c); x = if bx < w / 2.0 { rx + rw + 16.0 * c } else { rx - cw - 16.0 * c }; }
        }
        let x = x.clamp(12.0 * c, (w - cw - 12.0 * c).max(12.0 * c)).round(); let y = y.clamp(8.0 * c, (h - ch - 8.0 * c).max(8.0 * c)).round();
        let mut renglones = vec![]; let mut yy = y + py;
        renglones.push((format!("{} / {}", self.tut.i + 1, self.tut.pasos.len()), tn, yy, rgb(0x6b7785))); yy += tn * 1.3 + 2.0 * c;
        renglones.push((tit.to_string(), tt, yy, rgb(0x1c2530))); yy += tt * 1.3 + 6.0 * c;
        for r in lineas { renglones.push((r, tp, yy, rgb(0x33404e))); yy += tp * 1.38; }
        // (los botones: Saltear a la izquierda; Anterior y Siguiente —o «¡A jugar!»— a la derecha)
        let ult = self.tut.i + 1 >= self.tut.pasos.len(); let by = y + ch - py - bh; let mut botones = vec![];
        let ancho = |t: &str| l.ancho(tb, t) + 28.0 * c;
        let sig = if ult { "¡A jugar!" } else { "Siguiente" }; let mut xd = x + cw - px - ancho(sig);
        botones.push((AccTut::Siguiente, sig, [xd, by, ancho(sig), bh]));
        if self.tut.i > 0 { xd -= ancho("Anterior") + 8.0 * c; botones.push((AccTut::Anterior, "Anterior", [xd, by, ancho("Anterior"), bh])); }
        if !ult { botones.push((AccTut::Saltear, "Saltear", [x + px - 4.0 * c, by, l.ancho(tb, "Saltear") + 8.0 * c, bh])); }
        Some(Carta { caja: [x, y, cw, ch], renglones, botones })
    }
    /// un toque con el tutorial abierto: sólo los botones de la tarjeta
    pub(super) fn tut_toque(&mut self, x: f32, y: f32, w: f32, h: f32) {
        let Some(c) = self.tut_carta(w, h) else { self.tut_cerrar(); return };
        let Some((a, _, _)) = c.botones.into_iter().find(|(_, _, r)| x >= r[0] && x <= r[0] + r[2] && y >= r[1] - 6.0 && y <= r[1] + r[3] + 6.0) else { return };
        self.sonido.tocar("Click", 0.5, 1.0, None);
        match a {
            AccTut::Saltear => self.tut_cerrar(),
            AccTut::Anterior => { self.tut.i = self.tut.i.saturating_sub(1); self.tut.t = 0.0; }
            AccTut::Siguiente => { if self.tut.i + 1 >= self.tut.pasos.len() { self.tut_cerrar(); } else { self.tut.i += 1; self.tut.t = 0.0; } }
        }
    }
    /// el dibujo, encima de todo: el velo con el hueco, el borde titilando y la tarjeta
    pub(super) fn tut_hud(&self, u: &mut Vec<(i64, Vec<f32>)>, w: i32, h: i32) {
        if !self.tut.on { return; } let Some(l) = &self.letras else { return };
        let (wf, hf) = (w as f32, h as f32); let c = hud_web::css(wf, hf); let velo = [5.0 / 255.0, 8.0 / 255.0, 14.0 / 255.0, 0.74];
        let mut v = vec![]; let mut t = vec![];
        match self.tut_blanco(wf, hf) {
            Some((x, y, r)) => {
                l.rect(&mut t, 0.0, 0.0, wf, (y - r).max(0.0), velo); l.rect(&mut t, 0.0, y + r, wf, hf - y - r, velo);
                l.rect(&mut t, 0.0, y - r, (x - r).max(0.0), 2.0 * r, velo); l.rect(&mut t, x + r, y - r, wf - x - r, 2.0 * r, velo);
                hud_web::pieza_pub(&mut v, "hueco", x - r, y - r, 2.0 * r, 2.0 * r, velo);
                // (el borde: de azul a celeste y un poco más afuera, cada 1,1 s)
                let f = 0.5 - 0.5 * (self.tut.t / 1.1 * std::f32::consts::TAU).cos(); let e = (2.0 + 4.0 * f) * c;
                let col = [(0x4f as f32 + (0xbf - 0x4f) as f32 * f) / 255.0, (0xb3 as f32 + (0xe4 - 0xb3) as f32 * f) / 255.0, 1.0, 1.0];
                for d in [0.0, 1.0, 2.0] { let rr = r + e + (2.0 - d) * c; hud_web::pieza_pub(&mut v, "aro", x - rr, y - rr, 2.0 * rr, 2.0 * rr, col); }
            }
            None => l.rect(&mut t, 0.0, 0.0, wf, hf, velo),
        }
        if let Some(ca) = self.tut_carta(wf, hf) {
            let [x, y, cw, ch] = ca.caja; let mut tx = vec![];
            for k in [10.0f32, 6.0, 3.0] { let e = k * c; tx.push(([x - e, y - e + 8.0 * c, cw + 2.0 * e, ch + 2.0 * e], 12.0 * c + e, [0.0, 0.0, 0.0, 0.08])); }
            for (r, ra, col) in tx { l.caja(&mut t, r[0], r[1], r[2], r[3], ra, col); }
            l.caja(&mut t, x, y, cw, ch, 12.0 * c, [1.0; 4]);
            let px = 14.0 * c; for (s, tam, yy, col) in &ca.renglones { l.texto(&mut t, x + px, *yy, *tam, *col, s); }
            for (a, s, r) in &ca.botones {
                let tb = 13.0 * c;
                let (fondo, letra) = match a { AccTut::Siguiente => (Some(rgb(0x2f8fe8)), [1.0; 4]), AccTut::Anterior => (Some(rgb(0xe4e9ef)), rgb(0x2b3542)), AccTut::Saltear => (None, rgb(0x6b7785)) };
                if let Some(f) = fondo { l.caja(&mut t, r[0], r[1], r[2], r[3], 8.0 * c, f); }
                l.texto(&mut t, r[0] + (r[2] - l.ancho(tb, s)) / 2.0, r[1] + (r[3] - tb * 1.2) / 2.0, tb, letra, s);
            }
        }
        // (el velo y la tarjeta van en dos tandas: primero lo de las letras —los rectángulos del velo—, después el hueco y el
        // borde del atlas del HUD, y la tarjeta encima de todo)
        let (velo_t, carta_t): (Vec<f32>, Vec<f32>) = { let n = if self.tut_blanco(wf, hf).is_some() { 4 * 48 } else { 48 }; let mut a = t; let b = a.split_off(n.min(a.len())); (a, b) };
        u.push((TEX_LETRAS, velo_t)); u.push((hud_web::TEX_HUD, v)); u.push((TEX_LETRAS, carta_t));
    }
}
