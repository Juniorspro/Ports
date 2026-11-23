//! debug: lo poco que trae la web (traceback devuelve el mensaje, getinfo el archivo y la línea).
use super::*;
use crate::valor::{Tabla, Valor};
use crate::{Error, Estado};

pub(crate) fn abrir(e: &mut Estado) {
    let d = lib(e, "debug");
    def(&d, "traceback", traceback);
    def(&d, "getinfo", getinfo);
    def(&d, "getmetatable", getmetatable);
    def(&d, "setmetatable", setmetatable);
    def(&d, "sethook", nada);
    def(&d, "getlocal", nada);
    def(&d, "getupvalue", nada);
}

fn traceback(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let m = arg(a, 0);
    out.push(if m.es_nil() { Valor::from("stack traceback:") } else { Valor::Cad(e.tostring(m)?) });
    Ok(())
}

fn getinfo(e: &mut Estado, _: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let donde = e.donde();
    let (archivo, linea) = match donde.rsplit_once(':') { Some((a, l)) => (a.to_string(), l.parse::<f64>().unwrap_or(0.0)), None => (donde.clone(), 0.0) };
    let archivo = archivo.split(':').next().unwrap_or("").to_string();
    let t = Tabla::nueva_ref();
    {
        let mut tb = t.borrow_mut();
        tb.set_str("short_src", Valor::from(archivo.as_str()));
        tb.set_str("source", Valor::from(format!("@{archivo}")));
        tb.set_str("currentline", Valor::Num(linea));
    }
    out.push(Valor::Tabla(t));
    Ok(())
}

fn getmetatable(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    if let Some(m) = e.meta_de(arg(a, 0)) { out.push(Valor::Tabla(m)); }
    Ok(())
}

fn setmetatable(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let v = arg(a, 0);
    let m = match arg(a, 1) { Valor::Tabla(m) => Some(m.clone()), _ => None };
    match v {
        Valor::Tabla(t) => t.borrow_mut().meta = m,
        Valor::Udata(u) => u.set_meta(m),
        _ => {}
    }
    if !v.es_nil() { out.push(v.clone()); }
    Ok(())
}

fn nada(_: &mut Estado, _: &[Valor], _: &mut Vec<Valor>) -> Result<(), Error> { Ok(()) }
