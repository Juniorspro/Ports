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
    pub fn resumen(&self) -> String { match self { Motor3d::Gl(m, _) => m.resumen(), Motor3d::Vk(m) => m.resumen(), Motor3d::Gl2(m, _) => m.resumen() } }
    pub fn es_vulkan(&self) -> bool { matches!(self, Motor3d::Vk(_)) }
    /// el cuadro entero: la escena (si hay mapa) y el HUD (`ui`: tandas de vértices, cada una con su textura —las letras, los
    /// íconos—)
    pub unsafe fn dibujar(&mut self, w: i32, h: i32, hay_mapa: bool, ui: &[(i64, Vec<f32>)]) -> Result<(), String> {
        match self {
            Motor3d::Gl(m, salida) => {
                use glow::HasContext;
                if hay_mapa { m.dibujar(*salida, w, h); }
                else { m.gl.bind_framebuffer(glow::FRAMEBUFFER, *salida); m.gl.viewport(0, 0, w, h); m.gl.clear_color(0.06, 0.07, 0.09, 1.0); m.gl.clear(glow::COLOR_BUFFER_BIT); }
                for (t, v) in ui { m.ui(*salida, w, h, *t, v); }
                Ok(())
            }
            Motor3d::Vk(m) => { if !hay_mapa { m.c = None; } let t: Vec<(i64, &[f32])> = ui.iter().map(|(t, v)| (*t, v.as_slice())).collect(); m.dibujar(&t).map(|_| ()) }
            Motor3d::Gl2(m, salida) => {
                if !hay_mapa { m.c = None; }
                use glow::HasContext;
                if hay_mapa { m.dibujar(*salida, w, h); }
                else { m.gl.bind_framebuffer(glow::FRAMEBUFFER, *salida); m.gl.viewport(0, 0, w, h); m.gl.clear_color(0.06, 0.07, 0.09, 1.0); m.gl.clear(glow::COLOR_BUFFER_BIT); }
                for (t, v) in ui { m.ui(*salida, w, h, *t, v); }
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
