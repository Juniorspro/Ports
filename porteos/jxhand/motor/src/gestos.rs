//! Los gestos, con su intensidad y sin parpadear: cada uno tiene un umbral para prenderse y otro más bajo para apagarse
//! (histéresis) y tiene que sostenerse unos cuadros antes de cambiar.
use crate::esqueleto::{AngDedo, V3};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Gesto { Nada = 0, Abierta = 1, Puno = 2, Senalar = 3, Pinza = 4, Paz = 5, PulgarArriba = 6, Ok = 7, Cuernos = 8, Llamame = 9, PulgarAbajo = 10 }

#[derive(Clone, Copy, Debug, Default)]
pub struct Medidas {
    /// cierre de cada dedo (0 derecho, 1 cerrado)
    pub cierre: [f32; 5],
    /// 0..1: qué tan juntas están las puntas del pulgar y del índice (1 = tocándose)
    pub pinza: f32,
    /// 0..1: el promedio del cierre de los 4 dedos (para agarrar)
    pub agarre: f32,
    /// dedos estirados (0..5)
    pub dedos: u8,
}

pub fn medir(w: &[V3; 21], cierre: [f32; 5], ang: &[AngDedo; 5], tam_palma: f32, arriba: V3) -> (Medidas, Option<(Gesto, f32)>) {
    let d_pinza = w[4].menos(w[8]).largo() / tam_palma.max(1e-4);
    // tocándose ≈ 0,15 del largo de la palma; separados del todo ≈ 1
    let pinza = (1.0 - (d_pinza - 0.15) / 0.55).clamp(0.0, 1.0);
    let agarre = (cierre[1] + cierre[2] + cierre[3] + cierre[4]) / 4.0;
    // el pulgar está estirado si además se separa de la base del índice (escondido bajo los dedos queda pegado)
    let pulgar_afuera = w[4].menos(w[5]).largo() / tam_palma.max(1e-4) > 0.55;
    let estirado = |d: usize| if d == 0 { cierre[0] < 0.4 && pulgar_afuera } else { cierre[d] < 0.3 };
    let doblado = |d: usize| cierre[d] > 0.5;
    let _ = ang;
    let dedos = (0..5).filter(|&d| estirado(d)).count() as u8;
    let m = Medidas { cierre, pinza, agarre, dedos };
    // hacia dónde apunta el pulgar (para arriba/abajo), en el mundo (y hacia abajo en la imagen)
    let pulgar = w[4].menos(w[2]).unit();
    let vertical = -pulgar.punto(arriba);
    let g = if pinza > 0.8 && estirado(2) && estirado(3) && estirado(4) { Some((Gesto::Ok, pinza)) }
        else if pinza > 0.85 { Some((Gesto::Pinza, pinza)) }
        else if (1..5).all(doblado) && estirado(0) && vertical > 0.6 { Some((Gesto::PulgarArriba, vertical)) }
        else if (1..5).all(doblado) && estirado(0) && vertical < -0.6 { Some((Gesto::PulgarAbajo, -vertical)) }
        else if (1..5).all(doblado) && !estirado(0) { Some((Gesto::Puno, agarre)) }
        else if estirado(1) && estirado(2) && doblado(3) && doblado(4) { Some((Gesto::Paz, 1.0 - (cierre[1] + cierre[2]) / 2.0)) }
        else if estirado(1) && estirado(4) && doblado(2) && doblado(3) { Some((Gesto::Cuernos, 1.0 - (cierre[1] + cierre[4]) / 2.0)) }
        else if estirado(0) && estirado(4) && doblado(1) && doblado(2) && doblado(3) { Some((Gesto::Llamame, 1.0 - cierre[4])) }
        else if estirado(1) && doblado(2) && doblado(3) && doblado(4) { Some((Gesto::Senalar, 1.0 - cierre[1])) }
        else if (0..5).all(estirado) { Some((Gesto::Abierta, 1.0 - agarre)) }
        else { None };
    (m, g)
}

/// el gesto estable: cambia sólo si el nuevo se sostiene `cuadros` seguidos
#[derive(Clone, Copy, Debug)]
pub struct Estable { pub actual: Gesto, pub fuerza: f32, candidato: Gesto, cuenta: u8, pub cuadros: u8 }
impl Default for Estable { fn default() -> Self { Estable { actual: Gesto::Nada, fuerza: 0.0, candidato: Gesto::Nada, cuenta: 0, cuadros: 3 } } }
impl Estable {
    pub fn pasar(&mut self, g: Option<(Gesto, f32)>) {
        let (nuevo, f) = g.unwrap_or((Gesto::Nada, 0.0));
        if nuevo == self.actual { self.fuerza += (f - self.fuerza) * 0.5; self.cuenta = 0; return; }
        if nuevo == self.candidato { self.cuenta += 1; } else { self.candidato = nuevo; self.cuenta = 1; }
        if self.cuenta >= self.cuadros { self.actual = nuevo; self.fuerza = f; self.cuenta = 0; }
    }
}
