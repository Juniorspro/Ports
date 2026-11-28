//! La radio y la tele (entidades.js y pantalla.js de la web; hijo de paneles_juego.rs). La radio es una entidad (Props →
//! Opciones → Radio, delante del jugador como el piano); se usa con Usar y abre su panel: los géneros, buscar emisoras (las de
//! Radio Browser que da la tienda: /api/radio, sólo las que andan) y la que se toca suena con el reproductor de Android
//! (Medios.java). En cada cuadro su volumen sale de la cuenta del sonido espacial (sonido::espacio: el lado, la distancia y la
//! pared en el medio); suenan las 3 más cercanas. La tele es el objeto TV del menú de props: Usar abre el buscador de YouTube
//! (/api/yt de la tienda, sin lo que no va para chicos: la lista de censura.js) y el video se ve con el reproductor oficial de
//! YouTube en una ventanita encima del juego, llevada a donde se ve la pantalla de la tele (las esquinas del frente del objeto
//! proyectadas con la cámara) y escondida si queda de espaldas, lejos, tapada o con un menú abierto. Falta: la red (que los
//! demás oigan y vean lo mismo), llevarla en la espalda, los archivos del celular y el filtro con IA de la web.
use super::*;
use serde_json::Value;
use std::collections::HashMap;
type V = [f32; 3];
fn add(a: V, b: V) -> V { [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
/// un vector girado por un cuaternión (x, y, z, w)
fn qrot(q: [f32; 4], v: V) -> V { let u = [q[0], q[1], q[2]]; let c = |a: V, b: V| [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    let t = c(u, v); let t = [2.0 * t[0], 2.0 * t[1], 2.0 * t[2]]; let ut = c(u, t); [v[0] + q[3] * t[0] + ut[0], v[1] + q[3] * t[1] + ut[1], v[2] + q[3] * t[2] + ut[2]] }

/// lo que la app de Android hace por la radio y la tele (Medios.java)
pub trait MediosApp {
    fn radio_poner(&self, id: i32, url: &str); fn radio_vol(&self, id: i32, l: f32, r: f32); fn radio_parar(&self, id: i32); fn radio_estado(&self, id: i32) -> String;
    fn tele_poner(&self, id: i32, vid: &str); fn tele_lugar(&self, id: i32, r: [i32; 4], ve: bool); fn tele_vol(&self, id: i32, v: i32); fn tele_parar(&self, id: i32);
}

/// los géneros de la radio (RADIO_GENEROS)
pub const GENEROS: [&str; 11] = ["lofi", "pop", "rock", "electronic", "reggaeton", "hip hop", "latin", "jazz", "classical", "anime", "news"];
/// lo que no va en YouTube para un juego con chicos (YT_MALAS de censura.js; con * al final, también lo que sigue)
const MALAS: [&str; 58] = ["sexo*", "sex", "sexy", "sexual*", "porn*", "xxx", "nsfw", "hentai*", "ecchi", "rule34", "r34", "onlyfans", "nude", "nudes", "nudity", "naked", "desnud*", "erotic*", "erotismo",
    "striptease", "stripper*", "lingerie", "fetish*", "fetich*", "bdsm", "milf*", "camgirl*", "xvideos", "pornhub", "xnxx", "nopor", "uncensored", "стриптиз*", "порн*", "секс*", "голая", "голые", "эротик*",
    "gore", "snuff", "beheading", "decapitad*", "decapitacion*", "cadaver*", "autopsia*", "autopsy", "cocaine", "cocaina", "heroin", "heroina", "metanfetamina", "nazi", "nazis", "selfharm", "automutilacion",
    "+18", "18+", "porno"];
/// ytMalo: ¿el texto (búsqueda, título o canal) tiene algo que no va? (palabra por palabra, sin tildes)
pub fn yt_malo(t: &str) -> bool {
    let n: String = t.to_lowercase().chars().map(|c| match c { 'á' | 'à' | 'ä' | 'â' => 'a', 'é' | 'è' | 'ë' | 'ê' => 'e', 'í' | 'ì' | 'ï' | 'î' => 'i', 'ó' | 'ò' | 'ö' | 'ô' => 'o', 'ú' | 'ù' | 'ü' | 'û' => 'u', 'ñ' => 'n', c => c }).collect();
    if n.contains("+18") || n.contains("18+") { return true; }
    let palabras: Vec<&str> = n.split(|c: char| !c.is_alphanumeric()).filter(|w| !w.is_empty()).collect();
    // (letras separadas: «p o r n», «s.e.x»)
    let junto: String = n.chars().filter(|c| c.is_alphanumeric()).collect();
    MALAS.iter().any(|m| { let (raiz, pre) = match m.strip_suffix('*') { Some(r) => (r, true), None => (*m, false) };
        palabras.iter().any(|w| if pre { w.starts_with(raiz) } else { *w == raiz }) || (raiz.chars().count() >= 4 && pre && palabras.iter().all(|w| w.chars().count() <= 2) && junto.contains(raiz)) })
}

/// sin lo que la letra del juego no tiene (los emojis y sus uniones): no salen como «?»
pub fn limpio(t: &str) -> String { t.chars().filter(|&c| { let u = c as u32; !(0x1F000..=0x1FFFF).contains(&u) && !(0x2600..=0x27BF).contains(&u) && !(0xFE00..=0xFE0F).contains(&u) && u != 0x200D && !(0x2B00..=0x2BFF).contains(&u) && !(0xE000..=0xF8FF).contains(&u) }).collect::<String>().split_whitespace().collect::<Vec<_>>().join(" ") }
/// el número de «Mi música» para Medios.java (no es ninguna tele del mundo)
pub const MUSICA: u32 = 0x7fff_fff0;
/// el estado de la radio y la tele
#[derive(Default)]
pub struct Medios {
    pub app: Option<Box<dyn MediosApp>>,
    /// el panel: 0 radio, 1 tele; de cuál (el número de la entidad o del objeto); lo encontrado, lo buscado y el género
    /// Mi música: la lista (id y título), si está sonando y su volumen
    pub lista: Option<Vec<(String, String)>>, pub musica_on: bool, pub musica_vol: f32,
    pub modo: u8, pub cual: u32, pub res: Vec<Value>, pub q: String, pub tag: String, pub cargando: bool, pub error: Option<String>,
    /// lo que suena en cada radio: entidad → (emisora, nombre, volumen 0..1, lo tapado 0..1)
    pub radios: HashMap<u32, (String, String, f32, f32)>,
    /// lo que pasa cada tele: objeto → (video, título, volumen 0..1, último volumen mandado)
    pub teles: HashMap<u32, (String, String, f32, i32)>,
    t_oclu: f32, cuadro: u32,
    /// el tamaño de la pantalla del último cuadro
    pub pantalla: (f32, f32),
}

impl Juego {
    /// abrir el panel de la radio (entidad `id`) o de la tele (objeto `id`)
    pub(crate) fn med_abrir(&mut self, tele: bool, id: u32) {
        let m = &mut self.med; let cambia = m.modo != tele as u8; m.modo = tele as u8; m.cual = id; m.error = None;
        if cambia { m.res.clear(); m.q.clear(); m.tag.clear(); }
        self.ini.desde_juego = true; self.pn_abrir(PanelIni::Medios { scroll: 0.0 });
        if self.med.res.is_empty() { if tele { self.med.q = "música para jugar".into(); } self.med_buscar(); }
    }
    fn med_buscar(&mut self) {
        let Some(h) = self.gmod.http_bin.clone() else { self.med.error = Some("Sin conexión".into()); return };
        let m = &mut self.med; m.cargando = true; m.error = None;
        let enc = |s: &str| s.bytes().map(|b| if b.is_ascii_alphanumeric() || b"-_.~".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") }).collect::<String>();
        let url = if m.modo >= 1 { format!("{}yt?q={}", gmod_juego::TIENDA_URL, enc(&m.q)) } else { format!("{}radio?q={}{}", gmod_juego::TIENDA_URL, enc(&m.q), if m.tag.is_empty() { String::new() } else { format!("&tag={}", enc(&m.tag)) }) };
        let (tx, k) = (self.gmod.tx.clone(), format!("med:{}", if m.modo >= 1 { "yt" } else { "radio" }));
        std::thread::spawn(move || { let r = h(&url).and_then(|(c, b)| if c == 200 { Ok(b) } else { Err(format!("HTTP {c}")) }); let _ = tx.send((k, r)); });
    }
    /// lo que contestó la tienda (desde gmod_juego.rs)
    pub(crate) fn med_llego(&mut self, k: &str, r: Result<Vec<u8>, String>) {
        if let Some(resto) = k.strip_prefix("u:") {
            // (la dirección del audio de una emisora: suena en esa radio)
            let Some((ent, _st)) = resto.split_once(':') else { return }; let ent: u32 = ent.parse().unwrap_or(0);
            let u = r.ok().and_then(|b| serde_json::from_slice::<Value>(&b).ok()).and_then(|v| v["u"].as_str().map(String::from)).filter(|u| u.starts_with("http"));
            match (u, &self.med.app) { (Some(u), Some(a)) => a.radio_poner(ent as i32, &u), (None, _) => { self.med.radios.remove(&ent); self.avisar("Esa emisora no anda: probá otra".into()); } _ => {} }
            return;
        }
        let m = &mut self.med; m.cargando = false;
        match r.and_then(|b| serde_json::from_slice::<Value>(&b).map_err(|e| e.to_string())) {
            Ok(v) => { let tele = k == "yt"; let mut l = v["items"].as_array().cloned().unwrap_or_default();
                l.retain(|x| { let id = x["id"].as_str().unwrap_or(""); let ok_id = if tele { id.len() == 11 } else { id.len() == 36 }; ok_id && !yt_malo(x["t"].as_str().unwrap_or("")) && !yt_malo(x["c"].as_str().unwrap_or("")) });
                for x in l.iter_mut() { for k in ["t", "c", "g"] { if let Some(t) = x[k].as_str().map(limpio) { x[k] = Value::String(t); } } }
                if (k == "yt") == (m.modo >= 1) { m.res = l; } }
            Err(e) => m.error = Some(format!("No se pudo buscar ({e})")),
        }
    }
    /// lo que se toca en el panel (Acc::Med)
    /// Mi música (Opciones → Sonido): tu lista de YouTube, que suena de fondo sin pantalla —en el menú, en una partida sola o en
    /// un server— en lugar de la música del menú; se guarda en mimusica.txt
    pub(crate) fn med_abrir_musica(&mut self) {
        if self.med.lista.is_none() { self.med.lista = Some(self.datos.as_ref().and_then(|d| std::fs::read_to_string(d.join("mimusica.txt")).ok()).unwrap_or_default().lines().filter_map(|l| l.split_once('\t').map(|(a, b)| (a.to_string(), b.to_string()))).filter(|(a, _)| a.len() == 11).take(200).collect()); }
        if self.med.musica_vol == 0.0 && !self.med.musica_on { self.med.musica_vol = 0.8; }
        let m = &mut self.med; if m.modo != 2 { m.res.clear(); m.q.clear(); } m.modo = 2; m.cual = MUSICA; m.error = None;
        self.pn_abrir(PanelIni::Medios { scroll: 0.0 });
        if self.med.res.is_empty() { self.med.q = "frutiger aero music".into(); self.med_buscar(); }
    }
    fn med_lista_guardar_y_sonar(&mut self) {
        let l = self.med.lista.clone().unwrap_or_default();
        if let Some(d) = &self.datos { let _ = std::fs::write(d.join("mimusica.txt"), l.iter().map(|(a, b)| format!("{a}\t{}\n", b.replace(['\t', '\n'], " "))).collect::<String>()); }
        if let Some(a) = &self.med.app { if l.is_empty() || !self.med.musica_on { a.tele_parar(MUSICA as i32); } else { a.tele_poner(MUSICA as i32, &l.iter().map(|x| x.0.as_str()).collect::<Vec<_>>().join(",")); a.tele_lugar(MUSICA as i32, [-4000, -4000, 220, 220], true); a.tele_vol(MUSICA as i32, (self.med.musica_vol * 100.0) as i32); } }
    }
    pub(super) fn med_accion(&mut self, s: &str) {
        let (a, b) = s.split_once('|').unwrap_or((s, ""));
        if self.med.modo == 2 { match a {
            "poner" => { if let Some(it) = self.med.res.get(b.parse::<usize>().unwrap_or(usize::MAX)).cloned() { let (id, t) = (it["id"].as_str().unwrap_or("").to_string(), it["t"].as_str().unwrap_or("").to_string());
                let l = self.med.lista.get_or_insert_with(Vec::new); if id.len() == 11 && !l.iter().any(|x| x.0 == id) { l.push((id, t)); } self.med.musica_on = true; self.med_lista_guardar_y_sonar(); } return; }
            "quitar" => { if let Some(l) = self.med.lista.as_mut() { let k = b.parse::<usize>().unwrap_or(usize::MAX); if k < l.len() { l.remove(k); } } self.med_lista_guardar_y_sonar(); return; }
            "apagar" => { self.med.musica_on = !self.med.musica_on; self.med_lista_guardar_y_sonar(); return; }
            "vol" => { let d: f32 = b.parse().unwrap_or(0.0); self.med.musica_vol = (self.med.musica_vol + d).clamp(0.0, 1.0); if let Some(a) = &self.med.app { a.tele_vol(MUSICA as i32, (self.med.musica_vol * 100.0) as i32); } return; }
            _ => {}
        } }
        match a {
            "buscar" => { let q = self.med.q.clone(); self.pedir_texto(Escribir::Med, if self.med.modo == 1 { "Buscar en YouTube" } else { "Buscar emisoras" }, &q, 80, false); }
            "gen" => { self.med.tag = if self.med.tag == b { String::new() } else { b.to_string() }; self.med.q.clear(); self.med_buscar(); }
            "poner" => { let Some(it) = self.med.res.get(b.parse::<usize>().unwrap_or(usize::MAX)).cloned() else { return };
                let (id, t) = (it["id"].as_str().unwrap_or("").to_string(), it["t"].as_str().unwrap_or("").to_string()); let cual = self.med.cual;
                if self.med.modo == 1 { if let Some(a) = &self.med.app { a.tele_poner(cual as i32, &id); } self.med.teles.insert(cual, (id, t, 0.8, -1)); }
                else { self.med_poner_radio(cual, id, t); self.ent_contar("radio", cual); } }
            "apagar" => { let c = self.med.cual; if self.med.modo == 1 { self.med.teles.remove(&c); if let Some(a) = &self.med.app { a.tele_parar(c as i32); } } else { self.med.radios.remove(&c); if let Some(a) = &self.med.app { a.radio_parar(c as i32); } self.ent_contar("radio", c); } }
            "vol" => { let d: f32 = b.parse().unwrap_or(0.0); let c = self.med.cual;
                if self.med.modo == 1 { if let Some(t) = self.med.teles.get_mut(&c) { t.2 = (t.2 + d).clamp(0.0, 1.0); t.3 = -1; } } else if let Some(r) = self.med.radios.get_mut(&c) { r.2 = (r.2 + d).clamp(0.0, 1.0); } }
            _ => {}
        }
    }
    /// una emisora de Radio Browser (su uuid) en la radio `cual`: se pide su dirección a la tienda y suena
    pub(crate) fn med_poner_radio(&mut self, cual: u32, id: String, t: String) {
        let vol = self.med.radios.get(&cual).map(|r| r.2).unwrap_or(0.8); self.med.radios.insert(cual, (id.clone(), t, vol, 0.0));
        if let Some(h) = self.gmod.http_bin.clone() { let (tx, url, k) = (self.gmod.tx.clone(), format!("{}radio/u/{id}", gmod_juego::TIENDA_URL), format!("med:u:{cual}:{id}"));
            std::thread::spawn(move || { let r = h(&url).and_then(|(c, b)| if c == 200 { Ok(b) } else { Err(format!("HTTP {c}")) }); let _ = tx.send((k, r)); }); }
    }
    pub(crate) fn med_escrito(&mut self, t: String) { self.med.q = t.chars().take(80).collect(); self.med.tag.clear(); if self.med.modo == 1 && yt_malo(&self.med.q) { self.avisar("Esa búsqueda no va".into()); self.med.res.clear(); return; } self.med_buscar(); }
    /// la radio que se quita (la entidad ya no está)
    pub(crate) fn med_quitar_radio(&mut self, id: u32) { if self.med.radios.remove(&id).is_some() { if let Some(a) = &self.med.app { a.radio_parar(id as i32); } } }

    /// cada cuadro jugando (después de la cámara): el volumen de cada radio y dónde se ve cada tele
    pub(crate) fn med_paso(&mut self, dt: f32) {
        let (wf, hf) = self.med.pantalla;
        if self.med.radios.is_empty() && self.med.teles.is_empty() { return; }
        self.med.cuadro = self.med.cuadro.wrapping_add(1); self.med.t_oclu += dt;
        let o = self.sonido.oyente; let menu = self.ini.abierto || self.ini.panel.is_some() || self.ini.pz.abierta;
        // —— las radios: las 3 más cercanas suenan, con el volumen de cada oído del sonido espacial ——
        let mut lugares: Vec<(u32, V, f32)> = vec![];
        for (&id, _) in self.med.radios.iter() { if let Some(p) = self.jg.ents.lugar_de(id) { let p = [p[0], p[1] + 0.25, p[2]]; let d = ((p[0] - o.0[0]).powi(2) + (p[1] - o.0[1]).powi(2) + (p[2] - o.0[2]).powi(2)).sqrt(); lugares.push((id, p, d)); } }
        let fuera: Vec<u32> = self.med.radios.keys().copied().filter(|id| !lugares.iter().any(|l| l.0 == *id)).collect(); for id in fuera { self.med_quitar_radio(id); }
        lugares.sort_by(|a, b| a.2.partial_cmp(&b.2).unwrap_or(std::cmp::Ordering::Equal));
        if self.med.t_oclu > 0.4 { if let Some(mp) = self.mapa.as_ref() { for (id, p, d) in &lugares {
            let v = [p[0] - o.0[0], p[1] - o.0[1], p[2] - o.0[2]]; let f = if *d < 0.6 { 0.0 } else { match mp.mundo.rayo(o.0, [v[0] / d, v[1] / d, v[2] / d], *d) { Some(g) if g.t < d - 0.5 => 1.0, _ => 0.0 } };
            if let Some(r) = self.med.radios.get_mut(id) { r.3 += (f - r.3) * 0.6; } } } }
        if self.med.cuadro % 2 == 0 { if let Some(a) = &self.med.app { for (k, (id, p, _)) in lugares.iter().enumerate() {
            let (vol, ocl) = self.med.radios.get(id).map(|r| (r.2, r.3)).unwrap_or((0.0, 0.0));
            let (g, _, _, _) = if k < 3 { crate::sonido::espacio(o, *p, vol * self.sonido.volumen, ocl, 0.0) } else { ([0.0; 2], [0.0; 2], [0.0; 2], 0.0) };
            a.radio_vol(*id as i32, g[0].min(1.0), g[1].min(1.0)); } } }
        // —— las teles: las esquinas del frente del objeto en la pantalla ——
        let vp = self.vp_ult;
        let ids: Vec<u32> = self.med.teles.keys().copied().collect();
        for id in ids {
            let Some(ob) = self.objs.iter().find(|x| x.id == id) else { self.med.teles.remove(&id); if let Some(a) = &self.med.app { a.tele_parar(id as i32); } continue };
            let caja = self.prefabs.get(&ob.nombre).map(|p| p.caja).unwrap_or([-0.5, 0.0, -0.1, 0.5, 0.7, 0.1]);
            let (q, pos) = (ob.q, ob.pos);
            let mundo = |l: V| add(pos, qrot(q, l));
            // (el frente: el lado más angosto de la caja, el que mira a la cámara)
            let (dx, dz) = (caja[3] - caja[0], caja[5] - caja[2]); let c = [(caja[0] + caja[3]) / 2.0, (caja[1] + caja[4]) / 2.0, (caja[2] + caja[5]) / 2.0];
            let (eje_x, fr) = if dz <= dx { (true, [c[0], c[1], caja[5]]) } else { (false, [caja[3], c[1], c[2]]) };
            let mut lados = vec![fr]; if eje_x { lados.push([c[0], c[1], caja[2]]); } else { lados.push([caja[0], c[1], c[2]]); }
            let cam = o.0; let mejor = lados.iter().copied().min_by(|a, b| { let (pa, pb) = (mundo(*a), mundo(*b)); let d = |p: V| (p[0] - cam[0]).powi(2) + (p[1] - cam[1]).powi(2) + (p[2] - cam[2]).powi(2); d(pa).partial_cmp(&d(pb)).unwrap_or(std::cmp::Ordering::Equal) }).unwrap();
            let (ax, ay) = (if eje_x { (caja[3] - caja[0]) * 0.42 } else { (caja[5] - caja[2]) * 0.42 }, (caja[4] - caja[1]) * 0.38);
            let esq: Vec<V> = [(-1.0f32, -1.0f32), (1.0, -1.0), (1.0, 1.0), (-1.0, 1.0)].iter().map(|(sx, sy)| if eje_x { mundo([mejor[0] + sx * ax, c[1] + 0.06 * (caja[4] - caja[1]) + sy * ay, mejor[2]]) } else { mundo([mejor[0], c[1] + 0.06 * (caja[4] - caja[1]) + sy * ay, mejor[2] + sx * ax]) }).collect();
            let centro = mundo(mejor); let dist = ((centro[0] - cam[0]).powi(2) + (centro[1] - cam[1]).powi(2) + (centro[2] - cam[2]).powi(2)).sqrt();
            let mut ve = !menu && dist < 30.0; let (mut x0, mut y0, mut x1, mut y1) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
            for p in &esq { let cl = [vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12], vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13], vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15]];
                if cl[2] <= 0.05 { ve = false; break; } let (sx, sy) = ((cl[0] / cl[2] * 0.5 + 0.5) * wf, (0.5 - cl[1] / cl[2] * 0.5) * hf); x0 = x0.min(sx); y0 = y0.min(sy); x1 = x1.max(sx); y1 = y1.max(sy); }
            if ve && (x1 < 0.0 || y1 < 0.0 || x0 > wf || y0 > hf) { ve = false; }
            // (tapada: el rayo de los ojos al centro de la pantalla pega antes)
            if ve && self.med.cuadro % 4 == 0 { if let Some(mp) = self.mapa.as_ref() { let v = [centro[0] - cam[0], centro[1] - cam[1], centro[2] - cam[2]]; if dist > 0.5 { if let Some(g) = mp.mundo.rayo(cam, [v[0] / dist, v[1] / dist, v[2] / dist], dist) { if g.t < dist - 0.3 { ve = false; } } } } }
            let vol = self.med.teles.get(&id).map(|t| t.2).unwrap_or(0.0); let vv = if ve || dist < 12.0 { ((1.0 - dist / 25.0).clamp(0.0, 1.0) * vol * self.sonido.volumen * 100.0) as i32 } else { 0 };
            if let Some(a) = &self.med.app { a.tele_lugar(id as i32, [x0 as i32, y0 as i32, (x1 - x0) as i32, (y1 - y0) as i32], ve);
                if let Some(t) = self.med.teles.get_mut(&id) { if (t.3 - vv).abs() >= 3 { t.3 = vv; a.tele_vol(id as i32, vv); } } }
        }
        if self.med.t_oclu > 0.4 { self.med.t_oclu = 0.0; }
    }
    /// en los menús, las teles se esconden (el video sigue)
    pub(crate) fn med_esconder(&mut self) { if let Some(a) = &self.med.app { for id in self.med.teles.keys() { a.tele_lugar(*id as i32, [0; 4], false); } } }

    /// el panel de la radio o de la tele (radioAbrir)
    pub(super) fn pn_medios(&mut self, p: &mut Pincel, m: &Pm, scroll: f32, t: f32, z: &mut Vec<([f32; 4], Acc)>) {
        let tele = self.med.modo >= 1; let mia = self.med.modo == 2; let cual = self.med.cual;
        let est = if tele { if self.med.teles.contains_key(&cual) { "En la tele".to_string() } else { String::new() } } else { self.med.app.as_ref().map(|a| a.radio_estado(cual as i32)).unwrap_or_default() };
        let (alto, cont) = self.pn_marco(p, m, t, |p, c| {
            let (_, hc) = self.pn_cabecera(p, m, c, "", Some((if mia { "musica" } else if tele { "video" } else { "radio" }, AMA)), if mia { "Mi música" } else if tele { "Tele" } else { "Radio" }, t);
            let pie_h = m.ph + 2.0 + m.u * 1.5 + 1.0; let pie = self.pn_pie(p, m, c, pie_h, t, z);
            let pby = pie[1] + 1.0 + (pie_h - 1.0 - m.ph) / 2.0; let mut xd = pie[0] + pie[2] - m.u * 1.5;
            for (s, ic, a) in [("Buscar", "buscar", Acc::Med("buscar".into())), (if mia { if self.med.musica_on { "Parar" } else { "Escuchar" } } else { "Apagar" }, if mia && !self.med.musica_on { "musica" } else { "parar" }, Acc::Med("apagar".into()))] { let w = self.pn_principal_ancho(p, m, s); xd -= w; self.pn_principal(p, m, [xd, pby - 1.0, w, m.ph + 2.0], s, ic, a, z); xd -= m.u; }
            for (s, a) in [("+", Acc::Med("vol|0.1".into())), ("−", Acc::Med("vol|-0.1".into()))] { let w = self.pn_boton_ancho(p, m, s, true, false); xd -= w; self.pn_boton(p, m, [xd, pby, w, m.ph], s, Some("volumen"), false, a, z); xd -= m.u * 0.5; }
            let cu = [c[0], c[1] + hc, c[2], pie[1] - c[1] - hc]; let u = m.u; let mut alto = 0.0;
            p.con_recorte(cu, |p| {
                let x0 = cu[0] + u * 1.4; let w = cu[2] - u * 2.8; let mut y = cu[1] + u - scroll;
                // (Mi música: la lista —se agrega tocando un resultado; suena de fondo sin pantalla, también jugando—)
                if mia { let l = self.med.lista.clone().unwrap_or_default();
                    p.texto_max(Cara::S7, m.ft, x0, y + m.ft, TX, 0.02, &format!("Tu lista · {} canciones{}", l.len(), if self.med.musica_on { " · sonando de fondo" } else { "" }), w); y += m.ft * 1.6;
                    if l.is_empty() { p.texto_max(Cara::S4, m.fs, x0, y + m.fs, PN_T3, 0.0, "Buscá y tocá una canción para agregarla. Suena en el menú y en tus partidas, solo o en un server.", w); y += m.fs * 1.8; }
                    for (k, (_, tt)) in l.iter().enumerate() { let rh = m.ph * 0.9; if y + rh > cu[1] && y < cu[1] + cu[3] { p.rect(x0, y, w, rh, PN_PL2); p.borde(x0, y, w, rh, 1.0, PN_LIN);
                        p.texto_max(Cara::S4, m.fs, x0 + u, y + rh / 2.0 + m.fs * 0.35, TX, 0.0, &format!("{}. {tt}", k + 1), w - u * 6.0); p.texto_d(Cara::S7, m.fs, x0 + w - u, y + rh / 2.0 + m.fs * 0.35, rgba(0xff8a8a, 1.0), 0.03, "Quitar");
                        zona(p, z, [x0 + w - u * 5.0, y, u * 5.0, rh], Acc::Med(format!("quitar|{k}"))); } y += rh + u * 0.3; }
                    y += u * 0.6; p.texto(Cara::S7, m.ft, x0, y + m.ft, PN_T2, 0.02, "Para agregar"); y += m.ft * 1.5; }
                // (lo que suena ahora)
                let ahora = if tele { self.med.teles.get(&cual).map(|x| (x.1.clone(), x.2)) } else { self.med.radios.get(&cual).map(|x| (x.1.clone(), x.2)) };
                if let Some((n, v)) = ahora { let est = match est.as_str() { "cargando" => "Sintonizando…", "sonando" => "Sonando", "error" => "No anda: probá otra", s => s };
                    p.rect(x0, y, w, m.ph, rgba(0x13314f, 0.9)); p.borde(x0, y, w, m.ph, 1.0, con_a(AMA, 0.6));
                    p.texto_max(Cara::S7, m.ft, x0 + u, y + m.ph / 2.0 + m.ft * 0.35, TX, 0.02, &n, w * 0.6); p.texto_d(Cara::S4, m.fs, x0 + w - u, y + m.ph / 2.0 + m.fs * 0.35, PN_T2, 0.0, &format!("{est} · volumen {:.0} %", v * 100.0)); y += m.ph + u; }
                if !tele { let mut x = x0; for g in GENEROS { let bw = self.pn_boton_ancho(p, m, g, false, self.med.tag == g); if x + bw > x0 + w { x = x0; y += m.ph * 0.85 + u * 0.4; }
                    self.pn_boton(p, m, [x, y, bw, m.ph * 0.85], g, None, self.med.tag == g, Acc::Med(format!("gen|{g}")), z); x += bw + u * 0.4; } y += m.ph * 0.85 + u; }
                if !self.med.q.is_empty() { p.texto_max(Cara::S4, m.fs, x0, y + m.fs, PN_T3, 0.0, &format!("Buscado: «{}»", self.med.q), w); y += m.fs * 1.6; }
                if self.med.cargando { p.texto(Cara::S4, m.ft, x0, y + m.ft, PN_T2, 0.0, "Buscando…"); y += m.ft * 2.0; }
                else if let Some(e) = &self.med.error { p.texto_max(Cara::S4, m.ft, x0, y + m.ft, rgba(0xff9b9b, 1.0), 0.0, e, w); y += m.ft * 2.0; }
                else if self.med.res.is_empty() { p.texto(Cara::S4, m.ft, x0, y + m.ft, PN_T2, 0.0, "No hay resultados: probá otra búsqueda."); y += m.ft * 2.0; }
                let rh = m.ph * 1.1; let elegido = if tele { self.med.teles.get(&cual).map(|x| x.0.clone()) } else { self.med.radios.get(&cual).map(|x| x.0.clone()) };
                for (i, it) in self.med.res.iter().enumerate() {
                    let r = [x0, y, w, rh]; let sel = elegido.as_deref() == it["id"].as_str();
                    if y + rh > cu[1] && y < cu[1] + cu[3] {
                        p.rect(r[0], r[1], r[2], r[3], if sel { rgba(0x1d2733, 0.95) } else { PN_PL2 }); p.borde(r[0], r[1], r[2], r[3], 1.0, if sel { con_a(AMA, 0.6) } else { PN_LIN });
                        p.icono(if tele { "video" } else { "radio" }, x0 + u, y + (rh - m.ft * 1.3) / 2.0, m.ft * 1.3, 2.0, if sel { AMA } else { PN_T2 });
                        let tx = x0 + u * 2.0 + m.ft * 1.3; p.texto_max(Cara::S7, m.ft, tx, y + rh / 2.0 - m.ft * 0.1, TX, 0.02, it["t"].as_str().unwrap_or(""), w - (tx - x0) - u);
                        let sub = if tele { format!("{} · {}", it["c"].as_str().unwrap_or(""), it["d"].as_str().unwrap_or("")) } else { [it["c"].as_str().unwrap_or("").to_string(), it["g"].as_str().unwrap_or("").to_string(), match it["b"].as_i64().unwrap_or(0) { 0 => String::new(), b => format!("{b} kbps") }].into_iter().filter(|x| !x.is_empty()).collect::<Vec<_>>().join(" · ") };
                        p.texto_max(Cara::S4, m.fs * 0.85, tx, y + rh / 2.0 + m.fs * 1.0, PN_T3, 0.0, &sub, w - (tx - x0) - u);
                        zona(p, z, r, Acc::Med(format!("poner|{i}")));
                    }
                    y += rh + u * 0.4;
                }
                alto = y + scroll - cu[1];
            });
            (alto, cu)
        });
        self.ini.pn.contenido = cont; self.ini.pn.alto_contenido = alto;
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn lo_que_no_va() {
        assert!(yt_malo("video PORNO") && yt_malo("Sexy dance") && yt_malo("s e x o") && yt_malo("+18 sin censura") && yt_malo("Erótica"));
        assert!(!yt_malo("música para jugar") && !yt_malo("FNAF song") && !yt_malo("Lofi hip hop radio") && !yt_malo("Sussex county") && !yt_malo("Essex"));
    }
}
