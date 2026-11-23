//! Los NPC de jxjuego::npc en las mismas escenas que corre la web en Node (web/npc_ref.js): un mundo de cajas, el jugador
//! quieto y el azar con la misma semilla. Escribe cada cuadro dónde está cada NPC y lo que pasó, para compararlo con
//! web/npc_comparar.py.
//! Uso: npc_comparar ESCENA.json SALIDA.json   (JXM_WWW: la carpeta del paquete)
use jxjuego::fisica::Fisica;
use jxjuego::mundo::Mundo;
use jxjuego::npc::{Actitud, Evento, Gente, Npcs, Skins};
use jxjuego::paquete::Paquete;
use jxjuego::personaje::Cargados;
use serde_json::{json, Value};
use std::path::Path;

/// las caras de las cajas, dos triángulos por cara (en el mismo orden que npc_ref.js)
pub fn mundo_de_cajas(c: &[[f32; 6]]) -> Mundo {
    let mut t: Vec<f32> = vec![];
    for &[x0, y0, z0, x1, y1, z1] in c {
        let mut q = |a: [f32; 3], b: [f32; 3], cc: [f32; 3], d: [f32; 3]| { for p in [a, b, cc, a, cc, d] { t.extend_from_slice(&p); } };
        q([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]); q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
        q([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]); q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
        q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]); q([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
    }
    Mundo::nuevo(t, vec![], 1.0)
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let esc: Value = serde_json::from_str(&std::fs::read_to_string(&a[1]).expect("escena")).expect("escena rara");
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxp_apk/activos/www".into());
    let mut paq = Paquete::abrir(Path::new(&www)).expect("paquete");
    let f = |v: &Value| v.as_f64().unwrap_or(0.0) as f32;
    let cajas: Vec<[f32; 6]> = esc["cajas"].as_array().unwrap().iter().map(|c| [f(&c[0]), f(&c[1]), f(&c[2]), f(&c[3]), f(&c[4]), f(&c[5])]).collect();
    let mundo = mundo_de_cajas(&cajas);
    let mut fis = Fisica::nueva(); fis.gscale = Some(1.0);
    let mut npcs = Npcs::nuevo(&paq.d, esc["semilla"].as_u64().unwrap_or(1) as u32);
    let mut skins = Skins::nuevo(2, 64); let mut ya = Cargados::default();
    let jp = &esc["jug"]["pos"]; let pos = [f(&jp[0]), f(&jp[1]), f(&jp[2])];
    let mut jug = Gente { pos: [pos[0] as f64, pos[1] as f64, pos[2] as f64], vivo: esc["jug"]["vivo"].as_bool().unwrap_or(true), esf: vec![-0.5, 0.0, 0.5], radio: 0.45, tam: 1.0, id: "yo".into() };
    if esc["jug"]["agachado"].as_bool().unwrap_or(false) { jug.esf = vec![-0.5, -0.45]; }
    let cam = [pos[0], pos[1] + 0.7, pos[2]];
    let mut ids = vec![];
    for n in esc["npcs"].as_array().unwrap() {
        // (como npc_ref.js: la rápida del panel, lo que se escribió encima y de quién es)
        let mut act = match n["rapida"].as_str() {
            Some(r) => { let mut x = Actitud::rapida(r, None).unwrap().a_json(); if let Some(o) = n["act"].as_object() { for (k, v) in o { x[k] = v.clone(); } } x }
            None => n["act"].clone(),
        };
        act["de"] = json!("yo");
        let (cuerpo, _) = skins.pedir(&mut paq, "Hero", &mut ya).expect("Hero");
        let p = &n["p"];
        ids.push(npcs.crear(cuerpo, [f(&p[0]), f(&p[1]), f(&p[2])], f(&n["yaw"]), Some(Actitud::normal(&act, None)), &mut fis).expect("npc"));
    }
    let dt = esc["dt"].as_f64().unwrap_or(1.0 / 60.0) as f32;
    let (mut cuadros, mut ev) = (vec![], vec![]);
    let t0 = std::time::Instant::now();
    // (JXM_TRAZA=a-b: la cápsula de cada NPC antes y después de esos cuadros)
    let traza: Option<(usize, usize)> = std::env::var("JXM_TRAZA").ok().and_then(|s| { let (a, b) = s.split_once('-')?; Some((a.parse().ok()?, b.parse().ok()?)) });
    for k in 0..esc["cuadros"].as_u64().unwrap() as usize {
        let ver = traza.map(|(a, b)| k >= a && k <= b).unwrap_or(false);
        if ver { for &id in &ids { if let Some(p) = npcs.get(id) { println!("{k} antes {id} pos {:?} vel {:?} suelo {}", p.cap.pos, p.cap.vel, p.cap.suelo); } } }
        npcs.paso(dt, &mundo, &mut fis, &jug, cam);
        if ver { for &id in &ids { if let Some(p) = npcs.get(id) { println!("{k} después {id} pos {:?} vel {:?} suelo {}", p.cap.pos, p.cap.vel, p.cap.suelo); } } }
        let t = (npcs.tiempo() * 1e4).round() / 1e4;
        for e in npcs.eventos() {
            match e {
                Evento::Sonido { nombre, .. } if !nombre.starts_with("PS_") && !nombre.starts_with("VZ_") => ev.push(json!([t, "son", nombre])),
                Evento::Impacto { cuerpo, .. } => ev.push(json!([t, "imp", if cuerpo { "cuerpo" } else { "mundo" }])),
                Evento::DanoJugador { dan, .. } => { ev.push(json!([t, "danJ", (dan as f64 * 1e4).round() / 1e4])); }
                Evento::DanoNpc { npc, dan } => ev.push(json!([t, "danN", npc, (dan as f64 * 1e4).round() / 1e4])),
                Evento::Decir { npc, texto, .. } => ev.push(json!([t, "decir", npc, texto])),
                _ => {}
            }
        }
        cuadros.push(ids.iter().map(|&id| match npcs.get(id) { Some(p) => json!([p.cap.pos[0], p.cap.pos[1], p.cap.pos[2], p.yaw, p.vida, p.emote.clone().unwrap_or_default(), p.cap.suelo as u8]), None => json!(null) }).collect::<Vec<_>>());
    }
    let ms = t0.elapsed().as_secs_f64() * 1000.0 / cuadros.len().max(1) as f64;
    std::fs::write(&a[2], serde_json::to_string(&json!({ "cuadros": cuadros, "ev": ev })).unwrap()).unwrap();
    println!("cuadros {} eventos {} ({:.4} ms por cuadro)", cuadros.len(), ev.len(), ms);
}
