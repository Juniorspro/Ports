//! Publicar en Bugs y sugerencias desde la nativa, sin cuenta: tres apartados (Bugs, Celulares y Sugerencias), con título,
//! descripción y un video (o una foto) del celular. Sin cuenta sólo hace falta un nombre de usuario: el de la sala; si no
//! tenés uno, se pide ahí mismo al publicar. En Celulares se completa solo el modelo del celular, Android y la placa (para
//! saber en cuáles anda y en cuáles no). El video lo elige y lo sube Java (Archivo.java: el selector de Android y de a
//! partes de 1,5 MB a panel/media, como la web); lo demás va por panel/post. El servidor deja una cada 3 minutos.
use super::*;
use serde_json::{json, Value};

/// el selector de archivos y la subida del video (Archivo.java)
pub trait ArchivoApp {
    fn elegir(&self);
    /// «eligiendo», «listo|nombre|tamaño|mime», «grande», «subiendo|%», «subido|id|ancho|alto|segundos», «error|por qué» o ""
    fn estado(&self) -> String;
    fn subir(&self, base: &str);
    fn olvidar(&self);
    /// (Tu logo) la foto elegida, en PNG de hasta 512 px, a `dst`
    fn png(&self, _dst: &str) -> bool { false }
    /// (Tu logo → Acceso directo) un ícono en la pantalla de inicio con esa imagen
    fn atajo(&self, _png: &str, _nombre: &str) -> bool { false }
}

/// los apartados: tipo en el servidor, nombre e ícono
pub const TIPOS: [(&str, &str, &str); 3] = [("bug", "Bugs", "bicho"), ("cel", "Celulares", "celular"), ("sug", "Sugerencias", "foco")];

#[derive(Default)]
pub struct BugForm {
    pub tipo: usize, pub titulo: String, pub texto: String,
    /// el video elegido (nombre y tamaño) y, ya subido, lo que va en el post ({id, w, h, dur})
    pub archivo: Option<(String, u64)>, pub media: Option<Value>,
    /// lo que se muestra abajo (cómo va o qué falta), publicando, y si al terminar lo que se pidió hay que seguir publicando
    pub estado: String, pub enviando: bool, pub seguir: bool,
}
#[derive(Default)]
pub struct Bugs { pub form: Option<BugForm>, pub app: Option<Box<dyn ArchivoApp>>, ult: String }

/// adónde se publica (para las pruebas, JXM_PANEL_URL: el servidor del panel en la compu)
fn base() -> String { std::env::var("JXM_PANEL_URL").unwrap_or_else(|_| format!("{}panel/", super::super::gmod_juego::TIENDA_URL)) }
/// un nombre de usuario que sirve (el de fábrica de la nativa no cuenta)
pub fn nombre_ok(n: &str) -> bool { let n = n.trim(); n.chars().count() >= 2 && n != "Nativo" }

impl Juego {
    /// lo de este celular, para Celulares (y al pie de los bugs)
    pub(crate) fn bug_celu(&self) -> String {
        let pr = |k: &str| crate::comun::personajes::propiedad(k);
        let (marca, modelo, andr) = (pr("ro.product.manufacturer"), pr("ro.product.model"), pr("ro.build.version.release"));
        let celu = [marca, modelo].into_iter().filter(|s| !s.is_empty()).collect::<Vec<_>>().join(" ");
        let mut v = vec![];
        if !celu.is_empty() { v.push(format!("Celular: {celu}")); }
        if !andr.is_empty() { v.push(format!("Android {andr}")); }
        if !self.placa_nombre.is_empty() { v.push(format!("Placa: {}", self.placa_nombre)); }
        v.push(format!("Motor: {}", self.en_uso.nombre()));
        v.join(" · ")
    }
    pub fn bug_accion(&mut self, s: &str) {
        let tab = match &self.ini.panel { Some(PanelIni::Bugs { tab, .. }) => (*tab).min(2), _ => 0 };
        match s {
            "nuevo" => { let texto = if tab == 1 { format!("{}\n", self.bug_celu()) } else { String::new() };
                if let Some(a) = &self.ini.pn.bf.app { a.olvidar(); } self.ini.pn.bf.ult.clear();
                self.ini.pn.bf.form = Some(BugForm { tipo: tab, texto, ..Default::default() }); }
            "cancelar" => { self.ini.pn.bf.form = None; if let Some(a) = &self.ini.pn.bf.app { a.olvidar(); } }
            "nombre" => { let n = self.en_red.red.nombre.clone(); self.pedir_texto(Escribir::Bug(0), "Tu nombre de usuario (lo ven todos)", if nombre_ok(&n) { &n } else { "" }, 20, false); }
            "titulo" => { let t = self.ini.pn.bf.form.as_ref().map(|f| f.titulo.clone()).unwrap_or_default(); let q = match self.ini.pn.bf.form.as_ref().map_or(0, |f| f.tipo) { 1 => "Título (qué pasa en tu celular)", 2 => "Título de tu idea", _ => "Título del bug" }; self.pedir_texto(Escribir::Bug(1), q, &t, 90, false); }
            "texto" => { let t = self.ini.pn.bf.form.as_ref().map(|f| f.texto.clone()).unwrap_or_default(); self.pedir_texto(Escribir::Bug(2), "Descripción (qué hiciste, qué pasó)", &t, 1500, false); }
            "video" => { if self.ini.pn.bf.form.as_ref().map_or(true, |f| f.enviando) { return; }
                match &self.ini.pn.bf.app { Some(a) => a.elegir(), None => self.avisar("Elegir un video sólo anda en el celular".into()) } }
            "sacar" => { if let Some(f) = self.ini.pn.bf.form.as_mut() { if !f.enviando { f.archivo = None; f.media = None; } } if let Some(a) = &self.ini.pn.bf.app { a.olvidar(); } self.ini.pn.bf.ult.clear(); }
            "publicar" => self.bug_publicar(),
            _ => {}
        }
    }
    pub fn bug_escrito(&mut self, k: u8, t: String) {
        let t = t.trim().to_string();
        match k {
            0 => { let n: String = t.chars().filter(|c| !c.is_control()).take(20).collect();
                if !nombre_ok(&n) { self.avisar("Poné un nombre de al menos 2 letras".into()); return; }
                self.en_red.poner_nombre(&n); }
            1 => if let Some(f) = self.ini.pn.bf.form.as_mut() { f.titulo = t.chars().take(90).collect(); },
            _ => if let Some(f) = self.ini.pn.bf.form.as_mut() { f.texto = t.chars().take(1500).collect(); },
        }
        if self.ini.pn.bf.form.as_ref().map_or(false, |f| f.seguir) { self.bug_publicar(); }
    }
    /// publicar: primero lo que falta (el nombre, el título), después el video y por último el post
    fn bug_publicar(&mut self) {
        let (celu, mapa, nombre) = (self.bug_celu(), self.mapas.get(self.mapa_i).cloned().unwrap_or_default(), self.en_red.red.nombre.trim().to_string());
        let Some(f) = self.ini.pn.bf.form.as_mut() else { return }; if f.enviando && f.seguir { return; }
        f.seguir = false;
        if !nombre_ok(&nombre) { f.seguir = true; f.estado = "Falta tu nombre de usuario".into(); self.bug_accion("nombre"); return; }
        if f.titulo.chars().count() < 3 { f.seguir = true; f.estado = "Falta el título".into(); self.bug_accion("titulo"); return; }
        // (con video: se sube primero; cuando termina, bug_paso vuelve acá)
        if f.archivo.is_some() && f.media.is_none() {
            f.enviando = true; f.seguir = true; f.estado = "Subiendo el video…".into();
            if let Some(a) = &self.ini.pn.bf.app { a.subir(&base()); } else { f.enviando = false; f.seguir = false; f.estado = "Sin el video: elegilo de nuevo".into(); }
            return;
        }
        let Some(h) = self.soc.http.clone() else { f.estado = "Sin conexión".into(); return };
        f.enviando = true; f.estado = "Publicando…".into();
        let mut texto = f.texto.trim().to_string();
        if f.tipo != 1 && !celu.is_empty() { texto = format!("{texto}\n\n— {celu}"); }
        let cuerpo = json!({ "tipo": TIPOS[f.tipo.min(2)].0, "titulo": f.titulo, "texto": texto.chars().take(4000).collect::<String>(), "media": f.media.iter().cloned().collect::<Vec<_>>(),
            "version": format!("nativo {}", super::super::latido_juego::VERSION), "lugar": format!("{mapa} · nativo celu"), "nombre": nombre }).to_string();
        let (tx, url) = (self.gmod.tx.clone(), format!("{}post", base()));
        std::thread::spawn(move || {
            let r = h("POST", &url, &[("Content-Type".into(), "application/json".into())], Some(&cuerpo)).map(|(c, b)| { let mut v: Value = serde_json::from_str(&b).unwrap_or(json!({})); v["_codigo"] = c.into(); v.to_string().into_bytes() });
            let _ = tx.send(("bugpub".into(), r));
        });
    }
    /// la respuesta del servidor al publicar
    pub(crate) fn bug_llego(&mut self, r: Result<Vec<u8>, String>) {
        let Some(f) = self.ini.pn.bf.form.as_mut() else { return }; f.enviando = false;
        let v = r.map(|b| serde_json::from_slice::<Value>(&b).unwrap_or(json!({}))).unwrap_or_else(|e| json!({ "error": e }));
        if v["id"].as_str().is_some() {
            let tipo = f.tipo.min(2); self.ini.pn.bf.form = None; if let Some(a) = &self.ini.pn.bf.app { a.olvidar(); }
            self.ini.pn.bugs[tipo] = None; self.ini.pn.bugs_error = None;
            self.avisar("¡Publicado! Gracias: lo vemos en el panel".into()); return;
        }
        if v["nombre"].as_bool() == Some(true) { f.seguir = true; f.estado = "Falta tu nombre de usuario".into(); self.bug_accion("nombre"); return; }
        f.estado = v["error"].as_str().map(|e| format!("No se publicó: {e}")).unwrap_or_else(|| "No se publicó: probá de nuevo".into());
    }
    /// cada cuadro con el panel abierto: cómo va el video (elegido, subiendo, subido)
    pub(crate) fn bug_paso(&mut self) {
        let Some(a) = &self.ini.pn.bf.app else { return }; if self.ini.pn.bf.form.is_none() { return; }
        let e = a.estado(); if e == self.ini.pn.bf.ult { return; } self.ini.pn.bf.ult = e.clone();
        let p: Vec<&str> = e.split('|').collect(); let mut publicar = false;
        let Some(f) = self.ini.pn.bf.form.as_mut() else { return };
        match p[0] {
            "eligiendo" => f.estado = "Elegí un video del celular…".into(),
            "listo" if p.len() >= 3 => { f.archivo = Some((p[1].to_string(), p[2].parse().unwrap_or(0))); f.media = None; f.estado = String::new(); }
            "grande" => { f.archivo = None; f.estado = "Ese video pasa los 24 MB: grabá uno más corto".into(); }
            "subiendo" => f.estado = format!("Subiendo el video… {}%", p.get(1).unwrap_or(&"0")),
            "subido" if p.len() >= 5 => { f.media = Some(json!({ "id": p[1], "w": p[2].parse::<i64>().unwrap_or(0), "h": p[3].parse::<i64>().unwrap_or(0), "dur": p[4].parse::<f64>().unwrap_or(0.0) })); f.enviando = false; publicar = f.seguir; f.seguir = false; }
            "error" => { f.enviando = false; f.seguir = false; f.estado = p.get(1).map(|x| x.to_string()).unwrap_or_else(|| "No se pudo".into()); }
            _ => {}
        }
        if publicar { self.bug_publicar(); }
    }
    /// el formulario (en lugar de la lista): cada renglón se toca para escribirlo
    pub(crate) fn pn_bug_form(&self, p: &mut Pincel, m: &Pm, cu: [f32; 4], t: f32, z: &mut Vec<([f32; 4], Acc)>) -> f32 {
        let Some(f) = self.ini.pn.bf.form.as_ref() else { return 0.0 }; let u = m.u;
        let x0 = cu[0] + u * 1.4; let w = cu[2] - u * 2.8; let mut y = cu[1] + u;
        let (_, nom, _) = TIPOS[f.tipo.min(2)];
        p.texto(Cara::S7, m.ft * 1.1, x0, y + m.ft * 1.1, TX, 0.03, &format!("Publicar en {nom}")); y += m.ft * 1.6;
        p.texto_max(Cara::S4, m.fs, x0, y + m.fs, PN_T3, 0.0, "Sin cuenta: sólo tu nombre de usuario. Una publicación cada 3 minutos.", w); y += m.fs * 1.8;
        let n = self.en_red.red.nombre.clone();
        let vid = match (&f.archivo, &f.media) { (Some((a, t)), Some(_)) => format!("{a} · {:.1} MB · subido", *t as f64 / 1048576.0), (Some((a, t)), None) => format!("{a} · {:.1} MB", *t as f64 / 1048576.0), _ => "Tocá para elegir un video o una foto (opcional, hasta 24 MB)".into() };
        let filas: [(&str, String, &str, &str, usize); 4] = [
            ("Tu nombre", if nombre_ok(&n) { n } else { "Tocá para ponerte uno".into() }, "nombre", "pj", 1),
            ("Título", if f.titulo.is_empty() { "Tocá para escribirlo".into() } else { f.titulo.clone() }, "titulo", "lapiz", 1),
            ("Descripción", if f.texto.trim().is_empty() { "Qué hiciste, qué pasó, en qué mapa…".into() } else { f.texto.clone() }, "texto", "chat", 4),
            ("Video", vid, "video", "camara", 1),
        ];
        for (k, (et, val, acc, _ic, lineas)) in filas.iter().enumerate() {
            let rs = p.at.renglones(Cara::S4, m.fs, 0.0, val, w - u * 2.0); let nr = rs.len().clamp(1, *lineas);
            let h = u * 0.6 + m.fs * 1.3 + nr as f32 * m.fs * 1.35 + u * 0.6;
            let vacio = match k { 0 => !nombre_ok(&self.en_red.red.nombre), 1 => f.titulo.is_empty(), 2 => f.texto.trim().is_empty(), _ => f.archivo.is_none() };
            p.rect(x0, y, w, h, PN_PL2); p.borde(x0, y, w, h, 1.0, if vacio && k < 2 { con_a(AMA, 0.55) } else { PN_LIN });
            p.texto(Cara::S7, m.fs * 0.9, x0 + u, y + u * 0.6 + m.fs * 0.9, PN_T3, 0.04, et);
            let mut yy = y + u * 0.6 + m.fs * 1.3;
            for (i, r) in rs.iter().take(nr).enumerate() { let r = if i + 1 == nr && rs.len() > nr { format!("{r}…") } else { r.clone() }; p.texto(Cara::S4, m.fs, x0 + u, yy + m.fs, if vacio { PN_T3 } else { TX }, 0.0, &r); yy += m.fs * 1.35; }
            zona(p, z, [x0, y, w, h], Acc::Bug(acc.to_string()));
            if k == 3 && f.archivo.is_some() && !f.enviando { let wq = p.at.ancho(Cara::S7, m.fs, 0.03, "Sacar") + u * 2.0; let r = [x0 + w - wq - u * 0.5, y + u * 0.5, wq, m.fs * 1.8];
                p.rect(r[0], r[1], r[2], r[3], rgba(0x3a1c1c, 0.9)); p.texto_c(Cara::S7, m.fs, r[0] + r[2] / 2.0, r[1] + m.fs * 1.25, rgba(0xff8a8a, 1.0), 0.03, "Sacar"); zona(p, z, r, Acc::Bug("sacar".into())); }
            y += h + u * 0.5;
        }
        if !f.estado.is_empty() { let pulso = if f.enviando { 0.7 + 0.3 * (t * 6.0).sin() } else { 1.0 }; p.texto_max(Cara::S4, m.ft, x0, y + m.ft * 1.1, con_a(AMA, pulso), 0.0, &f.estado, w); y += m.ft * 1.8; }
        y - cu[1]
    }
}
