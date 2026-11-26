//! La luz global de Definitivo (sin luz horneada): una grilla de sondas alrededor del jugador, calculada en un hilo aparte con
//! rayos contra el mundo del mapa —una copia de sus triángulos—. Cada sonda dice cuánto cielo se ve desde ahí (adentro de una
//! casa, casi nada: la luz de todos lados se apaga) y cuánta luz del sol rebota hacia ella desde lo que está al sol (el piso
//! donde entra el sol por una puerta ilumina la habitación). El motor la sube como textura (EF_GI) y la lee en la luz de cada
//! punto; las sondas que quedaron dentro de una pared no cuentan (se guardan multiplicadas por si valen, así al mezclarlas no
//! oscurecen). Se rehace al alejarse el jugador o al moverse el sol.
use std::sync::mpsc;

/// la grilla: 32 × 10 × 32 sondas cada 2 m (64 × 20 × 64 m)
pub const N: [usize; 3] = [32, 10, 32];
pub const PASO: f32 = 2.0;

/// lo calculado: dónde empieza la grilla y por sonda RGBA (cielo de arriba × vale, rebote × vale, vale, cielo de los costados × vale)
pub struct Grilla { pub origen: [f32; 3], pub datos: Vec<u8>, pub sol: [f32; 3] }

struct Pedido { origen: [f32; 3], sol: [f32; 3] }

#[derive(Default)]
pub struct LuzGlobal {
    mapa: String,
    tx: Option<mpsc::Sender<Pedido>>, rx: Option<mpsc::Receiver<Grilla>>,
    pub actual: Option<Grilla>, pub version: u32, enviada: u32, pidiendo: bool,
}

/// las direcciones de los rayos: los 6 ejes y las 8 diagonales
fn direcciones() -> [[f32; 3]; 14] {
    let d = 1.0 / 3f32.sqrt();
    [[1.0, 0.0, 0.0], [-1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, -1.0, 0.0], [0.0, 0.0, 1.0], [0.0, 0.0, -1.0],
     [d, d, d], [-d, d, d], [d, d, -d], [-d, d, -d], [d, -d, d], [-d, -d, d], [d, -d, -d], [-d, -d, -d]]
}

/// una sonda: (cielo de arriba 0..1, rebote 0..1, vale, cielo de los costados 0..1 —lo que entra por puertas y ventanas: para
/// las paredes—)
pub fn sonda(m: &jxjuego::mundo::Mundo, p: [f32; 3], sol: [f32; 3]) -> (f32, f32, bool, f32) {
    let rayo = |o: [f32; 3], d: [f32; 3], max: f64| jxjuego::persona::rayo_mundo(m, [o[0] as f64, o[1] as f64, o[2] as f64], [d[0] as f64, d[1] as f64, d[2] as f64], max);
    let (mut cielo, mut peso_cielo, mut rebote, mut pegados) = (0.0f32, 0.0f32, 0.0f32, 0);
    let (mut lado, mut peso_lado) = (0.0f32, 0.0f32);
    let dirs = direcciones();
    for d in dirs.iter() {
        let h = rayo(p, *d, 30.0);
        if d[1] > 0.05 { peso_cielo += d[1]; if h.is_none() { cielo += d[1]; } }
        // (los costados: los 4 horizontales y las 4 diagonales que suben, éstas con menos peso)
        if d[1].abs() < 0.05 || (d[1] > 0.05 && d[1] < 0.7) { let k = if d[1].abs() < 0.05 { 1.0 } else { 0.7 }; peso_lado += k; if h.is_none() { lado += k; } }
        if let Some((t, nh)) = h {
            if t < 0.3 { pegados += 1; continue; }
            // (lo que el rayo toca: si le da el sol, rebota hacia la sonda —albedo 0,5—)
            let nh = [nh[0] as f32, nh[1] as f32, nh[2] as f32]; let cs = nh[0] * sol[0] + nh[1] * sol[1] + nh[2] * sol[2];
            if cs > 0.0 && sol[1] > 0.0 {
                let q = [p[0] + d[0] * t as f32 + nh[0] * 0.05, p[1] + d[1] * t as f32 + nh[1] * 0.05, p[2] + d[2] * t as f32 + nh[2] * 0.05];
                if rayo(q, sol, 60.0).is_none() { rebote += cs * 0.5; }
            }
        }
    }
    let n = dirs.len() as f32;
    (if peso_cielo > 0.0 { cielo / peso_cielo } else { 1.0 }, (rebote / n * 2.2).min(1.0), pegados * 3 < dirs.len(), if peso_lado > 0.0 { lado / peso_lado } else { 1.0 })
}

/// la grilla entera desde `origen`
pub fn calcular(m: &jxjuego::mundo::Mundo, origen: [f32; 3], sol: [f32; 3]) -> Grilla {
    let [nx, ny, nz] = N; let mut datos = vec![0u8; nx * ny * nz * 4];
    for z in 0..nz { for y in 0..ny { for x in 0..nx {
        let p = [origen[0] + (x as f32 + 0.5) * PASO, origen[1] + (y as f32 + 0.5) * PASO, origen[2] + (z as f32 + 0.5) * PASO];
        let (c, r, vale, l) = sonda(m, p, sol);
        // (en la textura: cada piso —y— es una baldosa de nx de ancho, una al lado de la otra; z hacia abajo)
        let i = (z * nx * ny + y * nx + x) * 4; let v = if vale { 1.0 } else { 0.0 };
        datos[i] = (c * v * 255.0).round() as u8; datos[i + 1] = (r * v * 255.0).round() as u8; datos[i + 2] = (v * 255.0) as u8; datos[i + 3] = (l * v * 255.0).round() as u8;
    } } }
    Grilla { origen, datos, sol }
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
            let q = |v: f32| (v / (PASO * 4.0)).round() * PASO * 4.0;
            let origen = [q(jugador[0]) - N[0] as f32 * PASO * 0.5, q(jugador[1]) - N[1] as f32 * PASO * 0.3, q(jugador[2]) - N[2] as f32 * PASO * 0.5];
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

#[cfg(test)]
mod pruebas {
    use super::*;
    /// una caja cerrada con una puerta: adentro poco cielo; afuera, todo; lo que queda dentro de la pared no vale
    #[test]
    fn caja_con_puerta() {
        let mut t: Vec<f32> = vec![];
        let mut quad = |a: [f32; 3], b: [f32; 3], c: [f32; 3], d: [f32; 3]| { for v in [a, b, c, a, c, d] { t.extend_from_slice(&v); } };
        // piso grande, y una casa de 6×3×6 con techo y una puerta en la pared de +z
        quad([-30.0, 0.0, -30.0], [30.0, 0.0, -30.0], [30.0, 0.0, 30.0], [-30.0, 0.0, 30.0]);
        quad([-3.0, 3.0, -3.0], [3.0, 3.0, -3.0], [3.0, 3.0, 3.0], [-3.0, 3.0, 3.0]);
        quad([-3.0, 0.0, -3.0], [3.0, 0.0, -3.0], [3.0, 3.0, -3.0], [-3.0, 3.0, -3.0]);
        quad([-3.0, 0.0, -3.0], [-3.0, 0.0, 3.0], [-3.0, 3.0, 3.0], [-3.0, 3.0, -3.0]);
        quad([3.0, 0.0, -3.0], [3.0, 0.0, 3.0], [3.0, 3.0, 3.0], [3.0, 3.0, -3.0]);
        quad([-3.0, 0.0, 3.0], [-1.0, 0.0, 3.0], [-1.0, 3.0, 3.0], [-3.0, 3.0, 3.0]);
        quad([1.0, 0.0, 3.0], [3.0, 0.0, 3.0], [3.0, 3.0, 3.0], [1.0, 3.0, 3.0]);
        let m = jxjuego::mundo::Mundo::nuevo(t, vec![], 1.0);
        let sol = { let s = [0.3f32, 0.8, 0.5]; let l = (s[0] * s[0] + s[1] * s[1] + s[2] * s[2]).sqrt(); [s[0] / l, s[1] / l, s[2] / l] };
        let (c_afuera, _, v1, l_afuera) = sonda(&m, [15.0, 1.5, 15.0], sol);
        let (c_adentro, r_adentro, v2, l_adentro) = sonda(&m, [0.0, 1.5, 0.0], sol);
        assert!(l_afuera > 0.95 && l_adentro < l_afuera, "los costados: afuera {l_afuera}, adentro {l_adentro}");
        assert!(v1 && v2, "las dos valen");
        assert!(c_afuera > 0.95, "afuera se ve el cielo: {c_afuera}");
        assert!(c_adentro < 0.2, "adentro casi no: {c_adentro}");
        assert!(r_adentro >= 0.0);
        let g = calcular(&m, [-8.0, 0.0, -8.0], sol); assert_eq!(g.datos.len(), N[0] * N[1] * N[2] * 4);
    }
}
