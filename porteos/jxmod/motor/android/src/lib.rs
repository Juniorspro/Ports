//! JX Motor en Android (libjxmotor.so). La app (MotorJX.java) le pasa la superficie que está atrás del WebView y lo que
//! manda el juego (texto en base64, tal cual llega por la puerta de JavaScript): recursos (JXE1), cuadros (JXC1), vaciar
//! y quitar. Un hilo propio, con su contexto de EGL, sube los recursos en orden y dibuja el último cuadro que llegó (los
//! que llegan mientras dibuja se saltean: siempre el más nuevo). JNI mínima por número, sin dependencias (como JX Hand).
#![allow(non_snake_case)]
use jxmotor::escena::{Cuadro, Escena};
use jxmotor::gpu::{Motor, Opciones};
use std::collections::VecDeque;
use std::ffi::c_void;
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};

// ---- lo mínimo de JNI: la tabla de funciones del JNIEnv, por número (jni.h) ----
type Env = *mut *const *const c_void;
type Obj = *mut c_void;
unsafe fn funcion(env: Env, i: usize) -> *const c_void { *(*env).add(i) }
unsafe fn texto_java(env: Env, s: &str) -> Obj {
    let mut c = s.as_bytes().to_vec(); c.retain(|&b| b != 0); c.push(0);
    let f: extern "system" fn(Env, *const u8) -> Obj = std::mem::transmute(funcion(env, 167)); // NewStringUTF
    f(env, c.as_ptr())
}
/// los bytes de un String de Java (es base64: ASCII)
unsafe fn texto_de(env: Env, s: Obj) -> Vec<u8> {
    if s.is_null() { return vec![]; }
    let largo: extern "system" fn(Env, Obj) -> i32 = std::mem::transmute(funcion(env, 164)); // GetStringLength
    let largo_utf: extern "system" fn(Env, Obj) -> i32 = std::mem::transmute(funcion(env, 168)); // GetStringUTFLength
    let region: extern "system" fn(Env, Obj, i32, i32, *mut u8) = std::mem::transmute(funcion(env, 221)); // GetStringUTFRegion
    let (n, nu) = (largo(env, s).max(0), largo_utf(env, s).max(0) as usize);
    let mut b = vec![0u8; nu + 1];
    region(env, s, 0, n, b.as_mut_ptr()); b.truncate(nu); b
}

/// los bytes de un String de Java armado con un char por byte (0–255: el juego lo manda así, sin base64); None si hay
/// algún char de más de 255 (no vino como se mandó)
unsafe fn bin_de(env: Env, s: Obj) -> Option<Vec<u8>> {
    if s.is_null() { return Some(vec![]); }
    let largo: extern "system" fn(Env, Obj) -> i32 = std::mem::transmute(funcion(env, 164)); // GetStringLength
    let region: extern "system" fn(Env, Obj, i32, i32, *mut u16) = std::mem::transmute(funcion(env, 220)); // GetStringRegion
    let n = largo(env, s).max(0); let mut u = vec![0u16; n as usize];
    region(env, s, 0, n, u.as_mut_ptr());
    if u.iter().any(|&c| c > 255) { return None; }
    Some(u.into_iter().map(|c| c as u8).collect())
}

/// base64 (el de btoa) a bytes
pub fn de_base64(t: &[u8]) -> Vec<u8> {
    let mut v = [255u8; 256];
    for (i, c) in b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".iter().enumerate() { v[*c as usize] = i as u8; }
    let mut o = Vec::with_capacity(t.len() / 4 * 3); let (mut acc, mut n) = (0u32, 0);
    for &c in t { let x = v[c as usize]; if x == 255 { continue; } acc = acc << 6 | x as u32; n += 6; if n >= 8 { n -= 8; o.push((acc >> n) as u8); } }
    o
}

enum Msg { Recursos(Vec<u8>), Vaciar, Quitar(Vec<u8>) }
struct Ventana(*mut c_void);
unsafe impl Send for Ventana {}
#[derive(Default)]
struct Cola {
    orden: VecDeque<Msg>,
    cuadro: Option<Vec<u8>>,
    ventana: Option<Option<Ventana>>,   // (Some: cambió; adentro, la nueva o ninguna)
    opciones: Option<Opciones>,
    salir: bool,
    estado: String,
}
struct Compartido { cola: Mutex<Cola>, hay: Condvar, hecho: Condvar }
pub struct Jxm { c: Arc<Compartido>, hilo: Option<std::thread::JoinHandle<()>> }

#[cfg(target_os = "android")]
#[link(name = "android")]
extern "C" {
    fn ANativeWindow_fromSurface(env: Env, surface: Obj) -> *mut c_void;
    fn ANativeWindow_release(w: *mut c_void);
    fn ANativeWindow_setBuffersGeometry(w: *mut c_void, ancho: i32, alto: i32, formato: i32) -> i32;
}
#[cfg(not(target_os = "android"))]
unsafe fn ANativeWindow_fromSurface(_: Env, _: Obj) -> *mut c_void { std::ptr::null_mut() }
#[cfg(not(target_os = "android"))]
unsafe fn ANativeWindow_release(_: *mut c_void) {}
#[cfg(not(target_os = "android"))]
unsafe fn ANativeWindow_setBuffersGeometry(_: *mut c_void, _: i32, _: i32, _: i32) -> i32 { 0 }

type Egl = khronos_egl::DynamicInstance<khronos_egl::EGL1_4>;

/// el hilo de dibujo: EGL, el motor, y la vuelta (subir lo que llegó en orden, dibujar el último cuadro)
fn hilo(c: Arc<Compartido>) {
    use khronos_egl as egl;
    let poner_estado = |s: String| { c.cola.lock().unwrap().estado = s; };
    let e = match unsafe { Egl::load_required() } { Ok(e) => e, Err(x) => { poner_estado(format!("error: libEGL: {x}")); return; } };
    let d = match unsafe { e.get_display(egl::DEFAULT_DISPLAY) } { Some(d) => d, None => { poner_estado("error: sin pantalla EGL".into()); return; } };
    if let Err(x) = e.initialize(d) { poner_estado(format!("error: eglInitialize {x}")); return; }
    let _ = e.bind_api(egl::OPENGL_ES_API);
    const ES3: egl::Int = 0x0040; // EGL_OPENGL_ES3_BIT_KHR
    // (con ventana y 1×1 de reserva; si no hay —la prueba en la PC, sin ventanas—, la que haya con GLES 3)
    let cfg = [egl::WINDOW_BIT | egl::PBUFFER_BIT, egl::WINDOW_BIT, egl::PBUFFER_BIT].iter()
        .find_map(|&t| e.choose_first_config(d, &[egl::SURFACE_TYPE, t, egl::RENDERABLE_TYPE, ES3, egl::RED_SIZE, 8, egl::GREEN_SIZE, 8, egl::BLUE_SIZE, 8, egl::NONE]).ok().flatten())
        .or_else(|| e.choose_first_config(d, &[egl::RENDERABLE_TYPE, ES3, egl::NONE]).ok().flatten());
    let Some(cfg) = cfg else { poner_estado("error: sin configuración EGL con GLES 3".into()); return; };
    let ctx = match e.create_context(d, cfg, None, &[egl::CONTEXT_CLIENT_VERSION, 3, egl::NONE]) { Ok(x) => x, Err(x) => { poner_estado(format!("error: contexto GLES 3: {x}")); return; } };
    // (sin ventana, una superficie de 1×1 para tener el contexto activo y poder subir recursos)
    let pb = e.create_pbuffer_surface(d, cfg, &[egl::WIDTH, 1, egl::HEIGHT, 1, egl::NONE]).ok();
    let _ = e.make_current(d, pb, pb, Some(ctx));
    // las funciones de GL: de libGLESv3 (o v2), y si no, de eglGetProcAddress
    let lib = unsafe { libloading::Library::new("libGLESv3.so").or_else(|_| libloading::Library::new("libGLESv2.so")) }.ok();
    let gl = unsafe {
        glow::Context::from_loader_function(|s| {
            let cs = std::ffi::CString::new(s).unwrap();
            if let Some(l) = &lib { if let Ok(p) = l.get::<*const c_void>(cs.as_bytes_with_nul()) { if !p.is_null() { return *p; } } }
            e.get_proc_address(s).map_or(std::ptr::null(), |p| p as *const c_void)
        })
    };
    let mut m = match unsafe { Motor::nuevo(gl, Opciones::celular_flojo()) } { Ok(m) => m, Err(x) => { poner_estado(format!("error: {x}")); return; } };
    let (mut win, mut sup): (Option<Ventana>, Option<egl::Surface>) = (None, None);
    let (mut n, mut t_ventana, mut ms_dib, mut ms_rec, mut fps) = (0u64, Instant::now(), 0.0f64, 0.0f64, 0.0f64);
    let mut ult_rec = 0.0;
    poner_estado("listo".into());
    loop {
        let (msgs, cuadro, cambio, op, salir) = {
            let mut g = c.cola.lock().unwrap();
            while g.orden.is_empty() && g.cuadro.is_none() && g.ventana.is_none() && g.opciones.is_none() && !g.salir { g = c.hay.wait(g).unwrap(); }
            (std::mem::take(&mut g.orden), g.cuadro.take(), g.ventana.take(), g.opciones.take(), g.salir)
        };
        if let Some(nueva) = cambio {
            // la superficie cambió: la vieja se suelta (Android espera a que esto termine antes de destruirla)
            let _ = e.make_current(d, pb, pb, Some(ctx));
            if let Some(s) = sup.take() { let _ = e.destroy_surface(d, s); }
            if let Some(w) = win.take() { unsafe { ANativeWindow_release(w.0) }; }
            if let Some(w) = nueva {
                if !w.0.is_null() {
                    let fmt = e.get_config_attrib(d, cfg, egl::NATIVE_VISUAL_ID).unwrap_or(0);
                    unsafe { ANativeWindow_setBuffersGeometry(w.0, 0, 0, fmt) };
                    match unsafe { e.create_window_surface(d, cfg, w.0 as egl::NativeWindowType, None) } {
                        Ok(s) => { sup = Some(s); let _ = e.make_current(d, Some(s), Some(s), Some(ctx)); let _ = e.swap_interval(d, 1); }
                        Err(x) => poner_estado(format!("error: superficie {x}")),
                    }
                    win = Some(w);
                }
            }
            let mut g = c.cola.lock().unwrap(); g.ventana = None; drop(g); c.hecho.notify_all();
        }
        if salir { break; }
        if let Some(o) = op { m.op = o; }
        let t0 = Instant::now();
        for msg in msgs {
            let r = unsafe { match msg {
                Msg::Recursos(b) => Escena::leer(&b).and_then(|esc| m.cargar(&esc)),
                Msg::Vaciar => { m.vaciar(); Ok(()) }
                Msg::Quitar(b) => { if !b.is_empty() { let ids: Vec<i64> = b[1..].chunks_exact(8).map(|x| f64::from_le_bytes(x.try_into().unwrap()) as i64).collect(); m.quitar(b[0], &ids); } Ok(()) }
            } };
            if let Err(x) = r { poner_estado(format!("error en un recurso: {x}")); }
            ult_rec = t0.elapsed().as_secs_f64() * 1000.0;
        }
        if ult_rec > 0.0 { ms_rec = ult_rec; ult_rec = 0.0; }
        if let Some(b) = cuadro {
            let mut r = std::mem::take(&mut m.ranuras); let q = Cuadro::leer_con(&b, &mut r); m.ranuras = r;
            match q { Ok(q) => m.poner_cuadro(q), Err(x) => poner_estado(format!("error en el cuadro: {x}")) }
            if let Some(s) = sup {
                let (w, h) = (e.query_surface(d, s, egl::WIDTH).unwrap_or(1), e.query_surface(d, s, egl::HEIGHT).unwrap_or(1));
                let t = Instant::now();
                unsafe { m.dibujar(None, w, h); }
                let _ = e.swap_buffers(d, s);
                let dt = t.elapsed().as_secs_f64() * 1000.0; ms_dib = if n == 0 { dt } else { ms_dib * 0.9 + dt * 0.1 };
                n += 1;
                let tv = t_ventana.elapsed().as_secs_f64();
                if tv >= 1.0 {
                    fps = m.cuadro as f64 / tv; m.cuadro = 0; t_ventana = Instant::now();
                    poner_estado(format!("ok {:.0} cuadros/s · {:.1} ms dibujando · {}×{} · {} dibujos · {:.0} MB en la placa · recursos {:.0} ms · {}", fps, ms_dib, w, h, m.dibujos, m.memoria as f64 / 1e6, ms_rec, m.resumen()));
                }
            }
        }
    }
    if let Some(s) = sup.take() { let _ = e.destroy_surface(d, s); }
    if let Some(w) = win.take() { unsafe { ANativeWindow_release(w.0) }; }
    unsafe { m.vaciar(); }
    let _ = e.make_current(d, None, None, None);
    let _ = e.destroy_context(d, ctx);
    if let Some(p) = pb { let _ = e.destroy_surface(d, p); }
    let _ = fps;
}

fn jxm<'a>(m: i64) -> Option<&'a Jxm> { if m == 0 { None } else { Some(unsafe { &*(m as *const Jxm) }) } }
fn encolar(m: i64, f: impl FnOnce(&mut Cola)) { if let Some(j) = jxm(m) { let mut g = j.c.cola.lock().unwrap(); f(&mut g); drop(g); j.c.hay.notify_all(); } }

#[no_mangle]
pub extern "system" fn Java_com_jxmod_app_MotorNativo_crear(_env: Env, _cls: Obj) -> i64 {
    let c = Arc::new(Compartido { cola: Mutex::new(Cola { estado: "arrancando".into(), ..Default::default() }), hay: Condvar::new(), hecho: Condvar::new() });
    let c2 = c.clone();
    let hilo = std::thread::Builder::new().name("jxmotor".into()).spawn(move || hilo(c2)).ok();
    Box::into_raw(Box::new(Jxm { c, hilo })) as i64
}
/// la superficie nueva (o null: se destruye). Espera a que el hilo suelte la anterior (hasta 2 s)
#[no_mangle]
pub unsafe extern "system" fn Java_com_jxmod_app_MotorNativo_superficie(env: Env, _cls: Obj, m: i64, s: Obj) {
    let Some(j) = jxm(m) else { return };
    let w = if s.is_null() { None } else { Some(Ventana(ANativeWindow_fromSurface(env, s))) };
    let mut g = j.c.cola.lock().unwrap(); g.ventana = Some(w); j.c.hay.notify_all();
    let fin = Instant::now() + Duration::from_secs(2);
    while g.ventana.is_some() { let ahora = Instant::now(); if ahora >= fin { break; } g = j.c.hecho.wait_timeout(g, fin - ahora).unwrap().0; }
}
#[no_mangle]
pub unsafe extern "system" fn Java_com_jxmod_app_MotorNativo_recursos(env: Env, _cls: Obj, m: i64, b64: Obj) {
    let b = de_base64(&texto_de(env, b64)); encolar(m, |g| g.orden.push_back(Msg::Recursos(b)));
}
#[no_mangle]
pub unsafe extern "system" fn Java_com_jxmod_app_MotorNativo_cuadro(env: Env, _cls: Obj, m: i64, b64: Obj) {
    let b = de_base64(&texto_de(env, b64)); encolar(m, |g| g.cuadro = Some(b));
}
/// lo mismo, en binario (un char por byte)
#[no_mangle]
pub unsafe extern "system" fn Java_com_jxmod_app_MotorNativo_recursosBin(env: Env, _cls: Obj, m: i64, s: Obj) {
    match bin_de(env, s) { Some(b) => encolar(m, |g| g.orden.push_back(Msg::Recursos(b))), None => encolar(m, |g| g.estado = "error: recursos binarios mal pasados".into()) }
}
#[no_mangle]
pub unsafe extern "system" fn Java_com_jxmod_app_MotorNativo_cuadroBin(env: Env, _cls: Obj, m: i64, s: Obj) {
    if let Some(b) = bin_de(env, s) { encolar(m, |g| g.cuadro = Some(b)); }
}
#[no_mangle]
pub extern "system" fn Java_com_jxmod_app_MotorNativo_vaciar(_env: Env, _cls: Obj, m: i64) { encolar(m, |g| { g.orden.push_back(Msg::Vaciar); g.cuadro = None; }); }
#[no_mangle]
pub unsafe extern "system" fn Java_com_jxmod_app_MotorNativo_quitar(env: Env, _cls: Obj, m: i64, b64: Obj) {
    let b = de_base64(&texto_de(env, b64)); encolar(m, |g| g.orden.push_back(Msg::Quitar(b)));
}
/// la calidad: «alto», «celular» o «bajo», y la escala de la escena (0 = la del perfil)
#[no_mangle]
pub unsafe extern "system" fn Java_com_jxmod_app_MotorNativo_opciones(env: Env, _cls: Obj, m: i64, perfil: Obj, escala: f32) {
    let p = String::from_utf8_lossy(&texto_de(env, perfil)).to_string();
    let mut o = match p.as_str() {
        "alto" => Opciones::default(),
        "bajo" => Opciones { escala: 0.5, sombras: false, reflejo: false, ..Opciones::celular_flojo() },
        _ => Opciones::celular_flojo(),
    };
    if escala > 0.05 { o.escala = escala.clamp(0.25, 1.0); }
    encolar(m, |g| g.opciones = Some(o));
}
#[no_mangle]
pub unsafe extern "system" fn Java_com_jxmod_app_MotorNativo_estado(env: Env, _cls: Obj, m: i64) -> Obj {
    let s = jxm(m).map(|j| j.c.cola.lock().unwrap().estado.clone()).unwrap_or_else(|| "sin motor".into());
    texto_java(env, &s)
}
#[no_mangle]
pub extern "system" fn Java_com_jxmod_app_MotorNativo_soltar(_env: Env, _cls: Obj, m: i64) {
    if m == 0 { return; }
    let mut j = unsafe { Box::from_raw(m as *mut Jxm) };
    { let mut g = j.c.cola.lock().unwrap(); g.salir = true; } j.c.hay.notify_all();
    if let Some(h) = j.hilo.take() { let _ = h.join(); }
}

#[cfg(test)]
mod prueba {
    #[test]
    fn base64() {
        assert_eq!(super::de_base64(b"SlhDMQ=="), b"JXC1");
        assert_eq!(super::de_base64(b"AAECAwQF"), [0, 1, 2, 3, 4, 5]);
    }
}
