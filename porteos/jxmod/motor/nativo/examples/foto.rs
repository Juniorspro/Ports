//! La prueba en la compu: el mismo juego de la app (comun.rs) dibujado fuera de pantalla, con toques de mentira, y fotos de
//! cada momento. Con OpenGL ES 3 (Mesa) o, con JXM_MOTOR=vk, con el motor Vulkan propio (lavapipe).
//! Uso: foto CARPETA_SALIDA [ANCHO ALTO]
//!   JXM_WWW: la carpeta del paquete (pk.bin, pk.idx.json, rb/); JXM_LETRAS: la de letras.png y letras.json
//!   JXM_MAPA y JXM_VISTAS="x,y,z,giro,inclinación;…": sólo fotos desde esos lugares (JXM_PRE: el nombre de las fotos)
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
    let sal = a.get(1).cloned().unwrap_or("/tmp/claude-0/jxm/nativo".into()); std::fs::create_dir_all(&sal).unwrap();
    let (w, h): (i32, i32) = (a.get(2).and_then(|x| x.parse().ok()).unwrap_or(1378), a.get(3).and_then(|x| x.parse().ok()).unwrap_or(634));
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxp_apk/activos/www".into());
    let let_ = std::env::var("JXM_LETRAS").unwrap_or("/tmp/claude-0/jxm/letras".into());
    let motor = std::env::var("JXM_MOTOR").unwrap_or_default(); let vk = motor == "vk"; let gl2 = motor == "gl2";
    let t = Instant::now();
    let paq = Paquete::abrir(Path::new(&www));
    println!("paquete: {:.0} ms", t.elapsed().as_secs_f64() * 1000.0);
    let datos = std::env::temp_dir().join("jxm_nativo_datos"); let _ = std::fs::create_dir_all(&datos);
    let letras = || (std::fs::read_to_string(Path::new(&let_).join("letras.json")).ok(), std::fs::read(Path::new(&let_).join("letras.png")).ok());
    let (lj, lp) = letras(); let mut j = Juego::nuevo(paq, lj, lp, Some(datos.clone()));
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
            // (OpenGL 2 dibuja directo en la salida: con profundidad)
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
    if let Ok(vs) = std::env::var("JXM_VISTAS") {
        if let Ok(mp) = std::env::var("JXM_MAPA") { assert!(j.poner_mapa(&mp), "no existe el mapa {mp}"); }
        paso(&mut j, &mut m, 2);
        let pre = std::env::var("JXM_PRE").unwrap_or("vista".into());
        for (k, v) in vs.split(';').enumerate() {
            let n: Vec<f32> = v.split(',').map(|x| x.trim().parse().unwrap()).collect();
            j.poner_ojos([n[0], n[1], n[2]], n[3], n[4]);
            paso(&mut j, &mut m, 3); foto(&mut m, &format!("{pre}_{k}"));
        }
        if let Some((t, d)) = m.tiempos() { println!("placa {t:.1} ms: {d}"); }
        return;
    }
    { let c = std::path::Path::new("/home/user/Ports/web/emotes/cmu"); if let (Ok(a), Ok(b)) = (std::fs::read(c.join("126_04.bin")), std::fs::read(c.join("79_02.bin"))) { j.nado = Some((a, b)); } }
    let t = Instant::now(); paso(&mut j, &mut m, 1); foto(&mut m, "0_cargando"); paso(&mut j, &mut m, 1); println!("primeros 2 cuadros (cartel y mapa): {:.0} ms · {}", t.elapsed().as_secs_f64() * 1000.0, m.resumen());
    if let Some(mp) = &j.mapa { println!("mundo de choques: {} triángulos, {} cuerpos, gravedad {}", mp.mundo.n_tris(), mp.mundo.cuerpos.len(), mp.mundo.gravedad); }
    paso(&mut j, &mut m, 60);
    println!("1 aparición (1 s de caer al piso): pos {:?} suelo {} · {:.1} ms/cuadro", j.jug.pos, j.jug.suelo, j.ms); foto(&mut m, "1_aparicion");
    // caminar adelante con la palanca 2 s (12 m a 6 m/s)
    let p0 = j.jug.pos;
    j.dedo_abajo(1, wf * 0.15, hf * 0.75, wf, hf); j.dedo_mueve(1, wf * 0.15, hf * 0.75 - hf * 0.12, hf);
    paso(&mut j, &mut m, 120);
    println!("2 caminar 2 s: de {:?} a {:?} ({:.2} m, suelo {})", p0, j.jug.pos, ((j.jug.pos[0] - p0[0]).powi(2) + (j.jug.pos[2] - p0[2]).powi(2)).sqrt(), j.jug.suelo); foto(&mut m, "2_caminar");
    // la cámara: tercera persona caminando y de frente (el cuerpo animado)
    { let (cx, cy) = jxmod::comun::pos_boton(wf, hf, jxmod::comun::Boton::Camara);
      j.dedo_abajo(40, cx, cy, wf, hf); j.dedo_arriba(40); paso(&mut j, &mut m, 20); foto(&mut m, "2b_tercera_caminando");
      j.dedo_abajo(41, cx, cy, wf, hf); j.dedo_arriba(41); paso(&mut j, &mut m, 20); foto(&mut m, "2c_frente_caminando");
      j.dedo_abajo(42, cx, cy, wf, hf); j.dedo_arriba(42); println!("cámara: {} (personaje {})", j.camara, j.pj.is_some()); }
    j.dedo_arriba(1);
    // saltar: el punto más alto
    let y0 = j.jug.pos[1]; let mut ymax = y0;
    let sb = (wf - hf * 0.17, hf - hf * 0.2);
    j.dedo_abajo(7, sb.0, sb.1, wf, hf);
    for _ in 0..90 { paso(&mut j, &mut m, 1); ymax = ymax.max(j.jug.pos[1]); }
    j.dedo_arriba(7); paso(&mut j, &mut m, 60);
    println!("3 saltar: subió {:.3} m (el de la web: 1,1) · suelo {}", ymax - y0, j.jug.suelo); foto(&mut m, "3_saltar");
    // el menú de objetos: abrirlo, tocar tres de la primera subcategoría y cerrarlo
    let toque = |j: &mut Juego, id: i32, x: f32, y: f32| { j.dedo_abajo(id, x, y, wf, hf); j.dedo_arriba_en(id, wf, hf); };
    toque(&mut j, 8, wf - hf * 0.17, hf * 0.27); let t = Instant::now(); paso(&mut j, &mut m, 2); println!("menú abierto (atlas de íconos): {:.0} ms", t.elapsed().as_secs_f64() * 1000.0); foto(&mut m, "3b_menu");
    let (x0, y0, pw) = (wf * 0.04, hf * 0.12, wf * 0.92); let (gx, gy, gw) = (x0 + pw * 0.22, y0 + hf * 0.09, pw * 0.77);
    let cols = ((gw / (hf * 0.19)).floor()).max(1.0); let celda = gw / cols;
    for k in 0..3 { let t = Instant::now(); toque(&mut j, 9 + k, gx + celda * (k as f32 + 0.5), gy + celda * 0.5); paso(&mut j, &mut m, 1); println!("   puesto {}: {:.0} ms", k, t.elapsed().as_secs_f64() * 1000.0); }
    toque(&mut j, 12, x0 + pw - hf * 0.05, y0 + hf * 0.04); paso(&mut j, &mut m, 3);
    println!("objetos puestos: {}", j.objs.iter().map(|o| o.nombre.as_str()).collect::<Vec<_>>().join(", ")); foto(&mut m, "3c_objetos");
    // la física: 8 objetos del menú soltados en torre 5 m adelante (de 2 a 12 m de alto), 3 s; después el jugador camina contra ellos
    {
        let fw = [j.jug.yaw.sin(), 0.0, j.jug.yaw.cos()]; let base = [j.jug.pos[0] + fw[0] * 5.0, j.jug.pos[1], j.jug.pos[2] + fw[2] * 5.0];
        let nombres: Vec<String> = j.catalogo.first().map(|c| c.1.iter().take(8).cloned().collect()).unwrap_or_default();
        for (k, n) in nombres.iter().enumerate() { let _ = j.crear_en(&mut m, n, [base[0], base[1] + 2.0 + k as f32 * 1.4, base[2]], k as f32 * 0.7); }
        let t = Instant::now(); paso(&mut j, &mut m, 1); println!("torre de {} objetos: {:.0} ms (cargar y crear)", nombres.len(), t.elapsed().as_secs_f64() * 1000.0);
        foto(&mut m, "3c1_torre");
        let mut ms = 0f64; for _ in 0..180 { let t = Instant::now(); paso(&mut j, &mut m, 1); ms = ms.max(t.elapsed().as_secs_f64() * 1000.0); }
        let piso = j.mapa.as_ref().and_then(|mp| mp.mundo.rayo([base[0], base[1] + 30.0, base[2]], [0.0, -1.0, 0.0], 80.0)).map(|g| base[1] + 30.0 - g.t).unwrap_or(0.0);
        let dormidos = j.objs.iter().filter(|o| o.cuerpo.and_then(|id| j.fis.cuerpo(id)).map(|b| b.duerme).unwrap_or(false)).count();
        println!("3 s después: {} objetos con cuerpo, {} dormidos, piso a {:.2} m; física {:.2} ms/paso (detección {:.2}, resolver {:.2}); peor cuadro {:.0} ms",
            j.objs.iter().filter(|o| o.cuerpo.is_some()).count(), dormidos, piso, j.fis.ms_det + j.fis.ms_sol, j.fis.ms_det, j.fis.ms_sol, ms);
        for o in &j.objs { if let Some(b) = o.cuerpo.and_then(|id| j.fis.cuerpo(id)) { let a = b.aabb(); println!("   {:<14} masa {:>6.1}  centro [{:.2}, {:.2}, {:.2}]  abajo {:+.3} m del piso{}", o.nombre, b.masa, b.pos[0], b.pos[1], b.pos[2], a[1] - piso as f64, if b.duerme { "  (dormido)" } else { "" }); } }
        foto(&mut m, "3c2_torre_caida");
        // empujar: caminar 2,5 s hacia la pila
        let antes: Vec<[f64; 3]> = j.objs.iter().filter_map(|o| o.cuerpo.and_then(|id| j.fis.cuerpo(id)).map(|b| b.pos)).collect();
        let p0 = j.jug.pos;
        j.dedo_abajo(1, wf * 0.15, hf * 0.75, wf, hf); j.dedo_mueve(1, wf * 0.15, hf * 0.75 - hf * 0.12, hf); paso(&mut j, &mut m, 150); j.dedo_arriba(1);
        let despues: Vec<[f64; 3]> = j.objs.iter().filter_map(|o| o.cuerpo.and_then(|id| j.fis.cuerpo(id)).map(|b| b.pos)).collect();
        let movidos = antes.iter().zip(&despues).filter(|(a, b)| ((a[0] - b[0]).powi(2) + (a[2] - b[2]).powi(2)).sqrt() > 0.05).count();
        println!("empujar 2,5 s: el jugador avanzó {:.2} m (sin nada: 15), alto {:.2} → {:.2}; objetos movidos {}", ((j.jug.pos[0] - p0[0]).powi(2) + (j.jug.pos[2] - p0[2]).powi(2)).sqrt(), p0[1], j.jug.pos[1], movidos);
        foto(&mut m, "3c3_empujar");
        // la Physics Gun: mirar el objeto más cercano, agarrarlo, girar la cámara 60° (lo lleva), congelarlo en el aire
        use jxmod::comun::{pos_boton, Boton};
        let apuntar = |j: &mut Juego, p: [f64; 3]| { let o = [j.jug.pos[0], j.jug.pos[1] + 0.72, j.jug.pos[2]]; let d = [p[0] as f32 - o[0], p[1] as f32 - o[1], p[2] as f32 - o[2]]; let l = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt(); j.jug.yaw = d[0].atan2(d[2]); j.jug.pitch = (d[1] / l).asin(); };
        let cerca = |j: &Juego| -> Option<(u32, [f64; 3])> { j.objs.iter().filter_map(|o| o.cuerpo.and_then(|id| j.fis.cuerpo(id)).map(|b| (b.id, b.pos))).min_by(|a, b| { let d = |p: [f64; 3]| (p[0] - j.jug.pos[0] as f64).powi(2) + (p[2] - j.jug.pos[2] as f64).powi(2); d(a.1).partial_cmp(&d(b.1)).unwrap() }) };
        let pos_de = |j: &Juego, id: u32| j.fis.cuerpo(id).map(|b| b.pos).unwrap_or([0.0; 3]);
        if let Some((id, p)) = cerca(&j) {
            apuntar(&mut j, p); paso(&mut j, &mut m, 2);
            let (bx, by) = pos_boton(wf, hf, Boton::Disparo); toque(&mut j, 30, bx, by);
            println!("Physics Gun: agarrado {:?} (dist {:.2} m) · objeto en {:?}", j.armas.agarre.as_ref().map(|a| a.id), j.armas.agarre.as_ref().map(|a| a.dist).unwrap_or(0.0), p);
            j.jug.pitch += 0.35; paso(&mut j, &mut m, 60); let p1 = pos_de(&j, id); println!("   mirando 20° más arriba 1 s: el objeto subió {:.2} m", p1[1] - p[1]);
            j.jug.yaw += 1.05; paso(&mut j, &mut m, 60); let p2 = pos_de(&j, id); println!("   girando 60° 1 s: se movió {:.2} m de costado", ((p2[0] - p1[0]).powi(2) + (p2[2] - p1[2]).powi(2)).sqrt());
            foto(&mut m, "3c4_physgun");
            let (bx, by) = pos_boton(wf, hf, Boton::Disparo2); toque(&mut j, 31, bx, by); paso(&mut j, &mut m, 120);
            let p3 = pos_de(&j, id); let c = j.fis.cuerpo(id).map(|b| b.congelado).unwrap_or(false);
            println!("   congelado {} · 2 s después sigue en el aire: alto {:.2} → {:.2} m", c, p2[1], p3[1]); foto(&mut m, "3c5_congelado");
            // la Gravity Gun: elegirla en la barra, levantar el objeto del piso más cercano y lanzarlo
            let (ax, ay) = pos_boton(wf, hf, Boton::Arma); toque(&mut j, 32, ax, ay); paso(&mut j, &mut m, 1); foto(&mut m, "3c6_barra");
            let (gx, gy) = pos_boton(wf, hf, Boton::ArmaN(1)); toque(&mut j, 33, gx, gy); paso(&mut j, &mut m, 1);
            println!("Gravity Gun: elegida {}", j.armas.def().nom);
            let otro = j.objs.iter().filter_map(|o| o.cuerpo.and_then(|i| j.fis.cuerpo(i)).filter(|b| b.id != id && !b.congelado).map(|b| (b.id, b.pos))).min_by(|a, b| { let d = |p: [f64; 3]| (p[0] - j.jug.pos[0] as f64).powi(2) + (p[2] - j.jug.pos[2] as f64).powi(2); d(a.1).partial_cmp(&d(b.1)).unwrap() });
            if let Some((id2, q)) = otro {
                let dist = ((q[0] - j.jug.pos[0] as f64).powi(2) + (q[2] - j.jug.pos[2] as f64).powi(2)).sqrt();
                if dist > 20.0 { let k = (dist - 6.0) / dist; j.jug.noclip = true; j.jug.pos[0] += ((q[0] - j.jug.pos[0] as f64) * k) as f32; j.jug.pos[2] += ((q[2] - j.jug.pos[2] as f64) * k) as f32; paso(&mut j, &mut m, 2); j.jug.noclip = false; paso(&mut j, &mut m, 60); }
                apuntar(&mut j, q); paso(&mut j, &mut m, 2);
                let (bx, by) = pos_boton(wf, hf, Boton::Disparo2); toque(&mut j, 34, bx, by); paso(&mut j, &mut m, 60);
                let q1 = pos_de(&j, id2); println!("   levantado {:?}: de {:.2} a {:.2} m de alto", j.armas.grav.as_ref().map(|g| g.id), q[1], q1[1]); foto(&mut m, "3c7_gravgun");
                j.jug.pitch = 0.25; paso(&mut j, &mut m, 10);
                let (bx, by) = pos_boton(wf, hf, Boton::Disparo); toque(&mut j, 35, bx, by); paso(&mut j, &mut m, 2);
                let v = j.fis.cuerpo(id2).map(|b| (b.vel[0].powi(2) + b.vel[1].powi(2) + b.vel[2].powi(2)).sqrt()).unwrap_or(0.0);
                paso(&mut j, &mut m, 60); let q2 = pos_de(&j, id2);
                println!("   lanzado a {:.1} m/s; 1 s después a {:.1} m", v, ((q2[0] - q1[0]).powi(2) + (q2[2] - q1[2]).powi(2)).sqrt()); foto(&mut m, "3c8_lanzado");
            }
            let (ax, ay) = pos_boton(wf, hf, Boton::Arma); toque(&mut j, 36, ax, ay); let (gx, gy) = pos_boton(wf, hf, Boton::ArmaN(0)); toque(&mut j, 37, gx, gy);
            j.jug.pitch = 0.0; paso(&mut j, &mut m, 2);
        }
    }
    // el otro mapa: caminar 6 s para adelante y a la derecha (choca con lo que haya)
    // Ajustes: abrirlo (pausa), calidad Medio, cerrar y ver la escena; abrir otra vez, Ultra, y en «Motor y mapa» el otro mapa
    let (ax, ay) = jxmod::comun::pos_boton(wf, hf, jxmod::comun::Boton::Ajustes);
    toque(&mut j, 20, ax, ay); paso(&mut j, &mut m, 2); foto(&mut m, "3d_ajustes");
    let (x, y) = j.pos_ajuste(wf, hf, 0, Some(0), 2); toque(&mut j, 21, x, y); paso(&mut j, &mut m, 2); foto(&mut m, "3e_ajustes_medio");
    println!("ajustes Medio: {:?}", j.aj);
    toque(&mut j, 22, x0 + pw - hf * 0.05, y0 + hf * 0.04); paso(&mut j, &mut m, 3); foto(&mut m, "3f_escena_medio");
    toque(&mut j, 23, ax, ay); let (x, y) = j.pos_ajuste(wf, hf, 0, Some(0), 4); toque(&mut j, 24, x, y);
    let (x, y) = j.pos_ajuste(wf, hf, 1, None, 0); toque(&mut j, 25, x, y); paso(&mut j, &mut m, 2); foto(&mut m, "3g_ajustes_controles");
    let (x, y) = j.pos_ajuste(wf, hf, 3, None, 0); toque(&mut j, 26, x, y); paso(&mut j, &mut m, 2); foto(&mut m, "3h_ajustes_motor");
    println!("ajustes Ultra: {:?} · abierto {:?}", j.aj, j.ajustes);
    let (x, y) = j.pos_ajuste(wf, hf, 3, Some(1), 1); toque(&mut j, 27, x, y); let t = Instant::now(); paso(&mut j, &mut m, 2); println!("cambio de mapa: {:.0} ms · {}", t.elapsed().as_secs_f64() * 1000.0, m.resumen());
    if let Some(mp) = &j.mapa { println!("mundo de choques: {} triángulos, {} cuerpos", mp.mundo.n_tris(), mp.mundo.cuerpos.len()); }
    paso(&mut j, &mut m, 60); let p0 = j.jug.pos; println!("4 Construct aparición: pos {:?} suelo {}", p0, j.jug.suelo); foto(&mut m, "4_construct");
    j.dedo_abajo(1, wf * 0.15, hf * 0.75, wf, hf); j.dedo_mueve(1, wf * 0.15, hf * 0.75 - hf * 0.12, hf);
    for k in 0..6 { paso(&mut j, &mut m, 60); println!("   {} s: pos [{:.2}, {:.2}, {:.2}] suelo {}", k + 1, j.jug.pos[0], j.jug.pos[1], j.jug.pos[2], j.jug.suelo); }
    j.dedo_arriba(1); foto(&mut m, "5_construct_caminar");
    // al agua: cae desde 4 m sobre el lago, flota, nada 3 s para adelante y bucea 2 s mirando para abajo
    j.jug.noclip = false; j.jug.pos = [90.0, 0.0, -20.0]; j.jug.vel = [0.0; 3]; j.jug.yaw = 0.0; j.jug.pitch = 0.0;
    paso(&mut j, &mut m, 240); println!("6 agua: pos [{:.2}, {:.2}, {:.2}] nada {} (la superficie a -4,06; los ojos a {:.2})", j.jug.pos[0], j.jug.pos[1], j.jug.pos[2], j.jug.nada, j.jug.pos[1] + 0.72);
    j.dedo_abajo(1, wf * 0.15, hf * 0.75, wf, hf); j.dedo_mueve(1, wf * 0.15, hf * 0.75 - hf * 0.12, hf);
    paso(&mut j, &mut m, 180); println!("   nadar 3 s: pos [{:.2}, {:.2}, {:.2}] nada {}", j.jug.pos[0], j.jug.pos[1], j.jug.pos[2], j.jug.nada); foto(&mut m, "6_nadar");
    j.jug.pitch = -0.8; paso(&mut j, &mut m, 120); println!("   bucear 2 s: pos [{:.2}, {:.2}, {:.2}] aire {:.1}", j.jug.pos[0], j.jug.pos[1], j.jug.pos[2], j.jug.aire); foto(&mut m, "7_bucear");
    j.dedo_arriba(1); j.jug.pitch = 0.0;
    if let Some((t, d)) = m.tiempos() { println!("placa {t:.1} ms: {d}"); }
    // la pantalla de error (sin paquete): lo que vería el teléfono si algo falla
    let (lj, lp) = letras(); let mut je = Juego::nuevo(Err("no están pk.bin o pk.idx.json en la APK".into()), lj, lp, Some(datos));
    je.en_uso = j.en_uso;
    paso(&mut je, &mut m, 2); foto(&mut m, "6_error");
}
