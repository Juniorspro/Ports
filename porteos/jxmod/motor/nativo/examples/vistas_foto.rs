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
    // (JXM_RES: la resolución de la escena en %, aparte de la calidad —para comparar cómo se ve agrandada—)
    if let Some(r) = std::env::var("JXM_RES").ok().and_then(|v| v.parse().ok()) { j.aj.res = r; }
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
            let so = jxmod::comun::luz_global::sonda(&mp.mundo, p, sol); let (c, r, vale) = (so.s[2], so.b.iter().sum::<f32>() / 6.0, so.vale);
            if vale && c < 0.25 { let k = c - r * 0.5; if mejor.map_or(true, |m| k < m.1) { mejor = Some((p, k)); } } } }
        if let Some((p, _)) = mejor {
            println!("  interior en {:?}", p);
            let mut n = 0; while !j.gi_listo() && n < 400 { paso(&mut j, &mut m, 1); n += 1; }
            println!("  luz global lista: {} ({} cuadros)", j.gi_listo(), n);
            for (k, dy) in [0.0f32, 1.57, 3.14, 4.71].iter().enumerate() { j.poner_ojos(p, y0 + dy, -0.1); paso(&mut j, &mut m, np); foto(&mut m, &format!("i_{k}")); }
            // (JXM_REFL_RUMBOS: el reflejo del piso, mirando para 16 lados un poco hacia abajo, ahí y en la aparición)
            if std::env::var_os("JXM_REFL_RUMBOS").is_some() { for (nom, q) in [("adentro", p), ("aparición", [p0[0], p0[1] + 0.7, p0[2]])] {
                let mut si = 0; let mut no = vec![];
                for k in 0..16 { let yaw = k as f32 * std::f32::consts::TAU / 16.0; j.poner_ojos(q, yaw, -0.35); paso(&mut j, &mut m, 3); if m.piso_refleja().is_some() { si += 1; } else { no.push(k); } }
                println!("  reflejo del piso {nom}: {si}/16 rumbos · sin reflejo en {:?}", no);
            } }
        } else { println!("  (no se encontró un interior)"); }
    } }
    // (JXM_TCL=1: para cada calidad, lo que tarda un cuadro —mediana— y cuántos dibujos tiene, en vistas fijas: adentro y la
    // aparición para cuatro lados; con eso se estima un TCL 20 SE —tcl20se.py—)
    if std::env::var_os("JXM_TCL").is_some() {
        let qs: Vec<usize> = std::env::var("JXM_TCL_Q").ok().map(|v| v.split(',').filter_map(|x| x.parse().ok()).collect()).unwrap_or((0..=5).collect());
        let mut vistas: Vec<([f32; 3], f32, f32)> = (0..4).map(|k| ([p0[0], p0[1] + 0.7, p0[2]], y0 + k as f32 * 1.5708, -0.05)).collect();
        vistas.push(([-10.6472, -1.8074449, 27.8816], y0, -0.1)); vistas.push(([-10.6472, -1.8074449, 27.8816], y0 + 4.71, -0.1));
        for q in qs {
            j.aj.poner_calidad(q); j.aj.auto = false; j.aj.dinamica = false;
            let mut ms = vec![]; let mut dib = vec![];
            let limpiar = |m: &mut Motor3d| match m { Motor3d::Gl(g, _) => { if let Some(f) = g.fases.as_mut() { f.1.clear(); } } Motor3d::Gl2(g, _) => { if let Some(f) = g.fases.as_mut() { f.1.clear(); } } _ => {} };
            let mut n_med = 0;
            for v in &vistas { j.poner_ojos(v.0, v.1, v.2); paso(&mut j, &mut m, 12); limpiar(&mut m);
                for _ in 0..8 { let t = Instant::now(); paso(&mut j, &mut m, 1); ms.push(t.elapsed().as_secs_f32() * 1000.0); dib.push(m.dibujos()); }
                n_med += 8;
                let f = match &m { Motor3d::Gl(g, _) => g.fases.as_ref().map(|f| f.1.clone()), Motor3d::Gl2(g, _) => g.fases.as_ref().map(|f| f.1.clone()), _ => None };
                if let Some(f) = f { if std::env::var_os("JXM_FASES").is_some() { println!("  fases: {}", f.iter().map(|(k, x)| format!("{k} {:.1}", x / 8.0)).collect::<Vec<_>>().join(" · ")); } }
            }
            let _ = n_med;
            ms.sort_by(|a, b| a.partial_cmp(b).unwrap()); let dm = dib.iter().sum::<u32>() as f32 / dib.len() as f32;
            let ll = match &m { Motor3d::Gl2(g, _) => format!(" llamadas={}/{}", g.llamadas[0], g.llamadas[1]), Motor3d::Gl(g, _) => { let l = g.llamadas.get(); format!(" llamadas={}/{}", l[0], l[1]) } _ => String::new() };
            println!("TCL q={q} {} res={} ms_mediana={:.2} ms_p90={:.2} dibujos={:.0}{ll}", jxmod::ajustes::CALIDADES[q.min(5)], j.aj.res, ms[ms.len() / 2], ms[ms.len() * 9 / 10], dm);
        }
        return;
    }
    // (JXM_TURBO_PRUEBA=1: el cuadro intermedio contra el de verdad: para varias vistas y movimientos de 1/120 s, la foto de
    // verdad en la cámara nueva, la vieja —lo que se vería sin intermedio— y la armada; y cuánto tarda armarla)
    if std::env::var_os("JXM_TURBO_PRUEBA").is_some() {
        // (el turbo prendido, pero acá cada cuadro del juego es de verdad —turbo_n alto: no toca intermedio—; el intermedio se arma a mano)
        j.aj.turbo = true;
        let paso = |j: &mut Juego, m: &mut Motor3d, n: usize| { for _ in 0..n { j.turbo_n = 250; paso(j, m, 1); } };
        let mut vistas: Vec<([f32; 3], f32, f32)> = (0..4).map(|k| ([p0[0], p0[1] + 0.7, p0[2]], y0 + k as f32 * 1.5708, -0.05)).collect();
        vistas.push(([-10.6472, -1.8074449, 27.8816], y0, -0.1)); vistas.push(([-10.6472, -1.8074449, 27.8816], y0 + 4.71, -0.1));
        let movs: [(f32, f32, f32, &str); 4] = [(1.5, 0.0, 0.0, "giro1.5"), (3.0, 0.0, 0.0, "giro3"), (1.5, 0.05, 0.0, "giro1.5_avanza5cm"), (0.0, 0.0, 0.04, "costado4cm")];
        let mut t_int = vec![]; let mut t_real = vec![];
        for (k, v) in vistas.iter().enumerate() { for (dg, av, co, nom) in movs.iter() {
            let yaw1 = v.1 + dg.to_radians(); let (sy, cy) = (yaw1.sin(), yaw1.cos());
            let p1 = [v.0[0] + sy * av + cy * co, v.0[1], v.0[2] + cy * av - sy * co];
            j.poner_ojos(p1, yaw1, v.2); paso(&mut j, &mut m, 10);
            let t = Instant::now(); paso(&mut j, &mut m, 1); t_real.push(t.elapsed().as_secs_f32() * 1000.0);
            foto(&mut m, &format!("t{k}_{nom}_real")); let vp1 = m.vp_actual().unwrap();
            j.poner_ojos(v.0, v.1, v.2); paso(&mut j, &mut m, 10); foto(&mut m, &format!("t{k}_{nom}_vieja"));
            let t = Instant::now(); let ok = unsafe { m.intermedio(w, h, &vp1, &[]) }; unsafe { m.esperar(); } t_int.push(t.elapsed().as_secs_f32() * 1000.0);
            if !ok { println!("  (sin intermedio)"); }
            foto(&mut m, &format!("t{k}_{nom}_inter"));
        } }
        t_int.sort_by(|a, b| a.partial_cmp(b).unwrap()); t_real.sort_by(|a, b| a.partial_cmp(b).unwrap());
        println!("TURBO: cuadro de verdad mediana {:.1} ms · intermedio mediana {:.1} ms", t_real[t_real.len() / 2], t_int[t_int.len() / 2]);
        return;
    }
    if std::env::var_os("JXM_GI_FUGAS").is_some() { if let Some(mp) = j.mapa.as_ref() { gi_fugas(&mp.mundo, mp.luz.sol, p0); return; } }
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

/// el esquema de antes (para comparar): 14 rayos, un solo valor de los costados, sin rellenar
mod viejo {
    pub fn sonda(m: &jxjuego::mundo::Mundo, p: [f32; 3], sol: [f32; 3]) -> (f32, f32, bool, f32) {
        let rayo = |o: [f32; 3], d: [f32; 3], max: f64| jxjuego::persona::rayo_mundo(m, [o[0] as f64, o[1] as f64, o[2] as f64], [d[0] as f64, d[1] as f64, d[2] as f64], max);
        let (mut cielo, mut peso_cielo, mut rebote, mut pegados) = (0.0f32, 0.0f32, 0.0f32, 0);
        let (mut lado, mut peso_lado) = (0.0f32, 0.0f32);
        let d3 = 1.0 / 3f32.sqrt();
        let dirs = [[1.0, 0.0, 0.0], [-1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, -1.0, 0.0], [0.0, 0.0, 1.0], [0.0, 0.0, -1.0], [d3, d3, d3], [-d3, d3, d3], [d3, d3, -d3], [-d3, d3, -d3], [d3, -d3, d3], [-d3, -d3, d3], [d3, -d3, -d3], [-d3, -d3, -d3]];
        for d in dirs.iter() {
            let h = rayo(p, *d, 30.0);
            if d[1] > 0.05 { peso_cielo += d[1]; if h.is_none() { cielo += d[1]; } }
            if d[1].abs() < 0.05 || (d[1] > 0.05 && d[1] < 0.7) { let k = if d[1].abs() < 0.05 { 1.0 } else { 0.7 }; peso_lado += k; if h.is_none() { lado += k; } }
            if let Some((t, nh)) = h {
                if t < 0.3 { pegados += 1; continue; }
                let nh = [nh[0] as f32, nh[1] as f32, nh[2] as f32]; let cs = nh[0] * sol[0] + nh[1] * sol[1] + nh[2] * sol[2];
                if cs > 0.0 && sol[1] > 0.0 { let q = [p[0] + d[0] * t as f32 + nh[0] * 0.05, p[1] + d[1] * t as f32 + nh[1] * 0.05, p[2] + d[2] * t as f32 + nh[2] * 0.05]; if rayo(q, sol, 60.0).is_none() { rebote += cs * 0.5; } }
            }
        }
        (if peso_cielo > 0.0 { cielo / peso_cielo } else { 1.0 }, (rebote / 14.0 * 2.2).min(1.0), pegados * 3 < 14, if peso_lado > 0.0 { lado / peso_lado } else { 1.0 })
    }
    /// la grilla: por sonda (cielo·v, rebote·v, v, lado·v)
    pub fn calcular(m: &jxjuego::mundo::Mundo, origen: [f32; 3], sol: [f32; 3]) -> Vec<[f32; 4]> {
        let [nx, ny, nz] = jxmod::comun::luz_global::N; let paso = jxmod::comun::luz_global::PASO; let mut v = vec![[0.0; 4]; nx * ny * nz];
        for z in 0..nz { for y in 0..ny { for x in 0..nx { let p = [origen[0] + (x as f32 + 0.5) * paso, origen[1] + (y as f32 + 0.5) * paso, origen[2] + (z as f32 + 0.5) * paso];
            let (c, r, vale, l) = sonda(m, p, sol); let k = if vale { 1.0 } else { 0.0 }; v[(z * ny + y) * nx + x] = [c * k, r * k, k, l * k]; } } }
        v
    }
    /// lo que leía la placa: el cielo que usaba la cara con normal n (mezcla de arriba y de los costados)
    pub fn muestra(v: &[[f32; 4]], origen: [f32; 3], p: [f32; 3], n: [f32; 3]) -> f32 {
        let nn = jxmod::comun::luz_global::N; let paso = jxmod::comun::luz_global::PASO;
        let mut g = [0.0f32; 3]; for k in 0..3 { g[k] = (p[k] - origen[k]) / paso - 0.5; if g[k] < -0.5 || g[k] > nn[k] as f32 - 0.5 { return 1.0; } g[k] = g[k].clamp(0.0, nn[k] as f32 - 1.0); }
        let a = [g[0].floor() as usize, g[1].floor() as usize, g[2].floor() as usize]; let f = [g[0] - a[0] as f32, g[1] - a[1] as f32, g[2] - a[2] as f32];
        let mut s = [0.0f32; 4];
        for dz in 0..2 { for dy in 0..2 { for dx in 0..2 { let (x, y, z) = ((a[0] + dx).min(nn[0] - 1), (a[1] + dy).min(nn[1] - 1), (a[2] + dz).min(nn[2] - 1));
            let w = (if dx == 1 { f[0] } else { 1.0 - f[0] }) * (if dy == 1 { f[1] } else { 1.0 - f[1] }) * (if dz == 1 { f[2] } else { 1.0 - f[2] });
            let q = v[(z * nn[1] + y) * nn[0] + x]; for c in 0..4 { s[c] += w * q[c]; } } } }
        if s[2] < 0.03 { return 1.0; }
        let (c, l) = (s[0] / s[2], s[3] / s[2]); c + (l - c) * (1.0 - n[1].abs()) * 0.8
    }
}

/// cuánta luz de afuera se cuela adentro: en las paredes y pisos de los lugares techados cerca de la aparición, lo que lee la
/// placa (la grilla mezclada) contra una sonda puesta justo ahí (lo que de verdad ve esa cara), con el esquema de antes y el nuevo
fn gi_fugas(m: &jxjuego::mundo::Mundo, sol: [f32; 3], p0: [f32; 3]) {
    use jxmod::comun::luz_global as lg;
    let sol = { let l = (sol[0] * sol[0] + sol[1] * sol[1] + sol[2] * sol[2]).sqrt().max(1e-6); [sol[0] / l, sol[1] / l, sol[2] / l] };
    let rayo = |o: [f32; 3], d: [f32; 3], max: f64| jxjuego::persona::rayo_mundo(m, [o[0] as f64, o[1] as f64, o[2] as f64], [d[0] as f64, d[1] as f64, d[2] as f64], max)
        .map(|(t, n)| (t as f32, [n[0] as f32, n[1] as f32, n[2] as f32]));
    // (los centros: la aparición o, con JXM_GI_MAPA, todo el mapa cada 48 m en tres alturas)
    let mut centros = vec![p0];
    if std::env::var_os("JXM_GI_MAPA").is_some() { centros.clear();
        let (lo, hi) = (m.lo, m.hi); let mut x = lo[0] + 24.0; while x < hi[0] { let mut z = lo[2] + 24.0; while z < hi[2] { for dy in [-8.0f32, 0.0, 8.0] { centros.push([x, p0[1] + dy, z]); } z += 48.0; } x += 48.0; } }
    // (por tipo: puntos, error antes/ahora, fuga antes/ahora, malas antes/ahora)
    let mut tot = [[0.0f32; 7]; 3]; let (mut t_n, mut t_v) = (0.0f32, 0.0f32);
    for c in centros.iter() {
        let origen = lg::origen_para(*c);
        let (mut caras, mut pisos, mut altas): (Vec<([f32; 3], [f32; 3])>, Vec<([f32; 3], [f32; 3])>, Vec<([f32; 3], [f32; 3])>) = (vec![], vec![], vec![]);
        for gx in -16..=16 { for gz in -16..=16 { for dy in [1.0f32, 5.0, 9.0] {
            let a = [c[0] + gx as f32 * 1.5, c[1] + dy - 4.0, c[2] + gz as f32 * 1.5];
            let Some((tu, _)) = rayo(a, [0.0, 1.0, 0.0], 8.0) else { continue };
            let Some((tp, np)) = rayo(a, [0.0, -1.0, 0.0], 3.0) else { continue }; if np[1] < 0.9 { continue; }
            if !lg::sonda(m, a, sol).vale { continue; }
            pisos.push(([a[0], a[1] - tp + 0.02, a[2]], [0.0, 1.0, 0.0]));
            for d in [[1.0f32, 0.0, 0.0], [-1.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, 0.0, -1.0]] {
                if let Some((t, n)) = rayo(a, d, 6.0) { if t > 0.4 && n[1].abs() < 0.2 { caras.push(([a[0] + d[0] * (t - 0.02), a[1], a[2] + d[2] * (t - 0.02)], n)); } }
                // (las paredes justo debajo del techo)
                let b = [a[0], a[1] + tu - 0.3, a[2]];
                if tu > 0.6 { if let Some((t, n)) = rayo(b, d, 6.0) { if t > 0.4 && n[1].abs() < 0.2 { altas.push(([b[0] + d[0] * (t - 0.02), b[1], b[2] + d[2] * (t - 0.02)], n)); } } }
            }
        } } }
        if caras.is_empty() && pisos.is_empty() && altas.is_empty() { continue; }
        let t = Instant::now(); let g = lg::calcular(m, origen, sol); t_n += t.elapsed().as_secs_f32();
        let t = Instant::now(); let gv = viejo::calcular(m, origen, sol); t_v += t.elapsed().as_secs_f32();
        if let Ok(v) = std::env::var("JXM_GI_PUNTO") { let v: Vec<f32> = v.split(',').filter_map(|x| x.parse().ok()).collect();
            let (p, nn) = ([v[0], v[1], v[2]], [v[3], v[4], v[5]]);
            if !(0..3).all(|k| p[k] > origen[k] + 1.0 && p[k] < origen[k] + lg::N[k] as f32 * lg::PASO - 1.0) { continue; }
            let q = [p[0] + nn[0] * 0.6, p[1] + nn[1] * 0.6, p[2] + nn[2] * 0.6];
            println!("punto {:?} → placa {:?}", p, lg::muestra(&g, q, nn));
            let gg: Vec<f32> = (0..3).map(|k| ((q[k] - origen[k]) / lg::PASO - 0.5).floor()).collect();
            for dz in 0..2 { for dy in 0..2 { for dx in 0..2 { let cc = [gg[0] + dx as f32, gg[1] + dy as f32, gg[2] + dz as f32];
                let pp = [origen[0] + (cc[0] + 0.5) * lg::PASO, origen[1] + (cc[1] + 0.5) * lg::PASO, origen[2] + (cc[2] + 0.5) * lg::PASO];
                let so = lg::sonda(m, pp, sol); let en = lg::muestra(&g, pp, nn);
                println!("  sonda {:?} vale {} pegada {:?} bajo {:.2} s {:?} → en la grilla {:.2}", pp, so.vale, so.pegada, so.bajo, so.s.map(|x| (x * 100.0).round() / 100.0), en.0);
            } } }
            return;
        }
        let dentro = |p: [f32; 3]| (0..3).all(|k| p[k] > origen[k] + 1.0 && p[k] < origen[k] + lg::N[k] as f32 * lg::PASO - 1.0);
        for (ti, lista) in [&caras, &pisos, &altas].iter().enumerate() {
            for &(p, nn) in lista.iter() { if !dentro(p) { continue; }
                let q = [p[0] + nn[0] * 0.3, p[1] + nn[1] * 0.3, p[2] + nn[2] * 0.3]; let so = lg::sonda_con(m, q, sol, 400); if !so.vale { continue; }
                let w = [nn[0] * nn[0], nn[1] * nn[1], nn[2] * nn[2]]; let sel = |k: usize, a: usize, b: usize| w[k] * if nn[k] > 0.0 { so.s[a] } else { so.s[b] };
                let real = sel(0, 0, 1) + sel(1, 2, 3) + sel(2, 4, 5);
                let s = [p[0] + nn[0] * 0.6, p[1] + nn[1] * 0.6, p[2] + nn[2] * 0.6];
                let nuevo = lg::muestra(&g, s, nn).0; let vie = viejo::muestra(&gv, origen, s, nn);
                let t = &mut tot[ti]; t[0] += 1.0; t[1] += (vie - real).abs(); t[2] += (nuevo - real).abs(); t[3] += (vie - real).max(0.0); t[4] += (nuevo - real).max(0.0);
                if vie - real > 0.25 { t[5] += 1.0; } if nuevo - real > 0.25 { t[6] += 1.0; if std::env::var_os("JXM_GI_MALAS").is_some() { println!("  mala: {:?} n {:?} real {:.2} placa {:.2} antes {:.2}", p, nn, real, nuevo, vie); } }
            }
        }
    }
    println!("grillas: {} · nueva {:.2} s · vieja {:.2} s (cada una)", centros.len(), t_n / centros.len() as f32, t_v / centros.len() as f32);
    for (ti, nombre) in ["paredes", "pisos", "paredes bajo el techo"].iter().enumerate() { let t = tot[ti]; let n = t[0].max(1.0);
        println!("{nombre}: {} puntos adentro · error medio: antes {:.3} → ahora {:.3} · fuga media: antes {:.3} → ahora {:.3} · con fuga > 0,25: antes {:.1} % → ahora {:.1} %",
            t[0], t[1] / n, t[2] / n, t[3] / n, t[4] / n, t[5] * 100.0 / n, t[6] * 100.0 / n); }
}
