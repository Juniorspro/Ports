//! La matemática de la capa GMod: vectores y cuaterniones del juego (nucleo.js) y el paso entre las unidades de Source
//! (pulgadas, Z arriba, ángulos en grados) y las del juego (metros, Y arriba).

/// un vector del juego (metros, Y arriba)
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct V3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[inline]
pub fn v3(x: f64, y: f64, z: f64) -> V3 { V3 { x, y, z } }

/// la raíz de la suma de cuadrados (el hypot de nucleo.js, no Math.hypot)
#[inline]
pub fn hypot4(a: f64, b: f64, c: f64, d: f64) -> f64 { (a * a + b * b + c * c + d * d).sqrt() }

/// Math.hypot de JavaScript para 2 o 3 números (con el escalado que evita desbordes)
pub fn js_hypot(v: &[f64]) -> f64 {
    let mut m = 0.0f64;
    for &x in v {
        let a = x.abs();
        if a == f64::INFINITY { return f64::INFINITY; }
        if a.is_nan() { m = f64::NAN; } else if a > m { m = a; }
    }
    if m.is_nan() { return f64::NAN; }
    if m == 0.0 { return 0.0; }
    // (V8: suma compensada de los cuadrados escalados)
    let mut suma = 0.0f64;
    let mut comp = 0.0f64;
    for &x in v {
        let r = x / m;
        let s = r * r - comp;
        let p = suma + s;
        comp = (p - suma) - s;
        suma = p;
    }
    suma.sqrt() * m
}

impl V3 {
    #[inline] pub fn set(&mut self, x: f64, y: f64, z: f64) -> &mut Self { self.x = x; self.y = y; self.z = z; self }
    #[inline] pub fn add(self, o: V3) -> V3 { v3(self.x + o.x, self.y + o.y, self.z + o.z) }
    #[inline] pub fn sub(self, o: V3) -> V3 { v3(self.x - o.x, self.y - o.y, self.z - o.z) }
    #[inline] pub fn scale(self, s: f64) -> V3 { v3(self.x * s, self.y * s, self.z * s) }
    #[inline] pub fn dot(self, o: V3) -> f64 { self.x * o.x + self.y * o.y + self.z * o.z }
    #[inline] pub fn len(self) -> f64 { (self.x * self.x + self.y * self.y + self.z * self.z).sqrt() }
    #[inline] pub fn len_sq(self) -> f64 { self.x * self.x + self.y * self.y + self.z * self.z }
    /// normalizado (si no es casi cero)
    pub fn norm(self) -> V3 { let l = self.len(); if l > 1e-12 { v3(self.x / l, self.y / l, self.z / l) } else { self } }
    pub fn cross(self, v: V3) -> V3 { v3(self.y * v.z - self.z * v.y, self.z * v.x - self.x * v.z, self.x * v.y - self.y * v.x) }
    /// la distancia (con el hypot de nucleo.js)
    pub fn dist(self, v: V3) -> f64 { hypot4(self.x - v.x, self.y - v.y, self.z - v.z, 0.0) }
}

/// un giro del juego
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Quat {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub w: f64,
}

impl Default for Quat {
    fn default() -> Quat { Quat { x: 0.0, y: 0.0, z: 0.0, w: 1.0 } }
}

impl Quat {
    pub fn new(x: f64, y: f64, z: f64, w: f64) -> Quat { Quat { x, y, z, w } }
    pub fn norm(self) -> Quat { let l = hypot4(self.x, self.y, self.z, self.w); let l = if l == 0.0 { 1.0 } else { l }; Quat::new(self.x / l, self.y / l, self.z / l, self.w / l) }
    /// a * b
    pub fn mul_to(a: Quat, b: Quat) -> Quat {
        let x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y;
        let y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x;
        let z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w;
        let w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
        Quat::new(x, y, z, w)
    }
    pub fn mul(self, b: Quat) -> Quat { Quat::mul_to(self, b) }
    pub fn conj(self) -> Quat { Quat::new(-self.x, -self.y, -self.z, self.w) }
    pub fn rot(self, v: V3) -> V3 {
        let (qx, qy, qz, qw) = (self.x, self.y, self.z, self.w);
        let tx = 2.0 * (qy * v.z - qz * v.y);
        let ty = 2.0 * (qz * v.x - qx * v.z);
        let tz = 2.0 * (qx * v.y - qy * v.x);
        v3(v.x + qw * tx + qy * tz - qz * ty, v.y + qw * ty + qz * tx - qx * tz, v.z + qw * tz + qx * ty - qy * tx)
    }
    pub fn axis(ax: f64, ay: f64, az: f64, ang: f64) -> Quat {
        let s = (ang / 2.0).sin();
        let l = hypot4(ax, ay, az, 0.0);
        let l = if l == 0.0 { 1.0 } else { l };
        Quat::new(ax / l * s, ay / l * s, az / l * s, (ang / 2.0).cos())
    }
}

/// pulgadas → metros
pub const GS: f64 = 0.0254;
pub const RAD: f64 = std::f64::consts::PI / 180.0;

/// Source → juego (una posición; oy: el cero de Source del mapa)
#[inline] pub fn vg(v: [f64; 3], oy: f64) -> V3 { v3(v[1] * GS, v[2] * GS + oy, v[0] * GS) }
/// juego → Source (una posición)
#[inline] pub fn vs(v: V3, oy: f64) -> [f64; 3] { [v.z / GS, v.x / GS, (v.y - oy) / GS] }
/// Source → juego (lo que no es una posición: velocidades, desplazamientos)
#[inline] pub fn vgr(v: [f64; 3]) -> V3 { v3(v[1] * GS, v[2] * GS, v[0] * GS) }
#[inline] pub fn vsr(v: V3) -> [f64; 3] { [v.z / GS, v.x / GS, v.y / GS] }
/// direcciones
#[inline] pub fn dg(v: [f64; 3]) -> V3 { v3(v[1], v[2], v[0]) }
#[inline] pub fn ds(v: V3) -> [f64; 3] { [v.z, v.x, v.y] }

/// Angle (p, y, r) → matriz de Source (adelante, izquierda, arriba)
pub fn ang_mat(a: [f64; 3]) -> [[f64; 3]; 3] {
    let (sp, cp) = ((a[0] * RAD).sin(), (a[0] * RAD).cos());
    let (sy, cy) = ((a[1] * RAD).sin(), (a[1] * RAD).cos());
    let (sr, cr) = ((a[2] * RAD).sin(), (a[2] * RAD).cos());
    [[cp * cy, cp * sy, -sp], [sr * sp * cy - cr * sy, sr * sp * sy + cr * cy, sr * cp], [cr * sp * cy + sr * sy, cr * sp * sy - sr * cy, cr * cp]]
}

pub fn mat_ang(f: [f64; 3], l: [f64; 3], u: [f64; 3]) -> [f64; 3] {
    let xy = js_hypot(&[f[0], f[1]]);
    if xy > 0.001 { return [(-f[2]).atan2(xy) / RAD, f[1].atan2(f[0]) / RAD, l[2].atan2(u[2]) / RAD]; }
    [(-f[2]).atan2(xy) / RAD, (-l[0]).atan2(l[1]) / RAD, 0.0]
}

/// el giro del juego de un Angle
pub fn ang_quat(a: [f64; 3]) -> Quat {
    let [f, l, u] = ang_mat(a);
    let (ff, lf, uu) = (dg(f), dg(l), dg(u));
    let m = [[lf.x, uu.x, ff.x], [lf.y, uu.y, ff.y], [lf.z, uu.z, ff.z]];
    let t = m[0][0] + m[1][1] + m[2][2];
    let (x, y, z, w);
    if t > 0.0 {
        let s = (t + 1.0).sqrt() * 2.0;
        w = 0.25 * s; x = (m[2][1] - m[1][2]) / s; y = (m[0][2] - m[2][0]) / s; z = (m[1][0] - m[0][1]) / s;
    } else if m[0][0] > m[1][1] && m[0][0] > m[2][2] {
        let s = (1.0 + m[0][0] - m[1][1] - m[2][2]).sqrt() * 2.0;
        w = (m[2][1] - m[1][2]) / s; x = 0.25 * s; y = (m[0][1] + m[1][0]) / s; z = (m[0][2] + m[2][0]) / s;
    } else if m[1][1] > m[2][2] {
        let s = (1.0 + m[1][1] - m[0][0] - m[2][2]).sqrt() * 2.0;
        w = (m[0][2] - m[2][0]) / s; x = (m[0][1] + m[1][0]) / s; y = 0.25 * s; z = (m[1][2] + m[2][1]) / s;
    } else {
        let s = (1.0 + m[2][2] - m[0][0] - m[1][1]).sqrt() * 2.0;
        w = (m[1][0] - m[0][1]) / s; x = (m[0][2] + m[2][0]) / s; y = (m[1][2] + m[2][1]) / s; z = 0.25 * s;
    }
    Quat::new(x, y, z, w).norm()
}

/// el Angle de un giro del juego
pub fn quat_ang(q: Quat) -> [f64; 3] {
    let f = ds(q.rot(v3(0.0, 0.0, 1.0)));
    let l = ds(q.rot(v3(1.0, 0.0, 0.0)));
    let u = ds(q.rot(v3(0.0, 1.0, 0.0)));
    mat_ang(f, l, u)
}

/// el Angle de una dirección de Source
pub fn dir_ang(d: [f64; 3]) -> [f64; 3] {
    let xy = js_hypot(&[d[0], d[1]]);
    [(-d[2]).atan2(xy) / RAD, d[1].atan2(d[0]) / RAD, 0.0]
}

/// la normalización de un ángulo de GMod (-180..180)
pub fn nrm(x: f64) -> f64 { ((x + 180.0) % 360.0 + 360.0) % 360.0 - 180.0 }
