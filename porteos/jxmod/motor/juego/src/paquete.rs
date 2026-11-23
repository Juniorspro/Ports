//! El paquete del juego, como lo arma armar.py (el mismo que usa la versión web): un índice (nombre de cada parte → desde
//! y largo) y un solo bloque con todo pegado. Las partes: `d` los datos (JSON en gzip: escenas, mallas, materiales,
//! texturas, animaciones…), `m` las mallas (gzip, con los índices de los triángulos en zigzag por planos), `tN` cada
//! textura (WebP), `a:nombre` los sonidos, `i:nombre` los íconos. Los mapas y personajes grandes van en paquetes aparte
//! (`RBP1`: su propio índice con sus mallas, texturas y sonidos).
use flate2::read::GzDecoder;
use serde_json::Value;
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
#[allow(unused_imports)] use std::path as _;

pub struct Paquete {
    idx: HashMap<String, (usize, usize)>,
    bloque: Vec<u8>,
    /// los datos del juego (DATA)
    pub d: Value,
    /// las mallas del paquete principal (BIN)
    pub bin: Vec<u8>,
    /// los paquetes aparte ya abiertos: sus mallas y sus partes (texturas, sonidos)
    rbp: HashMap<String, Rbp>,
    /// de dónde se leen los paquetes aparte (`rb/<nombre>`): una carpeta, o lo que diga la app (en Android, los archivos de
    /// la APK)
    leer: Box<dyn Fn(&str) -> Option<Vec<u8>> + Send>,
}
struct Rbp { bin: Vec<u8>, partes: HashMap<String, (usize, usize)>, datos: Vec<u8> }

fn desgz(b: &[u8]) -> Result<Vec<u8>, String> { let mut o = Vec::new(); GzDecoder::new(b).read_to_end(&mut o).map_err(|e| format!("gzip: {e}"))?; Ok(o) }

/// los índices de los triángulos vienen como diferencias en zigzag con los bytes en planos: se rearman en su lugar, una
/// vez por zona (como desfiltrarIndices de datos.js)
fn desfiltrar(bin: &mut [u8], mallas: &[&Value]) {
    let mut hechos = std::collections::HashSet::new();
    for m in mallas {
        let (Some(i), Some(sub)) = (m["i"].as_u64(), m["sub"].as_array()) else { continue };
        if m["o"].is_null() || sub.is_empty() || !hechos.insert(i) { continue; }
        let n = sub.iter().map(|s| s[0].as_u64().unwrap_or(0) + s[1].as_u64().unwrap_or(0)).max().unwrap_or(0) as usize;
        let i = i as usize; let w = if m["i32"].as_bool().unwrap_or(false) { 4 } else { 2 };
        if i + n * w > bin.len() { continue; }
        let src = bin[i..i + n * w].to_vec(); let mut o = i;
        if w == 2 {
            let mut ant: u32 = 0;
            for k in 0..n { let z = src[k] as u32 | (src[n + k] as u32) << 8; ant = (ant.wrapping_add((z >> 1) ^ (0u32.wrapping_sub(z & 1)))) & 0xffff; bin[o] = ant as u8; bin[o + 1] = (ant >> 8) as u8; o += 2; }
        } else {
            let mut ant: u32 = 0;
            for k in 0..n {
                let z = src[k] as u32 | (src[n + k] as u32) << 8 | (src[2 * n + k] as u32) << 16 | (src[3 * n + k] as u32) << 24;
                ant = ant.wrapping_add((z >> 1) ^ (0u32.wrapping_sub(z & 1)));
                bin[o..o + 4].copy_from_slice(&ant.to_le_bytes()); o += 4;
            }
        }
    }
}

impl Paquete {
    /// abre el paquete de una carpeta: `pk.bin` y su índice `pk.idx.json` (en la web, el índice va adentro del HTML)
    pub fn abrir(carpeta: &Path) -> Result<Paquete, String> {
        let idx_txt = std::fs::read_to_string(carpeta.join("pk.idx.json")).map_err(|e| format!("pk.idx.json: {e}"))?;
        let bloque = std::fs::read(carpeta.join("pk.bin")).map_err(|e| format!("pk.bin: {e}"))?;
        let c: PathBuf = carpeta.to_path_buf();
        Self::de_bytes(&idx_txt, bloque, Box::new(move |n| std::fs::read(c.join(n)).ok()))
    }
    /// el paquete ya leído (índice y bloque) y cómo leer los paquetes aparte (`rb/<nombre>`)
    pub fn de_bytes(idx_txt: &str, bloque: Vec<u8>, leer: Box<dyn Fn(&str) -> Option<Vec<u8>> + Send>) -> Result<Paquete, String> {
        let iv: Value = serde_json::from_str(idx_txt).map_err(|e| format!("índice: {e}"))?;
        let mut idx = HashMap::new();
        for (k, v) in iv.as_object().ok_or("índice raro")? { idx.insert(k.clone(), (v[0].as_u64().unwrap_or(0) as usize, v[1].as_u64().unwrap_or(0) as usize)); }
        let parte = |k: &str| -> Result<&[u8], String> { let &(o, n) = idx.get(k).ok_or(format!("falta la parte {k}"))?; bloque.get(o..o + n).ok_or(format!("parte {k} cortada")) };
        let d: Value = serde_json::from_slice(&desgz(parte("d")?)?).map_err(|e| format!("datos: {e}"))?;
        let mut bin = desgz(parte("m")?)?;
        let filtrado = iv["m"].get(2).and_then(|x| x.as_u64()) == Some(1);
        if filtrado { let ms: Vec<&Value> = d["ms"].as_array().map(|a| a.iter().filter(|m| m["k"].is_null()).collect()).unwrap_or_default(); desfiltrar(&mut bin, &ms); }
        Ok(Paquete { idx, bloque, d, bin, rbp: HashMap::new(), leer })
    }

    /// una parte del paquete (o de los paquetes aparte ya abiertos)
    pub fn parte(&self, k: &str) -> Option<&[u8]> {
        if let Some(&(o, n)) = self.idx.get(k) { return self.bloque.get(o..o + n); }
        for r in self.rbp.values() { if let Some(&(o, n)) = r.partes.get(k) { return r.datos.get(o..o + n); } }
        None
    }

    /// abre el paquete aparte `k` (m_RB_Flatgrass, s_Hero…) si hace falta: de `rb/` al lado del paquete
    pub fn asegurar(&mut self, k: &str) -> Result<(), String> {
        if self.rbp.contains_key(k) { return Ok(()); }
        let Some(nom) = self.d["rbp"][k][0].as_str() else { return Ok(()) };   // (no es de un paquete aparte)
        let u8s = (self.leer)(&format!("rb/{nom}")).ok_or(format!("no está rb/{nom}"))?;
        if u8s.len() < 8 || &u8s[0..4] != b"RBP1" { return Err(format!("{nom}: no es RBP1")); }
        let n = u32::from_le_bytes([u8s[4], u8s[5], u8s[6], u8s[7]]) as usize;
        let idx: Value = serde_json::from_slice(&u8s[8..8 + n]).map_err(|e| format!("{nom}: {e}"))?;
        let datos = u8s[8 + n..].to_vec();
        let mut bin = vec![];
        if let Some(m) = idx["m"].as_array() {
            let (o, l) = (m[0].as_u64().unwrap_or(0) as usize, m[1].as_u64().unwrap_or(0) as usize);
            bin = desgz(&datos[o..o + l])?;
            let ms: Vec<&Value> = self.d["ms"].as_array().map(|a| a.iter().filter(|m| m["k"].as_str() == Some(k)).collect()).unwrap_or_default();
            desfiltrar(&mut bin, &ms);
        }
        let mut partes = HashMap::new();
        for (pre, clave) in [("t", "t"), ("a:", "a")] {
            if let Some(o) = idx[clave].as_object() { for (t, v) in o { partes.insert(format!("{pre}{t}"), (v[0].as_u64().unwrap_or(0) as usize, v[1].as_u64().unwrap_or(0) as usize)); } }
        }
        self.rbp.insert(k.to_string(), Rbp { bin, partes, datos });
        Ok(())
    }
    /// suelta los paquetes aparte que no son `salvo` (al cambiar de mapa: no quedan todos en la memoria)
    pub fn soltar_menos(&mut self, salvo: &[&str]) { self.rbp.retain(|k, _| salvo.contains(&k.as_str())); }

    /// los bytes de las mallas donde vive la malla `d` (el paquete principal o el aparte)
    pub fn bin_de(&self, d: &Value) -> Option<&[u8]> {
        match d["k"].as_str() { Some(k) => self.rbp.get(k).map(|r| r.bin.as_slice()), None => Some(&self.bin) }
    }

    /// la textura `i` lista para la placa: RGBA, dada vuelta (las UV del juego tienen el origen abajo: como
    /// createImageBitmap con flipY) y achicada por niveles hasta que el lado mayor sea ≤ tmax (como el motor la pedía)
    pub fn textura(&self, i: usize, tmax: u32) -> Option<(u32, u32, Vec<u8>)> {
        let b = self.parte(&format!("t{i}"))?;
        let mut dec = image_webp::WebPDecoder::new(std::io::Cursor::new(b)).ok()?;
        let (w, h) = dec.dimensions(); let alfa = dec.has_alpha();
        let mut px = vec![0u8; dec.output_buffer_size()?]; dec.read_image(&mut px).ok()?;
        let mut rgba = if alfa { px } else { let mut v = Vec::with_capacity((w * h * 4) as usize); for c in px.chunks_exact(3) { v.extend_from_slice(&[c[0], c[1], c[2], 255]); } v };
        // (dar vuelta las filas)
        let fila = (w * 4) as usize; let mut vuelta = vec![0u8; rgba.len()];
        for y in 0..h as usize { vuelta[y * fila..(y + 1) * fila].copy_from_slice(&rgba[(h as usize - 1 - y) * fila..(h as usize - y) * fila]); }
        rgba = vuelta;
        let (mut w, mut h) = (w, h);
        while w.max(h) > tmax { let (nw, nh) = ((w / 2).max(1), (h / 2).max(1)); rgba = mitad(&rgba, w, h, nw, nh); w = nw; h = nh; }
        Some((w, h, rgba))
    }
}

/// el nivel siguiente de una imagen RGBA (promedio de a 4, como glGenerateMipmap)
pub fn mitad(px: &[u8], w: u32, h: u32, nw: u32, nh: u32) -> Vec<u8> {
    let mut o = vec![0u8; (nw * nh * 4) as usize];
    for y in 0..nh { for x in 0..nw { for c in 0..4 {
        let p = |xx: u32, yy: u32| px[((yy.min(h - 1) * w + xx.min(w - 1)) * 4 + c) as usize] as u32;
        o[((y * nw + x) * 4 + c) as usize] = ((p(2 * x, 2 * y) + p(2 * x + 1, 2 * y) + p(2 * x, 2 * y + 1) + p(2 * x + 1, 2 * y + 1) + 2) / 4) as u8;
    } } }
    o
}
