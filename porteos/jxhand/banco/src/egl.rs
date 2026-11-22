//! Un contexto de OpenGL ES 2.0 sin ventana en la PC (Mesa, por software), para probar `escena.rs` y sacar capturas
//! con el mismo código que dibuja en el celular. Uso: EGL_PLATFORM=surfaceless jxhand-banco escena …
use std::ffi::c_void;
type P = *mut c_void;
#[link(name = "EGL")]
extern "C" {
    fn eglGetDisplay(d: P) -> P;
    fn eglInitialize(d: P, a: *mut i32, b: *mut i32) -> u32;
    fn eglBindAPI(api: u32) -> u32;
    fn eglChooseConfig(d: P, at: *const i32, c: *mut P, n: i32, num: *mut i32) -> u32;
    fn eglCreatePbufferSurface(d: P, c: P, at: *const i32) -> P;
    fn eglCreateContext(d: P, c: P, share: P, at: *const i32) -> P;
    fn eglMakeCurrent(d: P, dr: P, rd: P, c: P) -> u32;
    fn eglGetError() -> i32;
}
#[link(name = "GLESv2")]
extern "C" { fn glReadPixels(x: i32, y: i32, w: i32, h: i32, f: u32, t: u32, d: *mut c_void); fn glFinish(); }

pub fn contexto(w: i32, h: i32) -> Result<(), String> {
    unsafe {
        let d = eglGetDisplay(std::ptr::null_mut());
        let (mut a, mut b) = (0, 0);
        if eglInitialize(d, &mut a, &mut b) == 0 { return Err(format!("eglInitialize {:#x}", eglGetError())); }
        eglBindAPI(0x30A0);
        let at = [0x3040, 4, 0x3033, 1, 0x3024, 8, 0x3023, 8, 0x3022, 8, 0x3021, 8, 0x3025, 16, 0x3038];
        let mut c: P = std::ptr::null_mut(); let mut n = 0;
        if eglChooseConfig(d, at.as_ptr(), &mut c, 1, &mut n) == 0 || n == 0 { return Err(format!("eglChooseConfig {:#x}", eglGetError())); }
        let s = eglCreatePbufferSurface(d, c, [0x3057, w, 0x3056, h, 0x3038].as_ptr());
        if s.is_null() { return Err(format!("pbuffer {:#x}", eglGetError())); }
        let ctx = eglCreateContext(d, c, std::ptr::null_mut(), [0x3098, 2, 0x3038].as_ptr());
        if ctx.is_null() { return Err(format!("contexto {:#x}", eglGetError())); }
        if eglMakeCurrent(d, s, s, ctx) == 0 { return Err(format!("eglMakeCurrent {:#x}", eglGetError())); }
        Ok(())
    }
}

/// lo dibujado, de arriba hacia abajo (OpenGL lo da al revés)
pub fn leer(w: i32, h: i32) -> Vec<u8> {
    let mut v = vec![0u8; (w * h * 4) as usize];
    unsafe { glFinish(); glReadPixels(0, 0, w, h, 0x1908, 0x1401, v.as_mut_ptr() as *mut c_void); }
    let fila = (w * 4) as usize;
    let mut o = vec![0u8; v.len()];
    for y in 0..h as usize { o[y * fila..(y + 1) * fila].copy_from_slice(&v[(h as usize - 1 - y) * fila..(h as usize - y) * fila]); }
    o
}
