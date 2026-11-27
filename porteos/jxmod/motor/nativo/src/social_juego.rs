//! cuenta.js, social.js y tiendared.js en la nativa (hijo de paneles_juego.rs: usa sus placas, botones y pestañas). La
//! cuenta: con Google en el navegador del celular (un verificador al azar y su huella SHA-256; se pregunta cada 1,5 s si
//! ya entró, hasta 10 min) o con la dirección de Gmail y el código de 6 números que manda la tienda; queda en cuenta.json
//! (el token vale 90 días). Social, con sus cuatro pestañas: Chats (la lista y la conversación, los dos tildes,
//! «escribiendo…», los grupos y las invitaciones a partida con Unirse), Amigos (en línea y desconectados, solicitudes y
//! bloqueados), Buscar (por el ID de 8 números, con los recientes) y Perfil (nombre, ID, en línea o desconectado, novedades
//! por correo y cerrar sesión). El latido cada minuto dice en qué server estás y trae los no leídos (el número de la
//! pestaña y el aviso del mensaje nuevo). Como tiendared.js: si la tienda se satura (el 429 de Cloudflare sin JSON, o sin
//! respuesta, 3 veces seguidas) lo automático —latido, chats, mensajes— espera 2, 4, 8… hasta 30 min; una respuesta buena
//! lo destraba. Lo que no está: copiar el progreso a la cuenta (la nativa lo guarda distinto que la web).
use super::*;
use serde_json::{json, Value};
use std::collections::HashSet;

/// la hora de ahora en ms (Date.now())
pub fn ahora_ms() -> f64 { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs_f64() * 1000.0).unwrap_or(0.0) }

/// cómo viene la tienda (TIENDA de tiendared.js): fallas seguidas y hasta cuándo no se le pide lo automático
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Freno { pub fallas: u32, pub hasta: f64 }
impl Freno {
    pub fn frenada(&self, ahora: f64) -> bool { ahora < self.hasta }
    /// lo que contestó: sin respuesta o el corte de Cloudflare (429 que no es JSON) es una falla; con 3 seguidas, 2 ** min(5,
    /// fallas − 2) minutos (hasta 30) sin lo automático; lo demás lo destraba
    pub fn anotar(&mut self, codigo: Option<u16>, cuerpo: &[u8], ahora: f64) {
        let json = cuerpo.iter().find(|c| !c.is_ascii_whitespace()).map_or(false, |c| *c == b'{' || *c == b'[');
        if codigo.is_none() || (codigo == Some(429) && !json) {
            self.fallas += 1;
            if self.fallas >= 3 { self.hasta = ahora + 2f64.powi(self.fallas.saturating_sub(2).min(5) as i32).min(30.0) * 60e3; }
        } else { self.fallas = 0; self.hasta = 0.0; }
    }
}

/// entrar con Gmail: el paso (1: la dirección, 2: el código), lo escrito, las novedades, el error y cuándo se mandó
#[derive(Clone, Debug, Default)]
pub struct Mail { pub paso: u8, pub dir: String, pub avisos: bool, pub err: String, pub ocupado: bool, pub t: f64 }
/// esperando a Google: el verificador, la página y desde cuándo
#[derive(Clone, Debug, Default)]
pub struct Espera { pub v: String, pub url: String, pub t0: f64, t_preg: f64 }

/// la cuenta y lo social (CU y SOC de la web)
#[derive(Default)]
pub struct Social {
    /// los pedidos con método, encabezados y cuerpo (red_android::Java::http) y abrir el navegador (Juego.java)
    pub http: Option<jxjuego::red::Http>, pub abrir: Option<Box<dyn Fn(&str)>>,
    pub token: String, pub u: Value, pub conf: Option<Value>, t_conf: f64, cargado: bool,
    pub mail: Option<Mail>, pub espera: Option<Espera>, pidiendo: HashSet<String>, pub freno: Freno,
    pub yo: Option<Value>, pub estado: String, pub amigos: Option<Value>, pub chats: Option<Vec<Value>>,
    pub chat: Option<String>, pub msgs: Vec<Value>, ult_id: i64, lei: i64, esc: Vec<String>, info: Value,
    /// lo buscado: sin buscar, no existe (None) o el perfil con la relación
    pub busc: Option<Option<Value>>, pub q: String, pub rec: Vec<Value>,
    /// Amigos: la sub-pestaña (0 amigos, 1 solicitudes, 2 bloqueados) y el elegido (para Eliminar y Bloquear)
    pub sub: usize, pub sel: Option<String>,
    pub badge: i64, pub sol: i64, ult_aviso: i64, pub error: Option<String>,
    t_latido: f64, t_chat: f64, t_lista: f64, pub al_fondo: bool,
    /// sumar amigos a un grupo (la lista para elegir) y los miembros del grupo abierto
    pub sumar: bool, pub miembros: Option<Vec<Value>>,
}

// ———————————— la huella del verificador (SHA-256), base64url y el azar ————————————
pub fn sha256(datos: &[u8]) -> [u8; 32] {
    const K: [u32; 64] = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    let mut h: [u32; 8] = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    let mut m = datos.to_vec(); let bits = (datos.len() as u64) * 8; m.push(0x80); while m.len() % 64 != 56 { m.push(0); } m.extend_from_slice(&bits.to_be_bytes());
    for b in m.chunks_exact(64) {
        let mut w = [0u32; 64];
        for i in 0..16 { w[i] = u32::from_be_bytes([b[i * 4], b[i * 4 + 1], b[i * 4 + 2], b[i * 4 + 3]]); }
        for i in 16..64 { let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3); let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10); w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1); }
        let mut v = h;
        for i in 0..64 {
            let s1 = v[4].rotate_right(6) ^ v[4].rotate_right(11) ^ v[4].rotate_right(25); let ch = (v[4] & v[5]) ^ (!v[4] & v[6]);
            let t1 = v[7].wrapping_add(s1).wrapping_add(ch).wrapping_add(K[i]).wrapping_add(w[i]);
            let s0 = v[0].rotate_right(2) ^ v[0].rotate_right(13) ^ v[0].rotate_right(22); let maj = (v[0] & v[1]) ^ (v[0] & v[2]) ^ (v[1] & v[2]);
            let t2 = s0.wrapping_add(maj);
            v = [t1.wrapping_add(t2), v[0], v[1], v[2], v[3].wrapping_add(t1), v[4], v[5], v[6]];
        }
        for i in 0..8 { h[i] = h[i].wrapping_add(v[i]); }
    }
    let mut o = [0u8; 32]; for i in 0..8 { o[i * 4..i * 4 + 4].copy_from_slice(&h[i].to_be_bytes()); } o
}
pub fn hex(b: &[u8]) -> String { b.iter().map(|x| format!("{x:02x}")).collect() }
/// cuB64: base64 de URL sin relleno
pub fn b64url(b: &[u8]) -> String {
    const A: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"; let mut s = String::new();
    for c in b.chunks(3) { let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        for k in 0..c.len() + 1 { s.push(A[(n >> (18 - 6 * k) & 63) as usize] as char); } }
    s
}
/// bytes al azar (de /dev/urandom; si no, de la hora)
fn azar(n: usize) -> Vec<u8> {
    use std::io::Read; let mut b = vec![0u8; n];
    if std::fs::File::open("/dev/urandom").and_then(|mut f| f.read_exact(&mut b)).is_ok() { return b; }
    let mut x = (ahora_ms() * 1000.0) as u64 | 1; for v in b.iter_mut() { x ^= x << 13; x ^= x >> 7; x ^= x << 17; *v = x as u8; } b
}
/// «hace 5 min», «hace 3 h», «hace 2 d»
pub fn hace(f: f64) -> String {
    if f <= 0.0 { return "desconectado".into(); }
    let s = ((ahora_ms() - f) / 1000.0).max(0.0);
    if s < 3600.0 { format!("hace {} min", (s / 60.0).round().max(1.0)) } else if s < 86400.0 { format!("hace {} h", (s / 3600.0).round()) } else { format!("hace {} d", (s / 86400.0).round()) }
}
/// en línea, jugando en un server o hace cuánto se lo vio
fn estado_de(p: &Value) -> String {
    if p["online"].as_bool().unwrap_or(false) { if let Some(m) = p["sala"]["m"].as_str() { return format!("Jugando · {}", super::nombre_mapa(m)); } return "En línea".into(); }
    hace(p["visto"].as_f64().unwrap_or(0.0))
}
fn txt(v: &Value, k: &str) -> String { v[k].as_str().unwrap_or("").to_string() }
/// lo que dice un mensaje del sistema (sis_creo, sis_salio, sis_unio)
fn sistema(k: &str, n: &str) -> String { match k { "creo" => format!("{n} creó el grupo"), "salio" => format!("{n} salió del grupo"), "unio" => format!("{n} se sumó al grupo"), _ => n.to_string() } }

const COL_ON: Col = rgba(0x5fd36a, 1.0);
const COL_MIO: Col = rgba(0x1f5fa8, 0.95);
const COL_OTRO: Col = rgba(0x1d2733, 0.95);

impl Juego {
    // ———————————— los pedidos ————————————
    /// un pedido a la tienda (cuApi): llega por gmod.tx como «cu:<clave>» con el código en los 3 primeros bytes
    fn cu_pedir(&mut self, clave: &str, metodo: &str, ruta: &str, cuerpo: Option<Value>, auto: bool) {
        if self.soc.pidiendo.contains(clave) { return; }
        if auto && self.soc.freno.frenada(ahora_ms()) { return; }
        let Some(h) = self.soc.http.clone() else { self.soc.error = Some("Sin conexión con la tienda".into()); return };
        self.soc.pidiendo.insert(clave.to_string());
        let mut cab: Vec<(String, String)> = vec![]; if !self.soc.token.is_empty() { cab.push(("Authorization".into(), format!("Bearer {}", self.soc.token))); }
        let b = cuerpo.map(|c| { cab.push(("Content-Type".into(), "application/json".into())); c.to_string() });
        let (url, m, k, tx) = (format!("{}{}", gmod_juego::TIENDA_URL, ruta), metodo.to_string(), format!("cu:{clave}"), self.gmod.tx.clone());
        std::thread::spawn(move || {
            let r = h(&m, &url, &cab, b.as_deref()).map(|(c, s)| { let mut v = format!("{:03}", c.min(999)).into_bytes(); v.extend_from_slice(s.as_bytes()); v });
            let _ = tx.send((k, r));
        });
    }
    /// lo que contestó la tienda (desde gmod_juego.rs)
    pub(crate) fn cu_llego(&mut self, clave: &str, r: Result<Vec<u8>, String>) {
        self.soc.pidiendo.remove(clave);
        let (cod, cuerpo) = match &r { Ok(b) if b.len() >= 3 => (std::str::from_utf8(&b[..3]).ok().and_then(|s| s.parse::<u16>().ok()), &b[3..]), _ => (None, &[][..]) };
        self.soc.freno.anotar(cod, cuerpo, ahora_ms());
        let j: Value = serde_json::from_slice(cuerpo).unwrap_or(Value::Null); let ok = matches!(cod, Some(200..=299));
        if cod.is_none() { if !clave.starts_with("latido") && !clave.starts_with("msgs") && clave != "chats_auto" { self.soc.error = Some("Sin conexión con la tienda".into()); } if let Some(m) = self.soc.mail.as_mut() { m.ocupado = false; m.err = "No hay conexión: probá de nuevo".into(); } return; }
        if cod == Some(401) && !self.soc.token.is_empty() && !clave.starts_with("mail") && clave != "listo" { self.cu_vencida(); return; }
        self.soc.error = None;
        let (base, arg) = clave.split_once(':').unwrap_or((clave, ""));
        match base {
            "config" => { if ok { self.soc.conf = Some(j); } else if cod == Some(404) { self.soc.conf = Some(json!({ "google": false })); } }
            "listo" => { if let Some(t) = j["token"].as_str() { let (t, u) = (t.to_string(), j["usuario"].clone()); self.soc.espera = None; self.cu_sesion(t, u); } else if j["vencido"].as_bool() == Some(true) { self.soc.espera = None; self.avisar("Se venció el tiempo para entrar: probá de nuevo".into()); } }
            "mail_pedir" => if let Some(m) = self.soc.mail.as_mut() { m.ocupado = false;
                if ok && j["ok"].as_bool() == Some(true) { m.paso = 2; if let Some(d) = j["dir"].as_str() { m.dir = d.to_string(); } m.t = ahora_ms(); m.err.clear(); }
                else { m.err = match j["mal"].as_str() { Some("gmail") => "Tiene que ser una dirección de Gmail (…@gmail.com)", Some("muchos") => "Demasiados intentos: esperá un rato", _ => "No se pudo mandar el código" }.into(); } },
            "mail_entrar" => {
                if let Some(t) = j["token"].as_str().filter(|_| ok) { let (t, u) = (t.to_string(), j["usuario"].clone()); self.cu_sesion(t, u); }
                else if let Some(m) = self.soc.mail.as_mut() { m.ocupado = false; m.err = match j["mal"].as_str() { Some("codigo") => format!("El código no es ese (te quedan {} intentos)", j["quedan"].as_i64().unwrap_or(0)), Some("vencido") => "El código se venció: pedí otro".into(), Some("muchos") => "Demasiados intentos: esperá un rato".into(), _ => "No se pudo entrar".into() }; }
            }
            "avisos" => { if ok { self.soc.u["avisos"] = json!(arg == "1"); self.cu_guardar(); } }
            "yo" => if ok { self.soc.yo = Some(j["perfil"].clone()); self.soc.estado = txt(&j, "estado"); },
            "perfil" => if ok { self.soc.yo = Some(j["perfil"].clone()); },
            "latido" => if ok {
                self.soc.sol = j["solicitudes"].as_i64().unwrap_or(0); self.soc.badge = j["noLeidos"].as_i64().unwrap_or(0) + self.soc.sol;
                let u = &j["ultimo"]; let id = u["id"].as_i64().unwrap_or(0);
                if id > self.soc.ult_aviso {
                    let viendo = self.soc.chat.as_deref() == u["chat"].as_str() && matches!(self.ini.panel, Some(PanelIni::Social { tab: 0, .. }));
                    if self.soc.ult_aviso > 0 && !viendo { let t = if txt(u, "tipo") == "inv" { "te invitó a su partida".to_string() } else if txt(u, "tipo") == "sis" { sistema(&txt(u, "k"), &txt(u, "texto")) } else { txt(u, "texto") };
                        self.avisar(if txt(u, "tipo") == "sis" { t } else { format!("{}: {}", txt(u, "nombre"), t) }); }
                    self.soc.ult_aviso = id;
                }
            },
            "buscar" => { if ok { self.soc.busc = Some(Some(j.clone())); let p = &j["perfil"]; let pid = txt(p, "pid");
                    self.soc.rec.retain(|x| x["pid"].as_str() != Some(pid.as_str())); self.soc.rec.insert(0, json!({ "pid": pid, "nombre": p["nombre"], "skin": p["skin"] })); self.soc.rec.truncate(6); self.cu_guardar_rec(); }
                else if cod == Some(404) { self.soc.busc = Some(None); } }
            "amigo" => { if ok { if let Some(Some(b)) = self.soc.busc.as_mut() { if b["perfil"]["pid"].as_str() == Some(arg) { b["rel"] = j["rel"].clone(); } } self.soc.amigos = None;
                    if j["rel"]["amigos"].as_bool() == Some(true) { self.avisar("¡Ahora son amigos!".into()); } else if j["rel"]["pedi"].as_bool() == Some(true) { self.avisar("Solicitud enviada".into()); } }
                else { self.avisar(j["error"].as_str().unwrap_or("No se pudo").to_string()); } }
            "amigos" => if ok { self.soc.amigos = Some(j); },
            "chats" | "chats_auto" => if ok { self.soc.chats = j["chats"].as_array().cloned(); },
            "dm" | "grupo" => if ok { if let Some(id) = j["id"].as_str() { self.soc_abrir_chat(id.to_string()); self.soc.chats = None; self.ini.panel = Some(PanelIni::Social { tab: 0, scroll: 0.0 }); } } else { self.avisar(j["error"].as_str().unwrap_or("No se pudo").to_string()); },
            "msgs" => if ok && self.soc.chat.as_deref() == Some(arg) {
                let nuevos = j["mensajes"].as_array().cloned().unwrap_or_default();
                if let Some(u) = nuevos.last() { self.soc.ult_id = u["id"].as_i64().unwrap_or(self.soc.ult_id); self.soc.al_fondo = true;
                    if let Some(c) = self.soc.chats.as_mut().and_then(|l| l.iter_mut().find(|c| c["id"].as_str() == Some(arg))) { c["noLeidos"] = json!(0); c["ultimo"] = json!({ "texto": u["texto"], "tipo": u["tipo"], "fecha": u["fecha"] }); } }
                self.soc.msgs.extend(nuevos); let n = self.soc.msgs.len(); if n > 200 { self.soc.msgs.drain(..n - 200); }
                self.soc.lei = j["leidoHasta"].as_i64().unwrap_or(0); self.soc.esc = j["escribiendo"].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default(); self.soc.info = j["chat"].clone();
            },
            "enviar" => { if !ok { self.avisar(j["error"].as_str().unwrap_or("No se pudo mandar").to_string()); } else if let Some(c) = self.soc.chat.clone() { self.cu_pedir(&format!("msgs:{c}"), "GET", &format!("social/chat/{c}?desde={}", self.soc.ult_id), None, false); } }
            "invitar" => { if ok { self.avisar("Invitación enviada".into()); } }
            "sumar" => { if ok { self.avisar(format!("Se sumaron {}", j["agregados"].as_i64().unwrap_or(0))); self.soc.miembros = None; } }
            "miembros" => if ok { self.soc.miembros = j["miembros"].as_array().cloned(); },
            "salirg" => { self.soc.chat = None; self.soc.chats = None; }
            _ => {}
        }
    }
    fn cu_sesion(&mut self, token: String, u: Value) {
        self.soc.token = token; self.soc.u = u; self.soc.mail = None; self.soc.yo = None; self.soc.amigos = None; self.soc.chats = None; self.cu_guardar();
        let n = txt(&self.soc.u, "nombre"); self.avisar(format!("Sesión iniciada: {n}")); self.soc.t_latido = ahora_ms() - 56e3;
    }
    fn cu_vencida(&mut self) { self.soc.token.clear(); self.soc.u = Value::Null; self.soc.yo = None; self.cu_guardar(); self.avisar("Tu sesión venció: entrá de nuevo".into()); }
    fn cu_guardar(&self) { if let Some(d) = &self.datos { let _ = if self.soc.token.is_empty() { std::fs::remove_file(d.join("cuenta.json")) } else { std::fs::write(d.join("cuenta.json"), json!({ "token": self.soc.token, "u": self.soc.u }).to_string()) }; } }
    fn cu_guardar_rec(&self) { if let Some(d) = &self.datos { let _ = std::fs::write(d.join("soc_rec.json"), Value::Array(self.soc.rec.clone()).to_string()); } }

    /// cada cuadro (desde gmod_tienda_paso): cargar la sesión, la config, esperar a Google, el latido y lo del chat abierto
    pub(crate) fn cu_paso(&mut self) {
        let ahora = ahora_ms();
        if !self.soc.cargado { self.soc.cargado = true;
            if let Some(d) = &self.datos {
                if let Some(v) = std::fs::read(d.join("cuenta.json")).ok().and_then(|b| serde_json::from_slice::<Value>(&b).ok()) { if let Some(t) = v["token"].as_str().filter(|t| t.len() == 64 && t.chars().all(|c| c.is_ascii_hexdigit())) { self.soc.token = t.to_string(); self.soc.u = v["u"].clone(); } }
                if let Some(Value::Array(a)) = std::fs::read(d.join("soc_rec.json")).ok().and_then(|b| serde_json::from_slice::<Value>(&b).ok()) { self.soc.rec = a; }
            }
            self.soc.t_latido = ahora - 56e3;
        }
        if self.soc.http.is_none() { return; }
        if self.soc.conf.is_none() && ahora - self.soc.t_conf > 30e3 { self.soc.t_conf = ahora; self.cu_pedir("config", "GET", "cuenta/config", None, false); }
        if let Some(e) = self.soc.espera.as_mut() {
            if ahora - e.t0 > 600e3 { self.soc.espera = None; self.avisar("Se venció el tiempo para entrar: probá de nuevo".into()); }
            else if ahora - e.t_preg > 1500.0 { e.t_preg = ahora; let v = e.v.clone(); self.cu_pedir("listo", "POST", "cuenta/listo", Some(json!({ "v": v })), false); }
        }
        if self.soc.token.is_empty() { return; }
        if ahora - self.soc.t_latido > 60e3 { self.soc.t_latido = ahora;
            let sala = if self.en_red.en_sala() { self.en_red.red.sala.as_ref().map(|s| json!({ "id": s.id, "n": s.n, "m": s.m, "mods": 0 })) } else { None };
            self.cu_pedir("latido", "POST", "social/latido", Some(json!({ "sala": sala, "skin": self.skin })), true);
            if self.soc.yo.is_none() { self.cu_pedir("yo", "GET", "social/yo", None, true); } }
        // (con la pestaña Chats abierta: lo nuevo del chat cada 4 s y la lista cada 12)
        if matches!(self.ini.panel, Some(PanelIni::Social { tab: 0, .. })) {
            if let Some(c) = self.soc.chat.clone() { if ahora - self.soc.t_chat > 4000.0 { self.soc.t_chat = ahora; self.cu_pedir(&format!("msgs:{c}"), "GET", &format!("social/chat/{c}?desde={}", self.soc.ult_id), None, true); } }
            if ahora - self.soc.t_lista > 12e3 { self.soc.t_lista = ahora; self.cu_pedir("chats_auto", "GET", "social/chats", None, true); }
        }
    }
    /// lo que hace falta pedir al mostrar una pestaña
    fn soc_pedir_tab(&mut self, tab: usize) {
        if self.soc.token.is_empty() { return; }
        match tab { 0 => if self.soc.chats.is_none() { self.cu_pedir("chats", "GET", "social/chats", None, false); },
            1 => if self.soc.amigos.is_none() { self.cu_pedir("amigos", "GET", "social/amigos", None, false); },
            3 => if self.soc.yo.is_none() { self.cu_pedir("yo", "GET", "social/yo", None, false); },
            _ => {} }
        if self.soc.sumar && self.soc.amigos.is_none() { self.cu_pedir("amigos", "GET", "social/amigos", None, false); }
    }
    fn soc_abrir_chat(&mut self, id: String) {
        self.soc.chat = Some(id.clone()); self.soc.msgs.clear(); self.soc.ult_id = 0; self.soc.lei = 0; self.soc.esc.clear(); self.soc.info = Value::Null; self.soc.miembros = None; self.soc.sumar = false;
        self.soc.t_chat = ahora_ms(); self.cu_pedir(&format!("msgs:{id}"), "GET", &format!("social/chat/{id}?desde=0"), None, false);
    }
    /// entrar con Google: el verificador al azar, su huella y la página de la tienda en el navegador
    fn cu_entrar_google(&mut self) {
        let v = b64url(&azar(32)); let e = hex(&sha256(v.as_bytes()));
        let url = format!("{}cuenta/entrar?e={e}&l=es&app=1", gmod_juego::TIENDA_URL);
        if let Some(a) = &self.soc.abrir { a(&url); } else { self.avisar("No se pudo abrir el navegador".into()); return; }
        self.soc.espera = Some(Espera { v, url, t0: ahora_ms(), t_preg: ahora_ms() });
    }

    /// lo que se toca (Acc::Soc): «orden|a|b»
    pub(super) fn soc_accion(&mut self, s: &str) {
        let mut it = s.split('|'); let a = it.next().unwrap_or(""); let b = it.next().unwrap_or("").to_string(); let c = it.next().unwrap_or("").to_string();
        match a {
            "google" => self.cu_entrar_google(),
            "reabrir" => { if let (Some(e), Some(ab)) = (&self.soc.espera, &self.soc.abrir) { ab(&e.url); } }
            "cancelar" => { self.soc.espera = None; self.soc.mail = None; }
            "gmail" => { self.soc.mail = Some(Mail { paso: 1, ..Default::default() }); self.pedir_texto(Escribir::Soc(0), "Tu dirección de Gmail", "", 80, false); }
            "mail" => { let d = self.soc.mail.as_ref().map(|m| m.dir.clone()).unwrap_or_default(); self.pedir_texto(Escribir::Soc(0), "Tu dirección de Gmail", &d, 80, false); }
            "novedades" => if let Some(m) = self.soc.mail.as_mut() { m.avisos = !m.avisos; },
            "mandar" => self.cu_mail_pedir(),
            "codigo" => self.pedir_texto(Escribir::Soc(1), "El código de 6 números", "", 6, false),
            "reenviar" => if let Some(m) = self.soc.mail.as_mut() { if ahora_ms() - m.t > 45e3 { m.paso = 1; self.cu_mail_pedir(); } else { self.avisar("Esperá unos segundos para pedir otro".into()); } },
            "volver" => { match self.soc.mail.as_mut() { Some(m) if m.paso == 2 => { m.paso = 1; m.err.clear(); } _ => self.soc.mail = None } }
            "salir" => { if !self.soc.token.is_empty() { self.cu_pedir("salir", "POST", "cuenta/salir", None, false); } self.soc.token.clear(); self.soc.u = Value::Null; self.soc.yo = None; self.soc.amigos = None; self.soc.chats = None; self.soc.chat = None; self.cu_guardar(); self.avisar("Sesión cerrada".into()); }
            "avisos" => { let si = !self.soc.u["avisos"].as_bool().unwrap_or(false); self.cu_pedir(&format!("avisos:{}", si as u8), "POST", "cuenta/avisos", Some(json!({ "si": si })), false); }
            "estado" => { if self.soc.estado != b { self.soc.estado = b.clone(); self.cu_pedir("perfil", "POST", "social/perfil", Some(json!({ "estado": b })), false); } }
            "nombre" => { let n = self.soc.yo.as_ref().map(|y| txt(y, "nombre")).unwrap_or_default(); self.pedir_texto(Escribir::Soc(2), "Tu nombre", &n, 24, false); }
            "buscar" => { let q = self.soc.q.clone(); self.pedir_texto(Escribir::Soc(3), "El ID de 8 números", &q, 8, false); }
            "buscarId" => { self.soc.q = b.clone(); self.soc_buscar(); }
            "sub" => { self.soc.sub = b.parse().unwrap_or(0); self.ini_scroll0(); }
            "sel" => { self.soc.sel = if self.soc.sel.as_deref() == Some(b.as_str()) { None } else { Some(b) }; }
            "amigo" => self.cu_pedir(&format!("amigo:{c}"), "POST", "social/amigo", Some(json!({ "pid": c, "accion": b })), false),
            "dm" => self.cu_pedir("dm", "POST", "social/chat", Some(json!({ "pid": b })), false),
            "abrir" => { self.soc_abrir_chat(b); self.ini_scroll0(); }
            "cerrar" => { self.soc.chat = None; self.soc.sumar = false; self.ini_scroll0(); }
            "escribir" => self.pedir_texto(Escribir::Soc(4), "Mensaje", "", 500, false),
            "invitar" | "invitarChat" => {
                let Some(s) = self.en_red.red.sala.as_ref().filter(|_| self.en_red.en_sala()).map(|s| json!({ "id": s.id, "n": s.n, "m": s.m, "mods": 0 })) else { self.avisar("Entrá a un server para invitar".into()); return };
                if a == "invitar" { self.cu_pedir("dm", "POST", "social/chat", Some(json!({ "pid": b })), false); self.avisar("Abrí el chat y tocá Invitar".into()); return; }
                if let Some(c) = self.soc.chat.clone() { self.cu_pedir("invitar", "POST", &format!("social/chat/{c}/enviar"), Some(json!({ "inv": s })), false); }
            }
            "unirse" => {
                let d = self.soc.msgs.iter().find(|m| m["id"].as_i64().map(|x| x.to_string()) == Some(b.clone())).map(|m| m["datos"].clone()).unwrap_or(Value::Null);
                let id = txt(&d, "id"); let salas = self.salas_inicio();
                match salas.iter().find(|x| x.0.id == id) { Some((s, _)) => { let s = s.clone(); self.ini_entrar_sala(&s); } None => self.avisar("Esa partida ya no está".into()) }
            }
            "grupo" => self.pedir_texto(Escribir::Soc(5), "El nombre del grupo", "", 30, false),
            "sumarVer" => { self.soc.sumar = !self.soc.sumar; if self.soc.amigos.is_none() { self.cu_pedir("amigos", "GET", "social/amigos", None, false); } }
            "sumar" => if let Some(ch) = self.soc.chat.clone() { self.cu_pedir("sumar", "POST", &format!("social/chat/{ch}/invitar"), Some(json!({ "pids": [b] })), false); },
            "miembros" => if let Some(ch) = self.soc.chat.clone() { if self.soc.miembros.is_some() { self.soc.miembros = None; } else { self.cu_pedir("miembros", "GET", &format!("social/chat/{ch}/miembros"), None, false); } },
            "salirGrupo" => if let Some(ch) = self.soc.chat.clone() { self.cu_pedir("salirg", "POST", &format!("social/chat/{ch}/salir"), None, false); },
            "recargar" => { self.soc.amigos = None; self.soc.chats = None; self.soc.yo = None; self.soc.error = None; self.soc.t_latido = 0.0; }
            _ => {}
        }
    }
    fn ini_scroll0(&mut self) { if let Some(PanelIni::Social { scroll, .. }) = self.ini.panel.as_mut() { *scroll = 0.0; } }
    fn soc_buscar(&mut self) {
        let pid: String = self.soc.q.chars().filter(|c| c.is_ascii_digit()).collect();
        if pid.len() != 8 { self.soc.busc = Some(None); return; }
        self.cu_pedir("buscar", "GET", &format!("social/buscar?pid={pid}"), None, false);
    }
    fn cu_mail_pedir(&mut self) {
        let Some(m) = self.soc.mail.as_mut() else { return }; if m.ocupado { return; }
        let ok = { let d = m.dir.to_lowercase(); d.contains('@') && (d.ends_with("@gmail.com") || d.ends_with("@googlemail.com")) && !d.contains(' ') };
        if !ok { m.err = "Tiene que ser una dirección de Gmail (…@gmail.com)".into(); return; }
        m.ocupado = true; m.err.clear(); let (d, av) = (m.dir.clone(), m.avisos);
        self.cu_pedir("mail_pedir", "POST", "cuenta/correo/pedir", Some(json!({ "correo": d, "l": "es", "avisos": av })), false);
    }
    /// lo escrito con el teclado (Escribir::Soc): 0 la dirección, 1 el código, 2 el nombre, 3 el ID, 4 el mensaje, 5 el grupo
    pub(crate) fn soc_escrito(&mut self, k: u8, t: String) {
        match k {
            0 => { if let Some(m) = self.soc.mail.as_mut() { m.dir = t.trim().to_lowercase(); m.err.clear(); } self.cu_mail_pedir(); }
            1 => { let cod: String = t.chars().filter(|c| c.is_ascii_digit()).collect();
                let Some(m) = self.soc.mail.as_mut() else { return }; if cod.len() != 6 { m.err = "El código tiene 6 números".into(); return; }
                m.ocupado = true; m.err.clear(); let (d, av) = (m.dir.clone(), m.avisos); let n = self.en_red.red.nombre.clone();
                self.cu_pedir("mail_entrar", "POST", "cuenta/correo/entrar", Some(json!({ "correo": d, "codigo": cod, "nombre": n, "avisos": av })), false); }
            2 => { let n: String = t.chars().filter(|c| !c.is_control()).take(24).collect(); let n = n.trim().to_string(); if n.is_empty() { return; }
                self.en_red.poner_nombre(&n); self.cu_pedir("perfil", "POST", "social/perfil", Some(json!({ "nombre": n })), false); }
            3 => { self.soc.q = t.chars().filter(|c| c.is_ascii_digit()).take(8).collect(); self.soc_buscar(); }
            4 => if let Some(c) = self.soc.chat.clone() { let t: String = t.chars().take(500).collect(); self.cu_pedir("enviar", "POST", &format!("social/chat/{c}/enviar"), Some(json!({ "texto": t.trim() })), false); },
            5 => { let n: String = t.trim().chars().take(30).collect(); if n.chars().count() < 2 { self.avisar("El nombre es muy corto".into()); return; } self.cu_pedir("grupo", "POST", "social/grupo", Some(json!({ "nombre": n, "pids": [] })), false); }
            _ => {}
        }
    }

    // ———————————— el panel ————————————
    /// un avatar: la inicial en un círculo del color de su nombre y el punto verde si está en línea
    fn soc_avatar(&self, p: &mut Pincel, m: &Pm, cx: f32, cy: f32, r: f32, nombre: &str, online: Option<bool>) {
        let h = nombre.bytes().fold(7u32, |a, b| a.wrapping_mul(31).wrapping_add(b as u32));
        let cols = [0x2f8ae8, 0x8b5cf6, 0xe8792f, 0x22a06b, 0xd94f70, 0x0f9fb5, 0xb8860b, 0x5b6bd6];
        p.disco(cx, cy, r, rgba(cols[(h % 8) as usize], 1.0)); p.anillo(cx, cy, r, rgba(0xffffff, 0.35));
        let ini: String = nombre.chars().next().map(|c| c.to_uppercase().collect()).unwrap_or_else(|| "?".into());
        p.texto_c(Cara::S7, r * 1.05, cx, cy + r * 0.38, TX, 0.0, &ini);
        if let Some(on) = online { p.disco(cx + r * 0.7, cy + r * 0.7, r * 0.3, rgba(0x0a0e14, 1.0)); p.disco(cx + r * 0.7, cy + r * 0.7, r * 0.22, if on { COL_ON } else { rgba(0x6b7787, 1.0) }); }
        let _ = m;
    }
    /// un renglón de persona: avatar, nombre, estado; devuelve dónde empiezan los botones (a la derecha)
    fn soc_fila(&self, p: &mut Pincel, m: &Pm, r: [f32; 4], per: &Value, sel: bool) {
        p.rect(r[0], r[1], r[2], r[3], if sel { rgba(0x1d2733, 0.95) } else { PN_PL2 }); p.borde(r[0], r[1], r[2], r[3], 1.0, if sel { con_a(AMA, 0.5) } else { PN_LIN });
        let rr = r[3] * 0.32; let n = txt(per, "nombre"); self.soc_avatar(p, m, r[0] + m.u + rr, r[1] + r[3] / 2.0, rr, &n, per["online"].as_bool());
        let x = r[0] + m.u * 2.0 + rr * 2.0; p.texto_max(Cara::S7, m.ft, x, r[1] + r[3] / 2.0 - m.ft * 0.15, TX, 0.02, &n, r[2] * 0.42);
        let on = per["online"].as_bool().unwrap_or(false); p.texto_max(Cara::S4, m.fs * 0.9, x, r[1] + r[3] / 2.0 + m.fs * 1.05, if on { COL_ON } else { PN_T3 }, 0.0, &estado_de(per), r[2] * 0.42);
    }
    /// botones a la derecha de un renglón (de derecha a izquierda)
    fn soc_botones(&self, p: &mut Pincel, m: &Pm, r: [f32; 4], bs: &[(&str, Option<&'static str>, bool, Acc)], z: &mut Vec<([f32; 4], Acc)>) {
        let h = m.ph * 0.85; let mut x = r[0] + r[2] - m.u * 0.6; let y = r[1] + (r[3] - h) / 2.0;
        for (t, ic, az, a) in bs { let w = self.pn_boton_ancho(p, m, t, ic.is_some(), *az); x -= w; self.pn_boton(p, m, [x, y, w, h], t, *ic, *az, a.clone(), z); x -= m.u * 0.4; }
    }

    /// Social (social.js): sin cuenta, el cartel para entrar; con cuenta, las cuatro pestañas
    pub(super) fn pn_social(&mut self, p: &mut Pincel, m: &Pm, tab: usize, scroll: f32, t: f32, z: &mut Vec<([f32; 4], Acc)>) {
        self.soc_pedir_tab(tab);
        let dentro = !self.soc.token.is_empty();
        let (alto, cont) = self.pn_marco(p, m, t, |p, c| {
            let (xt, hc) = self.pn_cabecera(p, m, c, "03", Some(("gente", AMA)), "Social", t);
            if dentro {
                let nl: i64 = self.soc.chats.as_ref().map(|l| l.iter().map(|c| c["noLeidos"].as_i64().unwrap_or(0)).sum()).unwrap_or(self.soc.badge - self.soc.sol).max(0);
                let tabs = [("Chats", "chat", nl), ("Amigos", "gente", self.soc.sol), ("Buscar jugador", "buscar", 0), ("Perfil", "persona", 0)];
                let mut x = xt + m.u; let ty = c[1] + (hc - 1.0 - m.ph) / 2.0;
                let entra = tabs.iter().map(|(n, _, k)| self.pn_pestana_ancho(p, m, n, (*k > 0).then_some(*k as usize), true) + 4.0).sum::<f32>() <= c[0] + c[2] - 14.0 - x;
                for (k, (n, ic, cnt)) in tabs.iter().enumerate() { let cn = (*cnt > 0).then_some(*cnt as usize); let n2 = if entra { *n } else { "" }; let wt = if entra { self.pn_pestana_ancho(p, m, n, cn, true) } else { m.ph.max(44.0) + 12.0 };
                    self.pn_pestana(p, m, [x, ty, wt, m.ph], n2, if entra { cn } else { None }, Some(ic), k == tab, Acc::Tab(k), z); x += wt + 4.0; }
            }
            let pie_h = m.ph + 2.0 + m.u * 1.5 + 1.0; let pie = self.pn_pie(p, m, c, pie_h, t, z);
            let pby = pie[1] + 1.0 + (pie_h - 1.0 - m.ph) / 2.0; let mut xd = pie[0] + pie[2] - m.u * 1.5;
            let mut principal = |p: &mut Pincel, s: &str, ic: &'static str, a: Acc, z: &mut Vec<([f32; 4], Acc)>| { let w = self.pn_principal_ancho(p, m, s); xd -= w; self.pn_principal(p, m, [xd, pby - 1.0, w, m.ph + 2.0], s, ic, a, z); xd -= m.u; };
            if dentro { match tab {
                0 if self.soc.chat.is_some() => { principal(p, "Escribir", "enviar", Acc::Soc("escribir".into()), z); principal(p, "Invitar a mi partida", "mas", Acc::Soc("invitarChat".into()), z); }
                0 => principal(p, "Grupo nuevo", "mas", Acc::Soc("grupo".into()), z),
                2 => principal(p, "Buscar por ID", "buscar", Acc::Soc("buscar".into()), z),
                _ => principal(p, "Actualizar", "girar", Acc::Soc("recargar".into()), z),
            } }
            let cu = [c[0], c[1] + hc, c[2], pie[1] - c[1] - hc]; let u = m.u; let mut alto = 0.0;
            p.con_recorte(cu, |p| {
                let x0 = cu[0] + u * 1.4; let w = cu[2] - u * 2.8; let mut y = cu[1] + u - scroll;
                if let Some(e) = &self.soc.error { p.texto_max(Cara::S4, m.fs, x0, y + m.fs, rgba(0xff9b9b, 1.0), 0.0, &format!("{e} · tocá Actualizar"), w); y += m.fs * 1.8; }
                if !dentro { y = self.soc_sin_cuenta(p, m, cu, x0, w, y, z); }
                else { y = match tab { 0 => self.soc_chats(p, m, cu, x0, w, y, z), 1 => self.soc_amigos(p, m, x0, w, y, z), 2 => self.soc_buscar_tab(p, m, x0, w, y, z), _ => self.soc_perfil(p, m, x0, w, y, z) }; }
                alto = y + scroll - cu[1];
            });
            (alto, cu)
        });
        self.ini.pn.contenido = cont; self.ini.pn.alto_contenido = alto;
        if self.soc.al_fondo { self.soc.al_fondo = false; if let Some(PanelIni::Social { scroll, .. }) = self.ini.panel.as_mut() { *scroll = (alto - cont[3]).max(0.0); } }
    }
    /// sin sesión: Google o Gmail (cuDialogo), esperando a Google, o los dos pasos de Gmail
    fn soc_sin_cuenta(&self, p: &mut Pincel, m: &Pm, cu: [f32; 4], x0: f32, w: f32, y0: f32, z: &mut Vec<([f32; 4], Acc)>) -> f32 {
        let ww = w.min(560.0); let x = x0 + (w - ww) / 2.0; let mut y = y0 + cu[3] * 0.08; let lh = m.ft * 1.45; let bh = m.ph * 1.05;
        let boton = |p: &mut Pincel, z: &mut Vec<([f32; 4], Acc)>, y: &mut f32, s: &str, ic: Option<&'static str>, az: bool, a: Acc| { let bw = self.pn_boton_ancho(p, m, s, ic.is_some(), az).max(ww * 0.6); self.pn_boton(p, m, [x + (ww - bw) / 2.0, *y, bw, bh], s, ic, az, a, z); *y += bh + m.u; };
        let par = |p: &mut Pincel, y: &mut f32, s: &str, c: Col| { *y += self.pn_parrafo(p, x, *y, ww, m.ft, lh, c, s, true) + m.u; };
        let Some(conf) = &self.soc.conf else { par(p, &mut y, if self.soc.http.is_some() { "Conectando con la tienda…" } else { "Lo social necesita internet." }, PN_T2); return y };
        let (g, co) = (conf["google"].as_bool().unwrap_or(false), conf["correo"].as_bool().unwrap_or(false));
        if let Some(_e) = &self.soc.espera {
            par(p, &mut y, "Esperando a Google… Terminá de iniciar sesión en la página que se abrió y volvé al juego.", TX);
            boton(p, z, &mut y, "Abrir de nuevo", Some("mundo"), true, Acc::Soc("reabrir".into())); boton(p, z, &mut y, "Cancelar", None, false, Acc::Soc("cancelar".into()));
        } else if let Some(mm) = &self.soc.mail {
            if mm.paso == 2 { par(p, &mut y, &format!("Escribí el código de 6 números que te mandamos a {}.", mm.dir), TX);
                boton(p, z, &mut y, if mm.ocupado { "Entrando…" } else { "Escribir el código" }, Some("lapiz"), true, Acc::Soc("codigo".into()));
                boton(p, z, &mut y, "Reenviar el código", Some("girar"), false, Acc::Soc("reenviar".into())); }
            else { par(p, &mut y, "Escribí tu dirección de Gmail: te mandamos un código de 6 números para entrar.", TX);
                let d = if mm.dir.is_empty() { "tunombre@gmail.com".to_string() } else { mm.dir.clone() };
                p.rect(x, y, ww, bh, PN_POZO); p.borde(x, y, ww, bh, 1.0, PN_LIN2); p.texto_max(Cara::S4, m.ft, x + m.u, y + bh / 2.0 + m.ft * 0.35, if mm.dir.is_empty() { PN_T3 } else { TX }, 0.0, &d, ww - m.u * 2.0); zona(p, z, [x, y, ww, bh], Acc::Soc("mail".into())); y += bh + m.u;
                boton(p, z, &mut y, if mm.avisos { "Recibir novedades por correo: sí" } else { "Recibir novedades por correo: no" }, Some(if mm.avisos { "si" } else { "no" }), false, Acc::Soc("novedades".into()));
                boton(p, z, &mut y, if mm.ocupado { "Mandando…" } else { "Mandar el código" }, Some("enviar"), true, Acc::Soc("mandar".into())); }
            if !mm.err.is_empty() { par(p, &mut y, &mm.err, rgba(0xff9b9b, 1.0)); }
            boton(p, z, &mut y, "Volver", Some("atras"), false, Acc::Soc("volver".into()));
        } else if !g && !co { par(p, &mut y, "Lo social todavía no está disponible en la tienda.", PN_T2); }
        else {
            par(p, &mut y, "Con tu cuenta chateás con tus amigos, los invitás a tu partida y te encuentran por tu ID.", TX);
            if g { boton(p, z, &mut y, "Iniciar sesión con Google", Some("persona"), true, Acc::Soc("google".into())); }
            if co { boton(p, z, &mut y, "Entrar con tu Gmail", Some("chat"), !g, Acc::Soc("gmail".into())); }
        }
        y
    }
    /// Chats: la lista o, con uno abierto, la conversación (y la lista de amigos para sumar al grupo)
    fn soc_chats(&self, p: &mut Pincel, m: &Pm, cu: [f32; 4], x0: f32, w: f32, mut y: f32, z: &mut Vec<([f32; 4], Acc)>) -> f32 {
        let u = m.u; let rh = m.ph * 1.25;
        let Some(cid) = self.soc.chat.clone() else {
            let Some(l) = &self.soc.chats else { p.texto(Cara::S4, m.ft, x0, y + m.ft, PN_T2, 0.0, "Cargando los chats…"); return y + m.ft * 2.0 };
            if l.is_empty() { y += self.pn_parrafo(p, x0, y, w, m.ft, m.ft * 1.45, PN_T2, "Todavía no tenés chats. Agregá amigos (Buscar jugador) y mandales un mensaje, o armá un grupo.", false); return y; }
            for (i, c) in l.iter().enumerate() {
                let r = [x0, y, w, rh]; let id = txt(c, "id"); let grupo = txt(c, "tipo") == "grupo";
                if y + rh > cu[1] && y < cu[1] + cu[3] { { let _ = i;
                    p.rect(r[0], r[1], r[2], r[3], PN_PL2); p.borde(r[0], r[1], r[2], r[3], 1.0, PN_LIN);
                    let rr = rh * 0.32; let n = txt(c, "nombre");
                    if grupo { p.disco(r[0] + u + rr, y + rh / 2.0, rr, PN_PL3); p.icono("gente", r[0] + u + rr * 0.4, y + rh / 2.0 - rr * 0.6, rr * 1.2, 2.0, TX); } else { self.soc_avatar(p, m, r[0] + u + rr, y + rh / 2.0, rr, &n, c["otro"]["online"].as_bool()); }
                    let x = r[0] + u * 2.0 + rr * 2.0; let ult = &c["ultimo"];
                    let ut = if ult.is_null() { "Sin mensajes".to_string() } else if txt(ult, "tipo") == "inv" { "Invitación a partida".into() } else if txt(ult, "tipo") == "sis" { sistema(&txt(ult, "k"), &txt(ult, "texto")) } else { txt(ult, "texto") };
                    p.texto_max(Cara::S7, m.ft, x, y + rh / 2.0 - m.ft * 0.15, TX, 0.02, &n, w * 0.55);
                    p.texto_max(Cara::S4, m.fs * 0.9, x, y + rh / 2.0 + m.fs * 1.05, PN_T3, 0.0, &ut, w - (x - r[0]) - u * 5.0);
                    let nl = c["noLeidos"].as_i64().unwrap_or(0);
                    if let Some(f) = ult["fecha"].as_f64() { p.texto_d(Cara::S4, m.fs * 0.85, r[0] + w - u, y + rh / 2.0 - m.fs * 0.2, PN_T3, 0.0, &hace(f).replace("hace ", "")); }
                    if nl > 0 { let s = nl.to_string(); let bw = p.at.ancho(Cara::S7, m.fs * 0.85, 0.0, &s) + m.fs; p.caja(r[0] + w - u - bw, y + rh / 2.0 + m.fs * 0.2, bw, m.fs * 1.2, m.fs * 0.6, AMA); p.texto_c(Cara::S7, m.fs * 0.85, r[0] + w - u - bw / 2.0, y + rh / 2.0 + m.fs * 1.08, TX, 0.0, &s); }
                } zona(p, z, r, Acc::Soc(format!("abrir|{id}"))); }
                y += rh + u * 0.5;
            }
            return y;
        };
        // (la conversación: la cabecera con volver, el nombre y, en un grupo, miembros, sumar y salir)
        let c = self.soc.chats.as_ref().and_then(|l| l.iter().find(|c| c["id"].as_str() == Some(cid.as_str()))).cloned().unwrap_or(Value::Null);
        let grupo = txt(&self.soc.info, "tipo") == "grupo" || txt(&c, "tipo") == "grupo";
        let nombre = { let n = txt(&c, "nombre"); if n.is_empty() { txt(&self.soc.info, "nombre") } else { n } };
        let hb = m.ph * 0.85; let bw = self.pn_boton_ancho(p, m, "Chats", true, false);
        self.pn_boton(p, m, [x0, y, bw, hb], "Chats", Some("atras"), false, Acc::Soc("cerrar".into()), z);
        let sub = if grupo { format!("{} miembros", c["miembros"].as_i64().unwrap_or(0)) } else if c["otro"]["online"].as_bool() == Some(true) { "En línea".into() } else { hace(c["otro"]["visto"].as_f64().unwrap_or(0.0)) };
        p.texto_max(Cara::S7, m.ft, x0 + bw + u, y + hb / 2.0 - m.ft * 0.05, TX, 0.02, &nombre, w * 0.4); p.texto_max(Cara::S4, m.fs * 0.85, x0 + bw + u, y + hb / 2.0 + m.fs * 1.0, PN_T3, 0.0, &sub, w * 0.4);
        if grupo { self.soc_botones(p, m, [x0, y, w, hb], &[("Salir", Some("salir"), false, Acc::Soc("salirGrupo".into())), ("Sumar", Some("mas"), false, Acc::Soc("sumarVer".into())), ("Miembros", Some("gente"), false, Acc::Soc("miembros".into()))], z); }
        y += hb + u;
        if let Some(ms) = &self.soc.miembros { for per in ms { self.soc_fila(p, m, [x0, y, w, rh], per, false); y += rh + u * 0.4; } y += u; }
        if self.soc.sumar { let am = self.soc.amigos.as_ref().and_then(|a| a["amigos"].as_array().cloned()).unwrap_or_default();
            if am.is_empty() { p.texto(Cara::S4, m.fs, x0, y + m.fs, PN_T2, 0.0, "No tenés amigos para sumar."); y += m.fs * 2.0; }
            for per in &am { let r = [x0, y, w, rh]; self.soc_fila(p, m, r, per, false); self.soc_botones(p, m, r, &[("Sumar", Some("mas"), true, Acc::Soc(format!("sumar|{}", txt(per, "pid"))))], z); y += rh + u * 0.4; } y += u; }
        if self.soc.msgs.is_empty() { p.texto(Cara::S4, m.ft, x0, y + m.ft, PN_T2, 0.0, "Todavía no hay mensajes: tocá Escribir."); y += m.ft * 2.0; }
        let mw = w * 0.72; let lh = m.fs * 1.35;
        for msg in &self.soc.msgs {
            let tipo = txt(msg, "tipo"); let mio = msg["mio"].as_bool().unwrap_or(false);
            if tipo == "sis" { let s = sistema(msg["datos"]["k"].as_str().unwrap_or(""), &txt(msg, "texto")); p.texto_c(Cara::S4, m.fs * 0.9, x0 + w / 2.0, y + m.fs, PN_T3, 0.0, &s); y += m.fs * 1.8; continue; }
            let de = txt(&msg["de"], "nombre"); let cab = grupo && !mio;
            let (rs, inv) = if tipo == "inv" { let d = &msg["datos"]; (vec!["Invitación a partida".to_string(), format!("{} · {}", super::nombre_mapa(&txt(d, "m")), txt(d, "n"))], true) } else { (p.at.renglones(Cara::S4, m.fs, 0.0, &txt(msg, "texto"), mw - u * 2.0), false) };
            let anch = rs.iter().map(|r| p.at.ancho(Cara::S4, m.fs, 0.0, r)).fold(if cab { p.at.ancho(Cara::S7, m.fs * 0.85, 0.0, &de) } else { 0.0 }, f32::max).max(m.fs * 4.0) + u * 2.0;
            let bw = if inv { mw } else { anch.min(mw) }; let bh = u * 0.8 + if cab { m.fs * 1.2 } else { 0.0 } + rs.len() as f32 * lh + m.fs * 1.1 + if inv && !mio { m.ph * 0.85 + u * 0.5 } else { 0.0 };
            let bx = if mio { x0 + w - bw } else { x0 };
            if y + bh > cu[1] && y < cu[1] + cu[3] {
                p.caja(bx, y, bw, bh, u * 0.8, if mio { COL_MIO } else { COL_OTRO }); if inv { p.borde(bx, y, bw, bh, 1.0, con_a(AMA, 0.7)); }
                let mut yy = y + u * 0.4;
                if cab { p.texto_max(Cara::S7, m.fs * 0.85, bx + u, yy + m.fs, rgba(0x9fd0ff, 1.0), 0.0, &de, bw - u * 2.0); yy += m.fs * 1.2; }
                for (k, r) in rs.iter().enumerate() { p.texto(if inv && k == 0 { Cara::S7 } else { Cara::S4 }, m.fs, bx + u, yy + m.fs, TX, 0.0, r); yy += lh; }
                if inv && !mio { let ub = self.pn_boton_ancho(p, m, "Unirse", true, true); self.pn_boton(p, m, [bx + u, yy + u * 0.2, ub, m.ph * 0.85], "Unirse", Some("jugar"), true, Acc::Soc(format!("unirse|{}", msg["id"].as_i64().unwrap_or(0))), z); yy += m.ph * 0.85 + u * 0.5; }
                let hora = msg["fecha"].as_f64().map(hace).unwrap_or_default().replace("hace ", "");
                // (los tildes: uno enviado, dos leído —en celeste—)
                let ti = m.fs * 0.8; let xh = bx + bw - u * 0.6 - if mio { ti * 1.5 } else { 0.0 };
                p.texto_d(Cara::S4, m.fs * 0.75, xh - if mio { u * 0.3 } else { 0.0 }, yy + m.fs * 0.85, rgba(0xc6d1de, 0.8), 0.0, &hora);
                if mio { let leido = msg["id"].as_i64().unwrap_or(0) <= self.soc.lei; let c = if leido { rgba(0x7fd4ff, 1.0) } else { rgba(0xc6d1de, 0.8) };
                    p.icono("si", xh, yy + m.fs * 0.85 - ti * 0.85, ti, 2.0, c); if leido { p.icono("si", xh + ti * 0.45, yy + m.fs * 0.85 - ti * 0.85, ti, 2.0, c); } }
            }
            y += bh + u * 0.5;
        }
        if !self.soc.esc.is_empty() { p.texto(Cara::S4, m.fs * 0.9, x0, y + m.fs, PN_T3, 0.0, &format!("{} está escribiendo…", self.soc.esc.join(", "))); y += m.fs * 1.6; }
        y
    }
    /// Amigos: amigos (en línea primero), solicitudes y bloqueados
    fn soc_amigos(&self, p: &mut Pincel, m: &Pm, x0: f32, w: f32, mut y: f32, z: &mut Vec<([f32; 4], Acc)>) -> f32 {
        let u = m.u; let rh = m.ph * 1.25;
        let Some(a) = &self.soc.amigos else { p.texto(Cara::S4, m.ft, x0, y + m.ft, PN_T2, 0.0, "Cargando…"); return y + m.ft * 2.0 };
        let l = |k: &str| a[k].as_array().cloned().unwrap_or_default(); let (am, rec, env, bl) = (l("amigos"), l("recibidas"), l("enviadas"), l("bloqueados"));
        let subs = [(format!("Amigos {}", am.len()), "gente"), (format!("Solicitudes {}", rec.len()), "campana"), (format!("Bloqueados {}", bl.len()), "prohibido")]; let mut x = x0;
        for (k, (s, ic)) in subs.iter().enumerate() { let tw = self.pn_boton_ancho(p, m, s, true, k == self.soc.sub); self.pn_boton(p, m, [x, y, tw, m.ph * 0.85], s, Some(*ic), k == self.soc.sub, Acc::Soc(format!("sub|{k}")), z); x += tw + u * 0.4; }
        y += m.ph * 0.85 + u;
        let seccion = |p: &mut Pincel, y: &mut f32, s: &str, c: Col| { p.texto(Cara::S7, m.fs * 0.9, x0, *y + m.fs, c, 0.06, s); *y += m.fs * 1.6; };
        match self.soc.sub {
            0 => {
                if am.is_empty() { y += self.pn_parrafo(p, x0, y, w, m.ft, m.ft * 1.45, PN_T2, "Todavía no tenés amigos. Buscá a alguien por su ID (Buscar jugador) y mandale una solicitud.", false); }
                let on: Vec<&Value> = am.iter().filter(|x| x["online"].as_bool() == Some(true)).collect(); let off: Vec<&Value> = am.iter().filter(|x| x["online"].as_bool() != Some(true)).collect();
                for (tit, grupo, col) in [(format!("EN LÍNEA · {}", on.len()), on, COL_ON), (format!("DESCONECTADOS · {}", off.len()), off, PN_T3)] {
                    if am.is_empty() { break; } seccion(p, &mut y, &tit, col);
                    for per in grupo { let pid = txt(per, "pid"); let sel = self.soc.sel.as_deref() == Some(pid.as_str()); let r = [x0, y, w, rh];
                        zona(p, z, r, Acc::Soc(format!("sel|{pid}"))); self.soc_fila(p, m, r, per, sel);
                        if sel { self.soc_botones(p, m, r, &[("Bloquear", Some("prohibido"), false, Acc::Soc(format!("amigo|bloquear|{pid}"))), ("Eliminar", Some("basura"), false, Acc::Soc(format!("amigo|borrar|{pid}")))], z); }
                        else { self.soc_botones(p, m, r, &[("Mensaje", Some("chat"), true, Acc::Soc(format!("dm|{pid}"))), ("Invitar", Some("mas"), false, Acc::Soc(format!("invitar|{pid}")))], z); }
                        y += rh + u * 0.4; }
                    y += u * 0.6;
                }
            }
            1 => {
                if rec.is_empty() && env.is_empty() { p.texto(Cara::S4, m.ft, x0, y + m.ft, PN_T2, 0.0, "No hay solicitudes."); y += m.ft * 2.0; }
                if !rec.is_empty() { seccion(p, &mut y, "TE PIDIERON", AMA); }
                for per in &rec { let pid = txt(per, "pid"); let r = [x0, y, w, rh]; self.soc_fila(p, m, r, per, false);
                    self.soc_botones(p, m, r, &[("Rechazar", Some("no"), false, Acc::Soc(format!("amigo|rechazar|{pid}"))), ("Aceptar", Some("si"), true, Acc::Soc(format!("amigo|aceptar|{pid}")))], z); y += rh + u * 0.4; }
                if !env.is_empty() { seccion(p, &mut y, "ENVIADAS", PN_T3); }
                for per in &env { let pid = txt(per, "pid"); let r = [x0, y, w, rh]; self.soc_fila(p, m, r, per, false); self.soc_botones(p, m, r, &[("Cancelar", Some("no"), false, Acc::Soc(format!("amigo|rechazar|{pid}")))], z); y += rh + u * 0.4; }
            }
            _ => {
                if bl.is_empty() { p.texto(Cara::S4, m.ft, x0, y + m.ft, PN_T2, 0.0, "No bloqueaste a nadie."); y += m.ft * 2.0; }
                for per in &bl { let pid = txt(per, "pid"); let r = [x0, y, w, rh]; self.soc_fila(p, m, r, per, false); self.soc_botones(p, m, r, &[("Desbloquear", Some("candado"), false, Acc::Soc(format!("amigo|desbloquear|{pid}")))], z); y += rh + u * 0.4; }
            }
        }
        y
    }
    /// Buscar jugador: por el ID de 8 números, el resultado con lo que se puede hacer y los recientes
    fn soc_buscar_tab(&self, p: &mut Pincel, m: &Pm, x0: f32, w: f32, mut y: f32, z: &mut Vec<([f32; 4], Acc)>) -> f32 {
        let u = m.u; let rh = m.ph * 1.25; let bh = m.ph;
        let q = if self.soc.q.is_empty() { "Escribí el ID (8 números)".to_string() } else { self.soc.q.clone() };
        p.rect(x0, y, w, bh, PN_POZO); p.borde(x0, y, w, bh, 1.0, PN_LIN2); p.icono("buscar", x0 + u, y + (bh - m.ft * 1.1) / 2.0, m.ft * 1.1, 2.2, PN_T3);
        p.texto_max(Cara::S4, m.ft, x0 + u * 2.0 + m.ft * 1.1, y + bh / 2.0 + m.ft * 0.35, if self.soc.q.is_empty() { PN_T3 } else { TX }, 0.04, &q, w - u * 4.0); zona(p, z, [x0, y, w, bh], Acc::Soc("buscar".into())); y += bh + u;
        match &self.soc.busc {
            Some(None) => { p.texto(Cara::S4, m.ft, x0, y + m.ft, PN_T2, 0.0, "No hay nadie con ese ID."); y += m.ft * 2.0; }
            Some(Some(r)) => { let per = &r["perfil"]; let rel = &r["rel"]; let pid = txt(per, "pid"); let fr = [x0, y, w, rh]; self.soc_fila(p, m, fr, per, true);
                let mut bs: Vec<(&str, Option<&'static str>, bool, Acc)> = vec![];
                if rel["amigos"].as_bool() == Some(true) { bs.push(("Mensaje", Some("chat"), true, Acc::Soc(format!("dm|{pid}")))); }
                else if rel["pedi"].as_bool() == Some(true) { bs.push(("Pedido", Some("reloj"), false, Acc::Nada)); }
                else if rel["mePidio"].as_bool() == Some(true) { bs.push(("Aceptar", Some("si"), true, Acc::Soc(format!("amigo|aceptar|{pid}")))); }
                else if rel["bloquee"].as_bool() == Some(true) { bs.push(("Desbloquear", Some("candado"), false, Acc::Soc(format!("amigo|desbloquear|{pid}")))); }
                else { bs.push(("Agregar", Some("mas"), true, Acc::Soc(format!("amigo|pedir|{pid}")))); }
                self.soc_botones(p, m, fr, &bs, z); y += rh + u * 0.4; p.texto(Cara::S4, m.fs * 0.9, x0, y + m.fs, PN_T3, 0.0, &format!("ID: {pid}")); y += m.fs * 2.0; }
            None => {}
        }
        if !self.soc.rec.is_empty() { p.texto(Cara::S7, m.fs * 0.9, x0, y + m.fs, PN_T3, 0.06, "RECIENTES"); y += m.fs * 1.6;
            for per in &self.soc.rec { let pid = txt(per, "pid"); let r = [x0, y, w, rh * 0.85]; zona(p, z, r, Acc::Soc(format!("buscarId|{pid}")));
                p.rect(r[0], r[1], r[2], r[3], PN_PL2); p.borde(r[0], r[1], r[2], r[3], 1.0, PN_LIN); let rr = r[3] * 0.32; self.soc_avatar(p, m, x0 + u + rr, y + r[3] / 2.0, rr, &txt(per, "nombre"), None);
                p.texto_max(Cara::S7, m.ft, x0 + u * 2.0 + rr * 2.0, y + r[3] / 2.0 + m.ft * 0.35, TX, 0.02, &txt(per, "nombre"), w * 0.5); p.texto_d(Cara::S4, m.fs * 0.9, x0 + w - u, y + r[3] / 2.0 + m.fs * 0.35, PN_T3, 0.04, &format!("ID {pid}"));
                y += r[3] + u * 0.4; } }
        y
    }
    /// Perfil: el nombre (para cambiarlo), el ID, en línea o desconectado, las novedades por correo y cerrar sesión
    fn soc_perfil(&self, p: &mut Pincel, m: &Pm, x0: f32, w: f32, mut y: f32, z: &mut Vec<([f32; 4], Acc)>) -> f32 {
        let u = m.u; let ww = w.min(620.0); let x = x0 + (w - ww) / 2.0; let yo = self.soc.yo.clone().unwrap_or(Value::Null);
        let nombre = { let n = txt(&yo, "nombre"); if n.is_empty() { txt(&self.soc.u, "nombre") } else { n } };
        let ch = m.ph * 2.6; p.rect(x, y, ww, ch, PN_PL2); p.borde(x, y, ww, ch, 1.0, PN_LIN); let rr = ch * 0.3; let on = self.soc.estado != "off";
        self.soc_avatar(p, m, x + u * 1.5 + rr, y + ch / 2.0, rr, &nombre, Some(on));
        let tx = x + u * 3.0 + rr * 2.0; p.texto_max(Cara::S7, m.fg * 0.8, tx, y + ch * 0.38, TX, 0.02, &nombre, ww - (tx - x) - u);
        p.texto(Cara::S4, m.fs, tx, y + ch * 0.38 + m.fs * 1.5, if on { COL_ON } else { PN_T3 }, 0.0, if on { "En línea" } else { "Desconectado" });
        p.texto(Cara::S7, m.fs, tx, y + ch * 0.38 + m.fs * 3.0, PN_T2, 0.04, &format!("ID: {}", if txt(&yo, "pid").is_empty() { "…".to_string() } else { txt(&yo, "pid") }));
        y += ch + u;
        let bh = m.ph * 0.95; let fila = |p: &mut Pincel, z: &mut Vec<([f32; 4], Acc)>, y: &mut f32, bs: &[(&str, &'static str, bool, Acc)]| { let n = bs.len() as f32; let bw = (ww - u * (n - 1.0)) / n; for (k, (s, ic, az, a)) in bs.iter().enumerate() { self.pn_boton(p, m, [x + k as f32 * (bw + u), *y, bw, bh], s, Some(*ic), *az, a.clone(), z); } *y += bh + u; };
        fila(p, z, &mut y, &[("Cambiar el nombre", "lapiz", false, Acc::Soc("nombre".into()))]);
        fila(p, z, &mut y, &[("En línea", "si", on, Acc::Soc("estado|on".into())), ("Desconectado", "no", !on, Acc::Soc("estado|off".into()))]);
        if self.soc.u["correo"].as_str().is_some() { let av = self.soc.u["avisos"].as_bool().unwrap_or(false); fila(p, z, &mut y, &[(if av { "Novedades por correo: sí" } else { "Novedades por correo: no" }, if av { "si" } else { "no" }, false, Acc::Soc("avisos".into()))]); }
        fila(p, z, &mut y, &[("Cerrar sesión", "salir", false, Acc::Soc("salir".into()))]);
        y += self.pn_parrafo(p, x, y, ww, m.fs, m.fs * 1.4, PN_T3, "Pasale tu ID a tus amigos para que te encuentren en Buscar jugador.", true);
        y
    }
}

impl Juego {
    /// (para las fotos: una sesión de ejemplo sin la tienda —amigos, chats, un grupo con mensajes, lo buscado—; con
    /// `chat`, la conversación abierta)
    pub fn soc_demo(&mut self, chat: bool) {
        let t = ahora_ms(); let per = |pid: &str, n: &str, on: bool, hace_min: f64, sala: Option<&str>| json!({ "pid": pid, "nombre": n, "skin": "Hero", "online": on, "visto": t - hace_min * 60e3, "sala": sala.map(|m| json!({ "id": "x", "n": "Server", "m": m })) });
        self.soc.http = None; self.soc.token = "0".repeat(64); self.soc.u = json!({ "nombre": "Nico", "correo": "c", "avisos": true }); self.soc.conf = Some(json!({ "google": true, "correo": true }));
        self.soc.yo = Some(json!({ "pid": "48213907", "nombre": "Nico", "skin": "Hero", "online": true })); self.soc.estado = "on".into();
        self.soc.amigos = Some(json!({ "amigos": [per("11223344", "Brasa", true, 0.0, Some("RB_Flatgrass")), per("55667788", "Vega", true, 0.0, None), per("99001122", "Tomi", false, 95.0, None), per("33445566", "Chispa", false, 2900.0, None)],
            "recibidas": [per("77889900", "Duna", true, 0.0, None)], "enviadas": [per("12121212", "Rocco", false, 30.0, None)], "bloqueados": [] }));
        self.soc.sol = 1; self.soc.badge = 3;
        let ult = |tx: &str, min: f64| json!({ "texto": tx, "tipo": "t", "fecha": t - min * 60e3 });
        self.soc.chats = Some(vec![json!({ "id": "a1b2c3d4e5f60718", "tipo": "grupo", "nombre": "Los del server", "miembros": 4, "enLinea": 2, "otro": null, "ultimo": ult("¿Quién arma la pista de autos?", 2.0), "noLeidos": 2 }),
            json!({ "id": "1111222233334444", "tipo": "dm", "nombre": "Brasa", "miembros": 2, "otro": per("11223344", "Brasa", true, 0.0, None), "ultimo": ult("dale, entro en 5", 14.0), "noLeidos": 0 }),
            json!({ "id": "5555666677778888", "tipo": "dm", "nombre": "Vega", "miembros": 2, "otro": per("55667788", "Vega", true, 0.0, None), "ultimo": { "texto": "", "tipo": "inv", "fecha": t - 3600e3 }, "noLeidos": 1 })]);
        self.soc.rec = vec![json!({ "pid": "11223344", "nombre": "Brasa", "skin": "Hero" }), json!({ "pid": "99001122", "nombre": "Tomi", "skin": "Hero" })];
        self.soc.busc = Some(Some(json!({ "perfil": per("24681357", "Alas", true, 0.0, None), "rel": {} }))); self.soc.q = "24681357".into();
        if chat {
            self.soc.chat = Some("a1b2c3d4e5f60718".into()); self.soc.info = json!({ "id": "a1b2c3d4e5f60718", "tipo": "grupo", "nombre": "Los del server" });
            let msg = |id: i64, de: &str, mio: bool, tx: &str, min: f64| json!({ "id": id, "tipo": "t", "texto": tx, "mio": mio, "fecha": t - min * 60e3, "de": { "pid": "1", "nombre": de } });
            self.soc.msgs = vec![json!({ "id": 1, "tipo": "sis", "texto": "Brasa", "datos": { "k": "creo" }, "fecha": t - 90.0 * 60e3, "de": {} }), msg(2, "Brasa", false, "Buenas! armé el grupo para jugar a la noche", 80.0),
                msg(3, "Nico", true, "joya, yo llevo los autos", 60.0), msg(4, "Vega", false, "¿Quién arma la pista de autos? Yo puedo hacer la rampa gigante del mapa de la comunidad", 2.0),
                json!({ "id": 5, "tipo": "inv", "texto": "", "mio": false, "fecha": t - 60e3, "de": { "pid": "2", "nombre": "Vega" }, "datos": { "id": "s1", "n": "Server de Vega", "m": "RB_Flatgrass", "mods": 3 } })];
            self.soc.lei = 3; self.soc.esc = vec!["Brasa".into()];
        }
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn huella_y_base64() {
        assert_eq!(hex(&sha256(b"abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assert_eq!(hex(&sha256(b"")), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
        let largo = vec![b'a'; 1000]; assert_eq!(hex(&sha256(&largo)), "41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
        assert_eq!(b64url(b"\xfb\xff"), "-_8"); assert_eq!(b64url(b"hola"), "aG9sYQ"); assert_eq!(b64url(&[0u8; 32]).len(), 43);
    }
    #[test]
    fn freno_de_la_tienda() {
        let mut f = Freno::default(); let t = 1e6;
        f.anotar(Some(429), b"error code: 1027", t); f.anotar(None, b"", t); assert!(!f.frenada(t));
        f.anotar(Some(429), b"error code: 1027", t); assert!(f.frenada(t + 60e3) && !f.frenada(t + 121e3));
        f.anotar(Some(429), b"{\"error\":\"muchos\"}", t); assert!(!f.frenada(t));
    }
}
