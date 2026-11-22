//! Filtros en el tiempo: One Euro (Casiez y otros, 2012), el que usa MediaPipe para las manos, con la velocidad medida
//! relativa al tamaño de la mano (así filtra igual una mano cerca que una lejos) y una predicción hacia adelante con
//! esa velocidad, para compensar el retraso de la cámara y del cálculo.
use std::f32::consts::PI;

#[derive(Clone, Copy, Debug)]
pub struct UnoEuro { pub min_corte: f32, pub beta: f32, pub d_corte: f32, x: f32, dx: f32, t: f64, listo: bool }

#[inline]
fn alfa(corte: f32, dt: f32) -> f32 { let tau = 1.0 / (2.0 * PI * corte); 1.0 / (1.0 + tau / dt) }

impl UnoEuro {
    pub fn nuevo(min_corte: f32, beta: f32, d_corte: f32) -> Self { UnoEuro { min_corte, beta, d_corte, x: 0.0, dx: 0.0, t: 0.0, listo: false } }
    pub fn reiniciar(&mut self) { self.listo = false; }
    /// filtra `v` (en el instante `t`, segundos); `escala`: el tamaño del objeto en las mismas unidades que `v`
    pub fn filtrar(&mut self, v: f32, t: f64, escala: f32) -> f32 {
        if !self.listo || t <= self.t { if !self.listo { self.x = v; self.dx = 0.0; self.listo = true; } self.t = t; return self.x; }
        let dt = ((t - self.t) as f32).clamp(1e-3, 0.5); self.t = t;
        let dv = (v - self.x) / dt;
        self.dx += (dv - self.dx) * alfa(self.d_corte, dt);
        let corte = self.min_corte + self.beta * (self.dx / escala.max(1e-6)).abs();
        self.x += (v - self.x) * alfa(corte, dt);
        self.x
    }
    pub fn valor(&self) -> f32 { self.x }
    /// la velocidad estimada (unidades por segundo)
    pub fn velocidad(&self) -> f32 { self.dx }
}

/// un punto 3D filtrado, con predicción. La predicción usa su propia velocidad (la de la salida ya filtrada, con un
/// paso bajo más rápido, `v_corte`) y se apaga suave cuando la mano casi no se mueve: así adelantar no agrega temblor
/// con la mano quieta, y el filtro puede ser bien suave quieto sin llegar tarde cuando se mueve.
#[derive(Clone, Copy, Debug)]
pub struct Filtro3 { pub e: [UnoEuro; 3], pub v_corte: f32, previo: [f32; 3], vel: [f32; 3], t: f64, escala: f32, listo: bool }
impl Filtro3 {
    pub fn nuevo(min_corte: f32, beta: f32, d_corte: f32) -> Self { let f = UnoEuro::nuevo(min_corte, beta, d_corte); Filtro3 { e: [f, f, f], v_corte: 5.0, previo: [0.0; 3], vel: [0.0; 3], t: 0.0, escala: 1.0, listo: false } }
    pub fn filtrar(&mut self, v: [f32; 3], t: f64, escala: f32) -> [f32; 3] {
        let x = [self.e[0].filtrar(v[0], t, escala), self.e[1].filtrar(v[1], t, escala), self.e[2].filtrar(v[2], t, escala)];
        if self.listo && t > self.t {
            let dt = ((t - self.t) as f32).clamp(1e-3, 0.5); let a = alfa(self.v_corte, dt);
            for i in 0..3 { self.vel[i] += ((x[i] - self.previo[i]) / dt - self.vel[i]) * a; }
        }
        self.previo = x; self.t = t; self.escala = escala; self.listo = true; x
    }
    pub fn predecir(&self, seg: f32) -> [f32; 3] {
        // la puerta: velocidad en «manos por segundo»; debajo de 0,05 no adelanta, arriba de 0,3 adelanta todo
        let rap = (self.vel[0] * self.vel[0] + self.vel[1] * self.vel[1]).sqrt() / self.escala.max(1e-6);
        let k = ((rap - 0.05) / 0.25).clamp(0.0, 1.0); let k = k * k * (3.0 - 2.0 * k);
        [self.previo[0] + self.vel[0] * seg * k, self.previo[1] + self.vel[1] * seg * k, self.previo[2] + self.vel[2] * seg * k]
    }
    pub fn reiniciar(&mut self) { for f in &mut self.e { f.reiniciar(); } self.listo = false; self.vel = [0.0; 3]; }
}
