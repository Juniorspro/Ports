//! Lo de Android (NativeActivity): el bucle, la ventana con el motor elegido (OpenGL 3 u OpenGL 2 con EGL), los
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
struct BaseGl { e: Egl, d: egl::Display, ctx: egl::Context, s: egl::Surface, cfg: egl::Config }
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
    // (vulkan_prueba.txt: lo que quedó de cuando se podía elegir Vulkan; se borra)
    let _ = VK_PRUEBA.set(datos.as_ref().map(|d| d.join("vulkan_prueba.txt")));
    let vk_cayo = vk_prueba().and_then(|p| { let t = std::fs::read_to_string(&p).ok(); let _ = std::fs::remove_file(&p); t });
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
    let java = unsafe { crate::red_android::Java::de_vm(app.vm_as_ptr()) }; j.gmod.http_bin = Some(java.http_bin()); j.soc.http = Some(java.http()); j.gmod.carpeta_externa = app.external_data_path().map(|p| p.join("addons"));
    // (el contenido base de GMod y HL2 —rb/gm_lib.*— y el menú de GMod —rb/jxp/— leídos de la APK)
    {   let lr = crate::comun::gmod_juego::lector_android(&app); let bj = bajas.clone();
        j.gmod.lector_rb = Some(std::sync::Arc::new(move |n: &str, o: u64, len: usize| lr(n, o, len).or_else(|| {
            use std::os::unix::fs::FileExt;
            let Some(p) = bj.archivo(n) else { bj.pedir(n); return None };
            if len == usize::MAX { return std::fs::read(p).ok(); }
            let f = std::fs::File::open(p).ok()?; let mut v = vec![0u8; len]; f.read_exact_at(&mut v, o).ok()?; Some(v)
        }))); }
    j.bajas = Some(bajas);
    // (Juego.java también graba: Grabar.java)
    let mut java: Option<crate::red_android::Teclado> = None;
    // (escribir: el cuadro de texto de Juego.java)
    if let Some(t) = unsafe { crate::red_android::Teclado::nuevo(app.vm_as_ptr(), app.activity_as_ptr()) } {
        // (el refresco de la pantalla: los gráficos automáticos buscan los cuadros que da —120 en una de 120 Hz—)
        if let Some(r) = t.refresco() { if r > 20.0 { j.refresco = r; } }
        // (el candado de multicast, la primera vez que se buscan partidas en el Wi-Fi)
        { let t4 = t.clone(); j.lan.candado = Some(Box::new(move || t4.candado_multicast())); }
        // (la actualización de la app, en el inicio: Actualizar.java la busca al abrir, la baja y la instala encima)
        { let (t5, t6) = (t.clone(), t.clone()); j.ini.act_estado = Some(Box::new(move || t5.estado_actualizacion())); j.ini.act_pedir = Some(Box::new(move || t6.actualizar_ahora())); }
        // (la cuenta con Google: la página de la tienda en el navegador del celular)
        { let t7 = t.clone(); j.soc.abrir = Some(Box::new(move |u: &str| t7.abrir_url(u))); }
        // (la radio y la tele: Medios.java)
        j.med.app = Some(Box::new(t.clone()));
        // (el micrófono de la voz por cercanía: Voz.java)
        j.vz.micro = Some(Box::new(t.clone()));
        // (el video para Bugs y sugerencias: Archivo.java)
        j.ini.pn.bf.app = Some(Box::new(t.clone()));
        java = Some(t.clone());
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
    // (la memoria del celular: con poca, Automático no prueba las calidades que no entran)
    j.tope_memoria(crate::comun::gfx_juego::memoria_mb());
    // (si la vez anterior se cerró entrando a una partida —el sistema la cerró por memoria o se cayó la placa: eso no deja un
    // «se cerró»—, esta vez entra con gráficos más livianos y sin el mod que se estaba montando)
    let entrando = j.entrando_anterior();
    if let Some(t) = &entrando { let msg = j.seguro_tras_cierre(t); log(&format!("{msg}\n{t}")); if j.error.is_none() && anterior.is_none() && se_trabo.is_none() { j.error = Some(format!("{msg}\n\n{t}")); } }
    if let Some(a) = anterior.or(se_trabo) { if j.error.is_none() { j.error = Some(format!("la vez anterior {a}")); } }
    // (Vulkan ya no está en el celular: el que lo tenía elegido queda en OpenGL 3)
    if vk_cayo.is_some() || j.placa == Placa::Vulkan { j.placa = Placa::Gl3; if let Some(d) = vk_prueba().as_deref().and_then(|p| p.parent()) { let _ = std::fs::write(d.join("motor.txt"), Placa::Gl3.clave()); } }
    let mut v: Option<Ventana> = None;
    let mut salir = false;
    let mut grab: Option<Grab> = None;
    let mut t_ritmo = Instant::now();
    while !salir {
        // (JX Turbo: un cuadro por cada refresco de la pantalla, a ritmo parejo, y el toque leído justo antes. Sin esto los
        // intermedios —que cuestan poco— salían uno atrás del otro detrás del real, la pantalla los mostraba separados y al
        // girar la cámara avanzaba a los saltos: el tembleque. Un poco antes del refresco, así nunca se queda sin cuadro)
        if v.is_some() && j.turbo_on && j.mapa.is_some() {
            let per = 0.995 / j.refresco.max(30.0); let ya = t_ritmo.elapsed().as_secs_f32();
            if ya < per { std::thread::sleep(Duration::from_secs_f32(per - ya)); }
        }
        t_ritmo = Instant::now();
        let espera = if v.is_some() { Some(Duration::ZERO) } else { None };
        app.poll_events(espera, |ev| {
            if let PollEvent::Main(me) = ev {
                match me {
                    MainEvent::InitWindow { .. } => { crate::caja_negra::paso("abrir la ventana"); if let Some(w) = app.native_window() { v = abrir(w, &mut j, marca.as_deref()); } crate::caja_negra::a_la_vista(v.is_some()); }
                    MainEvent::TerminateWindow { .. } => { if let (Some(g), Some(t), Some(x)) = (grab.take(), &java, v.as_ref()) { if let Some(b) = &x.gl { let _ = grab_terminar(g, t, b, &x.m, &j); } j.grabando = false; } crate::caja_negra::a_la_vista(false); crate::caja_negra::partida_lista(); crate::caja_negra::paso("cerrar la ventana"); if let Some(x) = v.take() { cerrar(x); } vk_prueba_fin(); }
                    MainEvent::Destroy => { salir = true; }
                    _ => {}
                }
            }
        });
        // el tacto
        if let Ok(mut it) = app.input_events_iter() {
            loop {
                // (las teclas de volumen siguen a Android: antes se daban por usadas y el volumen del celu no se podía bajar)
                let hubo = it.next(|e| match e {
                    InputEvent::MotionEvent(me) => { tocar(&mut j, &v, me); InputStatus::Handled }
                    InputEvent::KeyEvent(k) if matches!(k.key_code(), android_activity::input::Keycode::VolumeUp | android_activity::input::Keycode::VolumeDown | android_activity::input::Keycode::VolumeMute) => InputStatus::Unhandled,
                    _ => InputStatus::Handled,
                });
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
            // (Grabar: empezar o terminar, y este cuadro al codificador)
            if let Some(p) = j.grabar_pedido.take() {
                if p && grab.is_none() { match (&java, &x.gl) { (Some(t), Some(b)) => match grab_empezar(t, b, &x.m, x.w, x.h, &j) { Ok(g) => { grab = Some(g); j.grabando = true; j.avisar("Grabando… (la pausa → Grabar lo termina)".into()); } Err(e) => j.avisar(format!("No se pudo grabar: {e}")) }, _ => j.avisar("Grabar necesita OpenGL 3 u OpenGL 2".into()) } }
                else if !p { if let (Some(g), Some(t), Some(b)) = (grab.take(), &java, &x.gl) { let r = grab_terminar(g, t, b, &x.m, &j); j.grabando = false; j.avisar(if let Some(e) = r.strip_prefix('!') { format!("No se pudo guardar el video: {e}") } else { format!("Video guardado: {r}") }); } else { j.grabando = false; } }
            }
            if let (Some(g), Some(b), Some(t)) = (grab.as_mut(), &x.gl, &java) { grab_cuadro(g, b, &x.m, x.w, x.h); grab_audio(t, &j); }
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

static VK_PRUEBA: std::sync::OnceLock<Option<std::path::PathBuf>> = std::sync::OnceLock::new();
fn vk_prueba() -> Option<std::path::PathBuf> { VK_PRUEBA.get().cloned().flatten() }
/// Vulkan anduvo (o se cerró bien): ya no está a prueba
fn vk_prueba_fin() { if let Some(p) = vk_prueba() { let _ = std::fs::remove_file(p); } }

/// abre el motor que pidió el jugador en la ventana (OpenGL 3 u OpenGL 2; si OpenGL 2 no anda, OpenGL 3)
fn abrir(win: android_activity::ndk::native_window::NativeWindow, j: &mut Juego, marca: Option<&std::path::Path>) -> Option<Ventana> {
    let p = win.ptr().as_ptr() as *mut c_void;
    pedir_120(p);
    let quiere = j.motor_pedido();
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
            // (los Mali con OpenGL 3: en algunos la imagen queda negra con pedazos del menú —un Huawei con Mali-G51— y con OpenGL 2
            // andan bien y más rápido. Si el jugador no eligió motor, la primera vez se pasa a OpenGL 2; queda guardado y se puede
            // volver a elegir OpenGL 3 en Opciones → Motor)
            if placa.to_lowercase().contains("mali") && j.datos_dir().map_or(false, |d| !d.join("motor.txt").exists()) {
                if let Some(d) = j.datos_dir() { let _ = std::fs::write(d.join("motor.txt"), Placa::Gl2.clave()); }
                j.placa = Placa::Gl2; j.cambiar_motor = true; log("Mali: se pasa a OpenGL 2");
            }
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
    Ok((gl, BaseGl { e, d, ctx, s, cfg }, w, h, placa))
}

/// cierra el motor (y EGL): la ventana queda libre para el otro motor
fn cerrar(v: Ventana) {
    let Ventana { mut m, gl, .. } = v;
    unsafe { m.vaciar(); }
    drop(m);
    if let Some(BaseGl { e, d, ctx, s, .. }) = gl { let _ = e.make_current(d, None, None, None); let _ = e.destroy_surface(d, s); let _ = e.destroy_context(d, ctx); let _ = e.terminate(d); }
}


// ---------------- Grabar (Grabar.java): cada cuadro de la pantalla al codificador ----------------
/// la grabación en curso: la ventana del codificador y su superficie de EGL, su tamaño, la textura donde se copia la
/// pantalla, el programa que la dibuja, cuándo empezó y el último cuadro mandado
struct Grab { win: *mut c_void, surf: egl::Surface, w: i32, h: i32, tex: glow::Texture, tw: i32, th: i32, prog: glow::Program, vbo: glow::Buffer, t0: Instant, ult: f32, pres: Option<unsafe extern "system" fn(*mut c_void, *mut c_void, i64) -> u32> }
#[link(name = "android")] extern "C" { fn ANativeWindow_release(w: *mut c_void); }
fn gl_de(m: &Motor3d) -> Option<&glow::Context> { match m { Motor3d::Gl(m, _) => Some(&m.gl), Motor3d::Gl2(m, _) => Some(&m.gl), #[allow(unreachable_patterns)] _ => None } }
fn grab_empezar(t: &crate::red_android::Teclado, b: &BaseGl, m: &Motor3d, w: i32, h: i32, j: &Juego) -> Result<Grab, String> {
    use glow::HasContext;
    let gl = gl_de(m).ok_or("sin OpenGL")?;
    // (hasta 1280 del lado mayor, múltiplos de 16: lo que aguantan los codificadores de todos los celulares)
    let k = (1280.0 / w.max(h).max(1) as f32).min(1.0); let gw = (((w as f32 * k) as i32) & !15).max(16); let gh = (((h as f32 * k) as i32) & !15).max(16);
    let rate = j.sonido.mezcla.lock().map(|x| x.rate).unwrap_or(48000) as i32;
    let win = t.grabar_empezar(gw, gh, 30, rate)?;
    let surf = match unsafe { b.e.create_window_surface(b.d, b.cfg, win as egl::NativeWindowType, None) } { Ok(s) => s, Err(e) => { unsafe { ANativeWindow_release(win); } let _ = t.grabar_terminar(); return Err(format!("superficie: {e}")); } };
    unsafe {
        let tex = gl.create_texture()?; gl.bind_texture(glow::TEXTURE_2D, Some(tex));
        gl.tex_image_2d(glow::TEXTURE_2D, 0, glow::RGB as i32, w, h, 0, glow::RGB, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(None));
        for (a, v) in [(glow::TEXTURE_MIN_FILTER, glow::LINEAR), (glow::TEXTURE_MAG_FILTER, glow::LINEAR), (glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE), (glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE)] { gl.tex_parameter_i32(glow::TEXTURE_2D, a, v as i32); }
        let prog = gl.create_program()?;
        for (k, src) in [(glow::VERTEX_SHADER, "attribute vec2 p; varying vec2 v; void main() { v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }"), (glow::FRAGMENT_SHADER, "precision mediump float; varying vec2 v; uniform sampler2D t; void main() { gl_FragColor = texture2D(t, v); }")] {
            let sh = gl.create_shader(k)?; gl.shader_source(sh, src); gl.compile_shader(sh); gl.attach_shader(prog, sh);
        }
        gl.bind_attrib_location(prog, 0, "p"); gl.link_program(prog);
        if !gl.get_program_link_status(prog) { return Err(gl.get_program_info_log(prog)); }
        let vbo = gl.create_buffer()?; gl.bind_buffer(glow::ARRAY_BUFFER, Some(vbo));
        let tri: [f32; 6] = [-1.0, -1.0, 3.0, -1.0, -1.0, 3.0]; let by: Vec<u8> = tri.iter().flat_map(|x| x.to_le_bytes()).collect();
        gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, &by, glow::STATIC_DRAW); gl.bind_buffer(glow::ARRAY_BUFFER, None);
        let pres = b.e.get_proc_address("eglPresentationTimeANDROID").map(|f| std::mem::transmute::<_, unsafe extern "system" fn(*mut c_void, *mut c_void, i64) -> u32>(f));
        if let Ok(mut mz) = j.sonido.mezcla.lock() { mz.grab = Some(vec![]); }
        Ok(Grab { win, surf, w: gw, h: gh, tex, tw: w, th: h, prog, vbo, t0: Instant::now(), ult: -1.0, pres })
    }
}
/// este cuadro (a 30 por segundo como mucho): la pantalla a la textura, y de ahí dibujada en la superficie del codificador
fn grab_cuadro(g: &mut Grab, b: &BaseGl, m: &Motor3d, w: i32, h: i32) {
    use glow::HasContext;
    let t = g.t0.elapsed().as_secs_f32(); if t - g.ult < 1.0 / 30.0 - 0.003 { return; } g.ult = t;
    let Some(gl) = gl_de(m) else { return };
    let es3 = matches!(m, Motor3d::Gl(..));
    unsafe {
        gl.bind_framebuffer(glow::FRAMEBUFFER, None); gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, Some(g.tex));
        if (w, h) != (g.tw, g.th) { gl.tex_image_2d(glow::TEXTURE_2D, 0, glow::RGB as i32, w, h, 0, glow::RGB, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(None)); g.tw = w; g.th = h; }
        gl.copy_tex_sub_image_2d(glow::TEXTURE_2D, 0, 0, 0, 0, 0, w, h);
        if b.e.make_current(b.d, Some(g.surf), Some(g.surf), Some(b.ctx)).is_err() { return; }
        gl.viewport(0, 0, g.w, g.h); gl.disable(glow::DEPTH_TEST); gl.disable(glow::BLEND); gl.disable(glow::SCISSOR_TEST); gl.disable(glow::CULL_FACE);
        if es3 { gl.bind_vertex_array(None); }
        gl.use_program(Some(g.prog)); gl.uniform_1_i32(gl.get_uniform_location(g.prog, "t").as_ref(), 0);
        gl.bind_buffer(glow::ARRAY_BUFFER, Some(g.vbo)); gl.enable_vertex_attrib_array(0); gl.vertex_attrib_pointer_f32(0, 2, glow::FLOAT, false, 8, 0);
        gl.draw_arrays(glow::TRIANGLES, 0, 3);
        gl.disable_vertex_attrib_array(0); gl.bind_buffer(glow::ARRAY_BUFFER, None);
        if let Some(f) = g.pres { f(b.d.as_ptr(), g.surf.as_ptr(), (t as f64 * 1e9) as i64); }
        let _ = b.e.swap_buffers(b.d, g.surf);
        let _ = b.e.make_current(b.d, Some(b.s), Some(b.s), Some(b.ctx));
        gl.viewport(0, 0, w, h);
    }
}
/// el sonido que mezcló el juego desde el cuadro anterior, al codificador de audio (16 bits)
fn grab_audio(t: &crate::red_android::Teclado, j: &Juego) {
    let Some(f) = j.sonido.mezcla.lock().ok().and_then(|mut m| m.grab.as_mut().map(std::mem::take)) else { return };
    let pcm: Vec<i16> = f.iter().map(|x| (x * 32767.0) as i16).collect(); t.grabar_audio(&pcm);
}
fn grab_terminar(g: Grab, t: &crate::red_android::Teclado, b: &BaseGl, m: &Motor3d, j: &Juego) -> String {
    use glow::HasContext;
    grab_audio(t, j); if let Ok(mut mz) = j.sonido.mezcla.lock() { mz.grab = None; }
    let _ = b.e.destroy_surface(b.d, g.surf);
    if let Some(gl) = gl_de(m) { unsafe { gl.delete_texture(g.tex); gl.delete_program(g.prog); gl.delete_buffer(g.vbo); } }
    let r = t.grabar_terminar();
    unsafe { ANativeWindow_release(g.win); }
    r
}
