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
    // (JXM_WS_MAPAS=carpeta: los .gma de ahí como addons bajados —para ver los mapas bajados en Partida nueva—)
    let _ = std::fs::remove_dir_all(datos.join("addons"));
    if let Ok(c) = std::env::var("JXM_WS_MAPAS") { let _ = std::fs::create_dir_all(datos.join("addons")); for e in std::fs::read_dir(&c).unwrap().flatten() { if e.path().extension().map_or(false, |x| x == "gma") { let _ = std::os::unix::fs::symlink(e.path(), datos.join("addons").join(e.file_name())); } } }
    let lj = std::fs::read_to_string(Path::new(&let_).join("letras.json")).ok(); let lp = std::fs::read(Path::new(&let_).join("letras.png")).ok();
    let mut j = Juego::nuevo(paq, lj, lp, Some(datos.clone()));
    // (JXM_RED=1: la conexión con curl —Bugs y sugerencias trae lo publicado de verdad—)
    if std::env::var("JXM_RED").is_ok() { j.gmod.http_bin = Some(std::sync::Arc::new(|u: &str| {
        let o = std::process::Command::new("curl").args(["-s", "--max-time", "30", "-w", "\n%{http_code}", u]).output().map_err(|e| e.to_string())?;
        let mut b = o.stdout; let i = b.iter().rposition(|c| *c == b'\n').unwrap_or(0); let cod: u16 = String::from_utf8_lossy(&b[i + 1..]).trim().parse().unwrap_or(0); b.truncate(i); Ok((cod, b)) })); }
    // (JXM_RED=1 también para la cuenta y lo social: los pedidos con método, encabezados y cuerpo, por curl)
    if std::env::var("JXM_RED").is_ok() { j.soc.http = Some(std::sync::Arc::new(|met: &str, u: &str, cab: &[(String, String)], cuerpo: Option<&str>| {
        let mut c = std::process::Command::new("curl"); c.args(["-s", "--max-time", "30", "-w", "\n%{http_code}", "-X", met, u]);
        for (k, v) in cab { c.arg("-H").arg(format!("{k}: {v}")); } if let Some(b) = cuerpo { c.arg("--data-binary").arg(b); }
        let o = c.output().map_err(|e| e.to_string())?; let mut b = o.stdout; let i = b.iter().rposition(|x| *x == b'\n').unwrap_or(0);
        let cod: u16 = String::from_utf8_lossy(&b[i + 1..]).trim().parse().unwrap_or(0); b.truncate(i); if cod == 0 { return Err("sin respuesta".into()); } Ok((cod, String::from_utf8_lossy(&b).into_owned())) })); }
    // (JXM_IDIOMA=en|ja|ar…: las fotos en ese idioma)
    if let Some(i) = std::env::var("JXM_IDIOMA").ok().and_then(|c| jxjuego::idiomas::de_codigo(&c)) { jxjuego::idiomas::poner(i); }
    // (JXM_MUSICA=1: la placa de lo que suena —acá no hay sonido—)
    if std::env::var("JXM_MUSICA").is_ok() { j.musica.sonando = Some("Airport Lounge".into()); }
    // (JXM_ACT=1: la tarjeta de la actualización —acá no hay Java—)
    if std::env::var("JXM_ACT").is_ok() { j.ini.act = Some(jxmod::comun::inicio_juego::Act::Nueva { version: "0.23".into(), mb: 51.4 }); }
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
        // la Workshop (como el navegador de GMod, en Aero): con curl, tocando de verdad
        if hace("workshop") {
            use jxmod::comun::paneles_juego::Acc;
            j.gmod.http_bin = Some(std::sync::Arc::new(|u: &str| {
                let o = std::process::Command::new("curl").args(["-s", "--max-time", "30", "-w", "\n%{http_code}", u]).output().map_err(|e| e.to_string())?;
                let mut b = o.stdout; let i = b.iter().rposition(|c| *c == b'\n').unwrap_or(0); let cod: u16 = String::from_utf8_lossy(&b[i + 1..]).trim().parse().unwrap_or(0); b.truncate(i); Ok((cod, b))
            }));
            let esperar = |j: &mut Juego, m: &mut Motor3d, seg: f32, listo: &dyn Fn(&Juego) -> bool| { let t = std::time::Instant::now(); while t.elapsed().as_secs_f32() < seg { paso(j, m, 1); if listo(j) { break; } std::thread::sleep(std::time::Duration::from_millis(15)); } paso(j, m, 6); };
            let tocar_acc = |j: &mut Juego, m: &mut Motor3d, a: Acc| -> bool { if let Some((r, _)) = j.ini.pn.zonas.iter().find(|z| z.1 == a).cloned() { let (x, y) = (r[0] + r[2] / 2.0, r[1] + r[3] / 2.0); tocar(j, m, x, y); true } else { println!("workshop: no está {a:?}"); false } };
            let fotos = |j: &Juego| j.gmod.ws.items.iter().take(8).filter(|it| j.ini_foto_lista(&format!("ws:{}", it.id))).count();
            j.ws_abrir_prueba(); esperar(&mut j, &mut m, 25.0, &|j| j.gmod.ws.items.len() >= 30 && fotos(j) >= 8);
            println!("workshop: {} resultados de {} · fotos {} · error {:?}", j.gmod.ws.items.len(), j.gmod.ws.total, fotos(&j), j.gmod.ws.error); foto(&mut m, "ws_todo");
            tocar_acc(&mut j, &mut m, Acc::WsCat(2)); esperar(&mut j, &mut m, 25.0, &|j| !j.gmod.ws.cargando && fotos(j) >= 8);
            println!("workshop mapas: {} de {} · primero {:?}", j.gmod.ws.items.len(), j.gmod.ws.total, j.gmod.ws.items.first().map(|x| x.t.clone())); foto(&mut m, "ws_mapas");
            tocar_acc(&mut j, &mut m, Acc::WsFicha(0)); paso(&mut j, &mut m, 10); foto(&mut m, "ws_ficha");
            if let Some((r, _)) = j.ini.pn.zonas.iter().rev().find(|z| z.1 == Acc::WsCerrar).cloned() { tocar(&mut j, &mut m, r[0] + r[2] / 2.0, r[1] + r[3] / 2.0); } paso(&mut j, &mut m, 4); println!("workshop ficha cerrada: {}", j.gmod.ws.ficha.is_none());
            tocar_acc(&mut j, &mut m, Acc::WsOrden); esperar(&mut j, &mut m, 25.0, &|j| !j.gmod.ws.cargando && fotos(j) >= 6); println!("workshop orden {}: {:?}", j.gmod.ws.orden, j.gmod.ws.items.first().map(|x| x.t.clone())); foto(&mut m, "ws_orden");
            j.gmod.ws.q = "prop hunt".into(); j.gmod.ws.cat = 0; j.ws_buscar(true); esperar(&mut j, &mut m, 25.0, &|j| !j.gmod.ws.cargando && fotos(j) >= 6);
            println!("workshop «prop hunt»: {} de {} · {:?}", j.gmod.ws.items.len(), j.gmod.ws.total, j.gmod.ws.items.iter().take(3).map(|x| x.t.clone()).collect::<Vec<_>>()); foto(&mut m, "ws_buscar");
            j.gmod.ws.q = "https://steamcommunity.com/sharedfiles/filedetails/?id=105982362&searchtext=".into(); j.ws_buscar(true); esperar(&mut j, &mut m, 25.0, &|j| !j.gmod.ws.cargando && fotos(j) >= 1);
            println!("workshop link: {:?}", j.gmod.ws.items.iter().map(|x| (x.id.clone(), x.t.clone())).collect::<Vec<_>>()); foto(&mut m, "ws_link");
            // (arrastrar la grilla para abajo: la página siguiente)
            j.gmod.ws.q.clear(); j.gmod.ws.cat = 0; j.ws_buscar(true); esperar(&mut j, &mut m, 25.0, &|j| !j.gmod.ws.cargando);
            for _ in 0..12 { let (x, y) = (wf * 0.6, hf * 0.75); j.dedo_abajo(5, x, y, wf, hf); for k in 1..=8 { j.dedo_mueve(5, x, y - k as f32 * hf * 0.06, hf); paso(&mut j, &mut m, 1); } j.dedo_arriba(5); paso(&mut j, &mut m, 2); }
            esperar(&mut j, &mut m, 25.0, &|j| !j.gmod.ws.cargando && j.gmod.ws.items.len() > 30);
            println!("workshop desplazada: {} resultados (scroll {:.0})", j.gmod.ws.items.len(), j.gmod.ws.scroll); foto(&mut m, "ws_scroll");
            // (los GIF: primero la foto fija, después se animan —dos fotos a medio segundo—)
            j.gmod.ws.scroll = 0.0; j.gmod.ws.orden = 1; j.gmod.ws.cat = 0; j.ws_buscar(true);
            let t0 = std::time::Instant::now(); let mut fija_t = None; let mut anim_t = None;
            while t0.elapsed().as_secs_f32() < 40.0 { paso(&mut j, &mut m, 1); std::thread::sleep(std::time::Duration::from_millis(15));
                if fija_t.is_none() && fotos(&j) >= 1 { fija_t = Some(t0.elapsed().as_secs_f32()); }
                if anim_t.is_none() && !j.gmod.ws.anims.is_empty() { anim_t = Some(t0.elapsed().as_secs_f32()); }
                if j.gmod.ws.anims.len() >= 4 && fotos(&j) >= 8 { break; } }
            println!("workshop gif: primera foto fija a los {:.1} s, primer GIF animado a los {:.1} s, {} animados", fija_t.unwrap_or(-1.0), anim_t.unwrap_or(-1.0), j.gmod.ws.anims.len());
            for (id, a) in j.gmod.ws.anims.iter().take(4) { println!("  {id}: {} cuadros en {:.2} s ({}×{} cada uno)", a.fin.len(), a.fin.last().copied().unwrap_or(0.0), a.fw, a.fh); }
            paso(&mut j, &mut m, 4); foto(&mut m, "ws_gif_a"); let a = std::fs::read(format!("{sal}/{pre}_{w}x{h}_ws_gif_a.png")).ok();
            let t1 = std::time::Instant::now(); while t1.elapsed().as_secs_f32() < 0.5 { paso(&mut j, &mut m, 1); std::thread::sleep(std::time::Duration::from_millis(15)); } foto(&mut m, "ws_gif_b");
            let b = std::fs::read(format!("{sal}/{pre}_{w}x{h}_ws_gif_b.png")).ok();
            let dec = |v: Option<Vec<u8>>| v.and_then(|v| { let d = png::Decoder::new(std::io::Cursor::new(v)); let mut r = d.read_info().ok()?; let mut buf = vec![0; r.output_buffer_size()]; r.next_frame(&mut buf).ok()?; Some(buf) });
            if let (Some(a), Some(b)) = (dec(a), dec(b)) { let dif = a.chunks(4).zip(b.chunks(4)).filter(|(x, y)| x.iter().zip(y.iter()).any(|(p, q)| (*p as i32 - *q as i32).abs() > 24)).count(); println!("workshop gif: {dif} píxeles cambiaron en medio segundo (de {})", a.len() / 4); }
        }
        if hace("social") {
            use jxmod::comun::paneles_juego::Acc;
            let tocar_acc = |j: &mut Juego, m: &mut Motor3d, a: Acc| -> bool { if let Some((r, _)) = j.ini.pn.zonas.iter().find(|z| z.1 == a).cloned() { let (x, y) = centro(r); tocar(j, m, x, y); paso(j, m, 20); true } else { false } };
            // (sin sesión: lo que dice la tienda de verdad —con JXM_RED—, y Entrar con tu Gmail)
            if let Some(b) = j.ini_zona(Pieza::Op(2)) { let (x, y) = centro(b); tocar(&mut j, &mut m, x, y); }
            let t0 = std::time::Instant::now(); while j.soc.conf.is_none() && t0.elapsed().as_secs() < 20 { paso(&mut j, &mut m, 2); std::thread::sleep(std::time::Duration::from_millis(100)); }
            paso(&mut j, &mut m, 60); foto(&mut m, "soc_entrar"); println!("social: config {:?}", j.soc.conf);
            if tocar_acc(&mut j, &mut m, Acc::Soc("gmail".into())) { paso(&mut j, &mut m, 30); foto(&mut m, "soc_gmail"); }
            // (con una sesión de ejemplo: las cuatro pestañas y la conversación del grupo)
            j.soc_demo(false); paso(&mut j, &mut m, 10);
            for (k, n) in ["soc_chats", "soc_amigos", "soc_buscar", "soc_perfil"].iter().enumerate() { tocar_acc(&mut j, &mut m, Acc::Tab(k)); paso(&mut j, &mut m, 40); foto(&mut m, n); }
            tocar_acc(&mut j, &mut m, Acc::Tab(1)); tocar_acc(&mut j, &mut m, Acc::Soc("sub|1".into())); paso(&mut j, &mut m, 30); foto(&mut m, "soc_solicitudes");
            tocar_acc(&mut j, &mut m, Acc::Tab(0)); j.soc_demo(true); paso(&mut j, &mut m, 40); foto(&mut m, "soc_chat");
            tocar_acc(&mut j, &mut m, Acc::Volver); paso(&mut j, &mut m, 20);
        }
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
                if *n == "nueva" { // (la pestaña de los bajados)
                    use jxmod::comun::paneles_juego::Acc;
                    if let Some((r, _)) = j.ini.pn.zonas.iter().find(|z| z.1 == Acc::Cat(1)).cloned() { let (x, y) = centro(r); tocar(&mut j, &mut m, x, y); paso(&mut j, &mut m, 40);
                        if let Some((r, _)) = j.ini.pn.zonas.iter().find(|z| matches!(&z.1, Acc::Mapa(mp) if mp.starts_with("WS_"))).cloned() { let (x, y) = centro(r); tocar(&mut j, &mut m, x, y); paso(&mut j, &mut m, 20); }
                        println!("nueva · descargados: {:?} · elegido {:?}", j.ini.pn.zonas.iter().filter_map(|z| if let Acc::Mapa(mp) = &z.1 { Some(mp.clone()) } else { None }).collect::<Vec<_>>(), j.ini.pn.mapa);
                        foto(&mut m, "nueva_descargados");
                        if let Some((r, _)) = j.ini.pn.zonas.iter().find(|z| z.1 == Acc::Cat(0)).cloned() { let (x, y) = centro(r); tocar(&mut j, &mut m, x, y); paso(&mut j, &mut m, 30); } }
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
            // (JXM_BANCO=1: la tabla de la comparación de motores, con números de ejemplo —acá no se cambia de motor—)
            if std::env::var("JXM_BANCO").is_ok() {
                use jxmod::comun::Placa;
                j.banco.fin = Some(vec![(Placa::Vulkan, Some((38.4, 26.0))), (Placa::Gl3, Some((47.9, 20.9))), (Placa::Gl2, None)]);
                paso(&mut j, &mut m, 2); foto(&mut m, "banco"); j.banco.fin = None;
            }
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
