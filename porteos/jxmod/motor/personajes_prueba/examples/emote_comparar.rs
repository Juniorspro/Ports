//! Los emotes de los NPC (la patada y los bailes, `Personaje::emote`) cuadro a cuadro con una secuencia fija, en el espacio
//! del personaje, para compararlos con los de la web (web/emote_ref.js: humano.js con P.emote) con web/comparar.py.
//! Uso: emote_comparar SECUENCIA.json SALIDA.json [SKIN]   (JXM_WWW: la carpeta del paquete)
use jxjuego::paquete::Paquete;
use jxjuego::personaje::{Cargados, ClipEmote, Estado, Personaje, HUESOS};
use serde_json::{json, Value};
use std::path::Path;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let sec: Value = serde_json::from_str(&std::fs::read_to_string(&a[1]).expect("secuencia")).expect("secuencia rara");
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxp_apk/activos/www".into());
    let mut paq = Paquete::abrir(Path::new(&www)).expect("paquete");
    let skin = a.get(3).cloned().unwrap_or("Hero".into());
    let (mut pj, _) = Personaje::cargar(&mut paq, &skin, 0, 64, &mut Cargados::default()).expect("personaje");
    let mut nom: Vec<String> = HUESOS.iter().map(|s| s.to_string()).collect();
    nom.extend(["LeftToeBase", "RightToeBase", "HeadTop_End", "LeftHandMiddle4"].iter().map(|s| s.to_string()));
    let mut e = Estado { piso: [0.0, 0.0, 0.0], en_suelo: true, ..Default::default() };
    let (mut cuadros, mut emotes) = (vec![], vec![]); let mut actual = String::new();
    for s in sec.as_array().unwrap() {
        for i in 0..s["n"].as_u64().unwrap() {
            let dt = 1.0 / 60.0f32;
            if i == 0 { if let Some(n) = s["emote"].as_str() { let c = if n.is_empty() { None } else { ClipEmote::de(&paq.d, n) }; pj.emote(c.as_ref()); actual = n.to_string(); } }
            e.vel = [s["v"][0].as_f64().unwrap() as f32, s["v"][1].as_f64().unwrap() as f32, s["v"][2].as_f64().unwrap() as f32];
            e.en_suelo = s["suelo"].as_bool().unwrap(); e.agachado = s["ag"].as_bool().unwrap_or(false); e.mira = s["mira"].as_f64().unwrap_or(0.0) as f32; e.yaw = s["yaw"].as_f64().unwrap_or(0.0) as f32;
            e.piso[0] += e.vel[0] * dt; e.piso[2] += e.vel[2] * dt;
            pj.animar(dt, &e);
            if !pj.en_emote() { actual.clear(); }
            let mut r = serde_json::Map::new();
            for h in &nom { if let Some(m) = pj.hueso(h).or_else(|| pj.nodo(&format!("mixamorig:{h}"))) { r.insert(h.clone(), json!([m[12], m[13], m[14]])); } }
            cuadros.push(Value::Object(r)); emotes.push(actual.clone());
        }
    }
    std::fs::write(&a[2], serde_json::to_string(&json!({ "tobillo": pj.tobillo(), "cuadros": cuadros, "emotes": emotes })).unwrap()).unwrap();
    println!("{} cuadros", cuadros.len());
}
