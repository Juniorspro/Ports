//! El contenido de HL2 y CS:S que piden los mapas del Workshop (steambase.rs), como gbspTraer de la web: antes de armar el
//! mapa se miran sus materiales, las texturas y lo que incluyen esos materiales, los modelos de sus props con sus materiales, y
//! el cielo; lo que no está en el addon, en el .bsp ni en la biblioteca y sí en Steam se baja en un hilo aparte (de a varios
//! archivos), mientras la pantalla de carga dice cuánto va. Después se mira lo bajado (un material puede pedir otro, un modelo sus
//! materiales), hasta cinco vueltas. Sin red, o si Steam no contesta, el mapa se arma igual con lo que hay. Va como hijo de comun.rs.
use super::*;
use crate::steambase::{Base, Progreso};
use std::collections::HashSet;
use std::path::PathBuf;
use std::rc::Rc;
use std::sync::atomic::Ordering;
use std::sync::Arc;

/// la preparación de un mapa: lo que falta mirar, lo ya visto, lo que se está bajando y cómo va
struct Prep { mapa: String, vuelta: u32, frontera: Vec<String>, vistos: HashSet<String>, bajando: Vec<String>, hilo: Option<std::thread::JoinHandle<usize>>, prog: Arc<Progreso>, t0: Instant, bajados: usize }

#[derive(Default)]
pub struct EnBase {
    /// el depósito abierto, el hilo que lo está abriendo y el error (si no se pudo: no se vuelve a probar hasta reiniciar)
    base: Option<Arc<Base>>, abriendo: Option<std::thread::JoinHandle<Result<Base, String>>>, pub error: Option<String>,
    prep: Option<Prep>,
    /// lo que nombran los addons montados y falta (se baja en el fondo, sin pantalla de carga): la cola, su vuelta y el hilo
    cola: Vec<String>, cola_vuelta: u32, hilo_addons: Option<(std::thread::JoinHandle<usize>, Vec<String>)>, pub bajados_addons: usize,
    /// los mapas ya preparados (no se vuelven a mirar) y lo último que se hizo (para las pruebas)
    listos: HashSet<String>, pub info: String,
}

/// las texturas y lo que incluye un .vmt (las claves que nombran otro archivo)
fn refs_vmt(b: &[u8], out: &mut Vec<String>) {
    const TEX: [&str; 13] = ["$basetexture", "$basetexture2", "$bumpmap", "$bumpmap2", "$normalmap", "$detail", "$envmapmask", "$refracttinttexture", "$dudvmap", "$blendmodulatetexture", "$selfillummask", "$phongexponenttexture", "$basenormalmap"];
    // (las palabras: entre comillas o sueltas, sin los comentarios; las llaves aparte)
    let t: String = b.iter().map(|&c| c as char).collect::<String>().to_lowercase();
    let mut tk: Vec<String> = vec![]; let mut it = t.chars().peekable();
    while let Some(c) = it.next() {
        if c == '"' { let mut w = String::new(); for d in it.by_ref() { if d == '"' { break; } w.push(d); } tk.push(w); }
        else if c == '/' && it.peek() == Some(&'/') { for d in it.by_ref() { if d == '\n' { break; } } }
        else if c == '{' || c == '}' { tk.push(c.to_string()); }
        else if !c.is_whitespace() { let mut w = c.to_string(); while let Some(&d) = it.peek() { if d.is_whitespace() || d == '"' || d == '{' || d == '}' { break; } w.push(d); it.next(); } tk.push(w); }
    }
    for i in 0..tk.len().saturating_sub(1) {
        let (k, v) = (&tk[i], &tk[i + 1]); if v == "{" || v == "}" { continue; }
        let v = v.replace('\\', "/"); let v = v.trim_start_matches('/'); let v = v.strip_prefix("materials/").unwrap_or(v);
        if k == "include" { out.push(format!("materials/{}.vmt", v.trim_end_matches(".vmt"))); }
        else if TEX.contains(&k.as_str()) && !v.starts_with('_') && !v.is_empty() { out.push(format!("materials/{}.vtf", v.trim_end_matches(".vtf"))); }
    }
}
/// lo que pide un .mdl: sus otras partes, sus materiales (con cada carpeta) y los modelos que incluye
fn refs_mdl(r: &str, b: Rc<[u8]>, out: &mut Vec<String>) {
    let base = r.trim_end_matches(".mdl");
    for e in [".vvd", ".phy", ".dx90.vtx", ".vtx", ".dx80.vtx", ".sw.vtx"] { out.push(format!("{base}{e}")); }
    let Ok(m) = jxgmod::formatos::mdl(b, None, None) else { return };
    let cs: Vec<String> = if m.carpetas.is_empty() { vec![String::new()] } else { m.carpetas.iter().map(|c| { let c = c.to_lowercase().replace('\\', "/"); let c = c.trim_matches('/').to_string(); if c.is_empty() { c } else { format!("{c}/") } }).collect() };
    for t in &m.texturas { let t = t.to_lowercase().replace('\\', "/"); for c in &cs { out.push(format!("materials/{c}{}.vmt", t.trim_start_matches('/'))); } }
    for i in jxgmod::formatos::incluidos(&m) { out.push(i.to_lowercase().replace('\\', "/")); }
}

/// las rutas que nombra un addon y pueden ser del contenido base (como gmlRefs de la web): las cadenas de su Lua, las texturas
/// de sus .vmt y lo que piden sus .mdl
pub(crate) fn refs_addon(archivos: &std::collections::HashMap<String, Rc<[u8]>>) -> Vec<String> {
    let mut out = vec![];
    for (r, b) in archivos {
        if r.ends_with(".vmt") { refs_vmt(b, &mut out); }
        else if r.ends_with(".mdl") { refs_mdl(r, b.clone(), &mut out); }
        if r.ends_with(".lua") || r.ends_with(".txt") || r.ends_with(".vmt") {
            // (las cadenas entre comillas de 3 a 120 letras de ruta: cada una como está, como material, modelo o sonido)
            let mut i = 0; let n = b.len();
            while i < n {
                let q = b[i]; i += 1; if q != b'"' && q != b'\'' { continue; }
                let ini = i; while i < n && i - ini <= 120 && (b[i].is_ascii_alphanumeric() || b"_-./\\ ".contains(&b[i])) { i += 1; }
                if i < n && b[i] == q && i - ini >= 3 {
                    let t = String::from_utf8_lossy(&b[ini..i]).to_lowercase().replace('\\', "/"); let t = t.trim().trim_start_matches('/').to_string();
                    if t.ends_with(".mdl") { out.push(if t.starts_with("models/") { t } else { format!("models/{t}") }); }
                    else if t.ends_with(".wav") || t.ends_with(".mp3") { out.push(if t.starts_with("sound/") { t } else { format!("sound/{t}") }); }
                    else if !t.contains(' ') && t.contains('/') { let m = t.strip_prefix("materials/").unwrap_or(&t).trim_end_matches(".vmt").trim_end_matches(".vtf").to_string(); out.push(format!("materials/{m}.vmt")); out.push(format!("materials/{m}.vtf")); }
                    i += 1;
                }
            }
        }
    }
    out.sort(); out.dedup(); out
}

impl Juego {
    /// lo que nombra un addon recién montado, a la cola de lo que se busca en Steam (base_addons_paso)
    pub(crate) fn base_addon(&mut self, refs: Vec<String>) { if std::env::var_os("JXM_STEAM_DEBUG").is_some() { eprintln!("addon montado: {} rutas nombradas", refs.len()); } if self.gb.error.is_none() { self.gb.cola.extend(refs); } }
    /// cada cuadro: lo de los addons que falta y está en Steam se baja en el fondo (de a tandas; lo que piden los materiales y
    /// modelos bajados va a la cola otra vez, hasta 3 vueltas); al llegar, lo que se había dado por faltante se vuelve a buscar
    pub(crate) fn base_addons_paso(&mut self) {
        if self.gb.cola.is_empty() && self.gb.hilo_addons.is_none() { return; }
        if let Some((h, bajando)) = self.gb.hilo_addons.take() {
            if !h.is_finished() { self.gb.hilo_addons = Some((h, bajando)); return; }
            let n = h.join().unwrap_or(0); self.gb.bajados_addons += n;
            if n > 0 { self.gm_reintentar_faltantes(); }
            if self.gb.cola_vuelta < 3 { let mut o = vec![]; for r in bajando.iter().filter(|r| r.ends_with(".vmt") || r.ends_with(".mdl")) { if let Some(b) = self.gmod_archivo(r) { if r.ends_with(".vmt") { refs_vmt(&b, &mut o); } else { refs_mdl(r, b, &mut o); } } } self.gb.cola.extend(o); self.gb.cola_vuelta += 1; }
            return;
        }
        // (el depósito: abrirlo si hace falta; sin red ni carpeta de datos, la cola se tira)
        if self.gb.base.is_none() {
            // (sin red todavía —la app la pone al arrancar—: la cola espera, con tope)
            let (Some(http), Some(dir)) = (self.gmod_http_bin(), self.gbs_dir()) else { if self.gb.cola.len() > 30000 { self.gb.cola.drain(..10000); } return };
            if self.gb.error.is_some() { self.gb.cola.clear(); return; }
            match self.gb.abriendo.take() {
                None => { self.gb.abriendo = Some(std::thread::spawn(move || Base::abrir(http, gmod_juego::TIENDA_URL, &dir, true))); return; }
                Some(t) if !t.is_finished() => { self.gb.abriendo = Some(t); return; }
                Some(t) => match t.join().unwrap_or_else(|_| Err("el hilo se cayó".into())) { Ok(b) => self.gb.base = Some(Arc::new(b)), Err(e) => { self.gb.error = Some(e); self.gb.cola.clear(); return; } },
            }
        }
        let Some(base) = self.gb.base.clone() else { return };
        let mut l = std::mem::take(&mut self.gb.cola); l.sort(); l.dedup();
        let n_l = l.len(); let bajar: Vec<String> = l.into_iter().filter(|r| base.tiene(r) && !self.gmod_existe(r)).collect();
        if std::env::var_os("JXM_STEAM_DEBUG").is_some() { eprintln!("addons → Steam: {} nombrados, {} para bajar {:?}", n_l, bajar.len(), bajar.iter().take(6).collect::<Vec<_>>()); }
        if bajar.is_empty() { self.gb.cola_vuelta = 0; return; }
        let b2 = bajar.clone();
        self.gb.hilo_addons = Some((std::thread::spawn(move || base.traer(&b2, 4, &Progreso::default())), bajar));
    }
    /// la carpeta de lo bajado de Steam
    fn gbs_dir(&self) -> Option<PathBuf> { self.datos.as_ref().map(|d| d.join("gbs")) }
    /// lo que el mapa que se va a cargar todavía espera de Steam: (hechos, total, falló) en archivos; None si ya puede armarse
    pub(crate) fn base_falta_carga(&mut self) -> Option<(u64, u64, bool)> {
        let nombre = self.mapas.get(self.mapa_i).cloned()?;
        if !nombre.starts_with("WS_") || self.gb.listos.contains(&nombre) { return None; }
        let (Some(http), Some(dir)) = (self.gmod_http_bin(), self.gbs_dir()) else { self.gb.listos.insert(nombre); return None };
        // el depósito: se abre una vez (con red: la clave, el manifiesto y los índices la primera vez)
        if self.gb.base.is_none() {
            if self.gb.error.is_some() { self.gb.listos.insert(nombre); return None; }
            match self.gb.abriendo.take() {
                None => { let h = http.clone(); self.gb.abriendo = Some(std::thread::spawn(move || Base::abrir(h, gmod_juego::TIENDA_URL, &dir, true))); return Some((0, 0, false)); }
                Some(t) if !t.is_finished() => { self.gb.abriendo = Some(t); return Some((0, 0, false)); }
                Some(t) => match t.join().unwrap_or_else(|_| Err("el hilo se cayó".into())) {
                    Ok(b) => { self.gb.base = Some(Arc::new(b)); }
                    Err(e) => { self.gb.info = format!("sin el contenido de Steam: {e}"); self.gb.error = Some(e); self.gb.listos.insert(nombre); return None; }
                },
            }
        }
        let base = self.gb.base.clone()?;
        // la preparación de este mapa: sus materiales, los modelos de sus props y el cielo (el .bsp, del addon)
        if self.gb.prep.as_ref().map(|p| p.mapa != nombre).unwrap_or(true) {
            if let Some(p) = self.gb.prep.take() { p.prog.cancelar.store(true, Ordering::Relaxed); if let Some(h) = p.hilo { let _ = h.join(); } }
            let Some(w) = self.mj.ws.iter().find(|w| w.clave == nombre).cloned() else { self.gb.listos.insert(nombre); return None };
            self.gmod_asegurar(); self.gmod_montar_ya(&w.addon);
            let Some(b) = self.gmod_archivo(&w.ruta) else { self.gb.listos.insert(nombre); return None };
            let lz = |d: &[u8]| gmod_juego::lzma(d);
            let Ok(bs) = jxjuego::bsp::Bsp::abrir(&b, &lz) else { self.gb.listos.insert(nombre); return None };
            let ents = jxjuego::bsp::entidades(bs.lump(0));
            // (el zip del mapa ya a mano: sus materiales también piden cosas)
            let pak = jxjuego::bsp::pak(bs.lump(40));
            self.gmod_sumar_archivos(pak.into_iter().map(|(k, v)| (k, Rc::from(v.into_boxed_slice()))).collect());
            let mut fr: Vec<String> = jxjuego::bsp::texturas(&bs).0.iter().map(|n| format!("materials/{}.vmt", n.to_lowercase().replace('\\', "/"))).collect();
            for p in jxjuego::bsp::props(&bs, &ents, &lz) { fr.push(p.modelo.to_lowercase().replace('\\', "/")); }
            for e in &ents { if let Some(m) = e.get("model") { let m = m.to_lowercase().replace('\\', "/"); if m.ends_with(".mdl") { fr.push(m); } } }
            let cielo = ents.iter().find(|e| e.cl() == "worldspawn").and_then(|w| w.get("skyname")).unwrap_or("sky_day01_01").to_lowercase();
            for s in ["up", "dn", "lf", "rt", "ft", "bk"] { fr.push(format!("materials/skybox/{cielo}{s}.vmt")); fr.push(format!("materials/skybox/{cielo}{s}.vtf")); }
            fr.sort(); fr.dedup();
            self.gb.prep = Some(Prep { mapa: nombre.clone(), vuelta: 0, frontera: fr, vistos: HashSet::new(), bajando: vec![], hilo: None, prog: Arc::new(Progreso::default()), t0: Instant::now(), bajados: 0 });
        }
        let mut p = self.gb.prep.take()?;
        // lo que se estaba bajando: si terminó, se mira (un material pide sus texturas; un modelo, sus materiales)
        if let Some(h) = p.hilo.take() {
            if !h.is_finished() { p.hilo = Some(h); let r = (p.prog.hechos.load(Ordering::Relaxed) as u64, p.prog.total.load(Ordering::Relaxed) as u64, false); self.gb.prep = Some(p); return Some(r); }
            p.bajados += h.join().unwrap_or(0);
            p.frontera.extend(std::mem::take(&mut p.bajando).into_iter().filter(|r| r.ends_with(".vmt") || r.ends_with(".mdl")).map(|r| format!("\u{1}{r}")));
        }
        // la frontera: lo que ya está se mira acá mismo; lo que está en Steam, a la lista para bajar
        let mut bajar = vec![];
        while let Some(r) = p.frontera.pop() {
            // (\u{1}: recién bajado, ya visto: sólo mirar qué pide)
            let (r, ya) = match r.strip_prefix('\u{1}') { Some(x) => (x.to_string(), true), None => (r, false) };
            if !ya && !p.vistos.insert(r.clone()) { continue; }
            let hoja = !(r.ends_with(".vmt") || r.ends_with(".mdl"));
            if hoja { if !self.gmod_existe(&r) && base.tiene(&r) { bajar.push(r); } continue; }
            match self.gmod_archivo(&r) {
                Some(b) => { let mut o = vec![]; if r.ends_with(".vmt") { refs_vmt(&b, &mut o); } else { refs_mdl(&r, b, &mut o); } p.frontera.extend(o.into_iter().filter(|x| !p.vistos.contains(x))); }
                None => if base.tiene(&r) { bajar.push(r); },
            }
        }
        if bajar.is_empty() || p.vuelta >= 5 {
            self.gb.info = format!("{}: {} archivos de Steam bajados en {:.1} s ({} vueltas, {} mirados, {} fallas)", p.mapa, p.bajados, p.t0.elapsed().as_secs_f32(), p.vuelta, p.vistos.len(), p.prog.fallas.load(Ordering::Relaxed));
            self.gb.listos.insert(p.mapa); return None;
        }
        p.vuelta += 1; p.bajando = bajar.clone();
        let (b2, pr) = (base.clone(), p.prog.clone());
        p.hilo = Some(std::thread::spawn(move || b2.traer(&bajar, 6, &pr)));
        let r = (p.prog.hechos.load(Ordering::Relaxed) as u64, p.prog.total.load(Ordering::Relaxed).max(1) as u64, false);
        self.gb.prep = Some(p); Some(r)
    }
    /// ¿está ese archivo en los addons, el mapa, la biblioteca o lo bajado? (sin leerlo)
    fn gmod_existe(&self, r: &str) -> bool { self.gmod.gm.as_ref().map(|g| g.existe(r)).unwrap_or(false) }
    /// ¿la pantalla de carga está esperando el contenido de Steam? (para el texto)
    pub(crate) fn base_bajando(&self) -> bool { self.gb.prep.is_some() || self.gb.abriendo.is_some() }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn referencias_de_un_vmt() {
        let v = br#""LightmappedGeneric"
{
    "$basetexture" "Concrete\concretefloor001a"
    "$bumpmap" "concrete/concretefloor001a_normal.vtf"   // el relieve
    "$envmap" "env_cubemap"
    ">=dx90" { "$detail" "detail/noise_detail_01" }
    "$dudvmap" "_rt_WaterRefraction"
}"#;
        let mut o = vec![]; refs_vmt(v, &mut o);
        assert_eq!(o, vec!["materials/concrete/concretefloor001a.vtf", "materials/concrete/concretefloor001a_normal.vtf", "materials/detail/noise_detail_01.vtf"]);
        let mut o = vec![]; refs_vmt(b"\"patch\" { \"include\" \"materials/nature/water_canals_water2.vmt\" }", &mut o);
        assert_eq!(o, vec!["materials/nature/water_canals_water2.vmt"]);
    }
}
