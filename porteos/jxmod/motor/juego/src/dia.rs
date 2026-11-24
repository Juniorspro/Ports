//! La hora del día (dia.js): el sol del mapa a mediodía y desde ahí sale, cruza y se pone; atardecer naranja, noche azul
//! oscura, luna del lado contrario (que también da sombra) y los ojos que se acostumbran. Con «ciclo» la hora avanza sola
//! (2 horas de juego por minuto). Se aplica siempre (también a las 12, como diaGuardarBase: a mediodía el sol queda a la
//! altura de su arco y la niebla de los mapas con niebla propia, como en la web).
use crate::mapa::LuzBase;
use jxmotor::escena::Cielo;

/// cómo es la niebla del mapa: exponencial (aj.fd), lineal de Source (env_fog_controller) o la del cielo
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TipoNiebla { #[default] Cielo, Exp, Lineal }

/// DIA: la hora, si avanza sola y cuántas horas de juego por minuto real; la última aplicada
#[derive(Clone, Debug)]
pub struct Dia { pub hora: f32, pub ciclo: bool, pub vel: f32, pub aplicada: f32 }
impl Default for Dia { fn default() -> Self { Dia { hora: 12.0, ciclo: false, vel: 2.0, aplicada: -1.0 } } }

/// lo que queda después de aplicar la hora: la luz en gamma, el cielo, cuánto es de noche y lo que se abren los ojos
#[derive(Clone, Debug)]
pub struct Aplicado { pub base: LuzBase, pub noche: f32, pub expo_k: f32, pub luna: [f32; 3] }

fn sstep(a: f32, b: f32, x: f32) -> f32 { let t = ((x - a) / (b - a)).clamp(0.0, 1.0); t * t * (3.0 - 2.0 * t) }
fn mix3(a: [f32; 3], b: [f32; 3], t: f32) -> [f32; 3] { [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] }
fn norm(a: [f32; 3]) -> [f32; 3] { let l = (a[0] * a[0] + a[1] * a[1] + a[2] * a[2]).sqrt(); let l = if l > 0.0 { l } else { 1.0 }; a.map(|x| x / l) }
fn lum(c: [f32; 3]) -> f32 { c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11 }

impl Dia {
    /// diaPaso: avanza la hora si hay ciclo; true si hay que volver a aplicarla
    pub fn paso(&mut self, dt: f32) -> bool {
        if self.ciclo { self.hora = (self.hora + dt * self.vel / 60.0) % 24.0; }
        (self.hora - self.aplicada).abs() > 0.002
    }
    /// diaAplicar sobre la luz de base del mapa (`espacio`: el cielo siempre negro, sin día ni noche)
    pub fn aplicar(&mut self, b: &LuzBase, niebla: TipoNiebla, espacio: bool) -> Aplicado {
        self.aplicada = self.hora;
        if espacio { return Aplicado { base: b.clone(), noche: 0.0, expo_k: 1.0, luna: [0.0, 1.0, 0.0] }; }
        let h = self.hora; let pi = std::f32::consts::PI;
        let el0 = b.sol[1].clamp(0.2, 0.98).asin(); let az0 = b.sol[0].atan2(b.sol[2]);
        // elevación: el mapa a las 12; 0 a las 6 y 18; negativa de noche. Recorrido de este a oeste
        let el = el0 * ((h - 6.0) / 12.0 * pi).sin(); let az = az0 + (h - 12.0) / 12.0 * pi * 0.85;
        let sol = norm([el.cos() * az.sin(), el.sin(), el.cos() * az.cos()]);
        let s = ((h - 6.0) / 12.0 * pi).sin();
        let dia = sstep(-0.1, 0.3, s); let tarde = sstep(-0.16, 0.02, s) * (1.0 - sstep(0.06, 0.36, s)); let noche = 1.0 - sstep(-0.22, 0.0, s);
        let (nt, nm, nb) = ([0.012, 0.02, 0.06], [0.05, 0.07, 0.13], [0.03, 0.035, 0.05]);
        let bc = &b.cielo;
        let top = mix3(mix3(nt, bc.top, dia), [0.25, 0.32, 0.55], tarde * 0.35);
        let mid = mix3(mix3(nm, bc.mid, dia), [1.0, 0.56, 0.32], tarde * 0.75);
        let bot = mix3(mix3(nb, bc.bot, dia), [0.45, 0.32, 0.3], tarde * 0.5);
        // de día y al atardecer alumbra el sol; de noche, la luna (azulada y débil, del lado contrario)
        let (sd, sc) = if s > -0.08 { (if sol[1] < 0.04 { norm([sol[0], 0.04, sol[2]]) } else { sol }, mix3(b.sol_col, [1.0, 0.5, 0.22], tarde).map(|x| x * sstep(-0.08, 0.12, s))) }
            else { (norm([-sol[0], (-sol[1]).max(0.35), -sol[2]]), [0.16f32, 0.2, 0.3].map(|x| x * noche)) };
        let luna = norm([-sol[0], (-sol[1]).max(0.2), -sol[2]]);
        let k = 0.2 + 0.8 * dia;
        let amb_s = mix3(mix3(b.amb_s.map(|x| x * k), [0.11, 0.13, 0.23], noche * 0.8), [0.75, 0.48, 0.38], tarde * 0.35);
        let amb_g = mix3(b.amb_g.map(|x| x * k), [0.05, 0.05, 0.07], noche * 0.8);
        // el color de la niebla: el del horizonte del cielo, salvo en los mapas que traen la suya
        let nc = match niebla { TipoNiebla::Exp => mix3(b.nie.c, mid, 1.0 - dia * 0.7), TipoNiebla::Lineal => mix3(b.nie.c, mid, 1.0 - dia * (1.0 - tarde)), TipoNiebla::Cielo => mid };
        let mut nie = b.nie; nie.c = nc;
        // (el cielo para el motor: el degradé de ahora, cuánto se ve la caja y su tinte, como lo manda gmod_personal.js)
        let cielo = Cielo { top, mid, bot, dia: (lum(top) / lum(bc.top).max(1e-3)).clamp(0.0, 1.0), tinte: [0, 1, 2].map(|i| (mid[i] / bc.mid[i].max(1e-3)).clamp(0.0, 1.5)), caras: None, ..bc.clone() };
        Aplicado { base: LuzBase { sol: sd, sol_col: sc, amb_s, amb_g, nie, cielo }, noche, expo_k: 1.0 + noche * 1.3 + tarde * 0.15, luna }
    }
}

#[cfg(test)]
mod prueba {
    use super::*;
    use jxmotor::escena::Niebla;
    fn base() -> LuzBase { LuzBase { sol: [0.3, 0.8, 0.2], sol_col: [1.0, 0.96, 0.9], amb_s: [0.5; 3], amb_g: [0.4; 3], nie: Niebla { c: [0.9; 3], a: 10.0, b: 100.0, m: 1.0, s: [0.0; 3] },
        cielo: Cielo { top: [0.28, 0.64, 1.0], mid: [0.92; 3], bot: [0.53, 0.58, 0.68], exp: [0.8, 1.0], tinte: [1.0; 3], dia: 1.0, k: 1.0, cubo: 0, caras: None } } }
    #[test]
    fn mediodia_y_medianoche() {
        let mut d = Dia::default(); let b = base(); let a = d.aplicar(&b, TipoNiebla::Cielo, false);
        assert!(a.noche == 0.0 && a.expo_k == 1.0); assert!((a.base.sol[1] - 0.8f32.clamp(0.2, 0.98)).abs() < 0.02);
        assert_eq!(a.base.cielo.dia, 1.0); assert_eq!(a.base.amb_s, b.amb_s);
        d.hora = 0.0; let n = d.aplicar(&b, TipoNiebla::Cielo, false);
        assert_eq!(n.noche, 1.0); assert!((n.expo_k - 2.3).abs() < 1e-5); assert!(n.base.cielo.dia < 0.1); assert!(n.base.sol_col[2] > n.base.sol_col[0]);
    }
}
