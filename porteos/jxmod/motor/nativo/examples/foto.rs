//! La prueba en la compu: el mismo juego de la app (comun.rs) dibujado fuera de pantalla, con toques de mentira, y fotos de
//! cada momento. Con OpenGL ES 3 (Mesa) o, con JXM_MOTOR=vk, con el motor Vulkan propio (lavapipe).
//! Uso: foto CARPETA_SALIDA [ANCHO ALTO]
//!   JXM_WWW: la carpeta del paquete (pk.bin, pk.idx.json, rb/); JXM_LETRAS: la de letras.png y letras.json
//!   JXM_MAPA y JXM_VISTAS="x,y,z,giro,inclinación;…": sólo fotos desde esos lugares (JXM_PRE: el nombre de las fotos)
use glow::HasContext;
use jxjuego::paquete::Paquete;
use jxmod::ajustes;
use jxmod::comun::{Juego, Placa};
use jxmod::motor::Motor3d;
use jxmotor::gpu::{Motor, Opciones};
use khronos_egl as egl;
use std::path::Path;
use std::time::Instant;
#[path = "apoyo/broker.rs"] mod broker;

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
    let datos = std::env::temp_dir().join("jxm_nativo_datos"); let _ = std::fs::create_dir_all(&datos); let _ = std::fs::remove_file(datos.join("mapa.txt")); let _ = std::fs::remove_file(datos.join("ajustes.txt"));
    let letras = || (std::fs::read_to_string(Path::new(&let_).join("letras.json")).ok(), std::fs::read(Path::new(&let_).join("letras.png")).ok());
    let (lj, lp) = letras(); let mut j = Juego::nuevo(paq, lj, lp, Some(datos.clone()));
    // (JXM_GFX_AUTO: la pantalla de carga de la medición necesita el atlas de los menús desde el primer cuadro, como en la app:
    // JXM_MENUS, la carpeta con ui/menus.json de herramientas/atlas_menus.py)
    if std::env::var("JXM_GFX_AUTO").is_ok() { let menus = std::env::var("JXM_MENUS").unwrap_or("/tmp/claude-0/menus_activos".into()); j.inicio_lector(Box::new(move |n| std::fs::read(Path::new(&menus).join(n)).ok())); }
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
    // (JXM_RED=1: el multijugador contra un broker MQTT local: «Beto» —otro Red, como otro celular o la web— entra a la sala
    // oficial de este mapa, camina delante del jugador, pone una caja, habla y tira; el juego entra por el panel de salas)
    if std::env::var("JXM_RED").is_ok() {
        use jxjuego::red::{Jugador, Local, NpcLocal, ObjLocal, Puente, Red, Sala};
        use jxmod::comun::{pos_boton, Boton, red_juego::{panel_salas_geo, BtnSala}};
        let b = broker::Broker::nuevo(); let url = format!("mqtt://127.0.0.1:{}", b.tcp);
        let toque = |j: &mut Juego, id: i32, x: f32, y: f32| { j.dedo_abajo(id, x, y, wf, hf); j.dedo_arriba_en(id, wf, hf); };
        j.en_red.puente = Some(Puente::tcp()); j.en_red.red.broker = url.clone();
        let mapa = j.mapas[0].clone(); println!("red: broker {url} · mapa {mapa} · yo {} ({})", j.en_red.red.id, j.en_red.red.nombre);
        let mut beto = Red::nueva(Some("beto12345"), "Beto"); beto.broker = url.clone(); beto.cfg.mapa = mapa.clone(); let mut pb = Puente::tcp();
        let _ = beto.entrar(&Sala::oficial(&mapa), None); beto.empezar(None);
        let caja = j.catalogo.iter().flat_map(|c| c.1.iter()).find(|n| n.to_lowercase().contains("crate")).cloned().unwrap_or_else(|| j.catalogo[0].1[0].clone());
        // (el panel de salas y la oficial de este mapa)
        let (sx, sy) = pos_boton(wf, hf, Boton::Salas); toque(&mut j, 60, sx, sy); paso(&mut j, &mut m, 3);
        let salas = j.en_red.red.lista_salas(); let k = salas.iter().position(|(s, _)| s.m == mapa && s.of).expect("sin la sala oficial");
        j.en_red.scroll = (k as f32 - 1.0).max(0.0) * hf * 0.085; paso(&mut j, &mut m, 1); foto(&mut m, "8a_salas");
        let (_, bs) = panel_salas_geo(wf, hf, salas.len(), j.en_red.scroll, false); let r = bs.iter().find(|x| x.0 == BtnSala::Sala(k)).expect("la fila no se ve").1;
        toque(&mut j, 61, r[0] + r[2] / 2.0, r[1] + r[3] / 2.0);
        let (mut t, dt) = (0.0f64, 1.0 / 60.0); let jp0 = j.jug.pos; let yaw = j.jug.yaw as f64; let (fx, fz) = (yaw.sin(), yaw.cos());
        let mut dif = -1.0; let mut oyo: Vec<String> = vec![];
        // (un teclado de mentira: lo que se pide escribir contesta enseguida)
        let pedido = std::rc::Rc::new(std::cell::RefCell::new(None::<(i32, String)>)); let (p1, p2) = (pedido.clone(), pedido.clone());
        j.teclado = Some(jxmod::comun::Teclado { pedir: Box::new(move |id, ti, _, _, _| { *p1.borrow_mut() = Some((id, ti.to_string())); }),
            tomar: Box::new(move || p2.borrow_mut().take().map(|(id, ti)| (id, Some(if ti.contains("sala") { "hola Beto, soy el nativo".to_string() } else { "x".to_string() })))) });
        for f in 0..300 {
            t += dt; pb.bombear(&mut beto);
            // (Beto camina de un lado al otro a 5 m adelante, mirando al jugador; su caja a 7 m)
            let lado = (t * 0.9).sin() * 2.0; let p = [jp0[0] as f64 + fx * 5.0 + fz * lado, jp0[1] as f64, jp0[2] as f64 + fz * 5.0 - fx * lado];
            let jug = Jugador { skin: "Hero".into(), gorro: "HatEmpty".into(), pos: p, yaw: yaw + std::f64::consts::PI, vel: [fz * (t * 0.9).cos() * 1.8, 0.0, -fx * (t * 0.9).cos() * 1.8], suelo: true, vivo: true, arma: Some("Pistol".into()), vida: 100.0, reloj: t, ..Default::default() };
            let cp = [jp0[0] as f64 + fx * 7.0 + fz * 1.5, jp0[1] as f64 - 0.4, jp0[2] as f64 + fz * 7.0 - fx * 1.5];
            // (y un NPC suyo con escopeta, quieto a 6 m a la izquierda)
            let np = NpcLocal { id: 1, skin: "Hero".into(), pos: [jp0[0] as f64 + fx * 6.0 - fz * 2.0, jp0[1] as f64, jp0[2] as f64 + fz * 6.0 + fx * 2.0], yaw: yaw + std::f64::consts::PI, f: 1, arma: "Shotgun".into(), ..Default::default() };
            let local = Local { jug, objs: vec![ObjLocal { id: 1, nombre: caja.clone(), pos: cp, q: [0.0, 0.0, 0.0, 1.0], congelado: true, ..Default::default() }], npcs: vec![np], ..Default::default() };
            beto.paso(dt, &local); for e in beto.eventos() { match e { jxjuego::red::Evento::Chat { nombre, texto, .. } => oyo.push(format!("{nombre}: {texto}")), jxjuego::red::Evento::Dano { de, dano, .. } => oyo.push(format!("daño {dano} de {de}")), jxjuego::red::Evento::Hecho { k, d, .. } if k == "meme" => oyo.push(format!("meme {} de {}", d["m"], d["q"])), _ => {} } } pb.bombear(&mut beto);
            if f == 150 { let (cx, cy) = pos_boton(wf, hf, Boton::Chat); toque(&mut j, 63, cx, cy); }
            // (memes: toco el primero de los incluidos —Beto lo tiene que oír— y Beto toca uno suyo, que llega de a pedazos)
            if f == 160 { let id = j.memes_lista(0).first().map(|m| m.0.clone()).unwrap_or_default(); println!("red: toco el meme {id}: {}", j.meme_tocar(&id)); }
            if f == 170 { let b: Vec<u8> = (0..30000u32).map(|i| (i * 7 % 251) as u8).collect(); let s = jxmod::comun::memes_juego::base64(&b);
                beto.publicar("a", r##"{"k":"meme","m":"u:0a1b2c3d4e5f","q":"Beto","n":"Mi meme","c":"#43a047"}"##, false);
                let p: Vec<&str> = s.as_bytes().chunks(24000).map(|x| std::str::from_utf8(x).unwrap()).collect();
                for (x, d) in p.iter().enumerate() { beto.publicar("a", &format!(r#"{{"k":"memed","g":"u:0a1b2c3d4e5f","x":{x},"n":{},"d":"{d}"}}"#, p.len()), false); } }
            // (un emote: el panel, el primero de la lista; Beto lo tiene que ver)
            if f == 100 { let (ex, ey) = pos_boton(wf, hf, Boton::Emotes); toque(&mut j, 65, ex, ey); }
            if f == 102 { let n = j.lista_emotes().len(); let (_, cel) = jxmod::comun::panel_emotes_geo(wf, hf, n, 0.0); foto(&mut m, "8a2_emotes"); toque(&mut j, 66, cel[0][0] + cel[0][2] / 2.0, cel[0][1] + cel[0][3] / 2.0);
                // (la rueda de emotes de la web —emotes_juego.rs— no es la grilla de antes: si el toque no cayó en uno, el primero de la lista)
                if j.emote.is_none() { let e = j.lista_emotes().first().cloned(); j.hacer_emote(e); }
                println!("red: {} emotes · hago {:?}", n, j.emote); }
            if f == 140 { println!("red: Beto ve mi emote {:?}", beto.remotos().first().and_then(|r| r.emote.clone())); }
            if f == 200 { beto.chat("hola desde la red", None); }
            if f == 230 { let o = [p[0], p[1] + 0.72, p[2]]; beto.disparo("Pistol", o, [-fx, 0.0, -fz]); }
            paso(&mut j, &mut m, 1);
            if f == 232 { foto(&mut m, "8b_red"); }
            // (le tiro a Beto con la pistola: con PvP le llega el daño)
            if f == 240 { if let Some(k) = jxmod::armas::ARMAS.iter().position(|a| a.n == "Pistol") { j.armas.elegir(&mut j.fis, k); } }
            if f == 285 { let o = [j.jug.pos[0], j.jug.pos[1] + 0.72, j.jug.pos[2]]; let q = [p[0] as f32, p[1] as f32 + 0.2, p[2] as f32]; let dd = [q[0] - o[0], q[1] - o[1], q[2] - o[2]]; let l = (dd[0] * dd[0] + dd[1] * dd[1] + dd[2] * dd[2]).sqrt(); j.jug.yaw = dd[0].atan2(dd[2]); j.jug.pitch = (dd[1] / l).asin(); }
            if f == 287 { let (bx, by) = pos_boton(wf, hf, Boton::Disparo); j.dedo_abajo(64, bx, by, wf, hf); }
            if f == 289 { j.dedo_arriba(64); }
            if let Some(r) = beto.remotos().first() { let q = j.jug.pos; dif = ((r.pos[0] - q[0] as f64).powi(2) + (r.pos[1] - q[1] as f64).powi(2) + (r.pos[2] - q[2] as f64).powi(2)).sqrt(); }
        }
        println!("red: en sala {} ({}) · veo {} jugador(es): {:?} · cosas de otros {} · objetos en el juego {}", j.en_red.en_sala(), j.en_red.red.estado(), j.en_red.red.remotos().len(),
            j.en_red.red.remotos().iter().map(|r| format!("{} en [{:.2}, {:.2}, {:.2}]", r.nombre, r.pos[0], r.pos[1], r.pos[2])).collect::<Vec<_>>(), j.en_red.red.objetos().len(), j.objs.len());
        println!("red: NPC de otros que veo: {:?}", j.en_red.red.npcs_remotos().iter().map(|n| format!("{} de {} con {:?}", n.skin, n.de, n.arma)).collect::<Vec<_>>());
        let f = std::env::temp_dir().join("jxm_nativo_datos/memes_sala/0a1b2c3d4e5f");
        println!("red: memes en el chat {:?} · el de Beto llegó entero: {} bytes", j.memes.renglones, std::fs::metadata(&f).map(|m| m.len()).unwrap_or(0));
        println!("red: Beto ve {} jugador(es): {:?} · a {:.3} m de donde estoy · oyó {:?}", beto.remotos().len(), beto.remotos().iter().map(|r| r.nombre.clone()).collect::<Vec<_>>(), dif, oyo);
        let (sx, sy) = pos_boton(wf, hf, Boton::Camara); toque(&mut j, 62, sx, sy); paso(&mut j, &mut m, 20); foto(&mut m, "8c_red_tercera");
        return;
    }
    // (JXM_GFX_AUTO=1: los gráficos automáticos como en la app —gfxauto.js—: mide detrás de la carga, deja la que sostiene
    // los cuadros y lo anota; JXM_REFRESCO=Hz es el refresco de la pantalla que se supone —en la compu, 60—)
    if std::env::var("JXM_GFX_AUTO").is_ok() {
        j.gfx_medir = true; j.refresco = std::env::var("JXM_REFRESCO").ok().and_then(|v| v.parse().ok()).unwrap_or(60.0);
        j.dt_fijo = None; j.aj.medido = None; j.aj.poner_calidad(2);
        let t = Instant::now(); let mut n = 0; let mut sacada = false;
        while n < 3000 { paso(&mut j, &mut m, 1); n += 1;
            if !sacada && j.gfxa.midiendo() && n > 5 { foto(&mut m, "9g_gfx_midiendo"); sacada = true; }
            if j.gfxa.medido && !j.gfxa.midiendo() { break } }
        let r = j.gfxa.resultado.clone();
        println!("gfx auto: {} cuadros, {:.1} s · elegida {:?} · desde {:?} · medido {:?} · tirones {} · ajustes {:?}", n, t.elapsed().as_secs_f64(),
            r.as_ref().map(|r| ajustes::CALIDADES[r.0]), r.as_ref().map(|r| ajustes::CALIDADES[r.2]), r.as_ref().map(|r| r.1), j.gfxa.tirones, j.aj.medido);
        paso(&mut j, &mut m, 3); foto(&mut m, "9h_gfx_listo");
        return;
    }
    // (JXM_CARGA=1: lo que pide el dueño —50 NPC y 500 objetos con todo al máximo—: cuánto tarda cada parte del cuadro)
    if std::env::var("JXM_CARGA").is_ok() {
        let caja = j.catalogo.iter().flat_map(|c| c.1.iter()).find(|n| n.to_lowercase().contains("crate")).cloned().unwrap_or_else(|| j.catalogo[0].1[0].clone());
        let p0 = j.jug.pos; let t = Instant::now();
        // (500 cajas en 10 torres de 50 en una grilla de 5 × 2 delante, que se caen solas)
        for k in 0..500 { let (c, f) = (k % 10, k / 10); let p = [p0[0] + (c % 5) as f32 * 2.5 - 5.0, p0[1] + 0.5 + f as f32 * 0.9, p0[2] + 8.0 + (c / 5) as f32 * 2.5]; let _ = j.crear(&mut m, &caja, p, [0.0, 0.0, 0.0, 1.0], true, false); }
        println!("carga: 500 «{caja}» en {:.0} ms", t.elapsed().as_secs_f64() * 1000.0);
        j.npcs.max = 60; let t = Instant::now();
        for k in 0..50 { let a = k as f32 * 0.7; let (o, fw) = ([p0[0] + a.cos() * 3.0, p0[1] + 0.72, p0[2] - 6.0 + a.sin() * 3.0], [a.cos(), -0.3, a.sin()]); if let Err(e) = j.poner(&mut m, "npc:Hero", o, fw) { println!("NPC: {e}"); } }
        println!("carga: {} NPC en {:.0} ms", j.npcs.lista.len(), t.elapsed().as_secs_f64() * 1000.0);
        for (n, rapida) in [(0, "paseo"), (1, "agresivo")] { let _ = (n, rapida); }
        j.dt_fijo = Some(1.0 / 60.0);
        for k in 0..600 { paso(&mut j, &mut m, 1); if k == 120 || k == 239 || k == 599 {
            let dormidos = j.objs.iter().filter(|o| o.cuerpo.and_then(|id| j.fis.cuerpo(id)).map(|b| b.duerme).unwrap_or(false)).count();
            println!("   física por paso: detección {:.2} ms · solver {:.2} ms · {} de {} cajas dormidas · subpasos {}", j.fis.ms_det, j.fis.ms_sol, dormidos, j.objs.len(), j.fis.sub);
            let pf = j.perf; let total: f32 = pf[0] + pf[1] + pf[2] + pf[3];
            println!("carga a los {:.1} s: jugador {:.2} · física {:.2} · NPC {:.2} · juego {:.2} → sin el motor {:.2} ms · motor (llvmpipe, dibuja en la CPU) {:.1} ms", (k + 1) as f32 / 60.0, pf[0], pf[1], pf[2], pf[3], total, pf[4]);
        } }
        foto(&mut m, "9_carga");
        return;
    }
    // (JXM_SOLO_AUTO=1: sólo la prueba del auto en el pasto abierto, y termina)
    if std::env::var("JXM_SOLO_AUTO").is_ok() {
        j.poner_mapa("RB_Flatgrass"); paso(&mut j, &mut m, 90); println!("mapa {} · jugador {:?}", j.mapas.iter().position(|x| x == "RB_Flatgrass").unwrap_or(99), j.jug.pos);
        let fw = [j.jug.yaw.sin(), 0.0, j.jug.yaw.cos()]; let pa = [j.jug.pos[0] + fw[0] * 6.0, j.jug.pos[1] - 0.9, j.jug.pos[2] + fw[2] * 6.0];
        let nom = j.cat_veh.iter().flat_map(|c| c.1.iter()).next().cloned().unwrap_or("Sedan".into());
        let _ = j.crear_en(&mut m, &nom, pa, j.jug.yaw); for _ in 0..60 { paso(&mut j, &mut m, 1); }
        let id = j.objs.last().and_then(|o| o.cuerpo).unwrap(); println!("auto {nom}: cuerpo {id} · vehículos {} · en {:?}", j.vehs.lista.len(), j.fis.cuerpo(id).map(|b| b.pos));
        let ok = j.vehs.subir(&j.fis, id); println!("subir: {ok} · jugador {:?}", j.vehs.jugador);
        j.dedo_abajo(1, wf * 0.15, hf * 0.75, wf, hf); j.dedo_mueve(1, wf * 0.15, hf * 0.75 - hf * 0.12, hf);
        for k in 0..4 { for _ in 0..60 { paso(&mut j, &mut m, 1); } let b = j.fis.cuerpo(id).unwrap(); let v = j.vehs.de(id).unwrap();
            println!("  {} s: vel {:.1} m/s · motor {:.2} · ruedas que tocan {}/{} · pos [{:.1}, {:.1}, {:.1}] · congelado {} · vel {:.2}", k + 1, (b.vel[0].powi(2) + b.vel[2].powi(2)).sqrt(), v.motor, v.ruedas.iter().filter(|w| w.toca).count(), v.ruedas.len(), b.pos[0], b.pos[1], b.pos[2], b.congelado, v.vel); }
        // (lo mismo a mano, sin el cuadro del juego: los vehículos, el agua y la física)
        let mp = j.mapa.take().unwrap(); let mundo = &mp.mundo;
        for k in 0..120 { let md = jxjuego::vehiculo::Mando { y: 1.0, ..Default::default() }; j.vehs.paso(&mut j.fis, mundo, Some(&j.aguas), 1.0 / 60.0, &md); j.aguas.paso(&mut j.fis, 1.0 / 60.0); j.fis.paso(mundo, 1.0 / 60.0);
            if k % 60 == 59 { let b = j.fis.cuerpo(id).unwrap(); println!("  a mano {} s: vel {:.1} · masa {:.0}", (k + 1) / 60, (b.vel[0].powi(2) + b.vel[2].powi(2)).sqrt(), b.masa); } }
        j.mapa = Some(mp); foto(&mut m, "auto_solo"); return;
    }
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
            // la Tool Gun: el menú en Herramientas, un Timer y una Lamp en el piso, un cable del Timer a la Lamp
            let idx = |j: &Juego, n: &str| j.her.lista.iter().position(|h| h.n == n).unwrap_or(0);
            let (ox, oy) = pos_boton(wf, hf, Boton::Objetos); toque(&mut j, 50, ox, oy); paso(&mut j, &mut m, 1);
            let (px0, py0, ppw) = (wf * 0.04, hf * 0.12, wf * 0.92); let _ = ppw;
            { let bw = ((wf * 0.92 - hf * 0.16) / 5.0).min(hf * 0.42); toque(&mut j, 51, px0 + hf * 0.03 + 3.0 * (bw + hf * 0.02) + bw / 2.0, py0 + hf * 0.042); } paso(&mut j, &mut m, 1);
            let nh = j.her.lista.len() as f32; let tab_h = ((hf * 0.85 - hf * 0.1) / nh).min(hf * 0.08);
            let fila = |k: usize| (px0 + hf * 0.1, py0 + hf * 0.08 + (k as f32 + 0.5) * tab_h);
            let (tx, ty) = fila(idx(&j, "Timer")); toque(&mut j, 52, tx, ty); paso(&mut j, &mut m, 2); foto(&mut m, "3d1_herramientas");
            println!("Tool Gun: arma {} · herramienta {} · {} herramientas", j.armas.def().nom, j.her.lista[j.her.sel].n, j.her.lista.len());
            toque(&mut j, 53, px0 + ppw - hf * 0.05, py0 + hf * 0.04); paso(&mut j, &mut m, 45);
            let disparar = |j: &mut Juego, m: &mut Motor3d, id: i32| { let (bx, by) = pos_boton(wf, hf, Boton::Disparo); j.dedo_abajo(id, bx, by, wf, hf); j.dedo_arriba(id); paso(j, m, 2); };
            j.jug.pitch = -0.45; paso(&mut j, &mut m, 2); disparar(&mut j, &mut m, 54);
            j.equipar_herramienta(idx(&j, "Lamp")); j.jug.yaw += 0.35; paso(&mut j, &mut m, 30); disparar(&mut j, &mut m, 55);
            let ents: Vec<(u32, String)> = j.objs.iter().filter_map(|o| o.logica.as_ref().map(|l| (o.id, l.tipo.clone()))).collect();
            println!("   puestos: {:?}", ents);
            j.equipar_herramienta(idx(&j, "Wire")); paso(&mut j, &mut m, 30);
            j.jug.yaw -= 0.35; paso(&mut j, &mut m, 2); disparar(&mut j, &mut m, 56);
            j.jug.yaw += 0.35; paso(&mut j, &mut m, 2); disparar(&mut j, &mut m, 57);
            let lamp = j.objs.iter().find(|o| o.logica.as_ref().map(|l| l.tipo == "Lamp").unwrap_or(false)).map(|o| o.id);
            let mut estados = vec![];
            for _ in 0..12 { paso(&mut j, &mut m, 15); estados.push(j.objs.iter().find(|o| Some(o.id) == lamp).and_then(|o| o.logica.as_ref()).map(|l| l.luz).unwrap_or(false)); }
            println!("   la lámpara cada 0,25 s (Timer de 1 s): {:?}", estados.iter().map(|b| if *b { 1 } else { 0 }).collect::<Vec<_>>());
            j.jug.yaw -= 0.17; j.jug.pitch = -0.3; paso(&mut j, &mut m, 2); foto(&mut m, "3d2_timer_lampara");
            j.jug.pitch = 0.0; paso(&mut j, &mut m, 2);
            // las armas: la pistola contra una caja (12 tiros y recarga sola), la escopeta, la palanca, y el RPG contra un barril
            let arma = |j: &mut Juego, n: &str| { if let Some(k) = jxmod::armas::ARMAS.iter().position(|a| a.n == n) { j.armas.elegir(&mut j.fis, k); } };
            let fw = [j.jug.yaw.sin(), 0.0, j.jug.yaw.cos()]; let base = [j.jug.pos[0] + fw[0] * 4.0, j.jug.pos[1] - 0.9, j.jug.pos[2] + fw[2] * 4.0];
            let _ = j.crear_en(&mut m, "Crate", base, 0.0); paso(&mut j, &mut m, 60);
            let caja = j.objs.last().and_then(|o| o.cuerpo).unwrap_or(0); let c0 = j.fis.cuerpo(caja).map(|b| b.pos).unwrap_or([0.0; 3]);
            let mira_a = |j: &mut Juego, p: [f64; 3]| { let o = [j.jug.pos[0], j.jug.pos[1] + 0.72, j.jug.pos[2]]; let d = [p[0] as f32 - o[0], p[1] as f32 - o[1], p[2] as f32 - o[2]]; let l = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt(); j.jug.yaw = d[0].atan2(d[2]); j.jug.pitch = (d[1] / l).asin(); };
            arma(&mut j, "Pistol"); paso(&mut j, &mut m, 40); mira_a(&mut j, c0); paso(&mut j, &mut m, 2);
            let (bx, by) = pos_boton(wf, hf, Boton::Disparo);
            j.dedo_abajo(60, bx, by, wf, hf); let mut minb = 99; for _ in 0..170 { paso(&mut j, &mut m, 1); minb = minb.min(j.armas.balas[j.armas.i]); } foto(&mut m, "3e1_pistola"); j.dedo_arriba(60);
            println!("Pistola: balas al final {} (mínimo {}), recargando {:.2} s · la caja se movió {:.2} m", j.armas.balas[j.armas.i], minb, j.armas.recargando, { let c = j.fis.cuerpo(caja).map(|b| b.pos).unwrap_or(c0); ((c[0] - c0[0]).powi(2) + (c[2] - c0[2]).powi(2)).sqrt() });
            paso(&mut j, &mut m, 150); println!("   después de la recarga: {} balas", j.armas.balas[j.armas.i]);
            { let (x2, y2) = pos_boton(wf, hf, Boton::Disparo2); j.dedo_abajo(64, x2, y2, wf, hf); j.dedo_arriba(64); paso(&mut j, &mut m, 30); foto(&mut m, "3e1b_apuntar");
              println!("   apuntando: k {:.2} · campo de visión {:.0}°", j.armas.ap_k, j.aj.fov as f32 * (1.0 - 0.27 * j.armas.ap_k)); j.dedo_abajo(65, x2, y2, wf, hf); j.dedo_arriba(65); paso(&mut j, &mut m, 30); }
            arma(&mut j, "Shotgun"); paso(&mut j, &mut m, 60); let c1 = j.fis.cuerpo(caja).map(|b| b.pos).unwrap_or(c0); mira_a(&mut j, c1); paso(&mut j, &mut m, 2);
            j.dedo_abajo(61, bx, by, wf, hf); paso(&mut j, &mut m, 3); j.dedo_arriba(61); paso(&mut j, &mut m, 60); foto(&mut m, "3e2_escopeta");
            println!("Escopeta: la caja se movió {:.2} m · balas {}", { let c = j.fis.cuerpo(caja).map(|b| b.pos).unwrap_or(c1); ((c[0] - c1[0]).powi(2) + (c[2] - c1[2]).powi(2)).sqrt() }, j.armas.balas[j.armas.i]);
            arma(&mut j, "Crowbar"); paso(&mut j, &mut m, 60); let c2 = j.fis.cuerpo(caja).map(|b| b.pos).unwrap_or(c1);
            let d = ((c2[0] - j.jug.pos[0] as f64).powi(2) + (c2[2] - j.jug.pos[2] as f64).powi(2)).sqrt(); if d > 1.6 { let k = (d - 1.3) / d; j.jug.pos[0] += ((c2[0] - j.jug.pos[0] as f64) * k) as f32; j.jug.pos[2] += ((c2[2] - j.jug.pos[2] as f64) * k) as f32; }
            paso(&mut j, &mut m, 10); mira_a(&mut j, c2); paso(&mut j, &mut m, 2);
            j.dedo_abajo(62, bx, by, wf, hf); paso(&mut j, &mut m, 2); j.dedo_arriba(62); paso(&mut j, &mut m, 30); foto(&mut m, "3e3_palanca");
            println!("Palanca: la caja se movió {:.2} m", { let c = j.fis.cuerpo(caja).map(|b| b.pos).unwrap_or(c2); ((c[0] - c2[0]).powi(2) + (c[2] - c2[2]).powi(2)).sqrt() });
            // el RPG contra un barril explosivo, a 10 m, con la caja al lado
            let fw = [j.jug.yaw.sin(), 0.0, j.jug.yaw.cos()]; let pb = [j.jug.pos[0] + fw[0] * 10.0, j.jug.pos[1] - 0.9, j.jug.pos[2] + fw[2] * 10.0];
            let _ = j.crear_en(&mut m, "BarrilExplosivo", pb, 0.0); let _ = j.crear_en(&mut m, "Crate", [pb[0] + 1.5, pb[1], pb[2]], 0.0); paso(&mut j, &mut m, 60);
            let barril = j.objs.iter().rev().find(|o| o.nombre == "BarrilExplosivo").and_then(|o| o.cuerpo).unwrap_or(0); let pb2 = j.fis.cuerpo(barril).map(|b| b.pos).unwrap_or([0.0; 3]);
            let caja2 = j.objs.last().and_then(|o| o.cuerpo).unwrap_or(0); let k0 = j.fis.cuerpo(caja2).map(|b| b.pos).unwrap_or([0.0; 3]);
            println!("RPG: barril tipo {:?}", j.objs.iter().find(|o| o.cuerpo == Some(barril)).map(|o| o.tipo));
            arma(&mut j, "RPG"); paso(&mut j, &mut m, 60); mira_a(&mut j, pb2); paso(&mut j, &mut m, 2);
            j.dedo_abajo(63, bx, by, wf, hf); paso(&mut j, &mut m, 2); j.dedo_arriba(63);
            for k in 0..30 { paso(&mut j, &mut m, 1); if k == 12 { foto(&mut m, "3e4_rpg"); } }
            let sigue = j.objs.iter().any(|o| o.cuerpo == Some(barril));
            println!("   después: el barril {} · la caja de al lado salió a {:.1} m/s · vida del jugador {:.0} · temblor {:.2}", if sigue { "sigue" } else { "explotó" },
                j.fis.cuerpo(caja2).map(|b| (b.vel[0].powi(2) + b.vel[1].powi(2) + b.vel[2].powi(2)).sqrt()).unwrap_or(-1.0), j.jug.vida, k0[0] * 0.0);
            paso(&mut j, &mut m, 60); foto(&mut m, "3e5_despues");
            arma(&mut j, "PhysicsGun"); j.jug.pitch = 0.0; paso(&mut j, &mut m, 30);
            // los NPC: el menú en la pestaña NPCs, poner 3 (el Hero) y dispararle a uno con la escopeta
            let (ox, oy) = pos_boton(wf, hf, Boton::Objetos); toque(&mut j, 70, ox, oy); paso(&mut j, &mut m, 1);
            let pest = |k: usize| { let bw = ((wf * 0.92 - hf * 0.16) / 5.0).min(hf * 0.42); (wf * 0.04 + hf * 0.03 + k as f32 * (bw + hf * 0.02) + bw / 2.0, hf * 0.12 + hf * 0.042) };
            let (tx, ty) = pest(1); toque(&mut j, 71, tx, ty); paso(&mut j, &mut m, 2); foto(&mut m, "4a_menu_npcs");
            let (gx, gy, gw) = (wf * 0.04 + wf * 0.92 * 0.22, hf * 0.12 + hf * 0.09, wf * 0.92 * 0.77); let cols = ((gw / (hf * 0.19)).floor()).max(1.0); let celda = gw / cols;
            for k in 0..3 { j.jug.yaw += 0.3; paso(&mut j, &mut m, 1); toque(&mut j, 72 + k, gx + celda * 0.5, gy + celda * 0.5); paso(&mut j, &mut m, 2); }
            toque(&mut j, 76, wf * 0.04 + wf * 0.92 - hf * 0.05, hf * 0.12 + hf * 0.04); paso(&mut j, &mut m, 120);
            println!("NPC: {} puestos · {}", j.npcs.lista.len(), j.npcs.lista.iter().map(|n| format!("{} en [{:.1}, {:.1}, {:.1}] vida {:.0}", n.skin, n.pos()[0], n.pos()[1], n.pos()[2], n.vida)).collect::<Vec<_>>().join(" · "));
            j.jug.yaw -= 0.45; paso(&mut j, &mut m, 2); foto(&mut m, "4b_npcs");
            if let Some((id, q)) = j.npcs.lista.first().map(|n| (n.id, n.pos())) {
                arma(&mut j, "Shotgun"); paso(&mut j, &mut m, 60);
                { let o = [j.jug.pos[0], j.jug.pos[1] + 0.72, j.jug.pos[2]]; let d = [q[0] - o[0], q[1] - o[1], q[2] - o[2]]; let l = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt(); j.jug.yaw = d[0].atan2(d[2]); j.jug.pitch = (d[1] / l).asin(); }
                paso(&mut j, &mut m, 2); let v0 = j.npcs.get(id).map(|n| n.vida).unwrap_or(0.0);
                j.dedo_abajo(77, bx, by, wf, hf); paso(&mut j, &mut m, 3); j.dedo_arriba(77); paso(&mut j, &mut m, 60);
                let n = j.npcs.get(id); println!("   escopetazo: vida {:.0} → {:.0} · vivo {:?} · tirado {:?}", v0, n.map(|n| n.vida).unwrap_or(-1.0), n.map(|n| n.vivo), n.map(|n| !n.en_pie()));
                foto(&mut m, "4c_npc_tiro");
                arma(&mut j, "PhysicsGun"); j.jug.pitch = 0.0; paso(&mut j, &mut m, 30);
            }
            // la Actitud de la Tool Gun: sobre un NPC, su panel y «Armado»; en el piso, uno nuevo; «2», el de los nuevos
            if let Some((id, q)) = j.npcs.lista.iter().find(|n| n.vivo).map(|n| (n.id, n.pos())) {
                use jxmod::comun::{panel_npc_geo, BtnNpc};
                let k = j.her.lista.iter().position(|h| h.n == "Actitud").expect("sin Actitud"); j.equipar_herramienta(k); paso(&mut j, &mut m, 45);
                { let o = [j.jug.pos[0], j.jug.pos[1] + 0.72, j.jug.pos[2]]; let d = [q[0] - o[0], q[1] - o[1], q[2] - o[2]]; let l = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt(); j.jug.yaw = d[0].atan2(d[2]); j.jug.pitch = (d[1] / l).asin(); }
                paso(&mut j, &mut m, 2); disparar(&mut j, &mut m, 90);
                println!("Actitud: panel del NPC {:?} (era {})", j.npc_panel.as_ref().map(|p| p.npc), id);
                let (_, bs) = panel_npc_geo(wf, hf, false); let r = bs.iter().find(|b| b.0 == BtnNpc::Rapida(1)).unwrap().1;
                toque(&mut j, 91, r[0] + r[2] / 2.0, r[1] + r[3] / 2.0); paso(&mut j, &mut m, 2); foto(&mut m, "4c2_actitud");
                println!("   Armado: {:?}", j.npcs.get(id).map(|n| n.act.describir()));
                // (escrita: «agresivo, que me persiga corriendo con escopeta», por el cuadro de texto —acá, uno de mentira—)
                j.teclado = Some(jxmod::comun::Teclado { pedir: Box::new(|_, _, _, _, _| {}), tomar: Box::new(|| Some((1, Some("agresivo, que me persiga corriendo con escopeta".into())))) });
                let r = bs.iter().find(|b| b.0 == BtnNpc::Escribir).unwrap().1; toque(&mut j, 96, r[0] + r[2] / 2.0, r[1] + r[3] / 2.0); paso(&mut j, &mut m, 2);
                println!("   escrita: {:?}", j.npcs.get(id).map(|n| n.act.describir())); j.teclado = None;
                let r = bs.iter().find(|b| b.0 == BtnNpc::Cerrar).unwrap().1; toque(&mut j, 92, r[0] + r[2] / 2.0, r[1] + r[3] / 2.0); paso(&mut j, &mut m, 2);
                let n0 = j.npcs.lista.len(); j.jug.pitch = -0.7; paso(&mut j, &mut m, 2); disparar(&mut j, &mut m, 93); paso(&mut j, &mut m, 30);
                println!("   panel cerrado {} · en el piso: {} → {} NPC", j.npc_panel.is_none(), n0, j.npcs.lista.len());
                let (bx, by) = pos_boton(wf, hf, Boton::Disparo2); toque(&mut j, 94, bx, by); paso(&mut j, &mut m, 2); foto(&mut m, "4c3_actitud_nuevos");
                let (_, bs) = panel_npc_geo(wf, hf, true); let r = bs.iter().find(|b| b.0 == BtnNpc::Cerrar).unwrap().1; toque(&mut j, 95, r[0] + r[2] / 2.0, r[1] + r[3] / 2.0);
                arma(&mut j, "PhysicsGun"); j.jug.pitch = 0.0; paso(&mut j, &mut m, 30);
            }
            // un auto: la pestaña Vehículos, poner el primero, subir, manejar 3 s para adelante y bajar
            let (ox, oy) = pos_boton(wf, hf, Boton::Objetos); toque(&mut j, 80, ox, oy); paso(&mut j, &mut m, 1);
            let (tx, ty) = pest(2); toque(&mut j, 81, tx, ty); paso(&mut j, &mut m, 2); foto(&mut m, "4d_menu_vehiculos");
            j.jug.pitch = -0.2; paso(&mut j, &mut m, 1);
            let primero = j.cat_veh.iter().flat_map(|c| c.1.iter()).next().cloned().unwrap_or_default();
            toque(&mut j, 82, gx + celda * 0.5, gy + celda * 0.5); paso(&mut j, &mut m, 2);
            toque(&mut j, 83, wf * 0.04 + wf * 0.92 - hf * 0.05, hf * 0.12 + hf * 0.04); paso(&mut j, &mut m, 90);
            println!("vehículo: {} · {} en la lista · se puede subir {}", primero, j.vehs.lista.len(), { let (ux, uy) = pos_boton(wf, hf, Boton::Usar); let _ = (ux, uy); true });
            foto(&mut m, "4e_auto");
            // (mirar el auto para poder subir)
            if let Some(c) = j.objs.iter().rev().find(|o| o.cuerpo.map(|id| j.vehs.de(id).is_some()).unwrap_or(false)).map(|o| o.pos) {
                let o = [j.jug.pos[0], j.jug.pos[1] + 0.72, j.jug.pos[2]]; let d = [c[0] - o[0], c[1] + 0.5 - o[1], c[2] - o[2]]; let l = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt();
                if l > 4.0 { let k = (l - 3.0) / l; j.jug.pos[0] += d[0] * k; j.jug.pos[2] += d[2] * k; paso(&mut j, &mut m, 30); }
                let o = [j.jug.pos[0], j.jug.pos[1] + 0.72, j.jug.pos[2]]; let d = [c[0] - o[0], c[1] + 0.5 - o[1], c[2] - o[2]]; let l = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt(); j.jug.yaw = d[0].atan2(d[2]); j.jug.pitch = (d[1] / l).asin(); paso(&mut j, &mut m, 2);
            }
            let (ux, uy) = pos_boton(wf, hf, Boton::Usar); toque(&mut j, 84, ux, uy); paso(&mut j, &mut m, 30);
            println!("   subió: {:?}", j.vehs.jugador);
            let id = j.vehs.jugador.map(|x| x.0).unwrap_or(0); let p0 = j.fis.cuerpo(id).map(|b| b.pos).unwrap_or([0.0; 3]);
            j.dedo_abajo(1, wf * 0.15, hf * 0.75, wf, hf); j.dedo_mueve(1, wf * 0.15, hf * 0.75 - hf * 0.12, hf); paso(&mut j, &mut m, 180);
            { let (bx, by) = pos_boton(wf, hf, Boton::Bocina); j.dedo_abajo(2, bx, by, wf, hf); paso(&mut j, &mut m, 2); println!("   bocina apretada: {:?}", j.vehs.bocina(&j.fis, true).map(|b| b.0)); }
            foto(&mut m, "4f_manejando"); j.dedo_arriba(2); j.dedo_arriba(1);
            let p1 = j.fis.cuerpo(id).map(|b| b.pos).unwrap_or([0.0; 3]); let v = j.fis.cuerpo(id).map(|b| (b.vel[0].powi(2) + b.vel[2].powi(2)).sqrt()).unwrap_or(0.0);
            println!("   manejando 3 s: {:.1} m, {:.1} m/s", ((p1[0] - p0[0]).powi(2) + (p1[2] - p0[2]).powi(2)).sqrt(), v);
            paso(&mut j, &mut m, 120); toque(&mut j, 85, ux, uy); paso(&mut j, &mut m, 30); println!("   bajó: {:?} · jugador en {:?}", j.vehs.jugador, j.jug.pos); foto(&mut m, "4g_bajo");
        }
    }
    // el otro mapa: caminar 6 s para adelante y a la derecha (choca con lo que haya)
    // Ajustes: abrirlo (pausa), calidad Medio (la 3: la 0 es Automático), cerrar y ver la escena; abrir otra vez, Ultra, y en «Motor y mapa» el otro mapa
    let (ax, ay) = jxmod::comun::pos_boton(wf, hf, jxmod::comun::Boton::Ajustes);
    toque(&mut j, 20, ax, ay); paso(&mut j, &mut m, 2); foto(&mut m, "3d_ajustes");
    let (x, y) = j.pos_ajuste(wf, hf, 0, Some(0), 3); toque(&mut j, 21, x, y); paso(&mut j, &mut m, 2); foto(&mut m, "3e_ajustes_medio");
    println!("ajustes Medio: {:?}", j.aj);
    toque(&mut j, 22, x0 + pw - hf * 0.05, y0 + hf * 0.04); paso(&mut j, &mut m, 3); foto(&mut m, "3f_escena_medio");
    toque(&mut j, 23, ax, ay); let (x, y) = j.pos_ajuste(wf, hf, 0, Some(0), 5); toque(&mut j, 24, x, y);
    let (x, y) = j.pos_ajuste(wf, hf, 1, None, 0); toque(&mut j, 25, x, y); paso(&mut j, &mut m, 2); foto(&mut m, "3g_ajustes_controles");
    let (x, y) = j.pos_ajuste(wf, hf, 3, None, 0); toque(&mut j, 26, x, y); paso(&mut j, &mut m, 2); foto(&mut m, "3h_ajustes_motor");
    println!("ajustes Ultra: {:?} · abierto {:?}", j.aj, j.ajustes);
    let (x, y) = j.pos_ajuste(wf, hf, 4, None, 0); toque(&mut j, 28, x, y); paso(&mut j, &mut m, 2); foto(&mut m, "3i_ajustes_mapas");
    println!("mapas: {} ({})", j.mapas.len(), j.mapas.join(", "));
    let ic = j.mapas.iter().position(|m| m == "RB_Construct").unwrap_or(1);
    let (x, y) = j.pos_ajuste(wf, hf, 4, Some(0), ic); toque(&mut j, 27, x, y); let t = Instant::now(); paso(&mut j, &mut m, 2); println!("cambio de mapa: {:.0} ms · {}", t.elapsed().as_secs_f64() * 1000.0, m.resumen());
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
    // (con JXM_MAPAS_FOTO=1: una foto de cada mapa desde donde se aparece, y lo que tarda en armarse)
    if std::env::var("JXM_MAPAS_FOTO").is_ok() {
        for n in j.mapas.clone() {
            j.poner_mapa(&n); let t = Instant::now(); paso(&mut j, &mut m, 2); let ms = t.elapsed().as_secs_f64() * 1000.0; paso(&mut j, &mut m, 60);
            println!("mapa {n}: {:.0} ms · {} · {}", ms, m.resumen(), j.error.clone().unwrap_or_default()); j.error = None;
            foto(&mut m, &format!("mapa_{n}"));
        }
    }
    // la pantalla de error (sin paquete): lo que vería el teléfono si algo falla
    let (lj, lp) = letras(); let mut je = Juego::nuevo(Err("no están pk.bin o pk.idx.json en la APK".into()), lj, lp, Some(datos));
    je.en_uso = j.en_uso;
    paso(&mut je, &mut m, 2); foto(&mut m, "6_error");
}
