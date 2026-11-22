//! Banco de pruebas de JX Hand Engine (nativo): inspeccionar modelos, correr fotos (con el dibujo de lo que encontró) y
//! medir tiempos.
//!   jxhand-banco ver MODELO.tflite [todo]
//!   jxhand-banco foto CARPETA_MODELOS FOTO.png SALIDA.png
//!   jxhand-banco medir CARPETA_MODELOS FOTO.png [veces]
use image::{Rgba, RgbaImage};
use jxhand::mano::{self, Detector, Puntero, Roi, PUNTOS};
use std::{fs, time::Instant};

const HUESOS: [(usize, usize); 21] = [(0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (5, 6), (6, 7), (7, 8), (5, 9), (9, 10), (10, 11), (11, 12), (9, 13), (13, 14), (14, 15), (15, 16), (13, 17), (17, 18), (18, 19), (19, 20), (0, 17)];

fn linea(im: &mut RgbaImage, a: (f32, f32), b: (f32, f32), c: Rgba<u8>, grosor: f32) {
    let n = ((b.0 - a.0).hypot(b.1 - a.1) as usize).max(1);
    for i in 0..=n { let t = i as f32 / n as f32; punto(im, (a.0 + (b.0 - a.0) * t, a.1 + (b.1 - a.1) * t), grosor, c); }
}
fn punto(im: &mut RgbaImage, p: (f32, f32), r: f32, c: Rgba<u8>) {
    let (w, h) = im.dimensions();
    for dy in -(r as i32)..=(r as i32) { for dx in -(r as i32)..=(r as i32) {
        if (dx * dx + dy * dy) as f32 > r * r { continue; }
        let (x, y) = (p.0 as i32 + dx, p.1 as i32 + dy);
        if x >= 0 && y >= 0 && (x as u32) < w && (y as u32) < h { im.put_pixel(x as u32, y as u32, c); }
    } }
}
fn cuadrado(im: &mut RgbaImage, r: &Roi, c: Rgba<u8>) {
    let (co, si) = (r.ang.cos(), r.ang.sin()); let l = r.lado / 2.0;
    let es: Vec<(f32, f32)> = [(-1.0, -1.0), (1.0, -1.0), (1.0, 1.0), (-1.0, 1.0)].iter().map(|&(u, v): &(f32, f32)| (r.cx + (u * co - v * si) * l, r.cy + (u * si + v * co) * l)).collect();
    for i in 0..4 { linea(im, es[i], es[(i + 1) % 4], c, 1.5); }
    // la parte de arriba del cuadrado (hacia donde apuntan los dedos), más gruesa
    linea(im, es[0], es[1], c, 3.0);
}

fn cargar(carpeta: &str) -> (Detector, Puntero) {
    let d = Detector::nuevo(&fs::read(format!("{}/hand_detector.tflite", carpeta)).unwrap()).unwrap();
    let p = Puntero::nuevo(&fs::read(format!("{}/hand_landmarks_detector.tflite", carpeta)).unwrap()).unwrap();
    (d, p)
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    match a.get(1).map(|s| s.as_str()) {
        Some("ver") => {
            let m = jxhand::tflite::leer(&fs::read(&a[2]).unwrap()).unwrap();
            let mut cuenta = std::collections::BTreeMap::new();
            for o in &m.operadores { *cuenta.entry(format!("{:?}", o.op).split(|c| c == ' ' || c == '{').next().unwrap().to_string()).or_insert(0) += 1; }
            println!("tensores {} · operadores {} · {:?}", m.tensores.len(), m.operadores.len(), cuenta);
            for &i in &m.entradas { println!("entrada {} {:?} {:?}", m.tensores[i].nombre, m.tensores[i].forma, m.tensores[i].tipo); }
            for &i in &m.salidas { println!("salida {} {:?} {:?}", m.tensores[i].nombre, m.tensores[i].forma, m.tensores[i].tipo); }
            if a.get(3).map(|s| s == "todo").unwrap_or(false) {
                for (k, o) in m.operadores.iter().enumerate() {
                    let f = |v: &Vec<i32>| v.iter().map(|&i| if i < 0 { "-".into() } else { format!("{}{:?}", i, m.tensores[i as usize].forma) }).collect::<Vec<_>>().join(" ");
                    println!("{:3} {:?} | {} -> {}", k, o.op, f(&o.entradas), f(&o.salidas));
                }
            }
        }
        Some("foto") => {
            let (mut det, mut pun) = cargar(&a[2]);
            let mut im = image::open(&a[3]).unwrap().to_rgba8(); let (w, h) = im.dimensions();
            let rgba = im.as_raw().clone();
            let t0 = Instant::now();
            let palmas = det.detectar(&rgba, w as usize, h as usize);
            let t1 = t0.elapsed();
            println!("{}: {} palma(s) en {:.1} ms (mejor puntaje {:.3})", a[3], palmas.len(), t1.as_secs_f64() * 1e3, det.mejor);
            for (k, p) in palmas.iter().enumerate() {
                let roi = mano::roi_de_palma(p);
                let t2 = Instant::now(); let r = pun.puntos(&rgba, w as usize, h as usize, &roi); let t3 = t2.elapsed();
                let roi2 = mano::roi_de_puntos(&r.img);
                let r2 = pun.puntos(&rgba, w as usize, h as usize, &roi2);
                println!("  mano {}: palma {:.2} · presencia {:.3} → {:.3} (2ª pasada) · derecha {:.2} · {:.1} ms · lado {:.0} px, giro {:.0}°",
                    k, p.puntaje, r.presencia, r2.presencia, r2.derecha, t3.as_secs_f64() * 1e3, roi2.lado, roi2.ang.to_degrees());
                cuadrado(&mut im, &roi, Rgba([255, 200, 0, 255]));
                cuadrado(&mut im, &roi2, Rgba([0, 200, 255, 255]));
                for &(i, j) in &HUESOS { linea(&mut im, (r2.img[i].x, r2.img[i].y), (r2.img[j].x, r2.img[j].y), Rgba([255, 255, 255, 255]), 2.0); }
                for i in 0..PUNTOS { punto(&mut im, (r2.img[i].x, r2.img[i].y), 4.0, if i == 0 { Rgba([255, 60, 60, 255]) } else if i % 4 == 0 { Rgba([255, 62, 138, 255]) } else { Rgba([122, 60, 255, 255]) }); }
                // el largo de la mano en metros (muñeca → punta del medio, por los huesos): para ver que el 3D tiene sentido
                let d = |i: usize, j: usize| { let (p, q) = (r2.mundo[i], r2.mundo[j]); ((p.x - q.x).powi(2) + (p.y - q.y).powi(2) + (p.z - q.z).powi(2)).sqrt() };
                println!("     3D: muñeca→nudillo medio {:.1} cm, dedo medio {:.1} cm", d(0, 9) * 100.0, (d(9, 10) + d(10, 11) + d(11, 12)) * 100.0);
                let wv: [jxhand::esqueleto::V3; 21] = std::array::from_fn(|i| jxhand::esqueleto::V3::de(&r2.mundo[i]));
                let mr = jxhand::esqueleto::marco_palma(&wv, r2.derecha < 0.5);
                let wl: [jxhand::esqueleto::V3; 21] = std::array::from_fn(|i| wv[i].menos(wv[0]));
                let mr = jxhand::esqueleto::Marco { o: jxhand::esqueleto::V3::default(), ..mr };
                let an = jxhand::esqueleto::angulos(&wl, &mr); let ci = jxhand::esqueleto::cierre(&an);
                let g = |x: f32| x.to_degrees().round() as i32;
                println!("     ángulos (base, abre, medio, punta)°: {:?} · cierre {:?}", an.iter().map(|a| (g(a.flex), g(a.abre), g(a.medio), g(a.punta))).collect::<Vec<_>>(), ci.iter().map(|c| (c * 100.0).round() as i32).collect::<Vec<_>>());
            }
            im.save(&a[4]).unwrap();
        }
        Some("medir") => {
            let (mut det, mut pun) = cargar(&a[2]);
            let im = image::open(&a[3]).unwrap().to_rgba8(); let (w, h) = im.dimensions(); let rgba = im.as_raw().clone();
            let veces: usize = a.get(4).and_then(|s| s.parse().ok()).unwrap_or(20);
            let palmas = det.detectar(&rgba, w as usize, h as usize);
            let roi = palmas.first().map(mano::roi_de_palma).unwrap_or(Roi { cx: w as f32 / 2.0, cy: h as f32 / 2.0, lado: 300.0, ang: 0.0 });
            let t0 = Instant::now(); for _ in 0..veces { det.detectar(&rgba, w as usize, h as usize); } let td = t0.elapsed().as_secs_f64() * 1e3 / veces as f64;
            let t0 = Instant::now(); for _ in 0..veces { pun.puntos(&rgba, w as usize, h as usize, &roi); } let tp = t0.elapsed().as_secs_f64() * 1e3 / veces as f64;
            println!("detector {:.2} ms · puntos {:.2} ms (promedio de {})", td, tp, veces);
        }
        Some("perfil") => {
            for m in ["hand_detector", "hand_landmarks_detector"] {
                let mut red = jxhand::red::Red::cargar(&fs::read(format!("{}/{}.tflite", a[2], m)).unwrap()).unwrap();
                for v in red.entrada(0).iter_mut() { *v = 0.5; }
                red.correr();
                let mut acum: std::collections::BTreeMap<String, (f64, usize)> = Default::default();
                for _ in 0..10 { for (k, d, n) in red.correr_midiendo() { let e = acum.entry(k).or_insert((0.0, n)); e.0 += d / 10.0; } }
                let mut v: Vec<_> = acum.into_iter().collect(); v.sort_by(|a, b| b.1 .0.partial_cmp(&a.1 .0).unwrap());
                let tot: f64 = v.iter().map(|x| x.1 .0).sum();
                let (capas, g, otras) = red.cuentas();
                println!("== {} · {:.1} ms · 1×1: {:.0} M operaciones · resto: {:.0} M · capas 1×1 (n, entrada, salida): {:?}", m, tot, g / 1e6, otras / 1e6, &capas[..capas.len().min(8)]);
                for (k, (d, n)) in v.iter().take(12) { println!("   {:22} {:6.2} ms  {:4.1}%  ({} capas)", k, d, d / tot * 100.0, n); }
            }
        }
        Some("video") => {
            // un «video» hecho moviendo la foto: quieta con ruido (temblor) y después en movimiento (retraso), a 30 cps
            let mut motor = jxhand::Motor::nuevo(&fs::read(format!("{}/hand_detector.tflite", a[2])).unwrap(), &fs::read(format!("{}/hand_landmarks_detector.tflite", a[2])).unwrap()).unwrap();
            let base = image::open(&a[3]).unwrap().to_rgba8(); let (w, h) = (base.width() as usize, base.height() as usize); let b = base.as_raw();
            let (mut det, mut pun) = cargar(&a[2]);
            let mut sem = 7u64; let mut azar = move || { sem = sem.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407); ((sem >> 33) as f32 / (1u64 << 31) as f32) - 0.5 };
            // el cuadro k: la foto girada/corrida/escalada alrededor del centro, con ruido de sensor
            // la transformación en el tiempo (segundos): quieta 2 s y después se mueve
            let trans = |tt: f32| -> [f32; 4] { let mov = (tt - 2.0).clamp(0.0, 4.0);
                [0.35 * (mov * 1.6).sin(), 90.0 * (mov * 2.1).sin(), 50.0 * (mov * 1.3).sin(), 1.0 + 0.15 * (mov * 0.9).sin()] };
            let cuadro = |k: usize, ruido: &mut dyn FnMut() -> f32| -> (Vec<u8>, [f32; 4]) {
                let t4 = trans(k as f32 / 30.0); let (ang, dx, dy, esc) = (t4[0], t4[1], t4[2], t4[3]);
                let (c, s) = (ang.cos(), ang.sin()); let (cx, cy) = (w as f32 / 2.0, h as f32 / 2.0);
                let mut o = vec![0u8; w * h * 4];
                for y in 0..h { for x in 0..w {
                    // de la salida a la foto: inversa de (escalar, girar, correr)
                    let (ux, uy) = ((x as f32 - cx - dx) / esc, (y as f32 - cy - dy) / esc);
                    let (sx, sy) = (c * ux + s * uy + cx, -s * ux + c * uy + cy);
                    let (ix, iy) = (sx.round() as isize, sy.round() as isize);
                    let i = (y * w + x) * 4;
                    if ix >= 0 && iy >= 0 && (ix as usize) < w && (iy as usize) < h { let j = (iy as usize * w + ix as usize) * 4; for q in 0..3 { o[i + q] = (b[j + q] as f32 + ruido() * 14.0).clamp(0.0, 255.0) as u8; } }
                    o[i + 3] = 255;
                } }
                (o, [ang, dx, dy, esc])
            };
            // los puntos de verdad: los de la foto quieta (pasada doble), movidos con la misma transformación
            let p0 = det.detectar(b, w, h); let r0 = pun.puntos(b, w, h, &mano::roi_de_palma(&p0[0])); let r0 = pun.puntos(b, w, h, &mano::roi_de_puntos(&r0.img));
            let verdad = |t: [f32; 4], i: usize| { let (c, s) = (t[0].cos(), t[0].sin()); let (cx, cy) = (w as f32 / 2.0, h as f32 / 2.0); let (x, y) = (r0.img[i].x - cx, r0.img[i].y - cy);
                ((c * x - s * y) * t[3] + cx + t[1], (s * x + c * y) * t[3] + cy + t[2]) };
            let (mut quieta_crudo, mut quieta_filt, mut n_q) = (0f64, 0f64, 0usize);
            let (mut mov_crudo, mut mov_filt, mut mov_pred, mut n_m) = (0f64, 0f64, 0f64, 0usize);
            let mut ids = std::collections::BTreeSet::new(); let (mut detecciones, mut perdidas) = (0, 0);
            let mut largos: Vec<Vec<f32>> = vec![vec![]; 20]; let mut largos_crudos: Vec<Vec<f32>> = vec![vec![]; 20];
            let mut previo: Option<[(f32, f32); 21]> = None; let mut previo_c: Option<[(f32, f32); 21]> = None; let mut temblor_c = 0f64; let mut gestos = std::collections::BTreeMap::new();
            for k in 0..180 {
                let (img, tr) = cuadro(k, &mut azar);
                let t_ms = k as f64 * 1000.0 / 30.0;
                // salida sin filtro ni predicción (para comparar) y con todo
                if k == 0 { let ev = |n: &str, d: f32| std::env::var(n).ok().and_then(|v| v.parse().ok()).unwrap_or(d);
                    motor.cfg.prediccion_ms = ev("JXH_PRED", motor.cfg.prediccion_ms); motor.cfg.img_beta = ev("JXH_BETA", motor.cfg.img_beta); motor.cfg.img_min_corte = ev("JXH_MINC", motor.cfg.img_min_corte); motor.cfg.img_d_corte = ev("JXH_DC", motor.cfg.img_d_corte); }
                let manos = motor.procesar(&img, w, h, t_ms, false);
                if motor.corrio_detector { detecciones += 1; }
                if manos.is_empty() { perdidas += 1; previo = None; continue; }
                let m = &manos[0]; ids.insert(m.id);
                *gestos.entry(format!("{:?}", m.gesto)).or_insert(0) += 1;
                let crudo = pun.puntos(&img, w, h, &m.roi);
                // la salida se compara con dónde está la mano cuando se va a ver: la hora del cuadro + lo que se adelantó
                let tr_fut = trans(k as f32 / 30.0 + motor.cfg.prediccion_ms / 1000.0);
                let mut e_c = 0f64; let mut e_f = 0f64; let mut e_cf = 0f64;
                for i in 0..21 { let (vx, vy) = verdad(tr, i); let (fx, fy) = verdad(tr_fut, i); e_c += ((crudo.img[i].x - vx).hypot(crudo.img[i].y - vy)) as f64; e_f += ((m.img[i][0] * w as f32 - fx).hypot(m.img[i][1] * h as f32 - fy)) as f64; e_cf += ((crudo.img[i].x - fx).hypot(crudo.img[i].y - fy)) as f64; }
                let lado = m.roi.lado as f64;
                if k >= 15 && k < 60 {
                    // temblor: cuánto se mueve cada punto de un cuadro al siguiente estando quieta (en % de la mano)
                    if let Some(pr) = previo { let mut jc = 0f64; for i in 0..21 { jc += ((m.img[i][0] * w as f32 - pr[i].0).hypot(m.img[i][1] * h as f32 - pr[i].1)) as f64; } quieta_filt += jc / 21.0 / lado * 100.0; }
                    if let Some(pr) = previo_c { let mut jc = 0f64; for i in 0..21 { jc += ((crudo.img[i].x - pr[i].0).hypot(crudo.img[i].y - pr[i].1)) as f64; } temblor_c += jc / 21.0 / lado * 100.0; }
                    quieta_crudo += e_c / 21.0 / lado * 100.0; n_q += 1;
                }
                if k >= 75 { mov_crudo += e_c / 21.0 / lado * 100.0; mov_filt += e_f / 21.0 / lado * 100.0; mov_pred += e_cf / 21.0 / lado * 100.0; n_m += 1; }
                previo = Some(std::array::from_fn(|i| (m.img[i][0] * w as f32, m.img[i][1] * h as f32))); previo_c = Some(std::array::from_fn(|i| (crudo.img[i].x, crudo.img[i].y)));
                if m.calibrada { for (j, &(pa, hi)) in jxhand::esqueleto::HUESOS.iter().enumerate() {
                    let d = |p: [f32; 3], q: [f32; 3]| ((p[0] - q[0]).powi(2) + (p[1] - q[1]).powi(2) + (p[2] - q[2]).powi(2)).sqrt();
                    largos[j].push(d(m.mundo[pa], m.mundo[hi])); largos_crudos[j].push(d([crudo.mundo[pa].x, crudo.mundo[pa].y, crudo.mundo[pa].z], [crudo.mundo[hi].x, crudo.mundo[hi].y, crudo.mundo[hi].z]));
                } }
            }
            let cv = |v: &Vec<Vec<f32>>| { let mut t = 0f64; for l in v { let n = l.len().max(1) as f64; let me = l.iter().map(|&x| x as f64).sum::<f64>() / n; let sd = (l.iter().map(|&x| (x as f64 - me).powi(2)).sum::<f64>() / n).sqrt(); t += sd / me.max(1e-9) * 100.0; } t / v.len() as f64 };
            println!("pistas (ids) {:?} · cuadros sin mano {} · el detector corrió {} veces en 180 cuadros", ids, perdidas, detecciones);
            println!("quieta: error del modelo solo {:.2}% de la mano · temblor por cuadro: modelo solo {:.3}%, JX {:.3}%", quieta_crudo / n_q as f64, temblor_c / (n_q - 1).max(1) as f64, quieta_filt / (n_q - 1).max(1) as f64);
            println!("en movimiento: error del modelo solo {:.2}% (sin retraso) · con {:.0} ms de retraso: modelo solo {:.2}%, JX (filtrado y adelantado) {:.2}%", mov_crudo / n_m as f64, motor.cfg.prediccion_ms, mov_pred / n_m as f64, mov_filt / n_m as f64);
            println!("largo de los huesos (variación): modelo solo {:.1}% · esqueleto {:.2}%", cv(&largos_crudos), cv(&largos));
            println!("gestos: {:?}", gestos);
        }
        _ => eprintln!("uso: jxhand-banco ver MODELO [todo] | foto MODELOS FOTO SALIDA | medir MODELOS FOTO [veces]"),
    }
}
