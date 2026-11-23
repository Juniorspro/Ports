//! Pruebas de los NPC (npc.rs y persona.rs) contra la web: la actitud que sale de lo escrito y de la IA (npcActDeTexto y
//! npcActNormal de npc.js), y 14 escenas corridas con npc.js de verdad en Node (personajes_prueba/web/npc_ref.js, con el
//! mismo azar): seguir, pegar, tirar con cada arma, rodear una pared, saltar un escalón, el barranco, pasear, huir, la
//! guardia, una pelea entre NPC, el que te defiende y lo que dicen (tests/npc_web.json). Además: el muñeco de trapo
//! (tirarlo, que se levante, que muera y se borre, agarrarlo), el menú, los emotes y 50 NPC en RB_Flatgrass con lo que
//! tardan por cuadro. Las que necesitan el paquete (el cuerpo del Hero, el mapa) no hacen nada si no está.
use jxjuego::fisica::Fisica;
use jxjuego::mundo::Mundo;
use jxjuego::npc::{self, Actitud, Evento, Gente, Modo, Npcs, Skins};
use jxjuego::paquete::Paquete;
use jxjuego::personaje::{Cargados, ClipEmote};
use serde_json::{json, Value};
use std::path::Path;
use std::time::Instant;

const WWW: &str = "/tmp/claude-0/jxp_apk/activos/www";
fn paquete() -> Option<Paquete> { let w = Path::new(WWW); if !w.join("pk.bin").exists() { println!("(sin el paquete en {WWW}: no se prueba)"); return None; } Paquete::abrir(w).ok() }
fn web() -> Value { serde_json::from_str(include_str!("npc_web.json")).unwrap() }

/// las caras de las cajas, dos triángulos por cara (en el mismo orden que npc_ref.js)
fn mundo_de_cajas(c: &[[f32; 6]]) -> Mundo {
    let mut t: Vec<f32> = vec![];
    for &[x0, y0, z0, x1, y1, z1] in c {
        let mut q = |a: [f32; 3], b: [f32; 3], cc: [f32; 3], d: [f32; 3]| { for p in [a, b, cc, a, cc, d] { t.extend_from_slice(&p); } };
        q([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]); q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
        q([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]); q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
        q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]); q([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
    }
    Mundo::nuevo(t, vec![], 1.0)
}
fn f(v: &Value) -> f32 { v.as_f64().unwrap_or(0.0) as f32 }
fn gente(p: [f32; 3]) -> Gente { Gente { pos: [p[0] as f64, p[1] as f64, p[2] as f64], vivo: true, esf: vec![-0.5, 0.0, 0.5], radio: 0.45, tam: 1.0, id: "yo".into() } }

#[test]
fn actitudes_como_la_web() {
    let w = web(); let base = json!({ "de": "yo" });
    let mut n = 0;
    for x in w["actitudes"]["textos"].as_array().unwrap() {
        let (t, esp) = (x[0].as_str().unwrap(), &x[1]);
        let a = Actitud::de_texto(t, Some(&base)).a_json();
        for k in esp.as_object().unwrap().keys() { assert!(igual(&a[k], &esp[k]), "«{t}» {k}: rust {} web {}", a[k], esp[k]); }
        n += 1;
    }
    for x in w["actitudes"]["normal"].as_array().unwrap() {
        let a = Actitud::normal(&x[0], Some(&base)).a_json();
        for k in x[1].as_object().unwrap().keys() { assert!(igual(&a[k], &x[1][k]), "{} {k}: rust {} web {}", x[0], a[k], x[1][k]); }
        n += 1;
    }
    println!("{n} actitudes iguales a las de la web");
    // (las rápidas del panel y lo que dice el panel)
    let d = Actitud::rapida("defensor", None).unwrap();
    assert_eq!((d.modo, d.arma.map(|a| a.nombre()), d.vida, d.dist), (Modo::Defender, Some("Smg"), 200.0, 3.0));
    assert_eq!(Actitud::rapida("armado", None).unwrap().describir(), "Persigue, ataca, Pistol, 4.0 m/s");
}
fn igual(a: &Value, b: &Value) -> bool { match (a.as_f64(), b.as_f64()) { (Some(x), Some(y)) => (x - y).abs() < 1e-6, _ => a == b } }

/// corre una escena de npc_web.json como npc_ref.js y la compara con lo que hizo la web
fn escena(paq: &mut Paquete, skins: &mut Skins, nombre: &str, e: &Value) -> (f64, usize) {
    let s = &e["escena"];
    let cajas: Vec<[f32; 6]> = s["cajas"].as_array().unwrap().iter().map(|c| [f(&c[0]), f(&c[1]), f(&c[2]), f(&c[3]), f(&c[4]), f(&c[5])]).collect();
    let mundo = mundo_de_cajas(&cajas);
    let mut fis = Fisica::nueva(); fis.gscale = Some(1.0);
    let mut npcs = Npcs::nuevo(&paq.d, s["semilla"].as_u64().unwrap() as u32);
    let jp = [f(&s["jug"]["pos"][0]), f(&s["jug"]["pos"][1]), f(&s["jug"]["pos"][2])];
    let (jug, cam) = (gente(jp), [jp[0], jp[1] + 0.7, jp[2]]);
    let mut ids = vec![];
    for n in s["npcs"].as_array().unwrap() {
        let mut act = match n["rapida"].as_str() { Some(r) => Actitud::rapida(r, None).unwrap().a_json(), None => n["act"].clone() };
        act["de"] = json!("yo");
        let (c, _) = skins.pedir(paq, "Hero", &mut Cargados::default()).unwrap();
        ids.push(npcs.crear(c, [f(&n["p"][0]), f(&n["p"][1]), f(&n["p"][2])], f(&n["yaw"]), Some(Actitud::normal(&act, None)), &mut fis).unwrap());
    }
    let dt = s["dt"].as_f64().unwrap() as f32;
    let (mut tray, mut ev) = (vec![], vec![]);
    for k in 0..s["cuadros"].as_u64().unwrap() as usize {
        npcs.paso(dt, &mundo, &mut fis, &jug, cam);
        let t = (npcs.tiempo() * 1e4).round() / 1e4;
        for x in npcs.eventos() {
            match x {
                Evento::Sonido { nombre, .. } if !nombre.starts_with("PS_") && !nombre.starts_with("VZ_") => ev.push(json!([t, "son", nombre])),
                Evento::Impacto { cuerpo, .. } => ev.push(json!([t, "imp", if cuerpo { "cuerpo" } else { "mundo" }])),
                Evento::DanoJugador { dan, .. } => ev.push(json!([t, "danJ", dan])),
                Evento::DanoNpc { npc, dan } => ev.push(json!([t, "danN", npc, dan])),
                Evento::Decir { npc, texto, .. } => ev.push(json!([t, "decir", npc, texto])),
                _ => {}
            }
        }
        if k >= 14 && (k - 14) % 15 == 0 { tray.push(ids.iter().map(|&id| npcs.get(id).map(|p| (p.cap.pos, p.vivo))).collect::<Vec<_>>()); }
    }
    // dónde estuvo cada NPC (mientras vive: la web de la prueba no tiene muñeco de trapo)
    let mut peor = 0.0f64;
    for (i, x) in e["tray"].as_array().unwrap().iter().enumerate() {
        for (k, r) in tray[i].iter().enumerate() {
            let Some((p, vivo)) = r else { continue }; if !vivo { continue; }
            let w = &x[k + 1]; let d = ((p[0] - w[0].as_f64().unwrap()).powi(2) + (p[1] - w[1].as_f64().unwrap()).powi(2) + (p[2] - w[2].as_f64().unwrap()).powi(2)).sqrt();
            peor = peor.max(d);
        }
    }
    // lo que pasó, en el mismo cuadro y con los mismos números
    let ew = e["ev"].as_array().unwrap();
    assert_eq!(ev.len(), ew.len(), "{nombre}: eventos rust {} web {}\nrust {:?}\nweb {:?}", ev.len(), ew.len(), &ev[..ev.len().min(12)], &ew[..ew.len().min(12)]);
    for (a, b) in ev.iter().zip(ew) {
        let ok = a.as_array().unwrap().iter().zip(b.as_array().unwrap()).all(|(x, y)| match (x.as_f64(), y.as_f64()) { (Some(p), Some(q)) => (p - q).abs() < 1e-3, _ => x == y });
        assert!(ok, "{nombre}: evento rust {a} web {b}");
    }
    (peor, ev.len())
}

#[test]
fn escenas_como_la_web() {
    let Some(mut paq) = paquete() else { return };
    let w = web(); let mut skins = Skins::nuevo(2, 64);
    for (nombre, e) in w["escenas"].as_object().unwrap() {
        let t = Instant::now();
        let (peor, nev) = escena(&mut paq, &mut skins, nombre, e);
        println!("{nombre:<10} la peor diferencia con la web {:.4} m, {nev} eventos iguales ({:.0} ms)", peor, t.elapsed().as_secs_f64() * 1000.0);
        assert!(peor < 0.01, "{nombre}: {peor} m");
    }
}

/// un piso de 120 m con la física andando: un NPC que se cae al piso, se levanta, muere y se borra
#[test]
fn muneco_de_trapo() {
    let Some(mut paq) = paquete() else { return };
    let mundo = mundo_de_cajas(&[[-60.0, -1.0, -60.0, 60.0, 0.0, 60.0]]);
    let mut fis = Fisica::nueva(); let mut skins = Skins::nuevo(2, 64);
    let mut npcs = Npcs::nuevo(&paq.d, 7);
    let (c, _) = skins.pedir(&mut paq, "Hero", &mut Cargados::default()).unwrap();
    let id = npcs.crear(c, [0.0, 0.0, 0.0], 0.0, Some(Actitud::rapida("quieto", None).unwrap()), &mut fis).unwrap();
    let jug = gente([0.0, 0.95, 10.0]); let cam = [0.0, 1.7, 10.0];
    let cap = npcs.get(id).unwrap().cuerpo.unwrap();
    let correr = |npcs: &mut Npcs, fis: &mut Fisica, s: f32| -> Vec<Evento> {
        let mut ev = vec![];
        for _ in 0..(s * 60.0) as usize { fis.paso(&mundo, 1.0 / 60.0); npcs.paso(1.0 / 60.0, &mundo, fis, &jug, cam); npcs.animar(1.0 / 60.0, cam, None, fis); ev.extend(npcs.eventos()); }
        ev
    };
    correr(&mut npcs, &mut fis, 0.5);
    assert!((npcs.get(id).unwrap().cap.pos[1] - 0.95).abs() < 0.01, "parado en el piso: {:?}", npcs.get(id).unwrap().cap.pos);
    // una patada del jugador lo tira (como patadas.js: 6 m/s para adelante y 3 para arriba)
    npcs.tumbar(id, [0.0, 3.0, 6.0], &mut fis);
    let p = npcs.get(id).unwrap(); let r = p.rag.as_ref().expect("muñeco");
    let partes: Vec<u32> = r.cuerpos().collect();
    println!("muñeco: {} partes, {} uniones; la cápsula sin rayos ni física", partes.len(), fis.uniones.len());
    assert_eq!(partes.len(), 15); assert_eq!(fis.uniones.len(), 14);
    let b = fis.cuerpo(cap).unwrap(); assert!(b.no_rayo && b.sin_fisica);
    assert_eq!(npcs.de_cuerpo(partes[3]), Some(id));
    let ev = correr(&mut npcs, &mut fis, 1.0);
    let p = npcs.get(id).unwrap(); println!("tirado: la cadera en {:?}", p.cap.pos);
    assert!(p.rag.is_some() && p.cap.pos[2] > 0.5 && p.cap.pos[1] < 0.6, "voló para adelante y quedó en el piso: {:?}", p.cap.pos);
    assert!(ev.iter().all(|e| !matches!(e, Evento::Levantado { .. })));
    // se levanta solo (2,6 a 3,6 s después, cuando quedó quieto)
    let ev = correr(&mut npcs, &mut fis, 4.0);
    let p = npcs.get(id).unwrap();
    assert!(ev.iter().any(|e| matches!(e, Evento::Levantado { .. })) && p.rag.is_none(), "se levantó");
    assert!((p.cap.pos[1] - 0.95).abs() < 0.02, "parado otra vez: {:?}", p.cap.pos);
    let b = fis.cuerpo(cap).unwrap(); assert!(!b.no_rayo && !b.sin_fisica && (b.pos[1] - p.cap.pos[1]).abs() < 1e-6);
    assert_eq!(fis.cuerpos.len(), 1); assert!(fis.uniones.is_empty());
    println!("se levantó en {:?}", p.cap.pos);
    // un tiro fuerte lo mata: queda tirado 15 s y se borra con su cápsula y sus partes
    npcs.danar(id, 150.0, [0.0, 1.0, 0.0], [1.0, 0.0, 0.0], &mut fis, None);
    let ev = npcs.eventos();
    assert!(ev.iter().any(|e| matches!(e, Evento::Murio { .. })) && ev.iter().any(|e| matches!(e, Evento::Sonido { nombre, .. } if nombre.starts_with("VZ_h_dolor"))));
    let ev = correr(&mut npcs, &mut fis, 14.0); assert!(npcs.get(id).is_some() && !ev.iter().any(|e| matches!(e, Evento::Quitado { .. })));
    let ev = correr(&mut npcs, &mut fis, 1.5); assert!(npcs.get(id).is_none() && ev.iter().any(|e| matches!(e, Evento::Quitado { .. })));
    assert!(fis.cuerpos.is_empty(), "sin cuerpos: {}", fis.cuerpos.len());
}

/// la Physics Gun agarra la cápsula: se hace muñeco y se sostiene la parte más cercana; soltado, se levanta
#[test]
fn agarrar_con_las_armas() {
    let Some(mut paq) = paquete() else { return };
    let mundo = mundo_de_cajas(&[[-60.0, -1.0, -60.0, 60.0, 0.0, 60.0]]);
    let mut fis = Fisica::nueva(); let mut skins = Skins::nuevo(2, 64); let mut npcs = Npcs::nuevo(&paq.d, 3);
    let (c, _) = skins.pedir(&mut paq, "Soldier", &mut Cargados::default()).unwrap();
    let id = npcs.crear(c, [0.0, 0.0, 0.0], 0.0, None, &mut fis).unwrap();
    let cap = npcs.get(id).unwrap().cuerpo.unwrap();
    // (un rayo desde los ojos del jugador le pega a la cápsula: como lo encuentran las armas)
    let h = fis.rayo(&mundo, [0.0, 1.6, 5.0], [0.0, 0.0, -1.0], 20.0, &[]).unwrap();
    assert_eq!(h.cuerpo, Some(cap)); assert_eq!(npcs.de_cuerpo(cap), Some(id));
    let parte = npcs.agarrar(cap, [h.p[0] as f32, h.p[1] as f32, h.p[2] as f32], &mut fis);
    assert_ne!(parte, cap); assert_eq!(npcs.de_cuerpo(parte), Some(id));
    let jug = gente([0.0, 0.95, 5.0]);
    // (sostenido 3 s: no se levanta)
    for _ in 0..180 { if let Some(b) = fis.cuerpo_mut(parte) { b.agarrado = true; b.vel = [0.0, 0.0, 0.0]; } fis.paso(&mundo, 1.0 / 60.0); npcs.paso(1.0 / 60.0, &mundo, &mut fis, &jug, [0.0, 1.6, 5.0]); }
    assert!(npcs.get(id).unwrap().rag.is_some());
    if let Some(b) = fis.cuerpo_mut(parte) { b.agarrado = false; }
    for _ in 0..360 { fis.paso(&mundo, 1.0 / 60.0); npcs.paso(1.0 / 60.0, &mundo, &mut fis, &jug, [0.0, 1.6, 5.0]); }
    assert!(npcs.get(id).unwrap().rag.is_none(), "soltado, se levantó");
}

#[test]
fn menu_skins_y_emotes() {
    let Some(paq) = paquete() else { return };
    let m = npc::menu(&paq.d);
    assert_eq!(m.len(), 1); assert_eq!(m[0].0, "Personajes"); assert!(m[0].1.len() >= 40 && m[0].1[0] == "npc:Hero");
    assert_eq!(npc::skin_de_item("npc:BoiledOne").map(npc::skin_nom), Some("The Boiled One"));
    let p = ClipEmote::de(&paq.d, "Patada").unwrap(); assert!((p.dur() - 0.6364).abs() < 1e-3);
    for e in ["ChickenDance", "Techno", "Twerk", "Flair", "Victory", "Clap", "Hi", "Backflip", "AirSquat"] { assert!(ClipEmote::de(&paq.d, e).is_some(), "{e}"); }
    assert!(ClipEmote::de(&paq.d, "rb:Gangnam").is_none());
}

/// en RB_Flatgrass: uno que te sigue llega como debe (corre a 5,5 m/s y a menos de 11 m camina a 4), y 50 NPC haciendo de
/// todo, con lo que tarda cada cuadro (pensar y moverse, la física y animar)
#[test]
fn en_flatgrass() {
    let Some(mut paq) = paquete() else { return };
    let mapa = jxjuego::mapa::armar(&mut paq, "RB_Flatgrass", 64, 750.0).expect("mapa");
    let sp = mapa.spawns.first().map(|s| s.0).unwrap_or([0.0; 3]);
    let piso = |x: f32, z: f32| mapa.mundo.rayo([x, sp[1] + 50.0, z], [0.0, -1.0, 0.0], 200.0).map(|g| sp[1] + 50.0 - g.t).unwrap_or(sp[1]);
    let mut skins = Skins::nuevo(2, 64); let mut ya = Cargados::default();
    // 1. seguir: de 30 m a 3,6 m del jugador
    let mut fis = Fisica::nueva(); let mut npcs = Npcs::nuevo(&paq.d, 11);
    let (c, _) = skins.pedir(&mut paq, "Hero", &mut ya).unwrap();
    let a = [sp[0], piso(sp[0], sp[2]), sp[2]]; let b = [sp[0] + 30.0, piso(sp[0] + 30.0, sp[2]), sp[2]];
    let id = npcs.crear(c, a, 0.0, Some(Actitud::normal(&json!({ "modo": "seguir", "vel": 4, "obj": "yo", "dist": 3, "de": "yo" }), None)), &mut fis).unwrap();
    let jug = gente([b[0], b[1] + 0.95, b[2]]); let cam = [b[0], b[1] + 1.65, b[2]];
    let mut llego = None;
    for k in 0..900 {
        fis.paso(&mapa.mundo, 1.0 / 60.0); npcs.paso(1.0 / 60.0, &mapa.mundo, &mut fis, &jug, cam);
        let p = npcs.get(id).unwrap().cap.pos; let d = (p[0] - jug.pos[0]).hypot(p[2] - jug.pos[2]);
        if d <= 3.6 && llego.is_none() { llego = Some((k + 1) as f64 / 60.0); }
    }
    // (lo ideal: acelera a 16 m/s² hasta 5,5; a 11 m frena a 4 y llega a 3,6 m)
    let ideal = 5.5 / 16.0 / 2.0 + (30.0 - 11.0 - 5.5 * 5.5 / 32.0) / 5.5 + (11.0 - 3.6) / 4.0;
    let t = llego.expect("llegó");
    println!("Flatgrass: seguir 30 m tardó {t:.2} s (lo ideal {ideal:.2} s); terminó a {:.2} m, en el piso {}", { let p = npcs.get(id).unwrap().cap.pos; (p[0] - jug.pos[0]).hypot(p[2] - jug.pos[2]) }, npcs.get(id).unwrap().cap.suelo);
    assert!((t - ideal).abs() / ideal < 0.1, "tardó {t} s, lo ideal {ideal}");
    // 2. 50 NPC: hostiles, armados, que te siguen, que pasean, que bailan y que pelean entre ellos, en 20 × 20 m
    let mut fis = Fisica::nueva(); let mut npcs = Npcs::nuevo(&paq.d, 5); npcs.max = 50;
    let skins_l = ["Hero", "Soldier", "Jean", "Zombi", "Swat"]; let mut escenas = 0;
    for k in 0..50 {
        let (c, e) = skins.pedir(&mut paq, skins_l[k % 5], &mut ya).unwrap(); if e.is_some() { escenas += 1; }
        let (x, z) = (sp[0] - 10.0 + (k % 10) as f32 * 2.2, sp[2] + 6.0 + (k / 10) as f32 * 2.5);
        let act = match k % 6 { 0 => Actitud::rapida("agresivo", None), 1 => Actitud::rapida("armado", None), 2 => Actitud::rapida("amigo", None), 3 => Actitud::rapida("paseo", None), 4 => Actitud::rapida("bailarin", None), _ => Some(Actitud::normal(&json!({ "modo": "perseguir", "vel": 4, "hostil": true, "obj": "npc" }), None)) };
        npcs.crear(c, [x, piso(x, z), z], 0.0, act, &mut fis).unwrap();
    }
    let jug = gente([sp[0], piso(sp[0], sp[2]) + 0.95, sp[2]]); let cam = [jug.pos[0] as f32, jug.pos[1] as f32 + 0.7, jug.pos[2] as f32];
    let vp = jxmotor::mat::mul(&persp(1.2, 16.0 / 9.0, 0.08, 750.0), &jxmotor::mat::mirar(cam, [cam[0], cam[1], cam[2] + 1.0], [0.0, 1.0, 0.0]));
    let (mut t_npc, mut t_fis, mut t_anim, mut n) = (0.0f64, 0.0f64, 0.0f64, 0); let mut items = vec![]; let (mut golpes, mut tiros) = (0, 0);
    for k in 0..1200 {
        let t0 = Instant::now(); if k % 2 == 0 { fis.paso(&mapa.mundo, 1.0 / 60.0); }
        let t1 = Instant::now(); npcs.paso(1.0 / 120.0, &mapa.mundo, &mut fis, &jug, cam);
        let t2 = Instant::now(); npcs.animar(1.0 / 120.0, cam, Some(&vp), &fis); items.clear(); npcs.items(&mut items);
        let t3 = Instant::now();
        for e in npcs.eventos() { match e { Evento::DanoJugador { .. } => golpes += 1, Evento::Traza { .. } => tiros += 1, _ => {} } }
        if k >= 240 { t_fis += (t1 - t0).as_secs_f64(); t_npc += (t2 - t1).as_secs_f64(); t_anim += (t3 - t2).as_secs_f64(); n += 1; }
    }
    let ms = |x: f64| x * 1000.0 / n as f64;
    let vivos = npcs.lista.iter().filter(|p| p.vivo).count(); let tirados = npcs.lista.iter().filter(|p| p.rag.is_some()).count();
    let caidos = npcs.lista.iter().filter(|p| p.cap.pos[1] < sp[1] as f64 - 5.0).count();
    println!("50 NPC en Flatgrass a 120 cuadros por segundo ({} skins): pensar y moverse {:.3} ms por cuadro, animar y dibujar {:.3} ms ({} ítems), la física (a 60) {:.3} ms",
        escenas, ms(t_npc), ms(t_anim), items.len(), ms(t_fis));
    println!("  en 10 s: {vivos} vivos, {tirados} tirados, {} borrados; {golpes} golpes al jugador, {tiros} tiros", 50 - npcs.lista.len());
    assert_eq!(caidos, 0, "ninguno se cayó del mapa");
    assert!(golpes > 0 && tiros > 0);
    // 3. lo mismo con 200 cajas sueltas entre ellos (las chocan, las empujan y las tiran los tiros)
    let mut fis = Fisica::nueva(); let mut npcs = Npcs::nuevo(&paq.d, 5); npcs.max = 50;
    let mut cajas = vec![];
    for k in 0..200 {
        let (x, z) = (sp[0] - 12.0 + (k % 20) as f32 * 1.3, sp[2] + 4.0 + (k / 20) as f32 * 1.6 + 0.6);
        let mut b = jxjuego::fisica::Cuerpo::nuevo(std::sync::Arc::new(jxjuego::fisica::forma_caja(0.3, 0.3, 0.3)), 20.0, Default::default());
        b.pos = [x as f64, piso(x, z) as f64 + 0.31, z as f64]; let p0 = b.pos; cajas.push((fis.agregar(b), p0));
    }
    for k in 0..50 {
        let (c, _) = skins.pedir(&mut paq, "Hero", &mut ya).unwrap();
        let (x, z) = (sp[0] - 10.0 + (k % 10) as f32 * 2.2, sp[2] + 6.0 + (k / 10) as f32 * 2.5);
        let act = match k % 6 { 0 => Actitud::rapida("agresivo", None), 1 => Actitud::rapida("armado", None), 2 => Actitud::rapida("amigo", None), 3 => Actitud::rapida("paseo", None), 4 => Actitud::rapida("bailarin", None), _ => Some(Actitud::normal(&json!({ "modo": "perseguir", "vel": 4, "hostil": true, "obj": "npc" }), None)) };
        npcs.crear(c, [x, piso(x, z), z], 0.0, act, &mut fis).unwrap();
    }
    let (mut t_npc, mut t_fis, mut n) = (0.0f64, 0.0f64, 0);
    for k in 0..1200 {
        let t0 = Instant::now(); if k % 2 == 0 { fis.paso(&mapa.mundo, 1.0 / 60.0); }
        let t1 = Instant::now(); npcs.paso(1.0 / 120.0, &mapa.mundo, &mut fis, &jug, cam); npcs.eventos();
        let t2 = Instant::now();
        if k >= 240 { t_fis += (t1 - t0).as_secs_f64(); t_npc += (t2 - t1).as_secs_f64(); n += 1; }
    }
    let ms = |x: f64| x * 1000.0 / n as f64;
    let movidas = cajas.iter().filter(|(id, p0)| fis.cuerpo(*id).map(|b| ((b.pos[0] - p0[0]).powi(2) + (b.pos[2] - p0[2]).powi(2)).sqrt() > 0.05).unwrap_or(false)).count();
    let caidos = npcs.lista.iter().filter(|p| p.cap.pos[1] < sp[1] as f64 - 5.0).count();
    println!("50 NPC y 200 cajas: pensar y moverse {:.3} ms por cuadro, la física (a 60, con las cajas) {:.3} ms; {movidas} cajas corridas (empujadas o a los tiros)", ms(t_npc), ms(t_fis));
    assert_eq!(caidos, 0); assert!(movidas > 0, "las empujaron");
}
fn persp(fovy: f32, asp: f32, n: f32, f: f32) -> [f32; 16] {
    let t = 1.0 / (fovy / 2.0).tan(); let mut m = [0.0; 16];
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1.0; m[14] = 2.0 * f * n / (n - f); m
}
