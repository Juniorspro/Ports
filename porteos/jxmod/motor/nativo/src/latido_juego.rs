//! El latido de la app (POST panel/hola, como el juego de la web): cada 25 s, que está abierta, en qué mapa y server, y —para
//! el registro de celulares del panel del dueño— el celular, la placa, el motor, la calidad y cómo le anda: los fps promedio
//! desde el latido anterior y los del peor medio segundo (sólo jugando). Con eso se ve en vivo quién juega con qué celular y
//! cuáles andan mal, para optimizar donde hace falta. Un número de aparato al azar (aparato.txt) y el nombre de la sala;
//! nada más.
use super::*;

/// la versión de la app (la del APK)
pub const VERSION: &str = "0.53";

#[derive(Default)]
pub struct Latido { t: f32, cuadros: u32, tiempo: f32, peor: f32, aparato: String }

impl Juego {
    /// cada cuadro: contar los cuadros jugando y, cada 25 s, mandar el latido (en otro hilo)
    pub(super) fn latido_paso(&mut self, dt: f32) {
        let jugando = self.mapa.is_some() && !self.recargar && !self.ini.abierto;
        let l = &mut self.latido;
        if jugando && dt > 0.0 && dt < 1.0 { l.cuadros += 1; l.tiempo += dt; if self.fps > 0.0 && (l.peor == 0.0 || self.fps < l.peor) { l.peor = self.fps; } }
        l.t -= dt; if l.t > 0.0 { return; } l.t = 25.0;
        let Some(h) = self.soc.http.clone() else { return };
        if self.latido.aparato.is_empty() {
            let leido = self.datos.as_ref().and_then(|d| std::fs::read_to_string(d.join("aparato.txt")).ok()).map(|s| s.trim().to_string()).filter(|s| s.len() == 16 && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit()));
            self.latido.aparato = leido.unwrap_or_else(|| {
                let mut x = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(7) ^ 0x9e3779b97f4a7c15;
                let s: String = (0..16).map(|_| { x ^= x << 13; x ^= x >> 7; x ^= x << 17; b"abcdefghijklmnopqrstuvwxyz0123456789"[(x % 36) as usize] as char }).collect();
                if let Some(d) = &self.datos { let _ = std::fs::write(d.join("aparato.txt"), &s); } s });
        }
        let pr = |k: &str| crate::comun::personajes::propiedad(k);
        let cel = [pr("ro.product.manufacturer"), pr("ro.product.model")].into_iter().filter(|s| !s.is_empty()).collect::<Vec<_>>().join(" ");
        let mut b = serde_json::json!({ "d": self.latido.aparato, "n": self.en_red.red.nombre.trim(), "v": format!("nativo {VERSION}"), "pl": format!("nativo android {}", pr("ro.build.version.release")),
            "m": if self.mapa.is_some() { self.mapas.get(self.mapa_i).cloned().unwrap_or_default() } else { "menú".into() }, "s": self.en_red.red.sala.as_ref().map(|s| s.n.clone()).unwrap_or_default() });
        let (ca, gpu, mo) = (self.calidad_txt(), self.placa_nombre.clone(), self.en_uso.nombre());
        let l = &mut self.latido;
        if l.tiempo > 5.0 {
            let fps = l.cuadros as f32 / l.tiempo; let r1 = |x: f32| (x as f64 * 10.0).round() / 10.0;
            b["cel"] = (if cel.is_empty() { "?".to_string() } else { cel }).into(); b["gpu"] = gpu.into(); b["mo"] = mo.into();
            b["ca"] = ca.into(); b["res"] = format!("{:.0}%", self.drs * 100.0).into();
            b["fps"] = r1(fps).into(); b["fmin"] = r1(if l.peor > 0.0 { l.peor.min(fps) } else { fps }).into(); b["ms"] = r1(self.ms).into(); b["pms"] = r1(self.placa_ms).into();
        }
        let l = &mut self.latido; l.cuadros = 0; l.tiempo = 0.0; l.peor = 0.0;
        let (url, cuerpo) = (format!("{}panel/hola", super::gmod_juego::TIENDA_URL), b.to_string());
        std::thread::spawn(move || { let _ = h("POST", &url, &[("Content-Type".into(), "application/json".into())], Some(&cuerpo)); });
    }
}
