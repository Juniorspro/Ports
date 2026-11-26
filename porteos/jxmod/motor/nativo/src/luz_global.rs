//! La luz global de Definitivo (sin luz horneada): una grilla de sondas alrededor del jugador, calculada en un hilo aparte con
//! rayos contra el mundo del mapa —una copia de sus triángulos—. Cada sonda guarda, para cada uno de los seis rumbos (±x, ±y,
//! ±z, como el «cubo de ambiente» de Source), cuánto cielo ve una cara que mira para ese lado y cuánta luz rebota hacia ella
//! (del sol en lo que está al sol y del cielo en lo que lo ve: el piso al lado de la puerta ilumina la habitación).
//!
//! Lo que la luz no puede atravesar: una pared ilumina por cada lado lo suyo. Las sondas que quedaron adentro de algo
//! cerrado (lo ven de atrás) no valen, y las que tienen una pared pegada en un rumbo tampoco valen para ese rumbo: las dos se
//! rellenan con la vecina de ese lado —la de más allá de la pared—, así una pared de adentro no toma la luz de afuera al
//! mezclar sondas vecinas. El motor la sube como textura (EF_GI) y la lee en la luz de cada punto, según su normal. Se rehace
//! al alejarse el jugador o al moverse el sol.
use std::sync::mpsc;

/// la grilla: 32 × 10 × 32 sondas cada 2 m (64 × 20 × 64 m)
pub const N: [usize; 3] = [32, 10, 32];
pub const PASO: f32 = 2.0;
/// lo que devuelve de la luz lo que toca un rayo (el albedo de todo) y la luz del cielo al lado de la del sol
const ALB: f32 = 0.5;
const K_CIELO: f32 = 0.35;
/// una pared más cerca que esto en un rumbo de costado: la sonda no vale para ese rumbo (la cara que lo mira está del otro lado)
const PEGADA: f64 = 1.2;
/// los seis rumbos: +x, -x, +y, -y, +z, -z
pub const EJES: [[f32; 3]; 6] = [[1.0, 0.0, 0.0], [-1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, -1.0, 0.0], [0.0, 0.0, 1.0], [0.0, 0.0, -1.0]];
const LADOS: [usize; 4] = [0, 1, 4, 5];

/// lo calculado: dónde empieza la grilla y, por sonda, tres RGBA en tres franjas de la textura (cada franja: un piso —y— al
/// lado del otro, de nx de ancho; z hacia abajo): cielo de los costados (+x, -x, +z, -z), rebote de los costados y (cielo de
/// arriba, rebote de arriba, de abajo, lo que hay hasta el piso de abajo en pasos —1: nada—). El cielo de abajo no va: es el
/// promedio del de los costados
pub struct Grilla { pub origen: [f32; 3], pub datos: Vec<u8>, pub sol: [f32; 3] }

/// una sonda: el cielo y el rebote de cada rumbo (0..1), si vale, en qué rumbos de costado tiene una pared pegada y cuánto
/// hay hasta el piso de abajo (en pasos, hasta 1: con una losa entre dos sondas, cada punto usa sólo las de su lado)
#[derive(Clone, Copy, Debug, Default)]
pub struct Sonda { pub s: [f32; 6], pub b: [f32; 6], pub vale: bool, pub pegada: [bool; 6], pub bajo: f32 }

/// los rayos de cada sonda: los 6 ejes primero (para ver paredes pegadas) y después `n` repartidos parejo en la esfera
/// (espiral de Fibonacci); cuánto cuenta cada uno para cada lado, la suma por lado y cuánto cielo vería ese lado en un campo
/// abierto (para que afuera dé 1)
struct Rayos { d: Vec<[f32; 3]>, w: Vec<[f32; 6]>, suma: [f32; 6], abierto: [f32; 6] }
/// los de cada sonda de la grilla
const RAYOS: usize = 48;
impl Rayos {
    fn nuevo(n: usize) -> Rayos {
        let mut d: Vec<[f32; 3]> = EJES.to_vec();
        let oro = std::f32::consts::PI * (3.0 - 5f32.sqrt());
        for i in 0..n { let y = 1.0 - 2.0 * (i as f32 + 0.5) / n as f32; let r = (1.0 - y * y).max(0.0).sqrt(); let a = oro * i as f32; d.push([r * a.cos(), y, r * a.sin()]); }
        let w: Vec<[f32; 6]> = d.iter().map(|r| { let mut w = [0.0; 6]; for (k, e) in EJES.iter().enumerate() { w[k] = (r[0] * e[0] + r[1] * e[1] + r[2] * e[2]).max(0.0); } w }).collect();
        let (mut suma, mut abierto) = ([0.0f32; 6], [0.0f32; 6]);
        for (r, w) in d.iter().zip(&w) { for k in 0..6 { suma[k] += w[k]; if r[1] > -1e-4 { abierto[k] += w[k]; } } }
        for k in 0..6 { abierto[k] /= suma[k].max(1e-6); }
        Rayos { d, w, suma, abierto }
    }
}

/// una sonda en `p`: sus rayos, y por cada uno que toca algo de frente, lo tocado (para el rebote del cielo)
fn sonda_de(m: &jxjuego::mundo::Mundo, p: [f32; 3], sol: [f32; 3], rs: &Rayos, buf: &mut (Vec<u32>, Vec<u32>), mut toque: impl FnMut(usize, [f32; 3], [f32; 3])) -> Sonda {
    let v64 = |v: [f32; 3]| [v[0] as f64, v[1] as f64, v[2] as f64];
    let mut o = Sonda { bajo: 1.0, ..Default::default() }; let (mut atras, mut pegados) = (0, 0);
    for (k, r) in rs.d.iter().enumerate() {
        match jxjuego::persona::rayo_tris(m, v64(p), v64(*r), 30.0, &mut buf.0, &mut buf.1) {
            // (no tocó nada: cielo —para abajo, un barranco: la mitad—)
            None => { let c = if r[1] > -0.05 { 1.0 } else { 0.5 }; for e in 0..6 { o.s[e] += rs.w[k][e] * c; } }
            Some((t, nh, de_atras)) => {
                if k == 3 { o.bajo = (t as f32 / PASO).min(1.0); }
                if de_atras { if t < 4.0 { atras += 1; } continue; }
                if t < 0.3 { pegados += 1; }
                if k < 6 && t < PEGADA && LADOS.contains(&k) { o.pegada[k] = true; }
                // (lo que toca, si le da el sol, rebota hacia la sonda)
                let nh = [nh[0] as f32, nh[1] as f32, nh[2] as f32]; let q = [p[0] + r[0] * t as f32 + nh[0] * 0.05, p[1] + r[1] * t as f32 + nh[1] * 0.05, p[2] + r[2] * t as f32 + nh[2] * 0.05];
                let cs = nh[0] * sol[0] + nh[1] * sol[1] + nh[2] * sol[2];
                if cs > 0.0 && sol[1] > 0.0 && jxjuego::persona::rayo_tris(m, v64(q), v64(sol), 60.0, &mut buf.0, &mut buf.1).is_none() { for e in 0..6 { o.b[e] += rs.w[k][e] * cs * ALB; } }
                toque(k, q, nh);
            }
        }
    }
    let n = rs.d.len();
    o.vale = atras * 4 < n && pegados * 3 < n;
    if !o.vale { o.bajo = 0.0; }
    for e in 0..6 { o.s[e] /= rs.suma[e]; o.b[e] /= rs.suma[e]; if e != 2 && e != 3 { o.s[e] = (o.s[e] / rs.abierto[e]).min(1.0); } }
    // (para abajo no se ve cielo: lo que llega es lo del piso de alrededor, que lo ve si los costados están abiertos)
    o.s[3] = (o.s[0] + o.s[1] + o.s[4] + o.s[5]) * 0.25;
    o
}

/// una sonda sola (sin el rebote del cielo, que sale de la grilla entera)
pub fn sonda(m: &jxjuego::mundo::Mundo, p: [f32; 3], sol: [f32; 3]) -> Sonda { sonda_con(m, p, sol, RAYOS) }
/// una sonda sola con `n` rayos (muchos: lo que de verdad ve ese punto, para medir la grilla)
pub fn sonda_con(m: &jxjuego::mundo::Mundo, p: [f32; 3], sol: [f32; 3], n: usize) -> Sonda { sonda_de(m, p, sol, &Rayos::nuevo(n), &mut (vec![], vec![]), |_, _, _| {}) }

fn indice(x: usize, y: usize, z: usize) -> usize { (z * N[1] + y) * N[0] + x }

/// lo de cada rumbo que no sirve (sonda que no vale, o pared pegada en un costado) se rellena con la vecina de ese lado —la
/// de más allá de la pared, a uno o dos pasos— y si no hay, con el promedio de las vecinas que sirven
fn rellenar(son: &[Sonda], v: &mut [[f32; 6]]) {
    let [nx, ny, nz] = N;
    let mut ok: Vec<[bool; 6]> = son.iter().map(|s| { let mut o = [s.vale; 6]; for e in LADOS { o[e] = s.vale && !s.pegada[e]; } o }).collect();
    let paso = |i: usize, e: usize, k: i32| -> Option<usize> {
        let (x, y, z) = ((i % nx) as i32, ((i / nx) % ny) as i32, (i / (nx * ny)) as i32); let d = EJES[e];
        let (a, b, c) = (x + d[0] as i32 * k, y + d[1] as i32 * k, z + d[2] as i32 * k);
        (a >= 0 && b >= 0 && c >= 0 && (a as usize) < nx && (b as usize) < ny && (c as usize) < nz).then(|| indice(a as usize, b as usize, c as usize))
    };
    for _ in 0..4 {
        let antes = ok.clone(); let mut algo = false;
        for i in 0..v.len() { for e in 0..6 {
            if antes[i][e] { continue; }
            // (y si no, la de arriba: lo de adentro de una losa lo usa lo que está encima —lo de abajo no la mira, por `bajo`—)
            let lejos = [1, 2].iter().filter_map(|&k| paso(i, e, k)).find(|&j| antes[j][e]).or_else(|| paso(i, 2, 1).filter(|&j| antes[j][e]));
            let val = if let Some(j) = lejos { Some(v[j][e]) } else {
                let (mut s, mut n) = (0.0, 0); for f in 0..6 { for k in [1, -1] { if let Some(j) = paso(i, f, k) { if antes[j][e] { s += v[j][e]; n += 1; } } } }
                (n > 0).then(|| s / n as f32)
            };
            if let Some(x) = val { v[i][e] = x; ok[i][e] = true; algo = true; }
        } }
        if !algo { break; }
    }
    // (lo que quedó sin nada —adentro de algo grueso—: oscuro)
    for i in 0..v.len() { for e in 0..6 { if !ok[i][e] { v[i][e] = 0.0; } } }
}

/// el valor para una cara con normal `n` en `p` de una grilla por rumbos (mezcla de las 8 sondas de alrededor, como la placa:
/// cada rumbo pesa el cuadrado de su parte de la normal; si entre las dos alturas de sondas hay una losa —lo que tienen las
/// de arriba hasta su piso—, sólo las del lado del punto); None fuera de la grilla
fn mezcla(v: &[[f32; 6]], bajo: &[f32], origen: [f32; 3], p: [f32; 3], n: [f32; 3]) -> Option<f32> {
    let mut g = [0.0f32; 3];
    for k in 0..3 { g[k] = (p[k] - origen[k]) / PASO - 0.5; if g[k] < -0.5 || g[k] > N[k] as f32 - 0.5 { return None; } g[k] = g[k].clamp(0.0, N[k] as f32 - 1.0); }
    let a = [g[0].floor() as usize, g[1].floor() as usize, g[2].floor() as usize]; let f = [g[0] - a[0] as f32, g[1] - a[1] as f32, g[2] - a[2] as f32];
    let cara = |s: &[f32; 6]| { let sel = |k: usize, pos: usize, neg: usize| n[k] * n[k] * if n[k] > 0.0 { s[pos] } else { s[neg] }; sel(0, 0, 1) + sel(1, 2, 3) + sel(2, 4, 5) };
    // (por altura: la mezcla de las 4 de cada piso)
    let piso = |y: usize, q: &dyn Fn(usize) -> f32| -> f32 { let mut t = 0.0;
        for dz in 0..2 { for dx in 0..2 { let (x, z) = ((a[0] + dx).min(N[0] - 1), (a[2] + dz).min(N[2] - 1));
            t += (if dx == 1 { f[0] } else { 1.0 - f[0] }) * (if dz == 1 { f[2] } else { 1.0 - f[2] }) * q(indice(x, y, z)); } }
        t };
    let (y0, y1) = (a[1], (a[1] + 1).min(N[1] - 1));
    Some(mix(piso(y0, &|i| cara(&v[i])), piso(y1, &|i| cara(&v[i])), lado_losa(f[1], g[1], y1 as f32, piso(y1, &|i| bajo[i]))))
}
fn mix(a: f32, b: f32, t: f32) -> f32 { a + (b - a) * t }
fn smooth(a: f32, b: f32, x: f32) -> f32 { let t = ((x - a) / (b - a)).clamp(0.0, 1.0); t * t * (3.0 - 2.0 * t) }
/// cuánto de las sondas de arriba (como el sombreador): `fy` lo de siempre; con una losa entre las dos alturas —la de arriba
/// tiene su piso a menos de un paso—, 1 si el punto está encima de ella y 0 si está debajo
fn lado_losa(fy: f32, gy: f32, y1: f32, bajo1: f32) -> f32 {
    let hs = y1 - bajo1; let k = smooth(hs - 0.07, hs + 0.07, gy);
    mix(fy, k, 1.0 - smooth(0.85, 0.95, bajo1))
}

/// la grilla entera desde `origen`
pub fn calcular(m: &jxjuego::mundo::Mundo, origen: [f32; 3], sol: [f32; 3]) -> Grilla {
    let [nx, ny, nz] = N; let rs = Rayos::nuevo(RAYOS); let mut buf = (vec![], vec![]);
    let mut son: Vec<Sonda> = Vec::with_capacity(nx * ny * nz);
    // (lo que tocó cada rayo de frente: la sonda, el rayo, el punto y su normal)
    let mut toques: Vec<(u32, u8, [f32; 3], [f32; 3])> = vec![];
    for z in 0..nz { for y in 0..ny { for x in 0..nx {
        let i = son.len() as u32; let p = [origen[0] + (x as f32 + 0.5) * PASO, origen[1] + (y as f32 + 0.5) * PASO, origen[2] + (z as f32 + 0.5) * PASO];
        let antes = toques.len();
        let s = sonda_de(m, p, sol, &rs, &mut buf, |k, q, nh| toques.push((i, k as u8, q, nh)));
        if !s.vale { toques.truncate(antes); }
        son.push(s);
    } } }
    let bajo: Vec<f32> = son.iter().map(|s| s.bajo).collect();
    let mut cielo: Vec<[f32; 6]> = son.iter().map(|s| s.s).collect(); rellenar(&son, &mut cielo);
    for c in cielo.iter_mut() { c[3] = (c[0] + c[1] + c[4] + c[5]) * 0.25; }
    // (el rebote del cielo: lo que tocó cada rayo, cuánto cielo ve —de la grilla ya rellena—)
    let mut reb: Vec<[f32; 6]> = son.iter().map(|s| s.b).collect();
    for &(i, k, q, nh) in &toques {
        let Some(c) = mezcla(&cielo, &bajo, origen, [q[0] + nh[0] * 0.3, q[1] + nh[1] * 0.3, q[2] + nh[2] * 0.3], nh) else { continue };
        for e in 0..6 { reb[i as usize][e] += rs.w[k as usize][e] * ALB * K_CIELO * c / rs.suma[e]; }
    }
    rellenar(&son, &mut reb);
    // (en la textura: tres franjas de nx·ny de ancho)
    let an = nx * ny; let mut datos = vec![0u8; an * 3 * nz * 4];
    let b8 = |v: f32| (v.clamp(0.0, 1.0) * 255.0).round() as u8;
    for z in 0..nz { for y in 0..ny { for x in 0..nx {
        let i = indice(x, y, z); let (s, b) = (cielo[i], reb[i]);
        for (f, px) in [[s[0], s[1], s[4], s[5]], [b[0], b[1], b[4], b[5]], [s[2], b[2], b[3], bajo[i]]].iter().enumerate() {
            let o = (z * an * 3 + f * an + y * nx + x) * 4; for c in 0..4 { datos[o + c] = b8(px[c]); }
        }
    } } }
    Grilla { origen, datos, sol }
}

/// lo que lee la placa en `p` para una cara con normal `n` (cielo 0..1 —1 afuera—, rebote), de los datos ya en bytes: para
/// medir la grilla tal como se ve. Fuera de la grilla, (1, 0) como la placa
pub fn muestra(g: &Grilla, p: [f32; 3], n: [f32; 3]) -> (f32, f32) {
    let [nx, ny, _] = N; let an = nx * ny; let k = g.datos.len() / 12;
    let (mut s, mut b, mut bajo) = (vec![[0.0f32; 6]; k], vec![[0.0f32; 6]; k], vec![0.0f32; k]);
    for i in 0..k { let (x, y, z) = (i % nx, (i / nx) % ny, i / an); let px = |f: usize, c: usize| g.datos[(z * an * 3 + f * an + y * nx + x) * 4 + c] as f32 / 255.0;
        let lado = (px(0, 0) + px(0, 1) + px(0, 2) + px(0, 3)) * 0.25;
        s[i] = [px(0, 0), px(0, 1), px(2, 0), lado, px(0, 2), px(0, 3)]; b[i] = [px(1, 0), px(1, 1), px(2, 1), px(2, 2), px(1, 2), px(1, 3)]; bajo[i] = px(2, 3); }
    (mezcla(&s, &bajo, g.origen, p, n).unwrap_or(1.0), mezcla(&b, &bajo, g.origen, p, n).unwrap_or(0.0))
}

struct Pedido { origen: [f32; 3], sol: [f32; 3] }

#[derive(Default)]
pub struct LuzGlobal {
    mapa: String,
    tx: Option<mpsc::Sender<Pedido>>, rx: Option<mpsc::Receiver<Grilla>>,
    pub actual: Option<Grilla>, pub version: u32, enviada: u32, pidiendo: bool,
}

impl LuzGlobal {
    /// cada cuadro (sólo en Definitivo): el hilo del mapa, pedir la grilla si hace falta y levantar la nueva; devuelve los
    /// bloques del cuadro (EF_GI y, si cambió, sus datos)
    pub fn paso(&mut self, mapa: &str, tris: &[f32], jugador: [f32; 3], sol: [f32; 3]) -> Vec<(u32, Vec<f32>)> {
        if self.mapa != mapa || self.tx.is_none() {
            *self = LuzGlobal { mapa: mapa.to_string(), version: self.version, ..Default::default() };
            let (tx, rx_hilo) = mpsc::channel::<Pedido>(); let (tx_hilo, rx) = mpsc::channel::<Grilla>();
            let t = tris.to_vec();
            let ok = std::thread::Builder::new().name("luz_global".into()).spawn(move || {
                let m = jxjuego::mundo::Mundo::nuevo(t, vec![], 1.0);
                while let Ok(mut p) = rx_hilo.recv() { while let Ok(q) = rx_hilo.try_recv() { p = q; } if tx_hilo.send(calcular(&m, p.origen, p.sol)).is_err() { break; } }
            }).is_ok();
            if !ok { return vec![]; }
            self.tx = Some(tx); self.rx = Some(rx);
        }
        if let Some(g) = self.rx.as_ref().and_then(|r| r.try_iter().last()) { self.actual = Some(g); self.version += 1; self.pidiendo = false; }
        // (pedir otra: no hay, el jugador se alejó más de un cuarto del medio o el sol se movió)
        let medio = |g: &Grilla| [g.origen[0] + N[0] as f32 * PASO * 0.5, g.origen[1] + N[1] as f32 * PASO * 0.3, g.origen[2] + N[2] as f32 * PASO * 0.5];
        let lejos = self.actual.as_ref().map_or(true, |g| { let c = medio(g); (jugador[0] - c[0]).abs() > N[0] as f32 * PASO * 0.25 || (jugador[2] - c[2]).abs() > N[2] as f32 * PASO * 0.25 || (jugador[1] - c[1]).abs() > N[1] as f32 * PASO * 0.3 });
        let sol_movido = self.actual.as_ref().map_or(false, |g| (g.sol[0] - sol[0]).abs() + (g.sol[1] - sol[1]).abs() + (g.sol[2] - sol[2]).abs() > 0.08);
        if (lejos || sol_movido) && !self.pidiendo {
            let origen = origen_para(jugador);
            if let Some(tx) = &self.tx { if tx.send(Pedido { origen, sol }).is_ok() { self.pidiendo = true; } }
        }
        let Some(g) = &self.actual else { return vec![] };
        let mut b = vec![(jxmotor::escena::EF_GI, vec![g.origen[0], g.origen[1], g.origen[2], PASO, N[0] as f32, N[1] as f32, N[2] as f32, self.version as f32])];
        if self.enviada != self.version { b.push((jxmotor::escena::EF_GI_DATOS, g.datos.iter().map(|&x| x as f32).collect())); self.enviada = self.version; }
        b
    }
    /// el motor perdió la textura (cambio de motor, volver de segundo plano): mandarla de nuevo
    pub fn reenviar(&mut self) { self.enviada = 0; }
}

/// dónde empieza la grilla para un jugador en `j` (redondeado a 4 pasos: al moverse poco, la misma)
pub fn origen_para(j: [f32; 3]) -> [f32; 3] {
    let q = |v: f32| (v / (PASO * 4.0)).round() * PASO * 4.0;
    [q(j[0]) - N[0] as f32 * PASO * 0.5, q(j[1]) - N[1] as f32 * PASO * 0.3, q(j[2]) - N[2] as f32 * PASO * 0.5]
}

#[cfg(test)]
mod pruebas {
    use super::*;
    /// una casa de 6×3×6 con paredes de 30 cm, techo y una puerta en la pared de +z, en un piso grande: adentro poco cielo,
    /// afuera todo; la pared de adentro no toma la luz de afuera; lo que queda dentro de la pared no vale
    fn casa() -> jxjuego::mundo::Mundo {
        let mut t: Vec<f32> = vec![];
        // (una caja cerrada con las caras para afuera)
        let mut caja = |a: [f32; 3], b: [f32; 3]| {
            let v = |x: usize, y: usize, z: usize| [if x == 0 { a[0] } else { b[0] }, if y == 0 { a[1] } else { b[1] }, if z == 0 { a[2] } else { b[2] }];
            let caras = [[v(0, 0, 0), v(0, 0, 1), v(0, 1, 1), v(0, 1, 0)], [v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1)], [v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)],
                         [v(0, 1, 0), v(0, 1, 1), v(1, 1, 1), v(1, 1, 0)], [v(0, 0, 0), v(0, 1, 0), v(1, 1, 0), v(1, 0, 0)], [v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1)]];
            for [p, q, r, s] in caras { for x in [p, q, r, p, r, s] { t.extend_from_slice(&x); } }
        };
        caja([-40.0, -1.0, -40.0], [40.0, 0.0, 40.0]);
        caja([-3.3, 3.0, -3.3], [3.3, 3.3, 3.3]);
        caja([-3.3, 0.0, -3.3], [3.3, 3.0, -3.0]); caja([-3.3, 0.0, -3.0], [-3.0, 3.0, 3.3]); caja([3.0, 0.0, -3.0], [3.3, 3.0, 3.3]);
        caja([-3.0, 0.0, 3.0], [-1.0, 3.0, 3.3]); caja([1.0, 0.0, 3.0], [3.0, 3.0, 3.3]);
        jxjuego::mundo::Mundo::nuevo(t, vec![], 1.0)
    }
    #[test]
    fn casa_con_puerta() {
        let m = casa();
        let sol = { let s = [0.3f32, 0.8, 0.5]; let l = (s[0] * s[0] + s[1] * s[1] + s[2] * s[2]).sqrt(); [s[0] / l, s[1] / l, s[2] / l] };
        let afuera = sonda(&m, [28.0, 1.5, -28.0], sol); let adentro = sonda(&m, [0.0, 1.5, 0.0], sol);
        assert!(afuera.vale && adentro.vale, "las dos valen");
        assert!(afuera.s.iter().enumerate().all(|(e, &s)| e == 3 || s > 0.95), "afuera se ve el cielo para todos lados: {:?}", afuera.s);
        assert!(adentro.s[2] < 0.1, "adentro, para arriba casi nada: {:?}", adentro.s);
        assert!(adentro.s[4] > adentro.s[5] + 0.1, "adentro entra más por la puerta (+z): {:?}", adentro.s);
        assert!(!sonda(&m, [3.15, 1.5, 0.0], sol).vale, "adentro de la pared no vale");
        // (la pared de -x por dentro, mirando a +x: con la grilla mezclada no toma la luz de afuera)
        let g = calcular(&m, [-9.0, -0.5, -9.0], sol); assert_eq!(g.datos.len(), N[0] * N[1] * N[2] * 12);
        let (s_pared, _) = muestra(&g, [-3.0 + 0.6, 1.5, -1.0], [1.0, 0.0, 0.0]);
        let (s_fuera, _) = muestra(&g, [-3.3 - 0.6, 1.5, -1.0], [-1.0, 0.0, 0.0]);
        assert!(s_pared < 0.35 && s_fuera > 0.8, "pared de adentro {s_pared}, la misma de afuera {s_fuera}");
    }
}
