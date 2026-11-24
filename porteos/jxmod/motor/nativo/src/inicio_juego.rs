//! El inicio de JXMod (inicio.js y clasico.js de la web): las escenas del juego de fondo que pasan solas (cada 9 s, con el
//! fundido de 1,8 s y el agrandado lento de la 3.3), el menú clásico —el logo JXM con su cinta y su esquina rota, la línea
//! amarilla gastada, las 8 opciones en barras negras con la punta rota y grano, en tres grupos, la elegida en amarillo; abajo
//! la barra (los mods, el idioma, tu nombre, Discord y TikTok) y la versión; arriba a la derecha Avisos, Bugs y La grieta—
//! con sus animaciones (la entrada que rasga las barras una tras otra, el barrido de luz de la elegida, el golpe al tocar y el
//! glitch del logo cada 11 a 19 s) y las mismas medidas de clEncajar (en % del alto, la versión apretada del celular
//! apaisado y lo que se toca de 44 px). Los paneles que abre están en paneles_juego.rs; la pausa, en pausa_juego.rs.
//! Mientras el inicio está a la vista el juego no corre: se dibuja sólo esto (con el motor, sin mapa).
use super::*;
use crate::pincel::{self, rgba, con_a, Atlas, Cara, Col, Iconos, Pincel, TEX_FOTOS};
use std::cell::Cell;

/// los colores de la web (--jxA, --jxT, --clPl, --clPl2 y el texto sobre amarillo)
pub(super) const AMA: Col = rgba(0xf2b31b, 1.0);
pub(super) const TX: Col = rgba(0xefede7, 1.0);
pub(super) const PL: Col = rgba(0x0c0d0f, 0.86);
pub(super) const NEGRO: Col = rgba(0x121212, 1.0);

/// las opciones del menú, en el orden de la 3.3 (CL_K), su texto y su ícono (CL_ICO); los grupos (CL_G): 3, 4 y 1
pub const CL_K: [&str; 8] = ["nueva", "multi", "social", "tienda", "crear", "personajes", "opciones", "salir"];
pub const CL_TXT: [&str; 8] = ["Empezar partida nueva", "Buscar partida multijugador", "Social", "Mods y mapas", "Crear un mapa", "Personajes", "Opciones", "Salir"];
const CL_ICO: [&str; 8] = ["jugar", "mundo", "gente", "mods", "martillo", "persona", "ajustes", "salir"];
const CL_GRUPO: [usize; 8] = [0, 0, 0, 1, 1, 1, 1, 2];

/// lo que se toca en el inicio
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Pieza { Op(usize), Mods, Idioma, Nombre, Discord, TikTok, Avisos, Bugs, Grieta, Actualizar }

/// cuánto se mueve (clNivel): «quieto» sin animaciones, «bajo» sólo lo corto, «pleno» todo (Patata: quieto; Bajo: bajo)
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Nivel { Quieto, Bajo, Pleno }

/// una foto en el motor (su número de textura y su tamaño) y de dónde sale para volver a subirla
pub struct Foto { pub id: i64, pub w: u32, pub h: u32, subida: bool, px: Option<Vec<u8>> }

/// lo que hay que tener en el motor: el atlas de los menús, los íconos y las fotos
#[derive(Default)]
pub struct Recursos { pub atlas: Option<Atlas>, pub ico: Iconos, pub gl: pincel::Glifos, atlas_subido: bool, atlas_px: Option<Vec<u8>>, pub fotos: HashMap<String, Foto>, sig_foto: i64, pub error: Option<String> }

/// las medidas del clásico en esta pantalla (clEncajar): todo en píxeles
#[derive(Clone, Debug, Default)]
pub struct Cl {
    pub w: f32, pub h: f32, pub apretada: bool, pub p: f32, pub f: f32, pub s: f32, pub inn: f32, pub top: f32, pub xs: f32, pub xe: f32, pub lw: f32,
    pub ch_v: f32, pub ch_f: f32, pub logo: [f32; 4], pub acento: [f32; 4], pub bot: f32, pub abajo_t: f32, pub arriba_t: f32,
    /// cada opción: su caja (lo que se ve: la barra entera; la placa va `inn` más adentro) y lo que se toca de más arriba y abajo
    pub its: Vec<([f32; 4], f32, f32)>,
    /// las placas de abajo, de arriba y la versión: (qué es, su caja) — la de la versión con Pieza::Actualizar no se toca
    pub abajo: Vec<(Pieza, [f32; 4])>, pub arriba: Vec<(Pieza, [f32; 4])>, pub ver: [f32; 4],
    pub compacto: u8, pub evt_corto: bool,
}

/// el estado del inicio
pub struct Inicio {
    /// a la vista (el juego no corre) y el panel abierto encima del fondo (None: el menú)
    pub abierto: bool, pub panel: Option<super::paneles_juego::PanelIni>,
    /// el reloj del inicio (s) y cuándo apareció el menú (la entrada) o cambió la elegida (el barrido)
    pub reloj: f32, entrada: f32, pub sel: Option<usize>, sel_t: f32,
    /// el golpe al tocar (qué y cuándo) y el dedo que está tocando (su número, qué tocó y dónde empezó)
    golpe: Option<(Pieza, f32)>, dedo: Option<(i32, Option<Pieza>, f32, f32)>, pub apretado: Option<Pieza>,
    /// las escenas de fondo: cuáles hay, cuál va, cuándo cambió y cuánto lleva a la vista
    pub(super) fondos: Vec<String>, fondo: usize, fondo_t: f32, fundido: f32, ken_t: f32,
    /// el glitch del logo: cuándo empezó el último y cuándo el próximo
    glitch: f32, glitch_prox: f32, azar: u32,
    pub nivel: Nivel,
    pub rec: Recursos, perdidas: Cell<bool>, letras_ok: Cell<bool>,
    /// de dónde leer lo de la APK (en la compu, de carpetas): ui/menus.*, fondos/N.webp, carga/x.webp
    pub lector: Option<Box<dyn Fn(&str) -> Option<Vec<u8>>>>,
    /// la versión (la de nucleo.js) y el día del armado (dd/mm/aaaa)
    pub version: String, pub armado: String,
    /// las medidas del último cuadro (para tocar y las pruebas)
    pub cl: Cl,
    /// la muesca (izquierda, derecha, arriba, abajo)
    pub ins: [f32; 4],
    /// la tienda abierta desde un panel o desde la pausa (para volver)
    pub desde_juego: bool,
    /// lo de los paneles (paneles_juego.rs) y la pausa (pausa_juego.rs)
    pub pn: super::paneles_juego::EstPaneles, pub pz: super::pausa_juego::Pausa,
    /// «Salir»: la app se cierra (app.rs); el personaje cambió y hay que cargar su cuerpo
    pub salir: bool, pub cuerpo_nuevo: bool,
    /// (para las pruebas: el fondo quieto)
    quieto: bool,
    /// el personaje en 3D de Personajes (el lobby de menu.js): su cuerpo y su skin, lo que ya está en el motor y el cielo oscuro
    lobby: Option<(Personaje, String)>, lobby_cargados: personaje::Cargados, cielo_ok: bool,
}

impl Default for Inicio {
    fn default() -> Self {
        // (la versión de la web: JX_VERSION de nucleo.js; el día, el de la última nota de novedades.js o el del armado)
        let nucleo = include_str!("../../../juego/nucleo.js");
        let version = nucleo.split("const JX_VERSION = '").nth(1).and_then(|r| r.split('\'').next()).unwrap_or("?").to_string();
        let armado = option_env!("JXM_ARMADO").map(|s| s.to_string()).unwrap_or_else(|| super::paneles_juego::novedades().first().map(|n| { let p: Vec<&str> = n.f.split('-').collect(); if p.len() == 3 { format!("{}/{}/{}", p[2], p[1], p[0]) } else { n.f.clone() } }).unwrap_or_default());
        Inicio { abierto: false, panel: None, reloj: 0.0, entrada: -10.0, sel: None, sel_t: -10.0, golpe: None, dedo: None, apretado: None,
            fondos: vec![], fondo: 0, fondo_t: 0.0, fundido: -10.0, ken_t: 0.0, glitch: -10.0, glitch_prox: 14.0, azar: 0x51ed270b, nivel: Nivel::Pleno,
            rec: Recursos::default(), perdidas: Cell::new(false), letras_ok: Cell::new(false), lector: None, version, armado, cl: Cl::default(), ins: [0.0; 4], desde_juego: false,
            pn: Default::default(), pz: Default::default(), salir: false, cuerpo_nuevo: false, quieto: false,
            lobby: None, lobby_cargados: personaje::Cargados::default(), cielo_ok: false }
    }
}

/// cubic-bezier de CSS: la curva de la animación en el tiempo t (0..1)
pub fn bezier(x1: f32, y1: f32, x2: f32, y2: f32, t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0); if t <= 0.0 || t >= 1.0 { return t; }
    let c = |a: f32, b: f32, s: f32| 3.0 * a * (1.0 - s) * (1.0 - s) * s + 3.0 * b * (1.0 - s) * s * s + s * s * s;
    let (mut lo, mut hi) = (0.0f32, 1.0f32); for _ in 0..24 { let m = (lo + hi) / 2.0; if c(x1, x2, m) < t { lo = m; } else { hi = m; } }
    c(y1, y2, (lo + hi) / 2.0)
}
/// el progreso de una animación con demora (0 antes, 1 después)
pub fn prog(t: f32, demora: f32, dur: f32) -> f32 { ((t - demora) / dur).clamp(0.0, 1.0) }
/// redondeado a décimas, como los px() de clasico.js
fn px(v: f64) -> f64 { (v * 10.0).round() / 10.0 }

impl Inicio {
    fn azar(&mut self) -> f32 { self.azar ^= self.azar << 13; self.azar ^= self.azar >> 17; self.azar ^= self.azar << 5; (self.azar % 100000) as f32 / 100000.0 }
    /// el menú vuelve a aparecer (con su entrada)
    pub fn mostrar(&mut self) { self.abierto = true; self.panel = None; self.entrada = self.reloj; self.sel = None; self.glitch_prox = self.reloj + 11.0 + self.azar() * 8.0; }
    /// las texturas se fueron del motor (se vació al cargar un mapa o al cambiar de motor)
    pub fn perder_texturas(&self) { self.perdidas.set(true); self.letras_ok.set(false); }
    /// (para las pruebas) el fondo quieto en la primera escena, agrandado 1,02 (como FONDO() de pruebas/menu_clasico.mjs)
    pub fn fondo_quieto(&mut self) { self.quieto = true; self.fondo = 0; self.fondo_t = 0.0; self.ken_t = 0.0; self.fundido = -10.0; }
    /// (para las pruebas) el glitch del logo ahora
    pub fn glitch_forzar(&mut self) { self.glitch = self.reloj; }
    /// la elegida (clElegir): al pasar a otra, el barrido de luz
    pub fn elegir(&mut self, k: Option<usize>) { if self.sel == k { return; } self.sel = k; if k.is_some() { self.sel_t = self.reloj; } }
}

/// las medidas del clásico (clEncajar de clasico.js, con los mismos números): `sel` la elegida (va en 600 y la lista es tan
/// ancha como la más ancha), `nombre` el de la placa de tu nombre
pub fn medir_cl(at: &Atlas, w32: f32, h32: f32, ins32: [f32; 4], sel: Option<usize>, version: &str, armado: &str) -> Cl {
    let (w, h) = (w32 as f64, h32 as f64); let ins = ins32.map(|v| v as f64);
    let an = |c: Cara, t: f64, e: f64, s: &str| at.ancho(c, t as f32, e as f32, s) as f64;
    let vh = h / 100.0;
    let m_ = (5.0 * vh).max(12.0); let xs = m_.max(ins[0] + 10.0); let xe = m_.max(ins[1] + 10.0); let ch_f0 = (2.9 * vh).max(14.0);
    let f0 = 4.3 * vh; let p0n = f0 * 1.1 + 2.7 * vh; let s0 = 1.4 * vh; let corto = h <= 440.0;
    struct Md { logo_top: f64, logo_h: f64, ch_v: f64, bot: f64, abajo_t: f64, arriba_t: f64, aire: f64, s: f64, ini: f64, lugar: f64, p: f64 }
    let medidas = |apretado: bool| {
        let logo_top = (ins[2] + 4.0).max((if apretado { 1.8 } else if corto { 3.0 } else { 4.2 }) * vh);
        let logo_h = if apretado { (12.5 * vh).max(40.0) } else if corto { 15.0 * vh } else { (18.5 * vh).max(40.0).min(150.0) };
        let ch_v = if apretado { (8.0 * vh).min(44.0).max(32.0) } else { (7.4 * vh).round().max(44.0) };
        let bot = (ins[3] + 4.0).max((if apretado { 2.5 } else { 3.0 }) * vh);
        let ext = (44.0 - ch_v).max(0.0); let abajo_t = (bot - 2.0).max(0.0).min(ext); let arriba_t = ext - abajo_t;
        let aire = if apretado { 8.0 } else { (2.5 * vh).max(8.0) }; let s = if apretado { s0.min(8.0).max(4.0) } else { s0 };
        let ini = logo_top + logo_h + aire; let fin = h - bot - ch_v - aire.max(arriba_t) - 0.6; let lugar = fin - ini;
        Md { logo_top, logo_h, ch_v, bot, abajo_t, arriba_t, aire, s, ini, lugar, p: (lugar - 2.0 * s) / 8.0 }
    };
    let mut m = medidas(false); let mut apretada = false; let p;
    if 8.0 * p0n.max(44.0) + 2.0 * m.s <= m.lugar { p = p0n.max(44.0); }
    else if m.p >= 44.0 { p = m.p; }
    else { m = medidas(true); apretada = true; p = m.p.max(26.0); }
    let inn = if apretada { 0.75 } else { (0.3 * vh).min(4.0).max(1.0) };
    let f = (f0 * (p - 2.0 * inn) / (p0n - 0.6 * vh)).min(f0).max(14.0);
    // (lo que pone en CSS, redondeado a décimas)
    let (f, p, s, inn, ch_v, logo_h) = (px(f), px(p), px(m.s), px(inn), px(m.ch_v), px(m.logo_h));
    let ch_f = px(ch_f0.min(m.ch_v * 0.44));
    // la lista: tan ancha como la opción más ancha (3,2 letras de rellenos, borde, ícono y espacio, más 14 px)
    let ancho_op = |i: usize| { let c = if sel.unwrap_or(0) == i { Cara::O6 } else { Cara::O5 }; 3.2 * f + 14.0 + an(c, f, 0.02, &CL_TXT[i].to_uppercase()) };
    let lw = (0..8).map(ancho_op).fold(0.0f64, f64::max).min(w - xs - xe);
    let alto_lista = 8.0 * p + 2.0 * s;
    let mut top = px(m.ini); let sobra = m.lugar - alto_lista; if !apretada && sobra > m.aire * 2.0 { top = px(m.ini + (sobra / 2.0).min(4.0 * vh)); }
    let fin_l = top + alto_lista;
    let mut its = vec![]; let mut y = top;
    for i in 0..8 {
        if i > 0 && CL_GRUPO[i] != CL_GRUPO[i - 1] { y += s; }
        let ini_g = i == 0 || CL_GRUPO[i] != CL_GRUPO[i - 1]; let fin_g = i == 7 || CL_GRUPO[i] != CL_GRUPO[i + 1];
        let ht = if i == 0 { (m.aire - 1.0).max(0.0) } else if ini_g { s / 2.0 } else { 0.0 };
        let hb = if i == 7 { (s / 2.0 + 8.0).min((h - m.bot - m.ch_v - m.arriba_t) - fin_l - 0.5).max(0.0) } else if fin_g { s / 2.0 } else { 0.0 };
        its.push(([xs, y, lw, p], px(ht), px(hb))); y += p;
    }
    let asp = 1155.0 / 360.0; let sombra = logo_h * 0.09;
    let logo = [xs - sombra, px(m.logo_top), logo_h * asp, logo_h];
    let acento = [xs, px(m.logo_top + logo_h * 0.93), (logo_h * asp * 0.62).min(lw), (logo_h * 0.035).max(2.0)];
    // abajo: las placas (los mods, el idioma, tu nombre, las redes) y la versión, en la misma línea
    let ya = h - px(m.bot) - ch_v; let gap = ch_v * 0.1;
    let ver_w = { let t = |c: Cara, s: &str| an(c, ch_f, 0.05, &s.to_uppercase()); let n = if armado.is_empty() { 2.0 } else { 3.0 };
        2.0 * 0.9 * ch_f + t(Cara::O5, "JXMod") + t(Cara::O6, version) + if armado.is_empty() { 0.0 } else { t(Cara::O5, armado) } + (n - 1.0) * 0.6 * ch_f };
    let ver = [w - xe - ver_w, ya, ver_w, ch_v];
    let chip_w = |c: u8, pz: Pieza| -> f64 {
        let (pad, g) = if c >= 1 { (0.55 * ch_f, 0.4 * ch_f) } else { (0.85 * ch_f, 0.5 * ch_f) };
        let txt = |s: &str| an(Cara::O5, ch_f, 0.03, &s.to_uppercase());
        match pz {
            Pieza::Mods => 2.0 * pad + 5.0 + 1.22 * ch_f + g + if c >= 1 { txt("S") } else { txt("Sandbox") },
            Pieza::Idioma => if c >= 2 { ch_v.max(44.0) } else { 2.0 * pad + 5.0 + 1.22 * ch_f + g + txt("ES") },
            Pieza::Nombre => 2.0 * pad + 5.0 + 1.22 * ch_f + g + ch_f * match c { 0 => 6.4, 1 => 4.6, _ => 4.2 },
            _ => ch_v.max(44.0),
        }
    };
    let piezas = [Pieza::Mods, Pieza::Idioma, Pieza::Nombre, Pieza::Discord, Pieza::TikTok];
    let mut compacto = 0u8;
    loop {
        let g = if compacto >= 1 { 3.0 } else { gap };
        let total: f64 = piezas.iter().map(|p| chip_w(compacto, *p)).sum::<f64>() + g * (piezas.len() - 1) as f64;
        if total <= w - xe - xs - ver_w - 10.0 || compacto >= 2 { break; }
        compacto += 1;
    }
    let mut abajo = vec![]; let mut x = xs; let g = if compacto >= 1 { 3.0 } else { gap };
    for pz in piezas { let cw = chip_w(compacto, pz); abajo.push((pz, [x, ya, cw, ch_v])); x += cw + g; }
    // arriba a la derecha: Avisos, Bugs y La grieta (si choca con el logo, La grieta sin «Activo»: un punto)
    let arr_top = px((ins[2] + 4.0).max(m.logo_top + (logo_h - ch_v) * 0.5));
    let chip_t = |s: &str, c: Cara| an(c, ch_f, 0.03, &s.to_uppercase());
    let arr_w = |corto: bool| -> Vec<(Pieza, f64)> {
        let (pad, g) = if compacto >= 1 { (0.55 * ch_f, 0.4 * ch_f) } else { (0.85 * ch_f, 0.5 * ch_f) };
        let base = 2.0 * pad + 5.0 + 1.22 * ch_f + g;
        vec![(Pieza::Avisos, base + chip_t("Avisos", Cara::O5)), (Pieza::Bugs, base + chip_t("Bugs", Cara::O5)),
             (Pieza::Grieta, base + chip_t("La grieta", Cara::O5) + if corto { g + 8.0 } else { g + chip_t("Activo", Cara::O6) })]
    };
    let ancho_arr = |v: &Vec<(Pieza, f64)>| v.iter().map(|x| x.1).sum::<f64>() + gap * (v.len() - 1) as f64;
    let mut evt_corto = false; let mut va = arr_w(false);
    if w - xe - ancho_arr(&va) < xs + logo_h * asp - 2.0 * sombra + 8.0 { evt_corto = true; va = arr_w(true); }
    let mut arriba = vec![]; let mut x = w - xe - ancho_arr(&va);
    for (pz, cw) in va { arriba.push((pz, [x, arr_top, cw, ch_v])); x += cw + gap; }
    let q = |v: [f64; 4]| v.map(|x| x as f32);
    Cl { w: w32, h: h32, apretada, p: p as f32, f: f as f32, s: s as f32, inn: inn as f32, top: top as f32, xs: xs as f32, xe: xe as f32, lw: lw as f32, ch_v: ch_v as f32, ch_f: ch_f as f32, logo: q(logo), acento: q(acento),
        bot: px(m.bot) as f32, abajo_t: px(m.abajo_t) as f32, arriba_t: px(m.arriba_t) as f32, its: its.into_iter().map(|(b, t, d)| (q(b), t as f32, d as f32)).collect(),
        abajo: abajo.into_iter().map(|(p, b)| (p, q(b))).collect(), arriba: arriba.into_iter().map(|(p, b)| (p, q(b))).collect(), ver: q(ver), compacto, evt_corto }
}

impl Juego {
    /// abrir el inicio (al arrancar la app y al salir de una partida)
    pub fn inicio_abrir(&mut self) { self.ini.mostrar(); self.menu = None; self.ajustes = None; self.emotes_panel = false; self.npc_panel = None; self.en_red.panel = false; self.gmod.panel = false; self.dedos.clear(); }
    /// de dónde leer lo de la APK (o de carpetas, en la compu)
    pub fn inicio_lector(&mut self, f: Box<dyn Fn(&str) -> Option<Vec<u8>>>) { self.ini.lector = Some(f); }
    /// el motor se vació: las texturas del inicio se vuelven a subir cuando hagan falta
    pub(super) fn ini_texturas_perdidas(&self) { self.ini.perder_texturas(); }
    fn ini_leer(&self, n: &str) -> Option<Vec<u8>> { self.ini.lector.as_ref().and_then(|f| f(n)) }

    /// lo que hay que tener en el motor antes de dibujar: el atlas (se arma la primera vez), los íconos nuevos y las fotos
    pub(super) fn ini_recursos(&mut self, m: &mut Motor3d) {
        let perdidas = self.ini.perdidas.replace(false);
        if perdidas { self.ini.rec.atlas_subido = false; for f in self.ini.rec.fotos.values_mut() { f.subida = false; } self.ini.lobby = None; self.ini.lobby_cargados.olvidar(); self.ini.cielo_ok = false; }
        if self.ini.rec.atlas.is_none() && self.ini.rec.error.is_none() {
            match (self.ini_leer("ui/menus.json").and_then(|b| String::from_utf8(b).ok()), self.ini_leer("ui/menus.png")) {
                (Some(j), Some(p)) => match Atlas::armar(&j, p) { Ok((a, px)) => { self.ini.rec.atlas = Some(a); self.ini.rec.atlas_px = Some(px); } Err(e) => self.ini.rec.error = Some(e) },
                _ => self.ini.rec.error = Some("faltan ui/menus.json y ui/menus.png (herramientas/atlas_menus.py)".into()),
            }
        }
        if let Some(a) = &self.ini.rec.atlas { if !self.ini.rec.atlas_subido {
            // (los píxeles se guardan sólo hasta subirlos; si el motor se vacía, se vuelve a armar desde el PNG)
            let px = match self.ini.rec.atlas_px.take() { Some(p) => Some(p), None => match (self.ini_leer("ui/menus.json").and_then(|b| String::from_utf8(b).ok()), self.ini_leer("ui/menus.png")) { (Some(j), Some(p)) => Atlas::armar(&j, p).ok().map(|x| x.1), _ => None } };
            if let Some(px) = px { self.ini.rec.atlas_subido = pincel::subir_tex(m, pincel::TEX_MENUS, a.w, a.h, px); }
        } }
        self.ini.rec.ico.subir(m, perdidas); self.ini.rec.gl.subir(m, perdidas);
        // (las fotos que esperan: se suben y se olvidan los píxeles; las que se perdieron, se vuelven a leer)
        let faltan: Vec<String> = self.ini.rec.fotos.iter().filter(|(_, f)| !f.subida).map(|(k, _)| k.clone()).collect();
        for k in faltan {
            let px = match self.ini.rec.fotos.get_mut(&k).and_then(|f| f.px.take()) { Some(p) => Some(p), None => self.ini_foto_px(&k).map(|x| x.2) };
            if let (Some(px), Some(f)) = (px, self.ini.rec.fotos.get_mut(&k)) { f.subida = pincel::subir_tex(m, f.id, f.w, f.h, px); }
        }
    }
    /// los píxeles de una foto: «a:archivo» de la APK, «i:nombre» un ícono del paquete del juego (DATA.ico)
    fn ini_foto_px(&self, k: &str) -> Option<(u32, u32, Vec<u8>)> {
        let b = if let Some(n) = k.strip_prefix("a:") { self.ini_leer(n)? }
            else if let Some(n) = k.strip_prefix("i:") { let p = self.paq.as_ref()?; let id = p.d["ico"][n].as_str()?; p.parte(&format!("i:{id}"))?.to_vec() }
            else if k == "logo" { include_bytes!("../../../juego/logo_jxm.webp").to_vec() }
            else { return None };
        let (w, h, px) = pincel::decodificar(&b)?;
        // (las fotos de fondo hasta 1280; los íconos como vienen)
        Some(pincel::achicar(w, h, px, 1280))
    }
    /// una foto lista para dibujar (o None mientras no está: se pide y llega en el cuadro siguiente)
    pub(super) fn ini_foto(&self, k: &str) -> Option<(i64, f32, f32)> { self.ini.rec.fotos.get(k).filter(|f| f.subida).map(|f| (f.id, f.w as f32, f.h as f32)) }
    /// pedir una foto (se lee ahora y se sube en el próximo cuadro)
    pub(super) fn ini_pedir_foto(&mut self, k: &str) -> bool {
        if self.ini.rec.fotos.contains_key(k) { return true; }
        let Some((w, h, px)) = self.ini_foto_px(k) else { return false };
        self.ini.rec.sig_foto += 1; let id = TEX_FOTOS - self.ini.rec.sig_foto;
        self.ini.rec.fotos.insert(k.to_string(), Foto { id, w, h, subida: false, px: Some(px) });
        true
    }

    /// las escenas de fondo: las de la APK (fondos/1.webp, 2…: las de PAQUETE/fondos, como FONDOS_RB) o, sin ellas, los
    /// íconos de los mapas (como la web sin FONDOS_RB)
    fn ini_fondos(&mut self) {
        if !self.ini.fondos.is_empty() { return; }
        let mut v = vec![]; for k in 1..=24 { let n = format!("fondos/{k}.webp"); if self.ini_leer(&n).is_some() { v.push(format!("a:{n}")); } else { break; } }
        if v.is_empty() { v = self.mapas_inicio().iter().map(|m| format!("i:mapa_{m}")).collect(); }
        self.ini.fondos = v;
    }
    /// los mapas de «Empezar partida nueva» (los de la versión personal, MAPAS_RB con JXP: gm_construct y gm_flatgrass; si el
    /// paquete no los tiene, todos)
    pub(super) fn mapas_inicio(&self) -> Vec<String> {
        let v: Vec<String> = ["RB_Construct", "RB_Flatgrass"].iter().filter(|m| self.mapas.iter().any(|x| x == *m)).map(|s| s.to_string()).collect();
        if v.is_empty() { self.mapas.clone() } else { v }
    }

    /// un cuadro con el inicio a la vista: sin el juego, sólo el fondo, el menú o un panel (y lo que esté abierto encima)
    pub(super) unsafe fn ini_cuadro(&mut self, m: &mut Motor3d, w: i32, h: i32) -> Result<(), String> {
        let ahora = Instant::now(); let dt = self.dt_fijo.unwrap_or((ahora - self.t_ant).as_secs_f32().min(0.1)); self.t_ant = ahora;
        let (wf, hf) = (w as f32, h as f32);
        self.ini.reloj += dt;
        self.ini.nivel = if self.aj.calidad == 0 { Nivel::Quieto } else if self.aj.calidad == 1 { Nivel::Bajo } else { Nivel::Pleno };
        m.opciones(&self.aj.opciones()); self.sonido.volumen = self.aj.volumen();
        self.escrito_paso();
        self.ini_red(dt);
        self.ini_fondos();
        self.ini_paso(dt);
        // (las letras del HUD, por si algo las usa —el cartel de error sin el atlas de los menús—)
        if !self.ini.letras_ok.get() { self.cargar_letras(m); self.ini.letras_ok.set(true); }
        self.ini_recursos(m);
        let u = self.ini_tandas(wf, hf);
        self.ini_recursos_ico(m);
        let tres = self.ini_lobby(m, wf, hf, dt);
        let r = m.dibujar(w, h, tres, &u);
        if self.ini.rec.error.is_some() && self.error.is_none() { self.error = self.ini.rec.error.clone(); }
        r
    }
    /// el personaje elegido en 3D detrás del panel Personajes (dibujarLobby y lobbyEncuadre de menu.js: la cámara de 60°, los
    /// pies al 92 % del escenario y la coronilla al 17 %, centrado; mirando a la cámara y un poco girado —y lo que se arrastró—),
    /// con su animación de quieto, sobre un fondo oscuro. Devuelve si hay algo en 3D para dibujar
    unsafe fn ini_lobby(&mut self, m: &mut Motor3d, w: f32, h: f32, dt: f32) -> bool {
        if !matches!(self.ini.panel, Some(super::paneles_juego::PanelIni::Personajes { .. })) || self.mapa.is_some() { return false; }
        let e = self.ini.pn.escena; if e[2] < 20.0 || e[3] < 20.0 { return false; }
        let skin = self.skin.clone();
        if self.ini.lobby.as_ref().map(|l| l.1 != skin).unwrap_or(true) {
            let Some(paq) = self.paq.as_mut() else { return false };
            let r = Personaje::cargar(paq, &skin, 0, 512, &mut self.ini.lobby_cargados).or_else(|_| Personaje::cargar(paq, "Hero", 0, 512, &mut self.ini.lobby_cargados));
            let Ok((mut pj, esc)) = r else { return false };
            if let Some((a, b)) = &self.nado { let _ = pj.nado(a, b); }
            if m.cargar(&esc).is_err() { return false; }
            self.ini.lobby = Some((pj, skin));
        }
        if !self.ini.cielo_ok {
            // (el fondo del lobby: un degradé casi parejo, gris oscuro)
            let g = [0.118f32, 0.125, 0.137];
            let cab = jxmotor::escena::Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![], texs: vec![], lms: vec![], items: vec![], agua: None,
                cielo: Some(jxmotor::escena::Cielo { top: g, mid: g, bot: [0.1, 0.105, 0.115], exp: [1.0, 1.0], tinte: [1.0; 3], dia: 0.0, k: 1.0, cubo: 0, caras: None }) };
            self.ini.cielo_ok = m.cargar(&jxmotor::escena::Escena { c: cab, datos: vec![] }).is_ok();
        }
        let Some((pj, _)) = self.ini.lobby.as_mut() else { return false };
        // (el encuadre: con el alto del personaje, la distancia a la que ocupa del 17 % al 92 % del escenario)
        let cam = [0.0f32, 600.0, 0.0]; let tv = (30.0f32).to_radians().tan(); let asp = w / h; let k = pj.tam.max(0.3);
        let (alto, ancho) = (1.82 * k, 0.62 * k);
        let px = ((0.92 - 0.17) * e[3]).min(e[2] * 0.62 * alto / ancho);
        let d = alto * h / (2.0 * tv * px); let pies = e[1] + 0.92 * e[3]; let nx = ((e[0] + e[2] / 2.0) / w) * 2.0 - 1.0; let ny = 1.0 - (pies / h) * 2.0;
        let piso = [cam[0] - nx * d * tv * asp, cam[1] + ny * d * tv, cam[2] + d];
        let yaw = std::f32::consts::PI + 0.25 + self.ini.pn.giro;
        let est = personaje::Estado { piso, vel: [0.0; 3], yaw, mira: 0.0, en_suelo: true, agachado: false, agua: None };
        pj.animar(dt, &est);
        let mut items = vec![]; pj.items(&personaje::base(piso, yaw), &mut items);
        let p = persp(60f32.to_radians(), asp, 0.1, 50.0 + d * 2.0); let vista = m4::mirar(cam, [cam[0], cam[1], cam[2] + 1.0], [0.0, 1.0, 0.0]);
        let s = [-0.35f32, 0.75, -0.55]; let n = (s[0] * s[0] + s[1] * s[1] + s[2] * s[2]).sqrt();
        let luz = jxmotor::escena::Luz { sol: [s[0] / n, s[1] / n, s[2] / n], sol_c: [1.5, 1.42, 1.3], amb_s: [0.36, 0.38, 0.44], amb_g: [0.16, 0.15, 0.13],
            nie: jxmotor::escena::Niebla { c: [0.012, 0.014, 0.017], a: 500.0, b: 900.0, m: 0.0, s: [0.0; 3] }, expo: 1.0 };
        m.poner_cuadro(jxmotor::escena::Cuadro { vp: m4::mul(&p, &vista), pos: cam, luz, agua_y: None, tiempo: self.ini.reloj, luces: vec![], esp: vec![], items, efectos: vec![] });
        true
    }
    /// (los íconos que se pintaron recién en este cuadro: a la placa antes de dibujar)
    fn ini_recursos_ico(&mut self, m: &mut Motor3d) { self.ini.rec.ico.subir(m, false); self.ini.rec.gl.subir(m, false); }
    /// el multijugador mientras se mira la lista (sin mapa: sólo la conexión y la lista de salas)
    fn ini_red(&mut self, dt: f32) {
        if !matches!(self.ini.panel, Some(super::paneles_juego::PanelIni::Multi { .. })) { return; }
        let Some(mut pu) = self.en_red.puente.take() else { return };
        self.en_red.red.mirando_lista(); pu.bombear(&mut self.en_red.red);
        let local = jxjuego::red::Local::default(); self.en_red.red.paso(dt as f64, &local); let _ = self.en_red.red.eventos();
        pu.bombear(&mut self.en_red.red); self.en_red.puente = Some(pu);
    }
    /// lo que pasa solo: el fondo cada 9 s, el glitch del logo, las fotos que hacen falta
    fn ini_paso(&mut self, dt: f32) {
        let ini = &mut self.ini;
        if ini.nivel != Nivel::Quieto && !ini.fondos.is_empty() && !ini.quieto {
            ini.fondo_t += dt; ini.ken_t += dt;
            if ini.fondo_t >= 9.0 && ini.fondos.len() > 1 { ini.fondo_t = 0.0; ini.fondo = (ini.fondo + 1) % ini.fondos.len(); ini.fundido = ini.reloj; }
        }
        if ini.nivel == Nivel::Pleno && ini.panel.is_none() && ini.reloj >= ini.glitch_prox { ini.glitch = ini.reloj; let a = ini.azar(); ini.glitch_prox = ini.reloj + 11.0 + a * 8.0; }
        if let Some((_, t)) = ini.golpe { if ini.reloj - t > 0.3 { ini.golpe = None; } }
        // (las fotos del fondo: la que va y la que viene; el logo)
        let n = ini.fondos.len();
        let pedir: Vec<String> = if n > 0 { vec![ini.fondos[ini.fondo].clone(), ini.fondos[(ini.fondo + n - 1) % n].clone(), "logo".into()] } else { vec!["logo".into()] };
        for k in pedir { self.ini_pedir_foto(&k); }
        // (las que ya no se ven se olvidan: con 1 GB no sobra)
        if n > 2 { let quedan: Vec<String> = vec![self.ini.fondos[self.ini.fondo].clone(), self.ini.fondos[(self.ini.fondo + n - 1) % n].clone()];
            let fuera: Vec<String> = self.ini.rec.fotos.keys().filter(|k| self.ini.fondos.contains(k) && !quedan.contains(k)).cloned().collect();
            for k in fuera { self.ini.rec.fotos.remove(&k); } }
    }

    /// todo lo que se dibuja del inicio
    fn ini_tandas(&mut self, w: f32, h: f32) -> Vec<(i64, Vec<f32>)> {
        // (el atlas y los íconos salen del estado mientras se dibuja: el pincel los usa y lo demás se sigue leyendo)
        let atlas = self.ini.rec.atlas.take(); let mut ico = std::mem::take(&mut self.ini.rec.ico); let mut gl = std::mem::take(&mut self.ini.rec.gl);
        let r = match atlas.as_ref() {
            Some(at) => {
                let cl = medir_cl(at, w, h, self.ini.ins, self.ini.sel, &self.ini.version, &self.ini.armado);
                let mut p = Pincel::nuevo(at, &mut ico, &mut gl);
                self.ini.cl = cl.clone();
                self.ini_fondo_dibujar(&mut p, w, h);
                match self.ini.panel.clone() { None => self.ini_home(&mut p, &cl), Some(pn) => self.pn_dibujar(&mut p, &pn, w, h) }
                p.tandas
            }
            None => vec![],
        };
        self.ini.rec.atlas = atlas; self.ini.rec.ico = ico; self.ini.rec.gl = gl;
        // (lo de siempre encima: el aviso —un cartel chico, como menuAviso— y lo que salió mal)
        let mut r = r;
        if let Some(at) = self.ini.rec.atlas.take() { let mut ico = std::mem::take(&mut self.ini.rec.ico); let mut gl = std::mem::take(&mut self.ini.rec.gl);
            { let mut p = Pincel::nuevo(&at, &mut ico, &mut gl); let f = (0.034 * h).clamp(14.0, 18.0);
              if let Some((a, ta)) = &self.aviso { let t = ta.elapsed().as_secs_f32(); if t < 4.0 { let k = (t / 0.2).min(1.0) * ((4.0 - t) / 0.3).min(1.0);
                  let rs = at.renglones(Cara::S4, f, 0.0, a, (w * 0.7).min(620.0)); let ancho = rs.iter().map(|x| at.ancho(Cara::S4, f, 0.0, x)).fold(0.0f32, f32::max); let lh = f * 1.4;
                  let (cw, ch) = (ancho + f * 2.4, rs.len() as f32 * lh + f * 1.4); let (x0, y0) = ((w - cw) / 2.0, h * 0.62);
                  p.con_alfa(k, |p| { p.rect(x0 + 4.0, y0 + 4.0, cw, ch, [0.0, 0.0, 0.0, 0.5]); p.rect(x0, y0, cw, ch, rgba(0x0c0d0f, 0.96)); p.rect(x0, y0, 4.0, ch, AMA); p.borde(x0, y0, cw, ch, 1.0, rgba(0xefede7, 0.12));
                      for (i, rr) in rs.iter().enumerate() { let base = p.at.base_centrada(Cara::S4, f, lh, y0 + f * 0.7 + i as f32 * lh, lh); p.texto(Cara::S4, f, x0 + f * 1.2, base, TX, 0.0, rr); } }); } }
              if let Some(e) = &self.error { let rs = at.renglones(Cara::S4, f, 0.0, e, w * 0.8); let ch = (rs.len() + 1) as f32 * f * 1.4 + f; p.rect(w * 0.08, h * 0.3, w * 0.84, ch, rgba(0x5a0000, 0.9));
                  p.texto(Cara::S7, f, w * 0.1, h * 0.3 + f * 1.4, rgba(0xffd84d, 1.0), 0.0, "Algo salió mal (sacale una captura):");
                  for (i, rr) in rs.iter().enumerate() { p.texto(Cara::S4, f, w * 0.1, h * 0.3 + f * 1.4 * (i as f32 + 2.0), TX, 0.0, rr); } }
              r.extend(p.tandas); }
            self.ini.rec.atlas = Some(at); self.ini.rec.ico = ico; self.ini.rec.gl = gl;
        } else if let Some(l) = &self.letras { let mut u = vec![]; let t = h * 0.032;
            if let Some(e) = &self.error { l.texto(&mut u, w * 0.1, h * 0.3, t * 0.75, [1.0, 0.85, 0.3, 1.0], &format!("Algo salió mal: {}", e.chars().take(110).collect::<String>())); }
            if !u.is_empty() { r.push((TEX_LETRAS, u)); } }
        r
    }

    /// el fondo: las dos escenas que se funden (opacidad en 1,8 s), agrandadas despacio (clKenPaso: de 1,02 a 1,13 y un poco a
    /// la izquierda, ida y vuelta en 26 s, de a saltos de 1/6 s), la sombra de la izquierda (.rbSombra), el grano y la viñeta
    /// (.clGrano: opacidad 0,2)
    fn ini_fondo_dibujar(&self, p: &mut Pincel, w: f32, h: f32) {
        let ini = &self.ini;
        // (en Personajes, el lobby en 3D atrás —rb3d: sin las escenas ni la sombra—)
        if matches!(ini.panel, Some(super::paneles_juego::PanelIni::Personajes { .. })) && self.mapa.is_none() { if ini.lobby.is_none() { p.rect(0.0, 0.0, w, h, rgba(0x1e2023, 1.0)); } return; }
        p.rect(0.0, 0.0, w, h, [0.0, 0.0, 0.0, 1.0]);
        let ken = if ini.nivel == Nivel::Quieto { 0.0 } else { let paso = if ini.nivel == Nivel::Bajo { 0.5 } else { 1.0 / 6.0 }; let t = ((ini.ken_t / paso).floor() * paso) % 52.0; if t < 26.0 { t / 26.0 } else { 2.0 - t / 26.0 } };
        let (s, dx) = (1.02 + 0.11 * ken, -0.016 * ken * w);
        let n = ini.fondos.len();
        let capa = |p: &mut Pincel, k: &str, a: f32| {
            if a <= 0.0 { return; }
            let Some((id, tw, th)) = self.ini_foto(k) else { p.rect(0.0, 0.0, w, h, con_a(rgba(0x1a1d24, 1.0), a)); return };
            p.con(pincel::mm(pincel::mover(dx, 0.0), pincel::escalar_en(s, s, w / 2.0, h / 2.0)), |p| p.foto_cubre(id, tw, th, 0.0, 0.0, w, h, [0.5, 0.5], [1.0, 1.0, 1.0, a]));
        };
        if n > 0 {
            // (al aparecer, la primera escena se funde desde el negro; después, la nueva sobre la anterior)
            let f = ((ini.reloj - ini.fundido) / 1.8).clamp(0.0, 1.0); let f0 = ((ini.reloj - ini.entrada.min(0.0).max(-0.0)) / 1.8).clamp(0.0, 1.0);
            if f < 1.0 { capa(p, &ini.fondos[(ini.fondo + n - 1) % n], 1.0 - f); }
            capa(p, &ini.fondos[ini.fondo], if ini.fundido < 0.0 { f0 } else { f });
        } else { p.rect(0.0, 0.0, w, h, rgba(0x1a1d24, 1.0)); }
        // (.rbSombra del inicio: de la izquierda, negro 0,42 hasta la mitad)
        p.degrade_h(0.0, 0.0, w, h, &[(0.0, [0.0, 0.0, 0.0, 0.42]), (0.5, [0.0, 0.0, 0.0, 0.0])]);
        if self.ini.panel.is_some() { return; }
        // (.clGrano, con opacidad 0,2: el grano quieto y la viñeta suave —elipse en 62 % 42 %, de 52 % a 100 %: negro 0,32—)
        p.grano(0.0, 0.0, w, h, 0.0, 0.0, 0.2);
        let (cx, cy) = (0.62 * w, 0.42 * h); let (rx, ry) = (std::f32::consts::SQRT_2 * cx.max(w - cx), std::f32::consts::SQRT_2 * cy.max(h - cy));
        p.con_recorte([0.0, 0.0, w, h], |p| { let n = 48;
            for k in 0..8 { let (t0, t1) = (0.52 + 0.48 * k as f32 / 8.0, 0.52 + 0.48 * (k + 1) as f32 / 8.0); let (a0, a1) = (0.32 * 0.2 * (t0 - 0.52) / 0.48, 0.32 * 0.2 * (t1 - 0.52) / 0.48);
                for i in 0..n { let (g0, g1) = (i as f32 / n as f32 * std::f32::consts::TAU, (i + 1) as f32 / n as f32 * std::f32::consts::TAU);
                    let q = |t: f32, g: f32| [cx + rx * t * g.cos(), cy + ry * t * g.sin()];
                    let b = [8.0 / p.at.w as f32, 8.0 / p.at.h as f32];
                    p.quad(pincel::TEX_MENUS, [q(t0, g0), q(t0, g1), q(t1, g1), q(t1, g0)], [b; 4], [[0.0, 0.0, 0.0, a0], [0.0, 0.0, 0.0, a0], [0.0, 0.0, 0.0, a1], [0.0, 0.0, 0.0, a1]]); } } });
    }

    /// el menú clásico
    fn ini_home(&self, p: &mut Pincel, cl: &Cl) {
        let ini = &self.ini; let t = ini.reloj - ini.entrada; let anim = ini.nivel != Nivel::Quieto; let bajo = ini.nivel == Nivel::Bajo;
        let entra = anim && t < 1.6;
        // —— el logo: la placa con la esquina rota (clRasgaLogo), la cinta encima y el glitch de vez en cuando ——
        let lg = cl.logo;
        let (mut la, mut lx) = (1.0, 0.0);
        if entra && !bajo { let k = prog(t, 0.0, 0.5); // (clLogoIn: aparece con un tirón)
            let kf: [(f32, f32, f32); 6] = [(0.0, 0.0, -8.0), (0.18, 0.9, 4.0), (0.28, 0.2, 4.0 - (4.0 + 2.0) * (0.28 - 0.18) / (0.42 - 0.18)), (0.42, 1.0, -2.0), (0.58, 1.0, 0.0), (1.0, 1.0, 0.0)];
            for i in 1..kf.len() { if k <= kf[i].0 { let f = (k - kf[i - 1].0) / (kf[i].0 - kf[i - 1].0); la = kf[i - 1].1 + (kf[i].1 - kf[i - 1].1) * f; lx = kf[i - 1].2 + (kf[i].2 - kf[i - 1].2) * f; break; } } }
        let tg = ini.reloj - ini.glitch; let gl = anim && !bajo && tg >= 0.0 && tg < 0.42;
        if gl { let k = tg / 0.42; let (a, x) = if k < 0.12 { (1.0, 0.0) } else if k < 0.24 { (0.55, 2.0) } else if k < 0.48 { (1.0, 0.0) } else if k < 0.6 { (0.8, -1.0) } else { (1.0, 0.0) }; la *= a; lx += x; }
        if let Some((id, _, _)) = self.ini_foto("logo") {
            let mk: Vec<[f32; 2]> = p.at.logo_m.iter().map(|q| [lg[0] + lx + q[0] / 100.0 * lg[2], lg[1] + q[1] / 100.0 * lg[3]]).collect();
            let (x0, y0, ww, hh) = (lg[0] + lx, lg[1], lg[2], lg[3]);
            p.poli_tex(id, &mk, |q| [(q[0] - x0) / ww, (q[1] - y0) / hh], [1.0, 1.0, 1.0, la]);
            // (el glitch: dos tajadas corridas y teñidas —naranja y celeste— que saltan de lugar)
            if gl { let k = tg / 0.42;
                let tajada = |p: &mut Pincel, i0: f32, i1: f32, dx: f32, a: f32, c: Col| { if a <= 0.0 { return; } let (ya, yb) = (y0 + hh * i0, y0 + hh * (1.0 - i1)); p.con_recorte([0.0, ya, 1e5, (yb - ya).max(0.0)], |p| p.foto(id, x0 + dx, y0, ww, hh, con_a(c, a))); };
                let s1 = if k < 0.2 { (0.2, 0.6, -7.0, 0.9) } else if k < 0.4 { (0.56, 0.24, 6.0, 0.85) } else if k < 0.6 { (0.34, 0.5, -4.0, 0.8) } else { (0.0, 1.0, 0.0, 0.0) };
                tajada(p, s1.0, s1.1, s1.2, s1.3, [1.0, 0.62, 0.3, 1.0]);
                let s2 = if k < 0.1 { (0.0, 1.0, 0.0, 0.0) } else if k < 0.3 { (0.64, 0.14, 5.0, 0.75) } else if k < 0.5 { (0.12, 0.72, -6.0, 0.7) } else if k < 0.62 { (0.44, 0.38, 3.0, 0.6) } else { (0.0, 1.0, 0.0, 0.0) };
                tajada(p, s2.0, s2.1, s2.2, s2.3, [0.35, 0.85, 1.0, 1.0]); }
        }
        // (la cinta: arriba a la izquierda de la placa, girada −12°; en la entrada se pega con un rebote)
        { let (cx, cy, cw, ch) = (lg[0] + lg[2] * 0.012, lg[1] + lg[3] * 0.03, lg[2] * 0.19, lg[3] * 0.25);
          let (mut a, mut s) = (0.92, 1.0); if entra && !bajo { let k = bezier(0.3, 1.4, 0.5, 1.0, prog(t, 0.55, 0.32)); a = 0.92 * k; s = 1.35 - 0.35 * k; }
          let (mx, my) = (cx + cw / 2.0, cy + ch / 2.0);
          p.con(pincel::mm(pincel::rotar_en(-12.0, mx, my), pincel::escalar_en(s, s, mx, my)), |p| p.pieza("cinta", cx, cy, cw, ch, [1.0, 1.0, 1.0, a])); }
        // (la línea amarilla gastada, que se estira en la entrada)
        { let a = cl.acento; let k = if entra && !bajo { bezier(0.2, 0.8, 0.2, 1.0, prog(t, 0.28, 0.55)) } else { 1.0 };
          if k > 0.0 { p.con(pincel::escalar_en(k, 1.0, a[0], a[1]), |p| p.pieza("linea", a[0], a[1], a[2], a[3], AMA)); } }
        // —— las opciones ——
        let hay = ini.sel.is_some();
        for i in 0..8 {
            let (b, _, _) = cl.its[i]; let (x0, y0, lw) = (b[0], b[1] + cl.inn, b[2]); let bh = cl.p - 2.0 * cl.inn;
            let elegida = ini.sel == Some(i) || (i == 0 && !hay); let pri_borde = i == 0 && hay && ini.sel != Some(0);
            let (fondo, tc, cara, ico_a) = if elegida { (AMA, NEGRO, Cara::O6, 0.9) } else { (PL, TX, Cara::O5, 0.62) };
            // (la entrada: cada barra se rasga de izquierda a derecha, 55 ms después de la anterior; con Bajos, más corta)
            let (dur, dem) = if bajo { (0.3, i as f32 * 0.03) } else { (0.46, 0.07 + i as f32 * 0.055) };
            let ke = if entra { bezier(0.2, 0.8, 0.2, 1.0, prog(t, dem, dur)) } else { 1.0 };
            if ke <= 0.0 { continue; }
            let alfa = if entra { let r = prog(t, dem, dur); if r < 0.55 { 0.25 + 0.75 * r / 0.55 } else { 1.0 } } else { 1.0 };
            // (el golpe al tocar: 4 px a la derecha, 96,5 % y más brillo a los 70 ms, y vuelve)
            let (mut gx, mut gs, mut br) = (0.0, 1.0, 0.0);
            if let Some((Pieza::Op(k), tg)) = ini.golpe { if k == i && anim { let r = ((ini.reloj - tg) / 0.2).clamp(0.0, 1.0); let f = if r < 0.35 { bezier(0.0, 0.0, 0.58, 1.0, r / 0.35) } else { 1.0 - bezier(0.0, 0.0, 0.58, 1.0, (r - 0.35) / 0.65) }; gx = 4.0 * f; gs = 1.0 - 0.035 * f; br = 0.22 * f; } }
            let luz = |c: Col| [(c[0] * (1.0 + br)).min(1.0), (c[1] * (1.0 + br)).min(1.0), (c[2] * (1.0 + br)).min(1.0), c[3]];
            let (cx, cy) = (x0 + lw / 2.0, y0 + bh / 2.0);
            let m = pincel::mm(pincel::mover(gx + if entra { -18.0 * (1.0 - ke) } else { 0.0 }, 0.0), pincel::escalar_en(gs, gs, cx, cy));
            p.con(m, |p| p.con_alfa(alfa, |p| {
                // (el rasgón de la entrada: el borde derecho dentado avanza de 0 a 106 %)
                let dib = |p: &mut Pincel| {
                    p.placa_rota(x0, y0, lw, bh, i % 4, 48.0, luz(fondo), Some((x0 + ((i * 53) % 160) as f32, y0 + ((i * 97) % 160) as f32, 1.0)));
                    if pri_borde { p.rect(x0, y0, cl.f * 0.2, bh, AMA); }
                    let f = cl.f; p.icono(CL_ICO[i], x0 + 0.75 * f, y0 + (bh - f) / 2.0, f, 2.3, con_a(luz(tc), ico_a));
                    let base = p.at.base_centrada(cara, f, 1.1 * f, y0, bh);
                    p.texto(cara, f, x0 + 2.25 * f, base, luz(tc), 0.02, &CL_TXT[i].to_uppercase());
                    // (el barrido de luz al pasar a ser la elegida: una franja inclinada que cruza la placa en 0,62 s)
                    let ts = ini.reloj - ini.sel_t;
                    if anim && ini.sel == Some(i) && ts < 0.62 {
                        let k = bezier(0.45, 0.15, 0.3, 1.0, ts / 0.62); let bw = lw * 0.34; let xb = x0 + bw * (-1.2 + 4.4 * k); let (yt, yb) = (y0 - bh * 0.1, y0 + bh * 1.1); let sk = (18.0f32).to_radians().tan() * (yb - yt) / 2.0;
                        p.con_recorte([x0, y0, lw, bh], |p| { let par = [(0.0, 0.0), (0.34, 0.1), (0.47, 0.5), (0.5, 0.95), (0.58, 0.12), (1.0, 0.0)];
                            for j in 1..par.len() { let (a, b) = (par[j - 1], par[j]); let (xa, xb2) = (xb + bw * a.0, xb + bw * b.0); let ca = [1.0, 1.0, 1.0, a.1]; let cb = if j == 4 { [1.0, 0.99, 0.94, b.1] } else { [1.0, 1.0, 1.0, b.1] };
                                let w8 = [8.0 / p.at.w as f32, 8.0 / p.at.h as f32];
                                p.quad(pincel::TEX_MENUS, [[xa + sk, yt], [xb2 + sk, yt], [xb2 - sk, yb], [xa - sk, yb]], [w8; 4], [ca, cb, cb, ca]); } });
                    }
                };
                if entra && ke < 1.0 {
                    // (polygon(0 0, 106% 0, 101% 22%, 109% 47%, 102% 71%, 107% 100%, 0 100%) desde todo en 0)
                    let px0 = [(0.0, 0.0, 1.06), (0.22, -0.05, 1.01), (0.47, 0.03, 1.09), (0.71, -0.04, 1.02), (1.0, 0.01, 1.07)];
                    for j in 1..px0.len() { let (a, b) = (px0[j - 1], px0[j]); let (ya, yb) = (y0 + bh * a.0, y0 + bh * b.0); let xa = x0 + lw * (a.1 + (a.2 - a.1) * ke); let xb = x0 + lw * (b.1 + (b.2 - b.1) * ke);
                        // (en cada tramo, el borde es una recta: se recorta con su lado izquierdo, en franjas finas)
                        let n = 4; for s in 0..n { let (f0, f1) = (s as f32 / n as f32, (s + 1) as f32 / n as f32); let yy = ya + (yb - ya) * f0; let hh = (yb - ya) * (f1 - f0); let xx = xa + (xb - xa) * (f0 + f1) / 2.0;
                            p.con_recorte([x0 - 30.0, yy, (xx - x0 + 30.0).max(0.0), hh + 0.01], |p| dib(p)); } }
                } else { dib(p); }
            }));
        }
        // —— abajo: la barra y la versión (suben en la entrada); arriba: Avisos, Bugs y La grieta (bajan) ——
        let sube = if entra && !bajo { bezier(0.2, 0.8, 0.2, 1.0, prog(t, 0.42, 0.42)) } else { 1.0 };
        let baja = if entra && !bajo { bezier(0.2, 0.8, 0.2, 1.0, prog(t, 0.5, 0.42)) } else { 1.0 };
        p.con(pincel::mover(0.0, 12.0 * (1.0 - sube)), |p| p.con_alfa(sube, |p| {
            for (pz, r) in &cl.abajo { self.ini_chip(p, cl, *pz, *r); }
            // (la versión: «JXMod», el número en amarillo y el día; placa sin punta)
            let v = cl.ver; p.rect(v[0], v[1], v[2], v[3], PL); p.grano(v[0], v[1], v[2], v[3], v[0] + 71.0, v[1] + 3.0, 1.0);
            let f = cl.ch_f; let base = p.at.base_centrada(Cara::O5, f, f, v[1], v[3]); let mut x = v[0] + 0.9 * f;
            x += p.texto(Cara::O5, f, x, base, TX, 0.05, "JXMOD") + 0.6 * f;
            x += p.texto(Cara::O6, f, x, base, AMA, 0.05, &ini.version.to_uppercase()) + 0.6 * f;
            if !ini.armado.is_empty() { p.texto(Cara::O5, f, x, base, con_a(TX, 0.68), 0.05, &ini.armado); }
        }));
        p.con(pincel::mover(0.0, -12.0 * (1.0 - baja)), |p| p.con_alfa(baja, |p| { for (pz, r) in &cl.arriba { self.ini_chip(p, cl, *pz, *r); } }));
    }

    /// una placa chica (clChip): el fondo con la punta rota y grano, el ícono y el texto; apretada, amarilla
    fn ini_chip(&self, p: &mut Pincel, cl: &Cl, pz: Pieza, r: [f32; 4]) {
        let ini = &self.ini; let f = cl.ch_f; let apretada = ini.apretado == Some(pz);
        let (fondo, tc) = if apretada { (AMA, NEGRO) } else { (PL, TX) };
        let (mut gx, mut gs) = (0.0, 1.0);
        if let Some((k, tg)) = ini.golpe { if k == pz && ini.nivel != Nivel::Quieto { let rr = ((ini.reloj - tg) / 0.2).clamp(0.0, 1.0); let q = if rr < 0.35 { rr / 0.35 } else { 1.0 - (rr - 0.35) / 0.65 }; gx = 4.0 * q; gs = 1.0 - 0.035 * q; } }
        let (cx, cy) = (r[0] + r[2] / 2.0, r[1] + r[3] / 2.0);
        p.con(pincel::mm(pincel::mover(gx, 0.0), pincel::escalar_en(gs, gs, cx, cy)), |p| {
            p.placa_rota(r[0], r[1], r[2], r[3], 4, 24.0, fondo, Some((r[0] + 37.0, r[1] + 11.0, 1.0)));
            let (pad, g) = if cl.compacto >= 1 { (0.55 * f, 0.4 * f) } else { (0.85 * f, 0.5 * f) };
            let base = p.at.base_centrada(Cara::O5, f, f, r[1], r[3]);
            let ic = 1.22 * f; let iy = r[1] + (r[3] - ic) / 2.0;
            match pz {
                Pieza::Discord | Pieza::TikTok => { let l = 1.3 * f; p.icono(if pz == Pieza::Discord { "discord" } else { "tiktok" }, cx - l / 2.0, cy - l / 2.0, l, 2.2, tc); }
                Pieza::Idioma if cl.compacto >= 2 => { p.icono("mundo", cx - ic / 2.0, iy, ic, 2.2, tc); }
                _ => {
                    let (ico, txt, extra): (&'static str, String, Option<String>) = match pz {
                        Pieza::Mods => ("caja", if cl.compacto >= 1 { "S".into() } else { "SANDBOX".into() }, None),
                        Pieza::Idioma => ("mundo", "ES".into(), None),
                        Pieza::Nombre => ("persona", self.en_red.red.nombre.clone(), None),
                        Pieza::Avisos => ("campana", "AVISOS".into(), None),
                        Pieza::Bugs => ("bicho", "BUGS".into(), None),
                        Pieza::Grieta => ("rayo", "LA GRIETA".into(), Some("ACTIVO".into())),
                        _ => ("bajar", "ACTUALIZAR".into(), None),
                    };
                    let ic_c = if pz == Pieza::Grieta && !apretada { rgba(0xc39dff, 1.0) } else { tc };
                    let x = r[0] + pad; p.icono(ico, x, iy, ic, 2.2, ic_c);
                    let xt = x + ic + g;
                    if pz == Pieza::Nombre { let max = f * match cl.compacto { 0 => 6.4, 1 => 4.6, _ => 4.2 }; p.texto_max(Cara::O5, f, xt, base, tc, 0.03, &txt, max); }
                    else { let wt = p.texto(Cara::O5, f, xt, base, tc, 0.03, &txt);
                        if let Some(e) = extra {
                            if cl.evt_corto { p.disco(xt + wt + 0.5 * f + 4.0, cy, 4.0, rgba(0xc39dff, 1.0)); }
                            else { p.texto(Cara::O6, f, xt + wt + 0.5 * f, base, if apretada { tc } else { rgba(0xd9c2ff, 1.0) }, 0.03, &e); } } }
                }
            }
        });
    }

    /// qué hay en (x, y) del menú: la opción (con lo que se toca de más arriba y abajo) o la placa (44 px de alto para tocar)
    pub(super) fn ini_pieza_en(&self, x: f32, y: f32) -> Option<Pieza> {
        let cl = &self.ini.cl;
        for (i, (b, ht, hb)) in cl.its.iter().enumerate() { if x >= b[0] && x <= b[0] + b[2] && y >= b[1] - ht && y <= b[1] + b[3] + hb { return Some(Pieza::Op(i)); } }
        let ext = (44.0 - cl.ch_v).max(0.0);
        for (pz, r) in cl.abajo.iter() { if x >= r[0] && x <= r[0] + r[2] && y >= r[1] - cl.arriba_t && y <= r[1] + r[3] + cl.abajo_t { return Some(*pz); } }
        for (pz, r) in cl.arriba.iter() { if x >= r[0] && x <= r[0] + r[2] && y >= r[1] - ext / 2.0 && y <= r[1] + r[3] + ext / 2.0 { return Some(*pz); } }
        None
    }

    // —— el tacto: devuelve true si el inicio (o algo de este módulo) se queda con el toque ——
    pub(super) fn ini_dedo_abajo(&mut self, id: i32, x: f32, y: f32, w: f32, h: f32) -> bool {
        if !self.ini.abierto { return self.pz_dedo_abajo(id, x, y, w, h); }
        if self.ajustes.is_some() || self.en_red.panel || self.gmod.panel { return false; }
        if self.ini.panel.is_some() { self.pn_dedo_abajo(id, x, y, w, h); return true; }
        let pz = self.ini_pieza_en(x, y);
        if let Some(pz) = pz { if self.ini.nivel != Nivel::Quieto { self.ini.golpe = Some((pz, self.ini.reloj)); } if let Pieza::Op(i) = pz { self.ini.elegir(Some(i)); } }
        self.ini.apretado = pz; self.ini.dedo = Some((id, pz, x, y));
        true
    }
    pub(super) fn ini_dedo_mueve(&mut self, id: i32, x: f32, y: f32, h: f32) -> bool {
        if !self.ini.abierto { return self.pz_dedo_mueve(id, x, y, h); }
        if self.ajustes.is_some() || self.en_red.panel || self.gmod.panel { return false; }
        if self.ini.panel.is_some() { self.pn_dedo_mueve(id, x, y, h); return true; }
        if let Some((d, pz, _, _)) = self.ini.dedo { if d == id { let ahora = self.ini_pieza_en(x, y); if ahora != pz { self.ini.apretado = None; } } }
        true
    }
    pub(super) fn ini_dedo_arriba(&mut self, id: i32, w: f32, h: f32) -> bool {
        if !self.ini.abierto { return self.pz_dedo_arriba(id, w, h); }
        if self.ajustes.is_some() || self.en_red.panel || self.gmod.panel { return false; }
        if self.ini.panel.is_some() { self.pn_dedo_arriba(id, w, h); return true; }
        let Some((d, pz, _, _)) = self.ini.dedo else { return true }; if d != id { return true; }
        self.ini.dedo = None; let suelto = self.ini.apretado.take();
        // (al soltar el dedo, la elegida vuelve a ser la principal: pointerleave)
        self.ini.elegir(None);
        if let (Some(a), Some(b)) = (pz, suelto) { if a == b { self.sonido.tocar("Click", 0.5, 1.0, None); self.ini_accion(a); } }
        true
    }
    /// lo que hace cada cosa del menú (inicioAccion)
    pub(super) fn ini_accion(&mut self, pz: Pieza) {
        use super::paneles_juego::PanelIni as P;
        match pz {
            Pieza::Op(i) => match CL_K[i] {
                "nueva" => self.pn_abrir(P::Nueva { cat: 0, scroll: 0.0 }),
                "multi" => self.pn_abrir(P::Multi { scroll: 0.0 }),
                "social" => self.pn_abrir(P::Social { tab: 0 }),
                "tienda" => self.pn_abrir(P::Tienda { tab: 0, cat: 0 }),
                "crear" => self.pn_abrir(P::Crear),
                "personajes" => self.pn_abrir(P::Personajes { tab: 0, scroll: 0.0 }),
                "opciones" => self.pn_abrir(P::Opciones { tab: 0, scroll: 0.0 }),
                _ => self.ini_salir(),
            },
            Pieza::Mods => self.pn_abrir(P::Tienda { tab: 0, cat: 0 }),
            Pieza::Idioma => self.pn_abrir(P::Idioma),
            Pieza::Nombre => { let n = self.en_red.red.nombre.clone(); self.pedir_texto(Escribir::Nombre, "Tu nombre", &n, 16, false); }
            Pieza::Discord => self.avisar("Discord de JXStudios: discord.gg/bsdThEjje".into()),
            Pieza::TikTok => self.avisar("TikTok de JXStudios: @jxstudios1".into()),
            Pieza::Avisos => self.pn_abrir(P::Avisos),
            Pieza::Bugs => self.pn_abrir(P::Bugs { tab: 0, scroll: 0.0 }),
            Pieza::Grieta => self.pn_abrir(P::Grieta),
            Pieza::Actualizar => {}
        }
    }
    /// «Salir»: en el celular cierra la app (como la de la web: JXNativo.salir); en la compu no hace nada
    fn ini_salir(&mut self) { self.ini.salir = true; }
}
