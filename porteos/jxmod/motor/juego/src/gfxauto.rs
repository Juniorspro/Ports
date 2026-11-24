//! gfxauto.js de la web: la calidad más alta que sostiene los cuadros de la pantalla, medida en el aparato.
//! La primera vez que se entra a un mapa en la sesión (con Automático), detrás de la pantalla de carga y con el mapa ya
//! armado, se dibuja la escena de verdad en una calidad y se cuentan los cuadros. Se arranca por la que salió la vez
//! anterior (si es el mismo aparato y la misma placa) o la que está puesta, se sube mientras sostenga y se baja hasta que
//! llegue; si ninguna llega, la que dio más cuadros (empate, a menos del 4 %: la más alta). Tope de toda la búsqueda: 12 s.
//! La web pide 60 cuadros (acepta ≥ 57: una pantalla de 60 Hz da 59,x); la nativa pide el refresco de la pantalla con el
//! mismo margen (120 Hz: ≥ 114), así en un celular de 120 Hz busca los 120 pegados.
//! `paso` es gfxBuscar escrito para ir de a un cuadro (sin async): con lo medido hasta ahora dice qué medir o cuál queda.

/// las calidades (PERF_ORDEN: patata, bajo, medio, alto, ultra)
pub const N: usize = 5;
/// lo medido de cada calidad: None sin medir (undefined en la web), Some(None) cortada por el tope (null), Some(Some(fps))
pub type Medidas = [Option<Option<f32>>; N];
/// el tope de toda la búsqueda (GFXA.tope) y lo que se estima que tarda una medida antes de ver ninguna (dura)
pub const TOPE: f64 = 12.0;
const DURA0: f64 = 2.5;

/// los cuadros que se piden: 57 de 60 en la web; en la nativa, el 95 % del refresco de la pantalla
pub fn umbral(refresco: f32) -> f32 { if refresco > 1.0 { refresco * 0.95 } else { 57.0 } }

/// gfxFps: los cuadros por segundo de una lista de tiempos (s), sin los tirones sueltos (los cuadros de más del triple de
/// la mediana: el recolector, una textura que sube, otra app). Devuelve también cuántos tirones sacó.
pub fn fps_de(l: &[f64]) -> (f32, usize) {
    if l.len() < 3 { return (0.0, 0); }
    let d: Vec<f64> = l.windows(2).map(|w| w[1] - w[0]).collect();
    let mut s = d.clone(); s.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let med = s[s.len() >> 1];
    let (mut n, mut t) = (0usize, 0.0f64);
    for &x in &d { if x <= med * 3.0 { n += 1; t += x; } }
    (if n > 0 && t > 0.0 { (n as f64 / t) as f32 } else { 0.0 }, d.len() - n)
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Paso { Medir(usize), Listo(usize) }

/// gfxBuscar: con lo medido, la próxima calidad a medir o la elegida. `tarde`: ya no queda tiempo para medir otra
/// (lo que en la web es vence()).
pub fn paso(inicio: usize, med: &Medidas, umbral: f32, tarde: bool) -> Paso {
    let i = if inicio < N { inicio } else { 2 };
    // (fps(k) de la web: lo cortado por el tope cuenta -1)
    let f = |k: usize| med[k].map(|x| x.unwrap_or(-1.0));
    let Some(fi) = f(i) else { return Paso::Medir(i) };
    if fi >= umbral {
        let mut eleg = i;
        for k in i + 1..N {
            let Some(fk) = f(k) else { if tarde { break } return Paso::Medir(k) };
            if fk >= umbral { eleg = k } else { break }
        }
        return Paso::Listo(eleg);
    }
    for k in (0..i).rev() {
        let Some(fk) = f(k) else { if tarde { break } return Paso::Medir(k) };
        if fk >= umbral { return Paso::Listo(k) }
    }
    // (ninguna llega: la que más se acerca por debajo; si empatan —a menos del 4 %—, la más alta)
    let mejor = med.iter().filter_map(|m| m.flatten()).fold(0.0f32, f32::max);
    let mut eleg = None;
    for (q, m) in med.iter().enumerate() { if let Some(Some(v)) = m { if *v >= mejor * 0.96 { eleg = Some(q) } } }
    Paso::Listo(eleg.unwrap_or(i))
}

/// lo que el juego tiene que hacer después de un cuadro de la búsqueda
#[derive(Clone, Debug, PartialEq)]
pub enum Accion { Poner(usize), Listo { elegida: usize, med: Medidas } }

/// la búsqueda de a un cuadro (gfxMedir + gfxMedirUna): `empezar` y después `cuadro` con la hora de cada cuadro (s)
#[derive(Clone, Debug, Default)]
pub struct Busqueda {
    activa: bool,
    /// ya se midió en esta sesión (GFXA.medido)
    pub medido: bool,
    inicio: usize, med: Medidas, umbral: f32,
    t0: f64, hasta: f64, dura: f64,
    // (la calidad que se está midiendo, cuándo se puso y en qué fase va: 0 asentarse, 1 contar)
    q: usize, tq: f64, fase: u8, ult: f64, buenos: u32,
    v: Vec<f64>, w: Vec<f32>, l: Vec<f64>, tc: f64,
    /// los tirones sacados de las medidas
    pub tirones: usize,
    /// lo que salió: la elegida, lo medido, desde qué calidad arrancó y cuánto tardó (s)
    pub resultado: Option<(usize, Medidas, usize, f64)>,
}
impl Busqueda {
    pub fn midiendo(&self) -> bool { self.activa }
    /// empieza desde `inicio` pidiendo `umbral` cuadros; devuelve la primera calidad a poner
    pub fn empezar(&mut self, inicio: usize, umbral: f32, ahora: f64) -> Accion {
        *self = Busqueda { activa: true, inicio: if inicio < N { inicio } else { 2 }, umbral, t0: ahora, hasta: ahora + TOPE, dura: DURA0, ..Default::default() };
        match paso(self.inicio, &self.med, umbral, false) { Paso::Medir(k) => { self.medir(k, ahora); Accion::Poner(k) } Paso::Listo(k) => self.terminar(k, ahora) }
    }
    fn medir(&mut self, k: usize, ahora: f64) { self.q = k; self.tq = ahora; self.fase = 0; self.ult = 0.0; self.buenos = 0; self.v.clear(); self.w.clear(); self.l.clear(); }
    fn terminar(&mut self, k: usize, ahora: f64) -> Accion {
        self.activa = false; self.medido = true; self.resultado = Some((k, self.med, self.inicio, ahora - self.t0));
        Accion::Listo { elegida: k, med: self.med }
    }
    /// un cuadro dibujado en la calidad puesta, a la hora `a` (s)
    pub fn cuadro(&mut self, a: f64) -> Option<Accion> {
        if !self.activa { return None }
        if self.fase == 0 {
            // (asentada: 6 cuadros seguidos de menos de 80 ms —la nativa sube las texturas al cargar el mapa—, o 2 s,
            // o se acaba el tope)
            if self.ult > 0.0 && a - self.ult < 0.080 { self.buenos += 1 } else { self.buenos = 0 }
            self.ult = a;
            if self.buenos >= 6 || a - self.tq > 2.0 || a > self.hasta - 0.9 { self.fase = 1; self.tc = a; }
            return None;
        }
        // (se cuenta en ventanas de 0,4 s y ≥ 20 cuadros, y vale cuando dos seguidas dan lo mismo ±15 %; hasta 1,8 s)
        self.v.push(a); self.l.push(a);
        let n = self.v.len() - 1; let dt = a - self.v[0];
        let mut listo = false;
        if dt >= 0.4 && n >= 20 {
            let (f, t) = fps_de(&self.v); self.tirones += t; self.w.push(f); self.v = vec![a];
            let k = self.w.len();
            if k >= 2 && (self.w[k - 1] - self.w[k - 2]).abs() <= 0.15 * self.w[k - 1].max(self.w[k - 2]) { listo = true }
        }
        if !listo && (a - self.tc > 1.8 || a > self.hasta) { listo = true }
        if !listo { return None }
        // (cortada por el tope antes de una ventana entera: no se midió —null—, no es que dé 0)
        let r = if let Some(&f) = self.w.last() { Some(f) } else if self.l.len() >= 12 { let (f, t) = fps_de(&self.l); self.tirones += t; Some(f) } else { None };
        self.med[self.q] = Some(r);
        self.dura = self.dura.max(a - self.tq);
        let tarde = a - self.t0 + self.dura > TOPE;
        Some(match paso(self.inicio, &self.med, self.umbral, tarde) { Paso::Medir(k) => { self.medir(k, a); Accion::Poner(k) } Paso::Listo(k) => self.terminar(k, a) })
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    /// una escena que da `fps[q]` cuadros en cada calidad (con los primeros 4 cuadros lentos al cambiar, como al compilar
    /// los sombreadores): la búsqueda tiene que medir cerca de lo que da y elegir lo mismo que paso() con esos números
    fn correr(fps: [f32; N], inicio: usize, um: f32) -> (usize, Medidas, f64) {
        let mut b = Busqueda::default(); let mut t = 10.0f64;
        let mut q = match b.empezar(inicio, um, t) { Accion::Poner(q) => q, Accion::Listo { .. } => unreachable!() };
        let mut n = 0u32;
        for _ in 0..200_000 {
            let dt = if n < 4 { 0.3 } else { 1.0 / fps[q] as f64 * (1.0 + 0.02 * ((n % 7) as f64 - 3.0) / 3.0) };
            t += dt; n += 1;
            match b.cuadro(t) { Some(Accion::Poner(k)) => { q = k; n = 0; } Some(Accion::Listo { elegida, med }) => return (elegida, med, t - 10.0), None => {} }
        }
        panic!("no terminó")
    }
    #[test]
    fn mide_y_elige() {
        // (sube de Medio a Alto, Ultra no llega: Alto)
        let (e, m, s) = correr([200.0, 150.0, 90.0, 61.0, 40.0], 2, 57.0);
        assert_eq!(e, 3); assert!(s < TOPE + 3.0, "tardó {s}");
        for q in 2..5 { let v = m[q].unwrap().unwrap(); let f = [200.0, 150.0, 90.0, 61.0, 40.0][q]; assert!((v - f).abs() / f < 0.03, "medida {q}: {v} de {f}"); }
        assert_eq!(m[0], None); assert_eq!(m[1], None);
        // (con 120 Hz pide 114: queda Bajo)
        assert_eq!(correr([200.0, 150.0, 90.0, 61.0, 40.0], 2, umbral(120.0)).0, 1);
        // (ninguna llega: la que más da; empate a menos del 4 %: la más alta)
        assert_eq!(correr([50.0, 49.0, 48.5, 30.0, 20.0], 4, 57.0).0, 2);
    }
    #[test]
    fn tirones_fuera() {
        let mut l = vec![0.0]; for i in 1..40 { l.push(l[i - 1] + if i == 20 { 0.5 } else { 1.0 / 60.0 }); }
        let (f, t) = fps_de(&l); assert_eq!(t, 1); assert!((f - 60.0).abs() < 0.01, "{f}");
    }
}
