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
    if let Some(n) = std::env::var("JXH_HILOS").ok().and_then(|v| v.parse().ok()) { jxhand::hilos::configurar(n); }
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
                let mr = jxhand::esqueleto::marco_palma(&wv, r2.derecha > 0.5);
                let wl: [jxhand::esqueleto::V3; 21] = std::array::from_fn(|i| wv[i].menos(wv[0]));
                let mr = jxhand::esqueleto::Marco { o: jxhand::esqueleto::V3::default(), ..mr };
                let an = jxhand::esqueleto::angulos(&wl, &mr); let ci = jxhand::esqueleto::cierre(&an);
                let nn = jxhand::esqueleto::normal_palma(&mr);
                // la palma mira a la cámara si su normal apunta hacia ella (z negativa: z crece alejándose)
                println!("     x en la imagen: muñeca {:.0}, punta del pulgar {:.0}, punta del índice {:.0}, punta del meñique {:.0} · z punta del pulgar {:.3}, del meñique {:.3}", r2.img[0].x, r2.img[4].x, r2.img[8].x, r2.img[20].x, r2.mundo[4].z, r2.mundo[20].z);
                println!("     normal de la palma (x, y, z): ({:.2}, {:.2}, {:.2}) → {}", nn.x, nn.y, nn.z, if nn.z < 0.0 { "la palma mira a la cámara" } else { "el dorso mira a la cámara" });
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
        Some("noche") => {
            // ¿ve de noche? Cada foto se oscurece como la saca una cámara de celular con poca luz (ruido de fotones y de
            // lectura, la ganancia de la cámara al tope) y se compara con lo que encontró en la foto buena:
            //   detecta = el detector encuentra la palma · sigue = con el cuadrado del cuadro anterior, la presencia pasa
            //   0,5 · error = distancia media de los 21 puntos a los de la foto buena, en % del largo de la palma
            // uso: noche MODELOS FOTO... (variable JXH_SEMILLAS: cuántos ruidos distintos por nivel, 6 por defecto)
            let (mut det, mut pun) = cargar(&a[2]);
            if std::env::var("JXH_PROM").map(|v| v == "0").unwrap_or(false) { mano::PROMEDIAR.store(false, std::sync::atomic::Ordering::Relaxed); }
            if let Some(v) = std::env::var("JXH_SUAV").ok().and_then(|v| v.parse().ok()) { det.luz.suavizar_desde = v; pun.luz.suavizar_desde = v; }
            if let Some(v) = std::env::var("JXH_MEDIO").ok().and_then(|v| v.parse().ok()) { det.luz.medio_objetivo = v; pun.luz.medio_objetivo = v; }
            let det_realce = std::env::var("JXH_DETREALCE").map(|v| v == "1").unwrap_or(false);
            let acum_on = !std::env::var("JXH_ACUM").map(|v| v == "0").unwrap_or(false);
            let semillas: u64 = std::env::var("JXH_SEMILLAS").ok().and_then(|v| v.parse().ok()).unwrap_or(6);
            let niveles: [(&str, f32); 6] = [("1/4", 0.25), ("1/16", 1.0 / 16.0), ("1/32", 1.0 / 32.0), ("1/64", 1.0 / 64.0), ("1/128", 1.0 / 128.0), ("1/256", 1.0 / 256.0)];
            // [nivel][con realce] → (veces, detecta, sigue, suma de error, n error, suma de presencia, suma del mejor puntaje, ganancia)
            let mut acc = vec![[(0u32, 0u32, 0u32, 0f64, 0u32, 0f64, 0f64, 0f64); 2]; niveles.len()];
            let mut usadas = 0;
            for caso in 0..(a.len() - 3) * 2 {
                let foto = &a[3 + caso / 2];
                let mut im = image::open(foto).unwrap().to_rgba8(); if caso % 2 == 1 { im = image::imageops::flip_horizontal(&im); }
                let (w, h) = (im.width() as usize, im.height() as usize); let b = im.as_raw();
                det.luz.activo = false; pun.luz.activo = false; det.acumular = false;
                let p0 = det.detectar(b, w, h);
                let Some(pa) = p0.first().cloned() else { println!("{}: sin mano en la foto buena, no cuenta", foto); continue; };
                // la referencia: el cuadrado ya asentado (6 pasadas en la foto buena), así el error mide sólo lo que hace
                // la oscuridad y no lo que el cuadrado se acomoda en las primeras pasadas
                let mut r1 = pun.puntos(b, w, h, &mano::roi_de_palma(&pa));
                for _ in 0..5 { r1 = pun.puntos(b, w, h, &mano::roi_de_puntos(&r1.img)); }
                let roi_ref = mano::roi_de_puntos(&r1.img);
                let rf = pun.puntos(b, w, h, &roi_ref);
                // contra qué se compara: las mismas 4 pasadas de seguimiento desde el mismo cuadrado, en la foto buena (así
                // la diferencia es sólo lo que hacen la oscuridad y el ruido)
                let rf = { let mut roi = roi_ref; let mut r = rf.clone(); for _ in 0..4 { r = pun.puntos(b, w, h, &roi); roi = mano::roi_de_puntos(&r.img); } r };
                if rf.presencia < 0.9 { println!("{}: presencia {:.2} en la foto buena, no cuenta", foto, rf.presencia); continue; }
                let palma = (rf.img[0].x - rf.img[9].x).hypot(rf.img[0].y - rf.img[9].y).max(1.0);
                usadas += 1;
                for (ni, &(_, k)) in niveles.iter().enumerate() {
                    for con in 0..2 {
                        det.acumular = con == 1 && acum_on; det.luz.activo = con == 1 && det_realce; pun.luz.activo = con == 1;
                        for sem in 0..semillas {
                            let o = oscurecer(b, k, sem * 7919 + ni as u64 * 104729 + usadas as u64);
                            let e = &mut acc[ni][con]; e.0 += 1;
                            // el detector mira 3 cuadros seguidos (cada uno con su ruido, como mientras se busca la mano)
                            // y cuenta lo que encuentra en el tercero
                            det.seguido = false;
                            for q in 0..2u64 { det.detectar(&oscurecer(b, k, sem * 7919 + q * 17 + ni as u64 * 104729 + usadas as u64 + 2_000_000), w, h); det.seguido = true; }
                            let ps = det.detectar(&o, w, h); e.6 += det.mejor as f64;
                            if ps.iter().any(|p| (p.caja[0] - pa.caja[0]).hypot(p.caja[1] - pa.caja[1]) < pa.caja[2].max(pa.caja[3]) * 0.5) { e.1 += 1; }
                            // seguir 4 cuadros (cada uno con su ruido) desde el cuadrado bueno, como en el video
                            let mut roi = roi_ref; let mut ok = true; let mut r = rf.clone();
                            for q in 0..4u64 {
                                let oq = if q == 0 { o.clone() } else { oscurecer(b, k, sem * 7919 + q * 31 + ni as u64 * 104729 + usadas as u64 + 1_000_000) };
                                r = pun.puntos(&oq, w, h, &roi);
                                if r.presencia < 0.5 { ok = false; break; }
                                roi = mano::roi_de_puntos(&r.img);
                            }
                            e.5 += r.presencia as f64; e.7 += pun.realce.ganancia as f64;
                            if ok {
                                e.2 += 1;
                                let er: f32 = (0..PUNTOS).map(|i| (r.img[i].x - rf.img[i].x).hypot(r.img[i].y - rf.img[i].y)).sum::<f32>() / PUNTOS as f32;
                                e.3 += (er / palma * 100.0) as f64; e.4 += 1;
                            }
                        }
                    }
                }
            }
            println!("{} casos (fotos y sus espejos) · {} ruidos por nivel · luz = cuánta llega comparada con un cuarto bien iluminado (la cámara sube la ganancia hasta ×16)", usadas, semillas);
            println!("{:>6} | {:^38} | {:^38}", "luz", "sin realce", "con realce JX");
            println!("{:>6} | {:>7} {:>6} {:>7} {:>6} {:>8} | {:>7} {:>6} {:>7} {:>6} {:>8}", "", "detecta", "sigue", "error", "pres", "mejor", "detecta", "sigue", "error", "pres", "mejor");
            for (ni, &(nom, _)) in niveles.iter().enumerate() {
                let c = |e: &(u32, u32, u32, f64, u32, f64, f64, f64)| (e.1 as f64 / e.0 as f64 * 100.0, e.2 as f64 / e.0 as f64 * 100.0, if e.4 > 0 { e.3 / e.4 as f64 } else { f64::NAN }, e.5 / e.0 as f64, e.6 / e.0 as f64, e.7 / e.0 as f64);
                let (s, j) = (c(&acc[ni][0]), c(&acc[ni][1]));
                println!("{:>6} | {:>6.0}% {:>5.0}% {:>6.1}% {:>6.2} {:>8.2} | {:>6.0}% {:>5.0}% {:>6.1}% {:>6.2} {:>8.2}  (ganancia {:.1}×)", nom, s.0, s.1, s.2, s.3, s.4, j.0, j.1, j.2, j.3, j.4, j.5);
            }
        }
        Some("noche_foto") => {
            // noche_foto MODELOS FOTO LUZ SALIDA.png: la foto oscurecida, lo que encuentra sin realce y lo que ve y
            // encuentra con el realce (lado a lado)
            let (mut det, mut pun) = cargar(&a[2]);
            let im = image::open(&a[3]).unwrap().to_rgba8(); let (w, h) = (im.width() as usize, im.height() as usize);
            let k: f32 = { let t = &a[4]; if let Some((x, y)) = t.split_once('/') { x.parse::<f32>().unwrap() / y.parse::<f32>().unwrap() } else { t.parse().unwrap() } };
            let o = oscurecer(im.as_raw(), k, 1);
            let mut lienzo = RgbaImage::new(w as u32 * 3, h as u32);
            let oscura = RgbaImage::from_raw(w as u32, h as u32, o.clone()).unwrap();
            image::imageops::overlay(&mut lienzo, &oscura, 0, 0);
            for con in 0..2 {
                // antes: el motor de ayer (detector bilineal, sin realce) · ahora: promedio en el detector y realce
                mano::PROMEDIAR.store(con == 1, std::sync::atomic::Ordering::Relaxed); pun.luz.activo = con == 1;
                // lo que se muestra: la foto oscura tal cual, o realzada con la misma curva (medida en la imagen entera)
                let mut vista = oscura.clone();
                if con == 1 {
                    let mut f: Vec<f32> = o.chunks_exact(4).flat_map(|p| [p[0] as f32 / 255.0, p[1] as f32 / 255.0, p[2] as f32 / 255.0]).collect();
                    let mut tmp = Vec::new();
                    let rv = jxhand::luz::realzar(&mut f, w, (0, 0, w, h), &pun.luz, &mut tmp);
                    for (px, q) in vista.pixels_mut().zip(f.chunks_exact(3)) { *px = Rgba([(q[0] * 255.0) as u8, (q[1] * 255.0) as u8, (q[2] * 255.0) as u8, 255]); }
                    println!("vista realzada: mediana {:.3} → ganancia {:.1}× (suavizado {})", rv.mediana, rv.ganancia, rv.suavizado);
                }
                let ps = det.detectar(&o, w, h);
                println!("{}: {} palma(s), mejor puntaje {:.2} · brillo medio {:.3}, blanco {:.3}", if con == 1 { "ahora" } else { "antes" }, ps.len(), det.mejor, det.realce.mediana, det.realce.blanco);
                if let Some(pa) = ps.first() {
                    let mut roi = mano::roi_de_palma(pa); let mut r = pun.puntos(&o, w, h, &roi);
                    for _ in 0..2 { roi = mano::roi_de_puntos(&r.img); r = pun.puntos(&o, w, h, &roi); }
                    println!("   presencia {:.3} · realce del recorte: ganancia {:.1}×, suavizado {}", r.presencia, pun.realce.ganancia, pun.realce.suavizado);
                    if r.presencia >= 0.5 {
                        for &(i, j) in &HUESOS { linea(&mut vista, (r.img[i].x, r.img[i].y), (r.img[j].x, r.img[j].y), Rgba([255, 255, 255, 255]), 2.0); }
                        for i in 0..PUNTOS { punto(&mut vista, (r.img[i].x, r.img[i].y), 4.0, if i % 4 == 0 && i > 0 { Rgba([255, 62, 138, 255]) } else { Rgba([122, 60, 255, 255]) }); }
                    }
                }
                image::imageops::overlay(&mut lienzo, &vista, (w * (con + 1)) as i64, 0);
            }
            lienzo.save(&a[5]).unwrap();
        }
        _ => eprintln!("uso: jxhand-banco ver MODELO [todo] | foto MODELOS FOTO SALIDA | medir MODELOS FOTO [veces] | perfil MODELOS | video MODELOS FOTO | noche MODELOS FOTO... | noche_foto MODELOS FOTO LUZ SALIDA"),
    }
}

/// la foto como la saca un celular con poca luz: `luz` = cuánta llega comparada con un cuarto bien iluminado. Con buena
/// luz un píxel blanco junta ~4000 electrones; con menos, el ruido de fotones (raíz de la señal) y el de lectura (2,5 e⁻)
/// pesan más. La cámara sube la ganancia hasta ×16: más oscuro que 1/16 la foto sale más oscura además de ruidosa.
fn oscurecer(src: &[u8], luz: f32, semilla: u64) -> Vec<u8> {
    let lin: Vec<f32> = (0..256).map(|i| { let v = i as f32 / 255.0; if v <= 0.04045 { v / 12.92 } else { ((v + 0.055) / 1.055).powf(2.4) } }).collect();
    let srgb = |l: f32| -> u8 { let l = l.clamp(0.0, 1.0); let v = if l <= 0.0031308 { l * 12.92 } else { 1.055 * l.powf(1.0 / 2.4) - 0.055 }; (v * 255.0 + 0.5) as u8 };
    let e_blanco = 4000.0 * luz; let salida = (16.0 * luz).min(1.0); let lectura = 2.5f32;
    let mut s = semilla.wrapping_mul(0x9E3779B97F4A7C15) | 1;
    let mut u = move || { s ^= s << 13; s ^= s >> 7; s ^= s << 17; ((s >> 11) as f64 / (1u64 << 53) as f64) as f32 };
    let mut gauss = move || { let (a, b) = (u().max(1e-7), u()); (-2.0 * a.ln()).sqrt() * (2.0 * std::f32::consts::PI * b).cos() };
    let mut o = vec![0u8; src.len()];
    for (d, p) in o.chunks_exact_mut(4).zip(src.chunks_exact(4)) {
        for c in 0..3 {
            let e = lin[p[c] as usize] * e_blanco;
            let v = e + gauss() * (e + lectura * lectura).sqrt();
            d[c] = srgb(v / e_blanco * salida);
        }
        d[3] = 255;
    }
    o
}
