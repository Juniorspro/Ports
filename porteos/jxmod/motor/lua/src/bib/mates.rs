//! La biblioteca math (las de Math de JavaScript: algunas convierten con R.num y otras como JavaScript, igual que la web).
use super::*;
use crate::valor::Valor;
use crate::{Error, Estado};

macro_rules! una {
    ($nombre:ident, $txt:expr, $f:expr) => {
        fn $nombre(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
            let x = num(e, arg(a, 0), $txt)?;
            out.push(Valor::Num($f(x)));
            Ok(())
        }
    };
}

una!(abs, "abs", f64::abs);
una!(acos, "acos", f64::acos);
una!(asin, "asin", f64::asin);
una!(ceil, "ceil", f64::ceil);
una!(cos, "cos", f64::cos);
una!(exp, "exp", f64::exp);
una!(floor, "floor", crate::numeros::piso);
una!(sin, "sin", f64::sin);
una!(sqrt, "sqrt", f64::sqrt);
una!(tan, "tan", f64::tan);
una!(log10, "log10", f64::log10);
una!(sinh, "sinh", f64::sinh);
una!(cosh, "cosh", f64::cosh);
una!(tanh, "tanh", f64::tanh);

pub(crate) fn abrir(e: &mut Estado) {
    let m = lib(e, "math");
    def(&m, "abs", abs);
    def(&m, "acos", acos);
    def(&m, "asin", asin);
    def(&m, "ceil", ceil);
    def(&m, "cos", cos);
    def(&m, "exp", exp);
    def(&m, "floor", floor);
    def(&m, "sin", sin);
    def(&m, "sqrt", sqrt);
    def(&m, "tan", tan);
    def(&m, "log10", log10);
    def(&m, "sinh", sinh);
    def(&m, "cosh", cosh);
    def(&m, "tanh", tanh);
    def(&m, "log", log);
    def(&m, "atan2", atan2);
    def(&m, "atan", atan);
    def(&m, "pow", pow);
    def(&m, "fmod", fmod);
    def(&m, "mod", fmod);
    def(&m, "modf", modf);
    def(&m, "frexp", frexp);
    def(&m, "ldexp", ldexp);
    def(&m, "deg", deg);
    def(&m, "rad", rad);
    def(&m, "min", min);
    def(&m, "max", max);
    m.borrow_mut().set_str("huge", Valor::Num(f64::INFINITY));
    m.borrow_mut().set_str("pi", Valor::Num(std::f64::consts::PI));
    def(&m, "random", random);
    def(&m, "randomseed", randomseed);
}

fn log(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let v = if arg(a, 1).es_nil() { num(e, arg(a, 0), "log")?.ln() } else { js_num(arg(a, 0)).ln() / js_num(arg(a, 1)).ln() };
    out.push(Valor::Num(v));
    Ok(())
}
fn atan2(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let y = num(e, arg(a, 0), "atan2")?;
    let x = num(e, arg(a, 1), "atan2")?;
    out.push(Valor::Num(y.atan2(x)));
    Ok(())
}
fn atan(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let v = if arg(a, 1).es_nil() { num(e, arg(a, 0), "atan")?.atan() } else { js_num(arg(a, 0)).atan2(js_num(arg(a, 1))) };
    out.push(Valor::Num(v));
    Ok(())
}
fn pow(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    out.push(Valor::Num(crate::vm::potencia(js_num(arg(a, 0)), js_num(arg(a, 1)))));
    Ok(())
}
fn fmod(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    out.push(Valor::Num(js_num(arg(a, 0)) % js_num(arg(a, 1))));
    Ok(())
}
fn modf(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let x = js_num(arg(a, 0));
    let i = if x >= 0.0 { x.floor() } else { x.ceil() };
    out.push(Valor::Num(i));
    out.push(Valor::Num(x - i));
    Ok(())
}
fn frexp(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let x = js_num(arg(a, 0));
    if x == 0.0 { out.push(Valor::Num(0.0)); out.push(Valor::Num(0.0)); return Ok(()); }
    let ex = x.abs().log2().floor() + 1.0;
    out.push(Valor::Num(x / 2f64.powf(ex)));
    out.push(Valor::Num(ex));
    Ok(())
}
fn ldexp(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    out.push(Valor::Num(js_num(arg(a, 0)) * crate::vm::potencia(2.0, js_num(arg(a, 1)))));
    Ok(())
}
fn deg(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    out.push(Valor::Num(js_num(arg(a, 0)) * 180.0 / std::f64::consts::PI));
    Ok(())
}
fn rad(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    out.push(Valor::Num(js_num(arg(a, 0)) * std::f64::consts::PI / 180.0));
    Ok(())
}
/// Math.min / Math.max de JavaScript (nan gana; -0 es menor que 0)
fn min(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    if a.is_empty() { return Err(e.error("bad argument #1 to 'min'")); }
    let mut m = f64::INFINITY;
    for x in a {
        let v = num(e, x, "min")?;
        if v.is_nan() || m.is_nan() { m = f64::NAN; } else if v < m || (v == 0.0 && m == 0.0 && v.is_sign_negative()) { m = v; }
    }
    out.push(Valor::Num(m));
    Ok(())
}
fn max(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    if a.is_empty() { return Err(e.error("bad argument #1 to 'max'")); }
    let mut m = f64::NEG_INFINITY;
    for x in a {
        let v = num(e, x, "max")?;
        if v.is_nan() || m.is_nan() { m = f64::NAN; } else if v > m || (v == 0.0 && m == 0.0 && m.is_sign_negative()) { m = v; }
    }
    out.push(Valor::Num(m));
    Ok(())
}

/// un número al azar en [0, 1) (xorshift64*)
pub(crate) fn azar(e: &mut Estado) -> f64 {
    let mut x = e.azar;
    x ^= x >> 12;
    x ^= x << 25;
    x ^= x >> 27;
    e.azar = x;
    let r = x.wrapping_mul(0x2545_F491_4F6C_DD1D);
    (r >> 11) as f64 / (1u64 << 53) as f64
}

fn random(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let r = azar(e);
    let v = if arg(a, 0).es_nil() {
        r
    } else if arg(a, 1).es_nil() {
        1.0 + (r * js_num(arg(a, 0)).floor()).floor()
    } else {
        let lo = js_num(arg(a, 0)).floor();
        lo + (r * (js_num(arg(a, 1)).floor() - lo + 1.0)).floor()
    };
    out.push(Valor::Num(v));
    Ok(())
}

fn randomseed(e: &mut Estado, a: &[Valor], _: &mut Vec<Valor>) -> Result<(), Error> {
    let s = js_num(arg(a, 0));
    if s.is_finite() { e.azar = (s.to_bits() ^ 0x9E37_79B9_7F4A_7C15) | 1; }
    Ok(())
}
