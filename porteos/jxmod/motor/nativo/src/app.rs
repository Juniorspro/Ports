//! Lo de Android (NativeActivity): el bucle, la ventana con EGL y OpenGL 3, los archivos de la APK y el tacto. El juego
//! está en comun.rs.
use crate::comun::Juego;
use android_activity::input::{InputEvent, MotionAction};
use android_activity::{AndroidApp, InputStatus, MainEvent, PollEvent};
use jxjuego::paquete::Paquete;
use jxmotor::gpu::{Motor, Opciones};
use khronos_egl as egl;
use std::ffi::{c_void, CString};
use std::io::Read;
use std::time::{Duration, Instant};

type Egl = egl::DynamicInstance<egl::EGL1_4>;

/// lo que dura mientras haya ventana: EGL, el motor y su superficie
struct Ventana { e: Egl, d: egl::Display, ctx: egl::Context, s: egl::Surface, m: Motor, w: i32, h: i32, placa: String }

fn activo(app: &AndroidApp, nombre: &str) -> Option<Vec<u8>> {
    let am = app.asset_manager(); let c = CString::new(nombre).ok()?;
    let mut a = am.open(&c)?; let mut v = vec![]; a.read_to_end(&mut v).ok()?; Some(v)
}

extern "C" { fn __android_log_write(prio: i32, tag: *const std::ffi::c_char, text: *const std::ffi::c_char) -> i32; }
/// al registro de Android (adb logcat -s jxmod)
pub fn log(t: &str) { if let Ok(c) = CString::new(t.replace('\0', " ")) { unsafe { __android_log_write(4, c"jxmod".as_ptr(), c.as_ptr()); } } }

#[no_mangle]
fn android_main(app: AndroidApp) {
    // si se cierra por un error, queda escrito: la próxima vez que abre lo muestra en la pantalla
    let datos = app.internal_data_path();
    let marca = datos.as_ref().map(|d| d.join("ultimo_error.txt"));
    let anterior = marca.as_ref().and_then(|m| { let t = std::fs::read_to_string(m).ok(); let _ = std::fs::remove_file(m); t });
    let m2 = marca.clone();
    std::panic::set_hook(Box::new(move |i| {
        let t = format!("se cerró: {i}"); log(&t);
        if let Some(m) = &m2 { let _ = std::fs::write(m, &t); }
    }));
    // el paquete del juego, de los archivos de la APK (el mismo de la web)
    let t0 = Instant::now();
    let idx = activo(&app, "pk.idx.json").and_then(|b| String::from_utf8(b).ok());
    let bloque = activo(&app, "pk.bin");
    let app2 = app.clone();
    let paq = match (idx, bloque) {
        (Some(i), Some(b)) => Paquete::de_bytes(&i, b, Box::new(move |n| activo(&app2, n))),
        _ => Err("no están pk.bin o pk.idx.json en la APK".into()),
    };
    log(&format!("paquete: {:.0} ms ({})", t0.elapsed().as_secs_f64() * 1000.0, if paq.is_ok() { "bien" } else { "mal" }));
    let letras = activo(&app, "ui/letras.json").and_then(|b| String::from_utf8(b).ok());
    let mut j = Juego::nuevo(paq, letras, activo(&app, "ui/letras.png"), datos);
    if let Some(a) = anterior { if j.error.is_none() { j.error = Some(format!("la vez anterior {a}")); } }
    let mut v: Option<Ventana> = None;
    let mut salir = false;
    while !salir {
        let espera = if v.is_some() { Some(Duration::ZERO) } else { None };
        app.poll_events(espera, |ev| {
            if let PollEvent::Main(me) = ev {
                match me {
                    MainEvent::InitWindow { .. } => {
                        if let Some(w) = app.native_window() {
                            match abrir_ventana(w.ptr().as_ptr() as *mut c_void) {
                                Ok(x) => { log(&format!("ventana {}×{} · {}", x.w, x.h, x.placa)); v = Some(x); j.al_abrir(); }
                                Err(e) => { log(&format!("no se pudo abrir OpenGL 3: {e}")); if let Some(m) = &marca { let _ = std::fs::write(m, format!("no pudo abrir OpenGL 3: {e}")); } }
                            }
                        }
                    }
                    MainEvent::TerminateWindow { .. } => { if let Some(x) = v.take() { cerrar_ventana(x); } }
                    MainEvent::Destroy => { salir = true; }
                    _ => {}
                }
            }
        });
        // el tacto
        if let Ok(mut it) = app.input_events_iter() {
            loop {
                let hubo = it.next(|e| { if let InputEvent::MotionEvent(me) = e { tocar(&mut j, &v, me); } InputStatus::Handled });
                if !hubo { break; }
            }
        }
        if let Some(x) = v.as_mut() {
            let t0 = Instant::now();
            x.w = x.e.query_surface(x.d, x.s, egl::WIDTH).unwrap_or(x.w); x.h = x.e.query_surface(x.d, x.s, egl::HEIGHT).unwrap_or(x.h);
            unsafe { j.cuadro(&mut x.m, None, x.w, x.h, &x.placa); }
            let _ = x.e.swap_buffers(x.d, x.s);
            j.medir(t0.elapsed().as_secs_f32() * 1000.0);
        }
    }
    if let Some(x) = v.take() { cerrar_ventana(x); }
}

fn tocar(j: &mut Juego, v: &Option<Ventana>, me: &android_activity::input::MotionEvent) {
    let Some(v) = v else { return };
    let (w, h) = (v.w as f32, v.h as f32);
    match me.action() {
        MotionAction::Down | MotionAction::PointerDown => { let p = me.pointer_at_index(me.pointer_index()); j.dedo_abajo(p.pointer_id(), p.x(), p.y(), w, h); }
        MotionAction::Move => { for p in me.pointers() { j.dedo_mueve(p.pointer_id(), p.x(), p.y(), h); } }
        MotionAction::Up | MotionAction::PointerUp => { j.dedo_arriba(me.pointer_at_index(me.pointer_index()).pointer_id()); }
        MotionAction::Cancel => j.dedos_fuera(),
        _ => {}
    }
}

fn abrir_ventana(win: *mut c_void) -> Result<Ventana, String> {
    let e = unsafe { Egl::load_required() }.map_err(|x| format!("libEGL: {x}"))?;
    let d = unsafe { e.get_display(egl::DEFAULT_DISPLAY) }.ok_or("sin pantalla EGL")?;
    e.initialize(d).map_err(|x| format!("eglInitialize: {x}"))?; e.bind_api(egl::OPENGL_ES_API).map_err(|x| format!("eglBindAPI: {x}"))?;
    const ES3: egl::Int = 0x0040;
    // (sin profundidad ni stencil en la ventana: el motor dibuja en sus propios cuadros y copia al final)
    let cfg = e.choose_first_config(d, &[egl::SURFACE_TYPE, egl::WINDOW_BIT, egl::RENDERABLE_TYPE, ES3, egl::RED_SIZE, 8, egl::GREEN_SIZE, 8, egl::BLUE_SIZE, 8, egl::DEPTH_SIZE, 0, egl::NONE]).ok().flatten()
        .or_else(|| e.choose_first_config(d, &[egl::SURFACE_TYPE, egl::WINDOW_BIT, egl::RENDERABLE_TYPE, ES3, egl::NONE]).ok().flatten()).ok_or("sin configuración EGL con OpenGL ES 3")?;
    let ctx = e.create_context(d, cfg, None, &[egl::CONTEXT_CLIENT_VERSION, 3, egl::NONE]).map_err(|x| format!("contexto ES 3: {x}"))?;
    let s = unsafe { e.create_window_surface(d, cfg, win as egl::NativeWindowType, None) }.map_err(|x| format!("superficie: {x}"))?;
    e.make_current(d, Some(s), Some(s), Some(ctx)).map_err(|x| format!("eglMakeCurrent: {x}"))?;
    let _ = e.swap_interval(d, 1);
    // (la pantalla a su frecuencia más alta: 120 Hz si la tiene; ANativeWindow_setFrameRate es de Android 11)
    unsafe {
        if let Ok(l) = libloading::Library::new("libandroid.so") {
            if let Ok(f) = l.get::<unsafe extern "C" fn(*mut c_void, f32, i8) -> i32>(b"ANativeWindow_setFrameRate\0") { f(win, 120.0, 0); }
        }
    }
    let lib = unsafe { libloading::Library::new("libGLESv3.so").or_else(|_| libloading::Library::new("libGLESv2.so")) }.ok();
    let gl = unsafe { glow::Context::from_loader_function(|n| {
        let cs = CString::new(n).unwrap();
        if let Some(l) = &lib { if let Ok(p) = l.get::<*const c_void>(cs.as_bytes_with_nul()) { if !p.is_null() { return *p; } } }
        e.get_proc_address(n).map_or(std::ptr::null(), |p| p as *const c_void)
    }) };
    std::mem::forget(lib);   // (la biblioteca de GL queda abierta mientras viva la app)
    let placa = unsafe { use glow::HasContext; gl.get_parameter_string(glow::RENDERER) };
    let m = unsafe { Motor::nuevo(gl, Opciones::default()) }.map_err(|x| format!("motor: {x}"))?;
    let w = e.query_surface(d, s, egl::WIDTH).unwrap_or(1); let h = e.query_surface(d, s, egl::HEIGHT).unwrap_or(1);
    Ok(Ventana { e, d, ctx, s, m, w, h, placa })
}

fn cerrar_ventana(v: Ventana) {
    let Ventana { e, d, ctx, s, mut m, .. } = v;
    unsafe { m.vaciar(); }
    drop(m);
    let _ = e.make_current(d, None, None, None); let _ = e.destroy_surface(d, s); let _ = e.destroy_context(d, ctx); let _ = e.terminate(d);
}
