//! Fotos de cualquier mapa (para comparar la calidad): cuatro rumbos desde la aparición, las vistas que se pidan y el agua
//! desde arriba y desde abajo (mirando la superficie y el piso), con lo que tarda un cuadro.
//! Uso: vistas_foto CARPETA_SALIDA [ANCHO ALTO]   (JXM_WWW, JXM_LETRAS, JXM_MOTOR=vk|gl2, JXM_CALIDAD 0..5, JXM_ADDONS;
//! JXM_MAPA el mapa —RB_Construct si no—; JXM_VISTAS="x,y,z,giro,incl;…" más vistas; JXM_HORA la hora del día)
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
    let sal = a.get(1).cloned().unwrap_or("/tmp/claude-0/mapas_nat/fotos".into()); std::fs::create_dir_all(&sal).unwrap();
    let (w, h): (i32, i32) = (a.get(2).and_then(|x| x.parse().ok()).unwrap_or(1024), a.get(3).and_then(|x| x.parse().ok()).unwrap_or(576));
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxp_apk/activos/www".into());
    let let_ = std::env::var("JXM_LETRAS").unwrap_or("/tmp/claude-0/jxm/letras".into());
    let motor = std::env::var("JXM_MOTOR").unwrap_or_default(); let vk = motor == "vk"; let gl2 = motor == "gl2";
    let paq = Paquete::abrir(Path::new(&www));
    let datos = std::env::temp_dir().join("jxm_mapas_datos"); let _ = std::fs::create_dir_all(&datos); let _ = std::fs::remove_file(datos.join("mapa.txt")); let _ = std::fs::remove_file(datos.join("ajustes.txt"));
    let (lj, lp) = (std::fs::read_to_string(Path::new(&let_).join("letras.json")).ok(), std::fs::read(Path::new(&let_).join("letras.png")).ok());
    let mut j = Juego::nuevo(paq, lj, lp, Some(datos.clone()));
    j.gmod.carpeta_externa = std::env::var("JXM_ADDONS").ok().map(std::path::PathBuf::from);
    // (JXM_CALIDAD=0..5: la calidad —5, Definitivo—; sin la resolución dinámica: las fotos, nítidas)
    if let Some(q) = std::env::var("JXM_CALIDAD").ok().and_then(|v| v.parse().ok()) { j.aj.poner_calidad(q); j.aj.auto = false; j.aj.dinamica = false; }
    j.gmod.lector_rb = Some(jxmod::comun::gmod_juego::lector_carpetas(vec![Path::new(&www).join("rb"), "/tmp/claude-0/jxp_pub/rb".into()]));
    let _ = std::fs::remove_file(datos.join("gmod_apagados.txt"));
    j.dt_fijo = Some(1.0 / 60.0);
    let (mut m, placa) = if vk {
        let m = unsafe { jxmotor::vk::Motor::nuevo(None, w as u32, h as u32, Opciones::default()) }.expect("Vulkan");
        let p = m.placa.clone(); j.en_uso = Placa::Vulkan; (Motor3d::Vk(m), p)
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
            let t = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(t)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::RGBA8, w, h);
            let f = gl.create_framebuffer().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::RENDERBUFFER, Some(t));
            if gl2 { let p = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(p)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::DEPTH_COMPONENT16, w, h); gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::DEPTH_ATTACHMENT, glow::RENDERBUFFER, Some(p)); }
            f
        };
        std::mem::forget(e);
        if gl2 { j.en_uso = Placa::Gl2; (Motor3d::Gl2(unsafe { jxmotor::gl2::Motor::nuevo(gl, jxmotor::gl2::Opciones2::default()) }.expect("motor gl2"), Some(fb)), placa) }
        else { (Motor3d::Gl(unsafe { Motor::nuevo(gl, Opciones::default()) }.expect("motor"), Some(fb)), placa) }
    };
    let paso = |j: &mut Juego, m: &mut Motor3d, n: usize| { for _ in 0..n { let t = Instant::now(); unsafe { j.cuadro(m, w, h, &placa).expect("cuadro"); m.esperar(); } j.medir(t.elapsed().as_secs_f32() * 1000.0); } };
    let foto = |m: &mut Motor3d, nombre: &str| {
        let dado = match m {
            Motor3d::Vk(v) => unsafe { v.leer_imagen() }.expect("imagen"),
            _ => {
                let (gl, fb): (&glow::Context, Option<glow::Framebuffer>) = match m { Motor3d::Gl(g, f) => (&g.gl, *f), Motor3d::Gl2(g, f) => (&g.gl, *f), _ => unreachable!() };
                let mut px = vec![0u8; (w * h * 4) as usize];
                unsafe { gl.bind_framebuffer(glow::FRAMEBUFFER, fb); gl.read_pixels(0, 0, w, h, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelPackData::Slice(Some(&mut px))); }
                let fila = (w * 4) as usize; let mut dado = vec![0u8; px.len()];
                for y in 0..h as usize { dado[y * fila..(y + 1) * fila].copy_from_slice(&px[(h as usize - 1 - y) * fila..(h as usize - y) * fila]); }
                dado
            }
        };
        let ruta = format!("{sal}/{nombre}.png");
        let f = std::fs::File::create(&ruta).unwrap(); let mut enc = png::Encoder::new(std::io::BufWriter::new(f), w as u32, h as u32);
        enc.set_color(png::ColorType::Rgba); enc.set_depth(png::BitDepth::Eight); enc.write_header().unwrap().write_image_data(&dado).unwrap();
        println!("  → {ruta}");
    };
    // (cuántos cuadros por foto: la vista que se acostumbra necesita un rato)
    let np: usize = std::env::var("JXM_PASOS").ok().and_then(|x| x.parse().ok()).unwrap_or(40);
    paso(&mut j, &mut m, 20);
    let mapa = std::env::var("JXM_MAPA").unwrap_or("RB_Construct".into());
    if mapa.starts_with("WS_") { let mut n = 0; while !j.mapas.iter().any(|x| *x == mapa) && n < 300 { paso(&mut j, &mut m, 1); n += 1; } }
    let t = Instant::now(); assert!(j.poner_mapa(&mapa), "no existe el mapa {mapa}"); paso(&mut j, &mut m, 3);
    println!("{} cargado en {:.1} s", mapa, t.elapsed().as_secs_f32());
    if let Some(h) = std::env::var("JXM_HORA").ok().and_then(|x| x.parse().ok()) { j.aj.hora = h; }
    paso(&mut j, &mut m, 30);
    let p0 = j.jug.pos; let y0 = j.jug.yaw;
    if std::env::var_os("JXM_MATS").is_some() { if let Some(mp) = j.mapa.as_ref() { let c = &mp.esc.c;
        for mt in &c.mats { let n = c.texs.iter().find(|t| t.id == mt.t).map(|t| t.n.clone()).unwrap_or_default(); println!("  mat {} tex {:?} pbr {:?} corte {} terreno {}", mt.id, n, mt.pbr, mt.cut, mt.terr.is_some()); } } }
    println!("  aparición {:?} · giro {:.2} · sol {:?} · luz {:?}", p0, y0, j.mapa.as_ref().map(|mp| mp.luz.sol), j.mapa.as_ref().map(|mp| mp.luz.sol_c));
    for (k, dy) in [0.0f32, 1.57, 3.14, 4.71].iter().enumerate() { j.poner_ojos([p0[0], p0[1] + 0.7, p0[2]], y0 + dy, -0.05); paso(&mut j, &mut m, np); foto(&mut m, &format!("v_{k}")); }
    j.jug.noclip = true;
    // (JXM_INTERIOR=1: un punto adentro —poco cielo, desde las sondas de la luz global— cerca de la aparición, y fotos desde ahí)
    if std::env::var_os("JXM_INTERIOR").is_some() { if let Some(mp) = j.mapa.as_ref() {
        let sol = { let s = mp.luz.sol; let l = (s[0] * s[0] + s[1] * s[1] + s[2] * s[2]).sqrt().max(1e-6); [s[0] / l, s[1] / l, s[2] / l] };
        let mut mejor: Option<([f32; 3], f32)> = None;
        for gx in -15..=15 { for gz in -15..=15 { let p = [p0[0] + gx as f32 * 2.0, p0[1] + 0.9, p0[2] + gz as f32 * 2.0];
            let (c, r, vale, _) = jxmod::comun::luz_global::sonda(&mp.mundo, p, sol);
            if vale && c < 0.25 { let k = c - r * 0.5; if mejor.map_or(true, |m| k < m.1) { mejor = Some((p, k)); } } } }
        if let Some((p, _)) = mejor {
            println!("  interior en {:?}", p);
            let mut n = 0; while !j.gi_listo() && n < 400 { paso(&mut j, &mut m, 1); n += 1; }
            println!("  luz global lista: {} ({} cuadros)", j.gi_listo(), n);
            for (k, dy) in [0.0f32, 1.57, 3.14, 4.71].iter().enumerate() { j.poner_ojos(p, y0 + dy, -0.1); paso(&mut j, &mut m, np); foto(&mut m, &format!("i_{k}")); }
        } else { println!("  (no se encontró un interior)"); }
    } }
    if let Ok(t) = std::env::var("JXM_VISTAS") {
        for (k, v) in t.split(';').enumerate() { let v: Vec<f32> = v.split(',').filter_map(|x| x.trim().parse().ok()).collect(); if v.len() < 5 { continue; }
            j.poner_ojos([v[0], v[1], v[2]], v[3].to_radians(), v[4].to_radians()); paso(&mut j, &mut m, np); foto(&mut m, &format!("x_{k}")); }
    }
    // (el agua: desde arriba mirándola y desde abajo —la superficie vista de adentro y el piso—)
    if let Some(a) = j.mapa.as_ref().and_then(|m| m.esc.c.agua.clone()) { if let Some(pr) = a.prof.as_ref() {
        // (el punto más hondo del agua: rayos para abajo en una grilla de 16×16)
        let mut c = [pr.x0 + pr.w * 0.5, a.y, pr.z0 + pr.h * 0.5]; let mut hondo = 0.0f64;
        if let Some(mp) = j.mapa.as_ref() { for gx in 0..16 { for gz in 0..16 {
            let (x, z) = (pr.x0 + pr.w * (gx as f32 + 0.5) / 16.0, pr.z0 + pr.h * (gz as f32 + 0.5) / 16.0);
            if let Some(hit) = jxjuego::persona::rayo_mundo(&mp.mundo, [x as f64, a.y as f64 - 0.05, z as f64], [0.0, -1.0, 0.0], 30.0) { if hit.0 > hondo && hit.0 < 29.0 { hondo = hit.0; c = [x, a.y, z]; } }
        } } }
        println!("  lo más hondo: {:.1} m en ({:.1}, {:.1})", hondo, c[0], c[2]);
        println!("  agua: y {:.2} · {:.0}×{:.0} m desde ({:.1}, {:.1}) · normales {:?}", a.y, pr.w, pr.h, pr.x0, pr.z0, a.normal.as_ref().map(|n| (n.w, n.h, n.n)));
        j.poner_ojos([c[0], c[1] + 2.5, c[2]], y0, -0.45); paso(&mut j, &mut m, np); foto(&mut m, "agua_arriba");
        // (ondas: tres que caen adelante, una tras otra)
        let (sy, cy) = y0.sin_cos(); let ad = [c[0] + sy * 4.0, c[2] + cy * 4.0];
        for k in 0..3 { j.onda(ad[0] + k as f32 * 0.8, ad[1], 1.0); paso(&mut j, &mut m, 6); }
        paso(&mut j, &mut m, 4); foto(&mut m, "agua_ondas");
        j.poner_ojos([c[0], c[1] - 1.5, c[2]], y0, 0.0); paso(&mut j, &mut m, np); foto(&mut m, "agua_adentro");
        j.poner_ojos([c[0], c[1] - 1.5, c[2]], y0, 0.9); paso(&mut j, &mut m, np); foto(&mut m, "agua_mirando_arriba");
        j.poner_ojos([c[0], c[1] - 0.8, c[2]], y0, -0.6); paso(&mut j, &mut m, np); foto(&mut m, "agua_piso");
    } } else { println!("  (sin agua)"); }
    j.jug.noclip = false;
    let mut ms = vec![]; j.poner_ojos([p0[0], p0[1] + 0.7, p0[2]], y0, -0.05);
    for _ in 0..40 { let t = Instant::now(); paso(&mut j, &mut m, 1); ms.push(t.elapsed().as_secs_f32() * 1000.0); }
    ms.sort_by(|a, b| a.partial_cmp(b).unwrap()); println!("cuadro: mediana {:.1} ms · {}", ms[20], m.resumen());
}
