//! Los vehículos, como vehiculos.js de la versión web: autos (suspensión por rueda con los WheelCollider del juego: radio,
//! recorrido, resorte y amortiguador; motor, freno, dirección y marcha atrás), moto (dos ruedas que se mantiene derecha),
//! la bici con cohete, helicópteros, avión, asientos (sillas, banco, inodoro, cama, bote inflable) y los botes que se
//! manejan en el agua (el Airboat de HL2 y los de los addons: `bote` en el prefab; flotan con flotar.rs). Subir y bajar,
//! la cámara de adentro, los sonidos (por nombre) y la bocina.
//! Las mismas cuentas y en el mismo orden que el JS (verificado contra la web corriendo en node: vehiculo.rs de las
//! pruebas). Lo que el JS guarda en el jugador (JUG.vehiculo, JUG.asiento, JUG.fpVeh) está en `Vehiculos`; el jugador
//! mismo (jugador.rs) no se toca: mientras maneja, quien juega no corre su paso y lo pone donde dice `Camara::jugador`.
//! La cabina de cada asiento de los autos (vehCols y vehCabina: el almohadón y el piso de adelante, medidos en la malla
//! del auto) para sentar bien al personaje (`Vehiculos::cabina` y personaje.rs: asientoPose).
//! No están: la red, la interfaz HTML, las partículas (llamas del avión, fuego del cohete: se dice dónde), la luz del
//! cohete y las abolladuras (destruccion.js).
use crate::fisica::{add, cruz, dot, esc, hypot_js, largo, norm, qeje, qmul, rot, rot_inv, sub, Cuerpo, Fisica, Q, QID, V, GRAV};
use crate::flotar::{Aguas, Flota};
use crate::forma::PrefabFisica;
use crate::mundo::Mundo;
use crate::objetos::Prefab;
use crate::paquete::Paquete;
use jxmotor::escena::ItemDin;
use jxmotor::mat::{self as m4, M4};
use serde_json::Value;

#[inline] fn clamp(x: f64, a: f64, b: f64) -> f64 { if x < a { a } else if x > b { b } else { x } }
/// Math.sign (el de Rust da 1 con el cero)
#[inline] fn signo(x: f64) -> f64 { if x > 0.0 { 1.0 } else if x < 0.0 { -1.0 } else { x } }
fn verdad(v: &Value) -> bool { match v { Value::Null => false, Value::Bool(b) => *b, Value::Number(n) => n.as_f64().map_or(false, |x| x != 0.0), Value::String(s) => !s.is_empty(), _ => true } }
fn num(v: &Value, d: f64) -> f64 { v.as_f64().unwrap_or(d) }
fn arr3(v: &Value, d: V) -> V { if v.is_array() { [num(&v[0], d[0]), num(&v[1], d[1]), num(&v[2], d[2])] } else { d } }
fn arr4(v: &Value) -> Q { if v.is_array() { [num(&v[0], 0.0), num(&v[1], 0.0), num(&v[2], 0.0), num(&v[3], 1.0)] } else { QID } }

// ---------------- las matrices del modelo (Float32Array en la web: cada número redondeado a f32) ----------------
type M = [f64; 16];
fn r32(m: M) -> M { m.map(|x| x as f32 as f64) }
/// m4trs
fn trs(p: V, r: Q, s: V) -> M {
    let (x, y, z, w) = (r[0], r[1], r[2], r[3]);
    [(1.0 - 2.0 * (y * y + z * z)) * s[0], 2.0 * (x * y + z * w) * s[0], 2.0 * (x * z - y * w) * s[0], 0.0,
     2.0 * (x * y - z * w) * s[1], (1.0 - 2.0 * (x * x + z * z)) * s[1], 2.0 * (y * z + x * w) * s[1], 0.0,
     2.0 * (x * z + y * w) * s[2], 2.0 * (y * z - x * w) * s[2], (1.0 - 2.0 * (x * x + y * y)) * s[2], 0.0,
     p[0], p[1], p[2], 1.0]
}
/// m4mul (a × b, por columnas)
fn mul(a: &M, b: &M) -> M {
    let mut o = [0.0; 16];
    for c in 0..4 { for r in 0..4 { o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; } }
    o
}
/// m4pt
fn pt(m: &M, p: V) -> V { [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] }
/// m4quat (el giro de una matriz, sin la escala)
fn m_quat(m: &M) -> Q {
    let (sx, sy, sz) = ((m[0] * m[0] + m[1] * m[1] + m[2] * m[2]).sqrt(), (m[4] * m[4] + m[5] * m[5] + m[6] * m[6]).sqrt(), (m[8] * m[8] + m[9] * m[9] + m[10] * m[10]).sqrt());
    let (a, b, c, d, e, f, g, h, k) = (m[0] / sx, m[1] / sx, m[2] / sx, m[4] / sy, m[5] / sy, m[6] / sy, m[8] / sz, m[9] / sz, m[10] / sz);
    let t = a + e + k; let (x, y, z, w);
    if t > 0.0 { let s = (t + 1.0).sqrt() * 2.0; w = 0.25 * s; x = (f - h) / s; y = (g - c) / s; z = (b - d) / s; }
    else if a > e && a > k { let s = (1.0 + a - e - k).sqrt() * 2.0; w = (f - h) / s; x = 0.25 * s; y = (d + b) / s; z = (g + c) / s; }
    else if e > k { let s = (1.0 + e - a - k).sqrt() * 2.0; w = (g - c) / s; x = (d + b) / s; y = 0.25 * s; z = (h + f) / s; }
    else { let s = (1.0 + k - a - e).sqrt() * 2.0; w = (b - d) / s; x = (g + c) / s; y = (h + f) / s; z = 0.25 * s; }
    let l = (x * x + y * y + z * z + w * w).sqrt(); let l = if l > 0.0 { l } else { 1.0 };
    [x / l, y / l, z / l, w / l]
}
/// M4.inv (a Float32Array)
fn inv(m: &M) -> M {
    let (a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33) = (m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[10], m[11], m[12], m[13], m[14], m[15]);
    let (b00, b01, b02, b03, b04, b05) = (a00 * a11 - a01 * a10, a00 * a12 - a02 * a10, a00 * a13 - a03 * a10, a01 * a12 - a02 * a11, a01 * a13 - a03 * a11, a02 * a13 - a03 * a12);
    let (b06, b07, b08, b09, b10, b11) = (a20 * a31 - a21 * a30, a20 * a32 - a22 * a30, a20 * a33 - a23 * a30, a21 * a32 - a22 * a31, a21 * a33 - a23 * a31, a22 * a33 - a23 * a32);
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if d == 0.0 { return [0.0; 16]; } let d = 1.0 / d;
    r32([(a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d, (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
        (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d, (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
        (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d, (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
        (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d, (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d])
}
/// las matrices del mundo de un árbol (Modelo.actualizar) con la raíz en el origen (md.p[0] = [0, 0, 0]); `sin_giro`: también
/// sin el giro de la raíz (coheteTobera). Lo apagado queda en cero, como en la web
fn mundos(arb: &[Value], sin_giro: bool) -> (Vec<M>, Vec<bool>) {
    let n = arb.len(); let mut act = vec![false; n]; let mut w = vec![[0.0f64; 16]; n];
    for (i, x) in arb.iter().enumerate() {
        let pa = x["pa"].as_i64().unwrap_or(-1);
        act[i] = !verdad(&x["off"]) && (pa < 0 || act[pa as usize]);
        if !act[i] { continue; }
        if i == 0 || pa < 0 { w[i] = r32(trs([0.0; 3], if sin_giro { QID } else { arr4(&x["r"]) }, arr3(&x["s"], [1.0; 3]))); }
        else { w[i] = r32(mul(&w[pa as usize], &trs(arr3(&x["p"], [0.0; 3]), arr4(&x["r"]), arr3(&x["s"], [1.0; 3])))); }
    }
    (w, act)
}

// ---------------- lo que se maneja ----------------
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tipo { Auto, Moto, Heli, Avion, Asiento }
impl Tipo {
    /// el de la web ('auto', 'moto', 'heli', 'avion', 'asiento')
    pub fn nombre(self) -> &'static str { match self { Tipo::Auto => "auto", Tipo::Moto => "moto", Tipo::Heli => "heli", Tipo::Avion => "avion", Tipo::Asiento => "asiento" } }
}

/// lo que pide quien maneja (el `ent` de la web): la palanca (x: derecha +, y: adelante +; el auto dobla y acelera con
/// ella, y = −1 frena y después va marcha atrás), freno (el botón de saltar: freno de mano, las de atrás agarran menos;
/// en el helicóptero sube y en el avión acelera), agachar (el helicóptero baja, el avión desacelera) y turbo (el cohete
/// de la bici: correr o su botón)
#[derive(Clone, Copy, Debug, Default)]
pub struct Mando { pub x: f64, pub y: f64, pub freno: bool, pub agachar: bool, pub turbo: bool }
impl Mando {
    /// de la entrada del jugador (la palanca de la pantalla y los botones)
    pub fn de_entrada(e: &crate::jugador::Entrada) -> Mando { Mando { x: e.x as f64, y: e.y as f64, freno: e.saltar, agachar: e.agachar, turbo: e.correr } }
}

/// una rueda de la física (un WheelCollider del prefab; en la moto y la bici, los rayos de adelante y de atrás)
#[derive(Clone, Debug)]
pub struct Rueda {
    /// dónde se engancha (arriba del recorrido), en el marco del cuerpo; radio, recorrido, resorte y amortiguador
    pub p: V, pub r: f64, pub sd: f64, pub sp: f64, pub da: f64,
    /// la de adelante dobla
    pub del: bool,
    /// cuánto sube la rueda dibujada (lo comprimido menos medio recorrido) y cuánto giró
    pub comp_vis: f64, pub giro_ang: f64,
    pub toca: bool,
    /// el nombre del nodo (para buscar la que se ve)
    pub n: Option<String>,
    /// el nodo que se dibuja (el más parecido y cercano), el centro de su malla en su marco, los ejes del auto vistos desde
    /// él (x: el eje de la rueda, y: arriba), si está espejado (−1) y su escala
    pub vis: Option<usize>, pub cl: V, pub eje_x: V, pub eje_y: V, pub esp: f64, pub esc: f64,
    /// el radio de la rueda dibujada (medio largo mayor de su malla, por la escala del nodo; 0 sin dibujo)
    pub r_vis: f64,
    /// dónde tocaba el piso patinando en el paso anterior (para las marcas)
    pub marca_p: Option<V>,
}
/// un rotor o una hélice (gira con el motor)
#[derive(Clone, Debug)]
pub struct Rotor { pub i: usize, pub eje: V, pub cl: V, pub eje_l: V, pub ang: f64 }

/// un vehículo (V en la web): sobre un cuerpo de la física
#[derive(Clone, Debug)]
pub struct Vehiculo {
    /// el id del cuerpo en `Fisica` y el nombre del prefab
    pub cuerpo: u32, pub nombre: String,
    pub tipo: Tipo,
    /// el centro de la forma en el marco del modelo (o.c)
    pub c: V,
    pub ruedas: Vec<Rueda>,
    /// los asientos (en el marco del cuerpo); el primero, el del que maneja
    pub asientos: Vec<V>,
    pub rotores: Vec<Rotor>,
    /// las toberas del avión (de donde salen las llamas), en el marco del cuerpo
    pub jets: Vec<V>,
    pub vida: f64, pub roto: bool,
    /// el motor prendido (0 a 1), la dirección (+ izquierda), las vueltas (0 a 1) y la velocidad hacia adelante
    pub motor: f64, pub giro: f64, pub rpm: f64, pub vel: f64,
    /// un bote (flota; con agua debajo se maneja con botePaso), la bici con cohete y su cohete prendido
    pub bote: bool, pub bici: bool, pub turbo: bool,
    /// la distancia de la cámara (los de los addons, según su tamaño); None: la de su tipo
    pub cam_dist: Option<f64>,
    /// de la policía (la bocina más aguda)
    pub policia: bool,
    vel_ant: f64, vuelco_t: f64, ejes: Option<f64>, tobera: Option<V>, art: Option<String>,
    /// el árbol para dibujar: padre, activo, la matriz local (como objetos.rs)
    nodos: Vec<(i64, bool, M4)>,
    /// la clave del prefab en DATA.pf (para leer su malla), la malla en la grilla (V.cols) y la cabina de cada asiento (V.cab)
    clave: String, cols: Option<std::sync::Arc<Cols>>, cab: std::collections::HashMap<usize, Option<Cabina>>,
    /// destruccion.js: la malla abollada de cada nodo que se hundió (la copia subida al motor), los nodos que no se dibujan
    /// (las ruedas que se soltaron: o.md.ver) y los nodos de las ruedas sueltas (V.sueltas); `oscuro`: roto, se dibuja
    /// con este material (o.md.color oscuro de vehiculoRoto)
    pub abollada: std::collections::HashMap<usize, i64>, pub ocultos: Vec<usize>, pub sueltas: Vec<usize>,
}

// ---------------- sentado de verdad: la cabina de cada auto (vehiculos.js) ----------------
/// la cabina de un asiento de un auto, en el marco del cuerpo (vehCabina): el almohadón medido en la malla (lo más alto
/// debajo del punto de asiento, de 35 cm abajo a 15 cm arriba: el SitPoint de los autos del juego está 2 a 14 cm arriba
/// del almohadón de verdad, según el auto), el techo arriba del asiento (lo primero de la malla de medio metro sobre el
/// almohadón para arriba; None: abierto, como el Sofie o la silla de ruedas) y dónde termina adelante (z y alto del
/// borde de adelante del techo: después viene el parabrisas), el piso de adelante (lo más alto de 30 a 90 cm adelante que queda 12 cm o más
/// bajo el almohadón: los pedales, la pared de adelante inclinada), hasta dónde llega ese piso (la pared de los pedales),
/// el asiento y la malla del auto (para medir debajo de la cola, arriba de la cabeza y debajo de cada pie)
#[derive(Clone, Debug)]
pub struct Cabina { pub coj: f64, pub techo: Option<f64>, pub techo_borde: Option<(f64, f64)>, pub piso: Option<f64>, pub lejos: Option<f64>, pub asiento: V, pub cols: Option<std::sync::Arc<Cols>> }
impl Cabina {
    /// lo más alto de la malla en x, z entre y0 e y1
    pub fn abajo(&self, x: f64, z: f64, y0: f64, y1: f64) -> Option<f64> { self.cols.as_ref()?.cortes(x, z).into_iter().filter(|y| *y < y1 && *y > y0).fold(None, |a, y| Some(a.map_or(y, |a: f64| a.max(y)))) }
    /// lo más bajo de la malla en x, z arriba de y0
    pub fn arriba(&self, x: f64, z: f64, y0: f64) -> Option<f64> { self.cols.as_ref()?.cortes(x, z).into_iter().filter(|y| *y > y0).fold(None, |a, y| Some(a.map_or(y, |a: f64| a.min(y)))) }
    /// el almohadón en x, z: lo más alto de la malla de 35 cm abajo a 15 cm arriba del asiento, en x, z y 6 cm alrededor
    /// (vehCojin)
    pub fn cojin(&self, x: f64, z: f64) -> Option<f64> { cojin(self.cols.as_ref()?, self.asiento, x, z) }
}
/// (el almohadón: lo más alto de la malla de 35 cm abajo a 15 cm arriba del asiento `s`, en x, z y 6 cm alrededor)
fn cojin(c: &Cols, s: V, x: f64, z: f64) -> Option<f64> {
    let mut coj: Option<f64> = None;
    for (dx, dz) in [(0.0, 0.0), (0.06, 0.0), (-0.06, 0.0), (0.0, -0.06), (0.0, 0.06)] { for y in c.cortes(x + dx, z + dz) { if y < s[1] + 0.15 && y > s[1] - 0.35 && coj.map(|c| y > c).unwrap_or(true) { coj = Some(y); } } }
    coj
}
/// la malla del auto en su marco (sin las ruedas), en una grilla de 10 cm para preguntar qué cruza una vertical (vehCols):
/// los triángulos (9 números cada uno) y, por celda, cuáles la tocan
#[derive(Debug, Default)]
pub struct Cols { t: Vec<f64>, g: std::collections::HashMap<(i64, i64), Vec<usize>> }
impl Cols {
    /// de la malla del auto (los nodos que se ven, sin los colliders ni las ruedas), en el marco del cuerpo. None si falta
    /// alguna malla
    fn de(paq: &Paquete, v: &Vehiculo, arb: &[Value]) -> Option<Cols> {
        let d = &paq.d; let w = v.matrices(); let n = arb.len().min(w.len());
        let sin: Vec<usize> = v.ruedas.iter().filter_map(|r| r.vis).collect();
        let de_rueda = |i: usize| { let mut k = i as i64; while k >= 0 { if sin.contains(&(k as usize)) { return true; } k = arb[k as usize]["pa"].as_i64().unwrap_or(-1); } false };
        // (los niveles de detalle: el más fino, como GFX.lod en alto)
        let mut por_rid = std::collections::HashMap::new(); for (i, x) in arb.iter().enumerate() { if let Some(r) = x["rid"].as_i64() { por_rid.insert(r, i); } }
        let mut oculto = vec![false; arb.len()];
        for x in arb { if let Some(l) = x["lod"].as_array() { for (k, g) in l.iter().enumerate() { if k != 0 { for rid in g[1].as_array().into_iter().flatten() { if let Some(&i) = rid.as_i64().and_then(|r| por_rid.get(&r)) { oculto[i] = true; } } } } } }
        let mut t: Vec<f64> = vec![];
        for i in 0..n {
            let x = &arb[i]; let mi = x["m"].as_i64().unwrap_or(-1);
            let ver = v.nodos[i].1 && mi >= 0 && x["mt"].is_array() && x["mroff"].is_null() && !oculto[i];
            if !ver || x["n"].as_str().unwrap_or("").to_lowercase().contains("collider") || de_rueda(i) { continue; }
            let md = &d["ms"][mi as usize]; let bin = paq.bin_de(md)?; let subs = md["sub"].as_array()?;
            let (nv, o, ii) = (md["v"].as_u64().unwrap_or(0) as usize, md["o"].as_u64().unwrap_or(0) as usize, md["i"].as_u64().unwrap_or(0) as usize);
            let (mn, sc) = (arr3(&md["mn"], [0.0; 3]), arr3(&md["sc"], [1.0; 3])); let m = &w[i];
            // (mallaCPU: las posiciones en float; al marco del cuerpo: M·p − c)
            let mut l = Vec::with_capacity(nv);
            for k in 0..nv {
                let q = o + k * 14; if q + 6 > bin.len() { break; }
                let u = |j: usize| (mn[j] + u16::from_le_bytes([bin[q + j * 2], bin[q + j * 2 + 1]]) as f64 / 65535.0 * sc[j]) as f32 as f64;
                let p = [u(0), u(1), u(2)]; let f = |e: usize| m[e] as f64;
                l.push([f(0) * p[0] + f(4) * p[1] + f(8) * p[2] + f(12) - v.c[0], f(1) * p[0] + f(5) * p[1] + f(9) * p[2] + f(13) - v.c[1], f(2) * p[0] + f(6) * p[1] + f(10) * p[2] + f(14) - v.c[2]]);
            }
            let i32 = md["i32"].as_bool().unwrap_or(false); let ni = subs.iter().map(|s| s[0].as_u64().unwrap_or(0) + s[1].as_u64().unwrap_or(0)).max().unwrap_or(0) as usize;
            let idx = |k: usize| -> Option<usize> { if i32 { bin.get(ii + k * 4..ii + k * 4 + 4).map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]) as usize) } else { bin.get(ii + k * 2..ii + k * 2 + 2).map(|b| u16::from_le_bytes([b[0], b[1]]) as usize) } };
            let mut k = 0; while k + 2 < ni { for j in [idx(k), idx(k + 1), idx(k + 2)] { let p = j.and_then(|j| l.get(j)).copied().unwrap_or([0.0; 3]); t.extend_from_slice(&p); } k += 3; }
        }
        let c = 0.1; let mut g: std::collections::HashMap<(i64, i64), Vec<usize>> = std::collections::HashMap::new();
        let mut k = 0;
        while k + 9 <= t.len() {
            let fl = |a: f64| (a / c).floor() as i64;
            let (x0, x1) = (fl(t[k].min(t[k + 3]).min(t[k + 6])), fl(t[k].max(t[k + 3]).max(t[k + 6])));
            let (z0, z1) = (fl(t[k + 2].min(t[k + 5]).min(t[k + 8])), fl(t[k + 2].max(t[k + 5]).max(t[k + 8])));
            if (x1 - x0 + 1) * (z1 - z0 + 1) <= 2500 { for i in x0..=x1 { for j in z0..=z1 { g.entry((i, j)).or_default().push(k); } } }
            k += 9;
        }
        Some(Cols { t, g })
    }
    /// las alturas de lo que cruza la vertical por x, z (en el marco del cuerpo)
    pub fn cortes(&self, x: f64, z: f64) -> Vec<f64> {
        let mut ys = vec![]; let c = 0.1;
        let Some(l) = self.g.get(&(((x / c).floor()) as i64, ((z / c).floor()) as i64)) else { return ys };
        for &k in l {
            let tt = &self.t[k..k + 9]; let (ax, ay, az, bx, by, bz, cx, cy, cz) = (tt[0], tt[1], tt[2], tt[3], tt[4], tt[5], tt[6], tt[7], tt[8]);
            let d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if d.abs() < 1e-10 { continue; }
            let u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d; let v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d; let w = 1.0 - u - v;
            if u >= -1e-4 && v >= -1e-4 && w >= -1e-4 { ys.push(u * ay + v * by + w * cy); }
        }
        ys
    }
}
/// la cabina del asiento `s` (vehCabina)
fn cabina_de(c: &std::sync::Arc<Cols>, s: V) -> Cabina {
    // (si no hay malla ahí, 4 cm abajo del punto de asiento)
    let coj = cojin(c, s, s[0], s[2]).unwrap_or(s[1] - 0.04);
    let techo_en = |dz: f64| c.cortes(s[0], s[2] + dz).into_iter().filter(|y| *y > coj + 0.5).fold(None, |a: Option<f64>, y| Some(a.map_or(y, |a| a.min(y))));
    let techo = techo_en(0.0);
    // (el borde de adelante del techo: de a 2 cm hacia adelante mientras haya techo)
    let mut techo_borde = None;
    if let Some(t) = techo { techo_borde = Some((s[2], t)); let mut dz = 0.02f64; while dz <= 1.001 { match techo_en(dz) { Some(t) => techo_borde = Some((s[2] + dz, t)), None => break } dz += 0.02; } }
    let mut r = Cabina { coj, techo, techo_borde, piso: None, lejos: None, asiento: s, cols: Some(c.clone()) };
    let mut pisos = vec![]; let mut dz = 0.3f64;
    while dz <= 0.901 {
        let mut p: Option<f64> = None;
        for dx in [-0.12, 0.0, 0.12] { for y in c.cortes(s[0] + dx, s[2] + dz) { if y < coj - 0.12 && y > coj - 1.2 && p.map(|p| y > p).unwrap_or(true) { p = Some(y); } } }
        let Some(p) = p else { break };   // (adelante no hay piso: se terminó la cabina)
        pisos.push(p); r.lejos = Some(dz);
        dz += 0.05;
    }
    if !pisos.is_empty() { r.piso = Some(pisos.iter().copied().fold(f64::NEG_INFINITY, f64::max)); }
    r
}

/// lo que pasó en un paso y quien juega tiene que hacer
#[derive(Clone, Debug)]
pub enum Evento {
    /// un sonido suelto del paquete (sonar): nombre, dónde y volumen
    Sonido { nombre: &'static str, p: V, vol: f64 },
    /// un cartel corto (aviso)
    Aviso(&'static str),
    /// el jugador salió del vehículo (con Usar, o despedido de la moto que chocó de frente): ponerlo ahí, con esa velocidad
    Salio(Salida),
    /// que tiemble la cámara (CAM.temblor)
    Temblor(f64),
    /// se rompió (vehiculoRoto: una explosión ahí; se dibuja oscuro)
    Roto { cuerpo: u32, p: V },
    /// una marca de las cubiertas en el piso (marcaTramo): de dónde a dónde, la normal del piso, el ancho y lo oscura
    Marca { de: V, a: V, n: V, ancho: f64, k: f64 },
}
/// dónde poner al jugador al bajar y con qué velocidad (salirVehiculo: JUG.pos —el centro, los pies 0,95 m abajo— y JUG.vel)
#[derive(Clone, Copy, Debug)]
pub struct Salida { pub pos: V, pub vel: V }
/// un sonido que sigue (bucle): la clave (uno por vehículo), el sonido del paquete, dónde, el volumen y el tono
#[derive(Clone, Debug)]
pub struct Bucle { pub clave: String, pub nombre: &'static str, pub p: V, pub vol: f64, pub tono: f64 }
/// la cámara de adentro (vehiculoCamara): dónde y para dónde mira (adelante: `q` por +Z), los ojos en el asiento (ojoPos)
/// y dónde va el jugador (JUG.pos, el centro: 0,5 m bajo los ojos)
#[derive(Clone, Copy, Debug)]
pub struct Camara { pub pos: V, pub q: Q, pub ojo: V, pub jugador: V }
impl Camara { pub fn adelante(&self) -> V { rot(self.q, [0.0, 0.0, 1.0]) } pub fn arriba(&self) -> V { rot(self.q, [0.0, 1.0, 0.0]) } }
/// lo que hizo el botón de usar
#[derive(Clone, Copy, Debug)]
pub enum Usar { Nada, Subio(u32), Salio(Salida) }

/// Quat.euler(yaw, pitch): giro alrededor de Y y después alrededor de X local
fn euler(yaw: f64, pitch: f64) -> Q { let q = qeje([0.0, 1.0, 0.0], yaw); if pitch != 0.0 { qmul(q, qeje([1.0, 0.0, 0.0], pitch)) } else { q } }
/// invIw: v por la inercia inversa en el mundo
#[inline] fn inv_iw(b: &Cuerpo, v: V) -> V { let o = rot_inv(b.q, v); rot(b.q, [o[0] * b.inv_i[0], o[1] * b.inv_i[1], o[2] * b.inv_i[2]]) }
/// applyVel(p, r, 1): un impulso p en el punto r (relativo al centro), si está despierto
#[inline] fn aplicar(b: &mut Cuerpo, p: V, r: V) {
    if !b.despierto() { return; }
    b.vel = add(b.vel, esc(p, b.inv_masa)); let w = inv_iw(b, cruz(r, p)); b.ang = add(b.ang, w);
}
/// ang.addS(v, s)
#[inline] fn sumar(a: &mut V, v: V, s: f64) { a[0] += v[0] * s; a[1] += v[1] * s; a[2] += v[2] * s; }
fn cuerpo_mut(fis: &mut Fisica, id: u32) -> Option<&mut Cuerpo> { let i = fis.indice(id)?; Some(&mut fis.cuerpos[i]) }

// ---------------- el rayo de las ruedas (raycast de la web: el mapa con mundoRayo y los cuerpos) ----------------
/// rayTri: el rayo contra un triángulo del mapa, en f64 con los vértices en f32 (como MUNDO.T); −1 si no lo toca
fn rayo_tri(mu: &Mundo, o: V, d: V, t: u32, tmax: f64) -> f64 {
    let k = t as usize * 9; let tt = |i: usize| mu.t[k + i] as f64;
    let (e1x, e1y, e1z, e2x, e2y, e2z) = (tt(3) - tt(0), tt(4) - tt(1), tt(5) - tt(2), tt(6) - tt(0), tt(7) - tt(1), tt(8) - tt(2));
    let (px, py, pz) = (d[1] * e2z - d[2] * e2y, d[2] * e2x - d[0] * e2z, d[0] * e2y - d[1] * e2x); let det = e1x * px + e1y * py + e1z * pz;
    if det.abs() < 1e-9 { return -1.0; }
    let inv = 1.0 / det; let (sx, sy, sz) = (o[0] - tt(0), o[1] - tt(1), o[2] - tt(2)); let u = (sx * px + sy * py + sz * pz) * inv;
    if u < 0.0 || u > 1.0 { return -1.0; }
    let (qx, qy, qz) = (sy * e1z - sz * e1y, sz * e1x - sx * e1z, sx * e1y - sy * e1x); let v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
    if v < 0.0 || u + v > 1.0 { return -1.0; }
    let r = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if r >= 0.0 && r <= tmax { r } else { -1.0 }
}
/// mundoRayo (para rayos cortos): lo primero del mapa que toca el rayo hasta `max` (distancia y normal contra el rayo), en
/// f64 como la web (`Mundo::rayo` es en f32). Los triángulos de las celdas que cruza; los cuerpos fijos del mapa (que la
/// web prueba en f64 con su forma) con `Mundo::rayo`
fn rayo_mapa(mu: &Mundo, o: V, d: V, max: f64, items: &mut Vec<u32>) -> Option<(f64, V)> {
    let c = mu.celda as f64; let e = add(o, esc(d, max));
    let cel = |x: f64| (x / c).floor() as i32;
    mu.items_celdas(cel(o[0].min(e[0])), cel(o[2].min(e[2])), cel(o[0].max(e[0])), cel(o[2].max(e[2])), items);
    let (mut best, mut bt, mut fijo) = (max, None, false);
    for &it in items.iter() {
        if it & crate::mundo::CUERPO != 0 { fijo = true; continue; }
        let t = rayo_tri(mu, o, d, it, best); if t >= 0.0 { best = t; bt = Some(it); }
    }
    let mut h = bt.map(|t| { let k = t as usize * 3; let mut n = [mu.tn[k] as f64, mu.tn[k + 1] as f64, mu.tn[k + 2] as f64]; if dot(n, d) > 0.0 { n = esc(n, -1.0); } (best, n) });
    if fijo {
        let f = |v: V| [v[0] as f32, v[1] as f32, v[2] as f32];
        if let Some(g) = mu.rayo(f(o), f(d), max as f32) { if (g.t as f64) < h.map_or(max, |x| x.0) - 1e-4 { h = Some((g.t as f64, [g.n[0] as f64, g.n[1] as f64, g.n[2] as f64])); } }
    }
    h
}
/// raycast(o, d, max, ignorar): el mapa (en f64) y después los cuerpos (lo de `Fisica::rayo` con un mundo vacío)
fn rayo_rueda(fis: &mut Fisica, mu: &Mundo, vacio: &Mundo, o: V, d: V, max: f64, ignorar: u32, items: &mut Vec<u32>) -> Option<(f64, V)> {
    let m = rayo_mapa(mu, o, d, max, items);
    match fis.rayo(vacio, o, d, m.map_or(max, |x| x.0), &[ignorar]) { Some(g) if g.t < m.map_or(max, |x| x.0) || m.is_none() => Some((g.t, g.n)), _ => m }
}

/// salirVehiculo: al costado del asiento (los impares a la izquierda), 0,6 m arriba, y apoyado en el piso si lo hay
fn salida(mundo: &Mundo, b: &Cuerpo, asiento: usize) -> Salida {
    let lado = rot(b.q, [if asiento % 2 == 1 { -1.6 } else { 1.6 }, 0.6, 0.0]);
    let mut p = add(b.pos, lado);
    let f = |v: V| [v[0] as f32, v[1] as f32, v[2] as f32];
    if let Some(h) = mundo.rayo(f(add(p, [0.0, 3.0, 0.0])), [0.0, -1.0, 0.0], 8.0) { p[1] = p[1] + 3.0 - h.t as f64 + 1.05; }
    Salida { pos: p, vel: b.vel }
}

impl Vehiculo {
    /// vehiculoNuevo: el vehículo de un prefab (su árbol) sobre el cuerpo `cuerpo` (ya armado con cuerpo_de_prefab: `c` es
    /// el centro de su forma). Qué es sale de los scripts del prefab (los de Unity: HelicopterController, SCC_Drivetrain…)
    pub fn de_arbol(d: &Value, arb: &[Value], nombre: &str, c: V, cuerpo: u32) -> Vehiculo {
        let mb: Vec<&str> = arb[0]["mb"].as_array().map(|a| a.iter().filter_map(|v| v.as_str()).collect()).unwrap_or_default();
        let tipo = if mb.contains(&"HelicopterController") { Tipo::Heli } else if mb.contains(&"AeroplaneController") { Tipo::Avion }
            else if mb.contains(&"RB_Controller") { Tipo::Moto } else if mb.contains(&"SCC_Drivetrain") { Tipo::Auto } else { Tipo::Asiento };
        let (w, act) = mundos(arb, false);
        // (un punto del marco raíz → el marco del cuerpo, sin girar)
        let en_cuerpo = |m: &M| [m[12] - c[0], m[13] - c[1], m[14] - c[2]];
        let nom = |i: usize| arb[i]["n"].as_str().unwrap_or("");
        let mbs = |i: usize| -> Vec<&str> { arb[i]["mb"].as_array().map(|a| a.iter().filter_map(|v| v.as_str()).collect()).unwrap_or_default() };
        let malla = |i: usize| arb[i]["m"].as_i64().filter(|&m| m >= 0);
        let art = arb[0]["rb"]["art"].as_str().map(|s| s.to_string());
        let mut v = Vehiculo { cuerpo, nombre: nombre.to_string(), tipo, c, ruedas: vec![], asientos: vec![], rotores: vec![], jets: vec![],
            vida: if tipo == Tipo::Asiento { 1e9 } else { 400.0 }, roto: false, motor: 0.0, giro: 0.0, rpm: 0.0, vel: 0.0,
            bote: verdad(&arb[0]["bote"]), bici: art.as_deref() == Some("bici"), turbo: false, cam_dist: None, policia: nombre.to_lowercase().contains("police"),
            vel_ant: 0.0, vuelco_t: 0.0, ejes: None, tobera: None, art, nodos: vec![], clave: String::new(), cols: None, cab: std::collections::HashMap::new(),
            abollada: std::collections::HashMap::new(), ocultos: vec![], sueltas: vec![] };
        let rueda = |p: V, r: f64, sd: f64, sp: f64, da: f64, del: bool, n: Option<String>| Rueda { p, r, sd, sp, da, del, comp_vis: 0.0, giro_ang: 0.0, toca: false, n,
            vis: None, cl: [0.0; 3], eje_x: [1.0, 0.0, 0.0], eje_y: [0.0, 1.0, 0.0], esp: 1.0, esc: 1.0, r_vis: 0.0, marca_p: None };
        for (i, x) in arb.iter().enumerate() {
            if nom(i).starts_with("SitPoint") { v.asientos.push(en_cuerpo(&w[i])); }
            if x["wc"].is_object() && act[i] {
                let wc = &x["wc"]; let mut p = en_cuerpo(&w[i]); p[1] += num(&wc["c"][1], 0.0);
                let o = |k: &str, d: f64| { let y = num(&wc[k], 0.0); if y != 0.0 { y } else { d } };
                v.ruedas.push(rueda(p, num(&wc["r"], 0.0), num(&wc["sd"], 0.0).max(0.08), o("sp", 35000.0), o("da", 2000.0), p[2] > 0.0, Some(nom(i).to_string()).filter(|s| !s.is_empty())));
            }
            if mbs(i).contains(&"HeliRotorController") { let l = nom(i).to_lowercase(); v.rotores.push(Rotor { i, eje: if l.contains("small") || l.contains("tail") { [1.0, 0.0, 0.0] } else { [0.0, 1.0, 0.0] }, cl: [0.0; 3], eje_l: [0.0; 3], ang: 0.0 }); }
            if mbs(i).contains(&"JetParticleEffect") && act[i] { v.jets.push(en_cuerpo(&w[i])); }
            if nom(i).contains("Propeller") && !x["m"].is_null() { v.rotores.push(Rotor { i, eje: [0.0, 0.0, 1.0], cl: [0.0; 3], eje_l: [0.0; 3], ang: 0.0 }); }
        }
        // (el conductor va adentro: los Derby traen primero dos lugares sobre el capó y dos atrás mirando para atrás; con el
        // primero de la lista el personaje quedaba afuera del auto. Se ponen primero los asientos que están entre los ejes)
        if tipo == Tipo::Auto && v.ruedas.len() >= 2 && v.asientos.len() > 1 {
            let zf = v.ruedas.iter().map(|r| r.p[2]).fold(f64::NEG_INFINITY, f64::max); let zr = v.ruedas.iter().map(|r| r.p[2]).fold(f64::INFINITY, f64::min);
            let adentro = |a: &V| a[2] < zf - 0.2 && a[2] > zr + 0.2;
            let (mut si, no): (Vec<V>, Vec<V>) = v.asientos.iter().partition(|a| adentro(a)); si.extend(no); v.asientos = si;
        }
        // la moto (y la bici): dos rayos, adelante y atrás
        if tipo == Tipo::Moto && v.ruedas.len() < 2 {
            let fr = arb.iter().position(|n| n["n"].as_str() == Some("FrontRayPos")); let rr = arb.iter().position(|n| n["n"].as_str() == Some("RearRayPos"));
            v.ruedas.clear();
            for (k, del) in [(fr, true), (rr, false)] { if let Some(k) = k { let mut p = en_cuerpo(&w[k]); p[1] += 0.38; v.ruedas.push(rueda(p, 0.38, 0.25, 30000.0 * 0.5, 2500.0 * 0.5, del, None)); } }
        }
        // ruedas que se ven: el nodo con malla más cercano a cada rueda (nombre parecido)
        let es_rueda = |s: &str| { let l = s.to_lowercase(); l.contains("wheel") || l.contains("tire") || l.contains("rueda") || ["fl", "fr", "rl", "rr"].contains(&l.as_str()) };
        let pa = |i: usize| arb[i]["pa"].as_i64().unwrap_or(-1);
        let vis: Vec<usize> = (0..arb.len()).filter(|&i| act[i] && es_rueda(nom(i)) && !arb[i]["wc"].is_object() && (malla(i).is_some() || arb.iter().any(|c| c["pa"].as_i64() == Some(i as i64) && c["m"].as_i64().map_or(false, |m| m >= 0)))).collect();
        // (el centro de la malla del nodo —o de su hijo con malla— en el marco del nodo, y en el de la raíz)
        let cen = |i: usize| -> (V, V) {
            let k = if malla(i).is_some() { Some(i) } else { arb.iter().position(|c| c["pa"].as_i64() == Some(i as i64) && c["m"].as_i64().map_or(false, |m| m >= 0)) };
            let Some(k) = k else { return ([0.0; 3], [w[i][12], w[i][13], w[i][14]]) };
            let md = &d["ms"][arb[k]["m"].as_i64().unwrap_or(0) as usize]; let (mn, sc) = (arr3(&md["mn"], [0.0; 3]), arr3(&md["sc"], [0.0; 3]));
            let cl = [mn[0] + sc[0] / 2.0, mn[1] + sc[1] / 2.0, mn[2] + sc[2] / 2.0];
            let pw = pt(&w[k], cl); (pt(&inv(&w[i]), pw), pw)
        };
        // (sin los grupos: en el Sofie el nodo que junta las cuatro ruedas se llama «wheels» y tiene mallas abajo; un nodo que
        // tiene otra rueda adentro no es una rueda)
        let anc = |a: usize, dd: usize| { let mut k = pa(dd); while k >= 0 { if k as usize == a { return true; } k = pa(k as usize); } false };
        let vis_r: Vec<usize> = vis.iter().copied().filter(|&i| !vis.iter().any(|&j| j != i && anc(i, j))).collect();
        let mut usados: Vec<usize> = vec![];
        for w_ in v.ruedas.iter_mut() {
            // (primero la que se llama igual que la rueda de la física —FLwheel, BRwheel…—; si no, la más cercana)
            let igual: Vec<usize> = match &w_.n { Some(n) => vis_r.iter().copied().filter(|i| !usados.contains(i) && nom(*i).to_lowercase() == n.to_lowercase()).collect(), None => vec![] };
            let (mut best, mut bd, mut bc) = (None, 1e9f64, ([0.0; 3], [0.0; 3]));
            for &i in if igual.is_empty() { &vis_r } else { &igual } {
                if usados.contains(&i) { continue; }
                let cc = cen(i); let dd = largo(sub(sub(cc.1, c), w_.p)); if dd < bd { bd = dd; best = Some(i); bc = cc; }
            }
            if let (Some(b), true) = (best, bd < 1.5) {
                usados.push(b); w_.vis = Some(b); w_.cl = bc.0;
                let q = m_quat(&w[b]); w_.eje_x = rot_inv(q, [1.0, 0.0, 0.0]); w_.eje_y = rot_inv(q, [0.0, 1.0, 0.0]);
                let m = &w[b];
                w_.esp = if m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]) < 0.0 { -1.0 } else { 1.0 };
                // (la escala del nodo en el auto: la suspensión mueve la rueda en sus unidades; la silla de ruedas trae escala 220)
                w_.esc = hypot_js(&[m[0], m[1], m[2]]).max(1e-6);
                let k = if malla(b).is_some() { Some(b) } else { arb.iter().position(|c| c["pa"].as_i64() == Some(b as i64) && c["m"].as_i64().map_or(false, |m| m >= 0)) };
                if let Some(k) = k { let sc = arr3(&d["ms"][arb[k]["m"].as_i64().unwrap_or(0) as usize]["sc"], [0.0; 3]); w_.r_vis = 0.5 * sc[0].max(sc[1]).max(sc[2]) * hypot_js(&[w[k][0], w[k][1], w[k][2]]); }
            }
        }
        for r in v.rotores.iter_mut() { let (cl, _) = cen(r.i); r.cl = cl; r.eje_l = rot_inv(m_quat(&w[r.i]), r.eje); r.ang = 0.0; }
        // la tobera del cohete (el nodo CoheteTobera, en el modelo sin el giro de la raíz)
        if let Some(i) = arb.iter().position(|n| n["n"].as_str() == Some("CoheteTobera")) { let (w2, _) = mundos(arb, true); v.tobera = Some(en_cuerpo(&w2[i])); }
        // el árbol para dibujar (lo mismo que objetos::armar, en f32)
        let f = |x: &Value| x.as_f64().unwrap_or(0.0) as f32;
        let v3f = |x: &Value, dd: [f32; 3]| if x.is_array() { [f(&x[0]), f(&x[1]), f(&x[2])] } else { dd };
        let mut act2 = vec![false; arb.len()];
        for (i, x) in arb.iter().enumerate() {
            let pa = x["pa"].as_i64().unwrap_or(-1);
            act2[i] = x["off"].is_null() && (pa < 0 || act2[pa as usize]);
            let p = if i == 0 { [0.0; 3] } else { v3f(&x["p"], [0.0; 3]) };
            let r = if x["r"].is_array() { [f(&x["r"][0]), f(&x["r"][1]), f(&x["r"][2]), f(&x["r"][3])] } else { [0.0, 0.0, 0.0, 1.0] };
            v.nodos.push((pa, act2[i], crate::mapa::trs(p, r, v3f(&x["s"], [1.0; 3]))));
        }
        v
    }

    /// la matriz extra de un nodo: T(c) · R(giros) · T(−c) (matrizGiro)
    fn matriz_giro(cl: V, ejes: &[(V, f64)]) -> M4 {
        let c = [cl[0] as f32, cl[1] as f32, cl[2] as f32];
        let mut o = crate::mapa::trs(c, [0.0, 0.0, 0.0, 1.0], [1.0; 3]);
        for (e, a) in ejes { let q = qeje(*e, *a); o = m4::mul(&o, &crate::mapa::trs([0.0; 3], [q[0] as f32, q[1] as f32, q[2] as f32, q[3] as f32], [1.0; 3])); }
        m4::mul(&o, &crate::mapa::trs([-c[0], -c[1], -c[2]], [0.0, 0.0, 0.0, 1.0], [1.0; 3]))
    }
    /// vehiculoAntesDeDibujar: las matrices extra de las ruedas (dirección, vuelta y suspensión) y los rotores, por nodo
    pub fn extras(&self) -> Vec<(usize, M4)> {
        let mut o = vec![];
        for w in &self.ruedas {
            let Some(i) = w.vis else { continue };
            // (la rueda de adelante dibujada gira para el mismo lado que la de la física)
            let mut m = Self::matriz_giro(w.cl, &[(w.eje_y, if w.del { self.giro * 0.6 * w.esp } else { 0.0 }), (w.eje_x, w.giro_ang)]);
            // la suspensión sube y baja la rueda
            let k = w.comp_vis / w.esc; m[12] += (w.eje_y[0] * k) as f32; m[13] += (w.eje_y[1] * k) as f32; m[14] += (w.eje_y[2] * k) as f32;
            o.push((i, m));
        }
        for r in &self.rotores { o.push((r.i, Self::matriz_giro(r.cl, &[(r.eje_l, r.ang)]))); }
        o
    }
    /// las matrices de cada nodo desde la raíz (Modelo.actualizar con md.E: las ruedas giradas, subidas o bajadas por la
    /// suspensión, los rotores)
    pub fn matrices(&self) -> Vec<M4> {
        let ex = self.extras(); let n = self.nodos.len();
        let mut w: Vec<M4> = vec![m4::id(); n];
        for i in 0..n {
            let (pa, _, l) = self.nodos[i];
            let l = match ex.iter().find(|e| e.0 == i) { Some((_, e)) if i > 0 => m4::mul(&l, e), _ => l };
            w[i] = if pa < 0 { l } else { m4::mul(&w[pa as usize], &l) };
        }
        w
    }
    /// el centro de la rueda `k` como se dibuja (con la suspensión y la dirección), en el marco del cuerpo
    pub fn centro_rueda(&self, k: usize) -> Option<V> {
        let w = self.ruedas.get(k)?; let i = w.vis?; let m = self.matrices()[i]; let c = [w.cl[0] as f32, w.cl[1] as f32, w.cl[2] as f32];
        let p = [m[0] * c[0] + m[4] * c[1] + m[8] * c[2] + m[12], m[1] * c[0] + m[5] * c[1] + m[9] * c[2] + m[13], m[2] * c[0] + m[6] * c[1] + m[10] * c[2] + m[14]];
        Some([p[0] as f64 - self.c[0], p[1] as f64 - self.c[1], p[2] as f64 - self.c[2]])
    }
    /// lo que se dibuja (como Prefab::items, con las ruedas y los rotores en su lugar): `base` es la matriz del objeto (su
    /// cuerpo × capQ⁻¹ × T(−c), como cualquier objeto)
    pub fn items(&self, pf: &Prefab, base: &M4, out: &mut Vec<ItemDin>) {
        let w = self.matrices(); let n = w.len();
        let e = [0, 4, 8].iter().map(|&o| (base[o] * base[o] + base[o + 1] * base[o + 1] + base[o + 2] * base[o + 2]).sqrt()).fold(0.0f32, f32::max);
        for p in &pf.partes {
            if self.ocultos.contains(&p.nodo) { continue; }
            let local = if p.nodo < n { &w[p.nodo] } else { &p.local };
            let mm = m4::mul(base, local); let q = p.esf;
            let c = [base[0] * q[0] + base[4] * q[1] + base[8] * q[2] + base[12], base[1] * q[0] + base[5] * q[1] + base[9] * q[2] + base[13], base[2] * q[0] + base[6] * q[1] + base[10] * q[2] + base[14]];
            out.push(ItemDin { m: self.abollada.get(&p.nodo).copied().unwrap_or(p.m), s0: p.s0, sn: p.sn, mat: p.mat, mm, esf: [c[0], c[1], c[2], q[3] * e], fl: 0, h: vec![] });
        }
    }
    /// el árbol del modelo (para destruccion.js): cuántos nodos, el padre de cada uno y si se dibuja
    pub fn n_nodos(&self) -> usize { self.nodos.len() }
    pub fn padre(&self, i: usize) -> i64 { self.nodos.get(i).map(|n| n.0).unwrap_or(-1) }
    pub fn activo(&self, i: usize) -> bool { self.nodos.get(i).map(|n| n.1).unwrap_or(false) && !self.ocultos.contains(&i) }
    /// la clave del prefab en DATA.pf
    pub fn clave(&self) -> &str { &self.clave }
    /// bocTipo: la bocina que tiene ('auto', 'policia', 'moto' o 'timbre' —la bici—), o ninguna
    pub fn bocina_tipo(&self) -> Option<&'static str> {
        if self.art.as_deref() == Some("bici") { Some("timbre") } else if self.tipo == Tipo::Moto { Some("moto") } else if self.policia { Some("policia") } else if self.tipo == Tipo::Auto { Some("auto") } else { None }
    }
    /// el sonido del motor que corresponde (la bici no tiene: va a pedal)
    pub fn sonido_motor(&self) -> &'static str { match self.tipo { Tipo::Heli => "Helicopter", Tipo::Avion => "PropellerEngine", _ => "Big4Stroke" } }
    /// dónde sale el fuego del cohete (en el marco del cuerpo)
    pub fn tobera(&self) -> Option<V> { self.tobera }
}

/// los vehículos del mapa (VEHS) y el jugador en uno de ellos
#[derive(Default)]
pub struct Vehiculos {
    pub lista: Vec<Vehiculo>,
    /// el jugador adentro: el cuerpo del vehículo y el asiento (0: maneja)
    pub jugador: Option<(u32, usize)>,
    /// la cámara de adentro en primera persona (JUG.fpVeh; si no, en tercera, alrededor)
    pub primera: bool,
    /// lo que pasó (sonidos, carteles, el jugador que sale, explosiones, marcas): lo saca quien juega
    pub eventos: Vec<Evento>,
    /// (un mapa vacío: para preguntarle a la física sólo por los cuerpos) y lo de trabajo de los rayos
    vacio: Option<Mundo>, items: Vec<u32>,
}

impl Vehiculos {
    pub fn nuevo() -> Vehiculos { Vehiculos::default() }
    /// ¿el prefab es un vehículo? (tipoDe: 'vehiculo')
    pub fn es_vehiculo(pf: &PrefabFisica) -> bool { pf.tipo == "vehiculo" }
    /// vehiculoNuevo: si el prefab es un vehículo, lo arma sobre su cuerpo (ya agregado a la física con cuerpo_de_prefab):
    /// le pone el roce y el freno de giro de los vehículos y, si es un bote, su densidad para el agua. Devuelve su lugar
    pub fn agregar(&mut self, paq: &Paquete, pf: &PrefabFisica, cuerpo: u32, fis: &mut Fisica, aguas: Option<&mut Aguas>) -> Option<usize> {
        if !Self::es_vehiculo(pf) { return None; }
        let arb = paq.d["pf"][&pf.clave].as_array()?;
        let mut v = Vehiculo::de_arbol(&paq.d, arb, &pf.nombre, pf.c, cuerpo); v.clave = pf.clave.clone();
        if let Some(b) = cuerpo_mut(fis, cuerpo) { if v.tipo != Tipo::Asiento { b.ang_damp = 0.6; b.fric = 0.4; } }
        // (un bote flota con un tercio del casco bajo el agua: densidad 380)
        if v.bote { if let Some(a) = aguas { let mut f = a.cuerpos.get(&cuerpo).cloned().unwrap_or_else(|| Flota::de_prefab(pf)); f.dens = Some(380.0); f.bote = true; a.registrar(cuerpo, f); } }
        self.lista.push(v); Some(self.lista.len() - 1)
    }
    /// vehiculoBorrar (antes de sacar el cuerpo de la física): si el jugador estaba adentro, sale
    pub fn quitar(&mut self, cuerpo: u32, fis: &Fisica, mundo: &Mundo) -> Option<Salida> {
        let s = if self.jugador.map(|j| j.0) == Some(cuerpo) { self.salir(fis, mundo) } else { None };
        self.lista.retain(|v| v.cuerpo != cuerpo); s
    }
    pub fn de(&self, cuerpo: u32) -> Option<&Vehiculo> { self.lista.iter().find(|v| v.cuerpo == cuerpo) }
    /// la cabina del asiento `a` del vehículo de `cuerpo`, si es un auto (vehCabina: de su malla, una vez por asiento),
    /// para sentar al personaje (personaje::Asiento)
    pub fn cabina(&mut self, paq: &Paquete, cuerpo: u32, a: usize) -> Option<Cabina> {
        let v = self.lista.iter_mut().find(|v| v.cuerpo == cuerpo)?;
        if v.tipo != Tipo::Auto { return None; }
        if let Some(c) = v.cab.get(&a) { return c.clone(); }
        let s = *v.asientos.get(a)?;
        if v.cols.is_none() { let arb = paq.d["pf"][&v.clave].as_array()?; let c = Cols::de(paq, v, arb)?; v.cols = Some(std::sync::Arc::new(c)); }
        let cab = v.cols.as_ref().map(|c| cabina_de(c, s));
        v.cab.insert(a, cab.clone()); cab
    }
    /// las alturas de la malla del auto que cruzan la vertical por x, z (en el marco del cuerpo), si ya se midió su cabina
    /// (para las pruebas: el techo arriba de la cabeza)
    pub fn cortes(&self, cuerpo: u32, x: f64, z: f64) -> Option<Vec<f64>> { Some(self.de(cuerpo)?.cols.as_ref()?.cortes(x, z)) }
    pub fn de_mut(&mut self, cuerpo: u32) -> Option<&mut Vehiculo> { self.lista.iter_mut().find(|v| v.cuerpo == cuerpo) }
    /// el vehículo donde está el jugador
    pub fn del_jugador(&self) -> Option<&Vehiculo> { self.jugador.and_then(|j| self.de(j.0)) }

    /// vehiculosPaso: un paso de todos (a 1/60, antes del agua y de `Fisica::paso`, como la web). `mando` es lo que pide
    /// el jugador (solo lo usa el vehículo que maneja); `aguas`, para los botes
    pub fn paso(&mut self, fis: &mut Fisica, mundo: &Mundo, aguas: Option<&Aguas>, dt: f64, mando: &Mando) {
        let jug = self.jugador;
        let mut sale: Option<(Salida, V)> = None;
        let vacio = self.vacio.get_or_insert_with(|| Mundo::nuevo(vec![], vec![], 1.0));
        for v in self.lista.iter_mut() {
            let Some(bi) = fis.indice(v.cuerpo) else { continue };
            if v.roto && v.tipo != Tipo::Asiento { v.motor = 0.0; }
            let al_volante = jug == Some((v.cuerpo, 0));
            let m = if al_volante && !v.roto { Some(mando) } else { None };
            match v.tipo {
                Tipo::Auto | Tipo::Moto => { let a = jug.filter(|j| j.0 == v.cuerpo).map(|j| j.1); if let Some(s) = auto_paso(v, fis, mundo, vacio, &mut self.items, aguas, dt, m, a, &mut self.eventos) { sale = Some(s); } }
                Tipo::Heli => heli_paso(v, &mut fis.cuerpos[bi], mundo, dt, m),
                Tipo::Avion => avion_paso(v, &mut fis.cuerpos[bi], mundo, dt, m),
                Tipo::Asiento => {}
            }
            let k = if v.tipo == Tipo::Avion { 60.0 } else { 0.0 };
            for r in v.rotores.iter_mut() { r.ang += dt * v.motor * (if k != 0.0 { k } else if r.eje[0] != 0.0 { 70.0 } else { 38.0 }); }
        }
        // (la moto chocó de frente: el piloto sale volando, como el CrashController del juego)
        if let Some((s, p)) = sale {
            self.jugador = None;
            self.eventos.push(Evento::Sonido { nombre: "Engine_Off", p, vol: 0.6 }); self.eventos.push(Evento::Salio(s)); self.eventos.push(Evento::Temblor(0.8));
        }
    }

    /// subirVehiculo: el jugador sube (al volante si está libre). Quien juega suelta lo que tenía agarrado y pone la
    /// mirada un poco para abajo (en la web, JUG.pitch = 0,15: −0,15 con el pitch nativo, + arriba)
    pub fn subir(&mut self, fis: &Fisica, cuerpo: u32) -> bool {
        let Some(v) = self.lista.iter_mut().find(|v| v.cuerpo == cuerpo) else { return false };
        if v.asientos.is_empty() { v.asientos.push([0.0, 0.6, 0.0]); }
        let p = fis.cuerpo(cuerpo).map(|b| b.pos).unwrap_or([0.0; 3]);
        self.jugador = Some((cuerpo, 0));
        if v.tipo != Tipo::Asiento { self.eventos.push(Evento::Sonido { nombre: if matches!(v.tipo, Tipo::Auto | Tipo::Moto) { "Engine_On" } else { "BuggyEngineOn" }, p, vol: 0.7 }); }
        self.eventos.push(Evento::Aviso(if v.tipo == Tipo::Asiento { "F para pararte" } else { "F para bajar" }));
        true
    }
    /// salirVehiculo: el jugador baja; dónde ponerlo y con qué velocidad
    pub fn salir(&mut self, fis: &Fisica, mundo: &Mundo) -> Option<Salida> {
        let (id, a) = self.jugador.take()?;
        let b = fis.cuerpo(id)?; let s = salida(mundo, b, a);
        if self.de(id).map_or(false, |v| v.tipo != Tipo::Asiento) { self.eventos.push(Evento::Sonido { nombre: "Engine_Off", p: b.pos, vol: 0.6 }); }
        Some(s)
    }
    /// lo que mira el jugador a menos de 4,5 m, si es un vehículo (para el cartel «E: subir» y el botón de usar)
    pub fn mirado(&self, fis: &mut Fisica, mundo: &Mundo, ojo: V, dir: V) -> Option<u32> {
        let h = fis.rayo(mundo, ojo, norm(dir), 4.5, &[])?; let id = h.cuerpo?;
        self.de(id).map(|v| v.cuerpo)
    }
    /// usar (la E, el botón de usar): adentro, baja; afuera, sube al vehículo que mira (desde los ojos, 4,5 m)
    pub fn usar(&mut self, fis: &mut Fisica, mundo: &Mundo, ojo: V, dir: V) -> Usar {
        if self.jugador.is_some() { return self.salir(fis, mundo).map_or(Usar::Nada, Usar::Salio); }
        match self.mirado(fis, mundo, ojo, dir) { Some(id) if self.subir(fis, id) => Usar::Subio(id), _ => Usar::Nada }
    }
    /// vehiculoCamara: la cámara con el jugador adentro. `pos`, `q`: el cuerpo (interpolado para dibujar, o el de la
    /// física); yaw y pitch del jugador con la convención nativa (pitch + arriba). En tercera persona gira alrededor del
    /// vehículo con la mirada (y se acerca si hay una pared); en primera, desde el asiento, con el giro del vehículo
    pub fn camara(&self, mundo: &Mundo, pos: V, q: Q, yaw: f64, pitch: f64) -> Option<Camara> {
        let (id, a) = self.jugador?; let v = self.de(id)?;
        let asiento = v.asientos.get(a).copied().unwrap_or([0.0, 1.0, 0.0]);
        let p_seat = add(pos, rot(q, add(asiento, [0.0, 0.75, 0.0])));
        let jugador = add(p_seat, [0.0, -0.5, 0.0]);
        // (la web mide el pitch al revés: + abajo)
        let qm = euler(yaw, -pitch);
        let (cp, cq) = if !self.primera {
            let tam = v.cam_dist.unwrap_or(match v.tipo { Tipo::Heli | Tipo::Avion => 11.0, Tipo::Asiento => 3.0, _ => 6.5 });
            let centro = add(pos, [0.0, if v.tipo == Tipo::Asiento { 1.2 } else { 1.6 }, 0.0]); let atras = rot(qm, [0.0, 0.0, -tam]);
            let d = largo(atras); let dir = esc(atras, 1.0 / d);
            let f = |x: V| [x[0] as f32, x[1] as f32, x[2] as f32];
            let h = mundo.rayo(f(centro), f(dir), d as f32);
            (add(centro, esc(dir, h.map_or(d, |h| (h.t as f64 - 0.3).max(0.5)))), qm)
        } else { (p_seat, qmul(q, qm)) };
        Some(Camara { pos: cp, q: cq, ojo: p_seat, jugador })
    }
    /// los sonidos que siguen, para este cuadro (bucle): el motor de cada uno prendido y el cohete de la bici
    pub fn bucles(&self, fis: &Fisica) -> Vec<Bucle> {
        let mut o = vec![];
        for v in &self.lista {
            let Some(b) = fis.cuerpo(v.cuerpo) else { continue };
            if v.motor > 0.02 && !v.bici {
                let tono = if matches!(v.tipo, Tipo::Auto | Tipo::Moto) { 0.7 + v.rpm * 0.9 } else { 0.8 + v.motor * 0.3 };
                o.push(Bucle { clave: format!("veh{}", v.cuerpo), nombre: v.sonido_motor(), p: b.pos, vol: 0.6 * v.motor.min(1.0), tono });
            }
            if v.bici && v.turbo { let t = v.tobera.unwrap_or([0.0, 0.3, -0.5]); o.push(Bucle { clave: format!("cohete{}", v.cuerpo), nombre: "HR_Rocket", p: add(b.pos, rot(b.q, t)), vol: 0.7, tono: 1.0 }); }
        }
        o
    }
    /// la bocina (bocinaPaso): con el botón apretado y el jugador al volante, qué bocina suena y dónde (la web la sintetiza:
    /// `bocina_pcm`)
    pub fn bocina(&self, fis: &Fisica, apretada: bool) -> Option<(&'static str, V)> {
        if !apretada { return None; }
        let (id, a) = self.jugador?; if a != 0 { return None; }
        let v = self.de(id)?; if v.roto { return None; }
        Some((v.bocina_tipo()?, fis.cuerpo(id)?.pos))
    }
    /// daño (un disparo, una explosión: armas.js); sin vida, se rompe (vehiculoRoto)
    pub fn danar(&mut self, fis: &Fisica, cuerpo: u32, dan: f64) {
        let Some(v) = self.lista.iter_mut().find(|v| v.cuerpo == cuerpo) else { return };
        v.vida -= dan;
        if v.vida <= 0.0 && !v.roto { v.roto = true; let p = fis.cuerpo(cuerpo).map(|b| b.pos).unwrap_or([0.0; 3]); self.eventos.push(Evento::Roto { cuerpo, p }); }
    }
}

// ---------------- manejar ----------------
/// el bote en el agua (el Airboat de HL2: el ventilador de atrás empuja y el timón de aire lo hace girar aunque esté quieto;
/// la quilla no lo deja ir de costado; el agua lo frena un poco y lo mantiene derecho). Flotar lo hace el agua (flotar.rs,
/// con la densidad de un bote). Hasta 21 m/s (~75 km/h), como el de HL2
fn bote_paso(v: &mut Vehiculo, b: &mut Cuerpo, dt: f64, ent: Option<&Mando>) {
    let fwd = rot(b.q, [0.0, 0.0, 1.0]); let up = rot(b.q, [0.0, 1.0, 0.0]); let k = 1.0;
    let f = [fwd[0], 0.0, fwd[2]]; if largo(f) < 1e-3 { return; } let f = norm(f); let lat = [f[2], 0.0, -f[0]];
    let gas = ent.map_or(0.0, |e| e.y); let giro = ent.map_or(0.0, |e| -e.x); let freno = ent.map_or(false, |e| e.freno);
    v.motor += ((if ent.is_some() { 1.0 } else { 0.0 }) - v.motor) * (dt * 2.0).min(1.0); v.giro += (giro - v.giro) * (dt * 5.0).min(1.0);
    let vlon = dot(b.vel, f); let vlat = dot(b.vel, lat); v.vel = vlon; v.rpm = (vlon.abs() / 21.0).min(1.0);
    let mut a = 0.0;
    if gas > 0.05 { a = gas * (if vlon < 21.0 { 7.5 } else { 0.0 }); } else if gas < -0.05 { a = gas * (if vlon > -6.0 { 4.0 } else { 0.0 }); }
    if freno { a = -signo(vlon) * (vlon.abs() / dt).min(9.0); }
    b.despertar();
    sumar(&mut b.vel, f, (a - vlon * 0.12) * k * dt);              // (empuje y el roce del agua)
    sumar(&mut b.vel, lat, -vlat * (dt * 2.6).min(1.0) * k);      // (la quilla)
    let wy = v.giro * (1.1 + (vlon.abs() / 10.0).min(1.0) * 0.7) * (if vlon < -0.5 { -1.0 } else { 1.0 });
    b.ang[1] += (wy - b.ang[1]) * (dt * 4.0).min(1.0) * k;      // (gira sobre el agua)
    let c = cruz(up, [0.0, 1.0, 0.0]); sumar(&mut b.ang, c, dt * 10.0 * k); b.ang[0] *= (-dt * 2.0 * k).exp(); b.ang[2] *= (-dt * 2.0 * k).exp();   // (derecho)
    for w in v.ruedas.iter_mut() { w.toca = false; w.comp_vis = -w.sd * 0.5; }
}

/// autoPaso: el auto y la moto (y el bote en tierra). `asiento`: dónde va el jugador, si va en este. Devuelve dónde sale el
/// jugador (y dónde estaba el vehículo) si la moto chocó de frente
fn auto_paso(v: &mut Vehiculo, fis: &mut Fisica, mundo: &Mundo, vacio: &Mundo, items: &mut Vec<u32>, aguas: Option<&Aguas>, dt: f64, ent: Option<&Mando>, asiento: Option<usize>, ev: &mut Vec<Evento>) -> Option<(Salida, V)> {
    let adentro = asiento.is_some();
    let id = v.cuerpo; let bi = fis.indice(id)?;
    // (un bote con agua debajo del casco —su centro a menos de 1,2 m sobre la superficie—)
    if v.bote {
        let p = fis.cuerpos[bi].pos;
        if let Some(a) = aguas { if a.agua_k(id) > 0.02 || a.en(p[0], p[1], p[2], 1.2).is_some() { bote_paso(v, &mut fis.cuerpos[bi], dt, ent); return None; } }
    }
    let (pos, q) = (fis.cuerpos[bi].pos, fis.cuerpos[bi].q);
    let up = rot(q, [0.0, 1.0, 0.0]); let fwd = rot(q, [0.0, 0.0, 1.0]); let rgt = rot(q, [1.0, 0.0, 0.0]);
    // la bici con cohete: correr (o el botón) prende el cohete: empuja fuerte para adelante (hasta 48 m/s)
    v.bici = v.art.as_deref() == Some("bici");
    if v.bici {
        v.turbo = ent.map_or(false, |e| e.turbo) && !v.roto;
        if v.turbo {
            let b = &mut fis.cuerpos[bi];
            if dot(b.vel, fwd) < 48.0 { b.despertar(); sumar(&mut b.vel, fwd, 22.0 * dt); }
            if v.tobera.is_none() { let a = b.geo.aabb; v.tobera = Some([0.0, 0.3, -(a[5] - a[2]) * 0.5]); }
            if adentro { ev.push(Evento::Temblor(0.06)); }
        }
    }
    // la dirección se endurece con la velocidad (a 30 m/s dobla un tercio): así no vuelca en las curvas
    let v_abs = v.vel.abs(); let objetivo = ent.map_or(0.0, |e| -e.x / (1.0 + v_abs / 24.0));
    v.giro += (objetivo - v.giro) * (dt * 6.0).min(1.0);
    let gas = ent.map_or(0.0, |e| e.y); let freno = ent.map_or(false, |e| e.freno);
    v.motor += ((if ent.is_some() { 1.0 } else { 0.0 }) - v.motor) * (dt * 2.0).min(1.0);
    let vz = dot(fis.cuerpos[bi].vel, fwd); v.vel = vz; v.rpm = (vz.abs() / 30.0).min(1.0);
    let m = fis.cuerpos[bi].masa; let nr = if v.ruedas.is_empty() { 1.0 } else { v.ruedas.len() as f64 };
    let mut tocan = 0usize;
    let (moto, bici, bote) = (v.tipo == Tipo::Moto, v.bici, v.bote);
    let vmax = if bici { if v.turbo { 48.0 } else { 13.0 } } else if moto { 34.0 } else { 32.0 };
    let giro = v.giro;
    for w in v.ruedas.iter_mut() {
        let pw = add(pos, rot(q, w.p)); let dir = esc(up, -1.0); let l = w.sd + w.r;
        let h = rayo_rueda(fis, mundo, vacio, pw, dir, l + 0.05, id, items);
        w.toca = h.map_or(false, |h| h.0 <= l);
        let Some((ht, hn)) = h.filter(|_| w.toca) else { w.comp_vis = -w.sd * 0.5; w.marca_p = None; continue };
        tocan += 1;
        let b = &mut fis.cuerpos[bi];
        let x = l - ht; let r = sub(add(pw, esc(dir, ht)), b.pos);
        let vp = add(b.vel, cruz(b.ang, r)); let vn = dot(vp, up);
        let mut ff = w.sp * x - w.da * 1.8 * vn; if ff < 0.0 { ff = 0.0; }
        ff = ff.min(m * 40.0);
        b.despertar(); aplicar(b, esc(up, ff * dt), r);
        w.comp_vis = x - w.sd * 0.5;
        // agarre: lateral (que no patine de costado) y avance
        let dir_w = if w.del { rot(b.q, rot(qeje([0.0, 1.0, 0.0], giro * 0.6), [0.0, 0.0, 1.0])) } else { fwd };
        let lat_w = norm(cruz(up, dir_w));
        let vlat = dot(vp, lat_w); let vlon = dot(vp, dir_w);
        // marca en el piso si la rueda patina de costado o frena fuerte
        let pc = add(pw, esc(dir, ht)); let pat = vlat.abs() > 3.5 || (freno && vlon.abs() > 4.0);
        if let (true, Some(de)) = (pat, w.marca_p) { ev.push(Evento::Marca { de, a: pc, n: hn, ancho: if moto { 0.14 } else { 0.24 }, k: (vlat.abs() - 2.0) / 8.0 + if freno { 0.5 } else { 0.0 } }); }
        w.marca_p = if pat { Some(pc) } else { None };
        let agarre = (if freno && !w.del { 0.35 } else { 1.0 }) * (ff * dt).min(m * 25.0 * dt / nr * 3.0);
        let jl = clamp(-vlat * m / nr * 0.9, -agarre * 1.05, agarre * 1.05);
        // el agarre de costado se aplica a la altura del centro de masa (las cubiertas no lo hacen rolar)
        let r_l = sub(r, esc(up, dot(r, up) * 0.85));
        aplicar(b, esc(lat_w, jl), r_l);
        // motor (tracción en todas) y freno
        let mut fz = 0.0;
        if gas > 0.05 { fz = gas * (if vlon < (if bote { 7.0 } else { vmax }) { 1.0 } else { 0.0 }) * m * (if bici { 4.5 } else if bote { 3.5 } else { 9.0 }) / nr; }   // (la bici, a pedal; el bote, en tierra, despacio)
        if gas < -0.05 { fz = if vlon > 1.0 { gas * m * 14.0 / nr } else { gas * (if vlon > -10.0 { 1.0 } else { 0.0 }) * m * 6.0 / nr }; }
        if freno { fz = -signo(vlon) * (vlon.abs() * m / nr / dt).min(m * 12.0 / nr); }
        if gas == 0.0 && !freno { fz = -vlon * m * 0.15 / nr; }
        aplicar(b, esc(dir_w, fz * dt), sub(r, esc(up, dot(r, up) * 0.7)));
        w.giro_ang += vlon / w.r * dt;
    }
    let b = &mut fis.cuerpos[bi];
    // dirección de arcade: con 3 ruedas en el piso el auto gira a lo que pide el volante (bicicleta: v · tan δ / distancia
    // entre ejes), con tope de 1,6 g de costado. Se lleva la velocidad de giro hacia esa, sin tocar el rolido
    if tocan >= 3 && v.tipo == Tipo::Auto && vz.abs() > 0.8 && !v.roto {
        let ejes = *v.ejes.get_or_insert_with(|| { let zs = v.ruedas.iter().map(|w| w.p[2]); (zs.clone().fold(f64::NEG_INFINITY, f64::max) - zs.fold(f64::INFINITY, f64::min)).max(1.5) });
        let del = v.giro * 0.6; let w_des = clamp(vz * del.tan() / ejes, -16.0 / vz.abs(), 16.0 / vz.abs()); let w_act = dot(b.ang, up);
        sumar(&mut b.ang, up, (w_des - w_act) * (dt * 14.0).min(1.0));
        // (y la velocidad sigue un poco más a la trompa: menos derrape de costado en la curva)
        let lat = dot(b.vel, rgt); sumar(&mut b.vel, rgt, -lat * (dt * 2.5).min(1.0));
    }
    // barra estabilizadora: frena el giro de costado (rolido) y lo endereza un poco mientras toca el piso
    if tocan >= 2 && !moto {
        let rol = dot(b.ang, fwd); let cab = dot(b.ang, rgt);
        sumar(&mut b.ang, fwd, -rol * (dt * 6.0).min(1.0)); sumar(&mut b.ang, rgt, -cab * (dt * 2.0).min(1.0));
        let inclin = dot(rgt, [0.0, 1.0, 0.0]); sumar(&mut b.ang, fwd, inclin * dt * 4.0);
    }
    // quieto sin acelerar: freno de mano suave (que no quede temblando)
    if tocan > 0 && gas == 0.0 && hypot_js(&[b.vel[0], b.vel[2]]) < 0.6 && !v.roto { b.vel[0] *= (-dt * 6.0).exp(); b.vel[2] *= (-dt * 6.0).exp(); b.ang = esc(b.ang, (-dt * 4.0).exp()); }
    if tocan == 0 { for w in v.ruedas.iter_mut() { w.giro_ang += v.vel / w.r * dt * 0.98; } }
    // la moto se mantiene derecha (y se inclina al doblar)
    if moto && !v.roto {
        let inc = clamp(-v.giro * clamp(v.vel.abs() / 12.0, 0.0, 1.0) * 1.6, -0.6, 0.6);   // se inclina hacia la curva
        let deseado = rot(qeje(fwd, inc), [0.0, 1.0, 0.0]);
        let c = cruz(up, deseado);
        sumar(&mut b.ang, c, dt * 30.0); let k = dot(b.ang, fwd); sumar(&mut b.ang, esc(fwd, k), -dt * 4.0);
        if tocan > 0 { let s = (-v.giro * clamp(v.vel / 6.0, -1.0, 1.0) * 1.8 - dot(b.ang, up)) * dt * 6.0; sumar(&mut b.ang, up, s); }
    }
    let mut adentro = adentro; let mut sale = None;
    // choque de frente con la moto: el piloto sale volando (como el CrashController del juego)
    if moto && adentro && v.vel_ant - v.vel.abs() > 9.0 {
        let v_ant = v.vel_ant; let mut s = salida(mundo, b, asiento.unwrap_or(0)); s.vel = add(esc(fwd, v_ant * 0.7), [0.0, 4.0, 0.0]);
        sale = Some((s, b.pos)); adentro = false;
    }
    v.vel_ant = v.vel.abs();
    // si quedó dado vuelta y quieto, se endereza solo
    if up[1] < 0.2 && largo(b.vel) < 1.0 && adentro {
        v.vuelco_t += dt;
        // (y se despierta: en la web quedaba dormido en el aire, con la forma en el lugar de antes, hasta que algo lo tocara)
        if v.vuelco_t > 2.0 { b.q = qeje([0.0, 1.0, 0.0], fwd[0].atan2(fwd[2])); b.pos[1] += 1.2; v.vuelco_t = 0.0; b.despertar(); b.actualizar(); fis.poner(id, fis.cuerpos[bi].pos, fis.cuerpos[bi].q); }
    }
    sale
}

/// el helicóptero: el empuje del rotor cancela el peso (saltar sube, agacharse baja), se inclina con la palanca y gira
fn heli_paso(v: &mut Vehiculo, b: &mut Cuerpo, mundo: &Mundo, dt: f64, ent: Option<&Mando>) {
    let up = rot(b.q, [0.0, 1.0, 0.0]); let fwd = rot(b.q, [0.0, 0.0, 1.0]); let rgt = rot(b.q, [1.0, 0.0, 0.0]);
    v.motor += ((if ent.is_some() { 1.0 } else { 0.0 }) - v.motor) * (dt * 1.2).min(1.0);
    if v.motor < 0.05 { return; }
    b.despertar();
    let g = GRAV * mundo.gravedad as f64;
    let sube = ent.map_or(0.0, |e| (if e.freno { 1.0 } else { 0.0 }) - (if e.agachar { 1.0 } else { 0.0 }));
    // empuje sobre el eje del rotor: con el motor arriba cancela el peso; con espacio/agacharse sube o baja
    let k = clamp((v.motor - 0.3) / 0.5, 0.0, 1.0);
    let emp = g * (1.0 + sube * 0.7) * k / up[1].max(0.5);
    sumar(&mut b.vel, up, emp * dt);
    // frenado del aire (más en vertical, así queda quieto en el aire)
    let vv = b.vel[1]; b.vel[1] -= vv * (dt * 1.2).min(1.0) * k; b.vel[0] *= (-dt * 0.35).exp(); b.vel[2] *= (-dt * 0.35).exp();
    // inclinación: adelante/atrás y costado; giro con la palanca
    let pdes = ent.map_or(0.0, |e| e.y * 0.35); let rdes = 0.0;
    let pit = clamp(-fwd[1], -1.0, 1.0).asin(); let rol = clamp(rgt[1], -1.0, 1.0).asin();
    sumar(&mut b.ang, rgt, (pdes - pit) * dt * 8.0); sumar(&mut b.ang, fwd, (rdes - rol) * dt * 8.0);
    let ydes = ent.map_or(0.0, |e| -e.x * 1.6); let s = (ydes - b.ang[1]) * dt * 3.0; sumar(&mut b.ang, [0.0, 1.0, 0.0], s);
    b.ang = esc(b.ang, (-dt * 2.0).exp());
}
/// el avión: el motor sube con saltar y baja con agacharse; las alas sostienen según la velocidad
fn avion_paso(v: &mut Vehiculo, b: &mut Cuerpo, mundo: &Mundo, dt: f64, ent: Option<&Mando>) {
    let up = rot(b.q, [0.0, 1.0, 0.0]); let fwd = rot(b.q, [0.0, 0.0, 1.0]); let rgt = rot(b.q, [1.0, 0.0, 0.0]);
    let acel = match ent { Some(e) => if e.freno { 1.0 } else if e.agachar { -1.0 } else { 0.0 }, None => -0.3 };
    v.motor = clamp(v.motor + acel * dt * 0.4, 0.0, 1.0);
    if v.motor < 0.01 && largo(b.vel) < 0.5 { return; }
    b.despertar();
    let vz = dot(b.vel, fwd); let g = GRAV * mundo.gravedad as f64;
    sumar(&mut b.vel, fwd, v.motor * 14.0 * dt);
    // sustentación según la velocidad; arrastre lateral y vertical (las alas "agarran" el aire)
    let lift = clamp(vz / 28.0, 0.0, 1.3) * g;
    sumar(&mut b.vel, up, lift * dt);
    let vlat = dot(b.vel, rgt); let vver = dot(b.vel, up);
    sumar(&mut b.vel, rgt, -vlat * dt * 1.5); sumar(&mut b.vel, up, -vver * dt * 0.8 * clamp(vz / 20.0, 0.0, 1.0));
    b.vel = esc(b.vel, (-dt * 0.02).exp());
    let ctl = clamp(vz / 20.0, 0.0, 1.0);
    if let Some(e) = ent { sumar(&mut b.ang, rgt, e.y * dt * 2.2 * ctl); sumar(&mut b.ang, fwd, -e.x * dt * 3.0 * ctl); }
    // alinear la nariz con la velocidad
    if vz > 5.0 { let vd = esc(b.vel, 1.0 / largo(b.vel)); sumar(&mut b.ang, cruz(fwd, vd), dt * 3.0); }
    b.ang = esc(b.ang, (-dt * 1.5).exp());
}

// ---------------- los botes de los addons ----------------
/// el árbol de un bote como lo arma gmvehPrefab (gmod_spawn.js) con un modelo sin ruedas —el Airboat de HL2, las lanchas
/// de los addons—: el casco (su malla, también de choque, casco fino), `bote`, los scripts de un auto (SCC_Drivetrain) y
/// cuatro apoyos que no se ven en las puntas de abajo del casco (radio: el alto × 0,15 entre 0,15 y 0,5; al 35 % del ancho
/// y del largo; recorrido 0,18 m; resorte y amortiguador según la masa). El Airboat no está en el paquete; con esto se arma
/// uno sobre el casco de otro prefab (`bote_de(paq, "Inflatable_boat")`: su malla, sus materiales, su masa y sus asientos)
pub fn arbol_bote(nombre: &str, malla: i64, mats: &[i64], mn: V, sc: V, masa: f64, asientos: &[V]) -> Value {
    let (nr, sd) = (4.0f64, 0.18f64);
    let r = (sc[1] * 0.15).clamp(0.15, 0.5); let sp = masa * 9.8 / nr / (sd * 0.5); let da = 0.25 * 2.0 * (sp * masa / nr).sqrt() / 1.8;
    let (cx, cz, ax, az) = (mn[0] + sc[0] / 2.0, mn[2] + sc[2] / 2.0, sc[0] * 0.35, sc[2] * 0.35);
    let mut arb = vec![serde_json::json!({ "n": nombre, "p": [0, 0, 0], "r": [0, 0, 0, 1], "s": [1, 1, 1], "pa": -1, "m": malla, "mt": mats,
        "col": [{ "k": "m", "m": malla, "cv": 2, "tr": 0 }], "rb": { "m": masa }, "mb": ["Vehicle", "SCC_Drivetrain"], "bote": true })];
    for (i, s) in asientos.iter().enumerate() {
        arb.push(serde_json::json!({ "n": if i == 0 { "SitPoint".to_string() } else { format!("SitPoint ({i})") }, "p": s, "r": [0, 0, 0, 1], "s": [1, 1, 1], "pa": 0 }));
    }
    // (sin asientos: en el medio, a media altura, como cuando el modelo no trae vehicle_driver_eyes)
    if asientos.is_empty() { arb.push(serde_json::json!({ "n": "SitPoint", "p": [cx, mn[1] + sc[1] * 0.55, cz], "r": [0, 0, 0, 1], "s": [1, 1, 1], "pa": 0 })); }
    for (sx, sz, n) in [(-1.0, 1.0, "fl"), (1.0, 1.0, "fr"), (-1.0, -1.0, "rl"), (1.0, -1.0, "rr")] {
        arb.push(serde_json::json!({ "n": format!("WC_{n}"), "p": [cx + sx * ax, mn[1] + r, cz + sz * az], "r": [0, 0, 0, 1], "s": [1, 1, 1], "pa": 0,
            "wc": { "c": [0, 0, 0], "r": r, "sd": sd, "sp": sp, "da": da } }));
    }
    Value::Array(arb)
}
/// un bote (`arbol_bote`) sobre el casco de un prefab del paquete que tenga la malla en la raíz (el bote inflable)
pub fn bote_de(paq: &Paquete, nombre: &str) -> Option<Value> {
    let k = paq.d["pf"].as_object()?.keys().find(|k| k.split('#').next() == Some(nombre))?;
    let arb = paq.d["pf"][k].as_array()?; let raiz = &arb[0];
    let m = raiz["m"].as_i64().filter(|&m| m >= 0)?; let md = &paq.d["ms"][m as usize];
    let mats: Vec<i64> = raiz["mt"].as_array()?.iter().filter_map(|x| x.as_i64()).collect();
    let asientos: Vec<V> = arb.iter().filter(|x| x["n"].as_str().map_or(false, |n| n.starts_with("SitPoint"))).map(|x| arr3(&x["p"], [0.0; 3])).collect();
    Some(arbol_bote("Airboat", m, &mats, arr3(&md["mn"], [0.0; 3]), arr3(&md["sc"], [1.0; 3]), num(&raiz["rb"]["m"], 400.0), &asientos))
}

// ---------------- la bocina ----------------
/// la bocina sintetizada como en la web (no hay sonido en el paquete), un pedazo que se repite sin cortes, mono, a
/// `hz` muestras por segundo: los autos, dos tonos en diente de sierra (370 y 466 Hz; la policía 440 y 554) con un filtro
/// pasabajos (2200 Hz, Q 2 dB) y volumen 0,32; la moto, 560 y 700 Hz con el filtro en 3200 Hz; la bici, un timbre: tres
/// parciales de campana (2650, 4100 y 5600 Hz) que se apagan rápido, un golpe cada 0,28 s, volumen 0,55
pub fn bocina_pcm(tipo: &str, hz: u32) -> Vec<f32> {
    let sr = hz as f64; let tau = std::f64::consts::TAU;
    if tipo == "timbre" {
        let n = (0.28 * sr).round() as usize;
        return (0..n).map(|i| {
            let t = i as f64 / sr; let g = if t < 0.01 { 0.9 } else { 0.9 * (-(t - 0.01) / 0.07).exp() };
            let s: f64 = [(2650.0, 1.0), (4100.0, 0.45), (5600.0, 0.2)].iter().map(|(f, a)| a * (tau * f * t).sin()).sum();
            (s * g * 0.55) as f32
        }).collect();
    }
    let (fr, fc) = match tipo { "moto" => ([560.0, 700.0], 3200.0), "policia" => ([440.0, 554.0], 2200.0), _ => ([370.0, 466.0], 2200.0) };
    // (el pasabajos del BiquadFilter de WebAudio: Q en dB)
    let w0 = tau * fc / sr; let qq = 10f64.powf(2.0 / 20.0); let al = w0.sin() / (2.0 * qq); let cw = w0.cos();
    let (b0, b1, b2, a0, a1, a2) = ((1.0 - cw) / 2.0, 1.0 - cw, (1.0 - cw) / 2.0, 1.0 + al, -2.0 * cw, 1.0 - al);
    let n = sr as usize; let (mut x1, mut x2, mut y1, mut y2) = (0.0, 0.0, 0.0, 0.0); let mut o = Vec::with_capacity(n);
    // (un segundo entero: los dos tonos dan vueltas justas y se repite sin salto; medio segundo antes para que el filtro se asiente)
    for i in 0..n + n / 2 {
        let t = (i % n) as f64 / sr;
        let x: f64 = fr.iter().map(|f| { let ph = (f * t).fract(); 2.0 * ph - 1.0 }).sum();
        let y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y;
        if i >= n / 2 { o.push((y * 0.32) as f32); }
    }
    o
}
