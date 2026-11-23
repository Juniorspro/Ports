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
    let t = Instant::now(); paso(&mut j, &mut m, 1); foto(&mut m, "0_cargando"); paso(&mut j, &mut m, 1); println!("primeros 2 cuadros (cartel y mapa): {:.0} ms · {}", t.elapsed().as_secs_f64() * 1000.0, m.resumen());
    if let Some(mp) = &j.mapa { println!("mundo de choques: {} triángulos, {} cuerpos, gravedad {}", mp.mundo.n_tris(), mp.mundo.cuerpos.len(), mp.mundo.gravedad); }
    paso(&mut j, &mut m, 60);
    println!("1 aparición (1 s de caer al piso): pos {:?} suelo {} · {:.1} ms/cuadro", j.jug.pos, j.jug.suelo, j.ms); foto(&mut m, "1_aparicion");
    // caminar adelante con la palanca 2 s (12 m a 6 m/s)
    let p0 = j.jug.pos;
    j.dedo_abajo(1, wf * 0.15, hf * 0.75, wf, hf); j.dedo_mueve(1, wf * 0.15, hf * 0.75 - hf * 0.12, hf);
    paso(&mut j, &mut m, 120);
    println!("2 caminar 2 s: de {:?} a {:?} ({:.2} m, suelo {})", p0, j.jug.pos, ((j.jug.pos[0] - p0[0]).powi(2) + (j.jug.pos[2] - p0[2]).powi(2)).sqrt(), j.jug.suelo); foto(&mut m, "2_caminar");
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
    // el otro mapa: caminar 6 s para adelante y a la derecha (choca con lo que haya)
    let (x0, bw) = (wf * 0.45, wf * 0.55 / 4.0);
    j.dedo_abajo(5, x0 + bw * 3.5, hf * 0.05, wf, hf); j.dedo_arriba(5); let t = Instant::now(); paso(&mut j, &mut m, 2); println!("cambio de mapa: {:.0} ms · {}", t.elapsed().as_secs_f64() * 1000.0, m.resumen());
    if let Some(mp) = &j.mapa { println!("mundo de choques: {} triángulos, {} cuerpos", mp.mundo.n_tris(), mp.mundo.cuerpos.len()); }
    paso(&mut j, &mut m, 60); let p0 = j.jug.pos; println!("4 Construct aparición: pos {:?} suelo {}", p0, j.jug.suelo); foto(&mut m, "4_construct");
    j.dedo_abajo(1, wf * 0.15, hf * 0.75, wf, hf); j.dedo_mueve(1, wf * 0.15, hf * 0.75 - hf * 0.12, hf);
    for k in 0..6 { paso(&mut j, &mut m, 60); println!("   {} s: pos [{:.2}, {:.2}, {:.2}] suelo {}", k + 1, j.jug.pos[0], j.jug.pos[1], j.jug.pos[2], j.jug.suelo); }
    j.dedo_arriba(1); foto(&mut m, "5_construct_caminar");
    if let Some((t, d)) = m.tiempos() { println!("placa {t:.1} ms: {d}"); }
    // la pantalla de error (sin paquete): lo que vería el teléfono si algo falla
    let (lj, lp) = letras(); let mut je = Juego::nuevo(Err("no están pk.bin o pk.idx.json en la APK".into()), lj, lp, Some(datos));
    je.en_uso = j.en_uso;
    paso(&mut je, &mut m, 2); foto(&mut m, "6_error");
}
