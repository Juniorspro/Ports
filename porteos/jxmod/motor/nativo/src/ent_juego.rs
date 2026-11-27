//! Las entidades de los mapas y de los mods (entidades.js): piano gigante (cada tecla suena al pisarla: el jugador, las
//! ruedas de los autos y los objetos sueltos), mega rampa (sus triángulos se suman al piso: los autos bajan por ella),
//! botón que hace aparecer un auto, teletransporte, zona de muerte, cartel, luz, impulso y meta. Las del mapa salen de su
//! archivo (los mapas de la Comunidad: el oficial es «Mega rampa»); el piano también se pone desde Props → Opciones.
//! Falta: la radio, la música de ambiente y la tele (emisoras por internet y videos), y lo de la red.
use super::*;
use jxjuego::fisica::{forma_caja, Cuerpo, OpCuerpo};
use jxmotor::escena::{Cabecera, Escena};
use serde_json::{json, Value};

// ---------------- números del motor (materiales y mallas propias) ----------------
const ID_ENT: i64 = ID_JG - 2000;
/// los que cambian de brillo van de a 4 niveles (nivel 0: apagado)
const M_TECLA_B: i64 = ID_ENT - 10; const M_TECLA_N: i64 = ID_ENT - 20; const M_BOTON_R: i64 = ID_ENT - 30; const M_TELE: i64 = ID_ENT - 40; const M_IMPULSO: i64 = ID_ENT - 50;
const M_MADERA: i64 = ID_ENT - 60; const M_BOTON_B: i64 = ID_ENT - 61; const M_FLECHA: i64 = ID_ENT - 62; const M_META_B: i64 = ID_ENT - 63; const M_META_N: i64 = ID_ENT - 64;
const M_PALO: i64 = ID_ENT - 65; const M_TABLA: i64 = ID_ENT - 66; const M_MUERTE: i64 = ID_ENT - 67; const M_RAMPA_PISO: i64 = ID_ENT - 68; const M_RAMPA_EST: i64 = ID_ENT - 69;
/// la radio: el plástico, el parlante y lo metálico
const M_RADIO: i64 = ID_ENT - 70; const M_PARLANTE: i64 = ID_ENT - 71; const M_METAL: i64 = ID_ENT - 72;
/// el foco de cada luz (su color): uno por entidad
const M_FOCO: i64 = ID_ENT - 100;
/// las mallas de las rampas (de a una por rampa)
const MALLA_RAMPA: i64 = ID_ENT - 500;
const BLANCAS: [i32; 7] = [0, 2, 4, 5, 7, 9, 11];
/// los autos de los botones: los que puede haber a la vez en el celular y cuánto tiene que estar sin usar uno para irse
const AUTOS_MAX: usize = 10; const AUTO_OCIOSO: f32 = 25.0;

fn nivel(k: f32) -> i64 { (k.clamp(0.0, 1.0) * 3.0).round() as i64 }
fn pf(v: &Value, k: &str, d: f32) -> f32 { v.get(k).and_then(|x| x.as_f64()).map(|x| x as f32).filter(|x| x.is_finite()).unwrap_or(d) }
fn pv3(v: &Value) -> Option<V> { let a = v.as_array()?; if a.len() < 3 { return None; } Some([a[0].as_f64()? as f32, a[1].as_f64()? as f32, a[2].as_f64()? as f32]) }
/// colorRGB: "#rrggbb" → [r, g, b] de 0 a 1 (si no, blanco)
fn color_rgb(h: &str) -> [f32; 3] {
    let h = h.trim(); if h.len() != 7 || !h.starts_with('#') { return [1.0; 3]; }
    let c = |i: usize| u8::from_str_radix(&h[i..i + 2], 16).map(|x| x as f32 / 255.0);
    match (c(1), c(3), c(5)) { (Ok(r), Ok(g), Ok(b)) => [r, g, b], _ => [1.0; 3] }
}
/// lo de fábrica de cada tipo (ENT_INFO)
fn por_defecto(t: &str) -> Option<Value> {
    Some(match t {
        "piano" => json!({ "n": 25, "o": 3, "a": 1.2, "l": 5 }), "rampa" => json!({ "alto": 120, "ancho": 16, "ang": 50, "salto": true }),
        "boton_autos" => json!({ "auto": "", "a": null, "ya": null, "ini": false }), "teleport" => json!({ "a": null }), "zona_muerte" => json!({ "s": [6, 3, 6] }),
        "cartel" => json!({ "texto": "JXMod", "color": "#ffffff" }), "luz" => json!({ "color": "#ffd9a0", "r": 14, "i": 1 }), "impulso" => json!({ "f": 16, "d": 8 }),
        "meta" => json!({ "texto": "" }), "radio" => json!({ "v": "", "vol": 1, "r": 40 }), _ => return None,
    })
}

pub struct Tecla { blanca: bool, midi: i32, x: f32, w: f32, y0: f32, h: f32, z: f32, l: f32, ap: f32, t: f32, on: bool, pisa: bool }
#[derive(Default)]
pub struct Ent {
    pub t: String, pub p: V, pub yaw: f32, pub q: Q, pub prm: Value, pub id: u32, pub de_mod: bool,
    cuerpos: Vec<u32>, rad: f32,
    // (el piano: sus teclas, ancho, largo y lo que mide cada blanca)
    teclas: Vec<Tecla>, blancas: Vec<usize>, w: f32, l: f32, a: f32,
    // (la rampa: su malla y sus partes, y la esfera que la envuelve)
    malla: Option<(i64, Vec<(u32, u32)>)>, esf: [f32; 4],
    // (el botón: su auto; lo apretado, cuándo y si se pisa; el teletransporte, el impulso y la meta: la última vez)
    auto: Option<u32>, ap: f32, tp: f32, pisa: bool, ini_hecho: bool, mat: i64,
}
#[derive(Default)]
pub struct Ents {
    pub lista: Vec<Ent>, sig: u32, t0: f32,
    /// los autos de los botones (el número del objeto y la última vez que se usó)
    autos: Vec<(u32, f32)>, t_autos: f32,
    /// el mapa de la Comunidad que se pidió al empezar (se arma cuando el mapa base está listo) y lo que pidió una Opción
    pub pend: Option<String>, pub poner: Option<&'static str>,
    /// los materiales ya en el motor; las mallas de rampa y los focos puestos; las notas del piano ya sintetizadas
    listo: bool, n_mallas: i64, n_focos: i64, notas: std::collections::HashSet<i32>,
}

impl Ents {
    /// (para las pruebas) cuántas hay de un tipo y cuántas teclas del piano están sonando
    pub fn cuantas(&self, t: &str) -> usize { self.lista.iter().filter(|e| e.t == t).count() }
    pub fn teclas_sonando(&self) -> usize { self.lista.iter().flat_map(|e| e.teclas.iter()).filter(|k| k.on).count() }
    pub fn notas_distintas(&self) -> usize { self.notas.len() }
    /// (para las pruebas) dónde está la primera de un tipo y su giro
    pub fn lugar(&self, t: &str) -> Option<(V, Q)> { self.lista.iter().find(|e| e.t == t).map(|e| (e.p, e.q)) }
    /// dónde está la entidad con ese número
    pub fn lugar_de(&self, id: u32) -> Option<V> { self.lista.iter().find(|e| e.id == id).map(|e| e.p) }
    /// la entidad (número y tipo) dueña de un cuerpo de la física
    pub fn de_cuerpo(&self, c: u32) -> Option<(u32, &str)> { self.lista.iter().find(|e| e.cuerpos.contains(&c)).map(|e| (e.id, e.t.as_str())) }
}

// ---------------- los mapas de la Comunidad (los oficiales) ----------------
/// los que hay: (id, nombre, autor, mapa base)
pub const COMUNIDAD: [(&str, &str, &str, &str); 1] = [("megarampa", "Mega rampa", "JXMod", "FlatGrass")];
/// mapaMegaRampa: la rampa gigante desde el cielo en Pasto plano, con los autos para elegir arriba (cada uno con su botón)
pub fn mapa_com(id: &str) -> Option<Value> {
    if id != "megarampa" { return None; }
    let (h, z0, y0) = (140.0f64, -230.0f64, 0.53f64); let top = |x: f64, z: f64| json!([x, y0 + h, z0 + z]);
    let mut ent = vec![json!({ "t": "rampa", "p": [0.0, y0, z0], "yaw": 0.0, "prm": { "alto": h, "ancho": 16, "ang": 52, "salto": true } })];
    for (i, auto) in ["Sedan", "police_car_v5", "Derby5", "Wheelchair", "Moto", "Sofie"].iter().enumerate() {
        let a = (-55.0 + i as f64 * 22.0).to_radians(); let en = |r: f64| top(((r * a.sin()) * 100.0).round() / 100.0, ((-r * a.cos() - 1.0) * 100.0).round() / 100.0);
        ent.push(json!({ "t": "boton_autos", "p": en(21.0), "yaw": -a, "prm": { "auto": auto, "i": i, "a": en(12.5), "ya": -a, "ini": true } }));
    }
    ent.push(json!({ "t": "cartel", "p": top(0.0, -35.3), "yaw": std::f64::consts::PI, "prm": { "texto": "MEGA RAMPA", "color": "#ffd23f", "ico": "rampa" } }));
    for (x, z) in [(-40.0, 6.0), (40.0, 6.0), (-30.0, 320.0), (30.0, 320.0)] {
        ent.push(json!({ "t": "teleport", "p": [x, y0, z0 + z], "yaw": 0.0, "prm": { "a": top(0.0, -30.0) } }));
        ent.push(json!({ "t": "cartel", "p": [x, y0, z0 + z - 4.0], "yaw": std::f64::consts::PI, "prm": { "texto": "MEGA RAMPA", "color": "#7fe3ff", "ico": "rampa" } }));
    }
    let l = top(0.0, -12.0); ent.push(json!({ "t": "luz", "p": [l[0], l[1].as_f64().unwrap_or(0.0) + 6.0, l[2]], "yaw": 0.0, "prm": { "color": "#ffe2b0", "r": 30, "i": 1.2 } }));
    let spawns: Vec<Value> = [-6.0, -2.0, 2.0, 6.0].iter().map(|x| json!({ "p": top(*x, -31.0), "yaw": 0.0 })).collect();
    Some(json!({ "formato": "rezobox-mapa", "nombre": "Mega rampa", "autor": "JXMod", "base": "FlatGrass", "gravedad": 1, "objetos": [], "spawns": spawns, "entidades": ent }))
}

/// la nota de un piano de verdad, más o menos (notaTocar: cuatro parciales y la envolvente que sube en 10 ms y se apaga)
fn nota_pcm(hz: f32, seg: f32, rate: u32) -> Vec<f32> {
    let n = (seg + 0.05) as f64 * rate as f64; let n = n as usize; let mut v = vec![0f32; n];
    let parc = [(1.0f32, 0.6f32), (2.0, 0.25), (3.0, 0.12), (4.2, 0.06)];
    for (i, s) in v.iter_mut().enumerate() {
        let t = i as f32 / rate as f32;
        // (la exponencial de 0,0001 a 0,5 en 10 ms y de vuelta a 0,0001 en `seg`)
        let g = if t < 0.01 { 0.0001f32 * (0.5f32 / 0.0001).powf(t / 0.01) } else if t < seg { 0.5 * (0.0001f32 / 0.5).powf((t - 0.01) / (seg - 0.01)) } else { 0.0 };
        let mut x = 0.0; for (k, a) in parc { x += (std::f32::consts::TAU * hz * k * t).sin() * a; }
        *s = x * g;
    }
    v
}

impl Juego {
    // ---------------- lo que va al motor una vez por mapa ----------------
    unsafe fn ent_preparar(&mut self, m: &mut Motor3d) {
        if self.jg.ents.listo { return; }
        self.jg.ents.listo = true;
        let mat = |id: i64, c: [f32; 3], pbr: [f32; 3], em: [f32; 3]| Mat { ti: [0.0; 12], pbr, fol: 0, id, t2: -1, terr: None, c: [c[0], c[1], c[2], 1.0], st: [1.0, 1.0, 0.0, 0.0], t: -1, blend: 0, cut: 0, unlit: 0, add: 0, agua: 0, em };
        let mut mats = vec![];
        for j in 0..4 { let k = j as f32 / 3.0; let e = [0.12 * k, 0.4 * k, 0.9 * k]; let jj = j as i64;
            mats.push(mat(M_TECLA_B - jj, [0.92, 0.92, 0.88], [0.22, 0.0, 0.05], e)); mats.push(mat(M_TECLA_N - jj, [0.04, 0.04, 0.05], [0.18, 0.0, 0.05], e));
            // (el botón rojo late entre 0,1 y 0,9; el teletransporte y el impulso, entre 0,4 y 1 —0,6 y 1—)
            mats.push(mat(M_BOTON_R - jj, [0.85, 0.06, 0.05], [0.3, 0.0, 0.05], [0.1 + 0.8 * k, 0.05, 0.03]));
            let kt = 0.4 + 0.6 * k; mats.push(mat(M_TELE - jj, [0.1, 0.45, 0.6], [0.3, 0.2, 0.04], [0.2 * kt, 1.2 * kt, 1.6 * kt]));
            let ki = 0.2 + 0.8 * k; mats.push(mat(M_IMPULSO - jj, [0.1, 0.5, 0.15], [0.3, 0.2, 0.04], [0.2 * ki, 1.4 * ki, 0.3 * ki])); }
        mats.push(mat(M_MADERA, [0.1, 0.05, 0.035], [0.3, 0.0, 0.05], [0.0; 3])); mats.push(mat(M_BOTON_B, [0.18, 0.18, 0.2], [0.4, 0.6, 0.04], [0.0; 3]));
        mats.push(mat(M_FLECHA, [0.1, 0.5, 0.15], [0.3, 0.2, 0.04], [1.5, 1.8, 1.5]));
        mats.push(mat(M_META_B, [0.95, 0.95, 0.95], [0.5, 0.0, 0.04], [0.0; 3])); mats.push(mat(M_META_N, [0.05, 0.05, 0.05], [0.5, 0.0, 0.04], [0.0; 3]));
        mats.push(mat(M_PALO, [0.35, 0.22, 0.12], [0.8, 0.0, 0.03], [0.0; 3])); mats.push(mat(M_TABLA, [0.92, 0.88, 0.78], [0.8, 0.0, 0.03], [0.0; 3]));
        mats.push(mat(M_MUERTE, [0.5, 0.02, 0.02], [0.72, 0.0, 0.04], [0.9, 0.05, 0.05]));
        mats.push(mat(M_RADIO, [0.62, 0.08, 0.07], [0.35, 0.0, 0.05], [0.0; 3])); mats.push(mat(M_PARLANTE, [0.04, 0.04, 0.045], [0.75, 0.0, 0.04], [0.0; 3])); mats.push(mat(M_METAL, [0.75, 0.76, 0.78], [0.25, 0.9, 0.05], [0.0; 3]));
        mats.push(mat(M_RAMPA_PISO, [0.32, 0.33, 0.36], [0.85, 0.0, 0.03], [0.0; 3])); mats.push(mat(M_RAMPA_EST, [0.92, 0.72, 0.16], [0.5, 0.1, 0.04], [0.0; 3]));
        let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats, texs: vec![], lms: vec![], items: vec![], agua: None, cielo: None };
        let _ = m.cargar(&Escena { c: cab, datos: vec![] });
    }
    /// una caja fija de choque (cajaFija): centro, medios lados y giro
    fn ent_caja_fija(&mut self, c: V, h: V, q: Q) -> u32 {
        let mut b = Cuerpo::nuevo(std::sync::Arc::new(forma_caja(h[0] as f64, h[1] as f64, h[2] as f64)), 0.0, OpCuerpo::default());
        b.pos = v64(c); b.q = [q[0] as f64, q[1] as f64, q[2] as f64, q[3] as f64]; self.fis.agregar(b)
    }

    // ---------------- crear y sacar ----------------
    /// entidadCrear: una entidad desde sus datos ({t, p, yaw, prm}); devuelve su número
    pub(super) unsafe fn ent_crear(&mut self, m: &mut Motor3d, d: &Value) -> Option<u32> {
        self.ent_preparar(m);
        let t = d.get("t")?.as_str()?.to_string(); let mut prm = por_defecto(&t)?;
        if let (Some(o), Some(dp)) = (prm.as_object_mut(), d.get("prm").and_then(|x| x.as_object())) { for (k, v) in dp { o.insert(k.clone(), v.clone()); } }
        let p = pv3(d.get("p")?)?; let yaw = d.get("yaw").and_then(|x| x.as_f64()).unwrap_or(0.0) as f32;
        self.jg.ents.sig += 1; let id = self.jg.ents.sig;
        let mut e = Ent { t, p, yaw, q: qeje([0.0, 1.0, 0.0], yaw), prm, id, ..Ent::default() };
        let ew = |e: &Ent, x: f32, y: f32, z: f32| add(e.p, qrot(e.q, [x, y, z]));
        match e.t.as_str() {
            "piano" => {
                let pr = &e.prm; let n = (pf(pr, "n", 25.0) as i32).clamp(5, 61); let a = pf(pr, "a", 1.2).clamp(0.4, 4.0); let l = pf(pr, "l", 5.0).clamp(1.0, 20.0); let o0 = (pf(pr, "o", 3.0) as i32).clamp(0, 7);
                let nb = (0..n).filter(|s| BLANCAS.contains(&(s % 12))).count(); let w = nb as f32 * a; let mut wi = 0;
                for s in 0..n {
                    let midi = 12 * (o0 + 1) + s; let blanca = BLANCAS.contains(&(s % 12));
                    let k = if blanca { Tecla { blanca, midi, x: w / 2.0 - (wi as f32 + 0.5) * a, w: a * 0.94, y0: 0.0, h: 0.3, z: l / 2.0, l, ap: 0.0, t: 0.0, on: false, pisa: false } }
                        else { Tecla { blanca, midi, x: w / 2.0 - wi as f32 * a, w: a * 0.56, y0: 0.3, h: 0.25, z: l * 0.69, l: l * 0.62, ap: 0.0, t: 0.0, on: false, pisa: false } };
                    if blanca { e.blancas.push(e.teclas.len()); wi += 1; } e.teclas.push(k);
                }
                e.w = w; e.l = l; e.a = a; e.rad = (w / 2.0).hypot(l) + 2.0;
                let cajas: Vec<(V, V)> = e.teclas.iter().map(|k| (ew(&e, k.x, k.y0 + k.h / 2.0, k.z), [k.w / 2.0, k.h / 2.0, k.l / 2.0])).chain(std::iter::once((ew(&e, 0.0, 0.75, l + 0.35), [w / 2.0 + 0.4, 0.75, 0.35]))).collect();
                for (c, h) in cajas { let id = self.ent_caja_fija(c, h, e.q); e.cuerpos.push(id); }
            }
            "rampa" => self.ent_rampa(m, &mut e),
            "boton_autos" => { let c = ew(&e, 0.0, 0.06, 0.0); let id = self.ent_caja_fija(c, [0.75, 0.06, 0.75], e.q); e.cuerpos.push(id); }
            // (la radio: una caja de 72 × 46 × 28 cm que choca —y se mira para Usar—)
            "radio" => { let c = ew(&e, 0.0, 0.23, 0.0); let id = self.ent_caja_fija(c, [0.36, 0.23, 0.14], e.q); e.cuerpos.push(id); e.rad = 1.0; }
            "luz" => { let c = color_rgb(e.prm.get("color").and_then(|x| x.as_str()).unwrap_or("")); let id = M_FOCO - self.jg.ents.n_focos; self.jg.ents.n_focos += 1; e.mat = id;
                let foco = Mat { ti: [0.0; 12], pbr: [0.3, 0.0, 0.04], fol: 0, id, t2: -1, terr: None, c: [c[0], c[1], c[2], 1.0], st: [1.0, 1.0, 0.0, 0.0], t: -1, blend: 0, cut: 0, unlit: 0, add: 0, agua: 0, em: [c[0] * 2.5, c[1] * 2.5, c[2] * 2.5] };
                let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![foco], texs: vec![], lms: vec![], items: vec![], agua: None, cielo: None };
                let _ = m.cargar(&Escena { c: cab, datos: vec![] }); }
            "meta" => e.tp = -10.0,
            _ => {}
        }
        self.jg.ents.lista.push(e); Some(id)
    }
    /// la mega rampa (se pone en el piso; sube «alto» metros): plataforma arriba para los autos, caída en parábola, recta
    /// empinada, curva hasta el piso, recta y salto final; sus triángulos se suman al mundo y la malla va al motor
    unsafe fn ent_rampa(&mut self, m: &mut Motor3d, e: &mut Ent) {
        let pr = &e.prm; let h = pf(pr, "alto", 120.0).clamp(10.0, 600.0) as f64; let w = pf(pr, "ancho", 16.0).clamp(6.0, 80.0) as f64; let th = (pf(pr, "ang", 50.0).clamp(15.0, 80.0) as f64).to_radians();
        let salto = pr.get("salto").and_then(|x| x.as_bool()).unwrap_or(true);
        // perfil (y, z, ángulo de bajada) en metros desde la punta de arriba (los mismos números que la web)
        let (lp, g, t2) = (18.0f64, 9.81f64, th.tan()); let r2 = (h * 0.6).clamp(25.0, 90.0); let d2 = r2 * (1.0 - th.cos());
        let v0 = 30f64.min(((h * 0.75 - d2) * 2.0 * g / (t2 * t2)).max(4.0).sqrt()); let k = g / (2.0 * v0 * v0); let xm = t2 / (2.0 * k); let dp = k * xm * xm;
        let ls = ((h - dp - d2) / th.sin()).max(0.0); let (f, rk, ka) = (36.0f64, 70.0f64, if salto { 0.38f64 } else { 0.0 });
        let mut pts: Vec<(f64, f64, f64)> = vec![];
        let mut z = 0.0; while z <= lp { pts.push((0.0, z, 0.0)); z += 6.0; }
        let np = 8usize.max((xm / 1.5).ceil() as usize); for i in 1..=np { let x = xm * i as f64 / np as f64; pts.push((-k * x * x, lp + x, (2.0 * k * x).atan())); }
        let (mut y, mut z) = (-dp, lp + xm);
        let ns = 1usize.max((ls / 6.0).ceil() as usize); for i in 1..=ns { pts.push((y - th.sin() * ls * i as f64 / ns as f64, z + th.cos() * ls * i as f64 / ns as f64, th)); }
        y -= th.sin() * ls; z += th.cos() * ls;
        let na = 8usize.max((r2 * th / 1.5).ceil() as usize); let (cy, cz) = (y + r2 * th.cos(), z + r2 * th.sin());
        for i in 1..=na { let a = th * (1.0 - i as f64 / na as f64); pts.push((cy - r2 * a.cos(), cz - r2 * a.sin(), a)); }
        y = cy - r2; z = cz;
        for i in 1..=6 { pts.push((y, z + f * i as f64 / 6.0, 0.0)); }
        z += f;
        if ka > 0.0 { let nk = (rk * ka / 1.5).ceil() as usize; for i in 1..=nk { let a = ka * i as f64 / nk as f64; pts.push((y + rk - rk * a.cos(), z + rk * a.sin(), -a)); } }
        // (toda la rampa 8 cm más arriba que el piso: así el asfalto no titila contra el pasto)
        let q = [e.q[0] as f64, e.q[1] as f64, e.q[2] as f64, e.q[3] as f64]; let o = [e.p[0] as f64, e.p[1] as f64 + h + 0.08, e.p[2] as f64];
        let ew = |x: f64, y: f64, z: f64| { let r = jxjuego::geo::qrot(q, [x, y, z]); [o[0] + r[0], o[1] + r[1], o[2] + r[2]] };
        let pw = |x: f64, p: &(f64, f64, f64), dy: f64| ew(x, p.0 + dy, p.1);
        let qr = |v: [f64; 3]| jxjuego::geo::qrot(q, v);
        let mut geo = jxjuego::geo::Geo::nueva(); let s_piso = geo.parte(); let s_est = geo.parte();
        let mut tris: Vec<f32> = vec![]; let push = |tris: &mut Vec<f32>, ps: &[[f64; 3]]| { for p in ps { tris.extend_from_slice(&[p[0] as f32, p[1] as f32, p[2] as f32]); } };
        let (hw, gr, xx) = (1.8f64, 1.2f64, w / 2.0);
        // el piso de la rampa (normales suaves, la U a lo largo: las líneas siguen la rampa)
        let mut largo = 0.0; let base = geo.nv() as u32;
        for (i, p) in pts.iter().enumerate() {
            let n = qr([0.0, p.2.cos(), p.2.sin()]);
            if i > 0 { largo += (p.0 - pts[i - 1].0).hypot(p.1 - pts[i - 1].1); }
            for x in [xx, -xx] { let wv = pw(x, p, 0.0); geo.v(wv, n, largo / 4.0, (x + xx) / 4.0); }
            if i > 0 { let k2 = base + i as u32 * 2; geo.s[s_piso].extend_from_slice(&[k2 - 2, k2 - 1, k2, k2 - 1, k2 + 1, k2]); }
        }
        for i in 1..pts.len() {
            let (a, b) = (&pts[i - 1], &pts[i]);
            let (pa, pb, pc, pd) = (pw(xx, a, 0.0), pw(-xx, a, 0.0), pw(-xx, b, 0.0), pw(xx, b, 0.0));
            push(&mut tris, &[pa, pb, pc, pa, pc, pd]);
            // barandas a los dos lados (adentro y afuera) y su tapa
            for s in [1.0f64, -1.0] {
                let (x, xo) = (s * xx, s * (xx + 0.5));
                let (p0, p1, q0, q1, o0, o1, t0, t1) = (pw(x, a, 0.0), pw(x, b, 0.0), pw(x, a, hw), pw(x, b, hw), pw(xo, a, -gr), pw(xo, b, -gr), pw(xo, a, hw), pw(xo, b, hw));
                geo.quad(s_est, p0, p1, q1, q0, qr([-s, 0.0, 0.0]), 2.0); geo.quad(s_est, o0, o1, t1, t0, qr([s, 0.0, 0.0]), 2.0); geo.quad(s_est, q0, q1, t1, t0, qr([0.0, 1.0, 0.0]), 2.0);
                push(&mut tris, &[p0, p1, q1, p0, q1, q0]);
            }
            // la panza
            let (u0, u1, u2, u3) = (pw(xx + 0.5, a, -gr), pw(-xx - 0.5, a, -gr), pw(-xx - 0.5, b, -gr), pw(xx + 0.5, b, -gr));
            geo.quad(s_est, u0, u1, u2, u3, qr([0.0, -b.2.cos(), -b.2.sin()]), 2.0);
        }
        // la plataforma de arriba, más ancha (para los autos), con paredes atrás y a los costados
        let (pa, pz0, pz1, py) = (14.0f64, -36.0f64, 0.0f64, 0.0f64);
        let plat = [ew(xx + pa, py, pz0), ew(-xx - pa, py, pz0), ew(-xx - pa, py, pz1), ew(xx + pa, py, pz1)];
        geo.quad(s_piso, plat[0], plat[1], plat[2], plat[3], qr([0.0, 1.0, 0.0]), 4.0);
        push(&mut tris, &[plat[0], plat[1], plat[2], plat[0], plat[2], plat[3]]);
        let pared = |geo: &mut jxjuego::geo::Geo, tris: &mut Vec<f32>, x0: f64, z0: f64, x1: f64, z1: f64| {
            let (a, b, c, d) = (ew(x0, py, z0), ew(x1, py, z1), ew(x1, py + hw, z1), ew(x0, py + hw, z0));
            let ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; let n = [-ab[2], 0.0, ab[0]]; let l = (n[0] * n[0] + n[2] * n[2]).sqrt().max(1e-9); let n = [n[0] / l, 0.0, n[2] / l];
            geo.quad(s_est, a, b, c, d, n, 2.0); geo.quad(s_est, a, b, c, d, [-n[0], 0.0, -n[2]], 2.0); push(tris, &[a, b, c, a, c, d]);
        };
        pared(&mut geo, &mut tris, xx + pa, pz0, -xx - pa, pz0); pared(&mut geo, &mut tris, xx + pa, pz0, xx + pa, pz1); pared(&mut geo, &mut tris, -xx - pa, pz0, -xx - pa, pz1);
        pared(&mut geo, &mut tris, xx + pa, pz1, xx, pz1); pared(&mut geo, &mut tris, -xx - pa, pz1, -xx, pz1);
        let pb = [ew(xx + pa, py - gr, pz0), ew(-xx - pa, py - gr, pz0), ew(-xx - pa, py - gr, pz1), ew(xx + pa, py - gr, pz1)];
        geo.quad(s_est, pb[0], pb[1], pb[2], pb[3], qr([0.0, -1.0, 0.0]), 4.0);
        // columnas hasta el piso cada tanto (y debajo de la plataforma); la punta queda debajo de la panza también en la pendiente
        let mut cols: Vec<(f64, f64, f64)> = vec![(xx + pa - 2.0, pz0 + 2.0, 0.0), (-xx - pa + 2.0, pz0 + 2.0, 0.0), (xx + pa - 2.0, -2.0, 0.0), (-xx - pa + 2.0, -2.0, 0.0)];
        for (i, p) in pts.iter().enumerate() { if i % 6 == 3 && -p.0 < h - 4.0 && p.0 > -h + 3.0 { let b2 = p.0 - p.2.tan().abs() * 0.9 - 0.25; cols.push((xx - 0.9, p.1, b2)); cols.push((-xx + 0.9, p.1, b2)); } }
        let mundo_piso = |me: &Juego, p: [f64; 3]| -> Option<f64> { let mp = me.mapa.as_ref()?; mp.mundo.rayo([p[0] as f32, p[1] as f32, p[2] as f32], [0.0, -1.0, 0.0], 800.0).map(|g| p[1] - g.t as f64) };
        for (x, z, yy) in cols {
            let top = ew(x, yy - gr, z); let Some(piso) = mundo_piso(self, [top[0], top[1] - 1.0, top[2]]) else { continue };
            if top[1] - piso < 2.0 { continue; }
            let hh = (top[1] - piso) / 2.0; let c = [top[0], piso + hh, top[2]];
            geo.caja(s_est, c, [0.8, hh, 0.8], q, 3.0); let id = self.ent_caja_fija([c[0] as f32, c[1] as f32, c[2] as f32], [0.8, hh as f32, 0.8], e.q); e.cuerpos.push(id);
        }
        // los triángulos al mundo (el piso de la rampa, las barandas, la plataforma y sus paredes)
        if let Some(mp) = self.mapa.as_mut() {
            let mut t = std::mem::take(&mut mp.mundo.t); t.extend_from_slice(&tris); let cu = std::mem::take(&mut mp.mundo.cuerpos); let gv = mp.mundo.gravedad;
            mp.mundo = jxjuego::mundo::Mundo::nuevo(t, cu, gv);
        }
        // la malla al motor
        let id = MALLA_RAMPA - self.jg.ents.n_mallas; self.jg.ents.n_mallas += 1;
        let mut datos = vec![]; let malla = geo.malla(id, &mut datos);
        let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![malla], mats: vec![], texs: vec![], lms: vec![], items: vec![], agua: None, cielo: None };
        let _ = m.cargar(&Escena { c: cab, datos });
        let er = geo.esfera_env(); e.esf = er; e.malla = Some((id, geo.rangos()));
        e.rad = (w as f32).hypot(pts.last().map(|p| p.1 as f32).unwrap_or(0.0)) + 40.0;
    }
    /// entidadQuitar: sus cuerpos de choque (los triángulos de una rampa quedan hasta el próximo mapa)
    pub(super) fn ent_quitar(&mut self, i: usize) {
        let e = self.jg.ents.lista.remove(i);
        for id in e.cuerpos { self.fis.quitar(id); }
    }
    /// entidadesCargar: las de un mapa
    pub(super) unsafe fn ent_cargar(&mut self, m: &mut Motor3d, lista: &[Value]) { for d in lista { self.ent_crear(m, d); } self.jg.ents.t0 = self.jg.t; }
    /// un mapa de la Comunidad sobre el mapa base ya armado: las entidades, el lugar donde aparecés y el aviso
    unsafe fn ent_com_iniciar(&mut self, m: &mut Motor3d, id: &str) {
        let Some(mc) = mapa_com(id) else { return };
        if let Some(l) = mc["entidades"].as_array().cloned() { self.ent_cargar(m, &l); }
        if let Some(sp) = mc["spawns"].as_array().and_then(|s| s.first()).and_then(|s| pv3(&s["p"])) { self.jug.pos = [sp[0], sp[1] + 1.05, sp[2]]; self.jug.vel = [0.0; 3]; }
        let nom = mc["nombre"].as_str().unwrap_or(""); let aut = mc["autor"].as_str().unwrap_or("");
        self.avisar(format!("{nom} · por {aut}"));
    }
    /// entidadPonerMod: el piano que pone una Opción, delante del jugador (uno: si ya está, se trae)
    pub(super) unsafe fn ent_poner_mod(&mut self, m: &mut Motor3d, t: &str) {
        let f = [self.jug.yaw.sin(), 0.0, self.jug.yaw.cos()]; let d = if t == "piano" { 3.0 } else { 1.6 }; let mut p = add(self.jug.pos, esc(f, d));
        let piso = self.mapa.as_ref().and_then(|mp| mp.mundo.rayo([p[0], self.jug.pos[1] + 1.0, p[2]], [0.0, -1.0, 0.0], 40.0)).map(|g| self.jug.pos[1] + 1.0 - g.t);
        p[1] = piso.unwrap_or(self.jug.pos[1] - 1.0);
        if let Some(i) = self.jg.ents.lista.iter().position(|e| e.t == t && e.de_mod) { self.ent_quitar(i); }
        if let Some(id) = self.ent_crear(m, &json!({ "t": t, "p": [p[0], p[1], p[2]], "yaw": self.jug.yaw })) { if let Some(e) = self.jg.ents.lista.iter_mut().find(|e| e.id == id) { e.de_mod = true; } }
    }

    // ---------------- cada cuadro ----------------
    /// entidadesPaso: lo que hace cada una (y el mapa de la Comunidad pedido, apenas el mapa base está)
    pub(super) unsafe fn ent_cuadro(&mut self, m: &mut Motor3d, dt: f32) {
        if let Some(id) = self.jg.ents.pend.take() { self.ent_com_iniciar(m, &id); }
        if let Some(t) = self.jg.ents.poner.take() { self.ent_poner_mod(m, t); }
        if self.jg.ents.lista.is_empty() { return; }
        let mut lista = std::mem::take(&mut self.jg.ents.lista);
        for e in lista.iter_mut() {
            match e.t.as_str() {
                "piano" => self.ent_piano_paso(e, dt),
                "boton_autos" => self.ent_boton_paso(m, e, dt),
                "teleport" => self.ent_tele_paso(e),
                "zona_muerte" => { if self.jug.vida > 0.0 { let s = e.prm.get("s").and_then(pv3).unwrap_or([6.0, 3.0, 6.0]); let l = qrot(qconj(e.q), sub(self.jug.pos, e.p));
                    if l[0].abs() < s[0] / 2.0 && l[2].abs() < s[2] / 2.0 && l[1] > -1.0 && l[1] < s[1] { self.danar_jugador(1e6); } } }
                "impulso" => self.ent_impulso_paso(e),
                "meta" => self.ent_meta_paso(e),
                _ => {}
            }
        }
        // (las que se agregaron mientras —un auto que pone una— quedan después)
        let nuevas = std::mem::take(&mut self.jg.ents.lista); lista.extend(nuevas); self.jg.ents.lista = lista;
        if !self.jg.ents.autos.is_empty() { self.ent_autos_limpiar(false); }
    }
    /// el pie del jugador (si está vivo y a pie)
    fn ent_pie(&self) -> Option<V> { if self.jug.vida > 0.0 && self.vehs.jugador.is_none() { Some([self.jug.pos[0], self.jug.pos[1] - 0.98, self.jug.pos[2]]) } else { None } }
    /// pisadores: los pies del jugador, las ruedas de los autos y los objetos sueltos cerca de `c`
    fn ent_pisadores(&self, c: V, rad: f32) -> Vec<V> {
        let cerca = |p: V| (p[0] - c[0]).abs() < rad && (p[2] - c[2]).abs() < rad && (p[1] - c[1]).abs() < rad;
        let mut l = vec![]; if let Some(p) = self.ent_pie() { l.push(p); }
        for b in &self.fis.cuerpos {
            if b.inv_masa <= 0.0 { continue; } let bp = v32(b.pos); if !cerca(bp) { continue; }
            match self.vehs.de(b.id) {
                Some(v) if !v.ruedas.is_empty() => { for w in &v.ruedas { let r = jxjuego::fisica::rot(b.q, w.p); l.push([bp[0] + r[0] as f32, bp[1] + r[1] as f32 - w.r as f32 - 0.05, bp[2] + r[2] as f32]); } }
                _ => l.push([bp[0], bp[1] - b.forma.radio() as f32 * 0.6, bp[2]]),
            }
        }
        l.retain(|p| cerca(*p)); l
    }
    fn ent_piano_paso(&mut self, e: &mut Ent, dt: f32) {
        let c = add(e.p, qrot(e.q, [0.0, 0.0, e.l / 2.0]));
        for k in e.teclas.iter_mut() { k.pisa = false; }
        for pt in self.ent_pisadores(c, e.rad) {
            let l = qrot(qconj(e.q), sub(pt, e.p)); if l[2] < 0.0 || l[2] > e.l || l[1] < -0.3 || l[1] > 1.4 || l[0].abs() > e.w / 2.0 { continue; }
            let mut k = if l[1] > 0.43 { e.teclas.iter().position(|t| !t.blanca && (l[0] - t.x).abs() < t.w / 2.0 + 0.05 && l[2] > t.z - t.l / 2.0) } else { None };
            if k.is_none() { let i = ((e.w / 2.0 - l[0]) / e.a).floor(); if i >= 0.0 { k = e.blancas.get(i as usize).copied(); } }
            if let Some(k) = k { e.teclas[k].pisa = true; }
        }
        for i in 0..e.teclas.len() {
            let (pisa, on) = (e.teclas[i].pisa, e.teclas[i].on);
            if pisa { if !on { e.teclas[i].on = true; let k = &e.teclas[i]; let pos = add(e.p, qrot(e.q, [k.x, 0.4, k.z])); self.ent_nota(k.midi, pos); } e.teclas[i].t = 0.12; }
            else if on { e.teclas[i].t -= dt; if e.teclas[i].t <= 0.0 { e.teclas[i].on = false; } }
            let k = &mut e.teclas[i]; k.ap += ((k.on as i32 as f32) - k.ap) * (dt * 18.0).min(1.0);
        }
    }
    /// una nota del piano (sintetizada la primera vez que suena esa tecla)
    fn ent_nota(&mut self, midi: i32, pos: V) {
        let nombre = format!("ENT_piano_{midi}");
        if self.jg.ents.notas.insert(midi) { let hz = 440.0 * 2f32.powf((midi - 69) as f32 / 12.0); self.sonido.sintetico(&nombre, move || nota_pcm(hz, 2.4, 22050), 22050); }
        self.sonido.tocar(&nombre, 1.1, 1.0, Some(pos));
    }
    fn ent_boton_lugar(e: &Ent) -> (V, f32) {
        let p = e.prm.get("a").and_then(pv3).unwrap_or_else(|| add(e.p, qrot(e.q, [0.0, 0.0, 5.0])));
        (p, e.prm.get("ya").and_then(|x| x.as_f64()).map(|x| x as f32).unwrap_or(e.yaw))
    }
    unsafe fn ent_boton_paso(&mut self, m: &mut Motor3d, e: &mut Ent, dt: f32) {
        if e.prm.get("ini").and_then(|x| x.as_bool()).unwrap_or(false) && !e.ini_hecho { e.ini_hecho = true; self.ent_boton_pulsar(m, e, true); }
        let pisa = self.ent_pie().map(|pie| { let l = qrot(qconj(e.q), sub(pie, e.p)); l[0].abs() < 0.85 && l[2].abs() < 0.85 && l[1] > -0.3 && l[1] < 0.7 }).unwrap_or(false);
        if pisa && !e.pisa && self.jg.t - e.tp > 1.2 { e.tp = self.jg.t; self.ent_boton_pulsar(m, e, false); }
        e.pisa = pisa; e.ap += ((pisa as i32 as f32) - e.ap) * (dt * 14.0).min(1.0);
    }
    /// botonAutoPulsar: si el auto de este botón ya no está (lo borraron, explotó o se lo llevaron lejos), aparece otro
    unsafe fn ent_boton_pulsar(&mut self, m: &mut Motor3d, e: &mut Ent, callado: bool) {
        let (lp, lyaw) = Self::ent_boton_lugar(e);
        if let Some(oid) = e.auto { if let Some(o) = self.objs.iter().find(|o| o.id == oid) { if !o.exploto && dist(o.pos, lp) < 10.0 {
            self.avisar("Ya está tu auto".into()); self.sonido.tocar("Click", 0.5, 0.7, Some(e.p)); return; } } }
        let nom = e.prm.get("auto").and_then(|x| x.as_str()).unwrap_or("").to_string(); if nom.is_empty() { return; }
        let q = qeje([0.0, 1.0, 0.0], lyaw);
        let Ok(Some(i)) = self.crear(m, &nom, add(lp, [0.0, 0.3, 0.0]), q, false, false) else { return };
        let oid = self.objs[i].id; self.jg.ents.autos.push((oid, self.jg.t)); e.auto = Some(oid);
        if !callado { self.sonido.tocar("Click", 0.9, 1.2, Some(e.p)); self.avisar("Auto nuevo".into()); } else { self.aviso = None; }
        self.ent_autos_limpiar(true);
    }
    /// autosLimpiar: si hay demasiados autos de los botones, se va el que más tiempo lleva sin usarse
    fn ent_autos_limpiar(&mut self, ya: bool) {
        if !ya && self.jg.t - self.jg.ents.t_autos < 2.0 { return; } self.jg.ents.t_autos = self.jg.t;
        let ahora = self.jg.t; let objs = &self.objs; let fis = &self.fis; let manejo = self.vehs.jugador.map(|v| v.0);
        let de_boton: Vec<u32> = self.jg.ents.lista.iter().filter_map(|e| e.auto).collect();
        self.jg.ents.autos.retain(|(id, _)| objs.iter().any(|o| o.id == *id));
        for (id, uso) in self.jg.ents.autos.iter_mut() {
            let Some(o) = objs.iter().find(|o| o.id == *id) else { continue }; let Some(cid) = o.cuerpo else { continue };
            let en_uso = manejo == Some(cid) || fis.cuerpo(cid).map(|b| b.agarrado || jxjuego::fisica::largo2(b.vel) > 1.0).unwrap_or(false);
            if en_uso { *uso = ahora; }
        }
        while self.jg.ents.autos.len() > AUTOS_MAX {
            let mut c: Vec<(u32, f32)> = self.jg.ents.autos.iter().copied().filter(|(id, uso)| { let cid = self.objs.iter().find(|o| o.id == *id).and_then(|o| o.cuerpo); (manejo.is_none() || cid != manejo) && ahora - uso > AUTO_OCIOSO }).collect();
            c.sort_by(|a, b| (de_boton.contains(&a.0) as i32).cmp(&(de_boton.contains(&b.0) as i32)).then(a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal)));
            let Some((id, _)) = c.first().copied() else { break };
            if let Some(i) = self.objs.iter().position(|o| o.id == id) { self.borrar_obj(i); }
            self.jg.ents.autos.retain(|x| x.0 != id);
        }
    }
    fn ent_tele_paso(&mut self, e: &mut Ent) {
        let Some(a) = e.prm.get("a").and_then(pv3) else { return }; if self.jg.t - e.tp < 1.5 || self.jug.vida <= 0.0 { return; }
        let veh = self.vehs.jugador.map(|v| v.0);
        let donde = match veh { Some(cid) => self.fis.cuerpo(cid).map(|b| v32(b.pos)), None => self.ent_pie() }; let Some(donde) = donde else { return };
        let l = qrot(qconj(e.q), sub(donde, e.p)); if l[0].hypot(l[2]) > 1.3 || l[1] < -0.6 || l[1] > 2.2 { return; }
        e.tp = self.jg.t;
        match veh {
            Some(cid) => { if let Some(i) = self.fis.indice(cid) { let b = &mut self.fis.cuerpos[i]; b.pos = v64(add(a, [0.0, 1.2, 0.0])); b.vel = [0.0; 3]; b.ang = [0.0; 3]; b.prev_pos = b.pos; b.despertar(); b.actualizar(); } }
            None => { self.jug.pos = add(a, [0.0, 1.05, 0.0]); self.jug.vel = [0.0; 3]; }
        }
        self.sonido.tocar("Click", 0.7, 1.6, None);
        for _ in 0..16 { let (rx, ry, rz) = (self.azar() - 0.5, self.azar(), self.azar() - 0.5); self.ef.particula(add(a, [rx * 1.5, ry * 2.0, rz * 1.5]), [0.0, 2.0, 0.0], 0.6, 0.12, [0.3, 0.9, 1.0, 1.0], efx::Tipo::Fog, 0.5); }
    }
    fn ent_impulso_paso(&mut self, e: &mut Ent) {
        if self.jg.t - e.tp < 0.6 || self.jug.vida <= 0.0 { return; }
        let veh = self.vehs.jugador.map(|v| v.0);
        let donde = match veh { Some(cid) => self.fis.cuerpo(cid).map(|b| v32(b.pos)), None => self.ent_pie() }; let Some(donde) = donde else { return };
        let l = qrot(qconj(e.q), sub(donde, e.p)); if l[0].abs() > 1.3 || l[2].abs() > 1.3 || l[1] < -0.5 || l[1] > 1.6 { return; }
        e.tp = self.jg.t; let f = qrot(e.q, [0.0, 0.0, 1.0]); let up = pf(&e.prm, "f", 16.0).clamp(0.0, 200.0); let fw = pf(&e.prm, "d", 8.0).clamp(0.0, 200.0);
        match veh {
            Some(cid) => { if let Some(i) = self.fis.indice(cid) { let b = &mut self.fis.cuerpos[i]; b.despertar(); b.vel[1] = b.vel[1].max(up as f64 * 0.8); for k in 0..3 { b.vel[k] += (f[k] * fw * 0.8) as f64; } } }
            None => { self.jug.vel[1] = up; for k in 0..3 { self.jug.vel[k] += f[k] * fw; } self.jug.suelo = false; self.jug.pos[1] += 0.05; }
        }
        self.sonido.tocar("Melee1", 0.7, 1.5, Some(e.p));
    }
    fn ent_meta_paso(&mut self, e: &mut Ent) {
        if self.jg.t - e.tp < 5.0 || self.jug.vida <= 0.0 { return; }
        let veh = self.vehs.jugador.map(|v| v.0);
        let donde = match veh { Some(cid) => self.fis.cuerpo(cid).map(|b| v32(b.pos)), None => Some(self.jug.pos) }; let Some(donde) = donde else { return };
        let l = qrot(qconj(e.q), sub(donde, e.p)); if l[0].abs() > 4.6 || l[2].abs() > 1.6 || l[1] < -1.0 || l[1] > 6.0 { return; }
        e.tp = self.jg.t; let t = self.jg.t - self.jg.ents.t0; let (mm, ss) = ((t / 60.0).floor(), t % 60.0);
        let txt = e.prm.get("texto").and_then(|x| x.as_str()).filter(|s| !s.is_empty()).unwrap_or("¡Llegaste!").to_string();
        self.avisar(format!("{txt} · {mm}:{ss:04.1}")); self.sonido.tocar("Click", 1.0, 0.8, None); self.jg.ents.t0 = self.jg.t;
        for _ in 0..40 { let (a, b, c, r, g, bl) = (self.azar(), self.azar(), self.azar(), self.azar(), self.azar(), self.azar());
            self.ef.particula(add(e.p, qrot(e.q, [(a - 0.5) * 8.0, 5.0, 0.0])), [(b - 0.5) * 4.0, c * 3.0, (a - 0.5) * 4.0], 1.5, 0.12, [r, g, bl, 1.0], efx::Tipo::Chispa, 0.5); }
    }

    // ---------------- el dibujo ----------------
    /// dibujarEntidades: lo que se ve de cada una
    pub(super) fn ent_items(&self, out: &mut Vec<ItemDin>) {
        let t = self.jg.t;
        for e in &self.jg.ents.lista {
            let ew = |x: f32, y: f32, z: f32| add(e.p, qrot(e.q, [x, y, z]));
            match e.t.as_str() {
                "piano" => {
                    for k in &e.teclas { let b = if k.blanca { M_TECLA_B } else { M_TECLA_N }; caja(ew(k.x, k.y0 + k.h / 2.0 - k.ap * 0.1, k.z), [k.w, k.h, k.l], e.q, b - nivel(k.ap), out); }
                    caja(ew(0.0, 0.75, e.l + 0.35), [e.w + 0.8, 1.5, 0.7], e.q, M_MADERA, out); caja(ew(0.0, 0.02, e.l / 2.0), [e.w + 0.8, 0.04, e.l + 0.3], e.q, M_MADERA, out);
                }
                "rampa" => { if let Some((id, partes)) = &e.malla { for (k, (s0, sn)) in partes.iter().enumerate() {
                    let mm = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];
                    out.push(ItemDin { m: *id, s0: *s0, sn: *sn, mat: if k == 0 { M_RAMPA_PISO } else { M_RAMPA_EST }, mm, esf: e.esf, fl: 0, h: vec![] }); } } }
                // (la radio: el cuerpo, los dos parlantes de adelante —el frente mira al que la puso—, la manija y la antena)
                "radio" => { caja(ew(0.0, 0.23, 0.0), [0.72, 0.42, 0.26], e.q, M_RADIO, out); for x in [-0.19f32, 0.19] { caja(ew(x, 0.21, -0.132), [0.24, 0.24, 0.02], e.q, M_PARLANTE, out); }
                    caja(ew(0.0, 0.36, -0.132), [0.1, 0.06, 0.02], e.q, M_METAL, out); caja(ew(0.0, 0.48, 0.0), [0.5, 0.04, 0.05], e.q, M_METAL, out); for x in [-0.23f32, 0.23] { caja(ew(x, 0.455, 0.0), [0.04, 0.06, 0.05], e.q, M_METAL, out); }
                    caja(ew(0.3, 0.7, 0.06), [0.015, 0.5, 0.015], e.q, M_METAL, out); }
                "boton_autos" => { caja(ew(0.0, 0.04, 0.0), [1.6, 0.08, 1.6], e.q, M_BOTON_B, out);
                    let k = 0.5 + 0.5 * (t * 4.0).sin(); caja(ew(0.0, 0.13 - e.ap * 0.06, 0.0), [1.1, 0.1, 1.1], e.q, M_BOTON_R - nivel(k), out); }
                "teleport" => { let k = 0.5 + 0.5 * (t * 3.0).sin(); caja(ew(0.0, 0.05, 0.0), [2.4, 0.1, 2.4], e.q, M_TELE - nivel(k), out); }
                "impulso" => { let k = 0.5 + 0.5 * (t * 5.0).sin(); caja(ew(0.0, 0.05, 0.0), [2.4, 0.1, 2.4], e.q, M_IMPULSO - nivel(k), out);
                    for i in 0..3 { let i = i as f32; caja(ew(0.0, 0.12, -0.6 + i * 0.6), [0.9 - i * 0.25, 0.04, 0.22], e.q, M_FLECHA, out); } }
                "cartel" => { caja(ew(0.0, 1.1, 0.0), [0.14, 2.2, 0.14], e.q, M_PALO, out); caja(ew(0.0, 2.5, 0.0), [2.6, 1.3, 0.12], e.q, M_TABLA, out); }
                "luz" => caja(e.p, [0.25, 0.25, 0.25], [0.0, 0.0, 0.0, 1.0], e.mat, out),
                "meta" => { for x in [-4.4f32, 4.4] { caja(ew(x, 2.6, 0.0), [0.4, 5.2, 0.4], e.q, M_META_B, out); }
                    for i in 0..18 { for j in 0..2 { caja(ew(-4.25 + i as f32 * 0.5, 4.95 + j as f32 * 0.5, 0.0), [0.5, 0.5, 0.25], e.q, if (i + j) % 2 == 1 { M_META_N } else { M_META_B }, out); } } }
                _ => {}
            }
        }
    }
    /// entidadesLuces: las luces y el brillo del teletransporte (las que están a menos de 120 m)
    pub(super) fn ent_luces(&self) -> Vec<LuzP> {
        let mut v = vec![]; let cam = self.jg.cam_ult;
        for e in &self.jg.ents.lista {
            if dist(e.p, cam) > 120.0 { continue; }
            match e.t.as_str() {
                "teleport" => { let p = add(e.p, qrot(e.q, [0.0, 1.0, 0.0])); v.push([p[0], p[1], p[2], 6.0, 0.4, 2.2, 3.0, 0.0, 0.0, -1.0, 0.0, -2.0]); }
                "luz" => { let c = color_rgb(e.prm.get("color").and_then(|x| x.as_str()).unwrap_or("")); let k = pf(&e.prm, "i", 1.0).clamp(0.05, 6.0) * 3.0; let r = pf(&e.prm, "r", 14.0).clamp(1.0, 80.0);
                    v.push([e.p[0], e.p[1], e.p[2], r, c[0] * k, c[1] * k, c[2] * k, 0.0, 0.0, -1.0, 0.0, -2.0]); }
                _ => {}
            }
        }
        v.sort_by(|a, b| dist([a[0], a[1], a[2]], cam).partial_cmp(&dist([b[0], b[1], b[2]], cam)).unwrap_or(std::cmp::Ordering::Equal)); v.truncate(3); v
    }
    /// los textos de los carteles, en la pantalla sobre la tabla (los que están a menos de 40 m y adelante)
    pub(super) fn ent_hud(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32) {
        let vp = &self.vp_ult;
        for e in &self.jg.ents.lista {
            if e.t != "cartel" { continue; }
            let p = add(e.p, qrot(e.q, [0.0, 2.5, 0.0])); let d = dist(p, self.jg.cam_ult); if d > 40.0 { continue; }
            let c = [vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12], vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13], vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15]];
            if c[2] <= 0.1 { continue; }
            let (x, y) = ((c[0] / c[2] * 0.5 + 0.5) * wf, (0.5 - c[1] / c[2] * 0.5) * hf);
            let txt = e.prm.get("texto").and_then(|x| x.as_str()).unwrap_or(""); if txt.is_empty() { continue; }
            let col = color_rgb(e.prm.get("color").and_then(|x| x.as_str()).unwrap_or("#ffffff"));
            // (del tamaño de la tabla: 2,6 m de ancho a esa distancia, sin pasar de un tamaño que se lea)
            let tam = (hf * 1.1 / d).clamp(hf * 0.012, hf * 0.06); let w = l.ancho(tam, txt);
            l.texto_sombra(u, x - w / 2.0, y - tam * 0.35, tam, [col[0], col[1], col[2], 1.0], txt);
        }
    }
}
