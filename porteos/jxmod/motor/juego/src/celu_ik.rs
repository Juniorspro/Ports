//! El celular en la mano (celumano.js): en primera persona la mano derecha de la vista «Hands» sostiene un celular 3D (la
//! palma atrás, los dedos rodean el borde de la izquierda y el pulgar va por el de la derecha) y en tercera persona el
//! brazo derecho del personaje lo sostiene delante del pecho, la pantalla mirando a la cara. El brazo va con cinemática
//! inversa (hombro, codo, muñeca) y cada dedo se dobla hasta tocar el celular, con las medidas del propio esqueleto.
//! Las cuentas son las de la web; el esqueleto es cualquiera que cumpla `Esqueleto` (la vista y los personajes).
pub type V = [f32; 3];
pub type Q = [f32; 4];

/// el celular (en metros, de verdad): 7,2 × 15 × 0,78 cm, la pantalla casi de punta a punta
pub const CELM_W: f32 = 0.072; pub const CELM_H: f32 = 0.15; pub const CELM_D: f32 = 0.0078; pub const CELM_SW: f32 = 0.066; pub const CELM_SH: f32 = 0.137; pub const CELM_SY: f32 = 0.0005;
pub const DEDOS: [&str; 4] = ["Index", "Middle", "Ring", "Pinky"];

/// lo que hace falta de un esqueleto: el número de un hueso por nombre (el humano, sin el prefijo de Mixamo), dónde está
/// y su giro en el mundo, su giro local y rehacer las matrices
pub trait Esqueleto {
    fn idx(&self, n: &str) -> Option<usize>;
    fn pos(&self, i: usize) -> V;
    fn qmundo(&self, i: usize) -> Q;
    fn qpadre(&self, i: usize) -> Q;
    fn r(&self, i: usize) -> Q;
    fn poner_r(&mut self, i: usize, q: Q);
    fn actualizar(&mut self);
    /// el giro de reposo de una articulación (si se sabe): los dedos se calculan desde ahí
    fn reposo_r(&self, _i: usize) -> Option<Q> { None }
}
/// el celular en el mundo: centro y ejes (r: derecha de la pantalla, u: arriba, n: sale de la pantalla hacia el que mira) y
/// la escala (t: el tamaño del personaje)
#[derive(Clone, Copy, Debug, Default)]
pub struct Pose { pub c: V, pub r: V, pub u: V, pub n: V, pub t: f32 }

#[inline] pub fn add(a: V, b: V) -> V { [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
#[inline] pub fn sub(a: V, b: V) -> V { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
#[inline] pub fn esc(a: V, k: f32) -> V { [a[0] * k, a[1] * k, a[2] * k] }
#[inline] pub fn dot(a: V, b: V) -> f32 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
#[inline] pub fn cruz(a: V, b: V) -> V { [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
#[inline] pub fn largo(a: V) -> f32 { dot(a, a).sqrt() }
pub fn norm(a: V) -> V { let l = largo(a); if l > 0.0 { esc(a, 1.0 / l) } else { a } }
pub fn qeje(e: V, a: f32) -> Q { let n = norm(e); let s = (a / 2.0).sin(); [n[0] * s, n[1] * s, n[2] * s, (a / 2.0).cos()] }
pub fn qmul(a: Q, b: Q) -> Q { [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]] }
pub fn qconj(q: Q) -> Q { [-q[0], -q[1], -q[2], q[3]] }
pub fn qnorm(q: Q) -> Q { let l = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt(); if l > 0.0 { [q[0] / l, q[1] / l, q[2] / l, q[3] / l] } else { [0.0, 0.0, 0.0, 1.0] } }
pub fn qrot(q: Q, v: V) -> V { let u = [q[0], q[1], q[2]]; let t = esc(cruz(u, v), 2.0); add(add(v, esc(t, q[3])), cruz(u, t)) }
/// qBase: el giro de una base (sus columnas)
pub fn q_base(x: V, y: V, z: V) -> Q {
    let (m00, m11, m22) = (x[0], y[1], z[2]); let tr = m00 + m11 + m22;
    let q = if tr > 0.0 { let s = (tr + 1.0).sqrt() * 2.0; [(y[2] - z[1]) / s, (z[0] - x[2]) / s, (x[1] - y[0]) / s, 0.25 * s] }
        else if m00 > m11 && m00 > m22 { let s = (1.0 + m00 - m11 - m22).sqrt() * 2.0; [0.25 * s, (y[0] + x[1]) / s, (z[0] + x[2]) / s, (y[2] - z[1]) / s] }
        else if m11 > m22 { let s = (1.0 + m11 - m00 - m22).sqrt() * 2.0; [(y[0] + x[1]) / s, 0.25 * s, (z[1] + y[2]) / s, (z[0] - x[2]) / s] }
        else { let s = (1.0 + m22 - m00 - m11).sqrt() * 2.0; [(z[0] + x[2]) / s, (z[1] + y[2]) / s, 0.25 * s, (x[1] - y[0]) / s] };
    qnorm(q)
}
/// celmDesde: el giro más corto que lleva la dirección a a la b
pub fn desde(a: V, b: V) -> Q {
    let c = cruz(a, b); let d = dot(a, b).clamp(-1.0, 1.0); let s = largo(c);
    if s < 1e-8 { return if d > 0.0 { [0.0, 0.0, 0.0, 1.0] } else { qeje(if a[0].abs() < 0.9 { [1.0, 0.0, 0.0] } else { [0.0, 1.0, 0.0] }, std::f32::consts::PI) }; }
    qeje(c, s.atan2(d))
}
/// un punto del celular (x a la derecha, y arriba, z hacia el que mira) al mundo
pub fn punto(p: &Pose, x: f32, y: f32, z: f32) -> V { add(p.c, add(esc(p.r, x), add(esc(p.u, y), esc(p.n, z)))) }

/// celmPonerQ: el giro de mundo de un hueso (el local sale del padre)
pub fn poner_q<E: Esqueleto + ?Sized>(md: &mut E, i: usize, qw: Q) { let qp = md.qpadre(i); md.poner_r(i, qnorm(qmul(qconj(qp), qw))); md.actualizar(); }
/// celmGirar: gira un hueso en el mundo
pub fn girar<E: Esqueleto + ?Sized>(md: &mut E, i: usize, qd: Q) { let q = qnorm(qmul(qd, md.qmundo(i))); poner_q(md, i, q); }

/// celmDedos: los dedos se juntan casi paralelos al mayor y cada uno se dobla (las tres falanges) hasta quedar apoyado en la
/// espalda del celular; el pulgar va por fuera del borde derecho, a la altura del canto. Devuelve cuánto se dobló cada uno
pub fn dedos<E: Esqueleto + ?Sized>(md: &mut E, p: &Pose, ft: V, nt: V, st: V, t: f32) -> [f32; 4] {
    let eje = norm(cruz(ft, nt)); let mut out = [0.0; 4];
    let grosor = |d: &str| match d { "Index" => 0.0085, "Middle" => 0.0088, "Ring" => 0.0082, _ => 0.0072 };
    let abre = |d: &str| match d { "Index" => 0.07, "Middle" => 0.0, "Ring" => -0.07, _ => -0.15 };
    let signo = if dot(cruz(ft, st), nt) >= 0.0 { 1.0 } else { -1.0 };
    for d in DEDOS {
        let (Some(a1), Some(a2)) = (md.idx(&format!("RightHand{d}1")), md.idx(&format!("RightHand{d}2"))) else { continue };
        let dir = sub(md.pos(a2), md.pos(a1)); let dp = norm(sub(dir, esc(nt, dot(dir, nt))));
        let meta = qrot(qeje(nt, abre(d) * signo), ft);
        girar(md, a1, desde(dp, meta));
    }
    for (kd, d) in DEDOS.iter().enumerate() {
        let j: Vec<Option<usize>> = (1..=3).map(|k| md.idx(&format!("RightHand{d}{k}"))).collect(); let tip = md.idx(&format!("RightHand{d}4"));
        if j.iter().any(|x| x.is_none()) { continue; } let j: Vec<usize> = j.into_iter().flatten().collect();
        let r0: Vec<Q> = j.iter().map(|&x| md.r(x)).collect(); let zt = -(CELM_D / 2.0 + grosor(d)) * t;
        let mut puntos = vec![j[1], j[2]]; if let Some(tp) = tip { puntos.push(tp); }
        let (mut mejor, mut err) = (0.0f32, 1e9f32);
        let k3 = [0.35f32, 1.0, 0.8];
        let mut ang = -0.9f32;
        while ang <= 1.0 + 1e-6 {
            for k in 0..3 { md.poner_r(j[k], r0[k]); } md.actualizar();
            for k in 0..3 { girar(md, j[k], qeje(eje, ang * k3[k])); }
            let mut e = 0.0; for &x in &puntos { let lz = dot(sub(md.pos(x), p.c), p.n); e += (lz - zt) * (lz - zt); }
            if e < err { err = e; mejor = ang; }
            ang += 0.025;
        }
        for k in 0..3 { md.poner_r(j[k], r0[k]); } md.actualizar();
        for k in 0..3 { girar(md, j[k], qeje(eje, mejor * k3[k])); }
        out[kd] = (mejor * 1000.0).round() / 1000.0;
    }
    // el pulgar: la punta a un punto del canto derecho que esté justo a su largo
    let t1 = md.idx("RightHandThumb1"); let t4 = md.idx("RightHandThumb4").or(md.idx("RightHandThumb3"));
    if let (Some(t1), Some(t4)) = (t1, t4) {
        let b1 = md.pos(t1); let l = largo(sub(b1, md.pos(t4))); let d1 = sub(b1, p.c); let (x1, y1, z1) = (dot(d1, p.r), dot(d1, p.u), dot(d1, p.n));
        let (xe, ze) = ((CELM_W / 2.0 + 0.009) * t, -0.001 * t); let q2 = l * l - (xe - x1) * (xe - x1) - (ze - z1) * (ze - z1);
        let ye = if q2 > 0.0 { (y1 + q2.sqrt()).min(CELM_H * 0.45 * t) } else { -CELM_H * 0.08 * t };
        let meta = punto(p, xe, ye, ze);
        girar(md, t1, desde(norm(sub(md.pos(t4), b1)), norm(sub(meta, b1))));
    }
    out
}
/// celmExceso: cuánto entra la mano en el celular (cada articulación de los dedos y la muñeca que cae sobre él, con su grosor)
pub fn exceso<E: Esqueleto + ?Sized>(md: &E, p: &Pose, t: f32) -> f32 {
    let mut ex = 0.0f32;
    let mut ver = |i: Option<usize>, r: f32| { let Some(i) = i else { return }; let d = sub(md.pos(i), p.c); let (x, y, z) = (dot(d, p.r) / t, dot(d, p.u) / t, dot(d, p.n) / t); if x.abs() < CELM_W / 2.0 && y.abs() < CELM_H / 2.0 { ex = ex.max(z + r + CELM_D / 2.0); } };
    for d in DEDOS.iter().chain(["Thumb"].iter()) { for k in 1..=4 { ver(md.idx(&format!("RightHand{d}{k}")), if *d == "Thumb" { 0.009 } else { 0.008 }); } }
    ver(md.idx("RightHand"), 0.014);
    ex * t
}
/// los dos huesos del brazo hasta la muñeca `wrist`, el codo hacia `polo` (la cinemática inversa de celmPosar y celmBrazo3p)
pub fn brazo<E: Esqueleto + ?Sized>(md: &mut E, sh: usize, el: usize, hand: usize, wrist: V, polo: V) {
    let (a, b) = (largo(sub(md.pos(sh), md.pos(el))), largo(sub(md.pos(el), md.pos(hand))));
    let s = md.pos(sh); let dw = sub(wrist, s); let dist = largo(dw).min((a + b) * 0.999); let dn = norm(dw);
    let cos_a = ((a * a + dist * dist - b * b) / (2.0 * a * dist)).clamp(-1.0, 1.0); let alto = a * (1.0 - cos_a * cos_a).sqrt();
    let lado = norm(sub(polo, esc(dn, dot(polo, dn)))); let codo = add(s, add(esc(dn, a * cos_a), esc(lado, alto)));
    let q = desde(norm(sub(md.pos(el), s)), norm(sub(codo, s))); girar(md, sh, q);
    let pe = md.pos(el); let q = desde(norm(sub(md.pos(hand), pe)), norm(sub(wrist, pe))); girar(md, el, q);
}
/// la mano: lleva la base (dedos, costado, palma) a (fT, sT, nT): el giro de mundo de la mano
pub fn giro_mano<E: Esqueleto + ?Sized>(md: &E, hand: usize, m1: usize, i1: usize, p1: usize, ft: V, st: V) -> Q {
    let f0 = norm(sub(md.pos(m1), md.pos(hand))); let s0r = norm(sub(md.pos(i1), md.pos(p1)));
    let n0 = norm(cruz(s0r, f0)); let s0 = norm(cruz(f0, n0));
    let qb = q_base(f0, s0, cruz(f0, s0)); let qt = q_base(ft, st, cruz(ft, st));
    qnorm(qmul(qnorm(qmul(qt, qconj(qb))), md.qmundo(hand)))
}

/// celmUbicacion: dónde va el celular respecto de la cámara (a la derecha y abajo, girado un poco hacia el centro, a la
/// distancia que lo hace ocupar ~66 % del alto en una pantalla táctil); `fov`: el campo de visión vertical (grados) con el
/// que se dibuja y `asp` ancho/alto
pub fn ubicacion(fov: f32, asp: f32, tactil: bool) -> (f32, f32, f32, f32, f32, f32) {
    let fr = if tactil { 0.66 } else { 0.56 }; let tv = (fov * std::f32::consts::PI / 360.0).tan(); let th = tv * asp; let d = CELM_SH / (2.0 * fr * tv);
    let (nx, ny) = if tactil { (0.25, -0.14) } else { (0.5, -0.2) };
    (d, nx * th * d, ny * tv * d, 0.1 + nx * 0.12, -0.1, 0.05)
}
/// celmPose: el celular delante de una cámara (giro `cq`, lugar `cp`): centro y ejes, y la base de la cámara (f, u, r)
pub fn pose_camara(cq: Q, cp: V, fov: f32, asp: f32, tactil: bool) -> (Pose, [V; 3]) {
    let f = qrot(cq, [0.0, 0.0, 1.0]); let u = qrot(cq, [0.0, 1.0, 0.0]);
    let mut r = norm(cruz(f, u)); if dot(qrot(cq, [-1.0, 0.0, 0.0]), r) < 0.0 { r = esc(r, -1.0); }
    let (d, x, y, yaw, pitch, roll) = ubicacion(fov, asp, tactil);
    let c = add(cp, add(esc(f, d), add(esc(r, x), esc(u, y))));
    let (mut pr, mut pu, mut pn) = (r, u, esc(f, -1.0));
    let gir = |ax: V, a: f32, pr: &mut V, pu: &mut V, pn: &mut V| { let q = qeje(ax, a); *pr = qrot(q, *pr); *pu = qrot(q, *pu); *pn = qrot(q, *pn); };
    gir(u, -yaw, &mut pr, &mut pu, &mut pn); let ax = pr; gir(ax, pitch, &mut pr, &mut pu, &mut pn); let ax = pn; gir(ax, roll, &mut pr, &mut pu, &mut pn);
    (Pose { c, r: pr, u: pu, n: pn, t: 1.0 }, [f, u, r])
}
/// celmPosar: la mano para el celular en P (la vista ya ubicada con la cámara en el origen y en la escala de una mano de
/// verdad): la mano apoyada en la espalda del celular, el brazo con el hombro abajo a la derecha y los dedos
pub fn posar<E: Esqueleto + ?Sized>(md: &mut E, p: &Pose, cam: [V; 3], mover_raiz: &mut dyn FnMut(&mut E, V)) -> Option<[f32; 4]> {
    let (hand, m1, i1, p1, sh, el) = (md.idx("RightHand")?, md.idx("RightHandMiddle1")?, md.idx("RightHandIndex1")?, md.idx("RightHandPinky1")?, md.idx("RightArm")?, md.idx("RightForeArm")?);
    let [cf, cu, cr] = cam;
    // 1) la mano: el celular en la palma, los dedos hacia arriba (y un poco a la izquierda) por la espalda, el pulgar por el costado
    let ft = norm(add(esc(p.r, -0.36), esc(p.u, 0.93))); let nt = p.n; let st = norm(cruz(ft, nt));
    let q_hand = giro_mano(md, hand, m1, i1, p1, ft, st);
    let largo_palma = largo(sub(md.pos(m1), md.pos(hand))); let grosor = 0.014;
    let nudillos = punto(p, 0.004, -0.004, -CELM_D / 2.0 - grosor); let wrist = sub(nudillos, esc(ft, largo_palma));
    // 2) el brazo: el hombro abajo, a la derecha y atrás de la muñeca
    let (a, b) = (largo(sub(md.pos(sh), md.pos(el))), largo(sub(md.pos(el), md.pos(hand))));
    let dir_hombro = norm(add(esc(cu, -0.55), add(esc(cr, 0.45), esc(cf, -0.7)))); let hombro = add(wrist, esc(dir_hombro, (a + b) * 0.86));
    let dh = sub(hombro, md.pos(sh)); mover_raiz(md, dh); md.actualizar();
    let polo = norm(add(esc(cr, 0.7), esc(cu, -0.7)));
    brazo(md, sh, el, hand, wrist, polo);
    poner_q(md, hand, q_hand);
    // 3) los dedos y el pulgar
    Some(dedos(md, p, ft, nt, st, 1.0))
}
/// celmBrazo3p: el brazo derecho del personaje sostiene el celular delante del pecho, la pantalla mirando a la cara (todo en
/// el espacio del personaje: adelante +z). `dedos_ya`: los giros de los dedos de la vez anterior (son siempre iguales
/// respecto del celular): si no hay, se calculan y se guardan. Devuelve el celular
pub fn brazo_3p<E: Esqueleto + ?Sized>(md: &mut E, t: f32, dedos_ya: &mut Option<Vec<(usize, Q)>>) -> Option<Pose> {
    let (sh, el, hand, cab, la) = (md.idx("RightArm")?, md.idx("RightForeArm")?, md.idx("RightHand")?, md.idx("Head")?, md.idx("LeftArm")?);
    md.actualizar();
    let (up, fw) = ([0.0, 1.0, 0.0], [0.0, 0.0, 1.0]);
    let mut der = sub(md.pos(sh), md.pos(la)); der[1] = 0.0; let der = norm(der);
    // la mira: el celular a 30 cm adelante y 27 cm abajo de los ojos, apenas a la derecha
    let ojo = md.pos(cab); let c = add(ojo, add(esc(fw, 0.3 * t), add(esc(up, -0.27 * t), esc(der, 0.05 * t))));
    let n = norm(sub(ojo, c)); let pu = norm(sub(fw, esc(n, dot(fw, n)))); let mut pr = norm(cruz(pu, n)); if dot(pr, der) < 0.0 { pr = esc(pr, -1.0); }
    let pc = Pose { c, r: pr, u: pu, n, t };
    let ft = norm(add(esc(pr, -0.3), esc(pu, 0.95))); let nt = n; let st = norm(cruz(ft, nt));
    let (m1, i1) = (md.idx("RightHandMiddle1"), md.idx("RightHandIndex1")); let p1 = md.idx("RightHandPinky1").or(md.idx("RightHandRing1"));
    let largo_palma = m1.map(|m| largo(sub(md.pos(m), md.pos(hand)))).unwrap_or(0.09 * t);
    let wrist = sub(punto(&pc, 0.0, -0.01 * t, -(CELM_D / 2.0 + 0.014) * t), esc(ft, largo_palma));
    let polo = norm(add(esc(der, 0.6), esc(up, -0.8)));
    brazo(md, sh, el, hand, wrist, polo);
    if let (Some(m1), Some(i1), Some(p1)) = (m1, i1, p1) {
        let q = giro_mano(md, hand, m1, i1, p1, ft, st); poner_q(md, hand, q);
        match dedos_ya {
            Some(v) => { for (x, r) in v.iter() { md.poner_r(*x, *r); } md.actualizar(); }
            None => {
                // (desde los dedos en reposo, no desde los de la animación de ese cuadro: así queda siempre igual, sea cual
                // sea el momento de la animación —o la mezcla con la de antes— en que se sacó el celular)
                let mut cambio = false;
                for k in 1..=3 { for d in DEDOS.iter().chain(["Thumb"].iter()) { if let Some(x) = md.idx(&format!("RightHand{d}{k}")) { if let Some(q) = md.reposo_r(x) { md.poner_r(x, q); cambio = true; } } } }
                if cambio { md.actualizar(); }
                let ph = Pose { c: add(c, sub(md.pos(hand), wrist)), ..pc }; dedos(md, &ph, ft, nt, st, t);
                let mut v = vec![]; for k in 1..=3 { for d in DEDOS.iter().chain(["Thumb"].iter()) { if let Some(x) = md.idx(&format!("RightHand{d}{k}")) { v.push((x, md.r(x))); } } }
                *dedos_ya = Some(v);
            }
        }
    }
    md.actualizar();
    // el celular va donde quedó la mano (si el brazo no llega, se corre con ella), y separado de la palma lo que haga falta
    let real = md.pos(hand); let mut cc = Pose { c: add(c, sub(real, wrist)), ..pc };
    let ex = exceso(md, &cc, t); if ex > 0.0 { cc.c = add(cc.c, esc(n, ex + 0.001 * t)); }
    Some(cc)
}
