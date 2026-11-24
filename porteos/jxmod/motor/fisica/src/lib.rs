//! La física de JXMod en Rust (WebAssembly en el WebView): el bucle de subpasos de `physStep` de juego/fisica.js —XPBD:
//! integrar, uniones, contactos (posición y fricción), velocidades y rebote—, con las mismas cuentas en el mismo orden.
//! La detección de choques sigue en JavaScript; los cuerpos, contactos y uniones llegan en arreglos de f64:
//!  - cuerpo (`CU` números): pos(3), q(4: x y z w), vel(3), ang(3), prevPos(3), prevQ(4), invMass, invI(3), banderas
//!    (1 dinámico —masa y no congelado—, 2 dormido, 4 agarrado), fricción, rebote, libre;
//!  - contacto (`CO`): A, B (-1: ninguno), tiene punto fijo del mundo (wB), rA(3), rB o wB(3), n(3), depth, lamN, vnPre,
//!    activo, hit, hit nuevo (sale), pA del golpe (3, sale), vnPre del golpe (sale), libres;
//!  - unión (`UN`): a, b, pa(3), pb(3), axA(3), axB(3), pA(3), pB(3), hA(3), hB(3), swing, twist, bisagra, lo, hi, libres.
//!
//! En el juego nativo, `paso_con` puede repartir las islas entre los hilos de un `Equipo` (sin cambiar ni una cuenta);
//! en WebAssembly no hay hilos y es siempre el bucle de un hilo.
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
struct Contacto { a: usize, b: Option<usize>, wb: Option<V>, ra: V, rb: V, n: V, depth: f64, lam: f64, vn_pre: f64, activo: bool, hit: bool, hit_nuevo: bool, hit_p: V, hit_vn: f64,
    /// (de la primera vuelta de velocidades a las otras: los puntos girados y la masa en la normal, que no cambian)
    g_ra: V, g_rb: V, g_w: f64 }
impl Contacto {
    fn leer(d: &[f64]) -> Contacto {
        let b = if d[1] < 0.0 { None } else { Some(d[1] as usize) };
        let tiene_wb = d[2] > 0.5; let x = [d[6], d[7], d[8]];
        Contacto { a: d[0] as usize, b, wb: if tiene_wb { Some(x) } else { None }, ra: [d[3], d[4], d[5]], rb: x, n: [d[9], d[10], d[11]], depth: d[12], lam: d[13], vn_pre: d[14],
            activo: d[15] > 0.5, hit: d[16] > 0.5, hit_nuevo: false, hit_p: [0.0; 3], hit_vn: 0.0, g_ra: [0.0; 3], g_rb: [0.0; 3], g_w: f64::NAN }
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

/// de dónde salen los cuerpos: el arreglo entero (un hilo) o la vista que comparten los hilos (cada uno toca sólo los
/// cuerpos que le tocan en ese momento; las cuentas son las mismas)
trait Cs {
    fn g(&self, i: usize) -> &Cuerpo;
    fn m(&mut self, i: usize) -> &mut Cuerpo;
    fn largo(&self) -> usize;
    /// dos cuerpos a la vez (a y b distintos)
    fn dos(&mut self, i: usize, j: usize) -> (&mut Cuerpo, &mut Cuerpo);
}
impl Cs for [Cuerpo] {
    #[inline] fn g(&self, i: usize) -> &Cuerpo { &self[i] }
    #[inline] fn m(&mut self, i: usize) -> &mut Cuerpo { &mut self[i] }
    #[inline] fn largo(&self) -> usize { self.len() }
    #[inline] fn dos(&mut self, i: usize, j: usize) -> (&mut Cuerpo, &mut Cuerpo) {
        if i < j { let (x, y) = self.split_at_mut(j); (&mut x[i], &mut y[0]) } else { let (x, y) = self.split_at_mut(i); (&mut y[0], &mut x[j]) }
    }
}

/// velocidad normal del contacto (contactVn)
fn contacto_vn<C: Cs + ?Sized>(cs: &C, c: &Contacto) -> f64 {
    let a = cs.g(c.a); let r = rot(a.q, c.ra); let va = add(a.vel, cruz(a.ang, r));
    if c.wb.is_some() { return dot(va, c.n); }
    let b = cs.g(c.b.unwrap()); let rb = rot(b.q, c.rb); let vb = add(b.vel, cruz(b.ang, rb));
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

fn resolver_union<C: Cs + ?Sized>(cs: &mut C, j: &Union) {
    if j.a == j.b || j.a >= cs.largo() || j.b >= cs.largo() { return; }
    let (a, b) = cs.dos(j.a, j.b);
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

fn resolver_contacto_pos<C: Cs + ?Sized>(cs: &mut C, c: &mut Contacto, h: f64) {
    let a0 = cs.g(c.a);
    let ra = rot(a0.q, c.ra); let pa = add(a0.pos, ra);
    let (rb, pb) = match (c.wb, c.b) { (Some(w), _) => (None, w), (None, Some(bi)) => { let b = cs.g(bi); let r = rot(b.q, c.rb); (Some(r), add(b.pos, r)) } _ => return };
    let n = c.n; let sep = dot(sub(pa, pb), n);
    if sep >= 0.0 { c.activo = false; return; }
    c.activo = true;
    if !c.hit && c.vn_pre < -2.2 { c.hit = true; c.hit_nuevo = true; c.hit_p = pa; c.hit_vn = c.vn_pre; }
    let bi = if rb.is_some() { c.b } else { None };
    let wa = cs.g(c.a).w_at(ra, n); let wb = match (rb, bi) { (Some(r), Some(b)) => cs.g(b).w_at(r, n), _ => 0.0 }; let w = wa + wb; if w < 1e-9 { return; }
    let dl = (-sep).min(MAXDEP * h + (-sep - c.depth.max(0.0)).max(0.0)) / w; c.lam += dl;
    let p = esc(n, dl);
    cs.m(c.a).aplicar_pos(p, ra, 1.0); if let (Some(r), Some(b)) = (rb, bi) { if b != c.a { cs.m(b).aplicar_pos(p, r, -1.0); } }
    // fricción (si A o B no se mueve, su giro quedó igual: el mismo punto, sin volver a girarlo)
    let a = cs.g(c.a);
    let r0 = rot(a.pq, c.ra); let a0p = add(a.ppos, r0);
    let mut b0 = pb;
    if let Some(b) = bi { let bb = cs.g(b); let q0 = rot(bb.pq, c.rb); b0 = add(bb.ppos, q0); }
    let ra2 = if a.despierto() { rot(a.q, c.ra) } else { ra };
    let rb2 = bi.map(|b| { let bb = cs.g(b); if bb.despierto() && b != c.a || b == c.a && a.despierto() { rot(bb.q, c.rb) } else { rb.unwrap() } });
    let a1 = add(a.pos, ra2); let b1 = match (bi, rb2) { (Some(b), Some(r)) => add(cs.g(b).pos, r), _ => pb };
    let d = sub(sub(a1, a0p), sub(b1, b0)); let dn = dot(d, n);
    let t = sub(d, esc(n, dn)); let tl = largo(t);
    if tl > 1e-9 {
        let fb = match c.b { Some(b) => cs.g(b).fric, None => 0.7 };
        let mu = (a.fric * fb).sqrt(); let t = esc(t, 1.0 / tl);
        let wt = a.w_at(ra2, t) + match (bi, rb2) { (Some(b), Some(r)) => cs.g(b).w_at(r, t), _ => 0.0 };
        if wt > 1e-9 {
            let mut dlt = tl / wt; let lim = mu * c.lam;
            if dlt > lim * 1.25 { dlt = lim * 0.9; }
            let pt = esc(t, -dlt); cs.m(c.a).aplicar_pos(pt, ra2, 1.0); if let (Some(b), Some(r)) = (bi, rb2) { if b != c.a { cs.m(b).aplicar_pos(pt, r, -1.0); } }
        }
    }
}

/// (otra: no es la primera vuelta del subpaso; las velocidades no cambian los giros, así que los puntos girados y la masa
/// en la normal son los de la primera)
fn resolver_contacto_vel<C: Cs + ?Sized>(cs: &mut C, c: &mut Contacto, otra: bool) {
    if !c.activo { return; }
    let a = cs.g(c.a);
    let n = c.n; let bi = if c.wb.is_some() { None } else { c.b };
    let (ra, rb) = if otra { (c.g_ra, bi.map(|_| c.g_rb)) } else {
        let ra = rot(a.q, c.ra); let rb = bi.map(|b| rot(cs.g(b).q, c.rb));
        c.g_ra = ra; if let Some(r) = rb { c.g_rb = r; } c.g_w = f64::NAN; (ra, rb)
    };
    // (contactVn con los mismos puntos ya girados)
    let va = add(a.vel, cruz(a.ang, ra));
    let vn = match (bi, rb) { (Some(b), Some(r)) => { let b = cs.g(b); let vb = add(b.vel, cruz(b.ang, r)); dot(sub(va, vb), n) } _ => if c.wb.is_some() { dot(va, n) } else { contacto_vn(cs, c) } };
    let e = if c.vn_pre > -BOUNCE_V { 0.0 } else { a.rest.max(match c.b { Some(b) => cs.g(b).rest, None => 0.2 }) };
    let target = (-e * c.vn_pre).max(0.0); let dv = target - vn;
    if dv.abs() < 1e-6 { return; }
    let w = if otra && !c.g_w.is_nan() { c.g_w } else { let w = a.w_at(ra, n) + match (bi, rb) { (Some(b), Some(r)) => cs.g(b).w_at(r, n), _ => 0.0 }; c.g_w = w; w };
    if w < 1e-9 { return; }
    let s = dv / w; let p = esc(n, s);
    cs.m(c.a).aplicar_vel(p, ra, 1.0); if let (Some(b), Some(r)) = (bi, rb) { if b != c.a { cs.m(b).aplicar_vel(p, r, -1.0); } }
}

/// los subpasos de un paso de física (lo de adentro del `for (let s = 0; s < n; s++)` de physStep)
pub fn paso(cu: &mut [f64], co: &mut [f64], un: &[f64], dt: f64, n: usize, gscale: f64, vel_iter: usize) -> usize {
    paso_con(cu, co, un, dt, n, gscale, vel_iter, None, usize::MAX)
}

/// lo mismo, con un equipo de hilos si hay (y por lo menos `min_paralelo` contactos que resolver): da lo mismo, bit por
/// bit, que un hilo solo
pub fn paso_con(cu: &mut [f64], co: &mut [f64], un: &[f64], dt: f64, n: usize, gscale: f64, vel_iter: usize, equipo: Option<&Equipo>, min_paralelo: usize) -> usize {
    let mut cs: Vec<Cuerpo> = cu.chunks_exact(CU).map(Cuerpo::leer).collect();
    let mut cts: Vec<Contacto> = co.chunks_exact(CO).map(Contacto::leer).filter(|c| c.a < cs.len() && c.b.map_or(true, |b| b < cs.len())).collect();
    let us: Vec<Union> = un.chunks_exact(UN).map(Union::leer).collect();
    let n = n.max(1); let h = dt / n as f64;
    let hecho = match equipo { Some(e) if e.hilos() > 1 && cts.len() >= min_paralelo => paralelo::resolver(e, &mut cs, &mut cts, &us, h, n, gscale, vel_iter), _ => false };
    if !hecho { resolver_seq(&mut cs, &mut cts, &us, h, n, gscale, vel_iter); }
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

/// integrar un cuerpo (el comienzo de cada subpaso)
#[inline] fn integrar_cuerpo(b: &mut Cuerpo, h: f64, gscale: f64) {
    b.ppos = b.pos; b.pq = b.q;
    if !b.agarrado { b.vel[1] -= GRAV * gscale * h; }
    b.pos = add(b.pos, esc(b.vel, h));
    b.q = integrar(b.q, b.ang, h);
}
/// la velocidad que dejó el subpaso
#[inline] fn velocidad_cuerpo(b: &mut Cuerpo, h: f64) {
    b.vel = esc(sub(b.pos, b.ppos), 1.0 / h);
    let pq = b.pq; let dq = qmul(b.q, [-pq[0], -pq[1], -pq[2], pq[3]]);
    let k = (if dq[3] >= 0.0 { 2.0 } else { -2.0 }) / h; b.ang = [dq[0] * k, dq[1] * k, dq[2] * k];
}

/// los subpasos en un hilo, en el orden de physStep
fn resolver_seq(cs: &mut [Cuerpo], cts: &mut [Contacto], us: &[Union], h: f64, n: usize, gscale: f64, vel_iter: usize) {
    let nb = cs.len(); resolver_rango(cs, 0..nb, cts, us, h, n, gscale, vel_iter);
}
/// el bucle de subpasos sobre los cuerpos `cuerpos` (los demás que miren los contactos no se mueven) y estos contactos y
/// uniones
fn resolver_rango<C: Cs + ?Sized>(cs: &mut C, cuerpos: std::ops::Range<usize>, cts: &mut [Contacto], us: &[Union], h: f64, n: usize, gscale: f64, vel_iter: usize) {
    for _ in 0..n {
        for i in cuerpos.clone() { let b = cs.m(i); if b.despierto() { integrar_cuerpo(b, h, gscale); } }
        for c in cts.iter_mut() { c.vn_pre = contacto_vn(cs, c); }
        for j in us { resolver_union(cs, j); }
        for c in cts.iter_mut() {
            let ok = cs.g(c.a).despierto() || c.b.map_or(false, |b| cs.g(b).despierto());
            if ok { resolver_contacto_pos(cs, c, h); }
        }
        for i in cuerpos.clone() { let b = cs.m(i); if b.despierto() { velocidad_cuerpo(b, h); } }
        for it in 0..vel_iter.max(1) { for c in cts.iter_mut() { resolver_contacto_vel(cs, c, it > 0); } }
        for c in cts.iter_mut() { c.lam = 0.0; }
    }
}

// ---- los hilos: un equipo fijo (crear hilos en cada paso cuesta más que el paso) ----
#[cfg(not(target_arch = "wasm32"))]
mod equipo {
    use std::cell::UnsafeCell;
    use std::sync::atomic::{AtomicBool, AtomicU64, Ordering::*};
    use std::sync::{Arc, Condvar, Mutex};
    use std::time::{Duration, Instant};
    /// el trabajo que se está haciendo (sin su tiempo de vida: `correr` no vuelve hasta que terminaron los que se sumaron)
    type Trabajo = *const (dyn Fn(usize) + Sync);
    /// (estado: la vuelta en los 32 bits de arriba, «cerrado» en el bit 31 y cuántos están trabajando en los de abajo)
    const CERRADO: u64 = 1 << 31;
    struct Comun { trabajo: UnsafeCell<Option<Trabajo>>, estado: AtomicU64, avisos: AtomicU64, salir: AtomicBool, dormidos: Mutex<usize>, despertar: Condvar }
    unsafe impl Sync for Comun {}
    unsafe impl Send for Comun {}
    /// un equipo de hilos que esperan trabajo (un rato girando, después dormidos). Cada trabajo lo empieza el que llama y
    /// se suman los que estén listos mientras tanto: el trabajo se tiene que repartir solo (cada uno toma lo que queda),
    /// así un hilo que tarda en despertarse no hace esperar a nadie
    pub struct Equipo { comun: Arc<Comun>, hilos: Vec<std::thread::JoinHandle<()>> }
    impl Equipo {
        /// con n hilos en total (el que llama y n − 1 más)
        pub fn nuevo(n: usize) -> Equipo {
            let comun = Arc::new(Comun { trabajo: UnsafeCell::new(None), estado: AtomicU64::new(CERRADO), avisos: AtomicU64::new(0), salir: AtomicBool::new(false), dormidos: Mutex::new(0), despertar: Condvar::new() });
            let hilos = (1..n.max(1)).map(|i| { let c = comun.clone(); std::thread::Builder::new().name(format!("jxfisica{i}")).spawn(move || trabajador(&c, i)).expect("hilo de la física") }).collect();
            Equipo { comun, hilos }
        }
        pub fn hilos(&self) -> usize { self.hilos.len() + 1 }
        /// que los dormidos se despierten y esperen girando un rato: viene trabajo (despertar uno dormido tarda)
        pub fn despertar(&self) {
            // (la cuenta de dormidos, con el candado: el que se va a dormir mira los avisos con el candado tomado)
            let c = &*self.comun; c.avisos.fetch_add(1, SeqCst);
            let d = c.dormidos.lock().unwrap(); if *d > 0 { c.despertar.notify_all(); }
        }
        /// corre f(0) en este hilo y f(i) en cada hilo i que se sume antes de que termine; vuelve cuando terminaron todos
        /// los que se sumaron
        pub fn correr(&self, f: &(dyn Fn(usize) + Sync)) {
            if self.hilos.is_empty() { return f(0); }
            let c = &*self.comun;
            // (el puntero vive hasta que los que se sumaron terminan, antes de salir de acá)
            let t: Trabajo = unsafe { std::mem::transmute::<*const (dyn Fn(usize) + Sync + '_), Trabajo>(f as *const _) };
            unsafe { *c.trabajo.get() = Some(t); }
            let vuelta = (c.estado.load(Acquire) >> 32).wrapping_add(1) & 0xffff_ffff;
            c.estado.store(vuelta << 32, SeqCst);
            { let d = c.dormidos.lock().unwrap(); if *d > 0 { c.despertar.notify_all(); } }
            f(0);
            // cerrar (ya no se suma nadie) y esperar a los que están
            let t0 = Instant::now();
            c.estado.fetch_or(CERRADO, SeqCst);
            while c.estado.load(Acquire) & (CERRADO - 1) != 0 { if t0.elapsed() < Duration::from_millis(2) { std::hint::spin_loop(); } else { std::thread::yield_now(); } }
            unsafe { *c.trabajo.get() = None; }
        }
    }
    fn trabajador(c: &Comun, i: usize) {
        let (mut vista, mut aviso) = (0u64, 0u64);
        loop {
            // esperar una vuelta nueva: girando un rato (0,3 ms, o 1,5 ms si avisaron que viene trabajo), después dormido
            let mut t0 = Instant::now(); let mut espera = Duration::from_micros(300);
            let nueva = |e: u64| e >> 32 != vista && e & CERRADO == 0;
            loop {
                if c.salir.load(Acquire) { return; }
                if nueva(c.estado.load(Acquire)) { break; }
                let a = c.avisos.load(Acquire); if a != aviso { aviso = a; t0 = Instant::now(); espera = Duration::from_micros(1500); }
                if t0.elapsed() < espera { std::hint::spin_loop(); continue; }
                let mut d = c.dormidos.lock().unwrap(); *d += 1;
                while !nueva(c.estado.load(SeqCst)) && c.avisos.load(SeqCst) == aviso && !c.salir.load(Acquire) { d = c.despertar.wait_timeout(d, Duration::from_millis(50)).unwrap().0; }
                *d -= 1; drop(d);
                t0 = Instant::now();
            }
            // sumarse, si todavía está abierto
            let mut e = c.estado.load(Acquire);
            let sumado = loop {
                if e & CERRADO != 0 { break false; }
                match c.estado.compare_exchange_weak(e, e + 1, AcqRel, Acquire) { Ok(_) => break true, Err(x) => e = x }
            };
            vista = e >> 32;
            if !sumado { continue; }
            let t = unsafe { (*c.trabajo.get()).expect("trabajo") };
            unsafe { (*t)(i); }
            c.estado.fetch_sub(1, Release);
        }
    }
    impl Drop for Equipo {
        fn drop(&mut self) {
            self.comun.salir.store(true, Release);
            { let _d = self.comun.dormidos.lock().unwrap(); self.comun.despertar.notify_all(); }
            for h in self.hilos.drain(..) { let _ = h.join(); }
        }
    }
}
#[cfg(not(target_arch = "wasm32"))]
pub use equipo::Equipo;
/// (en WebAssembly no hay hilos: un equipo de uno)
#[cfg(target_arch = "wasm32")]
pub struct Equipo;
#[cfg(target_arch = "wasm32")]
impl Equipo {
    pub fn nuevo(_n: usize) -> Equipo { Equipo }
    pub fn hilos(&self) -> usize { 1 }
    pub fn despertar(&self) {}
    pub fn correr(&self, f: &(dyn Fn(usize) + Sync)) { f(0) }
}

/// los subpasos repartidos entre hilos sin cambiar ni una cuenta: por islas (los cuerpos que se tocan entre sí, por
/// contactos o uniones). Cada operación del bucle (integrar, la velocidad normal de cada contacto, cada unión, cada
/// contacto, la velocidad, las vueltas de velocidades) lee y cambia sólo sus dos cuerpos, y los que no se mueven en todo
/// el paso (fijos, congelados, dormidos sin uniones: `applyRot` gira a los dinámicos con uniones aunque duerman) sólo se
/// leen; así que cada isla, resuelta sola con el mismo bucle y sus contactos y uniones en el orden de siempre, le hace a
/// cada cuerpo exactamente las mismas cuentas en el mismo orden que el bucle de todos. Las islas se reparten en tandas parejas
/// y cada hilo toma tandas enteras (sin esperar a nadie); con una isla que es casi todo, no vale la pena y se resuelve en
/// un hilo
mod paralelo {
    use super::*;
    /// la vista de los cuerpos que comparten los hilos: cada uno cambia sólo los de sus islas
    struct Vista { p: *mut Cuerpo, n: usize }
    impl Cs for Vista {
        #[inline] fn g(&self, i: usize) -> &Cuerpo { assert!(i < self.n); unsafe { &*self.p.add(i) } }
        #[inline] fn m(&mut self, i: usize) -> &mut Cuerpo { assert!(i < self.n); unsafe { &mut *self.p.add(i) } }
        #[inline] fn largo(&self) -> usize { self.n }
        #[inline] fn dos(&mut self, i: usize, j: usize) -> (&mut Cuerpo, &mut Cuerpo) { assert!(i != j && i < self.n && j < self.n); unsafe { (&mut *self.p.add(i), &mut *self.p.add(j)) } }
    }
    /// lo de cada hilo: sus cuerpos (seguidos), sus contactos y sus uniones (seguidos, en el orden de siempre)
    struct Partes { cs: *mut Cuerpo, ncs: usize, cts: *mut Contacto, us: *const Union, rangos: Vec<[usize; 6]> }
    unsafe impl Sync for Partes {}
    /// devuelve false si no vale la pena (y no tocó nada)
    pub(super) fn resolver(eq: &Equipo, cs0: &mut [Cuerpo], cts0: &mut [Contacto], us0: &[Union], h: f64, n: usize, gscale: f64, vel_iter: usize) -> bool {
        let nb = cs0.len(); let nh = eq.hilos(); let vi = vel_iter.max(1);
        let union_ok = |j: &Union| j.a != j.b && j.a < nb && j.b < nb;
        // quiénes se mueven en el paso: los despiertos y los dinámicos con uniones
        let mut mov: Vec<bool> = cs0.iter().map(|b| b.despierto()).collect();
        for j in us0 { if union_ok(j) { mov[j.a] |= cs0[j.a].din; mov[j.b] |= cs0[j.b].din; } }
        // los cuerpos que se mueven de cada contacto y unión (el de B sólo si el contacto lo mira: sin punto fijo)
        let toca = |a: usize, b: Option<usize>| -> [u32; 2] {
            let mut x = [u32::MAX; 2]; let mut k = 0;
            if mov[a] { x[0] = a as u32; k = 1; }
            if let Some(b) = b { if b != a && mov[b] { x[k] = b as u32; } }
            x
        };
        let t_ct: Vec<[u32; 2]> = cts0.iter().map(|c| toca(c.a, if c.wb.is_some() { None } else { c.b })).collect();
        let t_un: Vec<[u32; 2]> = us0.iter().map(|j| if union_ok(j) { toca(j.a, Some(j.b)) } else { [u32::MAX; 2] }).collect();
        // las islas y su trabajo (más o menos: cuántas operaciones por subpaso)
        let mut pa: Vec<u32> = (0..nb as u32).collect();
        fn raiz(p: &mut [u32], mut x: u32) -> u32 { while p[x as usize] != x { let q = p[p[x as usize] as usize]; p[x as usize] = q; x = q; } x }
        for x in t_ct.iter().chain(t_un.iter()) { if x[1] != u32::MAX { let (r0, r1) = (raiz(&mut pa, x[0]), raiz(&mut pa, x[1])); if r0 != r1 { pa[r0 as usize] = r1; } } }
        let mut peso = vec![0u64; nb];
        for i in 0..nb { if mov[i] { let r = raiz(&mut pa, i as u32) as usize; peso[r] += 2; } }
        for x in &t_ct { if x[0] != u32::MAX { let r = raiz(&mut pa, x[0]) as usize; peso[r] += 3 + vi as u64; } }
        for x in &t_un { if x[0] != u32::MAX { let r = raiz(&mut pa, x[0]) as usize; peso[r] += 4; } }
        let total: u64 = peso.iter().sum();
        let mut islas: Vec<usize> = (0..nb).filter(|&i| mov[i] && raiz(&mut pa, i as u32) as usize == i).collect();
        if islas.len() < 2 { return false; }
        // a cada hilo, la isla más pesada que queda al que tiene menos (si el más cargado se lleva casi todo, no vale la pena)
        islas.sort_by(|&a, &b| peso[b].cmp(&peso[a]).then(a.cmp(&b)));
        let mut carga = vec![0u64; nh]; let mut hilo_de = vec![u32::MAX; nb];
        for &r in &islas { let t = (0..nh).min_by_key(|&t| (carga[t], t)).unwrap(); hilo_de[r] = t as u32; carga[t] += peso[r]; }
        if *carga.iter().max().unwrap() * 10 > total * 8 { return false; }
        let hilo = |i: usize, p: &mut [u32]| -> u32 { if mov[i] { hilo_de[raiz(p, i as u32) as usize] } else { u32::MAX } };
        let quien: Vec<u32> = (0..nb).map(|i| hilo(i, &mut pa)).collect();
        // todo en otro orden: lo de cada hilo junto (los cuerpos quietos al final, para todos), cada cosa en su orden de siempre
        let mut viejo: Vec<u32> = (0..nb as u32).collect(); viejo.sort_by_key(|&i| (quien[i as usize], i));
        let mut nuevo = vec![0u32; nb]; for (k, &i) in viejo.iter().enumerate() { nuevo[i as usize] = k as u32; }
        let mut cs: Vec<Cuerpo> = viejo.iter().map(|&i| cs0[i as usize]).collect();
        let de_ct = |k: usize| if t_ct[k][0] == u32::MAX { u32::MAX } else { quien[t_ct[k][0] as usize] };
        let mut ct_viejo: Vec<u32> = (0..cts0.len() as u32).collect(); ct_viejo.sort_by_key(|&k| (de_ct(k as usize), k));
        let mut cts: Vec<Contacto> = ct_viejo.iter().map(|&k| { let mut c = cts0[k as usize]; c.a = nuevo[c.a] as usize; c.b = c.b.map(|b| nuevo[b] as usize); c }).collect();
        // (las uniones que no mueven nada no hacen nada: quedan afuera)
        let mut un_viejo: Vec<u32> = (0..us0.len() as u32).filter(|&k| t_un[k as usize][0] != u32::MAX).collect(); un_viejo.sort_by_key(|&k| (quien[t_un[k as usize][0] as usize], k));
        let us: Vec<Union> = un_viejo.iter().map(|&k| { let j = us0[k as usize]; Union { a: nuevo[j.a] as usize, b: nuevo[j.b] as usize, ..j } }).collect();
        // los tramos de cada hilo
        let tramo = |v: &[u32], f: &dyn Fn(u32) -> u32, t: u32| -> [usize; 2] { [v.partition_point(|&x| f(x) < t), v.partition_point(|&x| f(x) <= t)] };
        let rangos: Vec<[usize; 6]> = (0..nh as u32).map(|t| {
            let b = tramo(&viejo, &|i| quien[i as usize], t); let c = tramo(&ct_viejo, &|k| de_ct(k as usize), t); let u = tramo(&un_viejo, &|k| quien[t_un[k as usize][0] as usize], t);
            [b[0], b[1], c[0], c[1], u[0], u[1]]
        }).collect();
        // (las velocidades normales de contactos sin nada que se mueva: las mismas en todos los subpasos)
        let sin_mov = rangos[nh - 1][3];
        for k in sin_mov..cts.len() { let v = contacto_vn(&cs[..], &cts[k]); cts[k].vn_pre = v; }
        let partes = Partes { cs: cs.as_mut_ptr(), ncs: nb, cts: cts.as_mut_ptr(), us: us.as_ptr(), rangos };
        let partes = &partes; let sig = std::sync::atomic::AtomicUsize::new(0);
        // (cada tanda de islas la toma el primero que esté libre: si un hilo tarda en despertarse, lo hace otro)
        eq.correr(&|_: usize| loop {
            let t = sig.fetch_add(1, std::sync::atomic::Ordering::Relaxed); if t >= partes.rangos.len() { break; }
            let [b0, b1, c0, c1, u0, u1] = partes.rangos[t];
            if b0 == b1 { continue; }
            let mut vista = Vista { p: partes.cs, n: partes.ncs };
            // (sus contactos y uniones son sólo suyos: tramos que no se pisan)
            let cts = unsafe { std::slice::from_raw_parts_mut(partes.cts.add(c0), c1 - c0) };
            let us = unsafe { std::slice::from_raw_parts(partes.us.add(u0), u1 - u0) };
            resolver_rango(&mut vista, b0..b1, cts, us, h, n, gscale, vel_iter);
        });
        // de vuelta a su lugar (los contactos con sus cuerpos de siempre)
        for (k, &i) in viejo.iter().enumerate() { cs0[i as usize] = cs[k]; }
        let mut ct_nuevo = vec![0u32; cts0.len()]; for (k, &i) in ct_viejo.iter().enumerate() { ct_nuevo[i as usize] = k as u32; }
        for (k, c) in cts0.iter_mut().enumerate() { let (a, b) = (c.a, c.b); *c = cts[ct_nuevo[k] as usize]; c.a = a; c.b = b; c.lam = 0.0; }
        true
    }
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
