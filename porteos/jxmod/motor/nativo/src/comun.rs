//! El juego, igual en el teléfono y en la compu (las pruebas): el mapa, la cámara con el tacto, los botones de los motores
//! y el HUD. Lo de Android (la ventana, EGL, los eventos) está en app.rs.
use jxjuego::fisica::Fisica;
use jxjuego::forma::{self, Catalogo};
use jxjuego::jugador::{Entrada, Jugador};
use jxjuego::personaje::{self, Personaje};
use jxjuego::npc::{self, Gente, Npcs, Skins};
use jxjuego::vehiculo::{self as veh, Mando, Vehiculos};
use jxjuego::flotar::{Aguas, Flota};
use jxjuego::efectos::{self as efx, Efectos, Sup};
use jxjuego::vista::{self, Vista};
use jxjuego::mapa::{self, Mapa};
use jxjuego::objetos::{self, Cargados, Prefab};
use std::collections::HashMap;
use jxjuego::paquete::Paquete;
use jxjuego::texto::Letras;
use jxmotor::escena::{Cabecera, Cuadro, Escena, Tex};
use crate::ajustes::{self, Ajustes, Clave};
use crate::armas::{Armas, ARMAS};
#[path = "herramientas.rs"] mod herramientas;
use herramientas::{Herramientas, Logica, Valor};
#[path = "combate.rs"] mod combate;
// (el multijugador: las salas, los demás jugadores y sus cosas)
#[path = "red_juego.rs"] pub mod red_juego;
#[path = "vozcerca.rs"] pub mod vozcerca;
#[path = "gmod_juego.rs"] pub mod gmod_juego;
// (los mapas del Workshop —sus puertas, botones, zonas, sonidos, trenes y puertas portal— y la hora del día)
#[path = "mapas_juego.rs"] pub mod mapas_juego;
#[path = "base_juego.rs"] pub mod base_juego;
#[path = "vr_juego.rs"] pub mod vr_juego;
// (lo de jugabilidad: destrucción, nucleares, artefactos, patada, linterna, cámara libre, mods nativos, Cíclope y Pepe)
#[path = "jugabilidad.rs"] pub mod jugabilidad;
#[path = "luz_global.rs"] pub mod luz_global;
// (lo de personajes: gorros, identidad, el panel de Personaje, el accesorio, el arma a gusto, el celular y los emotes nuevos)
#[path = "personajes.rs"] pub mod personajes;
// (el inicio con el menú clásico, sus paneles y la pausa: inicio.js, clasico.js, paneles.js, rbmenus.js, ui.js)
#[path = "inicio_juego.rs"] pub mod inicio_juego;
#[path = "paneles_juego.rs"] pub mod paneles_juego;
#[path = "pausa_juego.rs"] pub mod pausa_juego;
/// el HUD como el de la web: dónde va cada botón y sus íconos
#[path = "hud_web.rs"] pub mod hud_web;
/// el tutorial (tutorial.js)
#[path = "tutorial_juego.rs"] pub mod tutorial_juego;
/// la grieta del cielo y lo que cae de ella (evento.js)
#[path = "grieta_juego.rs"] pub mod grieta_juego;
/// el menú de objetos como el de la web
#[path = "menu_objetos.rs"] pub mod menu_objetos;
#[path = "aero.rs"] pub mod aero;
#[path = "inicio_aero.rs"] pub mod inicio_aero;
/// la ventana para elegir qué contenido bajar
#[path = "contenido_juego.rs"] pub mod contenido_juego;
// (los gráficos automáticos: gfxauto.js)
#[path = "gfx_juego.rs"] pub mod gfx_juego;
// (la comparación de FPS entre los motores: banco.js)
#[path = "banco_juego.rs"] pub mod banco_juego;
// (la música del menú: musica.js, la estación Casual)
#[path = "musica_juego.rs"] pub mod musica_juego;
// (los botones de las teclas de las armas de los mods: controles.js y acciones.js)
#[path = "teclas_mod.rs"] pub mod teclas_mod;
// (los mapas propios con las texturas de GMod: JX_Plaza)
#[path = "mapas_jx.rs"] pub mod mapas_jx;
// (el pad de memes: memes.js)
#[path = "memes_juego.rs"] pub mod memes_juego;
// (la partida en el Wi-Fi: lan.js)
#[path = "lan_juego.rs"] pub mod lan_juego;
use combate::Proy;
use crate::motor::Motor3d;
use jxmotor::gpu::TEX_LETRAS;
use jxmotor::mat::{self as m4, M4};
use std::time::Instant;

/// los motores: OpenGL 3 y OpenGL 2 (los teléfonos viejos). Vulkan quedó sólo para las pruebas en la compu (en los celulares
/// fallaba): el que lo tenía elegido pasa a OpenGL 3
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Placa { Vulkan, Gl3, Gl2 }
impl Placa {
    pub fn nombre(self) -> &'static str { match self { Placa::Vulkan => "Vulkan", Placa::Gl3 => "OpenGL 3", Placa::Gl2 => "OpenGL 2" } }
    pub fn clave(self) -> &'static str { match self { Placa::Vulkan => "vk", Placa::Gl3 => "gl3", Placa::Gl2 => "gl2" } }
    pub fn de_clave(s: &str) -> Placa { match s.trim() { "gl2" => Placa::Gl2, _ => Placa::Gl3 } }
    pub fn lista() -> [Placa; 2] { [Placa::Gl3, Placa::Gl2] }
    pub fn hecha(self) -> bool { self != Placa::Vulkan }
}

/// un dedo en la pantalla: para qué es (palanca, mirar o un botón que se mantiene) y dónde
struct Dedo { id: i32, palanca: bool, boton: Option<Boton>, x0: f32, y0: f32, x: f32, y: f32 }

/// el panel de Actitud (npcPanel): el NPC que se está cambiando (None: los próximos que se pongan) y cómo quedó
pub struct PanelNpc { pub npc: Option<u32>, pub est: String }
/// lo que se toca en ese panel
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum BtnNpc { Rapida(usize), Arma(Option<npc::Arma>), SkinAnt, SkinSig, Escribir, Borrar, BorrarTodos, Cerrar }
/// para qué se pidió escribir (el cuadro de texto de Android)
#[derive(Clone, Debug)]
pub enum Escribir { /** lo buscado en la radio o la tele */ Med, /** la cuenta y lo social (social_juego.rs): 0 Gmail, 1 código, 2 nombre, 3 ID, 4 mensaje, 5 grupo */ Soc(u8), Chat, Clave(jxjuego::red::Sala), Nombre, Actitud, Pj, SrvNombre, SrvClave, Buscar, /** un cuadro de texto de un menú de un addon (DTextEntry) */ Vgui, /** un cuadro de texto de las opciones de un mod (la opción y el control) */ OpcMod(usize, usize), /** la Workshop: lo buscado y un link o número */ WsBuscar, WsLink }
/// pedir texto (título, lo que ya hay, hasta cuántas letras, si es contraseña; con un número) y levantar lo escrito
/// (número y texto, o None si se canceló): en Android, el cuadro de Juego.java (red_android::Teclado)
pub struct Teclado { pub pedir: Box<dyn Fn(i32, &str, &str, i32, bool)>, pub tomar: Box<dyn Fn() -> Option<(i32, Option<String>)>> }
/// los botones rápidos del panel (NPC_RAPIDAS) con su nombre
pub const RAPIDAS_NPC: [(&str, &str); 9] = [("agresivo", "Agresivo"), ("armado", "Armado"), ("defensor", "Te defiende"), ("amigo", "Amigo (me sigue)"), ("miedoso", "Miedoso"), ("bailarin", "Bailarín"), ("guardia", "Guardia"), ("paseo", "Pasea"), ("quieto", "Quieto")];
/// el nombre de un arma de NPC como en la barra de armas (npcArmaNom)
fn arma_npc_nom(a: npc::Arma) -> &'static str { ARMAS.iter().find(|d| d.n == a.nombre()).map(|d| d.nom).unwrap_or(a.nombre()) }
/// cómo está un NPC (npcActDescribir), con el nombre del arma como en la barra
fn describir_npc(a: &npc::Actitud) -> String { let d = a.describir(); match a.arma { Some(w) => d.replacen(&format!(", {}", w.nombre()), &format!(", {}", arma_npc_nom(w)), 1), None => d } }
/// dónde va el panel y cada botón (x, y, ancho, alto) con la pantalla de w × h
pub fn panel_npc_geo(w: f32, h: f32, nuevo: bool) -> ([f32; 4], Vec<(BtnNpc, [f32; 4])>) {
    let pw = (w * 0.84).min(h * 2.0); let (x0, y0) = ((w - pw) / 2.0, h * (if nuevo { 0.05 } else { 0.1 }));
    let mut v = vec![(BtnNpc::Cerrar, [x0 + pw - h * 0.09, y0 + h * 0.012, h * 0.07, h * 0.06])];
    // (los nuevos: la ayuda y el personaje; después «Ahora: …» —en y_ahora(), arriba de las rápidas—)
    let mx = h * 0.03; let ancho = pw - mx * 2.0; let mut y = y0 + h * (if nuevo { 0.13 } else { 0.1 });
    if nuevo { v.push((BtnNpc::SkinAnt, [x0 + mx, y, h * 0.08, h * 0.07])); v.push((BtnNpc::SkinSig, [x0 + mx + ancho * 0.55, y, h * 0.08, h * 0.07])); y += h * 0.1; }
    y += h * 0.06;
    // (las rápidas: tres filas de tres)
    let (cw, ch) = (ancho / 3.0, h * 0.085);
    for k in 0..RAPIDAS_NPC.len() { v.push((BtnNpc::Rapida(k), [x0 + mx + (k % 3) as f32 * cw + 3.0, y + (k / 3) as f32 * ch + 3.0, cw - 6.0, ch - 6.0])); }
    y += ch * 3.0 + h * 0.06;
    // (el arma: ninguna y las de NPC_ARMAS, en una fila después de «Arma»)
    let n = npc::ARMAS.len() + 1; let x1 = x0 + mx + h * 0.14; let aw = (x0 + pw - mx - x1) / n as f32;
    for k in 0..n { v.push((BtnNpc::Arma(if k == 0 { None } else { Some(npc::ARMAS[k - 1]) }), [x1 + k as f32 * aw + 2.0, y, aw - 4.0, h * 0.075])); }
    y += h * 0.11;
    // (escribir cómo actúa: el lector de lo escrito, npcActDeTexto)
    v.push((BtnNpc::Escribir, [x0 + mx, y, ancho, h * 0.075])); y += h * 0.1;
    v.push((BtnNpc::Borrar, [x0 + mx, y, ancho * 0.48, h * 0.075])); v.push((BtnNpc::BorrarTodos, [x0 + mx + ancho * 0.52, y, ancho * 0.48, h * 0.075]));
    // (y abajo, un renglón para cómo quedó)
    ([x0, y0, pw, y + h * 0.16 - y0], v)
}

/// el panel de emotes: el marco y la caja de cada uno (los que no se ven por el scroll, fuera)
pub fn panel_emotes_geo(w: f32, h: f32, n: usize, scroll: f32) -> ([f32; 4], Vec<[f32; 4]>) {
    let pw = (w * 0.7).min(h * 1.7); let (x0, y0, ph) = ((w - pw) / 2.0, h * 0.06, h * 0.88);
    let cols = 4; let mx = h * 0.03; let cw = (pw - mx * 2.0) / cols as f32; let ch = h * 0.085; let y1 = y0 + h * 0.1; let alto = ph - h * 0.13;
    let v = (0..n).map(|k| [x0 + mx + (k % cols) as f32 * cw + 3.0, y1 + (k / cols) as f32 * ch - scroll + 3.0, cw - 6.0, ch - 6.0])
        .map(|r| if r[1] < y1 - 1.0 || r[1] + r[3] > y1 + alto { [-1e4, -1e4, 0.0, 0.0] } else { r }).collect();
    ([x0, y0, pw, ph], v)
}
/// suma lo que pasó desde la marca anterior a la parte `k` (promedio que se mueve despacio)
fn marca(perf: &mut [f32; 5], t: &mut Instant, k: usize) { let x = t.elapsed().as_secs_f32() * 1000.0; perf[k] = perf[k] * 0.95 + x * 0.05; *t = Instant::now(); }

/// los botones de la pantalla
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Boton { Ajustes, Camara, Recargar, Usar, Bajar, Saltar, Agachar, Volar, Objetos, Deshacer, Disparo, Disparo2, Arma, ArmaN(usize), Girar, Lejos, Cerca, Bocina, Turbo, Salas, Chat, Micro, Emotes, Jg(jugabilidad::Bj), Pj(personajes::Bp) }
/// un botón: qué es, el centro, el tamaño (ancho y alto; los redondos con el mismo) y si es redondo
struct Btn { b: Boton, x: f32, y: f32, w: f32, h: f32, redondo: bool }
/// dónde va cada botón con la pantalla de w × h: como la web (hud_web.rs). Ajustes y Salas no van en el HUD —como en la
/// web, se abren desde la pausa y desde el menú principal—: no están en la lista
fn botones(w: f32, h: f32) -> Vec<Btn> { hud_web::disposicion(w, h, ARMAS.len()).0 }
/// la textura de los íconos del menú (un atlas armado con los de la subcategoría abierta)
pub const TEX_ICONOS: i64 = -2001;
/// la textura de los íconos de las armas (los W_ de GMod, uno por arma de ARMAS)
pub const TEX_ARMAS: i64 = -2002;
const ICO: u32 = 96;
const ICO_COLS: u32 = 10;
/// el menú de objetos abierto: qué subcategoría, cuánto bajó la grilla y de qué subcategoría es el atlas cargado
pub struct Menu { pub sub: usize, pub scroll: f32, atlas_de: Option<(usize, usize)>, atlas_h: u32, /** 0 Props, 1 NPCs, 2 Vehículos, 3 Herramientas */ pub pestana: usize,
    /** lo buscado, cuánto bajó la columna de las categorías, hasta dónde bajan y de qué búsqueda es el atlas */ pub q: String, pub scroll_cats: f32, pub max_scroll: f32, pub max_cats: f32, atlas_q: String,
    /** dónde termina la columna de las categorías (para saber qué baja el dedo) */ pub col_x1: f32,
    /** la lista de herramientas: cuánto bajó, hasta dónde baja y dónde empieza su ventana */ pub scroll_her: f32, pub max_her: f32, pub her_x0: f32,
    /** el panel de la derecha de Herramientas (las opciones de un mod pueden ser largas): cuánto bajó, hasta dónde y dónde empieza */ pub scroll_insp: f32, pub max_insp: f32, pub insp_x0: f32 }
impl Menu { pub fn nuevo() -> Menu { Menu { sub: 0, scroll: 0.0, atlas_de: None, atlas_h: 0, pestana: 0, q: String::new(), scroll_cats: 0.0, max_scroll: 0.0, max_cats: 0.0, atlas_q: String::new(), col_x1: 0.0, scroll_her: 0.0, max_her: 0.0, her_x0: 0.0, scroll_insp: 0.0, max_insp: 0.0, insp_x0: 0.0 } } }
/// las pestañas de arriba del menú (las del spawn menu de la web)
/// las armas de diseño nuevo (armas_aero.rs) en vez de las de siempre: apagadas
const ARMAS_AERO: bool = false;
const PESTANAS_MENU: [&str; 5] = ["Props", "NPCs", "Vehículos", "Herramientas", "Mods"];
/// la pestaña de los addons de GMod: abre su panel (gmod_juego.rs)
const PESTANA_MODS: usize = 4;
/// la pestaña de las herramientas (las otras son catálogos de cosas para poner)
const PESTANA_HER: usize = 3;
/// dónde va cada cosa del menú (con la pantalla de w × h y n subcategorías)
struct Panel { x0: f32, y0: f32, pw: f32, ph: f32, tab_h: f32, gx: f32, gy: f32, gw: f32, gh: f32, celda: f32, cols: usize }
fn panel(w: f32, h: f32, nsub: usize) -> Panel {
    let (x0, y0, pw, ph) = (w * 0.04, h * 0.12, w * 0.92, h * 0.85);
    let tab_h = ((ph - h * 0.1) / nsub.max(1) as f32).min(h * 0.08);
    let (gx, gy) = (x0 + pw * 0.22, y0 + h * 0.09); let (gw, gh) = (pw * 0.77, ph - h * 0.1);
    let celda = h * 0.19; let cols = ((gw / celda).floor() as usize).max(1);
    Panel { x0, y0, pw, ph, tab_h, gx, gy, gw, gh, celda: gw / cols as f32, cols }
}
/// un objeto puesto en el mundo: su cuerpo en la física (si tiene forma de choque) y cómo estaba antes y después del último
/// paso de la física (se dibuja entre los dos: la física va a 60 por segundo, como la web, y la pantalla a 120)
pub struct Obj { pub nombre: String, pub pos: [f32; 3], pub q: [f32; 4], pub c: [f32; 3], pub cuerpo: Option<u32>, cap_inv: [f32; 4], ant: ([f32; 3], [f32; 4]), pub masa: f32,
    /// su número (el ID que muestra la Tool Gun), lo que hace si lo puso la Tool Gun y dónde empezó a moverlo un Mover
    pub id: u32, pub logica: Option<Logica>, log_base: Option<([f32; 3], [f32; 4], f32)>,
    /// de qué tipo es (tipoDe: prop, explota, vehiculo…), su vida (los explosivos: 1) y si ya explotó
    pub tipo: &'static str, pub vida: f32, pub exploto: bool }
/// el paso de la física de los objetos (physStep de la web: 1/60 s)
const PASO_FIS: f32 = 1.0 / 60.0;
/// los sub-pasos de la física según la calidad (GFX.sub de la web)
const SUB_FIS: [usize; 5] = [5, 6, 8, 10, 10];
fn qmul32(a: [f32; 4], b: [f32; 4]) -> [f32; 4] {
    [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]
}
/// entre dos giros (nlerp, por el camino corto)
fn qmezcla(a: [f32; 4], b: [f32; 4], t: f32) -> [f32; 4] {
    let s = if a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0.0 { -1.0 } else { 1.0 };
    let q = [a[0] + (b[0] * s - a[0]) * t, a[1] + (b[1] * s - a[1]) * t, a[2] + (b[2] * s - a[2]) * t, a[3] + (b[3] * s - a[3]) * t];
    let l = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt().max(1e-9); [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
}
fn rect_uv(v: &mut Vec<f32>, x: f32, y: f32, w: f32, h: f32, uv: [f32; 4], col: [f32; 4]) {
    let p = [(x, y, uv[0], uv[1]), (x + w, y, uv[2], uv[1]), (x + w, y + h, uv[2], uv[3]), (x, y, uv[0], uv[1]), (x + w, y + h, uv[2], uv[3]), (x, y + h, uv[0], uv[3])];
    for (a, b, c, d) in p { v.extend_from_slice(&[a, b, c, d, col[0], col[1], col[2], col[3]]); }
}
/// la matriz de un objeto: su lugar y su giro, corrido por su centro (objetoMatriz)
fn matriz_obj(o: &Obj, t: f32) -> M4 {
    // (entre el paso de antes y el de ahora; el modelo: cuerpo × capQ⁻¹ × T(−c))
    let (p, q) = if o.cuerpo.is_some() { let a = o.ant; ([a.0[0] + (o.pos[0] - a.0[0]) * t, a.0[1] + (o.pos[1] - a.0[1]) * t, a.0[2] + (o.pos[2] - a.0[2]) * t], qmezcla(a.1, o.q, t)) } else { (o.pos, o.q) };
    let b = mapa::trs(p, qmul32(q, o.cap_inv), [1.0; 3]); m4::mul(&b, &mapa::trs([-o.c[0], -o.c[1], -o.c[2]], [0.0, 0.0, 0.0, 1.0], [1.0; 3]))
}
/// (para las pruebas) el centro de un botón
pub fn pos_boton(w: f32, h: f32, b: Boton) -> (f32, f32) { botones(w, h).into_iter().find(|x| x.b == b).map(|x| (x.x, x.y)).unwrap_or((0.0, 0.0)) }
/// una pestaña de arriba del menú: dónde empieza y su ancho
fn pestana_menu(p: &Panel, h: f32, k: usize) -> (f32, f32) { let bw = ((p.pw - h * 0.16) / PESTANAS_MENU.len() as f32).min(h * 0.42); (p.x0 + h * 0.03 + k as f32 * (bw + h * 0.02), bw) }
/// las cajas de los valores de un renglón de Ajustes (x, y, ancho, alto)
fn cajas_aj(p: &Panel, h: f32, fila: usize, n: usize) -> Vec<(f32, f32, f32, f32)> {
    let fh = h * 0.105; let y = p.gy + fila as f32 * fh;
    let ox = p.gx + p.gw * 0.34; let ancho = p.gx + p.gw - ox - h * 0.02;
    let cw = (ancho / n.max(1) as f32).min(h * 0.32);
    (0..n).map(|k| (ox + k as f32 * cw + 3.0, y + 4.0, cw - 6.0, fh - 8.0)).collect()
}
/// los mapas de Ajustes: una grilla de 4 columnas (son 17)
fn cajas_mapa(p: &Panel, h: f32, n: usize) -> Vec<(f32, f32, f32, f32)> {
    let (cols, fh) = (4usize, h * 0.085); let cw = (p.gw - h * 0.02) / cols as f32;
    (0..n).map(|k| (p.gx + (k % cols) as f32 * cw + 3.0, p.gy + (k / cols) as f32 * fh + 4.0, cw - 6.0, fh - 8.0)).collect()
}
fn cajas_de(c: Clave, p: &Panel, h: f32, fila: usize, n: usize) -> Vec<(f32, f32, f32, f32)> { if c == Clave::Mapa { cajas_mapa(p, h, n) } else { cajas_aj(p, h, fila, n) } }
fn boton_en(w: f32, h: f32, x: f32, y: f32, ve: impl Fn(Boton) -> bool) -> Option<Boton> {
    botones(w, h).into_iter().filter(|b| ve(b.b)).find(|b| if b.redondo { let (dx, dy) = (x - b.x, y - b.y); dx * dx + dy * dy <= (b.w * 0.55).powi(2) } else { (x - b.x).abs() <= b.w / 2.0 + 4.0 && (y - b.y).abs() <= b.h / 2.0 + 4.0 }).map(|b| b.b)
}
/// un texto escrito sin lo que no se ve y de a lo sumo `n` letras (limpio de red.js)
fn limpio(t: &str, n: usize) -> String { t.trim().chars().filter(|c| !c.is_control()).take(n).collect() }
/// el paso fijo de la física del jugador
const PASO: f32 = 1.0 / 120.0;

pub struct Juego {
    paq: Option<Paquete>, pub mapa: Option<Mapa>, pub mapas: Vec<String>, mapa_i: usize,
    letras: Option<Letras>, letras_px: Option<(u32, u32, Vec<u8>)>,
    /// el jugador (la física, como jugador.js) y lo que sobra de tiempo para el paso fijo
    pub jug: Jugador, acum: f32,
    dedos: Vec<Dedo>,
    pub placa: Placa, aviso: Option<(String, Instant)>, datos: Option<std::path::PathBuf>,
    t_ant: Instant, t0: Instant, pub fps: f32, pub ms: f32, cuenta: u32, t_med: Instant, n_med: u32,
    /// lo que tarda la placa en dibujar un cuadro (medido cada 60 cuadros esperando a que termine: glFinish)
    pub placa_ms: f32,
    /// lo que tarda cada parte del cuadro en la CPU (ms, promediado): el jugador, la física de los objetos, la IA de los
    /// NPC, lo demás del juego (eventos, red, animación y armar lo que se dibuja) y el motor (mandar el cuadro a la placa)
    pub perf: [f32; 5], perf_t: Instant,
    /// la resolución dinámica: la fracción de la resolución elegida con la que se dibuja ahora (1: toda) y lo que se lleva medido
    pub drs: f32, drs_t: f32,
    /// el antilag: cuántos escalones de efectos se apagaron (0 ninguno … 4) y cuánto va estable o trabado (ms) para subir o bajar
    pub antilag: u8, antilag_ok: f32, antilag_mal: f32,
    /// JX Turbo (cuadros intermedios): cuántos van desde el último real, el tiempo que se saltó (lo recupera el real), la cámara
    /// del intermedio que toca, la del último real (posición y mirada, para no correr un cuadro viejo después de un salto) y lo que
    /// tarda cada clase de cuadro (ms, promediado)
    pub turbo_n: u8, turbo_dt: f32, turbo_vp: Option<M4>, turbo_cam: [f32; 6], pub ms_real: f32, pub ms_inter: f32, pub fue_inter: bool, pub n_inter: u32, pub turbo_on: bool,
    /// lo que tarda la placa en un intermedio (con los medidores) y la CPU en armar cada clase de cuadro (ms, promediado)
    pub placa_inter: f32, pub cpu_real: f32, pub cpu_inter: f32, reloj_ok: bool,
    /// JX Turbo: la raíz del arma en el último cuadro de verdad (si estaba a la vista) y cuánto se movió en el intermedio que toca
    pub arma_raiz: Option<M4>, turbo_arma: Option<M4>,
    recargar: bool,
    /// (para las pruebas: el tiempo fijo de cada cuadro, en vez del reloj)
    pub dt_fijo: Option<f32>,
    /// los gráficos automáticos (gfx_juego.rs): la búsqueda, si se mide (sólo en la app) y el refresco de la pantalla (Hz)
    pub gfxa: jxjuego::gfxauto::Busqueda, pub gfx_medir: bool, pub refresco: f32,
    /// la calidad más alta que prueba Automático según la memoria del celular (gfx_juego.rs: 4 GB → Medio)
    pub tope_mem: usize,
    /// los memes (memes_juego.rs)
    pub memes: memes_juego::Memes,
    /// la partida en el Wi-Fi (lan_juego.rs)
    pub lan: lan_juego::EnLan,
    /// los paquetes aparte que se bajan cuando hacen falta (bajas.rs) y cómo va la bajada del mapa que se va a cargar
    pub bajas: Option<crate::bajas::Bajas>, pub bajada: Option<(u64, u64, bool)>,
    /// lo que salió mal (se muestra en la pantalla: en el teléfono no hay otra forma de verlo)
    pub error: Option<String>,
    mapa_cartel: bool,
    /// cuándo se armó el mapa: a los 12 s jugando la entrada a la partida anduvo (caja_negra::partida_lista)
    partida_t: Option<Instant>,
    /// el motor que se está usando (lo pone la app) y si hay que cambiarlo (se eligió otro)
    pub en_uso: Placa, pub cambiar_motor: bool,
    /// lo que tardó cada pasada en la placa (Vulkan)
    pub detalle: String,
    // —— los objetos ——
    nombres: HashMap<String, String>, pub catalogo: Vec<(String, Vec<String>)>, pub cat_npc: Vec<(String, Vec<String>)>, pub cat_veh: Vec<(String, Vec<String>)>,
    pub menu: Option<Menu>, prefabs: HashMap<String, Prefab>, cargados: Cargados,
    pub objs: Vec<Obj>, pendientes: Vec<String>,
    /// lo guardado de este mapa que se está poniendo (Cargar de la pausa: nombre, posición, giro y si quedó congelado)
    pub por_cargar: Vec<(String, [f32; 3], [f32; 4], bool)>,
    /// la física de los objetos (fisica.rs), las formas de choque de los prefabs y el tiempo que sobra para su paso fijo
    pub fis: Fisica, cat_fis: Option<Catalogo>, acum_fis: f32,
    /// las armas (la Physics Gun y la Gravity Gun) y dónde estaban los ojos en el último cuadro (para apuntar)
    pub armas: Armas, ojos_ult: [f32; 3],
    /// el sonido espacial: lo que midió cada uno de los 14 rayos, cuál toca y hace cuánto se revisaron los bucles
    acu_d: [f32; 14], acu_i: usize, acu_t: f32,
    /// el cuerpo del jugador (personaje.rs: se ve en tercera persona y de frente), la cámara (0 primera, 1 tercera, 2 de
    /// frente) y las dos capturas de nado (CMU 126_04 y 79_02: las pone la app)
    pub pj: Option<Personaje>, pj_cargados: personaje::Cargados, pub camara: u8, pub nado: Option<(Vec<u8>, Vec<u8>)>, pub skin: String,
    /// el arma en la mano (vista.rs): el modelo, lo que el motor ya tiene, los clips, cuál suena, el vaivén y lo que se
    /// arrastró para mirar en este cuadro (el arma se atrasa un poco al girar)
    /// los NPC (npc.rs) y sus skins; los vehículos (vehiculo.rs) y el agua que hace flotar (flotar.rs); si se puede usar
    /// algo con «Usar» (un vehículo a la vista); lo último que se puso (para Deshacer: objeto o NPC) y la matriz de la vista
    /// las ondas del agua (x, z, cuándo, fuerza): las deja el jugador al moverse en el agua y lo que cae (EF_ONDAS); y cuándo la próxima
    ondas: Vec<[f32; 4]>, onda_t: f32,
    /// la luz global de Definitivo (luz_global.rs)
    gi: luz_global::LuzGlobal,
    pub npcs: Npcs, npc_skins: Skins, pub vehs: Vehiculos, pub aguas: Aguas, usar_ve: bool, pila: Vec<(bool, u32)>, vp_ult: M4,
    /// los efectos (efectos.rs: partículas, fogonazos, trazas, impactos, explosiones, marcas) y si su atlas está en el motor
    pub ef: Efectos, ef_atlas: bool,
    /// la Tool Gun (herramientas.rs) y el número del próximo objeto
    pub her: Herramientas, sig_id: u32,
    /// los proyectiles en el aire (cohetes, flechas), los barriles por explotar (id, cuándo), el temblor de la cámara, el
    /// rojo del golpe, si murió, y el campo de visión que va hacia el pedido (apuntar y la mira del francotirador)
    pub proys: Vec<Proy>, por_explotar: Vec<(u32, f32)>, temblor: f32, golpe_t: f32, pub muerto: bool, fov_b: f32,
    /// el atlas de los íconos de las armas está en el motor
    armas_ico: bool, armas_ico_h: u32, hud_ico: bool,
    /// las tres armas de diseño nuevo (armas_aero.rs: Physics, Gravity y Tool Gun), su eje de arriba (arma, eje, signo), los
    /// segundos desde el último tiro y cuánto están abiertas las garras
    aero: Option<jxjuego::armas_aero::Aero>, aero_tiro: f32, aero_abre: f32,
    pub vista: Option<Vista>, vista_cargados: vista::Cargados, clips: vista::Clips, clip_ya: &'static str, sway: [f32; 5], bob_arma: f32, mdx: f32, tubo_ok: bool,
    // —— el sonido (como sonidos.js): pasos, golpes, agua, botones ——
    /// los ajustes (ajustes.txt) y la pestaña del menú de Ajustes, si está abierto (el juego queda en pausa)
    pub aj: Ajustes, pub ajustes: Option<usize>,
    /// la comparación de los motores (banco_juego.rs)
    pub banco: banco_juego::EnBanco,
    /// la música del menú (musica_juego.rs)
    pub musica: musica_juego::Musica,
    /// el panel de Actitud de la Tool Gun (npcPanel), la actitud y el personaje de los NPC que se pongan con ella
    pub npc_panel: Option<PanelNpc>, pub npc_act: Option<npc::Actitud>, pub npc_skin: String,
    /// el multijugador (red_juego.rs)
    pub en_red: red_juego::EnRed,
    /// los addons de GMod (gmod_juego.rs)
    pub gmod: gmod_juego::EnGmod,
    /// el contenido de HL2 y CS:S de Steam que piden los mapas del Workshop (base_juego.rs)
    pub gb: base_juego::EnBase,
    /// el modo VR (vr_juego.rs)
    pub vr: vr_juego::EnVr,
    /// Grabar: lo que se pidió (empezar o terminar; lo hace la app, app.rs) y si se está grabando
    pub grabar_pedido: Option<bool>, pub grabando: bool,
    /// los mapas del Workshop y la hora del día (mapas_juego.rs)
    pub mj: mapas_juego::EnMapas,
    /// lo de jugabilidad.rs
    pub jg: jugabilidad::Jugabilidad,
    /// el editor de los botones de la pantalla (hud_web.rs)
    pub ed: hud_web::Editor,
    /// el tutorial abierto
    pub tut: tutorial_juego::Tut,
    /// la grieta
    pub gr: grieta_juego::Grieta,
    /// el contenido para bajar (contenido_juego.rs)
    pub cont: contenido_juego::Contenido,
    /// la casilla «Congelado» del menú de objetos: lo que se pone, queda quieto
    pub poner_congelado: bool,
    /// lo de personajes.rs
    pub pjs: personajes::Pjs,
    /// el inicio, los paneles y la pausa (inicio_juego.rs)
    pub ini: inicio_juego::Inicio,
    /// la cuenta y lo social (social_juego.rs)
    pub soc: paneles_juego::social::Social,
    /// la radio y la tele (medios_juego.rs)
    pub med: paneles_juego::medios::Medios,
    /// la voz por cercanía (vozcerca.rs)
    pub vz: vozcerca::VozCerca,
    /// escribir (sin teclado —en la compu—, no se puede) y lo que se está esperando
    pub teclado: Option<Teclado>, escribir: Option<(i32, Escribir)>, escribir_n: i32,
    /// el emote que hace el jugador (P.emote) y el panel para elegirlo
    pub emote: Option<String>, pub emotes_panel: bool, emo_scroll: f32,
    pub sonido: crate::sonido::Sonido, amb_t: f32, paso_d: f32, aire_t: f32, vy_aire: f32, golpe_max: f32, saltos_vistos: u32, ahogos_vistos: u32, nadaba: bool, brazada_t: f32, azar: u32,
}

/// el giro de la cámara (Quat.euler(yaw, pitch) de la web: la inclinación de la web es para abajo, la nuestra para arriba)
fn qcam(yaw: f32, pitch: f32) -> [f32; 4] {
    let (sy, cy) = ((yaw / 2.0).sin(), (yaw / 2.0).cos()); let (sp, cp) = ((-pitch / 2.0).sin(), (-pitch / 2.0).cos());
    // qy(yaw) × qx(−pitch)
    [cy * sp, sy * cp, -sy * sp, cy * cp]
}
/// la proyección de GL (como M4.persp de nucleo.js)
pub fn persp(fovy: f32, asp: f32, n: f32, f: f32) -> M4 {
    let t = 1.0 / (fovy / 2.0).tan(); let mut m = [0.0; 16];
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1.0; m[14] = 2.0 * f * n / (n - f); m
}

/// el atlas de letras (PNG) a RGBA
pub fn png_rgba(b: Vec<u8>) -> Option<(u32, u32, Vec<u8>)> {
    let dec = png::Decoder::new(std::io::Cursor::new(b)); let mut r = dec.read_info().ok()?;
    let mut px = vec![0; r.output_buffer_size()]; let i = r.next_frame(&mut px).ok()?; px.truncate(i.buffer_size());
    if i.color_type != png::ColorType::Rgba || i.bit_depth != png::BitDepth::Eight { return None; }
    Some((i.width, i.height, px))
}

impl Juego {
    /// `datos`: la carpeta de la app donde se guarda el motor elegido
    pub fn nuevo(paq: Result<Paquete, String>, letras_json: Option<String>, letras_png: Option<Vec<u8>>, datos: Option<std::path::PathBuf>) -> Juego {
        let placa = datos.as_ref().and_then(|d| std::fs::read_to_string(d.join("motor.txt")).ok()).map(|s| Placa::de_clave(&s)).unwrap_or(Placa::Gl3);
        let aj = Ajustes::leer(datos.as_ref().and_then(|d| std::fs::read_to_string(d.join("ajustes.txt")).ok()).as_deref());
        // (el idioma elegido; si no hay, el del celular lo pone app.rs con idioma_del_sistema)
        if let Some(i) = aj.idioma.as_deref().and_then(jxjuego::idiomas::de_codigo) { jxjuego::idiomas::poner(i); }
        let letras = letras_json.and_then(|t| Letras::de_json(&t).ok());
        let letras_px = letras_png.and_then(png_rgba);
        let (paq, error) = match paq { Ok(p) => (Some(p), None), Err(e) => (None, Some(format!("el paquete del juego: {e}"))) };
        let en_red = red_juego::EnRed::nueva(datos.as_deref());
        let gmod = gmod_juego::EnGmod::nueva(datos.as_deref());
        let mut j = Juego { paq, mapa: None, mapas: vec!["RB_Flatgrass".into(), "RB_Construct".into()], mapa_i: 0, letras, letras_px, jug: Jugador::nuevo(), acum: 0.0,
            dedos: vec![], placa, aviso: None, datos, t_ant: Instant::now(), t0: Instant::now(), fps: 0.0, ms: 0.0, cuenta: 0, t_med: Instant::now(), n_med: 0, placa_ms: 0.0, perf: [0.0; 5], drs: 1.0, drs_t: 0.0, turbo_n: 0, turbo_dt: 0.0, turbo_vp: None, turbo_cam: [0.0; 6], ms_real: 0.0, ms_inter: 0.0, fue_inter: false, n_inter: 0, turbo_on: false, placa_inter: 0.0, cpu_real: 0.0, cpu_inter: 0.0, reloj_ok: false, arma_raiz: None, turbo_arma: None, perf_t: Instant::now(),
            recargar: true, partida_t: None, dt_fijo: None, antilag: 0, antilag_ok: 0.0, antilag_mal: 0.0, gfxa: Default::default(), gfx_medir: false, tope_mem: ajustes::CALIDADES.len() - 1, refresco: 60.0, memes: Default::default(), lan: Default::default(), bajas: None, bajada: None, error, mapa_cartel: false, en_uso: Placa::Gl3, cambiar_motor: false, detalle: String::new(),
            nombres: HashMap::new(), catalogo: vec![], cat_npc: vec![], cat_veh: vec![], menu: None, prefabs: HashMap::new(), cargados: Cargados::default(), objs: vec![], pendientes: vec![], por_cargar: vec![],
            fis: Fisica::nueva(), cat_fis: None, acum_fis: 0.0, armas: Armas::default(), ojos_ult: [0.0; 3], acu_d: [crate::acustica::LEJOS; 14], acu_i: 0, acu_t: 0.0,
            pj: None, pj_cargados: personaje::Cargados::default(), camara: 0, nado: None, skin: "Hero".into(),
            npcs: Npcs::nuevo(&serde_json::Value::Null, 1), npc_skins: Skins::nuevo(1, 512), vehs: Vehiculos::nuevo(), ondas: Vec::new(), onda_t: 0.0, gi: Default::default(), aguas: Aguas::de_cajas(&[]), usar_ve: false, pila: vec![], vp_ult: m4::id(), ef: Efectos::nuevo(0x0ef), ef_atlas: false,
            her: Herramientas::default(), soc: Default::default(), med: Default::default(), vz: Default::default(), en_red, gmod, gb: Default::default(), vr: Default::default(), grabar_pedido: None, grabando: false, mj: Default::default(), jg: jugabilidad::Jugabilidad::default(), banco: Default::default(), musica: Default::default(), ed: hud_web::Editor::default(), tut: Default::default(), gr: Default::default(), cont: Default::default(), poner_congelado: false, pjs: personajes::Pjs::default(), ini: inicio_juego::Inicio::default(), teclado: None, escribir: None, escribir_n: 0, emote: None, emotes_panel: false, emo_scroll: 0.0, npc_panel: None, npc_act: None, npc_skin: "Hero".into(), sig_id: 1, proys: vec![], por_explotar: vec![], temblor: 0.0, golpe_t: 0.0, muerto: false, fov_b: 0.0,
            armas_ico: false, armas_ico_h: 256, hud_ico: false, aero: None, aero_tiro: 9.0, aero_abre: 0.0, vista: None, vista_cargados: vista::Cargados::default(), clips: vista::Clips::default(), clip_ya: "", sway: [0.0; 5], bob_arma: 0.0, mdx: 0.0, tubo_ok: false,
            aj, ajustes: None, sonido: crate::sonido::Sonido::mudo(), amb_t: 3.0, paso_d: 0.0, aire_t: 0.0, vy_aire: 0.0, golpe_max: 0.0, saltos_vistos: 0, ahogos_vistos: 0, nadaba: false, brazada_t: 0.0, azar: 0x9e3779b9 };
        // los mapas: todos los de la web (DATA.esc), primero los RB (los de la versión personal); empieza en el último elegido
        if let Some(p) = &j.paq { if let Some(e) = p.d["esc"].as_object() {
            let mut v: Vec<String> = e.keys().cloned().collect(); v.sort_by_key(|n| (!n.starts_with("RB_"), n != "RB_Flatgrass", n.clone()));
            if !v.is_empty() { j.mapas = v; }
            // (los propios con las texturas de GMod: mapas_jx.rs)
            for (k, _) in mapas_jx::MAPAS_JX { if !j.mapas.iter().any(|x| x == k) { j.mapas.push(k.to_string()); } }
            // (el gm_construct de siempre ya no está: el de inicio es el gm_construct Windows 7 del Workshop, que se baja solo)
            j.mapas.retain(|m| m != "RB_Construct" && m != "RB_Pizzeria"); // (la pizzería de FNAF ya no: el que quiera, la juega con lo del Workshop) j.mapas.insert(0, mapas_juego::MAPA_INICIAL.0.to_string());
            let ult = j.datos.as_ref().and_then(|d| std::fs::read_to_string(d.join("mapa.txt")).ok()).unwrap_or_default();
            j.mapa_i = j.mapas.iter().position(|m| *m == ult.trim()).unwrap_or(0);
        } }
        if let Some(p) = &j.paq { j.nombres = objetos::por_nombre(&p.d); j.catalogo = objetos::menu(&p.d, "Props"); j.cat_npc = npc::menu(&p.d); j.cat_veh = objetos::menu(&p.d, "Vehicles"); j.npcs = Npcs::nuevo(&p.d, 0x5eed); j.cat_fis = Some(Catalogo::nuevo(p)); j.her.lista = herramientas::lista(&p.d); }
        j.pjs_iniciar();
        if !placa.hecha() { j.aviso = Some((format!("{} todavía no está: se usa OpenGL 3", placa.nombre()), Instant::now())); }
        j
    }

    fn cargar_letras(&self, m: &mut Motor3d) {
        self.ini_texturas_perdidas();
        if let Some((lw, lh, px)) = &self.letras_px {
            let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![], texs: vec![Tex { id: TEX_LETRAS, n: "letras".into(), w: *lw, h: *lh, a: 1, o: 0 }], lms: vec![], items: vec![], agua: None, cielo: None };
            let _ = unsafe { m.cargar(&Escena { c: cab, datos: px.clone() }) };
        }
    }

    /// elegir el mapa por su nombre (se arma en el cuadro siguiente)
    pub fn poner_mapa(&mut self, nombre: &str) -> bool {
        match self.mapas.iter().position(|m| m == nombre) { Some(i) => { self.mapa_i = i; self.recargar = true; true } None => false }
    }
    /// un aviso de unos segundos en el medio de la pantalla
    pub fn avisar(&mut self, t: String) { self.aviso = Some((t, Instant::now())); }
    /// el motor que pidió el jugador y el que se puede usar (OpenGL 2 todavía no: OpenGL 3)
    pub fn motor_pedido(&self) -> Placa { if self.placa.hecha() { self.placa } else { Placa::Gl3 } }
    /// con ventana nueva (el motor nuevo): se carga todo de nuevo
    pub fn al_abrir(&mut self) { self.recargar = true; self.ef.reenviar_marcas(); self.ini_texturas_perdidas(); }
    /// el idioma del celular (su código, como «es» o «pt»), si no se eligió otro: uno de los 14 o, si no está, inglés (como la web)
    pub fn idioma_del_sistema(&mut self, cod: Option<&str>) {
        if self.aj.idioma.is_some() { return; }
        let Some(c) = cod else { return };
        jxjuego::idiomas::poner(jxjuego::idiomas::de_codigo(c).unwrap_or(1));
    }
    /// elige el idioma (Inicio → Idioma) y lo guarda
    pub fn elegir_idioma(&mut self, k: usize) {
        jxjuego::idiomas::poner(k); self.aj.idioma = Some(jxjuego::idiomas::CODIGOS[k.min(13)].to_string());
        if let Some(d) = &self.datos { let _ = std::fs::write(d.join("ajustes.txt"), self.aj.texto()); }
    }

    // —— el tacto (coordenadas en píxeles de la pantalla) ——
    pub fn dedo_abajo(&mut self, id: i32, x: f32, y: f32, w: f32, h: f32) {
        // (mientras se miden los gráficos está la pantalla de carga: no se toca nada)
        if self.gfxa.midiendo() { return; }
        if self.banco_activo() { self.banco_toque(x, y, w, h); return; }
        if self.ed.activo { self.ed_abajo(id, x, y, w, h); return; }
        if self.tut.on { self.tut_toque(x, y, w, h); return; }
        self.dedos.retain(|d| d.id != id);
        if self.ini_dedo_abajo(id, x, y, w, h) { return; }
        // (un menú de un addon abierto —Derma con MakePopup—: el toque es suyo si cae en uno de sus paneles)
        if self.gmod.vgui_dedo.is_none() && self.mapa.is_some() {
            let k = self.gmod.escala_lua().max(1e-3);
            let tomado = self.gmod.gm.as_mut().map(|g| g.vgui_modal() && g.vgui_toque((x / k) as f64, (y / k) as f64, 1)).unwrap_or(false);
            if tomado {
                self.gmod.vgui_dedo = Some((id, x, y));
                if let Some(t) = self.gmod.gm.as_mut().and_then(|g| g.vgui_foco_texto()) { self.pedir_texto(Escribir::Vgui, "Escribir", &t, 500, false); }
                return;
            }
        }
        if self.menu.is_some() || self.ajustes.is_some() || self.npc_panel.is_some() || self.en_red.panel || self.gmod.panel || self.emotes_panel || self.jg.panel() || self.pjs.panel() { self.dedos.push(Dedo { id, palanca: false, boton: None, x0: x, y0: y, x, y }); return; }
        if self.pj_dedo_abajo(id, x, y, w, h) { self.dedos.push(Dedo { id, palanca: false, boton: None, x0: x, y0: y, x, y }); return; }
        let ve = |b: Boton| self.boton_visible(b);
        if let Some(b) = boton_en(w, h, x, y, ve) {
            if !matches!(b, Boton::Saltar | Boton::Agachar | Boton::Disparo | Boton::Disparo2 | Boton::ArmaN(_) | Boton::Bocina | Boton::Turbo) { self.sonido.tocar("Click", 0.5, 1.0, None); }
            match b {
                Boton::Ajustes => { self.menu = None; self.ajustes = Some(0); }
                Boton::Salas => self.abrir_salas(),
                Boton::Chat => self.pedir_texto(Escribir::Chat, "Decir en la sala", "", 120, false),
                Boton::Micro => self.vz_boton(),
                Boton::Emotes => self.emo_apretar(id, x, y),
                // (manejando, la cámara del vehículo: adentro o afuera; en primera mira adelante, como la web)
                Boton::Camara if self.vehs.jugador.is_some() => { self.vehs.primera = !self.vehs.primera; if self.vehs.primera { self.jug.yaw = 0.0; self.jug.pitch = 0.0; } }
                Boton::Camara => { self.camara = (self.camara + 1) % 3; self.avisar(["Primera persona", "Tercera persona", "De frente"][self.camara as usize].into()); }
                Boton::Volar => { self.jug.noclip = !self.jug.noclip; self.avisar(if self.jug.noclip { "Volar: prendido".into() } else { "Volar: apagado".into() }); }
                Boton::Objetos => { if !self.catalogo.is_empty() { self.menu = Some(Menu::nuevo()); } }
                Boton::Disparo | Boton::Disparo2 | Boton::Recargar if self.gmod_arma_activa() || self.pill_on() => {}
                Boton::Disparo | Boton::Disparo2 => {
                    self.armas_con_npc(b == Boton::Disparo);
                    // (lanzar con la Gravity Gun: el gesto de tiro en el cuerpo; la Physics Gun no tiene)
                    if b == Boton::Disparo && self.armas.def().tipo == "grav" { if let Some(pj) = self.pj.as_mut() { pj.accion(personaje::Gesto::Tiro); } }
                    let (o, d, yaw) = (self.ojos_ult, self.mira(), self.jug.yaw);
                    if let Some(mp) = &self.mapa { if b == Boton::Disparo { self.armas.disparo(&mut self.fis, &mp.mundo, o, d, yaw); } else { self.armas.disparo2(&mut self.fis, &mp.mundo, o, d); } }
                }
                Boton::Arma => { self.armas.barra_t = if self.armas.barra_t > 0.0 { 0.0 } else { 2.5 }; }
                Boton::ArmaN(k) => { self.gmod_guardar_arma(); self.armas.elegir(&mut self.fis, k); }
                Boton::Girar => { self.armas.rotar = !self.armas.rotar && self.armas.agarre.is_some(); }
                Boton::Lejos => self.armas.distancia(1.5),
                Boton::Recargar => self.recargar(),
                Boton::Usar | Boton::Bajar => self.usar(),
                Boton::Cerca => self.armas.distancia(-1.5),
                Boton::Deshacer => { self.deshacer(); }
                Boton::Jg(b) => self.jg_boton(b),
                Boton::Pj(b) => self.pj_boton(b),
                _ => {}
            }
            // (saltar y agacharse se mantienen mientras el dedo esté apoyado)
            self.dedos.push(Dedo { id, palanca: false, boton: Some(b), x0: x, y0: y, x, y });
            return;
        }
        let palanca = x < w * 0.4 && !self.dedos.iter().any(|d| d.palanca);
        self.dedos.push(Dedo { id, palanca, boton: None, x0: x, y0: y, x, y });
    }
    pub fn dedo_mueve(&mut self, id: i32, x: f32, y: f32, h: f32) {
        if self.ed.activo { self.ed_mueve(id, x, y); return; }
        if let Some((d, _, _)) = self.gmod.vgui_dedo { if d == id { let k = self.gmod.escala_lua().max(1e-3); self.gmod.vgui_dedo = Some((id, x, y)); if let Some(g) = self.gmod.gm.as_mut() { g.vgui_toque((x / k) as f64, (y / k) as f64, 2); } return; } }
        if self.ini_dedo_mueve(id, x, y, h) { return; }
        if self.ajustes.is_some() || self.npc_panel.is_some() { if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) { d.x = x; d.y = y; } return; }
        // (en el panel de salas, arrastrar baja la lista)
        if self.pj_mueve(id, x, y, h) { return; }
        if self.jg.panel() { if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) { let dy = y - d.y; d.x = x; d.y = y; self.jg.mover(dy); } return; }
        if self.emotes_panel { if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) { self.emo_scroll = (self.emo_scroll - (y - d.y)).max(0.0); d.x = x; d.y = y; } return; }
        if self.gmod.panel { if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) { let dy = y - d.y; d.x = x; d.y = y; self.gmod_mueve(dy); } return; }
        if self.en_red.panel { if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) { self.en_red.scroll = (self.en_red.scroll - (y - d.y)).max(0.0); d.x = x; d.y = y; } return; }
        if let Some(m) = self.menu.as_mut() {
            // (en el menú, arrastrar baja la grilla)
            // (con el menú de la web: arrastrar en la columna baja las categorías; en la grilla, la grilla; hasta donde llegan)
            let nuevo = self.ini.rec.atlas.is_some();
            if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) { let dy = y - d.y; d.x = x; d.y = y;
                if nuevo && m.insp_x0 > 0.0 && d.x0 >= m.insp_x0 { m.scroll_insp = (m.scroll_insp - dy).clamp(0.0, m.max_insp); }
                else if nuevo && m.her_x0 > 0.0 && d.x0 >= m.her_x0 { m.scroll_her = (m.scroll_her - dy).clamp(0.0, m.max_her); }
                else if nuevo && d.x0 < m.col_x1 { m.scroll_cats = (m.scroll_cats - dy).clamp(0.0, m.max_cats); }
                else if nuevo { m.scroll = (m.scroll - dy).clamp(0.0, m.max_scroll); } else { m.scroll = (m.scroll - dy).max(0.0); } }
            return;
        }
        if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) {
            if !d.palanca && d.boton.is_none() && self.armas.rotar && self.armas.agarre.is_some() { self.armas.rotar_por(x - d.x, y - d.y, h); }
            else if !d.palanca && d.boton.is_none() { self.mdx += (x - d.x) * 1080.0 / h.max(1.0) / 2.5; let s = 0.0045 * 1080.0 / h.max(1.0) * self.aj.sens as f32 / 12.0; self.jug.yaw -= (x - d.x) * s; self.jug.pitch = (self.jug.pitch - (y - d.y) * s).clamp(-1.5, 1.5); }
            d.x = x; d.y = y;
        }
    }
    /// al soltar: en el menú, un toque (sin arrastrar) elige
    pub fn dedo_arriba_en(&mut self, id: i32, w: f32, h: f32) {
        if self.ed.activo { self.ed_arriba(id); return; }
        if let Some((d, x, y)) = self.gmod.vgui_dedo { if d == id { self.gmod.vgui_dedo = None; let k = self.gmod.escala_lua().max(1e-3); if let Some(g) = self.gmod.gm.as_mut() { g.vgui_toque((x / k) as f64, (y / k) as f64, 3); } self.dedo_arriba(id); return; } }
        self.pj_dedo_arriba(id);
        if self.ini_dedo_arriba(id, w, h) { self.dedo_arriba(id); return; }
        if self.menu.is_some() || self.ajustes.is_some() || self.npc_panel.is_some() || self.en_red.panel || self.gmod.panel || self.emotes_panel || self.jg.panel() || self.pjs.panel() {
            // (sólo los toques que empezaron con el menú abierto: no el que lo abrió, ni la palanca que se venía usando)
            if let Some(d) = self.dedos.iter().find(|d| d.id == id && d.boton.is_none() && !d.palanca) { if (d.x - d.x0).abs() + (d.y - d.y0).abs() < h * 0.03 { let (x, y) = (d.x, d.y); if self.pjs.panel() { self.pj_toque(x, y, w, h); } else if self.jg.panel() { self.jg_toque(x, y, w, h); } else if self.emotes_panel { self.toque_emotes(x, y, w, h); } else if self.gmod.panel { self.gmod_toque(x, y, w, h); } else if self.ajustes.is_some() { self.toque_ajustes(x, y, w, h); } else if self.npc_panel.is_some() { self.toque_npc(x, y, w, h); } else if self.en_red.panel { self.toque_salas(x, y, w, h); } else { self.toque_menu(x, y, w, h); } } }
        }
        self.dedo_arriba(id);
    }
    pub fn dedo_arriba(&mut self, id: i32) { if self.ed.activo { self.ed_arriba(id); } self.dedos.retain(|d| d.id != id); }
    /// un toque en el panel de Actitud (el clic de npcPanel)
    fn toque_npc(&mut self, x: f32, y: f32, w: f32, h: f32) {
        let Some(pn) = self.npc_panel.as_ref() else { return }; let quien = pn.npc;
        let (c, bs) = panel_npc_geo(w, h, quien.is_none());
        if x < c[0] || x > c[0] + c[2] || y < c[1] || y > c[1] + c[3] { self.npc_panel = None; return; }
        let Some(b) = bs.iter().find(|(_, r)| x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]).map(|x| x.0) else { return };
        let base = serde_json::json!({ "de": "yo" });
        let act_de = |j: &Juego| -> npc::Actitud { quien.and_then(|id| j.npcs.get(id)).map(|p| p.act.clone()).or_else(|| j.npc_act.clone()).unwrap_or_else(|| npc::Actitud::normal(&serde_json::json!({}), Some(&base))) };
        match b {
            BtnNpc::Cerrar => { self.npc_panel = None; return; }
            BtnNpc::Rapida(k) => { if let Some(a) = npc::Actitud::rapida(RAPIDAS_NPC[k].0, Some(&base)) { self.npc_aplicar(a, RAPIDAS_NPC[k].1); } }
            BtnNpc::Arma(w) => { let mut a = act_de(self); a.arma = w; self.npc_aplicar(a, "Arma"); }
            BtnNpc::SkinAnt | BtnNpc::SkinSig => {
                let skins = self.skins_npc(); if skins.is_empty() { return; }
                let i = skins.iter().position(|s| *s == self.npc_skin).unwrap_or(0) as i64 + if b == BtnNpc::SkinSig { 1 } else { -1 };
                self.npc_skin = skins[i.rem_euclid(skins.len() as i64) as usize].clone();
            }
            BtnNpc::Escribir => { self.pedir_texto(Escribir::Actitud, "Cómo actúa el NPC", "", 300, false); return; }
            BtnNpc::Borrar => { if let Some(id) = quien { self.npcs.quitar(id, &mut self.fis); self.avisar("Borrado: NPC".into()); } self.npc_panel = None; return; }
            BtnNpc::BorrarTodos => { self.npcs.todos(&mut self.fis); self.pila.retain(|x| !x.0); self.avisar("Se borraron tus NPC".into()); self.npc_panel = None; return; }
        }
        self.sonido.tocar("Click", 0.5, 1.3, None);
    }
    /// los emotes que se pueden elegir (DATA.emotes que tienen su clip)
    pub fn lista_emotes(&self) -> Vec<String> {
        let Some(p) = &self.paq else { return vec![] };
        p.d["emotes"].as_array().map(|a| a.iter().filter_map(|e| e.as_str()).filter(|e| p.d["hu"]["est"][*e].is_array()).map(|e| e.to_string()).collect()).unwrap_or_default()
    }
    /// emote(e): el jugador lo hace (en tercera persona, para verse; se corta al moverse) y lo ven los demás
    pub fn hacer_emote(&mut self, e: Option<String>) {
        if self.emo_hacer(&e) { return; }
        if let (Some(pj), Some(paq)) = (self.pj.as_mut(), self.paq.as_ref()) { let c = e.as_deref().and_then(|x| personaje::ClipEmote::de(&paq.d, x)); pj.emote(c.as_ref()); }
        if e.is_some() && self.camara == 0 { self.camara = 1; }
        self.emote = e;
    }
    /// un toque en el panel de emotes (una grilla de 4 columnas que se baja arrastrando)
    fn toque_emotes(&mut self, x: f32, y: f32, w: f32, h: f32) {
        let l = self.lista_emotes(); let (c, cel) = panel_emotes_geo(w, h, l.len(), self.emo_scroll);
        if x < c[0] || x > c[0] + c[2] || y < c[1] || y > c[1] + c[3] || (x > c[0] + c[2] - h * 0.1 && y < c[1] + h * 0.08) { self.emotes_panel = false; return; }
        if let Some(k) = cel.iter().position(|r| x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) { let e = l[k].clone(); self.sonido.tocar("Click", 0.5, 1.0, None); self.hacer_emote(Some(e)); self.emotes_panel = false; }
    }
    /// pedir que se escriba algo (el cuadro de texto del celular); llega en `escrito_paso`
    pub(super) fn pedir_texto(&mut self, que: Escribir, titulo: &str, inicial: &str, max: i32, clave: bool) {
        let Some(t) = &self.teclado else { self.avisar("Para escribir hace falta el teclado del celular".into()); return };
        self.escribir_n += 1; (t.pedir)(self.escribir_n, titulo, inicial, max, clave); self.escribir = Some((self.escribir_n, que));
    }
    /// cada cuadro, mientras se espera: lo escrito, a donde iba
    fn escrito_paso(&mut self) {
        let Some((n, _)) = &self.escribir else { return }; let n = *n;
        let Some((id, txt)) = self.teclado.as_ref().and_then(|t| (t.tomar)()) else { return };
        if id != n { return; }
        let Some((_, que)) = self.escribir.take() else { return };
        // (la clave del server nuevo se puede borrar dejándola vacía)
        if let (Escribir::SrvClave, Some(t)) = (&que, &txt) { self.ini.pn.srv.pw = limpio(t, 16); return; }
        // (lo buscado en el menú de objetos: vacío, se borra la búsqueda)
        if let (Escribir::Buscar, Some(t)) = (&que, &txt) { if let Some(m) = self.menu.as_mut() { m.q = limpio(t, 30); m.scroll = 0.0; } return; }
        // (un cuadro de texto de un menú de un addon: lo escrito, aunque esté vacío, y su OnEnter)
        if let (Escribir::Vgui, Some(t)) = (&que, &txt) { if let Some(g) = self.gmod.gm.as_mut() { g.vgui_texto(t, true); } return; }
        if let (Escribir::OpcMod(i, k), Some(t)) = (&que, &txt) { let (i, k) = (*i, *k); if let Some(g) = self.gmod.gm.as_mut() { g.opcion_tocar_t(i, k, t); self.her.opc_ctl = g.opcion_leer(i); } self.opc_guardar(); return; }
        // (la Workshop: lo buscado —vacío: todo— y un link o número de un addon)
        if let (Escribir::WsBuscar, Some(t)) = (&que, &txt) { self.gmod.ws.q = limpio(t, 80); self.ws_buscar(true); return; }
        if let (Escribir::WsLink, Some(t)) = (&que, &txt) { match gmod_juego::ws_id_de(t) { Some(id) => { self.gmod.ws.q = id; self.gmod.ws.cat = 0; self.ws_buscar(true); } None => if !t.trim().is_empty() { self.avisar("Eso no es un link ni un número de la Workshop".into()); } } return; }
        let Some(t) = txt.map(|t| t.trim().to_string()).filter(|t| !t.is_empty()) else { return };
        match que {
            Escribir::WsBuscar | Escribir::WsLink => {}
            Escribir::Soc(k) => self.soc_escrito(k, t),
            Escribir::Med => self.med_escrito(t),
            Escribir::Vgui | Escribir::OpcMod(..) => {}
            Escribir::Chat => { if self.en_red.en_sala() { self.en_red.red.chat(&t, None); let n = self.en_red.red.nombre.clone(); self.en_red.al_chat(format!("{n}: {t}")); } }
            Escribir::Clave(s) => self.entrar_sala_con(&s, Some(&t)),
            Escribir::Nombre => { let n: String = t.chars().filter(|c| !c.is_control()).take(20).collect(); self.en_red.poner_nombre(&n); self.avisar(format!("Ahora te ven como «{n}»")); }
            Escribir::Pj => self.pj_escrito(&t),
            Escribir::SrvNombre => self.ini.pn.srv.n = limpio(&t, 24),
            Escribir::SrvClave | Escribir::Buscar => {}
            Escribir::Actitud => { let a = npc::Actitud::de_texto(&t, Some(&serde_json::json!({ "de": "yo" }))); self.npc_aplicar(a, "Escrito"); }
        }
    }
    /// los personajes que se pueden poner (los del menú de NPC)
    fn skins_npc(&self) -> Vec<String> { self.cat_npc.iter().flat_map(|c| c.1.iter()).filter_map(|n| npc::skin_de_item(n).map(|s| s.to_string())).collect::<std::collections::BTreeSet<_>>().into_iter().collect() }
    /// npcAplicar: la actitud al NPC del panel, o a los próximos que se pongan
    fn npc_aplicar(&mut self, act: npc::Actitud, nombre: &str) {
        let desc = describir_npc(&act);
        match self.npc_panel.as_ref().and_then(|p| p.npc) { Some(id) => self.npcs.aplicar(id, act), None => self.npc_act = Some(act) }
        if let Some(p) = self.npc_panel.as_mut() { p.est = format!("{nombre}: {desc}"); }
    }
    fn toque_menu(&mut self, x: f32, y: f32, w: f32, h: f32) {
        if self.ini.rec.atlas.is_some() { self.mo_toque(x, y, w, h); return; }
        let Some(pe0) = self.menu.as_ref().map(|m| m.pestana) else { return };
        let n = if pe0 == PESTANA_HER { self.her.lista.len() } else { self.cat(pe0).len() };
        let Some(m) = self.menu.as_mut() else { return };
        let p = panel(w, h, n);
        // (la X de cerrar, arriba a la derecha del panel; o tocar afuera)
        if (x > p.x0 + p.pw - h * 0.1 && y < p.y0 + h * 0.08) || x < p.x0 || x > p.x0 + p.pw || y < p.y0 || y > p.y0 + p.ph { self.menu = None; return; }
        // (las pestañas de arriba)
        if y < p.y0 + h * 0.08 {
            let mut mods = false;
            for k in 0..PESTANAS_MENU.len() { let (bx, bw) = pestana_menu(&p, h, k); if x >= bx && x <= bx + bw { if k == PESTANA_MODS { mods = true; } else if k != m.pestana { m.pestana = k; m.sub = if k == PESTANA_HER { self.her.sel } else { 0 }; m.scroll = 0.0; } } }
            if mods { self.menu = None; self.gmod_abrir(); }
            return;
        }
        if x < p.gx - p.pw * 0.01 {
            let k = ((y - p.y0 - h * 0.08) / p.tab_h).floor() as i64;
            if k >= 0 && (k as usize) < n { m.sub = k as usize; m.scroll = 0.0; if m.pestana == PESTANA_HER { self.equipar_herramienta(k as usize); } }
            return;
        }
        if m.pestana == PESTANA_HER { self.toque_inspector(x, y, w, h); return; }
        let (col, fila) = (((x - p.gx) / p.celda).floor() as i64, ((y - p.gy + m.scroll) / p.celda).floor() as i64);
        if col < 0 || col as usize >= p.cols || fila < 0 { return; }
        let i = fila as usize * p.cols + col as usize;
        let (pe, sub) = (m.pestana, m.sub);
        if let Some(n) = self.cat(pe).get(sub).and_then(|s| s.1.get(i)) { self.pendientes.push(n.clone()); }
    }
    /// el arma en la mano (elegirArma, armasPaso y vistaSujeta): carga el modelo del arma elegida, toca sacar y después
    /// quieto (o sosteniendo, con algo agarrado), y el vaivén al caminar y al girar
    unsafe fn arma_en_mano(&mut self, m: &mut Motor3d, dt: f32) {
        if !self.tubo_ok { self.tubo_ok = m.cargar(&vista::tubo()).is_ok(); }
        if ARMAS_AERO && self.aero.is_none() { let (a, e) = jxjuego::armas_aero::Aero::armar(); if m.cargar(&e).is_ok() { self.aero = Some(a); } }
        if !self.ef_atlas { self.ef_atlas = m.cargar(&efx::atlas()).is_ok(); }
        // (los íconos de las armas, para la barra: un atlas de 10 por fila)
        if !self.armas_ico { if let Some(paq) = self.paq.as_ref() {
            let (aw, ah) = (1024u32, (ARMAS.len() as u32).div_ceil(ICO_COLS).max(1) * ICO); let ah = ah.next_power_of_two(); let mut px = vec![0u8; (aw * ah * 4) as usize];
            for (k, a) in ARMAS.iter().enumerate() {
                let Some(mut ic) = objetos::icono(paq, a.ic, ICO) else { continue };
                if let Some(t) = vista::paleta(a.jx) { vista::icono_pintado(&mut ic, ICO as usize, ICO as usize, t); }
                let (cx, cy) = ((k as u32 % ICO_COLS) * ICO, (k as u32 / ICO_COLS) * ICO);
                for y in 0..ICO { let d = (((cy + y) * aw + cx) * 4) as usize; let s = ((y * ICO) * 4) as usize; px[d..d + (ICO * 4) as usize].copy_from_slice(&ic[s..s + (ICO * 4) as usize]); }
            }
            let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![], texs: vec![Tex { id: TEX_ARMAS, n: "armas".into(), w: aw, h: ah, a: 1, o: 0 }], lms: vec![], items: vec![], agua: None, cielo: None };
            self.armas_ico = m.cargar(&Escena { c: cab, datos: px }).is_ok(); self.armas_ico_h = ah;
        } }
        if !self.hud_ico { let (aw, ah, px) = hud_web::atlas();
            let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![], texs: vec![Tex { id: hud_web::TEX_HUD, n: "hud".into(), w: *aw, h: *ah, a: 1, o: 0 }], lms: vec![], items: vec![], agua: None, cielo: None };
            self.hud_ico = m.cargar(&Escena { c: cab, datos: px.clone() }).is_ok(); }
        if self.armas.def().tipo == "celu" { self.vista = None; return; }
        let d = self.armas.def();
        if self.vista.as_ref().map(|v| v.nodo != d.nodo).unwrap_or(true) {
            self.vista = None;
            if let Some(paq) = self.paq.as_mut() {
                match Vista::cargar(paq, d.nodo, d.jx, 512, &mut self.vista_cargados) {
                    Ok((v, esc)) => { if m.cargar(&esc).is_ok() { self.vista = Some(v); self.clip_ya = ""; if self.armas.anim.is_none() { self.armas.anim = Some(d.sacar); } } }
                    Err(e) => { self.avisar(format!("arma: {e}")); return; }
                }
            }
        }
        let Some(paq) = self.paq.as_ref() else { return };
        let Some(v) = self.vista.as_mut() else { return };
        if let Some(a) = self.armas.anim.take() { let c = self.clips.de(&paq.d, a); if v.tocar(c, false) > 0.0 { self.clip_ya = a; } if a == d.fuego { self.aero_tiro = 0.0; } }
        // (las de diseño nuevo: la vieja escondida —quedan las manos—; el tiro y las garras que se abren al agarrar, suave)
        // (por ahora las de siempre: el dueño prefirió quedarse con ellas; las de diseño nuevo quedan armadas para más adelante)
        v.ocultar_arma = ARMAS_AERO && self.aero.is_some() && !d.jx.is_empty() && jxjuego::armas_aero::Tipo::de(d.n).is_some();
        self.aero_tiro += dt; let quiere = if self.armas.agarre.is_some() || self.armas.grav.is_some() { 1.0 } else { 0.0 }; self.aero_abre += (quiere - self.aero_abre) * (dt * 7.0).min(1.0);
        // (terminó el de sacar o el de fuego: quieto, o sosteniendo si tiene algo)
        let quiero = if self.armas.agarre.is_some() || self.armas.grav.is_some() { d.sujeta } else { d.quieto };
        let fijo = self.clip_ya == d.sacar || self.clip_ya == d.fuego;
        if (!fijo || v.termino()) && self.clip_ya != quiero { let c = self.clips.de(&paq.d, quiero); v.tocar(c, true); self.clip_ya = quiero; }
        let fps = { let x = paq.d["an"]["fps"].as_f64().unwrap_or(30.0) as f32; if x > 0.0 { x } else { 30.0 } };
        v.aplicar(dt, fps);
        // el vaivén (ARM.sway): de costado y arriba al caminar, y atrasado al girar
        let sp = (self.jug.vel[0] * self.jug.vel[0] + self.jug.vel[2] * self.jug.vel[2]).sqrt() * if self.jug.suelo { 1.0 } else { 0.2 };
        self.bob_arma += dt * sp * 1.6; let k = 1.0 - (-dt * 10.0).exp(); let s = &mut self.sway; let a = (sp / 6.0).min(1.0);
        s[0] += (self.bob_arma.sin() * 0.012 * a + (-self.mdx * 0.0004).clamp(-0.02, 0.02) - s[0]) * k;
        s[1] += (self.bob_arma.cos().abs() * 0.01 * a - s[0] * 0.1 - s[1]) * k;
        self.mdx = 0.0;
    }
    /// los valores para tocar de un parámetro de la herramienta elegida (inspectorHerramienta)
    fn valores_param(&self, pr: &herramientas::Param, v: Option<&Valor>) -> Vec<String> {
        match pr.t.as_str() {
            "String[]" => pr.o.clone(), "Boolean" => vec!["No".into(), "Sí".into()],
            "Single" | "Int32" => vec!["-".into(), v.map(|x| x.txt()).unwrap_or_default(), "+".into()],
            _ => vec![v.map(|x| x.txt()).unwrap_or_default()],
        }
    }
    fn dibujar_inspector(&self, l: &Letras, u: &mut Vec<f32>, p: &Panel, _wf: f32, hf: f32, t: f32) {
        let bl = [1.0, 1.0, 1.0, 1.0];
        for (k, hh) in self.her.lista.iter().enumerate() {
            let y = p.y0 + hf * 0.08 + k as f32 * p.tab_h; let sel = k == self.her.sel;
            l.caja(u, p.x0 + hf * 0.015, y, p.gx - p.x0 - hf * 0.04, p.tab_h - hf * 0.006, hf * 0.01, if sel { [0.95, 0.66, 0.1, 0.92] } else { [1.0, 1.0, 1.0, 0.08] });
            let tt = (p.tab_h * 0.6).min(t * 0.7); l.texto(u, p.x0 + hf * 0.035, y + (p.tab_h - tt) / 2.0 - hf * 0.003, tt, if sel { [0.0, 0.0, 0.0, 1.0] } else { bl }, &hh.n);
        }
        let Some(hh) = self.her.lista.get(self.her.sel) else { return };
        l.texto(u, p.gx, p.gy - hf * 0.005, t * 0.85, bl, &format!("Tool Gun: {}", hh.n));
        l.texto(u, p.gx, p.gy + hf * 0.045, t * 0.6, [1.0, 1.0, 1.0, 0.7], herramientas::ayuda(&hh.n));
        let vals = self.her.params.get(&hh.n);
        for (f, pr) in hh.p.iter().enumerate() {
            let v = vals.and_then(|m| m.get(&pr.n)); let ops = self.valores_param(pr, v); let cajas = cajas_aj(p, hf, f + 1, ops.len());
            let fh = hf * 0.105; let y = p.gy + (f + 1) as f32 * fh; let tt = t * 0.7;
            l.texto(u, p.gx, y + (fh - tt) / 2.0 - hf * 0.004, tt, bl, &pr.n);
            for (k, (o, b)) in ops.iter().zip(cajas).enumerate() {
                let sel = match (pr.t.as_str(), v) { ("String[]", Some(x)) => x.txt() == *o, ("Boolean", Some(x)) => x.si() == (k == 1), ("Single" | "Int32", _) => k == 1, _ => false };
                l.caja(u, b.0, b.1, b.2, b.3, hf * 0.012, if sel { [0.95, 0.66, 0.1, 0.92] } else { [1.0, 1.0, 1.0, 0.1] });
                let mut ts = tt * 0.9; while l.ancho(ts, o) > b.2 - 6.0 && ts > tt * 0.4 { ts *= 0.9; }
                let an = l.ancho(ts, o); l.texto(u, b.0 + (b.2 - an) / 2.0, b.1 + (b.3 - ts) / 2.0 - hf * 0.004, ts, if sel { [0.0, 0.0, 0.0, 1.0] } else { bl }, o);
            }
        }
    }
    fn toque_inspector(&mut self, x: f32, y: f32, w: f32, h: f32) {
        let Some(hh) = self.her.lista.get(self.her.sel) else { return };
        let p = panel(w, h, self.her.lista.len()); let n = hh.n.clone();
        let mut cambio: Option<(String, Valor)> = None;
        for (f, pr) in hh.p.iter().enumerate() {
            let v = self.her.params.get(&n).and_then(|m| m.get(&pr.n)).cloned(); let ops = self.valores_param(pr, v.as_ref());
            for (k, b) in cajas_aj(&p, h, f + 1, ops.len()).into_iter().enumerate() {
                if x < b.0 || x > b.0 + b.2 || y < b.1 || y > b.1 + b.3 { continue; }
                let nv = match pr.t.as_str() {
                    "String[]" => Valor::Txt(ops[k].clone()), "Boolean" => Valor::Si(k == 1),
                    "Single" | "Int32" => { let x0 = v.as_ref().map(|x| x.num()).unwrap_or(0.0); let paso = if pr.t == "Int32" { 1.0 } else if x0.abs() >= 10.0 { 5.0 } else { 0.5 }; Valor::Num(match k { 0 => if pr.t == "Int32" { (x0 - paso).max(0.0) } else { x0 - paso }, 2 => x0 + paso, _ => x0 }) }
                    _ => {
                        // (el nombre del objeto que tira el Spawner: va pasando por los del menú)
                        if pr.n == "Prop name" { let todos: Vec<String> = std::iter::once("Crate".to_string()).chain(self.catalogo.iter().flat_map(|c| c.1.iter().cloned())).collect(); let i = todos.iter().position(|t| Some(t.as_str()) == v.as_ref().map(|x| x.txt()).as_deref()).map(|i| (i + 1) % todos.len()).unwrap_or(0); Valor::Txt(todos[i].clone()) }
                        else { continue }
                    }
                };
                cambio = Some((pr.n.clone(), nv));
            }
        }
        if let Some((k, v)) = cambio { self.her.params.entry(n).or_default().insert(k, v); self.sonido.tocar("Click", 0.4, 1.0, None); }
    }
    /// Usar (la E): subir al vehículo que se mira o bajar del que se maneja
    fn usar(&mut self) {
        // (una entidad de un addon: la usa el Lua con la tecla E —gmod_cuadro—)
        if self.gmod.usable { return; }
        if self.mapas_usar() { return; }
        if self.jg_usar() { return; }
        let Some(mp) = self.mapa.as_ref() else { return };
        let (o, f) = (self.ojos_ult, self.mira());
        match self.vehs.usar(&mut self.fis, &mp.mundo, [o[0] as f64, o[1] as f64, o[2] as f64], [f[0] as f64, f[1] as f64, f[2] as f64]) {
            veh::Usar::Subio(_) => { self.armas.soltar(&mut self.fis, false); self.armas.olvidar(); self.jug.pitch = -0.15; self.jug.noclip = false; }
            veh::Usar::Salio(sl) => { self.jug.pos = [sl.pos[0] as f32, sl.pos[1] as f32, sl.pos[2] as f32]; self.jug.vel = [sl.vel[0] as f32, sl.vel[1] as f32, sl.vel[2] as f32]; }
            veh::Usar::Nada => {}
        }
    }
    /// manejando: la cámara del vehículo (con su lugar dibujado, entre paso y paso de la física) y el jugador en el asiento
    fn camara_vehiculo(&mut self) -> Option<([f32; 3], [f32; 3])> {
        let (id, _) = self.vehs.jugador?; let mp = self.mapa.as_ref()?;
        let o = self.objs.iter().find(|o| o.cuerpo == Some(id))?;
        let t = (self.acum_fis / PASO_FIS).clamp(0.0, 1.0);
        let p = [o.ant.0[0] + (o.pos[0] - o.ant.0[0]) * t, o.ant.0[1] + (o.pos[1] - o.ant.0[1]) * t, o.ant.0[2] + (o.pos[2] - o.ant.0[2]) * t]; let q = qmezcla(o.ant.1, o.q, t);
        let c = self.vehs.camara(&mp.mundo, [p[0] as f64, p[1] as f64, p[2] as f64], [q[0] as f64, q[1] as f64, q[2] as f64, q[3] as f64], self.jug.yaw as f64, self.jug.pitch as f64)?;
        self.jug.pos = [c.jugador[0] as f32, c.jugador[1] as f32, c.jugador[2] as f32]; self.jug.vel = [0.0; 3];
        let a = c.adelante();
        Some(([c.pos[0] as f32, c.pos[1] as f32, c.pos[2] as f32], [a[0] as f32, a[1] as f32, a[2] as f32]))
    }
    /// lo que pasó este cuadro en el mundo: los eventos de los NPC (sonidos, el daño al jugador, trazas, lo que dicen) y de
    /// los vehículos (sonidos, carteles, el que salió despedido, temblor, el que se rompió), y los chapuzones del agua
    fn eventos_mundo(&mut self, dt: f32) {
        self.aguas.avanzar(dt as f64);
        for e in self.npcs.eventos() {
            match e {
                npc::Evento::Sonido { nombre, pos, vol, tono } => self.sonido.tocar(&nombre, vol, tono, pos),
                npc::Evento::DanoJugador { dan, empuje, .. } => { self.danar_jugador(dan); for k in 0..3 { self.jug.vel[k] += empuje[k]; } }
                npc::Evento::Traza { de, a } => self.ef.traza(de, a),
                npc::Evento::Impacto { p, n, cuerpo } => self.ef.impacto(p, n, if cuerpo { Sup::Cuerpo } else { Sup::Mundo }),
                npc::Evento::DanoObjeto { cuerpo, dan, .. } => { if let Some(i) = self.objs.iter().position(|o| o.cuerpo == Some(cuerpo)) { self.danar_objeto(i, dan); } }
                _ => {}
            }
        }
        for e in std::mem::take(&mut self.vehs.eventos) {
            match e {
                veh::Evento::Sonido { nombre, p, vol } => self.sonido.tocar(nombre, vol as f32, 1.0, Some([p[0] as f32, p[1] as f32, p[2] as f32])),
                veh::Evento::Aviso(t) => self.avisar(t.into()),
                veh::Evento::Salio(sl) => { self.jug.pos = [sl.pos[0] as f32, sl.pos[1] as f32, sl.pos[2] as f32]; self.jug.vel = [sl.vel[0] as f32, sl.vel[1] as f32, sl.vel[2] as f32]; }
                veh::Evento::Temblor(k) => self.temblor = self.temblor.max(k as f32),
                veh::Evento::Roto { p, cuerpo } => { self.explosion([p[0] as f32, p[1] as f32, p[2] as f32], 5.0, 60.0); self.des_roto(cuerpo); }
                veh::Evento::Marca { de, a, n, ancho, k } => self.ef.marca([de[0] as f32, de[1] as f32, de[2] as f32], [a[0] as f32, a[1] as f32, a[2] as f32], [n[0] as f32, n[1] as f32, n[2] as f32], ancho as f32, k as f32),
            }
        }
        let ahora = self.t0.elapsed().as_secs_f32();
        for sp in std::mem::take(&mut self.aguas.salpicones) { let n = format!("AG_Salpica{}", 1 + (self.azar() * 3.0) as u32); self.sonido.tocar(&n, (0.3 + 0.7 * sp.k) as f32, 1.0, Some([sp.p[0] as f32, sp.p[1] as f32, sp.p[2] as f32]));
            // (el salpicón de verdad: agua de partículas que salta en corona y vuelve a caer, y el aire que mete abajo)
            let p = [sp.p[0] as f32, sp.p[1] as f32, sp.p[2] as f32]; self.jg.agua.flu.salpicar(p, sp.k as f32);
            for _ in 0..(4.0 + 14.0 * sp.k) as usize { let q = [p[0] + (self.azar() - 0.5) * 0.5, p[1] - 0.1 - self.azar() * 0.6, p[2] + (self.azar() - 0.5) * 0.5]; let r = 0.005 + self.azar() * 0.012; self.jg.agua.burbuja(&mut self.ef, &self.aguas, q, r); }
            // (y la onda que deja en el agua)
            self.ondas.push([sp.p[0] as f32, sp.p[2] as f32, ahora, (0.6 + 0.9 * sp.k) as f32]); }
        // (lo que el agua de partículas dejó al caer al agua del mapa: ondas y ruido)
        for o in std::mem::take(&mut self.jg.agua.ondas) { self.ondas.push([o[0], o[1], ahora, o[2]]); }
        for (p, v) in std::mem::take(&mut self.jg.agua.ruidos) { let n = format!("AG_Salpica{}", 1 + (self.azar() * 3.0) as u32); let tono = 1.0 + self.azar() * 0.3; self.sonido.tocar(&n, v, tono, Some(p)); }
    }
    /// la Physics Gun y la Gravity Gun con un NPC: agarrar a uno vivo lo vuelve muñeco (y el arma agarra la parte más
    /// cercana); el disparo de la Gravity Gun lo tira (npcTumbar)
    fn armas_con_npc(&mut self, primario: bool) {
        let n = self.armas.def().n; if n != "PhysicsGun" && n != "GravityGun" { return; }
        if self.armas.agarre.is_some() || self.armas.grav.is_some() { return; }
        let Some(mp) = self.mapa.as_ref() else { return };
        let (o, f) = (self.ojos_ult, self.mira());
        let alcance = if n == "PhysicsGun" { 50.0 } else if primario { 10.0 } else { 25.0 };
        let Some(g) = self.fis.rayo(&mp.mundo, [o[0] as f64, o[1] as f64, o[2] as f64], [f[0] as f64, f[1] as f64, f[2] as f64], alcance, &[]) else { return };
        let Some(c) = g.cuerpo else { return }; let Some(id) = self.npcs.de_cuerpo(c) else { return };
        let punto = [g.p[0] as f32, g.p[1] as f32, g.p[2] as f32];
        if n == "GravityGun" && primario { self.npcs.tumbar(id, [f[0] * 14.0, f[1] * 14.0 + 4.0, f[2] * 14.0], &mut self.fis); let s = format!("GG_Launch{}", 1 + (self.azar() * 4.0) as u32); self.sonido.tocar(&s, 0.7, 1.0, None); return; }
        if primario || n == "GravityGun" { self.npcs.agarrar(c, punto, &mut self.fis); }
    }
    /// Deshacer: lo último que se puso (un objeto o un NPC)
    fn deshacer(&mut self) {
        while let Some((es_npc, id)) = self.pila.pop() {
            if es_npc { if self.npcs.get(id).is_some() { let n = self.npcs.get(id).map(|p| npc::skin_nom(&p.skin).to_string()).unwrap_or_default(); self.npcs.quitar(id, &mut self.fis); self.avisar(format!("Deshecho: {n}")); return; } }
            else if let Some(i) = self.objs.iter().position(|o| o.id == id) { let n = self.objs[i].nombre.clone(); self.borrar_obj(i); self.avisar(format!("Deshecho: {n}")); return; }
        }
    }
    /// el catálogo de una pestaña del menú (0 Props, 1 NPCs, 2 Vehículos)
    fn cat(&self, pestana: usize) -> &Vec<(String, Vec<String>)> { match pestana { 1 => &self.cat_npc, 2 => &self.cat_veh, _ => &self.catalogo } }
    /// hacia dónde mira (miraDir)
    fn mira(&self) -> [f32; 3] { let (y, p) = (self.jug.yaw, self.jug.pitch); [y.sin() * p.cos(), p.sin(), y.cos() * p.cos()] }
    /// qué maneja el jugador (al volante), si maneja
    fn tipo_manejo(&self) -> Option<veh::Tipo> { self.vehs.jugador.filter(|j| j.1 == 0).and_then(|j| self.vehs.de(j.0)).map(|v| v.tipo) }
    /// qué botones se ven: los de la Physics Gun sólo con algo agarrado; la barra de armas, abierta
    fn boton_visible(&self, b: Boton) -> bool {
        // (en el editor: todos los que se mueven en ese modo, aunque el arma o la situación los escondan)
        if self.ed.activo { return b != Boton::Girar && hud_web::clave(b).is_some_and(|c| hud_web::editable(c, self.ed.veh)); }
        if self.jg.sin_hud() { return false; }
        // (con la barra de armas abierta, como la web —#arribaDe escondido—: el arma, la cámara y los emotes, que quedan debajo)
        if self.armas.barra_t > 0.0 && matches!(b, Boton::Arma | Boton::Camara | Boton::Emotes) { return false; }
        match b {
            // (Ajustes y Salas, desde la pausa y el menú principal, como la web)
            Boton::Ajustes | Boton::Salas => false,
            Boton::Girar | Boton::Lejos | Boton::Cerca => self.armas.agarre.is_some(),
            Boton::Recargar => self.armas.def().car > 0 && self.vehs.jugador.is_none(),
            // (usar, a pie —#busar—; arriba de algo, bajarse —#bbajar, donde va borrar—)
            Boton::Usar if self.vehs.jugador.is_some() => false,
            Boton::Usar if self.mj.usar.is_some() => true,
            Boton::Usar => self.usar_ve || self.jg.usar_txt.is_some() || self.gmod.usable,
            Boton::Bajar => self.vehs.jugador.is_some(),
            Boton::Deshacer => self.vehs.jugador.is_none(),
            // (manejando: sin armas ni objetos)
            Boton::Disparo | Boton::Disparo2 if self.armas.def().tipo == "celu" => false,
            Boton::Disparo | Boton::Disparo2 | Boton::Arma | Boton::Objetos | Boton::Volar if self.vehs.jugador.is_some() => false,
            Boton::ArmaN(_) => self.armas.barra_t > 0.0,
            // (la bocina, al volante de algo que tenga y no esté roto; el turbo, en la bici con cohete: hud.js)
            Boton::Bocina => self.vehs.jugador.filter(|j| j.1 == 0).and_then(|j| self.vehs.de(j.0)).map_or(false, |v| !v.roto && v.bocina_tipo().is_some()),
            Boton::Chat | Boton::Micro => self.en_red.en_sala(),
            Boton::Jg(b) => self.jg_visible(b),
            Boton::Pj(b) => self.pj_visible(b),
            Boton::Emotes => self.vehs.jugador.is_none() && self.pj.is_some(),
            Boton::Turbo => self.vehs.jugador.and_then(|j| self.vehs.de(j.0)).map_or(false, |v| v.bici && !v.roto),
            // (manejando, agacharse sólo hace algo en el helicóptero —baja— y en el avión —desacelera—)
            Boton::Agachar if self.vehs.jugador.is_some() => matches!(self.tipo_manejo(), Some(veh::Tipo::Heli | veh::Tipo::Avion)),
            _ => true,
        }
    }
    /// lo que se puede elegir en un renglón de Ajustes, cuál está elegido, y elegir
    fn valores_aj(&self, c: Clave) -> Vec<String> {
        match c { Clave::Motor => Placa::lista().iter().map(|p| p.nombre().to_string()).collect(), Clave::Mapa => self.mapas.iter().map(|m| jxjuego::identidad::nombre_mapa(m)).collect(), _ => Ajustes::valores(c) }
    }
    fn elegido_aj(&self, c: Clave) -> Option<usize> {
        match c { Clave::Motor => Placa::lista().iter().position(|p| *p == self.placa), Clave::Mapa => Some(self.mapa_i), _ => self.aj.elegido(c) }
    }
    /// (para las pruebas) dónde tocar para elegir el valor `k` del renglón `fila` de la pestaña `pestana` de Ajustes (o la
    /// pestaña, con `fila` None)
    pub fn pos_ajuste(&self, w: f32, h: f32, pestana: usize, fila: Option<usize>, k: usize) -> (f32, f32) {
        let p = panel(w, h, ajustes::PESTANAS.len());
        match fila {
            None => (p.x0 + (p.gx - p.x0) / 2.0, p.y0 + h * 0.08 + (pestana as f32 + 0.5) * p.tab_h),
            Some(f) => { let cl = ajustes::claves(pestana).get(f).copied().unwrap_or(Clave::Sens); let n = self.valores_aj(cl).len().max(k + 1); let c = cajas_de(cl, &p, h, f, n)[k]; (c.0 + c.2 / 2.0, c.1 + c.3 / 2.0) }
        }
    }
    fn toque_ajustes(&mut self, x: f32, y: f32, w: f32, h: f32) {
        let Some(pe) = self.ajustes else { return };
        let p = panel(w, h, ajustes::PESTANAS.len());
        if (x > p.x0 + p.pw - h * 0.1 && y < p.y0 + h * 0.08) || x < p.x0 || x > p.x0 + p.pw || y < p.y0 || y > p.y0 + p.ph { self.ajustes = None; return; }
        if x < p.gx - p.pw * 0.01 {
            let k = ((y - p.y0 - h * 0.08) / p.tab_h).floor() as i64;
            if k >= 0 && (k as usize) < ajustes::PESTANAS.len() { self.ajustes = Some(k as usize); self.sonido.tocar("Click", 0.5, 1.0, None); }
            return;
        }
        for (f, c) in ajustes::claves(pe).iter().enumerate() {
            let n = self.valores_aj(*c).len();
            for (k, b) in cajas_de(*c, &p, h, f, n).into_iter().enumerate() {
                if x >= b.0 && x <= b.0 + b.2 && y >= b.1 && y <= b.1 + b.3 {
                    self.sonido.tocar("Click", 0.5, 1.0, None);
                    match c {
                        Clave::Motor => self.elegir_motor(k),
                        Clave::Comparar => self.banco_empezar(),
                        Clave::Botones if k == 0 => self.ed_abrir(),
                        Clave::Mapa => { if k != self.mapa_i { self.mapa_i = k; self.recargar = true; self.ajustes = None; if let Some(d) = &self.datos { let _ = std::fs::write(d.join("mapa.txt"), &self.mapas[k]); } } }
                        _ => { self.aj.elegir(*c, k); if let Some(d) = &self.datos { let _ = std::fs::write(d.join("ajustes.txt"), self.aj.texto()); } }
                    }
                    return;
                }
            }
        }
    }
    pub fn dedos_fuera(&mut self) { self.dedos.clear(); }
    /// Ajustes (desde la pausa: Pz::Ajustes)
    pub fn abrir_ajustes(&mut self) { self.menu = None; self.ajustes = Some(0); }
    fn apretado(&self, b: Boton) -> bool { self.dedos.iter().any(|d| d.boton == Some(b)) }
    /// lo que pide el jugador: la palanca (corre con el dedo a más de 1,6 radios, como la web) y los botones
    fn entrada(&self, w: f32, h: f32) -> Entrada {
        let mut e = Entrada { saltar: self.apretado(Boton::Saltar), agachar: self.apretado(Boton::Agachar), ..Default::default() };
        if let Some(d) = self.dedos.iter().find(|d| d.palanca) {
            let r = hud_web::palanca(w, h).2 * 0.42; let (mut dx, mut dy) = ((d.x - d.x0) / r, (d.y - d.y0) / r); let l = (dx * dx + dy * dy).sqrt();
            if l > 1.0 { dx /= l; dy /= l; }
            e.x = dx; e.y = -dy; e.correr = l > 1.6;
        }
        e
    }
    /// para las pruebas: los ojos en un lugar fijo (volando, para que no caiga)
    /// (las pruebas: arrastrar el dedo `dx` píxeles de costado en una pantalla de alto `h`, como en tocar)
    /// la cámara de verdad: la elegida o la tercera persona que pide un addon (el sable: CalcView con drawviewer)
    pub(crate) fn camara_ef(&self) -> u8 { if self.camara == 0 && self.vehs.jugador.is_none() && self.gmod.calc.as_ref().map(|c| c.ver_jug).unwrap_or(false) { 1 } else { self.camara } }
    pub fn arrastre_prueba(&mut self, dx: f32, h: f32) { self.mdx += dx * 1080.0 / h.max(1.0) / 2.5; self.jug.yaw -= dx * 0.0045 * 1080.0 / h.max(1.0) * self.aj.sens as f32 / 12.0; }
    pub fn poner_ojos(&mut self, ojos: [f32; 3], yaw: f32, pitch: f32) {
        self.jug.noclip = true; self.jug.pos = [ojos[0], ojos[1] - 0.72, ojos[2]]; self.jug.vel = [0.0; 3]; self.jug.yaw = yaw; self.jug.pitch = pitch;
    }

    /// los botones de los motores: OpenGL 3 y OpenGL 2
    fn elegir_motor(&mut self, k: usize) {
        {
            let p = Placa::lista()[k];
            if let Some(d) = &self.datos { let _ = std::fs::write(d.join("motor.txt"), p.clave()); }
            self.placa = p; self.gi.reenviar();
            let usar = if p.hecha() { p } else { Placa::Gl3 };
            if usar != self.en_uso { self.cambiar_motor = true; }
            self.aviso = Some((if p.hecha() { format!("Motor: {}", p.nombre()) } else { format!("{} todavía no está: se usa OpenGL 3 (queda elegido)", p.nombre()) }, Instant::now()));
        }
    }

    /// arma el mapa elegido y pone al jugador donde aparece
    /// lo que le falta bajar al mapa que se va a cargar: (bajado, total, falló) del mapa y la skin juntos; la skin que no se
    /// puede bajar no frena (queda el Hero, como siempre)
    fn rb_falta_carga(&self) -> Option<(u64, u64, bool)> {
        let (b, paq) = (self.bajas.as_ref()?, self.paq.as_ref()?);
        let nom = |k: String| paq.d["rbp"][&k][0].as_str().map(String::from);
        let mapa: Vec<String> = self.mapas.get(self.mapa_i).and_then(|m| nom(format!("m_{m}"))).into_iter().collect();
        let mut mapa = mapa;
        if self.mapas.get(self.mapa_i).map(|m| m.starts_with("WS_") || m.starts_with("JX_")).unwrap_or(false) && self.gmod.lib.is_none() {
            if let Some(l) = self.gmod.lector_rb.as_ref() { mapa.extend(gmod_juego::gmod_base_archivos_lib(l).into_iter().filter(|n| !b.disponible(n))); }
        }
        let skin: Vec<String> = nom(format!("s_{}", self.skin)).into_iter().collect();
        let fm = b.asegurar(&mapa); let fs = b.asegurar(&skin).filter(|s| !s.2);
        match (fm, fs) { (None, None) => None, (a, c) => { let (a, c) = (a.unwrap_or((0, 0, false)), c.unwrap_or((0, 0, false))); Some((a.0 + c.0, a.1 + c.1, a.2)) } }
    }
    fn cargar_mapa(&mut self, m: &mut Motor3d) {
        let nombre = self.mapas[self.mapa_i].clone(); let nombre = nombre.as_str();
        crate::caja_negra::paso(format!("armar el mapa {nombre}"));
        self.mapa = None;
        self.objs.clear(); self.prefabs.clear(); self.cargados.olvidar(); if let Some(mm) = self.menu.as_mut() { mm.atlas_de = None; }
        self.npcs.olvidar(); self.npc_skins.olvidar(); self.vehs = Vehiculos::nuevo(); self.pila.clear(); self.jg_limpiar(); self.pjs_limpiar();
        self.fis = Fisica::nueva(); self.acum_fis = 0.0; self.armas.olvidar(); self.proys.clear(); self.por_explotar.clear(); self.her.cable = None; self.her.trazas.clear(); self.her.tirados.clear(); self.her.spawn = None; self.pj = None; self.pj_cargados.olvidar(); self.vista = None; self.vista_cargados.olvidar(); self.tubo_ok = false; self.armas_ico = false; self.hud_ico = false; self.gr.cargada = false; self.ef_atlas = false;
        unsafe { m.vaciar(); }
        // (lo propio que se cargó una vez —las armas de diseño nuevo, el tubo del rayo— se fue con el motor: otra vez)
        self.aero = None; self.tubo_ok = false;
        self.mapas_vaciado();
        let Some(paq) = self.paq.as_mut() else { return };
        match if nombre.starts_with("WS_") { self.mapa_ws(m, nombre) } else if nombre.starts_with("JX_") { self.mapa_jx(m, nombre) } else { mapa::armar(paq, nombre, 1024, 750.0) } {
            Ok(mp) => {
                if let Err(e) = unsafe { m.cargar(&mp.esc) } { self.aviso = Some((format!("mapa {nombre}: {e}"), Instant::now())); }
                let sp = mp.spawns.first().map(|s| s.0).unwrap_or([0.0, 1.0, 0.0]);
                let yaw = mp.spawns.first().and_then(|s| s.1).unwrap_or(0.0);
                let noclip = self.jug.noclip;
                self.jug = Jugador::nuevo(); self.jug.noclip = noclip; self.acum = 0.0;
                self.jug.aparecer(&mp.mundo, sp, Some(yaw)); self.jug.aguas = mp.aguas.clone();
                self.aguas = Aguas::de_cajas(&mp.aguas); self.ef.limpiar(); self.jg.agua.flu.limpiar(); self.jg.agua.manguera = false; self.jg.agua.src.puesta = None; self.ef.luz_de(&mp.luz);
                self.mapa = Some(mp); self.npcs.piso = self.piso().into(); crate::caja_negra::paso(format!("mapa {nombre} armado: a dibujarlo"));
                self.pjs_mapa(m);
            }
            Err(e) => { self.error = Some(format!("mapa {nombre}: {e}")); }
        }
        // el cuerpo del jugador (si la skin no está, el Hero, como la web)
        if let Some(paq) = self.paq.as_mut() {
            let r = Personaje::cargar(paq, &self.skin, 0, 512, &mut self.pj_cargados).or_else(|_| Personaje::cargar(paq, "Hero", 0, 512, &mut self.pj_cargados));
            match r {
                Ok((mut pj, esc)) => {
                    if let Some((a, b)) = &self.nado { let _ = pj.nado(a, b); }
                    if let Err(e) = unsafe { m.cargar(&esc) } { self.avisar(format!("personaje: {e}")); } else { self.pj = Some(pj); }
                }
                Err(e) => self.avisar(format!("personaje: {e}")),
            }
        }
        self.cargar_letras(m);
    }

    /// un cuadro: mover, dibujar el mapa y el HUD (y Vulkan lo pone en la pantalla; con OpenGL lo hace la app). Lo que tarda
    /// se mide afuera, con la espera a la pantalla: `medir`
    pub unsafe fn cuadro(&mut self, m: &mut Motor3d, w: i32, h: i32, placa_txt: &str) -> Result<(), String> {
        // (lo que tarda la placa: con los medidores de tiempo de la placa, cada cuadro sin frenarla —reales e intermedios aparte—;
        // si la placa no los tiene, cada 60 cuadros se espera a que termine; Vulkan tiene sus marcas de tiempo)
        let en_juego = self.mapa.is_some() && !self.recargar && !self.ini.abierto;
        let reloj = en_juego && m.tiene_reloj();
        // (sin medidores: sólo en un cuadro de verdad —con JX Turbo, uno de cada dos a cuatro—)
        let medir = !m.es_vulkan() && !reloj && self.cuenta % 60 >= 30 && self.cuenta % 60 < 34 && self.turbo_n >= self.turbo_max() && en_juego;
        self.reloj_ok = reloj;
        if medir { m.esperar(); }
        if reloj { m.reloj_empezar(); }
        let t = Instant::now();
        let r = self.cuadro_dentro(m, w, h, placa_txt);
        // (lo que tardó la CPU en armarlo, sin la espera a la pantalla: con el ritmo parejo de JX Turbo cada cuadro dura lo mismo)
        { let x = t.elapsed().as_secs_f32() * 1000.0; let c = if self.fue_inter { &mut self.cpu_inter } else { &mut self.cpu_real }; *c = if *c == 0.0 { x } else { *c * 0.9 + x * 0.1 }; }
        if reloj { m.reloj_terminar(self.fue_inter); if let Some((re, it)) = m.reloj() { self.placa_ms = re; self.placa_inter = it; } }
        if medir { m.esperar(); if !self.fue_inter { let x = t.elapsed().as_secs_f32() * 1000.0; self.placa_ms = if self.placa_ms == 0.0 { x } else { self.placa_ms * 0.5 + x * 0.5 }; } }
        if let Some((tot, det)) = m.tiempos() { self.placa_ms = tot; self.detalle = det; }
        r
    }
    unsafe fn cuadro_dentro(&mut self, m: &mut Motor3d, w: i32, h: i32, placa_txt: &str) -> Result<(), String> {
        self.cont_paso();
        self.musica_paso();
        aero::ESCALA.store(self.aj.menus, std::sync::atomic::Ordering::Relaxed);
        // (lo que llega de la tienda y de la Workshop también con el menú abierto)
        if self.ini.abierto { self.gmod_tienda_paso(); return self.ini_cuadro(m, w, h); }
        // (al cargar: primero un cuadro con el cartel de «Cargando…», y en el siguiente se arma el mapa, que tarda)
        if self.recargar {
            if self.paq.is_some() && !self.mapa_cartel && !self.ini.abierto { self.entrando_partida(); }
            if self.paq.is_some() && !self.mapa_cartel { self.mapa_cartel = true; self.mapa = None; m.vaciar(); self.aero = None; self.tubo_ok = false; self.objs.clear(); self.fis = Fisica::nueva(); self.npcs.olvidar(); self.npc_skins.olvidar(); self.vehs = Vehiculos::nuevo(); self.pila.clear(); self.prefabs.clear(); self.cargados.olvidar(); self.pj = None; self.pj_cargados.olvidar(); self.vista = None; self.vista_cargados.olvidar(); self.tubo_ok = false; self.armas_ico = false; self.hud_ico = false; self.gr.cargada = false; self.ef_atlas = false; if let Some(mm) = self.menu.as_mut() { mm.atlas_de = None; } self.cargar_letras(m); }
            // (si al mapa —o a la skin elegida— le falta bajar su paquete aparte, la pantalla de carga espera y dice cuánto va;
            // si el mapa no se puede bajar, vuelve al menú)
            // (el mapa de inicio del Workshop: si no está bajado, se baja; si no se puede —sin conexión—, gm_flatgrass)
            else if let Some(b) = self.ws_inicial_falta() {
                if b.2 { self.bajada = None; if let Some(i) = self.mapas.iter().position(|m| m == "RB_Flatgrass") { self.mapa_i = i; } self.avisar(format!("No se pudo bajar {} (hace falta internet la primera vez): se juega en gm_flatgrass", mapas_juego::MAPA_INICIAL.2)); }
                else { self.bajada = Some(b); }
            }
            else if let Some(b) = self.rb_falta_carga() {
                if b.2 { self.bajada = None; self.recargar = false; self.mapa_cartel = false; self.avisar("No se pudo bajar el mapa: revisá la conexión".into()); self.inicio_abrir(); }
                else { self.bajada = Some(b); }
            }
            // (los mapas del Workshop: lo de HL2 y CS:S que piden y no está, de Steam; si no se puede, se arma igual)
            else if let Some(b) = self.base_falta_carga() { self.bajada = Some(b); }
            else { self.bajada = None; self.recargar = false; self.mapa_cartel = false; if self.paq.is_some() { self.cargar_mapa(m); } else { m.vaciar(); self.cargar_letras(m); } self.partida_t = Some(Instant::now()); }
        }
        // (la entrada a la partida anduvo: 12 s jugando sin que se cierre)
        if !self.recargar && self.mapa.is_some() && crate::caja_negra::partida_en_curso() { if self.partida_t.map_or(false, |t| t.elapsed().as_secs_f32() > 12.0) { crate::caja_negra::partida_lista(); if let Some(d) = &self.datos { let _ = std::fs::remove_file(d.join("seguro.txt")); } } }
        let ahora = Instant::now(); let dt = self.dt_fijo.unwrap_or((ahora - self.t_ant).as_secs_f32().min(0.1)); self.t_ant = ahora; self.perf_t = ahora;
        self.gfx_auto(placa_txt, w, h);
        self.banco_paso();
        let (wf, hf) = (w as f32, h as f32);
        // la física del jugador, a paso fijo (como mucho 12 pasos por cuadro: si el teléfono se traba, no se acumula)
        let ent = self.entrada(wf, hf);
        let ent = self.jg_entrada(ent, dt);
        // (un emote se corta al moverse o saltar, como en la web)
        if self.emote.is_some() && (ent.x.abs() + ent.y.abs() > 0.15 || ent.saltar) { self.hacer_emote(None); }
        // (lo de Ajustes, cada cuadro: la calidad al motor y el volumen al mezclador)
        // (JX Turbo prendido en el motor sólo cuando hace falta —los reales no llegan al refresco—: si no, ni guarda la imagen)
        { let mut op = self.aj.opciones(); op.escala *= self.drs; op.turbo = self.aj.turbo && self.turbo_on;
          // (el antilag ya no apaga efectos: los reflejos, la luz global y las sombras se eligen con la calidad; sólo baja la
          // resolución —self.drs, más abajo—)
          m.opciones(&op); } self.sonido.volumen = self.aj.volumen();
        if self.ajustes.is_some() { self.acum = 0.0; }
        else if let Some(mp) = &self.mapa {
            self.acum = (self.acum + dt).min(PASO * 12.0);
            if self.vehs.jugador.is_some() { self.acum = 0.0; self.jug.suelo = false; }
            while self.acum >= PASO { if !self.jg.mueve_jugador() { self.jug.paso_con(&mp.mundo, Some(&mut self.fis), PASO, &ent); } self.golpe_max = self.golpe_max.max(self.jug.golpe); self.acum -= PASO; }
            marca(&mut self.perf, &mut self.perf_t, 0);
            // la física de los objetos a 60 por segundo (como mucho 3 pasos por cuadro, como la web)
            self.fis.sub = SUB_FIS[self.aj.calidad.min(4)];
            self.acum_fis = (self.acum_fis + dt).min(PASO_FIS * 3.0);
            let caps_agua = self.agua_capsulas(); self.jg.agua.flu.calidad(self.aj.calidad as usize);
            // (lo que empuja las olas además de los cuerpos: el jugador y los NPC, con lo hundido de cada uno)
            let mut extra_olas: Vec<(u32, f32, f32, f32, f32)> = vec![];
            { let mut poner = |id: u32, p: [f32; 3], pie: f32, alto: f32, vol: f32, r: f32| if let Some(v) = self.aguas.en(p[0] as f64, p[1] as f64, p[2] as f64, 2.5) { let f = ((v.y1 as f32 - pie) / alto).clamp(0.0, 1.0); extra_olas.push((id, p[0], p[2], r, vol * f)); };
              if !self.jug.noclip { poner(u32::MAX - 1, self.jug.pos, self.jug.pos[1] - self.jug.medio - self.jug.radio, 1.8, 0.075, 0.35); }
              for (k, n) in self.npcs.lista.iter().filter(|n| n.vivo).take(16).enumerate() { let q = n.pos(); let q = [q[0] as f32, q[1] as f32, q[2] as f32]; poner(u32::MAX - 2 - k as u32, q, q[1] - 0.9, 1.8, 0.075, 0.35); } }
            while self.acum_fis >= PASO_FIS {
                for o in self.objs.iter_mut() { o.ant = (o.pos, o.q); }
                let (yaw, pitch) = (self.jug.yaw, self.jug.pitch); let fwd = [yaw.sin() * pitch.cos(), pitch.sin(), yaw.cos() * pitch.cos()];
                self.armas.paso(&mut self.fis, PASO_FIS, self.ojos_ult, fwd, yaw);
                // (los vehículos —el que maneja el jugador, con la palanca— y lo que flota, antes de la física)
                let mando = if self.vehs.jugador.is_some() { let mut m = Mando::de_entrada(&ent); m.turbo |= self.apretado(Boton::Turbo); m } else { Mando::default() };
                self.vehs.paso(&mut self.fis, &mp.mundo, Some(&self.aguas), PASO_FIS as f64, &mando);
                // (el agua de partículas y los huecos: antes de flotar —su densidad depende de cuánta agua tienen—)
                jugabilidad::agua_juego::agua_paso(&mut self.jg.agua, &mut self.fis, &mut self.aguas, &mut self.ef, &mp.mundo, &caps_agua, ([self.ojos_ult[0], self.ojos_ult[1] - 0.25, self.ojos_ult[2]], fwd), self.ojos_ult, mp.mundo.gravedad, PASO_FIS);
                self.aguas.paso(&mut self.fis, PASO_FIS as f64);
                self.aguas.olas_paso(&self.fis, self.ojos_ult, &extra_olas, PASO_FIS as f64);
                self.fis.paso(&mp.mundo, PASO_FIS as f64); self.acum_fis -= PASO_FIS;
                self.jg.des.golpes.extend(self.fis.golpes.iter().cloned());
                for o in self.objs.iter_mut() { if let Some(b) = o.cuerpo.and_then(|id| self.fis.cuerpo(id)) { o.pos = [b.pos[0] as f32, b.pos[1] as f32, b.pos[2] as f32]; o.q = [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32]; } }
            }
            // (lo que se cayó del mapa —debajo de −300— se saca)
            let muertos: Vec<usize> = self.objs.iter().enumerate().filter(|(_, o)| o.cuerpo.and_then(|id| self.fis.cuerpo(id)).map(|b| b.muerto).unwrap_or(false)).map(|(i, _)| i).collect();
            for i in muertos.into_iter().rev() { let o = self.objs.remove(i); if let Some(id) = o.cuerpo { if let Some(sl) = self.vehs.quitar(id, &self.fis, &mp.mundo) { self.jug.pos = [sl.pos[0] as f32, sl.pos[1] as f32, sl.pos[2] as f32]; } self.fis.quitar(id); self.aguas.olvidar(id); } }
            // los NPC (piensan, caminan, pelean y se animan después)
            marca(&mut self.perf, &mut self.perf_t, 1);
            self.npcs.paso(dt, &mp.mundo, &mut self.fis, &Gente::de_jugador(&self.jug), self.ojos_ult);
            marca(&mut self.perf, &mut self.perf_t, 2);
            // (se cayó del mapa o se ahogó: vuelve a aparecer)
            if self.jug.pos[1] < mp.mundo.lo[1] - 60.0 || (self.jug.vida <= 0.0 && !self.gmod_retiene_muerte()) {
                if self.jug.vida <= 0.0 { self.aviso = Some((if self.muerto { "Te moriste".into() } else { "Te ahogaste".into() }, Instant::now())); }
                self.muerto = false;
                let sp = self.her.spawn.map(|p| [p[0], p[1] + 0.2, p[2]]).or(mp.spawns.first().map(|s| s.0)).unwrap_or([0.0, 1.0, 0.0]); self.jug.aparecer(&mp.mundo, sp, None); self.jug.vida = 100.0; self.jug.aire = 12.0;
            }
        }
        // lo que pasó en el mundo: los NPC y los vehículos (sonidos, daño, el que sale despedido) y el agua
        if self.mapa.is_some() { self.eventos_mundo(dt); }
        // el multijugador: lo que llega, lo mío para mandar, los demás y sus cosas
        self.escrito_paso();
        unsafe { self.red_cuadro(m, dt); }
        self.gmod_tam(wf, hf); self.gmod_cuadro(m, dt);
        unsafe { self.mapas_cuadro(m, dt); }
        unsafe { self.jg_cuadro(m, dt); }
        self.pjs.celu.pantalla = (wf, hf); unsafe { self.pjs_cuadro(m, dt); }
        // manejando: el jugador va en el asiento y la cámara es la del vehículo (vehiculoCamara)
        let cam_veh = self.camara_vehiculo();
        let (ojos, _) = self.jug.ojos(dt); self.ojos_ult = ojos;
        // (¿hay un vehículo a la vista para subir?)
        let fm = self.mira();
        self.usar_ve = self.vehs.jugador.is_none() && match self.mapa.as_ref() { Some(mp) => self.vehs.mirado(&mut self.fis, &mp.mundo, [ojos[0] as f64, ojos[1] as f64, ojos[2] as f64], [fm[0] as f64, fm[1] as f64, fm[2] as f64]).is_some(), None => false };
        if self.armas.barra_t > 0.0 { self.armas.barra_t -= dt; }
        for (n, v) in std::mem::take(&mut self.armas.sonidos) { self.sonido.tocar(&n, v, 1.0, None); }
        for a in std::mem::take(&mut self.armas.avisos) { self.avisar(a); }
        self.sonidos(dt, ojos, &ent);
        let (yaw, pitch) = (self.jug.yaw, self.jug.pitch);
        let fw = [yaw.sin() * pitch.cos(), pitch.sin(), yaw.cos() * pitch.cos()];
        self.menu_atlas(m);
        // las armas de fuego y de golpe: con el dedo en Disparar, tira a su ritmo; los relojes, el golpe atrasado, la recarga
        if self.ajustes.is_none() && self.mapa.is_some() {
            if self.armas.relojes(dt) { let i = self.armas.i; self.golpe_aplicar(i); }
            if self.apretado(Boton::Disparo) && self.menu.is_none() && self.vehs.jugador.is_none() && !self.gmod_arma_activa() { self.disparar(m); }
            self.proyectiles_paso(dt);
        }
        // la Tool Gun: lo que se disparó, y lo que hacen las cosas que puso (en pausa, nada)
        if let Some(alt) = self.armas.herr.take() { self.herramienta_usar(m, alt); }
        if self.ajustes.is_none() && self.mapa.is_some() { self.herramientas_paso(m, dt); }
        self.tut_paso(dt);
        if self.ajustes.is_none() && !self.ini.pz.abierta { self.grieta_paso(m, dt); }
        let pend = std::mem::take(&mut self.pendientes);
        for n in pend { if let Err(e) = self.poner(m, &n, ojos, fw) { self.avisar(format!("{n}: {e}")); } }
        // (Cargar: lo guardado de este mapa, en su lugar exacto)
        for (n, p, q, f) in std::mem::take(&mut self.por_cargar) { if let Ok(Some(i)) = self.crear(m, &n, p, q, true, f) { if let Some(id) = self.objs.get(i).and_then(|o| o.cuerpo) { self.fis.poner(id, [p[0] as f64, p[1] as f64, p[2] as f64], [q[0] as f64, q[1] as f64, q[2] as f64, q[3] as f64]); } } }
        // el arma en la mano: el modelo del arma elegida, su clip (sacar; después quieto o sosteniendo) y el vaivén (armasPaso)
        if self.mapa.is_some() { self.arma_en_mano(m, dt); }
        // el cuerpo, animado (tercera persona y de frente, y en un vehículo si no es desde adentro): el piso bajo la cápsula,
        // la mirada, el agua si nada, el arma en la mano (P.arma: ninguna en un vehículo) y el asiento (asientoPose)
        let en_veh = self.vehs.jugador;
        let cam_ef = self.camara_ef();
        let ver_cuerpo = (cam_ef != 0 || (en_veh.is_some() && !self.vehs.primera) || self.jg.cuerpo_en_primera()) && !self.jg.sin_cuerpo();
        // (con un arma de un addon que trae su modelo de mundo, ése va en la mano: gmod_juego.rs)
        let gm_mano = self.gmod_arma_mundo();
        if let (Some(pj), Some(paq)) = (self.pj.as_mut(), self.paq.as_mut()) {
            if ver_cuerpo {
                let arma = if en_veh.is_some() || gm_mano { None } else { Some(self.armas.def().n) };
                if let Some(e) = pj.poner_arma(paq, arma, &mut self.pj_cargados) { if let Err(e) = unsafe { m.cargar(&e) } { self.aviso = Some((format!("arma: {e}"), Instant::now())); } }
                let asiento = en_veh.and_then(|(id, a)| {
                    let o = self.objs.iter().find(|o| o.cuerpo == Some(id))?;
                    let t = (self.acum_fis / PASO_FIS).clamp(0.0, 1.0);   // (como camara_vehiculo)
                    let p = [o.ant.0[0] + (o.pos[0] - o.ant.0[0]) * t, o.ant.0[1] + (o.pos[1] - o.ant.0[1]) * t, o.ant.0[2] + (o.pos[2] - o.ant.0[2]) * t];
                    let q = qmezcla(o.ant.1, o.q, t);
                    let manejando = a == 0 && self.vehs.de(id)?.tipo != veh::Tipo::Asiento;
                    let cab = self.vehs.cabina(paq, id, a);
                    Some(personaje::Asiento { pos: self.jug.pos, veh: p, q, manejando, cab })
                });
                pj.sentar(paq, asiento);
                let jp = self.jug.pos; let piso = [jp[0], jp[1] - 0.95, jp[2]];
                let agua = if self.jug.nada { self.jug.aguas.iter().find(|v| jp[0] >= v[0] && jp[0] <= v[3] && jp[2] >= v[2] && jp[2] <= v[5] && piso[1] < v[4]).map(|v| v[4]) } else { None };
                let e = personaje::Estado { piso, vel: self.jug.vel, yaw: self.jug.yaw, mira: -self.jug.pitch, en_suelo: self.jug.suelo || self.jug.noclip, agachado: self.jug.agachado, agua };
                let e = jugabilidad::estado(&self.jg, e); pj.animar(dt, &e);
                jugabilidad::pose_jugador(&mut self.jg, pj, &self.jug, self.mapa.as_ref().map(|m| &m.mundo), cam_ef, dt);
                personajes::pose_jugador(&mut self.pjs, pj, self.armas.def().tipo == "celu", self.emote.is_some(), en_veh.is_some());
            }
        }
        let tj = [self.azar() - 0.5, self.azar() - 0.5, self.azar() - 0.5];
        let turbo = self.mapa.is_some() && !self.vr.on && self.turbo_n < self.turbo_max() && m.turbo_listo(w, h);
        self.vr_paso();
        if let Some(mp) = &self.mapa { 'escena: {
            // (el campo de visión: el de Ajustes, más cerrado apuntando y 18° con la mira del francotirador; va de a poco)
            let z = if self.vr.on { (self.aj.fov as f32).max(80.0) } else if self.armas.zoom { 18.0 } else if let Some(f) = self.gmod.calc.as_ref().and_then(|c| c.fov) { f as f32 } else { self.aj.fov as f32 * (1.0 - 0.27 * self.armas.ap_k) };
            if self.fov_b == 0.0 { self.fov_b = z; } self.fov_b += (z - self.fov_b) * (dt * if (z - self.fov_b).abs() > 10.0 { 12.0 } else { 4.0 }).min(1.0);
            let p = persp(self.fov_b.to_radians(), if self.vr.on { wf * 0.5 } else { wf } / hf.max(1.0), 0.08, mp.lejos * 1.05);
            // (la cámara: en primera, los ojos; en tercera, 3,1 m atrás; de frente, 2,6 m adelante mirándote —jugadorCamara—;
            // si hay una pared en el medio, se acerca)
            let tam = self.pj.as_ref().map(|p| p.tam).unwrap_or(1.0); let kt = (0.45 + 0.55 * tam).clamp(0.6, 1.0);
            // (la cámara que pide un addon —CalcView: el sable te pone en tercera persona—: corrida de los ojos lo mismo que
            // de donde la calculó, que es el cuadro anterior)
            let calc = self.gmod.calc.clone().filter(|c| cam_veh.is_none() && (self.camara == 0 || c.ver_jug) && (c.pos.is_some() || c.fwd.is_some()));
            let (cam, mira) = if let Some(c) = cam_veh { c } else if let Some(cv) = calc {
                let d = cv.pos.map(|p| p.sub(cv.desde)).unwrap_or_default();
                ([ojos[0] + d.x as f32, ojos[1] + d.y as f32, ojos[2] + d.z as f32], cv.fwd.map(|f| [f.x as f32, f.y as f32, f.z as f32]).unwrap_or(fw))
            } else { match self.camara_ef() {
                1 if self.pill_camara(&mp.mundo, ojos, fw).is_some() => self.pill_camara(&mp.mundo, ojos, fw).unwrap(),
                1 => {
                    let d = [-fw[0], -fw[1], -fw[2]]; let l0 = 3.1 * kt;
                    let l = mp.mundo.rayo(ojos, d, l0 + 0.3).map(|h| (h.t - 0.3).max(0.3)).unwrap_or(l0);
                    ([ojos[0] + d[0] * l, ojos[1] + d[1] * l, ojos[2] + d[2] * l], fw)
                }
                2 => {
                    let pp = pitch * 0.6; let d = [yaw.sin() * pp.cos(), -pp.sin(), yaw.cos() * pp.cos()]; let l0 = 2.6 * kt;
                    let l = mp.mundo.rayo(ojos, d, l0 + 0.3).map(|h| (h.t - 0.3).max(0.3)).unwrap_or(l0);
                    let y2 = yaw + std::f32::consts::PI;
                    ([ojos[0] + d[0] * l, ojos[1] + d[1] * l, ojos[2] + d[2] * l], [y2.sin() * pp.cos(), pp.sin(), y2.cos() * pp.cos()])
                }
                _ => (ojos, fw),
            } };
            let (cam, mira) = jugabilidad::camara(&mut self.jg, cam, mira);
            // (el temblor de las explosiones)
            let cam = if self.temblor > 0.001 { let k = self.temblor * 0.06; [cam[0] + tj[0] * k, cam[1] + tj[1] * k, cam[2] + tj[2] * k] } else { cam };
            self.temblor = (self.temblor - dt * 1.5).max(0.0); if self.golpe_t > 0.0 { self.golpe_t -= dt; }
            let vista = m4::mirar(cam, [cam[0] + mira[0], cam[1] + mira[1], cam[2] + mira[2]], [0.0, 1.0, 0.0]);
            self.vr.ojos = vr_juego::ojos(&self.vr, &p, cam, mira);
            // (JX Turbo: en un cuadro intermedio no se arma la escena —el motor corre el último cuadro a esta cámara—; lo que avanza
            // con el tiempo y se salta —los NPC, los efectos— lo recupera el próximo real. Después de un salto de la cámara —más de
            // 75 cm o 25°: un cambio de vista, subir a un auto— va uno real)
            let tc = self.turbo_cam; let salto = (cam[0] - tc[0]).powi(2) + (cam[1] - tc[1]).powi(2) + (cam[2] - tc[2]).powi(2) > 0.5625
                || (mira[0] * tc[3] + mira[1] * tc[4] + mira[2] * tc[5]) / (mira[0] * mira[0] + mira[1] * mira[1] + mira[2] * mira[2]).sqrt().max(1e-6) < 0.906;
            let arma_vista = self.camara_ef() == 0 && !self.armas.zoom && self.vehs.jugador.is_none() && !self.jg.sin_hud() && !self.gmod_vista_propia();
            if turbo && !salto {
                let vpm = m4::mul(&p, &vista); self.vp_ult = vpm; self.turbo_vp = Some(vpm); self.turbo_dt += dt;
                // (el arma se mueve distinto que el mundo —el vaivén, apuntar—: el intermedio la corre con su propio movimiento,
                // de la raíz del último cuadro de verdad a la de ahora; si no, quedaba quieta y en el real saltaba: un fantasma)
                let aj = self.arma_aj_matriz();
                self.turbo_arma = match (arma_vista, self.arma_raiz, self.vista.as_ref()) {
                    (true, Some(w0), Some(v)) => Some(m4::mul(&v.raiz_aj(ojos, qcam(yaw, pitch), self.sway, self.armas.ap_k, aj), &m4::inv(&w0))),
                    _ => None,
                };
                // (JXM_TURBO_ARMA_FIJA, para comparar: como la 0.33 —el arma quieta en la pantalla—)
                if self.turbo_arma.is_some() && std::env::var_os("JXM_TURBO_ARMA_FIJA").is_some() { if let Some(vv) = m.vp_actual() { self.turbo_arma = Some(m4::mul(&m4::inv(&vpm), &vv)); } }
                break 'escena;
            }
            self.arma_raiz = None;
            self.turbo_cam = [cam[0], cam[1], cam[2], mira[0], mira[1], mira[2]]; let dt = dt + std::mem::take(&mut self.turbo_dt);
            // (con los ojos bajo el agua: la niebla de cerca, del color del agua —aguaNiebla—)
            let mut luz = mp.luz; jugabilidad::luz(&self.jg, &mut luz);
            let bajo_agua = self.jug.aguas.iter().any(|v| cam[1] < v[4] && cam[1] > v[1] && cam[0] >= v[0] && cam[0] <= v[3] && cam[2] >= v[2] && cam[2] <= v[5]);
            if bajo_agua {
                // (el color del agua del mapa —el de su material, en los de Source— más claro y la niebla más larga: como HL2, se ve lejos)
                let lin = |c: f32| c.max(0.0).powf(2.2);
                let base = mp.esc.c.agua.as_ref().map(|a| [a.fog[0], a.fog[1], a.fog[2]]).unwrap_or([lin(0.12), lin(0.285), lin(0.3)]);
                let y = base[0] * 0.2126 + base[1] * 0.7152 + base[2] * 0.0722; let cl = |c: f32| ((c * 0.7 + y * 0.3) * 1.35).min(0.6);
                luz.nie = jxmotor::escena::Niebla { c: [cl(base[0]), cl(base[1]), cl(base[2])], a: 0.0, b: 30.0, m: 1.0, s: [0.0; 3] };
            }
            // (las ondas: al moverse en el agua con la cabeza afuera —nadando o metido hasta la cintura—, una cada 0,22 s, más fuerte
            // cuanto más rápido; duran 3,5 s y quedan las 8 más nuevas)
            let ahora = self.t0.elapsed().as_secs_f32(); let jp = self.jug.pos;
            self.ondas.retain(|o| ahora - o[2] < 3.5);
            let rapidez = (self.jug.vel[0] * self.jug.vel[0] + self.jug.vel[2] * self.jug.vel[2]).sqrt();
            let en_sup = self.jug.aguas.iter().find(|v| jp[0] >= v[0] && jp[0] <= v[3] && jp[2] >= v[2] && jp[2] <= v[5] && cam[1] > v[4] - 0.15 && cam[1] - 1.75 < v[4]);
            if en_sup.is_some() && rapidez > 0.4 && ahora >= self.onda_t {
                self.ondas.push([jp[0], jp[2], ahora, 0.25 + (rapidez / 6.0).min(1.0) * 0.55]); self.onda_t = ahora + 0.22;
            }
            if self.ondas.len() > 8 { let sobra = self.ondas.len() - 8; self.ondas.drain(..sobra); }
            // (los props de los mapas del Workshop, hasta su distancia de desvanecido —más cerca en las calidades bajas—)
            let mut items = if mp.lejos_items.len() == mp.items.len() {
                let k = [0.5f32, 0.6, 0.75, 0.9, 1.0, 1.0][self.aj.calidad.min(5)];
                mp.items.iter().zip(&mp.lejos_items).filter(|(it, (c, f))| (*c <= 0.0 && *f <= 0.0) || { let (dx, dy, dz) = (it.esf[0] - cam[0], it.esf[1] - cam[1], it.esf[2] - cam[2]); let d2 = dx * dx + dy * dy + dz * dz; d2 >= (c * k) * (c * k) && (*f <= 0.0 || d2 < (f * k) * (f * k)) }).map(|(it, _)| it.clone()).collect()
            } else { mp.items.clone() };
            // (el cuerpo con el arma en la mano; sentado, en el asiento)
            if ver_cuerpo { if let Some(pj) = &self.pj { let jp = self.jug.pos; let b = pj.base_sentado().or_else(|| personajes::emotes_juego::base_escena(&self.pjs)).unwrap_or_else(|| personaje::base([jp[0], jp[1] - 0.95, jp[2]], self.jug.yaw)); if !self.gmp_items_jugador(&b, &mut items, cam, dt) { pj.items(&b, &mut items); } } }
            // (en primera persona, el arma delante de la cámara; y el rayo de la Physics Gun, de la boca a lo agarrado)
            let aj = self.arma_aj_matriz();
            if arma_vista { if let Some(v) = self.vista.as_mut() {
                if self.armas.ap_k > 0.002 && v.ads_tok != self.armas.ap_tok { v.calcular_ads(self.armas.ap_tok); }
                v.ubicar_aj(ojos, qcam(yaw, pitch), self.sway, self.armas.ap_k, aj); v.items(&mut items); self.arma_raiz = Some(v.raiz);
                // (las de diseño nuevo, pegadas a los huesos del arma; el eje de arriba de la base se elige una vez por arma: el
                // que más mira para arriba de la cámara)
                if let (true, Some(ae), Some(tp)) = (v.ocultar_arma, self.aero.as_ref(), jxjuego::armas_aero::Tipo::de(self.armas.def().n)) {
                    let (hb, hm) = tp.huesos();
                    if let (Some(b), Some(bm)) = (v.nodo_w(hb), v.nodo_w(hm)) {
                        // (la cámara: adelante, y arriba sin el balanceo)
                        let rt = { let r = [fw[2], 0.0, -fw[0]]; let l = (r[0] * r[0] + r[2] * r[2]).sqrt().max(1e-5); [r[0] / l, 0.0, r[2] / l] };
                        let cup = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]];
                        let cup = if cup[1] < 0.0 { [-cup[0], -cup[1], -cup[2]] } else { cup };
                        let n0 = items.len(); ae.items(tp, &b, &bm, ojos, fw, cup, self.t0.elapsed().as_secs_f32(), self.aero_abre, self.aero_tiro, &mut items);
                        if std::env::var_os("JXM_AERO_DBG").is_some() { eprintln!("aero {:?}: ojos {:?} base {:?} boca {:?} · {} piezas, la 1.ª en {:?}", tp, ojos, &b[12..15], &bm[12..15], items.len() - n0, items.get(n0).map(|i| i.esf)); }
                    }
                }
            } }
            self.proyectiles_items(&mut items);
            if let (Some(p1), Some(a), true) = (self.armas.punto_agarrado(&self.fis), self.armas.agarre.as_ref(), self.tubo_ok) {
                let p0 = self.vista.as_ref().filter(|_| self.camara_ef() == 0).and_then(|v| v.punta()).unwrap_or([ojos[0], ojos[1] - 0.2, ojos[2]]);
                let mid = [ojos[0] + fw[0] * a.dist * 0.5, ojos[1] + fw[1] * a.dist * 0.5, ojos[2] + fw[2] * a.dist * 0.5];
                let mat = if self.armas.def().jx.is_empty() { vista::TUBO_MAT } else { vista::TUBO_AMBAR };
                vista::rayo_items(p0, mid, p1, self.t0.elapsed().as_secs_f32(), mat, &mut items);
            }
            let t_fis = (self.acum_fis / PASO_FIS).clamp(0.0, 1.0);
            for o in &self.objs { if self.gmod_oculto(o) { continue; } if let Some(pf) = self.prefabs.get(&o.nombre) {
                // (los vehículos con sus ruedas y rotores girando)
                match o.cuerpo.and_then(|id| self.vehs.de(id)) { Some(v) => v.items(pf, &matriz_obj(o, t_fis), &mut items), None => pf.items(&matriz_obj(o, t_fis), &mut items) }
            } }
            // los NPC: su animación (sólo los que se ven) y lo que se dibuja
            let vpm = m4::mul(&p, &vista); self.vp_ult = vpm; self.med.pantalla = (wf, hf);
            self.npcs.animar(dt, cam, Some(&vpm), &self.fis); self.npcs.items(&mut items); self.gmp_items_npcs(&mut items, cam, dt); self.red_items(&mut items); self.mapas_items(&mut items); self.grieta_items(&mut items, cam, mira); self.jg_items(&mut items, cam); personajes::celu_juego::antes_items(&mut self.pjs.celu, self.ojos_ult, qcam(self.jug.yaw, self.jug.pitch), self.fov_b, wf / hf.max(1.0), self.sway); self.pjs_items(&mut items, cam, ver_cuerpo); self.gmod_items(ojos, yaw, pitch, &mut items);
            // los efectos: avanzan, y sus bloques (partículas, trazas, marcas) y sus luces —primero: GL2 usa 4—
            self.ef.calidad(self.aj.calidad.min(4)); self.ef.alto_px = hf; self.ef.paso(dt, efx::GRAV);
            self.jg.nuk.vol = m.hongo_listo(); let mut efectos = self.ef.bloques(&vpm, cam); self.jg_efectos(&mut efectos, &vpm, cam); self.agua_bloque(&mut efectos, &vpm, cam, &luz); if let Some(o) = &self.aguas.olas { efectos.push((jxmotor::escena::EF_OLAS, o.bloque())); }
            { let mut b = vec![if bajo_agua { 1.0 } else { 0.0 }, 0.0, 0.0, 0.0]; for o in &self.ondas { b.extend_from_slice(o); } efectos.push((jxmotor::escena::EF_ONDAS, b)); }
            // (Definitivo, en los mapas sin luz horneada: la luz global de las sondas —las de Source ya la traen horneada—)
            if self.aj.calidad == 5 && mp.esc.c.lms.is_empty() && !mp.mundo.t.is_empty() && std::env::var_os("JXM_SIN_GI").is_none() {
                let s = luz.sol; let l = (s[0] * s[0] + s[1] * s[1] + s[2] * s[2]).sqrt().max(1e-6);
                efectos.extend(self.gi.paso(&self.mapas[self.mapa_i], &mp.mundo.t, [self.jug.pos[0], self.jug.pos[1], self.jug.pos[2]], [s[0] / l, s[1] / l, s[2] / l]));
            }
            let mut luces = self.ef.luces(); luces.extend(mp.luces_cerca(ojos, 6));
            self.herramientas_items(&mut items, &mut luces); luces.truncate(8); self.jg_luces(&mut luces); self.pjs_luces(&mut luces, ojos);
            // (el piso de abajo de la cámara, para su reflejo en OpenGL 2: sólo si es casi plano)
            let suelo_y = jxjuego::persona::rayo_mundo(&mp.mundo, jugabilidad::v64(cam), [0.0, -1.0, 0.0], 30.0).filter(|h| h.1[1] > 0.9).map(|h| cam[1] - h.0 as f32);
            let c = Cuadro { vp: m4::mul(&p, &vista), pos: cam, luz, agua_y: mp.agua_y, suelo_y, tiempo: self.t0.elapsed().as_secs_f32(),
                luces, esp: self.jg_esp(cam, mira), items, efectos };
            marca(&mut self.perf, &mut self.perf_t, 3);
            m.poner_cuadro(c);
        } }
        let mut u = self.hud(w, h, placa_txt);
        unsafe { self.ini_hud(m, w, h, &mut u); }
        self.tut_hud(&mut u, w, h);
        let inter = match self.turbo_vp.take() { Some(vp) => m.intermedio(w, h, &vp, self.turbo_arma.take().as_ref(), &u), None => false };
        let r = if inter { Ok(()) } else if let (Some(o), true) = (self.vr.ojos, self.mapa.is_some() && self.vr.on) { m.dibujar_vr(w, h, &o, &u) } else { m.dibujar(w, h, self.mapa.is_some(), &u) };
        self.turbo_n = if inter { self.turbo_n + 1 } else { 0 }; self.fue_inter = inter; if inter { self.n_inter += 1; }
        marca(&mut self.perf, &mut self.perf_t, 4);
        r
    }

    /// ¿ya llegó la luz global? (las pruebas)
    pub fn gi_listo(&self) -> bool { self.gi.actual.is_some() }
    /// una onda en el agua (x, z, fuerza), como la que deja algo que cae (las pruebas)
    pub fn onda(&mut self, x: f32, z: f32, fuerza: f32) { let t = self.t0.elapsed().as_secs_f32(); self.ondas.push([x, z, t, fuerza]); }
    fn azar(&mut self) -> f32 { self.azar ^= self.azar << 13; self.azar ^= self.azar >> 17; self.azar ^= self.azar << 5; (self.azar % 10000) as f32 / 10000.0 }
    /// de qué es el piso: por ahora el del mapa (pasto en gm_flatgrass, hormigón en gm_construct); con el triángulo que
    /// se pisa cuando el mundo lo diga
    fn piso(&self) -> &'static str { if self.mapas[self.mapa_i].contains("Flatgrass") { "grass" } else { "concrete" } }
    /// los sonidos del jugador este cuadro (sonPasos de sonidos.js y los del agua de agua.js)
    fn sonidos(&mut self, dt: f32, ojos: [f32; 3], ent: &Entrada) {
        self.sonido.oyente = (ojos, self.jug.yaw);
        self.med_paso(dt);
        // (la voz por cercanía: el micrófono, las voces de los demás desde su lugar)
        self.vz_paso(dt);
        if !self.sonido.suena() || self.mapa.is_none() { return; }
        // el sonido espacial (acustica.rs): dos de los 14 rayos por cuadro miden el lugar y, en cada vuelta, sale el ambiente
        // (su reverberación y su eco); lo tapado por una pared de los sonidos nuevos (hasta 4 por cuadro) y, cada medio
        // segundo, el de los bucles; y la cabeza con el oyente de ahora
        self.sonido.espacial = self.aj.espacial;
        if self.sonido.espacial { if let Some(mp) = self.mapa.as_ref() {
            let dirs = crate::acustica::direcciones();
            for _ in 0..2 {
                let k = self.acu_i % 14; self.acu_d[k] = mp.mundo.rayo(ojos, dirs[k], crate::acustica::LEJOS).map(|g| g.t).unwrap_or(crate::acustica::LEJOS); self.acu_i += 1;
                if self.acu_i % 14 == 0 {
                    let agua = self.jug.aguas.iter().any(|v| ojos[1] < v[4] && ojos[1] > v[1] && ojos[0] >= v[0] && ojos[0] <= v[3] && ojos[2] >= v[2] && ojos[2] <= v[5]);
                    let (n, s) = crate::acustica::ambiente(&crate::acustica::Medida { d: self.acu_d, agua, auto: self.vehs.jugador.is_some() }); self.sonido.poner_sala(n, s);
                }
            }
            for (id, d) in self.sonido.para_ocluir(4) {
                let v = [d[0] - ojos[0], d[1] - ojos[1], d[2] - ojos[2]]; let dist = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
                let f = if dist < 0.6 { 0.0 } else { match mp.mundo.rayo(ojos, [v[0] / dist, v[1] / dist, v[2] / dist], dist) { Some(g) if g.t < dist - 0.4 => 1.0, _ => 0.0 } };
                self.sonido.ocluir(id, f);
            }
        } self.acu_t += dt; if self.acu_t > 0.5 { self.acu_t = 0.0; self.sonido.reocluir(); } self.sonido.actualizar(); }
        // el ambiente (sonAmbiente): los mapas de GMod son «campo» —el viento y, cada 4 a 14 s, un pájaro entre 15 y 40 m—;
        // bajo el agua, nada
        let bajo = self.jug.aguas.iter().any(|v| ojos[1] < v[4] && ojos[1] > v[1] && ojos[0] >= v[0] && ojos[0] <= v[3] && ojos[2] >= v[2] && ojos[2] <= v[5]);
        if !bajo && self.aj.ambiente {
            self.sonido.bucle("amb", "AM_viento1", 0.16);
            self.amb_t -= dt;
            if self.amb_t <= 0.0 {
                self.amb_t = 4.0 + self.azar() * 10.0;
                let (a, r) = (self.azar() * std::f32::consts::TAU, 15.0 + self.azar() * 25.0); let alto = 2.0 + self.azar() * 8.0;
                let n = if self.azar() < 0.5 { format!("AM_ave{}", 1 + (self.azar() * 7.0) as u32) } else { format!("AM_pajaro{}", 1 + (self.azar() * 6.0) as u32) };
                let tono = 0.95 + self.azar() * 0.1;
                self.sonido.tocar(&n, 0.4, tono, Some([ojos[0] + a.cos() * r, ojos[1] + alto, ojos[2] + a.sin() * r]));
            }
        }
        // (sosteniendo algo con la Physics Gun o la Gravity Gun: su zumbido)
        if let Some(s) = self.armas.sosten() { self.sonido.bucle("sosten", s, 0.35); }
        // (los motores de los vehículos prendidos y el cohete de la bici)
        for b in self.vehs.bucles(&self.fis) { self.sonido.bucle(&b.clave, b.nombre, b.vol as f32); }
        // (la bocina mientras se aprieta: sintetizada como en la web, bocina_pcm; la bici, su timbre)
        if let Some((tipo, _)) = self.vehs.bocina(&self.fis, self.apretado(Boton::Bocina)) {
            let n = format!("JX_bocina_{tipo}"); self.sonido.sintetico(&n, || veh::bocina_pcm(tipo, 44100), 44100); self.sonido.bucle("bocina", &n, 1.0);
        }
        self.sonido.fin_bucles();
        let (suelo, nada, noclip, agua) = (self.jug.suelo, self.jug.nada, self.jug.noclip, self.jug.nada || self.jug.hondo > 0.25);
        let (saltos, ahogos) = (self.jug.saltos, self.jug.ahogos);
        let sp = (self.jug.vel[0] * self.jug.vel[0] + self.jug.vel[2] * self.jug.vel[2]).sqrt(); let vy = self.jug.vel[1];
        // (al saltar suena el paso, como en HL2; al caer, un paso fuerte y el golpe del cuerpo —de muy alto, el quejido—)
        if saltos != self.saltos_vistos { self.saltos_vistos = saltos; let n = format!("PS_{}{}", self.piso(), 1 + (self.azar() * 4.0) as u32); self.sonido.tocar(&n, 0.75 * 0.62, 1.0, None); }
        let g = std::mem::take(&mut self.golpe_max);
        if g > 6.0 { let n = format!("PL_golpe{}", 1 + (self.azar() * 3.0) as u32); self.sonido.tocar(&n, (g / 18.0).min(0.8), 1.0, None); }
        if g > 11.0 { let n = format!("PL_caida{}", 1 + (self.azar() * 2.0) as u32); self.sonido.tocar(&n, 0.7, 1.0, None); }
        if ahogos != self.ahogos_vistos { self.ahogos_vistos = ahogos; let n = format!("AG_Ahogo{}", 1 + (self.azar() * 3.0) as u32); self.sonido.tocar(&n, 0.7, 1.0, None); }
        // (el chapuzón al entrar al agua cayendo)
        if nada && !self.nadaba && vy < -1.0 { let n = format!("AG_Salpica{}", 1 + (self.azar() * 3.0) as u32); self.sonido.tocar(&n, ((-vy) / 12.0).clamp(0.3, 1.0), 1.0, None); }
        self.nadaba = nada;
        // nadando: las brazadas al moverse
        if nada { self.brazada_t -= dt; if (ent.x.abs() + ent.y.abs()) > 0.2 && self.brazada_t <= 0.0 { self.brazada_t = 0.85; let n = format!("AG_Paso{}", 1 + (self.azar() * 8.0) as u32); let tono = 0.95 + self.azar() * 0.1; self.sonido.tocar(&n, 0.45, tono, None); } return; }
        let en_suelo = suelo && !noclip;
        if en_suelo && self.aire_t > 0.3 && self.vy_aire < -3.0 { let n = format!("PS_{}{}", self.piso(), 1 + (self.azar() * 4.0) as u32); self.sonido.tocar(&n, (0.35 - self.vy_aire / 14.0).min(1.0) * 0.62, 1.0, None); self.paso_d = 0.0; }
        if !en_suelo { self.aire_t += dt; self.vy_aire = vy; return; }
        self.aire_t = 0.0;
        if sp < 0.4 { self.paso_d = self.paso_d.min(0.4); return; }
        // (el paso se alarga con la velocidad: 0,72 m caminando, 1,5 m corriendo)
        let l = (0.72 + 0.17 * (sp - 1.4).max(0.0)).min(1.6); self.paso_d += sp * dt;
        if self.paso_d >= l {
            self.paso_d -= l;
            let base = if agua { format!("AG_Paso{}", 1 + (self.azar() * 8.0) as u32) } else { format!("PS_{}{}", self.piso(), 1 + (self.azar() * 4.0) as u32) };
            let vol = (sp / 6.0).clamp(0.35, 0.8) * if self.jug.agachado { 0.45 } else { 1.0 } * 0.62; let tono = 0.94 + self.azar() * 0.12;
            self.sonido.tocar(&base, vol, tono, None);
        }
    }

    /// el atlas de íconos de la subcategoría abierta (se arma al abrirla)
    fn menu_atlas(&mut self, m: &mut Motor3d) {
        let Some(mm) = self.menu.as_ref() else { return };
        if mm.pestana == PESTANA_HER || (mm.atlas_de == Some((mm.pestana, mm.sub)) && mm.atlas_q == mm.q) { return; }
        // (los íconos de lo que se ve: la categoría elegida o lo buscado)
        let items = self.mo_items(); let Some(paq) = self.paq.as_ref() else { return };
        let n = items.len() as u32; let filas = n.div_ceil(ICO_COLS).max(1); let (aw, ah) = (1024u32, (filas * ICO).next_power_of_two());
        let mut px = vec![0u8; (aw * ah * 4) as usize];
        for (k, it) in items.iter().enumerate() {
            // (los NPC: el ícono de su skin)
            let Some(ic) = objetos::icono(paq, npc::skin_de_item(it).unwrap_or(it), ICO) else { continue };
            let (cx, cy) = ((k as u32 % ICO_COLS) * ICO, (k as u32 / ICO_COLS) * ICO);
            for y in 0..ICO { let d = (((cy + y) * aw + cx) * 4) as usize; let s = ((y * ICO) * 4) as usize; px[d..d + (ICO * 4) as usize].copy_from_slice(&ic[s..s + (ICO * 4) as usize]); }
        }
        let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![], texs: vec![Tex { id: TEX_ICONOS, n: "iconos".into(), w: aw, h: ah, a: 1, o: 0 }], lms: vec![], items: vec![], agua: None, cielo: None };
        let _ = unsafe { m.cargar(&Escena { c: cab, datos: px }) };
        if let Some(mm) = self.menu.as_mut() { mm.atlas_de = Some((mm.pestana, mm.sub)); mm.atlas_h = ah; mm.atlas_q = mm.q.clone(); }
    }
    /// pone un objeto donde mira el jugador (o 6 m adelante), mirándolo y apoyado en el piso (spawnDelante y crearObjeto)
    pub fn poner(&mut self, m: &mut Motor3d, nombre: &str, ojos: [f32; 3], fw: [f32; 3]) -> Result<(), String> {
        if self.jg_poner(nombre) { return Ok(()); }
        // un NPC (spawnNpc): su skin cargada una vez, puesto donde se mira
        if let Some(skin) = npc::skin_de_item(nombre) {
            let Some(paq) = self.paq.as_mut() else { return Ok(()) };
            let (c, e) = self.npc_skins.pedir(paq, skin, &mut self.pj_cargados)?;
            if let Some(e) = e { unsafe { m.cargar(&e)?; } }
            let Some(mp) = self.mapa.as_ref() else { return Ok(()) };
            let (p, yaw) = npc::donde_poner(&mp.mundo, &mut self.fis, ojos, fw);
            match self.npcs.crear(c, p, yaw, None, &mut self.fis) { Some(id) => { self.pila.push((true, id)); self.npc_skin = skin.to_string(); self.avisar(format!("Puesto: {}", npc::skin_nom(skin))); } None => self.avisar(format!("Ya hay {} NPC (el máximo)", self.npcs.max)) }
            return Ok(());
        }
        let Some(mp) = self.mapa.as_ref() else { return Ok(()) };
        // (el rayo ve el mapa y los objetos: mirando uno, el nuevo se pone arriba)
        let (o64, d64) = ([ojos[0] as f64, ojos[1] as f64, ojos[2] as f64], [fw[0] as f64, fw[1] as f64, fw[2] as f64]);
        let p = match self.fis.rayo(&mp.mundo, o64, d64, 40.0, &[]) { Some(g) => { let t = (g.t as f32 - 0.05).max(0.5); [ojos[0] + fw[0] * t, ojos[1] + fw[1] * t, ojos[2] + fw[2] * t] }
            None => { let mut q = [ojos[0] + fw[0] * 6.0, ojos[1] + fw[1] * 6.0, ojos[2] + fw[2] * 6.0]; if let Some(g) = mp.mundo.rayo(q, [0.0, -1.0, 0.0], 50.0) { q[1] -= g.t; } q } };
        let giro = self.jug.yaw + std::f32::consts::PI; let q = [0.0, (giro / 2.0).sin(), 0.0, (giro / 2.0).cos()];
        self.crear(m, nombre, p, q, false, self.poner_congelado).map(|_| ())
    }
    /// crea un objeto con su base en `p`, girado `giro` alrededor de Y (crearObjeto): con forma de choque, un cuerpo de la
    /// física; sin forma, fijo
    pub fn crear_en(&mut self, m: &mut Motor3d, nombre: &str, p: [f32; 3], giro: f32) -> Result<(), String> {
        let q = [0.0, (giro / 2.0).sin(), 0.0, (giro / 2.0).cos()];
        self.crear(m, nombre, p, q, false, false).map(|_| ())
    }
    /// crearObjeto: con su base en `p` (o, `exacto`, con la raíz del modelo en `p`), girado `q`, y congelado si se pide;
    /// devuelve dónde quedó en la lista
    pub fn crear(&mut self, m: &mut Motor3d, nombre: &str, p: [f32; 3], q: [f32; 4], exacto: bool, congelado: bool) -> Result<Option<usize>, String> {
        let Some(paq) = self.paq.as_mut() else { return Ok(None) };
        if !self.prefabs.contains_key(nombre) {
            let (pf, esc) = objetos::armar(paq, &self.nombres, nombre, 512, &mut self.cargados)?;
            unsafe { m.cargar(&esc)?; }
            self.prefabs.insert(nombre.to_string(), pf);
        }
        let pf = &self.prefabs[nombre];
        let id_obj = self.sig_id; self.sig_id += 1;
        let fisico = self.cat_fis.as_mut().and_then(|c| c.prefab(paq, nombre));
        if let Some(pfz) = fisico {
            let mut b = forma::cuerpo_de_prefab(&pfz, [p[0] as f64, p[1] as f64, p[2] as f64], [q[0] as f64, q[1] as f64, q[2] as f64, q[3] as f64], exacto);
            if congelado { b.congelado = true; }
            let (bp, bq) = ([b.pos[0] as f32, b.pos[1] as f32, b.pos[2] as f32], [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32]);
            let masa = b.masa as f32; let id = self.fis.agregar(b);
            self.aguas.registrar(id, Flota::de_prefab(&pfz));
            if pfz.tipo == "vehiculo" { self.vehs.agregar(paq, &pfz, id, &mut self.fis, Some(&mut self.aguas)); }
            let ci = pfz.cap_q.map(|c| [-c[0] as f32, -c[1] as f32, -c[2] as f32, c[3] as f32]).unwrap_or([0.0, 0.0, 0.0, 1.0]);
            self.objs.push(Obj { nombre: nombre.to_string(), pos: bp, q: bq, c: [pfz.c[0] as f32, pfz.c[1] as f32, pfz.c[2] as f32], cuerpo: Some(id), cap_inv: ci, ant: (bp, bq), masa, id: id_obj, logica: None, log_base: None,
                tipo: pfz.tipo, vida: if pfz.tipo == "explota" || pfz.tipo == "interactivo" { 1.0 } else { 0.0 }, exploto: false });
        } else {
            // (sin forma: fijo, con lo más bajo de su caja en el piso)
            let pp = [p[0], p[1] - pf.caja[1] + 0.01, p[2]];
            self.objs.push(Obj { nombre: nombre.to_string(), pos: pp, q, c: [0.0; 3], cuerpo: None, cap_inv: [0.0, 0.0, 0.0, 1.0], ant: (pp, q), masa: 0.0, id: id_obj, logica: None, log_base: None, tipo: "prop", vida: 0.0, exploto: false });
        }
        self.avisar(format!("Puesto: {nombre}"));
        let id_n = self.objs.last().map(|o| o.id).unwrap_or(0); self.pila.push((false, id_n));
        Ok(Some(self.objs.len() - 1))
    }

    /// el HUD: los vértices de la interfaz (8 floats cada uno)
    fn hud(&self, w: i32, h: i32, placa_txt: &str) -> Vec<(i64, Vec<f32>)> {
        let (wf, hf) = (w as f32, h as f32);
        let Some(l) = &self.letras else { return vec![] };
        if self.pjs.prueba_sin_hud { return vec![]; }
        let mut ic: Vec<f32> = vec![]; let mut ia: Vec<f32> = vec![];
        let mut u = vec![]; let t = hf * 0.032; let bl = [1.0, 1.0, 1.0, 1.0];
        let usa = self.en_uso;
        let gm_tex = self.gmod_hud(l, &mut u, wf, hf, t);
        self.jg_hud_fondo(l, &mut u, wf, hf);
        if self.aj.fps && !self.ed.activo && self.menu.is_none() && self.ajustes.is_none() && !self.ini.pz.abierta && self.ini.panel.is_none() {
            // (debajo de los botones de arriba a la izquierda; en el editor no, que ahí va su ayuda)
            let y0 = hud_web::bajo_izq(wf, hf);
            let re = self.aj.res_efectiva() as f32 / 100.0 * self.drs; let (ew, eh) = ((wf * re).round(), (hf * re).round());
            l.texto_sombra(&mut u, t * 0.5, y0 + t * 0.5, t, bl, &format!("{:.0} fps · cuadro {:.1} ms · placa {:.1} ms · {}×{}", self.fps, self.ms, self.placa_ms, ew, eh));
            l.texto_sombra(&mut u, t * 0.5, y0 + t * 1.75, t * 0.7, [1.0, 1.0, 1.0, 0.85], &format!("JXMod nativo (Rust) · {} · {}{} · {}", usa.nombre(), self.calidad_txt(), if self.drs < 1.0 { format!(" · dinámica {:.0} %", self.drs * 100.0) } else { String::new() }, placa_txt));
            l.texto_sombra(&mut u, t * 0.5, y0 + t * 2.7, t * 0.7, [1.0, 1.0, 1.0, 0.85], &format!("{} · {} · vida {:.0}", self.mapas[self.mapa_i], if self.jug.noclip { "volando" } else if self.jug.nada { "nadando" } else if self.jug.suelo { "en el piso" } else { "en el aire" }, self.jug.vida));
            // (lo que tarda cada parte en la CPU: para ver dónde se va el cuadro en el celular)
            let pf = self.perf; let no = if self.detalle.is_empty() { 3.65 } else { 4.5 };
            l.texto_sombra(&mut u, t * 0.5, y0 + t * no, t * 0.6, [1.0, 1.0, 1.0, 0.75], &format!("cpu ms: jugador {:.2} · física {:.2} ({} objetos) · NPC {:.2} ({}) · juego {:.2} · motor {:.2}", pf[0], pf[1], self.objs.len(), pf[2], self.npcs.lista.len(), pf[3], pf[4]));
            if !self.detalle.is_empty() { l.texto_sombra(&mut u, t * 0.5, y0 + t * 3.65, t * 0.6, [1.0, 1.0, 1.0, 0.75], &format!("placa: {}", self.detalle)); }
        }
        // (los botones, como los de la web: hud_web.rs; con un menú abierto, ninguno —quedarían debajo del panel—)
        let abierto = self.pjs.panel.is_some() || self.menu.is_some() || self.ajustes.is_some() || self.npc_panel.is_some() || self.en_red.panel || self.emotes_panel || self.ini.pz.abierta || self.ini.panel.is_some();
        let mut ih = self.hud_botones(l, &mut u, &mut ia, wf, hf, abierto);
        // (lo que dicen los NPC: un globo arriba de la cabeza, npcGloboPaso)
        if !abierto { for n in &self.npcs.lista {
            let (Some((txt, _)), true) = (&n.globo, n.visible) else { continue };
            let g = n.globo_pos(); let v = &self.vp_ult;
            let cw = v[3] * g[0] + v[7] * g[1] + v[11] * g[2] + v[15]; if cw < 0.1 { continue; }
            let (cx, cy) = ((v[0] * g[0] + v[4] * g[1] + v[8] * g[2] + v[12]) / cw, (v[1] * g[0] + v[5] * g[1] + v[9] * g[2] + v[13]) / cw);
            let (sx, sy) = ((cx * 0.5 + 0.5) * wf, (0.5 - cy * 0.5) * hf); let tt = t * 0.7; let an = l.ancho(tt, txt).min(wf * 0.4);
            l.caja(&mut u, sx - an / 2.0 - tt * 0.5, sy - tt * 1.6, an + tt, tt * 1.5, tt * 0.4, [1.0, 1.0, 1.0, 0.92]);
            l.texto(&mut u, sx - an / 2.0, sy - tt * 1.35, tt, [0.0, 0.0, 0.0, 1.0], txt);
        } }
        // (los demás jugadores: su nombre y lo que escriben)
        if !abierto { self.red_hud(l, &mut u, wf, hf, t); self.vz_hud(l, &mut u, wf, t); }
        // (la vida, abajo a la izquierda como la de la web —#vida—: la barra roja sobre el fondo oscuro, el corazón y el
        // número; 150 × 18 px a 1080 de alto)
        if !abierto && self.mapa.is_some() && !self.jg.sin_hud() {
            // (de vidrio líquido: la cápsula de vidrio flotando en la esquina y adentro la barra roja redondeada)
            let hk = hud_web::kb(wf, hf) * hud_web::tam() / 0.559; let cc = hud_web::css(wf, hf); let (bw, bh) = (150.0 * hk, (18.0 * hk).max(14.0 * cc));
            let m = 5.0 * cc; let (gx, gy, gw, gh) = (6.0 * cc, hf - bh - 2.0 * m - 6.0 * cc, bw + 2.0 * m, bh + 2.0 * m); let (x, y) = (gx + m, gy + m);
            let fr = (self.jug.vida / 100.0).clamp(0.0, 1.0);
            hud_web::pieza9(&mut ih, "vl_caja", gx, gy, gw, gh, [1.0; 4]);
            l.caja(&mut u, x, y, bw, bh, bh * 0.3, [0.35, 0.06, 0.06, 0.55]); if fr > 0.0 { l.caja(&mut u, x, y, (bw * fr).max(bh * 0.6), bh, bh * 0.3, [0.92, 0.22, 0.22, 0.92]); l.caja(&mut u, x + bh * 0.2, y + 1.0, ((bw * fr).max(bh * 0.6) - bh * 0.4).max(0.0), bh * 0.35, bh * 0.15, [1.0, 1.0, 1.0, 0.22]); }
            // (el corazón: dos círculos y la punta hecha de franjas)
            let (cx, cy, r) = (x + bh * 0.55, y + bh * 0.42, bh * 0.17);
            l.disco(&mut u, cx - r * 0.95, cy, r, bl); l.disco(&mut u, cx + r * 0.95, cy, r, bl);
            for i in 0..4 { let f = i as f32 / 4.0; let a = r * 2.0 * (1.0 - f); l.caja(&mut u, cx - a, cy + r * 0.1 + f * r * 1.6, a * 2.0, r * 0.45, 0.0, bl); }
            let v = format!("{:.0}", self.jug.vida.max(0.0)); let tv = bh * 0.62; let an = l.ancho(tv, &v);
            l.texto(&mut u, x + bw - an - bh * 0.45, y + (bh - tv) / 2.0 - hf * 0.003, tv, bl, &v);
        }
        // (la mira del francotirador: todo negro menos un círculo, con la cruz; y el rojo cuando a uno le pegan)
        if self.armas.zoom && self.camara == 0 {
            let r = hf * 0.46; let (cx, cy) = (wf / 2.0, hf / 2.0); let ng = [0.0, 0.0, 0.0, 1.0];
            l.caja(&mut u, 0.0, 0.0, cx - r, hf, 0.0, ng); l.caja(&mut u, cx + r, 0.0, wf - cx - r, hf, 0.0, ng);
            for k in 0..64 { let y0 = cy - r + k as f32 * r * 2.0 / 64.0; let y1 = y0 + r * 2.0 / 64.0; let ym = (y0 + y1) / 2.0 - cy; let a = (r * r - ym * ym).max(0.0).sqrt();
                l.caja(&mut u, cx - r, y0, r - a, y1 - y0 + 0.5, 0.0, ng); l.caja(&mut u, cx + a, y0, r - a, y1 - y0 + 0.5, 0.0, ng); }
            l.caja(&mut u, cx - r, cy - 1.0, r * 2.0, 2.0, 0.0, [0.0, 0.0, 0.0, 0.85]); l.caja(&mut u, cx - 1.0, cy - r, 2.0, r * 2.0, 0.0, [0.0, 0.0, 0.0, 0.85]);
        }
        if self.golpe_t > 0.0 { l.caja(&mut u, 0.0, 0.0, wf, hf, 0.0, [0.7, 0.0, 0.0, (self.golpe_t / 0.4 * 0.35).min(0.35)]); }
        // (la mira de la web —#mira—: una cruz blanca de 14 px con su sombrita)
        if !abierto && self.mapa.is_some() && !self.jg.sin_hud() {
            let c = hud_web::css(wf, hf); let (cx, cy) = (wf / 2.0, hf / 2.0); let (la, gr) = (14.0 * c, 2.0 * c);
            for (e, col) in [(1.0 * c, [0.0, 0.0, 0.0, 0.35]), (0.0, [1.0, 1.0, 1.0, 0.9])] {
                l.caja(&mut u, cx - la / 2.0 - e, cy - gr / 2.0 - e, la + 2.0 * e, gr + 2.0 * e, 0.0, col); l.caja(&mut u, cx - gr / 2.0 - e, cy - la / 2.0 - e, gr + 2.0 * e, la + 2.0 * e, 0.0, col);
            }
        }
        // (el aire, con los ojos bajo el agua: una barra que se vacía)
        if self.jug.aire < 11.99 && self.menu.is_none() {
            let (bw, bh) = (wf * 0.22, hf * 0.025); let (x, y) = ((wf - bw) / 2.0, hf * 0.86);
            l.caja(&mut u, x, y, bw, bh, bh * 0.5, [0.0, 0.0, 0.0, 0.5]);
            l.caja(&mut u, x, y, bw * (self.jug.aire / 12.0).clamp(0.0, 1.0), bh, bh * 0.5, [0.45, 0.75, 1.0, 0.9]);
            l.texto_sombra(&mut u, x, y - t * 0.85, t * 0.65, bl, "Aire");
        }
        // (grabando: un punto rojo que titila y «REC» arriba al medio)
        if self.grabando && !self.vr.on {
            let on = (self.t0.elapsed().as_secs_f32() * 2.0) as u32 % 2 == 0; let tt = t * 0.9; let an = l.ancho(tt, "REC"); let x = (wf - an) / 2.0 + tt * 0.4;
            if on { l.caja(&mut u, x - tt * 0.95, hf * 0.025 + tt * 0.2, tt * 0.6, tt * 0.6, tt * 0.3, [0.95, 0.12, 0.1, 0.95]); }
            l.texto_sombra(&mut u, x, hf * 0.025, tt, bl, "REC");
        }
        if self.mapa.is_none() && self.recargar && self.error.is_none() {
            let txt = format!("Cargando {}…", jxjuego::identidad::nombre_mapa(&self.mapas[self.mapa_i])); let tt = t * 1.3; let an = l.ancho(tt, &txt);
            l.texto_sombra(&mut u, (wf - an) / 2.0, hf * 0.47, tt, bl, &txt);
        }
        // el menú de objetos: las subcategorías a la izquierda, la grilla con los íconos y los nombres
        if let (Some(mm), None) = (&self.menu, self.ini.rec.atlas.as_ref()) {
            let her = mm.pestana == PESTANA_HER; let cat = self.cat(mm.pestana);
            let p = panel(wf, hf, if her { self.her.lista.len() } else { cat.len() });
            l.caja(&mut u, p.x0, p.y0, p.pw, p.ph, hf * 0.03, [0.07, 0.08, 0.11, 0.94]);
            // (las pestañas de arriba: Props y Herramientas)
            for (k, n) in PESTANAS_MENU.iter().enumerate() {
                let (bx, bw) = pestana_menu(&p, hf, k); let sel = k == mm.pestana;
                l.caja(&mut u, bx, p.y0 + hf * 0.012, bw, hf * 0.06, hf * 0.015, if sel { [0.95, 0.66, 0.1, 0.92] } else { [1.0, 1.0, 1.0, 0.1] });
                let an = l.ancho(t * 0.8, n); l.texto(&mut u, bx + (bw - an) / 2.0, p.y0 + hf * 0.024, t * 0.8, if sel { [0.0, 0.0, 0.0, 1.0] } else { bl }, n);
            }
            l.caja(&mut u, p.x0 + p.pw - hf * 0.09, p.y0 + hf * 0.012, hf * 0.07, hf * 0.06, hf * 0.015, [0.6, 0.15, 0.12, 0.95]);
            { let an = l.ancho(t * 0.9, "X"); l.texto(&mut u, p.x0 + p.pw - hf * 0.055 - an / 2.0, p.y0 + hf * 0.02, t * 0.9, bl, "X"); }
            if her { self.dibujar_inspector(l, &mut u, &p, wf, hf, t); }
            else { for (k, (n, _)) in cat.iter().enumerate() {
                let y = p.y0 + hf * 0.08 + k as f32 * p.tab_h; let sel = k == mm.sub;
                l.caja(&mut u, p.x0 + hf * 0.015, y, p.gx - p.x0 - hf * 0.04, p.tab_h - hf * 0.008, hf * 0.012, if sel { [0.95, 0.66, 0.1, 0.92] } else { [1.0, 1.0, 1.0, 0.08] });
                let tt = (p.tab_h * 0.5).min(t * 0.75); l.texto(&mut u, p.x0 + hf * 0.035, y + (p.tab_h - tt) / 2.0 - hf * 0.004, tt, if sel { [0.0, 0.0, 0.0, 1.0] } else { bl }, n);
            }
            if let Some((_, items)) = cat.get(mm.sub) {
                let (aw, ah) = (1024.0f32, mm.atlas_h.max(1) as f32);
                for (k, it) in items.iter().enumerate() {
                    let (col, fila) = (k % p.cols, k / p.cols);
                    let (x, y) = (p.gx + col as f32 * p.celda, p.gy + fila as f32 * p.celda - mm.scroll);
                    if y + p.celda < p.gy || y > p.gy + p.gh { continue; }
                    l.caja(&mut u, x + 3.0, y + 3.0, p.celda - 6.0, p.celda - 6.0, hf * 0.012, [1.0, 1.0, 1.0, 0.07]);
                    let tt = (p.celda * 0.12).min(t * 0.6); let nom: String = npc::skin_de_item(it).map(npc::skin_nom).unwrap_or_else(|| self.jg.nombre_item(it)).chars().take(16).collect(); let an = l.ancho(tt, &nom);
                    l.texto(&mut u, x + (p.celda - an) / 2.0, y + p.celda - tt * 1.5, tt, [1.0, 1.0, 1.0, 0.9], &nom);
                    if mm.atlas_de == Some((mm.pestana, mm.sub)) {
                        let (cx, cy) = ((k as u32 % ICO_COLS) * ICO, (k as u32 / ICO_COLS) * ICO); let lado = p.celda - tt * 2.2;
                        rect_uv(&mut ic, x + (p.celda - lado) / 2.0, y + 4.0, lado, lado - 4.0, [cx as f32 / aw, cy as f32 / ah, (cx + ICO) as f32 / aw, (cy + ICO) as f32 / ah], [1.0; 4]);
                    }
                }
            } }
        }
        // Ajustes: las pestañas a la izquierda y un renglón por cosa, con sus valores para tocar
        if let Some(pe) = self.ajustes {
            let p = panel(wf, hf, ajustes::PESTANAS.len());
            l.caja(&mut u, p.x0, p.y0, p.pw, p.ph, hf * 0.03, [0.07, 0.08, 0.11, 0.94]);
            l.texto(&mut u, p.x0 + hf * 0.03, p.y0 + hf * 0.02, t * 0.9, bl, &format!("Ajustes · {} · en pausa", ajustes::PESTANAS[pe]));
            l.caja(&mut u, p.x0 + p.pw - hf * 0.09, p.y0 + hf * 0.012, hf * 0.07, hf * 0.06, hf * 0.015, [0.6, 0.15, 0.12, 0.95]);
            { let an = l.ancho(t * 0.9, "X"); l.texto(&mut u, p.x0 + p.pw - hf * 0.055 - an / 2.0, p.y0 + hf * 0.02, t * 0.9, bl, "X"); }
            for (k, n) in ajustes::PESTANAS.iter().enumerate() {
                let y = p.y0 + hf * 0.08 + k as f32 * p.tab_h; let sel = k == pe;
                l.caja(&mut u, p.x0 + hf * 0.015, y, p.gx - p.x0 - hf * 0.04, p.tab_h - hf * 0.008, hf * 0.012, if sel { [0.95, 0.66, 0.1, 0.92] } else { [1.0, 1.0, 1.0, 0.08] });
                let tt = (p.tab_h * 0.5).min(t * 0.75); l.texto(&mut u, p.x0 + hf * 0.035, y + (p.tab_h - tt) / 2.0 - hf * 0.004, tt, if sel { [0.0, 0.0, 0.0, 1.0] } else { bl }, n);
            }
            let claves = ajustes::claves(pe);
            for (f, c) in claves.iter().enumerate() {
                let vals = self.valores_aj(*c); let el = self.elegido_aj(*c); let cajas = cajas_de(*c, &p, hf, f, vals.len());
                let fh = hf * 0.105; let y = p.gy + f as f32 * fh; let tt = t * 0.75;
                let nom = if *c == Clave::Calidad && self.aj.calidad == ajustes::PERSONAL { "Calidad (personal)".to_string() } else { ajustes::nombre(*c).to_string() };
                if *c != Clave::Mapa { l.texto(&mut u, p.gx, y + (fh - tt) / 2.0 - hf * 0.004, tt, bl, &nom); }
                for (k, (v, b)) in vals.iter().zip(cajas).enumerate() {
                    let sel = el == Some(k);
                    l.caja(&mut u, b.0, b.1, b.2, b.3, hf * 0.012, if sel { [0.95, 0.66, 0.1, 0.92] } else { [1.0, 1.0, 1.0, 0.1] });
                    let mut ts = tt * 0.9; while l.ancho(ts, v) > b.2 - 6.0 && ts > tt * 0.4 { ts *= 0.9; }
                    let an = l.ancho(ts, v); l.texto(&mut u, b.0 + (b.2 - an) / 2.0, b.1 + (b.3 - ts) / 2.0 - hf * 0.004, ts, if sel { [0.0, 0.0, 0.0, 1.0] } else { bl }, v);
                }
            }
            // (una nota abajo: lo que no usa OpenGL 2, o qué cambia el motor)
            let nota = match pe {
                0 if self.en_uso == Placa::Gl2 => "OpenGL 2 no tiene oclusión ambiental: las sombras y el reflejo del agua, desde Medio",
                0 => "Patata y Bajo: sin sombras · Medio: sombras de 1024 cada 2 cuadros · Ultra: todo, con oclusión",
                3 => "El motor se cambia al momento y queda guardado para la próxima vez",
                _ => "",
            };
            if !nota.is_empty() { l.texto(&mut u, p.gx, p.gy + claves.len() as f32 * hf * 0.105 + hf * 0.02, t * 0.6, [1.0, 1.0, 1.0, 0.6], nota); }
        }
        // el panel de Actitud (npcPanel): el personaje (los nuevos), cómo está, las rápidas, el arma y borrar
        if let Some(pn) = &self.npc_panel {
            let nuevo = pn.npc.is_none(); let (c, bs) = panel_npc_geo(wf, hf, nuevo);
            let act = pn.npc.and_then(|id| self.npcs.get(id)).map(|p| p.act.clone()).or_else(|| self.npc_act.clone());
            l.caja(&mut u, c[0], c[1], c[2], c[3], hf * 0.03, [0.07, 0.08, 0.11, 0.94]);
            let tit = match pn.npc.and_then(|id| self.npcs.get(id)) { Some(p) => format!("Actitud del NPC · {}", npc::skin_nom(&p.skin)), None => "NPC nuevos".to_string() };
            l.texto(&mut u, c[0] + hf * 0.03, c[1] + hf * 0.02, t * 0.9, bl, &tit);
            let mx = c[0] + hf * 0.03; let tt = t * 0.72;
            if nuevo { l.texto(&mut u, mx, c[1] + hf * 0.09, t * 0.6, [1.0, 1.0, 1.0, 0.7], "Elegí el personaje y cómo actúan; después tocá el piso con la Tool Gun para ponerlos"); }
            let ahora = act.as_ref().map(describir_npc).unwrap_or_else(|| "Pasea, 2.0 m/s".into());
            let y_ahora = c[1] + hf * (if nuevo { 0.24 } else { 0.1 });
            l.texto(&mut u, mx, y_ahora, tt, [1.0, 1.0, 1.0, 0.8], &format!("Ahora: {ahora}"));
            if let Some((_, r)) = bs.iter().find(|b| matches!(b.0, BtnNpc::Arma(_))) { l.texto(&mut u, mx, r[1] + (r[3] - tt) / 2.0 - hf * 0.004, tt, bl, "Arma"); }
            if nuevo { if let Some((_, r)) = bs.iter().find(|b| b.0 == BtnNpc::SkinAnt) { let n = npc::skin_nom(&self.npc_skin); let x = r[0] + r[2] + hf * 0.03; l.texto(&mut u, x, r[1] + (r[3] - t * 0.8) / 2.0 - hf * 0.004, t * 0.8, bl, &format!("Personaje: {n}")); } }
            for (b, r) in &bs {
                let (txt, sel, rojo): (String, bool, bool) = match *b {
                    BtnNpc::Cerrar => ("X".into(), false, true),
                    BtnNpc::Rapida(k) => (RAPIDAS_NPC[k].1.into(), false, false),
                    BtnNpc::Arma(w) => (w.map(arma_npc_nom).unwrap_or("Ninguna").into(), act.as_ref().map(|a| a.arma == w).unwrap_or(w.is_none()), false),
                    BtnNpc::SkinAnt => ("<".into(), false, false), BtnNpc::SkinSig => (">".into(), false, false),
                    BtnNpc::Escribir => ("Escribir cómo actúa… (por ejemplo: «agresivo, que me persiga corriendo»)".into(), false, false),
                    BtnNpc::Borrar => { if pn.npc.is_none() { continue; } ("Borrar este NPC".into(), false, true) }
                    BtnNpc::BorrarTodos => { let n = self.npcs.lista.len(); if n == 0 { continue; } (format!("Borrar mis NPC ({n})"), false, true) }
                };
                l.caja(&mut u, r[0], r[1], r[2], r[3], hf * 0.012, if rojo { [0.6, 0.15, 0.12, 0.95] } else if sel { [0.95, 0.66, 0.1, 0.92] } else { [1.0, 1.0, 1.0, 0.1] });
                let mut ts = tt; while l.ancho(ts, &txt) > r[2] - 8.0 && ts > tt * 0.4 { ts *= 0.9; }
                let an = l.ancho(ts, &txt); l.texto(&mut u, r[0] + (r[2] - an) / 2.0, r[1] + (r[3] - ts) / 2.0 - hf * 0.004, ts, if sel { [0.0, 0.0, 0.0, 1.0] } else { bl }, &txt);
            }
            if !pn.est.is_empty() { l.texto(&mut u, mx, c[1] + c[3] - hf * 0.06, t * 0.62, [0.95, 0.75, 0.3, 1.0], &pn.est); }
        }
        self.red_panel(l, &mut u, wf, hf, t);
        if self.emotes_panel {
            let le = self.lista_emotes(); let (c, cel) = panel_emotes_geo(wf, hf, le.len(), self.emo_scroll);
            l.caja(&mut u, c[0], c[1], c[2], c[3], hf * 0.03, [0.07, 0.08, 0.11, 0.94]);
            l.texto(&mut u, c[0] + hf * 0.03, c[1] + hf * 0.02, t * 0.9, bl, &format!("Emotes · {}", le.len()));
            l.caja(&mut u, c[0] + c[2] - hf * 0.09, c[1] + hf * 0.012, hf * 0.07, hf * 0.06, hf * 0.015, [0.6, 0.15, 0.12, 0.95]);
            { let an = l.ancho(t * 0.9, "X"); l.texto(&mut u, c[0] + c[2] - hf * 0.055 - an / 2.0, c[1] + hf * 0.02, t * 0.9, bl, "X"); }
            for (k, r) in cel.iter().enumerate() {
                if r[2] <= 0.0 { continue; } let sel = self.emote.as_deref() == Some(le[k].as_str());
                l.caja(&mut u, r[0], r[1], r[2], r[3], hf * 0.012, if sel { [0.95, 0.66, 0.1, 0.92] } else { [1.0, 1.0, 1.0, 0.1] });
                let n = &le[k]; let mut ts = t * 0.7; while l.ancho(ts, n) > r[2] - 8.0 && ts > t * 0.3 { ts *= 0.9; }
                let an = l.ancho(ts, n); l.texto(&mut u, r[0] + (r[2] - an) / 2.0, r[1] + (r[3] - ts) / 2.0 - hf * 0.004, ts, if sel { [0.0, 0.0, 0.0, 1.0] } else { bl }, n);
            }
        }
        self.gmod_panel(l, &mut u, wf, hf, t);
        // (el aviso, arriba de los menús: lo que se acaba de elegir se ve)
        if let Some((a, ta)) = &self.aviso {
            // (como #aviso de la web: arriba, al 22 % del alto, letras de 13 px en una caja negra transparente)
            if ta.elapsed().as_secs_f32() < 4.0 { let c = hud_web::css(wf, hf); let tt = 13.0 * c * 1.15; let an = l.ancho(tt, a); let (px, py) = (14.0 * c, 6.0 * c); let y = hf * 0.22;
                l.caja(&mut u, (wf - an) / 2.0 - px, y, an + 2.0 * px, tt * 1.25 + 2.0 * py, 4.0 * c, [0.0, 0.0, 0.0, 0.55]); l.texto(&mut u, (wf - an) / 2.0, y + py + tt * 0.1, tt, bl, a); }
        }
        self.banco_hud(l, &mut u, wf, hf);
        if let Some(e) = &self.error {
            let tt = t * 0.75; let mut y = hf * 0.3; let ancho = wf * 0.8;
            l.caja(&mut u, wf * 0.08, y - tt, wf * 0.84, tt * 2.0 + tt * 1.3 * (1.0 + (l.ancho(tt, e) / ancho).ceil()), tt * 0.6, [0.35, 0.0, 0.0, 0.85]);
            l.texto(&mut u, wf * 0.1, y, tt, [1.0, 0.85, 0.3, 1.0], "Algo salió mal (sacale una captura):"); y += tt * 1.4;
            // (el texto partido en renglones que entren)
            let mut renglon = String::new();
            for pal in e.split(' ') {
                let prueba = if renglon.is_empty() { pal.to_string() } else { format!("{renglon} {pal}") };
                if l.ancho(tt, &prueba) > ancho && !renglon.is_empty() { l.texto(&mut u, wf * 0.1, y, tt, bl, &renglon); y += tt * 1.3; renglon = pal.to_string(); } else { renglon = prueba; }
            }
            if !renglon.is_empty() { l.texto(&mut u, wf * 0.1, y, tt, bl, &renglon); }
        }
        let jg_tex = self.jg_hud(l, &mut u, wf, hf, t);
        let pj_tex = self.pjs_hud(l, &mut u, wf, hf, t);
        let mut r = vec![(hud_web::TEX_HUD, ih), (TEX_LETRAS, u), (TEX_ICONOS, ic), (TEX_ARMAS, ia)]; r.extend(gm_tex); r.extend(jg_tex); r.extend(pj_tex); r
    }

    /// la calidad, para el HUD
    fn calidad_txt(&self) -> String { if self.aj.calidad < ajustes::PERSONAL { format!("{} {}%", ajustes::CALIDADES[self.aj.calidad], self.aj.res_efectiva()) } else { format!("personal {}%", self.aj.res_efectiva()) } }
    /// lo que tardó el cuadro entero (ms, con la espera a la pantalla) y los cuadros por segundo
    pub fn medir(&mut self, ms: f32) {
        self.ms = if self.cuenta == 0 { ms } else { self.ms * 0.9 + ms * 0.1 }; self.cuenta += 1; self.n_med += 1;
        { let x = if self.fue_inter { &mut self.ms_inter } else { &mut self.ms_real }; *x = if *x == 0.0 { ms } else { *x * 0.9 + ms * 0.1 }; }
        let turbo = self.aj.turbo && self.turbo_on && self.n_inter > 0; if self.fue_inter { return self.fps_paso(); }
        // (JX Turbo se prende si un cuadro de verdad cuesta más que el de la pantalla y se apaga si sobra —con margen, para que no
        // titile—. Lo que cuesta: lo de la placa medido sin frenarla —o la CPU, si es más—; no el tiempo entre cuadros, que con el
        // ritmo parejo es siempre el de la pantalla)
        let t = 1000.0 / self.refresco.max(30.0); let (cr, ci) = self.costos();
        if !self.aj.turbo { self.turbo_on = false; } else if self.mapa.is_some() && !self.recargar && cr > 0.0 {
            if cr > t * 1.1 { self.turbo_on = true; } else if cr < t * 0.85 { self.turbo_on = false; }
        }
        // (con JX Turbo, la resolución dinámica mira el cuadro de verdad: tiene que entrar con su intermedio en dos cuadros de la
        // pantalla, y la placa terminarlo antes de que la pantalla se quede sin búfer —2 cuadros menos lo de la CPU—; si no, la
        // pantalla repite cuadros y al girar se ve a los saltos. Con un margen del 8 %)
        let (ms, obj_turbo) = if turbo { (cr, ((2.0 * t - (if ci > 0.0 { ci } else { t * 0.35 }).max(self.cpu_real)) * 0.92).max(t)) } else { (self.ms, 0.0) };
        // (la resolución dinámica —sólo con la resolución en Automática: la elegida a mano queda fija—: cada medio segundo se
        // mira el cuadro contra el de la pantalla —60, 90 o 120 por segundo; como mucho 90—; si tarda, un escalón de 5 % menos;
        // si sobra un buen rato —2 s seguidos—, uno más. De a un escalón, con el reescalado del motor no se notan los saltos.
        // Entre 50 % y 100 % de la de la calidad; el antilag —grabando, un mapa pesado, el celu caliente— deja bajar hasta 35 %
        // sin apagar ningún efecto)
        if self.aj.dinamica && self.aj.res == 0 && self.mapa.is_some() && !self.ini.abierto && !self.recargar {
            self.drs_t += ms;
            if self.drs_t >= 500.0 {
                self.drs_t = 0.0; let obj = if turbo { obj_turbo } else { 1000.0 / self.refresco.clamp(45.0, 90.0) };
                let piso = if self.antilag > 0 { 0.35 } else { 0.5 };
                if ms > obj * 1.08 { self.drs = (((self.drs - 0.05) * 20.0).round() / 20.0).max(piso); self.antilag_ok = 0.0; }
                else if ms < obj * 0.75 { self.antilag_ok += 500.0; if self.antilag_ok >= 2000.0 { self.antilag_ok = 0.0; self.drs = (((self.drs + 0.05) * 20.0).round() / 20.0).min(1.0); } }
                else { self.antilag_ok = 0.0; }
                // (el antilag: con la resolución en el piso y todavía trabado 1 s, el piso baja; vuelve cuando sobra)
                if self.drs <= 0.5 && ms > obj * 1.15 { self.antilag_mal += 500.0; if self.antilag_mal >= 1000.0 { self.antilag = 1; self.antilag_mal = 0.0; } }
                else if self.drs >= 0.6 { self.antilag = 0; self.antilag_mal = 0.0; }
            }
        } else { self.drs = 1.0; self.antilag = 0; }
        self.fps_paso();
    }
    fn fps_paso(&mut self) { let e = self.t_med.elapsed().as_secs_f32(); if e >= 0.5 { self.fps = self.n_med as f32 / e; self.n_med = 0; self.t_med = Instant::now(); } }
    /// JX Turbo: cuántos intermedios van entre dos reales. Ninguno si el real ya llega al refresco de la pantalla; si no, los que
    /// hacen falta para que el promedio llegue al refresco —(real + n intermedios) / (n + 1) = el cuadro de la pantalla—, hasta el
    /// tope (turbo_tope)
    fn turbo_max(&self) -> u8 {
        if !self.aj.turbo || !self.turbo_on { return 0; }
        let tope = self.turbo_tope(); let t = 1000.0 / self.refresco.max(30.0); let (cr, ci) = self.costos();
        if cr == 0.0 { return 1; }
        let falta = if ci < t * 0.95 { ((cr - t) / (t - ci)).ceil() } else { tope };
        falta.clamp(1.0, tope) as u8
    }
    /// (como mucho, cuántos intermedios entre dos reales: uno. La placa hace todo en orden y la pantalla tiene 3 búferes: con 2 o
    /// 3 intermedios seguidos, cuando el real tarda más de un cuadro y medio la cámara de cada intermedio ya no coincide con
    /// cuándo sale en la pantalla y al girar se ve a los saltos —medido en una simulación del camino CPU, placa y pantalla: con
    /// uno, el desfase queda en 0-2 ms; con tres, 4-15 ms—. Para más intermedios hay que repartir el cuadro real en pedazos)
    fn turbo_tope(&self) -> f32 { 1.0 }
    /// lo que cuesta un cuadro de verdad y uno intermedio (ms): con los medidores, lo más lento entre la placa y la CPU; sin
    /// ellos, la placa medida cada tanto (o el tiempo entre cuadros)
    fn costos(&self) -> (f32, f32) {
        if self.reloj_ok && self.placa_ms > 0.0 { (self.placa_ms.max(self.cpu_real), self.placa_inter.max(self.cpu_inter)) }
        else if self.placa_ms > 0.0 { (self.placa_ms.max(self.cpu_real), self.ms_inter.min(self.placa_ms)) }
        else { (self.ms_real, self.ms_inter) }
    }
}
