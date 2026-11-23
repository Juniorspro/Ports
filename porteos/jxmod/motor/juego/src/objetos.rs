//! Los objetos que se ponen (los prefabs de DATA.pf, como Modelo y crearObjeto de objetos.js): el modelo para dibujar —las
//! partes con malla, relativas a la raíz, con la raíz en el origen como `md.p[0] = [0, 0, 0]`— y los recursos que el
//! motor todavía no tiene. También el catálogo del menú (DATA.menu) y sus íconos (DATA.ico). La física de cada objeto (su
//! forma, su masa, su centro) está en fisica.rs.
use crate::mapa::{material, trs};
use crate::paquete::Paquete;
use jxmotor::escena::{Cabecera, Escena, ItemDin, Malla, Mat, Tex};
use jxmotor::mat::{self as m4, M4};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

/// una parte del objeto que se dibuja: malla, parte de la malla, material, la matriz desde la raíz y la esfera que la
/// envuelve (centro y radio, también desde la raíz)
#[derive(Clone, Debug)]
pub struct Parte { pub m: i64, pub s0: u32, pub sn: u32, pub mat: i64, pub local: M4, pub esf: [f32; 4], /** el nodo del árbol (vehiculo.rs mueve las ruedas) */ pub nodo: usize }
#[derive(Clone, Debug)]
pub struct Prefab { pub nombre: String, pub partes: Vec<Parte>, /** la caja que ocupa, desde la raíz (x0, y0, z0, x1, y1, z1) */ pub caja: [f32; 6] }

/// lo que el motor ya tiene: no se sube dos veces una malla, un material o una textura
#[derive(Default)]
pub struct Cargados { mallas: HashSet<i64>, mats: HashSet<i64>, texs: HashSet<i64> }
impl Cargados { pub fn olvidar(&mut self) { *self = Cargados::default(); } }

fn f(v: &Value) -> f32 { v.as_f64().unwrap_or(0.0) as f32 }
fn v3(v: &Value, d: [f32; 3]) -> [f32; 3] { if v.is_array() { [f(&v[0]), f(&v[1]), f(&v[2])] } else { d } }
fn punto(m: &M4, p: [f32; 3]) -> [f32; 3] { [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] }
fn escala(m: &M4) -> f32 { [0, 4, 8].iter().map(|&o| (m[o] * m[o] + m[o + 1] * m[o + 1] + m[o + 2] * m[o + 2]).sqrt()).fold(0.0, f32::max) }

/// el nombre de cada prefab → su clave en DATA.pf («TableRound» → «TableRound#cc186f»), como DATA.pfPorNombre
pub fn por_nombre(d: &Value) -> HashMap<String, String> {
    let mut m = HashMap::new();
    if let Some(o) = d["pf"].as_object() { for k in o.keys() { let n = k.split('#').next().unwrap_or(k).to_string(); m.entry(n).or_insert_with(|| k.clone()); } }
    m
}

/// el catálogo de una categoría del menú (Props, Vehicles…): sus subcategorías con los nombres de lo que se puede poner
pub fn menu(d: &Value, cat: &str) -> Vec<(String, Vec<String>)> {
    let Some(c) = d["menu"].as_array().and_then(|a| a.iter().find(|c| c["n"].as_str() == Some(cat))) else { return vec![] };
    c["sub"].as_array().map(|ss| ss.iter().map(|s| (s["n"].as_str().unwrap_or("").to_string(),
        s["it"].as_array().map(|it| it.iter().filter_map(|x| x.as_str().or(x["n"].as_str()).map(|t| t.to_string())).collect()).unwrap_or_default())).collect()).unwrap_or_default()
}

/// el ícono de una cosa del menú, en un cuadrado de `lado` × `lado` (centrado, sin deformar), RGBA
pub fn icono(paq: &Paquete, nombre: &str, lado: u32) -> Option<Vec<u8>> {
    let id = paq.d["ico"][nombre].as_str()?;
    let b = paq.parte(&format!("i:{id}"))?;
    let mut dec = image_webp::WebPDecoder::new(std::io::Cursor::new(b)).ok()?;
    let (w, h) = dec.dimensions(); let alfa = dec.has_alpha();
    let mut px = vec![0u8; dec.output_buffer_size()?]; dec.read_image(&mut px).ok()?;
    let rgba: Vec<u8> = if alfa { px } else { px.chunks_exact(3).flat_map(|c| [c[0], c[1], c[2], 255]).collect() };
    // (achicado o agrandado con un promedio de lo que cae en cada píxel: se ve parejo en cualquier tamaño)
    let k = (lado as f32 / w.max(h) as f32).min(4.0); let (nw, nh) = (((w as f32 * k) as u32).max(1), ((h as f32 * k) as u32).max(1));
    let (ox, oy) = ((lado - nw.min(lado)) / 2, (lado - nh.min(lado)) / 2);
    let mut o = vec![0u8; (lado * lado * 4) as usize];
    for y in 0..nh.min(lado) { for x in 0..nw.min(lado) {
        let (x0, x1) = ((x as f32 / k) as u32, (((x + 1) as f32 / k) as u32).max((x as f32 / k) as u32 + 1).min(w));
        let (y0, y1) = ((y as f32 / k) as u32, (((y + 1) as f32 / k) as u32).max((y as f32 / k) as u32 + 1).min(h));
        let mut s = [0u32; 4]; let mut n = 0;
        for yy in y0..y1.max(y0 + 1).min(h) { for xx in x0..x1.max(x0 + 1).min(w) { let i = ((yy * w + xx) * 4) as usize; for c in 0..4 { s[c] += rgba[i + c] as u32; } n += 1; } }
        let d = (((y + oy) * lado + x + ox) * 4) as usize; for c in 0..4 { o[d + c] = (s[c] / n.max(1)) as u8; }
    } }
    Some(o)
}

/// arma un prefab: sus partes para dibujar y una escena con lo que el motor todavía no tiene (mallas, materiales y
/// texturas de hasta `tmax`)
pub fn armar(paq: &mut Paquete, nombres: &HashMap<String, String>, nombre: &str, tmax: u32, ya: &mut Cargados) -> Result<(Prefab, Escena), String> {
    let clave = nombres.get(nombre).ok_or(format!("no hay objeto {nombre}"))?.clone();
    // (los paquetes aparte de sus mallas, si los tiene)
    let ks: Vec<String> = paq.d["pf"][&clave].as_array().map(|a| a.iter().filter_map(|x| x["m"].as_i64()).filter(|&m| m >= 0)
        .filter_map(|m| paq.d["ms"][m as usize]["k"].as_str().map(|s| s.to_string())).collect()).unwrap_or_default();
    for k in ks { paq.asegurar(&k)?; }
    let d = &paq.d;
    let arb = d["pf"][&clave].as_array().ok_or("prefab raro")?;
    let n = arb.len();
    let mut act = vec![false; n]; let mut w: Vec<M4> = vec![m4::id(); n];
    for (i, x) in arb.iter().enumerate() {
        let pa = x["pa"].as_i64().unwrap_or(-1);
        act[i] = x["off"].is_null() && (pa < 0 || act[pa as usize]);
        let p = if i == 0 { [0.0; 3] } else { v3(&x["p"], [0.0; 3]) };
        let l = trs(p, if x["r"].is_array() { [f(&x["r"][0]), f(&x["r"][1]), f(&x["r"][2]), f(&x["r"][3])] } else { [0.0, 0.0, 0.0, 1.0] }, v3(&x["s"], [1.0; 3]));
        w[i] = if pa < 0 { l } else { m4::mul(&w[pa as usize], &l) };
    }
    let mut datos: Vec<u8> = vec![];
    let mut poner = |b: &[u8]| -> usize { let o = datos.len(); datos.extend_from_slice(b); while datos.len() % 4 != 0 { datos.push(0); } o };
    let (mut mallas, mut mats, mut texs) = (vec![], vec![], vec![]);
    let mut partes = vec![]; let mut caja = [1e9f32, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (i, x) in arb.iter().enumerate() {
        if !act[i] { continue; }
        let (Some(mi), Some(mts)) = (x["m"].as_i64(), x["mt"].as_array()) else { continue };
        if mi < 0 || !x["mroff"].is_null() { continue; }
        let md = &d["ms"][mi as usize]; let Some(subs) = md["sub"].as_array() else { continue };
        let Some(bin) = paq.bin_de(md) else { continue };
        if ya.mallas.insert(mi) {
            let (v, o, ii) = (md["v"].as_u64().unwrap_or(0) as usize, md["o"].as_u64().unwrap_or(0) as usize, md["i"].as_u64().unwrap_or(0) as usize);
            let i32 = md["i32"].as_bool().unwrap_or(false); let ni = subs.iter().map(|s| s[0].as_u64().unwrap_or(0) + s[1].as_u64().unwrap_or(0)).max().unwrap_or(0) as usize;
            let vb = bin.get(o..o + v * 14).ok_or("malla cortada")?; let ib = bin.get(ii..ii + ni * if i32 { 4 } else { 2 }).ok_or("índices cortados")?;
            let vo = poner(vb); let io = poner(ib);
            mallas.push(Malla { id: mi, v: v as u32, mn: v3(&md["mn"], [0.0; 3]), sc: v3(&md["sc"], [1.0; 3]), i32: i32 as u8, ni: ni as u32, vo, io, lo: -1, so: -1, lm: -1 });
        }
        let mn = v3(&md["mn"], [0.0; 3]); let sc = v3(&md["sc"], [1.0; 3]);
        let c = [mn[0] + sc[0] / 2.0, mn[1] + sc[1] / 2.0, mn[2] + sc[2] / 2.0]; let r = (sc[0] * sc[0] + sc[1] * sc[1] + sc[2] * sc[2]).sqrt() / 2.0;
        for e in 0..8 { let q = punto(&w[i], [mn[0] + if e & 1 != 0 { sc[0] } else { 0.0 }, mn[1] + if e & 2 != 0 { sc[1] } else { 0.0 }, mn[2] + if e & 4 != 0 { sc[2] } else { 0.0 }]);
            for k in 0..3 { caja[k] = caja[k].min(q[k]); caja[k + 3] = caja[k + 3].max(q[k]); } }
        for (k, mt) in mts.iter().enumerate() {
            let Some(mt) = mt.as_i64() else { continue }; if mt < 0 { continue; }
            let Some(s) = subs.get(k) else { continue };
            if !ya.mats.contains(&mt) { match material(d, mt as usize) { Some(m) => { ya.mats.insert(mt); mats.push(m); } None => continue } }
            let cen = punto(&w[i], c);
            partes.push(Parte { m: mi, s0: s[0].as_u64().unwrap_or(0) as u32, sn: s[1].as_u64().unwrap_or(0) as u32, mat: mt, local: w[i], esf: [cen[0], cen[1], cen[2], r * escala(&w[i])], nodo: i });
        }
    }
    // las texturas de los materiales nuevos
    let quiero: Vec<i64> = mats.iter().flat_map(|m: &Mat| { let mut v = vec![m.t, m.t2]; if let Some(t) = &m.terr { v.extend(t.iter().map(|x| x.0)); } v }).filter(|&t| t >= 0).collect();
    for t in quiero {
        if !ya.texs.insert(t) { continue; }
        if let Some((tw, th, px)) = paq.textura(t as usize, tmax) {
            let a = d["tx"][t as usize]["a"].as_i64().unwrap_or(0) as u8; let o = poner(&px);
            texs.push(Tex { id: t, n: d["tx"][t as usize]["n"].as_str().unwrap_or("").to_string(), w: tw, h: th, a, o });
        }
    }
    let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas, mats, texs, lms: vec![], items: vec![], agua: None, cielo: None };
    if caja[0] > caja[3] { caja = [-0.5, -0.5, -0.5, 0.5, 0.5, 0.5]; }
    Ok((Prefab { nombre: nombre.to_string(), partes, caja }, Escena { c: cab, datos }))
}

impl Prefab {
    /// lo que se dibuja con el objeto en `base` (la matriz del objeto: su cuerpo, corrido por su centro)
    pub fn items(&self, base: &M4, out: &mut Vec<ItemDin>) {
        let e = escala(base);
        for p in &self.partes {
            let mm = m4::mul(base, &p.local); let c = punto(base, [p.esf[0], p.esf[1], p.esf[2]]);
            out.push(ItemDin { m: p.m, s0: p.s0, sn: p.sn, mat: p.mat, mm, esf: [c[0], c[1], c[2], p.esf[3] * e], fl: 0, h: vec![] });
        }
    }
}
