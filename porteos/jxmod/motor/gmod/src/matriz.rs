//! VMatrix (gmrApiMatriz de gmod_render.js): una matriz 4×4 por filas, en los ejes de Source. El SWEP Construction Kit —con
//! el que están hechas la mayoría de las armas «custom»— achica, estira y corre así cada pieza de sus armas
//! (EnableMatrix("RenderMultiply", m) con m:Scale(v.size)) y lee los huesos de la vista con GetBoneMatrix.

use crate::mates::*;
use crate::nucleo::*;
use jxlua::{Estado, Tabla, Udata, Valor};

type R = Result<(), jxlua::Error>;
/// una VMatrix (filas)
pub(crate) struct MatrizLua(pub [f64; 16]);
pub(crate) const ID: [f64; 16] = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];
pub(crate) fn nueva(m: [f64; 16]) -> Valor { let mt = g(|g| g.mt.matriz.clone()); Valor::Udata(Udata::nueva(MatrizLua(m), mt)) }
pub(crate) fn de(v: &Valor) -> Option<[f64; 16]> { match v { Valor::Udata(u) => u.con(|x: &MatrizLua| x.0), _ => None } }
fn poner(v: &Valor, m: [f64; 16]) { if let Valor::Udata(u) = v { u.con_mut(|x: &mut MatrizLua| x.0 = m); } }
pub(crate) fn mul(a: &[f64; 16], b: &[f64; 16]) -> [f64; 16] { let mut o = [0.0; 16]; for i in 0..4 { for j in 0..4 { let mut s = 0.0; for k in 0..4 { s += a[i * 4 + k] * b[k * 4 + j]; } o[i * 4 + j] = s; } } o }
/// gmrRot: el giro de unos ángulos (columnas: adelante, izquierda, arriba)
pub(crate) fn rot(a: [f64; 3]) -> [f64; 16] { let m = ang_mat(a); [m[0][0], m[1][0], m[2][0], 0.0, m[0][1], m[1][1], m[2][1], 0.0, m[0][2], m[1][2], m[2][2], 0.0, 0.0, 0.0, 0.0, 1.0] }
/// gmrInv: la inversa (Gauss con pivote); None si no tiene
pub(crate) fn inv(m: &[f64; 16]) -> Option<[f64; 16]> {
    let (mut a, mut iv) = (*m, ID);
    for c in 0..4 {
        let mut p = c; for r in c + 1..4 { if a[r * 4 + c].abs() > a[p * 4 + c].abs() { p = r; } }
        if a[p * 4 + c].abs() < 1e-12 { return None; }
        for k in 0..4 { a.swap(c * 4 + k, p * 4 + k); iv.swap(c * 4 + k, p * 4 + k); }
        let d = a[c * 4 + c]; for k in 0..4 { a[c * 4 + k] /= d; iv[c * 4 + k] /= d; }
        for r in 0..4 { if r != c { let f = a[r * 4 + c]; for k in 0..4 { a[r * 4 + k] -= f * a[c * 4 + k]; iv[r * 4 + k] -= f * iv[c * 4 + k]; } } }
    }
    Some(iv)
}
fn escala(m: &[f64; 16]) -> [f64; 3] { let l = |j: usize| { let x = (m[j] * m[j] + m[4 + j] * m[4 + j] + m[8 + j] * m[8 + j]).sqrt(); if x > 0.0 { x } else { 1.0 } }; [l(0), l(1), l(2)] }

pub(crate) fn instalar(e: &mut Estado) {
    let mt = Tabla::nueva_ref(); let ix = Tabla::nueva_ref();
    mt.borrow_mut().set_str("__index", Valor::Tabla(ix.clone())); mt.borrow_mut().set_str("MetaName", cad("VMatrix"));
    let m0 = |a: &[Valor]| de(&ar(a, 0)).unwrap_or(ID);
    let ok = |o: &mut Vec<Valor>, v: Valor| -> R { o.push(v); Ok(()) };
    def(&ix, "Identity", |_, a, _| { poner(&ar(a, 0), ID); Ok(()) });
    def(&ix, "IsIdentity", move |_, a, o| ok(o, Valor::Bool(m0(a) == ID)));
    def(&ix, "IsZero", move |_, a, o| ok(o, Valor::Bool(m0(a).iter().all(|x| *x == 0.0))));
    def(&ix, "Zero", |_, a, _| { poner(&ar(a, 0), [0.0; 16]); Ok(()) });
    def(&ix, "Translate", move |_, a, _| { if let Some(v) = vec_de(&ar(a, 1)) { poner(&ar(a, 0), mul(&m0(a), &[1.0, 0.0, 0.0, v[0], 0.0, 1.0, 0.0, v[1], 0.0, 0.0, 1.0, v[2], 0.0, 0.0, 0.0, 1.0])); } Ok(()) });
    def(&ix, "Rotate", move |_, a, _| { if let Some(an) = ang_de(&ar(a, 1)) { poner(&ar(a, 0), mul(&m0(a), &rot(an))); } Ok(()) });
    def(&ix, "Scale", move |_, a, _| { if let Some(v) = vec_de(&ar(a, 1)) { poner(&ar(a, 0), mul(&m0(a), &[v[0], 0.0, 0.0, 0.0, 0.0, v[1], 0.0, 0.0, 0.0, 0.0, v[2], 0.0, 0.0, 0.0, 0.0, 1.0])); } Ok(()) });
    def(&ix, "ScaleTranslation", move |_, a, _| { let k = num(&ar(a, 1), 1.0); let mut m = m0(a); m[3] *= k; m[7] *= k; m[11] *= k; poner(&ar(a, 0), m); Ok(()) });
    def(&ix, "SetTranslation", move |_, a, _| { if let Some(v) = vec_de(&ar(a, 1)) { let mut m = m0(a); m[3] = v[0]; m[7] = v[1]; m[11] = v[2]; poner(&ar(a, 0), m); } Ok(()) });
    def(&ix, "GetTranslation", move |_, a, o| { let m = m0(a); ok(o, nv(m[3], m[7], m[11])) });
    def(&ix, "SetAngles", move |_, a, _| { if let Some(an) = ang_de(&ar(a, 1)) { let (r, mut m) = (rot(an), m0(a)); let s = escala(&m); for i in 0..3 { for j in 0..3 { m[i * 4 + j] = r[i * 4 + j] * s[j]; } } poner(&ar(a, 0), m); } Ok(()) });
    def(&ix, "GetAngles", move |_, a, o| { let m = m0(a); let s = escala(&m); ok(o, naa(mat_ang([m[0] / s[0], m[4] / s[0], m[8] / s[0]], [m[1] / s[1], m[5] / s[1], m[9] / s[1]], [m[2] / s[2], m[6] / s[2], m[10] / s[2]]))) });
    def(&ix, "SetScale", move |_, a, _| { if let Some(v) = vec_de(&ar(a, 1)) { let mut m = m0(a); for j in 0..3 { let l = { let x = (m[j] * m[j] + m[4 + j] * m[4 + j] + m[8 + j] * m[8 + j]).sqrt(); if x > 0.0 { x } else { 1.0 } }; for i in 0..3 { m[i * 4 + j] *= v[j] / l; } } poner(&ar(a, 0), m); } Ok(()) });
    def(&ix, "GetScale", move |_, a, o| { let m = m0(a); let l = |j: usize| (m[j] * m[j] + m[4 + j] * m[4 + j] + m[8 + j] * m[8 + j]).sqrt(); ok(o, nv(l(0), l(1), l(2))) });
    def(&ix, "GetForward", move |_, a, o| { let m = m0(a); ok(o, nv(m[0], m[4], m[8])) });
    def(&ix, "GetRight", move |_, a, o| { let m = m0(a); ok(o, nv(-m[1], -m[5], -m[9])) });
    def(&ix, "GetUp", move |_, a, o| { let m = m0(a); ok(o, nv(m[2], m[6], m[10])) });
    def(&ix, "SetForward", move |_, a, _| { if let Some(v) = vec_de(&ar(a, 1)) { let mut m = m0(a); m[0] = v[0]; m[4] = v[1]; m[8] = v[2]; poner(&ar(a, 0), m); } Ok(()) });
    def(&ix, "SetRight", move |_, a, _| { if let Some(v) = vec_de(&ar(a, 1)) { let mut m = m0(a); m[1] = -v[0]; m[5] = -v[1]; m[9] = -v[2]; poner(&ar(a, 0), m); } Ok(()) });
    def(&ix, "SetUp", move |_, a, _| { if let Some(v) = vec_de(&ar(a, 1)) { let mut m = m0(a); m[2] = v[0]; m[6] = v[1]; m[10] = v[2]; poner(&ar(a, 0), m); } Ok(()) });
    def(&ix, "GetField", move |_, a, o| { let m = m0(a); let (r, c) = (num(&ar(a, 1), 1.0) as usize, num(&ar(a, 2), 1.0) as usize); ok(o, Valor::Num(m.get(((r.max(1) - 1) * 4 + c.max(1) - 1).min(15)).copied().unwrap_or(0.0))) });
    def(&ix, "SetField", move |_, a, _| { let mut m = m0(a); let (r, c) = (num(&ar(a, 1), 1.0) as usize, num(&ar(a, 2), 1.0) as usize); let k = ((r.max(1) - 1) * 4 + c.max(1) - 1).min(15); m[k] = num(&ar(a, 3), 0.0); poner(&ar(a, 0), m); Ok(()) });
    def(&ix, "ToTable", move |_, a, o| { let m = m0(a); ok(o, tab_de((0..4).map(|i| tab_de((0..4).map(|j| Valor::Num(m[i * 4 + j])).collect())).collect())) });
    def(&ix, "Set", |_, a, _| { if let Some(b) = de(&ar(a, 1)) { poner(&ar(a, 0), b); } Ok(()) });
    def(&ix, "SetUnpacked", |_, a, _| { let mut m = [0.0; 16]; for (i, x) in m.iter_mut().enumerate() { *x = num(&ar(a, 1 + i), 0.0); } poner(&ar(a, 0), m); Ok(()) });
    def(&ix, "Unpack", move |_, a, o| { for x in m0(a) { o.push(Valor::Num(x)); } Ok(()) });
    def(&ix, "Invert", move |_, a, o| { let r = inv(&m0(a)); if let Some(r) = r { poner(&ar(a, 0), r); } ok(o, Valor::Bool(r.is_some())) });
    def(&ix, "GetInverse", move |_, a, o| { if let Some(r) = inv(&m0(a)) { o.push(nueva(r)); } Ok(()) });
    def(&ix, "InvertTR", move |_, a, _| { if let Some(r) = inv(&m0(a)) { poner(&ar(a, 0), r); } Ok(()) });
    def(&ix, "GetInverseTR", move |_, a, o| { let m = m0(a); ok(o, nueva(inv(&m).unwrap_or(m))) });
    def(&ix, "GetTransposed", move |_, a, o| { let m = m0(a); let mut t = [0.0; 16]; for i in 0..4 { for j in 0..4 { t[i * 4 + j] = m[j * 4 + i]; } } ok(o, nueva(t)) });
    def(&mt, "__mul", |_, a, o| {
        let (x, y) = (ar(a, 0), ar(a, 1));
        if let (Some(p), Some(q)) = (de(&x), de(&y)) { o.push(nueva(mul(&p, &q))); return Ok(()); }
        if let (Some(m), Some(v)) = (de(&x), vec_de(&y)) { o.push(nv(m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + m[3], m[4] * v[0] + m[5] * v[1] + m[6] * v[2] + m[7], m[8] * v[0] + m[9] * v[1] + m[10] * v[2] + m[11])); return Ok(()); }
        o.push(x); Ok(())
    });
    def(&mt, "__add", |_, a, o| { let (p, q) = (de(&ar(a, 0)).unwrap_or(ID), de(&ar(a, 1)).unwrap_or([0.0; 16])); let mut r = p; for i in 0..16 { r[i] += q[i]; } o.push(nueva(r)); Ok(()) });
    def(&mt, "__sub", |_, a, o| { let (p, q) = (de(&ar(a, 0)).unwrap_or(ID), de(&ar(a, 1)).unwrap_or([0.0; 16])); let mut r = p; for i in 0..16 { r[i] -= q[i]; } o.push(nueva(r)); Ok(()) });
    def(&mt, "__eq", |_, a, o| { o.push(Valor::Bool(matches!((de(&ar(a, 0)), de(&ar(a, 1))), (Some(p), Some(q)) if p == q))); Ok(()) });
    def(&mt, "__tostring", |_, a, o| { let m = de(&ar(a, 0)).unwrap_or(ID); o.push(cad(&m.iter().map(|v| format!("{v:.4}")).collect::<Vec<_>>().join(" "))); Ok(()) });
    g(|g| g.mt.matriz = Some(mt));
    let gl = e.globales();
    def(&gl, "Matrix", |_, a, o| {
        let mut m = ID;
        if let Valor::Tabla(t) = ar(a, 0) { let t = t.borrow(); for i in 0..4 { let f = t.get(&Valor::Num((i + 1) as f64)); for j in 0..4 { m[i * 4 + j] = if let Valor::Tabla(fl) = &f { num(&fl.borrow().get(&Valor::Num((j + 1) as f64)), 0.0) } else { 0.0 }; } } }
        o.push(nueva(m)); Ok(())
    });
}
