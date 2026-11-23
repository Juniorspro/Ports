//! Los personajes (personas.js, humano.js y modelo.js de la versión web): el cuerpo de un skin (el sub-árbol de
//! CharactersRoot dentro de PhotonPlayer) con sus mallas con piel, sus huesos y las animaciones del juego.
//!
//! Las animaciones son los clips humanoides del juego (DATA.hu): vienen en «músculos» de Unity (de -1 a 1 por grado de
//! libertad) y con los ejes del Avatar de cada skin (preQ, postQ, signo y límites) se pasan al giro de cada hueso. Como
//! en GMod (los clips horneados de male_anims.mdl, estado GmLoco): quieto (gm_idle_all, agachado gm_cidle_all), corriendo
//! o caminando agachado (los dos clips de las 8 direcciones que rodean hacia dónde va, con el ritmo medido en cada
//! personaje para que el pie apoyado no patine) y en el aire el salto (gm_jump). Los cambios de estado se funden con un
//! resorte de ~0,2 s, la postura se endereza, el cuerpo se sube o baja para que la suela quede en el piso y el pie que
//! pisa queda clavado (dos huesos por pierna).
//!
//! Nadando, las dos capturas de nado de CMU (flotando parado y, según la velocidad, la brazada acostado), si se le dan.
//!
//! Todo se calcula en el espacio del personaje (la raíz en el piso, mirando a +Z); `items` lo lleva al mundo con la
//! matriz de la raíz (`base`: posición y giro, como ubicarPersona). Da lo mismo que la web hasta 0,1 mm (lo compara
//! personajes_prueba/examples/comparar.rs). Para los NPC (npc.rs): los emotes de los estados del juego (la patada y los
//! bailes: `emote`, iguales a la web hasta 0,2 mm con examples/emote_comparar.rs) y el muñeco de trapo (`esqueleto` y
//! `poner_fijos`). Lo que todavía no: los emotes de captura, las posturas y acciones de las armas, los asientos de los
//! vehículos, los gorros y los que flotan sin piernas (BoiledOne).
use crate::mapa::{material, trs};
use crate::paquete::Paquete;
use jxmotor::escena::{Cabecera, Escena, ItemDin, Malla, Mat, Tex};
use jxmotor::mat::{self as m4, M4};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

type Q = [f32; 4];
type V = [f32; 3];

/// los huesos humanoides que usa la animación por código (HUESOS de personas.js)
pub const HUESOS: [&str; 20] = ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head", "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "RightShoulder", "RightArm", "RightForeArm", "RightHand", "LeftUpLeg", "LeftLeg", "LeftFoot", "RightUpLeg", "RightLeg", "RightFoot"];
const HIPS: usize = 0; const SPINE: usize = 1; const SPINE1: usize = 2; const SPINE2: usize = 3; const NECK: usize = 4; const HEAD: usize = 5;
const L_ARM: usize = 7; const R_ARM: usize = 11; const L_UPLEG: usize = 14; const L_LEG: usize = 15; const L_FOOT: usize = 16; const R_UPLEG: usize = 17; const R_LEG: usize = 18; const R_FOOT: usize = 19;

/// cuántos valores tiene una pose: 0-2 RootT, 3-6 RootQ, 7.. los 55 músculos
const NV: usize = 62;
/// hueso humano (orden de Mecanim) → músculo en x (giro), y, z (HUM_DOF)
const HUM_DOF: [Option<[i32; 3]>; 22] = [None, Some([23, 22, 21]), Some([31, 30, 29]), Some([25, -1, 24]), Some([33, -1, 32]), Some([27, -1, 26]), Some([35, -1, 34]),
    Some([2, 1, 0]), Some([5, 4, 3]), Some([8, 7, 6]), Some([11, 10, 9]), Some([14, 13, 12]), Some([-1, 38, 37]), Some([-1, 47, 46]), Some([41, 40, 39]), Some([50, 49, 48]),
    Some([43, -1, 42]), Some([52, -1, 51]), Some([-1, 45, 44]), Some([-1, 54, 53]), Some([-1, -1, 28]), Some([-1, -1, 36])];
/// los pasos medidos de cada clip, de más cortos a enteros (LOCO_AMP)
const LOCO_AMP: [f32; 5] = [0.35, 0.5, 0.65, 0.8, 1.0];
/// la postura derecha: torso 5°, cabeza 15°, a lo sumo 28° de corrección (HUM_POST)
const POST_TORSO: f32 = 5.0 * std::f32::consts::PI / 180.0; const POST_CABEZA: f32 = 15.0 * std::f32::consts::PI / 180.0; const POST_MAX: f32 = 28.0 * std::f32::consts::PI / 180.0;
const TAU: f32 = std::f32::consts::TAU;

// ---------------- cuentas chicas (Quat y V3 de nucleo.js) ----------------
fn f(v: &Value) -> f32 { v.as_f64().unwrap_or(0.0) as f32 }
fn v3(v: &Value, d: V) -> V { if v.is_array() { [f(&v[0]), f(&v[1]), f(&v[2])] } else { d } }
fn q4(v: &Value, d: Q) -> Q { if v.is_array() { [f(&v[0]), f(&v[1]), f(&v[2]), f(&v[3])] } else { d } }
fn clamp(x: f32, a: f32, b: f32) -> f32 { if x < a { a } else if x > b { b } else { x } }
fn sub(a: V, b: V) -> V { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
fn add(a: V, b: V) -> V { [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
fn esc(a: V, s: f32) -> V { [a[0] * s, a[1] * s, a[2] * s] }
fn dot(a: V, b: V) -> f32 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
fn cruz(a: V, b: V) -> V { [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
fn largo(a: V) -> f32 { dot(a, a).sqrt() }
/// (como V3.norm: si mide casi nada, queda como está)
fn norm(a: V) -> V { let l = largo(a); if l > 1e-12 { esc(a, 1.0 / l) } else { a } }
fn qmul(a: Q, b: Q) -> Q {
    [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
     a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]
}
fn qnorm(q: Q) -> Q { let l = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt(); let l = if l == 0.0 { 1.0 } else { l }; [q[0] / l, q[1] / l, q[2] / l, q[3] / l] }
fn qconj(q: Q) -> Q { [-q[0], -q[1], -q[2], q[3]] }
fn qrot(q: Q, v: V) -> V {
    let (qx, qy, qz, qw) = (q[0], q[1], q[2], q[3]);
    let (tx, ty, tz) = (2.0 * (qy * v[2] - qz * v[1]), 2.0 * (qz * v[0] - qx * v[2]), 2.0 * (qx * v[1] - qy * v[0]));
    [v[0] + qw * tx + qy * tz - qz * ty, v[1] + qw * ty + qz * tx - qx * tz, v[2] + qw * tz + qx * ty - qy * tx]
}
fn qeje(e: V, ang: f32) -> Q { let s = (ang / 2.0).sin(); let l = largo(e); let l = if l == 0.0 { 1.0 } else { l }; [e[0] / l * s, e[1] / l * s, e[2] / l * s, (ang / 2.0).cos()] }
/// el giro de una matriz (sin su escala): m4quat de modelo.js
fn m4quat(m: &M4) -> Q {
    let sx = (m[0] * m[0] + m[1] * m[1] + m[2] * m[2]).sqrt(); let sy = (m[4] * m[4] + m[5] * m[5] + m[6] * m[6]).sqrt(); let sz = (m[8] * m[8] + m[9] * m[9] + m[10] * m[10]).sqrt();
    let (a, b, c, d, e, f, g, h, k) = (m[0] / sx, m[1] / sx, m[2] / sx, m[4] / sy, m[5] / sy, m[6] / sy, m[8] / sz, m[9] / sz, m[10] / sz);
    let t = a + e + k;
    let q = if t > 0.0 { let s = (t + 1.0).sqrt() * 2.0; [(f - h) / s, (g - c) / s, (b - d) / s, 0.25 * s] }
        else if a > e && a > k { let s = (1.0 + a - e - k).sqrt() * 2.0; [0.25 * s, (d + b) / s, (g + c) / s, (f - h) / s] }
        else if e > k { let s = (1.0 + e - a - k).sqrt() * 2.0; [(d + b) / s, 0.25 * s, (h + f) / s, (g - c) / s] }
        else { let s = (1.0 + k - a - e).sqrt() * 2.0; [(g + c) / s, (h + f) / s, 0.25 * s, (b - d) / s] };
    qnorm(q)
}
/// el giro más corto que lleva la dirección a hacia la b (rotEntre)
fn rot_entre(a: V, b: V) -> Q {
    let (la, lb) = (largo(a), largo(b)); if la < 1e-6 || lb < 1e-6 { return [0.0, 0.0, 0.0, 1.0]; }
    let c = cruz(a, b); let s = largo(c) / (la * lb); let d = dot(a, b) / (la * lb);
    if s < 1e-7 { return [0.0, 0.0, 0.0, 1.0]; }
    qeje(c, s.atan2(d))
}
fn pos(m: &M4) -> V { [m[12], m[13], m[14]] }
fn punto(m: &M4, p: V) -> V { [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] }

/// la matriz de la raíz del personaje en el mundo (ubicarPersona): en el punto del piso `piso` y girado `yaw` alrededor de
/// la vertical (0: mira a +Z). La web la pone en JUG.pos − 1 m (5 cm más abajo que la suela de la cápsula, a 0,95 m del
/// centro); con la suela de la cápsula los pies quedan justo sobre el piso
pub fn base(piso: [f32; 3], yaw: f32) -> M4 { trs(piso, [0.0, (yaw / 2.0).sin(), 0.0, (yaw / 2.0).cos()], [1.0; 3]) }

// ---------------- los clips ----------------
/// un clip humanoide: cuánto dura, cuántos cuadros, hacia dónde va (los de GMod) y cada atributo (vacío: no viene; uno solo:
/// fijo; si no, uno por cuadro)
struct Clip { d: f64, nf: usize, ang: f32, v: f32, c: Vec<Vec<f32>> }
impl Clip {
    fn de(x: &Value) -> Clip {
        let mut c = vec![Vec::new(); 97];
        if let Some(o) = x["c"].as_object() { for (k, v) in o { if let (Ok(i), Some(a)) = (k.parse::<usize>(), v.as_array()) { if i < c.len() { c[i] = a.iter().map(f).collect(); } } } }
        Clip { d: x["d"].as_f64().unwrap_or(1.0), nf: x["nf"].as_u64().unwrap_or(1).max(1) as usize, ang: f(&x["ang"]), v: f(&x["v"]), c }
    }
}
/// los clips de GMod (humGm): quieto, quieto agachado, el salto y las 8 direcciones corriendo y caminando agachado (de
/// menor a mayor ángulo)
struct Gm { fps: f64, idle: Clip, cidle: Clip, jump: Clip, run: Vec<Clip>, cwalk: Vec<Clip> }
impl Gm {
    fn de(d: &Value) -> Option<Gm> {
        let l = d["hu"]["est"]["GmLoco"].as_array()?;
        let n = |x: &str| l.iter().find(|c| c["n"].as_str() == Some(x)).map(Clip::de);
        let dirs = |pre: &str| { let mut v: Vec<Clip> = l.iter().filter(|c| c["n"].as_str().map(|s| s.starts_with(pre)).unwrap_or(false)).map(Clip::de).collect(); v.sort_by(|a, b| a.ang.partial_cmp(&b.ang).unwrap_or(std::cmp::Ordering::Equal)); v };
        let g = Gm { fps: d["hu"]["fps"].as_f64().unwrap_or(20.0), idle: n("gm_idle_all")?, cidle: n("gm_cidle_all")?, jump: n("gm_jump")?, run: dirs("gm_run_"), cwalk: dirs("gm_cwalk_") };
        if g.run.len() < 4 || g.cwalk.len() < 4 { return None; }
        Some(g)
    }
}
/// el valor de un clip en t, sumado con peso w (humClip, siempre en bucle, sin espejo)
fn hum_clip(c: &Clip, fps: f64, t: f64, w: f32, out: &mut [f32; NV]) {
    let n = c.nf; let fr = ((t % c.d) * fps).max(0.0).min((n - 1) as f64);
    let i0 = fr.floor() as usize; let i1 = (i0 + 1).min(n - 1); let a = (fr - i0 as f64) as f32;
    let val = |at: usize| -> f32 { let k = &c.c[at]; if k.is_empty() { return if at == 13 || at == 8 { 1.0 } else { 0.0 }; } if k.len() == 1 { return k[0]; } k[i0.min(k.len() - 1)] * (1.0 - a) + k[i1.min(k.len() - 1)] * a };
    // (el giro del cuerpo se suma del mismo lado que lo que ya hay: q y -q son el mismo giro, pero mezclados se anulan)
    let sq = if out[3] * val(10) + out[4] * val(11) + out[5] * val(12) + out[6] * val(13) < 0.0 { -1.0 } else { 1.0 };
    for k in 0..NV {
        let (at, s) = if k < 7 { (7 + k, if k >= 3 { sq } else { 1.0 }) } else { (42 + k - 7, 1.0) };
        out[k] += val(at) * s * w;
    }
}
/// la velocidad del pie apoyado con pasos de tamaño amp (locoV)
#[derive(Clone, Copy, Debug)]
struct LocoM { v: f32, vs: [f32; 5] }
fn loco_v(l: &LocoM, amp: f32) -> f32 {
    let a = LOCO_AMP; if amp <= a[0] { return l.vs[0] * amp / a[0]; }
    for i in 1..a.len() { if amp <= a[i] { let t = (amp - a[i - 1]) / (a[i] - a[i - 1]); return l.vs[i - 1] + (l.vs[i] - l.vs[i - 1]) * t; } }
    l.v
}

/// el giro de a hacia b en t (Quat.slerpTo)
fn slerp(a: Q, b: Q, t: f32) -> Q {
    let mut c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; let mut b = b;
    if c < 0.0 { c = -c; b = [-b[0], -b[1], -b[2], -b[3]]; }
    let (k0, k1) = if c > 0.9995 { (1.0 - t, t) } else { let o = c.acos(); let s = o.sin(); (((1.0 - t) * o).sin() / s, (t * o).sin() / s) };
    qnorm([a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1, a[3] * k0 + b[3] * k1])
}
/// una captura de movimiento (las de CMU de los emotes, RBE2): cuadros por segundo, cuántos, el nodo de cada hueso, cuál
/// es la cadera, los giros (×32767, 4 por hueso y cuadro), la cadera en mm (sin el viaje: emoEnLugar) y el tramo que
/// mejor se repite
struct Emo { fps: f32, nf: usize, b: Vec<Option<usize>>, hips: Option<usize>, r: Vec<i16>, h: Vec<f32>, bucle: (usize, usize) }
/// (JS Math.round: la mitad para arriba)
fn redondo(x: f32) -> f32 { (x + 0.5).floor() }
impl Emo {
    /// lee una captura (emoBin) y la limpia (emoLimpiar): sin el cuadro 0 (la pose T), sin un final que salta y sin las
    /// vueltas de la conversión; los huesos son los de HUESOS (CMU_CAT.huesos)
    fn de(u: &[u8], h: &[Option<usize>; 20]) -> Option<Emo> {
        if u.len() < 10 || &u[0..4] != b"RBE2" { return None; }
        let (mut nf, fps, nb) = ((u[4] as usize) | (u[5] as usize) << 8, u[6] as f32, u[8] as usize);
        let nombres: Vec<&str> = (0..nb).map(|i| HUESOS.get(u[9 + i] as usize).copied().unwrap_or("")).collect();
        let (n, m, o, ff) = (nf * nb * 4, nf * 3, 9 + nb, nb * 4);
        if u.len() < o + (n + m) * 2 || nb == 0 || nf == 0 { return None; }
        let mut r = vec![0i16; n]; let mut hh = vec![0i16; m]; let mut acc = vec![0i16; ff];
        for i in 0..n { let d = (u[o + i] as u16 | (u[o + n + i] as u16) << 8) as i16; let j = i % ff; acc[j] = acc[j].wrapping_add(d); r[i] = acc[j].wrapping_mul(4); }
        let o2 = o + 2 * n; let mut a3 = [0i16; 3];
        for i in 0..m { let d = (u[o2 + i] as u16 | (u[o2 + m + i] as u16) << 8) as i16; let c = i % 3; a3[c] = a3[c].wrapping_add(d); hh[i] = a3[c]; }
        // (emoLimpiar) lo que gira el hueso que más gira de un cuadro al otro, en grados
        let salto = |r: &[i16], f0: usize, f1: usize| -> f32 {
            let mut mx = 0.0f64;
            for k in 0..nb { let (a, b) = ((f0 * nb + k) * 4, (f1 * nb + k) * 4); let d = ((0..4).map(|e| r[a + e] as f64 * r[b + e] as f64).sum::<f64>()).abs() / (32767.0 * 32767.0); mx = mx.max(2.0 * d.min(1.0).acos()); }
            mx.to_degrees() as f32
        };
        if nf >= 6 {
            let j: Vec<f32> = (1..nf).map(|f| salto(&r, f - 1, f)).collect();
            let mut s = j[1..].to_vec(); s.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal)); let med = s[(j.len() - 1) >> 1]; let lim = (3.0 * med).max(45.0);
            let ini = 1usize; let mut fin = nf - 1;
            while nf - 1 - fin < 3 && fin - ini > 4 && j[fin - 1] > lim { fin -= 1; }
            r = r[ini * nb * 4..(fin + 1) * nb * 4].to_vec(); hh = hh[ini * 3..(fin + 1) * 3].to_vec(); nf = fin - ini + 1;
            // las vueltas: un hueso que de un cuadro al otro gira más de 100° (no la cadera) se corrige con K desde ahí
            for k in 0..nb {
                if nombres[k] == "Hips" { continue; }
                let lee = |r: &[i16], o: usize| -> Q { [r[o] as f32 / 32767.0, r[o + 1] as f32 / 32767.0, r[o + 2] as f32 / 32767.0, r[o + 3] as f32 / 32767.0] };
                let (mut kq, mut prev_raw, mut cambio) = ([0.0f32, 0.0, 0.0, 1.0], lee(&r, k * 4), false); let mut prev = prev_raw;
                for f in 1..nf {
                    let o = (f * nb + k) * 4; let raw = lee(&r, o);
                    let dd = (prev_raw[0] * raw[0] + prev_raw[1] * raw[1] + prev_raw[2] * raw[2] + prev_raw[3] * raw[3]).abs();
                    if 2.0 * dd.min(1.0).acos() > 100f32.to_radians() { kq = qmul(qmul(qconj(raw), prev), [0.0, 0.0, 0.0, 1.0]); cambio = true; }
                    let qn = qnorm(if cambio { qmul(raw, kq) } else { raw });
                    if cambio { for e in 0..4 { r[o + e] = redondo(qn[e] * 32767.0) as i16; } }
                    prev_raw = raw; prev = qn;
                }
            }
        }
        // la cadera en el lugar (emoEnLugar): se le resta una recta ajustada a ±0,6 s; lo que queda, a lo sumo 0,45 m
        let w2 = ((0.6 * fps as f64 + 0.5).floor() as usize).max(2); let mut hl = vec![0.0f32; nf * 3];
        for f in 0..nf {
            let lo = (f as i64 - w2 as i64).min(nf as i64 - 1 - 2 * w2 as i64).max(0) as usize; let hi = ((f + w2).max(2 * w2)).min(nf - 1);
            let (mut n_, mut sf, mut sff, mut sx, mut sz, mut sfx, mut sfz) = (0.0f64, 0.0f64, 0.0f64, 0.0f64, 0.0f64, 0.0f64, 0.0f64);
            for g in lo..=hi { let (x, z, uu) = (hh[g * 3] as f64, hh[g * 3 + 2] as f64, g as f64 - f as f64); n_ += 1.0; sf += uu; sff += uu * uu; sx += x; sz += z; sfx += uu * x; sfz += uu * z; }
            let den = n_ * sff - sf * sf;
            let (ax, az) = if den != 0.0 { ((sx * sff - sf * sfx) / den, (sz * sff - sf * sfz) / den) } else { (sx / n_, sz / n_) };
            let (mut dx, mut dz) = (hh[f * 3] as f64 - ax, hh[f * 3 + 2] as f64 - az); let mm = dx.hypot(dz) / 450.0; if mm > 1.0 { dx /= mm; dz /= mm; }
            hl[f * 3] = dx as f32; hl[f * 3 + 1] = hh[f * 3 + 1] as f32; hl[f * 3 + 2] = dz as f32;
        }
        // el tramo [a, b] que mejor empalma (emoBucle): de 1,5 s o más, empezando después de 0,25 s
        let min = (redondo(1.5 * fps) as usize).min(nf.saturating_sub(2)); let paso = ((nf as f32 / 160.0).ceil() as usize).max(2);
        let a0 = (redondo(0.25 * fps) as usize).min(nf.saturating_sub(min + 2));
        let (mut mejor, mut par) = (1e9f64, (a0, nf - 1)); let kk = 1.0 / (32767.0f64 * 32767.0);
        let mut a = a0;
        while a < nf {
            let mut b = a + min;
            while b < nf {
                let (mut s, mut mx) = (0.0f64, 0.0f64);
                for k in 0..nb { let (o0, o1) = ((a * nb + k) * 4, (b * nb + k) * 4); let d = 1.0 - ((0..4).map(|e| r[o0 + e] as f64 * r[o1 + e] as f64).sum::<f64>()).abs() * kk; s += d; if d > mx { mx = d; } }
                s += 4.0 * mx; if s < mejor { mejor = s; par = (a, b); }
                b += paso;
            }
            a += paso;
        }
        let b: Vec<Option<usize>> = nombres.iter().map(|nm| HUESOS.iter().position(|x| x == nm).and_then(|k| h[k])).collect();
        Some(Emo { fps, nf, hips: nombres.iter().position(|x| *x == "Hips"), b, r, h: hl, bucle: par })
    }
}

// ---------------- lo que se carga ----------------
/// lo que el motor ya tiene: no se sube dos veces una malla, un material o una textura
#[derive(Default)]
pub struct Cargados { mallas: HashSet<i64>, mats: HashSet<i64>, texs: HashSet<i64> }
impl Cargados { pub fn olvidar(&mut self) { *self = Cargados::default(); } }

/// una malla con piel del personaje: el nodo, la malla, sus huesos (nodos; -1: el del nodo), las poses de enlace (en filas,
/// como Unity), sus partes (desde, cuántos, material) y su esfera (centro y radio de la caja)
#[derive(Clone)]
struct Piel { i: usize, m: i64, bo: Vec<i32>, bp: Vec<M4>, partes: Vec<(u32, u32, i64)>, c: V, r: f32 }
/// un hueso con sus ejes del Avatar
#[derive(Clone)]
struct HumHueso { i: usize, b: usize, pre: Q, post: Q, sg: V, mn: V, mx: V }
/// el pie clavado de cada lado (piesIK): el peso, el punto que pisa (en el mundo: x, z), desde cuándo y el anterior
#[derive(Clone, Copy, Default)]
struct PieIk { w: f32, lock: Option<[f32; 2]>, ult: Option<[f32; 2]>, t: f32, prev: Option<[f32; 2]> }

/// lo que hace el cuerpo en este cuadro (lo que personasPaso copia de JUG a su cuerpo)
#[derive(Clone, Copy, Debug, Default)]
pub struct Estado {
    /// el punto del piso donde va la raíz (el mismo que se le pasa a `base`): se usa para clavar el pie que pisa y para la
    /// altura en el agua
    pub piso: [f32; 3],
    /// la velocidad en el mundo (JUG.vel)
    pub vel: [f32; 3],
    /// hacia dónde mira el cuerpo (JUG.yaw: 0 mira a +Z, adelante es (sen yaw, 0, cos yaw)) y para arriba o abajo como
    /// JUG.pitch de la web: positivo mira abajo (la columna y la cabeza lo siguen). El pitch de jugador.rs es al revés
    /// (positivo mira arriba): `mira: -jug.pitch`
    pub yaw: f32, pub mira: f32,
    /// pisando (JUG.suelo; en el aire, la pose del salto) y agachado (lo que pide el jugador: ENT.agachar)
    pub en_suelo: bool, pub agachado: bool,
    /// nadando (JUG.nada): la altura de la superficie del agua
    pub agua: Option<f32>,
}

/// un personaje: su esqueleto (lo local de cada nodo y las matrices desde la raíz), sus mallas con piel y el estado de la
/// animación
#[derive(Clone)]
pub struct Personaje {
    pub skin: String,
    /// el tamaño respecto del Hero y la altura de los ojos respecto de la de un humano de ese alto (tamSkin)
    pub tam: f32, pub ojo: f32,
    nombres: Vec<String>, pa: Vec<i32>, act: Vec<bool>,
    p: Vec<V>, r: Vec<Q>, s: Vec<V>, w: Vec<M4>, raiz: M4,
    pieles: Vec<Piel>,
    /// las paletas en el espacio del personaje: por piel, mundo del hueso × pose de enlace
    paleta: Vec<Vec<M4>>,
    /// los huesos de HUESOS, el giro de reposo de cada nodo y los dedos del pie
    h: [Option<usize>; 20], rw: Vec<Q>, dedo: [Option<usize>; 2],
    /// la altura del tobillo sobre la suela parado y, de cada pie, el talón y la punta de la suela (en el hueso del pie)
    tobillo: f32, pies: Option<[[V; 2]; 2]>,
    // la animación (P.hum)
    /// el lugar de la cadera en reposo (para las capturas)
    p0_cadera: V,
    gm: Arc<Gm>, huesos: Vec<HumHueso>, ci: usize, av_esc: f32, av_dt: V, av_dq: Q, av_rt: V,
    v: [f32; NV], o: [f32; NV], ht: f64, fase: f64, aire: f32, caida: f32, agach: f32, mov: f32, cadera: f32, cad_w: f32,
    par: u32, clave: u32, o_t: f32, listo: bool, pos_k: f32,
    loco_esc: Option<f32>, loco: [Vec<Option<Option<LocoM>>>; 2],
    // dibujarPersona: la corrección de los pies, los pies clavados y el agua
    pie_corr: f32, ik: Option<[PieIk; 2]>, nado_k: f32, nado_w: f32, nado_t: f32,
    /// las capturas de nado (brazada acostado y flotando parado), si se dieron
    nado: Option<Arc<[Emo; 2]>>,
    /// el emote que está haciendo (P.emote: el clip y cuánto lleva, P.emoteT), si hace alguno (para los NPC: npc.rs)
    emo: Option<(ClipEmote, f32)>,
}

/// la patada (patadas.js, PAT): el tramo del golpe del clip Kick, de 0,55 s a 1,95 s, 2,2 veces más rápido
const PAT_DE: f32 = 0.55; const PAT_A: f32 = 1.95; const PAT_V: f32 = 2.2;
/// un clip de los estados del juego (DATA.hu.est[nombre][0]) para hacerlo como emote (`Personaje::emote`, como
/// animarHumano con P.emote): «Patada» es el tramo del golpe del clip Kick (se termina sola), Backflip y Kick se hacen una
/// vez y los demás se repiten
#[derive(Clone)]
pub struct ClipEmote { c: Arc<Clip>, clave: u32, una_vez: bool, patada: bool }
impl ClipEmote {
    pub fn de(d: &Value, nombre: &str) -> Option<ClipEmote> {
        let patada = nombre == "Patada"; let est = if patada { "Kick" } else { nombre };
        let x = &d["hu"]["est"][est][0]; if !x.is_object() { return None; }
        // (la clave del cambio de estado: una por nombre)
        let clave = nombre.bytes().fold(2166136261u32, |h, b| (h ^ b as u32).wrapping_mul(16777619)) | 0x8000_0000;
        Some(ClipEmote { c: Arc::new(Clip::de(x)), clave: clave & !1, una_vez: !patada && (est == "Backflip" || est == "Kick"), patada })
    }
    /// cuánto dura hasta terminarse solo (los que se repiten, nunca)
    pub fn dur(&self) -> f32 { if self.patada { (PAT_A - PAT_DE) / PAT_V } else if self.una_vez { self.c.d as f32 } else { f32::INFINITY } }
}

/// la copia del sub-árbol desde el nodo i0 con los índices nuevos (subArbol de vista.js)
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
/// el nombre humano de un hueso de Mixamo («mixamorig:LeftFoot», «mixamorig1:LeftFoot» → «LeftFoot»)
fn mixamo(n: &str) -> Option<&str> {
    let r = n.strip_prefix("mixamorig")?; let r = r.trim_start_matches(|c: char| c.is_ascii_digit()); r.strip_prefix(':')
}

impl Personaje {
    /// arma el personaje `skin` (si no está, el Hero): el cuerpo y una escena con lo que el motor todavía no tiene (mallas
    /// con su piel, materiales y texturas de hasta `tmax`). `lod`: el nivel de detalle de las mallas que lo tienen (0 el
    /// más fino, como GFX.lod en alto; 1 medio; 2 bajo). Los personajes de un paquete aparte (s_Goku…) abren el suyo.
    pub fn cargar(paq: &mut Paquete, skin: &str, lod: usize, tmax: u32, ya: &mut Cargados) -> Result<(Personaje, Escena), String> {
        let clave = crate::objetos::por_nombre(&paq.d).get("PhotonPlayer").cloned().ok_or("no está el PhotonPlayer")?;
        let (sub, skin) = {
            let arb = paq.d["pf"][&clave].as_array().ok_or("PhotonPlayer raro")?;
            let cr = arb.iter().position(|n| n["n"].as_str() == Some("CharactersRoot")).ok_or("no está CharactersRoot")? as i64;
            let es = |n: &Value, s: &str| n["pa"].as_i64() == Some(cr) && n["n"].as_str() == Some(s);
            let (si, sk) = match arb.iter().position(|n| es(n, skin)) { Some(i) => (i, skin), None => (arb.iter().position(|n| es(n, "Hero")).ok_or("no está el Hero")?, "Hero") };
            (sub_arbol(arb, si), sk.to_string())
        };
        let n = sub.len();
        let pa: Vec<i32> = sub.iter().map(|x| x["pa"].as_i64().unwrap_or(-1) as i32).collect();
        let mut act = vec![false; n];
        for i in 0..n { act[i] = sub[i]["off"].is_null() && (pa[i] < 0 || act[pa[i] as usize]); }
        // (niveles de detalle: sólo uno visible por grupo)
        let mut por_rid = HashMap::new(); for (i, x) in sub.iter().enumerate() { if let Some(r) = x["rid"].as_i64() { por_rid.insert(r, i); } }
        let mut oculto = vec![false; n];
        for x in &sub { if let Some(l) = x["lod"].as_array() { let el = lod.min(l.len().saturating_sub(1)); for (k, g) in l.iter().enumerate() { if k != el { for rid in g[1].as_array().into_iter().flatten() { if let Some(&i) = rid.as_i64().and_then(|r| por_rid.get(&r)) { oculto[i] = true; } } } } } }
        let ver: Vec<bool> = (0..n).map(|i| act[i] && sub[i]["m"].as_i64().map(|m| m >= 0).unwrap_or(false) && sub[i]["mt"].is_array() && sub[i]["mroff"].is_null() && !oculto[i]).collect();
        // (los paquetes aparte de las mallas que se ven)
        let ks: Vec<String> = (0..n).filter(|&i| ver[i]).filter_map(|i| sub[i]["m"].as_i64()).filter_map(|m| paq.d["ms"][m as usize]["k"].as_str().map(|s| s.to_string())).collect();
        for k in ks { paq.asegurar(&k)?; }
        let d = &paq.d;
        let nombres: Vec<String> = sub.iter().map(|x| x["n"].as_str().unwrap_or("").to_string()).collect();
        let p: Vec<V> = sub.iter().map(|x| v3(&x["p"], [0.0; 3])).collect();
        let r: Vec<Q> = sub.iter().map(|x| q4(&x["r"], [0.0, 0.0, 0.0, 1.0])).collect();
        let s: Vec<V> = sub.iter().map(|x| v3(&x["s"], [1.0; 3])).collect();
        // las mallas con piel (todas las de los personajes la tienen) y lo que hay que subirle al motor
        let mut datos: Vec<u8> = vec![];
        let mut poner = |b: &[u8]| -> usize { let o = datos.len(); datos.extend_from_slice(b); while datos.len() % 4 != 0 { datos.push(0); } o };
        let (mut mallas, mut mats, mut texs): (Vec<Malla>, Vec<Mat>, Vec<Tex>) = (vec![], vec![], vec![]);
        let mut pieles = vec![];
        for i in 0..n {
            let x = &sub[i]; if !ver[i] { continue; }
            let Some(bo) = x["bo"].as_array() else { continue };   // (sin piel no hay en los personajes)
            let mi = x["m"].as_i64().unwrap_or(-1); let md = &d["ms"][mi as usize];
            let (Some(subs), Some(bin)) = (md["sub"].as_array(), paq.bin_de(md)) else { continue };
            let Some(sk) = md["sk"].as_u64() else { continue };
            let (v, o, ii, sk) = (md["v"].as_u64().unwrap_or(0) as usize, md["o"].as_u64().unwrap_or(0) as usize, md["i"].as_u64().unwrap_or(0) as usize, sk as usize);
            if ya.mallas.insert(mi) {
                let i32 = md["i32"].as_bool().unwrap_or(false); let ni = subs.iter().map(|s| s[0].as_u64().unwrap_or(0) + s[1].as_u64().unwrap_or(0)).max().unwrap_or(0) as usize;
                let vb = bin.get(o..o + v * 14).ok_or("malla cortada")?; let ib = bin.get(ii..ii + ni * if i32 { 4 } else { 2 }).ok_or("índices cortados")?;
                let sb = bin.get(sk..sk + v * 8).ok_or("piel cortada")?;
                let vo = poner(vb); let io = poner(ib); let so = poner(sb);
                mallas.push(Malla { id: mi, v: v as u32, mn: v3(&md["mn"], [0.0; 3]), sc: v3(&md["sc"], [1.0; 3]), i32: i32 as u8, ni: ni as u32, vo, io, lo: -1, so: so as i64, lm: -1 });
            }
            let mut partes = vec![];
            for (k, mt) in x["mt"].as_array().into_iter().flatten().enumerate() {
                let Some(mt) = mt.as_i64() else { continue }; if mt < 0 { continue; }
                let Some(sp) = subs.get(k) else { continue };
                if !ya.mats.contains(&mt) { match material(d, mt as usize) { Some(m) => { ya.mats.insert(mt); mats.push(m); } None => continue } }
                partes.push((sp[0].as_u64().unwrap_or(0) as u32, sp[1].as_u64().unwrap_or(0) as u32, mt));
            }
            // (las poses de enlace: 16 números por hueso, en filas)
            let bp: Vec<M4> = md["bp"].as_array().map(|a| a.iter().map(|m| { let mut o = [0.0f32; 16]; for (k, e) in o.iter_mut().enumerate() { *e = f(&m[k]); } o }).collect()).unwrap_or_default();
            let (mn, sc) = (v3(&md["mn"], [0.0; 3]), v3(&md["sc"], [1.0; 3]));
            pieles.push(Piel { i, m: mi, bo: bo.iter().map(|b| b.as_i64().unwrap_or(-1) as i32).collect(), bp, partes,
                c: [mn[0] + sc[0] / 2.0, mn[1] + sc[1] / 2.0, mn[2] + sc[2] / 2.0], r: largo(sc) / 2.0 });
        }
        let quiero: Vec<i64> = mats.iter().flat_map(|m| { let mut v = vec![m.t, m.t2]; if let Some(t) = &m.terr { v.extend(t.iter().map(|x| x.0)); } v }).filter(|&t| t >= 0).collect();
        for t in quiero {
            if !ya.texs.insert(t) { continue; }
            if let Some((tw, th, px)) = paq.textura(t as usize, tmax) {
                let a = d["tx"][t as usize]["a"].as_i64().unwrap_or(0) as u8; let o = poner(&px);
                texs.push(Tex { id: t, n: d["tx"][t as usize]["n"].as_str().unwrap_or("").to_string(), w: tw, h: th, a, o });
            }
        }
        // los huesos humanoides (el primero de cada nombre) y los dedos de los pies
        let mut h = [None; 20];
        for (i, nm) in nombres.iter().enumerate() { if let Some(k) = mixamo(nm).and_then(|m| HUESOS.iter().position(|x| *x == m)) { if h[k].is_none() { h[k] = Some(i); } } }
        let dedo = [nombres.iter().position(|x| x.ends_with("LeftToeBase")), nombres.iter().position(|x| x.ends_with("RightToeBase"))];
        // el Avatar y sus huesos (humanoPreparar)
        let av_n = sub[0]["an"]["av"].as_str().unwrap_or("");
        let av = &d["hu"]["av"][av_n]; if !av.is_object() { return Err(format!("{skin}: sin Avatar ({av_n})")); }
        let mut por_nombre: HashMap<&str, usize> = HashMap::new(); for (i, nm) in nombres.iter().enumerate() { por_nombre.entry(nm.as_str()).or_insert(i); }
        let mut huesos = vec![];
        for x in av["h"].as_array().into_iter().flatten() {
            let b = x[0].as_u64().unwrap_or(99) as usize; let Some(&i) = x[1].as_str().and_then(|s| por_nombre.get(s)) else { continue };
            if b >= HUM_DOF.len() || HUM_DOF[b].is_none() { continue; }
            huesos.push(HumHueso { i, b, pre: q4(&x[2], [0.0, 0.0, 0.0, 1.0]), post: q4(&x[3], [0.0, 0.0, 0.0, 1.0]), sg: v3(&x[4], [1.0; 3]), mn: v3(&x[5], [0.0; 3]), mx: v3(&x[6], [0.0; 3]) });
        }
        let ci = *av["cadera"].as_str().and_then(|s| por_nombre.get(s)).ok_or(format!("{skin}: sin cadera"))?;
        let gm = Arc::new(Gm::de(d).ok_or("faltan los clips de GMod (DATA.hu.est.GmLoco)")?);
        let (nr, ncw) = (gm.run.len(), gm.cwalk.len());
        let t = &d["tam"][skin.as_str()]; let (tam, ojo) = if t.is_array() { (f(&t[0]), if t[1].is_null() || f(&t[1]) == 0.0 { 1.0 } else { f(&t[1]) }) } else { (1.0, 1.0) };
        let p0_cadera = h[HIPS].map(|i| p[i]).unwrap_or([0.0; 3]);
        let mut pj = Personaje { skin: skin.clone(), tam, ojo, p0_cadera, nombres, pa, act, p, r, s, w: vec![m4::id(); n], raiz: m4::id(), pieles, paleta: vec![], h, rw: vec![], dedo, tobillo: 0.08, pies: None,
            gm, huesos, ci, av_esc: f(&av["esc"]), av_dt: v3(&av["dt"], [0.0; 3]), av_dq: q4(&av["dq"], [0.0, 0.0, 0.0, 1.0]), av_rt: v3(&av["rt"], [0.0; 3]),
            v: [0.0; NV], o: [0.0; NV], ht: 0.0, fase: 0.0, aire: 0.0, caida: 0.0, agach: 0.0, mov: 0.0, cadera: 0.0, cad_w: 1.0, par: 0, clave: 0, o_t: 0.0, listo: false, pos_k: 0.0,
            loco_esc: None, loco: [vec![None; nr], vec![None; ncw]], pie_corr: 0.0, ik: None, nado_k: 0.0, nado_w: 0.0, nado_t: 0.0, nado: None, emo: None };
        // el reposo (datosSkin): el giro de cada nodo y la suela
        pj.actualizar();
        pj.rw = pj.w.iter().map(m4quat).collect();
        pj.calcular_paleta();
        let (lo, pies) = pj.suelo_reposo(paq);
        pj.pies = pies;
        if let (Some(lf), Some(rf)) = (pj.h[L_FOOT], pj.h[R_FOOT]) { pj.tobillo = (pj.w[lf][13].min(pj.w[rf][13]) - lo).max(0.02); }
        let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas, mats, texs, lms: vec![], items: vec![], agua: None, cielo: None };
        Ok((pj, Escena { c: cab, datos }))
    }

    /// las matrices desde la raíz (Modelo.actualizar): la de cada nodo, la del padre por la propia
    fn actualizar(&mut self) {
        for i in 0..self.w.len() {
            if !self.act[i] { continue; }
            let l = trs(self.p[i], self.r[i], self.s[i]);
            self.w[i] = if i == 0 || self.pa[i] < 0 { m4::mul(&self.raiz, &l) } else { m4::mul(&self.w[self.pa[i] as usize], &l) };
        }
    }
    /// las paletas de huesos (pielesYa): mundo del hueso × pose de enlace
    fn calcular_paleta(&mut self) {
        self.paleta = self.pieles.iter().map(|pz| pz.bo.iter().take(56).enumerate().map(|(b, &bi)| {
            let w = if bi >= 0 { &self.w[bi as usize] } else { &self.w[pz.i] };
            let bp = pz.bp.get(b).copied().unwrap_or_else(m4::id);
            // (la pose de enlace viene en filas: B[f * 4 + c])
            let bc: M4 = [bp[0], bp[4], bp[8], bp[12], bp[1], bp[5], bp[9], bp[13], bp[2], bp[6], bp[10], bp[14], bp[3], bp[7], bp[11], bp[15]];
            m4::mul(w, &bc)
        }).collect()).collect();
    }
    /// la suela en la pose de reposo (sueloReposo): lo más bajo de la malla con piel (0 si no baja del piso de la raíz) y, de
    /// cada pie, el talón y la punta de la suela en el espacio del hueso del pie
    fn suelo_reposo(&self, paq: &Paquete) -> (f32, Option<[[V; 2]; 2]>) {
        let lado = |i: usize| -> Option<usize> {
            let n = &self.nombres[i];
            for (k, l) in ["Left", "Right"].iter().enumerate() { for f in ["Foot", "ToeBase", "Toe_End"] { if n.ends_with(&format!("{l}{f}")) { return Some(k); } } }
            None
        };
        let mut pts: [Vec<V>; 2] = [vec![], vec![]]; let mut lo = 0.0f32;
        for (pz, pal) in self.pieles.iter().zip(&self.paleta) {
            let md = &paq.d["ms"][pz.m as usize]; let Some(b) = paq.bin_de(md) else { continue }; let Some(sk) = md["sk"].as_u64() else { continue };
            let (v, o, sk) = (md["v"].as_u64().unwrap_or(0) as usize, md["o"].as_u64().unwrap_or(0) as usize, sk as usize);
            let (mn, sc) = (v3(&md["mn"], [0.0; 3]), v3(&md["sc"], [1.0; 3]));
            for k in 0..v {
                let q = o + k * 14; let s = sk + k * 8; if q + 6 > b.len() || s + 8 > b.len() { break; }
                let u = |j: usize| u16::from_le_bytes([b[q + j * 2], b[q + j * 2 + 1]]) as f32 / 65535.0;
                let p = [mn[0] + u(0) * sc[0], mn[1] + u(1) * sc[1], mn[2] + u(2) * sc[2]];
                let (mut x, mut wm, mut bm) = ([0.0f32; 3], 0.0f32, None);
                for j in 0..4 {
                    let w = b[s + 4 + j] as f32 / 255.0; if w == 0.0 { continue; }
                    let bi = b[s + j] as usize; let Some(m) = pal.get(bi) else { continue };
                    let e = punto(m, p); for c in 0..3 { x[c] += w * e[c]; }
                    if w > wm { wm = w; bm = Some(bi); }
                }
                if x[1] < lo { lo = x[1]; }
                if let Some(l) = bm.and_then(|bi| pz.bo.get(bi)).filter(|&&n| n >= 0).and_then(|&n| lado(n as usize)) { pts[l].push(x); }
            }
        }
        // de cada pie: los puntos de la suela (hasta 1,5 cm arriba de lo más bajo del pie), el de más atrás y el de más adelante
        let mut pies = [[[0.0f32; 3]; 2]; 2];
        for (l, hf) in [(0usize, self.h[L_FOOT]), (1, self.h[R_FOOT])] {
            let (Some(hf), q) = (hf, &pts[l]) else { return (lo, None) };
            if q.len() < 3 { return (lo, None); }
            let mn = q.iter().map(|p| p[1]).fold(1e9f32, f32::min);
            let (mut a, mut b) = (None::<V>, None::<V>);
            for p in q { if p[1] < mn + 0.015 { if a.map(|x| p[2] < x[2]).unwrap_or(true) { a = Some(*p); } if b.map(|x| p[2] > x[2]).unwrap_or(true) { b = Some(*p); } } }
            let w = self.w[hf];
            let loc = |p: V| -> V { let dd = sub(p, pos(&w)); let c = |k: usize| (w[k] * dd[0] + w[k + 1] * dd[1] + w[k + 2] * dd[2]) / (w[k] * w[k] + w[k + 1] * w[k + 1] + w[k + 2] * w[k + 2]); [c(0), c(4), c(8)] };
            pies[l] = [loc(a.unwrap()), loc(b.unwrap())];
        }
        (lo, Some(pies))
    }

    // ---------------- la animación (humano.js) ----------------
    /// pasa los valores de la pose a los giros de los huesos y la cadera (humAplicar: Unity → espejo x, -y, -z, w)
    fn hum_aplicar(&mut self) {
        let v = self.v;
        for k in 0..self.huesos.len() {
            let h = &self.huesos[k]; let d = HUM_DOF[h.b].unwrap(); let mut a = [0.0f32; 3];
            for e in 0..3 {
                if d[e] < 0 { continue; }
                let m = v[7 + d[e] as usize]; let ang = if m < 0.0 { m * -h.mn[e] } else { m * h.mx[e] };
                a[e] = clamp(ang * 0.5, -1.5, 1.5).tan() * h.sg[e];
            }
            let hq = qnorm([a[0], a[1] + a[0] * a[2], a[2] - a[0] * a[1], 1.0]);
            let q = qnorm(qmul(qmul(h.pre, hq), qconj(h.post)));
            self.r[h.i] = [q[0], -q[1], -q[2], q[3]];
        }
        // la cadera desde el «cuerpo» del clip, en el lugar (sólo la altura)
        let bq = qnorm([v[3], v[4], v[5], v[6]]);
        let by = v[1] * self.av_esc; let off = qrot(bq, self.av_dt); let hq = qnorm(qmul(bq, self.av_dq));
        self.p[self.ci] = [-(self.av_rt[0] + off[0]), by + off[1], self.av_rt[2] + off[2]];
        self.r[self.ci] = [hq[0], -hq[1], -hq[2], hq[3]];
    }
    /// los dedos de los pies (o los pies, si no hay dedos): humGmPies
    fn gm_pies(&self) -> (usize, usize) {
        match self.dedo { [Some(l), Some(r)] => (l, r), _ => (self.h[L_FOOT].unwrap_or(0), self.h[R_FOOT].unwrap_or(0)) }
    }
    /// el tamaño del personaje para la locomoción: el alto de la cadera parado respecto del Hero, 1,14 m (humGmLoco)
    fn gm_loco_esc(&mut self) -> f32 {
        if let Some(e) = self.loco_esc { return e; }
        let (raiz, vg) = (self.raiz, self.v); self.raiz = m4::id();
        let (pie, _) = self.gm_pies(); let gm = self.gm.clone();
        self.v = [0.0; NV]; hum_clip(&gm.idle, gm.fps, 0.0, 1.0, &mut self.v); self.hum_aplicar(); self.actualizar();
        let e = match self.h[HIPS] { Some(hi) => clamp((self.w[hi][13] - self.w[pie][13]) / 1.14, 0.2, 3.0), None => 1.0 };
        self.raiz = raiz; self.v = vg;
        self.loco_esc = Some(e); e
    }
    /// la velocidad de verdad del pie apoyado de un clip de GMod en este personaje, con pasos enteros y más cortos
    /// (humGmClip): k 0 corriendo, 1 caminando agachado; j el clip
    fn gm_clip(&mut self, k: usize, j: usize) -> Option<LocoM> {
        if let Some(m) = self.loco[k][j] { return m; }
        let esc_ = self.gm_loco_esc(); let gm = self.gm.clone();
        let c = if k == 0 { &gm.run[j] } else { &gm.cwalk[j] }; let quieto = if k == 0 { &gm.idle } else { &gm.cidle };
        let (lt, rt) = self.gm_pies(); let (raiz, vg) = (self.raiz, self.v); self.raiz = m4::id();
        let medir = |pj: &mut Personaje, amp: f32| -> f32 {
            let n = ((c.d * 48.0).round() as usize).max(16); let mut fr = Vec::with_capacity(n);
            for i in 0..n {
                pj.v = [0.0; NV]; if amp < 1.0 { hum_clip(quieto, gm.fps, 0.0, 1.0 - amp, &mut pj.v); } hum_clip(c, gm.fps, c.d * i as f64 / n as f64, amp, &mut pj.v); pj.hum_aplicar(); pj.actualizar();
                let (a, b) = (pos(&pj.w[lt]), pos(&pj.w[rt])); fr.push([a[0], a[1], a[2], b[0], b[1], b[2]]);
            }
            // el pie apoyado: abajo (a menos de 2,5 cm de lo más bajo que llega ese pie) y yendo para atrás respecto de
            // hacia dónde camina el clip; si los dos, el más bajo. La velocidad: la mediana
            let mut ym = [1e9f32, 0.0, 0.0, 1e9]; for x in &fr { ym[0] = ym[0].min(x[1]); ym[3] = ym[3].min(x[4]); }
            let (dx, dz, dtm) = (-c.ang.sin(), c.ang.cos(), (c.d / n as f64) as f32); let mut s = vec![];
            for i in 0..n {
                let (x, g) = (fr[i], fr[(i + 1) % n]); let mut mejor: Option<(f32, f32)> = None;
                for o in [0usize, 3] {
                    if x[o + 1] > ym[o] + 0.025 * esc_ { continue; }
                    let v = -((g[o] - x[o]) * dx + (g[o + 2] - x[o + 2]) * dz) / dtm; if v <= 0.0 { continue; }
                    if mejor.map(|m| x[o + 1] < m.1).unwrap_or(true) { mejor = Some((v, x[o + 1])); }
                }
                if let Some(m) = mejor { s.push(m.0); }
            }
            s.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal)); if s.is_empty() { 0.0 } else { s[s.len() >> 1] }
        };
        let v = medir(self, 1.0);
        let m = if !(v > 0.2) { None } else {
            let or = |x: f32, y: f32| if x != 0.0 && !x.is_nan() { x } else { y };
            let v5 = or(medir(self, 0.5), v * 0.5); let v8 = v5.max(or(medir(self, 0.8), v * 0.8)); let v1 = v8.max(v);
            Some(LocoM { v: v1, vs: [v5 * 0.7, v5, (v5 + v8) / 2.0, v8, v1] })
        };
        self.raiz = raiz; self.v = vg;
        self.loco[k][j] = Some(m); m
    }
    /// caminar, correr y agacharse como en GMod (humGmMover): los dos clips que rodean la dirección, la fase que avanza
    /// para que el pie apoyado vaya a la velocidad del cuerpo y, muy despacio, mezclado con el de quieto
    fn gm_mover(&mut self, t: &mut [f32; NV], sp: f32, dt: f32, e: &Estado) {
        let gm = self.gm.clone(); let ag = e.agachado; let k = ag as usize;
        let quieto = if ag { &gm.cidle } else { &gm.idle }; let l = if ag { &gm.cwalk } else { &gm.run };
        if sp < 0.25 { hum_clip(quieto, gm.fps, self.ht, 1.0, t); self.mov = 0.0; self.par = 0; self.cadera *= (1.0 - dt * 6.0).max(0.0); return; }
        let fw0 = [e.yaw.sin(), e.yaw.cos()]; let (dx, dz) = (e.vel[0] / sp, e.vel[2] / sp);
        let fw = fw0[0] * dx + fw0[1] * dz; let rt = -(fw0[1] * dx - fw0[0] * dz); let ang = rt.atan2(fw);   // (0 adelante, + derecha)
        let mut j = l.len() - 1; for (i, c) in l.iter().enumerate() { if c.ang <= ang { j = i; } }
        let jb = (j + 1) % l.len(); let (a, b) = (&l[j], &l[jb]); self.par = 1 + (k as u32) * 16 + j as u32;
        let mut da = b.ang - a.ang; if da <= 0.0 { da += TAU; } let mut w = ang - a.ang; if w < 0.0 { w += TAU; } let w = clamp(w / da, 0.0, 1.0);
        // el largo del paso sale de cuántos pasos por segundo da una persona a esa velocidad (≈ 1,6 + 0,3·v); un personaje
        // más chico da pasos más seguidos
        let le = self.gm_loco_esc(); let ma = self.gm_clip(k, j); let mb = self.gm_clip(k, jb);
        let d = (1.0 - w as f64) * a.d + w as f64 * b.d; let re = le.sqrt();
        let v_de = |amp: f32| (1.0 - w) * ma.map(|m| loco_v(&m, amp)).unwrap_or(if a.v != 0.0 { a.v } else { 1.0 } * amp) + w * mb.map(|m| loco_v(&m, amp)).unwrap_or(if b.v != 0.0 { b.v } else { 1.0 } * amp);
        let meta = 2.0 * sp / (((if ag { 1.4 } else { 1.6 }) + 0.3 * sp / re) / re) / d as f32;
        let mut amp = 1.0f32;
        // (con la misma suma en doble que en el JS: 0,35, 0,40… hasta que pasa de 1)
        let (mut x, mut va) = (0.35f64, v_de(0.35));
        while x < 1.0 {
            let y = (x + 0.05).min(1.0); let vb = v_de(y as f32);
            if va >= meta { amp = x as f32; break; }
            if vb >= meta { amp = (x + (y - x) * (meta - va) as f64 / ((vb - va) as f64).max(1e-6)) as f32; break; }
            va = vb; x += 0.05;
        }
        let v_a = v_de(amp);
        // (hasta 5 veces más rápido que el clip: los bajitos dan pasos cortitos y muy seguidos para no patinar)
        self.fase = (self.fase + dt as f64 * clamp(sp / v_a.max(0.1), 0.05, 5.0) as f64 / d) % 1.0;
        if amp < 1.0 { hum_clip(quieto, gm.fps, self.ht, 1.0 - amp, t); }
        hum_clip(a, gm.fps, self.fase * a.d, amp * (1.0 - w), t); hum_clip(b, gm.fps, self.fase * b.d, amp * w, t);
        self.mov = amp; self.cadera = 0.0;
    }
    /// gira un hueso alrededor de un eje del personaje en reposo (girar + aplicarGiros: r = r0 · (q0⁻¹ · R · q0))
    fn girar(&mut self, acc: &mut [Option<Q>; 20], k: usize, eje: V, ang: f32) {
        if self.h[k].is_none() || ang == 0.0 { return; }
        let r = qeje(eje, ang); acc[k] = Some(match acc[k] { Some(a) => qmul(r, a), None => r });
    }
    fn aplicar_giros(&mut self, acc: &[Option<Q>; 20]) {
        // (por número de nodo, como el for … in de un objeto)
        let mut l: Vec<(usize, Q)> = (0..20).filter_map(|k| Some((self.h[k]?, acc[k]?))).collect(); l.sort_by_key(|x| x.0);
        for (i, a) in l { let q0 = self.rw[i]; let qa = qmul(qmul(qconj(q0), a), q0); self.r[i] = qnorm(qmul(self.r[i], qa)); }
    }
    /// gira un hueso alrededor de un eje del mundo con las matrices que ya están (humGirarYa)
    fn girar_ya(&mut self, i: Option<usize>, eje: V, ang: f32) {
        let Some(i) = i else { return }; let pa = self.pa[i]; if pa < 0 { return; }
        let qw = qmul(qeje(eje, ang), m4quat(&self.w[i]));
        self.r[i] = qnorm(qmul(qconj(m4quat(&self.w[pa as usize])), qw));
    }
    /// la postura derecha (humPostura): se endereza sólo lo que pasa de una postura natural (torso 5°, cabeza 15°)
    fn postura(&mut self, dt: f32, e: &Estado) {
        let (Some(hi), Some(_), Some(ne), Some(he), Some(la), Some(ra)) = (self.h[HIPS], self.h[SPINE], self.h[NECK], self.h[HEAD], self.h[L_ARM], self.h[R_ARM]) else { return };
        let sp = e.vel[0].hypot(e.vel[2]);
        let quiere = if e.en_suelo && !e.agachado && !(self.nado_k > 0.3) && self.emo.is_none() { if sp > 4.0 { 0.5 } else { 1.0 } } else { 0.0 };
        self.pos_k += (quiere - self.pos_k) * (dt * 6.0).min(1.0); let k = self.pos_k; if k < 0.01 { return; }
        self.actualizar();
        // (el frente del cuerpo: de los hombros —a la derecha del personaje— y la vertical)
        let (l, r) = (pos(&self.w[la]), pos(&self.w[ra])); let mut der = [r[0] - l[0], 0.0, r[2] - l[2]]; let n = der[0].hypot(der[2]); if n < 1e-4 { return; }
        der[0] /= n; der[2] /= n; let fr = [der[2], 0.0, -der[0]];
        let lean = |w: &Vec<M4>, a: usize, b: usize| { let t = sub(pos(&w[b]), pos(&w[a])); dot(t, fr).atan2(t[1]) };
        let tor = lean(&self.w, hi, ne);
        let d_t = (tor - POST_TORSO).max(0.0).min(POST_MAX) * k;
        if d_t > 1e-3 { for (kk, fx) in [(SPINE, 0.4), (SPINE1, 0.3), (SPINE2, 0.3)] { self.girar_ya(self.h[kk], der, d_t * fx); } }
        self.actualizar();
        let cab = lean(&self.w, ne, he);
        let d_c = (cab - POST_CABEZA).max(0.0).min(POST_MAX) * k;
        // (el cuello lleva la cabeza atrás; la cara queda como venía, sin mirar arriba)
        if d_c > 1e-3 { self.girar_ya(Some(ne), der, d_c); self.girar_ya(Some(he), der, -d_c * 0.5); }
    }
    /// el cuerpo según lo que hace (animarHumano, sin armas, asientos ni acciones; los emotes de los estados del juego, como
    /// la patada de los NPC, si se pidió uno con `emote`)
    fn animar_humano(&mut self, dt: f32, e: &Estado) {
        let gm = self.gm.clone(); let mut t = [0.0f32; NV];
        self.ht += dt as f64;
        let sp = e.vel[0].hypot(e.vel[2]);
        if let Some((c, et)) = self.emo.as_mut() {
            // (animarPersona suma el tiempo del emote antes de animar; la patada se termina sola al final del golpe, Backflip
            // y Kick al final del clip)
            *et += dt; let (c, et) = (c.clone(), *et);
            if c.patada { let k = PAT_DE + et * PAT_V; hum_clip(&c.c, gm.fps, k.min(PAT_A) as f64, 1.0, &mut t); if k >= PAT_A { self.emo = None; } }
            else { hum_clip(&c.c, gm.fps, et as f64, 1.0, &mut t); if c.una_vez && et as f64 > c.c.d { self.emo = None; } }
        } else if !e.en_suelo {
            // en el aire, el salto de GMod (jump_slam): despega y queda en lo alto del salto mientras dure la caída
            self.aire += dt; hum_clip(&gm.jump, gm.fps, (self.aire as f64 * 1.15).min(gm.jump.d * 0.5), 1.0, &mut t);
        } else {
            self.gm_mover(&mut t, sp, dt, e);
            // aterrizaje: un golpe de rodillas que se recupera solo
            if self.aire > 0.25 { self.caida = (self.aire / 0.9).min(1.0); }
            self.aire = 0.0;
            self.caida = (self.caida - dt * 3.2).max(0.0);
            let agach = (if e.agachado { 1.0f32 } else { 0.0 }).max(self.caida * 0.55);
            self.agach += (agach - self.agach) * (dt * 10.0).min(1.0);
            // (con las de GMod el agacharse ya viene en el clip; al aterrizar, un poco de la de agachado quieto)
            if self.caida > 0.02 && !e.agachado {
                let mut u = [0.0f32; NV]; hum_clip(&gm.cidle, gm.fps, self.ht, 1.0, &mut u); let k = self.caida * 0.45;
                for i in 7..NV { t[i] += (u[i] - t[i]) * k; }
            }
        }
        // transición suave sólo cuando cambia el estado: la diferencia con la pose anterior se apaga en ~0,2 s
        let clave = if let Some((c, _)) = &self.emo { c.clave } else if !e.en_suelo { u32::MAX } else { self.par * 2 + e.agachado as u32 };
        if !self.listo { self.v = t; self.o = [0.0; NV]; self.clave = clave; self.listo = true; }
        if clave != self.clave {
            if self.v[3] * t[3] + self.v[4] * t[4] + self.v[5] * t[5] + self.v[6] * t[6] < 0.0 { for k in 3..7 { self.v[k] = -self.v[k]; } }
            for k in 0..NV { self.o[k] = self.v[k] - t[k]; } self.clave = clave; self.o_t = 0.0;
        } else { self.o_t += dt; }
        // (se apaga como un resorte amortiguado: arranca sin velocidad)
        let ko = 16.0 * self.o_t; let fo = if ko > 12.0 { 0.0 } else { (1.0 + ko) * (-ko).exp() };
        for k in 0..NV { self.v[k] = t[k] + self.o[k] * fo; }
        self.hum_aplicar();
        // la cadera girada hacia donde camina y mirar arriba o abajo con la cabeza y el pecho
        self.cad_w += ((if !e.en_suelo || self.emo.is_some() { 0.0 } else { 1.0 }) - self.cad_w) * (dt * 10.0).min(1.0);
        let cad = self.cadera * self.cad_w;
        if e.mira != 0.0 || cad.abs() > 0.01 {
            let mut acc = [None; 20];
            if cad.abs() > 0.01 { self.girar(&mut acc, HIPS, [0.0, 1.0, 0.0], -cad); self.girar(&mut acc, SPINE, [0.0, 1.0, 0.0], cad * 0.45); self.girar(&mut acc, SPINE1, [0.0, 1.0, 0.0], cad * 0.3); self.girar(&mut acc, SPINE2, [0.0, 1.0, 0.0], cad * 0.25); }
            if e.mira != 0.0 { self.girar(&mut acc, SPINE2, [1.0, 0.0, 0.0], e.mira * 0.3); self.girar(&mut acc, HEAD, [1.0, 0.0, 0.0], e.mira * 0.4); }
            self.aplicar_giros(&acc);
        }
        self.postura(dt, e);
    }

    // ---------------- nadar (emotes.js) ----------------
    /// las dos capturas de nado de CMU (RBE2 en gzip, como las baja la web de emotes/cmu: 126_04 la brazada acostado, 79_02
    /// flotando parado). Sin ellas, nadando queda la pose de la animación (en el aire: la del salto), como la web cuando
    /// no las pudo bajar
    pub fn nado(&mut self, nada: &[u8], flota: &[u8]) -> Result<(), String> {
        // (vienen en gzip, como los archivos de emotes/cmu; también sirven ya abiertas)
        let abrir = |u: &[u8]| -> Vec<u8> { if u.len() > 2 && u[0] == 0x1f && u[1] == 0x8b { let mut o = vec![]; if std::io::Read::read_to_end(&mut flate2::read::GzDecoder::new(u), &mut o).is_ok() { return o; } } u.to_vec() };
        let a = Emo::de(&abrir(nada), &self.h).ok_or("la captura de nado no es RBE2")?; let b = Emo::de(&abrir(flota), &self.h).ok_or("la captura de flotar no es RBE2")?;
        self.nado = Some(Arc::new([a, b])); Ok(())
    }
    /// la pose de nado (nadoPose): flotando parado siempre y, según la velocidad, la brazada acostado; cada una en el
    /// tramo que mejor se repite
    fn nado_pose(&mut self, dt: f32, e: &Estado) {
        let k = self.nado_k; if k < 0.001 { return; }
        let Some(cs) = self.nado.clone() else { return };
        let sp = e.vel[0].hypot(e.vel[2]); let ws = clamp((sp - 0.3) / 1.2, 0.0, 1.0);
        self.nado_w += (ws - self.nado_w) * (dt * 4.0).min(1.0);
        self.nado_t += dt * (0.8 + sp.min(4.0) * 0.12);
        for (c, w) in [(&cs[1], 1.0), (&cs[0], self.nado_w)] {
            if w <= 0.001 { continue; }
            let (a, b) = c.bucle; self.emo_aplicar(c, a as f32 + (self.nado_t * c.fps) % (b - a) as f32, w * k);
        }
    }
    /// el cuadro f (con fracción) de una captura sobre la pose que ya tiene, con peso w (emoAplicar)
    fn emo_aplicar(&mut self, c: &Emo, f: f32, w: f32) {
        let nb = c.b.len(); let f0 = (f.floor() as usize).min(c.nf - 1); let f1 = (f0 + 1).min(c.nf - 1); let a = f - f0 as f32;
        let q = |o: usize| qnorm([c.r[o] as f32 / 32767.0, c.r[o + 1] as f32 / 32767.0, c.r[o + 2] as f32 / 32767.0, c.r[o + 3] as f32 / 32767.0]);
        for k in 0..nb {
            let Some(i) = c.b[k] else { continue };
            let qe = slerp(q((f0 * nb + k) * 4), q((f1 * nb + k) * 4), a);
            self.r[i] = slerp(self.r[i], qe, w);
        }
        // la cadera: su lugar de reposo más lo que se mueve en la captura, en el lugar (sin el viaje)
        if let (Some(kh), Some(hi)) = (c.hips, self.h[HIPS]) {
            if c.b[kh].is_some() {
                let b0 = self.p0_cadera; let (o0, o1) = (f0 * 3, f1 * 3);
                for e in 0..3 { let v = (c.h[o0 + e] + (c.h[o1 + e] - c.h[o0 + e]) * a) / 1000.0; self.p[hi][e] += (b0[e] + v - self.p[hi][e]) * w; }
            }
        }
    }

    // ---------------- los pies (personas.js) ----------------
    /// pies en el piso (aterrizarPies): se sube o baja el cuerpo para que la suela más baja quede apoyada (agachado o al
    /// caer, del todo; caminando, sólo que no se hunda ni flote más de unos centímetros)
    fn aterrizar_pies(&mut self, dt: f32, e: &Estado) {
        let (Some(lf), Some(rf)) = (self.h[L_FOOT], self.h[R_FOOT]) else { return };
        self.actualizar();
        let mut bajo = self.w[lf][13].min(self.w[rf][13]) - self.tobillo;
        if let Some(pz) = self.pies { for (l, i) in [(0usize, lf), (1, rf)] { let w = &self.w[i]; for q in pz[l] { let y = w[1] * q[0] + w[5] * q[1] + w[9] * q[2] + w[13]; if y < bajo { bajo = y; } } } }
        let dy = 0.0 - bajo; let lleno = self.agach > 0.05;
        let mut meta = clamp(dy, if lleno { -0.75 } else { -0.06 }, 0.5);
        // (en el aire no se baja el cuerpo hacia un piso que no está; subirlo sí, para que no lo atraviese al caer)
        if !e.en_suelo && !lleno { meta = meta.max(0.0); }
        self.pie_corr += (meta - self.pie_corr) * (dt * 18.0).min(1.0);
        // (subir es en el acto; bajar sigue siendo suave)
        if self.pie_corr < dy.min(0.5) - 0.01 { self.pie_corr = dy.min(0.5) - 0.01; }
        if self.pie_corr.abs() > 1e-4 { self.raiz[13] += self.pie_corr; }
    }
    /// pies clavados (piesIK): cuando un pie pisa, su lugar en el piso queda fijo mientras dure el apoyo y la pierna se
    /// acomoda (muslo y pantorrilla, la rodilla en el mismo plano que traía). Se suelta al levantar el pie, si la pierna no
    /// llega o después de 1 s, con entrada y salida suaves. Los puntos clavados van en el mundo (con `e.piso` y `e.yaw`)
    fn pies_ik(&mut self, dt: f32, e: &Estado) {
        if !e.en_suelo { self.ik = None; return; }
        self.actualizar();
        let sp = e.vel[0].hypot(e.vel[2]); let tob = self.tobillo;
        let (sy, cy) = (e.yaw.sin(), e.yaw.cos());
        // (del personaje al mundo y de vuelta, sólo en el piso: el giro y el lugar de la raíz)
        let al_mundo = |p: V| -> [f32; 2] { [p[0] * cy + p[2] * sy + e.piso[0], -p[0] * sy + p[2] * cy + e.piso[2]] };
        let al_pj = |d: [f32; 2]| -> V { [d[0] * cy - d[1] * sy, 0.0, d[0] * sy + d[1] * cy] };
        let mut ik = self.ik.unwrap_or_default();
        let piernas = [(self.h[L_UPLEG], self.h[L_LEG], self.h[L_FOOT], self.dedo[0]), (self.h[R_UPLEG], self.h[R_LEG], self.h[R_FOOT], self.dedo[1])];
        for (lado, &(iu, ik_, ia, it)) in piernas.iter().enumerate() {
            let (Some(iu), Some(ikn), Some(ia)) = (iu, ik_, ia) else { continue };
            let s = &mut ik[lado];
            let (hp, kp, ap) = (pos(&self.w[iu]), pos(&self.w[ikn]), pos(&self.w[ia]));
            // el punto que pisa: entre el tobillo y la punta (al levantar el talón, el pie gira sobre la punta)
            let cp_l = match it { Some(t) => [ap[0] + (self.w[t][12] - ap[0]) * 0.5, 0.0, ap[2] + (self.w[t][14] - ap[2]) * 0.5], None => [ap[0], 0.0, ap[2]] };
            let cp = al_mundo(cp_l);
            let vel = match s.prev { Some(pv) => (cp[0] - pv[0]).hypot(cp[1] - pv[1]) / dt.max(1e-3), None => 0.0 };
            s.prev = Some(cp);
            let alto = ap[1] - 0.0 - tob; let (a, b) = (largo(sub(kp, hp)), largo(sub(ap, kp)));
            // pisa: el pie (sin corregir) toca el piso y no va hacia adelante mucho más rápido que el cuerpo
            let apoya = alto < 0.03 && vel < sp + 1.5;
            if apoya && s.lock.is_none() && s.w < 0.05 { s.lock = Some(cp); s.t = 0.0; }
            if let Some(lk) = s.lock {
                s.t += dt;
                let dl = al_pj([lk[0] - cp[0], lk[1] - cp[1]]);
                let lejos = largo([ap[0] + dl[0] - hp[0], ap[1] - hp[1], ap[2] + dl[2] - hp[2]]) > (a + b) * 0.985;
                if alto > 0.07 || lejos || s.t > 1.0 { s.lock = None; } else { s.ult = Some(lk); }
            }
            s.w = if s.lock.is_some() { (s.w + dt / 0.05).min(1.0) } else { (s.w - dt / 0.12).max(0.0) };
            let Some(ult) = s.ult else { continue }; if s.w <= 0.001 { continue; }
            let dl = al_pj([(ult[0] - cp[0]) * s.w, (ult[1] - cp[1]) * s.w]);
            let tt = [ap[0] + dl[0], ap[1], ap[2] + dl[2]];
            // la rodilla nueva: misma distancia a la cadera y al tobillo, en el plano que trae la pierna
            let d = clamp(largo(sub(tt, hp)), (a - b).abs() + 1e-3, a + b - 1e-3); let dir = norm(sub(tt, hp));
            let x = (a * a - b * b + d * d) / (2.0 * d); let hh = (a * a - x * x).max(0.0).sqrt();
            let mut pol = sub(kp, hp); pol = sub(pol, esc(dir, dot(pol, dir)));
            if largo(pol) < 1e-5 { pol = [0.0, 0.0, 1.0]; } let pol = norm(pol);
            let kn = add(hp, add(esc(dir, x), esc(pol, hh)));
            // giros en el mundo y de vuelta a cada hueso (el pie conserva su giro)
            let (qu, qk, qa, qpu) = (m4quat(&self.w[iu]), m4quat(&self.w[ikn]), m4quat(&self.w[ia]), m4quat(&self.w[self.pa[iu].max(0) as usize]));
            let r1 = rot_entre(sub(kp, hp), sub(kn, hp)); let qun = qmul(r1, qu);
            let a2 = add(hp, qrot(r1, sub(ap, hp)));
            let r2 = rot_entre(sub(a2, kn), sub(tt, kn)); let qkn = qmul(qmul(r2, r1), qk);
            self.r[iu] = qnorm(qmul(qconj(qpu), qun)); self.r[ikn] = qnorm(qmul(qconj(qun), qkn)); self.r[ia] = qnorm(qmul(qconj(qkn), qa));
        }
        self.ik = Some(ik);
    }

    /// un paso de la animación: elige y mezcla los clips según lo que hace (animarPersona) y apoya los pies (lo que hace
    /// dibujarPersona antes de dibujar). Una vez por cuadro, antes de `items` (dt: lo que pasó desde el anterior, hasta
    /// 0,25 s como P.dtJunto)
    pub fn animar(&mut self, dt: f32, e: &Estado) {
        let dt = if dt > 0.0 { dt.min(0.25) } else { 0.016 };
        // nadando: la pose de nado entra y sale suave
        self.nado_k += ((e.agua.is_some() as u8 as f32) - self.nado_k) * (dt * 4.0).min(1.0);
        self.animar_humano(dt, e);
        self.nado_pose(dt, e);
        // (ubicarPersona: la raíz en el piso, sin la corrección de los pies del cuadro anterior)
        self.raiz = m4::id();
        if self.nado_k > 0.01 && e.agua.is_some() {
            // (nadoAltura: la cadera justo debajo del agua; sin la pose de nado —nado_w 0— queda como está)
            self.ik = None;
            if let (Some(hi), Some(ay)) = (self.h[HIPS], e.agua) {
                self.actualizar(); let meta = ay - e.piso[1] - 0.08 * self.tam;
                self.raiz[13] += (meta - self.w[hi][13]) * self.nado_w * self.nado_k;
            }
        } else if self.emo.is_some() { self.ik = None; }   // (en un emote no se apoyan ni se clavan los pies: dibujarPersona)
        else { self.aterrizar_pies(dt, e); self.pies_ik(dt, e); }
        self.actualizar();
        self.calcular_paleta();
    }

    /// lo que se dibuja con la raíz del personaje en `base` (ver `base()`): cada parte de cada malla con piel, con la
    /// paleta de huesos en el mundo (3 filas vec4 por hueso) y la matriz identidad, como Modelo.encolar
    pub fn items(&self, base: &M4, out: &mut Vec<ItemDin>) {
        for (pz, pal) in self.pieles.iter().zip(&self.paleta) {
            let mut h = Vec::with_capacity(pal.len().max(1) * 12);
            for m in pal { let wm = m4::mul(base, m); for r in 0..3 { for c in 0..4 { h.push(wm[c * 4 + r]); } } }
            if h.is_empty() { h.extend_from_slice(&[1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0]); }
            // (la esfera: el centro de la malla llevado por los huesos, de a dos, promediado; el radio con la escala de la piel)
            let (mut cc, mut nn, mut e) = ([0.0f32; 3], 0, 0.0f32); let nb = h.len() / 12;
            for b in (0..nb).step_by(2) {
                let o = b * 12; if h[o] == 0.0 && h[o + 5] == 0.0 { continue; }
                for k in 0..3 { cc[k] += h[o + k * 4] * pz.c[0] + h[o + k * 4 + 1] * pz.c[1] + h[o + k * 4 + 2] * pz.c[2] + h[o + k * 4 + 3]; }
                nn += 1; if e == 0.0 { e = (h[o] * h[o] + h[o + 1] * h[o + 1] + h[o + 2] * h[o + 2]).sqrt(); }
            }
            if nn > 0 { cc = esc(cc, 1.0 / nn as f32); }
            let esf = [cc[0], cc[1], cc[2], pz.r * 1.6 * if e > 0.0 { e } else { 1.0 }];
            for &(s0, sn, mat) in &pz.partes { out.push(ItemDin { m: pz.m, s0, sn, mat, mm: m4::id(), esf, fl: 0, h: h.clone() }); }
        }
    }

    /// la matriz de un hueso humanoide (de HUESOS: «Head», «RightHand»…) en el espacio del personaje (el mundo: base × ésta)
    pub fn hueso(&self, nombre: &str) -> Option<M4> { let k = HUESOS.iter().position(|x| *x == nombre)?; Some(self.w[self.h[k]?]) }
    /// la matriz de cualquier nodo del esqueleto por su nombre («mixamorig:LeftToeBase»…), en el espacio del personaje
    pub fn nodo(&self, nombre: &str) -> Option<M4> { let i = self.nombres.iter().position(|x| x == nombre)?; Some(self.w[i]) }
    /// la altura del tobillo sobre la suela en reposo (para medir los pies)
    pub fn tobillo(&self) -> f32 { self.tobillo }
    /// empieza un emote (P.emote = …, P.emoteT = 0; None: lo corta). Se anima en `animar` hasta que se corte o se termine solo
    pub fn emote(&mut self, c: Option<&ClipEmote>) { self.emo = c.map(|c| (c.clone(), 0.0)); }
    /// si está haciendo un emote (la patada, Backflip y Kick se terminan solos)
    pub fn en_emote(&self) -> bool { self.emo.is_some() }
    /// el esqueleto entero (para el muñeco de trapo de npc.rs): el nombre y el padre de cada nodo y su matriz desde la raíz
    /// (en el espacio del personaje; en el mundo: base × ésta)
    pub fn esqueleto(&self) -> (&[String], &[i32], &[M4]) { (&self.nombres, &self.pa, &self.w) }
    /// el muñeco de trapo (Modelo.actualizar con md.fijo): los nodos con cuerpo van donde dice `fijos` (en el mundo) y los
    /// demás siguen a su padre con su giro de antes (la raíz, con `raiz`, la base del último cuadro animado); después se
    /// dibuja con `items(&m4::id(), …)`. No llamar a `animar` mientras tanto
    pub fn poner_fijos(&mut self, raiz: &M4, fijos: &[Option<M4>]) {
        for i in 0..self.w.len() {
            if !self.act[i] { continue; }
            if let Some(Some(f)) = fijos.get(i) { self.w[i] = *f; continue; }
            let l = trs(self.p[i], self.r[i], self.s[i]);
            self.w[i] = if i == 0 || self.pa[i] < 0 { m4::mul(raiz, &l) } else { m4::mul(&self.w[self.pa[i] as usize], &l) };
        }
        self.calcular_paleta();
    }
    /// lo más bajo de las suelas ahora (en el espacio del personaje): el tobillo menos su altura o el talón o la punta
    pub fn suela(&self) -> Option<f32> {
        let (lf, rf) = (self.h[L_FOOT]?, self.h[R_FOOT]?);
        let mut bajo = self.w[lf][13].min(self.w[rf][13]) - self.tobillo;
        if let Some(pz) = self.pies { for (l, i) in [(0usize, lf), (1, rf)] { let w = &self.w[i]; for q in pz[l] { bajo = bajo.min(w[1] * q[0] + w[5] * q[1] + w[9] * q[2] + w[13]); } } }
        Some(bajo)
    }
    /// el talón y la punta de la suela de cada pie ahora (izquierdo y derecho), en el espacio del personaje: para medir si
    /// el pie que pisa patina o para los pasos
    pub fn suelas(&self) -> Option<[[V; 2]; 2]> {
        let (pz, lf, rf) = (self.pies?, self.h[L_FOOT]?, self.h[R_FOOT]?);
        Some([0, 1].map(|l| { let w = &self.w[if l == 0 { lf } else { rf }]; pz[l].map(|q| punto(w, q)) }))
    }
    /// los vértices de las mallas con su piel en la pose de ahora, en el espacio del personaje (para pruebas: lo más bajo,
    /// que nada explote)
    pub fn vertices(&self, paq: &Paquete) -> Vec<V> {
        let mut o = vec![];
        for (pz, pal) in self.pieles.iter().zip(&self.paleta) {
            let md = &paq.d["ms"][pz.m as usize]; let Some(b) = paq.bin_de(md) else { continue }; let Some(sk) = md["sk"].as_u64() else { continue };
            let (v, of, sk) = (md["v"].as_u64().unwrap_or(0) as usize, md["o"].as_u64().unwrap_or(0) as usize, sk as usize);
            let (mn, sc) = (v3(&md["mn"], [0.0; 3]), v3(&md["sc"], [1.0; 3]));
            for k in 0..v {
                let q = of + k * 14; let s = sk + k * 8; if q + 6 > b.len() || s + 8 > b.len() { break; }
                let u = |j: usize| u16::from_le_bytes([b[q + j * 2], b[q + j * 2 + 1]]) as f32 / 65535.0;
                let p = [mn[0] + u(0) * sc[0], mn[1] + u(1) * sc[1], mn[2] + u(2) * sc[2]]; let mut x = [0.0f32; 3];
                for j in 0..4 { let w = b[s + 4 + j] as f32 / 255.0; if w == 0.0 { continue; } if let Some(m) = pal.get(b[s + j] as usize) { let e = punto(m, p); for c in 0..3 { x[c] += w * e[c]; } } }
                o.push(x);
            }
        }
        o
    }
}
