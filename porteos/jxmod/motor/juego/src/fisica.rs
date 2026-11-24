//! La física de los objetos, como fisica.js de la versión web (las mismas cuentas, en el mismo orden): cuerpos rígidos
//! con XPBD y subpasos. Formas: poliedros convexos (cajas, cascos de las mallas), esferas, cápsulas y compuestas (una
//! parte por collider). Choques: SAT con recorte de caras entre poliedros, esferas, cápsulas (como esferas a lo largo del
//! eje), contra los triángulos y los cuerpos fijos del mapa (`Mundo`, con lo de las aristas lisas y el «lado» del muñeco);
//! uniones con límites (muñeco de trapo), cuerpos que se duermen y rayos. El bucle de subpasos (integrar, uniones,
//! contactos con fricción, velocidades y rebote) es el de `jxfisica` —el mismo que corre en WebAssembly en la web—: los
//! cuerpos, contactos y uniones se le pasan en arreglos, como fisicaWasmPaso.
//! Todo en f64 (como el JS); el mapa es f32 (como MUNDO.T, un Float32Array).
//! Con hilos (`Fisica::hilos`, hasta 4 por defecto; un equipo fijo de `jxfisica`): los choques entre cuerpos se reparten
//! y se juntan en el orden de los pares, y el solver reparte las islas. Da lo mismo, bit por bit, que con uno solo (y que
//! la web): ver tests/fisica_rapida.rs.
use crate::mundo::{Forma as FormaMundo, Mundo, CUERPO};
use std::cell::{Cell, RefCell};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::collections::HashMap;
use std::hash::{BuildHasherDefault, Hasher};
use std::sync::Arc;
use std::time::Instant;

pub type V = [f64; 3];
/// cuaternión x, y, z, w
pub type Q = [f64; 4];

pub const GRAV: f64 = 9.81;
/// subpasos por paso (PH.sub; en la web lo pisa la calidad: GFX.sub)
pub const SUB: usize = 12;
const CZ_LADO: f64 = 2.0;
const CZ_MARGEN: f64 = 0.6;
const TRI_PEND: f64 = 0.267_949_192_431_122_7; // tan 15°
const TRI_CONVEXO: f64 = -0.06 * TRI_PEND;

// ---------------- vectores y cuaterniones (los de nucleo.js) ----------------
#[inline] pub fn sub(a: V, b: V) -> V { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
#[inline] pub fn add(a: V, b: V) -> V { [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
#[inline] pub fn esc(a: V, k: f64) -> V { [a[0] * k, a[1] * k, a[2] * k] }
#[inline] pub fn dot(a: V, b: V) -> f64 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
#[inline] pub fn cruz(a: V, b: V) -> V { [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
#[inline] pub fn largo(a: V) -> f64 { dot(a, a).sqrt() }
#[inline] pub fn largo2(a: V) -> f64 { dot(a, a) }
/// V3.norm: si es casi cero, queda como está
#[inline] pub fn norm(a: V) -> V { let l = largo(a); if l > 1e-12 { [a[0] / l, a[1] / l, a[2] / l] } else { a } }
/// Math.hypot como lo hace V8 (normaliza por el mayor y suma con Kahan): no siempre da lo mismo que la raíz de la suma de
/// los cuadrados, y el JS lo usa en algunas cuentas (el tamaño de las cajas de los prefabs, triLejos)
pub fn hypot_js(v: &[f64]) -> f64 {
    let (mut mx, mut nan) = (0.0f64, false);
    for x in v { if x.is_nan() { nan = true; } else if x.abs() > mx { mx = x.abs(); } }
    if mx == f64::INFINITY { return f64::INFINITY; } if nan { return f64::NAN; } if mx == 0.0 { return 0.0; }
    let (mut sum, mut comp) = (0.0f64, 0.0f64);
    for x in v { let n = x.abs() / mx; let s = n * n - comp; let p = sum + s; comp = (p - sum) - s; sum = p; }
    sum.sqrt() * mx
}
#[inline] fn clamp(x: f64, a: f64, b: f64) -> f64 { if x < a { a } else if x > b { b } else { x } }
/// Quat.rotTo
#[inline] pub fn rot(q: Q, v: V) -> V {
    let (qx, qy, qz, qw) = (q[0], q[1], q[2], q[3]);
    let (tx, ty, tz) = (2.0 * (qy * v[2] - qz * v[1]), 2.0 * (qz * v[0] - qx * v[2]), 2.0 * (qx * v[1] - qy * v[0]));
    [v[0] + qw * tx + qy * tz - qz * ty, v[1] + qw * ty + qz * tx - qx * tz, v[2] + qw * tz + qx * ty - qy * tx]
}
#[inline] pub fn rot_inv(q: Q, v: V) -> V { rot([-q[0], -q[1], -q[2], q[3]], v) }
/// a × b (Quat.mulTo)
#[inline] pub fn qmul(a: Q, b: Q) -> Q {
    [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
     a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]
}
#[inline] pub fn qnorm(q: Q) -> Q { let l = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt(); let l = if l > 0.0 { l } else { 1.0 }; [q[0] / l, q[1] / l, q[2] / l, q[3] / l] }
#[inline] pub fn qconj(q: Q) -> Q { [-q[0], -q[1], -q[2], q[3]] }
/// Quat.axis: giro de `ang` alrededor del eje
pub fn qeje(ax: V, ang: f64) -> Q { let s = (ang / 2.0).sin(); let l = largo(ax); let l = if l > 0.0 { l } else { 1.0 }; [ax[0] / l * s, ax[1] / l * s, ax[2] / l * s, (ang / 2.0).cos()] }
/// Quat.integrate(w, dt)
#[inline] pub fn qintegrar(q: Q, w: V, dt: f64) -> Q {
    let h = dt * 0.5; let (x, y, z) = (w[0] * h, w[1] * h, w[2] * h); let (qx, qy, qz, qw) = (q[0], q[1], q[2], q[3]);
    qnorm([qx + x * qw + y * qz - z * qy, qy + y * qw + z * qx - x * qz, qz + z * qw + x * qy - y * qx, qw + -x * qx - y * qy - z * qz])
}
pub const QID: Q = [0.0, 0.0, 0.0, 1.0];

/// (un hash rápido para las tablas de la física: claves que ya son números)
#[derive(Default, Clone, Copy)]
pub struct Fx(u64);
impl Hasher for Fx {
    fn finish(&self) -> u64 { self.0 }
    fn write(&mut self, b: &[u8]) { for &x in b { self.write_u64(x as u64); } }
    #[inline] fn write_u64(&mut self, x: u64) { self.0 = (self.0.rotate_left(5) ^ x).wrapping_mul(0x517c_c1b7_2722_0a95); }
    #[inline] fn write_u32(&mut self, x: u32) { self.write_u64(x as u64); }
    #[inline] fn write_i32(&mut self, x: i32) { self.write_u64(x as u32 as u64); }
    #[inline] fn write_usize(&mut self, x: usize) { self.write_u64(x as u64); }
}
pub type FxMapa<K, T> = HashMap<K, T, BuildHasherDefault<Fx>>;

// ---------------- formas ----------------
/// una cara de un poliedro: normal, distancia y sus vértices en orden
#[derive(Clone, Debug)]
pub struct Cara { pub n: V, pub d: f64, pub ix: Vec<usize> }
/// poliedro convexo: vértices, caras, aristas, direcciones de aristas (sin repetir las paralelas) y radio
#[derive(Clone, Debug)]
pub struct Casco { pub v: Vec<V>, pub f: Vec<Cara>, pub e: Vec<[usize; 2]>, pub dirs: Vec<V>, pub r: f64 }
/// una parte de una forma compuesta, en el marco del cuerpo
#[derive(Clone, Debug)]
pub struct Parte { pub forma: Forma, pub p: V, pub q: Q }
#[derive(Clone, Debug)]
pub enum Forma {
    Casco(Casco),
    Esfera { r: f64 },
    /// eje Y local; hh = medio largo del tramo recto
    Capsula { r: f64, hh: f64 },
    /// varias formas pegadas (una por cada collider del objeto, como en Unity)
    Compuesta { partes: Vec<Parte>, r: f64 },
}
impl Forma {
    /// el radio de la esfera que la envuelve (Body.r)
    pub fn radio(&self) -> f64 { match self { Forma::Casco(c) => c.r, Forma::Esfera { r } => *r, Forma::Capsula { r, hh } => r + hh, Forma::Compuesta { r, .. } => *r } }
}

/// hullFrom: el poliedro desde sus vértices y sus caras (índices en orden)
pub fn casco_de(v: Vec<V>, caras: &[Vec<usize>]) -> Casco {
    let f: Vec<Cara> = caras.iter().map(|ix| {
        let (a, b, c) = (v[ix[0]], v[ix[1]], v[ix[2]]); let n = norm(cruz(sub(b, a), sub(c, a)));
        Cara { n, d: dot(n, a), ix: ix.clone() }
    }).collect();
    let (mut e, mut dirs): (Vec<[usize; 2]>, Vec<V>) = (vec![], vec![]);
    let mut vistas = std::collections::HashSet::new();
    for cara in caras { for i in 0..cara.len() {
        let (a, b) = (cara[i], cara[(i + 1) % cara.len()]); let k = if a < b { (a, b) } else { (b, a) };
        if !vistas.insert(k) { continue; } e.push([a, b]);
        let d = norm(sub(v[b], v[a]));
        if !dirs.iter().any(|u| dot(*u, d).abs() > 0.999) { dirs.push(d); }
    } }
    let r = v.iter().fold(0.0f64, |m, p| m.max(largo(*p)));
    Casco { v, f, e, dirs, r }
}
/// boxShape: caja de medios lados hx, hy, hz (vértices x + 2y + 4z)
pub fn forma_caja(hx: f64, hy: f64, hz: f64) -> Forma {
    let mut v = vec![];
    for z in [-hz, hz] { for y in [-hy, hy] { for x in [-hx, hx] { v.push([x, y, z]); } } }
    let caras = [[1, 3, 7, 5], [0, 4, 6, 2], [2, 6, 7, 3], [0, 1, 5, 4], [4, 5, 7, 6], [0, 2, 3, 1]].map(|c| c.to_vec());
    Forma::Casco(casco_de(v, &caras))
}
/// prismShape: prisma de n lados sobre el eje Y (barriles, cubiertas) o cono truncado
pub fn forma_prisma(r0: f64, r1: f64, hy: f64, n: usize) -> Forma {
    let tau = std::f64::consts::TAU; let mut v = vec![];
    for i in 0..n { let a = (i as f64 / n as f64) * tau; v.push([a.cos() * r0, -hy, a.sin() * r0]); }
    for i in 0..n { let a = (i as f64 / n as f64) * tau; v.push([a.cos() * r1, hy, a.sin() * r1]); }
    let mut caras: Vec<Vec<usize>> = (0..n).map(|i| { let j = (i + 1) % n; vec![i, n + i, n + j, j] }).collect();
    caras.push((0..n).map(|i| n + ((n - i) % n)).collect());
    caras.push((0..n).collect());
    let mut s = casco_de(v, &caras);
    orientar_caras(&mut s);
    Forma::Casco(s)
}
/// (las caras que miran para adentro, dadas vuelta)
pub fn orientar_caras(s: &mut Casco) {
    for f in s.f.iter_mut() { if dot(f.n, s.v[f.ix[0]]) < 0.0 { f.ix.reverse(); f.n = esc(f.n, -1.0); f.d = -f.d; } }
}
pub fn forma_esfera(r: f64) -> Forma { Forma::Esfera { r } }
pub fn forma_capsula(r: f64, hh: f64) -> Forma { Forma::Capsula { r, hh } }
/// compoundShape
pub fn forma_compuesta(partes: Vec<Parte>) -> Forma {
    let r = partes.iter().fold(0.0f64, |m, h| m.max(largo(h.p) + h.forma.radio()));
    Forma::Compuesta { partes, r }
}
/// puntosForma: los puntos extremos de una forma en su marco (la caja que la envuelve, la inercia y dónde apoya)
pub fn puntos_forma(f: &Forma) -> Vec<V> {
    match f {
        Forma::Casco(c) => c.v.clone(),
        Forma::Esfera { r } => { let r = *r; vec![[r, 0.0, 0.0], [-r, 0.0, 0.0], [0.0, r, 0.0], [0.0, -r, 0.0], [0.0, 0.0, r], [0.0, 0.0, -r]] }
        Forma::Capsula { r, hh } => { let (r, h) = (*r, *hh); vec![[r, h, 0.0], [-r, h, 0.0], [0.0, h + r, 0.0], [0.0, h, r], [0.0, h, -r], [r, -h, 0.0], [-r, -h, 0.0], [0.0, -h - r, 0.0], [0.0, -h, r], [0.0, -h, -r]] }
        Forma::Compuesta { partes, .. } => { let mut o = vec![]; for h in partes { for p in puntos_forma(&h.forma) { o.push(add(rot(h.q, p), h.p)); } } o }
    }
}
/// inertia: la inercia (diagonal, local) de cada forma
pub fn inercia(f: &Forma, m: f64) -> V {
    match f {
        Forma::Esfera { r } => { let k = 0.4 * m * r * r; [k, k, k] }
        Forma::Capsula { r, hh } => { let (r, h) = (*r, hh * 2.0 + r); let ix = m * (3.0 * r * r + h * h) / 12.0; let iy = (0.5 * m * r * r).max(ix * 0.5); [ix, iy, ix] }
        _ => {
            let (mut lo, mut hi) = ([1e9f64; 3], [-1e9f64; 3]);
            for p in puntos_forma(f) { for k in 0..3 { lo[k] = lo[k].min(p[k]); hi[k] = hi[k].max(p[k]); } }
            let d = sub(hi, lo);
            [m * (d[1] * d[1] + d[2] * d[2]) / 12.0, m * (d[0] * d[0] + d[2] * d[2]) / 12.0, m * (d[0] * d[0] + d[1] * d[1]) / 12.0]
        }
    }
}

// ---------------- la forma en el mundo ----------------
/// dónde está una forma en el mundo: vértices, normales de las caras y direcciones de las aristas (poliedros), la caja que
/// la envuelve y los extremos del eje (cápsulas)
#[derive(Clone, Debug, Default)]
pub struct Geo { pub pos: V, pub q: Q, pub wv: Vec<V>, pub wn: Vec<V>, pub wd: Vec<V>, pub aabb: [f64; 6], pub cap_a: V, pub cap_b: V }
/// updateWorld de una forma simple (no compuesta) con pos y q ya puestos
fn geo_actualizar(g: &mut Geo, f: &Forma) {
    let (p, q) = (g.pos, g.q);
    match f {
        Forma::Casco(c) => {
            g.wv.resize(c.v.len(), [0.0; 3]); g.wn.resize(c.f.len(), [0.0; 3]); g.wd.resize(c.dirs.len(), [0.0; 3]);
            let mut a = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
            for (i, v) in c.v.iter().enumerate() {
                let w = add(rot(q, *v), p); g.wv[i] = w;
                for k in 0..3 { if w[k] < a[k] { a[k] = w[k]; } if w[k] > a[k + 3] { a[k + 3] = w[k]; } }
            }
            for (i, cara) in c.f.iter().enumerate() { g.wn[i] = rot(q, cara.n); }
            for (i, d) in c.dirs.iter().enumerate() { g.wd[i] = rot(q, *d); }
            g.aabb = a;
        }
        Forma::Esfera { r } => { let r = *r; g.aabb = [p[0] - r, p[1] - r, p[2] - r, p[0] + r, p[1] + r, p[2] + r]; }
        Forma::Capsula { r, hh } => {
            let ax = rot(q, [0.0, *hh, 0.0]); let r = *r; g.cap_a = add(p, ax); g.cap_b = sub(p, ax);
            let (a, b) = (g.cap_a, g.cap_b);
            g.aabb = [a[0].min(b[0]) - r, a[1].min(b[1]) - r, a[2].min(b[2]) - r, a[0].max(b[0]) + r, a[1].max(b[1]) + r, a[2].max(b[2]) + r];
        }
        Forma::Compuesta { .. } => {}
    }
}

// ---------------- cuerpos ----------------
/// cada parte de un cuerpo compuesto: su lugar en el cuerpo y su forma en el mundo (lo demás es del padre)
#[derive(Clone, Debug)]
pub struct Hijo { pub pl: V, pub ql: Q, pub geo: Geo, pub r: f64 }

/// las opciones de un cuerpo nuevo (las de `new Body(shape, mass, opt)`)
#[derive(Clone, Debug)]
pub struct OpCuerpo { pub fric: f64, pub rest: f64, pub damp: f64, pub ang_damp: f64, pub grupo: u32 }
impl Default for OpCuerpo { fn default() -> Self { OpCuerpo { fric: 0.6, rest: 0.15, damp: 0.0, ang_damp: 0.0, grupo: 0 } } }

/// un cuerpo rígido (Body)
#[derive(Clone, Debug)]
pub struct Cuerpo {
    /// lo da `Fisica::agregar`
    pub id: u32,
    pub forma: Arc<Forma>,
    pub masa: f64, pub inv_masa: f64, pub inv_i: V,
    pub pos: V, pub q: Q, pub vel: V, pub ang: V,
    pub prev_pos: V, pub prev_q: Q,
    pub fric: f64, pub rest: f64,
    /// dormido (hace de piso hasta que algo con fuerza lo despierte), cuánto lleva quieto
    pub duerme: bool, pub sleep_t: f64,
    /// congelado (frozen): no se mueve; agarrado (held): sin gravedad y nunca se duerme
    pub congelado: bool, pub agarrado: bool,
    /// los del mismo grupo (≠ 0) no chocan entre sí (las partes de un muñeco)
    pub grupo: u32,
    /// con estos (ids) no choca (noCollide: lo mira sólo el primero del par, como en el JS)
    pub no_choca: Vec<u32>,
    /// noPhys: no choca con otros cuerpos (sí con el mapa); no_rayo: los rayos lo atraviesan
    pub sin_fisica: bool, pub no_rayo: bool,
    /// noCruza (muñeco): recuerda de qué lado está de cada triángulo del mapa
    pub no_cruza: bool,
    pub damp: f64, pub ang_damp: f64,
    /// tiene uniones (umbral de dormir más flojo)
    pub unido: bool,
    /// cayó debajo de -300 (dead: quien lo creó lo saca)
    pub muerto: bool,
    /// quieto en este paso (calm)
    pub calmo: bool,
    pub r: f64, pub spec: f64, pub ult_golpe: f64,
    pub geo: Geo, pub hijos: Vec<Hijo>,
    anc: Option<(V, Q)>, anc_t: f64,
    lados: Option<FxMapa<u32, i8>>, lado_ant: Option<V>,
}

impl Cuerpo {
    /// un cuerpo con su forma y su masa (0: fijo), en el origen; ponerle pos y q antes de agregarlo
    pub fn nuevo(forma: Arc<Forma>, masa: f64, op: OpCuerpo) -> Cuerpo {
        let i = inercia(&forma, masa);
        let inv_i = [if i[0] != 0.0 { 1.0 / i[0] } else { 0.0 }, if i[1] != 0.0 { 1.0 / i[1] } else { 0.0 }, if i[2] != 0.0 { 1.0 / i[2] } else { 0.0 }];
        let hijos = match &*forma { Forma::Compuesta { partes, .. } => partes.iter().map(|pt| Hijo { pl: pt.p, ql: pt.q, geo: Geo::default(), r: pt.forma.radio() }).collect(), _ => vec![] };
        Cuerpo { id: 0, r: forma.radio(), forma, masa, inv_masa: if masa > 0.0 { 1.0 / masa } else { 0.0 }, inv_i,
            pos: [0.0; 3], q: QID, vel: [0.0; 3], ang: [0.0; 3], prev_pos: [0.0; 3], prev_q: QID,
            fric: op.fric, rest: op.rest, duerme: false, sleep_t: 0.0, congelado: false, agarrado: false, grupo: op.grupo, no_choca: vec![],
            sin_fisica: false, no_rayo: false, no_cruza: false, damp: op.damp, ang_damp: op.ang_damp, unido: false, muerto: false, calmo: false,
            spec: 0.005, ult_golpe: 0.0, geo: Geo { q: QID, ..Geo::default() }, hijos, anc: None, anc_t: 0.0, lados: None, lado_ant: None }
    }
    /// dynamic: tiene masa y no está congelado
    #[inline] pub fn dinamico(&self) -> bool { self.inv_masa > 0.0 && !self.congelado }
    /// awake: lo que el solver puede mover
    #[inline] pub fn despierto(&self) -> bool { self.dinamico() && !self.duerme }
    /// lively: agarrado o moviéndose con algo de fuerza (despierta a lo que toca)
    #[inline] pub fn vivo(&self) -> bool { self.agarrado || largo2(self.vel) > 0.04 || largo2(self.ang) > 0.12 }
    pub fn despertar(&mut self) { self.duerme = false; self.sleep_t = 0.0; self.anc_t = 0.0; }
    pub fn aabb(&self) -> [f64; 6] { self.geo.aabb }
    /// updateWorld: vértices, normales y caja en el mundo (también las de las partes)
    /// applyVel: un empujón de velocidad `p` en el punto `r` (desde el centro): cambia la velocidad y el giro
    pub fn aplicar_vel(&mut self, p: V, r: V, signo: f64) {
        if !self.despierto() { return; }
        for e in 0..3 { self.vel[e] += p[e] * self.inv_masa * signo; }
        let d = cruz(r, p); let l = rot_inv(self.q, d); let w = rot(self.q, [l[0] * self.inv_i[0], l[1] * self.inv_i[1], l[2] * self.inv_i[2]]);
        for e in 0..3 { self.ang[e] += w[e] * signo; }
    }
    pub fn actualizar(&mut self) {
        self.geo.pos = self.pos; self.geo.q = self.q;
        match &*self.forma {
            Forma::Compuesta { partes, .. } => {
                let mut a = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
                for (h, pt) in self.hijos.iter_mut().zip(partes.iter()) {
                    h.geo.pos = add(rot(self.q, h.pl), self.pos); h.geo.q = qmul(self.q, h.ql); geo_actualizar(&mut h.geo, &pt.forma);
                    let b = h.geo.aabb; for k in 0..3 { if b[k] < a[k] { a[k] = b[k]; } if b[k + 3] > a[k + 3] { a[k + 3] = b[k + 3]; } }
                }
                self.geo.aabb = a;
            }
            f => geo_actualizar(&mut self.geo, f),
        }
    }
}

// ---------------- contactos, uniones, golpes ----------------
/// un contacto: el cuerpo A (índice en `Fisica::cuerpos`) y B (None: el mapa), puntos locales (o el punto fijo del mundo
/// de B si B no se mueve), normal de B hacia A
#[derive(Clone, Debug)]
pub struct Contacto { pub a: usize, pub b: Option<usize>, pub ra: V, pub rb: V, pub wb: Option<V>, pub n: V, pub depth: f64, pub lam: f64, pub vn_pre: f64, pub activo: bool, pub hit: bool }

/// una unión esférica con cono de giro (swing) y límite de torsión (twist), o bisagra
#[derive(Clone, Debug)]
pub struct Union { pub a: u32, pub b: u32, pub pa: V, pub pb: V, pub ax_a: V, pub ax_b: V, pub p_a: V, pub p_b: V, pub h_a: V, pub h_b: V, pub swing: f64, pub twist: f64, pub bisagra: bool, pub lo: f64, pub hi: f64 }
/// las opciones de addJoint
#[derive(Clone, Debug)]
pub struct OpUnion { pub swing: f64, pub twist: f64, pub bisagra: bool, pub lo: f64, pub hi: f64, pub eje_bisagra: Option<V> }
impl Default for OpUnion { fn default() -> Self { OpUnion { swing: 0.8, twist: 0.5, bisagra: false, lo: 0.0, hi: 0.0, eje_bisagra: None } } }

/// un golpe fuerte (PH.hits: para el ruido): quién, contra qué (None: el mapa), a qué velocidad, dónde y la normal
#[derive(Clone, Debug)]
pub struct Golpe { pub cuerpo: u32, pub otro: Option<u32>, pub v: f64, pub p: V, pub n: V }
/// lo que toca un rayo: distancia, normal, punto y el cuerpo (None: el mapa)
#[derive(Clone, Copy, Debug)]
pub struct GolpeRayo { pub t: f64, pub n: V, pub p: V, pub cuerpo: Option<u32> }

// ---------------- lo fijo del mapa como cuerpos ----------------
/// un triángulo del mapa como poliedro chato de dos caras (triCuerpo), o un cuerpo fijo del mapa (MUNDO.cajas); se arma
/// la primera vez que algo lo toca
struct Fijo { forma: Forma, geo: Geo, tri: Option<u32>, tn: V, ar: Cell<Option<[bool; 3]>> }
const FIJO_CUERPO: u64 = 1 << 40;

#[inline] fn tv(m: &Mundo, t: u32, k: usize) -> V { tvs(&m.t, t, k) }
/// (lo mismo, con los triángulos sueltos: lo que se puede mirar desde otro hilo)
#[inline] fn tvs(m: &[f32], t: u32, k: usize) -> V { let o = t as usize * 9 + k * 3; [m[o] as f64, m[o + 1] as f64, m[o + 2] as f64] }
#[inline] fn tnorm(m: &Mundo, t: u32) -> V { let o = t as usize * 3; [m.tn[o] as f64, m.tn[o + 1] as f64, m.tn[o + 2] as f64] }
fn v32(a: [f32; 3]) -> V { [a[0] as f64, a[1] as f64, a[2] as f64] }

fn fijo_tri(m: &Mundo, t: u32) -> Fijo {
    let (p0, p1, p2) = (tv(m, t, 0), tv(m, t, 1), tv(m, t, 2));
    let c = [(p0[0] + p1[0] + p2[0]) / 3.0, (p0[1] + p1[1] + p2[1]) / 3.0, (p0[2] + p1[2] + p2[2]) / 3.0];
    let vs = vec![sub(p0, c), sub(p1, c), sub(p2, c)];
    let n = norm(cruz(sub(vs[1], vs[0]), sub(vs[2], vs[0]))); let d = dot(n, vs[0]);
    let e = vec![[0, 1], [1, 2], [2, 0]];
    let dirs = e.iter().map(|[a, q]| norm(sub(vs[*q], vs[*a]))).collect();
    let r = largo(vs[0]).max(largo(vs[1])).max(largo(vs[2]));
    let forma = Forma::Casco(Casco { f: vec![Cara { n, d, ix: vec![0, 1, 2] }, Cara { n: esc(n, -1.0), d: -d, ix: vec![2, 1, 0] }], v: vs, e, dirs, r });
    let mut geo = Geo { pos: c, q: QID, ..Geo::default() }; geo_actualizar(&mut geo, &forma);
    Fijo { forma, geo, tri: Some(t), tn: tnorm(m, t), ar: Cell::new(None) }
}
/// (el cuaternión de una matriz de giro dada por sus tres columnas: m4quat)
fn q_de_ejes(e: [V; 3]) -> Q {
    let (a, b, c, d, ee, f, g, h, k) = (e[0][0], e[0][1], e[0][2], e[1][0], e[1][1], e[1][2], e[2][0], e[2][1], e[2][2]);
    let t = a + ee + k; let (x, y, z, w);
    if t > 0.0 { let s = (t + 1.0).sqrt() * 2.0; w = 0.25 * s; x = (f - h) / s; y = (g - c) / s; z = (b - d) / s; }
    else if a > ee && a > k { let s = (1.0 + a - ee - k).sqrt() * 2.0; w = (f - h) / s; x = 0.25 * s; y = (d + b) / s; z = (g + c) / s; }
    else if ee > k { let s = (1.0 + ee - a - k).sqrt() * 2.0; w = (g - c) / s; x = (d + b) / s; y = 0.25 * s; z = (h + f) / s; }
    else { let s = (1.0 + k - a - ee).sqrt() * 2.0; w = (b - d) / s; x = (g + c) / s; y = (h + f) / s; z = 0.25 * s; }
    let l = (x * x + y * y + z * z + w * w).sqrt(); let l = if l > 0.0 { l } else { 1.0 };
    [x / l, y / l, z / l, w / l]
}
/// el giro más corto que lleva Y a `a` (de largo 1)
pub fn q_de_y(a: V) -> Q {
    let d = a[1];
    if d >= 0.999_999 { return QID; }
    if d <= -0.999_999 { return [1.0, 0.0, 0.0, 0.0]; }
    let ax = norm(cruz([0.0, 1.0, 0.0], a)); qeje(ax, clamp(d, -1.0, 1.0).acos())
}
fn fijo_cuerpo(m: &Mundo, i: usize) -> Fijo {
    let (forma, mut geo) = match &m.cuerpos[i].f {
        FormaMundo::Caja { c, e, h } => {
            // (los ejes de la caja; si vienen en espejo, uno dado vuelta: la caja es la misma)
            let mut ej = [v32(e[0]), v32(e[1]), v32(e[2])];
            if dot(cruz(ej[0], ej[1]), ej[2]) < 0.0 { ej[2] = esc(ej[2], -1.0); }
            (forma_caja(h[0] as f64, h[1] as f64, h[2] as f64), Geo { pos: v32(*c), q: q_de_ejes(ej), ..Geo::default() })
        }
        FormaMundo::Esfera { c, r } => (forma_esfera(*r as f64), Geo { pos: v32(*c), q: QID, ..Geo::default() }),
        FormaMundo::Capsula { a, b, r } => {
            let (a, b) = (v32(*a), v32(*b)); let d = sub(b, a); let l = largo(d);
            (forma_capsula(*r as f64, l / 2.0), Geo { pos: esc(add(a, b), 0.5), q: if l > 1e-9 { q_de_y(esc(d, 1.0 / l)) } else { QID }, ..Geo::default() })
        }
    };
    geo_actualizar(&mut geo, &forma);
    if let FormaMundo::Capsula { a, b, .. } = &m.cuerpos[i].f { geo.cap_a = v32(*b); geo.cap_b = v32(*a); }
    Fijo { forma, geo, tri: None, tn: [0.0; 3], ar: Cell::new(None) }
}

// ---------------- la detección ----------------
/// el último eje que separó a un par (cara de A, cara de B o par de aristas)
#[derive(Clone, Copy)]
struct Sep { t: u8, i: usize, j: usize }
/// las aristas de los triángulos de cada celda (triAristasCelda)
type AristasCel = FxMapa<(i32, i32), FxMapa<((i32, i32, i32), (i32, i32, i32)), Vec<u32>>>;

/// lo que hace falta mientras se buscan los choques. La caché del SAT se lee como estaba al empezar y lo nuevo se anota
/// aparte (se guarda al final de cada tanda): cada par se mira una sola vez por paso, así que da lo mismo que guardarlo
/// en el momento, y los pares se pueden repartir entre hilos
struct Det<'a> {
    cts: &'a mut Vec<Contacto>,
    sep: &'a FxMapa<(u64, u64), Sep>,
    sep_nuevos: &'a mut Vec<((u64, u64), Sep)>,
    /// los triángulos del mapa (MUNDO.T) y, para las aristas lisas, el mapa entero (sólo en el hilo del juego)
    t: &'a [f32],
    mundo: Option<(&'a Mundo, &'a RefCell<AristasCel>)>,
    /// PH.dtDet y GRAV × gscale
    dt: f64, g: f64,
    tmp: Vec<u32>,
}

/// un lado de un choque: un cuerpo, una parte de un compuesto o algo fijo del mapa
#[derive(Clone, Copy)]
struct Ent<'a> {
    g: &'a Geo, f: &'a Forma,
    spec: f64, din: bool, vel: V, ang: V,
    /// el radio del cuerpo (el del padre en una parte: triLejos)
    rp: f64,
    /// el cuerpo dueño (índice) y su lugar (para pasar los contactos al padre)
    cu: Option<usize>, pp: V, pq: Q,
    tri: Option<u32>, tn: V, ar: Option<&'a Cell<Option<[bool; 3]>>>,
    hijos: Option<(&'a [Hijo], &'a [Parte])>,
    lados: Option<&'a FxMapa<u32, i8>>,
    /// una parte de un compuesto (sus contactos se pasan al padre: contactosAlPadre)
    hijo: bool,
    /// quién es, para la caché del SAT
    k: u64,
}
fn ent_cuerpo(c: &Cuerpo, i: usize) -> Ent<'_> {
    let hijos = match &*c.forma { Forma::Compuesta { partes, .. } => Some((c.hijos.as_slice(), partes.as_slice())), _ => None };
    Ent { g: &c.geo, f: &c.forma, spec: c.spec, din: c.dinamico(), vel: c.vel, ang: c.ang, rp: c.r, cu: Some(i), pp: c.pos, pq: c.q,
        tri: None, tn: [0.0; 3], ar: None, hijos, lados: if c.no_cruza { c.lados.as_ref() } else { None }, hijo: false, k: (c.id as u64) << 16 }
}
fn ent_fijo(f: &Fijo, k: u64) -> Ent<'_> {
    Ent { g: &f.geo, f: &f.forma, spec: 0.005, din: false, vel: [0.0; 3], ang: [0.0; 3], rp: f.forma.radio(), cu: None, pp: f.geo.pos, pq: f.geo.q,
        tri: f.tri, tn: f.tn, ar: Some(&f.ar), hijos: None, lados: None, hijo: false, k: (1u64 << 62) | k }
}
/// la parte k de un compuesto (o el mismo, si no lo es)
fn ent_parte<'a>(e: &Ent<'a>, k: usize) -> Ent<'a> {
    match e.hijos { Some((h, p)) => Ent { g: &h[k].geo, f: &p[k].forma, hijos: None, lados: None, hijo: true, k: e.k | (k as u64 + 1), ..*e }, None => *e }
}
#[inline] fn casco<'a>(e: &Ent<'a>) -> &'a Casco { match e.f { Forma::Casco(c) => c, _ => unreachable!("no es un poliedro") } }

/// el punto p en el marco del cuerpo dueño de e: si e es una parte, como contactosAlPadre (en el marco de la parte, de
/// vuelta al mundo y al marco del padre: las mismas cuentas que el JS)
#[inline] fn local(e: &Ent, p: V) -> V {
    if !e.hijo { return rot_inv(e.pq, sub(p, e.pp)); }
    let r = rot_inv(e.g.q, sub(p, e.g.pos)); let w = add(rot(e.g.q, r), e.g.pos);
    rot_inv(e.pq, sub(w, e.pp))
}
/// mkContact (y contactosAlPadre: los puntos, en el marco del cuerpo dueño)
fn mk(d: &mut Det, a: &Ent, b: &Ent, pa: V, pb: V, n: V, depth: f64) {
    let Some(ia) = a.cu else { return };
    let ra = local(a, pa);
    let (rb, wb) = if b.din { (local(b, pb), None) } else { ([0.0; 3], Some(pb)) };
    d.cts.push(Contacto { a: ia, b: b.cu, ra, rb, wb, n, depth, lam: 0.0, vn_pre: 0.0, activo: false, hit: false });
}

/// faceQuery: la cara de A que más separa (contra los vértices de B)
fn cara_query(a: &Ent, b: &Ent, m: f64) -> (f64, usize) {
    let ca = casco(a); let (mut best, mut bi) = (-1e9, 0usize);
    for i in 0..a.g.wn.len() {
        let n = a.g.wn[i]; let dd = dot(n, a.g.wv[ca.f[i].ix[0]]);
        let mut mn = 1e9; for v in &b.g.wv { let s = dot(n, *v) - dd; if s < mn { mn = s; } }
        if mn > best { best = mn; bi = i; }
        if best > m { return (best, bi); }
    }
    (best, bi)
}
/// sepAristas: la separación sobre el eje de un par de aristas (i de A, j de B), apuntando de B hacia A
fn sep_aristas(a: &Ent, b: &Ent, i: usize, j: usize) -> (f64, V) {
    let (u, w) = (a.g.wd[i], b.g.wd[j]);
    let (mut x, mut y, mut z) = (u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]);
    let l = (x * x + y * y + z * z).sqrt(); if l < 1e-4 { return (-1e9, [0.0; 3]); }
    let k = 1.0 / l; x *= k; y *= k; z *= k;
    let (pa, pb) = (a.g.pos, b.g.pos);
    if x * (pa[0] - pb[0]) + y * (pa[1] - pb[1]) + z * (pa[2] - pb[2]) < 0.0 { x *= -1.0; y *= -1.0; z *= -1.0; }
    let (mut min_a, mut max_b) = (1e9f64, -1e9f64);
    for v in &a.g.wv { let s = x * v[0] + y * v[1] + z * v[2]; if s < min_a { min_a = s; } }
    for v in &b.g.wv { let s = x * v[0] + y * v[1] + z * v[2]; if s > max_b { max_b = s; } }
    (min_a - max_b, [x, y, z])
}
struct EdgeQ { sep: f64, axis: Option<V>, ea: usize, eb: usize }
fn arista_query(a: &Ent, b: &Ent, m: f64) -> EdgeQ {
    let mut r = EdgeQ { sep: -1e9, axis: None, ea: 0, eb: 0 };
    for i in 0..a.g.wd.len() { for j in 0..b.g.wd.len() {
        let (sep, ax) = sep_aristas(a, b, i, j); if sep == -1e9 { continue; }
        if sep > r.sep { r.sep = sep; r.axis = Some(ax); r.ea = i; r.eb = j; }
        if r.sep > m { return r; }
    } }
    r
}
fn sep_cara(a: &Ent, b: &Ent, i: usize) -> f64 {
    let ca = casco(a); let n = a.g.wn[i]; let dd = dot(n, a.g.wv[ca.f[i].ix[0]]);
    let mut mn = 1e9; for v in &b.g.wv { let s = dot(n, *v) - dd; if s < mn { mn = s; } }
    mn
}
fn sat_guardar(d: &mut Det, a: &Ent, b: &Ent, t: u8, i: usize, j: usize) { d.sep_nuevos.push(((a.k, b.k), Sep { t, i, j })); }
fn sat_cache(d: &Det, a: &Ent, b: &Ent) -> f64 {
    let Some(c) = d.sep.get(&(a.k, b.k)) else { return -1e9 };
    match c.t {
        0 => if c.i < a.g.wn.len() { sep_cara(a, b, c.i) } else { -1e9 },
        1 => if c.i < b.g.wn.len() { sep_cara(b, a, c.i) } else { -1e9 },
        _ => if c.i < a.g.wd.len() && c.j < b.g.wd.len() { sep_aristas(a, b, c.i, c.j).0 } else { -1e9 },
    }
}
/// recorta un polígono contra un plano (se queda con lo de adentro: n·p <= d)
fn clip_poly(poly: &[V], n: V, d: f64) -> Vec<V> {
    let mut out = Vec::with_capacity(poly.len() + 2);
    for i in 0..poly.len() {
        let (a, b) = (poly[i], poly[(i + 1) % poly.len()]); let (da, db) = (dot(n, a) - d, dot(n, b) - d);
        if da <= 0.0 { out.push(a); }
        if (da <= 0.0) != (db <= 0.0) { let t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
    }
    out
}
#[derive(Clone, Copy)]
struct Pt { p: V, q: V, depth: f64 }
/// reduce4: el más hondo, el más lejano a él y los dos que más área agregan
fn reduce4(pts: &mut Vec<Pt>, n: V) {
    pts.sort_by(|a, b| b.depth.partial_cmp(&a.depth).unwrap_or(std::cmp::Ordering::Equal));
    let mut out = vec![0usize]; let (mut far, mut fd) = (0usize, -1.0f64);
    for (i, p) in pts.iter().enumerate() { let d = largo2(sub(p.p, pts[0].p)); if d > fd { fd = d; far = i; } }
    out.push(far);
    let area = |a: usize, b: usize, c: usize| dot(cruz(sub(pts[b].p, pts[a].p), sub(pts[c].p, pts[a].p)), n);
    let (mut p3, mut best) = (None, -1e9);
    for i in 0..pts.len() { let s = area(out[0], out[1], i); if s > best { best = s; p3 = Some(i); } }
    if let Some(i) = p3 { out.push(i); }
    let (mut p4, mut best) = (None, 1e9);
    for i in 0..pts.len() { let s = area(out[0], out[1], i); if s < best { best = s; p4 = Some(i); } }
    if let Some(i) = p4 { if Some(i) != p3 { out.push(i); } }
    let r: Vec<Pt> = out.iter().map(|&i| pts[i]).collect(); *pts = r;
}
/// edgeSupport: la arista de H más metida hacia n con dirección parecida a la di
fn arista_soporte(h: &Ent, n: V, di: usize) -> Option<(V, V)> {
    let c = casco(h); let dd = rot(h.g.q, c.dirs[di]); let (mut best, mut res) = (-1e9, None);
    for e in &c.e {
        let (a, b) = (h.g.wv[e[0]], h.g.wv[e[1]]); let ed = norm(sub(b, a)); if dot(ed, dd).abs() < 0.99 { continue; }
        let s = dot(n, a) + dot(n, b); if s > best { best = s; res = Some((a, b)); }
    }
    res
}
/// segClosest: los puntos más cercanos de dos tramos
fn seg_cercanos(p1: V, q1: V, p2: V, q2: V) -> (V, V) {
    let (d1, d2, r) = (sub(q1, p1), sub(q2, p2), sub(p1, p2)); let (a, e, f) = (dot(d1, d1), dot(d2, d2), dot(d2, r));
    let (s, t);
    if a < 1e-9 && e < 1e-9 { return (p1, p2); }
    if a < 1e-9 { s = 0.0; t = clamp(f / e, 0.0, 1.0); }
    else {
        let c = dot(d1, r);
        if e < 1e-9 { t = 0.0; s = clamp(-c / a, 0.0, 1.0); }
        else {
            let b = dot(d1, d2); let den = a * e - b * b;
            let mut s0 = if den > 1e-9 { clamp((b * f - c * e) / den, 0.0, 1.0) } else { 0.0 }; let mut t0 = (b * s0 + f) / e;
            if t0 < 0.0 { t0 = 0.0; s0 = clamp(-c / a, 0.0, 1.0); } else if t0 > 1.0 { t0 = 1.0; s0 = clamp((b - c) / a, 0.0, 1.0); }
            s = s0; t = t0;
        }
    }
    (add(p1, esc(d1, s)), add(p2, esc(d2, t)))
}
/// hullHull: contactos entre dos poliedros (cara contra cara recortando, o arista contra arista)
fn casco_casco(d: &mut Det, a: &Ent, b: &Ent) {
    let m = a.spec + b.spec;
    if sat_cache(d, a, b) > m { return; }
    let fa = cara_query(a, b, m); if fa.0 > m { sat_guardar(d, a, b, 0, fa.1, 0); return; }
    let fb = cara_query(b, a, m); if fb.0 > m { sat_guardar(d, a, b, 1, fb.1, 0); return; }
    let ee = arista_query(a, b, m); if ee.sep > m { sat_guardar(d, a, b, 2, ee.ea, ee.eb); return; }
    let face_best = fa.0.max(fb.0);
    if let Some(n) = ee.axis { if ee.sep > face_best + 0.01 {
        // arista contra arista: los puntos más cercanos de las aristas de soporte
        let (Some(sa), Some(sb)) = (arista_soporte(a, esc(n, -1.0), ee.ea), arista_soporte(b, n, ee.eb)) else { return };
        let (p, q) = seg_cercanos(sa.0, sa.1, sb.0, sb.1);
        let depth = -dot(sub(p, q), n);
        if depth > -m { mk(d, a, b, p, q, n, depth); }
        return;
    } }
    // cara de referencia: la de menor penetración (con preferencia por A)
    let (rf_e, inc, fi, flip) = if fb.0 > fa.0 + 0.005 { (b, a, fb.1, true) } else { (a, b, fa.1, false) };
    let (cr, ci) = (casco(rf_e), casco(inc));
    let rn = rf_e.g.wn[fi]; let rf = &cr.f[fi]; let rd = dot(rn, rf_e.g.wv[rf.ix[0]]);
    // cara incidente: la más opuesta a la normal de referencia
    let (mut ii, mut mn) = (0usize, 1e9); for i in 0..inc.g.wn.len() { let s = dot(inc.g.wn[i], rn); if s < mn { mn = s; ii = i; } }
    let mut poly: Vec<V> = ci.f[ii].ix.iter().map(|&k| inc.g.wv[k]).collect();
    // recortar contra los costados de la cara de referencia
    let nr = rf.ix.len();
    for i in 0..nr {
        if poly.is_empty() { break; }
        let (pa, pb) = (rf_e.g.wv[rf.ix[i]], rf_e.g.wv[rf.ix[(i + 1) % nr]]); let sn = norm(cruz(sub(pb, pa), rn));
        poly = clip_poly(&poly, sn, dot(sn, pa));
    }
    // puntos debajo de la cara de referencia
    let mut pts: Vec<Pt> = vec![];
    for p in poly { let s = dot(rn, p) - rd; if s <= m { pts.push(Pt { p, q: p, depth: -s }); } }
    if pts.len() > 4 { reduce4(&mut pts, rn); }
    for c in pts {
        let on_ref = sub(c.p, esc(rn, dot(rn, c.p) - rd));
        // (la normal va de B hacia A)
        if !flip { mk(d, a, b, on_ref, c.p, esc(rn, -1.0), c.depth); } else { mk(d, a, b, c.p, on_ref, rn, c.depth); }
    }
}
/// hullTri: poliedro contra un triángulo: sólo vértices contra la cara, con la normal de la cara (sg: el lado; 0 = el del
/// centro del poliedro; con lado, hullTriLado: todos los puntos, sin reducir)
fn casco_tri(d: &mut Det, a: &Ent, b: &Ent, sg: f64) {
    let t = b.tri.unwrap(); let m = a.spec + b.spec;
    let p0 = tvs(d.t, t, 0); let e0 = sub(tvs(d.t, t, 1), p0); let e1 = sub(tvs(d.t, t, 2), p0);
    let (d00, d01, d11) = (dot(e0, e0), dot(e0, e1), dot(e1, e1)); let den = d00 * d11 - d01 * d01; if den.abs() < 1e-12 { return; }
    let n = if sg != 0.0 { esc(b.tn, sg) } else if dot(sub(a.g.pos, p0), b.tn) < 0.0 { esc(b.tn, -1.0) } else { b.tn };
    let mut pts: Vec<Pt> = vec![];
    for v in &a.g.wv {
        let s = dot(sub(*v, p0), n); if s > m || s < -1.2 { continue; }
        let q = sub(*v, esc(n, s)); let w = sub(q, p0); let (d20, d21) = (dot(w, e0), dot(w, e1));
        let bv = (d11 * d20 - d01 * d21) / den; let bw = (d00 * d21 - d01 * d20) / den;
        if bv < -0.02 || bw < -0.02 || bv + bw > 1.02 { continue; }
        pts.push(Pt { p: *v, q, depth: -s });
    }
    if sg == 0.0 && pts.len() > 4 { reduce4(&mut pts, n); }
    for c in pts { mk(d, a, b, c.p, c.q, n, c.depth); }
}
/// triLejos: ¿el poliedro está del todo de un lado del plano del triángulo y más lejos de lo que puede acercarse a él en
/// este cuadro? Entonces no lo toca: ni contacto especulativo
fn tri_lejos(d: &Det, a: &Ent, b: &Ent) -> bool {
    let p0 = tvs(d.t, b.tri.unwrap(), 0); let n = b.tn;
    let sg = if dot(sub(a.g.pos, p0), n) >= 0.0 { 1.0 } else { -1.0 };
    let mut mn = 1e9f64; for v in &a.g.wv { let s = sg * dot(sub(*v, p0), n); if s < mn { mn = s; } }
    if mn <= 0.01 { return false; }
    let dt = if d.dt > 0.0 { d.dt } else { 1.0 / 60.0 };
    let ap = (-sg * dot(a.vel, n)).max(0.0) + hypot_js(&a.ang) * a.rp;
    mn > 0.01 + ap * dt * 1.3 + d.g * dt * dt
}
/// hullTriMundo: si las tres aristas del triángulo son lisas, sólo la cara; si no, el choque completo, salvo que salga un
/// contacto «de costado» pegado a una arista lisa (choque fantasma): ahí, sólo la cara
fn casco_tri_mundo(d: &mut Det, a: &Ent, b: &Ent) {
    if tri_lejos(d, a, b) { return; }
    let t = b.tri.unwrap();
    let ar = match b.ar.and_then(|c| c.get()) { Some(x) => x, None => {
        let (mu, cel) = d.mundo.expect("las aristas de un triángulo, fuera del hilo del juego");
        let x = tri_aristas(mu, cel, &mut d.tmp, t); if let Some(c) = b.ar { c.set(Some(x)); } x } };
    if ar[0] && ar[1] && ar[2] { return casco_tri(d, a, b, 0.0); }
    let n0 = d.cts.len(); casco_casco(d, a, b);
    if d.cts.len() == n0 { return; }
    let tn = b.tn;
    for i in n0..d.cts.len() {
        let (cn, cw, cdep) = { let c = &d.cts[i]; (c.n, c.wb, c.depth) };
        let Some(wb) = cw else { continue }; if dot(cn, tn).abs() > 0.97 { continue; }
        // (de costado y todavía lejos —sólo por el margen—: el contacto de verdad, si llega, sale en el cuadro siguiente)
        if cdep < -0.05 { d.cts.truncate(n0); return casco_tri(d, a, b, 0.0); }
        let (mut cerca, mut filosa) = (false, false);
        for e in 0..3 {
            let pa = tvs(d.t, t, e); let u = sub(tvs(d.t, t, (e + 1) % 3), pa); let p = sub(wb, pa);
            let uu = dot(u, u); let s = clamp(dot(p, u) / if uu != 0.0 { uu } else { 1.0 }, 0.0, 1.0);
            let dd = sub(p, esc(u, s));
            if largo2(dd) < 0.0004 { cerca = true; if !ar[e] { filosa = true; } }
        }
        if cerca && !filosa { d.cts.truncate(n0); return casco_tri(d, a, b, 0.0); }
    }
}
/// hullClosest: el punto de un poliedro más cercano a p (si p está adentro: la normal y la distancia de la cara)
fn casco_cercano(h: &Ent, p: V) -> (V, bool, V, f64) {
    let c = casco(h); let (mut max_s, mut fi) = (-1e9, 0usize);
    for i in 0..h.g.wn.len() { let s = dot(h.g.wn[i], p) - dot(h.g.wn[i], h.g.wv[c.f[i].ix[0]]); if s > max_s { max_s = s; fi = i; } }
    if max_s <= 0.0 { let n = h.g.wn[fi]; return (sub(p, esc(n, max_s)), true, n, max_s); }
    // afuera: proyección sobre la cara, recortada al polígono; si cae afuera, el más cercano entre aristas
    let f = &c.f[fi]; let n = h.g.wn[fi]; let q = sub(p, esc(n, max_s)); let nv = f.ix.len();
    let mut en_poly = true;
    for i in 0..nv { let (a, b) = (h.g.wv[f.ix[i]], h.g.wv[f.ix[(i + 1) % nv]]); if dot(cruz(sub(b, a), sub(q, a)), n) < -1e-6 { en_poly = false; break; } }
    if en_poly { return (q, false, n, max_s); }
    let (mut best, mut bd) = (q, 1e9);
    for e in &c.e {
        let (a, b) = (h.g.wv[e[0]], h.g.wv[e[1]]); let ab = sub(b, a); let t = clamp(dot(sub(p, a), ab) / dot(ab, ab), 0.0, 1.0);
        let cc = add(a, esc(ab, t)); let dd = largo2(sub(p, cc));
        if dd < bd { bd = dd; best = cc; }
    }
    (best, false, n, max_s)
}
/// sphereHull: una esfera (centro ca, radio r, de A) contra el poliedro H; flip: el contacto queda con H de A
fn esfera_casco(d: &mut Det, a: &Ent, ca: V, r: f64, h: &Ent, flip: bool) {
    let (cp, dentro, cn, cd) = casco_cercano(h, ca);
    let (n, depth, ps);
    if dentro { n = cn; depth = r - cd; ps = sub(ca, esc(n, r)); }
    else {
        let dv = sub(ca, cp); let l = largo(dv); if l >= r + a.spec + h.spec || l < 1e-9 { return; }
        n = esc(dv, 1.0 / l); depth = r - l; ps = sub(ca, esc(n, r));
    }
    if !flip { mk(d, a, h, ps, cp, n, depth); } else { mk(d, h, a, cp, ps, esc(n, -1.0), depth); }
}
fn esfera_esfera(d: &mut Det, a: &Ent, ca: V, ra: f64, b: &Ent, cb: V, rb: f64) {
    let dv = sub(ca, cb); let l = largo(dv); if l >= ra + rb + a.spec + b.spec || l < 1e-9 { return; }
    let n = esc(dv, 1.0 / l); mk(d, a, b, sub(ca, esc(n, ra)), add(cb, esc(n, rb)), n, ra + rb - l);
}
/// capSpheres: las cápsulas, como tres esferas a lo largo del eje
fn cap_esferas(e: &Ent) -> [V; 3] { let (a, b) = (e.g.cap_a, e.g.cap_b); [a, esc(add(a, b), 0.5), b] }

// ---- el muñeco: de qué lado de cada triángulo está ----
/// triPrisma: ¿la proyección de p sobre el plano del triángulo t cae adentro (con margen m)?
fn tri_prisma(mu: &[f32], t: u32, p: V, m: f64) -> bool {
    let a = tvs(mu, t, 0); let e0 = sub(tvs(mu, t, 1), a); let e1 = sub(tvs(mu, t, 2), a);
    let n = cruz(e0, e1); let nl = largo(n); let nl = if nl != 0.0 { nl } else { 1.0 };
    let ed = |b: V, c: V| { let u = sub(c, b); let q = sub(p, b); let ul = largo(u); dot(cruz(u, q), n) / nl / if ul != 0.0 { ul } else { 1.0 } };
    let (b, c) = (add(a, e0), add(a, e1));
    ed(a, b) > -m && ed(b, c) > -m && ed(c, a) > -m
}
/// tramoCruzaTri: ¿el tramo de o a p atraviesa el triángulo t (con 2 cm de margen)?
fn tramo_cruza_tri(mu: &Mundo, t: u32, o: V, p: V) -> bool {
    let a = tv(mu, t, 0); let n = cruz(sub(tv(mu, t, 1), a), sub(tv(mu, t, 2), a));
    let (s0, s1) = (dot(sub(o, a), n), dot(sub(p, a), n));
    if (s0 > 0.0) == (s1 > 0.0) && s0 != 0.0 && s1 != 0.0 { return false; }
    let dd = s0 - s1; let f = s0 / if dd != 0.0 { dd } else { 1e-12 };
    tri_prisma(&mu.t, t, add(o, esc(sub(p, o), f)), 0.02)
}
/// ladosActualizar: de qué lado está el cuerpo de cada triángulo cercano (cambia sólo si rodeó el borde)
fn lados_actualizar(c: &mut Cuerpo, near: &[u64], fijos: &FxMapa<u64, Fijo>, mu: &Mundo) {
    let viejo = c.lados.take(); let ant = c.lado_ant.unwrap_or(c.pos); let pos = c.pos;
    let mut cruzo = false;
    if viejo.is_some() { for k in near { if let Some(t) = fijos[k].tri { if tramo_cruza_tri(mu, t, ant, pos) { cruzo = true; break; } } } }
    let mut nuevo: FxMapa<u32, i8> = FxMapa::default();
    for k in near {
        let f = &fijos[k]; let Some(t) = f.tri else { continue };
        let p0 = tv(mu, t, 0); let sd = dot(sub(pos, p0), f.tn);
        let prev = viejo.as_ref().and_then(|v| v.get(&t).copied()); let ahora: i8 = if sd >= 0.0 { 1 } else { -1 };
        let mut lado = ahora;
        match prev {
            // (recién visto y ya tocándolo: del lado de la cara, el de afuera del sólido)
            None => if sd.abs() < c.r { lado = 1; },
            Some(pv) => if pv != ahora {
                let s_ant: i8 = if dot(sub(ant, p0), f.tn) >= 0.0 { 1 } else { -1 };
                if s_ant != pv || cruzo { lado = pv; }
            },
        }
        nuevo.insert(t, lado);
    }
    c.lados = Some(nuevo); c.lado_ant = Some(pos);
}
/// esferaTriLado: una esfera contra el triángulo B del lado sg (si su centro quedó del otro lado, la saca hacia el suyo)
fn esfera_tri_lado(d: &mut Det, a: &Ent, p: V, r: f64, b: &Ent, sg: f64, flip: bool) {
    let t = b.tri.unwrap(); let p0 = tvs(d.t, t, 0); let sd = sg * dot(sub(p, p0), b.tn);
    if sd >= 0.0 || !tri_prisma(d.t, t, p, 0.005) { return esfera_casco(d, a, p, r, b, flip); }
    let n = esc(b.tn, sg); let q = sub(p, esc(n, sd)); let ps = sub(p, esc(n, r));
    if !flip { mk(d, a, b, ps, q, n, r - sd); } else { mk(d, b, a, q, ps, esc(n, -1.0), r - sd); }
}
/// choqueLado: el choque de un cuerpo del muñeco contra un triángulo del mapa, del lado que recuerda; false = el de siempre
fn choque_lado(d: &mut Det, a: &Ent, b: &Ent, lados: &FxMapa<u32, i8>) -> bool {
    let t = b.tri.unwrap(); let Some(&sg) = lados.get(&t) else { return false }; let sg = sg as f64;
    match a.f {
        Forma::Casco(_) => {
            let sd = sg * dot(sub(a.g.pos, tvs(d.t, t, 0)), b.tn);
            if sd >= 0.0 { casco_tri_mundo(d, a, b); } else { casco_tri(d, a, b, sg); }
            true
        }
        Forma::Esfera { r } => { esfera_tri_lado(d, a, a.g.pos, *r, b, sg, false); true }
        Forma::Capsula { r, .. } => { for p in cap_esferas(a) { esfera_tri_lado(d, a, p, *r, b, sg, false); } true }
        Forma::Compuesta { .. } => false,
    }
}
/// collidePair
fn choque(d: &mut Det, a: &Ent, b: &Ent) {
    if let (Some(l), Some(_)) = (a.lados, b.tri) { if choque_lado(d, a, b, l) { return; } }
    if a.hijos.is_some() || b.hijos.is_some() {
        let m = a.spec + b.spec + 0.02;
        let na = a.hijos.map_or(1, |h| h.0.len()); let nb = b.hijos.map_or(1, |h| h.0.len());
        for i in 0..na {
            let x = ent_parte(a, i); let p = x.g.aabb;
            for j in 0..nb {
                let y = ent_parte(b, j); let q = y.g.aabb;
                if p[0] > q[3] + m || p[3] < q[0] - m || p[1] > q[4] + m || p[4] < q[1] - m || p[2] > q[5] + m || p[5] < q[2] - m { continue; }
                choque(d, &x, &y);
            }
        }
        return;
    }
    match (a.f, b.f) {
        (Forma::Casco(_), _) if b.tri.is_some() => return casco_tri_mundo(d, a, b),
        (Forma::Casco(_), Forma::Casco(_)) => return casco_casco(d, a, b),
        (Forma::Esfera { r }, Forma::Casco(_)) => return esfera_casco(d, a, a.g.pos, *r, b, false),
        (Forma::Casco(_), Forma::Esfera { r }) => return esfera_casco(d, b, b.g.pos, *r, a, true),
        (Forma::Esfera { r: ra }, Forma::Esfera { r: rb }) => return esfera_esfera(d, a, a.g.pos, *ra, b, b.g.pos, *rb),
        _ => {}
    }
    let esferas = |e: &Ent| -> Option<(Vec<V>, f64)> { match e.f { Forma::Capsula { r, .. } => Some((cap_esferas(e).to_vec(), *r)), Forma::Esfera { r } => Some((vec![e.g.pos], *r)), _ => None } };
    let (sa, sb) = (esferas(a), esferas(b));
    match (sa, sb) {
        (Some((sa, ra)), Some((sb, rb))) => {
            let mut best: Option<(V, V, f64)> = None;
            for p in &sa { for q in &sb { let dd = largo(sub(*p, *q)); if best.map_or(true, |x| dd < x.2) { best = Some((*p, *q, dd)); } } }
            if let Some((p, q, _)) = best { esfera_esfera(d, a, p, ra, b, q, rb); }
        }
        (Some((sa, ra)), None) => { for p in sa { esfera_casco(d, a, p, ra, b, false); } }
        (None, Some((sb, rb))) => { for q in sb { esfera_casco(d, b, q, rb, a, true); } }
        (None, None) => {}
    }
}

// ---- las aristas lisas o filosas de los triángulos del mapa (triAristas) ----
/// rayTri: Möller–Trumbore contra el triángulo t; -1 si no lo toca
fn ray_tri(mu: &Mundo, o: V, d: V, t: u32, tmax: f64) -> f64 {
    let a = tv(mu, t, 0); let e1 = sub(tv(mu, t, 1), a); let e2 = sub(tv(mu, t, 2), a);
    let p = cruz(d, e2); let det = dot(e1, p);
    if det.abs() < 1e-9 { return -1.0; }
    let inv = 1.0 / det; let s = sub(o, a); let u = dot(s, p) * inv;
    if !(0.0..=1.0).contains(&u) { return -1.0; }
    let q = cruz(s, e1); let v = dot(d, q) * inv;
    if v < 0.0 || u + v > 1.0 { return -1.0; }
    let tt = dot(e2, q) * inv;
    if tt >= 0.0 && tt <= tmax { tt } else { -1.0 }
}
#[inline] fn tri_fuera(mu: &Mundo, t: u32, b: [f64; 6]) -> bool {
    let o = t as usize * 9; let tt = &mu.t;
    let (x0, x1) = (tt[o].min(tt[o + 3]).min(tt[o + 6]) as f64, tt[o].max(tt[o + 3]).max(tt[o + 6]) as f64);
    if x1 < b[0] || x0 > b[3] { return true; }
    let (y0, y1) = (tt[o + 1].min(tt[o + 4]).min(tt[o + 7]) as f64, tt[o + 1].max(tt[o + 4]).max(tt[o + 7]) as f64);
    if y1 < b[1] || y0 > b[4] { return true; }
    let (z0, z1) = (tt[o + 2].min(tt[o + 5]).min(tt[o + 8]) as f64, tt[o + 2].max(tt[o + 5]).max(tt[o + 8]) as f64);
    z1 < b[2] || z0 > b[5]
}
#[inline] fn celda(x: f64, c: f64) -> i32 { (x / c).floor() as i32 }
/// triSonda: un rayito corto hacia -n desde 30 cm arriba de p; cuánto más arriba (o abajo) hay piso
fn tri_sonda(mu: &Mundo, tmp: &mut Vec<u32>, p: V, n: V, excl: u32) -> Option<f64> {
    let c = mu.celda as f64; let o = add(p, esc(n, 0.3)); let d = esc(n, -1.0); let e = add(o, esc(d, 0.6));
    let b = [o[0].min(e[0]), o[1].min(e[1]), o[2].min(e[2]), o[0].max(e[0]), o[1].max(e[1]), o[2].max(e[2])];
    mu.items_celdas(celda(b[0], c), celda(b[2], c), celda(b[3], c), celda(b[5], c), tmp);
    let (mut best, mut hit) = (0.6, false);
    for &it in tmp.iter() {
        if it & CUERPO != 0 || it == excl || tri_fuera(mu, it, b) { continue; }
        let t = ray_tri(mu, o, d, it, best); if t >= 0.0 { best = t; hit = true; }
    }
    if hit { Some(0.3 - best) } else { None }
}
#[inline] fn qv(x: f32) -> i32 { (x as f64 * 512.0 + 0.5).floor() as i32 }
fn arista_clave(mu: &Mundo, t: u32, e: usize) -> ((i32, i32, i32), (i32, i32, i32)) {
    let (a, b) = (t as usize * 9 + e * 3, t as usize * 9 + ((e + 1) % 3) * 3); let tt = &mu.t;
    let ka = (qv(tt[a]), qv(tt[a + 1]), qv(tt[a + 2])); let kb = (qv(tt[b]), qv(tt[b + 1]), qv(tt[b + 2]));
    if ka <= kb { (ka, kb) } else { (kb, ka) }
}
/// triAristas: cada arista de un triángulo del mapa, lisa (del otro lado sigue el piso casi en el mismo plano, o sube) o
/// filosa (borde suelto, o del otro lado cae más de 15°)
fn tri_aristas(mu: &Mundo, cel: &RefCell<AristasCel>, tmp: &mut Vec<u32>, t: u32) -> [bool; 3] {
    let c0 = mu.celda as f64; let n = tnorm(mu, t); let p = [tv(mu, t, 0), tv(mu, t, 1), tv(mu, t, 2)];
    let mut res = [false; 3];
    for e in 0..3 {
        let (a, b, c) = (p[e], p[(e + 1) % 3], p[(e + 2) % 3]); let ab = sub(b, a); let mut fuera = norm(cruz(ab, n));
        if dot(fuera, sub(c, a)) > 0.0 { fuera = esc(fuera, -1.0); }
        // 1) el vecino que comparte la arista exacta: el ángulo entre las dos caras (con su tercer vértice)
        let ck = (celda((a[0] + b[0]) / 2.0, c0), celda((a[2] + b[2]) / 2.0, c0));
        if !cel.borrow().contains_key(&ck) {
            let mut m: FxMapa<_, Vec<u32>> = FxMapa::default();
            mu.items_celdas(ck.0, ck.1, ck.0, ck.1, tmp);
            for &it in tmp.iter() { if it & CUERPO != 0 { continue; } for k in 0..3 { m.entry(arista_clave(mu, it, k)).or_default().push(it); } }
            cel.borrow_mut().insert(ck, m);
        }
        let mut lisa: Option<bool> = None;
        if let Some(l) = cel.borrow()[&ck].get(&arista_clave(mu, t, e)) {
            for &u in l {
                if u == t { continue; }
                let (mut o, mut mejor) = ([0.0; 3], -1.0);
                for j in 0..3 { let x = tv(mu, u, j); let dd = largo2(sub(x, a)).min(largo2(sub(x, b))); if dd > mejor { mejor = dd; o = x; } }
                let dv = sub(o, a); let h = dot(n, dv); let dd = dot(fuera, dv);
                if dd > 1e-4 && h >= -TRI_PEND * dd { lisa = Some(true); break; }
                lisa = Some(false);
            }
        }
        // 2) sin vecino exacto (uniones en T, bordes): rayitos cortos a 6 cm afuera de la arista, en tres puntos
        let lisa = lisa.unwrap_or_else(|| {
            for s in [0.2, 0.5, 0.8] {
                let q = add(add(a, esc(ab, s)), esc(fuera, 0.06));
                match tri_sonda(mu, tmp, q, n, t) { Some(h) if h >= TRI_CONVEXO => {} _ => return false }
            }
            true
        });
        res[e] = lisa;
    }
    res
}

/// (para las pruebas) las aristas de un triángulo del mapa: lisa (true) o filosa, como triAristas
#[doc(hidden)]
pub fn aristas_de_tri(mundo: &Mundo, t: u32) -> [bool; 3] { tri_aristas(mundo, &RefCell::new(FxMapa::default()), &mut vec![], t) }

// ---------------- la grilla de cuerpos (CZ) ----------------
/// una grilla en el piso (x, z) de 2 m (tabla hash plana): qué cuerpos hay cerca sin revisarlos todos. Los de más de 6 × 6
/// celdas van aparte y se prueban siempre; lo que devuelve está en el orden de la lista de cuerpos
struct Cz { cab: Vec<i32>, sig: Vec<i32>, cx: Vec<i32>, cz: Vec<i32>, cu: Vec<i32>, grandes: Vec<usize>, marca: u32, marcas: Vec<u32>, ver: u64 }
impl Default for Cz { fn default() -> Self { Cz { cab: vec![-1; 4096], sig: vec![], cx: vec![], cz: vec![], cu: vec![], grandes: vec![], marca: 0, marcas: vec![], ver: u64::MAX } } }
#[inline] fn cz_balde(x: i32, z: i32) -> usize { ((x.wrapping_mul(73856093) ^ z.wrapping_mul(19349663)) & 4095) as usize }
/// czLim: su caja unida a su esfera (la caja de uno dormido puede haber quedado vieja)
#[inline] fn cz_lim(b: &Cuerpo) -> [f64; 6] {
    let (a, p, r) = (b.geo.aabb, b.pos, b.r);
    [a[0].min(p[0] - r), a[1].min(p[1] - r), a[2].min(p[2] - r), a[3].max(p[0] + r), a[4].max(p[1] + r), a[5].max(p[2] + r)]
}
impl Cz {
    fn armar(&mut self, cs: &[Cuerpo], ver: u64) {
        let (l, mg) = (CZ_LADO, CZ_MARGEN);
        self.cab.iter_mut().for_each(|x| *x = -1); self.sig.clear(); self.cx.clear(); self.cz.clear(); self.cu.clear(); self.grandes.clear(); self.ver = ver;
        if self.marcas.len() < cs.len() { self.marcas.resize(cs.len(), 0); }
        for (i, b) in cs.iter().enumerate() {
            let a = cz_lim(b);
            let (x0, x1, z0, z1) = (celda(a[0] - mg, l), celda(a[3] + mg, l), celda(a[2] - mg, l), celda(a[5] + mg, l));
            if !(x1 - x0 < 6 && z1 - z0 < 6) { self.grandes.push(i); continue; }
            for x in x0..=x1 { for z in z0..=z1 {
                let e = self.sig.len() as i32; let h = cz_balde(x, z);
                self.cx.push(x); self.cz.push(z); self.cu.push(i as i32); self.sig.push(self.cab[h]); self.cab[h] = e;
            } }
        }
    }
    /// cuerposCerca: los índices de los cuerpos cuya caja (con margen) toca la caja b
    fn cerca(&mut self, cs: &[Cuerpo], b: [f64; 6], out: &mut Vec<usize>) {
        out.clear(); self.marca = self.marca.wrapping_add(1); if self.marca == 0 { self.marcas.iter_mut().for_each(|x| *x = 0); self.marca = 1; }
        if self.marcas.len() < cs.len() { self.marcas.resize(cs.len(), 0); }
        let (m, l, mg) = (self.marca, CZ_LADO, CZ_MARGEN);
        let fuera = |c: &Cuerpo| { let a = cz_lim(c); b[3] < a[0] - mg || b[0] > a[3] + mg || b[4] < a[1] - mg || b[1] > a[4] + mg || b[5] < a[2] - mg || b[2] > a[5] + mg };
        for &i in &self.grandes { if !fuera(&cs[i]) { self.marcas[i] = m; out.push(i); } }
        let (cx1, cz0, cz1) = (celda(b[3], l), celda(b[2], l), celda(b[5], l));
        for x in celda(b[0], l)..=cx1 { for z in cz0..=cz1 {
            let mut e = self.cab[cz_balde(x, z)];
            while e >= 0 {
                let k = e as usize; e = self.sig[k];
                if self.cx[k] != x || self.cz[k] != z { continue; }
                let i = self.cu[k] as usize; if self.marcas[i] == m { continue; } self.marcas[i] = m;
                if !fuera(&cs[i]) { out.push(i); }
            }
        } }
        if out.len() > 1 { out.sort_unstable(); }
    }
}

// ---------------- los choques entre cuerpos, repartidos ----------------
/// cuántos hilos usa la física si no se le dice otra cosa: los núcleos que hay menos uno (el de dibujar), hasta 4
pub fn hilos_por_defecto() -> usize { std::thread::available_parallelism().map_or(1, |n| n.get()).saturating_sub(1).clamp(1, 4) }

/// lo que sale de los choques de una tanda de pares: sus contactos, cuántos de cada par y lo nuevo de la caché del SAT
type Tanda = (Vec<Contacto>, Vec<u32>, Vec<((u64, u64), Sep)>);
fn choques_tanda(cs: &[Cuerpo], pares: &[(usize, usize)], sep: &FxMapa<(u64, u64), Sep>, dt: f64, g: f64) -> Tanda {
    let (mut cts, mut por_par, mut nuevos) = (Vec::with_capacity(pares.len() * 2), Vec::with_capacity(pares.len()), vec![]);
    let mut d = Det { cts: &mut cts, sep, sep_nuevos: &mut nuevos, t: &[], mundo: None, dt, g, tmp: vec![] };
    for &(ia, ib) in pares {
        let n0 = d.cts.len();
        let (ea, eb) = (ent_cuerpo(&cs[ia], ia), ent_cuerpo(&cs[ib], ib));
        if ea.din { choque(&mut d, &ea, &eb); } else { choque(&mut d, &eb, &ea); }
        por_par.push((d.cts.len() - n0) as u32);
    }
    (cts, por_par, nuevos)
}
/// los choques de todos los pares (cuerpo contra cuerpo: no miran el mapa ni cambian los cuerpos), repartidos en tandas
/// entre los hilos del equipo; se juntan en el orden de los pares, así que sale lo mismo que con uno solo
fn choques_pares(cs: &[Cuerpo], pares: &[(usize, usize)], sep: &FxMapa<(u64, u64), Sep>, dt: f64, g: f64, eq: Option<&jxfisica::Equipo>) -> Tanda {
    let Some(eq) = eq.filter(|e| e.hilos() > 1 && pares.len() >= 2) else { return choques_tanda(cs, pares, sep, dt, g) };
    const TANDA: usize = 12;
    let n_t = pares.len().div_ceil(TANDA); let sig = AtomicUsize::new(0);
    let salidas: Vec<std::sync::Mutex<Vec<(usize, Tanda)>>> = (0..eq.hilos()).map(|_| std::sync::Mutex::new(vec![])).collect();
    eq.correr(&|h: usize| {
        let mut r: Vec<(usize, Tanda)> = vec![];
        loop {
            let k = sig.fetch_add(1, Ordering::Relaxed); if k >= n_t { break; }
            r.push((k, choques_tanda(cs, &pares[k * TANDA..((k + 1) * TANDA).min(pares.len())], sep, dt, g)));
        }
        *salidas[h].lock().unwrap() = r;
    });
    let mut todo: Vec<(usize, Tanda)> = salidas.into_iter().flat_map(|m| m.into_inner().unwrap()).collect();
    todo.sort_unstable_by_key(|x| x.0);
    let (mut cts, mut por_par, mut nuevos) = (Vec::with_capacity(pares.len() * 2), Vec::with_capacity(pares.len()), vec![]);
    for (_, (c, p, n)) in todo { cts.extend(c); por_par.extend(p); nuevos.extend(n); }
    (cts, por_par, nuevos)
}

// ---------------- el mundo de la física ----------------
pub struct Fisica {
    /// los cuerpos, en el orden en que se agregaron (PH.bodies: el orden cambia lo que resuelve la física)
    pub cuerpos: Vec<Cuerpo>,
    pub uniones: Vec<Union>,
    /// los contactos del último paso
    pub contactos: Vec<Contacto>,
    /// los golpes fuertes del último paso
    pub golpes: Vec<Golpe>,
    /// subpasos (PH.sub) y vueltas de velocidades (PH.velIter)
    pub sub: usize, pub vel_iter: usize,
    /// la gravedad (PH.gscale); None: la del mapa (`Mundo::gravedad`, como cargarMapa)
    pub gscale: Option<f64>,
    /// PH.time
    pub tiempo: f64,
    /// cuánto tardó el último paso (ms): detección y subpasos
    pub ms_det: f64, pub ms_sol: f64,
    /// lo mismo, por partes (ms): contra el mapa, paresCerca, los choques entre cuerpos, juntarlos, armar el solver y los
    /// subpasos
    pub ms_fases: [f64; 6],
    /// cuántos hilos puede usar (1: todo en el hilo del juego; da lo mismo, bit por bit) y desde cuántos pares o contactos
    /// vale la pena repartir (con menos, un hilo)
    pub hilos: usize, pub min_paralelo: usize,
    equipo: Option<jxfisica::Equipo>,
    sig_id: u32, ver: u64,
    indices: FxMapa<u32, usize>,
    cz: Cz,
    fijos: FxMapa<u64, Fijo>,
    sep: FxMapa<(u64, u64), Sep>,
    aristas: RefCell<AristasCel>,
    // (de trabajo)
    near: Vec<u64>, items: Vec<u32>, czp: Vec<usize>, tmp: Vec<u32>, sep_nuevos: Vec<((u64, u64), Sep)>, b_pares: Vec<(usize, usize)>,
    b_lim: Vec<[f64; 6]>, b_preg: Vec<(usize, [f64; 6])>, b_ix: Vec<usize>, b_grandes: Vec<usize>, b_orden: Vec<usize>, b_rango: Vec<u32>,
    b_llaves: Vec<f64>, b_ls: [Vec<f64>; 13], b_ln: Vec<u32>, b_lr: Vec<u32>, b_caja: Vec<([f64; 6], f64, bool)>, b_todos: Vec<usize>,
    /// el eje del barrido de paresCerca, cuántos pasos más se usa y con cuántos cuerpos se eligió
    b_eje: (usize, u32, usize),
    bcu: Vec<f64>, bco: Vec<f64>, bun: Vec<f64>,
}
impl Default for Fisica { fn default() -> Self { Fisica::nueva() } }

impl Fisica {
    pub fn nueva() -> Fisica {
        Fisica { cuerpos: vec![], uniones: vec![], contactos: vec![], golpes: vec![], sub: SUB, vel_iter: 2, gscale: None, tiempo: 0.0, ms_det: 0.0, ms_sol: 0.0, ms_fases: [0.0; 6],
            hilos: hilos_por_defecto(), min_paralelo: 96, equipo: None, sig_id: 1, ver: 0, indices: FxMapa::default(), cz: Cz::default(), fijos: FxMapa::default(), sep: FxMapa::default(), aristas: RefCell::new(FxMapa::default()),
            near: vec![], items: vec![], czp: vec![], tmp: vec![], sep_nuevos: vec![], b_pares: vec![],
            b_lim: vec![], b_preg: vec![], b_ix: vec![], b_grandes: vec![], b_orden: vec![], b_rango: vec![], b_llaves: vec![], b_ls: Default::default(), b_ln: vec![], b_lr: vec![], b_caja: vec![], b_todos: vec![], b_eje: (0, 0, 0), bcu: vec![], bco: vec![], bun: vec![] }
    }
    /// addBody: lo agrega (con su forma ya en el mundo) y devuelve su id
    pub fn agregar(&mut self, mut c: Cuerpo) -> u32 {
        c.id = self.sig_id; self.sig_id += 1; c.prev_pos = c.pos; c.prev_q = c.q; c.actualizar();
        let id = c.id; self.indices.insert(id, self.cuerpos.len()); self.cuerpos.push(c); self.ver += 1;
        id
    }
    /// removeBody: lo saca (y sus uniones); despierta a todos los dormidos
    pub fn quitar(&mut self, id: u32) -> Option<Cuerpo> {
        let i = *self.indices.get(&id)?;
        let c = self.cuerpos.remove(i);
        self.reindexar(); self.ver += 1;
        self.uniones.retain(|u| u.a != id && u.b != id);
        for o in self.cuerpos.iter_mut() { if o.duerme { o.despertar(); } }
        let k = (id as u64) << 16; self.sep.retain(|(a, b), _| (a >> 16) != (k >> 16) && (b >> 16) != (k >> 16));
        Some(c)
    }
    fn reindexar(&mut self) { self.indices.clear(); for (i, c) in self.cuerpos.iter().enumerate() { self.indices.insert(c.id, i); } }
    pub fn indice(&self, id: u32) -> Option<usize> { self.indices.get(&id).copied() }
    pub fn cuerpo(&self, id: u32) -> Option<&Cuerpo> { self.indice(id).map(|i| &self.cuerpos[i]) }
    /// para cambiarle algo (si se lo mueve, llamar a `Cuerpo::actualizar`, o usar `poner`)
    pub fn cuerpo_mut(&mut self, id: u32) -> Option<&mut Cuerpo> { self.ver += 1; let i = self.indice(id)?; Some(&mut self.cuerpos[i]) }
    /// lo pone en un lugar (y su forma en el mundo)
    pub fn poner(&mut self, id: u32, pos: V, q: Q) { if let Some(c) = self.cuerpo_mut(id) { c.pos = pos; c.q = q; c.actualizar(); } }
    pub fn despertar(&mut self, id: u32) { if let Some(c) = self.cuerpo_mut(id) { c.despertar(); } }
    pub fn dormir(&mut self, id: u32) { if let Some(c) = self.cuerpo_mut(id) { c.duerme = true; c.vel = [0.0; 3]; c.ang = [0.0; 3]; } }

    /// addJoint: une a y b en el punto `punto` (mundo) con el eje `eje`; devuelve el número de la unión
    pub fn unir(&mut self, a: u32, b: u32, punto: V, eje: V, op: OpUnion) -> Option<usize> {
        let (ia, ib) = (self.indice(a)?, self.indice(b)?);
        let (ca, cb) = (&self.cuerpos[ia], &self.cuerpos[ib]);
        let (qa, qb) = (qconj(ca.q), qconj(cb.q));
        let ax = norm(eje); let perp = if ax[1].abs() < 0.9 { norm(cruz(ax, [0.0, 1.0, 0.0])) } else { norm(cruz(ax, [1.0, 0.0, 0.0])) };
        let (h_a, h_b) = match op.eje_bisagra { Some(h) => { let h = norm(h); (rot(qa, h), rot(qb, h)) } None => ([0.0; 3], [0.0; 3]) };
        let u = Union { a, b, pa: rot(qa, sub(punto, ca.pos)), pb: rot(qb, sub(punto, cb.pos)), ax_a: rot(qa, ax), ax_b: rot(qb, ax), p_a: rot(qa, perp), p_b: rot(qb, perp), h_a, h_b,
            swing: op.swing, twist: op.twist, bisagra: op.bisagra, lo: op.lo, hi: op.hi };
        self.cuerpos[ia].unido = true; self.cuerpos[ib].unido = true;
        self.uniones.push(u); Some(self.uniones.len() - 1)
    }

    /// cuántas partes tiene un cuerpo para empujar al jugador (1 si no es compuesto; 0 si no está)
    pub fn partes(&self, id: u32) -> usize { self.cuerpo(id).map(|c| if c.hijos.is_empty() { 1 } else { c.hijos.len() }).unwrap_or(0) }
    /// empujarDeCuerpo de jugador.js (la parte geométrica): cuánto y hacia dónde sale una esfera (centro c, radio r) de la
    /// parte k del cuerpo `id`, si lo toca: (normal, profundidad)
    pub fn empuje(&self, id: u32, k: usize, c: V, r: f64) -> Option<(V, f64)> {
        let i = self.indice(id)?; let cu = &self.cuerpos[i]; let e = ent_cuerpo(cu, i);
        let e = if cu.hijos.is_empty() { e } else { if k >= cu.hijos.len() { return None; } ent_parte(&e, k) };
        let a = e.g.aabb;
        if c[0] + r < a[0] || c[0] - r > a[3] || c[1] + r < a[1] || c[1] - r > a[4] || c[2] + r < a[2] || c[2] - r > a[5] { return None; }
        match e.f {
            Forma::Casco(_) => {
                let (p, dentro, n, d) = casco_cercano(&e, c);
                if dentro { return Some((n, -d + r)); }
                let dv = sub(c, p); let l = largo(dv); if l >= r || l < 1e-6 { return None; }
                Some((esc(dv, 1.0 / l), r - l))
            }
            Forma::Esfera { r: rb } | Forma::Capsula { r: rb, .. } => {
                let ps: Vec<V> = if matches!(e.f, Forma::Esfera { .. }) { vec![e.g.pos] } else { cap_esferas(&e).to_vec() };
                let (mut bp, mut bl) = (ps[0], f64::MAX);
                for p in ps { let l = largo(sub(c, p)); if l < bl { bl = l; bp = p; } }
                let rr = rb + r; if bl >= rr || bl < 1e-6 { return None; }
                Some((esc(sub(c, bp), 1.0 / bl), rr - bl))
            }
            Forma::Compuesta { .. } => None,
        }
    }

    /// cuerposCerca: los ids de los cuerpos cerca de la caja [x0, y0, z0, x1, y1, z1]
    pub fn cerca(&mut self, b: [f64; 6]) -> Vec<u32> {
        if self.cz.ver != self.ver { self.cz.armar(&self.cuerpos, self.ver); }
        let mut o = std::mem::take(&mut self.czp); self.cz.cerca(&self.cuerpos, b, &mut o);
        let r = o.iter().map(|&i| self.cuerpos[i].id).collect(); self.czp = o; r
    }

    /// physStep: un paso de la física (detección y subpasos, después dormir lo que quedó quieto)
    pub fn paso(&mut self, mundo: &Mundo, dt: f64) {
        let gs = self.gscale.unwrap_or(mundo.gravedad as f64);
        self.tiempo += dt; self.golpes.clear();
        // (el equipo de hilos, si se pidieron más de uno y hay con qué: se arma la primera vez que hace falta)
        let h = self.hilos.max(1);
        let despiertos = self.cuerpos.iter().filter(|b| b.dinamico() && !b.duerme).count();
        if h == 1 { self.equipo = None; }
        else if despiertos >= self.min_paralelo / 2 && self.equipo.as_ref().map_or(true, |e| e.hilos() != h) { self.equipo = Some(jxfisica::Equipo::nuevo(h)); }
        // (que se vayan despertando mientras se arma lo que les toca: despertar un hilo dormido tarda)
        if let Some(e) = &self.equipo { if despiertos >= self.min_paralelo / 2 { e.despertar(); } }
        let t0 = Instant::now();
        self.detectar(mundo, dt, gs);
        let t1 = Instant::now();
        self.resolver(dt, gs);
        self.dormir_quietos(dt);
        self.ver += 1;
        self.ms_det = (t1 - t0).as_secs_f64() * 1000.0; self.ms_sol = t1.elapsed().as_secs_f64() * 1000.0;
    }

    /// mundoCerca: lo fijo del mapa que toca la caja (armándolo como cuerpo la primera vez)
    fn mundo_cerca(&mut self, mu: &Mundo, b: [f64; 6], out: &mut Vec<u64>) {
        out.clear(); let c = mu.celda as f64;
        let (ax, az, bx, bz) = (celda(b[0], c), celda(b[2], c), celda(b[3], c), celda(b[5], c));
        if (bx - ax + 1) as i64 * (bz - az + 1) as i64 > 400 { return; }
        mu.items_celdas(ax, az, bx, bz, &mut self.items);
        for &it in &self.items {
            if it & CUERPO != 0 {
                let i = (it & !CUERPO) as usize; let k = FIJO_CUERPO | i as u64;
                let f = self.fijos.entry(k).or_insert_with(|| fijo_cuerpo(mu, i)); let a = f.geo.aabb;
                if a[3] < b[0] || a[0] > b[3] || a[4] < b[1] || a[1] > b[4] || a[5] < b[2] || a[2] > b[5] { continue; }
                out.push(k);
            } else {
                if tri_fuera(mu, it, b) { continue; }
                self.fijos.entry(it as u64).or_insert_with(|| fijo_tri(mu, it)); out.push(it as u64);
            }
        }
    }

    /// detect: los contactos de este paso (con el mapa y entre cuerpos)
    fn detectar(&mut self, mu: &Mundo, dt: f64, gs: f64) {
        self.contactos.clear();
        // margen especulativo: lo que el cuerpo puede llegar a moverse en este cuadro
        let mut mx = 0.0f64;
        for b in self.cuerpos.iter_mut() {
            if !b.duerme { b.actualizar(); }
            b.spec = if b.dinamico() && !b.duerme { (0.01 + (largo(b.vel) + largo(b.ang) * b.r) * dt * 1.3 + GRAV * dt * dt).min(1.5) } else { 0.005 };
            if b.spec > mx { mx = b.spec; }
        }
        if self.sep.len() > 1 << 18 { self.sep.clear(); }   // (la caché del SAT no crece sin fin)
        // contra el mapa
        let reloj = Instant::now();
        let mut near = std::mem::take(&mut self.near);
        for i in 0..self.cuerpos.len() {
            let (bx, no_cruza) = {
                let a = &self.cuerpos[i]; if (a.duerme && !a.agarrado) || !a.dinamico() { continue; }
                let (x, m) = (a.geo.aabb, a.spec + 0.02); ([x[0] - m, x[1] - m, x[2] - m, x[3] + m, x[4] + m, x[5] + m], a.no_cruza)
            };
            self.mundo_cerca(mu, bx, &mut near);
            if no_cruza { lados_actualizar(&mut self.cuerpos[i], &near, &self.fijos, mu); }
            let Fisica { cuerpos, fijos, contactos, sep, aristas, tmp, sep_nuevos, .. } = self;
            let mut d = Det { cts: contactos, sep, sep_nuevos, t: &mu.t, mundo: Some((mu, aristas)), dt, g: GRAV * gs, tmp: std::mem::take(tmp) };
            let ea = ent_cuerpo(&cuerpos[i], i);
            for k in near.iter() { choque(&mut d, &ea, &ent_fijo(&fijos[k], *k)); }
            *tmp = d.tmp;
        }
        self.near = near;
        for (k, v) in self.sep_nuevos.drain(..) { self.sep.insert(k, v); }
        // pares de cuerpos (los filtros de antes del choque no dependen de quién se despierta en el medio: el par siempre
        // tiene uno despierto desde paresCerca, y despertar no cambia nada de lo que mira el choque)
        let reloj = { let t = Instant::now(); self.ms_fases[0] = (t - reloj).as_secs_f64() * 1000.0; t };
        let pares = self.pares_cerca(mx);
        let reloj = { let t = Instant::now(); self.ms_fases[1] = (t - reloj).as_secs_f64() * 1000.0; t };
        let mut lista = std::mem::take(&mut self.b_pares); lista.clear();
        for (ia, ib) in pares {
            let (a, b) = (&self.cuerpos[ia], &self.cuerpos[ib]);
            if !a.dinamico() && !b.dinamico() { continue; }
            if (a.duerme || !a.dinamico()) && (b.duerme || !b.dinamico()) { continue; }
            if a.grupo != 0 && a.grupo == b.grupo { continue; }
            if a.sin_fisica || b.sin_fisica { continue; }
            if a.no_choca.contains(&b.id) { continue; }
            lista.push((ia, ib));
        }
        // los choques de cada par (repartidos entre hilos) y, en el orden de los pares, sus contactos y quién despierta
        let eq = if lista.len() >= self.min_paralelo { self.equipo.as_ref() } else { None };
        let (cts, por_par, nuevos) = choques_pares(&self.cuerpos, &lista, &self.sep, dt, GRAV * gs, eq);
        let reloj = { let t = Instant::now(); self.ms_fases[2] = (t - reloj).as_secs_f64() * 1000.0; t };
        self.contactos.extend_from_slice(&cts);
        for (k, &(ia, ib)) in lista.iter().enumerate() {
            if por_par[k] > 0 {
                let (va, vb) = (self.cuerpos[ia].vivo(), self.cuerpos[ib].vivo());
                if self.cuerpos[ia].duerme && vb { self.cuerpos[ia].despertar(); }
                if self.cuerpos[ib].duerme && va { self.cuerpos[ib].despertar(); }
            }
        }
        for (k, v) in nuevos { self.sep.insert(k, v); }
        self.b_pares = lista; self.ms_fases[3] = reloj.elapsed().as_secs_f64() * 1000.0;
        // las partes unidas (muñeco) se despiertan juntas
        for _ in 0..3 { for u in 0..self.uniones.len() {
            let (Some(ia), Some(ib)) = (self.indice(self.uniones[u].a), self.indice(self.uniones[u].b)) else { continue };
            if self.cuerpos[ia].duerme != self.cuerpos[ib].duerme { self.cuerpos[ia].despertar(); self.cuerpos[ib].despertar(); }
        } }
    }

    /// paresCerca: los pares que se pueden tocar en este paso con al menos uno despierto, en el orden del barrido por x
    /// (cada par con el de menor x primero; el orden de los contactos cambia lo que resuelve la física). Los mismos que
    /// salen de la grilla (`pares_cerca_cz`: la pregunta a la grilla devuelve justo los cuerpos cuya caja con margen toca,
    /// y el orden final es el de `antes`, que no depende de cómo se juntaron), pero con un barrido sobre el eje más
    /// desparramado: las torres de cajas llenan las celdas de la grilla (que es en x, z) de cuerpos que están lejos en y.
    /// Con algo no finito o una caja dada vuelta, la grilla de siempre
    fn pares_cerca(&mut self, mx: f64) -> Vec<(usize, usize)> {
        let mg = CZ_MARGEN; let n = self.cuerpos.len();
        let (mut lim, mut preg, mut ix) = (std::mem::take(&mut self.b_lim), std::mem::take(&mut self.b_preg), std::mem::take(&mut self.b_ix));
        lim.clear(); preg.clear(); ix.clear();
        let mut bien = true;
        let caja_ok = |c: &[f64; 6]| (0..3).all(|k| c[k].is_finite() && c[k + 3].is_finite() && c[k] <= c[k + 3]);
        for b in &self.cuerpos {
            // (czLim con el margen, con las mismas cuentas que `fuera` de Cz::cerca)
            let a = cz_lim(b); let l = [a[0] - mg, a[1] - mg, a[2] - mg, a[3] + mg, a[4] + mg, a[5] + mg];
            bien &= caja_ok(&l); lim.push(l);
        }
        for (xi, x) in self.cuerpos.iter().enumerate() {
            if !x.dinamico() || x.duerme { continue; }
            let (xb, e) = (x.geo.aabb, x.spec + mx + 0.02);
            let q = [xb[0] - e, xb[1] - e, xb[2] - e, xb[3] + e, xb[4] + e, xb[5] + e];
            bien &= caja_ok(&q); preg.push((xi, q));
        }
        if !bien {
            self.b_lim = lim; self.b_preg = preg; self.b_ix = ix;
            self.cz.armar(&self.cuerpos, self.ver); return self.pares_cerca_cz(mx);
        }
        // el eje del barrido: con el que hay que mirar menos candidatos (se vuelve a elegir cada tanto: sólo cambia lo que
        // tarda). Los muy largos en ese eje se prueban siempre; los demás, ordenados por dónde empiezan (con uno que empieza
        // más allá del final de la pregunta ya no hay nada). Los órdenes arrancan del paso anterior: casi no cambian
        let mut grandes = std::mem::take(&mut self.b_grandes);
        let mut llaves = std::mem::take(&mut self.b_llaves);
        let ordenar = |ix: &mut Vec<usize>, k: usize, lim: &[[f64; 6]]| {
            ix.retain(|&i| i < n); if ix.len() != n { ix.clear(); ix.extend(0..n); }
            ix.sort_by(|&a, &b| lim[a][k].partial_cmp(&lim[b][k]).unwrap().then(a.cmp(&b)));
        };
        if self.b_eje.1 == 0 || self.b_eje.2 != n {
            let (mut ej, mut mejor) = (0usize, usize::MAX);
            for k in 0..3 {
                ordenar(&mut ix, k, &lim);
                let (mut largo_max, mut n_gr) = (0.0f64, 0usize); llaves.clear();
                for &i in ix.iter() { let d = lim[i][k + 3] - lim[i][k]; if d > 16.0 { n_gr += 1; } else { llaves.push(lim[i][k]); largo_max = largo_max.max(d); } }
                let holgura = largo_max * 1.001 + 1e-6;
                let cuantos: usize = preg.iter().map(|(_, q)| llaves.partition_point(|&v| v <= q[k + 3]) - llaves.partition_point(|&v| v < q[k] - holgura) + n_gr).sum();
                if cuantos < mejor { mejor = cuantos; ej = k; }
            }
            self.b_eje = (ej, 30, n); ix.clear();
        }
        self.b_eje.1 -= 1; let ej = self.b_eje.0;
        let mut todos = std::mem::take(&mut self.b_todos); ordenar(&mut todos, ej, &lim);
        grandes.clear(); ix.clear(); llaves.clear(); let mut largo_max = 0.0f64;
        let cs = &self.cuerpos;
        // (las cajas en el orden del barrido, seguidas y por columnas —la prueba de la caja es lo que más se repite: así se
        // hacen varias a la vez—, con el número y si está despierto)
        // `antes` como un número de orden de cada cuerpo
        let x0 = |i: usize| { let v = cs[i].geo.aabb[0]; if v.is_nan() { f64::MAX } else { v } };
        let mut orden = std::mem::take(&mut self.b_orden); orden.retain(|&i| i < n); if orden.len() != n { orden.clear(); orden.extend(0..n); }
        orden.sort_by(|&p, &q| x0(p).partial_cmp(&x0(q)).unwrap().then(p.cmp(&q)));
        let mut rango = std::mem::take(&mut self.b_rango); rango.clear(); rango.resize(n, 0);
        for (k, &i) in orden.iter().enumerate() { rango[i] = k as u32; }
        // (columnas: la caja de la grilla —czLim con margen—, la caja del cuerpo, su margen especulativo, su número de
        // orden y su número; despierto, en el bit alto del número)
        let mut ls = std::mem::take(&mut self.b_ls); for c in ls.iter_mut() { c.clear(); }
        let mut ln = std::mem::take(&mut self.b_ln); ln.clear(); let mut lr = std::mem::take(&mut self.b_lr); lr.clear();
        for &i in todos.iter() {
            let d = lim[i][ej + 3] - lim[i][ej];
            if d > 16.0 { grandes.push(i); } else {
                ix.push(i); llaves.push(lim[i][ej]); let a = cs[i].geo.aabb;
                for k in 0..6 { ls[k].push(lim[i][k]); ls[6 + k].push(a[k]); } ls[12].push(cs[i].spec);
                ln.push(((cs[i].dinamico() && !cs[i].duerme) as u32) << 31 | i as u32); lr.push(rango[i]); largo_max = largo_max.max(d);
            }
        }
        let holgura = largo_max * 1.001 + 1e-6;
        // (de cada cuerpo, lo que mira el par: si está despierto, su caja y su margen)
        let mut caja = std::mem::take(&mut self.b_caja); caja.clear();
        caja.extend(cs.iter().map(|b| (b.geo.aabb, b.spec, b.dinamico() && !b.duerme)));
        let par = |xi: usize, yi: usize, o: &mut Vec<u64>| {
            let (a, b) = if rango[xi] < rango[yi] { (xi, yi) } else { (yi, xi) };
            let ((aa, sa, _), (bb, sb, _)) = (caja[a], caja[b]); let g = sa + sb + 0.02;
            if bb[0] > aa[3] + g || bb[1] > aa[4] + g || bb[4] < aa[1] - g || bb[2] > aa[5] + g || bb[5] < aa[2] - g { return; }
            o.push((rango[a] as u64) << 32 | rango[b] as u64);
        };
        // (las preguntas son independientes y al final se ordena todo: se pueden repartir entre los hilos)
        let consultar = |preg: &[(usize, [f64; 6])], o: &mut Vec<u64>| { for &(xi, q) in preg {
            // (con todo finito, `toca` es lo mismo que !fuera de Cz::cerca)
            let toca = |l: &[f64; 6]| (q[3] >= l[0]) & (q[0] <= l[3]) & (q[4] >= l[1]) & (q[1] <= l[4]) & (q[5] >= l[2]) & (q[2] <= l[5]);
            let desde = llaves.partition_point(|&v| v < q[ej] - holgura); let hasta = llaves.partition_point(|&v| v <= q[ej + 3]);
            // (de a 16, todo junto sin saltos: si toca, si es el par una sola vez —dos despiertos: desde el de menor número— y
            // la caja con los márgenes de los dos, con el de menor x como A; después, sólo los que pasan)
            let (xa, xs, xr) = (caja[xi].0, caja[xi].1, rango[xi]);
            let mut k0 = desde;
            while k0 < hasta {
                let m = (hasta - k0).min(16); let mut va = [false; 16];
                let c = |k: usize| &ls[k][k0..k0 + m];
                let (l0, l1, l2, l3, l4, l5) = (c(0), c(1), c(2), c(3), c(4), c(5));
                let (a0, a1, a2, a3, a4, a5, sp) = (c(6), c(7), c(8), c(9), c(10), c(11), c(12));
                let (nn, rr) = (&ln[k0..k0 + m], &lr[k0..k0 + m]);
                for j in 0..m {
                    let toca = (q[3] >= l0[j]) & (q[0] <= l3[j]) & (q[4] >= l1[j]) & (q[1] <= l4[j]) & (q[5] >= l2[j]) & (q[2] <= l5[j]);
                    let yi = (nn[j] & 0x7fff_ffff) as usize; let una = (yi != xi) & !((nn[j] >> 31 != 0) & (yi < xi));
                    let g = if xr < rr[j] { xs + sp[j] } else { sp[j] + xs } + 0.02;
                    // (A = x, B = y o al revés; las mismas comparaciones que el par de siempre)
                    let (aa, bb) = if xr < rr[j] { ([xa[0], xa[1], xa[2], xa[3], xa[4], xa[5]], [a0[j], a1[j], a2[j], a3[j], a4[j], a5[j]]) } else { ([a0[j], a1[j], a2[j], a3[j], a4[j], a5[j]], [xa[0], xa[1], xa[2], xa[3], xa[4], xa[5]]) };
                    let lejos = (bb[0] > aa[3] + g) | (bb[1] > aa[4] + g) | (bb[4] < aa[1] - g) | (bb[2] > aa[5] + g) | (bb[5] < aa[2] - g);
                    va[j] = toca & una & !lejos;
                }
                for j in 0..m { if va[j] {
                    let (r0, r1) = (xr, rr[j]); let (ra, rb) = if r0 < r1 { (r0, r1) } else { (r1, r0) };
                    o.push((ra as u64) << 32 | rb as u64);
                } }
                k0 += m;
            }
            for &yi in &grandes { if yi == xi || (caja[yi].2 && yi < xi) { continue; } if toca(&lim[yi]) { par(xi, yi, o); } }
        } };
        let mut o: Vec<u64> = Vec::with_capacity(preg.len() * 4);
        match self.equipo.as_ref().filter(|e| e.hilos() > 1 && preg.len() >= self.min_paralelo && preg.len() >= 2) {
            Some(eq) => {
                const TANDA: usize = 24;
                let n_t = preg.len().div_ceil(TANDA); let sig = AtomicUsize::new(0);
                let salidas: Vec<std::sync::Mutex<Vec<u64>>> = (0..eq.hilos()).map(|_| std::sync::Mutex::new(vec![])).collect();
                eq.correr(&|h: usize| {
                    let mut r = vec![];
                    loop { let k = sig.fetch_add(1, Ordering::Relaxed); if k >= n_t { break; } consultar(&preg[k * TANDA..((k + 1) * TANDA).min(preg.len())], &mut r); }
                    *salidas[h].lock().unwrap() = r;
                });
                for m in salidas { o.extend(m.into_inner().unwrap()); }
            }
            None => consultar(&preg, &mut o),
        }
        o.sort_unstable();
        let r = o.iter().map(|&k| (orden[(k >> 32) as usize], orden[(k & 0xffff_ffff) as usize])).collect();
        self.b_lim = lim; self.b_preg = preg; self.b_ix = ix; self.b_grandes = grandes; self.b_orden = orden; self.b_rango = rango;
        self.b_llaves = llaves; self.b_ls = ls; self.b_ln = ln; self.b_lr = lr; self.b_caja = caja; self.b_todos = todos;
        r
    }

    /// paresCerca con la grilla (la de siempre: queda para cuando hay algo no finito)
    fn pares_cerca_cz(&mut self, mx: f64) -> Vec<(usize, usize)> {
        let cs = &self.cuerpos; let mut o: Vec<(usize, usize)> = vec![]; let mut czp = std::mem::take(&mut self.czp);
        let x0 = |i: usize| { let v = cs[i].geo.aabb[0]; if v.is_nan() { f64::MAX } else { v } };
        let antes = |p: usize, q: usize| { let (a, b) = (x0(p), x0(q)); a < b || (a == b && p < q) };
        for (xi, x) in cs.iter().enumerate() {
            if !x.dinamico() || x.duerme { continue; }
            let (xb, e) = (x.geo.aabb, x.spec + mx + 0.02);
            self.cz.cerca(cs, [xb[0] - e, xb[1] - e, xb[2] - e, xb[3] + e, xb[4] + e, xb[5] + e], &mut czp);
            for &yi in &czp {
                let y = &cs[yi];
                if yi == xi || (y.dinamico() && !y.duerme && yi < xi) { continue; }   // (dos despiertos: el par, una sola vez)
                let (a, b) = if antes(xi, yi) { (xi, yi) } else { (yi, xi) };
                let (aa, bb) = (cs[a].geo.aabb, cs[b].geo.aabb); let g = cs[a].spec + cs[b].spec + 0.02;
                if bb[0] > aa[3] + g || bb[1] > aa[4] + g || bb[4] < aa[1] - g || bb[2] > aa[5] + g || bb[5] < aa[2] - g { continue; }
                o.push((a, b));
            }
        }
        use std::cmp::Ordering::*;
        o.sort_by(|p, q| if p.0 != q.0 { if antes(p.0, q.0) { Less } else { Greater } } else if p.1 == q.1 { Equal } else if antes(p.1, q.1) { Less } else { Greater });
        self.czp = czp;
        o
    }

    /// los subpasos (integrar, uniones, contactos, velocidades, rebote) con jxfisica, como fisicaWasmPaso
    fn resolver(&mut self, dt: f64, gs: f64) {
        use jxfisica::{CO, CU, UN};
        let reloj = Instant::now();
        let n = self.cuerpos.len(); let mut idx = vec![-1i32; n]; let mut l: Vec<usize> = vec![];
        let mut pon = |i: usize, l: &mut Vec<usize>| -> i32 { if idx[i] < 0 { idx[i] = l.len() as i32; l.push(i); } idx[i] };
        // (sólo lo que el solver puede mover o lo que toca a algo que se mueve)
        for (i, b) in self.cuerpos.iter().enumerate() { if b.dinamico() && !b.duerme { pon(i, &mut l); } }
        for c in &self.contactos { pon(c.a, &mut l); if let Some(b) = c.b { pon(b, &mut l); } }
        let mut un_ix = vec![];
        for u in &self.uniones { if let (Some(a), Some(b)) = (self.indices.get(&u.a), self.indices.get(&u.b)) { un_ix.push((pon(*a, &mut l), pon(*b, &mut l), u)); } }
        // (lo fijo del mapa: un lugar más, sin masa, con la fricción y el rebote de un Body fijo)
        let fijo = l.len();
        let Fisica { bcu: cu, bco: co, bun: un, .. } = self;
        cu.clear(); cu.resize((l.len() + 1) * CU, 0.0); co.clear(); co.resize(self.contactos.len() * CO, 0.0); un.clear(); un.resize(un_ix.len() * UN, 0.0);
        for (k, &i) in l.iter().enumerate() {
            let b = &self.cuerpos[i]; let o = &mut cu[k * CU..(k + 1) * CU];
            o[0..3].copy_from_slice(&b.pos); o[3..7].copy_from_slice(&b.q); o[7..10].copy_from_slice(&b.vel); o[10..13].copy_from_slice(&b.ang);
            o[13..16].copy_from_slice(&b.prev_pos); o[16..20].copy_from_slice(&b.prev_q);
            o[20] = b.inv_masa; o[21..24].copy_from_slice(&b.inv_i);
            o[24] = ((b.dinamico() as u32) | ((b.duerme as u32) << 1) | ((b.agarrado as u32) << 2)) as f64; o[25] = b.fric; o[26] = b.rest;
        }
        { let o = &mut cu[fijo * CU..]; o[6] = 1.0; o[19] = 1.0; o[25] = 0.6; o[26] = 0.15; }
        for (k, c) in self.contactos.iter().enumerate() {
            let o = &mut co[k * CO..(k + 1) * CO]; let x = c.wb.unwrap_or(c.rb);
            o[0] = idx[c.a] as f64; o[1] = match c.b { Some(b) => idx[b] as f64, None => fijo as f64 }; o[2] = c.wb.is_some() as u8 as f64;
            o[3..6].copy_from_slice(&c.ra); o[6..9].copy_from_slice(&x); o[9..12].copy_from_slice(&c.n);
            o[12] = c.depth; o[13] = c.lam; o[14] = c.vn_pre; o[15] = c.activo as u8 as f64; o[16] = c.hit as u8 as f64;
        }
        for (k, (a, b, u)) in un_ix.iter().enumerate() {
            let o = &mut un[k * UN..(k + 1) * UN]; o[0] = *a as f64; o[1] = *b as f64;
            for (j, v) in [u.pa, u.pb, u.ax_a, u.ax_b, u.p_a, u.p_b, u.h_a, u.h_b].iter().enumerate() { o[2 + j * 3..5 + j * 3].copy_from_slice(v); }
            o[26] = u.swing; o[27] = u.twist; o[28] = u.bisagra as u8 as f64; o[29] = u.lo; o[30] = u.hi;
        }
        let medio = Instant::now();
        jxfisica::paso_con(cu, co, un, dt, self.sub, gs, self.vel_iter, self.equipo.as_ref(), self.min_paralelo);
        self.ms_fases[4] = (medio - reloj).as_secs_f64() * 1000.0; self.ms_fases[5] = medio.elapsed().as_secs_f64() * 1000.0;
        for (k, &i) in l.iter().enumerate() {
            let o = &cu[k * CU..(k + 1) * CU]; let b = &mut self.cuerpos[i];
            b.pos = [o[0], o[1], o[2]]; b.q = [o[3], o[4], o[5], o[6]]; b.vel = [o[7], o[8], o[9]]; b.ang = [o[10], o[11], o[12]];
            b.prev_pos = [o[13], o[14], o[15]]; b.prev_q = [o[16], o[17], o[18], o[19]];
        }
        let t = self.tiempo;
        let Fisica { contactos, cuerpos, golpes, bco, .. } = self;
        for (k, c) in contactos.iter_mut().enumerate() {
            let o = &bco[k * CO..(k + 1) * CO];
            c.lam = o[13]; c.vn_pre = o[14]; c.activo = o[15] > 0.5; c.hit = o[16] > 0.5;
            // (un golpe nuevo: como mucho uno cada 0,12 s por cuerpo)
            if o[17] > 0.5 && t - cuerpos[c.a].ult_golpe > 0.12 {
                cuerpos[c.a].ult_golpe = t; let otro = c.b.map(|b| cuerpos[b].id);
                golpes.push(Golpe { cuerpo: cuerpos[c.a].id, otro, v: -o[21], p: [o[18], o[19], o[20]], n: c.n });
            }
        }
    }

    /// dormir lo que quedó quieto (y amortiguar un poco el giro eterno)
    fn dormir_quietos(&mut self, dt: f64) {
        for b in self.cuerpos.iter_mut() {
            b.calmo = true; if !b.dinamico() || b.duerme { continue; }
            b.ang = esc(b.ang, (-dt * (0.12 + b.ang_damp)).exp()); b.vel = esc(b.vel, (-dt * (0.02 + b.damp)).exp());
            if b.pos[1] < -300.0 { b.muerto = true; }
            if b.agarrado { b.despertar(); b.calmo = false; continue; }
            // (las partes de un muñeco tiemblan un poco entre sus uniones: umbral más flojo)
            if largo2(b.vel) < (if b.unido { 0.03 } else { 0.012 }) && largo2(b.ang) < (if b.unido { 0.5 } else { 0.03 }) { b.sleep_t += dt; } else { b.sleep_t = 0.0; }
            // además: si en un segundo casi no se movió de lugar (tiembla en el mismo sitio), también está quieto
            if b.anc.is_none() { b.anc = Some((b.pos, b.q)); b.anc_t = 0.0; }
            let (ap, aq) = b.anc.unwrap(); let dq = (b.q[0] * aq[0] + b.q[1] * aq[1] + b.q[2] * aq[2] + b.q[3] * aq[3]).abs();
            if largo(sub(b.pos, ap)) > 0.016 || dq < 0.99966 { b.anc = Some((b.pos, b.q)); b.anc_t = 0.0; } else { b.anc_t += dt; }
            b.calmo = b.sleep_t > 0.7 || b.anc_t > 1.0;
        }
        // un muñeco se duerme entero o nada
        for _ in 0..3 { for u in 0..self.uniones.len() {
            let (Some(ia), Some(ib)) = (self.indice(self.uniones[u].a), self.indice(self.uniones[u].b)) else { continue };
            if self.cuerpos[ia].calmo != self.cuerpos[ib].calmo { self.cuerpos[ia].calmo = false; self.cuerpos[ib].calmo = false; }
        } }
        for b in self.cuerpos.iter_mut() { if b.calmo && !b.duerme && b.dinamico() { b.duerme = true; b.vel = [0.0; 3]; b.ang = [0.0; 3]; } }
    }

    /// raycast: el rayo (d de largo 1) contra el mapa y los cuerpos; lo primero que toca hasta `max`
    pub fn rayo(&mut self, mundo: &Mundo, o: V, d: V, max: f64, ignorar: &[u32]) -> Option<GolpeRayo> {
        let f = |v: V| [v[0] as f32, v[1] as f32, v[2] as f32];
        let mut best: Option<GolpeRayo> = mundo.rayo(f(o), f(d), max as f32).map(|g| GolpeRayo { t: g.t as f64, n: v32(g.n), p: [0.0; 3], cuerpo: None });
        // (un rayo corto pregunta a la grilla qué cuerpos hay en su camino; uno largo los recorre todos)
        let lista: Vec<usize> = if max <= 12.0 && self.cuerpos.len() > 24 {
            let e = esc(d, max); let b = [o[0].min(o[0] + e[0]), o[1].min(o[1] + e[1]), o[2].min(o[2] + e[2]), o[0].max(o[0] + e[0]), o[1].max(o[1] + e[1]), o[2].max(o[2] + e[2])];
            if self.cz.ver != self.ver { self.cz.armar(&self.cuerpos, self.ver); }
            let mut v = vec![]; self.cz.cerca(&self.cuerpos, b, &mut v); v
        } else { (0..self.cuerpos.len()).collect() };
        for i in lista {
            let lim = best.map_or(max, |b| b.t);
            let b = &mut self.cuerpos[i];
            if b.no_rayo || ignorar.contains(&b.id) { continue; }
            let m = sub(b.pos, o); let tc = dot(m, d); if tc < -b.r || tc > lim + b.r { continue; }
            if largo2(m) - tc * tc > b.r * b.r { continue; }
            if b.duerme { b.actualizar(); }
            let h = match &*b.forma {
                Forma::Compuesta { partes, .. } => {
                    let mut h: Option<(f64, V)> = None;
                    for (c, p) in b.hijos.iter().zip(partes.iter()) { if let Some(k) = rayo_forma(&c.geo, &p.forma, o, d, h.map_or(lim, |x| x.0)) { if h.map_or(true, |x| k.0 < x.0) { h = Some(k); } } }
                    h
                }
                fo => rayo_forma(&b.geo, fo, o, d, lim),
            };
            if let Some((t, n)) = h { if t < best.map_or(max, |b| b.t) { best = Some(GolpeRayo { t, n, p: [0.0; 3], cuerpo: Some(b.id) }); } }
        }
        best.map(|mut b| { b.p = add(o, esc(d, b.t)); b })
    }
}

/// rayHull
fn rayo_casco(g: &Geo, c: &Casco, o: V, d: V, tmax: f64) -> Option<(f64, V)> {
    let (mut t0, mut t1, mut n_in) = (0.0, tmax, None);
    for i in 0..g.wn.len() {
        let n = g.wn[i]; let dd = dot(n, g.wv[c.f[i].ix[0]]); let den = dot(n, d); let dist = dd - dot(n, o);
        if den.abs() < 1e-9 { if dist < 0.0 { return None; } continue; }
        let t = dist / den;
        if den < 0.0 { if t > t0 { t0 = t; n_in = Some(n); } } else if t < t1 { t1 = t; }
        if t0 > t1 { return None; }
    }
    n_in.map(|n| (t0, n))
}
/// raySphere
fn rayo_esfera(c: V, r: f64, o: V, d: V, tmax: f64) -> Option<(f64, V)> {
    let m = sub(o, c); let b = dot(m, d); let cc = dot(m, m) - r * r; if cc > 0.0 && b > 0.0 { return None; }
    let disc = b * b - cc; if disc < 0.0 { return None; } let t = -b - disc.sqrt(); if t < 0.0 || t > tmax { return None; }
    Some((t, norm(sub(add(o, esc(d, t)), c))))
}
/// rayForma
fn rayo_forma(g: &Geo, f: &Forma, o: V, d: V, l: f64) -> Option<(f64, V)> {
    match f {
        Forma::Casco(c) => rayo_casco(g, c, o, d, l),
        Forma::Esfera { r } => rayo_esfera(g.pos, *r, o, d, l),
        Forma::Capsula { r, .. } => {
            let (a, b) = (g.cap_a, g.cap_b); let mut h: Option<(f64, V)> = None;
            for p in [a, esc(add(a, b), 0.5), b] { if let Some(k) = rayo_esfera(p, *r, o, d, h.map_or(l, |x| x.0)) { if h.map_or(true, |x| k.0 < x.0) { h = Some(k); } } }
            h
        }
        Forma::Compuesta { .. } => None,
    }
}
