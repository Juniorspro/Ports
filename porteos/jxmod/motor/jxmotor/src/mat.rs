//! Matrices 4×4 en columnas (como WebGL y GLES): m[col * 4 + fila].
pub type M4 = [f32; 16];

pub fn id() -> M4 { let mut m = [0.0; 16]; m[0] = 1.0; m[5] = 1.0; m[10] = 1.0; m[15] = 1.0; m }
pub fn mul(a: &M4, b: &M4) -> M4 {
    let mut r = [0.0; 16];
    for c in 0..4 { for f in 0..4 { let mut s = 0.0; for k in 0..4 { s += a[k * 4 + f] * b[c * 4 + k]; } r[c * 4 + f] = s; } }
    r
}
pub fn inv(m: &M4) -> M4 {
    let mut r = [0.0f32; 16];
    r[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    r[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    r[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    r[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    r[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    r[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    r[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    r[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    r[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    r[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    r[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    r[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    r[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    r[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    r[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    r[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    let d = m[0] * r[0] + m[1] * r[4] + m[2] * r[8] + m[3] * r[12];
    if d.abs() < 1e-20 { return id(); }
    for x in r.iter_mut() { *x /= d; }
    r
}
pub fn sub(a: [f32; 3], b: [f32; 3]) -> [f32; 3] { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
pub fn cruz(a: [f32; 3], b: [f32; 3]) -> [f32; 3] { [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
pub fn punto(a: [f32; 3], b: [f32; 3]) -> f32 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
pub fn norm(a: [f32; 3]) -> [f32; 3] { let l = punto(a, a).sqrt().max(1e-12); [a[0] / l, a[1] / l, a[2] / l] }
/// vista que mira de `ojo` a `centro`
pub fn mirar(ojo: [f32; 3], centro: [f32; 3], arriba: [f32; 3]) -> M4 {
    let f = norm(sub(centro, ojo)); let s = norm(cruz(f, arriba)); let u = cruz(s, f);
    [s[0], u[0], -f[0], 0.0, s[1], u[1], -f[1], 0.0, s[2], u[2], -f[2], 0.0, -punto(s, ojo), -punto(u, ojo), punto(f, ojo), 1.0]
}
pub fn orto(l: f32, r: f32, b: f32, t: f32, n: f32, f: f32) -> M4 {
    [2.0 / (r - l), 0.0, 0.0, 0.0, 0.0, 2.0 / (t - b), 0.0, 0.0, 0.0, 0.0, -2.0 / (f - n), 0.0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1.0]
}
/// el espejo del plano y = h (para el reflejo del agua: VP · espejo)
pub fn espejo_y(h: f32) -> M4 { let mut m = id(); m[5] = -1.0; m[13] = 2.0 * h; m }
/// los 6 planos de lo que ve una matriz de vista y proyección (columnas, como WebGL): normal hacia adentro y distancia
pub fn planos(m: &M4) -> [[f32; 4]; 6] {
    let f = |i: usize| [m[i], m[4 + i], m[8 + i], m[12 + i]];
    let (r0, r1, r2, r3) = (f(0), f(1), f(2), f(3));
    let mut p = [[0.0; 4]; 6];
    for (k, (a, s)) in [(r0, 1.0), (r0, -1.0), (r1, 1.0), (r1, -1.0), (r2, 1.0), (r2, -1.0)].iter().enumerate() {
        let q = [r3[0] + s * a[0], r3[1] + s * a[1], r3[2] + s * a[2], r3[3] + s * a[3]];
        let l = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2]).sqrt().max(1e-12);
        p[k] = [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
    }
    p
}
/// si una esfera (centro y radio; radio negativo = sin esfera) toca lo que se ve
pub fn esfera_dentro(p: &[[f32; 4]; 6], e: &[f32; 4]) -> bool {
    if e[3] < 0.0 { return true; }
    p.iter().all(|q| q[0] * e[0] + q[1] * e[1] + q[2] * e[2] + q[3] > -e[3])
}
