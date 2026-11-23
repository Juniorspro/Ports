//! El multijugador (red.rs) contra la web: 7 escenas corridas con juego/red.js de verdad en Node (tests/red_ref.js: dos o
//! tres juegos web en la misma sala, con un broker de mentira) se repiten con red.rs y se compara todo lo que hace «yo»:
//! las conexiones (con su testamento y keepalive), las suscripciones, cada publicación (tema, retenido y el texto, byte
//! por byte), los pedidos HTTP a la tienda y lo que le pasa (entró, salió, chat, tiros, explosiones, daño, cosas que
//! aparecen y se borran…); y cada tanto cómo ve a los demás (dónde dibuja a cada jugador, sus cosas, los NPC, la lista de
//! salas), con tolerancia. Además (si hay Node): lo que publicó red.rs se le da a un juego web y se mira cómo lo ve.
use jxjuego::red::{self, Con, Evento, Jugador, Local, NpcLocal, NuevaSala, ObjLocal, Orden, Red, Reloj, Sala, SimRemoto};
use serde_json::{json, Value};
use std::io::Read;
use std::sync::{Arc, Mutex};

fn web() -> Value {
    let p = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/red_web.json.gz");
    let mut s = String::new(); flate2::read::GzDecoder::new(std::fs::File::open(&p).expect("falta tests/red_web.json.gz (node tests/red_ref.js)")).read_to_string(&mut s).unwrap();
    serde_json::from_str(&s).unwrap()
}
fn f(v: &Value) -> f64 { v.as_f64().unwrap_or(0.0) }
fn a3(v: &Value) -> [f64; 3] { [f(&v[0]), f(&v[1]), f(&v[2])] }
fn a4(v: &Value) -> [f64; 4] { [f(&v[0]), f(&v[1]), f(&v[2]), f(&v[3])] }
fn s(v: &Value) -> String { v.as_str().unwrap_or("").to_string() }
fn so(v: &Value) -> Option<String> { v.as_str().map(String::from) }
fn con(v: &Value) -> Con { if v == "lista" { Con::Lista } else { Con::Sala } }
fn con_txt(c: Con) -> &'static str { match c { Con::Lista => "lista", Con::Sala => "sala" } }

fn local(p: &Value) -> Local {
    let j = &p["jug"];
    let jug = Jugador {
        skin: s(&j["skin"]), skin_wid: so(&j["skin_wid"]), gorro: s(&j["gorro"]), gorro_aj: s(&j["gorro_aj"]), acc: s(&j["acc"]),
        arriba: j["arriba"].as_array().map(|_| a3(&j["arriba"])), color: so(&j["color"]), pos: a3(&j["pos"]), yaw: f(&j["yaw"]), pitch: f(&j["pitch"]), vel: a3(&j["vel"]),
        suelo: j["suelo"] == true, agachado: j["agachado"] == true, vivo: j["vivo"] == true, bits: j["bits"].as_i64().unwrap_or(0) as i32,
        arma: so(&j["arma"]), emote: so(&j["emote"]), vida: f(&j["vida"]), musica: s(&j["musica"]), verity: s(&j["verity"]), pill: s(&j["pill"]),
        vehiculo: j["vehiculo"].as_array().map(|v| (s(&v[0]), v[1].as_i64().unwrap_or(0) as i32)), social: so(&j["social"]), reloj: f(&j["reloj"]),
    };
    let objs = p["objs"].as_array().map(|l| l.iter().map(|o| ObjLocal { id: o["id"].as_u64().unwrap() as u32, nombre: s(&o["nombre"]), pos: a3(&o["pos"]), q: a4(&o["q"]), duerme: o["duerme"] == true, congelado: o["congelado"] == true, maq: s(&o["maq"]), no_mundo: o["no_mundo"] == true }).collect()).unwrap_or_default();
    let simulo = p["simulo"].as_array().map(|l| l.iter().map(|o| SimRemoto { clave: s(&o["clave"]), pos: a3(&o["pos"]), q: a4(&o["q"]), duerme: o["duerme"] == true }).collect()).unwrap_or_default();
    let npcs = p["npcs"].as_array().map(|l| l.iter().map(|n| NpcLocal { id: n["id"].as_i64().unwrap() as i32, skin: s(&n["skin"]), pos: a3(&n["pos"]), yaw: f(&n["yaw"]), vel: a3(&n["vel"]), f: n["f"].as_i64().unwrap() as i32, emote: s(&n["emote"]), arma: s(&n["arma"]), tiros: n["tiros"].as_u64().unwrap_or(0) as u32, mira: n["mira"].as_array().map(|_| a3(&n["mira"])) }).collect()).unwrap_or_default();
    Local { jug, objs, simulo, npcs, entidades: String::new(), mods: String::new() }
}
/// una sala como la da la escena (la oficial, una de la tienda o de la presencia)
fn sala_de(v: &Value, forma: &str, red: &Red) -> Sala {
    if forma == "oficial" { return red.oficiales.iter().find(|o| o.id == s(&v["id"])).unwrap().clone(); }
    let mut x = red::sala_limpia(Some(v), &red.oficiales, &red.mapas).unwrap();
    if let Some(vv) = v["vivo"].as_f64() { x.vivo = Some(vv); }
    x
}
/// lo que mandó red.rs, en la forma de la web
fn op_json(o: &Orden) -> Value {
    match o {
        Orden::Conectar(c, op) => { let w = op.will.as_ref().unwrap(); json!(["conn", con_txt(*c), op.url, op.client_id, op.keepalive, op.reconectar_ms, op.espera_ms, op.clean, w.topic, String::from_utf8_lossy(&w.payload), w.retain]) }
        Orden::Suscribir(c, t) => json!(["sub", con_txt(*c), t]), Orden::Desuscribir(c, t) => json!(["unsub", con_txt(*c), t]),
        Orden::Publicar { con, topic, payload, retain } => json!(["pub", con_txt(*con), topic, payload, retain]),
        Orden::Cerrar(c) => json!(["end", con_txt(*c)]),
        Orden::Http { id, metodo, url, cabeceras, cuerpo } => json!(["http", id, metodo, url, cuerpo, cabeceras.iter().map(|(k, v)| json!([k, v])).collect::<Vec<_>>()]),
    }
}
/// (el final del clientId es al azar)
fn sin_azar(v: &Value) -> Value { let mut v = v.clone(); if v[0] == "conn" { let c = s(&v[3]); v[3] = json!(c.rsplit_once('_').map(|x| x.0).unwrap_or(&c)); } v }
/// lo que le pasó a red.rs, en la forma del registro de la web (None: la web no lo anota)
fn ev_json(e: &Evento, yo: &str) -> Option<Value> {
    Some(match e {
        Evento::Conectado { sala } => json!(["chat", "JXMod", format!("Connected: {sala}"), null, null]),
        Evento::Entro { nombre, .. } => json!(["chat", "JXMod", format!("{nombre} entró"), null, null]),
        Evento::Salio { nombre, .. } => json!(["chat", "JXMod", format!("{nombre} salió"), null, null]),
        Evento::Chat { de, nombre, texto, id } => json!(["chat", nombre, texto, id, de]),
        Evento::Disparo { o, dir, .. } => json!(["tiro", o, dir]),
        Evento::Dano { dano, .. } => json!(["dano", dano]),
        Evento::Explosion { p, r, dano, fuente, .. } => json!(["exp", p, r, dano, fuente.as_ref().map(|k| match k.strip_prefix(&format!("{yo}:")) { Some(n) => format!("propio:{n}"), None => k.clone() })]),
        Evento::ObjetoNuevo { dueno, nombre, .. } => json!(["obj+", dueno, nombre]),
        Evento::ObjetoBorrado { clave } => json!(["obj-", clave]),
        Evento::PropioBorrado { id } => json!(["prop-", id]),
        Evento::Entidades { de, e } => json!(["entidades", de, e.to_string()]),
        Evento::Maquinita { clave, d } => json!(["maq", clave, d.to_string()]),
        Evento::Echado | Evento::SalaCerrada { .. } => json!(["menu"]),
        Evento::MapaAnfitrion { m, .. } => json!(["carga", m]),
        Evento::SalaCreada { sala } => json!(["carga", sala.m]),
        Evento::NpcDice { clave, texto } => json!(["npcdi", clave, texto]),
        Evento::NpcDano { n, tumba, .. } => json!(["npcdan", n, *tumba as u8]),
        _ => return None,
    })
}
fn cerca(a: &Value, b: &Value, tol: f64, donde: &str) {
    match (a, b) {
        (Value::Number(x), Value::Number(y)) => assert!((x.as_f64().unwrap() - y.as_f64().unwrap()).abs() <= tol, "{donde}: {x} ≠ {y}"),
        (Value::Array(x), Value::Array(y)) => { assert_eq!(x.len(), y.len(), "{donde}: largo {a} ≠ {b}"); for (i, (p, q)) in x.iter().zip(y).enumerate() { cerca(p, q, tol, &format!("{donde}[{i}]")); } }
        (Value::Object(x), Value::Object(y)) => { for (k, q) in y { cerca(x.get(k).unwrap_or(&Value::Null), q, tol, &format!("{donde}.{k}")); } }
        _ => assert_eq!(a, b, "{donde}"),
    }
}
/// cómo ve red.rs a los demás, en la forma de __estado() de red_ref.js
fn estado(red: &Red) -> Value {
    json!({
        "on": red.on, "sala": red.sala.as_ref().map(|s| s.id.clone()), "room": red.room,
        "remotos": red.remotos().iter().map(|r| json!({ "id": r.id, "nombre": r.nombre, "pos": r.pos, "yaw": r.yaw, "mira": r.mira, "vel": r.vel, "suelo": r.suelo, "f": r.f, "hp": r.hp, "skin": r.skin, "gorro": r.gorro, "arma": r.arma, "veh": r.veh.as_ref().map(|(k, a)| json!([k, a])), "globo": r.globo })).collect::<Vec<_>>(),
        "objs": red.objetos().iter().map(|o| json!({ "clave": o.clave, "nombre": o.nombre, "dueno": o.dueno, "auth": o.auth, "pos": o.pos, "q": o.q, "cong": o.cong_real })).collect::<Vec<_>>(),
        "cedidos": red.cedidos().iter().map(|(id, p, q)| json!({ "id": id, "pos": p, "q": q })).collect::<Vec<_>>(),
        "auth": red.auths().iter().map(|(id, a)| json!([id, a])).collect::<Vec<_>>(),
        "npcs": red.npcs_remotos().iter().map(|e| json!({ "clave": e.clave, "pos": e.pos, "yaw": e.yaw, "f": e.f })).collect::<Vec<_>>(),
        "lista": red.lista_salas().iter().map(|(s, j)| json!({ "id": s.id, "n": s.n, "j": j })).collect::<Vec<_>>(),
        "cfg": { "hora": red.cfg.hora, "ciclo": red.cfg.ciclo, "ds": red.cfg.ds },
    })
}

struct Corrida { pubs: usize, iguales: usize, ops: usize, evs: usize, estados: usize, peor: f64, salida: Vec<Value> }
/// repite una escena con red.rs y la compara con la web
fn correr(e: &Value) -> Corrida {
    let nombre = s(&e["nombre"]); let yo = s(&e["id"]);
    let reloj = Arc::new(Mutex::new(Reloj::default())); let r2 = reloj.clone();
    let mut red = Red::nueva(Some(&yo), &s(&e["jug_nombre"]));
    red.reloj = Box::new(move || *r2.lock().unwrap());
    red.broker = red::BROKER_WEB.into(); red.cfg.mapa = "RB_Flatgrass".into(); red.cfg.hora = 12.0;
    // (los números de los servers que creó la web: los que mandó a la tienda)
    for o in e["ops"].as_array().unwrap() { if o[1] == "http" && o[5].is_string() && s(&o[4]).ends_with("/salas") { if let Ok(b) = serde_json::from_str::<Value>(&s(&o[5])) { red.ids_prueba.push(s(&b["id"])); } } }
    let (mut ops, mut evs, mut salida) = (vec![], vec![], vec![]);
    let mut estados = 0; let mut peor: f64 = 0.0;
    let esperados: Vec<&Value> = e["estados"].as_array().unwrap().iter().collect();
    for (i, p) in e["pasos"].as_array().unwrap().iter().enumerate() {
        *reloj.lock().unwrap() = Reloj { real: f(&p["real"]), epoca_ms: f(&p["epoca"]) };
        let k = s(&p["k"]);
        match k.as_str() {
            "entrar" => { let sala = sala_de(&p["sala"], &s(&p["forma"]), &red); red.entrar(&sala, p["clave"].as_str()).unwrap(); red.empezar(p["antes"].as_str()); }
            "conecta" => red.conectado(con(&p["con"])),
            "corta" => red.desconectado(con(&p["con"])),
            "msg" => red.mensaje(con(&p["con"]), &s(&p["t"]), s(&p["m"]).as_bytes()),
            "paso" => { red.paso(f(&p["dt"]), &local(p)); salida.push(json!({ "paso": true, "dt": p["dt"], "real": p["real"], "epoca": p["epoca"] })); }
            "objeto" => red.objeto_cambio(),
            "chat" => red.chat(&s(&p["t"]), p["id"].as_str()),
            "tiro" => red.disparo(&s(&p["a"]), a3(&p["o"]), a3(&p["d"])),
            "dano" => red.dano(&s(&p["to"]), f(&p["d"]), a3(&p["v"])),
            "recarga" => red.recarga(),
            "reclamar" => { red.reclamar(&s(&p["o"])); }
            "exp" => red.explosion(a3(&p["p"]), f(&p["r"]), f(&p["d"]), p["o"].as_str()),
            "borrar" => red.borrar(&s(&p["o"])),
            "salir" => red.salir(),
            "lista" => red.conectar_lista(),
            "salas" => red.cargar_salas(),
            "pedir_lista" => red.pedir_lista(),
            "http" => red.http_respuesta(p["i"].as_u64().unwrap() as u32, Ok((200, s(&p["cuerpo"])))),
            "crear" => { let c = &p["c"]; red.crear_servidor(&NuevaSala { n: s(&c["n"]), pw: s(&c["pw"]), m: s(&c["m"]), mo: s(&c["mo"]), pvp: f(&c["pvp"]) != 0.0, rpg: f(&c["rpg"]) != 0.0, nb: f(&c["nb"]) != 0.0, mp: f(&c["mp"]), mv: f(&c["mv"]), mw: None }, None); }
            "empezar" => { red.cfg.mapa = "RB_Construct".into(); red.empezar(None); }
            "cfg" => { red.cfg.hora = f(&p["hora"]); red.cfg.ciclo = p["ciclo"] == true; red.cfg.ds = p["ds"] == true; red.host_publicar(); }
            "limpiar" => red.limpiar(),
            "echar" => red.echar(&s(&p["to"])),
            "borrar_srv" => { let sl = red.sala.clone().unwrap(); red.borrar_servidor(&sl); }
            "estado" => {}
            "nada" => {}
            x => panic!("{nombre}: paso desconocido {x}"),
        }
        for o in red.ordenes() {
            let j = op_json(&o);
            if let Orden::Publicar { con: Con::Sala, topic, payload, .. } = &o { salida.push(json!({ "t": topic, "m": payload, "real": p["real"], "epoca": p["epoca"] })); }
            ops.push(json!([i, j]));
        }
        for ev in red.eventos() { if let Some(j) = ev_json(&ev, &yo) { evs.push(json!([i, j])); } }
        // (lo de este paso, ya: si algo no es igual, se ve dónde empezó)
        let w_i: Vec<Value> = e["ops"].as_array().unwrap().iter().filter(|o| o[0].as_u64() == Some(i as u64)).map(|o| sin_azar(&Value::Array(o.as_array().unwrap()[1..].to_vec()))).collect();
        let r_i: Vec<Value> = ops.iter().filter(|o| o[0].as_u64() == Some(i as u64)).map(|o| sin_azar(&o[1])).collect();
        assert_eq!(r_i, w_i, "{nombre}: paso {i} ({k}): lo que mandó red.rs no es lo de la web");
        if k == "estado" {
            let w = esperados.iter().find(|x| x[0].as_u64() == Some(i as u64)).unwrap_or_else(|| panic!("{nombre}: sin el estado {i}"));
            let r = estado(&red); cerca(&r, &w[1], 1e-6, &format!("{nombre} estado {i}"));
            // (lo más lejos que quedó un jugador o una cosa de dónde lo pone la web)
            for (cl, campo) in [("remotos", "pos"), ("objs", "pos"), ("npcs", "pos"), ("cedidos", "pos")] {
                for (x, y) in r[cl].as_array().unwrap().iter().zip(w[1][cl].as_array().unwrap()) { for c in 0..3 { peor = peor.max((f(&x[campo][c]) - f(&y[campo][c])).abs()); } }
            }
            estados += 1; salida.push(json!({ "vista": true, "i": i, "real": p["real"], "epoca": p["epoca"] }));
        }
    }
    // lo que hizo la web (las conexiones, sin el azar del clientId)
    let web_ops: Vec<Value> = e["ops"].as_array().unwrap().iter().map(|o| { let i = o[0].clone(); let mut v = o.as_array().unwrap()[1..].to_vec(); if v[0] == "http" { v[4] = if v[4].is_null() { Value::Null } else { v[4].clone() }; } json!([i, sin_azar(&Value::Array(v))]) }).collect();
    let mias: Vec<Value> = ops.iter().map(|o| json!([o[0], sin_azar(&o[1])])).collect();
    let pubs = web_ops.iter().filter(|o| o[1][0] == "pub").count();
    let mut iguales = 0;
    for (k, (a, b)) in mias.iter().zip(&web_ops).enumerate() {
        assert_eq!(a, b, "{nombre}: la operación {k} (paso {}) no es la de la web", b[0]);
        if a[1][0] == "pub" { iguales += 1; }
    }
    assert_eq!(mias.len(), web_ops.len(), "{nombre}: {} operaciones y la web {} (la siguiente: {:?} / {:?})", mias.len(), web_ops.len(), mias.get(web_ops.len()), web_ops.get(mias.len()));
    // (sin los avisos de la pantalla, los tiros de los NPC —red.rs los da en NpcRemoto— y lo que borró el juego mismo)
    let pasos = e["pasos"].as_array().unwrap();
    let web_evs: Vec<Value> = e["ev"].as_array().unwrap().iter().filter(|x| x[1] != "aviso" && x[1] != "npctiro" && pasos[x[0].as_u64().unwrap() as usize]["k"] != "borrar").map(|x| { let v = x.as_array().unwrap(); json!([v[0], Value::Array(v[1..].to_vec())]) }).collect();
    for (k, (a, b)) in evs.iter().zip(&web_evs).enumerate() { cerca(a, b, 1e-9, &format!("{nombre}: lo que pasó {k} (red.rs {:?} / web {:?})", &evs[k.saturating_sub(2)..(k + 3).min(evs.len())], &web_evs[k.saturating_sub(2)..(k + 3).min(web_evs.len())])); }
    assert_eq!(evs.len(), web_evs.len(), "{nombre}: {} cosas que pasaron y en la web {} ({:?} / {:?})", evs.len(), web_evs.len(), evs.get(web_evs.len()), web_evs.get(evs.len()));
    // las salas mías (la web las guarda en rb_salas_mias)
    if let Some(m) = e["mias"].as_str() { assert_eq!(serde_json::from_str::<Value>(&red.mias_json()).unwrap(), serde_json::from_str::<Value>(m).unwrap(), "{nombre}: salas mías"); }
    Corrida { pubs, iguales, ops: ops.len(), evs: evs.len(), estados, peor, salida }
}

#[test]
fn igual_que_la_web() {
    let w = web();
    let mut tot = (0, 0, 0, 0, 0);
    for e in w["escenas"].as_array().unwrap() {
        let c = correr(e);
        println!("{:>10}: {} pasos · {} operaciones iguales ({} publicaciones byte por byte) · {} cosas que pasaron · {} estados (lo más lejos: {:.2e} m)", s(&e["nombre"]), e["pasos"].as_array().unwrap().len(), c.ops, c.iguales, c.evs, c.estados, c.peor);
        assert_eq!(c.pubs, c.iguales);
        tot = (tot.0 + c.ops, tot.1 + c.iguales, tot.2 + c.evs, tot.3 + c.estados, tot.4 + e["pasos"].as_array().unwrap().len());
        // lo que publicó red.rs en la básica, a un juego web de verdad (si hay Node)
        if e["nombre"] == "basica" { web_ve_a_rust(&c.salida); }
    }
    println!("total: {} pasos, {} operaciones iguales ({} publicaciones), {} cosas que pasaron, {} estados", tot.4, tot.0, tot.1, tot.2, tot.3);
}

/// red.js (en Node) recibe lo que publicó red.rs: tiene que ver a «Nativo» donde está y sus cosas
fn web_ve_a_rust(salida: &[Value]) {
    let ref_js = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/red_ref.js");
    let dir = std::env::temp_dir().join(format!("jx_red_{}", std::process::id())); let _ = std::fs::create_dir_all(&dir);
    let arch = dir.join("rust.json"); std::fs::write(&arch, serde_json::to_string(salida).unwrap()).unwrap();
    let r = std::process::Command::new("node").arg(&ref_js).arg("--rust").arg(&arch).output();
    let _ = std::fs::remove_dir_all(&dir);
    let Ok(r) = r else { println!("(sin Node: no se prueba lo de red.rs en la web)"); return };
    assert!(r.status.success(), "red_ref.js --rust: {}", String::from_utf8_lossy(&r.stderr));
    let vistas: Value = serde_json::from_slice(&r.stdout).unwrap();
    let l = vistas.as_array().unwrap(); assert!(!l.is_empty());
    let mut vio_cosa = false; let mut vio_jug = 0;
    for v in l {
        let e = &v[1];
        if let Some(r) = e["remotos"].as_array().unwrap().iter().find(|r| r["id"] == "n4t1v0abc") { assert_eq!(r["nombre"], "Nativo"); assert_eq!(r["skin"], "Hero"); vio_jug += 1; }
        if e["objs"].as_array().unwrap().iter().any(|o| o["clave"] == "n4t1v0abc:1" && o["nombre"] == "Crate") { vio_cosa = true; }
    }
    assert!(vio_jug >= 3 && vio_cosa, "la web no vio bien a red.rs: {vio_jug} vistas con el jugador, caja: {vio_cosa}");
    println!("      (la web ve a red.rs: el jugador en {vio_jug} de {} vistas, y su caja)", l.len());
}
