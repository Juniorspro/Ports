//! Lo de Android (NativeActivity): el bucle, la ventana con el motor elegido (Vulkan propio u OpenGL 3 con EGL), los
//! archivos de la APK y el tacto. El juego está en comun.rs.
use crate::comun::{Juego, Placa};
use crate::motor::Motor3d;
use android_activity::input::{InputEvent, MotionAction};
use android_activity::{AndroidApp, InputStatus, MainEvent, PollEvent};
use jxjuego::paquete::Paquete;
use jxmotor::gpu::Opciones;
use khronos_egl as egl;
use std::ffi::{c_void, CString};
use std::io::Read;
use std::time::{Duration, Instant};

type Egl = egl::DynamicInstance<egl::EGL1_4>;

/// lo de EGL (sólo con OpenGL)
struct BaseGl { e: Egl, d: egl::Display, ctx: egl::Context, s: egl::Surface }
/// lo que dura mientras haya ventana: el motor (y EGL si es OpenGL), el tamaño y la placa
struct Ventana { m: Motor3d, gl: Option<BaseGl>, w: i32, h: i32, placa: String, _win: android_activity::ndk::native_window::NativeWindow }

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
    // (y si se trabó: la caja negra —caja_negra.rs— lo deja escrito en trabado.txt)
    let trabado = datos.as_ref().map(|d| d.join("trabado.txt"));
    let se_trabo = trabado.as_deref().and_then(crate::caja_negra::anterior);
    if let Some(t) = &trabado { crate::caja_negra::vigilar(t.clone()); }
    crate::caja_negra::paso("arranque");
    std::panic::set_hook(Box::new(move |i| {
        let t = format!("se cerró: {i}\nLo último que hacía:\n{}", crate::caja_negra::registro()); log(&t);
        if let Some(m) = &m2 { let _ = std::fs::write(m, &t); }
    }));
    // el paquete del juego, de los archivos de la APK (el mismo de la web)
    let t0 = Instant::now();
    let idx = activo(&app, "pk.idx.json").and_then(|b| String::from_utf8(b).ok());
    let bloque = activo(&app, "pk.bin");
    // (los paquetes aparte que no vienen en la APK se bajan cuando hacen falta y quedan en la memoria de la app: bajas.rs)
    let app5 = app.clone();
    let bajas = crate::bajas::Bajas::nueva(datos.clone().unwrap_or_else(std::env::temp_dir).join("rb"), Some(unsafe { crate::red_android::Java::de_vm(app.vm_as_ptr()) }.bajar()))
        .con_apk(std::sync::Arc::new(move |n: &str| CString::new(format!("rb/{n}")).ok().and_then(|c| app5.asset_manager().open(&c)).is_some()));
    let app2 = app.clone(); let bj2 = bajas.clone();
    let paq = match (idx, bloque) {
        (Some(i), Some(b)) => Paquete::de_bytes(&i, b, Box::new(move |n| activo(&app2, n).or_else(|| { let nom = n.strip_prefix("rb/")?; let r = bj2.leer(nom); if r.is_none() { bj2.pedir(nom); } r }))),
        _ => Err("no están pk.bin o pk.idx.json en la APK".into()),
    };
    log(&format!("paquete: {:.0} ms ({})", t0.elapsed().as_secs_f64() * 1000.0, if paq.is_ok() { "bien" } else { "mal" }));
    let letras = activo(&app, "ui/letras.json").and_then(|b| String::from_utf8(b).ok());
    let rangos = paq.as_ref().map(|p| p.rangos("a:")).unwrap_or_default();
    let mut j = Juego::nuevo(paq, letras, activo(&app, "ui/letras.png"), datos);
    // (el idioma del celular, si no se eligió otro en Idioma)
    j.idioma_del_sistema(app.config().language().as_deref());
    // (el multijugador: las conexiones al broker y a la tienda van por Java —TLS con los certificados del sistema—)
    j.en_red.puente = Some(unsafe { crate::red_android::Java::de_vm(app.vm_as_ptr()) }.puente());
    // (los addons de GMod: bajar de la tienda —binario— y la carpeta del celular donde se pueden dejar .gma)
    let java = unsafe { crate::red_android::Java::de_vm(app.vm_as_ptr()) }; j.gmod.http_bin = Some(java.http_bin()); j.gmod.carpeta_externa = app.external_data_path().map(|p| p.join("addons"));
    // (el contenido base de GMod y HL2 —rb/gm_lib.*— y el menú de GMod —rb/jxp/— leídos de la APK)
    {   let lr = crate::comun::gmod_juego::lector_android(&app); let bj = bajas.clone();
        j.gmod.lector_rb = Some(std::sync::Arc::new(move |n: &str, o: u64, len: usize| lr(n, o, len).or_else(|| {
            use std::os::unix::fs::FileExt;
            let Some(p) = bj.archivo(n) else { bj.pedir(n); return None };
            if len == usize::MAX { return std::fs::read(p).ok(); }
            let f = std::fs::File::open(p).ok()?; let mut v = vec![0u8; len]; f.read_exact_at(&mut v, o).ok()?; Some(v)
        }))); }
    j.bajas = Some(bajas);
    // (escribir: el cuadro de texto de Juego.java)
    if let Some(t) = unsafe { crate::red_android::Teclado::nuevo(app.vm_as_ptr(), app.activity_as_ptr()) } {
        // (el refresco de la pantalla: los gráficos automáticos buscan los cuadros que da —120 en una de 120 Hz—)
        if let Some(r) = t.refresco() { if r > 20.0 { j.refresco = r; } }
        // (el candado de multicast, la primera vez que se buscan partidas en el Wi-Fi)
        { let t4 = t.clone(); j.lan.candado = Some(Box::new(move || t4.candado_multicast())); }
        let (t1, t2) = (t.clone(), t);
        j.teclado = Some(crate::comun::Teclado { pedir: Box::new(move |id, ti, ini, max, cl| t1.pedir(id, ti, ini, max, cl)), tomar: Box::new(move || t2.tomar()) });
    }
    // (el inicio: el atlas de los menús y las escenas de fondo salen de la APK; la app arranca en el menú, como la web)
    { let app3 = app.clone(); j.inicio_lector(Box::new(move |n| activo(&app3, n))); }
    j.inicio_abrir();
    // (los gráficos automáticos se miden en la app de verdad; las pruebas, no)
    j.gfx_medir = true;
    // (las capturas de nado del cuerpo)
    if let (Some(a), Some(b)) = (activo(&app, "cmu/126_04.bin"), activo(&app, "cmu/79_02.bin")) { j.nado = Some((a, b)); }
    // (los emotes de captura: el catálogo y los que vengan en la APK —los demás se bajan—)
    { let app4 = app.clone(); j.pjs.emo.lector = Some(Box::new(move |n: &str| activo(&app4, &format!("cmu/{n}")))); }
    // el sonido: los MP3 se leen directo del pk.bin adentro de la APK (va sin comprimir)
    let fuente = app.asset_manager().open(c"pk.bin").and_then(|a| a.open_file_descriptor().ok()).map(|o| (o.fd, o.offset));
    j.sonido = crate::sonido::Sonido::android(fuente, rangos);
    log(&format!("sonido: {}", if j.sonido.suena() { "AAudio" } else { "sin salida" }));
    if let Some(a) = anterior.or(se_trabo) { if j.error.is_none() { j.error = Some(format!("la vez anterior {a}")); } }
    let mut v: Option<Ventana> = None;
    let mut salir = false;
    while !salir {
        let espera = if v.is_some() { Some(Duration::ZERO) } else { None };
        app.poll_events(espera, |ev| {
            if let PollEvent::Main(me) = ev {
                match me {
                    MainEvent::InitWindow { .. } => { crate::caja_negra::paso("abrir la ventana"); if let Some(w) = app.native_window() { v = abrir(w, &mut j, marca.as_deref()); } crate::caja_negra::a_la_vista(v.is_some()); }
                    MainEvent::TerminateWindow { .. } => { crate::caja_negra::a_la_vista(false); crate::caja_negra::paso("cerrar la ventana"); if let Some(x) = v.take() { cerrar(x); } }
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
            match &x.gl {
                Some(b) => { x.w = b.e.query_surface(b.d, b.s, egl::WIDTH).unwrap_or(x.w); x.h = b.e.query_surface(b.d, b.s, egl::HEIGHT).unwrap_or(x.h); }
                None => if let Some((w, h)) = x.m.tam() { x.w = w as i32; x.h = h as i32; },
            }
            if let Err(e) = unsafe { j.cuadro(&mut x.m, x.w, x.h, &x.placa) } { log(&format!("cuadro: {e}")); if j.error.is_none() { j.error = Some(format!("el motor: {e}")); } }
            if let Some(b) = &x.gl { let _ = b.e.swap_buffers(b.d, b.s); }
            j.medir(t0.elapsed().as_secs_f32() * 1000.0);
            crate::caja_negra::latido();
        }
        if j.ini.salir { salir = true; }
        // (se eligió otro motor: se cierra el que está y se abre el nuevo en la misma ventana)
        if j.cambiar_motor {
            j.cambiar_motor = false;
            crate::caja_negra::paso(format!("cambiar el motor a {:?}", j.motor_pedido()));
            if let Some(x) = v.take() { let w = x._win.clone(); cerrar(x); v = abrir(w, &mut j, marca.as_deref()); }
            crate::caja_negra::a_la_vista(v.is_some());
        }
    }
    if let Some(x) = v.take() { cerrar(x); }
}

fn tocar(j: &mut Juego, v: &Option<Ventana>, me: &android_activity::input::MotionEvent) {
    let Some(v) = v else { return };
    let (w, h) = (v.w as f32, v.h as f32);
    match me.action() {
        MotionAction::Down | MotionAction::PointerDown => { let p = me.pointer_at_index(me.pointer_index()); j.dedo_abajo(p.pointer_id(), p.x(), p.y(), w, h); }
        MotionAction::Move => { for p in me.pointers() { j.dedo_mueve(p.pointer_id(), p.x(), p.y(), h); } }
        MotionAction::Up | MotionAction::PointerUp => { j.dedo_arriba_en(me.pointer_at_index(me.pointer_index()).pointer_id(), w, h); }
        MotionAction::Cancel => j.dedos_fuera(),
        _ => {}
    }
}

/// abre el motor que pidió el jugador en la ventana; si Vulkan no anda, OpenGL 3 (y lo avisa)
fn abrir(win: android_activity::ndk::native_window::NativeWindow, j: &mut Juego, marca: Option<&std::path::Path>) -> Option<Ventana> {
    let p = win.ptr().as_ptr() as *mut c_void;
    pedir_120(p);
    let quiere = j.motor_pedido();
    if quiere == Placa::Vulkan {
        match unsafe { jxmotor::vk::Motor::nuevo(Some(p), 0, 0, Opciones::default()) } {
            Ok(m) => {
                let (w, h) = m.tam(); let placa = m.placa.clone();
                log(&format!("Vulkan: {w}×{h} · {placa}"));
                j.en_uso = Placa::Vulkan; j.al_abrir();
                return Some(Ventana { m: Motor3d::Vk(m), gl: None, w: w as i32, h: h as i32, placa, _win: win });
            }
            Err(e) => { log(&format!("Vulkan no anduvo: {e}")); j.avisar(format!("Vulkan no anduvo ({e}): se usa OpenGL 3")); }
        }
    }
    if quiere == Placa::Gl2 {
        match abrir_gl(p, 2).and_then(|(gl, b, w, h, placa)| unsafe { jxmotor::gl2::Motor::nuevo(gl, jxmotor::gl2::Opciones2::default()) }.map(|m| (m, b, w, h, placa)).map_err(|e| format!("motor: {e}"))) {
            Ok((m, b, w, h, placa)) => {
                log(&format!("OpenGL 2: {w}×{h} · {placa}"));
                j.en_uso = Placa::Gl2; j.al_abrir();
                return Some(Ventana { m: Motor3d::Gl2(m, None), gl: Some(b), w, h, placa, _win: win });
            }
            Err(e) => { log(&format!("OpenGL 2 no anduvo: {e}")); j.avisar(format!("OpenGL 2 no anduvo ({e}): se usa OpenGL 3")); }
        }
    }
    match abrir_gl(p, 3).and_then(|(gl, b, w, h, placa)| unsafe { jxmotor::gpu::Motor::nuevo(gl, Opciones::default()) }.map(|m| (m, b, w, h, placa)).map_err(|e| format!("motor: {e}"))) {
        Ok((m, b, w, h, placa)) => {
            log(&format!("OpenGL 3: {w}×{h} · {placa}"));
            j.en_uso = Placa::Gl3; j.al_abrir();
            Some(Ventana { m: Motor3d::Gl(m, None), gl: Some(b), w, h, placa, _win: win })
        }
        Err(e) => { log(&format!("no se pudo abrir OpenGL 3: {e}")); if let Some(m) = marca { let _ = std::fs::write(m, format!("no pudo abrir OpenGL 3: {e}")); } None }
    }
}

/// la pantalla a su frecuencia más alta: 120 Hz si la tiene (ANativeWindow_setFrameRate es de Android 11)
fn pedir_120(win: *mut c_void) {
    unsafe {
        if let Ok(l) = libloading::Library::new("libandroid.so") {
            if let Ok(f) = l.get::<unsafe extern "C" fn(*mut c_void, f32, i8) -> i32>(b"ANativeWindow_setFrameRate\0") { f(win, 120.0, 0); }
        }
    }
}

/// EGL con OpenGL ES `version` (2 o 3) en la ventana: el contexto de glow, lo de EGL, el tamaño y la placa
fn abrir_gl(win: *mut c_void, version: i32) -> Result<(glow::Context, BaseGl, i32, i32, String), String> {
    let e = unsafe { Egl::load_required() }.map_err(|x| format!("libEGL: {x}"))?;
    let d = unsafe { e.get_display(egl::DEFAULT_DISPLAY) }.ok_or("sin pantalla EGL")?;
    e.initialize(d).map_err(|x| format!("eglInitialize: {x}"))?; e.bind_api(egl::OPENGL_ES_API).map_err(|x| format!("eglBindAPI: {x}"))?;
    let bit: egl::Int = if version >= 3 { 0x0040 } else { egl::OPENGL_ES2_BIT };
    // (OpenGL 3 dibuja en sus propios cuadros: la ventana sin profundidad; OpenGL 2 dibuja directo en la ventana: con 16 bits
    // de profundidad)
    let prof = if version >= 3 { 0 } else { 16 };
    let cfg = e.choose_first_config(d, &[egl::SURFACE_TYPE, egl::WINDOW_BIT, egl::RENDERABLE_TYPE, bit, egl::RED_SIZE, 8, egl::GREEN_SIZE, 8, egl::BLUE_SIZE, 8, egl::DEPTH_SIZE, prof, egl::NONE]).ok().flatten()
        .or_else(|| e.choose_first_config(d, &[egl::SURFACE_TYPE, egl::WINDOW_BIT, egl::RENDERABLE_TYPE, bit, egl::DEPTH_SIZE, prof, egl::NONE]).ok().flatten()).ok_or(format!("sin configuración EGL con OpenGL ES {version}"))?;
    let ctx = e.create_context(d, cfg, None, &[egl::CONTEXT_CLIENT_VERSION, version, egl::NONE]).map_err(|x| format!("contexto ES {version}: {x}"))?;
    let s = unsafe { e.create_window_surface(d, cfg, win as egl::NativeWindowType, None) }.map_err(|x| format!("superficie: {x}"))?;
    e.make_current(d, Some(s), Some(s), Some(ctx)).map_err(|x| format!("eglMakeCurrent: {x}"))?;
    let _ = e.swap_interval(d, 1);
    let lib = unsafe { if version >= 3 { libloading::Library::new("libGLESv3.so").or_else(|_| libloading::Library::new("libGLESv2.so")) } else { libloading::Library::new("libGLESv2.so") } }.ok();
    let gl = unsafe { glow::Context::from_loader_function(|n| {
        let cs = CString::new(n).unwrap();
        if let Some(l) = &lib { if let Ok(p) = l.get::<*const c_void>(cs.as_bytes_with_nul()) { if !p.is_null() { return *p; } } }
        e.get_proc_address(n).map_or(std::ptr::null(), |p| p as *const c_void)
    }) };
    std::mem::forget(lib);   // (la biblioteca de GL queda abierta mientras viva la app)
    let placa = unsafe { use glow::HasContext; gl.get_parameter_string(glow::RENDERER) };
    let w = e.query_surface(d, s, egl::WIDTH).unwrap_or(1); let h = e.query_surface(d, s, egl::HEIGHT).unwrap_or(1);
    Ok((gl, BaseGl { e, d, ctx, s }, w, h, placa))
}

/// cierra el motor (y EGL): la ventana queda libre para el otro motor
fn cerrar(v: Ventana) {
    let Ventana { mut m, gl, .. } = v;
    unsafe { m.vaciar(); }
    drop(m);
    if let Some(BaseGl { e, d, ctx, s }) = gl { let _ = e.make_current(d, None, None, None); let _ = e.destroy_surface(d, s); let _ = e.destroy_context(d, ctx); let _ = e.terminate(d); }
}
