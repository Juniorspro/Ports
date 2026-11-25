//! Los paquetes aparte (datos.js: rbBajar y rbAsegurar) en la nativa: la APK trae lo de siempre (el paquete, los dos
//! mapas de base, el Hero y el menú de GMod de la personal) y lo demás —los otros mapas, las skins, los memes, la
//! biblioteca de GMod (86 MB)— se baja la primera vez que hace falta de `web/rb/` de la rama (lo mismo que la web) y queda
//! en la memoria de la app. Cada archivo lleva su contenido en el nombre (nombre.<10 de sha1>.rbp): lo bajado se revisa
//! con eso y nunca queda viejo. Las bajadas van en un hilo aparte; el juego pregunta cómo van (la pantalla de carga).
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// cómo se baja un archivo: (dirección, adónde, cómo va: (bajado, total)) → el código HTTP
pub type Bajar = Arc<dyn Fn(&str, &Path, &dyn Fn(u64, u64)) -> Result<u16, String> + Send + Sync>;
/// de dónde (como RBP.bases de datos.js, sin la carpeta de al lado: la app no tiene servidor)
pub const BASES: [&str; 2] = ["https://raw.githack.com/Juniorspro/Ports/claude/ports-continuation-dm754a/web/rb/",
    "https://raw.githubusercontent.com/Juniorspro/Ports/claude/ports-continuation-dm754a/web/rb/"];
/// después de una falla, cuánto esperar antes de probar de nuevo (como RBP.falla: 10 s)
const REINTENTO: Duration = Duration::from_secs(10);

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Estado { Bajando { va: u64, tot: u64 }, Listo, Falla }

#[derive(Clone)]
pub struct Bajas { dir: PathBuf, bajar: Option<Bajar>, est: Arc<Mutex<HashMap<String, (Estado, Instant)>>>, en_apk: Option<Arc<dyn Fn(&str) -> bool + Send + Sync>> }

/// la huella que dice el nombre (los 10 de sha1 entre puntos) cuando es la del contenido: la de los paquetes aparte
/// (remotos.py: nombre.<sha1 del archivo>.rbp). La biblioteca de GMod (gm_lib.<huella>.idx / .0.bin…) lleva la de la
/// biblioteca entera, no la de cada trozo: esos se revisan sólo con el tamaño de la bajada.
fn huella(nom: &str) -> Option<&str> { if !nom.ends_with(".rbp") { return None; } nom.split('.').find(|p| p.len() == 10 && p.bytes().all(|c| c.is_ascii_hexdigit())) }
fn hex(b: &[u8]) -> String { b.iter().map(|x| format!("{x:02x}")).collect() }
/// un nombre de paquete aparte (sin carpetas ni nada raro: viene del índice del juego)
fn nombre_valido(nom: &str) -> bool { !nom.is_empty() && nom.len() < 120 && !nom.contains("..") && nom.bytes().all(|c| c.is_ascii_alphanumeric() || b"._-".contains(&c)) }

impl Bajas {
    pub fn nueva(dir: PathBuf, bajar: Option<Bajar>) -> Bajas { let _ = std::fs::create_dir_all(&dir); Bajas { dir, bajar, est: Arc::new(Mutex::new(HashMap::new())), en_apk: None } }
    /// cómo saber si un paquete viene adentro de la APK (entonces no se baja)
    pub fn con_apk(mut self, f: Arc<dyn Fn(&str) -> bool + Send + Sync>) -> Bajas { self.en_apk = Some(f); self }
    /// está para usar: en la APK o ya bajado
    pub fn disponible(&self, nom: &str) -> bool { self.en_apk.as_ref().map(|f| f(nom)).unwrap_or(false) || self.archivo(nom).is_some() }
    /// el archivo ya bajado, si está
    pub fn archivo(&self, nom: &str) -> Option<PathBuf> { if !nombre_valido(nom) { return None; } let p = self.dir.join(nom); p.is_file().then_some(p) }
    pub fn leer(&self, nom: &str) -> Option<Vec<u8>> { std::fs::read(self.archivo(nom)?).ok() }
    /// cómo va (None: nunca se pidió ni está bajado)
    pub fn estado(&self, nom: &str) -> Option<Estado> {
        if self.disponible(nom) { return Some(Estado::Listo); }
        self.est.lock().ok().and_then(|e| e.get(nom).map(|x| x.0))
    }
    /// pedirlo (si no está, no se está bajando y no falló hace poco): se baja en otro hilo
    pub fn pedir(&self, nom: &str) {
        if !nombre_valido(nom) || self.disponible(nom) { return; }
        let Some(bajar) = self.bajar.clone() else { return };
        {   let Ok(mut e) = self.est.lock() else { return };
            match e.get(nom) { Some((Estado::Bajando { .. }, _)) => return, Some((Estado::Falla, t)) if t.elapsed() < REINTENTO => return, _ => {} }
            e.insert(nom.to_string(), (Estado::Bajando { va: 0, tot: 0 }, Instant::now())); }
        let (nom, dir, est) = (nom.to_string(), self.dir.clone(), self.est.clone());
        std::thread::spawn(move || {
            let tmp = dir.join(format!("{nom}.bajando")); let fin = dir.join(&nom);
            let mut ok = false;
            for b in BASES {
                let prog = |va: u64, tot: u64| { if let Ok(mut e) = est.lock() { e.insert(nom.clone(), (Estado::Bajando { va, tot }, Instant::now())); } };
                match bajar(&format!("{b}{nom}"), &tmp, &prog) {
                    Ok(200) => {
                        // (se revisa con la huella del nombre: lo que llegó cortado o cambiado no se guarda)
                        let bien = match huella(&nom) { Some(h) => std::fs::read(&tmp).map(|d| hex(&crate::comun::memes_juego::sha1(&d))[..10] == *h).unwrap_or(false), None => true };
                        if bien && std::fs::rename(&tmp, &fin).is_ok() { ok = true; break; }
                    }
                    _ => {}
                }
                let _ = std::fs::remove_file(&tmp);
            }
            if let Ok(mut e) = est.lock() { if ok { e.remove(&nom); } else { e.insert(nom, (Estado::Falla, Instant::now())); } }
        });
    }
    /// varios a la vez (los de un mapa): pide los que faltan y dice cómo van todos juntos: (bajado, total, alguno falló);
    /// None si ya están todos
    pub fn asegurar(&self, noms: &[String]) -> Option<(u64, u64, bool)> {
        let (mut va, mut tot, mut falla, mut falta) = (0u64, 0u64, false, false);
        for n in noms {
            match self.estado(n) {
                Some(Estado::Listo) => {}
                Some(Estado::Bajando { va: a, tot: t }) => { falta = true; va += a; tot += t.max(a); }
                Some(Estado::Falla) => { falta = true; falla = true; self.pedir(n); }
                None => { falta = true; self.pedir(n); }
            }
        }
        falta.then_some((va, tot, falla))
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn huellas_y_nombres() {
        assert_eq!(huella("m_RB_Pizzeria.9a699b26ac.rbp"), Some("9a699b26ac"));
        assert_eq!(huella("gm_lib.b481aeb12b.0.bin"), None, "la de la biblioteca no es la de cada trozo");
        assert_eq!(huella("jxp"), None);
        assert!(nombre_valido("gm_lib.b481aeb12b.0.bin") && !nombre_valido("../x") && !nombre_valido("a/b") && !nombre_valido(""));
    }
    #[test]
    fn baja_revisa_y_guarda() {
        let dir = std::env::temp_dir().join(format!("jxm_bajas_{}", std::process::id())); let _ = std::fs::remove_dir_all(&dir);
        let datos = b"un mapa de prueba".to_vec(); let h = hex(&crate::comun::memes_juego::sha1(&datos))[..10].to_string();
        let bueno = format!("m_Prueba.{h}.rbp"); let malo = "m_Malo.0123456789.rbp".to_string();
        // (el «servidor»: la primera dirección falla, la segunda da los datos; el malo llega con otra cosa)
        let d2 = datos.clone(); let pedidos = Arc::new(Mutex::new(vec![]));
        let p2 = pedidos.clone();
        let bajar: Bajar = Arc::new(move |u: &str, a: &Path, prog: &dyn Fn(u64, u64)| {
            p2.lock().unwrap().push(u.to_string());
            if u.starts_with(BASES[0]) { return Ok(404); }
            prog(5, d2.len() as u64); std::thread::sleep(Duration::from_millis(50));
            std::fs::write(a, if u.contains("Malo") { b"otra cosa".to_vec() } else { d2.clone() }).map_err(|e| e.to_string())?; prog(d2.len() as u64, d2.len() as u64); Ok(200)
        });
        let b = Bajas::nueva(dir.clone(), Some(bajar));
        assert_eq!(b.estado(&bueno), None);
        let l = vec![bueno.clone(), malo.clone()];
        let (va, _, falla) = b.asegurar(&l).unwrap(); assert!(!falla && va == 0);
        let t0 = Instant::now();
        while b.estado(&bueno) != Some(Estado::Listo) || b.estado(&malo) != Some(Estado::Falla) { assert!(t0.elapsed() < Duration::from_secs(5), "no terminó: {:?} {:?}", b.estado(&bueno), b.estado(&malo)); std::thread::sleep(Duration::from_millis(20)); }
        assert_eq!(b.leer(&bueno).unwrap(), datos);
        assert!(b.archivo(&malo).is_none() && !dir.join(format!("{malo}.bajando")).exists(), "lo que no coincide con la huella no queda");
        assert!(b.asegurar(&[bueno.clone()]).is_none(), "ya está");
        let n = pedidos.lock().unwrap().len(); b.pedir(&malo); assert_eq!(pedidos.lock().unwrap().len(), n, "después de una falla espera antes de reintentar");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
