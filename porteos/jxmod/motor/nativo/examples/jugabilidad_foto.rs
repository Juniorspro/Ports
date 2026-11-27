//! La prueba de jugabilidad.rs (con integrar_jugabilidad.py aplicado a comun.rs): la destrucción de un Sedan contra la
//! pared de RB_Construct a 100 km/h (como pruebas/destruccion.mjs), una explosión al costado de otro auto, una nuclear
//! (Little Boy) vista de lejos, la catapulta, la bomba de Rick Prime, la patada, la linterna, la cámara libre, volar, el
//! muñeco, el SCP, el Cíclope y Pepe (forzado con JXM_PEPE). Saca fotos de cada cosa y escribe los números.
//! Uso: jugabilidad_foto CARPETA [ANCHO ALTO]  (JXM_WWW, JXM_LETRAS y JXM_MOTOR como foto.rs; JXM_SOLO=destruccion,nuclear,hud,editor,tutorial,grieta,…)
use glow::HasContext;
use jxjuego::paquete::Paquete;
use jxmod::comun::{Juego, Placa};
use jxmod::motor::Motor3d;
use jxmotor::gpu::{Motor, Opciones};
use khronos_egl as egl;
use std::path::Path;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let sal = a.get(1).cloned().unwrap_or("/tmp/claude-0/jugabilidad/fotos".into()); std::fs::create_dir_all(&sal).unwrap();
    let (w, h): (i32, i32) = (a.get(2).and_then(|x| x.parse().ok()).unwrap_or(960), a.get(3).and_then(|x| x.parse().ok()).unwrap_or(540));
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxm/www_todo".into());
    let let_ = std::env::var("JXM_LETRAS").unwrap_or("/tmp/claude-0/jxm/letras".into());
    let solo = std::env::var("JXM_SOLO").unwrap_or_default(); let hace = |k: &str| solo.is_empty() || solo.split(',').any(|s| s == k);
    let vk = std::env::var("JXM_MOTOR").unwrap_or_default() == "vk"; let g2 = std::env::var("JXM_MOTOR").unwrap_or_default() == "gl2";
    let datos = std::env::temp_dir().join("jxm_jug_datos"); let _ = std::fs::create_dir_all(&datos); let _ = std::fs::remove_file(datos.join("mapa.txt")); let _ = std::fs::remove_file(datos.join("ajustes.txt"));
    let lt = (std::fs::read_to_string(Path::new(&let_).join("letras.json")).ok(), std::fs::read(Path::new(&let_).join("letras.png")).ok());
    let mut j = Juego::nuevo(Paquete::abrir(Path::new(&www)), lt.0, lt.1, Some(datos));
    j.dt_fijo = Some(1.0 / 60.0);
    // (JXM_MENUS: la carpeta con ui/menus.* —el atlas de los menús, como en la app—: la pausa y el menú de objetos de la web)
    if let Ok(menus) = std::env::var("JXM_MENUS") { j.inicio_lector(Box::new(move |n| std::fs::read(Path::new(&menus).join(n)).ok())); }
    let (mut m, placa) = if vk {
        let m = unsafe { jxmotor::vk::Motor::nuevo(None, w as u32, h as u32, Opciones::default()) }.expect("Vulkan"); let p = m.placa.clone(); j.en_uso = Placa::Vulkan; (Motor3d::Vk(m), p)
    } else {
        let e = unsafe { egl::DynamicInstance::<egl::EGL1_5>::load_required() }.expect("libEGL");
        let d = unsafe { e.get_platform_display(0x31DD, egl::DEFAULT_DISPLAY, &[egl::ATTRIB_NONE]) }.expect("pantalla EGL");
        e.initialize(d).unwrap(); e.bind_api(egl::OPENGL_ES_API).unwrap();
        let cfg = e.choose_first_config(d, &[egl::SURFACE_TYPE, egl::PBUFFER_BIT, egl::RENDERABLE_TYPE, egl::OPENGL_ES3_BIT, egl::NONE]).unwrap().or_else(|| e.choose_first_config(d, &[egl::NONE]).unwrap()).unwrap();
        let ctx = e.create_context(d, cfg, None, &[egl::CONTEXT_MAJOR_VERSION, 3, egl::NONE]).unwrap(); e.make_current(d, None, None, Some(ctx)).unwrap();
        let gl = unsafe { glow::Context::from_loader_function(|s| e.get_proc_address(s).map_or(std::ptr::null(), |p| p as *const _)) };
        let placa = unsafe { gl.get_parameter_string(glow::RENDERER) };
        let fb = unsafe { let t = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(t)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::RGBA8, w, h);
            let f = gl.create_framebuffer().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::RENDERBUFFER, Some(t)); f };
        std::mem::forget(e);
        if g2 { j.en_uso = Placa::Gl2; (Motor3d::Gl2(unsafe { jxmotor::gl2::Motor::nuevo(gl, jxmotor::gl2::Opciones2::default()) }.expect("motor"), Some(fb)), placa) }
        else { (Motor3d::Gl(unsafe { Motor::nuevo(gl, Opciones::default()) }.expect("motor"), Some(fb)), placa) }
    };
    let (wf, hf) = (w as f32, h as f32);
    let paso = |j: &mut Juego, m: &mut Motor3d, n: usize| { for _ in 0..n { unsafe { j.cuadro(m, w, h, &placa).expect("cuadro"); } } };
    let foto = |m: &mut Motor3d, nombre: &str| {
        let dado = match m {
            Motor3d::Vk(v) => unsafe { v.leer_imagen() }.expect("imagen"),
            _ => {
                let (gl, f): (&glow::Context, Option<glow::Framebuffer>) = match m { Motor3d::Gl(g, f) => (&g.gl, *f), Motor3d::Gl2(g, f) => (&g.gl, *f), _ => unreachable!() };
                let mut px = vec![0u8; (w * h * 4) as usize];
                unsafe { gl.bind_framebuffer(glow::FRAMEBUFFER, f); gl.read_pixels(0, 0, w, h, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelPackData::Slice(Some(&mut px))); }
                let fila = (w * 4) as usize; let mut dado = vec![0u8; px.len()];
                for y in 0..h as usize { dado[y * fila..(y + 1) * fila].copy_from_slice(&px[(h as usize - 1 - y) * fila..(h as usize - y) * fila]); }
                dado
            }
        };
        let ruta = format!("{sal}/{nombre}.png"); let f = std::fs::File::create(&ruta).unwrap(); let mut enc = png::Encoder::new(std::io::BufWriter::new(f), w as u32, h as u32);
        enc.set_color(png::ColorType::Rgba); enc.set_depth(png::BitDepth::Eight); enc.write_header().unwrap().write_image_data(&dado).unwrap(); println!("  → {ruta}");
    };
    // (mirar desde `o` hacia `p`)
    let mirar = |j: &mut Juego, o: [f32; 3], p: [f32; 3]| { let d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]]; let l = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt(); j.poner_ojos(o, d[0].atan2(d[2]), (d[1] / l).asin()); };
    let boton = |j: &mut Juego, b: jxmod::comun::Boton| { let (x, y) = jxmod::comun::pos_boton(wf, hf, b); j.dedo_abajo(90, x, y, wf, hf); j.dedo_arriba(90); };
    let caminar = |j: &mut Juego, si: bool| { if si { j.dedo_abajo(1, wf * 0.15, hf * 0.75, wf, hf); j.dedo_mueve(1, wf * 0.15, hf * 0.75 - hf * 0.12, hf); } else { j.dedo_arriba(1); } };
    use jxmod::comun::jugabilidad::Bj;
    use jxmod::comun::Boton;

    // ---------------- RB_Construct: el choque y la explosión ----------------
    j.poner_mapa("RB_Construct"); paso(&mut j, &mut m, 3); paso(&mut j, &mut m, 60);
    println!("mapa {} · jugador {:?}", j.mapas[j.mapas.iter().position(|x| x == "RB_Construct").unwrap_or(0)], j.jug.pos);
    if hace("destruccion") {
        let _ = j.crear_en(&mut m, "Sedan", [-2.0, -2.4, 19.2], 0.0); let id = j.objs.last().and_then(|o| o.cuerpo).unwrap();
        mirar(&mut j, [-2.0 + 3.6, -2.4 + 1.6, 19.2 + 6.2], [-2.0, -2.0, 19.2 + 1.8]); paso(&mut j, &mut m, 72);
        let p0 = j.fis.cuerpo(id).unwrap().pos; println!("Sedan en {:?}", p0); foto(&mut m, "des_100_antes");
        if let Some(b) = j.fis.cuerpo_mut(id) { b.vel = [0.0, 0.0, 27.78]; b.despertar(); }
        for k in 0..96 { paso(&mut j, &mut m, 1); if k == 6 { foto(&mut m, "des_100_choque"); } }
        let b = j.fis.cuerpo(id).unwrap(); let v = j.vehs.de(id).unwrap();
        let (autos, piezas) = j.jg_des_info();
        println!("choque a 100 km/h: auto en {:?} · vida {:.0} · ruedas {} · roto {} · ruedas sueltas {} · {:?}", b.pos, v.vida, v.ruedas.len(), v.roto, piezas, autos);
        foto(&mut m, "des_100_despues");
        let p = j.fis.cuerpo(id).unwrap().pos; mirar(&mut j, [p[0] as f32 + 2.6, p[1] as f32 + 1.4, p[2] as f32 - 3.2], [p[0] as f32, p[1] as f32, p[2] as f32 + 1.2]); paso(&mut j, &mut m, 3); foto(&mut m, "des_100_trompa");
        paso(&mut j, &mut m, 240); foto(&mut m, "des_100_humo");
        // una explosión al costado de otro auto
        let _ = j.crear_en(&mut m, "Sedan", [8.0, -2.4, 10.0], 0.0); let id2 = j.objs.last().and_then(|o| o.cuerpo).unwrap(); paso(&mut j, &mut m, 60);
        let p2 = j.fis.cuerpo(id2).unwrap().pos; let pe = [p2[0] as f32 + 2.6, p2[1] as f32, p2[2] as f32];
        mirar(&mut j, [p2[0] as f32 + 5.0, p2[1] as f32 + 1.2, p2[2] as f32 - 3.0], [p2[0] as f32, p2[1] as f32, p2[2] as f32]);
        j.jg_prueba("explosion", pe, ""); paso(&mut j, &mut m, 2); foto(&mut m, "des_explosion_0"); paso(&mut j, &mut m, 150);
        let p2 = j.fis.cuerpo(id2).unwrap().pos; mirar(&mut j, [p2[0] as f32 + 4.0, p2[1] as f32 + 1.0, p2[2] as f32 - 1.0], [p2[0] as f32, p2[1] as f32, p2[2] as f32]); paso(&mut j, &mut m, 3);
        let (autos, _) = j.jg_des_info(); println!("explosión al costado: {:?} · vida {:.0}", autos, j.vehs.de(id2).map(|v| v.vida).unwrap_or(0.0)); foto(&mut m, "des_explosion_lado");
    }
    // ---------------- el agua de Source (dev/water_normal de HL2 bajada de archive.org, y el material del mapa) ----------------
    if hace("agua_src") {
        let arch = std::env::temp_dir().join("jxm_jug_datos/hl2_water_normal.vtf"); if std::env::var_os("JXM_BAJAR_DE_NUEVO").is_some() { let _ = std::fs::remove_file(&arch); }
        j.gmod.http_bin = Some(std::sync::Arc::new(|u: &str| {
            let o = std::process::Command::new("curl").args(["-sL", "--max-time", "240", "-w", "\n%{http_code}", u]).output().map_err(|e| e.to_string())?;
            let mut b = o.stdout; let i = b.iter().rposition(|c| *c == b'\n').unwrap_or(0); let cod: u16 = String::from_utf8_lossy(&b[i + 1..]).trim().parse().unwrap_or(0); b.truncate(i); Ok((cod, b))
        }));
        let v = j.aguas.vols.iter().max_by(|a, b| (a.hx * a.hz).partial_cmp(&(b.hx * b.hz)).unwrap()).cloned().unwrap();
        let (cx, cz, y1) = (v.cx as f32, v.cz as f32, v.y1 as f32);
        let vistas = [([cx - 22.0, y1 + 2.0, cz + 34.0], [cx + 6.0, y1 - 1.0, cz - 6.0]), ([cx + 3.0, y1 + 3.5, cz + 8.0], [cx, y1, cz + 2.0]), ([cx - 10.0, y1 + 0.6, cz + 20.0], [cx + 10.0, y1 + 0.6, cz - 20.0])];
        for (k, (o, p)) in vistas.iter().enumerate() { mirar(&mut j, *o, *p); paso(&mut j, &mut m, 3); foto(&mut m, &format!("agua_propia_{k}")); }
        let t0 = std::time::Instant::now();
        while j.jg.agua.src.cuadros.is_none() && j.jg.agua.src.error.is_none() && t0.elapsed().as_secs() < 250 { paso(&mut j, &mut m, 1); std::thread::sleep(std::time::Duration::from_millis(100)); }
        println!("agua de Source: textura {:?} en {:.1} s · error {:?} · archivo {} bytes", j.jg.agua.src.cuadros.as_ref().map(|c| (c.0, c.1, c.2)), t0.elapsed().as_secs_f32(), j.jg.agua.src.error, std::fs::metadata(&arch).map(|m| m.len()).unwrap_or(0));
        paso(&mut j, &mut m, 3); println!("puesta en {:?}", j.jg.agua.src.puesta);
        for (k, (o, p)) in vistas.iter().enumerate() { mirar(&mut j, *o, *p); paso(&mut j, &mut m, 3); foto(&mut m, &format!("agua_source_{k}")); }
    }
    // ---------------- dónde está el agua en el menú de objetos ----------------
    if hace("menu_agua") {
        boton(&mut j, Boton::Objetos); paso(&mut j, &mut m, 20); foto(&mut m, "menu_objetos");
        let k = j.catalogo.iter().position(|c| c.0 == "Agua").unwrap_or(0); if let Some(mm) = j.menu.as_mut() { mm.sub = k; } paso(&mut j, &mut m, 20); foto(&mut m, "menu_agua");
        if let Some(mm) = j.menu.as_mut() { mm.sub = 0; } paso(&mut j, &mut m, 20); foto(&mut m, "menu_opciones");
        println!("categorías: {:?}", j.catalogo.iter().map(|c| format!("{} ({})", c.0, c.1.len())).collect::<Vec<_>>());
        if let Some(a) = j.catalogo.iter().find(|c| c.0 == "Agua") { println!("Agua: {:?}", a.1.iter().take(12).collect::<Vec<_>>()); }
    }
    // ---------------- las olas simuladas y lo que se llena de agua (olas.rs, flotar.rs) ----------------
    if hace("olas") {
        let v = j.aguas.vols.iter().max_by(|a, b| (a.hx * a.hz).partial_cmp(&(b.hx * b.hz)).unwrap()).cloned().unwrap();
        let (cx, cz, y1) = (v.cx as f32 - 10.0, v.cz as f32 + 10.0, v.y1 as f32);
        mirar(&mut j, [cx - 7.0, y1 + 4.5, cz + 7.0], [cx, y1, cz]); paso(&mut j, &mut m, 30); foto(&mut m, "olas_quieta");
        for q in [[-1.0f32, -1.0], [1.5, 0.0], [0.0, 1.5]] { let _ = j.crear_en(&mut m, "Box2", [cx + q[0], y1 + 3.0, cz + q[1]], 0.0); }
        let mut hmax = 0.0f32;
        for k in 0..150 { paso(&mut j, &mut m, 1); if let Some(o) = &j.aguas.olas { hmax = hmax.max(o.h.iter().map(|x| x.abs()).fold(0.0, f32::max)); }
            if k == 48 { foto(&mut m, "olas_1"); } if k == 70 { foto(&mut m, "olas_2"); } if k == 110 { foto(&mut m, "olas_3"); } }
        let movidas = j.aguas.olas.as_ref().map_or(0, |o| o.h.iter().filter(|x| x.abs() > 0.005).count());
        println!("olas: hasta {:.1} cm · celdas con más de 5 mm al final: {movidas} · grilla en {:?}", hmax * 100.0, j.aguas.olas.as_ref().map(|o| (o.x0, o.z0, o.y)));
        // un auto que cae al agua: flota un rato, se llena por las rendijas largando aire y se va al fondo
        let _ = j.crear_en(&mut m, "Sedan", [cx + 5.0, y1 + 2.5, cz - 5.0], 0.0); let auto = j.objs.last().and_then(|o| o.cuerpo);
        if let Some(id) = auto { if let Some(h) = j.aguas.cuerpos.get(&id).and_then(|f| f.hueco.as_ref()) { println!("auto: hueco {:.1} m³, entra {:.2} m³/s", h.v_cav, h.fuga); } else { println!("auto: NO es hueco"); } }
        mirar(&mut j, [cx + 1.0, y1 + 3.0, cz - 1.0], [cx + 5.0, y1, cz - 5.0]);
        for k in 0..2400 { paso(&mut j, &mut m, 1);
            if k % 300 == 299 { if let Some(b) = auto.and_then(|id| j.fis.cuerpo(id)) { println!("  t {:.0} s · auto a {:.2} m de la superficie · lleno {:.0} %", (k + 1) as f32 / 60.0, b.pos[1] as f32 - y1, auto.and_then(|id| j.aguas.lleno(id)).unwrap_or(-1.0) * 100.0); } }
            if k == 120 { foto(&mut m, "auto_flota"); } if k == 900 { foto(&mut m, "auto_llenandose"); } }
        if let Some(b) = auto.and_then(|id| j.fis.cuerpo(id)) { let p = b.pos; mirar(&mut j, [p[0] as f32 + 3.0, (p[1] as f32 + 1.5).min(y1 - 0.5), p[2] as f32 + 3.0], [p[0] as f32, p[1] as f32, p[2] as f32]); paso(&mut j, &mut m, 3); foto(&mut m, "auto_fondo"); }
    }
    // ---------------- el agua de partículas (agua_juego.rs) ----------------
    if hace("agua") {
        { let k = ["bottle", "botella", "bucket", "balde", "bathtub", "tub", "trash", "can", "lata", "mug", "taza", "cup", "vaso", "pot", "olla", "bowl", "vase", "kettle", "jar", "barrel", "barril", "carton", "jug", "pail", "sink"];
          let mut hay = vec![]; for (cat, its) in &j.catalogo { for it in its { let l = it.to_lowercase(); if k.iter().any(|x| l.contains(x)) { hay.push(format!("{cat}/{it}")); } } }
          println!("recipientes en el catálogo ({}): {:?}", hay.len(), hay); }
        for v in &j.aguas.vols { println!("agua del mapa: centro ({:.1}, {:.1}) medio ({:.1}, {:.1}) de {:.2} a {:.2}", v.cx, v.cz, v.hx, v.hz, v.y0, v.y1); }
        j.jug.noclip = false; paso(&mut j, &mut m, 30);
        let b0 = j.jug.pos; let fw = [j.jug.yaw.sin(), 0.0, j.jug.yaw.cos()]; let pie = b0[1] - 0.95;
        let frente = [b0[0] + fw[0] * 3.5, pie, b0[2] + fw[2] * 3.5];
        let ojo = [b0[0] - fw[0] * 1.5 + 1.2, pie + 2.2, b0[2] - fw[2] * 1.5];
        // 1) un montón de agua en el piso (1000 L): cae, se desparrama y se queda quieta
        mirar(&mut j, [b0[0], b0[1] + 0.7, b0[2]], frente); paso(&mut j, &mut m, 2);
        j.agua_poner("pileta"); let n0 = j.jg.agua.flu.cuantas();
        let mut ms = vec![]; let mut cuadro = vec![];
        mirar(&mut j, ojo, [frente[0], pie + 0.4, frente[2]]);
        for k in 0..300 { let t = std::time::Instant::now(); paso(&mut j, &mut m, 1); cuadro.push(t.elapsed().as_secs_f32() * 1000.0); ms.push(j.jg.agua.flu.ms);
            if k == 20 { foto(&mut m, "agua_cae"); } if k == 90 { foto(&mut m, "agua_desparrama"); } }
        foto(&mut m, "agua_quieta");
        let vm = j.jg.agua.flu.v.iter().map(|v| (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt()).sum::<f32>() / j.jg.agua.flu.cuantas().max(1) as f32;
        let bajo = j.jg.agua.flu.x.iter().filter(|p| p[1] < pie - 0.3).count();
        ms.sort_by(|a, b| a.partial_cmp(b).unwrap()); cuadro.sort_by(|a, b| a.partial_cmp(b).unwrap());
        println!("agua en el piso: {n0} → {} partículas · se fueron por debajo del piso {bajo} · velocidad media al final {vm:.3} m/s · fluido {:.2} ms (p95 {:.2}) · cuadro {:.1} ms (p95 {:.1})", j.jg.agua.flu.cuantas(), ms[ms.len() / 2], ms[ms.len() * 95 / 100], cuadro[cuadro.len() / 2], cuadro[cuadro.len() * 95 / 100]);
        // 2) una caja que cae en el agua de partículas: la salpica y la corre
        let _ = j.crear_en(&mut m, "Box2", [frente[0], pie + 2.5, frente[2]], 0.0); let caja = j.objs.last().and_then(|o| o.cuerpo);
        let mut toco = 0; for k in 0..60 { paso(&mut j, &mut m, 1); toco = toco.max(j.jg.agua.flu.objetos); if k == 14 { foto(&mut m, "agua_caja_cae"); } }
        let pc = caja.and_then(|c| j.fis.cuerpo(c)).map(|b| b.pos).unwrap_or_default(); println!("caja en el agua de partículas: {:?} · el agua la tocó (objetos a la vez: {toco})", pc);
        // 3) el jugador camina por el agua: la corre
        j.jug.noclip = false; j.jug.pos = [frente[0] - fw[0] * 2.5, b0[1], frente[2] - fw[2] * 2.5]; j.jug.vel = [0.0; 3]; j.jug.yaw = fw[0].atan2(fw[2]); j.jug.pitch = 0.45; paso(&mut j, &mut m, 5);
        caminar(&mut j, true); let mut toques = 0; for k in 0..70 { paso(&mut j, &mut m, 1); toques = toques.max(j.jg.agua.flu.toques_jug); if k == 40 { foto(&mut m, "agua_caminar"); } } caminar(&mut j, false);
        println!("caminando por el agua: hasta {toques} partículas tocándolo a la vez");
        // 4) la manguera contra el piso y una canilla
        j.jug.pos = b0; j.jug.vel = [0.0; 3]; mirar(&mut j, [b0[0], b0[1] + 0.7, b0[2]], [frente[0] + fw[2] * 4.0, pie, frente[2] - fw[0] * 4.0]); paso(&mut j, &mut m, 2);
        j.agua_poner("manguera"); for k in 0..90 { paso(&mut j, &mut m, 1); if k == 60 { foto(&mut m, "agua_manguera"); } } j.agua_poner("manguera");
        println!("manguera: {} partículas", j.jg.agua.flu.cuantas());
        // 5) el agua del mapa: una caja que cae adentro (salpicón de verdad y burbujas)
        if let Some(v) = j.aguas.vols.iter().max_by(|a, b| (a.hx * a.hz).partial_cmp(&(b.hx * b.hz)).unwrap()).cloned() {
            j.agua_poner("secar"); let (cx, cz, y1) = (v.cx as f32, v.cz as f32, v.y1 as f32);
            mirar(&mut j, [cx + 4.0, y1 + 2.2, cz + 4.0], [cx, y1, cz]); paso(&mut j, &mut m, 3);
            let _ = j.crear_en(&mut m, "Box2", [cx, y1 + 3.0, cz], 0.0);
            let mut maxp = 0; for k in 0..90 { paso(&mut j, &mut m, 1); maxp = maxp.max(j.jg.agua.flu.cuantas()); if k == 46 { foto(&mut m, "agua_mapa_salpica"); } if k == 60 { foto(&mut m, "agua_mapa_salpica2"); } }
            println!("salpicón en el agua del mapa: hasta {maxp} partículas · quedan {} · burbujas/gotas vivas {}", j.jg.agua.flu.cuantas(), j.ef.cuantas());
            // abajo del agua: las burbujas
            mirar(&mut j, [cx + 1.5, (y1 - 0.8).max(v.y0 as f32 + 0.3), cz + 1.5], [cx, y1 - 0.6, cz]); let _ = j.crear_en(&mut m, "Box2", [cx + 0.3, y1 + 2.0, cz], 0.0);
            for k in 0..90 { paso(&mut j, &mut m, 1); if k == 62 { foto(&mut m, "agua_burbujas"); } if k == 80 { foto(&mut m, "agua_burbujas2"); } }
        }
        // 6) los huecos en el agua del mapa: una botella y un florero que caen (se llenan, burbujas, se hunden o flotan)
        if let Some(v) = j.aguas.vols.iter().max_by(|a, b| (a.hx * a.hz).partial_cmp(&(b.hx * b.hz)).unwrap()).cloned() {
            let (cx, cz, y1) = (v.cx as f32 - 3.0, v.cz as f32 + 3.0, v.y1 as f32);
            let mut ids = vec![];
            for (k, n) in ["bottle3", "Vase"].iter().enumerate() { let _ = j.crear_en(&mut m, n, [cx + k as f32 * 1.5, y1 + 1.5, cz], 0.0); if let Some(id) = j.objs.last().and_then(|o| o.cuerpo) { ids.push((n.to_string(), id)); } }
            for (n, id) in &ids { if let Some(h) = j.aguas.cuerpos.get(id).and_then(|f| f.hueco.as_ref()) { println!("{n}: hueco cavidad {:.0} % de {:.2} L, boca r {:.3} m, eje {:?}", h.cav * 100.0, h.v_cav * 1000.0, h.boca_r, h.eje); } else { println!("{n}: NO es hueco"); } }
            mirar(&mut j, [cx + 4.5, y1 + 1.2, cz + 3.5], [cx + 0.7, y1 - 0.2, cz]);
            let mut bur = 0usize;
            for k in 0..420 { let antes = j.ef.cuantas(); paso(&mut j, &mut m, 1); bur += j.ef.cuantas().saturating_sub(antes);
                if k % 60 == 59 { let t: Vec<String> = ids.iter().map(|(n, id)| format!("{n}: y {:.2} lleno {:.0} %", j.fis.cuerpo(*id).map_or(0.0, |b| b.pos[1] - v.y1), j.aguas.lleno(*id).unwrap_or(-1.0) * 100.0)).collect(); println!("  t {:.0} s · {}", (k + 1) as f32 / 60.0, t.join(" · ")); }
                if k == 40 { foto(&mut m, "hueco_cae"); } }
            foto(&mut m, "hueco_final");
            // abajo del agua, mirando el florero
            if let Some(b) = ids.get(1).and_then(|(_, id)| j.fis.cuerpo(*id)) { let p = b.pos; mirar(&mut j, [p[0] as f32 + 1.2, (p[1] as f32 + 0.3).min(y1 - 0.4), p[2] as f32 + 1.0], [p[0] as f32, p[1] as f32, p[2] as f32]); paso(&mut j, &mut m, 2); foto(&mut m, "hueco_abajo"); }
            println!("huecos: burbujas y gotas nuevas en 7 s: {bur}");
        }
        j.agua_poner("secar");
    }
    // ---------------- la Comunidad: Mega rampa (entidades.js) ----------------
    if hace("entidades") {
        j.jg.ents.pend = Some("megarampa".into()); j.poner_mapa("FlatGrass"); paso(&mut j, &mut m, 3); paso(&mut j, &mut m, 90);
        let e = &j.jg.ents; println!("mega rampa: {} rampa, {} botones, {} carteles, {} teletransportes, {} luz · jugador {:?}", e.cuantas("rampa"), e.cuantas("boton_autos"), e.cuantas("cartel"), e.cuantas("teleport"), e.cuantas("luz"), j.jug.pos);
        let autos: Vec<String> = j.objs.iter().map(|o| o.nombre.clone()).collect(); println!("autos puestos por los botones: {:?}", autos);
        // (arriba, mirando la bajada; de costado, lejos, toda la rampa)
        let (rp, _) = j.jg.ents.lugar("rampa").unwrap();
        mirar(&mut j, [rp[0] + 10.0, rp[1] + 146.0, rp[2] - 28.0], [rp[0], rp[1] + 120.0, rp[2] + 60.0]); paso(&mut j, &mut m, 3); foto(&mut m, "ent_rampa_arriba");
        mirar(&mut j, [rp[0] + 230.0, rp[1] + 60.0, rp[2] + 140.0], [rp[0], rp[1] + 50.0, rp[2] + 140.0]); paso(&mut j, &mut m, 3); foto(&mut m, "ent_rampa_costado");
        // un Sedan desde la punta de arriba: que baje apoyado (sin despegarse de la cresta) y salga por el salto
        let _ = j.crear_en(&mut m, "Sedan", [rp[0], rp[1] + 140.5, rp[2] + 4.0], 0.0); let id = j.objs.last().and_then(|o| o.cuerpo).unwrap();
        if let Some(b) = j.fis.cuerpo_mut(id) { b.vel = [0.0, 0.0, 12.0]; b.despertar(); }
        let mut vmax = 0.0f64; let mut ymin = 1e9f64; let mut despegue = 0.0f64;
        for k in 0..900 { paso(&mut j, &mut m, 1); let Some(b) = j.fis.cuerpo(id) else { break }; let v = (b.vel[0] * b.vel[0] + b.vel[1] * b.vel[1] + b.vel[2] * b.vel[2]).sqrt(); vmax = vmax.max(v); ymin = ymin.min(b.pos[1]);
            // (lo que se separa del piso de la rampa mientras baja: altura del auto menos la del piso debajo)
            if k % 30 == 0 { let p = b.pos; let piso = j.mapa.as_ref().and_then(|mp| mp.mundo.rayo([p[0] as f32, p[1] as f32 + 0.5, p[2] as f32], [0.0, -1.0, 0.0], 50.0)).map(|g| g.t as f64 - 0.5).unwrap_or(-1.0); despegue = despegue.max(piso);
                println!("  t={:.1}s auto en ({:.1}, {:.1}, {:.1}) a {:.1} m/s · al piso {:.2} m", k as f32 / 60.0, p[0], p[1], p[2], v, piso); }
            if k == 240 { let p = b.pos; mirar(&mut j, [p[0] as f32 + 14.0, p[1] as f32 + 6.0, p[2] as f32 - 6.0], [p[0] as f32, p[1] as f32, p[2] as f32]); foto(&mut m, "ent_rampa_auto"); } }
        println!("rampa: velocidad máxima {:.1} m/s ({:.0} km/h) · lo más bajo {:.1} m · lo más separado del piso {:.2} m", vmax, vmax * 3.6, ymin, despegue);
        // el teletransporte de abajo lleva a la plataforma de arriba
        let tp = j.jg.ents.lista.iter().find(|e| e.t == "teleport").map(|e| e.p).unwrap();
        j.jug.pos = [tp[0], tp[1] + 1.0, tp[2]]; j.jug.vel = [0.0; 3]; paso(&mut j, &mut m, 20); println!("teletransporte: de {:?} a {:?}", tp, j.jug.pos);
        // el piano de las Opciones: delante, y caminar por arriba de las teclas
        j.jug.pos = [40.0, 1.6, 40.0]; j.jug.yaw = 0.0; paso(&mut j, &mut m, 30); j.jg.ents.poner = Some("piano"); paso(&mut j, &mut m, 3);
        let (pp, pq) = j.jg.ents.lugar("piano").unwrap(); println!("piano en {:?}", pp);
        mirar(&mut j, [pp[0] + 8.0, pp[1] + 7.0, pp[2] - 4.0], [pp[0], pp[1], pp[2] + 2.5]); paso(&mut j, &mut m, 3); foto(&mut m, "ent_piano");
        let mut maxon = 0; let rot = |q: [f32; 4], v: [f32; 3]| { let u = [q[0], q[1], q[2]]; let c = |a: [f32; 3], b: [f32; 3]| [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; let t = c(u, v); let t = [t[0] * 2.0, t[1] * 2.0, t[2] * 2.0]; let c2 = c(u, t); [v[0] + t[0] * q[3] + c2[0], v[1] + t[1] * q[3] + c2[1], v[2] + t[2] * q[3] + c2[2]] };
        for k in 0..60 { let x = 8.0 - k as f32 * 0.27; let l = rot(pq, [x, 0.0, 2.0]); j.jug.pos = [pp[0] + l[0], pp[1] + 0.3 + 0.98, pp[2] + l[2]]; j.jug.vel = [0.0; 3]; paso(&mut j, &mut m, 2); maxon = maxon.max(j.jg.ents.teclas_sonando()); if k == 30 { foto(&mut m, "ent_piano_pisando"); } }
        println!("piano: {} notas distintas sonaron al cruzarlo (a lo sumo {} teclas a la vez)", j.jg.ents.notas_distintas(), maxon);
    }
    // ---------------- RB_Flatgrass: lo demás ----------------
    j.poner_mapa("RB_Flatgrass"); paso(&mut j, &mut m, 3); paso(&mut j, &mut m, 60); j.jug.noclip = false; paso(&mut j, &mut m, 30);
    let base = j.jug.pos; let fw = [j.jug.yaw.sin(), 0.0, j.jug.yaw.cos()]; println!("Flatgrass: jugador {:?} yaw {:.2}", base, j.jug.yaw);
    let delante = |k: f32| [base[0] + fw[0] * k, base[1] - 0.95, base[2] + fw[2] * k];
    // ---------------- el nextbot de la Tool Gun: corre hacia el jugador y le pega ----------------
    if hace("nextbot") {
        j.poner_mapa("RB_Flatgrass"); paso(&mut j, &mut m, 3); paso(&mut j, &mut m, 60); j.jug.noclip = false; paso(&mut j, &mut m, 30);
        let b = j.jug.pos; let fw = [j.jug.yaw.sin(), 0.0, j.jug.yaw.cos()];
        unsafe { j.prueba_nextbot(&mut m, [b[0] + fw[0] * 14.0, b[1], b[2] + fw[2] * 14.0], "#Obunga"); }
        let v0 = j.jug.vida; paso(&mut j, &mut m, 20); foto(&mut m, "nextbot_lejos");
        let mut d_min = 1e9f32; for _ in 0..150 { paso(&mut j, &mut m, 1); if let Some(o) = j.objs.last() { let d = ((o.pos[0] - j.jug.pos[0]).powi(2) + (o.pos[2] - j.jug.pos[2]).powi(2)).sqrt(); d_min = d_min.min(d); } }
        foto(&mut m, "nextbot_cerca"); println!("nextbot: lo más cerca {:.2} m · vida {} → {}", d_min, v0, j.jug.vida);
    }
    if hace("patada") {
        let _ = j.crear_en(&mut m, "Box2", delante(1.3), 0.0); let id = j.objs.last().and_then(|o| o.cuerpo); paso(&mut j, &mut m, 40);
        boton(&mut j, Boton::Jg(Bj::Patada)); paso(&mut j, &mut m, 14); foto(&mut m, "patada_primera"); paso(&mut j, &mut m, 3);
        let v = id.and_then(|i| j.fis.cuerpo(i)).map(|b| b.vel).unwrap_or_default(); println!("patada: la caja sale a {:.2} m/s (la web: hasta 9 m/s, más arriba)", (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt());
        paso(&mut j, &mut m, 60);
    }
    if hace("hud") {
        // el HUD como la web (hud_web.rs): la barra de armas abierta en fila arriba a la derecha, la Pistol con sus balas en el
        // recuadro del arma, y la linterna y la cámara libre prendidas (amarillas, con el ícono negro)
        boton(&mut j, Boton::Arma); paso(&mut j, &mut m, 2); foto(&mut m, "hud_barra");
        let k = jxmod::armas::ARMAS.iter().position(|a| a.n == "Pistol").unwrap_or(1); boton(&mut j, Boton::ArmaN(k)); paso(&mut j, &mut m, 200); foto(&mut m, "hud_balas");
        boton(&mut j, Boton::Jg(Bj::Linterna)); boton(&mut j, Boton::Jg(Bj::CamLibre)); boton(&mut j, Boton::Jg(Bj::CamL)); paso(&mut j, &mut m, 3); foto(&mut m, "hud_prendidos");
        boton(&mut j, Boton::Jg(Bj::CamLibre)); boton(&mut j, Boton::Jg(Bj::Linterna)); paso(&mut j, &mut m, 3);
        println!("hud: arma {} · balas {:?} · linterna {} · cámara libre {}", j.armas.def().n, j.armas.balas.get(k), j.jg.lint, j.jg.clib.menu);
        // (el menú de objetos)
        boton(&mut j, Boton::Objetos); paso(&mut j, &mut m, 30); foto(&mut m, "hud_menu");
        // (otra categoría, la pestaña de NPCs, Herramientas, y cerrar con la cruz)
        // (Props → Mundo: la hora del día y el ciclo)
        if let Some(k) = j.catalogo.iter().position(|c| c.0 == "Mundo") { if j.menu.is_some() { j.menu.as_mut().unwrap().sub = k; j.aj.hora = 17.5; paso(&mut j, &mut m, 8); foto(&mut m, "hud_menu_mundo"); j.aj.hora = 12.0; } }
        if j.menu.is_some() { j.menu.as_mut().unwrap().sub = 2; paso(&mut j, &mut m, 3); foto(&mut m, "hud_menu_cat"); j.menu.as_mut().unwrap().pestana = 1; j.menu.as_mut().unwrap().sub = 0; paso(&mut j, &mut m, 3); foto(&mut m, "hud_menu_npc");
            j.menu.as_mut().unwrap().pestana = 3; paso(&mut j, &mut m, 3); foto(&mut m, "hud_menu_her"); }
        j.menu = None; paso(&mut j, &mut m, 2);
    }
    if hace("editor") {
        // el editor de los botones (controles.js): mover el salto arrastrándolo, agrandar el disparo con dos dedos y con «+»,
        // guardar (queda en ajustes.txt) y volver a los de fábrica
        use jxmod::comun::hud_web::{barra_editor, AccEd};
        let tocar_barra = |j: &mut Juego, a: AccEd| { let r = barra_editor(wf, hf, j.ed.veh).into_iter().find(|x| x.0 == a).unwrap().2; j.dedo_abajo(70, r[0] + r[2] / 2.0, r[1] + r[3] / 2.0, wf, hf); j.dedo_arriba(70); };
        let (sx0, sy0) = jxmod::comun::pos_boton(wf, hf, Boton::Saltar); let (dx0, dy0) = jxmod::comun::pos_boton(wf, hf, Boton::Disparo);
        j.ed_abrir(); paso(&mut j, &mut m, 2); foto(&mut m, "ctl_editor");
        j.dedo_abajo(71, sx0, sy0, wf, hf); for k in 1..=10 { j.dedo_mueve(71, sx0 - 32.0 * k as f32, sy0 - 14.0 * k as f32, hf); } j.dedo_arriba(71); paso(&mut j, &mut m, 1);
        j.dedo_abajo(72, dx0, dy0, wf, hf); j.dedo_abajo(73, dx0 + 60.0, dy0, wf, hf); for k in 1..=6 { j.dedo_mueve(73, dx0 + 60.0 + 10.0 * k as f32, dy0, hf); } j.dedo_arriba(73); j.dedo_arriba(72);
        tocar_barra(&mut j, AccEd::Mas); paso(&mut j, &mut m, 2); foto(&mut m, "ctl_editado");
        tocar_barra(&mut j, AccEd::Guardar); paso(&mut j, &mut m, 2); j.ajustes = None; paso(&mut j, &mut m, 2); foto(&mut m, "ctl_guardado");
        let (sx1, sy1) = jxmod::comun::pos_boton(wf, hf, Boton::Saltar);
        println!("editor: salto de ({sx0:.0}, {sy0:.0}) a ({sx1:.0}, {sy1:.0}) · guardado «{}» · editor abierto {}", j.aj.hud_pos, j.ed.activo);
        assert!((sx1 - (sx0 - 320.0)).abs() < 2.0 && (sy1 - (sy0 - 140.0)).abs() < 2.0 && j.aj.hud_pos.contains("disparo:") && !j.ed.activo, "el editor no movió o no guardó");
        // (tocar el salto en su lugar nuevo salta)
        j.dedo_abajo(74, sx1, sy1, wf, hf); paso(&mut j, &mut m, 3); println!("   salto en su lugar nuevo apretado: {}", j.jug.vel[1] > 0.5 || !j.jug.suelo); j.dedo_arriba(74); paso(&mut j, &mut m, 40);
        j.ed_abrir(); tocar_barra(&mut j, AccEd::Fabrica); tocar_barra(&mut j, AccEd::Guardar); j.ajustes = None; paso(&mut j, &mut m, 2);
        let (sx2, sy2) = jxmod::comun::pos_boton(wf, hf, Boton::Saltar); println!("   de fábrica: salto en ({sx2:.0}, {sy2:.0}) · «{}»", j.aj.hud_pos);
        assert!((sx2 - sx0).abs() < 0.5 && (sy2 - sy0).abs() < 0.5 && j.aj.hud_pos.is_empty());
    }
    if hace("tutorial") {
        // el tutorial (tutorial.js): la bienvenida, la palanca, el disparo, la pausa y el final, tocando Siguiente en la tarjeta
        use jxmod::comun::tutorial_juego::{AccTut, PASOS};
        let tocar = |j: &mut Juego, a: AccTut| { let r = j.tut_carta(wf, hf).unwrap().botones.into_iter().find(|x| x.0 == a).unwrap().2; j.dedo_abajo(80, r[0] + r[2] / 2.0, r[1] + r[3] / 2.0, wf, hf); j.dedo_arriba(80); };
        j.tut_abrir(); paso(&mut j, &mut m, 2); foto(&mut m, "tut_0_bienvenida");
        let nombres: Vec<&str> = j.tut.pasos.iter().map(|&k| PASOS[k].0).collect(); println!("tutorial: {} pasos: {}", nombres.len(), nombres.join(", "));
        tocar(&mut j, AccTut::Siguiente); paso(&mut j, &mut m, 30); foto(&mut m, "tut_1_palanca");
        while PASOS[j.tut.pasos[j.tut.i]].0 != "disparo" { tocar(&mut j, AccTut::Siguiente); } paso(&mut j, &mut m, 2); foto(&mut m, "tut_2_disparo");
        while PASOS[j.tut.pasos[j.tut.i]].0 != "pausa" { tocar(&mut j, AccTut::Siguiente); } paso(&mut j, &mut m, 2); foto(&mut m, "tut_3_pausa");
        tocar(&mut j, AccTut::Anterior); println!("   Anterior: {}", PASOS[j.tut.pasos[j.tut.i]].0); tocar(&mut j, AccTut::Siguiente); tocar(&mut j, AccTut::Siguiente); paso(&mut j, &mut m, 2); foto(&mut m, "tut_4_fin");
        tocar(&mut j, AccTut::Siguiente); paso(&mut j, &mut m, 2);
        println!("   cerrado: {} · visto (no sale solo otra vez): {}", !j.tut.on, j.aj.tut); assert!(!j.tut.on && j.aj.tut);
    }
    if hace("grieta") {
        // la grieta (evento.js) en un mapa del juego: mirarla, hacer caer cosas y ver la caída, el golpe y lo que queda
        if let Some(mapa) = j.mapas.iter().find(|m| jxmod::comun::grieta_juego::con_caidas(m) && ["Desert", "FlatGrass", "RB_Llanura", "City"].contains(&m.as_str())).cloned() {
            j.poner_mapa(&mapa); paso(&mut j, &mut m, 3); paso(&mut j, &mut m, 90);
            let d = j.gr.dir; let o = [j.jug.pos[0], j.jug.pos[1] + 0.72, j.jug.pos[2]];
            j.poner_ojos(o, d[0].atan2(d[2]), d[1].asin() * 0.8); paso(&mut j, &mut m, 3); foto(&mut m, "grieta_cielo");
            println!("grieta en {mapa}: dir {:?} · cargada {} · exposición del mapa {:?}", d, j.gr.cargada, j.mapa.as_ref().map(|m| m.luz.expo));
            let n = j.grieta_forzar(3); let objs0 = j.objs.len(); println!("   caen {n}: {:?}", j.grieta_cayendo().iter().map(|c| c.0.clone()).collect::<Vec<_>>());
            let mut sacada = false;
            for f in 0..360 { paso(&mut j, &mut m, 1);
                let l = j.grieta_cayendo(); if let Some(c) = l.iter().find(|c| c.2 == 1) { if !sacada && f > 120 { let p = c.1; let o = [j.jug.pos[0], j.jug.pos[1] + 0.72, j.jug.pos[2]]; let dd = [p[0] - o[0], p[1] - o[1], p[2] - o[2]]; let ll = (dd[0] * dd[0] + dd[1] * dd[1] + dd[2] * dd[2]).sqrt(); j.poner_ojos(o, dd[0].atan2(dd[2]), (dd[1] / ll).asin()); paso(&mut j, &mut m, 1); foto(&mut m, "grieta_cae"); sacada = true; } } }
            let l = j.grieta_cayendo(); println!("   después de 6 s: {} en la cola, {} objetos más (antes {objs0}, ahora {})", l.len(), j.objs.len() as i64 - objs0 as i64, j.objs.len());
            if let Some((p, nombre)) = j.objs.last().map(|o| (o.pos, o.nombre.clone())) { let e = [j.jug.pos[0], j.jug.pos[1] + 0.72, j.jug.pos[2]]; let dd = [p[0] - e[0], p[1] - e[1], p[2] - e[2]]; let ll = (dd[0] * dd[0] + dd[1] * dd[1] + dd[2] * dd[2]).sqrt();
                j.poner_ojos(e, dd[0].atan2(dd[2]), (dd[1] / ll).asin()); paso(&mut j, &mut m, 2); foto(&mut m, "grieta_quedo"); println!("   quedó {} a {:.1} m", nombre, ll); }
        } else { println!("grieta: no hay un mapa con grieta en este paquete"); }
    }
    if hace("linterna") {
        boton(&mut j, Boton::Jg(Bj::Linterna)); j.poner_ojos([base[0], base[1] + 0.72, base[2]], j.jug.yaw, -0.5); paso(&mut j, &mut m, 3); foto(&mut m, "linterna"); println!("linterna: {}", j.jg.lint); boton(&mut j, Boton::Jg(Bj::Linterna)); j.jug.noclip = false;
    }
    if hace("camlibre") {
        boton(&mut j, Boton::Jg(Bj::CamLibre)); boton(&mut j, Boton::Jg(Bj::CamL)); let p0 = j.jug.pos;
        caminar(&mut j, true); paso(&mut j, &mut m, 90); caminar(&mut j, false); let c = j.jg_prueba("camara", [0.0; 3], "").unwrap();
        println!("cámara libre L: el jugador se movió {:.2} m, la cámara está a {:.1} m de él", ((j.jug.pos[0] - p0[0]).powi(2) + (j.jug.pos[2] - p0[2]).powi(2)).sqrt(), ((c[0] - p0[0]).powi(2) + (c[2] - p0[2]).powi(2)).sqrt());
        foto(&mut m, "camlibre_L"); boton(&mut j, Boton::Jg(Bj::CamR)); caminar(&mut j, true); paso(&mut j, &mut m, 40); caminar(&mut j, false); paso(&mut j, &mut m, 5); foto(&mut m, "camlibre_R");
        boton(&mut j, Boton::Jg(Bj::CamR)); boton(&mut j, Boton::Jg(Bj::CamLibre)); println!("cámara libre: modo {:?} · cámara {}", j.jg.clib.modo, j.camara);
    }
    if hace("catapulta") {
        let _ = j.crear_en(&mut m, "Catapulta", delante(6.0), j.jug.yaw); paso(&mut j, &mut m, 60);
        if let Some(c) = j.jg_prueba("cuchara", [0.0; 3], "Catapulta") {
            let _ = j.crear_en(&mut m, "Box2", [c[0], c[1] + 0.3, c[2]], 0.0); let id = j.objs.last().and_then(|o| o.cuerpo); paso(&mut j, &mut m, 30);
            mirar(&mut j, [c[0] + fw[2] * 7.0, c[1] + 2.0, c[2] - fw[0] * 7.0], [c[0], c[1] + 1.0, c[2]]); paso(&mut j, &mut m, 2); foto(&mut m, "catapulta_antes");
            j.jg_prueba("usar", [0.0; 3], "Catapulta"); let mut vmax = 0.0f64;
            for k in 0..40 { paso(&mut j, &mut m, 1); if let Some(b) = id.and_then(|i| j.fis.cuerpo(i)) { vmax = vmax.max((b.vel[0].powi(2) + b.vel[1].powi(2) + b.vel[2].powi(2)).sqrt()); } if k == 9 { foto(&mut m, "catapulta_tiro"); } }
            println!("catapulta: la caja salió a {vmax:.1} m/s (la web: 17) · brazo {:?}", j.jg_prueba("brazo", [0.0; 3], "Catapulta"));
        } else { println!("catapulta: sin brazo"); }
        j.jug.noclip = false;
    }
    if hace("omega") {
        let jp = j.jug.pos; let o = [jp[0], jp[1] + 0.72, jp[2]]; let _ = j.poner(&mut m, "npc:Engineer", o, fw); paso(&mut j, &mut m, 3);
        let _ = j.crear_en(&mut m, "BombaOmega", delante(2.5), 0.0); paso(&mut j, &mut m, 30);
        let vivos = |j: &Juego| j.npcs.lista.iter().filter(|n| n.vivo && n.skin == "Engineer").count();
        println!("bomba de Rick Prime: Engineer vivos antes {}", vivos(&j)); j.jg_prueba("omega", [0.0; 3], "BombaOmega"); paso(&mut j, &mut m, 60 * 5 + 6); foto(&mut m, "omega_destello");
        println!("  después: {} vivos · destello {:.2} · jugador en {:?}", vivos(&j), j.jg.art.flash, jp); paso(&mut j, &mut m, 120);
    }
    if hace("mods") {
        for k in ["volar", "ragdoll", "scp"] { j.jg_prueba("opcion", [0.0; 3], k); }
        boton(&mut j, Boton::Jg(Bj::Mod)); paso(&mut j, &mut m, 2); foto(&mut m, "mod_menu"); boton(&mut j, Boton::Jg(Bj::Mod)); j.jg.panel_mod = false;
        j.jg_prueba("accion", [0.0; 3], "volar"); caminar(&mut j, true); paso(&mut j, &mut m, 120); foto(&mut m, "volar"); caminar(&mut j, false);
        println!("volar: vel {:.1} m/s (la web: hasta 20) · alto {:.1}", (j.jug.vel[0].powi(2) + j.jug.vel[1].powi(2) + j.jug.vel[2].powi(2)).sqrt(), j.jug.pos[1] - base[1]);
        j.jg_prueba("accion", [0.0; 3], "volar"); paso(&mut j, &mut m, 120);
        j.jg_prueba("accion", [0.0; 3], "ragdoll"); paso(&mut j, &mut m, 90); foto(&mut m, "munieco"); println!("muñeco: {:?} · jugador {:?}", j.jg.nat.rag, j.jug.pos); j.jg_prueba("accion", [0.0; 3], "ragdoll"); paso(&mut j, &mut m, 30);
        j.jg_prueba("accion", [0.0; 3], "scp"); caminar(&mut j, true); paso(&mut j, &mut m, 50); foto(&mut m, "scp_caminando"); caminar(&mut j, false); paso(&mut j, &mut m, 40); foto(&mut m, "scp_quieto");
        println!("scp: pegado {} · jugador {:?}", j.jug.suelo, j.jug.pos); j.jg_prueba("accion", [0.0; 3], "scp"); paso(&mut j, &mut m, 30);
        for k in ["volar", "ragdoll", "scp"] { j.jg_prueba("opcion", [0.0; 3], k); }
    }
    if hace("ciclope") {
        j.jg_prueba("opcion", [0.0; 3], "ciclope"); paso(&mut j, &mut m, 5); j.camara = 1;
        let _ = j.crear_en(&mut m, "Box2", delante(8.0), 0.0); paso(&mut j, &mut m, 30);
        boton(&mut j, Boton::Jg(Bj::Ciclope)); paso(&mut j, &mut m, 2); foto(&mut m, "ciclope_laser");
        let (x, y) = jxmod::comun::pos_boton(wf, hf, Boton::Jg(Bj::Ciclope)); j.dedo_abajo(91, x, y, wf, hf); paso(&mut j, &mut m, 70); j.dedo_arriba(91);
        let mut hecho = 10usize; for (t, n) in [(1.2, "ciclope_rodillas"), (3.0, "ciclope_mano"), (5.0, "ciclope_ojos"), (8.0, "ciclope_rayo")] { let tt = (t * 60.0) as usize; paso(&mut j, &mut m, tt.saturating_sub(hecho).max(1)); hecho = hecho.max(tt); foto(&mut m, n); }
        println!("cíclope: definitiva {} · rojo {:.2}", j.jg.cic.ult.is_some(), j.jg.cic.rojo); paso(&mut j, &mut m, 60 * 14); println!("  terminó: {} · espera", !j.jg.cic.ult.is_some());
        j.jg_prueba("opcion", [0.0; 3], "ciclope"); paso(&mut j, &mut m, 5);
    }
    if hace("nuclear") {
        j.camara = 0; let pn = delante(260.0); let piso = j.mapa.as_ref().and_then(|mp| mp.mundo.rayo([pn[0], pn[1] + 60.0, pn[2]], [0.0, -1.0, 0.0], 200.0)).map(|g| pn[1] + 60.0 - g.t).unwrap_or(pn[1]);
        let pn = [pn[0], piso + 0.5, pn[2]]; mirar(&mut j, [base[0], base[1] + 2.0, base[2]], [pn[0], pn[1] + 60.0, pn[2]]);
        j.jg_prueba("explotar", pn, "NK_ivymike"); println!("nuclear (Ivy Mike, 10,4 Mt) a 260 m: radio {:.0} m", jxjuego::nucleares::radio(10400.0));
        let mut hecho = 0usize; for (t, n) in [(0.15, "nuk_0s"), (2.0, "nuk_2s"), (6.0, "nuk_6s"), (15.0, "nuk_15s"), (40.0, "nuk_40s")] { let ya = (t * 60.0) as usize; paso(&mut j, &mut m, ya.saturating_sub(hecho).max(1)); hecho = ya; foto(&mut m, n); println!("  {t} s: destello/radiación {:?} · vida {:.0} · jugador {:?}", j.jg_nuk_info(), j.jug.vida, j.jug.pos); }
    }
    if hace("nuclear2") {
        // (una chica —Little Boy, 15 kt— vista entera desde 250 m: la bola, el polvo de la onda y el hongo)
        j.camara = 0; let pn = delante(250.0); let piso = j.mapa.as_ref().and_then(|mp| mp.mundo.rayo([pn[0], pn[1] + 60.0, pn[2]], [0.0, -1.0, 0.0], 200.0)).map(|g| pn[1] + 60.0 - g.t).unwrap_or(pn[1]);
        let pn = [pn[0], piso + 0.5, pn[2]]; let ojo = [base[0], base[1] + 1.5, base[2]];
        j.jg_prueba("explotar", pn, "NK_littleboy"); let r = jxjuego::nucleares::radio(15.0); println!("nuclear (Little Boy, 15 kt) a 250 m: radio {r:.1} m · alcance del daño {:.0} m · del viento {:.0} m", r * 2.3, r * 6.9);
        let mut hecho = 0usize; for (t, n) in [(0.5, "nuk2_0s"), (3.0, "nuk2_3s"), (8.0, "nuk2_8s"), (20.0, "nuk2_20s"), (60.0, "nuk2_60s")] { let ya = (t * 60.0) as usize; mirar(&mut j, ojo, [pn[0], pn[1] + 45.0, pn[2]]); paso(&mut j, &mut m, ya.saturating_sub(hecho).max(1)); hecho = ya; foto(&mut m, n); println!("  {t} s: destello/radiación {:?} · vida {:.0}", j.jg_nuk_info(), j.jug.vida); }
    }
    if hace("paneles") {
        // (la bomba de Rick Prime con su panel: Usar lo abre y tocar un personaje la arma; una nuclear armada con Usar)
        let _ = j.crear_en(&mut m, "BombaOmega", delante(2.5), 0.0); paso(&mut j, &mut m, 20);
        j.jg_prueba("usar", [0.0; 3], "BombaOmega"); paso(&mut j, &mut m, 3); foto(&mut m, "omega_panel"); println!("panel de la bomba abierto: {}", j.jg.panel());
        let (x, y) = (wf * 0.08 + hf * 0.03 + hf * 0.08, hf * 0.08 + hf * 0.12 + hf * 0.08); j.dedo_abajo(92, x, y, wf, hf); j.dedo_arriba_en(92, wf, hf); paso(&mut j, &mut m, 3);
        println!("  tocar el primero: panel {} · aviso armada", j.jg.panel()); paso(&mut j, &mut m, 60 * 6); println!("  después de 6 s: bombas Omega {}", j.objs.iter().filter(|o| o.nombre == "BombaOmega").count());
        let _ = j.crear_en(&mut m, "NK_littleboy", delante(120.0), 0.0); paso(&mut j, &mut m, 30);
        j.jg_prueba("usar", [0.0; 3], "NK_littleboy"); println!("nuclear armada: {} · Usar dice {:?}", j.jg.nuk.armadas.len(), j.jg.usar_txt);
        paso(&mut j, &mut m, 60 * 10 + 30); println!("  a los 10,5 s: armadas {} · nucleares en el mapa {} · destello {:?}", j.jg.nuk.armadas.len(), j.objs.iter().filter(|o| o.nombre.starts_with("NK_")).count(), j.jg_nuk_info());
    }
    if hace("pepe") && std::env::var("JXM_PEPE").is_ok() {
        j.poner_mapa("RB_Flatgrass"); paso(&mut j, &mut m, 3); paso(&mut j, &mut m, 60); j.jug.noclip = false; j.camara = 0;
        paso(&mut j, &mut m, 60 * 6); foto(&mut m, "pepe_vhs"); j.jug.yaw += std::f32::consts::PI; paso(&mut j, &mut m, 10); foto(&mut m, "pepe_atras");
        for k in 0..40 { paso(&mut j, &mut m, 30); if j.jg.pv.grita() { paso(&mut j, &mut m, 18); foto(&mut m, "pepe_screamer"); println!("pepe: screamer a los {:.1} s", 6.0 + k as f32 * 0.5); break; } }
        paso(&mut j, &mut m, 120); foto(&mut m, "pepe_fin");
    }
}
