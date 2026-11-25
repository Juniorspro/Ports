//! Las fotos del inicio y de los menús (inicio_juego.rs, paneles_juego.rs, pausa_juego.rs) con el mismo juego de la app,
//! tocando de verdad (dedo_abajo / dedo_arriba_en en el centro de cada cosa), para compararlas con las de la web. Escribe
//! también las medidas del menú clásico (medidas_<tamaño>.json) para compararlas con las de la web (clEncajar).
//! Uso: menus_foto CARPETA [ANCHOxALTO,…]   (JXM_MOTOR=vk|gl2; JXM_MENUS: la carpeta con ui/menus.*, fondos/ y carga/;
//! JXM_SOLO=home,paneles,pausa para hacer sólo eso; JXM_IDIOMA=en, ja, ar…: en ese idioma)
use glow::HasContext;
use jxjuego::paquete::Paquete;
use jxmod::comun::{Juego, Placa};
use jxmod::comun::inicio_juego::Pieza;
use jxmod::motor::Motor3d;
use jxmotor::gpu::{Motor, Opciones};
use khronos_egl as egl;
use std::path::Path;
use std::time::Instant;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let sal = a.get(1).cloned().unwrap_or("/tmp/claude-0/menus_fotos/nativo".into()); std::fs::create_dir_all(&sal).unwrap();
    let tams: Vec<(i32, i32)> = a.get(2).cloned().unwrap_or("1280x590".into()).split(',').map(|t| { let v: Vec<i32> = t.split('x').map(|x| x.parse().unwrap()).collect(); (v[0], v[1]) }).collect();
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxm/www_todo".into());
    let let_ = std::env::var("JXM_LETRAS").unwrap_or("/tmp/claude-0/jxm/letras".into());
    let menus = std::env::var("JXM_MENUS").unwrap_or("/tmp/claude-0/menus_activos".into());
    let motor = std::env::var("JXM_MOTOR").unwrap_or_default(); let vk = motor == "vk"; let gl2 = motor == "gl2";
    let solo = std::env::var("JXM_SOLO").unwrap_or_default(); let hace = |k: &str| solo.is_empty() || solo.split(',').any(|s| s == k);
    let pre = if vk { "vk" } else if gl2 { "gl2" } else { "gl3" };
    let (mw, mh) = tams.iter().fold((0, 0), |a, t| (a.0.max(t.0), a.1.max(t.1)));
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
    let t0 = Instant::now();
    let paq = Paquete::abrir(Path::new(&www));
    println!("paquete: {:.0} ms · {placa}", t0.elapsed().as_secs_f64() * 1000.0);
    let datos = std::env::temp_dir().join("jxm_menus_datos"); let _ = std::fs::create_dir_all(&datos); for n in ["mapa.txt", "ajustes.txt", "skin.txt", "nombre.txt"] { let _ = std::fs::remove_file(datos.join(n)); }
    let _ = std::fs::write(datos.join("nombre.txt"), "NijulaX");
    let lj = std::fs::read_to_string(Path::new(&let_).join("letras.json")).ok(); let lp = std::fs::read(Path::new(&let_).join("letras.png")).ok();
    let mut j = Juego::nuevo(paq, lj, lp, Some(datos.clone()));
    // (JXM_IDIOMA=en|ja|ar…: las fotos en ese idioma)
    if let Some(i) = std::env::var("JXM_IDIOMA").ok().and_then(|c| jxjuego::idiomas::de_codigo(&c)) { jxjuego::idiomas::poner(i); }
    j.dt_fijo = Some(1.0 / 60.0); j.en_uso = if vk { Placa::Vulkan } else if gl2 { Placa::Gl2 } else { Placa::Gl3 };
    let base = menus.clone(); j.inicio_lector(Box::new(move |n| std::fs::read(Path::new(&base).join(n)).ok()));
    let mut tam_vk = (mw, mh);
    for (w, h) in tams {
        // (Vulkan dibuja del tamaño en que se creó: cada tamaño con su motor)
        if vk && (w, h) != tam_vk { drop(m); m = Motor3d::Vk(unsafe { jxmotor::vk::Motor::nuevo(None, w as u32, h as u32, Opciones::default()) }.expect("Vulkan")); tam_vk = (w, h); j.al_abrir(); }
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
            let ruta = format!("{sal}/{pre}_{w}x{h}_{nombre}.png");
            let f = std::fs::File::create(&ruta).unwrap(); let mut enc = png::Encoder::new(std::io::BufWriter::new(f), w as u32, h as u32);
            enc.set_color(png::ColorType::Rgba); enc.set_depth(png::BitDepth::Eight); enc.write_header().unwrap().write_image_data(&dado).unwrap();
            println!("  → {ruta}");
        };
        // tocar: abajo y arriba en el mismo lugar (con un cuadro en el medio, como un dedo de verdad)
        let tocar = |j: &mut Juego, m: &mut Motor3d, x: f32, y: f32| { j.dedo_abajo(7, x, y, wf, hf); paso(j, m, 1); j.dedo_arriba_en(7, wf, hf); paso(j, m, 1); };
        let centro = |r: [f32; 4]| (r[0] + r[2] / 2.0, r[1] + r[3] / 2.0);
        j.inicio_abrir(); j.ini.fondo_quieto();
        if hace("home") {
            paso(&mut j, &mut m, 1);
            paso(&mut j, &mut m, 17); foto(&mut m, "entrada_03");
            paso(&mut j, &mut m, 120); foto(&mut m, "home");
            // (lo que se toca del inicio, para medirlo)
            let zs: Vec<String> = j.ini.zonas.iter().map(|(r, a)| format!("{{\"r\":[{:.1},{:.1},{:.1},{:.1}],\"a\":\"{:?}\"}}", r[0], r[1], r[2], r[3], a)).collect();
            std::fs::write(format!("{sal}/{pre}_{w}x{h}_home_zonas.json"), format!("[{}]", zs.join(","))).unwrap();
            // (apretar una opción: la fila de vidrio)
            if let Some(b) = j.ini_zona(Pieza::Op(1)) { let (x, y) = centro(b); j.dedo_abajo(7, x, y, wf, hf); paso(&mut j, &mut m, 5); foto(&mut m, "apretada"); j.dedo_arriba(7); j.ini.elegir(None); paso(&mut j, &mut m, 30); }
            // (el glitch del logo)
            j.ini.glitch_forzar(); paso(&mut j, &mut m, 6); foto(&mut m, "glitch"); paso(&mut j, &mut m, 30);
        } else { paso(&mut j, &mut m, 100); }
        if hace("contenido") {
            // (la ventana del contenido con bajadas de mentira: cada archivo tarda 4 s y sale «bajado» —los .rbp no pasan la huella—)
            use jxmod::comun::contenido_juego::AccC;
            let dir = std::env::temp_dir().join("jxm_cont_prueba"); let _ = std::fs::remove_dir_all(&dir);
            let bajar: jxmod::bajas::Bajar = std::sync::Arc::new(|_u: &str, a: &Path, prog: &dyn Fn(u64, u64)| { let tot = 4_000_000u64;
                for i in 0..=40 { prog(tot * i / 40, tot); std::thread::sleep(std::time::Duration::from_millis(100)); } std::fs::write(a, b"x").map_err(|e| e.to_string())?; Ok(200) });
            j.bajas = Some(jxmod::bajas::Bajas::nueva(dir, Some(bajar)));
            j.cont_abrir(); paso(&mut j, &mut m, 30); foto(&mut m, "contenido");
            let toca = |j: &mut Juego, m: &mut Motor3d, a: AccC| { if let Some((r, _)) = j.cont.zonas.iter().find(|z| z.1 == a).cloned() { let (x, y) = centro(r); tocar(j, m, x, y); true } else { println!("contenido: no está {a:?}"); false } };
            toca(&mut j, &mut m, AccC::Marcar(3)); toca(&mut j, &mut m, AccC::Bajar);
            std::thread::sleep(std::time::Duration::from_millis(1800)); paso(&mut j, &mut m, 20); foto(&mut m, "contenido_bajando");
            toca(&mut j, &mut m, AccC::Fondo); paso(&mut j, &mut m, 20); foto(&mut m, "contenido_barra");
            j.bajas = None; j.cont = Default::default();
        }
        // (JXM_LAN=1: una partida de otro celular en el Wi-Fi, para ver que aparece en la lista de Buscar partida)
        let _lan = if std::env::var("JXM_LAN").is_ok() { jxmod::lan::Anfitrion::empezar(&serde_json::json!({ "du": "juan12345", "n": "Juan", "s": "Juan · LAN", "m": "RB_Construct", "p": jxmod::lan::PUERTO })).ok() } else { None };
        if hace("paneles") {
            // (cada opción del menú y lo de arriba, tocando en el centro; la foto con la entrada terminada; y volver)
            let nombres = ["nueva", "multi", "social", "tienda", "crear", "personajes", "opciones"];
            for (i, n) in nombres.iter().enumerate() {
                let Some(b) = j.ini_zona(Pieza::Op(i)) else { continue }; let (x, y) = centro(b); tocar(&mut j, &mut m, x, y);
                paso(&mut j, &mut m, 70); if *n == "multi" && _lan.is_some() { std::thread::sleep(std::time::Duration::from_millis(1500)); paso(&mut j, &mut m, 10); } foto(&mut m, n);
                // (lo que se toca en el panel, para medirlo: tamaños, que no se pisen y que estén adentro de la pantalla)
                let zs: Vec<String> = j.ini.pn.zonas.iter().map(|(r, a)| format!("{{\"r\":[{:.1},{:.1},{:.1},{:.1}],\"a\":\"{:?}\"}}", r[0], r[1], r[2], r[3], a).replace("\\\"", "'")).collect();
                std::fs::write(format!("{sal}/{pre}_{w}x{h}_{n}_zonas.json"), format!("[{}]", zs.join(","))).unwrap();
                if *n == "multi" { // (Crear server: el formulario, elegir cosas y volver a la lista)
                    use jxmod::comun::paneles_juego::Acc;
                    let toca = |j: &mut Juego, m: &mut Motor3d, a: Acc| { if let Some((r, _)) = j.ini.pn.zonas.iter().find(|z| z.1 == a).cloned() { let (x, y) = centro(r); tocar(j, m, x, y); true } else { false } };
                    if toca(&mut j, &mut m, Acc::CrearServer) { paso(&mut j, &mut m, 70); foto(&mut m, "crear_server");
                        for a in [Acc::SrvModo(true), Acc::SrvTg(1), Acc::SrvTg(2), Acc::SrvPaso(0, 1), Acc::SrvPaso(1, -1), Acc::Mapa("RB_Construct".into())] { let ok = toca(&mut j, &mut m, a.clone()); if !ok { println!("crear server: no está {a:?}"); } }
                        paso(&mut j, &mut m, 4); foto(&mut m, "crear_server_elegido");
                        println!("crear server: {:?} · mapa {:?}", j.ini.pn.srv, j.ini.pn.mapa);
                        toca(&mut j, &mut m, Acc::Volver); paso(&mut j, &mut m, 40); }
                }
                if *n == "nueva" { // (elegir el otro mapa)
                    if let Some((r, _)) = j.ini.pn.zonas.iter().find(|z| matches!(&z.1, jxmod::comun::paneles_juego::Acc::Mapa(mp) if mp == "RB_Construct")).cloned() { let (x, y) = centro(r); tocar(&mut j, &mut m, x, y); paso(&mut j, &mut m, 4); foto(&mut m, "nueva_construct"); } }
                if let Some((r, _)) = j.ini.pn.zonas.iter().find(|z| matches!(z.1, jxmod::comun::paneles_juego::Acc::Volver | jxmod::comun::paneles_juego::Acc::Listo)).cloned() { let (x, y) = centro(r); tocar(&mut j, &mut m, x, y); }
                paso(&mut j, &mut m, 40);
            }
            for (k, n) in [(Pieza::Avisos, "avisos"), (Pieza::Bugs, "bugs"), (Pieza::Grieta, "grieta")] {
                let Some(r) = j.ini_zona(k) else { continue }; let (x, y) = centro(r); tocar(&mut j, &mut m, x, y); paso(&mut j, &mut m, 60); foto(&mut m, n);
                if n == "bugs" { if let Some((r, _)) = j.ini.pn.zonas.iter().find(|z| z.1 == jxmod::comun::paneles_juego::Acc::Tab(2)).cloned() { let (x, y) = centro(r); tocar(&mut j, &mut m, x, y); paso(&mut j, &mut m, 50); foto(&mut m, "novedades"); } }
                if let Some((r, _)) = j.ini.pn.zonas.iter().find(|z| z.1 == jxmod::comun::paneles_juego::Acc::Volver).cloned() { let (x, y) = centro(r); tocar(&mut j, &mut m, x, y); }
                paso(&mut j, &mut m, 30);
            }
            if let Some(r) = j.ini_zona(Pieza::Idioma) { let (x, y) = centro(r); tocar(&mut j, &mut m, x, y); paso(&mut j, &mut m, 60); foto(&mut m, "idioma");
                if let Some((r, _)) = j.ini.pn.zonas.iter().find(|z| z.1 == jxmod::comun::paneles_juego::Acc::Volver).cloned() { let (x, y) = centro(r); tocar(&mut j, &mut m, x, y); } paso(&mut j, &mut m, 30); }
        }
        if hace("pausa") {
            // (empezar la partida desde «Empezar partida nueva»: la pantalla de carga, el juego con el botón de pausa y la pausa)
            if let Some(b) = j.ini_zona(Pieza::Op(0)) { let (x, y) = centro(b); tocar(&mut j, &mut m, x, y); } paso(&mut j, &mut m, 30);
            if let Some((r, _)) = j.ini.pn.zonas.iter().find(|z| z.1 == jxmod::comun::paneles_juego::Acc::Empezar).cloned() { let (x, y) = centro(r); j.dedo_abajo(7, x, y, wf, hf); paso(&mut j, &mut m, 1); j.dedo_arriba_en(7, wf, hf);
                paso(&mut j, &mut m, 1); foto(&mut m, "carga"); }
            paso(&mut j, &mut m, 90); foto(&mut m, "juego");
            let (cx, cy, _) = jxmod::comun::pausa_juego::boton_pausa(wf, hf); tocar(&mut j, &mut m, cx, cy); paso(&mut j, &mut m, 30); foto(&mut m, "pausa");
            // (Personaje desde la pausa, y volver; después «Salir al menú»)
            let zona = |j: &Juego, p: jxmod::comun::pausa_juego::Pz| j.ini.pz_zona(p);
            if let Some(r) = zona(&j, jxmod::comun::pausa_juego::Pz::Personaje) { let (x, y) = centro(r); tocar(&mut j, &mut m, x, y); paso(&mut j, &mut m, 60); foto(&mut m, "pausa_personajes");
                if let Some((r, _)) = j.ini.pn.zonas.iter().find(|z| z.1 == jxmod::comun::paneles_juego::Acc::Volver).cloned() { let (x, y) = centro(r); tocar(&mut j, &mut m, x, y); } paso(&mut j, &mut m, 20); }
            if let Some(r) = zona(&j, jxmod::comun::pausa_juego::Pz::Salir) { let (x, y) = centro(r); tocar(&mut j, &mut m, x, y); paso(&mut j, &mut m, 120); foto(&mut m, "vuelta_menu"); }
        }
        if let Some(e) = &j.error { println!("ERROR: {e}"); }
    }
    println!("listo en {:.1} s", t0.elapsed().as_secs_f32());
}
