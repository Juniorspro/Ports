//! La biblioteca string (con los patrones de Lua) y la metatabla de los textos.
use std::borrow::Cow;
use std::cell::Cell;
use std::rc::Rc;

use super::patrones::{buscar, una_vez};
use super::*;
use crate::numeros::{fmt_num, js_tostring, to_int32};
use crate::valor::{Cadena, Tabla, Valor};
use crate::{Error, Estado};

pub(crate) fn abrir(e: &mut Estado) {
    let s = lib(e, "string");
    def(&s, "len", len);
    def(&s, "sub", sub);
    def(&s, "upper", upper);
    def(&s, "lower", lower);
    def(&s, "rep", rep);
    def(&s, "reverse", reverse);
    def(&s, "dump", dump);
    def(&s, "byte", byte);
    def(&s, "char", char_);
    def(&s, "format", format);
    def(&s, "find", find);
    def(&s, "match", match_);
    def(&s, "gmatch", gmatch);
    def(&s, "gsub", gsub);
    let mt = Tabla::nueva_ref();
    mt.borrow_mut().set_str("__index", Valor::Tabla(s));
    e.meta_cad = Some(mt);
}

/// sArg de la web: el texto (los números se convierten), si no «bad argument #1 to 'que' (string expected, got X)»
pub(crate) fn sarg<'a>(e: &Estado, v: &'a Valor, que: &str) -> Result<Cow<'a, [u8]>, Error> {
    match v {
        Valor::Cad(s) => Ok(Cow::Borrowed(s.bytes())),
        Valor::Num(n) => Ok(Cow::Owned(fmt_num(*n).into_bytes())),
        otro => Err(e.error(&format!("bad argument #1 to '{}' (string expected, got {})", que, otro.tipo()))),
    }
}

/// posI de la web: los índices negativos cuentan desde el final
#[inline]
fn pos_i(i: f64, n: f64) -> f64 { if i >= 0.0 { i } else { (n + i + 1.0).max(0.0) } }

fn len(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let n = sarg(e, arg(a, 0), "len")?.len();
    out.push(Valor::Num(n as f64));
    Ok(())
}

fn sub(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let s = sarg(e, arg(a, 0), "sub")?;
    let n = s.len() as f64;
    let i = if arg(a, 1).es_nil() { 1.0 } else { num(e, arg(a, 1), "sub")?.trunc() };
    let j = if arg(a, 2).es_nil() { -1.0 } else { num(e, arg(a, 2), "sub")?.trunc() };
    let mut i = pos_i(i, n);
    let mut j = pos_i(j, n);
    if i < 1.0 { i = 1.0; }
    if j > n { j = n; }
    out.push(if i > j { Valor::from("") } else { Valor::from(&s[(i - 1.0) as usize..j as usize]) });
    Ok(())
}

fn upper(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    out.push(Valor::from(sarg(e, arg(a, 0), "upper")?.to_ascii_uppercase()));
    Ok(())
}

fn lower(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    out.push(Valor::from(sarg(e, arg(a, 0), "lower")?.to_ascii_lowercase()));
    Ok(())
}

fn rep(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let s = sarg(e, arg(a, 0), "rep")?;
    let n = num(e, arg(a, 1), "rep")?.trunc();
    if !(n > 0.0) { out.push(Valor::from("")); return Ok(()); }
    if s.len() as f64 * n > 5e7 { return Err(e.error("resultado demasiado grande")); }
    let n = n as usize;
    let sep = arg(a, 2);
    let r = if js_verdad(sep) {
        let sep = js_string(sep);
        let mut r = Vec::with_capacity((s.len() + sep.len()) * n);
        for i in 0..n { if i > 0 { r.extend_from_slice(&sep); } r.extend_from_slice(&s); }
        r
    } else {
        s.repeat(n)
    };
    out.push(Valor::from(r));
    Ok(())
}

fn reverse(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let mut s = sarg(e, arg(a, 0), "reverse")?.into_owned();
    s.reverse();
    out.push(Valor::from(s));
    Ok(())
}

/// (acá no hay bytecode que mostrar: una huella distinta para cada función, la misma si es la misma, como la web)
fn dump(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let f = match arg(a, 0) { Valor::Func(f) => f.clone(), otro => return Err(e.error(&format!("bad argument #1 to 'dump' (function expected, got {})", otro.tipo()))) };
    e.dumps.retain(|(w, _)| w.strong_count() > 0);
    let k = match e.dumps.iter().find(|(w, _)| w.upgrade().map(|x| Rc::ptr_eq(&x, &f)).unwrap_or(false)) {
        Some((_, k)) => *k,
        None => {
            let k = e.dumps.iter().map(|x| x.1).max().unwrap_or(0).max(e.n_dump) + 1;
            e.n_dump = k;
            e.dumps.push((Rc::downgrade(&f), k));
            k
        }
    };
    out.push(Valor::from(format!("\x1bLuaR{}", k)));
    Ok(())
}

fn byte(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let s = sarg(e, arg(a, 0), "byte")?;
    let n = s.len() as f64;
    let i = if arg(a, 1).es_nil() { 1.0 } else { pos_i(js_num(arg(a, 1)).trunc(), n) };
    let j = if arg(a, 2).es_nil() { i } else { pos_i(js_num(arg(a, 2)).trunc(), n) };
    let mut k = i.max(1.0);
    while k <= j.min(n) { out.push(Valor::Num(s[k as usize - 1] as f64)); k += 1.0; }
    Ok(())
}

fn char_(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let mut r = Vec::with_capacity(a.len());
    for x in a { r.push((to_int32(num(e, x, "char")?) & 255) as u8); }
    out.push(Valor::from(r));
    Ok(())
}

fn format(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let f = sarg(e, arg(a, 0), "format")?.into_owned();
    let r = super::formato::formatear(e, &f, if a.is_empty() { a } else { &a[1..] })?;
    out.push(Valor::from(r));
    Ok(())
}

fn tiene_especiales(p: &[u8]) -> bool { p.iter().any(|c| b"^$*+?.()[]%-".contains(c)) }

fn buscar_plano(s: &[u8], p: &[u8], desde: usize) -> Option<usize> {
    if p.is_empty() { return if desde <= s.len() { Some(desde) } else { None }; }
    if desde > s.len() { return None; }
    s[desde..].windows(p.len()).position(|w| w == p).map(|i| i + desde)
}

fn find(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let s = sarg(e, arg(a, 0), "find")?;
    let pat = sarg(e, arg(a, 1), "find")?;
    let n = s.len() as f64;
    let mut ini = pos_i(if arg(a, 2).es_nil() { 1.0 } else { js_num(arg(a, 2)).trunc() }, n);
    if ini < 1.0 || ini.is_nan() { ini = 1.0; }
    if ini > n + 1.0 { return Ok(()); }
    let ini = ini as usize;
    if arg(a, 3).es_verdad() || !tiene_especiales(&pat) {
        if let Some(k) = buscar_plano(&s, &pat, ini - 1) { out.push(Valor::Num((k + 1) as f64)); out.push(Valor::Num((k + pat.len()) as f64)); }
        return Ok(());
    }
    if let Some(m) = buscar(e, &s, &pat, ini - 1)? {
        out.push(Valor::Num((m.ini + 1) as f64));
        out.push(Valor::Num(m.fin as f64));
        out.extend(m.caps);
    }
    Ok(())
}

fn match_(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let s = sarg(e, arg(a, 0), "match")?;
    let pat = sarg(e, arg(a, 1), "match")?;
    let n = s.len() as f64;
    let mut ini = pos_i(if arg(a, 2).es_nil() { 1.0 } else { js_num(arg(a, 2)).trunc() }, n);
    if ini < 1.0 || ini.is_nan() { ini = 1.0; }
    if let Some(m) = buscar(e, &s, &pat, ini as usize - 1)? {
        if m.caps.is_empty() { out.push(Valor::from(&s[m.ini..m.fin])); } else { out.extend(m.caps); }
    }
    Ok(())
}

fn gmatch(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let s: Rc<Cadena> = match arg(a, 0) { Valor::Cad(c) => c.clone(), otro => Cadena::desde_vec(sarg(e, otro, "gmatch")?.into_owned()) };
    let pat: Rc<Cadena> = match arg(a, 1) { Valor::Cad(c) => c.clone(), otro => Cadena::desde_vec(sarg(e, otro, "gmatch")?.into_owned()) };
    let pos = Cell::new(0usize);
    out.push(Estado::funcion_rapida(move |e, _, out| {
        let (sb, pb) = (s.bytes(), pat.bytes());
        while pos.get() <= sb.len() {
            if let Some(m) = una_vez(e, sb, pb, pos.get())? {
                pos.set(if m.fin > pos.get() { m.fin } else { pos.get() + 1 });
                if m.caps.is_empty() { out.push(Valor::from(&sb[m.ini..m.fin])); } else { out.extend(m.caps); }
                return Ok(());
            }
            pos.set(pos.get() + 1);
        }
        Ok(())
    }));
    Ok(())
}

fn gsub(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let s = sarg(e, arg(a, 0), "gsub")?.into_owned();
    let pat = sarg(e, arg(a, 1), "gsub")?.into_owned();
    let rep = arg(a, 2).clone();
    let max = if arg(a, 3).es_nil() { f64::INFINITY } else { js_num(arg(a, 3)) };
    let anc = pat.first() == Some(&b'^');
    let mut r: Vec<u8> = Vec::with_capacity(s.len());
    let mut pos = 0usize;
    let mut n = 0usize;
    let rep_txt: Option<Vec<u8>> = match &rep { Valor::Cad(c) => Some(c.bytes().to_vec()), Valor::Num(x) => Some(fmt_num(*x).into_bytes()), _ => None };
    while (n as f64) < max {
        match una_vez(e, &s, &pat, pos)? {
            Some(m) => {
                n += 1;
                let todo = &s[m.ini..m.fin];
                let v: Valor = if let Some(rt) = &rep_txt {
                    let mut x = Vec::with_capacity(rt.len());
                    let mut i = 0;
                    while i < rt.len() {
                        if rt[i] == b'%' && i + 1 < rt.len() && (rt[i + 1].is_ascii_digit() || rt[i + 1] == b'%') {
                            let d = rt[i + 1];
                            if d == b'%' { x.push(b'%'); } else if d == b'0' { x.extend_from_slice(todo); } else {
                                let di = (d - b'0') as usize;
                                match m.caps.get(di - 1) {
                                    Some(Valor::Num(p)) => x.extend_from_slice(js_tostring(*p).as_bytes()),
                                    Some(Valor::Cad(c)) => x.extend_from_slice(c.bytes()),
                                    Some(_) => {}
                                    None => { if di != 1 { return Err(e.error("invalid capture index")); } x.extend_from_slice(todo); }
                                }
                            }
                            i += 2;
                        } else {
                            x.push(rt[i]);
                            i += 1;
                        }
                    }
                    Valor::from(x)
                } else if let Valor::Tabla(t) = &rep {
                    let c0 = m.caps.first().cloned().unwrap_or_else(|| Valor::from(todo));
                    let v = t.borrow().get(&c0);
                    v
                } else {
                    let args = if m.caps.is_empty() { vec![Valor::from(todo)] } else { m.caps.clone() };
                    e.llamar_1(&rep, &args, "gsub")?
                };
                match &v {
                    Valor::Nil | Valor::Bool(false) => r.extend_from_slice(todo),
                    Valor::Num(x) => r.extend_from_slice(fmt_num(*x).as_bytes()),
                    Valor::Cad(c) => r.extend_from_slice(c.bytes()),
                    otro => return Err(e.error(&format!("invalid replacement value (a {})", otro.tipo()))),
                }
                if m.fin > m.ini { pos = m.fin; } else { if pos < s.len() { r.push(s[pos]); } pos += 1; }
            }
            None => { if pos < s.len() { r.push(s[pos]); } pos += 1; }
        }
        if pos > s.len() || anc { break; }
    }
    if pos < s.len() { r.extend_from_slice(&s[pos..]); }
    out.push(Valor::from(r));
    out.push(Valor::Num(n as f64));
    Ok(())
}
