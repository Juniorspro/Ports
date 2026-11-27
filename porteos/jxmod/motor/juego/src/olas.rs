//! Las olas del agua de los mapas, simuladas (no animadas): una grilla de alturas alrededor de la cámara (128 × 128 celdas
//! de 25 cm: 32 m de lado) con la ecuación de onda, paso a paso. Lo que entra al agua, sale o se mueve en ella la empuja
//! (el volumen que corre: se hunde donde entra y sube alrededor, y adelante de lo que avanza); las olas viajan, se cruzan,
//! rebotan contra la orilla y se apagan de a poco. Lo que flota sube y baja con ellas (flotar.rs lee la altura) y el agua
//! se dibuja con su relieve (EF_OLAS: la normal de cada celda).
use crate::flotar::Volumen;

pub const N: usize = 128;
pub const CELDA: f32 = 0.25;
/// la velocidad de las olas (m/s), cuánto duran y el borde de la grilla que las absorbe (celdas)
const C: f32 = 2.4;
const AMORT: f32 = 0.9965;
const BORDE: usize = 10;

pub struct Olas {
    /// la esquina de la grilla (x, z), la superficie del agua (y) y qué volumen es
    pub x0: f32, pub z0: f32, pub y: f32, pub vol: usize,
    /// las alturas ahora y en el paso anterior (m, sobre la superficie); 0 donde no hay agua
    pub h: Vec<f32>, ant: Vec<f32>,
    /// qué celdas son agua
    agua: Vec<bool>,
    /// lo hundido de cada cuerpo en el paso anterior (id → volumen bajo el agua, x, z)
    previo: std::collections::HashMap<u32, (f32, f32, f32)>,
}

impl Olas {
    /// una grilla nueva alrededor de (x, z), sobre el volumen `vol`
    pub fn nueva(vols: &[Volumen], vol: usize, x: f32, z: f32) -> Olas {
        let mut o = Olas { x0: 0.0, z0: 0.0, y: vols[vol].y1 as f32, vol, h: vec![0.0; N * N], ant: vec![0.0; N * N], agua: vec![false; N * N], previo: Default::default() };
        o.centrar(vols, x, z, true); o
    }
    fn mascara(&mut self, vols: &[Volumen]) {
        let v = &vols[self.vol];
        for j in 0..N { for i in 0..N {
            let (x, z) = (self.x0 + (i as f32 + 0.5) * CELDA, self.z0 + (j as f32 + 0.5) * CELDA);
            self.agua[j * N + i] = v.pisa(x as f64, z as f64);
        } }
    }
    /// que la grilla siga a la cámara (se corre de a celdas enteras: lo que ya había, queda)
    pub fn centrar(&mut self, vols: &[Volumen], x: f32, z: f32, siempre: bool) {
        let lado = N as f32 * CELDA; let (cx, cz) = (self.x0 + lado * 0.5, self.z0 + lado * 0.5);
        if !siempre && (x - cx).abs() < lado * 0.25 && (z - cz).abs() < lado * 0.25 { return; }
        let nx0 = ((x - lado * 0.5) / CELDA).floor() * CELDA; let nz0 = ((z - lado * 0.5) / CELDA).floor() * CELDA;
        let (di, dj) = (((nx0 - self.x0) / CELDA).round() as i64, ((nz0 - self.z0) / CELDA).round() as i64);
        let mover = |v: &Vec<f32>| -> Vec<f32> {
            let mut o = vec![0.0; N * N];
            for j in 0..N as i64 { for i in 0..N as i64 { let (si, sj) = (i + di, j + dj); if si >= 0 && sj >= 0 && si < N as i64 && sj < N as i64 { o[(j as usize) * N + i as usize] = v[sj as usize * N + si as usize]; } } }
            o
        };
        if !siempre { self.h = mover(&self.h); self.ant = mover(&self.ant); }
        self.x0 = nx0; self.z0 = nz0; self.mascara(vols);
    }
    /// la altura de las olas en (x, z) (bilineal; 0 afuera)
    pub fn altura(&self, x: f32, z: f32) -> f32 {
        let (u, v) = ((x - self.x0) / CELDA - 0.5, (z - self.z0) / CELDA - 0.5);
        if u < 0.0 || v < 0.0 || u >= (N - 1) as f32 || v >= (N - 1) as f32 { return 0.0; }
        let (i, j) = (u as usize, v as usize); let (fu, fv) = (u - i as f32, v - j as f32);
        let g = |i: usize, j: usize| self.h[j * N + i];
        (g(i, j) * (1.0 - fu) + g(i + 1, j) * fu) * (1.0 - fv) + (g(i, j + 1) * (1.0 - fu) + g(i + 1, j + 1) * fu) * fv
    }
    /// empujar el agua: `vol` m³ que entran (negativo: salen) en un círculo de radio `r` alrededor de (x, z)
    pub fn empujar(&mut self, x: f32, z: f32, r: f32, vol: f32) {
        let r = r.max(CELDA * 0.75); let (ci, cj) = (((x - self.x0) / CELDA) as i64, ((z - self.z0) / CELDA) as i64); let rc = (r / CELDA).ceil() as i64;
        let mut celdas = vec![];
        for j in cj - rc..=cj + rc { for i in ci - rc..=ci + rc {
            if i < 1 || j < 1 || i >= N as i64 - 1 || j >= N as i64 - 1 { continue; }
            let (dx, dz) = (self.x0 + (i as f32 + 0.5) * CELDA - x, self.z0 + (j as f32 + 0.5) * CELDA - z);
            let w = 1.0 - (dx * dx + dz * dz).sqrt() / r; if w > 0.0 && self.agua[j as usize * N + i as usize] { celdas.push((j as usize * N + i as usize, w)); }
        } }
        let s: f32 = celdas.iter().map(|c| c.1).sum(); if s <= 0.0 { return; }
        // (lo que entra hunde el agua donde entra —el volumen que ocupa—; la ola de alrededor sale sola)
        // (la mitad: la otra mitad del agua corrida sale como salpicón —partículas— y no como ola)
        let k = -0.5 * vol / (s * CELDA * CELDA);
        for (c, w) in celdas { self.h[c] = (self.h[c] + k * w).clamp(-0.3, 0.3); }
    }
    /// un paso de dt segundos
    pub fn paso(&mut self, dt: f32) {
        let k = ((C * dt / CELDA) * (C * dt / CELDA)).min(0.45);
        let mut nueva = std::mem::take(&mut self.ant);
        for j in 0..N { for i in 0..N {
            let c = j * N + i;
            if !self.agua[c] || i == 0 || j == 0 || i == N - 1 || j == N - 1 { nueva[c] = 0.0; continue; }
            // (la orilla refleja: una celda sin agua cuenta como la misma altura —borde libre—)
            let hc = self.h[c];
            let v = |cc: usize| if self.agua[cc] { self.h[cc] } else { hc };
            let lap = v(c - 1) + v(c + 1) + v(c - N) + v(c + N) - 4.0 * hc;
            // (en el borde de la grilla se apagan, para que no reboten contra la nada)
            let b = i.min(j).min(N - 1 - i).min(N - 1 - j); let am = if b < BORDE { AMORT - 0.03 * (1.0 - b as f32 / BORDE as f32) } else { AMORT };
            nueva[c] = ((2.0 * hc - nueva[c] + k * lap) * am).clamp(-0.4, 0.4);
        } }
        self.ant = std::mem::replace(&mut self.h, nueva);
    }
    /// lo de un cuerpo en el agua este paso: cuánto volumen tiene hundido y dónde; lo que cambió (entró, salió o se movió)
    /// empuja las olas
    pub fn cuerpo(&mut self, id: u32, x: f32, z: f32, r: f32, hundido: f32) {
        let (v0, x0, z0) = self.previo.get(&id).copied().unwrap_or((0.0, x, z));
        let dv = hundido - v0;
        if dv.abs() > 1e-5 { self.empujar(x, z, r, dv); }
        // (lo que avanza: el agua sube adelante y baja atrás —sale del lugar de antes y entra al nuevo—)
        let d = ((x - x0).powi(2) + (z - z0).powi(2)).sqrt();
        if hundido > 1e-4 && d > 1e-3 { let f = (d / r.max(0.1)).min(1.0) * hundido * 0.5; self.empujar(x0, z0, r, -f); self.empujar(x, z, r, f); }
        if hundido > 1e-5 { self.previo.insert(id, (hundido, x, z)); } else { self.previo.remove(&id); }
    }
    /// lo que se dibuja (EF_OLAS): [x0, z0, lado, N, y de la superficie, 0, 0, 0] y por celda la pendiente en x y en z
    pub fn bloque(&self) -> Vec<f32> {
        let mut o = Vec::with_capacity(8 + N * N * 2);
        o.extend_from_slice(&[self.x0, self.z0, N as f32 * CELDA, N as f32, self.y, 0.0, 0.0, 0.0]);
        for j in 0..N { for i in 0..N {
            let g = |i: usize, j: usize| self.h[j.min(N - 1) * N + i.min(N - 1)];
            let sx = (g(i + 1, j) - g(i.saturating_sub(1), j)) / (2.0 * CELDA); let sz = (g(i, j + 1) - g(i, j.saturating_sub(1))) / (2.0 * CELDA);
            o.push(sx); o.push(sz);
        } }
        o
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn una_piedra() {
        // (una pileta de 20 × 20 m: algo que entra al medio hace una ola que llega a 5 m y se apaga de a poco)
        let vols = vec![Volumen::de_caja([-10.0, -2.0, -10.0], [10.0, 0.0, 10.0])];
        let mut o = Olas::nueva(&vols, 0, 0.0, 0.0);
        o.empujar(0.0, 0.0, 0.3, 0.02);
        let mut max5 = 0.0f32; let mut t5 = 0.0;
        for k in 0..300 { o.paso(1.0 / 60.0); let a = o.altura(5.0, 0.0).abs(); if a > max5 { max5 = a; t5 = k as f32 / 60.0; } }
        let resto: f32 = o.h.iter().map(|x| x.abs()).fold(0.0, f32::max);
        eprintln!("ola a 5 m: {:.1} mm a los {:.2} s (velocidad {:.2} m/s) · lo más alto a los 5 s: {:.1} mm", max5 * 1000.0, t5, 5.0 / t5.max(0.01), resto * 1000.0);
        assert!(max5 > 0.0005 && t5 > 1.0 && t5 < 4.0 && resto < max5 * 3.0);
    }
}
