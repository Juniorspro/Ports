//! La personalización del personaje y lo social de la web, como hijo de comun.rs (usa el juego por dentro):
//! - identidad.js: las skins heredadas con nombre propio, la ropa y los retratos teñidos y la plaza JX de los mapas base;
//! - gorros.js y los gorros de personas.js: los del juego y los hechos con geometría, con el ajuste (tamaño, X/Y/Z y color);
//! - el panel de Personaje (rbmenus.js: Personajes y Gorros, con la personalización del gorro y el accesorio importado);
//! - accesorios.js: el accesorio para la cabeza (accesorio.rs);
//! - armaaj.js: el arma en la mano, a gusto;
//! - celular.js y celumano.js: el celular (celu_juego.rs); celulares.js: la calidad de entrada por el modelo del celular;
//! - emotes.js (los de captura, los del paquete y los de la gente), ruleta.js y juntos.js (emotes_juego.rs).
//! Todo lo que guarda va en `Pjs` (el campo `pjs` del juego) y en personaje.json; las líneas que lo enganchan a comun.rs
//! (y los cambios chicos en otros archivos) están en integrar_personajes.py.
use super::*;
use jxjuego::geo::Geo;
use jxjuego::gorros::{self, Ajuste, Gorros};
use jxjuego::identidad;
use jxmotor::escena::{ItemDin, LuzP, Mat};
use serde_json::{json, Value};

#[path = "celu_juego.rs"] pub mod celu_juego;
#[path = "emotes_juego.rs"] pub mod emotes_juego;
#[path = "accesorio.rs"] pub mod accesorio;
#[path = "vectores.rs"] pub mod vectores;
pub use celu_juego::pose_jugador;

// ---------------- los números propios en el motor (lejos de los del paquete y de los demás: −9 000 000…) ----------------
pub const ID_PJ: i64 = -9_000_000;
pub const TEX_RETRATOS: i64 = ID_PJ - 1;
pub const TEX_GORROS: i64 = ID_PJ - 2;
pub const TEX_ICO: i64 = ID_PJ - 3;
pub const TEX_CELU_OBJ: i64 = ID_PJ - 4;
pub const TEX_EMO: i64 = ID_PJ - 5;
/// la plaza JX: sus tres mallas y sus materiales
pub const PLAZA_MALLA: i64 = ID_PJ - 20; pub const PLAZA_MAT: i64 = ID_PJ - 30;
/// el celular en la mano: la caja y sus materiales
pub const CELU_CAJA: i64 = ID_PJ - 40; pub const CELU_MAT: i64 = ID_PJ - 50;
/// los accesorios: ID_ACC − 1000·n − parte (mallas) y lo mismo para sus materiales y texturas
pub const ID_ACC: i64 = ID_PJ - 100_000;

/// el lado de cada ícono en los atlas
pub const ICO: u32 = 96;
pub const ICO_COLS: u32 = 10;

// ---------------- dibujar con triángulos (el blanco del atlas de letras) ----------------
/// un triángulo liso (se usa un rectángulo de Letras y se le cambian las esquinas: el blanco del atlas)
pub fn tri(l: &Letras, u: &mut Vec<f32>, a: [f32; 2], b: [f32; 2], c: [f32; 2], col: [f32; 4]) {
    let n = u.len(); l.rect(u, 0.0, 0.0, 1.0, 1.0, col);
    u[n] = a[0]; u[n + 1] = a[1]; u[n + 8] = b[0]; u[n + 9] = b[1]; u[n + 16] = c[0]; u[n + 17] = c[1]; u.truncate(n + 24);
}
/// un cuadrilátero liso (a, b, c, d en orden)
pub fn cuad(l: &Letras, u: &mut Vec<f32>, a: [f32; 2], b: [f32; 2], c: [f32; 2], d: [f32; 2], col: [f32; 4]) { tri(l, u, a, b, c, col); tri(l, u, a, c, d, col); }
/// una línea de grosor `g`
pub fn linea(l: &Letras, u: &mut Vec<f32>, a: [f32; 2], b: [f32; 2], g: f32, col: [f32; 4]) {
    let (dx, dy) = (b[0] - a[0], b[1] - a[1]); let n = (dx * dx + dy * dy).sqrt().max(1e-6); let (px, py) = (-dy / n * g / 2.0, dx / n * g / 2.0);
    cuad(l, u, [a[0] + px, a[1] + py], [b[0] + px, b[1] + py], [b[0] - px, b[1] - py], [a[0] - px, a[1] - py], col);
}
/// el tilde de elegido (pjOk): un círculo amarillo con el tilde negro
pub fn tilde(l: &Letras, u: &mut Vec<f32>, cx: f32, cy: f32, r: f32) {
    l.disco(u, cx, cy, r, [0.95, 0.66, 0.1, 1.0]);
    let g = r * 0.28; linea(l, u, [cx - r * 0.45, cy + r * 0.02], [cx - r * 0.12, cy + r * 0.35], g, [0.0, 0.0, 0.0, 1.0]); linea(l, u, [cx - r * 0.12, cy + r * 0.35], [cx + r * 0.5, cy - r * 0.35], g, [0.0, 0.0, 0.0, 1.0]);
}
/// el «no» (glifo('no')): un círculo con la barra cruzada
pub fn glifo_no(l: &Letras, u: &mut Vec<f32>, cx: f32, cy: f32, r: f32, col: [f32; 4]) {
    let n = 28; let g = r * 0.16;
    for k in 0..n { let (a0, a1) = (k as f32 / n as f32 * std::f32::consts::TAU, (k + 1) as f32 / n as f32 * std::f32::consts::TAU); linea(l, u, [cx + a0.cos() * r, cy + a0.sin() * r], [cx + a1.cos() * r, cy + a1.sin() * r], g, col); }
    let d = r * 0.7; linea(l, u, [cx - d, cy - d], [cx + d, cy + d], g, col);
}
/// la cruz de cerrar
pub fn cruz_x(l: &Letras, u: &mut Vec<f32>, cx: f32, cy: f32, r: f32, g: f32, col: [f32; 4]) { linea(l, u, [cx - r, cy - r], [cx + r, cy + r], g, col); linea(l, u, [cx - r, cy + r], [cx + r, cy - r], g, col); }
/// un texto que entra en `ancho` (achicado hasta `min` y, si no, cortado con «…»)
pub fn texto_cabe(l: &Letras, u: &mut Vec<f32>, x: f32, y: f32, tam: f32, ancho: f32, col: [f32; 4], s: &str, centrado: bool) {
    let mut t = tam; while l.ancho(t, s) > ancho && t > tam * 0.7 { t *= 0.93; }
    let mut txt = s.to_string();
    if l.ancho(t, &txt) > ancho { while !txt.is_empty() && l.ancho(t, &(txt.clone() + "…")) > ancho { txt.pop(); } txt.push('…'); }
    let an = l.ancho(t, &txt); l.texto(u, if centrado { x + (ancho - an) / 2.0 } else { x }, y + (tam - t) * 0.5, t, col, &txt);
}
fn dentro(x: f32, y: f32, r: [f32; 4]) -> bool { x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3] }
/// un atlas RGBA de íconos de `ICO` lado, `ICO_COLS` por fila; la celda k
pub fn atlas_celda(px: &mut [u8], aw: u32, k: u32, ic: &[u8], lado: u32) {
    let (cx, cy) = ((k % ICO_COLS) * lado, (k / ICO_COLS) * lado);
    for y in 0..lado { let d = (((cy + y) * aw + cx) * 4) as usize; let s = ((y * lado) * 4) as usize; px[d..d + (lado * 4) as usize].copy_from_slice(&ic[s..s + (lado * 4) as usize]); }
}
pub fn uv_celda(k: u32, lado: u32, aw: f32, ah: f32) -> [f32; 4] { let (cx, cy) = ((k % ICO_COLS) * lado, (k / ICO_COLS) * lado); [cx as f32 / aw, cy as f32 / ah, (cx + lado) as f32 / aw, (cy + lado) as f32 / ah] }
pub fn subir_tex(m: &mut Motor3d, id: i64, w: u32, h: u32, px: Vec<u8>) -> bool {
    let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![], texs: vec![Tex { id, n: format!("pj{id}"), w, h, a: 1, o: 0 }], lms: vec![], items: vec![], agua: None, cielo: None };
    unsafe { m.cargar(&Escena { c: cab, datos: px }).is_ok() }
}
/// un ícono del paquete (DATA.ico) en su tamaño natural (RGBA, la fila 0 arriba)
pub fn icono_crudo(paq: &Paquete, nombre: &str) -> Option<(usize, usize, Vec<u8>)> {
    let id = paq.d["ico"][nombre].as_str()?; let b = paq.parte(&format!("i:{id}"))?;
    let (w, h, px) = jxjuego::geo::webp_rgba(b)?; Some((w as usize, h as usize, px))
}
/// lo achica (o agranda) a `lado` × `lado`, centrado y sin deformar, con el promedio de lo que cae en cada píxel
pub fn encuadrar(w: usize, h: usize, rgba: &[u8], lado: usize) -> Vec<u8> {
    let k = (lado as f32 / w.max(h) as f32).min(4.0); let (nw, nh) = (((w as f32 * k) as usize).max(1).min(lado), ((h as f32 * k) as usize).max(1).min(lado));
    let (ox, oy) = ((lado - nw) / 2, (lado - nh) / 2); let mut o = vec![0u8; lado * lado * 4];
    for y in 0..nh { for x in 0..nw {
        let (x0, x1) = ((x as f32 / k) as usize, (((x + 1) as f32 / k) as usize).max((x as f32 / k) as usize + 1).min(w));
        let (y0, y1) = ((y as f32 / k) as usize, (((y + 1) as f32 / k) as usize).max((y as f32 / k) as usize + 1).min(h));
        let mut s = [0u32; 4]; let mut n = 0;
        for yy in y0..y1.max(y0 + 1).min(h) { for xx in x0..x1.max(x0 + 1).min(w) { let i = (yy * w + xx) * 4; for c in 0..4 { s[c] += rgba[i + c] as u32; } n += 1; } }
        let d = ((y + oy) * lado + x + ox) * 4; for c in 0..4 { o[d + c] = (s[c] / n.max(1)) as u8; }
    } }
    o
}

// ---------------- lo que se guarda (PREFS) ----------------
/// el corrimiento del arma de primera persona (armaAj: metros en el espacio de la cámara; el giro en grados)
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct ArmaAj { pub x: f32, pub y: f32, pub z: f32, pub g: f32 }
pub const ARMAJ_LIM: [f32; 4] = [0.1, 0.1, 0.12, 25.0];
#[derive(Clone, Debug, Default)]
pub struct Prefs {
    pub skin: String, pub gorro: String, pub gorro_aj: Option<Ajuste>, pub acc: Option<accesorio::AccAj>,
    pub arma_aj: HashMap<String, ArmaAj>, pub ruleta: Option<Vec<Option<String>>>, pub emo_fav: Vec<String>, pub emo_rec: Vec<String>,
    /// ya se eligió la calidad por el modelo del celular (celulares.js: la primera vez)
    pub calidad_auto: bool,
}
impl Prefs {
    pub fn leer(t: &str) -> Prefs {
        let v: Value = serde_json::from_str(t).unwrap_or(Value::Null); let s = |k: &str| v[k].as_str().map(String::from);
        let lista = |k: &str| v[k].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
        let mut arma_aj = HashMap::new();
        if let Some(o) = v["armaAj"].as_object() { for (k, a) in o { let n = |c: &str, i: usize| (a[c].as_f64().unwrap_or(0.0) as f32).clamp(-ARMAJ_LIM[i], ARMAJ_LIM[i]); let x = ArmaAj { x: n("x", 0), y: n("y", 1), z: n("z", 2), g: n("g", 3) }; if x != ArmaAj::default() { arma_aj.insert(k.clone(), x); } } }
        Prefs { skin: s("skin").unwrap_or_else(|| "Hero".into()), gorro: s("gorro").unwrap_or_else(|| "HatEmpty".into()), gorro_aj: Ajuste::limpio(&v["gorroAj"]), acc: accesorio::AccAj::limpio(&v["acc"]),
            arma_aj, ruleta: v["ruleta"].as_array().map(|a| a.iter().map(|x| x.as_str().filter(|s| !s.is_empty()).map(String::from)).collect()), emo_fav: lista("emoFav"), emo_rec: lista("emoRec"), calidad_auto: v["calidadAuto"].as_bool().unwrap_or(false) }
    }
    pub fn json(&self) -> String {
        let aa: serde_json::Map<String, Value> = self.arma_aj.iter().map(|(k, a)| (k.clone(), json!({ "x": a.x, "y": a.y, "z": a.z, "g": a.g }))).collect();
        json!({ "skin": self.skin, "gorro": self.gorro, "gorroAj": self.gorro_aj.as_ref().map(|g| g.json()), "acc": self.acc.as_ref().map(|a| a.json()), "armaAj": aa,
            "ruleta": self.ruleta, "emoFav": self.emo_fav, "emoRec": self.emo_rec, "calidadAuto": self.calidad_auto }).to_string()
    }
}

/// los botones propios (Boton::Pj): el del celular (Personaje y Arma en la mano se abren desde la pausa, como en la web)
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Bp { Celular }
/// dónde van: el del celular (data-btn=celular, el ícono iMeme), redondo, en la columna del sistema (hudorden.js: pausa,
/// chat, celular; los que se ven van sin huecos: sin chat, abajo de la pausa), con el paso de la pausa al MOD
pub(super) fn botones(w: f32, h: f32, v: &mut Vec<Btn>) {
    let k = ((w / 1280.0) * (h / 720.0)).sqrt() * 0.776; let (cx, cy, s) = super::pausa_juego::boton_pausa(w, h);
    v.push(Btn { b: Boton::Pj(Bp::Celular), x: cx, y: cy + s + (18.0 + 10.0) * k, w: s, h: s, redondo: true });
}

/// la pestaña del panel de Personaje (RBM.pjTab: personajes o gorros) y lo que se busca en cada una
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum Tab { #[default] Skin, Gorro }
/// el panel de Personaje abierto
#[derive(Clone, Debug, Default)]
pub struct PanelPj { pub tab: Tab, pub scroll: f32, pub q: [String; 2], pub yaw: f32, pub arrastre: Option<(i32, f32)>, pub barra: Option<(i32, u8)>, pub aviso_acc: String, pub desde_pausa: bool }
/// el panel de «Arma en la mano» (armaAjPanel)
#[derive(Clone, Debug, Default)]
pub struct PanelAa { pub barra: Option<(i32, usize)> }
/// la plaza JX puesta en este mapa
pub struct PlazaViva { pub items: Vec<ItemDin>, pub luz: [f32; 3] }

/// todo lo de personajes.rs
#[derive(Default)]
pub struct Pjs {
    pub prefs: Prefs, pub cargado: bool,
    pub gorros: Gorros, gorro_listo: Option<String>, tenido_listo: Option<(String, String)>,
    /// la tabla de las texturas a teñir (identidad: puesta en el paquete) y la plaza de este mapa
    tinte_puesto: bool, pub plaza: Option<PlazaViva>, plaza_pedida: bool,
    /// los atlas ya en el motor: retratos (y qué skin en cada celda), gorros, íconos
    retratos: Option<Vec<String>>, gorros_ico: Option<Vec<String>>, ico_ok: bool,
    pub panel: Option<PanelPj>, pub panel_aa: Option<PanelAa>,
    pub celu: celu_juego::Celu, pub emo: emotes_juego::Emo, pub acc: accesorio::Accs,
    /// los gorros de los demás (por su número: qué gorro y su ajuste)
    remotos: HashMap<String, (String, Option<Ajuste>)>,
    pub t: f32,
    /// rearmar el cuerpo del jugador (se eligió otro personaje)
    pub rearmar: bool,
    /// (para las pruebas) una cámara fija: dónde y hacia dónde
    pub prueba_cam: Option<([f32; 3], [f32; 3])>, pub prueba_sin_hud: bool,
}
impl Pjs {
    /// algún panel propio abierto (toma los toques)
    pub fn panel(&self) -> bool { self.panel.is_some() || self.panel_aa.is_some() || self.emo.panel() || self.celu.panel_toma() }
}

/// los personajes elegibles (DATA.chars) y su retrato (RETRATO de menu.js)
pub fn retrato_clave(s: &str) -> String {
    match s { "Prisoner01" | "PilotFemale" | "Butcher" | "Military" | "Engineer" => s.to_string(), _ => s.to_lowercase() }
}

impl Juego {
    // ---------------- al arrancar ----------------
    /// lo que se lee una vez: personaje.json, el tinte de la ropa en el paquete (idTex) y el personaje elegido
    pub(crate) fn pjs_iniciar(&mut self) {
        let t = self.datos.as_ref().and_then(|d| std::fs::read_to_string(d.join("personaje.json")).ok()).unwrap_or_default();
        self.pjs.prefs = Prefs::leer(&t); self.pjs.cargado = true;
        if let Some(p) = self.paq.as_mut() {
            if !self.pjs.tinte_puesto { let tt = identidad::tabla(&p.d); p.tinte = Some(Box::new(move |i, w, h, px| { identidad::tenir_textura(&tt, i, w, h, px); })); self.pjs.tinte_puesto = true; }
            let chars: Vec<String> = p.d["chars"].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
            if chars.iter().any(|c| *c == self.pjs.prefs.skin) { self.skin = self.pjs.prefs.skin.clone(); }
        }
        // (celulares.js: la primera vez, la calidad según el modelo del celular y su GPU)
        self.celulares_calidad();
        self.acc_iniciar();
    }
    pub(crate) fn pjs_guardar(&self) { if let Some(d) = &self.datos { let _ = std::fs::write(d.join("personaje.json"), self.pjs.prefs.json()); } }

    // ---------------- al cambiar de mapa ----------------
    /// lo del motor se vació: los atlas y los gorros se vuelven a subir; la plaza se vuelve a armar
    pub(crate) fn pjs_limpiar(&mut self) {
        self.pjs.gorros.olvidar(); self.pjs.gorro_listo = None; self.pjs.tenido_listo = None; self.pjs.plaza = None; self.pjs.plaza_pedida = false;
        self.pjs.retratos = None; self.pjs.gorros_ico = None; self.pjs.ico_ok = false;
        self.celu_limpiar(); self.emo_limpiar(); self.acc_limpiar();
    }
    /// el mapa recién armado: la plaza JX (en los siete mapas base de superficie, a ~46 m de la aparición, si es parejo)
    pub(crate) fn pjs_mapa(&mut self, m: &mut Motor3d) {
        let Some(mp) = self.mapa.as_mut() else { return };
        let Some((piso, graf)) = identidad::tono_plaza(&mp.nombre) else { return };
        let Some(sp) = mp.spawns.first().copied() else { return };
        let mundo = &mp.mundo;
        let pisob = |x: f64, y: f64, z: f64| -> Option<f64> { mundo.rayo([x as f32, y as f32, z as f32], [0.0, -1.0, 0.0], 400.0).map(|g| y - g.t as f64) };
        let Some((p, yaw)) = identidad::lugar_plaza([sp.0[0] as f64, sp.0[1] as f64, sp.0[2] as f64], sp.1.unwrap_or(0.0) as f64, &pisob) else { return };
        let pl = identidad::plaza(p, yaw + std::f64::consts::PI);
        // (choca como el mapa: los triángulos de la plataforma y las rampas, y las cajas del monolito y los postes)
        let mut tris = std::mem::take(&mut mp.mundo.t); tris.extend(pl.tris.iter().map(|&x| x as f32));
        let mut cuerpos = std::mem::take(&mut mp.mundo.cuerpos);
        for c in &pl.cajas {
            let e = [jxjuego::geo::qrot(c.q, [1.0, 0.0, 0.0]), jxjuego::geo::qrot(c.q, [0.0, 1.0, 0.0]), jxjuego::geo::qrot(c.q, [0.0, 0.0, 1.0])];
            let f = jxjuego::mundo::Forma::Caja { c: [c.c[0] as f32, c.c[1] as f32, c.c[2] as f32], e: e.map(|v| [v[0] as f32, v[1] as f32, v[2] as f32]), h: [c.h[0] as f32, c.h[1] as f32, c.h[2] as f32] };
            let aabb = jxjuego::mundo::aabb_de(&f); cuerpos.push(jxjuego::mundo::Cuerpo { f, aabb });
        }
        let g = mp.mundo.gravedad; mp.mundo = jxjuego::mundo::Mundo::nuevo(tris, cuerpos, g);
        // (hormigón liso y claro, el grafito y el amarillo luminoso: tres llamadas de dibujo)
        let mut datos = vec![]; let mut mallas = vec![]; let mut items = vec![];
        let mats = vec![jxjuego::geo::mat_propio(PLAZA_MAT, piso, [0.82, 0.0, 0.04], [0.0; 3]), jxjuego::geo::mat_propio(PLAZA_MAT - 1, graf, [0.55, 0.15, 0.05], [0.0; 3]), jxjuego::geo::mat_propio(PLAZA_MAT - 2, [1.0, 0.74, 0.16], [0.4, 0.0, 0.04], [2.4, 1.55, 0.25])];
        for (k, g) in [&pl.s, &pl.g, &pl.a].into_iter().enumerate() {
            let ml = g.malla(PLAZA_MALLA - k as i64, &mut datos); let n = ml.ni; let e = g.esfera_env(); mallas.push(ml);
            items.push(ItemDin { m: PLAZA_MALLA - k as i64, s0: 0, sn: n, mat: PLAZA_MAT - k as i64, mm: m4::id(), esf: e, fl: 0, h: vec![] });
        }
        let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas, mats, texs: vec![], lms: vec![], items: vec![], agua: None, cielo: None };
        if unsafe { m.cargar(&Escena { c: cab, datos }) }.is_ok() { self.pjs.plaza = Some(PlazaViva { items, luz: [pl.luz[0] as f32, pl.luz[1] as f32, pl.luz[2] as f32] }); }
    }

    // ---------------- cada cuadro ----------------
    pub(super) unsafe fn pjs_cuadro(&mut self, m: &mut Motor3d, dt: f32) {
        self.pjs.t += dt;
        // (la skin elegida en otro lado —el panel de Personajes del inicio— queda guardada también acá, salvo una prestada)
        if self.pjs.cargado && self.jg.skin_pedido.is_none() && self.skin != self.pjs.prefs.skin { self.pjs.prefs.skin = self.skin.clone(); self.pjs_guardar(); }
        if self.mapa.is_none() { return; }
        self.pjs_iconos(m);
        // (otro personaje elegido: el cuerpo nuevo, como jg_skin)
        if std::mem::take(&mut self.pjs.rearmar) { if let Some(paq) = self.paq.as_mut() {
            if let Ok((mut pj, e)) = personaje::Personaje::cargar(paq, &self.skin, 0, 512, &mut self.pj_cargados) { if let Some((a, b)) = &self.nado { let _ = pj.nado(a, b); } if m.cargar(&e).is_ok() { self.pj = Some(pj); self.emote = None; } }
        } }
        // el gorro propio (y su color)
        let g = self.pjs.prefs.gorro.clone();
        if self.pjs.gorro_listo.as_deref() != Some(g.as_str()) {
            if let Some(paq) = self.paq.as_mut() { let (_, e) = self.pjs.gorros.pedir(paq, &g, 512); if let Some(e) = e { let _ = m.cargar(&e); } }
            self.pjs.gorro_listo = Some(g.clone());
        }
        let col = self.pjs.prefs.gorro_aj.as_ref().map(|a| a.c.clone()).unwrap_or_default();
        if !col.is_empty() && self.pjs.tenido_listo.as_ref() != Some(&(g.clone(), col.clone())) { if let Some(e) = self.pjs.gorros.tenir(&g, &col) { let _ = m.cargar(&e); } self.pjs.tenido_listo = Some((g, col)); }
        // los gorros de los demás
        let rem: Vec<(String, String, Value)> = self.en_red.red.remotos().iter().filter(|r| r.visible).map(|r| (r.id.clone(), r.gorro.clone(), r.gorro_aj.clone())).collect();
        self.pjs.remotos.retain(|id, _| rem.iter().any(|r| &r.0 == id));
        for (id, gorro, ga) in rem {
            let aj = Ajuste::limpio(&ga);
            if let Some(paq) = self.paq.as_mut() { let (_, e) = self.pjs.gorros.pedir(paq, &gorro, 512); if let Some(e) = e { let _ = m.cargar(&e); } }
            if let Some(c) = aj.as_ref().map(|a| a.c.clone()).filter(|c| !c.is_empty()) { if let Some(e) = self.pjs.gorros.tenir(&gorro, &c) { let _ = m.cargar(&e); } }
            self.pjs.remotos.insert(id, (gorro, aj));
        }
        self.celu_cuadro(m, dt);
        self.emo_cuadro(m, dt);
        self.acc_cuadro(m, dt);
        self.panel_pj_camara();
        if let Some(c) = self.pjs.prueba_cam { self.jg.cam = Some(c); }
    }
    /// lo que se dibuja: la plaza, los gorros (el propio con el cuerpo a la vista y los de los demás), el celular y los
    /// accesorios
    pub(crate) fn pjs_items(&self, items: &mut Vec<ItemDin>, cam: [f32; 3], ver_cuerpo: bool) {
        if let Some(p) = &self.pjs.plaza { items.extend(p.items.iter().cloned()); }
        // (pateando en primera persona se ve el cuerpo sin la cabeza: sin gorro)
        let sin_cabeza = self.jg.cuerpo_en_primera() && self.camara == 0;
        if ver_cuerpo && !sin_cabeza { if let Some(pj) = &self.pj {
            if let Some(cab) = self.pj_cabeza_mundo(pj) {
                if let Some(Some(g)) = self.pjs.gorros.cargados.get(&self.pjs.prefs.gorro) { g.items(&cab, self.pjs.prefs.gorro_aj.as_ref(), &self.pjs.gorros.tenidos, items); }
                self.acc_items(None, pj, &cab, items);
            }
        } }
        for r in self.en_red.red.remotos() {
            if !r.visible { continue; }
            let Some((pj, _)) = self.en_red.cuerpos.get(&r.id) else { continue };
            let b = pj.base_sentado().unwrap_or_else(|| personaje::base([r.pos[0] as f32, r.pos[1] as f32 - 0.95, r.pos[2] as f32], r.yaw as f32));
            let Some(h) = pj.hueso("Head") else { continue }; let cab = m4::mul(&b, &h);
            if let Some((gorro, aj)) = self.pjs.remotos.get(&r.id) { if let Some(Some(g)) = self.pjs.gorros.cargados.get(gorro) { g.items(&cab, aj.as_ref(), &self.pjs.gorros.tenidos, items); } }
            self.acc_items(Some(&r.id), pj, &cab, items);
        }
        self.celu_items(items, cam, ver_cuerpo);
    }
    /// la cabeza del jugador en el mundo (W[Head] con la raíz donde se dibuja)
    pub(crate) fn pj_cabeza_mundo(&self, pj: &Personaje) -> Option<M4> {
        let jp = self.jug.pos; let b = pj.base_sentado().unwrap_or_else(|| personaje::base([jp[0], jp[1] - 0.95, jp[2]], self.jug.yaw));
        Some(m4::mul(&b, &pj.hueso("Head")?))
    }
    /// las luces de acá (la de la plaza, como luzPuntual(…, 12, [2.2, 1.5, 0.35]))
    pub(crate) fn pjs_luces(&self, luces: &mut Vec<LuzP>, ojos: [f32; 3]) {
        if let Some(p) = &self.pjs.plaza { let d = ((p.luz[0] - ojos[0]).powi(2) + (p.luz[2] - ojos[2]).powi(2)).sqrt(); if d < 90.0 && luces.len() < 8 { luces.push([p.luz[0], p.luz[1], p.luz[2], 12.0, 2.2, 1.5, 0.35, 0.0, 0.0, -1.0, 0.0, -2.0]); } }
    }

    // ---------------- los botones ----------------
    pub(crate) fn pj_visible(&self, b: Bp) -> bool {
        match b { Bp::Celular => self.mapa.is_some() && self.armas_tiene_celu() }
    }
    pub(crate) fn pj_etiqueta(&self, b: Bp) -> (&'static str, bool) {
        // (sin nombre: el ícono del celular, como el botón de la web)
        match b { Bp::Celular => ("", self.armas.def().tipo == "celu") }
    }
    pub(crate) fn pj_boton(&mut self, b: Bp) {
        match b {
            Bp::Celular => self.celm_sacar(),
        }
    }
    /// el celular viene instalado y prendido: está en la lista de armas
    pub(crate) fn armas_tiene_celu(&self) -> bool { ARMAS.iter().any(|a| a.tipo == "celu") }

    // ---------------- el panel de Personaje (panelPersonajes de rbmenus.js) ----------------
    /// abrir el panel de Personaje en una pestaña (para el menú de pausa de otros: es el mismo panel)
    /// (para las pruebas) entrar a una sala como desde el panel de salas, y el mapa de ahora
    pub fn pj_entrar_sala(&mut self, s: &jxjuego::red::Sala) { self.entrar_sala_con(s, None); }
    pub fn pj_mapa_actual(&self) -> String { self.mapas.get(self.mapa_i).cloned().unwrap_or_default() }
    /// (para las pruebas) la captura que está haciendo el cuerpo de otro jugador
    pub fn pj_captura_remota(&self, id: &str) -> Option<String> { self.en_red.cuerpos.get(id).and_then(|c| c.0.captura()).map(|c| c.0.to_string()) }
    /// el último aviso que se mostró (para las pruebas)
    pub fn pj_aviso(&self) -> Option<String> { self.aviso.as_ref().map(|a| a.0.clone()) }
    /// la tarjeta Personaje de la pausa (pjjAbrir, jugando): el panel con el escenario en el mapa
    pub fn pj_abrir_desde_pausa(&mut self) { self.pj_abrir_panel(Tab::Skin); if let Some(p) = self.pjs.panel.as_mut() { p.desde_pausa = true; } }
    pub fn pj_abrir_panel(&mut self, tab: Tab) {
        self.menu = None; self.emotes_panel = false; self.pjs.panel_aa = None;
        self.pjs.panel = Some(PanelPj { tab, yaw: std::f32::consts::PI + 0.25, ..Default::default() });
    }
    /// la lista de la pestaña con el buscador aplicado (por el nombre que se ve)
    fn panel_lista(&self, tab: Tab, q: &str) -> Vec<String> {
        let Some(paq) = &self.paq else { return vec![] }; let q = q.to_lowercase();
        let l: Vec<String> = match tab { Tab::Skin => paq.d["chars"].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default(), Tab::Gorro => Gorros::lista(&paq.d) };
        l.into_iter().filter(|s| q.is_empty() || match tab { Tab::Skin => identidad::skin_nom(s), Tab::Gorro => gorros::nombre(s) }.to_lowercase().contains(&q)).collect()
    }
    /// el skin del jugador (pjElegirSkin): se guarda y el cuerpo se rearma (si el Cíclope tiene puesto el suyo, cuando termine)
    pub fn pj_poner_skin(&mut self, s: &str) {
        self.pjs.prefs.skin = s.to_string(); self.pjs_guardar();
        if self.jg.skin_pedido.is_some() { self.jg.skin_antes = Some(s.to_string()); return; }
        self.skin = s.to_string(); self.pjs.rearmar = true;
    }
    /// los gorros que se pueden elegir
    pub fn gorros_lista(&self) -> Vec<String> { self.paq.as_ref().map(|p| Gorros::lista(&p.d)).unwrap_or_default() }
    pub fn pj_poner_gorro(&mut self, g: &str) { self.pjs.prefs.gorro = g.to_string(); self.pjs_guardar(); }
}

// ---------------- los íconos (atlas en el motor) ----------------
/// los íconos propios dibujados con vectores (vectores.rs): las apps del celular y el botón del celular
pub const ICONOS: [&str; 8] = ["props", "memes", "gente", "emotes", "camara", "mods", "ajustes", "celular"];
pub fn ico_idx(n: &str) -> u32 { ICONOS.iter().position(|x| *x == n).unwrap_or(0) as u32 }
impl Juego {
    /// sube una vez (por mapa) los retratos teñidos, los íconos de los gorros y los vectoriales
    unsafe fn pjs_iconos(&mut self, m: &mut Motor3d) {
        let Some(paq) = self.paq.as_ref() else { return };
        if !self.pjs.ico_ok {
            let n = ICONOS.len() as u32; let (aw, ah) = (ICO_COLS * ICO, (n.div_ceil(ICO_COLS) * ICO).next_power_of_two()); let mut px = vec![0u8; (aw * ah * 4) as usize];
            for (k, nm) in ICONOS.iter().enumerate() { atlas_celda(&mut px, aw, k as u32, &vectores::icono(nm, ICO as usize), ICO); }
            self.pjs.ico_ok = subir_tex(m, TEX_ICO, aw, ah, px);
        }
        // (los retratos y los gorros sólo cuando hace falta verlos: con el panel o el celular abierto)
        let quiere = self.pjs.panel.is_some() || self.pjs.celu.abierto();
        if quiere && self.pjs.retratos.is_none() {
            let chars: Vec<String> = paq.d["chars"].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
            let (aw, ah) = (ICO_COLS * ICO, ((chars.len() as u32).div_ceil(ICO_COLS).max(1) * ICO).next_power_of_two()); let mut px = vec![0u8; (aw * ah * 4) as usize];
            for (k, s) in chars.iter().enumerate() {
                let clave = retrato_clave(s);
                let Some((w, h, mut rgba)) = [clave.clone(), s.clone(), s.to_lowercase()].iter().find_map(|c| icono_crudo(paq, c)) else { continue };
                identidad::tenir_retrato(s, w, h, &mut rgba);
                atlas_celda(&mut px, aw, k as u32, &encuadrar(w, h, &rgba, ICO as usize), ICO);
            }
            subir_tex(m, TEX_RETRATOS, aw, ah, px); self.pjs.retratos = Some(chars);
        }
        if quiere && self.pjs.gorros_ico.is_none() {
            let l = Gorros::lista(&paq.d);
            let (aw, ah) = (ICO_COLS * ICO, ((l.len() as u32).div_ceil(ICO_COLS).max(1) * ICO).next_power_of_two()); let mut px = vec![0u8; (aw * ah * 4) as usize];
            for (k, s) in l.iter().enumerate() {
                if s == "HatEmpty" { continue; }
                let ic = if paq.d["ico"][s].is_string() { icono_crudo(paq, s).map(|(w, h, p)| encuadrar(w, h, &p, ICO as usize)) }
                    else if let Some((gk, _)) = gorros::receta(s) { Some(gorros::icono_gn(gk, ICO as usize)) } else { icono_crudo(paq, "western-hat").map(|(w, h, p)| encuadrar(w, h, &p, ICO as usize)) };
                if let Some(ic) = ic { atlas_celda(&mut px, aw, k as u32, &ic, ICO); }
            }
            subir_tex(m, TEX_GORROS, aw, ah, px); self.pjs.gorros_ico = Some(l);
        }
    }
}

// ---------------- el panel de Personaje: dónde va cada cosa ----------------
/// lo que se toca en el panel
#[derive(Clone, Debug, PartialEq)]
pub enum Tp { Tab(Tab), Buscar, Volver, Carta(usize), Barra(u8), Color(usize), Hex, Reset, AccImportar, AccArchivo(usize), AccPoner(usize), AccBorrar(usize), AccBarra(u8), AccSacar, ArmaAj, Escena }
/// la geometría del panel con la pantalla de w × h: el panel (izquierda), el escenario (derecha) y cada cosa
pub struct GeoPj { pub css: f32, pub izq: [f32; 4], pub esc: [f32; 4], pub lista: [f32; 4], pub caja: Option<[f32; 4]>, pub celda: f32, pub cols: usize, pub cosas: Vec<(Tp, [f32; 4])> }
pub fn geo_panel_pj(w: f32, h: f32, p: &PanelPj, n: usize, acc_n: usize, acc_arch: usize, con_acc: bool) -> GeoPj {
    // (1 px de CSS: el celular apaisado de la web mide 393 de alto)
    let css = h / 393.0; let esc_w = (w * 0.3).clamp(190.0 * css, 420.0 * css); let iw = w - esc_w;
    let (cab, pie) = (44.0 * css, 40.0 * css);
    let izq = [0.0, 0.0, iw, h]; let esc = [iw, 0.0, esc_w, h];
    let mut cosas = vec![];
    // la cabecera: las pestañas y el buscador
    let tw = 92.0 * css;
    cosas.push((Tp::Tab(Tab::Skin), [8.0 * css, 7.0 * css, tw, cab - 14.0 * css])); cosas.push((Tp::Tab(Tab::Gorro), [8.0 * css + tw + 3.0 * css, 7.0 * css, tw, cab - 14.0 * css]));
    let bw = (iw - (8.0 * css + tw * 2.0 + 20.0 * css)).clamp(110.0 * css, 380.0 * css); cosas.push((Tp::Buscar, [iw - bw - 8.0 * css, 7.0 * css, bw, cab - 14.0 * css]));
    // el pie: Volver (y Arma en la mano)
    cosas.push((Tp::Volver, [8.0 * css, h - pie + 6.0 * css, 104.0 * css, pie - 12.0 * css]));
    cosas.push((Tp::ArmaAj, [8.0 * css + 112.0 * css, h - pie + 6.0 * css, 130.0 * css, pie - 12.0 * css]));
    let mut lista = [0.0, cab, iw, h - cab - pie];
    // (gorros: la personalización a la derecha de la grilla)
    let mut caja = None;
    if p.tab == Tab::Gorro {
        let cw = (iw * 0.42).clamp(200.0 * css, 300.0 * css); let c = [iw - cw, cab, cw, h - cab - pie]; lista[2] = iw - cw; caja = Some(c);
        let (x, mut y, an) = (c[0] + 10.0 * css, c[1] + 8.0 * css - p.scroll_caja(), cw - 20.0 * css); let fila = 30.0 * css;
        y += 22.0 * css; // (el título)
        for k in 0..4u8 { if k == 1 { y += 24.0 * css; } cosas.push((Tp::Barra(k), [x, y, an, fila])); y += fila; }
        y += 24.0 * css; let sw = (an / 6.0).min(36.0 * css);
        for k in 0..gorros::COLORES.len() { let (f, cc) = (k / 6, k % 6); cosas.push((Tp::Color(k), [x + cc as f32 * sw, y + f as f32 * sw, sw * 0.9, sw * 0.9])); }
        y += sw * 2.0 + 4.0 * css;
        cosas.push((Tp::Hex, [x, y, an * 0.55, 26.0 * css])); cosas.push((Tp::Reset, [x + an * 0.58, y, an * 0.42, 26.0 * css])); y += 34.0 * css;
        // el accesorio importado
        y += 40.0 * css;
        cosas.push((Tp::AccImportar, [x, y, an, 26.0 * css])); y += 32.0 * css;
        for k in 0..acc_arch { cosas.push((Tp::AccArchivo(k), [x, y, an, 24.0 * css])); y += 27.0 * css; }
        for k in 0..acc_n { cosas.push((Tp::AccPoner(k), [x, y, an - 30.0 * css, 24.0 * css])); cosas.push((Tp::AccBorrar(k), [x + an - 26.0 * css, y, 26.0 * css, 24.0 * css])); y += 27.0 * css; }
        if con_acc { for k in 0..7u8 { cosas.push((Tp::AccBarra(k), [x, y, an, fila])); y += fila; } cosas.push((Tp::AccSacar, [x, y + 2.0 * css, an * 0.6, 26.0 * css])); }
    }
    // la grilla de cartas (minmax(16vh, 1fr), 8 px entre ellas, 10 px de borde)
    let pad = 10.0 * css; let gap = 8.0 * css; let min = if p.tab == Tab::Gorro { (h * 0.14).clamp(74.0 * css, 130.0 * css) } else { h * 0.16 };
    let cols = (((lista[2] - pad * 2.0 + gap) / (min + gap)).floor() as usize).max(1); let celda = (lista[2] - pad * 2.0 - gap * (cols as f32 - 1.0)) / cols as f32;
    let alto = celda + 26.0 * css;
    for k in 0..n {
        let (f, c) = (k / cols, k % cols); let r = [lista[0] + pad + c as f32 * (celda + gap), lista[1] + pad + f as f32 * (alto + gap) - p.scroll, celda, alto];
        if r[1] + r[3] < lista[1] || r[1] > lista[1] + lista[3] { continue; }
        cosas.push((Tp::Carta(k), r));
    }
    cosas.push((Tp::Escena, esc));
    GeoPj { css, izq, esc, lista, caja, celda, cols, cosas }
}
impl PanelPj { pub fn scroll_caja(&self) -> f32 { 0.0 } }

/// las barras del ajuste del gorro: clave, nombre, desde, hasta, paso, unidad
const BARRAS_GA: [(&str, &str, f32, f32, f32, &str); 4] = [("s", "Tamaño", 50.0, 160.0, 5.0, "%"), ("x", "X", -15.0, 15.0, 1.0, " cm"), ("y", "Y", -15.0, 15.0, 1.0, " cm"), ("z", "Z", -15.0, 15.0, 1.0, " cm")];
fn ga_valor(g: &Ajuste, k: usize) -> f32 { match k { 0 => (g.s * 100.0).round() as f32, 1 => g.x as f32, 2 => g.y as f32, _ => g.z as f32 } }
fn ga_poner(g: &mut Ajuste, k: usize, v: f32) { match k { 0 => g.s = v as f64 / 100.0, 1 => g.x = v as f64, 2 => g.y = v as f64, _ => g.z = v as f64 } }

impl Juego {
    /// el escenario: la cámara mira al personaje de frente desde el lado del escenario (el personaje queda en el medio de
    /// la parte derecha) y arrastrar lo gira (MENU.yaw)
    fn panel_pj_camara(&mut self) {
        let Some(p) = &self.pjs.panel else { return };
        let Some(pj) = &self.pj else { return };
        // (lobbyEncuadre: el personaje llena el escenario del 17 % al 92 % del alto, centrado a lo ancho; si es angosto, que
        // entre a lo ancho. Su alto y ancho, de los huesos —lobbyMedir—: la coronilla, más el gorro; las manos o los hombros)
        let k = if pj.tam > 0.0 { pj.tam } else { 1.0 };
        let (nombres, _, w) = pj.esqueleto();
        let hy = |n: &str| nombres.iter().position(|x| x.rsplit(':').next() == Some(n)).map(|i| w[i]);
        let (tope, cab) = (hy("HeadTop_End").map(|m| m[13]), hy("Head").map(|m| m[13]));
        let mut top = match (tope, cab) { (Some(t), Some(c)) if t > c => t + 0.02 * k, (_, Some(c)) => c + 0.2 * k, _ => 1.8 * k };
        if !self.pjs.prefs.gorro.is_empty() && self.pjs.prefs.gorro != "HatEmpty" { top += 0.12 * k; }
        let brazo = |a: &str, b: &str| match (hy(a), hy(b)) { (Some(x), Some(y)) => (x[12] - y[12]).hypot(x[14] - y[14]), _ => 0.0 };
        let alto = top.max(0.6 * k); let ancho = (0.45 * k).max(brazo("LeftHand", "RightHand") + 0.16 * k).max(brazo("LeftShoulder", "RightShoulder") + 0.3 * k);
        let (sw, sh) = self.pjs.celu.pantalla; let g = geo_panel_pj(sw, sh, p, 0, 0, 0, false); let r = g.esc;
        let fovy = if self.fov_b > 0.0 { self.fov_b } else { self.aj.fov as f32 }.to_radians(); let tv = (fovy / 2.0).tan(); let asp = sw / sh.max(1.0);
        let px = ((0.92 - 0.17) * r[3]).min(r[2] * 0.62 * alto / ancho).max(1.0);
        let z = alto * sh / (2.0 * tv * px); let pies = r[1] + 0.92 * r[3];
        let (nx, ny) = (((r[0] + r[2] / 2.0) / sw.max(1.0)) * 2.0 - 1.0, 1.0 - (pies / sh.max(1.0)) * 2.0);
        // (la cámara a nivel, a la distancia que hace falta y girada para que el personaje quede en el medio del escenario:
        // de frente igual, mirando desde donde dice MENU.yaw)
        let xc = nx * z * tv * asp; let dd = z.hypot(xc); let th = xc.atan2(z);
        let jp = self.jug.pos; let pie_y = jp[1] - 0.95;
        let yaw = self.jug.yaw + p.yaw - std::f32::consts::PI; let f = [yaw.sin(), 0.0, yaw.cos()];
        let cam = [jp[0] + f[0] * dd, pie_y - ny * z * tv, jp[2] + f[2] * dd];
        let (s, c) = (th.sin(), th.cos()); let mira = [-f[0] * c - f[2] * s, 0.0, f[0] * s - f[2] * c];
        self.jg.cam = Some((cam, mira));
    }
    /// un toque en el panel de Personaje
    fn panel_pj_toque(&mut self, x: f32, y: f32, w: f32, h: f32) {
        let Some(p) = self.pjs.panel.clone() else { return };
        let lista = self.panel_lista(p.tab, &p.q[p.tab as usize]); let (an, aa) = (self.pjs.acc.lista.len(), self.pjs.acc.archivos.len());
        let g = geo_panel_pj(w, h, &p, lista.len(), an, if self.pjs.acc.ver_archivos { aa } else { 0 }, self.pjs.prefs.acc.is_some());
        let Some(t) = g.cosas.iter().find(|(t, r)| *t != Tp::Escena && dentro(x, y, *r)).map(|c| c.0.clone()) else { return };
        self.sonido.tocar("Click", 0.5, 1.0, None);
        match t {
            Tp::Tab(k) => { if let Some(pp) = self.pjs.panel.as_mut() { pp.tab = k; pp.scroll = 0.0; } }
            Tp::Buscar => { let q = p.q[p.tab as usize].clone(); self.pedir_texto(Escribir::Pj, if p.tab == Tab::Gorro { "Buscar gorro…" } else { "Buscar personaje…" }, &q, 30, false); self.pjs.celu.escribe = Some(celu_juego::Escribe::BuscarPj); }
            // (abierto desde la pausa, Volver vuelve a ella: pjjVolverPausa)
            Tp::Volver => { self.pjs.panel = None; if p.desde_pausa { self.pz_abrir(); } }
            Tp::ArmaAj => self.arma_aj_abrir(),
            Tp::Carta(k) => { if let Some(s) = lista.get(k).cloned() { match p.tab { Tab::Skin => self.pj_poner_skin(&s), Tab::Gorro => self.pj_poner_gorro(&s) } } }
            Tp::Color(k) => { let mut g = self.pjs.prefs.gorro_aj.clone().unwrap_or_default(); g.c = gorros::COLORES[k].to_string(); self.pjs.prefs.gorro_aj = Ajuste::limpio(&g.json()); self.pjs_guardar(); }
            Tp::Hex => { let c = self.pjs.prefs.gorro_aj.as_ref().map(|g| g.c.trim_start_matches('#').to_string()).unwrap_or_default(); self.pedir_texto(Escribir::Pj, "Color del gorro (rrggbb)", &c, 6, false); self.pjs.celu.escribe = Some(celu_juego::Escribe::HexGorro); }
            Tp::Reset => { self.pjs.prefs.gorro_aj = None; self.pjs_guardar(); }
            Tp::AccImportar => self.acc_importar_boton(),
            Tp::AccArchivo(k) => self.acc_importar(k),
            Tp::AccPoner(k) => self.acc_poner(k),
            Tp::AccBorrar(k) => self.acc_borrar(k),
            Tp::AccSacar => { self.pjs.prefs.acc = None; self.pjs_guardar(); }
            Tp::Barra(_) | Tp::AccBarra(_) | Tp::Escena => {}
        }
    }
    /// arrastrar en el panel: una barra, girar el personaje en el escenario o bajar la lista
    fn panel_pj_mueve(&mut self, id: i32, x: f32, y: f32, w: f32, h: f32) {
        let Some(p) = self.pjs.panel.clone() else { return };
        let Some(d) = self.dedos.iter().find(|d| d.id == id) else { return }; let (x0, y0, px, py) = (d.x0, d.y0, d.x, d.y);
        let lista = self.panel_lista(p.tab, &p.q[p.tab as usize]);
        let g = geo_panel_pj(w, h, &p, lista.len(), self.pjs.acc.lista.len(), if self.pjs.acc.ver_archivos { self.pjs.acc.archivos.len() } else { 0 }, self.pjs.prefs.acc.is_some());
        let en = g.cosas.iter().find(|(t, r)| dentro(x0, y0, *r) && matches!(t, Tp::Barra(_) | Tp::AccBarra(_) | Tp::Escena)).cloned();
        match en {
            Some((Tp::Barra(k), r)) => {
                let (_, _, lo, hi, paso, _) = BARRAS_GA[k as usize]; let pista = [r[0] + r[2] * 0.3, r[2] * 0.5];
                let v = (lo + ((x - pista[0]) / pista[1]).clamp(0.0, 1.0) * (hi - lo)) / paso; let v = v.round() * paso;
                let mut ga = self.pjs.prefs.gorro_aj.clone().unwrap_or_default(); ga_poner(&mut ga, k as usize, v); self.pjs.prefs.gorro_aj = Ajuste::limpio(&ga.json());
                self.pjs.celu.guardar_t = 0.3;
            }
            Some((Tp::AccBarra(k), r)) => { let pista = [r[0] + r[2] * 0.3, r[2] * 0.5]; self.acc_barra(k as usize, ((x - pista[0]) / pista[1]).clamp(0.0, 1.0)); self.pjs.celu.guardar_t = 0.3; }
            Some((Tp::Escena, _)) => { if let Some(pp) = self.pjs.panel.as_mut() { pp.yaw -= (x - px) * 0.012 * 393.0 / h; } }
            _ => {
                // (bajar la lista o la caja de la derecha)
                if let Some(pp) = self.pjs.panel.as_mut() { pp.scroll = (pp.scroll - (y - py)).max(0.0); }
            }
        }
        if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) { d.x = x; d.y = y; }
    }
    /// el panel de Personaje dibujado
    fn panel_pj_hud(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32, otras: &mut Vec<(i64, Vec<f32>)>) {
        let Some(p) = &self.pjs.panel else { return };
        let lista = self.panel_lista(p.tab, &p.q[p.tab as usize]);
        let g = geo_panel_pj(wf, hf, p, lista.len(), self.pjs.acc.lista.len(), if self.pjs.acc.ver_archivos { self.pjs.acc.archivos.len() } else { 0 }, self.pjs.prefs.acc.is_some());
        let css = g.css; let am = [0.949, 0.702, 0.106, 1.0]; let bl = [1.0, 1.0, 1.0, 1.0]; let t2 = [1.0, 1.0, 1.0, 0.62]; let tf = 13.0 * css;
        // (el fondo de la izquierda; la cabecera y el pie más oscuros)
        l.rect(u, g.izq[0], g.izq[1], g.izq[2], g.izq[3], [16.0 / 255.0, 17.0 / 255.0, 19.0 / 255.0, 0.97]);
        l.rect(u, 0.0, hf - 40.0 * css, g.izq[2], 40.0 * css, [18.0 / 255.0, 19.0 / 255.0, 21.0 / 255.0, 1.0]);
        l.rect(u, g.esc[0], 0.0, 1.0, hf, [1.0, 1.0, 1.0, 0.12]);
        let mut ret: Vec<f32> = vec![]; let mut gor: Vec<f32> = vec![];
        let (sel_skin, sel_gorro) = (self.skin.clone(), self.pjs.prefs.gorro.clone());
        for (t, r) in &g.cosas {
            match t {
                Tp::Tab(k) => { let s = *k == p.tab; l.caja(u, r[0], r[1], r[2], r[3], 4.0 * css, if s { am } else { [1.0, 1.0, 1.0, 0.06] });
                    texto_cabe(l, u, r[0] + 6.0 * css, r[1] + (r[3] - tf) / 2.0 - 1.0, tf, r[2] - 12.0 * css, if s { [0.0, 0.0, 0.0, 1.0] } else { bl }, if *k == Tab::Skin { "Personajes" } else { "Gorros" }, true); }
                Tp::Buscar => { l.caja(u, r[0], r[1], r[2], r[3], 0.0, [1.0, 1.0, 1.0, 0.07]); let q = &p.q[p.tab as usize];
                    let txt = if q.is_empty() { if p.tab == Tab::Gorro { "Buscar gorro…" } else { "Buscar personaje…" } } else { q.as_str() };
                    texto_cabe(l, u, r[0] + 10.0 * css, r[1] + (r[3] - tf) / 2.0 - 1.0, tf, r[2] - 20.0 * css, if q.is_empty() { [1.0, 1.0, 1.0, 0.45] } else { bl }, txt, false); }
                Tp::Volver | Tp::ArmaAj => { l.caja(u, r[0], r[1], r[2], r[3], 4.0 * css, [1.0, 1.0, 1.0, 0.1]); texto_cabe(l, u, r[0], r[1] + (r[3] - tf) / 2.0 - 1.0, tf, r[2], bl, if *t == Tp::Volver { "Volver" } else { "Arma en la mano" }, true); }
                Tp::Carta(k) => {
                    let Some(s) = lista.get(*k) else { continue };
                    // (la grilla baja dentro de su caja, como overflow:auto: lo que sale arriba o abajo no se ve)
                    let (y0, y1) = (g.lista[1], g.lista[1] + g.lista[3]); if r[1] >= y1 || r[1] + r[3] <= y0 { continue; }
                    let clip = |a: [f32; 4]| -> Option<[f32; 4]> { let (t, b) = (a[1].max(y0), (a[1] + a[3]).min(y1)); if b <= t { None } else { Some([a[0], t, a[2], b - t]) } };
                    let sel = match p.tab { Tab::Skin => *s == sel_skin, Tab::Gorro => *s == sel_gorro };
                    let entera = r[1] >= y0 && r[1] + r[3] <= y1;
                    if let Some(rc) = clip(*r) { l.caja(u, rc[0], rc[1], rc[2], rc[3], if entera { 6.0 * css } else { 0.0 }, if sel { [242.0 / 255.0, 179.0 / 255.0, 27.0 / 255.0, 0.1] } else { [1.0, 1.0, 1.0, 0.04] }); }
                    if sel { for (a, b) in [([r[0], r[1]], [r[0] + r[2], r[1]]), ([r[0] + r[2], r[1]], [r[0] + r[2], r[1] + r[3]]), ([r[0] + r[2], r[1] + r[3]], [r[0], r[1] + r[3]]), ([r[0], r[1] + r[3]], [r[0], r[1]])] {
                        // (las horizontales, si están adentro; las verticales, recortadas)
                        if a[1] == b[1] { if a[1] >= y0 && a[1] <= y1 { linea(l, u, a, b, 2.0 * css, am); } continue; }
                        let (ta, tb) = (a[1].clamp(y0, y1), b[1].clamp(y0, y1)); if (tb - ta).abs() > 0.5 { linea(l, u, [a[0], ta], [b[0], tb], 2.0 * css, am); } } }
                    let f = [r[0] + 5.0 * css, r[1] + 5.0 * css, r[2] - 10.0 * css, r[2] - 10.0 * css];
                    if let Some(fc) = clip(f) {
                        l.caja(u, fc[0], fc[1], fc[2], fc[3], if fc[3] >= f[3] - 0.5 { 6.0 * css } else { 0.0 }, if p.tab == Tab::Gorro { [0.561, 0.573, 0.588, 1.0] } else { [1.0, 1.0, 1.0, 0.06] });
                        // (el retrato o el ícono, recortado igual: también su parte de la textura)
                        let uvc = |uv: [f32; 4]| { let (a, b) = ((fc[1] - f[1]) / f[3], (fc[1] + fc[3] - f[1]) / f[3]); [uv[0], uv[1] + (uv[3] - uv[1]) * a, uv[2], uv[1] + (uv[3] - uv[1]) * b] };
                        match p.tab {
                            Tab::Skin => if let Some(i) = self.pjs.retratos.as_ref().and_then(|v| v.iter().position(|x| x == s)) { rect_uv(&mut ret, fc[0], fc[1], fc[2], fc[3], uvc(uv_celda(i as u32, ICO, (ICO_COLS * ICO) as f32, self.atlas_alto(self.pjs.retratos.as_ref().map(|v| v.len()).unwrap_or(1)))), [1.0; 4]); },
                            Tab::Gorro => if s == "HatEmpty" { if fc[3] >= f[3] - 0.5 { glifo_no(l, u, f[0] + f[2] / 2.0, f[1] + f[3] / 2.0, f[2] * 0.21, [1.0, 1.0, 1.0, 0.55]); } }
                                else if let Some(i) = self.pjs.gorros_ico.as_ref().and_then(|v| v.iter().position(|x| x == s)) { rect_uv(&mut gor, fc[0], fc[1], fc[2], fc[3], uvc(uv_celda(i as u32, ICO, (ICO_COLS * ICO) as f32, self.atlas_alto(self.pjs.gorros_ico.as_ref().map(|v| v.len()).unwrap_or(1)))), [1.0; 4]); },
                        }
                    }
                    let nom = match p.tab { Tab::Skin => identidad::skin_nom(s), Tab::Gorro => gorros::nombre(s) };
                    let ty = r[1] + r[2] - 2.0 * css; if ty >= y0 && ty + tf * 1.2 <= y1 { texto_cabe(l, u, r[0] + 4.0 * css, ty, tf, r[2] - 8.0 * css, bl, &nom, true); }
                    if sel && r[1] + 3.0 * css >= y0 && r[1] + 21.0 * css <= y1 { tilde(l, u, r[0] + r[2] - 12.0 * css, r[1] + 12.0 * css, 9.0 * css); }
                }
                _ => {}
            }
        }
        if lista.is_empty() { l.texto(u, g.lista[0] + 12.0 * css, g.lista[1] + 12.0 * css, tf, t2, "Sin resultados"); }
        if p.tab == Tab::Skin { let c = format!("{} personajes", lista.len()); let an = l.ancho(tf * 0.9, &c); l.texto(u, g.izq[2] - an - 12.0 * css, hf - 40.0 * css + (40.0 * css - tf) / 2.0, tf * 0.9, t2, &c); }
        // (la personalización del gorro y el accesorio, a la derecha de la grilla)
        if let Some(c) = g.caja {
            l.rect(u, c[0], c[1], 1.0, c[3], [1.0, 1.0, 1.0, 0.1]); l.rect(u, c[0] + 1.0, c[1], c[2] - 1.0, c[3], [0.0, 0.0, 0.0, 0.18]);
            let x = c[0] + 10.0 * css; let an = c[2] - 20.0 * css; let y = c[1] + 8.0 * css;
            l.texto(u, x, y, tf * 1.05, bl, "Personalización del gorro");
            let ga = self.pjs.prefs.gorro_aj.clone().unwrap_or_default();
            for (t, r) in &g.cosas {
                match t {
                    Tp::Barra(k) => { let (_, nom, lo, hi, _, un) = BARRAS_GA[*k as usize]; let v = ga_valor(&ga, *k as usize); barra(l, u, *r, css, nom, (v - lo) / (hi - lo), &format!("{v}{un}")); if *k == 0 { l.texto(u, x, r[1] + r[3] + 6.0 * css, tf * 0.85, t2, "MOVER POSICIÓN"); } }
                    Tp::Color(k) => { let cs = gorros::COLORES[*k]; let sel = ga.c == cs; let (cx, cy, rr) = (r[0] + r[2] / 2.0, r[1] + r[3] / 2.0, r[2] / 2.0);
                        if *k == 0 { l.texto(u, x, r[1] - 18.0 * css, tf * 0.85, t2, "COLOR DEL GORRO"); }
                        l.disco(u, cx, cy, rr, if sel { am } else { [1.0, 1.0, 1.0, 0.18] });
                        let col = Ajuste { c: cs.to_string(), ..Default::default() }.color().unwrap_or([0.173, 0.176, 0.2, 1.0]); l.disco(u, cx, cy, rr - 2.0 * css, col);
                        if cs.is_empty() { glifo_no(l, u, cx, cy, rr * 0.5, [1.0, 1.0, 1.0, 0.7]); } }
                    Tp::Hex => { l.caja(u, r[0], r[1], r[2], r[3], 4.0 * css, [1.0, 1.0, 1.0, 0.08]); l.texto(u, r[0] + 8.0 * css, r[1] + (r[3] - tf) / 2.0 - 1.0, tf, bl, &format!("# {}", if ga.c.is_empty() { "4c8bf5".into() } else { ga.c[1..].to_string() })); }
                    Tp::Reset | Tp::AccImportar | Tp::AccSacar => { l.caja(u, r[0], r[1], r[2], r[3], 4.0 * css, [1.0, 1.0, 1.0, 0.1]); texto_cabe(l, u, r[0], r[1] + (r[3] - tf) / 2.0 - 1.0, tf, r[2], bl, match t { Tp::Reset => "Restablecer", Tp::AccImportar => "Importar accesorio", _ => "Sacármelo" }, true);
                        if *t == Tp::AccImportar { l.texto(u, x, r[1] - 36.0 * css, tf * 1.05, bl, "Accesorio importado"); for (i, rr) in jugabilidad::partir(l, tf * 0.8, "Un casco o lo que quieras para la cabeza: GLB, GLTF, OBJ o el .zip de Sketchfab", an).iter().take(1).enumerate() { l.texto(u, x, r[1] - 18.0 * css + i as f32 * tf, tf * 0.8, t2, rr); }
                            if !self.pjs.acc.estado.is_empty() { for (i, rr) in jugabilidad::partir(l, tf * 0.8, &self.pjs.acc.estado, an).iter().take(3).enumerate() { l.texto(u, x, r[1] + r[3] + 2.0 * css + i as f32 * tf * 0.95, tf * 0.8, [1.0, 0.85, 0.5, 1.0], rr); } } } }
                    Tp::AccArchivo(k) => { if let Some(a) = self.pjs.acc.archivos.get(*k) { l.caja(u, r[0], r[1], r[2], r[3], 4.0 * css, [0.3, 0.45, 0.8, 0.35]); texto_cabe(l, u, r[0] + 6.0 * css, r[1] + (r[3] - tf) / 2.0 - 1.0, tf * 0.9, r[2] - 12.0 * css, bl, &a.0, false); } }
                    Tp::AccPoner(k) => { if let Some(a) = self.pjs.acc.lista.get(*k) { let sel = self.pjs.prefs.acc.as_ref().map(|x| x.id == a.id).unwrap_or(false);
                        l.caja(u, r[0], r[1], r[2], r[3], 12.0 * css, if sel { am } else { [1.0, 1.0, 1.0, 0.1] }); texto_cabe(l, u, r[0] + 8.0 * css, r[1] + (r[3] - tf) / 2.0 - 1.0, tf * 0.9, r[2] - 16.0 * css, if sel { [0.0, 0.0, 0.0, 1.0] } else { bl }, &a.n, false); } }
                    Tp::AccBorrar(_) => { glifo_no(l, u, r[0] + r[2] / 2.0, r[1] + r[3] / 2.0, r[3] * 0.3, [1.0, 0.5, 0.45, 1.0]); }
                    Tp::AccBarra(k) => { if let Some(a) = &self.pjs.prefs.acc { let (nom, f, txt) = accesorio::barra_info(a, *k as usize); barra(l, u, *r, css, nom, f, &txt); } }
                    _ => {}
                }
            }
        }
        // el escenario: el nombre del elegido (y su gorro) arriba, y cómo girarlo abajo
        let e = g.esc; let nom = identidad::skin_nom(&self.skin); let tn = 18.0 * css;
        l.texto_sombra(u, e[0] + 14.0 * css, 14.0 * css, tn, bl, &nom);
        if sel_gorro != "HatEmpty" && !sel_gorro.is_empty() { l.texto_sombra(u, e[0] + 14.0 * css, 14.0 * css + tn * 1.3, tf, t2, &format!("con {}", gorros::nombre(&sel_gorro))); }
        let gtxt = "Arrastrá para girarlo"; let ga = l.ancho(tf, gtxt); l.caja(u, e[0] + (e[2] - ga) / 2.0 - 10.0 * css, hf - 34.0 * css, ga + 20.0 * css, 24.0 * css, 12.0 * css, [0.0, 0.0, 0.0, 0.45]); l.texto(u, e[0] + (e[2] - ga) / 2.0, hf - 34.0 * css + 5.0 * css, tf, bl, gtxt);
        otras.push((TEX_RETRATOS, ret)); otras.push((TEX_GORROS, gor));
    }
    /// el alto de un atlas de n íconos
    pub(crate) fn atlas_alto(&self, n: usize) -> f32 { ((n as u32).div_ceil(ICO_COLS).max(1) * ICO).next_power_of_two() as f32 }

    // ---------------- el arma en la mano, a gusto (armaaj.js) ----------------
    pub fn arma_aj_abrir(&mut self) {
        if self.camara != 0 || self.vehs.jugador.is_some() || self.armas.def().tipo == "celu" { self.avisar("Sacá un arma en primera persona para ajustarla".into()); return; }
        self.pjs.panel = None; self.pjs.panel_aa = Some(PanelAa::default());
    }
    /// el corrimiento del arma de primera persona de ahora (armaAjDe), apagándose al apuntar: (posición, giro)
    pub fn arma_aj_matriz(&self) -> Option<M4> {
        let a = self.pjs.prefs.arma_aj.get(self.armas.def().n)?; let f = 1.0 - self.armas.ap_k; if f <= 0.001 { return None; }
        let g = -a.g.clamp(-ARMAJ_LIM[3], ARMAJ_LIM[3]).to_radians() * f;
        Some(mapa::trs([-a.x.clamp(-ARMAJ_LIM[0], ARMAJ_LIM[0]) * f, a.y.clamp(-ARMAJ_LIM[1], ARMAJ_LIM[1]) * f, a.z.clamp(-ARMAJ_LIM[2], ARMAJ_LIM[2]) * f], [0.0, (g / 2.0).sin(), 0.0, (g / 2.0).cos()], [1.0; 3]))
    }
    fn geo_aa(w: f32, h: f32) -> ([f32; 4], Vec<[f32; 4]>, [f32; 4], [f32; 4]) {
        let css = h / 393.0; let pw = (360.0 * css).min(w * 0.9); let ph = 250.0 * css; let (x0, y0) = ((w - pw) / 2.0, h - ph - 12.0 * css);
        let filas = (0..4).map(|k| [x0 + 14.0 * css, y0 + 50.0 * css + k as f32 * 36.0 * css, pw - 28.0 * css, 32.0 * css]).collect();
        ([x0, y0, pw, ph], filas, [x0 + 14.0 * css, y0 + ph - 44.0 * css, pw * 0.45, 32.0 * css], [x0 + pw * 0.52, y0 + ph - 44.0 * css, pw * 0.45 - 14.0 * css, 32.0 * css])
    }
    fn aa_toque(&mut self, x: f32, y: f32, w: f32, h: f32) {
        let (c, _, cero, listo) = Self::geo_aa(w, h);
        if dentro(x, y, cero) { self.pjs.prefs.arma_aj.remove(self.armas.def().n); self.pjs_guardar(); self.sonido.tocar("Click", 0.5, 1.0, None); return; }
        if dentro(x, y, listo) || !dentro(x, y, c) || (x > c[0] + c[2] - h * 0.08 && y < c[1] + h * 0.08) { self.pjs.panel_aa = None; self.pjs_guardar(); }
    }
    fn aa_mueve(&mut self, id: i32, x: f32, w: f32, h: f32) {
        let Some(d) = self.dedos.iter().find(|d| d.id == id) else { return }; let (x0, y0) = (d.x0, d.y0);
        let (_, filas, _, _) = Self::geo_aa(w, h);
        let Some(k) = filas.iter().position(|r| dentro(x0, y0, *r)) else { return }; let r = filas[k];
        let v = ((x - (r[0] + r[2] * 0.3)) / (r[2] * 0.5)).clamp(0.0, 1.0) * 2.0 - 1.0; let v = (v / 0.02).round() * 0.02;
        // (el orden de la web: adelante, costado, altura y giro)
        let n = self.armas.def().n.to_string(); let a = self.pjs.prefs.arma_aj.entry(n.clone()).or_default();
        match k { 0 => a.z = v * ARMAJ_LIM[2], 1 => a.x = v * ARMAJ_LIM[0], 2 => a.y = v * ARMAJ_LIM[1], _ => a.g = (v * ARMAJ_LIM[3] * 10.0).round() / 10.0 }
        if *a == ArmaAj::default() { self.pjs.prefs.arma_aj.remove(&n); }
        if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) { d.x = x; }
    }
    fn aa_hud(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32) {
        if self.pjs.panel_aa.is_none() { return; }
        let css = hf / 393.0; let (c, filas, cero, listo) = Self::geo_aa(wf, hf); let tf = 13.0 * css; let bl = [1.0; 4];
        l.caja(u, c[0], c[1], c[2], c[3], 10.0 * css, [0.07, 0.08, 0.11, 0.94]);
        l.texto(u, c[0] + 14.0 * css, c[1] + 12.0 * css, tf * 1.15, bl, "Arma en la mano"); let an = l.ancho(tf, self.armas.def().nom); l.texto(u, c[0] + c[2] - an - 40.0 * css, c[1] + 14.0 * css, tf, [0.949, 0.702, 0.106, 1.0], self.armas.def().nom);
        cruz_x(l, u, c[0] + c[2] - 18.0 * css, c[1] + 20.0 * css, 6.0 * css, 2.0 * css, bl);
        let a = self.pjs.prefs.arma_aj.get(self.armas.def().n).copied().unwrap_or_default();
        for (k, r) in filas.iter().enumerate() {
            let (nom, v, lim) = match k { 0 => ("Adelante", a.z, ARMAJ_LIM[2]), 1 => ("Costado", a.x, ARMAJ_LIM[0]), 2 => ("Altura", a.y, ARMAJ_LIM[1]), _ => ("Giro", a.g, ARMAJ_LIM[3]) };
            let txt = if k == 3 { format!("{}°", v.round()) } else { format!("{}{} cm", if v >= 0.0 { "+" } else { "" }, (v * 100.0).round()) };
            barra(l, u, *r, css, nom, (v / lim + 1.0) / 2.0, &txt);
        }
        l.caja(u, cero[0], cero[1], cero[2], cero[3], 6.0 * css, [1.0, 1.0, 1.0, 0.12]); texto_cabe(l, u, cero[0], cero[1] + (cero[3] - tf) / 2.0 - 1.0, tf, cero[2], bl, "Como venía", true);
        l.caja(u, listo[0], listo[1], listo[2], listo[3], 6.0 * css, [0.949, 0.702, 0.106, 1.0]); texto_cabe(l, u, listo[0], listo[1] + (listo[3] - tf) / 2.0 - 1.0, tf, listo[2], [0.0, 0.0, 0.0, 1.0], "Listo", true);
    }
}
/// una barra (gaF: el nombre, la pista con su perilla y el valor en amarillo); `f` de 0 a 1
pub fn barra(l: &Letras, u: &mut Vec<f32>, r: [f32; 4], css: f32, nom: &str, f: f32, valor: &str) {
    let tf = 12.5 * css; let am = [0.949, 0.702, 0.106, 1.0];
    texto_cabe(l, u, r[0], r[1] + (r[3] - tf) / 2.0 - 1.0, tf, r[2] * 0.28, [1.0, 1.0, 1.0, 0.85], nom, false);
    let (px, pw, cy) = (r[0] + r[2] * 0.3, r[2] * 0.5, r[1] + r[3] / 2.0); let f = f.clamp(0.0, 1.0);
    l.caja(u, px, cy - 2.0 * css, pw, 4.0 * css, 2.0 * css, [1.0, 1.0, 1.0, 0.22]); l.caja(u, px, cy - 2.0 * css, pw * f, 4.0 * css, 2.0 * css, am);
    l.disco(u, px + pw * f, cy, 7.0 * css, am);
    let an = l.ancho(tf, valor); l.texto(u, r[0] + r[2] - an, r[1] + (r[3] - tf) / 2.0 - 1.0, tf, am, valor);
}

// ---------------- lo que pasa por la entrada y el HUD ----------------
impl Juego {
    /// un toque con un panel propio abierto
    pub(crate) fn pj_toque(&mut self, x: f32, y: f32, w: f32, h: f32) {
        if self.pjs.panel_aa.is_some() { self.aa_toque(x, y, w, h); }
        else if self.pjs.panel.is_some() { self.panel_pj_toque(x, y, w, h); }
        else if self.pjs.emo.panel() { self.emo_toque(x, y, w, h); }
        else if self.pjs.celu.panel_toma() { self.celu_toque(x, y, w, h); }
    }
    /// un dedo que se mueve: si es de lo de acá, lo toma (devuelve true)
    pub(crate) fn pj_mueve(&mut self, id: i32, x: f32, y: f32, h: f32) -> bool {
        let w = self.pjs.celu.pantalla.0;
        if self.pjs.panel_aa.is_some() { self.aa_mueve(id, x, w, h); return true; }
        if self.pjs.panel.is_some() { self.panel_pj_mueve(id, x, y, w, h); return true; }
        if self.emo_mueve(id, x, y, w, h) { return true; }
        if self.celu_mueve(id, x, y, w, h) { return true; }
        false
    }
    /// un dedo que se apoya (antes que los botones): el celular en la mano toma los toques de su pantalla
    pub(crate) fn pj_dedo_abajo(&mut self, id: i32, x: f32, y: f32, w: f32, h: f32) -> bool { self.pjs.celu.pantalla = (w, h); self.celu_dedo_abajo(id, x, y, w, h) }
    /// un dedo que se levanta (la ruleta: se elige al soltar)
    pub(crate) fn pj_dedo_arriba(&mut self, id: i32) { self.emo_soltar(id); self.celu_suelta(id); }
    /// lo de arriba de todo: los paneles, el celular, la ruleta y el cartel de juntos
    pub(crate) fn pjs_hud(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32, t: f32) -> Vec<(i64, Vec<f32>)> {
        let mut otras = vec![];
        if self.mapa.is_none() { return otras; }
        // (el ícono del botón del celular)
        if self.pj_visible(Bp::Celular) && !self.jg.sin_hud() && self.pjs.panel.is_none() { if let Some(b) = botones_pj(wf, hf).into_iter().find(|b| b.b == Boton::Pj(Bp::Celular)) {
            let mut v = vec![]; let lado = b.h * 0.56; rect_uv(&mut v, b.x - lado / 2.0, b.y - lado / 2.0, lado, lado, uv_celda(ico_idx("celular"), ICO, (ICO_COLS * ICO) as f32, self.atlas_alto(ICONOS.len())), [1.0; 4]); otras.push((TEX_ICO, v)); } }
        self.celu_hud(l, u, wf, hf, t, &mut otras);
        self.emo_hud(l, u, wf, hf, t, &mut otras);
        self.panel_pj_hud(l, u, wf, hf, &mut otras);
        self.aa_hud(l, u, wf, hf);
        otras
    }

    // ---------------- la red ----------------
    /// un hecho de otro que es de acá (ROOM/a): los accesorios, juntos, echar, las animaciones de la gente
    pub(crate) fn pjs_hecho(&mut self, de: &str, k: &str, d: &Value) {
        if self.meme_red(de, k, d) { return; }
        match k {
            "acq" | "acd" => self.acc_red(de, d),
            "jnt" | "jntP" | "jntS" => self.juntos_red(de, d),
            "animq" | "anim" => self.emo_red(de, d),
            "echar" => self.celu_echado(de, d),
            _ => {}
        }
    }
}
fn botones_pj(w: f32, h: f32) -> Vec<Btn> { let mut v = vec![]; botones(w, h, &mut v); v }

// ---------------- la calidad de entrada por el modelo del celular (celulares.js) ----------------
impl Juego {
    /// la primera vez (sin ajustes guardados): el modelo del celular (ro.product.model) → su chip → la calidad
    fn celulares_calidad(&mut self) {
        if self.pjs.prefs.calidad_auto { return; }
        if self.datos.as_ref().map(|d| d.join("ajustes.txt").exists()).unwrap_or(true) { return; }
        let modelo = propiedad("ro.product.model"); let ram = memoria_gb();
        let Some(d) = jxjuego::celulares::buscar(&modelo) else { return };
        // (la calidad que se estima para el aparato —celuPerfil—: con Automático es por donde empieza a medir gfx_auto, como
        // en la web; sin él, la que queda. No apaga Automático)
        let k = jxjuego::celulares::perfil(&d, ram);
        self.aj.poner_calidad(k.min(ajustes::CALIDADES.len() - 1));
        if let Some(dd) = &self.datos { let _ = std::fs::write(dd.join("ajustes.txt"), self.aj.texto()); }
        self.pjs.prefs.calidad_auto = true; self.pjs_guardar();
    }
}
/// una propiedad del sistema de Android (en la compu, JXM_CELU para probar)
pub fn propiedad(n: &str) -> String {
    #[cfg(target_os = "android")]
    unsafe {
        extern "C" { fn __system_property_get(name: *const std::ffi::c_char, value: *mut std::ffi::c_char) -> i32; }
        let c = std::ffi::CString::new(n).unwrap_or_default(); let mut v = [0 as std::ffi::c_char; 92];
        let l = __system_property_get(c.as_ptr(), v.as_mut_ptr()); if l > 0 { return std::ffi::CStr::from_ptr(v.as_ptr()).to_string_lossy().into_owned(); }
        return String::new();
    }
    #[allow(unreachable_code)] { let _ = n; std::env::var("JXM_CELU").unwrap_or_default() }
}
/// la memoria del aparato en GB (MemTotal de /proc/meminfo, redondeada como deviceMemory)
pub fn memoria_gb() -> f64 {
    let t = std::fs::read_to_string("/proc/meminfo").unwrap_or_default();
    let kb: f64 = t.lines().find(|l| l.starts_with("MemTotal:")).and_then(|l| l.split_whitespace().nth(1)).and_then(|x| x.parse().ok()).unwrap_or(0.0);
    if kb <= 0.0 { return 0.0; } let gb = kb / 1048576.0; [0.25, 0.5, 1.0, 2.0, 3.0, 4.0, 6.0, 8.0, 12.0, 16.0].iter().copied().find(|&x| gb <= x * 1.08).unwrap_or(16.0)
}
