//! Los modelos de jugador de GMod (juego/gmod_pm.js) como personaje del juego: el jugador o un NPC sigue siendo el Hero por
//! dentro (física, animaciones, emotes, armas, apoyo de los pies, muñeco de trapo), pero no se dibuja: se dibuja el .mdl del
//! addon con su piel y sus materiales, y cada hueso del esqueleto de Valve (ValveBiped.Bip01_*) copia el giro del hueso
//! del Hero que le corresponde (gmpDibujar): giro = (Hero ahora · Hero en reposo⁻¹) · alineación · reposo del .mdl, con
//! la alineación que lleva cada hueso del .mdl a la dirección del mismo hueso del Hero en reposo y todo el esqueleto girado
//! para que la línea de la cadera quede como la del Hero. La cadera va a la altura de la del Hero escalada al largo de
//! las piernas del modelo; manos y pies van con dos huesos (IK) a donde los tiene el Hero (el arma, el volante, el piso),
//! a la escala de sus brazos y piernas. Tirado como muñeco se apoya en el piso (gmpApoyar) y parado lo más bajo de la
//! malla no se hunde (gmpNoHundir). Un modelo sin esqueleto de Valve (un perro, un bicho) se mueve con sus propias
//! secuencias por actividad (gmpPropio). Lo de la lista de modelos (gmpLista, con los rig automáticos de
//! gmod_autorig.rs) y el arma en la mano de un modelo de otras medidas (armaGmp) también.
use super::gmod_modelos::ModeloGm;
use super::*;
use jxgmod::formatos as gmf;
use jxjuego::personaje::Personaje;
use jxmotor::escena::ItemDin;
use std::cell::RefCell;

type V = [f32; 3];
type Q = [f32; 4];
const GS: f32 = 0.0254;

// ---------------- cuentas ----------------
fn sub(a: V, b: V) -> V { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
fn add(a: V, b: V) -> V { [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
fn esc(a: V, s: f32) -> V { [a[0] * s, a[1] * s, a[2] * s] }
fn dot(a: V, b: V) -> f32 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
fn cruz(a: V, b: V) -> V { [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
fn largo(a: V) -> f32 { dot(a, a).sqrt() }
fn norm(a: V) -> V { let l = largo(a); if l > 1e-12 { esc(a, 1.0 / l) } else { a } }
pub(crate) fn qmul(a: Q, b: Q) -> Q {
    [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
     a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]
}
pub(crate) fn qnorm(q: Q) -> Q { let l = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt(); let l = if l == 0.0 { 1.0 } else { l }; [q[0] / l, q[1] / l, q[2] / l, q[3] / l] }
pub(crate) fn qconj(q: Q) -> Q { [-q[0], -q[1], -q[2], q[3]] }
pub(crate) fn qrot(q: Q, v: V) -> V {
    let (qx, qy, qz, qw) = (q[0], q[1], q[2], q[3]);
    let (tx, ty, tz) = (2.0 * (qy * v[2] - qz * v[1]), 2.0 * (qz * v[0] - qx * v[2]), 2.0 * (qx * v[1] - qy * v[0]));
    [v[0] + qw * tx + qy * tz - qz * ty, v[1] + qw * ty + qz * tx - qx * tz, v[2] + qw * tz + qx * ty - qy * tx]
}
fn qeje(e: V, ang: f32) -> Q { let s = (ang / 2.0).sin(); let l = largo(e); let l = if l == 0.0 { 1.0 } else { l }; [e[0] / l * s, e[1] / l * s, e[2] / l * s, (ang / 2.0).cos()] }
/// m4quat de modelo.js: el giro de una matriz sin su escala
pub(crate) fn m4quat(m: &M4) -> Q {
    let sx = (m[0] * m[0] + m[1] * m[1] + m[2] * m[2]).sqrt(); let sy = (m[4] * m[4] + m[5] * m[5] + m[6] * m[6]).sqrt(); let sz = (m[8] * m[8] + m[9] * m[9] + m[10] * m[10]).sqrt();
    let (a, b, c, d, e, f, g, h, k) = (m[0] / sx, m[1] / sx, m[2] / sx, m[4] / sy, m[5] / sy, m[6] / sy, m[8] / sz, m[9] / sz, m[10] / sz);
    let t = a + e + k;
    let q = if t > 0.0 { let s = (t + 1.0).sqrt() * 2.0; [(f - h) / s, (g - c) / s, (b - d) / s, 0.25 * s] }
        else if a > e && a > k { let s = (1.0 + a - e - k).sqrt() * 2.0; [0.25 * s, (d + b) / s, (g + c) / s, (f - h) / s] }
        else if e > k { let s = (1.0 + e - a - k).sqrt() * 2.0; [(d + b) / s, 0.25 * s, (h + f) / s, (g - c) / s] }
        else { let s = (1.0 + k - a - e).sqrt() * 2.0; [(g + c) / s, (h + f) / s, 0.25 * s, (b - d) / s] };
    qnorm(q)
}
/// rotEntre: el giro más corto que lleva la dirección a hacia la b
fn rot_entre(a: V, b: V) -> Q {
    let (la, lb) = (largo(a), largo(b)); if la < 1e-6 || lb < 1e-6 { return [0.0, 0.0, 0.0, 1.0]; }
    let c = cruz(a, b); let s = largo(c) / (la * lb); let d = dot(a, b) / (la * lb);
    if s < 1e-7 { return [0.0, 0.0, 0.0, 1.0]; }
    qeje(c, s.atan2(d))
}
fn pos(m: &M4) -> V { [m[12], m[13], m[14]] }
/// m4trs (columnas)
pub(crate) fn trs(p: V, r: Q, s: f32) -> M4 {
    let (x, y, z, w) = (r[0], r[1], r[2], r[3]);
    [(1.0 - 2.0 * (y * y + z * z)) * s, 2.0 * (x * y + z * w) * s, 2.0 * (x * z - y * w) * s, 0.0,
     2.0 * (x * y - z * w) * s, (1.0 - 2.0 * (x * x + z * z)) * s, 2.0 * (y * z + x * w) * s, 0.0,
     2.0 * (x * z + y * w) * s, 2.0 * (y * z - x * w) * s, (1.0 - 2.0 * (x * x + y * y)) * s, 0.0,
     p[0], p[1], p[2], 1.0]
}
/// Source (x adelante, y izquierda, z arriba, pulgadas) → el juego (y, z, x; metros): pv y rot de gmpDef
pub(crate) fn pv(p: [f32; 3]) -> V { [p[1] * GS, p[2] * GS, p[0] * GS] }
pub(crate) fn rot_src(q: [f32; 4]) -> Q { [q[1], q[2], q[0], q[3]] }
/// una matriz 3×4 de Source (filas) → M4 del juego (columnas): C·R·Cᵀ y la posición en metros
pub(crate) fn m34_juego(s: &[f32; 12]) -> M4 {
    const P: [usize; 3] = [1, 2, 0]; let mut o = [0.0f32; 16];
    for r in 0..3 { for c in 0..3 { o[c * 4 + r] = s[P[r] * 4 + P[c]]; } o[12 + r] = s[P[r] * 4 + 3] * GS; }
    o[15] = 1.0; o
}

// ---------------- el esqueleto de Valve y el del Hero ----------------
/// ValveBiped.Bip01_<x> → el hueso del Hero (GMP_VB)
fn vb_mix(x: &str) -> Option<String> {
    let x = x.to_lowercase();
    let f = match x.as_str() { "pelvis" => "Hips", "spine" => "Spine", "spine1" => "Spine1", "spine2" | "spine4" => "Spine2", "neck1" => "Neck", "head1" => "Head", _ => "" };
    if !f.is_empty() { return Some(f.into()); }
    let (l, r) = x.split_once('_')?; let lado = match l { "l" => "Left", "r" => "Right", _ => return None };
    let p = match r { "clavicle" => "Shoulder", "upperarm" => "Arm", "forearm" => "ForeArm", "hand" => "Hand", "thigh" => "UpLeg", "calf" => "Leg", "foot" => "Foot", "toe0" => "ToeBase", _ => "" };
    if !p.is_empty() { return Some(format!("{lado}{p}")); }
    let d = r.strip_prefix("finger")?; let (k, s) = d.split_at(1); let k: usize = k.parse().ok()?;
    let dedo = ["Thumb", "Index", "Middle", "Ring", "Pinky"].get(k)?; let n = match s { "" => 1, "1" => 2, "2" => 3, _ => return None };
    Some(format!("{lado}Hand{dedo}{n}"))
}
/// el hueso que sigue (la punta) de cada hueso del Hero (GMP_PUNTA)
fn punta_de(m: &str) -> Option<String> {
    let f = match m { "Hips" => "Spine", "Spine" => "Spine1", "Spine1" => "Spine2", "Spine2" => "Neck", "Neck" => "Head", _ => "" };
    if !f.is_empty() { return Some(f.into()); }
    for l in ["Left", "Right"] {
        let Some(r) = m.strip_prefix(l) else { continue };
        let p = match r { "Shoulder" => "Arm", "Arm" => "ForeArm", "ForeArm" => "Hand", "Hand" => "HandMiddle1", "UpLeg" => "Leg", "Leg" => "Foot", "Foot" => "ToeBase", _ => "" };
        if !p.is_empty() { return Some(format!("{l}{p}")); }
        for d in ["Thumb", "Index", "Middle", "Ring", "Pinky"] { if let Some(n) = r.strip_prefix("Hand").and_then(|x| x.strip_prefix(d)) { return match n { "1" => Some(format!("{l}Hand{d}2")), "2" => Some(format!("{l}Hand{d}3")), _ => None }; } }
    }
    None
}

/// lo del Hero en reposo que hace falta (datosSkin: sub, h, rw, rp, tobillo y la escala de reposo de cada nodo)
pub struct HeroD { pub nombres: Vec<String>, pub por_nom: HashMap<String, usize>, pub rp: Vec<V>, pub rw: Vec<Q>, pub esc: Vec<f32>, pub tobillo: f32 }
impl HeroD {
    pub fn de(pj: &Personaje) -> HeroD {
        let (nombres, _, _) = pj.esqueleto(); let w = pj.reposo_mundo();
        let mut por_nom = HashMap::new();
        for (i, n) in nombres.iter().enumerate() { if let Some(r) = n.strip_prefix("mixamorig") { let r = r.trim_start_matches(|c: char| c.is_ascii_digit()); if let Some(x) = r.strip_prefix(':') { por_nom.entry(x.to_string()).or_insert(i); } } }
        HeroD { nombres: nombres.to_vec(), por_nom, rp: w.iter().map(pos).collect(), rw: (0..w.len()).map(|i| pj.giro_reposo(i)).collect(), esc: w.iter().map(|m| { let s = (m[0] * m[0] + m[1] * m[1] + m[2] * m[2]).sqrt(); if s > 0.0 { s } else { 1.0 } }).collect(), tobillo: pj.tobillo() }
    }
    fn h(&self, n: &str) -> Option<usize> { self.por_nom.get(n).copied() }
}

/// las secuencias de un modelo sin esqueleto de Valve, por actividad (calcSecs): quieto, camina, corre, agachado, salta
#[derive(Clone, Copy, Debug)]
pub struct Secs { pub quieto: i32, pub camina: i32, pub corre: i32, pub agachado: i32, pub salta: i32 }

/// el .mdl armado (gmpDef): los nodos (0 la raíz, 1 + h cada hueso) en los ejes del juego y en metros, su reposo, qué hueso
/// del Hero es cada uno, lo más bajo de la malla en reposo y, sin esqueleto de Valve, sus secuencias
pub struct DefPm {
    pub ruta: String, pub nb: usize, pub pa: Vec<i32>, pub lp: Vec<V>, pub lr: Vec<Q>,
    pub rest_q: Vec<Q>, pub rest_p: Vec<V>, pub mix: Vec<Option<String>>, pub por_mix: HashMap<String, usize>, pub piso: f32,
    pub secs: Option<Secs>,
    /// la pose de enlace de cada hueso (pose→hueso en el juego) y la malla con piel
    pub enlace: Vec<M4>, pub modelo: Rc<ModeloGm>,
    /// el .mdl (sus huesos con su rig automático, si lo tiene) y el de los addons (para las secuencias propias)
    pub mdl: Rc<gmf::Mdl>, pub gm: Option<Rc<jxgmod::modelos::Modelo>>,
    /// lo que ocupa la malla alrededor de cada hueso (gmpPuntos: puntos en los ejes del hueso) y los huesos de abajo
    puntos: RefCell<Option<(Vec<Vec<V>>, Vec<usize>)>>,
    /// el alto de la malla en reposo (para la esfera)
    pub alto: f32,
}
impl DefPm {
    /// gmpDef (sin la malla: la pone quien llama)
    pub fn armar(ruta: &str, mdl: Rc<gmf::Mdl>, modelo: Rc<ModeloGm>, gm: Option<Rc<jxgmod::modelos::Modelo>>) -> Option<DefPm> {
        let h = &mdl.huesos; let nb = h.len(); if nb == 0 { return None; }
        let mut pa = vec![-1i32]; let mut lp = vec![[0.0f32; 3]]; let mut lr = vec![[0.0f32, 0.0, 0.0, 1.0]];
        for x in h { pa.push(if x.pa >= 0 && (x.pa as usize) < nb { 1 + x.pa } else { 0 }); lp.push(pv(x.pos)); lr.push(rot_src(x.q)); }
        // (el reposo: md.actualizar con la raíz en el origen)
        let mut wq = vec![[0.0f32, 0.0, 0.0, 1.0]; nb + 1]; let mut wp = vec![[0.0f32; 3]; nb + 1];
        for i in 1..=nb { let p = pa[i] as usize; wq[i] = qnorm(qmul(wq[p], lr[i])); wp[i] = add(wp[p], qrot(wq[p], lp[i])); }
        let mix: Vec<Option<String>> = (0..=nb).map(|i| if i == 0 { None } else { let n = h[i - 1].n.to_lowercase(); n.strip_prefix("valvebiped.bip01_").and_then(vb_mix) }).collect();
        let mut por_mix = HashMap::new(); for (i, m) in mix.iter().enumerate() { if let Some(m) = m { por_mix.entry(m.clone()).or_insert(i); } }
        // (lo más bajo de la malla en reposo: los pies; la cadera se pone a esa altura sobre el piso)
        let (mut piso, mut techo) = (f32::INFINITY, f32::NEG_INFINITY);
        if let Some(v) = &mdl.v { for mm in mdl.mallas.iter().filter(|m| m.modelo == 0) { for &k in &mm.tris { let y = v.pos[k as usize][2] * GS; piso = piso.min(y); techo = techo.max(y); } } }
        if !piso.is_finite() { piso = 0.0; techo = 1.8; }
        let enlace: Vec<M4> = h.iter().map(|x| m34_juego(&x.p2b)).collect();
        let secs = if por_mix.contains_key("Hips") { None } else { Some(calc_secs(&mdl)) };
        Some(DefPm { ruta: ruta.to_string(), nb, pa, lp, lr, rest_q: wq, rest_p: wp, mix, por_mix, piso, secs, enlace, modelo, mdl, gm, puntos: RefCell::new(None), alto: (techo - piso).max(0.1) })
    }
    fn m(&self, n: &str) -> Option<usize> { self.por_mix.get(n).copied() }
    /// gmpPuntos: de los vértices que dependen sobre todo de cada hueso, los de más afuera en 98 direcciones (en los ejes
    /// del hueso); y los huesos que llegan al tercio de abajo de la malla en reposo
    fn con_puntos<R>(&self, f: impl FnOnce(&[Vec<V>], &[usize]) -> R) -> R {
        if self.puntos.borrow().is_none() {
            let mut dirs = vec![]; for x in -2i32..=2 { for y in -2i32..=2 { for z in -2i32..=2 { if x.abs().max(y.abs()).max(z.abs()) == 2 { dirs.push([x as f32, y as f32, z as f32]); } } } }
            let hs = &self.mdl.huesos; let mut best: Vec<Option<Vec<(f32, V)>>> = vec![None; hs.len()];
            if let Some(v) = &self.mdl.v {
                for k in 0..v.n {
                    let (mut b, mut bw) = (v.hb[k][0] as usize, v.w[k][0]); for j in 1..3 { if v.w[k][j] > bw { bw = v.w[k][j]; b = v.hb[k][j] as usize; } }
                    let Some(hh) = hs.get(b) else { continue }; let m = &hh.p2b; let x = v.pos[k];
                    let p = pv([m[0] * x[0] + m[1] * x[1] + m[2] * x[2] + m[3], m[4] * x[0] + m[5] * x[1] + m[6] * x[2] + m[7], m[8] * x[0] + m[9] * x[1] + m[10] * x[2] + m[11]]);
                    let bb = best[b].get_or_insert_with(|| vec![(f32::NEG_INFINITY, [0.0; 3]); dirs.len()]);
                    for (d, dd) in dirs.iter().enumerate() { let s = dot(*dd, p); if s > bb[d].0 { bb[d] = (s, p); } }
                }
            }
            let puntos: Vec<Vec<V>> = best.into_iter().map(|b| { let mut l: Vec<V> = vec![]; if let Some(b) = b { for (s, p) in b { if s.is_finite() && !l.contains(&p) { l.push(p); } } } l }).collect();
            let ys: Vec<Option<(f32, f32)>> = puntos.iter().enumerate().map(|(b, c)| { if c.is_empty() { return None; } let (mut mn, mut mx) = (f32::INFINITY, f32::NEG_INFINITY); for p in c { let y = qrot(self.rest_q[1 + b], *p)[1] + self.rest_p[1 + b][1]; mn = mn.min(y); mx = mx.max(y); } Some((mn, mx)) }).collect();
            let (mut y0, mut y1) = (f32::INFINITY, f32::NEG_INFINITY); for r in ys.iter().flatten() { y0 = y0.min(r.0); y1 = y1.max(r.1); }
            let bajos: Vec<usize> = ys.iter().enumerate().filter_map(|(b, r)| r.filter(|r| r.0 < y0 + 0.35 * (y1 - y0)).map(|_| b)).collect();
            *self.puntos.borrow_mut() = Some((puntos, bajos));
        }
        let p = self.puntos.borrow(); let (a, b) = p.as_ref().unwrap(); f(a, b)
    }
}
/// las secuencias por actividad de un modelo sin esqueleto de Valve (calcSecs); -1: no tiene
fn calc_secs(m: &gmf::Mdl) -> Secs {
    let busca = |acts: &[&str], re: &[&str], mov: bool| -> i32 {
        let mut i = m.secuencias.iter().position(|q| acts.contains(&q.act.to_uppercase().as_str()));
        if i.is_none() { i = m.secuencias.iter().position(|q| { let n = q.n.to_lowercase(); re.iter().any(|r| n.contains(r)) }); }
        let Some(i) = i else { return -1 };
        let vals = |k: &str| if !mov { None } else if k == "move_x" { Some(1.0) } else if k == "move_y" { Some(0.0) } else { None };
        let ia = gmf::anim_de(m, i, &vals); if ia < 0 { return -1; }
        match m.anims.get(ia as usize) { Some(a) if a.nf > 0 && (a.bloque == 0 || a.src.is_some() || m.bloques.get(a.bloque as usize).is_some()) => ia, _ => -1 }
    };
    Secs { quieto: busca(&["ACT_MP_STAND_IDLE", "ACT_HL2MP_IDLE", "ACT_IDLE"], &["idle", "stand"], false), camina: busca(&["ACT_MP_WALK", "ACT_HL2MP_WALK", "ACT_WALK"], &["walk"], true),
        corre: busca(&["ACT_MP_RUN", "ACT_HL2MP_RUN", "ACT_RUN"], &["run"], true), agachado: busca(&["ACT_MP_CROUCH_IDLE", "ACT_HL2MP_IDLE_CROUCH", "ACT_CROUCHIDLE"], &["crouch", "duck"], false),
        salta: busca(&["ACT_MP_JUMP", "ACT_HL2MP_JUMP", "ACT_JUMP"], &["jump"], false) }
}

/// lo de cada personaje con un modelo de GMod (gmpPreparar y lo que se lleva de un cuadro al otro)
pub struct PrepPm {
    pub def: Rc<DefPm>,
    hero: Vec<i32>, alin: Vec<Option<Q>>, esc: HashMap<&'static str, f32>, otra_esc: bool, rest_q: Vec<Q>, k: f32,
    q: Vec<Q>, pw: Vec<V>, s: Vec<f32>, bajar: f32,
    /// el arma en la mano derecha (G.armaD): la mano del Hero, la del modelo y la escala
    pub arma_d: Option<(V, V, f32)>,
    /// lejos (menos del 15 % del alto de la pantalla: sin IK)
    pub lejos: bool,
    // (las secuencias propias)
    t: f32, sec: i32,
}
impl PrepPm {
    /// gmpPreparar
    pub fn de(def: Rc<DefPm>, d: &HeroD) -> Option<PrepPm> {
        let n = def.nb + 1;
        let vacio = |def: Rc<DefPm>| PrepPm { def, hero: vec![], alin: vec![], esc: HashMap::new(), otra_esc: false, rest_q: vec![], k: 1.0, q: vec![[0.0, 0.0, 0.0, 1.0]; n], pw: vec![[0.0; 3]; n], s: vec![1.0; n], bajar: 0.0, arma_d: None, lejos: false, t: 0.0, sec: -1 };
        if def.secs.is_some() { return Some(vacio(def)); }
        let hips_h = d.h("Hips")?;
        // (los modelos de GMod miran para otro lado que el Hero en reposo: se gira todo el esqueleto para que la línea de la
        // cadera quede como la del Hero)
        let mut th = 0.0f32;
        if let (Some(ml), Some(mr), Some(hl), Some(hr)) = (def.m("LeftUpLeg"), def.m("RightUpLeg"), d.h("LeftUpLeg"), d.h("RightUpLeg")) {
            let yw = |a: V, b: V| (b[0] - a[0]).atan2(b[2] - a[2]); th = yw(d.rp[hl], d.rp[hr]) - yw(def.rest_p[ml], def.rest_p[mr]);
        }
        let ry = [0.0, (th / 2.0).sin(), 0.0, (th / 2.0).cos()];
        let rest_q: Vec<Q> = def.rest_q.iter().map(|q| qnorm(qmul(ry, *q))).collect(); let rest_p: Vec<V> = def.rest_p.iter().map(|p| qrot(ry, *p)).collect();
        let mut hero = vec![-1i32; n]; let mut alin: Vec<Option<Q>> = vec![None; n];
        for i in 0..n {
            let Some(m) = def.mix[i].as_deref() else { continue }; let Some(h) = d.h(m) else { continue }; hero[i] = h as i32;
            let Some(pm) = punta_de(m) else { continue }; let (Some(g_t), Some(h_t)) = (def.m(&pm), d.h(&pm)) else { continue };
            if m == "Hips" { continue; }
            let dg = sub(rest_p[g_t], rest_p[i]); let dh = sub(d.rp[h_t], d.rp[h]);
            if largo(dg) > 1e-4 && largo(dh) > 1e-4 { alin[i] = Some(rot_entre(dg, dh)); }
        }
        let hips_hy = d.rp[hips_h][1].max(0.1); let hips_g = (def.rest_p[def.m("Hips")?][1] - def.piso).max(0.1);
        let largo3 = |p2: &[V], a: Option<usize>, b: Option<usize>, c: Option<usize>| match (a, b, c) { (Some(a), Some(b), Some(c)) => largo(sub(p2[b], p2[a])) + largo(sub(p2[c], p2[b])), _ => 0.0 };
        let mut esc = HashMap::new();
        for l in ["Left", "Right"] { for (k, x, y, z) in [("b", "Arm", "ForeArm", "Hand"), ("p", "UpLeg", "Leg", "Foot")] {
            let g = largo3(&def.rest_p, def.m(&format!("{l}{x}")), def.m(&format!("{l}{y}")), def.m(&format!("{l}{z}")));
            let h = largo3(&d.rp, d.h(&format!("{l}{x}")), d.h(&format!("{l}{y}")), d.h(&format!("{l}{z}")));
            let clave: &'static str = match (k, l) { ("b", "Left") => "bLeft", ("b", _) => "bRight", ("p", "Left") => "pLeft", _ => "pRight" };
            esc.insert(clave, if g > 0.0 && h > 0.0 { g / h } else { 1.0 });
        } }
        let otra_esc = ((esc["pLeft"] + esc["pRight"]) / 2.0 - 1.0).abs() > 0.25;
        let mut p = vacio(def.clone()); p.hero = hero; p.alin = alin; p.esc = esc; p.otra_esc = otra_esc; p.rest_q = rest_q; p.k = hips_g / hips_hy;
        Some(p)
    }
    pub fn propio(&self) -> bool { self.def.secs.is_some() }
    /// la escala de los brazos / las piernas de cada lado
    fn e(&self, k: &str) -> f32 { self.esc.get(k).copied().unwrap_or(1.0) }
}

/// lo que el cuerpo hace en este cuadro (lo que gmpDibujar lee de P)
#[derive(Clone, Copy, Default)]
pub struct Hace { pub rag: bool, pub suelo: bool, pub sentado: bool, pub agachado: bool, pub armado: bool, pub vel: V, pub dt: f32 }

/// gmpIK: dos huesos (a → b → c) para que la punta llegue a T, doblando hacia el polo (o en el plano en que ya estaban)
fn ik(g: &mut PrepPm, a: usize, b: usize, c: usize, t: V, polo: Option<V>) {
    let (pa, pb, pc) = (g.pw[a], g.pw[b], g.pw[c]); let (lab, lbc) = (largo(sub(pb, pa)), largo(sub(pc, pb))); if lab < 1e-4 || lbc < 1e-4 { return; }
    let at = sub(t, pa); let lt = (lab + lbc - 1e-4).min(((lab - lbc).abs() + 1e-4).max(largo(at))); if largo(at) < 1e-5 { return; }
    let d = esc(at, 1.0 / largo(at)); let ab = sub(pb, pa); let mut n = sub(ab, esc(d, dot(ab, d)));
    if let Some(p) = polo { let np = sub(p, esc(d, dot(p, d))); if largo(np) > 1e-4 { n = np; } }
    if largo(n) < 1e-5 { let ac = sub(pc, pa); n = sub(ac, esc(d, dot(ac, d))); if largo(n) < 1e-5 { return; } }
    n = esc(n, 1.0 / largo(n));
    let ca = ((lab * lab + lt * lt - lbc * lbc) / (2.0 * lab * lt)).clamp(-1.0, 1.0); let sa = (1.0 - ca * ca).sqrt();
    let b2 = add(pa, add(esc(d, lab * ca), esc(n, lab * sa))); let t2 = add(pa, esc(d, lt));
    let r1 = rot_entre(ab, sub(b2, pa)); g.q[a] = qnorm(qmul(r1, g.q[a]));
    let bc1 = qrot(r1, sub(pc, pb)); let r2 = rot_entre(bc1, sub(t2, b2)); g.q[b] = qnorm(qmul(qmul(r2, r1), g.q[b]));
}

/// gmpDibujar: el .mdl en la pose del Hero de este cuadro. `hw`: las matrices del Hero en el mundo; `raiz`: la del Hero
/// (con el ajuste de los pies). Devuelve las matrices de cada nodo del .mdl en el mundo
pub fn posar(g: &mut PrepPm, d: &HeroD, hw: &[M4], raiz: &M4, hace: &Hace, mundo: Option<&jxjuego::mundo::Mundo>, rag_piso: Option<f32>) -> Vec<M4> {
    let def = g.def.clone(); let nb = def.nb; let rag = hace.rag;
    let rq = m4quat(raiz); let rp = pos(raiz);
    g.q[0] = rq; g.pw[0] = rp; g.s[0] = 1.0; g.bajar = 0.0; g.arma_d = None;
    let hm = |n: &str| d.h(n);
    let hp = |n: &str| d.h(n).and_then(|k| hw.get(k)).map(pos);
    // (1) los giros de los huesos del esqueleto: (Hero ahora · Hero en reposo⁻¹) · alineación · reposo del .mdl
    for i in 1..=nb {
        let h = g.hero[i]; if h < 0 { continue; } let h = h as usize; let Some(w) = hw.get(h) else { continue };
        let mut q = qmul(m4quat(w), qconj(d.rw[h])); if let Some(a) = g.alin[i] { q = qmul(q, a); } g.q[i] = qnorm(qmul(q, g.rest_q[i]));
        g.s[i] = (w[0] * w[0] + w[1] * w[1] + w[2] * w[2]).sqrt() / d.esc[h];
    }
    // (2) los demás giros y todas las posiciones, de la raíz a las puntas
    let hips_m = def.m("Hips");
    let posar_ = |g: &mut PrepPm| {
        for i in 1..=nb {
            let pa = def.pa[i] as usize; let h = g.hero[i];
            if h < 0 { g.q[i] = qnorm(qmul(g.q[pa], def.lr[i])); g.s[i] = g.s[pa]; }
            if Some(i) == hips_m && h >= 0 {
                let w = &hw[h as usize]; let k = g.k; let pi = rp[1];
                g.pw[i] = if rag { pos(w) } else { [rp[0] + (w[12] - rp[0]) * k, pi + (w[13] - pi) * k, rp[2] + (w[14] - rp[2]) * k] };
                if g.bajar != 0.0 { g.pw[i][1] -= g.bajar; }
            } else { let l = def.lp[i]; g.pw[i] = add(g.pw[pa], qrot(g.q[pa], esc(l, g.s[pa]))); }
        }
    };
    posar_(g);
    let cerca = !g.lejos && !rag;
    // (si las piernas del modelo no llegan a los tobillos del Hero, la cadera baja lo que falta: que pise, no que flote)
    if cerca {
        let mut falta = 0.0f32;
        for l in ["Left", "Right"] {
            let (Some(ua), Some(ub), Some(uc), Some(hf)) = (def.m(&format!("{l}UpLeg")), def.m(&format!("{l}Leg")), def.m(&format!("{l}Foot")), hm(&format!("{l}Foot"))) else { continue };
            let lg = largo(sub(g.pw[ub], g.pw[ua])) + largo(sub(g.pw[uc], g.pw[ub])); let sube = (def.rest_p[uc][1] - def.piso) - d.tobillo;
            let mut t = [hw[hf][12], hw[hf][13] + sube, hw[hf][14]];
            if g.otra_esc { if let Some(hu) = hp(&format!("{l}UpLeg")) { t = add(g.pw[ua], esc(sub(t, hu), g.e(&format!("p{l}")))); } }
            falta = falta.max(largo(sub(t, g.pw[ua])) - lg * 0.995);
        }
        if falta > 0.0 { g.bajar = falta; posar_(g); } else { g.bajar = 0.0; }
    }
    // (3) manos y pies donde los tiene el Hero: las muñecas a las del Hero (a la escala de los brazos del modelo) y los
    // tobillos a los del Hero corridos lo que cambia la altura del tobillo sobre la suela
    let mut hubo_ik = false;
    if cerca {
        let (ci, cd) = (hp("LeftUpLeg"), hp("RightUpLeg"));
        let mut der = match (ci, cd) { (Some(a), Some(b)) => [b[0] - a[0], 0.0, b[2] - a[2]], _ => [0.0; 3] };
        der = if largo(der) > 1e-4 { norm(der) } else { norm([-raiz[10], 0.0, raiz[8]]) };
        let fw = [der[2], 0.0, -der[0]];
        let polo = |a: Option<V>, b: Option<V>, c: Option<V>, def0: V| -> V {
            let (Some(a), Some(b), Some(c)) = (a, b, c) else { return def0 }; let u = sub(c, a); let l = largo(u); if l < 1e-4 { return def0; }
            let un = esc(u, 1.0 / l); let ab = sub(b, a); let pp = sub(ab, esc(un, dot(ab, un))); if largo(pp) > l * 0.02 { norm(pp) } else { def0 }
        };
        let mut tr: Option<V> = None;
        for l in ["Right", "Left"] {
            let (a, b, c) = (def.m(&format!("{l}Arm")), def.m(&format!("{l}ForeArm")), def.m(&format!("{l}Hand")));
            let (hs, he, hwr) = (hp(&format!("{l}Arm")), hp(&format!("{l}ForeArm")), hp(&format!("{l}Hand")));
            if let (Some(a), Some(b), Some(c), Some(hw_), Some(hs_)) = (a, b, c, hwr, hs) {
                let eb = g.e(&format!("b{l}"));
                let t = if hace.armado && l == "Right" {
                    let t = add(g.pw[a], esc(sub(hw_, hs_), g.e("bRight"))); g.arma_d = Some((hw_, t, g.k.clamp(0.45, 1.6))); t
                } else if hace.armado && tr.is_some() {
                    let hr = hp("RightHand"); let s = g.arma_d.map(|x| x.2).unwrap_or(1.0);
                    match hr { Some(hr) if largo(sub(hw_, hr)) < 0.45 => add(tr.unwrap(), esc(sub(hw_, hr), s)), _ => add(g.pw[a], esc(sub(hw_, hs_), eb)) }
                } else { add(g.pw[a], esc(sub(hw_, hs_), eb)) };
                ik(g, a, b, c, t, Some(polo(hs, he, hwr, norm(add(esc(fw, -0.7), [0.0, -0.7, 0.0]))))); hubo_ik = true; if l == "Right" { tr = Some(t); }
            }
            let (ua, ub, uc, hf) = (def.m(&format!("{l}UpLeg")), def.m(&format!("{l}Leg")), def.m(&format!("{l}Foot")), hm(&format!("{l}Foot")));
            if let (Some(ua), Some(ub), Some(uc), Some(hf)) = (ua, ub, uc, hf) {
                let dq = qmul(m4quat(&hw[hf]), qconj(d.rw[hf])); let sube = (def.rest_p[uc][1] - def.piso) - d.tobillo; let hu = hp(&format!("{l}UpLeg"));
                let mut t = add(pos(&hw[hf]), qrot(dq, [0.0, sube, 0.0]));
                if let (Some(hu), true) = (hu, g.otra_esc) { t = add(g.pw[ua], esc(sub(t, hu), g.e(&format!("p{l}")))); }
                else if let Some(hu) = hu { let lat = dot(sub(g.pw[ua], hu), der); t = add(t, esc(der, lat)); }
                ik(g, ua, ub, uc, t, Some(polo(hu, hp(&format!("{l}Leg")), hp(&format!("{l}Foot")), fw))); hubo_ik = true;
            }
        }
    }
    if hubo_ik { posar_(g); }
    if rag { apoyar(g, rag_piso); } else if cerca && g.otra_esc && hace.suelo && !hace.sentado { no_hundir(g, rp[1]); }
    let _ = mundo;
    if let (Some(ad), Some(rh)) = (g.arma_d.as_mut(), def.m("RightHand")) { ad.1 = g.pw[rh]; }
    (0..=nb).map(|i| if i == 0 { *raiz } else { trs(g.pw[i], g.q[i], if g.s[i] < 0.02 { 0.0001 } else { g.s[i] }) }).collect()
}
/// gmpNoHundir: parado, lo más bajo de la malla (salvo los pies, que pone la IK) no queda debajo de donde pisa el Hero
fn no_hundir(g: &mut PrepPm, piso: f32) {
    let def = g.def.clone(); let pies: Vec<usize> = ["LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase"].iter().filter_map(|n| def.m(n)).collect();
    let (bajo, cual) = def.con_puntos(|c, bajos| {
        let (mut bajo, mut cual) = (f32::INFINITY, usize::MAX);
        for &b in bajos { let i = 1 + b; let (q, s, y0) = (g.q[i], g.s[i], g.pw[i][1]); for p in &c[b] { let y = qrot(q, esc(*p, s))[1] + y0; if y < bajo { bajo = y; cual = i; } } }
        (bajo, cual)
    });
    let d = if bajo < piso - 0.005 && !pies.contains(&cual) { piso - bajo } else { 0.0 };
    if d > 0.0 { for i in 1..=def.nb { g.pw[i][1] += d; } }
}
/// gmpApoyar: el muñeco con un modelo de otras medidas, apoyado donde se apoya el del Hero (lo más bajo de la malla a la
/// altura de lo más bajo de los cuerpos del muñeco, y nunca debajo del piso)
fn apoyar(g: &mut PrepPm, piso: Option<f32>) {
    let Some(piso) = piso else { return }; let def = g.def.clone();
    let bajo = def.con_puntos(|c, _| { let mut bajo = f32::INFINITY; for i in 1..=def.nb { let Some(pc) = c.get(i - 1) else { continue }; let (q, s, y0) = (g.q[i], g.s[i], g.pw[i][1]); for p in pc { bajo = bajo.min(qrot(q, esc(*p, s))[1] + y0); } } bajo });
    if !bajo.is_finite() { return; }
    let d = piso - bajo; for i in 1..=def.nb { g.pw[i][1] += d; }
}

/// armaGmp: la matriz del arma (en el mundo) corrida de la mano del Hero a la del modelo y escalada con el personaje
pub fn arma_gmp(g: &PrepPm, m: &M4) -> M4 {
    let Some((hero, pm, s)) = g.arma_d else { return *m };
    let a = [s, 0.0, 0.0, 0.0, 0.0, s, 0.0, 0.0, 0.0, 0.0, s, 0.0, pm[0] - s * hero[0], pm[1] - s * hero[1], pm[2] - s * hero[2], 1.0];
    m4::mul(&a, m)
}

/// lo que se dibuja del .mdl con las matrices de sus nodos en el mundo (cada grupo de su malla con piel)
pub fn items(def: &DefPm, w: &[M4], out: &mut Vec<ItemDin>) {
    let Some(gr) = &def.modelo.piel else { return };
    for g in gr {
        let mut h = Vec::with_capacity(g.huesos.len() * 12); let (mut c, mut n) = ([0.0f32; 3], 0.0f32);
        for &b in &g.huesos {
            let (Some(wb), Some(e)) = (w.get(1 + b), def.enlace.get(b)) else { h.extend_from_slice(&[1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0]); continue };
            let m = m4::mul(wb, e); for r in 0..3 { for k in 0..4 { h.push(m[k * 4 + r]); } }
            c = add(c, pos(wb)); n += 1.0;
        }
        if n > 0.0 { c = esc(c, 1.0 / n); }
        let mut r = 0.0f32; for &b in &g.huesos { if let Some(wb) = w.get(1 + b) { r = r.max(largo(sub(pos(wb), c))); } }
        let s = w.get(1).map(|m| (m[0] * m[0] + m[1] * m[1] + m[2] * m[2]).sqrt()).unwrap_or(1.0).max(1.0);
        let esf = [c[0], c[1], c[2], r + 0.35 * def.alto * s + 0.15];
        for &(s0, sn, mat) in &g.partes { out.push(ItemDin { m: g.m, s0, sn, mat, mm: m4::id(), esf, fl: 0, h: h.clone() }); }
    }
}

/// los modelos de jugador y su estado en el juego
#[derive(Default)]
pub struct Pm {
    /// los .mdl armados (None: no se puede)
    pub defs: HashMap<String, Option<Rc<DefPm>>>,
    pub hero: Option<Rc<HeroD>>,
    /// lo de cada personaje: 0 el jugador, 1 + id cada NPC
    pub prep: RefCell<HashMap<u64, PrepPm>>,
    /// los que se pidieron y todavía no se armaron
    pub pedidos: Vec<String>,
    /// el último modelo del jugador que se le dijo al Lua
    pub modelo_lua: String,
    /// los modelos de cada addon que se pueden poner (gmarDeAddon y los de models/player/): (ruta, rig automático)
    pub por_addon: HashMap<String, Vec<(String, bool)>>,
}
pub const CLAVE_JUG: u64 = 0;

impl Juego {
    /// el modelo de GMod de un skin («gmpm:<ruta>»)
    pub fn gmp_ruta(skin: &str) -> Option<&str> { skin.strip_prefix("gmpm:") }
    /// arma los .mdl que hacen falta (el del jugador y los de los NPC con uno): uno por cuadro, en el cuadro del juego
    pub(crate) fn gmp_paso(&mut self, m: &mut Motor3d) {
        let mut quiero: Vec<String> = vec![];
        if let Some(r) = Self::gmp_ruta(&self.skin) { quiero.push(r.to_string()); }
        for p in &self.npcs.lista { if let Some(r) = Self::gmp_ruta(&p.skin) { if !quiero.iter().any(|x| x == r) { quiero.push(r.to_string()); } } }
        quiero.extend(std::mem::take(&mut self.gmod.pm.pedidos));
        // (el Hero en reposo: del cuerpo del jugador si es el Hero, o de uno de los NPC)
        if self.gmod.pm.hero.is_none() && !quiero.is_empty() {
            let h = self.pj.as_ref().filter(|p| p.skin == "Hero").map(HeroD::de).or_else(|| self.npcs.lista.iter().find(|p| p.pj.skin == "Hero").map(|p| HeroD::de(&p.pj)));
            if let Some(h) = h { self.gmod.pm.hero = Some(Rc::new(h)); }
        }
        // (el Lua pregunta qué modelo tiene puesto el jugador: Player:GetModel y sus manos)
        let mj = Self::gmp_ruta(&self.skin).unwrap_or("").to_string();
        if mj != self.gmod.pm.modelo_lua { if let Some(gm) = self.gmod.gm.as_ref() { gm.poner_modelo_jugador(&mj); self.gmod.pm.modelo_lua = mj; } }
        if self.gmod.gm.is_none() { return; }
        for r in quiero { if !self.gmod.pm.defs.contains_key(&r) { let d = self.gmp_def(m, &r); self.gmod.pm.defs.insert(r, d); break; } }
        // (los NPC que ya no están)
        let ids: Vec<u64> = self.npcs.lista.iter().map(|p| 1 + p.id as u64).collect();
        self.gmod.pm.prep.borrow_mut().retain(|k, _| *k == CLAVE_JUG || ids.contains(k));
    }
    /// gmpDef: el .mdl (con su rig automático si es un prop con forma de persona) y su malla con piel
    fn gmp_def(&mut self, m: &mut Motor3d, ruta: &str) -> Option<Rc<DefPm>> {
        let gm = self.gmod.gm.as_ref()?.modelo(ruta)?; let mut mdl = gm.m.clone();
        let rig = mdl.huesos.len() <= 2 && !mdl.huesos.iter().any(|h| h.n.eq_ignore_ascii_case("valvebiped.bip01_pelvis"));
        if rig { if let Some(r) = jxgmod::autorig::rig(&mdl) { mdl = Rc::new(r); } }
        let modelo = if rig { self.gm_piel_de(m, ruta, &mdl, "auto")? } else { self.gm_piel_pub(m, ruta)? };
        DefPm::armar(ruta, mdl, modelo, if rig { None } else { Some(gm) }).map(Rc::new)
    }
    /// ¿el skin es un modelo de GMod ya armado?
    pub fn gmp_listo(&self, skin: &str) -> bool { Self::gmp_ruta(skin).map(|r| matches!(self.gmod.pm.defs.get(r), Some(Some(_)))).unwrap_or(false) }
    /// el .mdl puesto en la pose del cuerpo `pj` y lo que se dibuja; false si no hay (o todavía no está: se dibuja el Hero)
    pub(crate) fn gmp_dibujar(&self, clave: u64, ruta: &str, pj: &Personaje, base: &M4, hace: &Hace, cam: V, rag_piso: Option<f32>, out: &mut Vec<ItemDin>) -> bool {
        let Some(Some(def)) = self.gmod.pm.defs.get(ruta) else { return false };
        let Some(d) = self.gmod.pm.hero.as_ref() else { return false };
        // (por dentro tiene que ser el Hero: con otro cuerpo —un skin que pidió un mod— se dibuja ése)
        if pj.n_nodos() != d.rp.len() { return false; }
        let mut preps = self.gmod.pm.prep.borrow_mut();
        if preps.get(&clave).map(|p| p.def.ruta != def.ruta).unwrap_or(true) { match PrepPm::de(def.clone(), d) { Some(p) => { preps.insert(clave, p); } None => return false } }
        let g = preps.get_mut(&clave).unwrap();
        // (lejos: menos del ~15 % del alto de la pantalla, con margen)
        let raiz = m4::mul(base, &pj.raiz());
        let dd = largo(sub(pos(&raiz), cam)); let fov = if self.fov_b > 0.0 { self.fov_b } else { self.aj.fov as f32 };
        let frac = 1.9 * pj.tam / (2.0 * (fov.to_radians() / 2.0).tan() * dd.max(0.1));
        g.lejos = clave != CLAVE_JUG && if g.lejos { frac < 0.16 } else { frac < 0.14 };
        if g.propio() { self.gmp_propio(g, base, hace, out); return true; }
        let n = pj.n_nodos(); let hw: Vec<M4> = (0..n).map(|i| m4::mul(base, &pj.mundo(i))).collect();
        let raiz_h = if hace.rag { pj.mundo(0) } else { raiz };
        let w = posar(g, d, &hw, &raiz_h, hace, self.mapa.as_ref().map(|m| &m.mundo), rag_piso);
        items(def, &w, out);
        // (el arma de la mano: la del Hero, corrida a la mano del modelo y de su tamaño)
        if !hace.rag { let mut t = vec![]; pj.items(base, &mut t); for mut it in t.into_iter().filter(|it| it.h.is_empty()) { it.mm = arma_gmp(g, &it.mm); let c = [it.esf[0], it.esf[1], it.esf[2]]; let a = arma_gmp(g, &[1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, c[0], c[1], c[2], 1.0]); it.esf = [a[12], a[13], a[14], it.esf[3] * g.arma_d.map(|x| x.2).unwrap_or(1.0)]; out.push(it); } }
        true
    }
    /// gmpPropio: un modelo sin esqueleto de Valve, con su secuencia según lo que hace (quieto, camina, corre, agachado, salta)
    fn gmp_propio(&self, g: &mut PrepPm, base: &M4, hace: &Hace, out: &mut Vec<ItemDin>) {
        let def = g.def.clone(); let (Some(s), Some(gm)) = (def.secs, def.gm.as_ref()) else { return };
        let sp = (hace.vel[0] * hace.vel[0] + hace.vel[2] * hace.vel[2]).sqrt();
        let elige = |l: &[i32]| l.iter().copied().find(|x| *x >= 0).unwrap_or(-1);
        let sec = if !hace.suelo && !hace.sentado { elige(&[s.salta, s.quieto]) } else if hace.agachado || hace.sentado { elige(&[s.agachado, s.quieto]) } else if sp > 5.0 { elige(&[s.corre, s.camina, s.quieto]) } else if sp > 0.3 { elige(&[s.camina, s.corre, s.quieto]) } else { elige(&[s.quieto, s.camina]) };
        if sec != g.sec { g.sec = sec; g.t = 0.0; }
        g.t += if hace.dt > 0.0 { hace.dt } else { 0.016 };
        // (cuadro a cuadro desde el .mdl, entre el cuadro de ahora y el siguiente: GMF.poseCapas)
        let hs = if sec >= 0 { let a = &gm.m.anims[sec as usize]; let fps = if a.fps > 0.0 { a.fps } else { 30.0 }; let f = (g.t * fps) % ((a.nf - 1).max(1) as f32); Some(jxgmod::modelos::pose_w(gm, sec as usize, f as f64)) } else { None };
        let w: Vec<M4> = match hs {
            Some(hs) => std::iter::once(*base).chain(hs.iter().map(|s| m4::mul(base, &m34_juego(s)))).collect(),
            None => std::iter::once(*base).chain((1..=def.nb).map(|i| m4::mul(base, &trs(def.rest_p[i], def.rest_q[i], 1.0)))).collect(),
        };
        items(&def, &w, out);
    }
    /// el cuerpo del jugador con su modelo de GMod (si tiene uno puesto y ya está armado)
    pub fn gmp_items_jugador(&self, base: &M4, items: &mut Vec<ItemDin>, cam: V, dt: f32) -> bool {
        let Some(r) = Self::gmp_ruta(&self.skin) else { return false }; let Some(pj) = self.pj.as_ref() else { return false };
        let hace = Hace { rag: false, suelo: self.jug.suelo || self.jug.noclip, sentado: pj.sentado(), agachado: self.jug.agachado, armado: pj.arma().map(|a| a != "Hands").unwrap_or(false), vel: self.jug.vel, dt };
        self.gmp_dibujar(CLAVE_JUG, r, pj, base, &hace, cam, None, items)
    }
    /// los NPC con un modelo de GMod (los demás los dibuja npc.rs): ese modelo o, mientras no está, el Hero
    pub fn gmp_items_npcs(&self, items: &mut Vec<ItemDin>, cam: V, dt: f32) {
        for p in &self.npcs.lista {
            let Some(r) = Self::gmp_ruta(&p.skin) else { continue }; if !p.visible { continue; }
            let base = p.base();
            let rag_piso = p.rag.as_ref().map(|rg| {
                let mut piso = f32::INFINITY; for c in rg.cuerpos() { if let Some(b) = self.fis.cuerpo(c) { piso = piso.min(b.aabb()[1] as f32); } }
                if let (Some(mp), Some(h)) = (self.mapa.as_ref(), p.pj.indice("Hips")) { let hp = pos(&p.pj.mundo(h)); if let Some(gp) = mp.mundo.rayo([hp[0], hp[1] + 0.5, hp[2]], [0.0, -1.0, 0.0], 4.0) { piso = piso.max(hp[1] + 0.5 - gp.t); } }
                piso
            }).filter(|x| x.is_finite());
            let hace = Hace { rag: p.rag.is_some(), suelo: p.cap.suelo, sentado: false, agachado: false, armado: p.pj.arma().map(|a| a != "Hands").unwrap_or(false), vel: [p.cap.vel[0] as f32, p.cap.vel[1] as f32, p.cap.vel[2] as f32], dt };
            if !self.gmp_dibujar(1 + p.id as u64, r, &p.pj, &base, &hace, cam, rag_piso, items) { p.pj.items(&base, items); }
        }
    }
    /// (para las pruebas) lo de gmpPreparar y dónde quedaron algunos huesos del personaje (0 el jugador, 1 + id un NPC)
    pub fn gmp_info(&self, clave: u64) -> Option<String> {
        let p = self.gmod.pm.prep.borrow(); let g = p.get(&clave)?; let d = &g.def; let r4 = |x: f32| (x * 10000.0).round() / 10000.0;
        let w = |n: &str| d.m(n).map(|i| format!("[{},{},{}]", r4(g.pw[i][0]), r4(g.pw[i][1]), r4(g.pw[i][2]))).unwrap_or("null".into());
        Some(format!("{{\"k\":{},\"esc\":{{\"bLeft\":{},\"pLeft\":{},\"bRight\":{},\"pRight\":{}}},\"otraEsc\":{},\"alin\":{},\"piso\":{},\"nb\":{},\"propio\":{},\"hips\":{},\"cabeza\":{},\"manoD\":{},\"pieI\":{},\"raiz\":[{},{},{}]}}",
            r4(g.k), r4(g.e("bLeft")), r4(g.e("pLeft")), r4(g.e("bRight")), r4(g.e("pRight")), g.otra_esc, g.alin.iter().filter(|x| x.is_some()).count(), r4(d.piso), d.nb, g.propio(), w("Hips"), w("Head"), w("RightHand"), w("LeftFoot"), r4(g.pw[0][0]), r4(g.pw[0][1]), r4(g.pw[0][2])))
    }
    /// gmpLista: los modelos de jugador de los addons prendidos (los de AddValidModel, los .mdl de models/player/ que no
    /// son manos ni animaciones y los personajes que vienen como muñeco, NPC o prop quieto: gmod_autorig) — (ruta, nombre,
    /// addon, rig automático)
    pub fn gmp_lista(&mut self) -> Vec<(String, String, String, bool)> {
        let Some(gm) = self.gmod.gm.as_ref() else { return vec![] };
        let (pms, _) = gm.modelos_jugador();
        let mut out: Vec<(String, String, String, bool)> = vec![];
        let nombre = |r: &str| -> String { pms.iter().rev().find(|x| jxgmod::jugadores::ruta_mdl(&x.1) == r).map(|x| x.0.clone()).unwrap_or_else(|| r.rsplit('/').next().unwrap_or(r).trim_end_matches(".mdl").replace('_', " ")) };
        for a in self.gmod.addons.iter().filter(|a| a.prendido) {
            let Some(idx) = a.idx else { continue };
            let k = format!("{}#{}", idx, a.nombre);
            if !self.gmod.pm.por_addon.contains_key(&k) {
                let arch = gm.archivos_addon(idx); let mut l: Vec<(String, bool)> = vec![];
                for (_, m) in &pms { let r = jxgmod::jugadores::ruta_mdl(m); if arch.contains(&r) && !l.iter().any(|x| x.0 == r) { l.push((r, false)); } }
                for r in &arch {
                    if !(r.starts_with("models/player/") && r.ends_with(".mdl")) { continue; }
                    let b = r.rsplit('/').next().unwrap_or(r);
                    if ["c_", "arms", "hands", "v_", "anim", "m_anm", "f_anm", "z_anm"].iter().any(|x| b.starts_with(x)) || b.contains("_anim") { continue; }
                    if !l.iter().any(|x| &x.0 == r) { l.push((r.clone(), false)); }
                }
                // (y los que vienen como muñeco, NPC o prop quieto: gmarDeAddon)
                for r in &arch {
                    if !r.ends_with(".mdl") || jxgmod::autorig::fuera(r) || l.iter().any(|x| &x.0 == r) { continue; }
                    let Some(b) = gm.archivo(r) else { continue }; let Ok(m) = gmf::mdl(b, None, None) else { continue };
                    if let Some(t) = jxgmod::autorig::tipo(r, &m, &|| gm.modelo(r).map(|x| x.m.clone())) { l.push((r.clone(), t == "auto")); }
                }
                self.gmod.pm.por_addon.insert(k.clone(), l);
            }
            for (r, auto) in self.gmod.pm.por_addon.get(&k).cloned().unwrap_or_default() { if gm.archivo(&r).is_some() && !out.iter().any(|x| x.0 == r) { out.push((r.clone(), format!("{}{}", nombre(&r), if auto { " · rig automático" } else { "" }), a.nombre.clone(), auto)); } }
        }
        out
    }
    /// ponerse un modelo de jugador («gmpm:<ruta>») o volver a un personaje del juego (pjElegirSkin): jugando, al momento
    pub fn gmp_elegir(&mut self, m: &mut Motor3d, skin: &str) {
        if skin == self.skin { return; }
        self.skin = skin.to_string();
        // (el cuerpo nuevo: un modelo de GMod va sobre el Hero)
        let quiero = if Self::gmp_ruta(skin).is_some() { "Hero" } else { skin };
        if self.pj.as_ref().map(|p| p.skin != quiero).unwrap_or(true) {
            if let Some(paq) = self.paq.as_mut() {
                match Personaje::cargar(paq, quiero, 0, 512, &mut self.pj_cargados).or_else(|_| Personaje::cargar(paq, "Hero", 0, 512, &mut self.pj_cargados)) {
                    Ok((mut pj, esc)) => { if let Some((a, b)) = &self.nado { let _ = pj.nado(a, b); } if unsafe { m.cargar(&esc) }.is_ok() { self.pj = Some(pj); } }
                    Err(e) => self.avisar(format!("personaje: {e}")),
                }
            }
        }
        self.gmod.pm.prep.borrow_mut().remove(&CLAVE_JUG);
        let n = Self::gmp_ruta(skin).map(|r| r.rsplit('/').next().unwrap_or(r).trim_end_matches(".mdl").replace('_', " ")).unwrap_or_else(|| npc::skin_nom(skin).to_string());
        self.avisar(format!("Ahora sos {n}"));
    }
}
