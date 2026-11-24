//! Los emotes de captura y los nuevos (emotes.js): los de captura de movimiento de CMU («c:», archivos RBE2), los del
//! paquete («rb:», DATA.emo) y los hechos por la gente («u:», que llegan por la red). Cada uno es una lista de giros locales
//! de los huesos (y el movimiento de la cadera) cuadro a cuadro, que se pone encima de la animación de parado con entrada
//! y salida suaves (emoPose); los que se repiten dan la vuelta en el tramo que mejor empalma, con la diferencia del salto
//! soltándose en 0,3 s (emoInercia), y nada queda abajo del piso (emoSuelo). Hijo de personaje.rs: usa sus huesos.
//! De a dos (juntos.js: `escena`) va con la cadera de la captura entera, sin fundido de salida ni bucle.
use super::*;
use std::sync::OnceLock;

/// un clip de emote (lo de EMO.clips): sus huesos por nombre, los giros (×32767, 4 por hueso y cuadro) y la cadera en mm
pub struct Captura {
    pub id: String, pub n: String, pub fps: f32, pub nf: usize, pub b: Vec<String>, pub r: Vec<i16>, pub h: Option<Vec<i16>>,
    pub bucle: bool, pub d: f32, lugar: OnceLock<Vec<f32>>, bucle_l: OnceLock<(usize, usize, f32)>,
}
/// el emote de captura que está haciendo un personaje: el clip, cuánto lleva (P.emoteT), los nodos de sus huesos en este
/// esqueleto (emoIndices), si es de a dos (P.escena) y la clave del cambio de estado
#[derive(Clone)]
pub struct CapActiva { pub c: Arc<Captura>, pub t: f32, idx: Vec<Option<usize>>, pub escena: bool, clave: u32 }

fn ss01(t: f32) -> f32 { let t = t.clamp(0.0, 1.0); t * t * (3.0 - 2.0 * t) }
fn redondo64(x: f64) -> f64 { (x + 0.5).floor() }
/// (lo que viene en gzip, como los archivos de emotes/cmu; también sirve ya abierto)
pub fn abrir_gz(u: &[u8]) -> Vec<u8> { if u.len() > 2 && u[0] == 0x1f && u[1] == 0x8b { let mut o = vec![]; if std::io::Read::read_to_end(&mut flate2::read::GzDecoder::new(u), &mut o).is_ok() { return o; } } u.to_vec() }

impl Captura {
    /// emoBin + emoLimpiar: un archivo RBE2 de emotes/cmu (`huesos`: los de CMU_CAT.huesos; vacío: HUESOS)
    pub fn de_rbe2(id: &str, n: &str, u: &[u8], huesos: &[String]) -> Option<Captura> {
        let u = abrir_gz(u); let u = &u[..];
        if u.len() < 10 || &u[0..4] != b"RBE2" { return None; }
        let (mut nf, fps, nb) = ((u[4] as usize) | (u[5] as usize) << 8, u[6] as f32, u[8] as usize);
        let b: Vec<String> = (0..nb).map(|i| { let k = u[9 + i] as usize; huesos.get(k).cloned().or(HUESOS.get(k).map(|s| s.to_string())).unwrap_or_default() }).collect();
        let (nn, m, o, ff) = (nf * nb * 4, nf * 3, 9 + nb, nb * 4);
        if u.len() < o + (nn + m) * 2 || nb == 0 || nf == 0 { return None; }
        let mut r = vec![0i16; nn]; let mut hh = vec![0i16; m]; let mut acc = vec![0i16; ff];
        for i in 0..nn { let d = (u[o + i] as u16 | (u[o + nn + i] as u16) << 8) as i16; let j = i % ff; acc[j] = acc[j].wrapping_add(d); r[i] = acc[j].wrapping_mul(4); }
        let o2 = o + 2 * nn; let mut a3 = [0i16; 3];
        for i in 0..m { let d = (u[o2 + i] as u16 | (u[o2 + m + i] as u16) << 8) as i16; let c = i % 3; a3[c] = a3[c].wrapping_add(d); hh[i] = a3[c]; }
        // emoLimpiar: sin el cuadro 0 (la pose T), sin un final que salta y sin las vueltas de la conversión
        if nf >= 6 {
            let salto = |r: &[i16], f0: usize, f1: usize| -> f64 { let mut mx = 0.0f64; for k in 0..nb { let (a, b) = ((f0 * nb + k) * 4, (f1 * nb + k) * 4); let d = ((0..4).map(|e| r[a + e] as f64 * r[b + e] as f64).sum::<f64>()).abs() / (32767.0 * 32767.0); mx = mx.max(2.0 * d.min(1.0).acos()); } mx.to_degrees() };
            let j: Vec<f64> = (1..nf).map(|f| salto(&r, f - 1, f)).collect();
            let mut s = j[1..].to_vec(); s.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal)); let med = s[(j.len() - 1) >> 1]; let lim = (3.0 * med).max(45.0);
            let ini = 1usize; let mut fin = nf - 1;
            while nf - 1 - fin < 3 && fin - ini > 4 && j[fin - 1] > lim { fin -= 1; }
            r = r[ini * nb * 4..(fin + 1) * nb * 4].to_vec(); hh = hh[ini * 3..(fin + 1) * 3].to_vec(); nf = fin - ini + 1;
            for k in 0..nb {
                if b[k] == "Hips" { continue; }
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
        let d = (nf as f32 - 1.0) / fps;
        Some(Captura { id: id.into(), n: n.into(), fps, nf, b, r, h: Some(hh), bucle: u[7] != 0, d, lugar: OnceLock::new(), bucle_l: OnceLock::new() })
    }
    /// un clip del paquete (DATA.emo[k]: «rb:») o uno hecho por la gente («u:», el clip de INST.anims o de la red): `r` y
    /// `h` en base64 (int16) o como listas
    pub fn de_json(id: &str, n: &str, c: &Value) -> Option<Captura> {
        let a16 = |v: &Value| -> Option<Vec<i16>> {
            if let Some(s) = v.as_str() { let b = base64(s)?; return Some(b.chunks_exact(2).map(|x| i16::from_le_bytes([x[0], x[1]])).collect()); }
            v.as_array().map(|a| a.iter().map(|x| x.as_f64().unwrap_or(0.0) as i16).collect())
        };
        let r = a16(&c["r"])?; let h = if c["h"].is_null() { None } else { a16(&c["h"]) };
        let b: Vec<String> = c["b"].as_array()?.iter().map(|x| x.as_str().unwrap_or("").to_string()).collect();
        let fps = c["fps"].as_f64().filter(|x| *x > 0.0).unwrap_or(20.0) as f32; let nf = c["nf"].as_u64()? as usize;
        if nf == 0 || b.is_empty() || r.len() < nf * b.len() * 4 { return None; }
        if let Some(h) = &h { if h.len() < nf * 3 { return None; } }
        Some(Captura { id: id.into(), n: c["n"].as_str().unwrap_or(n).to_string(), fps, nf, b, r, h, bucle: c["loop"].as_bool().unwrap_or(false), d: (nf as f32 - 1.0) / fps, lugar: OnceLock::new(), bucle_l: OnceLock::new() })
    }
    pub fn cmu(&self) -> bool { self.id.starts_with("c:") }
    /// emoEnLugar: la cadera sin el viaje (se le resta una recta ajustada a ±0,6 s; lo que queda, a lo sumo 0,45 m)
    fn en_lugar(&self) -> &[f32] {
        self.lugar.get_or_init(|| {
            let Some(h) = &self.h else { return vec![] }; let nf = self.nf;
            let w2 = (redondo64(0.6 * self.fps as f64) as usize).max(2); let mut out = vec![0.0f32; h.len()];
            for f in 0..nf {
                let lo = (f as i64 - w2 as i64).min(nf as i64 - 1 - 2 * w2 as i64).max(0) as usize; let hi = ((f + w2).max(2 * w2)).min(nf - 1);
                let (mut n_, mut sf, mut sff, mut sx, mut sz, mut sfx, mut sfz) = (0.0f64, 0.0f64, 0.0f64, 0.0f64, 0.0f64, 0.0f64, 0.0f64);
                for g in lo..=hi { let (x, z, uu) = (h[g * 3] as f64, h[g * 3 + 2] as f64, g as f64 - f as f64); n_ += 1.0; sf += uu; sff += uu * uu; sx += x; sz += z; sfx += uu * x; sfz += uu * z; }
                let den = n_ * sff - sf * sf;
                let (ax, az) = if den != 0.0 { ((sx * sff - sf * sfx) / den, (sz * sff - sf * sfz) / den) } else { (sx / n_, sz / n_) };
                let (mut dx, mut dz) = (h[f * 3] as f64 - ax, h[f * 3 + 2] as f64 - az); let mm = dx.hypot(dz) / 450.0; if mm > 1.0 { dx /= mm; dz /= mm; }
                out[f * 3] = dx as f32; out[f * 3 + 1] = h[f * 3 + 1] as f32; out[f * 3 + 2] = dz as f32;
            }
            out
        })
    }
    /// emoBucle(C, true): el tramo [a, b] que mejor empalma (empieza en el primer cuarto y termina en el último) y cuánto
    /// difieren ahí, en grados (el peor hueso)
    pub fn bucle(&self) -> (usize, usize, f32) {
        *self.bucle_l.get_or_init(|| {
            let (nb, nf, fps) = (self.b.len(), self.nf, self.fps as f64); let r = &self.r;
            let min = (redondo64(1.5 * fps) as i64).min(nf as i64 - 2); let k = 1.0 / (32767.0f64 * 32767.0); let paso = ((nf as f64 / 160.0).ceil() as usize).max(2);
            let a0 = (redondo64(0.25 * fps) as i64).min((nf as i64 - min - 2).max(0)).max(0) as usize;
            let mut mejor = 1e9f64; let mut par = (a0, nf.saturating_sub(1), 0.0f32);
            let a_max = (a0 + 1).max((nf as f64 * 0.25).floor() as usize); let b_min = (nf as f64 * 0.75).floor() as usize;
            let mut a = a0;
            while a < a_max {
                let mut b = ((a as i64 + min).max(b_min as i64)).max(0) as usize;
                while b < nf {
                    let (mut s, mut mx) = (0.0f64, 0.0f64);
                    for kk in 0..nb { let (o0, o1) = ((a * nb + kk) * 4, (b * nb + kk) * 4); let d = 1.0 - ((0..4).map(|e| r[o0 + e] as f64 * r[o1 + e] as f64).sum::<f64>()).abs() * k; s += d; if d > mx { mx = d; } }
                    s += 4.0 * mx; if s < mejor { mejor = s; par = (a, b, (2.0 * (1.0 - mx).min(1.0).acos()).to_degrees() as f32); }
                    b += paso;
                }
                a += paso;
            }
            par
        })
    }
}
/// base64 (el de atob: con relleno o sin él)
pub fn base64(s: &str) -> Option<Vec<u8>> {
    let val = |c: u8| -> Option<u32> { Some(match c { b'A'..=b'Z' => c - b'A', b'a'..=b'z' => c - b'a' + 26, b'0'..=b'9' => c - b'0' + 52, b'+' | b'-' => 62, b'/' | b'_' => 63, _ => return None } as u32) };
    let b: Vec<u8> = s.bytes().filter(|c| !c.is_ascii_whitespace() && *c != b'=').collect(); let mut o = Vec::with_capacity(b.len() * 3 / 4);
    for ch in b.chunks(4) { let mut n = 0u32; for (i, &c) in ch.iter().enumerate() { n |= val(c)? << (18 - 6 * i); } o.push((n >> 16) as u8); if ch.len() > 2 { o.push((n >> 8) as u8); } if ch.len() > 3 { o.push(n as u8); } }
    Some(o)
}

/// los huesos que no pueden quedar abajo del piso en un emote de captura, con su grueso (PISO_HUESOS)
const PISO_HUESOS: [(&str, f32); 23] = [("Hips", 0.09), ("Spine1", 0.1), ("Spine2", 0.1), ("Neck", 0.07), ("Head", 0.1), ("LeftHand", 0.03), ("RightHand", 0.03), ("LeftForeArm", 0.04), ("RightForeArm", 0.04),
    ("LeftLeg", 0.06), ("RightLeg", 0.06), ("LeftArm", 0.06), ("RightArm", 0.06), ("LeftFoot", 0.05), ("RightFoot", 0.05), ("LeftToeBase", 0.02), ("RightToeBase", 0.02),
    ("LeftHandMiddle3", 0.01), ("RightHandMiddle3", 0.01), ("LeftHandIndex3", 0.01), ("RightHandIndex3", 0.01), ("LeftHandRing3", 0.01), ("RightHandRing3", 0.01)];

impl Personaje {
    /// el nodo de un hueso por su nombre humano (el de Mixamo sin el prefijo, o el nombre tal cual)
    pub fn nodo_humano(&self, n: &str) -> Option<usize> { self.nombres.iter().position(|x| mixamo(x) == Some(n)).or_else(|| self.nombres.iter().position(|x| x == n || x.ends_with(&format!(":{n}")))) }
    /// empieza (o corta, con None) un emote de captura (emote(e) con «c:», «rb:» o «u:»); `escena`: de a dos (juntos.js)
    pub fn emote_captura(&mut self, c: Option<Arc<Captura>>, escena: bool) {
        self.emo = None;
        self.cap = c.map(|c| {
            let mut por: HashMap<&str, usize> = HashMap::new(); for (i, nm) in self.nombres.iter().enumerate() { if let Some(m) = mixamo(nm) { por.entry(m).or_insert(i); } }
            let idx = c.b.iter().map(|b| por.get(b.as_str()).copied()).collect();
            let clave = (c.id.bytes().fold(2166136261u32, |h, b| (h ^ b as u32).wrapping_mul(16777619)) | 0x4000_0000) & !1;
            CapActiva { c, t: 0.0, idx, escena, clave }
        });
        if self.cap.is_none() { self.emo_lift = 0.0; }
    }
    /// el lugar de reposo de la cadera (P.D.sub[Hips].p)
    pub fn reposo_cadera(&self) -> V { self.h[HIPS].map(|i| self.reposo.0[i]).unwrap_or([0.0; 3]) }
    /// juntosPose: la pose en un cuadro de una captura (en la escena: la cadera entera, en el origen y sin girar): dónde
    /// quedan los huesos pedidos. No toca al personaje
    pub fn pose_captura(&self, c: &Arc<Captura>, f: f32, huesos: &[&str]) -> HashMap<String, V> {
        let mut p = self.clone(); p.r.clone_from(&self.reposo.1); if let Some(hi) = p.h[HIPS] { p.p[hi] = self.reposo.0[hi]; }
        p.emote_captura(Some(c.clone()), true); p.cap_aplicar(c, f.min(c.nf as f32 - 1.001), 1.0); p.raiz = m4::id(); p.actualizar();
        huesos.iter().filter_map(|n| p.nodo_humano(n).map(|i| (n.to_string(), pos(&p.w[i])))).collect()
    }
    /// el emote de captura que hace (su id) y cuánto lleva
    pub fn captura(&self) -> Option<(&str, f32)> { self.cap.as_ref().map(|c| (c.c.id.as_str(), c.t)) }
    /// en un emote (de los estados del juego o de captura): P.emote
    pub(super) fn en_emo(&self) -> bool { self.emo.is_some() || self.cap.is_some() }
    pub(super) fn clave_cap(&self) -> Option<u32> { self.cap.as_ref().map(|c| c.clave) }
    /// emoPose: el cuadro de ahora encima de la pose que ya tiene
    pub(super) fn cap_pose(&mut self, dt: f32) {
        let Some(st) = self.cap.as_mut() else { return };
        st.t += dt;
        let (c, t, escena) = (st.c.clone(), st.t, st.escena);
        let lp = c.bucle && !escena;
        if !lp && t >= c.d { self.cap = None; return; }
        let mut w = ss01(t / 0.25); if !lp { w *= 1.0 - ss01((t - (c.d - 0.3)) / 0.3); }
        if !lp { self.cap_aplicar(&c, (t * c.fps).min(c.nf as f32 - 1.001), w); if !escena { self.emo_suelo(dt); } return; }
        let (a, b, dif) = c.bucle(); let l = (b - a).max(1);
        let ff = (2.0f32).max(((redondo((0.3 + dif / 250.0).clamp(0.3, 0.8) * c.fps)) as f32).min((l / 2) as f32));
        let f0 = t * c.fps; let mut f = f0; if f >= b as f32 { f = a as f32 + (f - a as f32) % l as f32; }
        self.cap_aplicar(&c, f, w);
        if f0 >= b as f32 && f - (a as f32) < ff { self.cap_inercia(&c, a, b, w * (1.0 - ss01((f - a as f32) / ff))); }
        if !escena { self.emo_suelo(dt); }
    }
    /// emoAplicar: el cuadro f (con fracción) con peso w; la cadera, su lugar de reposo más lo de la captura (en el lugar; de
    /// a dos, la de la captura entera y sin fundido)
    fn cap_aplicar(&mut self, c: &Captura, f: f32, w: f32) {
        let Some(st) = self.cap.as_ref() else { return }; let (idx, escena) = (st.idx.clone(), st.escena);
        let nb = c.b.len(); let f0 = (f.floor() as usize).min(c.nf - 1); let f1 = (f0 + 1).min(c.nf - 1); let a = f - f0 as f32;
        let q = |o: usize| qnorm([c.r[o] as f32 / 32767.0, c.r[o + 1] as f32 / 32767.0, c.r[o + 2] as f32 / 32767.0, c.r[o + 3] as f32 / 32767.0]);
        for k in 0..nb { let Some(i) = idx[k] else { continue }; let qe = slerp(q((f0 * nb + k) * 4), q((f1 * nb + k) * 4), a); self.r[i] = slerp(self.r[i], qe, w); }
        let Some(kh) = c.b.iter().position(|x| x == "Hips") else { return }; let Some(hi) = idx[kh] else { return };
        let Some(hraw) = &c.h else { return };
        let lugar; let hh: &[f32] = if escena { lugar = hraw.iter().map(|&x| x as f32).collect::<Vec<f32>>(); &lugar } else { c.en_lugar() };
        let b0 = self.reposo.0[hi]; let (o0, o1) = (f0 * 3, f1 * 3); let wp = if escena { 1.0 } else { w };
        for e in 0..3 { let v = (hh[o0 + e] + (hh[o1 + e] - hh[o0 + e]) * a) / 1000.0; self.p[hi][e] += (b0[e] + v - self.p[hi][e]) * wp; }
    }
    /// emoInercia: al dar la vuelta (de b a a) cada hueso arranca con la diferencia del salto y la va soltando
    fn cap_inercia(&mut self, c: &Captura, a: usize, b: usize, s: f32) {
        if s <= 0.001 { return; }
        let Some(st) = self.cap.as_ref() else { return }; let (idx, escena) = (st.idx.clone(), st.escena);
        let nb = c.b.len(); let rr = &c.r;
        for k in 0..nb {
            let Some(i) = idx[k] else { continue }; let (oa, ob) = ((a * nb + k) * 4, (b * nb + k) * 4);
            let qi = qnorm([rr[ob] as f32 / 32767.0, rr[ob + 1] as f32 / 32767.0, rr[ob + 2] as f32 / 32767.0, rr[ob + 3] as f32 / 32767.0]);
            let qj = qnorm([-(rr[oa] as f32) / 32767.0, -(rr[oa + 1] as f32) / 32767.0, -(rr[oa + 2] as f32) / 32767.0, rr[oa + 3] as f32 / 32767.0]);
            let dq = slerp([0.0, 0.0, 0.0, 1.0], qmul(qi, qj), s); self.r[i] = qmul(dq, self.r[i]);
        }
        let Some(kh) = c.b.iter().position(|x| x == "Hips") else { return }; let Some(hi) = idx[kh] else { return }; let Some(hraw) = &c.h else { return };
        let lugar; let hh: &[f32] = if escena { lugar = hraw.iter().map(|&x| x as f32).collect::<Vec<f32>>(); &lugar } else { c.en_lugar() };
        for e in 0..3 { self.p[hi][e] += (hh[b * 3 + e] - hh[a * 3 + e]) / 1000.0 * s; }
        if !escena { let b0 = self.reposo.0[hi]; let (dx, dz) = (self.p[hi][0] - b0[0], self.p[hi][2] - b0[2]); let m = dx.hypot(dz) / 0.45; if m > 1.0 { self.p[hi][0] = b0[0] + dx / m; self.p[hi][2] = b0[2] + dz / m; } }
    }
    /// emoSuelo: ningún hueso de la cadera para abajo debajo del piso (sube rápido, baja suave)
    fn emo_suelo(&mut self, dt: f32) {
        let Some(hi) = self.h[HIPS] else { return };
        let r0 = self.raiz; self.raiz = m4::id(); self.actualizar();
        let mut mn = 1e9f32; for k in 0..self.w.len() { let mut q = k as i32; while q >= 0 && q as usize != hi { q = self.pa[q as usize]; } if q >= 0 { mn = mn.min(self.w[k][13]); } }
        let hace = (0.0 - 0.01 - mn).max(0.0); let l0 = self.emo_lift;
        self.emo_lift = if hace > l0 { hace } else { l0 + (hace - l0) * (dt * 6.0).min(1.0) };
        if self.emo_lift >= 0.002 {
            let pa = self.pa[hi]; let wp = if pa >= 0 { self.w[pa as usize] } else { self.raiz };
            let (a, b, c, d, e, f, g, h, i) = (wp[0], wp[4], wp[8], wp[1], wp[5], wp[9], wp[2], wp[6], wp[10]);
            let det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
            if det.abs() >= 1e-12 { let y = self.emo_lift; self.p[hi][0] += (-(b * i - c * h) * y) / det; self.p[hi][1] += ((a * i - c * g) * y) / det; self.p[hi][2] += (-(a * h - b * g) * y) / det; }
        }
        self.raiz = r0;
    }
    /// aterrizarPies con un emote de captura: sólo se corrige un poco (±6 cm) y nada del cuerpo abajo del piso
    pub(super) fn aterrizar_cmu(&mut self, dt: f32) {
        let (Some(lf), Some(rf)) = (self.h[L_FOOT], self.h[R_FOOT]) else { return };
        self.actualizar();
        let mut bajo = self.w[lf][13].min(self.w[rf][13]) - self.tobillo;
        if let Some(pz) = self.pies { for (l, i) in [(0usize, lf), (1, rf)] { let w = &self.w[i]; for q in pz[l] { let y = w[1] * q[0] + w[5] * q[1] + w[9] * q[2] + w[13]; if y < bajo { bajo = y; } } } }
        let dy = 0.0 - bajo; let lleno = self.agach > 0.05;
        let mut meta = clamp(dy, if lleno { -0.75 } else { -0.06 }, 0.06);
        let mut sube = 0.0f32; for (n, r) in PISO_HUESOS { if let Some(i) = self.nodo_humano(n) { let fz = r * self.tam - (self.w[i][13] - 0.0); if fz > sube { sube = fz; } } }
        meta = meta.max(sube.min(0.8));
        self.pie_corr += (meta - self.pie_corr) * (dt * 18.0).min(1.0);
        if self.pie_corr.abs() > 1e-4 { self.raiz[13] += self.pie_corr; }
    }
}
