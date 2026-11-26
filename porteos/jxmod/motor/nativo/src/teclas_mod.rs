//! Los botones de las teclas de las armas de los mods de GMod (ctlBotonesDeArma de controles.js y acciones.js de la web):
//! con un arma de un addon en la mano se lee su Lua y el de sus bases (Gmod::fuentes_arma) y se buscan las teclas que pide
//! (IN_ZOOM, IN_USE…, KEY_V, KEY_SPACE…); cada una pasa a un botón, hasta 4, en arco arriba del disparo (los lugares que la
//! web les da: hud_web.rs). Qué hace cada tecla —para su ícono y su nombre en vez de la letra sola— sale de leer el Lua
//! alrededor de cada uso (los nombres de las funciones, los comandos, los textos y los comentarios) y darle puntos a cada
//! acción conocida (acciones_web.json, de herramientas/acciones_nativo.mjs): gana la que más suma, con un mínimo.
use super::Juego;
use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Clone, Debug, PartialEq)]
pub struct Accion { pub id: String, pub es: String, pub glifo: String, pub prio: i32 }
/// un botón: su letra, la tecla del navegador que aprieta (KeyV…) o el bit IN_* de GMod, y lo que hace
#[derive(Clone, Debug, PartialEq)]
pub struct BotonTecla { pub id: String, pub t: String, pub tecla: Option<String>, pub bit: u32, pub acc: Option<Accion> }

struct Tabla { acc: Vec<(Accion, Vec<String>)>, previo: HashMap<String, (String, f32)>, fija: HashMap<String, String> }
fn tabla() -> &'static Tabla {
    static T: OnceLock<Tabla> = OnceLock::new();
    T.get_or_init(|| {
        let v: serde_json::Value = serde_json::from_str(include_str!("acciones_web.json")).unwrap_or_default();
        let s = |x: &serde_json::Value| x.as_str().unwrap_or("").to_string();
        let acc = v["acc"].as_array().into_iter().flatten().map(|a| (Accion { id: s(&a["id"]), es: s(&a["es"]), glifo: s(&a["glifo"]), prio: a["prio"].as_i64().unwrap_or(0) as i32 },
            a["pal"].as_array().into_iter().flatten().map(s).collect())).collect();
        let previo = v["previo"].as_object().into_iter().flatten().map(|(k, x)| (k.clone(), (s(&x[0]), x[1].as_f64().unwrap_or(0.0) as f32))).collect();
        let fija = v["fija"].as_object().into_iter().flatten().map(|(k, x)| (k.clone(), s(x))).collect();
        Tabla { acc, previo, fija }
    })
}
fn de_id(id: &str) -> Option<Accion> { tabla().acc.iter().find(|a| a.0.id == id).map(|a| a.0.clone()) }

fn es_pal(c: char) -> bool { c.is_ascii_alphanumeric() || c == '_' }
/// ¿hay un nombre de tecla (KEY_X, IN_X, MOUSE_X) que empieza en `i`?
fn token_tecla(s: &[u8], i: usize) -> Option<usize> {
    if i > 0 && es_pal(s[i - 1] as char) { return None; }
    for p in [&b"KEY_"[..], b"IN_", b"MOUSE_"] {
        if s[i..].starts_with(p) { let mut j = i + p.len(); while j < s.len() && (s[j].is_ascii_uppercase() || s[j].is_ascii_digit() || s[j] == b'_') { j += 1; }
            if j > i + p.len() && (j >= s.len() || !es_pal(s[j] as char)) { return Some(j); } }
    }
    None
}
/// accPalabras: palabras sueltas en minúsculas, sin los nombres de las teclas, con los camelCase y los guiones bajos
/// partidos (ToggleNightVision → toggle night vision), con un espacio a cada lado
pub fn palabras(s: &str) -> String {
    let b = s.as_bytes(); let mut o = String::with_capacity(s.len() + 2); o.push(' ');
    let mut i = 0; let mut ant = ' ';
    while i < b.len() {
        if b[i].is_ascii_uppercase() { if let Some(j) = token_tecla(b, i) { if !o.ends_with(' ') { o.push(' '); } i = j; ant = ' '; continue; } }
        let c = s[i..].chars().next().unwrap(); let n = c.len_utf8();
        if c.is_uppercase() && ant.is_lowercase() { o.push(' '); }
        if "_-.:()[]{}\"',;=<>!~".contains(c) || c.is_whitespace() { if !o.ends_with(' ') { o.push(' '); } } else { o.extend(c.to_lowercase()); }
        ant = c; i += n;
    }
    if !o.ends_with(' ') { o.push(' '); }
    o
}
/// el texto alrededor de un uso de la tecla (accVentana): antes, después, la línea y sus textos entre comillas
pub struct Ventana { antes: String, despues: String, linea: String, textos: String }
fn ventana(s: &str, i: usize, largo: usize) -> Ventana {
    let piso = |mut k: usize| { while !s.is_char_boundary(k) { k -= 1; } k };
    let a0 = piso(i.saturating_sub(160)); let mut antes = &s[a0..i];
    let d0 = (i + largo).min(s.len()); let d1 = piso((d0 + 320).min(s.len())); let despues = &s[d0..d1];
    // (hasta donde empieza otra tecla o el bind siguiente)
    let db = despues.as_bytes(); let mut corte = None;
    for j in 0..db.len() { if (db[j] == b'K' || db[j] == b'I' || db[j] == b'M') && token_tecla(db, j).is_some() { corte = Some(j); break; }
        if db[j..].starts_with(b"bind") { let mut k = j + 4; while k < db.len() && db[k].is_ascii_whitespace() { k += 1; } if db[k..].starts_with(b"==") { corte = Some(j); break; } } }
    let despues = match corte { Some(j) if j > 12 => &despues[..j], _ => despues };
    // (desde la línea de la última tecla de antes)
    let ab = antes.as_bytes(); if let Some(u) = (0..ab.len()).rev().find(|&j| token_tecla(ab, j).is_some()) { let k = antes[..u].rfind('\n').map(|x| x + 1).unwrap_or(0); antes = &antes[k..]; }
    let l0 = s[..i].rfind('\n').map(|x| x + 1).unwrap_or(0); let l1 = s[i..].find('\n').map(|x| x + i).unwrap_or(s.len());
    let linea: String = s[l0..l1].chars().take(400).collect();
    let mut textos = String::new();
    for q in ['"', '\''] { let mut it = linea.split(q); it.next(); while let (Some(t), Some(_)) = (it.next(), it.next()) { let n = t.chars().count(); if (3..=160).contains(&n) { textos.push_str(t); textos.push(' '); } } }
    Ventana { antes: antes.to_string(), despues: despues.to_string(), linea, textos }
}
/// las ventanas de una tecla en el texto (accVentanasDe: hasta 6 usos; no la que un mod está cambiando —from = …—)
pub fn ventanas(s: &str, tok: &str) -> Vec<Ventana> {
    let mut v = vec![]; let mut desde = 0;
    while let Some(p) = s[desde..].find(tok) {
        let i = desde + p; desde = i + tok.len();
        if tok.bytes().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == b'_') && s[desde..].chars().next().map_or(false, es_pal) { continue; }
        let antes: String = s[i.saturating_sub(12)..i].chars().filter(|c| !c.is_whitespace()).collect(); if antes.ends_with("from=") { continue; }
        v.push(ventana(s, i, tok.len())); if v.len() >= 6 { break; }
    }
    v
}
/// accDe: la acción de una tecla (`clave`: «in:ZOOM», «key:KeyV», «bind:+zoom») por sus ventanas, o None si no llega
pub fn accion(clave: &str, vs: &[Ventana]) -> Option<Accion> {
    let t = tabla();
    if let Some(id) = t.fija.get(clave) { return de_id(id); }
    let mut p: HashMap<&str, f32> = HashMap::new();
    if let Some((id, v)) = t.previo.get(clave) { *p.entry(id.as_str()).or_default() += v; }
    for w in vs {
        let (a, d, tx, l) = (palabras(&w.antes), palabras(&w.despues), palabras(&w.textos), palabras(&w.linea));
        for (ac, pal) in &t.acc { for p0 in pal {
            let debil = p0.starts_with('~'); let q = p0.trim_start_matches('~').trim(); let suelta = q.chars().count() <= 3;
            let re = if suelta { format!(" {q} ") } else { q.to_string() }; let n = q.chars().count();
            let largo = (if n >= 6 { 1.5 } else if n >= 4 { 1.2 } else { 1.0 }) * if debil { 0.4 } else { 1.0 };
            let s = if tx.contains(&re) { 3.2 } else if l.contains(&re) { 2.0 } else if d.contains(&re) { 1.6 } else if a.contains(&re) { 0.8 } else { 0.0 };
            if s > 0.0 { *p.entry(ac.id.as_str()).or_default() += s * largo; }
        } }
    }
    let mejor = p.into_iter().fold(None::<(&str, f32)>, |m, x| match m { Some(y) if y.1 >= x.1 => Some(y), _ => Some(x) })?;
    if mejor.1 < 1.6 { return None; }
    de_id(mejor.0)
}
/// el Lua sin comentarios (--[[ … ]] y -- hasta el fin de la línea)
pub fn sin_comentarios(s: &str) -> String {
    let mut o = String::with_capacity(s.len()); let mut i = 0; let b = s.as_bytes();
    while i < b.len() {
        if b[i] == b'-' && b.get(i + 1) == Some(&b'-') {
            if s[i + 2..].starts_with("[[") { i = s[i + 4..].find("]]").map(|k| i + 4 + k + 2).unwrap_or(b.len()); }
            else { i = s[i..].find('\n').map(|k| i + k).unwrap_or(b.len()); }
            continue;
        }
        let c = s[i..].chars().next().unwrap(); o.push(c); i += c.len_utf8();
    }
    o
}
/// los botones de un arma por su Lua (ctlBotonesDeArma): hasta 4, primero los que más se usan con el pulgar
pub fn leer(crudo: &str) -> Vec<BotonTecla> {
    let s = sin_comentarios(crudo); let b = s.as_bytes(); let mut out: Vec<BotonTecla> = vec![];
    let mut i = 0;
    while i < b.len() {
        let Some(j) = (if b[i] == b'I' || b[i] == b'K' { token_tecla(b, i) } else { None }) else { i += 1; continue };
        let tok = &s[i..j]; i = j;
        if let Some(n) = tok.strip_prefix("IN_") {
            // (CTL_IN de la web: USE es la E; las demás, su bit)
            let (t, tecla, bit) = match n { "USE" => ("E", Some("KeyE"), 0), "ZOOM" => ("Zoom", None, 0x80000), "WALK" => ("Caminar", None, 0x40000), "SPEED" => ("Correr", None, 0x20000),
                "GRENADE1" => ("G1", None, 0x800000), "GRENADE2" => ("G2", None, 0x1000000), "ALT1" => ("Alt", None, 0x4000), "ALT2" => ("Alt2", None, 0x8000), _ => continue };
            if out.iter().any(|x| x.id == tok) { continue; }
            out.push(BotonTecla { id: tok.into(), t: t.into(), tecla: tecla.map(String::from), bit, acc: None });
        } else if let Some(k) = tok.strip_prefix("KEY_") {
            let code = if k.len() == 1 && k.as_bytes()[0].is_ascii_uppercase() { format!("Key{k}") } else if k.len() == 1 && k.as_bytes()[0].is_ascii_digit() { format!("Digit{k}") }
                else { match k { "SPACE" => "Space".into(), "LALT" => "AltLeft".into(), "TAB" => "Tab".into(), _ => continue } };
            if out.iter().any(|x| x.tecla.as_deref() == Some(&code)) { continue; }
            let t = match k { "SPACE" => "Espacio", "LALT" => "Alt", x => x };
            out.push(BotonTecla { id: tok.into(), t: t.into(), tecla: Some(code), bit: 0, acc: None });
        }
    }
    for x in &mut out {
        let clave = if let Some(n) = x.id.strip_prefix("IN_") { format!("in:{n}") } else { format!("key:{}", x.tecla.clone().unwrap_or_default()) };
        x.acc = accion(&clave, &ventanas(crudo, &x.id));
    }
    out.sort_by_key(|x| -x.acc.as_ref().map_or(0, |a| a.prio));
    let mut ya: Vec<String> = vec![];
    out.retain(|x| match &x.acc { Some(a) => { if ya.contains(&a.id) { false } else { ya.push(a.id.clone()); true } } None => true });
    out.truncate(4);
    out
}

impl Juego {
    /// cada cuadro: si cambió el arma del mod en la mano, se leen sus teclas
    pub fn teclas_mod_paso(&mut self) {
        let clase = self.gmod_clase_arma().unwrap_or_default();
        if clase == self.gmod.teclas_de { return; }
        self.gmod.teclas = if clase.is_empty() { vec![] } else { self.gmod.gm.as_ref().map(|g| leer(&g.fuentes_arma(&clase))).unwrap_or_default() };
        self.gmod.teclas_de = clase;
    }
    /// lo que aprietan los botones de las teclas: los códigos de tecla y los bits IN_*
    pub fn teclas_mod_apretadas(&self) -> (Vec<String>, u32) {
        let (mut v, mut bits) = (vec![], 0u32);
        for (i, b) in self.gmod.teclas.iter().enumerate() {
            if !self.apretado(super::Boton::Jg(super::jugabilidad::Bj::Tecla(i as u8))) { continue; }
            if let Some(t) = &b.tecla { v.push(t.clone()); } bits |= b.bit;
        }
        (v, bits)
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn lee_teclas_y_acciones() {
        assert_eq!(palabras("ToggleNightVision(KEY_N)"), " toggle night vision ");
        let lua = r#"
-- la mira telescópica
if input.IsKeyDown(KEY_N) then self:ToggleNightVision() end -- visión nocturna
CreateClientConVar("bat_light_key", KEY_F, true, false, "Key: toggle flashlight")
if self.Owner:KeyDown(IN_ZOOM) then self:SetZoom(true) end
if input.IsKeyDown(KEY_V) then self:Melee() end
"#;
        let v = leer(lua);
        let ids: Vec<String> = v.iter().map(|b| b.acc.as_ref().map(|a| a.id.clone()).unwrap_or_else(|| b.t.clone())).collect();
        assert!(ids.contains(&"zoom".to_string()), "{ids:?}"); assert!(ids.contains(&"vision".to_string()), "{ids:?}");
        assert!(ids.contains(&"linterna".to_string()), "{ids:?}"); assert!(ids.contains(&"golpe".to_string()), "{ids:?}");
        assert_eq!(v[0].acc.as_ref().unwrap().id, "zoom"); assert_eq!(v.iter().find(|b| b.id == "IN_ZOOM").unwrap().bit, 0x80000);
        assert_eq!(sin_comentarios("a --[[ x ]] b -- c\nd"), "a  b \nd");
    }
}
