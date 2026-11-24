//! La prueba de los addons de GMod en el juego nativo (gmod_juego.rs): el juego de la app dibujado fuera de pantalla
//! (como foto.rs), con los addons de una carpeta montados, el panel «Mods», sus entidades puestas, sus armas en la mano
//! disparando y su HUD. Uso: gmod_foto CARPETA_SALIDA [ANCHO ALTO]
//!   JXM_ADDONS: la carpeta de addons (.gma o carpetas con lua/); JXM_WWW y JXM_LETRAS como foto.rs
//!   JXM_ARMA / JXM_ENT: la clase del arma y de la entidad a probar (si no, las primeras que traigan)
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
    let sal = a.get(1).cloned().unwrap_or("/tmp/claude-0/jxm/gmod_fotos".into()); std::fs::create_dir_all(&sal).unwrap();
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
    j.gmod.carpeta_externa = std::env::var("JXM_ADDONS").ok().map(std::path::PathBuf::from);
    // (rb/: la biblioteca de GMod —gm_lib— y los datos de la versión personal —jxp—)
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
    // (el mapa y los addons, uno por cuadro)
    let t = Instant::now(); paso(&mut j, &mut m, 2);
    let mut n = 0; while j.gmod.addons.iter().any(|a| a.prendido && a.idx.is_none()) && n < 200 { paso(&mut j, &mut m, 1); n += 1; }
    println!("addons montados: {} en {:.0} ms ({} cuadros)", j.gmod.addons.len(), t.elapsed().as_secs_f64() * 1000.0, n);
    for a in &j.gmod.addons { println!("  {} · armas {:?} · entidades {:?} · errores {}", a.nombre, a.sweps.iter().map(|x| &x.0).collect::<Vec<_>>(), a.sents.iter().map(|x| &x.0).collect::<Vec<_>>(), a.errores); }
    paso(&mut j, &mut m, 30); foto(&mut m, "1_montados");
    j.gmod_abrir(); paso(&mut j, &mut m, 2); foto(&mut m, "2_panel"); j.gmod_abrir();
    // (una entidad delante)
    let ent = std::env::var("JXM_ENT").ok().or_else(|| j.gmod.addons.iter().flat_map(|a| a.sents.iter()).next().map(|x| x.0.clone()));
    if let Some(e) = &ent {
        let n0 = j.objs.len(); j.gmod_poner(&format!("gment:{}", e)); paso(&mut j, &mut m, 1);
        println!("entidad {}: objetos {} → {}", e, n0, j.objs.len());
        paso(&mut j, &mut m, 5); foto(&mut m, "3_entidad");
        if let Some(o) = j.objs.last() { println!("  objeto {} en {:?}", o.nombre, o.pos); }
        paso(&mut j, &mut m, 90); foto(&mut m, "4_entidad_1s5");
        if let Some(o) = j.objs.last() { println!("  1,5 s después: {:?}", o.pos); }
    }
    // (un arma en la mano, disparando)
    let arma = std::env::var("JXM_ARMA").ok().or_else(|| j.gmod.addons.iter().flat_map(|a| a.sweps.iter()).next().map(|x| x.0.clone()));
    if let Some(a) = &arma {
        j.gmod_poner(&format!("gmswep:{}", a)); paso(&mut j, &mut m, 20);
        println!("arma {}: activa {} · base {}", a, j.gmod_arma_activa(), j.armas.def().n); foto(&mut m, "5_arma");
        let (bx, by) = pos_boton(wf, hf, Boton::Disparo);
        j.dedo_abajo(7, bx, by, wf, hf); paso(&mut j, &mut m, 1); foto(&mut m, "6_disparo"); paso(&mut j, &mut m, 3); paso(&mut j, &mut m, 20); j.dedo_arriba(7);
        let (bx, by) = pos_boton(wf, hf, Boton::Disparo2);
        j.dedo_abajo(8, bx, by, wf, hf); paso(&mut j, &mut m, 4); foto(&mut m, "7_disparo2"); j.dedo_arriba(8); paso(&mut j, &mut m, 10);
        // (de afuera: el modelo de mundo en la mano)
        j.camara = 1; paso(&mut j, &mut m, 6); foto(&mut m, "7b_arma_tercera"); j.camara = 0; paso(&mut j, &mut m, 2);
        println!("vista propia {} · modelo de mundo en la mano {}", j.gmod_vista_propia(), j.gmod_arma_mundo());
    }
    // (JXM_NB: un nextbot delante; persigue al jugador)
    if let Ok(nb) = std::env::var("JXM_NB") {
        // (lejos del punto de aparición: hay nextbots que no persiguen al que está ahí)
        j.jug.pos[0] += 15.0; paso(&mut j, &mut m, 10);
        for (k, c) in nb.split(',').enumerate() {
            let n0 = j.objs.len(); j.gmod_poner(&format!("gment:{}", c)); paso(&mut j, &mut m, 20);
            println!("nextbot {}: objetos {} → {} · dibujos {} modelos, {} sprites, {} ocultos", c, n0, j.gmod.objs_gm(), j.gmod.mods.dib.modelos.len(), j.gmod.mods.dib.sprites.len(), j.gmod.mods.dib.ocultos.len());
            foto(&mut m, &format!("n{k}_nextbot"));
            let p0 = j.gmod.nb_pos(); let mut ms3 = vec![]; for _ in 0..120 { paso(&mut j, &mut m, 1); ms3.push(j.gmod.ms + j.gmod.ms_3d); } let p1 = j.gmod.nb_pos();
            ms3.sort_by(|a, b| a.partial_cmp(b).unwrap()); println!("  Lua + 3D con el nextbot: mediana {:.3} ms, p95 {:.3} ms", ms3[60], ms3[114]);
            println!("  2 s después: {:?} → {:?} (jugador en {:?})", p0, p1, j.jug.pos);
            foto(&mut m, &format!("n{k}_nextbot_2s"));
        }
    }
    println!("modelos armados {} ({} triángulos; el más lento {:.1} ms: {}) · {:?}", j.gmod.mods.armados, j.gmod.mods.tris, j.gmod.mods.ms_max.0, j.gmod.mods.ms_max.1, j.gmod.mods.modelos.iter().map(|(k, v)| (k.clone(), v.is_some())).collect::<Vec<_>>());
    // (JXM_MENU=1: el menú de GMod: pestañas, listas, poner un prop de un spawnlist, un NPC y un vehículo)
    if std::env::var("JXM_MENU").is_ok() {
        j.gmod_abrir(); paso(&mut j, &mut m, 3);
        let ls = j.gmod_menu_listas(); println!("menú: {:?}", ls.iter().map(|x| x.len()).collect::<Vec<_>>()); println!("  NPCs: {:?}", ls.get(3)); println!("  Vehicles: {:?}", ls.get(4));
        let its = j.gmod_menu_ir(0, 0); paso(&mut j, &mut m, 12); foto(&mut m, "m1_spawnlists");
        let prop = its.iter().find(|i| { let r = i.trim_start_matches("gmprop:"); j.gmod.gm.as_ref().map(|g| g.archivo(r).is_some()).unwrap_or(false) }).cloned();
        println!("  lista 0: {} cosas; con modelo en la biblioteca: {:?}", its.len(), prop);
        j.gmod_menu_ir(3, 0); paso(&mut j, &mut m, 12); foto(&mut m, "m2_npcs");
        j.gmod_menu_ir(1, 0); paso(&mut j, &mut m, 12); foto(&mut m, "m3_weapons");
        if let Some(p) = prop { let n0 = j.objs.len(); j.gmod_menu_poner(&p); paso(&mut j, &mut m, 40); println!("  puesto {}: objetos {} → {} ({:?})", p, n0, j.objs.len(), j.objs.last().map(|o| o.nombre.clone())); foto(&mut m, "m4_prop"); }
        // (un NPC del motor —npc_combine_s— y un vehículo de base_vehicles: los del juego)
        let n0 = j.npcs.lista.len(); j.gmod_menu_poner("gmnpc:npc_combine_s"); paso(&mut j, &mut m, 60); println!("  NPC del juego: {} → {}", n0, j.npcs.lista.len()); foto(&mut m, "m6_npc_juego");
        let n0 = j.objs.len(); j.gmod_menu_poner("gmveh:Jeep"); paso(&mut j, &mut m, 30); println!("  vehículo: objetos {} → {} ({:?})", n0, j.objs.len(), j.objs.last().map(|o| o.nombre.clone())); foto(&mut m, "m7_vehiculo");
        if let Some(n) = j.gmod_menu_ir(3, 0).first().cloned() { let n0 = j.objs.len(); j.gmod_menu_poner(&n); paso(&mut j, &mut m, 40); println!("  puesto {}: objetos {} → {} ({:?})", n, n0, j.objs.len(), j.objs.last().map(|o| o.nombre.clone())); foto(&mut m, "m5_npc"); }
    }
    // (JXM_TIENDA=1: la tienda de verdad con curl: la lista, bajar el más chico, descomprimir e instalar)
    if std::env::var("JXM_TIENDA").is_ok() {
        j.gmod.http_bin = Some(std::sync::Arc::new(|u: &str| {
            let o = std::process::Command::new("curl").args(["-s", "-w", "\n%{http_code}", u]).output().map_err(|e| e.to_string())?;
            let mut b = o.stdout; let i = b.iter().rposition(|c| *c == b'\n').unwrap_or(0); let cod: u16 = String::from_utf8_lossy(&b[i + 1..]).trim().parse().unwrap_or(0); b.truncate(i); Ok((cod, b))
        }));
        j.gmod_tienda_pedir();
        let mut n = 0; while j.gmod.tienda.is_empty() && n < 600 { paso(&mut j, &mut m, 1); n += 1; }
        println!("tienda: {} con archivo directo", j.gmod.tienda.len());
        j.gmod_abrir(); paso(&mut j, &mut m, 2); foto(&mut m, "9_tienda"); j.gmod_abrir();
        if let Some(k) = (0..j.gmod.tienda.len()).min_by(|a, b| j.gmod.tienda[*a].mb.partial_cmp(&j.gmod.tienda[*b].mb).unwrap()) {
            println!("bajando {}", j.gmod.tienda[k].titulo); let t = Instant::now(); let antes = j.gmod.addons.len();
            j.gmod_bajar(k);
            let mut n = 0; while j.gmod.tienda[k].estado == "Bajando…" && n < 3000 { paso(&mut j, &mut m, 1); n += 1; }
            let mut n2 = 0; while j.gmod.addons.iter().any(|a| a.prendido && a.idx.is_none()) && n2 < 100 { paso(&mut j, &mut m, 1); n2 += 1; }
            println!("  → {} en {:.1} s; addons {} → {}", j.gmod.tienda[k].estado, t.elapsed().as_secs_f32(), antes, j.gmod.addons.len());
            if let Some(a) = j.gmod.addons.last() { println!("  {} · armas {:?} · entidades {:?}", a.nombre, a.sweps, a.sents); }
        }
    }
    // (lo que tarda el Lua por cuadro, con todo montado)
    let mut ms = vec![]; for _ in 0..120 { paso(&mut j, &mut m, 1); ms.push(j.gmod.ms); }
    ms.sort_by(|a, b| a.partial_cmp(b).unwrap());
    println!("Lua por cuadro: mediana {:.3} ms, p95 {:.3} ms, máx {:.3} ms · cuadro entero {:.1} ms", ms[60], ms[114], ms[119], j.ms);
    { let mut g3 = vec![]; for _ in 0..60 { let t = Instant::now(); paso(&mut j, &mut m, 1); let _ = t; g3.push(j.gmod.ms_3d); } g3.sort_by(|a, b| a.partial_cmp(b).unwrap()); println!("dibujo 3D del Lua + modelos por cuadro: mediana {:.3} ms, p95 {:.3} ms", g3[30], g3[57]); }
    foto(&mut m, "8_final");
    println!("pedidos del Lua: {:?}", j.gmod.cuenta);
}
