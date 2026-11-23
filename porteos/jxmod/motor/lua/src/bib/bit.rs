//! bit (la de LuaJIT, como la web: enteros de 32 bits con las operaciones de JavaScript; rshift da sin signo).
use super::*;
use crate::numeros::to_int32;
use crate::valor::Valor;
use crate::{Error, Estado};

pub(crate) fn abrir(e: &mut Estado) {
    let b = lib(e, "bit");
    def(&b, "band", band);
    def(&b, "bor", bor);
    def(&b, "bxor", bxor);
    def(&b, "bnot", bnot);
    def(&b, "lshift", lshift);
    def(&b, "rshift", rshift);
    def(&b, "arshift", arshift);
    def(&b, "tobit", tobit);
    def(&b, "tohex", tohex);
    def(&b, "rol", rol);
    def(&b, "ror", ror);
    def(&b, "bswap", bswap);
}

fn b32(e: &Estado, v: &Valor) -> Result<i32, Error> { Ok(to_int32(num(e, v, "bit")?)) }
fn n31(v: &Valor) -> u32 { (to_int32(js_num(v)) & 31) as u32 }
fn res(out: &mut Vec<Valor>, x: f64) -> Result<(), Error> { out.push(Valor::Num(x)); Ok(()) }

fn band(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let mut x = -1i32;
    for v in a { x &= b32(e, v)?; }
    res(out, x as f64)
}
fn bor(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let mut x = 0i32;
    for v in a { x |= b32(e, v)?; }
    res(out, x as f64)
}
fn bxor(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let mut x = 0i32;
    for v in a { x ^= b32(e, v)?; }
    res(out, x as f64)
}
fn bnot(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> { res(out, (!b32(e, arg(a, 0))?) as f64) }
fn lshift(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> { res(out, b32(e, arg(a, 0))?.wrapping_shl(n31(arg(a, 1))) as f64) }
fn rshift(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> { res(out, ((b32(e, arg(a, 0))? as u32) >> n31(arg(a, 1))) as f64) }
fn arshift(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> { res(out, (b32(e, arg(a, 0))? >> n31(arg(a, 1))) as f64) }
fn tobit(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> { res(out, b32(e, arg(a, 0))? as f64) }
fn tohex(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let x = b32(e, arg(a, 0))? as u32;
    let n = if arg(a, 1).es_nil() { 8 } else { to_int32(js_num(arg(a, 1))) };
    let s = format!("{:08x}", x);
    let k = (n.unsigned_abs() as usize).min(8);
    let mut s = s[8 - k..].to_string();
    if n < 0 { s = s.to_uppercase(); }
    out.push(Valor::from(s));
    Ok(())
}
fn rol(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let x = b32(e, arg(a, 0))? as u32;
    res(out, x.rotate_left(n31(arg(a, 1))) as i32 as f64)
}
fn ror(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let x = b32(e, arg(a, 0))? as u32;
    res(out, x.rotate_right(n31(arg(a, 1))) as i32 as f64)
}
fn bswap(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let x = b32(e, arg(a, 0))?;
    res(out, x.swap_bytes() as f64)
}
