//! Fotos del personaje del jugador (el Hero, el skin de siempre) animado con jxjuego::personaje y dibujado con el motor
//! GLES fuera de pantalla (EGL sin superficie y un FBO, como nativo/examples/foto.rs), parado en RB_Flatgrass: quieto,
//! caminando, corriendo, en el aire, agachado, caminando agachado y mirando abajo; de frente, de costado y desde la cámara
//! de tercera persona del juego (hoja.png: todas juntas). Nadando, en el lago de RB_Construct (nado_*.png).
//! Además un recorrido seguido por todos los estados (con sus cambios, girando y corriendo a fondo) que mide en cada
//! cuadro lo que tiene que dar bien: la suela en el piso, que el pie que pisa no patine, que ningún vértice baje del piso
//! ni se vaya lejos (vértices que explotan) y que ningún hueso salte de un cuadro al otro.
//! Uso: personaje [CARPETA_SALIDA] [SKIN]  (JXM_WWW: la carpeta del paquete; JXM_CMU: la de las capturas de nado)
use glow::HasContext;
use jxjuego::paquete::Paquete;
use jxjuego::personaje::{base, Cargados, Estado, Personaje, HUESOS};
use jxmotor::escena::{Cuadro, ItemDin};
use jxmotor::gpu::{Motor, Opciones};
use jxmotor::mat::{self as m4, M4};
use khronos_egl as egl;
use std::path::Path;

const W: i32 = 360; const H: i32 = 450;
const DT: f32 = 1.0 / 60.0;

fn persp(fovy: f32, asp: f32, n: f32, f: f32) -> M4 {
    let t = 1.0 / (fovy / 2.0).tan(); let mut m = [0.0; 16];
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1.0; m[14] = 2.0 * f * n / (n - f); m
}
fn dist(a: [f32; 3], b: [f32; 3]) -> f32 { ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2) + (a[2] - b[2]).powi(2)).sqrt() }
fn punto(m: &M4, p: [f32; 3]) -> [f32; 3] { [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] }

/// un estado para la foto: nombre, velocidad (en el espacio del personaje: +Z adelante, -X derecha), agachado, cuántos
/// cuadros antes de la foto, desde qué cuadro va en el aire y adónde mira
struct Pose { n: &'static str, v: [f32; 3], ag: bool, cuadros: usize, salta: Option<usize>, mira: f32 }
/// un tramo del recorrido: nombre, cuadros, velocidad hacia adelante y al costado (+ derecha), agachado, en el aire,
/// cuánto gira por segundo y si es un tramo donde se puede correr con los dos pies en el aire
struct Tramo { n: &'static str, k: usize, adel: f32, der: f32, ag: bool, aire: bool, giro: f32 }

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let sal = a.get(1).cloned().unwrap_or("/tmp/claude-0/jxm/personaje".into()); std::fs::create_dir_all(&sal).unwrap();
    let skin = a.get(2).cloned().unwrap_or("Hero".into());
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxp_apk/activos/www".into());
    let cmu = std::env::var("JXM_CMU").unwrap_or("/home/user/Ports/web/emotes/cmu".into());
    let mut paq = Paquete::abrir(Path::new(&www)).expect("paquete");
    let mapa = jxjuego::mapa::armar(&mut paq, "RB_Flatgrass", 512, 750.0).expect("mapa");
    let (mut pj0, esc) = Personaje::cargar(&mut paq, &skin, 0, 1024, &mut Cargados::default()).expect("personaje");
    let con_nado = match (std::fs::read(format!("{cmu}/126_04.bin")), std::fs::read(format!("{cmu}/79_02.bin"))) { (Ok(x), Ok(y)) => { pj0.nado(&x, &y).expect("capturas de nado"); true } _ => false };
    println!("{}: {} mallas, {} materiales, {} texturas · tam {} ojo {} · capturas de nado: {}", pj0.skin, esc.c.mallas.len(), esc.c.mats.len(), esc.c.texs.len(), pj0.tam, pj0.ojo, con_nado);

    // el motor GLES fuera de pantalla (lo mismo que foto.rs)
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
    unsafe { m.cargar(&mapa.esc).expect("cargar mapa"); m.cargar(&esc).expect("cargar personaje"); }

    // dónde: el primer lugar de aparición, sobre el piso
    let sp = mapa.spawns.first().map(|s| s.0).unwrap_or([0.0, 0.0, 0.0]);
    let piso_y = |x: f32, z: f32| mapa.mundo.rayo([x, sp[1] + 50.0, z], [0.0, -1.0, 0.0], 200.0).map(|g| sp[1] + 50.0 - g.t).unwrap_or(sp[1]);

    // ---------------- 1. las fotos de cada estado ----------------
    let poses = [
        Pose { n: "quieto", v: [0.0; 3], ag: false, cuadros: 150, salta: None, mira: 0.0 },
        Pose { n: "caminar", v: [0.0, 0.0, 2.5], ag: false, cuadros: 117, salta: None, mira: 0.0 },
        Pose { n: "correr", v: [0.0, 0.0, 6.0], ag: false, cuadros: 113, salta: None, mira: 0.0 },
        Pose { n: "saltar", v: [0.0, 0.0, 6.0], ag: false, cuadros: 100, salta: Some(80), mira: 0.0 },
        Pose { n: "agachado", v: [0.0; 3], ag: true, cuadros: 120, salta: None, mira: 0.0 },
        Pose { n: "agachado_caminar", v: [0.0, 0.0, 3.0], ag: true, cuadros: 121, salta: None, mira: 0.0 },
        Pose { n: "mirar_abajo", v: [0.0; 3], ag: false, cuadros: 90, salta: None, mira: 0.8 },
    ];
    let vistas = ["frente", "costado", "tercera"];
    let (hw, hh) = (W as usize * poses.len(), H as usize * vistas.len());
    let mut hoja = vec![0u8; hw * hh * 4];
    for (ip, p) in poses.iter().enumerate() {
        let mut pj = pj0.clone();
        let yaw = 0.0f32; let mut piso = [sp[0], piso_y(sp[0], sp[2]), sp[2]]; let (mut vy, mut alto) = (0.0f32, 0.0f32);
        for k in 0..p.cuadros {
            let aire = p.salta.map(|s| k >= s).unwrap_or(false);
            if p.salta == Some(k) { vy = 4.65; }
            if aire { vy -= 9.81 * DT; alto += vy * DT; }
            let v = [p.v[0], if aire { vy } else { 0.0 }, p.v[2]];
            piso[0] += v[0] * DT; piso[2] += v[2] * DT; piso[1] = piso_y(piso[0], piso[2]);
            pj.animar(DT, &Estado { piso: [piso[0], piso[1] + alto, piso[2]], vel: v, yaw, mira: p.mira, en_suelo: !aire, agachado: p.ag, agua: None });
        }
        let raiz = [piso[0], piso[1] + alto, piso[2]];
        let mut items = mapa.items.clone(); pj.items(&base(raiz, yaw), &mut items);
        for (iv, vn) in vistas.iter().enumerate() {
            let px = unsafe { foto(&mut m, fb, &mapa, &items, raiz, yaw, pj0.tam, vn) };
            guardar(&format!("{sal}/{}_{}.png", p.n, vn), W as u32, H as u32, &px);
            for y in 0..H as usize { let o = ((iv * H as usize + y) * hw + ip * W as usize) * 4; hoja[o..o + W as usize * 4].copy_from_slice(&px[y * W as usize * 4..(y + 1) * W as usize * 4]); }
        }
    }
    guardar(&format!("{sal}/hoja.png"), hw as u32, hh as u32, &hoja);

    // ---------------- 2. el recorrido medido ----------------
    let tramos = [
        Tramo { n: "quieto", k: 90, adel: 0.0, der: 0.0, ag: false, aire: false, giro: 0.0 },
        Tramo { n: "caminar 2,5", k: 120, adel: 2.5, der: 0.0, ag: false, aire: false, giro: 0.0 },
        Tramo { n: "correr 6", k: 120, adel: 6.0, der: 0.0, ag: false, aire: false, giro: 0.0 },
        Tramo { n: "diagonal 6", k: 60, adel: 4.24, der: 4.24, ag: false, aire: false, giro: 0.0 },
        Tramo { n: "atrás 2,5", k: 90, adel: -2.5, der: 0.0, ag: false, aire: false, giro: 0.0 },
        Tramo { n: "costado 4", k: 90, adel: 0.0, der: -4.0, ag: false, aire: false, giro: 0.0 },
        Tramo { n: "salto", k: 57, adel: 6.0, der: 0.0, ag: false, aire: true, giro: 0.0 },
        Tramo { n: "aterriza+quieto", k: 90, adel: 0.0, der: 0.0, ag: false, aire: false, giro: 0.0 },
        Tramo { n: "agachado", k: 90, adel: 0.0, der: 0.0, ag: true, aire: false, giro: 0.0 },
        Tramo { n: "agachado 3", k: 120, adel: 3.0, der: 0.0, ag: true, aire: false, giro: 0.0 },
        Tramo { n: "se para", k: 90, adel: 0.0, der: 0.0, ag: false, aire: false, giro: 0.0 },
        Tramo { n: "curva 4", k: 120, adel: 4.0, der: 0.0, ag: false, aire: false, giro: 1.5 },
        Tramo { n: "corre 8,1", k: 120, adel: 8.1, der: 0.0, ag: false, aire: false, giro: 0.0 },
        Tramo { n: "frena", k: 90, adel: 0.0, der: 0.0, ag: false, aire: false, giro: 0.0 },
    ];
    let mut pj = pj0.clone(); let mut piso = [sp[0], piso_y(sp[0], sp[2]), sp[2]]; let mut yaw = 0.0f32; let (mut vy, mut alto) = (0.0f32, 0.0f32);
    let mut previos: Vec<Vec<[f32; 3]>> = vec![];   // (los huesos en el mundo de los dos cuadros anteriores)
    let mut pisa_prev: [Option<(usize, [f32; 3])>; 2] = [None, None];
    // (la velocidad sobre el piso va hacia la pedida con la aceleración del jugador, 18 m/s², como jugador.rs; en el aire no cambia)
    let mut vh = [0.0f32; 2];
    let mut todo_bien = true;
    // (cada tramo: lo de régimen —desde el cuadro 45, 0,75 s— y lo del cambio de estado —los primeros 45—)
    println!("\n{:<16} {:>14} {:>14} {:>9} {:>8} {:>22} {:>24} {:>9}", "tramo", "suela cm", "(al cambiar)", "vért. cm", "lejos m", "tirón cm (al cambiar)", "suela que pisa cm/s", "");
    for t in &tramos {
        let (mut s_min, mut s_max, mut c_min, mut c_max, mut v_min, mut lejos) = (1e9f32, -1e9f32, 1e9f32, -1e9f32, 1e9f32, 0.0f32);
        let (mut tiron, mut tiron_c, mut donde, mut donde_c) = (0.0f32, 0.0f32, (0usize, ""), (0usize, ""));
        let mut patina: Vec<f32> = vec![];
        for k in 0..t.k {
            yaw += t.giro * DT;
            let (fw, rt) = ([yaw.sin(), yaw.cos()], [-yaw.cos(), yaw.sin()]);   // (adelante y derecha en el piso)
            if t.aire && k == 0 { vy = 4.65; }
            if t.aire { vy -= 9.81 * DT; alto = (alto + vy * DT).max(0.0); }
            let meta = [fw[0] * t.adel + rt[0] * t.der, fw[1] * t.adel + rt[1] * t.der];
            if !t.aire { let d = [meta[0] - vh[0], meta[1] - vh[1]]; let l = d[0].hypot(d[1]); let k = if l > 18.0 * DT { 18.0 * DT / l } else { 1.0 }; vh = [vh[0] + d[0] * k, vh[1] + d[1] * k]; }
            let v = [vh[0], if t.aire { vy } else { 0.0 }, vh[1]];
            piso[0] += v[0] * DT; piso[2] += v[2] * DT; if !t.aire { alto = 0.0; }   // (en un piso plano: el recorrido mide la animación, no el terreno)
            let raiz = [piso[0], piso[1] + alto, piso[2]];
            pj.animar(DT, &Estado { piso: raiz, vel: v, yaw, mira: 0.0, en_suelo: !t.aire, agachado: t.ag, agua: None });
            let b = base(raiz, yaw);
            if !t.aire { let s = pj.suela().unwrap(); if k >= 45 { s_min = s_min.min(s); s_max = s_max.max(s); } else { c_min = c_min.min(s); c_max = c_max.max(s); } }
            if k % 2 == 0 {
                let cad = punto(&b, { let h = pj.hueso("Hips").unwrap(); [h[12], h[13], h[14]] });
                for q in pj.vertices(&paq) { let w = punto(&b, q); if !t.aire { v_min = v_min.min(w[1] - piso[1]); } lejos = lejos.max(dist(w, cad)); }
            }
            // (un tirón: lo que se aparta un hueso de seguir derecho, la segunda diferencia en el mundo)
            let hs: Vec<[f32; 3]> = HUESOS.iter().filter_map(|h| pj.hueso(h)).map(|h| punto(&b, [h[12], h[13], h[14]])).collect();
            if previos.len() == 2 { for (i, x) in hs.iter().enumerate() {
                let (p1, p0) = (previos[1][i], previos[0][i]); let d2 = dist([x[0] - p1[0], x[1] - p1[1], x[2] - p1[2]], [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]);
                if k >= 45 { if d2 > tiron { tiron = d2; donde = (k, HUESOS[i]); } } else if d2 > tiron_c { tiron_c = d2; donde_c = (k, HUESOS[i]); }
            } }
            previos.push(hs); if previos.len() > 2 { previos.remove(0); }
            // (la suela que pisa: de cada pie, el talón o la punta más bajo, a menos de 1 cm del piso; lo que se corre en el piso
            // de un cuadro al otro, si sigue pisando con el mismo punto)
            let su = pj.suelas().unwrap();
            for l in 0..2 {
                let j = if su[l][0][1] <= su[l][1][1] { 0 } else { 1 }; let c = punto(&b, su[l][j]);
                let pisa = !t.aire && su[l][j][1] < 0.01;
                if let (Some((jp, pv)), true) = (pisa_prev[l], pisa) { if jp == j && k >= 45 { patina.push((c[0] - pv[0]).hypot(c[2] - pv[2]) / DT); } }
                pisa_prev[l] = if pisa { Some((j, c)) } else { None };
            }
        }
        patina.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let med = patina.get(patina.len() / 2).copied().unwrap_or(0.0); let p90 = patina.get(patina.len() * 9 / 10).copied().unwrap_or(0.0);
        // criterios (de régimen): la suela no se hunde más de 1,5 cm ni flota más de 1,5 cm quieto, 2,5 cm caminando y 6,5 cm
        // corriendo (con los dos pies en el aire: la web baja el cuerpo hasta 6 cm), ningún vértice más de 3,5 cm bajo el
        // piso, ninguno a más de 1,4 m de la cadera (vértices que explotan) y ningún tirón de más de 15 cm. Lo que patina la
        // suela que pisa y lo que flota al cambiar de estado se informa: es lo mismo que en la web (la animación da igual que
        // la de la web a 0,1 mm: examples/comparar.rs)
        let vel = t.adel.hypot(t.der); let flota = if vel > 4.5 { 0.065 } else if vel > 0.0 { 0.025 } else { 0.015 };
        let ok = (t.aire || (s_min > -0.015 && s_max < flota)) && (t.aire || v_min > -0.035) && lejos < 1.4 * pj0.tam && tiron < 0.15;
        todo_bien &= ok;
        let rango = |a: f32, b: f32| if a > b { "-".to_string() } else { format!("{:+.1}..{:+.1}", a * 100.0, b * 100.0) };
        let vert = if t.aire { "-".to_string() } else { format!("{:+.1}", v_min * 100.0) };
        println!("{:<16} {:>14} {:>14} {:>9} {:>8.2} {:>8.1} ({:>4.1}) {:>4} {:<4} {:>6.1} (p90 {:>5.1}, n {:>3}) {:>9}", t.n, rango(s_min, s_max), rango(c_min, c_max), vert, lejos,
            tiron * 100.0, tiron_c * 100.0, donde.0, donde.1.get(..4).unwrap_or(""), med * 100.0, p90 * 100.0, patina.len(), if ok { "OK" } else { "FALLA" });
        if std::env::var("JXM_DONDE").is_ok() { println!("      (el tirón al cambiar: cuadro {} {})", donde_c.0, donde_c.1); }
    }

    // ---------------- 3. nadando, en el lago de RB_Construct ----------------
    if con_nado {
        let lago = jxjuego::mapa::armar(&mut paq, "RB_Construct", 512, 750.0).expect("RB_Construct");
        unsafe { m.vaciar(); m.cargar(&lago.esc).expect("cargar lago"); m.cargar(&esc).expect("cargar personaje"); }
        let ay = lago.agua_y.expect("el lago");
        for (n, vel) in [("nado_quieto", 0.0f32), ("nado_brazada", 3.0)] {
            let mut pj = pj0.clone(); let yaw = 0.6f32; let mut p = [90.0f32, 0.0, -20.0];
            // (flotando: el centro del jugador con la cara afuera, la raíz 1 m más abajo, como la web)
            for _ in 0..150 { p[0] += yaw.sin() * vel * DT; p[2] += yaw.cos() * vel * DT; pj.animar(DT, &Estado { piso: [p[0], ay - 1.6, p[2]], vel: [yaw.sin() * vel, 0.0, yaw.cos() * vel], yaw, mira: 0.0, en_suelo: false, agachado: false, agua: Some(ay) }); }
            let raiz = [p[0], ay - 1.6, p[2]]; let mut items = lago.items.clone(); pj.items(&base(raiz, yaw), &mut items);
            for vn in ["costado", "tercera"] { let px = unsafe { foto(&mut m, fb, &lago, &items, [raiz[0], ay - 0.6, raiz[2]], yaw, pj0.tam, vn) }; guardar(&format!("{sal}/{n}_{vn}.png"), W as u32, H as u32, &px); }
        }
    }
    println!("{}", if todo_bien { "TODO BIEN" } else { "HAY FALLAS" });
}

/// una foto del personaje (cuya raíz está en `raiz`, mirando a `yaw`): de frente, de costado (desde su derecha) o desde la
/// cámara de tercera persona del juego (3,1 m atrás de los ojos, mirando adonde mira el jugador)
unsafe fn foto(m: &mut Motor, fb: glow::Framebuffer, mapa: &jxjuego::mapa::Mapa, items: &[ItemDin], raiz: [f32; 3], yaw: f32, tam: f32, vista: &str) -> Vec<u8> {
    let blanco = [raiz[0], raiz[1] + 0.9 * tam, raiz[2]]; let fw = [yaw.sin(), 0.0, yaw.cos()];
    let (ojo, mira) = match vista {
        "frente" => ([blanco[0] + fw[0] * 3.0, blanco[1] + 0.3, blanco[2] + fw[2] * 3.0], blanco),
        "costado" => ([blanco[0] - fw[2] * 3.0, blanco[1] + 0.3, blanco[2] + fw[0] * 3.0], blanco),
        _ => { let ojos = [raiz[0], raiz[1] + 1.67 * tam, raiz[2]]; ([ojos[0] - fw[0] * 3.1, ojos[1], ojos[2] - fw[2] * 3.1], [ojos[0] + fw[0], ojos[1], ojos[2] + fw[2]]) }
    };
    let vp = m4::mul(&persp(0.75, W as f32 / H as f32, 0.05, mapa.lejos), &m4::mirar(ojo, mira, [0.0, 1.0, 0.0]));
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
