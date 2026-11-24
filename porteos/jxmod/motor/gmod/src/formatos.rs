//! Los formatos de Source (juego/gmod_formatos.js, GMF): materiales (.vmt), texturas (.vtf, con DXT1/3/5 y los demás),
//! modelos (.mdl + .vvd + .vtx: huesos, mallas, pieles, enganches, animaciones y secuencias), la pose de cada cuadro de una
//! animación, los modelos incluidos, las mezclas por parámetros de pose, la pose de reposo y las formas de choque (.phy).
//! Todo puro: los bytes entran y salen números. Las lecturas fuera del archivo dan 0 (como un .mdl cortado no debe tirar
//! el juego, se revisan los tamaños antes de recorrer listas).
use std::collections::HashMap;
use std::rc::Rc;

// ---------------- lectura ----------------
#[inline] fn u8a(b: &[u8], o: usize) -> u8 { b.get(o).copied().unwrap_or(0) }
#[inline] fn i32a(b: &[u8], o: i64) -> i32 { if o < 0 { return 0; } let o = o as usize; b.get(o..o + 4).map(|x| i32::from_le_bytes([x[0], x[1], x[2], x[3]])).unwrap_or(0) }
#[inline] fn u32a(b: &[u8], o: i64) -> u32 { i32a(b, o) as u32 }
#[inline] fn f32a(b: &[u8], o: i64) -> f32 { f32::from_bits(u32a(b, o)) }
#[inline] fn i16a(b: &[u8], o: i64) -> i16 { if o < 0 { return 0; } let o = o as usize; b.get(o..o + 2).map(|x| i16::from_le_bytes([x[0], x[1]])).unwrap_or(0) }
#[inline] fn u16a(b: &[u8], o: i64) -> u16 { i16a(b, o) as u16 }
/// una cadena terminada en 0 (latin1)
fn cad(b: &[u8], o: i64) -> String {
    if o < 0 || o as usize >= b.len() { return String::new(); }
    let o = o as usize; let e = b[o..].iter().position(|&c| c == 0).map(|p| o + p).unwrap_or(b.len());
    b[o..e].iter().map(|&c| c as char).collect()
}
fn ruta_n(s: &str) -> String { s.to_lowercase().replace('\\', "/") }
/// medio float → float
pub fn h2f(h: u16) -> f32 {
    let s = if h & 0x8000 != 0 { -1.0 } else { 1.0 }; let e = ((h >> 10) & 31) as i32; let m = (h & 1023) as f32;
    if e == 0 { s * m * 5.960464477539063e-8 } else if e == 31 { if m != 0.0 { f32::NAN } else { s * f32::INFINITY } } else { s * (1.0 + m / 1024.0) * 2f32.powi(e - 15) }
}

// ---------------- KeyValues (los .vmt) ----------------
#[derive(Clone, Debug)]
pub enum Nodo { T(String), B(Bloque) }
/// un bloque: las claves en minúsculas, la primera de cada nombre gana (como GMF.kv)
#[derive(Clone, Debug, Default)]
pub struct Bloque(pub Vec<(String, Nodo)>);
impl Bloque {
    pub fn get(&self, k: &str) -> Option<&Nodo> { self.0.iter().find(|(x, _)| x == k).map(|(_, v)| v) }
    pub fn txt(&self, k: &str) -> Option<&str> { match self.get(k) { Some(Nodo::T(s)) => Some(s), _ => None } }
    pub fn blq(&self, k: &str) -> Option<&Bloque> { match self.get(k) { Some(Nodo::B(b)) => Some(b), _ => None } }
    fn tiene(&self, k: &str) -> bool { self.0.iter().any(|(x, _)| x == k) }
    fn poner(&mut self, k: String, v: Nodo) { if !self.tiene(&k) { self.0.push((k, v)); } }
    fn pisar(&mut self, k: String, v: Nodo) { if let Some(x) = self.0.iter_mut().find(|(x, _)| *x == k) { x.1 = v; } else { self.0.push((k, v)); } }
}
enum Tok { Abre, Cierra, S(String, bool) }
/// GMF.kv: (shader, bloque)
pub fn kv(txt: &str) -> Option<(String, Bloque)> {
    let c: Vec<char> = txt.chars().collect(); let n = c.len(); let mut i = 0usize;
    let tok = |i: &mut usize| -> Option<Tok> {
        loop {
            while *i < n && c[*i].is_whitespace() { *i += 1; }
            if *i + 1 < n && c[*i] == '/' && c[*i + 1] == '/' { while *i < n && c[*i] != '\n' { *i += 1; } continue; }
            break;
        }
        if *i >= n { return None; }
        let ch = c[*i];
        if ch == '{' { *i += 1; return Some(Tok::Abre); }
        if ch == '}' { *i += 1; return Some(Tok::Cierra); }
        if ch == '"' { let mut e = *i + 1; while e < n && c[e] != '"' { e += 1; } let s: String = c[*i + 1..e.min(n)].iter().collect(); *i = e + 1; return Some(Tok::S(s, true)); }
        let mut e = *i; while e < n && !(c[e].is_whitespace() || c[e] == '{' || c[e] == '}' || c[e] == '"') { e += 1; }
        let s: String = c[*i..e].iter().collect(); *i = e; Some(Tok::S(s, false))
    };
    fn es_cond(t: &Option<Tok>) -> bool {
        match t { Some(Tok::S(s, q)) => if *q { let b = s.as_bytes(); b.first() == Some(&b'[') && { let r = if b.get(1) == Some(&b'!') { &s[2..] } else { &s[1..] }; r.starts_with('$') && r[1..].chars().next().map(|x| x.is_alphanumeric() || x == '_').unwrap_or(false) } } else { s.starts_with('[') && s.ends_with(']') }, _ => false }
    }
    fn bloque(i: &mut usize, tok: &dyn Fn(&mut usize) -> Option<Tok>, prof: u32) -> Bloque {
        let mut o = Bloque::default();
        loop {
            let k = match tok(i) { None | Some(Tok::Cierra) => return o, Some(Tok::Abre) => { if prof < 64 { bloque(i, tok, prof + 1); } continue; } Some(Tok::S(s, _)) => s };
            let mut v = tok(i); if v.is_none() { return o; }
            if es_cond(&v) { v = tok(i); }
            let key = k.to_lowercase();
            match v {
                Some(Tok::Abre) => { let sub = if prof < 64 { bloque(i, tok, prof + 1) } else { Bloque::default() }; o.poner(key, Nodo::B(sub)); }
                Some(Tok::S(s, _)) => { let save = *i; let t2 = tok(i); if !es_cond(&t2) { *i = save; } o.poner(key, Nodo::T(s)); }
                _ => {}
            }
        }
    }
    let raiz = match tok(&mut i) { Some(Tok::S(s, _)) => s, _ => return None };
    if !matches!(tok(&mut i), Some(Tok::Abre)) { return None; }
    let b = bloque(&mut i, &tok, 0);
    Some((raiz.to_lowercase(), b))
}

/// un material (GMF.vmt)
#[derive(Clone, Debug, Default)]
pub struct Vmt {
    pub shader: String, pub base: Option<String>, pub base2: Option<String>, pub bump: Option<String>, pub detalle: Option<String>, pub tinte: Option<String>,
    pub espejo: Option<[f32; 2]>, pub trans: bool, pub alfa: f32, pub corte: bool, pub umbral: f32, pub suma: bool, pub dos_lados: bool, pub brilla: bool,
    pub sin_luz: bool, pub color: Option<[f32; 3]>, pub env: bool, pub phong: bool, pub vcolor: bool, pub superficie: Option<String>, pub anim: bool, pub nodraw: bool,
}
fn latin1(b: &[u8]) -> String { b.iter().map(|&c| c as char).collect() }
/// GMF.vmt: `buscar` trae otro .vmt por su ruta (sin «materials/»), para los «patch»
pub fn vmt(bytes: &[u8], buscar: &dyn Fn(&str) -> Option<Rc<[u8]>>) -> Option<Vmt> {
    let (mut shader, mut k) = kv(&latin1(bytes))?;
    let mut n = 0;
    while shader == "patch" && n < 4 {
        n += 1;
        let base = k.txt("include").and_then(|inc| { let r = ruta_n(inc); let r = r.trim_start_matches('/'); let r = r.strip_prefix("materials/").unwrap_or(r).to_string(); buscar(&r) });
        let b2 = base.and_then(|b| kv(&latin1(&b)));
        let mut extra = Bloque::default();
        for nom in ["insert", "replace"] { if let Some(x) = k.blq(nom) { for (kk, vv) in &x.0 { extra.pisar(kk.clone(), vv.clone()); } } }
        match b2 { Some((sh, mut bk)) => { for (kk, vv) in extra.0 { bk.pisar(kk, vv); } shader = sh; k = bk; } None => { shader = "vertexlitgeneric".into(); k = extra; } }
    }
    // (los bloques condicionales: lo que falta arriba se toma de ahí, primero de los ">=")
    let es_c = |x: &str| { let l = x.to_lowercase(); l.starts_with('<') || l.starts_with('>') || l.contains("gpu") || l.contains("srgb") || l.contains("ldr") || l.contains("hdr") || l.as_bytes().windows(3).any(|w| w[0] == b'd' && w[1] == b'x' && w[2].is_ascii_digit()) };
    let mut cond: Vec<String> = k.0.iter().filter(|(x, v)| matches!(v, Nodo::B(_)) && x != "proxies" && x != "insert" && x != "replace" && es_c(x)).map(|(x, _)| x.clone()).collect();
    let viejo = |a: &str| a.starts_with('<') || (a.len() >= 4 && a.ends_with(|c: char| ('5'..='8').contains(&c)) && a[..a.len() - 1].ends_with("_dx"));
    cond.sort_by_key(|a| (if a.starts_with('>') { 0 } else { 1 }, viejo(a) as u8));
    for c in cond { if let Some(Nodo::B(b)) = k.get(&c).cloned() { for (kk, vv) in b.0 { k.poner(kk, vv); } } }
    let num = |x: &str, d: f32| -> f32 { k.txt(x).map(|s| s.trim().parse::<f32>().unwrap_or(if s.trim().is_empty() { 0.0 } else { f32::NAN })).unwrap_or(d) };
    let vec = |x: &str| -> Option<[f32; 3]> {
        let s = k.txt(x)?; let v: Vec<f32> = s.replace(['[', ']', '{', '}'], " ").split_whitespace().map(|t| t.parse::<f32>().unwrap_or(f32::NAN)).collect();
        if v.len() >= 3 && v.iter().all(|x| x.is_finite()) { Some(if s.contains('{') { [v[0] / 255.0, v[1] / 255.0, v[2] / 255.0] } else { [v[0], v[1], v[2]] }) } else { None }
    };
    let ruta = |x: &str| -> Option<String> { let s = k.txt(x)?; if s.is_empty() { return None; } let r = ruta_n(s); let r = r.trim_start_matches('/'); Some(r.strip_suffix(".vtf").unwrap_or(r).to_string()) };
    let espejo = (|| {
        let de = |x: &str| -> Option<[f32; 2]> { let v: Vec<f32> = x.replace(['[', ']', '{', '}'], " ").split_whitespace().map(|t| t.parse::<f32>().unwrap_or(f32::NAN)).collect(); if v.len() >= 2 && v.iter().all(|x| x.is_finite()) { Some([if v[0] < 0.0 { -1.0 } else { 1.0 }, if v[1] < 0.0 { -1.0 } else { 1.0 }]) } else { None } };
        if let Some(tp) = k.blq("proxies").and_then(|p| p.blq("texturetransform")) {
            let rv = tp.txt("resultvar").unwrap_or("").to_lowercase();
            if let Some(sv) = tp.txt("scalevar") { if rv == "$basetexturetransform" || (rv == "$bumptransform" && shader.contains("refract")) { if let Some(x) = k.txt(&sv.to_lowercase()) { return de(x); } } }
        }
        let bt = k.txt("$basetexturetransform")?.to_lowercase(); let i = bt.find("scale")?; let r: Vec<&str> = bt[i + 5..].split_whitespace().take(2).collect(); if r.len() < 2 { return None; } de(&format!("{} {}", r[0], r[1]))
    })();
    let px = k.blq("proxies");
    Some(Vmt {
        base: ruta("$basetexture"), base2: ruta("$basetexture2"), bump: ruta("$bumpmap"), detalle: ruta("$detail"), tinte: ruta("$refracttinttexture"), espejo,
        trans: num("$translucent", 0.0) != 0.0 || num("$alpha", 1.0) < 1.0, alfa: num("$alpha", 1.0), corte: num("$alphatest", 0.0) != 0.0, umbral: num("$alphatestreference", 0.5),
        suma: num("$additive", 0.0) != 0.0, dos_lados: num("$nocull", 0.0) != 0.0, brilla: num("$selfillum", 0.0) != 0.0,
        sin_luz: shader.contains("unlit") || shader.contains("sprite"), color: vec("$color2").or_else(|| vec("$color")), env: k.tiene("$envmap"), phong: num("$phong", 0.0) != 0.0,
        vcolor: num("$vertexcolor", 0.0) != 0.0, superficie: k.txt("$surfaceprop").map(|s| s.to_lowercase()),
        anim: px.map(|p| p.tiene("animatedtexture") || p.tiene("texturescroll")).unwrap_or(false),
        nodraw: num("$no_draw", 0.0) != 0.0 || num("%nodraw", 0.0) != 0.0, shader,
    })
}

// ---------------- .vtf ----------------
fn vtf_bpp(f: i32) -> usize { match f { 0 | 1 | 11 | 12 | 16 | 23 | 26 => 4, 2 | 3 | 9 | 10 => 3, 4 | 6 | 17 | 18 | 19 | 21 | 22 => 2, 5 | 7 | 8 => 1, 24 | 25 => 8, _ => 4 } }
fn vtf_tam(f: i32, w: usize, h: usize) -> usize {
    let (bw, bh) = (((w + 3) >> 2).max(1), ((h + 3) >> 2).max(1));
    match f { 13 | 20 => bw * bh * 8, 14 | 15 => bw * bh * 16, _ => w * h * vtf_bpp(f) }
}
/// un nivel de una textura: tamaño, formato y sus bytes
pub struct Vtf<'a> { pub w: usize, pub h: usize, pub fmt: i32, pub datos: &'a [u8], pub alfa: bool, pub cuadros: usize, pub banderas: u32 }
/// GMF.vtf: el nivel de detalle más grande que entra en `max` (del cuadro 0, cara 0)
pub fn vtf(b: &[u8], max: usize) -> Result<Vtf<'_>, String> {
    if b.len() < 64 || &b[0..4] != b"VTF\0" { return Err("no es un .vtf".into()); }
    let (vmen, hdr) = (u32a(b, 8), u32a(b, 12) as usize);
    let (w0, h0, flags, frames) = (u16a(b, 16) as usize, u16a(b, 18) as usize, u32a(b, 20), (u16a(b, 24) as usize).max(1));
    let (fmt, nmip, lfmt, lw, lh) = (i32a(b, 52), u8a(b, 56) as i32, i32a(b, 57), u8a(b, 61) as usize, u8a(b, 62) as usize);
    let prof = if vmen >= 2 { (u16a(b, 63) as usize).max(1) } else { 1 };
    let caras = if flags & 0x4000 == 0 { 1 } else if vmen < 5 && u16a(b, 26) != 0xffff { 7 } else { 6 };
    let mut off: i64 = -1;
    if vmen >= 3 { let nr = u32a(b, 68) as usize; for r in 0..nr.min(64) { let o = 80 + r * 8; if u8a(b, o) == 0x30 && u8a(b, o + 1) == 0 && u8a(b, o + 2) == 0 { off = u32a(b, o as i64 + 4) as i64; break; } } }
    if off < 0 { off = (hdr + if lfmt >= 0 && lw > 0 && lh > 0 { vtf_tam(lfmt, lw, lh) } else { 0 }) as i64; }
    let mut o = off as usize; let mut el: Option<(usize, usize, usize, usize)> = None;
    let max = if max == 0 { usize::MAX } else { max };
    for m in (0..nmip.max(0)).rev() {
        let (w, h) = ((w0 >> m).max(1), (h0 >> m).max(1)); let t = vtf_tam(fmt, w, h); let d = (prof >> m).max(1);
        if el.is_none() || w.max(h) <= max { el = Some((w, h, o, t)); }
        o += t * frames * caras * d;
    }
    let (w, h, o, t) = el.ok_or("vtf sin niveles")?;
    if o + t > b.len() { return Err("vtf cortado".into()); }
    let alfa = flags & (0x1000 | 0x2000) != 0 || [0, 1, 6, 8, 11, 12, 14, 15, 19, 20, 21, 24, 25].contains(&fmt);
    Ok(Vtf { w, h, fmt, datos: &b[o..o + t], alfa, cuadros: frames, banderas: flags })
}
fn c565(c: u16, o: &mut [u8; 16], i: usize) { let (r, g, b) = ((c >> 11) & 31, (c >> 5) & 63, c & 31); o[i] = ((r << 3) | (r >> 2)) as u8; o[i + 1] = ((g << 2) | (g >> 4)) as u8; o[i + 2] = ((b << 3) | (b >> 2)) as u8; }
fn dxt_bloque(src: &[u8], s: usize, out: &mut [u8], w: usize, h: usize, x0: usize, y0: usize, tipo: u8) {
    let ac = if tipo == 1 { 0 } else { 8 };
    let rd = |k: usize| src.get(s + k).copied().unwrap_or(0) as u32;
    let c0 = (rd(ac) | rd(ac + 1) << 8) as u16; let c1 = (rd(ac + 2) | rd(ac + 3) << 8) as u16;
    let mut p = [0u8; 16]; c565(c0, &mut p, 0); c565(c1, &mut p, 4); p[3] = 255; p[7] = 255;
    if c0 > c1 || tipo != 1 { for k in 0..3 { p[8 + k] = ((2 * p[k] as u32 + p[4 + k] as u32 + 1) / 3) as u8; p[12 + k] = ((p[k] as u32 + 2 * p[4 + k] as u32 + 1) / 3) as u8; } p[11] = 255; p[15] = 255; }
    else { for k in 0..3 { p[8 + k] = ((p[k] as u32 + p[4 + k] as u32) >> 1) as u8; } p[11] = 255; p[12] = 0; p[13] = 0; p[14] = 0; p[15] = 0; }
    let idx = rd(ac + 4) | rd(ac + 5) << 8 | rd(ac + 6) << 16 | rd(ac + 7) << 24;
    let mut a = [255u8; 16]; let hay_a = tipo == 3 || tipo == 5;
    if tipo == 3 { for k in 0..16 { let v = (rd(k >> 1) >> ((k & 1) * 4)) & 15; a[k] = (v * 17) as u8; } }
    else if tipo == 5 {
        let (a0, a1) = (rd(0), rd(1)); let mut t = vec![a0, a1];
        if a0 > a1 { for k in 1..7 { t.push(((7 - k) * a0 + k * a1) / 7); } } else { for k in 1..5 { t.push(((5 - k) * a0 + k * a1) / 5); } t.push(0); t.push(255); }
        let (mut bits, mut nb, mut q) = (0u32, 0u32, 2usize);
        for k in 0..16 { while nb < 3 { bits |= rd(q) << nb; q += 1; nb += 8; } a[k] = t[(bits & 7) as usize] as u8; bits >>= 3; nb -= 3; }
    }
    for k in 0..16 {
        let (x, y) = (x0 + (k & 3), y0 + (k >> 2)); if x >= w || y >= h { continue; }
        let c = ((idx >> (2 * k)) & 3) as usize; let d = (y * w + x) * 4;
        out[d] = p[c * 4]; out[d + 1] = p[c * 4 + 1]; out[d + 2] = p[c * 4 + 2]; out[d + 3] = if hay_a { a[k] } else { p[c * 4 + 3] };
    }
}
/// GMF.vtfRGBA: a RGBA de 8 bits
pub fn vtf_rgba(t: &Vtf) -> Vec<u8> {
    let (w, h, fmt, s) = (t.w, t.h, t.fmt, t.datos); let n = w * h; let mut o = vec![0u8; n * 4];
    if matches!(fmt, 13 | 20 | 14 | 15) {
        let tb = match fmt { 14 => 3, 15 => 5, _ => 1 }; let bs = if tb == 1 { 8 } else { 16 }; let (bw, bh) = (((w + 3) >> 2).max(1), ((h + 3) >> 2).max(1));
        for by in 0..bh { for bx in 0..bw { dxt_bloque(s, (by * bw + bx) * bs, &mut o, w, h, bx * 4, by * 4, tb); } }
        return o;
    }
    let g = |k: usize| s.get(k).copied().unwrap_or(0);
    let g16 = |k: usize| g(k) as u32 | (g(k + 1) as u32) << 8;
    for i in 0..n {
        let d = i * 4; let (r, gg, b, a): (u32, u32, u32, u32);
        match fmt {
            0 | 23 | 26 => { r = g(i * 4) as u32; gg = g(i * 4 + 1) as u32; b = g(i * 4 + 2) as u32; a = g(i * 4 + 3) as u32; }
            1 => { a = g(i * 4) as u32; b = g(i * 4 + 1) as u32; gg = g(i * 4 + 2) as u32; r = g(i * 4 + 3) as u32; }
            2 | 9 => { r = g(i * 3) as u32; gg = g(i * 3 + 1) as u32; b = g(i * 3 + 2) as u32; a = if fmt == 9 && r == 0 && gg == 0 && b == 255 { 0 } else { 255 }; }
            3 | 10 => { b = g(i * 3) as u32; gg = g(i * 3 + 1) as u32; r = g(i * 3 + 2) as u32; a = if fmt == 10 && r == 0 && gg == 0 && b == 255 { 0 } else { 255 }; }
            4 => { let c = g16(i * 2); r = ((c >> 11) & 31) * 255 / 31; gg = ((c >> 5) & 63) * 255 / 63; b = (c & 31) * 255 / 31; a = 255; }
            17 => { let c = g16(i * 2); b = ((c >> 11) & 31) * 255 / 31; gg = ((c >> 5) & 63) * 255 / 63; r = (c & 31) * 255 / 31; a = 255; }
            5 => { r = g(i) as u32; gg = r; b = r; a = 255; }
            6 => { r = g(i * 2) as u32; gg = r; b = r; a = g(i * 2 + 1) as u32; }
            8 => { r = 255; gg = 255; b = 255; a = g(i) as u32; }
            11 => { a = g(i * 4) as u32; r = g(i * 4 + 1) as u32; gg = g(i * 4 + 2) as u32; b = g(i * 4 + 3) as u32; }
            12 => { b = g(i * 4) as u32; gg = g(i * 4 + 1) as u32; r = g(i * 4 + 2) as u32; a = g(i * 4 + 3) as u32; }
            16 => { b = g(i * 4) as u32; gg = g(i * 4 + 1) as u32; r = g(i * 4 + 2) as u32; a = 255; }
            18 | 21 => { let c = g16(i * 2); b = ((c >> 10) & 31) * 255 / 31; gg = ((c >> 5) & 31) * 255 / 31; r = (c & 31) * 255 / 31; a = if fmt == 21 { if c & 0x8000 != 0 { 255 } else { 0 } } else { 255 }; }
            19 => { let c = g16(i * 2); b = ((c >> 12) & 15) * 17; gg = ((c >> 8) & 15) * 17; r = ((c >> 4) & 15) * 17; a = (c & 15) * 17; }
            22 => { r = g(i * 2) as u32; gg = g(i * 2 + 1) as u32; b = 255; a = 255; }
            24 => { let f = |k: usize| { let v = h2f(g16(i * 8 + k * 2) as u16); (255.0 * (v / (1.0 + v)).max(0.0).powf(1.0 / 2.2)).round() as u32 }; r = f(0); gg = f(1); b = f(2); a = (255.0 * h2f(g16(i * 8 + 6) as u16)).round().clamp(0.0, 255.0) as u32; }
            25 => { r = g(i * 8 + 1) as u32; gg = g(i * 8 + 3) as u32; b = g(i * 8 + 5) as u32; a = g(i * 8 + 7) as u32; }
            _ => { r = 255; gg = 0; b = 255; a = 255; }
        }
        o[d] = r.min(255) as u8; o[d + 1] = gg.min(255) as u8; o[d + 2] = b.min(255) as u8; o[d + 3] = a.min(255) as u8;
    }
    o
}

// ---------------- .mdl ----------------
#[derive(Clone, Debug)]
pub struct Disparador { pub inv: f32, pub tq: [f32; 4], pub pos: [f32; 3], pub q: [f32; 4] }
#[derive(Clone, Debug)]
pub struct Hueso { pub n: String, pub pa: i32, pub pos: [f32; 3], pub q: [f32; 4], pub rot: [f32; 3], pub ps: [f32; 3], pub rs: [f32; 3], pub p2b: [f32; 12], pub superficie: String, pub proc: Option<(usize, Vec<Disparador>)> }
#[derive(Clone, Debug)]
pub struct Adjunto { pub n: String, pub hueso: i32, pub m: [f32; 12] }
#[derive(Clone, Debug)]
pub struct MallaMdl { pub mat: i32, pub nv: i32, pub voff: i32 }
#[derive(Clone, Debug)]
pub struct ModeloMdl { pub n: String, pub nv: i32, pub vi: i32, pub mallas: Vec<MallaMdl> }
#[derive(Clone, Debug)]
pub struct CuerpoMdl { pub n: String, pub modelos: Vec<ModeloMdl> }
#[derive(Clone, Debug)]
pub struct Mov { pub fin: i32, pub v0: f32, pub v1: f32, pub ang: f32, pub vec: [f32; 3], pub pos: [f32; 3] }
#[derive(Clone)]
pub struct Anim {
    pub n: String, pub o: i64, pub fps: f32, pub flags: i32, pub nf: i32, pub bloque: i32, pub idx: i32, pub sidx: i32, pub sfr: i32, pub mov: Vec<Mov>,
    /// de un modelo incluido: ese modelo, su número allá y a qué hueso de este va cada hueso suyo
    pub src: Option<(Rc<Mdl>, usize, Rc<Vec<i32>>)>,
}
#[derive(Clone, Debug)]
pub struct Evento { pub c: f32, pub ev: i32, pub tipo: i32, pub op: String, pub n: String }
#[derive(Clone, Debug)]
pub struct Secuencia {
    pub n: String, pub act: String, pub peso: i32, pub flags: i32, pub lp: bool, pub anim: i32, pub o: i64, pub wl: i32,
    pub g: [i32; 2], pub par: [i32; 2], pub ps: [f32; 2], pub pe: [f32; 2], pub grid: Option<Vec<i32>>, pub claves: Option<[Vec<f32>; 2]>, pub ev: Vec<Evento>, pub inc: bool,
}
/// los vértices del .vvd
#[derive(Clone, Debug, Default)]
pub struct Vertices { pub n: usize, pub pos: Vec<[f32; 3]>, pub nor: Vec<[f32; 3]>, pub uv: Vec<[f32; 2]>, pub hb: Vec<[u8; 3]>, pub w: Vec<[f32; 3]> }
#[derive(Clone, Debug)]
pub struct MallaGeo { pub cuerpo: usize, pub modelo: usize, pub mat: i32, pub tris: Vec<u32> }
#[derive(Clone)]
pub struct Mdl {
    pub version: i32, pub nombre: String, pub hull: [[f32; 3]; 2], pub flags: i32,
    pub huesos: Vec<Hueso>, pub texturas: Vec<String>, pub carpetas: Vec<String>, pub pieles: Vec<Vec<i16>>, pub adjuntos: Vec<Adjunto>, pub cuerpos: Vec<CuerpoMdl>,
    pub anims: Vec<Anim>, pub secuencias: Vec<Secuencia>, pub pose_params: Vec<String>, pub pose_rangos: Vec<[f32; 2]>,
    pub ani_nom: String, pub bloques: Vec<[i32; 2]>, pub b: Rc<[u8]>, pub ani: Option<Rc<[u8]>>,
    pub v: Option<Vertices>, pub mallas: Vec<MallaGeo>,
}
/// GMF.mdl (con el .vvd y el .vtx, la geometría)
pub fn mdl(b: Rc<[u8]>, vvd: Option<&[u8]>, vtx: Option<&[u8]>) -> Result<Mdl, String> {
    let m: &[u8] = &b;
    if m.len() < 408 || &m[0..4] != b"IDST" { return Err("no es un .mdl".into()); }
    let l = m.len() as i64;
    let (i32_, f32_) = (|o: i64| i32a(m, o), |o: i64| f32a(m, o));
    let p3 = |o: i64| [f32_(o), f32_(o + 4), f32_(o + 8)];
    let (nb, bi) = (i32_(156).max(0) as i64, i32_(160) as i64);
    let mut huesos = vec![];
    if bi > 0 && bi + nb * 216 <= l {
        for k in 0..nb.min(512) {
            let o = bi + k * 216; let mut p2b = [0f32; 12]; for (j, e) in p2b.iter_mut().enumerate() { *e = f32_(o + 96 + j as i64 * 4); }
            let (pt, pix) = (i32_(o + 164), i32_(o + 168) as i64);
            let mut proc = None;
            if pt == 2 && pix > 0 && o + pix + 12 <= l {
                let b0 = o + pix; let (ctrl, nt, ti) = (i32_(b0), i32_(b0 + 4), i32_(b0 + 8) as i64); let mut tr = vec![];
                for t in 0..nt.clamp(0, 32) as i64 { let q = b0 + ti + t * 48; if q + 48 > l || q < 0 { break; } tr.push(Disparador { inv: f32_(q), tq: [f32_(q + 4), f32_(q + 8), f32_(q + 12), f32_(q + 16)], pos: [f32_(q + 20), f32_(q + 24), f32_(q + 28)], q: [f32_(q + 32), f32_(q + 36), f32_(q + 40), f32_(q + 44)] }); }
                if !tr.is_empty() && ctrl >= 0 && (ctrl as i64) < nb { proc = Some((ctrl as usize, tr)); }
            }
            huesos.push(Hueso { n: cad(m, o + i32_(o) as i64), pa: i32_(o + 4), pos: p3(o + 32), q: [f32_(o + 44), f32_(o + 48), f32_(o + 52), f32_(o + 56)], rot: p3(o + 60), ps: p3(o + 72), rs: p3(o + 84), p2b, superficie: cad(m, o + i32_(o + 160) as i64), proc });
        }
    }
    let (ntex, txi, ncd, cdi, nsr, nsf, ski, nbp, bpi) = (i32_(204).clamp(0, 1024) as i64, i32_(208) as i64, i32_(212).clamp(0, 256) as i64, i32_(216) as i64, i32_(220).clamp(0, 1024) as i64, i32_(224).clamp(0, 256) as i64, i32_(228) as i64, i32_(232).clamp(0, 256) as i64, i32_(236) as i64);
    let texturas = (0..ntex).map(|k| { let o = txi + k * 64; ruta_n(&cad(m, o + i32_(o) as i64)) }).collect();
    let carpetas = (0..ncd).map(|k| ruta_n(&cad(m, i32_(cdi + k * 4) as i64)).trim_start_matches('/').to_string()).collect();
    let pieles = (0..nsf.max(1)).map(|f| (0..nsr).map(|r| i16a(m, ski + (f * nsr + r) * 2)).collect()).collect();
    let (nat, ati) = (i32_(240).clamp(0, 512) as i64, i32_(244) as i64);
    let adjuntos = (0..nat).filter(|k| ati + k * 92 + 92 <= l).map(|k| { let o = ati + k * 92; let mut mm = [0f32; 12]; for (j, e) in mm.iter_mut().enumerate() { *e = f32_(o + 12 + j as i64 * 4); } Adjunto { n: cad(m, o + i32_(o) as i64), hueso: i32_(o + 8), m: mm } }).collect();
    let mut cuerpos = vec![];
    for k in 0..nbp {
        let o = bpi + k * 16; let (nn, nm, mi) = (i32_(o) as i64, i32_(o + 4).clamp(0, 64) as i64, i32_(o + 12) as i64); let mut mods = vec![];
        for j in 0..nm {
            let mo = o + mi + j * 148; let (nme, nmi, nv, vi) = (i32_(mo + 72).clamp(0, 512) as i64, i32_(mo + 76) as i64, i32_(mo + 80), i32_(mo + 84));
            let mallas = (0..nme).map(|t| { let me = mo + nmi + t * 116; MallaMdl { mat: i32_(me), nv: i32_(me + 8), voff: i32_(me + 12) } }).collect();
            mods.push(ModeloMdl { n: cad(m, mo), nv, vi: vi / 48, mallas });
        }
        cuerpos.push(CuerpoMdl { n: cad(m, o + nn), modelos: mods });
    }
    let (nan, ani) = (i32_(180).max(0) as i64, i32_(184) as i64); let mut anims = vec![];
    for k in 0..nan.min(4096) {
        let o = ani + k * 100; if o < 0 || o + 100 > l { break; }
        let (nm, mi) = (i32_(o + 20), i32_(o + 24) as i64); let mut mov = vec![];
        if nm > 0 && nm <= 64 && mi > 0 && o + mi + nm as i64 * 44 <= l { for j in 0..nm as i64 { let q = o + mi + j * 44; mov.push(Mov { fin: i32_(q), v0: f32_(q + 8), v1: f32_(q + 12), ang: f32_(q + 16), vec: p3(q + 20), pos: p3(q + 32) }); } }
        anims.push(Anim { n: cad(m, o + i32_(o + 4) as i64), o, fps: f32_(o + 8), flags: i32_(o + 12), nf: i32_(o + 16), bloque: i32_(o + 52), idx: i32_(o + 56), sidx: i32_(o + 80), sfr: i32_(o + 84), mov, src: None });
    }
    let (nseq, sqi) = (i32_(188).max(0) as i64, i32_(192) as i64); let mut secuencias = vec![];
    for k in 0..nseq.min(2048) {
        let o = sqi + k * 212; if o < 0 || o + 212 > l { break; }
        let (fl, aii) = (i32_(o + 12), i32_(o + 60) as i64);
        let anim = i16a(m, o + aii) as i32;
        let g = [i32_(o + 68).max(1), i32_(o + 72).max(1)];
        let mut q = Secuencia { n: cad(m, o + i32_(o + 4) as i64), act: cad(m, o + i32_(o + 8) as i64), peso: i32_(o + 16), flags: fl, lp: fl & 1 != 0, anim, o, wl: i32_(o + 156), g, par: [-1, -1], ps: [0.0; 2], pe: [1.0; 2], grid: None, claves: None, ev: vec![], inc: false };
        if g[0] * g[1] > 1 && g[0] * g[1] <= 64 {
            q.par = [i32_(o + 76), i32_(o + 80)]; q.ps = [f32_(o + 84), f32_(o + 88)]; q.pe = [f32_(o + 92), f32_(o + 96)];
            if o + aii + (g[0] * g[1]) as i64 * 2 <= l { q.grid = Some((0..(g[0] * g[1]) as i64).map(|j| i16a(m, o + aii + j * 2) as i32).collect()); }
            let pk = i32_(o + 160) as i64;
            if pk > 0 && o + pk + (g[0] + g[1]) as i64 * 4 <= l { let cl = |a: i64| (0..g[a as usize] as i64).map(|j| f32_(o + pk + (a * g[0] as i64 + j) * 4)).collect::<Vec<f32>>(); q.claves = Some([cl(0), cl(1)]); }
        }
        let (nev, evi) = (i32_(o + 24), i32_(o + 28) as i64);
        if nev > 0 && nev <= 64 && evi > 0 { for j in 0..nev as i64 { let eo = o + evi + j * 80; if eo + 80 > l { break; } let ni = i32_(eo + 76) as i64; q.ev.push(Evento { c: f32_(eo), ev: i32_(eo + 4), tipo: i32_(eo + 8), op: cad(m, eo + 12), n: if ni != 0 { cad(m, eo + ni) } else { String::new() } }); } }
        secuencias.push(q);
    }
    let (mut pose_params, mut pose_rangos) = (vec![], vec![]);
    { let (npp, ppi) = (i32_(300).clamp(0, 32) as i64, i32_(304) as i64); for k in 0..npp { let o = ppi + k * 20; if o < 0 || o + 20 > l { break; } pose_params.push(cad(m, o + i32_(o) as i64)); pose_rangos.push([f32_(o + 8), f32_(o + 12)]); } }
    let (mut ani_nom, mut bloques) = (String::new(), vec![]);
    { let (no, nbl, bli) = (i32_(348) as i64, i32_(352) as i64, i32_(356) as i64);
      if nbl > 1 && nbl < 4096 && bli > 0 && bli + nbl * 8 <= l { for k in 0..nbl { bloques.push([i32_(bli + k * 8), i32_(bli + k * 8 + 4)]); } if no > 0 && no < l { ani_nom = ruta_n(&cad(m, no)).trim_start_matches('/').to_string(); } } }
    let mut md = Mdl { version: i32_(4), nombre: cad(m, 12), hull: [p3(104), p3(116)], flags: i32_(152), huesos, texturas, carpetas, pieles, adjuntos, cuerpos, anims, secuencias, pose_params, pose_rangos, ani_nom, bloques, b: b.clone(), ani: None, v: None, mallas: vec![] };
    if let (Some(vvd), Some(vtx)) = (vvd, vtx) { geo(&mut md, vvd, vtx)?; }
    Ok(md)
}

/// la pose local de cada hueso (posición en pulgadas y cuaternión de Source)
#[derive(Clone)]
pub struct Pose { pub p: Vec<[f32; 3]>, pub q: Vec<[f32; 4]>, pub ok: bool, pub falta: bool }
fn ang_q(x: f32, y: f32, z: f32) -> [f32; 4] {
    let (sr, cr, sp, cp, sy, cy) = ((x / 2.0).sin(), (x / 2.0).cos(), (y / 2.0).sin(), (y / 2.0).cos(), (z / 2.0).sin(), (z / 2.0).cos());
    let (srcp, crsp, crcp, srsp) = (sr * cp, cr * sp, cr * cp, sr * sp);
    [srcp * cy - crsp * sy, crsp * cy + srcp * sy, crcp * sy - srsp * cy, crcp * cy + srsp * sy]
}
fn pose_base(m: &Mdl, delta: bool) -> Pose {
    let nb = m.huesos.len();
    if delta { Pose { p: vec![[0.0; 3]; nb], q: vec![[0.0, 0.0, 0.0, 1.0]; nb], ok: false, falta: false } }
    else { Pose { p: m.huesos.iter().map(|h| h.pos).collect(), q: m.huesos.iter().map(|h| h.q).collect(), ok: false, falta: false } }
}
/// GMF.pose: el cuadro entero `f` de la animación `ia`
pub fn pose(m: &Mdl, ia: usize, f: i32) -> Pose {
    let a = match m.anims.get(ia) { Some(a) => a, None => return pose_base(m, false) };
    if let Some((src, si, mapa)) = &a.src { return pose_incluida(m, src, *si, mapa, a.flags, f); }
    let delta = a.flags & 4 != 0; let mut ps = pose_base(m, delta); let nb = m.huesos.len();
    let bm: &[u8] = &m.b; let mut f = f.clamp(0, (a.nf - 1).max(0));
    let (mut blk, mut idx) = (a.bloque, a.idx as i64);
    if a.sfr > 0 { let sec = f / a.sfr; let so = a.o + a.sidx as i64 + sec as i64 * 8; if so + 8 > bm.len() as i64 { return ps; } blk = i32a(bm, so); idx = i32a(bm, so + 4) as i64; f -= sec * a.sfr; }
    let (b, mut o): (&[u8], i64) = if blk == 0 { (bm, a.o + idx) } else {
        let bl = if blk > 0 { m.bloques.get(blk as usize) } else { None };
        match (&m.ani, bl) { (Some(an), Some(bl)) => (an, bl[0] as i64 + idx), (None, Some(_)) => { ps.falta = true; return ps; } _ => return ps }
    };
    let valor = |mut o: i64, mut k: i32, esc: f32| -> f32 {
        for _ in 0..4096 { let (valid, total) = (u8a(b, o as usize) as i32, u8a(b, o as usize + 1) as i32); if total == 0 { return 0.0; } if total > k { return (if valid > k { i16a(b, o + (k as i64 + 1) * 2) } else { i16a(b, o + valid as i64 * 2) }) as f32 * esc; } k -= total; o += (valid as i64 + 1) * 2; }
        0.0
    };
    let mut guard = 0;
    while guard < 512 && o > 0 && o + 4 <= b.len() as i64 {
        guard += 1;
        let (hb, fl, nxt) = (u8a(b, o as usize) as usize, u8a(b, o as usize + 1), i16a(b, o + 2) as i64); if hb >= nb { break; }
        let h = &m.huesos[hb]; let mut d = o + 4;
        if fl & 0x02 != 0 {
            let (x, y, zw) = (u16a(b, d) as f32, u16a(b, d + 2) as f32, u16a(b, d + 4)); let (qx, qy, qz) = ((x - 32768.0) / 32768.0, (y - 32768.0) / 32768.0, ((zw & 0x7fff) as f32 - 16384.0) / 16384.0);
            let qw = (1.0 - qx * qx - qy * qy - qz * qz).max(0.0).sqrt() * if zw >> 15 != 0 { -1.0 } else { 1.0 }; ps.q[hb] = [qx, qy, qz, qw]; d += 6;
        } else if fl & 0x20 != 0 {
            let v = (u32a(b, d) as u64) | ((u32a(b, d + 4) as u64) << 32); let mk = 0x1f_ffffu64;
            let c = |s: u32| (((v >> s) & mk) as i64 - 1048576) as f64 / 1048576.5;
            let (qx, qy, qz) = (c(0), c(21), c(42)); let qw = (1.0 - qx * qx - qy * qy - qz * qz).max(0.0).sqrt() * if v >> 63 != 0 { -1.0 } else { 1.0 };
            ps.q[hb] = [qx as f32, qy as f32, qz as f32, qw as f32]; d += 8;
        } else if fl & 0x08 != 0 {
            let mut an = [0f32; 3]; for i in 0..3 { let of = i16a(b, d + i as i64 * 2) as i64; an[i] = if of != 0 { valor(d + of, f, h.rs[i]) } else { 0.0 }; }
            if !delta { for i in 0..3 { an[i] += h.rot[i]; } } ps.q[hb] = ang_q(an[0], an[1], an[2]); d += 6;
        }
        if fl & 0x01 != 0 { for i in 0..3 { ps.p[hb][i] = h2f(u16a(b, d + i as i64 * 2)); } }
        else if fl & 0x04 != 0 { for i in 0..3 { let of = i16a(b, d + i as i64 * 2) as i64; let v = if of != 0 { valor(d + of, f, h.ps[i]) } else { 0.0 }; ps.p[hb][i] = if delta { v } else { v + h.pos[i] }; } }
        if nxt == 0 { break; } o += nxt;
    }
    ps.ok = true; ps
}
fn pose_incluida(m: &Mdl, src: &Mdl, si: usize, mapa: &[i32], flags: i32, f: i32) -> Pose {
    let r = pose(src, si, f); let mut ps = pose_base(m, flags & 4 != 0);
    if !r.ok { ps.falta = r.falta; return ps; }
    for (j, &k) in mapa.iter().enumerate() { if k < 0 { continue; } let k = k as usize; if k < ps.p.len() && j < r.p.len() { ps.p[k] = r.p[j]; ps.q[k] = r.q[j]; } }
    ps.ok = true; ps
}
/// GMF.incluidos: las rutas de los modelos incluidos ($includemodel)
pub fn incluidos(m: &Mdl) -> Vec<String> {
    let b: &[u8] = &m.b; let mut out = vec![]; if b.len() < 344 { return out; }
    let (n, o) = (i32a(b, 336) as i64, i32a(b, 340) as i64);
    if !(n > 0 && n <= 32 && o > 0 && o + n * 8 <= b.len() as i64) { return out; }
    for j in 0..n {
        let so = o + j * 8; let ni = i32a(b, so + 4) as i64; if ni == 0 || so + ni >= b.len() as i64 { continue; }
        let mut r = ruta_n(&cad(b, so + ni)).trim_start_matches('/').to_string(); if r.is_empty() { continue; }
        if !r.starts_with("models/") { r = format!("models/{r}"); } if !r.ends_with(".mdl") { r.push_str(".mdl"); }
        if !out.contains(&r) { out.push(r); }
    }
    out
}
/// GMF.unirIncluido: suma las animaciones y secuencias de un modelo incluido; devuelve cuántas secuencias sumó
pub fn unir_incluido(m: &mut Mdl, im: Rc<Mdl>) -> usize {
    let mut nom: HashMap<String, i32> = HashMap::new(); for (i, h) in m.huesos.iter().enumerate() { nom.entry(h.n.to_lowercase()).or_insert(i as i32); }
    let mapa: Vec<i32> = im.huesos.iter().map(|h| nom.get(&h.n.to_lowercase()).copied().unwrap_or(-1)).collect();
    if !mapa.iter().any(|&k| k >= 0) { return 0; }
    let mapa = Rc::new(mapa); let base = m.anims.len() as i32;
    for (k, a) in im.anims.iter().enumerate() { let mut x = a.clone(); x.src = Some((im.clone(), k, mapa.clone())); m.anims.push(x); }
    let pp = |m: &mut Mdl, i: i32| -> i32 {
        let Some(n) = im.pose_params.get(i.max(0) as usize).filter(|_| i >= 0) else { return i };
        match m.pose_params.iter().position(|x| x == n) { Some(j) => j as i32, None => { m.pose_params.push(n.clone()); m.pose_rangos.push(im.pose_rangos.get(i as usize).copied().unwrap_or([0.0, 1.0])); m.pose_params.len() as i32 - 1 } }
    };
    for i in 0..im.pose_params.len() { pp(m, i as i32); }
    let mut ya: std::collections::HashSet<String> = m.secuencias.iter().map(|q| q.n.to_lowercase()).collect(); let mut n = 0;
    for q in &im.secuencias {
        let k = q.n.to_lowercase(); if ya.contains(&k) { continue; }
        let mut c = q.clone(); c.anim = if q.anim >= 0 { q.anim + base } else { -1 }; c.inc = true;
        if let Some(gr) = &q.grid { c.grid = Some(gr.iter().map(|&a| if a >= 0 { a + base } else { a }).collect()); }
        if q.grid.is_some() { c.par = [pp(m, q.par[0]), pp(m, q.par[1])]; }
        m.secuencias.push(c); ya.insert(k); n += 1;
    }
    n
}
/// GMF.mezcla: hasta cuatro animaciones de la grilla con su peso
pub fn mezcla(m: &Mdl, k: usize, vals: &dyn Fn(&str) -> Option<f32>) -> Vec<(usize, f32)> {
    let Some(q) = m.secuencias.get(k) else { return vec![] };
    let ok = |a: i32| a >= 0 && (a as usize) < m.anims.len();
    let Some(grid) = q.grid.as_ref().filter(|g| !g.is_empty()) else { return if ok(q.anim) { vec![(q.anim as usize, 1.0)] } else { vec![] } };
    let (mut ix, mut s) = ([0i32; 2], [0f32; 2]);
    for a in 0..2 {
        let (g, pi) = (q.g[a], q.par[a]); if g <= 1 || pi < 0 { continue; }
        let Some(nom) = m.pose_params.get(pi as usize) else { continue };
        let r = m.pose_rangos.get(pi as usize).copied().unwrap_or([q.ps[a], q.pe[a]]); let (lo, hi) = (r[0].min(r[1]), r[0].max(r[1]));
        let v = vals(nom).unwrap_or(0.0).clamp(lo, hi);
        let mut i = 0i32; let mut t: f32;
        if let Some(kk) = &q.claves { let kk = &kk[a]; loop { let (k0, k1) = (kk.get(i as usize).copied().unwrap_or(0.0), kk.get(i as usize + 1).copied().unwrap_or(0.0)); let d = k1 - k0; t = if d.abs() > 1e-9 { (v - k0) / d } else { 0.0 }; if i < g - 2 && t > 1.0 { i += 1; continue; } break; } }
        else { let d = q.pe[a] - q.ps[a]; t = if d.abs() > 1e-9 { ((v - q.ps[a]) / d).clamp(0.0, 1.0) } else { 0.0 }; if g > 2 { i = (g - 2).min((t * (g - 1) as f32).floor() as i32); t = t * (g - 1) as f32 - i as f32; } }
        ix[a] = i; s[a] = t.clamp(0.0, 1.0);
    }
    let mut l: Vec<(usize, f32)> = vec![]; let g0 = q.g[0];
    let mut pon = |x: i32, y: i32, w: f32| { if !(w > 1e-6) { return; } let Some(&a) = grid.get((x + y * g0) as usize) else { return }; if !ok(a) { return; } if let Some(e) = l.iter_mut().find(|e| e.0 == a as usize) { e.1 += w; } else { l.push((a as usize, w)); } };
    pon(ix[0], ix[1], (1.0 - s[0]) * (1.0 - s[1])); pon(ix[0] + 1, ix[1], s[0] * (1.0 - s[1])); pon(ix[0], ix[1] + 1, (1.0 - s[0]) * s[1]); pon(ix[0] + 1, ix[1] + 1, s[0] * s[1]);
    l
}
/// GMF.animDe: la animación de más peso
pub fn anim_de(m: &Mdl, k: usize, vals: &dyn Fn(&str) -> Option<f32>) -> i32 {
    let Some(q) = m.secuencias.get(k) else { return -1 };
    if q.grid.as_ref().map(|g| g.is_empty()).unwrap_or(true) { return q.anim; }
    let (mut a, mut w) = (-1i32, -1f32); for (ia, x) in mezcla(m, k, vals) { if x > w { w = x; a = ia as i32; } }
    if a >= 0 { a } else { q.anim }
}
fn anim_pos(a: &Anim, c: f32) -> Option<([f32; 3], f32)> {
    let l = &a.mov; if l.is_empty() { return None; }
    let vueltas = if c > 1.0 { c.trunc() } else if c < 0.0 { c.trunc() - 1.0 } else { 0.0 }; let fr = (c - vueltas) * (a.nf - 1).max(0) as f32;
    let (mut ant, mut p, mut y) = (0f32, [0f32; 3], 0f32);
    for mv in l {
        if mv.fin as f32 >= fr {
            let f = if mv.fin as f32 > ant { (fr - ant) / (mv.fin as f32 - ant) } else { 1.0 }; let d = mv.v0 * f + 0.5 * (mv.v1 - mv.v0) * f * f;
            p = [p[0] + d * mv.vec[0], p[1] + d * mv.vec[1], p[2] + d * mv.vec[2]]; y = y * (1.0 - f) + mv.ang * f;
            if vueltas != 0.0 { let u = &l[l.len() - 1]; for i in 0..3 { p[i] += vueltas * u.pos[i]; } y += vueltas * u.ang; }
            return Some((p, y));
        }
        ant = mv.fin as f32; p = mv.pos; y = mv.ang;
    }
    None
}
/// GMF.secMov: lo que avanza la secuencia entre dos ciclos (pulgadas, en los ejes de su arranque, y el giro en yaw)
pub fn sec_mov(m: &Mdl, k: usize, vals: &dyn Fn(&str) -> Option<f32>, c0: f32, c1: f32) -> (bool, [f32; 3], f32) {
    let (mut p, mut y, mut ok) = ([0f32; 3], 0f32, false);
    for (ia, w) in mezcla(m, k, vals) {
        let a = &m.anims[ia];
        if let (Some(x), Some(z)) = (anim_pos(a, c0), anim_pos(a, c1)) {
            let r = -x.1.to_radians(); let (cs, sn) = (r.cos(), r.sin()); let (dx, dy) = (z.0[0] - x.0[0], z.0[1] - x.0[1]);
            p[0] += (dx * cs - dy * sn) * w; p[1] += (dx * sn + dy * cs) * w; p[2] += (z.0[2] - x.0[2]) * w; y += (z.1 - x.1) * w; ok = true;
        } else if a.flags & 4 == 0 && a.mov.is_empty() { ok = true; }
    }
    (ok, p, y)
}
/// GMF.secDur: lo que dura una secuencia (s)
pub fn sec_dur(m: &Mdl, k: usize, vals: &dyn Fn(&str) -> Option<f32>) -> f32 {
    let mut cps = 0.0; for (ia, w) in mezcla(m, k, vals) { let a = &m.anims[ia]; if a.nf > 1 { cps += (if a.fps > 0.0 { a.fps } else { 30.0 } / (a.nf - 1) as f32) * w; } }
    if cps > 0.0 { 1.0 / cps } else { 0.0 }
}
/// GMF.secVelSuelo: pulgadas por segundo
pub fn sec_vel_suelo(m: &Mdl, k: usize, vals: &dyn Fn(&str) -> Option<f32>) -> f32 {
    let t = sec_dur(m, k, vals); if !(t > 0.0) { return 0.0; }
    let (ok, p, _) = sec_mov(m, k, vals, 0.0, 1.0); if ok { (p[0] * p[0] + p[1] * p[1] + p[2] * p[2]).sqrt() / t } else { 0.0 }
}
/// una capa de las que Source suma siempre (secuencias delta + autoplay)
pub struct Capa { pub ia: usize, pub post: bool, pub w: Option<Vec<f32>>, pub nf: i32 }
/// GMF.capas
pub fn capas(m: &Mdl) -> Vec<Capa> {
    let mut l = vec![]; let nb = m.huesos.len(); let b: &[u8] = &m.b;
    for q in &m.secuencias {
        if q.flags & 0x0c != 0x0c || q.anim < 0 { continue; }
        let Some(a) = m.anims.get(q.anim as usize) else { continue }; if a.bloque != 0 || a.nf < 1 || a.src.is_some() { continue; }
        let w = if q.wl != 0 && q.o + q.wl as i64 + nb as i64 * 4 <= b.len() as i64 { Some((0..nb).map(|h| f32a(b, q.o + q.wl as i64 + h as i64 * 4)).collect()) } else { None };
        l.push(Capa { ia: q.anim as usize, post: q.flags & 0x10 != 0, w, nf: a.nf });
    }
    l
}
/// GMF.poseCapas: la pose con las capas encima (`cs`: las de `capas`, para no buscarlas cada vez)
pub fn pose_capas(m: &Mdl, cs: &[Capa], ia: usize, f: i32) -> Pose {
    let mut ps = pose(m, ia, f); if !ps.ok || m.anims.get(ia).map(|a| a.flags & 4 != 0).unwrap_or(false) || cs.is_empty() { return ps; }
    let nb = m.huesos.len();
    for c in cs {
        let fr = if c.nf > 1 { f.clamp(0, c.nf - 1) } else { 0 }; let d = pose(m, c.ia, fr); if !d.ok { continue; }
        for h in 0..nb {
            let s = c.w.as_ref().map(|w| w[h]).unwrap_or(1.0); if !(s > 0.0) { continue; }
            for k in 0..3 { ps.p[h][k] += d.p[h][k] * s; }
            let [mut dx, mut dy, mut dz, mut dw] = d.q[h];
            if s < 0.999 { if dw < 0.0 { dx = -dx; dy = -dy; dz = -dz; dw = -dw; } dx *= s; dy *= s; dz *= s; dw = dw * s + (1.0 - s); }
            let qq = ps.q[h]; let (a, b) = if c.post { (qq, [dx, dy, dz, dw]) } else { ([dx, dy, dz, dw], qq) };
            ps.q[h] = qnorm(qmul(a, b));
        }
    }
    ps
}
pub fn qmul(a: [f32; 4], b: [f32; 4]) -> [f32; 4] {
    let ([ax, ay, az, aw], [bx, by, bz, bw]) = (a, b);
    [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz]
}
pub fn qnorm(q: [f32; 4]) -> [f32; 4] { let l = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt(); let l = if l > 0.0 { l } else { 1.0 }; [q[0] / l, q[1] / l, q[2] / l, q[3] / l] }
/// la matriz 3×4 (filas) de una posición y un cuaternión
pub fn m34(p: [f32; 3], q: [f32; 4]) -> [f32; 12] {
    let [x, y, z, w] = q;
    [1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y - z * w), 2.0 * (x * z + y * w), p[0], 2.0 * (x * y + z * w), 1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z - x * w), p[1], 2.0 * (x * z - y * w), 2.0 * (y * z + x * w), 1.0 - 2.0 * (x * x + y * y), p[2]]
}
/// _m34: el producto de dos 3×4
pub fn mul34(a: &[f32; 12], b: &[f32; 12]) -> [f32; 12] {
    [a[0] * b[0] + a[1] * b[4] + a[2] * b[8], a[0] * b[1] + a[1] * b[5] + a[2] * b[9], a[0] * b[2] + a[1] * b[6] + a[2] * b[10], a[0] * b[3] + a[1] * b[7] + a[2] * b[11] + a[3],
     a[4] * b[0] + a[5] * b[4] + a[6] * b[8], a[4] * b[1] + a[5] * b[5] + a[6] * b[9], a[4] * b[2] + a[5] * b[6] + a[6] * b[10], a[4] * b[3] + a[5] * b[7] + a[6] * b[11] + a[7],
     a[8] * b[0] + a[9] * b[4] + a[10] * b[8], a[8] * b[1] + a[9] * b[5] + a[10] * b[9], a[8] * b[2] + a[9] * b[6] + a[10] * b[10], a[8] * b[3] + a[9] * b[7] + a[10] * b[11] + a[11]]
}
/// los huesos en el espacio del modelo (W) de una pose
pub fn mundo_huesos(m: &Mdl, ps: &Pose) -> Vec<[f32; 12]> {
    let mut w: Vec<[f32; 12]> = Vec::with_capacity(m.huesos.len());
    for (i, h) in m.huesos.iter().enumerate() { let l = m34(ps.p[i], ps.q[i]); let pa = h.pa; w.push(if pa >= 0 && (pa as usize) < i { mul34(&w[pa as usize], &l) } else { l }); }
    w
}
/// la pose de reposo (GMF.poseReposo): S lleva cada vértice de la pose de enlace a la de la primera secuencia; W, cada hueso
pub struct Reposo { pub s: Vec<Option<[f32; 12]>>, pub w: Vec<[f32; 12]> }
pub fn pose_reposo(m: &Mdl) -> Option<Reposo> {
    if m.huesos.is_empty() || m.anims.is_empty() { return None; }
    let ia = m.secuencias.first().filter(|s| s.anim >= 0 && (s.anim as usize) < m.anims.len()).map(|s| s.anim as usize).unwrap_or(0);
    if m.anims[ia].flags & 4 != 0 { return None; }
    let ps = pose_capas(m, &capas(m), ia, 0); if !ps.ok { return None; }
    let w = mundo_huesos(m, &ps); let mut s = vec![]; let mut cambia = false;
    for (i, h) in m.huesos.iter().enumerate() {
        let si = mul34(&w[i], &h.p2b); s.push(Some(si));
        if !cambia { for k in 0..12 { let id = if k == 0 || k == 5 || k == 10 { 1.0 } else { 0.0 }; if (si[k] - id).abs() > if k == 3 || k == 7 || k == 11 { 0.5 } else { 2e-3 } { cambia = true; break; } } }
    }
    if cambia { Some(Reposo { s, w }) } else { None }
}
/// GMF.posar: los vértices y normales de la malla en esa pose
pub fn posar(m: &Mdl, rp: &Reposo) -> (Vec<[f32; 3]>, Vec<[f32; 3]>) {
    let Some(v) = &m.v else { return (vec![], vec![]) }; let (mut pp, mut nn) = (Vec::with_capacity(v.n), Vec::with_capacity(v.n));
    let ap = |m: &[f32; 12], p: [f32; 3], t: f32| [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3] * t, m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7] * t, m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11] * t];
    for k in 0..v.n {
        let (x, nr) = (v.pos[k], v.nor[k]); let (mut p, mut q, mut wt) = ([0f32; 3], [0f32; 3], 0f32);
        for j in 0..3 { let w = v.w[k][j]; if !(w > 0.0) { continue; } let Some(Some(mm)) = rp.s.get(v.hb[k][j] as usize) else { continue }; let a = ap(mm, x, 1.0); let b = ap(mm, nr, 0.0); for c in 0..3 { p[c] += w * a[c]; q[c] += w * b[c]; } wt += w; }
        if wt <= 0.0 { match rp.s.get(v.hb[k][0] as usize) { Some(Some(mm)) => { p = ap(mm, x, 1.0); q = ap(mm, nr, 0.0); } _ => { p = x; q = nr; } } wt = 1.0; }
        pp.push([p[0] / wt, p[1] / wt, p[2] / wt]); let l = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2]).sqrt(); let l = if l > 0.0 { l } else { 1.0 }; nn.push([q[0] / l, q[1] / l, q[2] / l]);
    }
    (pp, nn)
}
fn geo(m: &mut Mdl, vvd: &[u8], vtx: &[u8]) -> Result<(), String> {
    if vvd.len() < 64 || &vvd[0..4] != b"IDSV" { return Err("no es un .vvd".into()); }
    let (n0, nfx, fxs, vds) = (i32a(vvd, 16).max(0) as usize, i32a(vvd, 48).max(0) as i64, i32a(vvd, 52) as i64, i32a(vvd, 56) as i64);
    let mut orden: Option<Vec<usize>> = None;
    if nfx > 0 { let mut o = vec![]; for k in 0..nfx.min(65536) { let q = fxs + k * 12; let (lod, src, num) = (i32a(vvd, q), i32a(vvd, q + 4), i32a(vvd, q + 8)); if lod >= 0 { for j in 0..num.max(0) { o.push((src + j) as usize); } } } orden = Some(o); }
    let n = n0; if vds < 0 || vds as usize + n * 48 > vvd.len() { return Err("vvd cortado".into()); }
    let mut v = Vertices { n, pos: Vec::with_capacity(n), nor: Vec::with_capacity(n), uv: Vec::with_capacity(n), hb: Vec::with_capacity(n), w: Vec::with_capacity(n) };
    for k in 0..n {
        let s = orden.as_ref().and_then(|o| o.get(k).copied()).unwrap_or(k).min(n.saturating_sub(1)); let o = vds + s as i64 * 48; let nbn = u8a(vvd, o as usize + 15) as usize;
        let (mut w, mut hb, mut p, mut nr) = ([0f32; 3], [0u8; 3], [0f32; 3], [0f32; 3]);
        for c in 0..3 { w[c] = if c < nbn { f32a(vvd, o + c as i64 * 4) } else { 0.0 }; hb[c] = u8a(vvd, o as usize + 12 + c); p[c] = f32a(vvd, o + 16 + c as i64 * 4); nr[c] = f32a(vvd, o + 28 + c as i64 * 4); }
        v.w.push(w); v.hb.push(hb); v.pos.push(p); v.nor.push(nr); v.uv.push([f32a(vvd, o + 40), f32a(vvd, o + 44)]);
    }
    let (nbp, bpo) = (i32a(vtx, 28) as i64, i32a(vtx, 32) as i64);
    let leer = |tam: i64| -> Result<Vec<MallaGeo>, ()> {
        let mut out = vec![]; let lv = vtx.len() as i64;
        for k in 0..nbp.clamp(0, 256) {
            let o = bpo + k * 8; let (nm, mo) = (i32a(vtx, o) as i64, i32a(vtx, o + 4) as i64);
            for j in 0..nm.clamp(0, 64) {
                let om = o + mo + j * 8; let lo = i32a(vtx, om + 4) as i64; let ol = om + lo; let (nme, meo) = (i32a(vtx, ol) as i64, i32a(vtx, ol + 4) as i64);
                let md = m.cuerpos.get(k as usize).and_then(|c| c.modelos.get(j as usize)).ok_or(())?;
                for t in 0..nme.clamp(0, 512) {
                    let ome = ol + meo + t * 9; let (nsg, sgo) = (i32a(vtx, ome) as i64, i32a(vtx, ome + 4) as i64); let mm = md.mallas.get(t as usize).ok_or(())?;
                    let mut tris = vec![];
                    for g in 0..nsg.clamp(0, 256) {
                        let og = ome + sgo + g * tam; let (nv, vo, ni, io) = (i32a(vtx, og) as i64, i32a(vtx, og + 4) as i64, i32a(vtx, og + 8) as i64, i32a(vtx, og + 12) as i64);
                        if ni % 3 != 0 || nv < 0 || ni < 0 || og + io + ni * 2 > lv || og + vo + nv * 9 > lv || og < 0 { return Err(()); }
                        let base = (md.vi + mm.voff) as i64;
                        for x in 0..ni { let ii = u16a(vtx, og + io + x * 2) as i64; if ii >= nv { return Err(()); } let orig = u16a(vtx, og + vo + ii * 9 + 4) as i64 + base; if orig < 0 || orig as usize >= n { return Err(()); } tris.push(orig as u32); }
                    }
                    out.push(MallaGeo { cuerpo: k as usize, modelo: j as usize, mat: mm.mat, tris });
                }
            }
        }
        Ok(out)
    };
    let mallas = leer(25).or_else(|_| leer(33)).map_err(|_| "vtx ilegible".to_string())?;
    m.v = Some(v); m.mallas = mallas; Ok(())
}

// ---------------- .phy ----------------
pub struct Phy { pub solidos: Vec<Vec<Vec<[f32; 3]>>>, pub hueso: Vec<Option<String>>, pub masa: Option<f32>, pub superficie: Option<String> }
/// lo que sigue a una clave entre comillas: el siguiente texto entre comillas
fn kv_txt(t: &str, k: &str) -> Option<String> { let i = t.find(&format!("\"{k}\""))? + k.len() + 2; let r = &t[i..]; let a = r.find('"')?; let b = r[a + 1..].find('"')?; Some(r[a + 1..a + 1 + b].to_string()) }
/// GMF.phy: las piezas convexas de cada sólido (pulgadas, en el espacio de Source)
pub fn phy(b: &[u8]) -> Phy {
    let (hs, ns) = (i32a(b, 0) as i64, i32a(b, 8).clamp(0, 256) as i64); let l = b.len() as i64;
    let mut p = hs; let mut solidos = vec![];
    for _ in 0..ns {
        if p + 4 >= l { break; }
        let tam = i32a(b, p) as i64; let ini = p + 4; p = ini + tam.max(0); let mut piezas: Vec<Vec<[f32; 3]>> = vec![];
        if ini + 4 <= l && &b[ini as usize..ini as usize + 4] == b"VPHY" {
            let cs = ini + 28; let raiz = i32a(b, cs + 32) as i64; let fin = if raiz > 0 { cs + raiz } else { p };
            let pieza = |lp: i64, piezas: &mut Vec<Vec<[f32; 3]>>| {
                if lp < cs || lp + 16 > p { return; }
                let (pt_off, nt) = (i32a(b, lp) as i64, i16a(b, lp + 12) as i64); if nt <= 0 || nt > 4096 { return; }
                let mut usados: Vec<u32> = vec![];
                for t in 0..nt { let to = lp + 16 + t * 16; if to + 16 > p { return; } for e in 0..3 { let i = u32a(b, to + 4 + e * 4) & 0xffff; if !usados.contains(&i) { usados.push(i); } } }
                let mut pts = vec![];
                for i in usados { let o = lp + pt_off + i as i64 * 16; if o < cs || o + 12 > p { continue; } let (x, y, z) = (f32a(b, o), f32a(b, o + 4), f32a(b, o + 8)); pts.push([x / 0.0254, z / 0.0254, -y / 0.0254]); }
                if pts.len() >= 4 { piezas.push(pts); }
            };
            let mut hojas = vec![]; let mut visto = std::collections::HashSet::new();
            fn nodo(b: &[u8], o: i64, prof: u32, cs: i64, p: i64, hojas: &mut Vec<i64>, visto: &mut std::collections::HashSet<i64>) {
                if prof > 64 || o < cs || o + 28 > p || visto.contains(&o) || hojas.len() > 2048 { return; } visto.insert(o);
                let (der, led) = (i32a(b, o) as i64, i32a(b, o + 4) as i64);
                if der == 0 { hojas.push(o + led); return; }
                nodo(b, o + 28, prof + 1, cs, p, hojas, visto); nodo(b, o + der, prof + 1, cs, p, hojas, visto);
            }
            if raiz > 0 { nodo(b, cs + raiz, 0, cs, p, &mut hojas, &mut visto); }
            if !hojas.is_empty() { for lp in hojas { pieza(lp, &mut piezas); } }
            else { let (mut lp, mut guard) = (cs + 48, 0); while lp + 16 <= fin && guard < 4096 { guard += 1; let (bits, nt) = (u32a(b, lp + 8), i16a(b, lp + 12)); let taml = (bits >> 8) as i64 * 16; if taml <= 0 || nt <= 0 { break; } pieza(lp, &mut piezas); lp += taml; } }
        }
        solidos.push(piezas);
    }
    let texto = latin1(&b[(p.clamp(0, l)) as usize..]); let tl = texto.to_lowercase();
    let mut hueso: Vec<Option<String>> = vec![]; let mut masa_tot = 0f32; let mut i = 0;
    while let Some(k) = tl[i..].find("solid") {
        let a = i + k + 5; let r = tl[a..].trim_start(); if !r.starts_with('{') { i = a; continue; }
        let ini = tl.len() - r.len(); let fin = tl[ini..].find('}').map(|x| ini + x).unwrap_or(tl.len()); let bl = &texto[ini..fin];
        if let Some(ix) = kv_txt(bl, "index").and_then(|s| s.parse::<usize>().ok()) { if ix < 1024 { if hueso.len() <= ix { hueso.resize(ix + 1, None); } hueso[ix] = kv_txt(bl, "name").map(|s| s.to_lowercase()); } }
        i = fin.max(a);
    }
    let mut j = 0; while let Some(k) = texto[j..].find("\"mass\"") { let a = j + k; if let Some(v) = kv_txt(&texto[a..], "mass").and_then(|s| s.parse::<f32>().ok()) { masa_tot += v; } j = a + 6; }
    Phy { solidos, hueso, masa: if masa_tot > 0.0 { Some(masa_tot) } else { None }, superficie: kv_txt(&texto, "surfaceprop").map(|s| s.to_lowercase()) }
}
/// GMF.phyModelo: los puntos de las piezas en el espacio del modelo (con la pose de reposo, si la hay)
pub fn phy_modelo(ph: &Phy, m: &Mdl, rp: Option<&Reposo>) -> Vec<Vec<[f32; 3]>> {
    let mut out: Vec<Vec<[f32; 3]>> = vec![];
    for (s, piezas) in ph.solidos.iter().enumerate() {
        let nb = ph.hueso.get(s).cloned().flatten();
        let hi0: i64 = match &nb { Some(n) => m.huesos.iter().position(|h| h.n.to_lowercase() == *n).map(|x| x as i64).unwrap_or(-1), None => 0 };
        let hi = hi0.max(0) as usize; let h = m.huesos.get(hi);
        let mm = if nb.is_some() && hi0 < 0 { None } else { h.map(|h| h.p2b) };
        let wp = if mm.is_some() { rp.and_then(|r| r.w.get(hi)) } else { None };
        for f in piezas {
            let g = f.iter().map(|&[x, y, z]| {
                if let Some(w) = wp { return [w[0] * x + w[1] * y + w[2] * z + w[3], w[4] * x + w[5] * y + w[6] * z + w[7], w[8] * x + w[9] * y + w[10] * z + w[11]]; }
                match &mm { None => [x, y, z], Some(m) => { let (x, y, z) = (x - m[3], y - m[7], z - m[11]); [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z] } }
            }).collect();
            out.push(g);
        }
    }
    // (los static props: el casco girado 90° alrededor de Z respecto de la malla; si así calza mejor, se gira)
    if m.v.is_some() && m.huesos.len() <= 1 && !out.is_empty() {
        let caja = |l: &mut dyn Iterator<Item = [f32; 3]>, rot: bool| { let (mut mn, mut mx) = ([1e9f32; 3], [-1e9f32; 3]); for f in l { let v = if rot { [f[1], -f[0], f[2]] } else { f }; for c in 0..3 { mn[c] = mn[c].min(v[c]); mx[c] = mx[c].max(v[c]); } } (mn, mx) };
        let pm: Vec<[f32; 3]> = match rp { Some(r) => posar(m, r).0, None => m.v.as_ref().map(|v| v.pos.clone()).unwrap_or_default() };
        let mc = caja(&mut pm.iter().copied(), false);
        let dif = |b: ([f32; 3], [f32; 3])| (0..3).map(|c| (b.0[c] - mc.0[c]).abs() + (b.1[c] - mc.1[c]).abs()).fold(0.0f32, f32::max);
        let d_rot = dif(caja(&mut out.iter().flatten().copied(), true)); let d_no = dif(caja(&mut out.iter().flatten().copied(), false));
        if d_rot + 0.01 < d_no { for f in out.iter_mut() { for p in f.iter_mut() { let a = p[0]; p[0] = p[1]; p[1] = -a; } } }
    }
    out
}
