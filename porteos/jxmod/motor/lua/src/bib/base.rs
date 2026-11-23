//! La biblioteca base: print, type, tostring, tonumber, raw*, metatablas, assert, error, pcall, select, next, pairs,
//! ipairs, unpack, package (con seeall), loadstring y load, como `luaCrearRuntime` de la web.
use std::rc::Rc;

use super::*;
use crate::valor::{Especial, Tabla, Valor};
use crate::vm::a_num;
use crate::{Error, Estado};

pub(crate) fn abrir(e: &mut Estado) {
    let g = e.globales();
    def(&g, "print", print);
    def(&g, "type", tipo);
    def(&g, "tostring", tostring);
    def(&g, "tonumber", tonumber);
    def(&g, "rawget", rawget);
    def(&g, "rawset", rawset);
    def(&g, "rawequal", rawequal);
    def(&g, "rawlen", rawlen);
    def(&g, "setmetatable", setmetatable);
    def(&g, "getmetatable", getmetatable);
    def(&g, "assert", assert);
    def(&g, "error", error);
    g.borrow_mut().set_str("pcall", nativa_esp(pcall, Especial::Pcall));
    g.borrow_mut().set_str("xpcall", nativa_esp(pcall, Especial::Xpcall));
    def(&g, "select", select);
    let siguiente = nativa_esp(next, Especial::Next);
    g.borrow_mut().set_str("next", siguiente.clone());
    e.fn_next = siguiente;
    e.fn_ipairs = nativa_esp(ipairs_aux, Especial::IpairsAux);
    def(&g, "pairs", pairs);
    def(&g, "ipairs", ipairs);
    def(&g, "unpack", unpack);
    def(&g, "collectgarbage", collectgarbage);
    def(&g, "setfenv", setfenv);
    def(&g, "getfenv", getfenv);
    let pk = match g.borrow().get_str("package") { Valor::Tabla(t) => t, _ => Tabla::nueva_ref() };
    if !matches!(pk.borrow().get_str("loaded"), Valor::Tabla(_)) { pk.borrow_mut().set_str("loaded", Valor::tabla_nueva()); }
    def(&pk, "seeall", seeall);
    g.borrow_mut().set_str("package", Valor::Tabla(pk));
    def(&g, "loadstring", loadstring);
    def(&g, "load", load);
    g.borrow_mut().set_str("_G", Valor::Tabla(g.clone()));
    g.borrow_mut().set_str("_VERSION", Valor::from("Lua 5.1"));
}

fn print(e: &mut Estado, a: &[Valor], _: &mut Vec<Valor>) -> Result<(), Error> {
    let mut buf = Vec::new();
    for (i, v) in a.iter().enumerate() {
        if i > 0 { buf.push(b'\t'); }
        let s = e.tostring(v)?;
        buf.extend_from_slice(s.bytes());
    }
    (e.salida)(&buf);
    Ok(())
}

fn tipo(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    out.push(Valor::Cad(e.n.tipo(arg(a, 0)).clone()));
    Ok(())
}

fn tostring(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    out.push(Valor::Cad(e.tostring(arg(a, 0))?));
    Ok(())
}

fn tonumber(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let (v, b) = (arg(a, 0), arg(a, 1));
    if b.es_nil() || matches!(b, Valor::Num(x) if *x == 10.0) {
        if let Some(x) = a_num(v) { out.push(Valor::Num(x)); }
        return Ok(());
    }
    // String(v).trim().toLowerCase(), parseInt(s, b) y que sean todos dígitos de esa base
    let s = String::from_utf8_lossy(&js_string(v)).trim().to_lowercase();
    if s.is_empty() { return Ok(()); }
    let base = crate::numeros::to_int32(js_num(b));
    if !(2..=36).contains(&base) { return Ok(()); }
    let (neg, dig) = match s.strip_prefix('-') { Some(r) => (true, r), None => (false, s.as_str()) };
    if dig.is_empty() { return Ok(()); }
    let mut n = 0f64;
    for c in dig.chars() {
        match c.to_digit(base as u32) { Some(d) => n = n * base as f64 + d as f64, None => return Ok(()) }
    }
    out.push(Valor::Num(if neg { -n } else { n }));
    Ok(())
}

fn rawget(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    if let Valor::Tabla(t) = arg(a, 0) {
        let v = t.borrow().get(arg(a, 1));
        if !v.es_nil() { out.push(v); }
    }
    Ok(())
}

fn rawset(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    match arg(a, 0) {
        Valor::Tabla(t) => {
            t.borrow_mut().set(arg(a, 1).clone(), arg(a, 2).clone()).map_err(|m| Error::nuevo(m.mensaje()))?;
            out.push(Valor::Tabla(t.clone()));
            Ok(())
        }
        _ => Err(e.error("bad argument #1 to 'rawset' (table expected)")),
    }
}

fn rawequal(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    out.push(Valor::Bool(arg(a, 0).crudo_igual(arg(a, 1))));
    Ok(())
}

fn rawlen(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let n = match arg(a, 0) { Valor::Tabla(t) => t.borrow().len(), otro => js_string(otro).len() };
    out.push(Valor::Num(n as f64));
    Ok(())
}

fn setmetatable(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let t = match arg(a, 0) { Valor::Tabla(t) => t.clone(), _ => return Err(e.error("bad argument #1 to setmetatable (table expected)")) };
    let m = match arg(a, 1) { Valor::Tabla(m) => Some(m.clone()), _ => None };
    t.borrow_mut().meta = m;
    out.push(Valor::Tabla(t));
    Ok(())
}

fn getmetatable(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    if let Some(m) = e.meta_de(arg(a, 0)) {
        let p = m.borrow().get_cad(&e.n.metatable).cloned();
        out.push(p.unwrap_or(Valor::Tabla(m)));
    }
    Ok(())
}

fn assert(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    if !arg(a, 0).es_verdad() {
        let m = arg(a, 1);
        return Err(Error::con_valor(if m.es_nil() { Valor::from("assertion failed!") } else { m.clone() }));
    }
    out.extend(a.iter().cloned());
    if a.len() < 2 { out.push(Valor::Nil); }
    Ok(())
}

fn error(e: &mut Estado, a: &[Valor], _: &mut Vec<Valor>) -> Result<(), Error> {
    let m = arg(a, 0);
    let nivel0 = matches!(arg(a, 1), Valor::Num(x) if *x == 0.0);
    let v = match m {
        Valor::Cad(s) if !nivel0 => {
            let mut b = e.donde().into_bytes();
            b.extend_from_slice(b": ");
            b.extend_from_slice(s.bytes());
            Valor::from(b)
        }
        otro => otro.clone(),
    };
    Err(Error::con_valor(v))
}

/// (pcall y xpcall los hace la máquina; esto no se llama)
fn pcall(e: &mut Estado, _: &[Valor], _: &mut Vec<Valor>) -> Result<(), Error> { Err(e.error("pcall")) }

fn select(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let n = arg(a, 0);
    let resto = if a.is_empty() { &a[..] } else { &a[1..] };
    if let Valor::Cad(s) = n {
        if s.bytes() == b"#" { out.push(Valor::Num(resto.len() as f64)); return Ok(()); }
    }
    let x = num(e, n, "select")?;
    let len = resto.len() as f64;
    let i = if x < 0.0 { len + x } else { x - 1.0 };
    let ini = if i.is_nan() { 0.0 } else { i.max(0.0).trunc() };
    if ini < len { out.extend(resto[ini as usize..].iter().cloned()); }
    Ok(())
}

fn next(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    match arg(a, 0) {
        Valor::Tabla(t) => {
            if let Some((k, v)) = t.borrow().siguiente(arg(a, 1)) { out.push(k); out.push(v); }
            Ok(())
        }
        _ => Err(e.error("bad argument #1 to next (table expected)")),
    }
}

fn pairs(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let t = arg(a, 0);
    let h = e.meta_campo(t, &e.n.pairs.clone());
    if !h.es_nil() {
        let r = e.llamar_v(&h, &[t.clone()], "__pairs")?;
        out.extend(r.into_iter().take(3));
        return Ok(());
    }
    if !matches!(t, Valor::Tabla(_)) { return Err(e.error(&format!("bad argument #1 to pairs (table expected, got {})", t.tipo()))); }
    out.push(e.fn_next.clone());
    out.push(t.clone());
    out.push(Valor::Nil);
    Ok(())
}

fn ipairs(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let t = arg(a, 0);
    if t.es_nil() { return Err(e.error("bad argument #1 to ipairs (table expected, got nil)")); }
    out.push(e.fn_ipairs.clone());
    out.push(t.clone());
    out.push(Valor::Num(0.0));
    Ok(())
}

fn ipairs_aux(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let t = arg(a, 0);
    let i = a_num(arg(a, 1)).unwrap_or(0.0) + 1.0;
    let v = match t { Valor::Tabla(x) if x.borrow().meta.is_none() => x.borrow().get(&Valor::Num(i)), _ => e.indexar(t, &Valor::Num(i))? };
    if !v.es_nil() { out.push(Valor::Num(i)); out.push(v); }
    Ok(())
}

pub(crate) fn unpack(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let t = arg(a, 0);
    let i = if arg(a, 1).es_nil() { 1.0 } else { js_num(arg(a, 1)) };
    let j = if arg(a, 2).es_nil() { js_num(&e.largo(t)?) } else { js_num(arg(a, 2)) };
    if j - i >= 1e7 { return Err(e.error("too many results to unpack")); }
    let mut k = i;
    if let Valor::Tabla(x) = t {
        if x.borrow().meta.is_none() {
            let tb = x.borrow();
            while k <= j { out.push(tb.get(&Valor::Num(k))); k += 1.0; }
            return Ok(());
        }
    }
    while k <= j { out.push(e.indexar(t, &Valor::Num(k))?); k += 1.0; }
    Ok(())
}

fn collectgarbage(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    if matches!(arg(a, 0), Valor::Cad(s) if s.bytes() == b"count") { out.push(Valor::Num(1024.0)); out.push(Valor::Num(0.0)); } else { out.push(Valor::Num(0.0)); }
    Ok(())
}

fn setfenv(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    if !arg(a, 0).es_nil() { out.push(arg(a, 0).clone()); }
    Ok(())
}

fn getfenv(e: &mut Estado, _: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    out.push(Valor::Tabla(e.globales()));
    Ok(())
}

fn seeall(e: &mut Estado, a: &[Valor], _: &mut Vec<Valor>) -> Result<(), Error> {
    if let Valor::Tabla(m) = arg(a, 0) {
        let mt = m.borrow().meta.clone().unwrap_or_else(Tabla::nueva_ref);
        mt.borrow_mut().set_str("__index", Valor::Tabla(e.globales()));
        m.borrow_mut().meta = Some(mt);
    }
    Ok(())
}

fn cargar(e: &mut Estado, src: &[u8], nombre: &Valor, defecto: &str, out: &mut Vec<Valor>) {
    let nombre = if js_verdad(nombre) { String::from_utf8_lossy(&js_string(nombre)).into_owned() } else { defecto.to_string() };
    match e.compilar(src, &nombre) {
        Ok(f) => out.push(f),
        Err(err) => { out.push(Valor::Nil); out.push(err.valor); }
    }
}

fn loadstring(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let src = js_string(arg(a, 0));
    cargar(e, &src, arg(a, 1), "loadstring", out);
    Ok(())
}

fn load(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let src = match arg(a, 0) {
        Valor::Func(_) => {
            let f = arg(a, 0).clone();
            let mut s = Vec::new();
            loop {
                let x = e.llamar_1(&f, &[], "load")?;
                if x.es_nil() || matches!(&x, Valor::Cad(c) if c.is_empty()) { break; }
                s.extend(js_string(&x));
            }
            s
        }
        otro => js_string(otro),
    };
    cargar(e, &src, arg(a, 1), "load", out);
    Ok(())
}

/// module("x", package.seeall) (R.modulo de la web): la tabla x (o a.b.c) con _NAME, _M y _PACKAGE, en package.loaded
pub(crate) fn crear_modulo(e: &mut Estado, a: &[Valor]) -> Result<crate::TablaRef, Error> {
    let nom = String::from_utf8_lossy(&js_string(arg(a, 0))).into_owned();
    let mut t = e.globales();
    for p in nom.split('.') {
        let x = t.borrow().get_str(p);
        let x = match x {
            Valor::Tabla(x) => x,
            _ => { let n = Tabla::nueva_ref(); t.borrow_mut().set_str(p, Valor::Tabla(n.clone())); n }
        };
        t = x;
    }
    {
        let mut tb = t.borrow_mut();
        tb.set_str("_NAME", Valor::from(nom.as_str()));
        tb.set_str("_M", Valor::Tabla(t.clone()));
        let paquete = match nom.rfind('.') { Some(i) => nom[..=i].to_string(), None => String::new() };
        tb.set_str("_PACKAGE", Valor::from(paquete));
    }
    if let Valor::Tabla(pk) = e.global("package") {
        if let Valor::Tabla(l) = pk.borrow().get_str("loaded") { l.borrow_mut().set_str(&nom, Valor::Tabla(t.clone())); }
    }
    for f in a.iter().skip(1) {
        if let Valor::Func(_) = f { e.llamar_v(f, &[Valor::Tabla(t.clone())], "module")?; }
    }
    let _ = Rc::strong_count(&t);
    Ok(t)
}
