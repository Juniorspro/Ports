//! Descompresor de Zstandard (RFC 8878), escrito desde la especificación: los pedazos nuevos de Steam («VSZa») vienen así.
//! Sólo descomprime (sin diccionarios): marcos, bloques crudos/repetidos/comprimidos, literales con Huffman (1 o 4 tiras) y
//! secuencias con FSE (tablas predefinidas, de un símbolo, descritas o repetidas). No revisa el XXH64 del final: el que llama
//! comprueba el SHA-1 de lo descomprimido.

/// lectura de bits hacia atrás (los flujos de Huffman y FSE): se empieza por el final, después del 1 que marca dónde terminan
struct Atras<'a> { d: &'a [u8], pos: isize }
impl<'a> Atras<'a> {
    fn nuevo(d: &'a [u8]) -> Result<Self, String> {
        let u = *d.last().ok_or("zstd: flujo vacío")?; if u == 0 { return Err("zstd: flujo sin marca".into()); }
        let alto = 7 - u.leading_zeros() as isize; Ok(Atras { d, pos: (d.len() as isize - 1) * 8 + alto })
    }
    fn bits_en(&self, desde: isize, n: u32) -> u64 {
        // (los bits [desde, desde+n), el de abajo primero; lo que cae antes del principio vale 0)
        let mut v = 0u64;
        for k in 0..n as isize { let i = desde + k; if i >= 0 { let b = (self.d[(i / 8) as usize] >> (i % 8)) & 1; v |= (b as u64) << k; } }
        v
    }
    fn leer(&mut self, n: u32) -> u64 { if n == 0 { return 0; } self.pos -= n as isize; self.bits_en(self.pos, n) }
    fn mirar(&self, n: u32) -> u64 { self.bits_en(self.pos - n as isize, n) }
    fn pasar(&mut self, n: u32) { self.pos -= n as isize; }
    /// se leyó más de lo que había
    fn pasado(&self) -> bool { self.pos < 0 }
    fn termino(&self) -> bool { self.pos == 0 }
}

#[derive(Clone)]
struct Fse { log: u32, sim: Vec<u16>, nb: Vec<u8>, base: Vec<u16> }
impl Fse {
    fn de(norm: &[i16], log: u32) -> Result<Fse, String> {
        let tam = 1usize << log; let mut sim = vec![0u16; tam]; let mut sig = vec![0u32; norm.len()];
        let mut alto = tam as isize - 1;
        for (s, &c) in norm.iter().enumerate() { if c == -1 { if alto < 0 { return Err("zstd: tabla".into()); } sim[alto as usize] = s as u16; alto -= 1; sig[s] = 1; } else { sig[s] = c.max(0) as u32; } }
        let paso = (tam >> 1) + (tam >> 3) + 3; let masc = tam - 1; let mut p = 0usize;
        for (s, &c) in norm.iter().enumerate() { for _ in 0..c.max(0) { sim[p] = s as u16; p = (p + paso) & masc; while p as isize > alto { p = (p + paso) & masc; } } }
        if p != 0 { return Err("zstd: tabla FSE mal repartida".into()); }
        let (mut nb, mut base) = (vec![0u8; tam], vec![0u16; tam]);
        for u in 0..tam {
            let s = sim[u] as usize; let x = sig[s]; sig[s] += 1;
            let b = log - (31 - x.leading_zeros()); nb[u] = b as u8; base[u] = ((x << b) as usize - tam) as u16;
        }
        Ok(Fse { log, sim, nb, base })
    }
    fn rle(s: u8) -> Fse { Fse { log: 0, sim: vec![s as u16], nb: vec![0], base: vec![0] } }
}
/// la descripción de una tabla FSE (las probabilidades normalizadas): devuelve la tabla y cuántos bytes ocupó
fn leer_fse(d: &[u8], max_sim: usize, max_log: u32) -> Result<(Fse, usize), String> {
    let mut bp = 0usize; // (posición en bits, hacia adelante)
    let bits = |bp: usize, n: u32| -> u32 { let mut v = 0u32; for k in 0..n as usize { let i = bp + k; if i / 8 < d.len() { v |= (((d[i / 8] >> (i % 8)) & 1) as u32) << k; } } v };
    let log = bits(bp, 4) + 5; bp += 4;
    if log > max_log { return Err("zstd: precisión FSE muy alta".into()); }
    let mut resto: i32 = (1 << log) + 1; let mut umbral: i32 = 1 << log; let mut nbits = log + 1;
    let mut norm: Vec<i16> = Vec::new(); let mut cero_antes = false;
    while resto > 1 && norm.len() <= max_sim {
        if cero_antes {
            let mut n = 0usize;
            loop { let r = bits(bp, 2); bp += 2; n += r as usize; if r != 3 { break; } }
            for _ in 0..n { norm.push(0); }
            if norm.len() > max_sim { break; }
        }
        let max = (2 * umbral - 1) - resto;
        let v = bits(bp, nbits) as i32;
        let mut c;
        if (v & (umbral - 1)) < max { c = v & (umbral - 1); bp += (nbits - 1) as usize; }
        else { c = v & (2 * umbral - 1); if c >= umbral { c -= max; } bp += nbits as usize; }
        c -= 1;
        resto -= c.abs(); norm.push(c as i16); cero_antes = c == 0;
        while resto < umbral { nbits -= 1; umbral >>= 1; }
    }
    if resto != 1 || norm.len() > max_sim + 1 { return Err("zstd: probabilidades FSE malas".into()); }
    Ok((Fse::de(&norm, log)?, bp.div_ceil(8)))
}

#[derive(Clone)]
struct Huf { log: u32, sim: Vec<u8>, nb: Vec<u8> }
/// la descripción del árbol de Huffman de los literales: devuelve la tabla y cuántos bytes ocupó
fn leer_huf(d: &[u8]) -> Result<(Huf, usize), String> {
    let h = *d.first().ok_or("zstd: árbol vacío")? as usize;
    let mut pesos: Vec<u8> = Vec::new(); let usado;
    if h < 128 {
        // (los pesos comprimidos con FSE —precisión 6—, dos estados intercalados)
        let cuerpo = d.get(1..1 + h).ok_or("zstd: árbol cortado")?;
        let (t, n) = leer_fse(cuerpo, 255, 6)?;
        let mut b = Atras::nuevo(&cuerpo[n..])?;
        let mut e1 = b.leer(t.log) as usize; let mut e2 = b.leer(t.log) as usize;
        loop {
            pesos.push(t.sim[e1] as u8); e1 = t.base[e1] as usize + b.leer(t.nb[e1] as u32) as usize;
            if b.pasado() { pesos.push(t.sim[e2] as u8); break; }
            pesos.push(t.sim[e2] as u8); e2 = t.base[e2] as usize + b.leer(t.nb[e2] as u32) as usize;
            if b.pasado() { pesos.push(t.sim[e1] as u8); break; }
            if pesos.len() > 255 { return Err("zstd: demasiados pesos".into()); }
        }
        usado = 1 + h;
    } else {
        let n = h - 127; let cuerpo = d.get(1..1 + n.div_ceil(2)).ok_or("zstd: árbol cortado")?;
        for i in 0..n { let b = cuerpo[i / 2]; pesos.push(if i % 2 == 0 { b >> 4 } else { b & 15 }); }
        usado = 1 + n.div_ceil(2);
    }
    // (el último peso no viene: es el que completa la potencia de 2)
    let total: u32 = pesos.iter().filter(|&&w| w > 0).map(|&w| 1u32 << (w - 1)).sum();
    if total == 0 { return Err("zstd: árbol sin pesos".into()); }
    let log = 32 - total.leading_zeros(); let falta = (1u32 << log) - total;
    if falta == 0 || falta & (falta - 1) != 0 || log > 11 { return Err("zstd: árbol incompleto".into()); }
    pesos.push((31 - falta.leading_zeros() + 1) as u8);
    let tam = 1usize << log; let mut rango = vec![0u32; 13];
    for &w in &pesos { if w as usize > 12 { return Err("zstd: peso malo".into()); } rango[w as usize] += 1; }
    let mut sig = 0u32; let mut ini = vec![0u32; 13];
    for w in 1..=log as usize { ini[w] = sig; sig += rango[w] << (w - 1); }
    let (mut sim, mut nb) = (vec![0u8; tam], vec![0u8; tam]);
    for (s, &w) in pesos.iter().enumerate() { if w == 0 { continue; } let largo = 1u32 << (w - 1); for u in ini[w as usize]..ini[w as usize] + largo { sim[u as usize] = s as u8; nb[u as usize] = (log + 1 - w as u32) as u8; } ini[w as usize] += largo; }
    Ok((Huf { log, sim, nb }, usado))
}
fn huf_tira(t: &Huf, d: &[u8], n: usize, out: &mut Vec<u8>) -> Result<(), String> {
    let mut b = Atras::nuevo(d)?;
    for _ in 0..n { let i = b.mirar(t.log) as usize; out.push(t.sim[i]); b.pasar(t.nb[i] as u32); }
    if !b.termino() { return Err("zstd: literales de más o de menos".into()); }
    Ok(())
}

const LL_BASE: [(u32, u32); 36] = [(0,0),(1,0),(2,0),(3,0),(4,0),(5,0),(6,0),(7,0),(8,0),(9,0),(10,0),(11,0),(12,0),(13,0),(14,0),(15,0),(16,1),(18,1),(20,1),(22,1),(24,2),(28,2),(32,3),(40,3),(48,4),(64,6),(128,7),(256,8),(512,9),(1024,10),(2048,11),(4096,12),(8192,13),(16384,14),(32768,15),(65536,16)];
const ML_BASE: [(u32, u32); 53] = [(3,0),(4,0),(5,0),(6,0),(7,0),(8,0),(9,0),(10,0),(11,0),(12,0),(13,0),(14,0),(15,0),(16,0),(17,0),(18,0),(19,0),(20,0),(21,0),(22,0),(23,0),(24,0),(25,0),(26,0),(27,0),(28,0),(29,0),(30,0),(31,0),(32,0),(33,0),(34,0),(35,1),(37,1),(39,1),(41,1),(43,2),(47,2),(51,3),(59,3),(67,4),(83,4),(99,5),(131,7),(259,8),(515,9),(1027,10),(2051,11),(4099,12),(8195,13),(16387,14),(32771,15),(65539,16)];
const LL_DEF: [i16; 36] = [4, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 2, 1, 1, 1, 1, 1, -1, -1, -1, -1];
const ML_DEF: [i16; 53] = [1, 4, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1];
const OF_DEF: [i16; 29] = [1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1];

/// lo que pasa de un bloque al siguiente dentro de un marco
struct Estado { huf: Option<Huf>, ll: Option<Fse>, of: Option<Fse>, ml: Option<Fse>, rep: [usize; 3] }

/// descomprime todo (uno o más marcos seguidos); `tam`: el tamaño esperado, si se sabe (para reservar)
pub fn descomprimir(src: &[u8], tam: usize) -> Result<Vec<u8>, String> {
    let mut out: Vec<u8> = Vec::with_capacity(tam); let mut p = 0usize;
    while p + 4 <= src.len() {
        let magia = u32::from_le_bytes(src[p..p + 4].try_into().unwrap());
        if magia & 0xFFFF_FFF0 == 0x184D_2A50 { let n = u32::from_le_bytes(src.get(p + 4..p + 8).ok_or("zstd: corto")?.try_into().unwrap()) as usize; p += 8 + n; continue; }
        if magia != 0xFD2F_B528 { return Err("zstd: no es un marco".into()); }
        p += 4;
        let fhd = *src.get(p).ok_or("zstd: corto")?; p += 1;
        let (fcs_f, unico, suma, dic) = (fhd >> 6, fhd & 0x20 != 0, fhd & 4 != 0, fhd & 3);
        if !unico { p += 1; }
        p += [0, 1, 2, 4][dic as usize];
        p += match fcs_f { 0 => if unico { 1 } else { 0 }, 1 => 2, 2 => 4, _ => 8 };
        let ini = out.len();
        let mut e = Estado { huf: None, ll: None, of: None, ml: None, rep: [1, 4, 8] };
        loop {
            let h = src.get(p..p + 3).ok_or("zstd: bloque cortado")?; let h = h[0] as u32 | (h[1] as u32) << 8 | (h[2] as u32) << 16; p += 3;
            let (ultimo, tipo, n) = (h & 1 != 0, (h >> 1) & 3, (h >> 3) as usize);
            match tipo {
                0 => { out.extend_from_slice(src.get(p..p + n).ok_or("zstd: bloque crudo cortado")?); p += n; }
                1 => { let b = *src.get(p).ok_or("zstd: corto")?; out.resize(out.len() + n, b); p += 1; }
                2 => { let b = src.get(p..p + n).ok_or("zstd: bloque cortado")?; bloque(b, &mut out, ini, &mut e)?; p += n; }
                _ => return Err("zstd: bloque reservado".into()),
            }
            if ultimo { break; }
        }
        if suma { p += 4; }
    }
    Ok(out)
}

fn bloque(b: &[u8], out: &mut Vec<u8>, ini: usize, e: &mut Estado) -> Result<(), String> {
    // ---- los literales
    let b0 = *b.first().ok_or("zstd: bloque vacío")?; let tipo = b0 & 3; let fmt = (b0 >> 2) & 3;
    let mut lit: Vec<u8> = Vec::new(); let mut p;
    match tipo {
        0 | 1 => {
            let (tam, hl) = match fmt { 0 | 2 => ((b0 >> 3) as usize, 1), 1 => (((b0 >> 4) as usize) | (*b.get(1).ok_or("zstd")? as usize) << 4, 2),
                _ => (((b0 >> 4) as usize) | (*b.get(1).ok_or("zstd")? as usize) << 4 | (*b.get(2).ok_or("zstd")? as usize) << 12, 3) };
            p = hl;
            if tipo == 0 { lit.extend_from_slice(b.get(p..p + tam).ok_or("zstd: literales cortados")?); p += tam; }
            else { lit.resize(tam, *b.get(p).ok_or("zstd")?); p += 1; }
        }
        _ => {
            let byte = |i: usize| -> Result<u64, String> { Ok(*b.get(i).ok_or("zstd: cabecera cortada")? as u64) };
            let (regen, comp, hl, cuatro) = match fmt {
                0 | 1 => { let h = byte(0)? | byte(1)? << 8 | byte(2)? << 16; (((h >> 4) & 0x3FF) as usize, ((h >> 14) & 0x3FF) as usize, 3, fmt == 1) }
                2 => { let h = byte(0)? | byte(1)? << 8 | byte(2)? << 16 | byte(3)? << 24; (((h >> 4) & 0x3FFF) as usize, ((h >> 18) & 0x3FFF) as usize, 4, true) }
                _ => { let h = byte(0)? | byte(1)? << 8 | byte(2)? << 16 | byte(3)? << 24 | byte(4)? << 32; (((h >> 4) & 0x3FFFF) as usize, ((h >> 22) & 0x3FFFF) as usize, 5, true) }
            };
            let mut d = b.get(hl..hl + comp).ok_or("zstd: literales cortados")?;
            if tipo == 2 { let (t, n) = leer_huf(d)?; e.huf = Some(t); d = &d[n..]; }
            let t = e.huf.as_ref().ok_or("zstd: literales sin árbol")?;
            lit.reserve(regen);
            if !cuatro { huf_tira(t, d, regen, &mut lit)?; }
            else {
                if d.len() < 6 { return Err("zstd: tabla de saltos".into()); }
                let s = [u16::from_le_bytes([d[0], d[1]]) as usize, u16::from_le_bytes([d[2], d[3]]) as usize, u16::from_le_bytes([d[4], d[5]]) as usize];
                let cada = regen.div_ceil(4); let mut q = 6;
                for k in 0..4 {
                    let largo = if k < 3 { s[k] } else { d.len().checked_sub(q).ok_or("zstd: tiras")? };
                    let n = if k < 3 { cada } else { regen - 3 * cada };
                    huf_tira(t, d.get(q..q + largo).ok_or("zstd: tira cortada")?, n, &mut lit)?; q += largo;
                }
            }
            p = hl + comp;
        }
    }
    // ---- las secuencias
    let s0 = *b.get(p).ok_or("zstd: sin secuencias")? as usize; p += 1;
    let nseq = if s0 == 0 { 0 } else if s0 < 128 { s0 } else if s0 < 255 { p += 1; ((s0 - 128) << 8) + *b.get(p - 1).ok_or("zstd")? as usize } else { p += 2; *b.get(p - 2).ok_or("zstd")? as usize + ((*b.get(p - 1).ok_or("zstd")? as usize) << 8) + 0x7F00 };
    if nseq == 0 { out.extend_from_slice(&lit); return Ok(()); }
    let modos = *b.get(p).ok_or("zstd")?; p += 1;
    let tabla = |modo: u8, def: &[i16], def_log: u32, max_sim: usize, max_log: u32, ant: &mut Option<Fse>, p: &mut usize| -> Result<(), String> {
        match modo {
            0 => *ant = Some(Fse::de(def, def_log)?),
            1 => { *ant = Some(Fse::rle(*b.get(*p).ok_or("zstd")?)); *p += 1; }
            2 => { let (t, n) = leer_fse(&b[*p..], max_sim, max_log)?; *ant = Some(t); *p += n; }
            _ => if ant.is_none() { return Err("zstd: tabla repetida sin anterior".into()); },
        }
        Ok(())
    };
    tabla(modos >> 6, &LL_DEF, 6, 35, 9, &mut e.ll, &mut p)?;
    tabla((modos >> 4) & 3, &OF_DEF, 5, 31, 8, &mut e.of, &mut p)?;
    tabla((modos >> 2) & 3, &ML_DEF, 6, 52, 9, &mut e.ml, &mut p)?;
    let (tll, tof, tml) = (e.ll.as_ref().unwrap(), e.of.as_ref().unwrap(), e.ml.as_ref().unwrap());
    let mut r = Atras::nuevo(b.get(p..).ok_or("zstd")?)?;
    let (mut sll, mut sof, mut sml) = (r.leer(tll.log) as usize, r.leer(tof.log) as usize, r.leer(tml.log) as usize);
    let mut li = 0usize;
    for k in 0..nseq {
        let (cll, cof, cml) = (tll.sim[sll] as usize, tof.sim[sof] as u32, tml.sim[sml] as usize);
        if cof > 31 || cll >= LL_BASE.len() || cml >= ML_BASE.len() { return Err("zstd: código malo".into()); }
        let ofv = (1usize << cof) + r.leer(cof) as usize;
        let ml = ML_BASE[cml].0 as usize + r.leer(ML_BASE[cml].1) as usize;
        let ll = LL_BASE[cll].0 as usize + r.leer(LL_BASE[cll].1) as usize;
        // (los desplazamientos repetidos)
        let off = if ofv > 3 { let o = ofv - 3; e.rep = [o, e.rep[0], e.rep[1]]; o } else {
            let i = if ll == 0 { ofv } else { ofv - 1 };
            if i == 0 { e.rep[0] }
            else { let o = if i == 3 { e.rep[0].checked_sub(1).ok_or("zstd: desplazamiento 0")? } else { e.rep[i] }; if i == 1 { e.rep = [o, e.rep[0], e.rep[2]]; } else { e.rep = [o, e.rep[0], e.rep[1]]; } o }
        };
        out.extend_from_slice(lit.get(li..li + ll).ok_or("zstd: faltan literales")?); li += ll;
        if off == 0 || off > out.len() - ini { return Err("zstd: copia fuera del marco".into()); }
        let desde = out.len() - off;
        if off >= ml { out.extend_from_within(desde..desde + ml); } else { for j in 0..ml { let c = out[desde + j]; out.push(c); } }
        if k + 1 < nseq {
            sll = tll.base[sll] as usize + r.leer(tll.nb[sll] as u32) as usize;
            sml = tml.base[sml] as usize + r.leer(tml.nb[sml] as u32) as usize;
            sof = tof.base[sof] as usize + r.leer(tof.nb[sof] as u32) as usize;
        }
    }
    if !r.termino() { return Err("zstd: secuencias de más o de menos".into()); }
    out.extend_from_slice(lit.get(li..).ok_or("zstd")?);
    Ok(())
}
