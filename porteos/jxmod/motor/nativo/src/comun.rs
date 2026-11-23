//! El juego, igual en el teléfono y en la compu (las pruebas): el mapa, la cámara con el tacto, los botones de los motores
//! y el HUD. Lo de Android (la ventana, EGL, los eventos) está en app.rs.
use jxjuego::mapa::{self, Mapa};
use jxjuego::paquete::Paquete;
use jxjuego::texto::Letras;
use jxmotor::escena::{Cabecera, Cuadro, Escena, Tex};
use crate::motor::Motor3d;
use jxmotor::gpu::TEX_LETRAS;
use jxmotor::mat::{self as m4, M4};
use std::time::Instant;

/// los motores que se pueden elegir (hechos: Vulkan y OpenGL 3)
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Placa { Vulkan, Gl3, Gl2 }
impl Placa {
    pub fn nombre(self) -> &'static str { match self { Placa::Vulkan => "Vulkan", Placa::Gl3 => "OpenGL 3", Placa::Gl2 => "OpenGL 2" } }
    pub fn clave(self) -> &'static str { match self { Placa::Vulkan => "vk", Placa::Gl3 => "gl3", Placa::Gl2 => "gl2" } }
    pub fn de_clave(s: &str) -> Placa { match s.trim() { "vk" => Placa::Vulkan, "gl2" => Placa::Gl2, _ => Placa::Gl3 } }
    pub fn lista() -> [Placa; 3] { [Placa::Vulkan, Placa::Gl3, Placa::Gl2] }
    pub fn hecha(self) -> bool { self != Placa::Gl2 }
}

/// un dedo en la pantalla: para qué es (palanca o mirar) y dónde
struct Dedo { id: i32, palanca: bool, x0: f32, y0: f32, x: f32, y: f32 }

pub struct Juego {
    paq: Option<Paquete>, pub mapa: Option<Mapa>, mapas: Vec<&'static str>, mapa_i: usize,
    letras: Option<Letras>, letras_px: Option<(u32, u32, Vec<u8>)>,
    pub pos: [f32; 3], pub yaw: f32, pub pitch: f32,
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
        let mut j = Juego { paq, mapa: None, mapas: vec!["RB_Flatgrass", "RB_Construct"], mapa_i: 0, letras, letras_px, pos: [0.0; 3], yaw: 0.0, pitch: 0.0,
            dedos: vec![], placa, aviso: None, datos, t_ant: Instant::now(), t0: Instant::now(), fps: 0.0, ms: 0.0, cuenta: 0, t_med: Instant::now(), n_med: 0, placa_ms: 0.0,
            recargar: true, dt_fijo: None, error, mapa_cartel: false, en_uso: Placa::Gl3, cambiar_motor: false, detalle: String::new() };
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
        if y < h * 0.12 && x > w * 0.45 { self.boton(x, w); return; }
        self.dedos.push(Dedo { id, palanca: x < w * 0.45, x0: x, y0: y, x, y });
    }
    pub fn dedo_mueve(&mut self, id: i32, x: f32, y: f32, h: f32) {
        if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) {
            if !d.palanca { let s = 0.0045 * 1080.0 / h.max(1.0); self.yaw -= (x - d.x) * s; self.pitch = (self.pitch - (y - d.y) * s).clamp(-1.5, 1.5); }
            d.x = x; d.y = y;
        }
    }
    pub fn dedo_arriba(&mut self, id: i32) { self.dedos.retain(|d| d.id != id); }
    pub fn dedos_fuera(&mut self) { self.dedos.clear(); }

    /// los botones de arriba a la derecha: Vulkan, OpenGL 3, OpenGL 2 y el mapa
    fn boton(&mut self, x: f32, w: f32) {
        let k = ((x - w * 0.45) / (w * 0.55) * 4.0).floor() as i32;
        if (0..3).contains(&k) {
            let p = Placa::lista()[k as usize];
            if let Some(d) = &self.datos { let _ = std::fs::write(d.join("motor.txt"), p.clave()); }
            self.placa = p;
            let usar = if p.hecha() { p } else { Placa::Gl3 };
            if usar != self.en_uso { self.cambiar_motor = true; }
            self.aviso = Some((if p.hecha() { format!("Motor: {}", p.nombre()) } else { format!("{} todavía no está: se usa OpenGL 3 (queda elegido)", p.nombre()) }, Instant::now()));
        } else if k == 3 { self.mapa_i = (self.mapa_i + 1) % self.mapas.len(); self.recargar = true; }
    }

    /// arma el mapa elegido y pone al jugador donde aparece
    fn cargar_mapa(&mut self, m: &mut Motor3d) {
        let nombre = self.mapas[self.mapa_i];
        self.mapa = None;
        unsafe { m.vaciar(); }
        let Some(paq) = self.paq.as_mut() else { return };
        match mapa::armar(paq, nombre, 1024, 750.0) {
            Ok(mp) => {
                if let Err(e) = unsafe { m.cargar(&mp.esc) } { self.aviso = Some((format!("mapa {nombre}: {e}"), Instant::now())); }
                let sp = mp.spawns.first().map(|s| s.0).unwrap_or([0.0, 1.0, 0.0]);
                let yaw = mp.spawns.first().and_then(|s| s.1).unwrap_or(0.0);
                // (los ojos, a la altura de los de GMod sobre el punto de aparición)
                self.pos = [sp[0], sp[1] + 0.72, sp[2]]; self.yaw = yaw; self.pitch = 0.0;
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
            if self.paq.is_some() && !self.mapa_cartel { self.mapa_cartel = true; self.mapa = None; m.vaciar(); self.cargar_letras(m); }
            else { self.recargar = false; self.mapa_cartel = false; if self.paq.is_some() { self.cargar_mapa(m); } else { m.vaciar(); self.cargar_letras(m); } }
        }
        let ahora = Instant::now(); let dt = self.dt_fijo.unwrap_or((ahora - self.t_ant).as_secs_f32().min(0.1)); self.t_ant = ahora;
        // moverse: la palanca, por el plano (a la altura de los ojos: el piso y los choques son de la etapa 3)
        let fw = [self.yaw.sin() * self.pitch.cos(), self.pitch.sin(), self.yaw.cos() * self.pitch.cos()];
        let (adel, der) = ([self.yaw.sin(), 0.0, self.yaw.cos()], [-self.yaw.cos(), 0.0, self.yaw.sin()]);
        let (wf, hf) = (w as f32, h as f32);
        if let Some(d) = self.dedos.iter().find(|d| d.palanca) {
            let r = hf * 0.12; let (mut mx, mut my) = ((d.x - d.x0) / r, (d.y - d.y0) / r); let n = (mx * mx + my * my).sqrt(); if n > 1.0 { mx /= n; my /= n; }
            let vel = 6.0 * dt;
            for k in 0..3 { self.pos[k] += (adel[k] * -my + der[k] * mx) * vel; }
        }
        if let Some(mp) = &self.mapa {
            let p = persp(75f32.to_radians(), wf / hf.max(1.0), 0.08, mp.lejos * 1.05);
            let vista = m4::mirar(self.pos, [self.pos[0] + fw[0], self.pos[1] + fw[1], self.pos[2] + fw[2]], [0.0, 1.0, 0.0]);
            let c = Cuadro { vp: m4::mul(&p, &vista), pos: self.pos, luz: mp.luz, agua_y: None, tiempo: self.t0.elapsed().as_secs_f32(),
                luces: mp.luces_cerca(self.pos, 6), esp: vec![], items: mp.items.clone(), efectos: vec![] };
            m.poner_cuadro(c);
        }
        let u = self.hud(w, h, placa_txt);
        m.dibujar(w, h, self.mapa.is_some(), &u)
    }

    /// el HUD: los vértices de la interfaz (8 floats cada uno)
    fn hud(&self, w: i32, h: i32, placa_txt: &str) -> Vec<f32> {
        let (wf, hf) = (w as f32, h as f32);
        let Some(l) = &self.letras else { return vec![] };
        let mut u = vec![]; let t = hf * 0.032; let (bl, gr) = ([1.0, 1.0, 1.0, 1.0], [0.0, 0.0, 0.0, 0.45]);
        let usa = self.en_uso;
        l.texto_sombra(&mut u, t * 0.5, t * 0.5, t, bl, &format!("{:.0} fps · cuadro {:.1} ms · placa {:.1} ms · {}×{}", self.fps, self.ms, self.placa_ms, w, h));
        l.texto_sombra(&mut u, t * 0.5, t * 1.75, t * 0.7, [1.0, 1.0, 1.0, 0.85], &format!("JXMod nativo (Rust) · {} · {}", usa.nombre(), placa_txt));
        l.texto_sombra(&mut u, t * 0.5, t * 2.7, t * 0.7, [1.0, 1.0, 1.0, 0.85], &format!("{} · sin choques todavía", self.mapas[self.mapa_i]));
        if !self.detalle.is_empty() { l.texto_sombra(&mut u, t * 0.5, t * 3.65, t * 0.6, [1.0, 1.0, 1.0, 0.75], &format!("placa: {}", self.detalle)); }
        // (los botones: los tres motores y el mapa)
        let (x0, bw, bh) = (wf * 0.45, wf * 0.55 / 4.0, hf * 0.1);
        let nombres = [Placa::Vulkan.nombre(), Placa::Gl3.nombre(), Placa::Gl2.nombre(), "Mapa"];
        for (k, n) in nombres.iter().enumerate() {
            let x = x0 + bw * k as f32; let elegido = k < 3 && Placa::lista()[k] == self.placa;
            l.caja(&mut u, x + 4.0, 6.0, bw - 8.0, bh - 8.0, bh * 0.22, if elegido { [0.95, 0.66, 0.1, 0.92] } else { gr });
            let tt = t * 0.8; let an = l.ancho(tt, n);
            l.texto(&mut u, x + (bw - an) / 2.0, 2.0 + (bh - tt) / 2.0, tt, if elegido { [0.0, 0.0, 0.0, 1.0] } else { bl }, n);
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
        u
    }

    /// lo que tardó el cuadro entero (ms, con la espera a la pantalla) y los cuadros por segundo
    pub fn medir(&mut self, ms: f32) {
        self.ms = if self.cuenta == 0 { ms } else { self.ms * 0.9 + ms * 0.1 }; self.cuenta += 1; self.n_med += 1;
        let e = self.t_med.elapsed().as_secs_f32(); if e >= 0.5 { self.fps = self.n_med as f32 / e; self.n_med = 0; self.t_med = Instant::now(); }
    }
}
