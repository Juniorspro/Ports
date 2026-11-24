//! Lo de destruccion.js que no depende del juego: el ruido de las arrugas de la chapa (desRuido), la copia de la malla de
//! un nodo del auto con sus triángulos de cada vértice (desNodo), la abolladura (desAbollar, por nodo) que rehace las
//! normales de lo que se hundió (desSubir) y los sonidos del choque hechos acá (desSonido: golpe, fuerte y vidrio, con
//! ruido filtrado y parciales que se apagan). Las mismas cuentas y en el mismo orden que la web (verificado contra el JS
//! en node: las pruebas de abajo).
use jxmotor::escena::{Cabecera, Escena, Malla};
use jxmotor::mat::M4;

type V = [f64; 3];
#[inline] fn dot(a: V, b: V) -> f64 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
#[inline] fn cruz(a: V, b: V) -> V { [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
#[inline] fn largo(a: V) -> f64 { dot(a, a).sqrt() }
fn norm(a: V) -> V { let l = largo(a); if l > 0.0 { [a[0] / l, a[1] / l, a[2] / l] } else { a } }
#[inline] fn clamp(x: f64, a: f64, b: f64) -> f64 { if x < a { a } else if x > b { b } else { x } }
/// Math.round (la mitad, para arriba)
#[inline] fn redondo(x: f64) -> f64 { (x + 0.5).floor() }

/// _desH: un número de 0 a 1 por cada punto de la grilla
pub fn hash(x: i64, y: i64, z: i64) -> f64 {
    let h = x.wrapping_mul(374761393).wrapping_add(y.wrapping_mul(668265263)).wrapping_add(z.wrapping_mul(1440662683)) as i32;
    let h = (h ^ ((h as u32 >> 13) as i32)).wrapping_mul(1274126177);
    ((h ^ ((h as u32 >> 16) as i32)) as u32) as f64 / 4294967295.0
}
/// desRuido: ruido suave (valor en una grilla de 1, interpolado): las arrugas de la chapa
pub fn ruido(x: f64, y: f64, z: f64) -> f64 {
    let (xi, yi, zi) = (x.floor(), y.floor(), z.floor()); let (fx, fy, fz) = (x - xi, y - yi, z - zi);
    let (sx, sy, sz) = (fx * fx * (3.0 - 2.0 * fx), fy * fy * (3.0 - 2.0 * fy), fz * fz * (3.0 - 2.0 * fz)); let mut r = 0.0;
    for c in 0..8 { let (a, b, d) = (c & 1, (c >> 1) & 1, c >> 2);
        r += hash(xi as i64 + a, yi as i64 + b, zi as i64 + d) * (if a != 0 { sx } else { 1.0 - sx }) * (if b != 0 { sy } else { 1.0 - sy }) * (if d != 0 { sz } else { 1.0 - sz }); }
    r
}
/// desEsc: la escala media de una matriz
pub fn escala(w: &M4) -> f64 { let c = |o: usize| (w[o] as f64).hypot(w[o + 1] as f64).hypot(w[o + 2] as f64); (c(0) + c(4) + c(8)) / 3.0 }
/// un punto por la matriz (m4pt)
pub fn punto(w: &M4, x: f64, y: f64, z: f64) -> V {
    let m = |k: usize| w[k] as f64;
    [m(0) * x + m(4) * y + m(8) * z + m(12), m(1) * x + m(5) * y + m(9) * z + m(13), m(2) * x + m(6) * y + m(10) * z + m(14)]
}
/// desLin: un vector llevado por la parte lineal de una matriz
fn lineal(i: &M4, v: V) -> V { let m = |k: usize| i[k] as f64; [m(0) * v[0] + m(4) * v[1] + m(8) * v[2], m(1) * v[0] + m(5) * v[1] + m(9) * v[2], m(2) * v[0] + m(6) * v[1] + m(10) * v[2]] }

/// la copia de la malla de un nodo (desNodo): los vértices como están en el paquete (14 bytes: posición en 16 bits,
/// normal en 8, UV), las posiciones en metros (en el marco del nodo), los triángulos de cada vértice (para rehacer las
/// normales) y cuánto se hundió cada uno
#[derive(Clone)]
pub struct Copia {
    pub v: usize, pub mn: [f32; 3], pub sc: [f32; 3], pub vb: Vec<u8>, pub ib: Vec<u8>, pub i32: bool, pub ni: usize,
    pub p: Vec<f32>, pub idx: Vec<u32>, cu: Vec<u32>, t: Vec<u32>, pub d: Vec<f32>,
}
impl Copia {
    /// de los bytes de la malla: `vb` los vértices (v × 14), `ib` los índices (ni de 16 o 32 bits)
    pub fn de(vb: &[u8], ib: &[u8], v: usize, ni: usize, i32: bool, mn: [f32; 3], sc: [f32; 3]) -> Option<Copia> {
        if vb.len() < v * 14 || ib.len() < ni * if i32 { 4 } else { 2 } { return None; }
        let vb = vb[..v * 14].to_vec(); let ib = ib[..ni * if i32 { 4 } else { 2 }].to_vec();
        let mut p = vec![0f32; v * 3];
        for k in 0..v { for a in 0..3 { let q = u16::from_le_bytes([vb[k * 14 + a * 2], vb[k * 14 + a * 2 + 1]]); p[k * 3 + a] = (mn[a] as f64 + q as f64 / 65535.0 * sc[a] as f64) as f32; } }
        let idx: Vec<u32> = (0..ni).map(|k| if i32 { u32::from_le_bytes([ib[k * 4], ib[k * 4 + 1], ib[k * 4 + 2], ib[k * 4 + 3]]) } else { u16::from_le_bytes([ib[k * 2], ib[k * 2 + 1]]) as u32 }).collect();
        if idx.iter().any(|&i| i as usize >= v) { return None; }
        // (los triángulos de cada vértice: cu[k]..cu[k+1] en t)
        let mut cu = vec![0u32; v + 1];
        for &i in &idx { cu[i as usize + 1] += 1; }
        for k in 0..v { cu[k + 1] += cu[k]; }
        let mut t = vec![0u32; ni]; let mut pp: Vec<u32> = cu[..v].to_vec();
        for (k, &i) in idx.iter().enumerate() { t[pp[i as usize] as usize] = (k / 3) as u32; pp[i as usize] += 1; }
        Some(Copia { v, mn, sc, vb, ib, i32, ni, p, idx, cu, t, d: vec![0.0; v] })
    }
    /// la escena para subirla con el número `id` (la misma malla, con lo hundido)
    pub fn escena(&self, id: i64) -> Escena {
        let mut datos = self.vb.clone(); while datos.len() % 4 != 0 { datos.push(0); }
        let io = datos.len(); datos.extend_from_slice(&self.ib);
        let malla = Malla { id, v: self.v as u32, mn: self.mn, sc: self.sc, i32: self.i32 as u8, ni: self.ni as u32, vo: 0, io, lo: -1, so: -1, lm: -1 };
        Escena { c: Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![malla], mats: vec![], texs: vec![], lms: vec![], items: vec![], agua: None, cielo: None }, datos }
    }
    /// desSubir: los vértices que cambiaron vuelven a los 14 bytes y se rehacen sus normales (las de los triángulos que
    /// los tocan, mezcladas con las originales según cuánto se hundió cada uno: un raspón no cambia el brillo de la
    /// chapa, una trompa aplastada sí)
    fn subir(&mut self, cambio: &[usize]) {
        let (mn, sc) = (self.mn, self.sc);
        for &k in cambio {
            for a in 0..3 {
                let s = if sc[a] != 0.0 { sc[a] as f64 } else { 1.0 };
                let q = clamp(redondo((self.p[k * 3 + a] as f64 - mn[a] as f64) / s * 65535.0), 0.0, 65535.0) as u16;
                self.vb[k * 14 + a * 2..k * 14 + a * 2 + 2].copy_from_slice(&q.to_le_bytes());
            }
            let (mut nx, mut ny, mut nz) = (0.0f64, 0.0f64, 0.0f64); let pf = |i: usize| self.p[i] as f64;
            for q in self.cu[k]..self.cu[k + 1] {
                let tt = self.t[q as usize] as usize * 3; let (a, b, c) = (self.idx[tt] as usize * 3, self.idx[tt + 1] as usize * 3, self.idx[tt + 2] as usize * 3);
                let (ux, uy, uz, vx, vy, vz) = (pf(b) - pf(a), pf(b + 1) - pf(a + 1), pf(b + 2) - pf(a + 2), pf(c) - pf(a), pf(c + 1) - pf(a + 1), pf(c + 2) - pf(a + 2));
                nx += uy * vz - uz * vy; ny += uz * vx - ux * vz; nz += ux * vy - uy * vx;
            }
            let o = k * 14 + 6; let s8 = |i: usize| self.vb[i] as i8 as f64 / 127.0;
            let (ox, oy, oz) = (s8(o), s8(o + 1), s8(o + 2)); let l = (nx * nx + ny * ny + nz * nz).sqrt(); if l < 1e-12 { continue; }
            let mut nr = [nx / l, ny / l, nz / l]; if nr[0] * ox + nr[1] * oy + nr[2] * oz < 0.0 { nr = [-nr[0], -nr[1], -nr[2]]; }   // (el sentido de los triángulos: el de la normal original)
            let w = clamp(self.d[k] as f64 / 0.05, 0.0, 0.85); let (mx, my, mz) = (ox + (nr[0] - ox) * w, oy + (nr[1] - oy) * w, oz + (nr[2] - oz) * w);
            let lm = { let x = (mx * mx + my * my + mz * mz).sqrt(); if x != 0.0 { x } else { 1.0 } };
            for (j, c) in [mx, my, mz].into_iter().enumerate() { self.vb[o + j] = (redondo(c / lm * 127.0) as i32) as i8 as u8; }
        }
    }
    /// desAbollar para este nodo, con `w` su matriz en el mundo: hunde la chapa alrededor de `pw` hacia `dir` (para
    /// adentro del auto), `hondo` en el punto del golpe, que se apaga en `radio` de costado y hacia adentro; con arrugas y
    /// un poco de corrimiento de costado. `inflar`: cada vértice para afuera desde `pw` (la explosión de adentro). Devuelve
    /// cuánto se movió en total (0: nada; si movió algo, la copia ya tiene los bytes nuevos para subir)
    pub fn abollar(&mut self, w: &M4, pw: V, dir: V, hondo: f64, radio: f64, inflar: bool) -> f64 {
        const TOPE: f64 = 0.75;
        let s = { let e = escala(w); if e != 0.0 { e } else { 1.0 } };
        let iw = jxmotor::mat::inv(w);
        let pl = punto(&iw, pw[0], pw[1], pw[2]); let dl = norm(lineal(&iw, dir)); let rl = radio / s; let r2 = rl * rl;
        // (de costado: un eje perpendicular al golpe, para que la chapa se arrugue y no sólo se corra)
        let up = lineal(&iw, if dir[1].abs() < 0.8 { [0.0, 1.0, 0.0] } else { [1.0, 0.0, 0.0] }); let lat = norm(cruz(dl, up)); let k0 = 1.0 / 0.2;
        let mut cambio = vec![]; let mut total = 0.0;
        for k in 0..self.v {
            let (px, py, pz) = (self.p[k * 3] as f64, self.p[k * 3 + 1] as f64, self.p[k * 3 + 2] as f64);
            let (x, y, z) = (px - pl[0], py - pl[1], pz - pl[2]); let d2 = x * x + y * y + z * z;
            if d2 > r2 * 2.2 { continue; }
            let (wx, wy, wz) = (px * s * k0, py * s * k0, pz * s * k0); let ru = ruido(wx, wy, wz);
            let (mov, e) = if inflar {
                let l = { let l = d2.sqrt(); if l != 0.0 { l } else { 1.0 } }; let f = clamp(1.0 - l / rl, 0.0, 1.0); if f <= 0.0 { continue; }
                (hondo / s * (0.35 + 0.65 * f) * (0.4 + 1.2 * ru), [x / l, y / l, z / l])
            } else {
                let al = x * dl[0] + y * dl[1] + z * dl[2]; let p2 = (d2 - al * al).max(0.0); if p2 > r2 { continue; }
                let fp = (1.0 - p2 / r2).powi(2); let fa = if al <= 0.0 { 1.0 } else { (-al / (rl * 0.85)).exp() };
                let sl = (ruido(wx + 17.3, wy + 4.1, wz + 9.7) - 0.5) * 0.55;   // (la arruga: para un costado o el otro)
                (hondo / s * fp * fa * (0.7 + 0.6 * ru), [dl[0] + lat[0] * sl, dl[1] + lat[1] * sl, dl[2] + lat[2] * sl])
            };
            let m = mov.min((TOPE - self.d[k] as f64) / s); if m * s < 0.0015 { continue; }
            for a in 0..3 { self.p[k * 3 + a] = (self.p[k * 3 + a] as f64 + e[a] * m) as f32; }
            self.d[k] = (self.d[k] as f64 + m * s) as f32; total += m * s; cambio.push(k);
        }
        if cambio.is_empty() { return 0.0; }
        // (los vecinos de lo que se movió también cambian de normal: los vértices de sus triángulos)
        let mut ve = vec![false; self.v]; let mut lista = vec![];
        for &k in &cambio { if !ve[k] { ve[k] = true; lista.push(k); } }
        for &k in &cambio { for q in self.cu[k]..self.cu[k + 1] { let tt = self.t[q as usize] as usize * 3; for j in 0..3 { let i = self.idx[tt + j] as usize; if !ve[i] { ve[i] = true; lista.push(i); } } } }
        self.subir(&lista);
        total
    }
}

/// desSonido: el sonido de un choque hecho acá (`tipo`: "golpe", "fuerte" o "vidrio"; `va` la variante, 0 a 2), mono a
/// `sr` muestras por segundo: golpe sordo, chapa que se arruga (granos de ruido muy juntos), el metal que suena
/// (parciales inarmónicos) y, el fuerte, pedazos que caen; el vidrio, granos agudos y muchas astillas
pub fn sonido(tipo: &str, va: u32, sr: f64) -> Vec<f32> {
    let dur = match tipo { "vidrio" => 1.1, "fuerte" => 1.6, _ => 0.7 }; let n_tot = (sr * dur).floor() as usize;
    let mut d = vec![0f32; n_tot];
    let mut sem: f64 = 7919.0 * (va as f64 + 1.0) + tipo.len() as f64 * 104729.0;
    let mut az = || { sem = (sem * 16807.0) % 2147483647.0; sem / 2147483647.0 };
    // (un grano: ruido por un filtro pasabanda —variable de estado— con ataque corto y caída exponencial)
    fn grano(d: &mut [f32], az: &mut dyn FnMut() -> f64, sr: f64, t0: f64, l: f64, fc: f64, q: f64, a: f64) {
        let n_tot = d.len(); let i0 = (t0 * sr).floor() as usize; let n = (l * 5.0 * sr).floor() as usize; let qd = 1.0 / q;
        let f = (((4.0 + qd * qd).sqrt() - qd) * 0.9).min(2.0 * (std::f64::consts::PI * fc.min(sr * 0.45) / sr).sin());
        let (mut lo, mut bp) = (0.0f64, 0.0f64);
        let mut i = 0; while i < n && i0 + i < n_tot {
            let t = i as f64 / sr; let env = (t / 0.0015).min(1.0) * (-t / l).exp(); let hp = (az() * 2.0 - 1.0) - lo - bp * qd; bp += f * hp; lo += f * bp;
            d[i0 + i] = (d[i0 + i] as f64 + bp * a * env) as f32; i += 1;
        }
    }
    fn parcial(d: &mut [f32], sr: f64, t0: f64, f: f64, tau: f64, a: f64) {
        let n_tot = d.len(); let i0 = (t0 * sr).floor() as usize; let n = (tau * 6.0 * sr).floor() as usize; let w = 2.0 * std::f64::consts::PI * f / sr;
        if f > sr * 0.45 { return; }
        let mut i = 0; while i < n && i0 + i < n_tot { let t = i as f64 / sr; d[i0 + i] = (d[i0 + i] as f64 + (w * i as f64).sin() * a * (-t / tau).exp() * (t / 0.001).min(1.0)) as f32; i += 1; }
    }
    if tipo == "vidrio" {
        grano(&mut d, &mut az, sr, 0.0, 0.035, 6000.0, 0.7, 0.9); grano(&mut d, &mut az, sr, 0.004, 0.05, 3500.0, 0.8, 0.6);
        for _ in 0..110 { let t0 = az().powf(2.1) * 0.95; let f = 2400.0 + az() * 7000.0; let tau = 0.004 + az() * 0.022; let a = 0.32 * (1.0 - t0) * (0.3 + 0.7 * az()); parcial(&mut d, sr, t0, f, tau, a); }
    } else {
        let fuerte = tipo == "fuerte"; let mut ph = 0.0f64;
        // golpe sordo (de 90 a 38 Hz)
        for i in 0..n_tot { let t = i as f64 / sr; let f = 38.0 + 55.0 * (-t * 16.0).exp(); ph += 2.0 * std::f64::consts::PI * f / sr;
            d[i] = (d[i] as f64 + ph.sin() * (-t * if fuerte { 7.0 } else { 12.0 }).exp() * (t / 0.002).min(1.0) * 0.95) as f32; }
        // chapa que se arruga: granos de ruido muy juntos al principio
        let (g, tt) = if fuerte { (46, 0.42) } else { (14, 0.1) };
        for _ in 0..g { let t0 = az().powf(1.7) * tt; let l = 0.004 + az() * 0.02; let fc = 500.0 + az() * 3800.0; let q = 1.3 + az() * 2.0; let a = 0.55 * (-t0 * 3.0).exp() * (0.4 + 0.6 * az()); grano(&mut d, &mut az, sr, t0, l, fc, q, a); }
        // el metal que suena (parciales inarmónicos)
        let f0 = 120.0 + az() * 70.0;
        for (k, r) in [1.0, 2.32, 4.25, 6.63, 9.38, 12.5, 16.1].into_iter().enumerate() {
            let t0 = az() * 0.01; let f = f0 * r * (1.0 + (az() - 0.5) * 0.05);
            parcial(&mut d, sr, t0, f, (if fuerte { 0.55 } else { 0.28 }) / (1.0 + k as f64 * 0.4), 0.16 / (1.0 + k as f64 * 0.45));
        }
        // pedazos que caen y traquetean
        if fuerte { for _ in 0..14 { let t0 = 0.3 + az() * 1.1; let l = 0.003 + az() * 0.006; let fc = 2000.0 + az() * 3500.0; grano(&mut d, &mut az, sr, t0, l, fc, 3.0, 0.14 * (1.0 - t0 / dur)); } }
    }
    let pk = d.iter().fold(0.0f64, |m, x| m.max((*x as f64).abs()));
    if pk > 0.0 { let g = 0.9 / pk; for x in d.iter_mut() { *x = (*x as f64 * g) as f32; } }
    d
}

#[cfg(test)]
mod pruebas {
    use super::*;
    /// los números de la web (node, destruccion.js tal cual: _desH, desRuido y desSonido con sampleRate 48000)
    #[test]
    fn como_la_web() {
        assert_eq!(hash(0, 0, 0), 0.0);
        assert!((hash(3, -7, 11) - 0.040156449433452555).abs() < 1e-15, "{}", hash(3, -7, 11));
        assert!((ruido(1.3, -2.7, 5.25) - 0.436019571147255).abs() < 1e-12, "{}", ruido(1.3, -2.7, 5.25));
        let g = sonido("golpe", 1, 48000.0); assert_eq!(g.len(), 33600);
        assert!((g[1000] as f64 - -0.38240522146224976).abs() < 1e-6 && (g[20000] as f64 - -0.014045358635485172).abs() < 1e-6, "{} {}", g[1000], g[20000]);
        let v = sonido("vidrio", 2, 48000.0); assert!((v[4321] as f64 - -0.09847964346408844).abs() < 1e-6, "{}", v[4321]);
        let f = sonido("fuerte", 0, 48000.0); assert!((f[30000] as f64 - 0.05394543334841728).abs() < 1e-6, "{}", f[30000]);
    }
    /// una placa de 11 × 11 vértices en el piso (y = 0) con un golpe de arriba: el centro baja, lo de afuera del radio no
    #[test]
    fn abollar_placa() {
        let n = 11; let mut vb = vec![]; let mut ib: Vec<u8> = vec![];
        for j in 0..n { for i in 0..n { for q in [(i * 6553) as u16, 0u16, (j * 6553) as u16] { vb.extend_from_slice(&q.to_le_bytes()); } vb.extend_from_slice(&[0, 127, 0, 127, 0, 0, 0, 0]); } }
        for j in 0..n - 1 { for i in 0..n - 1 { let a = (j * n + i) as u16; for k in [a, a + n as u16, a + 1, a + 1, a + n as u16, a + n as u16 + 1] { ib.extend_from_slice(&k.to_le_bytes()); } } }
        let mut c = Copia::de(&vb, &ib, n * n, (n - 1) * (n - 1) * 6, false, [-1.0, 0.0, -1.0], [2.0, 0.01, 2.0]).unwrap();
        let w = jxmotor::mat::id();
        let tot = c.abollar(&w, [0.0, 0.0, 0.0], [0.0, -1.0, 0.0], 0.2, 0.6, false);
        assert!(tot > 0.0);
        let centro = 5 * n + 5; assert!(c.p[centro * 3 + 1] < -0.1, "{}", c.p[centro * 3 + 1]);
        assert_eq!(c.d[0], 0.0);
    }
    /// desAbollar de la web sobre una chapa curva de 9 × 9 en un nodo girado, escalado y corrido (des_abollar.js en node):
    /// un golpe y después una explosión de adentro; lo hundido, las posiciones y los bytes (posición y normal) iguales
    #[test]
    fn abollar_como_la_web() {
        let n = 9usize; let mut vb = vec![]; let mut ib: Vec<u8> = vec![];
        for j in 0..n { for i in 0..n { let (x, z) = (i as f64 / 8.0, j as f64 / 8.0); let y = 0.5 + 0.3 * (x * 3.0).sin() * (z * 2.0).cos();
            for q in [x, y, z] { vb.extend_from_slice(&(((q * 65535.0) + 0.5).floor() as u16).to_le_bytes()); } vb.extend_from_slice(&[0, 127, 0, 127, 0, 0, 0, 0]); } }
        for j in 0..n - 1 { for i in 0..n - 1 { let a = (j * n + i) as u16; for k in [a, a + n as u16, a + 1, a + 1, a + n as u16, a + n as u16 + 1] { ib.extend_from_slice(&k.to_le_bytes()); } } }
        let mut c = Copia::de(&vb, &ib, n * n, (n - 1) * (n - 1) * 6, false, [-1.0, -0.2, -1.0], [2.0, 0.4, 2.0]).unwrap();
        let w: M4 = [1.0186430215835571, 0.23872821033000946, -0.7716056108474731, 0.0, -0.07640688121318817, 1.2648303508758545, 0.29045844078063965, 0.0, 0.8040698766708374, -0.182244211435318, 1.0051162242889404, 0.0, 4.0, 1.2000000476837158, -3.0, 1.0];
        let t1 = c.abollar(&w, [4.2, 1.9, -2.8], norm([0.2, -1.0, 0.3]), 0.3, 1.1, false);
        let t2 = c.abollar(&w, [3.5, 1.5, -3.4], norm([-1.0, 0.1, 0.2]), 0.25, 0.9, true);
        assert!((t1 - 1.8789590764469142).abs() < 1e-4 && (t2 - 3.4956176906710064).abs() < 1e-4, "{t1} {t2}");
        let p = [[-0.7499961853027344, 0.04258792847394943, -0.7499961853027344], [-0.0104557229205966, -0.019656891003251076, 0.07960108667612076], [0.25130799412727356, -0.017718303948640823, 0.09518785029649734], [0.22643248736858368, -0.03890671208500862, 0.3010225296020508]];
        let dd = [0.0, 0.16346421837806702, 0.17904576659202576, 0.12102770805358887];
        let b: [[u8; 10]; 4] = [[0, 32, 65, 155, 0, 32, 0, 127, 0, 127], [169, 126, 107, 115, 48, 138, 1, 127, 9, 127], [42, 160, 169, 116, 47, 140, 249, 126, 10, 127], [251, 156, 25, 103, 135, 166, 250, 126, 18, 127]];
        for (j, &k) in [10usize, 40, 41, 50].iter().enumerate() {
            for a in 0..3 { assert!((c.p[k * 3 + a] as f64 - p[j][a]).abs() < 1e-5, "P {k} {a}: {} {}", c.p[k * 3 + a], p[j][a]); }
            assert!((c.d[k] as f64 - dd[j]).abs() < 1e-5, "D {k}");
            for a in 0..10 { assert!((c.vb[k * 14 + a] as i32 - b[j][a] as i32).abs() <= 1, "B {k} {a}: {:?} {:?}", &c.vb[k * 14..k * 14 + 10], b[j]); }
        }
    }
}
