//! utf8: la de Lua 5.3 más force, GetChar y sub de GMod (gmaUtf8 de gmod_api.js): los textos son bytes y acá se leen
//! y se arman los caracteres de UTF-8.
use super::*;
use crate::valor::Valor;
use crate::{Error, Estado};

/// poner la biblioteca utf8 (en la web la pone la capa de GMod, gmaUtf8 de gmod_api.js)
pub fn abrir(e: &mut Estado) {
    let u = lib(e, "utf8");
    u.borrow_mut().set_str("charpattern", Valor::from(&b"[\x00-\x7F\xC2-\xF4][\x80-\xBF]*"[..]));
    def(&u, "char", char_);
    def(&u, "len", len);
    def(&u, "codepoint", codepoint);
    def(&u, "offset", offset);
    def(&u, "codes", codes);
    def(&u, "force", force);
    def(&u, "GetChar", getchar);
    def(&u, "sub", sub);
}

fn cont(s: &[u8], k: usize) -> bool { matches!(s.get(k), Some(c) if (0x80..=0xbf).contains(c)) }

/// el caracter que empieza en el byte k: (código, largo) o None si está mal armado
fn leer(s: &[u8], k: usize) -> Option<(u32, usize)> {
    let b0 = *s.get(k)? as u32;
    if b0 < 0x80 { return Some((b0, 1)); }
    let n = if (0xc2..=0xdf).contains(&b0) { 1 } else if (0xe0..=0xef).contains(&b0) { 2 } else if (0xf0..=0xf4).contains(&b0) { 3 } else { return None };
    if k + n > s.len() - 1 { return None; }
    let mut c = b0 & if n == 1 { 0x1f } else if n == 2 { 0x0f } else { 0x07 };
    for i in 1..=n {
        if !cont(s, k + i) { return None; }
        c = (c << 6) | (s[k + i] as u32 & 0x3f);
    }
    if (n == 2 && c < 0x800) || (n == 3 && !(0x10000..=0x10ffff).contains(&c)) || (0xd800..=0xdfff).contains(&c) { return None; }
    Some((c, n + 1))
}

fn escribir(c: f64, out: &mut Vec<u8>) {
    let c = if c.is_finite() { c.trunc() as i64 } else { 0 };
    let c = c as u32;
    if c < 0x80 { out.push(c as u8); } else if c < 0x800 { out.extend([0xc0 | (c >> 6) as u8, 0x80 | (c & 63) as u8]); } else if c < 0x10000 {
        out.extend([0xe0 | (c >> 12) as u8, 0x80 | ((c >> 6) & 63) as u8, 0x80 | (c & 63) as u8]);
    } else {
        out.extend([0xf0 | (c >> 18) as u8, 0x80 | ((c >> 12) & 63) as u8, 0x80 | ((c >> 6) & 63) as u8, 0x80 | (c & 63) as u8]);
    }
}

fn texto(v: &Valor) -> Vec<u8> { if v.es_nil() { Vec::new() } else { js_string(v) } }

/// un índice como la web (nil → d; negativos desde el final)
fn pos(v: &Valor, l: i64, d: i64) -> i64 {
    if v.es_nil() { return d; }
    let x = js_num(v);
    let i = if x.is_finite() { x.trunc() as i64 } else { 0 };
    if i < 0 { (l + i + 1).max(1) } else { i }
}

fn char_(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let mut r = Vec::new();
    for x in a { escribir(js_num(x), &mut r); }
    out.push(Valor::from(r));
    Ok(())
}

fn len(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let s = texto(arg(a, 0));
    let l = s.len() as i64;
    let mut k = pos(arg(a, 1), l, 1) - 1;
    let fin = if pos(arg(a, 2), l, -1) == -1 { l - 1 } else { pos(arg(a, 2), l, l) - 1 };
    let mut n = 0;
    while k <= fin && k < l {
        match leer(&s, k.max(0) as usize) {
            Some((_, w)) => { k += w as i64; n += 1; }
            None => { out.push(Valor::Nil); out.push(Valor::Num((k + 1) as f64)); return Ok(()); }
        }
    }
    out.push(Valor::Num(n as f64));
    Ok(())
}

fn codepoint(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let s = texto(arg(a, 0));
    let l = s.len() as i64;
    let ia = pos(arg(a, 1), l, 1);
    let ib = pos(arg(a, 2), l, ia);
    let mut k = ia - 1;
    while k < ib && k < l {
        match leer(&s, k.max(0) as usize) {
            Some((c, w)) => { out.push(Valor::Num(c as f64)); k += w as i64; }
            None => return Ok(()),
        }
    }
    Ok(())
}

fn offset(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let s = texto(arg(a, 0));
    let l = s.len() as i64;
    let nn = js_num(arg(a, 1));
    let mut n = if nn.is_finite() { nn.trunc() as i64 } else { 0 };
    let mut p = (if arg(a, 2).es_nil() { if n >= 0 { 1 } else { l + 1 } } else { pos(arg(a, 2), l, 1) }) - 1;
    let c = |k: i64| k >= 0 && cont(&s, k as usize);
    if n == 0 {
        while p > 0 && c(p) { p -= 1; }
        out.push(Valor::Num((p + 1) as f64));
        return Ok(());
    }
    if c(p) { return Ok(()); }
    if n > 0 {
        n -= 1;
        while n > 0 && p < l {
            p += 1;
            while p < l && c(p) { p += 1; }
            n -= 1;
        }
        if n == 0 { out.push(Valor::Num((p + 1) as f64)); }
        return Ok(());
    }
    while n < 0 && p > 0 {
        p -= 1;
        while p > 0 && c(p) { p -= 1; }
        n += 1;
    }
    if n == 0 { out.push(Valor::Num((p + 1) as f64)); }
    Ok(())
}

fn codes(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let s = texto(arg(a, 0));
    out.push(Estado::funcion_rapida(move |_, a, out| {
        let x = js_num(arg(a, 1));
        let mut k = if x.is_finite() { x.trunc() as i64 } else { 0 };
        if k > 0 { let w = leer(&s, (k - 1) as usize).map(|r| r.1).unwrap_or(1); k = k - 1 + w as i64; }
        if k >= s.len() as i64 { return Ok(()); }
        let c = leer(&s, k as usize).map(|r| r.0).unwrap_or(0xfffd);
        out.push(Valor::Num((k + 1) as f64));
        out.push(Valor::Num(c as f64));
        Ok(())
    }));
    out.push(arg(a, 0).clone());
    out.push(Valor::Num(0.0));
    Ok(())
}

fn force(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let s = texto(arg(a, 0));
    let mut o = Vec::with_capacity(s.len());
    let mut k = 0;
    while k < s.len() {
        match leer(&s, k) {
            Some((_, w)) => { o.extend_from_slice(&s[k..k + w]); k += w; }
            None => { escribir(0xfffd as f64, &mut o); k += 1; }
        }
    }
    out.push(Valor::from(o));
    Ok(())
}

fn cortes(s: &[u8]) -> Vec<&[u8]> {
    let mut c = vec![];
    let mut k = 0;
    while k < s.len() {
        let n = leer(s, k).map(|r| r.1).unwrap_or(1);
        c.push(&s[k..(k + n).min(s.len())]);
        k += n;
    }
    c
}

fn getchar(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let s = texto(arg(a, 0));
    let c = cortes(&s);
    let x = js_num(arg(a, 1));
    let mut n = if x.is_finite() { x.trunc() as i64 } else { 0 };
    if n < 0 { n += c.len() as i64 + 1; }
    let r = if n >= 1 && (n as usize) <= c.len() { c[n as usize - 1].to_vec() } else { Vec::new() };
    out.push(Valor::from(r));
    Ok(())
}

fn sub(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let s = texto(arg(a, 0));
    let c = cortes(&s);
    let l = c.len() as i64;
    let tr = |v: &Valor, d: i64| -> i64 { if v.es_nil() { d } else { let x = js_num(v); if x.is_finite() { x.trunc() as i64 } else { 0 } } };
    let mut ia = tr(arg(a, 1), 1);
    let mut ib = tr(arg(a, 2), -1);
    if ia < 0 { ia = (l + ia + 1).max(1); }
    if ib < 0 { ib = l + ib + 1; }
    ia = ia.max(1);
    ib = ib.min(l);
    let r: Vec<u8> = if ia > ib { Vec::new() } else { c[(ia - 1) as usize..ib as usize].concat() };
    out.push(Valor::from(r));
    Ok(())
}
