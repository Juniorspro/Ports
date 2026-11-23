//! Los valores de Source en Lua (Vector, Angle, Color), la metatabla de las entidades, las constantes que faltan
//! (_G con __index), los métodos que faltan y type()/TypeID() como GMod (gmaIniciar y gmaTipos de la web).

use crate::mates::*;
use crate::nucleo::*;
use jxlua::numeros::{fmt_num, to_fixed};
use jxlua::{Cadena, Error, Estado, Tabla, TablaRef, Valor};
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;

fn es_vec(v: &Valor) -> bool { vec_de(v).is_some() }
fn es_ang(v: &Valor) -> bool { ang_de(v).is_some() }
fn k_es(k: &Valor, s: &str) -> bool { matches!(k, Valor::Cad(c) if c.bytes() == s.as_bytes()) }
fn k_num(k: &Valor, n: f64) -> bool { matches!(k, Valor::Num(x) if *x == n) }

/// la x, y, z de un Vector que viene de argumento (con el error de JavaScript si es nil, como la web)
pub(crate) fn vx(v: &Valor) -> Result<[f64; 3], Error> {
    match v {
        Valor::Nil => Err(Error::nuevo("Cannot read properties of undefined (reading 'x')")),
        _ => Ok(vec_de(v).unwrap_or([f64::NAN; 3])),
    }
}
pub(crate) fn ax(v: &Valor) -> Result<[f64; 3], Error> {
    match v {
        Valor::Nil => Err(Error::nuevo("Cannot read properties of undefined (reading 'p')")),
        _ => Ok(ang_de(v).unwrap_or([f64::NAN; 3])),
    }
}
fn set_vec(v: &Valor, x: [f64; 3]) { if let Valor::Udata(u) = v { u.con_mut(|a: &mut LVec| a.0 = x); } }
fn set_ang(v: &Valor, x: [f64; 3]) { if let Valor::Udata(u) = v { u.con_mut(|a: &mut LAng| a.0 = x); } }
fn fmtn6(x: f64, d: usize) -> String { let s = to_fixed(x, d); fmt_num(s.parse::<f64>().unwrap_or(x)) }

/// un Color (tabla con la metatabla de Color): r, g, b, a acotados como gmColor
pub(crate) fn color(r: &Valor, gg: &Valor, b: &Valor, a: &Valor) -> Valor {
    let c = |v: &Valor| Valor::Num((i32_de(num(v, 255.0)) as f64).min(255.0));
    let t = Tabla::nueva_ref();
    {
        let mut x = t.borrow_mut();
        x.set_str("r", c(r)); x.set_str("g", c(gg)); x.set_str("b", c(b)); x.set_str("a", c(a));
        x.set_meta(g(|g| g.mt.col.clone()));
    }
    Valor::Tabla(t)
}
pub(crate) fn colorf(r: f64, gg: f64, b: f64, a: f64) -> Valor { color(&Valor::Num(r), &Valor::Num(gg), &Valor::Num(b), &Valor::Num(a)) }

pub(crate) fn instalar(e: &mut Estado) {
    let gl = e.globales();
    // ---- Vector ----
    let vm = Tabla::nueva_ref();
    let vi = Tabla::nueva_ref();
    g(|g| { g.mt.vec = Some(vm.clone()); g.mt.vec_i = Some(vi.clone()); });
    {
        let vi2 = vi.clone();
        def(&vm, "__index", move |_, a, o| {
            let k = ar(a, 1);
            let x = vec_de(&a[0]).unwrap_or([f64::NAN; 3]);
            o.push(if k_es(&k, "x") || k_num(&k, 1.0) { Valor::Num(x[0]) } else if k_es(&k, "y") || k_num(&k, 2.0) { Valor::Num(x[1]) } else if k_es(&k, "z") || k_num(&k, 3.0) { Valor::Num(x[2]) } else { vi2.borrow().get(&k) });
            Ok(())
        });
    }
    def(&vm, "__newindex", |_, a, _| {
        let k = ar(a, 1);
        let n = mas(&ar(a, 2));
        let i = if k_es(&k, "x") || k_num(&k, 1.0) { 0 } else if k_es(&k, "y") || k_num(&k, 2.0) { 1 } else if k_es(&k, "z") || k_num(&k, 3.0) { 2 } else { return Ok(()) };
        if let Valor::Udata(u) = &a[0] { u.con_mut(|v: &mut LVec| v.0[i] = n); }
        Ok(())
    });
    fn v_ok(e: &Estado, x: &Valor, op: &str) -> Result<(), Error> {
        if matches!(x, Valor::Num(_)) || vec_de(x).is_some() { return Ok(()); }
        Err(e.error(&format!("bad argument to '{}' (Vector or number expected, got {})", op, x.tipo())))
    }
    def(&vm, "__add", |e, a, o| {
        let (x, y) = (vec_de(&ar(a, 0)), vec_de(&ar(a, 1)));
        let (Some(x), Some(y)) = (x, y) else { return Err(e.error("bad argument to '__add' (Vector or number expected, got nil)")) };
        o.push(nv(x[0] + y[0], x[1] + y[1], x[2] + y[2])); Ok(())
    });
    def(&vm, "__sub", |e, a, o| {
        let (x, y) = (vec_de(&ar(a, 0)), vec_de(&ar(a, 1)));
        let (Some(x), Some(y)) = (x, y) else { return Err(e.error("bad argument to '__sub' (Vector or number expected, got nil)")) };
        o.push(nv(x[0] - y[0], x[1] - y[1], x[2] - y[2])); Ok(())
    });
    def(&vm, "__mul", |e, a, o| {
        let (p, q) = (ar(a, 0), ar(a, 1));
        v_ok(e, &p, "__mul")?; v_ok(e, &q, "__mul")?;
        o.push(match (&p, &q) {
            (Valor::Num(k), _) => { let b = vec_de(&q).unwrap(); nv(b[0] * k, b[1] * k, b[2] * k) }
            (_, Valor::Num(k)) => { let b = vec_de(&p).unwrap(); nv(b[0] * k, b[1] * k, b[2] * k) }
            _ => { let (x, y) = (vec_de(&p).unwrap(), vec_de(&q).unwrap()); nv(x[0] * y[0], x[1] * y[1], x[2] * y[2]) }
        });
        Ok(())
    });
    def(&vm, "__div", |e, a, o| {
        let (p, q) = (ar(a, 0), ar(a, 1));
        v_ok(e, &p, "__div")?; v_ok(e, &q, "__div")?;
        let x = vec_de(&p).unwrap_or([f64::NAN; 3]);
        o.push(match &q { Valor::Num(k) => nv(x[0] / k, x[1] / k, x[2] / k), _ => { let y = vec_de(&q).unwrap(); nv(x[0] / y[0], x[1] / y[1], x[2] / y[2]) } });
        Ok(())
    });
    def(&vm, "__unm", |_, a, o| { let x = vec_de(&ar(a, 0)).unwrap_or([f64::NAN; 3]); o.push(nv(-x[0], -x[1], -x[2])); Ok(()) });
    def(&vm, "__eq", |_, a, o| {
        let (x, y) = (vec_de(&ar(a, 0)), vec_de(&ar(a, 1)));
        o.push(Valor::Bool(matches!((x, y), (Some(x), Some(y)) if x == y)));
        Ok(())
    });
    def(&vm, "__tostring", |_, a, o| {
        let x = vec_de(&ar(a, 0)).unwrap_or([f64::NAN; 3]);
        o.push(Valor::from(format!("{} {} {}", fmtn6(x[0], 6), fmtn6(x[1], 6), fmtn6(x[2], 6))));
        Ok(())
    });
    vm.borrow_mut().set_str("MetaName", cad("Vector"));
    let len = |x: [f64; 3]| js_hypot(&x);
    let d1 = |a: &[Valor]| -> Result<([f64; 3], [f64; 3]), Error> { Ok((vec_de(&a[0]).unwrap_or([f64::NAN; 3]), vx(&ar(a, 1))?)) };
    def(&vi, "Length", move |_, a, o| { o.push(Valor::Num(len(vec_de(&a[0]).unwrap_or([f64::NAN; 3])))); Ok(()) });
    def(&vi, "LengthSqr", |_, a, o| { let x = vec_de(&a[0]).unwrap_or([f64::NAN; 3]); o.push(Valor::Num(x[0] * x[0] + x[1] * x[1] + x[2] * x[2])); Ok(()) });
    def(&vi, "Length2D", |_, a, o| { let x = vec_de(&a[0]).unwrap_or([f64::NAN; 3]); o.push(Valor::Num(js_hypot(&[x[0], x[1]]))); Ok(()) });
    def(&vi, "Length2DSqr", |_, a, o| { let x = vec_de(&a[0]).unwrap_or([f64::NAN; 3]); o.push(Valor::Num(x[0] * x[0] + x[1] * x[1])); Ok(()) });
    def(&vi, "Distance", move |_, a, o| { let (x, y) = d1(a)?; o.push(Valor::Num(js_hypot(&[x[0] - y[0], x[1] - y[1], x[2] - y[2]]))); Ok(()) });
    def(&vi, "DistToSqr", move |_, a, o| { let (x, y) = d1(a)?; o.push(Valor::Num((x[0] - y[0]).powi(2) + (x[1] - y[1]).powi(2) + (x[2] - y[2]).powi(2))); Ok(()) });
    def(&vi, "Distance2D", move |_, a, o| { let (x, y) = d1(a)?; o.push(Valor::Num(js_hypot(&[x[0] - y[0], x[1] - y[1]]))); Ok(()) });
    for n in ["GetNormalized", "GetNormal"] {
        def(&vi, n, move |_, a, o| { let x = vec_de(&a[0]).unwrap_or([f64::NAN; 3]); let l = len(x); let l = if l == 0.0 || l.is_nan() { 1.0 } else { l }; o.push(nv(x[0] / l, x[1] / l, x[2] / l)); Ok(()) });
    }
    def(&vi, "Normalize", move |_, a, _| { let x = vec_de(&a[0]).unwrap_or([f64::NAN; 3]); let l = len(x); let l = if l == 0.0 || l.is_nan() { 1.0 } else { l }; set_vec(&a[0], [x[0] / l, x[1] / l, x[2] / l]); Ok(()) });
    for n in ["Dot", "DotProduct"] { def(&vi, n, move |_, a, o| { let (x, y) = d1(a)?; o.push(Valor::Num(x[0] * y[0] + x[1] * y[1] + x[2] * y[2])); Ok(()) }); }
    def(&vi, "Cross", move |_, a, o| { let (x, y) = d1(a)?; o.push(nv(x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0])); Ok(()) });
    for n in ["Angle", "AngleEx"] { def(&vi, n, |_, a, o| { o.push(naa(dir_ang(vec_de(&a[0]).unwrap_or([f64::NAN; 3])))); Ok(()) }); }
    def(&vi, "Add", move |_, a, _| { let (x, y) = d1(a)?; set_vec(&a[0], [x[0] + y[0], x[1] + y[1], x[2] + y[2]]); Ok(()) });
    def(&vi, "Sub", move |_, a, _| { let (x, y) = d1(a)?; set_vec(&a[0], [x[0] - y[0], x[1] - y[1], x[2] - y[2]]); Ok(()) });
    def(&vi, "Mul", |_, a, _| { let x = vec_de(&a[0]).unwrap_or([f64::NAN; 3]); let k = mas(&ar(a, 1)); set_vec(&a[0], [x[0] * k, x[1] * k, x[2] * k]); Ok(()) });
    def(&vi, "Div", |_, a, _| { let x = vec_de(&a[0]).unwrap_or([f64::NAN; 3]); let k = mas(&ar(a, 1)); set_vec(&a[0], [x[0] / k, x[1] / k, x[2] / k]); Ok(()) });
    def(&vi, "Set", move |_, a, _| { let (_, y) = d1(a)?; set_vec(&a[0], y); Ok(()) });
    def(&vi, "Zero", |_, a, _| { set_vec(&a[0], [0.0; 3]); Ok(()) });
    def(&vi, "IsZero", |_, a, o| { let x = vec_de(&a[0]).unwrap_or([f64::NAN; 3]); let z = |v: f64| v == 0.0 || v.is_nan(); o.push(Valor::Bool(z(x[0]) && z(x[1]) && z(x[2]))); Ok(()) });
    def(&vi, "Unpack", |_, a, o| { let x = vec_de(&a[0]).unwrap_or([f64::NAN; 3]); o.extend([Valor::Num(x[0]), Valor::Num(x[1]), Valor::Num(x[2])]); Ok(()) });
    def(&vi, "SetUnpacked", |_, a, _| { set_vec(&a[0], [mas(&ar(a, 1)), mas(&ar(a, 2)), mas(&ar(a, 3))]); Ok(()) });
    def(&vi, "ToTable", |_, a, o| { let x = vec_de(&a[0]).unwrap_or([f64::NAN; 3]); o.push(tab_de(vec![Valor::Num(x[0]), Valor::Num(x[1]), Valor::Num(x[2])])); Ok(()) });
    def(&vi, "ToColor", |_, a, o| { let x = vec_de(&a[0]).unwrap_or([f64::NAN; 3]); o.push(colorf(x[0] * 255.0, x[1] * 255.0, x[2] * 255.0, 255.0)); Ok(()) });
    def(&vi, "IsEqualTol", move |_, a, o| { let (x, y) = d1(a)?; let tl = mas(&ar(a, 2)); o.push(Valor::Bool((x[0] - y[0]).abs() <= tl && (x[1] - y[1]).abs() <= tl && (x[2] - y[2]).abs() <= tl)); Ok(()) });
    def(&vi, "Rotate", |_, a, _| {
        let an = ang_de(&ar(a, 1)).unwrap_or([0.0; 3]);
        let [f, l, u] = ang_mat(an);
        let x = vec_de(&a[0]).unwrap_or([f64::NAN; 3]);
        set_vec(&a[0], [f[0] * x[0] + l[0] * x[1] + u[0] * x[2], f[1] * x[0] + l[1] * x[1] + u[1] * x[2], f[2] * x[0] + l[2] * x[1] + u[2] * x[2]]);
        Ok(())
    });
    def(&vi, "WithinAABox", |_, a, o| {
        let v = vec_de(&a[0]).unwrap_or([f64::NAN; 3]);
        let (p, q) = (vx(&ar(a, 1))?, vx(&ar(a, 2))?);
        let r = (0..3).all(|i| v[i] >= p[i].min(q[i]) && v[i] <= p[i].max(q[i]));
        o.push(Valor::Bool(r)); Ok(())
    });
    def(&vi, "ToScreen", |_, a, o| {
        let p = a_juego(vec_de(&a[0]).unwrap_or([f64::NAN; 3]));
        let (x, y, vis) = h(|h| h.a_pantalla(p)).unwrap_or((0.0, 0.0, false));
        o.push(tabla_kv(vec![("x", Valor::Num(x)), ("y", Valor::Num(y)), ("visible", Valor::Bool(vis))]));
        Ok(())
    });
    def(&gl, "Vector", |_, a, o| {
        let x = ar(a, 0);
        if let Some(v) = vec_de(&x) { o.push(nva(v)); return Ok(()); }
        if let (Valor::Cad(s), true, true) = (&x, ar(a, 1).es_nil(), ar(a, 2).es_nil()) {
            let p: Vec<f64> = String::from_utf8_lossy(s.bytes()).split_whitespace().map(|t| jxlua::numeros::js_texto_a_numero(t.as_bytes())).collect();
            let c = |i: usize| p.get(i).copied().filter(|x| *x != 0.0 && !x.is_nan()).unwrap_or(0.0);
            o.push(nv(c(0), c(1), c(2)));
            return Ok(());
        }
        o.push(nv(num(&x, 0.0), num(&ar(a, 1), 0.0), num(&ar(a, 2), 0.0)));
        Ok(())
    });
    def(&gl, "VectorRand", |e, a, o| {
        let p = ar(a, 0);
        if !p.es_nil() {
            let (lo, hi) = (mas(&p), mas(&ar(a, 1)));
            let (r1, r2, r3) = (e.azar(), e.azar(), e.azar());
            o.push(nv(lo + r1 * (hi - lo), lo + r2 * (hi - lo), lo + r3 * (hi - lo)));
        } else {
            let (r1, r2, r3) = (e.azar(), e.azar(), e.azar());
            o.push(nv(r1 * 2.0 - 1.0, r2 * 2.0 - 1.0, r3 * 2.0 - 1.0));
        }
        Ok(())
    });
    def(&gl, "LerpVector", |_, a, o| {
        let t = mas(&ar(a, 0));
        let (x, y) = (vx(&ar(a, 1))?, vx(&ar(a, 2))?);
        o.push(nv(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t));
        Ok(())
    });
    // ---- Angle ----
    let am = Tabla::nueva_ref();
    let ai = Tabla::nueva_ref();
    g(|g| { g.mt.ang = Some(am.clone()); g.mt.ang_i = Some(ai.clone()); });
    fn ang_i(k: &Valor) -> Option<usize> {
        if k_es(k, "p") || k_es(k, "pitch") || k_es(k, "x") || k_num(k, 1.0) { Some(0) } else if k_es(k, "y") || k_es(k, "yaw") || k_num(k, 2.0) { Some(1) } else if k_es(k, "r") || k_es(k, "roll") || k_es(k, "z") || k_num(k, 3.0) { Some(2) } else { None }
    }
    {
        let ai2 = ai.clone();
        def(&am, "__index", move |_, a, o| {
            let k = ar(a, 1);
            match ang_i(&k) { Some(i) => o.push(Valor::Num(ang_de(&a[0]).unwrap_or([f64::NAN; 3])[i])), None => o.push(ai2.borrow().get(&k)) }
            Ok(())
        });
    }
    def(&am, "__newindex", |_, a, _| {
        if let Some(i) = ang_i(&ar(a, 1)) { let n = mas(&ar(a, 2)); if let Valor::Udata(u) = &a[0] { u.con_mut(|v: &mut LAng| v.0[i] = n); } }
        Ok(())
    });
    def(&am, "__add", |e, a, o| {
        let (Some(x), Some(y)) = (ang_de(&ar(a, 0)), ang_de(&ar(a, 1))) else { return Err(e.error("bad argument to '__add' (Vector or number expected, got nil)")) };
        o.push(na(x[0] + y[0], x[1] + y[1], x[2] + y[2])); Ok(())
    });
    def(&am, "__sub", |e, a, o| {
        let (Some(x), Some(y)) = (ang_de(&ar(a, 0)), ang_de(&ar(a, 1))) else { return Err(e.error("bad argument to '__sub' (Vector or number expected, got nil)")) };
        o.push(na(x[0] - y[0], x[1] - y[1], x[2] - y[2])); Ok(())
    });
    def(&am, "__mul", |_, a, o| {
        let (p, q) = (ar(a, 0), ar(a, 1));
        o.push(match &p {
            Valor::Num(k) => { let b = ang_de(&q).unwrap_or([f64::NAN; 3]); na(b[0] * k, b[1] * k, b[2] * k) }
            _ => { let b = ang_de(&p).unwrap_or([f64::NAN; 3]); let k = mas(&q); na(b[0] * k, b[1] * k, b[2] * k) }
        });
        Ok(())
    });
    def(&am, "__div", |_, a, o| { let b = ang_de(&ar(a, 0)).unwrap_or([f64::NAN; 3]); let k = mas(&ar(a, 1)); o.push(na(b[0] / k, b[1] / k, b[2] / k)); Ok(()) });
    def(&am, "__unm", |_, a, o| { let b = ang_de(&ar(a, 0)).unwrap_or([f64::NAN; 3]); o.push(na(-b[0], -b[1], -b[2])); Ok(()) });
    def(&am, "__eq", |_, a, o| { let (x, y) = (ang_de(&ar(a, 0)), ang_de(&ar(a, 1))); o.push(Valor::Bool(matches!((x, y), (Some(x), Some(y)) if x == y))); Ok(()) });
    def(&am, "__tostring", |_, a, o| { let x = ang_de(&ar(a, 0)).unwrap_or([f64::NAN; 3]); o.push(Valor::from(format!("{} {} {}", fmtn6(x[0], 3), fmtn6(x[1], 3), fmtn6(x[2], 3)))); Ok(()) });
    am.borrow_mut().set_str("MetaName", cad("Angle"));
    def(&ai, "Forward", |_, a, o| { let f = ang_mat(ax(&a[0])?)[0]; o.push(nva(f)); Ok(()) });
    def(&ai, "Right", |_, a, o| { let l = ang_mat(ax(&a[0])?)[1]; o.push(nv(-l[0], -l[1], -l[2])); Ok(()) });
    def(&ai, "Up", |_, a, o| { let u = ang_mat(ax(&a[0])?)[2]; o.push(nva(u)); Ok(()) });
    def(&ai, "Normalize", |_, a, _| { let x = ang_de(&a[0]).unwrap_or([f64::NAN; 3]); set_ang(&a[0], [nrm(x[0]), nrm(x[1]), nrm(x[2])]); Ok(()) });
    def(&ai, "Zero", |_, a, _| { set_ang(&a[0], [0.0; 3]); Ok(()) });
    def(&ai, "IsZero", |_, a, o| { let x = ang_de(&a[0]).unwrap_or([f64::NAN; 3]); let z = |v: f64| v == 0.0 || v.is_nan(); o.push(Valor::Bool(z(x[0]) && z(x[1]) && z(x[2]))); Ok(()) });
    def(&ai, "Set", |_, a, _| { let y = ax(&ar(a, 1))?; set_ang(&a[0], y); Ok(()) });
    def(&ai, "Unpack", |_, a, o| { let x = ang_de(&a[0]).unwrap_or([f64::NAN; 3]); o.extend([Valor::Num(x[0]), Valor::Num(x[1]), Valor::Num(x[2])]); Ok(()) });
    def(&ai, "SetUnpacked", |_, a, _| { set_ang(&a[0], [mas(&ar(a, 1)), mas(&ar(a, 2)), mas(&ar(a, 3))]); Ok(()) });
    def(&ai, "Add", |_, a, _| { let x = ang_de(&a[0]).unwrap_or([f64::NAN; 3]); let y = ax(&ar(a, 1))?; set_ang(&a[0], [x[0] + y[0], x[1] + y[1], x[2] + y[2]]); Ok(()) });
    def(&ai, "Sub", |_, a, _| { let x = ang_de(&a[0]).unwrap_or([f64::NAN; 3]); let y = ax(&ar(a, 1))?; set_ang(&a[0], [x[0] - y[0], x[1] - y[1], x[2] - y[2]]); Ok(()) });
    def(&ai, "Mul", |_, a, _| { let k = mas(&ar(a, 1)); if !k.is_finite() { return Ok(()); } let x = ang_de(&a[0]).unwrap_or([f64::NAN; 3]); set_ang(&a[0], [x[0] * k, x[1] * k, x[2] * k]); Ok(()) });
    def(&ai, "Div", |_, a, _| { let k = mas(&ar(a, 1)); if k == 0.0 || k.is_nan() { return Ok(()); } let x = ang_de(&a[0]).unwrap_or([f64::NAN; 3]); set_ang(&a[0], [x[0] / k, x[1] / k, x[2] / k]); Ok(()) });
    def(&ai, "RotateAroundAxis", |_, a, _| {
        let an = ang_de(&a[0]).unwrap_or([f64::NAN; 3]);
        let [f, l, u] = ang_mat(an);
        let axv = vx(&ar(a, 1))?;
        let al = js_hypot(&axv);
        let al = if al == 0.0 || al.is_nan() { 1.0 } else { al };
        let (kx, ky, kz) = (axv[0] / al, axv[1] / al, axv[2] / al);
        let gr = mas(&ar(a, 2));
        let (c, s) = ((gr * RAD).cos(), (gr * RAD).sin());
        let rot = |v: [f64; 3]| { let d = kx * v[0] + ky * v[1] + kz * v[2]; [v[0] * c + (ky * v[2] - kz * v[1]) * s + kx * d * (1.0 - c), v[1] * c + (kz * v[0] - kx * v[2]) * s + ky * d * (1.0 - c), v[2] * c + (kx * v[1] - ky * v[0]) * s + kz * d * (1.0 - c)] };
        set_ang(&a[0], mat_ang(rot(f), rot(l), rot(u)));
        Ok(())
    });
    def(&gl, "Angle", |_, a, o| {
        let x = ar(a, 0);
        if let Some(v) = ang_de(&x) { o.push(naa(v)); return Ok(()); }
        if let (Valor::Cad(s), true, true) = (&x, ar(a, 1).es_nil(), ar(a, 2).es_nil()) {
            let p: Vec<f64> = String::from_utf8_lossy(s.bytes()).split_whitespace().map(|t| jxlua::numeros::js_texto_a_numero(t.as_bytes())).collect();
            let c = |i: usize| p.get(i).copied().filter(|x| *x != 0.0 && !x.is_nan()).unwrap_or(0.0);
            o.push(na(c(0), c(1), c(2)));
            return Ok(());
        }
        o.push(na(num(&x, 0.0), num(&ar(a, 1), 0.0), num(&ar(a, 2), 0.0)));
        Ok(())
    });
    def(&gl, "LerpAngle", |_, a, o| {
        let t = mas(&ar(a, 0));
        let (x, y) = (ax(&ar(a, 1))?, ax(&ar(a, 2))?);
        o.push(na(x[0] + nrm(y[0] - x[0]) * t, x[1] + nrm(y[1] - x[1]) * t, x[2] + nrm(y[2] - x[2]) * t));
        Ok(())
    });
    // ---- Color ----
    let cm = Tabla::nueva_ref();
    g(|g| g.mt.col = Some(cm.clone()));
    cm.borrow_mut().set_str("__index", Valor::Tabla(cm.clone()));
    cm.borrow_mut().set_str("MetaName", cad("Color"));
    let cg = |v: &Valor, k: &str| -> Valor { match v { Valor::Tabla(t) => tget(t, k), _ => Valor::Nil } };
    def(&cm, "__tostring", move |e, a, o| {
        let c = ar(a, 0);
        let mut s = Vec::new();
        for (i, k) in ["r", "g", "b", "a"].iter().enumerate() { if i > 0 { s.push(b' '); } let v = cg(&c, k); if !v.es_nil() { s.extend(jxlua::bib::js_texto(&v)); } }
        let _ = e;
        o.push(Valor::from(s)); Ok(())
    });
    def(&cm, "__eq", move |_, a, o| { let (x, y) = (ar(a, 0), ar(a, 1)); o.push(Valor::Bool(["r", "g", "b", "a"].iter().all(|k| cg(&x, k).crudo_igual(&cg(&y, k))))); Ok(()) });
    def(&cm, "ToVector", move |_, a, o| { let c = ar(a, 0); o.push(nv(num(&cg(&c, "r"), 255.0) / 255.0, num(&cg(&c, "g"), 255.0) / 255.0, num(&cg(&c, "b"), 255.0) / 255.0)); Ok(()) });
    def(&cm, "ToTable", move |_, a, o| { let c = ar(a, 0); o.push(tab_de(vec![cg(&c, "r"), cg(&c, "g"), cg(&c, "b"), cg(&c, "a")])); Ok(()) });
    def(&cm, "Unpack", move |_, a, o| { let c = ar(a, 0); o.extend([cg(&c, "r"), cg(&c, "g"), cg(&c, "b"), cg(&c, "a")]); Ok(()) });
    def(&cm, "Copy", move |_, a, o| { let c = ar(a, 0); o.push(color(&cg(&c, "r"), &cg(&c, "g"), &cg(&c, "b"), &cg(&c, "a"))); Ok(()) });
    def(&gl, "Color", |_, a, o| { let al = ar(a, 3); o.push(color(&ar(a, 0), &ar(a, 1), &ar(a, 2), &if al.es_nil() { Valor::Num(255.0) } else { al })); Ok(()) });
    def(&gl, "ColorAlpha", move |_, a, o| { let c = ar(a, 0); o.push(color(&cg(&c, "r"), &cg(&c, "g"), &cg(&c, "b"), &ar(a, 1))); Ok(()) });
    def(&gl, "ColorToHSV", move |_, a, o| {
        let c = ar(a, 0);
        let gc = |k: &str| (if matches!(c, Valor::Tabla(_)) { num(&cg(&c, k), 0.0) } else { 0.0 }) / 255.0;
        let (r, gg, b) = (gc("r"), gc("g"), gc("b"));
        let mx = r.max(gg).max(b);
        let mn = r.min(gg).min(b);
        let d = mx - mn;
        let mut hh = 0.0;
        if d > 0.0 { hh = if mx == r { 60.0 * (((gg - b) / d) % 6.0) } else if mx == gg { 60.0 * ((b - r) / d + 2.0) } else { 60.0 * ((r - gg) / d + 4.0) }; }
        if hh < 0.0 { hh += 360.0; }
        o.extend([Valor::Num(hh), Valor::Num(if mx > 0.0 { d / mx } else { 0.0 }), Valor::Num(mx)]);
        Ok(())
    });
    def(&gl, "HSVToColor", |_, a, o| {
        let (hh, s, v) = (mas(&ar(a, 0)), mas(&ar(a, 1)), mas(&ar(a, 2)));
        let f = |n: f64| { let k = (n + hh / 60.0) % 6.0; v - v * s * k.min(4.0 - k).min(1.0).max(0.0) };
        o.push(colorf(f(5.0) * 255.0, f(3.0) * 255.0, f(1.0) * 255.0, 255.0));
        Ok(())
    });
    {
        let cm2 = cm.clone();
        def(&gl, "IsColor", move |_, a, o| { o.push(Valor::Bool(matches!(ar(a, 0), Valor::Tabla(t) if t.borrow().meta().map(|m| Rc::ptr_eq(&m, &cm2)).unwrap_or(false)))); Ok(()) });
    }
    // ---- entidades ----
    let em = Tabla::nueva_ref();
    let (ent_m, ply_m, wep_m, npc_m, veh_m, phy_m) = (Tabla::nueva_ref(), Tabla::nueva_ref(), Tabla::nueva_ref(), Tabla::nueva_ref(), Tabla::nueva_ref(), Tabla::nueva_ref());
    g(|g| {
        g.mt.ent = Some(em.clone());
        g.mt.ent_m = Some(ent_m.clone()); g.mt.ply_m = Some(ply_m.clone()); g.mt.wep_m = Some(wep_m.clone()); g.mt.npc_m = Some(npc_m.clone()); g.mt.phy_m = Some(phy_m.clone());
        for (n, t) in [("Entity", &ent_m), ("Player", &ply_m), ("Weapon", &wep_m), ("NPC", &npc_m), ("Vehicle", &veh_m), ("PhysObj", &phy_m), ("Vector", &vi), ("Angle", &ai)] {
            g.metas.set(n.to_string(), t.clone());
        }
    });
    for t in [&ent_m, &ply_m, &wep_m, &npc_m, &veh_m, &phy_m] { t.borrow_mut().set_filtro(Some(filtro_lados())); }
    for (n, t) in [("Entity", &ent_m), ("Player", &ply_m), ("Weapon", &wep_m), ("NPC", &npc_m), ("Vehicle", &veh_m), ("PhysObj", &phy_m), ("Vector", &vi), ("Angle", &ai)] {
        t.borrow_mut().set_str("MetaName", cad(n));
        if n != "Vector" && n != "Angle" && n != "Entity" { let m = Tabla::nueva_ref(); m.borrow_mut().set_str("__index", Valor::Tabla(ent_m.clone())); t.borrow_mut().set_meta(Some(m)); }
    }
    {
        let (ent_m, ply_m, wep_m, npc_m) = (ent_m.clone(), ply_m.clone(), wep_m.clone(), npc_m.clone());
        let solo_srv: Vec<Rc<Cadena>> = ["Fire", "Input", "Use", "Activate", "Ignite", "Extinguish", "SetUseType", "TakeDamage", "TakeDamageInfo", "SetTrigger", "SetKeyValue", "GetKeyValues", "PointAtEntity", "SetCreator", "GetCreator", "SetPhysicsAttacker", "GetUnFreezable", "SetUnFreezable"].iter().map(|s| Cadena::interna(s.as_bytes())).collect();
        let k_dt = Cadena::interna(b"dt");
        def(&em, "__index", move |_, a, o| {
            let ev = &a[0];
            let k = ar(a, 1);
            let lado = g(|g| g.ctx);
            let Some((tabla, tabla_c, tipo, dt, clase)) = ce(ev, |e| (e.tabla.clone(), e.tabla_c.clone(), e.tipo, e.dt.clone(), e.clase.clone())) else { o.push(Valor::Nil); return Ok(()) };
            let t0 = if lado == Lado::C { tabla_c.clone().unwrap_or_else(|| tabla.clone()) } else { tabla.clone() };
            let v = t0.borrow().get(&k);
            if !v.es_nil() { o.push(v); return Ok(()); }
            if !Rc::ptr_eq(&t0, &tabla) && tipo == TipoEnt::Arma && !g(|g| g.ini_c.as_ref().map(|x| mismo(x, ev)).unwrap_or(false)) {
                let v = tabla.borrow().get(&k);
                if !v.es_nil() { o.push(v); return Ok(()); }
            }
            if let Valor::Cad(c) = &k { if Rc::ptr_eq(c, &k_dt) || c.bytes() == b"dt" { o.push(Valor::Tabla(dt_l(ev))); return Ok(()); } }
            if let Some(dt) = &dt { let v = dt.borrow().get(&k); if !v.es_nil() { o.push(v); return Ok(()); } }
            let m_tipo = |t: TipoEnt| match t { TipoEnt::Jug => &ply_m, TipoEnt::Arma => &wep_m, TipoEnt::Npc => &npc_m, _ => &ent_m };
            if tipo != TipoEnt::Null {
                if let Some(c) = clase_tabla(&clase, lado) {
                    let v = buscar_en_clase_v(&c, &k);
                    if !v.es_nil() {
                        if !matches!(v, Valor::Func(_)) {
                            if let Valor::Cad(kc) = &k {
                                let b = kc.bytes();
                                if !b.is_empty() && b[0].is_ascii_uppercase() && !(lado == Lado::C && solo_srv.iter().any(|s| s.bytes() == b)) {
                                    let m = m_tipo(tipo);
                                    let mut f = m.borrow().get(&k);
                                    if f.es_nil() { f = ent_m.borrow().get(&k); }
                                    if matches!(f, Valor::Func(_)) { o.push(f); return Ok(()); }
                                }
                            }
                        }
                        o.push(v);
                        return Ok(());
                    }
                }
            }
            if let Valor::Cad(kc) = &k {
                match kc.bytes() {
                    b"Owner" => { let d = ce(ev, |e| e.dueno.clone()).flatten(); o.push(opt_null(&d)); return Ok(()); }
                    b"Weapon" | b"Entity" => { o.push(ev.clone()); return Ok(()); }
                    b"Fire" | b"Input" if lado == Lado::C => { o.push(Valor::Nil); return Ok(()); }
                    _ => {}
                }
            }
            let m = m_tipo(tipo);
            let mut v = m.borrow().get(&k);
            if v.es_nil() && !Rc::ptr_eq(m, &ent_m) { v = ent_m.borrow().get(&k); }
            o.push(v);
            Ok(())
        });
    }
    def(&em, "__newindex", |_, a, _| { if let Some(t) = tabla_de(&a[0]) { let _ = t.borrow_mut().set(ar(a, 1), ar(a, 2)); } Ok(()) });
    def(&em, "__eq", |_, a, o| {
        let (x, y) = (ar(a, 0), ar(a, 1));
        let r = mismo(&x, &y) || match (ce(&x, |e| (e.id, e.tipo == TipoEnt::Null)), ce(&y, |e| (e.id, e.tipo == TipoEnt::Null))) { (Some(p), Some(q)) => p == q, _ => false };
        o.push(Valor::Bool(r)); Ok(())
    });
    def(&em, "__tostring", |_, a, o| {
        let (tipo, id, clase) = ce(&ar(a, 0), |e| (e.tipo, e.id, e.clase.clone())).unwrap_or((TipoEnt::Null, 0, String::new()));
        o.push(Valor::from(match tipo { TipoEnt::Null => "[NULL Entity]".to_string(), TipoEnt::Jug => format!("Player [1][{}]", h(|h| h.nombre_jugador())), _ => format!("Entity [{}][{}]", id, clase) }));
        Ok(())
    });
    def(&em, "__concat", |e, a, o| {
        let mut s = e.tostring(&ar(a, 0))?.bytes().to_vec();
        s.extend_from_slice(e.tostring(&ar(a, 1))?.bytes());
        o.push(Valor::from(s)); Ok(())
    });
    let nul = ent_null(Some(em.clone()));
    g(|g| g.null = nul.clone());
    gl.borrow_mut().set_str("NULL", nul);
    // ---- un método del motor que todavía no está: no rompe el addon (y queda anotado) ----
    e.set_metodo_faltante(Some(Rc::new(|_e: &mut Estado, o: &Valor, m: &Rc<Cadena>| {
        let b = m.bytes();
        if b.is_empty() || !b[0].is_ascii_uppercase() { return None; }
        let tipo = match ent_tipo(o) { Some(TipoEnt::Jug) => "Player".to_string(), Some(TipoEnt::Arma) => "Weapon".to_string(), Some(TipoEnt::Npc) => "NPC".to_string(), Some(_) => "Entity".to_string(), None => tipo_nombre(o).unwrap_or_else(|| "objeto".into()) };
        let k = format!("{}:{}", tipo, m.texto());
        g(|g| *g.faltan.entry(k).or_insert(0) += 1);
        let pregunta = ["Is", "Has", "Can", "Should", "Was", "Did"].iter().any(|p| b.starts_with(p.as_bytes()) && b.len() > p.len() && b[p.len()].is_ascii_uppercase());
        Some(if pregunta { fnat(|_, _, o| { o.push(Valor::Bool(false)); Ok(()) }) } else { fnat(nada) })
    })));
    // ---- las constantes que no están en el prelude: un número fijo por nombre ----
    let gm = Tabla::nueva_ref();
    {
        let cache: Rc<RefCell<HashMap<Vec<u8>, f64>>> = Rc::new(RefCell::new(HashMap::new()));
        let gl2 = Rc::downgrade(&gl);
        def(&gm, "__index", move |e, a, o| {
            let t = ar(a, 0);
            let k = ar(a, 1);
            if let (Valor::Tabla(tt), Some(gl)) = (&t, gl2.upgrade()) {
                if Rc::ptr_eq(tt, &gl) { if let Some(capa) = e.capa_globales() { let v = capa.borrow().get(&k); if !v.es_nil() { o.push(v); return Ok(()); } } }
            }
            let Valor::Cad(kc) = &k else { o.push(Valor::Nil); return Ok(()) };
            let b = kc.bytes();
            if !pre_enum(b) { o.push(Valor::Nil); return Ok(()); }
            let c = *cache.borrow_mut().entry(b.to_vec()).or_insert_with(|| {
                let mut hh: u64 = 5381;
                for ch in String::from_utf8_lossy(b).encode_utf16() { hh = (hh * 33 + ch as u64) % 1_000_000; }
                if b == b"GMOD_MAXDTVARS" { 32.0 } else { 4000.0 + (hh % 900_000) as f64 }
            });
            o.push(Valor::Num(c));
            Ok(())
        });
    }
    gl.borrow_mut().set_meta(Some(gm));
}

/// LuaTablaLados: en una metatabla compartida (Entity, Player...), si el cliente cambia una función que ya estaba, cada
/// lado sigue con la suya (gmaDosLados)
pub(crate) fn filtro_lados() -> jxlua::FiltroAsignacion {
    Rc::new(|k: &Valor, v: &Valor, prev: &Valor| {
        if let Valor::Cad(c) = k { if c.bytes().first() == Some(&b'_') { return None; } }
        let lado = g(|g| g.ctx);
        let Valor::Func(pf) = prev else { return None };
        if let Some(cel) = g(|g| g.dos_lados.get(&(Rc::as_ptr(pf) as *const u8 as usize)).cloned()) {
            let mut c = cel.borrow_mut();
            if lado == Lado::C { c.1 = v.clone(); } else { c.0 = v.clone(); }
            return Some(prev.clone());
        }
        if lado == Lado::C && !prev.crudo_igual(v) {
            let cel = Rc::new(RefCell::new((prev.clone(), v.clone())));
            let c2 = cel.clone();
            let f = fnat(move |e, a, o| { let f = if g(|g| g.ctx) == Lado::C { c2.borrow().1.clone() } else { c2.borrow().0.clone() }; o.extend(e.llamar_aqui(&f, a)?); Ok(()) });
            if let Valor::Func(ff) = &f { let k = Rc::as_ptr(ff) as *const u8 as usize; g(|g| g.dos_lados.insert(k, cel)); }
            return Some(f);
        }
        None
    })
}

/// ^(ACT|KEY|...)_[A-Z0-9_]+$ o ^kRenderFx[A-Z]
fn pre_enum(b: &[u8]) -> bool {
    const PRE: &[&str] = &["ACT", "KEY", "JOYSTICK", "BUTTON_CODE", "SCHED", "TASK", "COND", "MAT", "STENCIL", "STENCILOPERATION", "STENCILCOMPARISONFUNCTION", "MATERIAL", "TEXTUREFLAGS", "CREATERENDERTARGETFLAGS", "NAV", "CAP", "CLASS", "NPC_STATE", "SF", "EFL", "FVPHYSICS", "PLAYERANIMEVENT", "GESTURE_SLOT", "SURF", "DISPSURF", "TRANSMIT", "PATTACH", "OBS_MODE", "RENDERGROUP", "SNDLVL", "FCVAR", "CONTENTS", "MASK", "SOLID", "FSOLID", "COLLISION_GROUP", "MOVETYPE", "DMG", "HITGROUP", "AMMO", "IN", "EF", "FL", "BLOOD_COLOR", "CHAN", "TYPE", "NOTIFY", "ANIM", "AI", "BONE", "SCREENFADE", "SIM", "TRACER", "EFFECT", "FORCE", "HULL", "NUM", "GMOD", "LAST", "FIRST", "D", "BLEND", "BLENDFUNC", "TEXFILTER", "RT_SIZE", "IMAGE_FORMAT", "SND", "USE", "BOX", "TEAM", "PLAYER", "WEAPON_PROFICIENCY", "MOVECOLLIDE", "kRenderFx"];
    if b.len() > 9 && b.starts_with(b"kRenderFx") && b[9].is_ascii_uppercase() { return true; }
    for p in PRE {
        let p = p.as_bytes();
        if b.len() > p.len() + 1 && b.starts_with(p) && b[p.len()] == b'_' && b[p.len() + 1..].iter().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || *c == b'_') { return true; }
    }
    false
}

/// buscarEnClase con una clave de Lua (sin pasar por texto)
pub(crate) fn buscar_en_clase_v(t: &TablaRef, k: &Valor) -> Valor {
    let mut t = t.clone();
    for _ in 0..20 {
        let (v, b) = { let x = t.borrow(); (x.get(k), x.get_str("BaseClass")) };
        if !v.es_nil() { return v; }
        match b { Valor::Tabla(b) => t = b, _ => return Valor::Nil }
    }
    Valor::Nil
}

/// self.dt de una entidad (gmaDT)
pub(crate) fn dt_l(e: &Valor) -> TablaRef { ce(e, |x| x.dt_l.get_or_insert_with(Tabla::nueva_ref).clone()).unwrap_or_else(Tabla::nueva_ref) }

/// el nombre de tipo de GMod de un valor (Vector, Player, ConVar...) o None (gmaTipos)
pub(crate) fn tipo_nombre(v: &Valor) -> Option<String> {
    if let Some(t) = ent_tipo(v) { return Some(match t { TipoEnt::Jug => "Player", TipoEnt::Arma => "Weapon", TipoEnt::Npc => "NPC", _ => "Entity" }.into()); }
    if es_vec(v) { return Some("Vector".into()); }
    if es_ang(v) { return Some("Angle".into()); }
    let m = match v { Valor::Tabla(t) => t.borrow().meta(), Valor::Udata(u) => u.meta(), _ => None }?;
    if let Valor::Tabla(_) = v { return if matches!(m.borrow().get_str("MetaName"), Valor::Cad(c) if c.bytes() == b"Panel") { Some("Panel".into()) } else { None }; }
    let es = |x: &Option<TablaRef>| x.as_ref().map(|x| Rc::ptr_eq(x, &m)).unwrap_or(false);
    let n = g(|g| {
        if es(&g.mt.phy) { Some("PhysObj") } else if es(&g.mt.dmg) { Some("CTakeDamageInfo") } else if es(&g.mt.efecto) { Some("CEffectData") } else if es(&g.mt.cvar) { Some("ConVar") } else if es(&g.mt.mat) { Some("IMaterial") } else if es(&g.mt.snd) { Some("CSoundPatch") } else { None }
    });
    if let Some(n) = n { return Some(n.into()); }
    let mn = m.borrow().get_str("MetaName");
    match mn { Valor::Cad(c) => Some(c.texto().into_owned()), _ => None }
}

/// type() y TypeID() como en GMod
pub(crate) fn instalar_tipos(e: &mut Estado) {
    let gl = e.globales();
    let tipo0 = gl.borrow().get_str("type");
    {
        let tipo0 = tipo0.clone();
        def(&gl, "type", move |e, a, o| {
            let v = ar(a, 0);
            match tipo_nombre(&v) { Some(n) => o.push(Valor::from(n)), None => o.extend(e.llamar_aqui(&tipo0, &[v])?) }
            Ok(())
        });
    }
    def(&gl, "TypeID", move |e, a, o| {
        let v = ar(a, 0);
        let n = match tipo_nombre(&v) { Some(n) => n, None => { let r = e.llamar_aqui(&tipo0, &[v])?; js_str(&primero(&r)) } };
        let id = match n.as_str() {
            "nil" => 0, "boolean" => 1, "number" => 3, "string" => 4, "table" => 5, "function" => 6, "userdata" => 7, "thread" => 8, "Entity" | "Player" | "Weapon" | "NPC" | "Vehicle" | "NextBot" => 9,
            "Vector" => 10, "Angle" => 11, "PhysObj" => 12, "CTakeDamageInfo" => 15, "CEffectData" => 16, "IMaterial" => 21, "Panel" => 22, "ConVar" => 27, "VMatrix" => 29, "CSoundPatch" => 30, _ => 7,
        };
        o.push(Valor::Num(id as f64));
        Ok(())
    });
}

/// las bibliotecas del motor: una función que falta no rompe el addon (devuelve nada, o false si pregunta)
pub(crate) fn instalar_faltantes(e: &mut Estado) {
    let gl = e.globales();
    for n in ["util", "render", "surface", "cam", "game", "engine", "physenv", "sound", "ents", "player", "input", "gui", "system", "navmesh", "steamworks", "video", "mesh", "killicon", "resource", "file", "sql", "debugoverlay", "effects", "construct", "properties", "ai", "achievements", "frame_blend", "drive", "numpad", "presets", "cleanup", "undo", "spawnmenu", "search", "widgets", "matproxy", "motionsensor", "serverlist", "permissions", "chat", "notification", "language", "derma", "vgui"] {
        let v = gl.borrow().get_str(n);
        let t = match v { Valor::Nil => { let t = Tabla::nueva_ref(); gl.borrow_mut().set_str(n, Valor::Tabla(t.clone())); t } Valor::Tabla(t) => t, _ => continue };
        if t.borrow().meta().is_some() { continue; }
        let m = Tabla::nueva_ref();
        let nom = n.to_string();
        def(&m, "__index", move |_, a, o| {
            let Valor::Cad(k) = ar(a, 1) else { o.push(Valor::Nil); return Ok(()) };
            let b = k.bytes();
            if b.is_empty() || !b[0].is_ascii_uppercase() { o.push(Valor::Nil); return Ok(()); }
            g(|g| *g.faltan.entry(format!("{}.{}", nom, k.texto())).or_insert(0) += 1);
            let pregunta = ["Is", "Has", "Can", "Should"].iter().any(|p| b.starts_with(p.as_bytes()) && b.len() > p.len() && b[p.len()].is_ascii_uppercase());
            o.push(if pregunta { fnat(|_, _, o| { o.push(Valor::Bool(false)); Ok(()) }) } else { fnat(nada) });
            Ok(())
        });
        t.borrow_mut().set_meta(Some(m));
    }
}
