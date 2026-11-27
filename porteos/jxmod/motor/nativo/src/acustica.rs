//! Cómo suena el lugar donde está el jugador (lo que la web no tenía: el sonido espacial de la nativa). Catorce rayos desde
//! los oídos —ocho alrededor, cuatro en diagonal hacia arriba, uno al techo y uno al piso— miden hasta dónde hay pared;
//! con eso se elige uno de los 24 ambientes (campo abierto, calle, patio, pasillo, túnel, caño, baño, habitación, galpón,
//! iglesia, cueva, cañón con eco, bajo el agua, dentro del auto…) y su sala: el largo de la cola de la reverberación, cuánto
//! se apagan los agudos en ella, cuánto se mezcla, la demora hasta la cola, el eco de una pared lejana (con la demora de ida
//! y vuelta a 343 m/s) y el filtro de todo (bajo el agua, apagado). sonido.rs la usa en su mezcla.
use crate::sonido::Sala;

/// hasta dónde miran los rayos (m): más lejos es «abierto»
pub const LEJOS: f32 = 60.0;
/// las direcciones de los rayos (en el mundo, no según hacia dónde mira): 8 alrededor, 4 diagonales arriba, arriba y abajo
pub fn direcciones() -> [[f32; 3]; 14] {
    let mut d = [[0.0f32; 3]; 14]; let s = std::f32::consts::FRAC_1_SQRT_2;
    for k in 0..8 { let a = k as f32 * std::f32::consts::FRAC_PI_4; d[k] = [a.sin(), 0.0, a.cos()]; }
    for k in 0..4 { let a = k as f32 * std::f32::consts::FRAC_PI_2; d[8 + k] = [a.sin() * s, s, a.cos() * s]; }
    d[12] = [0.0, 1.0, 0.0]; d[13] = [0.0, -1.0, 0.0]; d
}

/// lo medido alrededor del oyente: la distancia de cada rayo (LEJOS si no pegó), si tiene los oídos bajo el agua y si va
/// adentro de un auto
#[derive(Clone, Copy, Debug)]
pub struct Medida { pub d: [f32; 14], pub agua: bool, pub auto: bool }

/// los ambientes: nombre y sala (cola 0..1, amortiguación 0..1, mezcla, demora ms, eco ms, eco, corte Hz)
pub const AMBIENTES: [(&str, Sala); 24] = [
    ("Campo abierto",        Sala { cola: 0.30, amort: 0.70, mezcla: 0.06, pre_ms: 30.0, eco_ms: 0.0, eco: 0.0, corte_hz: 20000.0 }),
    ("En lo alto",           Sala { cola: 0.20, amort: 0.80, mezcla: 0.03, pre_ms: 20.0, eco_ms: 0.0, eco: 0.0, corte_hz: 20000.0 }),
    ("Junto a una pared",    Sala { cola: 0.45, amort: 0.55, mezcla: 0.12, pre_ms: 8.0, eco_ms: 0.0, eco: 0.0, corte_hz: 20000.0 }),
    ("Cañón (eco)",          Sala { cola: 0.50, amort: 0.45, mezcla: 0.10, pre_ms: 25.0, eco_ms: 0.0, eco: 0.38, corte_hz: 20000.0 }),
    ("Calle",                Sala { cola: 0.62, amort: 0.45, mezcla: 0.18, pre_ms: 12.0, eco_ms: 0.0, eco: 0.18, corte_hz: 20000.0 }),
    ("Ciudad",               Sala { cola: 0.58, amort: 0.50, mezcla: 0.14, pre_ms: 18.0, eco_ms: 0.0, eco: 0.22, corte_hz: 20000.0 }),
    ("Patio",                Sala { cola: 0.66, amort: 0.40, mezcla: 0.22, pre_ms: 6.0, eco_ms: 0.0, eco: 0.0, corte_hz: 20000.0 }),
    ("Plaza",                Sala { cola: 0.70, amort: 0.45, mezcla: 0.20, pre_ms: 20.0, eco_ms: 0.0, eco: 0.20, corte_hz: 20000.0 }),
    ("Anfiteatro",           Sala { cola: 0.78, amort: 0.40, mezcla: 0.24, pre_ms: 35.0, eco_ms: 0.0, eco: 0.28, corte_hz: 20000.0 }),
    ("Bajo techo",           Sala { cola: 0.50, amort: 0.55, mezcla: 0.14, pre_ms: 5.0, eco_ms: 0.0, eco: 0.0, corte_hz: 20000.0 }),
    ("Galería",              Sala { cola: 0.68, amort: 0.45, mezcla: 0.22, pre_ms: 8.0, eco_ms: 0.0, eco: 0.0, corte_hz: 20000.0 }),
    ("Caño",                 Sala { cola: 0.86, amort: 0.15, mezcla: 0.42, pre_ms: 2.0, eco_ms: 0.0, eco: 0.0, corte_hz: 20000.0 }),
    ("Pasillo",              Sala { cola: 0.76, amort: 0.35, mezcla: 0.30, pre_ms: 4.0, eco_ms: 0.0, eco: 0.0, corte_hz: 20000.0 }),
    ("Túnel",                Sala { cola: 0.90, amort: 0.25, mezcla: 0.40, pre_ms: 10.0, eco_ms: 0.0, eco: 0.16, corte_hz: 20000.0 }),
    ("Escalera",             Sala { cola: 0.84, amort: 0.30, mezcla: 0.34, pre_ms: 6.0, eco_ms: 0.0, eco: 0.0, corte_hz: 20000.0 }),
    ("Cueva",                Sala { cola: 0.88, amort: 0.40, mezcla: 0.38, pre_ms: 14.0, eco_ms: 0.0, eco: 0.14, corte_hz: 20000.0 }),
    ("Baño",                 Sala { cola: 0.72, amort: 0.10, mezcla: 0.34, pre_ms: 1.0, eco_ms: 0.0, eco: 0.0, corte_hz: 20000.0 }),
    ("Habitación chica",     Sala { cola: 0.55, amort: 0.55, mezcla: 0.20, pre_ms: 2.0, eco_ms: 0.0, eco: 0.0, corte_hz: 20000.0 }),
    ("Habitación",           Sala { cola: 0.66, amort: 0.50, mezcla: 0.24, pre_ms: 4.0, eco_ms: 0.0, eco: 0.0, corte_hz: 20000.0 }),
    ("Salón",                Sala { cola: 0.80, amort: 0.40, mezcla: 0.28, pre_ms: 10.0, eco_ms: 0.0, eco: 0.0, corte_hz: 20000.0 }),
    ("Estacionamiento",      Sala { cola: 0.84, amort: 0.30, mezcla: 0.32, pre_ms: 8.0, eco_ms: 0.0, eco: 0.10, corte_hz: 20000.0 }),
    ("Galpón",               Sala { cola: 0.90, amort: 0.30, mezcla: 0.36, pre_ms: 18.0, eco_ms: 0.0, eco: 0.12, corte_hz: 20000.0 }),
    ("Iglesia",              Sala { cola: 0.95, amort: 0.22, mezcla: 0.42, pre_ms: 30.0, eco_ms: 0.0, eco: 0.10, corte_hz: 20000.0 }),
    ("Bajo el agua",         Sala { cola: 0.70, amort: 0.85, mezcla: 0.30, pre_ms: 5.0, eco_ms: 0.0, eco: 0.0, corte_hz: 550.0 }),
];
/// el auto por dentro (no cuenta como uno de los 24: va aparte)
pub const AUTO: Sala = Sala { cola: 0.35, amort: 0.80, mezcla: 0.16, pre_ms: 1.0, eco_ms: 0.0, eco: 0.0, corte_hz: 9000.0 };

/// el ambiente de lo medido: su número en AMBIENTES y la sala (con el eco a la distancia de la pared que lo devuelve)
pub fn ambiente(m: &Medida) -> (usize, Sala) {
    let k = |n: &str| AMBIENTES.iter().position(|a| a.0 == n).unwrap_or(0);
    if m.agua { let i = k("Bajo el agua"); return (i, AMBIENTES[i].1); }
    if m.auto { return (usize::MAX, AUTO); }
    let h = &m.d[..8]; let techo = m.d[12]; let piso = m.d[13];
    let pegan: Vec<f32> = h.iter().copied().filter(|d| *d < LEJOS).collect(); let n = pegan.len();
    let media = if n > 0 { pegan.iter().sum::<f32>() / n as f32 } else { LEJOS };
    let var = if n > 1 { (pegan.iter().map(|d| (d - media).powi(2)).sum::<f32>() / n as f32).sqrt() / media.max(0.1) } else { 0.0 };
    // (lo ancho y lo largo: de pared a pared en cada uno de los 4 ejes)
    let ejes: Vec<f32> = (0..4).map(|i| h[i] + h[i + 4]).collect();
    let angosto = ejes.iter().copied().fold(f32::MAX, f32::min); let largo = ejes.iter().copied().fold(0.0, f32::max);
    let min_h = h.iter().copied().fold(f32::MAX, f32::min);
    let cerrado = techo < LEJOS;
    let nombre = if cerrado {
        if n >= 7 {
            if angosto < 1.6 && largo > 6.0 { "Caño" }
            else if angosto < 2.8 && largo > 8.0 { "Pasillo" }
            else if angosto < 8.0 && largo > 30.0 { "Túnel" }
            else if techo > 10.0 && media < 3.0 { "Escalera" }
            else if var > 0.55 && techo < 20.0 && media > 3.0 { "Cueva" }
            else if media < 1.4 && techo < 3.5 { "Baño" }
            else if media < 2.3 { "Habitación chica" }
            else if media < 4.5 { "Habitación" }
            else if techo < 4.2 { "Estacionamiento" }
            else if media < 9.0 { "Salón" }
            else if techo > 14.0 { "Iglesia" }
            else { "Galpón" }
        } else if n <= 2 { "Bajo techo" } else { "Galería" }
    } else if n >= 7 {
        if media < 9.0 { "Patio" } else if media < 30.0 { "Plaza" } else { "Anfiteatro" }
    } else if n >= 3 {
        if angosto < 22.0 { "Calle" } else { "Ciudad" }
    } else if n >= 1 {
        if min_h > 18.0 { "Cañón (eco)" } else { "Junto a una pared" }
    } else if piso > 12.0 { "En lo alto" } else { "Campo abierto" };
    let i = k(nombre); let mut s = AMBIENTES[i].1;
    // (el eco: de la pared más cercana que esté a más de 8 m —ida y vuelta—; si no hay, sin eco)
    if s.eco > 0.0 { match pegan.iter().copied().filter(|d| *d > 8.0).fold(None, |a: Option<f32>, d| Some(a.map_or(d, |x| x.min(d)))) {
        Some(d) => s.eco_ms = (2.0 * d / 343.0 * 1000.0).min(1200.0), None => s.eco = 0.0 } }
    (i, s)
}

#[cfg(test)]
mod pruebas {
    use super::*;
    fn med(h: [f32; 8], techo: f32) -> Medida { let mut d = [LEJOS; 14]; d[..8].copy_from_slice(&h); d[12] = techo; d[13] = 1.6; Medida { d, agua: false, auto: false } }
    fn nom(m: &Medida) -> &'static str { let (i, _) = ambiente(m); AMBIENTES.get(i).map(|a| a.0).unwrap_or("Auto") }
    #[test]
    fn ambientes_de_lo_medido() {
        assert_eq!(nom(&med([LEJOS; 8], LEJOS)), "Campo abierto");
        assert_eq!(nom(&med([1.0, 1.4, 1.0, 1.4, 1.0, 1.4, 1.0, 1.4], 2.6)), "Baño");
        assert_eq!(nom(&med([3.0, 4.0, 3.0, 4.0, 3.0, 4.0, 3.0, 4.0], 2.8)), "Habitación");
        assert_eq!(nom(&med([20.0, 1.5, 1.2, 1.5, 20.0, 1.5, 1.2, 1.5], 2.8)), "Pasillo");
        assert_eq!(nom(&med([40.0, 2.5, 1.5, 2.5, 40.0, 2.5, 1.5, 2.5], 4.0)), "Túnel");
        assert_eq!(nom(&med([12.0, 0.8, 0.6, 0.8, 12.0, 0.8, 0.6, 0.8], 1.2)), "Caño");
        assert_eq!(nom(&med([18.0, 20.0, 18.0, 20.0, 18.0, 20.0, 18.0, 20.0], 25.0)), "Iglesia");
        assert_eq!(nom(&med([5.0, 7.0, 5.0, 7.0, 5.0, 7.0, 5.0, 7.0], LEJOS)), "Patio");
        assert_eq!(nom(&med([6.0, LEJOS, 30.0, LEJOS, 7.0, LEJOS, 40.0, LEJOS], LEJOS)), "Calle");
        let (_, s) = ambiente(&med([LEJOS, LEJOS, 34.3, LEJOS, LEJOS, LEJOS, LEJOS, LEJOS], LEJOS)); assert!((s.eco_ms - 200.0).abs() < 1.0 && s.eco > 0.0, "{s:?}");
        assert_eq!(nom(&Medida { agua: true, ..med([LEJOS; 8], LEJOS) }), "Bajo el agua");
        assert!(AMBIENTES.len() >= 20);
    }
}
