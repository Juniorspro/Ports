//! El juego, igual en el teléfono y en la compu (las pruebas): el mapa, la cámara con el tacto, los botones de los motores
//! y el HUD. Lo de Android (la ventana, EGL, los eventos) está en app.rs.
use jxjuego::jugador::{Entrada, Jugador};
use jxjuego::mapa::{self, Mapa};
use jxjuego::objetos::{self, Cargados, Prefab};
use std::collections::HashMap;
use jxjuego::paquete::Paquete;
use jxjuego::texto::Letras;
use jxmotor::escena::{Cabecera, Cuadro, Escena, Tex};
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
pub enum Boton { Motor(usize), Mapa, Saltar, Agachar, Volar, Objetos, Deshacer }
/// un botón: qué es, el centro, el tamaño (ancho y alto; los redondos con el mismo) y si es redondo
struct Btn { b: Boton, x: f32, y: f32, w: f32, h: f32, redondo: bool }
/// dónde va cada botón con la pantalla de w × h
fn botones(w: f32, h: f32) -> Vec<Btn> {
    let mut v = vec![];
    let (x0, bw, bh) = (w * 0.45, w * 0.55 / 4.0, h * 0.1);
    for k in 0..4 { v.push(Btn { b: if k < 3 { Boton::Motor(k) } else { Boton::Mapa }, x: x0 + bw * (k as f32 + 0.5), y: 6.0 + (bh - 8.0) / 2.0, w: bw - 8.0, h: bh - 8.0, redondo: false }); }
    let r = h * 0.11;
    v.push(Btn { b: Boton::Saltar, x: w - h * 0.17, y: h - h * 0.2, w: r * 2.0, h: r * 2.0, redondo: true });
    v.push(Btn { b: Boton::Agachar, x: w - h * 0.17, y: h - h * 0.47, w: r * 1.5, h: r * 1.5, redondo: true });
    v.push(Btn { b: Boton::Volar, x: w - h * 0.44, y: h - h * 0.14, w: r * 1.3, h: r * 1.3, redondo: true });
    v.push(Btn { b: Boton::Objetos, x: w - h * 0.17, y: h * 0.27, w: r * 1.5, h: r * 1.5, redondo: true });
    v.push(Btn { b: Boton::Deshacer, x: w - h * 0.44, y: h * 0.27, w: r * 1.3, h: r * 1.3, redondo: true });
    v
}
/// la textura de los íconos del menú (un atlas armado con los de la subcategoría abierta)
pub const TEX_ICONOS: i64 = -2001;
const ICO: u32 = 96;
const ICO_COLS: u32 = 10;
/// el menú de objetos abierto: qué subcategoría, cuánto bajó la grilla y de qué subcategoría es el atlas cargado
pub struct Menu { pub sub: usize, pub scroll: f32, atlas_de: Option<usize>, atlas_h: u32 }
/// dónde va cada cosa del menú (con la pantalla de w × h y n subcategorías)
struct Panel { x0: f32, y0: f32, pw: f32, ph: f32, tab_h: f32, gx: f32, gy: f32, gw: f32, gh: f32, celda: f32, cols: usize }
fn panel(w: f32, h: f32, nsub: usize) -> Panel {
    let (x0, y0, pw, ph) = (w * 0.04, h * 0.12, w * 0.92, h * 0.85);
    let tab_h = ((ph - h * 0.1) / nsub.max(1) as f32).min(h * 0.08);
    let (gx, gy) = (x0 + pw * 0.22, y0 + h * 0.09); let (gw, gh) = (pw * 0.77, ph - h * 0.1);
    let celda = h * 0.19; let cols = ((gw / celda).floor() as usize).max(1);
    Panel { x0, y0, pw, ph, tab_h, gx, gy, gw, gh, celda: gw / cols as f32, cols }
}
/// un objeto puesto en el mundo (por ahora fijo donde se puso: la física llega con fisica.rs)
pub struct Obj { pub nombre: String, pub pos: [f32; 3], pub q: [f32; 4], pub c: [f32; 3] }
fn rect_uv(v: &mut Vec<f32>, x: f32, y: f32, w: f32, h: f32, uv: [f32; 4], col: [f32; 4]) {
    let p = [(x, y, uv[0], uv[1]), (x + w, y, uv[2], uv[1]), (x + w, y + h, uv[2], uv[3]), (x, y, uv[0], uv[1]), (x + w, y + h, uv[2], uv[3]), (x, y + h, uv[0], uv[3])];
    for (a, b, c, d) in p { v.extend_from_slice(&[a, b, c, d, col[0], col[1], col[2], col[3]]); }
}
/// la matriz de un objeto: su lugar y su giro, corrido por su centro (objetoMatriz)
fn matriz_obj(o: &Obj) -> M4 {
    let b = mapa::trs(o.pos, o.q, [1.0; 3]); let c = m4::mul(&b, &mapa::trs([-o.c[0], -o.c[1], -o.c[2]], [0.0, 0.0, 0.0, 1.0], [1.0; 3])); c
}
fn boton_en(w: f32, h: f32, x: f32, y: f32) -> Option<Boton> {
    botones(w, h).into_iter().find(|b| if b.redondo { let (dx, dy) = (x - b.x, y - b.y); dx * dx + dy * dy <= (b.w * 0.55).powi(2) } else { (x - b.x).abs() <= b.w / 2.0 + 4.0 && (y - b.y).abs() <= b.h / 2.0 + 4.0 }).map(|b| b.b)
}
/// el paso fijo de la física del jugador
const PASO: f32 = 1.0 / 120.0;

pub struct Juego {
    paq: Option<Paquete>, pub mapa: Option<Mapa>, mapas: Vec<&'static str>, mapa_i: usize,
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
        let letras = letras_json.and_then(|t| Letras::de_json(&t).ok());
        let letras_px = letras_png.and_then(png_rgba);
        let (paq, error) = match paq { Ok(p) => (Some(p), None), Err(e) => (None, Some(format!("el paquete del juego: {e}"))) };
        let mut j = Juego { paq, mapa: None, mapas: vec!["RB_Flatgrass", "RB_Construct"], mapa_i: 0, letras, letras_px, jug: Jugador::nuevo(), acum: 0.0,
            dedos: vec![], placa, aviso: None, datos, t_ant: Instant::now(), t0: Instant::now(), fps: 0.0, ms: 0.0, cuenta: 0, t_med: Instant::now(), n_med: 0, placa_ms: 0.0,
            recargar: true, dt_fijo: None, error, mapa_cartel: false, en_uso: Placa::Gl3, cambiar_motor: false, detalle: String::new(),
            nombres: HashMap::new(), catalogo: vec![], menu: None, prefabs: HashMap::new(), cargados: Cargados::default(), objs: vec![], pendientes: vec![] };
        if let Some(p) = &j.paq { j.nombres = objetos::por_nombre(&p.d); j.catalogo = objetos::menu(&p.d, "Props"); }
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
        match self.mapas.iter().position(|m| *m == nombre) { Some(i) => { self.mapa_i = i; self.recargar = true; true } None => false }
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
        if self.menu.is_some() { self.dedos.push(Dedo { id, palanca: false, boton: None, x0: x, y0: y, x, y }); return; }
        if let Some(b) = boton_en(w, h, x, y) {
            match b {
                Boton::Motor(k) => self.elegir_motor(k),
                Boton::Mapa => { self.mapa_i = (self.mapa_i + 1) % self.mapas.len(); self.recargar = true; }
                Boton::Volar => { self.jug.noclip = !self.jug.noclip; self.avisar(if self.jug.noclip { "Volar: prendido".into() } else { "Volar: apagado".into() }); }
                Boton::Objetos => { if !self.catalogo.is_empty() { self.menu = Some(Menu { sub: 0, scroll: 0.0, atlas_de: None, atlas_h: 0 }); } }
                Boton::Deshacer => { if let Some(o) = self.objs.pop() { self.avisar(format!("Deshecho: {}", o.nombre)); } }
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
        if let Some(m) = self.menu.as_mut() {
            // (en el menú, arrastrar baja la grilla)
            if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) { m.scroll = (m.scroll - (y - d.y)).max(0.0); d.x = x; d.y = y; }
            return;
        }
        if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) {
            if !d.palanca && d.boton.is_none() { let s = 0.0045 * 1080.0 / h.max(1.0); self.jug.yaw -= (x - d.x) * s; self.jug.pitch = (self.jug.pitch - (y - d.y) * s).clamp(-1.5, 1.5); }
            d.x = x; d.y = y;
        }
    }
    /// al soltar: en el menú, un toque (sin arrastrar) elige
    pub fn dedo_arriba_en(&mut self, id: i32, w: f32, h: f32) {
        if self.menu.is_some() {
            if let Some(d) = self.dedos.iter().find(|d| d.id == id) { if (d.x - d.x0).abs() + (d.y - d.y0).abs() < h * 0.03 { let (x, y) = (d.x, d.y); self.toque_menu(x, y, w, h); } }
        }
        self.dedo_arriba(id);
    }
    pub fn dedo_arriba(&mut self, id: i32) { self.dedos.retain(|d| d.id != id); }
    fn toque_menu(&mut self, x: f32, y: f32, w: f32, h: f32) {
        let Some(m) = self.menu.as_mut() else { return };
        let p = panel(w, h, self.catalogo.len());
        // (la X de cerrar, arriba a la derecha del panel; o tocar afuera)
        if (x > p.x0 + p.pw - h * 0.1 && y < p.y0 + h * 0.08) || x < p.x0 || x > p.x0 + p.pw || y < p.y0 || y > p.y0 + p.ph { self.menu = None; return; }
        if x < p.gx - p.pw * 0.01 {
            let k = ((y - p.y0 - h * 0.02) / p.tab_h).floor() as i64;
            if k >= 0 && (k as usize) < self.catalogo.len() { m.sub = k as usize; m.scroll = 0.0; }
            return;
        }
        let (col, fila) = (((x - p.gx) / p.celda).floor() as i64, ((y - p.gy + m.scroll) / p.celda).floor() as i64);
        if col < 0 || col as usize >= p.cols || fila < 0 { return; }
        let i = fila as usize * p.cols + col as usize;
        if let Some(n) = self.catalogo.get(m.sub).and_then(|s| s.1.get(i)) { self.pendientes.push(n.clone()); }
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
        let nombre = self.mapas[self.mapa_i];
        self.mapa = None;
        self.objs.clear(); self.prefabs.clear(); self.cargados.olvidar(); if let Some(mm) = self.menu.as_mut() { mm.atlas_de = None; }
        unsafe { m.vaciar(); }
        let Some(paq) = self.paq.as_mut() else { return };
        match mapa::armar(paq, nombre, 1024, 750.0) {
            Ok(mp) => {
                if let Err(e) = unsafe { m.cargar(&mp.esc) } { self.aviso = Some((format!("mapa {nombre}: {e}"), Instant::now())); }
                let sp = mp.spawns.first().map(|s| s.0).unwrap_or([0.0, 1.0, 0.0]);
                let yaw = mp.spawns.first().and_then(|s| s.1).unwrap_or(0.0);
                let noclip = self.jug.noclip;
                self.jug = Jugador::nuevo(); self.jug.noclip = noclip; self.acum = 0.0;
                self.jug.aparecer(&mp.mundo, sp, Some(yaw));
                self.mapa = Some(mp);
            }
            Err(e) => { self.error = Some(format!("mapa {nombre}: {e}")); }
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
            if self.paq.is_some() && !self.mapa_cartel { self.mapa_cartel = true; self.mapa = None; m.vaciar(); self.objs.clear(); self.prefabs.clear(); self.cargados.olvidar(); if let Some(mm) = self.menu.as_mut() { mm.atlas_de = None; } self.cargar_letras(m); }
            else { self.recargar = false; self.mapa_cartel = false; if self.paq.is_some() { self.cargar_mapa(m); } else { m.vaciar(); self.cargar_letras(m); } }
        }
        let ahora = Instant::now(); let dt = self.dt_fijo.unwrap_or((ahora - self.t_ant).as_secs_f32().min(0.1)); self.t_ant = ahora;
        let (wf, hf) = (w as f32, h as f32);
        // la física del jugador, a paso fijo (como mucho 12 pasos por cuadro: si el teléfono se traba, no se acumula)
        let ent = self.entrada(hf);
        if let Some(mp) = &self.mapa {
            self.acum = (self.acum + dt).min(PASO * 12.0);
            while self.acum >= PASO { self.jug.paso(&mp.mundo, PASO, &ent); self.acum -= PASO; }
            // (se cayó del mapa: vuelve a aparecer)
            if self.jug.pos[1] < mp.mundo.lo[1] - 60.0 { let sp = mp.spawns.first().map(|s| s.0).unwrap_or([0.0, 1.0, 0.0]); self.jug.aparecer(&mp.mundo, sp, None); }
        }
        let (ojos, _) = self.jug.ojos(dt);
        let (yaw, pitch) = (self.jug.yaw, self.jug.pitch);
        let fw = [yaw.sin() * pitch.cos(), pitch.sin(), yaw.cos() * pitch.cos()];
        self.menu_atlas(m);
        let pend = std::mem::take(&mut self.pendientes);
        for n in pend { if let Err(e) = self.poner(m, &n, ojos, fw) { self.avisar(format!("{n}: {e}")); } }
        if let Some(mp) = &self.mapa {
            let p = persp(75f32.to_radians(), wf / hf.max(1.0), 0.08, mp.lejos * 1.05);
            let vista = m4::mirar(ojos, [ojos[0] + fw[0], ojos[1] + fw[1], ojos[2] + fw[2]], [0.0, 1.0, 0.0]);
            let mut items = mp.items.clone();
            for o in &self.objs { if let Some(pf) = self.prefabs.get(&o.nombre) { pf.items(&matriz_obj(o), &mut items); } }
            let c = Cuadro { vp: m4::mul(&p, &vista), pos: ojos, luz: mp.luz, agua_y: mp.agua_y, tiempo: self.t0.elapsed().as_secs_f32(),
                luces: mp.luces_cerca(ojos, 6), esp: vec![], items, efectos: vec![] };
            m.poner_cuadro(c);
        }
        let u = self.hud(w, h, placa_txt);
        m.dibujar(w, h, self.mapa.is_some(), &u)
    }

    /// el atlas de íconos de la subcategoría abierta (se arma al abrirla)
    fn menu_atlas(&mut self, m: &mut Motor3d) {
        let (Some(mm), Some(paq)) = (self.menu.as_mut(), self.paq.as_ref()) else { return };
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
        let (Some(paq), Some(mp)) = (self.paq.as_mut(), self.mapa.as_ref()) else { return Ok(()) };
        if !self.prefabs.contains_key(nombre) {
            let (pf, esc) = objetos::armar(paq, &self.nombres, nombre, 512, &mut self.cargados)?;
            unsafe { m.cargar(&esc)?; }
            self.prefabs.insert(nombre.to_string(), pf);
        }
        let pf = &self.prefabs[nombre];
        let mut p = match mp.mundo.rayo(ojos, fw, 40.0) { Some(g) => { let t = (g.t - 0.05).max(0.5); [ojos[0] + fw[0] * t, ojos[1] + fw[1] * t, ojos[2] + fw[2] * t] }
            None => { let mut q = [ojos[0] + fw[0] * 6.0, ojos[1] + fw[1] * 6.0, ojos[2] + fw[2] * 6.0]; if let Some(g) = mp.mundo.rayo(q, [0.0, -1.0, 0.0], 50.0) { q[1] -= g.t; } q } };
        let a = self.jug.yaw + std::f32::consts::PI; let q = [0.0, (a / 2.0).sin(), 0.0, (a / 2.0).cos()];
        // (la base apoyada: lo más bajo de su caja, girada)
        let c = pf.caja; let (s, co) = (a.sin(), a.cos()); let _ = (s, co);
        let min_y = c[1];
        p[1] += -min_y + 0.01;
        self.objs.push(Obj { nombre: nombre.to_string(), pos: p, q, c: [0.0; 3] });
        self.avisar(format!("Puesto: {nombre}"));
        Ok(())
    }

    /// el HUD: los vértices de la interfaz (8 floats cada uno)
    fn hud(&self, w: i32, h: i32, placa_txt: &str) -> Vec<(i64, Vec<f32>)> {
        let (wf, hf) = (w as f32, h as f32);
        let Some(l) = &self.letras else { return vec![] };
        let mut ic: Vec<f32> = vec![];
        let mut u = vec![]; let t = hf * 0.032; let (bl, gr) = ([1.0, 1.0, 1.0, 1.0], [0.0, 0.0, 0.0, 0.45]);
        let usa = self.en_uso;
        l.texto_sombra(&mut u, t * 0.5, t * 0.5, t, bl, &format!("{:.0} fps · cuadro {:.1} ms · placa {:.1} ms · {}×{}", self.fps, self.ms, self.placa_ms, w, h));
        l.texto_sombra(&mut u, t * 0.5, t * 1.75, t * 0.7, [1.0, 1.0, 1.0, 0.85], &format!("JXMod nativo (Rust) · {} · {}", usa.nombre(), placa_txt));
        l.texto_sombra(&mut u, t * 0.5, t * 2.7, t * 0.7, [1.0, 1.0, 1.0, 0.85], &format!("{} · {}", self.mapas[self.mapa_i], if self.jug.noclip { "volando" } else if self.jug.suelo { "en el piso" } else { "en el aire" }));
        if !self.detalle.is_empty() { l.texto_sombra(&mut u, t * 0.5, t * 3.65, t * 0.6, [1.0, 1.0, 1.0, 0.75], &format!("placa: {}", self.detalle)); }
        // (los botones: los tres motores, el mapa, saltar, agacharse y volar)
        for b in botones(wf, hf) {
            let (n, elegido) = match b.b {
                Boton::Motor(k) => (Placa::lista()[k].nombre(), Placa::lista()[k] == self.placa),
                Boton::Mapa => ("Mapa", false),
                Boton::Saltar => ("Saltar", self.apretado(Boton::Saltar)),
                Boton::Agachar => ("Agachar", self.apretado(Boton::Agachar)),
                Boton::Volar => ("Volar", self.jug.noclip),
                Boton::Objetos => ("Objetos", self.menu.is_some()),
                Boton::Deshacer => ("Deshacer", false),
            };
            if b.redondo {
                l.disco(&mut u, b.x, b.y, b.w / 2.0, if elegido { [0.95, 0.66, 0.1, 0.8] } else { [0.0, 0.0, 0.0, 0.35] });
                l.anillo(&mut u, b.x, b.y, b.w / 2.0, [1.0, 1.0, 1.0, 0.5]);
                let tt = (b.w * 0.2).min(t * 0.8); let an = l.ancho(tt, n);
                l.texto(&mut u, b.x - an / 2.0, b.y - tt * 0.55, tt, if elegido { [0.0, 0.0, 0.0, 1.0] } else { bl }, n);
            } else {
                l.caja(&mut u, b.x - b.w / 2.0, b.y - b.h / 2.0, b.w, b.h, b.h * 0.24, if elegido { [0.95, 0.66, 0.1, 0.92] } else { gr });
                let tt = t * 0.8; let an = l.ancho(tt, n);
                l.texto(&mut u, b.x - an / 2.0, b.y - tt * 0.55, tt, if elegido { [0.0, 0.0, 0.0, 1.0] } else { bl }, n);
            }
        }
        // (la palanca: dónde se apoyó el dedo y hasta dónde llega)
        if let Some(d) = self.dedos.iter().find(|d| d.palanca) {
            let r = hf * 0.12; l.disco(&mut u, d.x0, d.y0, r * 1.12, [0.0, 0.0, 0.0, 0.18]); l.anillo(&mut u, d.x0, d.y0, r * 1.12, [1.0, 1.0, 1.0, 0.45]);
            let (mut kx, mut ky) = (d.x - d.x0, d.y - d.y0); let n = (kx * kx + ky * ky).sqrt(); if n > r { kx *= r / n; ky *= r / n; }
            l.disco(&mut u, d.x0 + kx, d.y0 + ky, r * 0.42, [1.0, 1.0, 1.0, 0.55]);
        } else { l.texto_sombra(&mut u, t * 0.5, hf - t * 1.6, t * 0.7, [1.0, 1.0, 1.0, 0.7], "moverse: tocá a la izquierda · mirar: arrastrá a la derecha"); }
        if let Some((a, ta)) = &self.aviso {
            if ta.elapsed().as_secs_f32() < 4.0 { let an = l.ancho(t, a); l.caja(&mut u, (wf - an) / 2.0 - t * 0.8, hf * 0.42, an + t * 1.6, t * 1.8, t * 0.5, [0.0, 0.0, 0.0, 0.6]); l.texto(&mut u, (wf - an) / 2.0, hf * 0.42 + t * 0.4, t, bl, a); }
        }
        if self.mapa.is_none() && self.recargar && self.error.is_none() {
            let txt = format!("Cargando {}…", self.mapas[self.mapa_i]); let tt = t * 1.3; let an = l.ancho(tt, &txt);
            l.texto_sombra(&mut u, (wf - an) / 2.0, hf * 0.47, tt, bl, &txt);
        }
        // el menú de objetos: las subcategorías a la izquierda, la grilla con los íconos y los nombres
        if let Some(mm) = &self.menu {
            let p = panel(wf, hf, self.catalogo.len());
            l.caja(&mut u, p.x0, p.y0, p.pw, p.ph, hf * 0.03, [0.07, 0.08, 0.11, 0.94]);
            l.texto(&mut u, p.x0 + hf * 0.03, p.y0 + hf * 0.02, t * 0.9, bl, &format!("Objetos · {}", self.catalogo.get(mm.sub).map(|s| s.0.as_str()).unwrap_or("")));
            l.caja(&mut u, p.x0 + p.pw - hf * 0.09, p.y0 + hf * 0.012, hf * 0.07, hf * 0.06, hf * 0.015, [0.6, 0.15, 0.12, 0.95]);
            { let an = l.ancho(t * 0.9, "X"); l.texto(&mut u, p.x0 + p.pw - hf * 0.055 - an / 2.0, p.y0 + hf * 0.02, t * 0.9, bl, "X"); }
            for (k, (n, _)) in self.catalogo.iter().enumerate() {
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
            }
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
        vec![(TEX_LETRAS, u), (TEX_ICONOS, ic)]
    }

    /// lo que tardó el cuadro entero (ms, con la espera a la pantalla) y los cuadros por segundo
    pub fn medir(&mut self, ms: f32) {
        self.ms = if self.cuenta == 0 { ms } else { self.ms * 0.9 + ms * 0.1 }; self.cuenta += 1; self.n_med += 1;
        let e = self.t_med.elapsed().as_secs_f32(); if e >= 0.5 { self.fps = self.n_med as f32 / e; self.n_med = 0; self.t_med = Instant::now(); }
    }
}
