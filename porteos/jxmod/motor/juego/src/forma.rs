//! Lo físico de los prefabs del paquete, como objetos.js: la forma de choque (formaDeArbol: una parte por collider —caja,
//! esfera, cápsula o casco convexo de la malla—, en el marco de la raíz; una sola forma o una compuesta), el casco
//! convexo (cascoConvexo, hullDePuntos) y la parte física de crearObjeto (masa, rebote, fricción, de qué es, dónde apoya).
//! Los prefabs están en DATA.pf (nodos como los de los mapas) y se buscan por el nombre antes del '#' (pfPorNombre).
use crate::fisica::{add, casco_de, hypot_js, cruz, dot, esc, forma_caja, forma_capsula, forma_compuesta, forma_esfera, largo, norm, orientar_caras, puntos_forma, qeje, qmul, rot, sub,
    Casco, Cuerpo, Forma, OpCuerpo, Parte, Q, QID, V};
use crate::paquete::Paquete;
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;

/// lo físico de un prefab: la forma (centrada en `c`, el centro en el marco de la raíz del modelo), la masa y lo demás
/// que crearObjeto le pone al cuerpo
#[derive(Clone, Debug)]
pub struct PrefabFisica {
    pub nombre: String,
    /// la clave en DATA.pf ("TableRound#cc186f")
    pub clave: String,
    pub forma: Arc<Forma>,
    /// dónde queda el centro de la forma en el marco del modelo (para dibujar: raíz = cuerpo × capQ⁻¹ × T(-c))
    pub c: V,
    /// una cápsula sola: su eje en el modelo, y el giro que lleva Y a ese eje (capQ: el cuerpo lo lleva multiplicado)
    pub eje_cap: Option<V>, pub cap_q: Option<Q>,
    /// cuántas partes (colliders) tiene, si es compuesta
    pub partes: usize,
    pub masa: f64, pub fric: f64, pub rest: f64,
    /// tipoDe: 'vehiculo', 'explota', 'interactivo', 'arma' o 'prop'
    pub tipo: &'static str,
    /// noPhys (no choca con otros cuerpos) y congelado (frozen): las calcomanías y los arbustos
    pub sin_fisica: bool, pub congelado: bool,
    /// salta (rb.sal), el sonido (rb.snd o metal/madera por la masa) y la densidad para el agua (rb.dn)
    pub salta: bool, pub snd: String, pub dens: Option<f64>,
}

/// DATA.pfPorNombre: el nombre (lo de antes del '#') → la clave en DATA.pf (la primera de cada nombre)
pub fn pf_por_nombre(paq: &Paquete) -> BTreeMap<String, String> {
    let mut m = BTreeMap::new();
    if let Some(o) = paq.d["pf"].as_object() { for k in o.keys() { let n = k.split('#').next().unwrap_or(k); m.entry(n.to_string()).or_insert_with(|| k.clone()); } }
    m
}
/// los nombres de lo que trae una pestaña del menú (DATA.menu: "Props", "Vehicles", "Entities"…), en orden
pub fn nombres_menu(paq: &Paquete, pestana: &str) -> Vec<String> {
    let mut o = vec![];
    let Some(m) = paq.d["menu"].as_array() else { return o };
    for c in m.iter().filter(|c| c["n"].as_str() == Some(pestana)) {
        for s in c["sub"].as_array().into_iter().flatten() {
            for x in s["it"].as_array().into_iter().flatten() { if let Some(n) = x.as_str().or_else(|| x["n"].as_str()) { o.push(n.to_string()); } }
        }
    }
    o
}
/// tipoDe: qué es según los scripts del prefab
pub fn tipo_de(arb: &[Value]) -> &'static str {
    let mb: Vec<&str> = arb.first().and_then(|x| x["mb"].as_array()).map(|a| a.iter().filter_map(|v| v.as_str()).collect()).unwrap_or_default();
    if mb.contains(&"Vehicle") || mb.contains(&"RB_Controller") { return "vehiculo"; }
    if mb.contains(&"ExplodeProp") { return "explota"; }
    if mb.contains(&"InteractableProp") { return "interactivo"; }
    if mb.contains(&"WeaponProp") { return "arma"; }
    "prop"
}

/// la caché de formaDe: un prefab se arma una vez
#[derive(Default)]
pub struct Catalogo { pub por_nombre: BTreeMap<String, String>, hechos: HashMap<String, Option<Arc<PrefabFisica>>> }
impl Catalogo {
    pub fn nuevo(paq: &Paquete) -> Catalogo { Catalogo { por_nombre: pf_por_nombre(paq), hechos: HashMap::new() } }
    pub fn prefab(&mut self, paq: &Paquete, nombre: &str) -> Option<Arc<PrefabFisica>> {
        if let Some(p) = self.hechos.get(nombre) { return p.clone(); }
        let p = self.por_nombre.get(nombre).and_then(|k| prefab_de_clave(paq, nombre, k)).map(Arc::new);
        self.hechos.insert(nombre.to_string(), p.clone()); p
    }
}

/// formaDe + la parte física de crearObjeto, por el nombre del prefab
pub fn forma_de_prefab(paq: &Paquete, nombre: &str) -> Option<PrefabFisica> {
    let k = pf_por_nombre(paq).remove(nombre)?;
    prefab_de_clave(paq, nombre, &k)
}
fn prefab_de_clave(paq: &Paquete, nombre: &str, clave: &str) -> Option<PrefabFisica> {
    let arb = paq.d["pf"][clave].as_array()?;
    let (forma, c, eje_cap, partes) = forma_de_arbol(paq, arb);
    let rb = &arb[0]["rb"];
    let masa = if rb.is_object() { rb["m"].as_f64().map(|m| m.max(0.5)).unwrap_or(20.0) } else { 20.0 };
    let rest = if rb.is_object() && !rb["rs"].is_null() { rb["rs"].as_f64().unwrap_or(0.12) } else if nombre == "bouncy_ball" { 0.92 } else { 0.12 };
    // (capQ: el giro que lleva Y al eje de la cápsula)
    let cap_q = eje_cap.map(|a| {
        let d = dot(a, [0.0, 1.0, 0.0]);
        if d < 0.999 { let ax = cruz([0.0, 1.0, 0.0], a); let ax = if largo(ax) > 1e-9 { norm(ax) } else { [1.0, 0.0, 0.0] }; qeje(ax, d.clamp(-1.0, 1.0).acos()) } else { QID }
    });
    let decal = nombre.starts_with("decal_");
    Some(PrefabFisica { nombre: nombre.to_string(), clave: clave.to_string(), forma: Arc::new(forma), c, eje_cap, cap_q, partes, masa, fric: 0.6, rest,
        tipo: tipo_de(arb), sin_fisica: decal || nombre == "Bush", congelado: decal,
        salta: rb.is_object() && verdad(&rb["sal"]), snd: rb["snd"].as_str().map(|s| s.to_string()).unwrap_or_else(|| if masa > 300.0 { "metal" } else { "wood" }.to_string()),
        dens: rb["dn"].as_f64() })
}
/// la parte física de crearObjeto: el cuerpo de un prefab en `pos` (la del piso: lo sube para que la base quede apoyada;
/// con `exacto`, el modelo queda en pos) con el giro q. Falta agregarlo a la física
pub fn cuerpo_de_prefab(pf: &PrefabFisica, pos: V, q: Q, exacto: bool) -> Cuerpo {
    let mut b = Cuerpo::nuevo(pf.forma.clone(), pf.masa, OpCuerpo { fric: pf.fric, rest: pf.rest, ..OpCuerpo::default() });
    b.q = q; if let Some(r) = pf.cap_q { b.q = qmul(b.q, r); }
    let min_y = match &*pf.forma {
        Forma::Casco(_) | Forma::Compuesta { .. } => puntos_forma(&pf.forma).iter().fold(1e9f64, |m, v| m.min(rot(b.q, *v)[1])),
        Forma::Esfera { r } => -r,
        Forma::Capsula { r, hh } => -(r + hh),
    };
    b.pos = [pos[0], pos[1] - min_y + 0.01, pos[2]];
    if exacto { b.pos = add(pos, rot(b.q, pf.c)); }
    b.congelado = pf.congelado; b.sin_fisica = pf.sin_fisica;
    b
}

// ---------------- las matrices del modelo (Float32Array en la web) ----------------
type M = [f64; 16];
fn verdad(v: &Value) -> bool { match v { Value::Null => false, Value::Bool(b) => *b, Value::Number(n) => n.as_f64().map_or(false, |x| x != 0.0), Value::String(s) => !s.is_empty(), _ => true } }
fn num(v: &Value, d: f64) -> f64 { v.as_f64().unwrap_or(d) }
fn arr3(v: &Value, d: V) -> V { if v.is_array() { [num(&v[0], d[0]), num(&v[1], d[1]), num(&v[2], d[2])] } else { d } }
fn r32(m: M) -> M { m.map(|x| x as f32 as f64) }
/// m4trs
fn trs(p: V, r: Q, s: V) -> M {
    let (x, y, z, w) = (r[0], r[1], r[2], r[3]);
    [(1.0 - 2.0 * (y * y + z * z)) * s[0], 2.0 * (x * y + z * w) * s[0], 2.0 * (x * z - y * w) * s[0], 0.0,
     2.0 * (x * y - z * w) * s[1], (1.0 - 2.0 * (x * x + z * z)) * s[1], 2.0 * (y * z + x * w) * s[1], 0.0,
     2.0 * (x * z + y * w) * s[2], 2.0 * (y * z - x * w) * s[2], (1.0 - 2.0 * (x * x + y * y)) * s[2], 0.0,
     p[0], p[1], p[2], 1.0]
}
fn mul(a: &M, b: &M) -> M {
    let mut o = [0.0; 16];
    for c in 0..4 { for r in 0..4 { o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; } }
    o
}
/// m4pt
fn pt(m: &M, x: f64, y: f64, z: f64) -> V { [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]] }
fn col(m: &M, o: usize) -> f64 { (m[o] * m[o] + m[o + 1] * m[o + 1] + m[o + 2] * m[o + 2]).sqrt() }
/// (el largo de una columna con Math.hypot, como lo cuenta el JS en formaDeArbol y m4esc)
fn col_h(m: &M, o: usize) -> f64 { hypot_js(&[m[o], m[o + 1], m[o + 2]]) }
/// m4esc
fn m_esc(m: &M) -> f64 { col_h(m, 0).max(col_h(m, 4)).max(col_h(m, 8)) }
/// m4quat
fn m_quat(m: &M) -> Q {
    let (sx, sy, sz) = (col(m, 0), col(m, 4), col(m, 8));
    let (a, b, c, d, e, f, g, h, k) = (m[0] / sx, m[1] / sx, m[2] / sx, m[4] / sy, m[5] / sy, m[6] / sy, m[8] / sz, m[9] / sz, m[10] / sz);
    let t = a + e + k; let (x, y, z, w);
    if t > 0.0 { let s = (t + 1.0).sqrt() * 2.0; w = 0.25 * s; x = (f - h) / s; y = (g - c) / s; z = (b - d) / s; }
    else if a > e && a > k { let s = (1.0 + a - e - k).sqrt() * 2.0; w = (f - h) / s; x = 0.25 * s; y = (d + b) / s; z = (g + c) / s; }
    else if e > k { let s = (1.0 + e - a - k).sqrt() * 2.0; w = (g - c) / s; x = (d + b) / s; y = 0.25 * s; z = (h + f) / s; }
    else { let s = (1.0 + k - a - e).sqrt() * 2.0; w = (b - d) / s; x = (g + c) / s; y = (h + f) / s; z = 0.25 * s; }
    let l = (x * x + y * y + z * z + w * w).sqrt(); let l = if l > 0.0 { l } else { 1.0 };
    [x / l, y / l, z / l, w / l]
}

/// los vértices de una malla del paquete (mallaCPU: Float32), o None si sus bytes no están
fn malla_pos(paq: &Paquete, md: &Value) -> Option<Vec<[f32; 3]>> {
    let bin = paq.bin_de(md)?;
    let (v, o) = (md["v"].as_u64()? as usize, md["o"].as_u64()? as usize);
    let (mn, sc) = (arr3(&md["mn"], [0.0; 3]), arr3(&md["sc"], [1.0; 3]));
    let mut p = Vec::with_capacity(v);
    for k in 0..v {
        let b = o + k * 14; let q = |j: usize| bin.get(b + j * 2..b + j * 2 + 2).map(|x| u16::from_le_bytes([x[0], x[1]]) as f64 / 65535.0);
        p.push([(mn[0] + q(0)? * sc[0]) as f32, (mn[1] + q(1)? * sc[1]) as f32, (mn[2] + q(2)? * sc[2]) as f32]);
    }
    Some(p)
}

struct ParteF { forma: Forma, c: V, q: Q, vol: f64, fino: bool }

/// formaDeArbol: la forma de choque de un prefab (forma, centro, eje de la cápsula sola, cuántas partes)
pub fn forma_de_arbol(paq: &Paquete, arb: &[Value]) -> (Forma, V, Option<V>, usize) {
    let n = arb.len(); let d = &paq.d;
    // (Modelo con la raíz en el origen: md.p[0] = [0, 0, 0])
    let mut act = vec![false; n]; let mut w: Vec<M> = vec![[0.0; 16]; n];
    for (i, x) in arb.iter().enumerate() {
        let pa = x["pa"].as_i64().unwrap_or(-1);
        act[i] = !verdad(&x["off"]) && (pa < 0 || act[pa as usize]);
        let r = if x["r"].is_array() { [num(&x["r"][0], 0.0), num(&x["r"][1], 0.0), num(&x["r"][2], 0.0), num(&x["r"][3], 1.0)] } else { QID };
        let l = trs(if i == 0 { [0.0; 3] } else { arr3(&x["p"], [0.0; 3]) }, r, arr3(&x["s"], [1.0; 3]));
        w[i] = if i == 0 || pa < 0 { r32(l) } else { r32(mul(&w[pa as usize], &l)) };
    }
    let mut partes: Vec<ParteF> = vec![];
    for (i, x) in arb.iter().enumerate() {
        let Some(cols) = x["col"].as_array() else { continue }; if !act[i] { continue; }
        let wm = &w[i]; let qw = m_quat(wm); let (sx, sy, sz) = (col_h(wm, 0), col_h(wm, 4), col_h(wm, 8));
        for c in cols {
            if verdad(&c["tr"]) { continue; }
            let cen = if c["c"].is_array() { let v = arr3(&c["c"], [0.0; 3]); pt(wm, v[0], v[1], v[2]) } else { pt(wm, 0.0, 0.0, 0.0) };
            match c["k"].as_str() {
                Some("b") => {
                    let s = arr3(&c["s"], [0.0; 3]);
                    let (hx, hy, hz) = ((s[0] * sx).abs() / 2.0, (s[1] * sy).abs() / 2.0, (s[2] * sz).abs() / 2.0);
                    let (hx, hy, hz) = (hx.max(0.02), hy.max(0.02), hz.max(0.02));
                    partes.push(ParteF { forma: forma_caja(hx, hy, hz), c: cen, q: qw, vol: 8.0 * hx * hy * hz, fino: false });
                }
                Some("s") => { let r = (num(&c["r"], 0.0) * m_esc(wm)).max(0.02); partes.push(ParteF { forma: forma_esfera(r), c: cen, q: QID, vol: 4.19 * r * r * r, fino: false }); }
                Some("c") => {
                    let k = m_esc(wm); let r = (num(&c["r"], 0.0) * k).max(0.02); let hh = (num(&c["h"], 0.0) * k / 2.0 - r).max(0.0);
                    let dd = c["d"].as_i64().unwrap_or(1);
                    let q = if dd == 0 { qmul(qw, qeje([0.0, 0.0, 1.0], std::f64::consts::FRAC_PI_2)) } else if dd == 2 { qmul(qw, qeje([1.0, 0.0, 0.0], std::f64::consts::FRAC_PI_2)) } else { qw };
                    partes.push(ParteF { forma: forma_capsula(r, hh), c: cen, q, vol: 3.14 * r * r * (2.0 * hh + 1.33 * r), fino: false });
                }
                Some("m") => {
                    let Some(mi) = c["m"].as_i64().filter(|&m| m >= 0) else { continue };
                    let fino = c["cv"].as_i64() == Some(2); let md = &d["ms"][mi as usize]; let mut pts: Vec<V> = vec![];
                    // (los de un paquete aparte traen los puntos de su casco: el cuerpo se arma sin haber bajado la malla)
                    if let Some(h) = md["hp"].as_array() {
                        let (mn, sc) = (arr3(&md["mn"], [0.0; 3]), arr3(&md["sc"], [1.0; 3]));
                        for k in (0..h.len().saturating_sub(2)).step_by(3) {
                            let f = |j: usize| (mn[j] + num(&h[k + j], 0.0) / 65535.0 * sc[j]) as f32 as f64;
                            pts.push(pt(wm, f(0), f(1), f(2)));
                        }
                    } else if let Some(p) = malla_pos(paq, md) {
                        let paso = ((p.len() as f64 / if fino { 4000.0 } else { 400.0 }).floor() as usize).max(1);
                        for v in p.iter().step_by(paso) { pts.push(pt(wm, v[0] as f64, v[1] as f64, v[2] as f64)); }
                    }
                    if pts.len() >= 4 { let (h, hc, vol) = casco_de_puntos(&pts, fino); partes.push(ParteF { forma: Forma::Casco(h), c: hc, q: QID, vol, fino }); }
                }
                _ => {}
            }
        }
    }
    // sin colliders: la caja de las mallas que se ven
    if partes.is_empty() {
        let ver = visibles(arb, &act); let mut pts: Vec<V> = vec![];
        for i in 0..n {
            if !ver[i] { continue; } let md = &d["ms"][arb[i]["m"].as_u64().unwrap_or(0) as usize];
            let (mn, sc) = (arr3(&md["mn"], [0.0; 3]), arr3(&md["sc"], [0.0; 3]));
            for ex in [0.0, 1.0] { for ey in [0.0, 1.0] { for ez in [0.0, 1.0] { pts.push(pt(&w[i], mn[0] + sc[0] * ex, mn[1] + sc[1] * ey, mn[2] + sc[2] * ez)); } } }
        }
        if pts.is_empty() { pts = vec![[-0.2, -0.2, -0.2], [0.2, 0.2, 0.2], [-0.2, 0.2, 0.2], [0.2, -0.2, -0.2]]; }
        let (h, c, _) = casco_de_puntos(&pts, false); return (Forma::Casco(h), c, None, 0);
    }
    if partes.len() == 1 {
        let p = partes.pop().unwrap();
        match p.forma {
            Forma::Esfera { .. } => return (p.forma, p.c, None, 0),
            Forma::Capsula { .. } => return (p.forma, p.c, Some(rot(p.q, [0.0, 1.0, 0.0])), 0),
            // caja girada o malla: sus vértices girados a la raíz, como poliedro
            Forma::Casco(h) => { let vs: Vec<V> = h.v.iter().map(|v| add(rot(p.q, *v), p.c)).collect(); let (h, c, _) = casco_de_puntos(&vs, p.fino); return (Forma::Casco(h), c, None, 0); }
            Forma::Compuesta { .. } => unreachable!(),
        }
    }
    let (mut vt, mut c) = (0.0, [0.0; 3]);
    for p in &partes { c = add(c, esc(p.c, p.vol)); vt += p.vol; }
    c = esc(c, 1.0 / vt);
    let np = partes.len();
    (forma_compuesta(partes.into_iter().map(|p| Parte { p: sub(p.c, c), forma: p.forma, q: p.q }).collect()), c, None, np)
}
/// Modelo.ver: con malla y materiales, sin apagar el render ni esconder por nivel de detalle (el primero de cada grupo)
fn visibles(arb: &[Value], act: &[bool]) -> Vec<bool> {
    let mut por_rid = HashMap::new();
    for (i, x) in arb.iter().enumerate() { if let Some(r) = x["rid"].as_i64() { por_rid.insert(r, i); } }
    let mut oculto = vec![false; arb.len()];
    for x in arb { if let Some(l) = x["lod"].as_array() {
        for (k, nivel) in l.iter().enumerate() { if k == 0 { continue; } for rid in nivel[1].as_array().into_iter().flatten() { if let Some(&i) = rid.as_i64().and_then(|r| por_rid.get(&r)) { oculto[i] = true; } } }
    } }
    arb.iter().enumerate().map(|(i, x)| act[i] && x["m"].as_i64().map_or(false, |m| m >= 0) && verdad(&x["mt"]) && !verdad(&x["mroff"]) && !oculto[i]).collect()
}

// ---------------- el casco convexo ----------------
/// DIR_FINO: 48 direcciones repartidas parejo (espiral de Fibonacci) para el casco «fino» de los props redondos
fn dir_fino() -> Vec<V> {
    (0..48).map(|i| { let y = 1.0 - (2.0 * i as f64 + 1.0) / 48.0; let r = (1.0 - y * y).sqrt(); let a = i as f64 * 2.39996323; [a.cos() * r, y, a.sin() * r] }).collect()
}
#[derive(Clone, Copy)]
struct Tri { v: [usize; 3], n: V, d: f64 }
/// cascoConvexo (incremental): vértices y caras (polígonos con las coplanares unidas); None si los puntos son chatos
pub fn casco_convexo(pin: &[V], fino: bool) -> Option<(Vec<V>, Vec<Vec<usize>>)> {
    let n = pin.len(); if n < 4 { return None; }
    let mut p: Vec<V> = pin.to_vec();
    // reducir: los extremos en 14 direcciones (ejes y diagonales), o en 48 si es fino
    if n > 16 {
        let mut dd: Vec<V> = vec![];
        if fino { dd = dir_fino(); dd.push([0.0, 1.0, 0.0]); dd.push([0.0, -1.0, 0.0]); }
        else { for x in -1i32..=1 { for y in -1i32..=1 { for z in -1i32..=1 { if (x != 0 || y != 0 || z != 0) && x.abs() + y.abs() + z.abs() != 2 { dd.push(norm([x as f64, y as f64, z as f64])); } } } } }
        let mut s: Vec<usize> = vec![];
        for d in &dd { let (mut bi, mut bv) = (0usize, -1e9); for i in 0..n { let v = dot(p[i], *d); if v > bv { bv = v; bi = i; } } if !s.contains(&bi) { s.push(bi); } }
        p = s.iter().map(|&i| p[i]).collect(); if p.len() < 4 { return None; }
    }
    // tetraedro inicial
    let (mut i0, mut i1) = (0usize, 0usize);
    for i in 1..p.len() { if p[i][0] < p[i0][0] { i0 = i; } if p[i][0] > p[i1][0] { i1 = i; } }
    if i0 == i1 { i1 = (i0 + 1) % p.len(); }
    let ab = sub(p[i1], p[i0]);
    let (mut i2, mut bd) = (usize::MAX, 1e-12);
    for i in 0..p.len() { let c = cruz(ab, sub(p[i], p[i0])); let d = dot(c, c); if d > bd { bd = d; i2 = i; } }
    if i2 == usize::MAX { return None; }
    let nrm = norm(cruz(sub(p[i1], p[i0]), sub(p[i2], p[i0])));
    let (mut i3, mut bd) = (usize::MAX, 1e-6);
    for i in 0..p.len() { let d = dot(nrm, sub(p[i], p[i0])).abs(); if d > bd { bd = d; i3 = i; } }
    if i3 == usize::MAX { return None; }
    let mk = |a: usize, b: usize, c: usize| -> Option<Tri> { let nn = cruz(sub(p[b], p[a]), sub(p[c], p[a])); let l = largo(nn); if l < 1e-12 { return None; } let nn = esc(nn, 1.0 / l); Some(Tri { v: [a, b, c], n: nn, d: dot(nn, p[a]) }) };
    let cen = esc(add(add(p[i0], p[i1]), add(p[i2], p[i3])), 0.25);
    let mut f: Vec<Tri> = vec![];
    for t in [[i0, i1, i2], [i0, i2, i3], [i0, i3, i1], [i1, i3, i2]] {
        let mut x = mk(t[0], t[1], t[2])?; if dot(x.n, cen) - x.d > 0.0 { x = mk(t[0], t[2], t[1])?; } f.push(x);
    }
    let eps = 1e-6;
    for q in 0..p.len() {
        if q == i0 || q == i1 || q == i2 || q == i3 { continue; }
        let vis: Vec<bool> = f.iter().map(|x| dot(x.n, p[q]) - x.d > eps).collect(); if !vis.iter().any(|&v| v) { continue; }
        // (las aristas de las caras que ve, en orden; el horizonte: las que no tienen su vuelta)
        let mut ed: Vec<(usize, usize)> = vec![]; let mut hay: std::collections::HashSet<(usize, usize)> = Default::default();
        for (x, _) in f.iter().zip(vis.iter()).filter(|(_, &v)| v) { for k in 0..3 { let e = (x.v[k], x.v[(k + 1) % 3]); if hay.insert(e) { ed.push(e); } } }
        let hor: Vec<(usize, usize)> = ed.iter().copied().filter(|e| !hay.contains(&(e.1, e.0))).collect();
        f = f.into_iter().zip(vis).filter(|(_, v)| !v).map(|(x, _)| x).collect();
        for e in hor { if let Some(x) = mk(e.0, e.1, q) { f.push(x); } }
    }
    // unir caras coplanares en polígonos
    struct Gr { n: V, d: f64, s: Vec<usize> }
    let mut grupos: Vec<Gr> = vec![];
    for x in &f {
        let gi = match grupos.iter().position(|g| dot(g.n, x.n) > 0.9995 && (g.d - x.d).abs() < 2e-3) { Some(i) => i, None => { grupos.push(Gr { n: x.n, d: x.d, s: vec![] }); grupos.len() - 1 } };
        for &i in &x.v { if !grupos[gi].s.contains(&i) { grupos[gi].s.push(i); } }
    }
    let mut usados: HashMap<usize, usize> = HashMap::new(); let mut vv: Vec<V> = vec![]; let mut caras: Vec<Vec<usize>> = vec![];
    for g in &grupos {
        let mut ids = g.s.clone();
        let c = esc(ids.iter().fold([0.0; 3], |a, &i| add(a, p[i])), 1.0 / ids.len() as f64);
        let u = norm(sub(p[ids[0]], c)); let w = cruz(g.n, u);
        let ang = |i: usize| { let pa = sub(p[i], c); dot(pa, w).atan2(dot(pa, u)) };
        ids.sort_by(|a, b| ang(*a).partial_cmp(&ang(*b)).unwrap_or(std::cmp::Ordering::Equal));
        // (sacar los puntos alineados, en medio de una arista)
        let m = ids.len();
        let lim: Vec<usize> = (0..m).filter(|&k| { let (a, b, d) = (p[ids[(k + m - 1) % m]], p[ids[k]], p[ids[(k + 1) % m]]); largo(cruz(sub(b, a), sub(d, b))) > 1e-7 }).map(|k| ids[k]).collect();
        if lim.len() >= 3 {
            caras.push(lim.iter().map(|&i| *usados.entry(i).or_insert_with(|| { vv.push(p[i]); vv.len() - 1 })).collect());
        }
    }
    Some((vv, caras))
}
/// hullDePuntos: el casco convexo de una nube de puntos, centrado en su centro (forma, centro, volumen)
pub fn casco_de_puntos(pts: &[V], fino: bool) -> (Casco, V, f64) {
    let caja = |pts: &[V]| { let (mut lo, mut hi) = ([1e9f64; 3], [-1e9f64; 3]); for p in pts { for k in 0..3 { lo[k] = lo[k].min(p[k]); hi[k] = hi[k].max(p[k]); } } (lo, hi) };
    let Some((v, f)) = casco_convexo(pts, fino) else {
        let (lo, hi) = caja(pts); let c = esc(add(lo, hi), 0.5); let h = esc(sub(hi, lo), 0.5);
        let (hx, hy, hz) = (h[0].max(0.02), h[1].max(0.02), h[2].max(0.02));
        let Forma::Casco(s) = forma_caja(hx, hy, hz) else { unreachable!() };
        return (s, c, 8.0 * hx * hy * hz);
    };
    let c = esc(v.iter().fold([0.0; 3], |a, p| add(a, *p)), 1.0 / v.len() as f64);
    let vs: Vec<V> = v.iter().map(|p| sub(*p, c)).collect();
    let mut sh = casco_de(vs, &f); orientar_caras(&mut sh);
    // como mucho 8 direcciones de aristas (las casi paralelas se juntan): la prueba arista-arista cuesta n²
    if sh.dirs.len() > 8 { let mut d: Vec<V> = vec![]; for x in &sh.dirs { if !d.iter().any(|u| dot(*u, *x).abs() > 0.93) { d.push(*x); } } d.truncate(8); sh.dirs = d; }
    let (lo, hi) = caja(&sh.v); let d = sub(hi, lo);
    (sh, c, (d[0] * d[1] * d[2] * 0.6).max(1e-4))
}
