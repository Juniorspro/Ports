//! La comparación de FPS entre los motores (banco.js de la web; Opciones → Motor → Comparar los motores): el mismo mapa en
//! el mismo lugar, con la calidad elegida (Alto si está en Automático) y sin la resolución dinámica —se mide el motor, no
//! cuánto baja la resolución—, la cámara dando una vuelta entera. Cada motor (Vulkan, OpenGL 3, OpenGL 2) se abre en la
//! misma ventana (app.rs, como al elegirlo), se deja asentar `PREVIO` segundos y se cuentan los cuadros de `MEDIR`
//! segundos. Al final vuelve al motor y a los ajustes de antes y muestra la tabla, con el más rápido para usarlo con un toque.
use super::{Juego, Placa};
use crate::ajustes::Ajustes;
use jxjuego::idiomas::tr;
use jxjuego::texto::Letras;
use std::time::Instant;

pub const PREVIO: f32 = 3.0;
pub const MEDIR: f32 = 12.0;
/// si el motor no abre en este tiempo, se anota que no abrió y se sigue
const ESPERA_MAX: f32 = 8.0;

/// lo que dio cada motor: (cuadros por segundo, ms por cuadro), o None si no abrió
pub type Resultado = Vec<(Placa, Option<(f32, f32)>)>;
pub struct Banco { motores: Vec<Placa>, i: usize, t: f32, cuadros: u32, ms: f32, res: Resultado, antes: (Placa, Ajustes), yaw0: f32, t_ant: Instant }
#[derive(Default)]
pub struct EnBanco { pub b: Option<Banco>, pub fin: Option<Resultado> }

/// el más rápido de la tabla
pub fn mejor(r: &Resultado) -> Option<Placa> { r.iter().filter_map(|(p, x)| x.map(|x| (*p, x.0))).max_by(|a, b| a.1.total_cmp(&b.1)).map(|x| x.0) }
/// la caja de la tabla y sus dos botones (Usar el más rápido, Cerrar), en píxeles de la pantalla
fn cajas(wf: f32, hf: f32, filas: usize) -> ([f32; 4], [f32; 4], [f32; 4]) {
    let t = hf * 0.045; let w = (wf * 0.5).max(t * 16.0).min(wf * 0.92); let h = t * (4.2 + 1.5 * filas as f32);
    let c = [(wf - w) / 2.0, (hf - h) / 2.0, w, h]; let bh = t * 1.6; let by = c[1] + h - bh - t * 0.6;
    (c, [c[0] + t * 0.8, by, w * 0.55, bh], [c[0] + w - t * 0.8 - w * 0.3, by, w * 0.3, bh])
}

impl Juego {
    /// empieza la comparación (hay que estar en un mapa)
    pub fn banco_empezar(&mut self) {
        if self.mapa.is_none() { self.avisar("Entrá a un mapa para comparar los motores".into()); return; }
        let motores: Vec<Placa> = Placa::lista().iter().copied().filter(|p| p.hecha()).collect();
        if motores.is_empty() { return; }
        // (se cierran los menús: se mide el juego)
        self.ini.panel = None; self.ini.desde_juego = false; self.ini.abierto = false; self.ajustes = None;
        let antes = (self.placa, self.aj.clone());
        // (sin JX Turbo: se compara lo que dibuja cada motor de verdad; Ajustes vuelve como estaba al terminar)
        self.aj.dinamica = false; self.aj.turbo = false; self.drs = 1.0; if self.aj.auto { self.aj.poner_calidad(3); self.aj.auto = false; }
        crate::caja_negra::paso("comparar los motores");
        self.banco.fin = None;
        self.banco.b = Some(Banco { motores, i: 0, t: 0.0, cuadros: 0, ms: 0.0, res: vec![], antes, yaw0: self.jug.yaw, t_ant: Instant::now() });
        self.banco_ir();
    }
    /// pasa al motor que toca (o termina)
    fn banco_ir(&mut self) {
        let Some(b) = self.banco.b.as_mut() else { return };
        b.t = 0.0; b.cuadros = 0; b.ms = 0.0; b.t_ant = Instant::now();
        if b.i >= b.motores.len() {
            let b = self.banco.b.take().unwrap();
            let (p, aj) = b.antes; self.aj = aj; self.placa = p; self.jug.yaw = b.yaw0;
            let usar = if p.hecha() { p } else { Placa::Gl3 }; if usar != self.en_uso { self.cambiar_motor = true; }
            self.banco.fin = Some(b.res);
            return;
        }
        let m = b.motores[b.i]; self.placa = m; if m != self.en_uso { self.cambiar_motor = true; }
    }
    /// cada cuadro, mientras se compara: el tiempo, los cuadros y la vuelta de la cámara
    pub fn banco_paso(&mut self) {
        let en_uso = self.en_uso;
        let Some(b) = self.banco.b.as_mut() else { return };
        let ahora = Instant::now(); let dt = (ahora - b.t_ant).as_secs_f32(); b.t_ant = ahora;
        let m = b.motores[b.i];
        if en_uso != m { b.t += dt; if b.t > ESPERA_MAX { b.res.push((m, None)); b.i += 1; self.banco_ir(); } return; }
        b.t += dt; let tm = b.t - PREVIO;
        if tm > 0.0 { b.cuadros += 1; b.ms += dt * 1000.0; }
        self.jug.yaw = b.yaw0 + tm.max(0.0) / MEDIR * std::f32::consts::TAU;
        if tm >= MEDIR { let r = (b.cuadros as f32 / tm, b.ms / b.cuadros.max(1) as f32); b.res.push((m, Some(r))); b.i += 1; self.banco_ir(); }
    }
    pub fn banco_activo(&self) -> bool { self.banco.b.is_some() || self.banco.fin.is_some() }
    /// un toque: mientras mide no se toca nada; con la tabla, Usar el más rápido o Cerrar
    pub fn banco_toque(&mut self, x: f32, y: f32, w: f32, h: f32) -> bool {
        if self.banco.b.is_some() { return true; }
        let Some(r) = self.banco.fin.clone() else { return false };
        let (_, usar, _) = cajas(w, h, r.len()); let dentro = |c: [f32; 4]| x >= c[0] && x <= c[0] + c[2] && y >= c[1] && y <= c[1] + c[3];
        if dentro(usar) { if let Some(k) = mejor(&r).and_then(|m| Placa::lista().iter().position(|p| *p == m)) { self.elegir_motor(k); } }
        self.banco.fin = None; self.sonido.tocar("Click", 0.5, 1.0, None);
        true
    }
    /// lo que se ve: mientras mide, arriba qué motor y cuánto falta; al final, la tabla
    pub fn banco_hud(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32) {
        let bl = [1.0, 1.0, 1.0, 1.0]; let t = hf * 0.045;
        if let Some(b) = &self.banco.b {
            let m = b.motores[b.i]; let fase = if b.t < PREVIO { tr("preparando").to_string() } else { format!("{} {:.0} s", tr("midiendo"), (PREVIO + MEDIR - b.t).max(0.0)) };
            let s = format!("{} · {} · {} ({}/{})", tr("Comparando los motores…"), m.nombre(), fase, b.i + 1, b.motores.len());
            let an = l.ancho(t * 0.6, &s); let y = hf * 0.06;
            l.caja(u, (wf - an) / 2.0 - t * 0.5, y, an + t, t * 1.1, t * 0.2, [0.0, 0.0, 0.0, 0.6]); l.texto(u, (wf - an) / 2.0, y + t * 0.2, t * 0.6, bl, &s);
            return;
        }
        let Some(r) = &self.banco.fin else { return };
        let (c, usar, cerrar) = cajas(wf, hf, r.len()); let best = mejor(r);
        l.caja(u, c[0], c[1], c[2], c[3], t * 0.3, [0.06, 0.08, 0.12, 0.94]);
        l.texto(u, c[0] + t * 0.8, c[1] + t * 0.6, t * 0.75, bl, "Comparación de motores");
        for (k, (p, x)) in r.iter().enumerate() {
            let y = c[1] + t * 1.9 + k as f32 * t * 1.5; let sel = Some(*p) == best;
            if sel { l.caja(u, c[0] + t * 0.5, y - t * 0.2, c[2] - t, t * 1.3, t * 0.2, [0.95, 0.66, 0.1, 0.25]); }
            l.texto(u, c[0] + t * 0.8, y, t * 0.65, bl, p.nombre());
            let v = match x { Some((fps, ms)) => format!("{fps:.0} fps · {ms:.1} ms"), None => tr("no abrió").to_string() };
            let an = l.ancho(t * 0.65, &v); l.texto(u, c[0] + c[2] - t * 0.8 - an, y, t * 0.65, if x.is_some() { bl } else { [1.0, 0.6, 0.5, 1.0] }, &v);
        }
        let boton = |u: &mut Vec<f32>, b: [f32; 4], s: &str, col: [f32; 4]| { l.caja(u, b[0], b[1], b[2], b[3], t * 0.25, col); let tt = t * 0.6; let an = l.ancho(tt, s); l.texto(u, b[0] + (b[2] - an) / 2.0, b[1] + (b[3] - tt) / 2.0 - tt * 0.1, tt, bl, s); };
        if let Some(m) = best { boton(u, usar, &format!("{} {}", tr("Usar"), m.nombre()), [0.16, 0.45, 0.85, 1.0]); }
        boton(u, cerrar, "Cerrar", [1.0, 1.0, 1.0, 0.14]);
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn el_mas_rapido() {
        let r: Resultado = vec![(Placa::Vulkan, Some((40.0, 25.0))), (Placa::Gl3, Some((52.0, 19.2))), (Placa::Gl2, None)];
        assert_eq!(mejor(&r), Some(Placa::Gl3)); assert_eq!(mejor(&vec![(Placa::Gl2, None)]), None);
        let (c, a, b) = cajas(1600.0, 720.0, 3); assert!(a[0] >= c[0] && b[0] + b[2] <= c[0] + c[2] + 0.1 && a[1] + a[3] <= c[1] + c[3]);
    }
}
