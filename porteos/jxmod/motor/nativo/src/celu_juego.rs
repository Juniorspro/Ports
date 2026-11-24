//! El celular (celular.js y celumano.js), hijo de personajes.rs: un arma («Celular», viene instalada y prendida) que en
//! primera persona se ve en la mano derecha (la vista «Hands» con cinemática inversa: jxjuego::celu_vista) con su pantalla
//! encima, en perspectiva, donde se toca; en tercera persona el personaje lo sostiene delante del pecho (los demás de la sala
//! también lo ven) y la pantalla va chica en la esquina. Las apps: Objetos (poner sin cerrar el celular), Memes, Jugadores
//! (los de la sala; el dueño del server puede echar), Emotes, Cámara, Mods y Ajustes.
use super::*;
use jxjuego::celu_ik::{self as ik, Pose, CELM_D, CELM_H, CELM_SH, CELM_SW, CELM_SY, CELM_W};
use jxjuego::vista::celu_vista::ManoCelu;

/// las apps (CEL_APPS): clave, nombre y color
pub const APPS: [(&str, &str, &str); 7] = [("props", "Objetos", "#2f80ed"), ("memes", "Memes", "#e53935"), ("gente", "Jugadores", "#27ae60"), ("emotes", "Emotes", "#f2994a"), ("camara", "Cámara", "#56606e"), ("mods", "Mods", "#8e44ad"), ("ajustes", "Ajustes", "#3d4450")];
/// para qué se pidió escribir (el cuadro de texto)
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Escribe { BuscarPj, HexGorro, BuscarCelu, BuscarEmo }
/// el tamaño de la pantalla del celular en la mano (CSS: 270 × 560)
pub const PW: f32 = 270.0; pub const PH: f32 = 560.0;

#[derive(Default)]
pub struct Celu {
    /// la app abierta (None: el inicio), la categoría de Objetos, lo buscado, cuánto se bajó y lo último puesto
    pub app: Option<&'static str>, pub cat: usize, pub q: String, pub scroll: f32, pub puso: Option<(String, f32)>, pub meme_tab: u8,
    /// la mano de primera persona (y lo que el motor ya tiene de ella) y dónde quedó el celular este cuadro
    mano: Option<ManoCelu>, mano_ya: vista::Cargados, mano_esc: Option<Escena>, mano_err: bool, pub pose: Option<Pose>,
    /// el celular en la mano del jugador en tercera persona (en el espacio del personaje) y en las de los demás (en el mundo)
    pub pose3p: Option<Pose>, pub rem3p: HashMap<String, Pose>, dedos: HashMap<String, Option<Vec<(usize, [f32; 4])>>>,
    /// en la mano este cuadro; el arma de antes (CELM.prev); los materiales ya en el motor
    pub en_mano: bool, pub prev: Option<usize>, mats: bool,
    /// el tamaño de la pantalla, lo que se espera escribir, cuándo guardar, a quién eché
    pub pantalla: (f32, f32), pub escribe: Option<Escribe>, pub guardar_t: f32, pub echados: Vec<String>,
    /// el atlas de los íconos de la categoría de Objetos abierta, el toque que baja la lista
    obj_atlas: Option<Vec<String>>, dedo: Option<(i32, f32, f32, bool)>,
    /// la cámara de este cuadro (para dibujar la mano) y el campo de visión
    cam: Option<([f32; 3], [f32; 4], f32, f32, [f32; 5])>,
}
impl Celu {
    /// el celular abierto (en la mano)
    pub fn abierto(&self) -> bool { self.en_mano }
    /// no toma todos los toques: sólo los de su pantalla (al apoyar)
    pub fn panel_toma(&self) -> bool { false }
}
fn hexc(h: &str) -> [f32; 3] { [1, 3, 5].map(|i| u8::from_str_radix(&h[i..i + 2], 16).unwrap_or(0) as f32 / 255.0) }

/// antes de armar lo que se dibuja: la cámara del cuadro (la mano va pegada a ella)
pub fn antes_items(c: &mut Celu, ojos: [f32; 3], q: [f32; 4], fov: f32, asp: f32, sway: [f32; 5]) {
    c.cam = Some((ojos, q, fov, asp, sway));
    if !c.en_mano { return; }
    if let Some(m) = c.mano.as_mut() { c.pose = m.ubicar(ojos, q, fov, asp, true, sway); }
}
/// el jugador ya animado: con el celular en la mano (y sin emote, ni sentado), el brazo lo sostiene (celmBrazo3p)
pub fn pose_jugador(p: &mut Pjs, pj: &mut Personaje, celu: bool, emote: bool, en_veh: bool) {
    p.celu.pose3p = None;
    if !celu || emote || en_veh { return; }
    let d = p.celu.dedos.entry(pj.skin.clone()).or_default();
    p.celu.pose3p = pj.celu_3p(d);
}

impl Juego {
    /// celmSacar: saca el celular o vuelve al arma de antes
    pub(crate) fn celm_sacar(&mut self) {
        let Some(i) = ARMAS.iter().position(|a| a.tipo == "celu") else { self.avisar("Activá el mod Celular (menú MOD)".into()); return };
        if self.armas.i == i { let j = self.pjs.celu.prev.filter(|&p| p != i && p < ARMAS.len()).unwrap_or(0); self.gmod_guardar_arma(); self.armas.elegir(&mut self.fis, j); }
        else { self.pjs.celu.prev = Some(self.armas.i); self.gmod_guardar_arma(); self.armas.elegir(&mut self.fis, i); self.pjs.celu.app = None; self.sonido.tocar("UI_blip", 0.35, 1.0, None); }
    }
    pub(crate) fn celu_limpiar(&mut self) { let c = &mut self.pjs.celu; c.mano = None; c.mano_ya = vista::Cargados::default(); c.mano_esc = None; c.mano_err = false; c.mats = false; c.obj_atlas = None; c.pose = None; c.rem3p.clear(); }
    pub(super) unsafe fn celu_cuadro(&mut self, m: &mut Motor3d, dt: f32) {
        let en_mano = self.armas.def().tipo == "celu" && self.vehs.jugador.is_none() && self.jug.vida > 0.0;
        if self.pjs.celu.en_mano && !en_mano { self.pjs.celu.app = None; }
        self.pjs.celu.en_mano = en_mano;
        if let Some((_, t)) = &mut self.pjs.celu.puso { *t -= dt; if *t <= 0.0 { self.pjs.celu.puso = None; } }
        if self.pjs.celu.guardar_t > 0.0 { self.pjs.celu.guardar_t -= dt; if self.pjs.celu.guardar_t <= 0.0 { self.pjs_guardar(); } }
        // (los materiales del celular: cuerpo, marco de metal, vidrio, lente y la pantalla de tercera persona)
        if !self.pjs.celu.mats {
            let mats = vec![jxjuego::geo::mat_propio(CELU_MAT, [0.07, 0.075, 0.085], [0.35, 0.6, 0.05], [0.0; 3]), jxjuego::geo::mat_propio(CELU_MAT - 1, [0.32, 0.33, 0.36], [0.25, 0.9, 0.05], [0.0; 3]),
                jxjuego::geo::mat_propio(CELU_MAT - 2, [0.01, 0.01, 0.015], [0.08, 0.2, 0.05], [0.0; 3]), jxjuego::geo::mat_propio(CELU_MAT - 3, [0.02, 0.02, 0.03], [0.05, 0.6, 0.05], [0.0; 3]),
                jxjuego::geo::mat_propio(CELU_MAT - 4, [0.25, 0.4, 0.9], [0.7, 0.0, 0.04], [0.35, 0.55, 1.2])];
            let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats, texs: vec![], lms: vec![], items: vec![], agua: None, cielo: None };
            self.pjs.celu.mats = m.cargar(&Escena { c: cab, datos: vec![] }).is_ok();
        }
        // (la mano de primera persona, la primera vez que se saca)
        if en_mano && self.pjs.celu.mano.is_none() && !self.pjs.celu.mano_err { if let Some(paq) = self.paq.as_mut() {
            match ManoCelu::cargar(paq, &mut self.pjs.celu.mano_ya) { Ok((v, e)) => { if m.cargar(&e).is_ok() { self.pjs.celu.mano = Some(v); } else { self.pjs.celu.mano_err = true; } } Err(e) => { self.pjs.celu.mano_err = true; self.avisar(format!("celular: {e}")); } }
        } }
        // (los demás con el celular en la mano: el brazo lo sostiene; el celular queda en el mundo)
        let rem: Vec<(String, f32, f32, f32, f32, bool)> = self.en_red.red.remotos().iter().filter(|r| r.visible && r.arma.as_deref() == Some("Celular") && r.emote.is_none() && r.veh.is_none() && !r.rag)
            .map(|r| (r.id.clone(), r.pos[0] as f32, r.pos[1] as f32, r.pos[2] as f32, r.yaw as f32, true)).collect();
        self.pjs.celu.rem3p.clear();
        for (id, x, y, z, yaw, _) in rem {
            let Some((pj, _)) = self.en_red.cuerpos.get_mut(&id) else { continue };
            let d = self.pjs.celu.dedos.entry(pj.skin.clone()).or_default();
            if let Some(p) = pj.celu_3p(d) { let b = pj.base_sentado().unwrap_or_else(|| personaje::base([x, y - 0.95, z], yaw)); self.pjs.celu.rem3p.insert(id, pose_mundo(&b, &p)); }
        }
        if en_mano { self.celu_atlas(m); }
    }
    /// lo que se dibuja: la mano y el celular en primera persona; el celular de tercera persona (el mío y los de los demás)
    pub(crate) fn celu_items(&self, items: &mut Vec<ItemDin>, _cam: [f32; 3], ver_cuerpo: bool) {
        let c = &self.pjs.celu;
        if c.en_mano && self.camara == 0 && !self.jg.sin_hud() && !ver_cuerpo {
            if let (Some(m), Some(p)) = (&c.mano, &c.pose) { m.items(items); celu_cajas(p, items); }
        }
        if c.en_mano && ver_cuerpo { if let (Some(p), Some(pj)) = (&c.pose3p, &self.pj) {
            let jp = self.jug.pos; let b = pj.base_sentado().unwrap_or_else(|| personaje::base([jp[0], jp[1] - 0.95, jp[2]], self.jug.yaw)); celu_3p_cajas(&pose_mundo(&b, p), items);
        } }
        for p in c.rem3p.values() { celu_3p_cajas(p, items); }
    }
    /// el atlas de los íconos de la categoría de Objetos abierta (los del menú: DATA.ico)
    unsafe fn celu_atlas(&mut self, m: &mut Motor3d) {
        if self.pjs.celu.app != Some("props") { return; }
        let l = self.celu_lista_obj(); if self.pjs.celu.obj_atlas.as_ref() == Some(&l) { return; }
        let Some(paq) = self.paq.as_ref() else { return };
        let (aw, ah) = (ICO_COLS * ICO, ((l.len() as u32).div_ceil(ICO_COLS).max(1) * ICO).next_power_of_two().min(4096)); let mut px = vec![0u8; (aw * ah * 4) as usize];
        for (k, it) in l.iter().enumerate() { if (k as u32 / ICO_COLS + 1) * ICO > ah { break; } if let Some(ic) = objetos::icono(paq, npc::skin_de_item(it).unwrap_or(it), ICO) { atlas_celda(&mut px, aw, k as u32, &ic, ICO); } }
        subir_tex(m, TEX_CELU_OBJ, aw, ah, px); self.pjs.celu.obj_atlas = Some(l);
    }
    /// celCats: las categorías de Objetos (las de Props, Vehículos y Entidades del menú, sin las vacías)
    fn celu_cats(&self) -> Vec<(String, Vec<String>)> {
        let mut v: Vec<(String, Vec<String>)> = self.catalogo.iter().filter(|c| c.0 != "Opciones" && !c.1.is_empty()).cloned().collect();
        v.extend(self.cat_veh.iter().filter(|c| !c.1.is_empty()).cloned());
        if let Some(p) = &self.paq { v.extend(objetos::menu(&p.d, "Entities").into_iter().filter(|c| !c.1.is_empty())); }
        v
    }
    /// celGrilla: lo de la categoría elegida o, buscando, de todas (hasta 80)
    fn celu_lista_obj(&self) -> Vec<String> {
        let cats = self.celu_cats(); let q = self.pjs.celu.q.to_lowercase();
        if !q.is_empty() { return cats.iter().flat_map(|c| c.1.iter()).filter(|n| format!("{} {}", n, self.jg.nombre_item(n)).to_lowercase().contains(&q)).take(80).cloned().collect(); }
        cats.get(self.pjs.celu.cat).or(cats.first()).map(|c| c.1.clone()).unwrap_or_default()
    }

    // ---------------- la pantalla ----------------
    /// dónde va la pantalla del celular en la pantalla del aparato: en la mano, las cuatro esquinas (celmEsquinas: arriba-izq,
    /// arriba-der, abajo-der, abajo-izq); en tercera persona, la esquina de abajo a la derecha
    fn celu_esquinas(&self, w: f32, h: f32) -> Option<[[f32; 2]; 4]> {
        if !self.pjs.celu.en_mano || self.mapa.is_none() { return None; }
        if self.camara == 0 && self.pjs.celu.pose.is_some() && !self.jg.sin_hud() {
            let p = self.pjs.celu.pose.as_ref()?; let vp = &self.vp_ult; let z = CELM_D / 2.0 + 0.0006; let mut out = [[0.0; 2]; 4];
            for (k, (x, y)) in [(-1.0f32, 1.0f32), (1.0, 1.0), (1.0, -1.0), (-1.0, -1.0)].iter().enumerate() {
                let q = ik::punto(p, x * CELM_SW / 2.0, CELM_SY + y * CELM_SH / 2.0, z);
                let cw = vp[3] * q[0] + vp[7] * q[1] + vp[11] * q[2] + vp[15]; if cw <= 1e-4 { return None; }
                out[k] = [((vp[0] * q[0] + vp[4] * q[1] + vp[8] * q[2] + vp[12]) / cw + 1.0) / 2.0 * w, (1.0 - (vp[1] * q[0] + vp[5] * q[1] + vp[9] * q[2] + vp[13]) / cw) / 2.0 * h];
            }
            return Some(out);
        }
        // (tercera: #celular.mano.tercera, con su marco: la pantalla adentro)
        let css = h / 393.0; let (ch, cw) = ((h * 0.6).min(440.0 * css), (h * 0.292).min(214.0 * css)); let x1 = w - (12.0 * css).max(w * 0.03); let y1 = h - 6.0 * css;
        let pad = cw * 0.055; let (x0, y0) = (x1 - cw + pad, y1 - ch + pad); let (xe, ye) = (x1 - pad, y1 - pad);
        Some([[x0, y0], [xe, y0], [xe, ye], [x0, ye]])
    }
    /// el tamaño de la pantalla en sus coordenadas (px CSS): en la mano 270 × 560; en la esquina (tercera persona) lo que
    /// queda adentro del marco de #celular.mano.tercera, sin escalar (como el DOM)
    pub(crate) fn celu_dim(&self) -> (f32, f32) {
        let h = self.pjs.celu.pantalla.1;
        if (self.camara == 0 && self.pjs.celu.pose.is_some() && !self.jg.sin_hud()) || h <= 0.0 { return (PW, PH); }
        let css = h / 393.0; let (ch, cw) = ((h * 0.6).min(440.0 * css), (h * 0.292).min(214.0 * css)); let pad = cw * 0.055;
        ((cw - 2.0 * pad) / css, (ch - 2.0 * pad) / css)
    }
    /// la homografía que lleva el rectángulo de la pantalla (pw × ph) a esas cuatro esquinas (celmMatriz) y la inversa
    fn celu_h(q: &[[f32; 2]; 4], (pw, ph): (f32, f32)) -> [f32; 9] {
        let [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = *q;
        let (dx1, dx2, dx3, dy1, dy2, dy3) = (x1 - x2, x3 - x2, x0 - x1 + x2 - x3, y1 - y2, y3 - y2, y0 - y1 + y2 - y3);
        let den = dx1 * dy2 - dx2 * dy1; let (g, k) = if (dx3.abs() < 1e-9 && dy3.abs() < 1e-9) || den.abs() < 1e-12 { (0.0, 0.0) } else { ((dx3 * dy2 - dx2 * dy3) / den, (dx1 * dy3 - dx3 * dy1) / den) };
        let (a, b, c, d, e, f) = (x1 - x0 + g * x1, x3 - x0 + k * x3, x0, y1 - y0 + g * y1, y3 - y0 + k * y3, y0);
        [a / pw, b / ph, c, d / pw, e / ph, f, g / pw, k / ph, 1.0]
    }
    fn celu_aplicar(hm: &[f32; 9], x: f32, y: f32) -> [f32; 2] { let w = hm[6] * x + hm[7] * y + hm[8]; [(hm[0] * x + hm[1] * y + hm[2]) / w, (hm[3] * x + hm[4] * y + hm[5]) / w] }
    fn celu_inversa(hm: &[f32; 9], x: f32, y: f32) -> [f32; 2] {
        let m = hm; let det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
        let inv = [(m[4] * m[8] - m[5] * m[7]) / det, (m[2] * m[7] - m[1] * m[8]) / det, (m[1] * m[5] - m[2] * m[4]) / det, (m[5] * m[6] - m[3] * m[8]) / det, (m[0] * m[8] - m[2] * m[6]) / det, (m[2] * m[3] - m[0] * m[5]) / det, (m[3] * m[7] - m[4] * m[6]) / det, (m[1] * m[6] - m[0] * m[7]) / det, (m[0] * m[4] - m[1] * m[3]) / det];
        Self::celu_aplicar(&inv, x, y)
    }
    /// lo que se toca en la pantalla (en sus coordenadas, pw × ph)
    fn celu_cosas(&self) -> Vec<(String, [f32; 4])> {
        let c = &self.pjs.celu; let mut v = vec![]; let (pw, ph) = self.celu_dim();
        let top = 22.0; // (la barra de arriba)
        v.push(("home".into(), [pw * 0.33, ph - 19.0, pw * 0.34, 16.0]));
        match c.app {
            None => { let (cw, x0, y0) = ((pw - 16.0 - 12.0) / 3.0, 8.0, top + 4.0 + 12.0); for (k, a) in APPS.iter().enumerate() { let (f, cc) = (k / 3, k % 3); v.push((format!("app|{}", a.0), [x0 + cc as f32 * (cw + 6.0), y0 + f as f32 * (cw * 0.85 + 30.0), cw, cw * 0.85 + 18.0])); } }
            Some(app) => {
                v.push(("home".into(), [8.0, top + 6.0, 26.0, 26.0]));
                let mut y = top + 6.0 + 32.0;
                if app == "props" {
                    v.push(("buscar".into(), [8.0, y, pw - 16.0, 28.0])); y += 34.0;
                    let mut x = 8.0 - c.scroll_chips(); for (k, (n, _)) in self.celu_cats().iter().enumerate() { let w = n.chars().count() as f32 * 6.3 + 18.0; v.push((format!("cat|{k}"), [x, y, w, 22.0])); x += w + 4.0; } y += 28.0;
                    let cw = (pw - 16.0 - 12.0) / 3.0; let chh = cw * 0.75 + 26.0;
                    for (k, n) in self.celu_lista_obj().iter().enumerate() { let r = [8.0 + (k % 3) as f32 * (cw + 6.0), y + (k / 3) as f32 * (chh + 6.0) - c.scroll, cw, chh]; if r[1] + r[3] < y || r[1] > ph - 30.0 { continue; } v.push((format!("poner|{n}"), r)); }
                } else if app == "memes" {
                    v.push(("mtab|0".into(), [8.0, y, 60.0, 22.0])); v.push(("mtab|1".into(), [72.0, y, 80.0, 22.0])); y += 30.0;
                    { let y = if c.meme_tab == 1 { y + 44.0 } else { y }; let cw = (pw - 16.0 - 8.0) / 3.0; for (k, mm) in self.memes_lista(c.meme_tab).iter().enumerate() { let r = [8.0 + (k % 3) as f32 * (cw + 4.0), y + (k / 3) as f32 * (cw * 0.62 + 30.0) - c.scroll, cw, cw * 0.62 + 22.0]; if r[1] + r[3] < y || r[1] > ph - 30.0 { continue; } v.push((format!("meme|{}", mm.0), r)); } }
                } else if app == "gente" {
                    let dueno = self.en_red.red.soy_anfitrion() && self.en_red.red.sala.as_ref().map(|s| !s.of).unwrap_or(false);
                    y += 42.0; for r in self.en_red.red.remotos() { if dueno { v.push((format!("echar|{}", r.id), [pw - 8.0 - 58.0, y + 8.0, 52.0, 24.0])); } y += 46.0; }
                }
            }
        }
        v
    }
    /// un toque en la pantalla del celular (al apoyar el dedo): true si cayó en ella
    pub(crate) fn celu_dedo_abajo(&mut self, id: i32, x: f32, y: f32, w: f32, h: f32) -> bool {
        if self.pjs.panel.is_some() || self.pjs.emo.panel() || self.menu.is_some() || self.ajustes.is_some() { return false; }
        let Some(q) = self.celu_esquinas(w, h) else { return false };
        let (pw, ph) = self.celu_dim(); let hm = Self::celu_h(&q, (pw, ph)); let [px, py] = Self::celu_inversa(&hm, x, y);
        if px < 0.0 || px > pw || py < 0.0 || py > ph { return false; }
        self.pjs.celu.dedo = Some((id, px, py, false));
        true
    }
    /// arrastrar en la pantalla del celular baja la lista; si no se arrastró, al soltar es un toque
    pub(crate) fn celu_mueve(&mut self, id: i32, x: f32, y: f32, w: f32, h: f32) -> bool {
        let Some((d, px0, py0, mov)) = self.pjs.celu.dedo else { return false }; if d != id { return false; }
        let Some(q) = self.celu_esquinas(w, h) else { return false }; let hm = Self::celu_h(&q, self.celu_dim()); let [px, py] = Self::celu_inversa(&hm, x, y);
        if mov || (py - py0).abs() > 8.0 { self.pjs.celu.scroll = (self.pjs.celu.scroll - (py - py0)).max(0.0); self.pjs.celu.dedo = Some((id, px, py, true)); }
        let _ = px0; true
    }
    /// al soltar el dedo que se apoyó en el celular (sin arrastrar): lo que toca
    pub(crate) fn celu_suelta(&mut self, id: i32) {
        let Some((d, px, py, mov)) = self.pjs.celu.dedo else { return }; if d != id { return; } self.pjs.celu.dedo = None; if mov { return; }
        let Some(k) = self.celu_cosas().into_iter().rev().find(|(_, r)| dentro(px, py, *r)).map(|x| x.0) else { return };
        let (a, x) = k.split_once('|').unwrap_or((k.as_str(), ""));
        match a {
            "home" => { if self.pjs.celu.app.is_some() { self.pjs.celu.app = None; self.pjs.celu.scroll = 0.0; } else { self.celm_sacar(); } }
            "app" => self.celu_app(x),
            "cat" => { self.pjs.celu.cat = x.parse().unwrap_or(0); self.pjs.celu.scroll = 0.0; }
            "buscar" => { let q = self.pjs.celu.q.clone(); self.pedir_texto(Escribir::Pj, "Buscar", &q, 30, false); self.pjs.celu.escribe = Some(Escribe::BuscarCelu); }
            "poner" => { let n = x.to_string(); self.pendientes.push(n.clone()); self.pjs.celu.puso = Some((format!("Puesto: {}", self.jg.nombre_item(&n)), 2.0)); self.sonido.tocar("UI_blip", 0.3, 1.2, None); }
            "mtab" => { self.pjs.celu.meme_tab = x.parse().unwrap_or(0); self.pjs.celu.scroll = 0.0; if self.pjs.celu.meme_tab == 1 { self.memes_cargar(); } }
            "meme" => { self.meme_tocar(x); }
            "echar" => self.celu_echar(x),
            _ => {}
        }
        if a != "poner" { self.sonido.tocar("Click", 0.4, 1.0, None); }
    }
    /// celApp: las que abren un menú del juego vuelven al inicio
    fn celu_app(&mut self, a: &str) {
        self.pjs.celu.q.clear(); self.pjs.celu.scroll = 0.0;
        match a {
            "camara" => { self.pjs.celu.app = None; self.avisar("La cámara todavía no está en la nativa".into()); }
            "ajustes" => { self.pjs.celu.app = None; self.menu = None; self.ajustes = Some(0); }
            "mods" => { self.pjs.celu.app = None; self.jg.panel_mod = true; self.jg.scroll = 0.0; }
            "emotes" => { self.pjs.celu.app = None; self.emo_boton(); }
            _ => { self.pjs.celu.app = APPS.iter().find(|x| x.0 == a).map(|x| x.0); }
        }
    }
    /// celEchar: el dueño de la sala echa a alguien (le llega el aviso, sale y no puede volver por 30 minutos)
    fn celu_echar(&mut self, id: &str) {
        if !self.en_red.red.soy_anfitrion() || !self.en_red.en_sala() { return; }
        let nom = self.en_red.red.remotos().iter().find(|r| r.id == id).map(|r| r.nombre.clone()).unwrap_or("?".into());
        self.pjs.celu.echados.push(id.to_string());
        self.en_red.red.publicar("a", &json!({ "k": "echar", "to": id }).to_string(), false);
        self.en_red.al_chat(format!("JXMod: {nom} fue echado del server"));
    }
    /// celEchadoRed: me echó el dueño de la sala
    pub(crate) fn celu_echado(&mut self, de: &str, d: &Value) {
        let Some(s) = self.en_red.red.sala.clone() else { return };
        if d["to"].as_str() != Some(self.en_red.red.id.as_str()) || s.of || s.du.is_empty() || s.du != de { return; }
        if let Some(dd) = &self.datos { let _ = std::fs::write(dd.join(format!("echado_{}.txt", s.id)), format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|x| x.as_secs()).unwrap_or(0))); }
        self.en_red.red.dejar(); self.avisar("El dueño del server te echó".into());
    }
    /// lo escrito para acá (los buscadores y el color del gorro)
    pub(crate) fn pj_escrito(&mut self, t: &str) {
        match self.pjs.celu.escribe.take() {
            Some(Escribe::BuscarPj) => { if let Some(p) = self.pjs.panel.as_mut() { p.q[p.tab as usize] = t.to_string(); p.scroll = 0.0; } }
            Some(Escribe::HexGorro) => { let h = t.trim_start_matches('#').to_lowercase(); if h.len() == 6 && h.chars().all(|c| c.is_ascii_hexdigit()) { let mut g = self.pjs.prefs.gorro_aj.clone().unwrap_or_default(); g.c = format!("#{h}"); self.pjs.prefs.gorro_aj = gorros::Ajuste::limpio(&g.json()); self.pjs_guardar(); } }
            Some(Escribe::BuscarCelu) => { self.pjs.celu.q = t.to_lowercase(); self.pjs.celu.scroll = 0.0; }
            Some(Escribe::BuscarEmo) => { if let Some(p) = self.pjs.emo.panel.as_mut() { p.q = t.to_string(); p.scroll = 0.0; } }
            None => {}
        }
    }
    pub(crate) fn celu_toque(&mut self, _x: f32, _y: f32, _w: f32, _h: f32) {}

    /// la pantalla del celular dibujada: en sus coordenadas y llevada a donde va (en la mano, en perspectiva)
    pub(crate) fn celu_hud(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32, _t: f32, otras: &mut Vec<(i64, Vec<f32>)>) {
        let Some(q) = self.celu_esquinas(wf, hf) else { return };
        if self.pjs.panel.is_some() || self.pjs.emo.panel.is_some() { return; }
        let tercera = !(self.camara == 0 && self.pjs.celu.pose.is_some());
        // (en tercera persona: el marco)
        if tercera { let css = hf / 393.0; let (ch, cw) = ((hf * 0.6).min(440.0 * css), (hf * 0.292).min(214.0 * css)); let x1 = wf - (12.0 * css).max(wf * 0.03); let y1 = hf - 6.0 * css;
            l.caja(u, x1 - cw, y1 - ch, cw, ch, (cw * 0.09).min(26.0 * css), [13.0 / 255.0, 15.0 / 255.0, 19.0 / 255.0, 1.0]); }
        let hm = Self::celu_h(&q, self.celu_dim());
        let (mut v, mut vi, mut vo, mut vr) = (vec![], vec![], vec![], vec![]);
        self.celu_ui(l, &mut v, &mut vi, &mut vo, &mut vr);
        let llevar = |v: &mut Vec<f32>| { for k in (0..v.len()).step_by(8) { let p = Self::celu_aplicar(&hm, v[k], v[k + 1]); v[k] = p[0]; v[k + 1] = p[1]; } };
        llevar(&mut v); llevar(&mut vi); llevar(&mut vo); llevar(&mut vr);
        u.extend(v); otras.push((TEX_ICO, vi)); otras.push((TEX_CELU_OBJ, vo)); otras.push((TEX_RETRATOS, vr));
    }
    /// celDibujar: la pantalla en sus coordenadas (pw × ph): el fondo, la barra con la hora y la red, el contenido y el botón
    fn celu_ui(&self, l: &Letras, u: &mut Vec<f32>, vi: &mut Vec<f32>, vo: &mut Vec<f32>, vr: &mut Vec<f32>) {
        let c = &self.pjs.celu; let bl = [1.0f32; 4]; let (pw, ph) = self.celu_dim();
        // (el fondo: radial-gradient(120% 80% at 20% 0%, #3b5bdb 0%, #5b2c8d 45%, #151827 100%), con las esquinas redondeadas)
        let (c0, c1, c2) = (hexc("#3b5bdb"), hexc("#5b2c8d"), hexc("#151827"));
        let col = |x: f32, y: f32| { let d = (((x / pw - 0.2) / 1.2).powi(2) + ((y / ph) / 0.8).powi(2)).sqrt(); let (a, b, t) = if d < 0.45 { (c0, c1, d / 0.45) } else { (c1, c2, ((d - 0.45) / 0.55).min(1.0)) }; [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1.0] };
        let rad = pw * 0.07; l.caja(u, 0.0, 0.0, pw, ph, rad, col(pw / 2.0, ph * 0.6));
        let (nx, ny) = (10, 24);
        for j in 0..ny { for i in 0..nx {
            let (x0, y0, x1, y1) = (i as f32 * pw / nx as f32, j as f32 * ph / ny as f32, (i + 1) as f32 * pw / nx as f32, (j + 1) as f32 * ph / ny as f32);
            let esquina = |x: f32, y: f32| (x < rad || x > pw - rad) && (y < rad || y > ph - rad); if esquina(x0, y0) || esquina(x1, y0) || esquina(x0, y1) || esquina(x1, y1) { continue; }
            let n = u.len(); l.rect(u, x0, y0, x1 - x0 + 0.3, y1 - y0 + 0.3, [1.0; 4]);
            for (k, (xx, yy)) in [(x0, y0), (x1, y0), (x1, y1), (x0, y0), (x1, y1), (x0, y1)].iter().enumerate() { let cc = col(*xx, *yy); u[n + k * 8 + 4..n + k * 8 + 8].copy_from_slice(&cc); }
        } }
        // la barra: la hora (celHora: la del ciclo de día), la señal y la batería
        let h = self.mj.dia.hora.max(0.0); l.texto_sombra(u, 10.0, 5.0, 11.0, bl, &format!("{:02}:{:02}", h.floor() as i32, ((h % 1.0) * 60.0).floor() as i32));
        let on = self.en_red.en_sala(); let xr = pw - 10.0 - 16.0 - 5.0 - 3.0 * 3.0 - 3.0;
        for (k, hh) in [5.0f32, 7.0, 9.0].iter().enumerate() { let o = k == 2 || on; l.rect(u, xr + k as f32 * 4.5, 15.0 - hh, 3.0, *hh, if o { bl } else { [1.0, 1.0, 1.0, 0.35] }); }
        let xb = pw - 10.0 - 16.0; for (a, b) in [([xb, 7.0], [xb + 16.0, 7.0]), ([xb + 16.0, 7.0], [xb + 16.0, 15.0]), ([xb + 16.0, 15.0], [xb, 15.0]), ([xb, 15.0], [xb, 7.0])] { linea(l, u, a, b, 1.5, bl); } l.rect(u, xb + 1.5, 8.5, 13.0, 5.0, [0.435, 0.89, 0.435, 1.0]);
        // el contenido
        let top = 22.0;
        let alto_ico = self.atlas_alto(ICONOS.len());
        match c.app {
            None => {
                let cw = (pw - 16.0 - 12.0) / 3.0;
                for (k, (a, n, colh)) in APPS.iter().enumerate() {
                    let (f, cc) = (k / 3, k % 3); let x = 8.0 + cc as f32 * (cw + 6.0); let y = top + 16.0 + f as f32 * (cw * 0.85 + 30.0);
                    let lado = 58.0f32.min(cw); let ix = x + (cw - lado) / 2.0; let co = hexc(colh); let cl = [co[0] * 0.75 + 0.25, co[1] * 0.75 + 0.25, co[2] * 0.75 + 0.25];
                    l.caja(u, ix + 1.0, y + 3.0, lado, lado, lado * 0.24, [0.0, 0.0, 0.0, 0.3]);
                    for s in 0..6 { let t = s as f32 / 5.0; let cc2 = [cl[0] + (co[0] - cl[0]) * t, cl[1] + (co[1] - cl[1]) * t, cl[2] + (co[2] - cl[2]) * t, 1.0]; let yy = y + lado * s as f32 / 6.0; if s == 0 || s == 5 { l.caja(u, ix, if s == 0 { y } else { y + lado * 0.5 }, lado, lado * 0.5, lado * 0.24, cc2); } else { l.rect(u, ix, yy, lado, lado / 6.0 + 0.3, cc2); } }
                    rect_uv(vi, ix + lado * 0.21, y + lado * 0.21, lado * 0.58, lado * 0.58, uv_celda(ico_idx(a), ICO, (ICO_COLS * ICO) as f32, alto_ico), [1.0; 4]);
                    texto_cabe(l, u, x, y + lado + 4.0, 10.0, cw, bl, n, true);
                }
            }
            Some(app) => {
                // (el título con la flecha de volver)
                l.disco(u, 8.0 + 13.0, top + 6.0 + 13.0, 13.0, [1.0, 1.0, 1.0, 0.15]); let (fx, fy) = (8.0 + 13.0, top + 6.0 + 13.0); linea(l, u, [fx + 2.5, fy - 5.5], [fx - 3.0, fy], 2.2, bl); linea(l, u, [fx - 3.0, fy], [fx + 2.5, fy + 5.5], 2.2, bl);
                let tit = match app { "props" => "Objetos", "memes" => "Memes", "gente" => "Jugadores", _ => "" }; l.texto(u, 40.0, top + 6.0 + 5.0, 14.0, bl, tit);
                let mut y = top + 6.0 + 32.0;
                if app == "props" {
                    l.caja(u, 8.0, y, pw - 16.0, 28.0, 10.0, [1.0, 1.0, 1.0, 0.18]); l.texto(u, 18.0, y + 8.0, 12.0, if c.q.is_empty() { [1.0, 1.0, 1.0, 0.7] } else { bl }, if c.q.is_empty() { "Buscar" } else { &c.q }); y += 34.0;
                    for (k, r) in self.celu_cosas().iter().filter(|x| x.0.starts_with("cat|")).map(|x| x.1).enumerate() { let s = k == c.cat; if r[0] > pw { break; } l.caja(u, r[0], r[1], r[2], r[3], 11.0, if s { bl } else { [1.0, 1.0, 1.0, 0.14] }); let n = self.celu_cats().get(k).map(|x| x.0.clone()).unwrap_or_default(); texto_cabe(l, u, r[0], r[1] + 5.0, 11.0, r[2], if s { [0.114, 0.137, 0.251, 1.0] } else { bl }, &n, true); }
                    y += 28.0;
                    let lista = self.celu_lista_obj(); let at = c.obj_atlas.as_ref(); let ah = self.atlas_alto(at.map(|v| v.len()).unwrap_or(1)).min(4096.0);
                    for (k, r) in self.celu_cosas().iter().filter(|x| x.0.starts_with("poner|")).map(|x| (x.0[6..].to_string(), x.1)) {
                        l.caja(u, r[0], r[1], r[2], r[3], 10.0, [1.0, 1.0, 1.0, 0.1]);
                        if let Some(i) = at.and_then(|v| v.iter().position(|x| *x == k)) { rect_uv(vo, r[0] + 3.0, r[1] + 5.0, r[2] - 6.0, (r[2] - 6.0) * 0.75, uv_celda(i as u32, ICO, (ICO_COLS * ICO) as f32, ah), [1.0; 4]); }
                        let nom: String = npc::skin_de_item(&k).map(|s| identidad::skin_nom(s)).unwrap_or_else(|| self.jg.nombre_item(&k).to_string()); texto_cabe(l, u, r[0] + 2.0, r[1] + r[3] - 15.0, 10.0, r[2] - 4.0, bl, &nom, true);
                    }
                    let _ = (lista, y);
                    if let Some((t, _)) = &c.puso { l.caja(u, 8.0, ph - 22.0 - 26.0, pw - 16.0, 26.0, 10.0, [20.0 / 255.0, 24.0 / 255.0, 36.0 / 255.0, 0.9]); texto_cabe(l, u, 8.0, ph - 22.0 - 26.0 + 7.0, 11.0, pw - 16.0, bl, t, true); }
                } else if app == "memes" {
                    for (k, n) in ["Memes", "Mis memes"].iter().enumerate() { let r = if k == 0 { [8.0, y, 60.0, 22.0] } else { [72.0, y, 80.0, 22.0] }; let s = c.meme_tab == k as u8; l.caja(u, r[0], r[1], r[2], r[3], 11.0, if s { bl } else { [1.0, 1.0, 1.0, 0.14] }); texto_cabe(l, u, r[0], r[1] + 5.0, 11.0, r[2], if s { [0.114, 0.137, 0.251, 1.0] } else { bl }, n, true); }
                    if c.meme_tab == 1 { for (i, rr) in jugabilidad::partir(l, 11.0, "Poné audios cortos (hasta 400 KB) en la carpeta memes de la app y suenan para todos", pw - 24.0).iter().enumerate() { l.texto(u, 12.0, y + 30.0 + i as f32 * 14.0, 11.0, [1.0, 1.0, 1.0, 0.75], rr); } }
                    let lista = self.memes_lista(c.meme_tab);
                    for (k, r) in self.celu_cosas().iter().filter(|x| x.0.starts_with("meme|")).map(|x| (x.0[5..].to_string(), x.1)) {
                        let (n, co) = lista.iter().find(|m| m.0 == k).map(|m| (m.1.clone(), hexc(&m.2))).unwrap_or_default();
                        let (cx, cy, rr) = (r[0] + r[2] / 2.0, r[1] + 23.0, 23.0f32.min(r[2] / 2.0));
                        l.disco(u, cx, cy + 4.0, rr, [0.0, 0.0, 0.0, 0.4]); l.disco(u, cx, cy, rr, [co[0], co[1], co[2], 1.0]); l.disco(u, cx - rr * 0.3, cy - rr * 0.4, rr * 0.42, [1.0, 1.0, 1.0, 0.35]);
                        texto_cabe(l, u, r[0], cy + rr + 4.0, 10.0, r[2], bl, &n, true);
                    }
                } else if app == "gente" {
                    let dueno = self.en_red.red.soy_anfitrion() && self.en_red.red.sala.as_ref().map(|s| !s.of).unwrap_or(false);
                    let ret = self.pjs.retratos.as_ref(); let ah = self.atlas_alto(ret.map(|v| v.len()).unwrap_or(1));
                    let fila = |u: &mut Vec<f32>, vr: &mut Vec<f32>, y: f32, skin: &str, nom: &str, sub: &str| {
                        l.caja(u, 8.0, y, pw - 16.0, 40.0, 10.0, [1.0, 1.0, 1.0, 0.1]); l.disco(u, 8.0 + 7.0 + 15.0, y + 20.0, 15.0, [0.2, 0.2, 0.2, 1.0]);
                        if let Some(i) = ret.and_then(|v| v.iter().position(|x| x == skin)) { rect_uv(vr, 8.0 + 7.0, y + 5.0, 30.0, 30.0, uv_celda(i as u32, ICO, (ICO_COLS * ICO) as f32, ah), [1.0; 4]); }
                        texto_cabe(l, u, 8.0 + 45.0, y + 8.0, 12.0, pw - 16.0 - 45.0 - 70.0, bl, nom, false); if !sub.is_empty() { l.texto(u, 8.0 + 45.0, y + 23.0, 10.0, [1.0, 1.0, 1.0, 0.7], sub); }
                    };
                    fila(u, vr, y, &self.skin, &self.en_red.red.nombre, "Vos"); y += 46.0;
                    let rem: Vec<(String, String, String)> = self.en_red.red.remotos().iter().map(|r| (r.id.clone(), r.skin.clone(), jxjuego::censura::censurar(&r.nombre))).collect();
                    for (_, skin, nom) in &rem { fila(u, vr, y, skin, if nom.is_empty() { "?" } else { nom }, ""); if dueno { let r = [pw - 8.0 - 58.0, y + 8.0, 52.0, 24.0]; l.caja(u, r[0], r[1], r[2], r[3], 8.0, [0.75, 0.22, 0.17, 1.0]); texto_cabe(l, u, r[0], r[1] + 6.0, 11.0, r[2], bl, "Echar", true); } y += 46.0; }
                    if rem.is_empty() { let t = if self.en_red.en_sala() { "No hay nadie más en la sala" } else { "Estás jugando solo" }; texto_cabe(l, u, 8.0, y + 10.0, 11.0, pw - 16.0, [1.0, 1.0, 1.0, 0.75], t, true); }
                }
            }
        }
        // (el botón de inicio, abajo)
        l.caja(u, pw * 0.33, ph - 8.0 - 5.0, pw * 0.34, 5.0, 3.0, [1.0, 1.0, 1.0, 0.85]);
    }
}
impl Celu { fn scroll_chips(&self) -> f32 { 0.0 } }

/// del espacio del personaje (con su base) al mundo
pub fn pose_mundo(b: &M4, p: &Pose) -> Pose {
    let d = |v: [f32; 3]| [b[0] * v[0] + b[4] * v[1] + b[8] * v[2], b[1] * v[0] + b[5] * v[1] + b[9] * v[2], b[2] * v[0] + b[6] * v[1] + b[10] * v[2]];
    let c = jugabilidad::pt(b, p.c); Pose { c, r: d(p.r), u: d(p.u), n: d(p.n), t: p.t }
}
/// celmDibujarCelu: el cuerpo, el marco de metal (un filo apenas más grande), el vidrio negro del frente y la cámara de atrás
pub fn celu_cajas(p: &Pose, out: &mut Vec<ItemDin>) {
    let q = ik::q_base(p.r, p.u, p.n);
    jugabilidad::caja(p.c, [CELM_W, CELM_H, CELM_D], q, CELU_MAT, out);
    jugabilidad::caja(ik::punto(p, 0.0, 0.0, -0.0004), [CELM_W + 0.0012, CELM_H + 0.0012, CELM_D * 0.7], q, CELU_MAT - 1, out);
    jugabilidad::caja(ik::punto(p, 0.0, 0.0, CELM_D / 2.0 + 0.0002), [CELM_W - 0.0016, CELM_H - 0.0016, 0.0005], q, CELU_MAT - 2, out);
    jugabilidad::caja(ik::punto(p, -CELM_W * 0.28, CELM_H * 0.4, -CELM_D / 2.0 - 0.0012), [0.022, 0.022, 0.0024], q, CELU_MAT - 3, out);
}
/// celmDibujar3p: el cuerpo y la pantalla que brilla (en tercera persona y en la mano de los demás)
pub fn celu_3p_cajas(p: &Pose, out: &mut Vec<ItemDin>) {
    let q = ik::q_base(p.r, p.u, p.n); let t = p.t;
    jugabilidad::caja(p.c, [CELM_W * t, CELM_H * t, CELM_D * t], q, CELU_MAT, out);
    jugabilidad::caja(ik::add(p.c, ik::esc(p.n, CELM_D * t / 2.0 + 0.0004)), [(CELM_W - 0.003) * t, (CELM_H - 0.006) * t, 0.0006], q, CELU_MAT - 4, out);
}

// ---------------- (para las pruebas) cómo quedan la mano y el celular ----------------
impl Juego {
    /// en tercera persona (el jugador) y en primera (la vista): para cada articulación de los dedos que cae sobre el celular, su
    /// altura sobre la espalda (z en el marco del celular, negativo atrás) y lo que entra en el celular (debe ser 0); el error
    /// del contacto de cada dedo (la punta contra la espalda: lo que se aparta de su grosor), en mm
    pub fn celu_prueba(&self) -> String {
        let mut o = String::new();
        let medir = |o: &mut String, nom: &str, p: &Pose, huesos: &[(String, [f32; 3])]| {
            let t = if p.t > 0.0 { p.t } else { 1.0 }; let mut entra = 0.0f32; let mut err: Vec<String> = vec![];
            for (n, q) in huesos {
                let d = ik::sub(*q, p.c); let (x, y, z) = (ik::dot(d, p.r) / t, ik::dot(d, p.u) / t, ik::dot(d, p.n) / t);
                let r = if n.contains("Thumb") { 0.009 } else if n.ends_with("RightHand") { 0.014 } else { 0.008 };
                if x.abs() < CELM_W / 2.0 && y.abs() < CELM_H / 2.0 { entra = entra.max(z + r + CELM_D / 2.0); }
                for (dd, g) in [("Index", 0.0085), ("Middle", 0.0088), ("Ring", 0.0082), ("Pinky", 0.0072)] { if n.ends_with(&format!("{dd}4")) { err.push(format!("{dd} {:+.1}", (z + CELM_D / 2.0 + g) * 1000.0)); } }
            }
            o.push_str(&format!("{nom}: lo que entra en el celular {:.1} mm · puntas contra la espalda (mm de más afuera): {}\n", entra.max(0.0) * 1000.0, err.join(", ")));
        };
        if let (Some(p), Some(pj)) = (&self.pjs.celu.pose3p, &self.pj) {
            let (nombres, _, w) = pj.esqueleto(); let hs: Vec<(String, [f32; 3])> = nombres.iter().enumerate().filter(|(_, n)| n.contains("RightHand")).map(|(i, n)| (n.rsplit(':').next().unwrap_or(n).to_string(), [w[i][12], w[i][13], w[i][14]])).collect();
            medir(&mut o, &format!("tercera ({}{})", pj.skin, if self.pjs.celu.dedos.get(&pj.skin).is_some_and(|d| d.is_some()) { "" } else { ", sin guardar los dedos todavía" }), p, &hs);
            if std::env::var("JXM_PJ_DEBUG").is_ok() { let jp = self.jug.pos; let b = pj.base_sentado().unwrap_or_else(|| personaje::base([jp[0], jp[1] - 0.95, jp[2]], self.jug.yaw)); let pm = pose_mundo(&b, p);
                let mano = hs.iter().find(|x| x.0 == "RightHand").map(|x| jugabilidad::pt(&b, x.1)); o.push_str(&format!("  celu mundo {:?} t {} · mano mundo {:?} · cámara {:?}\n", pm.c, pm.t, mano, self.ojos_ult)); }
        }
        if let (Some(m), Some(p)) = (&self.pjs.celu.mano, &self.pjs.celu.pose) { medir(&mut o, "primera (Hands)", p, &m.huesos_mano()); o.push_str(&format!("  dedos doblados: {:?}\n", m.dedos())); }
        o
    }
}
