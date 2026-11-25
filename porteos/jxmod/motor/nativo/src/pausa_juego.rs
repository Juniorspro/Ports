//! Lo del menú que se ve jugando: el botón de pausa arriba a la izquierda (el primero de la fila del sistema de hudorden.js,
//! en la esquina, redondo y con su ícono, como el de hud.js) y la pausa (ui.js abrirPausa y #pausa de template.html: Seguir
//! en amarillo; las tarjetas Personaje, Arma en la mano, Social, Ajustes, Ver el tutorial y Borrar todo; abajo Salir al
//! menú, Guardar, Cargar, VR, Grabar y los cuadros por segundo). Desde la pausa se abren los paneles del inicio (Personajes,
//! Social) encima del juego y «Volver» vuelve a la pausa. Y la pantalla de carga al empezar una partida (la foto del mapa,
//! el logo y su nombre).
use super::*;
use super::inicio_juego::{AMA, NEGRO, TX};
use super::paneles_juego::PanelIni;
use crate::pincel::{self, rgba, con_a, Cara, Col, Pincel};

const PZ_PL: Col = rgba(0x0c0d0f, 0.96);
const PZ_TAR: Col = rgba(0x1b1c1f, 1.0);
const PZ_BTN: Col = rgba(0x26272b, 1.0);
const PZ_T2: Col = rgba(0xaeaca6, 1.0);
const PZ_RO: Col = rgba(0xff8a7e, 1.0);

/// lo que se toca en la pausa
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Pz { Boton, Seguir, Cerrar, Personaje, Arma, Social, Ajustes, Tutorial, Borrar, Salir, Guardar, Cargar, Vr, Grabar }

#[derive(Default)]
pub struct Pausa { pub abierta: bool, t0: f32, zonas: Vec<([f32; 4], Pz)>, dedo: Option<(i32, Option<Pz>)>, apretado: Option<Pz>, golpe: Option<(Pz, f32)> }

/// el botón de pausa: el primero de la columna del sistema (hudorden.js), en la esquina —20 unidades del borde—, redondo, de
/// 96 unidades y nunca menos de 44 px (hud_web.rs: la zona de arriba a la izquierda de la web)
pub fn boton_pausa(w: f32, h: f32) -> (f32, f32, f32) {
    let [x, y, s] = super::hud_web::disposicion(w, h, 0).1; (x, y, s)
}
/// el botón MOD (el menú MOD de jugabilidad.rs): en el grupo de crear, después de Objetos (hud_web.rs)
pub fn boton_mod(w: f32, h: f32) -> (f32, f32, f32) {
    super::hud_web::disposicion(w, h, 0).0.into_iter().find(|b| b.b == super::Boton::Jg(super::jugabilidad::Bj::Mod)).map(|b| (b.x, b.y, b.w)).unwrap_or((0.0, 0.0, 0.0))
}

impl Juego {
    /// lo del menú encima del juego (después del HUD): el botón de pausa, la pausa, un panel abierto desde la pausa y la
    /// pantalla de carga; también carga el cuerpo nuevo si se eligió otro personaje
    pub(super) unsafe fn ini_hud(&mut self, m: &mut Motor3d, w: i32, h: i32, u: &mut Vec<(i64, Vec<f32>)>) {
        let (wf, hf) = (w as f32, h as f32);
        if self.ini.cuerpo_nuevo && self.mapa.is_some() { self.ini.cuerpo_nuevo = false; self.pz_cuerpo(m); }
        // (también mientras se miden los gráficos automáticos: gfxauto.js lo hace detrás de la carga)
        let cargando = (self.recargar && self.mapa.is_none()) || self.gfxa.midiendo();
        let ver_boton = !cargando && !self.pjs.panel() && self.mapa.is_some() && self.menu.is_none() && self.ajustes.is_none() && self.npc_panel.is_none() && !self.en_red.panel && !self.gmod.panel && !self.emotes_panel && !self.jg.panel() && !self.jg.sin_hud();
        if !ver_boton && !self.ini.pz.abierta && self.ini.panel.is_none() && !cargando { return; }
        self.ini_recursos(m);
        if cargando { for k in self.pz_foto_carga() { self.ini_pedir_foto(&k); } self.ini_pedir_foto("logo"); self.ini_recursos(m); }
        let dt = 1.0 / 60.0f32.max(self.fps); self.ini.reloj += dt.min(0.1);
        let atlas = self.ini.rec.atlas.take(); let mut ico = std::mem::take(&mut self.ini.rec.ico); let mut gl = std::mem::take(&mut self.ini.rec.gl);
        if let Some(at) = atlas.as_ref() {
            let mut p = Pincel::nuevo(at, &mut ico, &mut gl);
            if cargando { self.pz_carga(&mut p, wf, hf); }
            else {
                if self.ini.pz.abierta && self.ini.panel.is_none() { self.pz_dibujar(&mut p, wf, hf); }
                if let Some(pn) = self.ini.panel.clone() { p.rect(0.0, 0.0, wf, hf, rgba(0x050608, 0.55)); self.pn_dibujar(&mut p, &pn, wf, hf); }
            }
            u.extend(p.tandas);
        }
        self.ini.rec.atlas = atlas; self.ini.rec.ico = ico; self.ini.rec.gl = gl;
        self.ini.rec.ico.subir(m, false); self.ini.rec.gl.subir(m, false);
    }
    /// el cuerpo del personaje elegido (como en cargar_mapa: si la skin no está, el Hero)
    unsafe fn pz_cuerpo(&mut self, m: &mut Motor3d) {
        let Some(paq) = self.paq.as_mut() else { return };
        let r = Personaje::cargar(paq, &self.skin, 0, 512, &mut self.pj_cargados).or_else(|_| Personaje::cargar(paq, "Hero", 0, 512, &mut self.pj_cargados));
        if let Ok((mut pj, esc)) = r { if let Some((a, b)) = &self.nado { let _ = pj.nado(a, b); } if m.cargar(&esc).is_ok() { self.pj = Some(pj); } }
    }
    /// el botón de pausa: si se ve y si está apretado (lo dibuja hud_web.rs, con los demás botones y el ícono de la web)
    pub(super) fn pausa_boton(&self) -> Option<bool> {
        let cargando = (self.recargar && self.mapa.is_none()) || self.gfxa.midiendo();
        let ver = !cargando && !self.pjs.panel() && self.mapa.is_some() && self.menu.is_none() && self.ajustes.is_none() && self.npc_panel.is_none() && !self.en_red.panel && !self.gmod.panel && !self.emotes_panel && !self.jg.panel() && !self.jg.sin_hud() && !self.ini.pz.abierta && self.ini.panel.is_none();
        ver.then_some(self.ini.pz.apretado == Some(Pz::Boton))
    }
    /// la pausa: el velo, la caja, Seguir, las tarjetas y el pie
    fn pz_dibujar(&mut self, p: &mut Pincel, w: f32, h: f32) {
        let mut z = vec![]; let t = self.ini.reloj - self.ini.pz.t0;
        let k = inicio_juego::bezier(0.2, 0.8, 0.2, 1.0, inicio_juego::prog(t, 0.0, 0.25));
        p.rect(0.0, 0.0, w, h, rgba(0x050608, 0.55 * k));
        let chico = h < 500.0; let cw = 620.0f32.min(w - 24.0); let ch = (0.088 * h).clamp(44.0, 52.0); let ftit = (0.036 * h).clamp(21.0, 24.0); let fseg = (0.034 * h).clamp(18.0, 20.0);
        let tar_h = if chico { 77.0 } else { 92.0 }; let pad_g = if chico { 10.0 } else { 14.0 };
        let alto = 1.0 + ch + 12.0 + ch + 8.0 + 2.0 * tar_h + 6.0 + pad_g + 1.0 + 10.0 + 44.0 + 10.0 + 1.0;
        let (x0, y0) = ((w - cw) / 2.0, ((h - alto) / 2.0).max(4.0));
        p.con(pincel::mm(pincel::mover(0.0, 10.0 * (1.0 - k)), IDENT_), |p| p.con_alfa(k, |p| {
            p.rect(x0, y0, cw, alto, PZ_PL); p.grano(x0, y0, cw, alto, x0, y0, 0.6); p.borde(x0, y0, cw, alto, 1.0, rgba(0xefede7, 0.12));
            let (x, y) = (x0 + 1.0, y0 + 1.0); let iw = cw - 2.0;
            // (la cabecera: el cuadrado amarillo con la pausa, «PAUSA», el modo y la X)
            p.rect(x, y, ch, ch, AMA); let l = ch * 18.0 / 52.0; p.icono("pausa", x + (ch - l) / 2.0, y + (ch - l) / 2.0, l, 3.2, NEGRO);
            let base = p.at.base_centrada(Cara::O6, ftit, ftit * 1.3, y, ch); let wt = p.texto(Cara::O6, ftit, x + ch + 14.0, base, TX, 0.03, "PAUSA");
            let modo = if self.en_red.en_sala() { self.en_red.red.sala.as_ref().map(|s| s.n.clone()).unwrap_or_default() } else { "Un solo jugador".into() };
            let fm = 12.0; let wm = p.at.ancho(Cara::O5, fm, 0.08, &modo.to_uppercase()) + 16.0; let rm = [x + ch + 14.0 + wt + 14.0, y + (ch - 23.6) / 2.0, wm, 23.6];
            p.borde(rm[0], rm[1], rm[2], rm[3], 1.0, rgba(0xefede7, 0.12)); p.texto(Cara::O5, fm, rm[0] + 8.0, p.at.base_centrada(Cara::O5, fm, fm * 1.2, rm[1], rm[3]), PZ_T2, 0.08, &modo.to_uppercase());
            let rx = [x + iw - 12.0 - 40.0, y + (ch - 40.0) / 2.0, 40.0, 40.0]; p.rect(rx[0], rx[1], rx[2], rx[3], if self.ini.pz.apretado == Some(Pz::Cerrar) { rgba(0x303137, 1.0) } else { PZ_BTN });
            p.icono("no", rx[0] + 11.0, rx[1] + 11.0, 18.0, 2.4, TX); z.push((rx, Pz::Cerrar));
            // (Seguir)
            let rs = [x + 14.0, y + ch + 12.0, iw - 28.0, ch]; self.pz_golpe(p, Pz::Seguir, rs, |p| {
                p.rect(rs[0], rs[1], rs[2], rs[3], if self.ini.pz.apretado == Some(Pz::Seguir) { rgba(0xffc531, 1.0) } else { AMA });
                p.icono("jugar", rs[0] + 15.0, rs[1] + (rs[3] - 20.0) / 2.0, 20.0, 2.2, NEGRO);
                p.texto(Cara::O6, fseg, rs[0] + 48.0, p.at.base_centrada(Cara::O6, fseg, fseg, rs[1], rs[3]), NEGRO, 0.05, "SEGUIR"); });
            z.push((rs, Pz::Seguir));
            // (las tarjetas, tres por fila)
            let tars = [(Pz::Personaje, "persona", "Personaje", "Cambiar skin"), (Pz::Arma, "pistola", "Arma en la mano", "Equipar"), (Pz::Social, "gente", "Social", "Amigos y chats"),
                (Pz::Ajustes, "ajustes", "Ajustes", "Controles y gráficos"), (Pz::Tutorial, "pregunta", "Ver el tutorial", "Aprendé a jugar"), (Pz::Borrar, "basura", "Borrar todo", "Limpiar el mapa")];
            let gy = rs[1] + rs[3] + 8.0; let tw = (iw - 28.0 - 12.0) / 3.0;
            for (i, (pz, ic, tit, sub)) in tars.iter().enumerate() {
                let r = [x + 14.0 + (i % 3) as f32 * (tw + 6.0), gy + (i / 3) as f32 * (tar_h + 6.0), tw, tar_h]; let rojo = *pz == Pz::Borrar;
                self.pz_golpe(p, *pz, r, |p| {
                    p.rect(r[0], r[1], r[2], r[3], if self.ini.pz.apretado == Some(*pz) { rgba(0x26272b, 1.0) } else { PZ_TAR });
                    let (pl, pt, li) = if chico { (14.0, 9.0, 20.0) } else { (16.0, 12.0, 22.0) };
                    p.icono(ic, r[0] + pl, r[1] + pt, li, 1.9, if rojo { PZ_RO } else { PZ_T2 });
                    let yb = r[1] + pt + li + if chico { 3.0 } else { 10.0 };
                    p.texto_max(Cara::O5, 16.0, r[0] + pl, p.at.base_centrada(Cara::O5, 16.0, 20.8, yb, 20.8), if rojo { PZ_RO } else { TX }, 0.03, &tit.to_uppercase(), r[2] - pl - 8.0);
                    let (a, d) = p.at.metricas(Cara::S4, 12.0); p.texto(Cara::S4, 12.0, r[0] + pl, yb + 20.8 + (16.2 - a - d) / 2.0 + a, PZ_T2, 0.0, sub);
                });
                z.push((r, *pz));
            }
            // (el pie: Salir al menú, Guardar, Cargar, VR, Grabar y los fps)
            let py = gy + 2.0 * tar_h + 6.0 + pad_g; p.rect(x, py, iw, 1.0, rgba(0xefede7, 0.12));
            let by = py + 1.0 + 10.0; let f = 14.0; let mut bx = x + 14.0;
            let pie = [(Pz::Salir, "salir", "Salir al menú"), (Pz::Guardar, "guardar", "Guardar"), (Pz::Cargar, "subir", "Cargar"), (Pz::Vr, "vr", "VR"), (Pz::Grabar, "", "Grabar")];
            let fps = format!("{:.0} FPS", self.fps); let wf_ = p.at.ancho(Cara::O5, 12.0, 0.08, &fps);
            let anchos: Vec<f32> = pie.iter().map(|(_, _, s)| 28.0 + 16.0 + 8.0 + p.at.ancho(Cara::O5, f, 0.05, &s.to_uppercase())).collect();
            let sobra = iw - 28.0 - wf_ - 6.0 * pie.len() as f32 - anchos.iter().sum::<f32>();
            for (k, (pz, ic, s)) in pie.iter().enumerate() {
                let mut bw = anchos[k]; if k == 0 && sobra < 0.0 { bw += sobra; }
                let r = [bx, by, bw.max(44.0), 44.0];
                self.pz_golpe(p, *pz, r, |p| {
                    p.rect(r[0], r[1], r[2], r[3], if self.ini.pz.apretado == Some(*pz) { rgba(0x303137, 1.0) } else { PZ_BTN });
                    if ic.is_empty() { p.disco(r[0] + 14.0 + 8.0, r[1] + 22.0, 5.0, rgba(0xff5a50, 1.0)); } else { p.icono(ic, r[0] + 14.0, r[1] + 14.0, 16.0, 2.2, TX); }
                    let txt = s.to_uppercase(); let wmax = r[2] - 14.0 - 16.0 - 8.0 - 8.0;
                    if p.at.ancho(Cara::O5, f, 0.05, &txt) > wmax { let rs = p.at.renglones(Cara::O5, f, 0.05, &txt, wmax); let n = rs.len() as f32;
                        for (j, rr) in rs.iter().enumerate() { p.texto_c(Cara::O5, f, r[0] + 38.0 + wmax / 2.0, r[1] + 22.0 - n * 7.0 + j as f32 * 14.0 + 11.0, TX, 0.05, rr); } }
                    else { p.texto(Cara::O5, f, r[0] + 38.0, p.at.base_centrada(Cara::O5, f, f, r[1], r[3]), TX, 0.05, &txt); }
                });
                z.push((r, *pz)); bx += r[2] + 6.0;
            }
            p.texto(Cara::O5, 12.0, bx, p.at.base_centrada(Cara::O5, 12.0, 12.0, by, 44.0), rgba(0x8f8d88, 1.0), 0.08, &fps);
        }));
        self.ini.pz.zonas = z;
    }
    fn pz_golpe(&self, p: &mut Pincel, pz: Pz, r: [f32; 4], f: impl FnOnce(&mut Pincel)) {
        let mut k = 0.0; if let Some((g, t0)) = self.ini.pz.golpe { if g == pz { let x = ((self.ini.reloj - t0) / 0.2).clamp(0.0, 1.0); k = if x < 0.35 { x / 0.35 } else { 1.0 - (x - 0.35) / 0.65 }; } }
        let s = 1.0 - 0.035 * k; p.con(pincel::escalar_en(s, s, r[0] + r[2] / 2.0, r[1] + r[3] / 2.0), f);
    }
    /// las fotos de la pantalla de carga: la del mapa (carga/x.webp) o su ícono
    fn pz_foto_carga(&self) -> Vec<String> {
        let m = self.mapas.get(self.mapa_i).cloned().unwrap_or_default();
        let mut v = vec![]; if let Some(c) = super::paneles_juego::fondo_mapa(&m) { v.push(format!("a:carga/{c}.webp")); } v.push(format!("i:mapa_{m}")); v
    }
    /// la pantalla de carga (#carga): la foto del mapa de fondo, oscurecida, el logo, «Sandbox» y el nombre del mapa
    fn pz_carga(&self, p: &mut Pincel, w: f32, h: f32) {
        p.rect(0.0, 0.0, w, h, [0.0, 0.0, 0.0, 1.0]);
        if let Some((id, tw, th)) = self.pz_foto_carga().iter().find_map(|k| self.ini_foto(k)) { p.foto_cubre(id, tw, th, 0.0, 0.0, w, h, [0.5, 0.5], [1.0; 4]); }
        p.degrade_v(0.0, 0.0, w, h, &[(0.0, [0.0, 0.0, 0.0, 0.55]), (0.45, [0.0, 0.0, 0.0, 0.2]), (1.0, [0.0, 0.0, 0.0, 0.85])]);
        let vh = h / 100.0; let lh = (12.0 * vh).clamp(40.0, 110.0); let m = (5.0 * vh).max(12.0);
        if let Some((id, _, _)) = self.ini_foto("logo") { p.foto(id, m, m, lh * 1155.0 / 360.0, lh, [1.0; 4]); }
        let f = (2.9 * vh).max(14.0); let y = m + lh + f * 0.8;
        let ws = p.texto(Cara::O5, f, m, y + f, AMA, 0.1, "SANDBOX"); p.texto(Cara::O5, f, m + ws + f * 0.6, y + f, con_a(TX, 0.68), 0.05, &format!("v{}", self.ini.version));
        let nom = super::paneles_juego::nombre_mapa(&self.mapas.get(self.mapa_i).cloned().unwrap_or_default()).to_uppercase(); let fg = (6.4 * vh).clamp(22.0, 50.0);
        p.texto(Cara::O6, fg, m, y + f * 1.6 + fg, TX, 0.02, &nom);
        // (abajo: el estado y una barra que se llena —acá el mapa se arma de una vez—)
        let fb = (2.6 * vh).max(13.0); let by = h - m - 6.0;
        let midiendo = self.gfxa.midiendo();
        // (si se está bajando el paquete del mapa: cuánto va, en MB, y la barra con eso)
        let mb = |x: u64| format!("{:.1}", x as f64 / 1048576.0).replace('.', ",");
        let (txt, lleno) = match self.bajada { Some((va, tot, _)) if !midiendo => (if tot > 0 { format!("BAJANDO EL MAPA… {} DE {} MB", mb(va), mb(tot)) } else { "BAJANDO EL MAPA…".to_string() }, if tot > 0 { (va as f32 / tot as f32).clamp(0.02, 1.0) } else { 0.05 }),
            _ => ((if midiendo { "AJUSTANDO LOS GRÁFICOS…" } else { "CARGANDO EL MAPA…" }).to_string(), if midiendo { 0.9 } else { 0.35 }) };
        p.texto(Cara::O5, fb, m, by - fb * 0.9, con_a(TX, 0.85), 0.06, &txt); p.texto_d(Cara::O5, fb, w - m, by - fb * 0.9, con_a(TX, 0.6), 0.1, "JXSTUDIOS");
        p.rect(m, by, w - 2.0 * m, 4.0, rgba(0xefede7, 0.15)); p.rect(m, by, (w - 2.0 * m) * lleno, 4.0, AMA);
    }

    // —— el tacto jugando: el botón de pausa, la pausa y los paneles abiertos desde ella ——
    fn pz_en(&self, x: f32, y: f32) -> Option<Pz> { self.ini.pz.zonas.iter().rev().find(|(r, _)| x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]).map(|z| z.1) }
    pub(super) fn pz_dedo_abajo(&mut self, id: i32, x: f32, y: f32, w: f32, h: f32) -> bool {
        if self.ini.panel.is_some() { self.pn_dedo_abajo(id, x, y, w, h); return true; }
        if self.ini.pz.abierta { let pz = self.pz_en(x, y); self.ini.pz.apretado = pz; if let Some(pz) = pz { self.ini.pz.golpe = Some((pz, self.ini.reloj)); } self.ini.pz.dedo = Some((id, pz)); return true; }
        // (el botón de pausa, si se ve: sólo jugando, sin otro menú abierto)
        let libre = !self.pjs.panel() && self.mapa.is_some() && self.menu.is_none() && self.ajustes.is_none() && self.npc_panel.is_none() && !self.en_red.panel && !self.gmod.panel && !self.emotes_panel && !self.jg.panel() && !self.jg.sin_hud();
        let (cx, cy, s) = boton_pausa(w, h);
        if libre && (x - cx).powi(2) + (y - cy).powi(2) <= (s / 2.0 + 4.0).powi(2) { self.ini.pz.apretado = Some(Pz::Boton); self.ini.pz.dedo = Some((id, Some(Pz::Boton))); return true; }
        false
    }
    pub(super) fn pz_dedo_mueve(&mut self, id: i32, x: f32, y: f32, h: f32) -> bool {
        if self.ini.panel.is_some() { self.pn_dedo_mueve(id, x, y, h); return true; }
        if let Some((d, pz)) = self.ini.pz.dedo { if d == id { if self.ini.pz.abierta && self.pz_en(x, y) != pz { self.ini.pz.apretado = None; } return true; } }
        self.ini.pz.abierta
    }
    pub(super) fn pz_dedo_arriba(&mut self, id: i32, w: f32, h: f32) -> bool {
        if self.ini.panel.is_some() { self.pn_dedo_arriba(id, w, h); return true; }
        let Some((d, pz)) = self.ini.pz.dedo else { return self.ini.pz.abierta }; if d != id { return true; }
        self.ini.pz.dedo = None; let suelto = self.ini.pz.apretado.take();
        if let (Some(a), Some(b)) = (pz, suelto) { if a == b { self.sonido.tocar("Click", 0.5, 1.0, None); self.pz_accion(a); } }
        true
    }
    /// abrir la pausa (abrirPausa)
    pub fn pz_abrir(&mut self) { self.ini.pz.abierta = true; self.ini.pz.t0 = self.ini.reloj; self.dedos.clear(); }
    fn pz_accion(&mut self, a: Pz) {
        match a {
            Pz::Boton => self.pz_abrir(),
            Pz::Seguir | Pz::Cerrar => self.ini.pz.abierta = false,
            Pz::Personaje => { self.ini.pz.abierta = false; if self.mapa.is_some() { self.pj_abrir_desde_pausa(); } else { self.ini.desde_juego = true; self.pn_abrir(PanelIni::Personajes { tab: 0, scroll: 0.0 }); } }
            Pz::Social => { self.ini.pz.abierta = false; self.ini.desde_juego = true; self.pn_abrir(PanelIni::Social { tab: 0 }); }
            Pz::Ajustes => { self.ini.pz.abierta = false; self.ajustes = Some(0); }
            Pz::Borrar => { self.pz_borrar_todo(); self.ini.pz.abierta = false; self.avisar("Se borró todo".into()); }
            Pz::Salir => { self.ini.pz.abierta = false; self.lan_salir(); self.inicio_abrir(); }
            Pz::Arma => { self.ini.pz.abierta = false; self.arma_aj_abrir(); }
            Pz::Tutorial => self.avisar("El tutorial todavía no está en la versión nativa".into()),
            Pz::Guardar | Pz::Cargar => self.avisar("Guardar y cargar el mapa todavía no está en la versión nativa".into()),
            Pz::Vr => self.avisar("El modo VR todavía no está en la versión nativa".into()),
            Pz::Grabar => self.avisar("Grabar todavía no está en la versión nativa".into()),
        }
    }
    /// «Borrar todo» (limpiar el mapa): los objetos, los vehículos y los NPC puestos
    fn pz_borrar_todo(&mut self) {
        let Some(mp) = self.mapa.as_ref() else { return };
        for o in std::mem::take(&mut self.objs) { if let Some(id) = o.cuerpo { let _ = self.vehs.quitar(id, &self.fis, &mp.mundo); self.fis.quitar(id); self.aguas.olvidar(id); } }
        self.npcs.todos(&mut self.fis); self.pila.clear(); self.proys.clear(); self.por_explotar.clear();
    }
}
const IDENT_: [f32; 6] = pincel::IDENT;
impl super::inicio_juego::Inicio {
    /// (para las pruebas) dónde está algo de la pausa
    pub fn pz_zona(&self, p: Pz) -> Option<[f32; 4]> { self.pz.zonas.iter().find(|z| z.1 == p).map(|z| z.0) }
}
