//! La música del menú (musica.js de la web): la estación Casual, los 35 temas de Kevin MacLeod (CC BY 4.0) del paquete
//! aparte a_musica (Opus en WebM; herramientas/musica/casual.py), que se baja una sola vez (bajas.rs) y queda en el celular:
//! después suena sin internet. Las demás estaciones de la web son de YouTube: en la nativa no están. Suenan mezclados y en
//! bucle (un orden al azar que no repite hasta pasar por todos) sólo en el menú; al empezar una partida se apaga con un
//! fundido de 1 s y se suelta el tema (ni memoria jugando); al volver sigue donde iba. Cada tema se pasa a PCM con el
//! decodificador del sistema en un hilo aparte (Sonido::decodificar_trozo: mono y a 24 kHz, unos 8 MB) y suena como una
//! voz larga del mezclador. Se apaga en Opciones → Sonido → Música del menú.
use super::Juego;
use crate::sonido::{Pcm, Sonido};
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc};
use std::time::Instant;

/// el paquete publicado (si el del juego no lo dice en DATA.rbp)
const PAQUETE: &str = "a_musica.97422a044d.rbp";
const FUNDIDO_S: f32 = 1.0;
const VOL: f32 = 0.5;

#[derive(Default)]
pub struct Musica {
    /// los temas: (clave, dónde empieza en el archivo, cuánto ocupa)
    temas: Vec<(String, u64, u64)>, archivo: Option<PathBuf>,
    orden: Vec<usize>, i: usize, desde: f32,
    decod: Option<mpsc::Receiver<Option<Pcm>>>,
    voz: Option<u64>, ult: f32, gan: f32, t: Option<Instant>, mirar: Option<Instant>,
    /// lo que suena (para la placa del menú)
    pub sonando: Option<String>,
}

/// el nombre de un tema a partir de su clave («mu_airport_lounge» → «Airport Lounge»)
pub fn titulo(k: &str) -> String {
    k.trim_start_matches("mu_").split('_').filter(|w| !w.is_empty()).map(|w| { let mut c = w.chars(); c.next().map(|p| p.to_uppercase().collect::<String>() + c.as_str()).unwrap_or_default() }).collect::<Vec<_>>().join(" ")
}
/// el índice de un paquete RBP1: «RBP1», el largo del índice (u32), el índice en JSON ({a: {clave: [desde, largo]}}) y los
/// datos (desde cuenta a partir del final del índice)
pub fn leer_indice(ruta: &Path) -> Option<Vec<(String, u64, u64)>> {
    use std::io::Read;
    let mut f = std::fs::File::open(ruta).ok()?; let mut h = [0u8; 8]; f.read_exact(&mut h).ok()?;
    if &h[..4] != b"RBP1" { return None; }
    let n = u32::from_le_bytes([h[4], h[5], h[6], h[7]]) as usize; if n > 1 << 22 { return None; }
    let mut j = vec![0u8; n]; f.read_exact(&mut j).ok()?;
    let v: serde_json::Value = serde_json::from_slice(&j).ok()?; let base = 8 + n as u64;
    let mut t: Vec<(String, u64, u64)> = v["a"].as_object()?.iter().filter_map(|(k, x)| Some((k.clone(), base + x[0].as_u64()?, x[1].as_u64()?))).collect();
    t.sort(); Some(t)
}
/// un orden al azar de `n`
fn mezclar(n: usize, mut s: u64) -> Vec<usize> {
    let mut v: Vec<usize> = (0..n).collect();
    for i in (1..n).rev() { s = s.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407); v.swap(i, (s >> 33) as usize % (i + 1)); }
    v
}

impl Juego {
    fn musica_paquete(&self) -> String { self.paq.as_ref().and_then(|p| p.d["rbp"]["a_musica"][0].as_str().map(String::from)).unwrap_or_else(|| PAQUETE.into()) }
    /// cada cuadro: bajar el paquete, el tema que sigue, el fundido
    pub fn musica_paso(&mut self) {
        let ahora = Instant::now(); let dt = self.musica.t.map(|t| (ahora - t).as_secs_f32().min(0.2)).unwrap_or(0.0); self.musica.t = Some(ahora);
        let quiere = self.aj.musica && !self.med.musica_on && self.ini.abierto && !self.ini.desde_juego && !self.recargar && self.sonido.suena();
        // (con internet, la estación Frutiger Aero por YouTube; sin internet, la de música libre del paquete)
        let quiere = quiere && !self.med_frutiger(quiere, dt);
        let m = &mut self.musica;
        m.gan = if quiere { (m.gan + dt / FUNDIDO_S).min(1.0) } else { (m.gan - dt / FUNDIDO_S).max(0.0) };
        // (el paquete: si no está, se pide —se baja en otro hilo—; se mira cada 2 s)
        if quiere && m.temas.is_empty() && m.mirar.map_or(true, |t| t.elapsed().as_secs_f32() > 2.0) {
            m.mirar = Some(ahora);
            let nom = self.musica_paquete();
            if let Some(b) = self.bajas.as_ref() {
                match b.archivo(&nom) {
                    Some(p) => if let Some(t) = leer_indice(&p) { let m = &mut self.musica; m.orden = mezclar(t.len(), ahora.elapsed().as_nanos() as u64 ^ (t.len() as u64 * 7919) ^ std::process::id() as u64); m.temas = t; m.archivo = Some(p); },
                    None => b.pedir(&nom),
                }
            }
        }
        let m = &mut self.musica;
        // (el tema que sigue, en otro hilo)
        if quiere && m.voz.is_none() && m.decod.is_none() && !m.temas.is_empty() {
            if let Some(ar) = m.archivo.clone() {
                let (k, o, n) = m.temas[m.orden[m.i % m.orden.len()]].clone(); let _ = k;
                let (tx, rx) = mpsc::channel(); m.decod = Some(rx);
                let _ = std::thread::Builder::new().name("musica".into()).spawn(move || { let _ = tx.send(Sonido::decodificar_trozo(&ar, o, n)); });
            }
        }
        if let Some(rx) = &m.decod {
            match rx.try_recv() {
                Ok(Some(pcm)) => { m.decod = None; if quiere { let k = m.temas[m.orden[m.i % m.orden.len()]].0.clone(); m.voz = Some(self.sonido.voz_larga(Arc::new(pcm), m.desde, 0.0)); m.ult = m.desde; m.sonando = Some(titulo(&k)); } }
                Ok(None) => { m.decod = None; m.i += 1; m.desde = 0.0; }
                Err(mpsc::TryRecvError::Disconnected) => { m.decod = None; m.i += 1; m.desde = 0.0; }
                Err(mpsc::TryRecvError::Empty) => {}
            }
        }
        let m = &mut self.musica;
        if let Some(id) = m.voz {
            self.sonido.voz_vol(id, VOL * m.gan * self.aj.volumen());
            match self.sonido.voz_pos(id) {
                // (terminó: dio la vuelta o ya no está) → el que sigue
                Some(p) if p + 0.5 >= m.ult => { m.ult = p; if !quiere && m.gan <= 0.0 { m.desde = p; self.sonido.voz_quitar(id); m.voz = None; m.sonando = None; } }
                _ => { self.sonido.voz_quitar(id); m.voz = None; m.i += 1; m.desde = 0.0; m.sonando = None; }
            }
        }
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn indice_y_orden() {
        assert_eq!(titulo("mu_airport_lounge"), "Airport Lounge");
        let mut v = mezclar(35, 12345); v.sort(); assert_eq!(v, (0..35).collect::<Vec<_>>());
        let f = std::env::temp_dir().join("jxm_rbp_prueba.rbp"); let j = br#"{"a":{"mu_b":[5,3],"mu_a":[0,5]}}"#;
        let mut d = b"RBP1".to_vec(); d.extend((j.len() as u32).to_le_bytes()); d.extend(j); d.extend([0u8; 8]); std::fs::write(&f, d).unwrap();
        let t = leer_indice(&f).unwrap(); let base = 8 + j.len() as u64;
        assert_eq!(t, vec![("mu_a".to_string(), base, 5), ("mu_b".to_string(), base + 5, 3)]);
        // (el publicado, si está en el repo)
        let p = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../../web/rb").join(PAQUETE);
        if p.is_file() { assert_eq!(leer_indice(&p).map(|t| t.len()), Some(35)); }
    }
}
