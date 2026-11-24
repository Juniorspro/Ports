//! La prueba de personajes.rs (con integrar_personajes.py aplicado): la plaza JX en Pradera, las 12 skins con su ropa
//! teñida, cada gorro en la cabeza (y el ajuste), el panel de Personaje, el accesorio importado (pruebas/casco.glb), el
//! celular en la mano (primera y tercera persona, sus apps), la ruleta y el panel de emotes, un emote de captura, uno del
//! paquete, uno de a dos con un NPC y el arma a gusto. Saca fotos (y hojas de contacto) y escribe los números.
//! Uso: personajes_foto CARPETA [ANCHO ALTO]  (JXM_WWW, JXM_LETRAS, JXM_MOTOR=vk|gl2 como foto.rs; JXM_SOLO=plaza,skins,…)
use glow::HasContext;
#[path = "apoyo/broker.rs"] mod broker;
use jxjuego::paquete::Paquete;
use jxmod::comun::{Boton, Juego, Placa};
use jxmod::motor::Motor3d;
use jxmotor::gpu::{Motor, Opciones};
use khronos_egl as egl;
use std::path::Path;

/// una hoja de contacto: varias fotos recortadas una al lado de la otra
struct Hoja { w: u32, h: u32, cols: u32, px: Vec<u8>, n: u32, cw: u32, ch: u32 }
impl Hoja {
    fn nueva(cols: u32, filas: u32, cw: u32, ch: u32) -> Hoja { Hoja { w: cols * cw, h: filas * ch, cols, px: vec![30; (cols * cw * filas * ch * 4) as usize], n: 0, cw, ch } }
    fn poner(&mut self, img: &[u8], iw: u32, x0: u32, y0: u32) {
        let (c, f) = (self.n % self.cols, self.n / self.cols); self.n += 1; if (f + 1) * self.ch > self.h { return; }
        for y in 0..self.ch { for x in 0..self.cw { let s = (((y0 + y) * iw + x0 + x) * 4) as usize; let d = (((f * self.ch + y) * self.w + c * self.cw + x) * 4) as usize; if s + 4 <= img.len() { self.px[d..d + 4].copy_from_slice(&img[s..s + 4]); } } }
    }
    fn guardar(&self, ruta: &str) { let f = std::fs::File::create(ruta).unwrap(); let mut e = png::Encoder::new(std::io::BufWriter::new(f), self.w, self.h); e.set_color(png::ColorType::Rgba); e.set_depth(png::BitDepth::Eight); e.write_header().unwrap().write_image_data(&self.px).unwrap(); println!("  → {ruta}"); }
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let sal = a.get(1).cloned().unwrap_or("/tmp/claude-0/pj_fotos/nat".into()); std::fs::create_dir_all(&sal).unwrap();
    let (w, h): (i32, i32) = (a.get(2).and_then(|x| x.parse().ok()).unwrap_or(960), a.get(3).and_then(|x| x.parse().ok()).unwrap_or(540));
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxm/www_todo".into());
    let let_ = std::env::var("JXM_LETRAS").unwrap_or("/tmp/claude-0/jxm/letras".into());
    let solo = std::env::var("JXM_SOLO").unwrap_or_default(); let hace = |k: &str| solo.is_empty() || solo.split(',').any(|s| s == k);
    let motor = std::env::var("JXM_MOTOR").unwrap_or_default(); let (vk, gl2) = (motor == "vk", motor == "gl2");
    let datos = std::env::temp_dir().join("jxm_pj_datos"); let _ = std::fs::remove_dir_all(&datos); let _ = std::fs::create_dir_all(datos.join("importar"));
    let lt = (std::fs::read_to_string(Path::new(&let_).join("letras.json")).ok(), std::fs::read(Path::new(&let_).join("letras.png")).ok());
    let mut j = Juego::nuevo(Paquete::abrir(Path::new(&www)), lt.0, lt.1, Some(datos.clone()));
    j.dt_fijo = Some(1.0 / 60.0);
    { let c = Path::new("/home/user/Ports/web/emotes/cmu"); if let (Ok(a), Ok(b)) = (std::fs::read(c.join("126_04.bin")), std::fs::read(c.join("79_02.bin"))) { j.nado = Some((a, b)); } }
    let (mut m, placa) = if vk {
        let m = unsafe { jxmotor::vk::Motor::nuevo(None, w as u32, h as u32, Opciones::default()) }.expect("Vulkan"); let p = m.placa.clone(); j.en_uso = Placa::Vulkan; (Motor3d::Vk(m), p)
    } else {
        let e = unsafe { egl::DynamicInstance::<egl::EGL1_5>::load_required() }.expect("libEGL");
        let d = unsafe { e.get_platform_display(0x31DD, egl::DEFAULT_DISPLAY, &[egl::ATTRIB_NONE]) }.expect("pantalla EGL");
        e.initialize(d).unwrap(); e.bind_api(egl::OPENGL_ES_API).unwrap();
        let bit = if gl2 { egl::OPENGL_ES2_BIT } else { egl::OPENGL_ES3_BIT };
        let cfg = e.choose_first_config(d, &[egl::SURFACE_TYPE, egl::PBUFFER_BIT, egl::RENDERABLE_TYPE, bit, egl::NONE]).unwrap().or_else(|| e.choose_first_config(d, &[egl::NONE]).unwrap()).unwrap();
        let ctx = e.create_context(d, cfg, None, &[egl::CONTEXT_MAJOR_VERSION, if gl2 { 2 } else { 3 }, egl::NONE]).unwrap(); e.make_current(d, None, None, Some(ctx)).unwrap();
        let gl = unsafe { glow::Context::from_loader_function(|s| e.get_proc_address(s).map_or(std::ptr::null(), |p| p as *const _)) };
        let placa = unsafe { gl.get_parameter_string(glow::RENDERER) };
        let fb = unsafe { let t = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(t)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::RGBA8, w, h);
            let f = gl.create_framebuffer().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::RENDERBUFFER, Some(t));
            if gl2 { let p = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(p)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::DEPTH_COMPONENT16, w, h); gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::DEPTH_ATTACHMENT, glow::RENDERBUFFER, Some(p)); }
            f };
        std::mem::forget(e);
        if gl2 { j.en_uso = Placa::Gl2; (Motor3d::Gl2(unsafe { jxmotor::gl2::Motor::nuevo(gl, jxmotor::gl2::Opciones2::default()) }.expect("motor gl2"), Some(fb)), placa) }
        else { (Motor3d::Gl(unsafe { Motor::nuevo(gl, Opciones::default()) }.expect("motor"), Some(fb)), placa) }
    };
    let (wf, hf) = (w as f32, h as f32);
    let paso = |j: &mut Juego, m: &mut Motor3d, n: usize| { for _ in 0..n { unsafe { j.cuadro(m, w, h, &placa).expect("cuadro"); } } };
    let leer = |m: &mut Motor3d| -> Vec<u8> {
        match m {
            Motor3d::Vk(v) => unsafe { v.leer_imagen() }.expect("imagen"),
            _ => { let (gl, f): (&glow::Context, Option<glow::Framebuffer>) = match m { Motor3d::Gl(g, f) => (&g.gl, *f), Motor3d::Gl2(g, f) => (&g.gl, *f), _ => unreachable!() };
                let mut px = vec![0u8; (w * h * 4) as usize]; unsafe { gl.bind_framebuffer(glow::FRAMEBUFFER, f); gl.read_pixels(0, 0, w, h, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelPackData::Slice(Some(&mut px))); }
                let fila = (w * 4) as usize; let mut dado = vec![0u8; px.len()]; for y in 0..h as usize { dado[y * fila..(y + 1) * fila].copy_from_slice(&px[(h as usize - 1 - y) * fila..(h as usize - y) * fila]); } dado }
        }
    };
    let guardar = |px: &[u8], nombre: &str| { let ruta = format!("{sal}/{nombre}.png"); let f = std::fs::File::create(&ruta).unwrap(); let mut e = png::Encoder::new(std::io::BufWriter::new(f), w as u32, h as u32); e.set_color(png::ColorType::Rgba); e.set_depth(png::BitDepth::Eight); e.write_header().unwrap().write_image_data(px).unwrap(); println!("  → {ruta}"); };
    let foto = |m: &mut Motor3d, nombre: &str| { let px = leer(m); guardar(&px, nombre); px };
    let boton = |j: &mut Juego, b: Boton| { let (x, y) = jxmod::comun::pos_boton(wf, hf, b); j.dedo_abajo(90, x, y, wf, hf); j.dedo_arriba_en(90, wf, hf); };
    let tocar = |j: &mut Juego, x: f32, y: f32| { j.dedo_abajo(91, x, y, wf, hf); j.dedo_arriba_en(91, wf, hf); };
    // (la cámara fija mirando la cabeza del jugador desde adelante: `d` metros, de costado `lado`)
    let cam_cabeza = |j: &mut Juego, d: f32, lado: f32, alto: f32| {
        let Some(pj) = &j.pj else { return }; let Some(hh) = pj.hueso("Head") else { return }; let jp = j.jug.pos;
        let b = jxjuego::personaje::base([jp[0], jp[1] - 0.95, jp[2]], j.jug.yaw); let w = jxmotor::mat::mul(&b, &hh); let c = [w[12], w[13] + 0.06 * pj.tam, w[14]];
        let y = j.jug.yaw; let f = [y.sin(), 0.0, y.cos()]; let r = [y.cos(), 0.0, -y.sin()];
        let o = [c[0] + f[0] * d + r[0] * lado, c[1] + alto, c[2] + f[2] * d + r[2] * lado]; let dd = [c[0] - o[0], c[1] - o[1], c[2] - o[2]];
        j.pjs.prueba_cam = Some((o, dd));
    };

    // ---------------- Pradera (FlatGrass): la plaza JX ----------------
    j.poner_mapa("FlatGrass"); paso(&mut j, &mut m, 3); paso(&mut j, &mut m, 90);
    println!("Pradera: jugador en {:?} · plaza: {:?}", j.jug.pos, j.pjs.plaza.as_ref().map(|p| p.luz));
    if hace("plaza") { if let Some(p) = j.pjs.plaza.as_ref().map(|p| p.luz) {
        let c = [p[0], p[1] - 1.4, p[2] + 1.6]; let o = [c[0] + 26.0, c[1] + 9.0 + 1.4, c[2] + 30.0]; j.pjs.prueba_cam = Some((o, [c[0] - o[0], c[1] + 5.0 + 1.4 - o[1], c[2] - o[2]])); j.pjs.prueba_sin_hud = true; paso(&mut j, &mut m, 4); foto(&mut m, "plaza_lejos"); j.pjs.prueba_sin_hud = false;
        // (que choque: el jugador sobre la plataforma)
        j.pjs.prueba_cam = None; j.jug.noclip = false; j.jug.pos = [p[0] + 5.0, p[1] + 6.0, p[2] + 5.0]; j.jug.vel = [0.0; 3]; paso(&mut j, &mut m, 120);
        println!("plaza: el jugador cayó sobre la plataforma: y {:.2} (la tapa a {:.2}) suelo {}", j.jug.pos[1] - 0.95, p[1] - 1.4 + 0.45, j.jug.suelo);
    } }
    // ---------------- las skins heredadas (identidad.js) ----------------
    j.camara = 2;
    if hace("skins") {
        let skins = ["Hero", "Soldier", "Jean", "Business", "SpecialForcesW", "SpecialForcesM", "Prisoner01", "PilotFemale", "Butcher", "Swat", "Military", "Engineer"];
        let mut hoja = Hoja::nueva(6, 2, (w / 4) as u32, (h * 2 / 3) as u32);
        j.pjs.prueba_sin_hud = true; for s in skins { j.pj_poner_skin(s); paso(&mut j, &mut m, 2); cam_cabeza(&mut j, 2.3, 0.4, -0.55); paso(&mut j, &mut m, 3); let px = foto(&mut m, &format!("skin_{s}")); hoja.poner(&px, w as u32, (w * 3 / 8) as u32, (h / 6) as u32); println!("skin {s}: {}", jxjuego::identidad::skin_nom(s)); }
        hoja.guardar(&format!("{sal}/hoja_skins.png")); j.pjs.prueba_sin_hud = false;
        j.pj_poner_skin("Hero"); paso(&mut j, &mut m, 2);
    }
    // ---------------- los gorros (todos, de frente y de costado) ----------------
    if hace("gorros") {
        let l = j.gorros_lista(); println!("gorros: {} ({:?})", l.len(), l);
        let mut hoja = Hoja::nueva(8, 3, (w / 5) as u32, (h * 2 / 5) as u32);
        j.pjs.prueba_sin_hud = true; for g in &l { j.pj_poner_gorro(g); paso(&mut j, &mut m, 2); cam_cabeza(&mut j, 0.9, 0.35, 0.05); paso(&mut j, &mut m, 3); let px = foto(&mut m, &format!("gorro_{g}")); hoja.poner(&px, w as u32, (w * 2 / 5) as u32, (h * 3 / 10) as u32); }
        hoja.guardar(&format!("{sal}/hoja_gorros.png"));
        // el ajuste: más grande, más arriba y de otro color
        j.pj_poner_gorro("HatCowboy"); j.pjs.prefs.gorro_aj = jxjuego::gorros::Ajuste::limpio(&serde_json::json!({ "s": 1.3, "y": 4, "z": -2, "c": "#e0524f" }));
        paso(&mut j, &mut m, 2); cam_cabeza(&mut j, 0.9, 0.35, 0.05); paso(&mut j, &mut m, 3); foto(&mut m, "gorro_ajuste"); j.pjs.prueba_sin_hud = false;
        j.pjs.prefs.gorro_aj = None; j.pj_poner_gorro("HatViking"); paso(&mut j, &mut m, 2);
    }
    j.pjs.prueba_cam = None;
    // ---------------- el panel de Personaje ----------------
    if hace("panel") {
        j.pj_abrir_panel(jxmod::comun::personajes::Tab::Skin); paso(&mut j, &mut m, 6); foto(&mut m, "panel_personajes");
        j.pj_abrir_panel(jxmod::comun::personajes::Tab::Gorro); paso(&mut j, &mut m, 6); foto(&mut m, "panel_gorros");
        j.pjs.panel = None; paso(&mut j, &mut m, 2);
        // (desde la pausa: la tarjeta Personaje lo abre y Volver vuelve a la pausa)
        j.pj_abrir_desde_pausa(); paso(&mut j, &mut m, 2); let css = hf / 393.0; tocar(&mut j, 8.0 * css + 52.0 * css, hf - 40.0 * css + 20.0 * css); paso(&mut j, &mut m, 2);
        println!("panel desde la pausa: Volver → panel {} · pausa abierta {}", j.pjs.panel.is_some(), j.ini.pz.abierta); j.ini.pz.abierta = false; paso(&mut j, &mut m, 2);
    }
    let mut acc_guardado: Option<jxmod::comun::personajes::accesorio::AccAj> = None;
    // ---------------- el accesorio importado (pruebas/casco.glb) ----------------
    if hace("accesorio") {
        let casco = "/tmp/claude-0/wt_pj/porteos/jxmod/pruebas/casco.glb"; let _ = std::fs::copy(casco, datos.join("importar").join("casco.glb"));
        j.pj_abrir_panel(jxmod::comun::personajes::Tab::Gorro); j.acc_importar_boton(); j.acc_importar(0); paso(&mut j, &mut m, 4); foto(&mut m, "acc_panel");
        println!("accesorio: {:?} · lista {:?} · {}", j.pjs.prefs.acc, j.pjs.acc.lista.iter().map(|x| (x.n.clone(), x.tris)).collect::<Vec<_>>(), j.pjs.acc.estado);
        j.pjs.panel = None; j.pj_poner_gorro("HatEmpty"); paso(&mut j, &mut m, 3); cam_cabeza(&mut j, 1.3, 0.3, 0.15); paso(&mut j, &mut m, 3); foto(&mut m, "acc_frente");
        if let Some(a) = j.pjs.prefs.acc.as_mut() { a.ry = 45.0; a.y = 14.0; a.s = 1.2; } paso(&mut j, &mut m, 3); foto(&mut m, "acc_ajuste");
        // (el paquete se rearma del otro lado: lo que mandaría por la red, en pedazos)
        let id = j.pjs.prefs.acc.as_ref().map(|a| a.id.clone()).unwrap_or_default(); let b = std::fs::read(datos.join("accesorios").join(format!("{id}.pk"))).unwrap_or_default();
        println!("accesorio por la red: {} bytes, huella {} = id {}", b.len(), jxmod::comun::personajes::accesorio::huella(&b), id == jxmod::comun::personajes::accesorio::huella(&b));
        acc_guardado = j.pjs.prefs.acc.clone(); j.pjs.prefs.acc = None; j.pjs.prueba_cam = None; j.pj_poner_gorro("HatViking");
    }
    // ---------------- el celular ----------------
    let _ = &acc_guardado;
    if hace("celular") {
        j.camara = 0; paso(&mut j, &mut m, 2); boton(&mut j, Boton::Pj(jxmod::comun::personajes::Bp::Celular)); paso(&mut j, &mut m, 20); foto(&mut m, "celu_inicio");
        print!("{}", j.celu_prueba());
        j.pjs.celu.app = Some("props"); paso(&mut j, &mut m, 6); foto(&mut m, "celu_objetos");
        j.pjs.celu.app = Some("gente"); paso(&mut j, &mut m, 4); foto(&mut m, "celu_jugadores");
        j.pjs.celu.app = None; j.camara = 1; paso(&mut j, &mut m, 50); foto(&mut m, "celu_tercera");
        cam_cabeza(&mut j, 0.9, 0.45, -0.25); paso(&mut j, &mut m, 3); foto(&mut m, "celu_tercera_cerca"); print!("{}", j.celu_prueba());
        cam_cabeza(&mut j, 0.3, -0.7, 0.1); paso(&mut j, &mut m, 2); foto(&mut m, "celu_tercera_lado");
        // (las demás skins con el celular: los dedos no entran en el celular)
        for s in ["Soldier", "PilotFemale", "Goku", "Jake", "Freddy"] { j.pj_poner_skin(s); paso(&mut j, &mut m, 4); print!("{}", j.celu_prueba()); }
        j.pj_poner_skin("Hero"); paso(&mut j, &mut m, 3);
        j.pjs.prueba_cam = None; boton(&mut j, Boton::Pj(jxmod::comun::personajes::Bp::Celular)); paso(&mut j, &mut m, 4);
    }
    // ---------------- los emotes ----------------
    if hace("emotes") {
        j.camara = 2; paso(&mut j, &mut m, 2);
        boton(&mut j, Boton::Emotes); paso(&mut j, &mut m, 4); foto(&mut m, "emo_ruleta");
        let (cx, cy) = (wf / 2.0, hf / 2.0 - hf / 393.0 * 24.0); let rr = (wf.min(hf) * 0.8).min(440.0 * hf / 393.0) / 2.0; let pie = cy + rr + 14.0 * hf / 393.0 + 10.0;
        tocar(&mut j, cx - 60.0 * hf / 393.0, pie); paso(&mut j, &mut m, 6); foto(&mut m, "emo_panel");
        j.pjs.emo.panel = None; paso(&mut j, &mut m, 1);
        for (e, t) in [("c:99_01", 90), ("rb:AllNight", 60), ("Clap", 40)] { j.hacer_emote(Some(e.to_string())); paso(&mut j, &mut m, t); println!("emote {e}: haciendo {:?}", j.pj.as_ref().and_then(|p| p.captura())); foto(&mut m, &format!("emo_{}", e.replace(':', "_"))); j.hacer_emote(None); paso(&mut j, &mut m, 10); }
        // de a dos con un NPC (dar la mano)
        let npc = j.cat_npc.iter().flat_map(|c| c.1.iter()).find(|n| jxjuego::npc::skin_de_item(n) == Some("Soldier")).cloned().or_else(|| j.cat_npc.first().and_then(|c| c.1.first().cloned()));
        if let Some(n) = npc { j.camara = 1; let ojos = [j.jug.pos[0], j.jug.pos[1] + 0.72, j.jug.pos[2]]; let y = j.jug.yaw; let _ = j.poner(&mut m, &n, ojos, [y.sin(), -1.05, y.cos()]); paso(&mut j, &mut m, 30);
            println!("juntos: jugador {:?} yaw {:.2} · npcs {:?}", j.jug.pos, j.jug.yaw, j.npcs.lista.iter().map(|n| n.pos()).collect::<Vec<_>>());
            j.juntos_pedir("mano"); println!("juntos: aviso {:?}", j.pj_aviso()); println!("juntos: escena {:?}", j.pjs.emo.escena);
            // (de costado a los dos, a 2,6 m del medio: se busca el cuadro en que las manos están más cerca —el apretón—)
            let (pa, pb) = (j.jug.pos, j.npcs.lista.last().map(|n| n.pos()).unwrap_or(j.jug.pos)); let mid = [(pa[0] + pb[0]) / 2.0, (pa[1] + pb[1]) / 2.0, (pa[2] + pb[2]) / 2.0];
            let (dx, dz) = (pb[0] - pa[0], pb[2] - pa[2]); let l = dx.hypot(dz).max(1e-3); let lado = [-dz / l, 0.0, dx / l];
            j.pjs.prueba_cam = Some(([mid[0] + lado[0] * 2.6, mid[1] + 0.35, mid[2] + lado[2] * 2.6], [-lado[0], -0.12, -lado[2]]));
            let (mut mejor, mut cuadro, mut pies, mut de_costado) = (f32::MAX, 0, (0.0, 0.0), 0.0);
            let mut hj = Hoja::nueva(4, 3, 320, 295); let cam_lado = j.pjs.prueba_cam;
            for k in 0..240 { paso(&mut j, &mut m, 1); if k == 40 { foto(&mut m, "emo_juntos_mano"); }
                // (desde arriba, cada 20 cuadros: hacia dónde mira cada uno y cuánto se acercan)
                if k % 20 == 10 { if let Some((ca, cb)) = j.juntos_caderas() { let c = [(ca[0] + cb[0]) / 2.0, (ca[1] + cb[1]) / 2.0, (ca[2] + cb[2]) / 2.0];
                    j.pjs.prueba_sin_hud = true; j.pjs.prueba_cam = Some(([c[0], c[1] + 2.6, c[2] + 0.01], [0.0, -1.0, -0.003])); paso(&mut j, &mut m, 1); let px = leer(&mut m); hj.poner(&px, w as u32, (w as u32 - 320) / 2, (h as u32 - 295) / 2); j.pjs.prueba_cam = cam_lado; j.pjs.prueba_sin_hud = false; paso(&mut j, &mut m, 1); } } if let Some((d, dh, ya, yb)) = j.juntos_prueba() { if d < mejor { mejor = d; cuadro = k; pies = (ya, yb); de_costado = dh; foto(&mut m, "emo_juntos_contacto"); } } }
            hj.guardar(&format!("{sal}/hoja_juntos.png"));
            println!("juntos (mano, con un NPC): manos a {mejor:.1} cm ({de_costado:.1} cm de costado) en el cuadro {cuadro} · pies del jugador a {:.3} y del NPC a {:.3} (piso del jugador {:.3})", pies.0, pies.1, j.jug.pos[1] - 0.95);
            j.pjs.prueba_cam = None; paso(&mut j, &mut m, 60); println!("juntos terminó: escena {:?} jugador {:?}", j.pjs.emo.escena.is_some(), j.jug.pos); }
    }
    // ---------------- en la red: Beto (otro Red, como otro celular o la web) en la misma sala, con un broker local ----------------
    if hace("red") {
        use jxjuego::red::{Evento, Jugador, Local, Puente, Red, Sala};
        let b = broker::Broker::nuevo(); let url = format!("mqtt://127.0.0.1:{}", b.tcp); let mapa = j.pj_mapa_actual();
        j.en_red.puente = Some(Puente::tcp()); j.en_red.red.broker = url.clone();
        let mut beto = Red::nueva(Some("beto12345"), "Beto"); beto.broker = url.clone(); beto.cfg.mapa = mapa.clone(); let mut pb = Puente::tcp();
        let _ = beto.entrar(&Sala::oficial(&mapa), None); beto.empezar(None);
        j.pj_entrar_sala(&Sala::oficial(&mapa));
        // (yo: el vikingo con su ajuste y el casco importado; Beto me pide el casco y lo rearma de los pedazos)
        j.pj_poner_gorro("HatViking"); j.pjs.prefs.gorro_aj = jxjuego::gorros::Ajuste::limpio(&serde_json::json!({ "s": 1.1, "y": 2, "c": "#4f86e0" })); j.pjs.prefs.acc = acc_guardado.clone();
        let acc_id = acc_guardado.as_ref().map(|a| a.id.clone()).unwrap_or_default();
        let jp0 = j.jug.pos; let yaw = j.jug.yaw as f64; let (fx, fz) = (yaw.sin(), yaw.cos()); let dt = 1.0 / 60.0;
        let (mut pedazos, mut n_ped): (std::collections::BTreeMap<u64, String>, u64) = (Default::default(), 0); let mut vio = String::new();
        for f in 0..360 {
            pb.bombear(&mut beto);
            let p = [jp0[0] as f64 + fx * 2.2, jp0[1] as f64, jp0[2] as f64 + fz * 2.2];
            let jug = Jugador { skin: "Soldier".into(), gorro: "HatCowboy".into(), pos: p, yaw: yaw + std::f64::consts::PI, suelo: true, vivo: true, vida: 100.0, arma: Some("Celular".into()), emote: if f >= 200 { Some("c:99_01".into()) } else { None }, ..Default::default() };
            beto.paso(dt, &Local { jug, ..Default::default() });
            for e in beto.eventos() { if let Evento::Hecho { k, d, .. } = e { if k == "acd" && d["g"].as_str() == Some(acc_id.as_str()) { n_ped = d["n"].as_u64().unwrap_or(0); pedazos.insert(d["x"].as_u64().unwrap_or(0), d["d"].as_str().unwrap_or("").to_string()); } } }
            if f == 40 { let yo = j.en_red.red.id.clone(); beto.publicar("a", &serde_json::json!({ "k": "acq", "g": acc_id, "to": yo }).to_string(), false); }
            if f == 60 { boton(&mut j, Boton::Pj(jxmod::comun::personajes::Bp::Celular)); }
            if f == 150 { j.hacer_emote(Some("c:99_01".into())); }
            if f == 190 { if let Some(r) = beto.remotos().first() { vio = format!("gorro {} · ajuste {} · accesorio {} · arma {:?} · emote {:?}", r.gorro, r.gorro_aj, r.acc["id"], r.arma, r.emote); } }
            paso(&mut j, &mut m, 1);
        }
        let junto: String = pedazos.values().cloned().collect(); let bytes = jxjuego::personaje::base64(&junto).unwrap_or_default();
        println!("red: Beto me ve: {vio}");
        println!("red: el casco por la red: {} de {} pedazos, {} bytes, huella {} = id {}", pedazos.len(), n_ped, bytes.len(), jxmod::comun::personajes::accesorio::huella(&bytes), jxmod::comun::personajes::accesorio::huella(&bytes) == acc_id);
        let r = j.en_red.red.remotos().first().map(|r| format!("{} con {} · arma {:?} · emote {:?}", r.skin, r.gorro, r.arma, r.emote)).unwrap_or_default();
        println!("red: yo veo a Beto: {r} · su celular en la mano: {} · su captura: {:?}", j.pjs.celu.rem3p.len(), j.pj_captura_remota("beto12345"));
        // (la foto: Beto de costado, con el sombrero, el celular en la mano y el emote)
        let o = [jp0[0] + fx as f32 * 2.2, jp0[1], jp0[2] + fz as f32 * 2.2]; let lado = [fz as f32, 0.0, -fx as f32];
        j.hacer_emote(None); j.pjs.prueba_cam = Some(([o[0] + lado[0] * 2.4 - fx as f32 * 0.8, o[1] + 0.5, o[2] + lado[2] * 2.4 - fz as f32 * 0.8], [-lado[0] + fx as f32 * 0.3, -0.18, -lado[2] + fz as f32 * 0.3]));
        for _ in 0..3 { pb.bombear(&mut beto); let jug = Jugador { skin: "Soldier".into(), gorro: "HatCowboy".into(), pos: [o[0] as f64, o[1] as f64, o[2] as f64], yaw: yaw + std::f64::consts::PI, suelo: true, vivo: true, vida: 100.0, arma: Some("Celular".into()), ..Default::default() }; beto.paso(dt, &Local { jug, ..Default::default() }); paso(&mut j, &mut m, 1); }
        foto(&mut m, "red_beto"); j.pjs.prueba_cam = None; j.en_red.red.dejar(); boton(&mut j, Boton::Pj(jxmod::comun::personajes::Bp::Celular)); paso(&mut j, &mut m, 4);
    }
    // ---------------- el arma a gusto ----------------
    if hace("armaaj") {
        j.camara = 0; j.armas.elegir(&mut j.fis, 0); paso(&mut j, &mut m, 30); foto(&mut m, "armaaj_antes");
        j.arma_aj_abrir(); j.pjs.prefs.arma_aj.insert("PhysicsGun".into(), jxmod::comun::personajes::ArmaAj { x: 0.06, y: -0.04, z: 0.08, g: 15.0 }); paso(&mut j, &mut m, 4); foto(&mut m, "armaaj_despues");
        j.pjs.panel_aa = None;
    }
    if let Some((t, d)) = m.tiempos() { println!("placa {t:.1} ms: {d}"); }
}
