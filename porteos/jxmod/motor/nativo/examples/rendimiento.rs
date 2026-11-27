//! El banco de rendimiento: el juego de la app en un mapa, en la calidad pedida (Ultra de fábrica), a la resolución de un
//! celular barato (1600 × 720), mirando a los cuatro lados; cada cuadro se mide entero (el juego, el armado del dibujo y la
//! placa terminando: glFinish / la espera de Vulkan). Con llvmpipe (la placa de Mesa que dibuja en la CPU) hace de celular
//! muy flojo. Uso: rendimiento [ANCHO ALTO]   (JXM_MOTOR=vk|gl2; JXM_MAPA; JXM_CALIDAD 0..4; JXM_SIN=sombras,ao,reflejo,retoque;
//! JXM_RES=50..100; JXM_FOTO=archivo.png guarda la vista de adelante; JXM_OJOS=x,y,z[,giro,incl])
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
    // (JXM_ADDONS: una carpeta de addons —los mapas del Workshop, como el de inicio—)
    j.gmod.carpeta_externa = std::env::var("JXM_ADDONS").ok().map(std::path::PathBuf::from);
    // (la biblioteca de GMod de rb/: la usan los mapas JX_ —texturas de GMod— y los del Workshop)
    j.gmod.lector_rb = Some(jxmod::comun::gmod_juego::lector_carpetas(vec![std::path::Path::new(&www).join("rb"), "/tmp/claude-0/jxp_pub/rb".into()]));
    j.dt_fijo = Some(1.0 / 60.0); j.en_uso = if vk { Placa::Vulkan } else if gl2 { Placa::Gl2 } else { Placa::Gl3 }; j.aj.tut = true; j.aj.cont = true;
    let cal: usize = std::env::var("JXM_CALIDAD").ok().and_then(|v| v.parse().ok()).unwrap_or(4); j.aj.poner_calidad(cal);
    if let Ok(r) = std::env::var("JXM_RES") { j.aj.res = r.parse().unwrap(); }
    let sin = std::env::var("JXM_SIN").unwrap_or_default();
    for k in sin.split(',') { match k { "sombras" => j.aj.sombras = false, "ao" => j.aj.ao = false, "reflejo" => j.aj.reflejo = false, "retoque" => j.aj.retoque = false, _ => {} } }
    if std::env::var("JXM_DIN").as_deref() == Ok("0") { j.aj.dinamica = false; }
    // (JXM_REFRESCO: el refresco de la pantalla que se simula —60 de fábrica—)
    // (JX Turbo viene prendido de fábrica: JXM_TURBO=0 lo apaga)
    if let Ok(t) = std::env::var("JXM_TURBO") { j.aj.turbo = t != "0"; }
    if let Some(r) = std::env::var("JXM_REFRESCO").ok().and_then(|v| v.parse().ok()) { j.refresco = r; }
    if let Ok(mp) = std::env::var("JXM_MAPA") { assert!(j.poner_mapa(&mp), "no existe el mapa {mp}"); }
    let cpu = std::cell::Cell::new(0.0f64);
    // (JXM_AB=1: los cuadros se alternan entre A —lo de siempre— y B —lo que se prueba, ver jxmotor::gpu::AB— y se miden aparte)
    let ab = std::env::var_os("JXM_AB").is_some(); let ab_t = std::cell::Cell::new([0.0f64; 2]); let ab_n = std::cell::Cell::new([0u32; 2]); let medir_ab = std::cell::Cell::new(false);
    let paso = |j: &mut Juego, m: &mut Motor3d| -> f64 { let t = Instant::now();
        let b = ab && !jxmotor::gpu::ab(); if ab { jxmotor::gpu::AB.store(b, std::sync::atomic::Ordering::Relaxed); } unsafe { j.cuadro(m, w, h, &placa).expect("cuadro"); cpu.set(cpu.get() + t.elapsed().as_secs_f64() * 1000.0); m.esperar(); } let ms = t.elapsed().as_secs_f64() * 1000.0; j.medir(ms as f32);
        if medir_ab.get() { let k = b as usize; let mut tt = ab_t.get(); tt[k] += ms; ab_t.set(tt); let mut nn = ab_n.get(); nn[k] += 1; ab_n.set(nn); }
        ms };
    for _ in 0..90 { paso(&mut j, &mut m); }
    let mut ojos = [j.jug.pos[0], j.jug.pos[1] + 0.72, j.jug.pos[2]];
    let seguido = std::env::var_os("JXM_SEGUIDO").is_some(); let mut seg: Vec<f64> = vec![];
    // (JXM_AGUA=1: mirando el agua del mapa desde su orilla, un poco arriba)
    if std::env::var_os("JXM_AGUA").is_some() { if let Some(a) = j.mapa.as_ref().and_then(|m| m.esc.c.agua.clone()) { if let Some(pr) = a.prof.as_ref() {
        ojos = [pr.x0 + pr.w * 0.5, a.y + 2.6, pr.z0 + pr.h * 0.5]; println!("agua: y {:.2} · de {:.1},{:.1} a {:.1},{:.1}", a.y, pr.x0, pr.z0, pr.x0 + pr.w, pr.z0 + pr.h); } } }
    // (JXM_NUCLEAR=x,z,kilotones,segundos[,tipo]: una nuclear ya empezada ahí —el hongo—)
    if let Ok(t) = std::env::var("JXM_NUCLEAR") { let v: Vec<&str> = t.split(',').collect(); let f = |i: usize| v.get(i).and_then(|x| x.trim().parse::<f64>().ok()).unwrap_or(0.0);
        j.nuk_prueba([f(0) as f32, 30.0, f(1) as f32], f(2).max(1.0), v.get(4).map(|x| x.trim()).unwrap_or("suelo"), f(3)); }
    // (JXM_OJOS=x,y,z[,giro,inclinación en grados]: desde ahí —la foto, con ese giro—)
    let mut giro0 = 0.0f32; let mut incl: Option<f32> = None;
    if let Ok(t) = std::env::var("JXM_OJOS") { let v: Vec<f32> = t.split(',').filter_map(|x| x.trim().parse().ok()).collect();
        if v.len() >= 3 { ojos = [v[0], v[1], v[2]]; } if v.len() >= 4 { giro0 = v[3]; } if v.len() >= 5 { incl = Some(v[4].to_radians()); } }
    // (JXM_MIRAR_SOL=1: mirando hacia el sol —el giro y la inclinación de JXM_OJOS se suman—)
    if std::env::var_os("JXM_MIRAR_SOL").is_some() { if let Some(l) = j.mapa.as_ref().map(|m| m.luz.sol) { let n = (l[0] * l[0] + l[1] * l[1] + l[2] * l[2]).sqrt().max(1e-6);
        giro0 += l[0].atan2(l[2]).to_degrees(); incl = Some((l[1] / n).asin() + incl.unwrap_or(0.0)); println!("sol: {:?}", l); } }
    cpu.set(0.0); if let Motor3d::Gl(g, _) = &mut m { if let Some(f) = g.fases.as_mut() { f.1.clear(); } g.fases_b.clear(); } medir_ab.set(true); let mut total = 0.0; let mut n = 0; let mut peor = 0f64; let mut por_vista = vec![];
    for (k, yaw) in [0.0f32, 90.0, 180.0, 270.0].iter().enumerate() {
        j.poner_ojos(ojos, (yaw + giro0).to_radians(), incl.unwrap_or(if std::env::var_os("JXM_AGUA").is_some() { -0.35 } else { -0.05 }));
        for _ in 0..8 { paso(&mut j, &mut m); }
        let mut s = 0.0; for _ in 0..20 { let ms = paso(&mut j, &mut m); s += ms; peor = peor.max(ms); }
        total += s; n += 20; por_vista.push(s / 20.0);
        // (JXM_SEGUIDO: además, 20 cuadros seguidos sin esperar a la placa en cada uno —como el juego, que no espera—: el ritmo real)
        if seguido { let t = Instant::now(); for _ in 0..20 { unsafe { j.cuadro(&mut m, w, h, &placa).expect("cuadro"); } j.medir(16.0); } unsafe { m.esperar(); } seg.push(t.elapsed().as_secs_f64() * 1000.0 / 20.0); }
        if k == std::env::var("JXM_FOTO_VISTA").ok().and_then(|x| x.parse().ok()).unwrap_or(0) { if let Ok(f) = std::env::var("JXM_FOTO") { guardar(&mut m, w, h, &f); } }
    }
    let prom = total / n as f64; println!("de eso, armar el cuadro (CPU, hasta mandarlo): {:.1} ms", cpu.get() / (n as f64 + 32.0));
    println!("{} · {}x{} · calidad {} res {}% sombras {} ao {} reflejo {} retoque {} · {}", placa, w, h, cal, j.aj.res, j.aj.sombras, j.aj.ao, j.aj.reflejo, j.aj.retoque, std::env::var("JXM_MAPA").unwrap_or("el de siempre".into()));
    println!("cuadro {:.1} ms = {:.1} fps (por vista: {}) · peor {:.0} ms · resolución dinámica {:.0} % · cpu juego {:?}", prom, 1000.0 / prom, por_vista.iter().map(|x| format!("{x:.1}")).collect::<Vec<_>>().join(" / "), peor, j.drs * 100.0, j.perf);
    if let Some((t, d)) = m.tiempos() { println!("placa {t:.1} ms: {d}"); }
    if j.aj.turbo { println!("JX Turbo: reales {:.1} ms · intermedios {:.1} ms · {} intermedios de {} cuadros · placa (medidores {}): real {:.1} ms, intermedio {:.1} ms · CPU real {:.1} intermedio {:.1} · prendido {}", j.ms_real, j.ms_inter, j.n_inter, n + 32, m.tiene_reloj(), j.placa_ms, j.placa_inter, j.cpu_real, j.cpu_inter, j.turbo_on); }
    if seguido { let p = seg.iter().sum::<f64>() / seg.len() as f64; println!("seguido (sin esperar cada cuadro): {p:.1} ms = {:.1} fps (por vista: {})", 1000.0 / p, seg.iter().map(|x| format!("{x:.1}")).collect::<Vec<_>>().join(" / ")); }
    if std::env::var_os("JXM_RESUMEN").is_some() { println!("{}", m.resumen()); }
    if let Motor3d::Gl2(g, _) = &m { if let Some((_, v)) = &g.fases { println!("fases GL2 (ms por cuadro): {}", v.iter().map(|(k, ms)| format!("{k} {:.1}", ms / (n as f64 + 32.0))).collect::<Vec<_>>().join(" · ")); } }
    if std::env::var_os("JXM_PERFIL").is_some() { if let Motor3d::Gl(g, _) = &m { println!("perfil: {}", g.perfil_resumen()); } }
    if let Motor3d::Gl(g, _) = &m { if let Some((_, v)) = &g.fases {
        let d = if ab { (n as f64 + 32.0) / 2.0 } else { n as f64 + 32.0 };
        println!("fases (ms por cuadro){}: {}", if ab { " A" } else { "" }, v.iter().map(|(k, ms)| format!("{k} {:.1}", ms / d)).collect::<Vec<_>>().join(" · "));
        if ab { println!("fases (ms por cuadro) B: {}", g.fases_b.iter().map(|(k, ms)| format!("{k} {:.1}", ms / d)).collect::<Vec<_>>().join(" · ")); }
    } }
    if ab { let (t, nn) = (ab_t.get(), ab_n.get()); let (a, b) = (t[0] / nn[0].max(1) as f64, t[1] / nn[1].max(1) as f64); println!("A/B: A {a:.1} ms · B {b:.1} ms · B − A = {:+.1} ms ({:+.1} %)", b - a, (b - a) / a * 100.0); }
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
