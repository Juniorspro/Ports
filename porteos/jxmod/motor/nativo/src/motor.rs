//! Los motores para elegir, con lo mismo para el juego: Vulkan propio (jxmotor::vk), OpenGL 3 (jxmotor::gpu) y OpenGL 2
//! para los teléfonos viejos (jxmotor::gl2).
use jxmotor::escena::{Cuadro, Escena};

pub enum Motor3d {
    /// OpenGL 3: dibuja en `salida` (None: la ventana de EGL); la app pone el cuadro en la pantalla (eglSwapBuffers)
    Gl(jxmotor::gpu::Motor, Option<glow::Framebuffer>),
    /// Vulkan: dibuja y pone el cuadro en la pantalla él mismo
    Vk(jxmotor::vk::Motor),
    /// OpenGL 2: como OpenGL 3
    Gl2(jxmotor::gl2::Motor, Option<glow::Framebuffer>),
}

impl Motor3d {
    pub unsafe fn cargar(&mut self, e: &Escena) -> Result<(), String> { match self { Motor3d::Gl(m, _) => m.cargar(e), Motor3d::Vk(m) => m.cargar(e), Motor3d::Gl2(m, _) => m.cargar(e) } }
    pub unsafe fn vaciar(&mut self) { match self { Motor3d::Gl(m, _) => m.vaciar(), Motor3d::Vk(m) => m.vaciar(), Motor3d::Gl2(m, _) => m.vaciar() } }
    pub fn poner_cuadro(&mut self, c: Cuadro) { match self { Motor3d::Gl(m, _) => m.poner_cuadro(c), Motor3d::Vk(m) => m.poner_cuadro(c), Motor3d::Gl2(m, _) => m.poner_cuadro(c) } }
    /// JX Turbo: el cuadro intermedio —el último dibujado, corrido a la cámara `vp`— y la interfaz encima; false si este motor
    /// no lo tiene o todavía no hay cuadro guardado (OpenGL 3 por ahora)
    pub unsafe fn intermedio(&mut self, w: i32, h: i32, vp: &[f32; 16], ui: &[(i64, Vec<f32>)]) -> bool {
        match self {
            Motor3d::Gl(m, salida) => { if !m.intermedio(*salida, w, h, vp) { return false; } if !sin_ui() { for (t, v) in ui { m.ui(*salida, w, h, *t, v); } } true }
            _ => false,
        }
    }
    /// JX Turbo: si este motor puede armar ya un cuadro intermedio
    pub fn turbo_listo(&self, w: i32, h: i32) -> bool { match self { Motor3d::Gl(m, _) => m.turbo_listo(w, h), _ => false } }
    /// la cámara (vista y proyección) del último cuadro
    pub fn vp_actual(&self) -> Option<[f32; 16]> { match self { Motor3d::Gl(m, _) => m.c.as_ref().map(|c| c.vp), Motor3d::Gl2(m, _) => m.c.as_ref().map(|c| c.vp), Motor3d::Vk(m) => m.c.as_ref().map(|c| c.vp) } }
    /// los dibujos (llamadas a la placa) del último cuadro
    pub fn dibujos(&self) -> u32 { match self { Motor3d::Gl(m, _) => m.dibujos, Motor3d::Vk(m) => m.dibujos, Motor3d::Gl2(m, _) => m.dibujos } }
    /// la altura del piso que se reflejó en el último cuadro (Definitivo)
    pub fn piso_refleja(&self) -> Option<f32> { match self { Motor3d::Gl(m, _) => m.piso_refleja(), Motor3d::Vk(m) => m.piso_refleja(), Motor3d::Gl2(m, _) => m.piso_refleja() } }
    pub fn resumen(&self) -> String { match self { Motor3d::Gl(m, _) => m.resumen(), Motor3d::Vk(m) => m.resumen(), Motor3d::Gl2(m, _) => m.resumen() } }
    pub fn es_vulkan(&self) -> bool { matches!(self, Motor3d::Vk(_)) }
    /// si el motor dibuja el hongo de las nucleares con volumen (OpenGL 3 y 2 con la calidad en Bajo o más; si no, carteles)
    pub fn hongo_listo(&self) -> bool {
        match self {
            Motor3d::Gl(m, _) => m.op.hongo > 0 && m.hongos.listo(),
            Motor3d::Gl2(m, _) => m.op.hongo > 0 && m.hongo_puede(),
            Motor3d::Vk(_) => false,
        }
    }
    /// lo de Ajustes (la calidad): OpenGL 3 y Vulkan usan todo; OpenGL 2 sólo la resolución y el retoque
    pub fn opciones(&mut self, op: &jxmotor::gpu::Opciones) {
        match self {
            Motor3d::Gl(m, _) => m.op = op.clone(),
            Motor3d::Vk(m) => m.op = op.clone(),
            Motor3d::Gl2(m, _) => { m.op.escala = op.escala; m.op.retoque = op.retoque; m.op.sombras = op.sombras; m.op.sombra_px = op.sombra_px.min(1024); m.op.sombra_cada = op.sombra_cada.max(2); m.op.sombra_radio = (op.sombra_radio * 1.35).clamp(30.0, 60.0); m.op.reflejo = op.reflejo && op.sombras; m.op.reflejo_div = op.reflejo_div.max(3); m.op.reflejo_piso = std::env::var_os("JXM_GL2_SIN_PISO").is_none(); m.op.rayos = op.rayos && std::env::var_os("JXM_SIN_RAYOS").is_none(); m.op.hongo = op.hongo; m.op.aaa = op.aaa; m.op.adapta = op.adapta && op.rayos; }
        }
    }
    /// el cuadro entero: la escena (si hay mapa) y el HUD (`ui`: tandas de vértices, cada una con su textura —las letras, los
    /// íconos—)
    pub unsafe fn dibujar(&mut self, w: i32, h: i32, hay_mapa: bool, ui: &[(i64, Vec<f32>)]) -> Result<(), String> {
        match self {
            Motor3d::Gl(m, salida) => {
                use glow::HasContext;
                if hay_mapa { m.dibujar(*salida, w, h); }
                else { m.gl.bind_framebuffer(glow::FRAMEBUFFER, *salida); m.gl.viewport(0, 0, w, h); m.gl.clear_color(0.06, 0.07, 0.09, 1.0); m.gl.clear(glow::COLOR_BUFFER_BIT); }
                if !sin_ui() { for (t, v) in ui { m.ui(*salida, w, h, *t, v); } }
                m.marca("interfaz");
                Ok(())
            }
            Motor3d::Vk(m) => { if !hay_mapa { m.c = None; } let t: Vec<(i64, &[f32])> = ui.iter().filter(|_| !sin_ui()).map(|(t, v)| (*t, v.as_slice())).collect(); m.dibujar(&t).map(|_| ()) }
            Motor3d::Gl2(m, salida) => {
                if !hay_mapa { m.c = None; }
                use glow::HasContext;
                if hay_mapa { m.dibujar(*salida, w, h); }
                else { m.gl.bind_framebuffer(glow::FRAMEBUFFER, *salida); m.gl.viewport(0, 0, w, h); m.gl.clear_color(0.06, 0.07, 0.09, 1.0); m.gl.clear(glow::COLOR_BUFFER_BIT); }
                if !sin_ui() { for (t, v) in ui { m.ui(*salida, w, h, *t, v); } }
                Ok(())
            }
        }
    }
    /// espera a que la placa termine todo (para medirla: sólo en OpenGL; Vulkan tiene sus marcas de tiempo)
    pub unsafe fn esperar(&self) { use glow::HasContext; match self { Motor3d::Gl(m, _) => m.gl.finish(), Motor3d::Gl2(m, _) => m.gl.finish(), _ => {} } }
    /// lo que tardó la placa en el último cuadro medido (Vulkan: por pasada)
    pub fn tiempos(&self) -> Option<(f32, String)> { match self { Motor3d::Vk(m) => m.tiempos_placa(), _ => None } }
    /// el tamaño en que dibuja Vulkan (la pantalla de costado)
    pub fn tam(&self) -> Option<(u32, u32)> { match self { Motor3d::Vk(m) => Some(m.tam()), _ => None } }
}

/// (JXM_SIN_UI, para medir: el cuadro sin el HUD)
fn sin_ui() -> bool { static S: std::sync::OnceLock<bool> = std::sync::OnceLock::new(); *S.get_or_init(|| std::env::var_os("JXM_SIN_UI").is_some()) }
