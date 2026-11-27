//! El agua de partículas (la idea de GWater, hecha acá desde cero): un líquido de verdad, simulado, no animado. Cada
//! partícula es un poquito de agua (10 cm, 1 kg) y entre todas cumplen que el agua no se comprime: Position Based Fluids
//! (Macklin y Müller, «Position Based Fluids», SIGGRAPH 2013), escrito desde el artículo:
//!  - se predice dónde va cada una con su velocidad y la gravedad;
//!  - unas vueltas de corregir las posiciones para que la densidad quede en la del reposo (λ de cada una y el empuje
//!    entre vecinas, con la presión artificial que evita que se amontonen), chocando con el mapa en cada vuelta;
//!  - la velocidad sale de cuánto se movió, suavizada con las vecinas (viscosidad XSPH).
//! Choca con todo: los triángulos y los cuerpos fijos del mapa, los objetos de la física (empuja y la empujan: los
//! hace flotar, los arrastra y los frena), el jugador y los NPC (cápsulas que la corren). El agua de los mapas la
//! absorbe (lo que cae a la pileta se junta con ella) y la tira para arriba cuando algo cae (salpicones de verdad).
//! Todo con el equipo de hilos de la física (el trabajo se reparte en tandas).
use crate::fisica::{hilos_por_defecto, Fisica};
use crate::flotar::{Aguas, Boca, LITRO};
use crate::mundo::{self as mu, add, dot, esc, largo, sub, Mundo, CUERPO, V};
use jxfisica::Equipo;
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};

/// el radio de una partícula (m): quedan a 10 cm una de otra
pub const RADIO: f32 = 0.05;
pub const ESPACIO: f32 = 2.0 * RADIO;
/// el alcance del núcleo (dos espacios: unas 26 vecinas en reposo)
const H: f32 = 2.0 * ESPACIO;
const H2: f32 = H * H;
/// cuántas vecinas se miran como mucho
const MAXV: usize = 40;
/// la masa de una partícula (kg): 1000 kg/m³ × 0,1³
pub const MASA: f32 = 1.0;
/// las celdas del mapa para los choques (m) y lo que se agranda cada una (lo que se mueve en un paso)
const CELDA_COL: f32 = 1.0;
const MARGEN_COL: f32 = 0.4;
/// la velocidad más alta (m/s)
const VMAX: f32 = 16.0;
/// la relajación de λ (ε del artículo)
const EPS: f32 = 6.0;
/// la presión artificial (s_corr: k, Δq = 0,2·h, n = 4)
const SCORR_K: f32 = 0.0015;
/// la viscosidad (XSPH) y el roce contra el mapa
const VISC: f32 = 0.12;
const ROCE: f32 = 0.06;
/// cuánto del empuje de cada choque pasa a los objetos y cuánto pueden cambiar de velocidad en un paso
const ACOPLE: f32 = 0.85;
const DV_MAX: f64 = 2.5;

/// una cápsula que corre el agua (el jugador, un NPC): el eje a–b, el radio y la velocidad
#[derive(Clone, Copy, Debug)]
pub struct Capsula { pub a: V, pub b: V, pub r: f32, pub v: V }

/// una canilla: tira agua desde p hacia dir (de largo 1) a `vel` m/s, `por_seg` partículas por segundo, durante
/// `quedan` segundos (infinito: hasta que la saquen)
#[derive(Clone, Debug)]
pub struct Fuente { pub p: V, pub dir: V, pub vel: f32, pub por_seg: f32, pub quedan: f32, acum: f32, vuelta: u32 }

/// las celdas del mapa cerca del agua, con sus triángulos y cuerpos fijos (como la grilla del mundo, con el bit
/// `CUERPO` en los cuerpos), armadas cuando el agua llega (de a una, sin hilos: el mundo no se comparte)
#[derive(Default)]
struct Celdas { mapa: HashMap<(i32, i32, i32), (u32, u32)>, items: Vec<u32>, firma: (usize, usize, usize), ts: Vec<u32>, cs: Vec<u32> }
impl Celdas {
    fn llave(p: V) -> (i32, i32, i32) { ((p[0] / CELDA_COL).floor() as i32, (p[1] / CELDA_COL).floor() as i32, (p[2] / CELDA_COL).floor() as i32) }
    /// la lista de la celda (armándola si falta)
    fn de(&mut self, m: &Mundo, k: (i32, i32, i32)) -> (u32, u32) {
        if let Some(r) = self.mapa.get(&k) { return *r; }
        let lo = [k.0 as f32 * CELDA_COL - MARGEN_COL, k.1 as f32 * CELDA_COL - MARGEN_COL, k.2 as f32 * CELDA_COL - MARGEN_COL];
        let hi = [lo[0] + CELDA_COL + 2.0 * MARGEN_COL, lo[1] + CELDA_COL + 2.0 * MARGEN_COL, lo[2] + CELDA_COL + 2.0 * MARGEN_COL];
        m.cerca(lo[0], lo[2], hi[0], hi[2], &mut self.ts, &mut self.cs);
        let ini = self.items.len() as u32;
        for &t in &self.ts {
            let (a, b, c) = (m.vert(t, 0), m.vert(t, 1), m.vert(t, 2));
            let afuera = (0..3).any(|e| a[e].min(b[e]).min(c[e]) > hi[e] || a[e].max(b[e]).max(c[e]) < lo[e]);
            if !afuera { self.items.push(t); }
        }
        for &b in &self.cs {
            let a = m.cuerpos[b as usize].aabb;
            if (0..3).all(|e| a[e] <= hi[e] && a[e + 3] >= lo[e]) { self.items.push(b | CUERPO); }
        }
        let r = (ini, self.items.len() as u32 - ini); self.mapa.insert(k, r); r
    }
    fn limpiar(&mut self) { self.mapa.clear(); self.items.clear(); }
}

#[derive(Clone, Copy)]
struct Ptr<T>(*mut T);
unsafe impl<T> Send for Ptr<T> {}
unsafe impl<T> Sync for Ptr<T> {}
impl<T> Ptr<T> {
    /// (cada tanda escribe sólo sus índices)
    #[inline] unsafe fn en(&self, i: usize) -> &mut T { &mut *self.0.add(i) }
}
/// reparte 0..n en tandas entre los hilos del equipo (cada uno toma la que sigue)
fn repartir(eq: Option<&Equipo>, n: usize, f: &(dyn Fn(usize, usize) + Sync)) {
    const TANDA: usize = 96;
    match eq {
        Some(e) if e.hilos() > 1 && n > TANDA * 2 => {
            let sig = AtomicUsize::new(0);
            e.correr(&|_| loop { let k = sig.fetch_add(1, Ordering::Relaxed) * TANDA; if k >= n { break; } f(k, (k + TANDA).min(n)); });
        }
        _ => f(0, n),
    }
}
#[inline] fn hash(c: [i32; 3], mask: u32) -> u32 { ((c[0] as u32).wrapping_mul(73_856_093) ^ (c[1] as u32).wrapping_mul(19_349_663) ^ (c[2] as u32).wrapping_mul(83_492_791)) & mask }
#[inline] fn celda(p: V) -> [i32; 3] { [(p[0] / H).floor() as i32, (p[1] / H).floor() as i32, (p[2] / H).floor() as i32] }

pub struct Fluido {
    /// dónde está y a qué velocidad va cada partícula, cuánto hace que existe y cuánto lleva suelta y quieta (se seca)
    pub x: Vec<V>, pub v: Vec<V>, pub edad: Vec<f32>, seco: Vec<f32>,
    /// cuántas vecinas tuvo en el último paso
    pub nn: Vec<u16>,
    /// la normal de la superficie en cada una (hacia afuera del agua, con la del piso o la pared que toca) y cuánto es
    /// superficie (0 adentro del agua, 1 en el borde): para dibujarla lisa
    pub sup: Vec<[f32; 4]>, cn: Vec<V>,
    p: Vec<V>, p2: Vec<V>, lam: Vec<f32>, nb: Vec<u32>, vt: Vec<V>, cel: Vec<[i32; 3]>, col_de: Vec<(u32, u32)>,
    tabla: Vec<u32>, cursor: Vec<u32>, orden: Vec<u32>, llaves: Vec<u32>,
    col: Celdas,
    eq: Option<Equipo>,
    /// cuántas como mucho (según la calidad) y las vueltas de corregir
    pub tope: usize, pub iter: usize,
    pub fuentes: Vec<Fuente>,
    /// las que cayeron al agua del mapa en el último paso (dónde y a qué velocidad): ondas y ruido
    pub absorbidas: Vec<(V, f32)>,
    /// el agua que entró a los huecos en el último paso (el id del cuerpo y cuánto, m³)
    pub llenados: Vec<(u32, f64)>,
    /// cuántas tocaban al jugador (la primera cápsula) en el último paso
    pub toques_jug: usize,
    /// cuánto tardó el último paso (ms) y cuántos objetos tocó
    pub ms: f32, pub objetos: usize,
    /// (para afinar: viscosidad, relajación, presión artificial y tensión)
    pub visc: f32, pub eps: f32, pub scorr: f32, pub tension: f32,
    rho0: f32, w_k: f32, g_k: f32, w_dq: f32,
    caja: [f32; 6],
    sem: u32,
}

impl Default for Fluido { fn default() -> Self { Fluido::nuevo() } }

impl Fluido {
    pub fn nuevo() -> Fluido {
        let w_k = 315.0 / (64.0 * std::f32::consts::PI * H.powi(9));
        let g_k = -45.0 / (std::f32::consts::PI * H.powi(6));
        let mut f = Fluido { x: vec![], v: vec![], edad: vec![], seco: vec![], nn: vec![], sup: vec![], cn: vec![], p: vec![], p2: vec![], lam: vec![], nb: vec![], vt: vec![], cel: vec![], col_de: vec![],
            tabla: vec![], cursor: vec![], orden: vec![], llaves: vec![], col: Celdas::default(), eq: None, tope: 6000, iter: 4, fuentes: vec![], absorbidas: vec![], llenados: vec![], toques_jug: 0,
            ms: 0.0, objetos: 0, visc: VISC, eps: EPS, scorr: SCORR_K, tension: 0.0, rho0: 1.0, w_k, g_k, w_dq: 1.0, caja: [0.0; 6], sem: 0x5eed_a6a };
        // la densidad del reposo: la de una partícula en una grilla cúbica de lado ESPACIO
        let mut r0 = 0.0;
        for i in -2i32..=2 { for j in -2i32..=2 { for k in -2i32..=2 {
            let d = [i as f32 * ESPACIO, j as f32 * ESPACIO, k as f32 * ESPACIO]; r0 += f.w(dot(d, d));
        } } }
        f.rho0 = r0; f.w_dq = f.w((0.2 * H) * (0.2 * H));
        f
    }
    #[inline] fn w(&self, r2: f32) -> f32 { let d = H2 - r2; if d <= 0.0 { 0.0 } else { self.w_k * d * d * d } }
    pub fn cuantas(&self) -> usize { self.x.len() }
    /// la calidad de Ajustes (0 Patata … 4 Ultra, 5 Definitivo): cuántas partículas como mucho
    pub fn calidad(&mut self, nivel: usize) {
        // (medido: ~1,1 ms cada 1000 partículas en 3 hilos de una compu; un celular de gama baja, 2 a 3 veces más)
        const TOPES: [usize; 6] = [800, 1200, 2000, 3000, 4500, 7000];
        self.tope = TOPES[nivel.min(5)]; self.iter = if nivel <= 1 { 3 } else { 4 };
        if self.x.len() > self.tope { let k = self.x.len() - self.tope; self.sacar_viejas(k); }
    }
    /// borra todo (cambio de mapa)
    pub fn limpiar(&mut self) { self.x.clear(); self.v.clear(); self.edad.clear(); self.seco.clear(); self.fuentes.clear(); self.col.limpiar(); self.absorbidas.clear(); }

    fn azar(&mut self) -> f32 {
        self.sem = self.sem.wrapping_add(0x6D2B_79F5); let a = self.sem;
        let mut t = (a ^ (a >> 15)).wrapping_mul(1 | a);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        ((t ^ (t >> 14)) as f64 / 4_294_967_296.0) as f32
    }
    /// saca las k más viejas (para hacer lugar)
    fn sacar_viejas(&mut self, k: usize) {
        if k == 0 { return; }
        let mut ix: Vec<usize> = (0..self.x.len()).collect();
        ix.sort_unstable_by(|a, b| self.edad[*b].partial_cmp(&self.edad[*a]).unwrap_or(std::cmp::Ordering::Equal));
        let mut fuera: Vec<usize> = ix.into_iter().take(k).collect(); fuera.sort_unstable();
        for i in fuera.into_iter().rev() { self.quitar(i); }
    }
    fn quitar(&mut self, i: usize) { self.x.swap_remove(i); self.v.swap_remove(i); self.edad.swap_remove(i); self.seco.swap_remove(i); }
    /// una partícula nueva (si hay lugar; si no, false)
    pub fn agregar(&mut self, p: V, v: V) -> bool {
        if self.x.len() >= self.tope { return false; }
        self.x.push(p); self.v.push(v); self.edad.push(0.0); self.seco.push(0.0); true
    }
    /// un bloque de agua de nx × ny × nz partículas con el centro de la base en `base` (si no hay lugar, saca las más
    /// viejas): cuántas puso
    pub fn bloque(&mut self, base: V, nx: usize, ny: usize, nz: usize, v: V) -> usize {
        let n = nx * ny * nz; let falta = (self.x.len() + n).saturating_sub(self.tope); self.sacar_viejas(falta.min(self.x.len()));
        let mut k = 0;
        for j in 0..ny { for i in 0..nx { for l in 0..nz {
            let j0 = (self.azar() - 0.5) * 0.01; let j1 = (self.azar() - 0.5) * 0.01;
            let p = [base[0] + (i as f32 - (nx as f32 - 1.0) * 0.5) * ESPACIO + j0, base[1] + RADIO + j as f32 * ESPACIO, base[2] + (l as f32 - (nz as f32 - 1.0) * 0.5) * ESPACIO + j1];
            if self.agregar(p, v) { k += 1; }
        } } }
        k
    }
    /// una canilla nueva
    pub fn fuente(&mut self, p: V, dir: V, vel: f32, por_seg: f32, dura: f32) { let l = largo(dir).max(1e-6); self.fuentes.push(Fuente { p, dir: esc(dir, 1.0 / l), vel, por_seg, quedan: dura, acum: 0.0, vuelta: 0 }); }
    /// un salpicón en p (en la superficie del agua) de fuerza k (0 a 1): partículas que saltan en corona
    pub fn salpicar(&mut self, p: V, k: f32) {
        let k = k.clamp(0.05, 1.5); let n = (16.0 + 150.0 * k) as usize;
        let falta = (self.x.len() + n).saturating_sub(self.tope); self.sacar_viejas(falta.min(self.x.len()));
        for _ in 0..n {
            let a = self.azar() * std::f32::consts::TAU; let r = 0.12 + self.azar() * (0.2 + 0.35 * k);
            let (c, s) = (a.cos(), a.sin());
            let sube = (1.2 + self.azar() * 3.8) * (0.35 + k); let sale = (0.4 + self.azar() * 2.0) * (0.4 + k);
            let q = [p[0] + c * r, p[1] + RADIO + 0.02 + self.azar() * 0.08, p[2] + s * r];
            self.agregar(q, [c * sale, sube, s * sale]);
        }
    }
    /// una explosión: empuja lo que está a menos de `radio` (fuerza en m/s en el centro)
    pub fn explosion(&mut self, c: V, radio: f32, fuerza: f32) {
        for i in 0..self.x.len() {
            let d = sub(self.x[i], c); let l = largo(d); if l >= radio { continue; }
            let k = fuerza * (1.0 - l / radio) / l.max(0.05); let up = 0.4 * fuerza * (1.0 - l / radio);
            self.v[i] = add(self.v[i], [d[0] * k, d[1] * k + up, d[2] * k]);
        }
    }

    fn emitir(&mut self, dt: f32) {
        let mut fs = std::mem::take(&mut self.fuentes);
        for f in fs.iter_mut() {
            f.quedan -= dt; f.acum += f.por_seg * dt;
            // (un disco perpendicular al chorro: las del mismo paso salen juntas, giradas en cada vuelta)
            let up = if f.dir[1].abs() > 0.9 { [1.0, 0.0, 0.0] } else { [0.0, 1.0, 0.0] };
            let a = mu::cruz(f.dir, up); let a = esc(a, 1.0 / largo(a).max(1e-6)); let b = mu::cruz(f.dir, a);
            let n = f.acum.floor() as usize; f.acum -= n as f32;
            for k in 0..n {
                f.vuelta = f.vuelta.wrapping_add(1);
                let ang = f.vuelta as f32 * 2.399 + k as f32; let r = if k == 0 { 0.0 } else { ESPACIO * 0.75 };
                let q = add(f.p, add(esc(a, ang.cos() * r), esc(b, ang.sin() * r)));
                let j = (self.azar() - 0.5) * 0.3;
                if !self.agregar(q, add(esc(f.dir, f.vel), esc(a, j))) { self.sacar_viejas(1); self.agregar(q, esc(f.dir, f.vel)); }
            }
        }
        fs.retain(|f| f.quedan > 0.0);
        self.fuentes = fs;
    }

    /// un paso de dt segundos (con la gravedad del mapa: 1 la de la Tierra)
    pub fn paso(&mut self, dt: f32, grav: f32, mundo: &Mundo, fis: &mut Fisica, aguas: Option<&Aguas>, caps: &[Capsula], bocas: &[Boca]) {
        let t0 = std::time::Instant::now();
        self.absorbidas.clear(); self.llenados.clear(); self.toques_jug = 0; self.objetos = 0;
        self.emitir(dt);
        let n = self.x.len(); if n == 0 { self.ms = 0.0; return; }
        if self.eq.is_none() && n >= 400 { let h = hilos_por_defecto(); if h > 1 { self.eq = Some(Equipo::nuevo(h)); } }
        if let Some(e) = self.eq.as_ref() { e.despertar(); }
        // el mapa cambió (otro mapa, una rampa nueva): las celdas se vuelven a armar
        let firma = (mundo.t.len(), mundo.cuerpos.len(), mundo.t.as_ptr() as usize);
        if self.col.firma != firma || self.col.mapa.len() > 60_000 { self.col.limpiar(); self.col.firma = firma; }
        self.p.resize(n, [0.0; 3]); self.p2.resize(n, [0.0; 3]); self.lam.resize(n, 0.0); self.vt.resize(n, [0.0; 3]); self.nn.resize(n, 0);
        self.nb.resize(n * MAXV, 0); self.cel.resize(n, [0; 3]); self.col_de.resize(n, (0, 0)); self.cn.resize(n, [0.0; 3]); self.sup.resize(n, [0.0, 1.0, 0.0, 0.0]);
        // 1) a dónde va cada una con su velocidad y la gravedad
        let g = 9.81 * grav * dt;
        let mut caja = [f32::MAX, f32::MAX, f32::MAX, f32::MIN, f32::MIN, f32::MIN];
        for i in 0..n {
            let mut v = self.v[i]; v[1] -= g;
            let l = largo(v); if l > VMAX { v = esc(v, VMAX / l); }
            self.v[i] = v; let p = add(self.x[i], esc(v, dt)); self.p[i] = p;
            for e in 0..3 { caja[e] = caja[e].min(p[e]); caja[e + 3] = caja[e + 3].max(p[e]); }
        }
        self.caja = caja;
        // 2) la grilla de vecinas (por celdas de h, con un hash y orden por conteo)
        let tam = (2 * n).next_power_of_two().max(1024); let mask = (tam - 1) as u32;
        self.tabla.clear(); self.tabla.resize(tam + 1, 0); self.llaves.resize(n, 0); self.orden.resize(n, 0);
        for i in 0..n { let c = celda(self.p[i]); self.cel[i] = c; let k = hash(c, mask); self.llaves[i] = k; self.tabla[k as usize + 1] += 1; }
        for k in 0..tam { self.tabla[k + 1] += self.tabla[k]; }
        self.cursor.clear(); self.cursor.extend_from_slice(&self.tabla[..tam]);
        for i in 0..n { let k = self.llaves[i] as usize; self.orden[self.cursor[k] as usize] = i as u32; self.cursor[k] += 1; }
        // 3) las celdas del mapa donde está cada una
        let mut ult = (i32::MIN, 0, 0); let mut ult_r = (0, 0);
        for i in 0..n { let k = Celdas::llave(self.p[i]); if k != ult { ult = k; ult_r = self.col.de(mundo, k); } self.col_de[i] = ult_r; }
        let eq_propio = self.eq.take(); let eq = eq_propio.as_ref(); let wk = self.w_k;
        // 4) las vecinas
        {
            let (p, cel, tabla, orden) = (&self.p[..], &self.cel[..], &self.tabla[..], &self.orden[..]);
            let (nb, nn) = (Ptr(self.nb.as_mut_ptr()), Ptr(self.nn.as_mut_ptr()));
            repartir(eq, n, &|i0, i1| {
                for i in i0..i1 {
                    let (pi, c) = (p[i], cel[i]); let mut k = 0usize;
                    'celdas: for dx in -1..=1 { for dy in -1..=1 { for dz in -1..=1 {
                        let cc = [c[0] + dx, c[1] + dy, c[2] + dz]; let h = hash(cc, mask) as usize;
                        for &j in &orden[tabla[h] as usize..tabla[h + 1] as usize] {
                            let j = j as usize; if j == i || cel[j] != cc { continue; }
                            let d = sub(pi, p[j]); if dot(d, d) < H2 { unsafe { *nb.en(i * MAXV + k) = j as u32; } k += 1; if k == MAXV { break 'celdas; } }
                        }
                    } } }
                    unsafe { *nn.en(i) = k as u16; }
                }
            });
        }
        // 5) las vueltas de corregir (densidad, choques)
        let (rho0, g_k, w_dq) = (self.rho0, self.g_k, self.w_dq); let (eps, scorr_k, tension, visc) = (self.eps, self.scorr, self.tension, self.visc);
        let (tris, tn, cuerpos_m, items) = (&mundo.t[..], &mundo.tn[..], &mundo.cuerpos[..], &self.col.items[..]);
        for _ in 0..self.iter {
            {
                let (p, nb, nn) = (&self.p[..], &self.nb[..], &self.nn[..]); let lam = Ptr(self.lam.as_mut_ptr());
                let w = |r2: f32| -> f32 { let d = H2 - r2; if d <= 0.0 { 0.0 } else { wk * d * d * d } };
                repartir(eq, n, &|i0, i1| {
                    for i in i0..i1 {
                        let pi = p[i]; let mut rho = w(0.0); let mut gi = [0.0f32; 3]; let mut s2 = 0.0;
                        for &j in &nb[i * MAXV..i * MAXV + nn[i] as usize] {
                            let d = sub(pi, p[j as usize]); let r2 = dot(d, d); rho += w(r2);
                            let r = r2.sqrt(); if r > 1e-6 { let k = g_k * (H - r) * (H - r) / r; let gr = esc(d, k / rho0); gi = add(gi, gr); s2 += dot(gr, gr); }
                        }
                        // (sólo empuja si está apretada; un poco de tirón en la superficie: tensión)
                        let c = (rho / rho0 - 1.0).max(-tension);
                        unsafe { *lam.en(i) = -c / (dot(gi, gi) + s2 + eps); }
                    }
                });
            }
            {
                let (p, x, nb, nn, lam, col_de) = (&self.p[..], &self.x[..], &self.nb[..], &self.nn[..], &self.lam[..], &self.col_de[..]); let p2 = Ptr(self.p2.as_mut_ptr()); let cn = Ptr(self.cn.as_mut_ptr());
                let w = |r2: f32| -> f32 { let d = H2 - r2; if d <= 0.0 { 0.0 } else { wk * d * d * d } };
                repartir(eq, n, &|i0, i1| {
                    for i in i0..i1 {
                        let pi = p[i]; let li = lam[i]; let mut dp = [0.0f32; 3];
                        for &j in &nb[i * MAXV..i * MAXV + nn[i] as usize] {
                            let j = j as usize; let d = sub(pi, p[j]); let r2 = dot(d, d); let r = r2.sqrt(); if r < 1e-6 { continue; }
                            let q = w(r2) / w_dq; let s = -scorr_k * q * q * q * q;
                            let k = (li + lam[j] + s) * g_k * (H - r) * (H - r) / r / rho0;
                            dp = add(dp, esc(d, k));
                        }
                        let l = largo(dp); if l > 0.5 * ESPACIO { dp = esc(dp, 0.5 * ESPACIO / l); }
                        let mut q = add(pi, dp);
                        let c = chocar_mundo(&mut q, x[i], tris, tn, cuerpos_m, &items[col_de[i].0 as usize..(col_de[i].0 + col_de[i].1) as usize]);
                        unsafe { *p2.en(i) = q; *cn.en(i) = c; }
                    }
                });
            }
            std::mem::swap(&mut self.p, &mut self.p2);
        }
        // 6) los objetos de la física y las cápsulas (empujan y los empuja)
        let _ = (tris, tn, cuerpos_m, items);
        self.con_objetos(fis, dt);
        self.con_capsulas(caps, dt);
        // 7) la velocidad nueva (lo que se movió), suavizada con las vecinas
        {
            let (p, x, nb, nn, cn) = (&self.p[..], &self.x[..], &self.nb[..], &self.nn[..], &self.cn[..]); let vt = Ptr(self.vt.as_mut_ptr()); let sup = Ptr(self.sup.as_mut_ptr());
            let w = |r2: f32| -> f32 { let d = H2 - r2; if d <= 0.0 { 0.0 } else { wk * d * d * d } };
            let inv = 1.0 / dt;
            repartir(eq, n, &|i0, i1| {
                for i in i0..i1 {
                    let vi = esc(sub(p[i], x[i]), inv); let mut s = [0.0f32; 3]; let mut g = [0.0f32; 3];
                    for &j in &nb[i * MAXV..i * MAXV + nn[i] as usize] {
                        let j = j as usize; let d = sub(p[i], p[j]); let vj = esc(sub(p[j], x[j]), inv);
                        let r2 = dot(d, d); s = add(s, esc(sub(vj, vi), w(r2) / rho0));
                        // (la normal de la superficie: hacia donde faltan vecinas)
                        let r = r2.sqrt(); if r > 1e-6 { g = add(g, esc(d, (H - r) * (H - r) / r)); }
                    }
                    unsafe { *vt.en(i) = add(vi, esc(s, visc)); }
                    let c = cn[i]; let lc = largo(c); let gg = esc(g, 1.0 / 0.04); let t = add(gg, if lc > 1e-6 { esc(c, 1.0 / lc) } else { [0.0; 3] });
                    let lt = largo(t); let peso = (largo(gg) + lc.min(1.0)).min(1.0);
                    unsafe { *sup.en(i) = if lt > 1e-6 { [t[0] / lt, t[1] / lt, t[2] / lt, peso] } else { [0.0, 1.0, 0.0, 0.0] }; }
                }
            });
        }
        self.eq = eq_propio;
        std::mem::swap(&mut self.x, &mut self.p); std::mem::swap(&mut self.v, &mut self.vt);
        // 8) lo que cae al agua del mapa se junta con ella; lo que quedó suelto y quieto se seca; lo que se cayó del mapa
        let piso = mundo.lo[1] - 30.0; let t_ola = aguas.map_or(0.0, |a| a.t);
        let mut libre: Vec<f32> = bocas.iter().map(|b| b.libre).collect();
        let mut i = 0;
        while i < self.x.len() {
            let (p, v) = (self.x[i], self.v[i]); let rap = largo(v);
            self.edad[i] += dt;
            let suelta = self.nn[i] < 3 && rap < 0.5; self.seco[i] = if suelta { self.seco[i] + dt } else { 0.0 };
            let en_agua = aguas.map_or(false, |a| a.vols.iter().any(|vo| vo.pisa(p[0] as f64, p[2] as f64) && (p[1] as f64) < vo.y1 + vo.ola_en(t_ola, p[0] as f64, p[2] as f64) - RADIO as f64 * 0.5 && (p[1] as f64) > vo.y0 - 1.0));
            if en_agua { self.absorbidas.push((p, rap)); }
            // (la que cae en la boca de un balde, una botella, una bañera: entra)
            let mut entra = false;
            for (k, b) in bocas.iter().enumerate() {
                if libre[k] < 0.5 * LITRO as f32 { continue; }
                let w = sub(p, b.p); let a = dot(w, b.d); if a > 0.14 || a < -b.hondo { continue; }
                let rad = largo(sub(w, esc(b.d, a))); if rad > b.r + RADIO * 0.6 { continue; }
                libre[k] -= LITRO as f32; self.llenados.push((b.id, LITRO)); entra = true; break;
            }
            if entra || en_agua || p[1] < piso || self.seco[i] > 9.0 { self.quitar(i); self.nn.swap_remove(i); self.sup.swap_remove(i); continue; }
            i += 1;
        }
        self.ms = t0.elapsed().as_secs_f32() * 1000.0;
    }

    fn con_objetos(&mut self, fis: &mut Fisica, dt: f32) {
        let c = self.caja; let m = RADIO as f64 + 0.05;
        let ids = fis.cerca([c[0] as f64 - m, c[1] as f64 - m, c[2] as f64 - m, c[3] as f64 + m, c[4] as f64 + m, c[5] as f64 + m]);
        let mut golpes: Vec<(V, V)> = vec![];
        for id in ids {
            let Some(cu) = fis.cuerpo(id) else { continue };
            if cu.sin_fisica { continue; }
            let a = cu.aabb(); let (pos, vel, ang, din, inv_m) = (cu.pos, cu.vel, cu.ang, cu.inv_masa > 0.0 && !cu.congelado, cu.inv_masa);
            let partes = fis.partes(id); golpes.clear();
            let r = RADIO as f64;
            for i in 0..self.p.len() {
                let q = self.p[i]; let q64 = [q[0] as f64, q[1] as f64, q[2] as f64];
                if q64[0] + r < a[0] || q64[0] - r > a[3] || q64[1] + r < a[1] || q64[1] - r > a[4] || q64[2] + r < a[2] || q64[2] - r > a[5] { continue; }
                for k in 0..partes {
                    let Some((nr, d)) = fis.empuje(id, k, [self.p[i][0] as f64, self.p[i][1] as f64, self.p[i][2] as f64], r) else { continue };
                    let nr = [nr[0] as f32, nr[1] as f32, nr[2] as f32]; let antes = self.p[i];
                    let mut np = add(antes, esc(nr, (d as f32).min(0.25)));
                    // (la velocidad del objeto en ese punto: lo que lo empuja, sale con ella)
                    let rr = [np[0] as f64 - pos[0], np[1] as f64 - pos[1], np[2] as f64 - pos[2]];
                    let vb = [vel[0] + ang[1] * rr[2] - ang[2] * rr[1], vel[1] + ang[2] * rr[0] - ang[0] * rr[2], vel[2] + ang[0] * rr[1] - ang[1] * rr[0]];
                    let vb = [vb[0] as f32, vb[1] as f32, vb[2] as f32];
                    let vp = esc(sub(np, self.x[i]), 1.0 / dt); let rel = sub(vp, vb); let vr = dot(rel, nr);
                    if vr < 0.0 { np = add(np, esc(nr, -vr * dt)); }
                    // (roce: la de al lado se arrastra un poco con el objeto)
                    let tg = sub(rel, esc(nr, vr)); np = sub(np, esc(tg, dt * 0.25));
                    self.p[i] = np;
                    if din { golpes.push((np, esc(sub(np, antes), -MASA * ACOPLE / dt))); }
                }
            }
            if golpes.is_empty() { continue; }
            self.objetos += 1;
            if !din { continue; }
            let tot: V = golpes.iter().fold([0.0; 3], |s, g| add(s, g.1));
            let dv = largo(tot) as f64 * inv_m; let k = if dv > DV_MAX { DV_MAX / dv } else { 1.0 };
            let Some(cm) = fis.cuerpo_mut(id) else { continue };
            if cm.duerme && dv > 0.15 { cm.despertar(); }
            for (q, j) in &golpes {
                let rr = [q[0] as f64 - pos[0], q[1] as f64 - pos[1], q[2] as f64 - pos[2]];
                cm.aplicar_vel([j[0] as f64 * k, j[1] as f64 * k, j[2] as f64 * k], rr, 1.0);
            }
        }
    }

    fn con_capsulas(&mut self, caps: &[Capsula], dt: f32) {
        for (ci, c) in caps.iter().enumerate() {
            let lo = [c.a[0].min(c.b[0]) - c.r - RADIO, c.a[1].min(c.b[1]) - c.r - RADIO, c.a[2].min(c.b[2]) - c.r - RADIO];
            let hi = [c.a[0].max(c.b[0]) + c.r + RADIO, c.a[1].max(c.b[1]) + c.r + RADIO, c.a[2].max(c.b[2]) + c.r + RADIO];
            if hi[0] < self.caja[0] || lo[0] > self.caja[3] || hi[1] < self.caja[1] || lo[1] > self.caja[4] || hi[2] < self.caja[2] || lo[2] > self.caja[5] { continue; }
            let ab = sub(c.b, c.a); let ab2 = dot(ab, ab).max(1e-9); let rt = c.r + RADIO;
            for i in 0..self.p.len() {
                let q = self.p[i];
                if q[0] < lo[0] || q[0] > hi[0] || q[1] < lo[1] || q[1] > hi[1] || q[2] < lo[2] || q[2] > hi[2] { continue; }
                let t = (dot(sub(q, c.a), ab) / ab2).clamp(0.0, 1.0); let s = add(c.a, esc(ab, t));
                let d = sub(q, s); let l = largo(d); if l >= rt { continue; }
                let nr = if l > 1e-5 { esc(d, 1.0 / l) } else { [1.0, 0.0, 0.0] };
                let mut np = add(s, esc(nr, rt));
                let vp = esc(sub(np, self.x[i]), 1.0 / dt); let vr = dot(sub(vp, c.v), nr);
                if vr < 0.0 { np = add(np, esc(nr, -vr * dt)); }
                self.p[i] = np;
                if ci == 0 { self.toques_jug += 1; }
            }
        }
    }

    /// lo que se dibuja (EF_FLUIDO, ver jxmotor::escena): la cabecera (radio, cuántas, la derecha y el arriba de la cámara,
    /// los colores del agua y del cielo y el sol) y por partícula [x, y, z, espuma] (de 0 a 1: blanca si va rápido o está
    /// sola) y su superficie [nx, ny, nz, cuánto es borde], las que están a menos de `lejos` de la cámara, de lejos a cerca
    #[allow(clippy::too_many_arguments)]
    pub fn bloque_dibujo(&self, cam: V, der: V, arr: V, lejos: f32, agua: [f32; 4], cielo: [f32; 4], sol: [f32; 4]) -> Vec<f32> {
        let l2 = lejos * lejos;
        let mut ix: Vec<(f32, u32)> = Vec::with_capacity(self.x.len());
        for (i, p) in self.x.iter().enumerate() { let d = sub(*p, cam); let d2 = dot(d, d); if d2 <= l2 { ix.push((d2, i as u32)); } }
        ix.sort_unstable_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        let mut o = Vec::with_capacity(24 + ix.len() * 8);
        o.extend_from_slice(&[RADIO * 1.9, ix.len() as f32, 0.0, 0.0, der[0], der[1], der[2], 0.0, arr[0], arr[1], arr[2], 0.0]);
        o.extend_from_slice(&agua); o.extend_from_slice(&cielo); o.extend_from_slice(&sol);
        for &(_, i) in &ix {
            let i = i as usize; let p = self.x[i];
            let rap = largo(self.v[i]); let sola = 1.0 - (self.nn.get(i).copied().unwrap_or(10) as f32 / 10.0).min(1.0);
            let espuma = ((rap - 4.0) / 8.0).clamp(0.0, 1.0).max(sola * 0.35);
            let s = self.sup.get(i).copied().unwrap_or([0.0, 1.0, 0.0, 0.0]);
            o.extend_from_slice(&[p[0], p[1], p[2], espuma, s[0], s[1], s[2], s[3]]);
        }
        o
    }
}

/// saca la partícula (que estaba en x y quiere ir a q) de los triángulos y los cuerpos fijos de su celda: del lado del
/// que venía; si cruzó un triángulo, la deja delante
fn chocar_mundo(q: &mut V, x: V, tris: &[f32], tn: &[f32], cuerpos: &[mu::Cuerpo], items: &[u32]) -> V {
    let r = RADIO; let mut sn = [0.0f32; 3];
    for &it in items {
        if it & CUERPO != 0 {
            if let Some((n, d)) = mu::fuera_de(&cuerpos[(it & !CUERPO) as usize], *q, r) { let antes = *q; *q = add(*q, esc(n, d)); rozar(q, x, antes, n); sn = add(sn, n); }
            continue;
        }
        let t = it as usize; let o = t * 9;
        let a = [tris[o], tris[o + 1], tris[o + 2]];
        let n0 = [tn[t * 3], tn[t * 3 + 1], tn[t * 3 + 2]];
        let sx = dot(sub(x, a), n0); let n = if sx >= 0.0 { n0 } else { esc(n0, -1.0) };
        let dp = dot(sub(*q, a), n); if dp >= r { continue; }
        let dx = sx.abs();
        let (b, c) = ([tris[o + 3], tris[o + 4], tris[o + 5]], [tris[o + 6], tris[o + 7], tris[o + 8]]);
        if dp < 0.0 {
            // (cruzó el plano: ¿por adentro del triángulo?)
            if dx > 2.0 * r && dx - dp > 1e-6 {
                let k = dx / (dx - dp); let cr = add(x, esc(sub(*q, x), k));
                if dentro_tri(a, b, c, n0, cr) { let antes = *q; *q = add(*q, esc(n, r - dp)); rozar(q, x, antes, n); sn = add(sn, n); continue; }
            }
            if dp < -r { continue; }
        }
        let cp = mu::punto_tri(a, b, c, *q); let d = sub(*q, cp); let l = largo(d);
        if l >= r { continue; }
        let nn = if l > 1e-6 && dp >= 0.0 { esc(d, 1.0 / l) } else { n };
        let antes = *q; *q = add(cp, esc(nn, r)); rozar(q, x, antes, nn); sn = add(sn, nn);
    }
    sn
}
#[inline] fn dentro_tri(a: V, b: V, c: V, n: V, p: V) -> bool {
    let e = |u: V, w: V| dot(mu::cruz(sub(w, u), sub(p, u)), n);
    let (s0, s1, s2) = (e(a, b), e(b, c), e(c, a));
    (s0 >= 0.0 && s1 >= 0.0 && s2 >= 0.0) || (s0 <= 0.0 && s1 <= 0.0 && s2 <= 0.0)
}
/// el roce: lo que se movía de costado contra la superficie se frena un poco
#[inline] fn rozar(q: &mut V, x: V, _antes: V, n: V) {
    let m = sub(*q, x); let tg = sub(m, esc(n, dot(m, n)));
    *q = sub(*q, esc(tg, ROCE));
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn reposo_cerca_de_uno() {
        let f = Fluido::nuevo();
        // (la densidad de la grilla de reposo da 1 por definición; que el núcleo esté bien armado: ~1000 en estas unidades)
        assert!(f.rho0 > 500.0 && f.rho0 < 2000.0, "rho0 {}", f.rho0);
    }
}

#[cfg(test)]
mod medir {
    use super::*;
    use crate::fisica::{forma_caja, Cuerpo, OpCuerpo};
    use std::sync::Arc;
    /// una pileta de lado `l` (m) y alto `a`: piso y cuatro paredes
    fn pileta(l: f32, a: f32) -> Mundo {
        let mut t = vec![];
        let mut quad = |p: [V; 4]| { for k in [0, 1, 2, 0, 2, 3] { t.extend_from_slice(&p[k]); } };
        let h = l / 2.0;
        quad([[-h, 0.0, -h], [h, 0.0, -h], [h, 0.0, h], [-h, 0.0, h]]);
        quad([[-h, 0.0, -h], [-h, a, -h], [h, a, -h], [h, 0.0, -h]]);
        quad([[-h, 0.0, h], [h, 0.0, h], [h, a, h], [-h, a, h]]);
        quad([[-h, 0.0, -h], [-h, 0.0, h], [-h, a, h], [-h, a, -h]]);
        quad([[h, 0.0, -h], [h, a, -h], [h, a, h], [h, 0.0, h]]);
        Mundo::nuevo(t, vec![], 1.0)
    }
    fn afinar(f: &mut Fluido) {
        let e = |k: &str, d: f32| std::env::var(k).ok().and_then(|s| s.parse().ok()).unwrap_or(d);
        f.visc = e("JXF_VISC", f.visc); f.eps = e("JXF_EPS", f.eps); f.scorr = e("JXF_SCORR", f.scorr); f.tension = e("JXF_TENSION", f.tension); f.iter = e("JXF_ITER", f.iter as f32) as usize;
    }
    fn resumen(f: &Fluido, l: f32) -> (usize, f32, f32) {
        let h = l / 2.0 + 0.01;
        let fuera = f.x.iter().filter(|p| p[0].abs() > h || p[2].abs() > h || p[1] < -0.01).count();
        let mut ys: Vec<f32> = f.x.iter().map(|p| p[1]).collect(); ys.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let alto = ys[(ys.len() as f32 * 0.95) as usize];
        let vm = f.v.iter().map(|v| largo(*v)).sum::<f32>() / f.v.len() as f32;
        (fuera, alto, vm)
    }
    #[test]
    #[ignore]
    fn represa() {
        let m = pileta(2.0, 1.5); let mut fis = Fisica::nueva(); let mut f = Fluido::nuevo(); f.tope = 20000; afinar(&mut f);
        // (un bloque de 12 × 12 × 12 en un rincón: 1,728 m³ → en 2 × 2 m queda a 0,43 m)
        let n = f.bloque([-0.35, 0.0, -0.35], 12, 12, 12, [0.0; 3]);
        let mut ms = vec![];
        for s in 0..480 { f.paso(1.0 / 60.0, 1.0, &m, &mut fis, None, &[], &[]); ms.push(f.ms); if s % 60 == 59 { let (fu, al, vm) = resumen(&f, 2.0); eprintln!("t {:.0}s fuera {fu} alto95 {al:.3} vel media {vm:.3} n {}", (s + 1) as f32 / 60.0, f.cuantas()); } }
        let (fu, al, vm) = resumen(&f, 2.0);
        ms.sort_by(|a, b| a.partial_cmp(b).unwrap());
        eprintln!("partículas {n} → {} | fuera {fu} | alto95 {al:.3} (esperado ~0,43) | vel media {vm:.3} | ms mediana {:.2} p95 {:.2}", f.cuantas(), ms[ms.len() / 2], ms[ms.len() * 95 / 100]);
        assert_eq!(fu, 0); assert!(f.cuantas() == n);
    }
    #[test]
    #[ignore]
    fn flota() {
        let m = pileta(2.0, 1.5); let mut fis = Fisica::nueva(); let mut f = Fluido::nuevo(); f.tope = 20000;
        f.bloque([0.0, 0.0, 0.0], 19, 6, 19, [0.0; 3]);
        for _ in 0..180 { f.paso(1.0 / 60.0, 1.0, &m, &mut fis, None, &[], &[]); fis.paso(&m, 1.0 / 60.0); }
        let mut ys: Vec<f32> = f.x.iter().map(|p| p[1]).collect(); ys.sort_by(|a, b| a.partial_cmp(b).unwrap()); let sup = ys[(ys.len() as f32 * 0.97) as usize] + RADIO;
        let mut res = vec![];
        for (nombre, dens) in [("madera", 500.0), ("hielo", 900.0), ("fierro", 7800.0)] {
            let mut fis = Fisica::nueva(); let mut g = Fluido::nuevo(); g.tope = 20000; g.x = f.x.clone(); g.v = f.v.clone(); g.edad = f.edad.clone(); g.seco = f.seco.clone();
            let lado = 0.4; let masa = dens * lado * lado * lado;
            let mut c = Cuerpo::nuevo(Arc::new(forma_caja(0.2, 0.2, 0.2)), masa as f64, OpCuerpo::default()); c.pos = [0.0, sup as f64 + 0.5, 0.0]; c.actualizar();
            let id = fis.agregar(c);
            let mut ys_c = vec![];
            for s in 0..360 { g.paso(1.0 / 60.0, 1.0, &m, &mut fis, None, &[], &[]); fis.paso(&m, 1.0 / 60.0); if s >= 240 { ys_c.push(fis.cuerpo(id).unwrap().pos[1] as f32); } }
            let y = ys_c.iter().sum::<f32>() / ys_c.len() as f32;
            let hundido = ((sup - (y - 0.2)) / 0.4).clamp(0.0, 1.0);
            eprintln!("{nombre} ({dens} kg/m³): centro {y:.3} superficie {sup:.3} → hundido {:.0} % (lo justo: {:.0} %) | partículas {} ms {:.2}", hundido * 100.0, (dens / 1000.0f32).min(1.0) * 100.0, g.cuantas(), g.ms);
            res.push(hundido);
        }
        assert!(res[0] < 0.85 && res[2] > 0.95);
    }
}

#[cfg(test)]
mod carga {
    use super::*;
    /// cuánto tarda un paso con muchas partículas (una pileta de 4 × 4 m con un bloque que cae)
    #[test]
    #[ignore]
    fn carga() {
        let h = 2.0f32; let mut t = vec![];
        let mut quad = |p: [V; 4]| { for k in [0, 1, 2, 0, 2, 3] { t.extend_from_slice(&p[k]); } };
        quad([[-h, 0.0, -h], [h, 0.0, -h], [h, 0.0, h], [-h, 0.0, h]]);
        quad([[-h, 0.0, -h], [-h, 2.0, -h], [h, 2.0, -h], [h, 0.0, -h]]); quad([[-h, 0.0, h], [h, 0.0, h], [h, 2.0, h], [-h, 2.0, h]]);
        quad([[-h, 0.0, -h], [-h, 0.0, h], [-h, 2.0, h], [-h, 2.0, -h]]); quad([[h, 0.0, -h], [h, 2.0, -h], [h, 2.0, h], [h, 0.0, h]]);
        let m = Mundo::nuevo(t, vec![], 1.0); let mut fis = Fisica::nueva();
        for n in [2000usize, 3500, 5000, 7000, 10000] {
            let mut f = Fluido::nuevo(); f.tope = n;
            let lado = ((n as f32 / 12.0).sqrt()) as usize; f.bloque([0.0, 0.0, 0.0], lado, 12, lado, [0.0; 3]);
            let mut ms = vec![]; for _ in 0..240 { f.paso(1.0 / 60.0, 1.0, &m, &mut fis, None, &[], &[]); ms.push(f.ms); }
            ms.sort_by(|a, b| a.partial_cmp(b).unwrap());
            eprintln!("{} partículas: mediana {:.2} ms, p95 {:.2} ms (hilos: {})", f.cuantas(), ms[ms.len() / 2], ms[ms.len() * 95 / 100], crate::fisica::hilos_por_defecto());
        }
    }
}
