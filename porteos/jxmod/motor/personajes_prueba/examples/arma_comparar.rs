//! El arma en la mano y sentado en un vehículo, cuadro a cuadro con las escenas de web/armas_escenas.json (las mismas que
//! corre la web en Node: web/arma_ref.js): cada nodo del esqueleto en el mundo y la matriz del modelo del arma en la mano,
//! para compararlos con los de la web (web/arma_comparar.py). De cada vehículo escribe también dónde está, su centro y la
//! cabina de cada asiento: la web los lee de esta salida (corre después).
//! Uso: arma_comparar ESCENAS.json SALIDA.json   (JXM_WWW: la carpeta del paquete)
use jxjuego::fisica::{qeje, qmul, Fisica};
use jxjuego::forma::{cuerpo_de_prefab, Catalogo};
use jxjuego::paquete::Paquete;
use jxjuego::personaje::{base, Asiento, Cargados, Estado, Gesto, Personaje};
use jxjuego::vehiculo::{Tipo, Vehiculos};
use jxmotor::mat::{self as m4};
use serde_json::{json, Value};
use std::path::Path;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let esc: Value = serde_json::from_str(&std::fs::read_to_string(&a[1]).expect("escenas")).expect("escenas raras");
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxm/www_todo".into());
    let mut paq = Paquete::abrir(Path::new(&www)).expect("paquete");
    let mut cat = Catalogo::nuevo(&paq);
    let f = |v: &Value| v.as_f64().unwrap_or(0.0) as f32;
    let mut salida = vec![];
    let t0 = std::time::Instant::now(); let mut n_total = 0; let mut t_anim = (0.0f64, 0usize);
    for e in esc["escenas"].as_array().unwrap() {
        let skin = e["skin"].as_str().unwrap_or("Hero");
        let mut ya = Cargados::default();
        let (mut pj, _) = Personaje::cargar(&mut paq, skin, 0, 64, &mut ya).expect("personaje");
        // el vehículo (si va sentado): su cuerpo en la física, la cabina del asiento y dónde va la persona
        let mut veh = None; let mut vinfo = Value::Null;
        if let Some(v) = e["veh"].as_object() {
            let nombre = v["nombre"].as_str().unwrap(); let asi = v["a"].as_u64().unwrap_or(0) as usize;
            let pf = cat.prefab(&paq, nombre).expect("prefab del vehículo");
            let p = [v["pos"][0].as_f64().unwrap(), v["pos"][1].as_f64().unwrap(), v["pos"][2].as_f64().unwrap()];
            let q = qmul(qeje([0.0, 1.0, 0.0], v["yaw"].as_f64().unwrap_or(0.0)), qeje([1.0, 0.0, 0.0], v["incl"].as_f64().unwrap_or(0.0)));
            let mut fis = Fisica::nueva(); let mut vehs = Vehiculos::nuevo();
            let id = fis.agregar(cuerpo_de_prefab(&pf, p, q, false)); vehs.agregar(&paq, &pf, id, &mut fis, None).expect("no es un vehículo");
            let b = fis.cuerpo(id).unwrap().clone(); let vh = vehs.de(id).unwrap().clone();
            let cab = vehs.cabina(&paq, id, asi); let s = vh.asientos[asi];
            let man = asi == 0 && vh.tipo != Tipo::Asiento;
            // (vehiculoCamara: JUG.pos, 25 cm arriba del asiento —0,75 girado menos 0,5 derecho—)
            let ps = jxjuego::fisica::add(b.pos, jxjuego::fisica::rot(b.q, [s[0], s[1] + 0.75, s[2]]));
            let pos = [ps[0] as f32, (ps[1] - 0.5) as f32, ps[2] as f32];
            let q32 = [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32];
            veh = Some(Asiento { pos, veh: [b.pos[0] as f32, b.pos[1] as f32, b.pos[2] as f32], q: q32, manejando: man, cab: cab.clone() });
            vinfo = json!({ "nombre": nombre, "a": asi, "c": vh.c, "pos": b.pos, "q": b.q, "asientos": vh.asientos, "manejando": man,
                "cab": cab.as_ref().map(|c| json!({ "coj": c.coj, "techo": c.techo, "piso": c.piso, "lejos": c.lejos })), "jug": pos });
            println!("{}: {nombre} asiento {asi} {:?} cabina {:?}", e["n"], s, cab.as_ref().map(|c| (c.coj, c.techo, c.piso, c.lejos)));
        }
        let mut cuadros = vec![];
        let mut est = Estado { piso: [0.0; 3], en_suelo: true, ..Default::default() };
        let (mut yaw, mut mira) = (0.0f32, 0.0f32);
        for t in e["tramos"].as_array().unwrap() {
            // (lo que tarda cargar el arma y el primer cuadro con ella: ahí se calculan los dedos y la postura del torso)
            let t1 = std::time::Instant::now(); let mut cambio = false;
            if let Some(x) = t.get("arma") { cambio = x.is_string(); if let Some(esc) = pj.poner_arma(&mut paq, x.as_str(), &mut ya) { let _ = esc; } }
            let t_carga = t1.elapsed().as_secs_f64() * 1000.0;
            if t.get("yaw").is_some() { yaw = f(&t["yaw"]); }
            if t.get("mira").is_some() { mira = f(&t["mira"]); }
            for k in 0..t["n"].as_u64().unwrap() {
                let dt = e["dt"].as_f64().map(|x| x as f32).unwrap_or(1.0 / 60.0);
                if k == 0 { match t["accion"].as_str() { Some("tiro") => pj.accion(Gesto::Tiro), Some("recarga") => pj.accion(Gesto::Recarga), Some("golpe") => pj.accion(Gesto::Golpe), _ => {} } }
                let v = &t["v"]; est.vel = if v.is_array() { [f(&v[0]), f(&v[1]), f(&v[2])] } else { [0.0; 3] };
                est.en_suelo = t["suelo"].as_bool().unwrap_or(true); est.agachado = t["ag"].as_bool().unwrap_or(false); est.yaw = yaw; est.mira = mira;
                est.piso[0] += est.vel[0] * dt; est.piso[2] += est.vel[2] * dt;
                if veh.is_some() { est.vel = [0.0; 3]; }
                pj.sentar(&paq, veh.clone());
                let t2 = std::time::Instant::now();
                pj.animar(dt, &est); n_total += 1;
                if k == 0 && cambio { println!("  {} {}: cargar {t_carga:.2} ms, primer cuadro {:.2} ms", e["n"], t["arma"], t2.elapsed().as_secs_f64() * 1000.0); }
                if k > 0 { t_anim.0 += t2.elapsed().as_secs_f64(); t_anim.1 += 1; }
                let b = pj.base_sentado().unwrap_or_else(|| base(est.piso, yaw));
                let (nom, _, w) = pj.esqueleto();
                let mut r = serde_json::Map::new();
                for (i, n) in nom.iter().enumerate() { if !n.starts_with("mixamorig") { continue; } let m = m4::mul(&b, &w[i]); r.insert(n.clone(), json!([m[12], m[13], m[14]])); }
                if let Some(m) = pj.arma_matriz() { r.insert("@arma".into(), json!(m4::mul(&b, &m).to_vec())); }
                cuadros.push(Value::Object(r));
            }
        }
        salida.push(json!({ "n": e["n"], "veh": vinfo, "cuadros": cuadros }));
    }
    println!("{n_total} cuadros: {:.3} ms por cuadro (con las cargas); animar, sin el primer cuadro de cada tramo: {:.4} ms", t0.elapsed().as_secs_f64() * 1000.0 / n_total.max(1) as f64, t_anim.0 * 1000.0 / t_anim.1.max(1) as f64);
    std::fs::write(&a[2], serde_json::to_string(&json!({ "escenas": salida })).unwrap()).unwrap();
}
