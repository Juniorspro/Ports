//! La biblioteca de Lua que trae la web (lo que en `luaCrearRuntime` está hecho en JavaScript; lo de GMod escrito en
//! Lua —string.Explode, table.Copy...— está en gmod_prelude.js y se corre arriba de esto). Cada función copia lo que
//! hace la web: los mismos mensajes de error y la misma cantidad de resultados (las que en la web devuelven
//! `undefined` no devuelven nada, como `string.find` sin coincidencia).
pub mod base;
pub mod bit;
pub mod cadena;
pub mod co;
pub mod debug;
mod formato;
pub mod mates;
pub mod os;
mod patrones;
pub mod tabla;
pub mod utf8;

use crate::valor::{Especial, Funcion, Tabla, TablaRef, Valor};
use crate::{Error, Estado};

pub(crate) type Nat = fn(&mut Estado, &[Valor], &mut Vec<Valor>) -> Result<(), Error>;

pub(crate) const NIL: &Valor = &Valor::Nil;

/// todas menos utf8, que en la web es de la capa de GMod (gmod_api.js): `bib::utf8::abrir`
pub(crate) fn abrir_todas(e: &mut Estado) {
    base::abrir(e);
    cadena::abrir(e);
    tabla::abrir(e);
    mates::abrir(e);
    os::abrir(e);
    bit::abrir(e);
    co::abrir(e);
    debug::abrir(e);
}

/// una función nativa como valor
pub(crate) fn nativa(f: Nat) -> Valor { Valor::Func(Funcion::nativa(Box::new(f), Especial::No)) }
pub(crate) fn nativa_esp(f: Nat, esp: Especial) -> Valor { Valor::Func(Funcion::nativa(Box::new(f), esp)) }
/// poner una función nativa en una tabla
pub(crate) fn def(t: &TablaRef, nombre: &str, f: Nat) { t.borrow_mut().set_str(nombre, nativa(f)); }
/// la tabla global `nombre` (la crea si no está)
pub(crate) fn lib(e: &mut Estado, nombre: &str) -> TablaRef {
    if let Valor::Tabla(t) = e.global(nombre) { return t; }
    let t = Tabla::nueva_ref();
    e.set_global(nombre, Valor::Tabla(t.clone()));
    t
}
/// el argumento i (nil si no vino)
#[inline]
pub(crate) fn arg(a: &[Valor], i: usize) -> &Valor { a.get(i).unwrap_or(NIL) }
/// R.num de la web: un número o un texto numérico; si no, «'que' necesita un número»
#[inline]
pub(crate) fn num(e: &Estado, v: &Valor, que: &str) -> Result<f64, Error> {
    match crate::vm::a_num(v) { Some(x) => Ok(x), None => Err(e.error(&format!("'{}' necesita un número", que))) }
}
/// ToNumber de JavaScript (lo que hace la web cuando usa el valor sin convertir: Math.floor(x), x & 31...)
pub(crate) fn js_num(v: &Valor) -> f64 {
    match v {
        Valor::Num(n) => *n,
        Valor::Nil => f64::NAN,
        Valor::Bool(b) => *b as u8 as f64,
        Valor::Cad(s) => crate::numeros::js_texto_a_numero(s.bytes()),
        _ => f64::NAN,
    }
}
/// String(v) de JavaScript para un valor de Lua (lo que hace la web cuando concatena sin tostring)
pub(crate) fn js_string(v: &Valor) -> Vec<u8> {
    match v {
        Valor::Cad(s) => s.bytes().to_vec(),
        Valor::Num(n) => crate::numeros::js_tostring(*n).into_bytes(),
        Valor::Nil => b"undefined".to_vec(),
        Valor::Bool(b) => if *b { b"true".to_vec() } else { b"false".to_vec() },
        Valor::Func(_) => b"function () { [native code] }".to_vec(),
        _ => b"[object Object]".to_vec(),
    }
}
/// cómo queda un valor de Lua pegado a un texto en JavaScript ('ERROR: ' + v): para comparar con la web
pub fn js_texto(v: &Valor) -> Vec<u8> { js_string(v) }
/// la verdad de JavaScript (para `sep ?` y parecidos): false, nil, 0, NaN y "" son falsos
pub(crate) fn js_verdad(v: &Valor) -> bool {
    match v {
        Valor::Nil | Valor::Bool(false) => false,
        Valor::Num(n) => *n != 0.0 && !n.is_nan(),
        Valor::Cad(s) => !s.is_empty(),
        _ => true,
    }
}
