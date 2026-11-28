//! Los emotes nuevos de la web (emotes.js, ruleta.js y juntos.js), hijo de personajes.rs:
//! - los de captura de movimiento de CMU («c:», 2176: se leen de la APK o se bajan la primera vez, como la web), los del
//!   paquete («rb:», DATA.emo) y los hechos por la gente («u:», que llegan por la red: animq / anim);
//! - el panel con sus secciones (todos, favoritos, recientes, juntos, clásicos, bailes…), el buscador y la estrella;
//! - la ruleta (un toque la abre quieta; mantener y deslizar elige al soltar; «Editar emotes» elige qué va en cada lugar);
//! - juntos: los de a dos (dar la mano, chocar los cinco…) con el que está adelante, ubicados como se grabaron.
use super::*;
use jxjuego::personaje::Captura;
use std::collections::HashSet;
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::Arc;

/// las secciones del panel (EMO_CATS sin la tienda, que es de la tienda de la red)
pub const CATS: [(&str, &str); 15] = [("todos", "Todos"), ("fav", "Favoritos"), ("rec", "Recientes"), ("juntos", "Juntos"), ("clasico", "Clásicos"), ("baile", "Bailes"), ("gesto", "Gestos"), ("accion", "Acciones"),
    ("pelea", "Peleas"), ("deporte", "Deportes"), ("acrobacia", "Acrobacias"), ("animal", "Animales"), ("caminar", "Caminar y correr"), ("otro", "Otros"), ("mio", "Míos")];
/// los colores de cada sección (EMO_COL)
fn color_cat(c: &str) -> ([f32; 3], [f32; 3]) {
    let h = |s: &str| [1, 3, 5].map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap_or(0) as f32 / 255.0);
    let (a, b) = match c { "baile" => ("#8e44ad", "#d35400"), "caminar" => ("#2471a3", "#17a589"), "gesto" | "clasico" => ("#2e86c1", "#5dade2"), "accion" => ("#c0392b", "#e67e22"), "pelea" => ("#922b21", "#cb4335"),
        "deporte" => ("#1e8449", "#52be80"), "acrobacia" => ("#b9770e", "#f4d03f"), "animal" => ("#6e2c00", "#ca6f1e"), _ => ("#4d5656", "#839192") };
    (h(a), h(b))
}
/// los nombres en castellano de los del paquete que no se dicen igual (em.* de idiomas3.js)
fn nombre_rb(k: &str, n: &str) -> String {
    match k { "AllNight" => "Toda la noche", "Gracioso" => "Baile gracioso", "Alegria" => "Alegría", "Corazon" => "Corazón", "Victoria" => "¡Victoria!", "Musculos" => "Músculos", "NoNo" => "No, no",
        "Pulgar" => "Pulgar arriba", "ParadaMano" => "Parada de mano", "Soga" => "Saltar la soga", "GritoZombi" => "Grito zombi", "PateaPelota" => "Patada de fútbol", "HipHop2" => "Hip hop 2", _ => n }.to_string()
}
/// un emote del panel (emoLista)
#[derive(Clone, Debug)]
pub struct Item { pub id: String, pub n: String, pub cat: String, pub dur: f32, pub cmu: bool, pub ico: Option<String>, pub mio: bool }
/// los de a dos (JUNTOS): las capturas de A y de B y dónde se tocan
pub struct Junto { pub id: &'static str, pub n: &'static str, pub a: &'static str, pub b: &'static str, pub c: &'static [(&'static str, &'static str)], pub todos: bool, pub alcance: bool }
pub const JUNTOS: [Junto; 7] = [
    Junto { id: "mano", n: "Dar la mano", a: "18_01", b: "19_01", c: &[("RightHand", "RightHand")], todos: false, alcance: false },
    Junto { id: "cinco", n: "Chocar los cinco", a: "20_11", b: "21_11", c: &[("RightHand", "RightHand"), ("RightHand", "LeftHand"), ("LeftHand", "RightHand"), ("LeftHand", "LeftHand")], todos: false, alcance: false },
    Junto { id: "consolar", n: "Consolar", a: "22_05", b: "23_05", c: &[("RightHand", "LeftShoulder"), ("LeftHand", "RightShoulder")], todos: true, alcance: true },
    Junto { id: "demano", n: "Ir de la mano", a: "22_08", b: "23_08", c: &[("RightHand", "LeftHand"), ("LeftHand", "RightHand")], todos: false, alcance: true },
    Junto { id: "tirar", n: "Tirar del brazo", a: "18_05", b: "19_05", c: &[("RightHand", "LeftForeArm"), ("RightHand", "RightForeArm"), ("LeftHand", "LeftForeArm"), ("LeftHand", "RightForeArm")], todos: false, alcance: true },
    Junto { id: "levantar", n: "Ayudar a levantarse", a: "22_01", b: "23_01", c: &[("RightHand", "RightHand"), ("RightHand", "LeftHand"), ("LeftHand", "RightHand"), ("LeftHand", "LeftHand")], todos: false, alcance: false },
    Junto { id: "salsa", n: "Bailar salsa", a: "60_01", b: "61_01", c: &[("RightHand", "LeftHand"), ("LeftHand", "RightHand")], todos: false, alcance: false },
];
pub fn junto(id: &str) -> Option<&'static Junto> { JUNTOS.iter().find(|j| j.id == id) }
/// una escena de a dos (P.escena): el origen (A, y B corrido para que se toquen), el giro y el clip de cada uno
#[derive(Clone, Debug)]
pub struct EscenaJ { pub e: String, pub o: [f32; 3], pub ob: [f32; 3], pub th: f32, pub id: String, pub rol_b: bool }
/// la ruleta (RUL)
#[derive(Clone, Debug, Default)]
pub struct Rul { pub abierto: bool, pub fija: bool, pub editar: bool, pub sel: i32, pub quien: Option<i32>, pub x0: f32, pub y0: f32, pub t0: f32, pub asignar: Option<usize> }
/// el panel de emotes abierto: la sección, cuánto se bajó, lo buscado y cuántos se muestran
#[derive(Clone, Debug, Default)]
pub struct PanelEmo { pub cat: usize, pub scroll: f32, pub q: String }

#[derive(Default)]
pub struct Emo {
    /// de dónde se leen los archivos de emotes/cmu (la APK, o la carpeta en la compu)
    pub lector: Option<Box<dyn Fn(&str) -> Option<Vec<u8>>>>,
    /// el catálogo de CMU (los huesos y, de cada uno: id, nombre, sección, duración y si se repite)
    cat: Option<(Vec<String>, Vec<(String, String, String, f32, bool)>)>, cat_pedido: bool,
    pub clips: HashMap<String, Arc<Captura>>, faltan: HashSet<String>, bajada: Option<(Sender<(String, Option<Vec<u8>>)>, Receiver<(String, Option<Vec<u8>>)>)>,
    /// los de la gente que llegaron por la red (EMO.remotos) y los pedidos (cuándo se puede volver a pedir)
    remotos: HashMap<String, Value>, pedidos: HashMap<String, f32>,
    pub panel: Option<PanelEmo>, pub rul: Rul,
    /// el emote propio que espera su clip (se bajaba) y el de cada uno de los demás que espera el suyo
    quiero: Option<String>, rem_pend: HashMap<String, String>,
    /// juntos: el pedido que me hicieron (de quién, cuál, cuándo), el mío (cuál, a quién, cuándo) y las escenas en curso
    pub jnt_pedido: Option<(String, String, f32)>, jnt_mio: Option<(String, String, f32)>, pub escena: Option<EscenaJ>, pub rem_esc: HashMap<String, EscenaJ>, npc_esc: Option<(u32, EscenaJ)>,
    /// el atlas de íconos de la página del panel (qué emotes) y el de la ruleta
    ico: Option<Vec<String>>, ico_rul: Option<Vec<String>>,
    pub t: f32,
}
impl Emo {
    pub fn panel(&self) -> bool { self.panel.is_some() || (self.rul.abierto && self.rul.fija) || self.jnt_pedido.is_some() }
}
/// el emote de otro cuerpo (red_cuerpos: su emote cambió). Los de captura y los nuevos: su clip, si ya está; si no, queda
/// pendiente y se pide
pub fn aplicar_remoto(e: &mut Emo, pj: &mut Personaje, emote: Option<&str>, id: &str) {
    e.rem_pend.remove(id);
    let Some(em) = emote.filter(|x| x.starts_with("c:") || x.starts_with("rb:") || x.starts_with("u:")) else { return };
    if let Some(c) = e.clips.get(em).cloned() { let esc = e.rem_esc.get(id).map(|s| s.id == em).unwrap_or(false); pj.emote_captura(Some(c), esc); }
    else { e.rem_pend.insert(id.to_string(), em.to_string()); }
}
/// la raíz del cuerpo del jugador en una escena de a dos (en su origen, girado como se grabó)
/// (el origen O de la escena está a la altura de los centros de las cápsulas, como `jug.pos`: los pies 0,95 m más abajo)
pub fn base_escena(p: &Pjs) -> Option<M4> { let e = p.emo.escena.as_ref()?; let o = if e.rol_b { e.ob } else { e.o }; Some(personaje::base([o[0], o[1] - 0.95, o[2]], e.th)) }
pub fn base_escena_remoto(p: &Pjs, id: &str) -> Option<M4> { let e = p.emo.rem_esc.get(id)?; let o = if e.rol_b { e.ob } else { e.o }; Some(personaje::base([o[0], o[1] - 0.95, o[2]], e.th)) }

impl Juego {
    // ---------------- los clips ----------------
    /// el catálogo de CMU (catalogo.json, al lado de los archivos)
    fn emo_catalogo(&mut self) {
        if self.pjs.emo.cat.is_some() || self.pjs.emo.cat_pedido { return; } self.pjs.emo.cat_pedido = true;
        if self.pjs.emo.lector.is_none() {
            let dir = std::env::var("JXM_CMU").unwrap_or_else(|_| "/home/user/Ports/web/emotes/cmu".into());
            let datos = self.datos.clone();
            self.pjs.emo.lector = Some(Box::new(move |n: &str| std::fs::read(std::path::Path::new(&dir).join(n)).ok().or_else(|| datos.as_ref().and_then(|d| std::fs::read(d.join("cmu").join(n)).ok()))));
        }
        let Some(b) = self.pjs.emo.lector.as_ref().and_then(|l| l("catalogo.json")) else { return };
        let v: Value = serde_json::from_slice(&b).unwrap_or(Value::Null);
        let huesos = v["huesos"].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
        let items = v["items"].as_array().map(|a| a.iter().map(|x| (x[0].as_str().unwrap_or("").to_string(), x[1].as_str().unwrap_or("").to_string(), x[2].as_str().unwrap_or("otro").to_string(), x[3].as_f64().unwrap_or(1.0) as f32, x[4].as_i64().unwrap_or(0) != 0)).collect()).unwrap_or_default();
        self.pjs.emo.cat = Some((huesos, items));
    }
    /// el clip de un emote nuevo (emoClip), si ya está; los de captura se leen (o se piden para bajar) la primera vez
    pub(crate) fn emo_clip(&mut self, id: &str) -> Option<Arc<Captura>> {
        if let Some(c) = self.pjs.emo.clips.get(id) { return Some(c.clone()); }
        let c = if let Some(k) = id.strip_prefix("c:") {
            self.emo_catalogo();
            let (huesos, n) = { let cat = self.pjs.emo.cat.as_ref()?; (cat.0.clone(), cat.1.iter().find(|x| x.0 == k)?.1.clone()) };
            match self.pjs.emo.lector.as_ref().and_then(|l| l(&format!("{k}.bin"))) {
                Some(b) => Captura::de_rbe2(id, &n, &b, &huesos),
                None => { self.emo_bajar(k); return None; }
            }
        } else if let Some(k) = id.strip_prefix("rb:") { let p = self.paq.as_ref()?; let x = &p.d["emo"][k]; if !x.is_object() { return None; } Captura::de_json(id, x["n"].as_str().unwrap_or(k), x) }
        else if let Some(k) = id.strip_prefix("u:") { let v = self.pjs.emo.remotos.get(k)?; Captura::de_json(id, v["nombre"].as_str().unwrap_or(k), &v["clip"]) }
        else { None }?;
        let c = Arc::new(c); self.pjs.emo.clips.insert(id.to_string(), c.clone()); Some(c)
    }
    /// emoBajar: el archivo de un emote de captura que no está en la APK, de githack (como la web), en otro hilo; queda
    /// guardado en la carpeta de la app
    fn emo_bajar(&mut self, k: &str) {
        if !self.pjs.emo.faltan.insert(k.to_string()) { return; }
        let Some(h) = self.gmod.http_bin.clone() else { return };
        if self.pjs.emo.bajada.is_none() { self.pjs.emo.bajada = Some(channel()); }
        let tx = self.pjs.emo.bajada.as_ref().unwrap().0.clone(); let k = k.to_string(); let datos = self.datos.clone();
        std::thread::spawn(move || {
            let mut r = None;
            for b in ["https://raw.githack.com/Juniorspro/Ports/claude/ports-continuation-dm754a/web/emotes/cmu/", "https://raw.githack.com/Juniorspro/Ports/main/web/emotes/cmu/"] {
                if let Ok((200, d)) = h(&format!("{b}{k}.bin")) { r = Some(d); break; }
            }
            if let (Some(d), Some(dd)) = (&r, &datos) { let c = dd.join("cmu"); let _ = std::fs::create_dir_all(&c); let _ = std::fs::write(c.join(format!("{k}.bin")), d); }
            let _ = tx.send((k, r));
        });
    }
    /// los emotes que se pueden elegir (emoLista): los clásicos del juego, los nuevos del paquete, los de captura y los de la
    /// gente; los nuevos primero (el baile del nene del bote), con el catálogo que ya se leyó
    fn emo_items(&self) -> Vec<Item> {
        let Some(p) = self.paq.as_ref() else { return vec![] };
        let mut l: Vec<Item> = p.d["emotes"].as_array().map(|a| a.iter().filter_map(|e| e.as_str()).map(|e| Item { id: e.into(), n: e.into(), cat: "clasico".into(), dur: 0.0, cmu: false, ico: Some(format!("emo_{e}")), mio: false }).collect()).unwrap_or_default();
        if let Some(o) = p.d["emo"].as_object() { for (k, c) in o { l.push(Item { id: format!("rb:{k}"), n: nombre_rb(k, c["n"].as_str().unwrap_or(k)), cat: c["cat"].as_str().map(String::from).unwrap_or_else(|| if c["loop"].as_bool().unwrap_or(false) { "baile".into() } else { "gesto".into() }), dur: 0.0, cmu: false, ico: Some(format!("emo_{k}")), mio: false }); } }
        if let Some((_, it)) = &self.pjs.emo.cat { for x in it { let mut n: Vec<char> = x.1.chars().collect(); if let Some(c) = n.first_mut() { *c = c.to_uppercase().next().unwrap_or(*c); } l.push(Item { id: format!("c:{}", x.0), n: n.into_iter().collect(), cat: x.2.clone(), dur: x.3, cmu: true, ico: None, mio: false }); } }
        for (k, v) in &self.pjs.emo.remotos { l.push(Item { id: format!("u:{k}"), n: v["nombre"].as_str().unwrap_or(k).to_string(), cat: v["cat"].as_str().unwrap_or("baile").to_string(), dur: 0.0, cmu: false, ico: None, mio: true }); }
        if let Some(i) = l.iter().position(|e| e.id == "c:99_01") { let e = l.remove(i); l.insert(0, e); }
        l
    }
    /// emoUsado: los últimos usados (30)
    fn emo_usado(&mut self, id: &str) { let r = &mut self.pjs.prefs.emo_rec; r.retain(|x| x != id); r.insert(0, id.to_string()); r.truncate(30); self.pjs_guardar(); }
    /// emote(e) con uno nuevo (de captura, del paquete o de la gente): el jugador lo hace (los de captura se bajan la primera
    /// vez: arranca cuando llegó) y lo ven los demás. Devuelve si era de éstos
    pub(crate) fn emo_hacer(&mut self, e: &Option<String>) -> bool {
        let Some(id) = e.as_deref().filter(|x| x.starts_with("c:") || x.starts_with("rb:") || x.starts_with("u:")) else { self.pjs.emo.quiero = None; return false };
        if self.pj.is_none() || self.vehs.jugador.is_some() { return true; }
        match self.emo_clip(id) {
            Some(c) => {
                self.pjs.emo.quiero = None; self.emo_usado(id);
                if let Some(pj) = self.pj.as_mut() { pj.emote_captura(Some(c), false); }
                if self.camara == 0 { self.camara = 1; }
                self.emote = Some(id.to_string());
            }
            None => { if self.pjs.emo.faltan.contains(id.trim_start_matches("c:")) || id.starts_with("c:") { self.pjs.emo.quiero = Some(id.to_string()); self.avisar("Bajando emote…".into()); } }
        }
        true
    }

    // ---------------- cada cuadro ----------------
    pub(crate) fn emo_cuadro(&mut self, m: &mut Motor3d, dt: f32) {
        self.pjs.emo.t += dt;
        // (lo que se bajó)
        let llegaron: Vec<(String, Option<Vec<u8>>)> = self.pjs.emo.bajada.as_ref().map(|(_, rx)| rx.try_iter().collect()).unwrap_or_default();
        for (k, d) in llegaron {
            let id = format!("c:{k}");
            match d { Some(b) => { if let Some((h, n)) = self.pjs.emo.cat.as_ref().and_then(|(h, it)| it.iter().find(|x| x.0 == k).map(|x| (h.clone(), x.1.clone()))) { if let Some(c) = Captura::de_rbe2(&id, &n, &b, &h) { self.pjs.emo.clips.insert(id.clone(), Arc::new(c)); } } }
                None => { if self.pjs.emo.quiero.as_deref() == Some(id.as_str()) { self.pjs.emo.quiero = None; self.avisar("Error de red".into()); } } }
            self.pjs.emo.faltan.remove(&k);
        }
        if let Some(q) = self.pjs.emo.quiero.clone() { if self.pjs.emo.clips.contains_key(&q) { self.hacer_emote(Some(q)); } }
        // (el propio terminó solo: ya no se manda)
        if let Some(e) = self.emote.clone() { if (e.starts_with("c:") || e.starts_with("rb:") || e.starts_with("u:")) && self.pj.as_ref().map(|p| p.captura().is_none()).unwrap_or(true) && self.pjs.emo.quiero.is_none() { self.emote = None; } }
        // (los de los demás que esperaban su clip)
        let pend: Vec<(String, String)> = self.pjs.emo.rem_pend.iter().map(|(a, b)| (a.clone(), b.clone())).collect();
        for (rid, em) in pend {
            if let Some(c) = self.emo_clip(&em) { if let Some((pj, _)) = self.en_red.cuerpos.get_mut(&rid) { let esc = self.pjs.emo.rem_esc.get(&rid).map(|s| s.id == em).unwrap_or(false); pj.emote_captura(Some(c), esc); } self.pjs.emo.rem_pend.remove(&rid); }
            else if let Some(k) = em.strip_prefix("u:") { self.emo_pedir(k, &rid); }
        }
        // la ruleta que se mantiene apretada: se abre a los 0,23 s
        let r = &mut self.pjs.emo.rul; if r.quien.is_some() && !r.abierto && self.pjs.emo.t - r.t0 > 0.23 { r.abierto = true; r.fija = false; r.sel = -1; r.editar = false; }
        self.juntos_paso(dt);
        self.emo_iconos(m);
    }
    /// emoPedir: uno hecho por otro que no tengo: se lo pido (de nuevo a los 20 s)
    fn emo_pedir(&mut self, k: &str, de: &str) {
        if self.pjs.emo.remotos.contains_key(k) || self.pjs.emo.pedidos.get(k).map(|t| *t > self.pjs.emo.t).unwrap_or(false) { return; }
        self.pjs.emo.pedidos.insert(k.to_string(), self.pjs.emo.t + 20.0);
        if self.en_red.en_sala() { self.en_red.red.publicar("a", &json!({ "k": "animq", "a": k, "to": de }).to_string(), false); }
    }
    /// emoRed: un clip de la gente que llega (no tengo los míos para mandar: no hay editor en la nativa)
    pub(crate) fn emo_red(&mut self, _de: &str, d: &Value) {
        if d["k"].as_str() != Some("anim") { return; }
        let Some(a) = d["a"].as_str().filter(|a| a.len() >= 3 && a.len() <= 30 && a.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')) else { return };
        if self.pjs.emo.remotos.contains_key(a) || !d["d"]["clip"].is_object() { return; }
        if Captura::de_json(&format!("u:{a}"), "anim", &d["d"]["clip"]).is_none() { return; }
        self.pjs.emo.remotos.insert(a.to_string(), d["d"].clone()); self.pjs.emo.clips.remove(&format!("u:{a}"));
    }
    pub(crate) fn emo_limpiar(&mut self) { self.pjs.emo.ico = None; self.pjs.emo.ico_rul = None; self.pjs.emo.escena = None; self.pjs.emo.rem_esc.clear(); self.pjs.emo.npc_esc = None; }

    // ---------------- la ruleta (ruleta.js) ----------------
    /// rulSlots: los de cada lugar (los elegidos; si nunca se eligieron, los favoritos, los últimos y el del bote y los clásicos)
    pub(crate) fn rul_slots(&self) -> Vec<Option<String>> {
        let mut l: Vec<Option<String>> = match &self.pjs.prefs.ruleta { Some(r) => r.iter().take(5).cloned().collect(), None => {
            let mut c: Vec<String> = vec![]; let clasicos: Vec<String> = self.paq.as_ref().and_then(|p| p.d["emotes"].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())).unwrap_or_default();
            for id in self.pjs.prefs.emo_fav.iter().chain(self.pjs.prefs.emo_rec.iter()).cloned().chain(std::iter::once("c:99_01".to_string())).chain(clasicos) { if !c.contains(&id) { c.push(id); } }
            c.into_iter().take(5).map(Some).collect() } };
        while l.len() < 5 { l.push(None); } l
    }
    /// el botón de emotes (emoBoton): un toque abre la ruleta quieta
    pub(crate) fn emo_boton(&mut self) { if !self.aj.ruleta { self.emo_abrir_panel(); return; } self.pjs.emo.rul = Rul { abierto: true, fija: true, sel: -1, ..Default::default() }; }
    /// el dedo que apretó el botón de emotes (rulApretar): mantener o deslizar la abre para elegir al soltar
    pub(crate) fn emo_apretar(&mut self, id: i32, x: f32, y: f32) { if !self.aj.ruleta { self.emo_abrir_panel(); return; } let t = self.pjs.emo.t; let r = &mut self.pjs.emo.rul; *r = Rul { quien: Some(id), x0: x, y0: y, t0: t, sel: -1, ..Default::default() }; }
    fn rul_geo(w: f32, h: f32) -> (f32, f32, f32) { let css = h / 393.0; let d = (w.min(h) * 0.8).min(440.0 * css); (w / 2.0, h / 2.0 - if Self::rul_fija_pie() { 24.0 * css } else { 0.0 }, d / 2.0) }
    fn rul_fija_pie() -> bool { true }
    /// el lugar hacia donde va el dedo (rulElegir: en el medio, ninguno)
    fn rul_elegir(&mut self, x: f32, y: f32, h: f32) {
        let r = &mut self.pjs.emo.rul; let (mx, my) = (x - r.x0, y - r.y0); let d = mx.hypot(my); let css = h / 393.0;
        r.sel = if d > 30.0 * css { let mut a = mx.atan2(-my); if a < 0.0 { a += std::f32::consts::TAU; } ((a / (std::f32::consts::TAU / 5.0)).round() as i32) % 5 } else { -1 };
    }
    pub(crate) fn emo_mueve(&mut self, id: i32, x: f32, y: f32, w: f32, h: f32) -> bool {
        if self.pjs.emo.rul.quien == Some(id) {
            let css = h / 393.0; let r = &self.pjs.emo.rul;
            if !r.abierto && (x - r.x0).hypot(y - r.y0) > 30.0 * css { let r = &mut self.pjs.emo.rul; r.abierto = true; r.fija = false; r.editar = false; }
            self.rul_elegir(x, y, h); if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) { d.x = x; d.y = y; } return true;
        }
        if let Some(p) = self.pjs.emo.panel.as_mut() { if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) { p.scroll = (p.scroll - (y - d.y)).max(0.0); d.x = x; d.y = y; } let _ = w; return true; }
        false
    }
    /// rulSoltar: un toque corto la deja quieta; soltando en un lugar, ese emote; en el medio, queda abierta
    pub(crate) fn emo_soltar(&mut self, id: i32) {
        if self.pjs.emo.rul.quien != Some(id) { return; }
        let r = self.pjs.emo.rul.clone(); self.pjs.emo.rul.quien = None;
        if !r.abierto { self.emo_boton(); return; }
        if r.fija { return; }
        if r.sel < 0 { self.pjs.emo.rul.fija = true; return; }
        let slot = self.rul_slots()[r.sel as usize].clone(); self.pjs.emo.rul = Rul::default();
        match slot { Some(e) => self.rul_hacer(&e), None => self.rul_elegir_para(r.sel as usize) }
    }
    fn rul_hacer(&mut self, e: &str) { if let Some(j) = e.strip_prefix("jnt:") { self.juntos_pedir(j); return; } self.hacer_emote(Some(e.to_string())); }
    /// rulElegirPara: elegir qué va en un lugar (el panel; al tocar uno vuelve a la ruleta)
    fn rul_elegir_para(&mut self, i: usize) { self.pjs.emo.rul = Rul { asignar: Some(i), ..Default::default() }; self.emo_abrir_panel(); }
    pub(crate) fn emo_abrir_panel(&mut self) { self.emo_catalogo(); let asignar = self.pjs.emo.rul.asignar; self.pjs.emo.rul = Rul { asignar, ..Default::default() }; self.pjs.emo.panel = Some(PanelEmo::default()); self.emotes_panel = false; self.pjs.emo.ico = None; }
    fn rul_toque(&mut self, x: f32, y: f32, w: f32, h: f32) {
        let (cx, cy, rr) = Self::rul_geo(w, h); let css = h / 393.0; let lado = rr * 2.0 * 0.25;
        let slots = self.rul_slots();
        // (la X para vaciar un lugar, editando)
        for k in 0..5 { let a = k as f32 / 5.0 * std::f32::consts::TAU; let (lx, ly) = (cx + rr * 0.74 * a.sin(), cy - rr * 0.74 * a.cos());
            if self.pjs.emo.rul.editar && slots[k].is_some() && (x - (lx + lado / 2.0)).hypot(y - (ly - lado / 2.0)) < 14.0 * css { let mut l = slots.clone(); l[k] = None; self.pjs.prefs.ruleta = Some(l); self.pjs_guardar(); return; }
            if (x - lx).abs() <= lado / 2.0 && (y - ly).abs() <= lado / 2.0 {
                if self.pjs.emo.rul.editar { self.rul_elegir_para(k); return; }
                match &slots[k] { Some(e) => { let e = e.clone(); self.pjs.emo.rul = Rul::default(); self.rul_hacer(&e); } None => self.rul_elegir_para(k) } return;
            } }
        // (el centro: Editar emotes / Listo)
        let (bw, bh) = (rr * 0.8, 26.0 * css); if (x - cx).abs() < bw / 2.0 && y > cy + 10.0 * css && y < cy + 10.0 * css + bh { self.pjs.emo.rul.editar = !self.pjs.emo.rul.editar; return; }
        // (el pie: Todos los emotes, Cerrar)
        let yp = cy + rr + 14.0 * css; let pw = 150.0 * css;
        if y > yp && y < yp + 34.0 * css { if x > cx - pw - 5.0 * css && x < cx - 5.0 * css { self.pjs.emo.rul = Rul::default(); self.emo_abrir_panel(); return; } if x > cx + 5.0 * css && x < cx + pw + 5.0 * css { self.pjs.emo.rul = Rul::default(); return; } }
        if (x - cx).hypot(y - cy) > rr { self.pjs.emo.rul = Rul::default(); }
    }
    /// rulAsignar: el emote elegido en el panel va al lugar que se estaba eligiendo
    fn rul_asignar(&mut self, id: &str, i: usize) {
        let mut l = self.rul_slots(); l[i] = Some(id.to_string()); self.pjs.prefs.ruleta = Some(l); self.pjs_guardar();
        self.pjs.emo.panel = None; self.pjs.emo.rul = Rul { abierto: true, fija: true, editar: true, sel: -1, ..Default::default() };
    }

    // ---------------- el panel de emotes ----------------
    fn geo_emo(w: f32, h: f32) -> ([f32; 4], f32) { let css = h / 393.0; let pw = (w * 0.9).min(720.0 * css); let ph = h * 0.92; ([(w - pw) / 2.0, (h - ph) / 2.0, pw, ph], css) }
    /// las tarjetas: (qué emote, dónde)
    fn emo_cartas(&self, w: f32, h: f32) -> (Vec<(String, [f32; 4])>, usize, f32) {
        let Some(p) = self.pjs.emo.panel.clone() else { return (vec![], 0, 0.0) }; let (c, css) = Self::geo_emo(w, h);
        let lista = self.emo_lista_panel(&p); let n = lista.len();
        let x0 = c[0] + 10.0 * css; let y0 = c[1] + 108.0 * css; let an = c[2] - 20.0 * css; let alto = c[3] - 118.0 * css;
        let cols = ((an / (86.0 * css)).floor() as usize).max(3); let cw = an / cols as f32; let ch = cw + 30.0 * css;
        let mut v = vec![];
        for (k, e) in lista.into_iter().enumerate() { let r = [x0 + (k % cols) as f32 * cw + 3.0 * css, y0 + (k / cols) as f32 * ch - p.scroll + 3.0 * css, cw - 6.0 * css, ch - 6.0 * css];
            if r[1] + r[3] < y0 || r[1] > y0 + alto { continue; } v.push((e, r)); }
        (v, n, y0)
    }
    /// lo que muestra la sección elegida (con el buscador)
    fn emo_lista_panel(&self, p: &PanelEmo) -> Vec<String> {
        let cat = CATS[p.cat.min(CATS.len() - 1)].0;
        if cat == "juntos" { return JUNTOS.iter().map(|j| format!("jnt:{}", j.id)).collect(); }
        let todos = self.emo_items(); let por: HashMap<&str, &Item> = todos.iter().map(|e| (e.id.as_str(), e)).collect();
        let l: Vec<&Item> = match cat { "fav" => self.pjs.prefs.emo_fav.iter().filter_map(|id| por.get(id.as_str()).copied()).collect(), "rec" => self.pjs.prefs.emo_rec.iter().filter_map(|id| por.get(id.as_str()).copied()).collect(),
            _ => todos.iter().filter(|e| cat == "todos" || (if cat == "mio" { e.mio } else { e.cat == cat && !(e.mio && cat == "clasico") })).collect() };
        let q = p.q.to_lowercase(); l.into_iter().filter(|e| q.is_empty() || e.n.to_lowercase().contains(&q) || e.id.to_lowercase().contains(&q)).map(|e| e.id.clone()).collect()
    }
    pub(crate) fn emo_toque(&mut self, x: f32, y: f32, w: f32, h: f32) {
        if self.pjs.emo.jnt_pedido.is_some() && self.jnt_cartel_toque(x, y, w, h) { return; }
        if self.pjs.emo.rul.abierto && self.pjs.emo.rul.fija { self.rul_toque(x, y, w, h); return; }
        let Some(p) = self.pjs.emo.panel.clone() else { return }; let (c, css) = Self::geo_emo(w, h);
        if !dentro(x, y, c) || (x > c[0] + c[2] - 44.0 * css && y < c[1] + 40.0 * css) { self.pjs.emo.panel = None; self.pjs.emo.rul.asignar = None; return; }
        // las secciones (dos filas de botones chicos) y el buscador
        if y < c[1] + 104.0 * css {
            for (k, r) in Self::tabs_emo(c, css).into_iter().enumerate() { if dentro(x, y, r) { if let Some(pp) = self.pjs.emo.panel.as_mut() { pp.cat = k; pp.scroll = 0.0; } self.pjs.emo.ico = None; self.sonido.tocar("Click", 0.5, 1.0, None); return; } }
            if y > c[1] + 78.0 * css { self.pedir_texto(Escribir::Pj, "Buscar emote", &p.q, 40, false); self.pjs.celu.escribe = Some(celu_juego::Escribe::BuscarEmo); }
            return;
        }
        let (cartas, _, _) = self.emo_cartas(w, h);
        for (id, r) in cartas {
            if !dentro(x, y, r) { continue; }
            // (la estrella de favorito, arriba a la derecha de la tarjeta)
            if !id.starts_with("jnt:") && x > r[0] + r[2] - 22.0 * css && y < r[1] + 22.0 * css { let f = &mut self.pjs.prefs.emo_fav; if let Some(i) = f.iter().position(|x| *x == id) { f.remove(i); } else { f.push(id.clone()); } self.pjs_guardar(); return; }
            self.sonido.tocar("Click", 0.5, 1.0, None);
            if let Some(i) = self.pjs.emo.rul.asignar.filter(|_| !id.starts_with("jnt:")) { self.rul_asignar(&id, i); return; }
            self.pjs.emo.panel = None;
            if let Some(j) = id.strip_prefix("jnt:") { self.juntos_pedir(j); } else { self.hacer_emote(Some(id)); }
            return;
        }
    }
    fn tabs_emo(c: [f32; 4], css: f32) -> Vec<[f32; 4]> {
        let mut v = vec![]; let (mut x, mut y) = (c[0] + 10.0 * css, c[1] + 40.0 * css); let fin = c[0] + c[2] - 10.0 * css;
        for (_, n) in CATS.iter() { let w = (n.chars().count() as f32 * 6.4 + 18.0) * css; if x + w > fin { x = c[0] + 10.0 * css; y += 22.0 * css; } v.push([x, y, w, 19.0 * css]); x += w + 4.0 * css; }
        v
    }
    /// el atlas de los íconos de los emotes de la página (los del paquete: DATA.ico emo_X)
    fn emo_iconos(&mut self, m: &mut Motor3d) {
        let quiero: Vec<String> = if self.pjs.emo.panel.is_some() { let (w, h) = self.pjs.celu.pantalla; self.emo_cartas(w, h).0.into_iter().map(|x| x.0).collect() } else { vec![] };
        let rul: Vec<String> = if self.pjs.emo.rul.abierto { self.rul_slots().into_iter().flatten().collect() } else { vec![] };
        let todos: Vec<String> = quiero.into_iter().chain(rul).collect();
        if todos.is_empty() || self.pjs.emo.ico.as_ref().map(|v| todos.iter().all(|x| v.contains(x))).unwrap_or(false) { return; }
        let Some(paq) = self.paq.as_ref() else { return };
        let lista: Vec<String> = todos.into_iter().take(40).collect();
        let (aw, ah) = (ICO_COLS * ICO, ((lista.len() as u32).div_ceil(ICO_COLS).max(1) * ICO).next_power_of_two()); let mut px = vec![0u8; (aw * ah * 4) as usize];
        for (k, id) in lista.iter().enumerate() {
            let n = if let Some(r) = id.strip_prefix("rb:") { format!("emo_{r}") } else { format!("emo_{id}") };
            if let Some((w, h, p)) = icono_crudo(paq, &n) { atlas_celda(&mut px, aw, k as u32, &encuadrar(w, h, &p, ICO as usize), ICO); }
        }
        if subir_tex(m, TEX_EMO, aw, ah, px) { self.pjs.emo.ico = Some(lista); }
    }
    /// dibuja la tarjeta de un emote: el ícono (o el color de su sección con el muñequito) y el nombre
    fn emo_tarjeta(&self, l: &Letras, u: &mut Vec<f32>, ico: &mut Vec<f32>, icv: &mut Vec<f32>, id: &str, r: [f32; 4], css: f32, todos: &HashMap<String, Item>) {
        l.caja(u, r[0], r[1], r[2], r[3], 8.0 * css, [38.0 / 255.0, 40.0 / 255.0, 46.0 / 255.0, 1.0]);
        let f = [r[0] + 4.0 * css, r[1] + 4.0 * css, r[2] - 8.0 * css, r[2] - 8.0 * css];
        let (n, cat, sub) = if let Some(j) = id.strip_prefix("jnt:") { (junto(j).map(|x| x.n).unwrap_or(j).to_string(), "gesto".to_string(), String::new()) }
            else { match todos.get(id) { Some(e) => (e.n.clone(), e.cat.clone(), if e.cmu { format!("{} · {} s", CATS.iter().find(|c| c.0 == e.cat).map(|c| c.1).unwrap_or("Otros"), e.dur.round().max(1.0)) } else { String::new() }), None => (id.to_string(), "otro".into(), String::new()) } };
        let k = self.pjs.emo.ico.as_ref().and_then(|v| v.iter().position(|x| x == id));
        let tiene_ico = self.paq.as_ref().map(|p| { let nn = if let Some(rb) = id.strip_prefix("rb:") { format!("emo_{rb}") } else { format!("emo_{id}") }; p.d["ico"][nn.as_str()].is_string() }).unwrap_or(false);
        if let (Some(k), true) = (k, tiene_ico) { l.caja(u, f[0], f[1], f[2], f[3], 6.0 * css, [241.0 / 255.0, 236.0 / 255.0, 224.0 / 255.0, 1.0]); rect_uv(ico, f[0], f[1], f[2], f[3], uv_celda(k as u32, ICO, (ICO_COLS * ICO) as f32, self.atlas_alto(self.pjs.emo.ico.as_ref().map(|v| v.len()).unwrap_or(1))), [1.0; 4]); }
        else {
            let (a, b) = color_cat(&cat); for s in 0..8 { let t = s as f32 / 7.0; let c = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1.0]; l.rect(u, f[0], f[1] + f[3] * s as f32 / 8.0, f[2], f[3] / 8.0 + 0.5, c); }
            rect_uv(icv, f[0] + f[2] * 0.2, f[1] + f[3] * 0.2, f[2] * 0.6, f[3] * 0.6, uv_celda(ico_idx("emotes"), ICO, (ICO_COLS * ICO) as f32, self.atlas_alto(ICONOS.len())), [1.0; 4]);
        }
        let tf = 10.5 * css; texto_cabe(l, u, r[0] + 3.0 * css, r[1] + r[2] - 2.0 * css, tf, r[2] - 6.0 * css, [0.93, 0.93, 0.93, 1.0], &n, true);
        if !sub.is_empty() { texto_cabe(l, u, r[0] + 3.0 * css, r[1] + r[2] + tf * 1.1, tf * 0.9, r[2] - 6.0 * css, [0.6, 0.6, 0.67, 1.0], &sub, true); }
        if !id.starts_with("jnt:") { let fav = self.pjs.prefs.emo_fav.iter().any(|x| x == id); estrella(l, u, r[0] + r[2] - 11.0 * css, r[1] + 11.0 * css, 7.0 * css, if fav { [1.0, 0.83, 0.29, 1.0] } else { [1.0, 1.0, 1.0, 0.35] }); }
    }
    pub(crate) fn emo_hud(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32, _t: f32, otras: &mut Vec<(i64, Vec<f32>)>) {
        let css = hf / 393.0; let bl = [1.0; 4]; let tf = 13.0 * css; let mut ico = vec![]; let mut icv = vec![];
        let todos: HashMap<String, Item> = self.emo_items().into_iter().map(|e| (e.id.clone(), e)).collect();
        if let Some(p) = &self.pjs.emo.panel {
            let (c, _) = Self::geo_emo(wf, hf);
            l.rect(u, 0.0, 0.0, wf, hf, [0.0, 0.0, 0.0, 0.35]);
            l.caja(u, c[0], c[1], c[2], c[3], 2.0, [0.09, 0.1, 0.12, 0.97]);
            l.rect(u, c[0] + 10.0 * css, c[1] + 10.0 * css, 6.0 * css, 22.0 * css, [0.949, 0.702, 0.106, 1.0]);
            let tit = match self.pjs.emo.rul.asignar { Some(i) => format!("Elegí el emote para el lugar {} de la ruleta", i + 1), None => "EMOTES".into() };
            l.texto(u, c[0] + 24.0 * css, c[1] + 10.0 * css, 20.0 * css, bl, &tit);
            cruz_x(l, u, c[0] + c[2] - 22.0 * css, c[1] + 21.0 * css, 7.0 * css, 2.2 * css, bl);
            for (k, r) in Self::tabs_emo(c, css).into_iter().enumerate() { let s = k == p.cat; l.caja(u, r[0], r[1], r[2], r[3], r[3] / 2.0, if s { [0.243, 0.435, 0.847, 1.0] } else { [0.169, 0.176, 0.2, 1.0] }); texto_cabe(l, u, r[0], r[1] + (r[3] - 11.0 * css) / 2.0 - 1.0, 11.0 * css, r[2], if s { bl } else { [0.87, 0.87, 0.87, 1.0] }, CATS[k].1, true); }
            // (el buscador y cuántos hay)
            let yb = c[1] + 80.0 * css; l.caja(u, c[0] + 10.0 * css, yb, c[2] - 20.0 * css, 22.0 * css, 11.0 * css, [0.114, 0.122, 0.141, 1.0]);
            let n = self.emo_lista_panel(p).len();
            l.texto(u, c[0] + 22.0 * css, yb + 4.0 * css, tf, if p.q.is_empty() { [1.0, 1.0, 1.0, 0.45] } else { bl }, if p.q.is_empty() { "Buscar" } else { &p.q });
            let cu = format!("{n} emotes"); let an = l.ancho(tf * 0.9, &cu); l.texto(u, c[0] + c[2] - 22.0 * css - an, yb + 5.0 * css, tf * 0.9, [0.6, 0.6, 0.67, 1.0], &cu);
            if CATS[p.cat].0 == "juntos" { for (i, rr) in jugabilidad::partir(l, tf * 0.85, "Ponete frente a alguien (un jugador o un NPC, a menos de 3 m) y elegí uno: se lo pedís y, si acepta, lo hacen juntos.", c[2] - 30.0 * css).iter().enumerate() { l.texto(u, c[0] + 14.0 * css, c[3] + c[1] - 30.0 * css + i as f32 * tf, tf * 0.85, [1.0, 1.0, 1.0, 0.7], rr); } }
            let (cartas, _, _) = self.emo_cartas(wf, hf);
            if cartas.is_empty() { let v = match CATS[p.cat].0 { "fav" => "Tocá la estrella de un emote para guardarlo acá.", "mio" => "Todavía no tenés: llegan los que hace la gente en la sala.", _ => "Sin resultados" }; l.texto(u, c[0] + 16.0 * css, c[1] + 116.0 * css, tf, [1.0, 1.0, 1.0, 0.7], v); }
            for (id, r) in cartas { self.emo_tarjeta(l, u, &mut ico, &mut icv, &id, r, css, &todos); }
        }
        // la ruleta
        let r = &self.pjs.emo.rul;
        if r.abierto {
            let (cx, cy, rr) = Self::rul_geo(wf, hf); let slots = self.rul_slots();
            if r.fija { l.rect(u, 0.0, 0.0, wf, hf, [0.0, 0.0, 0.0, 0.35]); }
            l.disco(u, cx, cy, rr + 2.0 * css, [1.0, 1.0, 1.0, 0.2]); l.disco(u, cx, cy, rr, [18.0 / 255.0, 20.0 / 255.0, 28.0 / 255.0, 0.8]); l.disco(u, cx, cy, rr * 0.58, [18.0 / 255.0, 20.0 / 255.0, 28.0 / 255.0, 0.55]);
            let lado = rr * 2.0 * 0.25;
            for (k, s) in slots.iter().enumerate() {
                let a = k as f32 / 5.0 * std::f32::consts::TAU; let (lx, ly) = (cx + rr * 0.74 * a.sin(), cy - rr * 0.74 * a.cos());
                let sel = r.sel == k as i32; let lw = if sel { lado * 1.12 } else { lado };
                l.caja(u, lx - lw / 2.0 - 3.0 * css, ly - lw / 2.0 - 3.0 * css, lw + 6.0 * css, lw + 6.0 * css, 16.0 * css, if sel { [1.0, 0.835, 0.29, 1.0] } else { [1.0, 1.0, 1.0, 0.08] });
                l.caja(u, lx - lw / 2.0, ly - lw / 2.0, lw, lw, 14.0 * css, if sel { [0.2, 0.212, 0.247, 1.0] } else { [0.149, 0.157, 0.18, 1.0] });
                match s {
                    Some(id) => { let rc = [lx - lw * 0.35, ly - lw * 0.42, lw * 0.7, lw * 0.7 + 18.0 * css]; self.emo_tarjeta_rul(l, u, &mut ico, &mut icv, id, rc, css, &todos); }
                    None => { l.texto(u, lx - 7.0 * css, ly - 18.0 * css, 28.0 * css, [1.0, 1.0, 1.0, 0.6], "+"); texto_cabe(l, u, lx - lw / 2.0, ly + lw * 0.28, 11.0 * css, lw, [1.0, 1.0, 1.0, 0.7], "Vacío", true); }
                }
                if r.editar && s.is_some() { l.disco(u, lx + lw / 2.0, ly - lw / 2.0, 12.0 * css, [0.753, 0.224, 0.169, 1.0]); cruz_x(l, u, lx + lw / 2.0, ly - lw / 2.0, 4.5 * css, 2.0 * css, bl); }
            }
            let nom = if r.sel >= 0 { slots[r.sel as usize].as_ref().map(|id| self.emo_nombre(id, &todos)).unwrap_or_else(|| "Vacío".into()) } else if r.editar { "Tocá un lugar para elegir su emote".into() } else if r.fija { "Tocá un emote".into() } else { "Deslizá hacia un emote y soltá".into() };
            for (i, rr2) in jugabilidad::partir(l, 14.0 * css, &nom, rr * 0.8).iter().take(3).enumerate() { let an = l.ancho(14.0 * css, rr2); l.texto_sombra(u, cx - an / 2.0, cy - 22.0 * css + i as f32 * 17.0 * css, 14.0 * css, bl, rr2); }
            if r.fija {
                let (bw, bh) = (rr * 0.8, 26.0 * css); l.caja(u, cx - bw / 2.0, cy + 10.0 * css, bw, bh, 6.0 * css, [0.243, 0.435, 0.847, 1.0]); texto_cabe(l, u, cx - bw / 2.0, cy + 10.0 * css + (bh - 12.0 * css) / 2.0 - 1.0, 12.0 * css, bw, bl, if r.editar { "Listo" } else { "Editar emotes" }, true);
                let yp = cy + rr + 14.0 * css; let pw = 150.0 * css;
                for (x, t) in [(cx - pw - 5.0 * css, "Todos los emotes"), (cx + 5.0 * css, "Cerrar")] { l.caja(u, x, yp, pw, 34.0 * css, 8.0 * css, [0.333, 0.361, 0.412, 1.0]); texto_cabe(l, u, x, yp + (34.0 * css - tf) / 2.0 - 1.0, tf, pw, bl, t, true); }
            }
        }
        // el cartel de juntos (juntosCartel): «Ana quiere chocar los cinco» [Aceptar (E)] [No]
        if let Some((de, e, _)) = &self.pjs.emo.jnt_pedido {
            let quien = self.en_red.red.remotos().iter().find(|r| &r.id == de).map(|r| r.nombre.clone()).unwrap_or("?".into());
            let txt = format!("{quien} quiere: {}", junto(e).map(|j| j.n).unwrap_or(e)); let (c, si, no) = Self::geo_cartel(l, wf, hf, &txt);
            l.caja(u, c[0], c[1], c[2], c[3], 12.0 * css, [20.0 / 255.0, 24.0 / 255.0, 32.0 / 255.0, 0.94]); l.texto(u, c[0] + 14.0 * css, c[1] + (c[3] - tf) / 2.0 - 1.0, tf, bl, &txt);
            l.caja(u, si[0], si[1], si[2], si[3], 8.0 * css, [0.243, 0.435, 0.847, 1.0]); texto_cabe(l, u, si[0], si[1] + (si[3] - tf) / 2.0 - 1.0, tf, si[2], bl, "Aceptar (E)", true);
            l.caja(u, no[0], no[1], no[2], no[3], 8.0 * css, [0.333, 0.361, 0.412, 1.0]); texto_cabe(l, u, no[0], no[1] + (no[3] - tf) / 2.0 - 1.0, tf, no[2], bl, "No", true);
        }
        otras.push((TEX_EMO, ico)); otras.push((TEX_ICO, icv));
    }
    fn emo_tarjeta_rul(&self, l: &Letras, u: &mut Vec<f32>, ico: &mut Vec<f32>, icv: &mut Vec<f32>, id: &str, r: [f32; 4], css: f32, todos: &HashMap<String, Item>) {
        let k = self.pjs.emo.ico.as_ref().and_then(|v| v.iter().position(|x| x == id)); let f = [r[0], r[1], r[2], r[2]];
        let tiene = self.paq.as_ref().map(|p| { let nn = if let Some(rb) = id.strip_prefix("rb:") { format!("emo_{rb}") } else { format!("emo_{id}") }; p.d["ico"][nn.as_str()].is_string() }).unwrap_or(false);
        if let (Some(k), true) = (k, tiene) { l.caja(u, f[0], f[1], f[2], f[3], 10.0 * css, [241.0 / 255.0, 236.0 / 255.0, 224.0 / 255.0, 1.0]); rect_uv(ico, f[0], f[1], f[2], f[3], uv_celda(k as u32, ICO, (ICO_COLS * ICO) as f32, self.atlas_alto(self.pjs.emo.ico.as_ref().map(|v| v.len()).unwrap_or(1))), [1.0; 4]); }
        else { let cat = todos.get(id).map(|e| e.cat.clone()).unwrap_or("otro".into()); let (a, b) = color_cat(&cat); for s in 0..8 { let t = s as f32 / 7.0; l.rect(u, f[0], f[1] + f[3] * s as f32 / 8.0, f[2], f[3] / 8.0 + 0.5, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1.0]); }
            rect_uv(icv, f[0] + f[2] * 0.2, f[1] + f[3] * 0.2, f[2] * 0.6, f[3] * 0.6, uv_celda(ico_idx("emotes"), ICO, (ICO_COLS * ICO) as f32, self.atlas_alto(ICONOS.len())), [1.0; 4]); }
        texto_cabe(l, u, r[0] - r[2] * 0.15, r[1] + r[2] + 2.0 * css, 11.0 * css, r[2] * 1.3, [1.0; 4], &self.emo_nombre(id, todos), true);
    }
    fn emo_nombre(&self, id: &str, todos: &HashMap<String, Item>) -> String { if let Some(j) = id.strip_prefix("jnt:") { return junto(j).map(|x| x.n.to_string()).unwrap_or_default(); } todos.get(id).map(|e| e.n.clone()).unwrap_or_else(|| id.to_string()) }

    // ---------------- juntos (juntos.js) ----------------
    fn geo_cartel(l: &Letras, w: f32, h: f32, txt: &str) -> ([f32; 4], [f32; 4], [f32; 4]) {
        let css = h / 393.0; let tf = 13.0 * css; let an = l.ancho(tf, txt) + 28.0 * css + 220.0 * css; let an = an.min(w - 24.0 * css); let (x0, y0) = ((w - an) / 2.0, h - h * 0.22 - 44.0 * css);
        ([x0, y0, an, 44.0 * css], [x0 + an - 214.0 * css, y0 + 6.0 * css, 120.0 * css, 32.0 * css], [x0 + an - 88.0 * css, y0 + 6.0 * css, 80.0 * css, 32.0 * css])
    }
    fn jnt_cartel_toque(&mut self, x: f32, y: f32, w: f32, h: f32) -> bool {
        let Some(l) = self.letras.as_ref() else { return false }; let Some((de, e, _)) = self.pjs.emo.jnt_pedido.clone() else { return false };
        let quien = self.en_red.red.remotos().iter().find(|r| r.id == de).map(|r| r.nombre.clone()).unwrap_or("?".into());
        let (_, si, no) = Self::geo_cartel(l, w, h, &format!("{quien} quiere: {}", junto(&e).map(|j| j.n).unwrap_or(&e)));
        if dentro(x, y, si) { self.juntos_aceptar(); return true; } if dentro(x, y, no) { self.pjs.emo.jnt_pedido = None; return true; }
        false
    }
    /// juntosObjetivo: el de adelante más cerca (un jugador o un NPC) hasta 3 m: (quién —npc:N o el número del jugador— y dónde)
    fn juntos_objetivo(&self) -> Option<(String, [f32; 3])> {
        let f = [self.jug.yaw.sin(), 0.0, self.jug.yaw.cos()]; let jp = self.jug.pos; let mut mejor = None; let mut dm = 3.0f32;
        let mut ver = |id: String, p: [f32; 3]| { let d = [p[0] - jp[0], 0.0, p[2] - jp[2]]; let l = d[0].hypot(d[2]); if l < dm && (l < 1.0 || (d[0] * f[0] + d[2] * f[2]) / l > 0.3) { dm = l; mejor = Some((id, p)); } };
        for r in self.en_red.red.remotos() { if r.visible && r.vivo && !r.rag && !self.pjs.emo.rem_esc.contains_key(&r.id) { ver(r.id.clone(), [r.pos[0] as f32, r.pos[1] as f32, r.pos[2] as f32]); } }
        for n in &self.npcs.lista { if n.vivo && n.rag.is_none() { ver(format!("npc:{}", n.id), n.pos()); } }
        mejor
    }
    /// juntosPedir: se lo pide al de adelante (un NPC acepta solo)
    pub fn juntos_pedir(&mut self, id: &str) {
        let Some(jj) = junto(id) else { return }; if self.pj.is_none() || self.vehs.jugador.is_some() { return; }
        let Some((o, _)) = self.juntos_objetivo() else { self.avisar("No hay nadie adelante (a menos de 3 m)".into()); return };
        let (ca, cb) = (self.emo_clip(&format!("c:{}", jj.a)), self.emo_clip(&format!("c:{}", jj.b)));
        if ca.is_none() || cb.is_none() { self.avisar("Bajando emote…".into()); return; }
        if let Some(n) = o.strip_prefix("npc:") { if let Ok(n) = n.parse::<u32>() { self.juntos_empezar(jj, None, Some(n)); } return; }
        self.pjs.emo.jnt_mio = Some((id.to_string(), o.clone(), self.pjs.emo.t));
        self.en_red.red.publicar("a", &json!({ "k": "jntP", "to": o, "e": id }).to_string(), false); self.avisar("Esperando que acepte…".into());
    }
    /// juntosAceptar (el cartel o E)
    pub fn juntos_aceptar(&mut self) -> bool {
        let Some((de, e, _)) = self.pjs.emo.jnt_pedido.take() else { return false }; let Some(jj) = junto(&e) else { return true };
        let _ = (self.emo_clip(&format!("c:{}", jj.a)), self.emo_clip(&format!("c:{}", jj.b)));
        self.en_red.red.publicar("a", &json!({ "k": "jntS", "to": de, "e": e }).to_string(), false); true
    }
    /// la pose de un personaje en un cuadro de la captura (juntosPose): los huesos pedidos, con la cadera entera, en el origen
    fn juntos_pose(pj: &Personaje, c: &Arc<Captura>, f: f32, huesos: &[&str]) -> HashMap<String, [f32; 3]> { pj.pose_captura(c, f, huesos) }
    /// juntosAjuste: cuánto correr a B para que en el momento del contacto se toquen de verdad
    fn juntos_ajuste(jj: &Junto, pa: &Personaje, pb: &Personaje, ca: &Arc<Captura>, cb: &Arc<Captura>) -> [f32; 2] {
        let mut hs: Vec<&str> = jj.c.iter().flat_map(|x| [x.0, x.1]).collect(); hs.push("Hips"); hs.sort(); hs.dedup();
        let n = ca.nf.min(cb.nf); let paso = ((n as f32 / 60.0).round() as usize).max(1);
        let mut fa: i64 = -1;
        if jj.alcance { let mut m = -1.0f32; let mut f = 0; while f < n { let p = Self::juntos_pose(pa, ca, f as f32, &hs); let mut s = 0.0; for c in jj.c { if let (Some(x), Some(hp)) = (p.get(c.0), p.get("Hips")) { s += (x[0] - hp[0]).hypot(x[2] - hp[2]); } } if s > m { m = s; fa = f as i64; } f += paso; } }
        let mut mejor: Option<(f32, f32, f32)> = None; let mut f = 0;
        while f < n {
            if fa >= 0 && f as i64 != fa { f += paso; continue; }
            let (pa_, pb_) = (Self::juntos_pose(pa, ca, f as f32, &hs), Self::juntos_pose(pb, cb, f as f32, &hs));
            let dd = |x: &[f32; 3], y: &[f32; 3]| ((x[0] - y[0]).powi(2) + (x[1] - y[1]).powi(2) + (x[2] - y[2]).powi(2)).sqrt();
            let pares: Vec<(&str, &str)> = if jj.todos { jj.c.to_vec() } else {
                let mut m: Option<(&str, &str)> = None; for c in jj.c { if let (Some(x), Some(y)) = (pa_.get(c.0), pb_.get(c.1)) { if m.map(|mm| dd(x, y) < dd(&pa_[mm.0], &pb_[mm.1])).unwrap_or(true) { m = Some(*c); } } } m.into_iter().collect() };
            let (mut d, mut dx, mut dz, mut k) = (0.0, 0.0, 0.0, 0.0);
            for (x, y) in pares { let (Some(a), Some(b)) = (pa_.get(x), pb_.get(y)) else { continue }; d += dd(a, b); dx += a[0] - b[0]; dz += a[2] - b[2]; k += 1.0; }
            if k > 0.0 && mejor.map(|m| d / k < m.0).unwrap_or(true) { mejor = Some((d / k, dx / k, dz / k)); }
            f += paso;
        }
        mejor.map(|m| [m.1, m.2]).unwrap_or([0.0, 0.0])
    }
    /// juntosEmpezar: el que lo pidió arma la escena (él no se mueve; el otro va a su lugar de la captura) y la manda
    fn juntos_empezar(&mut self, jj: &Junto, id_b: Option<String>, npc: Option<u32>) {
        let (Some(ca), Some(cb)) = (self.emo_clip(&format!("c:{}", jj.a)), self.emo_clip(&format!("c:{}", jj.b))) else { return };
        let Some(pa) = self.pj.as_ref() else { return };
        let (pb, posb): (Personaje, [f32; 3]) = match (&id_b, npc) {
            (Some(r), _) => { let Some((p, _)) = self.en_red.cuerpos.get(r) else { return }; let Some(rr) = self.en_red.red.remotos().iter().find(|x| &x.id == r) else { return }; (p.clone(), [rr.pos[0] as f32, rr.pos[1] as f32, rr.pos[2] as f32]) }
            (None, Some(n)) => { let Some(x) = self.npcs.get(n) else { return }; (x.pj.clone(), x.pos()) }
            _ => return,
        };
        let b0 = pa.reposo_cadera(); let aj = Self::juntos_ajuste(jj, pa, &pb, &ca, &cb);
        let (ha0, hb0) = (ca.h.as_ref().map(|h| [h[0] as f32, h[2] as f32]).unwrap_or([0.0; 2]), cb.h.as_ref().map(|h| [h[0] as f32, h[2] as f32]).unwrap_or([0.0; 2]));
        let ha = [ha0[0] / 1000.0 + b0[0], ha0[1] / 1000.0 + b0[2]]; let hb = [hb0[0] / 1000.0 + b0[0] + aj[0], hb0[1] / 1000.0 + b0[2] + aj[1]];
        let jp = self.jug.pos; let dc = (hb[0] - ha[0]).atan2(hb[1] - ha[1]); let dw = (posb[0] - jp[0]).atan2(posb[2] - jp[2]); let th = dw - dc;
        let (c, s) = (th.cos(), th.sin()); let rot = |x: f32, z: f32| [x * c + z * s, -x * s + z * c]; let ra = rot(ha[0], ha[1]);
        let o = [jp[0] - ra[0], (jp[1] + posb[1]) / 2.0, jp[2] - ra[1]]; let rb = rot(aj[0], aj[1]);
        let r3 = |x: f32| (x * 1000.0).round() / 1000.0;
        let esc = json!({ "e": jj.id, "O": [r3(o[0]), r3(o[1]), r3(o[2])], "ob": [r3(o[0] + rb[0]), r3(o[1]), r3(o[2] + rb[1])], "th": (th * 1000.0).round() / 1000.0 });
        let mi = self.en_red.red.id.clone();
        self.juntos_aplicar(&esc, "a", &mi);
        match (&id_b, npc) { (Some(r), _) => { let r = r.clone(); self.juntos_aplicar(&esc, "b", &r); } (None, Some(n)) => self.juntos_aplicar(&esc, "b", &format!("npc:{n}")), _ => {} }
        if let Some(b) = &id_b { if self.en_red.en_sala() { let mut m = esc.clone(); m["k"] = json!("jnt"); m["a"] = json!(mi); m["b"] = json!(b); self.en_red.red.publicar("a", &m.to_string(), false); } }
    }
    /// juntosAplicar: la escena a un cuerpo (yo, otro jugador o un NPC) con su rol
    fn juntos_aplicar(&mut self, esc: &Value, rol: &str, quien: &str) {
        let Some(jj) = junto(esc["e"].as_str().unwrap_or("")) else { return };
        let id = format!("c:{}", if rol == "a" { jj.a } else { jj.b }); let Some(c) = self.emo_clip(&id) else { return };
        let n = |v: &Value| v.as_f64().unwrap_or(0.0).clamp(-1e4, 1e4) as f32; let o3 = |v: &Value| [n(&v[0]), n(&v[1]), n(&v[2])];
        let e = EscenaJ { e: jj.id.to_string(), o: o3(&esc["O"]), ob: if esc["ob"].is_array() { o3(&esc["ob"]) } else { o3(&esc["O"]) }, th: esc["th"].as_f64().unwrap_or(0.0).clamp(-20.0, 20.0) as f32, id: id.clone(), rol_b: rol == "b" };
        if quien == self.en_red.red.id {
            if let Some(pj) = self.pj.as_mut() { pj.emote_captura(Some(c), true); }
            self.jug.vel = [0.0; 3]; self.emote = Some(id.clone()); self.emo_usado(&id); if self.camara == 0 { self.camara = 1; } self.pjs.emo.escena = Some(e);
        } else if let Some(nn) = quien.strip_prefix("npc:").and_then(|x| x.parse::<u32>().ok()) {
            if let Some(x) = self.npcs.lista.iter_mut().find(|x| x.id == nn) { x.pj.emote_captura(Some(c), true); } self.pjs.emo.npc_esc = Some((nn, e));
        } else {
            if let Some((p, _)) = self.en_red.cuerpos.get_mut(quien) { p.emote_captura(Some(c), true); } self.pjs.emo.rem_esc.insert(quien.to_string(), e);
        }
    }
    /// juntosPaso: los de una escena quedan en su origen; al terminar, cada uno queda donde terminó su cuerpo
    fn juntos_paso(&mut self, _dt: f32) {
        let t = self.pjs.emo.t;
        if self.pjs.emo.jnt_pedido.as_ref().map(|p| t - p.2 > 10.0).unwrap_or(false) { self.pjs.emo.jnt_pedido = None; }
        if self.pjs.emo.jnt_mio.as_ref().map(|p| t - p.2 > 12.0).unwrap_or(false) { self.pjs.emo.jnt_mio = None; }
        // (yo)
        if let Some(e) = self.pjs.emo.escena.clone() {
            let sigue = self.pj.as_ref().and_then(|p| p.captura()).map(|c| c.0 == e.id).unwrap_or(false);
            let hips = self.pj.as_ref().and_then(|p| p.hueso("Hips")).zip(base_escena(&self.pjs)).map(|(h, b)| m4::mul(&b, &h));
            if let Some(w) = hips { self.jug.pos[0] = w[12]; self.jug.pos[2] = w[14]; }
            self.jug.vel = [0.0; 3];
            if !sigue { self.pjs.emo.escena = None; }
        }
        // (el NPC de la escena: quieto en su origen mientras dure)
        if let Some((n, e)) = self.pjs.emo.npc_esc.clone() {
            let o = if e.rol_b { e.ob } else { e.o };
            let mut fin = true;
            if let Some(x) = self.npcs.lista.iter_mut().find(|x| x.id == n) {
                if x.pj.captura().map(|c| c.0 == e.id).unwrap_or(false) { fin = false; x.cap.pos = [o[0] as f64, o[1] as f64, o[2] as f64]; x.cap.vel = [0.0; 3]; x.yaw = e.th as f64; }
                else if let Some(h) = x.pj.hueso("Hips") { let b = personaje::base([o[0], o[1] - 0.95, o[2]], e.th); let w = m4::mul(&b, &h); x.cap.pos[0] = w[12] as f64; x.cap.pos[2] = w[14] as f64; }
            }
            if fin { self.pjs.emo.npc_esc = None; }
        }
        let rem: Vec<String> = self.pjs.emo.rem_esc.keys().cloned().collect();
        for r in rem { let sigue = self.en_red.cuerpos.get(&r).and_then(|c| c.0.captura()).map(|c| Some(c.0) == self.pjs.emo.rem_esc.get(&r).map(|e| e.id.as_str())).unwrap_or(false); if !sigue { self.pjs.emo.rem_esc.remove(&r); } }
    }
    /// (para las pruebas) en una escena de a dos con un NPC: la menor distancia entre los huesos que se tocan (en cm: la
    /// total y la de costado) y la altura de los pies de cada uno (la del jugador y la del NPC)
    pub fn juntos_prueba(&self) -> Option<(f32, f32, f32, f32)> {
        let e = self.pjs.emo.escena.as_ref()?; let jj = junto(&e.e)?; let (n, _) = self.pjs.emo.npc_esc.as_ref()?;
        let x = self.npcs.lista.iter().find(|x| x.id == *n)?; let pa = self.pj.as_ref()?;
        let (ba, bb) = (base_escena(&self.pjs)?, personaje::base(x.piso(), x.yaw as f32));
        let hueso = |p: &Personaje, b: &M4, h: &str| -> Option<[f32; 3]> { let (nom, _, w) = p.esqueleto(); let i = nom.iter().position(|q| q.rsplit(':').next() == Some(h))?; let m = m4::mul(b, &w[i]); Some([m[12], m[13], m[14]]) };
        let (mut d, mut dh) = (f32::MAX, 0.0);
        for (a, b) in jj.c { if let (Some(p), Some(q)) = (hueso(pa, &ba, a), hueso(&x.pj, &bb, b)) { let t = ((p[0] - q[0]).powi(2) + (p[1] - q[1]).powi(2) + (p[2] - q[2]).powi(2)).sqrt(); if t < d { d = t; dh = (p[0] - q[0]).hypot(p[2] - q[2]); } } }
        if std::env::var("JXM_PJ_DEBUG").is_ok() {
            // (lo previsto por juntosAjuste para este momento contra lo que se dibuja)
            for (quien, p, bm) in [("A", pa, ba), ("B", &x.pj, bb)] { if let Some((id, t)) = p.captura() { if let Some(c) = self.pjs.emo.clips.get(id) {
                let f = (t * c.fps).min(c.nf as f32 - 1.001); let pr = p.pose_captura(c, f, &["RightHand", "Hips"]);
                let real = |h: &str| hueso(p, &bm, h); let prev = |h: &str| pr.get(h).map(|v| jugabilidad::pt(&bm, *v));
                let dif = |h: &str| match (real(h), prev(h)) { (Some(a), Some(b)) => ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2) + (a[2] - b[2]).powi(2)).sqrt() * 100.0, _ => -1.0 };
                eprintln!("  {quien} t {t:.2} f {f:.1}: mano real-prevista {:.1} cm · cadera {:.1} cm", dif("RightHand"), dif("Hips")); } } }
        }
        Some((d * 100.0, dh * 100.0, ba[13], bb[13]))
    }
    /// (para las pruebas) dónde están las caderas del jugador y del NPC de la escena de a dos
    pub fn juntos_caderas(&self) -> Option<([f32; 3], [f32; 3])> {
        let (n, _) = self.pjs.emo.npc_esc.as_ref()?; let x = self.npcs.lista.iter().find(|x| x.id == *n)?; let pa = self.pj.as_ref()?;
        let (a, b) = (m4::mul(&base_escena(&self.pjs)?, &pa.hueso("Hips")?), m4::mul(&personaje::base(x.piso(), x.yaw as f32), &x.pj.hueso("Hips")?));
        Some(([a[12], a[13], a[14]], [b[12], b[13], b[14]]))
    }
    /// juntosRed
    pub(crate) fn juntos_red(&mut self, de: &str, d: &Value) {
        let k = d["k"].as_str().unwrap_or(""); let mi = self.en_red.red.id.clone(); let para_mi = d["to"].as_str() == Some(mi.as_str());
        let e = d["e"].as_str().unwrap_or("").to_string();
        if k == "jntP" && para_mi && junto(&e).is_some() { self.pjs.emo.jnt_pedido = Some((de.to_string(), e, self.pjs.emo.t)); self.sonido.tocar("Click", 0.5, 1.2, None); return; }
        if k == "jntS" && para_mi { if let Some((me, a, _)) = self.pjs.emo.jnt_mio.clone() { if a == de && me == e { self.pjs.emo.jnt_mio = None; if let Some(jj) = junto(&e) { self.juntos_empezar(jj, Some(de.to_string()), None); } } } return; }
        if k == "jnt" && junto(&e).is_some() && d["O"].is_array() {
            for (rol, q) in [("a", d["a"].as_str().unwrap_or("")), ("b", d["b"].as_str().unwrap_or(""))] { if q.is_empty() { continue; } let q = q.to_string(); self.juntos_aplicar(d, rol, &q); }
        }
    }
}
/// la estrella de favorito (glifo('estrella')): cinco puntas
pub fn estrella(l: &Letras, u: &mut Vec<f32>, cx: f32, cy: f32, r: f32, col: [f32; 4]) {
    let p = |k: usize, rr: f32| { let a = -std::f32::consts::FRAC_PI_2 + k as f32 * std::f32::consts::PI / 5.0; [cx + a.cos() * rr, cy + a.sin() * rr] };
    for k in 0..5 { let (a, b, c) = (p(k * 2, r), p(k * 2 + 1, r * 0.45), p((k * 2 + 9) % 10, r * 0.45)); tri(l, u, [cx, cy], c, a, col); tri(l, u, [cx, cy], a, b, col); }
}
