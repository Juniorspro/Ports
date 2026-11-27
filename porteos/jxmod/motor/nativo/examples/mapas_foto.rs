//! La prueba de los mapas del Workshop en el juego nativo (mapas_juego.rs): los addons de una carpeta (JXM_ADDONS) con sus
//! .bsp en la lista de mapas, el mapa armado y fotos desde la aparición; las puertas y botones (se va adelante de la
//! primera y se la abre con «Usar»); la hora del día (Ajustes → Día). Necesita integrar_mapas.py aplicado.
//! Uso: mapas_foto CARPETA_SALIDA [ANCHO ALTO]   (JXM_WWW, JXM_LETRAS, JXM_MOTOR=vk|gl2 como foto.rs; JXM_MAPA: cuál WS_)
use glow::HasContext;
use jxjuego::paquete::Paquete;
use jxmod::comun::{pos_boton, Boton, Juego, Placa};
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
    let (wf, hf) = (w as f32, h as f32);
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
    // (el mapa de siempre, los addons y sus mapas en la lista)
    paso(&mut j, &mut m, 30); foto(&mut m, "rb_inicio"); println!("{}: sol {:?} · luz del sol {:?}", j.mapas[0], j.mapa.as_ref().map(|mp| mp.luz.sol), j.mapa.as_ref().map(|mp| mp.luz.sol_c));
    let mut n = 0; while (j.gmod.addons.is_empty() || !j.mapas.iter().any(|x| x.starts_with("WS_"))) && n < 300 { paso(&mut j, &mut m, 1); n += 1; }
    let ws: Vec<String> = j.mapas.iter().filter(|x| x.starts_with("WS_")).cloned().collect();
    println!("mapas del Workshop en la lista: {:?} (de {} mapas)", ws, j.mapas.len());
    let elegido = std::env::var("JXM_MAPA").ok().filter(|x| ws.contains(x)).or_else(|| ws.first().cloned()).expect("ningún mapa del Workshop");
    // (como Ajustes → Mapa)
    // (JXM_STEAM: con red —curl—, lo de HL2 y CS:S que pide el mapa se baja de Steam antes de armarlo: base_juego.rs)
    if std::env::var_os("JXM_STEAM").is_some() {
        j.gmod.http_bin = Some(std::sync::Arc::new(|u: &str| {
            let o = std::process::Command::new("curl").args(["-sL", "--max-time", "120", "-w", "\n%{http_code}", u]).output().map_err(|e| e.to_string())?;
            let mut b = o.stdout; let i = b.iter().rposition(|c| *c == b'\n').unwrap_or(0); let cod: u16 = String::from_utf8_lossy(&b[i + 1..]).trim().parse().unwrap_or(0); b.truncate(i); Ok((cod, b))
        }));
    }
    let t = Instant::now(); j.poner_mapa(&elegido); paso(&mut j, &mut m, 3);
    while j.mapa.as_ref().map(|mp| mp.nombre != elegido).unwrap_or(true) && j.error.is_none() && t.elapsed().as_secs() < 540 { paso(&mut j, &mut m, 1); std::thread::sleep(std::time::Duration::from_millis(40)); }
    if !j.gb.info.is_empty() { println!("Steam: {}", j.gb.info); }
    println!("{} cargado en {:.1} s: {}", elegido, t.elapsed().as_secs_f32(), j.mj.info);
    if let Some(e) = &j.error { println!("ERROR: {e}"); }
    let Some(mp) = j.mapa.as_ref() else { panic!("sin mapa") };
    println!("  apariciones {:?} · lejos {:.0} · agua {:?} · luz {:?}", mp.spawns.iter().take(3).collect::<Vec<_>>(), mp.lejos, mp.agua_y, mp.luz.sol);
    paso(&mut j, &mut m, 30);
    let p0 = j.jug.pos; let y0 = j.jug.yaw;
    println!("  el jugador quedó en {:?} (en el piso: {})", p0, j.jug.suelo);
    for (k, dy) in [0.0f32, 1.57, 3.14, 4.71].iter().enumerate() { j.poner_ojos([p0[0], p0[1] + 0.7, p0[2]], y0 + dy, -0.05); paso(&mut j, &mut m, 2); foto(&mut m, &format!("ws_{k}")); }
    if std::env::var_os("JXM_ACUSTICA").is_some() { // (los ambientes del sonido espacial en una grilla del mapa, a la altura de los oídos)
        let mp = j.mapa.as_ref().unwrap(); let dirs = jxmod::acustica::direcciones(); let mut cuenta: std::collections::BTreeMap<&str, (u32, [f32; 3])> = Default::default();
        for gx in -20..=20 { for gz in -20..=20 { for alto in [40.0f32, 8.0, 3.0] {
            let o = [p0[0] + gx as f32 * 6.0, p0[1] + alto, p0[2] + gz as f32 * 6.0];
            let Some(g) = mp.mundo.rayo(o, [0.0, -1.0, 0.0], 80.0) else { continue }; let ojo = [o[0], o[1] - g.t + 1.6, o[2]];
            let mut d = [jxmod::acustica::LEJOS; 14]; for k in 0..14 { d[k] = mp.mundo.rayo(ojo, dirs[k], jxmod::acustica::LEJOS).map(|x| x.t).unwrap_or(jxmod::acustica::LEJOS); }
            let (i, _) = jxmod::acustica::ambiente(&jxmod::acustica::Medida { d, agua: false, auto: false });
            let e = cuenta.entry(jxmod::acustica::AMBIENTES[i].0).or_insert((0, ojo)); e.0 += 1; } } }
        println!("ambientes: {:?}", cuenta.iter().map(|(k, v)| format!("{k} {} (p.ej. {:.0},{:.0},{:.0})", v.0, v.1[0], v.1[1], v.1[2])).collect::<Vec<_>>()); return; }
    if std::env::var_os("JXM_RAPIDO").is_some() { j.jug.noclip = true; for (k, (dy, alto, pit)) in [(1.57f32, 6.0f32, -0.6f32), (1.57, 25.0, -1.2), (1.2, 2.0, -0.25)].iter().enumerate() { j.poner_ojos([p0[0], p0[1] + alto, p0[2]], y0 + dy, *pit); paso(&mut j, &mut m, 2); foto(&mut m, &format!("ws_mira{k}")); } for (k, dy) in [0.0f32, 1.57, 3.14, 4.71].iter().enumerate() { j.poner_ojos([p0[0], p0[1] + 20.7, p0[2]], y0 + dy, 0.0); paso(&mut j, &mut m, 2); foto(&mut m, &format!("ws_horizonte{k}")); } return; }
    // (el agua, si hay: desde arriba de su medio, mirándola en cuatro rumbos —el agua de verdad del material del mapa—)
    if let Some(a) = j.mapa.as_ref().and_then(|m| m.esc.c.agua.clone()) { if let Some(pr) = a.prof.as_ref() {
        j.jug.noclip = true; let c = [pr.x0 + pr.w * 0.5, a.y + 3.0, pr.z0 + pr.h * 0.5];
        println!("  agua: y {:.2} · {:.0}×{:.0} m · normales {:?}", a.y, pr.w, pr.h, a.normal.as_ref().map(|n| (n.w, n.h, n.n)));
        for (k, dy) in [0.0f32, 1.57, 3.14, 4.71].iter().enumerate() { j.poner_ojos(c, y0 + dy, -0.3); paso(&mut j, &mut m, 3); foto(&mut m, &format!("ws_agua{k}")); }
        j.jug.noclip = false;
    } }
    // (desde arriba, mirando para abajo)
    j.jug.noclip = true; j.poner_ojos([p0[0], p0[1] + 40.0, p0[2]], y0, -0.7); paso(&mut j, &mut m, 2); foto(&mut m, "ws_arriba");
    // (el horizonte desde 20 m de alto: el cielo 3D)
    for (k, dy) in [0.0f32, 1.57, 3.14, 4.71].iter().enumerate() { j.poner_ojos([p0[0], p0[1] + 20.7, p0[2]], y0 + dy, 0.0); paso(&mut j, &mut m, 2); foto(&mut m, &format!("ws_horizonte{k}")); }
    j.jug.noclip = false;
    // las puertas: adelante de la primera que se usa, mirándola, y «Usar»
    if let Some(i) = j.mj.pta.as_ref().and_then(|p| p.l.iter().position(|d| d.def.usa && d.con_cuerpo)) {
        let d = &j.mj.pta.as_ref().unwrap().l[i]; let c = d.pos; let (nom, cl) = (d.def.nombre.clone(), d.def.cl.clone());
        println!("  puerta {i} ({cl} «{nom}») en {:?}", c);
        // (buscar de qué lado se la ve: el rayo de los ojos tiene que dar en ella)
        let mut ok = false;
        for k in 0..8 {
            let ang = k as f32 * std::f32::consts::FRAC_PI_4; let o = [c[0] + ang.sin() * 1.6, c[1] + 0.2, c[2] + ang.cos() * 1.6];
            let yaw = (c[0] - o[0]).atan2(c[2] - o[2]);
            j.jug.noclip = true; j.poner_ojos(o, yaw, -0.1); paso(&mut j, &mut m, 2);
            if j.mj.usar.is_some() { ok = true; println!("  mirándola desde {:?}: «{:?}»", o, j.mj.usar_txt); break; }
        }
        if ok {
            foto(&mut m, "ws_puerta_cerrada");
            let (bx, by) = pos_boton(wf, hf, Boton::Usar); j.dedo_abajo(7, bx, by, wf, hf); paso(&mut j, &mut m, 1); j.dedo_arriba_en(7, wf, hf);
            let k0 = j.mj.pta.as_ref().unwrap().l[i].k; paso(&mut j, &mut m, 90);
            let d = &j.mj.pta.as_ref().unwrap().l[i]; println!("  «Usar»: meta {} · abierta {:.2} → {:.2} · ahora en {:?} {:?}", d.meta, k0, d.k, d.pos, d.q);
            foto(&mut m, "ws_puerta_abierta");
        } else { println!("  no se la pudo mirar"); }
        j.jug.noclip = false;
    } else { println!("  (el mapa no tiene puertas que se usen)"); }
    // la hora del día: atardecer y noche
    j.poner_ojos([p0[0], p0[1] + 0.7, p0[2]], y0, 0.05);
    for (k, hora) in [(2usize, "atardecer"), (3, "noche")] { j.aj.hora = jxmod::ajustes::HORAS[k].1; paso(&mut j, &mut m, 3); foto(&mut m, &format!("ws_{hora}")); println!("  {hora}: noche {:.2} · sol {:?}", j.mj.noche, j.mapa.as_ref().map(|mp| mp.luz.sol_c)); }
    j.aj.hora = 12.0; paso(&mut j, &mut m, 2);
    // lo que tarda un cuadro en el mapa
    let mut ms = vec![]; for _ in 0..60 { let t = Instant::now(); paso(&mut j, &mut m, 1); ms.push(t.elapsed().as_secs_f32() * 1000.0); }
    // (lo de HL2 que nombran los addons montados, bajado en el fondo)
    if std::env::var_os("JXM_STEAM").is_some() { let t = Instant::now(); while t.elapsed().as_secs() < 120 { paso(&mut j, &mut m, 1); std::thread::sleep(std::time::Duration::from_millis(30)); if t.elapsed().as_secs() > 20 && j.gb.bajados_addons > 0 { break; } } println!("Steam para los addons: {} archivos bajados · addons {:?}", j.gb.bajados_addons, j.gmod.addons.iter().map(|a| (a.nombre.clone(), a.prendido, a.idx)).collect::<Vec<_>>()); }
    ms.sort_by(|a, b| a.partial_cmp(b).unwrap()); println!("cuadro: mediana {:.1} ms · {}", ms[30], m.resumen());
}
