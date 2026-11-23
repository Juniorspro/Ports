//! Un cliente MQTT 3.1.1 chico, para el multijugador (red.rs): el mismo broker público que usa la web (mqtt.js), por un
//! flujo de bytes cualquiera. Tiene:
//! - los paquetes (CONNECT con sesión limpia, keepalive y testamento; SUBSCRIBE/UNSUBSCRIBE; PUBLISH QoS 0 y 1, con su
//!   PUBACK; PINGREQ; DISCONNECT) y un lector que los va sacando de lo que llega, de a pedazos;
//! - `Sesion`: el cliente sin entrada ni salida (lo que hay que mandar y lo que pasó), para probarlo sin sockets;
//! - `Conexion`: un hilo que conecta con un `Conector`, manda, recibe, hace ping y se vuelve a conectar solo (como
//!   `reconnectPeriod` de mqtt.js), y lo que pasa se lee sin esperar (`sucesos`);
//! - `Ws`: MQTT sobre WebSocket (lo que usa la web: wss://…:8084/mqtt; y la partida en la red local, ws://IP:8765/mqtt);
//! - `conectar_tcp`: el conector de la compu (mqtt:// y ws:// sin TLS: las pruebas con el broker de 127.0.0.1). El TLS
//!   (mqtts://broker.emqx.io:8883 y wss://) lo pone la plataforma: en Android, Java (nativo/src/red_android.rs).
//!
//! Un broker MQTT junta todos sus transportes: los de TCP/TLS (1883/8883) y los de WebSocket (8083/8084) ven los mismos
//! temas, así que un jugador nativo por TLS y uno de la web por wss están en la misma sala.
use std::collections::VecDeque;
use std::io::{self, Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::sync::mpsc::{channel, Receiver, Sender, TryRecvError};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

// ---------------- el flujo de bytes ----------------
/// Un flujo de bytes de ida y vuelta (TCP, TLS de Java, WebSocket encima de otro). `leer` no tiene que quedarse esperando
/// para siempre: con un tope corto (20 a 50 ms) devuelve un error `TimedOut`/`WouldBlock` si no llegó nada, así el hilo
/// de la conexión puede mandar lo que haya mientras tanto. `Ok(0)`: se cerró.
pub trait Flujo: Send {
    fn leer(&mut self, buf: &mut [u8]) -> io::Result<usize>;
    fn escribir(&mut self, datos: &[u8]) -> io::Result<()>;
    fn cerrar(&mut self) {}
}
/// el error de «todavía no llegó nada» (no es un corte)
pub fn nada_aun(e: &io::Error) -> bool { matches!(e.kind(), io::ErrorKind::WouldBlock | io::ErrorKind::TimedOut | io::ErrorKind::Interrupted) }
impl Flujo for TcpStream {
    fn leer(&mut self, buf: &mut [u8]) -> io::Result<usize> { Read::read(self, buf) }
    fn escribir(&mut self, datos: &[u8]) -> io::Result<()> { self.write_all(datos)?; self.flush() }
    fn cerrar(&mut self) { let _ = self.shutdown(std::net::Shutdown::Both); }
}
impl Flujo for Box<dyn Flujo> {
    fn leer(&mut self, buf: &mut [u8]) -> io::Result<usize> { (**self).leer(buf) }
    fn escribir(&mut self, datos: &[u8]) -> io::Result<()> { (**self).escribir(datos) }
    fn cerrar(&mut self) { (**self).cerrar() }
}

// ---------------- la dirección del broker ----------------
/// mqtt://host:1883, mqtts://host:8883 (también tcp://, ssl://, tls://), ws://host:80/ruta, wss://host:443/ruta
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Url { pub tls: bool, pub ws: bool, pub host: String, pub puerto: u16, pub ruta: String }
pub fn url(s: &str) -> Result<Url, String> {
    let (esq, resto) = s.split_once("://").ok_or_else(|| format!("dirección sin esquema: {s}"))?;
    let (tls, ws, def) = match esq.to_ascii_lowercase().as_str() {
        "mqtt" | "tcp" => (false, false, 1883), "mqtts" | "ssl" | "tls" => (true, false, 8883),
        "ws" => (false, true, 80), "wss" => (true, true, 443), e => return Err(format!("esquema desconocido: {e}")),
    };
    let (hp, ruta) = match resto.find('/') { Some(i) => (&resto[..i], resto[i..].to_string()), None => (resto, if ws { "/mqtt".into() } else { String::new() }) };
    // (host:puerto; una IPv6 va entre corchetes: [::1]:1883)
    let (host, puerto) = match hp.rsplit_once(':') {
        Some((h, p)) if !p.contains(']') => (h.trim_matches(|c| c == '[' || c == ']').to_string(), p.parse::<u16>().map_err(|_| format!("puerto malo: {p}"))?),
        _ => (hp.trim_matches(|c| c == '[' || c == ']').to_string(), def),
    };
    if host.is_empty() { return Err(format!("dirección sin host: {s}")); }
    Ok(Url { tls, ws, host, puerto, ruta })
}

/// El conector de la compu: TCP (mqtt://) y WebSocket sin TLS (ws://). Lee con un tope de 20 ms (ver `Flujo`). Para
/// mqtts:// y wss:// hace falta el TLS de la plataforma (Android: red_android.rs).
pub fn conectar_tcp(dir: &str) -> io::Result<Box<dyn Flujo>> {
    let u = url(dir).map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;
    if u.tls { return Err(io::Error::new(io::ErrorKind::Unsupported, "sin TLS en este conector (mqtts/wss: el de la plataforma)")); }
    let tcp = tcp_conectar(&u.host, u.puerto, Duration::from_secs(9))?;
    if u.ws { Ok(Box::new(Ws::abrir(tcp, &format!("{}:{}", u.host, u.puerto), &u.ruta)?)) } else { Ok(Box::new(tcp)) }
}
/// TCP a host:puerto (la primera dirección que conteste), sin Nagle y con el tope de lectura de 20 ms
pub fn tcp_conectar(host: &str, puerto: u16, tope: Duration) -> io::Result<TcpStream> {
    let mut ult = io::Error::new(io::ErrorKind::NotFound, format!("no se encontró {host}"));
    for a in (host, puerto).to_socket_addrs()? {
        match TcpStream::connect_timeout(&a, tope) {
            Ok(t) => { t.set_nodelay(true)?; t.set_read_timeout(Some(Duration::from_millis(20)))?; return Ok(t); }
            Err(e) => ult = e,
        }
    }
    Err(ult)
}

// ---------------- los paquetes ----------------
/// el testamento: lo que el broker publica si la conexión se corta sin despedirse (la web lo usa para borrar lo suyo)
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Will { pub topic: String, pub payload: Vec<u8>, pub retain: bool, pub qos: u8 }
/// cómo conectarse (las opciones de mqtt.connect de la web)
#[derive(Clone, Debug)]
pub struct Opciones {
    pub url: String, pub client_id: String, pub clean: bool,
    /// segundos (0: sin ping)
    pub keepalive: u16,
    pub will: Option<Will>, pub usuario: Option<String>, pub clave: Option<String>,
    /// reconnectPeriod y connectTimeout de mqtt.js, en milisegundos
    pub reconectar_ms: u64, pub espera_ms: u64,
}
impl Opciones {
    pub fn nuevas(url: &str, client_id: &str) -> Opciones {
        Opciones { url: url.into(), client_id: client_id.into(), clean: true, keepalive: 60, will: None, usuario: None, clave: None, reconectar_ms: 1000, espera_ms: 30000 }
    }
}
fn largo_resto(o: &mut Vec<u8>, mut n: usize) {
    loop { let mut b = (n % 128) as u8; n /= 128; if n > 0 { b |= 0x80; } o.push(b); if n == 0 { break; } }
}
fn con_largo(o: &mut Vec<u8>, s: &[u8]) { o.extend_from_slice(&(s.len().min(65535) as u16).to_be_bytes()); o.extend_from_slice(&s[..s.len().min(65535)]); }
fn armar(tipo: u8, cuerpo: Vec<u8>) -> Vec<u8> { let mut o = vec![tipo]; largo_resto(&mut o, cuerpo.len()); o.extend(cuerpo); o }
pub fn pkt_connect(op: &Opciones) -> Vec<u8> {
    let mut c = vec![]; con_largo(&mut c, b"MQTT"); c.push(4);
    let mut fl = 0u8; if op.clean { fl |= 0x02; }
    if let Some(w) = &op.will { fl |= 0x04 | ((w.qos.min(2)) << 3) | if w.retain { 0x20 } else { 0 }; }
    if op.clave.is_some() { fl |= 0x40; } if op.usuario.is_some() { fl |= 0x80; }
    c.push(fl); c.extend_from_slice(&op.keepalive.to_be_bytes());
    con_largo(&mut c, op.client_id.as_bytes());
    if let Some(w) = &op.will { con_largo(&mut c, w.topic.as_bytes()); con_largo(&mut c, &w.payload); }
    if let Some(u) = &op.usuario { con_largo(&mut c, u.as_bytes()); }
    if let Some(k) = &op.clave { con_largo(&mut c, k.as_bytes()); }
    armar(0x10, c)
}
pub fn pkt_publish(topic: &str, payload: &[u8], qos: u8, retain: bool, id: u16) -> Vec<u8> {
    let mut c = vec![]; con_largo(&mut c, topic.as_bytes()); if qos > 0 { c.extend_from_slice(&id.to_be_bytes()); } c.extend_from_slice(payload);
    armar(0x30 | (qos.min(2) << 1) | retain as u8, c)
}
pub fn pkt_subscribe(id: u16, filtros: &[(&str, u8)]) -> Vec<u8> {
    let mut c = id.to_be_bytes().to_vec(); for (f, q) in filtros { con_largo(&mut c, f.as_bytes()); c.push(*q); } armar(0x82, c)
}
pub fn pkt_unsubscribe(id: u16, filtros: &[&str]) -> Vec<u8> {
    let mut c = id.to_be_bytes().to_vec(); for f in filtros { con_largo(&mut c, f.as_bytes()); } armar(0xA2, c)
}
pub fn pkt_puback(id: u16) -> Vec<u8> { armar(0x40, id.to_be_bytes().to_vec()) }
pub const PINGREQ: [u8; 2] = [0xC0, 0];
pub const DISCONNECT: [u8; 2] = [0xE0, 0];

/// lo que manda el broker
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Paquete {
    ConnAck { presente: bool, codigo: u8 },
    Publish { topic: String, payload: Vec<u8>, qos: u8, retain: bool, dup: bool, id: u16 },
    PubAck(u16), SubAck { id: u16, codigos: Vec<u8> }, UnsubAck(u16), PingResp,
    /// otro tipo (el número del tipo)
    Otro(u8),
}
/// junta lo que llega y saca los paquetes enteros
#[derive(Default)]
pub struct Lector { buf: Vec<u8> }
impl Lector {
    pub fn meter(&mut self, d: &[u8]) { self.buf.extend_from_slice(d); }
    /// el próximo paquete entero (None: falta), o un error si lo que llegó no es MQTT
    pub fn sacar(&mut self) -> Result<Option<Paquete>, String> {
        let b = &self.buf; if b.len() < 2 { return Ok(None); }
        let (mut n, mut mul, mut i) = (0usize, 1usize, 1usize);
        loop {
            if i >= b.len() { return Ok(None); }
            let x = b[i]; n += (x & 0x7f) as usize * mul; i += 1;
            if x & 0x80 == 0 { break; }
            mul *= 128; if i > 4 { return Err("largo de paquete malo".into()); }
        }
        if b.len() < i + n { return Ok(None); }
        let (t, fl) = (b[0] >> 4, b[0] & 0x0f); let c = &b[i..i + n];
        let u16_de = |k: usize| -> Result<u16, String> { if c.len() < k + 2 { Err("paquete corto".into()) } else { Ok(u16::from_be_bytes([c[k], c[k + 1]])) } };
        let p = match t {
            2 => { if c.len() < 2 { return Err("CONNACK corto".into()); } Paquete::ConnAck { presente: c[0] & 1 == 1, codigo: c[1] } }
            3 => {
                let qos = (fl >> 1) & 3; let lt = u16_de(0)? as usize; if c.len() < 2 + lt { return Err("PUBLISH corto".into()); }
                let topic = String::from_utf8_lossy(&c[2..2 + lt]).into_owned(); let mut k = 2 + lt;
                let id = if qos > 0 { let id = u16_de(k)?; k += 2; id } else { 0 };
                Paquete::Publish { topic, payload: c[k..].to_vec(), qos, retain: fl & 1 == 1, dup: fl & 8 == 8, id }
            }
            4 => Paquete::PubAck(u16_de(0)?),
            9 => Paquete::SubAck { id: u16_de(0)?, codigos: c.get(2..).unwrap_or(&[]).to_vec() },
            11 => Paquete::UnsubAck(u16_de(0)?),
            13 => Paquete::PingResp,
            x => Paquete::Otro(x),
        };
        self.buf.drain(..i + n);
        Ok(Some(p))
    }
}

// ---------------- la sesión (sin entrada ni salida) ----------------
/// lo que pasó en una conexión
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Suceso { Conectado, Desconectado(String), Mensaje { topic: String, payload: Vec<u8>, retain: bool } }

/// El cliente sin sockets: arma lo que hay que mandar y entiende lo que llega. `ahora` en segundos (cualquier reloj que
/// avance). Lo que hay que contestar solo (PUBACK) queda en `salida`.
pub struct Sesion {
    pub op: Opciones, pub conectada: bool, sig_id: u16, ult_envio: f64, ping_desde: Option<f64>, lector: Lector,
    /// lo que hay que mandar (respuestas a lo que llegó y pings)
    pub salida: Vec<u8>,
    /// las publicaciones QoS 1 sin PUBACK todavía (se vuelven a mandar al reconectar, con DUP)
    pub sin_ack: Vec<(u16, Vec<u8>)>,
}
impl Sesion {
    pub fn nueva(op: Opciones) -> Sesion { Sesion { op, conectada: false, sig_id: 0, ult_envio: 0.0, ping_desde: None, lector: Lector::default(), salida: vec![], sin_ack: vec![] } }
    fn id(&mut self) -> u16 { self.sig_id = self.sig_id.wrapping_add(1); if self.sig_id == 0 { self.sig_id = 1; } self.sig_id }
    /// el CONNECT (empieza de cero lo que llega)
    pub fn empezar(&mut self, ahora: f64) -> Vec<u8> { self.conectada = false; self.lector = Lector::default(); self.ping_desde = None; self.ult_envio = ahora; pkt_connect(&self.op) }
    pub fn publicar(&mut self, topic: &str, payload: &[u8], qos: u8, retain: bool, ahora: f64) -> Vec<u8> {
        self.ult_envio = ahora;
        if qos == 0 { return pkt_publish(topic, payload, 0, retain, 0); }
        let id = self.id(); let p = pkt_publish(topic, payload, 1, retain, id); self.sin_ack.push((id, p.clone())); if self.sin_ack.len() > 200 { self.sin_ack.remove(0); } p
    }
    pub fn suscribir(&mut self, filtro: &str, qos: u8, ahora: f64) -> Vec<u8> { self.ult_envio = ahora; let id = self.id(); pkt_subscribe(id, &[(filtro, qos.min(1))]) }
    pub fn desuscribir(&mut self, filtro: &str, ahora: f64) -> Vec<u8> { self.ult_envio = ahora; let id = self.id(); pkt_unsubscribe(id, &[filtro]) }
    /// lo que llegó: los sucesos (Conectado al CONNACK bueno; un CONNACK malo es un error)
    pub fn recibir(&mut self, datos: &[u8], ahora: f64) -> Result<Vec<Suceso>, String> {
        self.lector.meter(datos); let mut out = vec![];
        while let Some(p) = self.lector.sacar()? {
            match p {
                Paquete::ConnAck { codigo: 0, .. } => {
                    self.conectada = true; out.push(Suceso::Conectado);
                    // (lo QoS 1 que quedó sin respuesta, otra vez con DUP)
                    for (_, p) in &self.sin_ack { let mut q = p.clone(); q[0] |= 0x08; self.salida.extend(q); }
                }
                Paquete::ConnAck { codigo, .. } => return Err(format!("el broker no acepta la conexión (CONNACK {codigo})")),
                Paquete::Publish { topic, payload, qos, retain, id, .. } => {
                    if qos == 1 { self.salida.extend(pkt_puback(id)); self.ult_envio = ahora; }
                    // (QoS 2 no se pide nunca: se toma como 1)
                    if qos == 2 { self.salida.extend(armar(0x50, id.to_be_bytes().to_vec())); }
                    out.push(Suceso::Mensaje { topic, payload, retain });
                }
                Paquete::PubAck(id) => self.sin_ack.retain(|(i, _)| *i != id),
                Paquete::PingResp => self.ping_desde = None,
                _ => {}
            }
        }
        let _ = ahora; Ok(out)
    }
    /// el keepalive: un PINGREQ si hace `keepalive` segundos que no se manda nada; error si el broker no contestó el
    /// anterior en otro tanto (la conexión está muerta: hay que reconectar)
    pub fn reloj(&mut self, ahora: f64) -> Result<(), String> {
        let k = self.op.keepalive as f64; if k <= 0.0 || !self.conectada { return Ok(()); }
        if let Some(t) = self.ping_desde { if ahora - t > k { return Err("el broker no contesta el ping".into()); } }
        if ahora - self.ult_envio >= k && self.ping_desde.is_none() { self.salida.extend_from_slice(&PINGREQ); self.ping_desde = Some(ahora); self.ult_envio = ahora; }
        Ok(())
    }
}

// ---------------- la conexión (un hilo) ----------------
/// abre el flujo hacia una dirección (mqtt://, mqtts://, ws://, wss://)
pub type Conector = Arc<dyn Fn(&str) -> io::Result<Box<dyn Flujo>> + Send + Sync>;
/// lo que se le pide al hilo
#[derive(Clone, Debug)]
pub enum Pedido { Publicar { topic: String, payload: Vec<u8>, qos: u8, retain: bool }, Suscribir(String, u8), Desuscribir(String), Cerrar }

/// Una conexión MQTT en su hilo: conecta, se reconecta sola cada `reconectar_ms` si se corta, y mientras está cortada
/// guarda lo que se le pide (como mqtt.js, que encola lo de QoS 0). `cerrar` (o soltarla) manda lo pendiente, se despide
/// con DISCONNECT (así el broker no publica el testamento) y termina el hilo.
pub struct Conexion { tx: Sender<Pedido>, rx: Receiver<Suceso>, hilo: Option<JoinHandle<()>> }
impl Conexion {
    pub fn abrir(op: Opciones, conector: Conector) -> Conexion {
        let (tx, rx_p) = channel(); let (tx_s, rx) = channel();
        let hilo = thread::Builder::new().name("jx-mqtt".into()).spawn(move || hilo_mqtt(op, conector, rx_p, tx_s)).ok();
        Conexion { tx, rx, hilo }
    }
    pub fn pedir(&self, p: Pedido) { let _ = self.tx.send(p); }
    pub fn publicar(&self, topic: &str, payload: &[u8], qos: u8, retain: bool) { self.pedir(Pedido::Publicar { topic: topic.into(), payload: payload.to_vec(), qos, retain }); }
    pub fn suscribir(&self, filtro: &str) { self.pedir(Pedido::Suscribir(filtro.into(), 0)); }
    pub fn desuscribir(&self, filtro: &str) { self.pedir(Pedido::Desuscribir(filtro.into())); }
    /// lo que pasó desde la última vez (no espera)
    pub fn sucesos(&self) -> Vec<Suceso> { let mut v = vec![]; while let Ok(s) = self.rx.try_recv() { v.push(s); } v }
    /// se despide y termina (no espera al hilo)
    pub fn cerrar(&mut self) { self.pedir(Pedido::Cerrar); self.hilo = None; }
    /// (pruebas) se despide y espera a que el hilo termine
    pub fn cerrar_y_esperar(&mut self) { self.pedir(Pedido::Cerrar); if let Some(h) = self.hilo.take() { let _ = h.join(); } }
}
impl Drop for Conexion { fn drop(&mut self) { let _ = self.tx.send(Pedido::Cerrar); } }

fn hilo_mqtt(op: Opciones, conector: Conector, rx: Receiver<Pedido>, tx: Sender<Suceso>) {
    let t0 = Instant::now(); let ahora = || t0.elapsed().as_secs_f64();
    let mut cola: VecDeque<Pedido> = VecDeque::new();
    let mut buf = vec![0u8; 16384];
    // (lo pedido mientras no hay conexión; false: hay que terminar)
    let juntar = |cola: &mut VecDeque<Pedido>, espera: Duration| -> bool {
        let fin = Instant::now() + espera;
        loop {
            let r = if espera.is_zero() { rx.try_recv().map_err(|e| e == TryRecvError::Disconnected) } else {
                let falta = fin.saturating_duration_since(Instant::now()); if falta.is_zero() { return true; }
                rx.recv_timeout(falta).map_err(|e| e == std::sync::mpsc::RecvTimeoutError::Disconnected)
            };
            match r {
                Ok(Pedido::Cerrar) | Err(true) => return false,
                Ok(p) => { cola.push_back(p); if cola.len() > 1000 { cola.pop_front(); } }
                Err(false) => if espera.is_zero() { return true; },
            }
        }
    };
    let mut primera = true;
    loop {
        if !primera && !juntar(&mut cola, Duration::from_millis(op.reconectar_ms.max(100))) { return; }
        primera = false;
        if !juntar(&mut cola, Duration::ZERO) { return; }
        let mut f = match conector(&op.url) { Ok(f) => f, Err(e) => { let _ = tx.send(Suceso::Desconectado(format!("no se pudo conectar: {e}"))); continue; } };
        let mut s = Sesion::nueva(op.clone());
        let motivo = (|| -> Result<Option<String>, String> {
            f.escribir(&s.empezar(ahora())).map_err(|e| e.to_string())?;
            // esperar el CONNACK (connectTimeout)
            let tope = Instant::now() + Duration::from_millis(op.espera_ms.max(500));
            while !s.conectada {
                if Instant::now() > tope { return Err("el broker no contestó".into()); }
                match f.leer(&mut buf) {
                    Ok(0) => return Err("el broker cerró la conexión".into()),
                    Ok(n) => { for x in s.recibir(&buf[..n], ahora())? { let _ = tx.send(x); } }
                    Err(e) if nada_aun(&e) => {}
                    Err(e) => return Err(e.to_string()),
                }
            }
            loop {
                // lo pedido (lo de antes primero)
                if !juntar(&mut cola, Duration::ZERO) { cola.push_back(Pedido::Cerrar); }
                while let Some(p) = cola.pop_front() {
                    let d = match p {
                        Pedido::Publicar { topic, payload, qos, retain } => s.publicar(&topic, &payload, qos, retain, ahora()),
                        Pedido::Suscribir(t, q) => s.suscribir(&t, q, ahora()),
                        Pedido::Desuscribir(t) => s.desuscribir(&t, ahora()),
                        Pedido::Cerrar => { let _ = f.escribir(&DISCONNECT); f.cerrar(); return Ok(None); }
                    };
                    f.escribir(&d).map_err(|e| e.to_string())?;
                }
                match f.leer(&mut buf) {
                    Ok(0) => return Err("el broker cerró la conexión".into()),
                    Ok(n) => { for x in s.recibir(&buf[..n], ahora())? { let _ = tx.send(x); } }
                    Err(e) if nada_aun(&e) => {}
                    Err(e) => return Err(e.to_string()),
                }
                s.reloj(ahora())?;
                if !s.salida.is_empty() { let d = std::mem::take(&mut s.salida); f.escribir(&d).map_err(|e| e.to_string())?; }
            }
        })();
        match motivo {
            Ok(_) => { let _ = tx.send(Suceso::Desconectado("cerrada".into())); return; }
            Err(m) => { f.cerrar(); let _ = tx.send(Suceso::Desconectado(m)); }
        }
    }
}

// ---------------- MQTT sobre WebSocket ----------------
fn base64(d: &[u8]) -> String {
    const A: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut s = String::new();
    for c in d.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        for k in 0..4 { if k <= c.len() { s.push(A[(n >> (18 - 6 * k) & 63) as usize] as char); } else { s.push('='); } }
    }
    s
}
/// MQTT adentro de WebSocket (RFC 6455, subprotocolo «mqtt»): lo que se escribe va en marcos binarios enmascarados; lo
/// que llega se desarma de los marcos (contesta los ping y entiende el cierre). No verifica Sec-WebSocket-Accept.
pub struct Ws<F: Flujo> { f: F, crudo: Vec<u8>, datos: VecDeque<u8>, azar: u32, cerrado: bool }
impl<F: Flujo> Ws<F> {
    /// el saludo HTTP (GET con Upgrade) por `f`; `host` va en la cabecera Host (host:puerto), `ruta` como /mqtt
    pub fn abrir(mut f: F, host: &str, ruta: &str) -> io::Result<Ws<F>> {
        let mut azar = (Instant::now().elapsed().subsec_nanos() ^ std::process::id().rotate_left(16) ^ (host.len() as u32).wrapping_mul(0x9e37_79b9)) | 1;
        let sem = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.subsec_nanos()).unwrap_or(7); azar ^= sem;
        let mut clave = [0u8; 16]; for b in clave.iter_mut() { azar ^= azar << 13; azar ^= azar >> 17; azar ^= azar << 5; *b = azar as u8; }
        let pedido = format!("GET {} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {}\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Protocol: mqtt\r\n\r\n", if ruta.is_empty() { "/" } else { ruta }, base64(&clave));
        f.escribir(pedido.as_bytes())?;
        let mut r: Vec<u8> = vec![]; let mut b = [0u8; 2048]; let tope = Instant::now() + Duration::from_secs(9);
        let fin = loop {
            if let Some(i) = r.windows(4).position(|w| w == b"\r\n\r\n") { break i + 4; }
            if Instant::now() > tope || r.len() > 16384 { return Err(io::Error::new(io::ErrorKind::TimedOut, "WebSocket: sin respuesta al saludo")); }
            match f.leer(&mut b) { Ok(0) => return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "WebSocket: se cerró en el saludo")), Ok(n) => r.extend_from_slice(&b[..n]), Err(e) if nada_aun(&e) => {}, Err(e) => return Err(e) }
        };
        let cab = String::from_utf8_lossy(&r[..fin]).to_string();
        let linea = cab.lines().next().unwrap_or("");
        if !linea.split_whitespace().nth(1).map(|c| c == "101").unwrap_or(false) { return Err(io::Error::other(format!("WebSocket: el servidor contestó «{linea}»"))); }
        Ok(Ws { f, crudo: r[fin..].to_vec(), datos: VecDeque::new(), azar, cerrado: false })
    }
    fn marco(&mut self, op: u8, d: &[u8]) -> io::Result<()> {
        let mut o = vec![0x80 | op];
        let n = d.len();
        if n < 126 { o.push(0x80 | n as u8); } else if n <= 65535 { o.push(0x80 | 126); o.extend_from_slice(&(n as u16).to_be_bytes()); } else { o.push(0x80 | 127); o.extend_from_slice(&(n as u64).to_be_bytes()); }
        self.azar ^= self.azar << 13; self.azar ^= self.azar >> 17; self.azar ^= self.azar << 5; let m = self.azar.to_be_bytes();
        o.extend_from_slice(&m); o.extend(d.iter().enumerate().map(|(i, x)| x ^ m[i & 3]));
        self.f.escribir(&o)
    }
    /// desarma los marcos enteros que haya en `crudo`
    fn desarmar(&mut self) -> io::Result<()> {
        loop {
            let c = &self.crudo; if c.len() < 2 { return Ok(()); }
            let (op, enm) = (c[0] & 0x0f, c[1] & 0x80 != 0); let mut n = (c[1] & 0x7f) as usize; let mut k = 2;
            if n == 126 { if c.len() < 4 { return Ok(()); } n = u16::from_be_bytes([c[2], c[3]]) as usize; k = 4; }
            else if n == 127 { if c.len() < 10 { return Ok(()); } n = u64::from_be_bytes(c[2..10].try_into().unwrap()) as usize; k = 10; }
            let mk = if enm { if c.len() < k + 4 { return Ok(()); } let m = [c[k], c[k + 1], c[k + 2], c[k + 3]]; k += 4; Some(m) } else { None };
            if c.len() < k + n { return Ok(()); }
            let mut p = c[k..k + n].to_vec(); if let Some(m) = mk { for (i, x) in p.iter_mut().enumerate() { *x ^= m[i & 3]; } }
            self.crudo.drain(..k + n);
            match op { 0..=2 => self.datos.extend(p), 8 => { self.cerrado = true; return Ok(()); } 9 => self.marco(0x0A, &p)?, _ => {} }
        }
    }
}
impl<F: Flujo> Flujo for Ws<F> {
    fn leer(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        loop {
            if !self.datos.is_empty() { let n = buf.len().min(self.datos.len()); for (i, b) in self.datos.drain(..n).enumerate() { buf[i] = b; } return Ok(n); }
            if self.cerrado { return Ok(0); }
            let mut b = [0u8; 8192];
            let n = self.f.leer(&mut b)?; if n == 0 { return Ok(0); }
            self.crudo.extend_from_slice(&b[..n]); self.desarmar()?;
        }
    }
    fn escribir(&mut self, datos: &[u8]) -> io::Result<()> { self.marco(0x02, datos) }
    fn cerrar(&mut self) { let _ = self.marco(0x08, &[]); self.f.cerrar(); }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn paquetes() {
        let mut op = Opciones::nuevas("mqtt://h", "jxmod_v1_abc_1234"); op.keepalive = 30;
        op.will = Some(Will { topic: "a/w/x".into(), payload: vec![], retain: true, qos: 0 });
        let c = pkt_connect(&op);
        assert_eq!(&c[..2], &[0x10, (c.len() - 2) as u8]);
        assert_eq!(&c[2..9], b"\x00\x04MQTT\x04");
        assert_eq!(c[9], 0x02 | 0x04 | 0x20); assert_eq!(&c[10..12], &[0, 30]);
        assert_eq!(pkt_publish("t", b"hola", 0, true, 0), b"\x31\x07\x00\x01thola".to_vec());
        assert_eq!(pkt_subscribe(1, &[("s/#", 0)]), b"\x82\x08\x00\x01\x00\x03s/#\x00".to_vec());
        // un largo de dos bytes
        let p = pkt_publish("t", &vec![7u8; 200], 0, false, 0); assert_eq!(&p[..3], &[0x30, 0xCB, 0x01]);
        let mut l = Lector::default(); l.meter(&p[..50]); assert_eq!(l.sacar().unwrap(), None); l.meter(&p[50..]);
        match l.sacar().unwrap() { Some(Paquete::Publish { topic, payload, .. }) => { assert_eq!(topic, "t"); assert_eq!(payload.len(), 200); } x => panic!("{x:?}") }
        assert_eq!(url("mqtts://broker.emqx.io:8883").unwrap(), Url { tls: true, ws: false, host: "broker.emqx.io".into(), puerto: 8883, ruta: String::new() });
        assert_eq!(url("wss://broker.emqx.io:8084/mqtt").unwrap(), Url { tls: true, ws: true, host: "broker.emqx.io".into(), puerto: 8084, ruta: "/mqtt".into() });
        assert_eq!(url("ws://192.168.0.5:8765/mqtt").unwrap().puerto, 8765);
        assert_eq!(base64(b"hola mundo"), "aG9sYSBtdW5kbw==");
    }
    #[test]
    fn sesion() {
        let mut op = Opciones::nuevas("mqtt://h", "c"); op.keepalive = 10;
        let mut s = Sesion::nueva(op); s.empezar(0.0);
        assert_eq!(s.recibir(&[0x20, 2, 0, 0], 0.1).unwrap(), vec![Suceso::Conectado]);
        // un PUBLISH QoS 1 que llega: se contesta el PUBACK
        let p = pkt_publish("x/y", b"z", 1, false, 9);
        let r = s.recibir(&p, 0.2).unwrap(); assert_eq!(r.len(), 1); assert_eq!(s.salida, pkt_puback(9)); s.salida.clear();
        s.reloj(5.0).unwrap(); assert!(s.salida.is_empty());
        s.reloj(10.3).unwrap(); assert_eq!(s.salida, PINGREQ.to_vec()); s.salida.clear();
        assert!(s.reloj(21.0).is_err());
        let mut s2 = Sesion::nueva(Opciones::nuevas("mqtt://h", "c")); s2.empezar(0.0);
        assert!(s2.recibir(&[0x20, 2, 0, 5], 0.0).is_err());
    }
}
