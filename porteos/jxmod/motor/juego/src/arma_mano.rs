//! El arma en la mano de los personajes (el cuerpo del jugador en tercera persona y los NPC), como personas.js y humano.js
//! de la versión web: la postura de cada arma (POSE_ARMA, con las de GMod que pone armasHL2) y sus gestos (ACC_ARMA), el
//! agarre como en GMod (agarreGm: cada falange apunta como en el jugador de GMod y la mano derecha se cierra sobre el
//! mango de verdad —dedosCalcular, cerrarSobreMango, mangoArma—, todo en el marco de la mano —manoMarco, manoCalibrar—,
//! que no depende de cómo esté armado cada esqueleto) y el modelo de mundo en la mano (armaGmDibujar: DATA.gm.armas con
//! su matriz G, agrandado con la mano; si no está, arma3p: el del juego en CharactersRoot/Weapons), con la pintura de
//! las de JXMod en todos sus materiales (ajxGmMundo). Lo que mueve los huesos está en personaje.rs; acá, las cuentas de
//! la mano y del mango (en doble, como los V3 de la web, y las matrices en float, como sus Float32Array) y lo que se carga.
use crate::mapa::{material, trs};
use crate::paquete::Paquete;
use crate::personaje::{sub_arbol, Cargados, Clip};
use jxmotor::escena::{Cabecera, Escena, ItemDin, Malla, Mat, Tex};
use jxmotor::mat::{self as m4, M4};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

type D3 = [f64; 3];
type DQ = [f64; 4];
type V = [f32; 3];
type Q = [f32; 4];

// ---------------- cuentas en doble (V3 y Quat de nucleo.js) ----------------
fn sub(a: D3, b: D3) -> D3 { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
fn add(a: D3, b: D3) -> D3 { [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
fn esc(a: D3, s: f64) -> D3 { [a[0] * s, a[1] * s, a[2] * s] }
fn dot(a: D3, b: D3) -> f64 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
fn cruz(a: D3, b: D3) -> D3 { [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
fn largo(a: D3) -> f64 { dot(a, a).sqrt() }
/// (V3.norm: si mide casi nada, queda como está)
fn norm(a: D3) -> D3 { let l = largo(a); if l > 1e-12 { esc(a, 1.0 / l) } else { a } }
fn qmul(a: DQ, b: DQ) -> DQ {
    [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
     a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]
}
fn qnorm(q: DQ) -> DQ { let l = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt(); let l = if l == 0.0 { 1.0 } else { l }; [q[0] / l, q[1] / l, q[2] / l, q[3] / l] }
fn qconj(q: DQ) -> DQ { [-q[0], -q[1], -q[2], q[3]] }
fn qrot(q: DQ, v: D3) -> D3 {
    let (qx, qy, qz, qw) = (q[0], q[1], q[2], q[3]);
    let (tx, ty, tz) = (2.0 * (qy * v[2] - qz * v[1]), 2.0 * (qz * v[0] - qx * v[2]), 2.0 * (qx * v[1] - qy * v[0]));
    [v[0] + qw * tx + qy * tz - qz * ty, v[1] + qw * ty + qz * tx - qx * tz, v[2] + qw * tz + qx * ty - qy * tx]
}
/// Quat.axis
fn qeje(e: D3, ang: f64) -> DQ { let s = (ang / 2.0).sin(); let l = largo(e); let l = if l == 0.0 { 1.0 } else { l }; [e[0] / l * s, e[1] / l * s, e[2] / l * s, (ang / 2.0).cos()] }
/// el giro de una matriz sin su escala (m4quat de modelo.js)
fn m4quat(m: &M4) -> DQ {
    let m: [f64; 16] = m.map(|x| x as f64);
    let (sx, sy, sz) = ((m[0] * m[0] + m[1] * m[1] + m[2] * m[2]).sqrt(), (m[4] * m[4] + m[5] * m[5] + m[6] * m[6]).sqrt(), (m[8] * m[8] + m[9] * m[9] + m[10] * m[10]).sqrt());
    let (a, b, c, d, e, f, g, h, k) = (m[0] / sx, m[1] / sx, m[2] / sx, m[4] / sy, m[5] / sy, m[6] / sy, m[8] / sz, m[9] / sz, m[10] / sz);
    let t = a + e + k;
    let q = if t > 0.0 { let s = (t + 1.0).sqrt() * 2.0; [(f - h) / s, (g - c) / s, (b - d) / s, 0.25 * s] }
        else if a > e && a > k { let s = (1.0 + a - e - k).sqrt() * 2.0; [0.25 * s, (d + b) / s, (g + c) / s, (f - h) / s] }
        else if e > k { let s = (1.0 + e - a - k).sqrt() * 2.0; [(d + b) / s, 0.25 * s, (h + f) / s, (g - c) / s] }
        else { let s = (1.0 + k - a - e).sqrt() * 2.0; [(g + c) / s, (h + f) / s, 0.25 * s, (b - d) / s] };
    qnorm(q)
}
/// el giro más corto de la dirección a a la b (rotEntre de personas.js)
fn rot_entre(a: D3, b: D3) -> DQ {
    let (la, lb) = (largo(a), largo(b)); if la < 1e-6 || lb < 1e-6 { return [0.0, 0.0, 0.0, 1.0]; }
    let c = cruz(a, b); let s = largo(c) / (la * lb); let d = dot(a, b) / (la * lb);
    if s < 1e-7 { return [0.0, 0.0, 0.0, 1.0]; }
    qeje(c, s.atan2(d))
}
fn pos(m: &M4) -> D3 { [m[12] as f64, m[13] as f64, m[14] as f64] }
/// m4pt (la matriz en float, la cuenta en doble)
fn pt(m: &M4, p: D3) -> D3 {
    let f = |k: usize| m[k] as f64;
    [f(0) * p[0] + f(4) * p[1] + f(8) * p[2] + f(12), f(1) * p[0] + f(5) * p[1] + f(9) * p[2] + f(13), f(2) * p[0] + f(6) * p[1] + f(10) * p[2] + f(14)]
}
/// sólo el giro (y la escala) de una matriz: F · v sin la posición
fn rotar(m: &M4, v: D3) -> D3 { let f = |k: usize| m[k] as f64; [f(0) * v[0] + f(4) * v[1] + f(8) * v[2], f(1) * v[0] + f(5) * v[1] + f(9) * v[2], f(2) * v[0] + f(6) * v[1] + f(10) * v[2]] }
/// M4.inv (en doble, a float)
pub(crate) fn inv(m: &M4) -> M4 {
    let a: [f64; 16] = m.map(|x| x as f64);
    let (a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33) = (a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], a[12], a[13], a[14], a[15]);
    let (b00, b01, b02, b03, b04, b05) = (a00 * a11 - a01 * a10, a00 * a12 - a02 * a10, a00 * a13 - a03 * a10, a01 * a12 - a02 * a11, a01 * a13 - a03 * a11, a02 * a13 - a03 * a12);
    let (b06, b07, b08, b09, b10, b11) = (a20 * a31 - a21 * a30, a20 * a32 - a22 * a30, a20 * a33 - a23 * a30, a21 * a32 - a22 * a31, a21 * a33 - a23 * a31, a22 * a33 - a23 * a32);
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if d == 0.0 { return [0.0; 16]; } let d = 1.0 / d;
    [(a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d, (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
     (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d, (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
     (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d, (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
     (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d, (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d].map(|x| x as f32)
}
fn f(v: &Value) -> f64 { v.as_f64().unwrap_or(0.0) }
fn d3(v: &Value) -> D3 { [f(&v[0]), f(&v[1]), f(&v[2])] }

// ---------------- los huesos de las manos ----------------
/// los dedos de GMod (DEDOS_GM) y las manos (la derecha agarra)
const DEDOS: [&str; 5] = ["Thumb", "Index", "Middle", "Ring", "Pinky"];
const LADOS: [&str; 2] = ["Right", "Left"];
/// los huesos de una mano (de huesosMixamo: el primero de cada nombre sin «mixamorig:»): la mano, las cuatro falanges del
/// medio, el índice, el meñique y el anular (los primeros) y las cuatro de cada dedo (pulgar a meñique)
#[derive(Clone, Debug, Default)]
pub(crate) struct ManoIx { mano: Option<usize>, medio: [Option<usize>; 4], indice: Option<usize>, menique: Option<usize>, anular: Option<usize>, dedos: [[Option<usize>; 4]; 5] }
impl ManoIx {
    fn de(ix: &HashMap<String, usize>, lado: &str) -> ManoIx {
        let g = |s: String| ix.get(&s).copied();
        ManoIx { mano: g(format!("{lado}Hand")), medio: [1, 2, 3, 4].map(|k| g(format!("{lado}HandMiddle{k}"))), indice: g(format!("{lado}HandIndex1")),
            menique: g(format!("{lado}HandPinky1")), anular: g(format!("{lado}HandRing1")), dedos: DEDOS.map(|d| [1, 2, 3, 4].map(|k| g(format!("{lado}Hand{d}{k}")))) }
    }
}
/// el marco de la mano del Hero respecto de su hueso de la mano y el largo respecto de la muñeca al índice (manoCalibrar:
/// para las manos sin todos los dedos)
#[derive(Clone, Debug)]
pub(crate) struct Cal { k: M4, r: f64 }
/// las dos manos de un esqueleto (0 la derecha, 1 la izquierda) y, si les faltan dedos, la calibración del Hero
#[derive(Clone, Debug, Default)]
pub struct Manos { l: [ManoIx; 2], cal: [Option<Cal>; 2] }
/// el nombre humano de los huesos de Mixamo (huesosMixamo): «mixamorig:LeftHandIndex1» → «LeftHandIndex1», el primero
fn huesos_mixamo(nombres: &[String]) -> HashMap<String, usize> {
    let mut ix = HashMap::new();
    for (i, n) in nombres.iter().enumerate() {
        let Some(r) = n.strip_prefix("mixamorig") else { continue }; let r = r.trim_start_matches(|c: char| c.is_ascii_digit());
        if let Some(m) = r.strip_prefix(':') { ix.entry(m.to_string()).or_insert(i); }
    }
    ix
}
impl Manos {
    /// las manos de un esqueleto (sus nombres) y, si a alguna le faltan dedos, la del Hero en reposo (`hero`: sus nombres
    /// y sus matrices desde la raíz) para calibrarla
    pub(crate) fn de(nombres: &[String], hero: impl FnOnce() -> Option<(Vec<String>, Vec<M4>)>) -> Manos {
        let ix = huesos_mixamo(nombres);
        let l = LADOS.map(|s| ManoIx::de(&ix, s));
        let falta = l.iter().any(|m| m.mano.is_some() && (m.medio[0].is_none() || m.indice.is_none() || m.menique.or(m.anular).is_none()));
        let mut cal = [None, None];
        if falta {
            if let Some((hn, hw)) = hero() {
                let hix = huesos_mixamo(&hn);
                for k in 0..2 {
                    let m = ManoIx::de(&hix, LADOS[k]);
                    let (Some((fm, lm)), Some(h), Some(i)) = (mano_marco(&hw, &m, None), m.mano, m.indice) else { continue };
                    let (h, i) = (hw[h], hw[i]);
                    let s = { let s = ((h[0] * h[0] + h[1] * h[1] + h[2] * h[2]) as f64).sqrt(); if s == 0.0 { 1.0 } else { s } };
                    let mut hn = h; for c in 0..12 { if c % 4 != 3 { hn[c] = (h[c] as f64 / s) as f32; } }
                    cal[k] = Some(Cal { k: m4::mul(&inv(&hn), &fm), r: lm / largo(sub(pos(&i), pos(&h))) });
                }
            }
        }
        Manos { l, cal }
    }
    /// la mano (0 derecha, 1 izquierda)
    pub(crate) fn mano(&self, k: usize) -> Option<usize> { self.l[k].mano }
    /// el marco de la mano `k` en estas matrices (ver `mano_marco`)
    pub(crate) fn marco(&self, w: &[M4], k: usize) -> Option<(M4, f64)> { mano_marco(w, &self.l[k], self.cal[k].as_ref()) }
}

/// el marco de la mano (manoMarco): las columnas x (de la muñeca al nudillo del medio), y (la normal de la palma), z y el
/// origen en la muñeca (en float, como el Float32Array de la web) y el largo de la muñeca al nudillo del medio. Las manos
/// sin meñique usan el anular; las que tienen menos dedos, el hueso de la mano con el marco que tiene el del Hero
fn mano_marco(w: &[M4], m: &ManoIx, cal: Option<&Cal>) -> Option<(M4, f64)> {
    let h = &w[m.mano?];
    let (Some(mi), Some(ii), Some(ki)) = (m.medio[0], m.indice, m.menique.or(m.anular)) else {
        let (c, i) = (cal?, &w[m.indice?]);
        let mut o = m4::mul(h, &c.k);
        let s = ((o[0] as f64).powi(2) + (o[1] as f64).powi(2) + (o[2] as f64).powi(2)).sqrt(); let s = if s == 0.0 { 1.0 } else { s };
        for k in 0..12 { if k % 4 != 3 { o[k] = (o[k] as f64 / s) as f32; } }
        let l = largo(sub(pos(i), pos(h))) * c.r;
        return if l != 0.0 { Some((o, l)) } else { None };
    };
    let (mm, ix, kx) = (&w[mi], &w[ii], &w[ki]);
    let mut x = sub(pos(mm), pos(h)); let mut l = largo(x); if l == 0.0 { l = 1.0; } x = esc(x, 1.0 / l);
    // (hay esqueletos con el hueso de la mano a mitad del antebrazo: ahí la muñeca va 1,15 dedos atrás del nudillo y la
    // mano mide eso; el largo del dedo, la suma de sus falanges)
    let mut o = pos(h);
    let (mut fl, mut ant) = (0.0, pos(mm));
    for s in 1..4 { let Some(q) = m.medio[s] else { break }; let q = pos(&w[q]); fl += largo(sub(q, ant)); ant = q; }
    if fl > 1e-4 && l > 1.5 * fl { l = 1.15 * fl; o = sub(pos(mm), esc(x, l)); }
    let (a, b) = (sub(pos(kx), o), sub(pos(ix), o));
    let mut n = cruz(a, b); let dn = dot(n, x); n = sub(n, esc(x, dn));
    let ln = largo(n); let ln = if ln == 0.0 { 1.0 } else { ln }; n = esc(n, 1.0 / ln);
    let z = cruz(x, n);
    Some(([x[0], x[1], x[2], 0.0, n[0], n[1], n[2], 0.0, z[0], z[1], z[2], 0.0, o[0], o[1], o[2], 1.0].map(|v| v as f32), l))
}

// ---------------- el mango ----------------
/// el mango del arma en el marco de la mano (mangoArma): el centro, el eje y el radio de lo que queda dentro de la mano
#[derive(Clone, Copy, Debug)]
pub struct Mango { pub c: D3, pub ax: D3, pub r: f64 }
/// lo lejos que queda un punto del eje del mango (ejeMango)
pub fn eje_mango(q: D3, m: &Mango) -> f64 { let d = sub(q, m.c); largo(sub(d, esc(m.ax, dot(d, m.ax)))) }
/// cuánto rodea una cadena de puntos el eje del mango, en grados del primero al último (rodeaMango)
pub fn rodea_mango(q: &[D3], m: &Mango) -> f64 {
    let pp = |p: D3| { let d = sub(p, m.c); sub(d, esc(m.ax, dot(d, m.ax))) };
    let Some(&q0) = q.first() else { return 0.0 };
    let r = norm(pp(q0)); let e2 = cruz(m.ax, r); let (mut tot, mut prev) = (0.0, None::<f64>);
    for &p in q {
        let u = pp(p); let a = dot(u, e2).atan2(dot(u, r));
        if let Some(pv) = prev { let mut da = a - pv; while da > std::f64::consts::PI { da -= std::f64::consts::TAU; } while da < -std::f64::consts::PI { da += std::f64::consts::TAU; } tot += da; }
        prev = Some(a);
    }
    tot.abs().to_degrees()
}

// ---------------- lo de cada arma ----------------
/// hacia dónde apunta cada falange en GMod (en el marco de la mano), de cada mano y dedo, y de la derecha dónde quedan las
/// articulaciones y la punta (en largos de la mano): DATA.gm.dedos[tipo]
#[derive(Clone, Debug, Default)]
struct DedosGm { dirs: [[Option<Vec<D3>>; 5]; 2], pos: [Option<Vec<D3>>; 5] }
/// el agarre de un arma de GMod (DATA.gm.armas[nombre]): su matriz en el marco de la mano (G), el tamaño de la mano de
/// GMod (DATA.gm.manoR.L), los dedos de su tipo y su malla en la CPU (mallaCPU: para medir el mango)
#[derive(Clone, Debug)]
pub(crate) struct Agarre { g: M4, mano_l: f64, dedos: Option<DedosGm>, p: Vec<D3>, i: Vec<u32> }
/// una parte del modelo de mundo: el nodo, la malla, su tramo, el material y su esfera (centro y radio en la malla)
#[derive(Clone, Debug)]
struct Parte { nodo: usize, m: i64, s0: u32, sn: u32, mat: i64, c: V, r: f32 }
/// el modelo de mundo: sus nodos (padre, activo, local) y sus partes; `w0`: con el del juego (arma3p), la matriz del nodo
/// Weapons (lo que va entre la mano y el arma); con el de GMod, None (va en el marco de la mano por G)
#[derive(Clone, Debug)]
struct Dibujo { nodos: Vec<(i32, bool, M4)>, partes: Vec<Parte>, w0: Option<M4> }

/// un arma en la mano: el nombre (P.arma), la postura (estado Pose de DATA.hu) y los gestos de tirar y recargar con su
/// duración (humAccion), el agarre de GMod y el modelo de mundo
pub struct ArmaMano {
    pub nombre: String,
    pub(crate) pose: Option<(String, Arc<Clip>)>,
    pub(crate) tiro: Option<(Arc<Clip>, f32)>, pub(crate) recarga: Option<(Arc<Clip>, f32)>,
    pub(crate) agarre: Option<Agarre>,
    dib: Option<Dibujo>,
}

/// la pintura de las armas de JXMod en la mano (DEF_ARMAS[n].jx de armas.js: «fisica», «gravedad», «tool», «palanca»)
pub fn jx_de(nombre: &str) -> &'static str { match nombre { "PhysicsGun" => "fisica", "GravityGun" => "gravedad", "ToolBaton" => "tool", "Crowbar" => "palanca", _ => "" } }
/// el modelo del juego de cada arma en CharactersRoot/Weapons (ARMA_3P)
fn arma_3p(n: &str) -> Option<&'static str> {
    Some(match n { "Pistol" => "pistol", "Revolver" => "revolver", "Smg" => "smg", "Akm" => "Akm", "Sniper" => "sniper", "Shotgun" => "Shotgun", "RPG" => "RocketLauncher", "Crossbow" => "crossbow",
        "Bat" => "bat", "GravityGun" => "GravityGun", "PhysicsGun" => "PhysicGun", "ToolBaton" => "ToolBaton", _ => return None })
}
/// el clip `nombre` del estado `est` (humClipNombre: el primero con ese nombre)
pub(crate) fn clip_nombre(d: &Value, est: &str, nombre: &str) -> Option<Arc<Clip>> {
    d["hu"]["est"][est].as_array()?.iter().find(|c| c["n"].as_str() == Some(nombre)).map(|c| Arc::new(Clip::de(c)))
}
impl ArmaMano {
    /// el arma `nombre` (la de DEF_ARMAS: «Pistol», «PhysicsGun», «Hands»…) y una escena con lo que el motor todavía no tiene
    /// de su modelo de mundo (`ya`: lo que ya tiene, el mismo que el del cuerpo). Sin pintura de JXMod si `clasicas` (el mod
    /// «Armas clásicas»)
    pub fn cargar(paq: &mut Paquete, nombre: &str, clasicas: bool, tmax: u32, ya: &mut Cargados) -> Result<(ArmaMano, Escena), String> {
        let gma = paq.d["gm"]["armas"][nombre].clone();
        // el modelo: el de GMod (una malla con su matriz G en el marco de la mano) o el del juego (arma3p)
        let mut nodos_arb: Vec<Value> = vec![]; let mut w0 = None;
        if gma.is_object() {
            nodos_arb.push(serde_json::json!({ "n": nombre, "p": [0, 0, 0], "r": [0, 0, 0, 1], "s": [1, 1, 1], "pa": -1, "m": gma["m"], "mt": gma["mt"] }));
        } else if let Some(n3) = arma_3p(nombre) {
            if let Some(clave) = crate::objetos::por_nombre(&paq.d).get("PhotonPlayer").cloned() {
                if let Some(arb) = paq.d["pf"][&clave].as_array() {
                    let cr = arb.iter().position(|x| x["n"].as_str() == Some("CharactersRoot")).map(|i| i as i64);
                    let wi = arb.iter().position(|x| x["pa"].as_i64() == cr && cr.is_some() && x["n"].as_str() == Some("Weapons"));
                    let ni = wi.and_then(|wi| arb.iter().position(|x| x["pa"].as_i64() == Some(wi as i64) && x["n"].as_str() == Some(n3)));
                    if let (Some(wi), Some(ni)) = (wi, ni) {
                        let x = &arb[wi]; let v = |a: &Value, dd: V| if a.is_array() { [f(&a[0]) as f32, f(&a[1]) as f32, f(&a[2]) as f32] } else { dd };
                        let r = if x["r"].is_array() { [f(&x["r"][0]) as f32, f(&x["r"][1]) as f32, f(&x["r"][2]) as f32, f(&x["r"][3]) as f32] } else { [0.0, 0.0, 0.0, 1.0] };
                        w0 = Some(trs(v(&x["p"], [0.0; 3]), r, v(&x["s"], [1.0; 3])));
                        nodos_arb = sub_arbol(arb, ni);
                    }
                }
            }
        }
        let ver = |x: &Value| x["m"].as_i64().map(|m| m >= 0).unwrap_or(false) && x["mt"].is_array() && x["mroff"].is_null();
        let ks: Vec<String> = nodos_arb.iter().filter(|x| ver(x)).filter_map(|x| x["m"].as_i64()).filter_map(|m| paq.d["ms"][m as usize]["k"].as_str().map(String::from)).collect();
        for k in ks { paq.asegurar(&k)?; }
        let d = &paq.d;
        let jx = if clasicas { "" } else { jx_de(nombre) };
        let (pal, kp) = (crate::vista::paleta(jx), crate::vista::JX.iter().position(|x| *x == jx).unwrap_or(0));
        let mut datos: Vec<u8> = vec![];
        let mut poner = |b: &[u8]| -> usize { let o = datos.len(); datos.extend_from_slice(b); while datos.len() % 4 != 0 { datos.push(0); } o };
        let (mut mallas, mut mats, mut texs): (Vec<Malla>, Vec<Mat>, Vec<Tex>) = (vec![], vec![], vec![]);
        let mut dib = None;
        if !nodos_arb.is_empty() {
            let v3 = |a: &Value, dd: V| if a.is_array() { [f(&a[0]) as f32, f(&a[1]) as f32, f(&a[2]) as f32] } else { dd };
            let mut nodos = vec![]; let mut act: Vec<bool> = vec![];
            for x in &nodos_arb {
                let pa = x["pa"].as_i64().unwrap_or(-1) as i32;
                let a = x["off"].is_null() && (pa < 0 || act[pa as usize]); act.push(a);
                let r = if x["r"].is_array() { [f(&x["r"][0]) as f32, f(&x["r"][1]) as f32, f(&x["r"][2]) as f32, f(&x["r"][3]) as f32] } else { [0.0, 0.0, 0.0, 1.0] };
                nodos.push((pa, a, trs(v3(&x["p"], [0.0; 3]), r, v3(&x["s"], [1.0; 3]))));
            }
            let mut partes = vec![];
            for (i, x) in nodos_arb.iter().enumerate() {
                if !act[i] || !ver(x) { continue; }
                let mi = x["m"].as_i64().unwrap_or(-1); let md = &d["ms"][mi as usize];
                let (Some(subs), Some(bin)) = (md["sub"].as_array(), paq.bin_de(md)) else { continue };
                if ya.mallas.insert(mi) {
                    let (v, o, ii) = (md["v"].as_u64().unwrap_or(0) as usize, md["o"].as_u64().unwrap_or(0) as usize, md["i"].as_u64().unwrap_or(0) as usize);
                    let i32 = md["i32"].as_bool().unwrap_or(false); let ni = subs.iter().map(|s| s[0].as_u64().unwrap_or(0) + s[1].as_u64().unwrap_or(0)).max().unwrap_or(0) as usize;
                    let vb = bin.get(o..o + v * 14).ok_or("malla cortada")?; let ib = bin.get(ii..ii + ni * if i32 { 4 } else { 2 }).ok_or("índices cortados")?;
                    let vo = poner(vb); let io = poner(ib);
                    mallas.push(Malla { id: mi, v: v as u32, mn: v3(&md["mn"], [0.0; 3]), sc: v3(&md["sc"], [1.0; 3]), i32: i32 as u8, ni: ni as u32, vo, io, lo: -1, so: -1, lm: -1 });
                }
                let (mn, sc) = (v3(&md["mn"], [0.0; 3]), v3(&md["sc"], [1.0; 3]));
                let c = [mn[0] + sc[0] / 2.0, mn[1] + sc[1] / 2.0, mn[2] + sc[2] / 2.0]; let r = (sc[0] * sc[0] + sc[1] * sc[1] + sc[2] * sc[2]).sqrt() / 2.0;
                for (k, mt) in x["mt"].as_array().into_iter().flatten().enumerate() {
                    let Some(mt) = mt.as_i64() else { continue }; if mt < 0 { continue; }
                    let Some(sp) = subs.get(k) else { continue };
                    // (la de JXMod: md.tinte, la misma pintura en todos los materiales del modelo; el pintado va con otro id)
                    let id = if pal.is_some() { crate::vista::id_pintado(mt, kp) } else { mt };
                    if !ya.mats.contains(&id) { match material(d, mt as usize) { Some(mut m) => { if let Some(p) = pal { m.id = id; m.ti = p; } ya.mats.insert(id); mats.push(m); } None => continue } }
                    partes.push(Parte { nodo: i, m: mi, s0: sp[0].as_u64().unwrap_or(0) as u32, sn: sp[1].as_u64().unwrap_or(0) as u32, mat: id, c, r });
                }
            }
            if !partes.is_empty() { dib = Some(Dibujo { nodos, partes, w0 }); }
        }
        let quiero: Vec<i64> = mats.iter().flat_map(|m| { let mut v = vec![m.t, m.t2]; if let Some(t) = &m.terr { v.extend(t.iter().map(|x| x.0)); } v }).filter(|&t| t >= 0).collect();
        for t in quiero {
            if !ya.texs.insert(t) { continue; }
            if let Some((tw, th, px)) = paq.textura(t as usize, tmax) {
                let a = d["tx"][t as usize]["a"].as_i64().unwrap_or(0) as u8; let o = poner(&px);
                texs.push(Tex { id: t, n: d["tx"][t as usize]["n"].as_str().unwrap_or("").to_string(), w: tw, h: th, a, o });
            }
        }
        // el agarre de GMod: G, los dedos de su tipo y la malla en la CPU
        let agarre = if gma.is_object() {
            let mut g = [0.0f32; 16]; for (k, e) in g.iter_mut().enumerate() { *e = f(&gma["G"][k]) as f32; }
            let dd = gma["tipo"].as_str().map(|t| &d["gm"]["dedos"][t]).filter(|x| x.is_object()).map(|x| {
                let mut o = DedosGm::default();
                for (l, lado) in LADOS.iter().enumerate() { for (k, de) in DEDOS.iter().enumerate() { o.dirs[l][k] = x[*lado][*de].as_array().map(|a| a.iter().map(d3).collect()); } }
                for (k, de) in DEDOS.iter().enumerate() { o.pos[k] = x["Right"]["pos"][*de].as_array().map(|a| a.iter().map(d3).collect()); }
                o
            });
            let (mut p, mut ix) = (vec![], vec![]);
            let mi = gma["m"].as_i64().unwrap_or(-1); let md = &d["ms"][mi.max(0) as usize];
            if let (Some(bin), Some(subs)) = (paq.bin_de(md), md["sub"].as_array()) {
                let (nv, o, ii) = (md["v"].as_u64().unwrap_or(0) as usize, md["o"].as_u64().unwrap_or(0) as usize, md["i"].as_u64().unwrap_or(0) as usize);
                let (mn, sc) = (d3(&md["mn"]), d3(&md["sc"]));
                // (mallaCPU: las posiciones en Float32Array)
                for k in 0..nv { let q = o + k * 14; if q + 6 > bin.len() { break; } let u = |j: usize| u16::from_le_bytes([bin[q + j * 2], bin[q + j * 2 + 1]]) as f64 / 65535.0;
                    p.push([0, 1, 2].map(|e| (mn[e] + u(e) * sc[e]) as f32 as f64)); }
                let i32 = md["i32"].as_bool().unwrap_or(false); let n = subs.iter().map(|s| s[0].as_u64().unwrap_or(0) + s[1].as_u64().unwrap_or(0)).max().unwrap_or(0) as usize;
                for k in 0..n {
                    let v = if i32 { bin.get(ii + k * 4..ii + k * 4 + 4).map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]])) } else { bin.get(ii + k * 2..ii + k * 2 + 2).map(|b| u16::from_le_bytes([b[0], b[1]]) as u32) };
                    match v { Some(v) => ix.push(v), None => break }
                }
            }
            Some(Agarre { g, mano_l: f(&d["gm"]["manoR"]["L"]), dedos: dd, p, i: ix })
        } else { None };
        // la postura y los gestos
        let (pose_n, tiro_n, rec_n) = pose_y_gestos(d, nombre);
        let pose = pose_n.and_then(|n| clip_nombre(d, "Pose", &n).map(|c| (n, c)));
        let tiro = tiro_n.and_then(|n| {
            let c = clip_nombre(d, "Shooting", &n).or_else(|| clip_nombre(d, "Blend Tree", &n))?;
            // (los gestos de GMod, enteros; los demás, el comienzo)
            let dur = if !n.starts_with("gm_") { (c.d as f32).min(if n == "1HandSwordBackswing" || n == "Attack04" { 0.7 } else { 0.35 }) } else { c.d as f32 };
            Some((c, dur))
        });
        let recarga = rec_n.and_then(|n| clip_nombre(d, "Reload", &n)).map(|c| { let dur = c.d as f32; (c, dur) });
        let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas, mats, texs, lms: vec![], items: vec![], agua: None, cielo: None };
        Ok((ArmaMano { nombre: nombre.to_string(), pose, tiro, recarga, agarre, dib }, Escena { c: cab, datos }))
    }

    /// si tiene modelo de mundo
    pub fn con_modelo(&self) -> bool { self.dib.is_some() }

    /// la matriz del modelo de mundo en la mano (armaGmDibujar: el marco de la mano agrandado con la mano —hasta Jake, que
    /// es chiquito— por G; arma3p: la mano por el nodo Weapons), en el espacio de las matrices `w`
    pub(crate) fn matriz(&self, w: &[M4], manos: &Manos) -> Option<M4> {
        let d = self.dib.as_ref()?;
        match (&self.agarre, d.w0) {
            (Some(a), _) => {
                let (mut fm, l) = manos.marco(w, 0)?;
                let k = (l / a.mano_l).clamp(0.3, 2.6);
                for i in 0..12 { if i % 4 != 3 { fm[i] = (fm[i] as f64 * k) as f32; } }
                Some(m4::mul(&fm, &a.g))
            }
            (None, Some(w0)) => Some(m4::mul(&w[manos.mano(0)?], &w0)),
            _ => None,
        }
    }
    /// lo que se dibuja con la raíz del modelo en `raiz` (en el mundo)
    pub(crate) fn items(&self, raiz: &M4, out: &mut Vec<ItemDin>) {
        let Some(d) = &self.dib else { return };
        let mut w: Vec<M4> = Vec::with_capacity(d.nodos.len());
        for (pa, _, l) in &d.nodos { let m = if *pa < 0 { m4::mul(raiz, l) } else { m4::mul(&w[*pa as usize], l) }; w.push(m); }
        for p in &d.partes {
            let mm = w[p.nodo];
            let c = [mm[0] * p.c[0] + mm[4] * p.c[1] + mm[8] * p.c[2] + mm[12], mm[1] * p.c[0] + mm[5] * p.c[1] + mm[9] * p.c[2] + mm[13], mm[2] * p.c[0] + mm[6] * p.c[1] + mm[10] * p.c[2] + mm[14]];
            let e = [0, 4, 8].iter().map(|&o| (mm[o] * mm[o] + mm[o + 1] * mm[o + 1] + mm[o + 2] * mm[o + 2]).sqrt()).fold(0.0f32, f32::max);
            out.push(ItemDin { m: p.m, s0: p.s0, sn: p.sn, mat: p.mat, mm, esf: [c[0], c[1], c[2], p.r * e.max(1e-3)], fl: 0, h: vec![] });
        }
    }
}
/// los nombres de la postura (POSE_ARMA) y de los gestos de tirar y recargar (ACC_ARMA) de cada arma, como quedan después
/// de armasHL2
fn pose_y_gestos(d: &Value, n: &str) -> (Option<String>, Option<String>, Option<String>) {
    let pose = match n { "Pistol" | "Revolver" | "Camera" => Some("idle_armed2_m"), "PhysicsGun" | "GravityGun" => Some("gm_idle_gravgun"), "ToolBaton" => Some("gm_idle_pistol"),
        "Smg" | "Akm" | "Sniper" | "Shotgun" | "Crossbow" | "RPG" => Some("SniperRifleAim"), "Bat" => Some("1HandSwordReady"), "Crowbar" => Some("gm_idle_melee"), _ => None };
    let (t, r): (Option<&str>, Option<&str>) = match n {
        "Pistol" | "Revolver" => (Some("blend_shoot_1"), Some("blend_reload_1")), "Camera" => (Some("blend_shoot_1"), None), "ToolBaton" => (Some("gm_range_pistol"), None),
        "PhysicsGun" => (None, None), "GravityGun" => (Some("gm_range_gravgun"), None), "Smg" | "Akm" | "Shotgun" | "Crossbow" => (Some("blend_shoot_2"), Some("blend_reload_2")),
        "Sniper" => (Some("blend_shoot_2"), Some("SniperRifleReload")), "RPG" => (Some("RPGAttack"), Some("blend_reload_2")), "Bat" => (Some("1HandSwordBackswing"), None),
        "Hands" => (Some("Attack04"), None), "Crowbar" => (Some("gm_range_melee"), None), _ => (None, None) };
    let (mut pose, mut t, mut r) = (pose.map(String::from), t.map(String::from), r.map(String::from));
    // (armasHL2: las de Half-Life 2 con la postura y los gestos de GMod de su tipo; la recarga, si hay una de GMod)
    if d["gm"]["hl2"][n].is_object() { if let Some(tp) = d["gm"]["armas"][n]["tipo"].as_str() {
        pose = Some(format!("gm_idle_{tp}")); t = Some(format!("gm_range_{tp}"));
        let rg = format!("gm_reload_{tp}"); if clip_nombre(d, "Reload", &rg).is_some() { r = Some(rg); }
    } }
    (pose, t, r)
}

// ---------------- los dedos ----------------
/// un esqueleto aparte en reposo (new Modelo(D.sub) de dedosCalcular): los padres, lo activo, lo local y las matrices
/// desde la raíz (la raíz en el origen)
pub(crate) struct Esq<'a> { pub pa: &'a [i32], pub act: &'a [bool], pub p: &'a [V], pub r: Vec<Q>, pub s: &'a [V], pub w: Vec<M4> }
impl Esq<'_> {
    pub(crate) fn actualizar(&mut self) {
        for i in 0..self.w.len() {
            if !self.act[i] { continue; }
            let l = trs(self.p[i], self.r[i], self.s[i]);
            self.w[i] = if i == 0 || self.pa[i] < 0 { l } else { m4::mul(&self.w[self.pa[i] as usize], &l) };
        }
    }
    /// el giro nuevo de `a` (respecto de su padre) para que apunte de `cur` a `t` (en el mundo)
    fn apuntar(&mut self, a: usize, cur: D3, t: D3) -> Q {
        let pa = self.pa[a].max(0) as usize;
        let loc = qnorm(qmul(qconj(m4quat(&self.w[pa])), qmul(rot_entre(cur, t), m4quat(&self.w[a]))));
        let q = loc.map(|x| x as f32); self.r[a] = q; q
    }
}
/// los giros de los dedos para un arma, una vez por personaje (dedosCalcular): cada falange apunta como en GMod (en el
/// marco de la mano), en la pose de reposo, y la mano derecha se cierra sobre el mango (cerrarSobreMango). Son giros
/// respecto de la mano: sirven en cualquier pose. None si no hay dedos de GMod para su tipo
pub(crate) fn dedos_calcular(esq: &mut Esq, manos: &Manos, a: &Agarre) -> Option<Vec<(usize, Q)>> {
    let g = a.dedos.as_ref()?;
    esq.actualizar();
    let mut out: Vec<(usize, Q)> = vec![];
    for lado in 0..2 {
        let Some((fm, _)) = manos.marco(&esq.w, lado) else { continue };
        for (k, ix) in manos.l[lado].dedos.iter().enumerate() {
            let Some(dirs) = &g.dirs[lado][k] else { continue };
            for s in 0..3 {
                let (Some(ia), Some(ib)) = (ix[s], ix.get(s + 1).copied().flatten()) else { break };
                esq.actualizar();
                let cur = sub(pos(&esq.w[ib]), pos(&esq.w[ia])); let t = rotar(&fm, dirs.get(s).copied().unwrap_or([f64::NAN; 3]));
                let q = esq.apuntar(ia, cur, t); out.push((ia, q));
            }
        }
    }
    cerrar_sobre_mango(esq, manos, a, g, &mut out);
    Some(out)
}
/// la mano derecha que agarra (cerrarSobreMango): cada dedo (índice a meñique) se cierra sobre el mango de verdad. Desde
/// la postura de GMod se prueba cuánto más (o menos) doblar las tres articulaciones (alrededor del eje en que se dobla ese
/// dedo en GMod) y queda la que deja las articulaciones y la punta donde las tiene GMod (en el marco de la mano, a la
/// escala de la mano), sin meterse en el mango
fn cerrar_sobre_mango(esq: &mut Esq, manos: &Manos, a: &Agarre, g: &DedosGm, out: &mut Vec<(usize, Q)>) {
    esq.actualizar();
    let Some((fm, l)) = manos.marco(&esq.w, 0) else { return };
    if g.pos.iter().all(|x| x.is_none()) { return; }
    let fi = inv(&fm); let Some(m) = mango(a, l) else { return };
    let rf = 0.065 * l;   // (el radio de un dedo, con el tamaño de la mano)
    for k in 1..5 {
        let (Some(gd), Some(tg)) = (&g.dirs[0][k], &g.pos[k]) else { continue };
        let ids = manos.l[0].dedos[k]; if ids[0].is_none() || ids[1].is_none() || ids[2].is_none() { continue; }
        esq.actualizar();
        let mut j: Vec<D3> = (0..4).map(|e| ids[e].map(|b| pt(&fi, pos(&esq.w[b]))).unwrap_or([0.0; 3])).collect();
        if ids[3].is_none() { j[3] = add(j[2], esc(sub(j[2], j[1]), 0.8)); }
        let meta: Vec<D3> = tg.iter().map(|q| esc(*q, l)).collect(); if meta.len() < 4 || gd.len() < 3 { continue; }
        let ax = cruz(gd[0], gd[2]); if largo(ax) < 0.05 { continue; } let ax = norm(ax);
        let doblar = |dl: f64| -> [D3; 4] {
            let mut q = [j[0], j[1], j[2], j[3]];
            for kk in 0..3 { let r = qeje(ax, dl * if kk == 2 { 0.8 } else { 1.0 }); for t in kk + 1..4 { q[t] = add(q[kk], qrot(r, sub(q[t], q[kk]))); } }
            q
        };
        let mut mejor: Option<(f64, [D3; 4])> = None;
        let mut dl = -0.7f64;
        while dl <= 1.5 {
            let q = doblar(dl); let (mut pen, mut e) = (0.0, 0.0);
            for kk in 0..3 { let mut u = 0.25; while u <= 1.0 { let d = eje_mango(add(q[kk], esc(sub(q[kk + 1], q[kk]), u)), &m); let fz = (m.r + 0.6 * rf - d).max(0.0) / l; pen += fz * fz; u += 0.25; } }
            for (kk, w) in [(1usize, 0.5), (2, 1.0), (3, 1.5)] { e += w * (largo(sub(q[kk], meta[kk])) / l).powi(2); }
            e += pen * 400.0; if mejor.map(|b| e < b.0).unwrap_or(true) { mejor = Some((e, q)); }
            dl += 0.02;
        }
        let Some((_, q)) = mejor else { continue };
        // cada falange hacia su dirección nueva, de a una (girando el hueso respecto de su padre)
        for kk in 0..3 {
            let (Some(ia), Some(ib)) = (ids[kk], ids[kk + 1]) else { break };
            esq.actualizar();
            let cur = sub(pos(&esq.w[ib]), pos(&esq.w[ia])); let t = rotar(&fm, sub(q[kk + 1], q[kk]));
            let r = esq.apuntar(ia, cur, t);
            match out.iter_mut().find(|x| x.0 == ia) { Some(o) => o.1 = r, None => out.push((ia, r)) }
        }
    }
}
/// el mango del arma en el marco de la mano (mangoArma, en metros): lo que queda dentro de la mano (los puntos de la malla
/// a menos de 6,4 cm del centro de la palma, con la escala de la mano; sobre las aristas, cada 1 cm: las barras largas
/// como la de la palanca tienen vértices sólo en las puntas), su eje principal y su radio
fn mango(a: &Agarre, l: f64) -> Option<Mango> {
    let k = l / a.mano_l; let pal = [l * 0.5, 0.0, 0.0]; let rad = 0.064 * k;
    let v: Vec<D3> = a.p.iter().map(|p| esc(pt(&a.g, *p), k)).collect();
    let mut pts: Vec<D3> = vec![];
    let ii = &a.i; let mut t = 0;
    while t + 2 < ii.len() {
        for (x, y) in [(ii[t], ii[t + 1]), (ii[t + 1], ii[t + 2]), (ii[t + 2], ii[t])] {
            if x > y { continue; }
            let (Some(&pa), Some(&pb)) = (v.get(x as usize), v.get(y as usize)) else { continue };
            let n = ((largo(sub(pb, pa)) / 0.01).ceil()).max(1.0) as usize;
            for jj in 0..=n { let q = add(pa, esc(sub(pb, pa), jj as f64 / n as f64)); if largo(sub(q, pal)) < rad { pts.push(q); } }
        }
        t += 3;
    }
    if pts.len() < 6 { return None; }
    let mut c = [0.0; 3]; for q in &pts { c = add(c, *q); } c = esc(c, 1.0 / pts.len() as f64);
    let lejos = pts.iter().fold(pts[0], |a, q| if largo(sub(*q, c)) > largo(sub(a, c)) { *q } else { a });
    let mut ax = norm(sub(lejos, c));
    for _ in 0..40 { let mut nx = [0.0; 3]; for q in &pts { let d = sub(*q, c); nx = add(nx, esc(d, dot(d, ax))); } ax = norm(nx); }
    let mut ds: Vec<f64> = pts.iter().map(|q| { let d = sub(*q, c); largo(sub(d, esc(ax, dot(d, ax)))) }).collect();
    ds.sort_by(|x, y| x.partial_cmp(y).unwrap_or(std::cmp::Ordering::Equal));
    Some(Mango { c, ax, r: ds[(ds.len() as f64 * 0.5) as usize] })
}
/// el mango de un arma con la mano de este largo (para las pruebas: medir cuánto lo rodean los dedos)
pub fn mango_de(a: &ArmaMano, l: f64) -> Option<Mango> { mango(a.agarre.as_ref()?, l) }

/// el arma en la mano de un modelo de jugador de GMod que por dentro es el Hero (armaGmp: se corre de la mano del Hero a la
/// del modelo y se escala con el tamaño del personaje, alrededor de la mano). El nativo no tiene esos modelos: queda para
/// cuando los tenga (`s` el tamaño, `pm` la mano del modelo y `hero` la del Hero)
pub fn arma_gmp(m: &M4, s: f32, pm: V, hero: V) -> M4 {
    let mut a = [0.0f32; 16]; a[0] = s; a[5] = s; a[10] = s; a[15] = 1.0;
    a[12] = pm[0] - s * hero[0]; a[13] = pm[1] - s * hero[1]; a[14] = pm[2] - s * hero[2];
    m4::mul(&a, m)
}

/// junta dos escenas para subirlas juntas al motor (lo de `b` va al final de los datos de `a`)
pub fn juntar(a: &mut Escena, b: Escena) {
    while a.datos.len() % 4 != 0 { a.datos.push(0); }
    let o = a.datos.len(); a.datos.extend_from_slice(&b.datos);
    for mut m in b.c.mallas { m.vo += o; m.io += o; if m.lo >= 0 { m.lo += o as i64; } if m.so >= 0 { m.so += o as i64; } a.c.mallas.push(m); }
    a.c.mats.extend(b.c.mats);
    for mut t in b.c.texs { t.o += o; a.c.texs.push(t); }
    for mut l in b.c.lms { l.o += o; a.c.lms.push(l); }
}
