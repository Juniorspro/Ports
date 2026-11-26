//! Los efectos (jxjuego::efectos) dibujados por los tres motores —OpenGL ES 3 (Mesa), OpenGL ES 2 (Mesa) y Vulkan
//! (lavapipe)— fuera de pantalla, en RB_Flatgrass: una explosión en el piso (destello, bola de fuego, humo, chispas,
//! escombros, quemadura y fuego que queda), tiros contra una pared con sus trazas, el fogonazo, chispas, polvo y agujeros
//! de bala, y una columna de humo aparte. Saca fotos de cada momento con cada motor, las compara (diferencia por píxel,
//! entera y sólo donde están los efectos) y mide lo que cuestan 500 partículas en cada uno.
//! Uso: efectos [CARPETA_SALIDA] [ANCHO ALTO]   (JXM_WWW: la carpeta del paquete; JXM_MOTORES="gl3,gl2,vk")
//!      efectos volcar CARPETA   (el atlas y unos cuadros de una escena fija, para compararlos con efectos.js en Node)
//! Vulkan necesita jxmotor con «vk»: cargo build --release -p personajes-prueba --example efectos --features jxmotor/vk
use glow::HasContext;
use jxjuego::efectos::{self, Efectos, Sup, Tipo, GRAV};
use jxjuego::paquete::Paquete;
use jxmotor::escena::{Cuadro, EF_MARCAS};
use jxmotor::gpu::{FotoVk, Opciones};
use jxmotor::mat::{self as m4, M4};
use khronos_egl as egl;
use std::path::Path;
use std::time::Instant;

const DT: f32 = 1.0 / 60.0;
type V = [f32; 3];

fn persp(fovy: f32, asp: f32, n: f32, f: f32) -> M4 {
    let t = 1.0 / (fovy / 2.0).tan(); let mut m = [0.0; 16];
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1.0; m[14] = 2.0 * f * n / (n - f); m
}
fn ad(a: V, b: V, k: f32) -> V { [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k] }

/// un momento para fotografiar: el nombre, la cámara y los efectos de ese instante
struct Momento { n: String, ojo: V, vp: M4, efectos: Vec<(u32, Vec<f32>)>, luces: Vec<[f32; 12]> }

/// uno de los tres motores, fuera de pantalla
enum Mot { Gl3(jxmotor::gpu::Motor, glow::Framebuffer), Gl2(jxmotor::gl2::Motor, glow::Framebuffer), Vk(Box<dyn FotoVk>) }
impl Mot {
    unsafe fn cargar(&mut self, e: &jxmotor::escena::Escena) { match self { Mot::Gl3(m, _) => m.cargar(e), Mot::Gl2(m, _) => m.cargar(e), Mot::Vk(m) => m.cargar(e) }.expect("cargar"); }
    unsafe fn foto(&mut self, c: Cuadro, w: i32, h: i32) -> Vec<u8> {
        let leer = |gl: &glow::Context, fb: glow::Framebuffer| {
            let mut px = vec![0u8; (w * h * 4) as usize];
            gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb)); gl.read_pixels(0, 0, w, h, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelPackData::Slice(Some(&mut px)));
            let fila = (w * 4) as usize; let mut o = vec![0u8; px.len()];
            for y in 0..h as usize { o[y * fila..(y + 1) * fila].copy_from_slice(&px[(h as usize - 1 - y) * fila..(h as usize - y) * fila]); }
            o
        };
        let mut px = match self {
            Mot::Gl3(m, fb) => { m.poner_cuadro(c); m.dibujar(Some(*fb), w, h); leer(&m.gl, *fb) }
            Mot::Gl2(m, fb) => { m.poner_cuadro(c); m.dibujar(Some(*fb), w, h); leer(&m.gl, *fb) }
            Mot::Vk(m) => { m.poner_cuadro(c); m.foto().expect("foto vk") }
        };
        for p in px.chunks_exact_mut(4) { p[3] = 255; }
        px
    }
    /// espera a que la placa termine (para medir)
    unsafe fn esperar(&self) { match self { Mot::Gl3(m, _) => m.gl.finish(), Mot::Gl2(m, _) => m.gl.finish(), Mot::Vk(_) => {} } }
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    if a.get(1).map(|s| s == "volcar").unwrap_or(false) { volcar(a.get(2).map(|s| s.as_str()).unwrap_or("/tmp/claude-0/jxm/efx/volcado")); return; }
    if a.get(1).map(|s| s == "agua").unwrap_or(false) { agua(a.get(2).map(|s| s.as_str()).unwrap_or("/tmp/claude-0/jxm/efx")); return; }
    let sal = a.get(1).cloned().unwrap_or("/tmp/claude-0/jxm/efx".into()); std::fs::create_dir_all(&sal).unwrap();
    let (w, h): (i32, i32) = (a.get(2).and_then(|x| x.parse().ok()).unwrap_or(1280), a.get(3).and_then(|x| x.parse().ok()).unwrap_or(590));
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxp_apk/activos/www".into());
    let motores: Vec<String> = std::env::var("JXM_MOTORES").unwrap_or("gl3,gl2,vk".into()).split(',').map(|s| s.trim().to_string()).collect();
    let mut paq = Paquete::abrir(Path::new(&www)).expect("paquete");
    let mapa = jxjuego::mapa::armar(&mut paq, "RB_Flatgrass", 1024, 750.0).expect("mapa");
    let atlas = efectos::atlas();

    // ---------------- la escena: delante de la aparición, una pared de prueba (8 × 3,2 m, de hormigón) a 11 m ----------------
    // (RB_Flatgrass no tiene paredes con choque cerca: sólo el muro invisible del borde)
    let sp = mapa.spawns.first().map(|s| s.0).unwrap_or([0.0; 3]);
    let piso_y = |x: f32, z: f32, y0: f32| mapa.mundo.rayo([x, y0 + 30.0, z], [0.0, -1.0, 0.0], 90.0).map(|g| y0 + 30.0 - g.t).unwrap_or(y0);
    // (mirando con el sol a la espalda —la pared de frente al sol—; la cámara 14 m adelante de la aparición, fuera de su tarima)
    let sol = m4::norm(mapa.luz.sol); let fw = m4::norm([-sol[0], 0.0, -sol[2]]); let der = m4::norm(m4::cruz(fw, [0.0, 1.0, 0.0]));
    let ojo = { let p = ad(sp, fw, 14.0); [p[0], piso_y(p[0], p[2], sp[1]) + 1.7, p[2]] };
    let muro = { let p = ad(ojo, fw, 11.0); [p[0], piso_y(p[0], p[2], ojo[1] - 1.7), p[2]] };
    let suelo = muro[1];
    let tex_muro = mapa.esc.c.texs.iter().find(|t| { let n = t.n.to_lowercase(); n.contains("concrete") || n.contains("cement") || n.contains("brick") || n.contains("wall") }).map(|t| (t.id, t.n.clone()));
    println!("aparición {:?} · cámara {:?} · pared en {:?} · textura {:?}", sp, ojo, muro, tex_muro);
    let (esc_muro, item_muro) = pared(muro, fw, der, 8.0, 3.2, 0.4, tex_muro.map(|t| t.0).unwrap_or(-1));
    let mut items = mapa.items.clone(); items.push(item_muro);
    // (un rayo contra la cara de adelante de la pared, o contra el piso)
    let rayo = |o: V, d: V, l: f32| -> Option<(f32, V)> {
        let n = [-fw[0], -fw[1], -fw[2]]; let den = m4::punto(d, n);
        let mut mejor = mapa.mundo.rayo(o, d, l).map(|g| (g.t, g.n));
        if den < -1e-4 { let t = m4::punto(m4::sub(muro, o), n) / den; let p = ad(o, d, t); let q = m4::sub(p, muro);
            if t > 0.0 && t < l && m4::punto(q, der).abs() < 4.0 && p[1] > muro[1] && p[1] < muro[1] + 3.2 && mejor.map(|m| t < m.0).unwrap_or(true) { mejor = Some((t, n)); } }
        mejor
    };
    let proy = persp(70f32.to_radians(), w as f32 / h as f32, 0.08, mapa.lejos * 1.05);
    let vp_de = |o: V, m: V| m4::mul(&proy, &m4::mirar(o, m, [0.0, 1.0, 0.0]));
    let mira = [muro[0], suelo + 1.3, muro[2]];
    let vp = vp_de(ojo, mira);
    // (de cerca: la quemadura y los agujeros desde 4 m, mirando un poco hacia abajo)
    let expl = { let p = ad(ad(ojo, fw, 6.5), der, -1.6); [p[0], piso_y(p[0], p[2], suelo) + 0.4, p[2]] };
    // (de cerca: desde 3 m detrás de la quemadura, mirando entre ella y la pared: la quemadura, los agujeros del piso y los de la pared)
    let ojo_c = { let p = ad(expl, fw, -3.0); [p[0], suelo + 2.1, p[2]] };
    let vp_c = vp_de(ojo_c, { let p = ad(ad(expl, fw, 2.2), der, 0.9); [p[0], suelo + 0.4, p[2]] });
    let boca = ad(ad(ad(ojo, fw, 0.6), der, 0.22), [0.0, 1.0, 0.0], -0.2);
    // (los agujeros de la pared, desde 1,8 m)
    let ojo_e = { let p = ad(ad(muro, fw, -1.8), der, -0.1); [p[0], muro[1] + 1.25, p[2]] };
    let vp_e = vp_de(ojo_e, { let p = ad(muro, der, -0.1); [p[0], muro[1] + 1.0, p[2]] });

    let mut ef = Efectos::nuevo(20261123); ef.alto_px = h as f32; ef.luz_de(&mapa.luz);
    println!("luz del humo {:?}", ef.luz);
    let mut momentos: Vec<Momento> = vec![];
    // los tiros: puntos de la pared alrededor de donde se mira (rayos de verdad desde la boca) y dos al piso
    let blancos: Vec<V> = (0..9).map(|k| {
        let (x, y) = ([-1.1f32, -0.5, 0.3, 0.9, -0.2, 0.6, -0.8, 1.3, 0.1][k], [1.4f32, 0.9, 1.6, 1.1, 0.5, 0.3, 0.2, 1.9, 1.2][k]);
        ad([muro[0], muro[1] + y, muro[2]], der, x)
    }).collect();
    let tirar = |ef: &mut Efectos, k: usize| {
        let b = if k < blancos.len() { blancos[k] } else { let p = ad(ad(ojo, fw, 4.0 + k as f32 * 0.4), der, 0.5 * (k as f32 - 10.0)); [p[0], suelo, p[2]] };
        let d = m4::norm(m4::sub(b, boca)); let l = (m4::punto(m4::sub(b, boca), m4::sub(b, boca))).sqrt() + 1.0;
        if let Some((t, n)) = rayo(boca, d, l) { let p = ad(boca, d, t); ef.fogonazo(boca); ef.traza(boca, p); ef.impacto(p, n, Sup::Mundo); }
    };
    let total = 154;
    for f in 0..=total {
        ef.paso(DT, GRAV);
        if f == 0 { let piso = efectos::piso_bajo(&mapa.mundo, expl, 1.0); ef.explosion(expl, 1.0, piso); println!("explosión en {:?}, piso {:?}", expl, piso); }
        if (4..=8).contains(&f) { tirar(&mut ef, f - 4); }
        if (30..=35).contains(&f) { tirar(&mut ef, f - 30 + 5); }
        if f == 36 { tirar(&mut ef, 11); tirar(&mut ef, 12); }
        // (una columna de humo aparte, a la derecha, contra la pared)
        if f % 5 == 0 {
            let az = |ef: &mut Efectos, a: f32, b: f32| a + ef.azar() as f32 * (b - a);
            let p = ad(ad(muro, fw, -1.5), der, 3.2); let p = [p[0] + az(&mut ef, -0.2, 0.2), suelo + 0.2, p[2] + az(&mut ef, -0.2, 0.2)];
            let v = [az(&mut ef, -0.2, 0.2), az(&mut ef, 1.0, 1.6), az(&mut ef, -0.2, 0.2)]; let vida = az(&mut ef, 2.5, 3.5); let t = az(&mut ef, 0.3, 0.5);
            if let Some(x) = ef.particula(p, v, vida, t, [0.42, 0.41, 0.4, 0.5], Tipo::Humo, 2.2) { x.fr = 0.8; }
        }
        let foto = match f { 8 => Some(("a_explosion", ojo, vp)), 36 => Some(("b_tiros", ojo, vp)), 150 => Some(("c_humo", ojo, vp)), 152 => Some(("d_cerca", ojo_c, vp_c)), 154 => Some(("e_agujeros", ojo_e, vp_e)), _ => None };
        if let Some((n, o, v)) = foto {
            ef.reenviar_marcas();
            let b = ef.bloques(&v, o);
            println!("{n}: {} partículas vivas, {} mandadas, {} saltadas; {} bloques; {} luces", ef.cuantas(), ef.vistas, ef.saltadas, b.len(), ef.luces().len());
            momentos.push(Momento { n: n.into(), ojo: o, vp: v, efectos: b, luces: ef.luces() });
        }
    }
    // (con o sin efectos; `solo`: sin el mapa ni luces —el cielo de fondo—, para comparar sólo las partículas y las marcas)
    let cuadro_de = |m: &Momento, con: bool, solo: bool| {
        let mut luces = if con && !solo { m.luces.clone() } else { vec![] }; if !solo { luces.extend(mapa.luces_cerca(m.ojo, 6)); } luces.truncate(8);
        // (sin efectos: las marcas vacías, que el motor no deje las de antes)
        Cuadro { vp: m.vp, pos: m.ojo, luz: mapa.luz, agua_y: mapa.agua_y, suelo_y: None, tiempo: 1.0, luces, esp: vec![], items: if solo { vec![] } else { items.clone() }, efectos: if con { m.efectos.clone() } else { vec![(EF_MARCAS, vec![])] } }
    };
    let cuadro = |m: &Momento, con: bool| cuadro_de(m, con, false);

    // ---------------- 500 partículas para medir: 250 de humo y 250 de fuego y chispas, a 8 m ----------------
    let mut ef5 = Efectos::nuevo(5); ef5.alto_px = h as f32; ef5.luz_de(&mapa.luz);
    for k in 0..500 {
        let c = ad(ad(ojo, fw, 8.0), der, 0.0); let r = |ef: &mut Efectos| ef.azar() as f32 * 2.0 - 1.0;
        let p = [c[0] + r(&mut ef5) * 3.0, suelo + 0.3 + (r(&mut ef5) + 1.0) * 1.5, c[2] + r(&mut ef5) * 3.0];
        let (tipo, tam, col) = match k % 4 { 0 | 1 => (Tipo::Humo, 0.5, [0.3, 0.29, 0.28, 0.6]), 2 => (Tipo::Fuego, 0.35, [1.0, 1.0, 1.0, 0.9]), _ => (Tipo::Chispa, 0.03, [1.0, 0.8, 0.4, 1.0]) };
        let v = [r(&mut ef5), r(&mut ef5) + 1.0, r(&mut ef5)];
        if let Some(x) = ef5.particula(p, v, 60.0, tam, col, tipo, 0.6) { x.t = 1.0; x.rampa = tipo == Tipo::Fuego; }
    }
    // (lo que cuesta en la CPU: mover y armar los bloques de las 500, cada cuadro)
    let t0 = Instant::now(); let mut nb = 0; for _ in 0..200 { ef5.paso(DT * 0.001, GRAV); nb += ef5.bloques(&vp, ojo).iter().map(|b| b.1.len()).sum::<usize>(); }
    let cpu_us = t0.elapsed().as_secs_f64() * 1e6 / 200.0;
    let m500 = Momento { n: "p500".into(), ojo, vp, efectos: ef5.bloques(&vp, ojo), luces: vec![] };
    // (cuánto tapan: la suma de las áreas de los carteles en la pantalla, en pantallas enteras —lo que pesa en un teléfono—)
    let cubre: f32 = m500.efectos.iter().filter(|b| b.0 != EF_MARCAS).flat_map(|b| b.1[6..].chunks(16)).map(|f| {
        let q = m4::sub([f[0], f[1], f[2]], ojo); let d = m4::punto(q, q).sqrt().max(0.1); let lado = 2.0 * f[9] * (h as f32 / 2.0) / (35f32.to_radians().tan() * d);
        lado * lado * if f[12] > 0.5 && f[12] < 1.5 { 1.0 + m4::punto([f[13], f[14], f[15]], [f[13], f[14], f[15]]).sqrt() / (2.0 * f[9]).max(1e-3) } else { 1.0 }
    }).sum::<f32>() / (w * h) as f32;
    // (OpenGL 2 arma las esquinas de cada una en la CPU)
    let t0 = Instant::now(); let mut v2: Vec<f32> = Vec::with_capacity(500 * 4 * jxmotor::gl2::PART_V2);
    for _ in 0..200 { v2.clear(); for b in m500.efectos.iter().filter(|b| b.0 != EF_MARCAS) { let (d, a) = ([b.1[0], b.1[1], b.1[2]], [b.1[3], b.1[4], b.1[5]]); for f in b.1[6..].chunks(16) { jxmotor::gl2::part_vertices(f, d, a, ojo, &mut v2); } } }
    let gl2_us = t0.elapsed().as_secs_f64() * 1e6 / 200.0;
    println!("500 partículas: {} mandadas · CPU (paso + bloques) {:.0} µs por cuadro ({} floats) · OpenGL 2 armarlas {:.0} µs ({} KB a subir) · cubren {:.2} pantallas",
        ef5.vistas, cpu_us, nb / 200, gl2_us, v2.len() * 4 / 1024, cubre);

    // ---------------- cada motor: las fotos de cada momento (con y sin efectos) y el costo ----------------
    let mut fotos: Vec<(String, Vec<Vec<u8>>, Vec<Vec<u8>>)> = vec![];
    let mut fotos_solo: Vec<(String, Vec<Vec<u8>>, Vec<Vec<u8>>)> = vec![];
    let mut costos: Vec<String> = vec![];
    for mn in &motores {
        let mut m = unsafe { abrir(mn, w, h) };
        let t = Instant::now(); unsafe { m.cargar(&mapa.esc); m.cargar(&esc_muro); m.cargar(&atlas); }
        println!("{mn}: cargado en {:.0} ms", t.elapsed().as_secs_f64() * 1000.0);
        // (dos cuadros para que se acomode: la sombra, los destinos)
        for _ in 0..2 { unsafe { m.foto(cuadro(&momentos[0], false), w, h); } }
        let (mut con, mut sin) = (vec![], vec![]);
        for mo in &momentos {
            let s = unsafe { m.foto(cuadro(mo, false), w, h) }; let c = unsafe { m.foto(cuadro(mo, true), w, h) };
            guardar(&format!("{sal}/{mn}_{}.png", mo.n), w as u32, h as u32, &c);
            con.push(c); sin.push(s);
        }
        let (mut con_s, mut sin_s) = (vec![], vec![]);
        for mo in &momentos { sin_s.push(unsafe { m.foto(cuadro_de(mo, false, true), w, h) }); con_s.push(unsafe { m.foto(cuadro_de(mo, true, true), w, h) }); }
        fotos_solo.push((mn.clone(), con_s, sin_s));
        // el costo: 30 cuadros sin partículas y 30 con las 500, alternando de a 5 (para promediar el ruido)
        let (mut t_sin, mut t_con) = (0f64, 0f64);
        for r in 0..6 { for con_p in [false, true] { for _ in 0..5 {
            let c = cuadro(&m500, con_p); let t = Instant::now(); let px = unsafe { let px = m.foto(c, w, h); m.esperar(); px };
            let ms = t.elapsed().as_secs_f64() * 1000.0; if con_p { t_con += ms } else { t_sin += ms }
            if r == 0 && con_p { guardar(&format!("{sal}/{mn}_p500.png"), w as u32, h as u32, &px); }
        } } }
        let (t_sin, t_con) = (t_sin / 30.0, t_con / 30.0);
        let placa = match &m { Mot::Vk(v) => v.tiempos().map(|(t, d)| format!(" · placa {t:.1} ms: {d}")).unwrap_or_default(), _ => String::new() };
        costos.push(format!("{mn}: cuadro sin partículas {t_sin:.1} ms, con 500 {t_con:.1} ms (+{:.1} ms){placa}", t_con - t_sin));
        fotos.push((mn.clone(), con, sin));
    }
    for c in &costos { println!("{c}"); }

    // ---------------- la comparación: cada par de motores, entera y donde hay efectos ----------------
    for (titulo, fotos, pre) in [("con el mapa", &fotos, "hoja"), ("sin el mapa (sólo el cielo de fondo: las partículas y las marcas solas)", &fotos_solo, "solo")] {
    println!("\n{titulo}\n{:<12} {:<9} {:>9} {:>9} {:>11} {:>12} {:>12} {:>10}", "momento", "par", "media", ">16 %", "efecto px", "media efecto", "aporte dif", "efecto >16");
    for (k, mo) in momentos.iter().enumerate() {
        // (dónde están los efectos: donde la foto con efectos se aparta de la sin efectos en cualquier motor)
        let n = (w * h) as usize; let mut zona = vec![false; n];
        for (_, con, sin) in fotos.iter() { for i in 0..n { let d = (0..3).map(|c| (con[k][i * 4 + c] as i32 - sin[k][i * 4 + c] as i32).abs()).max().unwrap(); if d > 8 { zona[i] = true; } } }
        let nz = zona.iter().filter(|&&z| z).count();
        for i in 0..fotos.len() { for j in i + 1..fotos.len() {
            let (a, b) = (&fotos[i], &fotos[j]);
            let (mut s, mut mas, mut sz, mut sa, mut mz) = (0f64, 0usize, 0f64, 0f64, 0usize);
            for p in 0..n {
                let d: Vec<i32> = (0..3).map(|c| (a.1[k][p * 4 + c] as i32 - b.1[k][p * 4 + c] as i32).abs()).collect();
                s += d.iter().sum::<i32>() as f64 / 3.0; if *d.iter().max().unwrap() > 16 { mas += 1; }
                if zona[p] {
                    sz += d.iter().sum::<i32>() as f64 / 3.0; if *d.iter().max().unwrap() > 16 { mz += 1; }
                    // (lo que aporta el efecto en cada motor —con menos sin—, comparado: deja afuera las diferencias del mapa)
                    sa += (0..3).map(|c| (((a.1[k][p * 4 + c] as i32 - a.2[k][p * 4 + c] as i32) - (b.1[k][p * 4 + c] as i32 - b.2[k][p * 4 + c] as i32)).abs()) as f64).sum::<f64>() / 3.0;
                }
            }
            println!("{:<12} {:<9} {:>9.2} {:>8.2}% {:>11} {:>12.2} {:>12.2} {:>9.2}%", mo.n, format!("{}-{}", a.0, b.0), s / n as f64, mas as f64 * 100.0 / n as f64, nz, sz / nz.max(1) as f64, sa / nz.max(1) as f64, mz as f64 * 100.0 / nz.max(1) as f64);
        } }
        // la hoja: los motores uno al lado del otro (a la mitad) y, abajo, la diferencia del aporte de los efectos ×4 con el primero
        let (hw, hh) = (w as usize / 2, h as usize / 2); let nf = fotos.len();
        let mut hoja = vec![0u8; hw * nf * hh * 2 * 4];
        for (fi, f) in fotos.iter().enumerate() { for y in 0..hh { for x in 0..hw {
            let s = ((y * 2) * w as usize + x * 2) * 4; let o = (y * hw * nf + fi * hw + x) * 4;
            hoja[o..o + 4].copy_from_slice(&f.1[k][s..s + 4]);
            let o2 = ((y + hh) * hw * nf + fi * hw + x) * 4;
            for c in 0..3 { let a0 = fotos[0].1[k][s + c] as i32 - fotos[0].2[k][s + c] as i32; let b0 = f.1[k][s + c] as i32 - f.2[k][s + c] as i32; hoja[o2 + c] = ((a0 - b0).abs() * 4).min(255) as u8; }
            hoja[o2 + 3] = 255;
        } } }
        guardar(&format!("{sal}/{pre}_{}.png", mo.n), (hw * nf) as u32, (hh * 2) as u32, &hoja);
    }
    }
}

/// abre uno de los motores fuera de pantalla: OpenGL ES 3 o 2 con EGL sin superficie (un FBO, como nativo/examples/foto.rs)
/// o Vulkan sin ventana
unsafe fn abrir(nombre: &str, w: i32, h: i32) -> Mot {
    // (JXM_SIN_RETOQUE: sin el retoque final en los tres —así las partículas de OpenGL 2 se comparan sin la aproximación del
    // retoque, que OpenGL 2 hace en cada dibujo y no una vez al final—)
    // (JXM_SIN_AO: sin la oclusión —en Vulkan, las marcas y las partículas van en la pasada de la escena—)
    let op = Opciones { retoque: std::env::var("JXM_SIN_RETOQUE").is_err(), ao: std::env::var("JXM_SIN_AO").is_err(), ..Opciones::default() };
    let op2 = jxmotor::gl2::Opciones2 { retoque: op.retoque, ..Default::default() };
    if nombre == "vk" { return Mot::Vk(jxmotor::gpu::vk_sin_ventana(w as u32, h as u32, op).expect("Vulkan")); }
    let gl2 = nombre == "gl2";
    let e = egl::DynamicInstance::<egl::EGL1_5>::load_required().expect("libEGL");
    let d = e.get_platform_display(0x31DD, egl::DEFAULT_DISPLAY, &[egl::ATTRIB_NONE]).expect("pantalla EGL");
    e.initialize(d).unwrap(); e.bind_api(egl::OPENGL_ES_API).unwrap();
    let bit = if gl2 { egl::OPENGL_ES2_BIT } else { egl::OPENGL_ES3_BIT };
    let cfg = e.choose_first_config(d, &[egl::SURFACE_TYPE, egl::PBUFFER_BIT, egl::RENDERABLE_TYPE, bit, egl::NONE]).unwrap().or_else(|| e.choose_first_config(d, &[egl::NONE]).unwrap()).unwrap();
    let ctx = e.create_context(d, cfg, None, &[egl::CONTEXT_MAJOR_VERSION, if gl2 { 2 } else { 3 }, egl::NONE]).unwrap();
    e.make_current(d, None, None, Some(ctx)).unwrap();
    let gl = glow::Context::from_loader_function(|s| e.get_proc_address(s).map_or(std::ptr::null(), |p| p as *const _));
    println!("{nombre}: {}", gl.get_parameter_string(glow::RENDERER));
    let t = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(t)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::RGBA8, w, h);
    let f = gl.create_framebuffer().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::RENDERBUFFER, Some(t));
    // (OpenGL 2 dibuja directo en la salida: con profundidad)
    if gl2 { let p = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(p)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::DEPTH_COMPONENT16, w, h); gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::DEPTH_ATTACHMENT, glow::RENDERBUFFER, Some(p)); }
    std::mem::forget(e);
    if gl2 { Mot::Gl2(jxmotor::gl2::Motor::nuevo(gl, op2).expect("motor gl2"), f) } else { Mot::Gl3(jxmotor::gpu::Motor::nuevo(gl, op).expect("motor gl3"), f) }
}

/// la pared de prueba: una caja de `ancho` × `alto` × `grueso` con la cara de adelante (normal −`fw`) centrada en `base`
/// (abajo, en el piso), con la textura `tex` (-1: blanca) a 1 repetición por metro; la malla y el material son los -3000
fn pared(base: V, fw: V, der: V, ancho: f32, alto: f32, grueso: f32, tex: i64) -> (jxmotor::escena::Escena, jxmotor::escena::ItemDin) {
    use jxmotor::escena::{Cabecera, Escena, ItemDin, Malla, Mat};
    let medio = |x: f32| -> u16 { let b = x.to_bits(); let s = ((b >> 16) & 0x8000) as u16; let e = ((b >> 23) & 0xff) as i32 - 127 + 15; if e <= 0 { s } else { s | ((e as u16) << 10) | ((b & 0x7f_ffff) >> 13) as u16 } };
    let (hx, hy, hz) = (ancho / 2.0, alto / 2.0, grueso / 2.0);
    // (en su espacio: x a lo ancho, y arriba, z a lo grueso; la matriz la pone en el mundo)
    let caras: [([f32; 3], [f32; 3], [f32; 3], f32, f32); 6] = [
        ([0.0, 0.0, -1.0], [-1.0, 0.0, 0.0], [0.0, 1.0, 0.0], ancho, alto), ([0.0, 0.0, 1.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0], ancho, alto),
        ([1.0, 0.0, 0.0], [0.0, 0.0, -1.0], [0.0, 1.0, 0.0], grueso, alto), ([-1.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, 1.0, 0.0], grueso, alto),
        ([0.0, 1.0, 0.0], [1.0, 0.0, 0.0], [0.0, 0.0, -1.0], ancho, grueso), ([0.0, -1.0, 0.0], [1.0, 0.0, 0.0], [0.0, 0.0, 1.0], ancho, grueso)];
    // (cada cara con u × v = su normal: de frente, en sentido contrario a las agujas del reloj)
    let (mut vb, mut ib) = (vec![], vec![]);
    for (k, (n, u, v, lu, lv)) in caras.iter().enumerate() {
        let c = [n[0] * hx, n[1] * hy, n[2] * hz];
        for (a, b) in [(-1.0f32, -1.0f32), (1.0, -1.0), (1.0, 1.0), (-1.0, 1.0)] {
            let p = [c[0] + u[0] * a * lu / 2.0 + v[0] * b * lv / 2.0, c[1] + u[1] * a * lu / 2.0 + v[1] * b * lv / 2.0, c[2] + u[2] * a * lu / 2.0 + v[2] * b * lv / 2.0];
            for (i, h) in [hx, hy, hz].iter().enumerate() { vb.extend_from_slice(&((((p[i] + h) / (2.0 * h)).clamp(0.0, 1.0) * 65535.0).round() as u16).to_le_bytes()); }
            vb.extend_from_slice(&[(n[0] * 127.0) as i8 as u8, (n[1] * 127.0) as i8 as u8, (n[2] * 127.0) as i8 as u8, 0]);
            vb.extend_from_slice(&medio((a * 0.5 + 0.5) * lu / 2.0).to_le_bytes()); vb.extend_from_slice(&medio((0.5 - b * 0.5) * lv / 2.0).to_le_bytes());
        }
        let o = (k * 4) as u16; for i in [0u16, 1, 2, 0, 2, 3] { ib.extend_from_slice(&(o + i).to_le_bytes()); }
    }
    let vo = 0; let io = vb.len(); let mut datos = vb; datos.extend_from_slice(&ib);
    let malla = Malla { id: -3000, v: 24, mn: [-hx, -hy, -hz], sc: [2.0 * hx, 2.0 * hy, 2.0 * hz], i32: 0, ni: 36, vo, io, lo: -1, so: -1, lm: -1 };
    let mat = Mat { ti: [0.0; 12], pbr: [0.85, 0.0, 0.04], fol: 0, id: -3000, t2: -1, terr: None, c: [0.8, 0.8, 0.78, 1.0], st: [1.0, 1.0, 0.0, 0.0], t: tex, blend: 0, cut: 0, unlit: 0, add: 0, agua: 0, em: [0.0; 3] };
    // (la matriz: x por la derecha de la cámara —la pared se ve de frente—, y arriba, z hacia adelante; el centro de la caja)
    let c = [base[0] + fw[0] * hz, base[1] + hy, base[2] + fw[2] * hz]; let up = [0.0, 1.0, 0.0];
    let x = [-der[0], -der[1], -der[2]];
    let mm = [x[0], x[1], x[2], 0.0, up[0], up[1], up[2], 0.0, fw[0], fw[1], fw[2], 0.0, c[0], c[1], c[2], 1.0];
    let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![malla], mats: vec![mat], texs: vec![], lms: vec![], items: vec![], agua: None, cielo: None };
    (Escena { c: cab, datos }, ItemDin { m: -3000, s0: 0, sn: 36, mat: -3000, mm, esf: [c[0], c[1], c[2], (hx * hx + hy * hy + hz * hz).sqrt()], fl: 0, h: vec![] })
}

fn guardar(ruta: &str, w: u32, h: u32, px: &[u8]) {
    let f = std::fs::File::create(ruta).unwrap(); let mut enc = png::Encoder::new(std::io::BufWriter::new(f), w, h);
    enc.set_color(png::ColorType::Rgba); enc.set_depth(png::BitDepth::Eight); enc.write_header().unwrap().write_image_data(px).unwrap();
}

/// con agua (el lago de RB_Construct): una explosión en la orilla y humo sobre el agua, vistos desde arriba del agua —en
/// Vulkan las partículas van en la pasada del agua, después de ella— con los tres motores; fotos y diferencias
fn agua(sal: &str) {
    std::fs::create_dir_all(sal).unwrap();
    let (w, h) = (960i32, 443i32);
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxp_apk/activos/www".into());
    let mut paq = Paquete::abrir(Path::new(&www)).expect("paquete");
    let mapa = jxjuego::mapa::armar(&mut paq, "RB_Construct", 1024, 750.0).expect("mapa");
    let ay = mapa.agua_y.expect("el lago");
    let ojo = [90.0, ay + 2.2, -36.0]; let p = [90.0, ay + 0.3, -22.0];
    let vp = m4::mul(&persp(70f32.to_radians(), w as f32 / h as f32, 0.08, mapa.lejos * 1.05), &m4::mirar(ojo, [90.0, ay + 1.0, -20.0], [0.0, 1.0, 0.0]));
    let mut ef = Efectos::nuevo(3); ef.alto_px = h as f32; ef.luz_de(&mapa.luz);
    let mut cuadros = vec![];
    for f in 0..=40 {
        ef.paso(DT, GRAV);
        if f == 0 { ef.explosion(p, 1.0, Some((ay, [0.0, 1.0, 0.0]))); }
        if f == 10 || f == 40 { let b = ef.bloques(&vp, ojo); let mut l = ef.luces(); l.extend(mapa.luces_cerca(ojo, 6)); l.truncate(8); cuadros.push((f, b, l)); }
    }
    let mut fotos: Vec<(String, Vec<Vec<u8>>)> = vec![];
    for mn in ["gl3", "gl2", "vk"] {
        let mut m = unsafe { abrir(mn, w, h) }; unsafe { m.cargar(&mapa.esc); m.cargar(&efectos::atlas()); }
        let mut v = vec![];
        for (f, b, l) in &cuadros {
            let c = Cuadro { vp, pos: ojo, luz: mapa.luz, agua_y: mapa.agua_y, suelo_y: None, tiempo: 1.0, luces: l.clone(), esp: vec![], items: mapa.items.clone(), efectos: b.clone() };
            let _ = unsafe { m.foto(c.clone(), w, h) }; let px = unsafe { m.foto(c, w, h) };
            guardar(&format!("{sal}/agua_{mn}_{f}.png"), w as u32, h as u32, &px); v.push(px);
        }
        fotos.push((mn.to_string(), v));
    }
    for (k, (f, _, _)) in cuadros.iter().enumerate() { for i in 0..3 { for j in i + 1..3 {
        let (a, b) = (&fotos[i].1[k], &fotos[j].1[k]); let n = (w * h) as usize;
        let s: f64 = (0..n).map(|p| (0..3).map(|c| (a[p * 4 + c] as i32 - b[p * 4 + c] as i32).abs()).sum::<i32>() as f64 / 3.0).sum::<f64>() / n as f64;
        let mas = (0..n).filter(|&p| (0..3).any(|c| (a[p * 4 + c] as i32 - b[p * 4 + c] as i32).abs() > 16)).count();
        println!("agua cuadro {f}: {}-{} media {:.2}, >16 {:.2}%", fotos[i].0, fotos[j].0, s, mas as f64 * 100.0 / n as f64);
    } } }
}

/// una escena fija (sin mapa: el piso en y = 0) para compararla número a número con efectos.js corrido en Node con los
/// mismos números al azar (mulberry32): una explosión, dos impactos, el fogonazo y una traza; pasos de 1/64 s y los bloques
/// y las luces de algunos cuadros, en JSON. Y el atlas, byte a byte
fn volcar(dir: &str) {
    std::fs::create_dir_all(dir).unwrap();
    std::fs::write(format!("{dir}/atlas.bin"), efectos::atlas_px()).unwrap();
    let (w, h) = (1280.0f32, 590.0f32); let ojo = [0.0, 3.0, 25.0];
    let vp = m4::mul(&persp(70f32.to_radians(), w / h, 0.1, 800.0), &m4::mirar(ojo, [0.0, 1.0, 0.0], [0.0, 1.0, 0.0]));
    let mut ef = Efectos::nuevo(12345); ef.alto_px = h; ef.agujeros = false;
    let mut sem = Efectos::nuevo(12345); let primeros: Vec<f64> = (0..4).map(|_| sem.azar()).collect();
    let mut cuadros = vec![];
    ef.bloques(&vp, ojo);
    ef.explosion([0.0, 0.5, 0.0], 1.0, Some((0.0, [0.0, 1.0, 0.0])));
    ef.impacto([2.0, 1.0, -3.0], [0.0, 0.0, 1.0], Sup::Mundo); ef.impacto([-2.0, 0.0, 1.0], [0.0, 1.0, 0.0], Sup::Cuerpo);
    ef.fogonazo([0.3, 1.5, 20.0]); ef.traza([0.3, 1.5, 20.0], [2.0, 1.0, -3.0]);
    for f in 1..=200 {
        ef.paso(1.0 / 64.0, GRAV);
        if [1, 3, 10, 40, 100, 200].contains(&f) {
            ef.reenviar_marcas();
            let b = ef.bloques(&vp, ojo);
            cuadros.push(serde_json::json!({ "f": f, "bloques": b.iter().map(|(t, d)| serde_json::json!([t, d])).collect::<Vec<_>>(), "luces": ef.luces(), "n": ef.cuantas() }));
        }
    }
    let j = serde_json::json!({ "vp": vp.to_vec(), "ojo": ojo, "alto": h, "azar": primeros, "cuadros": cuadros });
    std::fs::write(format!("{dir}/rust.json"), serde_json::to_string(&j).unwrap()).unwrap();
    println!("volcado en {dir}: atlas.bin y rust.json ({} cuadros)", cuadros.len());
}
