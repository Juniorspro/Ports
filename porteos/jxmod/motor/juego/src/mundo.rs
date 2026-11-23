//! El mundo fijo para los choques, como MUNDO de mundo.js: los triángulos de las mallas de choque del mapa y sus cuerpos
//! fijos (cajas orientadas, esferas y cápsulas), en una grilla sobre el piso (x, z) de celdas de 6 m. Lo usan el jugador
//! (sacar sus esferas de lo que tocan) y los rayos (el piso abajo de los pies, la cámara en tercera persona).
use std::cell::RefCell;
use std::collections::HashMap;

pub type V = [f32; 3];
#[inline] pub fn sub(a: V, b: V) -> V { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
#[inline] pub fn add(a: V, b: V) -> V { [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
#[inline] pub fn esc(a: V, k: f32) -> V { [a[0] * k, a[1] * k, a[2] * k] }
#[inline] pub fn dot(a: V, b: V) -> f32 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
#[inline] pub fn cruz(a: V, b: V) -> V { [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
#[inline] pub fn largo(a: V) -> f32 { dot(a, a).sqrt() }

/// un cuerpo fijo del mapa (los BoxCollider, SphereCollider y CapsuleCollider)
#[derive(Clone, Debug)]
pub enum Forma {
    /// centro, los tres ejes (de largo 1) y los medios lados
    Caja { c: V, e: [V; 3], h: V },
    Esfera { c: V, r: f32 },
    /// el segmento del eje y el radio
    Capsula { a: V, b: V, r: f32 },
}
#[derive(Clone, Debug)]
pub struct Cuerpo { pub f: Forma, pub aabb: [f32; 6] }

/// un golpe de un rayo: a qué distancia y con qué normal
#[derive(Clone, Copy, Debug)]
pub struct Golpe { pub t: f32, pub n: V }

pub struct Mundo {
    /// los triángulos (9 floats cada uno) y sus normales (3)
    pub t: Vec<f32>, pub tn: Vec<f32>,
    pub cuerpos: Vec<Cuerpo>,
    pub celda: f32,
    /// la grilla: en cada celda, los triángulos (número) y los cuerpos (número con el bit alto prendido)
    grilla: HashMap<(i32, i32), Vec<u32>>,
    pub lo: V, pub hi: V,
    /// la gravedad del mapa (1: la de la Tierra)
    pub gravedad: f32,
    marcas: RefCell<(Vec<u32>, Vec<u32>, u32)>,
}
const CUERPO: u32 = 1 << 31;

impl Mundo {
    pub fn nuevo(tris: Vec<f32>, cuerpos: Vec<Cuerpo>, gravedad: f32) -> Mundo {
        let nt = tris.len() / 9; let mut tn = vec![0f32; nt * 3];
        let mut m = Mundo { t: vec![], tn: vec![], cuerpos: vec![], celda: 6.0, grilla: HashMap::new(), lo: [1e9; 3], hi: [-1e9; 3], gravedad, marcas: RefCell::new((vec![], vec![], 0)) };
        for t in 0..nt {
            let o = t * 9; let p = |k: usize| [tris[o + k * 3], tris[o + k * 3 + 1], tris[o + k * 3 + 2]];
            let n = cruz(sub(p(1), p(0)), sub(p(2), p(0))); let l = largo(n).max(1e-12);
            tn[t * 3] = n[0] / l; tn[t * 3 + 1] = n[1] / l; tn[t * 3 + 2] = n[2] / l;
            let (x0, x1) = (p(0)[0].min(p(1)[0]).min(p(2)[0]), p(0)[0].max(p(1)[0]).max(p(2)[0]));
            let (z0, z1) = (p(0)[2].min(p(1)[2]).min(p(2)[2]), p(0)[2].max(p(1)[2]).max(p(2)[2]));
            m.agregar(x0, z0, x1, z1, t as u32);
            for k in 0..3 { let q = p(k); for e in 0..3 { m.lo[e] = m.lo[e].min(q[e]); m.hi[e] = m.hi[e].max(q[e]); } }
        }
        for (i, c) in cuerpos.iter().enumerate() {
            let a = c.aabb; m.agregar(a[0], a[2], a[3], a[5], i as u32 | CUERPO);
            for e in 0..3 { m.lo[e] = m.lo[e].min(a[e]); m.hi[e] = m.hi[e].max(a[e + 3]); }
        }
        m.marcas = RefCell::new((vec![0; nt], vec![0; cuerpos.len()], 0));
        m.t = tris; m.tn = tn; m.cuerpos = cuerpos;
        m
    }
    fn agregar(&mut self, x0: f32, z0: f32, x1: f32, z1: f32, k: u32) {
        let c = self.celda;
        for i in (x0 / c).floor() as i32..=(x1 / c).floor() as i32 { for j in (z0 / c).floor() as i32..=(z1 / c).floor() as i32 { self.grilla.entry((i, j)).or_default().push(k); } }
    }
    pub fn n_tris(&self) -> usize { self.t.len() / 9 }

    /// los triángulos y los cuerpos de las celdas que toca el rectángulo (x0, z0)–(x1, z1), sin repetir
    pub fn cerca(&self, x0: f32, z0: f32, x1: f32, z1: f32, tris: &mut Vec<u32>, cuerpos: &mut Vec<u32>) {
        tris.clear(); cuerpos.clear();
        let c = self.celda; let mut mk = self.marcas.borrow_mut();
        mk.2 = mk.2.wrapping_add(1); if mk.2 == 0 { mk.0.iter_mut().for_each(|x| *x = 0); mk.1.iter_mut().for_each(|x| *x = 0); mk.2 = 1; }
        let g = mk.2;
        let (ax, az, bx, bz) = ((x0 / c).floor() as i32, (z0 / c).floor() as i32, (x1 / c).floor() as i32, (z1 / c).floor() as i32);
        // (un rectángulo enorme —un rayo largo— no recorre miles de celdas vacías de más)
        if (bx - ax + 1) as i64 * (bz - az + 1) as i64 > 4096 { return; }
        for i in ax..=bx { for j in az..=bz {
            let Some(l) = self.grilla.get(&(i, j)) else { continue };
            for &k in l {
                if k & CUERPO != 0 { let b = (k & !CUERPO) as usize; if mk.1[b] != g { mk.1[b] = g; cuerpos.push(b as u32); } }
                else if mk.0[k as usize] != g { mk.0[k as usize] = g; tris.push(k); }
            }
        } }
    }

    #[inline] pub fn vert(&self, t: u32, k: usize) -> V { let o = t as usize * 9 + k * 3; [self.t[o], self.t[o + 1], self.t[o + 2]] }
    #[inline] pub fn normal(&self, t: u32) -> V { let o = t as usize * 3; [self.tn[o], self.tn[o + 1], self.tn[o + 2]] }

    /// el punto del triángulo más cercano a p (Ericson, «Real-Time Collision Detection»: como triCercano)
    pub fn tri_cercano(&self, t: u32, p: V) -> V {
        let (a, b, c) = (self.vert(t, 0), self.vert(t, 1), self.vert(t, 2));
        let (ab, ac, ap) = (sub(b, a), sub(c, a), sub(p, a));
        let (d1, d2) = (dot(ab, ap), dot(ac, ap)); if d1 <= 0.0 && d2 <= 0.0 { return a; }
        let bp = sub(p, b); let (d3, d4) = (dot(ab, bp), dot(ac, bp)); if d3 >= 0.0 && d4 <= d3 { return b; }
        let vc = d1 * d4 - d3 * d2; if vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0 { let v = d1 / (d1 - d3); return add(a, esc(ab, v)); }
        let cp = sub(p, c); let (d5, d6) = (dot(ab, cp), dot(ac, cp)); if d6 >= 0.0 && d5 <= d6 { return c; }
        let vb = d5 * d2 - d1 * d6; if vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0 { let w = d2 / (d2 - d6); return add(a, esc(ac, w)); }
        let va = d3 * d6 - d5 * d4; if va <= 0.0 && (d4 - d3) >= 0.0 && (d5 - d6) >= 0.0 { let w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return add(b, esc(sub(c, b), w)); }
        let den = 1.0 / (va + vb + vc); let (v, w) = (vb * den, vc * den);
        add(a, add(esc(ab, v), esc(ac, w)))
    }

    /// cuánto hay que correr una esfera (centro c, radio r) para sacarla de un cuerpo fijo: la normal y lo hundido
    pub fn fuera_de_cuerpo(&self, b: usize, c: V, r: f32) -> Option<(V, f32)> {
        match &self.cuerpos[b].f {
            Forma::Caja { c: cc, e, h } => {
                // (en las coordenadas de la caja: el punto más cercano es el centro recortado a la caja; si el centro está adentro, se
                // sale por la cara más cercana —como hullClosest de fisica.js—)
                let d = sub(c, *cc); let l = [dot(d, e[0]), dot(d, e[1]), dot(d, e[2])];
                let dentro = (0..3).all(|k| l[k].abs() <= h[k]);
                if dentro {
                    let mut mejor = 0; let mut s = f32::MAX;
                    for k in 0..3 { let x = h[k] - l[k].abs(); if x < s { s = x; mejor = k; } }
                    let n = esc(e[mejor], if l[mejor] < 0.0 { -1.0 } else { 1.0 });
                    return Some((n, s + r));
                }
                let q = [l[0].clamp(-h[0], h[0]), l[1].clamp(-h[1], h[1]), l[2].clamp(-h[2], h[2])];
                let p = add(*cc, add(esc(e[0], q[0]), add(esc(e[1], q[1]), esc(e[2], q[2]))));
                let dd = sub(c, p); let ll = largo(dd); if ll >= r || ll < 1e-6 { return None; }
                Some((esc(dd, 1.0 / ll), r - ll))
            }
            Forma::Esfera { c: cc, r: rr } => { let dd = sub(c, *cc); let ll = largo(dd); let rt = rr + r; if ll >= rt || ll < 1e-6 { return None; } Some((esc(dd, 1.0 / ll), rt - ll)) }
            Forma::Capsula { a, b, r: rr } => {
                let ab = sub(*b, *a); let t = (dot(sub(c, *a), ab) / dot(ab, ab).max(1e-9)).clamp(0.0, 1.0); let p = add(*a, esc(ab, t));
                let dd = sub(c, p); let ll = largo(dd); let rt = rr + r; if ll >= rt || ll < 1e-6 { return None; } Some((esc(dd, 1.0 / ll), rt - ll))
            }
        }
    }

    /// un rayo desde o en la dirección d (de largo 1) hasta `max`: lo primero que toca del mapa (mundoRayo)
    pub fn rayo(&self, o: V, d: V, max: f32) -> Option<Golpe> {
        let f = add(o, esc(d, max));
        let (mut ts, mut cs) = (vec![], vec![]);
        self.cerca(o[0].min(f[0]), o[2].min(f[2]), o[0].max(f[0]), o[2].max(f[2]), &mut ts, &mut cs);
        let mut mejor: Option<Golpe> = None;
        for &t in &ts {
            // (Möller–Trumbore, de los dos lados)
            let (a, b, c) = (self.vert(t, 0), self.vert(t, 1), self.vert(t, 2));
            let (e1, e2) = (sub(b, a), sub(c, a)); let p = cruz(d, e2); let det = dot(e1, p);
            if det.abs() < 1e-9 { continue; }
            let inv = 1.0 / det; let s = sub(o, a); let u = dot(s, p) * inv; if !(0.0..=1.0).contains(&u) { continue; }
            let q = cruz(s, e1); let v = dot(d, q) * inv; if v < 0.0 || u + v > 1.0 { continue; }
            let tt = dot(e2, q) * inv;
            if tt >= 0.0 && tt <= max && mejor.map(|m| tt < m.t).unwrap_or(true) {
                let mut n = self.normal(t); if dot(n, d) > 0.0 { n = esc(n, -1.0); }
                mejor = Some(Golpe { t: tt, n });
            }
        }
        for &b in &cs {
            if let Some(g) = self.rayo_cuerpo(b as usize, o, d, max) { if mejor.map(|m| g.t < m.t).unwrap_or(true) { mejor = Some(g); } }
        }
        mejor
    }
    fn rayo_cuerpo(&self, b: usize, o: V, d: V, max: f32) -> Option<Golpe> {
        match &self.cuerpos[b].f {
            Forma::Caja { c, e, h } => {
                // (las placas de la caja en sus ejes)
                let oc = sub(o, *c); let (mut t0, mut t1) = (0.0f32, max); let mut n = [0.0; 3];
                for k in 0..3 {
                    let (oo, dd) = (dot(oc, e[k]), dot(d, e[k]));
                    if dd.abs() < 1e-9 { if oo.abs() > h[k] { return None; } continue; }
                    let (mut a, mut bb) = ((-h[k] - oo) / dd, (h[k] - oo) / dd);
                    if a > bb { std::mem::swap(&mut a, &mut bb); }
                    // (se entra por la cara que mira contra el rayo)
                    if a > t0 { t0 = a; n = esc(e[k], if dd > 0.0 { -1.0 } else { 1.0 }); }
                    if bb < t1 { t1 = bb; }
                    if t0 > t1 { return None; }
                }
                if t0 <= 0.0 { return None; }
                Some(Golpe { t: t0, n })
            }
            Forma::Esfera { c, r } => rayo_esfera(o, d, *c, *r, max),
            Forma::Capsula { a, b, r } => {
                // (aproximada: las esferas a lo largo del eje, como capSpheres)
                let mut m: Option<Golpe> = None;
                for k in 0..=4 { let p = add(*a, esc(sub(*b, *a), k as f32 / 4.0)); if let Some(g) = rayo_esfera(o, d, p, *r, max) { if m.map(|x| g.t < x.t).unwrap_or(true) { m = Some(g); } } }
                m
            }
        }
    }
}

fn rayo_esfera(o: V, d: V, c: V, r: f32, max: f32) -> Option<Golpe> {
    let oc = sub(o, c); let b = dot(oc, d); let cc = dot(oc, oc) - r * r; let disc = b * b - cc;
    if disc < 0.0 { return None; }
    let t = -b - disc.sqrt(); if t < 0.0 || t > max { return None; }
    let p = add(o, esc(d, t)); let n = sub(p, c); let l = largo(n).max(1e-9);
    Some(Golpe { t, n: esc(n, 1.0 / l) })
}

/// la caja que ocupa una forma
pub fn aabb_de(f: &Forma) -> [f32; 6] {
    match f {
        Forma::Caja { c, e, h } => {
            let ext = [0, 1, 2].map(|k| (e[0][k] * h[0]).abs() + (e[1][k] * h[1]).abs() + (e[2][k] * h[2]).abs());
            [c[0] - ext[0], c[1] - ext[1], c[2] - ext[2], c[0] + ext[0], c[1] + ext[1], c[2] + ext[2]]
        }
        Forma::Esfera { c, r } => [c[0] - r, c[1] - r, c[2] - r, c[0] + r, c[1] + r, c[2] + r],
        Forma::Capsula { a, b, r } => [a[0].min(b[0]) - r, a[1].min(b[1]) - r, a[2].min(b[2]) - r, a[0].max(b[0]) + r, a[1].max(b[1]) + r, a[2].max(b[2]) + r],
    }
}
