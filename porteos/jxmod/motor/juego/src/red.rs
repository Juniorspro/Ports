//! El multijugador de la web (juego/red.js) en Rust: el mismo protocolo, para que los jugadores nativos y los de la web
//! estén en la misma sala. Sin entrada ni salida (se le dan los mensajes que llegan y el estado del juego; devuelve lo que
//! hay que publicar, las suscripciones, los pedidos HTTP y lo que pasó), así se prueba sin sockets; `Puente` lo conecta
//! a las conexiones MQTT de verdad (mqtt.rs) y a un HTTP.
//!
//! Como en la web: un broker MQTT público hace de relevo (broker.emqx.io; la web por wss en el 8084, el nativo por TLS en el
//! 8883: el broker junta los transportes y son los mismos temas). Temas de una sala (ROOM = jxmod_v1_ + la sala):
//! - ROOM/e: el estado de cada jugador (10 por segundo si cambia, uno por segundo quieto), con su reloj (rt) para
//!   dibujarlo entre dos muestras;
//! - ROOM/w/ID: sus cosas (retenido: el que entra las recibe; el testamento lo borra si se corta);
//! - ROOM/m: las cosas que se mueven (10 por segundo, hasta 40 propias y 50 en total);
//! - ROOM/a: los hechos (tiros, explosiones, daño, reclamos, borrar, los NPC, chau…);
//! - ROOM/c: el chat; ROOM/cfg: la configuración del anfitrión (retenida); ROOM/g y ROOM/gl: los addons de GMod.
//!
//! Y aparte, por otra conexión liviana, la presencia: jxmod_v1_l/ID (retenido, con testamento) dice en qué sala está cada
//! uno; con eso y la lista de servers de la tienda (HTTPS: GET/POST salas) se arma la lista de salas.
//! Cada uno simula lo suyo; si agarrás algo de otro, lo reclamás (a/claim) y desde ahí lo movés vos. No hay anfitrión
//! elegido: el «anfitrión» es el que creó el server (du) y manda cfg; el de número más chico avisa a la tienda que sigue vivo.
//!
//! # En el juego nativo (nativo/src/comun.rs)
//! - Campos: `red: Red` (`Red::nueva(None, nombre)`; `red.poner_mapas(&["RB_Construct", "RB_Flatgrass"], <los de DATA.esc>)`;
//!   `red.prefabs = Some(<los nombres de objetos::por_nombre>)`), `puente: Option<Puente>` (Android:
//!   `red_android::Java::puente()`; compu: `Puente::tcp()`), un `Local` que se rellena cada cuadro, los cuerpos de los
//!   demás (`HashMap<String, Personaje>`) y qué Obj es cada cosa de otro (`HashMap<String, u32>`: clave → Obj.id).
//! - Cada cuadro, después de la física (cuando `objs` ya tiene la pose del paso) y antes de armar `items`:
//!   `puente.bombear(&mut red)`; `local.jug` = el jugador (pos = jug.pos —el centro de la cápsula, como JUG.pos—, yaw,
//!   `pitch: -jug.pitch` —la web mira abajo con positivo—, vel, suelo, `agachado` = lo que se pide, vivo, vida,
//!   `arma: Some(ARMAS[armas.i].n)`, `skin`, `reloj` = la suma de los pasos de su física, `vehiculo` = (clave, asiento));
//!   `local.objs` = las cosas mías (Obj.id, nombre, la pose del cuerpo —la de la física, con capQ—, duerme, congelado);
//!   `local.simulo` = las de otros que reclamé (`objeto(clave).auth == red.id`) con la pose de mi física;
//!   `local.npcs` = mis NPC; `red.paso(dt, &local)`; los eventos (abajo); `puente.bombear(&mut red)` otra vez (sale ya).
//! - Los demás jugadores: por cada `remotos()` visible, su `Personaje` (cargado con su skin, o Hero si no está en el
//!   paquete), `animar(dt, &Estado { piso: [pos.x, pos.y - 0.95, pos.z], vel, yaw, mira, en_suelo: suelo, agachado,
//!   agua: None })` e `items(&personaje::base(piso, yaw), &mut items)`; el nombre (y `globo`) arriba con `vp_ult`. En un
//!   vehículo (`veh`), el cuerpo va al asiento. Los NPC de otros (`npcs_remotos()`), igual con su skin.
//! - Las cosas de otros: `ObjetoNuevo` → `crear(m, nombre, …, congelado)` y la pose exacta (`fis.poner(cuerpo, pos, q)`);
//!   cada cuadro, si `auth != red.id`, congelada en `objeto(clave).pos/q`; si la reclamé, libre (la mueve mi física).
//!   `ObjetoBorrado` → sacarla. Al agarrar una con la Physics/Gravity Gun (o una mía que simula otro: `auth_propio(id)`)
//!   → `reclamar(&clave)`: Some(congelada) dice cómo dejar su cuerpo. `PropioReclamado` → congelar la mía y ponerla
//!   cada cuadro en `cedido(id)`; `PropioBorrado` / `Limpiar` → borrar la mía / todas. Al poner, congelar o soldar algo
//!   mío: `objeto_cambio()`; al borrar: `borrar(&clave)`.
//! - Lo que hago: `disparo(arma, ojos, dir)` en cada tiro, `recarga()`, `explosion(p, r, daño, Some(clave))` (sólo las
//!   que nacen acá), `dano(id, daño, dir)` al pegarle a otro, `chat(texto, id)`.
//! - Lo que llega: `Disparo` (traza, impacto y sonido desde `o` por `dir`), `Explosion` (la explosión sin volver a
//!   mandarla), `Dano` (con PvP: vida y empujón), `Chat`/`Entro`/`Salio`/`Conectado` (al chat), `RevisarLugar` (si
//!   aparecí encima de alguien, a un lugar libre), `MapaAnfitrion` (cargar ese mapa y `empezar` de nuevo), `Echado` y
//!   `SalaCerrada` (al menú), `Cfg` (hora y ciclo del día), `Mias` (guardar `mias_json()`).
//! - La lista de salas (un panel «Multijugador»): `conectar_lista()` al abrirlo y `mirando_lista()` cada cuadro;
//!   `lista_salas()` da cada sala con quién juega (candado si `pw`); al tocar una: `entrar(&sala, None)` (Err: pedir la
//!   contraseña y `entrar(&sala, Some(clave))`, que se puede revisar antes con `sala.clave_ok`), cargar `sala.m` y, ya
//!   cargado, `empezar(antes)`; «Crear server»: `crear_servidor(&NuevaSala{…}, None)` → `SalaCreada` → igual; «Salir»:
//!   `dejar()`. `red.cfg.mapa` = el mapa que se juega (y la hora del día, si soy el anfitrión).
use crate::mqtt::{self, Conector, Conexion, Opciones, Suceso, Will};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::Arc;

pub const NS: &str = "jxmod_v1_";
/// el broker de la web (mqtt.js por WebSocket)
pub const BROKER_WEB: &str = "wss://broker.emqx.io:8084/mqtt";
/// el mismo broker por TLS (lo que usa el nativo: los mismos temas que la web)
pub const BROKER: &str = "mqtts://broker.emqx.io:8883";
/// la tienda del juego (la lista de servers creados)
pub const TIENDA_URL: &str = "https://rezobox-tienda.holasoyjuniors365.workers.dev/api/";
/// los mapas de las salas oficiales de la versión pública (MAPAS y MAPAS_RB de mundo.js; en la personal sólo los dos RB de GMod)
pub const MAPAS_PUBLICA: [&str; 16] = ["Desert", "DesertV2", "FlatGrass", "City", "Base", "BaseV2", "Mars", "Space", "RB_Llanura", "RB_Colinas", "RB_Isla", "RB_Ciudad", "RB_Desierto", "RB_Luna", "RB_Construct", "RB_Flatgrass"];
const GRAV: f64 = 9.81;

// ---------------- las cuentas de JavaScript (para mandar lo mismo, byte por byte) ----------------
/// Math.round (los empates para arriba)
pub fn js_round(x: f64) -> f64 { if !x.is_finite() { return x; } let f = x.floor(); let r = if x - f >= 0.5 { f + 1.0 } else { f }; if r == 0.0 && x < 0.0 { -0.0 } else { r } }
/// r3 y r4 de red.js
pub fn r3(v: f64) -> f64 { js_round(v * 1000.0) / 1000.0 }
pub fn r4(v: f64) -> f64 { js_round(v * 10000.0) / 10000.0 }
/// un número como lo escribe JSON.stringify (y String(): lo más corto que vuelve al mismo número)
pub fn js_num(x: f64) -> String {
    if !x.is_finite() { return "null".into(); }
    if x == 0.0 { return "0".into(); }
    let a = x.abs();
    if !(1e-6..1e21).contains(&a) {
        let s = format!("{x:e}");
        match s.split_once('e') { Some((m, e)) if !e.starts_with('-') => format!("{m}e+{e}"), _ => s }
    } else { format!("{x}") }
}
/// un texto como lo escribe JSON.stringify
pub fn js_str(s: &str) -> String {
    let mut o = String::with_capacity(s.len() + 2); o.push('"');
    for c in s.chars() {
        match c {
            '"' => o.push_str("\\\""), '\\' => o.push_str("\\\\"), '\u{8}' => o.push_str("\\b"), '\u{c}' => o.push_str("\\f"),
            '\n' => o.push_str("\\n"), '\r' => o.push_str("\\r"), '\t' => o.push_str("\\t"),
            c if (c as u32) < 0x20 => o.push_str(&format!("\\u{:04x}", c as u32)),
            c => o.push(c),
        }
    }
    o.push('"'); o
}
fn v3j(v: [f64; 3], r: fn(f64) -> f64) -> String { format!("[{},{},{}]", js_num(r(v[0])), js_num(r(v[1])), js_num(r(v[2]))) }
/// ¿es «verdadero» en JavaScript?
pub fn verdad(v: Option<&Value>) -> bool {
    match v { None | Some(Value::Null) => false, Some(Value::Bool(b)) => *b, Some(Value::Number(n)) => n.as_f64().map(|x| x != 0.0 && !x.is_nan()).unwrap_or(false), Some(Value::String(s)) => !s.is_empty(), Some(_) => true }
}
/// String(v) de JavaScript
pub fn js_string(v: Option<&Value>) -> String {
    match v {
        None => "undefined".into(), Some(Value::Null) => "null".into(), Some(Value::Bool(b)) => b.to_string(), Some(Value::Number(n)) => js_num(n.as_f64().unwrap_or(0.0)),
        Some(Value::String(s)) => s.clone(), Some(Value::Array(a)) => a.iter().map(|x| if x.is_null() { String::new() } else { js_string(Some(x)) }).collect::<Vec<_>>().join(","),
        Some(Value::Object(_)) => "[object Object]".into(),
    }
}
/// ToNumber de JavaScript (lo justo: números, textos, verdadero/falso, nada)
fn js_numero(v: Option<&Value>) -> f64 {
    match v {
        None => f64::NAN, Some(Value::Null) => 0.0, Some(Value::Bool(b)) => *b as u8 as f64, Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
        Some(Value::String(s)) => { let t = js_trim(s); if t.is_empty() { 0.0 } else if let Some(h) = t.strip_prefix("0x").or_else(|| t.strip_prefix("0X")) { i64::from_str_radix(h, 16).map(|x| x as f64).unwrap_or(f64::NAN) } else if t == "Infinity" || t == "+Infinity" { f64::INFINITY } else if t == "-Infinity" { f64::NEG_INFINITY } else if t.contains(|c: char| c.is_ascii_alphabetic() && c != 'e' && c != 'E') { f64::NAN } else { t.parse::<f64>().unwrap_or(f64::NAN) } }
        Some(Value::Array(a)) if a.is_empty() => 0.0, Some(Value::Array(a)) if a.len() == 1 => js_numero(Some(&Value::String(js_string(a.first())))),
        Some(_) => f64::NAN,
    }
}
/// v | 0
pub fn int32(v: Option<&Value>) -> i32 {
    let n = js_numero(v); if !n.is_finite() { return 0; }
    let m = n.trunc().rem_euclid(4294967296.0); (if m >= 2147483648.0 { m - 4294967296.0 } else { m }) as i32
}
/// num() de red.js: un número de verdad entre a y b, o d
pub fn num(v: Option<&Value>, a: f64, b: f64, d: f64) -> f64 { match v.and_then(|x| x.as_f64()) { Some(x) if x.is_finite() => x.max(a).min(b), _ => d } }
fn js_trim(s: &str) -> &str {
    let es = |c: char| matches!(c, '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}');
    s.trim_matches(es)
}
/// los primeros n de un texto, contados como JavaScript (UTF-16)
pub fn corte16(s: &str, n: usize) -> String { let mut k = 0; s.chars().take_while(|c| { k += c.len_utf16(); k <= n }).collect() }
fn largo16(s: &str) -> usize { s.encode_utf16().count() }
/// limpio() de red.js: sin caracteres de control ni <>&"'`\, sin espacios a los lados y de n como mucho (16 si no se dice)
pub fn limpio(v: Option<&Value>, n: usize) -> String { let s = if verdad(v) { js_string(v) } else { String::new() }; limpio_txt(&s, n) }
pub fn limpio_txt(s: &str, n: usize) -> String {
    let s: String = s.chars().filter(|&c| !((c as u32) < 0x20 || "<>&\"'`\\".contains(c))).collect();
    corte16(js_trim(&s), if n == 0 { 16 } else { n })
}
fn base36(mut n: u64) -> String { if n == 0 { return "0".into(); } let mut v = vec![]; while n > 0 { v.push(b"0123456789abcdefghijklmnopqrstuvwxyz"[(n % 36) as usize]); n /= 36; } v.reverse(); String::from_utf8(v).unwrap() }
/// hashTxt de red.js (FNV-1a de 32 bits sobre UTF-16, en base 36): la clave de una sala y el tema de una con contraseña
pub fn hash_txt(s: &str) -> String { let mut h: u32 = 2166136261; for u in s.encode_utf16() { h ^= u as u32; h = h.wrapping_mul(16777619); } base36(h as u64) }
/// +x.toFixed(3) (los empates exactos para el lado de afuera, como JavaScript)
pub fn to_fixed3(x: f64) -> f64 {
    if !x.is_finite() { return x; }
    let y = x * 16.0; // (los únicos empates exactos a la milésima: múltiplos impares de 1/16)
    if y.fract() == 0.0 && (y as i64) % 2 != 0 { return (x.abs() * 1000.0 + 0.5).floor() / 1000.0 * x.signum(); }
    format!("{x:.3}").parse().unwrap_or(x)
}
fn qnorm(q: [f64; 4]) -> [f64; 4] { let l = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt(); let l = if l != 0.0 && !l.is_nan() { l } else { 1.0 }; [q[0] / l, q[1] / l, q[2] / l, q[3] / l] }
fn dist(a: [f64; 3], b: [f64; 3]) -> f64 { let (x, y, z) = (a[0] - b[0], a[1] - b[1], a[2] - b[2]); (x * x + y * y + z * z).sqrt() }
fn lerp3(a: &mut [f64; 3], b: [f64; 3], k: f64) { for i in 0..3 { a[i] += (b[i] - a[i]) * k; } }
/// Quat.slerpTo de nucleo.js
pub fn slerp(a: [f64; 4], b: [f64; 4], t: f64) -> [f64; 4] {
    let (mut bx, mut by, mut bz, mut bw) = (b[0], b[1], b[2], b[3]); let mut c = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
    if c < 0.0 { c = -c; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    let (k0, k1) = if c > 0.9995 { (1.0 - t, t) } else { let o = c.acos(); let s = o.sin(); (((1.0 - t) * o).sin() / s, (t * o).sin() / s) };
    qnorm([a[0] * k0 + bx * k1, a[1] * k0 + by * k1, a[2] * k0 + bz * k1, a[3] * k0 + bw * k1])
}
fn arr3(v: Option<&Value>, a: f64, b: f64, d: [f64; 3]) -> [f64; 3] { [num(v.and_then(|x| x.get(0)), a, b, d[0]), num(v.and_then(|x| x.get(1)), a, b, d[1]), num(v.and_then(|x| x.get(2)), a, b, d[2])] }
fn es_id(s: &str, n0: usize, n1: usize) -> bool { (n0..=n1).contains(&s.len()) && s.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit()) }
fn es_hex_color(s: &str) -> bool { s.len() == 7 && s.starts_with('#') && s[1..].bytes().all(|b| b.is_ascii_hexdigit()) }
fn digitos(s: &str, a: usize, b: usize) -> bool { (a..=b).contains(&s.len()) && s.bytes().all(|b| b.is_ascii_digit()) }
fn es_ws(m: &str) -> bool { m.strip_prefix("WS_").map(|r| (1..=40).contains(&r.len()) && r.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')).unwrap_or(false) }

// ---------------- las salas ----------------
/// de dónde salió una sala (cambia el orden de sus campos en el JSON, como en la web)
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum Forma { #[default] Oficial, Limpia, Creada, Lan }
/// una sala (SALA de red.js): las oficiales (una por mapa), las que crean los jugadores (de la tienda o de la presencia)
/// y las de la red local
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Sala {
    pub id: String, pub n: String, pub m: String, pub mw: String, pub mo: String, pub of: bool, pub rg: bool,
    pub pvp: bool, pub rpg: bool, pub nb: bool, pub mp: i32, pub mv: i32, pub pw: bool, pub ph: String, pub du: String, pub dn: String,
    /// cuándo hubo alguien por última vez (ms, de la tienda), la contraseña que se escribió y la dirección del broker de la red local
    pub vivo: Option<f64>, pub clave: String, pub lan: Option<String>,
    pub forma: Forma,
}
fn b01(b: bool) -> &'static str { if b { "1" } else { "0" } }
impl Sala {
    /// una sala oficial (SALAS_OF)
    pub fn oficial(m: &str) -> Sala {
        Sala { id: format!("f_{m}_1"), n: format!("JXMod {}", m.strip_prefix("RB_").unwrap_or(m)), m: m.into(), mo: "Free".into(), of: true, pvp: true, rpg: true, nb: true, mp: 1000, mv: 40, forma: Forma::Oficial, ..Sala::default() }
    }
    /// la sala de una partida en la red local (lanSala de lan.js): `url` es el broker del anfitrión (ws://IP:8765/mqtt)
    pub fn lan(du: &str, nombre_host: &str, nombre_sala: &str, mapa: &str, url: &str) -> Sala {
        Sala { id: format!("lan{du}"), n: nombre_sala.into(), m: mapa.into(), mo: "Free".into(), pvp: true, rpg: true, nb: true, mp: 1000, mv: 40, du: du.into(), dn: nombre_host.into(), lan: Some(url.into()), forma: Forma::Lan, ..Sala::default() }
    }
    /// el JSON (sin la contraseña), con los campos en el orden de la web
    pub fn json(&self) -> String {
        let vivo = self.vivo.map(|v| format!(",\"vivo\":{}", js_num(v))).unwrap_or_default();
        match self.forma {
            Forma::Oficial => format!("{{\"id\":{},\"n\":{},\"m\":{},\"mo\":{},\"of\":{},\"pvp\":{},\"rpg\":{},\"nb\":{},\"mp\":{},\"mv\":{}}}", js_str(&self.id), js_str(&self.n), js_str(&self.m), js_str(&self.mo), b01(self.of), b01(self.pvp), b01(self.rpg), b01(self.nb), self.mp, self.mv),
            Forma::Limpia => format!("{{\"id\":{},\"n\":{},\"m\":{},\"mw\":{},\"mo\":{},\"of\":{},\"rg\":{},\"pvp\":{},\"rpg\":{},\"nb\":{},\"mp\":{},\"mv\":{},\"pw\":{},\"ph\":{},\"du\":{},\"dn\":{}{vivo}}}",
                js_str(&self.id), js_str(&self.n), js_str(&self.m), js_str(&self.mw), js_str(&self.mo), b01(self.of), b01(self.rg), b01(self.pvp), b01(self.rpg), b01(self.nb), self.mp, self.mv, b01(self.pw), js_str(&self.ph), js_str(&self.du), js_str(&self.dn)),
            Forma::Creada => format!("{},\"rg\":{}{vivo}}}", self.json_crear(), b01(self.rg)),
            Forma::Lan => format!("{{\"id\":{},\"n\":{},\"m\":{},\"mo\":\"Free\",\"of\":0,\"rg\":0,\"pvp\":1,\"rpg\":1,\"nb\":1,\"mp\":1000,\"mv\":40,\"pw\":0,\"du\":{},\"dn\":{},\"lan\":{}}}", js_str(&self.id), js_str(&self.n), js_str(&self.m), js_str(&self.du), js_str(&self.dn), js_str(self.lan.as_deref().unwrap_or(""))),
        }
    }
    /// lo que se manda a la tienda al crearla (sin cerrar la llave)
    fn json_crear(&self) -> String {
        let mw = if self.mw.is_empty() { String::new() } else { format!(",\"mw\":{}", js_str(&self.mw)) };
        format!("{{\"n\":{},\"m\":{},\"mo\":{},\"of\":0,\"pvp\":{},\"rpg\":{},\"nb\":{},\"mp\":{},\"mv\":{},\"pw\":{},\"du\":{},\"dn\":{}{mw},\"id\":{},\"ph\":{}",
            js_str(&self.n), js_str(&self.m), js_str(&self.mo), b01(self.pvp), b01(self.rpg), b01(self.nb), self.mp, self.mv, b01(self.pw), js_str(&self.du), js_str(&self.dn), js_str(&self.id), js_str(&self.ph))
    }
    /// el tema de la sala (topicoSala): las oficiales por su id; las otras con r_ y, con contraseña, un hash de ella
    pub fn topico(&self) -> String {
        if self.of { format!("{NS}{}", self.id) } else if self.clave.is_empty() { format!("{NS}r_{}", self.id) } else { format!("{NS}r_{}_{}", self.id, hash_txt(&format!("k{}{}", self.id, self.clave))) }
    }
    /// ¿es la contraseña? (comprobarClave)
    pub fn clave_ok(&self, clave: &str) -> bool { hash_txt(&format!("c{}{}", self.id, clave)) == self.ph }
}
/// salaLimpia de red.js: una sala que llegó de la red (o de la tienda), revisada; las oficiales sólo si existen
pub fn sala_limpia(x: Option<&Value>, oficiales: &[Sala], mapas: &[String]) -> Option<Sala> {
    let x = x?; let id = x.get("id")?.as_str()?;
    if !(3..=40).contains(&id.len()) || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_') { return None; }
    let s = |k: &str| x.get(k).and_then(|v| v.as_str());
    let mw = s("mw").filter(|m| digitos(m, 3, 12)).unwrap_or("").to_string();
    let m0 = s("m"); let ws = m0.map(es_ws).unwrap_or(false) && !mw.is_empty();
    let valido = m0.map(|m| mapas.iter().any(|x| x == m)).unwrap_or(false);
    if verdad(x.get("of")) { return oficiales.iter().find(|o| o.id == id).cloned(); }
    let n = limpio(x.get("n"), 24);
    Some(Sala {
        id: id.into(), n: if n.is_empty() { "Server".into() } else { n }, m: if valido || ws { m0.unwrap_or("").into() } else { "Desert".into() }, mw: if ws { mw } else { String::new() },
        mo: if s("mo") == Some("PvP") { "PvP".into() } else { "Free".into() }, of: false, rg: verdad(x.get("rg")),
        pvp: verdad(x.get("pvp")), rpg: verdad(x.get("rpg")), nb: verdad(x.get("nb")), mp: num(x.get("mp"), 0.0, 5000.0, 1000.0) as i32, mv: num(x.get("mv"), 0.0, 200.0, 40.0) as i32,
        pw: verdad(x.get("pw")), ph: s("ph").map(|p| corte16(p, 12)).unwrap_or_default(), du: s("du").filter(|d| es_id(d, 3, 20)).unwrap_or("").into(), dn: limpio(x.get("dn"), 16),
        vivo: None, clave: String::new(), lan: None, forma: Forma::Limpia,
    })
}

// ---------------- lo que entra y sale ----------------
/// las dos conexiones de la web: la de la sala y la liviana de la presencia (la lista de salas)
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Con { Lista, Sala }
/// lo que hay que hacer afuera (MQTT y HTTP)
#[derive(Clone, Debug)]
pub enum Orden {
    /// abrir (o reabrir) esa conexión: cerrar la anterior, si hay
    Conectar(Con, Opciones),
    Suscribir(Con, String), Desuscribir(Con, String),
    Publicar { con: Con, topic: String, payload: String, retain: bool },
    /// lo mismo en binario (la voz por cercanía de la nativa: ROOM/v/ID)
    PublicarBin { con: Con, topic: String, payload: Vec<u8> },
    /// despedirse (DISCONNECT) después de mandar lo pendiente
    Cerrar(Con),
    /// un pedido HTTPS (la tienda); la respuesta vuelve con `Red::http_respuesta(id, …)`
    Http { id: u32, metodo: &'static str, url: String, cabeceras: Vec<(String, String)>, cuerpo: Option<String> },
}
/// lo que pasó (para el juego)
#[derive(Clone, Debug, PartialEq)]
pub enum Evento {
    /// la conexión de la sala: conectado (el «Connected: sala» del chat) o cortado (se reconecta sola)
    Conectado { sala: String }, Desconectado,
    /// entró o salió alguien (los «X entró» y «X salió» del chat)
    Entro { id: String, nombre: String }, Salio { id: String, nombre: String },
    /// volvió con otro número (se le reabrió la app): el de antes pasa a ser él
    Reemplazo { viejo: String, nuevo: String },
    Chat { de: String, nombre: String, texto: String, id: Option<String> },
    /// un tiro de otro (desde sus ojos, hacia donde apunta) y su recarga
    Disparo { de: String, arma: Option<String>, o: [f64; 3], dir: [f64; 3] }, Recarga { de: String },
    /// una explosión de otro (del tamaño que tuvo en su juego); `fuente`: la cosa que explotó (ya se borró aparte)
    Explosion { de: String, p: [f64; 3], r: f64, dano: f64, fuente: Option<String> },
    /// me pegaron (con PvP): el daño y el empujón para sumar a la velocidad
    Dano { de: String, dano: f64, empuje: Option<[f64; 3]> },
    /// una cosa de otro: apareció (crearla congelada; `objeto(clave)` dice dónde va cada cuadro) o se fue
    ObjetoNuevo { clave: String, nombre: String, dueno: String, pos: [f64; 3], q: [f64; 4], congelado: bool }, ObjetoBorrado { clave: String },
    /// una cosa mía la agarró otro: congelarla y ponerla donde dice `cedido(id)` hasta que la reclame de nuevo
    PropioReclamado { id: u32, por: String },
    /// una cosa mía se borró (la borró otro, explotó en su juego o el anfitrión limpió el mapa: entonces llega `Limpiar`)
    PropioBorrado { id: u32 },
    /// las entidades y los mods de otro (w/ID: entidadesRecibir, smDeOtro) y el juego de una maquinita
    Entidades { de: String, e: Value }, Mods { de: String, md: Value }, Maquinita { clave: String, d: Value },
    /// la configuración del anfitrión (hora, ciclo, sin spawn) y el mapa que juega (si es otro: cargarlo y volver a `empezar`)
    Cfg { hora: f64, ciclo: bool, ds: bool }, MapaAnfitrion { m: String, mw: String },
    /// el anfitrión me echó / limpió el mapa (borrar todas mis cosas)
    Echado, Limpiar,
    /// el server se cerró (se borró de la tienda): volver al menú
    SalaCerrada { nombre: String },
    /// hay que mirar si donde aparecí está libre (redLugarRevisar: de 1,5 a 9 s después de conectar y si llega alguien)
    RevisarLugar,
    /// los NPC de otro: se fue uno, dice algo; a los míos: les pegaron, cambiaron de actitud
    NpcFin { clave: String }, NpcDice { clave: String, texto: String }, NpcDano { n: i32, de: String, dano: f64, v: [f64; 3], tumba: bool }, NpcAct { n: i32, de: String, a: Value },
    /// ROOM/g y ROOM/gl (los addons de GMod del server)
    Gmod { sub: String, de: String, d: Value },
    /// otro hecho (ROOM/a) que esto no maneja: voz, Verity, maquinitas, memes, juntos, puertas…
    Hecho { de: String, k: String, d: Value },
    /// un pedazo de la voz de otro (ROOM/v/ID, la de la nativa: ADPCM en binario)
    Voz { de: String, datos: Vec<u8> },
    /// la lista de salas cambió (presencia o tienda)
    Lista,
    /// las salas mías cambiaron (guardarlas: `mias_json`)
    Mias,
    /// se creó el server pedido (registrado en la tienda o temporal): cargar su mapa y `empezar`
    SalaCreada { sala: Sala },
    SalaBorrada { id: String, ok: bool },
    /// algo para avisar en la pantalla
    Aviso(String),
}

/// lo que el juego tiene de su jugador (lo de «e»)
#[derive(Clone, Debug, Default)]
pub struct Jugador {
    /// el personaje (pillSkin, skinRol, skinMod o el elegido), su addon del Workshop (kw; None: 0), el gorro (PREFS.gorro)
    pub skin: String, pub skin_wid: Option<String>, pub gorro: String,
    /// el ajuste del gorro y el accesorio (JSON tal cual; vacío: 0)
    pub gorro_aj: String, pub acc: String,
    /// caminando por las paredes (NAT.scp): para dónde es arriba; el color del rol (#rrggbb)
    pub arriba: Option<[f64; 3]>, pub color: Option<String>,
    pub pos: [f64; 3], pub yaw: f64, pub pitch: f64, pub vel: [f64; 3],
    pub suelo: bool, pub agachado: bool, pub vivo: bool,
    /// las otras banderas (16 volando, 32 muñeco, 64 por las paredes, 128 linterna, 256 no se ve)
    pub bits: i32,
    /// el arma en la mano (ARM.lista[ARM.i]; None: no va) y el emote
    pub arma: Option<String>, pub emote: Option<String>, pub vida: f64,
    /// la música del emote (emuRed), Verity (verRedEstado) y Pill Packs (pillRed): JSON tal cual (vacío: 0 / no va)
    pub musica: String, pub verity: String, pub pill: String,
    /// el vehículo (la clave de la cosa: `clave_propia(id)` o la de otro) y el asiento
    pub vehiculo: Option<(String, i32)>,
    /// el ID de Social (8 números) y el reloj de su física (J.reloj: segundos de física, para que lo dibujen entre muestras)
    pub social: Option<String>, pub reloj: f64,
    /// manda y escucha la voz por cercanía de la nativa (ROOM/v/ID): «vz»
    pub voz: bool,
}
/// una cosa mía (de OBJS)
#[derive(Clone, Debug, Default)]
pub struct ObjLocal {
    pub id: u32, pub nombre: String, pub pos: [f64; 3], pub q: [f64; 4], pub duerme: bool, pub congelado: bool,
    /// el juego de la maquinita (maqAlMundo: JSON tal cual; vacío: 0) y si no va en w (los nextbots de GMod)
    pub maq: String, pub no_mundo: bool,
}
/// lo que se recuerda de una cosa mía del último cuadro
#[derive(Clone, Copy, Debug, Default)]
struct ObjMin { id: u32, pos: [f64; 3], q: [f64; 4], congelado: bool }
/// una cosa de otro que simulo yo (la reclamé)
#[derive(Clone, Debug, Default)]
pub struct SimRemoto { pub clave: String, pub pos: [f64; 3], pub q: [f64; 4], pub duerme: bool }
/// un NPC mío (npcRedMandar)
#[derive(Clone, Debug, Default)]
pub struct NpcLocal {
    pub id: i32, pub skin: String, pub pos: [f64; 3], pub yaw: f64, pub vel: [f64; 3],
    /// 1 pisa, 2 muñeco, 4 muerto, 8 hostil, 16 defiende, 32 escondido
    pub f: i32, pub emote: String, pub arma: String, pub tiros: u32, pub mira: Option<[f64; 3]>,
}
/// lo del juego en este cuadro
#[derive(Clone, Debug, Default)]
pub struct Local {
    pub jug: Jugador, pub objs: Vec<ObjLocal>, pub simulo: Vec<SimRemoto>, pub npcs: Vec<NpcLocal>,
    /// mis entidades (entidadesMias) y mis mods (SMOD.ids): JSON tal cual (vacío: [])
    pub entidades: String, pub mods: String,
}
/// lo del anfitrión (hostCfg): la hora y el ciclo del día, «sin spawn» y el mapa que se juega
#[derive(Clone, Debug, Default)]
pub struct Cfg { pub hora: f64, pub ciclo: bool, pub ds: bool, pub mapa: String, pub mapa_w: Option<String> }
/// los dos relojes: el de verdad (performance.now()/1000, para dibujar a los demás) y la fecha (Date.now(), en ms)
#[derive(Clone, Copy, Debug, Default)]
pub struct Reloj { pub real: f64, pub epoca_ms: f64 }
impl Reloj {
    pub fn sistema() -> Reloj {
        use std::sync::OnceLock; static T0: OnceLock<std::time::Instant> = OnceLock::new();
        let t0 = T0.get_or_init(std::time::Instant::now);
        Reloj { real: 1.0 + t0.elapsed().as_secs_f64(), epoca_ms: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as f64).unwrap_or(0.0) }
    }
}

/// una muestra del estado de otro jugador (con su reloj)
#[derive(Clone, Copy, Debug)]
struct Muestra { rt: f64, p: [f64; 3], v: [f64; 3], f: i32, lleg: f64 }
/// otro jugador (R2 de red.js): lo que manda y dónde se lo dibuja
#[derive(Clone, Debug)]
pub struct Remoto {
    pub id: String, pub nombre: String,
    /// el personaje tal como llegó (si no lo tenés: el Hero), su addon del Workshop y el gorro (si no lo tenés: HatEmpty)
    pub skin: String, pub skin_wid: String, pub gorro: String, pub gorro_aj: Value, pub acc: Value, pub color: String,
    /// dónde dibujarlo (los pies a 0,9 m abajo, como JUG.pos), para dónde mira, la mirada (pitch), su velocidad y si pisa
    pub pos: [f64; 3], pub yaw: f64, pub mira: f64, pub vel: [f64; 3], pub suelo: bool,
    pub agachado: bool, pub sentado: bool, pub vivo: bool, pub rag: bool, pub visible: bool,
    pub f: i32, pub hp: f64, pub arma: Option<String>, pub emote: Option<String>,
    /// en un vehículo: la clave de la cosa y el asiento (el cuerpo va al asiento)
    pub veh: Option<(String, i32)>, pub arriba: Option<[f64; 3]>,
    pub musica: Option<Value>, pub verity: Option<Value>, pub pill: Option<Value>, pub social: Option<String>,
    /// escucha la voz por cercanía de la nativa («vz»)
    pub voz: bool,
    /// el globito del chat y hasta cuándo (tiempo del juego)
    pub globo: Option<String>, pub globo_hasta: f64,
    /// cuándo llegó (los primeros 3 s no empuja a nadie) y su último estado
    pub nace: f64, pub t: f64,
    meta: [f64; 3], vel_red: [f64; 3], yaw_m: f64,
    mm: Option<Vec<Muestra>>, mm_h: Option<Vec<(f64, f64)>>, rr: Option<f64>, rr_err: f64, mm_t: f64, mm_rit: f64, mm_rit_s: f64, mm_int: f64, mm_jit: f64, mm_v: [f64; 3], mm_f: i32,
}
impl Remoto {
    fn nuevo(id: &str, t: f64) -> Remoto {
        Remoto { id: id.into(), nombre: String::new(), skin: "Hero".into(), skin_wid: String::new(), gorro: "HatEmpty".into(), gorro_aj: Value::Null, acc: Value::Null, color: String::new(),
            pos: [0.0; 3], yaw: 0.0, mira: 0.0, vel: [0.0; 3], suelo: false, agachado: false, sentado: false, vivo: true, rag: false, visible: true, f: 0, hp: 100.0, arma: None, emote: None,
            veh: None, arriba: None, musica: None, verity: None, pill: None, social: None, voz: false, globo: None, globo_hasta: 0.0, nace: t, t,
            meta: [0.0; 3], vel_red: [0.0; 3], yaw_m: 0.0, mm: None, mm_h: None, rr: None, rr_err: 0.0, mm_t: 0.0, mm_rit: 0.0, mm_rit_s: 0.0, mm_int: 0.0, mm_jit: 0.0, mm_v: [0.0; 3], mm_f: 0 }
    }
    /// la cápsula de choque recién llegado no empuja (3 s)
    pub fn recien(&self, t: f64) -> bool { t - self.nace < 3.0 }
}
/// una cosa de otro (RED.objs)
#[derive(Clone, Debug)]
pub struct ObjRemoto {
    pub clave: String, pub nombre: String, pub dueno: String,
    /// quién la simula (el dueño, otro que la reclamó, o yo: entonces la física la mueve el juego y se manda en «m»)
    pub auth: String,
    /// dónde va (si no la simulo yo: hacia lo último que llegó, suave) y si su dueño la tiene congelada
    pub pos: [f64; 3], pub q: [f64; 4], pub cong_real: bool, pub duerme: bool, pub exploto: bool, pub borrado: bool,
    meta: ([f64; 3], [f64; 4]), seq: u64,
}
/// una cosa mía que simula otro
#[derive(Clone, Debug)]
struct Cedido { id: u32, pos: [f64; 3], q: [f64; 4], meta: ([f64; 3], [f64; 4]), cong_real: bool }
/// un NPC de otro (NPC.rem de npc.js)
#[derive(Clone, Debug)]
pub struct NpcRemoto {
    pub clave: String, pub de: String, pub n: i32, pub skin: String,
    pub pos: [f64; 3], pub yaw: f64, pub vel: [f64; 3], pub suelo: bool, pub rag: bool, pub vivo: bool, pub hostil: bool, pub bueno: bool, pub oculto: bool,
    pub arma: Option<String>, pub emote: Option<String>,
    /// los tiros que hizo desde el último envío (se ven salir a su ritmo) y a dónde
    pub tiros: u32, pub mira: Option<[f64; 3]>,
    /// las banderas que manda su dueño (1 pisa, 2 muñeco, 4 muerto, 8 hostil, 16 defiende, 32 escondido)
    pub f: i32,
    meta: [f64; 3], yaw_m: f64, t: f64,
}
/// la presencia de uno (en qué sala está)
#[derive(Clone, Debug)]
pub struct Presencia { pub s: Sala, pub j: String, pub t: f64 }
/// un server mío (lo que guarda el navegador en rb_salas_mias: la clave para borrarlo y la contraseña)
#[derive(Clone, Debug, Default, PartialEq)]
pub struct SalaMia { pub clave: String, pub pw: String, pub t: f64 }
/// la sala tiene contraseña: hay que pedirla (`Red::entrar`)
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PideClave;
/// para crear un server (lo elegido en el panel: crearServidor)
#[derive(Clone, Debug, Default)]
pub struct NuevaSala { pub n: String, pub pw: String, pub m: String, pub mo: String, pub pvp: bool, pub rpg: bool, pub nb: bool, pub mp: f64, pub mv: f64, pub mw: Option<String> }
#[derive(Clone, Debug)]
enum QueHttp { Vivo, Salas, Cerrada, Crear { s: Sala, clave: String, intento: u32, token: Option<String> }, Borrar { s: Sala, mia: SalaMia } }
#[derive(Clone, Debug, Default)]
struct Lugar { t0: f64, conectado: bool, revisar_t: f64, hasta_t: f64, mando: bool }
#[derive(Clone, Debug)]
struct Registro { l: Vec<Sala>, t: f64, dif: f64, vacia: f64, cargando: bool, ok: bool }

/// El multijugador (RED, LISTA, SALA y SALAS_REG de red.js). Cada cuadro: `paso` con lo del juego; lo que llega:
/// `conectado`, `desconectado`, `mensaje`, `http_respuesta`; lo que sale: `ordenes` y `eventos`.
pub struct Red {
    /// mi número en la red (como idRed: 9 letras y números) y mi nombre (PREFS.nombre)
    pub id: String, pub nombre: String,
    /// el broker (por defecto el de la web por TLS) y la tienda
    pub broker: String, pub tienda: String,
    /// los mapas que se pueden jugar (mapaValido) y las salas oficiales
    pub mapas: Vec<String>, pub oficiales: Vec<Sala>,
    /// los nombres de los prefabs que existen (si se da: las cosas de otros con un nombre que no está, no se crean)
    pub prefabs: Option<HashSet<String>>,
    /// la gravedad del mapa (MUNDO.gravedad: 1 la de siempre)
    pub gravedad: f64,
    pub reloj: Box<dyn Fn() -> Reloj + Send>,
    /// lo del anfitrión (si soy el anfitrión se manda en cfg) y mis servers (salasMias)
    pub cfg: Cfg, pub mias: HashMap<String, SalaMia>,
    /// la sala donde estoy (o la elegida) y su tema
    pub sala: Option<Sala>, pub room: String,
    /// conectado a la sala (RED.on) y a la lista (LISTA.on)
    pub on: bool, pub lista_on: bool,
    sala_abierta: bool, lista_abierta: bool,
    /// el tiempo del juego (TIEMPO.t: lo que suman los dt de `paso`)
    pub t: f64,
    ult_e: f64, ult_m: f64, ult_w: f64, w_sucio: bool, e_ant: String, ult_p: f64, t_vivo: f64, t_cfg: f64, npc_t: f64,
    lugar: Option<Lugar>, antes: Option<String>, mapa_va: Option<String>,
    remotos: Vec<Remoto>, objs: HashMap<String, ObjRemoto>, seq: u64, propios_auth: HashMap<u32, String>, cedidos: Vec<Cedido>, expl: HashMap<String, f64>,
    npcs_rem: Vec<NpcRemoto>, pres: Vec<(String, Presencia)>, reg: Registro,
    ult_objs: Vec<ObjMin>,
    ordenes: Vec<Orden>, eventos: Vec<Evento>, http_sig: u32, http_pend: HashMap<u32, QueHttp>, creando: bool, azar: u64,
    /// (pruebas) los números de los servers que se crean, en vez de al azar
    pub ids_prueba: Vec<String>,
}

impl Red {
    /// `id`: mi número (None: uno nuevo, como idRed); `nombre`: el del jugador
    pub fn nueva(id: Option<&str>, nombre: &str) -> Red {
        let r = Reloj::sistema();
        let mut red = Red { id: String::new(), nombre: nombre.into(), broker: BROKER.into(), tienda: TIENDA_URL.into(),
            mapas: MAPAS_PUBLICA.iter().map(|s| s.to_string()).collect(), oficiales: MAPAS_PUBLICA.iter().map(|m| Sala::oficial(m)).collect(), prefabs: None, gravedad: 1.0,
            reloj: Box::new(Reloj::sistema), cfg: Cfg::default(), mias: HashMap::new(), sala: None, room: String::new(), on: false, lista_on: false, sala_abierta: false, lista_abierta: false,
            t: 0.0, ult_e: 0.0, ult_m: 0.0, ult_w: 0.0, w_sucio: false, e_ant: String::new(), ult_p: 0.0, t_vivo: 0.0, t_cfg: 0.0, npc_t: 0.0, lugar: None, antes: None, mapa_va: None,
            remotos: vec![], objs: HashMap::new(), seq: 0, propios_auth: HashMap::new(), cedidos: vec![], expl: HashMap::new(), npcs_rem: vec![], pres: vec![],
            reg: Registro { l: vec![], t: -1e9, dif: 0.0, vacia: 600e3, cargando: false, ok: false }, ult_objs: vec![],
            ordenes: vec![], eventos: vec![], http_sig: 0, http_pend: HashMap::new(), creando: false, ids_prueba: vec![],
            azar: (r.epoca_ms as u64) ^ ((r.real * 1e9) as u64).rotate_left(29) ^ 0x9e37_79b9_7f4a_7c15 };
        red.id = match id { Some(i) if es_id(i, 3, 20) => i.into(), _ => { let a = red.azar_b36(6); a + &base36(r.epoca_ms as u64).chars().rev().take(3).collect::<Vec<_>>().into_iter().rev().collect::<String>() } };
        red
    }
    /// las salas oficiales y los mapas válidos de un juego (la versión personal: RB_Construct y RB_Flatgrass)
    pub fn poner_mapas(&mut self, oficiales: &[&str], validos: &[&str]) { self.oficiales = oficiales.iter().map(|m| Sala::oficial(m)).collect(); self.mapas = validos.iter().map(|s| s.to_string()).collect(); }
    fn azar_b36(&mut self, n: usize) -> String {
        (0..n).map(|_| { self.azar ^= self.azar << 13; self.azar ^= self.azar >> 7; self.azar ^= self.azar << 17; b"0123456789abcdefghijklmnopqrstuvwxyz"[(self.azar >> 11) as usize % 36] as char }).collect()
    }
    /// lo que hay que hacer afuera (se vacía)
    pub fn ordenes(&mut self) -> Vec<Orden> { std::mem::take(&mut self.ordenes) }
    /// lo que pasó (se vacía)
    pub fn eventos(&mut self) -> Vec<Evento> { std::mem::take(&mut self.eventos) }
    pub fn remotos(&self) -> &[Remoto] { &self.remotos }
    pub fn remoto(&self, id: &str) -> Option<&Remoto> { self.remotos.iter().find(|r| r.id == id) }
    /// las cosas de otros (sin las borradas), en el orden en que llegaron
    pub fn objetos(&self) -> Vec<&ObjRemoto> { let mut v: Vec<&ObjRemoto> = self.objs.values().filter(|o| !o.borrado).collect(); v.sort_by_key(|o| o.seq); v }
    pub fn objeto(&self, clave: &str) -> Option<&ObjRemoto> { self.objs.get(clave).filter(|o| !o.borrado) }
    pub fn npcs_remotos(&self) -> &[NpcRemoto] { &self.npcs_rem }
    /// una cosa mía que simula otro: dónde ponerla este cuadro (congelada)
    pub fn cedido(&self, id: u32) -> Option<([f64; 3], [f64; 4])> { self.cedidos.iter().find(|c| c.id == id).map(|c| (c.pos, c.q)) }
    /// las mías que simula otro: (número, dónde ponerla)
    pub fn cedidos(&self) -> Vec<(u32, [f64; 3], [f64; 4])> { self.cedidos.iter().map(|c| (c.id, c.pos, c.q)).collect() }
    /// las mías que alguna vez reclamó alguien (o.auth de red.js: también yo, si la volví a agarrar), en el orden del juego
    pub fn auths(&self) -> Vec<(u32, String)> { self.ult_objs.iter().filter_map(|o| self.propios_auth.get(&o.id).map(|a| (o.id, a.clone()))).collect() }
    /// ¿quién simula esta cosa mía? (None: yo)
    pub fn auth_propio(&self, id: u32) -> Option<&str> { self.propios_auth.get(&id).map(|s| s.as_str()).filter(|a| *a != self.id) }
    /// la clave de una cosa mía en la red (claveObj): «ID:número»
    pub fn clave_propia(&self, id: u32) -> String { format!("{}:{id}", self.id) }
    fn propio_de(&self, clave: &str) -> Option<u32> { let r = clave.strip_prefix(&self.id)?.strip_prefix(':')?; let id: u32 = r.parse().ok()?; self.ult_objs.iter().any(|o| o.id == id).then_some(id) }
    /// el texto del estado (redEstadoUI): «Solo», «sala · n/∞» o «Connecting…»
    pub fn estado(&self) -> String { match &self.sala { None => "Solo".into(), Some(s) if self.on => format!("{} · {}/∞", s.n, self.remotos.len() + 1), _ => "Connecting…".into() } }
    /// soyAnfitrion de anfitrion.js
    pub fn soy_anfitrion(&self) -> bool { match &self.sala { None => true, Some(s) => !s.of && ((!s.du.is_empty() && s.du == self.id) || self.mias.contains_key(&s.id)) } }

    fn pub_(&mut self, con: Con, topic: String, payload: String, retain: bool) { self.ordenes.push(Orden::Publicar { con, topic, payload, retain }); }
    /// un pedazo de mi voz (ROOM/v/ID, binario; sin retener)
    pub fn publicar_voz(&mut self, datos: Vec<u8>) { if !self.on || datos.is_empty() { return; } let topic = format!("{}/v/{}", self.room, self.id); self.ordenes.push(Orden::PublicarBin { con: Con::Sala, topic, payload: datos }); }
    /// publicar() de red.js: en ROOM/canal, con mi número al final; `cuerpo` es un objeto JSON
    pub fn publicar(&mut self, canal: &str, cuerpo: &str, retain: bool) {
        if !self.on { return; }
        let c = cuerpo.trim_end(); let c = c.strip_suffix('}').unwrap_or(c);
        let p = format!("{c}{}\"i\":{}}}", if c.trim_end().ends_with('{') { "" } else { "," }, js_str(&self.id));
        self.pub_(Con::Sala, format!("{}/{canal}", self.room), p, retain);
    }
    fn http(&mut self, metodo: &'static str, ruta: &str, cuerpo: Option<String>, cab: Vec<(String, String)>, que: QueHttp) {
        self.http_sig += 1; let id = self.http_sig; self.http_pend.insert(id, que);
        self.ordenes.push(Orden::Http { id, metodo, url: format!("{}{ruta}", self.tienda), cabeceras: cab, cuerpo });
    }
    fn json_cab() -> Vec<(String, String)> { vec![("Content-Type".into(), "application/json".into())] }

    // ---------------- la lista de salas ----------------
    /// listaConectar: la conexión liviana de la presencia (también para el menú)
    pub fn conectar_lista(&mut self) {
        if self.lista_abierta { return; }
        let az = self.azar_b36(4); let mut op = Opciones::nuevas(&self.broker, &format!("{NS}l_{}_{az}", self.id));
        op.clean = true; op.reconectar_ms = 4000; op.espera_ms = 9000; op.keepalive = 40;
        op.will = Some(Will { topic: format!("{NS}l/{}", self.id), payload: vec![], retain: true, qos: 0 });
        self.lista_abierta = true; self.ordenes.push(Orden::Conectar(Con::Lista, op));
    }
    /// mi presencia: en qué sala estoy (o nada)
    fn presencia(&mut self) {
        if !self.lista_on { return; }
        self.ult_p = self.t;
        let p = match &self.sala { Some(s) if self.sala_abierta && s.lan.is_none() => format!("{{\"s\":{},\"j\":{},\"t\":{}}}", s.json(), js_str(&self.nombre), js_num(js_round((self.reloj)().epoca_ms / 1000.0))), _ => String::new() };
        self.pub_(Con::Lista, format!("{NS}l/{}", self.id), p, true);
    }
    /// listaPedir: volver a leer los retenidos
    pub fn pedir_lista(&mut self) {
        if self.lista_on { self.pres.clear(); self.ordenes.push(Orden::Desuscribir(Con::Lista, format!("{NS}l/+"))); self.ordenes.push(Orden::Suscribir(Con::Lista, format!("{NS}l/+"))); }
        else { self.conectar_lista(); }
        self.eventos.push(Evento::Lista);
    }
    /// salasCargar: los servers creados (de la tienda)
    pub fn cargar_salas(&mut self) {
        if self.reg.cargando { return; }
        self.reg.cargando = true; self.reg.t = (self.reloj)().epoca_ms;
        self.http("GET", "salas", None, vec![], QueHttp::Salas);
    }
    /// mientras se mira la lista: se vuelve a pedir a la tienda cada 30 s (listaDibujar)
    pub fn mirando_lista(&mut self) { if (self.reloj)().epoca_ms - self.reg.t > 30e3 { self.cargar_salas(); } }
    /// los minutos que le quedan a un server vacío antes de borrarse solo
    pub fn sala_queda(&self, s: &Sala) -> f64 { (((s.vivo.unwrap_or(0.0)) + self.reg.vacia - ((self.reloj)().epoca_ms + self.reg.dif)) / 60e3).ceil().max(0.0) }
    /// listaSalas: las oficiales, las de la tienda que siguen vivas y las de la presencia, con quién juega en cada una
    pub fn lista_salas(&self) -> Vec<(Sala, Vec<String>)> {
        let r = (self.reloj)(); let ahora = r.epoca_ms / 1000.0;
        let mut m: Vec<(Sala, Vec<String>)> = vec![];
        let poner = |m: &mut Vec<(Sala, Vec<String>)>, s: &Sala| match m.iter_mut().find(|e| e.0.id == s.id) { Some(e) => *e = (s.clone(), vec![]), None => m.push((s.clone(), vec![])) };
        for s in &self.oficiales { poner(&mut m, s); }
        for s in &self.reg.l { if s.vivo.unwrap_or(0.0) + self.reg.vacia > r.epoca_ms + self.reg.dif { poner(&mut m, s); } }
        for (_, p) in &self.pres {
            if p.t != 0.0 && ahora - p.t > 900.0 { continue; }
            let i = match m.iter().position(|e| e.0.id == p.s.id) { Some(i) => i, None => { m.push((p.s.clone(), vec![])); m.len() - 1 } };
            m[i].1.push(if p.j.is_empty() { "?".into() } else { p.j.clone() });
        }
        // (localeCompare: sin mirar mayúsculas y, si no, las minúsculas primero)
        let inv = |s: &str| -> String { s.chars().map(|c| if c.is_lowercase() { c.to_uppercase().next().unwrap_or(c) } else { c.to_lowercase().next().unwrap_or(c) }).collect() };
        m.sort_by(|a, b| b.1.len().cmp(&a.1.len()).then((a.0.of as u8).cmp(&(b.0.of as u8))).then_with(|| a.0.n.to_lowercase().cmp(&b.0.n.to_lowercase()).then_with(|| inv(&a.0.n).cmp(&inv(&b.0.n)))));
        m
    }
    fn mensaje_lista(&mut self, topic: &str, payload: &[u8]) {
        let id = topic.get(NS.len() + 2..).unwrap_or(""); if !es_id(id, 3, 20) { return; }
        let s = String::from_utf8_lossy(payload);
        let quitar = |pres: &mut Vec<(String, Presencia)>| pres.retain(|(k, _)| k != id);
        if s.is_empty() { quitar(&mut self.pres); self.eventos.push(Evento::Lista); return; }
        let Ok(d) = serde_json::from_str::<Value>(&s) else { return };
        match sala_limpia(d.get("s"), &self.oficiales, &self.mapas) {
            None => quitar(&mut self.pres),
            Some(sala) => {
                let p = Presencia { s: sala, j: limpio(d.get("j"), 16), t: num(d.get("t"), 0.0, 1e11, 0.0) };
                match self.pres.iter_mut().find(|(k, _)| k == id) { Some(e) => e.1 = p, None => self.pres.push((id.to_string(), p)) }
            }
        }
        self.eventos.push(Evento::Lista);
    }

    // ---------------- entrar, crear, borrar, salir ----------------
    /// entrarSala: elegir la sala (con contraseña si tiene; el dueño entra a la suya sin escribirla). Después el juego
    /// carga el mapa (`sala.m`) y llama a `empezar`. Err: hay que pedir la contraseña (o la escrita no es: comprobarClave)
    pub fn entrar(&mut self, s: &Sala, clave: Option<&str>) -> Result<(), PideClave> {
        if let Some(c) = clave { if s.pw && !s.ph.is_empty() && !s.clave_ok(c) { return Err(PideClave); } }
        let mut clave = clave.map(String::from);
        if s.pw && clave.is_none() { if let Some(m) = self.mias.get(&s.id) { if !m.pw.is_empty() { clave = Some(m.pw.clone()); } } }
        if s.pw && clave.is_none() { return Err(PideClave); }
        let mut sala = s.clone(); sala.clave = clave.unwrap_or_default(); self.sala = Some(sala); Ok(())
    }
    /// redEntrar: con el mapa ya cargado, conectarse a la sala elegida. `antes`: mi número de la vez anterior si volví a
    /// este server con otro (en menos de 5 minutos): los demás borran mi fantasma y lo que era mío
    pub fn empezar(&mut self, antes: Option<&str>) {
        self.salir();
        let Some(sala) = self.sala.clone() else { return };
        if sala.lan.is_none() { self.conectar_lista(); }
        self.room = sala.topico(); self.t_vivo = 0.0;
        if sala.rg { self.sala_vivo(&sala.id); }
        self.antes = antes.filter(|a| *a != self.id && !a.is_empty() && a.len() <= 20 && a.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')).map(String::from);
        self.lugar = Some(Lugar { t0: self.t, ..Lugar::default() });
        let az = self.azar_b36(4); let mut op = Opciones::nuevas(sala.lan.as_deref().unwrap_or(&self.broker), &format!("{NS}{}_{az}", self.id));
        op.clean = true; op.reconectar_ms = 3000; op.espera_ms = 9000; op.keepalive = 30;
        op.will = Some(Will { topic: format!("{}/w/{}", self.room, self.id), payload: vec![], retain: true, qos: 0 });
        self.sala_abierta = true; self.ordenes.push(Orden::Conectar(Con::Sala, op));
    }
    /// redSalir: me despido (borro lo mío retenido y aviso «chau») y se van los demás y sus cosas
    pub fn salir(&mut self) {
        if !self.sala_abierta { return; }
        if let Some(s) = self.sala.clone() { if s.rg { self.sala_vivo(&s.id); } }
        self.pub_(Con::Sala, format!("{}/w/{}", self.room, self.id), String::new(), true);
        self.publicar("a", "{\"k\":\"chau\"}", false);
        self.sala_abierta = false; self.on = false; self.presencia();
        self.ordenes.push(Orden::Cerrar(Con::Sala));
        for r in std::mem::take(&mut self.remotos) { self.quitar_remoto(r); }
        let mut v: Vec<ObjRemoto> = self.objs.drain().map(|(_, o)| o).collect(); v.sort_by_key(|o| o.seq);
        for o in v { if !o.borrado { self.eventos.push(Evento::ObjetoBorrado { clave: o.clave }); } }
    }
    /// salir y olvidar la sala (volver al menú)
    pub fn dejar(&mut self) { self.salir(); self.sala = None; }
    fn sala_vivo(&mut self, id: &str) { self.http("POST", &format!("salas/{id}/vivo"), None, vec![], QueHttp::Vivo); }
    /// crearServidor: se guarda en la tienda (así sigue en la lista vacío y se puede borrar); si no se puede, queda como
    /// temporal (mientras haya alguien). Llega `SalaCreada` y el juego carga el mapa y llama a `empezar`. `token`: la
    /// sesión de Google (la tienda puede pedirla)
    pub fn crear_servidor(&mut self, c: &NuevaSala, token: Option<&str>) {
        if self.creando { return; }
        let nom = { let n = limpio_txt(&c.n, 24); if n.is_empty() { format!("{}'s server", self.nombre) } else { n } };
        let clave = limpio_txt(&c.pw, 16);
        let mapa = if self.mapas.contains(&c.m) { c.m.clone() } else if !self.cfg.mapa.is_empty() { self.cfg.mapa.clone() } else { "FlatGrass".into() };
        let mo = if c.mo == "PvP" { "PvP" } else { "Free" };
        let mut s = Sala { n: nom, m: mapa, mo: mo.into(), pvp: c.pvp || mo == "PvP", rpg: c.rpg, nb: c.nb, mp: num(Some(&Value::from(c.mp)), 0.0, 5000.0, 1000.0) as i32, mv: num(Some(&Value::from(c.mv)), 0.0, 200.0, 40.0) as i32,
            pw: !clave.is_empty(), du: self.id.clone(), dn: limpio_txt(&self.nombre, 16), mw: c.mw.clone().filter(|w| digitos(w, 3, 12)).unwrap_or_default(), forma: Forma::Creada, ..Sala::default() };
        s.id = self.nuevo_id(); self.creando = true; self.eventos.push(Evento::Aviso("Creando el server…".into()));
        self.crear_intento(s, clave, 0, token.map(String::from));
    }
    fn nuevo_id(&mut self) -> String { if !self.ids_prueba.is_empty() { return self.ids_prueba.remove(0); } self.azar_b36(8) }
    fn crear_intento(&mut self, mut s: Sala, clave: String, intento: u32, token: Option<String>) {
        s.ph = if clave.is_empty() { String::new() } else { hash_txt(&format!("c{}{clave}", s.id)) };
        let mut cab = Self::json_cab(); if let Some(t) = &token { cab.push(("Authorization".into(), format!("Bearer {t}"))); }
        let cuerpo = format!("{}}}", s.json_crear());
        self.http("POST", "salas", Some(cuerpo), cab, QueHttp::Crear { s, clave, intento, token });
    }
    fn crear_fin(&mut self, mut s: Sala, clave: String, rg: bool) {
        self.creando = false;
        s.rg = rg; s.clave = clave; s.vivo = Some((self.reloj)().epoca_ms);
        if rg { self.reg.l.retain(|x| x.id != s.id); let mut c = s.clone(); c.clave.clear(); self.reg.l.push(c); }
        self.sala = Some(s.clone()); self.eventos.push(Evento::SalaCreada { sala: s });
    }
    /// borrarServidor: un server mío se saca de la tienda y los que están adentro vuelven al menú. false: no es mío
    pub fn borrar_servidor(&mut self, s: &Sala) -> bool {
        let Some(mia) = self.mias.get(&s.id).cloned() else { return false };
        let cuerpo = format!("{{\"clave\":{}}}", js_str(&mia.clave));
        self.http("POST", &format!("salas/{}/borrar", s.id), Some(cuerpo), Self::json_cab(), QueHttp::Borrar { s: s.clone(), mia }); true
    }
    /// las salas mías como las guarda la web (rb_salas_mias)
    pub fn mias_json(&self) -> String {
        let mut v: Vec<_> = self.mias.iter().collect(); v.sort_by(|a, b| a.1.t.partial_cmp(&b.1.t).unwrap_or(std::cmp::Ordering::Equal));
        format!("{{{}}}", v.iter().map(|(k, m)| format!("{}:{{\"clave\":{},\"pw\":{},\"t\":{}}}", js_str(k), js_str(&m.clave), js_str(&m.pw), js_num(m.t))).collect::<Vec<_>>().join(","))
    }
    pub fn poner_mias_json(&mut self, s: &str) {
        self.mias.clear();
        if let Ok(Value::Object(o)) = serde_json::from_str::<Value>(s) { for (k, v) in o { self.mias.insert(k, SalaMia { clave: js_string(v.get("clave")).replace("undefined", ""), pw: v.get("pw").and_then(|x| x.as_str()).unwrap_or("").into(), t: num(v.get("t"), 0.0, 1e15, 0.0) }); } }
    }
    /// la respuesta de un pedido HTTP (el cuerpo, aunque el código sea de error, como fetch; Err: no se pudo)
    pub fn http_respuesta(&mut self, id: u32, r: Result<(u16, String), String>) {
        let Some(que) = self.http_pend.remove(&id) else { return };
        let d = r.as_ref().ok().and_then(|(_, b)| serde_json::from_str::<Value>(b).ok());
        match que {
            QueHttp::Vivo => {}
            QueHttp::Salas => {
                let ep = (self.reloj)().epoca_ms;
                match &d {
                    Some(d) => {
                        self.reg.dif = { let a = js_numero(d.get("ahora")); if a != 0.0 && !a.is_nan() { a } else { ep } } - ep;
                        self.reg.vacia = { let v = js_numero(d.get("vacia")); if v != 0.0 && !v.is_nan() { v } else { 600e3 } };
                        self.reg.ok = true;
                        let mut l = vec![];
                        for x in d.get("salas").and_then(|s| s.as_array()).map(|a| a.as_slice()).unwrap_or(&[]) {
                            if let Some(mut s) = sala_limpia(Some(x), &self.oficiales, &self.mapas) { s.rg = true; let v = js_numero(x.get("vivo")); s.vivo = Some(if v.is_nan() { 0.0 } else { v }); l.push(s); }
                        }
                        self.reg.l = l;
                        // (los míos que ya no están se olvidan)
                        let n0 = self.mias.len(); let reg = &self.reg.l;
                        self.mias.retain(|id, m| reg.iter().any(|s| s.id == *id) || ep - m.t <= 60e3);
                        if self.mias.len() != n0 { self.eventos.push(Evento::Mias); }
                    }
                    None => self.reg.ok = false,
                }
                self.reg.cargando = false; self.eventos.push(Evento::Lista);
            }
            QueHttp::Cerrada => {
                let Some(d) = d else { return };
                if let Some(s) = &self.sala { if !d.get("salas").and_then(|v| v.as_array()).map(|a| a.iter().any(|x| x.get("id").and_then(|i| i.as_str()) == Some(&s.id))).unwrap_or(false) {
                    let n = s.n.clone(); self.eventos.push(Evento::SalaCerrada { nombre: n }); self.dejar();
                } }
            }
            QueHttp::Crear { mut s, clave, intento, token } => {
                match &d {
                    Some(r) if r.get("id").and_then(|v| v.as_str()) == Some(&s.id) && verdad(r.get("clave")) => {
                        self.mias.insert(s.id.clone(), SalaMia { clave: js_string(r.get("clave")), pw: clave.clone(), t: (self.reloj)().epoca_ms }); self.eventos.push(Evento::Mias);
                        self.crear_fin(s, clave, true);
                    }
                    Some(r) if r.get("error").and_then(|v| v.as_str()) == Some("id usado") => {
                        s.id = self.nuevo_id();
                        if intento + 1 < 2 { self.crear_intento(s, clave, intento + 1, token); } else { self.crear_fin(s, clave, false); }
                    }
                    Some(r) => { let e = r.get("error").and_then(|v| v.as_str()).filter(|e| !e.is_empty()).map(String::from).unwrap_or("Server temporal (sin la tienda)".into()); self.eventos.push(Evento::Aviso(e)); self.crear_fin(s, clave, false); }
                    None => { self.eventos.push(Evento::Aviso("Server temporal (sin la tienda)".into())); self.crear_fin(s, clave, false); }
                }
            }
            QueHttp::Borrar { s, mia } => {
                let ok = d.as_ref().map(|d| verdad(d.get("ok"))).unwrap_or(false);
                if !ok { self.eventos.push(Evento::Aviso("Error de red".into())); self.cargar_salas(); self.eventos.push(Evento::SalaBorrada { id: s.id, ok: false }); return; }
                self.mias.remove(&s.id); self.eventos.push(Evento::Mias); self.reg.l.retain(|x| x.id != s.id);
                // aviso a los que juegan ahí (ellos revisan en la tienda que de verdad se borró antes de salir)
                if self.lista_on {
                    let mut s2 = s.clone(); s2.clave = mia.pw.clone();
                    let id = if self.id.is_empty() { "dueno".to_string() } else { self.id.clone() };
                    self.pub_(Con::Lista, format!("{}/a", s2.topico()), format!("{{\"k\":\"cerrada\",\"i\":{}}}", js_str(&id)), false);
                }
                self.eventos.push(Evento::SalaBorrada { id: s.id, ok: true }); self.eventos.push(Evento::Lista);
            }
        }
    }

    // ---------------- las conexiones ----------------
    pub fn conectado(&mut self, con: Con) {
        match con {
            Con::Lista => { if !self.lista_abierta { return; } self.lista_on = true; self.ordenes.push(Orden::Suscribir(Con::Lista, format!("{NS}l/+"))); self.presencia(); self.eventos.push(Evento::Lista); }
            Con::Sala => {
                if !self.sala_abierta { return; }
                self.on = true; self.ordenes.push(Orden::Suscribir(Con::Sala, format!("{}/#", self.room))); self.w_sucio = true;
                self.presencia(); self.eventos.push(Evento::Conectado { sala: self.sala.as_ref().map(|s| s.n.clone()).unwrap_or_default() });
                if self.soy_anfitrion() { self.host_publicar(); }
                // (la primera vez: lo de antes con otro número se borra para todos; y cuando ya llegó lo de los demás se mira
                // que el lugar donde aparecí siga libre)
                let t = self.t;
                if let Some(l) = self.lugar.as_mut() { if !l.conectado {
                    l.conectado = true; l.revisar_t = t + 1.5; l.hasta_t = t + 9.0;
                    if let Some(a) = self.antes.clone() { self.pub_(Con::Sala, format!("{}/w/{a}", self.room), String::new(), true); }
                } }
            }
        }
    }
    pub fn desconectado(&mut self, con: Con) {
        match con { Con::Lista => self.lista_on = false, Con::Sala => { if self.on { self.eventos.push(Evento::Desconectado); } self.on = false; } }
    }
    /// un mensaje que llegó por esa conexión
    pub fn mensaje(&mut self, con: Con, topic: &str, payload: &[u8]) {
        match con { Con::Lista => self.mensaje_lista(topic, payload), Con::Sala => { if self.sala_abierta { self.red_mensaje(topic, payload); } } }
    }

    // ---------------- lo que llega ----------------
    fn red_mensaje(&mut self, topic: &str, payload: &[u8]) {
        let sub = topic.get(self.room.len() + 1..).unwrap_or("");
        // (la voz de la nativa: binario, de uno que está en la sala)
        if let Some(id) = sub.strip_prefix("v/") {
            if id != self.id && largo16(id) <= 20 && payload.len() <= 8192 && self.remotos.iter().any(|r| r.id == id) { self.eventos.push(Evento::Voz { de: id.into(), datos: payload.to_vec() }); }
            return;
        }
        let s = String::from_utf8_lossy(payload);
        if let Some(id) = sub.strip_prefix("w/") {
            if id == self.id { return; }
            let d = if s.is_empty() { None } else { match serde_json::from_str::<Value>(&s) { Ok(d) => Some(d), Err(_) => return } };
            let id = id.to_string(); self.recibir_mundo(&id, d.as_ref()); return;
        }
        if s.is_empty() { return; }
        let Ok(d) = serde_json::from_str::<Value>(&s) else { return };
        let Some(i) = d.get("i").and_then(|v| v.as_str()) else { return };
        if i == self.id || largo16(i) > 20 { return; }
        let i = i.to_string();
        match sub {
            "e" => self.recibir_estado(&i, &d),
            "m" => self.recibir_mov(&i, &d),
            "a" => { if !self.host_hecho(&i, &d) { self.recibir_hecho(&i, &d); } }
            "cfg" => self.recibir_cfg(&i, &d),
            "g" | "gl" => self.eventos.push(Evento::Gmod { sub: sub.into(), de: i, d }),
            "c" => {
                if let Some(t) = d.get("t").and_then(|v| v.as_str()) {
                    let txt = limpio_txt(t, 120); let nombre = limpio(d.get("n"), 16);
                    let idm = d.get("id").and_then(|v| v.as_str()).map(|x| corte16(x, 12));
                    // (y en un globito arriba de su cabeza, 7 s)
                    let tt = self.t;
                    if let Some(r) = self.remotos.iter_mut().find(|r| r.id == i) { r.globo = Some(if largo16(&txt) > 60 { corte16(&txt, 58) + "…" } else { txt.clone() }); r.globo_hasta = tt + 7.0; }
                    self.eventos.push(Evento::Chat { de: i, nombre, texto: txt, id: idm });
                }
            }
            _ => {}
        }
    }
    fn quitar_remoto(&mut self, r: Remoto) {
        self.borrar_objs_de(&r.id);
        self.eventos.push(Evento::Salio { nombre: if r.nombre.is_empty() { "Alguien".into() } else { r.nombre.clone() }, id: r.id });
    }
    fn borrar_objs_de(&mut self, de: &str) {
        let mut fuera: Vec<ObjRemoto> = vec![]; self.objs.retain(|_, o| if o.dueno == de { fuera.push(o.clone()); false } else { true });
        fuera.sort_by_key(|o| o.seq); for o in fuera { if !o.borrado { self.eventos.push(Evento::ObjetoBorrado { clave: o.clave }); } }
    }
    fn recibir_estado(&mut self, i: &str, d: &Value) {
        let mut idx = self.remotos.iter().position(|r| r.id == i);
        // (volvió con otro número: el de antes, si ya no manda nada, es su fantasma y pasa a ser él)
        if idx.is_none() { if let Some(an) = d.get("an").and_then(|v| v.as_str()) { if an != i && largo16(an) <= 20 {
            if let Some(vi) = self.remotos.iter().position(|r| r.id == an) { if self.t - self.remotos[vi].t > 1.5 {
                let mut v = self.remotos.remove(vi); let viejo = v.id.clone();
                self.borrar_objs_de(&viejo); self.eventos.push(Evento::Reemplazo { viejo, nuevo: i.into() });
                v.id = i.into(); v.t = -1e9; self.remotos.push(v); idx = Some(self.remotos.len() - 1);
            } }
        } } }
        let nuevo = idx.is_none();
        let nombre = limpio(d.get("n"), 16);
        let idx = match idx { Some(k) => k, None => {
            self.remotos.push(Remoto::nuevo(i, self.t)); self.eventos.push(Evento::Entro { id: i.into(), nombre: nombre.clone() }); self.remotos.len() - 1
        } };
        let (t, ahora) = (self.t, (self.reloj)().real);
        let r = &mut self.remotos[idx];
        r.skin = match d.get("k") { Some(Value::String(k)) if !k.is_empty() && k.len() < 220 => k.clone(), _ => "Hero".into() };
        r.skin_wid = d.get("kw").map(|w| js_string(Some(w))).filter(|w| digitos(w, 3, 12)).unwrap_or_default();
        r.gorro = match d.get("h") { Some(Value::String(h)) if !h.is_empty() => h.clone(), _ => "HatEmpty".into() };
        r.gorro_aj = d.get("ga").cloned().unwrap_or(Value::Null); r.acc = d.get("ac").cloned().unwrap_or(Value::Null);
        if let Some(p) = d.get("p").filter(|v| v.is_array()) {
            r.meta = arr3(Some(p), -1e4, 1e4, [0.0; 3]);
            // (un salto grande, como cruzar un portal, va de una)
            if nuevo || t - r.t > 2.0 || dist(r.pos, r.meta) > 15.0 { r.pos = r.meta; }
        }
        if let Some(v) = d.get("v").filter(|v| v.is_array()) { r.vel_red = arr3(Some(v), -80.0, 80.0, [0.0; 3]); }
        remoto_muestra(r, d, ahora);
        r.yaw_m = num(d.get("y"), -1e3, 1e3, 0.0); r.mira = num(d.get("t"), -2.0, 2.0, 0.0); r.f = int32(d.get("f")); r.t = t; r.hp = num(d.get("hp"), 0.0, 1e5, 100.0);
        r.nombre = nombre;
        r.social = d.get("sp").and_then(|v| v.as_str()).filter(|s| digitos(s, 8, 8)).map(String::from);
        r.voz = d.get("vz").map(|v| verdad(Some(v))).unwrap_or(false);
        r.arma = d.get("a").and_then(|v| v.as_str()).filter(|a| !a.is_empty()).map(String::from);
        r.musica = d.get("mu").filter(|m| verdad(Some(m))).cloned();
        r.emote = d.get("e").and_then(|v| v.as_str()).filter(|e| !e.is_empty()).map(String::from);
        r.veh = d.get("w").and_then(|w| w.as_array()).map(|w| (js_string(w.first()), int32(w.get(1))));
        r.arriba = d.get("u").filter(|u| u.is_array()).map(|u| { let a = arr3(Some(u), -1.0, 1.0, [0.0, 1.0, 0.0]); let l = (a[0] * a[0] + a[1] * a[1] + a[2] * a[2]).sqrt(); if l > 1e-12 { [a[0] / l, a[1] / l, a[2] / l] } else { a } });
        r.color = d.get("c").and_then(|v| v.as_str()).filter(|c| es_hex_color(c)).unwrap_or("").into();
        r.verity = d.get("vr").filter(|v| verdad(Some(v))).cloned(); r.pill = d.get("pl").filter(|v| verdad(Some(v))).cloned();
        // (llegó uno nuevo mientras recién entré: ¿estoy parado donde está él?)
        if nuevo { if let Some(l) = &self.lugar { if l.mando && t < l.hasta_t { self.eventos.push(Evento::RevisarLugar); } } }
    }
    fn recibir_mundo(&mut self, de: &str, d: Option<&Value>) {
        let mut vivos: HashSet<String> = HashSet::new();
        if let Some(d) = d {
            if let Some(e) = d.get("e") { self.eventos.push(Evento::Entidades { de: de.into(), e: e.clone() }); }
            if let Some(md) = d.get("md").filter(|m| m.is_array()) { self.eventos.push(Evento::Mods { de: de.into(), md: md.clone() }); }
        }
        if let Some(l) = d.and_then(|d| d.get("o")).and_then(|o| o.as_array()) {
            for x in l.iter().take(300) {
                let Some(x) = x.as_array() else { continue };
                let Some(nombre) = x.get(1).and_then(|v| v.as_str()) else { continue };
                if let Some(pf) = &self.prefabs { if !pf.contains(nombre) { continue; } }
                let clave = format!("{de}:{}", int32(x.first())); vivos.insert(clave.clone());
                let p = [num(x.get(2), -1e4, 1e4, 0.0), num(x.get(3), -1e4, 1e4, 0.0), num(x.get(4), -1e4, 1e4, 0.0)];
                let q = qnorm([num(x.get(5), -1.0, 1.0, 0.0), num(x.get(6), -1.0, 1.0, 0.0), num(x.get(7), -1.0, 1.0, 0.0), num(x.get(8), -1.0, 1.0, 1.0)]);
                let cong = verdad(x.get(9));
                match self.objs.get_mut(&clave) {
                    None => {
                        self.seq += 1;
                        self.objs.insert(clave.clone(), ObjRemoto { clave: clave.clone(), nombre: nombre.into(), dueno: de.into(), auth: de.into(), pos: p, q, cong_real: cong, duerme: false, exploto: false, borrado: false, meta: (p, q), seq: self.seq });
                        self.eventos.push(Evento::ObjetoNuevo { clave: clave.clone(), nombre: nombre.into(), dueno: de.into(), pos: p, q, congelado: cong });
                    }
                    Some(o) => { if o.auth != self.id { o.meta = (p, q); o.cong_real = cong; } }
                }
                if verdad(x.get(10)) { self.eventos.push(Evento::Maquinita { clave, d: x[10].clone() }); }
            }
        }
        let mut fuera: Vec<ObjRemoto> = vec![]; self.objs.retain(|k, o| if o.dueno == de && !vivos.contains(k) { fuera.push(o.clone()); false } else { true });
        fuera.sort_by_key(|o| o.seq); for o in fuera { if !o.borrado { self.eventos.push(Evento::ObjetoBorrado { clave: o.clave }); } }
    }
    fn recibir_mov(&mut self, de: &str, d: &Value) {
        let Some(l) = d.get("l").and_then(|v| v.as_array()) else { return };
        for x in l.iter().take(60) {
            let Some(x) = x.as_array() else { continue };
            let clave = match x.first() { Some(Value::String(s)) => s.clone(), v => format!("{de}:{}", int32(v)) };
            let p = [num(x.get(1), -1e4, 1e4, 0.0), num(x.get(2), -1e4, 1e4, 0.0), num(x.get(3), -1e4, 1e4, 0.0)];
            let q = qnorm([num(x.get(4), -1.0, 1.0, 0.0), num(x.get(5), -1.0, 1.0, 0.0), num(x.get(6), -1.0, 1.0, 0.0), num(x.get(7), -1.0, 1.0, 1.0)]);
            if let Some(o) = self.objs.get_mut(&clave) {
                if o.auth != de && !(o.auth == o.dueno && de == o.dueno) { continue; }
                o.meta = (p, q);
            } else if let Some(id) = self.propio_de(&clave) {
                // (alguien simula algo mío: lo reclamó)
                if self.propios_auth.get(&id).map(|a| a.as_str()) != Some(de) { continue; }
                if let Some(c) = self.cedidos.iter_mut().find(|c| c.id == id) { c.meta = (p, q); }
            }
        }
    }
    fn host_hecho(&mut self, i: &str, d: &Value) -> bool {
        let Some(s) = &self.sala else { return false }; if i != s.du { return false; }
        let k = d.get("k").and_then(|v| v.as_str()).unwrap_or("");
        if k == "kick" && d.get("to").and_then(|v| v.as_str()) == Some(&self.id) { self.eventos.push(Evento::Echado); self.dejar(); return true; }
        if k == "limpiar" { if !self.ult_objs.is_empty() { self.w_sucio = true; } self.eventos.push(Evento::Limpiar); return true; }
        false
    }
    fn recibir_cfg(&mut self, i: &str, d: &Value) {
        let Some(s) = self.sala.as_mut() else { return }; if s.of || i != s.du { return; }
        let hora = num(d.get("h"), 0.0, 24.0, 12.0); let ciclo = verdad(d.get("c")); let ds = verdad(d.get("ds"));
        s.pvp = verdad(d.get("pvp")); s.nb = verdad(d.get("nb")); s.mp = num(d.get("mp"), 0.0, 5000.0, 1000.0) as i32; s.mv = num(d.get("mv"), 0.0, 200.0, 40.0) as i32;
        self.cfg.hora = hora; self.cfg.ciclo = ciclo; self.cfg.ds = ds;
        self.eventos.push(Evento::Cfg { hora, ciclo, ds });
        if let Some(m) = d.get("m").and_then(|v| v.as_str()) { if !m.is_empty() && m != self.cfg.mapa { let mw = if verdad(d.get("mw")) { js_string(d.get("mw")) } else { String::new() }; self.mapa_host(m, &mw); } }
    }
    /// redMapaHost: el anfitrión juega otro mapa: se va a ése (una vez por mapa)
    fn mapa_host(&mut self, m: &str, mw: &str) {
        if self.soy_anfitrion() || self.mapa_va.as_deref() == Some(m) { return; }
        let Some(s) = self.sala.as_mut() else { return }; if s.of { return; }
        if !self.mapas.iter().any(|x| x == m) && !(es_ws(m) && digitos(mw, 3, 12)) { return; }
        self.mapa_va = Some(m.into()); s.m = m.into(); s.mw = mw.into();
        self.eventos.push(Evento::MapaAnfitrion { m: m.into(), mw: mw.into() });
    }
    fn recibir_hecho(&mut self, i: &str, d: &Value) {
        let k = d.get("k").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let hay = self.remotos.iter().position(|r| r.id == i);
        let para_mi = d.get("to").and_then(|v| v.as_str()) == Some(&self.id);
        match k.as_str() {
            "chau" => { if let Some(x) = hay { let r = self.remotos.remove(x); self.quitar_remoto(r); } }
            "tiro" if d.get("p").map(|v| v.is_array()).unwrap_or(false) && d.get("d").map(|v| v.is_array()).unwrap_or(false) => {
                let o = arr3(d.get("p"), -1e4, 1e4, [0.0; 3]); let v = arr3(d.get("d"), -1.0, 1.0, [0.0, 0.0, 1.0]); let l = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
                let dir = if l > 1e-12 { [v[0] / l, v[1] / l, v[2] / l] } else { v };
                self.eventos.push(Evento::Disparo { de: i.into(), arma: d.get("a").and_then(|a| a.as_str()).map(String::from), o, dir });
            }
            "rec" => { if hay.is_some() { self.eventos.push(Evento::Recarga { de: i.into() }); } }
            "exp" if d.get("p").map(|v| v.is_array()).unwrap_or(false) => {
                let p = arr3(d.get("p"), -1e4, 1e4, [0.0; 3]);
                let kk = d.get("o").and_then(|v| v.as_str()).map(|s| corte16(s, 80));
                if let Some(kk) = &kk {
                    let ya = self.expl.contains_key(kk) || self.objs.get(kk).map(|o| o.exploto).unwrap_or(false);
                    if ya { return; }
                    self.exp_marcar(kk);
                }
                let r = num(d.get("r"), 0.5, 600.0, 6.0); let dano = num(d.get("d"), 0.0, 1e5, 100.0);
                self.eventos.push(Evento::Explosion { de: i.into(), p, r, dano, fuente: kk.clone() });
                if let Some(kk) = kk {
                    if let Some(o) = self.objs.get_mut(&kk) { o.exploto = true; if !o.borrado { o.borrado = true; self.eventos.push(Evento::ObjetoBorrado { clave: kk }); } }
                    else if let Some(id) = self.propio_de(&kk) { self.w_sucio = true; self.eventos.push(Evento::PropioBorrado { id }); }
                }
            }
            "cerrada" => { if self.sala.as_ref().map(|s| s.rg).unwrap_or(false) { self.http("GET", "salas", None, vec![], QueHttp::Cerrada); } }
            "dano" if para_mi => {
                if let Some(s) = &self.sala { if !s.pvp { return; } }
                let dano = num(d.get("d"), 0.0, 500.0, 0.0);
                let empuje = d.get("v").filter(|v| v.is_array()).map(|v| { let a = arr3(Some(v), -1.0, 1.0, [0.0; 3]); let k = (dano * 0.05).min(6.0); [a[0] * k, a[1] * k, a[2] * k] });
                self.eventos.push(Evento::Dano { de: i.into(), dano, empuje });
            }
            "claim" if d.get("o").map(|v| v.is_string()).unwrap_or(false) => {
                let kk = d["o"].as_str().unwrap().to_string();
                if let Some(o) = self.objs.get_mut(&kk) { o.auth = i.into(); }
                else if let Some(id) = self.propio_de(&kk) {
                    self.propios_auth.insert(id, i.into());
                    let o = self.ult_objs.iter().find(|o| o.id == id).copied().unwrap_or_default();
                    // (congReal: si estaba congelada —si ya la simulaba otro, la tenía congelada yo—; y desde ahora sigue lo
                    // que manda el otro)
                    let ced = self.cedidos.iter().find(|c| c.id == id).map(|c| (c.pos, c.q));
                    let (pos, q) = ced.unwrap_or((o.pos, o.q));
                    let cong = ced.is_some() || o.congelado;
                    self.cedidos.retain(|c| c.id != id); self.cedidos.push(Cedido { id, pos, q, meta: (pos, q), cong_real: cong });
                    self.eventos.push(Evento::PropioReclamado { id, por: i.into() });
                }
            }
            "borra" if d.get("o").map(|v| v.is_string()).unwrap_or(false) => {
                if let Some(id) = self.propio_de(d["o"].as_str().unwrap()) { self.w_sucio = true; self.eventos.push(Evento::PropioBorrado { id }); }
            }
            k if k.starts_with("npc") => self.npc_recibir(i, d),
            "kick" | "limpiar" | "dano" | "npcdan" => {}
            _ => { if !k.is_empty() { self.eventos.push(Evento::Hecho { de: i.into(), k: k.clone(), d: d.clone() }); } }
        }
    }
    fn exp_marcar(&mut self, k: &str) {
        let t = self.t; if self.expl.len() > 60 { self.expl.retain(|_, x| t - *x <= 10.0); }
        self.expl.insert(k.into(), t);
    }
    fn npc_recibir(&mut self, de: &str, d: &Value) {
        let k = d.get("k").and_then(|v| v.as_str()).unwrap_or("");
        let para_mi = d.get("to").and_then(|v| v.as_str()) == Some(&self.id);
        match k {
            "npcs" => {
                let Some(l) = d.get("l").and_then(|v| v.as_array()) else { return };
                for x in l.iter().take(24) {
                    let Some(x) = x.as_array() else { continue };
                    let n = int32(x.first()); let clave = format!("{de}/{n}");
                    let skin = match x.get(1) { Some(Value::String(s)) if !s.is_empty() => s.clone(), _ => "Hero".into() };
                    if let Some(k) = self.npcs_rem.iter().position(|e| e.clave == clave && e.skin != skin) { let e = self.npcs_rem.remove(k); self.eventos.push(Evento::NpcFin { clave: e.clave }); }
                    let meta = [num(x.get(2), -1e4, 1e4, 0.0), num(x.get(3), -1e4, 1e4, 0.0), num(x.get(4), -1e4, 1e4, 0.0)];
                    let k = match self.npcs_rem.iter().position(|e| e.clave == clave) { Some(k) => k, None => {
                        self.npcs_rem.push(NpcRemoto { clave: clave.clone(), de: de.into(), n, skin: skin.clone(), pos: meta, yaw: 0.0, vel: [0.0; 3], suelo: false, rag: false, vivo: true, hostil: false, bueno: false, oculto: false, arma: None, emote: None, tiros: 0, mira: None, meta, yaw_m: 0.0, t: self.t, f: 0 });
                        self.npcs_rem.len() - 1 } };
                    let t = self.t; let e = &mut self.npcs_rem[k];
                    e.meta = meta; e.yaw_m = num(x.get(5), -1e3, 1e3, 0.0); e.vel = [num(x.get(6), -80.0, 80.0, 0.0), num(x.get(7), -80.0, 80.0, 0.0), num(x.get(8), -80.0, 80.0, 0.0)];
                    e.f = int32(x.get(9)); e.t = t; e.hostil = e.f & 8 != 0; e.bueno = e.f & 16 != 0; e.oculto = e.f & 32 != 0;
                    e.arma = x.get(11).and_then(|v| v.as_str()).filter(|a| !a.is_empty()).map(String::from);
                    if e.arma.is_some() && int32(x.get(12)) > 0 && x.get(13).map(|v| v.is_array()).unwrap_or(false) { e.tiros = (e.tiros + int32(x.get(12)) as u32).min(12); e.mira = Some(arr3(x.get(13), -1e4, 1e4, [0.0; 3])); }
                    e.emote = x.get(10).and_then(|v| v.as_str()).filter(|s| !s.is_empty()).map(String::from);
                }
            }
            "npcfin" => { let clave = format!("{de}/{}", int32(d.get("n"))); if let Some(k) = self.npcs_rem.iter().position(|e| e.clave == clave) { self.npcs_rem.remove(k); self.eventos.push(Evento::NpcFin { clave }); } }
            "npcdi" => { let clave = format!("{de}/{}", int32(d.get("n"))); if let (true, Some(t)) = (self.npcs_rem.iter().any(|e| e.clave == clave), d.get("t").and_then(|v| v.as_str())) { self.eventos.push(Evento::NpcDice { clave, texto: limpio_txt(t, 80) }); } }
            "npcdan" if para_mi => {
                let v = if d.get("v").map(|v| v.is_array()).unwrap_or(false) { arr3(d.get("v"), -50.0, 50.0, [0.0; 3]) } else { [0.0, 0.0, 1.0] };
                self.eventos.push(Evento::NpcDano { n: int32(d.get("n")), de: de.into(), dano: num(d.get("d"), 0.0, 9999.0, 0.0), v, tumba: verdad(d.get("tumba")) });
            }
            "npcact" if para_mi => self.eventos.push(Evento::NpcAct { n: int32(d.get("n")), de: de.into(), a: d.get("a").cloned().unwrap_or(Value::Null) }),
            _ => {}
        }
    }

    // ---------------- lo que mando ----------------
    /// un cuadro (redPaso, hostPaso y la parte de la red de npcPaso): `dt` es el del juego (como mucho 0,1 s)
    pub fn paso(&mut self, dt: f64, local: &Local) {
        self.t += dt; let t = self.t;
        self.ult_objs.clear(); self.ult_objs.extend(local.objs.iter().map(|o| ObjMin { id: o.id, pos: o.pos, q: o.q, congelado: o.congelado }));
        // (las cosas de otros que simulo yo: dónde las tiene mi física)
        for s in &local.simulo { if let Some(o) = self.objs.get_mut(&s.clave) { if o.auth == self.id { o.pos = s.pos; o.q = s.q; o.duerme = s.duerme; } } }
        if self.on { self.red_paso(dt, local); if self.sala.as_ref().map(|s| !s.of).unwrap_or(false) && self.soy_anfitrion() && t - self.t_cfg > 20.0 { self.host_publicar(); } }
        self.npc_paso(dt, &local.npcs);
    }
    fn red_paso(&mut self, dt: f64, local: &Local) {
        let t = self.t;
        let ahora = (self.reloj)().real;
        let mut fuera = vec![];
        for (k, r) in self.remotos.iter_mut().enumerate() { if !remoto_paso(r, dt, t, ahora, self.gravedad) { fuera.push(k); } }
        for k in fuera.into_iter().rev() { let r = self.remotos.remove(k); self.quitar_remoto(r); }
        let me = self.id.clone(); let kk = 1.0 - (-dt * 14.0).exp();
        for o in self.objs.values_mut() {
            if o.auth == me { continue; }
            if dist(o.pos, o.meta.0) > 0.0005 || (o.q[0] * o.meta.1[0] + o.q[1] * o.meta.1[1] + o.q[2] * o.meta.1[2] + o.q[3] * o.meta.1[3]).abs() < 0.99999 { lerp3(&mut o.pos, o.meta.0, kk); o.q = slerp(o.q, o.meta.1, kk); }
        }
        // (los míos que simula otro: se mueven con lo que manda)
        let pa = &self.propios_auth; let objs = &local.objs;
        self.cedidos.retain(|c| objs.iter().any(|o| o.id == c.id) && pa.get(&c.id).map(|a| *a != me).unwrap_or(false));
        for c in self.cedidos.iter_mut() { lerp3(&mut c.pos, c.meta.0, kk); c.q = slerp(c.q, c.meta.1, kk); }
        // (el server creado sigue vivo mientras alguien juega: avisa el de número más chico, cada 3 minutos)
        if let Some(s) = self.sala.clone() { if s.rg {
            self.t_vivo -= dt;
            if self.t_vivo <= 0.0 { self.t_vivo = 180.0; let mut ids: Vec<&str> = self.remotos.iter().map(|r| r.id.as_str()).collect(); ids.push(&self.id); ids.sort(); if ids[0] == self.id { self.sala_vivo(&s.id); } }
        } }
        if t - self.ult_p > 120.0 { self.presencia(); }
        // (de 1,5 a 9 s después de conectar: mirar si donde aparecí está libre)
        if let Some(l) = self.lugar.as_mut() { if l.revisar_t != 0.0 && t > l.revisar_t { l.revisar_t = if t < l.hasta_t { t + 0.5 } else { 0.0 }; l.mando = true; self.eventos.push(Evento::RevisarLugar); } }
        // mi estado (hasta que se revisó el lugar donde aparecí, no: así el que llega es el que se corre)
        let espera = self.lugar.as_ref().map(|l| l.conectado && !l.mando).unwrap_or(false);
        if t - self.ult_e > 0.1 && !espera {
            let e = self.json_estado(&local.jug, t);
            if e != self.e_ant || t - self.ult_e > 1.0 {
                let p = format!("{},\"rt\":{}}}", &e[..e.len() - 1], js_num(r3(local.jug.reloj)));
                self.publicar("e", &p, false); self.e_ant = e; self.ult_e = t;
            }
        }
        // lo que se mueve
        if t - self.ult_m > 0.1 {
            self.ult_m = t; let mut l: Vec<String> = vec![];
            let fila = |k: String, p: [f64; 3], q: [f64; 4]| format!("[{k},{},{},{},{},{},{},{}]", js_num(r3(p[0])), js_num(r3(p[1])), js_num(r3(p[2])), js_num(r4(q[0])), js_num(r4(q[1])), js_num(r4(q[2])), js_num(r4(q[3])));
            for o in &local.objs { if self.propios_auth.get(&o.id).map(|a| *a == self.id).unwrap_or(true) && !o.duerme && !o.congelado && l.len() < 40 { l.push(fila(o.id.to_string(), o.pos, o.q)); } }
            // (como red.js: una de otro que borré sigue en RED.objs hasta que su dueño la saca, y si la simulaba yo, sigue yendo)
            let mut mios: Vec<&ObjRemoto> = self.objs.values().filter(|o| o.auth == self.id && !o.duerme).collect(); mios.sort_by_key(|o| o.seq);
            for o in mios { if l.len() < 50 { l.push(fila(js_str(&o.clave), o.pos, o.q)); } }
            if !l.is_empty() { let c = format!("{{\"l\":[{}]}}", l.join(",")); self.publicar("m", &c, false); }
        }
        // mis cosas (retenido)
        if self.w_sucio || t - self.ult_w > 8.0 {
            self.w_sucio = false; self.ult_w = t;
            let v: Vec<&ObjLocal> = local.objs.iter().filter(|o| !o.no_mundo).collect(); let v = &v[v.len().saturating_sub(300)..];
            // (las mías que simula otro van donde las puso red.rs, congeladas)
            let o: Vec<String> = v.iter().map(|x| {
                let (p, q, cong) = self.cedidos.iter().find(|c| c.id == x.id).map(|c| (c.pos, c.q, true)).unwrap_or((x.pos, x.q, x.congelado));
                format!("[{},{},{},{},{},{},{},{},{},{},{}]", x.id, js_str(&x.nombre), js_num(r3(p[0])), js_num(r3(p[1])), js_num(r3(p[2])), js_num(r4(q[0])), js_num(r4(q[1])), js_num(r4(q[2])), js_num(r4(q[3])), b01(cong), if x.maq.is_empty() { "0" } else { &x.maq })
            }).collect();
            let c = format!("{{\"o\":[{}],\"e\":{},\"md\":{}}}", o.join(","), if local.entidades.is_empty() { "[]" } else { &local.entidades }, if local.mods.is_empty() { "[]" } else { &local.mods });
            let canal = format!("w/{}", self.id); self.publicar(&canal, &c, true);
        }
    }
    /// el JSON de mi estado, sin rt ni i (lo que se compara para no mandar lo mismo)
    fn json_estado(&self, j: &Jugador, t: f64) -> String {
        let raw = |s: &str| if s.is_empty() { "0".to_string() } else { s.to_string() };
        let f = (j.suelo as i32) | (j.agachado as i32) << 1 | (j.vivo as i32) << 2 | (j.vehiculo.is_some() as i32) << 3 | j.bits;
        let mut e = format!("{{\"n\":{},\"k\":{},\"kw\":{},\"h\":{},\"ga\":{},\"ac\":{},\"u\":{},\"c\":{},\"p\":{},\"y\":{},\"t\":{},\"v\":{},\"f\":{f}",
            js_str(&self.nombre), js_str(&j.skin), j.skin_wid.as_deref().map(js_str).unwrap_or("0".into()), js_str(&j.gorro), raw(&j.gorro_aj), raw(&j.acc),
            j.arriba.map(|u| v3j(u, r3)).unwrap_or("0".into()), j.color.as_deref().filter(|c| !c.is_empty()).map(js_str).unwrap_or("0".into()),
            v3j(j.pos, r3), js_num(r3(j.yaw)), js_num(r3(j.pitch)), v3j(j.vel, r3));
        if let Some(a) = &j.arma { e += &format!(",\"a\":{}", js_str(a)); }
        e += &format!(",\"e\":{},\"hp\":{},\"mu\":{},\"w\":{},\"vr\":{}", j.emote.as_deref().filter(|x| !x.is_empty()).map(js_str).unwrap_or("0".into()), js_num(js_round(j.vida).max(0.0)), raw(&j.musica),
            j.vehiculo.as_ref().map(|(k, a)| format!("[{},{a}]", js_str(k))).unwrap_or("0".into()), raw(&j.verity));
        if !j.pill.is_empty() && j.pill != "0" { e += &format!(",\"pl\":{}", j.pill); }
        if let (Some(a), Some(l)) = (&self.antes, &self.lugar) { if t - l.t0 < 20.0 { e += &format!(",\"an\":{}", js_str(a)); } }
        if let Some(s) = j.social.as_deref().filter(|s| digitos(s, 8, 8)) { e += &format!(",\"sp\":{}", js_str(s)); }
        if j.voz { e += ",\"vz\":1"; }
        e + "}"
    }
    fn npc_paso(&mut self, dt: f64, npcs: &[NpcLocal]) {
        // los de otros: se mueven hacia lo último que llegó (se borran a los 4 s sin noticias)
        let t = self.t; let k = 1.0 - (-dt * 12.0).exp();
        let mut fuera = vec![];
        for e in self.npcs_rem.iter_mut() {
            if t - e.t > 4.0 { fuera.push(e.clave.clone()); continue; }
            e.rag = e.f & 6 != 0; e.vivo = e.f & 4 == 0;
            if !e.rag {
                for i in 0..3 { e.meta[i] += e.vel[i] * dt * 0.5; } lerp3(&mut e.pos, e.meta, k);
                let tau = std::f64::consts::TAU; let mut dy = e.yaw_m - e.yaw; dy = ((dy + std::f64::consts::PI) % tau + tau) % tau - std::f64::consts::PI; e.yaw += dy * k; e.suelo = e.f & 1 != 0;
            }
        }
        for c in fuera { self.npcs_rem.retain(|e| e.clave != c); self.eventos.push(Evento::NpcFin { clave: c }); }
        // los míos (cada 0,15 s)
        if self.on && !npcs.is_empty() { self.npc_t -= dt; if self.npc_t <= 0.0 {
            self.npc_t = 0.15;
            let l: Vec<String> = npcs.iter().map(|p| format!("[{},{},{},{},{},{},{},{},{},{},{},{},{},{}]", p.id, js_str(&p.skin), js_num(r3(p.pos[0])), js_num(r3(p.pos[1])), js_num(r3(p.pos[2])), js_num(js_round(p.yaw * 100.0) / 100.0),
                js_num(r3(p.vel[0])), js_num(r3(p.vel[1])), js_num(r3(p.vel[2])), p.f, js_str(&p.emote), js_str(&p.arma), p.tiros.min(9), match (p.tiros > 0, p.mira) { (true, Some(m)) => v3j(m, r3), _ => "0".into() })).collect();
            let c = format!("{{\"k\":\"npcs\",\"l\":[{}]}}", l.join(",")); self.publicar("a", &c, false);
        } }
    }
    /// hostPublicar: la configuración del anfitrión (retenida) y la presencia
    pub fn host_publicar(&mut self) {
        let Some(s) = self.sala.clone() else { return }; if s.of || !self.soy_anfitrion() { return; }
        self.t_cfg = self.t;
        let mw = self.cfg.mapa_w.as_deref().filter(|w| digitos(w, 3, 12)).map(js_str).unwrap_or("0".into());
        let c = format!("{{\"h\":{},\"c\":{},\"pvp\":{},\"nb\":{},\"mp\":{},\"mv\":{},\"ds\":{},\"m\":{},\"mw\":{mw}}}", js_num(to_fixed3(self.cfg.hora)), b01(self.cfg.ciclo), b01(s.pvp), b01(s.nb), s.mp, s.mv, b01(self.cfg.ds), js_str(&self.cfg.mapa));
        self.publicar("cfg", &c, true); self.presencia();
    }
    /// cambió lo del anfitrión (PvP, Nextbots, topes): en la sala y se publica
    pub fn host_cambiar(&mut self, pvp: bool, nb: bool, mp: i32, mv: i32) { if let Some(s) = self.sala.as_mut() { s.pvp = pvp; s.nb = nb; s.mp = mp.clamp(0, 5000); s.mv = mv.clamp(0, 200); } self.host_publicar(); }
    /// echar a uno (sólo el anfitrión) / limpiar el mapa de todos
    pub fn echar(&mut self, id: &str) { let c = format!("{{\"k\":\"kick\",\"to\":{}}}", js_str(id)); self.publicar("a", &c, false); }
    pub fn limpiar(&mut self) { self.publicar("a", "{\"k\":\"limpiar\"}", false); }
    /// redObjeto: cambiaron mis cosas (se puso, se congeló, se soldó…): se manda w en el próximo cuadro
    pub fn objeto_cambio(&mut self) { self.w_sucio = true; }
    /// redRecarga
    pub fn recarga(&mut self) { self.publicar("a", "{\"k\":\"rec\"}", false); }
    /// redDisparo: desde los ojos del personaje (miraOjo) hacia donde apunta (miraDir)
    pub fn disparo(&mut self, arma: &str, o: [f64; 3], dir: [f64; 3]) { let c = format!("{{\"k\":\"tiro\",\"a\":{},\"p\":{},\"d\":{}}}", js_str(arma), v3j(o, r3), v3j(dir, r3)); self.publicar("a", &c, false); }
    /// redExplosion: con la fuente (la clave de la cosa que explotó), el que la recibe borra su copia sin explotarla otra vez
    pub fn explosion(&mut self, p: [f64; 3], r: f64, d: f64, fuente: Option<&str>) {
        if let Some(f) = fuente { self.exp_marcar(f); }
        let r = if r != 0.0 && !r.is_nan() { r } else { 6.0 }; let d = if d != 0.0 && !d.is_nan() { d } else { 100.0 };
        let o = fuente.map(|f| format!(",\"o\":{}", js_str(f))).unwrap_or_default();
        let c = format!("{{\"k\":\"exp\",\"p\":{},\"r\":{},\"d\":{}{o}}}", v3j(p, r3), js_num(r3(r)), js_num(js_round(d))); self.publicar("a", &c, false);
    }
    /// redDano: le pegué a otro jugador (`a`: su id)
    pub fn dano(&mut self, a: &str, dan: f64, dir: [f64; 3]) { let c = format!("{{\"k\":\"dano\",\"to\":{},\"d\":{},\"v\":{}}}", js_str(a), js_num(js_round(dan)), v3j(dir, r3)); self.publicar("a", &c, false); }
    /// redChat (`id`: el del mensaje, para corregirlo después)
    pub fn chat(&mut self, texto: &str, id: Option<&str>) {
        let i = id.map(|x| format!(",\"id\":{}", js_str(x))).unwrap_or_default();
        let c = format!("{{\"n\":{},\"t\":{}{i}}}", js_str(&self.nombre), js_str(&corte16(texto, 120))); self.publicar("c", &c, false);
    }
    /// redReclamar: agarré algo que simula otro (la clave: `clave_propia(id)` o la de la cosa de otro). Some(congelada):
    /// desde ahora lo simulo yo (descongelarla, salvo que su dueño la tuviera congelada); None: no hacía falta
    pub fn reclamar(&mut self, clave: &str) -> Option<bool> {
        if !self.on { return None; }
        let me = self.id.clone();
        let cong = if let Some(o) = self.objs.get_mut(clave) { if o.auth == me { return None; } o.auth = me; o.duerme = false; o.cong_real }
            else if let Some(id) = self.propio_de(clave) {
                match self.propios_auth.get(&id) { None => return None, Some(a) if *a == me => return None, _ => {} }
                self.propios_auth.insert(id, me); let c = self.cedidos.iter().find(|c| c.id == id).map(|c| c.cong_real).unwrap_or(false); self.cedidos.retain(|c| c.id != id); c
            } else { return None };
        let c = format!("{{\"k\":\"claim\",\"o\":{}}}", js_str(clave)); self.publicar("a", &c, false);
        Some(cong)
    }
    /// redBorrar: borré una cosa (mía o de otro: entonces le aviso a su dueño)
    pub fn borrar(&mut self, clave: &str) {
        self.w_sucio = true;
        if let Some(o) = self.objs.get_mut(clave) { o.borrado = true; let c = format!("{{\"k\":\"borra\",\"o\":{}}}", js_str(clave)); self.publicar("a", &c, false); }
    }
    /// los NPC: se fue uno mío, dice algo, le pegué a uno de otro (dueño y número), le cambié la actitud a uno de otro
    pub fn npc_fin(&mut self, n: i32) { self.publicar("a", &format!("{{\"k\":\"npcfin\",\"n\":{n}}}"), false); }
    pub fn npc_dice(&mut self, n: i32, texto: &str) { let c = format!("{{\"k\":\"npcdi\",\"n\":{n},\"t\":{}}}", js_str(&corte16(texto, 80))); self.publicar("a", &c, false); }
    pub fn npc_dano(&mut self, dueno: &str, n: i32, dan: f64, v: [f64; 3], tumba: bool) {
        let c = format!("{{\"k\":\"npcdan\",\"to\":{},\"n\":{n},\"d\":{},\"v\":{}{}}}", js_str(dueno), js_num(js_round(dan)), v3j(v, r3), if tumba { ",\"tumba\":1" } else { "" }); self.publicar("a", &c, false);
    }
    pub fn npc_act(&mut self, dueno: &str, n: i32, a_json: &str) { let c = format!("{{\"k\":\"npcact\",\"to\":{},\"n\":{n},\"a\":{a_json}}}", js_str(dueno)); self.publicar("a", &c, false); }
}

// ---------------- dónde se dibuja a otro jugador ----------------
// Cada estado trae el reloj de la física del que lo manda (rt) y se lo dibuja un poquito en el pasado (lo que tardan en
// llegar dos estados seguidos y su variación), entre las dos muestras de ese momento, con sus velocidades (Hermite); el
// reloj de dibujo va al ritmo del que manda y se apura o se frena de a poco. Uno sin rt (una versión vieja) se acerca a
// lo último que llegó. (remotoMuestra, remotoMuestraPaso y remotoPaso de red.js, con las mismas cuentas)
fn remoto_muestra(r: &mut Remoto, d: &Value, ahora: f64) {
    let rt = match d.get("rt").and_then(|v| v.as_f64()) { Some(x) if x.is_finite() && x >= 0.0 => x, _ => -1.0 };
    if rt < 0.0 || !d.get("p").map(|p| p.is_array()).unwrap_or(false) { r.mm = None; return; }
    let l = r.mm.get_or_insert_with(Vec::new); let u = l.last().copied();
    if let Some(u) = u { if rt <= u.rt { if rt < u.rt - 2.0 { l.clear(); r.rr = None; r.mm_h = None; } else { return; } } }
    let h = r.mm_h.get_or_insert_with(Vec::new); h.push((rt, ahora)); while h.len() > 2 && ahora - h[0].1 > 2.5 { h.remove(0); }
    let sh = h[h.len() - 1].1 - h[0].1; r.mm_rit = if sh > 0.5 { ((h[h.len() - 1].0 - h[0].0) / sh).clamp(0.05, 1.5) } else { 1.0 };
    if let Some(u) = u {
        let dr = rt - u.rt; let da = (ahora - u.lleg) * if r.mm_rit < 0.8 { r.mm_rit } else { 1.0 };
        if dr < 0.35 { r.mm_int = if r.mm_int != 0.0 { r.mm_int + (dr - r.mm_int) * 0.15 } else { dr }; }
        if dr < 2.0 { r.mm_jit += ((da - dr).abs() - r.mm_jit) * 0.15; }
    }
    let f = int32(d.get("f")); let mut v = r.vel_red; if f & 1 != 0 { v[1] = v[1].max(0.0); }
    let l = r.mm.as_mut().unwrap(); l.push(Muestra { rt, p: r.meta, v, f, lleg: ahora }); if l.len() > 16 { l.remove(0); }
    let dd = ((if r.mm_int != 0.0 { r.mm_int } else { 0.12 }) * 1.15 + 2.5 * r.mm_jit).clamp(0.1, 0.5);
    if r.rr.is_none() || l.len() == 1 { r.rr = Some(rt - dd); r.rr_err = 0.0; r.mm_t = ahora; }
    else { r.rr_err = rt - r.rr.unwrap() - dd; if r.rr_err.abs() > 0.75 { r.rr = Some(rt - dd); r.rr_err = 0.0; } }
}
fn remoto_muestra_paso(r: &mut Remoto, ahora: f64, grav: f64) {
    let dt = (ahora - if r.mm_t != 0.0 { r.mm_t } else { ahora }).clamp(0.0, 0.5); r.mm_t = ahora;
    let rit0 = if r.mm_rit != 0.0 { r.mm_rit } else { 1.0 }; let rs0 = if r.mm_rit_s != 0.0 { r.mm_rit_s } else { 1.0 };
    r.mm_rit_s = rs0 + ((if rit0 < 0.8 { r.mm_rit } else { 1.0 }) - rs0) * (dt * 1.5).min(1.0);
    let rit = r.mm_rit_s; let adv = dt * rit * (1.0 + (r.rr_err * 0.6).clamp(-0.6, 0.25));
    let l = r.mm.as_mut().unwrap();
    let rr = (r.rr.unwrap_or(0.0) + adv).min(l[l.len() - 1].rt + 0.2); r.rr = Some(rr); r.rr_err -= adv - dt * rit;
    while l.len() > 2 && l[1].rt <= rr { l.remove(0); }
    let a = l[0]; let b = l.get(1).copied();
    let (p, v, f);
    match b {
        Some(b) if rr < b.rt => {
            if rr <= a.rt { p = a.p; v = a.v; f = a.f; }
            else {
                let t0 = if b.rt - a.rt > 0.3 { a.rt.max(b.rt - 0.13) } else { a.rt }; let tt = b.rt - t0;
                if rr <= t0 { p = a.p; v = a.v; f = a.f; }
                else {
                    let w = (rr - t0) / tt; let (w2, w3) = (w * w, w * w * w);
                    let (h00, h10, h01, h11) = (2.0 * w3 - 3.0 * w2 + 1.0, w3 - 2.0 * w2 + w, -2.0 * w3 + 3.0 * w2, w3 - w2);
                    let s: Vec<f64> = (0..3).map(|i| b.p[i] - a.p[i] - (a.v[i] + b.v[i]) * 0.5 * tt).collect();
                    p = if s[0] * s[0] + s[1] * s[1] + s[2] * s[2] > 9.0 { a.p } else {
                        let hm = |i: usize| h00 * a.p[i] + h10 * tt * a.v[i] + h01 * b.p[i] + h11 * tt * b.v[i];
                        [hm(0), a.p[1].min(b.p[1]).max(hm(1)), hm(2)]
                    };
                    v = [a.v[0] + (b.v[0] - a.v[0]) * w, a.v[1] + (b.v[1] - a.v[1]) * w, a.v[2] + (b.v[2] - a.v[2]) * w]; f = if w < 0.5 { a.f } else { b.f };
                }
            }
        }
        _ => {
            // (sin la muestra que sigue: con su velocidad, hasta 0,2 s; en el piso, sin bajar)
            let u = b.unwrap_or(a); let e = (rr - u.rt).clamp(0.0, 0.2); let g = GRAV * grav;
            p = [u.p[0] + u.v[0] * e, if u.f & 1 != 0 { u.p[1] } else { (u.p[1] - 0.3).max(u.p[1] + u.v[1] * e - 0.5 * g * e * e) }, u.p[2] + u.v[2] * e];
            v = u.v; f = u.f;
        }
    }
    r.mm_v = v; r.mm_f = f; r.pos = p;
}
/// remotoPaso: false si hace 10 s que no manda nada (se va)
fn remoto_paso(r: &mut Remoto, dt: f64, t: f64, ahora: f64, grav: f64) -> bool {
    if t - r.t > 10.0 { return false; }
    let k = 1.0 - (-dt * 12.0).exp(); let mm = r.mm.as_ref().map(|l| !l.is_empty()).unwrap_or(false);
    if mm { remoto_muestra_paso(r, ahora, if grav != 0.0 { grav } else { 1.0 }); }
    else {
        if t - r.t < 0.5 { r.meta[0] += r.vel_red[0] * dt * 0.5; r.meta[2] += r.vel_red[2] * dt * 0.5; if r.f & 1 == 0 { r.meta[1] += r.vel_red[1] * dt * 0.5; } }
        let m = r.meta; lerp3(&mut r.pos, m, k);
    }
    let tau = std::f64::consts::TAU; let mut dy = r.yaw_m - r.yaw; dy = ((dy + std::f64::consts::PI) % tau + tau) % tau - std::f64::consts::PI; r.yaw += dy * k;
    r.vel = if mm { r.mm_v } else { r.vel_red }; r.suelo = (if mm { r.mm_f } else { r.f }) & 1 != 0; r.agachado = r.f & 2 != 0; r.sentado = r.f & 8 != 0;
    r.vivo = r.f & 4 != 0; r.rag = !r.vivo || r.f & 32 != 0; r.visible = r.f & 256 == 0;
    if r.globo.is_some() && t > r.globo_hasta { r.globo = None; }
    true
}

// ---------------- el puente con las conexiones de verdad ----------------
/// un pedido HTTP: (método, url, cabeceras, cuerpo) → (código, cuerpo) o el error
pub type Http = Arc<dyn Fn(&str, &str, &[(String, String)], Option<&str>) -> Result<(u16, String), String> + Send + Sync>;
/// Conecta `Red` con las dos conexiones MQTT (mqtt::Conexion, cada una en su hilo) y con el HTTP (un hilo por pedido).
/// `bombear` una vez por cuadro (antes y/o después de `Red::paso`).
pub struct Puente { pub conector: Conector, pub http: Option<Http>, sala: Option<Conexion>, lista: Option<Conexion>, tx: Sender<(u32, Respuesta)>, rx: Receiver<(u32, Respuesta)> }
/// lo que contestó un pedido HTTP: (código, cuerpo) o por qué no se pudo
pub type Respuesta = Result<(u16, String), String>;
impl Puente {
    pub fn nuevo(conector: Conector, http: Option<Http>) -> Puente { let (tx, rx) = channel(); Puente { conector, http, sala: None, lista: None, tx, rx } }
    /// el de la compu: TCP sin TLS (mqtt:// y ws://) y sin HTTP
    pub fn tcp() -> Puente { Puente::nuevo(Arc::new(mqtt::conectar_tcp), None) }
    fn con(&self, c: Con) -> Option<&Conexion> { match c { Con::Sala => self.sala.as_ref(), Con::Lista => self.lista.as_ref() } }
    pub fn bombear(&mut self, red: &mut Red) {
        for c in [Con::Lista, Con::Sala] {
            let Some(x) = self.con(c) else { continue };
            for s in x.sucesos() { match s { Suceso::Conectado => red.conectado(c), Suceso::Desconectado(_) => red.desconectado(c), Suceso::Mensaje { topic, payload, .. } => red.mensaje(c, &topic, &payload) } }
        }
        while let Ok((id, r)) = self.rx.try_recv() { red.http_respuesta(id, r); }
        self.ejecutar(red.ordenes());
    }
    fn ejecutar(&mut self, ordenes: Vec<Orden>) {
        for o in ordenes {
            match o {
                Orden::Conectar(c, op) => { let n = Conexion::abrir(op, self.conector.clone()); let v = match c { Con::Sala => self.sala.replace(n), Con::Lista => self.lista.replace(n) }; if let Some(mut v) = v { v.cerrar(); } }
                Orden::Suscribir(c, t) => { if let Some(x) = self.con(c) { x.suscribir(&t); } }
                Orden::Desuscribir(c, t) => { if let Some(x) = self.con(c) { x.desuscribir(&t); } }
                Orden::Publicar { con, topic, payload, retain } => { if let Some(x) = self.con(con) { x.publicar(&topic, payload.as_bytes(), 0, retain); } }
                Orden::PublicarBin { con, topic, payload } => { if let Some(x) = self.con(con) { x.publicar(&topic, &payload, 0, false); } }
                Orden::Cerrar(c) => { let v = match c { Con::Sala => self.sala.take(), Con::Lista => self.lista.take() }; if let Some(mut v) = v { v.cerrar(); } }
                Orden::Http { id, metodo, url, cabeceras, cuerpo } => {
                    let tx = self.tx.clone();
                    match self.http.clone() {
                        Some(h) => { let _ = std::thread::Builder::new().name("jx-http".into()).spawn(move || { let _ = tx.send((id, h(metodo, &url, &cabeceras, cuerpo.as_deref()))); }); }
                        None => { let _ = tx.send((id, Err("sin HTTP".into()))); }
                    }
                }
            }
        }
    }
    /// cerrar las dos conexiones (al salir del juego)
    pub fn cerrar(&mut self) { if let Some(mut c) = self.sala.take() { c.cerrar(); } if let Some(mut c) = self.lista.take() { c.cerrar(); } }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn cuentas_de_js() {
        assert_eq!(js_num(1.5), "1.5"); assert_eq!(js_num(2.0), "2"); assert_eq!(js_num(-0.0), "0"); assert_eq!(js_num(1e-7), "1e-7"); assert_eq!(js_num(1.5e21), "1.5e+21");
        assert_eq!(js_num(0.1 + 0.2), "0.30000000000000004"); assert_eq!(js_num(123456789012.0), "123456789012");
        assert_eq!(js_round(-2.5), -2.0); assert_eq!(js_round(2.5), 3.0); assert_eq!(r3(1.0005), 1.001); assert_eq!(r3(-1.0005), -1.0);
        assert_eq!(js_str("a\"b\\c\n\u{1}ñ"), "\"a\\\"b\\\\c\\n\\u0001ñ\"");
        assert_eq!(hash_txt("kabc123secreto"), { let mut h: u32 = 2166136261; for c in "kabc123secreto".bytes() { h ^= c as u32; h = h.wrapping_mul(16777619); } base36(h as u64) });
        assert_eq!(limpio_txt("  <b>Juan</b> \"x\"  ", 16), "bJuan/b x"); assert_eq!(limpio(Some(&Value::from(12)), 16), "12"); assert_eq!(limpio(Some(&Value::from(0)), 16), "");
        assert_eq!(int32(Some(&Value::from(4294967297.0))), 1); assert_eq!(int32(Some(&Value::from("12"))), 12); assert_eq!(int32(Some(&Value::from(-3.7))), -3);
        assert_eq!(to_fixed3(0.0625), 0.063); assert_eq!(to_fixed3(12.3456), 12.346); assert_eq!(to_fixed3(-0.0625), -0.063);
        let s = Sala::oficial("RB_Flatgrass"); assert_eq!(s.topico(), "jxmod_v1_f_RB_Flatgrass_1"); assert_eq!(s.n, "JXMod Flatgrass");
    }
    /// la voz de la nativa: «vz» en el estado, el binario por ROOM/v/ID y del otro lado llega sólo de uno que está en la sala
    #[test]
    fn voz_de_ida_y_vuelta() {
        let mut a = Red::nueva(Some("aaaa"), "A"); let mut b = Red::nueva(Some("bbbb"), "B");
        for r in [&mut a, &mut b] { r.on = true; r.sala_abierta = true; r.room = "sala_x".into(); }
        let j = Jugador { voz: true, vivo: true, ..Default::default() }; let e = a.json_estado(&j, 0.0); assert!(e.contains("\"vz\":1"), "{e}");
        assert!(!a.json_estado(&Jugador::default(), 0.0).contains("vz"));
        b.red_mensaje("sala_x/e", format!("{},\"i\":\"aaaa\"}}", &e[..e.len() - 1]).as_bytes());
        assert!(b.remoto("aaaa").map(|r| r.voz).unwrap_or(false), "B sabe que A escucha la voz");
        let datos = vec![b'J', 1, 0, 1, 0, 0, 0]; a.publicar_voz(datos.clone());
        let (topic, payload) = a.ordenes().into_iter().find_map(|o| match o { Orden::PublicarBin { topic, payload, .. } => Some((topic, payload)), _ => None }).expect("publicó");
        assert_eq!(topic, "sala_x/v/aaaa");
        b.eventos.clear(); b.red_mensaje(&topic, &payload);
        assert!(b.eventos().contains(&Evento::Voz { de: "aaaa".into(), datos }), "B recibió la voz");
        // (de uno que no está en la sala, o la mía, no)
        b.red_mensaje("sala_x/v/cccc", b"J"); b.red_mensaje("sala_x/v/bbbb", b"J"); assert!(b.eventos().is_empty());
    }
}
