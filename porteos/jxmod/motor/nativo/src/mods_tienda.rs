//! Los mods de la tienda en la nativa (inicio.js aplicarMods y smods.js de la web): la lista de la tienda baja sola al abrir
//! el juego (y queda guardada para jugar sin internet), va en Props → «Mods de la tienda» y cada mod se prende y apaga
//! tocándolo —también en una sala, como el SMOD de la web: cada uno elige los suyos—. De cada mod se aplican sus efectos:
//! la gravedad (solo, la del mundo; en una sala, la tuya), la velocidad, el salto, la munición infinita, invencible y la
//! hora. El código JavaScript que traen algunos (marcados con *) no corre en la nativa.
use super::*;
use std::sync::{Arc, Mutex};

/// un mod de la tienda: su id, nombre, autor, si trae código y sus efectos (tal cual vienen)
#[derive(Clone, Debug, Default)]
pub struct ModT { pub id: String, pub nombre: String, pub autor: String, pub codigo: bool, pub ef: serde_json::Value }
impl ModT {
    fn json(&self) -> serde_json::Value { serde_json::json!({ "id": self.id, "n": self.nombre, "a": self.autor, "c": self.codigo, "ef": self.ef }) }
    fn de(v: &serde_json::Value) -> Option<ModT> { Some(ModT { id: v["id"].as_str()?.into(), nombre: v["n"].as_str().unwrap_or("").into(), autor: v["a"].as_str().unwrap_or("").into(), codigo: v["c"].as_bool().unwrap_or(false), ef: v["ef"].clone() }) }
}

/// la lista, los prendidos y lo que está aplicado (para deshacerlo al cambiar)
#[derive(Default)]
pub struct ModsT {
    pub lista: Vec<ModT>, pub act: Vec<String>, llegada: Option<Arc<Mutex<Option<Vec<ModT>>>>>, pedido: bool, leido: bool,
    /// la velocidad, el salto y la gravedad aplicados (0: nada todavía, es decir 1)
    pub ap: (f32, f32, f32), hora_puesta: bool,
}

/// los efectos juntos de los mods prendidos (smEfectos): se multiplican; munición e invencible, si alguno los tiene
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Efectos { pub grav: f32, pub vel: f32, pub salto: f32, pub mun: bool, pub inv: bool, pub hora: Option<f32> }
pub fn efectos(l: &[&ModT]) -> Efectos {
    let mut e = Efectos { grav: 1.0, vel: 1.0, salto: 1.0, mun: false, inv: false, hora: None };
    for m in l {
        let f = |k: &str| m.ef.get(k).and_then(|v| v.as_f64()).filter(|x| x.is_finite() && *x > 0.0).unwrap_or(1.0).clamp(0.05, 10.0) as f32;
        let b = |k: &str| m.ef.get(k).and_then(|v| v.as_bool()).unwrap_or(false);
        e.grav *= f("gravedad"); e.vel *= f("velocidad"); e.salto *= f("salto"); e.mun |= b("municionInfinita"); e.inv |= b("invencible");
        if let Some(h) = m.ef.get("hora").and_then(|v| v.as_f64()).filter(|x| x.is_finite()) { e.hora = Some((h as f32).rem_euclid(24.0)); }
    }
    e.grav = e.grav.clamp(0.05, 10.0); e.vel = e.vel.clamp(0.1, 10.0); e.salto = e.salto.clamp(0.1, 10.0);
    e
}

/// la lista de la tienda con los efectos de cada mod (lista?tipo=mods y item/ID, como la web)
fn bajar(h: &jxjuego::red::Http) -> Vec<ModT> {
    let base = super::gmod_juego::TIENDA_URL;
    let Ok((200, t)) = h("GET", &format!("{base}lista?tipo=mods&q=&etq=&orden=populares&p=0"), &[], None) else { return vec![] };
    let Ok(d) = serde_json::from_str::<serde_json::Value>(&t) else { return vec![] };
    let txt = |x: &serde_json::Value| x.as_str().unwrap_or("").chars().filter(|c| !c.is_control()).take(40).collect::<String>();
    let mut v = vec![];
    for it in d["items"].as_array().into_iter().flatten().take(60) {
        let Some(id) = it["id"].as_str().filter(|s| !s.is_empty() && s.len() <= 16 && s.chars().all(|c| c.is_ascii_alphanumeric())) else { continue };
        let Ok((200, t2)) = h("GET", &format!("{base}item/{id}"), &[], None) else { continue };
        let Ok(m) = serde_json::from_str::<serde_json::Value>(&t2) else { continue };
        if !m["efectos"].is_object() { continue; }
        let cod = it["codigo"].as_str() == Some("1") || it["codigo"].as_i64() == Some(1);
        v.push(ModT { id: id.into(), nombre: jxjuego::censura::censurar(&txt(&m["nombre"])), autor: jxjuego::censura::censurar(&txt(&m["autor"])), codigo: cod, ef: m["efectos"].clone() });
    }
    v
}

impl Juego {
    /// cada cuadro: leer lo guardado, pedir la lista una vez, recibirla, ponerla en el menú y aplicar los efectos
    pub(crate) fn mt_paso(&mut self) {
        if !self.mt.leido { self.mt.leido = true; self.mt_leer(); }
        if !self.mt.pedido { if let Some(h) = self.soc.http.clone() {
            self.mt.pedido = true; let r = Arc::new(Mutex::new(None)); self.mt.llegada = Some(r.clone());
            std::thread::spawn(move || { let l = bajar(&h); if let Ok(mut g) = r.lock() { *g = Some(l); } });
        } }
        let nueva = self.mt.llegada.as_ref().and_then(|r| r.lock().ok().and_then(|mut g| g.take()));
        if let Some(l) = nueva { self.mt.llegada = None; if !l.is_empty() { self.mt.lista = l; self.mt.act.retain(|a| self.mt.lista.iter().any(|m| &m.id == a)); self.mt_guardar(); } self.mt_menu(); }
        else if !self.mt.lista.is_empty() && !self.catalogo.is_empty() && !self.catalogo.iter().any(|c| c.0 == CAT) { self.mt_menu(); }
        if self.mapa.is_some() { self.mt_aplicar(); }
    }
    fn mt_leer(&mut self) {
        let Some(d) = self.datos.as_ref().and_then(|d| std::fs::read_to_string(d.join("mods_tienda.json")).ok()) else { return };
        let Ok(v) = serde_json::from_str::<serde_json::Value>(&d) else { return };
        self.mt.lista = v["lista"].as_array().into_iter().flatten().filter_map(ModT::de).collect();
        self.mt.act = v["act"].as_array().into_iter().flatten().filter_map(|x| x.as_str().map(String::from)).collect();
    }
    fn mt_guardar(&self) {
        if let Some(d) = &self.datos { let _ = std::fs::write(d.join("mods_tienda.json"), serde_json::json!({ "lista": self.mt.lista.iter().map(|m| m.json()).collect::<Vec<_>>(), "act": self.mt.act }).to_string()); }
    }
    /// los nombres del menú (con * los que traen código, y «· prendido»)
    fn mt_nombres(&mut self) {
        for m in &self.mt.lista {
            let n = format!("{}{}{}", m.nombre, if m.codigo { " *" } else { "" }, if self.mt.act.contains(&m.id) { " · prendido" } else { "" });
            self.jg.nombres.insert(format!("tmod:{}", m.id), n);
        }
    }
    /// la categoría «Mods de la tienda» de Props, al lado de Munición
    fn mt_menu(&mut self) {
        if self.catalogo.is_empty() { return; }
        self.mt_nombres();
        let its: Vec<String> = self.mt.lista.iter().map(|m| format!("tmod:{}", m.id)).collect();
        if let Some(c) = self.catalogo.iter_mut().find(|c| c.0 == CAT) { c.1 = its; }
        else if !its.is_empty() { let k = self.catalogo.iter().position(|c| c.0 == "Munición").map_or(1, |i| i + 1).min(self.catalogo.len()); self.catalogo.insert(k, (CAT.into(), its)); }
    }
    /// tocar un mod en el menú: se prende o se apaga
    pub(crate) fn mt_alternar(&mut self, id: &str) {
        let Some(m) = self.mt.lista.iter().find(|m| m.id == id).cloned() else { return };
        let on = if let Some(i) = self.mt.act.iter().position(|x| x == id) { self.mt.act.remove(i); false } else { self.mt.act.push(id.to_string()); true };
        self.mt.hora_puesta = false; self.mt_guardar(); self.mt_nombres();
        self.avisar(format!("Mod {}: {}{}", m.nombre, if on { "prendido" } else { "apagado" }, if on && m.codigo { " (su código no corre en la nativa: sólo sus efectos)" } else { "" }));
    }
    /// los efectos de los prendidos: lo que cambió se aplica como proporción (así no pisa lo que pongan otras cosas)
    fn mt_aplicar(&mut self) {
        let act: Vec<&ModT> = self.mt.lista.iter().filter(|m| self.mt.act.contains(&m.id)).collect();
        let e = efectos(&act);
        let uno = |x: f32| if x > 0.0 { x } else { 1.0 }; let (v0, s0, g0) = (uno(self.mt.ap.0), uno(self.mt.ap.1), uno(self.mt.ap.2));
        if (e.vel - v0).abs() > 1e-4 { self.jug.vel_max *= e.vel / v0; }
        if (e.salto - s0).abs() > 1e-4 { self.jug.salto *= e.salto / s0; }
        if (e.grav - g0).abs() > 1e-4 {
            // (en una sala el mundo es de todos: la gravedad del mod es sólo la tuya; solo, también la del mundo)
            self.jug.grav *= e.grav / g0;
            if self.en_red.red.sala.is_none() { let gm = self.mapa.as_ref().map(|m| m.mundo.gravedad as f64).unwrap_or(9.81); self.fis.gscale = if (e.grav - 1.0).abs() < 1e-4 { None } else { Some(gm * e.grav as f64) }; }
        }
        self.mt.ap = (e.vel, e.salto, e.grav);
        if e.inv && self.jug.vida > 0.0 && self.jug.vida < 100.0 { self.jug.vida = 100.0; }
        if e.mun { let i = self.armas.i; let car = self.armas.def().car; if let Some(b) = self.armas.balas.get_mut(i) { *b = car; } }
        if let (Some(h), false) = (e.hora, self.mt.hora_puesta) { self.mt.hora_puesta = true; self.aj.hora = h; self.aj.ciclo = false; }
    }
}
const CAT: &str = "Mods de la tienda";

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn efectos_juntos() {
        let a = ModT { id: "a".into(), ef: serde_json::json!({ "gravedad": 0.5, "velocidad": 2, "salto": 1, "municionInfinita": false, "invencible": true, "hora": null }), ..Default::default() };
        let b = ModT { id: "b".into(), ef: serde_json::json!({ "gravedad": 0.5, "velocidad": 1.5, "salto": 3, "municionInfinita": true, "hora": 20 }), ..Default::default() };
        let e = efectos(&[&a, &b]);
        assert!((e.grav - 0.25).abs() < 1e-5 && (e.vel - 3.0).abs() < 1e-5 && (e.salto - 3.0).abs() < 1e-5 && e.mun && e.inv && e.hora == Some(20.0), "{e:?}");
        // (valores rotos o de más: se acotan)
        let c = ModT { ef: serde_json::json!({ "gravedad": -4, "velocidad": 1e9, "salto": "x" }), ..Default::default() };
        let e = efectos(&[&c]); assert!(e.grav == 1.0 && e.vel == 10.0 && e.salto == 1.0, "{e:?}");
        assert_eq!(efectos(&[]), Efectos { grav: 1.0, vel: 1.0, salto: 1.0, mun: false, inv: false, hora: None });
    }
}
