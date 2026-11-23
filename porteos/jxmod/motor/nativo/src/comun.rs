//! El juego, igual en el teléfono y en la compu (las pruebas): el mapa, la cámara con el tacto, los botones de los motores
//! y el HUD. Lo de Android (la ventana, EGL, los eventos) está en app.rs.
use jxjuego::fisica::Fisica;
use jxjuego::forma::{self, Catalogo};
use jxjuego::jugador::{Entrada, Jugador};
use jxjuego::personaje::{self, Personaje};
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
use combate::Proy;
use crate::motor::Motor3d;
use jxmotor::gpu::TEX_LETRAS;
use jxmotor::mat::{self as m4, M4};
use std::time::Instant;

/// los motores que se pueden elegir: Vulkan, OpenGL 3 y OpenGL 2 (los teléfonos viejos)
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Placa { Vulkan, Gl3, Gl2 }
impl Placa {
    pub fn nombre(self) -> &'static str { match self { Placa::Vulkan => "Vulkan", Placa::Gl3 => "OpenGL 3", Placa::Gl2 => "OpenGL 2" } }
    pub fn clave(self) -> &'static str { match self { Placa::Vulkan => "vk", Placa::Gl3 => "gl3", Placa::Gl2 => "gl2" } }
    pub fn de_clave(s: &str) -> Placa { match s.trim() { "vk" => Placa::Vulkan, "gl2" => Placa::Gl2, _ => Placa::Gl3 } }
    pub fn lista() -> [Placa; 3] { [Placa::Vulkan, Placa::Gl3, Placa::Gl2] }
    pub fn hecha(self) -> bool { true }
}

/// un dedo en la pantalla: para qué es (palanca, mirar o un botón que se mantiene) y dónde
struct Dedo { id: i32, palanca: bool, boton: Option<Boton>, x0: f32, y0: f32, x: f32, y: f32 }

/// los botones de la pantalla
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Boton { Ajustes, Camara, Recargar, Saltar, Agachar, Volar, Objetos, Deshacer, Disparo, Disparo2, Arma, ArmaN(usize), Girar, Lejos, Cerca }
/// un botón: qué es, el centro, el tamaño (ancho y alto; los redondos con el mismo) y si es redondo
struct Btn { b: Boton, x: f32, y: f32, w: f32, h: f32, redondo: bool }
/// dónde va cada botón con la pantalla de w × h
fn botones(w: f32, h: f32) -> Vec<Btn> {
    let mut v = vec![];
    // (arriba a la derecha, Ajustes: la calidad, los controles, el sonido, el motor y el mapa)
    let (bw, bh) = (w * 0.13, h * 0.1);
    v.push(Btn { b: Boton::Ajustes, x: w - bw / 2.0 - 6.0, y: 6.0 + (bh - 8.0) / 2.0, w: bw - 8.0, h: bh - 8.0, redondo: false });
    // (al lado, la cámara: primera persona, tercera y de frente, como el botón de la web)
    v.push(Btn { b: Boton::Camara, x: w - bw * 1.5 - 6.0, y: 6.0 + (bh - 8.0) / 2.0, w: bw - 8.0, h: bh - 8.0, redondo: false });
    let r = h * 0.11;
    v.push(Btn { b: Boton::Saltar, x: w - h * 0.17, y: h - h * 0.2, w: r * 2.0, h: r * 2.0, redondo: true });
    v.push(Btn { b: Boton::Agachar, x: w - h * 0.17, y: h - h * 0.47, w: r * 1.5, h: r * 1.5, redondo: true });
    v.push(Btn { b: Boton::Volar, x: w - h * 0.44, y: h - h * 0.14, w: r * 1.3, h: r * 1.3, redondo: true });
    v.push(Btn { b: Boton::Objetos, x: w - h * 0.17, y: h * 0.27, w: r * 1.5, h: r * 1.5, redondo: true });
    v.push(Btn { b: Boton::Deshacer, x: w - h * 0.44, y: h * 0.27, w: r * 1.3, h: r * 1.3, redondo: true });
    // las armas: disparo y «2» (como bdisparo y bdisp2), el arma en la mano abajo al medio con su barra, y los de la
    // Physics Gun mientras agarra algo (girar, más lejos, más cerca: fisBotones)
    v.push(Btn { b: Boton::Disparo, x: w - h * 0.44, y: h - h * 0.40, w: r * 1.8, h: r * 1.8, redondo: true });
    v.push(Btn { b: Boton::Disparo2, x: w - h * 0.68, y: h - h * 0.30, w: r * 1.2, h: r * 1.2, redondo: true });
    v.push(Btn { b: Boton::Arma, x: w * 0.5, y: h - h * 0.07, w: h * 0.36, h: h * 0.09, redondo: false });
    // (la barra de armas: dos filas sobre el botón del arma)
    let por_fila = ARMAS.len().div_ceil(2); let cw = (w * 0.92 / por_fila as f32).min(h * 0.36);
    for k in 0..ARMAS.len() { let (f, c) = (k / por_fila, k % por_fila); v.push(Btn { b: Boton::ArmaN(k), x: w * 0.5 + (c as f32 - (por_fila - 1) as f32 / 2.0) * cw, y: h - h * (0.30 - 0.11 * f as f32), w: cw - 6.0, h: h * 0.1, redondo: false }); }
    v.push(Btn { b: Boton::Recargar, x: w - h * 0.68, y: h - h * 0.55, w: r * 1.2, h: r * 1.2, redondo: true });
    v.push(Btn { b: Boton::Girar, x: w - h * 0.68, y: h - h * 0.55, w: r * 1.2, h: r * 1.2, redondo: true });
    v.push(Btn { b: Boton::Lejos, x: w - h * 0.92, y: h - h * 0.42, w: r * 1.05, h: r * 1.05, redondo: true });
    v.push(Btn { b: Boton::Cerca, x: w - h * 0.92, y: h - h * 0.22, w: r * 1.05, h: r * 1.05, redondo: true });
    v
}
/// la textura de los íconos del menú (un atlas armado con los de la subcategoría abierta)
pub const TEX_ICONOS: i64 = -2001;
/// la textura de los íconos de las armas (los W_ de GMod, uno por arma de ARMAS)
pub const TEX_ARMAS: i64 = -2002;
const ICO: u32 = 96;
const ICO_COLS: u32 = 10;
/// el menú de objetos abierto: qué subcategoría, cuánto bajó la grilla y de qué subcategoría es el atlas cargado
pub struct Menu { pub sub: usize, pub scroll: f32, atlas_de: Option<usize>, atlas_h: u32, /** 0 Props, 1 Herramientas */ pub pestana: usize }
/// las pestañas de arriba del menú (las del spawn menu de la web)
const PESTANAS_MENU: [&str; 2] = ["Props", "Herramientas"];
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
fn pestana_menu(p: &Panel, h: f32, k: usize) -> (f32, f32) { (p.x0 + h * 0.03 + k as f32 * h * 0.44, h * 0.42) }
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
    recargar: bool,
    /// (para las pruebas: el tiempo fijo de cada cuadro, en vez del reloj)
    pub dt_fijo: Option<f32>,
    /// lo que salió mal (se muestra en la pantalla: en el teléfono no hay otra forma de verlo)
    pub error: Option<String>,
    mapa_cartel: bool,
    /// el motor que se está usando (lo pone la app) y si hay que cambiarlo (se eligió otro)
    pub en_uso: Placa, pub cambiar_motor: bool,
    /// lo que tardó cada pasada en la placa (Vulkan)
    pub detalle: String,
    // —— los objetos ——
    nombres: HashMap<String, String>, pub catalogo: Vec<(String, Vec<String>)>,
    pub menu: Option<Menu>, prefabs: HashMap<String, Prefab>, cargados: Cargados,
    pub objs: Vec<Obj>, pendientes: Vec<String>,
    /// la física de los objetos (fisica.rs), las formas de choque de los prefabs y el tiempo que sobra para su paso fijo
    pub fis: Fisica, cat_fis: Option<Catalogo>, acum_fis: f32,
    /// las armas (la Physics Gun y la Gravity Gun) y dónde estaban los ojos en el último cuadro (para apuntar)
    pub armas: Armas, ojos_ult: [f32; 3],
    /// el cuerpo del jugador (personaje.rs: se ve en tercera persona y de frente), la cámara (0 primera, 1 tercera, 2 de
    /// frente) y las dos capturas de nado (CMU 126_04 y 79_02: las pone la app)
    pub pj: Option<Personaje>, pj_cargados: personaje::Cargados, pub camara: u8, pub nado: Option<(Vec<u8>, Vec<u8>)>, pub skin: String,
    /// el arma en la mano (vista.rs): el modelo, lo que el motor ya tiene, los clips, cuál suena, el vaivén y lo que se
    /// arrastró para mirar en este cuadro (el arma se atrasa un poco al girar)
    /// la Tool Gun (herramientas.rs) y el número del próximo objeto
    pub her: Herramientas, sig_id: u32,
    /// los proyectiles en el aire (cohetes, flechas), los barriles por explotar (id, cuándo), el temblor de la cámara, el
    /// rojo del golpe, si murió, y el campo de visión que va hacia el pedido (apuntar y la mira del francotirador)
    pub proys: Vec<Proy>, por_explotar: Vec<(u32, f32)>, temblor: f32, golpe_t: f32, pub muerto: bool, fov_b: f32,
    /// el atlas de los íconos de las armas está en el motor
    armas_ico: bool, armas_ico_h: u32,
    pub vista: Option<Vista>, vista_cargados: vista::Cargados, clips: vista::Clips, clip_ya: &'static str, sway: [f32; 5], bob_arma: f32, mdx: f32, tubo_ok: bool,
    // —— el sonido (como sonidos.js): pasos, golpes, agua, botones ——
    /// los ajustes (ajustes.txt) y la pestaña del menú de Ajustes, si está abierto (el juego queda en pausa)
    pub aj: Ajustes, pub ajustes: Option<usize>,
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
        let letras = letras_json.and_then(|t| Letras::de_json(&t).ok());
        let letras_px = letras_png.and_then(png_rgba);
        let (paq, error) = match paq { Ok(p) => (Some(p), None), Err(e) => (None, Some(format!("el paquete del juego: {e}"))) };
        let mut j = Juego { paq, mapa: None, mapas: vec!["RB_Flatgrass".into(), "RB_Construct".into()], mapa_i: 0, letras, letras_px, jug: Jugador::nuevo(), acum: 0.0,
            dedos: vec![], placa, aviso: None, datos, t_ant: Instant::now(), t0: Instant::now(), fps: 0.0, ms: 0.0, cuenta: 0, t_med: Instant::now(), n_med: 0, placa_ms: 0.0,
            recargar: true, dt_fijo: None, error, mapa_cartel: false, en_uso: Placa::Gl3, cambiar_motor: false, detalle: String::new(),
            nombres: HashMap::new(), catalogo: vec![], menu: None, prefabs: HashMap::new(), cargados: Cargados::default(), objs: vec![], pendientes: vec![],
            fis: Fisica::nueva(), cat_fis: None, acum_fis: 0.0, armas: Armas::default(), ojos_ult: [0.0; 3],
            pj: None, pj_cargados: personaje::Cargados::default(), camara: 0, nado: None, skin: "Hero".into(),
            her: Herramientas::default(), sig_id: 1, proys: vec![], por_explotar: vec![], temblor: 0.0, golpe_t: 0.0, muerto: false, fov_b: 0.0,
            armas_ico: false, armas_ico_h: 256, vista: None, vista_cargados: vista::Cargados::default(), clips: vista::Clips::default(), clip_ya: "", sway: [0.0; 5], bob_arma: 0.0, mdx: 0.0, tubo_ok: false,
            aj, ajustes: None, sonido: crate::sonido::Sonido::mudo(), amb_t: 3.0, paso_d: 0.0, aire_t: 0.0, vy_aire: 0.0, golpe_max: 0.0, saltos_vistos: 0, ahogos_vistos: 0, nadaba: false, brazada_t: 0.0, azar: 0x9e3779b9 };
        // los mapas: todos los de la web (DATA.esc), primero los RB (los de la versión personal); empieza en el último elegido
        if let Some(p) = &j.paq { if let Some(e) = p.d["esc"].as_object() {
            let mut v: Vec<String> = e.keys().cloned().collect(); v.sort_by_key(|n| (!n.starts_with("RB_"), n != "RB_Flatgrass", n.clone()));
            if !v.is_empty() { j.mapas = v; }
            let ult = j.datos.as_ref().and_then(|d| std::fs::read_to_string(d.join("mapa.txt")).ok()).unwrap_or_default();
            j.mapa_i = j.mapas.iter().position(|m| *m == ult.trim()).unwrap_or(0);
        } }
        if let Some(p) = &j.paq { j.nombres = objetos::por_nombre(&p.d); j.catalogo = objetos::menu(&p.d, "Props"); j.cat_fis = Some(Catalogo::nuevo(p)); j.her.lista = herramientas::lista(&p.d); }
        if !placa.hecha() { j.aviso = Some((format!("{} todavía no está: se usa OpenGL 3", placa.nombre()), Instant::now())); }
        j
    }

    fn cargar_letras(&self, m: &mut Motor3d) {
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
    pub fn al_abrir(&mut self) { self.recargar = true; }

    // —— el tacto (coordenadas en píxeles de la pantalla) ——
    pub fn dedo_abajo(&mut self, id: i32, x: f32, y: f32, w: f32, h: f32) {
        self.dedos.retain(|d| d.id != id);
        if self.menu.is_some() || self.ajustes.is_some() { self.dedos.push(Dedo { id, palanca: false, boton: None, x0: x, y0: y, x, y }); return; }
        let ve = |b: Boton| self.boton_visible(b);
        if let Some(b) = boton_en(w, h, x, y, ve) {
            if !matches!(b, Boton::Saltar | Boton::Agachar | Boton::Disparo | Boton::Disparo2 | Boton::ArmaN(_)) { self.sonido.tocar("Click", 0.5, 1.0, None); }
            match b {
                Boton::Ajustes => { self.menu = None; self.ajustes = Some(0); }
                Boton::Camara => { self.camara = (self.camara + 1) % 3; self.avisar(["Primera persona", "Tercera persona", "De frente"][self.camara as usize].into()); }
                Boton::Volar => { self.jug.noclip = !self.jug.noclip; self.avisar(if self.jug.noclip { "Volar: prendido".into() } else { "Volar: apagado".into() }); }
                Boton::Objetos => { if !self.catalogo.is_empty() { self.menu = Some(Menu { sub: 0, scroll: 0.0, atlas_de: None, atlas_h: 0, pestana: 0 }); } }
                Boton::Disparo | Boton::Disparo2 => {
                    let (o, d, yaw) = (self.ojos_ult, self.mira(), self.jug.yaw);
                    if let Some(mp) = &self.mapa { if b == Boton::Disparo { self.armas.disparo(&mut self.fis, &mp.mundo, o, d, yaw); } else { self.armas.disparo2(&mut self.fis, &mp.mundo, o, d); } }
                }
                Boton::Arma => { self.armas.barra_t = if self.armas.barra_t > 0.0 { 0.0 } else { 2.5 }; }
                Boton::ArmaN(k) => { self.armas.elegir(&mut self.fis, k); }
                Boton::Girar => { self.armas.rotar = !self.armas.rotar && self.armas.agarre.is_some(); }
                Boton::Lejos => self.armas.distancia(1.5),
                Boton::Recargar => self.recargar(),
                Boton::Cerca => self.armas.distancia(-1.5),
                Boton::Deshacer => { if !self.objs.is_empty() { let n = self.objs.last().map(|o| o.nombre.clone()).unwrap_or_default(); self.borrar_obj(self.objs.len() - 1); self.avisar(format!("Deshecho: {n}")); } }
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
        if self.ajustes.is_some() { if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) { d.x = x; d.y = y; } return; }
        if let Some(m) = self.menu.as_mut() {
            // (en el menú, arrastrar baja la grilla)
            if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) { m.scroll = (m.scroll - (y - d.y)).max(0.0); d.x = x; d.y = y; }
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
        if self.menu.is_some() || self.ajustes.is_some() {
            // (sólo los toques que empezaron con el menú abierto: no el que lo abrió, ni la palanca que se venía usando)
            if let Some(d) = self.dedos.iter().find(|d| d.id == id && d.boton.is_none() && !d.palanca) { if (d.x - d.x0).abs() + (d.y - d.y0).abs() < h * 0.03 { let (x, y) = (d.x, d.y); if self.ajustes.is_some() { self.toque_ajustes(x, y, w, h); } else { self.toque_menu(x, y, w, h); } } }
        }
        self.dedo_arriba(id);
    }
    pub fn dedo_arriba(&mut self, id: i32) { self.dedos.retain(|d| d.id != id); }
    fn toque_menu(&mut self, x: f32, y: f32, w: f32, h: f32) {
        let Some(m) = self.menu.as_mut() else { return };
        let n = if m.pestana == 1 { self.her.lista.len() } else { self.catalogo.len() };
        let p = panel(w, h, n);
        // (la X de cerrar, arriba a la derecha del panel; o tocar afuera)
        if (x > p.x0 + p.pw - h * 0.1 && y < p.y0 + h * 0.08) || x < p.x0 || x > p.x0 + p.pw || y < p.y0 || y > p.y0 + p.ph { self.menu = None; return; }
        // (las pestañas de arriba)
        if y < p.y0 + h * 0.08 {
            for k in 0..PESTANAS_MENU.len() { let (bx, bw) = pestana_menu(&p, h, k); if x >= bx && x <= bx + bw && k != m.pestana { m.pestana = k; m.sub = if k == 1 { self.her.sel } else { 0 }; m.scroll = 0.0; } }
            return;
        }
        if x < p.gx - p.pw * 0.01 {
            let k = ((y - p.y0 - h * 0.08) / p.tab_h).floor() as i64;
            if k >= 0 && (k as usize) < n { m.sub = k as usize; m.scroll = 0.0; if m.pestana == 1 { self.equipar_herramienta(k as usize); } }
            return;
        }
        if m.pestana == 1 { self.toque_inspector(x, y, w, h); return; }
        let (col, fila) = (((x - p.gx) / p.celda).floor() as i64, ((y - p.gy + m.scroll) / p.celda).floor() as i64);
        if col < 0 || col as usize >= p.cols || fila < 0 { return; }
        let i = fila as usize * p.cols + col as usize;
        if let Some(n) = self.catalogo.get(m.sub).and_then(|s| s.1.get(i)) { self.pendientes.push(n.clone()); }
    }
    /// el arma en la mano (elegirArma, armasPaso y vistaSujeta): carga el modelo del arma elegida, toca sacar y después
    /// quieto (o sosteniendo, con algo agarrado), y el vaivén al caminar y al girar
    unsafe fn arma_en_mano(&mut self, m: &mut Motor3d, dt: f32) {
        if !self.tubo_ok { self.tubo_ok = m.cargar(&vista::tubo()).is_ok(); }
        // (los íconos de las armas, para la barra: un atlas de 10 por fila)
        if !self.armas_ico { if let Some(paq) = self.paq.as_ref() {
            let (aw, ah) = (1024u32, (ARMAS.len() as u32).div_ceil(ICO_COLS).max(1) * ICO); let ah = ah.next_power_of_two(); let mut px = vec![0u8; (aw * ah * 4) as usize];
            for (k, a) in ARMAS.iter().enumerate() {
                let Some(ic) = objetos::icono(paq, a.ic, ICO) else { continue };
                let (cx, cy) = ((k as u32 % ICO_COLS) * ICO, (k as u32 / ICO_COLS) * ICO);
                for y in 0..ICO { let d = (((cy + y) * aw + cx) * 4) as usize; let s = ((y * ICO) * 4) as usize; px[d..d + (ICO * 4) as usize].copy_from_slice(&ic[s..s + (ICO * 4) as usize]); }
            }
            let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![], texs: vec![Tex { id: TEX_ARMAS, n: "armas".into(), w: aw, h: ah, a: 1, o: 0 }], lms: vec![], items: vec![], agua: None, cielo: None };
            self.armas_ico = m.cargar(&Escena { c: cab, datos: px }).is_ok(); self.armas_ico_h = ah;
        } }
        let d = self.armas.def();
        if self.vista.as_ref().map(|v| v.nodo != d.nodo).unwrap_or(true) {
            self.vista = None;
            if let Some(paq) = self.paq.as_mut() {
                match Vista::cargar(paq, d.nodo, 512, &mut self.vista_cargados) {
                    Ok((v, esc)) => { if m.cargar(&esc).is_ok() { self.vista = Some(v); self.clip_ya = ""; if self.armas.anim.is_none() { self.armas.anim = Some(d.sacar); } } }
                    Err(e) => { self.avisar(format!("arma: {e}")); return; }
                }
            }
        }
        let Some(paq) = self.paq.as_ref() else { return };
        let Some(v) = self.vista.as_mut() else { return };
        if let Some(a) = self.armas.anim.take() { let c = self.clips.de(&paq.d, a); if v.tocar(c, false) > 0.0 { self.clip_ya = a; } }
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
    /// hacia dónde mira (miraDir)
    fn mira(&self) -> [f32; 3] { let (y, p) = (self.jug.yaw, self.jug.pitch); [y.sin() * p.cos(), p.sin(), y.cos() * p.cos()] }
    /// qué botones se ven: los de la Physics Gun sólo con algo agarrado; la barra de armas, abierta
    fn boton_visible(&self, b: Boton) -> bool {
        // (con la barra de armas abierta, sólo ella, el arma y lo de arriba: los redondos quedarían debajo)
        if self.armas.barra_t > 0.0 && !matches!(b, Boton::ArmaN(_) | Boton::Arma | Boton::Ajustes | Boton::Camara) { return false; }
        match b {
            Boton::Girar | Boton::Lejos | Boton::Cerca => self.armas.agarre.is_some(),
            Boton::Recargar => self.armas.def().car > 0,
            Boton::ArmaN(_) => self.armas.barra_t > 0.0,
            _ => true,
        }
    }
    /// lo que se puede elegir en un renglón de Ajustes, cuál está elegido, y elegir
    fn valores_aj(&self, c: Clave) -> Vec<String> {
        match c { Clave::Motor => Placa::lista().iter().map(|p| p.nombre().to_string()).collect(), Clave::Mapa => self.mapas.iter().map(|m| m.to_string()).collect(), _ => Ajustes::valores(c) }
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
                        Clave::Mapa => { if k != self.mapa_i { self.mapa_i = k; self.recargar = true; self.ajustes = None; if let Some(d) = &self.datos { let _ = std::fs::write(d.join("mapa.txt"), &self.mapas[k]); } } }
                        _ => { self.aj.elegir(*c, k); if let Some(d) = &self.datos { let _ = std::fs::write(d.join("ajustes.txt"), self.aj.texto()); } }
                    }
                    return;
                }
            }
        }
    }
    pub fn dedos_fuera(&mut self) { self.dedos.clear(); }
    fn apretado(&self, b: Boton) -> bool { self.dedos.iter().any(|d| d.boton == Some(b)) }
    /// lo que pide el jugador: la palanca (corre con el dedo a más de 1,6 radios, como la web) y los botones
    fn entrada(&self, h: f32) -> Entrada {
        let mut e = Entrada { saltar: self.apretado(Boton::Saltar), agachar: self.apretado(Boton::Agachar), ..Default::default() };
        if let Some(d) = self.dedos.iter().find(|d| d.palanca) {
            let r = h * 0.12; let (mut dx, mut dy) = ((d.x - d.x0) / r, (d.y - d.y0) / r); let l = (dx * dx + dy * dy).sqrt();
            if l > 1.0 { dx /= l; dy /= l; }
            e.x = dx; e.y = -dy; e.correr = l > 1.6;
        }
        e
    }
    /// para las pruebas: los ojos en un lugar fijo (volando, para que no caiga)
    pub fn poner_ojos(&mut self, ojos: [f32; 3], yaw: f32, pitch: f32) {
        self.jug.noclip = true; self.jug.pos = [ojos[0], ojos[1] - 0.72, ojos[2]]; self.jug.vel = [0.0; 3]; self.jug.yaw = yaw; self.jug.pitch = pitch;
    }

    /// los botones de los motores: Vulkan, OpenGL 3 y OpenGL 2
    fn elegir_motor(&mut self, k: usize) {
        {
            let p = Placa::lista()[k];
            if let Some(d) = &self.datos { let _ = std::fs::write(d.join("motor.txt"), p.clave()); }
            self.placa = p;
            let usar = if p.hecha() { p } else { Placa::Gl3 };
            if usar != self.en_uso { self.cambiar_motor = true; }
            self.aviso = Some((if p.hecha() { format!("Motor: {}", p.nombre()) } else { format!("{} todavía no está: se usa OpenGL 3 (queda elegido)", p.nombre()) }, Instant::now()));
        }
    }

    /// arma el mapa elegido y pone al jugador donde aparece
    fn cargar_mapa(&mut self, m: &mut Motor3d) {
        let nombre = self.mapas[self.mapa_i].clone(); let nombre = nombre.as_str();
        self.mapa = None;
        self.objs.clear(); self.prefabs.clear(); self.cargados.olvidar(); if let Some(mm) = self.menu.as_mut() { mm.atlas_de = None; }
        self.fis = Fisica::nueva(); self.acum_fis = 0.0; self.armas.olvidar(); self.proys.clear(); self.por_explotar.clear(); self.her.cable = None; self.her.trazas.clear(); self.her.tirados.clear(); self.her.spawn = None; self.pj = None; self.pj_cargados.olvidar(); self.vista = None; self.vista_cargados.olvidar(); self.tubo_ok = false; self.armas_ico = false;
        unsafe { m.vaciar(); }
        let Some(paq) = self.paq.as_mut() else { return };
        match mapa::armar(paq, nombre, 1024, 750.0) {
            Ok(mp) => {
                if let Err(e) = unsafe { m.cargar(&mp.esc) } { self.aviso = Some((format!("mapa {nombre}: {e}"), Instant::now())); }
                let sp = mp.spawns.first().map(|s| s.0).unwrap_or([0.0, 1.0, 0.0]);
                let yaw = mp.spawns.first().and_then(|s| s.1).unwrap_or(0.0);
                let noclip = self.jug.noclip;
                self.jug = Jugador::nuevo(); self.jug.noclip = noclip; self.acum = 0.0;
                self.jug.aparecer(&mp.mundo, sp, Some(yaw)); self.jug.aguas = mp.aguas.clone();
                self.mapa = Some(mp);
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
        // (lo que tarda la placa: en OpenGL, cada 60 cuadros se espera a que termine; Vulkan tiene marcas de tiempo)
        let medir = !m.es_vulkan() && self.cuenta % 60 == 30 && self.mapa.is_some() && !self.recargar;
        if medir { m.esperar(); }
        let t = Instant::now();
        let r = self.cuadro_dentro(m, w, h, placa_txt);
        if medir { m.esperar(); let x = t.elapsed().as_secs_f32() * 1000.0; self.placa_ms = if self.placa_ms == 0.0 { x } else { self.placa_ms * 0.5 + x * 0.5 }; }
        if let Some((tot, det)) = m.tiempos() { self.placa_ms = tot; self.detalle = det; }
        r
    }
    unsafe fn cuadro_dentro(&mut self, m: &mut Motor3d, w: i32, h: i32, placa_txt: &str) -> Result<(), String> {
        // (al cargar: primero un cuadro con el cartel de «Cargando…», y en el siguiente se arma el mapa, que tarda)
        if self.recargar {
            if self.paq.is_some() && !self.mapa_cartel { self.mapa_cartel = true; self.mapa = None; m.vaciar(); self.objs.clear(); self.fis = Fisica::nueva(); self.prefabs.clear(); self.cargados.olvidar(); self.pj = None; self.pj_cargados.olvidar(); self.vista = None; self.vista_cargados.olvidar(); self.tubo_ok = false; self.armas_ico = false; if let Some(mm) = self.menu.as_mut() { mm.atlas_de = None; } self.cargar_letras(m); }
            else { self.recargar = false; self.mapa_cartel = false; if self.paq.is_some() { self.cargar_mapa(m); } else { m.vaciar(); self.cargar_letras(m); } }
        }
        let ahora = Instant::now(); let dt = self.dt_fijo.unwrap_or((ahora - self.t_ant).as_secs_f32().min(0.1)); self.t_ant = ahora;
        let (wf, hf) = (w as f32, h as f32);
        // la física del jugador, a paso fijo (como mucho 12 pasos por cuadro: si el teléfono se traba, no se acumula)
        let ent = self.entrada(hf);
        // (lo de Ajustes, cada cuadro: la calidad al motor y el volumen al mezclador)
        m.opciones(&self.aj.opciones()); self.sonido.volumen = self.aj.volumen();
        if self.ajustes.is_some() { self.acum = 0.0; }
        else if let Some(mp) = &self.mapa {
            self.acum = (self.acum + dt).min(PASO * 12.0);
            while self.acum >= PASO { self.jug.paso_con(&mp.mundo, Some(&mut self.fis), PASO, &ent); self.golpe_max = self.golpe_max.max(self.jug.golpe); self.acum -= PASO; }
            // la física de los objetos a 60 por segundo (como mucho 3 pasos por cuadro, como la web)
            self.fis.sub = SUB_FIS[self.aj.calidad.min(4)];
            self.acum_fis = (self.acum_fis + dt).min(PASO_FIS * 3.0);
            while self.acum_fis >= PASO_FIS {
                for o in self.objs.iter_mut() { o.ant = (o.pos, o.q); }
                let (yaw, pitch) = (self.jug.yaw, self.jug.pitch); let fwd = [yaw.sin() * pitch.cos(), pitch.sin(), yaw.cos() * pitch.cos()];
                self.armas.paso(&mut self.fis, PASO_FIS, self.ojos_ult, fwd, yaw);
                self.fis.paso(&mp.mundo, PASO_FIS as f64); self.acum_fis -= PASO_FIS;
                for o in self.objs.iter_mut() { if let Some(b) = o.cuerpo.and_then(|id| self.fis.cuerpo(id)) { o.pos = [b.pos[0] as f32, b.pos[1] as f32, b.pos[2] as f32]; o.q = [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32]; } }
            }
            // (lo que se cayó del mapa —debajo de −300— se saca)
            let muertos: Vec<usize> = self.objs.iter().enumerate().filter(|(_, o)| o.cuerpo.and_then(|id| self.fis.cuerpo(id)).map(|b| b.muerto).unwrap_or(false)).map(|(i, _)| i).collect();
            for i in muertos.into_iter().rev() { let o = self.objs.remove(i); if let Some(id) = o.cuerpo { self.fis.quitar(id); } }
            // (se cayó del mapa o se ahogó: vuelve a aparecer)
            if self.jug.pos[1] < mp.mundo.lo[1] - 60.0 || self.jug.vida <= 0.0 {
                if self.jug.vida <= 0.0 { self.aviso = Some((if self.muerto { "Te moriste".into() } else { "Te ahogaste".into() }, Instant::now())); }
                self.muerto = false;
                let sp = self.her.spawn.map(|p| [p[0], p[1] + 0.2, p[2]]).or(mp.spawns.first().map(|s| s.0)).unwrap_or([0.0, 1.0, 0.0]); self.jug.aparecer(&mp.mundo, sp, None); self.jug.vida = 100.0; self.jug.aire = 12.0;
            }
        }
        let (ojos, _) = self.jug.ojos(dt); self.ojos_ult = ojos;
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
            if self.apretado(Boton::Disparo) && self.menu.is_none() { self.disparar(m); }
            self.proyectiles_paso(dt);
        }
        // la Tool Gun: lo que se disparó, y lo que hacen las cosas que puso (en pausa, nada)
        if let Some(alt) = self.armas.herr.take() { self.herramienta_usar(m, alt); }
        if self.ajustes.is_none() && self.mapa.is_some() { self.herramientas_paso(m, dt); }
        let pend = std::mem::take(&mut self.pendientes);
        for n in pend { if let Err(e) = self.poner(m, &n, ojos, fw) { self.avisar(format!("{n}: {e}")); } }
        // el arma en la mano: el modelo del arma elegida, su clip (sacar; después quieto o sosteniendo) y el vaivén (armasPaso)
        if self.mapa.is_some() { self.arma_en_mano(m, dt); }
        // el cuerpo, animado (tercera persona y de frente): el piso bajo la cápsula, la mirada y el agua si nada
        if let Some(pj) = self.pj.as_mut() {
            if self.camara != 0 {
                let jp = self.jug.pos; let piso = [jp[0], jp[1] - 0.95, jp[2]];
                let agua = if self.jug.nada { self.jug.aguas.iter().find(|v| jp[0] >= v[0] && jp[0] <= v[3] && jp[2] >= v[2] && jp[2] <= v[5] && piso[1] < v[4]).map(|v| v[4]) } else { None };
                let e = personaje::Estado { piso, vel: self.jug.vel, yaw: self.jug.yaw, mira: -self.jug.pitch, en_suelo: self.jug.suelo || self.jug.noclip, agachado: self.jug.agachado, agua };
                pj.animar(dt, &e);
            }
        }
        let tj = [self.azar() - 0.5, self.azar() - 0.5, self.azar() - 0.5];
        if let Some(mp) = &self.mapa {
            // (el campo de visión: el de Ajustes, más cerrado apuntando y 18° con la mira del francotirador; va de a poco)
            let z = if self.armas.zoom { 18.0 } else { self.aj.fov as f32 * (1.0 - 0.27 * self.armas.ap_k) };
            if self.fov_b == 0.0 { self.fov_b = z; } self.fov_b += (z - self.fov_b) * (dt * if (z - self.fov_b).abs() > 10.0 { 12.0 } else { 4.0 }).min(1.0);
            let p = persp(self.fov_b.to_radians(), wf / hf.max(1.0), 0.08, mp.lejos * 1.05);
            // (la cámara: en primera, los ojos; en tercera, 3,1 m atrás; de frente, 2,6 m adelante mirándote —jugadorCamara—;
            // si hay una pared en el medio, se acerca)
            let tam = self.pj.as_ref().map(|p| p.tam).unwrap_or(1.0); let kt = (0.45 + 0.55 * tam).clamp(0.6, 1.0);
            let (cam, mira) = match self.camara {
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
            };
            // (el temblor de las explosiones)
            let cam = if self.temblor > 0.001 { let k = self.temblor * 0.06; [cam[0] + tj[0] * k, cam[1] + tj[1] * k, cam[2] + tj[2] * k] } else { cam };
            self.temblor = (self.temblor - dt * 1.5).max(0.0); if self.golpe_t > 0.0 { self.golpe_t -= dt; }
            let vista = m4::mirar(cam, [cam[0] + mira[0], cam[1] + mira[1], cam[2] + mira[2]], [0.0, 1.0, 0.0]);
            // (con los ojos bajo el agua: la niebla de cerca, del color del agua —aguaNiebla—)
            let mut luz = mp.luz;
            if self.jug.aguas.iter().any(|v| cam[1] < v[4] && cam[1] > v[1] && cam[0] >= v[0] && cam[0] <= v[3] && cam[2] >= v[2] && cam[2] <= v[5]) {
                let lin = |c: f32| c.max(0.0).powf(2.2);
                luz.nie = jxmotor::escena::Niebla { c: [lin(0.12), lin(0.285), lin(0.3)], a: 0.0, b: 16.0, m: 1.0, s: [0.0; 3] };
            }
            let mut items = mp.items.clone();
            if self.camara != 0 { if let Some(pj) = &self.pj { let jp = self.jug.pos; pj.items(&personaje::base([jp[0], jp[1] - 0.95, jp[2]], self.jug.yaw), &mut items); } }
            // (en primera persona, el arma delante de la cámara; y el rayo de la Physics Gun, de la boca a lo agarrado)
            if self.camara == 0 && !self.armas.zoom { if let Some(v) = self.vista.as_mut() {
                if self.armas.ap_k > 0.002 && v.ads_tok != self.armas.ap_tok { v.calcular_ads(self.armas.ap_tok); }
                v.ubicar(ojos, qcam(yaw, pitch), self.sway, self.armas.ap_k); v.items(&mut items);
            } }
            self.proyectiles_items(&mut items);
            if let (Some(p1), Some(a), true) = (self.armas.punto_agarrado(&self.fis), self.armas.agarre.as_ref(), self.tubo_ok) {
                let p0 = self.vista.as_ref().filter(|_| self.camara == 0).and_then(|v| v.punta()).unwrap_or([ojos[0], ojos[1] - 0.2, ojos[2]]);
                let mid = [ojos[0] + fw[0] * a.dist * 0.5, ojos[1] + fw[1] * a.dist * 0.5, ojos[2] + fw[2] * a.dist * 0.5];
                vista::rayo_items(p0, mid, p1, self.t0.elapsed().as_secs_f32(), &mut items);
            }
            let t_fis = (self.acum_fis / PASO_FIS).clamp(0.0, 1.0);
            for o in &self.objs { if let Some(pf) = self.prefabs.get(&o.nombre) { pf.items(&matriz_obj(o, t_fis), &mut items); } }
            let mut luces = mp.luces_cerca(ojos, 6);
            self.herramientas_items(&mut items, &mut luces); luces.truncate(8);
            let c = Cuadro { vp: m4::mul(&p, &vista), pos: cam, luz, agua_y: mp.agua_y, tiempo: self.t0.elapsed().as_secs_f32(),
                luces, esp: vec![], items, efectos: vec![] };
            m.poner_cuadro(c);
        }
        let u = self.hud(w, h, placa_txt);
        m.dibujar(w, h, self.mapa.is_some(), &u)
    }

    fn azar(&mut self) -> f32 { self.azar ^= self.azar << 13; self.azar ^= self.azar >> 17; self.azar ^= self.azar << 5; (self.azar % 10000) as f32 / 10000.0 }
    /// de qué es el piso: por ahora el del mapa (pasto en gm_flatgrass, hormigón en gm_construct); con el triángulo que
    /// se pisa cuando el mundo lo diga
    fn piso(&self) -> &'static str { if self.mapas[self.mapa_i].contains("Flatgrass") { "grass" } else { "concrete" } }
    /// los sonidos del jugador este cuadro (sonPasos de sonidos.js y los del agua de agua.js)
    fn sonidos(&mut self, dt: f32, ojos: [f32; 3], ent: &Entrada) {
        self.sonido.oyente = (ojos, self.jug.yaw);
        if !self.sonido.suena() || self.mapa.is_none() { return; }
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
        let (Some(mm), Some(paq)) = (self.menu.as_mut(), self.paq.as_ref()) else { return };
        if mm.pestana != 0 { return; }
        if mm.atlas_de == Some(mm.sub) { return; }
        let Some((_, items)) = self.catalogo.get(mm.sub) else { return };
        let n = items.len() as u32; let filas = n.div_ceil(ICO_COLS).max(1); let (aw, ah) = (1024u32, (filas * ICO).next_power_of_two());
        let mut px = vec![0u8; (aw * ah * 4) as usize];
        for (k, it) in items.iter().enumerate() {
            let Some(ic) = objetos::icono(paq, it, ICO) else { continue };
            let (cx, cy) = ((k as u32 % ICO_COLS) * ICO, (k as u32 / ICO_COLS) * ICO);
            for y in 0..ICO { let d = (((cy + y) * aw + cx) * 4) as usize; let s = ((y * ICO) * 4) as usize; px[d..d + (ICO * 4) as usize].copy_from_slice(&ic[s..s + (ICO * 4) as usize]); }
        }
        let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![], texs: vec![Tex { id: TEX_ICONOS, n: "iconos".into(), w: aw, h: ah, a: 1, o: 0 }], lms: vec![], items: vec![], agua: None, cielo: None };
        let _ = unsafe { m.cargar(&Escena { c: cab, datos: px }) };
        mm.atlas_de = Some(mm.sub); mm.atlas_h = ah;
    }
    /// pone un objeto donde mira el jugador (o 6 m adelante), mirándolo y apoyado en el piso (spawnDelante y crearObjeto)
    fn poner(&mut self, m: &mut Motor3d, nombre: &str, ojos: [f32; 3], fw: [f32; 3]) -> Result<(), String> {
        let Some(mp) = self.mapa.as_ref() else { return Ok(()) };
        // (el rayo ve el mapa y los objetos: mirando uno, el nuevo se pone arriba)
        let (o64, d64) = ([ojos[0] as f64, ojos[1] as f64, ojos[2] as f64], [fw[0] as f64, fw[1] as f64, fw[2] as f64]);
        let p = match self.fis.rayo(&mp.mundo, o64, d64, 40.0, &[]) { Some(g) => { let t = (g.t as f32 - 0.05).max(0.5); [ojos[0] + fw[0] * t, ojos[1] + fw[1] * t, ojos[2] + fw[2] * t] }
            None => { let mut q = [ojos[0] + fw[0] * 6.0, ojos[1] + fw[1] * 6.0, ojos[2] + fw[2] * 6.0]; if let Some(g) = mp.mundo.rayo(q, [0.0, -1.0, 0.0], 50.0) { q[1] -= g.t; } q } };
        self.crear_en(m, nombre, p, self.jug.yaw + std::f32::consts::PI)
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
            let ci = pfz.cap_q.map(|c| [-c[0] as f32, -c[1] as f32, -c[2] as f32, c[3] as f32]).unwrap_or([0.0, 0.0, 0.0, 1.0]);
            self.objs.push(Obj { nombre: nombre.to_string(), pos: bp, q: bq, c: [pfz.c[0] as f32, pfz.c[1] as f32, pfz.c[2] as f32], cuerpo: Some(id), cap_inv: ci, ant: (bp, bq), masa, id: id_obj, logica: None, log_base: None,
                tipo: pfz.tipo, vida: if pfz.tipo == "explota" || pfz.tipo == "interactivo" { 1.0 } else { 0.0 }, exploto: false });
        } else {
            // (sin forma: fijo, con lo más bajo de su caja en el piso)
            let pp = [p[0], p[1] - pf.caja[1] + 0.01, p[2]];
            self.objs.push(Obj { nombre: nombre.to_string(), pos: pp, q, c: [0.0; 3], cuerpo: None, cap_inv: [0.0, 0.0, 0.0, 1.0], ant: (pp, q), masa: 0.0, id: id_obj, logica: None, log_base: None, tipo: "prop", vida: 0.0, exploto: false });
        }
        self.avisar(format!("Puesto: {nombre}"));
        Ok(Some(self.objs.len() - 1))
    }

    /// el HUD: los vértices de la interfaz (8 floats cada uno)
    fn hud(&self, w: i32, h: i32, placa_txt: &str) -> Vec<(i64, Vec<f32>)> {
        let (wf, hf) = (w as f32, h as f32);
        let Some(l) = &self.letras else { return vec![] };
        let mut ic: Vec<f32> = vec![]; let mut ia: Vec<f32> = vec![];
        let mut u = vec![]; let t = hf * 0.032; let (bl, gr) = ([1.0, 1.0, 1.0, 1.0], [0.0, 0.0, 0.0, 0.45]);
        let usa = self.en_uso;
        if self.aj.fps {
            let (ew, eh) = ((wf * self.aj.res as f32 / 100.0).round(), (hf * self.aj.res as f32 / 100.0).round());
            l.texto_sombra(&mut u, t * 0.5, t * 0.5, t, bl, &format!("{:.0} fps · cuadro {:.1} ms · placa {:.1} ms · {}×{}", self.fps, self.ms, self.placa_ms, ew, eh));
            l.texto_sombra(&mut u, t * 0.5, t * 1.75, t * 0.7, [1.0, 1.0, 1.0, 0.85], &format!("JXMod nativo (Rust) · {} · {} · {}", usa.nombre(), self.calidad_txt(), placa_txt));
            l.texto_sombra(&mut u, t * 0.5, t * 2.7, t * 0.7, [1.0, 1.0, 1.0, 0.85], &format!("{} · {} · vida {:.0}", self.mapas[self.mapa_i], if self.jug.noclip { "volando" } else if self.jug.nada { "nadando" } else if self.jug.suelo { "en el piso" } else { "en el aire" }, self.jug.vida));
            if !self.detalle.is_empty() { l.texto_sombra(&mut u, t * 0.5, t * 3.65, t * 0.6, [1.0, 1.0, 1.0, 0.75], &format!("placa: {}", self.detalle)); }
        }
        // (los botones: Ajustes, saltar, agacharse, volar, objetos y deshacer)
        // (con un menú abierto, sólo el de Ajustes: los demás quedarían debajo del panel)
        let abierto = self.menu.is_some() || self.ajustes.is_some();
        for b in botones(wf, hf) {
            if (abierto && b.b != Boton::Ajustes) || !self.boton_visible(b.b) { continue; }
            let nom_arma: &str = &{ let d = self.armas.def(); if d.car > 0 { if self.armas.recargando > 0.0 { format!("{} · recargando", d.nom) } else { format!("{} · {} | ∞", d.nom, self.armas.balas.get(self.armas.i).copied().unwrap_or(d.car)) } } else { d.nom.to_string() } };
            let (n, elegido) = match b.b {
                Boton::Disparo => (match self.armas.def().tipo { "fisica" => if self.armas.agarre.is_some() { "Soltar" } else { "Agarrar" }, "golpe" => "Pegar", _ => "Disparar" }, self.armas.agarre.is_some() || self.armas.grav.is_some() || self.apretado(Boton::Disparo)),
                Boton::Disparo2 => (match self.armas.def().n { "PhysicsGun" => if self.armas.agarre.is_some() { "Congelar" } else { "2" }, "GravityGun" => if self.armas.grav.is_some() { "Soltar" } else { "Levantar" }, _ => if self.armas.def().mira { "Mira" } else if matches!(self.armas.def().tipo, "bala" | "perdigones") { "Apuntar" } else { "2" } }, self.armas.apunta || self.armas.zoom),
                Boton::Arma => (nom_arma, self.armas.barra_t > 0.0),
                Boton::Recargar => ("R", self.armas.recargando > 0.0),
                Boton::ArmaN(k) => (ARMAS[k].nom, k == self.armas.i),
                Boton::Girar => ("Girar", self.armas.rotar),
                Boton::Lejos => ("+", false),
                Boton::Cerca => ("−", false),
                Boton::Ajustes => ("Ajustes", self.ajustes.is_some()),
                Boton::Camara => (["Primera", "Tercera", "De frente"][self.camara as usize], self.camara != 0),
                Boton::Saltar => ("Saltar", self.apretado(Boton::Saltar)),
                Boton::Agachar => ("Agachar", self.apretado(Boton::Agachar)),
                Boton::Volar => ("Volar", self.jug.noclip),
                Boton::Objetos => ("Objetos", self.menu.is_some()),
                Boton::Deshacer => ("Deshacer", false),
            };
            if b.redondo {
                l.disco(&mut u, b.x, b.y, b.w / 2.0, if elegido { [0.95, 0.66, 0.1, 0.8] } else { [0.0, 0.0, 0.0, 0.35] });
                l.anillo(&mut u, b.x, b.y, b.w / 2.0, [1.0, 1.0, 1.0, 0.5]);
                // (un signo solo, grande; las palabras, achicadas hasta que entren en el círculo)
                let mut tt = if n.chars().count() == 1 { b.w * 0.42 } else { (b.w * 0.2).min(t * 0.8) };
                while l.ancho(tt, n) > b.w * 0.84 && tt > 4.0 { tt *= 0.92; }
                let an = l.ancho(tt, n);
                l.texto(&mut u, b.x - an / 2.0, b.y - tt * 0.55, tt, if elegido { [0.0, 0.0, 0.0, 1.0] } else { bl }, n);
            } else {
                l.caja(&mut u, b.x - b.w / 2.0, b.y - b.h / 2.0, b.w, b.h, b.h * 0.24, if elegido { [0.95, 0.66, 0.1, 0.92] } else { gr });
                // (las armas, con su ícono a la izquierda)
                let ico = match b.b { Boton::ArmaN(k) => Some(k), Boton::Arma => Some(self.armas.i), _ => None }.filter(|_| self.armas_ico);
                let (mut tt, mut x0) = (t * 0.8, b.x);
                if let Some(k) = ico {
                    let lado = b.h * 0.92; let (cx, cy) = ((k as u32 % ICO_COLS) * ICO, (k as u32 / ICO_COLS) * ICO); let (aw, ah) = (1024.0f32, self.armas_ico_h as f32);
                    rect_uv(&mut ia, b.x - b.w / 2.0 + 4.0, b.y - lado / 2.0, lado * 1.3, lado, [cx as f32 / aw, cy as f32 / ah, (cx + ICO) as f32 / aw, (cy + ICO) as f32 / ah], [1.0; 4]);
                    x0 = b.x + lado * 0.65; tt = (t * 0.8).min(b.h * 0.42); while l.ancho(tt, n) > b.w - lado * 1.4 - 8.0 && tt > 4.0 { tt *= 0.92; }
                }
                let an = l.ancho(tt, n);
                l.texto(&mut u, x0 - an / 2.0, b.y - tt * 0.55, tt, if elegido { [0.0, 0.0, 0.0, 1.0] } else { bl }, n);
            }
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
        // (la mira: un punto con borde en el medio)
        if !abierto && self.mapa.is_some() { l.disco(&mut u, wf / 2.0, hf / 2.0, hf * 0.006, [1.0, 1.0, 1.0, 0.9]); l.anillo(&mut u, wf / 2.0, hf / 2.0, hf * 0.009, [0.0, 0.0, 0.0, 0.5]); }
        // (el aire, con los ojos bajo el agua: una barra que se vacía)
        if self.jug.aire < 11.99 && self.menu.is_none() {
            let (bw, bh) = (wf * 0.22, hf * 0.025); let (x, y) = ((wf - bw) / 2.0, hf * 0.86);
            l.caja(&mut u, x, y, bw, bh, bh * 0.5, [0.0, 0.0, 0.0, 0.5]);
            l.caja(&mut u, x, y, bw * (self.jug.aire / 12.0).clamp(0.0, 1.0), bh, bh * 0.5, [0.45, 0.75, 1.0, 0.9]);
            l.texto_sombra(&mut u, x, y - t * 0.85, t * 0.65, bl, "Aire");
        }
        // (la palanca: dónde se apoyó el dedo y hasta dónde llega)
        if let Some(d) = self.dedos.iter().find(|d| d.palanca) {
            let r = hf * 0.12; l.disco(&mut u, d.x0, d.y0, r * 1.12, [0.0, 0.0, 0.0, 0.18]); l.anillo(&mut u, d.x0, d.y0, r * 1.12, [1.0, 1.0, 1.0, 0.45]);
            let (mut kx, mut ky) = (d.x - d.x0, d.y - d.y0); let n = (kx * kx + ky * ky).sqrt(); if n > r { kx *= r / n; ky *= r / n; }
            l.disco(&mut u, d.x0 + kx, d.y0 + ky, r * 0.42, [1.0, 1.0, 1.0, 0.55]);
        } else if !abierto { l.texto_sombra(&mut u, t * 0.5, hf - t * 1.6, t * 0.7, [1.0, 1.0, 1.0, 0.7], "moverse: tocá a la izquierda · mirar: arrastrá a la derecha"); }
        if self.mapa.is_none() && self.recargar && self.error.is_none() {
            let txt = format!("Cargando {}…", self.mapas[self.mapa_i]); let tt = t * 1.3; let an = l.ancho(tt, &txt);
            l.texto_sombra(&mut u, (wf - an) / 2.0, hf * 0.47, tt, bl, &txt);
        }
        // el menú de objetos: las subcategorías a la izquierda, la grilla con los íconos y los nombres
        if let Some(mm) = &self.menu {
            let her = mm.pestana == 1;
            let p = panel(wf, hf, if her { self.her.lista.len() } else { self.catalogo.len() });
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
            else { for (k, (n, _)) in self.catalogo.iter().enumerate() {
                let y = p.y0 + hf * 0.08 + k as f32 * p.tab_h; let sel = k == mm.sub;
                l.caja(&mut u, p.x0 + hf * 0.015, y, p.gx - p.x0 - hf * 0.04, p.tab_h - hf * 0.008, hf * 0.012, if sel { [0.95, 0.66, 0.1, 0.92] } else { [1.0, 1.0, 1.0, 0.08] });
                let tt = (p.tab_h * 0.5).min(t * 0.75); l.texto(&mut u, p.x0 + hf * 0.035, y + (p.tab_h - tt) / 2.0 - hf * 0.004, tt, if sel { [0.0, 0.0, 0.0, 1.0] } else { bl }, n);
            }
            if let Some((_, items)) = self.catalogo.get(mm.sub) {
                let (aw, ah) = (1024.0f32, mm.atlas_h.max(1) as f32);
                for (k, it) in items.iter().enumerate() {
                    let (col, fila) = (k % p.cols, k / p.cols);
                    let (x, y) = (p.gx + col as f32 * p.celda, p.gy + fila as f32 * p.celda - mm.scroll);
                    if y + p.celda < p.gy || y > p.gy + p.gh { continue; }
                    l.caja(&mut u, x + 3.0, y + 3.0, p.celda - 6.0, p.celda - 6.0, hf * 0.012, [1.0, 1.0, 1.0, 0.07]);
                    let tt = (p.celda * 0.12).min(t * 0.6); let nom: String = it.chars().take(16).collect(); let an = l.ancho(tt, &nom);
                    l.texto(&mut u, x + (p.celda - an) / 2.0, y + p.celda - tt * 1.5, tt, [1.0, 1.0, 1.0, 0.9], &nom);
                    if mm.atlas_de == Some(mm.sub) {
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
                0 if self.en_uso == Placa::Gl2 => "OpenGL 2 sólo usa la resolución y el retoque (no tiene sombras, oclusión ni reflejos)",
                0 => "Patata y Bajo: sin sombras · Medio: sombras de 1024 cada 2 cuadros · Ultra: todo, con oclusión",
                3 => "El motor se cambia al momento y queda guardado para la próxima vez",
                _ => "",
            };
            if !nota.is_empty() { l.texto(&mut u, p.gx, p.gy + claves.len() as f32 * hf * 0.105 + hf * 0.02, t * 0.6, [1.0, 1.0, 1.0, 0.6], nota); }
        }
        // (el aviso, arriba de los menús: lo que se acaba de elegir se ve)
        if let Some((a, ta)) = &self.aviso {
            if ta.elapsed().as_secs_f32() < 4.0 { let an = l.ancho(t, a); l.caja(&mut u, (wf - an) / 2.0 - t * 0.8, hf * 0.42, an + t * 1.6, t * 1.8, t * 0.5, [0.0, 0.0, 0.0, 0.6]); l.texto(&mut u, (wf - an) / 2.0, hf * 0.42 + t * 0.4, t, bl, a); }
        }
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
        vec![(TEX_LETRAS, u), (TEX_ICONOS, ic), (TEX_ARMAS, ia)]
    }

    /// la calidad, para el HUD
    fn calidad_txt(&self) -> String { if self.aj.calidad < ajustes::PERSONAL { format!("{} {}%", ajustes::CALIDADES[self.aj.calidad], self.aj.res) } else { format!("personal {}%", self.aj.res) } }
    /// lo que tardó el cuadro entero (ms, con la espera a la pantalla) y los cuadros por segundo
    pub fn medir(&mut self, ms: f32) {
        self.ms = if self.cuenta == 0 { ms } else { self.ms * 0.9 + ms * 0.1 }; self.cuenta += 1; self.n_med += 1;
        let e = self.t_med.elapsed().as_secs_f32(); if e >= 0.5 { self.fps = self.n_med as f32 / e; self.n_med = 0; self.t_med = Instant::now(); }
    }
}
