//! gfxauto.js en la nativa: con Automático, la primera vez que hay mapa en la sesión se mide detrás de la pantalla de
//! carga qué calidad sostiene los cuadros de la pantalla (juego/gfxauto.rs, la búsqueda igual a la de la web), se deja
//! ésa y se anota para la próxima vez (con la placa y la pantalla: si cambian, se empieza de nuevo desde la puesta).
//! Sólo en la app (gfx_medir): las pruebas dibujan en la CPU y no tienen que cambiar de calidad solas, como TEST en la web.
use super::*;
use jxjuego::gfxauto::{self, Accion};
use std::sync::OnceLock;

/// la hora de cada cuadro (s), desde un origen fijo
fn segundos() -> f64 { static T0: OnceLock<Instant> = OnceLock::new(); T0.get_or_init(Instant::now).elapsed().as_secs_f64() }

impl Juego {
    /// gfxClave: el motor, la placa y la pantalla
    fn gfx_clave(&self, placa_txt: &str, w: i32, h: i32) -> String {
        format!("{} {}|{}x{}", self.placa.nombre(), placa_txt.chars().take(60).collect::<String>(), w.max(h), w.min(h))
    }
    /// cada cuadro, antes de dibujar: empieza la búsqueda o le pasa la hora del cuadro; pone la calidad que toca medir y,
    /// al final, la elegida
    pub(super) fn gfx_auto(&mut self, placa_txt: &str, w: i32, h: i32) {
        if !self.gfx_medir || self.mapa.is_none() || self.recargar { return; }
        if !self.gfxa.midiendo() && (self.gfxa.medido || !self.aj.auto) { return; }
        let ahora = segundos();
        let acc = if self.gfxa.midiendo() { self.gfxa.cuadro(ahora) } else {
            let clave = self.gfx_clave(placa_txt, w, h);
            let inicio = match &self.aj.medido { Some((q, g)) if *g == clave => *q, _ => if self.aj.calidad < ajustes::PERSONAL { self.aj.calidad } else { 2 } };
            Some(self.gfxa.empezar(inicio, gfxauto::umbral(self.refresco), ahora))
        };
        match acc {
            Some(Accion::Poner(q)) => self.aj.poner_calidad(q),
            Some(Accion::Listo { elegida, med }) => {
                self.aj.poner_calidad(elegida); self.aj.medido = Some((elegida, self.gfx_clave(placa_txt, w, h)));
                if let Some(d) = &self.datos { let _ = std::fs::write(d.join("ajustes.txt"), self.aj.texto()); }
                let f = med[elegida].flatten().unwrap_or(0.0);
                self.avisar(format!("Gráficos automáticos: {} · {:.0} fps", ajustes::CALIDADES[elegida], f));
            }
            None => {}
        }
    }
}
