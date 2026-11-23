//! Fotos de los vehículos (jxjuego::vehiculo) y de lo que flota (jxjuego::flotar) en RB_Construct, dibujados con el motor
//! GLES fuera de pantalla (EGL sin superficie y un FBO, como examples/personaje.rs): el auto estacionado (de costado, las
//! ruedas sobre el piso), manejando (desde la cámara del juego y de frente, con las ruedas dobladas), todos los del menú
//! estacionados, el helicóptero en el aire, el bote (el Airboat: vehiculo::bote_de) flotando y andando en el lago, y props
//! flotando. Mide además cuánto se hunde o flota cada rueda que se ve respecto del piso.
//! Uso: vehiculo [CARPETA_SALIDA]  (JXM_WWW: la carpeta del paquete)
use glow::HasContext;
use jxjuego::fisica::{add, qeje, rot, Fisica, Q, V};
use jxjuego::flotar::{Aguas, Flota};
use jxjuego::forma::{cuerpo_de_prefab, nombres_menu, Catalogo};
use jxjuego::objetos::{self, Cargados, Prefab};
use jxjuego::paquete::Paquete;
use jxjuego::vehiculo::{Mando, Tipo, Vehiculos};
use jxmotor::escena::{Cuadro, ItemDin};
use jxmotor::gpu::{Motor, Opciones};
use jxmotor::mat::{self as m4, M4};
use khronos_egl as egl;
use std::collections::HashMap;
use std::path::Path;
use std::time::Instant;

const W: i32 = 720; const H: i32 = 440;
const DT: f64 = 1.0 / 60.0;

fn persp(fovy: f32, asp: f32, n: f32, f: f32) -> M4 {
    let t = 1.0 / (fovy / 2.0).tan(); let mut m = [0.0; 16];
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1.0; m[14] = 2.0 * f * n / (n - f); m
}
fn f3(v: V) -> [f32; 3] { [v[0] as f32, v[1] as f32, v[2] as f32] }

/// el mundo de la prueba: la física, los vehículos, el agua y lo que se dibuja de cada objeto
struct Mundo3 { fis: Fisica, vehs: Vehiculos, aguas: Aguas, objs: Vec<(String, u32)> }

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let sal = a.get(1).cloned().unwrap_or("/tmp/claude-0/jxm/veh".into()); std::fs::create_dir_all(&sal).unwrap();
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxp_apk/activos/www".into());
    let mut paq = Paquete::abrir(Path::new(&www)).expect("paquete");
    let mapa = jxjuego::mapa::armar(&mut paq, "RB_Construct", 512, 750.0).expect("mapa");
    let bote = jxjuego::vehiculo::bote_de(&paq, "Inflatable_boat").expect("el bote inflable");
    paq.d["pf"]["Airboat#gm"] = bote;
    let mut cat = Catalogo::nuevo(&paq);
    let nombres = objetos::por_nombre(&paq.d);

    // el motor GLES fuera de pantalla
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
    let mut cargados = Cargados::default(); let mut prefabs: HashMap<String, Prefab> = HashMap::new();
    let mut cargar = |m: &mut Motor, paq: &mut Paquete, n: &str, prefabs: &mut HashMap<String, Prefab>| {
        if prefabs.contains_key(n) { return; }
        let (pf, esc) = objetos::armar(paq, &nombres, n, 512, &mut cargados).expect("prefab"); unsafe { m.cargar(&esc).expect("cargar prefab"); } prefabs.insert(n.to_string(), pf);
    };
    let nuevo = || Mundo3 { fis: Fisica::nueva(), vehs: Vehiculos::nuevo(), aguas: Aguas::de_cajas(&mapa.aguas), objs: vec![] };
    // crearObjeto: el cuerpo, el agua y, si es un vehículo, vehiculoNuevo
    let crear = |w: &mut Mundo3, cat: &mut Catalogo, paq: &Paquete, n: &str, p: V, giro: f64| -> u32 {
        let pf = cat.prefab(paq, n).unwrap_or_else(|| panic!("no hay {n}"));
        let id = w.fis.agregar(cuerpo_de_prefab(&pf, p, qeje([0.0, 1.0, 0.0], giro), false));
        w.aguas.registrar(id, Flota::de_prefab(&pf)); w.vehs.agregar(paq, &pf, id, &mut w.fis, Some(&mut w.aguas)); w.objs.push((n.to_string(), id)); id
    };
    let paso = |w: &mut Mundo3, mundo: &jxjuego::mundo::Mundo, mando: &Mando| {
        w.vehs.paso(&mut w.fis, mundo, Some(&w.aguas), DT, mando); w.aguas.paso(&mut w.fis, DT); w.fis.paso(mundo, DT); w.aguas.avanzar(DT);
    };
    // lo que se dibuja: cada objeto con la matriz de su cuerpo (objetoMatriz: cuerpo × capQ⁻¹ × T(−c)); los vehículos con sus ruedas
    let items_de = |w: &Mundo3, cat: &mut Catalogo, paq: &Paquete, prefabs: &HashMap<String, Prefab>| -> Vec<ItemDin> {
        let mut it = mapa.items.clone();
        for (n, id) in &w.objs {
            let (Some(b), Some(pfz), Some(pf)) = (w.fis.cuerpo(*id), cat.prefab(paq, n), prefabs.get(n)) else { continue };
            let cq: Q = pfz.cap_q.map(|c| [-c[0], -c[1], -c[2], c[3]]).unwrap_or([0.0, 0.0, 0.0, 1.0]);
            let q = jxjuego::fisica::qmul(b.q, cq);
            let base = m4::mul(&jxjuego::mapa::trs(f3(b.pos), [q[0] as f32, q[1] as f32, q[2] as f32, q[3] as f32], [1.0; 3]), &jxjuego::mapa::trs([-pfz.c[0] as f32, -pfz.c[1] as f32, -pfz.c[2] as f32], [0.0, 0.0, 0.0, 1.0], [1.0; 3]));
            match w.vehs.de(*id) { Some(v) => v.items(pf, &base, &mut it), None => pf.items(&base, &mut it) }
        }
        it
    };
    // (fov: 0,9 rad en las de cerca; 1,2 —69°, como el juego— en las de la cámara del juego)
    let foto = |m: &mut Motor, items: Vec<ItemDin>, ojo: [f32; 3], mira: [f32; 3], nombre: &str| {
        let fov = if nombre.contains("camara") || nombre.contains("volando") { 1.2 } else { 0.9 };
        let vp = m4::mul(&persp(fov, W as f32 / H as f32, 0.05, mapa.lejos), &m4::mirar(ojo, mira, [0.0, 1.0, 0.0]));
        unsafe {
            m.poner_cuadro(Cuadro { vp, pos: ojo, luz: mapa.luz, agua_y: mapa.agua_y, tiempo: 1.0, luces: mapa.luces_cerca(ojo, 6), esp: vec![], items, efectos: vec![] });
            m.dibujar(Some(fb), W, H);
            let gl = &m.gl; let mut px = vec![0u8; (W * H * 4) as usize];
            gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb)); gl.read_pixels(0, 0, W, H, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelPackData::Slice(Some(&mut px)));
            let fila = (W * 4) as usize; let mut o = vec![0u8; px.len()];
            for y in 0..H as usize { o[y * fila..(y + 1) * fila].copy_from_slice(&px[(H as usize - 1 - y) * fila..(H as usize - y) * fila]); }
            for p in o.chunks_exact_mut(4) { p[3] = 255; }
            let ruta = format!("{sal}/{nombre}.png");
            let f = std::fs::File::create(&ruta).unwrap(); let mut enc = png::Encoder::new(std::io::BufWriter::new(f), W as u32, H as u32);
            enc.set_color(png::ColorType::Rgba); enc.set_depth(png::BitDepth::Eight); enc.write_header().unwrap().write_image_data(&o).unwrap();
            println!("  → {ruta}");
        }
    };
    // (la cámara del juego con el jugador adentro: vehiculoCamara, tercera persona, mirando un poco abajo)
    let cam_juego = |w: &Mundo3, id: u32, yaw: f64, pitch: f64| -> ([f32; 3], [f32; 3]) {
        let b = w.fis.cuerpo(id).unwrap(); let c = w.vehs.camara(&mapa.mundo, b.pos, b.q, yaw, pitch).unwrap();
        (f3(c.pos), f3(add(c.pos, c.adelante())))
    };
    // cuánto se hunde (+) o flota (−) el fondo de cada rueda dibujada (su centro dibujado menos su radio) respecto del piso
    // debajo, en cm
    let ruedas_piso = |w: &Mundo3, id: u32| -> Vec<f64> {
        let (b, v) = (w.fis.cuerpo(id).unwrap(), w.vehs.de(id).unwrap());
        (0..v.ruedas.len()).filter_map(|k| {
            let p = add(b.pos, rot(b.q, v.centro_rueda(k)?)); let o = f3(add(p, [0.0, 1.0, 0.0]));
            let g = mapa.mundo.rayo(o, [0.0, -1.0, 0.0], 3.0)?;
            Some((((o[1] - g.t) as f64 - (p[1] - v.ruedas[k].r_vis)) * 1000.0).round() / 10.0)
        }).collect()
    };

    // ---------------- 1. el auto estacionado y manejando ----------------
    let piso = -3.7;
    {
        let mut w = nuevo(); cargar(&mut m, &mut paq, "Sedan", &mut prefabs);
        let id = crear(&mut w, &mut cat, &paq, "Sedan", [16.0, piso, -40.0], 0.6);
        for _ in 0..90 { paso(&mut w, &mapa.mundo, &Mando::default()); }
        let b = w.fis.cuerpo(id).unwrap().clone(); let p = f3(b.pos);
        println!("Sedan estacionado: ruedas dibujadas respecto del piso (cm, + hundida, − flota) {:?}", ruedas_piso(&w, id));
        let costado = rot(b.q, [1.0, 0.0, 0.0]);
        foto(&mut m, items_de(&w, &mut cat, &paq, &prefabs), [p[0] + costado[0] as f32 * 6.0, p[1] - 0.2, p[2] + costado[2] as f32 * 6.0], [p[0], p[1] - 0.4, p[2]], "auto_quieto_costado");
        w.vehs.subir(&w.fis, id);
        let yaw = 0.6; let (o, t) = cam_juego(&w, id, yaw + 0.5, -0.15); foto(&mut m, items_de(&w, &mut cat, &paq, &prefabs), o, t, "auto_quieto_camara");
        // acelerar 1,5 s y doblar a la izquierda 0,6 s
        let t0 = Instant::now(); let mut n = 0;
        for i in 0..126 { let mando = Mando { y: 1.0, x: if i >= 90 { -0.8 } else { 0.0 }, ..Mando::default() }; paso(&mut w, &mapa.mundo, &mando); n += 1; }
        let ms = t0.elapsed().as_secs_f64() * 1000.0 / n as f64;
        let b = w.fis.cuerpo(id).unwrap().clone(); let p = f3(b.pos); let v = w.vehs.de(id).unwrap();
        println!("Sedan manejando: v {:.1} m/s, giro {:.2}, ruedas que tocan {}, (cm) {:?}; un paso entero (vehículo + agua + física) {ms:.3} ms",
            v.vel, v.giro, v.ruedas.iter().filter(|r| r.toca).count(), ruedas_piso(&w, id));
        let f = rot(b.q, [0.0, 0.0, 1.0]); let yaw_b = f[0].atan2(f[2]);
        let (o, t) = cam_juego(&w, id, yaw_b, -0.15); foto(&mut m, items_de(&w, &mut cat, &paq, &prefabs), o, t, "auto_manejando_camara");
        let lado = rot(b.q, [0.6, 0.0, 1.0]);
        foto(&mut m, items_de(&w, &mut cat, &paq, &prefabs), [p[0] + lado[0] as f32 * 4.5, p[1] + 0.3, p[2] + lado[2] as f32 * 4.5], [p[0], p[1] - 0.3, p[2]], "auto_manejando_ruedas");
    }

    // ---------------- 2. todos los del menú, estacionados ----------------
    {
        let mut w = nuevo();
        let lista: Vec<String> = nombres_menu(&paq, "Vehicles").into_iter().filter(|n| !["CityCopter", "AW119", "Gyrocopter", "Aircraft"].contains(&n.as_str())).collect();
        let mut ids = vec![];
        // (en filas de 6, en el hormigón abierto —z de −40 a −13, lejos del lomo de burro—, mirando a la cámara)
        for (k, n) in lista.iter().enumerate() { cargar(&mut m, &mut paq, n, &mut prefabs); ids.push((n.clone(), crear(&mut w, &mut cat, &paq, n, [-14.0 + (k % 6) as f64 * 7.0, piso, -13.0 - (k / 6) as f64 * 9.0], std::f64::consts::PI))); }
        for _ in 0..120 { paso(&mut w, &mapa.mundo, &Mando::default()); }
        for (n, id) in &ids { if let Some(v) = w.vehs.de(*id) { if v.tipo != Tipo::Asiento { println!("  {n:<16} ruedas dibujadas respecto del piso (cm) {:?}", ruedas_piso(&w, *id)); } } }
        foto(&mut m, items_de(&w, &mut cat, &paq, &prefabs), [3.5, 3.0, -52.0], [3.5, -3.5, -28.0], "todos");
        foto(&mut m, items_de(&w, &mut cat, &paq, &prefabs), [-21.0, -3.3, -13.0], [20.0, -3.55, -13.0], "todos_ras_del_piso");
        // (la moto de cerca, de costado, a la altura del piso)
        if let Some((_, id)) = ids.iter().find(|(n, _)| n == "Moto") { let p = f3(w.fis.cuerpo(*id).unwrap().pos); foto(&mut m, items_de(&w, &mut cat, &paq, &prefabs), [p[0] + 3.2, -3.45, p[2] + 0.3], [p[0], -3.55, p[2]], "moto_ras_del_piso"); }
    }

    // ---------------- 3. el helicóptero en el aire ----------------
    {
        let mut w = nuevo(); cargar(&mut m, &mut paq, "CityCopter", &mut prefabs);
        let id = crear(&mut w, &mut cat, &paq, "CityCopter", [4.0, piso, -30.0], 0.5); w.vehs.subir(&w.fis, id);
        for i in 0..240 { paso(&mut w, &mapa.mundo, &Mando { freno: i > 90, y: if i > 180 { 0.5 } else { 0.0 }, ..Mando::default() }); }
        let b = w.fis.cuerpo(id).unwrap(); println!("helicóptero: altura sobre el piso {:.2} m, motor {:.2}", b.pos[1] - piso, w.vehs.de(id).unwrap().motor);
        let (o, t) = cam_juego(&w, id, 0.5 + 0.8, -0.25); foto(&mut m, items_de(&w, &mut cat, &paq, &prefabs), o, t, "heli_volando");
    }

    // ---------------- 4. el bote y los props en el lago ----------------
    {
        let sup = -4.064;
        let mut w = nuevo(); cargar(&mut m, &mut paq, "Airboat", &mut prefabs);
        for n in ["Crate", "Barril", "Sofa", "Tire", "TableRound", "Box1"] { cargar(&mut m, &mut paq, n, &mut prefabs); }
        let id = crear(&mut w, &mut cat, &paq, "Airboat", [96.0, sup, -40.0], 0.0);
        for (k, n) in ["Crate", "Barril", "Sofa", "Tire", "TableRound", "Box1"].iter().enumerate() { crear(&mut w, &mut cat, &paq, n, [90.0 + k as f64 * 2.5, sup + 1.0, -32.0], k as f64); }
        for _ in 0..180 { paso(&mut w, &mapa.mundo, &Mando::default()); }
        let b = w.fis.cuerpo(id).unwrap().clone(); let p = f3(b.pos);
        println!("bote quieto: aguaK {:.2}, el centro {:.2} m sobre el agua", w.aguas.agua_k(id), b.pos[1] - sup);
        foto(&mut m, items_de(&w, &mut cat, &paq, &prefabs), [p[0] + 7.0, sup as f32 + 0.6, p[2] + 2.0], [p[0], sup as f32 + 0.2, p[2]], "bote_lago_costado");
        foto(&mut m, items_de(&w, &mut cat, &paq, &prefabs), [p[0] - 2.0, sup as f32 + 2.5, p[2] - 8.0], [96.0, sup as f32, -34.0], "props_flotando");
        w.vehs.subir(&w.fis, id);
        for i in 0..150 { paso(&mut w, &mapa.mundo, &Mando { y: 1.0, x: if i > 100 { -0.5 } else { 0.0 }, ..Mando::default() }); }
        let b = w.fis.cuerpo(id).unwrap().clone(); let f = rot(b.q, [0.0, 0.0, 1.0]);
        println!("bote andando: v {:.1} m/s, aguaK {:.2}", w.vehs.de(id).unwrap().vel, w.aguas.agua_k(id));
        let (o, t) = cam_juego(&w, id, f[0].atan2(f[2]), -0.2); foto(&mut m, items_de(&w, &mut cat, &paq, &prefabs), o, t, "bote_andando_camara");
    }
}
