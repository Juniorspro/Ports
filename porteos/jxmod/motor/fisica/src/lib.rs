//! La física de JXMod en Rust (WebAssembly en el WebView): el bucle de subpasos de `physStep` de juego/fisica.js —XPBD:
//! integrar, uniones, contactos (posición y fricción), velocidades y rebote—, con las mismas cuentas en el mismo orden.
//! La detección de choques sigue en JavaScript; los cuerpos, contactos y uniones llegan en arreglos de f64:
//!  - cuerpo (`CU` números): pos(3), q(4: x y z w), vel(3), ang(3), prevPos(3), prevQ(4), invMass, invI(3), banderas
//!    (1 dinámico —masa y no congelado—, 2 dormido, 4 agarrado), fricción, rebote, libre;
//!  - contacto (`CO`): A, B (-1: ninguno), tiene punto fijo del mundo (wB), rA(3), rB o wB(3), n(3), depth, lamN, vnPre,
//!    activo, hit, hit nuevo (sale), pA del golpe (3, sale), vnPre del golpe (sale), libres;
//!  - unión (`UN`): a, b, pa(3), pb(3), axA(3), axB(3), pA(3), pB(3), hA(3), hB(3), swing, twist, bisagra, lo, hi, libres.
pub const CU: usize = 28;
pub const CO: usize = 24;
pub const UN: usize = 36;
const GRAV: f64 = 9.81;
const MAXDEP: f64 = 4.0;
const BOUNCE_V: f64 = 0.5;

type V = [f64; 3];
type Q = [f64; 4];
#[inline] fn sub(a: V, b: V) -> V { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
#[inline] fn add(a: V, b: V) -> V { [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
#[inline] fn esc(a: V, k: f64) -> V { [a[0] * k, a[1] * k, a[2] * k] }
#[inline] fn dot(a: V, b: V) -> f64 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
#[inline] fn cruz(a: V, b: V) -> V { [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
#[inline] fn largo(a: V) -> f64 { dot(a, a).sqrt() }
#[inline] fn norm(a: V) -> V { let l = largo(a); if l > 0.0 { esc(a, 1.0 / l) } else { a } }
/// rotar v con q (Quat.rotTo)
#[inline] fn rot(q: Q, v: V) -> V {
    let (qx, qy, qz, qw) = (q[0], q[1], q[2], q[3]);
    let (tx, ty, tz) = (2.0 * (qy * v[2] - qz * v[1]), 2.0 * (qz * v[0] - qx * v[2]), 2.0 * (qx * v[1] - qy * v[0]));
    [v[0] + qw * tx + qy * tz - qz * ty, v[1] + qw * ty + qz * tx - qx * tz, v[2] + qw * tz + qx * ty - qy * tx]
}
#[inline] fn rot_inv(q: Q, v: V) -> V { rot([-q[0], -q[1], -q[2], q[3]], v) }
#[inline] fn qnorm(q: Q) -> Q { let l = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt(); let l = if l > 0.0 { l } else { 1.0 }; [q[0] / l, q[1] / l, q[2] / l, q[3] / l] }
/// Quat.integrate(w, dt)
#[inline] fn integrar(q: Q, w: V, dt: f64) -> Q {
    let h = dt * 0.5; let (x, y, z) = (w[0] * h, w[1] * h, w[2] * h); let (qx, qy, qz, qw) = (q[0], q[1], q[2], q[3]);
    qnorm([qx + x * qw + y * qz - z * qy, qy + y * qw + z * qx - x * qz, qz + z * qw + x * qy - y * qx, qw + -x * qx - y * qy - z * qz])
}
#[inline] fn qmul(a: Q, b: Q) -> Q {
    [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
     a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]
}

/// un cuerpo leído del arreglo (y escrito de vuelta al final)
#[derive(Clone, Copy)]
struct Cuerpo { pos: V, q: Q, vel: V, ang: V, ppos: V, pq: Q, im: f64, ii: V, din: bool, duerme: bool, agarrado: bool, fric: f64, rest: f64 }
impl Cuerpo {
    fn leer(d: &[f64]) -> Cuerpo {
        let f = d[24] as u32;
        Cuerpo { pos: [d[0], d[1], d[2]], q: [d[3], d[4], d[5], d[6]], vel: [d[7], d[8], d[9]], ang: [d[10], d[11], d[12]], ppos: [d[13], d[14], d[15]], pq: [d[16], d[17], d[18], d[19]],
            im: d[20], ii: [d[21], d[22], d[23]], din: f & 1 != 0, duerme: f & 2 != 0, agarrado: f & 4 != 0, fric: d[25], rest: d[26] }
    }
    fn escribir(&self, d: &mut [f64]) {
        d[0..3].copy_from_slice(&self.pos); d[3..7].copy_from_slice(&self.q); d[7..10].copy_from_slice(&self.vel); d[10..13].copy_from_slice(&self.ang);
        d[13..16].copy_from_slice(&self.ppos); d[16..20].copy_from_slice(&self.pq);
    }
    #[inline] fn despierto(&self) -> bool { self.din && !self.duerme }
    /// la inercia inversa en el mundo (invIw)
    #[inline] fn inv_iw(&self, v: V) -> V { let o = rot_inv(self.q, v); rot(self.q, [o[0] * self.ii[0], o[1] * self.ii[1], o[2] * self.ii[2]]) }
    /// masa inversa generalizada en r, dirección n (wAt)
    #[inline] fn w_at(&self, r: V, n: V) -> f64 { if !self.despierto() { return 0.0; } let e = cruz(r, n); let t = self.inv_iw(e); self.im + dot(e, t) }
    #[inline] fn aplicar_pos(&mut self, p: V, r: V, s: f64) {
        if !self.despierto() { return; }
        self.pos = add(self.pos, esc(p, self.im * s));
        let w = esc(self.inv_iw(cruz(r, p)), s); self.q = integrar(self.q, w, 1.0);
    }
    #[inline] fn aplicar_vel(&mut self, p: V, r: V, s: f64) {
        if !self.despierto() { return; }
        self.vel = add(self.vel, esc(p, self.im * s));
        let w = self.inv_iw(cruz(r, p)); self.ang = add(self.ang, esc(w, s));
    }
}

#[derive(Clone, Copy)]
struct Contacto { a: usize, b: Option<usize>, wb: Option<V>, ra: V, rb: V, n: V, depth: f64, lam: f64, vn_pre: f64, activo: bool, hit: bool, hit_nuevo: bool, hit_p: V, hit_vn: f64 }
impl Contacto {
    fn leer(d: &[f64]) -> Contacto {
        let b = if d[1] < 0.0 { None } else { Some(d[1] as usize) };
        let tiene_wb = d[2] > 0.5; let x = [d[6], d[7], d[8]];
        Contacto { a: d[0] as usize, b, wb: if tiene_wb { Some(x) } else { None }, ra: [d[3], d[4], d[5]], rb: x, n: [d[9], d[10], d[11]], depth: d[12], lam: d[13], vn_pre: d[14],
            activo: d[15] > 0.5, hit: d[16] > 0.5, hit_nuevo: false, hit_p: [0.0; 3], hit_vn: 0.0 }
    }
    fn escribir(&self, d: &mut [f64]) {
        d[13] = self.lam; d[14] = self.vn_pre; d[15] = self.activo as u8 as f64; d[16] = self.hit as u8 as f64; d[17] = self.hit_nuevo as u8 as f64;
        d[18..21].copy_from_slice(&self.hit_p); d[21] = self.hit_vn;
    }
}

#[derive(Clone, Copy)]
struct Union { a: usize, b: usize, pa: V, pb: V, ax_a: V, ax_b: V, p_a: V, p_b: V, h_a: V, h_b: V, swing: f64, twist: f64, bisagra: bool, lo: f64, hi: f64 }
impl Union {
    fn leer(d: &[f64]) -> Union {
        let v = |i: usize| [d[i], d[i + 1], d[i + 2]];
        Union { a: d[0] as usize, b: d[1] as usize, pa: v(2), pb: v(5), ax_a: v(8), ax_b: v(11), p_a: v(14), p_b: v(17), h_a: v(20), h_b: v(23), swing: d[26], twist: d[27], bisagra: d[28] > 0.5, lo: d[29], hi: d[30] }
    }
}

/// dos cuerpos a la vez (a y b distintos)
fn dos(c: &mut [Cuerpo], i: usize, j: usize) -> (&mut Cuerpo, &mut Cuerpo) {
    if i < j { let (x, y) = c.split_at_mut(j); (&mut x[i], &mut y[0]) } else { let (x, y) = c.split_at_mut(i); (&mut y[0], &mut x[j]) }
}

/// velocidad normal del contacto (contactVn)
fn contacto_vn(cs: &[Cuerpo], c: &Contacto) -> f64 {
    let a = &cs[c.a]; let r = rot(a.q, c.ra); let va = add(a.vel, cruz(a.ang, r));
    if c.wb.is_some() { return dot(va, c.n); }
    let b = &cs[c.b.unwrap()]; let rb = rot(b.q, c.rb); let vb = add(b.vel, cruz(b.ang, rb));
    dot(sub(va, vb), c.n)
}

/// corrección angular (applyRot): con los dinámicos aunque duerman, como en JS
fn aplicar_giro(a: &mut Cuerpo, b: &mut Cuerpo, n: V, ang: f64) {
    let ta = if a.din { a.inv_iw(n) } else { [0.0; 3] }; let tb = if b.din { b.inv_iw(n) } else { [0.0; 3] };
    let w = dot(n, ta) + dot(n, tb); if w < 1e-9 { return; }
    let l = ang / w;
    if a.din { a.q = integrar(a.q, esc(ta, l), 1.0); }
    if b.din { b.q = integrar(b.q, esc(tb, -l), 1.0); }
}

fn resolver_union(cs: &mut [Cuerpo], j: &Union) {
    if j.a == j.b || j.a >= cs.len() || j.b >= cs.len() { return; }
    let (a, b) = dos(cs, j.a, j.b);
    // 1) los puntos de enganche coinciden
    let ra = rot(a.q, j.pa); let rb = rot(b.q, j.pb);
    let d = sub(add(b.pos, rb), add(a.pos, ra)); let l = largo(d);
    if l > 1e-6 {
        let n = esc(d, 1.0 / l); let w = a.w_at(ra, n) + b.w_at(rb, n);
        if w > 1e-9 { let p = esc(n, l / w); a.aplicar_pos(p, ra, 1.0); b.aplicar_pos(p, rb, -1.0); }
    }
    let a1 = rot(a.q, j.ax_a); let b1 = rot(b.q, j.ax_b);
    if j.bisagra {
        let ha = rot(a.q, j.h_a); let hb = rot(b.q, j.h_b); let c = cruz(ha, hb); let s = largo(c);
        if s > 1e-5 { aplicar_giro(a, b, esc(c, 1.0 / s), s.min(1.0).asin()); }
        let ha2 = rot(a.q, j.h_a); let pa = rot(a.q, j.ax_a); let pb = rot(b.q, j.ax_b);
        let ang = dot(cruz(pa, pb), ha2).atan2(dot(pa, pb));
        if ang < j.lo { aplicar_giro(a, b, ha2, ang - j.lo); } else if ang > j.hi { aplicar_giro(a, b, ha2, ang - j.hi); }
        return;
    }
    // 2) cono de giro
    let cs_ = dot(a1, b1).clamp(-1.0, 1.0); let sw = cs_.acos();
    if sw > j.swing { let n = cruz(a1, b1); let l = largo(n); if l > 1e-6 { aplicar_giro(a, b, esc(n, 1.0 / l), sw - j.swing); } }
    // 3) torsión alrededor del eje
    if j.twist < std::f64::consts::PI {
        let a2 = rot(a.q, j.ax_a); let b2 = rot(b.q, j.ax_b); let n = norm(add(a2, b2));
        let pa = rot(a.q, j.p_a); let pb = rot(b.q, j.p_b);
        let pa2 = norm(sub(pa, esc(n, dot(n, pa)))); let pb2 = norm(sub(pb, esc(n, dot(n, pb))));
        let tw = dot(cruz(pa2, pb2), n).atan2(dot(pa2, pb2));
        if tw.abs() > j.twist { aplicar_giro(a, b, n, tw - tw.signum() * j.twist); }
    }
}

fn resolver_contacto_pos(cs: &mut [Cuerpo], c: &mut Contacto, h: f64) {
    let a0 = cs[c.a];
    let ra = rot(a0.q, c.ra); let pa = add(a0.pos, ra);
    let (rb, pb) = match (c.wb, c.b) { (Some(w), _) => (None, w), (None, Some(bi)) => { let b = &cs[bi]; let r = rot(b.q, c.rb); (Some(r), add(b.pos, r)) } _ => return };
    let n = c.n; let sep = dot(sub(pa, pb), n);
    if sep >= 0.0 { c.activo = false; return; }
    c.activo = true;
    if !c.hit && c.vn_pre < -2.2 { c.hit = true; c.hit_nuevo = true; c.hit_p = pa; c.hit_vn = c.vn_pre; }
    let bi = if rb.is_some() { c.b } else { None };
    let wa = cs[c.a].w_at(ra, n); let wb = match (rb, bi) { (Some(r), Some(b)) => cs[b].w_at(r, n), _ => 0.0 }; let w = wa + wb; if w < 1e-9 { return; }
    let dl = (-sep).min(MAXDEP * h + (-sep - c.depth.max(0.0)).max(0.0)) / w; c.lam += dl;
    let p = esc(n, dl);
    cs[c.a].aplicar_pos(p, ra, 1.0); if let (Some(r), Some(b)) = (rb, bi) { if b != c.a { cs[b].aplicar_pos(p, r, -1.0); } }
    // fricción
    let a = cs[c.a];
    let r0 = rot(a.pq, c.ra); let a0p = add(a.ppos, r0);
    let mut b0 = pb;
    if let Some(b) = bi { let bb = &cs[b]; let q0 = rot(bb.pq, c.rb); b0 = add(bb.ppos, q0); }
    let ra2 = rot(a.q, c.ra); let rb2 = bi.map(|b| rot(cs[b].q, c.rb));
    let a1 = add(a.pos, ra2); let b1 = match (bi, rb2) { (Some(b), Some(r)) => add(cs[b].pos, r), _ => pb };
    let d = sub(sub(a1, a0p), sub(b1, b0)); let dn = dot(d, n);
    let t = sub(d, esc(n, dn)); let tl = largo(t);
    if tl > 1e-9 {
        let fb = match c.b { Some(b) => cs[b].fric, None => 0.7 };
        let mu = (a.fric * fb).sqrt(); let t = esc(t, 1.0 / tl);
        let wt = a.w_at(ra2, t) + match (bi, rb2) { (Some(b), Some(r)) => cs[b].w_at(r, t), _ => 0.0 };
        if wt > 1e-9 {
            let mut dlt = tl / wt; let lim = mu * c.lam;
            if dlt > lim * 1.25 { dlt = lim * 0.9; }
            let pt = esc(t, -dlt); cs[c.a].aplicar_pos(pt, ra2, 1.0); if let (Some(b), Some(r)) = (bi, rb2) { if b != c.a { cs[b].aplicar_pos(pt, r, -1.0); } }
        }
    }
}

fn resolver_contacto_vel(cs: &mut [Cuerpo], c: &Contacto) {
    if !c.activo { return; }
    let n = c.n; let ra = rot(cs[c.a].q, c.ra); let bi = if c.wb.is_some() { None } else { c.b }; let rb = bi.map(|b| rot(cs[b].q, c.rb));
    let vn = contacto_vn(cs, c);
    let e = if c.vn_pre > -BOUNCE_V { 0.0 } else { cs[c.a].rest.max(match c.b { Some(b) => cs[b].rest, None => 0.2 }) };
    let target = (-e * c.vn_pre).max(0.0); let dv = target - vn;
    if dv.abs() < 1e-6 { return; }
    let w = cs[c.a].w_at(ra, n) + match (bi, rb) { (Some(b), Some(r)) => cs[b].w_at(r, n), _ => 0.0 }; if w < 1e-9 { return; }
    let s = dv / w; let p = esc(n, s);
    cs[c.a].aplicar_vel(p, ra, 1.0); if let (Some(b), Some(r)) = (bi, rb) { if b != c.a { cs[b].aplicar_vel(p, r, -1.0); } }
}

/// los subpasos de un paso de física (lo de adentro del `for (let s = 0; s < n; s++)` de physStep)
pub fn paso(cu: &mut [f64], co: &mut [f64], un: &[f64], dt: f64, n: usize, gscale: f64, vel_iter: usize) -> usize {
    let mut cs: Vec<Cuerpo> = cu.chunks_exact(CU).map(Cuerpo::leer).collect();
    let mut cts: Vec<Contacto> = co.chunks_exact(CO).map(Contacto::leer).filter(|c| c.a < cs.len() && c.b.map_or(true, |b| b < cs.len())).collect();
    let us: Vec<Union> = un.chunks_exact(UN).map(Union::leer).collect();
    let n = n.max(1); let h = dt / n as f64;
    for _ in 0..n {
        for b in cs.iter_mut() {
            if !b.despierto() { continue; }
            b.ppos = b.pos; b.pq = b.q;
            if !b.agarrado { b.vel[1] -= GRAV * gscale * h; }
            b.pos = add(b.pos, esc(b.vel, h));
            b.q = integrar(b.q, b.ang, h);
        }
        for c in cts.iter_mut() { c.vn_pre = contacto_vn(&cs, c); }
        for j in &us { resolver_union(&mut cs, j); }
        for c in cts.iter_mut() {
            let ok = cs[c.a].despierto() || c.b.map_or(false, |b| cs[b].despierto());
            if ok { resolver_contacto_pos(&mut cs, c, h); }
        }
        for b in cs.iter_mut() {
            if !b.despierto() { continue; }
            b.vel = esc(sub(b.pos, b.ppos), 1.0 / h);
            let pq = b.pq; let dq = qmul(b.q, [-pq[0], -pq[1], -pq[2], pq[3]]);
            let k = (if dq[3] >= 0.0 { 2.0 } else { -2.0 }) / h; b.ang = [dq[0] * k, dq[1] * k, dq[2] * k];
        }
        for _ in 0..vel_iter.max(1) { for c in cts.iter() { resolver_contacto_vel(&mut cs, c); } }
        for c in cts.iter_mut() { c.lam = 0.0; }
    }
    for (b, d) in cs.iter().zip(cu.chunks_exact_mut(CU)) { b.escribir(d); }
    let mut golpes = 0;
    let mut k = 0;
    for d in co.chunks_exact_mut(CO) {
        let c = Contacto::leer(d);
        if c.a >= cs.len() || c.b.map_or(false, |b| b >= cs.len()) { continue; }
        let r = &cts[k]; k += 1; r.escribir(d); if r.hit_nuevo { golpes += 1; }
    }
    golpes
}

// ---- la puerta de WebAssembly: tres arreglos en la memoria del módulo y un paso ----
static mut CUERPOS: Vec<f64> = Vec::new();
static mut CONTACTOS: Vec<f64> = Vec::new();
static mut UNIONES: Vec<f64> = Vec::new();
#[allow(static_mut_refs)]
unsafe fn lugar(v: &mut Vec<f64>, n: usize) -> *mut f64 { if v.len() < n { v.resize(n, 0.0); } v.as_mut_ptr() }
/// dónde escribir n cuerpos (la dirección puede cambiar si crece: pedirla en cada paso)
#[no_mangle] #[allow(static_mut_refs)] pub unsafe extern "C" fn cuerpos(n: usize) -> *mut f64 { lugar(&mut CUERPOS, n * CU) }
#[no_mangle] #[allow(static_mut_refs)] pub unsafe extern "C" fn contactos(n: usize) -> *mut f64 { lugar(&mut CONTACTOS, n * CO) }
#[no_mangle] #[allow(static_mut_refs)] pub unsafe extern "C" fn uniones(n: usize) -> *mut f64 { lugar(&mut UNIONES, n * UN) }
/// un paso con nb cuerpos, nc contactos y nu uniones ya escritos; devuelve cuántos golpes nuevos hubo
#[no_mangle] #[allow(static_mut_refs)]
pub unsafe extern "C" fn paso_fisica(nb: usize, nc: usize, nu: usize, dt: f64, sub: usize, gscale: f64, vel_iter: usize) -> usize {
    let (a, b, c) = (&mut CUERPOS[..nb * CU], &mut CONTACTOS[..nc * CO], &UNIONES[..nu * UN]);
    paso(a, b, c, dt, sub, gscale, vel_iter)
}

#[cfg(test)]
mod prueba {
    use super::*;
    /// una caja de 1 kg cae al piso (un contacto con el mundo) y queda apoyada
    #[test]
    fn caja_al_piso() {
        let mut cu = vec![0.0; CU];
        cu[1] = 0.5; cu[6] = 1.0; cu[19] = 1.0; cu[20] = 1.0; cu[21] = 6.0; cu[22] = 6.0; cu[23] = 6.0; cu[24] = 1.0; cu[25] = 0.6; cu[26] = 0.15;
        cu[8] = -3.0;
        let mut co = vec![0.0; CO];
        co[0] = 0.0; co[1] = -1.0; co[2] = 1.0; co[4] = -0.5; co[10] = 1.0; co[6] = 0.0; co[7] = 0.0; co[8] = 0.0;
        for _ in 0..30 { paso(&mut cu, &mut co, &[], 1.0 / 60.0, 12, 1.0, 2); }
        assert!((cu[1] - 0.5).abs() < 0.02, "altura {}", cu[1]);
        assert!(cu[8].abs() < 0.2, "vel {}", cu[8]);
    }
}
