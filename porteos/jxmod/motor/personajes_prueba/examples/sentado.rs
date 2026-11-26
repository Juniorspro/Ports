//! Sentado en los autos (personaje.rs: asientoPose, con la cabina de vehiculo.rs): cada auto del menú (Cars), manejando y
//! de acompañante, con el Hero, Freddy, Jake y uno grande (Sunman), medido contra la malla del auto (en el marco del
//! cuerpo): cuánto queda la cabeza bajo el techo, la cola sobre el almohadón y las suelas sobre el piso de debajo de cada
//! una (+ arriba, − adentro), y las fotos (por la ventanilla, de adelante, de adentro desde el otro asiento, la cámara de
//! primera persona del auto —sin el cuerpo, como la web— y sin el auto). hoja_*.png: las fotos juntas.
//! Uso: sentado [CARPETA_SALIDA] [SKINS…]   (JXM_WWW: la carpeta del paquete; JXM_SIN_FOTOS=1: sólo las medidas)
use glow::HasContext;
use jxjuego::fisica::{add, qeje, rot, Fisica};
use jxjuego::forma::{cuerpo_de_prefab, nombres_menu, Catalogo};
use jxjuego::objetos;
use jxjuego::paquete::Paquete;
use jxjuego::personaje::{Asiento, Cargados, Estado, Personaje};
use jxjuego::vehiculo::{Mando, Tipo, Vehiculos};
use jxmotor::escena::{Cuadro, ItemDin};
use jxmotor::gpu::{Motor, Opciones};
use jxmotor::mat::{self as m4, M4};
use khronos_egl as egl;
use std::path::Path;

const W: i32 = 400; const H: i32 = 300;
const DT: f32 = 1.0 / 60.0;

fn persp(fovy: f32, asp: f32, n: f32, f: f32) -> M4 {
    let t = 1.0 / (fovy / 2.0).tan(); let mut m = [0.0; 16];
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1.0; m[14] = 2.0 * f * n / (n - f); m
}
fn punto(m: &M4, p: [f32; 3]) -> [f32; 3] { [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] }

/// una hoja de fotos de W×H en filas de `cols`
struct Hoja { px: Vec<u8>, cols: usize, n: usize, filas: usize }
impl Hoja {
    fn nueva(cols: usize, filas: usize) -> Hoja { Hoja { px: vec![0u8; W as usize * cols * H as usize * filas * 4], cols, n: 0, filas } }
    fn poner(&mut self, f: &[u8]) {
        let (cx, cy) = (self.n % self.cols, self.n / self.cols); let ancho = W as usize * self.cols; self.n += 1;
        if cy >= self.filas { return; }
        for y in 0..H as usize { let o = ((cy * H as usize + y) * ancho + cx * W as usize) * 4; self.px[o..o + W as usize * 4].copy_from_slice(&f[y * W as usize * 4..(y + 1) * W as usize * 4]); }
    }
    fn guardar(&self, ruta: &str) {
        let filas = self.n.div_ceil(self.cols).clamp(1, self.filas); let ancho = W as usize * self.cols;
        let f = std::fs::File::create(ruta).unwrap(); let mut enc = png::Encoder::new(std::io::BufWriter::new(f), ancho as u32, (H as usize * filas) as u32);
        enc.set_color(png::ColorType::Rgba); enc.set_depth(png::BitDepth::Eight); enc.write_header().unwrap().write_image_data(&self.px[..ancho * H as usize * filas * 4]).unwrap();
    }
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let sal = a.get(1).cloned().unwrap_or("/tmp/claude-0/arma_mano/sentado".into()); std::fs::create_dir_all(&sal).unwrap();
    let skins: Vec<String> = if a.len() > 2 { a[2..].to_vec() } else { ["Hero", "Freddy", "Jake", "Sunman"].iter().map(|s| s.to_string()).collect() };
    let fotos = std::env::var("JXM_SIN_FOTOS").is_err();
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxm/www_todo".into());
    let mut paq = Paquete::abrir(Path::new(&www)).expect("paquete");
    let mapa = jxjuego::mapa::armar(&mut paq, "RB_Flatgrass", 256, 750.0).expect("mapa");
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
    let foto = |m: &mut Motor, items: &[ItemDin], ojo: [f32; 3], mira: [f32; 3], fov: f32| -> Vec<u8> {
        let vp = m4::mul(&persp(fov, W as f32 / H as f32, 0.02, mapa.lejos), &m4::mirar(ojo, mira, [0.0, 1.0, 0.0]));
        unsafe {
            m.poner_cuadro(Cuadro { vp, pos: ojo, luz: mapa.luz, agua_y: mapa.agua_y, suelo_y: None, tiempo: 1.0, luces: mapa.luces_cerca(ojo, 6), esp: vec![], items: items.to_vec(), efectos: vec![] });
            m.dibujar(Some(fb), W, H);
            let gl = &m.gl; let mut px = vec![0u8; (W * H * 4) as usize];
            gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb)); gl.read_pixels(0, 0, W, H, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelPackData::Slice(Some(&mut px)));
            let fila = (W * 4) as usize; let mut o = vec![0u8; px.len()];
            for y in 0..H as usize { o[y * fila..(y + 1) * fila].copy_from_slice(&px[(H as usize - 1 - y) * fila..(H as usize - y) * fila]); }
            for p in o.chunks_exact_mut(4) { p[3] = 255; }
            o
        }
    };
    let sp0 = mapa.spawns.first().map(|s| s.0).unwrap_or([0.0; 3]); let sp = [sp0[0] - 30.0, sp0[1], sp0[2] - 30.0];
    let piso_y = |x: f32, z: f32| mapa.mundo.rayo([x, sp[1] + 50.0, z], [0.0, -1.0, 0.0], 200.0).map(|g| sp[1] + 50.0 - g.t).unwrap_or(sp[1]);
    let mut ya = Cargados::default(); let mut oya = objetos::Cargados::default();
    let mut protos: Vec<(String, Personaje)> = vec![];
    for s in &skins { let (pj, e) = Personaje::cargar(&mut paq, s, 0, 256, &mut ya).expect("personaje"); unsafe { m.cargar(&e).unwrap(); } protos.push((s.clone(), pj)); }
    let nombres = objetos::por_nombre(&paq.d); let mut cat = Catalogo::nuevo(&paq);
    let autos = nombres_menu(&paq, "Vehicles");
    println!("{:<30} {:>9} {:>9} {:>15} {:>8}  {}", "auto asiento skin", "techo cm", "cola cm", "suelas cm", "escala", "manos (dz, dy al asiento)");
    let mut peores = (1e9f64, 0.0f64, 0.0f64);
    for auto in &autos {
        let mut hoja = Hoja::nueva(5, 6);
        let pf = cat.prefab(&paq, auto).unwrap();
        if !Vehiculos::es_vehiculo(&pf) { continue; }
        let mut fis = Fisica::nueva(); let mut vehs = Vehiculos::nuevo();
        let p = [sp[0] as f64 + 4.0, piso_y(sp[0] + 4.0, sp[2]) as f64 + 0.8, sp[2] as f64 + 3.0];
        let id = fis.agregar(cuerpo_de_prefab(&pf, p, qeje([0.0, 1.0, 0.0], 0.5), false)); vehs.agregar(&paq, &pf, id, &mut fis, None);
        if vehs.de(id).map(|v| v.tipo != Tipo::Auto).unwrap_or(true) { continue; }
        for _ in 0..120 { vehs.paso(&mut fis, &mapa.mundo, None, DT as f64, &Mando::default()); fis.paso(&mapa.mundo, DT as f64); }
        let b = fis.cuerpo(id).unwrap().clone(); let vh = vehs.de(id).unwrap().clone();
        let (pf_draw, e) = objetos::armar(&mut paq, &nombres, auto, 256, &mut oya).expect("prefab"); unsafe { m.cargar(&e).unwrap(); }
        let cq = pf.cap_q.map(|c| [-c[0], -c[1], -c[2], c[3]]).unwrap_or([0.0, 0.0, 0.0, 1.0]); let qq = jxjuego::fisica::qmul(b.q, cq);
        let bm = m4::mul(&jxjuego::mapa::trs([b.pos[0] as f32, b.pos[1] as f32, b.pos[2] as f32], [qq[0] as f32, qq[1] as f32, qq[2] as f32, qq[3] as f32], [1.0; 3]), &jxjuego::mapa::trs([-pf.c[0] as f32, -pf.c[1] as f32, -pf.c[2] as f32], [0.0, 0.0, 0.0, 1.0], [1.0; 3]));
        let mut auto_items = vec![]; vh.items(&pf_draw, &bm, &mut auto_items);
        let qi = [-b.q[0], -b.q[1], -b.q[2], b.q[3]];
        let loc = |wp: [f32; 3]| rot(qi, [wp[0] as f64 - b.pos[0], wp[1] as f64 - b.pos[1], wp[2] as f64 - b.pos[2]]);
        let w = |p: [f64; 3]| { let r = add(b.pos, rot(b.q, p)); [r[0] as f32, r[1] as f32, r[2] as f32] };
        // (los dos primeros asientos: el del que maneja y el de al lado)
        for asi in 0..vh.asientos.len().min(2) {
            let cab = vehs.cabina(&paq, id, asi); let s = vh.asientos[asi];
            let ps = add(b.pos, rot(b.q, [s[0], s[1] + 0.75, s[2]]));
            let q32 = [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32];
            let asiento = Asiento { pos: [ps[0] as f32, (ps[1] - 0.5) as f32, ps[2] as f32], veh: [b.pos[0] as f32, b.pos[1] as f32, b.pos[2] as f32], q: q32, manejando: asi == 0, cab: cab.clone() };
            // (el corte de la malla más alto debajo de y1 y arriba de y0, o el más bajo arriba de y0)
            let abajo = |x: f64, z: f64, y0: f64, y1: f64| vehs.cortes(id, x, z).and_then(|l| l.into_iter().filter(|y| *y < y1 && *y > y0).fold(None, |a: Option<f64>, y| Some(a.map_or(y, |a| a.max(y)))));
            let arriba = |x: f64, z: f64, y0: f64| vehs.cortes(id, x, z).and_then(|l| l.into_iter().filter(|y| *y > y0).fold(None, |a: Option<f64>, y| Some(a.map_or(y, |a| a.min(y)))));
            for (skin, pj0) in &protos {
                let mut pj = pj0.clone();
                for _ in 0..40 { pj.sentar(&paq, Some(asiento.clone())); pj.animar(DT, &Estado { piso: [0.0; 3], vel: [0.0; 3], yaw: 0.0, mira: 0.0, en_suelo: false, agachado: false, agua: None }); }
                let bs = pj.base_sentado().unwrap();
                let vs: Vec<[f64; 3]> = pj.vertices(&paq).iter().map(|v| loc(punto(&bs, *v))).collect();
                let hueso = |n: &str| pj.hueso(n).map(|h| loc(punto(&bs, [h[12], h[13], h[14]])));
                let (hips, cabeza) = (hueso("Hips").unwrap(), hueso("Head").unwrap());
                let esc = { let h = pj.hueso("Hips").unwrap(); let bh = m4::mul(&bs, &h); ((bh[0] * bh[0] + bh[1] * bh[1] + bh[2] * bh[2]) as f64).sqrt() };
                // la cabeza: lo más alto de la piel contra lo primero de la malla arriba (de 45 cm sobre el asiento para arriba)
                let tope = vs.iter().fold([0.0, -1e9, 0.0], |a, v| if v[1] > a[1] { *v } else { a });
                let _ = cabeza; let techo = arriba(tope[0], tope[2], s[1] + 0.45).map(|t| t - tope[1]);
                if std::env::var("JXM_DEP").is_ok() { println!("   {auto} {asi} {skin} tope {:+.2} {:+.2} {:+.2} cortes {:?}", tope[0] - s[0], tope[1] - s[1], tope[2] - s[2], vehs.cortes(id, tope[0], tope[2]).map(|l| l.iter().map(|y| ((y - s[1]) * 100.0).round() / 100.0).collect::<Vec<_>>())); }
                // la cola: lo más bajo de la piel cerca de la cadera (15 cm de costado, a escala) contra el almohadón debajo
                let r = 0.15 * pj.tam as f64;
                let cola = vs.iter().filter(|v| (v[0] - hips[0]).hypot(v[2] - hips[2]) < r).fold([0.0, 1e9, 0.0], |a, v| if v[1] < a[1] { *v } else { a });
                let gap_cola = abajo(cola[0], cola[2], cola[1] - 0.5, cola[1] + 0.12).map(|c| cola[1] - c);
                // las suelas: talón y punta de cada pie contra el piso debajo
                let suelas: Vec<f64> = pj.suelas().map(|su| su.iter().flat_map(|l| l.iter().map(|q| loc(punto(&bs, *q)))).filter_map(|p| Some(p[1] - abajo(p[0], p[2], p[1] - 0.4, p[1] + 0.15)?)).collect()).unwrap_or_default();
                let mm = |l: &[f64]| if l.is_empty() { "-".to_string() } else { format!("{:+.1} {:+.1}", l.iter().fold(1e9f64, |a, b| a.min(*b)) * 100.0, l.iter().fold(-1e9f64, |a, b| a.max(*b)) * 100.0) };
                let manos = if asi == 0 { ["RightHand", "LeftHand"].iter().filter_map(|n| hueso(n)).map(|h| format!("({:+.2} {:+.2})", h[2] - s[2], h[1] - s[1])).collect::<Vec<_>>().join(" ") } else { String::new() };
                println!("{:<30} {:>9} {:>9} {:>15} {:>8.2}  {}", format!("{auto} {asi} {skin}"), techo.map(|t| format!("{:+.1}", t * 100.0)).unwrap_or("-".into()),
                    gap_cola.map(|g| format!("{:+.1}", g * 100.0)).unwrap_or("-".into()), mm(&suelas), esc, manos);
                if let Some(t) = techo { peores.0 = peores.0.min(t); }
                if let Some(g) = gap_cola { peores.1 = peores.1.max(g.abs()); }
                for su in &suelas { peores.2 = peores.2.max(su.abs()); }
                // las fotos: el Hero en los dos asientos, los demás manejando
                if !fotos || (asi > 0 && skin != "Hero") { continue; }
                let lado = if s[0] >= 0.0 { 1.0 } else { -1.0 };
                let mut items = mapa.items.clone(); items.extend(auto_items.iter().cloned()); pj.items(&bs, &mut items);
                let mut solo = mapa.items.clone(); pj.items(&bs, &mut solo);
                let sv = w([s[0], s[1] + 0.35, s[2] + 0.1]);
                let otro = vh.asientos.get(if asi == 0 { 1 } else { 0 }).copied().unwrap_or([-s[0], s[1], s[2]]);
                let primera = (w([s[0], s[1] + 0.75, s[2]]), w([s[0], s[1] + 0.65, s[2] + 2.0]));
                let vistas: [(&[ItemDin], [f32; 3], [f32; 3], f32); 5] = [
                    (&items, w([s[0] + lado * 1.7, s[1] + 0.55, s[2] + 0.35]), sv, 0.9),
                    (&items, w([s[0] * 0.6, s[1] + 0.85, s[2] + 2.4]), sv, 0.9),
                    (&items, w([otro[0], otro[1] + 0.75, otro[2] - 0.05]), sv, 1.2),
                    (&auto_items_con_mapa(&mapa.items, &auto_items), primera.0, primera.1, 1.2),
                    (&solo, w([s[0] + lado * 1.4, s[1] + 0.3, s[2] + 0.25]), w([s[0], s[1] + 0.2, s[2] + 0.2]), 1.0),
                ];
                for (it, ojo, mira, fov) in vistas.iter() { let px = foto(&mut m, it, *ojo, *mira, *fov); hoja.poner(&px); }
            }
        }
        if fotos && hoja.n > 0 { hoja.guardar(&format!("{sal}/{auto}.png")); }
    }
    println!("peor: techo {:+.1} cm, |cola| {:.1} cm, |suela| {:.1} cm", peores.0 * 100.0, peores.1 * 100.0, peores.2 * 100.0);
}
fn auto_items_con_mapa(mapa: &[ItemDin], auto: &[ItemDin]) -> Vec<ItemDin> { let mut v = mapa.to_vec(); v.extend(auto.iter().cloned()); v }
