//! Pruebas de la física de los objetos (fisica.rs, forma.rs): una caja que cae al piso, una esfera que rueda por una
//! rampa, una pila de cajas y los props de verdad del paquete en RB_Flatgrass (con el tiempo de cada paso).
use jxjuego::fisica::*;
use jxjuego::forma::{cuerpo_de_prefab, nombres_menu, Catalogo};
use jxjuego::mundo::Mundo;
use std::path::Path;
use std::sync::Arc;
use std::time::Instant;

const DT: f64 = 1.0 / 60.0;

/// un cuadrado de dos triángulos (a, b, c, d en orden, con la cara para arriba)
fn cuadro(a: V, b: V, c: V, d: V) -> Vec<f32> {
    [a, b, c, a, c, d].iter().flat_map(|p| p.iter().map(|x| *x as f32)).collect()
}
fn piso(l: f64) -> Mundo { Mundo::nuevo(cuadro([-l, 0.0, -l], [-l, 0.0, l], [l, 0.0, l], [l, 0.0, -l]), vec![], 1.0) }
fn caja(h: f64, masa: f64, pos: V, q: Q) -> Cuerpo { let mut c = Cuerpo::nuevo(Arc::new(forma_caja(h, h, h)), masa, OpCuerpo::default()); c.pos = pos; c.q = q; c }
fn sin_nan(c: &Cuerpo) -> bool { c.pos.iter().chain(c.q.iter()).chain(c.vel.iter()).chain(c.ang.iter()).all(|x| x.is_finite()) }
/// lo más bajo del cuerpo (sus puntos extremos en el mundo)
fn lo_mas_bajo(c: &Cuerpo) -> f64 { puntos_forma(&c.forma).iter().fold(1e9f64, |m, p| m.min(rot(c.q, *p)[1] + c.pos[1])) }

#[test]
fn caja_cae_al_piso() {
    let mundo = piso(20.0);
    for (k, q) in [QID, qeje([1.0, 0.3, 0.7], 0.6)].into_iter().enumerate() {
        let mut f = Fisica::nueva();
        let id = f.agregar(caja(0.5, 1.0, [0.3, 2.5, -0.2], q));
        let mut dormida_en = None;
        for i in 0..600 {
            f.paso(&mundo, DT);
            let c = f.cuerpo(id).unwrap(); assert!(sin_nan(c));
            if i == 30 || i == 60 || i == 120 { println!("caja {k}: t={:.2} y={:.5} vy={:.4}", (i + 1) as f64 * DT, c.pos[1], c.vel[1]); }
            if c.duerme && dormida_en.is_none() { dormida_en = Some((i + 1) as f64 * DT); }
        }
        let c = f.cuerpo(id).unwrap();
        // (apoyada en una cara: el centro a medio lado del piso, algún eje para arriba)
        let arriba = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]].iter().map(|e| rot(c.q, *e)[1].abs()).fold(0.0, f64::max);
        println!("caja {k}: y final {:.5}, eje vertical {:.5}, dormida a los {:?} s, x {:.3} z {:.3}", c.pos[1], arriba, dormida_en, c.pos[0], c.pos[2]);
        assert!((c.pos[1] - 0.5).abs() < 0.02, "altura {}", c.pos[1]);
        assert!(arriba > 0.999, "no quedó sobre una cara: {arriba}");
        assert!(c.duerme, "no se durmió");
        assert!(dormida_en.unwrap() < 6.0);
    }
}

#[test]
fn esfera_rueda_por_la_rampa() {
    let th = 20f64.to_radians(); let h = |x: f64| -th.tan() * x;
    let mundo = Mundo::nuevo(cuadro([-10.0, h(-10.0), -10.0], [-10.0, h(-10.0), 10.0], [40.0, h(40.0), 10.0], [40.0, h(40.0), -10.0]), vec![], 1.0);
    let n = [th.sin(), th.cos(), 0.0]; let r = 0.5;
    let mut f = Fisica::nueva();
    let mut s = Cuerpo::nuevo(Arc::new(forma_esfera(r)), 2.0, OpCuerpo::default()); s.pos = esc(n, r + 0.002);
    let id = f.agregar(s);
    let t = 1.5; let pasos = (t / DT).round() as usize;
    for _ in 0..pasos { f.paso(&mundo, DT); }
    let c = f.cuerpo(id).unwrap(); assert!(sin_nan(c));
    let abajo = [th.cos(), -th.sin(), 0.0];
    let d = dot(c.pos, abajo); let alto = dot(c.pos, n); let v = largo(c.vel); let w = largo(c.ang);
    // (rodando sin patinar: a = g sen θ · 5/7)
    let a = GRAV * th.sin() * 5.0 / 7.0; let d_teo = 0.5 * a * t * t;
    println!("esfera: bajó {d:.3} m (rodando sin patinar: {d_teo:.3}), alto sobre la rampa {alto:.4}, v {v:.3} (teo {:.3}), ω·r {:.3}", a * t, w * r);
    assert!((d - d_teo).abs() < 0.15 * d_teo, "bajó {d}");
    assert!((alto - r).abs() < 0.02, "se separó o se hundió: {alto}");
    assert!((w * r - v).abs() < 0.1 * v, "no rueda: ω·r {} v {}", w * r, v);
    assert!(!c.duerme);
}

#[test]
fn pila_de_tres_cajas() {
    let mundo = piso(20.0);
    let mut f = Fisica::nueva();
    let ids: Vec<u32> = (0..3).map(|i| f.agregar(caja(0.5, 10.0, [0.02 * i as f64, 0.5 + 1.005 * i as f64, -0.01 * i as f64], QID))).collect();
    for _ in 0..480 { f.paso(&mundo, DT); }
    for (i, id) in ids.iter().enumerate() {
        let c = f.cuerpo(*id).unwrap(); assert!(sin_nan(c));
        let y = 0.5 + i as f64;
        println!("pila {i}: x {:.4} y {:.4} z {:.4} dormida {}", c.pos[0], c.pos[1], c.pos[2], c.duerme);
        assert!((c.pos[1] - y).abs() < 0.03, "caja {i}: y {}", c.pos[1]);
        assert!((c.pos[0] - 0.02 * i as f64).abs() < 0.05 && (c.pos[2] + 0.01 * i as f64).abs() < 0.05, "caja {i} se corrió");
        assert!(c.duerme, "caja {i} despierta");
    }
    // (un rayo de arriba toca la de arriba; ignorándola, la del medio)
    let g = f.rayo(&mundo, [0.04, 10.0, -0.02], [0.0, -1.0, 0.0], 50.0, &[]).unwrap();
    assert_eq!(g.cuerpo, Some(ids[2])); assert!((g.p[1] - 3.0).abs() < 0.03 && g.n[1] > 0.99);
    let g = f.rayo(&mundo, [0.04, 10.0, -0.02], [0.0, -1.0, 0.0], 50.0, &[ids[2]]).unwrap();
    assert_eq!(g.cuerpo, Some(ids[1]));
    let g = f.rayo(&mundo, [5.0, 10.0, 0.0], [0.0, -1.0, 0.0], 50.0, &[]).unwrap();
    assert_eq!(g.cuerpo, None); assert!((g.t - 10.0).abs() < 1e-4);
    let cerca = f.cerca([-0.1, 1.9, -0.1, 0.1, 2.1, 0.1]); assert!(cerca.contains(&ids[1]) && cerca.contains(&ids[2]));
    // (sacar la de abajo despierta a las demás: caen al piso)
    f.quitar(ids[0]);
    assert!(!f.cuerpo(ids[1]).unwrap().duerme);
    for _ in 0..300 { f.paso(&mundo, DT); }
    assert!((f.cuerpo(ids[1]).unwrap().pos[1] - 0.5).abs() < 0.03);
}

/// los props del menú en el mapa de verdad (si está el paquete)
#[test]
fn props_de_verdad_en_flatgrass() {
    let www = Path::new("/tmp/claude-0/jxp_apk/activos/www");
    if !www.join("pk.bin").exists() { eprintln!("sin paquete en {www:?}: no se prueba"); return; }
    let mut paq = jxjuego::paquete::Paquete::abrir(www).unwrap();
    let mapa = jxjuego::mapa::armar(&mut paq, "RB_Flatgrass", 256, 750.0).unwrap();
    let mundo = mapa.mundo; let sp = mapa.spawns.first().map(|s| s.0).unwrap_or([0.0, 0.0, 0.0]); let sp = [sp[0] as f64, sp[1] as f64, sp[2] as f64];
    println!("mapa: {} triángulos, {} cuerpos fijos, aparición {:?}", mundo.n_tris(), mundo.cuerpos.len(), sp);
    let mut cat = Catalogo::nuevo(&paq);
    let props = nombres_menu(&paq, "Props");
    let t0 = Instant::now();
    let validos: Vec<String> = props.iter().filter(|n| cat.prefab(&paq, n).map_or(false, |p| !p.congelado && !p.sin_fisica)).cloned().collect();
    println!("Props: {} en el menú, {} con física; formas armadas en {:.0} ms", props.len(), validos.len(), t0.elapsed().as_secs_f64() * 1000.0);
    // 20 repartidos por todo el menú
    let elegidos: Vec<String> = (0..20).map(|i| validos[i * validos.len() / 20].clone()).collect();
    for (cuantos, lista) in [(20usize, elegidos.clone()), (50, (0..50).map(|i| validos[(i * 7) % validos.len()].clone()).collect::<Vec<_>>())] {
        let mut f = Fisica::nueva();
        // (en filas sobre el piso, separados por su tamaño, 3 m arriba de la aparición)
        let (mut x, mut z, mut fila) = (-30.0f64, -20.0f64, 0.0f64); let mut ids = vec![];
        for n in &lista {
            let pf = cat.prefab(&paq, n).unwrap();
            let (mut lo, mut hi) = ([1e9f64; 3], [-1e9f64; 3]);
            for p in puntos_forma(&pf.forma) { for k in 0..3 { lo[k] = lo[k].min(p[k]); hi[k] = hi[k].max(p[k]); } }
            let (ax, az) = (hi[0] - lo[0], hi[2] - lo[2]);
            if x + ax > 30.0 { x = -30.0; z += fila + 1.0; fila = 0.0; }
            let pos = [sp[0] + x - lo[0], sp[1] + 3.0, sp[2] + z - lo[2]];
            x += ax + 1.0; fila = fila.max(az);
            let b = cuerpo_de_prefab(&pf, pos, QID, false);
            ids.push((f.agregar(b), n.clone(), pf.partes, pf.masa));
        }
        let mut tiempos = vec![];
        for _ in 0..600 { let t = Instant::now(); f.paso(&mundo, DT); tiempos.push(t.elapsed().as_secs_f64() * 1000.0); }
        let prom = |a: &[f64]| a.iter().sum::<f64>() / a.len() as f64;
        let mx = tiempos.iter().cloned().fold(0.0, f64::max);
        println!("{cuantos} cuerpos: paso promedio {:.3} ms (primer segundo, cayendo y chocando: {:.3} ms; máximo {:.3} ms); contactos al final {}",
            prom(&tiempos), prom(&tiempos[..60]), mx, f.contactos.len());
        let mut dormidos = 0;
        for (id, n, partes, masa) in &ids {
            let c = f.cuerpo(*id).unwrap();
            assert!(sin_nan(c), "{n}: NaN");
            // (el piso abajo del cuerpo: un rayo del mapa desde arriba)
            let o = [c.pos[0] as f32, (c.pos[1] + 30.0) as f32, c.pos[2] as f32];
            let pisos = mundo.rayo(o, [0.0, -1.0, 0.0], 80.0).map(|g| o[1] as f64 - g.t as f64);
            let bajo = lo_mas_bajo(c);
            if cuantos == 20 { println!("  {n:<22} partes {partes:>2} masa {masa:>7.1}  lo más bajo {bajo:>8.3}  piso {:?}  v {:.3}  dormido {}", pisos.map(|p| (p * 1000.0).round() / 1000.0), largo(c.vel), c.duerme); }
            let piso = pisos.expect("sin piso abajo");
            assert!(bajo > piso - 0.06, "{n}: atravesó el piso ({bajo} < {piso})");
            assert!(c.pos[1] > sp[1] - 5.0 && !c.muerto, "{n}: se cayó");
            if c.duerme { dormidos += 1; }
        }
        println!("{cuantos} cuerpos: {dormidos} dormidos a los 10 s");
        if cuantos == 50 { assert!(prom(&tiempos) < 2.0, "lento: {} ms", prom(&tiempos)); }
    }
    // el peor caso: 50 props en montón (columnas de 5 × 5, de a dos, sin espacio entre sí): caen unos sobre otros
    let mut f = Fisica::nueva(); let mut ids = vec![];
    for i in 0..50 {
        let pf = cat.prefab(&paq, &validos[(i * 7) % validos.len()]).unwrap();
        let (cx, cz, piso) = ((i % 5) as f64 * 1.2, ((i / 5) % 5) as f64 * 1.2, (i / 25) as f64 * 2.5);
        let q = qeje([0.2, 1.0, 0.3], i as f64 * 0.7);
        ids.push(f.agregar(cuerpo_de_prefab(&pf, [sp[0] + cx, sp[1] + 1.0 + piso, sp[2] + 30.0 + cz], q, false)));
    }
    let mut tiempos = vec![]; let mut mx_ct = 0; let (mut det, mut sol) = (0.0, 0.0);
    for _ in 0..600 { let t = Instant::now(); f.paso(&mundo, DT); tiempos.push(t.elapsed().as_secs_f64() * 1000.0); mx_ct = mx_ct.max(f.contactos.len()); det += f.ms_det; sol += f.ms_sol; }
    println!("50 en montón: detección {:.3} ms y subpasos {:.3} ms por paso, en promedio", det / 600.0, sol / 600.0);
    let prom = tiempos.iter().sum::<f64>() / tiempos.len() as f64; let mx = tiempos.iter().cloned().fold(0.0, f64::max);
    let p2 = tiempos[..120].iter().sum::<f64>() / 120.0;
    println!("50 en montón: paso promedio {prom:.3} ms (los primeros 2 s: {p2:.3} ms; máximo {mx:.3} ms; hasta {mx_ct} contactos); {} dormidos a los 10 s",
        ids.iter().filter(|id| f.cuerpo(**id).unwrap().duerme).count());
    for id in &ids { let c = f.cuerpo(*id).unwrap(); assert!(sin_nan(c) && lo_mas_bajo(c) > -0.025 - 0.06 && !c.muerto); }
    assert!(prom < 2.0, "lento: {prom} ms");
}

/// las mismas escenas que un arnés de node que corre juego/fisica.js, con todos los dígitos, para comparar línea por línea
/// (`cargo test --release -p jxjuego --test fisica -- --ignored --nocapture traza`)
#[test]
#[ignore]
fn traza_para_comparar_con_js() {
    let p = |c: &Cuerpo| [c.pos[0], c.pos[1], c.pos[2], c.q[0], c.q[1], c.q[2], c.q[3]].iter().map(|x| format!("{:.14e}", x)).collect::<Vec<_>>().join(" ");
    for (k, q) in [QID, qeje([1.0, 0.3, 0.7], 0.6)].into_iter().enumerate() {
        let mundo = piso(20.0); let mut f = Fisica::nueva(); let id = f.agregar(caja(0.5, 1.0, [0.3, 2.5, -0.2], q)); let mut dorm = None;
        for i in 0..600 { f.paso(&mundo, DT); let c = f.cuerpo(id).unwrap(); if [29, 59, 89, 119, 599].contains(&i) { println!("caja{k} {} {}", i + 1, p(c)); } if c.duerme && dorm.is_none() { dorm = Some(i + 1); } }
        println!("caja{k} dormida {:?}", dorm);
    }
    {
        let th = 20f64.to_radians(); let h = |x: f64| -th.tan() * x;
        let mundo = Mundo::nuevo(cuadro([-10.0, h(-10.0), -10.0], [-10.0, h(-10.0), 10.0], [40.0, h(40.0), 10.0], [40.0, h(40.0), -10.0]), vec![], 1.0);
        let mut f = Fisica::nueva(); let mut s = Cuerpo::nuevo(Arc::new(forma_esfera(0.5)), 2.0, OpCuerpo::default()); s.pos = esc([th.sin(), th.cos(), 0.0], 0.502); let id = f.agregar(s);
        for i in 0..90 { f.paso(&mundo, DT); if [29, 59, 89].contains(&i) { println!("esfera {} {}", i + 1, p(f.cuerpo(id).unwrap())); } }
    }
    {
        let mundo = piso(20.0); let mut f = Fisica::nueva();
        let ids: Vec<u32> = (0..3).map(|i| f.agregar(caja(0.5, 10.0, [0.02 * i as f64, 0.5 + 1.005 * i as f64, -0.01 * i as f64], QID))).collect();
        for i in 0..480 { f.paso(&mundo, DT); if [59, 239, 479].contains(&i) { for (k, id) in ids.iter().enumerate() { println!("pila{k} {} {}", i + 1, p(f.cuerpo(*id).unwrap())); } } }
        for (k, id) in ids.iter().enumerate() { println!("pila{k} dormida {}", f.cuerpo(*id).unwrap().duerme); }
    }
}

/// props de verdad sobre los triángulos de RB_Flatgrass, para comparar con el arnés de node (formaDe + la física de la
/// web): deja los triángulos y la lista de objetos en $JXF_SALIDA (tris.bin, objs.json) e imprime las trayectorias
/// (`JXF_SALIDA=<carpeta> cargo test --release -p jxjuego --test fisica -- --ignored --nocapture traza_props`)
#[test]
#[ignore]
fn traza_props_para_comparar_con_js() {
    let Ok(sal) = std::env::var("JXF_SALIDA") else { eprintln!("falta JXF_SALIDA"); return };
    let www = Path::new("/tmp/claude-0/jxp_apk/activos/www");
    let mut paq = jxjuego::paquete::Paquete::abrir(www).unwrap();
    let mapa = jxjuego::mapa::armar(&mut paq, "RB_Flatgrass", 64, 750.0).unwrap();
    let mundo = mapa.mundo; let sp = mapa.spawns[0].0; let sp = [sp[0] as f64, sp[1] as f64, sp[2] as f64];
    std::fs::write(Path::new(&sal).join("tris.bin"), mundo.t.iter().flat_map(|x| x.to_le_bytes()).collect::<Vec<u8>>()).unwrap();
    std::fs::write(Path::new(&sal).join("aristas_rs.txt"), (0..mundo.n_tris() as u32).map(|t| format!("{:?}\n", aristas_de_tri(&mundo, t))).collect::<String>()).unwrap();
    let mut cat = Catalogo::nuevo(&paq);
    let validos: Vec<String> = nombres_menu(&paq, "Props").into_iter().filter(|n| cat.prefab(&paq, n).map_or(false, |p| !p.congelado && !p.sin_fisica)).collect();
    // (20 repartidos en filas, y una torre de 12 que se cae encima de otros)
    let mut objs: Vec<(String, V, Q)> = vec![];
    let (mut x, mut z, mut fila) = (-30.0f64, -20.0f64, 0.0f64);
    for i in 0..20 {
        let n = &validos[i * validos.len() / 20]; let pf = cat.prefab(&paq, n).unwrap();
        let (mut lo, mut hi) = ([1e9f64; 3], [-1e9f64; 3]);
        for p in puntos_forma(&pf.forma) { for k in 0..3 { lo[k] = lo[k].min(p[k]); hi[k] = hi[k].max(p[k]); } }
        if x + hi[0] - lo[0] > 30.0 { x = -30.0; z += fila + 1.0; fila = 0.0; }
        objs.push((n.clone(), [sp[0] + x - lo[0], sp[1] + 3.0, sp[2] + z - lo[2]], QID)); x += hi[0] - lo[0] + 1.0; fila = fila.max(hi[2] - lo[2]);
    }
    let torre = ["Box1", "Crate", "Barril", "Tire", "Sofa", "Box2", "Fireext", "Oxygen_tank", "Box1", "Crate", "Barril", "Box2"];
    let mut y = sp[1] + 0.5;
    for (k, n) in torre.iter().enumerate() {
        let Some(pf) = cat.prefab(&paq, n) else { continue };
        let q = qeje([0.3, 1.0, 0.1 * k as f64], 0.4 * k as f64);
        let alto = puntos_forma(&pf.forma).iter().map(|p| rot(qmul(q, pf.cap_q.unwrap_or(QID)), *p)[1]).fold(-1e9f64, f64::max) - puntos_forma(&pf.forma).iter().map(|p| rot(qmul(q, pf.cap_q.unwrap_or(QID)), *p)[1]).fold(1e9f64, f64::min);
        objs.push((n.to_string(), [sp[0] + 0.15 * (k % 3) as f64, y, sp[2] + 40.0 + 0.1 * (k % 2) as f64], q)); y += alto + 0.05;
    }
    let js: Vec<String> = objs.iter().map(|(n, p, q)| format!("[\"{n}\",[{:e},{:e},{:e}],[{:e},{:e},{:e},{:e}]]", p[0], p[1], p[2], q[0], q[1], q[2], q[3])).collect();
    std::fs::write(Path::new(&sal).join("objs.json"), format!("[{}]", js.join(","))).unwrap();
    let mut f = Fisica::nueva(); let mut ids = vec![];
    for (n, p, q) in &objs { let pf = cat.prefab(&paq, n).unwrap(); ids.push(f.agregar(cuerpo_de_prefab(&pf, *p, *q, false))); }
    let pr = |c: &Cuerpo| [c.pos[0], c.pos[1], c.pos[2], c.q[0], c.q[1], c.q[2], c.q[3]].iter().map(|x| format!("{:.14e}", x)).collect::<Vec<_>>().join(" ");
    for (k, id) in ids.iter().enumerate() { println!("obj{k} 0 {}", pr(f.cuerpo(*id).unwrap())); }
    for i in 0..600 {
        f.paso(&mundo, DT);
        if std::env::var("JXF_CONT").map_or(false, |v| v.split(',').any(|x| x == (i + 1).to_string())) {
            let e = |x: f64| format!("{:.14e}", x);
            for c in &f.contactos { let x = c.wb.unwrap_or(c.rb); println!("cont {} {} {} {} {}", i + 1, c.a, c.b.map_or("m".to_string(), |b| b.to_string()), c.wb.is_some(), [c.ra[0], c.ra[1], c.ra[2], x[0], x[1], x[2], c.n[0], c.n[1], c.n[2], c.depth].iter().map(|v| e(*v)).collect::<Vec<_>>().join(" ")); }
        }
        if [1, 30, 60, 120, 300, 600].contains(&(i + 1)) || std::env::var("JXF_CADA").is_ok() { println!("contactos {} {}", i + 1, f.contactos.len()); for (k, id) in ids.iter().enumerate() { println!("obj{k} {} {}", i + 1, pr(f.cuerpo(*id).unwrap())); } }
    }
}

/// las formas de unos prefabs con todos los dígitos (para comparar con formaDe del JS)
/// (`cargo test --release -p jxjuego --test fisica -- --ignored --nocapture traza_formas`)
#[test]
#[ignore]
fn traza_formas() {
    let www = Path::new("/tmp/claude-0/jxp_apk/activos/www"); if !www.join("pk.bin").exists() { return; }
    let paq = jxjuego::paquete::Paquete::abrir(www).unwrap(); let mut cat = Catalogo::nuevo(&paq);
    let e = |v: &[f64]| v.iter().map(|x| format!("{:.14e}", x)).collect::<Vec<_>>().join(" ");
    fn casco(nom: &str, k: usize, c: &Casco, e: &dyn Fn(&[f64]) -> String) {
        for (i, v) in c.v.iter().enumerate() { println!("forma {nom} {k} v{i} {}", e(v)); }
        for (i, f) in c.f.iter().enumerate() { println!("forma {nom} {k} f{i} {:?} {} {}", f.ix, e(&f.n), e(&[f.d])); }
        for (i, d) in c.dirs.iter().enumerate() { println!("forma {nom} {k} d{i} {}", e(d)); }
    }
    let nombres: Vec<String> = std::env::var("JXF_FORMAS").map(|s| s.split(',').map(|x| x.to_string()).collect()).unwrap_or_else(|_| vec!["Box1".into(), "Crate".into(), "Barril".into()]);
    for n in &nombres {
        let Some(pf) = cat.prefab(&paq, n) else { continue };
        println!("forma {n} c {}", e(&pf.c));
        match &*pf.forma {
            Forma::Casco(c) => casco(n, 0, c, &e),
            Forma::Compuesta { partes, .. } => for (k, p) in partes.iter().enumerate() { println!("forma {n} {k} p {} {}", e(&p.p), e(&p.q)); if let Forma::Casco(c) = &p.forma { casco(n, k, c, &e); } },
            f => println!("forma {n} {f:?}"),
        }
    }
}

fn pr(c: &Cuerpo) -> String { [c.pos[0], c.pos[1], c.pos[2], c.q[0], c.q[1], c.q[2], c.q[3]].iter().map(|x| format!("{:.14e}", x)).collect::<Vec<_>>().join(" ") }
fn rampa20() -> Mundo { let th = 20f64.to_radians(); let h = |x: f64| -th.tan() * x; Mundo::nuevo(cuadro([-10.0, h(-10.0), -10.0], [-10.0, h(-10.0), 10.0], [40.0, h(40.0), 10.0], [40.0, h(40.0), -10.0]), vec![], 1.0) }
fn con(forma: Forma, masa: f64, pos: V, q: Q, grupo: u32) -> Cuerpo { let mut c = Cuerpo::nuevo(Arc::new(forma), masa, OpCuerpo { grupo, ..OpCuerpo::default() }); c.pos = pos; c.q = q; c }
/// (dónde queda el enganche de una unión en cada cuerpo, y el ángulo de la bisagra como lo mide solveJoint)
fn enganche(f: &Fisica, u: &Union) -> (V, V, f64) {
    let (a, b) = (f.cuerpo(u.a).unwrap(), f.cuerpo(u.b).unwrap());
    let (pa, pb) = (rot(a.q, u.ax_a), rot(b.q, u.ax_b));
    (add(a.pos, rot(a.q, u.pa)), add(b.pos, rot(b.q, u.pb)), dot(cruz(pa, pb), rot(a.q, u.h_a)).atan2(dot(pa, pb)))
}

/// una cadena colgada de un cuerpo fijo: una unión esférica (cono y torsión) y una bisagra con límites
#[test]
fn cadena_con_uniones() {
    let mundo = piso(20.0); let mut f = Fisica::nueva();
    let anc = f.agregar(con(forma_caja(0.2, 0.2, 0.2), 0.0, [0.0, 5.0, 0.0], QID, 1));
    let b1 = f.agregar(con(forma_caja(0.1, 0.5, 0.1), 2.0, [0.6, 5.0, 0.0], qeje([0.0, 0.0, 1.0], std::f64::consts::FRAC_PI_2), 1));
    f.unir(anc, b1, [0.1, 5.0, 0.0], [1.0, 0.0, 0.0], OpUnion { swing: 0.6, twist: 0.3, ..OpUnion::default() }).unwrap();
    let b2 = f.agregar(con(forma_capsula(0.1, 0.4), 1.5, [1.7, 5.0, 0.05], qeje([0.0, 0.0, 1.0], std::f64::consts::FRAC_PI_2), 1));
    f.unir(b1, b2, [1.15, 5.0, 0.02], [1.0, 0.0, 0.0], OpUnion { bisagra: true, eje_bisagra: Some([0.0, 0.0, 1.0]), lo: -1.2, hi: 0.3, ..OpUnion::default() }).unwrap();
    let (mut sep, mut fuera) = (0.0f64, 0.0f64);
    for i in 0..300 {
        f.paso(&mundo, DT);
        if [30, 60, 120, 300].contains(&(i + 1)) || std::env::var("JXF_CADA").is_ok() { println!("union1 {} {}", i + 1, pr(f.cuerpo(b1).unwrap())); println!("union2 {} {}", i + 1, pr(f.cuerpo(b2).unwrap())); }
        if i > 30 {
            for u in f.uniones.clone() { let (p, q, ang) = enganche(&f, &u); sep = sep.max(largo(sub(p, q))); if u.bisagra { fuera = fuera.max(u.lo - ang).max(ang - u.hi); } }
        }
    }
    println!("uniones: enganches separados hasta {sep:.4} m; la bisagra se pasó de sus límites hasta {fuera:.4} rad");
    assert!(sep < 0.01 && fuera < 0.05);
    let c = f.cuerpo(b2).unwrap(); assert!(sin_nan(c) && c.pos[1] < 5.0 && c.pos[1] > 2.5, "{:?}", c.pos);
}

/// las partes de un muñeco (noCruza) cayendo rápido contra una rampa: ninguna queda del otro lado
#[test]
fn muneco_no_cruza_la_rampa() {
    let th = 20f64.to_radians(); let n = [th.sin(), th.cos(), 0.0];
    let mundo = rampa20(); let mut f = Fisica::nueva();
    let c1 = f.agregar(con(forma_capsula(0.15, 0.3), 3.0, [0.0, 2.0, 0.0], QID, 7));
    let c2 = f.agregar(con(forma_esfera(0.2), 2.0, [0.0, 2.8, 0.1], QID, 7));
    let c3 = f.agregar(con(forma_caja(0.2, 0.1, 0.3), 2.0, [0.1, 1.3, 0.0], QID, 7));
    f.unir(c1, c2, [0.0, 2.5, 0.05], [0.0, 1.0, 0.0], OpUnion { swing: 0.9, twist: 0.5, ..OpUnion::default() });
    f.unir(c1, c3, [0.05, 1.5, 0.0], [0.0, -1.0, 0.0], OpUnion { swing: 0.5, twist: 0.2, ..OpUnion::default() });
    for id in [c1, c2, c3] { let c = f.cuerpo_mut(id).unwrap(); c.no_cruza = true; c.vel = [3.0, -25.0, 1.0]; c.ang = [2.0, 0.0, 5.0]; }
    let mut min_d = 1e9f64;
    for i in 0..240 {
        f.paso(&mundo, DT);
        if [10, 30, 60, 120, 240].contains(&(i + 1)) { for (k, id) in [c1, c2, c3].iter().enumerate() { println!("muneco{k} {} {}", i + 1, pr(f.cuerpo(*id).unwrap())); } }
        for id in [c1, c2, c3] { let c = f.cuerpo(id).unwrap(); assert!(sin_nan(c)); min_d = min_d.min(dot(c.pos, n)); }
    }
    println!("muñeco: el centro más cerca de la rampa quedó a {min_d:.4} m (del lado de arriba)");
    assert!(min_d > 0.05, "una parte cruzó la rampa: {min_d}");
}

/// cuerpos fijos del mapa (caja inclinada, esfera, cápsula: Mundo::cuerpos) con una caja, una esfera y un compuesto encima
#[test]
fn cuerpos_fijos_del_mapa() {
    use jxjuego::mundo::{aabb_de, Cuerpo as CuerpoMundo, Forma as FormaMundo};
    let f32v = |v: V| [v[0] as f32, v[1] as f32, v[2] as f32];
    let q = qeje([0.0, 0.0, 1.0], 0.25);
    let formas = vec![
        FormaMundo::Caja { c: [2.0, 1.0, 0.0], e: [f32v(rot(q, [1.0, 0.0, 0.0])), f32v(rot(q, [0.0, 1.0, 0.0])), f32v(rot(q, [0.0, 0.0, 1.0]))], h: [1.5, 0.2, 1.5] },
        FormaMundo::Esfera { c: [-3.0, 0.5, 0.0], r: 0.8 },
        FormaMundo::Capsula { a: [1.0, 0.3, 4.0], b: [-1.0, 0.3, 4.0], r: 0.3 },
    ];
    let l = 20.0;
    let mundo = Mundo::nuevo(cuadro([-l, 0.0, -l], [-l, 0.0, l], [l, 0.0, l], [l, 0.0, -l]), formas.into_iter().map(|f| CuerpoMundo { aabb: aabb_de(&f), f }).collect(), 1.0);
    let mut f = Fisica::nueva();
    let a = f.agregar(con(forma_caja(0.3, 0.3, 0.3), 5.0, [2.2, 3.0, 0.1], QID, 0));
    let s = f.agregar(con(forma_esfera(0.3), 2.0, [-2.9, 3.0, 0.05], QID, 0));
    let co = f.agregar(con(forma_compuesta(vec![
        Parte { forma: forma_caja(0.4, 0.1, 0.4), p: [0.0, -0.2, 0.0], q: QID },
        Parte { forma: forma_esfera(0.25), p: [0.2, 0.2, 0.0], q: QID },
        Parte { forma: forma_capsula(0.1, 0.3), p: [-0.2, 0.1, 0.0], q: qeje([1.0, 0.0, 0.0], 1.2) },
    ]), 4.0, [0.1, 3.0, 4.05], QID, 0));
    let mut golpes = 0;
    for i in 0..300 {
        f.paso(&mundo, DT); golpes += f.golpes.len();
        if [30, 60, 120, 300].contains(&(i + 1)) { for (k, id) in [a, s, co].iter().enumerate() { println!("fijos{k} {} {}", i + 1, pr(f.cuerpo(*id).unwrap())); } }
    }
    for (n, id) in [("caja", a), ("esfera", s), ("compuesto", co)] {
        let c = f.cuerpo(id).unwrap(); println!("fijos: {n} en {:?}, lo más bajo {:.4}", c.pos.map(|x| (x * 1000.0).round() / 1000.0), lo_mas_bajo(c));
        assert!(sin_nan(c) && lo_mas_bajo(c) > -0.03, "{n}");
    }
    // (la esfera rodó de arriba de la esfera fija al piso; la caja quedó sobre la caja inclinada o se deslizó al piso)
    assert!((f.cuerpo(s).unwrap().pos[1] - 0.3).abs() < 0.02);
    assert!(golpes > 0, "sin golpes");
}
