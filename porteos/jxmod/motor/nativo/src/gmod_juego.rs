//! Los addons de Garry's Mod en el juego nativo (jxgmod, la capa GMod de la web en Rust): el puente con el juego
//! (jxgmod::Anfitrion: el jugador, la cámara, lo que se aprieta, las armas y los cuerpos, copiados antes de cada cuadro
//! del Lua y aplicados después; lo que el Lua pide —objetos, sonidos, efectos, daño— queda en una cola que se hace con
//! el motor a mano), la HUD de los addons (las órdenes 2D de surface/draw como vértices de la interfaz), las armas de
//! los addons («gm:<clase>»), de dónde salen los addons (la carpeta addons/ del teléfono y la tienda, como
//! gmod_carpeta.js y gmod_tienda.js) y el panel «Mods». Va como hijo de comun.rs para ver los campos del juego.
use super::*;
use jxgmod::mates::{Quat, V3};
use jxgmod::{Addon, Anfitrion, Cmd2D, Gmod, Golpe, InfoMaterial, ObjId, PersonaId};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::Arc;

/// las texturas de los materiales de los addons (TEX_GMOD - k)
const TEX_GMOD: i64 = -3000;
#[path = "gmod_modelos.rs"] pub(crate) mod gmod_modelos;
#[path = "gmod_base.rs"] mod gmod_base;
#[path = "gmod_menu.rs"] mod gmod_menu;
// (los modelos de jugador de GMod como personaje: gmod_pm.js)
#[path = "gmod_pm.rs"] pub mod gmod_pm;
// (los NPC y los vehículos de las listas de GMod: gmod_spawn.js)
#[path = "gmod_spawn.rs"] mod gmod_spawn;
// (los Pill Packs: pillpacks.js y pill_gmod.js)
#[path = "gmod_pill.rs"] pub mod gmod_pill;
pub use gmod_base::{lector_carpetas, LectorRb, GM_LIB};
/// los archivos de la biblioteca de GMod (para bajarlos antes de cargar un mapa del Workshop)
pub fn gmod_base_archivos_lib(l: &LectorRb) -> Vec<String> { gmod_base::archivos_lib(l) }
#[cfg(target_os = "android")] pub use gmod_base::lector_android;
/// la tienda de la web (inicio.js: TIENDA_URL)
pub const TIENDA_URL: &str = "https://rezobox-tienda.holasoyjuniors365.workers.dev/api/";
/// un pedido HTTP binario (los .gma): (código, cuerpo); en Android, red_android::Java::http_bin
pub type HttpBin = Arc<dyn Fn(&str) -> Result<(u16, Vec<u8>), String> + Send + Sync>;

/// lo que el Lua le pide al juego y se hace después de su cuadro (con el motor a mano)
enum Pedido {
    Crear(ObjId, String),
    Borrar(ObjId),
    Sonido(String, Option<[f32; 3]>, f32, f32),
    /// un bucle que se prende o se apaga (k: el parche o la entidad y el nombre; ini: desde dónde vuelve, en segundos)
    Bucle { k: String, r: String, e: Option<f64>, vol: f32, tono: f32, ini: f32, on: bool, fundido: Option<f64>, ca: i32 },
    /// un sonido nuevo en ese canal de esa entidad corta los bucles que tenía en el mismo canal
    Canal(Option<f64>, i32),
    DanarJugador(f32),
    DanarObjeto(ObjId, f32),
    Matar,
    /// los modos de juego: Player:Spawn() ya volvió al jugador en el espejo (el juego lo da por vivo), sin las armas
    Reaparecer, QuitarArmas,
    Explosion([f32; 3], f32, f32, bool),
    Impacto([f32; 3], [f32; 3], bool),
    ExplosionFx([f32; 3]),
    Traza([f32; 3], [f32; 3]),
    Fogonazo,
    Particula([f32; 3], [f32; 3], f32, f32, [f32; 4], efx::Tipo, f32),
    Sacudir(f32),
    Aviso(String),
    Arma(String),
    Textura(String),
    Anim(&'static str),
}

/// el puente: lo que el Lua ve del juego (los espejos) y la cola de pedidos. Lo tiene el Gmod; el juego llega con
/// `Gmod::anfitrion` + `como_any`
struct Puente {
    t: f64, dt: f64, t0: Instant, pantalla: (f64, f64), escala: f32,
    jug: jxgmod::Jugador, cam: jxgmod::Camara, ent: jxgmod::Entrada, armas: jxgmod::Armas,
    /// los huesos del personaje del jugador (con nombres de GMod) y el arma en la mano (para los enganches del Lua)
    huesos_jug: Vec<(String, V3, [V3; 3])>, arma_mundo: Option<(V3, Quat)>,
    /// los cuerpos de los objetos de los addons (el juego los copia de su física y aplica lo que el Lua cambió)
    cuerpos: BTreeMap<ObjId, jxgmod::Cuerpo>, sig: ObjId,
    pedidos: Vec<Pedido>, cmds: Vec<Cmd2D>,
    /// las armas de los addons registradas: ("gm:<clase>", arma del juego que presta la vista, nombre)
    gm_armas: Vec<(String, Option<String>, String)>,
    /// el mundo y las letras, prestados mientras corre el Lua (para las trazas y medir textos)
    mapa: Option<Mapa>, fis: Option<Fisica>, letras: Option<Letras>,
    /// el cuerpo de la física de cada objeto (y al revés)
    de_fis: HashMap<u32, ObjId>, a_fis: HashMap<ObjId, u32>,
    /// los archivos de los addons montados (sonidos y materiales)
    archivos: HashMap<String, Rc<[u8]>>,
    /// la carpeta de lo bajado del contenido base de Steam (steambase.rs: HL2 y CS:S), la tercera fuente después de la biblioteca
    steam: Option<PathBuf>,
    /// los materiales con imagen: ruta → (textura, ancho, alto, ya en el motor)
    mats: HashMap<String, (i64, u32, u32, bool)>,
    /// los prefabs del juego (minúsculas → nombre) y la caja que hace de modelo que no hay
    prefabs: HashMap<String, String>, caja: Option<String>,
    /// lo que guarda el Lua (file.Write en data/, PData, cookies): datos/gmod_datos.txt
    datos: BTreeMap<String, String>, datos_sucio: bool,
    nombre: String, mapa_nombre: String, spawns: Vec<(V3, Option<f64>)>,
    /// la caja de los modelos de los addons ya armados ("gm:…" → mínimo y tamaño, en el juego)
    cajas: HashMap<String, ([f64; 3], [f64; 3])>,
    /// el contenido base de GMod y HL2 (rb/gm_lib.*): lo que los addons dan por hecho
    lib: Option<Rc<gmod_base::Biblioteca>>,
}

/// un número al azar entre 0 y 1 (las variantes de los guiones de sonido)
fn azar01() -> f64 { thread_local! { static S: std::cell::Cell<u64> = const { std::cell::Cell::new(0x9e37_79b9_7f4a_7c15) }; } S.with(|s| { let mut x = s.get(); x ^= x << 13; x ^= x >> 7; x ^= x << 17; s.set(x); (x >> 11) as f64 / (1u64 << 53) as f64 }) }
fn v3(a: [f32; 3]) -> V3 { V3 { x: a[0] as f64, y: a[1] as f64, z: a[2] as f64 } }
fn f3(v: V3) -> [f32; 3] { [v.x as f32, v.y as f32, v.z as f32] }
fn css_px(css: &str) -> f32 {
    let b = css.as_bytes();
    let mut i = 0;
    while i < b.len() { if b[i].is_ascii_digit() { let s = i; while i < b.len() && (b[i].is_ascii_digit() || b[i] == b'.') { i += 1; } if b[i..].starts_with(b"px") { return css[s..i].parse().unwrap_or(13.0); } } else { i += 1; } }
    13.0
}

impl Puente {
    /// ¿el sonido es un bucle? (un .wav con un punto "cue" o un bucle "smpl": desde dónde vuelve, en segundos; GMF.wav)
    fn wav_vuelve(&self, r: &str) -> Option<f32> {
        let ruta = if r.starts_with("sound/") { r.to_string() } else { format!("sound/{r}") };
        let b = self.archivos.get(&ruta).cloned().or_else(|| self.lib.as_ref().and_then(|l| l.leer(&ruta)))?;
        wav_vuelve(&b)
    }
}
/// el punto desde donde vuelve un .wav de Source (cue o smpl), en segundos
pub(crate) fn wav_vuelve(b: &[u8]) -> Option<f32> {
    if b.len() < 12 || &b[0..4] != b"RIFF" || &b[8..12] != b"WAVE" { return None; }
    let u32_ = |p: usize| b.get(p..p + 4).map(|x| u32::from_le_bytes([x[0], x[1], x[2], x[3]]));
    let (mut p, mut sr, mut cue, mut smpl) = (12usize, 0u32, None, None);
    while p + 8 <= b.len() {
        let id = &b[p..p + 4]; let t = u32_(p + 4)? as usize;
        if id == b"fmt " { sr = u32_(p + 12).unwrap_or(0); }
        else if id == b"cue " && t >= 28 && p + 36 <= b.len() && u32_(p + 8).unwrap_or(0) > 0 { cue = u32_(p + 32); }
        else if id == b"smpl" && t >= 60 && p + 56 <= b.len() && u32_(p + 36).unwrap_or(0) > 0 { smpl = u32_(p + 52); }
        p += 8 + t + (t & 1);
    }
    let x = smpl.or(cue)?; if sr == 0 { return None; } Some(x as f32 / sr as f32)
}
impl Anfitrion for Puente {
    fn tiempo(&self) -> f64 { self.t }
    fn dt(&self) -> f64 { self.dt }
    fn reloj(&self) -> (f64, f64) {
        let ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs_f64() * 1000.0).unwrap_or(0.0);
        (ms, self.t0.elapsed().as_secs_f64())
    }
    fn pantalla(&self) -> (f64, f64) { self.pantalla }
    fn nombre_jugador(&self) -> String { self.nombre.clone() }
    fn nombre_mapa(&self) -> String { self.mapa_nombre.clone() }
    fn apariciones(&self) -> Vec<(V3, Option<f64>)> { self.spawns.clone() }
    fn jug(&mut self) -> &mut jxgmod::Jugador { &mut self.jug }
    fn huesos_jugador(&mut self) -> Vec<(String, V3, [V3; 3])> { self.huesos_jug.clone() }
    fn arma_mundo(&mut self) -> Option<(V3, Quat)> { self.arma_mundo }
    fn cam(&mut self) -> &mut jxgmod::Camara { &mut self.cam }
    fn entrada(&mut self) -> &mut jxgmod::Entrada { &mut self.ent }
    fn armas(&mut self) -> &mut jxgmod::Armas { &mut self.armas }
    fn arma_definida(&self, n: &str) -> bool { ARMAS.iter().any(|a| a.n == n) || self.gm_armas.iter().any(|a| a.0 == n) }
    fn registrar_arma(&mut self, n: &str, base: Option<&str>, impreso: &str) {
        if let Some(a) = self.gm_armas.iter_mut().find(|a| a.0 == n) { a.1 = base.map(String::from); a.2 = impreso.into(); return; }
        self.gm_armas.push((n.into(), base.map(String::from), impreso.into()));
    }
    fn dar_arma(&mut self, n: &str) {
        if !self.armas.lista.iter().any(|x| x == n) { self.armas.lista.push(n.into()); }
        self.armas.i = self.armas.lista.iter().position(|x| x == n).unwrap_or(0);
        self.pedidos.push(Pedido::Arma(n.into()));
    }
    fn elegir_arma(&mut self, i: usize) { self.armas.i = i; if let Some(n) = self.armas.lista.get(i).cloned() { self.pedidos.push(Pedido::Arma(n)); } }
    fn elegir_arma_callado(&mut self, n: &str) { if let Some(i) = self.armas.lista.iter().position(|x| x == n) { self.elegir_arma(i); } }
    fn prefab(&mut self, modelo: &str, en_addon: bool) -> Option<jxgmod::Prefab> {
        // (el juego nativo todavía no dibuja los .mdl de los addons: un prop del juego con ese nombre o la caja)
        // (el modelo viene en un addon: se arma con su malla, sus texturas y su .phy —gmPrefab—)
        if en_addon { return Some(jxgmod::Prefab { nombre: format!("gm:{modelo}"), sustituto: false }); }
        let base = modelo.rsplit('/').next().unwrap_or(modelo).trim_end_matches(".mdl").to_lowercase();
        if let Some(n) = self.prefabs.get(&base) { return Some(jxgmod::Prefab { nombre: n.clone(), sustituto: false }); }
        let caja = self.caja.clone()?;
        Some(jxgmod::Prefab { nombre: caja, sustituto: !en_addon })
    }
    fn modelo_falta(&mut self, _m: &str) {}
    fn caja_prefab(&self, prefab: &str) -> Option<([f64; 3], [f64; 3])> { self.cajas.get(prefab).copied() }
    fn crear_objeto(&mut self, prefab: &str, pos: V3, q: Quat) -> Option<ObjId> {
        self.sig += 1;
        let id = self.sig;
        self.cuerpos.insert(id, jxgmod::Cuerpo::nuevo(pos, q));
        self.pedidos.push(Pedido::Crear(id, prefab.into()));
        Some(id)
    }
    fn borrar_objeto(&mut self, o: ObjId) { if self.cuerpos.remove(&o).is_some() { self.pedidos.push(Pedido::Borrar(o)); } }
    fn cuerpo(&mut self, o: ObjId) -> Option<&mut jxgmod::Cuerpo> { self.cuerpos.get_mut(&o) }
    fn objetos(&self) -> Vec<ObjId> { self.cuerpos.keys().copied().collect() }
    fn raycast(&mut self, o: V3, d: V3, max: f64, ign: &[ObjId]) -> Option<Golpe> {
        let (Some(mp), Some(fis)) = (self.mapa.as_ref(), self.fis.as_mut()) else { return None };
        let ig: Vec<u32> = ign.iter().filter_map(|x| self.a_fis.get(x).copied()).collect();
        let g = fis.rayo(&mp.mundo, [o.x, o.y, o.z], [d.x, d.y, d.z], max, &ig)?;
        let p = if g.p == [0.0; 3] { [o.x + d.x * g.t, o.y + d.y * g.t, o.z + d.z * g.t] } else { g.p };
        Some(Golpe { t: g.t, p: V3 { x: p[0], y: p[1], z: p[2] }, n: V3 { x: g.n[0], y: g.n[1], z: g.n[2] }, obj: g.cuerpo.and_then(|c| self.de_fis.get(&c).copied()), persona: None })
    }
    fn sonido(&mut self, ruta: &str, pos: Option<V3>, vol: f64, tono: f64) {
        let (r, v, t, _) = jxgmod::sonidos::resolver(ruta, Some(vol), Some(tono * 100.0), azar01());
        self.pedidos.push(Pedido::Sonido(r, pos.map(f3), v as f32, t as f32));
    }
    fn emitir_sonido(&mut self, e: Option<f64>, s: &str, _nivel: Option<f64>, tono: Option<f64>, vol: Option<f64>, canal: Option<f64>) {
        // (un guion de sonido —de sound.Add o de los de GMod: "Weapon_Pistol.Single"— a su .wav, volumen y tono; el canal del
        // guion (CHAN_WEAPON…) corta lo que esa entidad tenía sonando en el mismo canal; un .wav con un punto "cue" es un
        // bucle: suena hasta que StopSound lo corta —gmsnEmitir—)
        let (r, v, t, ca) = jxgmod::sonidos::resolver(s, vol, tono, azar01());
        let ca = if ca != 0 { ca } else { canal.map(|c| c as i32).unwrap_or(0) };
        if (1..=4).contains(&ca) { self.pedidos.push(Pedido::Canal(e, ca)); }
        let k = format!("{}|{}", e.map(|x| x.to_string()).unwrap_or("-".into()), s.to_lowercase());
        match self.wav_vuelve(&r) { Some(ini) => self.pedidos.push(Pedido::Bucle { k, r, e, vol: v as f32, tono: t as f32, ini, on: true, fundido: None, ca }), None => self.pedidos.push(Pedido::Sonido(r, None, v as f32, t as f32)) }
    }
    fn parar_sonido(&mut self, e: Option<f64>, s: &str) { if !s.is_empty() { self.pedidos.push(Pedido::Bucle { k: format!("{}|{}", e.map(|x| x.to_string()).unwrap_or("-".into()), s.to_lowercase()), r: String::new(), e, vol: 0.0, tono: 1.0, ini: 0.0, on: false, fundido: None, ca: 0 }); } }
    fn parche_sonido(&mut self, id: u32, e: Option<f64>, s: &str, on: bool, vol: Option<f64>, tono: Option<f64>, f: Option<f64>) {
        // (CSoundPatch: Play, Stop y FadeOut; un .wav con "cue" suena en bucle hasta que lo paran, y su volumen y su tono se
        // pueden cambiar mientras suena: gmsnParche)
        let (r, v, t, _) = jxgmod::sonidos::resolver(s, vol, tono, azar01());
        let ini = if on { self.wav_vuelve(&r) } else { Some(0.0) };
        match ini { Some(ini) => self.pedidos.push(Pedido::Bucle { k: format!("p{id}"), r, e, vol: v as f32, tono: t as f32, ini, on, fundido: f.filter(|x| *x > 0.0), ca: 0 }), None => self.pedidos.push(Pedido::Sonido(r, None, v as f32, t as f32)) }
    }
    fn danar_jugador(&mut self, d: f64) { self.pedidos.push(Pedido::DanarJugador(d as f32)); }
    fn danar_objeto(&mut self, o: ObjId, d: f64, _p: V3, _dir: V3) { self.pedidos.push(Pedido::DanarObjeto(o, d as f32)); }
    fn danar_persona(&mut self, _p: PersonaId, _d: f64, _pos: V3, _dir: V3) {}
    fn matar_jugador(&mut self) { self.jug.vivo = false; self.pedidos.push(Pedido::Matar); }
    // (Player:Spawn() de un modo: vivo ya, con la vida llena, en un punto de aparición —su PlayerSpawn puede moverlo después—)
    fn reaparecer(&mut self) {
        let k = (self.t * 7.0) as usize; let sp = if self.spawns.is_empty() { None } else { Some(self.spawns[k % self.spawns.len()].clone()) };
        self.jug.vivo = true; self.jug.vida = 100.0; self.jug.vel = V3 { x: 0.0, y: 0.0, z: 0.0 };
        if let Some((p, yaw)) = sp { self.jug.pos = V3 { x: p.x, y: p.y + 0.2, z: p.z }; if let Some(y) = yaw { self.jug.yaw = y; } }
        self.pedidos.push(Pedido::Reaparecer);
    }
    fn quitar_armas(&mut self) { self.pedidos.push(Pedido::QuitarArmas); }
    fn espectador(&mut self, on: bool) { self.jug.noclip = on; }
    fn explosion(&mut self, p: V3, r: f64, m: f64, sin_fx: bool) { self.pedidos.push(Pedido::Explosion(f3(p), r as f32, m as f32, sin_fx)); }
    fn efecto_impacto(&mut self, p: V3, n: V3, cuerpo: bool) { self.pedidos.push(Pedido::Impacto(f3(p), f3(n), cuerpo)); }
    fn efecto_explosion(&mut self, p: V3) { self.pedidos.push(Pedido::ExplosionFx(f3(p))); }
    fn efecto_traza(&mut self, a: V3, b: V3) { self.pedidos.push(Pedido::Traza(f3(a), f3(b))); }
    fn efecto_fogonazo(&mut self) { self.pedidos.push(Pedido::Fogonazo); }
    fn particula(&mut self, p: V3, v: V3, vida: f64, tam: f64, c: [f64; 4], tipo: &str, crece: Option<f64>) {
        let t = match tipo { "fuego" => efx::Tipo::Fuego, "humo" => efx::Tipo::Humo, "gota" => efx::Tipo::Gota, _ => efx::Tipo::Chispa };
        if self.pedidos.iter().filter(|x| matches!(x, Pedido::Particula(..))).count() < 300 {
            self.pedidos.push(Pedido::Particula(f3(p), f3(v), vida as f32, tam as f32, [c[0] as f32, c[1] as f32, c[2] as f32, c[3] as f32], t, crece.unwrap_or(0.0) as f32));
        }
    }
    fn sacudir(&mut self, a: f64) { self.pedidos.push(Pedido::Sacudir(a as f32)); }
    fn animar_vista(&mut self, clip: &str) { let c = match clip { "fuego" => "fuego", "fuego2" => "fuego2", "recarga" => "recarga", "sacar" => "sacar", _ => "quieto" }; self.pedidos.push(Pedido::Anim(c)); }
    fn chat(&mut self, s: &str) { self.pedidos.push(Pedido::Aviso(s.into())); }
    fn aviso(&mut self, s: &str, _d: f64) { self.pedidos.push(Pedido::Aviso(s.into())); }
    fn dibujar_2d(&mut self, c: Cmd2D) { if self.cmds.len() < 20000 { self.cmds.push(c); } }
    fn ancho_texto(&mut self, fuente: &str, s: &str) -> f64 {
        let px = css_px(fuente);
        match &self.letras { Some(l) => (l.ancho(px * self.escala, s) / self.escala) as f64, None => s.chars().count() as f64 * px as f64 * 0.5 }
    }
    fn material(&mut self, ruta: &str) -> InfoMaterial {
        let k = ruta.to_lowercase().replace('\\', "/");
        if let Some(&(_, w, hh, ya)) = self.mats.get(&k) { return InfoMaterial { existe: true, cargado: ya, ancho: w as f64, alto: hh as f64, nada: false }; }
        // (sólo las imágenes PNG del addon: los .vtf todavía no se leen en el nativo; no se dibuja nada en su lugar)
        let png = [format!("materials/{}", k), k.clone(), format!("materials/{}.png", k)].into_iter().find(|r| r.ends_with(".png") && self.archivos.contains_key(r));
        match png {
            Some(r) => { self.pedidos.push(Pedido::Textura(r)); InfoMaterial { existe: true, cargado: false, ancho: 32.0, alto: 32.0, nada: false } }
            None => {
                // (un .vmt con su $basetexture o un .vtf suelto: la textura de Source)
                let kb = k.strip_prefix("materials/").unwrap_or(&k); let kb = kb.trim_end_matches(".vmt").trim_end_matches(".vtf").to_string();
                let arch = &self.archivos;
                let vtf = if arch.contains_key(&format!("materials/{kb}.vtf")) { Some(kb.clone()) } else { arch.get(&format!("materials/{kb}.vmt")).and_then(|b| jxgmod::formatos::vmt(b, &|p: &str| arch.get(&format!("materials/{}.vmt", p.trim_end_matches(".vmt"))).cloned())).and_then(|v| v.base).filter(|b| arch.contains_key(&format!("materials/{b}.vtf"))) };
                match vtf {
                    Some(b) => { self.pedidos.push(Pedido::Textura(format!("materials/{b}.vtf|{k}"))); InfoMaterial { existe: true, cargado: false, ancho: 32.0, alto: 32.0, nada: false } }
                    None => InfoMaterial { existe: self.archivos.contains_key(&format!("materials/{}.vmt", k)), cargado: false, ancho: 32.0, alto: 32.0, nada: true },
                }
            }
        }
    }
    fn archivo(&mut self, r: &str) -> Option<Vec<u8>> { self.archivos.get(r).map(|b| b.to_vec()).or_else(|| self.lib.as_ref().and_then(|l| l.leer(r)).map(|b| b.to_vec())).or_else(|| self.steam.as_ref().and_then(|d| crate::steambase::leer_cache(d, r))) }
    fn existe(&mut self, r: &str) -> bool { self.archivos.contains_key(r) || self.lib.as_ref().map(|l| l.tiene(r)).unwrap_or(false) || self.steam.as_ref().map(|d| crate::steambase::en_cache(d, r)).unwrap_or(false) }
    fn dato(&mut self, k: &str) -> Option<String> { self.datos.get(k).cloned() }
    fn poner_dato(&mut self, k: &str, v: Option<&str>) { match v { Some(v) => { self.datos.insert(k.into(), v.into()); } None => { self.datos.remove(k); } } self.datos_sucio = true; }
    fn como_any(&mut self) -> Option<&mut dyn std::any::Any> { Some(self) }
}

/// un addon instalado: de dónde viene, si está prendido y lo que trae para poner
pub struct InfoAddon { pub ruta: PathBuf, pub nombre: String, pub prendido: bool, pub idx: Option<usize>, pub sweps: Vec<(String, String)>, pub sents: Vec<(String, String)>, pub errores: usize }
/// un sonido de un addon en bucle: su clave en el sonido del juego, su entidad, volumen, tono, desde dónde vuelve, canal y
/// fundido (desde cuándo y cuánto dura)
struct BucleGm { clave: String, e: Option<f64>, vol: f32, tono: f32, ini: f32, ca: i32, fade: Option<(f32, f32)> }
/// un resultado de la tienda
/// (pipe: no viene como archivo directo —SteamPipe, steampipe.rs—; prog: cómo va su bajada)
pub struct ItemTienda { pub id: String, pub titulo: String, pub estado: String, pub mb: f32, pub pipe: bool, pub prog: Option<Arc<crate::steampipe::Progreso>> }
/// los mapas destacados de la tienda (los pedidos): siempre arriba, aunque la lista de populares no llegue
pub const DESTACADOS: [(&str, &str, f32); 2] = [("3317372577", "Sentimental 98 V3 Night (mapa)", 186.4), ("3566942044", "gm_pole (mapa)", 136.7)];

/// los addons en el juego
pub struct EnGmod {
    pub gm: Option<Gmod>,
    pub addons: Vec<InfoAddon>,
    /// los que faltan montar (uno por cuadro: un addon grande no traba el juego)
    pub pendientes: Vec<usize>,
    /// el arma de un addon en la mano (su índice en las armas registradas) y el arma del juego que presta su vista
    arma: Option<usize>, base: usize,
    /// los botones de las teclas del arma del mod en la mano y de qué clase son (teclas_mod.rs)
    pub teclas: Vec<super::teclas_mod::BotonTecla>, pub teclas_de: String,
    /// las carpetas de addons: la del teléfono (Android/data/…/files/addons) y la de lo bajado (datos/addons)
    pub carpeta_externa: Option<PathBuf>, datos: Option<PathBuf>,
    /// el panel «Mods» (y cuánto se bajó)
    pub panel: bool, pub scroll: f32,
    /// las texturas de los materiales ya subidas y las órdenes de dibujo del último cuadro (en unidades de la pantalla)
    texs: Vec<i64>, hud_px: Vec<Cmd2D>, escala: f32,
    /// la tienda: el HTTP binario (lo pone la app), lo que se pidió y lo que llega
    pub http_bin: Option<HttpBin>, pub tienda: Vec<ItemTienda>, pub(crate) tx: Sender<(String, Result<Vec<u8>, String>)>, rx: Receiver<(String, Result<Vec<u8>, String>)>, tienda_pedida: bool,
    /// lo que tardó el último cuadro del Lua (ms) y en promedio
    pub ms: f32, pub ms_prom: f32,
    /// el tamaño de la pantalla (lo pone el HUD) y si ya se buscaron los addons de las carpetas
    pub pantalla: (f32, f32), pub buscado: bool,
    /// cuántos pedidos de cada clase hizo el Lua (para las pruebas)
    pub cuenta: BTreeMap<&'static str, u32>,
    /// los modelos de los addons (gmod_modelos.rs)
    pub mods: gmod_modelos::GmModelos,
    /// lo que tardó en el último cuadro el dibujo 3D del Lua más armar y ubicar los modelos (ms)
    pub ms_3d: f32,
    /// lo que pidió el CalcView de los addons en este cuadro (la cámara del sable: tercera persona)
    pub calc: Option<jxgmod::modelos::CalcVista>,
    /// el jugador mira una entidad de un addon que se puede usar (aparece el botón Usar) y si lo tenía apretado
    pub usable: bool, pub usar_ant: bool,
    /// el dedo que está tocando un menú de un addon (id, x, y en píxeles)
    pub vgui_dedo: Option<(i32, f32, f32)>,
    /// cómo leer rb/ (la biblioteca gm_lib y rb/jxp: en la APK o en una carpeta; lo pone la app), lo leído y el menú de GMod
    pub lector_rb: Option<LectorRb>, pub(crate) lib: Option<Rc<gmod_base::Biblioteca>>, pub jxp: Option<gmod_base::MenuJxp>, pub menu: gmod_menu::MenuGm,
    /// los modelos de jugador puestos (el jugador y los NPC con uno: gmod_pm.rs)
    pub pm: gmod_pm::Pm,
    /// los bucles de sonido de los addons que suenan (gmod_sonidos.js: GMSN.bucles) y el reloj de los fundidos
    bucles: HashMap<String, BucleGm>, t_snd: f32,
    /// el Pill puesto (gmod_pill.rs)
    pub pill: gmod_pill::Pill,
    /// la forma de choque de los vehículos de las listas ya armados (gmod_spawn.rs)
    veh_fis: HashMap<String, Arc<jxjuego::forma::PrefabFisica>>,
    /// los modos de juego (gmod_modos.js): el elegido ("auto": el del mapa; "sandbox"; o un modo), en qué mapa se puso, la
    /// fase (0 decidir, 1 rearmando el Lua, 2 listo), el que se pidió, la barrita de arriba, el panel de equipos y lo que
    /// lleva muerto el jugador mientras el modo decide cuándo vuelve
    pub modo_elegido: String, modo_mapa: Option<usize>, modo_fase: u8, modo_quiere: Option<String>, pub modo_barra: Option<String>, pub equipos_panel: bool, pub muerto_t: f32, modo_t: u32,
    /// la Workshop de «Mods y mapas» (como el navegador de GMod): lo buscado, la categoría, el orden, las páginas y las fotos
    pub ws: Ws,
}

impl EnGmod {
    pub fn nueva(datos: Option<&Path>) -> EnGmod {
        let (tx, rx) = channel();
        EnGmod { gm: None, addons: vec![], pendientes: vec![], arma: None, base: 0, teclas: vec![], teclas_de: String::new(), carpeta_externa: None, datos: datos.map(|d| d.to_path_buf()), panel: false, scroll: 0.0, texs: vec![], hud_px: vec![], escala: 1.0,
            http_bin: None, tienda: vec![], tx, rx, tienda_pedida: false, ms: 0.0, ms_prom: 0.0, pantalla: (1280.0, 720.0), buscado: false, cuenta: BTreeMap::new(), mods: Default::default(), ms_3d: 0.0, calc: None, usable: false, usar_ant: false, vgui_dedo: None, lector_rb: None, lib: None, jxp: None, menu: Default::default(), pm: Default::default(), veh_fis: HashMap::new(), modo_elegido: datos.and_then(|d| std::fs::read_to_string(d.join("gmod_modo.txt")).ok()).map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).unwrap_or_else(|| "auto".into()), modo_mapa: None, modo_fase: 0, modo_quiere: None, modo_barra: None, equipos_panel: false, muerto_t: 0.0, modo_t: 0, ws: Ws::default(), bucles: HashMap::new(), t_snd: 0.0, pill: Default::default() }
    }
    fn apagados_ruta(&self) -> Option<PathBuf> { self.datos.as_ref().map(|d| d.join("gmod_apagados.txt")) }
    /// los addons de las carpetas (.gma y carpetas con lua/), en orden de nombre; los apagados quedan anotados
    pub fn buscar(&mut self) {
        let apagados: Vec<String> = self.apagados_ruta().and_then(|r| std::fs::read_to_string(r).ok()).map(|s| s.lines().map(String::from).collect()).unwrap_or_default();
        let mut rutas: Vec<PathBuf> = vec![];
        for c in [self.carpeta_externa.clone(), self.datos.as_ref().map(|d| d.join("addons"))].into_iter().flatten() {
            let Ok(rd) = std::fs::read_dir(&c) else { continue };
            let mut v: Vec<PathBuf> = rd.flatten().map(|e| e.path()).filter(|p| p.is_dir() || p.extension().map(|e| e.eq_ignore_ascii_case("gma")).unwrap_or(false)).collect();
            v.sort();
            rutas.extend(v);
        }
        for r in rutas {
            if self.addons.iter().any(|a| a.ruta == r) { continue; }
            let nombre = r.file_name().map(|x| x.to_string_lossy().into_owned()).unwrap_or_default();
            let prendido = !apagados.contains(&nombre);
            self.addons.push(InfoAddon { ruta: r, nombre, prendido, idx: None, sweps: vec![], sents: vec![], errores: 0 });
            if prendido { self.pendientes.push(self.addons.len() - 1); }
        }
    }
    /// (para las pruebas) cuántos objetos de los addons hay y dónde está el primer nextbot
    pub fn objs_gm(&self) -> usize { GM_OBJ.with(|x| x.borrow().len()) }
    pub fn nb_pos(&self) -> Option<[f32; 3]> { self.mods.dib.modelos.iter().map(|d| [d.pos.x as f32, d.pos.y as f32, d.pos.z as f32]).next().or_else(|| self.mods.dib.sprites.first().map(|s| [s.esq[0].x as f32, s.esq[0].y as f32, s.esq[0].z as f32])) }
    fn guardar_apagados(&self) {
        if let Some(r) = self.apagados_ruta() { let s: Vec<&str> = self.addons.iter().filter(|a| !a.prendido).map(|a| a.nombre.as_str()).collect(); let _ = std::fs::write(r, s.join("\n")); }
    }
}

/// un .wav (PCM de 8 o 16 bits) → muestras mono en [-1, 1] y su frecuencia
fn leer_wav(b: &[u8]) -> Option<(Vec<f32>, u32)> {
    if b.len() < 12 || &b[0..4] != b"RIFF" || &b[8..12] != b"WAVE" { return None; }
    let (mut p, mut ch, mut hz, mut bits, mut fmt, mut align) = (12usize, 1u16, 22050u32, 16u16, 1u16, 0u16);
    while p + 8 <= b.len() {
        let id = &b[p..p + 4];
        let n = u32::from_le_bytes(b[p + 4..p + 8].try_into().ok()?) as usize;
        let d = &b[p + 8..(p + 8 + n).min(b.len())];
        if id == b"fmt " && d.len() >= 16 { fmt = u16::from_le_bytes([d[0], d[1]]); ch = u16::from_le_bytes([d[2], d[3]]).max(1); hz = u32::from_le_bytes(d[4..8].try_into().ok()?); align = u16::from_le_bytes([d[12], d[13]]); bits = u16::from_le_bytes([d[14], d[15]]); }
        if id == b"data" {
            let ch = ch as usize;
            // (MS ADPCM —muchos .wav de Source—: a PCM de 16 bits, como GMF.wav)
            if fmt == 2 {
                let blk = align.max(1) as usize; let (c1, c2) = ([256i32, 512, 0, 192, 240, 460, 392], [0i32, -256, 0, 64, 0, -208, -232]); let ad = [230i32, 230, 230, 230, 307, 409, 512, 614, 768, 614, 512, 409, 307, 230, 230, 230];
                let mut out: Vec<f32> = vec![]; let i16_ = |x: usize| d.get(x..x + 2).map(|s| i16::from_le_bytes([s[0], s[1]]) as i32).unwrap_or(0);
                for k in 0..d.len() / blk {
                    let o = k * blk; let mut q = o; if o + 7 * ch > d.len() { break; }
                    let pred: Vec<usize> = (0..ch).map(|c| (d[q + c] as usize).min(6)).collect(); q += ch;
                    let mut del: Vec<i32> = (0..ch).map(|c| i16_(q + c * 2)).collect(); q += 2 * ch;
                    let mut s1: Vec<i32> = (0..ch).map(|c| i16_(q + c * 2)).collect(); q += 2 * ch;
                    let mut s2: Vec<i32> = (0..ch).map(|c| i16_(q + c * 2)).collect(); q += 2 * ch;
                    let mut mezcla: Vec<i32> = vec![]; mezcla.extend(&s2); mezcla.extend(&s1);
                    let mut c = 0;
                    while q < o + blk && q < d.len() { for nib in [d[q] >> 4, d[q] & 15] { let sn = if nib & 8 != 0 { nib as i32 - 16 } else { nib as i32 }; let v = (((s1[c] * c1[pred[c]] + s2[c] * c2[pred[c]]) >> 8) + sn * del[c]).clamp(-32768, 32767); s2[c] = s1[c]; s1[c] = v; mezcla.push(v); del[c] = ((ad[nib as usize] * del[c]) >> 8).max(16); c = (c + 1) % ch; } q += 1; }
                    for f in mezcla.chunks_exact(ch) { out.push(f.iter().map(|&x| x as f32 / 32768.0).sum::<f32>() / ch as f32); }
                }
                return Some((out, hz));
            }
            if fmt == 3 && bits == 32 { return Some((d.chunks_exact(4 * ch).map(|f| f.chunks_exact(4).map(|s| f32::from_le_bytes([s[0], s[1], s[2], s[3]])).sum::<f32>() / ch as f32).collect(), hz)); }
            if fmt != 1 { return None; }
            let v: Vec<f32> = match bits {
                16 => d.chunks_exact(2 * ch).map(|f| f.chunks_exact(2).map(|s| i16::from_le_bytes([s[0], s[1]]) as f32 / 32768.0).sum::<f32>() / ch as f32).collect(),
                8 => d.chunks_exact(ch).map(|f| f.iter().map(|s| (*s as f32 - 128.0) / 128.0).sum::<f32>() / ch as f32).collect(),
                _ => return None,
            };
            return Some((v, hz));
        }
        p += 8 + n + (n & 1);
    }
    None
}

/// una matriz 2D (a, b, c, d, e, f): x' = a x + c y + e, y' = b x + d y + f
type Af = [f32; 6];
fn af_mul(m: &Af, x: f32, y: f32) -> (f32, f32) { (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]) }

impl Juego {
    fn con_puente<R>(&self, f: impl FnOnce(&mut Puente) -> R) -> Option<R> {
        let gm = self.gmod.gm.as_ref()?;
        gm.anfitrion(|h| h.como_any().and_then(|a| a.downcast_mut::<Puente>()).map(f))
    }
    /// arranca la capa GMod (sin addons todavía): se llama sola la primera vez
    fn gmod_arrancar(&mut self) {
        // (si la biblioteca de GMod no vino en la APK, se baja primero —86 MB, una vez— y mientras tanto no arranca)
        if self.gmod.lib.is_none() { if let (Some(b), Some(l)) = (self.bajas.clone(), self.gmod.lector_rb.clone()) {
            let faltan: Vec<String> = gmod_base::archivos_lib(&l).into_iter().filter(|n| !b.disponible(n)).collect();
            if let Some((va, tot, falla)) = b.asegurar(&faltan) {
                self.avisar(if falla { "No se pudo bajar la biblioteca de GMod: revisá la conexión".into() } else if tot > 0 { format!("Bajando la biblioteca de GMod… {:.0} de {:.0} MB (una sola vez)", va as f64 / 1048576.0, tot as f64 / 1048576.0) } else { "Bajando la biblioteca de GMod… (una sola vez)".into() });
                return;
            }
        } }
        // (la biblioteca y los datos de la versión personal, una vez)
        if self.gmod.lib.is_none() { if let Some(l) = self.gmod.lector_rb.clone() { self.gmod.lib = gmod_base::Biblioteca::abrir(l.clone()).map(Rc::new); if self.gmod.jxp.is_none() { self.gmod.jxp = gmod_base::menu_jxp(&l); } } }
        let nombres: HashMap<String, String> = self.nombres.keys().map(|k| (k.to_lowercase(), k.clone())).collect();
        let caja = ["WoodenCrate", "Crate", "crate"].iter().find(|n| self.nombres.contains_key(**n)).map(|s| s.to_string())
            .or_else(|| self.nombres.keys().filter(|k| k.to_lowercase().contains("crate") || k.to_lowercase().contains("box")).min().cloned())
            .or_else(|| self.catalogo.first().and_then(|c| c.1.first().cloned()));
        let datos: BTreeMap<String, String> = self.datos.as_ref().and_then(|d| std::fs::read_to_string(d.join("gmod_datos.txt")).ok()).map(|s| s.lines().filter_map(|l| l.split_once('\t')).map(|(k, v)| (k.to_string(), v.replace("\\n", "\n"))).collect()).unwrap_or_default();
        let spawns = self.mapa.as_ref().map(|mp| mp.spawns.iter().map(|s| (v3(s.0), s.1.map(|y| y as f64))).collect()).unwrap_or_default();
        let p = Puente {
            t: 0.0, dt: 1.0 / 60.0, t0: Instant::now(), pantalla: (1280.0, 720.0), escala: 1.0,
            jug: jxgmod::Jugador::default(), cam: jxgmod::Camara::default(), ent: jxgmod::Entrada::default(), armas: jxgmod::Armas::default(), huesos_jug: Vec::new(), arma_mundo: None,
            cuerpos: BTreeMap::new(), sig: 0, pedidos: vec![], cmds: vec![], gm_armas: vec![], mapa: None, fis: None, letras: None,
            de_fis: HashMap::new(), a_fis: HashMap::new(), archivos: HashMap::new(), steam: self.gmod.datos.as_ref().map(|d| d.join("gbs")), mats: HashMap::new(), prefabs: nombres, caja, datos, datos_sucio: false,
            nombre: "Jugador".into(), mapa_nombre: self.mapas.get(self.mapa_i).cloned().unwrap_or_default(), spawns, cajas: HashMap::new(), lib: self.gmod.lib.clone(),
        };
        self.gmod.gm = Some(Gmod::nuevo(Box::new(p)));
        // (el addon base «Garry's Mod»: el Lua de GMod que llena las listas de NPCs, vehículos y armas, antes que los demás)
        if let (Some(l), Some(mj)) = (self.gmod.lector_rb.clone(), self.gmod.jxp.as_ref()) { if let Some(a) = gmod_base::addon_base(&l, mj) { self.gmod_prestar(true); if let Some(gm) = self.gmod.gm.as_mut() { gm.montar(a); } self.gmod_prestar(false); } }
        self.gmod.menu.hecho = false;
        self.gmod.texs.clear();
        self.gmod.arma = None;
    }
    /// vuelve a armar el Lua con los addons prendidos (como gmLuaDesmontar: GMod no descarga addons en vivo)
    pub fn gmod_reiniciar(&mut self) {
        let base = self.gmod.base;
        if self.gmod.arma.is_some() { self.gmod.arma = None; self.armas.elegir(&mut self.fis, base); }
        self.gmod.gm = None;
        for (i, a) in self.gmod.addons.iter_mut().enumerate() { a.idx = None; a.sweps.clear(); a.sents.clear(); if a.prendido && !self.gmod.pendientes.contains(&i) { self.gmod.pendientes.push(i); } }
    }
    /// ¿hay un arma de un addon en la mano? (el juego no dispara la suya)
    pub fn gmod_arma_activa(&self) -> bool { self.gmod.arma.is_some() }
    /// la clase del arma del addon en la mano (para sus teclas: teclas_mod.rs)
    pub(super) fn gmod_clase_arma(&self) -> Option<String> { let k = self.gmod.arma?; self.con_puente(|p| p.gm_armas.get(k).map(|a| a.0.clone())).flatten() }
    /// montar un addon de los pendientes
    fn gmod_montar_uno(&mut self) {
        if self.gmod.pendientes.is_empty() { return; }
        // (GMod arranca recién cuando está su biblioteca: si se está bajando, el addon espera en la fila —se reintenta en el
        // cuadro siguiente— en vez de montarse sin motor)
        if self.gmod.gm.is_none() { self.gmod_arrancar(); if self.gmod.gm.is_none() { return; } }
        let i = self.gmod.pendientes.remove(0);
        let ruta = self.gmod.addons[i].ruta.clone();
        let arch = if ruta.is_dir() { Some(jxgmod::leer_carpeta(&ruta)) } else { std::fs::read(&ruta).ok().and_then(|b| jxgmod::leer_gma(&b)) };
        let Some(arch) = arch else { self.avisar(format!("No se pudo leer {}", self.gmod.addons[i].nombre)); return };
        let nombre = self.gmod.addons[i].nombre.clone();
        crate::caja_negra::paso(format!("montar el addon {nombre}"));
        let ad = Addon::de_archivos(&nombre, &nombre, arch);
        // (lo de HL2 y CS:S que nombra y no trae: a la cola de Steam —base_juego.rs—, se baja en el fondo)
        let refs = super::base_juego::refs_addon(&ad.archivos); self.base_addon(refs);
        let copia: Vec<(String, Rc<[u8]>)> = ad.archivos.iter().filter(|(k, _)| k.starts_with("sound/") || k.starts_with("materials/")).map(|(k, v)| (k.clone(), v.clone())).collect();
        self.con_puente(|p| for (k, v) in copia { p.archivos.entry(k).or_insert(v); });
        // (el Lua de los addons corre con el mundo a mano: algunos trazan al cargar)
        self.gmod_prestar(true);
        let Some(gm) = self.gmod.gm.as_mut() else { self.gmod_prestar(false); return };
        let idx = gm.montar(ad);
        let (sw, se, er) = (gm.sweps(idx), gm.sents(idx), gm.errores(idx).len());
        let nom_sw: Vec<String> = sw.iter().map(|c| gm.nombre_item(&format!("gmswep:{}", c))).collect();
        let nom_se: Vec<String> = se.iter().map(|c| gm.nombre_item(&format!("gment:{}", c))).collect();
        self.gmod_prestar(false);
        let a = &mut self.gmod.addons[i];
        a.idx = Some(idx); a.sweps = sw.into_iter().zip(nom_sw).collect(); a.sents = se.into_iter().zip(nom_se).collect(); a.errores = er;
        let txt = format!("Mod cargado: {} ({} armas, {} entidades)", a.nombre, a.sweps.len(), a.sents.len());
        self.avisar(txt);
        // (el menú de GMod se vuelve a armar con lo del addon nuevo; y las opciones de los mods guardadas, otra vez puestas)
        self.gmod.menu.hecho = false; self.opc_aplicar();
    }
    /// las opciones de los mods guardadas (gmod_opciones.txt: «ConVar=valor» por renglón)
    fn opc_leidas(&self) -> Vec<(String, String)> {
        self.datos.as_ref().and_then(|d| std::fs::read_to_string(d.join("gmod_opciones.txt")).ok()).map(|t| t.lines().filter_map(|l| l.split_once('=').map(|(a, b)| (a.to_string(), b.to_string()))).collect()).unwrap_or_default()
    }
    /// poner las opciones guardadas (las ConVars que todavía no existen —su mod no se cargó— no hacen nada)
    pub(crate) fn opc_aplicar(&mut self) { let v = self.opc_leidas(); if let Some(g) = self.gmod.gm.as_mut() { for (n, x) in v { if g.cvar_leer(&n).map_or(false, |a| a != x) { g.cvar_poner(&n, &x); } } } }
    /// guardar las ConVars de la opción elegida en Herramientas (como GMod guarda las FCVAR_ARCHIVE)
    pub(crate) fn opc_guardar(&mut self) {
        let Some(i) = self.her.opc_sel else { return }; let mut v = self.opc_leidas(); let Some(g) = self.gmod.gm.as_mut() else { return };
        for n in g.opcion_cvars(i) { if let Some(x) = g.cvar_leer(&n) { match v.iter_mut().find(|e| e.0 == n) { Some(e) => e.1 = x, None => v.push((n, x)) } } }
        if let Some(d) = &self.datos { let _ = std::fs::write(d.join("gmod_opciones.txt"), v.iter().map(|(a, b)| format!("{a}={}", b.replace('\n', " "))).collect::<Vec<_>>().join("\n")); }
    }
    /// presta (o devuelve) el mapa, la física y las letras al puente mientras corre el Lua
    pub(crate) fn gmod_prestar(&mut self, prestar: bool) {
        let Some(gm) = self.gmod.gm.as_ref() else { return };
        if prestar {
            let (mp, fis, l) = (self.mapa.take(), std::mem::replace(&mut self.fis, Fisica::nueva()), self.letras.take());
            gm.anfitrion(|h| { if let Some(p) = h.como_any().and_then(|a| a.downcast_mut::<Puente>()) { p.mapa = mp; p.fis = Some(fis); p.letras = l; } });
        } else {
            let (mp, fis, l) = gm.anfitrion(|h| { let p = h.como_any().and_then(|a| a.downcast_mut::<Puente>()).unwrap(); (p.mapa.take(), p.fis.take(), p.letras.take()) });
            self.mapa = mp; if let Some(f) = fis { self.fis = f; } self.letras = l;
        }
    }
    /// las herramientas de la Tool Gun de los addons en la lista del Tool Gun del juego (al montar o desmontar uno), con
    /// sus ConVars como ajustes; y la elegida activa en el Lua sólo con la Tool Gun en la mano
    fn gmod_herramientas_sync(&mut self) {
        let Some(g) = self.gmod.gm.as_mut() else { return };
        let n = self.her.lista.iter().filter(|h| h.gm.is_some()).count();
        let lista = if g.herramientas_cuenta() != n { Some(g.herramientas()) } else { None };
        if let Some(l) = lista {
            let sel = self.her.lista.get(self.her.sel).map(|h| h.n.clone());
            self.her.lista.retain(|h| h.gm.is_none());
            for t in l {
                let p = t.convars.iter().map(|(k, d)| {
                    let tipo = if d == "0" || d == "1" { "Boolean" } else if d.parse::<f32>().is_ok() { "Single" } else { "String" };
                    herramientas::Param { n: k.clone(), t: tipo.into(), o: vec![], d: Some(d.clone()) }
                }).collect();
                self.her.lista.push(herramientas::Herr { n: t.nombre.clone(), p, gm: Some(t.modo.clone()) });
            }
            if let Some(s) = sel { if let Some(i) = self.her.lista.iter().position(|h| h.n == s) { self.her.sel = i; } }
        }
        let quiero = if self.armas.def().n == "ToolBaton" { self.her.lista.get(self.her.sel).and_then(|h| h.gm.clone()) } else { None };
        if let Some(g) = self.gmod.gm.as_mut() { g.herramienta_activa(quiero.as_deref()); }
    }
    /// el cuadro de los addons: montar lo pendiente, copiar el juego al Lua, su cuadro (y su HUD), y lo que pidió
    pub fn gmod_cuadro(&mut self, m: &mut Motor3d, dt: f32) {
        if !self.gmod.buscado { self.gmod.buscado = true; self.gmod.buscar(); }
        if !self.gmod.pendientes.is_empty() && self.mapa.is_some() { self.gmod_montar_uno(); }
        self.gmod_tienda_paso();
        if self.gmod.panel && self.gmod.gm.is_none() && self.mapa.is_some() { self.gmod_arrancar(); }
        if self.gmod.panel || !self.gmod.menu.pend.is_empty() { self.gmod_menu_paso(m); }
        if self.mapa.is_some() { self.pill_paso(m, dt); }
        if self.gmod.gm.is_none() || self.mapa.is_none() { return; }
        self.gmod_modos_paso(dt);
        let t0 = Instant::now();
        // (el arma de un addon: si el jugador eligió otra del juego, se guarda)
        if self.gmod.arma.is_some() && self.armas.i != self.gmod.base { self.gmod.arma = None; }
        self.gmod_copiar(dt);
        let pausa = self.ajustes.is_some();
        // (la tecla E de GMod: apretar, mantener, soltar el botón Usar mirando una entidad de un addon)
        let usar_ap = self.apretado(Boton::Usar) && self.menu.is_none() && !pausa;
        let usar_est = match (usar_ap, self.gmod.usar_ant) { (true, false) => 1u8, (true, true) => 2, (false, true) => 3, _ => 0 };
        self.gmod.usar_ant = usar_ap;
        self.gmod_prestar(true);
        if !pausa { if let Some(gm) = self.gmod.gm.as_mut() { gm.paso(dt as f64, &[]); gm.hud(); let t3 = Instant::now(); self.gmod.usable = gm.mirando_usable(); if usar_est != 0 { gm.usar_tecla(usar_est); } self.gmod.calc = gm.calc_vista(); self.gmod.mods.dib = gm.dibujar3d(dt as f64); self.gmod.ms_3d = t3.elapsed().as_secs_f32() * 1000.0; } }
        self.gmod_prestar(false);
        self.gmod_herramientas_sync();
        self.gmod_aplicar(m);
        self.gm_bucles_paso(dt, pausa);
        let t3 = Instant::now(); self.gm_modelos_paso(m); self.gmp_paso(m); self.gmod.ms_3d += t3.elapsed().as_secs_f32() * 1000.0;
        self.gmod.ms = t0.elapsed().as_secs_f32() * 1000.0; self.gmod.ms_prom = self.gmod.ms_prom * 0.95 + self.gmod.ms * 0.05;
    }
    /// el sonido de un addon listo para sonar (un .wav se decodifica; un MP3 u OGG va al disco para el decodificador del
    /// sistema): su clave en el sonido del juego
    fn gm_snd_registrar(&mut self, r: &str) -> String {
        let r = r.to_string(); let clave = format!("gm:{}", r);
        let ruta = if r.starts_with("sound/") { r.clone() } else { format!("sound/{}", r) };
        if !self.sonido.tiene(&clave) {
            let b = self.con_puente(|p| p.archivos.get(&ruta).cloned()).flatten();
            if let Some(b) = b {
                if let Some((v, hz)) = leer_wav(&b) { self.sonido.sintetico(&clave, || v, hz); }
                // (MP3 y OGG: al disco una vez y el decodificador del sistema los lee —en Android; en la compu, mudos—)
                else if let (Some(dir), Some(ext)) = (self.gmod.datos.clone(), ruta.rsplit_once('.').map(|x| x.1.to_string()).filter(|e| e == "mp3" || e == "ogg")) {
                    let d = dir.join("gm_sonidos"); let _ = std::fs::create_dir_all(&d);
                    let h = ruta.bytes().fold(0xcbf2_9ce4_8422_2325u64, |h, c| (h ^ c as u64).wrapping_mul(0x100_0000_01b3));
                    let f = d.join(format!("{h:016x}.{ext}"));
                    if !f.exists() { let _ = std::fs::write(&f, &b[..]); }
                    self.sonido.registrar_archivo(&clave, &f);
                }
            }
        }
        clave
    }
    /// los bucles de los addons (gmsnPaso): donde está su entidad, con su volumen, su tono y lo que lleva de fundido; se
    /// cortan los de una entidad que ya no está y los del jugador muerto. Con el juego en pausa se callan
    fn gm_bucles_paso(&mut self, dt: f32, pausa: bool) {
        self.gmod.t_snd += dt;
        if self.gmod.bucles.is_empty() || pausa { return; }
        let t = self.gmod.t_snd; let vivo = !self.muerto && self.jug.vida > 0.0;
        let gm = self.gmod.gm.as_ref(); let mut fuera = vec![]; let mut sonar = vec![];
        for (k, b) in &self.gmod.bucles {
            let p = match b.e { Some(id) if id >= 1.0 => match gm.and_then(|g| g.pos_ent(id)) { Some(p) => Some([p.x as f32, p.y as f32, p.z as f32]), None => { fuera.push(k.clone()); continue } }, _ => None };
            if b.e == Some(1.0) && !vivo { fuera.push(k.clone()); continue; }
            let f = b.fade.map(|(t0, d)| 1.0 - (t - t0) / d.max(0.01)).unwrap_or(1.0); if f <= 0.0 { fuera.push(k.clone()); continue; }
            sonar.push((format!("gmb:{k}"), b.clave.clone(), (b.vol * f).max(0.001), b.tono, b.ini, if b.e == Some(1.0) { None } else { p }));
        }
        for k in fuera { self.gmod.bucles.remove(&k); }
        for (k, c, v, tn, ini, p) in sonar { self.sonido.bucle_ex(&k, &c, v, tn, ini, p); }
    }
    /// el juego → los espejos del Lua
    fn gmod_copiar(&mut self, dt: f32) {
        let (wf, hf) = self.gmod.pantalla;
        let escala = (hf / 480.0).max(1.0); self.gmod.escala = escala;
        let ojos = self.ojos_ult; let fw = self.mira();
        let der = { let d = [fw[1] * 0.0 - fw[2] * 1.0, fw[2] * 0.0 - fw[0] * 0.0, fw[0] * 1.0 - fw[1] * 0.0]; let l = (d[0] * d[0] + d[2] * d[2]).sqrt().max(1e-6); [d[0] / l, 0.0, d[2] / l] };
        let arr = [der[1] * fw[2] - der[2] * fw[1], der[2] * fw[0] - der[0] * fw[2], der[0] * fw[1] - der[1] * fw[0]];
        let gm_i = self.gmod.arma;
        let vivo = !self.muerto && self.jug.vida > 0.0;
        let en = Entrada { ..self.entrada(wf, hf) };
        let (d1, d2) = (self.apretado(Boton::Disparo) && self.menu.is_none(), self.apretado(Boton::Disparo2) && self.menu.is_none());
        self.teclas_mod_paso();
        let (teclas_mod, in_mod) = self.teclas_mod_apretadas();
        let teclas: Vec<String> = [(Boton::Recargar, "KeyR"), (Boton::Usar, "KeyE"), (Boton::Saltar, "Space"), (Boton::Agachar, "ControlLeft")].iter().filter(|(b, _)| self.apretado(*b)).map(|(_, k)| k.to_string()).collect();
        let ui = self.menu.is_some() || self.ajustes.is_some() || self.gmod.panel;
        let (jug, armas_i, objs) = (&self.jug, self.armas.i, &self.objs);
        let fis = &self.fis;
        let cam_q = qcam(jug.yaw, jug.pitch);
        let tercera = self.camara_ef() != 0;
        let (huesos_jug, arma_mundo) = self.gm_huesos_jug();
        let fov = if self.fov_b > 0.0 { self.fov_b } else { self.aj.fov as f32 };
        let temblor = self.temblor;
        // (la cámara con que se dibujó el último cuadro: en tercera persona no son los ojos)
        let vista = if self.camara_ef() != 0 { Some(v3(self.jg.cam_ult)) } else { None };
        let Some(gm) = self.gmod.gm.as_ref() else { return };
        gm.anfitrion(|h| {
            let Some(p) = h.como_any().and_then(|a| a.downcast_mut::<Puente>()) else { return };
            p.dt = dt as f64; p.t += dt as f64; p.pantalla = ((wf / escala) as f64, (hf / escala) as f64); p.escala = escala;
            p.cmds.clear();
            let j = &mut p.jug;
            j.pos = v3(jug.pos); j.vel = v3(jug.vel); j.vivo = vivo; j.vida = jug.vida as f64; j.yaw = jug.yaw as f64; j.pitch = -jug.pitch as f64;
            j.medio = jug.medio as f64; j.radio = jug.radio as f64; j.ojo_alto = jug.ojo_alto as f64; j.suelo = jug.suelo; j.agachado = jug.agachado; j.noclip = jug.noclip;
            p.huesos_jug = huesos_jug; p.arma_mundo = arma_mundo;
            let j = &mut p.jug;
            j.tercera = tercera; j.ojo_pos = Some(v3(ojos)); j.vel_max = jug.vel_max as f64; j.salto = jug.salto as f64;
            let c = &mut p.cam;
            c.pos = v3(ojos); c.fwd = v3(fw); c.der = v3(der); c.arr = v3(arr); c.q = Quat::new(cam_q[0] as f64, cam_q[1] as f64, cam_q[2] as f64, cam_q[3] as f64); c.fov = fov as f64; c.temblor = temblor as f64; c.vista = vista;
            let e = &mut p.ent;
            e.disparo = d1; e.disparo2 = d2; e.teclas = teclas; e.teclas_mod = teclas_mod; e.in_mod = in_mod; e.correr = en.correr; e.saltar = en.saltar; e.agachar = en.agachar; e.x = en.x as f64; e.y = en.y as f64; e.ui_abierto = ui;
            // (las armas: las del juego y las de los addons)
            let mut lista: Vec<String> = ARMAS.iter().map(|a| a.n.to_string()).collect();
            lista.extend(p.gm_armas.iter().map(|a| a.0.clone()));
            p.armas.i = match gm_i { Some(k) => ARMAS.len() + k, None => armas_i };
            p.armas.lista = lista;
            // (los cuerpos de los objetos de los addons, de la física)
            p.de_fis.clear(); p.a_fis.clear();
            for (oid, c) in p.cuerpos.iter_mut() {
                c.cambios = 0;
                let Some(gid) = GM_OBJ.with(|m| m.borrow().get(oid).copied()) else { continue };
                let Some(o) = objs.iter().find(|o| o.id == gid) else { continue };
                if let Some(b) = o.cuerpo.and_then(|id| fis.cuerpo(id)) {
                    p.de_fis.insert(b.id, *oid); p.a_fis.insert(*oid, b.id);
                    c.pos = V3 { x: b.pos[0], y: b.pos[1], z: b.pos[2] }; c.q = Quat::new(b.q[0], b.q[1], b.q[2], b.q[3]); c.vel = V3 { x: b.vel[0], y: b.vel[1], z: b.vel[2] }; c.ang = V3 { x: b.ang[0], y: b.ang[1], z: b.ang[2] };
                    c.masa = b.masa; c.congelado = b.congelado; c.dormido = b.duerme; c.c = Some(v3(o.c));
                    let a = b.aabb(); c.aabb = [V3 { x: a[0], y: a[1], z: a[2] }, V3 { x: a[3], y: a[4], z: a[5] }];
                } else { c.pos = v3(o.pos); c.q = Quat::new(o.q[0] as f64, o.q[1] as f64, o.q[2] as f64, o.q[3] as f64); }
            }
        });
    }
    /// los espejos del Lua → el juego, y la cola de pedidos
    fn gmod_aplicar(&mut self, m: &mut Motor3d) {
        let Some(gm) = self.gmod.gm.as_ref() else { return };
        let (jug, cuerpos, pedidos, cmds, temblor, datos) = gm.anfitrion(|h| {
            let p = h.como_any().and_then(|a| a.downcast_mut::<Puente>()).unwrap();
            let datos = if p.datos_sucio { p.datos_sucio = false; Some(p.datos.clone()) } else { None };
            (p.jug.clone(), p.cuerpos.iter().filter(|(_, c)| c.cambios != 0).map(|(k, c)| (*k, c.clone())).collect::<Vec<_>>(), std::mem::take(&mut p.pedidos), std::mem::take(&mut p.cmds), p.cam.temblor, datos)
        });
        // (el jugador: lo que el Lua cambió)
        let j = &mut self.jug;
        let cam = |a: f64, b: f32| (a as f32 - b).abs() > 1e-5;
        if cam(jug.pos.x, j.pos[0]) || cam(jug.pos.y, j.pos[1]) || cam(jug.pos.z, j.pos[2]) { j.pos = f3(jug.pos); }
        if cam(jug.vel.x, j.vel[0]) || cam(jug.vel.y, j.vel[1]) || cam(jug.vel.z, j.vel[2]) { j.vel = f3(jug.vel); if jug.vel.y > 0.3 { j.suelo = false; } }
        if cam(jug.yaw, j.yaw) { j.yaw = jug.yaw as f32; }
        if cam(-jug.pitch, j.pitch) { j.pitch = -jug.pitch as f32; }
        if cam(jug.vida, j.vida) { j.vida = jug.vida as f32; }
        if cam(jug.vel_max, j.vel_max) { j.vel_max = jug.vel_max as f32; }
        if cam(jug.salto, j.salto) { j.salto = jug.salto as f32; }
        j.noclip = jug.noclip;
        if temblor as f32 > self.temblor + 1e-4 { self.temblor = temblor as f32; }
        // (los cuerpos)
        for (oid, c) in cuerpos {
            let Some(gid) = GM_OBJ.with(|x| x.borrow().get(&oid).copied()) else { continue };
            let Some(bid) = self.objs.iter().find(|o| o.id == gid).and_then(|o| o.cuerpo) else { continue };
            if let Some(b) = self.fis.cuerpo_mut(bid) {
                use jxgmod::*;
                if c.cambios & CUERPO_POS != 0 { b.pos = [c.pos.x, c.pos.y, c.pos.z]; }
                if c.cambios & CUERPO_Q != 0 { b.q = [c.q.x, c.q.y, c.q.z, c.q.w]; }
                if c.cambios & CUERPO_VEL != 0 { b.vel = [c.vel.x, c.vel.y, c.vel.z]; }
                if c.cambios & CUERPO_ANG != 0 { b.ang = [c.ang.x, c.ang.y, c.ang.z]; }
                if c.cambios & CUERPO_MASA != 0 && c.masa > 0.0 { let k = c.masa / b.masa.max(1e-9); b.masa = c.masa; b.inv_masa = 1.0 / c.masa; b.inv_i = [b.inv_i[0] / k, b.inv_i[1] / k, b.inv_i[2] / k]; }
                if c.cambios & CUERPO_CONGELADO != 0 { b.congelado = c.congelado; }
                if c.cambios & (CUERPO_DESPERTAR | CUERPO_POS | CUERPO_VEL) != 0 { b.despertar(); }
            }
        }
        if let (Some(d), Some(dir)) = (datos, self.datos.as_ref()) { let s: Vec<String> = d.iter().map(|(k, v)| format!("{}\t{}", k, v.replace('\n', "\\n"))).collect(); let _ = std::fs::write(dir.join("gmod_datos.txt"), s.join("\n")); }
        for pd in pedidos { self.gmod_pedido(m, pd); }
        self.gmod.hud_px = cmds;
    }
    fn gmod_pedido(&mut self, m: &mut Motor3d, pd: Pedido) {
        let clase = match &pd { Pedido::Crear(..) => "crear", Pedido::Borrar(..) => "borrar", Pedido::Sonido(..) => "sonido", Pedido::Bucle { .. } => "bucle", Pedido::Canal(..) => "canal", Pedido::DanarJugador(..) => "danar_jugador", Pedido::DanarObjeto(..) => "danar_objeto", Pedido::Matar => "matar", Pedido::Reaparecer => "reaparecer", Pedido::QuitarArmas => "quitar_armas", Pedido::Explosion(..) => "explosion",
            Pedido::Impacto(..) => "impacto", Pedido::ExplosionFx(..) => "explosion_fx", Pedido::Traza(..) => "traza", Pedido::Fogonazo => "fogonazo", Pedido::Particula(..) => "particula", Pedido::Sacudir(..) => "sacudir", Pedido::Aviso(..) => "aviso", Pedido::Arma(..) => "arma", Pedido::Textura(..) => "textura", Pedido::Anim(..) => "anim" };
        *self.gmod.cuenta.entry(clase).or_insert(0) += 1;
        let id_juego = |o: ObjId| GM_OBJ.with(|x| x.borrow().get(&o).copied());
        match pd {
            // (un modelo de los addons: se arma —si este cuadro ya armó mucho, en el que sigue— y se crea su objeto)
            Pedido::Crear(oid, pf) if pf.starts_with("gm:") => {
                let r = pf.trim_start_matches("gm:").to_string();
                if self.gmod.mods.modelos.contains_key(&r) || self.gmod.mods.ms_armar < 12.0 { self.gm_crear_pendiente(m, oid, &pf); } else { self.gmod.mods.crear.push((oid, pf.clone())); }
                if let Some(Some(md)) = self.gmod.mods.modelos.get(&r).cloned() { let c = md.caja; self.con_puente(|p| { p.cajas.insert(pf.clone(), ([c[0] as f64, c[1] as f64, c[2] as f64], [(c[3] - c[0]) as f64, (c[4] - c[1]) as f64, (c[5] - c[2]) as f64])); }); }
            }
            Pedido::Crear(oid, pf) => {
                let Some((pos, q, vel, cong)) = self.con_puente(|p| p.cuerpos.get(&oid).map(|c| (f3(c.pos), [c.q.x as f32, c.q.y as f32, c.q.z as f32, c.q.w as f32], f3(c.vel), c.congelado))).flatten() else { return };
                let aviso = self.aviso.take();
                match self.crear(m, &pf, pos, q, true, cong) {
                    Ok(Some(i)) => {
                        let o = &self.objs[i];
                        GM_OBJ.with(|x| x.borrow_mut().insert(oid, o.id));
                        if let Some(b) = o.cuerpo.and_then(|id| self.fis.cuerpo_mut(id)) { b.vel = [vel[0] as f64, vel[1] as f64, vel[2] as f64]; }
                    }
                    _ => { self.con_puente(|p| { p.cuerpos.remove(&oid); }); }
                }
                self.aviso = aviso;
            }
            Pedido::Borrar(oid) => {
                if let Some(gid) = GM_OBJ.with(|x| x.borrow_mut().remove(&oid)) { if let Some(i) = self.objs.iter().position(|o| o.id == gid) { self.borrar_obj(i); } }
            }
            Pedido::Sonido(r, pos, vol, tono) => { let clave = self.gm_snd_registrar(&r); self.sonido.tocar(&clave, vol, tono, pos); }
            Pedido::Bucle { k, r, e, vol, tono, ini, on, fundido, ca } => {
                if on {
                    if let Some(b) = self.gmod.bucles.get_mut(&k) { b.vol = vol; b.tono = tono; b.fade = None; }
                    else { let clave = self.gm_snd_registrar(&r); if self.gmod.bucles.len() >= 24 { if let Some(k0) = self.gmod.bucles.keys().next().cloned() { self.gmod.bucles.remove(&k0); } } self.gmod.bucles.insert(k, BucleGm { clave, e, vol, tono, ini, ca, fade: None }); }
                } else if let (Some(d), Some(b)) = (fundido, self.gmod.bucles.get_mut(&k)) { b.fade = Some((self.gmod.t_snd, d as f32)); }
                else { self.gmod.bucles.remove(&k); }
            }
            Pedido::Canal(e, ca) => { self.gmod.bucles.retain(|_, b| !(b.e == e && b.ca == ca)); }
            Pedido::DanarJugador(d) => self.danar_jugador(d),
            Pedido::DanarObjeto(oid, d) => { if let Some(i) = id_juego(oid).and_then(|g| self.objs.iter().position(|o| o.id == g)) { self.danar_objeto(i, d); } }
            Pedido::Matar => { self.jug.vida = 0.0; self.muerto = true; }
            Pedido::Reaparecer => { self.muerto = false; self.jug.aire = 12.0; self.gmod.muerto_t = 0.0; }
            Pedido::QuitarArmas => { if self.gmod.arma.is_some() { self.gmod.arma = None; let b = self.gmod.base; self.armas.elegir(&mut self.fis, b); } }
            Pedido::Explosion(p, r, mg, sin_fx) => { if !sin_fx { self.ef.explosion(p, (r / 4.0).clamp(0.3, 4.0), None); } self.explosion(p, r, mg); }
            Pedido::Impacto(p, n, cuerpo) => self.ef.impacto(p, n, if cuerpo { efx::Sup::Cuerpo } else { efx::Sup::Mundo }),
            Pedido::ExplosionFx(p) => self.ef.explosion(p, 1.0, None),
            Pedido::Traza(a, b) => {
                // (la trazadora sale de la punta del arma, no de los ojos)
                let a = self.vista.as_ref().filter(|_| self.camara_ef() == 0).and_then(|v| v.punta()).unwrap_or(a);
                self.ef.traza(a, b);
            }
            Pedido::Fogonazo => { let o = self.ojos_ult; let fw = self.mira(); let p = self.vista.as_ref().and_then(|v| v.punta()).unwrap_or([o[0] + fw[0] * 0.6, o[1] + fw[1] * 0.6 - 0.1, o[2] + fw[2] * 0.6]); self.ef.fogonazo(p); }
            Pedido::Particula(p, v, vida, tam, c, tipo, crece) => { self.ef.particula(p, v, vida, tam, c, tipo, crece); }
            Pedido::Sacudir(a) => self.temblor = self.temblor.max(a),
            Pedido::Aviso(s) => self.avisar(s),
            Pedido::Arma(n) => {
                if let Some(k) = self.con_puente(|p| p.gm_armas.iter().position(|a| a.0 == n)).flatten() {
                    let base = self.con_puente(|p| p.gm_armas[k].1.clone()).flatten();
                    let bi = base.and_then(|b| ARMAS.iter().position(|a| a.n == b)).or_else(|| ARMAS.iter().position(|a| a.n == "Pistol")).unwrap_or(0);
                    if self.armas.i != bi { self.armas.elegir(&mut self.fis, bi); self.armas.anim = Some(ARMAS[bi].sacar); }
                    self.gmod.arma = Some(k); self.gmod.base = bi;
                } else if let Some(k) = ARMAS.iter().position(|a| a.n == n) { self.gmod.arma = None; if self.armas.i != k { self.armas.elegir(&mut self.fis, k); } }
            }
            Pedido::Anim(c) => {
                if self.gmod.arma.is_none() { return; }
                let d = &ARMAS[self.gmod.base.min(ARMAS.len() - 1)];
                let clip = match c { "fuego" => d.fuego, "fuego2" => if d.fuego2.is_empty() { d.fuego } else { d.fuego2 }, "recarga" => d.recarga, "sacar" => d.sacar, _ => d.quieto };
                if !clip.is_empty() { self.armas.anim = Some(clip); }
            }
            Pedido::Textura(r0) => {
                // ("materials/x.vtf|clave": la textura de un .vmt, que el Lua pide por su clave)
                let (r, clave_vtf) = match r0.split_once('|') { Some((a, b)) => (a.to_string(), Some(b.to_string())), None => (r0.clone(), None) };
                if self.con_puente(|p| p.mats.contains_key(clave_vtf.as_ref().unwrap_or(&r))).unwrap_or(true) { return; }
                let b = self.con_puente(|p| p.archivos.get(&r).cloned()).flatten();
                let k = self.gmod.texs.len() as i64; let id = TEX_GMOD - k;
                let img = if r.ends_with(".vtf") { b.and_then(|b| jxgmod::formatos::vtf(&b, 512).ok().map(|t| (t.w as u32, t.h as u32, jxgmod::formatos::vtf_rgba(&t)))) } else { b.and_then(|b| png_rgba(b.to_vec())) };
                let Some((w, h, px)) = img else { return };
                if let Some(c) = &clave_vtf { let c = c.clone(); self.con_puente(|p| { p.mats.insert(c, (id, w, h, true)); }); }
                let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![], texs: vec![Tex { id, n: format!("gm{}", k), w, h, a: 1, o: 0 }], lms: vec![], items: vec![], agua: None, cielo: None };
                let ok = unsafe { m.cargar(&Escena { c: cab, datos: px }) }.is_ok();
                self.gmod.texs.push(id);
                let clave = r.trim_start_matches("materials/").to_string();
                self.con_puente(|p| { p.mats.insert(r.clone(), (id, w, h, ok)); p.mats.insert(clave.clone(), (id, w, h, ok)); p.mats.insert(clave.trim_end_matches(".png").to_string(), (id, w, h, ok)); });
            }
        }
    }
    /// el tamaño de la pantalla para el Lua (lo pone el HUD de cada cuadro)
    pub fn gmod_tam(&mut self, w: f32, h: f32) { self.gmod.pantalla = (w, h); }
    /// la HUD de los addons (lo que dibujaron HUDPaint y el DrawHUD del arma) y el panel «Mods»: los vértices de la
    /// interfaz en `u` (con las letras) y los de las imágenes de los materiales aparte (su textura)
    pub fn gmod_hud(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32, t: f32) -> Vec<(i64, Vec<f32>)> {
        let mut extra: Vec<(i64, Vec<f32>)> = vec![];
        let k = self.gmod.escala.max(1e-3);
        let blanco = { let mut v = vec![]; l.rect(&mut v, 0.0, 0.0, 1.0, 1.0, [1.0; 4]); (v[2], v[3]) };
        let tri = |u: &mut Vec<f32>, p: [(f32, f32); 3], c: [f32; 4]| for (x, y) in p { u.extend_from_slice(&[x, y, blanco.0, blanco.1, c[0], c[1], c[2], c[3]]); };
        let col = |c: &jxgmod::Rgba| [c[0] as f32 / 255.0, c[1] as f32 / 255.0, c[2] as f32 / 255.0, (c[3] as f32).clamp(0.0, 1.0)];
        let mut pila: Vec<(Af, Option<[f32; 4]>)> = vec![];
        let mut m: Af = [k, 0.0, 0.0, k, 0.0, 0.0];
        // (el recorte de los paneles de los addons —Cmd2D::Recorte—, en píxeles de la pantalla)
        let mut recorte: Option<[f32; 4]> = None;
        let mut camino: Vec<Vec<(f32, f32)>> = vec![];
        let quad = |u: &mut Vec<f32>, m: &Af, x: f32, y: f32, w: f32, h: f32, c: [f32; 4]| {
            let (a, b, cc, d) = (af_mul(m, x, y), af_mul(m, x + w, y), af_mul(m, x + w, y + h), af_mul(m, x, y + h));
            tri(u, [a, b, cc], c); tri(u, [a, cc, d], c);
        };
        let linea = |u: &mut Vec<f32>, a: (f32, f32), b: (f32, f32), ancho: f32, c: [f32; 4]| {
            let (dx, dy) = (b.0 - a.0, b.1 - a.1); let l = (dx * dx + dy * dy).sqrt().max(1e-4); let (nx, ny) = (-dy / l * ancho / 2.0, dx / l * ancho / 2.0);
            let (p0, p1, p2, p3) = ((a.0 + nx, a.1 + ny), (b.0 + nx, b.1 + ny), (b.0 - nx, b.1 - ny), (a.0 - nx, a.1 - ny));
            tri(u, [p0, p1, p2], c); tri(u, [p0, p2, p3], c);
        };
        for c in &self.gmod.hud_px {
            let u0 = u.len(); let e0: Vec<usize> = extra.iter().map(|e| e.1.len()).collect();
            match c {
                Cmd2D::Guardar => pila.push((m, recorte)),
                Cmd2D::Restaurar => { if let Some((x, r)) = pila.pop() { m = x; recorte = r; } }
                Cmd2D::Recorte { x, y, w, h } => { recorte = Some([*x as f32 * k, *y as f32 * k, (*x + *w) as f32 * k, (*y + *h) as f32 * k]); }
                Cmd2D::Mover(x, y) => { let (a, b) = (*x as f32, *y as f32); m[4] += m[0] * a + m[2] * b; m[5] += m[1] * a + m[3] * b; }
                Cmd2D::Rotar(r) => { let (s, co) = ((*r as f32).sin(), (*r as f32).cos()); let (a, b, cc, d) = (m[0], m[1], m[2], m[3]); m[0] = a * co + cc * s; m[1] = b * co + d * s; m[2] = cc * co - a * s; m[3] = d * co - b * s; }
                Cmd2D::Rect { x, y, w, h, color, .. } => quad(u, &m, *x as f32, *y as f32, *w as f32, *h as f32, col(color)),
                Cmd2D::Borde { x, y, w, h, color, ancho } => {
                    let (x, y, w, h, a) = (*x as f32, *y as f32, *w as f32, *h as f32, (*ancho as f32).max(1.0)); let cc = col(color);
                    let ps = [af_mul(&m, x, y), af_mul(&m, x + w, y), af_mul(&m, x + w, y + h), af_mul(&m, x, y + h)];
                    for i in 0..4 { linea(u, ps[i], ps[(i + 1) % 4], a * k, cc); }
                }
                Cmd2D::Texto { s, x, y, fuente, color, .. } | Cmd2D::TextoBorde { s, x, y, fuente, color, .. } => {
                    let tam = css_px(fuente) * k;
                    let (px, py) = af_mul(&m, *x as f32, *y as f32);
                    let cc = col(color);
                    if matches!(c, Cmd2D::TextoBorde { .. }) { for (dx, dy) in [(-1.0, 0.0), (1.0, 0.0), (0.0, -1.0), (0.0, 1.0)] { l.texto(u, px + dx, py + dy, tam, cc, s); } }
                    else { l.texto(u, px, py, tam, cc, s); }
                }
                Cmd2D::Camino => camino.clear(),
                Cmd2D::Ir(x, y) => camino.push(vec![af_mul(&m, *x as f32, *y as f32)]),
                Cmd2D::Linea(x, y) => { let p = af_mul(&m, *x as f32, *y as f32); match camino.last_mut() { Some(s) => s.push(p), None => camino.push(vec![p]) } }
                Cmd2D::Curva(cx, cy, x, y) => {
                    let (c1, p2) = (af_mul(&m, *cx as f32, *cy as f32), af_mul(&m, *x as f32, *y as f32));
                    if let Some(s) = camino.last_mut() { let p0 = *s.last().unwrap(); for i in 1..=6 { let t = i as f32 / 6.0; let a = (1.0 - t) * (1.0 - t); let b = 2.0 * (1.0 - t) * t; let d = t * t; s.push((a * p0.0 + b * c1.0 + d * p2.0, a * p0.1 + b * c1.1 + d * p2.1)); } }
                }
                Cmd2D::Arco(x, y, r) => { let mut s = vec![]; for i in 0..=32 { let a = i as f32 / 32.0 * std::f32::consts::TAU; s.push(af_mul(&m, *x as f32 + *r as f32 * a.cos(), *y as f32 + *r as f32 * a.sin())); } camino.push(s); }
                Cmd2D::Cerrar => { if let Some(s) = camino.last_mut() { if let Some(&p) = s.first() { s.push(p); } } }
                Cmd2D::Llenar(c) => { let cc = col(c); for s in &camino { if s.len() >= 3 { for i in 1..s.len() - 1 { tri(u, [s[0], s[i], s[i + 1]], cc); } } } }
                Cmd2D::Trazar(c, w) => { let cc = col(c); for s in &camino { for i in 1..s.len() { linea(u, s[i - 1], s[i], (*w as f32).max(1.0) * k, cc); } } }
                Cmd2D::Imagen { material, x, y, w, h, alfa, .. } => {
                    let r = material.to_lowercase();
                    let Some((id, ..)) = self.con_puente(|p| p.mats.get(&r).or_else(|| p.mats.get(&format!("materials/{}", r))).copied()).flatten() else { continue };
                    let g = match extra.iter_mut().find(|e| e.0 == id) { Some(g) => g, None => { extra.push((id, vec![])); extra.last_mut().unwrap() } };
                    let (x, y, w, h) = (*x as f32, *y as f32, *w as f32, *h as f32);
                    let ps = [(af_mul(&m, x, y), 0.0, 0.0), (af_mul(&m, x + w, y), 1.0, 0.0), (af_mul(&m, x + w, y + h), 1.0, 1.0), (af_mul(&m, x, y + h), 0.0, 1.0)];
                    for i in [0, 1, 2, 0, 2, 3] { let ((px, py), uu, vv) = ps[i]; g.1.extend_from_slice(&[px, py, uu, vv, 1.0, 1.0, 1.0, *alfa as f32]); }
                }
            }
            if let Some(r) = recorte {
                if u.len() > u0 { recortar_tris(u, u0, r); }
                for (i, e) in extra.iter_mut().enumerate() { let d = e0.get(i).copied().unwrap_or(0); if e.1.len() > d { recortar_tris(&mut e.1, d, r); } }
            }
        }
        if self.gmod.panel { self.gmod_menu_iconos(wf, hf, &mut extra); }
        // (el arma de un addon en la mano: su nombre arriba de la barra)
        if let Some(n) = self.gmod.arma.and_then(|kk| self.con_puente(|p| p.gm_armas.get(kk).map(|a| a.2.clone())).flatten()) {
            let tt = t * 0.75; let an = l.ancho(tt, &n);
            l.caja(u, (wf - an) / 2.0 - tt * 0.6, hf - tt * 2.6, an + tt * 1.2, tt * 1.6, tt * 0.4, [0.0, 0.0, 0.0, 0.45]);
            l.texto(u, (wf - an) / 2.0, hf - tt * 2.35, tt, [1.0, 0.85, 0.3, 1.0], &n);
        }
        // (transformado: la barra de poder y las habilidades: gmod_pill.rs)
        self.pill_hud(l, u, wf, hf);
        extra
    }
    /// el panel «Mods» (encima de todo, como el de salas)
    pub fn gmod_panel(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32, t: f32) { if self.gmod.panel { self.gmod_dibujar_panel(l, u, wf, hf, t); } }
    /// se eligió un arma del juego en la barra: se guarda la del addon
    pub fn gmod_guardar_arma(&mut self) { self.gmod.arma = None; }
}

thread_local! {
    /// el objeto del juego (Obj.id) de cada objeto de los addons
    static GM_OBJ: std::cell::RefCell<HashMap<ObjId, u32>> = std::cell::RefCell::new(HashMap::new());
}

// ---------------- el panel «Mods» ----------------
/// lo que se toca en el panel
#[derive(Clone, Debug, PartialEq)]
pub enum BtnMods { Prender(usize), Arma(usize, usize), Ent(usize, usize), Bajar(usize), Tienda, Cerrar }
/// dónde va el panel y cada botón (con la lista bajada `scroll`)
pub fn panel_mods_geo(w: f32, h: f32, en: &EnGmod) -> ([f32; 4], Vec<(BtnMods, [f32; 4])>) {
    let (pw, ph) = (w * 0.86, h * 0.78); let (x0, y0) = ((w - pw) / 2.0, h * 0.14);
    let fila = h * 0.075; let chip = h * 0.062;
    let mut v = vec![(BtnMods::Cerrar, [x0 + pw - fila * 1.1, y0 + fila * 0.15, fila * 0.9, fila * 0.8]), (BtnMods::Tienda, [x0 + pw - fila * 4.6, y0 + fila * 0.15, fila * 3.3, fila * 0.8])];
    let mut y = y0 + fila * 1.3 - en.scroll;
    for (i, a) in en.addons.iter().enumerate() {
        v.push((BtnMods::Prender(i), [x0 + pw - fila * 3.2, y, fila * 2.8, fila * 0.8]));
        y += fila;
        let mut x = x0 + fila * 0.4;
        for (k, (_, c)) in a.sweps.iter().enumerate() { let cw = ((c.chars().count() + 6) as f32 * chip * 0.32 + chip).min(pw * 0.45); if x + cw > x0 + pw - fila * 0.4 { x = x0 + fila * 0.4; y += chip * 1.15; } v.push((BtnMods::Arma(i, k), [x, y, cw, chip])); x += cw + chip * 0.2; }
        for (k, (_, c)) in a.sents.iter().enumerate() { let cw = ((c.chars().count() + 7) as f32 * chip * 0.32 + chip).min(pw * 0.45); if x + cw > x0 + pw - fila * 0.4 { x = x0 + fila * 0.4; y += chip * 1.15; } v.push((BtnMods::Ent(i, k), [x, y, cw, chip])); x += cw + chip * 0.2; }
        if !a.sweps.is_empty() || !a.sents.is_empty() { y += chip * 1.3; }
    }
    if !en.tienda.is_empty() { y += fila * 0.6; for (k, _) in en.tienda.iter().enumerate() { v.push((BtnMods::Bajar(k), [x0 + pw - fila * 3.2, y, fila * 2.8, fila * 0.8])); y += fila; } }
    (([x0, y0, pw, ph]), v.into_iter().filter(|(b, r)| matches!(b, BtnMods::Cerrar | BtnMods::Tienda) || (r[1] >= y0 + fila && r[1] + r[3] <= y0 + ph)).collect())
}

impl Juego {
    /// abrir (o cerrar) el panel «Mods»
    pub fn gmod_abrir(&mut self) { self.gmod.panel = !self.gmod.panel; self.gmod.scroll = 0.0; if self.gmod.panel && self.gmod.addons.is_empty() { self.gmod.buscar(); } }
    /// arrastrar en el panel (baja la lista)
    pub fn gmod_mueve(&mut self, dy: f32) { if self.gmod.menu.tab != gmod_menu::TAB_ADDONS { self.gmod.menu.scroll = (self.gmod.menu.scroll - dy).max(0.0); } else { self.gmod.scroll = (self.gmod.scroll - dy).max(0.0); } }
    /// un toque en el panel; true si lo tomó
    pub fn gmod_toque(&mut self, x: f32, y: f32, w: f32, h: f32) -> bool {
        if !self.gmod.panel { return false; }
        // (las pestañas y lo del menú de GMod; en Addons, lo de siempre)
        let tab = gmod_menu::menu_geo(w, h, &self.gmod.menu).1.into_iter().any(|(b, r)| matches!(b, gmod_menu::BtnMenu::Tab(_) | gmod_menu::BtnMenu::Cerrar) && x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]);
        if tab || self.gmod.menu.tab != gmod_menu::TAB_ADDONS { return self.gmod_menu_toque(x, y, w, h); }
        let (_, bs) = panel_mods_geo(w, h, &self.gmod);
        let Some(b) = bs.into_iter().find(|(_, r)| x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]).map(|x| x.0) else { return true };
        match b {
            BtnMods::Cerrar => self.gmod.panel = false,
            BtnMods::Prender(i) => { let a = &mut self.gmod.addons[i]; a.prendido = !a.prendido; self.gmod.guardar_apagados(); self.gmod_reiniciar(); }
            BtnMods::Arma(i, k) => { if let Some(c) = self.gmod.addons[i].sweps.get(k).map(|x| x.0.clone()) { self.gmod_poner(&format!("gmswep:{}", c)); self.gmod.panel = false; } }
            BtnMods::Ent(i, k) => { if let Some(c) = self.gmod.addons[i].sents.get(k).map(|x| x.0.clone()) { self.gmod_poner(&format!("gment:{}", c)); self.gmod.panel = false; } }
            BtnMods::Tienda => self.gmod_tienda_pedir(),
            BtnMods::Bajar(k) => self.gmod_bajar(k),
        }
        true
    }
    /// poner algo de un addon como desde el menú de GMod: "gmswep:<clase>" (el arma a la mano) o "gment:<clase>"
    pub fn gmod_poner(&mut self, it: &str) {
        if self.gmod.gm.is_none() { return; }
        self.gmod_prestar(true);
        let ok = self.gmod.gm.as_mut().map(|g| g.spawn_menu(it)).unwrap_or(false);
        self.gmod_prestar(false);
        if !ok { self.avisar(format!("No se pudo poner {}", it.split(':').nth(1).unwrap_or(it))); }
    }
    /// lo que se puede poner de los addons (para el menú de objetos): (addon, [(item, nombre)])
    pub fn gmod_items_menu(&self) -> Vec<(String, Vec<(String, String)>)> {
        self.gmod.addons.iter().filter(|a| a.prendido).map(|a| (a.nombre.clone(), a.sweps.iter().map(|(c, n)| (format!("gmswep:{}", c), n.clone())).chain(a.sents.iter().map(|(c, n)| (format!("gment:{}", c), n.clone()))).collect())).collect()
    }
    fn gmod_dibujar_panel(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32, t: f32) {
        // (el menú de GMod: Spawnlists, Weapons, Entities, NPCs, Vehicles; en Addons, el panel de siempre debajo de las pestañas)
        if self.gmod.menu.tab != gmod_menu::TAB_ADDONS { self.gmod_menu_dibujar(l, u, wf, hf, t); return; }
        self.gmod_dibujar_addons(l, u, wf, hf, t); self.gmod_menu_dibujar(l, u, wf, hf, t);
    }
    fn gmod_dibujar_addons(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32, t: f32) {
        let (c, bs) = panel_mods_geo(wf, hf, &self.gmod);
        let fila = hf * 0.075; let bl = [1.0, 1.0, 1.0, 1.0];
        l.caja(u, c[0], c[1], c[2], c[3], hf * 0.02, [0.06, 0.07, 0.09, 0.94]);
        l.texto(u, c[0] + fila * 0.4, c[1] + fila * 0.3, t, bl, &format!("Mods de GMod · {} · Lua {:.2} ms", self.gmod.addons.len(), self.gmod.ms_prom));
        if self.gmod.addons.is_empty() { l.texto(u, c[0] + fila * 0.4, c[1] + fila * 1.5, t * 0.7, [1.0, 1.0, 1.0, 0.7], "Poné archivos .gma o carpetas de addons en la carpeta addons/ (o bajalos de la Tienda)"); }
        let mut y = c[1] + fila * 1.3 - self.gmod.scroll;
        for a in &self.gmod.addons {
            if y >= c[1] + fila && y + fila <= c[1] + c[3] { l.texto(u, c[0] + fila * 0.4, y + fila * 0.15, t * 0.8, if a.prendido { bl } else { [1.0, 1.0, 1.0, 0.45] }, &format!("{}{}", a.nombre, if a.errores > 0 { format!("  ({} errores)", a.errores) } else { String::new() })); }
            y += fila;
            let n = a.sweps.len() + a.sents.len();
            if n > 0 { y += hf * 0.062 * 1.3 * ((n as f32 * 0.25).ceil().max(1.0)); }
        }
        for (b, r) in &bs {
            let (txt, fondo): (String, [f32; 4]) = match b {
                BtnMods::Cerrar => ("×".into(), [0.4, 0.1, 0.1, 0.9]),
                BtnMods::Tienda => (if self.gmod.tienda_pedida && self.gmod.tienda.is_empty() { "Buscando…".into() } else { "Tienda".into() }, [0.15, 0.35, 0.6, 0.9]),
                BtnMods::Prender(i) => (if self.gmod.addons[*i].prendido { "Prendido".into() } else { "Apagado".into() }, if self.gmod.addons[*i].prendido { [0.15, 0.5, 0.2, 0.9] } else { [0.3, 0.3, 0.3, 0.9] }),
                BtnMods::Arma(i, k) => (format!("Arma: {}", self.gmod.addons[*i].sweps[*k].1), [0.55, 0.42, 0.1, 0.9]),
                BtnMods::Ent(i, k) => (format!("Poner: {}", self.gmod.addons[*i].sents[*k].1), [0.15, 0.3, 0.55, 0.9]),
                BtnMods::Bajar(k) => (self.gmod.tienda[*k].estado.clone(), [0.15, 0.35, 0.6, 0.9]),
            };
            l.caja(u, r[0], r[1], r[2], r[3], r[3] * 0.25, fondo);
            let mut ts = r[3] * 0.55; while l.ancho(ts, &txt) > r[2] - 6.0 && ts > 6.0 { ts *= 0.9; }
            l.texto(u, r[0] + (r[2] - l.ancho(ts, &txt)) / 2.0, r[1] + (r[3] - ts) / 2.0, ts, bl, &txt);
            if let BtnMods::Bajar(k) = b { l.texto(u, c[0] + fila * 0.4, r[1] + r[3] * 0.2, t * 0.7, bl, &self.gmod.tienda[*k].titulo); }
        }
    }
}

// ---------------- la tienda (gmod_tienda.js: buscar los populares y bajar el .gma) ----------------
impl Juego {
    pub(crate) fn gmod_http_bin(&self) -> Option<HttpBin> {
        if let Some(h) = &self.gmod.http_bin { return Some(h.clone()); }
        // (sin el binario, el de texto de la red: sirve para la lista, no para los .gma)
        let h = self.en_red.puente.as_ref().and_then(|p| p.http.clone())?;
        Some(Arc::new(move |u: &str| h("GET", u, &[], None).map(|(c, s)| (c, s.into_bytes()))))
    }
    /// pedir la lista de los populares
    pub fn gmod_tienda_pedir(&mut self) {
        let Some(h) = self.gmod_http_bin() else { self.avisar("Sin conexión para la tienda".into()); return };
        self.gmod.tienda_pedida = true;
        // (los destacados, ya: no esperan a la lista)
        for (id, t, mb) in DESTACADOS { if !self.gmod.tienda.iter().any(|x| x.id == id) { let ya = self.gmod.addons.iter().any(|a| a.ruta.to_string_lossy().contains(id)); self.gmod.tienda.push(ItemTienda { id: id.into(), titulo: format!("{t} ({mb:.0} MB)"), estado: if ya { "Instalado".into() } else { "Bajar".into() }, mb, pipe: true, prog: None }); } }
        let tx = self.gmod.tx.clone();
        std::thread::spawn(move || { let r = h(&format!("{}gmod/buscar?q=&tag=&orden=subs&p=1", TIENDA_URL)).and_then(|(c, b)| if c == 200 { Ok(b) } else { Err(format!("HTTP {c}")) }); let _ = tx.send(("lista".into(), r)); });
    }
    /// bajar uno de la tienda (va a datos/addons/<id>.gma y se monta)
    pub fn gmod_bajar(&mut self, k: usize) {
        let Some(it) = self.gmod.tienda.get_mut(k) else { return };
        if it.estado != "Bajar" { return; }
        let Some(h) = self.gmod.http_bin.clone() else { it.estado = "Sin HTTP".into(); return };
        it.estado = "Bajando…".into();
        let (tx, id) = (self.gmod.tx.clone(), it.id.clone());
        if it.pipe {
            // (SteamPipe: los pedazos de a 6 hilos, directo al CDN de Steam, y el .gma se escribe en addons/ a medida que llegan)
            let Some(dir) = self.gmod.datos.as_ref().map(|d| d.join("addons")) else { it.estado = "Sin carpeta".into(); return };
            let _ = std::fs::create_dir_all(&dir); let prog = Arc::new(crate::steampipe::Progreso::default()); it.prog = Some(prog.clone());
            std::thread::spawn(move || { let r = crate::steampipe::bajar(h, TIENDA_URL, &id, &dir.join(format!("{id}.gma")), true, prog).map(|_| vec![]); let _ = tx.send((format!("pipe:{}", id), r)); });
            return;
        }
        std::thread::spawn(move || { let r = h(&format!("{}gmod/archivo/{}", TIENDA_URL, id)).and_then(|(c, b)| if c == 200 { Ok(b) } else { Err(format!("HTTP {c}")) }); let _ = tx.send((format!("gma:{}", id), r)); });
    }
    pub(crate) fn gmod_tienda_paso(&mut self) {
        self.base_addons_paso();
        // (cómo van las bajadas por SteamPipe)
        for it in self.gmod.tienda.iter_mut() { if let Some(p) = &it.prog { let (h, t) = (p.hecho.load(std::sync::atomic::Ordering::Relaxed), p.total.load(std::sync::atomic::Ordering::Relaxed)); if it.estado.starts_with("Bajando") && t > 0 { it.estado = format!("Bajando {}%", h * 100 / t); } } }
        while let Ok((k, r)) = self.gmod.rx.try_recv() {
            if let Some(g) = k.strip_prefix("ws:") { self.ws_respuesta(g, r); continue; }
            if k.starts_with("req:") { self.ws_requeridos(r); continue; }
            if k == "reqdet" { self.ws_requeridos_bajar(r); continue; }
            if let Some(id) = k.strip_prefix("wsgif:") { if let Ok(b) = r { self.ws_hoja(id, &b); } continue; }
            if let Some(id) = k.strip_prefix("wsimg:") { if let Ok(b) = r { if b.len() > 8 { let w = u32::from_le_bytes(b[0..4].try_into().unwrap()); let h = u32::from_le_bytes(b[4..8].try_into().unwrap()); if (w * h * 4) as usize == b.len() - 8 { self.ws_guardar_foto(&format!("ws:{id}"), w, h, b[8..].to_vec()); } } } continue; }
            if k == "lista" {
                match r.ok().and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok()) {
                    Some(v) => {
                        let items = v["items"].as_array().cloned().unwrap_or_default();
                        // (todos: los que no vienen como archivo directo, por SteamPipe; después de los destacados)
                        let nuevos: Vec<ItemTienda> = items.iter().take(40).filter_map(|x| { let id = x["id"].as_str().map(String::from).or_else(|| x["id"].as_u64().map(|n| n.to_string()))?; Some(ItemTienda { id, titulo: format!("{} ({:.1} MB)", x["t"].as_str().unwrap_or("?"), x["mb"].as_f64().unwrap_or(0.0)), estado: "Bajar".into(), mb: x["mb"].as_f64().unwrap_or(0.0) as f32, pipe: !x["dir"].as_bool().unwrap_or(false), prog: None }) }).collect();
                        for n in nuevos { if !self.gmod.tienda.iter().any(|x| x.id == n.id) { self.gmod.tienda.push(n); } }
                        if self.gmod.tienda.is_empty() { self.avisar("La tienda no trajo nada".into()); }
                    }
                    None => self.avisar("No se pudo leer la tienda".into()),
                }
                self.gmod.tienda_pedida = false;
            } else if let Some(n) = k.strip_prefix("bugs:") {
                // (lo publicado en Bugs y sugerencias)
                self.bugs_llegaron(n.parse().unwrap_or(0), r);
            } else if let Some(c) = k.strip_prefix("wsmfoto:") {
                // (la foto del mapa de inicio todavía sin bajar, para Partida nueva)
                if let Some(rg) = r.ok().and_then(|b| ws_foto_rgba(&b, 512)) { let u = |i: usize| u32::from_le_bytes([rg[i], rg[i + 1], rg[i + 2], rg[i + 3]]); let k = format!("wsm:{c}"); self.ini_poner_foto(&k, u(0), u(4), rg[8..].to_vec()); }
            } else if let Some(id) = k.strip_prefix("pipe:") {
                let id = id.to_string(); let est = match r { Ok(_) => { self.gmod.buscar(); "Instalado".to_string() } Err(e) => e };
                if let Some(it) = self.gmod.tienda.iter_mut().find(|x| x.id == id) { it.estado = est; it.prog = None; }
            } else if let Some(id) = k.strip_prefix("gma:") {
                let id = id.to_string();
                // (lo de Steam viene en LZMA)
                let r = r.and_then(|b| if b.starts_with(b"GMAD") { Ok(b) } else { lzma(&b) });
                let est = match r {
                    Ok(b) if b.starts_with(b"GMAD") => {
                        match self.gmod.datos.as_ref().map(|d| d.join("addons")) {
                            Some(dir) => { let _ = std::fs::create_dir_all(&dir); let ruta = dir.join(format!("{}.gma", id)); if std::fs::write(&ruta, &b).is_ok() { self.gmod.buscar(); "Instalado".to_string() } else { "No se guardó".into() } }
                            None => "Sin carpeta".into(),
                        }
                    }
                    Ok(_) => "No es un .gma".into(),
                    Err(e) => e,
                };
                if let Some(it) = self.gmod.tienda.iter_mut().find(|x| x.id == id) { it.estado = est; }
            }
        }
    }
}

// ---------------- LZMA (los .gma de Steam vienen comprimidos: GMF.lzma de gmod_formatos.js) ----------------
/// descomprime un LZMA «alone» (13 bytes de cabecera: propiedades, diccionario, tamaño)
pub fn lzma(src: &[u8]) -> Result<Vec<u8>, String> {
    if src.len() < 18 { return Err("lzma: corto".into()); }
    let p0 = src[0] as u32;
    if p0 >= 225 { return Err("lzma: propiedades malas".into()); }
    let (lc, lp, pb) = (p0 % 9, (p0 / 9) % 5, p0 / 45);
    let tam64 = u64::from_le_bytes(src[5..13].try_into().unwrap());
    let sabe = tam64 != u64::MAX;
    if sabe && tam64 > 1_500_000_000 { return Err("lzma: demasiado grande".into()); }
    let tam = tam64 as usize;
    let mut out: Vec<u8> = Vec::with_capacity(if sabe { tam } else { src.len() * 4 });
    let mut ip = 14usize;
    let (mut range, mut code) = (0xffff_ffffu32, 0u32);
    for _ in 0..4 { code = (code << 8) | src.get(ip).copied().unwrap_or(0) as u32; ip += 1; }
    let p = |n: usize| vec![1024u16; n];
    let (mut lit, mut is_match, mut is_rep, mut g0, mut g1, mut g2, mut r0l) = (p(0x300 << (lc + lp)), p(12 << 4), p(12), p(12), p(12), p(12), p(12 << 4));
    let (mut pos_slot, mut pos_dec, mut align) = (p(4 << 6), p(115), p(16));
    let mut len_d = [p(2), p(16 << 3), p(16 << 3), p(256)];
    let mut rep_d = [p(2), p(16 << 3), p(16 << 3), p(256)];
    struct Rango<'a> { range: &'a mut u32, code: &'a mut u32, ip: &'a mut usize, src: &'a [u8] }
    impl Rango<'_> {
        fn norm(&mut self) { if *self.range < 16_777_216 { *self.range <<= 8; *self.code = (*self.code << 8) | self.src.get(*self.ip).copied().unwrap_or(0) as u32; *self.ip += 1; } }
        fn bit(&mut self, pr: &mut [u16], i: usize) -> u32 {
            let v = pr[i] as u32; let b = (*self.range >> 11) * v;
            let s = if *self.code < b { pr[i] = (v + ((2048 - v) >> 5)) as u16; *self.range = b; 0 } else { pr[i] = (v - (v >> 5)) as u16; *self.code -= b; *self.range -= b; 1 };
            self.norm(); s
        }
        fn arbol(&mut self, pr: &mut [u16], base: usize, n: u32) -> u32 { let mut m = 1usize; for _ in 0..n { m = (m << 1) + self.bit(pr, base + m) as usize; } m as u32 - (1 << n) }
        fn arbol_inv(&mut self, pr: &mut [u16], base: usize, n: u32) -> u32 { let (mut m, mut s) = (1usize, 0u32); for i in 0..n { let b = self.bit(pr, base + m); m = (m << 1) + b as usize; s |= b << i; } s }
        fn directos(&mut self, mut n: u32) -> u32 { let mut r = 0u32; while n > 0 { n -= 1; *self.range >>= 1; let mut b = 0; if *self.code >= *self.range { *self.code -= *self.range; b = 1; } r = (r << 1) | b; self.norm(); } r }
        fn largo(&mut self, l: &mut [Vec<u16>; 4], ps: usize) -> u32 {
            if self.bit(&mut l[0], 0) == 0 { return self.arbol(&mut l[1], ps << 3, 3); }
            if self.bit(&mut l[0], 1) == 0 { return 8 + self.arbol(&mut l[2], ps << 3, 3); }
            16 + self.arbol(&mut l[3], 0, 8)
        }
    }
    let mut rc = Rango { range: &mut range, code: &mut code, ip: &mut ip, src };
    let (mut st, mut r0, mut r1, mut r2, mut r3) = (0usize, 0u32, 0u32, 0u32, 0u32);
    let (mpb, mlp) = ((1usize << pb) - 1, (1usize << lp) - 1);
    loop {
        if sabe && out.len() >= tam { break; }
        if *rc.ip > src.len() + 8 { if sabe { return Err("lzma: cortado".into()); } break; }
        let op = out.len();
        let ps = op & mpb;
        if rc.bit(&mut is_match, (st << 4) + ps) == 0 {
            let prev = if op > 0 { out[op - 1] as usize } else { 0 };
            let base = 0x300 * (((op & mlp) << lc) + (prev >> (8 - lc)));
            let mut s = 1usize;
            if st >= 7 {
                let mut mb = out[op - r0 as usize - 1] as usize;
                loop { let m = (mb >> 7) & 1; mb <<= 1; let b = rc.bit(&mut lit, base + ((1 + m) << 8) + s) as usize; s = (s << 1) | b; if m != b || s >= 0x100 { break; } }
            }
            while s < 0x100 { s = (s << 1) | rc.bit(&mut lit, base + s) as usize; }
            out.push((s - 0x100) as u8);
            st = if st < 4 { 0 } else if st < 10 { st - 3 } else { st - 6 };
            continue;
        }
        let len;
        if rc.bit(&mut is_rep, st) == 1 {
            if op == 0 { return Err("lzma: datos dañados".into()); }
            if rc.bit(&mut g0, st) == 0 {
                if rc.bit(&mut r0l, (st << 4) + ps) == 0 { st = if st < 7 { 9 } else { 11 }; let c = out[op - r0 as usize - 1]; out.push(c); continue; }
            } else {
                let d;
                if rc.bit(&mut g1, st) == 0 { d = r1; } else { if rc.bit(&mut g2, st) == 0 { d = r2; } else { d = r3; r3 = r2; } r2 = r1; }
                r1 = r0; r0 = d;
            }
            len = rc.largo(&mut rep_d, ps); st = if st < 7 { 8 } else { 11 };
        } else {
            r3 = r2; r2 = r1; r1 = r0;
            len = rc.largo(&mut len_d, ps); st = if st < 7 { 7 } else { 10 };
            let ls = len.min(3) as usize;
            let slot = rc.arbol(&mut pos_slot, ls << 6, 6);
            if slot < 4 { r0 = slot; } else {
                let nd = (slot >> 1) - 1; let mut d = (2 | (slot & 1)) as u64 * (1u64 << nd);
                if slot < 14 { d += rc.arbol_inv(&mut pos_dec, (d - slot as u64) as usize, nd) as u64; } else { d += rc.directos(nd - 4) as u64 * 16 + rc.arbol_inv(&mut align, 0, 4) as u64; }
                if d >= 0xffff_ffff { break; }
                r0 = d as u32;
            }
            if r0 as usize >= op { return Err("lzma: distancia fuera".into()); }
        }
        let mut n = len as usize + 2;
        if sabe && n > tam - op { n = tam - op; }
        let dist = r0 as usize + 1;
        for _ in 0..n { let c = out[out.len() - dist]; out.push(c); }
    }
    Ok(out)
}

// ---------------- lo que usan los mapas del Workshop (mapas_juego.rs) ----------------
impl Juego {
    /// la capa GMod andando (la biblioteca, el addon base), aunque no haya addons montados
    /// (para las pruebas) pone algo del menú del juego donde se mira (un NPC: «npc:Hero»)
    pub fn gmod_prueba_poner(&mut self, m: &mut Motor3d, nombre: &str) -> Result<(), String> { let (o, f) = (self.ojos_ult, self.mira()); self.poner(m, nombre, o, f) }
    /// (para las pruebas) corre un pedazo de Lua del lado del cliente con el mundo a mano; lo que devuelve, como texto
    pub fn gmod_lua_texto(&mut self, src: &str) -> String {
        if self.gmod.gm.is_none() { return String::new(); }
        self.gmod_prestar(true);
        let r = self.gmod.gm.as_mut().map(|g| g.correr(src, "prueba", true));
        self.gmod_prestar(false);
        match r { Some(Ok(v)) => v.first().and_then(|x| x.texto().map(|t| t.into_owned())).unwrap_or_default(), Some(Err(e)) => format!("error: {e}"), None => String::new() }
    }
    pub(crate) fn gmod_asegurar(&mut self) { if self.gmod.gm.is_none() { self.gmod_arrancar(); } }
    /// un archivo de los addons montados o del contenido base (gmArchivo)
    pub(crate) fn gmod_archivo(&self, r: &str) -> Option<Rc<[u8]>> { self.gmod.gm.as_ref()?.archivo(r) }
    /// archivos sueltos para el contenido (los empaquetados en un .bsp): lo que ya está, queda
    pub(crate) fn gmod_sumar_archivos(&mut self, v: Vec<(String, Rc<[u8]>)>) { self.con_puente(|p| for (k, b) in v { p.archivos.entry(k).or_insert(b); }); }
    /// el addon de esa ruta, montado ya (si estaba esperando su turno)
    pub(crate) fn gmod_montar_ya(&mut self, ruta: &Path) {
        let Some(i) = self.gmod.addons.iter().position(|a| a.ruta == ruta) else { return };
        if let Some(k) = self.gmod.pendientes.iter().position(|&x| x == i) { self.gmod.pendientes.remove(k); self.gmod.pendientes.insert(0, i); self.gmod_montar_uno(); }
    }
    /// un sonido de los addons o del contenido base (un archivo de sound/ o un guion de Source) listo en el mezclador: su clave
    pub(crate) fn gmod_sonido_clave(&mut self, s: &str, vol: f32, tono: f32) -> Option<(String, f32, f32)> {
        let (r, v, t, _) = jxgmod::sonidos::resolver(s, Some(vol as f64), Some(tono as f64), azar01());
        let r = r.trim_start_matches(['*', '#', '@', '<', '>', '^', ')', '(', '}', '$', '!', '?', '&', '~', '`', '+', '%']).to_lowercase().replace('\\', "/");
        let clave = format!("gm:{r}"); let ruta = if r.starts_with("sound/") { r.clone() } else { format!("sound/{r}") };
        if !self.sonido.tiene(&clave) {
            let b = self.gmod_archivo(&ruta)?;
            if let Some((w, hz)) = leer_wav(&b) { self.sonido.sintetico(&clave, || w, hz); }
            else if let (Some(dir), Some(ext)) = (self.gmod.datos.clone(), ruta.rsplit_once('.').map(|x| x.1.to_string()).filter(|e| e == "mp3" || e == "ogg")) {
                let d = dir.join("gm_sonidos"); let _ = std::fs::create_dir_all(&d);
                let h = ruta.bytes().fold(0xcbf2_9ce4_8422_2325u64, |h, c| (h ^ c as u64).wrapping_mul(0x100_0000_01b3));
                let f = d.join(format!("{h:016x}.{ext}")); if !f.exists() { let _ = std::fs::write(&f, &b[..]); }
                self.sonido.registrar_archivo(&clave, &f);
            }
        }
        Some((clave, v as f32, t as f32))
    }
}

/// recortar los triángulos de `v` desde `desde` (8 valores por vértice: x, y, u, v, r, g, b, a) al rectángulo `r`
/// (x0, y0, x1, y1): los de afuera se van, los cortados se parten (con su textura y su color interpolados)
fn recortar_tris(v: &mut Vec<f32>, desde: usize, r: [f32; 4]) {
    const N: usize = 8;
    let cola: Vec<f32> = v.split_off(desde);
    for t in cola.chunks_exact(N * 3) {
        let dentro_todo = (0..3).all(|i| { let (x, y) = (t[i * N], t[i * N + 1]); x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3] });
        if dentro_todo { v.extend_from_slice(t); continue; }
        let mut poli: Vec<[f32; N]> = (0..3).map(|i| { let mut a = [0.0; N]; a.copy_from_slice(&t[i * N..(i + 1) * N]); a }).collect();
        for (eje, lim, menor) in [(0usize, r[0], false), (0, r[2], true), (1, r[1], false), (1, r[3], true)] {
            let dentro = |p: &[f32; N]| if menor { p[eje] <= lim } else { p[eje] >= lim };
            let mut out: Vec<[f32; N]> = Vec::with_capacity(poli.len() + 2);
            for i in 0..poli.len() {
                let (a, b) = (poli[i], poli[(i + 1) % poli.len()]);
                let (ia, ib) = (dentro(&a), dentro(&b));
                if ia { out.push(a); }
                if ia != ib { let k = (lim - a[eje]) / (b[eje] - a[eje]); let mut c = [0.0; N]; for j in 0..N { c[j] = a[j] + (b[j] - a[j]) * k; } out.push(c); }
            }
            poli = out;
            if poli.len() < 3 { break; }
        }
        if poli.len() < 3 { continue; }
        for i in 1..poli.len() - 1 { for p in [poli[0], poli[i], poli[i + 1]] { v.extend_from_slice(&p); } }
    }
}
impl EnGmod {
    /// cuántos píxeles es una unidad de la pantalla del Lua (ScrW() = ancho / escala)
    pub fn escala_lua(&self) -> f32 { self.escala }
}

// ---------------- los modos de juego de los addons (gmod_modos.js) ----------------
impl Juego {
    /// el modo que toca en este mapa: el elegido o, en Automático, el que dice el mapa (ph_* → Prop Hunt)
    fn modo_que_toca(&self) -> Option<String> {
        let gm = self.gmod.gm.as_ref()?; let e = self.gmod.modo_elegido.as_str();
        match e {
            "sandbox" => None,
            "auto" => { let m = self.mapas.get(self.mapa_i).cloned().unwrap_or_default(); let nom = m.strip_prefix("WS_").unwrap_or(&m).to_string(); gm.modo_de_mapa(&nom) }
            n => gm.modos().into_iter().find(|x| x.n == n).map(|x| x.n),
        }
    }
    /// gmmPartida: cuando el mapa está y los addons montados, si toca un modo (o hay uno puesto que ya no), el Lua de cero
    /// con el modo; después, la barrita y el jugador muerto que espera al modo
    fn gmod_modos_paso(&mut self, dt: f32) {
        if !self.gmod.pendientes.is_empty() { return; }
        if self.gmod.modo_mapa != Some(self.mapa_i) { self.gmod.modo_mapa = Some(self.mapa_i); self.gmod.modo_fase = 0; }
        match self.gmod.modo_fase {
            0 => {
                let quiero = self.modo_que_toca(); let actual = self.gmod.gm.as_ref().and_then(|g| g.modo_actual());
                self.gmod.modo_fase = 2;
                if quiero.is_none() && actual.is_none() { self.gmod.modo_barra = None; return; }
                self.gmod.modo_quiere = quiero; self.gmod.modo_barra = None; self.gmod.equipos_panel = false;
                // (el Lua vuelve a empezar de cero: se rearma y se montan de nuevo los addons; el modo se pone al terminar)
                self.gmod_reiniciar(); self.gmod.modo_fase = 1;
            }
            1 => {
                self.gmod.modo_fase = 2;
                if let Some(n) = self.gmod.modo_quiere.take() {
                    self.gmod_prestar(true);
                    let ok = self.gmod.gm.as_mut().map(|g| g.activar_modo(&n)).unwrap_or(false);
                    self.gmod_prestar(false);
                    if ok {
                        let (eq, por_eq) = self.gmod.gm.as_mut().map(|g| g.equipos()).unwrap_or_default();
                        let tit = self.gmod.gm.as_ref().and_then(|g| g.modos().into_iter().find(|x| x.n == n)).map(|x| x.titulo).unwrap_or(n.clone());
                        self.avisar(format!("Modo de juego: {tit}"));
                        // (por equipos: el panel para elegir, como la pantalla de GMod)
                        if por_eq && !eq.is_empty() { self.gmod.equipos_panel = true; }
                    } else { self.avisar(format!("No se pudo poner el modo {n}")); }
                }
            }
            _ => {}
        }
        let Some(gm) = self.gmod.gm.as_mut() else { return };
        if gm.modo_actual().is_none() { self.gmod.modo_barra = None; return; }
        self.gmod.modo_t += 1; if self.gmod.modo_t % 15 == 1 { self.gmod_prestar(true); self.gmod.modo_barra = self.gmod.gm.as_mut().and_then(|g| g.modo_barra()); self.gmod_prestar(false); }
        // (muerto con un modo que decide cuándo se vuelve: PlayerDeathThink cada cuadro; a los 5 minutos, igual)
        if self.jug.vida <= 0.0 && self.gmod_retiene_muerte() { self.gmod.muerto_t += dt; self.gmod_prestar(true); if let Some(g) = self.gmod.gm.as_mut() { g.modo_muerto(); } self.gmod_prestar(false); }
    }
    /// ¿el juego espera al modo para volver a aparecer? (si tiene PlayerDeathThink; hasta 5 minutos)
    pub(crate) fn gmod_retiene_muerte(&self) -> bool { self.gmod.muerto_t < 300.0 && self.gmod.gm.as_ref().map(|g| g.modo_maneja_muerte()).unwrap_or(false) }
    /// elegir el modo de la próxima partida (Automático → Sandbox → cada modo de los addons → Automático)
    pub fn modo_siguiente(&mut self) {
        let mut l: Vec<String> = vec!["auto".into(), "sandbox".into()];
        if let Some(g) = self.gmod.gm.as_ref() { l.extend(g.modos().into_iter().filter(|m| m.menu).map(|m| m.n)); }
        let i = l.iter().position(|x| *x == self.gmod.modo_elegido).map(|i| (i + 1) % l.len()).unwrap_or(0);
        self.gmod.modo_elegido = l[i].clone(); if let Some(d) = &self.datos { let _ = std::fs::write(d.join("gmod_modo.txt"), &self.gmod.modo_elegido); }
        self.gmod.modo_mapa = None;
    }
    /// el nombre del modo elegido, para el botón
    pub fn modo_nombre(&self) -> String {
        match self.gmod.modo_elegido.as_str() { "auto" => "Modo: automático".into(), "sandbox" => "Modo: sandbox".into(),
            n => format!("Modo: {}", self.gmod.gm.as_ref().and_then(|g| g.modos().into_iter().find(|x| x.n == n)).map(|x| x.titulo).unwrap_or(n.to_string())) }
    }
    /// los equipos para el panel (número, nombre, color) y el mío
    pub fn modo_equipos(&mut self) -> (Vec<(i64, String, [u8; 3])>, i64) {
        let Some(g) = self.gmod.gm.as_mut() else { return (vec![], 1001) }; let (v, _) = g.equipos(); let mio = g.mi_equipo(); (v, mio)
    }
    /// gmmPedirEquipo: el modo decide (None: el que toque)
    pub fn modo_pedir_equipo(&mut self, id: Option<i64>) {
        self.gmod_prestar(true); if let Some(g) = self.gmod.gm.as_mut() { g.pedir_equipo(id); } self.gmod_prestar(false);
        self.gmod.equipos_panel = false; self.gmod.modo_t = 0;
    }
}

// ---------------- la Workshop (gmod_tienda.js con el navegador de GMod): buscar en toda la Workshop, por tipo, por
// etiqueta, por texto o con un link o su número; las fotos de Steam achicadas; bajar como la tienda de siempre ----------------
/// un resultado (lo que manda la tienda: gmCompacto)
#[derive(Clone, Default, Debug)]
pub struct ItemWs { pub id: String, pub t: String, pub img: String, pub mb: f32, pub subs: u64, pub fav: u64, pub d: String, pub tags: Vec<String>, pub dir: bool, pub act: i64 }
/// las categorías de la izquierda, como el navegador de GMod: (nombre, etiqueta de Steam —"" todo, "#inst" los instalados—,
/// a qué grupo pertenece)
pub const WS_CATS: [(&str, &str, &str); 21] = [("Todo", "", "Explorar"), ("Instalados", "#inst", "Explorar"),
    ("Mapas", "Map", "Tipo"), ("Modos de juego", "Gamemode", "Tipo"), ("Armas", "Weapon", "Tipo"), ("Vehículos", "Vehicle", "Tipo"), ("NPC", "NPC", "Tipo"), ("Herramientas", "Tool", "Tipo"),
    ("Efectos", "Effects", "Tipo"), ("Modelos", "Model", "Tipo"), ("Entidades", "Entity", "Tipo"), ("Contenido de server", "ServerContent", "Tipo"),
    ("Diversión", "Fun", "Etiquetas"), ("Roleplay", "Roleplay", "Etiquetas"), ("Paisajes", "Scenic", "Etiquetas"), ("Películas", "Movie", "Etiquetas"), ("Realismo", "Realism", "Etiquetas"),
    ("Caricatura", "Cartoon", "Etiquetas"), ("Agua", "Water", "Etiquetas"), ("Cómic", "Comic", "Etiquetas"), ("Construcción", "Build", "Etiquetas")];
/// los órdenes (el de la tienda y su nombre)
pub const WS_ORDENES: [(&str, &str); 5] = [("subs", "Más suscriptos"), ("pop", "Tendencia"), ("votos", "Mejor votados"), ("nuevo", "Más nuevos"), ("act", "Actualizados")];
#[derive(Default)]
pub struct Ws {
    pub items: Vec<ItemWs>, pub q: String, pub cat: usize, pub orden: usize, pub pag: u32, pub total: u64, pub cargando: bool, gen: u32,
    /// la ficha abierta (el número del resultado), lo desplazado, si ya se buscó la primera vez y el último error
    pub ficha: Option<usize>, pub scroll: f32, pub buscada: bool, pub error: Option<String>,
    /// los GIF que ya tienen su hoja de cuadros (se animan en la grilla y en la ficha)
    pub anims: HashMap<String, AnimWs>,
    /// cuándo se dibujó por última vez cada foto (para olvidar las que no se ven cuando se llega al tope)
    pub vistas: HashMap<String, f32>,
    /// la columna de las categorías: lo desplazado, dónde está y su alto (para arrastrarla aparte de la grilla)
    pub scroll_cats: f32, pub r_cats: [f32; 4], pub alto_cats: f32,
    /// las fotos pedidas y la fila de las que faltan bajar (la atienden tres hilos)
    fotos: std::collections::HashSet<String>, cola: Option<Sender<(String, String)>>,
}
/// el número de un addon en un texto: un link de steamcommunity (filedetails/?id=…, el de la app de Steam) o el número solo
pub fn ws_id_de(q: &str) -> Option<String> {
    let t = q.trim(); if t.is_empty() { return None; }
    let digitos = |s: &str| -> Option<String> { let d: String = s.chars().take_while(|c| c.is_ascii_digit()).collect(); if (5..=12).contains(&d.len()) { Some(d) } else { None } };
    for pre in ["?id=", "&id=", "CommunityFilePage/", "communityfilepage/"] { if let Some(i) = t.find(pre) { if let Some(d) = digitos(&t[i + pre.len()..]) { return Some(d); } } }
    if t.chars().all(|c| c.is_ascii_digit()) { return digitos(t); }
    None
}
fn url_cod(s: &str) -> String { s.bytes().map(|b| if b.is_ascii_alphanumeric() || b"-_.~".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") }).collect() }
/// una foto de Steam a RGBA de hasta `max` de ancho (JPEG o PNG): w y h en los primeros 8 bytes
pub(crate) fn ws_foto_rgba(b: &[u8], max: u32) -> Option<Vec<u8>> {
    let (w, h, px) = if b.starts_with(&[0xFF, 0xD8]) {
        let op = zune_jpeg::zune_core::options::DecoderOptions::default().jpeg_set_out_colorspace(zune_jpeg::zune_core::colorspace::ColorSpace::RGBA);
        let mut d = zune_jpeg::JpegDecoder::new_with_options(zune_jpeg::zune_core::bytestream::ZCursor::new(b), op);
        let px = d.decode().ok()?; let i = d.info()?; (i.width as u32, i.height as u32, px)
    } else if b.starts_with(&[0x89, b'P', b'N', b'G']) {
        let mut dec = png::Decoder::new(std::io::Cursor::new(b)); dec.set_transformations(png::Transformations::EXPAND | png::Transformations::STRIP_16);
        let mut r = dec.read_info().ok()?; let mut buf = vec![0; r.output_buffer_size()]; let inf = r.next_frame(&mut buf).ok()?;
        let n = (inf.width * inf.height) as usize; let px: Vec<u8> = match inf.color_type { png::ColorType::Rgba => buf[..n * 4].to_vec(), png::ColorType::Rgb => buf[..n * 3].chunks(3).flat_map(|c| [c[0], c[1], c[2], 255]).collect(),
            png::ColorType::Grayscale => buf[..n].iter().flat_map(|&g| [g, g, g, 255]).collect(), png::ColorType::GrayscaleAlpha => buf[..n * 2].chunks(2).flat_map(|c| [c[0], c[0], c[0], c[1]]).collect(), _ => return None };
        (inf.width, inf.height, px)
    } else if b.starts_with(b"GIF8") { gif_primero(b)? } else { return None };
    if w == 0 || h == 0 || px.len() < (w * h * 4) as usize { return None; }
    // (achicada promediando, para que entre en la memoria y se vea suave)
    let (nw, nh, chica) = achicar(&px, w, h, max);
    let mut out = Vec::with_capacity(8 + chica.len()); out.extend_from_slice(&nw.to_le_bytes()); out.extend_from_slice(&nh.to_le_bytes()); out.extend_from_slice(&chica);
    Some(out)
}
/// los cuadros de un GIF (las fotos animadas de la Workshop), hasta `max`: cada uno ya compuesto sobre los anteriores
/// (con su forma de borrarse: dejarlo, volver al fondo o al de antes), con su paleta, la transparencia, el entrelazado y
/// lo que dura (en ms); LZW de tamaño variable
fn gif_cuadros(b: &[u8], max: usize) -> Option<(u32, u32, Vec<(Vec<u8>, u32)>)> {
    let u16le = |i: usize| -> Option<u16> { Some(u16::from_le_bytes([*b.get(i)?, *b.get(i + 1)?])) };
    let (w, h) = (u16le(6)? as usize, u16le(8)? as usize); if w == 0 || h == 0 || w * h > 4_000_000 { return None; }
    let fl = *b.get(10)?; let mut i = 13usize; let mut global: Vec<[u8; 3]> = vec![];
    if fl & 0x80 != 0 { let n = 2usize << (fl & 7); for k in 0..n { global.push([*b.get(i + k * 3)?, *b.get(i + k * 3 + 1)?, *b.get(i + k * 3 + 2)?]); } i += n * 3; }
    let (mut transp, mut demora, mut borrar): (Option<u8>, u32, u8) = (None, 100, 0);
    let mut lienzo = vec![0u8; w * h * 4]; let mut cuadros: Vec<(Vec<u8>, u32)> = vec![];
    while cuadros.len() < max {
        let Some(&t) = b.get(i) else { break };
        match t {
            0x21 => { // (extensiones: la de control gráfico trae el color transparente, lo que dura y cómo se borra)
                let et = *b.get(i + 1)?; i += 2;
                if et == 0xF9 && *b.get(i)? >= 4 { let f = *b.get(i + 1)?; borrar = (f >> 2) & 7; transp = if f & 1 != 0 { Some(*b.get(i + 4)?) } else { None };
                    let d = u16le(i + 2)? as u32; demora = if d < 2 { 100 } else { d * 10 }; }
                loop { let n = *b.get(i)? as usize; i += 1; if n == 0 { break; } i += n; }
            }
            0x2C => {
                let (x0, y0, iw, ih) = (u16le(i + 1)? as usize, u16le(i + 3)? as usize, u16le(i + 5)? as usize, u16le(i + 7)? as usize); let lf = *b.get(i + 9)?; i += 10;
                let mut pal = global.clone();
                if lf & 0x80 != 0 { let n = 2usize << (lf & 7); pal.clear(); for k in 0..n { pal.push([*b.get(i + k * 3)?, *b.get(i + k * 3 + 1)?, *b.get(i + k * 3 + 2)?]); } i += n * 3; }
                let entre = lf & 0x40 != 0; let min = *b.get(i)? as u32; i += 1; if min > 11 { return None; }
                let mut datos = vec![]; loop { let n = *b.get(i)? as usize; i += 1; if n == 0 { break; } datos.extend_from_slice(b.get(i..i + n)?); i += n; }
                let (clear, fin) = (1u32 << min, (1u32 << min) + 1); let mut tam = min + 1; let mut dic: Vec<(i32, u8)> = Vec::with_capacity(4096);
                let reiniciar = |dic: &mut Vec<(i32, u8)>| { dic.clear(); for c in 0..(1u32 << min) { dic.push((-1, c as u8)); } dic.push((-1, 0)); dic.push((-1, 0)); };
                reiniciar(&mut dic); let mut idx: Vec<u8> = Vec::with_capacity(iw * ih); let (mut acc, mut nb, mut pos) = (0u32, 0u32, 0usize); let mut prev: Option<u32> = None;
                let cadena = |dic: &Vec<(i32, u8)>, mut c: u32, v: &mut Vec<u8>| -> u8 { let ini = v.len(); loop { let (p, ch) = dic[c as usize]; v.push(ch); if p < 0 { break; } c = p as u32; } v[ini..].reverse(); v[ini] };
                while idx.len() < iw * ih {
                    while nb < tam { if pos >= datos.len() { break; } acc |= (datos[pos] as u32) << nb; nb += 8; pos += 1; }
                    if nb < tam { break; }
                    let c = acc & ((1 << tam) - 1); acc >>= tam; nb -= tam;
                    if c == clear { reiniciar(&mut dic); tam = min + 1; prev = None; continue; }
                    if c == fin { break; }
                    match prev {
                        None => { if (c as usize) >= dic.len() { return None; } cadena(&dic, c, &mut idx); }
                        Some(pc) => {
                            if (c as usize) < dic.len() { let f = cadena(&dic, c, &mut idx); if dic.len() < 4096 { dic.push((pc as i32, f)); } }
                            else if c as usize == dic.len() { let f = cadena(&dic, pc, &mut idx); idx.push(f); if dic.len() < 4096 { dic.push((pc as i32, f)); } }
                            else { break; }
                        }
                    }
                    prev = Some(c); if dic.len() == (1 << tam) as usize && tam < 12 { tam += 1; }
                }
                // (lo de antes, por si este cuadro se borra volviendo a él)
                let antes = if borrar == 3 { Some(lienzo.clone()) } else { None };
                let filas: Vec<usize> = if entre { (0..ih).step_by(8).chain((4..ih).step_by(8)).chain((2..ih).step_by(4)).chain((1..ih).step_by(2)).collect() } else { (0..ih).collect() };
                for (k, &fy) in filas.iter().enumerate() { for fx in 0..iw { let Some(&ci) = idx.get(k * iw + fx) else { continue }; let (x, y) = (x0 + fx, y0 + fy); if x >= w || y >= h { continue; }
                    if Some(ci) == transp { continue; } let o = (y * w + x) * 4; let c = pal.get(ci as usize).copied().unwrap_or([0, 0, 0]); lienzo[o..o + 4].copy_from_slice(&[c[0], c[1], c[2], 255]); } }
                cuadros.push((lienzo.clone(), demora));
                match borrar { 2 => { for y in y0..(y0 + ih).min(h) { for x in x0..(x0 + iw).min(w) { let o = (y * w + x) * 4; lienzo[o..o + 4].copy_from_slice(&[0, 0, 0, 0]); } } } 3 => { if let Some(a) = antes { lienzo = a; } } _ => {} }
                transp = None; demora = 100; borrar = 0;
            }
            _ => break,
        }
    }
    if cuadros.is_empty() { None } else { Some((w as u32, h as u32, cuadros)) }
}
/// el primer cuadro de un GIF
fn gif_primero(b: &[u8]) -> Option<(u32, u32, Vec<u8>)> { let (w, h, mut c) = gif_cuadros(b, 1)?; Some((w, h, c.remove(0).0)) }
/// achicar una imagen RGBA promediando, hasta `max` de ancho
fn achicar(px: &[u8], w: u32, h: u32, max: u32) -> (u32, u32, Vec<u8>) {
    let k = (w as f32 / max as f32).max(1.0); let (nw, nh) = (((w as f32 / k) as u32).max(1), ((h as f32 / k) as u32).max(1));
    let mut out = Vec::with_capacity((nw * nh * 4) as usize);
    for y in 0..nh { for x in 0..nw {
        let (x0, x1, y0, y1) = ((x as f32 * k) as u32, (((x + 1) as f32 * k) as u32).min(w).max((x as f32 * k) as u32 + 1), (y as f32 * k) as u32, (((y + 1) as f32 * k) as u32).min(h).max((y as f32 * k) as u32 + 1));
        let mut s = [0u32; 4]; let mut n = 0u32;
        for yy in y0..y1.min(h) { for xx in x0..x1.min(w) { let o = ((yy * w + xx) * 4) as usize; for c in 0..4 { s[c] += px[o + c] as u32; } n += 1; } }
        for c in 0..4 { out.push((s[c] / n.max(1)) as u8); }
    } }
    (nw, nh, out)
}
/// la hoja con los cuadros de un GIF (para una sola textura): cada cuadro de hasta 160 de ancho, en una grilla de hasta
/// 2048 × 2048 (si no entran, se salta de a varios sumando lo que duran). Bytes: ancho y alto del cuadro, columnas, cuántos,
/// lo que dura cada uno (u16 en ms), el ancho y el alto de la hoja y sus píxeles
fn gif_hoja(w: u32, h: u32, cuadros: Vec<(Vec<u8>, u32)>) -> Option<Vec<u8>> {
    if cuadros.len() < 2 { return None; }
    // (cuadros de hasta 128 px y 32 cuadros como mucho, en una hoja de hasta 1024 × 1024: unos 2 MB por GIF)
    let k = (w.max(h) as f32 / 128.0).max(1.0); let (fw, fh) = (((w as f32 / k) as u32).max(1), ((h as f32 / k) as u32).max(1));
    let cols = (1024 / fw).max(1); let filas_max = (1024 / fh).max(1); let cab = (cols * filas_max) as usize;
    let paso = cuadros.len().div_ceil(cab.min(32)).max(1);
    let mut elegidos: Vec<(Vec<u8>, u32)> = vec![];
    for (k2, (px, d)) in cuadros.into_iter().enumerate() { if k2 % paso == 0 { elegidos.push((px, d)); } else if let Some(u) = elegidos.last_mut() { u.1 += d; } }
    let n = elegidos.len() as u32; let filas = n.div_ceil(cols); let (aw, ah) = (cols.min(n) * fw, filas * fh);
    let mut hoja = vec![0u8; (aw * ah * 4) as usize];
    for (q, (px, _)) in elegidos.iter().enumerate() {
        let (cw, ch, ch_px) = achicar(px, w, h, fw); let (ox, oy) = ((q as u32 % cols) * fw, (q as u32 / cols) * fh);
        for y in 0..ch.min(fh) { for x in 0..cw.min(fw) { let s = ((y * cw + x) * 4) as usize; let d = (((oy + y) * aw + ox + x) * 4) as usize; hoja[d..d + 4].copy_from_slice(&ch_px[s..s + 4]); } }
    }
    let mut out = vec![]; for v in [fw, fh, cols, n] { out.extend_from_slice(&v.to_le_bytes()); }
    for (_, d) in &elegidos { out.extend_from_slice(&(((*d).min(65535)) as u16).to_le_bytes()); }
    out.extend_from_slice(&aw.to_le_bytes()); out.extend_from_slice(&ah.to_le_bytes()); out.extend_from_slice(&hoja);
    Some(out)
}
/// un GIF de la Workshop animándose: el tamaño de cada cuadro en la hoja, las columnas y cuándo termina cada uno (s)
#[derive(Clone, Debug)]
pub struct AnimWs { pub fw: f32, pub fh: f32, pub cols: u32, pub fin: Vec<f32> }
impl AnimWs {
    /// el pedazo de la hoja que toca en el segundo `t`
    pub fn cuadro(&self, t: f32) -> [f32; 4] {
        let total = self.fin.last().copied().unwrap_or(1.0).max(0.05); let r = t % total;
        let q = self.fin.iter().position(|&f| r < f).unwrap_or(0) as u32;
        [(q % self.cols) as f32 * self.fw, (q / self.cols) as f32 * self.fh, self.fw, self.fh]
    }
}
fn ws_item(x: &serde_json::Value) -> Option<ItemWs> {
    let id = x["id"].as_str().map(String::from).or_else(|| x["id"].as_u64().map(|n| n.to_string()))?;
    Some(ItemWs { id, t: x["t"].as_str().unwrap_or("").to_string(), img: x["img"].as_str().unwrap_or("").to_string(), mb: x["mb"].as_f64().unwrap_or(0.0) as f32,
        subs: x["subs"].as_u64().unwrap_or(0), fav: x["fav"].as_u64().unwrap_or(0), d: x["d"].as_str().unwrap_or("").to_string(),
        tags: x["tags"].as_array().map(|a| a.iter().filter_map(|t| t.as_str().map(String::from)).collect()).unwrap_or_default(), dir: x["dir"].as_bool().unwrap_or(false), act: x["act"].as_i64().unwrap_or(0) })
}
impl Juego {
    /// buscar (con `de_nuevo`, desde la primera página: cambió lo buscado, la categoría o el orden; si no, la página siguiente)
    pub fn ws_buscar(&mut self, de_nuevo: bool) {
        let ws = &mut self.gmod.ws;
        if de_nuevo { ws.items.clear(); ws.pag = 0; ws.total = 0; ws.scroll = 0.0; ws.gen += 1; ws.cargando = false; ws.ficha = None; ws.error = None; }
        if ws.cargando || (ws.pag > 0 && ws.items.len() as u64 >= ws.total) { return; }
        ws.buscada = true;
        let Some(h) = self.gmod_http_bin() else { self.gmod.ws.error = Some("Sin conexión: la Workshop anda con internet".into()); return };
        let ws = &mut self.gmod.ws; let cat = WS_CATS[ws.cat.min(WS_CATS.len() - 1)];
        // (un link o un número: ése; los instalados: sus fichas; si no, la búsqueda de la tienda de a 30)
        let url = if let Some(id) = ws_id_de(&ws.q) { if ws.pag > 0 { return; } format!("{}gmod/detalles?ids={}", TIENDA_URL, id) }
            else if cat.1 == "#inst" {
                if ws.pag > 0 { return; }
                let ids: Vec<String> = self.gmod.addons.iter().filter_map(|a| { let n = a.ruta.file_stem()?.to_string_lossy().into_owned(); if n.chars().all(|c| c.is_ascii_digit()) && n.len() >= 5 { Some(n) } else { None } }).collect();
                if ids.is_empty() { self.gmod.ws.total = 0; self.gmod.ws.pag = 1; return; }
                format!("{}gmod/detalles?ids={}", TIENDA_URL, ids.join(","))
            } else { format!("{}gmod/buscar?q={}&tag={}&orden={}&p={}", TIENDA_URL, url_cod(&ws.q), cat.1, WS_ORDENES[ws.orden.min(4)].0, ws.pag + 1) };
        let ws = &mut self.gmod.ws; ws.cargando = true; ws.pag += 1;
        let (tx, g) = (self.gmod.tx.clone(), ws.gen);
        std::thread::spawn(move || { let r = h(&url).and_then(|(c, b)| if c == 200 { Ok(b) } else { Err(format!("HTTP {c}")) }); let _ = tx.send((format!("ws:{g}"), r)); });
    }
    fn ws_respuesta(&mut self, g: &str, r: Result<Vec<u8>, String>) {
        if g.parse::<u32>().ok() != Some(self.gmod.ws.gen) { return; }
        self.gmod.ws.cargando = false;
        let v = match r.and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).map_err(|e| e.to_string())) { Ok(v) => v, Err(e) => { self.gmod.ws.error = Some(format!("La Workshop no contestó ({e})")); return } };
        let nuevos: Vec<ItemWs> = v["items"].as_array().map(|a| a.iter().filter_map(ws_item).collect()).unwrap_or_default();
        let ws = &mut self.gmod.ws;
        ws.total = v["total"].as_u64().unwrap_or(ws.items.len() as u64 + nuevos.len() as u64);
        if nuevos.is_empty() && ws.items.is_empty() { ws.total = 0; }
        for n in nuevos { if !ws.items.iter().any(|x| x.id == n.id) { ws.items.push(n); } }
        if ws.items.len() as u64 >= ws.total || ws.items.len() < 30 * ws.pag as usize { ws.total = ws.items.len() as u64; }
        ws.error = None;
    }
    /// la foto de un resultado: si no se pidió, a la fila de los hilos de las fotos (de Steam, ya achicada en su CDN)
    pub fn ws_pedir_foto(&mut self, k: usize) {
        let Some(it) = self.gmod.ws.items.get(k) else { return }; if it.img.is_empty() || self.gmod.ws.fotos.contains(&it.id) { return; }
        let (id, img) = (it.id.clone(), it.img.clone());
        if self.gmod.ws.cola.is_none() {
            let Some(h) = self.gmod_http_bin() else { return };
            let (stx, srx) = channel::<(String, String)>(); let srx = Arc::new(std::sync::Mutex::new(srx));
            for _ in 0..3 { let (srx, h, tx) = (srx.clone(), h.clone(), self.gmod.tx.clone());
                std::thread::spawn(move || loop {
                    let Ok((id, url)) = srx.lock().map_err(|_| ()).and_then(|r| r.recv().map_err(|_| ())) else { break };
                    let u = if url.contains('?') { url } else { format!("{url}?imw=240&imh=240&ima=fit&impolicy=Letterbox&letterbox=false") };
                    let r = h(&u).and_then(|(c, b)| if c == 200 { Ok(b) } else { Err(format!("HTTP {c}")) });
                    // (primero la foto fija —el primer cuadro si es un GIF— y, si se mueve, después todos sus cuadros)
                    let fija = r.as_ref().map_err(|e| e.clone()).and_then(|b| ws_foto_rgba(b, 240).ok_or_else(|| "foto rara".to_string()));
                    if tx.send((format!("wsimg:{id}"), fija)).is_err() { break; }
                    if let Ok(b) = r { if b.starts_with(b"GIF8") { if let Some((w, hh, c)) = gif_cuadros(&b, 400) { if let Some(hoja) = gif_hoja(w, hh, c) { if tx.send((format!("wsgif:{id}"), Ok(hoja))).is_err() { break; } } } } }
                }); }
            self.gmod.ws.cola = Some(stx);
        }
        self.gmod.ws.fotos.insert(id.clone());
        if let Some(c) = &self.gmod.ws.cola { let _ = c.send((id, img)); }
    }
    /// la hoja de cuadros de un GIF: a la placa y sus tiempos a la lista
    fn ws_hoja(&mut self, id: &str, b: &[u8]) {
        let u = |i: usize| -> Option<u32> { Some(u32::from_le_bytes(b.get(i..i + 4)?.try_into().ok()?)) };
        let (Some(fw), Some(fh), Some(cols), Some(n)) = (u(0), u(4), u(8), u(12)) else { return };
        let o = 16 + n as usize * 2; let (Some(aw), Some(ah)) = (u(o), u(o + 4)) else { return };
        if b.len() != o + 8 + (aw * ah * 4) as usize || cols == 0 { return; }
        let mut fin = vec![]; let mut t = 0.0f32; for q in 0..n as usize { let d = u16::from_le_bytes([b[16 + q * 2], b[17 + q * 2]]) as f32 / 1000.0; t += d.max(0.02); fin.push(t); }
        self.ws_guardar_foto(&format!("wsa:{id}"), aw, ah, b[o + 8..].to_vec());
        self.gmod.ws.anims.insert(id.to_string(), AnimWs { fw: fw as f32, fh: fh as f32, cols, fin });
    }
    /// guardar una foto de la Workshop con tope (72 fijas y 10 hojas animadas): llegado el tope, se olvida la que hace más
    /// que no se ve y se reusa su textura (si vuelve a verse, se pide de nuevo)
    fn ws_guardar_foto(&mut self, k: &str, w: u32, h: u32, px: Vec<u8>) {
        if self.ini_foto_lista(k) { return; }
        let (pre, tope) = if k.starts_with("wsa:") { ("wsa:", 10) } else { ("ws:", 72) };
        let mias: Vec<String> = self.gmod.ws.vistas.keys().filter(|x| x.starts_with(pre)).cloned().collect();
        let mut id_libre = None;
        if mias.len() >= tope {
            if let Some(vieja) = mias.iter().min_by(|a, b| self.gmod.ws.vistas[*a].partial_cmp(&self.gmod.ws.vistas[*b]).unwrap_or(std::cmp::Ordering::Equal)).cloned() {
                self.gmod.ws.vistas.remove(&vieja); id_libre = self.ini_sacar_foto(&vieja);
                let item = vieja[pre.len()..].to_string(); if pre == "wsa:" { self.gmod.ws.anims.remove(&item); } else { self.gmod.ws.fotos.remove(&item); }
            }
        }
        self.gmod.ws.vistas.insert(k.to_string(), self.ini.reloj);
        match id_libre { Some(id) => self.ini_poner_foto_id(k, id, w, h, px), None => self.ini_poner_foto(k, w, h, px) }
    }
    /// la foto de un resultado para dibujar: la hoja animada (con el pedazo que toca) o la fija
    pub fn ws_foto(&self, id: &str, t: f32) -> Option<(i64, f32, f32, Option<[f32; 4]>)> {
        if let (Some(a), Some((tex, tw, th))) = (self.gmod.ws.anims.get(id), self.ini_foto(&format!("wsa:{id}"))) { return Some((tex, tw, th, Some(a.cuadro(t)))); }
        self.ini_foto(&format!("ws:{id}")).map(|(tex, tw, th)| (tex, tw, th, None))
    }
    /// el estado de un resultado: (texto, progreso 0..1 si baja, si está instalado)
    pub fn ws_estado(&self, id: &str) -> (String, Option<f32>, bool) {
        let inst = self.gmod.addons.iter().any(|a| a.ruta.file_stem().map(|s| s.to_string_lossy() == id).unwrap_or(false));
        if let Some(t) = self.gmod.tienda.iter().find(|t| t.id == id) {
            let p = t.prog.as_ref().map(|p| { let (hh, tt) = (p.hecho.load(std::sync::atomic::Ordering::Relaxed), p.total.load(std::sync::atomic::Ordering::Relaxed)); if tt > 0 { hh as f32 / tt as f32 } else { 0.0 } });
            if t.estado.starts_with("Bajando") { return (t.estado.clone(), p.or(Some(0.0)), false); }
            if t.estado != "Bajar" && !inst && t.estado != "Instalado" { return (t.estado.clone(), None, false); }
        }
        if inst { ("Instalado".into(), None, true) } else { ("Bajar".into(), None, false) }
    }
    /// bajar un resultado (directo o por SteamPipe, como la tienda de siempre)
    pub fn ws_bajar(&mut self, id: &str) {
        let Some(it) = self.gmod.ws.items.iter().find(|x| x.id == id).cloned() else { return };
        if self.ws_estado(id).2 { return; }
        let k = match self.gmod.tienda.iter().position(|t| t.id == it.id) { Some(k) => { if !self.gmod.tienda[k].estado.starts_with("Bajando") { self.gmod.tienda[k].estado = "Bajar".into(); } k }
            None => { self.gmod.tienda.push(ItemTienda { id: it.id.clone(), titulo: it.t.clone(), estado: "Bajar".into(), mb: it.mb, pipe: !it.dir, prog: None }); self.gmod.tienda.len() - 1 } };
        if self.gmod.http_bin.is_none() { self.avisar("Para bajar de la Workshop hace falta el celular (la conexión de la app)".into()); return; }
        self.gmod_bajar(k); self.avisar(format!("Bajando {}", it.t));
        // (los «Required items» de su página —la base de armas, las texturas aparte…—: se piden a la tienda y se bajan también)
        if let Some(h) = self.gmod_http_bin() { let (tx, id) = (self.gmod.tx.clone(), it.id.clone());
            std::thread::spawn(move || { let r = h(&format!("{}gmod/requiere/{}", TIENDA_URL, id)).and_then(|(c, b)| if c == 200 { Ok(b) } else { Err(format!("HTTP {c}")) }); let _ = tx.send((format!("req:{id}"), r)); }); }
    }
    /// lo que pide un addon (sus «Required items»): los que no están instalados, a la tienda con su información y a bajar
    fn ws_requeridos(&mut self, r: Result<Vec<u8>, String>) {
        let Some(v) = r.ok().and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok()) else { return };
        let ids: Vec<String> = v["ids"].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
        let faltan: Vec<String> = ids.into_iter().filter(|id| !self.gmod.addons.iter().any(|a| a.ruta.file_stem().map(|s| s.to_string_lossy() == id.as_str()).unwrap_or(false)) && !self.gmod.tienda.iter().any(|t| &t.id == id && t.estado != "Bajar")).take(10).collect();
        if faltan.is_empty() { return; }
        let Some(h) = self.gmod_http_bin() else { return }; let tx = self.gmod.tx.clone();
        std::thread::spawn(move || { let r = h(&format!("{}gmod/detalles?ids={}", TIENDA_URL, faltan.join(","))).and_then(|(c, b)| if c == 200 { Ok(b) } else { Err(format!("HTTP {c}")) }); let _ = tx.send(("reqdet".into(), r)); });
    }
    fn ws_requeridos_bajar(&mut self, r: Result<Vec<u8>, String>) {
        let Some(v) = r.ok().and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok()) else { return };
        let items: Vec<ItemWs> = v["items"].as_array().map(|a| a.iter().filter_map(ws_item).collect()).unwrap_or_default();
        let mut nombres = vec![];
        for it in items {
            let k = match self.gmod.tienda.iter().position(|t| t.id == it.id) { Some(k) => k, None => { self.gmod.tienda.push(ItemTienda { id: it.id.clone(), titulo: it.t.clone(), estado: "Bajar".into(), mb: it.mb, pipe: !it.dir, prog: None }); self.gmod.tienda.len() - 1 } };
            if self.gmod.tienda[k].estado == "Bajar" { self.gmod_bajar(k); nombres.push(it.t.clone()); }
        }
        if !nombres.is_empty() { self.avisar(format!("También hace falta: {}", nombres.join(", "))); }
    }
    /// prender o apagar un addon instalado (se rearma el Lua, como en el panel Mods)
    pub fn ws_alternar(&mut self, id: &str) {
        if let Some(i) = self.gmod.addons.iter().position(|a| a.ruta.file_stem().map(|s| s.to_string_lossy() == id).unwrap_or(false)) {
            let a = &mut self.gmod.addons[i]; a.prendido = !a.prendido; let on = a.prendido; self.gmod.guardar_apagados(); self.gmod_reiniciar();
            self.avisar(if on { "Addon prendido".into() } else { "Addon apagado".into() });
        }
    }
    pub fn ws_prendido(&self, id: &str) -> Option<bool> { self.gmod.addons.iter().find(|a| a.ruta.file_stem().map(|s| s.to_string_lossy() == id).unwrap_or(false)).map(|a| a.prendido) }
}
