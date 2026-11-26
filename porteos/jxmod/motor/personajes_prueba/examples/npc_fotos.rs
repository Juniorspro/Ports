//! Fotos de los NPC (jxjuego::npc) en RB_Flatgrass con el motor GLES fuera de pantalla (como examples/personaje.rs): quieto
//! mirándote, caminando hacia el jugador, pateándolo, tirado como muñeco de trapo después de una patada, bailando, uno
//! con pistola tirándote y un grupo de 12 haciendo de todo desde la cámara de tercera persona. El jugador es otro Hero
//! parado (para ver a quién siguen y a quién le pegan). hoja.png: todas juntas.
//! Uso: npc_fotos [CARPETA_SALIDA]   (JXM_WWW: la carpeta del paquete)
use glow::HasContext;
use jxjuego::fisica::Fisica;
use jxjuego::npc::{Actitud, Evento, Gente, Npcs, Skins};
use jxjuego::paquete::Paquete;
use jxjuego::personaje::{base, Cargados, Estado, Personaje};
use jxmotor::escena::{Cuadro, ItemDin};
use jxmotor::gpu::{Motor, Opciones};
use jxmotor::mat::{self as m4, M4};
use khronos_egl as egl;
use serde_json::json;
use std::path::Path;

const W: i32 = 480; const H: i32 = 360;
const DT: f32 = 1.0 / 60.0;

fn persp(fovy: f32, asp: f32, n: f32, f: f32) -> M4 {
    let t = 1.0 / (fovy / 2.0).tan(); let mut m = [0.0; 16];
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1.0; m[14] = 2.0 * f * n / (n - f); m
}

/// una escena: nombre, los NPC (actitud y dónde, relativo al jugador: x a la derecha, z adelante), cuántos segundos antes
/// de la foto (o cuando el primero lleva ese emote 0,25 s), si el jugador patea al primero (al segundo s) y desde dónde se
/// mira (relativo al jugador)
struct Toma { n: &'static str, npcs: Vec<(Actitud, [f32; 2], f32)>, s: f32, cuando: Option<&'static str>, patada: Option<f32>, ojo: [f32; 3], mira: [f32; 3] }

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let sal = a.get(1).cloned().unwrap_or("/tmp/claude-0/jxm/npc/fotos".into()); std::fs::create_dir_all(&sal).unwrap();
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxp_apk/activos/www".into());
    let mut paq = Paquete::abrir(Path::new(&www)).expect("paquete");
    let mapa = jxjuego::mapa::armar(&mut paq, "RB_Flatgrass", 512, 750.0).expect("mapa");
    // el motor GLES fuera de pantalla (lo mismo que personaje.rs)
    let e = unsafe { egl::DynamicInstance::<egl::EGL1_5>::load_required() }.expect("libEGL");
    let d = unsafe { e.get_platform_display(0x31DD, egl::DEFAULT_DISPLAY, &[egl::ATTRIB_NONE]) }.expect("pantalla EGL");
    e.initialize(d).unwrap(); e.bind_api(egl::OPENGL_ES_API).unwrap();
    let cfg = e.choose_first_config(d, &[egl::SURFACE_TYPE, egl::PBUFFER_BIT, egl::RENDERABLE_TYPE, egl::OPENGL_ES3_BIT, egl::NONE]).unwrap().or_else(|| e.choose_first_config(d, &[egl::NONE]).unwrap()).unwrap();
    let ctx = e.create_context(d, cfg, None, &[egl::CONTEXT_MAJOR_VERSION, 3, egl::NONE]).unwrap();
    e.make_current(d, None, None, Some(ctx)).unwrap();
    let gl = unsafe { glow::Context::from_loader_function(|s| e.get_proc_address(s).map_or(std::ptr::null(), |p| p as *const _)) };
    let fb = unsafe {
        let t = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(t)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::RGBA8, W, H);
        let f = gl.create_framebuffer().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::RENDERBUFFER, Some(t));
        f
    };
    std::mem::forget(e);
    let mut m = unsafe { Motor::nuevo(gl, Opciones::default()) }.expect("motor");
    unsafe { m.cargar(&mapa.esc).expect("cargar mapa"); }
    // los cuerpos: los de los NPC (una escena por skin) y el del jugador
    let mut skins = Skins::nuevo(0, 1024); let mut ya = Cargados::default();
    let (c0, esc) = skins.pedir(&mut paq, "Hero", &mut ya).expect("Hero"); if let Some(e) = esc { unsafe { m.cargar(&e).expect("cargar Hero"); } }
    let mut jug_pj: Personaje = c0.pj.clone();

    // (el jugador en el pasto, lejos de la plataforma de cemento donde se aparece)
    let sp0 = mapa.spawns.first().map(|s| s.0).unwrap_or([0.0; 3]); let sp = [sp0[0] - 30.0, sp0[1], sp0[2] - 30.0];
    let piso = |x: f32, z: f32| mapa.mundo.rayo([x, sp[1] + 50.0, z], [0.0, -1.0, 0.0], 200.0).map(|g| sp[1] + 50.0 - g.t).unwrap_or(sp[1]);
    println!("el pasto: {:.2} (la plataforma {:.2})", piso(sp[0], sp[2]), piso(sp0[0], sp0[2]));
    let act = |j: serde_json::Value| Actitud::normal(&j, Some(&json!({ "de": "yo" })));
    let r = |n: &str| Actitud::rapida(n, Some(&json!({ "de": "yo" }))).unwrap();
    let tomas = vec![
        Toma { n: "quieto", npcs: vec![(act(json!({ "modo": "quieto" })), [0.0, 3.0], 0.0)], s: 2.0, cuando: None, patada: None, ojo: [1.3, 1.6, -0.6], mira: [0.0, 1.1, 3.0] },
        Toma { n: "sigue", npcs: vec![(act(json!({ "modo": "seguir", "vel": 4, "obj": "yo", "dist": 2 })), [0.0, 14.0], 3.1416)], s: 1.6, cuando: None, patada: None, ojo: [5.0, 1.6, 6.5], mira: [0.0, 1.0, 7.0] },
        Toma { n: "patada", npcs: vec![(r("agresivo"), [0.0, 6.0], 3.1416)], s: 4.0, cuando: Some("Patada"), patada: None, ojo: [3.2, 1.5, 0.8], mira: [0.0, 1.0, 0.8] },
        Toma { n: "tirado", npcs: vec![(act(json!({ "modo": "quieto" })), [0.0, 1.3], 3.1416)], s: 2.9, cuando: None, patada: Some(0.5), ojo: [0.0; 3], mira: [0.0; 3] },
        Toma { n: "baila", npcs: vec![(r("bailarin"), [0.0, 3.0], 3.1416)], s: 1.7, cuando: None, patada: None, ojo: [1.3, 1.6, -0.6], mira: [0.0, 1.1, 3.0] },
        Toma { n: "pistola", npcs: vec![(r("armado"), [2.0, 14.0], 3.1416)], s: 2.5, cuando: None, patada: None, ojo: [1.2, 1.8, -1.5], mira: [2.0, 1.1, 14.0] },
        Toma { n: "grupo", npcs: (0..12).map(|k| {
            let ac = match k % 6 { 0 => r("agresivo"), 1 => r("armado"), 2 => r("amigo"), 3 => r("paseo"), 4 => r("bailarin"), _ => r("miedoso") };
            (ac, [-6.0 + (k % 4) as f32 * 4.0, 6.0 + (k / 4) as f32 * 4.0], 3.1416)
        }).collect(), s: 3.0, cuando: None, patada: None, ojo: [0.0, 2.6, -3.5], mira: [0.0, 1.0, 8.0] },
    ];
    let mut hoja = vec![0u8; (W * H) as usize * 4 * 8];
    let mut resumen = vec![];
    for (it, t) in tomas.iter().enumerate() {
        let mut fis = Fisica::nueva(); let mut npcs = Npcs::nuevo(&paq.d, 17 + it as u32); npcs.max = 50;
        let jp = [sp[0], piso(sp[0], sp[2]) + 0.95, sp[2]];
        let jug = Gente { pos: [jp[0] as f64, jp[1] as f64, jp[2] as f64], vivo: true, esf: vec![-0.5, 0.0, 0.5], radio: 0.45, tam: 1.0, id: "yo".into() };
        let ids: Vec<u32> = t.npcs.iter().map(|(ac, p, yaw)| {
            let (c, e) = skins.pedir(&mut paq, "Hero", &mut ya).unwrap(); if let Some(e) = e { unsafe { m.cargar(&e).unwrap(); } }
            let (x, z) = (sp[0] + p[0], sp[2] + p[1]);
            npcs.crear(c, [x, piso(x, z), z], *yaw, Some(ac.clone()), &mut fis).unwrap()
        }).collect();
        let cam = [jp[0] + t.ojo[0], jp[1] - 0.95 + t.ojo[1], jp[2] + t.ojo[2]];
        let mira = [jp[0] + t.mira[0], jp[1] - 0.95 + t.mira[1], jp[2] + t.mira[2]];
        let vp = m4::mul(&persp(0.9, W as f32 / H as f32, 0.05, mapa.lejos), &m4::mirar(cam, mira, [0.0, 1.0, 0.0]));
        let mut golpes = 0; let mut emote_visto = String::new(); let mut con_emote = 0;
        let n = (t.s / DT) as usize;
        for k in 0..n {
            if t.cuando.is_some() && con_emote >= 15 { break; }
            fis.paso(&mapa.mundo, DT as f64);
            if t.patada.map(|s| (s / DT) as usize == k).unwrap_or(false) { npcs.tumbar(ids[0], [0.0, 3.0, 6.0], &mut fis); }   // (la patada del jugador: patadas.js)
            npcs.paso(DT, &mapa.mundo, &mut fis, &jug, cam);
            npcs.animar(DT, cam, Some(&vp), &fis);
            for e in npcs.eventos() { if let Evento::DanoJugador { .. } = e { golpes += 1; } }
            if let Some(em) = npcs.get(ids[0]).and_then(|p| p.emote.clone()) { if Some(em.as_str()) == t.cuando { con_emote += 1; } emote_visto = em; }
            // (el jugador: parado, mirando al primer NPC)
            let yaw_j = npcs.get(ids[0]).map(|p| { let q = p.pos(); (q[0] - jp[0]).atan2(q[2] - jp[2]) }).unwrap_or(0.0);
            jug_pj.animar(DT, &Estado { piso: [jp[0], jp[1] - 0.95, jp[2]], vel: [0.0; 3], yaw: yaw_j, mira: 0.0, en_suelo: true, agachado: false, agua: None });
        }
        let yaw_j = npcs.get(ids[0]).map(|p| { let q = p.pos(); (q[0] - jp[0]).atan2(q[2] - jp[2]) }).unwrap_or(0.0);
        // (sin cámara dada: mira al primer NPC donde quedó, de costado y un poco de arriba)
        let (cam, vp) = if t.ojo == [0.0; 3] {
            let q = npcs.get(ids[0]).unwrap().pos(); let c = [q[0] + 2.2, q[1] + 1.0, q[2] - 1.6];
            let vp = m4::mul(&persp(0.9, W as f32 / H as f32, 0.05, mapa.lejos), &m4::mirar(c, [q[0], q[1] - 0.3, q[2]], [0.0, 1.0, 0.0]));
            npcs.animar(0.0, c, Some(&vp), &fis); (c, vp)
        } else { (cam, vp) };
        let mut items: Vec<ItemDin> = mapa.items.clone(); npcs.items(&mut items); jug_pj.items(&base([jp[0], jp[1] - 0.95, jp[2]], yaw_j), &mut items);
        let px = unsafe { foto(&mut m, fb, &mapa, &items, cam, vp) };
        guardar(&format!("{sal}/npc_{}.png", t.n), W as u32, H as u32, &px);
        let (fx, fy) = ((it % 4) as usize * W as usize, (it / 4) as usize * H as usize);
        for y in 0..H as usize { let o = ((fy + y) * W as usize * 4 + fx) * 4; hoja[o..o + W as usize * 4].copy_from_slice(&px[y * W as usize * 4..(y + 1) * W as usize * 4]); }
        let p = npcs.get(ids[0]).unwrap(); let q = p.pos();
        resumen.push(format!("{:<8} NPC1 en ({:.2} {:.2} {:.2}) a {:.2} m del jugador, {} {} · emote visto «{}» · golpes al jugador {golpes} · {} NPC visibles",
            t.n, q[0] - jp[0], q[1] - jp[1], q[2] - jp[2], ((q[0] - jp[0]).powi(2) + (q[2] - jp[2]).powi(2)).sqrt(), if p.rag.is_some() { "tirado" } else { "en pie" }, if p.cap.suelo { "en el piso" } else { "en el aire" }, emote_visto,
            npcs.lista.iter().filter(|x| x.visible).count()));
    }
    guardar(&format!("{sal}/hoja.png"), W as u32 * 4, H as u32 * 2, &hoja);
    for l in resumen { println!("{l}"); }
    println!("fotos en {sal}");
}

unsafe fn foto(m: &mut Motor, fb: glow::Framebuffer, mapa: &jxjuego::mapa::Mapa, items: &[ItemDin], ojo: [f32; 3], vp: M4) -> Vec<u8> {
    m.poner_cuadro(Cuadro { vp, pos: ojo, luz: mapa.luz, agua_y: mapa.agua_y, suelo_y: None, tiempo: 1.0, luces: mapa.luces_cerca(ojo, 6), esp: vec![], items: items.to_vec(), efectos: vec![] });
    m.dibujar(Some(fb), W, H);
    let gl = &m.gl; let mut px = vec![0u8; (W * H * 4) as usize];
    gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb)); gl.read_pixels(0, 0, W, H, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelPackData::Slice(Some(&mut px)));
    let fila = (W * 4) as usize; let mut o = vec![0u8; px.len()];
    for y in 0..H as usize { o[y * fila..(y + 1) * fila].copy_from_slice(&px[(H as usize - 1 - y) * fila..(H as usize - y) * fila]); }
    for p in o.chunks_exact_mut(4) { p[3] = 255; }
    o
}
fn guardar(ruta: &str, w: u32, h: u32, px: &[u8]) {
    let f = std::fs::File::create(ruta).unwrap(); let mut enc = png::Encoder::new(std::io::BufWriter::new(f), w, h);
    enc.set_color(png::ColorType::Rgba); enc.set_depth(png::BitDepth::Eight); enc.write_header().unwrap().write_image_data(px).unwrap();
}
