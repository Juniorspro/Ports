//! El contenido base de GMod desde Steam en el nativo (como juego/gmod_steam.js de la web): HL2, sus episodios y CS:S, archivo
//! por archivo. Lo que no está en la biblioteca de GMod de la app (unos 6000 archivos) se busca en el depósito 4021 del
//! servidor dedicado de GMod (app 4020: gratis y anónimo, como lo baja cualquier server): trae sourceengine/ (las texturas,
//! modelos y sonidos de HL2 y CS:S) y los .vpk de GMod. La tienda da la clave y el código del manifiesto (/api/gmod/base);
//! acá se baja el manifiesto y los índices de los .vpk (una vez: quedan guardados) y, de cada archivo que pide un mapa o un
//! addon, sólo los pedazos de 1 MB del .vpk donde está (descifrados y descomprimidos como los addons: steampipe.rs). Lo bajado
//! queda en la carpeta de datos (gbs/f/), un archivo por ruta: la próxima vez no se baja nada, y se lee sin abrir nada de esto.
use crate::steampipe::{self, Aes, Archivo, Http};
use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

/// los .vpk que se miran, por prioridad (lo de GMod primero, como en el juego)
pub const VPKS: [&str; 8] = ["garrysmod/garrysmod", "garrysmod/fallbacks", "sourceengine/hl2_misc", "sourceengine/hl2_textures", "sourceengine/content_hl2", "sourceengine/content_cstrike", "sourceengine/hl2_sound_misc", "sourceengine/hl2_sound_vo_english"];
/// los pedazos ya bajados que se guardan en memoria (bytes)
const TOPE_MEM: usize = 48 << 20;
/// lo que puede ocupar lo bajado en el aparato: pasado esto, al abrir se borra lo más viejo hasta quedar en `QUEDA_DISCO`
const TOPE_DISCO: u64 = 1_500_000_000;
const QUEDA_DISCO: u64 = 1_000_000_000;

/// dónde está un archivo adentro de los .vpk: cuál, en qué paquete (0x7fff: al final del índice), desde dónde, cuánto, y lo que
/// viene adelantado en el índice (desde dónde y cuánto)
#[derive(Clone, Copy, Debug)]
struct Ent { v: u8, arch: u16, off: u32, len: u32, poff: u32, pre: u16 }

/// el nombre del archivo guardado de una ruta (FNV-1a de 64 bits)
fn hash(r: &str) -> u64 { r.bytes().fold(0xcbf2_9ce4_8422_2325u64, |h, c| (h ^ c as u64).wrapping_mul(0x100_0000_01b3)) }
fn ruta_cache(dir: &Path, r: &str) -> PathBuf { dir.join("f").join(format!("{:016x}", hash(r))) }
/// un archivo ya bajado (sin red, sin abrir el depósito)
pub fn leer_cache(dir: &Path, r: &str) -> Option<Vec<u8>> { std::fs::read(ruta_cache(dir, r)).ok() }
/// ¿ya está bajado?
pub fn en_cache(dir: &Path, r: &str) -> bool { ruta_cache(dir, r).is_file() }

/// cómo va una bajada: archivos hechos, cuántos, bytes bajados y si se pidió parar
#[derive(Default)]
pub struct Progreso { pub hechos: AtomicUsize, pub total: AtomicUsize, pub bytes: AtomicU64, pub fallas: AtomicUsize, pub cancelar: AtomicBool }

type Pedido = Box<dyn Fn(&str) -> Result<Vec<u8>, String> + Send + Sync>;
/// un pedazo en memoria: se baja una vez aunque lo pidan varios hilos a la vez
type Celda = Arc<OnceLock<Option<Arc<Vec<u8>>>>>;
struct Mem { m: HashMap<String, Celda>, orden: VecDeque<(String, usize)>, bytes: usize }

/// el depósito abierto: su clave, cómo pedirle al CDN, sus archivos y el índice de los .vpk
pub struct Base {
    dir: PathBuf, aes: Aes, dep: String, pedir: Pedido,
    archivos: HashMap<String, Archivo>,
    idx: HashMap<String, Ent>,
    /// los índices (_dir.vpk) de cada .vpk y dónde empiezan sus datos de adentro
    dirs: Vec<Option<(Vec<u8>, usize)>>,
    mem: Mutex<Mem>,
}

impl Base {
    /// abre el depósito (con red: la clave de la tienda; el manifiesto y los índices, la primera vez). `dir`: la carpeta gbs/
    pub fn abrir(http: Http, tienda: &str, dir: &Path, directo: bool) -> Result<Base, String> {
        let (c, b) = http(&format!("{tienda}gmod/base"))?;
        if c != 200 { return Err(format!("la tienda contestó {c}")); }
        let info: serde_json::Value = serde_json::from_slice(&b).map_err(|e| format!("la tienda: {e}"))?;
        let txt = |k: &str| info[k].as_str().map(String::from).or_else(|| info[k].as_u64().map(|x| x.to_string())).unwrap_or_default();
        let clave: [u8; 32] = crate::firma::de_hex(&txt("clave")).and_then(|v| v.try_into().ok()).ok_or("la tienda no dio la clave")?;
        let (dep, man, cod) = (txt("dep"), txt("man"), txt("codigo"));
        if dep.is_empty() || man.is_empty() { return Err("la tienda no dio el depósito".into()); }
        let hosts: Vec<String> = info["cdn"].as_array().map(|a| a.iter().filter_map(|h| h.as_str().map(String::from)).collect()).filter(|v: &Vec<String>| !v.is_empty()).unwrap_or_else(|| vec!["cache1-lax1.steamcontent.com".into()]);
        let bueno = Arc::new(AtomicUsize::new(0));
        // (cada pedido: directo a Steam probando servidores; al final, por la tienda)
        let pedir: Pedido = { let (tienda, bueno) = (tienda.to_string(), bueno.clone()); Box::new(move |ruta: &str| -> Result<Vec<u8>, String> {
            let n = hosts.len(); let b0 = bueno.load(Ordering::Relaxed); let mut ult = String::new();
            let intentos = if directo { 4.min(n.max(1)) + 1 } else { 3 };
            for k in 0..intentos {
                let h = &hosts[(b0 + k) % n];
                let url = if directo && k + 1 < intentos { format!("https://{h}{ruta}") } else { format!("{tienda}gmod/cdn/{h}{ruta}") };
                match http(&url) { Ok((200, b)) => { bueno.store((b0 + k) % n, Ordering::Relaxed); return Ok(b); } Ok((c, _)) => ult = format!("CDN {c}"), Err(e) => ult = e }
            }
            Err(ult)
        }) };
        let _ = std::fs::create_dir_all(dir.join("f"));
        limpiar(dir, &man);
        // el manifiesto (guardado con su número: si Valve lo cambia, se baja el nuevo)
        let fm = dir.join(format!("man_{man}.bin"));
        let z = match std::fs::read(&fm) { Ok(z) if !z.is_empty() => z, _ => {
            let r = format!("/depot/{dep}/manifest/{man}/5{}", if !cod.is_empty() && cod != "0" { format!("/{cod}") } else { String::new() });
            let z = pedir(&r)?; guardar(&fm, &z); z } };
        let aes = Aes::nuevo(&clave);
        let archivos: HashMap<String, Archivo> = steampipe::manifiesto(&z, &aes)?.into_iter().map(|a| (a.nombre.to_lowercase(), a)).collect();
        let mut base = Base { dir: dir.to_path_buf(), aes, dep, pedir, archivos, idx: HashMap::new(), dirs: vec![None; VPKS.len()], mem: Mutex::new(Mem { m: HashMap::new(), orden: VecDeque::new(), bytes: 0 }) };
        // los índices de los .vpk (unos MB, una vez)
        for (v, pre) in VPKS.iter().enumerate() {
            let Some(f) = base.archivos.get(&format!("{pre}_dir.vpk")).cloned() else { continue };
            let fc = dir.join(format!("vpk_{man}_{v}.bin"));
            let b = match std::fs::read(&fc) { Ok(b) if b.len() as u64 == f.tam => b, _ => { let b = base.leer(&f, 0, f.tam)?; guardar(&fc, &b); b } };
            base.indexar(b, v)?;
        }
        if base.idx.is_empty() { return Err("el depósito no trae índices".into()); }
        Ok(base)
    }
    /// el índice de un .vpk (versión 1 o 2): extensión → carpeta → nombre → dónde está
    fn indexar(&mut self, b: Vec<u8>, v: usize) -> Result<(), String> {
        let u32a = |i: usize| -> Option<u32> { Some(u32::from_le_bytes(b.get(i..i + 4)?.try_into().ok()?)) };
        let u16a = |i: usize| -> Option<u16> { Some(u16::from_le_bytes(b.get(i..i + 2)?.try_into().ok()?)) };
        if u32a(0) != Some(0x55aa_1234) { return Err("no es un vpk".into()); }
        let ver = u32a(4).unwrap_or(0); let arbol = u32a(8).unwrap_or(0) as usize; let cab = if ver == 2 { 28 } else { 12 }; let datos = cab + arbol;
        let mut i = cab;
        let cad = |i: &mut usize| -> Option<String> { let a = *i; let f = b.get(a..)?.iter().position(|c| *c == 0)? + a; *i = f + 1; Some(b[a..f].iter().map(|&c| c as char).collect()) };
        'ext: loop {
            let Some(ext) = cad(&mut i) else { break }; if ext.is_empty() { break; }
            loop {
                let Some(car) = cad(&mut i) else { break 'ext }; if car.is_empty() { break; }
                loop {
                    let Some(nom) = cad(&mut i) else { break 'ext }; if nom.is_empty() { break; }
                    let (Some(pre), Some(arch), Some(off), Some(len)) = (u16a(i + 4), u16a(i + 6), u32a(i + 8), u32a(i + 12)) else { break 'ext };
                    i += 18; let poff = i; i += pre as usize;
                    let ruta = format!("{}{}{}", if car == " " { String::new() } else { format!("{car}/") }, nom, if ext == " " { String::new() } else { format!(".{ext}") }).to_lowercase();
                    self.idx.entry(ruta).or_insert(Ent { v: v as u8, arch, off, len, poff: poff as u32, pre });
                }
            }
        }
        self.dirs[v] = Some((b, datos));
        Ok(())
    }
    /// ¿el depósito tiene esa ruta?
    pub fn tiene(&self, r: &str) -> bool { self.idx.contains_key(r) }
    /// cuántos archivos hay en los índices
    pub fn cuantos(&self) -> usize { self.idx.len() }
    /// un pedazo del depósito (1 MB), bajado una vez y guardado en memoria mientras entra en el tope
    fn pedazo(&self, p: &steampipe::Pedazo) -> Result<Arc<Vec<u8>>, String> {
        let celda = { let mut m = self.mem.lock().unwrap(); m.m.entry(p.sha.clone()).or_default().clone() };
        let r = celda.get_or_init(|| {
            let mut ult = None;
            for _ in 0..3 { match (self.pedir)(&format!("/depot/{}/chunk/{}", self.dep, p.sha)).and_then(|enc| steampipe::pedazo(&enc, &self.aes, p)) { Ok(d) => { ult = Some(Arc::new(d)); break; } Err(_) => {} } }
            if let Some(d) = &ult { let mut m = self.mem.lock().unwrap(); m.bytes += d.len(); m.orden.push_back((p.sha.clone(), d.len()));
                while m.bytes > TOPE_MEM && m.orden.len() > 4 { let Some((s, n)) = m.orden.pop_front() else { break }; m.m.remove(&s); m.bytes -= n; } }
            ult
        }).clone();
        match r { Some(d) => Ok(d), None => { self.mem.lock().unwrap().m.remove(&p.sha); Err("no se pudo bajar un pedazo".into()) } }
    }
    /// los bytes [a, b) de un archivo del depósito: sólo los pedazos que los tocan
    fn leer(&self, f: &Archivo, a: u64, b: u64) -> Result<Vec<u8>, String> {
        let mut out = vec![0u8; (b - a) as usize];
        for c in f.pedazos.iter().filter(|c| c.off < b && c.off + c.tam as u64 > a) {
            let d = self.pedazo(c)?; let (x0, x1) = (a.max(c.off), b.min(c.off + c.tam as u64));
            out[(x0 - a) as usize..(x1 - a) as usize].copy_from_slice(&d[(x0 - c.off) as usize..(x1 - c.off) as usize]);
        }
        Ok(out)
    }
    /// un archivo de los .vpk: lo adelantado en el índice + lo del paquete (o del final del índice)
    pub fn archivo(&self, r: &str) -> Result<Vec<u8>, String> {
        let e = *self.idx.get(r).ok_or("no está")?; let (d, datos) = self.dirs[e.v as usize].as_ref().ok_or("sin índice")?;
        let mut out = d.get(e.poff as usize..e.poff as usize + e.pre as usize).ok_or("índice cortado")?.to_vec();
        if e.len > 0 {
            if e.arch == 0x7fff { out.extend_from_slice(d.get(datos + e.off as usize..datos + e.off as usize + e.len as usize).ok_or("índice cortado")?); }
            else {
                let f = self.archivos.get(&format!("{}_{:03}.vpk", VPKS[e.v as usize], e.arch)).ok_or("falta el paquete")?;
                out.extend_from_slice(&self.leer(f, e.off as u64, e.off as u64 + e.len as u64)?);
            }
        }
        Ok(out)
    }
    /// baja y guarda las rutas que tiene el depósito y todavía no están guardadas, de a varios hilos (en orden de paquete:
    /// los archivos vecinos comparten pedazos). Devuelve cuántas bajó
    pub fn traer(&self, rutas: &[String], hilos: usize, prog: &Progreso) -> usize {
        let mut l: Vec<(&String, Ent)> = rutas.iter().filter(|r| !en_cache(&self.dir, r)).filter_map(|r| self.idx.get(r.as_str()).map(|e| (r, *e))).collect();
        l.sort_by_key(|(_, e)| (e.v, e.arch, e.off)); l.dedup_by(|a, b| a.0 == b.0);
        prog.total.fetch_add(l.len(), Ordering::Relaxed);
        let sig = AtomicUsize::new(0); let hechos = AtomicUsize::new(0);
        std::thread::scope(|s| {
            for _ in 0..hilos.clamp(1, 8).min(l.len().max(1)) {
                s.spawn(|| loop {
                    if prog.cancelar.load(Ordering::Relaxed) { return; }
                    let i = sig.fetch_add(1, Ordering::Relaxed); let Some((r, _)) = l.get(i) else { return };
                    match self.archivo(r) {
                        Ok(b) => { prog.bytes.fetch_add(b.len() as u64, Ordering::Relaxed); guardar(&ruta_cache(&self.dir, r), &b); hechos.fetch_add(1, Ordering::Relaxed); }
                        Err(_) => { prog.fallas.fetch_add(1, Ordering::Relaxed); }
                    }
                    prog.hechos.fetch_add(1, Ordering::Relaxed);
                });
            }
        });
        hechos.load(Ordering::Relaxed)
    }
}

/// escribe un archivo entero de una (primero a uno aparte y después se cambia el nombre: si se corta, no queda a medias)
fn guardar(p: &Path, b: &[u8]) {
    static N: AtomicU64 = AtomicU64::new(0);
    let t = p.with_extension(format!("t{}_{}", std::process::id(), N.fetch_add(1, Ordering::Relaxed)));
    if std::fs::write(&t, b).is_ok() { if std::fs::rename(&t, p).is_err() { let _ = std::fs::remove_file(&t); } }
}

/// borra los manifiestos e índices de otras versiones y, si lo bajado pasa el tope, lo más viejo
fn limpiar(dir: &Path, man: &str) {
    if let Ok(rd) = std::fs::read_dir(dir) { for e in rd.flatten() {
        let n = e.file_name().to_string_lossy().to_string();
        if (n.starts_with("man_") || n.starts_with("vpk_")) && !n.contains(man) { let _ = std::fs::remove_file(e.path()); }
    } }
    let Ok(rd) = std::fs::read_dir(dir.join("f")) else { return };
    let mut l: Vec<(std::time::SystemTime, u64, PathBuf)> = rd.flatten().filter_map(|e| { let m = e.metadata().ok()?; Some((m.modified().ok()?, m.len(), e.path())) }).collect();
    let mut tot: u64 = l.iter().map(|x| x.1).sum(); if tot <= TOPE_DISCO { return; }
    l.sort_by_key(|x| x.0);
    for (_, n, p) in l { if tot <= QUEDA_DISCO { break; } if std::fs::remove_file(&p).is_ok() { tot -= n; } }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn indice_vpk() {
        // (un .vpk v2 chico: un .vmt adelantado en el índice y un .vtf en el paquete 0)
        let mut arbol = vec![];
        let mut cad = |s: &str, v: &mut Vec<u8>| { v.extend_from_slice(s.as_bytes()); v.push(0); };
        cad("vmt", &mut arbol); cad("materials/nature", &mut arbol); cad("water_x", &mut arbol);
        arbol.extend_from_slice(&0u32.to_le_bytes()); arbol.extend_from_slice(&3u16.to_le_bytes()); arbol.extend_from_slice(&0x7fffu16.to_le_bytes()); arbol.extend_from_slice(&0u32.to_le_bytes()); arbol.extend_from_slice(&0u32.to_le_bytes()); arbol.extend_from_slice(&0xffffu16.to_le_bytes()); arbol.extend_from_slice(b"abc");
        arbol.push(0); arbol.push(0);
        cad("vtf", &mut arbol); cad(" ", &mut arbol); cad("suelto", &mut arbol);
        arbol.extend_from_slice(&0u32.to_le_bytes()); arbol.extend_from_slice(&0u16.to_le_bytes()); arbol.extend_from_slice(&0u16.to_le_bytes()); arbol.extend_from_slice(&128u32.to_le_bytes()); arbol.extend_from_slice(&64u32.to_le_bytes()); arbol.extend_from_slice(&0xffffu16.to_le_bytes());
        arbol.push(0); arbol.push(0); arbol.push(0);
        let mut b = vec![]; b.extend_from_slice(&0x55aa_1234u32.to_le_bytes()); b.extend_from_slice(&2u32.to_le_bytes()); b.extend_from_slice(&(arbol.len() as u32).to_le_bytes()); b.extend_from_slice(&[0u8; 16]); b.extend_from_slice(&arbol);
        let mut base = Base { dir: PathBuf::new(), aes: Aes::nuevo(&[0; 32]), dep: String::new(), pedir: Box::new(|_| Err(String::new())), archivos: HashMap::new(), idx: HashMap::new(), dirs: vec![None; VPKS.len()], mem: Mutex::new(Mem { m: HashMap::new(), orden: VecDeque::new(), bytes: 0 }) };
        base.indexar(b, 2).unwrap();
        assert!(base.tiene("materials/nature/water_x.vmt") && base.tiene("suelto.vtf"));
        assert_eq!(base.archivo("materials/nature/water_x.vmt").unwrap(), b"abc");
        let e = base.idx["suelto.vtf"]; assert_eq!((e.v, e.arch, e.off, e.len), (2, 0, 128, 64));
        assert_ne!(hash("materials/a.vtf"), hash("materials/b.vtf"));
    }
}
