//! El banco de rendimiento: el juego de la app en un mapa, en la calidad pedida (Ultra de fábrica), a la resolución de un
//! celular barato (1600 × 720), mirando a los cuatro lados; cada cuadro se mide entero (el juego, el armado del dibujo y la
//! placa terminando: glFinish / la espera de Vulkan). Con llvmpipe (la placa de Mesa que dibuja en la CPU) hace de celular
//! muy flojo. Uso: rendimiento [ANCHO ALTO]   (JXM_MOTOR=vk|gl2; JXM_MAPA; JXM_CALIDAD 0..4; JXM_SIN=sombras,ao,reflejo,retoque;
//! JXM_RES=50..100; JXM_FOTO=archivo.png guarda la vista de adelante)
use glow::HasContext;
use jxjuego::paquete::Paquete;
use jxmod::comun::{Juego, Placa};
use jxmod::motor::Motor3d;
use jxmotor::gpu::{Motor, Opciones};
use khronos_egl as egl;
use std::path::Path;
use std::time::Instant;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let (w, h): (i32, i32) = (a.get(1).and_then(|x| x.parse().ok()).unwrap_or(1600), a.get(2).and_then(|x| x.parse().ok()).unwrap_or(720));
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxm/www_todo".into());
    let let_ = std::env::var("JXM_LETRAS").unwrap_or("/tmp/claude-0/jxm/letras".into());
    let motor = std::env::var("JXM_MOTOR").unwrap_or_default(); let vk = motor == "vk"; let gl2 = motor == "gl2";
        let (mw, mh) = (w, h);
    // el motor, una vez, del tamaño más grande (cada foto lee sólo su parte)
    let (mut m, placa, egl_) = if vk {
        let m = unsafe { jxmotor::vk::Motor::nuevo(None, mw as u32, mh as u32, Opciones::default()) }.expect("Vulkan");
        let p = m.placa.clone(); (Motor3d::Vk(m), p, None)
    } else {
        let e = unsafe { egl::DynamicInstance::<egl::EGL1_5>::load_required() }.expect("libEGL");
        let d = unsafe { e.get_platform_display(0x31DD, egl::DEFAULT_DISPLAY, &[egl::ATTRIB_NONE]) }.expect("pantalla EGL");
        e.initialize(d).unwrap(); e.bind_api(egl::OPENGL_ES_API).unwrap();
        let bit = if gl2 { egl::OPENGL_ES2_BIT } else { egl::OPENGL_ES3_BIT };
        let cfg = e.choose_first_config(d, &[egl::SURFACE_TYPE, egl::PBUFFER_BIT, egl::RENDERABLE_TYPE, bit, egl::NONE]).unwrap().or_else(|| e.choose_first_config(d, &[egl::NONE]).unwrap()).unwrap();
        let ctx = e.create_context(d, cfg, None, &[egl::CONTEXT_MAJOR_VERSION, if gl2 { 2 } else { 3 }, egl::NONE]).unwrap();
        e.make_current(d, None, None, Some(ctx)).unwrap();
        let gl = unsafe { glow::Context::from_loader_function(|s| e.get_proc_address(s).map_or(std::ptr::null(), |p| p as *const _)) };
        let placa = unsafe { gl.get_parameter_string(glow::RENDERER) };
        let fb = unsafe {
            let t = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(t)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::RGBA8, mw, mh);
            let f = gl.create_framebuffer().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::RENDERBUFFER, Some(t));
            if gl2 { let p = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(p)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::DEPTH_COMPONENT16, mw, mh); gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::DEPTH_ATTACHMENT, glow::RENDERBUFFER, Some(p)); }
            f
        };
        let m = if gl2 { Motor3d::Gl2(unsafe { jxmotor::gl2::Motor::nuevo(gl, jxmotor::gl2::Opciones2::default()) }.expect("motor gl2"), Some(fb)) } else { Motor3d::Gl(unsafe { Motor::nuevo(gl, Opciones::default()) }.expect("motor"), Some(fb)) };
        (m, placa, Some(e))
    };
    let _ = egl_;
    let paq = Paquete::abrir(Path::new(&www));
    let datos = std::env::temp_dir().join("jxm_rend_datos"); let _ = std::fs::create_dir_all(&datos); for n in ["mapa.txt", "ajustes.txt"] { let _ = std::fs::remove_file(datos.join(n)); }
    let lj = std::fs::read_to_string(Path::new(&let_).join("letras.json")).ok(); let lp = std::fs::read(Path::new(&let_).join("letras.png")).ok();
    let mut j = Juego::nuevo(paq, lj, lp, Some(datos));
    j.dt_fijo = Some(1.0 / 60.0); j.en_uso = if vk { Placa::Vulkan } else if gl2 { Placa::Gl2 } else { Placa::Gl3 }; j.aj.tut = true; j.aj.cont = true;
    let cal: usize = std::env::var("JXM_CALIDAD").ok().and_then(|v| v.parse().ok()).unwrap_or(4); j.aj.poner_calidad(cal);
    if let Ok(r) = std::env::var("JXM_RES") { j.aj.res = r.parse().unwrap(); }
    let sin = std::env::var("JXM_SIN").unwrap_or_default();
    for k in sin.split(',') { match k { "sombras" => j.aj.sombras = false, "ao" => j.aj.ao = false, "reflejo" => j.aj.reflejo = false, "retoque" => j.aj.retoque = false, _ => {} } }
    if std::env::var("JXM_DIN").as_deref() == Ok("0") { j.aj.dinamica = false; }
    if let Ok(mp) = std::env::var("JXM_MAPA") { assert!(j.poner_mapa(&mp), "no existe el mapa {mp}"); }
    let cpu = std::cell::Cell::new(0.0f64);
    let paso = |j: &mut Juego, m: &mut Motor3d| -> f64 { let t = Instant::now(); unsafe { j.cuadro(m, w, h, &placa).expect("cuadro"); cpu.set(cpu.get() + t.elapsed().as_secs_f64() * 1000.0); m.esperar(); } let ms = t.elapsed().as_secs_f64() * 1000.0; j.medir(ms as f32); ms };
    for _ in 0..90 { paso(&mut j, &mut m); }
    let mut ojos = [j.jug.pos[0], j.jug.pos[1] + 0.72, j.jug.pos[2]];
    // (JXM_AGUA=1: mirando el agua del mapa desde su orilla, un poco arriba)
    if std::env::var_os("JXM_AGUA").is_some() { if let Some(a) = j.mapa.as_ref().and_then(|m| m.esc.c.agua.clone()) { if let Some(pr) = a.prof.as_ref() {
        ojos = [pr.x0 + pr.w * 0.5, a.y + 2.6, pr.z0 + pr.h * 0.5]; println!("agua: y {:.2} · de {:.1},{:.1} a {:.1},{:.1}", a.y, pr.x0, pr.z0, pr.x0 + pr.w, pr.z0 + pr.h); } } }
    cpu.set(0.0); if let Motor3d::Gl(g, _) = &mut m { if let Some(f) = g.fases.as_mut() { f.1.clear(); } } let mut total = 0.0; let mut n = 0; let mut peor = 0f64; let mut por_vista = vec![];
    for (k, yaw) in [0.0f32, 90.0, 180.0, 270.0].iter().enumerate() {
        j.poner_ojos(ojos, yaw.to_radians(), if std::env::var_os("JXM_AGUA").is_some() { -0.35 } else { -0.05 });
        for _ in 0..8 { paso(&mut j, &mut m); }
        let mut s = 0.0; for _ in 0..20 { let ms = paso(&mut j, &mut m); s += ms; peor = peor.max(ms); }
        total += s; n += 20; por_vista.push(s / 20.0);
        if k == 0 { if let Ok(f) = std::env::var("JXM_FOTO") { guardar(&mut m, w, h, &f); } }
    }
    let prom = total / n as f64; println!("de eso, armar el cuadro (CPU, hasta mandarlo): {:.1} ms", cpu.get() / (n as f64 + 32.0));
    println!("{} · {}x{} · calidad {} res {}% sombras {} ao {} reflejo {} retoque {} · {}", placa, w, h, cal, j.aj.res, j.aj.sombras, j.aj.ao, j.aj.reflejo, j.aj.retoque, std::env::var("JXM_MAPA").unwrap_or("el de siempre".into()));
    println!("cuadro {:.1} ms = {:.1} fps (por vista: {}) · peor {:.0} ms · resolución dinámica {:.0} % · cpu juego {:?}", prom, 1000.0 / prom, por_vista.iter().map(|x| format!("{x:.1}")).collect::<Vec<_>>().join(" / "), peor, j.drs * 100.0, j.perf);
    if let Some((t, d)) = m.tiempos() { println!("placa {t:.1} ms: {d}"); }
    if std::env::var_os("JXM_RESUMEN").is_some() { println!("{}", m.resumen()); }
    if let Motor3d::Gl(g, _) = &m { if let Some((_, v)) = &g.fases { println!("fases (ms por cuadro): {}", v.iter().map(|(k, ms)| format!("{k} {:.1}", ms / (n as f64 + 32.0))).collect::<Vec<_>>().join(" · ")); } }
}

fn guardar(m: &mut Motor3d, w: i32, h: i32, ruta: &str) {
    let dado = match m {
        Motor3d::Vk(v) => unsafe { v.leer_imagen() }.expect("imagen"),
        _ => {
            let (gl, fb): (&glow::Context, Option<glow::Framebuffer>) = match m { Motor3d::Gl(g, f) => (&g.gl, *f), Motor3d::Gl2(g, f) => (&g.gl, *f), _ => unreachable!() };
            let mut px = vec![0u8; (w * h * 4) as usize];
            unsafe { gl.bind_framebuffer(glow::FRAMEBUFFER, fb); gl.read_pixels(0, 0, w, h, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelPackData::Slice(Some(&mut px))); }
            let fila = (w * 4) as usize; let mut d = vec![0u8; px.len()];
            for y in 0..h as usize { d[y * fila..(y + 1) * fila].copy_from_slice(&px[(h as usize - 1 - y) * fila..(h as usize - y) * fila]); }
            d
        }
    };
    let f = std::fs::File::create(ruta).unwrap(); let mut enc = png::Encoder::new(std::io::BufWriter::new(f), w as u32, h as u32);
    enc.set_color(png::ColorType::Rgba); enc.set_depth(png::BitDepth::Eight); enc.write_header().unwrap().write_image_data(&dado).unwrap();
}
