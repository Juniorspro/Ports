//! El arma en la mano (primera persona), como vista.js: el sub-árbol de cada arma dentro del PhotonPlayer (debajo de
//! WalkSway), con sus mallas (con piel o rígidas) y sus animaciones (sacar, quieto, sostener, fuego…), que buscan cada
//! nodo por el CRC32 de su camino. Se ubica delante de la cámara con el vaivén al caminar (vistaUbicar: escala 0,3, la de
//! SmoothCamera). También el rayo de la Physics Gun (rayoFisicaPuntos): la curva de la boca del arma a lo agarrado, para
//! dibujarla con un tubo que brilla (la malla y el material los arma `tubo`).
use crate::mapa::{material, trs};
use crate::paquete::Paquete;
use jxmotor::escena::{Cabecera, Escena, ItemDin, Malla, Mat, Tex, FL_SIN_SOMBRA};
use jxmotor::mat::{self as m4, M4};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

type V = [f32; 3];
type Q = [f32; 4];
fn f(v: &Value) -> f32 { v.as_f64().unwrap_or(0.0) as f32 }
fn v3(v: &Value, d: V) -> V { if v.is_array() { [f(&v[0]), f(&v[1]), f(&v[2])] } else { d } }
fn q4(v: &Value, d: Q) -> Q { if v.is_array() { [f(&v[0]), f(&v[1]), f(&v[2]), f(&v[3])] } else { d } }

/// crc32 (el de vista.js: el camino del hueso en UTF-8)
pub fn crc32(s: &str) -> u32 {
    let mut c = 0xffff_ffffu32;
    for &b in s.as_bytes() { c ^= b as u32; for _ in 0..8 { c = if c & 1 != 0 { 0xedb8_8320 ^ (c >> 1) } else { c >> 1 }; } }
    c ^ 0xffff_ffff
}

/// lo que el motor ya tiene (para no subirlo dos veces)
#[derive(Default)]
pub struct Cargados { mallas: HashSet<i64>, mats: HashSet<i64>, texs: HashSet<i64> }
impl Cargados { pub fn olvidar(&mut self) { *self = Cargados::default(); } }

/// una pista de un clip: el nodo (por el hash), qué mueve (p, r, s o a: prendido) y los cuadros
struct Pista { h: u32, k: u8, f: Vec<Vec<f32>> }
/// un clip de DATA.an.clips (el primero de cada nombre, como anPorNombre): su duración y las pistas
pub struct Clip { pub d: f32, pistas: Vec<Pista> }
/// los clips leídos (DATA.an), por nombre
#[derive(Default)]
pub struct Clips { fps: f32, c: HashMap<String, Option<Arc<Clip>>> }
impl Clips {
    pub fn de(&mut self, d: &Value, nombre: &str) -> Option<Arc<Clip>> {
        if self.fps == 0.0 { self.fps = d["an"]["fps"].as_f64().unwrap_or(30.0) as f32; }
        if let Some(c) = self.c.get(nombre) { return c.clone(); }
        let x = &d["an"]["clips"][nombre][0];
        let c = if x.is_object() {
            let pistas = x["p"].as_array().map(|a| a.iter().map(|p| Pista { h: p["h"].as_u64().unwrap_or(0) as u32, k: p["k"].as_str().and_then(|s| s.bytes().next()).unwrap_or(b'p'),
                f: p["f"].as_array().map(|fr| fr.iter().map(|q| match q { Value::Array(a) => a.iter().map(f).collect(), o => vec![f(o)] }).collect()).unwrap_or_default() }).collect()).unwrap_or_default();
            Some(Arc::new(Clip { d: f(&x["d"]), pistas }))
        } else { None };
        self.c.insert(nombre.to_string(), c.clone()); c
    }
}

struct Piel { i: usize, m: i64, bo: Vec<i32>, bp: Vec<M4>, partes: Vec<(u32, u32, i64)>, c: V, r: f32 }
struct Rigida { i: usize, m: i64, s0: u32, sn: u32, mat: i64, c: V, r: f32 }

/// el arma en la mano: el modelo, su pose y el clip que suena
pub struct Vista {
    pub nodo: String,
    pa: Vec<i32>, act: Vec<bool>, mesh: Vec<bool>, p: Vec<V>, r: Vec<Q>, s: Vec<V>, w: Vec<M4>, pub raiz: M4,
    pieles: Vec<Piel>, rigidas: Vec<Rigida>, por_hash: HashMap<u32, usize>,
    /// la boca del arma (Muzzle…), para el rayo y los tiros
    pub mz: Option<usize>,
    pub clip: Option<Arc<Clip>>, pub t: f32, pub vel: f32, pub bucle: bool, pub mantener: bool,
}

/// la copia del sub-árbol desde el nodo i0 con los índices nuevos (subArbol)
fn sub_arbol(arb: &[Value], i0: usize) -> Vec<Value> {
    let mut hijos: Vec<Vec<usize>> = vec![vec![]; arb.len()];
    for (k, x) in arb.iter().enumerate() { if let Some(p) = x["pa"].as_i64() { if p >= 0 && (p as usize) < arb.len() { hijos[p as usize].push(k); } } }
    let mut mapa = HashMap::new(); let mut out: Vec<Value> = vec![];
    fn rec(i: usize, pa: i64, arb: &[Value], hijos: &[Vec<usize>], mapa: &mut HashMap<usize, usize>, out: &mut Vec<Value>) {
        let mut n = arb[i].clone(); n["pa"] = Value::from(pa); mapa.insert(i, out.len()); let yo = out.len() as i64; out.push(n);
        for &k in &hijos[i] { if k > i { rec(k, yo, arb, hijos, mapa, out); } }
    }
    rec(i0, -1, arb, &hijos, &mut mapa, &mut out);
    for n in out.iter_mut() {
        if let Some(bo) = n["bo"].as_array() { let nb: Vec<Value> = bo.iter().map(|b| Value::from(b.as_u64().and_then(|b| mapa.get(&(b as usize))).map(|&x| x as i64).unwrap_or(-1))).collect(); n["bo"] = Value::from(nb); }
    }
    if let Some(o) = out[0].as_object_mut() { o.remove("off"); }
    out
}

impl Vista {
    /// el arma `nodo` (GM_PhysGun, GM_GravGun, GM_ToolGun, Crowbar…) y una escena con lo que el motor todavía no tiene
    pub fn cargar(paq: &mut Paquete, nodo: &str, tmax: u32, ya: &mut Cargados) -> Result<(Vista, Escena), String> {
        let clave = crate::objetos::por_nombre(&paq.d).get("PhotonPlayer").cloned().ok_or("no está el PhotonPlayer")?;
        let sub = {
            let arb = paq.d["pf"][&clave].as_array().ok_or("PhotonPlayer raro")?;
            let ws = arb.iter().position(|n| n["n"].as_str() == Some("WalkSway")).ok_or("no está WalkSway")? as i64;
            let i0 = arb.iter().position(|n| n["pa"].as_i64() == Some(ws) && n["n"].as_str() == Some(nodo)).ok_or(format!("no está el arma {nodo}"))?;
            sub_arbol(arb, i0)
        };
        let n = sub.len();
        let pa: Vec<i32> = sub.iter().map(|x| x["pa"].as_i64().unwrap_or(-1) as i32).collect();
        let act: Vec<bool> = sub.iter().map(|x| x["off"].is_null()).collect();
        let mesh: Vec<bool> = sub.iter().map(|x| x["m"].as_i64().map(|m| m >= 0).unwrap_or(false) && x["mt"].is_array() && x["mroff"].is_null()).collect();
        let ks: Vec<String> = (0..n).filter(|&i| mesh[i]).filter_map(|i| sub[i]["m"].as_i64()).filter_map(|m| paq.d["ms"][m as usize]["k"].as_str().map(|s| s.to_string())).collect();
        for k in ks { paq.asegurar(&k)?; }
        let d = &paq.d;
        let p: Vec<V> = sub.iter().map(|x| v3(&x["p"], [0.0; 3])).collect();
        let r: Vec<Q> = sub.iter().map(|x| q4(&x["r"], [0.0, 0.0, 0.0, 1.0])).collect();
        let s: Vec<V> = sub.iter().map(|x| v3(&x["s"], [1.0; 3])).collect();
        let mut datos: Vec<u8> = vec![];
        let mut poner = |b: &[u8]| -> usize { let o = datos.len(); datos.extend_from_slice(b); while datos.len() % 4 != 0 { datos.push(0); } o };
        let (mut mallas, mut mats, mut texs): (Vec<Malla>, Vec<Mat>, Vec<Tex>) = (vec![], vec![], vec![]);
        let (mut pieles, mut rigidas) = (vec![], vec![]);
        for i in 0..n {
            if !mesh[i] { continue; }
            let x = &sub[i]; let mi = x["m"].as_i64().unwrap_or(-1); let md = &d["ms"][mi as usize];
            let (Some(subs), Some(bin)) = (md["sub"].as_array(), paq.bin_de(md)) else { continue };
            let bo = x["bo"].as_array(); let sk = md["sk"].as_u64().filter(|_| bo.is_some());
            if ya.mallas.insert(mi) {
                let (v, o, ii) = (md["v"].as_u64().unwrap_or(0) as usize, md["o"].as_u64().unwrap_or(0) as usize, md["i"].as_u64().unwrap_or(0) as usize);
                let i32 = md["i32"].as_bool().unwrap_or(false); let ni = subs.iter().map(|s| s[0].as_u64().unwrap_or(0) + s[1].as_u64().unwrap_or(0)).max().unwrap_or(0) as usize;
                let vb = bin.get(o..o + v * 14).ok_or("malla cortada")?; let ib = bin.get(ii..ii + ni * if i32 { 4 } else { 2 }).ok_or("índices cortados")?;
                let vo = poner(vb); let io = poner(ib);
                let so = match sk { Some(sk) => { let sb = bin.get(sk as usize..sk as usize + v * 8).ok_or("piel cortada")?; poner(sb) as i64 } None => -1 };
                mallas.push(Malla { id: mi, v: v as u32, mn: v3(&md["mn"], [0.0; 3]), sc: v3(&md["sc"], [1.0; 3]), i32: i32 as u8, ni: ni as u32, vo, io, lo: -1, so, lm: -1 });
            }
            let (mn, sc) = (v3(&md["mn"], [0.0; 3]), v3(&md["sc"], [1.0; 3]));
            let c = [mn[0] + sc[0] / 2.0, mn[1] + sc[1] / 2.0, mn[2] + sc[2] / 2.0]; let rr = (sc[0] * sc[0] + sc[1] * sc[1] + sc[2] * sc[2]).sqrt() / 2.0;
            let mut partes = vec![];
            for (k, mt) in x["mt"].as_array().into_iter().flatten().enumerate() {
                let Some(mt) = mt.as_i64() else { continue }; if mt < 0 { continue; }
                let Some(sp) = subs.get(k) else { continue };
                if !ya.mats.contains(&mt) { match material(d, mt as usize) { Some(m) => { ya.mats.insert(mt); mats.push(m); } None => continue } }
                partes.push((sp[0].as_u64().unwrap_or(0) as u32, sp[1].as_u64().unwrap_or(0) as u32, mt));
            }
            match (bo, sk) {
                (Some(bo), Some(_)) => {
                    let bp: Vec<M4> = md["bp"].as_array().map(|a| a.iter().map(|m| { let mut o = [0.0f32; 16]; for (k, e) in o.iter_mut().enumerate() { *e = f(&m[k]); } o }).collect()).unwrap_or_default();
                    pieles.push(Piel { i, m: mi, bo: bo.iter().map(|b| b.as_i64().unwrap_or(-1) as i32).collect(), bp, partes, c, r: rr });
                }
                _ => for (s0, sn, mat) in partes { rigidas.push(Rigida { i, m: mi, s0, sn, mat, c, r: rr }); },
            }
        }
        let quiero: Vec<i64> = mats.iter().flat_map(|m| { let mut v = vec![m.t, m.t2]; if let Some(t) = &m.terr { v.extend(t.iter().map(|x| x.0)); } v }).filter(|&t| t >= 0).collect();
        for t in quiero {
            if !ya.texs.insert(t) { continue; }
            if let Some((tw, th, px)) = paq.textura(t as usize, tmax) {
                let a = d["tx"][t as usize]["a"].as_i64().unwrap_or(0) as u8; let o = poner(&px);
                texs.push(Tex { id: t, n: d["tx"][t as usize]["n"].as_str().unwrap_or("").to_string(), w: tw, h: th, a, o });
            }
        }
        // los caminos relativos → índice (las pistas buscan el nodo por el crc32 de su camino; la raíz es "")
        let nombres: Vec<String> = sub.iter().map(|x| x["n"].as_str().unwrap_or("").to_string()).collect();
        let mut por_hash = HashMap::new(); por_hash.insert(crc32(""), 0);
        for i in 1..n { let mut c = vec![]; let mut k = i as i32; while k > 0 { c.push(nombres[k as usize].as_str()); k = pa[k as usize]; } c.reverse(); por_hash.insert(crc32(&c.join("/")), i); }
        let mz = nombres.iter().position(|x| x == "Muzzle" || x == "MuzzlePoint" || x.contains("StartLinePoint") || x.contains("weapon_end"));
        let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas, mats, texs, lms: vec![], items: vec![], agua: None, cielo: None };
        Ok((Vista { nodo: nodo.to_string(), pa, act, mesh, p, r, s, w: vec![m4::id(); n], raiz: m4::id(), pieles, rigidas, por_hash, mz, clip: None, t: 0.0, vel: 1.0, bucle: false, mantener: false }, Escena { c: cab, datos }))
    }

    /// vistaTocar: empieza un clip (devuelve lo que dura)
    pub fn tocar(&mut self, clip: Option<Arc<Clip>>, bucle: bool) -> f32 {
        let Some(c) = clip else { return 0.0 };
        let d = c.d; self.clip = Some(c); self.t = 0.0; self.vel = 1.0; self.bucle = bucle; self.mantener = false; d
    }
    /// ¿terminó el clip (uno que no se repite)?
    pub fn termino(&self) -> bool { self.clip.as_ref().map(|c| !self.bucle && self.t >= c.d).unwrap_or(true) }

    /// vistaAplicar: avanza el clip y pone la pose (entre dos cuadros; los giros por el camino corto)
    pub fn aplicar(&mut self, dt: f32, fps: f32) {
        let Some(c) = self.clip.clone() else { return };
        self.t += dt * self.vel;
        let t = if self.bucle && c.d > 0.0 { self.t % c.d } else { self.t.min(c.d) };
        let fr = t * fps; let i0 = fr.floor() as usize; let w = fr - i0 as f32;
        for pz in &c.pistas {
            let Some(&i) = self.por_hash.get(&pz.h) else { continue };
            let n = pz.f.len(); if n == 0 { continue; }
            let (a, b) = (&pz.f[i0.min(n - 1)], &pz.f[(i0 + 1).min(n - 1)]);
            match pz.k {
                b'a' => { let on = (if w < 0.5 { a } else { b }).first().copied().unwrap_or(1.0) > 0.5; self.act[i] = on; }
                b'r' if a.len() >= 4 && b.len() >= 4 => {
                    let mut bb = [b[0], b[1], b[2], b[3]]; if a[0] * bb[0] + a[1] * bb[1] + a[2] * bb[2] + a[3] * bb[3] < 0.0 { bb = [-bb[0], -bb[1], -bb[2], -bb[3]]; }
                    let mut q = [a[0] + (bb[0] - a[0]) * w, a[1] + (bb[1] - a[1]) * w, a[2] + (bb[2] - a[2]) * w, a[3] + (bb[3] - a[3]) * w];
                    let l = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt(); let l = if l > 0.0 { l } else { 1.0 }; for e in q.iter_mut() { *e /= l; }
                    self.r[i] = q;
                }
                b'p' | b's' if a.len() >= 3 && b.len() >= 3 => {
                    let v = [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w];
                    if pz.k == b'p' { self.p[i] = v; } else { self.s[i] = v; }
                }
                _ => {}
            }
        }
    }

    /// vistaUbicar: delante de la cámara (pos y giro), con el vaivén (sway: x, y, z, qx, qy) a la escala 0,3 de SmoothCamera
    pub fn ubicar(&mut self, cam: V, cam_q: Q, sway: [f32; 5]) {
        let b = trs(cam, cam_q, [1.0; 3]);
        let o = trs([sway[0], sway[1], sway[2]], [sway[3], sway[4], 0.0, 1.0], [0.3; 3]);
        self.raiz = m4::mul(&b, &o);
        self.actualizar();
    }
    fn actualizar(&mut self) {
        for i in 0..self.w.len() {
            // (la raíz con su lugar en WalkSway: es donde va el arma respecto de la cámara)
            let l = trs(self.p[i], self.r[i], self.s[i]);
            self.w[i] = if self.pa[i] < 0 { m4::mul(&self.raiz, &l) } else { m4::mul(&self.w[self.pa[i] as usize], &l) };
        }
    }
    fn visible(&self, i: usize) -> bool { let mut k = i as i32; while k >= 0 { if !self.act[k as usize] { return false; } k = self.pa[k as usize]; } self.mesh[i] }

    /// la boca del arma en el mundo (vistaPuntaMundo)
    pub fn punta(&self) -> Option<V> { self.mz.map(|i| [self.w[i][12], self.w[i][13], self.w[i][14]]) }

    /// lo que se dibuja (sin sombra: el arma está pegada a la cámara)
    pub fn items(&self, out: &mut Vec<ItemDin>) {
        for x in &self.rigidas {
            if !self.visible(x.i) { continue; }
            let w = &self.w[x.i]; let c = punto(w, x.c);
            out.push(ItemDin { m: x.m, s0: x.s0, sn: x.sn, mat: x.mat, mm: *w, esf: [c[0], c[1], c[2], x.r * escala(w)], fl: FL_SIN_SOMBRA, h: vec![] });
        }
        for pz in &self.pieles {
            if !self.visible(pz.i) { continue; }
            let mut h = Vec::with_capacity(pz.bo.len().max(1) * 12);
            for (b, &bi) in pz.bo.iter().take(56).enumerate() {
                let w = if bi >= 0 { &self.w[bi as usize] } else { &self.w[pz.i] };
                let bp = pz.bp.get(b).copied().unwrap_or_else(m4::id);
                let bc: M4 = [bp[0], bp[4], bp[8], bp[12], bp[1], bp[5], bp[9], bp[13], bp[2], bp[6], bp[10], bp[14], bp[3], bp[7], bp[11], bp[15]];
                let wm = m4::mul(w, &bc); for r in 0..3 { for c in 0..4 { h.push(wm[c * 4 + r]); } }
            }
            if h.is_empty() { h.extend_from_slice(&[1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0]); }
            let w = &self.w[pz.i]; let c = punto(w, pz.c);
            for &(s0, sn, mat) in &pz.partes { out.push(ItemDin { m: pz.m, s0, sn, mat, mm: m4::id(), esf: [c[0], c[1], c[2], pz.r * 4.0 * escala(w).max(0.3)], fl: FL_SIN_SOMBRA, h: h.clone() }); }
        }
    }
}
fn punto(m: &M4, p: V) -> V { [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] }
fn escala(m: &M4) -> f32 { (m[0] * m[0] + m[1] * m[1] + m[2] * m[2]).sqrt().max((m[4] * m[4] + m[5] * m[5] + m[6] * m[6]).sqrt()).max((m[8] * m[8] + m[9] * m[9] + m[10] * m[10]).sqrt()) }

/// el id de la malla y del material del tubo del rayo (propios: negativos y lejos de los del paquete)
pub const TUBO_MALLA: i64 = -3001;
pub const TUBO_MAT: i64 = -3002;
/// los otros colores del tubo: verde (un cable con señal), azul (un cable sin señal) y amarillo (la traza de la Tool Gun)
pub const TUBO_VERDE: i64 = -3003; pub const TUBO_AZUL: i64 = -3004; pub const TUBO_AMARILLO: i64 = -3005;
/// la malla del tubo (un cilindro de 8 caras, radio 1, de z 0 a 1: ajxTubo) y su material, celeste y brillante como el
/// rayo de la Physics Gun de GMod (dibujarRayoFisica: [0,35, 0,78, 1])
pub fn tubo() -> Escena {
    let lados = 8; let mut vb: Vec<u8> = vec![]; let mut ib: Vec<u8> = vec![];
    // (las posiciones en 16 bits entre mn = (-1, -1, 0) y mn + sc = (1, 1, 1))
    let q = |x: f32| (((x + 1.0) / 2.0).clamp(0.0, 1.0) * 65535.0).round() as u16;
    let qz = |z: f32| (z.clamp(0.0, 1.0) * 65535.0).round() as u16;
    let half1 = 0x3c00u16; let half0 = 0u16;
    for k in 0..=lados { for z in [0.0f32, 1.0] {
        let a = k as f32 / lados as f32 * std::f32::consts::TAU; let (s, c) = a.sin_cos();
        for v in [q(c), q(s), qz(z)] { vb.extend_from_slice(&v.to_le_bytes()); }
        vb.extend_from_slice(&[(c * 127.0) as i8 as u8, (s * 127.0) as i8 as u8, 0, 127]);
        vb.extend_from_slice(&(if k % 2 == 0 { half0 } else { half1 }).to_le_bytes()); vb.extend_from_slice(&(if z > 0.5 { half1 } else { half0 }).to_le_bytes());
    } }
    for k in 0..lados { let a = (k * 2) as u16; for i in [a, a + 2, a + 1, a + 1, a + 2, a + 3] { ib.extend_from_slice(&i.to_le_bytes()); } }
    let ni = (lados * 6) as u32; let nv = ((lados + 1) * 2) as u32;
    let mut datos = vb; while datos.len() % 4 != 0 { datos.push(0); } let io = datos.len(); datos.extend_from_slice(&ib);
    let malla = Malla { id: TUBO_MALLA, v: nv, mn: [-1.0, -1.0, 0.0], sc: [2.0, 2.0, 1.0], i32: 0, ni, vo: 0, io, lo: -1, so: -1, lm: -1 };
    let mat = |id: i64, c: [f32; 3], em: [f32; 3]| Mat { pbr: [0.3, 0.0, 0.04], fol: 0, id, t2: -1, terr: None, c: [c[0], c[1], c[2], 1.0], st: [1.0, 1.0, 0.0, 0.0], t: -1, blend: 0, cut: 0, unlit: 1, add: 0, agua: 0, em };
    let mats = vec![mat(TUBO_MAT, [0.35, 0.78, 1.0], [1.4, 3.1, 4.0]), mat(TUBO_VERDE, [0.3, 1.0, 0.4], [0.9, 3.0, 1.2]), mat(TUBO_AZUL, [0.2, 0.7, 1.0], [0.4, 1.4, 2.0]), mat(TUBO_AMARILLO, [1.0, 1.0, 0.3], [3.0, 3.0, 0.9])];
    let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![malla], mats, texs: vec![], lms: vec![], items: vec![], agua: None, cielo: None };
    Escena { c: cab, datos }
}
/// un tramo recto de tubo de `a` a `b`, de radio `r`, del material `mat` (los cables de la Tool Gun, su traza)
pub fn tramo(a: V, b: V, r: f32, mat: i64, out: &mut Vec<ItemDin>) {
    let d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; let l = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt(); if l < 1e-4 { return; }
    let z = [d[0] / l, d[1] / l, d[2] / l]; let up = if z[1].abs() > 0.95 { [1.0, 0.0, 0.0] } else { [0.0, 1.0, 0.0] };
    let k = up[0] * z[0] + up[1] * z[1] + up[2] * z[2]; let mut y = [up[0] - z[0] * k, up[1] - z[1] * k, up[2] - z[2] * k];
    let ly = (y[0] * y[0] + y[1] * y[1] + y[2] * y[2]).sqrt(); for e in y.iter_mut() { *e /= ly; }
    let x = [y[1] * z[2] - y[2] * z[1], y[2] * z[0] - y[0] * z[2], y[0] * z[1] - y[1] * z[0]];
    let mm = [x[0] * r, x[1] * r, x[2] * r, 0.0, y[0] * r, y[1] * r, y[2] * r, 0.0, d[0], d[1], d[2], 0.0, a[0], a[1], a[2], 1.0];
    out.push(ItemDin { m: TUBO_MALLA, s0: 0, sn: 48, mat, mm, esf: [(a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0, (a[2] + b[2]) / 2.0, l / 2.0 + r], fl: FL_SIN_SOMBRA, h: vec![] });
}
/// el rayo de la Physics Gun como tramos de tubo (ajxMundoDibujar): la curva de la boca `p0` a lo agarrado `p1` pasando por
/// el medio de la mira (`mid`), 16 tramos, de radio 0,012 que late con el tiempo
pub fn rayo_items(p0: V, mid: V, p1: V, t: f32, out: &mut Vec<ItemDin>) {
    let n = 16; let mut ant = p0;
    for i in 1..=n {
        let u = i as f32 / n as f32; let (a, b, c) = ((1.0 - u) * (1.0 - u), 2.0 * u * (1.0 - u), u * u);
        let pt = [p0[0] * a + mid[0] * b + p1[0] * c, p0[1] * a + mid[1] * b + p1[1] * c, p0[2] * a + mid[2] * b + p1[2] * c];
        let d = [pt[0] - ant[0], pt[1] - ant[1], pt[2] - ant[2]]; let l = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt();
        if l > 1e-4 {
            let z = [d[0] / l, d[1] / l, d[2] / l];
            let up = if z[1].abs() > 0.95 { [1.0, 0.0, 0.0] } else { [0.0, 1.0, 0.0] };
            let mut y = [up[0] - z[0] * (up[0] * z[0] + up[1] * z[1] + up[2] * z[2]), up[1] - z[1] * (up[0] * z[0] + up[1] * z[1] + up[2] * z[2]), up[2] - z[2] * (up[0] * z[0] + up[1] * z[1] + up[2] * z[2])];
            let ly = (y[0] * y[0] + y[1] * y[1] + y[2] * y[2]).sqrt(); for e in y.iter_mut() { *e /= ly; }
            let x = [y[1] * z[2] - y[2] * z[1], y[2] * z[0] - y[0] * z[2], y[0] * z[1] - y[1] * z[0]];
            let r = 0.012 * (1.0 + 0.25 * (t * 18.0 - i as f32 * 0.9).sin()); let lz = l * 1.02;
            let mm = [x[0] * r, x[1] * r, x[2] * r, 0.0, y[0] * r, y[1] * r, y[2] * r, 0.0, z[0] * lz, z[1] * lz, z[2] * lz, 0.0, ant[0], ant[1], ant[2], 1.0];
            out.push(ItemDin { m: TUBO_MALLA, s0: 0, sn: 48, mat: TUBO_MAT, mm, esf: [(ant[0] + pt[0]) / 2.0, (ant[1] + pt[1]) / 2.0, (ant[2] + pt[2]) / 2.0, l], fl: FL_SIN_SOMBRA, h: vec![] });
        }
        ant = pt;
    }
}

#[cfg(test)]
mod pruebas {
    #[test]
    fn crc() { assert_eq!(super::crc32("The quick brown fox jumps over the lazy dog"), 0x414fa339); assert_eq!(super::crc32(""), 0); }
}
