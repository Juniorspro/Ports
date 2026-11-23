//! Un broker MQTT 3.1.1 chico en 127.0.0.1 (el de juego/tests/red_mqtt.rs), para probar el multijugador del juego sin
//! internet: `Broker::nuevo()` y conectarse a `mqtt://127.0.0.1:<tcp>`.
#![allow(dead_code)]
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::thread;

// ---------------- un broker MQTT 3.1.1 chico (hecho aparte del cliente, para probarlo de verdad) ----------------
struct Cli { id: String, tx: Sender<Vec<u8>>, subs: Vec<String>, will: Option<(String, Vec<u8>, bool)>, sock: TcpStream }
#[derive(Default)]
struct Est { clis: HashMap<u64, Cli>, ret: Vec<(String, Vec<u8>)>, sig: u64, publicados: Vec<(String, usize)>, conexiones: usize }
#[derive(Clone)]
pub struct Broker { e: Arc<Mutex<Est>>, pub tcp: u16, pub ws: u16 }
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
    pub fn nuevo() -> Broker {
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

