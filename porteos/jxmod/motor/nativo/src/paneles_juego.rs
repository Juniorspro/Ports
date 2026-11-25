//! Los paneles del inicio (inicio.js, rbmenus.js, panel_juego.js), ahora como ventanas de vidrio Aero (aero.rs): el marco
//! de vidrio con el título, la flecha azul para volver y la X roja; adentro, vidrio oscuro (como los reproductores de Vista)
//! con la barra de arriba (la dirección «JXMod › sección» y las pestañas), las placas redondeadas con brillo, el azul Aero
//! para lo elegido y lo principal, y la barra de abajo con «Volver». Las medidas salen de las mismas variables de la web
//! (--pnU, --pnH, --pnFt, --pnFs, --pnFg: clamp del alto de la pantalla). Lo que necesita una cuenta o la red de la tienda
//! (Social, la tienda de mods, los avisos y los bugs publicados) muestra lo mismo que la web sin conexión.
use super::*;
use super::inicio_juego::{bezier, prog, Nivel};
use super::aero::{self, blanco, negro, Aero, OpVentana};
use crate::pincel::{self, rgba, con_a, Cara, Col, Pincel};

// —— los colores de los paneles (--pn…) ——
const PN_PL: Col = rgba(0x0a0e14, 0.80);
const PN_PL1: Col = rgba(0x101722, 1.0);
const PN_PL2: Col = rgba(0x172130, 1.0);
const PN_PL3: Col = rgba(0x22324a, 1.0);
const PN_POZO: Col = rgba(0x070b11, 0.92);
const PN_LIN: Col = rgba(0xffffff, 0.13);
const PN_LIN2: Col = rgba(0xffffff, 0.25);
const PN_T2: Col = rgba(0xc6d1de, 1.0);
const PN_T3: Col = rgba(0x97a5b7, 1.0);
/// el azul Aero (lo elegido y lo principal), el texto sobre él y el texto de siempre
const AMA: Col = rgba(0x2f8ae8, 1.0);
const NEGRO: Col = rgba(0xffffff, 1.0);
const TX: Col = rgba(0xf1f5fa, 1.0);
const PN_VI: Col = rgba(0xc39dff, 1.0);

/// el panel abierto (lo de inicioPanel) y su estado
#[derive(Clone, Debug, PartialEq)]
pub enum PanelIni {
    Nueva { cat: usize, scroll: f32 }, Multi { scroll: f32 }, Social { tab: usize }, Tienda { tab: usize, cat: usize }, Crear,
    Personajes { tab: usize, scroll: f32 }, Opciones { tab: usize, scroll: f32 }, Idioma, Avisos, Bugs { tab: usize, scroll: f32 }, Grieta,
    /// el formulario de Crear server (panelMultiCrear)
    CrearServer { scroll: f32 },
}

/// lo que hace cada cosa que se toca en un panel
#[derive(Clone, Debug, PartialEq)]
pub enum Acc { Volver, Cerrar, Cat(usize), Mapa(String), Empezar, Hora, Mods, Vr, Entrar(String), MasLleno, CrearServer, Lan, Refrescar, Buscar, Tab(usize), Skin(String),
    CrearBase(String), CrearEmpezar, AjTab(usize), Aj(usize, usize), Listo, Idioma(usize), GMod, CuentaNo, NovVer, Nada,
    /// Crear server: el nombre, la clave, el modo (PvP o no), prender PvP / RPG / nextbots (0, 1, 2), los topes (0 props,
    /// 1 autos: más o menos un paso) y crearlo
    SrvNombre, SrvClave, SrvModo(bool), SrvTg(u8), SrvPaso(u8, i32), SrvCrear }

/// lo que se va eligiendo en Crear server (RB.srv de la web: Libre, sin PvP, RPG ni nextbots, 1000 props y 40 autos)
#[derive(Clone, Debug)]
pub struct SrvForm { pub n: String, pub pw: String, pub modo_pvp: bool, pub pvp: bool, pub rpg: bool, pub nb: bool, pub mp: u32, pub mv: u32 }
impl Default for SrvForm { fn default() -> Self { SrvForm { n: String::new(), pw: String::new(), modo_pvp: false, pvp: false, rpg: false, nb: false, mp: 1000, mv: 40 } } }

/// las medidas de los paneles con esta pantalla (las variables --pn… de paneles.css)
#[derive(Clone, Copy, Debug)]
pub struct Pm { /** la unidad de aero.rs */ pub au: f32, pub vh: f32, pub u: f32, pub ph: f32, /** el alto de lo de la tienda y Personajes (--tiHb: 40 px con poco alto) */ pub hb: f32, pub ft: f32, pub fs: f32, pub fg: f32, pub x: f32, pub y: f32, pub w: f32, pub h: f32 }
pub fn pm(w: f32, h: f32) -> Pm {
    let vh = h / 100.0; let c = |a: f32, v: f32, b: f32| v.max(a).min(b);
    let m = c(8.0, 3.2 * vh, 34.0); let my = c(4.0, 1.2 * vh, 16.0);
    Pm { au: aero::unidad(w, h), vh, u: c(6.0, 1.6 * vh, 14.0), ph: c(44.0, 9.5 * vh, 54.0), hb: if h <= 500.0 { 40.0 } else { c(44.0, 9.5 * vh, 54.0) }, ft: c(15.0, 3.5 * vh, 19.0), fs: c(14.0, 3.0 * vh, 16.0), fg: c(21.0, 5.4 * vh, 34.0), x: m, y: my, w: w - 2.0 * m, h: h - 2.0 * my }
}

/// una nota de novedades.js (el registro de actualizaciones)
pub struct Nota { pub v: String, pub f: String, pub es: String }
/// las notas de novedades.js, la más nueva primero
pub fn novedades() -> Vec<Nota> {
    let s = include_str!("../../../juego/novedades.js");
    let Some(i) = s.find("const NOVEDADES = ").map(|i| i + "const NOVEDADES = ".len()) else { return vec![] };
    let v: Option<serde_json::Value> = serde_json::Deserializer::from_str(&s[i..]).into_iter::<serde_json::Value>().next().and_then(|r| r.ok());
    v.and_then(|v| v.as_array().map(|a| a.iter().map(|n| Nota { v: n["v"].as_str().unwrap_or("").into(), f: n["f"].as_str().unwrap_or("").into(), es: n["es"].as_str().unwrap_or("").into() }).collect())).unwrap_or_default()
}

/// los nombres de los personajes del juego (identidad.js) y su retrato
pub fn skin_nombre(s: &str) -> String {
    match s { "Hero" => "Nico", "Soldier" => "Brasa", "Jean" => "Tomi", "Business" => "Don Ferro", "SpecialForcesW" => "Vega", "SpecialForcesM" => "Rocco", "Prisoner01" => "Rulo",
        "PilotFemale" => "Alas", "Butcher" => "Carnicero", "Swat" => "Sombra", "Military" => "Duna", "Engineer" => "Chispa", x => npc::skin_nom(x) }.to_string()
}

/// el estado de los paneles que no está en PanelIni (lo de la última vez: las zonas que se tocan, la entrada, el dedo)
#[derive(Default)]
pub struct EstPaneles { pub zonas: Vec<([f32; 4], Acc)>, pub t0: f32, dedo: Option<(i32, f32, f32, f32, f32, bool)>, pub apretado: Option<Acc>,
    pub mapa: Option<String>, pub base: Option<String>, pub hora: usize, pub golpe: Option<(Acc, f32)>, pub contenido: [f32; 4], pub alto_contenido: f32, pub busca: String,
    /// el escenario de Personajes (donde va el personaje en 3D) y cuánto se giró arrastrando
    pub escena: [f32; 4], pub giro: f32,
    /// el formulario de Crear server
    pub srv: SrvForm,
    /// la ventana del panel de este cuadro (la flecha para volver y la X)
    pub chrome: std::cell::Cell<Option<aero::Ventana>> }

const HORAS: [&str; 5] = ["Normal", "Día", "Atardecer", "Noche", "Ciclo día/noche"];

impl Juego {
    /// abrir un panel (inicioPanel): con su entrada
    pub(super) fn pn_abrir(&mut self, p: PanelIni) {
        let otro = std::mem::discriminant(&p) != self.ini.panel.as_ref().map(std::mem::discriminant).unwrap_or(std::mem::discriminant(&PanelIni::Grieta)) || self.ini.panel.is_none();
        if let PanelIni::Multi { .. } = p { if self.ini.panel.is_none() { self.abrir_salas(); self.en_red.panel = false; } self.lan_buscar(); }
        if self.ini.pn.mapa.is_none() { self.ini.pn.mapa = Some(self.mapas.get(self.mapa_i).cloned().filter(|m| self.mapas_inicio().contains(m)).unwrap_or_else(|| self.mapas_inicio().last().cloned().unwrap_or_default())); }
        if self.ini.pn.base.is_none() { self.ini.pn.base = self.ini.pn.mapa.clone(); }
        if otro { self.ini.pn.t0 = self.ini.reloj; }
        self.ini.panel = Some(p);
    }
    /// «Volver»: al menú o, si el panel se abrió desde la pausa (jugando), a la pausa
    fn pn_volver(&mut self) { self.ini.panel = None; if self.ini.desde_juego { self.ini.desde_juego = false; self.pz_abrir(); } else { self.ini.mostrar(); } }

    // ———————————— el tacto ————————————
    pub(super) fn pn_dedo_abajo(&mut self, id: i32, x: f32, y: f32, _w: f32, _h: f32) {
        let a = self.ini.pn.zonas.iter().rev().find(|(r, _)| x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]).map(|z| z.1.clone());
        self.ini.pn.apretado = a.clone(); if let Some(a) = a { if self.ini.nivel != Nivel::Quieto { self.ini.pn.golpe = Some((a, self.ini.reloj)); } }
        self.ini.pn.dedo = Some((id, x, y, x, y, false));
    }
    pub(super) fn pn_dedo_mueve(&mut self, id: i32, x: f32, y: f32, h: f32) {
        let Some(d) = self.ini.pn.dedo.as_mut() else { return }; if d.0 != id { return; }
        let (dx, dy) = (x - d.3, y - d.4); d.3 = x; d.4 = y;
        let e = self.ini.pn.escena; if matches!(self.ini.panel, Some(PanelIni::Personajes { .. })) && d.1 >= e[0] && d.1 <= e[0] + e[2] && d.2 >= e[1] && d.2 <= e[1] + e[3] { d.5 = true; self.ini.pn.apretado = None; self.ini.pn.giro += dx * 0.012; return; }
        if (d.3 - d.1).abs() + (d.4 - d.2).abs() > h * 0.03 { d.5 = true; self.ini.pn.apretado = None; }
        if d.5 { let c = self.ini.pn.contenido; let max = (self.ini.pn.alto_contenido - c[3]).max(0.0);
            if let Some(pn) = self.ini.panel.as_mut() { match pn { PanelIni::Nueva { scroll, .. } | PanelIni::Multi { scroll } | PanelIni::Personajes { scroll, .. } | PanelIni::Opciones { scroll, .. } | PanelIni::Bugs { scroll, .. } | PanelIni::CrearServer { scroll } => { *scroll = (*scroll - dy).clamp(0.0, max); } _ => {} } } }
    }
    pub(super) fn pn_dedo_arriba(&mut self, id: i32, _w: f32, _h: f32) {
        let Some(d) = self.ini.pn.dedo.take() else { return }; if d.0 != id { return; }
        let a = self.ini.pn.apretado.take(); if d.5 { return; }
        let ahora = self.ini.pn.zonas.iter().rev().find(|(r, _)| d.3 >= r[0] && d.3 <= r[0] + r[2] && d.4 >= r[1] && d.4 <= r[1] + r[3]).map(|z| z.1.clone());
        if let (Some(a), Some(b)) = (a, ahora) { if a == b { self.sonido.tocar("Click", 0.5, 1.0, None); self.pn_accion(a); } }
    }
    /// lo que hace cada cosa de un panel
    fn pn_accion(&mut self, a: Acc) {
        match (self.ini.panel.clone(), a) {
            (Some(PanelIni::CrearServer { .. }), Acc::Volver) => self.pn_abrir(PanelIni::Multi { scroll: 0.0 }),
            (_, Acc::Volver) | (_, Acc::Cerrar) => self.pn_volver(),
            (_, Acc::SrvNombre) => { let n = self.ini.pn.srv.n.clone(); self.pedir_texto(Escribir::SrvNombre, "Nombre del server", &n, 24, false); }
            (_, Acc::SrvClave) => { let c = self.ini.pn.srv.pw.clone(); self.pedir_texto(Escribir::SrvClave, "Clave (opcional)", &c, 16, true); }
            (_, Acc::SrvModo(pvp)) => { self.ini.pn.srv.modo_pvp = pvp; if pvp { self.ini.pn.srv.pvp = true; } }
            (_, Acc::SrvTg(k)) => { let f = &mut self.ini.pn.srv; match k { 0 => f.pvp = !f.pvp || f.modo_pvp, 1 => f.rpg = !f.rpg, _ => f.nb = !f.nb } }
            (_, Acc::SrvPaso(k, d)) => { let f = &mut self.ini.pn.srv; if k == 0 { f.mp = (f.mp as i32 + d * 100).clamp(0, 5000) as u32; } else { f.mv = (f.mv as i32 + d * 5).clamp(0, 200) as u32; } }
            (_, Acc::SrvCrear) => self.srv_crear(),
            (Some(PanelIni::Nueva { .. }), Acc::Cat(k)) => self.ini.panel = Some(PanelIni::Nueva { cat: k, scroll: 0.0 }),
            (_, Acc::Mapa(m)) => self.ini.pn.mapa = Some(m),
            (_, Acc::Empezar) => { let m = self.ini.pn.mapa.clone().unwrap_or_default(); self.ini_empezar(&m); }
            (_, Acc::Hora) => self.ini.pn.hora = (self.ini.pn.hora + 1) % HORAS.len(),
            (_, Acc::Mods) => self.pn_abrir(PanelIni::Tienda { tab: 0, cat: 0 }),
            (_, Acc::Vr) => self.avisar("El modo VR todavía no está en la versión nativa".into()),
            (_, Acc::Entrar(id)) => { let salas = self.salas_inicio(); if let Some((s, _)) = salas.iter().find(|x| x.0.id == id) { let s = s.clone();
                if s.pw && self.en_red.red.entrar(&s, None).is_err() { let t = format!("Contraseña de {}", s.n); self.pedir_texto(Escribir::Clave(s), &t, "", 40, true); return; }
                self.ini_entrar_sala(&s); } }
            (_, Acc::MasLleno) => { let salas = self.salas_inicio(); if let Some((s, _)) = salas.iter().max_by_key(|x| x.1.len()) { let s = s.clone(); self.ini_entrar_sala(&s); } }
            (_, Acc::CrearServer) => { self.en_red.panel = false; self.pn_abrir(PanelIni::CrearServer { scroll: 0.0 }); }
            // (LAN / Wi-Fi: hacer de anfitrión en este celular con el mapa elegido y entrar; las de los demás están en la lista)
            (_, Acc::Lan) => { let m = self.ini.pn.mapa.clone().unwrap_or_else(|| self.mapas.get(self.mapa_i).cloned().unwrap_or_default());
                match self.lan_hostear(&m) { Ok(s) => { self.ini_entrar_sala(&s); if let Some(ip) = self.lan_ip() { self.avisar(format!("Partida en el Wi-Fi: los demás la ven en la lista (o escriben {ip})")); } } Err(e) => self.avisar(e) } }
            (_, Acc::Refrescar) => { self.en_red.red.conectar_lista(); self.en_red.red.cargar_salas(); }
            (_, Acc::Buscar) => self.avisar("Para buscar hace falta el teclado del celular".into()),
            (Some(PanelIni::Social { .. }), Acc::Tab(k)) => self.ini.panel = Some(PanelIni::Social { tab: k }),
            (Some(PanelIni::Tienda { cat, .. }), Acc::Tab(k)) => { if k == 3 { self.pn_volver(); self.ini.abierto = false; self.gmod_abrir(); self.ini.desde_juego = false; } else { self.ini.panel = Some(PanelIni::Tienda { tab: k, cat }); } }
            (Some(PanelIni::Tienda { tab, .. }), Acc::Cat(k)) => self.ini.panel = Some(PanelIni::Tienda { tab, cat: k }),
            (Some(PanelIni::Personajes { .. }), Acc::Tab(k)) => self.ini.panel = Some(PanelIni::Personajes { tab: k, scroll: 0.0 }),
            (Some(PanelIni::Bugs { .. }), Acc::Tab(k)) => self.ini.panel = Some(PanelIni::Bugs { tab: k, scroll: 0.0 }),
            (_, Acc::Skin(s)) => { self.skin = s.clone(); if let Some(d) = &self.datos { let _ = std::fs::write(d.join("skin.txt"), &s); } self.ini.cuerpo_nuevo = true; }
            (_, Acc::CrearBase(m)) => self.ini.pn.base = Some(m),
            (_, Acc::CrearEmpezar) => { let m = self.ini.pn.base.clone().unwrap_or_default(); self.ini_empezar(&m); self.jug.noclip = true; self.avisar("Volá libre y armá tu mapa con el menú de props".into()); }
            (Some(PanelIni::Opciones { .. }), Acc::AjTab(k)) => self.ini.panel = Some(PanelIni::Opciones { tab: k, scroll: 0.0 }),
            (_, Acc::Aj(f, k)) => { let pe = match &self.ini.panel { Some(PanelIni::Opciones { tab, .. }) => *tab, _ => 0 }; if let Some(c) = ajustes::claves(pe).get(f).copied() {
                match c { Clave::Motor => self.elegir_motor(k), Clave::Botones if k == 0 => { if self.mapa.is_some() { self.ini.panel = None; self.ini.desde_juego = false; self.ini.abierto = false; } self.ed_abrir(); }
                    // (jugando, el mapa cambia ya —como el Ajustes de antes—; en el menú, es el de la próxima partida)
                    Clave::Mapa if self.ini.desde_juego => { if k != self.mapa_i && k < self.mapas.len() { self.mapa_i = k; self.recargar = true; self.ini.panel = None; self.ini.desde_juego = false; if let Some(d) = &self.datos { let _ = std::fs::write(d.join("mapa.txt"), &self.mapas[k]); } } }
                    Clave::Mapa => { if let Some(m) = self.mapas.get(k).cloned() { self.ini.pn.mapa = Some(m); } }
                    _ => { self.aj.elegir(c, k); if let Some(d) = &self.datos { let _ = std::fs::write(d.join("ajustes.txt"), self.aj.texto()); } } } } }
            (_, Acc::Listo) => self.pn_volver(),
            (_, Acc::Idioma(k)) => { if k != 0 { self.avisar("La versión nativa por ahora está en castellano".into()); } else { self.pn_volver(); } }
            (_, Acc::GMod) => { self.pn_volver(); self.ini.abierto = false; self.gmod_abrir(); }
            (_, Acc::CuentaNo) => self.avisar("Lo social se activa cuando la tienda tenga el inicio de sesión con Google.".into()),
            _ => {}
        }
    }
    /// empezar una partida en el mapa `m` (inicioAccion('empezar'): se cierra el inicio y carga el mapa)
    pub(super) fn ini_empezar(&mut self, m: &str) {
        if !m.is_empty() { if let Some(i) = self.mapas.iter().position(|x| x == m) { if i != self.mapa_i || self.mapa.is_none() { self.mapa_i = i; if let Some(d) = &self.datos { let _ = std::fs::write(d.join("mapa.txt"), m); } } } }
        self.recargar = true; self.ini.abierto = false; self.ini.panel = None; self.ini.pn.zonas.clear(); self.dedos.clear();
    }
    /// las salas de la lista (las oficiales, sólo de los mapas de la versión personal, como la web: MAPAS_RB con JXP)
    fn salas_inicio(&self) -> Vec<(jxjuego::red::Sala, Vec<String>)> { let mi = self.mapas_inicio(); let mut v = self.lan_salas(); v.extend(self.en_red.red.lista_salas().into_iter().filter(|(s, _)| !s.of || mi.contains(&s.m))); v }
    fn ini_entrar_sala(&mut self, s: &jxjuego::red::Sala) {
        if self.en_red.puente.is_none() { self.avisar("Sin conexión: el multijugador anda en el celular".into()); return; }
        self.recargar = true; self.ini.abierto = false; self.ini.panel = None; self.entrar_sala_con(s, None);
    }
    /// crearServidor con lo del formulario (el nombre vacío: «<tu nombre>'s server», como la web)
    fn srv_crear(&mut self) {
        if self.en_red.puente.is_none() { self.avisar("Sin conexión: el multijugador anda en el celular".into()); return; }
        let m = self.ini.pn.mapa.clone().unwrap_or_else(|| self.mapas.get(self.mapa_i).cloned().unwrap_or_default()); let f = self.ini.pn.srv.clone();
        let n = if f.n.trim().is_empty() { format!("{}'s server", self.en_red.red.nombre) } else { f.n.clone() };
        self.en_red.red.crear_servidor(&jxjuego::red::NuevaSala { n, pw: f.pw.clone(), m: m.clone(), mo: if f.modo_pvp { "PvP".into() } else { "Free".into() }, pvp: f.pvp || f.modo_pvp, rpg: f.rpg, nb: f.nb, mp: f.mp as f64, mv: f.mv as f64, mw: None }, None);
        self.avisar(format!("Creando el server en {}…", super::paneles_juego::nombre_mapa(&m)));
    }

    // ———————————— el dibujo ————————————
    /// el panel abierto, con su entrada; anota lo que se toca
    pub(super) fn pn_dibujar(&mut self, p: &mut Pincel, pn: &PanelIni, w: f32, h: f32) {
        let m = pm(w, h); let mut z: Vec<([f32; 4], Acc)> = vec![];
        let t = self.ini.reloj - self.ini.pn.t0; let anim = self.ini.nivel != Nivel::Quieto;
        let ent = if anim { t } else { 10.0 };
        match pn {
            PanelIni::Nueva { cat, scroll } => self.pn_nueva(p, &m, *cat, *scroll, ent, &mut z),
            PanelIni::Crear => self.pn_crear(p, &m, ent, &mut z),
            PanelIni::CrearServer { scroll } => self.pn_crear_server(p, &m, *scroll, ent, &mut z),
            PanelIni::Multi { scroll } => self.pn_multi(p, &m, *scroll, ent, &mut z),
            PanelIni::Social { tab } => self.pn_social(p, &m, *tab, ent, &mut z),
            PanelIni::Tienda { tab, cat } => self.pn_tienda(p, &m, *tab, *cat, ent, &mut z),
            PanelIni::Personajes { tab, scroll } => self.pn_personajes(p, &m, *tab, *scroll, ent, &mut z),
            PanelIni::Opciones { tab, scroll } => self.pn_opciones(p, &m, *tab, *scroll, ent, &mut z),
            PanelIni::Bugs { tab, scroll } => self.pn_bugs(p, &m, *tab, *scroll, ent, &mut z),
            PanelIni::Grieta => self.pn_grieta(p, &m, ent, &mut z),
            PanelIni::Avisos => self.pn_avisos(p, &m, ent, &mut z),
            PanelIni::Idioma => self.pn_idioma(p, &m, ent, &mut z),
        }
        if let Some(v) = self.ini.pn.chrome.take() { if let Some(a) = v.atras { z.push((a, Acc::Volver)); } if let Some(c) = v.cerrar { z.push((c, Acc::Cerrar)); } }
        self.ini.pn.zonas = z;
    }
    /// el título y el ícono de la ventana de cada panel
    fn pn_titulo(&self) -> (&'static str, Option<&'static str>) {
        match self.ini.panel.as_ref() {
            Some(PanelIni::Nueva { .. }) => ("Empezar partida nueva", Some("jugar")), Some(PanelIni::Multi { .. }) => ("Buscar partida multijugador", Some("mundo")),
            Some(PanelIni::Social { .. }) => ("Social", Some("gente")), Some(PanelIni::Tienda { .. }) => ("Mods y mapas", Some("mods")),
            Some(PanelIni::Crear) => ("Crear un mapa", Some("martillo")), Some(PanelIni::Personajes { .. }) => ("Personajes", Some("persona")),
            Some(PanelIni::Opciones { .. }) => ("Opciones", Some("ajustes")), Some(PanelIni::Idioma) => ("Idioma", Some("mundo")),
            Some(PanelIni::Avisos) => ("Avisos", Some("campana")), Some(PanelIni::Bugs { .. }) => ("Bugs y sugerencias", Some("bicho")),
            Some(PanelIni::Grieta) => ("La grieta", Some("rayo")), Some(PanelIni::CrearServer { .. }) => ("Crear server", Some("servidor")),
            None => ("JXMod", None),
        }
    }

    /// la placa del panel: sombra dura, fondo con grano, borde y marcas de esquina (devuelve el adentro, sin el borde)
    fn pn_placa(&self, p: &mut Pincel, r: [f32; 4]) -> [f32; 4] {
        p.rect(r[0], r[1], r[2], r[3], PN_PL);
        p.borde(r[0], r[1], r[2], r[3], 1.0, negro(0.6)); p.rect(r[0] + 1.0, r[1] + 1.0, r[2] - 2.0, 1.0, blanco(0.10));
        [r[0] + 1.0, r[1] + 1.0, r[2] - 2.0, r[3] - 2.0]
    }
    /// las rayas de peligro (repeating-linear-gradient −45°, 5 px amarillo y 5 px nada)
    fn pn_rayas(&self, p: &mut Pincel, x: f32, y: f32, w: f32, h: f32, a: f32) {
        // (con el vidrio no van las rayas de peligro)
        if w <= 0.0 || a >= 0.0 { return; }
        let paso = 10.0 * std::f32::consts::SQRT_2; let c = con_a(AMA, a);
        p.con_recorte([x, y, w, h], |p| { let mut k = x - h - paso; while k < x + w + paso { p.poli(&[[k, y + h], [k + h, y], [k + h + paso / 2.0, y], [k + paso / 2.0, y + h]], c); k += paso; } });
    }
    /// la cabecera: la barra de arriba (vidrio, como la de los exploradores de Vista) con la dirección «JXMod › sección» y su
    /// ícono; devuelve dónde termina la dirección (ahí van las pestañas) y el alto
    fn pn_cabecera(&self, p: &mut Pincel, m: &Pm, c: [f32; 4], _num: &str, ico: Option<(&'static str, Col)>, titulo: &str, t: f32) -> (f32, f32) {
        let hc = m.ph + 6.0; let u = m.au;
        let b = aero::camino(c[0], c[1], c[2], hc - 1.0, [0.0; 4]);
        p.degrade(&b, true, c[1], c[1] + hc - 1.0, &[(0.0, blanco(0.12)), (0.5, blanco(0.05)), (0.5, negro(0.08)), (1.0, negro(0.2))]);
        p.rect(c[0], c[1] + hc - 2.0, c[2], 1.0, negro(0.6)); p.rect(c[0], c[1] + hc - 1.0, c[2], 1.0, blanco(0.10));
        if titulo.is_empty() { return (c[0] + m.u, hc); }
        let k = bezier(0.2, 0.8, 0.2, 1.0, prog(t, 0.1, 0.3));
        let f = m.ft * 0.92; let fh = (hc - 14.0).min(32.0 * u).max(f * 1.6); let fy = c[1] + (hc - 1.0 - fh) / 2.0; let fx = c[0] + m.u * 1.2;
        let li = f * 1.15; let tj = p.at.ancho(Cara::S4, f, 0.0, "JXMod"); let tt = p.at.ancho(Cara::S7, f, 0.0, titulo);
        let fw = 10.0 + li + 8.0 + tj + 6.0 + f * 0.7 + 6.0 + tt + 12.0;
        p.con_alfa(k, |p| {
            let ra = [3.0 * u; 4]; let cf = aero::camino(fx, fy, fw, fh, ra);
            p.relleno(&cf, negro(0.38)); p.contorno(fx, fy, fw, fh, ra, 1.0, negro(0.65)); p.rect(fx + 3.0 * u, fy + fh - 1.0, fw - 6.0 * u, 1.0, blanco(0.12));
            let mut x = fx + 10.0;
            let (ic, col) = ico.unwrap_or((self.pn_titulo().1.unwrap_or("info"), rgba(0x8cc8ff, 1.0))); let col = if col[2] < 0.5 && col[0] > 0.8 { rgba(0x8cc8ff, 1.0) } else { col };
            p.icono(ic, x, fy + (fh - li) / 2.0, li, 2.2, col); x += li + 8.0;
            let base = p.at.base_centrada(Cara::S4, f, f * 1.2, fy, fh);
            x += p.texto(Cara::S4, f, x, base, PN_T2, 0.0, "JXMod") + 6.0;
            p.icono("adelante", x, fy + (fh - f * 0.7) / 2.0, f * 0.7, 2.6, PN_T3); x += f * 0.7 + 6.0;
            p.texto(Cara::S7, f, x, base, TX, 0.0, titulo);
        });
        (fx + fw + m.u, hc)
    }
    /// el pie: el fondo, la línea con rayas y Volver; devuelve su caja (sube en la entrada)
    fn pn_pie(&self, p: &mut Pincel, m: &Pm, c: [f32; 4], alto: f32, t: f32, z: &mut Vec<([f32; 4], Acc)>) -> [f32; 4] {
        let y = c[1] + c[3] - alto; let r = [c[0], y, c[2], alto];
        p.rect(r[0], r[1], r[2], 1.0, PN_LIN); p.rect(r[0], r[1] + 1.0, r[2], alto - 1.0, PN_POZO);
        let kr = bezier(0.2, 0.8, 0.2, 1.0, prog(t, 0.4, 0.4)); self.pn_rayas(p, r[0] + 24.0, r[1] + alto - 3.0, (r[2] * 0.22).min(160.0) * kr, 3.0, 0.5);
        let bh = m.ph; let by = r[1] + 1.0 + (alto - 1.0 - bh) / 2.0;
        self.pn_boton(p, m, [r[0] + m.u * 1.5, by, self.pn_boton_ancho(p, m, "Volver", true, false), bh], "Volver", Some("atras"), false, Acc::Volver, z);
        r
    }
    /// el pie sin Volver (la tienda pone el suyo, con la letra chica)
    fn pn_pie_sin_volver(&self, p: &mut Pincel, _m: &Pm, c: [f32; 4], alto: f32, t: f32) -> [f32; 4] {
        let y = c[1] + c[3] - alto; let r = [c[0], y, c[2], alto];
        p.rect(r[0], r[1], r[2], 1.0, PN_LIN); p.rect(r[0], r[1] + 1.0, r[2], alto - 1.0, PN_POZO);
        let kr = bezier(0.2, 0.8, 0.2, 1.0, prog(t, 0.4, 0.4)); self.pn_rayas(p, r[0] + 24.0, r[1] + alto - 3.0, (r[2] * 0.22).min(160.0) * kr, 3.0, 0.5);
        r
    }
    /// el ancho de un botón (.rbBtnGris / .rbBtnG): rellenos de 1,05 y 1,15 letras + 6, el ícono de 1,15 em y el espacio
    fn pn_boton_ancho(&self, p: &Pincel, m: &Pm, txt: &str, ico: bool, amarillo: bool) -> f32 {
        let f = m.ft; let cara = if amarillo { Cara::S7 } else { Cara::S4 };
        f * 1.05 + f * 1.15 + 6.0 + if ico { f * 1.15 + if txt.is_empty() { 0.0 } else { f * 0.5 } } else { 0.0 } + p.at.ancho(cara, f, 0.05, &txt)
    }
    /// un botón de vidrio o el principal azul, con su ícono y el golpe
    fn pn_boton(&self, p: &mut Pincel, m: &Pm, r: [f32; 4], txt: &str, ico: Option<&'static str>, amarillo: bool, a: Acc, z: &mut Vec<([f32; 4], Acc)>) {
        let f = m.ft; let ap = self.ini.pn.apretado.as_ref() == Some(&a); let cara = if amarillo { Cara::S7 } else { Cara::S4 };
        self.pn_golpe(p, &a, r, |p| {
            let rb = [r[0], r[1], r[2] - 6.0, r[3]];
            if amarillo { aero::boton_azul(p, rb, m.au, ap); } else { aero::boton_vidrio(p, rb, m.au, ap, false); }
            let wt = p.at.ancho(cara, f, 0.05, txt); let li = if ico.is_some() { f * 1.15 } else { 0.0 }; let g = if ico.is_some() && !txt.is_empty() { f * 0.5 } else { 0.0 };
            let x0 = rb[0] + (rb[2] - (li + g + wt)) / 2.0;
            if let Some(n) = ico { p.icono(n, x0, r[1] + (r[3] - li) / 2.0, li, 2.2, TX); }
            let base = p.at.base_centrada(cara, f, f * 1.1, r[1], r[3]); p.texto_sombra(cara, f, x0 + li + g, base, TX, txt, 1.0);
        });
        zona(p, z, r, a);
    }
    /// el principal del pie (.rbPanPie .rbBtnG): más alto, la letra 1,1 veces, la punta rota grande
    fn pn_principal_ancho(&self, p: &Pincel, m: &Pm, txt: &str) -> f32 { let f = m.ft * 1.1; m.ft * 1.5 * 2.0 + 10.0 + f * 1.15 + f * 0.5 + p.at.ancho(Cara::S7, f, 0.05, &txt) }
    fn pn_principal(&self, p: &mut Pincel, m: &Pm, r: [f32; 4], txt: &str, ico: &'static str, a: Acc, z: &mut Vec<([f32; 4], Acc)>) {
        let f = m.ft * 1.1; let ap = self.ini.pn.apretado.as_ref() == Some(&a);
        self.pn_golpe(p, &a, r, |p| {
            aero::boton_azul(p, [r[0], r[1], r[2] - 10.0, r[3]], m.au, ap);
            let li = f * 1.15; let x0 = r[0] + m.ft * 1.5; p.icono(ico, x0, r[1] + (r[3] - li) / 2.0, li, 2.6, TX);
            let base = p.at.base_centrada(Cara::S7, f, f * 1.1, r[1], r[3]); p.texto_sombra(Cara::S7, f, x0 + li + f * 0.5, base, TX, txt, 1.0);
        });
        zona(p, z, r, a);
    }
    /// el golpe al tocar (el botón se hunde: 96 % y un poco a la derecha)
    fn pn_golpe(&self, p: &mut Pincel, a: &Acc, r: [f32; 4], f: impl FnOnce(&mut Pincel)) {
        let mut k = 0.0; if let Some((g, t0)) = &self.ini.pn.golpe { if g == a { let x = ((self.ini.reloj - t0) / 0.2).clamp(0.0, 1.0); k = if x < 0.35 { x / 0.35 } else { 1.0 - (x - 0.35) / 0.65 }; } }
        let (cx, cy) = (r[0] + r[2] / 2.0, r[1] + r[3] / 2.0); let s = 1.0 - 0.04 * k;
        p.con(pincel::escalar_en(s, s, cx, cy), f);
    }
    /// una pestaña (.rbTab / .rbCat): la punta rota, el texto, el número y la marca amarilla de la elegida
    fn pn_pestana_ancho(&self, p: &Pincel, m: &Pm, txt: &str, n: Option<usize>, ico: bool) -> f32 {
        let f = m.ft; let sel_c = Cara::S7;
        f * 0.85 + f * 1.05 + 6.0 + p.at.ancho(sel_c, f, 0.05, &txt) + if ico { f * 1.25 + f * 0.5 } else { 0.0 } + n.map(|n| f * 0.5 + p.at.ancho(sel_c, (f * 0.88).max(14.0), 0.05, &n.to_string())).unwrap_or(0.0)
    }
    fn pn_pestana(&self, p: &mut Pincel, m: &Pm, r: [f32; 4], txt: &str, n: Option<usize>, ico: Option<&'static str>, sel: bool, a: Acc, z: &mut Vec<([f32; 4], Acc)>) {
        let f = m.ft; let (fondo, tc, cara) = if sel { (AMA, NEGRO, Cara::S7) } else { (PN_PL2, PN_T2, Cara::S4) };
        self.pn_golpe(p, &a, r, |p| {
            placa(p, r[0], r[1], r[2], r[3], 4, 12.0, fondo, None);
            let mut x = r[0] + f * 0.85;
            if let Some(i) = ico { let l = f * 1.25; p.icono(i, x, r[1] + (r[3] - l) / 2.0, l, 2.2, if sel { NEGRO } else { PN_T2 }); x += l + f * 0.5; }
            let base = p.at.base_centrada(cara, f, f, r[1], r[3]); x += p.texto(cara, f, x, base, tc, 0.05, &txt);
            if let Some(n) = n { let fe = (f * 0.88).max(14.0); p.texto(cara, fe, x + f * 0.5, base, if sel { rgba(0x3a2d06, 1.0) } else { PN_T3 }, 0.05, &n.to_string()); }
        });
        if sel { p.rect(r[0], r[1] + r[3] - 4.0, r[2] - 11.0, 4.0, AMA); }
        zona(p, z, r, a);
    }
    /// una tarjeta de mapa (.rbMapaG): la foto 16:9 con su marco gastado, el nombre en la placa; elegida, amarilla con ✓
    fn pn_tarjeta_mapa(&self, p: &mut Pincel, m: &Pm, r: [f32; 4], mapa: &str, sel: bool, a: Acc, z: &mut Vec<([f32; 4], Acc)>) -> f32 {
        let fw = r[2] - 2.0; let fh = fw * 9.0 / 16.0; let fs = m.fs; let bh = fs * 1.2 + fs * 0.9; let h = 2.0 + fh + bh;
        p.rect(r[0] + 4.0, r[1] + 4.0, r[2], h, [0.0, 0.0, 0.0, 0.5]);
        p.rect(r[0], r[1], r[2], h, if sel { AMA } else { PN_PL2 }); if !sel { sin_grano(p, r[0], r[1], r[2], h, r[0] + 37.0, r[1] + 11.0, 1.0); }
        p.borde(r[0], r[1], r[2], h, 1.0, if sel { AMA } else { PN_LIN });
        let (fx, fy) = (r[0] + 1.0, r[1] + 1.0);
        p.rect(fx, fy, fw, fh, PN_PL1);
        if let Some((id, tw, th)) = self.ini_foto(&format!("i:mapa_{mapa}")) { p.foto_cubre(id, tw, th, fx, fy, fw, fh, [0.5, 0.5], [1.0; 4]); }
        self.pn_marco_foto(p, [fx, fy, fw, fh]);
        if sel { p.rect(fx + 6.0 + 2.0, fy + 6.0 + 2.0, 26.0, 26.0, [0.0, 0.0, 0.0, 0.5]); p.rect(fx + 6.0, fy + 6.0, 26.0, 26.0, AMA); p.icono("si", fx + 10.0, fy + 10.0, 18.0, 3.0, NEGRO); }
        let base = p.at.base_centrada(Cara::S4, fs, fs * 1.2, fy + fh + fs * 0.42, fs * 1.2);
        p.texto_max(if sel { Cara::S7 } else { Cara::S4 }, fs, fx + fs * 0.5, base, if sel { NEGRO } else { TX }, 0.04, &nombre_mapa(mapa), fw - fs);
        zona(p, z, [r[0], r[1], r[2], h], a);
        h
    }
    /// el marco gastado de una foto (::before: borde oscuro adentro y la viñeta)
    fn pn_marco_foto(&self, p: &mut Pincel, r: [f32; 4]) {
        p.borde(r[0], r[1], r[2], r[3], 2.0, [0.0, 0.0, 0.0, 0.55]); p.borde(r[0] + 2.0, r[1] + 2.0, r[2] - 4.0, r[3] - 4.0, 1.0, rgba(0xefede7, 0.08));
        p.degrade_v(r[0], r[1] + r[3] * 0.7, r[2], r[3] * 0.3, &[(0.0, [0.0, 0.0, 0.0, 0.0]), (1.0, [0.0, 0.0, 0.0, 0.25])]);
    }
    /// un texto de párrafo (Roboto → la sans) partido en renglones
    fn pn_parrafo(&self, p: &mut Pincel, x: f32, y: f32, ancho: f32, tam: f32, lh: f32, c: Col, s: &str, centrado: bool) -> f32 {
        let rs = p.at.renglones(Cara::S4, tam, 0.0, s, ancho); let (a, d) = p.at.metricas(Cara::S4, tam); let mut yy = y;
        for r in rs { let base = yy + (lh - a - d) / 2.0 + a; if centrado { p.texto_c(Cara::S4, tam, x + ancho / 2.0, base, c, 0.0, &r); } else { p.texto(Cara::S4, tam, x, base, c, 0.0, &r); } yy += lh; }
        yy - y
    }
    /// la cascada de la entrada: lo de la fila `i` baja y aparece un poco después que lo de la anterior
    fn pn_cascada<R>(&self, p: &mut Pincel, t: f32, i: usize, f: impl FnOnce(&mut Pincel) -> R) -> R {
        let k = bezier(0.2, 0.8, 0.2, 1.0, prog(t, 0.16 + i as f32 * 0.045, 0.34));
        p.con(pincel::mover(0.0, 14.0 * (1.0 - k)), |p| p.con_alfa(k, f))
    }
    /// el panel entero: la ventana de vidrio (aero.rs) con su título, la flecha y la X, y adentro el vidrio oscuro; con la
    /// entrada de las ventanas (aparece agrandándose un poco)
    fn pn_marco<R>(&self, p: &mut Pincel, m: &Pm, t: f32, f: impl FnOnce(&mut Pincel, [f32; 4]) -> R) -> R {
        let r = [m.x, m.y, m.w, m.h]; let k = bezier(0.2, 0.8, 0.2, 1.0, prog(t, 0.0, 0.24)); let s = 0.95 + 0.05 * k;
        let (titulo, ico) = self.pn_titulo();
        let ap = match self.ini.pn.apretado { Some(Acc::Cerrar) => 1, Some(Acc::Volver) => 2, _ => 0 };
        p.con_alfa(k, |p| p.con(pincel::escalar_en(s, s, r[0] + r[2] / 2.0, r[1] + r[3] / 2.0), |p| {
            let v = aero::ventana(p, r, m.au, &OpVentana { titulo, ico, atras: true, cerrar: true, blanco: false, apretado: ap });
            self.ini.pn.chrome.set(Some(v));
            let c = self.pn_placa(p, v.cliente); f(p, c)
        }))
    }

    // ———————————— cada panel ————————————
    /// Empezar partida nueva (panelNueva): las pestañas de grupos, el elegido en grande a la izquierda y las tarjetas
    fn pn_nueva(&mut self, p: &mut Pincel, m: &Pm, cat: usize, scroll: f32, t: f32, z: &mut Vec<([f32; 4], Acc)>) {
        let mapas = self.mapas_inicio(); let sel = self.ini.pn.mapa.clone().unwrap_or_default();
        for mp in &mapas { self.ini_pedir_foto(&format!("i:mapa_{mp}")); }
        let clave_carga = fondo_mapa(&sel); let foto_carga = clave_carga.map(|c| format!("a:carga/{c}.webp")).filter(|k| self.ini_pedir_foto(k));
        let cats = [("Todos los mapas", mapas.len()), ("Comunidad", 0)];
        let lista: Vec<String> = if cat == 0 { mapas.clone() } else { vec![] };
        let (pie_h, alto_cont, contenido) = self.pn_marco(p, m, t, |p, c| {
            let (_, hc) = self.pn_cabecera(p, m, c, "01", None, "Empezar partida nueva", t);
            // (las pestañas: TODOS LOS MAPAS y COMUNIDAD, con su número)
            let ty = c[1] + hc + m.u * 0.8; let mut x = c[0] + m.u * 1.5;
            for (k, (n, cuenta)) in cats.iter().enumerate() { let wpt = self.pn_pestana_ancho(p, m, n, Some(*cuenta), false); let r = [x, ty, wpt, m.ph];
                self.pn_cascada(p, t, k, |p| self.pn_pestana(p, m, r, n, Some(*cuenta), None, k == cat, Acc::Cat(k), z)); x += wpt + 4.0; }
            let cuerpo_y = ty + m.ph + m.u * 0.6;
            // (el pie: Volver, la hora, los mods, «Un jugador», VR y Empezar partida)
            let pie_h = m.ph + 2.0 + m.u * 1.5 + 1.0;
            let pie = self.pn_pie_sin_volver(p, m, c, pie_h, t);
            // (nvEncajar: si no entra en un renglón, por pasos —sin «Un jugador»; los mods sólo con su ícono; sin «Hora» y el
            // selector más angosto; «Volver» sólo con la flecha— hasta que entra)
            let by = pie[1] + 1.0 + (pie_h - 1.0 - m.ph) / 2.0; let fs = m.fs; let g = m.u;
            let w_volver = [self.pn_boton_ancho(p, m, "Volver", true, false), m.ph];
            let w_hora_l = p.at.ancho(Cara::S4, fs, 0.08, "Hora") + fs * 0.6;
            let w_sel = [(p.at.ancho(Cara::S4, m.ft, 0.04, "Ciclo día/noche") + m.ft * 0.8 + m.ft * 2.2).min(m.w * 0.2).max(m.ft * 8.0), (34.0 * m.vh).min(m.ft * 8.0)];
            let w_mods = [self.pn_boton_ancho(p, m, "Sin mods", true, false), m.ft * 1.05 + m.ft * 1.15 + 6.0 + m.ft * 1.15];
            let wp = self.pn_principal_ancho(p, m, "Empezar partida"); let wvr = self.pn_boton_ancho(p, m, "VR", true, false); let wuj = p.at.ancho(Cara::S4, fs, 0.1, "Un jugador");
            let total = |n: usize| w_volver[(n >= 4) as usize] + g + if n >= 3 { 0.0 } else { w_hora_l } + w_sel[(n >= 3) as usize] + g + w_mods[(n >= 2) as usize] + g * 2.0 + if n >= 1 { 0.0 } else { wuj + g } + wvr + g + wp;
            let disp = pie[2] - m.u * 3.0; let nv = (0..5).find(|n| total(*n) <= disp).unwrap_or(4);
            let wv = w_volver[(nv >= 4) as usize];
            self.pn_boton(p, m, [pie[0] + m.u * 1.5, by, wv, m.ph], if nv >= 4 { "" } else { "Volver" }, Some("atras"), false, Acc::Volver, z);
            let mut x = pie[0] + m.u * 1.5 + wv + g;
            // («Hora»: el rótulo y el selector —acá, tocarlo pasa a la siguiente—)
            if nv < 3 { let base_l = p.at.base_centrada(Cara::S4, fs, fs * 1.2, by, m.ph); p.texto(Cara::S4, fs, x, base_l, PN_T2, 0.08, "Hora"); x += w_hora_l; }
            let hora = HORAS[self.ini.pn.hora]; let wsel = w_sel[(nv >= 3) as usize]; let fh = if nv >= 3 { fs } else { m.ft };
            let rs = [x, by, wsel, m.ph]; p.rect(rs[0], rs[1], rs[2], rs[3], PN_POZO); p.borde(rs[0], rs[1], rs[2], rs[3], 1.0, PN_LIN2);
            p.texto_max(Cara::S4, fh, x + fh * 0.6, p.at.base_centrada(Cara::S4, fh, fh * 1.1, by, m.ph), TX, 0.04, &hora, wsel - m.ft * 2.6);
            p.icono("chevron", x + wsel - m.ft * 0.7 - m.ft, by + (m.ph - m.ft) / 2.0, m.ft, 2.6, AMA); zona(p, z, rs, Acc::Hora); x += wsel + g;
            let wm = w_mods[(nv >= 2) as usize]; self.pn_boton(p, m, [x, by, wm, m.ph], if nv >= 2 { "" } else { "Sin mods" }, Some("ico_mod"), false, Acc::Mods, z);
            // (a la derecha: Empezar partida, VR y «Un jugador»)
            let xp = pie[0] + pie[2] - m.u * 1.5 - wp;
            self.pn_principal(p, m, [xp, by - 1.0, wp, m.ph + 2.0], "Empezar partida", "jugar", Acc::Empezar, z);
            let xv = xp - g - wvr;
            self.pn_boton(p, m, [xv, by, wvr, m.ph], "VR", Some("vr"), false, Acc::Vr, z);
            if nv == 0 { p.texto(Cara::S4, fs, xv - g - wuj, p.at.base_centrada(Cara::S4, fs, fs, by, m.ph), PN_T3, 0.1, "Un jugador"); }
            // (el cuerpo: el elegido en grande —36 % del ancho, 34 % con poco alto— y la grilla)
            let cuerpo = [c[0], cuerpo_y, c[2], pie[1] - cuerpo_y]; p.rect(cuerpo[0], cuerpo[1], cuerpo[2], 1.0, PN_LIN);
            let hw = (c[2] * if m.vh * 100.0 <= 500.0 { 0.34 } else { 0.36 }).min(m.vh * 84.0); let hero = [cuerpo[0], cuerpo[1] + 1.0, hw, cuerpo[3] - 1.0];
            p.rect(hero[0], hero[1], hero[2] - 1.0, hero[3], PN_POZO); p.rect(hero[0] + hero[2] - 1.0, hero[1], 1.0, hero[3], PN_LIN);
            // (abajo del hero: el grupo, el nombre grande y quién lo hizo)
            let u = m.u; let fb = (6.4 * m.vh).clamp(22.0, 50.0);
            let info_h = u * 1.1 + fs + u * 0.25 + fb * 1.2 + fb * 0.14 + u * 0.25 + fs * 1.35 + u * 1.2;
            let fr = [hero[0] + u * 1.2, hero[1] + u * 1.2, hero[2] - 1.0 - u * 2.4, (hero[3] - u * 1.2 - info_h).max(10.0)];
            self.pn_cascada(p, t, 1, |p| {
                p.rect(fr[0] + 4.0, fr[1] + 4.0, fr[2], fr[3], [0.0, 0.0, 0.0, 0.6]); p.rect(fr[0], fr[1], fr[2], fr[3], rgba(0x1b1c1f, 1.0));
                let k = foto_carga.clone().unwrap_or_else(|| format!("i:mapa_{sel}"));
                if let Some((id, tw, th)) = self.ini_foto(&k) { p.foto_cubre(id, tw, th, fr[0], fr[1], fr[2], fr[3], [0.5, 0.5], [1.0; 4]); }
                self.pn_marco_foto(p, fr); p.borde(fr[0] - 1.0, fr[1] - 1.0, fr[2] + 2.0, fr[3] + 2.0, 1.0, PN_LIN2);
                let ix = hero[0] + u * 1.5; let mut y = fr[1] + fr[3] + u * 1.1; let iw = hero[2] - 1.0 - u * 3.0;
                p.texto(Cara::S4, fs, ix, p.at.base_centrada(Cara::S4, fs, fs, y, fs), AMA, 0.16, "Todos los mapas"); y += fs + u * 0.25;
                p.texto_max(Cara::S7, fb, ix, p.at.base_centrada(Cara::S7, fb, fb * 1.2, y, fb * 1.2), TX, 0.01, &nombre_mapa(&sel), iw); y += fb * 1.2 + fb * 0.14 + u * 0.25;
                let (a, d) = p.at.metricas(Cara::S4, fs); p.texto(Cara::S4, fs, ix, y + (fs * 1.35 - a - d) / 2.0 + a, PN_T2, 0.0, "Garry's Mod");
            });
            // (la grilla: columnas de max(104 px, 25 % del alto) que llenan el ancho)
            let g = [hero[0] + hero[2], cuerpo[1] + 1.0, cuerpo[2] - hero[2], cuerpo[3] - 1.0];
            let (pl, pt) = (u * 1.5, u * 1.3); let gap = u * 1.1; let iw = g[2] - 2.0 * pl; let minc = (25.0 * m.vh).max(104.0);
            let n = (((iw + gap) / (minc + gap)).floor() as usize).max(1); let cw = (iw - gap * (n - 1) as f32) / n as f32;
            let mut alto = pt + u * 1.6;
            p.con_recorte(g, |p| {
                if lista.is_empty() { let base = g[1] + pt + m.ft; p.texto_c(Cara::S4, m.ft, g[0] + g[2] / 2.0, base, PN_T2, 0.0, "No hay resultados · Mods y mapas"); }
                let mut fila_h = 0.0f32;
                for (k, mp) in lista.iter().enumerate() { let (col, fila) = (k % n, k / n);
                    let r = [g[0] + pl + col as f32 * (cw + gap), g[1] + pt + fila as f32 * (fila_h.max(1.0) + gap) - scroll, cw, 0.0];
                    let hh = self.pn_cascada(p, t, 2 + k, |p| self.pn_tarjeta_mapa(p, m, r, mp, *mp == sel, Acc::Mapa(mp.clone()), z)); fila_h = fila_h.max(hh);
                    if col == n - 1 || k + 1 == lista.len() { alto = pt + (fila + 1) as f32 * (fila_h + gap) - gap + u * 1.6; } }
            });
            (pie_h, alto, g)
        });
        let _ = pie_h; self.ini.pn.contenido = contenido; self.ini.pn.alto_contenido = alto_cont;
    }

    /// Crear un mapa: el mapa base y la explicación; «Empezar a crear» abre el mapa volando
    fn pn_crear(&mut self, p: &mut Pincel, m: &Pm, t: f32, z: &mut Vec<([f32; 4], Acc)>) {
        let mapas = self.mapas_inicio(); for mp in &mapas { self.ini_pedir_foto(&format!("i:mapa_{mp}")); }
        let base = self.ini.pn.base.clone().unwrap_or_default();
        self.pn_marco(p, m, t, |p, c| {
            let (xt, hc) = self.pn_cabecera(p, m, c, "05", Some(("martillo", AMA)), "Crear un mapa", t);
            let fs = m.fs; p.texto(Cara::S4, fs, xt + fs * 0.2 + m.u, p.at.base_centrada(Cara::S4, fs, fs * 1.2, c[1], m.ph + 5.0), PN_T2, 0.08, &nombre_mapa(&base));
            let pie_h = m.ph + 2.0 + m.u * 1.5 + 1.0; let pie = self.pn_pie(p, m, c, pie_h, t, z);
            let by = pie[1] + 1.0 + (pie_h - 1.0 - m.ph) / 2.0; let wp = self.pn_principal_ancho(p, m, "Empezar a crear");
            self.pn_principal(p, m, [pie[0] + pie[2] - m.u * 1.5 - wp, by - 1.0, wp, m.ph + 2.0], "Empezar a crear", "martillo", Acc::CrearEmpezar, z);
            let u = m.u; let x0 = c[0] + u * 1.5; let mut y = c[1] + hc + u * 1.3; let ancho = c[2] - u * 3.0;
            self.pn_cascada(p, t, 0, |p| p.texto(Cara::S4, fs, x0 + 11.8, p.at.base_centrada(Cara::S4, fs, fs * 1.2, y + 11.8, fs * 1.2), AMA, 0.08, "Mapa base"));
            y += 11.8 + fs * 1.2 + u;
            let minc = (22.0 * m.vh).max(118.0); let gap = u * 1.1; let n = (((ancho + gap) / (minc + gap)).floor() as usize).max(1); let cw = (ancho - gap * (n - 1) as f32) / n as f32;
            let mut hmax = 0.0f32;
            for (k, mp) in mapas.iter().enumerate() { let r = [x0 + (k % n) as f32 * (cw + gap), y + (k / n) as f32 * (hmax + gap), cw, 0.0]; let h = self.pn_cascada(p, t, 1 + k, |p| self.pn_tarjeta_mapa(p, m, r, mp, *mp == base, Acc::CrearBase(mp.clone()), z)); hmax = hmax.max(h); }
            y += ((mapas.len() + n - 1) / n) as f32 * (hmax + gap) - gap + u;
            self.pn_cascada(p, t, 4, |p| self.pn_parrafo(p, x0, y, ancho, fs, fs * 1.4, PN_T2, "Volá libre sobre el mapa y armá el tuyo: props, puntos de aparición con roles, piano, radio, mega rampas, botones de autos, teletransportes y más. Después probalo y publicalo.", false));
        });
    }

    /// Crear server (panelMultiCrear): a la izquierda el nombre, la clave, el modo, PvP / RPG / nextbots y los topes de props
    /// y de autos; a la derecha el mapa base; abajo Volver (a la lista) y Crear server. Todo baja con el dedo si no entra
    fn pn_crear_server(&mut self, p: &mut Pincel, m: &Pm, scroll: f32, t: f32, z: &mut Vec<([f32; 4], Acc)>) {
        let mapas = self.mapas_inicio(); for mp in &mapas { self.ini_pedir_foto(&format!("i:mapa_{mp}")); }
        let sel = self.ini.pn.mapa.clone().unwrap_or_default(); let f = self.ini.pn.srv.clone(); let yo = self.en_red.red.nombre.clone();
        let (alto, cont) = self.pn_marco(p, m, t, |p, c| {
            let (xt, hc) = self.pn_cabecera(p, m, c, "02", Some(("mas", AMA)), "Crear server", t);
            let fs = m.fs; let u = m.u; p.texto(Cara::S4, fs, xt + fs * 0.2 + u, p.at.base_centrada(Cara::S4, fs, fs * 1.2, c[1], m.ph + 5.0), PN_T2, 0.08, &nombre_mapa(&sel));
            let pie_h = m.ph + 2.0 + u * 1.5 + 1.0; let pie = self.pn_pie(p, m, c, pie_h, t, z);
            let by = pie[1] + 1.0 + (pie_h - 1.0 - m.ph) / 2.0; let wp = self.pn_principal_ancho(p, m, "Crear server");
            self.pn_principal(p, m, [pie[0] + pie[2] - u * 1.5 - wp, by - 1.0, wp, m.ph + 2.0], "Crear server", "jugar", Acc::SrvCrear, z);
            let cuerpo = [c[0], c[1] + hc, c[2], pie[1] - c[1] - hc]; let mut alto = 0.0f32;
            p.con_recorte(cuerpo, |p| {
                // ---- la columna del formulario ----
                let x0 = cuerpo[0] + u * 1.5; let wcol = (cuerpo[2] * 0.46).max(m.ft * 16.0).min(cuerpo[2] - u * 3.0); let mut y = cuerpo[1] + u * 1.2 - scroll;
                let rot = |p: &mut Pincel, y: f32, s: &str| { p.texto(Cara::S4, fs, x0, p.at.base_centrada(Cara::S4, fs, fs * 1.2, y, fs * 1.2), AMA, 0.08, &s); };
                let campo = |p: &mut Pincel, r: [f32; 4], v: &str, gris: &str| { p.rect(r[0], r[1], r[2], r[3], PN_POZO); p.borde(r[0], r[1], r[2], r[3], 1.0, PN_LIN2);
                    let (s, col) = if v.is_empty() { (gris, PN_T3) } else { (v, TX) }; p.texto_max(Cara::S4, m.ft, r[0] + m.ft * 0.8, p.at.base_centrada(Cara::S4, m.ft, m.ft * 1.2, r[1], r[3]), col, 0.0, s, r[2] - m.ft * 1.6); };
                let mut k = 0usize;
                for (titulo, v, gris, a) in [("Nombre", f.n.clone(), format!("{yo}'s server"), Acc::SrvNombre), ("Clave (opcional)", "•".repeat(f.pw.chars().count()), "Sin clave".to_string(), Acc::SrvClave)] {
                    let yy = y; self.pn_cascada(p, t, k, |p| { rot(p, yy, titulo); campo(p, [x0, yy + fs * 1.4, wcol, m.ph], &v, &gris); }); zona(p, z, [x0, y + fs * 1.4, wcol, m.ph], a); y += fs * 1.4 + m.ph + u; k += 1;
                }
                // (el modo: Libre o PvP, como un segmento; el elegido amarillo)
                let yy = y; self.pn_cascada(p, t, k, |p| rot(p, yy, "Modo")); y += fs * 1.4; k += 1;
                for (i, (n, pvp)) in [("Libre", false), ("PvP", true)].into_iter().enumerate() { let r = [x0 + i as f32 * wcol / 2.0, y, wcol / 2.0 - 3.0, m.ph]; let s = f.modo_pvp == pvp;
                    self.pn_cascada(p, t, k, |p| { p.rect(r[0], r[1], r[2], r[3], if s { AMA } else { PN_POZO }); if !s { p.borde(r[0], r[1], r[2], r[3], 1.0, PN_LIN2); }
                        p.texto_c(if s { Cara::S7 } else { Cara::S4 }, fs, r[0] + r[2] / 2.0, p.at.base_centrada(Cara::S4, fs, fs, r[1], r[3]), if s { NEGRO } else { TX }, 0.04, &n); });
                    zona(p, z, r, Acc::SrvModo(pvp)); }
                y += m.ph + u; k += 1;
                // (PvP, RPG y nextbots: casillas que se prenden en amarillo)
                for (i, (n, on)) in [("PvP", f.pvp || f.modo_pvp), ("RPG", f.rpg), ("Nextbots", f.nb)].into_iter().enumerate() { let r = [x0 + i as f32 * wcol / 3.0, y, wcol / 3.0 - 3.0, m.ph];
                    self.pn_cascada(p, t, k, |p| { p.rect(r[0], r[1], r[2], r[3], if on { rgba(0x2a2410, 1.0) } else { PN_POZO }); p.borde(r[0], r[1], r[2], r[3], 1.0, if on { AMA } else { PN_LIN2 });
                        let q = fs * 0.9; let cx = r[0] + fs * 0.7; let cy = r[1] + (r[3] - q) / 2.0; p.borde(cx, cy, q, q, 1.5, if on { AMA } else { PN_T3 }); if on { p.rect(cx + 3.0, cy + 3.0, q - 6.0, q - 6.0, AMA); }
                        p.texto_max(Cara::S4, fs, cx + q + fs * 0.5, p.at.base_centrada(Cara::S4, fs, fs, r[1], r[3]), if on { TX } else { PN_T2 }, 0.04, &n, r[2] - q - fs * 1.6); });
                    zona(p, z, r, Acc::SrvTg(i as u8)); }
                y += m.ph + u; k += 1;
                // (los topes: props y autos, con menos y más)
                for (i, (n, v)) in [("Props", f.mp), ("Autos", f.mv)].into_iter().enumerate() {
                    let yy = y; let r_menos = [x0 + wcol - m.ph * 2.0 - 3.0, y, m.ph, m.ph]; let r_mas = [x0 + wcol - m.ph, y, m.ph, m.ph];
                    self.pn_cascada(p, t, k, |p| { p.texto(Cara::S4, fs, x0, p.at.base_centrada(Cara::S4, fs, fs, yy, m.ph), PN_T2, 0.06, &format!("{} · {v}", n));
                        for (r, s) in [(r_menos, "−"), (r_mas, "+")] { p.rect(r[0], r[1], r[2], r[3], PN_PL3); p.borde(r[0], r[1], r[2], r[3], 1.0, PN_LIN2); p.texto_c(Cara::S7, m.ft * 1.2, r[0] + r[2] / 2.0, p.at.base_centrada(Cara::S7, m.ft * 1.2, m.ft * 1.2, r[1], r[3]), TX, 0.0, s); } });
                    zona(p, z, r_menos, Acc::SrvPaso(i as u8, -1)); zona(p, z, r_mas, Acc::SrvPaso(i as u8, 1)); y += m.ph + u * 0.6; k += 1;
                }
                alto = alto.max(y + scroll - cuerpo[1] + u);
                // ---- el mapa base: la grilla a la derecha ----
                let gx = x0 + wcol + u * 2.0; let gw = cuerpo[0] + cuerpo[2] - u * 1.5 - gx; let mut gy = cuerpo[1] + u * 1.2 - scroll;
                if gw > m.ft * 6.0 {
                    let yy = gy; self.pn_cascada(p, t, 1, |p| p.texto(Cara::S4, fs, gx, p.at.base_centrada(Cara::S4, fs, fs * 1.2, yy, fs * 1.2), AMA, 0.08, "Mapa base")); gy += fs * 1.4;
                    let gap = u * 1.1; let minc = (18.0 * m.vh).max(96.0); let n = (((gw + gap) / (minc + gap)).floor() as usize).max(1); let cw = (gw - gap * (n - 1) as f32) / n as f32;
                    let mut hmax = 0.0f32;
                    for (k2, mp) in mapas.iter().enumerate() { let r = [gx + (k2 % n) as f32 * (cw + gap), gy + (k2 / n) as f32 * (hmax + gap), cw, 0.0]; let h = self.pn_cascada(p, t, 2 + k2, |p| self.pn_tarjeta_mapa(p, m, r, mp, *mp == sel, Acc::Mapa(mp.clone()), z)); hmax = hmax.max(h); }
                    alto = alto.max(gy + ((mapas.len() + n - 1) / n) as f32 * (hmax + gap) + scroll - cuerpo[1]);
                }
            });
            (alto, cuerpo)
        });
        self.ini.pn.contenido = cont; self.ini.pn.alto_contenido = alto;
    }

    /// Social: las pestañas (Chats, Amigos, Buscar jugador, Perfil) y, sin cuenta, el cartel de la web
    fn pn_social(&mut self, p: &mut Pincel, m: &Pm, tab: usize, t: f32, z: &mut Vec<([f32; 4], Acc)>) {
        self.pn_marco(p, m, t, |p, c| {
            let (xt, hc) = self.pn_cabecera(p, m, c, "03", Some(("gente", AMA)), "Social", t);
            let tabs = [("Chats", "chat"), ("Amigos", "gente"), ("Buscar jugador", "buscar"), ("Perfil", "persona")];
            let mut x = xt + m.u; let ty = c[1] + (hc - 1.0 - m.ph) / 2.0;
            let entra = tabs.iter().map(|(n, _)| self.pn_pestana_ancho(p, m, n, None, true) + 4.0).sum::<f32>() <= c[0] + c[2] - 14.0 - x;
            for (k, (n, ic)) in tabs.iter().enumerate() { let n2 = if entra { *n } else { "" }; let wt = if entra { self.pn_pestana_ancho(p, m, n, None, true) } else { m.ph.max(44.0) + 12.0 };
                self.pn_pestana(p, m, [x, ty, wt, m.ph], n2, None, Some(ic), k == tab, Acc::Tab(k), z); x += wt + 4.0; }
            let pie_h = m.ph + m.u * 1.5 + 1.0; let pie = self.pn_pie(p, m, c, pie_h, t, z);
            let cu = [c[0], c[1] + hc, c[2], pie[1] - c[1] - hc];
            let w = 460.0f32.min(cu[2] - 48.0); let lh = m.ft * 1.45; let rs = p.at.renglones(Cara::S4, m.ft, 0.0, "Lo social se activa cuando la tienda tenga el inicio de sesión con Google.", w);
            let y = cu[1] + (cu[3] - rs.len() as f32 * lh) / 2.0;
            self.pn_cascada(p, t, 0, |p| self.pn_parrafo(p, cu[0] + (cu[2] - w) / 2.0, y, w, m.ft, lh, TX, "Lo social se activa cuando la tienda tenga el inicio de sesión con Google.", true));
        });
    }

    /// Buscar partida multijugador (rbmenus.js): el buscador, el estado, la lista de servers con Entrar y «Entrar al más lleno»
    fn pn_multi(&mut self, p: &mut Pincel, m: &Pm, scroll: f32, t: f32, z: &mut Vec<([f32; 4], Acc)>) {
        let salas = self.salas_inicio(); let jugadores: usize = salas.iter().map(|s| s.1.len()).sum();
        for (s, _) in &salas { self.ini_pedir_foto(&format!("i:mapa_{}", s.m)); }
        let con = self.en_red.puente.is_some();
        let (alto, cont) = self.pn_marco(p, m, t, |p, c| {
            let (_, hc) = self.pn_cabecera(p, m, c, "02", Some(("gente", AMA)), "Buscar partida multijugador", t);
            // (arriba a la derecha: LAN / Wi-Fi y Crear server, chicos)
            let fs = m.fs; let chico = |p: &Pincel, s: &str, cara: Cara| m.ft * 0.85 * 2.0 + 6.0 + fs * 1.15 + fs * 0.5 + p.at.ancho(cara, fs, 0.05, &s);
            let ty = c[1] + (hc - 1.0 - m.ph) / 2.0; let wc = chico(p, "Crear server", Cara::S7); let xc = c[0] + c[2] - m.u * 1.5 - wc;
            self.pn_chico(p, m, [xc, ty, wc, m.ph], "Crear server", "mas", true, Acc::CrearServer, z);
            let wl = chico(p, "LAN / Wi-Fi", Cara::S4); self.pn_chico(p, m, [xc - m.u - wl, ty, wl, m.ph], "LAN / Wi-Fi", "wifi", false, Acc::Lan, z);
            // (la barra: el buscador, el estado, la cuenta y refrescar)
            let u = m.u; let by = c[1] + hc + u * 1.1; let wr = m.ph * 1.05;
            let est = if !con { "Sin conexión".to_string() } else if salas.is_empty() { "Conectando…".into() } else { String::new() };
            let cuenta = format!("{} jugadores · {} servers", jugadores, salas.len());
            let wcu = p.at.ancho(Cara::S4, fs, 0.05, &cuenta); let we = if est.is_empty() { 0.0 } else { p.at.ancho(Cara::S4, fs, 0.05, &est) + u * 1.0 + 7.0 + u };
            let xr = c[0] + c[2] - u * 1.5 - wr; let xcu = xr - u - wcu; let xe = xcu - we;
            let bw = (xe - u - (c[0] + u * 1.5)).max(80.0); let rb = [c[0] + u * 1.5, by, bw, m.ph];
            self.pn_cascada(p, t, 0, |p| {
                p.rect(rb[0], rb[1], rb[2], rb[3], PN_POZO); p.borde(rb[0], rb[1], rb[2], rb[3], 1.0, PN_LIN2);
                p.texto(Cara::S4, m.ft, rb[0] + m.ft * 0.8, p.at.base_centrada(Cara::S4, m.ft, m.ft * 1.2, rb[1], rb[3]), PN_T3, 0.0, "Buscar server o mapa…");
                let base = p.at.base_centrada(Cara::S4, fs, fs * 1.2, by, m.ph);
                if !est.is_empty() { p.texto(Cara::S4, fs, xe, base, AMA, 0.05, &est); p.rect(xcu - u - 7.0, by + m.ph / 2.0 - 3.5, 7.0, 7.0, rgba(0x6fd68f, 1.0)); }
                p.texto(Cara::S4, fs, xcu, base, PN_T2, 0.05, &cuenta);
            });
            zona(p, z, rb, Acc::Buscar);
            self.pn_chico(p, m, [xr, by, wr, m.ph], "", "girar", false, Acc::Refrescar, z);
            let pie_h = m.ph + 2.0 + u * 1.5 + 1.0; let pie = self.pn_pie(p, m, c, pie_h, t, z);
            let wp = self.pn_principal_ancho(p, m, "Entrar al más lleno"); let pby = pie[1] + 1.0 + (pie_h - 1.0 - m.ph) / 2.0;
            self.pn_principal(p, m, [pie[0] + pie[2] - u * 1.5 - wp, pby - 1.0, wp, m.ph + 2.0], "Entrar al más lleno", "jugar", Acc::MasLleno, z);
            // (la lista de servers: cada uno con su foto, el nombre, «OFICIAL», el mapa y el modo, la gente y Entrar)
            let ly = by + m.ph + u * 0.5; let lista = [c[0], ly, c[2], pie[1] - ly]; let fh = m.ph + 2.0 + 16.0; let gap = m.u * 0.9;
            p.con_recorte(lista, |p| {
                for (k, (s, n)) in salas.iter().enumerate() {
                    let r = [lista[0] + u * 1.5, lista[1] + u * 0.8 + k as f32 * (fh + gap) - scroll, lista[2] - u * 3.0, fh];
                    if r[1] > lista[1] + lista[3] || r[1] + r[3] < lista[1] { continue; }
                    self.pn_cascada(p, t, 1 + k, |p| {
                        p.rect(r[0] + 4.0, r[1] + 4.0, r[2], r[3], [0.0, 0.0, 0.0, 0.5]); p.rect(r[0], r[1], r[2], r[3], PN_PL2); sin_grano(p, r[0], r[1], r[2], r[3], r[0] + 37.0, r[1] + 11.0, 1.0); p.borde(r[0], r[1], r[2], r[3], 1.0, PN_LIN);
                        let fr = [r[0] + 8.0, r[1] + 8.0, (r[3] - 16.0) * 81.0 / 56.0, r[3] - 16.0]; p.rect(fr[0], fr[1], fr[2], fr[3], PN_PL1);
                        if let Some((id, tw, th)) = self.ini_foto(&format!("i:mapa_{}", s.m)) { p.foto_cubre(id, tw, th, fr[0], fr[1], fr[2], fr[3], [0.5, 0.5], [1.0; 4]); }
                        self.pn_marco_foto(p, fr);
                        let x = fr[0] + fr[2] + u * 1.2; let fb = m.ft; let yb = r[1] + 9.0;
                        let wn = p.texto(Cara::S7, fb, x, yb + fb, TX, 0.0, &s.n);
                        if s.of { let wo = p.at.ancho(Cara::S7, fs, 0.12, "Oficial") + 14.0; let ro = [x + wn + 10.0, yb + 2.0, wo, fb * 1.3]; p.borde(ro[0], ro[1], ro[2], ro[3], 1.0, rgba(0xbdbab3, 0.9)); p.texto(Cara::S7, fs, ro[0] + 7.0, p.at.base_centrada(Cara::S7, fs, fs, ro[1], ro[3]), PN_T2, 0.12, "Oficial"); }
                        if s.pw { p.icono("candado", x + wn + 6.0 + if s.of { 90.0 } else { 0.0 }, yb, fb, 2.2, PN_T2); }
                        p.texto(Cara::S4, fs, x, yb + fb * 1.3 + fs + 2.0, PN_T2, 0.0, &format!("{} · {}", nombre_mapa(&s.m), if s.mo == "PvP" { "PvP" } else { "Libre" }));
                        let we = m.ft * 0.85 * 2.0 + 6.0 + p.at.ancho(Cara::S7, fs, 0.05, "Entrar"); let re = [r[0] + r[2] - 10.0 - we, r[1] + (r[3] - m.ph) / 2.0, we, m.ph];
                        self.pn_chico(p, m, re, "Entrar", "", true, Acc::Entrar(s.id.clone()), z);
                        let nt = n.len().to_string(); let wn2 = p.at.ancho(Cara::S7, fb, 0.0, &nt); p.texto(Cara::S7, fb, re[0] - u * 2.4 - wn2, p.at.base_centrada(Cara::S7, fb, fb * 1.1, r[1], r[3]), TX, 0.0, &nt);
                        p.icono("gente", re[0] - u * 2.4 - wn2 - fb * 1.3, r[1] + (r[3] - fb) / 2.0, fb, 2.2, PN_T2);
                    });
                }
            });
            ((salas.len() as f32) * (fh + gap) + u * 2.0, lista)
        });
        self.ini.pn.contenido = cont; self.ini.pn.alto_contenido = alto;
    }
    /// un botón chico (.rbChico: la letra de los rótulos)
    fn pn_chico(&self, p: &mut Pincel, m: &Pm, r: [f32; 4], txt: &str, ico: &'static str, amarillo: bool, a: Acc, z: &mut Vec<([f32; 4], Acc)>) {
        let fs = m.fs; let ap = self.ini.pn.apretado.as_ref() == Some(&a); let (fondo, tc, cara) = if amarillo { (if ap { rgba(0xffc531, 1.0) } else { AMA }, NEGRO, Cara::S7) } else { (if ap { rgba(0x303137, 1.0) } else { PN_PL3 }, TX, Cara::S4) };
        self.pn_golpe(p, &a, r, |p| {
            placa(p, r[0], r[1], r[2], r[3], 4, 12.0, fondo, None); if !amarillo { p.borde(r[0], r[1], r[2] - 11.0, r[3], 1.0, PN_LIN2); }
            let li = if ico.is_empty() { 0.0 } else { fs * 1.15 }; let g = if li > 0.0 && !txt.is_empty() { fs * 0.5 } else { 0.0 }; let wt = p.at.ancho(cara, fs, 0.05, &txt);
            let x0 = r[0] + (r[2] - 6.0 - (li + g + wt)) / 2.0;
            if !ico.is_empty() { p.icono(ico, x0, r[1] + (r[3] - li) / 2.0, li, 2.4, tc); }
            if !txt.is_empty() { p.texto(cara, fs, x0 + li + g, p.at.base_centrada(cara, fs, fs * 1.1, r[1], r[3]), tc, 0.05, &txt); }
        });
        zona(p, z, r, a);
    }

    /// Mods y mapas (la tienda): las pestañas (Mods, Mapas, Emotes, GMod), las categorías, el buscador, el orden y
    /// Explorar/Instalados; sin la tienda en línea, «No hay resultados» (GMod abre el panel de addons de la nativa)
    fn pn_tienda(&mut self, p: &mut Pincel, m: &Pm, tab: usize, cat: usize, t: f32, z: &mut Vec<([f32; 4], Acc)>) {
        let m2 = Pm { x: 6.0f32.max(if m.vh * 100.0 <= 500.0 { 6.0 } else { m.x }), y: if m.vh * 100.0 <= 500.0 { 6.0 } else { m.y }, ..*m };
        let m2 = Pm { w: m.w + 2.0 * (m.x - m2.x), h: m.h + 2.0 * (m.y - m2.y), ..m2 };
        self.pn_marco(p, &m2, t, |p, c| {
            let (xt, hc) = self.pn_cabecera(p, &Pm { ph: m.hb, ..m2 }, c, "04", None, "", t);
            let fs = m.fs; let base = p.at.base_centrada(Cara::S7, m.ft * 1.0, m.ft, c[1], hc - 1.0);
            let wt = p.texto(Cara::S7, m.ft, xt, base, TX, 0.035, "Mods y mapas");
            let tabs = [("Mods", "ico_mod"), ("Mapas", "mapa"), ("Emotes", "ico_animacion"), ("GMod", "ico_gmod")];
            let mut x = xt + wt + m.u; let ty = c[1] + (hc - 1.0 - m.hb) / 2.0;
            for (k, (n, ic)) in tabs.iter().enumerate() { let w = fs * 0.5 * 2.0 + 7.0 + p.at.ancho(Cara::S7, fs, 0.02, &n) + fs * 1.25 + fs * 0.35; self.pn_tab_chica(p, m, [x, ty, w, m.hb], n, ic, k == tab, Acc::Tab(k), z); x += w + 4.0; }
            // (arriba a la derecha: Crear un mod y Subir archivo —.rbmod / .rbmapa—, chicos)
            { let chico = |p: &Pincel, s: &str, c: Cara| fs * 0.5 * 2.0 + 7.0 + fs * 1.15 + fs * 0.35 + p.at.ancho(c, fs, 0.02, &s);
              let (ws0, wc0) = (chico(p, "Subir archivo", Cara::S4), chico(p, "Crear un mod", Cara::S7)); let solo_ico = c[0] + c[2] - m.u * 1.5 - ws0 - m.u - wc0 < x + m.u;
              if solo_ico { let l = m.hb; let rs = [c[0] + c[2] - m.u * 1.5 - l, ty, l, l]; let rc = [rs[0] - m.u * 0.5 - l, ty, l, l];
                  if rc[0] >= x { placa(p, rc[0], rc[1], rc[2], rc[3], 4, 12.0, AMA, None); p.icono("mas", rc[0] + (l - 6.0 - fs * 1.15) / 2.0, ty + (l - fs * 1.15) / 2.0, fs * 1.15, 2.6, NEGRO); zona(p, z, rc, Acc::CuentaNo);
                      placa(p, rs[0], rs[1], rs[2], rs[3], 4, 12.0, PN_PL3, None); p.icono("subir", rs[0] + (l - 6.0 - fs * 1.15) / 2.0, ty + (l - fs * 1.15) / 2.0, fs * 1.15, 2.2, TX); zona(p, z, rs, Acc::CuentaNo); } }
              else {
              let ws = ws0; let xs = c[0] + c[2] - m.u * 1.5 - ws; let rs = [xs, ty, ws, m.hb];
              placa(p, rs[0], rs[1], rs[2], rs[3], 4, 12.0, PN_PL3, None); p.borde(rs[0], rs[1], rs[2] - 11.0, rs[3], 1.0, PN_LIN2);
              p.icono("subir", xs + fs * 0.5, ty + (m.hb - fs * 1.15) / 2.0, fs * 1.15, 2.2, TX);
              p.texto(Cara::S4, fs, xs + fs * 2.0, ty + m.hb * 0.45, TX, 0.02, "Subir archivo"); p.texto(Cara::S4, fs * 0.8, xs + fs * 2.0, ty + m.hb * 0.45 + fs * 0.95, PN_T2, 0.0, ".rbmod / .rbmapa"); zona(p, z, rs, Acc::CuentaNo);
              let wc = chico(p, "Crear un mod", Cara::S7); let rc = [xs - m.u - wc, ty, wc, m.hb]; placa(p, rc[0], rc[1], rc[2], rc[3], 4, 12.0, AMA, None);
              p.icono("mas", rc[0] + fs * 0.5, ty + (m.hb - fs * 1.15) / 2.0, fs * 1.15, 2.6, NEGRO); p.texto(Cara::S7, fs, rc[0] + fs * 2.0, p.at.base_centrada(Cara::S7, fs, fs, ty, m.hb), NEGRO, 0.02, "Crear un mod"); zona(p, z, rc, Acc::CuentaNo);  } }
            let pie_h = m.ph + 2.0 + m.u * 1.5 + 1.0; let pie = self.pn_pie_sin_volver(p, &m2, c, pie_h, t);
            let pby = pie[1] + 1.0 + (pie_h - 1.0 - m.ph) / 2.0; let mut xb = pie[0] + m.u * 1.5;
            // (el pie de la tienda: los botones con la letra chica —Volver, Deshabilitar todo (apagado: no hay mods) y Habilitar todo—)
            let wtxt = |p: &Pincel, t: &str| fs * 0.5 * 2.0 + 7.0 + fs * 1.15 + fs * 0.35 + p.at.ancho(Cara::S4, fs, 0.02, &t);
            let wpn = fs * 1.1 * 2.0 + 12.0 + p.at.ancho(Cara::S7, m.ft, 0.05, "Empezar partida nueva") + m.ft * 1.5;
            let corto = wtxt(p, "Volver") + wtxt(p, "Deshabilitar todo") + wtxt(p, "Habilitar todo") + m.u * 3.0 + wpn > pie[2] - m.u * 3.0;
            for (txt, ico, col, a, apagado) in [("Volver", "atras", TX, Acc::Volver, false), ("Deshabilitar todo", "prohibido", rgba(0xff7a6e, 1.0), Acc::Nada, true), ("Habilitar todo", "si", rgba(0x6fd68f, 1.0), Acc::Mods, false)] {
                let txt = if corto && a != Acc::Volver { "" } else { txt };
                let wb = if txt.is_empty() { fs * 0.5 * 2.0 + 7.0 + fs * 1.15 } else { wtxt(p, txt) }; let rb = [xb, pby, wb.max(44.0), m.ph]; let wb = rb[2];
                p.con_alfa(if apagado { 0.42 } else { 1.0 }, |p| { placa(p, rb[0], rb[1], rb[2], rb[3], 4, 12.0, PN_PL3, None); p.borde(rb[0], rb[1], rb[2] - 11.0, rb[3], 1.0, PN_LIN2);
                    p.icono(ico, xb + fs * 0.5, pby + (m.ph - fs * 1.15) / 2.0, fs * 1.15, 2.4, col); p.texto(Cara::S4, fs, xb + fs * 2.0, p.at.base_centrada(Cara::S4, fs, fs, pby, m.ph), TX, 0.02, &txt); });
                if !apagado { zona(p, z, rb, a); } xb += wb + m.u; }
            // (Empezar partida nueva: el texto y después la flecha)
            { let f = m.ft; let txt = "Empezar partida nueva"; let wp = fs * 1.1 * 2.0 + 12.0 + p.at.ancho(Cara::S7, f, 0.05, txt) + f * 0.35 + f * 1.15; let rp = [pie[0] + pie[2] - m.u * 1.5 - wp, pby - 1.0, wp, m.ph + 2.0];
              let ap = self.ini.pn.apretado == Some(Acc::Empezar); self.pn_golpe(p, &Acc::Empezar, rp, |p| { placa(p, rp[0], rp[1], rp[2], rp[3], 1, 22.0, if ap { rgba(0xffc531, 1.0) } else { AMA }, None);
                  let wt = p.texto(Cara::S7, f, rp[0] + fs * 1.1, p.at.base_centrada(Cara::S7, f, f * 1.1, rp[1], rp[3]), NEGRO, 0.05, txt); p.icono("jugar", rp[0] + fs * 1.1 + wt + f * 0.35, rp[1] + (rp[3] - f * 1.15) / 2.0, f * 1.15, 2.7, NEGRO); });
              zona(p, z, rp, Acc::Empezar); }
            // (a la izquierda, las categorías; arriba de la grilla, el buscador, el orden y Explorar/Instalados)
            let cats = ["Todas", "Jugabilidad", "Física", "Armas", "Personajes", "Diversión", "Construcción", "Vehículos", "Aventura", "PvP", "Otros"];
            let cy0 = c[1] + hc; let cw = (c[2] * 0.125).max(fs * 9.0); let cal = pie[1] - cy0;
            p.rect(c[0], cy0, cw, cal, PN_POZO); p.rect(c[0] + cw - 1.0, cy0, 1.0, cal, PN_LIN);
            p.con_recorte([c[0], cy0, cw, cal], |p| {
                p.texto(Cara::S7, fs, c[0] + m.u * 1.4, cy0 + m.u + fs, AMA, 0.08, "Categorías");
                let mut y = cy0 + m.u * 1.6 + fs * 1.2;
                for (k, n) in cats.iter().enumerate() { let r = [c[0] + m.u * 0.8, y, cw - m.u * 0.8 - 8.0, m.hb];
                    if k == cat { placa(p, r[0], r[1], r[2], r[3], 4, 12.0, AMA, None); }
                    p.texto(if k == cat { Cara::S7 } else { Cara::S4 }, fs, r[0] + m.u * 1.4, p.at.base_centrada(Cara::S4, fs, fs, r[1], r[3]), if k == cat { NEGRO } else { PN_T2 }, 0.05, &n);
                    zona(p, z, r, Acc::Cat(k)); y += m.hb + 3.0; }
            });
            let gx = c[0] + cw + m.u * 1.5; let gy = cy0 + m.u * 1.1; let gw = c[2] - cw - m.u * 3.0;
            let wseg = p.at.ancho(Cara::S7, m.ft, 0.05, "Explorar") + p.at.ancho(Cara::S4, m.ft, 0.05, "Instalados") + m.ft * 3.6; let wo = (gw * 0.22).max(m.ft * 8.0);
            let wb = (gw - wseg - wo - m.u * 2.0).min(gw * 0.53);
            self.pn_cascada(p, t, 0, |p| {
                p.rect(gx, gy, wb, m.ph, PN_POZO); p.borde(gx, gy, wb, m.ph, 1.0, PN_LIN2); p.icono("buscar", gx + m.ft * 0.8, gy + (m.ph - m.ft * 1.2) / 2.0, m.ft * 1.2, 2.4, AMA);
                p.texto(Cara::S4, m.ft, gx + m.ft * 2.6, p.at.base_centrada(Cara::S4, m.ft, m.ft * 1.2, gy, m.ph), PN_T3, 0.0, "Buscar…");
                let xo = gx + gw - wseg - m.u - wo; p.rect(xo, gy, wo, m.ph, PN_POZO); p.borde(xo, gy, wo, m.ph, 1.0, PN_LIN2);
                p.texto(Cara::S4, m.ft, xo + m.ft * 0.8, p.at.base_centrada(Cara::S4, m.ft, m.ft * 1.1, gy, m.ph), TX, 0.04, "Populares"); p.icono("chevron", xo + wo - m.ft * 1.7, gy + (m.ph - m.ft) / 2.0, m.ft, 2.6, AMA);
                let xs = xo + wo + m.u; let w1 = p.at.ancho(Cara::S7, m.ft, 0.05, "Explorar") + m.ft * 1.8;
                p.rect(xs, gy, w1, m.ph, AMA); p.texto(Cara::S7, m.ft, xs + m.ft * 0.9, p.at.base_centrada(Cara::S7, m.ft, m.ft, gy, m.ph), NEGRO, 0.05, "Explorar");
                p.rect(xs + w1, gy, wseg - w1, m.ph, PN_PL2); p.texto(Cara::S4, m.ft, xs + w1 + m.ft * 0.9, p.at.base_centrada(Cara::S4, m.ft, m.ft, gy, m.ph), PN_T2, 0.05, "Instalados");
                p.texto_c(Cara::S4, m.ft, gx + gw / 2.0, gy + m.ph + m.u * 4.5, PN_T2, 0.0, if tab == 2 { "Los emotes del juego están en el panel de Emotes" } else { "No hay resultados" });
            });
        });
    }
    /// una pestaña chica de la tienda (con ícono)
    fn pn_tab_chica(&self, p: &mut Pincel, m: &Pm, r: [f32; 4], txt: &str, ico: &'static str, sel: bool, a: Acc, z: &mut Vec<([f32; 4], Acc)>) {
        let fs = m.fs; let (fondo, tc, cara) = if sel { (AMA, NEGRO, Cara::S7) } else { (PN_PL2, PN_T2, Cara::S4) };
        self.pn_golpe(p, &a, r, |p| {
            placa(p, r[0], r[1], r[2], r[3], 4, 12.0, fondo, None);
            let l = fs * 1.25; let x = r[0] + fs * 0.5; p.icono(ico, x, r[1] + (r[3] - l) / 2.0, l, 2.2, if sel { NEGRO } else { PN_T2 });
            p.texto(cara, fs, x + l + fs * 0.35, p.at.base_centrada(cara, fs, fs, r[1], r[3]), tc, 0.02, &txt);
        });
        zona(p, z, r, a);
    }

    /// Personajes (rbmenus.js, pjV2): a la izquierda la cabecera con las pestañas y el buscador, la grilla de personajes (su
    /// retrato y su nombre; el elegido con su marca) y el pie; a la derecha el escenario con el elegido en 3D (lo dibuja el
    /// motor: ini_lobby), su número, su nombre y «Arrastrá para girarlo»
    fn pn_personajes(&mut self, p: &mut Pincel, m: &Pm, tab: usize, scroll: f32, t: f32, z: &mut Vec<([f32; 4], Acc)>) {
        let skins: Vec<String> = self.paq.as_ref().and_then(|q| q.d["chars"].as_array().map(|a| a.iter().filter_map(|s| s.as_str().map(|s| s.to_string())).collect())).unwrap_or_default();
        let retratos: Vec<Option<String>> = skins.iter().map(|s| retrato(self.paq.as_ref(), s)).collect();
        for r in retratos.iter().flatten() { self.ini_pedir_foto(&format!("i:{r}")); }
        let elegido = self.skin.clone(); let en3d = self.mapa.is_none();
        // (el lugar: con poco alto, a 6 px del borde y el escenario de clamp(190 px, 37 %, 420 px); si no, el 40 %)
        let bajo = m.vh * 100.0 <= 500.0; let (x0, y0, w0, h0) = (m.x, m.y, m.w, m.h);
        let esc_w = if bajo { ((w0 - 2.0) * 0.3).max(190.0) } else { (w0 - 2.0) * 0.4 }; let iw = w0 - 2.0 - esc_w;
        let c = [x0 + 1.0, y0 + 1.0, iw, h0 - 2.0];
        let k = bezier(0.2, 0.8, 0.2, 1.0, prog(t, 0.0, 0.3));
        let (alto, cont) = p.con_alfa(k, |p| {
            let hc = m.hb + 7.0; let m = &Pm { ph: m.hb, ..*m }; p.rect(c[0], c[1], c[2], hc - 1.0, PN_POZO); p.rect(c[0], c[1] + hc - 1.0, c[2], 1.0, PN_LIN);
            let fs = m.fs; let mut x = c[0] + m.u; let ty = c[1] + 3.0;
            for (k2, (n, ic)) in [("Personajes", "persona"), ("Mods", "ico_mod"), ("Gorros", "gorro")].iter().enumerate() {
                let w = 8.0 + 15.0 + fs * 1.15 + fs * 0.5 + p.at.ancho(if k2 == tab { Cara::S7 } else { Cara::S4 }, fs, 0.02, &n);
                self.pn_tab_chica(p, m, [x, ty, w, m.ph], n, ic, k2 == tab, Acc::Tab(k2), z); x += w + 3.0; }
            // (el buscador: hasta 380 px, a la derecha)
            let bw = (c[0] + c[2] - 6.0 - (x + m.u)).min(380.0).max(0.0); let bx = c[0] + c[2] - 6.0 - bw;
            if bw > 110.0 { p.rect(bx, ty, bw, m.ph, PN_POZO); p.borde(bx, ty, bw, m.ph, 1.0, PN_LIN2); let li = m.fg * 1.05; p.icono("buscar", bx + fs * 1.6 - li / 2.0 + 8.0, ty + (m.ph - li) / 2.0, li, 2.4, AMA);
                p.texto_max(Cara::S4, m.ft, bx + fs * 1.6 + li, p.at.base_centrada(Cara::S4, m.ft, m.ft * 1.2, ty, m.ph), PN_T3, 0.0, "Buscar personaje…", bw - fs * 1.6 - li - 8.0); zona(p, z, [bx, ty, bw, m.ph], Acc::Buscar); }
            self.pn_rayas(p, c[0] + c[2] - (c[2] * 0.34).min(240.0), c[1] + hc - 4.0, (c[2] * 0.34).min(240.0), 3.0, 0.75);
            // (el pie: Volver chico y la cuenta)
            let pie_h = m.ph + m.u * 1.5 + 1.0; let py = c[1] + c[3] - pie_h; p.rect(c[0], py, c[2], 1.0, PN_LIN); p.rect(c[0], py + 1.0, c[2], pie_h - 1.0, rgba(0x121315, 1.0));
            self.pn_rayas(p, c[0] + 24.0, py + pie_h - 3.0, (c[2] * 0.22).min(160.0), 3.0, 0.5);
            let wv = 8.0 + 15.0 + fs * 1.15 + fs * 0.5 + p.at.ancho(Cara::S4, fs, 0.02, "Volver"); let rv = [c[0] + m.u * 1.5, py + 1.0 + (pie_h - 1.0 - m.ph) / 2.0, wv, m.ph];
            self.pn_chico(p, m, rv, "Volver", "atras", false, Acc::Volver, z);
            if tab == 0 { let cuenta = format!("{} personajes", skins.len()); p.texto_d(Cara::S4, fs, c[0] + c[2] - m.u * 1.5, p.at.base_centrada(Cara::S4, fs, fs, py, pie_h), PN_T2, 0.08, &cuenta); }
            // (la grilla: columnas de 16 % del alto, que llenan el ancho; cada tarjeta con el retrato cuadrado y el nombre)
            let g = [c[0], c[1] + hc, c[2], py - c[1] - hc]; p.rect(g[0], g[1], g[2], g[3], PN_PL);
            let (pl, pt, gap) = (m.u * 1.4, m.u * 1.1, m.u); let gw = g[2] - 2.0 * pl; let minc = (16.0 * m.vh).max(84.0);
            let n = (((gw + gap) / (minc + gap)).floor() as usize).max(1); let cw = (gw - gap * (n - 1) as f32) / n as f32;
            let pd = m.u * 0.5; let foto = cw - 2.0 - 2.0 * pd; let ch = 2.0 + 2.0 * pd + foto + m.u * 0.45 + fs * 1.2;
            if tab == 0 { p.con_recorte(g, |p| { for (k2, s) in skins.iter().enumerate() {
                let r = [g[0] + pl + (k2 % n) as f32 * (cw + gap), g[1] + pt + (k2 / n) as f32 * (ch + gap) - scroll, cw, ch];
                if r[1] > g[1] + g[3] || r[1] + r[3] < g[1] { continue; }
                let sel = *s == elegido;
                self.pn_cascada(p, t, 1 + (k2 / n).min(6), |p| {
                    p.rect(r[0] + 4.0, r[1] + 4.0, r[2], r[3], [0.0, 0.0, 0.0, 0.5]); p.rect(r[0], r[1], r[2], r[3], if sel { rgba(0x221e12, 1.0) } else { PN_PL2 }); if !sel { sin_grano(p, r[0], r[1], r[2], r[3], r[0] + 37.0, r[1] + 11.0, 1.0); }
                    p.borde(r[0], r[1], r[2], r[3], 1.0, if sel { AMA } else { PN_LIN }); if sel { p.borde(r[0] + 1.0, r[1] + 1.0, r[2] - 2.0, r[3] - 2.0, 1.0, AMA); }
                    let fr = [r[0] + 1.0 + pd, r[1] + 1.0 + pd, foto, foto]; p.rect(fr[0], fr[1], fr[2], fr[3], PN_PL1);
                    if let Some((id, tw, th)) = retratos[k2].as_ref().and_then(|x| self.ini_foto(&format!("i:{x}"))) { p.foto_cubre(id, tw, th, fr[0], fr[1], fr[2], fr[3], [0.5, 0.5], [1.0; 4]); } else { p.icono("persona", fr[0] + fr[2] * 0.29, fr[1] + fr[3] * 0.29, fr[2] * 0.42, 2.2, PN_T3); }
                    self.pn_marco_foto(p, fr);
                    p.texto_max(Cara::S7, fs, r[0] + (r[2] - p.at.ancho(Cara::S7, fs, 0.0, &skin_nombre(s)).min(foto)) / 2.0, p.at.base_centrada(Cara::S7, fs, fs * 1.2, fr[1] + foto + m.u * 0.45, fs * 1.2), if sel { [1.0; 4] } else { TX }, 0.0, &skin_nombre(s), foto);
                    p.poli(&[[r[0] + r[2] - 12.0, r[1] - 1.0], [r[0] + r[2] + 1.0, r[1] - 1.0], [r[0] + r[2] + 1.0, r[1] + 12.0]], PN_POZO);
                    p.linea([r[0] + r[2] - 12.0 + 0.5, r[1]], [r[0] + r[2], r[1] + 12.0 - 0.5], 1.0, PN_LIN2);
                    if sel { let l = 24.8; p.rect(r[0] + 3.0 + 2.0, r[1] + 3.0 + 2.0, l, l, [0.0, 0.0, 0.0, 0.5]); p.rect(r[0] + 3.0, r[1] + 3.0, l, l, AMA); p.icono("si", r[0] + 3.0 + l * 0.18, r[1] + 3.0 + l * 0.18, l * 0.64, 3.2, NEGRO); }
                });
                zona(p, z, r, Acc::Skin(s.clone()));
            } }); }
            else { p.texto_c(Cara::S4, m.ft, g[0] + g[2] / 2.0, g[1] + g[3] / 2.0, PN_T2, 0.0, if tab == 1 { "Los personajes de los addons de GMod: desde Mods y mapas → GMod" } else { "Los gorros todavía no están en la versión nativa" }); }
            ((skins.len().div_ceil(n)) as f32 * (ch + gap) + pt + m.u * 1.6, g)
        });
        self.ini.pn.contenido = cont; self.ini.pn.alto_contenido = alto;
        // (el escenario: su borde, el resplandor del piso, el número y el nombre, y «Arrastrá para girarlo»)
        let ex = c[0] + c[2]; let ew = x0 + w0 - ex; let (ey, eh) = (y0, h0);
        self.ini.pn.escena = [ex, ey, ew, eh];
        p.rect(ex, ey, 1.0, eh, PN_LIN);
        let (cx, cy) = (ex + ew / 2.0, ey + eh * 0.93); let n = 40;
        for k2 in 0..6 { let (t0, t1) = (k2 as f32 / 6.0, (k2 + 1) as f32 / 6.0); let (a0, a1) = (0.22 * (1.0 - t0), 0.22 * (1.0 - t1));
            for i in 0..n { let (g0, g1) = (i as f32 / n as f32 * std::f32::consts::TAU, (i + 1) as f32 / n as f32 * std::f32::consts::TAU); let q = |t: f32, g: f32| [cx + ew * 0.55 * t * g.cos(), cy + eh * 0.16 * t * g.sin()];
                let b = [8.5 / p.at.w as f32, 8.5 / p.at.h as f32]; p.quad(pincel::TEX_MENUS, [q(t0, g0), q(t0, g1), q(t1, g1), q(t1, g0)], [b; 4], [[0.95, 0.7, 0.1, a0], [0.95, 0.7, 0.1, a0], [0.95, 0.7, 0.1, a1], [0.95, 0.7, 0.1, a1]]); } }
        if !en3d { if let Some(r) = retrato(self.paq.as_ref(), &elegido) { self.ini_pedir_foto(&format!("i:{r}")); if let Some((id, tw, th)) = self.ini_foto(&format!("i:{r}")) { let l = (ew * 0.62).min(eh * 0.55); p.foto_cubre(id, tw, th, cx - l / 2.0, ey + eh * 0.25, l, l, [0.5, 0.3], [1.0; 4]); } } }
        let fg = m.fg; let k = bezier(0.3, 1.5, 0.5, 1.0, prog(t, 0.12, 0.34)); let sx = ex + 14.0; let sy = ey + 12.0;
        p.con(pincel::escalar_en(1.6 - 0.6 * k, 1.6 - 0.6 * k, sx + fg * 0.7, sy + fg * 0.45), |p| p.con_alfa(k.min(1.0), |p| {
            let wn = p.at.ancho(Cara::S7, fg * 0.78, 0.02, "06") + fg * 0.5; placa(p, sx, sy, wn + 12.0, fg * 0.95, 4, 12.0, AMA, None);
            p.con(pincel::rotar_en(-13.0, sx + fg * 0.5, sy), |p| p.pieza("cinta", sx - 5.0, sy - 6.0, fg * 1.2, fg * 0.55, [1.0, 1.0, 1.0, 0.9]));
            p.texto(Cara::S7, fg * 0.78, sx + fg * 0.25, p.at.base_centrada(Cara::S7, fg * 0.78, fg * 0.78, sy, fg * 0.95), NEGRO, 0.02, "06"); }));
        let yn = sy + fg * 0.95 + 8.0; p.rect(sx, yn, 4.0, fg * 1.1, AMA);
        p.texto_max(Cara::S7, fg, sx + 16.0, p.at.base_centrada(Cara::S7, fg, fg * 1.1, yn, fg * 1.1), TX, 0.035, &skin_nombre(&elegido), ew - 40.0);
        let tg = "Arrastrá para girarlo"; let fs = m.fs; let wtg = p.at.ancho(Cara::S4, fs, 0.08, tg) + fs * 2.9; let rg = [cx - wtg / 2.0, ey + eh - fs * 2.6, wtg, fs * 1.9];
        p.rect(rg[0], rg[1], rg[2], rg[3], rgba(0x08090a, 0.86)); p.icono("girar", rg[0] + fs * 0.7, rg[1] + (rg[3] - fs) / 2.0, fs, 2.4, AMA);
        p.texto(Cara::S4, fs, rg[0] + fs * 2.1, p.at.base_centrada(Cara::S4, fs, fs, rg[1], rg[3]), PN_T2, 0.08, tg);
    }

    /// Opciones (el panel de Ajustes con el lenguaje de los paneles): las pestañas a la izquierda y cada renglón con lo que se
    /// puede elegir (los ajustes de la nativa: ajustes.rs)
    fn pn_opciones(&mut self, p: &mut Pincel, m: &Pm, tab: usize, scroll: f32, t: f32, z: &mut Vec<([f32; 4], Acc)>) {
        let pw = (m.w * 0.62).max(m.h * 1.3).min(m.w); let ph = m.h - 4.0; let mo = Pm { x: m.x + (m.w - pw) / 2.0, y: m.y + 2.0, w: pw, h: ph, ..*m };
        let (alto, cont) = self.pn_marco(p, &mo, t, |p, c| {
            let (_, hc) = self.pn_cabecera(p, m, c, "07", None, "Opciones", t);
            let pie_h = m.ph + 2.0 + m.u * 1.5 + 1.0; let y1 = c[1] + c[3] - pie_h; p.rect(c[0], y1, c[2], 1.0, PN_LIN); p.rect(c[0], y1 + 1.0, c[2], pie_h - 1.0, PN_POZO);
            let wl = self.pn_principal_ancho(p, m, "Listo") - m.ft * 1.6; self.pn_listo(p, m, [c[0] + c[2] - m.u * 1.5 - wl, y1 + 1.0 + (pie_h - 1.0 - m.ph - 2.0) / 2.0, wl, m.ph + 2.0], z);
            let tw = (c[2] * 0.25).max(m.ft * 9.0); let ty0 = c[1] + hc; let alto_t = y1 - ty0;
            p.rect(c[0], ty0, tw, alto_t, rgba(0x08090a, 0.6)); p.rect(c[0] + tw - 1.0, ty0, 1.0, alto_t, PN_LIN);
            let icos = ["ajustes", "video", "volumen", "mundo", "carpeta", "musica"];
            // (las pestañas: del alto de los botones, o más bajas si no entran)
            let nt = ajustes::PESTANAS.len() as f32; let th = ((alto_t - m.u * 1.6) / nt - 3.0).min(m.ph).max(26.0);
            for (k, n) in ajustes::PESTANAS.iter().enumerate() { let r = [c[0] + 4.0, ty0 + m.u * 0.8 + k as f32 * (th + 3.0), tw - 12.0, th]; let sel = k == tab;
                if sel { placa(p, r[0], r[1], r[2], r[3], 4, 12.0, AMA, None); p.rect(r[0], r[1], 4.0, r[3], rgba(0x121212, 0.8)); }
                p.icono(icos[k % icos.len()], r[0] + m.u * 1.5, r[1] + (r[3] - m.fs * 1.1) / 2.0, m.fs * 1.1, 2.2, if sel { NEGRO } else { PN_T2 });
                p.texto_max(if sel { Cara::S7 } else { Cara::S4 }, m.fs, r[0] + m.u * 1.5 + m.fs * 1.7, p.at.base_centrada(Cara::S4, m.fs, m.fs, r[1], r[3]), if sel { NEGRO } else { PN_T2 }, 0.06, &n, r[2] - m.u * 1.5 - m.fs * 2.4);
                zona(p, z, r, Acc::AjTab(k)); }
            let ca = [c[0] + tw + m.u, ty0 + m.u, c[2] - tw - m.u * 2.0, alto_t - m.u * 2.0];
            p.rect(ca[0], ca[1], ca[2], ca[3], rgba(0x1b1c20, 0.6)); p.borde(ca[0], ca[1], ca[2], ca[3], 1.0, PN_LIN);
            let mut alto = 0.0;
            p.con_recorte(ca, |p| {
                let nom = ajustes::PESTANAS.get(tab).copied().unwrap_or(""); let x = ca[0] + m.u * 1.5; let mut y = ca[1] + m.u - scroll;
                let wn = p.texto(Cara::S7, m.fs, x, y + m.fs * 1.1, AMA, 0.1, &nom); self.pn_rayas(p, x + wn + m.u, y + m.fs * 0.55, ca[2] - wn - m.u * 4.0, 3.0, 0.5); y += m.fs * 1.6 + m.u;
                for (f, cl) in ajustes::claves(tab).iter().enumerate() {
                    let vals = self.valores_aj(*cl); let el = self.elegido_aj(*cl); let fh = m.ph + m.u * 0.6;
                    let nombre = ajustes::nombre(*cl); let wnom = (ca[2] * 0.34).min(m.ft * 9.0);
                    self.pn_parrafo(p, x, y + (fh - m.ft * 1.3) / 2.0, wnom, m.fs, m.fs * 1.3, TX, nombre, false);
                    // (los valores como un segmento de botones: el elegido amarillo; si no entran, en dos renglones)
                    let xv0 = x + wnom + m.u; let wv = ca[0] + ca[2] - m.u * 1.5 - xv0; let n = vals.len().max(1);
                    let por = ((wv / (m.ft * 5.5)).floor() as usize).clamp(1, n); let filas = n.div_ceil(por); let bw = wv / por as f32;
                    for (k, v) in vals.iter().enumerate() { let r = [xv0 + (k % por) as f32 * bw, y + (k / por) as f32 * (m.ph.max(44.0) + 3.0), bw - 3.0, m.ph.max(44.0)]; let sel = el == Some(k);
                        p.rect(r[0], r[1], r[2], r[3], if sel { AMA } else { PN_POZO }); if !sel { p.borde(r[0], r[1], r[2], r[3], 1.0, PN_LIN2); }
                        let mut tt = m.fs; while p.at.ancho(Cara::S4, tt, 0.04, &v) > r[2] - 8.0 && tt > 9.0 { tt *= 0.92; }
                        p.texto_c(if sel { Cara::S7 } else { Cara::S4 }, tt, r[0] + r[2] / 2.0, p.at.base_centrada(Cara::S4, tt, tt, r[1], r[3]), if sel { NEGRO } else { TX }, 0.04, &v);
                        zona(p, z, r, Acc::Aj(f, k)); }
                    y += (filas as f32 * (m.ph.max(44.0) + 3.0)).max(fh) + m.u * 0.6;
                }
                alto = y + scroll - ca[1];
            });
            (alto, ca)
        });
        self.ini.pn.contenido = cont; self.ini.pn.alto_contenido = alto;
    }
    /// «Listo» (el amarillo de Ajustes)
    fn pn_listo(&self, p: &mut Pincel, m: &Pm, r: [f32; 4], z: &mut Vec<([f32; 4], Acc)>) {
        let a = Acc::Listo; self.pn_golpe(p, &a, r, |p| { placa(p, r[0], r[1], r[2], r[3], 1, 22.0, AMA, None);
            p.texto_c(Cara::S7, m.ft * 1.1, r[0] + (r[2] - 10.0) / 2.0, p.at.base_centrada(Cara::S7, m.ft * 1.1, m.ft * 1.1, r[1], r[3]), NEGRO, 0.05, "Listo"); });
        zona(p, z, r, a);
    }

    /// Bugs y sugerencias (panel_juego.js): las pestañas Bugs, Sugerencias y Novedades (el registro de novedades.js); los
    /// publicados necesitan la tienda en línea
    fn pn_bugs(&mut self, p: &mut Pincel, m: &Pm, tab: usize, scroll: f32, t: f32, z: &mut Vec<([f32; 4], Acc)>) {
        let notas = novedades();
        let (alto, cont) = self.pn_marco(p, m, t, |p, c| {
            let (xt, hc) = self.pn_cabecera(p, m, c, "!", Some(("bicho", AMA)), "Bugs y sugerencias", t);
            let tabs = [("Bugs", "bicho"), ("Sugerencias", "foco"), ("Novedades", "estrella")]; let mut x = xt + m.u; let ty = c[1] + (hc - 1.0 - m.ph) / 2.0;
            for (k, (n, ic)) in tabs.iter().enumerate() { let w = self.pn_pestana_ancho(p, m, n, None, true); if x + w > c[0] + c[2] - 16.0 { break; } self.pn_pestana(p, m, [x, ty, w, m.ph], n, None, Some(ic), k == tab, Acc::Tab(k), z); x += w + 4.0; }
            let pie_h = m.ph + 2.0 + m.u * 1.5 + 1.0; let pie = self.pn_pie(p, m, c, pie_h, t, z);
            if tab < 2 { let s = if tab == 0 { "Contar un bug" } else { "Dar una idea" }; let wp = self.pn_principal_ancho(p, m, s); let pby = pie[1] + 1.0 + (pie_h - 1.0 - m.ph) / 2.0;
                self.pn_principal(p, m, [pie[0] + pie[2] - m.u * 1.5 - wp, pby - 1.0, wp, m.ph + 2.0], s, "mas", Acc::CuentaNo, z); }
            let cu = [c[0], c[1] + hc, c[2], pie[1] - c[1] - hc]; let u = m.u; let mut alto = 0.0;
            p.con_recorte(cu, |p| {
                let x0 = cu[0] + u * 1.4; let w = cu[2] - u * 2.8; let mut y = cu[1] + u - scroll;
                if tab == 2 { for (i, n) in notas.iter().enumerate() {
                    let rs = p.at.renglones(Cara::S4, m.fs, 0.0, &n.es, w - u * 2.0); let h = u * 1.2 + m.ft * 1.3 + rs.len() as f32 * m.fs * 1.4 + u;
                    if y + h > cu[1] && y < cu[1] + cu[3] { self.pn_cascada(p, t, i.min(12), |p| {
                        p.rect(x0, y, w, h, if i == 0 { rgba(0x2a2410, 0.9) } else { PN_PL2 }); p.borde(x0, y, w, h, 1.0, if i == 0 { con_a(AMA, 0.6) } else { PN_LIN });
                        let wv = p.texto(Cara::S7, m.ft, x0 + u, y + u * 0.6 + m.ft, TX, 0.04, &format!("JXMOD {}", n.v));
                        if i == 0 { let wl = p.at.ancho(Cara::S7, m.fs * 0.8, 0.06, "La última") + 10.0; p.rect(x0 + u + wv + 8.0, y + u * 0.6 + 2.0, wl, m.ft, AMA); p.texto(Cara::S7, m.fs * 0.8, x0 + u + wv + 13.0, y + u * 0.6 + m.ft * 0.82, NEGRO, 0.06, "La última"); }
                        p.texto_d(Cara::S4, m.fs, x0 + w - u, y + u * 0.6 + m.ft, PN_T3, 0.04, &n.f);
                        self.pn_parrafo(p, x0 + u, y + u * 1.2 + m.ft * 1.3, w - u * 2.0, m.fs, m.fs * 1.4, PN_T2, &n.es, false);
                    }); }
                    y += h + u * 0.6; }
                } else { p.texto(Cara::S4, m.ft, x0, y + m.ft * 1.2, PN_T2, 0.0, if tab == 0 { "Todavía no hay bugs publicados (los publicados están en la tienda en línea)." } else { "Todavía no hay sugerencias publicadas." }); y += m.ft * 2.0; }
                alto = y + scroll - cu[1];
            });
            (alto, cu)
        });
        self.ini.pn.contenido = cont; self.ini.pn.alto_contenido = alto;
    }
    /// La grieta (el evento): qué es (sin interruptor: está siempre abierta)
    fn pn_grieta(&mut self, p: &mut Pincel, m: &Pm, t: f32, z: &mut Vec<([f32; 4], Acc)>) {
        let foto = self.ini.fondos.get(4.min(self.ini.fondos.len().saturating_sub(1))).cloned(); if let Some(f) = &foto { self.ini_pedir_foto(f); }
        let pw = (m.w * 0.7).min(m.h * 2.1); let mo = Pm { x: m.x + (m.w - pw) / 2.0, w: pw, ..*m };
        self.pn_marco(p, &mo, t, |p, c| {
            let (_, hc) = self.pn_cabecera(p, m, c, "!", Some(("rayo", PN_VI)), "La grieta", t);
            let pie_h = m.ph + m.u * 1.5 + 1.0; let pie = self.pn_pie(p, m, c, pie_h, t, z);
            let cu = [c[0] + m.u * 1.5, c[1] + hc + m.u * 1.5, c[2] - m.u * 3.0, pie[1] - c[1] - hc - m.u * 3.0];
            let fw = cu[2] * 0.42; let fr = [cu[0], cu[1], fw, (fw * 9.0 / 16.0).min(cu[3])];
            self.pn_cascada(p, t, 0, |p| { p.rect(fr[0], fr[1], fr[2], fr[3], PN_PL1); if let Some((id, tw, th)) = foto.as_ref().and_then(|f| self.ini_foto(f)) { p.foto_cubre(id, tw, th, fr[0], fr[1], fr[2], fr[3], [0.5, 0.5], [1.0; 4]); } self.pn_marco_foto(p, fr); });
            let tx = fr[0] + fw + m.u * 1.5; let tw = cu[0] + cu[2] - tx;
            self.pn_cascada(p, t, 1, |p| {
                let y = cu[1] + self.pn_parrafo(p, tx, cu[1], tw, m.ft, m.ft * 1.4, TX, "Una grieta en el cielo de los mapas del juego: de vez en cuando caen cosas de ella, encendidas. Es parte del juego: está siempre abierta.", false);
                let e = "Activo"; let we = p.at.ancho(Cara::S7, m.fs, 0.08, e) + 22.0; p.rect(tx, y + m.u, we, m.fs * 1.8, rgba(0x2a1f3d, 1.0)); p.disco(tx + 9.0, y + m.u + m.fs * 0.9, 4.0, PN_VI); p.texto(Cara::S7, m.fs, tx + 17.0, p.at.base_centrada(Cara::S7, m.fs, m.fs, y + m.u, m.fs * 1.8), rgba(0xd9c2ff, 1.0), 0.08, e);
            });
        });
    }
    /// Avisos: sin la tienda en línea, «No hay avisos por ahora.»
    fn pn_avisos(&mut self, p: &mut Pincel, m: &Pm, t: f32, z: &mut Vec<([f32; 4], Acc)>) {
        let pw = (m.w * 0.6).min(m.h * 1.8); let mo = Pm { x: m.x + (m.w - pw) / 2.0, w: pw, ..*m };
        self.pn_marco(p, &mo, t, |p, c| {
            let (_, hc) = self.pn_cabecera(p, m, c, "!", Some(("campana", AMA)), "Avisos", t);
            let pie_h = m.ph + m.u * 1.5 + 1.0; let pie = self.pn_pie(p, m, c, pie_h, t, z);
            self.pn_cascada(p, t, 0, |p| p.texto_c(Cara::S4, m.ft, c[0] + c[2] / 2.0, (c[1] + hc + pie[1]) / 2.0, PN_T2, 0.0, "No hay avisos por ahora."));
        });
    }
    /// el idioma (IDIOMAS_RB): la lista de los 14; la nativa por ahora está en castellano
    fn pn_idioma(&mut self, p: &mut Pincel, m: &Pm, t: f32, z: &mut Vec<([f32; 4], Acc)>) {
        let idiomas = [("ES", "Español"), ("EN", "English"), ("PT", "Português"), ("ID", "Bahasa Indonesia"), ("MS", "Bahasa Melayu"), ("FIL", "Filipino"), ("JA", "Japanese"), ("TH", "Thai"), ("TR", "Türkçe"), ("AR", "Arabic"), ("RU", "Russian"), ("UK", "Ukrainian"), ("FR", "Français"), ("DE", "Deutsch")];
        self.pn_marco(p, m, t, |p, c| {
            let (_, hc) = self.pn_cabecera(p, m, c, "!", Some(("mundo", AMA)), "Idioma", t);
            let pie_h = m.ph + m.u * 1.5 + 1.0; let pie = self.pn_pie(p, m, c, pie_h, t, z);
            let cu = [c[0] + m.u * 1.5, c[1] + hc + m.u, c[2] - m.u * 3.0, pie[1] - c[1] - hc - m.u * 2.0];
            let n = ((cu[2] / (m.ft * 11.0)).floor() as usize).clamp(1, 4); let bw = (cu[2] - (n - 1) as f32 * m.u) / n as f32; let bh = m.ph.min((cu[3] - 4.0 * m.u * 0.5) / (idiomas.len().div_ceil(n)) as f32 - m.u * 0.5);
            for (k, (cod, nom)) in idiomas.iter().enumerate() { let r = [cu[0] + (k % n) as f32 * (bw + m.u), cu[1] + (k / n) as f32 * (bh + m.u * 0.5), bw, bh]; let sel = k == 0;
                self.pn_cascada(p, t, k, |p| { p.rect(r[0], r[1], r[2], r[3], if sel { AMA } else { PN_PL2 }); p.borde(r[0], r[1], r[2], r[3], 1.0, if sel { AMA } else { PN_LIN });
                    let wc = p.at.ancho(Cara::S7, m.fs, 0.04, cod) + 12.0; p.rect(r[0] + 8.0, r[1] + (r[3] - m.fs * 1.5) / 2.0, wc, m.fs * 1.5, if sel { NEGRO } else { PN_POZO });
                    p.texto(Cara::S7, m.fs, r[0] + 14.0, p.at.base_centrada(Cara::S7, m.fs, m.fs, r[1], r[3]), if sel { AMA } else { PN_T2 }, 0.04, cod);
                    p.texto_max(Cara::S4, m.fs, r[0] + 16.0 + wc, p.at.base_centrada(Cara::S4, m.fs, m.fs * 1.2, r[1], r[3]), if sel { NEGRO } else { TX }, 0.0, nom, r[2] - wc - 24.0); });
                zona(p, z, r, Acc::Idioma(k)); }
        });
    }
}

/// el nombre de un mapa (mapaNom: los de GMod con su nombre de GMod)
pub fn nombre_mapa(m: &str) -> String { match m { "RB_Construct" => "gm_construct".into(), "RB_Flatgrass" => "gm_flatgrass".into(), x => x.trim_start_matches("RB_").to_string() } }
/// la foto de la pantalla de carga de cada mapa (FONDO_MAPA de rbmenus.js)
pub fn fondo_mapa(m: &str) -> Option<&'static str> {
    Some(match m { "FlatGrass" => "rb_flatgrass", "City" => "rb_city", "Desert" | "DesertV2" => "rb_desert", "Mars" => "rb_mars", "RB_Pizzeria" => "rb_pizzeria", "RB_Construct" => "rb_construct", "RB_Flatgrass" => "rb_gmflatgrass",
        "RB_Llanura" => "rb_llanura", "RB_Colinas" => "rb_colinas", "RB_Luna" => "rb_luna", "RB_Ciudad" => "rb_ciudad", "RB_Isla" => "rb_isla", "RB_Desierto" => "rb_desierto", _ => return None })
}
/// el retrato de un personaje (retrato de menu.js: RETRATO, el nombre o en minúsculas, si está en DATA.ico)
pub fn retrato(paq: Option<&Paquete>, s: &str) -> Option<String> {
    let p = paq?; let ret = match s { "Hero" => "hero", "Soldier" => "soldier", "Jean" => "jean", "Derik" => "derik", "Business" => "business", "SpecialForcesW" => "specialforcesw", "SpecialForcesM" => "specialforcesm", "Swat" => "swat", "Corpse" => "corpse", _ => "" };
    [ret.to_string(), s.to_string(), s.to_lowercase()].into_iter().find(|k| !k.is_empty() && p.d["ico"][k.as_str()].is_string())
}

/// anota lo que se toca (sólo lo que queda a la vista: lo recortado de una lista no se toca)
fn zona(p: &Pincel, z: &mut Vec<([f32; 4], Acc)>, r: [f32; 4], a: Acc) { if let Some(r) = p.en_recorte(r) { z.push((r, a)); } }

/// una placa (antes con la punta rota): redondeada, del color pedido, con el brillo del vidrio arriba y sus bordes
fn placa(p: &mut Pincel, x: f32, y: f32, w: f32, h: f32, _punta: usize, ap: f32, c: Col, _grano: Option<(f32, f32, f32)>) {
    let w = w - ap * 0.5; if w <= 0.0 || h <= 0.0 { return; }
    let ra = (h * 0.12).clamp(2.0, 6.0); let cam = aero::camino(x, y, w, h, [ra; 4]);
    p.relleno(&cam, c);
    p.degrade(&cam, true, y, y + h, &[(0.0, blanco(0.20)), (0.5, blanco(0.07)), (0.5, blanco(0.0)), (1.0, blanco(0.05))]);
    p.contorno(x, y, w, h, [ra; 4], 1.0, negro(0.55)); p.contorno(x + 1.0, y + 1.0, w - 2.0, h - 2.0, [(ra - 1.0).max(0.0); 4], 1.0, blanco(0.18));
}
/// (el grano ya no va: el vidrio es liso)
fn sin_grano(_p: &mut Pincel, _x: f32, _y: f32, _w: f32, _h: f32, _gx: f32, _gy: f32, _a: f32) {}
