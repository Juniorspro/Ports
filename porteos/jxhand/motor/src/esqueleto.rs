//! El esqueleto de la mano: de los 21 puntos en metros saca la palma (un marco rígido), los ángulos de cada articulación
//! con los límites de una mano de verdad (las falanges sólo se doblan hacia la palma, los nudillos se abren un poco
//! hacia los costados) y la vuelve a armar con el largo de TUS huesos (calibrado mientras usás la mano, con la mediana
//! de muchos cuadros). Así la mano 3D no se estira, no se dobla al revés y no tiembla aunque el modelo dude, y los
//! ángulos sirven directo para mover los huesos de una mano de juego.
use crate::mano::{P3, PUNTOS};

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct V3 { pub x: f32, pub y: f32, pub z: f32 }
impl V3 {
    pub const fn n(x: f32, y: f32, z: f32) -> V3 { V3 { x, y, z } }
    pub fn de(p: &P3) -> V3 { V3 { x: p.x, y: p.y, z: p.z } }
    pub fn mas(self, o: V3) -> V3 { V3::n(self.x + o.x, self.y + o.y, self.z + o.z) }
    pub fn menos(self, o: V3) -> V3 { V3::n(self.x - o.x, self.y - o.y, self.z - o.z) }
    pub fn por(self, k: f32) -> V3 { V3::n(self.x * k, self.y * k, self.z * k) }
    pub fn punto(self, o: V3) -> f32 { self.x * o.x + self.y * o.y + self.z * o.z }
    pub fn cruz(self, o: V3) -> V3 { V3::n(self.y * o.z - self.z * o.y, self.z * o.x - self.x * o.z, self.x * o.y - self.y * o.x) }
    pub fn largo(self) -> f32 { self.punto(self).sqrt() }
    pub fn unit(self) -> V3 { let l = self.largo(); if l > 1e-9 { self.por(1.0 / l) } else { V3::n(0.0, 1.0, 0.0) } }
}

/// marco de la palma (de mano derecha, para que el cuaternión sirva): x hacia el lado del índice, y hacia los dedos,
/// z = x × y. En una mano con forma de derecha z sale por la palma y en una de izquierda por el dorso: `pz` dice
/// para qué lado de z queda la palma (−1 o +1), así los ángulos significan lo mismo en las dos manos.
#[derive(Clone, Copy, Debug)]
pub struct Marco { pub o: V3, pub x: V3, pub y: V3, pub z: V3, pub pz: f32 }
impl Marco {
    pub fn a_local(&self, p: V3) -> V3 { let d = p.menos(self.o); V3::n(d.punto(self.x), d.punto(self.y), d.punto(self.z)) }
    pub fn a_global(&self, l: V3) -> V3 { self.o.mas(self.x.por(l.x)).mas(self.y.por(l.y)).mas(self.z.por(l.z)) }
    /// la rotación como cuaternión (x, y, z, w), de las columnas x, y, z
    pub fn cuaternion(&self) -> [f32; 4] {
        let (m00, m01, m02, m10, m11, m12, m20, m21, m22) = (self.x.x, self.y.x, self.z.x, self.x.y, self.y.y, self.z.y, self.x.z, self.y.z, self.z.z);
        let tr = m00 + m11 + m22;
        let q = if tr > 0.0 { let s = (tr + 1.0).sqrt() * 2.0; [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s] }
            else if m00 > m11 && m00 > m22 { let s = (1.0 + m00 - m11 - m22).sqrt() * 2.0; [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s] }
            else if m11 > m22 { let s = (1.0 + m11 - m00 - m22).sqrt() * 2.0; [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s] }
            else { let s = (1.0 + m22 - m00 - m11).sqrt() * 2.0; [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s] };
        q
    }
}

/// `geom_derecha`: si la mano, tal como está en la imagen que se pasó, tiene la forma de una derecha (en una imagen
/// espejada una izquierda real se ve derecha). El número de «derecha» del modelo es justo eso: la forma en la imagen tal
/// cual llega (medido: la palma a la cámara con el pulgar a la derecha da 0,98). Con la forma de derecha, z = x × y sale
/// por la palma (pz = +1); con la de izquierda, por el dorso.
pub fn marco_palma(w: &[V3; PUNTOS], geom_derecha: bool) -> Marco {
    let o = w[0];
    let y = w[9].menos(w[0]).unit();
    let xt = w[5].menos(w[17]);
    let x = xt.menos(y.por(xt.punto(y))).unit();
    let z = x.cruz(y).unit();
    Marco { o, x, y, z, pz: if geom_derecha { 1.0 } else { -1.0 } }
}
/// la normal que sale de la palma (en el mundo)
pub fn normal_palma(m: &Marco) -> V3 { m.z.por(m.pz) }

pub const DEDOS: [[usize; 4]; 5] = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
/// los 20 huesos: (padre, hijo)
pub const HUESOS: [(usize, usize); 20] = [(0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (5, 6), (6, 7), (7, 8), (0, 9), (9, 10), (10, 11), (11, 12), (0, 13), (13, 14), (14, 15), (15, 16), (0, 17), (17, 18), (18, 19), (19, 20)];

/// los ángulos de un dedo (radianes): base (flexión y apertura) y las dos articulaciones siguientes (sólo flexión)
#[derive(Clone, Copy, Debug, Default)]
pub struct AngDedo { pub flex: f32, pub abre: f32, pub medio: f32, pub punta: f32 }

const GR: f32 = std::f32::consts::PI / 180.0;
// límites (grados): [flexión base mín, máx], [apertura mín, máx], [media mín, máx], [punta mín, máx]
const LIM: [[(f32, f32); 4]; 5] = [
    [(-25.0, 70.0), (-20.0, 75.0), (-15.0, 75.0), (-25.0, 90.0)],   // pulgar: base (CMC), MCP, IP
    [(-25.0, 95.0), (-25.0, 22.0), (-5.0, 115.0), (-10.0, 90.0)],
    [(-25.0, 95.0), (-18.0, 18.0), (-5.0, 115.0), (-10.0, 90.0)],
    [(-25.0, 95.0), (-20.0, 20.0), (-5.0, 115.0), (-10.0, 90.0)],
    [(-25.0, 95.0), (-30.0, 22.0), (-5.0, 115.0), (-10.0, 90.0)],
];

/// lo que se calibra de cada mano: el largo de los huesos y dónde están los nudillos en la palma
#[derive(Clone, Debug)]
pub struct Calibracion { muestras: Vec<[f32; 20]>, nudillos: Vec<[V3; 5]>, pub largos: [f32; 20], pub base: [V3; 5], pub lista: bool }

impl Default for Calibracion { fn default() -> Self { Calibracion { muestras: vec![], nudillos: vec![], largos: [0.0; 20], base: [V3::default(); 5], lista: false } } }

fn mediana(mut v: Vec<f32>) -> f32 { v.sort_by(|a, b| a.partial_cmp(b).unwrap()); if v.is_empty() { 0.0 } else { v[v.len() / 2] } }

impl Calibracion {
    /// suma un cuadro bueno (se guardan los últimos 90 y se usa la mediana: un cuadro malo no la mueve)
    pub fn sumar(&mut self, w: &[V3; PUNTOS], m: &Marco) {
        let mut l = [0f32; 20]; for (i, &(a, b)) in HUESOS.iter().enumerate() { l[i] = w[b].menos(w[a]).largo(); }
        self.muestras.push(l); if self.muestras.len() > 90 { self.muestras.remove(0); }
        let mut n = [V3::default(); 5]; for d in 0..5 { n[d] = m.a_local(w[DEDOS[d][0]]); }
        self.nudillos.push(n); if self.nudillos.len() > 90 { self.nudillos.remove(0); }
        for i in 0..20 { self.largos[i] = mediana(self.muestras.iter().map(|s| s[i]).collect()); }
        for d in 0..5 { self.base[d] = V3::n(mediana(self.nudillos.iter().map(|s| s[d].x).collect()), mediana(self.nudillos.iter().map(|s| s[d].y).collect()), mediana(self.nudillos.iter().map(|s| s[d].z).collect())); }
        self.lista = self.muestras.len() >= 5;
    }
}

/// (eje de flexión, eje de apertura) para un dedo con dirección de reposo `r`: el de flexión cumple eje × r = palma
fn ejes(r: V3, pz: f32) -> (V3, V3) {
    let palma = V3::n(0.0, 0.0, pz);
    (r.cruz(palma).unit(), V3::n(0.0, 0.0, -1.0))
}
/// gira el vector `v` alrededor del eje unitario `e` (Rodrigues)
fn girar(v: V3, e: V3, a: f32) -> V3 { let (c, s) = (a.cos(), a.sin()); v.por(c).mas(e.cruz(v).por(s)).mas(e.por(e.punto(v) * (1.0 - c))) }
/// ángulo con signo de `a` a `b` alrededor del eje `e` (los dos proyectados al plano normal a `e`)
fn ang_eje(a: V3, b: V3, e: V3) -> f32 {
    let (pa, pb) = (a.menos(e.por(a.punto(e))), b.menos(e.por(b.punto(e))));
    pa.cruz(pb).punto(e).atan2(pa.punto(pb))
}

/// los ángulos de los 5 dedos desde los puntos (en el marco de la palma)
pub fn angulos(w: &[V3; PUNTOS], m: &Marco) -> [AngDedo; 5] {
    let mut r = [AngDedo::default(); 5];
    for d in 0..5 {
        let p: Vec<V3> = DEDOS[d].iter().map(|&i| m.a_local(w[i])).collect();
        let (b0, b1, b2) = (p[1].menos(p[0]), p[2].menos(p[1]), p[3].menos(p[2]));
        // la dirección de reposo: los dedos derechos hacia y; el pulgar sale en diagonal hacia el lado del índice.
        // Doblar = girar hacia la palma (z·pz); abrir = girar hacia el lado del índice (eje −z, igual en las dos manos)
        let reposo = if d == 0 { V3::n(0.70, 0.71, 0.0).unit() } else { V3::n(0.0, 1.0, 0.0) };
        let (lateral, eje_abre) = ejes(reposo, m.pz);
        let flex = ang_eje(reposo, b0, lateral);
        let abre = ang_eje(reposo, b0, eje_abre);
        // la flexión de las articulaciones siguientes: alrededor del eje lateral del propio hueso
        let eje1 = b0.cruz(b1); let s1 = if eje1.punto(lateral) >= 0.0 { 1.0 } else { -1.0 };
        let medio = s1 * (b0.unit().punto(b1.unit()).clamp(-1.0, 1.0)).acos();
        let eje2 = b1.cruz(b2); let s2 = if eje2.punto(lateral) >= 0.0 { 1.0 } else { -1.0 };
        let punta = s2 * (b1.unit().punto(b2.unit()).clamp(-1.0, 1.0)).acos();
        let l = &LIM[d];
        r[d] = AngDedo { flex: flex.clamp(l[0].0 * GR, l[0].1 * GR), abre: abre.clamp(l[1].0 * GR, l[1].1 * GR), medio: medio.clamp(l[2].0 * GR, l[2].1 * GR), punta: punta.clamp(l[3].0 * GR, l[3].1 * GR) };
    }
    r
}

/// arma la mano otra vez con los ángulos y el largo de los huesos calibrados (en el marco de la palma → mundo)
pub fn armar(m: &Marco, cal: &Calibracion, a: &[AngDedo; 5]) -> [V3; PUNTOS] {
    let mut r = [V3::default(); PUNTOS];
    r[0] = m.o;
    for d in 0..5 {
        let reposo = if d == 0 { V3::n(0.70, 0.71, 0.0).unit() } else { V3::n(0.0, 1.0, 0.0) };
        let (lateral, eje_abre) = ejes(reposo, m.pz);
        // dirección del primer hueso: abrir, después doblar alrededor del lateral (ya abierto)
        let dir0 = girar(reposo, eje_abre, a[d].abre); let lat = girar(lateral, eje_abre, a[d].abre);
        let dir0 = girar(dir0, lat, a[d].flex);
        let dir1 = girar(dir0, lat, a[d].medio); let dir2 = girar(dir1, lat, a[d].punta);
        let h = &cal.largos[d * 4..d * 4 + 4];
        let base = cal.base[d];
        let p1 = base.mas(dir0.por(h[1])); let p2 = p1.mas(dir1.por(h[2])); let p3 = p2.mas(dir2.por(h[3]));
        let ids = DEDOS[d];
        r[ids[0]] = m.a_global(base); r[ids[1]] = m.a_global(p1); r[ids[2]] = m.a_global(p2); r[ids[3]] = m.a_global(p3);
    }
    r
}

/// cuánto está cerrado cada dedo (0 = derecho, 1 = cerrado del todo): la curva total del dedo (base + media + punta),
/// descontando la curva natural de una mano «derecha» (medida en fotos: 50° a 70° en los dedos, unos 10° en el pulgar)
pub fn cierre(a: &[AngDedo; 5]) -> [f32; 5] {
    let mut c = [0f32; 5];
    for d in 0..5 {
        let total = a[d].flex + a[d].medio + a[d].punta;
        let (natural, rango) = if d == 0 { (25.0 * GR, 100.0 * GR) } else { (55.0 * GR, 170.0 * GR) };
        c[d] = ((total - natural) / rango).clamp(0.0, 1.0);
    }
    c
}
