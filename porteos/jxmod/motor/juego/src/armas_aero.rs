//! Las tres armas de JXMod con el diseño nuevo (el dibujo del dueño, estilo aero): la Physics Gun blanca con dos garras de
//! vidrio azul en «C» y la esfera que brilla entre ellas; la Gravity Gun blanca con tres garras grandes de puntas de vidrio
//! rojo, anillos rojos y el núcleo encendido; la Tool Gun negra brillante con la banda de vidrio celeste, la pantalla de la
//! llave y dos garras rectas. Más largas y grandes que las de antes.
//!
//! Están hechas acá con piezas —tornos, cajas redondeadas, arcos y esferas— en una sola escena que se carga una vez; cada
//! cuadro se dibujan pegadas al hueso del arma de la vista (Base y Muzzle de la Physics y la Gravity; Python y muzzle de la
//! Tool Gun), así siguen las animaciones de siempre (sacarla, el balanceo, el tiro) y las manos son las mismas. Lo propio:
//! las garras se abren al agarrar y saltan al tirar, el retroceso, la esfera y el núcleo laten, la llave de la pantalla
//! parpadea. Las unidades del modelo son el largo de la base a la boca del arma de la vista (z adelante, y arriba, x derecha).
use jxmotor::escena::{Cabecera, Escena, ItemDin, Malla, Mat, FL_ARMA, FL_SIN_SOMBRA};
use jxmotor::mat::{self as m4, M4};
use std::f32::consts::{PI, TAU};

type V = [f32; 3];

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Tipo { Fisica, Gravedad, Tool }
impl Tipo {
    /// el arma de DEF_ARMAS que tiene diseño nuevo
    pub fn de(n: &str) -> Option<Tipo> { match n { "PhysicsGun" => Some(Tipo::Fisica), "GravityGun" => Some(Tipo::Gravedad), "ToolBaton" => Some(Tipo::Tool), _ => None } }
    fn k(self) -> usize { self as usize }
    /// los huesos de la vista a los que va pegada: la base y la boca
    pub fn huesos(self) -> (&'static str, &'static str) { match self { Tipo::Tool => ("Python", "muzzle"), _ => ("Base", "Muzzle") } }
    /// dónde queda respecto de la base (adelante, arriba, en unidades del modelo) y qué tan grande
    fn ajuste(self) -> (f32, f32, f32) { match self { Tipo::Fisica => (0.1, 0.06, 1.5), Tipo::Gravedad => (0.1, 0.06, 1.45), Tipo::Tool => (0.08, 0.08, 1.5) } }
}

// los números propios de las mallas y los materiales (negativos, lejos de los del paquete y de los del tubo, -3001…)
const MALLA0: i64 = -4000;
const M_BLANCO: i64 = -4100; const M_NEGRO: i64 = -4101; const M_GRIS: i64 = -4102;
const M_AZUL_V: i64 = -4103; const M_AZUL_L: i64 = -4104; const M_ROJO_V: i64 = -4105; const M_ROJO_L: i64 = -4106;
const M_CIAN_V: i64 = -4107; const M_CIAN_L: i64 = -4108; const M_PANTALLA: i64 = -4109;

/// cómo se mueve una pieza
#[derive(Clone, Copy, Debug)]
enum Rol {
    Fijo,
    /// una garra: gira alrededor de `eje` por `pivote` (abrir aleja la punta del eje del arma)
    Garra { pivote: V, eje: V },
    /// la esfera o el núcleo que late (escala alrededor de su centro)
    Late,
    /// la llave de la pantalla (parpadea)
    Icono,
}
#[derive(Clone, Debug)]
struct Pieza { malla: i64, mat: i64, rol: Rol, ni: u32, c: V, r: f32 }

/// las piezas de cada arma (Physics, Gravity, Tool)
pub struct Aero { piezas: [Vec<Pieza>; 3] }

// ---------------- vectores ----------------
fn add(a: V, b: V) -> V { [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
fn sub(a: V, b: V) -> V { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
fn esc(a: V, s: f32) -> V { [a[0] * s, a[1] * s, a[2] * s] }
fn dot(a: V, b: V) -> f32 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
fn cruz(a: V, b: V) -> V { [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
fn norm(a: V) -> V { let l = dot(a, a).sqrt(); if l > 1e-9 { esc(a, 1.0 / l) } else { [0.0, 1.0, 0.0] } }
/// girar `p` alrededor de `eje` (unitario) por `ang`, pasando por `o` (Rodrigues)
fn girar(p: V, o: V, eje: V, ang: f32) -> V {
    let v = sub(p, o); let (s, c) = ang.sin_cos();
    add(o, add(add(esc(v, c), esc(cruz(eje, v), s)), esc(eje, dot(eje, v) * (1.0 - c))))
}
/// la potencia con signo de la superelipse
fn sp(x: f32, e: f32) -> f32 { x.signum() * x.abs().powf(e) }

// ---------------- mallas ----------------
/// una malla en armado: puntos, normales y coordenadas, y los triángulos
#[derive(Default)]
struct Mb { p: Vec<V>, n: Vec<V>, uv: Vec<[f32; 2]>, ix: Vec<u32> }
impl Mb {
    /// una superficie con parámetros (u alrededor —cerrada si `cerrada`—, v a lo largo): las normales salen de las derivadas
    /// (las de los polos, del centro `c`), hacia afuera
    fn sup(&mut self, nu: usize, nv: usize, cerrada: bool, c: V, f: impl Fn(f32, f32) -> V) {
        let b = self.p.len() as u32; let h = 1e-3;
        for j in 0..=nv { for i in 0..=nu {
            let (u, v) = (i as f32 / nu as f32, j as f32 / nv as f32);
            let p = f(u, v);
            let du = sub(f((u + h).min(if cerrada { u + h } else { 1.0 }), v), f((u - h).max(if cerrada { u - h } else { 0.0 }), v));
            let dv = sub(f(u, (v + h).min(1.0)), f(u, (v - h).max(0.0)));
            let mut n = cruz(du, dv); if dot(n, n) < 1e-14 { n = sub(p, c); }
            let mut n = norm(n); if dot(n, sub(p, c)) < 0.0 { n = esc(n, -1.0); }
            self.p.push(p); self.n.push(n); self.uv.push([u, v]);
        } }
        let w = nu as u32 + 1;
        for j in 0..nv as u32 { for i in 0..nu as u32 {
            let (a, bb, cc, d) = (b + j * w + i, b + j * w + i + 1, b + (j + 1) * w + i, b + (j + 1) * w + i + 1);
            self.ix.extend_from_slice(&[a, cc, bb, bb, cc, d]);
        } }
    }
    /// girar y mover todo lo armado (la malla en su lugar)
    fn ubicar(&mut self, o: V, eje: V, ang: f32, mover: V) {
        for p in self.p.iter_mut() { *p = add(girar(*p, o, eje, ang), mover); }
        for n in self.n.iter_mut() { *n = girar(*n, [0.0; 3], eje, ang); }
    }
    /// los triángulos que miran para adentro (contra la normal de sus puntos), dados vuelta
    fn orientar(&mut self) {
        for t in self.ix.chunks_mut(3) {
            let (a, b, c) = (self.p[t[0] as usize], self.p[t[1] as usize], self.p[t[2] as usize]);
            let nt = cruz(sub(b, a), sub(c, a)); let nv = add(add(self.n[t[0] as usize], self.n[t[1] as usize]), self.n[t[2] as usize]);
            if dot(nt, nv) < 0.0 { t.swap(1, 2); }
        }
    }
}
/// un torno alrededor de z: el perfil (z, radio) —con radio 0 en las puntas queda cerrado—, aplastado en x y en y
fn torno(perfil: &[(f32, f32)], sx: f32, sy: f32) -> Mb {
    let mut m = Mb::default(); let n = perfil.len() - 1;
    let c = [0.0, 0.0, (perfil[0].0 + perfil[n].0) / 2.0];
    m.sup(28, n * 3, true, c, |u, v| {
        let x = v * n as f32; let k = (x.floor() as usize).min(n - 1); let t = x - k as f32;
        // (entre dos puntos del perfil, suave: Hermite con las pendientes de los vecinos)
        let r = |i: usize| perfil[i.min(n)].1; let z = |i: usize| perfil[i.min(n)].0;
        let (r0, r1) = (r(k), r(k + 1)); let (m0, m1) = ((r(k + 1) - r(k.saturating_sub(1))) * 0.5, (r(k + 2) - r(k)) * 0.5);
        let (t2, t3) = (t * t, t * t * t);
        let rr = (2.0 * t3 - 3.0 * t2 + 1.0) * r0 + (t3 - 2.0 * t2 + t) * m0 + (-2.0 * t3 + 3.0 * t2) * r1 + (t3 - t2) * m1;
        let zz = z(k) + (z(k + 1) - z(k)) * t;
        let a = u * TAU; [a.cos() * rr.max(0.0) * sx, a.sin() * rr.max(0.0) * sy, zz]
    });
    m
}
/// una caja redondeada (superelipsoide; `e` 2 es elipsoide, más alto más caja) con centro `c` y semiejes `r`
fn caja(c: V, r: V, e: f32) -> Mb {
    let mut m = Mb::default(); let k = 2.0 / e;
    m.sup(28, 18, true, c, |u, v| {
        let (a, b) = (u * TAU, (v - 0.5) * PI);
        [c[0] + r[0] * sp(b.cos(), k) * sp(a.cos(), k), c[1] + r[1] * sp(b.cos(), k) * sp(a.sin(), k), c[2] + r[2] * sp(b.sin(), k)]
    });
    m
}
fn esfera(c: V, r: f32) -> Mb { caja(c, [r, r, r], 2.0) }
/// una barra redondeada de `a` a `b` (ancho en x del plano, alto en el otro)
fn barra(a: V, b: V, ancho: f32, alto: f32) -> Mb {
    let d = sub(b, a); let l = dot(d, d).sqrt(); let mut m = caja([0.0, 0.0, 0.0], [ancho, alto, l / 2.0 + alto * 0.5], 5.0);
    // (de z a la dirección de la barra, por el plano y-z)
    let ang = d[1].atan2(d[2]); m.ubicar([0.0; 3], [-1.0, 0.0, 0.0], ang, esc(add(a, b), 0.5)); m
}
/// un arco (garra, anillo, asa): el centro `c`, el plano (e1, e2), el radio, de `a0` a `a1` (radianes desde e1 hacia e2), la
/// sección redondeada (medio ancho fuera del plano, medio grosor hacia afuera), con las puntas redondeadas
fn arco(c: V, e1: V, e2: V, rad: f32, a0: f32, a1: f32, ancho: f32, grosor: f32, afinar: f32) -> Mb {
    let mut m = Mb::default(); let nrm = norm(cruz(e1, e2)); let k = 2.0 / 4.0;
    let centro = add(c, esc(add(esc(e1, ((a0 + a1) / 2.0).cos()), esc(e2, ((a0 + a1) / 2.0).sin())), rad));
    m.sup(14, 30, true, centro, |u, v| {
        let a = a0 + (a1 - a0) * v; let rd = add(esc(e1, a.cos()), esc(e2, a.sin()));
        // (las puntas: la sección se cierra en un cuarto de círculo; hacia la punta, más fina)
        let fin = 0.12; let tap = |x: f32| if x < fin { (1.0 - ((fin - x) / fin).powi(2)).max(0.0).sqrt() } else { 1.0 };
        let s = tap(v).min(tap(1.0 - v)) * (1.0 - afinar * v);
        let w = u * TAU; let p = add(c, esc(rd, rad));
        add(p, add(esc(rd, grosor * s * sp(w.cos(), k)), esc(nrm, ancho * s * sp(w.sin(), k))))
    });
    m
}
fn juntar(mut a: Mb, b: Mb) -> Mb { let o = a.p.len() as u32; a.p.extend(b.p); a.n.extend(b.n); a.uv.extend(b.uv); a.ix.extend(b.ix.into_iter().map(|i| i + o)); a }

/// float → medio float (para las coordenadas)
fn f2h(v: f32) -> u16 {
    let x = v.to_bits(); let s = ((x >> 16) & 0x8000) as u16; let e = ((x >> 23) & 0xff) as i32 - 112; let mm = x & 0x7f_ffff;
    if e <= 0 { return s; } if e >= 31 { return s | 0x7bff; }
    let h = ((e as u32) << 10) + ((mm + 0x1000) >> 13); s | (if h > 0x7bff { 0x7bff } else { h as u16 })
}

struct Armador { datos: Vec<u8>, mallas: Vec<Malla>, sig: i64 }
impl Armador {
    /// la malla a los datos de la escena (14 bytes por punto: posición en 16 bits dentro de su caja, normal, coordenadas)
    fn malla(&mut self, mut mb: Mb) -> (i64, u32, V, f32) {
        mb.orientar();
        let (mut mn, mut mx) = ([f32::MAX; 3], [f32::MIN; 3]); for p in &mb.p { for k in 0..3 { mn[k] = mn[k].min(p[k]); mx[k] = mx[k].max(p[k]); } }
        let sc = [(mx[0] - mn[0]).max(1e-5), (mx[1] - mn[1]).max(1e-5), (mx[2] - mn[2]).max(1e-5)];
        while self.datos.len() % 4 != 0 { self.datos.push(0); }
        let vo = self.datos.len();
        for i in 0..mb.p.len() {
            for k in 0..3 { self.datos.extend_from_slice(&((((mb.p[i][k] - mn[k]) / sc[k]).clamp(0.0, 1.0) * 65535.0).round() as u16).to_le_bytes()); }
            let n = mb.n[i]; self.datos.extend_from_slice(&[(n[0] * 127.0) as i8 as u8, (n[1] * 127.0) as i8 as u8, (n[2] * 127.0) as i8 as u8, 0]);
            self.datos.extend_from_slice(&f2h(mb.uv[i][0]).to_le_bytes()); self.datos.extend_from_slice(&f2h(mb.uv[i][1]).to_le_bytes());
        }
        while self.datos.len() % 4 != 0 { self.datos.push(0); }
        let io = self.datos.len(); let i32_ = mb.p.len() > 65535;
        for &x in &mb.ix { if i32_ { self.datos.extend_from_slice(&x.to_le_bytes()); } else { self.datos.extend_from_slice(&(x as u16).to_le_bytes()); } }
        let id = self.sig; self.sig -= 1;
        self.mallas.push(Malla { id, v: mb.p.len() as u32, mn, sc, i32: i32_ as u8, ni: mb.ix.len() as u32, vo, io, lo: -1, so: -1, lm: -1 });
        let c = [mn[0] + sc[0] / 2.0, mn[1] + sc[1] / 2.0, mn[2] + sc[2] / 2.0];
        (id, mb.ix.len() as u32, c, dot(sc, sc).sqrt() / 2.0)
    }
    fn pieza(&mut self, mb: Mb, mat: i64, rol: Rol) -> Pieza { let (malla, ni, c, r) = self.malla(mb); Pieza { malla, mat, rol, ni, c, r } }
}

fn mat(id: i64, c: [f32; 4], pbr: [f32; 3], em: [f32; 3], blend: bool, unlit: bool) -> Mat {
    Mat { ti: [0.0; 12], pbr, fol: 0, id, t2: -1, terr: None, c, st: [1.0, 1.0, 0.0, 0.0], t: -1, blend: blend as u8, cut: 0, unlit: unlit as u8, add: 0, agua: 0, em }
}

/// la empuñadura y el gatillo (los tres la tienen)
fn empunadura(ar: &mut Armador, cuerpo: i64, acento: i64, v: &mut Vec<Pieza>) {
    let mut g = caja([0.0, 0.0, 0.0], [0.05, 0.15, 0.065], 4.0); g.ubicar([0.0; 3], [1.0, 0.0, 0.0], 0.32, [0.0, -0.22, -0.12]);
    v.push(ar.pieza(g, cuerpo, Rol::Fijo));
    // (el costado de la empuñadura, del color de los acentos, y el gatillo)
    let mut l = caja([0.0, 0.0, 0.0], [0.053, 0.1, 0.028], 4.0); l.ubicar([0.0; 3], [1.0, 0.0, 0.0], 0.32, [0.0, -0.25, -0.075]);
    v.push(ar.pieza(l, acento, Rol::Fijo));
    v.push(ar.pieza(caja([0.0, -0.15, 0.02], [0.018, 0.04, 0.02], 3.0), acento, Rol::Fijo));
    v.push(ar.pieza(arco([0.0, -0.125, -0.02], [0.0, 0.0, 1.0], [0.0, -1.0, 0.0], 0.075, 0.2, 2.2, 0.014, 0.012, 0.0), cuerpo, Rol::Fijo));
}
/// la estrella de cuatro puntas del costado (superelipse cóncava, apenas afuera del cuerpo)
fn estrella(ar: &mut Armador, c: V, r: f32, matl: i64, v: &mut Vec<Pieza>) {
    let mut m = Mb::default(); let k = 2.0 / 0.55;
    m.sup(32, 6, true, c, |u, w| { let a = u * TAU; let s = 1.0 - w; [c[0] + 0.004 * (w * PI).sin(), c[1] + r * s * sp(a.sin(), k), c[2] + r * s * sp(a.cos(), k)] });
    v.push(ar.pieza(m, matl, Rol::Icono));
}
/// un asa arriba (la Gravity y la Tool)
fn asa(ar: &mut Armador, z0: f32, z1: f32, y: f32, mat_: i64, v: &mut Vec<Pieza>) {
    let c = [0.0, y, (z0 + z1) / 2.0]; let r = (z1 - z0) / 2.0;
    v.push(ar.pieza(arco(c, [0.0, 0.0, -1.0], [0.0, 1.0, 0.0], r, 0.15, PI - 0.15, 0.026, 0.024, 0.0), mat_, Rol::Fijo));
}

impl Aero {
    /// las tres armas y la escena con sus mallas y materiales (se carga en el motor una vez)
    pub fn armar() -> (Aero, Escena) {
        let mut ar = Armador { datos: vec![], mallas: vec![], sig: MALLA0 };
        let (x, y, z) = ([1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]);
        // ———— Physics Gun: blanca, garras de vidrio azul en «C» y la esfera ————
        let mut f = vec![];
        f.push(ar.pieza(torno(&[(-0.32, 0.0), (-0.31, 0.07), (-0.26, 0.115), (-0.1, 0.13), (0.2, 0.125), (0.45, 0.108), (0.6, 0.115), (0.68, 0.1), (0.7, 0.0)], 0.86, 1.0), M_BLANCO, Rol::Fijo));
        // (el tubo de vidrio de arriba, a lo largo)
        f.push(ar.pieza(caja([0.0, 0.1, 0.1], [0.06, 0.055, 0.34], 2.4), M_AZUL_V, Rol::Fijo));
        f.push(ar.pieza(caja([0.0, 0.1, 0.1], [0.03, 0.03, 0.3], 2.0), M_AZUL_L, Rol::Late));
        // (el aro de adelante y la boca)
        f.push(ar.pieza(arco([0.0, 0.0, 0.69], x, y, 0.09, 0.0, TAU, 0.03, 0.03, 0.0), M_AZUL_V, Rol::Fijo));
        f.push(ar.pieza(torno(&[(0.62, 0.0), (0.64, 0.06), (0.74, 0.055), (0.76, 0.0)], 1.0, 1.0), M_GRIS, Rol::Fijo));
        // (la esfera: el núcleo que brilla y el vidrio alrededor)
        let s = [0.0, 0.0, 0.95];
        f.push(ar.pieza(esfera(s, 0.095), M_AZUL_L, Rol::Late));
        f.push(ar.pieza(esfera(s, 0.125), M_AZUL_V, Rol::Late));
        // (las dos garras en «C» alrededor de la esfera: de atrás —junto al aro— hasta adelante, la punta hacia adentro)
        for sg in [1.0f32, -1.0] {
            let e2 = esc(y, sg); let (a0, a1) = (2.62f32, 0.4f32);
            let g = arco(s, z, e2, 0.27, a0, a1, 0.038, 0.045, 0.35);
            let piv = add(s, esc(add(esc(z, a0.cos()), esc(e2, a0.sin())), 0.27));
            f.push(ar.pieza(g, M_AZUL_V, Rol::Garra { pivote: piv, eje: norm(cruz(z, e2)) }));
        }
        estrella(&mut ar, [0.112, 0.0, 0.3], 0.04, M_AZUL_L, &mut f);
        estrella(&mut ar, [-0.112, 0.0, 0.3], 0.04, M_AZUL_L, &mut f);
        empunadura(&mut ar, M_BLANCO, M_AZUL_V, &mut f);
        // ———— Gravity Gun: blanca, anillos y puntas de vidrio rojo, tres garras grandes y el núcleo ————
        let mut g = vec![];
        g.push(ar.pieza(torno(&[(-0.32, 0.0), (-0.31, 0.08), (-0.24, 0.13), (0.0, 0.145), (0.25, 0.135), (0.42, 0.125), (0.44, 0.0)], 0.9, 1.0), M_BLANCO, Rol::Fijo));
        g.push(ar.pieza(torno(&[(0.4, 0.0), (0.41, 0.14), (0.54, 0.14), (0.55, 0.0)], 1.0, 1.0), M_ROJO_V, Rol::Fijo));
        g.push(ar.pieza(torno(&[(0.53, 0.0), (0.54, 0.125), (0.6, 0.125), (0.61, 0.0)], 1.0, 1.0), M_BLANCO, Rol::Fijo));
        g.push(ar.pieza(torno(&[(0.59, 0.0), (0.6, 0.075), (0.8, 0.07), (0.82, 0.0)], 1.0, 1.0), M_ROJO_V, Rol::Fijo));
        g.push(ar.pieza(torno(&[(0.58, 0.0), (0.6, 0.04), (0.84, 0.04), (0.86, 0.0)], 1.0, 1.0), M_ROJO_L, Rol::Late));
        let cg = [0.0, 0.0, 0.84];
        for k in 0..3 {
            let a = PI / 2.0 + k as f32 * TAU / 3.0; let d = [a.cos(), a.sin(), 0.0];
            let (a0, a1) = (2.72f32, 0.5f32); let piv = add(cg, esc(add(esc(z, a0.cos()), esc(d, a0.sin())), 0.27)); let eje = norm(cruz(z, d));
            g.push(ar.pieza(arco(cg, z, d, 0.27, a0, a1 + 0.35, 0.034, 0.045, 0.2), M_BLANCO, Rol::Garra { pivote: piv, eje }));
            g.push(ar.pieza(arco(cg, z, d, 0.275, a1 + 0.4, a1, 0.04, 0.05, 0.2), M_ROJO_V, Rol::Garra { pivote: piv, eje }));
        }
        asa(&mut ar, -0.2, 0.24, 0.13, M_BLANCO, &mut g);
        estrella(&mut ar, [0.13, 0.0, 0.12], 0.045, M_ROJO_L, &mut g);
        estrella(&mut ar, [-0.13, 0.0, 0.12], 0.045, M_ROJO_L, &mut g);
        empunadura(&mut ar, M_BLANCO, M_ROJO_V, &mut g);
        // ———— Tool Gun: negra brillante, banda de vidrio celeste, la pantalla con la llave y dos garras rectas ————
        let mut t = vec![];
        t.push(ar.pieza(caja([0.0, 0.0, 0.16], [0.1, 0.12, 0.44], 4.5), M_NEGRO, Rol::Fijo));
        t.push(ar.pieza(caja([0.0, 0.0, 0.08], [0.106, 0.126, 0.13], 4.5), M_CIAN_V, Rol::Fijo));
        t.push(ar.pieza(caja([0.0, 0.0, 0.08], [0.06, 0.07, 0.12], 3.0), M_CIAN_L, Rol::Late));
        // (la pantalla del costado y la llave que brilla encima)
        // (del lado izquierdo: el que ve el jugador con el arma a la derecha)
        // (de los dos costados: según cómo se tenga, se ve uno u otro)
        for sx in [1.0f32, -1.0] {
            t.push(ar.pieza(caja([0.1 * sx, 0.02, 0.38], [0.014, 0.085, 0.15], 4.0), M_PANTALLA, Rol::Fijo));
            let llave = juntar(barra([0.118 * sx, -0.035, 0.31], [0.118 * sx, 0.045, 0.42], 0.005, 0.013), arco([0.118 * sx, 0.062, 0.445], [0.0, 0.0, 1.0], [0.0, 1.0, 0.0], 0.028, 0.6, 5.6, 0.005, 0.008, 0.0));
            t.push(ar.pieza(llave, M_CIAN_L, Rol::Icono));
        }
        // (la boca y las dos garras rectas)
        t.push(ar.pieza(caja([0.0, 0.0, 0.64], [0.075, 0.08, 0.07], 4.0), M_GRIS, Rol::Fijo));
        for sg in [1.0f32, -1.0] {
            let p0 = [0.0, 0.05 * sg, 0.66]; let p1 = [0.0, 0.14 * sg, 0.8]; let p2 = [0.0, 0.13 * sg, 0.98];
            let gm = juntar(barra(p0, p1, 0.035, 0.022), barra(p1, p2, 0.035, 0.022));
            t.push(ar.pieza(gm, M_CIAN_V, Rol::Garra { pivote: p0, eje: esc(x, -sg) }));
        }
        asa(&mut ar, -0.16, 0.3, 0.13, M_CIAN_V, &mut t);
        empunadura(&mut ar, M_NEGRO, M_CIAN_V, &mut t);
        // (los materiales: blanco y negro brillantes, vidrios que dejan ver y brillan un poco, y lo que da luz)
        let mats = vec![
            mat(M_BLANCO, [0.93, 0.95, 0.98, 1.0], [0.26, 0.0, 0.05], [0.0; 3], false, false),
            mat(M_NEGRO, [0.03, 0.035, 0.045, 1.0], [0.08, 0.0, 0.09], [0.0; 3], false, false),
            mat(M_GRIS, [0.2, 0.23, 0.28, 1.0], [0.35, 0.4, 0.05], [0.0; 3], false, false),
            mat(M_AZUL_V, [0.28, 0.64, 1.0, 0.62], [0.06, 0.0, 0.06], [0.06, 0.22, 0.55], true, false),
            mat(M_AZUL_L, [0.62, 0.88, 1.0, 1.0], [0.3, 0.0, 0.04], [1.4, 2.6, 4.0], false, false),
            mat(M_ROJO_V, [1.0, 0.2, 0.16, 0.62], [0.06, 0.0, 0.06], [0.5, 0.05, 0.03], true, false),
            mat(M_ROJO_L, [1.0, 0.55, 0.42, 1.0], [0.3, 0.0, 0.04], [4.2, 1.0, 0.55], false, false),
            mat(M_CIAN_V, [0.22, 0.82, 1.0, 0.58], [0.06, 0.0, 0.06], [0.04, 0.3, 0.45], true, false),
            mat(M_CIAN_L, [0.55, 0.95, 1.0, 1.0], [0.3, 0.0, 0.04], [1.1, 3.0, 3.8], false, false),
            mat(M_PANTALLA, [0.02, 0.06, 0.13, 1.0], [0.05, 0.0, 0.08], [0.03, 0.12, 0.26], false, false),
        ];
        let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: ar.mallas, mats, texs: vec![], lms: vec![], items: vec![], agua: None, cielo: None };
        (Aero { piezas: [f, g, t] }, Escena { c: cab, datos: ar.datos })
    }

    /// el arma `tipo` pegada a la vista: `base` y `boca` son las matrices de los huesos (Tipo::huesos: la base da el lugar —con
    /// el vaivén, sacarla y el tiro de siempre— y la distancia a la boca el tamaño), `ojo`, `mira` y `arriba` la cámara (el
    /// arma apunta a lo que se mira, a 12 m), `t` el reloj, `abre` cuánto se abren las garras (0 a 1: agarrando), `tiro` los
    /// segundos desde el último tiro (el retroceso, el salto de las garras, el destello)
    pub fn items(&self, tipo: Tipo, base: &M4, boca: &M4, ojo: V, mira: V, arriba: V, t: f32, abre: f32, tiro: f32, out: &mut Vec<ItemDin>) {
        let pb = [base[12], base[13], base[14]]; let pm = [boca[12], boca[13], boca[14]];
        let d = sub(pm, pb); let largo = dot(d, d).sqrt(); if !(largo > 1e-4) { return; }
        // (como un arma de primera persona: casi paralela a la vista —apunta lejos—, la punta un poco abajo y girada hacia la
        // izquierda, así se ve su costado, la esfera y las garras, como en el dibujo)
        let fw = norm(sub(add(ojo, esc(mira, 40.0)), pb));
        let rt = norm(cruz(arriba, fw)); let up = cruz(fw, rt);
        let (cab, gir) = (0.08f32, 0.38f32);
        let fw2 = norm(sub(esc(fw, cab.cos()), esc(up, cab.sin()))); let up2 = norm(cruz(fw2, rt));
        let rt3 = norm(add(esc(rt, gir.cos()), esc(up2, gir.sin()))); let up3 = norm(cruz(fw2, rt3)); let (fw, rt, up) = (fw2, rt3, up3);
        let (dz, dy, k) = tipo.ajuste(); let s = largo * k;
        // (el retroceso: hacia atrás y un poco para arriba, y se vuelve)
        let kick = if tiro < 1.0 { (-tiro * 11.0).exp() } else { 0.0 };
        let o = add(add(pb, esc(fw, (dz - 0.07 * kick) * s)), esc(up, (dy + 0.015 * kick) * s));
        let modelo: M4 = [rt[0] * s, rt[1] * s, rt[2] * s, 0.0, up[0] * s, up[1] * s, up[2] * s, 0.0, fw[0] * s, fw[1] * s, fw[2] * s, 0.0, o[0], o[1], o[2], 1.0];
        let late = 1.0 + 0.05 * (t * 4.2).sin() + 0.12 * abre + 0.25 * kick;
        let ang_garra = abre * 0.32 + kick * if tipo == Tipo::Tool { -0.25 } else { 0.22 };
        for pz in &self.piezas[tipo.k()] {
            let local: M4 = match pz.rol {
                Rol::Fijo => m4::id(),
                Rol::Late => escalar_en(pz.c, late),
                Rol::Icono => escalar_en(pz.c, 1.0 + 0.08 * (t * 2.5).sin().max(0.0)),
                Rol::Garra { pivote, eje } => {
                    // (el signo que aleja la punta del eje del arma)
                    let punta = add(pz.c, esc(sub(pz.c, pivote), 1.0)); let r0 = punta[0] * punta[0] + punta[1] * punta[1];
                    let q = girar(punta, pivote, eje, 0.1); let sg = if q[0] * q[0] + q[1] * q[1] > r0 { 1.0 } else { -1.0 };
                    girar_en(pivote, eje, ang_garra * sg)
                }
            };
            let mm = m4::mul(&modelo, &local); let c = punto(&mm, pz.c);
            out.push(ItemDin { m: pz.malla, s0: 0, sn: pz.ni, mat: pz.mat, mm, esf: [c[0], c[1], c[2], pz.r * s * 1.4], fl: FL_SIN_SOMBRA | FL_ARMA, h: vec![] });
        }
    }
}
fn punto(m: &M4, p: V) -> V { [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] }
/// escalar alrededor de `c`
fn escalar_en(c: V, k: f32) -> M4 { [k, 0.0, 0.0, 0.0, 0.0, k, 0.0, 0.0, 0.0, 0.0, k, 0.0, c[0] * (1.0 - k), c[1] * (1.0 - k), c[2] * (1.0 - k), 1.0] }
/// girar alrededor de `eje` (unitario) por `o`
fn girar_en(o: V, eje: V, ang: f32) -> M4 {
    let cx = girar([1.0, 0.0, 0.0], [0.0; 3], eje, ang); let cy = girar([0.0, 1.0, 0.0], [0.0; 3], eje, ang); let cz = girar([0.0, 0.0, 1.0], [0.0; 3], eje, ang);
    let t = sub(o, girar(o, [0.0; 3], eje, ang));
    [cx[0], cx[1], cx[2], 0.0, cy[0], cy[1], cy[2], 0.0, cz[0], cz[1], cz[2], 0.0, t[0], t[1], t[2], 1.0]
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn armas_armadas() {
        let (a, e) = Aero::armar();
        for (k, p) in a.piezas.iter().enumerate() { assert!(p.len() >= 8, "arma {k}: {} piezas", p.len()); }
        assert!(e.c.mallas.iter().all(|m| m.ni % 3 == 0 && m.v > 10 && m.sc.iter().all(|x| x.is_finite())));
        // (todas las normales y puntos son números)
        assert!(e.c.mallas.len() > 30 && e.datos.len() > 100_000, "{} mallas, {} bytes", e.c.mallas.len(), e.datos.len());
        // (las garras se abren: la punta se aleja del eje)
        let base = m4::id(); let mut boca = m4::id(); boca[14] = 0.5;
        let (mut c0, mut c1) = (vec![], vec![]);
        let (ojo, mira, up) = ([0.0, 0.0, -12.0], [0.0, 0.0, 1.0], [0.0, 1.0, 0.0]);
        a.items(Tipo::Fisica, &base, &boca, ojo, mira, up, 0.0, 0.0, 9.0, &mut c0); a.items(Tipo::Fisica, &base, &boca, ojo, mira, up, 0.0, 1.0, 9.0, &mut c1);
        let gar: Vec<usize> = a.piezas[0].iter().enumerate().filter(|(_, p)| matches!(p.rol, Rol::Garra { .. })).map(|(i, _)| i).collect();
        for i in gar { let (r0, r1) = (c0[i].esf[1].hypot(c0[i].esf[0]), c1[i].esf[1].hypot(c1[i].esf[0])); assert!(r1 > r0, "garra {i}: {r0} → {r1}"); }
    }
}
