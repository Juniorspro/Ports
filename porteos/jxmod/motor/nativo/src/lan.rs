//! La partida en la red local (lan.js y Lan.java de la web) en la nativa, compatible con la app web: el anfitrión corre
//! un broker MQTT 3.1.1 chico sobre WebSocket en el puerto 8765 (/mqtt; el mismo protocolo del multijugador de siempre,
//! sólo cambia la dirección del broker) y /lan.json con los datos de la partida, y la anuncia cada segundo por UDP
//! («JXMODLAN1 {json}» por broadcast al puerto 8766). Los demás la ven en la lista de servers y entran con
//! ws://IP:8765/mqtt (la nativa no tiene el problema del contenido mixto del navegador: se conecta directo).
//! Sólo std: hilos y sockets. La web también sirve el juego por HTTP en ese puerto (para el que no tiene la app); la
//! nativa no tiene la página: sólo /lan.json.
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{Ipv4Addr, Shutdown, SocketAddr, TcpListener, TcpStream, UdpSocket};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

pub const PUERTO: u16 = 8765;
pub const PUERTO_ANUNCIO: u16 = 8766;
const MARCA: &str = "JXMODLAN1 ";

/// una partida de la red (lanDatos): ya limpia
#[derive(Clone, Debug, PartialEq)]
pub struct Hallada { pub ip: String, pub puerto: u16, pub n: String, pub s: String, pub m: String, pub du: String, pub j: u32 }

fn limpio(v: &serde_json::Value, n: usize) -> String { v.as_str().unwrap_or("").chars().filter(|c| !c.is_control()).take(n).collect::<String>().trim().to_string() }
fn ip_valida(ip: &str) -> bool { ip.parse::<Ipv4Addr>().is_ok() }
/// lanDatos: lo que anuncia un anfitrión (llega de la red: se limpia todo); `mapa_valido` decide el mapa (si no, FlatGrass)
pub fn datos(d: &serde_json::Value, ip: &str, puerto: u16, mapa_valido: &dyn Fn(&str) -> bool) -> Option<Hallada> {
    if !d.is_object() || !ip_valida(ip) { return None; }
    let du = d.get("du").and_then(|v| v.as_str()).filter(|s| (3..=20).contains(&s.len()) && s.bytes().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit()))?.to_string();
    let num = |v: Option<&serde_json::Value>, a: f64, b: f64, def: f64| v.and_then(|x| x.as_f64().or_else(|| x.as_str().and_then(|s| s.parse().ok()))).filter(|x| x.is_finite()).map(|x| x.clamp(a, b)).unwrap_or(def);
    let p = num(d.get("p"), 1.0, 65535.0, if puerto > 0 { puerto as f64 } else { PUERTO as f64 }) as u16;
    let m = d.get("m").and_then(|v| v.as_str()).filter(|m| mapa_valido(m)).unwrap_or("FlatGrass").to_string();
    let n = limpio(&d["n"], 16); let s = limpio(&d["s"], 24);
    Some(Hallada { ip: ip.into(), puerto: p, n: if n.is_empty() { "?".into() } else { n }, s: if s.is_empty() { "LAN".into() } else { s }, m, du, j: num(d.get("j"), 0.0, 999.0, 0.0) as u32 })
}

// ---------------------------------------------------------------- el broker ----------------------------------------------------------------
struct Cli { tx: Sender<Vec<u8>>, subs: Vec<String>, will: Option<(String, Vec<u8>, bool)> }
#[derive(Default)]
struct Est { clis: HashMap<u64, Cli>, ret: HashMap<String, Vec<u8>>, sig: u64 }

/// un filtro de MQTT (+ un nivel, # el resto) contra un tema
pub fn coincide(filtro: &str, tema: &str) -> bool {
    let (mut f, mut t) = (filtro.split('/'), tema.split('/'));
    loop {
        match (f.next(), t.next()) {
            (Some("#"), _) => return true,
            (Some("+"), Some(_)) => {}
            (Some(a), Some(b)) => if a != b { return false },
            (None, None) => return true,
            _ => return false,
        }
    }
}
fn largo(o: &mut Vec<u8>, mut n: usize) { loop { let mut b = (n % 128) as u8; n /= 128; if n > 0 { b |= 128; } o.push(b); if n == 0 { break; } } }
fn pkt(tipo: u8, cuerpo: &[u8]) -> Vec<u8> { let mut o = vec![tipo]; largo(&mut o, cuerpo.len()); o.extend_from_slice(cuerpo); o }
fn publish(tema: &str, carga: &[u8], retain: bool) -> Vec<u8> {
    let mut c = (tema.len() as u16).to_be_bytes().to_vec(); c.extend_from_slice(tema.as_bytes()); c.extend_from_slice(carga); pkt(0x30 | retain as u8, &c)
}
fn repartir(e: &Est, tema: &str, carga: &[u8], retain_bit: bool) {
    let p = publish(tema, carga, retain_bit);
    for c in e.clis.values() { if c.subs.iter().any(|f| coincide(f, tema)) { let _ = c.tx.send(p.clone()); } }
}
fn publicar(est: &Mutex<Est>, tema: &str, carga: Vec<u8>, retain: bool) {
    let Ok(mut e) = est.lock() else { return };
    if retain { if carga.is_empty() { e.ret.remove(tema); } else { e.ret.insert(tema.to_string(), carga.clone()); } }
    repartir(&e, tema, &carga, false);
}

/// un marco de WebSocket del servidor (sin máscara)
fn marco_ws(op: u8, datos: &[u8]) -> Vec<u8> {
    let mut o = vec![0x80 | op];
    match datos.len() { n if n < 126 => o.push(n as u8), n if n < 65536 => { o.push(126); o.extend_from_slice(&(n as u16).to_be_bytes()); } n => { o.push(127); o.extend_from_slice(&(n as u64).to_be_bytes()); } }
    o.extend_from_slice(datos); o
}

/// lee lo que haya y va armando los marcos de WebSocket: devuelve los datos de los marcos de datos, o None si se cerró
struct LectorWs { buf: Vec<u8> }
impl LectorWs {
    /// los marcos completos que hay en el buffer: (opcode, datos)
    fn marcos(&mut self) -> Vec<(u8, Vec<u8>)> {
        let mut v = vec![];
        loop {
            let b = &self.buf; if b.len() < 2 { break; }
            let op = b[0] & 0x0f; let mask = b[1] & 0x80 != 0; let mut n = (b[1] & 0x7f) as usize; let mut i = 2;
            if n == 126 { if b.len() < 4 { break; } n = u16::from_be_bytes([b[2], b[3]]) as usize; i = 4; }
            else if n == 127 { if b.len() < 10 { break; } n = u64::from_be_bytes(b[2..10].try_into().unwrap()) as usize; i = 10; }
            if n > 4 << 20 { self.buf.clear(); v.push((8, vec![])); break; }
            let k = if mask { if b.len() < i + 4 { break; } let k = [b[i], b[i + 1], b[i + 2], b[i + 3]]; i += 4; Some(k) } else { None };
            if b.len() < i + n { break; }
            let mut d = b[i..i + n].to_vec(); if let Some(k) = k { for (j, x) in d.iter_mut().enumerate() { *x ^= k[j % 4]; } }
            self.buf.drain(..i + n); v.push((op, d));
        }
        v
    }
}

/// un paquete MQTT entero del buffer (tipo, cuerpo), si ya llegó
fn paquete(b: &mut Vec<u8>) -> Option<Result<(u8, Vec<u8>), ()>> {
    if b.len() < 2 { return None; }
    let (mut n, mut mult, mut i) = (0usize, 1usize, 1);
    loop { if i >= b.len() { return None; } let x = b[i]; n += (x & 127) as usize * mult; mult *= 128; i += 1; if x & 128 == 0 { break; } if i > 4 { return Some(Err(())); } }
    if n > 1 << 20 { return Some(Err(())); }
    if b.len() < i + n { return None; }
    let t = b[0]; let c = b[i..i + n].to_vec(); b.drain(..i + n); Some(Ok((t, c)))
}
fn cadena(c: &[u8], i: &mut usize) -> Option<Vec<u8>> {
    if *i + 2 > c.len() { return None; } let n = u16::from_be_bytes([c[*i], c[*i + 1]]) as usize; *i += 2;
    if *i + n > c.len() { return None; } let s = c[*i..*i + n].to_vec(); *i += n; Some(s)
}

/// una conexión: el pedido HTTP, y si es WebSocket a /mqtt, el broker
fn atender(mut s: TcpStream, est: Arc<Mutex<Est>>, info: Arc<Mutex<String>>, vivo: Arc<AtomicBool>, gente: Arc<AtomicUsize>) {
    let _ = s.set_read_timeout(Some(Duration::from_millis(500))); let _ = s.set_nodelay(true);
    let mut buf = vec![]; let t0 = Instant::now(); let mut tmp = [0u8; 8192];
    let fin = loop {
        if let Some(p) = buf.windows(4).position(|w| w == b"\r\n\r\n") { break p; }
        if buf.len() > 16384 || t0.elapsed() > Duration::from_secs(5) || !vivo.load(Ordering::Relaxed) { return; }
        match s.read(&mut tmp) { Ok(0) => return, Ok(n) => buf.extend_from_slice(&tmp[..n]), Err(_) => {} }
    };
    let cab = String::from_utf8_lossy(&buf[..fin]).to_string(); let resto = buf[fin + 4..].to_vec();
    let mut lineas = cab.split("\r\n"); let primera = lineas.next().unwrap_or("");
    let ruta = primera.split(' ').nth(1).unwrap_or("/").to_string();
    let h: HashMap<String, String> = lineas.filter_map(|l| l.split_once(':')).map(|(k, v)| (k.trim().to_lowercase(), v.trim().to_string())).collect();
    let es_ws = h.get("upgrade").map(|u| u.eq_ignore_ascii_case("websocket")).unwrap_or(false);
    if !es_ws {
        let (st, tipo, cuerpo) = if ruta.split('?').next() == Some("/lan.json") {
            let i = info.lock().map(|x| x.clone()).unwrap_or_default(); let j = gente.load(Ordering::Relaxed);
            ("200 OK", "application/json; charset=utf-8", format!("{},\"j\":{j}}}", i.trim_end().trim_end_matches('}')))
        } else { ("404 Not Found", "text/plain", "no".into()) };
        let _ = s.write_all(format!("HTTP/1.1 {st}\r\nContent-Type: {tipo}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{cuerpo}", cuerpo.len()).as_bytes());
        return;
    }
    if !ruta.starts_with("/mqtt") { let _ = s.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"); return; }
    let Some(clave) = h.get("sec-websocket-key") else { return };
    let acepta = crate::comun::memes_juego::base64(&crate::comun::memes_juego::sha1(format!("{clave}258EAFA5-E914-47DA-95CA-C5AB0DC85B11").as_bytes()));
    let proto = h.get("sec-websocket-protocol").filter(|p| p.split(',').any(|x| x.trim() == "mqtt")).map(|_| "Sec-WebSocket-Protocol: mqtt\r\n").unwrap_or("");
    if s.write_all(format!("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {acepta}\r\n{proto}\r\n").as_bytes()).is_err() { return; }
    // (lo que se le manda: por un canal, envuelto en marcos binarios desde su hilo)
    let (tx, rx) = channel::<Vec<u8>>();
    let Ok(mut w) = s.try_clone() else { return };
    thread::spawn(move || { for p in rx { if p.is_empty() || w.write_all(&marco_ws(2, &p)).is_err() { break; } } let _ = w.shutdown(Shutdown::Both); });
    let id = { let Ok(mut e) = est.lock() else { return }; e.sig += 1; e.sig };
    let mut ws = LectorWs { buf: resto }; let mut mq: Vec<u8> = vec![]; let mut conectado = false; let mut limpio_fin = false;
    let mut ult = Instant::now(); let mut viva = 60.0f32;
    'afuera: loop {
        if !vivo.load(Ordering::Relaxed) { break; }
        for (op, d) in ws.marcos() {
            match op {
                8 => break 'afuera,
                // (ping y pong de WebSocket: el cliente de MQTT usa PINGREQ; no hace falta contestar)
                0 | 1 | 2 => mq.extend_from_slice(&d),
                _ => {}
            }
        }
        while let Some(r) = paquete(&mut mq) {
            let Ok((t, c)) = r else { break 'afuera };
            ult = Instant::now();
            match t >> 4 {
                1 => {   // CONNECT
                    let mut i = 0; let _ = cadena(&c, &mut i); if i + 4 > c.len() { break 'afuera; }
                    let fl = c[i + 1]; viva = u16::from_be_bytes([c[i + 2], c[i + 3]]) as f32; i += 4;
                    let _ = cadena(&c, &mut i);
                    let will = if fl & 0x04 != 0 { let tt = cadena(&c, &mut i).unwrap_or_default(); let m = cadena(&c, &mut i).unwrap_or_default(); Some((String::from_utf8_lossy(&tt).to_string(), m, fl & 0x20 != 0)) } else { None };
                    if let Ok(mut e) = est.lock() { e.clis.insert(id, Cli { tx: tx.clone(), subs: vec![], will }); }
                    conectado = true; gente.fetch_add(1, Ordering::Relaxed); let _ = tx.send(vec![0x20, 2, 0, 0]);
                }
                3 => {   // PUBLISH
                    let mut i = 0; let Some(tema) = cadena(&c, &mut i) else { break 'afuera }; let qos = (t >> 1) & 3;
                    if qos > 0 { if i + 2 > c.len() { break 'afuera; } let pid = [c[i], c[i + 1]]; i += 2; if qos == 1 { let _ = tx.send(vec![0x40, 2, pid[0], pid[1]]); } }
                    publicar(&est, &String::from_utf8_lossy(&tema), c[i..].to_vec(), t & 1 != 0);
                }
                8 => {   // SUBSCRIBE
                    if c.len() < 2 { break 'afuera; } let mut i = 2; let mut nuevos = vec![];
                    while i < c.len() { let Some(f) = cadena(&c, &mut i) else { break }; i += 1; nuevos.push(String::from_utf8_lossy(&f).to_string()); }
                    let mut r = vec![c[0], c[1]]; r.extend(std::iter::repeat(0u8).take(nuevos.len())); let _ = tx.send(pkt(0x90, &r));
                    if let Ok(mut e) = est.lock() {
                        for (tema, carga) in e.ret.iter() { if nuevos.iter().any(|f| coincide(f, tema)) { let _ = tx.send(publish(tema, carga, true)); } }
                        if let Some(cl) = e.clis.get_mut(&id) { cl.subs.extend(nuevos); }
                    }
                }
                10 => {   // UNSUBSCRIBE
                    if c.len() < 2 { break 'afuera; } let mut i = 2; let mut fuera = vec![];
                    while i < c.len() { let Some(f) = cadena(&c, &mut i) else { break }; fuera.push(String::from_utf8_lossy(&f).to_string()); }
                    if let Ok(mut e) = est.lock() { if let Some(cl) = e.clis.get_mut(&id) { cl.subs.retain(|s| !fuera.contains(s)); } }
                    let _ = tx.send(vec![0xB0, 2, c[0], c[1]]);
                }
                12 => { let _ = tx.send(vec![0xD0, 0]); }   // PINGREQ
                14 => { limpio_fin = true; break 'afuera; }   // DISCONNECT
                _ => {}
            }
        }
        // (sin noticias en 1,5 veces el keepalive: se cayó)
        if conectado && viva > 0.0 && ult.elapsed().as_secs_f32() > viva * 1.5 { break; }
        let mut tmp = [0u8; 16384];
        match s.read(&mut tmp) { Ok(0) => break, Ok(n) => ws.buf.extend_from_slice(&tmp[..n]), Err(e) if matches!(e.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut) => {} Err(_) => break }
    }
    // (se fue: su testamento, si no se despidió)
    let cli = est.lock().ok().and_then(|mut e| e.clis.remove(&id));
    if let Some(c) = cli { gente.fetch_sub(1, Ordering::Relaxed); if !limpio_fin { if let Some((t, m, r)) = c.will { publicar(&est, &t, m, r); } } }
    let _ = tx.send(vec![]); let _ = s.shutdown(Shutdown::Both);
}

/// la IP de este aparato en la red (la ruta hacia afuera, sin mandar nada) y el broadcast de su red (/24)
pub fn ip_local() -> Option<Ipv4Addr> {
    let u = UdpSocket::bind("0.0.0.0:0").ok()?; u.connect("192.0.2.1:9").ok()?;
    match u.local_addr().ok()? { SocketAddr::V4(a) if !a.ip().is_loopback() && !a.ip().is_unspecified() => Some(*a.ip()), _ => None }
}

/// ser anfitrión: el broker y /lan.json en el 8765 y el anuncio por el 8766; se apaga al soltarlo
pub struct Anfitrion { vivo: Arc<AtomicBool>, info: Arc<Mutex<String>>, gente: Arc<AtomicUsize>, pub puerto: u16 }
impl Anfitrion {
    /// `info`: el JSON de la partida (du, n, s, m, p) sin «j» (la cantidad de jugadores se agrega acá)
    pub fn empezar(info: &serde_json::Value) -> std::io::Result<Anfitrion> {
        let l = TcpListener::bind(("0.0.0.0", PUERTO))?; l.set_nonblocking(true)?;
        let vivo = Arc::new(AtomicBool::new(true)); let info = Arc::new(Mutex::new(info.to_string())); let gente = Arc::new(AtomicUsize::new(0));
        let est = Arc::new(Mutex::new(Est::default()));
        { let (vivo, info, gente) = (vivo.clone(), info.clone(), gente.clone());
          thread::spawn(move || { while vivo.load(Ordering::Relaxed) {
              match l.accept() { Ok((s, _)) => { let _ = s.set_nonblocking(false); let (e, i, v, g) = (est.clone(), info.clone(), vivo.clone(), gente.clone()); thread::spawn(move || atender(s, e, i, v, g)); }
                  Err(_) => thread::sleep(Duration::from_millis(40)) } } }); }
        // (el anuncio: cada segundo, al broadcast general y al de la red)
        { let (vivo, info, gente) = (vivo.clone(), info.clone(), gente.clone());
          thread::spawn(move || { let Ok(u) = UdpSocket::bind("0.0.0.0:0") else { return }; let _ = u.set_broadcast(true);
              while vivo.load(Ordering::Relaxed) {
                  let i = info.lock().map(|x| x.clone()).unwrap_or_default(); let j = gente.load(Ordering::Relaxed);
                  let m = format!("{MARCA}{},\"j\":{j}}}", i.trim_end().trim_end_matches('}'));
                  let mut dest = vec![Ipv4Addr::BROADCAST]; if let Some(ip) = ip_local() { let o = ip.octets(); dest.push(Ipv4Addr::new(o[0], o[1], o[2], 255)); }
                  for d in dest { let _ = u.send_to(m.as_bytes(), (d, PUERTO_ANUNCIO)); }
                  for _ in 0..10 { if !vivo.load(Ordering::Relaxed) { break; } thread::sleep(Duration::from_millis(100)); }
              } }); }
        Ok(Anfitrion { vivo, info, gente, puerto: PUERTO })
    }
    /// los datos nuevos de la partida (el mapa cambió…)
    pub fn poner_info(&self, info: &serde_json::Value) { if let Ok(mut i) = self.info.lock() { *i = info.to_string(); } }
    /// los conectados al broker (el anfitrión también)
    pub fn gente(&self) -> usize { self.gente.load(Ordering::Relaxed) }
}
impl Drop for Anfitrion { fn drop(&mut self) { self.vivo.store(false, Ordering::Relaxed); } }

/// buscar partidas: escucha los anuncios del 8766; las que no se anuncian hace 4 s se van
pub struct Buscador { vivo: Arc<AtomicBool>, lista: Arc<Mutex<Vec<(Hallada, Instant)>>> }
impl Buscador {
    pub fn empezar(mapa_valido: Box<dyn Fn(&str) -> bool + Send>) -> std::io::Result<Buscador> {
        let u = UdpSocket::bind(("0.0.0.0", PUERTO_ANUNCIO))?; u.set_read_timeout(Some(Duration::from_millis(300)))?;
        let vivo = Arc::new(AtomicBool::new(true)); let lista: Arc<Mutex<Vec<(Hallada, Instant)>>> = Arc::new(Mutex::new(vec![]));
        { let (vivo, lista) = (vivo.clone(), lista.clone());
          thread::spawn(move || { let mut b = [0u8; 2048]; while vivo.load(Ordering::Relaxed) {
              if let Ok((n, de)) = u.recv_from(&mut b) {
                  let t = String::from_utf8_lossy(&b[..n]);
                  if let (Some(j), SocketAddr::V4(a)) = (t.strip_prefix(MARCA), de) {
                      if let Some(h) = serde_json::from_str::<serde_json::Value>(j).ok().and_then(|d| datos(&d, &a.ip().to_string(), 0, &*mapa_valido)) {
                          if let Ok(mut l) = lista.lock() { l.retain(|(x, _)| x.du != h.du); l.push((h, Instant::now())); }
                      }
                  }
              }
              if let Ok(mut l) = lista.lock() { l.retain(|(_, t)| t.elapsed() < Duration::from_secs(4)); }
          } }); }
        Ok(Buscador { vivo, lista })
    }
    pub fn lista(&self) -> Vec<Hallada> { self.lista.lock().map(|l| l.iter().map(|x| x.0.clone()).collect()).unwrap_or_default() }
}
impl Drop for Buscador { fn drop(&mut self) { self.vivo.store(false, Ordering::Relaxed); } }

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn filtros_y_datos() {
        assert!(coincide("a/#", "a/b/c") && coincide("a/+/c", "a/b/c") && !coincide("a/+", "a/b/c") && coincide("a/b", "a/b") && !coincide("a/b", "a/c"));
        let d = serde_json::json!({ "du": "abc123", "n": "Juan\u{7}", "s": "Juan · LAN", "m": "Nada", "p": 8765, "j": 2 });
        let h = datos(&d, "192.168.1.5", 0, &|m| m == "FlatGrass").unwrap();
        assert_eq!((h.n.as_str(), h.m.as_str(), h.puerto, h.j), ("Juan", "FlatGrass", 8765, 2));
        assert!(datos(&serde_json::json!({ "du": "A!" }), "192.168.1.5", 0, &|_| true).is_none());
    }
}
