//! Los gorros (personas.js y gorros.js de la web): los del juego (los hijos del contenedor Hats de CharactersRoot, en el
//! PhotonPlayer) y los nueve hechos con geometría de gorros.js (de copa, gorra, de lana, corona, aureola, cuernos, orejas de
//! conejo, de chef y casco vikingo), con sus materiales, su ícono dibujado desde el mismo modelo y el ajuste del jugador
//! (gorroAjLimpio: tamaño, corrido en X/Y/Z y color). Se dibujan pegados al hueso de la cabeza: `matriz`.
use crate::geo::{Geo, V};
use crate::mapa::{material, trs};
use crate::paquete::Paquete;
use jxmotor::escena::{Cabecera, Escena, ItemDin, Malla, Mat, Tex};
use jxmotor::mat::{self as m4, M4};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};

/// los números propios de los gorros en el motor (lejos de los del paquete, de jugabilidad y de gmod_juego)
pub const ID_GORROS: i64 = -9_100_000;
/// la malla de cada gorro hecho con geometría (ID_GORROS − k) y sus materiales (ID_GORROS − 100 − 10·k − parte)
pub fn id_malla_gn(k: usize) -> i64 { ID_GORROS - k as i64 }
pub fn id_mat_gn(k: usize, parte: usize) -> i64 { ID_GORROS - 100 - 10 * k as i64 - parte as i64 }
/// los materiales teñidos (el color del ajuste): uno por material y color, desde aquí para abajo
pub const ID_TENIDOS: i64 = ID_GORROS - 10_000;

/// una receta de gorros.js: los materiales de cada parte (color, brillo, metal), si brillan (la aureola) y la figura
pub struct Receta { pub n: &'static str, pub m: &'static [([f64; 3], f64, f64)], pub e: bool, pub f: fn(&mut Geo) }

fn curva(p0: V, p1: V, p2: V, n: usize) -> Vec<V> {
    (0..=n).map(|i| { let t = i as f64 / n as f64; let (a, b, c) = ((1.0 - t) * (1.0 - t), 2.0 * (1.0 - t) * t, t * t); [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1], a * p0[2] + b * p1[2] + c * p2[2]] }).collect()
}
fn radios(n: usize, r0: f64) -> Vec<f64> { (0..=n).map(|i| r0 * (1.0 - i as f64 / n as f64) + 0.002).collect() }
const PI: f64 = std::f64::consts::PI;

/// GN_RECETAS (medidas en metros en el marco del gorro: y arriba, la base a la altura de la frente, z adelante)
pub const RECETAS: [Receta; 9] = [
    Receta { n: "HatTop", m: &[([0.06, 0.06, 0.07], 0.35, 0.0), ([0.62, 0.08, 0.1], 0.3, 0.0)], e: false, f: |g| { let (a, b) = (g.parte(), g.parte());
        g.torno(a, &[[0.0, 0.0], [0.155, 0.0], [0.155, 0.012], [0.09, 0.014], [0.09, 0.19], [0.0, 0.19]], 28, [0.0; 3], [1.0; 3]); g.torno(b, &[[0.0905, 0.016], [0.0905, 0.048]], 28, [0.0; 3], [1.0; 3]); } },
    Receta { n: "HatCap", m: &[([0.12, 0.33, 0.78], 0.25, 0.0), ([0.95, 0.95, 0.95], 0.2, 0.0)], e: false, f: |g| { let (a, b) = (g.parte(), g.parte());
        g.cupula(a, 0.112, 0.118, 0.0, 28);
        // (la visera: media elipse para adelante, un poco inclinada para abajo, con espesor)
        for (yy, ny) in [(0.014, 1.0f64), (0.006, -1.0)] {
            let c = g.v([0.0, yy, 0.06], [0.0, ny, 0.0], 0.0, 0.0); let mut l = vec![];
            for k in 0..=16 { let an = PI * (k as f64 / 16.0); l.push(g.v([an.cos() * 0.11, yy - an.sin() * 0.025, 0.06 + an.sin() * 0.11], [0.0, ny, 0.15 * ny], 0.0, 0.0)); }
            for k in 0..16 { if ny > 0.0 { g.s[a].extend_from_slice(&[c, l[k + 1], l[k]]); } else { g.s[a].extend_from_slice(&[c, l[k], l[k + 1]]); } }
        }
        g.esfera(b, [0.0, 0.118, 0.0], [0.012, 0.008, 0.012], 10, 5, 0.0, PI / 2.0); } },
    Receta { n: "HatBeanie", m: &[([0.78, 0.14, 0.16], 0.05, 0.0), ([0.96, 0.95, 0.92], 0.05, 0.0)], e: false, f: |g| { let (a, b) = (g.parte(), g.parte());
        g.cupula(a, 0.11, 0.14, 0.025, 28); g.torno(a, &[[0.114, -0.005], [0.119, 0.012], [0.114, 0.034]], 28, [0.0; 3], [1.0; 3]); g.esfera(b, [0.0, 0.175, 0.0], [0.033, 0.03, 0.033], 14, 9, 0.0, PI); } },
    Receta { n: "HatCrown", m: &[([0.98, 0.76, 0.2], 0.7, 0.3), ([0.85, 0.1, 0.18], 0.8, 0.0)], e: false, f: |g| { let (a, b) = (g.parte(), g.parte()); let y = 0.06;
        g.torno(a, &[[0.092, y], [0.092, y + 0.045], [0.086, y + 0.045], [0.086, y]], 32, [0.0; 3], [1.0; 3]);
        for k in 0..8 { let an = (k as f64 / 8.0) * PI * 2.0; let (x, z) = (an.cos() * 0.09, an.sin() * 0.09);
            g.tubo(a, &[[x, y + 0.04, z], [x * 1.02, y + 0.075, z * 1.02], [x * 1.04, y + 0.105, z * 1.04]], &[0.022, 0.012, 0.001], 6); g.esfera(b, [x * 1.04, y + 0.025, z * 1.04], [0.012, 0.012, 0.012], 8, 5, 0.0, PI); } } },
    Receta { n: "HatHalo", m: &[([1.0, 0.88, 0.35], 0.9, 0.4)], e: true, f: |g| { let a = g.parte(); g.toro(a, [0.0, 0.17, 0.0], 0.095, 0.011, 36); } },
    Receta { n: "HatHorns", m: &[([0.72, 0.06, 0.06], 0.4, 0.0)], e: false, f: |g| { let a = g.parte();
        for sg in [1.0f64, -1.0] { g.tubo(a, &curva([sg * 0.055, 0.045, 0.02], [sg * 0.12, 0.08, 0.03], [sg * 0.12, 0.17, 0.0], 12), &radios(12, 0.028), 10); } } },
    Receta { n: "HatBunny", m: &[([0.97, 0.97, 0.97], 0.1, 0.0), ([0.98, 0.62, 0.72], 0.1, 0.0)], e: false, f: |g| { let (a, b) = (g.parte(), g.parte());
        { let (mut pts, mut rs) = (vec![], vec![]); for k in 0..=20 { let an = PI * (k as f64 / 20.0); pts.push([an.cos() * 0.106, 0.035 + an.sin() * 0.075, -0.005]); rs.push(0.006); } g.tubo(a, &pts, &rs, 8); }
        for sg in [1.0f64, -1.0] { g.esfera(a, [sg * 0.042, 0.2, -0.005], [0.028, 0.095, 0.012], 14, 10, 0.0, PI); g.esfera(b, [sg * 0.042, 0.2, 0.004], [0.016, 0.075, 0.006], 12, 8, 0.0, PI); } } },
    Receta { n: "HatChef", m: &[([0.98, 0.98, 0.97], 0.15, 0.0)], e: false, f: |g| { let a = g.parte();
        g.torno(a, &[[0.104, 0.0], [0.108, 0.07], [0.0, 0.07]], 28, [0.0; 3], [1.0; 3]);
        g.esfera(a, [0.0, 0.13, 0.0], [0.125, 0.075, 0.125], 22, 12, 0.0, PI);
        for k in 0..6 { let an = (k as f64 / 6.0) * PI * 2.0; g.esfera(a, [an.cos() * 0.07, 0.16, an.sin() * 0.07], [0.055, 0.045, 0.055], 12, 8, 0.0, PI); } } },
    Receta { n: "HatViking", m: &[([0.6, 0.61, 0.65], 0.6, 0.35), ([0.93, 0.89, 0.78], 0.3, 0.0), ([0.45, 0.32, 0.17], 0.4, 0.2)], e: false, f: |g| { let (a, b, c) = (g.parte(), g.parte(), g.parte());
        g.cupula(a, 0.114, 0.125, 0.005, 28); g.torno(c, &[[0.117, -0.004], [0.121, 0.006], [0.121, 0.028], [0.117, 0.036]], 32, [0.0; 3], [1.0; 3]);
        g.tubo(c, &[[0.0, 0.03, 0.119], [0.0, 0.075, 0.11], [0.0, 0.118, 0.07], [0.0, 0.13, 0.0]], &[0.008, 0.008, 0.008, 0.008], 6);
        for sg in [1.0f64, -1.0] { g.tubo(b, &curva([sg * 0.095, 0.06, 0.0], [sg * 0.17, 0.08, 0.02], [sg * 0.17, 0.2, 0.06], 12), &radios(12, 0.03), 10); } } },
];
pub fn receta(n: &str) -> Option<(usize, &'static Receta)> { RECETAS.iter().enumerate().find(|(_, r)| r.n == n) }
/// la figura de una receta
pub fn figura(r: &Receta) -> Geo { let mut g = Geo::nueva(); (r.f)(&mut g); g }
/// el material de una parte (como lo agrega gorrosNuevos a DATA.mt: Standard, opaco, su brillo y su metal; la aureola brilla)
pub fn material_gn(k: usize, parte: usize) -> Option<Mat> {
    let r = RECETAS.get(k)?; let (c, brillo, metal) = *r.m.get(parte)?;
    let mut x = json!({ "n": format!("GN_{}_{}", r.n, parte), "sh": "Standard", "c": [c[0], c[1], c[2], 1], "f": { "_Mode": 0, "_Glossiness": brillo, "_Metallic": metal } });
    if r.e { x["e"] = json!([c[0] * 0.6, c[1] * 0.6, c[2] * 0.6]); }
    let mut m = material(&json!({ "mt": [x], "tx": [] }), 0)?; m.id = id_mat_gn(k, parte); Some(m)
}

/// el ajuste del gorro (gorroAjLimpio): tamaño 0,5–1,6; corrido ±15 cm; color #rrggbb (vacío: el suyo)
#[derive(Clone, Debug, PartialEq)]
pub struct Ajuste { pub s: f64, pub x: f64, pub y: f64, pub z: f64, pub c: String }
impl Default for Ajuste { fn default() -> Self { Ajuste { s: 1.0, x: 0.0, y: 0.0, z: 0.0, c: String::new() } } }
impl Ajuste {
    pub fn limpio(g: &Value) -> Option<Ajuste> {
        if !g.is_object() { return None; }
        let n = |v: &Value, a: f64, b: f64, d: f64| v.as_f64().filter(|x| x.is_finite()).map(|x| x.max(a).min(b)).unwrap_or(d);
        let c = g["c"].as_str().filter(|c| c.len() == 7 && c.starts_with('#') && c[1..].chars().all(|h| h.is_ascii_hexdigit())).map(|c| c.to_lowercase()).unwrap_or_default();
        Some(Ajuste { s: n(&g["s"], 0.5, 1.6, 1.0), x: n(&g["x"], -15.0, 15.0, 0.0), y: n(&g["y"], -15.0, 15.0, 0.0), z: n(&g["z"], -15.0, 15.0, 0.0), c })
    }
    pub fn json(&self) -> Value { json!({ "s": self.s, "x": self.x, "y": self.y, "z": self.z, "c": self.c }) }
    /// el color (gorroColor), si tiene
    pub fn color(&self) -> Option<[f32; 4]> {
        if self.c.len() != 7 { return None; }
        let h = |i: usize| u8::from_str_radix(&self.c[i..i + 2], 16).ok().map(|v| v as f32 / 255.0);
        Some([h(1)?, h(3)?, h(5)?, 1.0])
    }
}
/// los colores del ajuste (GORRO_COLORES de rbmenus.js; el primero: el original)
pub const COLORES: [&str; 11] = ["", "#4c8bf5", "#d0d4dc", "#1d1f24", "#26346b", "#e0524f", "#f09a3e", "#f2d04b", "#5bbf6a", "#8e5bd6", "#e58cc2"];

/// la matriz del gorro con la cabeza en `cab` (personas.js: W[cabeza] × T(ajuste en cm) × gorroL, con los ejes por el
/// tamaño; sin ajuste, W[cabeza] × gorroL)
pub fn matriz(cab: &M4, local: &M4, aj: Option<&Ajuste>) -> M4 {
    match aj {
        Some(g) if g.s != 1.0 || g.x != 0.0 || g.y != 0.0 || g.z != 0.0 => {
            let a = trs([(g.x / 100.0) as f32, (g.y / 100.0) as f32, (g.z / 100.0) as f32], [0.0, 0.0, 0.0, 1.0], [1.0; 3]);
            let mut mb = m4::mul(&m4::mul(cab, &a), local); let k = g.s as f32;
            for c in 0..12 { if c % 4 != 3 { mb[c] *= k; } } mb
        }
        _ => m4::mul(cab, local),
    }
}

/// un gorro listo para dibujar: sus partes (malla, tramo, material, matriz desde el gorro y la esfera) y su lugar en la
/// cabeza (gorroL: el nodo del gorro respecto del contenedor Hats)
#[derive(Clone, Debug)]
pub struct Gorro { pub n: String, pub local: M4, pub partes: Vec<crate::objetos::Parte> }
impl Gorro {
    /// lo que se dibuja con la cabeza en `cab` (y el color del ajuste: los materiales teñidos de `tenidos`)
    pub fn items(&self, cab: &M4, aj: Option<&Ajuste>, tenidos: &HashMap<(i64, String), i64>, out: &mut Vec<ItemDin>) {
        let base = matriz(cab, &self.local, aj); let col = aj.map(|a| a.c.clone()).unwrap_or_default();
        let e = [0, 4, 8].iter().map(|&o| (base[o] * base[o] + base[o + 1] * base[o + 1] + base[o + 2] * base[o + 2]).sqrt()).fold(0.0f32, f32::max);
        for p in &self.partes {
            let mm = m4::mul(&base, &p.local); let c = punto(&base, [p.esf[0], p.esf[1], p.esf[2]]);
            let mat = if col.is_empty() { p.mat } else { tenidos.get(&(p.mat, col.clone())).copied().unwrap_or(p.mat) };
            out.push(ItemDin { m: p.m, s0: p.s0, sn: p.sn, mat, mm, esf: [c[0], c[1], c[2], p.esf[3] * e], fl: 0, h: vec![] });
        }
    }
}
fn punto(m: &M4, p: [f32; 3]) -> [f32; 3] { [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] }
fn f(v: &Value) -> f32 { v.as_f64().unwrap_or(0.0) as f32 }
fn v3(v: &Value, d: [f32; 3]) -> [f32; 3] { if v.is_array() { [f(&v[0]), f(&v[1]), f(&v[2])] } else { d } }
fn q4(v: &Value) -> [f32; 4] { if v.is_array() { [f(&v[0]), f(&v[1]), f(&v[2]), f(&v[3])] } else { [0.0, 0.0, 0.0, 1.0] } }

/// los gorros: los cargados (por nombre), lo que el motor ya tiene y los materiales teñidos
#[derive(Default)]
pub struct Gorros { pub cargados: HashMap<String, Option<Gorro>>, mallas: HashSet<i64>, mats: HashSet<i64>, texs: HashSet<i64>, pub tenidos: HashMap<(i64, String), i64>, sig_tenido: i64, mats_def: HashMap<i64, Mat> }
impl Gorros {
    pub fn olvidar(&mut self) { *self = Gorros::default(); }
    /// la lista (DATA.hats más los hechos con geometría que no están, como gorrosNuevos)
    pub fn lista(d: &Value) -> Vec<String> {
        let mut v: Vec<String> = d["hats"].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
        if v.is_empty() { v.push("HatEmpty".into()); }
        for r in &RECETAS { if !v.iter().any(|x| x == r.n) { v.push(r.n.to_string()); } }
        v
    }
    /// el gorro `n` (None: sin gorro o no está) y lo que el motor todavía no tiene (la primera vez)
    pub fn pedir(&mut self, paq: &mut Paquete, n: &str, tmax: u32) -> (Option<&Gorro>, Option<Escena>) {
        if n.is_empty() || n == "HatEmpty" { return (None, None); }
        let mut esc = None;
        if !self.cargados.contains_key(n) {
            let r = if let Some((k, _)) = receta(n).filter(|_| !paq.d["hats"].as_array().map(|a| a.iter().any(|x| x.as_str() == Some(n))).unwrap_or(false)) { self.armar_gn(k) } else { self.armar_juego(paq, n, tmax) };
            match r { Some((g, e)) => { self.cargados.insert(n.to_string(), Some(g)); esc = Some(e); } None => { self.cargados.insert(n.to_string(), None); } }
        }
        (self.cargados.get(n).and_then(|g| g.as_ref()), esc)
    }
    /// uno hecho con geometría: una malla con una parte por material, en el lugar de los del juego (p: [0, 0,1, 0,012])
    fn armar_gn(&mut self, k: usize) -> Option<(Gorro, Escena)> {
        let r = &RECETAS[k]; let g = figura(r); if g.p.is_empty() { return None; }
        let mut datos = vec![]; let malla = g.malla(id_malla_gn(k), &mut datos);
        let mut mats = vec![]; let mut partes = vec![]; let esf = g.esfera_env();
        for (parte, (s0, sn)) in g.rangos().into_iter().enumerate() {
            let mat = material_gn(k, parte)?; let id = mat.id;
            if self.mats.insert(id) { self.mats_def.insert(id, mat.clone()); mats.push(mat); }
            partes.push(crate::objetos::Parte { m: malla.id, s0, sn, mat: id, local: m4::id(), esf, nodo: 0 });
        }
        let mallas = if self.mallas.insert(malla.id) { vec![malla] } else { vec![] };
        let local = trs([0.0, 0.1, 0.012], [0.0, 0.0, 0.0, 1.0], [1.0; 3]);
        Some((Gorro { n: r.n.to_string(), local, partes }, escena(mallas, mats, vec![], datos)))
    }
    /// uno del juego: el sub-árbol del hijo de Hats con ese nombre (crearPersona: gorroL es su lugar; la raíz en el origen)
    fn armar_juego(&mut self, paq: &mut Paquete, n: &str, tmax: u32) -> Option<(Gorro, Escena)> {
        let clave = crate::objetos::por_nombre(&paq.d).get("PhotonPlayer").cloned()?;
        let (sub, local) = {
            let arb = paq.d["pf"][&clave].as_array()?;
            let cr = arb.iter().position(|x| x["n"].as_str() == Some("CharactersRoot"))? as i64;
            let hats = arb.iter().position(|x| x["n"].as_str() == Some("Hats") && x["pa"].as_i64() == Some(cr))? as i64;
            let gi = arb.iter().position(|x| x["pa"].as_i64() == Some(hats) && x["n"].as_str() == Some(n))?;
            (crate::personaje::sub_arbol(arb, gi), trs(v3(&arb[gi]["p"], [0.0; 3]), q4(&arb[gi]["r"]), v3(&arb[gi]["s"], [1.0; 3])))
        };
        let ks: Vec<String> = sub.iter().filter_map(|x| x["m"].as_i64()).filter(|&m| m >= 0).filter_map(|m| paq.d["ms"][m as usize]["k"].as_str().map(String::from)).collect();
        for k in ks { paq.asegurar(&k).ok()?; }
        let d = &paq.d; let nn = sub.len();
        // (la raíz en el origen: md.p[0] = [0,0,0], r[0] = identidad, s[0] = 1)
        let mut act = vec![false; nn]; let mut w: Vec<M4> = vec![m4::id(); nn];
        for (i, x) in sub.iter().enumerate() {
            let pa = x["pa"].as_i64().unwrap_or(-1);
            act[i] = x["off"].is_null() && (pa < 0 || act[pa as usize]);
            let l = if i == 0 { m4::id() } else { trs(v3(&x["p"], [0.0; 3]), q4(&x["r"]), v3(&x["s"], [1.0; 3])) };
            w[i] = if pa < 0 { l } else { m4::mul(&w[pa as usize], &l) };
        }
        let mut datos: Vec<u8> = vec![];
        let poner = |b: &[u8], datos: &mut Vec<u8>| -> usize { let o = datos.len(); datos.extend_from_slice(b); while datos.len() % 4 != 0 { datos.push(0); } o };
        let (mut mallas, mut mats, mut texs) = (vec![], vec![], vec![]); let mut partes = vec![];
        for (i, x) in sub.iter().enumerate() {
            if !act[i] { continue; }
            let (Some(mi), Some(mts)) = (x["m"].as_i64(), x["mt"].as_array()) else { continue };
            if mi < 0 || !x["mroff"].is_null() { continue; }
            let md = &d["ms"][mi as usize]; let Some(subs) = md["sub"].as_array() else { continue }; let Some(bin) = paq.bin_de(md) else { continue };
            if self.mallas.insert(mi) {
                let (v, o, ii) = (md["v"].as_u64().unwrap_or(0) as usize, md["o"].as_u64().unwrap_or(0) as usize, md["i"].as_u64().unwrap_or(0) as usize);
                let i32 = md["i32"].as_bool().unwrap_or(false); let ni = subs.iter().map(|s| s[0].as_u64().unwrap_or(0) + s[1].as_u64().unwrap_or(0)).max().unwrap_or(0) as usize;
                let (Some(vb), Some(ib)) = (bin.get(o..o + v * 14), bin.get(ii..ii + ni * if i32 { 4 } else { 2 })) else { continue };
                let vo = poner(vb, &mut datos); let io = poner(ib, &mut datos);
                mallas.push(Malla { id: mi, v: v as u32, mn: v3(&md["mn"], [0.0; 3]), sc: v3(&md["sc"], [1.0; 3]), i32: i32 as u8, ni: ni as u32, vo, io, lo: -1, so: -1, lm: -1 });
            }
            let (mn, sc) = (v3(&md["mn"], [0.0; 3]), v3(&md["sc"], [1.0; 3]));
            let c = [mn[0] + sc[0] / 2.0, mn[1] + sc[1] / 2.0, mn[2] + sc[2] / 2.0]; let r = (sc[0] * sc[0] + sc[1] * sc[1] + sc[2] * sc[2]).sqrt() / 2.0;
            let ew = [0, 4, 8].iter().map(|&o| (w[i][o] * w[i][o] + w[i][o + 1] * w[i][o + 1] + w[i][o + 2] * w[i][o + 2]).sqrt()).fold(0.0f32, f32::max);
            for (k, mt) in mts.iter().enumerate() {
                let Some(mt) = mt.as_i64() else { continue }; if mt < 0 { continue; } let Some(s) = subs.get(k) else { continue };
                if !self.mats.contains(&mt) { match material(d, mt as usize) { Some(m) => { self.mats.insert(mt); self.mats_def.insert(mt, m.clone()); mats.push(m); } None => continue } }
                else if !self.mats_def.contains_key(&mt) { if let Some(m) = material(d, mt as usize) { self.mats_def.insert(mt, m); } }
                let cen = punto(&w[i], c);
                partes.push(crate::objetos::Parte { m: mi, s0: s[0].as_u64().unwrap_or(0) as u32, sn: s[1].as_u64().unwrap_or(0) as u32, mat: mt, local: w[i], esf: [cen[0], cen[1], cen[2], r * ew], nodo: i });
            }
        }
        if partes.is_empty() { return None; }
        let quiero: Vec<i64> = mats.iter().flat_map(|m: &Mat| [m.t, m.t2]).filter(|&t| t >= 0).collect();
        for t in quiero {
            if !self.texs.insert(t) { continue; }
            if let Some((tw, th, px)) = paq.textura(t as usize, tmax) {
                let a = d["tx"][t as usize]["a"].as_i64().unwrap_or(0) as u8; let o = poner(&px, &mut datos);
                texs.push(Tex { id: t, n: d["tx"][t as usize]["n"].as_str().unwrap_or("").to_string(), w: tw, h: th, a, o });
            }
        }
        Some((Gorro { n: n.to_string(), local, partes }, escena(mallas, mats, texs, datos)))
    }
    /// los materiales teñidos de un gorro con el color `c` (la primera vez: una escena con los nuevos)
    pub fn tenir(&mut self, n: &str, c: &str) -> Option<Escena> {
        if c.is_empty() { return None; }
        let Some(Some(g)) = self.cargados.get(n) else { return None };
        let col = Ajuste { c: c.to_string(), ..Default::default() }.color()?;
        let mut nuevos = vec![];
        for p in &g.partes {
            if self.tenidos.contains_key(&(p.mat, c.to_string())) { continue; }
            let Some(base) = self.mats_def.get(&p.mat) else { continue };
            self.sig_tenido += 1; let id = ID_TENIDOS - self.sig_tenido;
            let mut m = base.clone(); m.id = id; m.c = col; nuevos.push(m); self.tenidos.insert((p.mat, c.to_string()), id);
        }
        if nuevos.is_empty() { None } else { Some(escena(vec![], nuevos, vec![], vec![])) }
    }
}
fn escena(mallas: Vec<Malla>, mats: Vec<Mat>, texs: Vec<Tex>, datos: Vec<u8>) -> Escena {
    Escena { c: Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas, mats, texs, lms: vec![], items: vec![], agua: None, cielo: None }, datos }
}

/// el nombre que se ve (pjGorroNom): sin el «Hat» de adelante; «Sin gorro» el vacío
pub fn nombre(s: &str) -> String { if s == "HatEmpty" { "Sin gorro".into() } else { s.strip_prefix("Hat").unwrap_or(s).to_string() } }

/// gnIcono: el modelo de frente y un poco de costado, con luz, dibujado de atrás hacia adelante en `lado` × `lado` (RGBA)
pub fn icono_gn(k: usize, lado: usize) -> Vec<u8> {
    let r = &RECETAS[k]; let g = figura(r); let cols: Vec<[f64; 3]> = r.m.iter().map(|x| x.0).collect();
    let l = 96.0f64; let (ay, ax) = (-0.5f64, 0.32f64); let (cy, sy, cx, sx) = (ay.cos(), ay.sin(), ax.cos(), ax.sin());
    let n = g.nv(); let mut v = Vec::with_capacity(n); let (mut mn, mut mx) = ([1e9f64, 1e9], [-1e9f64, -1e9]);
    for i in 0..n { let p = [g.p[i * 3], g.p[i * 3 + 1], g.p[i * 3 + 2]]; let x = p[0] * cy + p[2] * sy; let z0 = -p[0] * sy + p[2] * cy; let y = p[1] * cx - z0 * sx; let z = p[1] * sx + z0 * cx;
        v.push([x, y, z]); mn = [mn[0].min(x), mn[1].min(y)]; mx = [mx[0].max(x), mx[1].max(y)]; }
    let kk = (l * 0.82) / (mx[0] - mn[0]).max(mx[1] - mn[1]); let (ox, oy) = (l / 2.0 - ((mn[0] + mx[0]) / 2.0) * kk, l / 2.0 + ((mn[1] + mx[1]) / 2.0) * kk);
    let luz = [0.35, 0.65, 0.68];
    let mut tris: Vec<(f64, [f64; 3], [f64; 3], [f64; 3], f64, usize)> = vec![];
    for (si, s) in g.s.iter().enumerate() { for t in s.chunks_exact(3) {
        let (a, b, c) = (v[t[0] as usize], v[t[1] as usize], v[t[2] as usize]);
        let u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; let w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        let nn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; let nl = (nn[0] * nn[0] + nn[1] * nn[1] + nn[2] * nn[2]).sqrt(); let nl = if nl > 0.0 { nl } else { 1.0 };
        tris.push(((a[2] + b[2] + c[2]) / 3.0, a, b, c, ((nn[0] * luz[0] + nn[1] * luz[1] + nn[2] * luz[2]) / nl).abs(), si));
    } }
    // (de atrás hacia adelante: z mayor primero, como T.sort((p, q) => q.z - p.z))
    tris.sort_by(|p, q| q.0.partial_cmp(&p.0).unwrap_or(std::cmp::Ordering::Equal));
    // (se pinta a 4× y se achica: los bordes quedan suaves, como el canvas con el trazo de 0,6 px)
    let ss = 4usize; let big = lado * ss; let esc = big as f64 / l; let mut px = vec![0.0f32; big * big * 4];
    for (_, a, b, c, lz, si) in &tris {
        let col = cols.get(*si).copied().unwrap_or(cols[0]); let fz = 0.35 + 0.65 * lz;
        let s = |x: f64| ((x.powf(1.0 / 2.2) * 255.0 * fz).min(255.0) + 0.5).floor() as f32 / 255.0;
        let rgb = [s(col[0]), s(col[1]), s(col[2])];
        let p = |q: &[f64; 3]| [(ox + q[0] * kk) * esc, (oy - q[1] * kk) * esc];
        rellenar(&mut px, big, p(a), p(b), p(c), rgb, 0.3 * esc);
    }
    let mut o = vec![0u8; lado * lado * 4];
    for y in 0..lado { for x in 0..lado { let mut acc = [0.0f32; 4];
        for j in 0..ss { for i in 0..ss { let k = ((y * ss + j) * big + x * ss + i) * 4; let a = px[k + 3]; for c in 0..3 { acc[c] += px[k + c] * a; } acc[3] += a; } }
        let d = (y * lado + x) * 4; let a = acc[3] / (ss * ss) as f32;
        if acc[3] > 0.0 { for c in 0..3 { o[d + c] = ((acc[c] / acc[3]) * 255.0).round().clamp(0.0, 255.0) as u8; } }
        o[d + 3] = (a * 255.0).round().clamp(0.0, 255.0) as u8;
    } }
    o
}
/// un triángulo lleno (con el borde engordado `borde` píxeles, como el trazo del canvas) en un lienzo RGBA de floats
fn rellenar(px: &mut [f32], lado: usize, a: [f64; 2], b: [f64; 2], c: [f64; 2], rgb: [f32; 3], borde: f64) {
    let (x0, x1) = (a[0].min(b[0]).min(c[0]) - borde - 1.0, a[0].max(b[0]).max(c[0]) + borde + 1.0);
    let (y0, y1) = (a[1].min(b[1]).min(c[1]) - borde - 1.0, a[1].max(b[1]).max(c[1]) + borde + 1.0);
    let area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    let lados = [(a, b), (b, c), (c, a)];
    for y in (y0.max(0.0) as usize)..=(y1.min(lado as f64 - 1.0).max(0.0) as usize) { for x in (x0.max(0.0) as usize)..=(x1.min(lado as f64 - 1.0).max(0.0) as usize) {
        let p = [x as f64 + 0.5, y as f64 + 0.5];
        // (adentro si está del mismo lado de los tres bordes, o a menos de `borde` de alguno)
        let mut dentro = area.abs() > 1e-12;
        if dentro { for (u, v) in lados { let e = (v[0] - u[0]) * (p[1] - u[1]) - (v[1] - u[1]) * (p[0] - u[0]); if e * area < 0.0 { dentro = false; break; } } }
        if !dentro { for (u, v) in lados { if dist_seg(p, u, v) <= borde { dentro = true; break; } } }
        if dentro { let k = (y * lado + x) * 4; px[k] = rgb[0]; px[k + 1] = rgb[1]; px[k + 2] = rgb[2]; px[k + 3] = 1.0; }
    } }
}
fn dist_seg(p: [f64; 2], a: [f64; 2], b: [f64; 2]) -> f64 {
    let (dx, dy) = (b[0] - a[0], b[1] - a[1]); let l = dx * dx + dy * dy; let t = if l > 0.0 { (((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l).clamp(0.0, 1.0) } else { 0.0 };
    ((p[0] - a[0] - dx * t).powi(2) + (p[1] - a[1] - dy * t).powi(2)).sqrt()
}
