//! La prueba en la compu: el mismo juego de la app (comun.rs) dibujado fuera de pantalla con OpenGL ES 3 (Mesa), con
//! toques de mentira, y fotos de cada momento. Uso: foto CARPETA_SALIDA [ANCHO ALTO]
//!   JXM_WWW: la carpeta del paquete (pk.bin, pk.idx.json, rb/); JXM_LETRAS: la de letras.png y letras.json
use glow::HasContext;
use jxjuego::paquete::Paquete;
use jxmod::comun::Juego;
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
    let t = Instant::now();
    let paq = Paquete::abrir(Path::new(&www));
    println!("paquete: {:.0} ms", t.elapsed().as_secs_f64() * 1000.0);
    let datos = std::env::temp_dir().join("jxm_nativo_datos"); let _ = std::fs::create_dir_all(&datos);
    let letras = || (std::fs::read_to_string(Path::new(&let_).join("letras.json")).ok(), std::fs::read(Path::new(&let_).join("letras.png")).ok());
    let (lj, lp) = letras(); let mut j = Juego::nuevo(paq, lj, lp, Some(datos.clone()));
    j.dt_fijo = Some(1.0 / 60.0);

    let e = unsafe { egl::DynamicInstance::<egl::EGL1_5>::load_required() }.expect("libEGL");
    let d = unsafe { e.get_platform_display(0x31DD, egl::DEFAULT_DISPLAY, &[egl::ATTRIB_NONE]) }.expect("pantalla EGL");
    e.initialize(d).unwrap(); e.bind_api(egl::OPENGL_ES_API).unwrap();
    let cfg = e.choose_first_config(d, &[egl::SURFACE_TYPE, egl::PBUFFER_BIT, egl::RENDERABLE_TYPE, egl::OPENGL_ES3_BIT, egl::NONE]).unwrap().or_else(|| e.choose_first_config(d, &[egl::NONE]).unwrap()).unwrap();
    let ctx = e.create_context(d, cfg, None, &[egl::CONTEXT_MAJOR_VERSION, 3, egl::NONE]).unwrap();
    e.make_current(d, None, None, Some(ctx)).unwrap();
    let gl = unsafe { glow::Context::from_loader_function(|s| e.get_proc_address(s).map_or(std::ptr::null(), |p| p as *const _)) };
    let placa = unsafe { gl.get_parameter_string(glow::RENDERER) };
    let fb = unsafe {
        let t = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(t)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::RGBA8, w, h);
        let f = gl.create_framebuffer().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::RENDERBUFFER, Some(t)); f
    };
    let mut m = unsafe { Motor::nuevo(gl, Opciones::default()) }.expect("motor");
    let (wf, hf) = (w as f32, h as f32);
    let paso = |j: &mut Juego, m: &mut Motor, n: usize| { for _ in 0..n { let t = Instant::now(); unsafe { j.cuadro(m, Some(fb), w, h, &placa); m.gl.finish(); } j.medir(t.elapsed().as_secs_f32() * 1000.0); } };
    let foto = |m: &Motor, nombre: &str| {
        let mut px = vec![0u8; (w * h * 4) as usize];
        unsafe { m.gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb)); m.gl.read_pixels(0, 0, w, h, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelPackData::Slice(Some(&mut px))); }
        let fila = (w * 4) as usize; let mut dado = vec![0u8; px.len()];
        for y in 0..h as usize { dado[y * fila..(y + 1) * fila].copy_from_slice(&px[(h as usize - 1 - y) * fila..(h as usize - y) * fila]); }
        let ruta = format!("{sal}/{nombre}.png");
        let f = std::fs::File::create(&ruta).unwrap(); let mut enc = png::Encoder::new(std::io::BufWriter::new(f), w as u32, h as u32);
        enc.set_color(png::ColorType::Rgba); enc.set_depth(png::BitDepth::Eight); enc.write_header().unwrap().write_image_data(&dado).unwrap();
        println!("  → {ruta}");
    };
    let t = Instant::now(); paso(&mut j, &mut m, 1); foto(&m, "0_cargando"); paso(&mut j, &mut m, 1); println!("primeros 2 cuadros (cartel y mapa): {:.0} ms · {}", t.elapsed().as_secs_f64() * 1000.0, m.resumen());
    paso(&mut j, &mut m, 30);
    println!("1 aparición: pos {:?} yaw {:.2} · {:.1} ms/cuadro", j.pos, j.yaw, j.ms); foto(&m, "1_aparicion");
    // caminar adelante con la palanca y mirar a la derecha
    j.dedo_abajo(1, wf * 0.15, hf * 0.75, wf, hf); j.dedo_mueve(1, wf * 0.15, hf * 0.75 - hf * 0.2, hf);
    j.dedo_abajo(2, wf * 0.7, hf * 0.6, wf, hf); j.dedo_mueve(2, wf * 0.7 - 150.0, hf * 0.6 + 30.0, hf);
    paso(&mut j, &mut m, 60);
    println!("2 palanca: pos {:?} yaw {:.2} pitch {:.2}", j.pos, j.yaw, j.pitch); foto(&m, "2_palanca");
    j.dedo_arriba(1); j.dedo_arriba(2);
    // el botón de OpenGL 2 (todavía no está: avisa) y el de cambiar de mapa
    let (x0, bw) = (wf * 0.45, wf * 0.55 / 4.0);
    j.dedo_abajo(3, x0 + bw * 2.5, hf * 0.05, wf, hf); paso(&mut j, &mut m, 2); foto(&m, "3_boton_gl2");
    j.dedo_abajo(4, x0 + bw * 1.5, hf * 0.05, wf, hf);
    j.dedo_abajo(5, x0 + bw * 3.5, hf * 0.05, wf, hf); let t = Instant::now(); paso(&mut j, &mut m, 2); println!("cambio de mapa: {:.0} ms · {}", t.elapsed().as_secs_f64() * 1000.0, m.resumen());
    paso(&mut j, &mut m, 30); println!("4 otro mapa: pos {:?} · {:.1} ms/cuadro", j.pos, j.ms); foto(&m, "4_construct");
    // la pantalla de error (sin paquete): lo que vería el teléfono si algo falla
    let (lj, lp) = letras(); let mut je = Juego::nuevo(Err("no están pk.bin o pk.idx.json en la APK".into()), lj, lp, Some(datos));
    paso(&mut je, &mut m, 2); foto(&m, "5_error");
}
