//! El cliente MQTT de verdad (mqtt.rs, con sus hilos) contra un broker chico de esta prueba (en 127.0.0.1, por TCP y por
//! WebSocket, con retenidos, comodines y testamentos), y dos juegos nativos (red.rs + Puente) en la misma sala: se ven,
//! se mueven, ponen cosas, chatean, uno se corta (su testamento borra sus cosas y a los 10 s se va), la conexión se vuelve
//! a abrir sola, y el que se va se despide.
use jxjuego::red::{Evento, Jugador, Local, ObjLocal, Puente, Red, Sala};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

// ---------------- un broker MQTT 3.1.1 chico (hecho aparte del cliente, para probarlo de verdad) ----------------
struct Cli { id: String, tx: Sender<Vec<u8>>, subs: Vec<String>, will: Option<(String, Vec<u8>, bool)>, sock: TcpStream }
#[derive(Default)]
struct Est { clis: HashMap<u64, Cli>, ret: Vec<(String, Vec<u8>)>, sig: u64, publicados: Vec<(String, usize)>, conexiones: usize }
#[derive(Clone)]
struct Broker { e: Arc<Mutex<Est>>, tcp: u16, ws: u16 }
fn coincide(f: &str, t: &str) -> bool {
    let (a, b): (Vec<&str>, Vec<&str>) = (f.split('/').collect(), t.split('/').collect());
    for (i, x) in a.iter().enumerate() { if *x == "#" { return true; } if i >= b.len() || (*x != "+" && *x != b[i]) { return false; } }
    a.len() == b.len()
}
fn pkt_pub(t: &str, m: &[u8], retain: bool) -> Vec<u8> {
    let mut c = (t.len() as u16).to_be_bytes().to_vec(); c.extend(t.as_bytes()); c.extend(m);
    let mut o = vec![0x30 | retain as u8]; let mut n = c.len(); loop { let mut b = (n % 128) as u8; n /= 128; if n > 0 { b |= 128; } o.push(b); if n == 0 { break; } } o.extend(c); o
}
impl Broker {
    fn nuevo() -> Broker {
        let lt = TcpListener::bind("127.0.0.1:0").unwrap(); let lw = TcpListener::bind("127.0.0.1:0").unwrap();
        let b = Broker { e: Arc::new(Mutex::new(Est::default())), tcp: lt.local_addr().unwrap().port(), ws: lw.local_addr().unwrap().port() };
        for (l, ws) in [(lt, false), (lw, true)] { let b2 = b.clone(); thread::spawn(move || for s in l.incoming().flatten() { let b3 = b2.clone(); thread::spawn(move || b3.atender(s, ws)); }); }
        b
    }
    fn publicar(&self, t: &str, m: &[u8], retain: bool) {
        let mut e = self.e.lock().unwrap();
        e.publicados.push((t.to_string(), m.len()));
        if retain { e.ret.retain(|(k, _)| k != t); if !m.is_empty() { e.ret.push((t.to_string(), m.to_vec())); } }
        let p = pkt_pub(t, m, false);
        for c in e.clis.values() { if c.subs.iter().any(|f| coincide(f, t)) { let _ = c.tx.send(p.clone()); } }
    }
    /// corta la conexión de un cliente desde el broker (como si se cayera la red): se publica su testamento
    fn cortar(&self, prefijo: &str) -> bool {
        let e = self.e.lock().unwrap();
        for c in e.clis.values() { if c.id.starts_with(prefijo) { let _ = c.sock.shutdown(Shutdown::Both); return true; } }
        false
    }
    fn atender(&self, s: TcpStream, ws: bool) {
        let mut r = s.try_clone().unwrap(); let w = s.try_clone().unwrap();
        let mut pend: Vec<u8> = vec![];
        if ws {
            // el saludo de WebSocket (el cliente no revisa el Accept)
            let mut b = [0u8; 1024];
            while !pend.windows(4).any(|x| x == b"\r\n\r\n") { let n = r.read(&mut b).unwrap_or(0); if n == 0 { return; } pend.extend(&b[..n]); }
            let i = pend.windows(4).position(|x| x == b"\r\n\r\n").unwrap() + 4; let cab = String::from_utf8_lossy(&pend[..i]).to_string(); pend.drain(..i);
            assert!(cab.starts_with("GET /mqtt ") && cab.contains("Upgrade: websocket") && cab.contains("Sec-WebSocket-Protocol: mqtt"), "{cab}");
            (&w).write_all(b"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: x\r\nSec-WebSocket-Protocol: mqtt\r\n\r\n").unwrap();
        }
        let (tx, rx) = channel::<Vec<u8>>();
        let mut w2 = w.try_clone().unwrap();
        thread::spawn(move || for d in rx { let d = if ws { let mut o = vec![0x82]; if d.len() < 126 { o.push(d.len() as u8); } else { o.push(126); o.extend((d.len() as u16).to_be_bytes()); } o.extend(d); o } else { d }; if w2.write_all(&d).is_err() { break; } });
        let k = { let mut e = self.e.lock().unwrap(); e.sig += 1; e.conexiones += 1; e.sig };
        let mut crudo: Vec<u8> = vec![]; let mut datos: Vec<u8> = if ws { vec![] } else { std::mem::take(&mut pend) };
        if ws { crudo = std::mem::take(&mut pend); }
        let mut b = [0u8; 4096]; let mut limpio = false;
        'fuera: loop {
            // (WebSocket: de los marcos enmascarados del cliente a los bytes de MQTT)
            if ws {
                loop {
                    if crudo.len() < 2 { break; }
                    let mut n = (crudo[1] & 0x7f) as usize; let mut h = 2;
                    if n == 126 { if crudo.len() < 4 { break; } n = u16::from_be_bytes([crudo[2], crudo[3]]) as usize; h = 4; }
                    assert!(crudo[1] & 0x80 != 0, "el cliente tiene que enmascarar");
                    if crudo.len() < h + 4 + n { break; }
                    let m = [crudo[h], crudo[h + 1], crudo[h + 2], crudo[h + 3]]; let op = crudo[0] & 0x0f;
                    let p: Vec<u8> = crudo[h + 4..h + 4 + n].iter().enumerate().map(|(i, x)| x ^ m[i & 3]).collect(); crudo.drain(..h + 4 + n);
                    if op == 8 { break 'fuera; } if op <= 2 { datos.extend(p); }
                }
            }
            // los paquetes enteros
            loop {
                if datos.len() < 2 { break; }
                let (mut n, mut mul, mut i) = (0usize, 1usize, 1usize);
                loop { if i >= datos.len() { break; } let x = datos[i]; n += (x & 127) as usize * mul; mul *= 128; i += 1; if x & 128 == 0 { break; } }
                if datos.len() < i + n { break; }
                let t = datos[0]; let c = datos[i..i + n].to_vec(); datos.drain(..i + n);
                let cad = |c: &[u8], k: usize| -> (String, usize) { let l = u16::from_be_bytes([c[k], c[k + 1]]) as usize; (String::from_utf8_lossy(&c[k + 2..k + 2 + l]).to_string(), k + 2 + l) };
                match t >> 4 {
                    1 => {
                        assert_eq!(&c[..7], b"\x00\x04MQTT\x04"); let fl = c[7]; assert!(fl & 2 != 0, "sesión limpia");
                        let (id, mut k2) = cad(&c, 10);
                        let will = if fl & 4 != 0 { let (wt, k3) = cad(&c, k2); let l = u16::from_be_bytes([c[k3], c[k3 + 1]]) as usize; let wm = c[k3 + 2..k3 + 2 + l].to_vec(); k2 = k3 + 2 + l; Some((wt, wm, fl & 0x20 != 0)) } else { None };
                        let _ = k2;
                        self.e.lock().unwrap().clis.insert(k, Cli { id, tx: tx.clone(), subs: vec![], will, sock: s.try_clone().unwrap() });
                        let _ = tx.send(vec![0x20, 2, 0, 0]);
                    }
                    3 => {
                        let qos = (t >> 1) & 3; let (topic, mut k2) = cad(&c, 0);
                        if qos > 0 { let _ = tx.send(vec![0x40, 2, c[k2], c[k2 + 1]]); k2 += 2; }
                        self.publicar(&topic, &c[k2..], t & 1 == 1);
                    }
                    8 => {
                        let mut k2 = 2; let mut nuevos = vec![];
                        while k2 < c.len() { let (f, k3) = cad(&c, k2); k2 = k3 + 1; nuevos.push(f); }
                        let _ = tx.send(vec![0x90, 2 + nuevos.len() as u8, c[0], c[1]].into_iter().chain(nuevos.iter().map(|_| 0u8)).collect());
                        let mut e = self.e.lock().unwrap(); let ret = e.ret.clone();
                        if let Some(cl) = e.clis.get_mut(&k) { for f in nuevos { for (rt, rm) in &ret { if coincide(&f, rt) { let _ = cl.tx.send(pkt_pub(rt, rm, true)); } } cl.subs.push(f); } }
                    }
                    10 => {
                        let (f, _) = cad(&c, 2); let _ = tx.send(vec![0xB0, 2, c[0], c[1]]);
                        if let Some(cl) = self.e.lock().unwrap().clis.get_mut(&k) { cl.subs.retain(|x| *x != f); }
                    }
                    12 => { let _ = tx.send(vec![0xD0, 0]); }
                    14 => { limpio = true; break 'fuera; }
                    _ => {}
                }
            }
            let n = match r.read(&mut b) { Ok(0) | Err(_) => break, Ok(n) => n };
            if ws { crudo.extend(&b[..n]); } else { datos.extend(&b[..n]); }
        }
        // se fue: si no se despidió, su testamento
        let cl = self.e.lock().unwrap().clis.remove(&k);
        if let Some(cl) = cl { if !limpio { if let Some((t, m, ret)) = cl.will { self.publicar(&t, &m, ret); } } }
    }
}

// ---------------- dos juegos nativos ----------------
struct Juego { red: Red, pu: Puente, local: Local, evs: Vec<Evento> }
impl Juego {
    fn nuevo(id: &str, nombre: &str, broker: &str) -> Juego {
        let mut red = Red::nueva(Some(id), nombre); red.broker = broker.into(); red.cfg.mapa = "RB_Flatgrass".into();
        let local = Local { jug: Jugador { skin: "Hero".into(), gorro: "HatEmpty".into(), vivo: true, suelo: true, vida: 100.0, arma: Some("PhysicsGun".into()), ..Jugador::default() }, ..Local::default() };
        Juego { red, pu: Puente::tcp(), local, evs: vec![] }
    }
    fn cuadro(&mut self, dt: f64) {
        self.pu.bombear(&mut self.red); self.local.jug.reloj += dt;
        self.red.paso(dt, &self.local); self.pu.bombear(&mut self.red);
        self.evs.extend(self.red.eventos());
    }
}
/// los dos juegos a 60 cuadros por segundo (de verdad: los mensajes van por los sockets) hasta que pase `hasta` o se cumpla `listo`
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

#[test]
fn dos_nativos_en_una_sala() {
    let br = Broker::nuevo();
    // Ana por TCP, Beto por WebSocket (como la web): el broker junta los dos
    let mut a = Juego::nuevo("ana000001", "Ana", &format!("mqtt://127.0.0.1:{}", br.tcp));
    let mut b = Juego::nuevo("beto00002", "Beto", &format!("ws://127.0.0.1:{}/mqtt", br.ws));
    let sala = Sala::oficial("RB_Flatgrass");
    for j in [&mut a, &mut b] { j.red.entrar(&sala, None).unwrap(); j.red.empezar(None); }
    assert!(correr(&mut a, &mut b, 5.0, |_, _, _| {}, |a, b| a.red.on && b.red.on && a.red.lista_on && b.red.lista_on), "no se conectaron");
    // se ven (el estado sale a los 1,5 s de conectar) y Ana camina; Beto pone una caja y chatea
    let mut chat = false;
    let ok = correr(&mut a, &mut b, 8.0, |a, b, t| {
        a.local.jug.pos = [t * 2.0, 1.0, 0.0]; a.local.jug.vel = [2.0, 0.0, 0.0]; a.local.jug.yaw = 1.0;
        if b.local.objs.is_empty() && t > 0.5 { b.local.objs.push(ObjLocal { id: 7, nombre: "Crate".into(), pos: [3.0, 0.5, 3.0], q: [0.0, 0.0, 0.0, 1.0], ..ObjLocal::default() }); b.red.objeto_cambio(); }
        if !chat && t > 1.0 { b.red.chat("hola Ana", Some("c1")); chat = true; }
    }, |a, b| {
        let ve = a.red.remoto("beto00002").is_some() && b.red.remoto("ana000001").map(|r| r.pos[0] > 4.0).unwrap_or(false);
        ve && a.red.objeto("beto00002:7").is_some() && a.evs.iter().any(|e| matches!(e, Evento::Chat { texto, .. } if texto == "hola Ana"))
    });
    let ra = b.red.remoto("ana000001").cloned(); let rb = a.red.remoto("beto00002").cloned();
    println!("Beto ve a Ana en {:?} (está en {:?}); Ana ve a Beto: {:?}", ra.as_ref().map(|r| r.pos), a.local.jug.pos, rb.as_ref().map(|r| (&r.nombre, r.pos)));
    assert!(ok, "no se vieron: {:?} / {:?} / {:?}", a.evs, b.red.remotos().len(), a.red.objetos().len());
    let ra = ra.unwrap(); assert_eq!(ra.nombre, "Ana"); assert!((ra.pos[0] - a.local.jug.pos[0]).abs() < 1.5, "Ana dibujada lejos: {:?}", ra.pos);
    assert_eq!(rb.unwrap().nombre, "Beto");
    assert!(a.evs.iter().any(|e| matches!(e, Evento::Entro { nombre, .. } if nombre == "Beto")));
    assert!(a.evs.iter().any(|e| matches!(e, Evento::ObjetoNuevo { clave, nombre, .. } if clave == "beto00002:7" && nombre == "Crate")));
    // la lista de salas: la presencia de los dos en la oficial
    let l = a.red.lista_salas(); let f = l.iter().find(|(s, _)| s.id == "f_RB_Flatgrass_1").unwrap();
    let mut j = f.1.clone(); j.sort(); assert_eq!(j, vec!["Ana", "Beto"]);
    // Ana mueve la caja de Beto (la reclama): Beto la ve moverse
    assert_eq!(a.red.reclamar("beto00002:7"), Some(false));
    let ok = correr(&mut a, &mut b, 5.0, |a, _, t| {
        a.local.simulo = vec![jxjuego::red::SimRemoto { clave: "beto00002:7".into(), pos: [3.0, 0.5 + t, 3.0], q: [0.0, 0.0, 0.0, 1.0], duerme: false }];
    }, |_, b| b.red.cedido(7).map(|(p, _)| p[1] > 1.5).unwrap_or(false));
    assert!(ok, "Beto no vio mover su caja: {:?}", b.red.cedido(7));
    assert!(b.evs.iter().any(|e| matches!(e, Evento::PropioReclamado { id: 7, por } if por == "ana000001")));
    a.local.simulo.clear();
    // la conexión de la sala de Ana se corta (desde el broker): se vuelve a conectar sola (3 s) y sigue
    let n0 = br.e.lock().unwrap().conexiones;
    assert!(br.cortar("jxmod_v1_ana000001_"));
    let ok = correr(&mut a, &mut b, 8.0, |_, _, _| {}, |a, _| a.evs.iter().any(|e| matches!(e, Evento::Desconectado)) && a.red.on);
    assert!(ok, "Ana no se reconectó"); assert!(br.e.lock().unwrap().conexiones > n0);
    // (y vuelve a ver lo de Beto: se suscribió de nuevo y le llegó lo retenido)
    let ok = correr(&mut a, &mut b, 3.0, |_, _, _| {}, |_, _| false); assert!(!ok);
    // Beto se corta del todo (se cae la red, sin despedirse): su testamento borra sus cosas y a los 10 s sin estado se va
    a.evs.clear();
    assert!(br.cortar("jxmod_v1_beto00002_")); drop(b.pu);
    let ok = correr(&mut a, &mut Juego::nuevo("x00000000", "X", "mqtt://127.0.0.1:1"), 3.0, |_, _, _| {}, |a, _| a.red.objeto("beto00002:7").is_none());
    assert!(ok, "el testamento de Beto no borró su caja");
    assert!(a.evs.iter().any(|e| matches!(e, Evento::ObjetoBorrado { clave } if clave == "beto00002:7")));
    for _ in 0..12 { a.pu.bombear(&mut a.red); a.red.paso(1.0, &a.local); a.evs.extend(a.red.eventos()); }
    assert!(a.red.remoto("beto00002").is_none() && a.evs.iter().any(|e| matches!(e, Evento::Salio { nombre, .. } if nombre == "Beto")));
    // un tercero entra y se va despidiéndose: Ana lo ve irse en el momento (chau)
    let mut c = Juego::nuevo("cata00003", "Cata", &format!("mqtt://127.0.0.1:{}", br.tcp));
    c.red.entrar(&sala, None).unwrap(); c.red.empezar(None);
    let ok = correr(&mut a, &mut c, 6.0, |_, _, _| {}, |a, _| a.red.remoto("cata00003").is_some());
    assert!(ok, "Ana no vio a Cata");
    c.red.salir(); c.pu.bombear(&mut c.red);
    let t0 = Instant::now(); while t0.elapsed() < Duration::from_secs(3) && a.red.remoto("cata00003").is_some() { a.cuadro(1.0 / 60.0); thread::sleep(Duration::from_millis(10)); }
    assert!(a.red.remoto("cata00003").is_none(), "Cata se despidió y Ana no la sacó");
    // lo retenido de Cata se borró (se despidió) y lo de Ana sigue
    let ret: Vec<String> = br.e.lock().unwrap().ret.iter().map(|(k, _)| k.clone()).collect();
    assert!(!ret.iter().any(|k| k.contains("cata00003")) && ret.iter().any(|k| k == "jxmod_v1_f_RB_Flatgrass_1/w/ana000001"), "{ret:?}");
    let n = br.e.lock().unwrap().publicados.len();
    println!("ok: {n} publicaciones por el broker; retenidos: {ret:?}");
}
