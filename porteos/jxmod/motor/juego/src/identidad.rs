//! La identidad propia de JXMod (identidad.js): las 12 skins humanas heredadas con nombre propio y la ropa teñida con una
//! rampa de tres colores (sombra, medio y luz) según la luminancia de cada punto (la piel y algunas zonas no se tocan); los
//! retratos teñidos igual; los mapas base con nombre propio y, en los siete de superficie, la plaza JX (plataforma con
//! rampas, el monolito con el «JX» y cuatro postes con luz) a unos 46 m de la aparición. Por dentro las skins y los mapas
//! se siguen llamando igual (la red y las partidas los nombran así): sólo cambia lo que se ve.
use crate::geo::{qeje, qmul, qrot, Geo, Q, V};
use serde_json::Value;
use std::collections::HashMap;

/// las rampas (sombra, medio, luz)
pub const RAMPAS: [(&str, [&str; 3]); 12] = [
    ("amarillo", ["#3b2a06", "#e8a514", "#fff0c2"]), ("terracota", ["#2c1109", "#a8452e", "#f2b49c"]), ("petroleo", ["#06201f", "#1f8577", "#b8efe5"]),
    ("grafito", ["#0b0d10", "#2e333b", "#9aa3ad"]), ("bordo", ["#120307", "#561424", "#b4606f"]), ("artico", ["#3d4650", "#b9c3cc", "#ffffff"]),
    ("violeta", ["#150b2c", "#5f3fb0", "#d9cbff"]), ("cielo", ["#081a33", "#2f7fd6", "#d4e9ff"]), ("musgo", ["#0c1608", "#4a6b2a", "#d3e6b5"]),
    ("noche", ["#05070d", "#1d2b4a", "#8fa4cc"]), ("duna", ["#2a1d0c", "#b08b52", "#f4e6c8"]), ("fuego", ["#2a0b03", "#d4541f", "#ffd0b0"]),
];
/// una textura de ropa: la rampa (si no, la de la skin), si tiene piel suelta y las zonas que no se tocan (x0, y0, x1, y1 de
/// 0 a 1 desde arriba a la izquierda)
#[derive(Clone, Debug)]
pub struct TexRopa { pub r: Option<&'static str>, pub piel: bool, pub zonas: &'static [[f32; 4]] }
/// una skin heredada: su nombre, su rampa, desde dónde empieza la ropa en el retrato y sus texturas (por material)
pub struct Skin { pub s: &'static str, pub n: &'static str, pub r: &'static str, pub ret: f32, pub tex: &'static [(&'static str, TexRopa)] }
const T0: TexRopa = TexRopa { r: None, piel: false, zonas: &[] };
pub const SKINS: [Skin; 12] = [
    Skin { s: "Hero", n: "Nico", r: "amarillo", ret: 0.7, tex: &[("DI_Hero", TexRopa { r: None, piel: true, zonas: &[[0.0, 0.5, 0.86, 0.76]] })] },
    Skin { s: "Soldier", n: "Brasa", r: "terracota", ret: 0.7, tex: &[("body1Color2", T0)] },
    Skin { s: "Jean", n: "Tomi", r: "petroleo", ret: 0.7, tex: &[("wonamman_Top_diffuse", T0), ("wonamman_Bottom_diffuse", TexRopa { r: Some("grafito"), piel: false, zonas: &[] }), ("wonamman_Shoes_diffuse", TexRopa { r: Some("grafito"), piel: false, zonas: &[] })] },
    Skin { s: "Business", n: "Don Ferro", r: "bordo", ret: 0.74, tex: &[("Delovoy_Top_diffuse", T0), ("Delovoy_Bottom_diffuse", T0), ("Delovoy_Shoes_diffuse", TexRopa { r: Some("grafito"), piel: false, zonas: &[] })] },
    Skin { s: "SpecialForcesW", n: "Vega", r: "artico", ret: 0.87, tex: &[("Mat_SpecialForces_Suit", T0)] },
    Skin { s: "SpecialForcesM", n: "Rocco", r: "artico", ret: 0.75, tex: &[("Mat_SpecialForces_Suit", T0)] },
    Skin { s: "Prisoner01", n: "Rulo", r: "violeta", ret: 0.78, tex: &[("Mat_Prisoner_02_Body", TexRopa { r: None, piel: false, zonas: &[[0.0, 0.0, 0.48, 0.47], [0.6, 0.04, 0.88, 0.21], [0.36, 0.88, 0.52, 1.0]] })] },
    Skin { s: "PilotFemale", n: "Alas", r: "cielo", ret: 0.74, tex: &[("Mat_F_Pilot_02_Suit", T0)] },
    Skin { s: "Butcher", n: "Carnicero", r: "musgo", ret: 0.76, tex: &[("body2_Albedo", TexRopa { r: None, piel: true, zonas: &[] })] },
    Skin { s: "Swat", n: "Sombra", r: "noche", ret: 0.72, tex: &[("DI_SWAT", TexRopa { r: None, piel: true, zonas: &[] })] },
    Skin { s: "Military", n: "Duna", r: "duna", ret: 0.74, tex: &[("Soldier_body1", T0)] },
    Skin { s: "Engineer", n: "Chispa", r: "fuego", ret: 0.82, tex: &[("Mat_Engineer_02_Body", T0)] },
];
/// el nombre que se ve de una skin (SKIN_NOM de menu.js con los de identidad.js); None: el suyo
pub fn nombre_skin(s: &str) -> Option<&'static str> {
    if let Some(k) = SKINS.iter().find(|k| k.s == s) { return Some(k.n); }
    match s { "RickPrime" => Some("Rick Prime"), "Jeppy" => Some("Jeppy Jothers"), "UncleJeppy" => Some("Uncle Jeppy"), "BoiledOne" => Some("The Boiled One"), _ => None }
}
/// skinNom: el nombre que se ve
pub fn skin_nom(s: &str) -> String { nombre_skin(s).map(String::from).unwrap_or_else(|| s.to_string()) }
/// los mapas base con nombre propio (IDS_MAPAS, en castellano: la nativa está en castellano)
pub const MAPAS: [(&str, &str); 8] = [("Desert", "Cañadón Ocre"), ("DesertV2", "Médanos"), ("FlatGrass", "Pradera"), ("City", "Distrito Norte"), ("Base", "Hangar 7"), ("BaseV2", "Polo Industrial"), ("Mars", "Planeta Rojo"), ("Space", "Órbita")];
pub fn nombre_mapa(m: &str) -> String { MAPAS.iter().find(|x| x.0 == m).map(|x| x.1.to_string()).unwrap_or_else(|| m.to_string()) }

fn hex(h: &str) -> [f32; 3] { [1, 3, 5].map(|i| u8::from_str_radix(&h[i..i + 2], 16).unwrap_or(0) as f32) }
fn rampa(n: &str) -> [[f32; 3]; 3] { let r = RAMPAS.iter().find(|x| x.0 == n).or(RAMPAS.iter().find(|x| x.0 == "grafito")).unwrap().1; [hex(r[0]), hex(r[1]), hex(r[2])] }

/// idsPiel: tonos de piel de claros a oscuros (rojizos a amarillentos, saturación media, no negros)
pub fn es_piel(r: u8, g: u8, b: u8) -> bool {
    let (r, g, b) = (r as f64, g as f64, b as f64); let mx = r.max(g).max(b); let mn = r.min(g).min(b);
    let v = mx / 255.0; let s = if mx > 0.0 { (mx - mn) / mx } else { 0.0 };
    if v < 0.13 || s < 0.14 || s > 0.82 || r < g || r < b { return false; }
    let h = if mx == mn { 0.0 } else if mx == r { (60.0 * ((g - b) / (mx - mn)) + 360.0) % 360.0 } else { 0.0 };
    h <= 48.0 && r - b > 14.0
}
/// idsTenir: la luminancia (estirada entre el 4 % y el 96 % de lo que se tiñe) elige el color de la rampa y se mezcla con
/// el original un 12 %. `salta(k, r, g, b)`: los que no se tocan; `piso`: lo más oscuro que puede quedar (los retratos)
pub fn tenir(px: &mut [u8], rampa_n: &str, salta: &dyn Fn(usize, u8, u8, u8) -> bool, alfa_min: u8, piso: f64) -> usize {
    let [a, b, c] = rampa(rampa_n); let n = px.len() / 4; let mut hist = [0u32; 256]; let mut sel = vec![false; n]; let mut cuenta = 0usize;
    for k in 0..n { let o = k * 4; if px[o + 3] < alfa_min || salta(k, px[o], px[o + 1], px[o + 2]) { continue; } sel[k] = true; hist[((px[o] as u32 * 77 + px[o + 1] as u32 * 150 + px[o + 2] as u32 * 29) >> 8) as usize] += 1; cuenta += 1; }
    if cuenta == 0 { return 0; }
    let (mut lo, mut hi) = (0i32, 255i32); let mut ac = 0u64;
    for l in 0..256 { ac += hist[l] as u64; if ac as f64 >= cuenta as f64 * 0.04 { lo = l as i32; break; } }
    ac = 0; for l in (0..256).rev() { ac += hist[l] as u64; if ac as f64 >= cuenta as f64 * 0.04 { hi = l as i32; break; } }
    let e = 1.0 / ((hi - lo).max(24) as f64);
    for k in 0..n {
        if !sel[k] { continue; }
        let o = k * 4; let (r, g, bb) = (px[o] as f64, px[o + 1] as f64, px[o + 2] as f64);
        let l = ((px[o] as i32 * 77 + px[o + 1] as i32 * 150 + px[o + 2] as i32 * 29) >> 8) as f64;
        let t0 = ((l - lo as f64) * e).clamp(0.0, 1.0); let t = if piso != 0.0 { piso + (1.0 - piso) * t0 } else { t0 };
        let (p, q, u) = if t < 0.5 { (a, b, t * 2.0) } else { (b, c, t * 2.0 - 1.0) };
        let cc = [p[0] as f64 + (q[0] as f64 - p[0] as f64) * u, p[1] as f64 + (q[1] as f64 - p[1] as f64) * u, p[2] as f64 + (q[2] as f64 - p[2] as f64) * u];
        // (Uint8ClampedArray: redondeo al par más cercano y entre 0 y 255)
        px[o] = clamp_u8(cc[0] * 0.88 + r * 0.12); px[o + 1] = clamp_u8(cc[1] * 0.88 + g * 0.12); px[o + 2] = clamp_u8(cc[2] * 0.88 + bb * 0.12);
    }
    cuenta
}
/// como Uint8ClampedArray: entre 0 y 255, redondeado a lo más cercano (los empates al par)
pub fn clamp_u8(x: f64) -> u8 { if !(x > 0.0) { return 0; } if x >= 255.0 { return 255; } let f = x.floor(); let d = x - f; (if d > 0.5 || (d == 0.5 && f as u32 % 2 == 1) { f + 1.0 } else { f }) as u8 }

/// las texturas a teñir, por su número en el paquete (idsTabla: por el nombre del material, con su textura principal)
pub fn tabla(d: &Value) -> HashMap<usize, (&'static str, TexRopa)> {
    let mut por_nombre: HashMap<&str, (&'static str, TexRopa)> = HashMap::new();
    for s in &SKINS { for (n, t) in s.tex { por_nombre.insert(n, (t.r.unwrap_or(s.r), t.clone())); } }
    let mut tt = HashMap::new();
    if let Some(mt) = d["mt"].as_array() { for x in mt {
        let Some(e) = x["n"].as_str().and_then(|n| por_nombre.get(n)) else { continue };
        let Some(t) = x["t"].as_i64().filter(|&t| t >= 0) else { continue };
        tt.entry(t as usize).or_insert_with(|| e.clone());
    } }
    tt
}
/// teñir una textura del paquete ya lista (RGBA, la fila 0 abajo: dada vuelta como la de WebGL), si es ropa de una skin
/// heredada (idTex). Devuelve si la tiñó
pub fn tenir_textura(tt: &HashMap<usize, (&'static str, TexRopa)>, i: usize, w: u32, h: u32, px: &mut [u8]) -> bool {
    let Some((r, e)) = tt.get(&i) else { return false };
    let (wf, hf) = (w as f32, h as f32);
    let zonas: Vec<[f32; 4]> = e.zonas.iter().map(|z| [z[0] * wf, (1.0 - z[3]) * hf, z[2] * wf, (1.0 - z[1]) * hf]).collect();
    let piel = e.piel; let w = w as usize;
    let salta = move |k: usize, r: u8, g: u8, b: u8| -> bool {
        let (x, y) = ((k % w) as f32, (k / w) as f32);
        for z in &zonas { if x >= z[0] && x < z[2] && y >= z[1] && y < z[3] { return true; } }
        piel && es_piel(r, g, b)
    };
    tenir(px, r, &salta, 8, 0.0); true
}
/// idsSaltaCara: la piel de un retrato es la del color de su cara (el centro del retrato: el tono —la proporción entre
/// rojo, verde y azul— cerca del de la cara, con algo de saturación)
fn salta_cara(px: &[u8], w: usize, h: usize) -> Option<impl Fn(u8, u8, u8) -> bool> {
    let mut l: Vec<[u8; 3]> = vec![];
    let (y0, x0) = ((h as f64 * 0.3).floor() as usize, (w as f64 * 0.38).floor() as usize);
    let mut y = y0; while (y as f64) < h as f64 * 0.55 { let mut x = x0; while (x as f64) < w as f64 * 0.62 { let o = (y * w + x) * 4; if px[o + 3] > 200 { l.push([px[o], px[o + 1], px[o + 2]]); } x += 1; } y += 1; }
    if l.len() < 20 { return None; }
    let med = |i: usize| { let mut v: Vec<u8> = l.iter().map(|c| c[i]).collect(); v.sort(); v[l.len() >> 1] as f64 };
    let (r0, g0, b0) = (med(0), med(1), med(2)); let s0 = { let s = r0 + g0 + b0; if s > 0.0 { s } else { 1.0 } }; let (cr0, cg0) = (r0 / s0, g0 / s0);
    Some(move |r: u8, g: u8, b: u8| { let (r, g, b) = (r as f64, g as f64, b as f64); let s = r + g + b; let mx = r.max(g).max(b);
        if s < 40.0 || s < s0 * 0.3 || s > s0 * 1.9 || (mx - r.min(g).min(b)) < mx * 0.12 { return false; } (r / s - cr0).hypot(g / s - cg0) < 0.06 })
}
/// el retrato teñido de una skin heredada (idsRetratos), en su tamaño (RGBA, la fila 0 arriba); false si no es de ésas
pub fn tenir_retrato(skin: &str, w: usize, h: usize, px: &mut [u8]) -> bool {
    let Some(s) = SKINS.iter().find(|k| k.s == skin) else { return false };
    let cara = salta_cara(px, w, h);
    let y0 = ((h as f64 * s.ret as f64).floor() as usize).min(h); let (cx0, cx1) = (w as f64 * 0.32, w as f64 * 0.68);
    let sub = &mut px[y0 * w * 4..];
    let salta = |k: usize, r: u8, g: u8, b: u8| -> bool { let xx = (k % w) as f64; xx > cx0 && xx < cx1 && match &cara { Some(f) => f(r, g, b), None => es_piel(r, g, b) } };
    tenir(sub, s.r, &salta, 40, 0.3); true
}

// ---------------- la plaza JX ----------------
/// los tonos de la plaza por mapa: el hormigón y el grafito (IDS_TONOS / IDS_HITOS)
pub fn tono_plaza(mapa: &str) -> Option<([f32; 3], [f32; 3])> {
    let t = match mapa { "Desert" | "DesertV2" => "arena", "FlatGrass" | "City" | "Base" | "BaseV2" => "gris", "Mars" => "marte", _ => return None };
    Some(match t { "arena" => ([0.84, 0.76, 0.62], [0.23, 0.18, 0.14]), "marte" => ([0.73, 0.5, 0.42], [0.17, 0.11, 0.1]), _ => ([0.78, 0.77, 0.74], [0.14, 0.155, 0.18]) })
}
/// una caja de choque fija (cajaFija): centro, medios lados y giro
#[derive(Clone, Debug)]
pub struct CajaFija { pub c: V, pub h: V, pub q: Q }
/// la plaza armada: las tres mallas (hormigón, grafito, luz), los triángulos que chocan (9 por triángulo), las cajas que
/// chocan y la luz
pub struct Plaza { pub s: Geo, pub g: Geo, pub a: Geo, pub tris: Vec<f64>, pub cajas: Vec<CajaFija>, pub luz: V }
/// ENT_TIPO.jx_plaza.crear: en `p` (la base) girada `yaw`
pub fn plaza(p: V, yaw: f64) -> Plaza {
    let eq = qeje([0.0, 1.0, 0.0], yaw); let (mut s, mut g, mut a) = (Geo::nueva(), Geo::nueva(), Geo::nueva()); s.parte(); g.parte(); a.parte();
    let mut tris: Vec<f64> = vec![]; let mut cajas = vec![];
    let ew = |x: f64, y: f64, z: f64| -> V { let r = qrot(eq, [x, y, z]); [p[0] + r[0], p[1] + r[1], p[2] + r[2]] };
    let up = qrot(eq, [0.0, 1.0, 0.0]);
    let sub = |a: V, b: V| [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; let esc = |a: V, k: f64| [a[0] * k, a[1] * k, a[2] * k];
    let cruz = |a: V, b: V| [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    let norm = |a: V| { let l = (a[0] * a[0] + a[1] * a[1] + a[2] * a[2]).sqrt(); [a[0] / l, a[1] / l, a[2] / l] };
    let (l, hh, f, rl, rw) = (9.0, 0.45, 1.2, 5.5, 4.0);
    // (una caja en la malla B, con su giro extra; si choca, también una caja fija)
    let caja = |b: &mut Geo, cajas: &mut Vec<CajaFija>, x: f64, y: f64, z: f64, hx: f64, hy: f64, hz: f64, q2: Option<Q>, choca: bool| {
        let c = ew(x, y, z); let q = match q2 { Some(q2) => qmul(eq, q2), None => eq };
        b.caja(0, c, [hx, hy, hz], q, 2.0); if choca { cajas.push(CajaFija { c, h: [hx, hy, hz], q }); }
    };
    // la plataforma: tapa clara y costados de grafito con falda hacia abajo
    let t = [ew(l, hh, l), ew(-l, hh, l), ew(-l, hh, -l), ew(l, hh, -l)];
    s.quad(0, t[0], t[1], t[2], t[3], up, 3.0);
    for i in [0, 1, 2, 0, 2, 3] { tris.extend_from_slice(&t[i]); }
    for k in 0..4 {
        let (pa, pb) = (t[k], t[(k + 1) % 4]); let a2 = sub(pa, esc(up, hh + f)); let b2 = sub(pb, esc(up, hh + f)); let n = norm(cruz(sub(pb, pa), up));
        g.quad(0, a2, b2, pb, pa, esc(n, -1.0), 2.0);
        for v in [a2, b2, pb, a2, pb, pa] { tris.extend_from_slice(&v); }
    }
    // las cuatro rampas (5° de pendiente)
    for k in 0..4 {
        let ang = k as f64 * std::f64::consts::PI / 2.0; let rq = qeje([0.0, 1.0, 0.0], ang);
        let pr = |x: f64, y: f64, z: f64| -> V { let r = qrot(eq, qrot(rq, [x, y, z])); [p[0] + r[0], p[1] + r[1], p[2] + r[2]] };
        let (p0, p1, p2, p3) = (pr(rw, hh, l), pr(-rw, hh, l), pr(-rw, 0.0, l + rl), pr(rw, 0.0, l + rl));
        let nr = qrot(eq, qrot(rq, norm([0.0, rl, hh])));
        s.quad(0, p0, p1, p2, p3, nr, 3.0);
        for v in [p0, p1, p2, p0, p2, p3] { tris.extend_from_slice(&v); }
        for sg in [1.0f64, -1.0] { let (top, bot, fin, pie) = (pr(sg * rw, hh, l), pr(sg * rw, -f, l), pr(sg * rw, -f, l + rl), pr(sg * rw, 0.0, l + rl)); let ns = qrot(eq, qrot(rq, [sg, 0.0, 0.0])); g.tri(0, top, bot, pie, ns); g.tri(0, bot, fin, pie, ns); }
    }
    // el filo amarillo a 0,6 m del borde
    for [x, z, hx, hz] in [[0.0, l - 0.6, l - 0.6, 0.07], [0.0, -(l - 0.6), l - 0.6, 0.07], [l - 0.6, 0.0, 0.07, l - 0.6], [-(l - 0.6), 0.0, 0.07, l - 0.6]] { caja(&mut a, &mut cajas, x, hh + 0.012, z, hx, 0.012, hz, None, false); }
    // el monolito: 4,4 × 16 × 1,6 m, con el «JX» y una costura luminosa en las dos caras
    let (mh, mw, md) = (8.0, 2.2, 0.8);
    caja(&mut g, &mut cajas, 0.0, hh + mh, 0.0, mw, mh, md, None, true); caja(&mut s, &mut cajas, 0.0, hh + mh * 2.0 + 0.2, 0.0, mw + 0.25, 0.2, md + 0.25, None, false);
    for sg in [1.0f64, -1.0] {
        let z = sg * (md + 0.02); let lz = 0.025;
        caja(&mut a, &mut cajas, 0.0, hh + 5.2, z, 0.09, 4.6, lz, None, false);
        caja(&mut a, &mut cajas, -0.7, hh + 12.6, z, 0.16, 1.5, lz, None, false); caja(&mut a, &mut cajas, -1.25, hh + 11.25, z, 0.55, 0.15, lz, None, false); caja(&mut a, &mut cajas, -1.65, hh + 11.6, z, 0.15, 0.4, lz, None, false); caja(&mut a, &mut cajas, -0.95, hh + 14.0, z, 0.55, 0.13, lz, None, false);
        caja(&mut a, &mut cajas, 1.05, hh + 12.6, z, 0.15, 1.75, lz, Some(qeje([0.0, 0.0, 1.0], 0.5)), false); caja(&mut a, &mut cajas, 1.05, hh + 12.6, z, 0.15, 1.75, lz, Some(qeje([0.0, 0.0, 1.0], -0.5)), false);
    }
    // cuatro postes con un farol amarillo
    for [x, z] in [[l - 1.2, l - 1.2], [-(l - 1.2), l - 1.2], [l - 1.2, -(l - 1.2)], [-(l - 1.2), -(l - 1.2)]] { caja(&mut g, &mut cajas, x, hh + 1.6, z, 0.17, 1.6, 0.17, None, true); caja(&mut a, &mut cajas, x, hh + 3.32, z, 0.21, 0.12, 0.21, None, false); }
    // (la luz: entW(e, 0, 1.4, 1.6))
    let luz = ew(0.0, 1.4, 1.6);
    Plaza { s, g, a, tris, cajas, luz }
}
/// idsLugarPlaza: delante de la aparición a 46 m (si ahí no es parejo, a los costados, atrás o más lejos): el piso en 13
/// puntos de su huella tiene que estar a ±0,6 m del centro (piso(x, y, z): la altura del piso más alto debajo de y)
pub fn lugar_plaza(sp: V, yaw: f64, piso: &dyn Fn(f64, f64, f64) -> Option<f64>) -> Option<(V, f64)> {
    for d in [46.0, 60.0, 34.0] { for giro in [0.0, std::f64::consts::FRAC_PI_2, -std::f64::consts::FRAC_PI_2, std::f64::consts::PI] {
        let a = yaw + giro; let c = [sp[0] + a.sin() * d, sp[1] + 30.0, sp[2] + a.cos() * d];
        let Some(y0) = piso(c[0], c[1], c[2]) else { continue }; if (y0 - sp[1]).abs() > 6.0 { continue; }
        let mut bien = true;
        for [dx, dz] in [[0.0, 0.0], [9.0, 9.0], [-9.0, 9.0], [9.0, -9.0], [-9.0, -9.0], [14.0, 0.0], [-14.0, 0.0], [0.0, 14.0], [0.0, -14.0], [5.0, 0.0], [-5.0, 0.0], [0.0, 5.0], [0.0, -5.0]] {
            match piso(c[0] + dx, y0 + 30.0, c[2] + dz) { Some(yy) if (yy - y0).abs() <= 0.6 => {} _ => { bien = false; break; } }
        }
        if bien { return Some(([c[0], y0, c[2]], a)); }
    } }
    None
}
