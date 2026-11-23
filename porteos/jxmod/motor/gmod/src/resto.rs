//! Lo que queda de la API (gmaApiResto de la web): registrar clases (scripted_ents, weapons, effects, baseclass) con su
//! herencia, archivos (file), materiales, luces (ProjectedTexture, DynamicLight) y varias bibliotecas chicas.

use crate::anfitrion::InfoMaterial;
use crate::mates::*;
use crate::motor::*;
use crate::nucleo::*;
use crate::valores::colorf;
use jxlua::{Error, Estado, Tabla, TablaRef, Udata, Valor};
use std::rc::Rc;

type R = Result<(), Error>;
/// (un nil que devuelve una función de la web es «undefined»: no es ningún valor, como E0)
fn ok1(o: &mut Vec<Valor>, v: Valor) -> R { if !v.es_nil() { o.push(v); } Ok(()) }
fn b(o: &mut Vec<Valor>, x: bool) -> R { o.push(Valor::Bool(x)); Ok(()) }
fn n(o: &mut Vec<Valor>, x: f64) -> R { o.push(Valor::Num(x)); Ok(()) }
fn s(o: &mut Vec<Valor>, x: &str) -> R { o.push(cad(x)); Ok(()) }
fn tnueva() -> Valor { Valor::Tabla(Tabla::nueva_ref()) }

// ---------------- materiales ----------------
/// un IMaterial
pub(crate) struct Mat {
    pub n: String,
    pub err: bool,
}
/// gmaMaterial: el material de una ruta (uno por ruta)
pub(crate) fn material(p: &str) -> Valor {
    let k = p.to_lowercase().replace('\\', "/");
    if let Some(m) = g(|g| g.mats.get(&k).cloned()) { return m; }
    let mt = mt_mat();
    let ext = k.ends_with(".png") || k.ends_with(".jpg") || k.ends_with(".jpeg");
    let kb = { let x = k.strip_prefix("materials/").unwrap_or(&k); x.strip_suffix(".vmt").or_else(|| x.strip_suffix(".vtf")).unwrap_or(x).to_string() };
    let err = if ext { archivo(&format!("materials/{}", k)).is_none() && archivo(&k).is_none() } else { !(archivo(&format!("materials/{}.vmt", kb)).is_some() || existe(&format!("materials/{}.vtf", kb)) || k == "__color") };
    let m = Valor::Udata(Udata::nueva(Mat { n: p.to_string(), err }, Some(mt)));
    g(|g| g.mats.insert(k, m.clone()));
    m
}
/// el nombre de un material y lo que el juego sabe de él (para dibujarlo)
pub(crate) fn mat_info(v: &Valor) -> Option<(String, InfoMaterial)> {
    let nm = match v { Valor::Udata(u) => u.con(|m: &Mat| m.n.clone())?, _ => return None };
    let i = h(|h| h.material(&nm));
    Some((nm, i))
}
fn mt_mat() -> TablaRef {
    if let Some(m) = g(|g| g.mt.mat.clone()) { return m; }
    let m = Tabla::nueva_ref();
    let i = Tabla::nueva_ref();
    m.borrow_mut().set_str("__index", Valor::Tabla(i.clone()));
    let mm = |v: &Valor| match v { Valor::Udata(u) => u.con(|m: &Mat| (m.n.clone(), m.err)), _ => None };
    def(&i, "GetName", move |_, a, o| ok1(o, mm(&ar(a, 0)).map(|x| cad(&x.0)).unwrap_or(Valor::Nil)));
    def(&i, "IsError", move |_, a, o| b(o, mm(&ar(a, 0)).map(|x| x.1).unwrap_or(false)));
    for k in ["Width", "Height", "GetMappingWidth", "GetMappingHeight"] {
        let alto = k.contains("Height");
        def(&i, k, move |_, a, o| { let inf = mat_info(&ar(a, 0)).map(|x| x.1).unwrap_or_default(); let v = if alto { inf.alto } else { inf.ancho }; n(o, if inf.cargado && v != 0.0 { v } else { 32.0 }) });
    }
    def(&i, "GetTexture", |_, a, o| ok1(o, ar(a, 0)));
    def(&i, "GetString", |_, _, o| s(o, ""));
    for k in ["GetInt", "GetFloat"] { def(&i, k, |_, _, o| n(o, 0.0)); }
    def(&i, "GetVector", |_, _, o| ok1(o, nv(1.0, 1.0, 1.0)));
    def(&i, "GetShader", |_, _, o| s(o, "UnlitGeneric"));
    def(&i, "GetKeyValues", |_, _, o| ok1(o, tnueva()));
    def(&i, "GetColor", |_, _, o| ok1(o, colorf(255.0, 255.0, 255.0, 255.0)));
    for k in ["SetFloat", "SetInt", "SetString", "SetTexture", "SetVector", "SetMatrix", "SetUndefined", "Recompute", "Download"] { def(&i, k, nada); }
    g(|g| g.mt.mat = Some(m.clone()));
    m
}

// ---------------- luces ----------------
/// un ProjectedTexture
pub(crate) struct Pt {
    pub pos: [f64; 3],
    pub ang: [f64; 3],
    pub fov_h: f64,
    pub fov_v: f64,
    pub lejos: f64,
    pub cerca: f64,
    pub col: [f64; 3],
    pub brillo: f64,
    pub tex: String,
    pub cuadro: f64,
    pub vivo: bool,
    pub listo: bool,
    pub sombras: bool,
}
/// una luz de un addon para el juego
#[derive(Clone, Debug)]
pub struct Luz {
    pub pos: V3,
    pub radio: f64,
    pub color: [f64; 3],
    /// un cono: la dirección y el coseno del medio ángulo
    pub cono: Option<(V3, f64)>,
}
pub(crate) fn instalar_luces(_e: &mut Estado) {
    let m = Tabla::nueva_ref();
    let i = Tabla::nueva_ref();
    m.borrow_mut().set_str("__index", Valor::Tabla(i.clone()));
    m.borrow_mut().set_str("MetaName", cad("ProjectedTexture"));
    def(&m, "__tostring", |_, _, o| s(o, "ProjectedTexture"));
    fn pt<X>(v: &Valor, f: impl FnOnce(&mut Pt) -> X) -> Option<X> { match v { Valor::Udata(u) => u.con_mut(f), _ => None } }
    def(&i, "SetPos", |_, a, _| { if let Some(p) = vec_de(&ar(a, 1)) { pt(&ar(a, 0), |x| x.pos = p); } Ok(()) });
    def(&i, "GetPos", |_, a, o| ok1(o, pt(&ar(a, 0), |x| x.pos).map(nva).unwrap_or(Valor::Nil)));
    def(&i, "SetAngles", |_, a, _| { if let Some(p) = ang_de(&ar(a, 1)) { pt(&ar(a, 0), |x| x.ang = p); } Ok(()) });
    def(&i, "GetAngles", |_, a, o| ok1(o, pt(&ar(a, 0), |x| x.ang).map(naa).unwrap_or(Valor::Nil)));
    def(&i, "SetFOV", |_, a, _| { let f = num(&ar(a, 1), 90.0); pt(&ar(a, 0), |x| { x.fov_h = f; x.fov_v = f; }); Ok(()) });
    def(&i, "GetHorizontalFOV", |_, a, o| n(o, pt(&ar(a, 0), |x| x.fov_h).unwrap_or(90.0)));
    def(&i, "GetVerticalFOV", |_, a, o| n(o, pt(&ar(a, 0), |x| x.fov_v).unwrap_or(90.0)));
    def(&i, "SetHorizontalFOV", |_, a, _| { let f = num(&ar(a, 1), 90.0); pt(&ar(a, 0), |x| x.fov_h = f); Ok(()) });
    def(&i, "SetVerticalFOV", |_, a, _| { let f = num(&ar(a, 1), 90.0); pt(&ar(a, 0), |x| x.fov_v = f); Ok(()) });
    def(&i, "SetFarZ", |_, a, _| { let f = num(&ar(a, 1), 1000.0); pt(&ar(a, 0), |x| x.lejos = f); Ok(()) });
    def(&i, "GetFarZ", |_, a, o| n(o, pt(&ar(a, 0), |x| x.lejos).unwrap_or(1000.0)));
    def(&i, "SetNearZ", |_, a, _| { let f = num(&ar(a, 1), 4.0); pt(&ar(a, 0), |x| x.cerca = f); Ok(()) });
    def(&i, "GetNearZ", |_, a, o| n(o, pt(&ar(a, 0), |x| x.cerca).unwrap_or(4.0)));
    def(&i, "SetColor", |_, a, _| { if let Valor::Tabla(c) = ar(a, 1) { let v = [num(&tget(&c, "r"), 255.0), num(&tget(&c, "g"), 255.0), num(&tget(&c, "b"), 255.0)]; pt(&ar(a, 0), |x| x.col = v); } Ok(()) });
    def(&i, "GetColor", |_, a, o| { let c = pt(&ar(a, 0), |x| x.col).unwrap_or([255.0; 3]); ok1(o, colorf(c[0], c[1], c[2], 255.0)) });
    def(&i, "SetBrightness", |_, a, _| { let f = jmax(0.0, num(&ar(a, 1), 0.0)); pt(&ar(a, 0), |x| x.brillo = f); Ok(()) });
    def(&i, "GetBrightness", |_, a, o| n(o, pt(&ar(a, 0), |x| x.brillo).unwrap_or(0.0)));
    def(&i, "SetTexture", |_, a, _| { let v = ar(a, 1); let t2 = match &v { Valor::Cad(c) => Some(c.texto().into_owned()), Valor::Udata(u) => u.con(|m: &Mat| m.n.clone()), _ => None }; if let Some(t2) = t2 { pt(&ar(a, 0), |x| x.tex = t2); } Ok(()) });
    def(&i, "GetTexture", |_, a, o| { let t2 = pt(&ar(a, 0), |x| x.tex.clone()).unwrap_or_default(); ok1(o, material(&t2)) });
    def(&i, "SetTextureFrame", |_, a, _| { let f = num(&ar(a, 1), 0.0); pt(&ar(a, 0), |x| x.cuadro = f); Ok(()) });
    def(&i, "GetTextureFrame", |_, a, o| n(o, pt(&ar(a, 0), |x| x.cuadro).unwrap_or(0.0)));
    def(&i, "Update", |_, a, _| { pt(&ar(a, 0), |x| x.listo = true); Ok(()) });
    def(&i, "Remove", |_, a, _| { let x = ar(a, 0); pt(&x, |y| y.vivo = false); g(|g| g.pts.retain(|y| !mismo(y, &x))); Ok(()) });
    def(&i, "IsValid", |_, a, o| b(o, pt(&ar(a, 0), |x| x.vivo).unwrap_or(false)));
    def(&i, "SetEnableShadows", |_, a, _| { let v = t(&ar(a, 1)); pt(&ar(a, 0), |x| x.sombras = v); Ok(()) });
    def(&i, "GetEnableShadows", |_, a, o| b(o, pt(&ar(a, 0), |x| x.sombras).unwrap_or(false)));
    for k in ["SetShadowDepthBias", "SetShadowSlopeScaleDepthBias", "SetShadowFilter", "SetOrthographic", "SetLightWorld", "SetConstantAttenuation", "SetLinearAttenuation", "SetQuadraticAttenuation", "SetTargetEntity", "SetStencilBitMask"] { def(&i, k, nada); }
    for k in ["GetConstantAttenuation", "GetLinearAttenuation", "GetQuadraticAttenuation"] { def(&i, k, |_, _, o| n(o, 0.0)); }
    def(&i, "GetTargetEntity", |_, _, o| ok1(o, null()));
    def(&i, "GetOrthographic", |_, _, o| b(o, false));
    def(&i, "GetLightWorld", |_, _, o| b(o, true));
    g(|g| g.mt.pt = Some(m));
    let gl = _e.globales();
    def(&gl, "ProjectedTexture", |_, _, o| {
        let mt = g(|g| g.mt.pt.clone());
        let v = Valor::Udata(Udata::nueva(Pt { pos: [0.0; 3], ang: [0.0; 3], fov_h: 90.0, fov_v: 90.0, lejos: 1000.0, cerca: 4.0, col: [255.0; 3], brillo: 1.0, tex: "effects/flashlight001".into(), cuadro: 0.0, vivo: true, listo: false, sombras: false }, mt));
        g(|g| { if g.pts.len() >= 64 { let x = g.pts.remove(0); pt(&x, |y| y.vivo = false); } g.pts.push(v.clone()); });
        ok1(o, v)
    });
    def(&gl, "DynamicLight", |_, a, o| {
        let i = ar(a, 0);
        let k = if i.es_nil() { "0".to_string() } else { js_str(&i) };
        let tt = h(|h| h.tiempo());
        let t2 = g(|g| {
            let t2 = match g.dls.get(&k) { Some(t2) => t2.clone(), None => { let t2 = Tabla::nueva_ref(); g.dls.set(k.clone(), t2.clone()); if g.dls.len() > 64 { g.dls.v.remove(0); } t2 } };
            t2
        });
        g(|g| g.luz_pedida.insert(Rc::as_ptr(&t2) as usize, tt));
        ok1(o, Valor::Tabla(t2))
    });
}
/// las luces de los addons de este cuadro (gmaLuces): los conos (ProjectedTexture) y, si `comun`, las dinámicas
pub(crate) fn luces(comun: bool) -> Vec<Luz> {
    let mut out = Vec::new();
    const LUZ_GMOD: f64 = 6.8;
    if !comun {
        for x in g(|g| g.pts.clone()) {
            let Valor::Udata(u) = &x else { continue };
            let Some(l) = u.con(|t2: &Pt| {
                if !t2.vivo || !t2.listo || !(t2.brillo > 0.0) { return None; }
                let f = ang_mat(t2.ang)[0];
                let k = LUZ_GMOD * t2.brillo.min(8.0) / 255.0;
                let cono = ((t2.fov_h.max(t2.fov_v)).min(170.0) * RAD / 2.0).cos();
                Some((t2.pos, (t2.lejos * GS).min(60.0).max(2.0), [t2.col[0] * k, t2.col[1] * k, t2.col[2] * k], dg(f), cono))
            }).flatten() else { continue };
            out.push(Luz { pos: a_juego(l.0), radio: l.1, color: l.2, cono: Some((l.3, l.4)) });
        }
    } else {
        let ahora = h(|h| h.tiempo());
        for (k, t2) in g(|g| g.dls.v.clone()) {
            let fin = { let x = tget(&t2, "DieTime"); if x.es_nil() { tget(&t2, "dietime") } else { x } };
            let pedida = g(|g| g.luz_pedida.get(&(Rc::as_ptr(&t2) as usize)).copied()).unwrap_or(0.0);
            let muere = if let Valor::Num(f) = fin { f } else { pedida + 0.1 };
            if muere < ahora { g(|g| { g.dls.delete(&k); }); continue; }
            let p = { let x = tget(&t2, "pos"); if x.es_nil() { tget(&t2, "Pos") } else { x } };
            let Some(p) = vec_de(&p) else { continue };
            let gk = |a: &str, b2: &str, d: f64| { let x = tget(&t2, a); let x = if x.es_nil() { tget(&t2, b2) } else { x }; if x.es_nil() { d } else { mas(&x) } };
            let br = gk("brightness", "Brightness", 1.0);
            let tam = gk("Size", "size", 256.0);
            let kk = LUZ_GMOD * 0.6 * br.min(8.0).max(0.0) / 255.0;
            if !(kk > 0.0) { continue; }
            let c = [gk("r", "r", 255.0) * kk, gk("g", "g", 255.0) * kk, gk("b", "b", 255.0) * kk];
            let dir = { let x = tget(&t2, "dir"); if x.es_nil() { tget(&t2, "Dir") } else { x } };
            let ext = { let x = tget(&t2, "outerangle"); if x.es_nil() { tget(&t2, "OuterAngle") } else { x } };
            let cono = match (vec_de(&dir), ext) { (Some(d), Valor::Num(e)) => Some((dg(d), (e.min(170.0) * RAD / 2.0).cos())), _ => None };
            out.push(Luz { pos: a_juego(p), radio: (if tam == 0.0 || tam.is_nan() { 256.0 } else { tam } * GS).min(30.0).max(0.3), color: c, cono });
        }
    }
    out
}

// ---------------- clases (registrar y heredar) ----------------
fn es_ph(t: &TablaRef) -> bool { g(|g| g.ph_bases.iter().any(|x| Rc::ptr_eq(x, t))) }
fn es_herencia(m: &TablaRef) -> bool { g(|g| g.herencias.iter().any(|x| x.upgrade().map(|y| Rc::ptr_eq(&y, m)).unwrap_or(false))) }
/// gmaRegistrar: una clase de entidad o de arma (de las carpetas o de scripted_ents/weapons.Register)
pub(crate) fn registrar(e: &mut Estado, arma: bool, nombre: &str, tv: &Valor) {
    let Valor::Tabla(t) = tv else { return };
    if nombre.is_empty() { return; }
    let ph = g(|g| g.bases.get(&nombre.to_string()).cloned());
    if let Some(ph) = &ph { if !Rc::ptr_eq(ph, t) { for (k, v) in t.borrow().pares() { if ph.borrow().get(&k).es_nil() { let _ = ph.borrow_mut().set(k, v); } } } }
    let lado = g(|g| g.ctx);
    let addon = g(|g| g.addon_actual.as_ref().map(|a| a.borrow().id.clone()));
    g(|g| {
        let m = if arma { &mut g.armas } else { &mut g.clases };
        if !m.has(nombre) { m.set(nombre, ClaseReg { s: None, c: None, addon }); }
    });
    t.borrow_mut().set_str("ClassName", cad(nombre));
    t.borrow_mut().set_str("ThisClass", cad(nombre));
    g(|g| { let m = if arma { &mut g.armas } else { &mut g.clases }; let c = m.get_mut(nombre).unwrap(); if lado == Lado::C { c.c = Some(t.clone()); } else { c.s = Some(t.clone()); } });
    enlazar_base(e, t, arma);
    let hijas: Vec<TablaRef> = g(|g| { let m = if arma { &g.armas } else { &g.clases }; m.values().filter_map(|x| if lado == Lado::C { x.c.clone() } else { x.s.clone() }).collect() });
    for hj in hijas {
        if Rc::ptr_eq(&hj, t) { continue; }
        if !matches!(tget(&hj, "Base"), Valor::Cad(c) if c.bytes() == nombre.as_bytes()) { continue; }
        let bc = tget(&hj, "BaseClass");
        let es_la_ph = match (&bc, &ph) { (Valor::Tabla(x), Some(p)) => Rc::ptr_eq(x, p), _ => false };
        if !matches!(bc, Valor::Tabla(_)) || (ph.as_ref().map(es_ph).unwrap_or(false) && es_la_ph) {
            if es_la_ph { hj.borrow_mut().set_str("BaseClass", Valor::Nil); }
            enlazar_base(e, &hj, arma);
        }
    }
    if let Some(ph) = ph { if es_ph(&ph) && !Rc::ptr_eq(&ph, t) { let m = Tabla::nueva_ref(); m.borrow_mut().set_str("__index", Valor::Tabla(t.clone())); ph.borrow_mut().set_meta(Some(m)); } }
}
/// gmaEnlazarBase: BaseClass, la metatabla que busca en la base y las subtablas heredadas (SWEP.Primary...)
pub(crate) fn enlazar_base(e: &mut Estado, t: &TablaRef, arma: bool) {
    let bv = tget(t, "Base");
    let bn = if js_t(&bv) { Some(js_str(&bv)) } else { Some(if arma { "weapon_base" } else { "base_anim" }.to_string()) };
    let en_cadena = |a: &TablaRef, z: &TablaRef| { let mut a = Some(a.clone()); for _ in 0..40 { let Some(x) = a else { return false }; if Rc::ptr_eq(&x, z) { return true; } a = match tget(&x, "BaseClass") { Valor::Tabla(y) => Some(y), _ => None }; } false };
    if let Some(bn) = bn {
        let cn = tget(t, "ClassName");
        let mismo_nombre = matches!(&cn, Valor::Cad(c) if c.bytes() == bn.as_bytes());
        if !mismo_nombre {
            let lado = g(|g| g.ctx);
            let bt = clase_tabla(&bn, lado).or_else(|| g(|g| g.bases.get(&bn).cloned()));
            if let Some(bt) = bt { if !Rc::ptr_eq(&bt, t) && !en_cadena(&bt, t) { t.borrow_mut().set_str("BaseClass", Valor::Tabla(bt)); } }
        }
    }
    if t.borrow().meta().is_none() {
        let m = Tabla::nueva_ref();
        def(&m, "__index", |e, a, o| {
            let x = ar(a, 0);
            let k = ar(a, 1);
            if matches!(&k, Valor::Cad(c) if c.bytes() == b"BaseClass") || g(|g| g.prof_base) > 40 { return ok1(o, Valor::Nil); }
            let Valor::Tabla(xt) = &x else { return ok1(o, Valor::Nil) };
            let bc = tget(xt, "BaseClass");
            let Valor::Tabla(bct) = &bc else { return ok1(o, Valor::Nil) };
            if Rc::ptr_eq(bct, xt) { return ok1(o, Valor::Nil); }
            g(|g| g.prof_base += 1);
            let r = e.indexar(&bc, &k);
            g(|g| g.prof_base -= 1);
            ok1(o, r?)
        });
        t.borrow_mut().set_meta(Some(m));
    }
    let Valor::Tabla(bc) = tget(t, "BaseClass") else { return };
    let llega = |a: &TablaRef, z: &TablaRef| { let mut a = Some(a.clone()); for _ in 0..40 { let Some(x) = a else { return false }; if Rc::ptr_eq(&x, z) { return true; } a = x.borrow().meta().and_then(|m| match m.borrow().get_str("__index") { Valor::Tabla(i) => Some(i), _ => None }); } false };
    let claves: Vec<Valor> = t.borrow().pares().into_iter().map(|x| x.0).collect();
    for k in claves {
        let Valor::Cad(kc) = &k else { continue };
        if kc.bytes() == b"BaseClass" { continue; }
        let sub = t.borrow().get(&k);
        let sb = e.indexar(&Valor::Tabla(bc.clone()), &k).unwrap_or(Valor::Nil);
        if let (Valor::Tabla(sub), Valor::Tabla(sb)) = (&sub, &sb) {
            if Rc::ptr_eq(sub, sb) { continue; }
            if sub.borrow().meta().is_none() && !llega(sb, sub) {
                let m = Tabla::nueva_ref();
                m.borrow_mut().set_str("__index", Valor::Tabla(sb.clone()));
                g(|g| g.herencias.push(Rc::downgrade(&m)));
                sub.borrow_mut().set_meta(Some(m));
            }
            let ok = match sub.borrow().meta() { Some(m) => es_herencia(&m), None => true };
            if ok { heredar_sub(sub, sb, 0); }
        }
    }
}
fn heredar_sub(sub: &TablaRef, sb: &TablaRef, prof: u32) {
    if prof > 6 { return; }
    let mut x = Some(sb.clone());
    let mut nn = 0;
    while let Some(xt) = x.clone() {
        if Rc::ptr_eq(&xt, sub) || nn >= 12 { break; }
        nn += 1;
        for (k, vb) in xt.borrow().pares() {
            if matches!(&k, Valor::Cad(c) if c.bytes() == b"BaseClass") { continue; }
            let v = sub.borrow().get(&k);
            if v.es_nil() { let _ = sub.borrow_mut().set(k, vb); }
            else if let (Valor::Tabla(vt), Valor::Tabla(vbt)) = (&v, &vb) {
                let ok = match vt.borrow().meta() { Some(m) => es_herencia(&m), None => true };
                if !Rc::ptr_eq(vt, vbt) && prof < 4 && ok { heredar_sub(vt, vbt, prof + 1); }
            }
        }
        let m = xt.borrow().meta();
        let i = m.filter(es_herencia).and_then(|m| match m.borrow().get_str("__index") { Valor::Tabla(i) => Some(i), _ => None });
        let bc = match tget(&xt, "BaseClass") { Valor::Tabla(b) => Some(b), _ => None };
        x = i.or(bc);
    }
    if tget(sub, "BaseClass").es_nil() { sub.borrow_mut().set_str("BaseClass", Valor::Tabla(sb.clone())); }
}

// ---------------- File ----------------
pub(crate) struct Archivo {
    pub s: Vec<u8>,
    pub p: usize,
    pub w: bool,
    pub cerrado: bool,
    pub k: String,
}
fn mt_arch() -> TablaRef {
    if let Some(m) = g(|g| g.mt.arch.clone()) { return m; }
    let m = Tabla::nueva_ref();
    m.borrow_mut().set_str("__index", Valor::Tabla(m.clone()));
    m.borrow_mut().set_str("MetaName", cad("File"));
    fn fa<X>(v: &Valor, f: impl FnOnce(&mut Archivo) -> X) -> Option<X> { match v { Valor::Udata(u) => u.con_mut(f), _ => None } }
    fn guardar(f: &Archivo) { if f.w { let s = String::from_utf8_lossy(&f.s).into_owned(); h(|h| h.poner_dato(&f.k, Some(&s))); } }
    fn lee(f: &mut Archivo, n: usize) -> Vec<u8> { let fin = (f.p + n).min(f.s.len()); let v = f.s[f.p.min(fin)..fin].to_vec(); f.p += v.len(); v }
    fn pon(f: &mut Archivo, s: &[u8]) { if !f.w || f.cerrado { return; } let fin = (f.p + s.len()).min(f.s.len()); f.s.splice(f.p..fin, s.iter().copied()); f.p += s.len(); guardar(f); }
    def(&m, "Read", |_, a, o| {
        let nn = ar(a, 1);
        ok1(o, fa(&ar(a, 0), |f| { let k = if nn.es_nil() { f.s.len().saturating_sub(f.p) } else { i32_de(mas(&nn)).max(0) as usize }; let v = lee(f, k); if !v.is_empty() || k == 0 { Valor::from(v) } else { Valor::Nil } }).unwrap_or(Valor::Nil))
    });
    def(&m, "ReadLine", |_, a, o| ok1(o, fa(&ar(a, 0), |f| { if f.p >= f.s.len() { return Valor::Nil; } let i = f.s[f.p..].iter().position(|c| *c == b'\n').map(|i| i + f.p).unwrap_or(f.s.len() - 1); let v = f.s[f.p..=i].to_vec(); f.p = i + 1; Valor::from(v) }).unwrap_or(Valor::Nil)));
    for (k, nb) in [("ReadByte", 1usize), ("ReadBool", 1), ("ReadShort", 2), ("ReadUShort", 2), ("ReadLong", 4), ("ReadULong", 4), ("ReadFloat", 4), ("ReadDouble", 8), ("ReadUInt64", 8), ("ReadInt64", 8)] {
        def(&m, k, move |_, a, o| {
            let v = fa(&ar(a, 0), |f| lee(f, nb)).unwrap_or_default();
            if v.len() < nb { return ok1(o, Valor::Nil); }
            ok1(o, match k {
                "ReadByte" => Valor::Num(v[0] as f64), "ReadBool" => Valor::Bool(v[0] != 0),
                "ReadShort" => Valor::Num(i16::from_le_bytes([v[0], v[1]]) as f64), "ReadUShort" => Valor::Num(u16::from_le_bytes([v[0], v[1]]) as f64),
                "ReadLong" => Valor::Num(i32::from_le_bytes([v[0], v[1], v[2], v[3]]) as f64), "ReadULong" => Valor::Num(u32::from_le_bytes([v[0], v[1], v[2], v[3]]) as f64),
                "ReadFloat" => Valor::Num(f32::from_le_bytes([v[0], v[1], v[2], v[3]]) as f64), "ReadDouble" => Valor::Num(f64::from_le_bytes(v[..8].try_into().unwrap())),
                "ReadUInt64" => cad(&u64::from_le_bytes(v[..8].try_into().unwrap()).to_string()), _ => cad(&i64::from_le_bytes(v[..8].try_into().unwrap()).to_string()),
            })
        });
    }
    def(&m, "Write", |_, a, _| { let v = ar(a, 1); let bs = if v.es_nil() { Vec::new() } else { jxlua::bib::js_texto(&v) }; fa(&ar(a, 0), |f| pon(f, &bs)); Ok(()) });
    for (k, nb) in [("WriteByte", 1usize), ("WriteBool", 1), ("WriteShort", 2), ("WriteUShort", 2), ("WriteLong", 4), ("WriteULong", 4), ("WriteFloat", 4), ("WriteDouble", 8)] {
        def(&m, k, move |_, a, _| {
            let x = { let v = mas(&ar(a, 1)); if v.is_nan() { 0.0 } else { v } };
            let bs: Vec<u8> = match k {
                "WriteByte" => vec![(i32_de(x) & 255) as u8], "WriteBool" => vec![if t(&ar(a, 1)) && x != 0.0 { 1 } else { 0 }],
                "WriteShort" | "WriteUShort" => (i32_de(x) as u16).to_le_bytes().to_vec(), "WriteLong" | "WriteULong" => (i32_de(x) as u32).to_le_bytes().to_vec(),
                "WriteFloat" => (x as f32).to_le_bytes().to_vec(), _ => x.to_le_bytes().to_vec(),
            };
            let _ = nb;
            fa(&ar(a, 0), |f| pon(f, &bs));
            Ok(())
        });
    }
    for k in ["WriteUInt64", "WriteInt64"] { def(&m, k, |_, a, _| { let v: u64 = js_str(&ar(a, 1)).split('.').next().unwrap_or("0").parse().unwrap_or(0); fa(&ar(a, 0), |f| pon(f, &v.to_le_bytes())); Ok(()) }); }
    def(&m, "Seek", |_, a, _| { let p = i32_de(mas(&ar(a, 1))).max(0) as usize; fa(&ar(a, 0), |f| f.p = p.min(f.s.len())); Ok(()) });
    def(&m, "Tell", |_, a, o| n(o, fa(&ar(a, 0), |f| f.p).unwrap_or(0) as f64));
    def(&m, "Size", |_, a, o| n(o, fa(&ar(a, 0), |f| f.s.len()).unwrap_or(0) as f64));
    def(&m, "EndOfFile", |_, a, o| b(o, fa(&ar(a, 0), |f| f.p >= f.s.len()).unwrap_or(true)));
    def(&m, "Skip", |_, a, o| { let d = i32_de(mas(&ar(a, 1))) as i64; n(o, fa(&ar(a, 0), |f| { f.p = (f.p as i64 + d).max(0).min(f.s.len() as i64) as usize; f.p }).unwrap_or(0) as f64) });
    def(&m, "Flush", |_, a, _| { fa(&ar(a, 0), |f| guardar(f)); Ok(()) });
    def(&m, "Close", |_, a, _| { fa(&ar(a, 0), |f| if !f.cerrado { guardar(f); f.cerrado = true; }); Ok(()) });
    def(&m, "__tostring", |_, _, o| s(o, "File"));
    g(|g| g.mt.arch = Some(m.clone()));
    m
}

fn ruta(p: &str, w: &str) -> String {
    let p = p.to_lowercase().replace('\\', "/");
    match w { "LUA" | "lsv" | "LCL" => format!("lua/{}", p), "DATA" => format!("data/{}", p), _ => p }
}
fn rutas(p: &str, w: &str) -> Vec<String> { let a = ruta(p, w); match a.strip_prefix("lua/") { Some(r) => vec![a.clone(), format!("gamemodes/{}", r)], None => vec![a] } }
fn hay_dir(d: &str) -> bool { let p = format!("{}/", d); g(|g| g.arch.keys().any(|k| k.starts_with(&p))) }
fn arch1(p: &str, w: &str) -> Option<Rc<[u8]>> { rutas(p, w).iter().find_map(|r| archivo(r)) }
fn data_k(p: &str) -> String { format!("gmdata:{}", p.to_lowercase()) }
fn latin1(b: &[u8]) -> Valor { Valor::from(b.to_vec()) }

/// el nombre del arma de un addon, como lo ve el menú (PrintName del lado del cliente)
pub(crate) fn nombre_clase(e: &mut Estado, arma: bool, n: &str) -> String {
    let t = g(|g| { let m = if arma { &g.armas } else { &g.clases }; m.get(n).and_then(|c| c.c.clone().or_else(|| c.s.clone())) });
    let Some(t) = t else { return n.to_string() };
    let v = tget(&t, "PrintName");
    let Valor::Cad(c) = &v else { return n.to_string() };
    let s0 = c.texto().into_owned();
    if s0.trim().is_empty() { return n.to_string(); }
    if s0.starts_with('#') {
        if let Valor::Tabla(l) = e.globales().borrow().get_str("language") { let f = tget(&l, "GetPhrase"); if let Valor::Func(_) = f { if let Ok(r) = e.llamar_aqui(&f, &[v.clone()]) { return js_str(&primero(&r)); } } }
    }
    s0
}

pub(crate) fn instalar(e: &mut Estado) {
    let gl = e.globales();
    let l = |n: &str| match gl.borrow().get_str(n) { Valor::Tabla(t) => t, _ => Tabla::nueva_ref() };
    let se = l("scripted_ents");
    def(&se, "Register", |e, a, _| { registrar(e, false, &js_str(&ar(a, 1)), &ar(a, 0)); Ok(()) });
    def(&se, "Get", |_, a, o| ok1(o, clase_tabla(&js_str(&ar(a, 0)), g(|g| g.ctx)).map(Valor::Tabla).unwrap_or(Valor::Nil)));
    def(&se, "GetStored", |_, a, o| { let nm = js_str(&ar(a, 0)); let c = g(|g| g.clases.get(&nm).map(|c| c.s.clone().or_else(|| c.c.clone()))); ok1(o, match c { Some(c) => tabla_kv(vec![("t", c.map(Valor::Tabla).unwrap_or(Valor::Nil))]), None => Valor::Nil }) });
    def(&se, "GetList", |_, _, o| { let t2 = Tabla::nueva_ref(); for (k, v) in g(|g| g.clases.v.iter().map(|(k, c)| (k.clone(), c.s.clone().or_else(|| c.c.clone()))).collect::<Vec<_>>()) { t2.borrow_mut().set_str(&k, tabla_kv(vec![("t", v.map(Valor::Tabla).unwrap_or(Valor::Nil))])); } ok1(o, Valor::Tabla(t2)) });
    def(&se, "GetType", |_, a, o| ok1(o, clase_tabla(&js_str(&ar(a, 0)), Lado::S).map(|c| tget(&c, "Type")).unwrap_or(Valor::Nil)));
    def(&se, "Alias", nada);
    def(&se, "GetSpawnable", |_, _, o| ok1(o, tnueva()));
    for t2 in [&se, &l("weapons")] { def(t2, "IsBasedOn", |_, a, o| b(o, ar(a, 0).crudo_igual(&ar(a, 1)))); }
    let we = l("weapons");
    def(&we, "Register", |e, a, _| { registrar(e, true, &js_str(&ar(a, 1)), &ar(a, 0)); Ok(()) });
    for k in ["Get", "GetStored"] { def(&we, k, |_, a, o| ok1(o, clase_tabla(&js_str(&ar(a, 0)), g(|g| g.ctx)).map(Valor::Tabla).unwrap_or(Valor::Nil))); }
    def(&we, "GetList", |_, _, o| ok1(o, tab_de(g(|g| g.armas.values().map(|c| c.s.clone().or_else(|| c.c.clone()).map(Valor::Tabla).unwrap_or(Valor::Nil)).collect()))));
    let ef = l("effects");
    def(&ef, "Register", |_, a, _| { if let Valor::Tabla(t2) = ar(a, 0) { let nm = js_str(&ar(a, 1)).to_lowercase(); g(|g| g.efectos.set(&nm, t2)); } Ok(()) });
    for k in ["Create", "BeamRingPoint", "Bubbles", "BubbleTrail"] { def(&ef, k, nada); }
    let bcl = l("baseclass");
    {
        let gl2 = gl.clone();
        def(&bcl, "Get", move |_, a, o| {
            let nm = js_str(&ar(a, 0));
            let cc = g(|g| g.cargando_clase);
            for v in ["ENT", "SWEP"] { if let Valor::Tabla(t2) = gl2.borrow().get_str(v) { if cc == Some(v) { t2.borrow_mut().set_str("Base", cad(&nm)); } } }
            if let Some(c) = clase_tabla(&nm, g(|g| g.ctx)) { return ok1(o, Valor::Tabla(c)); }
            let x = g(|g| match g.bases.get(&nm) { Some(x) => x.clone(), None => { let x = Tabla::nueva_ref(); g.bases.set(nm.clone(), x.clone()); g.ph_bases.push(x.clone()); x } });
            ok1(o, Valor::Tabla(x))
        });
    }
    def(&bcl, "Set", |_, a, _| { if let Valor::Tabla(t2) = ar(a, 1) { let nm = js_str(&ar(a, 0)); g(|g| g.bases.set(nm, t2)); } Ok(()) });
    // ---- file ----
    let file = l("file");
    let ws = |v: &Valor| if v.es_nil() { "GAME".to_string() } else { js_str(v) };
    def(&file, "Exists", move |_, a, o| { let (p, w) = (js_str(&ar(a, 0)), ws(&ar(a, 1))); if w == "DATA" { return b(o, h(|h| h.dato(&data_k(&p))).is_some()); } b(o, rutas(&p, &w).iter().any(|r| existe(r) || hay_dir(r))) });
    def(&file, "Read", move |_, a, o| { let (p, w) = (js_str(&ar(a, 0)), ws(&ar(a, 1))); if w == "DATA" { return ok1(o, h(|h| h.dato(&data_k(&p))).map(Valor::from).unwrap_or(Valor::Nil)); } ok1(o, arch1(&p, &w).map(|bb| latin1(&bb)).unwrap_or(Valor::Nil)) });
    def(&file, "Write", |_, a, _| { let p = js_str(&ar(a, 0)); let sv = js_str(&ar(a, 1)); h(|h| h.poner_dato(&data_k(&p), Some(&sv))); Ok(()) });
    def(&file, "Append", |_, a, _| { let p = js_str(&ar(a, 0)); let sv = js_str(&ar(a, 1)); let k = data_k(&p); let v = h(|h| h.dato(&k)).unwrap_or_default() + &sv; h(|h| h.poner_dato(&k, Some(&v))); Ok(()) });
    def(&file, "Delete", |_, a, _| { let p = js_str(&ar(a, 0)); h(|h| h.poner_dato(&data_k(&p), None)); Ok(()) });
    def(&file, "CreateDir", nada);
    def(&file, "IsDir", move |_, a, o| { let (p, w) = (js_str(&ar(a, 0)), ws(&ar(a, 1))); b(o, rutas(&p, &w).iter().any(|r| hay_dir(r))) });
    def(&file, "Size", move |_, a, o| { let (p, w) = (js_str(&ar(a, 0)), ws(&ar(a, 1))); n(o, arch1(&p, &w).map(|bb| bb.len() as f64).unwrap_or(-1.0)) });
    def(&file, "Time", |_, _, o| n(o, 0.0));
    def(&file, "Open", move |_, a, o| {
        let p = js_str(&ar(a, 0));
        let modo = { let v = ar(a, 1); if js_t(&v) { js_str(&v) } else { "r".into() } };
        let w = ws(&ar(a, 2));
        let esc = modo.contains('w') || modo.contains('a');
        let txt: Option<Vec<u8>> = if w == "DATA" || esc { if esc && w != "DATA" { return ok1(o, Valor::Nil); } h(|h| h.dato(&data_k(&p))).map(|x| x.into_bytes()) } else { arch1(&p, &w).map(|bb| bb.to_vec()) };
        if txt.is_none() && !esc { return ok1(o, Valor::Nil); }
        let k = data_k(&p);
        let sv = if modo.contains('w') { Vec::new() } else { txt.unwrap_or_default() };
        let pos = if modo.contains('a') { sv.len() } else { 0 };
        if modo.contains('w') { h(|h| h.poner_dato(&k, Some(""))); }
        ok1(o, Valor::Udata(Udata::nueva(Archivo { s: sv, p: pos, w: esc, cerrado: false, k }, Some(mt_arch()))))
    });
    def(&file, "Rename", |_, _, o| b(o, false));
    def(&file, "Find", move |_, a, o| {
        let (p, w) = (js_str(&ar(a, 0)), ws(&ar(a, 1)));
        let mut fs: Vec<String> = Vec::new();
        let mut ds: Vec<String> = Vec::new();
        let ks: Vec<String> = g(|g| g.arch.keys().cloned().collect());
        for pat in rutas(&p, &w) {
            let dir = match pat.rfind('/') { Some(i) => pat[..=i].to_string(), None => String::new() };
            let pp = pat[dir.len()..].to_string();
            for k in &ks {
                let Some(resto) = k.strip_prefix(&dir) else { continue };
                match resto.find('/') {
                    None => if glob_seg(&pp, resto) && !fs.contains(&resto.to_string()) { fs.push(resto.to_string()); },
                    Some(i) => { let d = &resto[..i]; if glob_seg(&pp, d) && !ds.contains(&d.to_string()) { ds.push(d.to_string()); } }
                }
            }
        }
        fs.sort();
        ds.sort();
        o.push(tab_de(fs.iter().map(|x| cad(x)).collect()));
        o.push(tab_de(ds.iter().map(|x| cad(x)).collect()));
        Ok(())
    });
    let sql = l("sql");
    def(&sql, "Query", |_, _, o| b(o, false));
    for k in ["QueryValue", "QueryRow"] { def(&sql, k, |_, _, o| ok1(o, Valor::Nil)); }
    def(&sql, "TableExists", |_, _, o| b(o, false));
    def(&sql, "SQLStr", |_, a, o| s(o, &format!("'{}'", js_str(&ar(a, 0)).replace('\'', "''"))));
    def(&sql, "LastError", |_, _, o| s(o, ""));
    for k in ["Begin", "Commit"] { def(&sql, k, nada); }
    let ck = l("cookie");
    def(&ck, "GetString", |_, a, o| { let k = format!("gmcookie:{}", js_str(&ar(a, 0))); ok1(o, h(|h| h.dato(&k)).map(Valor::from).unwrap_or_else(|| ar(a, 1))) });
    def(&ck, "GetNumber", |_, a, o| { let k = format!("gmcookie:{}", js_str(&ar(a, 0))); let v = h(|h| h.dato(&k)).map(Valor::from).unwrap_or(Valor::Nil); ok1(o, Estado::a_numero(&v).map(Valor::Num).unwrap_or_else(|| ar(a, 1))) });
    def(&ck, "Set", |_, a, _| { let k = format!("gmcookie:{}", js_str(&ar(a, 0))); let v = js_str(&ar(a, 1)); h(|h| h.poner_dato(&k, Some(&v))); Ok(()) });
    def(&ck, "Delete", |_, a, _| { let k = format!("gmcookie:{}", js_str(&ar(a, 0))); h(|h| h.poner_dato(&k, None)); Ok(()) });
    let http = l("http");
    def(&http, "Fetch", |_, a, _| { let f = ar(a, 2); if let Valor::Func(_) = f { let c = g(|g| g.ctx); g(|g| g.t_simples.push(TSimple { t: 0.0, f: Accion::Lua(f, vec![cad("sin http")]), ctx: c })); } Ok(()) });
    def(&http, "Post", |_, a, _| { let f = ar(a, 3); if let Valor::Func(_) = f { let c = g(|g| g.ctx); g(|g| g.t_simples.push(TSimple { t: 0.0, f: Accion::Lua(f, vec![cad("sin http")]), ctx: c })); } Ok(()) });
    let sys = l("system");
    def(&sys, "IsWindows", |_, _, o| b(o, true));
    for k in ["IsLinux", "IsOSX"] { def(&sys, k, |_, _, o| b(o, false)); }
    def(&sys, "HasFocus", |_, _, o| b(o, true));
    for k in ["AppTime", "UpTime"] { def(&sys, k, |_, _, o| n(o, h(|h| h.reloj().1))); }
    def(&sys, "GetCountry", |_, _, o| s(o, "AR"));
    def(&sys, "SteamTime", |_, _, o| n(o, (h(|h| h.reloj().0) / 1000.0).floor()));
    def(&sys, "IsWindowed", |_, _, o| b(o, true));
    let chat = l("chat");
    def(&chat, "AddText", |e, a, _| {
        if g(|g| g.ctx) != Lado::C { return Ok(()); }
        let mut sv = String::new();
        for x in a {
            match x {
                Valor::Cad(_) | Valor::Num(_) => sv.push_str(&e.tostring(x)?.texto()),
                _ if es_ent(x) => { if ent_tipo(x) == Some(TipoEnt::Jug) { sv.push_str(&h(|h| h.nombre_jugador())); } else { sv.push_str(&ce(x, |y| y.clase.clone()).unwrap_or_default()); } }
                _ => {}
            }
        }
        h(|h| h.chat(&sv));
        Ok(())
    });
    for k in ["PlaySound", "Open", "Close"] { def(&chat, k, nada); }
    def(&chat, "GetChatBoxPos", |_, _, o| { o.push(Valor::Num(20.0)); o.push(Valor::Num(h(|h| h.pantalla().1) - 300.0)); Ok(()) });
    def(&chat, "GetChatBoxSize", |_, _, o| { o.push(Valor::Num(500.0)); o.push(Valor::Num(250.0)); Ok(()) });
    let nt = l("notification");
    def(&nt, "AddLegacy", |_, a, _| { let sv = js_str(&ar(a, 0)); let d = num(&ar(a, 2), 3.0); h(|h| h.aviso(&sv, d)); Ok(()) });
    def(&nt, "AddProgress", |_, a, _| { let sv = js_str(&ar(a, 1)); h(|h| h.aviso(&sv, 2.0)); Ok(()) });
    def(&nt, "Kill", nada);
    let inp = l("input");
    def(&inp, "LookupBinding", |_, a, o| {
        let bb = { let v = ar(a, 0); if js_t(&v) { js_str(&v) } else { String::new() } };
        let r = match bb.to_lowercase().as_str() { "impulse 100" => "F", "+reload" => "R", "+use" => "E", "+jump" => "SPACE", "+menu" => "Q", "+menu_context" => "C", "+showscores" => "TAB", "messagemode" => "T", "gmod_undo" => "Z", "noclip" => "N", "gm_showhelp" => "F1", "gm_showteam" => "F2", "gm_showspare1" => "F3", "gm_showspare2" => "F4", "+attack" => "MOUSE1", "+attack2" => "MOUSE2", "+duck" => "CTRL", "+speed" => "SHIFT", "+walk" => "ALT", "+forward" => "W", "+back" => "S", "+moveleft" => "A", "+moveright" => "D", "invnext" => "MWHEELDOWN", "invprev" => "MWHEELUP", "+zoom" => "B", _ => "" };
        if !r.is_empty() { return s(o, r); }
        match bb.strip_prefix("slot") { Some(d) if d.len() == 1 && d.as_bytes()[0] >= b'1' && d.as_bytes()[0] <= b'9' => s(o, d), _ => ok1(o, Valor::Nil) }
    });
    def(&inp, "LookupKeyBinding", |_, _, o| s(o, ""));
    let abajo = |e: &mut Estado, k: f64| { if (107.0..=113.0).contains(&k) && fantasma(e).is_some() { return false; } let bs = g(|g| g.bot_ant.clone()).unwrap_or_else(botones); bs.iter().any(|x| *x as f64 == k) };
    for k in ["IsKeyDown", "IsButtonDown"] { def(&inp, k, move |e, a, o| b(o, abajo(e, mas(&ar(a, 0))))); }
    def(&inp, "WasKeyPressed", |e, a, o| { let k = mas(&ar(a, 0)); if (107.0..=113.0).contains(&k) && fantasma(e).is_some() { return b(o, false); } b(o, g(|g| g.bot_nuevos.iter().any(|x| *x as f64 == k))) });
    def(&inp, "WasMousePressed", |e, a, o| { let k = mas(&ar(a, 0)); if fantasma(e).is_some() { return b(o, false); } b(o, g(|g| g.bot_nuevos.iter().any(|x| *x as f64 == k))) });
    def(&inp, "GetKeyName", |_, a, o| { let k = mas(&ar(a, 0)); let kj = keyjs(); let nm = if k >= 0.0 && k.fract() == 0.0 { kj.get(k as usize).cloned().unwrap_or_default() } else { String::new() }; let nm = nm.strip_prefix("Key").or_else(|| nm.strip_prefix("Digit")).unwrap_or(&nm).to_lowercase(); s(o, &nm) });
    def(&inp, "GetKeyCode", |_, a, o| {
        let c = { let v = ar(a, 0); if js_t(&v) { js_str(&v) } else { String::new() } }.to_uppercase();
        let kj = keyjs();
        let i = kj.iter().position(|x| !x.is_empty() && x.strip_prefix("Key").or_else(|| x.strip_prefix("Digit")).unwrap_or(x).to_uppercase() == c);
        n(o, i.filter(|i| *i > 0).unwrap_or(0) as f64)
    });
    def(&inp, "IsMouseDown", |e, a, o| { if fantasma(e).is_some() { return b(o, false); } let bb = mas(&ar(a, 0)); let en = h(|h| h.entrada().clone()); b(o, if bb == 107.0 { en.disparo } else if bb == 108.0 { en.disparo2 } else { en.raton != 0 && bb == en.raton as f64 }) });
    def(&inp, "IsShiftDown", |_, _, o| b(o, h(|h| h.entrada().tiene("ShiftLeft"))));
    def(&inp, "IsControlDown", |_, _, o| b(o, h(|h| h.entrada().tiene("ControlLeft"))));
    def(&inp, "GetCursorPos", |_, _, o| { let (w, hh) = h(|h| h.pantalla()); o.push(Valor::Num(w / 2.0)); o.push(Valor::Num(hh / 2.0)); Ok(()) });
    def(&inp, "SelectWeapon", nada);
    let gui = l("gui");
    def(&gui, "MouseX", |_, _, o| n(o, h(|h| h.pantalla().0) / 2.0));
    def(&gui, "MouseY", |_, _, o| n(o, h(|h| h.pantalla().1) / 2.0));
    for k in ["EnableScreenClicker", "OpenURL", "ActivateGameUI", "HideGameUI", "SetMousePos"] { def(&gui, k, nada); }
    def(&gui, "IsGameUIVisible", |_, _, o| b(o, h(|h| h.entrada().ui_abierto)));
    def(&gui, "IsConsoleVisible", |_, _, o| b(o, false));
    def(&gui, "ScreenToVector", |_, _, o| ok1(o, vvd(h(|h| h.cam().fwd))));
    def(&gui, "MousePos", |_, _, o| { let (w, hh) = h(|h| h.pantalla()); o.push(Valor::Num(w / 2.0)); o.push(Valor::Num(hh / 2.0)); Ok(()) });
    let team = l("team");
    def(&team, "GetName", |_, _, o| s(o, "Unassigned"));
    def(&team, "GetColor", |_, _, o| ok1(o, colorf(255.0, 255.0, 100.0, 255.0)));
    for k in ["SetUp", "SetScore", "SetSpawnPoint", "SetClass", "AddScore"] { def(&team, k, nada); }
    for k in ["NumPlayers", "BestAutoJoinTeam"] { def(&team, k, |_, _, o| n(o, 1.0)); }
    def(&team, "GetPlayers", |_, _, o| ok1(o, tab_de(vec![g(|g| g.jug.clone())])));
    def(&team, "Valid", |_, a, o| b(o, num(&ar(a, 0), 0.0) >= 0.0));
    for k in ["GetAllTeams", "GetClass"] { def(&team, k, |_, _, o| ok1(o, tnueva())); }
    for k in ["GetScore", "TotalFrags"] { def(&team, k, |_, _, o| n(o, 0.0)); }
    def(&team, "Joinable", |_, _, o| b(o, true));
    let pmg = l("player_manager");
    for k in ["AddValidModel", "AddValidHands", "RegisterClass", "SetPlayerClass", "RunClass"] { def(&pmg, k, nada); }
    def(&pmg, "TranslatePlayerModel", |_, _, o| s(o, "models/player/kleiner.mdl"));
    def(&pmg, "AllValidModels", |_, _, o| ok1(o, tnueva()));
    def(&pmg, "GetPlayerClass", |_, _, o| s(o, "player_sandbox"));
    def(&pmg, "TranslateToPlayerModelName", |_, _, o| s(o, "kleiner"));
    def(&pmg, "TranslatePlayerHands", |_, _, o| ok1(o, tabla_kv(vec![("model", cad("models/weapons/c_arms_citizen.mdl")), ("skin", Valor::Num(0.0)), ("body", cad("0000000")), ("matchBodySkin", Valor::Bool(false))])));
    let phe = l("physenv");
    def(&phe, "GetGravity", |_, _, o| ok1(o, nv(0.0, 0.0, -600.0)));
    for k in ["SetGravity", "SetPerformanceSettings", "AddSurfaceData", "SetAirDensity"] { def(&phe, k, nada); }
    def(&phe, "GetPerformanceSettings", |_, _, o| ok1(o, tnueva()));
    def(&phe, "GetAirDensity", |_, _, o| n(o, 2.0));
    let gmd = l("gamemode");
    {
        let gl2 = gl.clone();
        def(&gmd, "Call", move |e, a, o| {
            let ev = js_str(&ar(a, 0));
            let c = g(|g| g.ctx);
            let r = hook(e, &ev, &[c], &a[1.min(a.len())..]);
            if !r.is_empty() && !r[0].es_nil() { o.extend(r); return Ok(()); }
            if let Valor::Tabla(gm) = gl2.borrow().get_str("GAMEMODE") { let f = gm.borrow().get(&ar(a, 0)); if let Valor::Func(_) = f { let mut v = vec![Valor::Tabla(gm.clone())]; v.extend_from_slice(&a[1.min(a.len())..]); o.extend(e.llamar_aqui(&f, &v)?); } }
            Ok(())
        });
        let gl3 = gl.clone();
        def(&gmd, "Get", move |_, _, o| ok1(o, gl3.borrow().get_str("GAMEMODE")));
    }
    def(&gmd, "Register", nada);
    let ai = l("ai");
    for k in ["GetScheduleID", "GetTaskID"] { def(&ai, k, |_, _, o| n(o, 0.0)); }
    for k in ["ai_schedule", "ai_task"] { let t2 = l(k); def(&t2, "New", |_, _, o| { let mt = g(|g| g.mt.vacio.clone()); ok1(o, Valor::Udata(Udata::nueva((), mt))) }); }
    let jit = l("jit");
    for k in ["on", "off", "flush"] { def(&jit, k, nada); }
    jit.borrow_mut().set_str("version", cad("LuaJIT 2.1"));
    jit.borrow_mut().set_str("arch", cad("x64"));
    jit.borrow_mut().set_str("os", cad("Windows"));
    // (render, cam y las demás del motor: responden sin hacer nada; lo que pregunta da false)
    for nm in ["render", "cam", "mesh", "killicon", "resource", "spawnmenu", "presets", "undo", "cleanup", "duplicator", "constraint", "properties", "achievements", "navmesh", "steamworks", "search", "menubar", "widgets", "halo", "frame_blend", "drive", "construct", "numpad", "matproxy", "motionsensor", "controlpanel", "serverlist", "video"] {
        let t2 = l(nm);
        let m = Tabla::nueva_ref();
        def(&m, "__index", |_, a, o| {
            let Valor::Cad(k) = ar(a, 1) else { return ok1(o, Valor::Nil) };
            let bb = k.bytes();
            let pregunta = ["Is", "Has", "Can", "Should", "Supports"].iter().any(|p| bb.starts_with(p.as_bytes()) && bb.len() > p.len() && bb[p.len()].is_ascii_uppercase());
            ok1(o, if pregunta { fnat(|_, _, o| b(o, false)) } else if bb.starts_with(b"Get") { fnat(|_, _, o| n(o, 0.0)) } else { fnat(nada) })
        });
        t2.borrow_mut().set_meta(Some(m));
    }
    let rd = l("render");
    for k in ["GetScreenEffectTexture", "GetRenderTarget"] { def(&rd, k, |_, _, o| ok1(o, material("rt"))); }
    def(&rd, "GetLightColor", |_, _, o| ok1(o, nv(1.0, 1.0, 1.0)));
    def(&rd, "GetSurfaceColor", |_, _, o| ok1(o, nv(0.55, 0.5, 0.45)));
    def(&rd, "GetAmbientLightColor", |_, _, o| ok1(o, nv(0.5, 0.5, 0.5)));
    def(&rd, "GetDXLevel", |_, _, o| n(o, 95.0));
    def(&rd, "SupportsHDR", |_, _, o| b(o, true));
    def(&rd, "GetViewSetup", |_, _, o| { let c = h(|h| h.cam().clone()); ok1(o, tabla_kv(vec![("origin", vv(c.pos)), ("angles", naa(dir_ang(ds(c.fwd)))), ("fov", Valor::Num(if c.fov == 0.0 { 75.0 } else { c.fov }))])) });
    let halo = l("halo");
    def(&halo, "Add", nada);
    def(&halo, "RenderedEntity", |_, _, o| ok1(o, null()));
    def(&l("undo"), "Create", nada);
    let cons = l("constraint");
    for k in ["Weld", "Axis"] { def(&cons, k, |_, a, o| { soldar(&ar(a, 0), &ar(a, 1)); ok1(o, null()) }); }
    for k in ["NoCollide", "Rope"] { def(&cons, k, |_, _, o| ok1(o, null())); }
    def(&cons, "Find", |_, _, o| ok1(o, Valor::Nil));
    for k in ["FindConstraints", "GetTable"] { def(&cons, k, |_, _, o| ok1(o, tnueva())); }
    def(&cons, "RemoveAll", |_, a, o| b(o, desoldar(&ar(a, 0))));
    def(&cons, "GetAllConstrainedEntities", |_, a, o| {
        let x = ar(a, 0);
        let t2 = Tabla::nueva_ref();
        if es_ent(&x) {
            let _ = t2.borrow_mut().set(x.clone(), x.clone());
            if let Some(Some(sa)) = ce(&x, |y| y.soldado_a.clone()) { let _ = t2.borrow_mut().set(sa.clone(), sa); }
            for hj in g(|g| g.hijos.clone()) { if ce(&hj, |y| y.soldado_a.as_ref().map(|s2| mismo(s2, &x)).unwrap_or(false)).unwrap_or(false) { let _ = t2.borrow_mut().set(hj.clone(), hj); } }
        }
        ok1(o, Valor::Tabla(t2))
    });
    for k in ["HasConstraints", "RemoveConstraints"] { def(&cons, k, |_, _, o| b(o, false)); }
    let dup = l("duplicator");
    def(&dup, "CopyEntTable", |_, _, o| ok1(o, tnueva()));
    def(&dup, "GenericDuplicatorFunction", |_, _, o| ok1(o, null()));
    let panel_libre = || {
        let t2 = Tabla::nueva_ref();
        let m = Tabla::nueva_ref();
        let w = Rc::downgrade(&t2);
        def(&m, "__index", move |_, a, o| {
            let Valor::Cad(k) = ar(a, 1) else { return ok1(o, Valor::Nil) };
            let bb = k.bytes();
            let pregunta = ["Is", "Has", "Can", "Should"].iter().any(|p| bb.starts_with(p.as_bytes()) && bb.len() > p.len() && bb[p.len()].is_ascii_uppercase());
            let w2 = w.clone();
            ok1(o, if pregunta { fnat(|_, _, o| b(o, false)) } else if bb.starts_with(b"Get") { fnat(|_, _, o| n(o, 0.0)) } else { fnat(move |_, _, o| ok1(o, w2.upgrade().map(Valor::Tabla).unwrap_or(Valor::Nil))) })
        });
        t2.borrow_mut().set_meta(Some(m));
        Valor::Tabla(t2)
    };
    def(&l("controlpanel"), "Get", move |_, _, o| ok1(o, panel_libre()));
    let sm = l("spawnmenu");
    def(&sm, "GetTools", |_, _, o| ok1(o, tnueva()));
    def(&sm, "GetToolMenu", move |_, _, o| ok1(o, panel_libre()));
    def(&l("util"), "IsValidPhysicsObject", |_, a, o| { let x = ar(a, 0); b(o, es_ent(&x) && ent_valida(&x) && (es_jug(&x) || ce(&x, |y| y.o.is_some()).unwrap_or(false))) });
    def(&l("engine"), "IsMounted", |_, a, o| { let k = js_str(&ar(a, 0)).to_lowercase(); b(o, ["hl2", "cstrike", "garrysmod"].contains(&k.as_str())) });
    if gl.borrow().get_str("gameevent").es_nil() { gl.borrow_mut().set_str("gameevent", tnueva()); }
    def(&l("gameevent"), "Listen", nada);
    def(&gl, "RecipientFilter", |_, _, o| {
        let t2 = Tabla::nueva_ref();
        let m = Tabla::nueva_ref();
        let i = Tabla::nueva_ref();
        for k in ["AddAllPlayers", "AddPlayer", "AddPVS", "AddPAS", "RemovePlayer", "RemoveAllPlayers", "RemovePVS", "RemovePAS", "AddRecipientsByTeam", "RemoveRecipientsByTeam", "RemoveRecipientsNotOnTeam", "AddPlayers", "RemovePlayers", "RemoveMismatchedPlayers"] { def(&i, k, nada); }
        def(&i, "GetPlayers", |_, _, o| ok1(o, tab_de(vec![g(|g| g.jug.clone())])));
        def(&i, "GetCount", |_, _, o| n(o, 1.0));
        m.borrow_mut().set_str("__index", Valor::Tabla(i));
        m.borrow_mut().set_str("MetaName", cad("CRecipientFilter"));
        t2.borrow_mut().set_meta(Some(m));
        ok1(o, Valor::Tabla(t2))
    });
    def(&gl, "SetClipboardText", nada);
    {
        let gl2 = gl.clone();
        def(&gl, "RenderAngles", move |e, _, o| { let f = gl2.borrow().get_str("EyeAngles"); if let Valor::Func(_) = f { o.extend(e.llamar_aqui(&f, &[])?); } Ok(()) });
    }
    def(&gl, "SinglePlayer", |_, _, o| b(o, true));
    def(&gl, "GetWorldEntity", |_, _, o| ok1(o, g(|g| g.mundo.clone())));
}

/// un segmento de un patrón de file.Find (* sin cruzar /)
fn glob_seg(p: &str, s: &str) -> bool {
    let (p, s) = (p.as_bytes(), s.as_bytes());
    let (mut i, mut j, mut est, mut mk) = (0usize, 0usize, None::<usize>, 0usize);
    while j < s.len() {
        if i < p.len() && p[i] != b'*' && p[i] == s[j] { i += 1; j += 1; }
        else if i < p.len() && p[i] == b'*' { est = Some(i); mk = j; i += 1; }
        else if let Some(e) = est { i = e + 1; mk += 1; j = mk; }
        else { return false; }
    }
    while i < p.len() && p[i] == b'*' { i += 1; }
    i == p.len()
}
