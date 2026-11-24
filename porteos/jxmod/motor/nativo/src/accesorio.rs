//! El accesorio importado para la cabeza (accesorios.js), hijo de personajes.rs: un GLB, GLTF u OBJ (con sus texturas, o
//! el .zip tal cual lo baja Sketchfab) se lee, se centra y se lleva al tamaño de una cabeza (0,3 m de lado), se empaca en
//! el formato de los personajes importados de la web (JXPJ en gzip: JXPZ) y su id es la huella del paquete (pjiHuella: el
//! mismo modelo, el mismo id en todos lados). Queda puesto en la cabeza, además del gorro, con barras para el tamaño, la
//! altura, adelante/atrás, los costados y los tres giros. En la nativa los archivos se dejan en la carpeta «accesorios» de
//! la app (no hay un selector de archivos sin Java); en la sala los demás lo bajan del que lo tiene puesto, de a pedazos.
use super::*;
use std::io::{Read, Write};

/// el lado más largo del accesorio, de entrada (una cabeza), y lo más que se acepta
pub const ACC_LADO: f32 = 0.3; pub const ACC_TRIS: usize = 150_000; pub const PJI_TOT: usize = 8_000_000;
/// el ajuste (accLimpio): tamaño ×0,2–4; corrido en cm; giros en grados
#[derive(Clone, Debug, PartialEq)]
pub struct AccAj { pub id: String, pub s: f32, pub x: f32, pub y: f32, pub z: f32, pub rx: f32, pub ry: f32, pub rz: f32 }
impl AccAj {
    pub fn limpio(a: &Value) -> Option<AccAj> {
        let id = a["id"].as_str()?; if !(6..=40).contains(&id.len()) || !id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_') { return None; }
        let n = |v: &Value, lo: f32, hi: f32, d: f32| v.as_f64().filter(|x| x.is_finite()).map(|x| (x as f32).max(lo).min(hi)).unwrap_or(d);
        Some(AccAj { id: id.into(), s: n(&a["s"], 0.2, 4.0, 1.0), x: n(&a["x"], -40.0, 40.0, 0.0), y: n(&a["y"], -40.0, 60.0, 10.0), z: n(&a["z"], -40.0, 40.0, 0.0), rx: n(&a["rx"], -180.0, 180.0, 0.0), ry: n(&a["ry"], -180.0, 180.0, 0.0), rz: n(&a["rz"], -180.0, 180.0, 0.0) })
    }
    pub fn json(&self) -> Value { json!({ "id": self.id, "s": self.s, "x": self.x, "y": self.y, "z": self.z, "rx": self.rx, "ry": self.ry, "rz": self.rz }) }
    /// la matriz con la cabeza (el marco de la cabeza sin la escala del modelo, por el tamaño del personaje) en `h`
    pub fn matriz(&self, w: &M4, tam: f32) -> M4 {
        let n = |o: usize| { let l = (w[o] * w[o] + w[o + 1] * w[o + 1] + w[o + 2] * w[o + 2]).sqrt(); if l > 0.0 { l } else { 1.0 } }; let (ex, ey, ez) = (n(0), n(4), n(8));
        let h = [w[0] / ex * tam, w[1] / ex * tam, w[2] / ex * tam, 0.0, w[4] / ey * tam, w[5] / ey * tam, w[6] / ey * tam, 0.0, w[8] / ez * tam, w[9] / ez * tam, w[10] / ez * tam, 0.0, w[12], w[13], w[14], 1.0];
        let r = std::f32::consts::PI / 180.0; let q = jugabilidad::qmul(jugabilidad::qmul(jugabilidad::qeje([0.0, 1.0, 0.0], self.ry * r), jugabilidad::qeje([1.0, 0.0, 0.0], self.rx * r)), jugabilidad::qeje([0.0, 0.0, 1.0], self.rz * r));
        m4::mul(&h, &mapa::trs([self.x / 100.0, self.y / 100.0, self.z / 100.0], q, [self.s; 3]))
    }
}
/// las barras (ACC_BARRAS): clave, nombre, desde, hasta, paso, unidad
pub const BARRAS: [(&str, &str, f32, f32, f32, &str); 7] = [("s", "Tamaño", 20.0, 400.0, 5.0, "%"), ("y", "Arriba / abajo", -40.0, 60.0, 1.0, " cm"), ("z", "Adelante / atrás", -40.0, 40.0, 1.0, " cm"), ("x", "A los costados", -40.0, 40.0, 1.0, " cm"),
    ("ry", "Girar", -180.0, 180.0, 5.0, "°"), ("rx", "Inclinar", -180.0, 180.0, 5.0, "°"), ("rz", "Ladear", -180.0, 180.0, 5.0, "°")];
fn valor(a: &AccAj, k: usize) -> f32 { match k { 0 => (a.s * 100.0).round(), 1 => a.y, 2 => a.z, 3 => a.x, 4 => a.ry, 5 => a.rx, _ => a.rz } }
/// lo que muestra una barra: el nombre, dónde está (0–1) y el valor
pub fn barra_info(a: &AccAj, k: usize) -> (&'static str, f32, String) { let (_, n, lo, hi, _, u) = BARRAS[k]; let v = valor(a, k); (n, (v - lo) / (hi - lo), format!("{}{u}", v.round())) }

/// un accesorio guardado (su meta: id, nombre, triángulos, cuándo)
#[derive(Clone, Debug)]
pub struct Meta { pub id: String, pub n: String, pub tris: usize, pub fecha: u64 }
/// uno listo para dibujar: sus partes (malla, tramo, material) y la esfera
pub struct Malla3 { pub partes: Vec<(i64, u32, u32, i64)>, pub esf: [f32; 4] }
#[derive(Default)]
pub struct Accs {
    pub lista: Vec<Meta>, packs: HashMap<String, Vec<u8>>, mallas: HashMap<String, Option<Malla3>>, sig: i64,
    /// los archivos que hay para importar (nombre, ruta) y si se muestran; lo que dice el estado
    pub archivos: Vec<(String, std::path::PathBuf)>, pub ver_archivos: bool, pub estado: String,
    /// la red: los que pedí (cuándo y cuántas veces), los pedazos que llegan, lo que mando (pedazos pendientes)
    pidiendo: HashMap<String, (f32, u32)>, partes: HashMap<String, (usize, Vec<Option<String>>, f32)>, enviando: Vec<(String, Vec<String>, usize, f32)>, pub t: f32,
}

impl Juego {
    fn acc_dir(&self) -> Option<std::path::PathBuf> { self.datos.as_ref().map(|d| d.join("accesorios")) }
    /// la carpeta donde se dejan los archivos para importar: la de la app (Android/data/…/files/accesorios) o la de datos
    fn acc_dir_importar(&self) -> Vec<std::path::PathBuf> {
        let mut v = vec![]; if let Some(c) = &self.gmod.carpeta_externa { if let Some(p) = c.parent() { v.push(p.join("accesorios")); } }
        if let Some(d) = &self.datos { v.push(d.join("importar")); } v
    }
    pub(crate) fn acc_iniciar(&mut self) {
        let Some(d) = self.acc_dir() else { return };
        let t = std::fs::read_to_string(d.join("lista.json")).unwrap_or_default(); let v: Value = serde_json::from_str(&t).unwrap_or(Value::Null);
        self.pjs.acc.lista = v.as_array().map(|a| a.iter().filter_map(|x| Some(Meta { id: x["id"].as_str()?.into(), n: x["n"].as_str().unwrap_or("Accesorio").into(), tris: x["tris"].as_u64().unwrap_or(0) as usize, fecha: x["fecha"].as_u64().unwrap_or(0) })).collect()).unwrap_or_default();
        self.pjs.acc.lista.sort_by_key(|m| m.fecha);
        if self.pjs.prefs.acc.as_ref().map(|a| !self.pjs.acc.lista.iter().any(|m| m.id == a.id) && !d.join(format!("{}.pk", a.id)).exists()).unwrap_or(false) { self.pjs.prefs.acc = None; }
    }
    fn acc_guardar_lista(&self) {
        let Some(d) = self.acc_dir() else { return }; let _ = std::fs::create_dir_all(&d);
        let v: Vec<Value> = self.pjs.acc.lista.iter().map(|m| json!({ "id": m.id, "n": m.n, "tris": m.tris, "fecha": m.fecha })).collect();
        let _ = std::fs::write(d.join("lista.json"), Value::from(v).to_string());
    }
    pub(crate) fn acc_limpiar(&mut self) { self.pjs.acc.mallas.clear(); }
    /// accPaquete: el paquete de un accesorio (en la memoria o en la carpeta)
    fn acc_paquete(&mut self, id: &str) -> Option<Vec<u8>> {
        if let Some(b) = self.pjs.acc.packs.get(id) { return Some(b.clone()); }
        let b = std::fs::read(self.acc_dir()?.join(format!("{id}.pk"))).ok()?; self.pjs.acc.packs.insert(id.into(), b.clone()); Some(b)
    }
    /// «Importar accesorio»: muestra los archivos que hay en la carpeta (o cómo dejarlos ahí)
    pub fn acc_importar_boton(&mut self) {
        let mut v = vec![];
        for d in self.acc_dir_importar() { if let Ok(r) = std::fs::read_dir(&d) { for e in r.flatten() { let n = e.file_name().to_string_lossy().to_string(); let l = n.to_lowercase(); if l.ends_with(".glb") || l.ends_with(".gltf") || l.ends_with(".obj") || l.ends_with(".zip") || l.ends_with(".vrm") { v.push((n, e.path())); } } } }
        v.sort(); self.pjs.acc.ver_archivos = !v.is_empty(); self.pjs.acc.archivos = v;
        if self.pjs.acc.archivos.is_empty() { let d = self.acc_dir_importar().first().map(|p| p.display().to_string()).unwrap_or_default(); self.pjs.acc.estado = format!("Dejá el .glb, .gltf, .obj o el .zip de Sketchfab en {d} y tocá de nuevo"); }
        else { self.pjs.acc.estado = "Elegí cuál importar".into(); }
    }
    /// accImportar: lee el archivo (y lo de al lado: .bin, .mtl, texturas), lo centra, lo achica a una cabeza y lo guarda
    pub fn acc_importar(&mut self, k: usize) {
        let Some((n, ruta)) = self.pjs.acc.archivos.get(k).cloned() else { return }; self.pjs.acc.ver_archivos = false;
        self.pjs.acc.estado = "Leyendo…".into();
        match importar(&ruta) {
            Ok((meta, pack)) => {
                if let Some(d) = self.acc_dir() { let _ = std::fs::create_dir_all(&d); let _ = std::fs::write(d.join(format!("{}.pk", meta.id)), &pack); }
                self.pjs.acc.packs.insert(meta.id.clone(), pack); self.pjs.acc.lista.retain(|m| m.id != meta.id); self.pjs.acc.lista.push(meta.clone()); self.acc_guardar_lista();
                self.pjs.prefs.acc = AccAj::limpio(&json!({ "id": meta.id })); self.pjs_guardar(); self.pjs.acc.estado = format!("{}: {} triángulos", meta.n, meta.tris);
            }
            Err(e) => { self.pjs.acc.estado = format!("{n}: {e}"); }
        }
    }
    pub(crate) fn acc_poner(&mut self, k: usize) { let Some(m) = self.pjs.acc.lista.get(k) else { return }; let id = m.id.clone(); let mut a = self.pjs.prefs.acc.clone().filter(|a| a.id == id).map(|a| a.json()).unwrap_or(json!({})); a["id"] = json!(id); self.pjs.prefs.acc = AccAj::limpio(&a); self.pjs_guardar(); }
    pub(crate) fn acc_borrar(&mut self, k: usize) {
        let Some(m) = self.pjs.acc.lista.get(k).cloned() else { return }; self.pjs.acc.lista.remove(k); self.pjs.acc.packs.remove(&m.id); self.pjs.acc.mallas.remove(&m.id);
        if self.pjs.prefs.acc.as_ref().map(|a| a.id == m.id).unwrap_or(false) { self.pjs.prefs.acc = None; self.pjs_guardar(); }
        if let Some(d) = self.acc_dir() { let _ = std::fs::remove_file(d.join(format!("{}.pk", m.id))); } self.acc_guardar_lista();
    }
    pub(crate) fn acc_barra(&mut self, k: usize, f: f32) {
        let Some(a) = self.pjs.prefs.acc.as_mut() else { return }; let (_, _, lo, hi, paso, _) = BARRAS[k]; let v = ((lo + f * (hi - lo)) / paso).round() * paso;
        match k { 0 => a.s = v / 100.0, 1 => a.y = v, 2 => a.z = v, 3 => a.x = v, 4 => a.ry = v, 5 => a.rx = v, _ => a.rz = v }
        self.pjs.prefs.acc = AccAj::limpio(&a.json());
    }
    /// cada cuadro: los modelos que hacen falta (el mío y los de los demás) y lo que se manda por la red
    pub(super) unsafe fn acc_cuadro(&mut self, m: &mut Motor3d, dt: f32) {
        self.pjs.acc.t += dt;
        let mut quiero: Vec<(String, Option<String>)> = vec![]; if let Some(a) = &self.pjs.prefs.acc { quiero.push((a.id.clone(), None)); }
        for r in self.en_red.red.remotos() { if let Some(a) = AccAj::limpio(&r.acc) { quiero.push((a.id, Some(r.id.clone()))); } }
        for (id, de) in quiero {
            if self.pjs.acc.mallas.contains_key(&id) { continue; }
            match self.acc_paquete(&id) {
                Some(b) => { let r = self.acc_armar(m, &id, &b); self.pjs.acc.mallas.insert(id, r); }
                None => if let Some(de) = de { self.acc_pedir(&id, &de); },
            }
        }
        // (lo que mando: un pedazo cada 0,125 s)
        let t = self.pjs.acc.t;
        if let Some(e) = self.pjs.acc.enviando.first_mut() { if t >= e.3 && self.en_red.en_sala() { let (id, l, x) = (e.0.clone(), e.1.clone(), e.2); e.2 += 1; e.3 = t + 0.125;
            self.en_red.red.publicar("a", &json!({ "k": "acd", "g": id, "x": x, "n": l.len(), "d": l[x] }).to_string(), false);
            if x + 1 >= l.len() { self.pjs.acc.enviando.remove(0); } } }
    }
    /// accMalla: el modelo listo para dibujar (una parte por material)
    unsafe fn acc_armar(&mut self, m: &mut Motor3d, id: &str, b: &[u8]) -> Option<Malla3> {
        let u = desempacar(b).ok()?; self.pjs.acc.sig += 1; let k = self.pjs.acc.sig;
        let base = ID_ACC - 1000 * k; let mut datos = vec![]; let (mut mallas, mut mats, mut texs) = (vec![], vec![], vec![]);
        for (i, img) in u.imgs.iter().enumerate() { if let Some((w, h, px)) = img { let o = datos.len(); datos.extend_from_slice(px); while datos.len() % 4 != 0 { datos.push(0); } texs.push(Tex { id: base - 500 - i as i64, n: format!("acc{i}"), w: *w, h: *h, a: 1, o }); } }
        let mut partes = vec![];
        for (gi, g) in u.grupos.iter().enumerate() {
            let mut re: HashMap<u32, u32> = HashMap::new(); let mut geo = Geo::nueva(); geo.parte();
            for &v in &g.1 { let j = *re.entry(v).or_insert_with(|| { let i = v as usize; geo.p.extend([u.pos[i * 3] as f64, u.pos[i * 3 + 1] as f64, u.pos[i * 3 + 2] as f64]); geo.n.extend([u.nor[i * 3] as f64, u.nor[i * 3 + 1] as f64, u.nor[i * 3 + 2] as f64]); geo.u.extend([u.uv[i * 2] as f64, u.uv[i * 2 + 1] as f64]); (geo.nv() - 1) as u32 }); geo.s[0].push(j); }
            if geo.s[0].is_empty() { continue; }
            let ml = geo.malla(base - gi as i64, &mut datos); let mt = &u.mats[g.0.min(u.mats.len().saturating_sub(1))];
            let tex = if mt.img >= 0 && u.imgs.get(mt.img as usize).map(|x| x.is_some()).unwrap_or(false) { base - 500 - mt.img as i64 } else { -1 };
            let blend = mt.alfa == "blend" || mt.c[3] < 0.99; let cut = !blend && mt.alfa == "cut";
            mats.push(Mat { ti: [0.0; 12], pbr: [0.85, 0.0, 0.04], fol: 0, id: base - 300 - gi as i64, t2: -1, terr: None, c: mt.c, st: [1.0, 1.0, 0.0, 0.0], t: tex, blend: blend as u8, cut: cut as u8, unlit: 0, add: 0, agua: 0, em: [0.0; 3] });
            partes.push((ml.id, 0u32, ml.ni, base - 300 - gi as i64)); mallas.push(ml);
        }
        if partes.is_empty() { return None; }
        let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas, mats, texs, lms: vec![], items: vec![], agua: None, cielo: None };
        if m.cargar(&Escena { c: cab, datos }).is_err() { return None; }
        let _ = id; Some(Malla3 { partes, esf: [0.0, 0.0, 0.0, ACC_LADO * 0.9] })
    }
    /// accDibujar: pegado al hueso de la cabeza, con el ajuste (el mío; el de cada uno de los demás); en primera persona no
    pub(crate) fn acc_items(&self, quien: Option<&str>, pj: &Personaje, cab: &M4, items: &mut Vec<ItemDin>) {
        let a = match quien { None => self.pjs.prefs.acc.clone(), Some(r) => self.en_red.red.remotos().iter().find(|x| x.id == r).and_then(|x| AccAj::limpio(&x.acc)) };
        let Some(a) = a else { return }; let Some(Some(g)) = self.pjs.acc.mallas.get(&a.id) else { return };
        let mm = a.matriz(cab, pj.tam); let c = [mm[12], mm[13], mm[14]]; let e = a.s * pj.tam;
        for &(ml, s0, sn, mat) in &g.partes { items.push(ItemDin { m: ml, s0, sn, mat, mm, esf: [c[0], c[1], c[2], g.esf[3] * e], fl: 0, h: vec![] }); }
    }
    /// accPedir: lo pido al que lo tiene puesto (cada 12 s, hasta 6 veces)
    fn acc_pedir(&mut self, id: &str, de: &str) {
        let t = self.pjs.acc.t; let p = self.pjs.acc.pidiendo.entry(id.to_string()).or_insert((-1e9, 0)); if t - p.0 < 12.0 || p.1 >= 6 { return; }
        p.0 = t; p.1 += 1; if self.en_red.en_sala() { self.en_red.red.publicar("a", &json!({ "k": "acq", "g": id, "to": de.chars().take(20).collect::<String>() }).to_string(), false); }
    }
    /// accRed: me lo piden (si es mío lo mando de a pedazos de 24 000 letras en base64) o llegan los pedazos de uno
    pub(crate) fn acc_red(&mut self, _de: &str, d: &Value) {
        let Some(g) = d["g"].as_str().filter(|g| (6..=40).contains(&g.len()) && g.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')).map(String::from) else { return };
        let k = d["k"].as_str().unwrap_or("");
        if k == "acq" {
            let para = d["to"].as_str().unwrap_or(""); if !para.is_empty() && para != self.en_red.red.id { return; }
            if !self.pjs.acc.lista.iter().any(|m| m.id == g) || self.pjs.acc.enviando.iter().any(|e| e.0 == g) { return; }
            let Some(b) = self.acc_paquete(&g) else { return }; if b.len() > PJI_TOT { return; }
            let s = b64(&b); let l: Vec<String> = s.as_bytes().chunks(24000).map(|c| String::from_utf8_lossy(c).into_owned()).collect();
            self.pjs.acc.enviando.push((g, l, 0, self.pjs.acc.t)); return;
        }
        if k != "acd" || self.pjs.acc.packs.contains_key(&g) { return; }
        let (n, i) = (d["n"].as_i64().unwrap_or(0), d["x"].as_i64().unwrap_or(-1)); let Some(txt) = d["d"].as_str() else { return };
        if n < 1 || n > 460 || i < 0 || i >= n || txt.len() > 24000 { return; }
        let t = self.pjs.acc.t; let e = self.pjs.acc.partes.entry(g.clone()).or_insert((n as usize, vec![None; n as usize], t));
        if e.0 != n as usize || t - e.2 > 90.0 { *e = (n as usize, vec![None; n as usize], t); }
        if e.1[i as usize].is_none() { e.1[i as usize] = Some(txt.to_string()); }
        if e.1.iter().any(|x| x.is_none()) { return; }
        let todo: String = e.1.iter().flatten().cloned().collect(); self.pjs.acc.partes.remove(&g);
        let Some(b) = jxjuego::personaje::base64(&todo) else { return };
        if huella(&b) != g { return; }   // (lo que llegó tiene que ser ese accesorio)
        self.pjs.acc.packs.insert(g.clone(), b); self.pjs.acc.mallas.remove(&g);
    }
}

// ---------------- el paquete (pjiEmpacar / pjiDesempacar / pjiHuella) ----------------
/// pjiHuella: el id (dos FNV de 32 bits y el largo, en base 36)
pub fn huella(b: &[u8]) -> String {
    let (mut h1, mut h2) = (2166136261u32, 0x9e3779b9u32);
    for &x in b { h1 = (h1 ^ x as u32).wrapping_mul(16777619); h2 = (h2 ^ x as u32).wrapping_mul(2246822519); }
    format!("u{}{}{}", b36(h1 as u64), b36(h2 as u64), b36(b.len() as u64))
}
fn b36(mut v: u64) -> String { if v == 0 { return "0".into(); } let mut s = vec![]; while v > 0 { s.push(b"0123456789abcdefghijklmnopqrstuvwxyz"[(v % 36) as usize]); v /= 36; } s.reverse(); String::from_utf8(s).unwrap() }
pub fn b64(b: &[u8]) -> String {
    const A: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; let mut o = String::with_capacity(b.len() * 4 / 3 + 4);
    for c in b.chunks(3) { let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        o.push(A[(n >> 18) as usize & 63] as char); o.push(A[(n >> 12) as usize & 63] as char); o.push(if c.len() > 1 { A[(n >> 6) as usize & 63] as char } else { '=' }); o.push(if c.len() > 2 { A[n as usize & 63] as char } else { '=' }); }
    o
}
/// un material de lo importado: color, imagen, alfa («op», «cut», «blend»), doble cara
#[derive(Clone, Debug)]
pub struct MatI { pub c: [f32; 4], pub img: i32, pub alfa: String, pub dos: bool }
/// lo crudo de un modelo: posiciones, normales, UV (con el origen arriba), grupos (material, triángulos), materiales e imágenes
pub struct Crudo { pub pos: Vec<f32>, pub nor: Vec<f32>, pub uv: Vec<f32>, pub grupos: Vec<(usize, Vec<u32>)>, pub mats: Vec<MatI>, pub imgs: Vec<Option<(u32, u32, Vec<u8>)>>, pub img_bytes: Vec<Option<(String, Vec<u8>)>>, pub nombre: String }
fn al(x: usize) -> usize { (x + 3) & !3 }
/// pjiEmpacar (un solo «hueso», la cabeza) y gzip (JXPZ)
pub fn empacar(c: &Crudo) -> Vec<u8> {
    let n = c.pos.len() / 3; let (mut mn, mut mx) = ([f32::INFINITY; 3], [f32::NEG_INFINITY; 3]);
    for i in 0..n { for k in 0..3 { let v = c.pos[i * 3 + k]; mn[k] = mn[k].min(v); mx[k] = mx[k].max(v); } }
    let sc = [0, 1, 2].map(|k| (mx[k] - mn[k]).max(1e-6)); let ni: usize = c.grupos.iter().map(|g| g.1.len()).sum(); let i32_ = n > 65535;
    let imgs: Vec<Value> = c.img_bytes.iter().map(|x| x.as_ref().map(|(m, b)| json!({ "mime": m, "len": b.len() })).unwrap_or(Value::Null)).collect();
    let r4 = |x: f32| (x as f64 * 10000.0).round() / 10000.0;
    let j = json!({ "v": 1, "n": c.nombre.chars().take(24).collect::<String>(), "alto": ACC_LADO, "nv": n, "mn": mn, "sc": sc, "i32": i32_, "grupos": c.grupos.iter().map(|g| json!({ "mat": g.0, "n": g.1.len() })).collect::<Vec<_>>(),
        "mats": c.mats.iter().map(|m| json!({ "c": m.c.iter().map(|x| r4(*x)).collect::<Vec<_>>(), "img": if m.img >= 0 && c.img_bytes.get(m.img as usize).map(|x| x.is_some()).unwrap_or(false) { m.img } else { -1 }, "alfa": m.alfa, "dos": m.dos })).collect::<Vec<_>>(),
        "imgs": imgs, "huesos": [{ "n": "Head", "pa": -1, "p": [0, 0, 0], "q": [0, 0, 0, 1], "mix": null }], "puntas": {}, "propio": true, "pts": null,
        "fecha": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0) }).to_string().into_bytes();
    let mut l = al(9 + j.len()); let op = l; l = al(l + n * 6); let on = l; l = al(l + n * 3); let ou = l; l = al(l + n * 4); let ohb = l; l = al(l + n * 3); let ohw = l; l = al(l + n * 2); let oix = l; l = al(l + ni * if i32_ { 4 } else { 2 });
    let oimg = l; for x in c.img_bytes.iter().flatten() { l += x.1.len(); }
    let mut b = vec![0u8; l]; b[..5].copy_from_slice(&[74, 88, 80, 74, 1]); b[5..9].copy_from_slice(&(j.len() as u32).to_le_bytes()); b[9..9 + j.len()].copy_from_slice(&j);
    for i in 0..n { for k in 0..3 { let q = ((c.pos[i * 3 + k] - mn[k]) / sc[k] * 65535.0 + 0.5).floor().clamp(0.0, 65535.0) as u16; b[op + (i * 3 + k) * 2..op + (i * 3 + k) * 2 + 2].copy_from_slice(&q.to_le_bytes()); } }
    for i in 0..n * 3 { b[on + i] = ((c.nor[i] * 127.0 + 0.5).floor().clamp(-127.0, 127.0)) as i8 as u8; }
    for i in 0..n * 2 { b[ou + i * 2..ou + i * 2 + 2].copy_from_slice(&jxjuego::geo::f2h(c.uv[i]).to_le_bytes()); }
    for i in 0..n { b[ohw + i * 2] = 255; let _ = ohb; }
    let mut q = oix; for g in &c.grupos { for &t in &g.1 { if i32_ { b[q..q + 4].copy_from_slice(&t.to_le_bytes()); q += 4; } else { b[q..q + 2].copy_from_slice(&(t as u16).to_le_bytes()); q += 2; } } }
    let mut q = oimg; for x in c.img_bytes.iter().flatten() { b[q..q + x.1.len()].copy_from_slice(&x.1); q += x.1.len(); }
    let mut z = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default()); let _ = z.write_all(&b); let z = z.finish().unwrap_or_default();
    let mut o = vec![74, 88, 80, 90]; o.extend(z); o
}
/// lo de un paquete, listo para armar el modelo: posiciones, normales, UV, grupos, materiales e imágenes decodificadas
pub struct Desempacado { pub pos: Vec<f32>, pub nor: Vec<f32>, pub uv: Vec<f32>, pub grupos: Vec<(usize, Vec<u32>)>, pub mats: Vec<MatI>, pub imgs: Vec<Option<(u32, u32, Vec<u8>)>> }
pub fn desempacar(b0: &[u8]) -> Result<Desempacado, String> {
    let b = if b0.starts_with(&[74, 88, 80, 90]) { let mut o = vec![]; flate2::read::GzDecoder::new(&b0[4..]).read_to_end(&mut o).map_err(|e| e.to_string())?; o } else { b0.to_vec() };
    if b.len() < 9 || b[..5] != [74, 88, 80, 74, 1] || b.len() > PJI_TOT * 2 { return Err("formato".into()); }
    let jl = u32::from_le_bytes([b[5], b[6], b[7], b[8]]) as usize; let j: Value = serde_json::from_slice(b.get(9..9 + jl).ok_or("formato")?).map_err(|e| e.to_string())?;
    let n = j["nv"].as_u64().unwrap_or(0) as usize; let ni: usize = j["grupos"].as_array().map(|a| a.iter().map(|g| g["n"].as_u64().unwrap_or(0) as usize).sum()).unwrap_or(0); let i32_ = j["i32"].as_bool().unwrap_or(false);
    if n == 0 || n > 300_000 || ni == 0 || ni > 1_800_000 || ni % 3 != 0 { return Err("formato".into()); }
    let mut l = al(9 + jl); let op = l; l = al(l + n * 6); let on = l; l = al(l + n * 3); let ou = l; l = al(l + n * 4); l = al(l + n * 3); l = al(l + n * 2); let oix = l; l = al(l + ni * if i32_ { 4 } else { 2 }); let oimg = l;
    if l > b.len() { return Err("formato".into()); }
    let f = |v: &Value, k: usize| v[k].as_f64().unwrap_or(0.0) as f32; let (mn, sc) = (&j["mn"], &j["sc"]);
    let mut pos = vec![0f32; n * 3]; for i in 0..n { for k in 0..3 { let q = u16::from_le_bytes([b[op + (i * 3 + k) * 2], b[op + (i * 3 + k) * 2 + 1]]); pos[i * 3 + k] = f(mn, k) + q as f32 / 65535.0 * f(sc, k); } }
    let nor: Vec<f32> = (0..n * 3).map(|i| b[on + i] as i8 as f32 / 127.0).collect();
    let uv: Vec<f32> = (0..n * 2).map(|i| jxjuego::geo::h2f(u16::from_le_bytes([b[ou + i * 2], b[ou + i * 2 + 1]]))).collect();
    let mats: Vec<MatI> = j["mats"].as_array().map(|a| a.iter().map(|m| MatI { c: [f(&m["c"], 0), f(&m["c"], 1), f(&m["c"], 2), m["c"][3].as_f64().unwrap_or(1.0) as f32], img: m["img"].as_i64().unwrap_or(-1) as i32, alfa: m["alfa"].as_str().unwrap_or("op").into(), dos: m["dos"].as_bool().unwrap_or(false) }).collect()).unwrap_or_default();
    let mut q = oix; let mut grupos = vec![];
    for g in j["grupos"].as_array().into_iter().flatten() { let gn = g["n"].as_u64().unwrap_or(0) as usize; let mut t = Vec::with_capacity(gn);
        for _ in 0..gn { let v = if i32_ { let v = u32::from_le_bytes([b[q], b[q + 1], b[q + 2], b[q + 3]]); q += 4; v } else { let v = u16::from_le_bytes([b[q], b[q + 1]]) as u32; q += 2; v }; t.push(if (v as usize) < n { v } else { 0 }); }
        grupos.push(((g["mat"].as_i64().unwrap_or(0).max(0) as usize).min(mats.len().saturating_sub(1)), t)); }
    let mut q = oimg; let mut imgs = vec![];
    for x in j["imgs"].as_array().into_iter().flatten() { if x.is_null() { imgs.push(None); continue; } let len = x["len"].as_u64().unwrap_or(0) as usize; let by = b.get(q..q + len).unwrap_or(&[]); q += len; imgs.push(decodificar(by, x["mime"].as_str().unwrap_or(""), 1024)); }
    Ok(Desempacado { pos, nor, uv, grupos, mats, imgs })
}
/// una imagen (PNG o WebP; las JPEG no: no hay con qué decodificarlas sin otra biblioteca) a RGBA, hasta `max` de lado
pub fn decodificar(b: &[u8], _mime: &str, max: u32) -> Option<(u32, u32, Vec<u8>)> {
    let (w, h, mut px) = if b.starts_with(&[0x89, b'P', b'N', b'G']) {
        let mut dec = png::Decoder::new(std::io::Cursor::new(b)); dec.set_transformations(png::Transformations::EXPAND | png::Transformations::STRIP_16); let mut r = dec.read_info().ok()?;
        let mut buf = vec![0; r.output_buffer_size()]; let i = r.next_frame(&mut buf).ok()?; buf.truncate(i.buffer_size());
        let px: Vec<u8> = match i.color_type { png::ColorType::Rgba => buf, png::ColorType::Rgb => buf.chunks_exact(3).flat_map(|c| [c[0], c[1], c[2], 255]).collect(), png::ColorType::GrayscaleAlpha => buf.chunks_exact(2).flat_map(|c| [c[0], c[0], c[0], c[1]]).collect(), png::ColorType::Grayscale => buf.iter().flat_map(|&c| [c, c, c, 255]).collect(), _ => return None };
        (i.width, i.height, px)
    } else if b.len() > 12 && &b[0..4] == b"RIFF" && &b[8..12] == b"WEBP" {
        jxjuego::geo::webp_rgba(b)?
    } else { return None };
    let (mut w, mut h) = (w, h); while w.max(h) > max { let (nw, nh) = ((w / 2).max(1), (h / 2).max(1)); px = jxjuego::paquete::mitad(&px, w, h, nw, nh); w = nw; h = nh; }
    Some((w, h, px))
}
/// pjiNormales: las normales de las caras sumadas en cada vértice
fn normales(p: &[f32], grupos: &[(usize, Vec<u32>)]) -> Vec<f32> {
    let mut n = vec![0f32; p.len()];
    for g in grupos { for t in g.1.chunks_exact(3) { let (a, b, c) = (t[0] as usize * 3, t[1] as usize * 3, t[2] as usize * 3);
        let (ux, uy, uz, vx, vy, vz) = (p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2], p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]);
        let (nx, ny, nz) = (uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); for q in [a, b, c] { n[q] += nx; n[q + 1] += ny; n[q + 2] += nz; } } }
    for i in (0..n.len()).step_by(3) { let l = (n[i] * n[i] + n[i + 1] * n[i + 1] + n[i + 2] * n[i + 2]).sqrt(); let l = if l > 0.0 { l } else { 1.0 }; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
    n
}
/// los archivos: el elegido y los de su carpeta (o lo de adentro del .zip), por nombre en minúsculas
fn archivos(ruta: &std::path::Path) -> Result<(HashMap<String, Vec<u8>>, String), String> {
    let mut a = HashMap::new(); let nom = |s: &str| s.replace('\\', "/").rsplit('/').next().unwrap_or("").to_lowercase();
    let n0 = nom(&ruta.to_string_lossy());
    if n0.ends_with(".zip") { for (k, v) in zip(&std::fs::read(ruta).map_err(|e| e.to_string())?)? { a.insert(nom(&k), v); } }
    else { if let Some(d) = ruta.parent() { if let Ok(r) = std::fs::read_dir(d) { for e in r.flatten() { let k = nom(&e.file_name().to_string_lossy()); if k.ends_with(".glb") || k.ends_with(".gltf") || k.ends_with(".obj") || k.ends_with(".zip") || k.ends_with(".vrm") { continue; } if let Ok(m) = e.metadata() { if m.len() < 20_000_000 { if let Ok(b) = std::fs::read(e.path()) { a.insert(k, b); } } } } } }
        a.insert(n0.clone(), std::fs::read(ruta).map_err(|e| e.to_string())?); }
    let prin = a.keys().filter(|k| k.ends_with(".glb") || k.ends_with(".gltf") || k.ends_with(".vrm")).min().cloned().or_else(|| a.keys().filter(|k| k.ends_with(".obj")).min().cloned()).ok_or("no es un GLB, GLTF ni OBJ")?;
    Ok((a, prin))
}
/// un .zip (los de Sketchfab): lo guardado y lo comprimido con deflate
pub fn zip(b: &[u8]) -> Result<Vec<(String, Vec<u8>)>, String> {
    let le16 = |o: usize| u16::from_le_bytes([b[o], b[o + 1]]) as usize; let le32 = |o: usize| u32::from_le_bytes([b[o], b[o + 1], b[o + 2], b[o + 3]]) as usize;
    let eocd = (0..b.len().saturating_sub(21)).rev().find(|&i| b[i..i + 4] == [0x50, 0x4b, 0x05, 0x06]).ok_or("zip roto")?;
    let (n, mut o) = (le16(eocd + 10), le32(eocd + 16)); let mut out = vec![];
    for _ in 0..n {
        if o + 46 > b.len() || b[o..o + 4] != [0x50, 0x4b, 0x01, 0x02] { break; }
        let (met, csz, nl, xl, cl, lo) = (le16(o + 10), le32(o + 20), le16(o + 28), le16(o + 30), le16(o + 32), le32(o + 42));
        let nombre = String::from_utf8_lossy(&b[o + 46..o + 46 + nl]).to_string(); o += 46 + nl + xl + cl;
        if nombre.ends_with('/') || lo + 30 > b.len() { continue; }
        let ini = lo + 30 + le16(lo + 26) + le16(lo + 28); let Some(d) = b.get(ini..ini + csz) else { continue };
        let datos = match met { 0 => d.to_vec(), 8 => { let mut v = vec![]; if flate2::read::DeflateDecoder::new(d).read_to_end(&mut v).is_err() { continue; } v } _ => continue };
        out.push((nombre, datos));
    }
    Ok(out)
}
/// accImportar: el archivo → el paquete y su meta
pub fn importar(ruta: &std::path::Path) -> Result<(Meta, Vec<u8>), String> {
    let (a, prin) = archivos(ruta)?;
    let mut c = if prin.ends_with(".obj") { leer_obj(&a, &prin)? } else { leer_gltf(&a, &prin)? };
    let n = c.pos.len() / 3; let ni: usize = c.grupos.iter().map(|g| g.1.len()).sum();
    if n == 0 || ni == 0 { return Err("no se pudo leer ese archivo".into()); }
    if ni / 3 > ACC_TRIS { return Err("tiene demasiados triángulos (más de 150 mil): bajá uno más liviano".into()); }
    // centrado en su caja y llevado a ACC_LADO metros de lado
    let (mut mn, mut mx) = ([f32::INFINITY; 3], [f32::NEG_INFINITY; 3]);
    for i in 0..n { for k in 0..3 { mn[k] = mn[k].min(c.pos[i * 3 + k]); mx[k] = mx[k].max(c.pos[i * 3 + k]); } }
    let k = ACC_LADO / (mx[0] - mn[0]).max(mx[1] - mn[1]).max(mx[2] - mn[2]).max(1e-6);
    for i in 0..n { for e in 0..3 { c.pos[i * 3 + e] = (c.pos[i * 3 + e] - (mn[e] + mx[e]) / 2.0) * k; } }
    if c.nor.len() != n * 3 { c.nor = normales(&c.pos, &c.grupos); }
    if c.uv.len() != n * 2 { c.uv = vec![0.0; n * 2]; }
    if c.mats.is_empty() { c.mats.push(MatI { c: [0.8, 0.8, 0.8, 1.0], img: -1, alfa: "op".into(), dos: false }); }
    let pack = empacar(&c); if pack.len() > PJI_TOT { return Err("pesa demasiado (más de 8 MB con las texturas)".into()); }
    let id = huella(&pack);
    Ok((Meta { id, n: c.nombre.chars().take(24).collect(), tris: ni / 3, fecha: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0) }, pack))
}
fn nombre_de(prin: &str) -> String { let s = prin.rsplit_once('.').map(|x| x.0).unwrap_or(prin); let s: String = s.chars().map(|c| if c == '_' || c == '-' || c == '.' { ' ' } else { c }).collect(); let s = s.trim().to_string(); if s.is_empty() { "Accesorio".into() } else { s.chars().take(24).collect() } }
fn mime_de(s: &str) -> String { let l = s.to_lowercase(); if l.ends_with(".png") { "image/png".into() } else if l.ends_with(".jpg") || l.ends_with(".jpeg") { "image/jpeg".into() } else if l.ends_with(".webp") { "image/webp".into() } else { "image/png".into() } }
/// pjiLeerObj (con el .mtl)
fn leer_obj(a: &HashMap<String, Vec<u8>>, prin: &str) -> Result<Crudo, String> {
    let txt = String::from_utf8_lossy(a.get(prin).ok_or("falta el archivo")?).to_string(); let nom = |s: &str| s.replace('\\', "/").rsplit('/').next().unwrap_or("").to_lowercase();
    let (mut v, mut vt, mut vn) = (vec![], vec![], vec![]); let mut mtl: HashMap<String, ([f32; 4], Option<String>)> = HashMap::new();
    for l in txt.lines() { if let Some(f) = l.strip_prefix("mtllib ") { if let Some(b) = a.get(&nom(f.trim())) { let mut cur: Option<String> = None;
        for l0 in String::from_utf8_lossy(b).lines() { let l = l0.trim(); let p: Vec<&str> = l.split_whitespace().collect(); let k = p.first().map(|x| x.to_lowercase()).unwrap_or_default();
            if k == "newmtl" { let n = l[7..].trim().to_string(); mtl.insert(n.clone(), ([0.8, 0.8, 0.8, 1.0], None)); cur = Some(n); continue; }
            let Some(c) = cur.as_ref().and_then(|c| mtl.get_mut(c)) else { continue }; let fv = |i: usize| p.get(i).and_then(|x| x.parse::<f32>().ok()).unwrap_or(0.0);
            match k.as_str() { "kd" => { c.0 = [fv(1), fv(2), fv(3), c.0[3]]; } "d" => c.0[3] = fv(1), "tr" => c.0[3] = 1.0 - fv(1), "map_kd" => c.1 = p.last().map(|x| x.to_string()), _ => {} } } } } }
    let mut mats: Vec<MatI> = vec![]; let mut por_mat: HashMap<String, usize> = HashMap::new(); let mut img_bytes: Vec<Option<(String, Vec<u8>)>> = vec![]; let mut por_img: HashMap<String, i32> = HashMap::new();
    let mut material = |n: &str, mats: &mut Vec<MatI>, img_bytes: &mut Vec<Option<(String, Vec<u8>)>>| -> usize {
        if let Some(&k) = por_mat.get(n) { return k; } let m = mtl.get(n).cloned().unwrap_or(([0.8, 0.8, 0.8, 1.0], None));
        let img = m.1.as_ref().map(|f| { let k = nom(f); *por_img.entry(k.clone()).or_insert_with(|| { match a.get(&k) { Some(b) => { img_bytes.push(Some((mime_de(&k), b.clone()))); img_bytes.len() as i32 - 1 } None => -1 } }) }).unwrap_or(-1);
        mats.push(MatI { c: m.0, img, alfa: if m.0[3] < 0.99 { "blend".into() } else { "op".into() }, dos: false }); por_mat.insert(n.to_string(), mats.len() - 1); mats.len() - 1
    };
    let (mut p, mut nn, mut uu) = (vec![], vec![], vec![]); let mut grupos: Vec<(usize, Vec<u32>)> = vec![]; let mut por_clave: HashMap<String, u32> = HashMap::new();
    let mut mat = material("", &mut mats, &mut img_bytes); let (mut con_nor, mut con_uv) = (true, false);
    let idx = |s: &str, len: usize, k: usize| -> i64 { let i: i64 = s.parse().unwrap_or(1); if i < 0 { (len / k) as i64 + i } else { i - 1 } };
    for l0 in txt.lines() {
        let l = l0.trim(); if l.is_empty() || l.starts_with('#') { continue; } let q: Vec<&str> = l.split_whitespace().collect(); let fv = |i: usize| q.get(i).and_then(|x| x.parse::<f32>().ok()).unwrap_or(0.0);
        match q[0] {
            "v" => v.extend([fv(1), fv(2), fv(3)]), "vt" => vt.extend([fv(1), fv(2)]), "vn" => vn.extend([fv(1), fv(2), fv(3)]),
            "usemtl" => { mat = material(l[7..].trim(), &mut mats, &mut img_bytes); por_clave.clear(); }
            "f" => { let mut vs = vec![];
                for s in &q[1..] { let key = format!("{s}|{mat}"); let i = match por_clave.get(&key) { Some(&i) => i, None => { let r: Vec<&str> = s.split('/').collect(); let ai = idx(r[0], v.len(), 3).max(0) as usize;
                    let i = (p.len() / 3) as u32; p.extend([*v.get(ai * 3).unwrap_or(&0.0), *v.get(ai * 3 + 1).unwrap_or(&0.0), *v.get(ai * 3 + 2).unwrap_or(&0.0)]);
                    match r.get(2).filter(|x| !x.is_empty()) { Some(x) => { let k = idx(x, vn.len(), 3).max(0) as usize; nn.extend([*vn.get(k * 3).unwrap_or(&0.0), *vn.get(k * 3 + 1).unwrap_or(&0.0), *vn.get(k * 3 + 2).unwrap_or(&0.0)]); } None => { nn.extend([0.0; 3]); con_nor = false; } }
                    match r.get(1).filter(|x| !x.is_empty()) { Some(x) => { let k = idx(x, vt.len(), 2).max(0) as usize; uu.extend([*vt.get(k * 2).unwrap_or(&0.0), 1.0 - *vt.get(k * 2 + 1).unwrap_or(&0.0)]); con_uv = true; } None => uu.extend([0.0, 0.0]) }
                    por_clave.insert(key, i); i } }; vs.push(i); }
                let g = match grupos.iter_mut().find(|g| g.0 == mat) { Some(g) => g, None => { grupos.push((mat, vec![])); grupos.last_mut().unwrap() } };
                for k in 1..vs.len().saturating_sub(1) { g.1.extend([vs[0], vs[k], vs[k + 1]]); } }
            _ => {}
        }
    }
    grupos.retain(|g| !g.1.is_empty());
    let imgs = img_bytes.iter().map(|x| x.as_ref().and_then(|(m, b)| decodificar(b, m, 1024))).collect();
    Ok(Crudo { nor: if con_nor { nn } else { vec![] }, uv: if con_uv { uu } else { vec![] }, pos: p, grupos, mats, imgs, img_bytes, nombre: nombre_de(prin) })
}
fn mmul(a: &[f64; 16], b: &[f64; 16]) -> [f64; 16] { let mut o = [0f64; 16]; for c in 0..4 { for r in 0..4 { o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; } } o }
fn mtrs(t: [f64; 3], q: [f64; 4], s: [f64; 3]) -> [f64; 16] { let [x, y, z, w] = q; [(1.0 - 2.0 * (y * y + z * z)) * s[0], 2.0 * (x * y + z * w) * s[0], 2.0 * (x * z - y * w) * s[0], 0.0, 2.0 * (x * y - z * w) * s[1], (1.0 - 2.0 * (x * x + z * z)) * s[1], 2.0 * (y * z + x * w) * s[1], 0.0, 2.0 * (x * z + y * w) * s[2], 2.0 * (y * z - x * w) * s[2], (1.0 - 2.0 * (x * x + y * y)) * s[2], 0.0, t[0], t[1], t[2], 1.0] }
/// pjiLeerGltf (GLB o GLTF con sus .bin y texturas): todo junto en la pose por defecto (las de piel, con su piel puesta)
fn leer_gltf(a: &HashMap<String, Vec<u8>>, prin: &str) -> Result<Crudo, String> {
    let b = a.get(prin).ok_or("falta el archivo")?; let nom = |s: &str| s.replace('\\', "/").rsplit('/').next().unwrap_or("").to_lowercase();
    let (mut j, mut bin): (Value, Option<Vec<u8>>) = (Value::Null, None);
    if b.len() > 20 && &b[0..4] == b"glTF" { let mut o = 12; while o + 8 <= b.len() { let len = u32::from_le_bytes([b[o], b[o + 1], b[o + 2], b[o + 3]]) as usize; let tipo = u32::from_le_bytes([b[o + 4], b[o + 5], b[o + 6], b[o + 7]]); let c = &b[o + 8..(o + 8 + len).min(b.len())];
        if tipo == 0x4e4f534a { j = serde_json::from_slice(c).map_err(|e| e.to_string())?; } else if tipo == 0x004e4942 && bin.is_none() { bin = Some(c.to_vec()); } o += 8 + len; } }
    else { j = serde_json::from_slice(b).map_err(|e| e.to_string())?; }
    if !j["asset"].is_object() { return Err("no se pudo leer ese archivo".into()); }
    if j["extensionsRequired"].as_array().map(|r| r.iter().any(|e| e.as_str().map(|s| { let s = s.to_lowercase(); s.contains("draco") || s.contains("meshopt") || s.contains("basisu") || s.contains("ktx") }).unwrap_or(false))).unwrap_or(false) { return Err("viene comprimido (Draco/Meshopt): exportalo sin comprimir".into()); }
    let bufs: Vec<Vec<u8>> = j["buffers"].as_array().map(|v| v.iter().map(|x| match x["uri"].as_str() { None => bin.clone().unwrap_or_default(), Some(u) if u.starts_with("data:") => jxjuego::personaje::base64(&u[u.find(',').map(|i| i + 1).unwrap_or(0)..]).unwrap_or_default(), Some(u) => a.get(&nom(u)).cloned().unwrap_or_default() }).collect()).unwrap_or_default();
    let vista = |i: usize| -> &[u8] { let v = &j["bufferViews"][i]; let bb = &bufs[v["buffer"].as_u64().unwrap_or(0) as usize]; let o = v["byteOffset"].as_u64().unwrap_or(0) as usize; bb.get(o..o + v["byteLength"].as_u64().unwrap_or(0) as usize).unwrap_or(&[]) };
    let acc = |i: usize| -> Vec<f64> {
        let ac = &j["accessors"][i]; let nc = match ac["type"].as_str().unwrap_or("") { "SCALAR" => 1, "VEC2" => 2, "VEC3" => 3, "VEC4" | "MAT2" => 4, "MAT3" => 9, "MAT4" => 16, _ => 1 };
        let n = ac["count"].as_u64().unwrap_or(0) as usize; let ct = ac["componentType"].as_u64().unwrap_or(5126); let es = match ct { 5120 | 5121 => 1, 5122 | 5123 => 2, _ => 4 }; let nor = ac["normalized"].as_bool().unwrap_or(false);
        let mut out = vec![0f64; n * nc];
        let leer = |d: &[u8], o: usize| -> f64 { if o + es > d.len() { return 0.0; } match ct { 5126 => f32::from_le_bytes([d[o], d[o + 1], d[o + 2], d[o + 3]]) as f64, 5121 => if nor { d[o] as f64 / 255.0 } else { d[o] as f64 }, 5123 => { let v = u16::from_le_bytes([d[o], d[o + 1]]) as f64; if nor { v / 65535.0 } else { v } }
            5125 => u32::from_le_bytes([d[o], d[o + 1], d[o + 2], d[o + 3]]) as f64, 5120 => { let v = d[o] as i8 as f64; if nor { (v / 127.0).max(-1.0) } else { v } }, 5122 => { let v = i16::from_le_bytes([d[o], d[o + 1]]) as f64; if nor { (v / 32767.0).max(-1.0) } else { v } }, _ => 0.0 } };
        if let Some(bv) = ac["bufferView"].as_u64() { let v = &j["bufferViews"][bv as usize]; let bb = &bufs[v["buffer"].as_u64().unwrap_or(0) as usize]; let st = v["byteStride"].as_u64().map(|x| x as usize).unwrap_or(nc * es); let base = v["byteOffset"].as_u64().unwrap_or(0) as usize + ac["byteOffset"].as_u64().unwrap_or(0) as usize;
            for k in 0..n { for c in 0..nc { out[k * nc + c] = leer(bb, base + k * st + c * es); } } }
        if let Some(s) = ac["sparse"].as_object() { let (iv, vv) = (vista(s["indices"]["bufferView"].as_u64().unwrap_or(0) as usize), vista(s["values"]["bufferView"].as_u64().unwrap_or(0) as usize)); let ict = s["indices"]["componentType"].as_u64().unwrap_or(5125); let ie = match ict { 5121 => 1, 5123 => 2, _ => 4 };
            for k in 0..s["count"].as_u64().unwrap_or(0) as usize { let o = s["indices"]["byteOffset"].as_u64().unwrap_or(0) as usize + k * ie; let ix = match ie { 1 => iv.get(o).copied().unwrap_or(0) as usize, 2 => iv.get(o..o + 2).map(|x| u16::from_le_bytes([x[0], x[1]]) as usize).unwrap_or(0), _ => iv.get(o..o + 4).map(|x| u32::from_le_bytes([x[0], x[1], x[2], x[3]]) as usize).unwrap_or(0) };
                for c in 0..nc { let o2 = s["values"]["byteOffset"].as_u64().unwrap_or(0) as usize + (k * nc + c) * es; if ix * nc + c < out.len() { out[ix * nc + c] = leer(vv, o2); } } } }
        out
    };
    let nodos = j["nodes"].as_array().cloned().unwrap_or_default(); let mut padre = vec![-1i64; nodos.len()];
    for (i, x) in nodos.iter().enumerate() { for c in x["children"].as_array().into_iter().flatten() { if let Some(c) = c.as_u64() { if (c as usize) < padre.len() { padre[c as usize] = i as i64; } } } }
    let fv = |v: &Value, k: usize, d: f64| v[k].as_f64().unwrap_or(d);
    let loc: Vec<[f64; 16]> = nodos.iter().map(|x| if x["matrix"].is_array() { let mut m = [0f64; 16]; for k in 0..16 { m[k] = fv(&x["matrix"], k, 0.0); } m } else { mtrs([fv(&x["translation"], 0, 0.0), fv(&x["translation"], 1, 0.0), fv(&x["translation"], 2, 0.0)], [fv(&x["rotation"], 0, 0.0), fv(&x["rotation"], 1, 0.0), fv(&x["rotation"], 2, 0.0), fv(&x["rotation"], 3, 1.0)], [fv(&x["scale"], 0, 1.0), fv(&x["scale"], 1, 1.0), fv(&x["scale"], 2, 1.0)]) }).collect();
    let mut mundo: Vec<Option<[f64; 16]>> = vec![None; nodos.len()];
    fn w_de(i: usize, padre: &[i64], loc: &[[f64; 16]], mundo: &mut Vec<Option<[f64; 16]>>, prof: usize) -> [f64; 16] { if let Some(m) = mundo[i] { return m; } let m = if padre[i] >= 0 && prof < 200 { mmul(&w_de(padre[i] as usize, padre, loc, mundo, prof + 1), &loc[i]) } else { loc[i] }; mundo[i] = Some(m); m }
    let esc = &j["scenes"][j["scene"].as_u64().unwrap_or(0) as usize]; let raices: Vec<usize> = esc["nodes"].as_array().map(|a| a.iter().filter_map(|x| x.as_u64().map(|x| x as usize)).collect()).unwrap_or_else(|| (0..nodos.len()).filter(|&i| padre[i] < 0).collect());
    let mut en_escena = vec![false; nodos.len()]; let mut pila = raices.clone(); while let Some(i) = pila.pop() { if i >= nodos.len() || en_escena[i] { continue; } en_escena[i] = true; for c in nodos[i]["children"].as_array().into_iter().flatten() { if let Some(c) = c.as_u64() { pila.push(c as usize); } } }
    // las imágenes y los materiales
    let mut img_bytes: Vec<Option<(String, Vec<u8>)>> = vec![]; let mut por_img: HashMap<usize, i32> = HashMap::new(); let mut mats: Vec<MatI> = vec![]; let mut por_mat: HashMap<i64, usize> = HashMap::new();
    let mut imagen = |ti: usize, img_bytes: &mut Vec<Option<(String, Vec<u8>)>>| -> i32 {
        let t = &j["textures"][ti]; let Some(src) = t["source"].as_u64().or(t["extensions"]["EXT_texture_webp"]["source"].as_u64()) else { return -1 }; let src = src as usize;
        if let Some(&k) = por_img.get(&src) { return k; } let im = &j["images"][src];
        let (mut mime, by) = (im["mimeType"].as_str().unwrap_or("").to_string(), if let Some(bv) = im["bufferView"].as_u64() { Some(vista(bv as usize).to_vec()) } else if let Some(u) = im["uri"].as_str() { if u.starts_with("data:") { jxjuego::personaje::base64(&u[u.find(',').map(|i| i + 1).unwrap_or(0)..]) } else { a.get(&nom(u)).cloned() } } else { None });
        if mime.is_empty() { mime = mime_de(im["uri"].as_str().unwrap_or("")); }
        let k = match by { Some(b) => { img_bytes.push(Some((mime, b))); img_bytes.len() as i32 - 1 } None => -1 }; por_img.insert(src, k); k
    };
    let mut material = |mi: i64, mats: &mut Vec<MatI>, img_bytes: &mut Vec<Option<(String, Vec<u8>)>>| -> usize {
        if let Some(&k) = por_mat.get(&mi) { return k; } let m = if mi >= 0 { j["materials"][mi as usize].clone() } else { Value::Null }; let pb = &m["pbrMetallicRoughness"]; let sg = &m["extensions"]["KHR_materials_pbrSpecularGlossiness"];
        let c = if sg["diffuseFactor"].is_array() { &sg["diffuseFactor"] } else { &pb["baseColorFactor"] }; let tx = if sg["diffuseTexture"].is_object() { &sg["diffuseTexture"] } else { &pb["baseColorTexture"] };
        let img = tx["index"].as_u64().map(|t| imagen(t as usize, img_bytes)).unwrap_or(-1);
        mats.push(MatI { c: [fv(c, 0, 1.0) as f32, fv(c, 1, 1.0) as f32, fv(c, 2, 1.0) as f32, fv(c, 3, 1.0) as f32], img, alfa: match m["alphaMode"].as_str() { Some("BLEND") => "blend".into(), Some("MASK") => "cut".into(), _ => "op".into() }, dos: m["doubleSided"].as_bool().unwrap_or(false) });
        por_mat.insert(mi, mats.len() - 1); mats.len() - 1
    };
    // (las pieles: la pose por defecto)
    let skins = j["skins"].as_array().cloned().unwrap_or_default();
    let skin_mat: Vec<Vec<[f64; 16]>> = skins.iter().map(|s| { let jt: Vec<usize> = s["joints"].as_array().map(|a| a.iter().filter_map(|x| x.as_u64().map(|x| x as usize)).collect()).unwrap_or_default();
        let ibm = s["inverseBindMatrices"].as_u64().map(|i| acc(i as usize)); jt.iter().enumerate().map(|(k, &jn)| { let mut m = [0f64; 16]; if let Some(ib) = &ibm { for e in 0..16 { m[e] = *ib.get(k * 16 + e).unwrap_or(&0.0); } } else { m = mtrs([0.0; 3], [0.0, 0.0, 0.0, 1.0], [1.0; 3]); } mmul(&w_de(jn.min(nodos.len().saturating_sub(1)), &padre, &loc, &mut mundo, 0), &m) }).collect() }).collect();
    let (mut p, mut nn, mut uu) = (vec![], vec![], vec![]); let mut grupos: Vec<(usize, Vec<u32>)> = vec![]; let (mut con_nor, mut con_uv) = (true, false);
    for ni in 0..nodos.len() {
        let nd = &nodos[ni]; let Some(me) = nd["mesh"].as_u64() else { continue }; if !en_escena[ni] { continue; }
        let wn = w_de(ni, &padre, &loc, &mut mundo, 0);
        for pr in j["meshes"][me as usize]["primitives"].as_array().into_iter().flatten() {
            let modo = pr["mode"].as_u64().unwrap_or(4); let Some(pi) = pr["attributes"]["POSITION"].as_u64() else { continue }; if modo < 4 { continue; }
            let pos = acc(pi as usize); let nv = pos.len() / 3; let nor = pr["attributes"]["NORMAL"].as_u64().map(|i| acc(i as usize)); let uv = pr["attributes"]["TEXCOORD_0"].as_u64().map(|i| acc(i as usize));
            let (jt, wt) = (pr["attributes"]["JOINTS_0"].as_u64().map(|i| acc(i as usize)), pr["attributes"]["WEIGHTS_0"].as_u64().map(|i| acc(i as usize)));
            let sm = nd["skin"].as_u64().filter(|_| jt.is_some() && wt.is_some()).and_then(|s| skin_mat.get(s as usize));
            let mut ind: Vec<u32> = pr["indices"].as_u64().map(|i| acc(i as usize).into_iter().map(|x| x as u32).collect()).unwrap_or_else(|| (0..nv as u32).collect());
            if modo == 5 { let mut o = vec![]; for i in 0..ind.len().saturating_sub(2) { if i % 2 == 1 { o.extend([ind[i + 1], ind[i], ind[i + 2]]); } else { o.extend([ind[i], ind[i + 1], ind[i + 2]]); } } ind = o; }
            else if modo == 6 { let mut o = vec![]; for i in 1..ind.len().saturating_sub(1) { o.extend([ind[0], ind[i], ind[i + 1]]); } ind = o; }
            let mi = material(pr["material"].as_i64().unwrap_or(-1), &mut mats, &mut img_bytes); if nor.is_none() { con_nor = false; } if uv.is_some() { con_uv = true; }
            let base = (p.len() / 3) as u32;
            for k in 0..nv {
                let mut m4_ = wn;
                if let (Some(sm), Some(jt), Some(wt)) = (sm, &jt, &wt) { let mut m = [0f64; 16]; let mut tw = 0.0; for c in 0..4 { let w = wt[k * 4 + c]; if w <= 0.0 { continue; } tw += w; if let Some(s) = sm.get(jt[k * 4 + c] as usize) { for e in 0..16 { m[e] += w * s[e]; } } } if tw > 0.0 { for e in 0..16 { m[e] /= tw; } m4_ = m; } }
                let (x, y, z) = (pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
                p.extend([(m4_[0] * x + m4_[4] * y + m4_[8] * z + m4_[12]) as f32, (m4_[1] * x + m4_[5] * y + m4_[9] * z + m4_[13]) as f32, (m4_[2] * x + m4_[6] * y + m4_[10] * z + m4_[14]) as f32]);
                if let Some(no) = &nor { let (a0, b0, c0) = (no[k * 3], no[k * 3 + 1], no[k * 3 + 2]); let d = [m4_[0] * a0 + m4_[4] * b0 + m4_[8] * c0, m4_[1] * a0 + m4_[5] * b0 + m4_[9] * c0, m4_[2] * a0 + m4_[6] * b0 + m4_[10] * c0]; let l = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt(); let l = if l > 0.0 { l } else { 1.0 }; nn.extend([(d[0] / l) as f32, (d[1] / l) as f32, (d[2] / l) as f32]); } else { nn.extend([0.0; 3]); }
                uu.extend([uv.as_ref().map(|u| u[k * 2]).unwrap_or(0.0) as f32, uv.as_ref().map(|u| u[k * 2 + 1]).unwrap_or(0.0) as f32]);
            }
            let g = match grupos.iter_mut().find(|g| g.0 == mi) { Some(g) => g, None => { grupos.push((mi, vec![])); grupos.last_mut().unwrap() } };
            for t in ind.chunks_exact(3) { g.1.extend([base + t[0], base + t[1], base + t[2]]); }
        }
    }
    if p.is_empty() { return Err("no tiene mallas".into()); }
    let imgs = img_bytes.iter().map(|x| x.as_ref().and_then(|(m, b)| decodificar(b, m, 1024))).collect();
    Ok(Crudo { nor: if con_nor { nn } else { vec![] }, uv: if con_uv { uu } else { vec![] }, pos: p, grupos, mats, imgs, img_bytes, nombre: nombre_de(prin) })
}
