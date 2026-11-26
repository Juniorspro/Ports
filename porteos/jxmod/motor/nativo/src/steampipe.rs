//! SteamPipe en el nativo (como juego/gmod_pipe.js de la web): los addons del Workshop que Steam no da como archivo directo —casi
//! todos los mapas nuevos—. La tienda de JXMod (el worker) entra anónima a Steam y da la clave del depósito, el código del
//! manifiesto y los servidores del CDN (/api/gmod/pipe/ID). Acá: el manifiesto (un zip con protobuf), los nombres descifrados, los
//! pedazos del .gma de a varios hilos —directo al CDN de Steam y, si no contesta, por la tienda—, cada uno descifrado (AES-256: el
//! IV va cifrado en ECB y el resto en CBC), descomprimido (LZMA de «VZa», zstd de «VSZa» o zip), comprobado con su SHA-1 y escrito
//! en su lugar del archivo. Todo propio: AES, SHA-1, protobuf y zip acá; LZMA en gmod_juego.rs y zstd en zstd.rs.
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

/// un pedido HTTP binario: (código, cuerpo)
pub type Http = Arc<dyn Fn(&str) -> Result<(u16, Vec<u8>), String> + Send + Sync>;

// ---------------- AES-256 (sólo descifrar) ----------------
fn sbox() -> ([u8; 256], [u8; 256]) {
    let (mut s, mut inv) = ([0u8; 256], [0u8; 256]);
    let (mut p, mut q) = (1u8, 1u8);
    loop {
        // (p recorre el grupo multiplicando por 3; q, su inverso, dividiendo por 3)
        p = p ^ (p << 1) ^ if p & 0x80 != 0 { 0x1b } else { 0 };
        q ^= q << 1; q ^= q << 2; q ^= q << 4; if q & 0x80 != 0 { q ^= 0x09; }
        let x = q ^ q.rotate_left(1) ^ q.rotate_left(2) ^ q.rotate_left(3) ^ q.rotate_left(4) ^ 0x63;
        s[p as usize] = x; inv[x as usize] = p;
        if p == 1 { break; }
    }
    s[0] = 0x63; inv[0x63] = 0;
    (s, inv)
}
fn xt(a: u8) -> u8 { (a << 1) ^ if a & 0x80 != 0 { 0x1b } else { 0 } }
fn mul(mut a: u8, mut b: u8) -> u8 { let mut r = 0; while b != 0 { if b & 1 != 0 { r ^= a; } a = xt(a); b >>= 1; } r }

pub struct Aes { rk: [[u8; 16]; 15], inv: [u8; 256], m9: [u8; 256], m11: [u8; 256], m13: [u8; 256], m14: [u8; 256] }
impl Aes {
    pub fn nuevo(clave: &[u8; 32]) -> Aes {
        let (s, inv) = sbox();
        let mut w = [[0u8; 4]; 60];
        for i in 0..8 { w[i].copy_from_slice(&clave[i * 4..i * 4 + 4]); }
        let mut rc = 1u8;
        for i in 8..60 {
            let mut t = w[i - 1];
            if i % 8 == 0 { t = [s[t[1] as usize] ^ rc, s[t[2] as usize], s[t[3] as usize], s[t[0] as usize]]; rc = xt(rc); }
            else if i % 8 == 4 { t = [s[t[0] as usize], s[t[1] as usize], s[t[2] as usize], s[t[3] as usize]]; }
            for k in 0..4 { w[i][k] = w[i - 8][k] ^ t[k]; }
        }
        let mut rk = [[0u8; 16]; 15];
        for r in 0..15 { for c in 0..4 { rk[r][c * 4..c * 4 + 4].copy_from_slice(&w[r * 4 + c]); } }
        let tabla = |k: u8| { let mut t = [0u8; 256]; for i in 0..256 { t[i] = mul(i as u8, k); } t };
        Aes { rk, inv, m9: tabla(9), m11: tabla(11), m13: tabla(13), m14: tabla(14) }
    }
    /// descifra un bloque de 16 bytes
    pub fn bloque(&self, b: &mut [u8; 16]) {
        for i in 0..16 { b[i] ^= self.rk[14][i]; }
        for r in (0..14).rev() {
            // (filas corridas al revés y la caja al revés)
            let t = *b;
            for c in 0..4 { for f in 0..4 { b[c * 4 + f] = self.inv[t[((c + 4 - f) % 4) * 4 + f] as usize]; } }
            for i in 0..16 { b[i] ^= self.rk[r][i]; }
            if r > 0 {
                for c in 0..4 {
                    let (a0, a1, a2, a3) = (b[c * 4] as usize, b[c * 4 + 1] as usize, b[c * 4 + 2] as usize, b[c * 4 + 3] as usize);
                    b[c * 4] = self.m14[a0] ^ self.m11[a1] ^ self.m13[a2] ^ self.m9[a3];
                    b[c * 4 + 1] = self.m9[a0] ^ self.m14[a1] ^ self.m11[a2] ^ self.m13[a3];
                    b[c * 4 + 2] = self.m13[a0] ^ self.m9[a1] ^ self.m14[a2] ^ self.m11[a3];
                    b[c * 4 + 3] = self.m11[a0] ^ self.m13[a1] ^ self.m9[a2] ^ self.m14[a3];
                }
            }
        }
    }
    /// lo cifrado de Steam: el IV en ECB (16 bytes) y después CBC con relleno PKCS7
    pub fn steam(&self, d: &[u8]) -> Result<Vec<u8>, String> {
        if d.len() < 32 || (d.len() - 16) % 16 != 0 { return Err("cifrado: largo malo".into()); }
        let mut iv: [u8; 16] = d[..16].try_into().unwrap(); self.bloque(&mut iv);
        let mut out = Vec::with_capacity(d.len() - 16); let mut ant = iv;
        for c in d[16..].chunks_exact(16) {
            let mut b: [u8; 16] = c.try_into().unwrap(); let cif = b; self.bloque(&mut b);
            for i in 0..16 { b[i] ^= ant[i]; } ant = cif; out.extend_from_slice(&b);
        }
        let pad = *out.last().unwrap() as usize;
        if pad == 0 || pad > 16 || out[out.len() - pad..].iter().any(|&x| x as usize != pad) { return Err("cifrado: relleno malo (¿clave equivocada?)".into()); }
        out.truncate(out.len() - pad); Ok(out)
    }
}

// ---------------- SHA-1 ----------------
pub fn sha1(d: &[u8]) -> [u8; 20] {
    let mut h: [u32; 5] = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    let mut m = d.to_vec(); let bits = (d.len() as u64) * 8; m.push(0x80); while m.len() % 64 != 56 { m.push(0); } m.extend_from_slice(&bits.to_be_bytes());
    let mut w = [0u32; 80];
    for blq in m.chunks_exact(64) {
        for t in 0..16 { w[t] = u32::from_be_bytes(blq[t * 4..t * 4 + 4].try_into().unwrap()); }
        for t in 16..80 { w[t] = (w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16]).rotate_left(1); }
        let [mut a, mut b, mut c, mut dd, mut e] = h;
        for (t, &x) in w.iter().enumerate() {
            let (f, k) = match t / 20 { 0 => ((b & c) | (!b & dd), 0x5A827999), 1 => (b ^ c ^ dd, 0x6ED9EBA1), 2 => ((b & c) | (b & dd) | (c & dd), 0x8F1BBCDC), _ => (b ^ c ^ dd, 0xCA62C1D6) };
            let tmp = a.rotate_left(5).wrapping_add(f).wrapping_add(e).wrapping_add(k).wrapping_add(x);
            e = dd; dd = c; c = b.rotate_left(30); b = a; a = tmp;
        }
        for (x, y) in h.iter_mut().zip([a, b, c, dd, e]) { *x = x.wrapping_add(y); }
    }
    let mut o = [0u8; 20]; for (i, x) in h.iter().enumerate() { o[i * 4..i * 4 + 4].copy_from_slice(&x.to_be_bytes()); } o
}

// ---------------- protobuf (lectura) ----------------
#[derive(Clone)]
enum Pb<'a> { N(u64), B(&'a [u8]) }
fn pb(b: &[u8]) -> Result<Vec<(u32, Pb<'_>)>, String> {
    let mut out = vec![]; let mut i = 0usize;
    let vi = |i: &mut usize| -> Result<u64, String> { let mut r = 0u64; let mut s = 0; loop { let x = *b.get(*i).ok_or("protobuf cortado")?; *i += 1; r |= ((x & 0x7f) as u64) << s; if x & 0x80 == 0 { return Ok(r); } s += 7; if s > 63 { return Err("protobuf malo".into()); } } };
    while i < b.len() {
        let k = vi(&mut i)?; let (f, t) = ((k >> 3) as u32, k & 7);
        let v = match t {
            0 => Pb::N(vi(&mut i)?),
            1 => { let x = u64::from_le_bytes(b.get(i..i + 8).ok_or("protobuf cortado")?.try_into().unwrap()); i += 8; Pb::N(x) }
            2 => { let n = vi(&mut i)? as usize; let x = b.get(i..i + n).ok_or("protobuf cortado")?; i += n; Pb::B(x) }
            5 => { let x = u32::from_le_bytes(b.get(i..i + 4).ok_or("protobuf cortado")?.try_into().unwrap()); i += 4; Pb::N(x as u64) }
            _ => return Err("protobuf: tipo desconocido".into()),
        };
        out.push((f, v));
    }
    Ok(out)
}
fn pb_n(v: &[(u32, Pb)], f: u32) -> u64 { v.iter().find_map(|(k, x)| if *k == f { if let Pb::N(n) = x { Some(*n) } else { None } } else { None }).unwrap_or(0) }
fn pb_b<'a>(v: &[(u32, Pb<'a>)], f: u32) -> Option<&'a [u8]> { v.iter().find_map(|(k, x)| if *k == f { if let Pb::B(b) = x { Some(*b) } else { None } } else { None }) }

// ---------------- zip de un archivo ----------------
fn unzip(b: &[u8]) -> Result<Vec<u8>, String> {
    let u16le = |i: usize| -> Result<usize, String> { Ok(u16::from_le_bytes(b.get(i..i + 2).ok_or("zip cortado")?.try_into().unwrap()) as usize) };
    let u32le = |i: usize| -> Result<usize, String> { Ok(u32::from_le_bytes(b.get(i..i + 4).ok_or("zip cortado")?.try_into().unwrap()) as usize) };
    let mut fin = None;
    let desde = b.len().saturating_sub(65557);
    for i in (desde..b.len().saturating_sub(21)).rev() { if u32le(i)? == 0x06054b50 { fin = Some(i); break; } }
    let (met, cs, us, lo) = match fin {
        Some(e) => { let cd = u32le(e + 16)?; (u16le(cd + 10)?, u32le(cd + 20)?, u32le(cd + 24)?, u32le(cd + 42)?) }
        None => (u16le(8)?, u32le(18)?, u32le(22)?, 0),
    };
    if u32le(lo)? != 0x04034b50 { return Err("zip dañado".into()); }
    let ini = lo + 30 + u16le(lo + 26)? + u16le(lo + 28)?;
    let d = b.get(ini..ini + cs).ok_or("zip cortado")?;
    match met {
        0 => Ok(d.to_vec()),
        8 => { let mut o = Vec::with_capacity(us); flate2::read::DeflateDecoder::new(d).read_to_end(&mut o).map_err(|e| format!("zip: {e}"))?; Ok(o) }
        m => Err(format!("zip con método {m}")),
    }
}

/// un pedazo del archivo: su SHA-1 (el nombre en el CDN), dónde va, cuánto mide y cuánto mide comprimido
#[derive(Clone, Debug)]
pub struct Pedazo { pub sha: String, pub off: u64, pub tam: usize, pub comp: usize }
#[derive(Clone, Debug)]
pub struct Archivo { pub nombre: String, pub tam: u64, pub pedazos: Vec<Pedazo> }

/// el manifiesto: los archivos del addon con sus pedazos (los nombres vienen cifrados en base64)
pub fn manifiesto(zip: &[u8], aes: &Aes) -> Result<Vec<Archivo>, String> {
    let b = unzip(zip)?; let mut i = 0usize; let (mut carga, mut meta) = (None, None);
    while i + 4 <= b.len() {
        let mg = u32::from_le_bytes(b[i..i + 4].try_into().unwrap()); i += 4; if mg == 0x32c415ab { break; }
        let n = u32::from_le_bytes(b.get(i..i + 4).ok_or("manifiesto cortado")?.try_into().unwrap()) as usize; i += 4;
        let d = b.get(i..i + n).ok_or("manifiesto cortado")?; i += n;
        if mg == 0x71f617d0 { carga = Some(d); } else if mg == 0x1f4812be { meta = Some(d); }
    }
    let carga = carga.ok_or("manifiesto sin archivos")?;
    let cifrados = meta.map(|m| pb(m).map(|v| pb_n(&v, 4) != 0)).transpose()?.unwrap_or(false);
    let mut out = vec![];
    for (f, v) in pb(carga)? {
        let Pb::B(fm) = v else { continue }; if f != 1 { continue; }
        let x = pb(fm)?;
        let mut nom = String::from_utf8_lossy(pb_b(&x, 1).unwrap_or(&[])).to_string();
        if cifrados && !nom.is_empty() {
            nom = base64(&nom).and_then(|e| aes.steam(&e).ok()).map(|d| String::from_utf8_lossy(&d).trim_end_matches('\0').to_string()).unwrap_or_default();
        }
        let mut pedazos: Vec<Pedazo> = x.iter().filter(|(k, _)| *k == 6).filter_map(|(_, c)| if let Pb::B(c) = c { pb(c).ok() } else { None }).map(|c| Pedazo {
            sha: crate::firma::a_hex(pb_b(&c, 1).unwrap_or(&[])), off: pb_n(&c, 3), tam: pb_n(&c, 4) as usize, comp: pb_n(&c, 5) as usize,
        }).collect();
        pedazos.sort_by_key(|p| p.off);
        out.push(Archivo { nombre: nom.replace('\\', "/"), tam: pb_n(&x, 2), pedazos });
    }
    Ok(out)
}
fn base64(s: &str) -> Option<Vec<u8>> {
    let mut out = vec![]; let mut acc = 0u32; let mut n = 0;
    for c in s.bytes().filter(|c| !c.is_ascii_whitespace()) {
        let v = match c { b'A'..=b'Z' => c - b'A', b'a'..=b'z' => c - b'a' + 26, b'0'..=b'9' => c - b'0' + 52, b'+' => 62, b'/' => 63, b'=' => break, _ => return None } as u32;
        acc = acc << 6 | v; n += 6; if n >= 8 { n -= 8; out.push((acc >> n) as u8); }
    }
    Some(out)
}

/// un pedazo bajado: descifrado, descomprimido y comprobado
pub fn pedazo(enc: &[u8], aes: &Aes, p: &Pedazo) -> Result<Vec<u8>, String> {
    let d = aes.steam(enc)?;
    let o = if d.len() > 22 && &d[..4] == b"VSZa" { crate::zstd::descomprimir(&d[8..d.len() - 15], p.tam)? }
    else if d.len() > 22 && &d[..3] == b"VZa" {
        // (VZip: «VZa» + 4 bytes + 5 de propiedades LZMA + datos + CRC, tamaño y «zv»: se arma el LZMA «alone»)
        let n = d.len(); let us = u32::from_le_bytes(d[n - 6..n - 2].try_into().unwrap()) as u64;
        let mut src = Vec::with_capacity(13 + n - 22); src.extend_from_slice(&d[7..12]); src.extend_from_slice(&us.to_le_bytes()); src.extend_from_slice(&d[12..n - 10]);
        crate::comun::gmod_juego::lzma(&src)?
    } else if d.len() > 4 && &d[..2] == b"PK" { unzip(&d)? }
    else { return Err("pedazo con formato desconocido".into()); };
    if o.len() != p.tam { return Err("pedazo de tamaño malo".into()); }
    if crate::firma::a_hex(&sha1(&o)) != p.sha { return Err("pedazo dañado".into()); }
    Ok(o)
}

/// cómo va una bajada (para la interfaz): bytes hechos, total, si terminó y el error
#[derive(Default)]
pub struct Progreso { pub hecho: AtomicU64, pub total: AtomicU64, pub cancelar: AtomicBool }

/// baja un addon entero a `salida` (.gma). `http` pide URL; `tienda`: la base de la API de la tienda. Los pedazos, directo al CDN
/// de Steam (si `directo`) y si no contesta por la tienda; de a 6 hilos; el archivo se escribe en su lugar a medida que llegan
pub fn bajar(http: Http, tienda: &str, wid: &str, salida: &Path, directo: bool, prog: Arc<Progreso>) -> Result<PathBuf, String> {
    let (c, b) = http(&format!("{tienda}gmod/pipe/{wid}"))?;
    if c == 404 { return Err("Steam no tiene ese addon".into()); }
    if c == 409 { return Err("ese addon no trae archivo".into()); }
    if c != 200 { return Err(format!("la tienda contestó {c}")); }
    let info: serde_json::Value = serde_json::from_slice(&b).map_err(|e| format!("la tienda: {e}"))?;
    let clave: [u8; 32] = crate::firma::de_hex(info["clave"].as_str().unwrap_or("")).and_then(|v| v.try_into().ok()).ok_or("la tienda no dio la clave")?;
    let dep = info["dep"].as_u64().map(|x| x.to_string()).or_else(|| info["dep"].as_str().map(String::from)).ok_or("sin depósito")?;
    let man = info["man"].as_str().map(String::from).or_else(|| info["man"].as_u64().map(|x| x.to_string())).ok_or("sin manifiesto")?;
    let cod = info["codigo"].as_str().map(String::from).or_else(|| info["codigo"].as_u64().map(|x| x.to_string())).unwrap_or_default();
    let hosts: Vec<String> = info["cdn"].as_array().map(|a| a.iter().filter_map(|h| h.as_str().map(String::from)).collect()).filter(|v: &Vec<String>| !v.is_empty()).unwrap_or_else(|| vec!["cache1-lax1.steamcontent.com".into()]);
    let aes = Arc::new(Aes::nuevo(&clave));
    let bueno = Arc::new(AtomicUsize::new(0));
    // (cada pedido: directo a Steam probando servidores; al final, por la tienda)
    let pedir = { let (http, hosts, tienda, bueno) = (http.clone(), hosts.clone(), tienda.to_string(), bueno.clone()); move |ruta: &str| -> Result<Vec<u8>, String> {
        let n = hosts.len(); let b0 = bueno.load(Ordering::Relaxed); let mut ult = String::new();
        let intentos = if directo { 4.min(n.max(1)) + 1 } else { 3 };
        for k in 0..intentos {
            let h = &hosts[(b0 + k) % n];
            let url = if directo && k + 1 < intentos { format!("https://{h}{ruta}") } else { format!("{tienda}gmod/cdn/{h}{ruta}") };
            match http(&url) { Ok((200, b)) => { bueno.store((b0 + k) % n, Ordering::Relaxed); return Ok(b); } Ok((c, _)) => ult = format!("CDN {c}"), Err(e) => ult = e }
        }
        Err(ult)
    } };
    let ruta_man = format!("/depot/{dep}/manifest/{man}/5{}", if !cod.is_empty() && cod != "0" { format!("/{cod}") } else { String::new() });
    let archivos = manifiesto(&pedir(&ruta_man)?, &aes)?;
    let f = archivos.iter().filter(|a| a.nombre.to_lowercase().ends_with(".gma") && !a.pedazos.is_empty()).max_by_key(|a| a.tam)
        .or_else(|| archivos.iter().filter(|a| !a.pedazos.is_empty()).max_by_key(|a| a.tam)).ok_or("el addon no trae archivos")?.clone();
    if f.tam > 1_500_000_000 { return Err("addon demasiado grande".into()); }
    prog.total.store(f.pedazos.iter().map(|p| p.tam as u64).sum(), Ordering::Relaxed);
    let parte = salida.with_extension("gma.parte");
    { let a = std::fs::File::create(&parte).map_err(|e| format!("no se pudo crear: {e}"))?; a.set_len(f.tam).map_err(|e| format!("sin lugar: {e}"))?; }
    let archivo = Arc::new(Mutex::new(std::fs::OpenOptions::new().write(true).open(&parte).map_err(|e| e.to_string())?));
    let sig = Arc::new(AtomicUsize::new(0)); let error: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let peds = Arc::new(f.pedazos.clone());
    let hilos: Vec<_> = (0..6.min(peds.len())).map(|_| {
        let (sig, error, peds, aes, archivo, prog, pedir) = (sig.clone(), error.clone(), peds.clone(), aes.clone(), archivo.clone(), prog.clone(), pedir.clone());
        let dep = dep.clone();
        std::thread::spawn(move || loop {
            if error.lock().unwrap().is_some() || prog.cancelar.load(Ordering::Relaxed) { return; }
            let i = sig.fetch_add(1, Ordering::Relaxed); let Some(p) = peds.get(i) else { return };
            // (un pedazo que falla se vuelve a pedir dos veces más)
            let mut r = Err(String::new());
            for _ in 0..3 { r = pedir(&format!("/depot/{dep}/chunk/{}", p.sha)).and_then(|enc| pedazo(&enc, &aes, p)); if r.is_ok() { break; } }
            match r {
                Ok(d) => { let mut a = archivo.lock().unwrap(); if let Err(e) = a.seek(SeekFrom::Start(p.off)).and_then(|_| a.write_all(&d)) { *error.lock().unwrap() = Some(format!("al escribir: {e}")); return; } prog.hecho.fetch_add(p.tam as u64, Ordering::Relaxed); }
                Err(e) => { *error.lock().unwrap() = Some(e); return; }
            }
        })
    }).collect();
    for h in hilos { let _ = h.join(); }
    if prog.cancelar.load(Ordering::Relaxed) { let _ = std::fs::remove_file(&parte); return Err("cancelado".into()); }
    if let Some(e) = error.lock().unwrap().take() { let _ = std::fs::remove_file(&parte); return Err(e); }
    drop(archivo);
    std::fs::rename(&parte, salida).map_err(|e| format!("no se pudo guardar: {e}"))?;
    Ok(salida.to_path_buf())
}
