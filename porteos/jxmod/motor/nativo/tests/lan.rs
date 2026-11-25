//! La partida en el Wi-Fi (lan.rs) de punta a punta, como en dos celulares: Ana hace de anfitriona (el broker MQTT sobre
//! WebSocket en el 8765, /lan.json y el anuncio por UDP en el 8766), Beto encuentra la partida en la lista por el anuncio,
//! entran los dos con el cliente de red del juego (red.rs + Puente, por ws://), se ven, chatean, y al cerrar la partida
//! a Beto se le corta.
use jxjuego::red::{Evento, Jugador, Local, Puente, Red, Sala};
use jxmod::lan::{ip_local, Anfitrion, Buscador, PUERTO};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::thread;
use std::time::{Duration, Instant};

struct Juego { red: Red, pu: Puente, local: Local, evs: Vec<Evento> }
impl Juego {
    fn nuevo(id: &str, nombre: &str, broker: &str) -> Juego {
        let mut red = Red::nueva(Some(id), nombre); red.broker = broker.into(); red.cfg.mapa = "RB_Flatgrass".into();
        let local = Local { jug: Jugador { skin: "Hero".into(), gorro: "HatEmpty".into(), vivo: true, suelo: true, vida: 100.0, ..Jugador::default() }, ..Local::default() };
        Juego { red, pu: Puente::tcp(), local, evs: vec![] }
    }
    fn cuadro(&mut self, dt: f64) {
        self.pu.bombear(&mut self.red); self.local.jug.reloj += dt;
        self.red.paso(dt, &self.local); self.pu.bombear(&mut self.red);
        self.evs.extend(self.red.eventos());
    }
}
fn correr(a: &mut Juego, b: &mut Juego, seg: f64, mut mover: impl FnMut(&mut Juego, &mut Juego, f64), listo: impl Fn(&Juego, &Juego) -> bool) -> bool {
    let t0 = Instant::now();
    while t0.elapsed().as_secs_f64() < seg {
        let t = t0.elapsed().as_secs_f64(); mover(a, b, t);
        a.cuadro(1.0 / 60.0); b.cuadro(1.0 / 60.0);
        if listo(a, b) { return true; }
        thread::sleep(Duration::from_millis(16));
    }
    false
}
fn http_get(ruta: &str) -> String {
    let mut s = TcpStream::connect(("127.0.0.1", PUERTO)).unwrap(); s.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
    s.write_all(format!("GET {ruta} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n").as_bytes()).unwrap();
    let mut r = String::new(); let _ = s.read_to_string(&mut r); r
}

#[test]
fn partida_en_el_wifi() {
    let info = serde_json::json!({ "du": "ana000001", "n": "Ana", "s": "Ana · LAN", "m": "RB_Flatgrass", "p": PUERTO });
    let host = Anfitrion::empezar(&info).expect("no se pudo abrir el 8765");
    // /lan.json (lo que pide la web para entrar escribiendo la IP)
    let j = http_get("/lan.json"); let cuerpo = j.split("\r\n\r\n").nth(1).unwrap_or("");
    let d: serde_json::Value = serde_json::from_str(cuerpo).unwrap_or_default();
    assert!(j.starts_with("HTTP/1.1 200") && d["du"] == "ana000001" && d["j"] == 0, "/lan.json: {j}");
    assert!(http_get("/otra").starts_with("HTTP/1.1 404"), "una ruta que no es: 404");
    // Beto busca: el anuncio por broadcast (si la red de la máquina lo deja volver)
    let busca = Buscador::empezar(Box::new(|m| m == "RB_Flatgrass")).unwrap();
    let t0 = Instant::now(); let mut hallada = None;
    while t0.elapsed() < Duration::from_secs(4) && hallada.is_none() { hallada = busca.lista().into_iter().find(|h| h.du == "ana000001"); thread::sleep(Duration::from_millis(100)); }
    match &hallada { Some(h) => { println!("anuncio recibido: {h:?}"); assert_eq!((h.n.as_str(), h.s.as_str(), h.m.as_str(), h.puerto), ("Ana", "Ana · LAN", "RB_Flatgrass", PUERTO)); }
        None => println!("(el broadcast no vuelve en esta máquina: ip local {:?}; se sigue por la IP)", ip_local()) }
    // entran los dos: Ana por 127.0.0.1 (como el anfitrión) y Beto por la IP del anuncio (o 127.0.0.1)
    let ip_b = hallada.as_ref().map(|h| h.ip.clone()).unwrap_or_else(|| "127.0.0.1".into());
    let (url_a, url_b) = (format!("ws://127.0.0.1:{PUERTO}/mqtt"), format!("ws://{ip_b}:{PUERTO}/mqtt"));
    let mut a = Juego::nuevo("ana000001", "Ana", &url_a); let mut b = Juego::nuevo("beto00002", "Beto", &url_b);
    let (sa, sb) = (Sala::lan("ana000001", "Ana", "Ana · LAN", "RB_Flatgrass", &url_a), Sala::lan("ana000001", "Ana", "Ana · LAN", "RB_Flatgrass", &url_b));
    a.red.entrar(&sa, None).unwrap(); a.red.empezar(None); b.red.entrar(&sb, None).unwrap(); b.red.empezar(None);
    assert!(correr(&mut a, &mut b, 6.0, |_, _, _| {}, |a, b| a.red.on && b.red.on), "no se conectaron al broker de Ana");
    let mut chat = false;
    let ok = correr(&mut a, &mut b, 8.0, |a, b, t| {
        a.local.jug.pos = [t * 2.0, 1.0, 0.0]; a.local.jug.vel = [2.0, 0.0, 0.0];
        if !chat && t > 1.0 { b.red.chat("¿se escucha?", Some("c1")); chat = true; }
    }, |a, b| a.red.remoto("beto00002").is_some() && b.red.remoto("ana000001").map(|r| r.pos[0] > 3.0).unwrap_or(false)
        && a.evs.iter().any(|e| matches!(e, Evento::Chat { texto, .. } if texto == "¿se escucha?")));
    println!("Beto ve a Ana en {:?}; en el broker: {} conectados", b.red.remoto("ana000001").map(|r| r.pos), host.gente());
    assert!(ok, "no se vieron por el broker de la partida: {:?}", a.evs);
    assert!(host.gente() >= 2, "el broker cuenta a los dos: {}", host.gente());
    let d: serde_json::Value = serde_json::from_str(http_get("/lan.json").split("\r\n\r\n").nth(1).unwrap_or("")).unwrap_or_default();
    assert!(d["j"].as_u64().unwrap_or(0) >= 2, "/lan.json con la gente: {d}");
    // Ana cierra la partida (sale al menú): a Beto se le corta
    drop(host); b.evs.clear();
    let ok = correr(&mut a, &mut b, 6.0, |_, _, _| {}, |_, b| b.evs.iter().any(|e| matches!(e, Evento::Desconectado)) || !b.red.on);
    assert!(ok, "a Beto no se le cortó al cerrarse la partida");
}
