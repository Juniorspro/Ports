//! Los guiones de sonido (gmod_sonidos.js): un nombre como "Weapon_Pistol.Single" → sus .wav, volumen, tono y canal.
//! Primero los de sound.Add del addon; después los de GMod (garrysmod/scripts/sounds: HL2, CS:S, DoD:S, TF2 y L4D), que
//! los addons usan aunque traigan sólo los .wav. La tabla la arma herramientas/gmod_guiones.py:
//! «nombre=wave1,wave2[@volumen][%tono][!canal]», "~" es "weapons/", sin ".wav", y a{1-3} es a1,a2,a3.
use crate::nucleo::*;
use std::collections::HashMap;
use std::cell::RefCell;

const GUIONES: &str = include_str!("guiones_sonido.txt");
/// un guion: rutas (con "sound/" adelante no: como las pide el Lua), volumen, tono (100 = normal) y canal
#[derive(Clone, Debug)]
pub struct Guion { pub w: Vec<String>, pub v: f64, pub p: f64, pub c: i32 }
thread_local! { static TABLA: RefCell<Option<HashMap<&'static str, &'static str>>> = const { RefCell::new(None) }; }
/// gmsnGuion: el guion de GMod con ese nombre (en minúsculas)
pub fn guion_gmod(k: &str) -> Option<Guion> {
    let x = TABLA.with(|t| { let mut t = t.borrow_mut(); let t = t.get_or_insert_with(|| GUIONES.lines().filter_map(|l| l.split_once('=')).collect()); t.get(k).copied() })?;
    let (mut cuerpo, mut v, mut p, mut c) = (x, 1.0, 100.0, 0);
    if let Some((a, b)) = cuerpo.split_once('!') { cuerpo = a; c = b.parse().unwrap_or(0); }
    if let Some((a, b)) = cuerpo.split_once('%') { cuerpo = a; p = b.parse().unwrap_or(100.0); }
    if let Some((a, b)) = cuerpo.split_once('@') { cuerpo = a; v = b.parse().unwrap_or(1.0); }
    let mut w = vec![];
    let pon = |s: &str, w: &mut Vec<String>| { let s = match s.strip_prefix('~') { Some(r) => format!("weapons/{r}"), None => s.to_string() }; let tiene_ext = s.rsplit_once('.').map(|(_, e)| (3..=4).contains(&e.len()) && e.chars().all(|c| c.is_ascii_alphanumeric())).unwrap_or(false); w.push(if tiene_ext { s } else { format!("{s}.wav") }); };
    for a in cuerpo.split(',') {
        if let (Some(i), true) = (a.rfind('{'), a.ends_with('}')) { if let Some((d, h)) = a[i + 1..a.len() - 1].split_once('-') { if let (Ok(d), Ok(h)) = (d.parse::<u32>(), h.parse::<u32>()) { for k in d..=h.min(d + 64) { pon(&format!("{}{}", &a[..i], k), &mut w); } continue; } } }
        if !a.is_empty() { pon(a, &mut w); }
    }
    if w.is_empty() { None } else { Some(Guion { w, v, p, c }) }
}
/// gmsnResolver: el guion (de sound.Add o de GMod) o la ruta → (ruta en minúsculas, volumen, tono multiplicador, canal).
/// `azar` entre 0 y 1 elige entre las variantes
pub fn resolver(s: &str, vol: Option<f64>, tono: Option<f64>, azar: f64) -> (String, f64, f64, i32) {
    let k = s.to_lowercase();
    let sc = g(|g| g.guiones.get(&k).cloned()).map(|(w, v, p)| Guion { w, v: if v.es_nil() { 1.0 } else { mas(&v) }, p: if p.es_nil() { 100.0 } else { mas(&p) }, c: 0 }).or_else(|| guion_gmod(&k));
    let (mut ruta, mut vol, mut tono, mut ca) = (s.to_string(), vol, tono, 0);
    if let Some(sc) = sc { ruta = sc.w[((azar * sc.w.len() as f64) as usize).min(sc.w.len() - 1)].clone(); vol = vol.or(Some(sc.v)); tono = tono.or(Some(sc.p)); ca = sc.c; }
    let v = vol.filter(|x| x.is_finite()).map(|x| x.clamp(0.05, 2.0)).unwrap_or(1.0);
    let t = tono.filter(|x| x.is_finite() && *x > 0.0).map(|x| (x / 100.0).clamp(0.3, 2.5)).unwrap_or(1.0);
    (ruta.to_lowercase().replace('\\', "/"), v, t, ca)
}
