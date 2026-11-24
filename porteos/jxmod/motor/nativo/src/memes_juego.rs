//! memes.js en la nativa: tocás un meme (la app Memes del celular), suena desde tu personaje, sale en el chat y en la sala
//! suena para los que están cerca (desde el tuyo, en el lugar). Los incluidos vienen en el paquete aparte a_memes (MM_<id>)
//! y se decodifican recién al tocarlos. «Mis memes»: los audios cortos (hasta 400 KB) de la carpeta memes/ de los datos de
//! la app; el id sale del contenido (SHA-1, como la web: el mismo audio en dos aparatos es el mismo meme) y en la sala
//! viaja de a pedazos la primera vez que suena (24 mil letras por mensaje, 8 por segundo). Uno cada 0,8 s por jugador.
//! En la compu no hay decodificador (Sonido es mudo ahí): todo lo demás anda igual.
use super::*;
use std::collections::HashMap;
use jxjuego::censura;
use serde_json::Value;

const MAX: usize = 400 * 1024;
const ESPERA: f64 = 0.8;
const COLORES: [&str; 10] = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#00acc1", "#1e88e5", "#8e24aa", "#d81b60", "#6d4c41", "#546e7a"];

#[derive(Default)]
pub struct Memes {
    /// el último que toqué y el último de cada jugador (s)
    t: Option<f64>, ult: HashMap<String, f64>,
    /// los míos: (id, nombre, color, archivo)
    mios: Option<Vec<(String, String, String, std::path::PathBuf)>>,
    /// los de la sala que ya llegaron enteros (id → archivo), los que vienen llegando y los que sonaron antes de llegar
    sala: HashMap<String, std::path::PathBuf>, partes: HashMap<String, (usize, Vec<Option<String>>)>, esperan: HashMap<String, (String, f64)>,
    /// los míos ya mandados y los pedazos por mandar (uno cada 0,125 s)
    enviados: std::collections::HashSet<String>, cola: std::collections::VecDeque<String>, t_cola: f64,
    /// MEME_OTROS: si suenan los de los demás (siguen apareciendo en el chat)
    pub mudos: bool,
    /// los renglones de memes que fueron al chat (para las pruebas)
    pub renglones: Vec<String>,
}

fn ahora() -> f64 { static T0: std::sync::OnceLock<Instant> = std::sync::OnceLock::new(); T0.get_or_init(Instant::now).elapsed().as_secs_f64() }
fn id_valido(id: &str) -> bool {
    let ok = |s: &str, a: usize, b: usize| s.len() >= a && s.len() <= b && s.bytes().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit());
    if let Some(r) = id.strip_prefix("rb:") { ok(r, 1, 16) } else if let Some(r) = id.strip_prefix("u:") { ok(r, 6, 16) } else { false }
}

impl Juego {
    /// los memes de una pestaña (0 los incluidos, 1 los míos): (id, nombre, color #rrggbb)
    /// (los míos, si ya se leyeron: memes_cargar)
    pub fn memes_lista(&self, tab: u8) -> Vec<(String, String, String)> {
        if tab == 1 { return self.memes.mios.iter().flatten().map(|m| (m.0.clone(), m.1.clone(), m.2.clone())).collect(); }
        self.paq.as_ref().and_then(|p| p.d["memes"].as_array().map(|a| a.iter().map(|m| (format!("rb:{}", m[0].as_str().unwrap_or("")), m[1].as_str().unwrap_or("").to_string(), m[3].as_str().filter(|s| s.len() == 7 && s.starts_with('#')).unwrap_or("#888888").to_string())).collect())).unwrap_or_default()
    }
    /// lee la carpeta de los míos (al abrir la app Memes)
    pub(crate) fn memes_cargar(&mut self) { self.memes.mios = None; let _ = self.memes_mios(); }
    /// los míos: la carpeta memes/ de los datos (se lee una vez; los que pasan de 400 KB no van)
    fn memes_mios(&mut self) -> &Vec<(String, String, String, std::path::PathBuf)> {
        if self.memes.mios.is_none() {
            let mut v = vec![];
            if let Some(d) = &self.datos {
                let c = d.join("memes"); let _ = std::fs::create_dir_all(&c);
                let mut l: Vec<_> = std::fs::read_dir(&c).into_iter().flatten().flatten().map(|e| e.path()).filter(|p| p.extension().and_then(|e| e.to_str()).map(|e| ["mp3", "ogg", "wav", "m4a", "aac"].contains(&e.to_lowercase().as_str())).unwrap_or(false)).collect();
                l.sort();
                for p in l {
                    let Ok(b) = std::fs::read(&p) else { continue }; if b.is_empty() || b.len() > MAX { continue }
                    let h = sha1(&b); let id = format!("u:{}", h[..6].iter().map(|x| format!("{x:02x}")).collect::<String>());
                    let n: String = p.file_stem().and_then(|s| s.to_str()).unwrap_or("Meme").chars().take(24).collect();
                    v.push((id, if n.is_empty() { "Meme".into() } else { n }, COLORES[h[7] as usize % COLORES.len()].to_string(), p));
                }
            }
            self.memes.mios = Some(v);
        }
        self.memes.mios.as_ref().unwrap()
    }
    /// el sonido del meme listo en el mezclador (MM_<id>): los incluidos salen de a_memes, los míos y los de la sala de su
    /// archivo; el decodificador del sistema necesita un archivo, así que los incluidos se escriben una vez en memes_rb/
    fn meme_sonido(&mut self, id: &str) -> Option<String> {
        let nom = format!("MM_{id}");
        if self.sonido.tiene(&nom) { return Some(nom); }
        let ruta = if let Some(r) = id.strip_prefix("rb:") {
            let d = self.datos.clone()?.join("memes_rb"); let _ = std::fs::create_dir_all(&d); let f = d.join(format!("{r}.mp3"));
            if !f.exists() {
                let p = self.paq.as_mut()?; let _ = p.asegurar("a_memes");
                let b = p.parte(&format!("a:MM_{r}"))?.to_vec(); std::fs::write(&f, b).ok()?;
            }
            f
        } else if let Some(f) = self.memes.sala.get(id) { f.clone() } else { self.memes_mios().iter().find(|m| m.0 == id)?.3.clone() };
        self.sonido.registrar_archivo(&nom, &ruta).then_some(nom)
    }
    /// suena: el mío plano (0,85), el de otro en su lugar
    fn meme_sonar(&mut self, id: &str, donde: Option<[f32; 3]>) {
        if let Some(n) = self.meme_sonido(id) { self.sonido.tocar(&n, if donde.is_some() { 1.0 } else { 0.85 }, 1.0, donde); }
    }
    /// memeTocar: uno cada 0,8 s; suena, va al chat y a la sala (los míos, con su audio la primera vez)
    pub fn meme_tocar(&mut self, id: &str) -> bool {
        let t = ahora(); if self.memes.t.map(|x| t - x < ESPERA).unwrap_or(false) { return false; }
        let _ = self.memes_mios();
        let Some((_, n, c)) = self.memes_lista(if id.starts_with("u:") { 1 } else { 0 }).into_iter().find(|m| m.0 == id) else { return false };
        self.memes.t = Some(t);
        self.meme_sonar(id, None);
        let yo = if self.en_red.red.nombre.is_empty() { "Vos".to_string() } else { self.en_red.red.nombre.clone() };
        let r = format!("{}: {n}", censura::censurar(&yo)); self.memes.renglones.push(r.clone()); self.en_red.al_chat(r);
        if self.en_red.red.on {
            let mut d = serde_json::json!({ "k": "meme", "m": id, "q": yo, "c": c });
            if id.starts_with("u:") { d["n"] = serde_json::json!(n); }
            self.en_red.red.publicar("a", &d.to_string(), false);
            if id.starts_with("u:") && self.memes.enviados.insert(id.to_string()) {
                if let Some(b) = self.memes_mios().iter().find(|m| m.0 == id).and_then(|m| std::fs::read(&m.3).ok()) {
                    let s = base64(&b); let p: Vec<String> = s.as_bytes().chunks(24000).map(|x| String::from_utf8_lossy(x).into_owned()).collect();
                    for (x, d) in p.iter().enumerate() { self.memes.cola.push_back(serde_json::json!({ "k": "memed", "g": id, "x": x, "n": p.len(), "d": d }).to_string()); }
                }
            }
        }
        true
    }
    /// cada cuadro en la sala: los pedazos por mandar, de a uno cada 0,125 s
    pub(crate) fn memes_paso(&mut self) {
        if self.memes.cola.is_empty() { return; }
        let t = ahora(); if t - self.memes.t_cola < 0.125 { return; }
        if let Some(m) = self.memes.cola.pop_front() { self.memes.t_cola = t; self.en_red.red.publicar("a", &m, false); }
    }
    /// memeRed: lo que llega de la sala (k meme y memed); devuelve si era de memes
    pub(crate) fn meme_red(&mut self, de: &str, k: &str, d: &Value) -> bool {
        let t = ahora();
        let pos = |j: &Juego| j.en_red.red.remotos().iter().find(|r| r.id == de).map(|r| [r.pos[0] as f32, r.pos[1] as f32 + 0.5, r.pos[2] as f32]);
        if k == "meme" {
            let Some(id) = d.get("m").and_then(|v| v.as_str()).filter(|s| id_valido(s)).map(String::from) else { return true };
            if t - self.memes.ult.get(de).copied().unwrap_or(-9.0) < ESPERA * 0.75 { return true; }
            self.memes.ult.insert(de.into(), t);
            let quien = self.en_red.red.remotos().iter().find(|r| r.id == de).map(|r| r.nombre.clone()).unwrap_or_else(|| d.get("q").and_then(|v| v.as_str()).unwrap_or("?").chars().take(24).collect());
            let n = if id.starts_with("rb:") { match self.memes_lista(0).into_iter().find(|m| m.0 == id) { Some(m) => m.1, None => return true } } else { d.get("n").and_then(|v| v.as_str()).unwrap_or("Meme").chars().take(24).collect() };
            let r = format!("{}: {n}", censura::censurar(&quien)); self.memes.renglones.push(r.clone()); self.en_red.al_chat(r);
            if self.memes.mudos { return true; }
            if id.starts_with("u:") && !self.memes.sala.contains_key(&id) && !self.sonido.tiene(&format!("MM_{id}")) { self.memes.esperan.insert(id, (de.into(), t)); return true; }
            let p = pos(self); self.meme_sonar(&id, p);
            return true;
        }
        if k == "memed" {
            let (Some(g), Some(dd)) = (d.get("g").and_then(|v| v.as_str()), d.get("d").and_then(|v| v.as_str())) else { return true };
            if !g.starts_with("u:") || !id_valido(g) || self.memes.sala.contains_key(g) { return true; }
            let n = d.get("n").and_then(|v| v.as_u64()).unwrap_or(0) as usize; let i = d.get("x").and_then(|v| v.as_u64()).unwrap_or(99) as usize;
            if !(1..=30).contains(&n) || i >= n { return true; }
            let e = self.memes.partes.entry(g.to_string()).or_insert_with(|| (n, vec![None; n]));
            if e.0 != n { *e = (n, vec![None; n]); }
            if e.1[i].is_none() { e.1[i] = Some(dd.to_string()); }
            if e.1.iter().any(|x| x.is_none()) { return true; }
            let (_, l) = self.memes.partes.remove(g).unwrap();
            let Some(b) = debase64(&l.into_iter().flatten().collect::<String>()) else { return true }; if b.len() > MAX { return true; }
            let Some(dir) = self.datos.clone().map(|d| d.join("memes_sala")) else { return true }; let _ = std::fs::create_dir_all(&dir);
            let f = dir.join(&g[2..]); if std::fs::write(&f, b).is_err() { return true; }
            self.memes.sala.insert(g.to_string(), f);
            // (si sonó mientras llegaba y no pasaron más de 8 s, ahora)
            if let Some((quien, t0)) = self.memes.esperan.remove(g) { if t - t0 < 8.0 && !self.memes.mudos { let p = self.en_red.red.remotos().iter().find(|r| r.id == quien).map(|r| [r.pos[0] as f32, r.pos[1] as f32 + 0.5, r.pos[2] as f32]); self.meme_sonar(g, p); } }
            return true;
        }
        false
    }
}

/// SHA-1 (el id de los míos sale de los 6 primeros bytes, como crypto.subtle.digest de la web)
pub fn sha1(m: &[u8]) -> [u8; 20] {
    let mut h: [u32; 5] = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    let mut d = m.to_vec(); d.push(0x80); while d.len() % 64 != 56 { d.push(0); } d.extend_from_slice(&((m.len() as u64) * 8).to_be_bytes());
    for b in d.chunks(64) {
        let mut w = [0u32; 80];
        for i in 0..16 { w[i] = u32::from_be_bytes([b[i * 4], b[i * 4 + 1], b[i * 4 + 2], b[i * 4 + 3]]); }
        for i in 16..80 { w[i] = (w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]).rotate_left(1); }
        let [mut a, mut bb, mut c, mut dd, mut e] = h;
        for (i, wi) in w.iter().enumerate() {
            let (f, k) = match i { 0..=19 => ((bb & c) | (!bb & dd), 0x5A827999), 20..=39 => (bb ^ c ^ dd, 0x6ED9EBA1), 40..=59 => ((bb & c) | (bb & dd) | (c & dd), 0x8F1BBCDC), _ => (bb ^ c ^ dd, 0xCA62C1D6) };
            let t = a.rotate_left(5).wrapping_add(f).wrapping_add(e).wrapping_add(k).wrapping_add(*wi);
            e = dd; dd = c; c = bb.rotate_left(30); bb = a; a = t;
        }
        for (x, y) in h.iter_mut().zip([a, bb, c, dd, e]) { *x = x.wrapping_add(y); }
    }
    let mut r = [0u8; 20]; for (i, x) in h.iter().enumerate() { r[i * 4..i * 4 + 4].copy_from_slice(&x.to_be_bytes()); } r
}
const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/// btoa
pub fn base64(b: &[u8]) -> String {
    let mut s = String::with_capacity(b.len().div_ceil(3) * 4);
    for c in b.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        for k in 0..4 { s.push(if k <= c.len() { B64[(n >> (18 - 6 * k)) as usize & 63] as char } else { '=' }); }
    }
    s
}
/// atob (None si no es base64)
pub fn debase64(s: &str) -> Option<Vec<u8>> {
    let mut v = Vec::with_capacity(s.len() / 4 * 3); let (mut acc, mut n) = (0u32, 0);
    for c in s.bytes() {
        if c == b'=' { break; }
        let x = B64.iter().position(|&y| y == c)? as u32; acc = acc << 6 | x; n += 6;
        if n >= 8 { n -= 8; v.push((acc >> n) as u8); acc &= (1 << n) - 1; }
    }
    Some(v)
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn sha1_y_base64() {
        let h = sha1(b"abc"); assert_eq!(h.iter().map(|x| format!("{x:02x}")).collect::<String>(), "a9993e364706816aba3e25717850c26c9cd0d89d");
        assert_eq!(sha1(b"").iter().map(|x| format!("{x:02x}")).collect::<String>(), "da39a3ee5e6b4b0d3255bfef95601890afd80709");
        for t in [&b""[..], b"f", b"fo", b"foo", b"foob", b"fooba", b"foobar"] { assert_eq!(debase64(&base64(t)).unwrap(), t); }
        assert_eq!(base64(b"foobar"), "Zm9vYmFy"); assert_eq!(base64(b"fo"), "Zm8=");
        assert!(id_valido("rb:bruh") && id_valido("u:0a1b2c3d4e5f") && !id_valido("u:../x") && !id_valido("rb:"));
    }
}
