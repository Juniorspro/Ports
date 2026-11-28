//! El inicio de JXMod (inicio.js y clasico.js de la web): las escenas del juego de fondo que pasan solas (cada 9 s, con el
//! fundido de 1,8 s y el agrandado lento de la 3.3), el menú clásico —el logo JXM con su cinta y su esquina rota, la línea
//! amarilla gastada, las 8 opciones en barras negras con la punta rota y grano, en tres grupos, la elegida en amarillo; abajo
//! la barra (los mods, el idioma, tu nombre, Discord y TikTok) y la versión; arriba a la derecha Avisos, Bugs y La grieta—
//! con sus animaciones (la entrada que rasga las barras una tras otra, el barrido de luz de la elegida, el golpe al tocar y el
//! glitch del logo cada 11 a 19 s) y las mismas medidas de clEncajar (en % del alto, la versión apretada del celular
//! apaisado y lo que se toca de 44 px). Los paneles que abre están en paneles_juego.rs; la pausa, en pausa_juego.rs.
//! Mientras el inicio está a la vista el juego no corre: se dibuja sólo esto (con el motor, sin mapa).
use super::*;
use crate::pincel::{self, rgba, con_a, Atlas, Cara, Col, Iconos, Pincel, TEX_FOTOS};
use super::aero;
use std::cell::Cell;

/// los colores de la web (--jxA, --jxT, --clPl, --clPl2 y el texto sobre amarillo)
pub(super) const AMA: Col = rgba(0xf2b31b, 1.0);
pub(super) const TX: Col = rgba(0xefede7, 1.0);

/// las opciones del menú, en el orden de la 3.3 (CL_K), su texto y su ícono (CL_ICO); los grupos (CL_G): 3, 4 y 1
pub const CL_K: [&str; 8] = ["nueva", "multi", "social", "tienda", "crear", "personajes", "opciones", "salir"];
pub const CL_TXT: [&str; 8] = ["Empezar partida nueva", "Buscar partida multijugador", "Social", "Mods y mapas", "Crear un mapa", "Personajes", "Opciones", "Salir"];

/// lo que se toca en el inicio
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Pieza { Op(usize), Mods, Idioma, Nombre, Discord, TikTok, Avisos, Bugs, Grieta, Actualizar, Contenido, Novedades }

/// cuánto se mueve (clNivel): «quieto» sin animaciones, «bajo» sólo lo corto, «pleno» todo (Patata: quieto; Bajo: bajo)
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Nivel { Quieto, Bajo, Pleno }

/// una foto en el motor (su número de textura y su tamaño) y de dónde sale para volver a subirla
pub struct Foto { pub id: i64, pub w: u32, pub h: u32, subida: bool, px: Option<Vec<u8>> }

/// lo que hay que tener en el motor: el atlas de los menús, los íconos y las fotos
#[derive(Default)]
pub struct Recursos { pub atlas: Option<Atlas>, pub ico: Iconos, pub gl: pincel::Glifos, atlas_subido: bool, aero_subida: bool, atlas_px: Option<Vec<u8>>, pub fotos: HashMap<String, Foto>, sig_foto: i64, pub error: Option<String> }

/// el estado del inicio
/// la actualización de la app (Actualizar.java): hay una versión nueva, se está bajando o falló
#[derive(Clone, Debug, PartialEq)]
pub enum Act { Nueva { version: String, mb: f32 }, Bajando { f: f32 }, Error(String) }
/// lo que dice Actualizar.java («nueva\tversión\tbytes», «bajando\thecho\ttotal», «error\tmensaje» o nada)
pub fn act_de(s: &str) -> Option<Act> {
    let v: Vec<&str> = s.split('\t').collect();
    match v.first().copied()? {
        "nueva" => Some(Act::Nueva { version: v.get(1)?.to_string(), mb: v.get(2).and_then(|x| x.parse::<f32>().ok()).unwrap_or(0.0) / 1048576.0 }),
        "bajando" => { let (h, t) = (v.get(1)?.parse::<f32>().ok()?, v.get(2)?.parse::<f32>().ok()?.max(1.0)); Some(Act::Bajando { f: h / t }) }
        "error" => Some(Act::Error(v.get(1).unwrap_or(&"").to_string())),
        _ => None,
    }
}
pub struct Inicio {
    /// «Tu logo»: esperando la imagen que se está eligiendo
    pub logo_elige: bool,
    /// a la vista (el juego no corre) y el panel abierto encima del fondo (None: el menú)
    pub abierto: bool, pub panel: Option<super::paneles_juego::PanelIni>,
    /// la actualización de la app y cómo preguntarle a Java (cada medio segundo) y pedirle que la baje (app.rs)
    pub act: Option<Act>, pub act_estado: Option<Box<dyn Fn() -> String>>, pub act_pedir: Option<Box<dyn Fn()>>, pub act_t: f32,
    /// el reloj del inicio (s) y cuándo apareció el menú (la entrada) o cambió la elegida (el barrido)
    pub reloj: f32, pub entrada: f32, pub sel: Option<usize>, sel_t: f32,
    /// el golpe al tocar (qué y cuándo) y el dedo que está tocando (su número, qué tocó y dónde empezó)
    golpe: Option<(Pieza, f32)>, dedo: Option<(i32, Option<Pieza>, f32, f32)>, pub apretado: Option<Pieza>,
    /// las escenas de fondo: cuáles hay, cuál va, cuándo cambió y cuánto lleva a la vista
    pub(super) fondos: Vec<String>, fondo: usize, fondo_t: f32, fundido: f32, ken_t: f32,
    /// el glitch del logo: cuándo empezó el último y cuándo el próximo
    glitch: f32, glitch_prox: f32, azar: u32,
    pub nivel: Nivel,
    pub rec: Recursos, perdidas: Cell<bool>, letras_ok: Cell<bool>,
    /// de dónde leer lo de la APK (en la compu, de carpetas): ui/menus.*, fondos/N.webp, carga/x.webp
    pub lector: Option<Box<dyn Fn(&str) -> Option<Vec<u8>>>>,
    /// la versión (la de nucleo.js) y el día del armado (dd/mm/aaaa)
    pub version: String, pub armado: String,
    /// lo que se toca del inicio en el último cuadro (para tocar y las pruebas: lo último dibujado va encima)
    pub zonas: Vec<([f32; 4], Pieza)>,
    /// la muesca (izquierda, derecha, arriba, abajo)
    pub ins: [f32; 4],
    /// la tienda abierta desde un panel o desde la pausa (para volver)
    pub desde_juego: bool,
    /// lo de los paneles (paneles_juego.rs) y la pausa (pausa_juego.rs)
    pub pn: super::paneles_juego::EstPaneles, pub pz: super::pausa_juego::Pausa,
    /// «Salir»: la app se cierra (app.rs); el personaje cambió y hay que cargar su cuerpo
    pub salir: bool, pub cuerpo_nuevo: bool,
    /// (para las pruebas: el fondo quieto)
    quieto: bool,
    /// el personaje en 3D de Personajes (el lobby de menu.js): su cuerpo y su skin, lo que ya está en el motor y el cielo oscuro
    lobby: Option<(Personaje, String)>, lobby_cargados: personaje::Cargados, cielo_ok: bool,
}

impl Default for Inicio {
    fn default() -> Self {
        // (la versión de la web: JX_VERSION de nucleo.js; el día, el de la última nota de novedades.js o el del armado)
        let nucleo = include_str!("../../../juego/nucleo.js");
        let version = nucleo.split("const JX_VERSION = '").nth(1).and_then(|r| r.split('\'').next()).unwrap_or("?").to_string();
        let armado = option_env!("JXM_ARMADO").map(|s| s.to_string()).unwrap_or_else(|| super::paneles_juego::novedades().first().map(|n| { let p: Vec<&str> = n.f.split('-').collect(); if p.len() == 3 { format!("{}/{}/{}", p[2], p[1], p[0]) } else { n.f.clone() } }).unwrap_or_default());
        Inicio { logo_elige: false, abierto: false, panel: None, act: None, act_estado: None, act_pedir: None, act_t: 0.0, reloj: 0.0, entrada: -10.0, sel: None, sel_t: -10.0, golpe: None, dedo: None, apretado: None,
            fondos: vec![], fondo: 0, fondo_t: 0.0, fundido: -10.0, ken_t: 0.0, glitch: -10.0, glitch_prox: 14.0, azar: 0x51ed270b, nivel: Nivel::Pleno,
            rec: Recursos::default(), perdidas: Cell::new(false), letras_ok: Cell::new(false), lector: None, version, armado, zonas: vec![], ins: [0.0; 4], desde_juego: false,
            pn: Default::default(), pz: Default::default(), salir: false, cuerpo_nuevo: false, quieto: false,
            lobby: None, lobby_cargados: personaje::Cargados::default(), cielo_ok: false }
    }
}

/// cubic-bezier de CSS: la curva de la animación en el tiempo t (0..1)
pub fn bezier(x1: f32, y1: f32, x2: f32, y2: f32, t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0); if t <= 0.0 || t >= 1.0 { return t; }
    let c = |a: f32, b: f32, s: f32| 3.0 * a * (1.0 - s) * (1.0 - s) * s + 3.0 * b * (1.0 - s) * s * s + s * s * s;
    let (mut lo, mut hi) = (0.0f32, 1.0f32); for _ in 0..24 { let m = (lo + hi) / 2.0; if c(x1, x2, m) < t { lo = m; } else { hi = m; } }
    c(y1, y2, (lo + hi) / 2.0)
}
/// el progreso de una animación con demora (0 antes, 1 después)
pub fn prog(t: f32, demora: f32, dur: f32) -> f32 { ((t - demora) / dur).clamp(0.0, 1.0) }

impl Inicio {
    fn azar(&mut self) -> f32 { self.azar ^= self.azar << 13; self.azar ^= self.azar >> 17; self.azar ^= self.azar << 5; (self.azar % 100000) as f32 / 100000.0 }
    /// el menú vuelve a aparecer (con su entrada)
    pub fn mostrar(&mut self) { self.abierto = true; self.panel = None; self.entrada = self.reloj; self.sel = None; self.glitch_prox = self.reloj + 11.0 + self.azar() * 8.0; }
    /// las texturas se fueron del motor (se vació al cargar un mapa o al cambiar de motor)
    pub fn perder_texturas(&self) { self.perdidas.set(true); self.letras_ok.set(false); }
    /// (para las pruebas) el fondo quieto en la primera escena, agrandado 1,02 (como FONDO() de pruebas/menu_clasico.mjs)
    pub fn fondo_quieto(&mut self) { self.quieto = true; self.fondo = 0; self.fondo_t = 0.0; self.ken_t = 0.0; self.fundido = -10.0; }
    /// (para las pruebas) el glitch del logo ahora
    pub fn glitch_forzar(&mut self) { self.glitch = self.reloj; }
    /// la elegida (clElegir): al pasar a otra, el barrido de luz
    pub fn elegir(&mut self, k: Option<usize>) { if self.sel == k { return; } self.sel = k; if k.is_some() { self.sel_t = self.reloj; } }
}

impl Juego {
    /// abrir el inicio (al arrancar la app y al salir de una partida)
    pub fn inicio_abrir(&mut self) { crate::caja_negra::partida_lista(); self.ini.mostrar(); self.menu = None; self.ajustes = None; self.emotes_panel = false; self.npc_panel = None; self.en_red.panel = false; self.gmod.panel = false; self.dedos.clear(); }
    /// de dónde leer lo de la APK (o de carpetas, en la compu)
    pub fn inicio_lector(&mut self, f: Box<dyn Fn(&str) -> Option<Vec<u8>>>) { self.ini.lector = Some(f); }
    /// el motor se vació: las texturas del inicio se vuelven a subir cuando hagan falta
    pub(super) fn ini_texturas_perdidas(&self) { self.ini.perder_texturas(); }
    fn ini_leer(&self, n: &str) -> Option<Vec<u8>> { self.ini.lector.as_ref().and_then(|f| f(n)) }

    /// lo que hay que tener en el motor antes de dibujar: el atlas (se arma la primera vez), los íconos nuevos y las fotos
    pub(super) fn ini_recursos(&mut self, m: &mut Motor3d) {
        let perdidas = self.ini.perdidas.replace(false);
        if perdidas { self.ini.rec.atlas_subido = false; self.ini.rec.aero_subida = false; for f in self.ini.rec.fotos.values_mut() { f.subida = false; } self.ini.lobby = None; self.ini.lobby_cargados.olvidar(); self.ini.cielo_ok = false; }
        if self.ini.rec.atlas.is_none() && self.ini.rec.error.is_none() {
            match (self.ini_leer("ui/menus.json").and_then(|b| String::from_utf8(b).ok()), self.ini_leer("ui/menus.png")) {
                (Some(j), Some(p)) => match Atlas::armar(&j, p) { Ok((a, px)) => { self.ini.rec.atlas = Some(a); self.ini.rec.atlas_px = Some(px); } Err(e) => self.ini.rec.error = Some(e) },
                _ => self.ini.rec.error = Some("faltan ui/menus.json y ui/menus.png (herramientas/atlas_menus.py)".into()),
            }
        }
        if let Some(a) = &self.ini.rec.atlas { if !self.ini.rec.atlas_subido {
            // (los píxeles se guardan sólo hasta subirlos; si el motor se vacía, se vuelve a armar desde el PNG)
            let px = match self.ini.rec.atlas_px.take() { Some(p) => Some(p), None => match (self.ini_leer("ui/menus.json").and_then(|b| String::from_utf8(b).ok()), self.ini_leer("ui/menus.png")) { (Some(j), Some(p)) => Atlas::armar(&j, p).ok().map(|x| x.1), _ => None } };
            if let Some(px) = px { self.ini.rec.atlas_subido = pincel::subir_tex(m, pincel::TEX_MENUS, a.w, a.h, px); }
        } }
        if !self.ini.rec.aero_subida { let (w, h, px) = aero::textura(); self.ini.rec.aero_subida = pincel::subir_tex(m, aero::TEX_AERO, w, h, px); }
        self.ini.rec.ico.subir(m, perdidas); self.ini.rec.gl.subir(m, perdidas);
        // (las fotos que esperan: se suben y se olvidan los píxeles; las que se perdieron, se vuelven a leer)
        let faltan: Vec<String> = self.ini.rec.fotos.iter().filter(|(_, f)| !f.subida).map(|(k, _)| k.clone()).collect();
        for k in faltan {
            let px = match self.ini.rec.fotos.get_mut(&k).and_then(|f| f.px.take()) { Some(p) => Some(p), None => self.ini_foto_px(&k).map(|x| x.2) };
            if let (Some(px), Some(f)) = (px, self.ini.rec.fotos.get_mut(&k)) { f.subida = pincel::subir_tex(m, f.id, f.w, f.h, px); }
        }
    }
    /// los píxeles de una foto: «a:archivo» de la APK, «i:nombre» un ícono del paquete del juego (DATA.ico)
    fn ini_foto_px(&self, k: &str) -> Option<(u32, u32, Vec<u8>)> {
        if let Some(o) = k.strip_prefix("b:") { let (w, h, px) = self.ini_foto_px(o)?; return Some(aero::desenfocar(w, h, px)); }
        let b = if let Some(n) = k.strip_prefix("a:") { self.ini_leer(n)? }
            else if let Some(n) = k.strip_prefix("i:") { let p = self.paq.as_ref()?; let id = p.d["ico"][n].as_str()?; p.parte(&format!("i:{id}"))?.to_vec() }
            // (el logo: el tuyo —Ajustes → Tu logo, logo.png en los datos— o el de JXMod)
            else if k == "logo" { self.datos.as_ref().and_then(|d| std::fs::read(d.join("logo.png")).ok()).unwrap_or_else(|| include_bytes!("../../../juego/logo_jxm.webp").to_vec()) }
            else { return None };
        let (w, h, px) = pincel::decodificar(&b)?;
        // (las fotos de fondo hasta 1280; los íconos como vienen)
        Some(pincel::achicar(w, h, px, 1280))
    }
    /// una foto lista para dibujar (o None mientras no está: se pide y llega en el cuadro siguiente)
    /// «Tu logo» (milogo.js): elegir una imagen del celular y que sea el logo del menú; la segunda opción vuelve al de JXMod
    pub(crate) fn logo_accion(&mut self, k: usize) {
        if k == 1 { if let Some(d) = &self.datos { let _ = std::fs::remove_file(d.join("logo.png")); } self.ini_sacar_foto("logo"); self.avisar("Volvió el logo de JXMod".into()); return; }
        let hay = match &self.ini.pn.bf.app { Some(a) => { a.olvidar(); a.elegir(); true } None => false };
        if hay { self.ini.logo_elige = true; } else { self.avisar("Elegir una imagen sólo anda en el celular".into()); }
    }
    /// cada cuadro, mientras se elige: cuando llega la imagen, Android la pasa a PNG, se guarda y pasa a ser el logo
    pub(crate) fn logo_paso(&mut self) {
        if !self.ini.logo_elige { return; }
        let Some(e) = self.ini.pn.bf.app.as_ref().map(|a| a.estado()) else { self.ini.logo_elige = false; return };
        if e == "eligiendo" { return; }
        self.ini.logo_elige = false;
        let Some(d) = self.datos.clone() else { return };
        let msg = if e.starts_with("listo|") {
            let dst = d.join("logo_nuevo.png"); let ok = self.ini.pn.bf.app.as_ref().is_some_and(|a| a.png(&dst.to_string_lossy()));
            let bien = ok && std::fs::read(&dst).ok().and_then(|b| pincel::decodificar(&b)).is_some();
            if bien { let _ = std::fs::rename(&dst, d.join("logo.png")); self.ini_sacar_foto("logo"); "Listo: ése es tu logo (Ajustes → Tu logo → El de JXMod lo saca)".to_string() }
            else { let _ = std::fs::remove_file(&dst); "Esa imagen no se pudo usar: elegí una foto (PNG, JPG o WebP)".to_string() }
        } else if let Some(m) = e.strip_prefix("error|") { format!("No se pudo: {m}") } else if e == "grande" { "La imagen es muy grande".to_string() } else { return };
        if let Some(a) = &self.ini.pn.bf.app { a.olvidar(); }
        self.avisar(msg);
    }
    /// (para las pruebas) ¿ya está esa foto en la placa?
    pub fn ini_foto_lista(&self, k: &str) -> bool { self.ini_foto(k).is_some() }
    pub(super) fn ini_foto(&self, k: &str) -> Option<(i64, f32, f32)> { self.ini.rec.fotos.get(k).filter(|f| f.subida).map(|f| (f.id, f.w as f32, f.h as f32)) }
    /// una foto ya decodificada en la textura `id` (la de otra que se olvidó: el motor pisa la vieja y la libera)
    pub(super) fn ini_poner_foto_id(&mut self, k: &str, id: i64, w: u32, h: u32, px: Vec<u8>) { self.ini.rec.fotos.insert(k.to_string(), Foto { id, w, h, subida: false, px: Some(px) }); }
    /// sacar una foto de la lista (devuelve su número de textura, para reusarlo)
    pub(super) fn ini_sacar_foto(&mut self, k: &str) -> Option<i64> { self.ini.rec.fotos.remove(k).map(|f| f.id) }
    /// una foto ya decodificada (las de la Workshop): se sube en el próximo cuadro
    pub(super) fn ini_poner_foto(&mut self, k: &str, w: u32, h: u32, px: Vec<u8>) {
        if self.ini.rec.fotos.contains_key(k) { return; }
        self.ini.rec.sig_foto += 1; let id = TEX_FOTOS - self.ini.rec.sig_foto;
        self.ini.rec.fotos.insert(k.to_string(), Foto { id, w, h, subida: false, px: Some(px) });
    }
    /// pedir una foto (se lee ahora y se sube en el próximo cuadro)
    pub(super) fn ini_pedir_foto(&mut self, k: &str) -> bool {
        if self.ini.rec.fotos.contains_key(k) { return true; }
        let Some((w, h, px)) = self.ini_foto_px(k) else { return false };
        // (las del fondo, con su copia desenfocada para el vidrio, hecha de los mismos píxeles)
        if self.ini.fondos.iter().any(|f| f == k) && !self.ini.rec.fotos.contains_key(&format!("b:{k}")) {
            let (bw, bh, bpx) = aero::desenfocar(w, h, px.clone());
            self.ini.rec.sig_foto += 1; let id = TEX_FOTOS - self.ini.rec.sig_foto;
            self.ini.rec.fotos.insert(format!("b:{k}"), Foto { id, w: bw, h: bh, subida: false, px: Some(bpx) });
        }
        self.ini.rec.sig_foto += 1; let id = TEX_FOTOS - self.ini.rec.sig_foto;
        self.ini.rec.fotos.insert(k.to_string(), Foto { id, w, h, subida: false, px: Some(px) });
        true
    }

    /// las escenas de fondo: las de la APK (fondos/1.webp, 2…: las de PAQUETE/fondos, como FONDOS_RB) o, sin ellas, los
    /// íconos de los mapas (como la web sin FONDOS_RB)
    fn ini_fondos(&mut self) {
        if !self.ini.fondos.is_empty() { return; }
        let mut v = vec![]; for k in 1..=24 { let n = format!("fondos/{k}.webp"); if self.ini_leer(&n).is_some() { v.push(format!("a:{n}")); } else { break; } }
        if v.is_empty() { v = self.mapas_inicio().iter().map(|m| format!("i:mapa_{m}")).collect(); }
        self.ini.fondos = v;
    }
    /// los mapas de «Empezar partida nueva» (los de la versión personal, MAPAS_RB con JXP: gm_construct y gm_flatgrass; si el
    /// paquete no los tiene, todos)
    pub(super) fn mapas_inicio(&self) -> Vec<String> {
        // (primero el de inicio —gm_construct Windows 7, del Workshop—, gm_flatgrass y después los bajados)
        let ini = super::mapas_juego::MAPA_INICIAL.0;
        let mut v: Vec<String> = [ini, "RB_Flatgrass"].iter().filter(|m| self.mapas.iter().any(|x| x == *m)).map(|s| s.to_string()).collect();
        if v.is_empty() { return self.mapas.clone(); }
        // (y los bajados: los .bsp de los addons del Workshop —WS_…—, como «Garry's Mod» en la web)
        v.extend(self.mapas_bajados().into_iter().filter(|m| m != ini)); v
    }
    /// los mapas bajados del Workshop (los .bsp de los addons prendidos; el de inicio, si ya está bajado)
    pub(super) fn mapas_bajados(&self) -> Vec<String> { self.mapas.iter().filter(|m| m.starts_with("WS_") && (m.as_str() != super::mapas_juego::MAPA_INICIAL.0 || self.mj.ws.iter().any(|w| w.clave == **m))).cloned().collect() }

    /// un cuadro con el inicio a la vista: sin el juego, sólo el fondo, el menú o un panel (y lo que esté abierto encima)
    pub(super) unsafe fn ini_cuadro(&mut self, m: &mut Motor3d, w: i32, h: i32) -> Result<(), String> {
        let ahora = Instant::now(); let dt = self.dt_fijo.unwrap_or((ahora - self.t_ant).as_secs_f32().min(0.1)); self.t_ant = ahora;
        let (wf, hf) = (w as f32, h as f32);
        self.ini.reloj += dt;
        // (la actualización: se le pregunta a Java cada medio segundo)
        self.ini.act_t -= dt; if self.ini.act_t <= 0.0 { self.ini.act_t = 0.5; if let Some(f) = &self.ini.act_estado { self.ini.act = act_de(&f()); } }
        self.ini.nivel = if self.aj.calidad == 0 { Nivel::Quieto } else if self.aj.calidad == 1 { Nivel::Bajo } else { Nivel::Pleno };
        m.opciones(&self.aj.opciones()); self.sonido.volumen = self.aj.volumen();
        self.escrito_paso();
        // (los mapas bajados del Workshop, a la lista de Partida nueva)
        self.mapas_registrar();
        self.ini_red(dt);
        self.ini_fondos();
        self.ini_paso(dt);
        // (las letras del HUD, por si algo las usa —el cartel de error sin el atlas de los menús—)
        if !self.ini.letras_ok.get() { self.cargar_letras(m); self.ini.letras_ok.set(true); }
        self.ini_recursos(m);
        let u = self.ini_tandas(wf, hf);
        self.ini_recursos_ico(m);
        let tres = self.ini_lobby(m, wf, hf, dt);
        let r = m.dibujar(w, h, tres, &u);
        if self.ini.rec.error.is_some() && self.error.is_none() { self.error = self.ini.rec.error.clone(); }
        r
    }
    /// el personaje elegido en 3D detrás del panel Personajes (dibujarLobby y lobbyEncuadre de menu.js: la cámara de 60°, los
    /// pies al 92 % del escenario y la coronilla al 17 %, centrado; mirando a la cámara y un poco girado —y lo que se arrastró—),
    /// con su animación de quieto, sobre un fondo oscuro. Devuelve si hay algo en 3D para dibujar
    unsafe fn ini_lobby(&mut self, m: &mut Motor3d, w: f32, h: f32, dt: f32) -> bool {
        if !matches!(self.ini.panel, Some(super::paneles_juego::PanelIni::Personajes { .. })) || self.mapa.is_some() { return false; }
        let e = self.ini.pn.escena; if e[2] < 20.0 || e[3] < 20.0 { return false; }
        let skin = self.skin.clone();
        if self.ini.lobby.as_ref().map(|l| l.1 != skin).unwrap_or(true) {
            let Some(paq) = self.paq.as_mut() else { return false };
            let r = Personaje::cargar(paq, &skin, 0, 512, &mut self.ini.lobby_cargados).or_else(|_| Personaje::cargar(paq, "Hero", 0, 512, &mut self.ini.lobby_cargados));
            let Ok((mut pj, esc)) = r else { return false };
            if let Some((a, b)) = &self.nado { let _ = pj.nado(a, b); }
            if m.cargar(&esc).is_err() { return false; }
            self.ini.lobby = Some((pj, skin));
        }
        if !self.ini.cielo_ok {
            // (el fondo del lobby: un degradé casi parejo, gris oscuro)
            let g = [0.118f32, 0.125, 0.137];
            let cab = jxmotor::escena::Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![], texs: vec![], lms: vec![], items: vec![], agua: None,
                cielo: Some(jxmotor::escena::Cielo { top: g, mid: g, bot: [0.1, 0.105, 0.115], exp: [1.0, 1.0], tinte: [1.0; 3], dia: 0.0, k: 1.0, cubo: 0, caras: None }) };
            self.ini.cielo_ok = m.cargar(&jxmotor::escena::Escena { c: cab, datos: vec![] }).is_ok();
        }
        let Some((pj, _)) = self.ini.lobby.as_mut() else { return false };
        // (el encuadre: con el alto del personaje, la distancia a la que ocupa del 17 % al 92 % del escenario)
        let cam = [0.0f32, 600.0, 0.0]; let tv = (30.0f32).to_radians().tan(); let asp = w / h; let k = pj.tam.max(0.3);
        let (alto, ancho) = (1.82 * k, 0.62 * k);
        let px = ((0.92 - 0.17) * e[3]).min(e[2] * 0.62 * alto / ancho);
        let d = alto * h / (2.0 * tv * px); let pies = e[1] + 0.92 * e[3]; let nx = ((e[0] + e[2] / 2.0) / w) * 2.0 - 1.0; let ny = 1.0 - (pies / h) * 2.0;
        let piso = [cam[0] - nx * d * tv * asp, cam[1] + ny * d * tv, cam[2] + d];
        let yaw = std::f32::consts::PI + 0.25 + self.ini.pn.giro;
        let est = personaje::Estado { piso, vel: [0.0; 3], yaw, mira: 0.0, en_suelo: true, agachado: false, agua: None };
        pj.animar(dt, &est);
        let mut items = vec![]; pj.items(&personaje::base(piso, yaw), &mut items);
        let p = persp(60f32.to_radians(), asp, 0.1, 50.0 + d * 2.0); let vista = m4::mirar(cam, [cam[0], cam[1], cam[2] + 1.0], [0.0, 1.0, 0.0]);
        let s = [-0.35f32, 0.75, -0.55]; let n = (s[0] * s[0] + s[1] * s[1] + s[2] * s[2]).sqrt();
        let luz = jxmotor::escena::Luz { sol: [s[0] / n, s[1] / n, s[2] / n], sol_c: [1.5, 1.42, 1.3], amb_s: [0.36, 0.38, 0.44], amb_g: [0.16, 0.15, 0.13],
            nie: jxmotor::escena::Niebla { c: [0.012, 0.014, 0.017], a: 500.0, b: 900.0, m: 0.0, s: [0.0; 3] }, expo: 1.0 };
        m.poner_cuadro(jxmotor::escena::Cuadro { vp: m4::mul(&p, &vista), pos: cam, luz, agua_y: None, suelo_y: None, tiempo: self.ini.reloj, luces: vec![], esp: vec![], items, efectos: vec![] });
        true
    }
    /// (los íconos que se pintaron recién en este cuadro: a la placa antes de dibujar)
    fn ini_recursos_ico(&mut self, m: &mut Motor3d) { self.ini.rec.ico.subir(m, false); self.ini.rec.gl.subir(m, false); }
    /// el multijugador mientras se mira la lista (sin mapa: sólo la conexión y la lista de salas)
    fn ini_red(&mut self, dt: f32) {
        if !matches!(self.ini.panel, Some(super::paneles_juego::PanelIni::Multi { .. })) { return; }
        let Some(mut pu) = self.en_red.puente.take() else { return };
        self.en_red.red.mirando_lista(); pu.bombear(&mut self.en_red.red);
        let local = jxjuego::red::Local::default(); self.en_red.red.paso(dt as f64, &local); let _ = self.en_red.red.eventos();
        pu.bombear(&mut self.en_red.red); self.en_red.puente = Some(pu);
    }
    /// lo que pasa solo: el fondo cada 9 s, el glitch del logo, las fotos que hacen falta
    fn ini_paso(&mut self, dt: f32) {
        let ini = &mut self.ini;
        if ini.nivel != Nivel::Quieto && !ini.fondos.is_empty() && !ini.quieto {
            ini.fondo_t += dt; ini.ken_t += dt;
            if ini.fondo_t >= 9.0 && ini.fondos.len() > 1 { ini.fondo_t = 0.0; ini.fondo = (ini.fondo + 1) % ini.fondos.len(); ini.fundido = ini.reloj; }
        }
        if ini.nivel == Nivel::Pleno && ini.panel.is_none() && ini.reloj >= ini.glitch_prox { ini.glitch = ini.reloj; let a = ini.azar(); ini.glitch_prox = ini.reloj + 11.0 + a * 8.0; }
        if let Some((_, t)) = ini.golpe { if ini.reloj - t > 0.3 { ini.golpe = None; } }
        // (las fotos del fondo: la que va y la que viene; el logo)
        let n = ini.fondos.len();
        let pedir: Vec<String> = if n > 0 { vec![ini.fondos[ini.fondo].clone(), ini.fondos[(ini.fondo + n - 1) % n].clone(), "logo".into()] } else { vec!["logo".into()] };
        for k in pedir { self.ini_pedir_foto(&k); }
        // (las que ya no se ven se olvidan: con 1 GB no sobra)
        if n > 2 { let quedan: Vec<String> = vec![self.ini.fondos[self.ini.fondo].clone(), self.ini.fondos[(self.ini.fondo + n - 1) % n].clone()];
            let fuera: Vec<String> = self.ini.rec.fotos.keys().filter(|k| { let b = k.strip_prefix("b:").unwrap_or(k); self.ini.fondos.iter().any(|f| f == b) && !quedan.iter().any(|q| q == b) }).cloned().collect();
            for k in fuera { self.ini.rec.fotos.remove(&k); } }
    }

    /// todo lo que se dibuja del inicio
    fn ini_tandas(&mut self, w: f32, h: f32) -> Vec<(i64, Vec<f32>)> {
        // (el atlas y los íconos salen del estado mientras se dibuja: el pincel los usa y lo demás se sigue leyendo)
        let atlas = self.ini.rec.atlas.take(); let mut ico = std::mem::take(&mut self.ini.rec.ico); let mut gl = std::mem::take(&mut self.ini.rec.gl);
        let r = match atlas.as_ref() {
            Some(at) => {
                let mut p = Pincel::nuevo(at, &mut ico, &mut gl);
                p.vidrio = self.ini_vidrio(w, h);
                self.ini_fondo_dibujar(&mut p, w, h);
                match self.ini.panel.clone() { None => { let z = self.aero_home(&mut p, w, h); self.ini.zonas = z; } Some(pn) => { self.ini.zonas.clear(); self.pn_dibujar(&mut p, &pn, w, h) } }
                if self.cont.abierta { let z = self.cont_dibujar(&mut p, w, h); self.cont.zonas = z; }
                p.tandas
            }
            None => vec![],
        };
        self.ini.rec.atlas = atlas; self.ini.rec.ico = ico; self.ini.rec.gl = gl;
        // (lo de siempre encima: el aviso —un cartel chico, como menuAviso— y lo que salió mal)
        let mut r = r;
        if let Some(at) = self.ini.rec.atlas.take() { let mut ico = std::mem::take(&mut self.ini.rec.ico); let mut gl = std::mem::take(&mut self.ini.rec.gl);
            { let mut p = Pincel::nuevo(&at, &mut ico, &mut gl); let f = (0.034 * h).clamp(14.0, 18.0);
              if let Some((a, ta)) = &self.aviso { let t = ta.elapsed().as_secs_f32(); if t < 4.0 { let k = (t / 0.2).min(1.0) * ((4.0 - t) / 0.3).min(1.0);
                  let rs = at.renglones(Cara::S4, f, 0.0, a, (w * 0.7).min(620.0)); let ancho = rs.iter().map(|x| at.ancho(Cara::S4, f, 0.0, x)).fold(0.0f32, f32::max); let lh = f * 1.4;
                  let (cw, ch) = (ancho + f * 3.0, rs.len() as f32 * lh + f * 1.4); let (x0, y0) = ((w - cw) / 2.0, h * 0.62);
                  // (como los globos de aviso de Vista: blanco a celeste, el borde gris, la sombra suave y el texto oscuro)
                  p.con_alfa(k, |p| { use aero::Aero; let u = aero::unidad(w, h); let ra = [4.0 * u; 4]; let c = aero::camino(x0, y0, cw, ch, ra);
                      p.nube(x0, y0 + 2.0 * u, cw, ch, 10.0 * u, [0.0, 0.0, 0.0, 0.35], false);
                      p.degrade(&c, true, y0, y0 + ch, &[(0.0, rgba(0xffffff, 1.0)), (1.0, rgba(0xe3ebf6, 1.0))]); p.contorno(x0, y0, cw, ch, ra, 1.0, rgba(0x767676, 1.0));
                      p.icono("info", x0 + f * 0.55, y0 + (ch - f * 1.1) / 2.0, f * 1.1, 2.2, rgba(0x1c5fb0, 1.0));
                      for (i, rr) in rs.iter().enumerate() { let base = p.at.base_centrada(Cara::S4, f, lh, y0 + f * 0.7 + i as f32 * lh, lh); p.texto(Cara::S4, f, x0 + f * 2.1, base, aero::TXT, 0.0, rr); } }); } }
              if let Some(e) = &self.error { let rs = at.renglones(Cara::S4, f, 0.0, e, w * 0.8); let ch = (rs.len() + 1) as f32 * f * 1.4 + f; p.rect(w * 0.08, h * 0.3, w * 0.84, ch, rgba(0x5a0000, 0.9));
                  p.texto(Cara::S7, f, w * 0.1, h * 0.3 + f * 1.4, rgba(0xffd84d, 1.0), 0.0, "Algo salió mal (sacale una captura):");
                  for (i, rr) in rs.iter().enumerate() { p.texto(Cara::S4, f, w * 0.1, h * 0.3 + f * 1.4 * (i as f32 + 2.0), TX, 0.0, rr); } }
              r.extend(p.tandas); }
            self.ini.rec.atlas = Some(at); self.ini.rec.ico = ico; self.ini.rec.gl = gl;
        } else if let Some(l) = &self.letras { let mut u = vec![]; let t = h * 0.032;
            if let Some(e) = &self.error { l.texto(&mut u, w * 0.1, h * 0.3, t * 0.75, [1.0, 0.85, 0.3, 1.0], &format!("Algo salió mal: {}", e.chars().take(110).collect::<String>())); }
            if !u.is_empty() { r.push((TEX_LETRAS, u)); } }
        r
    }

    /// el Ken Burns de ahora (clKenPaso: de 1,02 a 1,13 y un poco a la izquierda, ida y vuelta en 26 s, de a saltos de 1/6 s):
    /// la escala y el corrimiento
    pub(super) fn ini_ken(&self, w: f32) -> (f32, f32) {
        let ini = &self.ini;
        let ken = if ini.nivel == Nivel::Quieto { 0.0 } else { let paso = if ini.nivel == Nivel::Bajo { 0.5 } else { 1.0 / 6.0 }; let t = ((ini.ken_t / paso).floor() * paso) % 52.0; if t < 26.0 { t / 26.0 } else { 2.0 - t / 26.0 } };
        (1.02 + 0.11 * ken, -0.016 * ken * w)
    }
    /// las escenas del fondo que se ven y su opacidad, en el orden en que se dibujan (al aparecer, la primera se funde desde
    /// el negro; después, la nueva sobre la anterior en 1,8 s)
    pub(super) fn ini_capas(&self) -> Vec<(String, f32)> {
        let ini = &self.ini; let n = ini.fondos.len(); if n == 0 { return vec![]; }
        let f = ((ini.reloj - ini.fundido) / 1.8).clamp(0.0, 1.0); let f0 = ((ini.reloj - ini.entrada.min(0.0).max(-0.0)) / 1.8).clamp(0.0, 1.0);
        let mut v = vec![];
        if f < 1.0 { v.push((ini.fondos[(ini.fondo + n - 1) % n].clone(), 1.0 - f)); }
        v.push((ini.fondos[ini.fondo].clone(), if ini.fundido < 0.0 { f0 } else { f }));
        v.retain(|c| c.1 > 0.0); v
    }
    /// lo que se ve detrás del vidrio (aero.rs): las mismas escenas, desenfocadas, con el mismo Ken Burns. Jugando (sin el
    /// fondo de fotos) o en Personajes (el lobby en 3D), nada: el vidrio va liso
    pub(super) fn ini_vidrio(&self, w: f32, h: f32) -> Option<pincel::Vidrio> {
        if (self.mapa.is_some() && self.ini.desde_juego) || matches!(self.ini.panel, Some(super::paneles_juego::PanelIni::Personajes { .. })) { return None; }
        let (s, dx) = self.ini_ken(w); let mut v = pincel::Vidrio::default();
        let mapa = |tw: f32, th: f32| { let kc = (w / tw).max(h / th); let (vw, vh) = (w / kc / tw, h / kc / th); let (u0, v0) = ((1.0 - vw) * 0.5, (1.0 - vh) * 0.5);
            [vw / (w * s), u0 + vw / w * (w / 2.0 - (w / 2.0 + dx) / s), vh / (h * s), v0 + vh / h * (h / 2.0 - h / 2.0 / s)] };
        for (k, a) in self.ini_capas() {
            if let Some((id, tw, th)) = self.ini_foto(&format!("b:{k}")) { v.capas.push((id, mapa(tw, th), a)); }
            if let Some((id, tw, th)) = self.ini_foto(&k) { v.nitidas.push((id, mapa(tw, th), a)); }
        }
        if v.capas.is_empty() { None } else { Some(v) }
    }
    /// el fondo: las dos escenas que se funden (opacidad en 1,8 s), agrandadas despacio (clKenPaso: de 1,02 a 1,13 y un poco a
    /// la izquierda, ida y vuelta en 26 s, de a saltos de 1/6 s), la sombra de la izquierda (.rbSombra), el grano y la viñeta
    /// (.clGrano: opacidad 0,2)
    fn ini_fondo_dibujar(&self, p: &mut Pincel, w: f32, h: f32) {
        let ini = &self.ini;
        // (en Personajes, el lobby en 3D atrás —rb3d: sin las escenas ni la sombra—)
        if matches!(ini.panel, Some(super::paneles_juego::PanelIni::Personajes { .. })) && self.mapa.is_none() { if ini.lobby.is_none() { p.rect(0.0, 0.0, w, h, rgba(0x1e2023, 1.0)); } return; }
        p.rect(0.0, 0.0, w, h, [0.0, 0.0, 0.0, 1.0]);
        let (s, dx) = self.ini_ken(w);
        if ini.fondos.is_empty() { p.rect(0.0, 0.0, w, h, rgba(0x1a1d24, 1.0)); }
        for (k, a) in self.ini_capas() {
            let Some((id, tw, th)) = self.ini_foto(&k) else { p.rect(0.0, 0.0, w, h, con_a(rgba(0x1a1d24, 1.0), a)); continue };
            p.con(pincel::mm(pincel::mover(dx, 0.0), pincel::escalar_en(s, s, w / 2.0, h / 2.0)), |p| p.foto_cubre(id, tw, th, 0.0, 0.0, w, h, [0.5, 0.5], [1.0, 1.0, 1.0, a]));
        }
        // (.rbSombra del inicio: de la izquierda, negro 0,42 hasta la mitad)
        p.degrade_h(0.0, 0.0, w, h, &[(0.0, [0.0, 0.0, 0.0, 0.42]), (0.5, [0.0, 0.0, 0.0, 0.0])]);
        if self.ini.panel.is_some() { return; }
        // (.clGrano, con opacidad 0,2: el grano quieto y la viñeta suave —elipse en 62 % 42 %, de 52 % a 100 %: negro 0,32—)
        p.grano(0.0, 0.0, w, h, 0.0, 0.0, 0.2);
        let (cx, cy) = (0.62 * w, 0.42 * h); let (rx, ry) = (std::f32::consts::SQRT_2 * cx.max(w - cx), std::f32::consts::SQRT_2 * cy.max(h - cy));
        p.con_recorte([0.0, 0.0, w, h], |p| { let n = 48;
            for k in 0..8 { let (t0, t1) = (0.52 + 0.48 * k as f32 / 8.0, 0.52 + 0.48 * (k + 1) as f32 / 8.0); let (a0, a1) = (0.32 * 0.2 * (t0 - 0.52) / 0.48, 0.32 * 0.2 * (t1 - 0.52) / 0.48);
                for i in 0..n { let (g0, g1) = (i as f32 / n as f32 * std::f32::consts::TAU, (i + 1) as f32 / n as f32 * std::f32::consts::TAU);
                    let q = |t: f32, g: f32| [cx + rx * t * g.cos(), cy + ry * t * g.sin()];
                    let b = [8.0 / p.at.w as f32, 8.0 / p.at.h as f32];
                    p.quad(pincel::TEX_MENUS, [q(t0, g0), q(t0, g1), q(t1, g1), q(t1, g0)], [b; 4], [[0.0, 0.0, 0.0, a0], [0.0, 0.0, 0.0, a0], [0.0, 0.0, 0.0, a1], [0.0, 0.0, 0.0, a1]]); } } });
    }

    /// qué hay en (x, y) del menú: la opción (con lo que se toca de más arriba y abajo) o la placa (44 px de alto para tocar)
    pub(super) fn ini_pieza_en(&self, x: f32, y: f32) -> Option<Pieza> {
        self.ini.zonas.iter().rev().find(|(r, _)| aero::dentro(*r, x, y)).map(|z| z.1)
    }
    /// dónde está una pieza del inicio (para las pruebas)
    pub fn ini_zona(&self, pz: Pieza) -> Option<[f32; 4]> { self.ini.zonas.iter().find(|z| z.1 == pz).map(|z| z.0) }

    // —— el tacto: devuelve true si el inicio (o algo de este módulo) se queda con el toque ——
    pub(super) fn ini_dedo_abajo(&mut self, id: i32, x: f32, y: f32, w: f32, h: f32) -> bool {
        if !self.ini.abierto { return self.pz_dedo_abajo(id, x, y, w, h); }
        if self.cont.abierta { self.cont_dedo_abajo(id, x, y); return true; }
        if self.ajustes.is_some() || self.en_red.panel || self.gmod.panel { return false; }
        if self.ini.panel.is_some() { self.pn_dedo_abajo(id, x, y, w, h); return true; }
        let pz = self.ini_pieza_en(x, y);
        if let Some(pz) = pz { if self.ini.nivel != Nivel::Quieto { self.ini.golpe = Some((pz, self.ini.reloj)); } if let Pieza::Op(i) = pz { self.ini.elegir(Some(i)); } }
        self.ini.apretado = pz; self.ini.dedo = Some((id, pz, x, y));
        true
    }
    pub(super) fn ini_dedo_mueve(&mut self, id: i32, x: f32, y: f32, h: f32) -> bool {
        if !self.ini.abierto { return self.pz_dedo_mueve(id, x, y, h); }
        if self.cont.abierta { self.cont_dedo_mueve(id, x, y); return true; }
        if self.ajustes.is_some() || self.en_red.panel || self.gmod.panel { return false; }
        if self.ini.panel.is_some() { self.pn_dedo_mueve(id, x, y, h); return true; }
        if let Some((d, pz, _, _)) = self.ini.dedo { if d == id { let ahora = self.ini_pieza_en(x, y); if ahora != pz { self.ini.apretado = None; } } }
        true
    }
    pub(super) fn ini_dedo_arriba(&mut self, id: i32, w: f32, h: f32) -> bool {
        if !self.ini.abierto { return self.pz_dedo_arriba(id, w, h); }
        if self.cont.abierta { self.cont_dedo_arriba(id); return true; }
        if self.ajustes.is_some() || self.en_red.panel || self.gmod.panel { return false; }
        if self.ini.panel.is_some() { self.pn_dedo_arriba(id, w, h); return true; }
        let Some((d, pz, _, _)) = self.ini.dedo else { return true }; if d != id { return true; }
        self.ini.dedo = None; let suelto = self.ini.apretado.take();
        // (al soltar el dedo, la elegida vuelve a ser la principal: pointerleave)
        self.ini.elegir(None);
        if let (Some(a), Some(b)) = (pz, suelto) { if a == b { self.sonido.tocar("Click", 0.5, 1.0, None); self.ini_accion(a); } }
        true
    }
    /// lo que hace cada cosa del menú (inicioAccion)
    pub(super) fn ini_accion(&mut self, pz: Pieza) {
        use super::paneles_juego::PanelIni as P;
        match pz {
            Pieza::Op(i) => match CL_K[i] {
                "nueva" => self.pn_abrir(P::Nueva { cat: 0, scroll: 0.0 }),
                "multi" => self.pn_abrir(P::Multi { scroll: 0.0 }),
                "social" => self.pn_abrir(P::Social { tab: 0, scroll: 0.0 }),
                "tienda" => self.pn_abrir(P::Tienda { tab: 0, cat: 0 }),
                "crear" => self.pn_abrir(P::Crear),
                "personajes" => self.pn_abrir(P::Personajes { tab: 0, scroll: 0.0 }),
                "opciones" => self.pn_abrir(P::Opciones { tab: 0, scroll: 0.0 }),
                _ => self.ini_salir(),
            },
            Pieza::Mods => self.pn_abrir(P::Tienda { tab: 0, cat: 0 }),
            Pieza::Idioma => self.pn_abrir(P::Idioma),
            Pieza::Nombre => { let n = self.en_red.red.nombre.clone(); self.pedir_texto(Escribir::Nombre, "Tu nombre", &n, 16, false); }
            Pieza::Discord => self.avisar("Discord de JXStudios: discord.gg/bsdThEjje".into()),
            Pieza::TikTok => self.avisar("TikTok de JXStudios: @jxstudios1".into()),
            Pieza::Avisos => self.pn_abrir(P::Avisos),
            Pieza::Bugs => self.pn_abrir(P::Bugs { tab: 0, scroll: 0.0 }),
            Pieza::Grieta => self.pn_abrir(P::Grieta),
            Pieza::Novedades => self.pn_abrir(P::Bugs { tab: 3, scroll: 0.0 }),
            Pieza::Contenido => self.cont_abrir(),
            Pieza::Actualizar => { if let Some(f) = &self.ini.act_pedir { f(); } self.ini.act_t = 0.0; }
        }
    }
    /// «Salir»: en el celular cierra la app (como la de la web: JXNativo.salir); en la compu no hace nada
    fn ini_salir(&mut self) { self.ini.salir = true; }
}
