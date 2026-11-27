//! La caja negra (cajanegra.js de la web): qué estaba haciendo el juego antes de trabarse. Cada cuadro deja un latido y
//! los pasos riesgosos (abrir un motor, armar un mapa, montar un addon de GMod) se anotan antes de empezar; un hilo aparte
//! mira el latido y, si la app está a la vista y pasan `TRABADO_S` segundos sin cuadros, escribe `trabado.txt` con lo último
//! que se anotó. Si vuelve a andar, lo borra; si no (el sistema la cierra o la cierra uno), la próxima vez que abre lo
//! muestra (app.rs), como el «se cerró» de los errores.
use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

/// cuántos segundos sin cuadros con la app a la vista cuentan como trabado
pub const TRABADO_S: u64 = 10;
const MAX_PASOS: usize = 24;

static LATIDO: AtomicU64 = AtomicU64::new(0);
static A_LA_VISTA: AtomicBool = AtomicBool::new(false);
static PASOS: Mutex<VecDeque<(f32, String)>> = Mutex::new(VecDeque::new());
/// entrando a una partida: el archivo y lo que se anota arriba (el mapa, el motor, la calidad); hasta que la partida anda,
/// cada paso queda escrito ahí. Si el sistema cierra la app —poca memoria, la placa que se cae: lo que no deja un «se
/// cerró»—, la próxima vez que abre el archivo sigue ahí y se sabe dónde (app.rs: entra con gráficos más livianos)
static PARTIDA: Mutex<Option<(PathBuf, String)>> = Mutex::new(None);
fn reloj() -> &'static Instant { static T: OnceLock<Instant> = OnceLock::new(); T.get_or_init(Instant::now) }
fn ahora_ms() -> u64 { reloj().elapsed().as_millis() as u64 }

/// un cuadro dibujado
pub fn latido() { LATIDO.store(ahora_ms(), Ordering::Relaxed); }
/// la app a la vista (con ventana) o no: sin ventana no hay cuadros y no es que se trabó
pub fn a_la_vista(si: bool) { latido(); A_LA_VISTA.store(si, Ordering::Relaxed); }
/// anota lo que se va a hacer (queda lo último: los `MAX_PASOS` más nuevos)
pub fn paso(t: impl Into<String>) {
    let s = reloj().elapsed().as_secs_f32();
    if let Ok(mut p) = PASOS.lock() { if p.len() >= MAX_PASOS { p.pop_front(); } p.push_back((s, t.into())); }
    partida_escribir();
}
fn partida_escribir() {
    let Some((a, cab)) = PARTIDA.lock().ok().and_then(|p| p.clone()) else { return };
    let _ = std::fs::write(a, format!("{cab}\nLo último que hacía:\n{}", registro()));
}
/// empieza la entrada a una partida (`cab`: qué mapa, con qué motor y calidad)
pub fn partida_entrando(archivo: PathBuf, cab: String) { if let Ok(mut p) = PARTIDA.lock() { *p = Some((archivo, cab)); } partida_escribir(); }
/// la partida ya anda (o se volvió al menú): el archivo se borra
pub fn partida_lista() { if let Some((a, _)) = PARTIDA.lock().ok().and_then(|mut p| p.take()) { let _ = std::fs::remove_file(a); } }
/// ¿se está entrando a una partida?
pub fn partida_en_curso() -> bool { PARTIDA.lock().map(|p| p.is_some()).unwrap_or(false) }
/// el registro como texto (lo más nuevo abajo)
pub fn registro() -> String {
    let p = PASOS.lock().map(|p| p.clone()).unwrap_or_default();
    p.iter().map(|(s, t)| format!("{s:7.1} s  {t}")).collect::<Vec<_>>().join("\n")
}
/// el último paso anotado (para decir dónde se cerró)
pub fn ultimo() -> Option<String> { PASOS.lock().ok()?.back().map(|p| p.1.clone()) }
/// lo que dejó la vez anterior (y lo borra)
pub fn anterior(archivo: &std::path::Path) -> Option<String> { let t = std::fs::read_to_string(archivo).ok(); let _ = std::fs::remove_file(archivo); t.filter(|t| !t.trim().is_empty()) }
/// el texto que se escribe al trabarse
pub fn informe(sin_cuadros_s: u64) -> String { format!("se trabó (sin cuadros hace {sin_cuadros_s} s). Lo último que hacía:\n{}", registro()) }

/// el hilo que mira el latido (una vez por segundo)
pub fn vigilar(archivo: PathBuf) {
    latido();
    let _ = std::thread::Builder::new().name("caja_negra".into()).spawn(move || {
        let mut escrito = false;
        loop {
            std::thread::sleep(Duration::from_secs(1));
            let quieto = ahora_ms().saturating_sub(LATIDO.load(Ordering::Relaxed)) / 1000;
            if A_LA_VISTA.load(Ordering::Relaxed) && quieto >= TRABADO_S {
                if !escrito { let _ = std::fs::write(&archivo, informe(quieto)); escrito = true; }
            } else if escrito { let _ = std::fs::remove_file(&archivo); escrito = false; }
        }
    });
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn anota_y_recorta() {
        for i in 0..30 { paso(format!("paso {i}")); }
        let r = registro(); assert!(r.contains("paso 29") && !r.contains("paso 5\n") && r.lines().count() == MAX_PASOS);
        assert!(informe(12).starts_with("se trabó (sin cuadros hace 12 s)"));
        let f = std::env::temp_dir().join("jxm_caja_negra_prueba.txt"); std::fs::write(&f, "x").unwrap();
        assert_eq!(anterior(&f).as_deref(), Some("x")); assert!(anterior(&f).is_none());
        // (entrando a una partida: cada paso queda en el archivo; lista, se borra)
        let e = std::env::temp_dir().join("jxm_entrando_prueba.txt");
        partida_entrando(e.clone(), "mapa X".into()); paso("armar el mapa X");
        let t = std::fs::read_to_string(&e).unwrap(); assert!(t.starts_with("mapa X") && t.contains("armar el mapa X"), "{t}");
        partida_lista(); assert!(!e.exists() && !partida_en_curso());
    }
}
