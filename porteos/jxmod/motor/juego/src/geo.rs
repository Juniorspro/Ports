//! Geometría hecha con código (geo.js y las figuras de gorros.js): una malla con partes (cada parte con su material), las
//! figuras de revolución, esferas, tubos, toros y cajas, y cómo se sube al motor con el formato de las del juego
//! (mallaPropia: la posición en 16 bits dentro de su caja, la normal en 8 y las UV en medio float, 14 bytes por vértice).
use jxmotor::escena::{Malla, Mat};

/// (las cuentas van en f64, como las de JavaScript: la malla sale igual byte a byte)
pub type V = [f64; 3];
pub type Q = [f64; 4];

/// una malla con varias partes (gnMalla: P, N, U y S, las listas de índices de cada parte)
#[derive(Clone, Debug, Default)]
pub struct Geo { pub p: Vec<f64>, pub n: Vec<f64>, pub u: Vec<f64>, pub s: Vec<Vec<u32>> }

fn hyp3(a: f64, b: f64, c: f64) -> f64 { (a * a + b * b + c * c).sqrt() }
pub fn qrot(q: Q, v: V) -> V {
    let (x, y, z, w) = (q[0], q[1], q[2], q[3]);
    let ix = w * v[0] + y * v[2] - z * v[1]; let iy = w * v[1] + z * v[0] - x * v[2]; let iz = w * v[2] + x * v[1] - y * v[0]; let iw = -x * v[0] - y * v[1] - z * v[2];
    [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]
}
pub fn qeje(e: V, a: f64) -> Q { let l = (e[0] * e[0] + e[1] * e[1] + e[2] * e[2]).sqrt().max(1e-12); let s = (a / 2.0).sin(); [e[0] / l * s, e[1] / l * s, e[2] / l * s, (a / 2.0).cos()] }
pub fn qmul(a: Q, b: Q) -> Q { [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]] }
fn sub(a: V, b: V) -> V { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
fn add(a: V, b: V) -> V { [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
fn esc(a: V, k: f64) -> V { [a[0] * k, a[1] * k, a[2] * k] }
fn dot(a: V, b: V) -> f64 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
fn cruz(a: V, b: V) -> V { [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
fn dist(a: V, b: V) -> f64 { let d = sub(a, b); dot(d, d).sqrt() }

impl Geo {
    pub fn nueva() -> Geo { Geo::default() }
    /// gnParte: una parte nueva (su número)
    pub fn parte(&mut self) -> usize { self.s.push(vec![]); self.s.len() - 1 }
    pub fn nv(&self) -> usize { self.p.len() / 3 }
    /// gnV: un vértice con su normal (se normaliza) y sus UV
    pub fn v(&mut self, p: V, n: V, u: f64, v: f64) -> u32 {
        self.p.extend_from_slice(&p); let l = hyp3(n[0] as f64, n[1] as f64, n[2] as f64); let l = if l > 0.0 { l } else { 1.0 };
        self.n.extend_from_slice(&[(n[0] as f64 / l) as f64, (n[1] as f64 / l) as f64, (n[2] as f64 / l) as f64]); self.u.extend_from_slice(&[u, v]);
        (self.p.len() / 3 - 1) as u32
    }
    /// gnTorno: superficie de revolución alrededor de y (perfil [r, y] de abajo hacia arriba; cada tramo con su normal)
    pub fn torno(&mut self, s: usize, prof: &[[f64; 2]], seg: usize, c: V, e: V) {
        // (la normal de cada tramo del perfil; en la web cada tramo va con la suya —bordes duros—, pero allá las caras de
        // afuera no se dibujan —quedan al revés y se descartan— y se ve el gorro liso. Acá se dibujan las dos caras, así que
        // entre tramos casi alineados —la cúpula, de 10° en 10°— la normal se promedia y sólo quedan duros los bordes de verdad)
        let n2: Vec<Option<[f64; 2]>> = (0..prof.len().saturating_sub(1)).map(|i| { let (dr, dy) = (prof[i + 1][0] - prof[i][0], prof[i + 1][1] - prof[i][1]); let l = dr.hypot(dy); if l < 1e-9 { None } else { Some([dy / l, -dr / l]) } }).collect();
        let junta = |a: Option<[f64; 2]>, b: Option<[f64; 2]>, propia: [f64; 2]| -> [f64; 2] { match (a, b) { (Some(a), Some(b)) if a[0] * b[0] + a[1] * b[1] > 0.77 => { let m = [a[0] + b[0], a[1] + b[1]]; let l = m[0].hypot(m[1]); [m[0] / l, m[1] / l] } _ => propia } };
        for i in 0..prof.len().saturating_sub(1) {
            let ([r0, y0], [r1, y1]) = (prof[i], prof[i + 1]); let (dr, dy) = (r1 - r0, y1 - y0); let base = self.nv() as u32;
            let propia = n2[i].unwrap_or([dy, -dr]);
            let ni = [if i > 0 { junta(n2[i - 1], n2[i], propia) } else { propia }, if i + 1 < n2.len() { junta(n2[i], n2[i + 1], propia) } else { propia }];
            for k in 0..=seg {
                let a = (k as f64 / seg as f64) * std::f64::consts::PI * 2.0; let (ca, sa) = (a.cos() as f64, a.sin() as f64);
                for (j, [r, y]) in [[r0, y0], [r1, y1]].into_iter().enumerate() { let [nr, ny] = ni[j]; self.v([c[0] + r * ca * e[0], c[1] + y * e[1], c[2] + r * sa * e[2]], [nr * ca / e[0], ny / e[1], nr * sa / e[2]], k as f64 / seg as f64, y); }
            }
            for k in 0..seg as u32 { let (a, b, d, ee) = (base + k * 2, base + k * 2 + 1, base + k * 2 + 2, base + k * 2 + 3); if r0.abs() + r1.abs() < 1e-6 { continue; } self.s[s].extend_from_slice(&[a, d, b, b, d, ee]); }
        }
    }
    /// gnEsfera: elipsoide entero o una franja de latitudes (de0..a0 en radianes desde arriba)
    pub fn esfera(&mut self, s: usize, c: V, rad: V, seg: usize, ani: usize, de0: f64, a0: f64) {
        let base = self.nv() as u32;
        for j in 0..=ani {
            let t = de0 as f64 + (a0 as f64 - de0 as f64) * (j as f64 / ani as f64); let (st, ct) = (t.sin(), t.cos());
            for k in 0..=seg { let a = (k as f64 / seg as f64) * std::f64::consts::PI * 2.0; let (x, z, y) = ((st * a.cos()) as f64, (st * a.sin()) as f64, ct as f64);
                self.v([c[0] + x * rad[0], c[1] + y * rad[1], c[2] + z * rad[2]], [x / rad[0], y / rad[1], z / rad[2]], k as f64 / seg as f64, j as f64 / ani as f64); }
        }
        for j in 0..ani as u32 { for k in 0..seg as u32 { let a = base + j * (seg as u32 + 1) + k; let b = a + seg as u32 + 1; self.s[s].extend_from_slice(&[a, a + 1, b, b, a + 1, b + 1]); } }
    }
    /// gnTubo: un tubo que sigue una curva de puntos con radios (cuernos, orejas)
    pub fn tubo(&mut self, s: usize, pts: &[V], radios: &[f64], seg: usize) {
        let base = self.nv() as u32; let n = pts.len();
        for i in 0..n {
            let (a, b) = (pts[i.saturating_sub(1)], pts[(i + 1).min(n - 1)]); let mut t = sub(b, a);
            let tl = hyp3(t[0] as f64, t[1] as f64, t[2] as f64); let tl = if tl > 0.0 { tl } else { 1.0 } as f64; t = esc(t, 1.0 / tl);
            let u = if t[1].abs() < 0.9 { [0.0, 1.0, 0.0] } else { [1.0, 0.0, 0.0] };
            let x = cruz(t, u); let xl = hyp3(x[0] as f64, x[1] as f64, x[2] as f64) as f64; let x = esc(x, 1.0 / xl);
            let y = cruz(t, x); let r = radios[i];
            for k in 0..=seg {
                let an = (k as f64 / seg as f64) * std::f64::consts::PI * 2.0; let (ca, sa) = (an.cos() as f64, an.sin() as f64);
                let nn = [x[0] * ca + y[0] * sa, x[1] * ca + y[1] * sa, x[2] * ca + y[2] * sa];
                self.v([pts[i][0] + nn[0] * r, pts[i][1] + nn[1] * r, pts[i][2] + nn[2] * r], nn, k as f64 / seg as f64, i as f64 / (n - 1) as f64);
            }
        }
        for i in 0..(n as u32).saturating_sub(1) { for k in 0..seg as u32 { let a = base + i * (seg as u32 + 1) + k; let b = a + seg as u32 + 1; self.s[s].extend_from_slice(&[a, b, a + 1, a + 1, b, b + 1]); } }
    }
    /// gnToro
    pub fn toro(&mut self, s: usize, c: V, r_g: f64, r: f64, seg: usize) {
        let mut pts = vec![]; let mut rs = vec![];
        for k in 0..=seg { let a = (k as f64 / seg as f64) * std::f64::consts::PI * 2.0; pts.push([c[0] + (a.cos() as f64) * r_g, c[1], c[2] + (a.sin() as f64) * r_g]); rs.push(r); }
        self.tubo(s, &pts, &rs, 10);
    }
    /// gnCupula: media esfera achatada que cubre la cabeza
    pub fn cupula(&mut self, s: usize, r: f64, alto: f64, y0: f64, seg: usize) {
        let mut prof = vec![];
        for i in 0..=9 { let t = (i as f64 / 9.0) * std::f64::consts::FRAC_PI_2; prof.push([(t.cos() as f64) * r, y0 + (t.sin() as f64) * alto]); }
        prof.push([0.0, y0 + alto]); self.torno(s, &prof, seg, [0.0; 3], [1.0; 3]);
    }
    /// geoQuad: un cuadrilátero con su normal (se da vuelta si hace falta) y las UV en metros (`e`: cada cuánto se repite)
    pub fn quad(&mut self, s: usize, a: V, b: V, c: V, d: V, n: V, e: f64) {
        let k = self.nv() as u32; let (w, h) = (dist(a, b) / e, dist(a, d) / e);
        let (b, d) = if dot(cruz(sub(b, a), sub(c, a)), n) < 0.0 { (d, b) } else { (b, d) };
        for (p, uv) in [(a, [0.0, 0.0]), (b, [w, 0.0]), (c, [w, h]), (d, [0.0, h])] { self.p.extend_from_slice(&p); self.n.extend_from_slice(&n); self.u.extend_from_slice(&uv); }
        self.s[s].extend_from_slice(&[k, k + 1, k + 2, k, k + 2, k + 3]);
    }
    /// geoCaja: centro, medios lados y giro
    pub fn caja(&mut self, s: usize, c: V, h: V, q: Q, e: f64) {
        let ej = [qrot(q, [1.0, 0.0, 0.0]), qrot(q, [0.0, 1.0, 0.0]), qrot(q, [0.0, 0.0, 1.0])];
        for a in 0..3 { for sg in [-1.0f64, 1.0] {
            let n = esc(ej[a], sg); let (u, v) = (ej[(a + 1) % 3], ej[(a + 2) % 3]); let (hu, hv) = (h[(a + 1) % 3], h[(a + 2) % 3]);
            let o = add(c, esc(n, h[a])); let p = |i: f64, j: f64| add(o, add(esc(u, i * hu), esc(v, j * hv)));
            self.quad(s, p(-1.0, -1.0), p(1.0, -1.0), p(1.0, 1.0), p(-1.0, 1.0), n, e);
        } }
    }
    /// un triángulo con su normal (idsTri: se ordena para que mire hacia `n`)
    pub fn tri(&mut self, s: usize, a: V, b: V, c: V, n: V) {
        let k = self.nv() as u32; for p in [a, b, c] { self.p.extend_from_slice(&p); self.n.extend_from_slice(&n); }
        self.u.extend_from_slice(&[0.0, 0.0, 1.0, 0.0, 0.0, 1.0]);
        if dot(cruz(sub(b, a), sub(c, a)), n) < 0.0 { self.s[s].extend_from_slice(&[k, k + 2, k + 1]); } else { self.s[s].extend_from_slice(&[k, k + 1, k + 2]); }
    }
    /// la caja que la envuelve (mn, mx)
    pub fn caja_env(&self) -> (V, V) {
        let (mut mn, mut mx) = ([1e9f64; 3], [-1e9f64; 3]);
        for k in 0..self.p.len() { let a = k % 3; mn[a] = mn[a].min(self.p[k]); mx[a] = mx[a].max(self.p[k]); }
        (mn, mx)
    }
    /// las partes, una detrás de la otra: (desde, cuántos) de cada una
    pub fn rangos(&self) -> Vec<(u32, u32)> { let mut o = 0; self.s.iter().map(|s| { let r = (o, s.len() as u32); o += s.len() as u32; r }).collect() }
    /// mallaPropia: los bytes para el motor (vértices de 14 bytes e índices) y la malla con el número `id`; las partes van
    /// una detrás de la otra (`rangos`)
    pub fn malla(&self, id: i64, datos: &mut Vec<u8>) -> Malla {
        let nv = self.nv(); let (mn, mx) = self.caja_env();
        let sc = [0, 1, 2].map(|a| (mx[a] - mn[a]).max(1e-4));
        let alinear = |d: &mut Vec<u8>| { while d.len() % 4 != 0 { d.push(0); } };
        alinear(datos); let vo = datos.len();
        for k in 0..nv {
            for a in 0..3 { let q = ((self.p[k * 3 + a] - mn[a]) / sc[a] * 65535.0 + 0.5).floor().clamp(0.0, 65535.0) as u16; datos.extend_from_slice(&q.to_le_bytes()); }
            for a in 0..3 { datos.push(((self.n[k * 3 + a].clamp(-1.0, 1.0) * 127.0 + 0.5).floor()) as i8 as u8); }
            datos.push(0);
            datos.extend_from_slice(&f2h(*self.u.get(k * 2).unwrap_or(&0.0) as f32).to_le_bytes()); datos.extend_from_slice(&f2h(*self.u.get(k * 2 + 1).unwrap_or(&0.0) as f32).to_le_bytes());
        }
        alinear(datos); let io = datos.len(); let i32 = nv > 65535; let mut ni = 0u32;
        for s in &self.s { for &i in s { if i32 { datos.extend_from_slice(&i.to_le_bytes()); } else { datos.extend_from_slice(&(i as u16).to_le_bytes()); } ni += 1; } }
        alinear(datos);
        Malla { id, v: nv as u32, mn: [mn[0] as f32, mn[1] as f32, mn[2] as f32], sc: [sc[0] as f32, sc[1] as f32, sc[2] as f32], i32: i32 as u8, ni, vo, io, lo: -1, so: -1, lm: -1 }
    }
    /// el centro y el radio de la esfera que la envuelve
    pub fn esfera_env(&self) -> [f32; 4] { let (mn, mx) = self.caja_env(); let c = [(mn[0] + mx[0]) / 2.0, (mn[1] + mx[1]) / 2.0, (mn[2] + mx[2]) / 2.0]; [c[0] as f32, c[1] as f32, c[2] as f32, (dist(mn, mx) / 2.0) as f32] }
}

/// (Math.round de JS: la mitad hacia arriba)
pub fn js_round(x: f32) -> f32 { (x + 0.5).floor() }
/// medio float (gmF2H / aMedio: redondeo al más cercano, el acarreo sube el exponente)
pub fn f2h(v: f32) -> u16 {
    let x = v.to_bits(); let s = ((x >> 16) & 0x8000) as u16; let e = ((x >> 23) & 0xff) as i32 - 112; let m = x & 0x7fffff;
    if e <= 0 { return s; } if e >= 31 { return s | 0x7bff; }
    let h = ((e as u32) << 10) + ((m + 0x1000) >> 13); s | (if h > 0x7bff { 0x7bff } else { h as u16 })
}
pub fn h2f(h: u16) -> f32 {
    let s = if h & 0x8000 != 0 { -1.0 } else { 1.0 }; let e = ((h >> 10) & 0x1f) as i32; let m = (h & 0x3ff) as f32;
    if e == 0 { s * m * 2f32.powi(-24) } else if e == 31 { if m == 0.0 { s * f32::INFINITY } else { f32::NAN } } else { s * (1.0 + m / 1024.0) * 2f32.powi(e - 15) }
}

/// un material liso propio (matPropio: color, rugosidad/metal y brillo propio)
pub fn mat_propio(id: i64, c: [f32; 3], pbr: [f32; 3], em: [f32; 3]) -> Mat {
    Mat { ti: [0.0; 12], pbr, fol: 0, id, t2: -1, terr: None, c: [c[0], c[1], c[2], 1.0], st: [1.0, 1.0, 0.0, 0.0], t: -1, blend: 0, cut: 0, unlit: 0, add: 0, agua: 0, em }
}
/// una imagen WebP a RGBA (la fila 0 arriba)
pub fn webp_rgba(b: &[u8]) -> Option<(u32, u32, Vec<u8>)> {
    let mut dec = image_webp::WebPDecoder::new(std::io::Cursor::new(b)).ok()?; let (w, h) = dec.dimensions(); let alfa = dec.has_alpha();
    let mut px = vec![0u8; dec.output_buffer_size()?]; dec.read_image(&mut px).ok()?;
    Some((w, h, if alfa { px } else { px.chunks_exact(3).flat_map(|c| [c[0], c[1], c[2], 255]).collect() }))
}
