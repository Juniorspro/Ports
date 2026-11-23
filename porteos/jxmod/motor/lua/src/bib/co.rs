//! coroutine: corrutinas de verdad (cada una con su pila de marcos; pueden ceder desde funciones anidadas y desde
//! adentro de un pcall, como en la web y en LuaJIT; no desde un metamétodo ni desde una nativa que llama a Lua).
use std::cell::{Cell, RefCell};
use std::rc::Rc;

use super::*;
use crate::valor::{Corrutina, EstadoCo, Valor};
use crate::vm::Hilo;
use crate::{Error, Estado};

pub(crate) fn abrir(e: &mut Estado) {
    let c = lib(e, "coroutine");
    def(&c, "create", create);
    def(&c, "resume", resume);
    def(&c, "wrap", wrap);
    c.borrow_mut().set_str("yield", nativa_esp(ceder, crate::valor::Especial::Ceder));
    def(&c, "status", status);
    def(&c, "running", running);
    def(&c, "isyieldable", isyieldable);
}

fn nueva(e: &Estado, f: &Valor) -> Result<Rc<RefCell<Corrutina>>, Error> {
    if !matches!(f, Valor::Func(_)) { return Err(e.error("bad argument #1 to 'create' (function expected)")); }
    Ok(Rc::new(RefCell::new(Corrutina { estado: EstadoCo::Suspendida, hilo: Hilo::default(), f: f.clone(), iniciada: false, id: Cell::new(0) })))
}

fn create(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    out.push(Valor::Hilo(nueva(e, arg(a, 0))?));
    Ok(())
}

fn resume(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let c = match arg(a, 0) { Valor::Hilo(c) => c.clone(), _ => return Err(e.error("bad argument #1 to 'resume' (coroutine expected)")) };
    let args = if a.len() > 1 { a[1..].to_vec() } else { vec![] };
    match e.reanudar(&c, args)? {
        Ok(v) => { out.push(Valor::Bool(true)); out.extend(v); }
        Err(m) => { out.push(Valor::Bool(false)); out.push(m); }
    }
    Ok(())
}

fn wrap(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let c = nueva(e, arg(a, 0))?;
    out.push(Estado::funcion_rapida(move |e, a, out| {
        match e.reanudar(&c, a.to_vec())? {
            Ok(v) => { out.extend(v); Ok(()) }
            Err(m) => Err(Error::con_valor(m)),
        }
    }));
    Ok(())
}

/// (coroutine.yield lo hace la máquina)
fn ceder(e: &mut Estado, _: &[Valor], _: &mut Vec<Valor>) -> Result<(), Error> { Err(e.error("attempt to yield across a C-call boundary")) }

fn status(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    if let Valor::Hilo(c) = arg(a, 0) {
        let s = match c.try_borrow().map(|c| c.estado).unwrap_or(EstadoCo::Corriendo) {
            EstadoCo::Suspendida => "suspended",
            EstadoCo::Corriendo => "running",
            EstadoCo::Muerta => "dead",
        };
        out.push(Valor::from(s));
    }
    Ok(())
}

fn running(e: &mut Estado, _: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    if let Some(c) = e.co_pila.last() { out.push(Valor::Hilo(c.clone())); }
    Ok(())
}

fn isyieldable(e: &mut Estado, _: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    out.push(Valor::Bool(!e.co_pila.is_empty()));
    Ok(())
}
