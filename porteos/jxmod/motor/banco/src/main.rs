//! Banco de pruebas de JX Motor: dibuja un cuadro exportado por el juego (JXE1) sin ventana —EGL sin superficie de Mesa—,
//! mide cuánto tarda cada cuadro (con glFinish: el tiempo de la placa) y guarda la imagen.
//! uso: jxm-banco ESCENA.jxe|GRABACION.jxg SALIDA.png [ANCHO ALTO] [CUADROS] [perfil: alto|celular|sin] (varios perfiles
//! separados con coma). Con una grabación (JXG1: lo que mandó el juego en modo nativo) se pasan todos sus pedazos en orden
//! —recursos y cuadros— y después se mide el último cuadro.
use glow::HasContext;
use jxmotor::{escena::Escena, gpu::{Motor, Opciones}, proto, wg};
use khronos_egl as egl;
use std::time::Instant;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    if a.len() < 3 { eprintln!("uso: jxm-banco ESCENA.jxe SALIDA.png [ANCHO ALTO] [CUADROS] [perfiles]"); std::process::exit(2); }
    let datos = std::fs::read(&a[1]).expect("no se pudo leer la escena");
    let grab = datos.starts_with(b"JXG1");
    let esc = if grab { None } else { Some(Escena::leer(&datos).expect("escena")) };
    let (w, h) = if a.len() > 4 { (a[3].parse().unwrap(), a[4].parse().unwrap()) } else { esc.as_ref().map(|e| (e.c.w as i32, e.c.h as i32)).unwrap_or((1280, 720)) };
    let n: u32 = a.get(5).and_then(|x| x.parse().ok()).unwrap_or(60);
    let perfiles: Vec<String> = a.get(6).cloned().unwrap_or("alto,celular".into()).split(',').map(|s| s.to_string()).collect();
    if std::env::var("JXM_WGPU").is_ok() { return con_wgpu(&a, &datos, esc.as_ref(), w as u32, h as u32, n, &perfiles); }

    // EGL sin superficie (Mesa): se dibuja en destinos propios
    let e = unsafe { egl::DynamicInstance::<egl::EGL1_5>::load_required() }.expect("libEGL");
    const PLATAFORMA_SIN_SUPERFICIE: egl::Enum = 0x31DD;
    let d = unsafe { e.get_platform_display(PLATAFORMA_SIN_SUPERFICIE, egl::DEFAULT_DISPLAY, &[egl::ATTRIB_NONE]) }.expect("pantalla EGL");
    let (ma, mi) = e.initialize(d).expect("eglInitialize");
    e.bind_api(egl::OPENGL_ES_API).unwrap();
    let cfg = e.choose_first_config(d, &[egl::SURFACE_TYPE, egl::PBUFFER_BIT, egl::RENDERABLE_TYPE, egl::OPENGL_ES3_BIT, egl::NONE]).unwrap()
        .or_else(|| e.choose_first_config(d, &[egl::RENDERABLE_TYPE, egl::OPENGL_ES2_BIT, egl::NONE]).unwrap())
        .or_else(|| e.choose_first_config(d, &[egl::NONE]).unwrap())
        .unwrap_or_else(|| { eprintln!("sin configuraciones EGL ({} en total)", e.get_config_count(d).unwrap_or(0)); std::process::exit(1) });
    let ctx = e.create_context(d, cfg, None, &[egl::CONTEXT_MAJOR_VERSION, 3, egl::CONTEXT_MINOR_VERSION, 0, egl::NONE]).expect("contexto GLES 3");
    e.make_current(d, None, None, Some(ctx)).expect("make_current");
    let gl = unsafe { glow::Context::from_loader_function(|s| e.get_proc_address(s).map_or(std::ptr::null(), |p| p as *const _)) };
    let (ven, ren, ver) = unsafe { (gl.get_parameter_string(glow::VENDOR), gl.get_parameter_string(glow::RENDERER), gl.get_parameter_string(glow::VERSION)) };
    println!("EGL {ma}.{mi} · {ren} ({ven}) · {ver}");

    // la salida: un destino de w × h
    let (fb, col) = unsafe {
        let t = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(t)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::RGBA8, w, h);
        let f = gl.create_framebuffer().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::RENDERBUFFER, Some(t));
        (f, t)
    };
    let _ = col;
    let t0 = Instant::now();
    let mut m = unsafe { Motor::nuevo(gl, Opciones::default()) }.expect("motor");
    if let Some(e) = &esc {
        unsafe { m.cargar(e) }.expect("recursos");
        m.poner_cuadro(e.cuadro().expect("la escena no trae cámara"));
    } else {
        // la grabación: cada pedazo en orden, dibujando cada cuadro (como en el juego)
        let ps = proto::pedazos(&datos).expect("grabación");
        let (mut nr, mut nc, mut tr, mut tc) = (0, 0, 0.0, vec![]);
        for p in &ps {
            let t = Instant::now();
            unsafe { proto::aplicar(&mut m, p) }.expect("pedazo");
            match p {
                proto::Pedazo::Cuadro(_) => { unsafe { m.dibujar(Some(fb), w, h); m.gl.finish(); } nc += 1; tc.push(t.elapsed().as_secs_f64() * 1000.0); }
                proto::Pedazo::Recursos(_) => { unsafe { m.gl.finish(); } nr += 1; tr += t.elapsed().as_secs_f64() * 1000.0; }
                _ => {}
            }
        }
        let prom = tc.iter().sum::<f64>() / tc.len().max(1) as f64;
        println!("grabación: {} pedazos de recursos ({:.0} ms en subirlos) · {} cuadros ({:.2} ms/cuadro con lo que llega) · {:.1} MB", nr, tr, nc, prom, datos.len() as f64 / 1e6);
    }
    println!("{} · cargado en {:.0} ms · {}x{}", m.resumen(), t0.elapsed().as_secs_f64() * 1000.0, w, h);
    for p in &perfiles {
        m.op = match p.as_str() { "celular" => Opciones::celular_flojo(), "sin" => Opciones { sombras: false, reflejo: false, ..Opciones::default() }, _ => Opciones::default() };
        unsafe { for _ in 0..3 { m.dibujar(Some(fb), w, h); } m.gl.finish(); }
        let mut tiempos = vec![]; let mut dibujos = 0;
        for _ in 0..n { let t = Instant::now(); unsafe { m.dibujar(Some(fb), w, h); m.gl.finish(); } tiempos.push(t.elapsed().as_secs_f64() * 1000.0); dibujos = m.dibujos; }
        tiempos.sort_by(|x, y| x.partial_cmp(y).unwrap());
        let prom = tiempos.iter().sum::<f64>() / tiempos.len() as f64;
        println!("perfil {p:8} · {:.2} ms/cuadro (mediana {:.2}, peor 5 % {:.2}) · {:.0} cuadros/s · {} dibujos · {:?}", prom, tiempos[tiempos.len() / 2], tiempos[(tiempos.len() * 95 / 100).min(tiempos.len() - 1)], 1000.0 / prom, dibujos, m.op);
        // la imagen
        let mut px = vec![0u8; (w * h * 4) as usize];
        unsafe { m.gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb)); m.gl.read_pixels(0, 0, w, h, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelPackData::Slice(Some(&mut px))); }
        let fila = (w * 4) as usize; let mut dado = vec![0u8; px.len()];
        for y in 0..h as usize { dado[y * fila..(y + 1) * fila].copy_from_slice(&px[(h as usize - 1 - y) * fila..(h as usize - y) * fila]); }
        let ruta = if perfiles.len() > 1 { a[2].replace(".png", &format!("_{p}.png")) } else { a[2].clone() };
        let f = std::fs::File::create(&ruta).unwrap(); let mut enc = png::Encoder::new(std::io::BufWriter::new(f), w as u32, h as u32);
        enc.set_color(png::ColorType::Rgba); enc.set_depth(png::BitDepth::Eight); enc.write_header().unwrap().write_image_data(&dado).unwrap();
        println!("  → {ruta}");
    }
}

/// el mismo banco con el motor de wgpu: Vulkan (en la compu, el de Mesa: lavapipe) o, con JXM_GL=1, GLES
fn con_wgpu(a: &[String], datos: &[u8], esc: Option<&Escena>, w: u32, h: u32, n: u32, perfiles: &[String]) {
    let back = if std::env::var("JXM_GL").is_ok() { wgpu::Backends::GL } else { wgpu::Backends::VULKAN };
    let inst = wgpu::Instance::new(wgpu::InstanceDescriptor { backends: back, ..wgpu::InstanceDescriptor::new_without_display_handle() });
    let (_ad, d, q, placa) = wg::placa(&inst, None).expect("placa");
    println!("wgpu · {placa}");
    let fmt = wgpu::TextureFormat::Rgba8Unorm;
    let sal = d.create_texture(&wgpu::TextureDescriptor { label: Some("salida"), size: wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 }, mip_level_count: 1, sample_count: 1,
        dimension: wgpu::TextureDimension::D2, format: fmt, usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::COPY_SRC, view_formats: &[] });
    let sv = sal.create_view(&wgpu::TextureViewDescriptor::default());
    let esperar = |d: &wgpu::Device| { let _ = d.poll(wgpu::PollType::wait_indefinitely()); };
    let t0 = Instant::now();
    let mut m = wg::Motor::nuevo(d.clone(), q.clone(), Opciones::default(), placa).expect("motor");
    if let Some(e) = esc {
        m.cargar(e).expect("recursos"); m.poner_cuadro(e.cuadro().expect("la escena no trae cámara"));
    } else {
        let ps = proto::pedazos(datos).expect("grabación");
        let (mut nr, mut nc, mut tr, mut tc) = (0, 0, 0.0, vec![]);
        for p in &ps {
            let t = Instant::now();
            unsafe { proto::aplicar(&mut m, p) }.expect("pedazo");
            match p {
                proto::Pedazo::Cuadro(_) => { m.dibujar(&sv, fmt, w, h); esperar(&d); nc += 1; tc.push(t.elapsed().as_secs_f64() * 1000.0); }
                proto::Pedazo::Recursos(_) => { esperar(&d); nr += 1; tr += t.elapsed().as_secs_f64() * 1000.0; }
                _ => {}
            }
        }
        let prom = tc.iter().sum::<f64>() / tc.len().max(1) as f64;
        println!("grabación: {} pedazos de recursos ({:.0} ms en subirlos) · {} cuadros ({:.2} ms/cuadro con lo que llega) · {:.1} MB", nr, tr, nc, prom, datos.len() as f64 / 1e6);
    }
    println!("{} · cargado en {:.0} ms · {}x{}", m.resumen(), t0.elapsed().as_secs_f64() * 1000.0, w, h);
    if let Some(e) = m.error() { println!("ERROR DE LA PLACA: {e}"); }
    for p in perfiles {
        m.op = match p.as_str() { "celular" => Opciones::celular_flojo(), "sin" => Opciones { sombras: false, reflejo: false, ..Opciones::default() }, _ => Opciones::default() };
        for _ in 0..3 { m.dibujar(&sv, fmt, w, h); } esperar(&d);
        let mut tiempos = vec![]; let mut dibujos = 0;
        for _ in 0..n { let t = Instant::now(); m.dibujar(&sv, fmt, w, h); esperar(&d); tiempos.push(t.elapsed().as_secs_f64() * 1000.0); dibujos = m.dibujos; }
        tiempos.sort_by(|x, y| x.partial_cmp(y).unwrap());
        let prom = tiempos.iter().sum::<f64>() / tiempos.len() as f64;
        println!("perfil {p:8} · {:.2} ms/cuadro (mediana {:.2}, peor 5 % {:.2}) · {:.0} cuadros/s · {} dibujos", prom, tiempos[tiempos.len() / 2], tiempos[(tiempos.len() * 95 / 100).min(tiempos.len() - 1)], 1000.0 / prom, dibujos);
        if let Some((tot, t)) = m.tiempos_placa() { println!("  placa {tot:.2} ms: {t}"); }
        // la imagen: de la placa a un búfer (filas de a 256 bytes) y a PNG
        let fila = (w * 4 + 255) / 256 * 256;
        let buf = d.create_buffer(&wgpu::BufferDescriptor { label: None, size: (fila * h) as u64, usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ, mapped_at_creation: false });
        let mut enc = d.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: None });
        enc.copy_texture_to_buffer(sal.as_image_copy(), wgpu::TexelCopyBufferInfo { buffer: &buf, layout: wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(fila), rows_per_image: Some(h) } }, wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 });
        q.submit(Some(enc.finish()));
        buf.slice(..).map_async(wgpu::MapMode::Read, |_| {}); esperar(&d);
        let v = buf.slice(..).get_mapped_range().expect("lectura"); let mut px = vec![0u8; (w * h * 4) as usize];
        for y in 0..h as usize { px[y * w as usize * 4..(y + 1) * w as usize * 4].copy_from_slice(&v[y * fila as usize..y * fila as usize + w as usize * 4]); }
        drop(v); buf.unmap();
        let ruta = if perfiles.len() > 1 { a[2].replace(".png", &format!("_{p}.png")) } else { a[2].clone() };
        let f = std::fs::File::create(&ruta).unwrap(); let mut enc = png::Encoder::new(std::io::BufWriter::new(f), w, h);
        enc.set_color(png::ColorType::Rgba); enc.set_depth(png::BitDepth::Eight); enc.write_header().unwrap().write_image_data(&px).unwrap();
        println!("  → {ruta}");
    }
}
