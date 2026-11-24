//! Los NPC (npc.js de la versión web): gente del juego con su actitud. Cada NPC es un personaje como el jugador: camina
//! y choca con la misma cápsula (contra el mapa, los objetos y la gente: persona.rs), anima sus pasos (personaje.rs),
//! salta lo bajo, rodea lo que no puede saltar y no se tira por un barranco. Su actitud dice qué hace: quieto, pasear,
//! seguir, perseguir (si es hostil, patea), huir, bailar, guardia (cuida su lugar), mirar o defender (te sigue y pelea
//! con lo que te ataca); a quién (el jugador, el que le dio la actitud u otro NPC), a qué velocidad, cuánto pega, qué
//! dice, su vida y el arma que usa: ve al blanco, reacciona medio segundo, apunta al pecho y tira con su cadencia y sus
//! ráfagas (el tiro se abre más lejos y caminando; el que defiende no tira si hay un amigo en el medio). Los tiros y las
//! patadas lastiman; un golpe fuerte lo tira al piso como muñeco de trapo (las partes y uniones de fisica.rs, con los
//! HitBox del juego) y se levanta solo; muerto queda tirado 15 s. Agarrado con la Physics Gun o la Gravity Gun se hace
//! muñeco (`Npcs::agarrar`).
//!
//! En cada cuadro el juego llama a `Npcs::paso` (el cerebro y el movimiento, con el jugador como `Gente`), saca los
//! `eventos` (sonidos, el daño al jugador con su empujón, las trazas e impactos de los tiros, lo que dicen), y para
//! dibujar `animar` e `items`. Los cuerpos (el Personaje de cada skin y su escena para el motor) los da `Skins`.
//! Lo que no (de la web): la red (npcRed*, npcRemotos*), los paneles de HTML (npcPanel*: la actitud se pone con
//! `Npcs::aplicar` o en `Npcs::act`, y el lector local de lo escrito es `Actitud::de_texto`; la IA de afuera no), el Lua
//! de los mods, los emotes de los paquetes aparte (rb:…, se baila el ChickenDance), el agua y la malla simplificada de
//! lejos. El arma en la mano (su postura de GMod, el agarre y el modelo de mundo: arma_mano.rs) la cargan los `Skins` con
//! el primer cuerpo; el gesto al tirar o al recibir un golpe (humAccion) lo hace el cuerpo (`Personaje::accion`).
use crate::fisica::{self, add, dot, esc, largo, sub, Cuerpo, Fisica, OpCuerpo, OpUnion, QID, V};
use crate::mundo::Mundo;
use crate::paquete::Paquete;
use crate::persona::{self, Azar, Capsula, Tmp, GRAV, GRUPO_MUNECO};
use crate::arma_mano::ArmaMano;
use crate::personaje::{base, Cargados, ClipEmote, Estado, Gesto, Personaje};
use jxmotor::escena::{Escena, ItemDin};
use jxmotor::mat::{self as m4, M4};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

const TAU: f64 = std::f64::consts::TAU;
const PI: f64 = std::f64::consts::PI;
/// (lo que ve el juego: posiciones en float)
pub type P3 = [f32; 3];

// ---------------- la actitud ----------------
/// qué hace (NPC_MODOS)
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Modo { Quieto, Pasear, Seguir, Perseguir, Huir, Bailar, Guardia, Mirar, Defender }
pub const MODOS: [Modo; 9] = [Modo::Quieto, Modo::Pasear, Modo::Seguir, Modo::Perseguir, Modo::Huir, Modo::Bailar, Modo::Guardia, Modo::Mirar, Modo::Defender];
impl Modo {
    pub fn nombre(self) -> &'static str {
        match self { Modo::Quieto => "quieto", Modo::Pasear => "pasear", Modo::Seguir => "seguir", Modo::Perseguir => "perseguir", Modo::Huir => "huir", Modo::Bailar => "bailar", Modo::Guardia => "guardia", Modo::Mirar => "mirar", Modo::Defender => "defender" }
    }
    pub fn de(s: &str) -> Option<Modo> { MODOS.iter().copied().find(|m| m.nombre() == s) }
}
/// a quién (NPC_OBJ): el jugador más cerca, el que le dio la actitud (`de`) u otro NPC
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Obj { Cerca, Yo, Npc }
impl Obj {
    pub fn nombre(self) -> &'static str { match self { Obj::Cerca => "cerca", Obj::Yo => "yo", Obj::Npc => "npc" } }
    pub fn de(s: &str) -> Option<Obj> { [Obj::Cerca, Obj::Yo, Obj::Npc].into_iter().find(|m| m.nombre() == s) }
}
/// las armas que puede llevar (NPC_ARMAS)
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Arma { Pistol, Revolver, Smg, Akm, Shotgun, Crowbar }
pub const ARMAS: [Arma; 6] = [Arma::Pistol, Arma::Revolver, Arma::Smg, Arma::Akm, Arma::Shotgun, Arma::Crowbar];
impl Arma {
    pub fn nombre(self) -> &'static str { match self { Arma::Pistol => "Pistol", Arma::Revolver => "Revolver", Arma::Smg => "Smg", Arma::Akm => "Akm", Arma::Shotgun => "Shotgun", Arma::Crowbar => "Crowbar" } }
    pub fn de(s: &str) -> Option<Arma> { ARMAS.iter().copied().find(|a| a.nombre() == s) }
    /// cómo la usa un NPC (NPC_TIRO; la palanca no tira: pega)
    pub fn tiro(self) -> Option<Tiro> {
        Some(match self {
            Arma::Pistol => Tiro { cad: 0.55, rafaga: 1, pausa: 0.0, rango: 28.0, disp: 0.03 },
            Arma::Revolver => Tiro { cad: 1.1, rafaga: 1, pausa: 0.0, rango: 34.0, disp: 0.02 },
            Arma::Smg => Tiro { cad: 0.09, rafaga: 5, pausa: 0.9, rango: 22.0, disp: 0.05 },
            Arma::Akm => Tiro { cad: 0.12, rafaga: 3, pausa: 0.8, rango: 40.0, disp: 0.028 },
            Arma::Shotgun => Tiro { cad: 1.2, rafaga: 1, pausa: 0.0, rango: 12.0, disp: 0.07 },
            Arma::Crowbar => return None,
        })
    }
    /// lo de DEF_ARMAS que usa un NPC: el daño de un tiro, si son perdigones (8 por tiro) y el sonido del tiro de la web
    /// (el de HL2 de DATA.gm.hl2, si está, lo pone `Npcs::nuevo`)
    pub fn def(self) -> (f64, bool, &'static str) {
        match self { Arma::Pistol => (25.0, false, "pistol2Fire_1"), Arma::Revolver => (55.0, false, "revolverfire2"), Arma::Smg => (14.0, false, "smgfire"), Arma::Akm => (24.0, false, "AkFire3"), Arma::Shotgun => (12.0, true, "shotgunFire"), Arma::Crowbar => (25.0, false, "CB_Swing") }
    }
}
/// cada cuánto tira, de a cuántos tiros la ráfaga y la pausa, hasta dónde y cuánto se le abre el tiro
#[derive(Clone, Copy, Debug)]
pub struct Tiro { pub cad: f64, pub rafaga: u32, pub pausa: f64, pub rango: f64, pub disp: f64 }

/// los bailes que puede hacer (NPC_BAILES; los «rb:» son de un paquete aparte: acá se baila el ChickenDance)
pub const BAILES: [&str; 20] = ["ChickenDance", "Techno", "Twerk", "Flair", "Victory", "Clap", "Hi", "Backflip", "AirSquat", "rb:Gangnam", "rb:YMCA", "rb:HipHop", "rb:Shuffle", "rb:Breakdance", "rb:Boxeo", "rb:Momia", "rb:GritoZombi", "rb:Corazon", "rb:SaludoGrande", "rb:Giro360"];
/// los emotes del juego (DATA.emotes): los demás que valen en `emote`
pub const EMOTES: [&str; 15] = ["Clap", "Disagree", "Hi", "ChickenDance", "Sitting", "Scream", "Kick", "Victory", "FightIdle", "AirSquat", "Techno", "Bencao", "Twerk", "Flair", "Backflip"];

/// la actitud (P.act): qué hace, a qué velocidad (m/s), a quién y a qué distancia, si pega y cuánto (por patada), el emote
/// si baila, lo que dice, si salta de alegría, su vida, su nombre, quién se la dio («yo»: el jugador) y el arma
#[derive(Clone, Debug, PartialEq)]
pub struct Actitud { pub modo: Modo, pub vel: f64, pub obj: Obj, pub dist: f64, pub hostil: bool, pub dano: f64, pub emote: String, pub decir: Vec<String>, pub salta: bool, pub vida: f64, pub nombre: String, pub de: String, pub arma: Option<Arma> }
/// npcActBase
impl Default for Actitud {
    fn default() -> Self { Actitud { modo: Modo::Pasear, vel: 2.0, obj: Obj::Cerca, dist: 3.0, hostil: false, dano: 10.0, emote: String::new(), decir: vec![], salta: false, vida: 100.0, nombre: String::new(), de: String::new(), arma: None } }
}
/// el texto limpio (limpio de red.js): sin controles ni < > & " ' ` \, sin espacios a los lados y de hasta n letras
pub fn limpio(s: &str, n: usize) -> String {
    let t: String = s.chars().filter(|&c| !(c < ' ' || "<>&\"'`\\".contains(c))).collect();
    t.trim().chars().take(n).collect()
}
/// (JS Math.round)
fn redondo(x: f64) -> f64 { (x + 0.5).floor() }
/// un número de lo que venga (n de npcActNormal): número o texto con un número, recortado; si no, d
fn num(v: &Value, lo: f64, hi: f64, d: f64) -> f64 {
    let x = match v { Value::Number(x) => x.as_f64(), Value::String(s) if !s.trim().is_empty() => s.trim().parse::<f64>().ok(), _ => None };
    match x { Some(x) if x.is_finite() => x.max(lo).min(hi), _ => d }
}
fn emote_valido(e: &str) -> bool { BAILES.contains(&e) || EMOTES.contains(&e) }

impl Actitud {
    /// la actitud revisada de lo que venga (de la IA, de la red o de un mod: npcActNormal), sobre `base` (sin revisar, como
    /// Object.assign: { "de": "yo" })
    pub fn normal(a: &Value, base: Option<&Value>) -> Actitud {
        let mut o = Actitud::default();
        if let Some(b) = base.and_then(|b| b.as_object()) {
            for (k, v) in b { o.poner(k, v); }
        }
        if !a.is_object() { return o; }
        if let Some(m) = a["modo"].as_str().and_then(Modo::de) { o.modo = m; }
        if let Some(x) = a["obj"].as_str().and_then(Obj::de) { o.obj = x; }
        o.vel = num(&a["vel"], 0.5, 9.0, o.vel); o.dist = num(&a["dist"], 0.8, 40.0, o.dist); o.dano = num(&a["dano"], 0.0, 60.0, o.dano); o.vida = redondo(num(&a["vida"], 1.0, 2000.0, o.vida));
        if let Some(b) = a["hostil"].as_bool() { o.hostil = b; } if let Some(b) = a["salta"].as_bool() { o.salta = b; }
        if let Some(e) = a["emote"].as_str() { o.emote = if emote_valido(e) { e.to_string() } else { String::new() }; }
        if let Some(l) = a["decir"].as_array() { o.decir = l.iter().filter_map(|x| x.as_str()).map(|x| limpio(x, 80)).filter(|x| !x.is_empty()).take(4).collect(); }
        else if let Some(s) = a["decir"].as_str().filter(|s| !s.trim().is_empty()) { o.decir = vec![limpio(s, 80)]; }
        if let Some(s) = a["nombre"].as_str() { o.nombre = limpio(s, 24); }
        if let Some(s) = a["de"].as_str() { o.de = s.chars().take(40).collect(); }
        if let Some(s) = a["arma"].as_str() { o.arma = Arma::de(s); }
        if o.modo == Modo::Perseguir && o.dist > 3.0 { o.dist = 1.2; }
        // (defiende a una persona: la sigue de cerca)
        if o.modo == Modo::Defender { o.hostil = false; if o.obj == Obj::Npc { o.obj = Obj::Yo; } if o.dist > 8.0 { o.dist = 3.0; } }
        o
    }
    /// (Object.assign de la base: lo que venga, sin revisar)
    fn poner(&mut self, k: &str, v: &Value) {
        match k {
            "modo" => { if let Some(m) = v.as_str().and_then(Modo::de) { self.modo = m; } }
            "obj" => { if let Some(m) = v.as_str().and_then(Obj::de) { self.obj = m; } }
            "vel" => { if let Some(x) = v.as_f64() { self.vel = x; } }
            "dist" => { if let Some(x) = v.as_f64() { self.dist = x; } }
            "dano" => { if let Some(x) = v.as_f64() { self.dano = x; } }
            "vida" => { if let Some(x) = v.as_f64() { self.vida = x; } }
            "hostil" => { if let Some(b) = v.as_bool() { self.hostil = b; } }
            "salta" => { if let Some(b) = v.as_bool() { self.salta = b; } }
            "emote" => { if let Some(s) = v.as_str() { self.emote = s.to_string(); } }
            "nombre" => { if let Some(s) = v.as_str() { self.nombre = s.to_string(); } }
            "de" => { if let Some(s) = v.as_str() { self.de = s.to_string(); } }
            "arma" => { if let Some(s) = v.as_str() { self.arma = Arma::de(s); } }
            "decir" => { if let Some(l) = v.as_array() { self.decir = l.iter().filter_map(|x| x.as_str().map(String::from)).collect(); } }
            _ => {}
        }
    }
    /// como JSON (lo que manda la web por la red y lo que entiende `normal`)
    pub fn a_json(&self) -> Value {
        json!({ "modo": self.modo.nombre(), "vel": self.vel, "obj": self.obj.nombre(), "dist": self.dist, "hostil": self.hostil, "dano": self.dano, "emote": self.emote,
            "decir": self.decir, "salta": self.salta, "vida": self.vida, "nombre": self.nombre, "de": self.de, "arma": self.arma.map(|a| a.nombre()).unwrap_or("") })
    }
    /// la misma actitud revisada (npcCrear vuelve a pasar por npcActNormal lo que le dan)
    pub fn normalizada(&self) -> Actitud { Actitud::normal(&self.a_json(), None) }

    /// el lector local (npcActDeTexto): entiende lo escrito al instante, sin internet, con palabras clave en español,
    /// inglés, portugués y otros
    pub fn de_texto(t: &str, base: Option<&Value>) -> Actitud {
        let s = format!(" {} ", sin_tildes(&t.to_lowercase()));
        let hay = |l: &[&str]| l.iter().any(|w| s.contains(w));
        let mut a = serde_json::Map::new();
        let modo = |a: &serde_json::Map<String, Value>| a.get("modo").and_then(|v| v.as_str()).map(String::from);
        if hay(&["bail", "danc", "danz", "perrea", "twerk", "fiesta", "party"]) {
            a.insert("modo".into(), json!("bailar"));
            let l: [(&[&str], &str); 8] = [(&["twerk", "perrea"], "Twerk"), (&["techno", "electr"], "Techno"), (&["gangnam"], "rb:Gangnam"), (&["ymca"], "rb:YMCA"), (&["hiphop", "hip hop", "rap"], "rb:HipHop"), (&["shuffle"], "rb:Shuffle"), (&["break"], "rb:Breakdance"), (&["pollo", "chicken"], "ChickenDance")];
            let e = l.iter().find(|(w, _)| hay(w)).map(|x| x.1).unwrap_or("ChickenDance"); a.insert("emote".into(), json!(e));
        }
        if hay(&["hui", "huy", "escap", "miedo", "asust", "cobard", "teme", "flee", "scared", "afraid", "coward", "run away", "fog", "medo", "kabur", "takut", "逃", "怖"]) {
            a.insert("modo".into(), json!("huir")); a.insert("dist".into(), json!(12)); a.insert("vel".into(), json!(5.5)); a.insert("hostil".into(), json!(false));
        }
        if hay(&["siga", "sigu", "sigo", "siguen", "acompa", "escolt", "guardaespald", "follow", "bodyguard", "escort", "segui", "segue", "ikut", "追従", "ついて"]) { a.insert("modo".into(), json!("seguir")); a.insert("dist".into(), json!(3)); }
        if hay(&["persig", "caza", "chase", "hunt", "atrap", "catch", "persegu", "kejar", "追いかけ"]) { a.insert("modo".into(), json!("perseguir")); a.insert("dist".into(), json!(1.2)); }
        if hay(&["agresiv", "ataq", "atac", "pega", "golpe", "mata", "asesin", "enoj", "furios", "hostil", "malo", "violent", "attack", "aggress", "kill", "angry", "hostile", "mean", "fight", "pelea", "luta", "bata", "serang", "marah", "攻撃", "怒"]) {
            a.insert("hostil".into(), json!(true)); a.insert("dano".into(), json!(12));
            let m = modo(&a); if m.is_none() || m.as_deref() == Some("seguir") { a.insert("modo".into(), json!("perseguir")); }
            a.insert("dist".into(), json!(1.2));
        }
        if hay(&["guard", "vigil", "cuid", "patrull", "patrol", "jaga"]) { a.insert("modo".into(), json!("guardia")); a.insert("dist".into(), json!(7)); }
        // (que te defienda: te sigue y le tira o le pega a lo que te ataca)
        if hay(&["defiend", "defend", "proteg", "protect", "guardaespald", "bodyguard", "escolt", "escort", "aliad", "ally", "cuidame", "cuidanos", "me cuide", "nos cuide", "me ayude", "nos ayude", "help me", "de mi lado", "my side", "lindung", "bela"]) {
            a.insert("modo".into(), json!("defender")); a.insert("obj".into(), json!("yo")); a.insert("dist".into(), json!(3)); a.insert("hostil".into(), json!(false));
        }
        // (con arma: la primera que nombre)
        let armas: [(&[&str], &str); 6] = [(&["escopet", "shotgun", "recortad", "espingard", "scatter"], "Shotgun"), (&[" ak", "ak47", "ak-47", "akm", "rifle", "fusil", "assault"], "Akm"),
            (&["smg", "metrallet", "subfusil", "ametrallador", "uzi", "mp5", "machinegun", "machine gun", "submachine"], "Smg"), (&["revolver", "magnum", "357"], "Revolver"),
            (&["palanca", "crowbar", "barreta", "pe de cabra", "pata de cabra"], "Crowbar"), (&["pistol", "armad", "con arma", "with a gun", "with gun", " gun", "dispar", "tirotea", "shoot", "balas", "armed", "senjata", "tembak", "銃"], "Pistol")];
        if let Some((_, w)) = armas.iter().find(|(l, _)| hay(l)) { a.insert("arma".into(), json!(w)); }
        if hay(&["pase", "deambul", "vaga", "vage", "explor", "wander", "roam", "walk around", "passe", "jalan", "散歩"]) && modo(&a).is_none() { a.insert("modo".into(), json!("pasear")); }
        if hay(&[" mira", "observ", "watch", "stare", "look at", "olha", "lihat", "見"]) && modo(&a).is_none() { a.insert("modo".into(), json!("mirar")); }
        if hay(&["quiet", "parad", "para ", "stop", "stay", "espera", "idle", "wait", "fica", "diam", "止ま"]) && modo(&a).is_none() { a.insert("modo".into(), json!("quieto")); }
        if hay(&["amig", "amable", "buen", "pacif", "tranqui", "friend", "nice", "kind", "peace", "gentle", "ramah", "baik"]) {
            a.insert("hostil".into(), json!(false));
            if modo(&a).is_none() { let m = if a.contains_key("arma") { "defender" } else { "seguir" }; a.insert("modo".into(), json!(m)); }
            if modo(&a).as_deref() == Some("defender") { a.insert("obj".into(), json!("yo")); }
        }
        if hay(&["corr", "rapid", "veloz", "run", "fast", "sprint", "quick", "lari", "cepat", "走"]) { a.insert("vel".into(), json!(if hay(&["muy rapid", "super", "sprint", "velocisim", "very fast"]) { 7.5 } else { 5.5 })); }
        if hay(&["camin", "lent", "despacio", "walk", "slow", "calm", "anda", "pelan"]) && !hay(&["corr", "run", "rapid"]) { a.insert("vel".into(), json!(2)); }
        if hay(&["salt", "brinc", "jump", "hop", "pula", "lompat", "跳"]) { a.insert("salta".into(), json!(true)); }
        let hostil = a.get("hostil").and_then(|v| v.as_bool()).unwrap_or(false);
        if hay(&[" npc", "otros npc", "other npc", "entre ellos", "each other", "monstruo", "zombi"]) && (modo(&a).as_deref() == Some("perseguir") || hostil) { a.insert("obj".into(), json!("npc")); }
        if hay(&[" me ", "a mi", "conmigo", "follow me", "me sig", "sigueme"]) { a.insert("obj".into(), json!("yo")); }
        if hay(&["fuerte", "mucho dano", "brutal", "strong", "hard", "letal", "deadly"]) { a.insert("dano".into(), json!(30)); }
        if hay(&["debil", "suave", "weak", "soft", "poco dano"]) { a.insert("dano".into(), json!(5)); }
        if hay(&["inmortal", "invencible", "immortal", "tanque", "tank"]) { a.insert("vida".into(), json!(2000)); }
        // (lo que dice, entre comillas)
        if let Some(q) = entre_comillas(t) { a.insert("decir".into(), json!([q])); }
        Actitud::normal(&Value::Object(a), base)
    }

    /// las actitudes de los botones del panel (NPC_RAPIDA_ACT): agresivo, armado, defensor, amigo, miedoso, bailarin,
    /// guardia, paseo, quieto
    pub fn rapida(nombre: &str, base: Option<&Value>) -> Option<Actitud> {
        let a = match nombre {
            "agresivo" => json!({ "modo": "perseguir", "vel": 5.5, "hostil": true, "dano": 12, "dist": 1.2 }),
            "armado" => json!({ "modo": "perseguir", "vel": 4, "hostil": true, "dano": 12, "dist": 1.2, "arma": "Pistol" }),
            "defensor" => json!({ "modo": "defender", "vel": 5, "obj": "yo", "dist": 3, "hostil": false, "dano": 12, "arma": "Smg", "vida": 200 }),
            "amigo" => json!({ "modo": "seguir", "vel": 4, "obj": "yo", "dist": 3, "hostil": false }),
            "miedoso" => json!({ "modo": "huir", "vel": 5.5, "dist": 12, "hostil": false }),
            "bailarin" => json!({ "modo": "bailar", "emote": "ChickenDance", "hostil": false }),
            "guardia" => json!({ "modo": "guardia", "vel": 5, "dist": 7, "hostil": true, "dano": 10 }),
            "paseo" => json!({ "modo": "pasear", "vel": 2, "hostil": false }),
            "quieto" => json!({ "modo": "quieto", "hostil": false }),
            _ => return None,
        };
        let mut a = a; a["decir"] = json!([]);
        Some(Actitud::normal(&a, base))
    }
    /// cómo está (npcActDescribir, en castellano)
    pub fn describir(&self) -> String {
        let m = match self.modo { Modo::Quieto => "Quieto", Modo::Pasear => "Pasea", Modo::Seguir => "Sigue", Modo::Perseguir => "Persigue", Modo::Huir => "Huye", Modo::Bailar => "Baila", Modo::Guardia => "Guardia", Modo::Mirar => "Mira", Modo::Defender => "Te defiende" };
        let mut s = m.to_string();
        if self.hostil { s += ", ataca"; }
        if let Some(a) = self.arma { s += ", "; s += a.nombre(); }
        if !matches!(self.modo, Modo::Quieto | Modo::Bailar | Modo::Mirar) { s += &format!(", {:.1} m/s", self.vel); }
        if let Some(d) = self.decir.first() { s += &format!(" · «{d}»"); }
        s
    }
}
/// sin tildes ni diéresis (lo que hace normalize('NFD') y sacar las marcas)
fn sin_tildes(s: &str) -> String {
    s.chars().map(|c| match c {
        'á' | 'à' | 'â' | 'ä' | 'ã' | 'å' => 'a', 'é' | 'è' | 'ê' | 'ë' => 'e', 'í' | 'ì' | 'î' | 'ï' => 'i', 'ó' | 'ò' | 'ô' | 'ö' | 'õ' => 'o',
        'ú' | 'ù' | 'û' | 'ü' => 'u', 'ñ' => 'n', 'ç' => 'c', 'ý' | 'ÿ' => 'y', 'й' => 'и', 'ё' => 'е', x => x,
    }).collect()
}
/// lo primero entre comillas («», "" o “”), de 1 a 80 letras
fn entre_comillas(t: &str) -> Option<String> {
    let c: Vec<char> = t.chars().collect();
    for i in 0..c.len() {
        if !matches!(c[i], '"' | '“' | '«') { continue; }
        let j = (i + 1..c.len()).find(|&j| matches!(c[j], '"' | '”' | '»'))?;
        let n = j - i - 1; if (1..=80).contains(&n) { return Some(c[i + 1..j].iter().collect()); }
    }
    None
}

// ---------------- lo que pasa (para el juego) ----------------
/// quién: el jugador o un NPC (su número)
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Quien { Jugador, Npc(u32) }

/// lo que el juego tiene que hacer después de un paso (los sonidos van con su nombre del paquete: a:nombre)
#[derive(Clone, Debug)]
pub enum Evento {
    /// un sonido (sonar): el nombre, dónde (None: sin lugar), el volumen y el tono
    Sonido { nombre: String, pos: Option<P3>, vol: f32, tono: f32 },
    /// le pegaron al jugador (danarJugador): cuánto, desde dónde (el NPC) y la velocidad que hay que sumarle (el empujón)
    DanoJugador { npc: u32, dan: f32, de: P3, empuje: P3 },
    /// la traza de un tiro (efectoTraza), de la boca del arma a donde pegó
    Traza { de: P3, a: P3 },
    /// dónde pegó un tiro (efectoImpacto): el punto, la normal y si fue en un cuerpo (un objeto o una persona: sangre o
    /// chispas) o en el mapa (polvo)
    Impacto { p: P3, n: P3, cuerpo: bool },
    /// un tiro le pegó a un objeto de la física que no es una persona (danarObjeto, si el juego rompe cosas)
    DanoObjeto { cuerpo: u32, dan: f32, p: P3, dir: P3 },
    /// un NPC vivo recibió un golpe (de un tiro, una patada o del juego: `Npcs::danar`) y le bajó la vida
    DanoNpc { npc: u32, dan: f32 },
    /// lo que dice (npcDecir: el globito arriba de la cabeza, `Npc::globo_pos`, durante `dur` s)
    Decir { npc: u32, texto: String, dur: f32 },
    /// se murió (queda tirado 15 s), se cayó como muñeco de trapo, se levantó o se borró
    Murio { npc: u32 }, Tumbado { npc: u32 }, Levantado { npc: u32 }, Quitado { npc: u32 },
}

/// el jugador como lo ven los NPC (de JUG): dónde está (el centro de la cápsula; los pies a 0,95 m), si está vivo, sus
/// esferas (alto sobre el centro, para los tiros: rayoJugador), su radio, su tamaño y su nombre en la sala («yo»)
#[derive(Clone, Debug)]
pub struct Gente { pub pos: V, pub vivo: bool, pub esf: Vec<f64>, pub radio: f64, pub tam: f64, pub id: String }
impl Gente {
    /// del jugador de jugador.rs (vivo si le queda vida; agachado, las esferas de agachado: jugadorAgEsf)
    pub fn de_jugador(j: &crate::jugador::Jugador) -> Gente {
        let (medio, radio) = (j.medio as f64, j.radio as f64);
        let esf = if j.agachado { let pie = -medio - radio; let tope = 0.5 + radio; let tope_ag = pie + (tope - pie) * 0.5; let alto = tope_ag - radio; if alto > -medio + 1e-3 { vec![-medio, alto] } else { vec![-medio] } } else { vec![-0.5, 0.0, 0.5] };
        Gente { pos: v64(j.pos), vivo: j.vida > 0.0, esf, radio, tam: 1.0, id: "yo".into() }
    }
    /// nadie (sin jugador: en el menú, muerto)
    pub fn nadie() -> Gente { Gente { pos: [0.0; 3], vivo: false, esf: vec![], radio: 0.45, tam: 1.0, id: "yo".into() } }
}

// ---------------- el NPC ----------------
/// el collider de un hueso para el muñeco de trapo (x.rb y x.col[0]): la masa, la forma (b caja, c cápsula, s esfera),
/// el centro, los lados, el radio, el alto y el eje de la cápsula
#[derive(Clone, Debug)]
pub struct Col { m: f32, k: char, c: P3, s: P3, r: f32, h: f32, d: i64 }

/// una parte del muñeco: el nodo, su cuerpo en la física y del cuerpo al hueso (W = M(cuerpo) · off)
#[derive(Clone, Debug)]
struct Parte { nodo: usize, cuerpo: u32, off: M4 }
/// el muñeco de trapo (P.rag): sus partes, cuál es la cadera y la raíz del último cuadro animado
#[derive(Clone, Debug)]
pub struct Rag { partes: Vec<Parte>, cadera: Option<usize>, raiz: M4 }
impl Rag { pub fn cuerpos(&self) -> impl Iterator<Item = u32> + '_ { self.partes.iter().map(|p| p.cuerpo) } }

#[derive(Clone, Copy, Debug, PartialEq)]
enum Libre { No, Si, Saltar }

/// el cerebro (P.ia)
#[derive(Clone, Debug, Default)]
struct Ia {
    casa: V, meta: Option<V>, meta_t: f64, pausa: f64, golpe_t: f64, golpe: Option<(f64, Quien)>, decir_t: f64, rag_t: f64,
    trabado: f64, desvio: f64, desvio_t: f64, salto_t: f64, llevado: bool,
    vis: bool, vis_t: f64, ve_t: f64, tiro_t: f64, raf_n: u32, pat_t: f64,
    /// lo libre del camino: hacia dónde, cuándo y qué dio (se recuerda 0,1 s)
    libre: Option<(V, f64, Libre)>,
    /// el que le pegó hace poco
    venganza: Option<(Quien, f64)>,
}

/// un NPC: su cuerpo animado, la cápsula (el centro; los pies a 0,95 m), hacia dónde mira, su vida, su actitud, lo que
/// hace (el emote: «Patada» es la patada), el arma, el cuerpo de la cápsula en la física, el muñeco de trapo si está
/// tirado y lo que está diciendo (texto y cuánto le queda)
pub struct Npc {
    pub id: u32, pub skin: String, pub pj: Personaje,
    pub cap: Capsula, pub yaw: f64, pub mira: f64, pub tam: f64,
    pub vida: f64, pub vivo: bool, pub act: Actitud,
    pub emote: Option<String>, pub arma: Option<Arma>,
    pub cuerpo: Option<u32>, pub rag: Option<Rag>,
    /// un muñeco de trapo puesto como tal (spawnNpc con muneco): no se levanta y los golpes sólo lo empujan
    pub muneco: bool,
    pub muerto_t: f64,
    pub globo: Option<(String, f32)>,
    /// si se dibuja en este cuadro (lo decide `animar`)
    pub visible: bool,
    ia: Ia, voz_t: f64, cols: Arc<Vec<Option<Col>>>,
    emo_pj: Option<String>, base_ult: M4, anim_t: f64, dt_junto: f32, n1: u32, cn: u32, dt_a: f32,
    paso_d: f64, paso_aire: f64, paso_vy: f64,
    /// las armas cargadas (de los `Skins`) y la que tiene el cuerpo en la mano
    armas: Arc<HashMap<String, Arc<ArmaMano>>>, arma_pj: Option<Arma>,
}
impl Npc {
    /// dónde está (el centro de la cápsula; los pies a 0,95 m)
    pub fn pos(&self) -> P3 { v32(self.cap.pos) }
    /// dónde va el globito de lo que dice (arriba de la cabeza)
    pub fn globo_pos(&self) -> P3 { v32(add(self.cap.pos, [0.0, -0.95 + 2.02 * self.tam, 0.0])) }
    /// dónde van los pies (la raíz del personaje: lo que se le pasa a personaje::base)
    pub fn piso(&self) -> P3 { v32([self.cap.pos[0], self.cap.pos[1] - 0.95, self.cap.pos[2]]) }
    /// hostil: «malo»; defiende: «bueno» (npcBando)
    pub fn bando(&self) -> Bando { if self.act.hostil { Bando::Malo } else if self.act.modo == Modo::Defender { Bando::Bueno } else { Bando::Nada } }
    /// en pie (npcEnPie): vivo y no tirado
    pub fn en_pie(&self) -> bool { self.vivo && self.rag.is_none() }
    /// la matriz de la raíz del cuerpo en el último cuadro animado (de pie; tirado es la identidad: el muñeco está en el mundo)
    pub fn base(&self) -> M4 { if self.rag.is_some() { m4::id() } else { self.base_ult } }
    fn propio(&self) -> &[u32] { self.cuerpo.as_slice() }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Bando { Malo, Bueno, Nada, Jugador }

// ---------------- los cuerpos de cada skin ----------------
/// el cuerpo de un NPC (el personaje, los colliders de sus huesos y las armas que puede llevar): lo da `Skins::pedir`
pub struct CuerpoNpc { pub pj: Personaje, cols: Arc<Vec<Option<Col>>>, armas: Arc<HashMap<String, Arc<ArmaMano>>> }

/// los personajes de los NPC, uno por skin (la escena se sube al motor una vez): el que se pide se copia. Con el primero
/// se cargan las armas que pueden llevar (NPC_ARMAS: su postura y su modelo de mundo)
pub struct Skins { protos: HashMap<String, (Personaje, Arc<Vec<Option<Col>>>)>, pub lod: usize, pub tmax: u32, armas: Option<Arc<HashMap<String, Arc<ArmaMano>>>> }
impl Skins {
    /// lod: el nivel de detalle de las mallas (0 el más fino); tmax: el lado más grande de las texturas
    pub fn nuevo(lod: usize, tmax: u32) -> Skins { Skins { protos: HashMap::new(), lod, tmax, armas: None } }
    /// el motor se vació (cambio de mapa): se vuelven a cargar
    pub fn olvidar(&mut self) { self.protos.clear(); self.armas = None; }
    /// las armas de los NPC (una vez; con lo que el motor todavía no tiene)
    fn armas(&mut self, paq: &mut Paquete, ya: &mut Cargados) -> (Arc<HashMap<String, Arc<ArmaMano>>>, Option<Escena>) {
        if let Some(a) = &self.armas { return (a.clone(), None); }
        let (mut m, mut esc): (HashMap<String, Arc<ArmaMano>>, Option<Escena>) = (HashMap::new(), None);
        for a in ARMAS {
            let Ok((am, e)) = ArmaMano::cargar(paq, a.nombre(), false, self.tmax, ya) else { continue };
            m.insert(a.nombre().to_string(), Arc::new(am));
            match esc.as_mut() { Some(x) => crate::arma_mano::juntar(x, e), None => esc = Some(e) }
        }
        let m = Arc::new(m); self.armas = Some(m.clone()); (m, esc)
    }
    /// el cuerpo de un NPC de `skin` (si no es de DATA.chars, el Hero; si su paquete aparte —rb/s_…— no está, también el
    /// Hero, como crearPersona mientras lo baja). La primera vez de cada skin lo carga y devuelve la escena para subirla al
    /// motor (`ya`: lo que el motor ya tiene, el mismo que el del cuerpo del jugador)
    pub fn pedir(&mut self, paq: &mut Paquete, skin: &str, ya: &mut Cargados) -> Result<(CuerpoNpc, Option<Escena>), String> {
        let skin = if paq.d["chars"].as_array().map(|l| l.iter().any(|x| x.as_str() == Some(skin))).unwrap_or(false) { skin } else { "Hero" };
        if let Some((pj, cols)) = self.protos.get(skin).cloned() { let (armas, e) = self.armas(paq, ya); return Ok((CuerpoNpc { pj, cols, armas }, e)); }
        let (mut pj, esc) = match Personaje::cargar(paq, skin, self.lod, self.tmax, ya) {
            Ok(x) => x,
            Err(e) if skin != "Hero" => { let r = self.pedir(paq, "Hero", ya); if let Ok((c, _)) = &r { self.protos.insert(skin.to_string(), (c.pj.clone(), c.cols.clone())); } let _ = e; return r; }
            Err(e) => return Err(e),
        };
        let cols = Arc::new(cols_de(&paq.d, &pj));
        calentar(&mut pj);
        self.protos.insert(skin.to_string(), (pj.clone(), cols.clone()));
        let (armas, ea) = self.armas(paq, ya); let mut esc = esc; if let Some(ea) = ea { crate::arma_mano::juntar(&mut esc, ea); }
        Ok((CuerpoNpc { pj, cols, armas }, Some(esc)))
    }
}
/// mide de una vez cómo pisa en las 8 direcciones (lo que el personaje calcula la primera vez que camina hacia cada una)
/// para que el primer paso de cada NPC no trabe el cuadro; termina quieto y con los pies sin clavar
fn calentar(pj: &mut Personaje) {
    let e = |v: P3, suelo: bool| Estado { piso: [0.0; 3], vel: v, yaw: 0.0, mira: 0.0, en_suelo: suelo, agachado: false, agua: None };
    for k in 0..8 { let a = k as f32 * std::f32::consts::TAU / 8.0; pj.animar(1.0 / 60.0, &e([a.sin() * 3.0, 0.0, a.cos() * 3.0], true)); }
    for _ in 0..3 { pj.animar(1.0 / 60.0, &e([0.0; 3], true)); }
    pj.animar(1.0 / 60.0, &e([0.0; 3], false));
}
/// los colliders de los huesos (x.rb y x.col del sub-árbol del skin en PhotonPlayer), en el orden de los nodos del personaje
fn cols_de(d: &Value, pj: &Personaje) -> Vec<Option<Col>> {
    let (nombres, _, _) = pj.esqueleto(); let n = nombres.len();
    let nada = vec![None; n];
    let Some(clave) = crate::objetos::por_nombre(d).get("PhotonPlayer").cloned() else { return nada };
    let Some(arb) = d["pf"][&clave].as_array() else { return nada };
    let Some(cr) = arb.iter().position(|x| x["n"].as_str() == Some("CharactersRoot")) else { return nada };
    let es = |x: &Value, s: &str| x["pa"].as_i64() == Some(cr as i64) && x["n"].as_str() == Some(s);
    let Some(si) = arb.iter().position(|x| es(x, &pj.skin)).or_else(|| arb.iter().position(|x| es(x, "Hero"))) else { return nada };
    // (el mismo orden que subArbol: cada nodo y después sus hijos, en el orden del árbol)
    let mut hijos: Vec<Vec<usize>> = vec![vec![]; arb.len()];
    for (k, x) in arb.iter().enumerate() { if let Some(p) = x["pa"].as_i64() { if p >= 0 && (p as usize) < arb.len() { hijos[p as usize].push(k); } } }
    let mut orden = vec![]; let mut pila = vec![si];
    while let Some(i) = pila.pop() { orden.push(i); for &k in hijos[i].iter().rev() { if k > i { pila.push(k); } } }
    if orden.len() != n || orden.iter().zip(nombres).any(|(&i, nm)| arb[i]["n"].as_str() != Some(nm.as_str())) { return nada; }
    let f = |v: &Value| v.as_f64().unwrap_or(0.0) as f32;
    let v3 = |v: &Value| [f(&v[0]), f(&v[1]), f(&v[2])];
    orden.iter().map(|&i| {
        let x = &arb[i]; if !x["rb"].is_object() { return None; } let c = &x["col"][0]; if !c.is_object() { return None; }
        Some(Col { m: f(&x["rb"]["m"]), k: c["k"].as_str().and_then(|s| s.chars().next()).unwrap_or('s'), c: v3(&c["c"]), s: v3(&c["s"]), r: f(&c["r"]), h: f(&c["h"]), d: c["d"].as_i64().unwrap_or(1) })
    }).collect()
}

// ---------------- los NPC ----------------
/// lo que comparten los cerebros: el reloj (TIEMPO.t), el azar (el de npc.js y otro para lo que en la web está en otros
/// archivos: voces y pasos), los eventos, los sonidos de los tiros y lo de trabajo
struct Ctx { t: f64, azar: Azar, azar2: Azar, ev: Vec<Evento>, sf: HashMap<Arma, (Vec<String>, bool)>, carne: Vec<String>, tmp: Tmp, son_pasos: (f64, u32), tiros: u32 }

/// todos los NPC (NPC de npc.js)
pub struct Npcs {
    pub lista: Vec<Box<Npc>>,
    /// el tope (PREFS.npcMax: 24 de fábrica)
    pub max: usize,
    /// la actitud de los próximos que se pongan (NPC.act: la última que se eligió en el panel; None: la de siempre)
    pub act: Option<Actitud>,
    /// el procesador no da (TIEMPO.lento: 0, 1 o 2): los lejanos piensan y se animan menos seguido
    pub lento: u8,
    /// de qué es el piso, para los pasos (PS_grass1…: «grass», «concrete»…)
    pub piso: String,
    sig: u32, n_cuadro: u32, c: Ctx,
    clips: HashMap<String, Option<ClipEmote>>,
    chars: Vec<String>,
}

fn dist(a: V, b: V) -> f64 { largo(sub(a, b)) }
fn hyp(a: V, b: V) -> f64 { (a[0] - b[0]).hypot(a[2] - b[2]) }
/// la dirección en el piso de a hacia b (de largo 1; nada si están en el mismo lugar)
fn hacia(a: V, b: V) -> V { norm([b[0] - a[0], 0.0, b[2] - a[2]]) }
/// (V3.norm: si mide casi nada queda como está)
fn norm(a: V) -> V { let l = largo(a); if l > 1e-12 { esc(a, 1.0 / l) } else { a } }
fn rot_y(v: V, a: f64) -> V { let (c, s) = (a.cos(), a.sin()); [v[0] * c + v[2] * s, 0.0, -v[0] * s + v[2] * c] }
fn v64(a: P3) -> V { [a[0] as f64, a[1] as f64, a[2] as f64] }
fn v32(a: V) -> P3 { [a[0] as f32, a[1] as f32, a[2] as f32] }
/// la vuelta más corta: ((d + π) mod 2π) − π
fn vuelta(d: f64) -> f64 { ((d + PI) % TAU + TAU) % TAU - PI }
fn sonido(c: &mut Ctx, n: &str, pos: Option<V>, vol: f32, tono: f64) { c.ev.push(Evento::Sonido { nombre: n.to_string(), pos: pos.map(v32), vol, tono: tono as f32 }); }

/// un blanco: quién y dónde (el centro de su cápsula) y su tamaño
#[derive(Clone, Copy, Debug)]
struct Blanco { q: Quien, pos: V, tam: f64 }

impl Npcs {
    /// con los datos del paquete (los sonidos de las armas de HL2 y los clips de los emotes) y la semilla del azar
    pub fn nuevo(d: &Value, semilla: u32) -> Npcs {
        let mut sf = HashMap::new();
        for a in ARMAS {
            let hl2 = d["gm"]["hl2"][a.nombre()]["sF"].as_array().map(|l| l.iter().filter_map(|x| x.as_str().map(String::from)).collect::<Vec<_>>()).filter(|l| !l.is_empty());
            // (los de HL2 vienen en lista: azarDe tira el azar; el de siempre es uno solo y no)
            sf.insert(a, match hl2 { Some(l) => (l, true), None => (vec![a.def().2.to_string()], false) });
        }
        let mut clips = HashMap::new();
        for e in BAILES.iter().chain(EMOTES.iter()).chain(["Patada"].iter()) { clips.insert(e.to_string(), ClipEmote::de(d, e)); }
        let chars = d["chars"].as_array().map(|l| l.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
        Npcs { lista: vec![], max: 24, act: None, lento: 0, piso: "grass".into(), sig: 1, n_cuadro: 0, clips, chars,
            c: Ctx { t: 0.0, azar: Azar(semilla), azar2: Azar(semilla ^ 0x9E37_79B9), ev: vec![], sf, carne: (1..=5).map(|k| format!("CB_Flesh{k}")).collect(), tmp: Tmp::default(), son_pasos: (-9.0, 0), tiros: 0 } }
    }
    /// los eventos desde la última vez
    pub fn eventos(&mut self) -> Vec<Evento> { std::mem::take(&mut self.c.ev) }
    /// el reloj de los NPC (s)
    pub fn tiempo(&self) -> f64 { self.c.t }
    /// cuántos tiros hicieron (NPC.tiros)
    pub fn tiros(&self) -> u32 { self.c.tiros }
    pub fn get(&self, id: u32) -> Option<&Npc> { self.lista.iter().find(|p| p.id == id).map(|b| &**b) }
    pub fn get_mut(&mut self, id: u32) -> Option<&mut Npc> { self.lista.iter_mut().find(|p| p.id == id).map(|b| &mut **b) }
    /// el NPC de un cuerpo de la física (su cápsula o una parte de su muñeco), para los tiros y las armas del jugador
    pub fn de_cuerpo(&self, cuerpo: u32) -> Option<u32> { de_cuerpo(&self.lista, cuerpo) }
    /// los skins que se pueden poner (DATA.chars)
    pub fn skins(&self) -> &[String] { &self.chars }

    /// pone un NPC (npcCrear) parado en el punto del piso `p`, mirando a `yaw`, con su actitud (None: la del panel, si no la
    /// de siempre). Devuelve su número (None si ya están todos: el tope `max`)
    pub fn crear(&mut self, cuerpo: CuerpoNpc, p: P3, yaw: f32, act: Option<Actitud>, fis: &mut Fisica) -> Option<u32> {
        if self.lista.len() >= self.max { return None; }
        let act = act.or_else(|| self.act.clone()).unwrap_or_default().normalizada();
        let id = self.sig; self.sig += 1;
        let pos = [p[0] as f64, p[1] as f64 + 0.96, p[2] as f64];
        let mut ia = Ia { casa: pos, ..Default::default() }; ia.decir_t = 3.0 + self.c.azar.f() * 5.0;
        let tam = cuerpo.pj.tam as f64;
        // la cápsula en la física (npcCuerpo): la choca el jugador, los objetos y los rayos (en la web queda en el origen
        // hasta el primer cuadro; acá va con el NPC desde el principio)
        let mut b = Cuerpo::nuevo(Arc::new(fisica::forma_capsula(0.4, 0.5)), 80.0, OpCuerpo::default()); b.congelado = true; b.pos = pos;
        let cid = fis.agregar(b);
        let skin = cuerpo.pj.skin.clone();
        self.lista.push(Box::new(Npc { id, skin, pj: cuerpo.pj, cap: Capsula::nueva(pos), yaw: yaw as f64, mira: 0.0, tam, vida: act.vida, vivo: true, act, emote: None, arma: None,
            cuerpo: Some(cid), rag: None, muneco: false, muerto_t: 0.0, globo: None, visible: false, ia, voz_t: -9.0, cols: cuerpo.cols,
            emo_pj: None, base_ult: base([p[0], p[1], p[2]], yaw), anim_t: -9.0, dt_junto: 0.0, n1: 1 + id % 7, cn: 0, dt_a: 0.0, paso_d: 0.0, paso_aire: 0.0, paso_vy: 0.0,
            armas: cuerpo.armas, arma_pj: None }));
        Some(id)
    }
    /// pone un muñeco de trapo (spawnNpc con muneco: cae con sus huesos, se agarra y no se levanta)
    pub fn crear_muneco(&mut self, cuerpo: CuerpoNpc, p: P3, yaw: f32, fis: &mut Fisica) -> Option<u32> {
        let act = Actitud::normal(&json!({ "modo": "quieto", "vida": 100, "de": "yo" }), None);
        let id = self.crear(cuerpo, [p[0], p[1] + 0.15, p[2]], yaw, Some(act), fis)?;
        let i = self.lista.iter().position(|q| q.id == id)?; let mut q = self.lista.remove(i);
        q.muneco = true; tumbar(&mut q, &mut self.c, fis, Some([0.0; 3])); q.ia.rag_t = 1e9;
        self.lista.insert(i, q); Some(id)
    }
    /// saca un NPC (npcQuitar): su cápsula y su muñeco
    pub fn quitar(&mut self, id: u32, fis: &mut Fisica) {
        if let Some(i) = self.lista.iter().position(|p| p.id == id) { let p = self.lista.remove(i); sacar_cuerpos(&p, fis); self.c.ev.push(Evento::Quitado { npc: id }); }
    }
    /// saca todos (npcTodos)
    pub fn todos(&mut self, fis: &mut Fisica) { for p in std::mem::take(&mut self.lista) { sacar_cuerpos(&p, fis); self.c.ev.push(Evento::Quitado { npc: p.id }); } }
    /// se olvida de todos sin tocar la física (cambio de mapa: la física se hace de nuevo)
    pub fn olvidar(&mut self) { self.lista.clear(); }

    /// la actitud nueva de un NPC (npcAplicar desde el panel): la vida hasta la nueva, su casa donde está y lo primero que dice
    pub fn aplicar(&mut self, id: u32, act: Actitud) {
        let Some(i) = self.lista.iter().position(|p| p.id == id) else { return };
        let p = &mut self.lista[i]; let vida = p.vida;
        p.vida = vida.max(1.0).min(act.vida); p.ia.casa = p.cap.pos; p.emote = None;
        let d = act.decir.first().cloned(); p.act = act;
        if let Some(t) = d { decir(p, &mut self.c, &t); }
    }
    /// que diga algo (npcDecir)
    pub fn decir(&mut self, id: u32, t: &str) { if let Some(i) = self.lista.iter().position(|p| p.id == id) { decir(&mut self.lista[i], &mut self.c, t); } }

    /// un golpe a un NPC (danarPersona): cuánto, dónde y hacia dónde; `de`: quién le pegó (si es otro NPC, se acuerda: npcGolpeado)
    pub fn danar(&mut self, id: u32, dan: f32, pos: P3, dir: P3, fis: &mut Fisica, de: Option<Quien>) {
        let Some(i) = self.lista.iter().position(|p| p.id == id) else { return };
        let mut q = self.lista.remove(i);
        danar(&mut q, dan as f64, v64(pos), v64(dir), &mut self.c, fis);
        if let Some(Quien::Npc(d)) = de { if d != id { q.ia.venganza = Some((Quien::Npc(d), self.c.t)); } }
        self.lista.insert(i, q);
    }
    /// lo tira al piso como muñeco de trapo con un empujón (npcTumbar: la patada del jugador, la Gravity Gun)
    pub fn tumbar(&mut self, id: u32, imp: P3, fis: &mut Fisica) {
        let Some(i) = self.lista.iter().position(|p| p.id == id) else { return };
        let mut q = self.lista.remove(i); tumbar(&mut q, &mut self.c, fis, Some(v64(imp))); self.lista.insert(i, q);
    }
    /// agarrado con la Physics Gun o la Gravity Gun (npcAgarrarRag): si el cuerpo es la cápsula de un NPC vivo, se hace
    /// muñeco y devuelve la parte más cercana a `punto` (la que hay que sostener); si no, el mismo cuerpo
    pub fn agarrar(&mut self, cuerpo: u32, punto: P3, fis: &mut Fisica) -> u32 {
        let Some(i) = self.lista.iter().position(|p| p.cuerpo == Some(cuerpo)) else { return cuerpo };
        if !self.lista[i].vivo || self.lista[i].rag.is_some() { return cuerpo; }
        let mut q = self.lista.remove(i);
        tumbar(&mut q, &mut self.c, fis, None);
        let mut mejor = (cuerpo, 1e9f64);
        if let Some(r) = &q.rag { for pt in &r.partes { if let Some(b) = fis.cuerpo(pt.cuerpo) { let d = dist(b.pos, v64(punto)); if d < mejor.1 { mejor = (pt.cuerpo, d); } } } q.ia.rag_t = 2.2; }
        self.lista.insert(i, q);
        mejor.0
    }

    /// un cuadro (npcPaso, y lo de personasPaso para los muñecos): los muñecos siguen a su cadera y los muertos se borran a
    /// los 15 s, los pasos suenan y cada uno piensa y se mueve. `cam`: dónde está la cámara (los pasos lejanos no suenan y,
    /// con `lento`, los lejanos piensan cada dos o cuatro cuadros)
    pub fn paso(&mut self, dt: f32, m: &Mundo, fis: &mut Fisica, jug: &Gente, cam: P3) {
        if self.lista.is_empty() { return; }
        let dt = dt.clamp(0.0, 0.1); let dtd = dt as f64; let cam = v64(cam);
        self.c.t += dtd;
        // (la grilla de los cuerpos se rehace una vez por cuadro, como cuerposCerca de la web: las cápsulas se mueven sin
        // avisarle y, si la física no dio un paso, los NPC no se veían entre ellos)
        if let Some(id) = self.lista.iter().find_map(|p| p.cuerpo) { fis.cuerpo_mut(id); }
        // (personasPaso) el muñeco: la cápsula de la persona va con la cadera; el muerto se borra a los 15 s
        let mut i = 0;
        while i < self.lista.len() {
            let p = &mut self.lista[i];
            if let Some(r) = &p.rag { if let Some(b) = r.cadera.and_then(|k| fis.cuerpo(r.partes[k].cuerpo)) { p.cap.pos = b.pos; } }
            if !p.vivo { p.muerto_t -= dtd; if p.muerto_t <= 0.0 { let p = self.lista.remove(i); sacar_cuerpos(&p, fis); self.c.ev.push(Evento::Quitado { npc: p.id }); continue; } }
            i += 1;
        }
        self.pasos(dtd, cam);
        let mut i = 0;
        while i < self.lista.len() {
            let mut p = self.lista.remove(i);
            // (se cayó del mapa)
            if p.cap.pos[1] < m.lo[1] as f64 - 60.0 { sacar_cuerpos(&p, fis); self.c.ev.push(Evento::Quitado { npc: p.id }); continue; }
            // (con el procesador que no da, los que están a más de 15 m de la cámara piensan y se mueven cada dos cuadros y a
            // más de 30 m cada cuatro, con el tiempo juntado; nunca más de 0,1 s de golpe, así no atraviesan paredes)
            let agarrado = p.cuerpo.and_then(|id| fis.cuerpo(id)).map(|b| b.agarrado).unwrap_or(false);
            if self.lento > 0 && p.vivo && p.rag.is_none() && !agarrado {
                let (dx, dz) = (p.cap.pos[0] - cam[0], p.cap.pos[2] - cam[2]); let d2 = dx * dx + dz * dz;
                let cada = (if d2 > 900.0 { if self.lento >= 2 { 4 } else { 2 } } else if d2 > 225.0 { 2 } else { 1 }).min(((0.1 / dt.max(1e-3)).floor() as u32).max(1));
                p.dt_a += dt;
                if cada > 1 { p.cn = (if p.cn == 0 { p.n1 } else { p.cn }) + 1; if p.cn % cada != 0 { self.lista.insert(i, p); i += 1; continue; } }
                let da = p.dt_a; p.dt_a = 0.0;
                cerebro(&mut p, &mut self.lista, &mut self.c, da as f64, m, fis, jug);
            } else { p.dt_a = 0.0; cerebro(&mut p, &mut self.lista, &mut self.c, dtd, m, fis, jug); }
            self.lista.insert(i, p); i += 1;
        }
        // (npcGloboPaso) el globito se va solo
        for p in self.lista.iter_mut() { if let Some(g) = p.globo.as_mut() { g.1 -= dt; if g.1 <= 0.0 { p.globo = None; } } }
    }

    /// los pasos de los NPC que están a menos de 22 m (sonPasos): uno cada tanto según la velocidad y uno fuerte al caer
    fn pasos(&mut self, dt: f64, cam: V) {
        let Npcs { lista, c, piso, .. } = self;
        for p in lista.iter_mut() {
            if p.rag.is_some() { p.paso_d = 0.0; p.paso_aire = 0.0; continue; }
            let pos = p.cap.pos; if dist(pos, cam) > 22.0 { continue; }
            let suelo = p.cap.suelo; let mut sonar: Option<f64> = None;
            if suelo && p.paso_aire > 0.3 && p.paso_vy < -3.0 { sonar = Some((0.35 - p.paso_vy / 14.0).min(1.0)); p.paso_d = 0.0; }
            if !suelo { p.paso_aire += dt; p.paso_vy = p.cap.vel[1]; }
            else {
                p.paso_aire = 0.0;
                let sp = p.cap.vel[0].hypot(p.cap.vel[2]);
                if sp < 0.4 { p.paso_d = p.paso_d.min(0.4); }
                else {
                    let l = (0.72 + 0.17 * (sp - 1.4).max(0.0)).min(1.6) * p.tam; p.paso_d += sp * dt;
                    if p.paso_d >= l { p.paso_d -= l; sonar = Some((sp / 6.0).clamp(0.35, 0.8)); }
                }
            }
            let Some(vol) = sonar else { continue };
            // (sonPaso: de los demás, como mucho 10 por segundo)
            if c.t - c.son_pasos.0 > 1.0 { c.son_pasos = (c.t, 0); }
            c.son_pasos.1 += 1; if c.son_pasos.1 > 10 { continue; }
            let n = format!("PS_{}{}", piso, 1 + (c.azar2.f() * 4.0) as u32); let tono = 0.94 + c.azar2.f() * 0.12;
            sonido(c, &n, Some([pos[0], pos[1] - 0.9, pos[2]]), (vol * 0.75) as f32, tono);
        }
    }

    /// anima los que se ven (dibujarPersonas): los de fuera de la cámara (`vp`: la proyección por la vista) y a más de 4 m
    /// ni se animan ni se dibujan (el tiempo se junta, hasta 0,25 s); con `lento`, los lejanos cada dos a cuatro cuadros.
    /// Los muñecos ponen sus huesos donde están sus partes. Después `items`
    pub fn animar(&mut self, dt: f32, cam: P3, vp: Option<&M4>, fis: &Fisica) {
        self.n_cuadro = self.n_cuadro.wrapping_add(1);
        let planos = vp.map(m4::planos); let cam = v64(cam);
        let Npcs { lista, clips, c, lento, n_cuadro, .. } = self;
        for p in lista.iter_mut() {
            p.dt_junto = (p.dt_junto + dt.max(0.0)).min(0.25);
            let tk = p.tam as f32; let pos = p.pos(); let d = dist(p.cap.pos, cam);
            p.visible = d <= 4.0 || planos.as_ref().map(|pl| m4::esfera_dentro(pl, &[pos[0], pos[1] - 1.0 + 0.95 * tk, pos[2], 1.4 * tk])).unwrap_or(true);
            if !p.visible { continue; }
            if let Some(r) = &p.rag {
                // (ragdollPaso) cada hueso con cuerpo donde está su parte: W = M(cuerpo) · off
                let mut fijos: Vec<Option<M4>> = vec![None; p.pj.esqueleto().0.len()];
                for pt in &r.partes { if let Some(b) = fis.cuerpo(pt.cuerpo) { let mb = crate::mapa::trs(v32(b.pos), [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32], [1.0; 3]); fijos[pt.nodo] = Some(m4::mul(&mb, &pt.off)); } }
                let raiz = r.raiz; p.pj.poner_fijos(&raiz, &fijos); p.dt_junto = 0.0; continue;
            }
            let (cada, desde) = if *lento == 0 { (1, f64::INFINITY) } else if d > 30.0 { (if *lento >= 2 { 4 } else { 3 }, 12.0) } else { (2, 12.0) };
            if d > desde && n_cuadro.wrapping_add(p.n1) % cada != 0 { continue; }
            // el emote: si cambió, se le dice al cuerpo (los rb: no están: el ChickenDance)
            if p.emote != p.emo_pj {
                let cl = p.emote.as_ref().and_then(|e| clips.get(e).cloned().flatten().or_else(|| clips.get("ChickenDance").cloned().flatten()));
                p.pj.emote(cl.as_ref()); p.emo_pj = p.emote.clone();
            }
            // el arma en la mano (la dibuja el cuerpo y la postura es la de GMod)
            if p.arma != p.arma_pj { let a = p.arma.and_then(|a| p.armas.get(a.nombre()).cloned()); p.pj.armar(a); p.arma_pj = p.arma; }
            let piso = p.piso(); let (yaw, mira) = (p.yaw as f32, p.mira as f32);
            p.pj.animar(p.dt_junto, &Estado { piso, vel: v32(p.cap.vel), yaw, mira, en_suelo: p.cap.suelo, agachado: false, agua: None });
            p.dt_junto = 0.0;
            // (la patada, Backflip y Kick se terminan solos)
            if p.emo_pj.is_some() && !p.pj.en_emote() { if p.emote == p.emo_pj { p.emote = None; } p.emo_pj = None; }
            p.base_ult = base(piso, yaw); p.anim_t = c.t;
        }
    }
    /// lo que se dibuja de los que se ven (después de `animar`)
    pub fn items(&self, out: &mut Vec<ItemDin>) {
        // (los que tienen un modelo de un addon de GMod —skin «gmpm:…»— los dibuja el juego con ese modelo: nativo/gmod_pm.rs)
        for p in &self.lista { if !p.visible || p.skin.starts_with("gmpm:") { continue; } if p.rag.is_some() { p.pj.items(&m4::id(), out); } else { p.pj.items(&p.base_ult, out); } }
    }
}

/// dónde poner un NPC desde el menú (spawnNpc): donde mira la cámara (hasta 40 m; si no, 4 m adelante, sobre el piso),
/// contra una pared al pie y un poco afuera, mirando a la cámara. Devuelve el punto del piso y hacia dónde mira
pub fn donde_poner(m: &Mundo, fis: &mut Fisica, cam: P3, dir: P3) -> (P3, f32) {
    let (cam, dir) = (v64(cam), v64(dir));
    let h = persona::rayo(m, fis, cam, dir, 40.0, &[]);
    let mut p = add(cam, esc(dir, h.map(|h| h.t).unwrap_or(4.0)));
    match h {
        Some(h) if h.n[1] < 0.5 => { p = add(p, esc(h.n, 0.45)); if let Some(g) = persona::rayo_mundo(m, add(p, [0.0, 0.5, 0.0]), [0.0, -1.0, 0.0], 50.0) { p[1] += 0.5 - g.0; } }
        None => { if let Some(g) = persona::rayo_mundo(m, p, [0.0, -1.0, 0.0], 50.0) { p[1] -= g.0; } }
        _ => {}
    }
    (v32(p), (cam[0] - p[0]).atan2(cam[2] - p[2]) as f32)
}
/// la pestaña NPCs del menú de spawn (spawnNpcsTab): los personajes del juego como NPC («npc:Hero»…), en «Personajes»
pub fn menu(d: &Value) -> Vec<(String, Vec<String>)> {
    let l: Vec<String> = d["chars"].as_array().map(|l| l.iter().filter_map(|x| x.as_str().map(|s| format!("npc:{s}"))).collect()).unwrap_or_default();
    vec![("Personajes".into(), l)]
}
/// el skin de un ítem del menú («npc:Hero» → «Hero»)
pub fn skin_de_item(it: &str) -> Option<&str> { it.strip_prefix("npc:") }
/// el nombre de un skin para mostrar (skinNom)
/// (con los nombres propios de las skins heredadas: identidad.js)
pub fn skin_nom(s: &str) -> &str { crate::identidad::nombre_skin(s).unwrap_or(s) }

fn de_cuerpo(l: &[Box<Npc>], cuerpo: u32) -> Option<u32> {
    l.iter().find(|p| p.cuerpo == Some(cuerpo) || p.rag.as_ref().map(|r| r.partes.iter().any(|x| x.cuerpo == cuerpo)).unwrap_or(false)).map(|p| p.id)
}
fn sacar_cuerpos(p: &Npc, fis: &mut Fisica) {
    if let Some(id) = p.cuerpo { fis.quitar(id); }
    if let Some(r) = &p.rag { for pt in &r.partes { fis.quitar(pt.cuerpo); } }
}
/// la cápsula va con la persona (sin rehacer la grilla de la física: se mueve menos que su margen entre pasos, como en la web)
fn capsula_poner(fis: &mut Fisica, id: Option<u32>, pos: V) {
    let Some(i) = id.and_then(|id| fis.indice(id)) else { return };
    let b = &mut fis.cuerpos[i]; b.pos = pos; b.q = QID; b.vel = [0.0; 3]; b.actualizar();
}
/// la cápsula de un tirado: ni rayos, ni física, ni la choca la gente (noRay, noPhys, noJug; abajo de todo, que jugador.rs
/// no mira esas marcas)
fn capsula_esconder(fis: &mut Fisica, id: Option<u32>) {
    let Some(b) = id.and_then(|id| fis.cuerpo_mut(id)) else { return };
    b.no_rayo = true; b.sin_fisica = true; b.pos[1] = -1000.0; b.vel = [0.0; 3]; b.actualizar();
}
fn decir(p: &mut Npc, c: &mut Ctx, t: &str) {
    if t.is_empty() { return; }
    let dur = 3.5 + t.encode_utf16().count() as f32 * 0.04;
    p.globo = Some((t.to_string(), dur)); c.ev.push(Evento::Decir { npc: p.id, texto: t.to_string(), dur });
}
/// su voz (sonVoz): no más de una vez cada 0,45 s, salvo al morir
fn voz(p: &mut Npc, c: &mut Ctx, tipo: &str) {
    if c.t - p.voz_t < if tipo == "muere" { 0.0 } else { 0.45 } { return; }
    let Some((n, tono)) = persona::voz(&p.skin, tipo, &mut c.azar2) else { return };
    p.voz_t = c.t; sonido(c, &n, Some(p.cap.pos), 0.9, tono as f64);
}

// ---------------- el cerebro ----------------
/// el que le pegó hace poco (10 s, a menos de 45 m): a ése se da vuelta (npcVenganza)
fn venganza(p: &Npc, otros: &[Box<Npc>], jug: &Gente, t: f64) -> Option<Blanco> {
    let (q, t0) = p.ia.venganza?; if t - t0 > 10.0 { return None; }
    let (pos, tam) = match q { Quien::Jugador => { if !jug.vivo { return None; } (jug.pos, jug.tam) } Quien::Npc(id) => { let o = otros.iter().find(|o| o.id == id)?; if !o.en_pie() { return None; } (o.cap.pos, o.tam) } };
    if dist(pos, p.cap.pos) < 45.0 { Some(Blanco { q, pos, tam }) } else { None }
}
/// a quién mira, sigue o persigue (npcObjetivo): el NPC más cerca (obj npc) o el jugador
fn objetivo(p: &Npc, otros: &[Box<Npc>], jug: &Gente) -> Option<Blanco> {
    if p.act.obj == Obj::Npc {
        let mut mejor: Option<Blanco> = None; let mut dm = 1e9f64;
        for q in otros { if !q.en_pie() { continue; } let d = dist(q.cap.pos, p.cap.pos); if d < dm { dm = d; mejor = Some(Blanco { q: Quien::Npc(q.id), pos: q.cap.pos, tam: q.tam }); } }
        return mejor;
    }
    // (la gente: sólo el jugador de esta compu; obj yo con `de` busca al que se la dio, si no, el más cerca)
    if jug.vivo { Some(Blanco { q: Quien::Jugador, pos: jug.pos, tam: jug.tam }) } else { None }
}
/// lo que amenaza al que defiende (npcAmenaza): el que le pegó, los hostiles a menos de 30 m de su protegido (o de 18 m de él)
fn amenaza(p: &Npc, prot: Option<&Blanco>, otros: &[Box<Npc>], jug: &Gente, t: f64) -> Option<Blanco> {
    let c = prot.map(|b| b.pos).unwrap_or(p.cap.pos);
    let mut mejor = venganza(p, otros, jug, t); let mut dm = mejor.map(|b| dist(b.pos, p.cap.pos) * 0.7).unwrap_or(1e9);
    for q in otros {
        if !q.en_pie() || q.bando() != Bando::Malo { continue; }
        let dp = dist(q.cap.pos, p.cap.pos); if dist(q.cap.pos, c) > 30.0 && dp > 18.0 { continue; }
        if dp < dm { dm = dp; mejor = Some(Blanco { q: Quien::Npc(q.id), pos: q.cap.pos, tam: q.tam }); }
    }
    mejor
}
/// dónde está alguien ahora (el obj de la web guarda el vector vivo)
fn donde(q: Quien, otros: &[Box<Npc>], jug: &Gente) -> Option<V> {
    match q { Quien::Jugador => Some(jug.pos), Quien::Npc(id) => otros.iter().find(|o| o.id == id).map(|o| o.cap.pos) }
}

/// ¿se puede ir por ahí? (npcLibre: rodilla libre o algo bajo que se salta; sin barranco de más de 4 m)
fn libre(p: &Npc, m: &Mundo, fis: &mut Fisica, dir: V, l: f64) -> Libre {
    let pos = p.cap.pos; let rod = [pos[0], pos[1] - 0.6, pos[2]];
    if let Some(h) = persona::rayo(m, fis, rod, dir, l, p.propio()) {
        if h.n[1] < 0.6 {
            let cab = persona::rayo(m, fis, [pos[0], pos[1] + 0.55, pos[2]], dir, l, p.propio());
            if cab.is_none() && p.cap.suelo {
                let o = add(add(rod, esc(dir, l.min(h.t + 0.3))), [0.0, 1.25, 0.0]);
                if let Some(a) = persona::rayo(m, fis, o, [0.0, -1.0, 0.0], 1.3, p.propio()) { if a.n[1] > 0.6 && 1.25 - a.t < 1.05 { return Libre::Saltar; } }
            }
            return Libre::No;
        }
    }
    let adel = add(pos, esc(dir, l));
    match persona::piso_bajo(m, adel, 0.5) { Some(piso) if pos[1] - 0.95 - piso <= 4.0 => Libre::Si, _ => Libre::No }
}
/// ¿lo ve? (npcVe: sin nada en el medio, de los ojos al pecho)
fn ve(p: &Npc, bl: &Blanco, otros: &[Box<Npc>], m: &Mundo, fis: &mut Fisica) -> bool {
    let pos = p.cap.pos; let o = [pos[0], pos[1] + 0.55 * p.tam, pos[2]]; let t = [bl.pos[0], bl.pos[1] + 0.3, bl.pos[2]];
    let dv = sub(t, o); let l = largo(dv); if l < 0.05 { return true; }
    let Some(h) = persona::rayo(m, fis, o, esc(dv, 1.0 / l), l, p.propio()) else { return true };
    let es = h.cuerpo.and_then(|c| de_cuerpo(otros, c)).map(Quien::Npc) == Some(bl.q);
    es || h.t > l - 0.45
}
/// de dónde sale el tiro (npcBoca): la mano derecha (si se animó hace poco y está con el cuerpo), si no, el pecho
fn boca(p: &Npc, t: f64, hacia_p: V) -> V {
    let pos = p.cap.pos;
    let mano = if t - p.anim_t < 0.3 { p.pj.hueso("RightHand").map(|w| { let m = m4::mul(&p.base_ult, &w); [m[12] as f64, m[13] as f64, m[14] as f64] }) } else { None };
    let mut o = match mano { Some(o) if o.iter().all(|x| x.is_finite()) && dist(o, pos) <= 1.6 * p.tam => o, _ => [pos[0], pos[1] + 0.45 * p.tam, pos[2]] };
    let d = sub(hacia_p, o); let l = largo(d); if l > 0.3 { o = add(o, esc(d, 0.25 / l)); }
    o
}
/// el jugador en la línea de un tiro (rayoJugador): la distancia y el punto
fn rayo_jugador(jug: &Gente, o: V, dir: V, l: f64) -> Option<(f64, V)> {
    if !jug.vivo { return None; }
    let mut mejor: Option<(f64, V)> = None;
    for &dy in &jug.esf {
        let c = [jug.pos[0], jug.pos[1] + dy, jug.pos[2]]; let t = dot(sub(c, o), dir).clamp(0.0, l); let q = add(o, esc(dir, t));
        if dist(q, c) < jug.radio && mejor.map(|m| t < m.0).unwrap_or(true) { mejor = Some((t, q)); }
    }
    mejor
}
/// el que defiende no tira si hay un amigo en el medio (npcAmigoEnMedio): el jugador o alguien que no es malo
#[allow(clippy::too_many_arguments)]
fn amigo_en_medio(p: &Npc, otros: &[Box<Npc>], m: &Mundo, fis: &mut Fisica, jug: &Gente, o: V, d: V, l: f64) -> bool {
    if p.bando() != Bando::Bueno { return false; }
    if let Some((t, _)) = rayo_jugador(jug, o, d, l) { if t < l - 0.5 { return true; } }
    let Some(h) = persona::rayo(m, fis, o, d, l, p.propio()) else { return false };
    let Some(q) = h.cuerpo.and_then(|c| de_cuerpo(otros, c)).and_then(|id| otros.iter().find(|x| x.id == id)) else { return false };
    h.t < l - 0.5 && q.bando() != Bando::Malo
}

/// el cerebro de un NPC en un cuadro (npcCerebro): `p` fuera de la lista, `otros` los demás
#[allow(clippy::too_many_arguments)]
fn cerebro(p: &mut Npc, otros: &mut Vec<Box<Npc>>, c: &mut Ctx, dt: f64, m: &Mundo, fis: &mut Fisica, jug: &Gente) {
    // muerto: tirado (se borra a los 15 s); tirado vivo: se levanta solo (mientras alguien lo tiene agarrado no se levanta;
    // al soltarlo espera a quedar quieto)
    if !p.vivo || p.rag.is_some() {
        if p.rag.is_some() && p.vivo && !p.muneco {
            let r = p.rag.as_ref().unwrap();
            let sost = r.partes.iter().any(|x| fis.cuerpo(x.cuerpo).map(|b| b.agarrado).unwrap_or(false));
            let vc = r.cadera.and_then(|k| fis.cuerpo(r.partes[k].cuerpo)).map(|b| largo(b.vel)).unwrap_or(0.0);
            if sost { p.ia.rag_t = p.ia.rag_t.max(2.2); }
            else { p.ia.rag_t -= dt; if p.ia.rag_t <= 0.0 { if vc > 1.2 { p.ia.rag_t = 0.3; } else { levantar(p, c, m, fis); } } }
        }
        return;
    }
    // levantado de la cápsula con la Physics Gun o la Gravity Gun: lo lleva la cápsula
    if let Some((agarrado, bpos, bvel)) = p.cuerpo.and_then(|id| fis.cuerpo(id)).map(|b| (b.agarrado, b.pos, b.vel)) {
        if agarrado { p.cap.pos = bpos; p.cap.vel = bvel; p.cap.suelo = false; p.ia.llevado = true; p.emote = None; return; }
        if p.ia.llevado {
            p.ia.llevado = false; p.cap.vel = bvel;
            if let Some(b) = p.cuerpo.and_then(|id| fis.cuerpo_mut(id)) { b.congelado = true; b.vel = [0.0; 3]; b.ang = [0.0; 3]; b.q = QID; }
            if largo(p.cap.vel) > 9.0 { let v = p.cap.vel; tumbar(p, c, fis, Some(v)); return; }
        }
    }
    // a quién: el hostil, al más cercano (o al que le pegó); el que defiende sigue a su protegido y pelea con lo que lo amenaza
    let modo = p.act.modo; let def = modo == Modo::Defender;
    let ven = if p.act.hostil { venganza(p, otros, jug, c.t) } else { None };
    let obj = ven.or_else(|| objetivo(p, otros, jug));
    let pos = p.cap.pos;
    let d = obj.map(|o| hyp(o.pos, pos)).unwrap_or(1e9); let hc = obj.map(|o| hacia(pos, o.pos));
    let bl = if def { amenaza(p, obj.as_ref(), otros, jug, c.t) } else if p.act.hostil && modo != Modo::Bailar && modo != Modo::Huir { obj } else { None };
    let t0 = p.act.arma.and_then(Arma::tiro);
    p.arma = p.act.arma;
    let mut quiere: Option<V> = None; let mut vel = p.act.vel; let mut mirar: Option<V> = None;
    let av = p.act.vel; let adist = p.act.dist;
    p.ia.meta_t -= dt; p.ia.golpe_t -= dt; p.ia.salto_t -= dt;
    match modo {
        Modo::Quieto => { if obj.is_some() && d < 6.0 { mirar = hc; } }
        Modo::Mirar => { if obj.is_some() { mirar = hc; } }
        Modo::Pasear => { quiere = pasear(p, c, 10.0, None, dt); vel = av.min(3.0); }
        Modo::Seguir => {
            if obj.is_some() && d > adist + 0.6 { quiere = hc; vel = if d > adist + 8.0 { av.max(5.5) } else { av }; } else if obj.is_some() { mirar = hc; }
        }
        Modo::Perseguir => {
            if obj.is_some() && d > adist.max(0.9) { quiere = hc; } else if obj.is_some() { mirar = hc; }
            if obj.is_none() { quiere = pasear(p, c, 10.0, None, dt); vel = 2.0; }
        }
        Modo::Huir => {
            if obj.is_some() && d < adist { quiere = hc.map(|h| esc(h, -1.0)); } else { quiere = pasear(p, c, 6.0, None, dt); vel = 2.0; }
        }
        Modo::Bailar => {
            if obj.is_some() && d < 8.0 { mirar = hc; }
            if p.emote.is_none() || p.emote.as_deref() == Some("Patada") { let e = if p.act.emote.is_empty() { "ChickenDance".to_string() } else { p.act.emote.clone() }; if emote_valido(&e) { p.emote = Some(e); } }
        }
        Modo::Defender => {
            if let Some(b) = bl {
                let db = hyp(b.pos, pos); let hb = hacia(pos, b.pos);
                if obj.is_some() && d > 25.0 { quiere = hc; vel = av.max(5.5); }   // (no se va lejos del que defiende)
                else if let Some(t0) = t0 { if db > t0.rango * 0.75 || !p.ia.vis { quiere = Some(hb); vel = av.max(4.5); } else { mirar = Some(hb); } }
                else if db > 1.1 { quiere = Some(hb); vel = av.max(5.5); } else { mirar = Some(hb); }
            } else if obj.is_some() && d > adist + 0.6 { quiere = hc; vel = if d > adist + 8.0 { av.max(5.5) } else { av }; } else if obj.is_some() { mirar = hc; }
        }
        Modo::Guardia => {
            let casa = p.ia.casa; let en_casa = hyp(casa, pos); let cerca_casa = obj.map(|o| hyp(o.pos, casa) < adist).unwrap_or(false);
            if cerca_casa { if p.act.hostil && d > 1.1 { quiere = hc; } else { mirar = hc; } vel = av.max(4.0); }
            else if en_casa > 1.0 { quiere = Some(hacia(pos, casa)); vel = av.min(3.5); }
            else if obj.is_some() && d < adist + 6.0 { mirar = hc; }
        }
    }
    // con un arma de fuego: lo tiene a tiro y lo ve → se planta y tira (si no, se acerca como diga su modo)
    let hbl = bl.map(|b| hacia(pos, b.pos)); let dbl = bl.map(|b| hyp(b.pos, pos)).unwrap_or(1e9);
    if let (Some(t0), Some(_)) = (t0, bl) { if !def && p.ia.vis && dbl < t0.rango * 0.75 { quiere = None; mirar = hbl; } }
    match (t0, bl) { (Some(t0), Some(b)) => fuego(p, &b, t0, dt, otros, c, m, fis, jug), _ => { p.ia.ve_t = 0.0; p.ia.vis = false; } }
    // (el torso y la cabeza hacia arriba o abajo)
    p.mira = match (bl, t0) { (Some(b), Some(_)) => (-(b.pos[1] - pos[1]).atan2(dbl.max(0.5))).clamp(-0.8, 0.8), _ => p.mira * 0.9 };
    // pegar: una patada (o un palancazo) cuando lo tiene al lado (si es hostil o defiende, y no tiene un arma de fuego)
    if let Some(b) = bl {
        if t0.is_none() && dbl < 1.45 * p.tam + 0.2 && p.ia.golpe_t <= 0.0 && (b.pos[1] - pos[1]).abs() < 1.6 {
            p.ia.golpe_t = 1.05; p.ia.golpe = Some((0.2, b.q)); mirar = hbl; quiere = None;
            if p.act.arma == Some(Arma::Crowbar) { p.ia.pat_t = 0.4; p.pj.accion(Gesto::Tiro); let t = 0.95 + c.azar.f() * 0.1; sonido(c, "CB_Swing", Some(pos), 0.6, t); }
            else { p.ia.pat_t = 0.64; p.emote = Some("Patada".into()); let t = 0.85 + c.azar.f() * 0.1; sonido(c, "CB_Swing", Some(pos), 0.5, t); }
        }
    }
    if let Some((t, q)) = p.ia.golpe.as_mut().map(|g| { g.0 -= dt; *g }) { if t <= 0.0 { p.ia.golpe = None; pegar(p, q, otros, c, fis, jug); } }
    // (fuera de la vista no se anima: la patada se termina igual)
    if p.ia.pat_t > 0.0 { p.ia.pat_t -= dt; if p.ia.pat_t <= 0.0 && p.emote.as_deref() == Some("Patada") { p.emote = None; } }
    let pateando = p.ia.pat_t > 0.0;
    let g = GRAV * m.gravedad as f64;
    // esquivar: probar la dirección, si no, de a 35° para cada lado; si es bajo, saltarlo
    if let Some(mut q) = quiere.filter(|_| !pateando) {
        if p.ia.desvio_t > 0.0 { p.ia.desvio_t -= dt; q = rot_y(q, p.ia.desvio); quiere = Some(q); }
        // (lo libre del camino, recordado 0,1 s mientras va para el mismo lado: son 2 a 4 rayos por NPC en cada cuadro)
        let ok = match p.ia.libre { Some((ld, lt, lr)) if c.t - lt < 0.1 && ld[0] * q[0] + ld[2] * q[2] > 0.995 => lr, _ => { let r = libre(p, m, fis, q, 1.0); p.ia.libre = Some((q, c.t, r)); r } };
        match ok {
            Libre::Saltar => { if p.cap.suelo && p.ia.salto_t <= 0.0 { p.ia.salto_t = 0.7; p.cap.vel[1] = (2.0 * g * 1.1).sqrt(); p.cap.suelo = false; } }
            Libre::No => {
                let mut alt = None;
                for gi in [0.6f64, -0.6, 1.2, -1.2, 1.8, -1.8] { let qq = rot_y(q, gi); if libre(p, m, fis, qq, 1.0) == Libre::Si { alt = Some(qq); p.ia.desvio = gi; p.ia.desvio_t = 0.6; break; } }
                if alt.is_some() { quiere = alt; } else { quiere = None; p.ia.meta = None; p.ia.meta_t = 0.0; }
            }
            Libre::Si => {}
        }
        if quiere.is_some() && p.emote.as_deref().map(|e| e != "Patada").unwrap_or(false) { p.emote = None; }   // (caminando no sigue el baile)
    }
    // trabado (empujando una pared invisible o un prop): salta y se corre para un costado
    let vh = p.cap.vel[0].hypot(p.cap.vel[2]);
    if quiere.is_some() && vh < 0.35 * vel.min(2.0) {
        p.ia.trabado += dt;
        if p.ia.trabado > 1.2 { p.ia.trabado = 0.0; p.ia.desvio = if c.azar.f() < 0.5 { 1.4 } else { -1.4 }; p.ia.desvio_t = 1.0; if p.cap.suelo { p.cap.vel[1] = (2.0 * g * 1.1).sqrt(); } }
    } else { p.ia.trabado = 0.0; }
    // saltitos de alegría (si se lo pidieron)
    if p.act.salta && p.cap.suelo && p.ia.salto_t <= 0.0 && c.azar.f() < dt * 0.5 { p.ia.salto_t = 1.2; p.cap.vel[1] = (2.0 * g * 1.0).sqrt(); p.cap.suelo = false; }
    // la velocidad: como el jugador (acelera en el piso, poco en el aire), y la gravedad
    let vmax = if pateando { 0.0 } else if quiere.is_some() { vel } else { 0.0 }; let acel = if p.cap.suelo { 16.0 } else { 5.0 };
    let (tx, tz) = quiere.map(|q| (q[0] * vmax, q[2] * vmax)).unwrap_or((0.0, 0.0));
    let (dvx, dvz) = (tx - p.cap.vel[0], tz - p.cap.vel[2]); let dl = dvx.hypot(dvz);
    if dl > 0.0 { let k = (acel * dt / dl).min(1.0); p.cap.vel[0] += dvx * k; p.cap.vel[2] += dvz * k; }
    if !p.cap.suelo { p.cap.vel[1] -= g * dt; } else if p.cap.vel[1] < 0.0 { p.cap.vel[1] = -0.5; }
    let (vy_antes, era_suelo) = (p.cap.vel[1], p.cap.suelo);
    // moverse: la cápsula del jugador con los datos del NPC (npcMover)
    p.cap.mover_chocar(m, Some(fis), dt, 0.25, p.cuerpo, &mut c.tmp);
    if !p.cap.suelo && era_suelo && p.cap.vel[1] <= 0.0 {
        let q = p.cap.pos;
        if let Some((t, n)) = persona::rayo_mundo(m, [q[0], q[1] - 0.5, q[2]], [0.0, -1.0, 0.0], 0.8) { if n[1] > 0.6 { p.cap.pos[1] -= t - 0.45; p.cap.suelo = true; p.cap.vel[1] = -0.5; } }
    }
    // (cayó de muy alto: queda tirado)
    if !era_suelo && p.cap.suelo && vy_antes < -15.0 { let v = [p.cap.vel[0], 2.0, p.cap.vel[2]]; tumbar(p, c, fis, Some(v)); return; }
    // hacia dónde mira: adonde camina, o al que mira
    let f = if vh > 0.6 && quiere.is_some() { quiere } else { mirar };
    if let Some(f) = f { let yw = f[0].atan2(f[2]); let dy = vuelta(yw - p.yaw); p.yaw += dy * (dt * 8.0).min(1.0); }
    capsula_poner(fis, p.cuerpo, p.cap.pos);
    // habla: cada tanto, si hay alguien cerca
    if !p.act.decir.is_empty() {
        p.ia.decir_t -= dt;
        if p.ia.decir_t <= 0.0 {
            p.ia.decir_t = 7.0 + c.azar.f() * 7.0;
            if obj.is_some() && d < 16.0 { let k = ((c.azar.f() * p.act.decir.len() as f64) as usize).min(p.act.decir.len() - 1); let t = p.act.decir[k].clone(); decir(p, c, &t); }
        }
    }
}
/// pasear: un lugar al azar a menos de `radio` (de `centro` o de donde está), con pausas; la dirección hacia ahí
fn pasear(p: &mut Npc, c: &mut Ctx, radio: f64, centro: Option<V>, dt: f64) -> Option<V> {
    let pos = p.cap.pos; let ia = &mut p.ia;
    if ia.meta.map(|mt| ia.meta_t <= 0.0 || hyp(mt, pos) < 0.8).unwrap_or(true) {
        ia.meta_t = 4.0 + c.azar.f() * 5.0; let cc = centro.unwrap_or(pos); let ang = c.azar.f() * TAU; let r = radio * (0.3 + c.azar.f() * 0.7);
        ia.meta = Some([cc[0] + ang.sin() * r, cc[1], cc[2] + ang.cos() * r]); ia.pausa = if c.azar.f() < 0.35 { 1.0 + c.azar.f() * 2.0 } else { 0.0 };
    }
    if ia.pausa > 0.0 { ia.pausa -= dt; return None; }
    Some(hacia(pos, ia.meta.unwrap()))
}
/// una patada (o un palancazo): pega si todavía lo tiene al lado (npcPegar)
fn pegar(p: &mut Npc, q: Quien, otros: &mut [Box<Npc>], c: &mut Ctx, fis: &mut Fisica, jug: &Gente) {
    if !p.vivo || p.rag.is_some() { return; }
    let Some(qp) = donde(q, otros, jug) else { return };
    let pos = p.cap.pos; let d = hyp(qp, pos); if d > 1.9 * p.tam + 0.3 { return; }
    let dir = norm([qp[0] - pos[0], 0.25, qp[2] - pos[2]]); let pal = p.act.arma == Some(Arma::Crowbar);
    let dan = p.act.dano * if pal { 2.0 } else { 1.0 };
    let son = if pal { c.azar.de(&c.carne).unwrap_or("Melee1").to_string() } else { "Melee1".to_string() };
    match q {
        Quien::Jugador => {
            if jug.vivo { c.ev.push(Evento::DanoJugador { npc: p.id, dan: dan as f32, de: v32(pos), empuje: v32(add(esc(dir, 5.0), [0.0, 2.0, 0.0])) }); }
            sonido(c, &son, Some(jug.pos), 0.6, 1.0);
        }
        Quien::Npc(id) => {
            let Some(o) = otros.iter_mut().find(|o| o.id == id) else { return };
            let qpos = o.cap.pos;
            danar(o, dan, qpos, dir, c, fis); o.ia.venganza = Some((Quien::Npc(p.id), c.t));
            if o.vivo && o.rag.is_none() { o.cap.vel = add(o.cap.vel, esc(dir, 4.0)); o.cap.vel[1] += 1.5; }
            let op = o.cap.pos; sonido(c, &son, Some(op), 0.6, 1.0);
        }
    }
}
/// los tiros (npcFuego): ve al blanco (sin nada en el medio), reacciona (medio segundo), apunta al pecho y tira con su
/// cadencia y sus ráfagas; el tiro se abre más cuanto más lejos (y si camina). El daño, como el del arma pero a menos de
/// la mitad (los NPC no son tan certeros como para bajarte en dos tiros)
#[allow(clippy::too_many_arguments)]
fn fuego(p: &mut Npc, bl: &Blanco, t0: Tiro, dt: f64, otros: &mut [Box<Npc>], c: &mut Ctx, m: &Mundo, fis: &mut Fisica, jug: &Gente) {
    let Some(arma) = p.act.arma else { return };
    p.ia.vis_t -= dt; if p.ia.vis_t <= 0.0 { p.ia.vis_t = 0.15; p.ia.vis = ve(p, bl, otros, m, fis); }
    p.ia.tiro_t -= dt;
    if !p.ia.vis { p.ia.ve_t = 0.0; return; }
    p.ia.ve_t += dt;
    if p.ia.ve_t < 0.5 || p.ia.tiro_t > 0.0 || p.emote.is_some() { return; }
    let pos = p.cap.pos; let (dx, dz) = (bl.pos[0] - pos[0], bl.pos[2] - pos[2]); let dh = dx.hypot(dz); if dh > t0.rango * 1.25 { return; }
    if vuelta(dx.atan2(dz) - p.yaw).abs() > 0.45 { return; }   // (todavía no lo mira)
    let meta = [bl.pos[0], bl.pos[1] + 0.3 * bl.tam, bl.pos[2]]; let o = boca(p, c.t, meta); let d0 = sub(meta, o); let l0 = largo(d0); let d0 = norm(d0);
    if amigo_en_medio(p, otros, m, fis, jug, o, d0, l0) { p.ia.tiro_t = 0.35; return; }
    let (dan0, perd, _) = arma.def();
    let n = if perd { 8 } else { 1 }; let abre = t0.disp * (1.0 + dh / 13.0) * if p.cap.vel[0].hypot(p.cap.vel[2]) > 1.0 { 1.6 } else { 1.0 };
    let dan = dan0 * (p.act.dano / 12.0).clamp(0.25, 3.0) * 0.45;
    for _ in 0..n {
        let (rx, ry, rz) = (c.azar.f(), c.azar.f(), c.azar.f());
        let dir = norm([d0[0] + (rx - 0.5) * 2.0 * abre, d0[1] + (ry - 0.5) * 2.0 * abre, d0[2] + (rz - 0.5) * 2.0 * abre]);
        bala(p, o, dir, t0.rango * 1.6, dan, bl.q, otros, c, m, fis, jug);
    }
    let (sf, lista) = c.sf.get(&arma).cloned().unwrap_or_default();
    let s = if lista { c.azar.de(&sf).map(String::from) } else { sf.first().cloned() };
    if let Some(s) = s { sonido(c, &s, Some(o), 0.8, 1.0); }
    p.pj.accion(Gesto::Tiro);
    if t0.rafaga > 1 { p.ia.raf_n = (if p.ia.raf_n == 0 { t0.rafaga } else { p.ia.raf_n }) - 1; if p.ia.raf_n == 0 { p.ia.raf_n = t0.rafaga; p.ia.tiro_t = t0.pausa + c.azar.f() * 0.3; } else { p.ia.tiro_t = t0.cad; } }
    else { p.ia.tiro_t = t0.cad * (0.85 + c.azar.f() * 0.3); }
    c.tiros += 1;
}
/// una bala (npcBala): al jugador (si no es de los buenos o es su blanco), a una persona, a un objeto o al mapa
#[allow(clippy::too_many_arguments)]
fn bala(p: &Npc, o: V, dir: V, l: f64, dan: f64, blanco: Quien, otros: &mut [Box<Npc>], c: &mut Ctx, m: &Mundo, fis: &mut Fisica, jug: &Gente) {
    let bueno = p.bando() == Bando::Bueno;
    let h = persona::rayo(m, fis, o, dir, l, p.propio());
    let yo = if !bueno || blanco == Quien::Jugador { rayo_jugador(jug, o, dir, l) } else { None };
    let fin;
    if let Some((_, yp)) = yo.filter(|y| h.map(|h| y.0 < h.t).unwrap_or(true)) {
        fin = yp; c.ev.push(Evento::Impacto { p: v32(yp), n: v32(esc(dir, -1.0)), cuerpo: true });
        c.ev.push(Evento::DanoJugador { npc: p.id, dan: dan as f32, de: v32(p.cap.pos), empuje: v32(esc(dir, (dan * 0.05).min(2.0))) });
    } else if let Some(h) = h {
        fin = h.p; c.ev.push(Evento::Impacto { p: v32(h.p), n: v32(h.n), cuerpo: h.cuerpo.is_some() });
        if let Some(id) = h.cuerpo {
            if let Some(i) = fis.indice(id) {
                let b = &mut fis.cuerpos[i]; b.despertar();
                if b.dinamico() { let k = (dan * 0.4 / (b.masa * 0.05).max(1.0)).min(6.0); let r = sub(h.p, b.pos); persona::aplicar_vel(b, esc(dir, k), r); }
            }
            match de_cuerpo(otros, id) {
                Some(qid) => {
                    let q = otros.iter_mut().find(|x| x.id == qid).unwrap();
                    if !bueno || blanco == Quien::Npc(qid) || q.bando() == Bando::Malo { danar(q, dan, h.p, dir, c, fis); q.ia.venganza = Some((Quien::Npc(p.id), c.t)); }
                }
                None => { if Some(id) != p.cuerpo { c.ev.push(Evento::DanoObjeto { cuerpo: id, dan: dan as f32, p: v32(h.p), dir: v32(dir) }); } }
            }
        }
    } else { fin = add(o, esc(dir, l)); }
    c.ev.push(Evento::Traza { de: v32(o), a: v32(fin) });
}

// ---------------- el daño, al piso y levantarse ----------------
/// un golpe (danarPersona de un NPC): la vida baja; sin vida, muerto y tirado (15 s); un golpe de 40 o más lo tira
fn danar(q: &mut Npc, dan: f64, pos: V, d: V, c: &mut Ctx, fis: &mut Fisica) {
    if q.muneco { return; }   // (un muñeco de trapo: el golpe sólo lo empuja, como un prop_ragdoll de GMod)
    let vivia = q.vivo;
    if vivia { q.pj.accion(Gesto::Golpe); }
    if q.vivo {
        q.vida -= dan; c.ev.push(Evento::DanoNpc { npc: q.id, dan: dan as f32 });
        if q.vida <= 0.0 {
            q.vivo = false; q.emote = None; ragdoll(q, fis, Some(esc(norm(d), (dan * 0.3).min(12.0))), pos); q.muerto_t = 15.0;
            c.ev.push(Evento::Murio { npc: q.id });
        } else if dan >= 40.0 && q.rag.is_none() { tumbar(q, c, fis, Some(esc(norm(d), (dan * 0.15).min(10.0)))); }   // (un golpe fuerte lo tira)
    }
    if dan > 0.0 && vivia { voz(q, c, if q.vivo { "dolor" } else { "muere" }); }
}
/// al piso como muñeco de trapo (npcTumbar)
fn tumbar(p: &mut Npc, c: &mut Ctx, fis: &mut Fisica, imp: Option<V>) {
    if p.rag.is_some() { return; }
    p.emote = None; p.cap.vel = imp.unwrap_or([0.0; 3]);
    let pos = p.cap.pos; ragdoll(p, fis, imp.map(|i| esc(i, 0.6)), pos);
    p.ia.rag_t = 2.6 + c.azar.f();
    c.ev.push(Evento::Tumbado { npc: p.id });
}
/// se levanta donde quedó la cadera, parado en el piso (npcLevantar)
fn levantar(p: &mut Npc, c: &mut Ctx, m: &Mundo, fis: &mut Fisica) {
    if p.muneco { return; }   // (los muñecos de trapo se quedan tirados)
    let Some(r) = p.rag.take() else { return };
    let h = r.cadera.and_then(|k| fis.cuerpo(r.partes[k].cuerpo)).map(|b| b.pos).unwrap_or(p.cap.pos);
    for pt in &r.partes { fis.quitar(pt.cuerpo); }
    let piso = persona::piso_bajo(m, h, 1.0);
    p.cap.pos = [h[0], piso.unwrap_or(h[1] - 0.3) + 0.96, h[2]]; p.cap.vel = [0.0; 3]; p.cap.suelo = true;
    if let Some(b) = p.cuerpo.and_then(|id| fis.cuerpo_mut(id)) { b.no_rayo = false; b.sin_fisica = false; b.pos = p.cap.pos; b.q = QID; b.vel = [0.0; 3]; b.actualizar(); }
    c.ev.push(Evento::Levantado { npc: p.id });
}
/// el muñeco de trapo (ragdoll de personas.js): un cuerpo por hueso con collider del juego (caja, cápsula o esfera, con su
/// masa), unido al ancestro más cercano que tenga cuerpo (rodillas y codos con poco giro); el empujón va a la parte más
/// cercana a `donde`
fn ragdoll(p: &mut Npc, fis: &mut Fisica, imp: Option<V>, donde: V) {
    if p.rag.is_some() { return; }
    let raiz = base(p.piso(), p.yaw as f32);
    let (nombres, pa, w) = p.pj.esqueleto();
    let n = nombres.len(); let cols = p.cols.clone();
    let mundo: Vec<M4> = w.iter().map(|x| m4::mul(&raiz, x)).collect();
    let mut partes: Vec<Parte> = vec![]; let mut de_nodo: Vec<Option<u32>> = vec![None; n];
    for i in 0..n {
        let Some(Some(col)) = cols.get(i) else { continue };
        let wm = &mundo[i];
        let s = [0usize, 4, 8].iter().map(|&k| (wm[k] * wm[k] + wm[k + 1] * wm[k + 1] + wm[k + 2] * wm[k + 2]).sqrt()).fold(0.0f32, f32::max) as f64;
        let cen = punto(wm, col.c);
        let forma = match col.k {
            'b' => fisica::forma_caja(((col.s[0] as f64 * s).abs() / 2.0).max(0.03), ((col.s[1] as f64 * s).abs() / 2.0).max(0.03), ((col.s[2] as f64 * s).abs() / 2.0).max(0.03)),
            'c' => fisica::forma_capsula(col.r as f64 * s, (col.h as f64 * s / 2.0 - col.r as f64 * s).max(0.01)),
            _ => fisica::forma_esfera(if col.r != 0.0 { col.r as f64 } else { 0.1 } * s),
        };
        let mut b = Cuerpo::nuevo(Arc::new(forma), col.m.max(1.0) as f64, OpCuerpo { fric: 0.8, rest: 0.05, damp: 0.1, ang_damp: 0.8, grupo: GRUPO_MUNECO + p.id });
        let mut q = m4quat(wm);
        if col.k == 'c' && col.d != 1 { q = fisica::qmul(q, if col.d == 0 { fisica::qeje([0.0, 0.0, 1.0], std::f64::consts::FRAC_PI_2) } else { fisica::qeje([1.0, 0.0, 0.0], std::f64::consts::FRAC_PI_2) }); }
        b.pos = v64(cen); b.q = q; b.no_cruza = true; b.vel = p.cap.vel;
        let id = fis.agregar(b);
        let mb = crate::mapa::trs(cen, [q[0] as f32, q[1] as f32, q[2] as f32, q[3] as f32], [1.0; 3]);
        partes.push(Parte { nodo: i, cuerpo: id, off: m4::mul(&m4::inv(&mb), wm) }); de_nodo[i] = Some(id);
    }
    // uniones con el ancestro más cercano que tenga cuerpo
    for pt in &partes {
        let i = pt.nodo; let mut a = pa[i];
        while a >= 0 && de_nodo[a as usize].is_none() { a = pa[a as usize]; }
        if a < 0 { continue; }
        let pp = [mundo[i][12] as f64, mundo[i][13] as f64, mundo[i][14] as f64]; let aa = mundo[a as usize];
        let mut ax = sub(pp, [aa[12] as f64, aa[13] as f64, aa[14] as f64]); if largo(ax) < 1e-4 { ax = [0.0, 1.0, 0.0]; }
        let nm = &nombres[i]; let rod = nm.ends_with("Leg") || nm.ends_with("ForeArm");
        let op = if rod { OpUnion { swing: 0.25, twist: 0.2, bisagra: false, ..Default::default() } } else { OpUnion { swing: if nm.contains("Head") { 0.6 } else { 0.9 }, twist: 0.5, ..Default::default() } };
        fis.unir(de_nodo[a as usize].unwrap(), pt.cuerpo, pp, norm(ax), op);
    }
    if let Some(imp) = imp {
        let mut mejor: Option<(u32, f64)> = None;
        for pt in &partes { if let Some(b) = fis.cuerpo(pt.cuerpo) { let d = dist(b.pos, donde); if mejor.map(|m| d < m.1).unwrap_or(true) { mejor = Some((pt.cuerpo, d)); } } }
        if let Some(b) = mejor.and_then(|m| fis.cuerpo_mut(m.0)) { for e in 0..3 { b.vel[e] += imp[e]; } }
    }
    let cadera = partes.iter().position(|pt| nombres[pt.nodo].strip_prefix("mixamorig").map(|r| r.trim_start_matches(|c: char| c.is_ascii_digit()) == ":Hips").unwrap_or(false));
    p.rag = Some(Rag { partes, cadera, raiz });
    capsula_esconder(fis, p.cuerpo);
}
fn punto(m: &M4, p: P3) -> P3 { [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] }
/// el giro de una matriz sin su escala (m4quat)
fn m4quat(m: &M4) -> fisica::Q {
    let c = |k: usize| ((m[k] * m[k] + m[k + 1] * m[k + 1] + m[k + 2] * m[k + 2]) as f64).sqrt();
    let (sx, sy, sz) = (c(0), c(4), c(8));
    let (a, b, cc, d, e, f, g, h, k) = (m[0] as f64 / sx, m[1] as f64 / sx, m[2] as f64 / sx, m[4] as f64 / sy, m[5] as f64 / sy, m[6] as f64 / sy, m[8] as f64 / sz, m[9] as f64 / sz, m[10] as f64 / sz);
    let t = a + e + k;
    let q = if t > 0.0 { let s = (t + 1.0).sqrt() * 2.0; [(f - h) / s, (g - cc) / s, (b - d) / s, 0.25 * s] }
        else if a > e && a > k { let s = (1.0 + a - e - k).sqrt() * 2.0; [0.25 * s, (d + b) / s, (g + cc) / s, (f - h) / s] }
        else if e > k { let s = (1.0 + e - a - k).sqrt() * 2.0; [(d + b) / s, 0.25 * s, (h + f) / s, (g - cc) / s] }
        else { let s = (1.0 + k - a - e).sqrt() * 2.0; [(g + cc) / s, (h + f) / s, 0.25 * s, (b - d) / s] };
    fisica::qnorm(q)
}
