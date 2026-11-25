//! El contenido base de GMod y HL2 que dan por hecho los addons (gmod_lib.js: rb/gm_lib.*: un índice y los archivos en
//! trozos —los brazos c_arms, las armas c_/w_ de HL2 y CS:S, props, materiales, sonidos—) y los datos de la versión
//! personal (gmod_personal.js: rb/jxp/: los spawnlists de GMod, su Lua —base_npcs.lua, base_vehicles.lua, game_hl2.lua—
//! que se monta primero como el addon «Garry's Mod», sus nombres y los spawnicons). En el celular están adentro de la APK
//! (sin comprimir: se leen por rangos); en la compu, en una carpeta.
use super::*;
use std::cell::RefCell;
use std::io::Read;

/// lee un archivo de rb/ (su nombre, desde dónde y cuántos bytes; usize::MAX: hasta el final)
pub type LectorRb = Arc<dyn Fn(&str, u64, usize) -> Option<Vec<u8>> + Send + Sync>;
/// el índice de la biblioteca (lo escribe herramientas/gmod_base.py; el mismo nombre que GM_LIB de gmod_lib.js)
pub const GM_LIB: &str = "gm_lib.b481aeb12b.idx";

/// rb/ en carpetas de la compu (la primera que tenga el archivo)
pub fn lector_carpetas(dirs: Vec<PathBuf>) -> LectorRb {
    Arc::new(move |n: &str, o: u64, len: usize| {
        use std::io::{Seek, SeekFrom};
        let p = dirs.iter().map(|d| d.join(n)).find(|p| p.is_file())?; let mut f = std::fs::File::open(p).ok()?;
        f.seek(SeekFrom::Start(o)).ok()?; let mut v = vec![];
        if len == usize::MAX { f.read_to_end(&mut v).ok()?; } else { v.resize(len, 0); f.read_exact(&mut v).ok()?; }
        Some(v)
    })
}
/// rb/ adentro de la APK (activos sin comprimir: un rango se lee directo del archivo, sin leer el trozo entero)
#[cfg(target_os = "android")]
pub fn lector_android(app: &android_activity::AndroidApp) -> LectorRb {
    let app = app.clone();
    Arc::new(move |n: &str, o: u64, len: usize| {
        use std::os::unix::fs::FileExt;
        let c = std::ffi::CString::new(format!("rb/{n}")).ok()?; let mut a = app.asset_manager().open(&c)?;
        if len == usize::MAX { let mut v = vec![]; a.read_to_end(&mut v).ok()?; return Some(v); }
        let d = a.open_file_descriptor().ok()?; let f = std::fs::File::from(d.fd);
        let mut v = vec![0u8; len]; f.read_exact_at(&mut v, d.offset as u64 + o).ok()?; Some(v)
    })
}

/// los archivos de la biblioteca: el índice y sus trozos (los trozos los dice el índice: hace falta tenerlo)
pub fn archivos_lib(lector: &LectorRb) -> Vec<String> {
    let mut v = vec![GM_LIB.to_string()];
    if let Some(crudo) = lector(GM_LIB, 0, usize::MAX) { if let Ok(j) = serde_json::from_slice::<serde_json::Value>(&desgz(&crudo).unwrap_or(crudo)) { v.extend(j["t"].as_array().into_iter().flatten().filter_map(|x| x.as_str().map(String::from))); } }
    v
}
fn desgz(b: &[u8]) -> Option<Vec<u8>> { let mut o = vec![]; flate2::read::GzDecoder::new(b).read_to_end(&mut o).ok()?; Some(o) }

/// la biblioteca: ruta → (trozo, desde, cuántos, comprimido con gzip); lo que se leyó queda guardado
pub struct Biblioteca { lector: LectorRb, trozos: Vec<String>, f: HashMap<String, (usize, u64, usize, bool)>, datos: RefCell<HashMap<String, Option<Rc<[u8]>>>> }
impl Biblioteca {
    pub fn abrir(lector: LectorRb) -> Option<Biblioteca> {
        let crudo = lector(GM_LIB, 0, usize::MAX)?; let j: serde_json::Value = serde_json::from_slice(&desgz(&crudo).unwrap_or(crudo)).ok()?;
        let trozos = j["t"].as_array()?.iter().filter_map(|x| x.as_str().map(String::from)).collect();
        let mut f = HashMap::new();
        for (k, v) in j["f"].as_object()? { let n = |i: usize| v[i].as_u64().unwrap_or(0); f.insert(k.clone(), (n(0) as usize, n(1), n(2) as usize, n(3) != 0)); }
        Some(Biblioteca { lector, trozos, f, datos: RefCell::new(HashMap::new()) })
    }
    pub fn tiene(&self, r: &str) -> bool { self.f.contains_key(r) }
    pub fn leer(&self, r: &str) -> Option<Rc<[u8]>> {
        if let Some(x) = self.datos.borrow().get(r) { return x.clone(); }
        let res = self.f.get(r).and_then(|&(t, o, n, gz)| { let b = (self.lector)(self.trozos.get(t)?, o, n)?; let b = if gz { desgz(&b)? } else { b }; Some(Rc::from(b.into_boxed_slice())) });
        self.datos.borrow_mut().insert(r.to_string(), res.clone()); res
    }
}

/// los datos de la versión personal (rb/jxp/menu.json): los spawnlists (nombre, padre, ícono, modelos y si tienen spawnicon)
pub struct ListaJxp { pub id: i64, pub padre: i64, pub n: String, pub ic: String, pub m: Vec<(String, bool)> }
pub struct MenuJxp { pub listas: Vec<ListaJxp>, pub ent: std::collections::HashSet<String>, pub lua: Vec<String>, pub loc: Vec<String>, /** las frases de GMod en inglés (los .properties de loc: «clave=texto») */ pub frases: HashMap<String, String> }
pub fn menu_jxp(lector: &LectorRb) -> Option<MenuJxp> {
    let j: serde_json::Value = serde_json::from_slice(&lector("jxp/menu.json", 0, usize::MAX)?).ok()?;
    let s = |v: &serde_json::Value| v.as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect::<Vec<_>>()).unwrap_or_default();
    let listas = j["listas"].as_array()?.iter().map(|l| {
        let ic: Vec<bool> = l["i"].as_array().map(|a| a.iter().map(|x| x.as_bool().unwrap_or(x.as_i64().unwrap_or(0) != 0)).collect()).unwrap_or_default();
        ListaJxp { id: l["id"].as_i64().unwrap_or(0), padre: l["padre"].as_i64().unwrap_or(0), n: l["n"].as_str().unwrap_or("").into(), ic: l["ic"].as_str().unwrap_or("icon16/page.png").into(), m: s(&l["m"]).into_iter().enumerate().map(|(i, m)| (m.to_lowercase(), ic.get(i).copied().unwrap_or(false))).collect() }
    }).collect();
    let loc = s(&j["loc"]); let mut frases = HashMap::new();
    for f in &loc { if let Some(b) = lector(&format!("jxp/loc/{f}"), 0, usize::MAX) { for l in String::from_utf8_lossy(&b).lines() { if let Some((k, v)) = l.split_once('=') { frases.insert(k.trim().to_lowercase(), v.trim().to_string()); } } } }
    Some(MenuJxp { listas, ent: s(&j["ent"]).into_iter().map(|x| x.to_lowercase()).collect(), lua: s(&j["lua"]), loc, frases })
}
/// el addon base «Garry's Mod» (su Lua y sus nombres), como lo monta jxpIniciar
pub fn addon_base(lector: &LectorRb, m: &MenuJxp) -> Option<Addon> {
    let mut a: Vec<(String, Vec<u8>)> = vec![];
    for f in &m.lua { a.push((format!("lua/autorun/{f}"), lector(&format!("jxp/lua/{f}"), 0, usize::MAX)?)); }
    for f in &m.loc { if let Some(b) = lector(&format!("jxp/loc/{f}"), 0, usize::MAX) { a.push((format!("resource/localization/en/{f}"), b)); } }
    Some(Addon::de_archivos("gmod", "Garry's Mod", a))
}
