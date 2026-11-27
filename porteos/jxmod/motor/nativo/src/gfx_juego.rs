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
            let inicio = match &self.aj.medido { Some((q, g)) if *g == clave => *q, _ => if self.aj.calidad < ajustes::PERSONAL { self.aj.calidad.min(4) } else { 2 } }.min(self.tope_mem);
            Some(self.gfxa.empezar(inicio, gfxauto::umbral(self.refresco), ahora))
        };
        match acc {
            Some(Accion::Poner(q)) => self.aj.poner_calidad(q.min(self.tope_mem)),
            Some(Accion::Listo { elegida, med }) => {
                let elegida = elegida.min(self.tope_mem);
                self.aj.poner_calidad(elegida); self.aj.medido = Some((elegida, self.gfx_clave(placa_txt, w, h)));
                if let Some(d) = &self.datos { let _ = std::fs::write(d.join("ajustes.txt"), self.aj.texto()); }
                let f = med.get(elegida).copied().flatten().flatten().unwrap_or(0.0);
                self.avisar(format!("Gráficos automáticos: {} · {:.0} fps", ajustes::CALIDADES[elegida], f));
            }
            None => {}
        }
    }
}

/// la memoria del celular (MB: MemTotal de /proc/meminfo; uno de «4 GB» dice unos 3700)
pub fn memoria_mb() -> Option<u64> {
    let t = std::fs::read_to_string("/proc/meminfo").ok()?;
    let kb: u64 = t.lines().find(|l| l.starts_with("MemTotal:"))?.split_whitespace().nth(1)?.parse().ok()?; Some(kb / 1024)
}
/// la calidad más alta que prueba Automático con esa memoria: 3 GB → Bajo, 4 GB → Medio, 6 GB → Alto, más → todas (en los de
/// poca memoria las calidades altas piden texturas y placas de dibujo que no entran: el sistema cierra la app al entrar)
pub fn tope_por_memoria(mb: Option<u64>) -> usize {
    match mb { Some(m) if m < 3200 => 1, Some(m) if m < 4400 => 2, Some(m) if m < 6400 => 3, _ => ajustes::CALIDADES.len() - 1 }
}

impl Juego {
    /// al abrir: el tope de la memoria y, con Automático sin medir en este celular, la calidad puesta no más alta que el tope
    /// (así la primera entrada no arma lo de Ultra antes de medir)
    pub fn tope_memoria(&mut self, mb: Option<u64>) {
        self.tope_mem = tope_por_memoria(mb);
        if self.aj.auto && self.aj.medido.is_none() && self.aj.calidad > self.tope_mem && self.aj.calidad != ajustes::PERSONAL { self.aj.poner_calidad(self.tope_mem); }
    }
    /// lo que dejó la vez anterior si se cerró entrando a una partida (y lo borra)
    pub fn entrando_anterior(&self) -> Option<String> { self.datos.as_ref().and_then(|d| crate::caja_negra::anterior(&d.join("entrando.txt"))) }
    /// se empieza a entrar a una partida: queda anotado (caja_negra) hasta que anda 12 s
    pub(super) fn entrando_partida(&mut self) {
        let Some(d) = self.datos.clone() else { return };
        let mapa = self.mapas.get(self.mapa_i).cloned().unwrap_or_default();
        let mods = self.gmod.addons.iter().filter(|a| a.prendido).count();
        let cab = format!("se cerró entrando a la partida (mapa {mapa}, {}, calidad {}, resolución {} %, {mods} mods prendidos)", self.placa.nombre(),
            ajustes::CALIDADES.get(self.aj.calidad).copied().unwrap_or("Personal"), self.aj.res_efectiva());
        crate::caja_negra::partida_entrando(d.join("entrando.txt"), cab);
    }
    /// la vez anterior se cerró entrando a una partida (lo que no deja «se cerró»: el sistema la cerró por memoria o se cayó
    /// la placa). La primera vez se baja a Bajo sin Automático; si vuelve a pasar, Patata con OpenGL 2. Si lo último que hacía
    /// era montar un addon, ése se apaga. Devuelve lo que se le dice al jugador.
    pub fn seguro_tras_cierre(&mut self, txt: &str) -> String {
        let Some(d) = self.datos.clone() else { return String::new() };
        let veces = std::fs::read_to_string(d.join("seguro.txt")).ok().and_then(|s| s.trim().parse::<u32>().ok()).unwrap_or(0) + 1;
        let _ = std::fs::write(d.join("seguro.txt"), veces.to_string());
        let mut hecho: Vec<String> = vec![];
        // (el addon que se estaba montando: apagado)
        let ult = txt.lines().rev().find(|l| l.trim().len() > 0).unwrap_or("");
        if let Some(n) = ult.split("montar el addon ").nth(1).map(|x| x.trim().to_string()) {
            if let Some(a) = self.gmod.addons.iter_mut().find(|a| a.nombre == n) { a.prendido = false; }
            let r = d.join("gmod_apagados.txt"); let mut v: Vec<String> = std::fs::read_to_string(&r).map(|s| s.lines().map(String::from).collect()).unwrap_or_default();
            if !v.contains(&n) { v.push(n.clone()); let _ = std::fs::write(&r, v.join("\n")); }
            hecho.push(format!("se apagó el mod {n}"));
        }
        let q = if veces <= 1 { 1 } else { 0 };
        if self.aj.calidad > q || self.aj.auto { self.aj.auto = false; self.aj.poner_calidad(q); hecho.push(format!("gráficos en {}", ajustes::CALIDADES[q])); }
        if veces >= 2 && self.placa != Placa::Gl2 { self.placa = Placa::Gl2; let _ = std::fs::write(d.join("motor.txt"), Placa::Gl2.clave()); hecho.push("motor OpenGL 2".into()); }
        let _ = std::fs::write(d.join("ajustes.txt"), self.aj.texto());
        crate::caja_negra::paso(format!("modo seguro (vez {veces}): {}", hecho.join(", ")));
        if hecho.is_empty() { "La vez anterior se cerró al entrar a la partida.".into() }
        else { format!("La vez anterior se cerró al entrar a la partida: {} para que entre. Se puede cambiar en Opciones.", hecho.join(", ")) }
    }
}

#[cfg(test)]
mod pruebas_memoria {
    use super::*;
    #[test]
    fn tope_segun_memoria() {
        assert_eq!(tope_por_memoria(Some(2800)), 1); assert_eq!(tope_por_memoria(Some(3700)), 2);
        assert_eq!(tope_por_memoria(Some(5600)), 3); assert_eq!(tope_por_memoria(Some(7600)), 5); assert_eq!(tope_por_memoria(None), 5);
    }
}
