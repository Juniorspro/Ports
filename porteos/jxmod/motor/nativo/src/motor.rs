//! Los motores para elegir, con lo mismo para el juego: OpenGL 3 (jxmotor::gpu) y Vulkan propio (jxmotor::vk). OpenGL 2
//! todavía no (se usa OpenGL 3).
use jxmotor::escena::{Cuadro, Escena};
use jxmotor::gpu::TEX_LETRAS;

pub enum Motor3d {
    /// OpenGL 3: dibuja en `salida` (None: la ventana de EGL); la app pone el cuadro en la pantalla (eglSwapBuffers)
    Gl(jxmotor::gpu::Motor, Option<glow::Framebuffer>),
    /// Vulkan: dibuja y pone el cuadro en la pantalla él mismo
    Vk(jxmotor::vk::Motor),
}

impl Motor3d {
    pub unsafe fn cargar(&mut self, e: &Escena) -> Result<(), String> { match self { Motor3d::Gl(m, _) => m.cargar(e), Motor3d::Vk(m) => m.cargar(e) } }
    pub unsafe fn vaciar(&mut self) { match self { Motor3d::Gl(m, _) => m.vaciar(), Motor3d::Vk(m) => m.vaciar() } }
    pub fn poner_cuadro(&mut self, c: Cuadro) { match self { Motor3d::Gl(m, _) => m.poner_cuadro(c), Motor3d::Vk(m) => m.poner_cuadro(c) } }
    pub fn resumen(&self) -> String { match self { Motor3d::Gl(m, _) => m.resumen(), Motor3d::Vk(m) => m.resumen() } }
    pub fn es_vulkan(&self) -> bool { matches!(self, Motor3d::Vk(_)) }
    /// el cuadro entero: la escena (si hay mapa) y el HUD (`ui`, del atlas de letras)
    pub unsafe fn dibujar(&mut self, w: i32, h: i32, hay_mapa: bool, ui: &[f32]) -> Result<(), String> {
        match self {
            Motor3d::Gl(m, salida) => {
                use glow::HasContext;
                if hay_mapa { m.dibujar(*salida, w, h); }
                else { m.gl.bind_framebuffer(glow::FRAMEBUFFER, *salida); m.gl.viewport(0, 0, w, h); m.gl.clear_color(0.06, 0.07, 0.09, 1.0); m.gl.clear(glow::COLOR_BUFFER_BIT); }
                m.ui(*salida, w, h, TEX_LETRAS, ui);
                Ok(())
            }
            Motor3d::Vk(m) => { if !hay_mapa { m.c = None; } m.dibujar(TEX_LETRAS, ui).map(|_| ()) }
        }
    }
    /// espera a que la placa termine todo (para medirla: sólo en OpenGL; Vulkan tiene sus marcas de tiempo)
    pub unsafe fn esperar(&self) { if let Motor3d::Gl(m, _) = self { use glow::HasContext; m.gl.finish(); } }
    /// lo que tardó la placa en el último cuadro medido (Vulkan: por pasada)
    pub fn tiempos(&self) -> Option<(f32, String)> { match self { Motor3d::Vk(m) => m.tiempos_placa(), _ => None } }
    /// el tamaño en que dibuja Vulkan (la pantalla de costado)
    pub fn tam(&self) -> Option<(u32, u32)> { match self { Motor3d::Vk(m) => Some(m.tam()), _ => None } }
}
