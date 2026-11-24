//! Fotos y medidas del arma en la mano (jxjuego::personaje con arma_mano.rs), con el motor GLES fuera de pantalla en
//! RB_Flatgrass (como npc_fotos.rs): el jugador en tercera persona con cada arma (de cerca la mano, la palma, el cuerpo
//! entero y desde atrás), otros personajes (Freddy, Jake) y un NPC armado tirándote. Mide cuánto rodean los dedos el mango
//! y a qué distancia quedan y la palma. hoja_*.png: todas juntas. (Sentado en los autos: sentado.rs)
//! Uso: arma_fotos [CARPETA_SALIDA]   (JXM_WWW: la carpeta del paquete)
use glow::HasContext;
use jxjuego::arma_mano::{self, ArmaMano};
use jxjuego::fisica::Fisica;
use jxjuego::npc::{Actitud, Gente, Npcs, Skins};
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
fn punto(m: &M4, p: [f32; 3]) -> [f32; 3] { [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] }
fn sum(a: [f32; 3], b: [f32; 3]) -> [f32; 3] { [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
fn d64(a: [f32; 3]) -> [f64; 3] { [a[0] as f64, a[1] as f64, a[2] as f64] }

/// una hoja de fotos: las fotos de W×H en filas de `cols`
struct Hoja { px: Vec<u8>, cols: usize, n: usize }
impl Hoja {
    fn nueva(cols: usize, filas: usize) -> Hoja { Hoja { px: vec![0u8; W as usize * cols * H as usize * filas * 4], cols, n: 0 } }
    fn poner(&mut self, f: &[u8]) {
        let (cx, cy) = (self.n % self.cols, self.n / self.cols); let ancho = W as usize * self.cols; self.n += 1;
        if (cy + 1) * H as usize * ancho * 4 > self.px.len() { return; }
        for y in 0..H as usize { let o = ((cy * H as usize + y) * ancho + cx * W as usize) * 4; self.px[o..o + W as usize * 4].copy_from_slice(&f[y * W as usize * 4..(y + 1) * W as usize * 4]); }
    }
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let sal = a.get(1).cloned().unwrap_or("/tmp/claude-0/arma_mano/fotos".into()); std::fs::create_dir_all(&sal).unwrap();
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxm/www_todo".into());
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
        let dp = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(dp)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::DEPTH_COMPONENT24, W, H);
        let f = gl.create_framebuffer().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::RENDERBUFFER, Some(t));
        gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::DEPTH_ATTACHMENT, glow::RENDERBUFFER, Some(dp));
        f
    };
    std::mem::forget(e);
    let mut m = unsafe { Motor::nuevo(gl, Opciones::default()) }.expect("motor");
    unsafe { m.cargar(&mapa.esc).expect("cargar mapa"); }
    let mut ya = Cargados::default();
    let sp0 = mapa.spawns.first().map(|s| s.0).unwrap_or([0.0; 3]); let sp = [sp0[0] - 30.0, sp0[1], sp0[2] - 30.0];
    let piso_y = |x: f32, z: f32| mapa.mundo.rayo([x, sp[1] + 50.0, z], [0.0, -1.0, 0.0], 200.0).map(|g| sp[1] + 50.0 - g.t).unwrap_or(sp[1]);
    let foto = |m: &mut Motor, items: &[ItemDin], ojo: [f32; 3], mira: [f32; 3], fov: f32| -> Vec<u8> {
        let vp = m4::mul(&persp(fov, W as f32 / H as f32, 0.02, mapa.lejos), &m4::mirar(ojo, mira, [0.0, 1.0, 0.0]));
        unsafe {
            m.poner_cuadro(Cuadro { vp, pos: ojo, luz: mapa.luz, agua_y: mapa.agua_y, tiempo: 1.0, luces: mapa.luces_cerca(ojo, 6), esp: vec![], items: items.to_vec(), efectos: vec![] });
            m.dibujar(Some(fb), W, H);
            let gl = &m.gl; let mut px = vec![0u8; (W * H * 4) as usize];
            gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb)); gl.read_pixels(0, 0, W, H, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelPackData::Slice(Some(&mut px)));
            let fila = (W * 4) as usize; let mut o = vec![0u8; px.len()];
            for y in 0..H as usize { o[y * fila..(y + 1) * fila].copy_from_slice(&px[(H as usize - 1 - y) * fila..(H as usize - y) * fila]); }
            for p in o.chunks_exact_mut(4) { p[3] = 255; }
            o
        }
    };

    // ---------------- 1. el jugador con cada arma ----------------
    let armas = ["Pistol", "Shotgun", "PhysicsGun", "Crowbar", "RPG", "ToolBaton", "GravityGun", "Smg", "Revolver", "Akm", "Sniper", "Crossbow", "Bat"];
    let mut hojas = [Hoja::nueva(7, 3), Hoja::nueva(7, 3), Hoja::nueva(7, 3), Hoja::nueva(7, 3)];
    println!("{:<12} {:<7} {:>9} {:>10} {:>34} {:>8}", "arma", "skin", "palma cm", "rodea °", "dedos: mín. al mango cm (I M R P)", "k mano");
    for skin in ["Hero", "Freddy", "Jake"] {
        let (pj0, esc) = Personaje::cargar(&mut paq, skin, 0, 1024, &mut ya).expect("personaje"); unsafe { m.cargar(&esc).unwrap(); }
        for (ia, arma) in armas.iter().enumerate() {
            if skin != "Hero" && !["Pistol", "PhysicsGun", "Crowbar", "RPG"].contains(arma) { continue; }
            let mut pj = pj0.clone();
            if let Some(e) = pj.poner_arma(&mut paq, Some(arma), &mut ya) { unsafe { m.cargar(&e).unwrap(); } }
            let yaw = 0.4f32; let raiz = [sp[0] + ia as f32 * 0.0, piso_y(sp[0], sp[2]), sp[2]];
            for _ in 0..80 { pj.animar(DT, &Estado { piso: raiz, vel: [0.0; 3], yaw, mira: 0.0, en_suelo: true, agachado: false, agua: None }); }
            let b = base(raiz, yaw);
            let mut items = mapa.items.clone(); pj.items(&b, &mut items);
            // medidas: el mango en el marco de la mano y los dedos
            if let Some((fm, l)) = pj.mano_marco(0) {
                let (am, _) = ArmaMano::cargar(&mut paq, arma, false, 64, &mut Cargados::default()).unwrap();
                let fi = m4::inv(&fm);
                let (nom, _, w) = pj.esqueleto();
                let en_mano = |n: &str| nom.iter().position(|x| x.ends_with(&format!(":{n}"))).map(|i| d64(punto(&fi, [w[i][12], w[i][13], w[i][14]])));
                if let Some(mg) = arma_mano::mango_de(&am, l) {
                    let palma = arma_mano::eje_mango([l * 0.5, 0.0, 0.0], &mg) - mg.r;
                    let mut rodea = vec![]; let mut gaps = vec![];
                    for dd in ["Index", "Middle", "Ring", "Pinky"] {
                        let ch: Vec<[f64; 3]> = (1..=4).filter_map(|k| en_mano(&format!("RightHand{dd}{k}"))).collect();
                        if ch.len() < 2 { continue; }
                        rodea.push(arma_mano::rodea_mango(&ch, &mg));
                        // (la falange como segmento: lo más cerca del eje, menos el radio del mango)
                        let mut mn = 1e9f64; for s in 0..ch.len() - 1 { for k in 0..=8 { let u = k as f64 / 8.0; let q = [ch[s][0] + (ch[s + 1][0] - ch[s][0]) * u, ch[s][1] + (ch[s + 1][1] - ch[s][1]) * u, ch[s][2] + (ch[s + 1][2] - ch[s][2]) * u]; mn = mn.min(arma_mano::eje_mango(q, &mg)); } }
                        gaps.push(format!("{:.1}", (mn - mg.r) * 100.0));
                    }
                    println!("{:<12} {:<7} {:>9.1} {:>10} {:>34} {:>8.2}", arma, skin, palma * 100.0, rodea.iter().map(|x| format!("{x:.0}")).collect::<Vec<_>>().join(" "), gaps.join(" "), l / 0.09932);
                } else { println!("{:<12} {:<7} (sin mango medible: sin agarre de GMod)", arma, skin); }
            }
            // las fotos: la mano de cerca (de la derecha del personaje), el cuerpo entero y la cámara de tercera persona
            let mano = pj.hueso("RightHand").map(|h| punto(&b, [h[12], h[13], h[14]])).unwrap();
            let (fw, der) = ([yaw.sin(), 0.0, yaw.cos()], [-yaw.cos(), 0.0, yaw.sin()]);
            let cerca = sum(mano, [der[0] * 0.45 + fw[0] * 0.25, 0.12, der[2] * 0.45 + fw[2] * 0.25]);
            // (la palma: de adelante, del lado de adentro y un poco de abajo)
            let palma = sum(mano, [fw[0] * 0.38 - der[0] * 0.22, -0.08, fw[2] * 0.38 - der[2] * 0.22]);
            let k = pj.tam;
            let cuerpo = sum(raiz, [fw[0] * 2.2 * k - der[0] * 1.2 * k, 1.5 * k, fw[2] * 2.2 * k - der[2] * 1.2 * k]);
            let ojos = sum(raiz, [0.0, 1.6 * pj.tam * pj.ojo, 0.0]); let tercera = [ojos[0] - fw[0] * 3.1, ojos[1] + 0.35, ojos[2] - fw[2] * 3.1];
            for (iv, (vn, ojo, mira, fov)) in [("mano", cerca, mano, 0.7f32), ("cuerpo", cuerpo, sum(raiz, [0.0, 0.95 * k, 0.0]), 0.8), ("tercera", tercera, sum(ojos, [fw[0] * 4.0, -0.6, fw[2] * 4.0]), 1.2), ("palma", palma, mano, 0.75)].into_iter().enumerate() {
                let px = foto(&mut m, &items, ojo, mira, fov);
                guardar(&format!("{sal}/{}_{}_{}.png", skin, arma, vn), &px); hojas[iv].poner(&px);
            }
        }
    }
    for (h, n) in hojas.iter().zip(["mano", "cuerpo", "tercera", "palma"]) { guardar_hoja(&format!("{sal}/hoja_armas_{n}.png"), h); }

    // ---------------- 2. caminando con la pistola y un NPC armado tirándote ----------------
    let mut hoja2 = Hoja::nueva(4, 1);
    {
        let (mut pj, _) = Personaje::cargar(&mut paq, "Hero", 0, 1024, &mut ya).unwrap();
        if let Some(e) = pj.poner_arma(&mut paq, Some("Pistol"), &mut ya) { unsafe { m.cargar(&e).unwrap(); } }
        let mut raiz = [sp[0], piso_y(sp[0], sp[2]), sp[2]];
        for _ in 0..100 { raiz[2] += 2.4 * DT; raiz[1] = piso_y(raiz[0], raiz[2]); pj.animar(DT, &Estado { piso: raiz, vel: [0.0, 0.0, 2.4], yaw: 0.0, mira: 0.0, en_suelo: true, agachado: false, agua: None }); }
        let mut items = mapa.items.clone(); pj.items(&base(raiz, 0.0), &mut items);
        let px = foto(&mut m, &items, sum(raiz, [-2.4, 1.3, 0.6]), sum(raiz, [0.0, 0.9, 0.0]), 0.8); guardar(&format!("{sal}/caminar_pistola.png"), &px); hoja2.poner(&px);
        let px = foto(&mut m, &items, sum(raiz, [0.0, 1.95, -3.1]), sum(raiz, [0.0, 1.2, 4.0]), 1.2); guardar(&format!("{sal}/caminar_pistola_tercera.png"), &px); hoja2.poner(&px);
    }
    {
        let mut skins = Skins::nuevo(0, 1024); let mut fis = Fisica::nueva(); let mut npcs = Npcs::nuevo(&paq.d, 7);
        let jp = [sp[0], piso_y(sp[0], sp[2]) + 0.95, sp[2]];
        let jug = Gente { pos: [jp[0] as f64, jp[1] as f64, jp[2] as f64], vivo: true, esf: vec![-0.5, 0.0, 0.5], radio: 0.45, tam: 1.0, id: "yo".into() };
        let mut ids = vec![];
        for (k, (ar, x)) in [("Pistol", -1.5f32), ("Shotgun", 1.5), ("Crowbar", 0.0)].iter().enumerate() {
            let (c, e) = skins.pedir(&mut paq, "Hero", &mut ya).unwrap(); if let Some(e) = e { unsafe { m.cargar(&e).unwrap(); } }
            let ac = Actitud::normal(&json!({ "modo": if k == 2 { "perseguir" } else { "quieto" }, "hostil": true, "arma": ar, "vel": 3, "dano": 1, "dist": 1.2 }), Some(&json!({ "de": "yo" })));
            let (px_, pz_) = (sp[0] + x, sp[2] + 9.0 + k as f32);
            ids.push(npcs.crear(c, [px_, piso_y(px_, pz_), pz_], 3.1416, Some(ac), &mut fis).unwrap());
        }
        let cam = [jp[0] + 1.0, jp[1] + 0.7, jp[2] - 1.2];
        let vp = m4::mul(&persp(0.9, W as f32 / H as f32, 0.05, mapa.lejos), &m4::mirar(cam, [jp[0], jp[1], jp[2] + 9.0], [0.0, 1.0, 0.0]));
        for _ in 0..(2.3 / DT) as usize { fis.paso(&mapa.mundo, DT as f64); npcs.paso(DT, &mapa.mundo, &mut fis, &jug, cam); npcs.animar(DT, cam, Some(&vp), &fis); npcs.eventos(); }
        let mut items = mapa.items.clone(); npcs.items(&mut items);
        let px = foto(&mut m, &items, cam, [jp[0], jp[1], jp[2] + 9.0], 0.9); guardar(&format!("{sal}/npc_armados.png"), &px); hoja2.poner(&px);
        let q = npcs.get(ids[0]).unwrap().pos();
        let px = foto(&mut m, &items, [q[0] - 1.6, q[1] + 0.4, q[2] - 1.0], [q[0], q[1] + 0.2, q[2]], 0.8); guardar(&format!("{sal}/npc_pistola_cerca.png"), &px); hoja2.poner(&px);
        println!("NPC armados: tiros {}", npcs.tiros());
    }
    guardar_hoja(&format!("{sal}/hoja_caminar_npc.png"), &hoja2);

    println!("fotos en {sal}");
}

fn guardar(ruta: &str, px: &[u8]) { guardar_wh(ruta, W as u32, H as u32, px) }
fn guardar_hoja(ruta: &str, h: &Hoja) { let filas = h.n.div_ceil(h.cols).max(1); let ancho = W as usize * h.cols; guardar_wh(ruta, ancho as u32, (H as usize * filas) as u32, &h.px[..ancho * H as usize * filas * 4]) }
fn guardar_wh(ruta: &str, w: u32, h: u32, px: &[u8]) {
    let f = std::fs::File::create(ruta).unwrap(); let mut enc = png::Encoder::new(std::io::BufWriter::new(f), w, h);
    enc.set_color(png::ColorType::Rgba); enc.set_depth(png::BitDepth::Eight); enc.write_header().unwrap().write_image_data(px).unwrap();
}
