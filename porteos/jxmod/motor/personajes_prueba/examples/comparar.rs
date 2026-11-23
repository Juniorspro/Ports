//! Los huesos del personaje cuadro a cuadro con una secuencia fija (la misma que corre la web en Node: web/ref.js), en el
//! espacio del personaje, para compararlos con los de la web (web/comparar.py).
//! Uso: comparar SECUENCIA.json SALIDA.json [SKIN]
use jxjuego::paquete::Paquete;
use jxjuego::personaje::{Cargados, Estado, Personaje, HUESOS};
use serde_json::{json, Value};
use std::path::Path;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let sec: Value = serde_json::from_str(&std::fs::read_to_string(&a[1]).expect("secuencia")).expect("secuencia rara");
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxp_apk/activos/www".into());
    let mut paq = Paquete::abrir(Path::new(&www)).expect("paquete");
    let skin = a.get(3).cloned().unwrap_or("Hero".into());
    let t = std::time::Instant::now();
    let (mut pj, esc) = Personaje::cargar(&mut paq, &skin, 0, 512, &mut Cargados::default()).expect("personaje");
    println!("{}: cargado en {:.0} ms ({} mallas, {} materiales, {} texturas, {} KB)", pj.skin, t.elapsed().as_secs_f64() * 1000.0, esc.c.mallas.len(), esc.c.mats.len(), esc.c.texs.len(), esc.datos.len() / 1024);
    // (las capturas de nado, como las baja la web)
    let cmu = std::env::var("JXM_CMU").unwrap_or("/home/user/Ports/web/emotes/cmu".into());
    if let (Ok(a), Ok(b)) = (std::fs::read(format!("{cmu}/126_04.bin")), std::fs::read(format!("{cmu}/79_02.bin"))) { pj.nado(&a, &b).expect("capturas de nado"); }
    let mut nom: Vec<String> = HUESOS.iter().map(|s| s.to_string()).collect();
    nom.extend(["LeftToeBase", "RightToeBase", "HeadTop_End", "LeftHandMiddle4"].iter().map(|s| s.to_string()));
    let mut e = Estado { piso: [0.0, 0.0, 0.0], en_suelo: true, ..Default::default() };
    let mut cuadros = vec![]; let t = std::time::Instant::now(); let mut n = 0;
    for s in sec.as_array().unwrap() {
        for _ in 0..s["n"].as_u64().unwrap() {
            let dt = 1.0 / 60.0f32;
            e.vel = [s["v"][0].as_f64().unwrap() as f32, s["v"][1].as_f64().unwrap() as f32, s["v"][2].as_f64().unwrap() as f32];
            e.en_suelo = s["suelo"].as_bool().unwrap(); e.agachado = s["ag"].as_bool().unwrap_or(false); e.mira = s["mira"].as_f64().unwrap_or(0.0) as f32; e.yaw = s["yaw"].as_f64().unwrap_or(0.0) as f32; e.agua = s["agua"].as_f64().map(|y| y as f32);
            e.piso[0] += e.vel[0] * dt; e.piso[2] += e.vel[2] * dt;
            pj.animar(dt, &e); n += 1;
            let mut r = serde_json::Map::new();
            for h in &nom {
                let m = pj.hueso(h).or_else(|| pj.nodo(&format!("mixamorig:{h}")));
                if let Some(m) = m { r.insert(h.clone(), json!([m[12], m[13], m[14]])); }
            }
            if let Some(su) = pj.suelas() { r.insert("suelas".into(), json!(su)); }
            cuadros.push(Value::Object(r));
        }
    }
    println!("{n} cuadros: {:.3} ms por cuadro", t.elapsed().as_secs_f64() * 1000.0 / n as f64);
    std::fs::write(&a[2], serde_json::to_string(&json!({ "tobillo": pj.tobillo(), "cuadros": cuadros })).unwrap()).unwrap();
}
