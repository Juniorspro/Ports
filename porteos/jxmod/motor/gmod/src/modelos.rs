//! Los modelos de los addons para el Lua y para dibujar: los .mdl leídos (con sus .vvd/.vtx, su .ani y los modelos que
//! incluyen), las secuencias de las entidades (gmod_nextbot.js: StartActivity, SetSequence, ciclos, parámetros de pose,
//! eventos), los nextbots (su locomoción, Path con A* sobre el piso, el navmesh de mentira y BodyMoveXY), la vista del
//! arma del addon (SendWeaponAnim → la secuencia de su ViewModel) y el dibujo de cada cuadro (gmrAntes de
//! gmod_render.js: Draw, RenderOverride, DrawModel y lo de render.* que dibuja en 3D: sprites y cuadrados).
use crate::anfitrion::*;
use crate::formatos::{self as gmf, Capa, Mdl};
use crate::mates::*;
use crate::motor::*;
use crate::nucleo::*;
use jxlua::{Estado, Tabla, TablaRef, Udata, Valor};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::rc::Rc;

type R = Result<(), jxlua::Error>;
fn ok1(o: &mut Vec<Valor>, v: Valor) -> R { if !v.es_nil() { o.push(v); } Ok(()) }
fn n(o: &mut Vec<Valor>, x: f64) -> R { o.push(Valor::Num(x)); Ok(()) }
fn b(o: &mut Vec<Valor>, x: bool) -> R { o.push(Valor::Bool(x)); Ok(()) }

// ---------------- los modelos ----------------
/// un modelo leído, con las capas que Source suma siempre
pub struct Modelo { pub m: Rc<Mdl>, pub capas: Vec<Capa> }
#[derive(Default)]
struct Estado3 {
    modelos: HashMap<String, Option<Rc<Modelo>>>,
    anim: HashMap<i64, AnimEnt>,
    act_nom: HashMap<i32, String>,
    act_num: HashMap<String, i32>,
}
thread_local! { static E3: RefCell<Estado3> = RefCell::new(Estado3::default()); }
fn e3<X>(f: impl FnOnce(&mut Estado3) -> X) -> X { E3.with(|x| f(&mut x.borrow_mut())) }
pub(crate) fn olvidar() { e3(|x| *x = Estado3::default()); }

pub fn ruta_mdl(m: &str) -> String {
    let mut r = m.to_lowercase().replace('\\', "/"); while r.starts_with('/') { r.remove(0); }
    if !r.is_empty() && !r.starts_with("models/") { r = format!("models/{r}"); } r
}
fn leer(r: &str, prof: u32) -> Option<Mdl> {
    let b = archivo(r)?; let base = &r[..r.len().saturating_sub(4)];
    let vvd = archivo(&format!("{base}.vvd"));
    let vtx = ["dx90.vtx", "vtx", "dx80.vtx", "sw.vtx"].iter().find_map(|x| archivo(&format!("{base}.{x}")));
    let mut m = match (&vvd, &vtx) { (Some(a), Some(c)) => gmf::mdl(b.clone(), Some(a), Some(c)).or_else(|_| gmf::mdl(b.clone(), None, None)), _ => gmf::mdl(b.clone(), None, None) }.ok()?;
    if !m.ani_nom.is_empty() && m.bloques.len() >= 2 { m.ani = archivo(&m.ani_nom); }
    if prof < 2 { for inc in gmf::incluidos(&m) { if inc == r { continue; } if let Some(im) = leer(&inc, prof + 1) { gmf::unir_incluido(&mut m, Rc::new(im)); } } }
    Some(m)
}
/// el modelo de esa ruta (de los addons montados), leído una vez
pub fn modelo(ruta: &str) -> Option<Rc<Modelo>> {
    let r = ruta_mdl(ruta); if r.is_empty() { return None; }
    if let Some(x) = e3(|s| s.modelos.get(&r).cloned()) { return x; }
    let res = leer(&r, 0).map(|m| { let capas = gmf::capas(&m); Rc::new(Modelo { m: Rc::new(m), capas }) });
    e3(|s| s.modelos.insert(r, res.clone())); res
}
/// las matrices de piel (W·p2b, en el espacio de Source) de la animación `ia` en el cuadro (con fracción) `fr`
pub fn huesos_de(md: &Modelo, ia: usize, fr: f64) -> Vec<[f32; 12]> {
    let m = &md.m; let nf = m.anims.get(ia).map(|a| a.nf).unwrap_or(1).max(1);
    let fr = fr.clamp(0.0, (nf - 1) as f64); let f0 = fr.floor() as i32; let w = (fr - f0 as f64) as f32;
    let mut pa = gmf::pose_capas(m, &md.capas, ia, f0);
    if w > 1e-3 && f0 + 1 < nf {
        let pb = gmf::pose_capas(m, &md.capas, ia, f0 + 1);
        for h in 0..pa.p.len() {
            for c in 0..3 { pa.p[h][c] = pa.p[h][c] * (1.0 - w) + pb.p[h][c] * w; }
            let (q0, mut q1) = (pa.q[h], pb.q[h]); if q0[0] * q1[0] + q0[1] * q1[1] + q0[2] * q1[2] + q0[3] * q1[3] < 0.0 { q1 = [-q1[0], -q1[1], -q1[2], -q1[3]]; }
            pa.q[h] = gmf::qnorm([q0[0] * (1.0 - w) + q1[0] * w, q0[1] * (1.0 - w) + q1[1] * w, q0[2] * (1.0 - w) + q1[2] * w, q0[3] * (1.0 - w) + q1[3] * w]);
        }
    }
    let wm = gmf::mundo_huesos(m, &pa);
    wm.iter().zip(m.huesos.iter()).map(|(w, h)| gmf::mul34(w, &h.p2b)).collect()
}
/// los huesos en el espacio del modelo (W) de la pose de ahora de una entidad (para enganches y huesos del Lua)
fn mundo_de(md: &Modelo, a: Option<&SecEnt>) -> Vec<[f32; 12]> {
    let m = &md.m;
    let ps = match a { Some(s) => { let an = &m.anims[s.anim]; let fps = if an.fps > 0.0 { an.fps as f64 } else { 30.0 }; let n = (an.nf - 1).max(1) as f64; let fr = if s.lp { (s.t * fps) % n } else { (s.t * fps).min(n) }; gmf::pose_capas(m, &md.capas, s.anim, fr as i32) } None => { let ia = m.secuencias.first().map(|q| q.anim).filter(|&x| x >= 0).unwrap_or(0) as usize; if m.anims.is_empty() { gmf::Pose { p: m.huesos.iter().map(|h| h.pos).collect(), q: m.huesos.iter().map(|h| h.q).collect(), ok: true, falta: false } } else { gmf::pose_capas(m, &md.capas, ia, 0) } } };
    gmf::mundo_huesos(m, &ps)
}

// ---------------- secuencias de las entidades ----------------
#[derive(Clone, Copy)]
pub(crate) struct SecEnt { pub i: usize, pub anim: usize, pub t: f64, pub lp: bool, pub dur: f64 }
#[derive(Clone)]
enum Pide { Nombre(String), Idx(i64), Act(i32) }
#[derive(Default)]
struct AnimEnt { sec: Option<SecEnt>, rate: Option<f64>, act: i32, pose: HashMap<String, f32>, pide: Option<Pide>, alias: HashMap<usize, i32>, nb: bool, loco: Option<Valor>, dm: bool }
fn an<X>(id: i64, f: impl FnOnce(&mut AnimEnt) -> X) -> X { e3(|s| f(s.anim.entry(id).or_default())) }
fn an_ver<X>(id: i64, f: impl FnOnce(&AnimEnt) -> X) -> Option<X> { e3(|s| s.anim.get(&id).map(f)) }
fn es_nb(e: &Valor) -> bool { ent_id(e).and_then(|id| an_ver(id, |a| a.nb)).unwrap_or(false) }
fn es_vm(e: &Valor) -> bool { ce(e, |x| x.tipo == TipoEnt::Vm).unwrap_or(false) }
/// el modelo de una entidad (la vista: el ViewModel del arma que tiene el jugador)
fn modelo_ent(e: &Valor) -> Option<Rc<Modelo>> {
    let m = ce(e, |x| x.modelo.clone())?;
    if m.is_empty() && es_vm(e) { return vista_modelo().and_then(|r| modelo(&r)); }
    modelo(&m)
}
fn actos(e: &mut Estado) {
    if e3(|s| !s.act_num.is_empty()) { return; }
    let gl = e.globales(); let mut l = vec![];
    for (k, v) in gl.borrow().pares() { if let (Valor::Cad(k), Valor::Num(x)) = (&k, &v) { let s = String::from_utf8_lossy(k.bytes()).into_owned(); if s.starts_with("ACT_") { l.push((s, *x as i32)); } } }
    l.sort();
    e3(|s| { for (k, v) in l { s.act_nom.entry(v).or_insert_with(|| k.clone()); s.act_num.insert(k, v); } });
}
fn act_de(nom: &str) -> Option<i32> { e3(|s| s.act_num.get(&nom.to_uppercase()).copied()) }
fn act_nombre(v: i32) -> String { e3(|s| s.act_nom.get(&v).cloned()).unwrap_or_default() }
fn clase_act(nom: &str) -> &'static str {
    let n = nom.to_uppercase(); if n.is_empty() { return ""; }
    if n.contains("CROUCH") || n.contains("COVER_LOW") { return if n.contains("WALK") || n.contains("RUN") { "cwalk" } else { "cidle" }; }
    if n.contains("JUMP") || n.contains("GLIDE") { return "jump"; } if n.contains("RELOAD") { return "reload"; }
    if ["ATTACK", "MELEE", "RANGE", "SHOOT", "FIRE"].iter().any(|k| n.contains(k)) { return "attack"; }
    if n.contains("RUN") { return "run"; } if n.contains("WALK") { return "walk"; } if n.contains("IDLE") { return "idle"; } ""
}
/// gmnbSecsDeAct
fn secs_de_act(m: &Mdl, act: i32) -> Vec<usize> {
    let mut l: Vec<usize> = m.secuencias.iter().enumerate().filter(|(_, s)| !s.act.is_empty() && act_de(&s.act) == Some(act)).map(|(i, _)| i).collect();
    if !l.is_empty() { return l; }
    let cat = clase_act(&act_nombre(act)); if cat.is_empty() { return l; }
    let mut mejor: Option<(String, Vec<usize>)> = None;
    for (i, s) in m.secuencias.iter().enumerate() { if s.act.is_empty() { continue; } let nn = s.act.to_uppercase(); if clase_act(&nn) != cat { continue; } match &mut mejor { None => mejor = Some((nn, vec![i])), Some((a, ll)) => if nn.len() < a.len() { mejor = Some((nn, vec![i])); } else if nn == *a { ll.push(i); } } }
    if let Some((_, ll)) = mejor { return ll; }
    let re: &[&str] = match cat { "idle" => &["idle", "stand"], "walk" => &["walk"], "run" => &["run"], "jump" => &["jump", "glide"], "attack" => &["attack", "melee", "shoot", "fire"], "cidle" | "cwalk" => &["crouch", "duck"], "reload" => &["reload"], _ => &[] };
    for (i, s) in m.secuencias.iter().enumerate() { let nn = s.n.to_lowercase(); if re.iter().any(|k| nn.contains(k)) { l.push(i); } }
    l.truncate(8); l
}
fn alias(id: i64, m: &Mdl, i: usize, act: i32) { if let Some(s) = m.secuencias.get(i) { if !(!s.act.is_empty() && act_de(&s.act) == Some(act)) { an(id, |a| { a.alias.insert(i, act); }); } } }
fn pose_vals(id: i64) -> HashMap<String, f32> { an_ver(id, |a| a.pose.clone()).unwrap_or_default() }
/// gmnbSecuencia: pone la secuencia (por nombre, número o actividad); devuelve lo que dura
fn secuencia(e: &Valor, q: Pide) -> f64 {
    let Some(id) = ent_id(e) else { return 0.0 };
    let Some(md) = modelo_ent(e) else { an(id, |a| a.pide = Some(q)); return 0.0 };
    let m = &md.m;
    let i: i64 = match &q {
        Pide::Nombre(nm) => { let nm = nm.to_lowercase(); m.secuencias.iter().position(|s| s.n.to_lowercase() == nm).map(|x| x as i64).unwrap_or(-1) }
        Pide::Idx(i) => *i,
        Pide::Act(act) => { let l = secs_de_act(m, *act); match l.first() { Some(&i) => { alias(id, m, i, *act); i as i64 } None => -1 } }
    };
    if i < 0 || i as usize >= m.secuencias.len() { an(id, |a| a.pide = Some(q)); return 0.0; }
    let sq = &m.secuencias[i as usize]; let mut ai = sq.anim;
    if (ai < 0 || ai as usize >= m.anims.len()) && sq.grid.is_some() { let pv = pose_vals(id); ai = gmf::anim_de(m, i as usize, &|k| pv.get(k).copied()); if ai < 0 || ai as usize >= m.anims.len() { ai = sq.grid.as_ref().and_then(|g| g.iter().copied().find(|&x| x >= 0 && (x as usize) < m.anims.len())).unwrap_or(-1); } }
    if ai < 0 || ai as usize >= m.anims.len() { an(id, |a| a.pide = Some(q)); return 0.0; }
    let a = &m.anims[ai as usize]; let dur = ((a.nf - 1).max(0) as f64 / if a.fps > 0.0 { a.fps as f64 } else { 30.0 }).max(0.0);
    an(id, |x| { x.pide = None; x.sec = Some(SecEnt { i: i as usize, anim: ai as usize, t: 0.0, lp: sq.lp, dur }); });
    dur
}
fn sec_de(e: &Valor, i: &Valor) -> i64 { if i.es_nil() { ent_id(e).and_then(|id| an_ver(id, |a| a.sec.map(|s| s.i as i64))).flatten().unwrap_or(-1) } else { num(i, -1.0) as i64 } }
/// la escala del modelo
fn escala(e: &Valor) -> f64 { ce(e, |x| x.escala).filter(|s| *s > 0.0).unwrap_or(1.0) }

// ---------------- la locomoción (CLuaLocomotion) ----------------
pub(crate) struct Loco {
    id: i64, meta: Option<V3>, mirar: Option<V3>, vel0: f64, acel: f64, decel: f64, salto: f64, paso: f64, giro: f64, grav: f64, caida: f64,
    v: V3, suelo: bool, trabado: bool, t_trabado: f64, t_ap: Option<f64>, dir_mov: Option<V3>, dist_meta: f64, suelo_aviso: Option<bool>, vio_suelo: bool, toques: HashMap<i64, f64>,
}
fn lo<X>(v: &Valor, f: impl FnOnce(&mut Loco) -> X) -> Option<X> { match v { Valor::Udata(u) => u.con_mut(f), _ => None } }
fn loco_de(e: &Valor) -> Option<Valor> { let id = ent_id(e)?; an_ver(id, |a| a.loco.clone()).flatten() }
fn mt_simple(nombre: &str, metas: &str) -> TablaRef {
    let m = Tabla::nueva_ref(); let i = Tabla::nueva_ref();
    m.borrow_mut().set_str("__index", Valor::Tabla(i.clone())); m.borrow_mut().set_str("MetaName", cad(nombre));
    g(|g| g.metas.set(metas.to_string(), i.clone())); m
}
thread_local! { static MTS: RefCell<HashMap<&'static str, TablaRef>> = RefCell::new(HashMap::new()); }
fn mt_de(k: &'static str) -> Option<TablaRef> { MTS.with(|m| m.borrow().get(k).cloned()) }
fn idx(m: &TablaRef) -> TablaRef { match m.borrow().get_str("__index") { Valor::Tabla(t) => t, _ => m.clone() } }
fn loco_nuevo(id: i64) -> Valor {
    let l = Loco { id, meta: None, mirar: None, vel0: 0.0, acel: 400.0, decel: 400.0, salto: 58.0, paso: 18.0, giro: 200.0, grav: 1000.0, caida: 200.0, v: V3::default(), suelo: false, trabado: false, t_trabado: 0.0, t_ap: None, dir_mov: None, dist_meta: 0.0, suelo_aviso: None, vio_suelo: false, toques: HashMap::new() };
    Valor::Udata(Udata::nueva(l, mt_de("loco")))
}
fn ahora() -> f64 { h(|h| h.tiempo()) }
fn instalar_loco() {
    let m = mt_simple("CLuaLocomotion", "CLuaLocomotion"); let i = idx(&m);
    MTS.with(|x| x.borrow_mut().insert("loco", m));
    fn vg_(v: &Valor) -> Option<V3> { vec_de(v).map(a_juego) }
    def(&i, "Approach", |_, a, _| { if let Some(p) = vg_(&ar(a, 1)) { let t = ahora(); lo(&ar(a, 0), |l| { l.meta = Some(p); l.t_ap = Some(t); }); } Ok(()) });
    def(&i, "FaceTowards", |_, a, _| { if let Some(p) = vg_(&ar(a, 1)) { lo(&ar(a, 0), |l| l.mirar = Some(p)); } Ok(()) });
    macro_rules! campo { ($set:literal, $get:literal, $f:ident) => {
        def(&i, $set, |_, a, _| { let x = num(&ar(a, 1), 0.0); lo(&ar(a, 0), |l| l.$f = if x.is_nan() { 0.0 } else { x }); Ok(()) });
        def(&i, $get, |_, a, o| n(o, lo(&ar(a, 0), |l| l.$f).unwrap_or(0.0)));
    } }
    campo!("SetDesiredSpeed", "GetDesiredSpeed", vel0); campo!("SetAcceleration", "GetAcceleration", acel); campo!("SetDeceleration", "GetDeceleration", decel);
    campo!("SetJumpHeight", "GetJumpHeight", salto); campo!("SetStepHeight", "GetStepHeight", paso); campo!("SetMaxYawRate", "GetMaxYawRate", giro);
    campo!("SetGravity", "GetGravity", grav); campo!("SetDeathDropHeight", "GetDeathDropHeight", caida);
    def(&i, "GetVelocity", |_, a, o| ok1(o, vvr(lo(&ar(a, 0), |l| l.v).unwrap_or_default())));
    def(&i, "SetVelocity", |_, a, _| { if let Some(v) = vec_de(&ar(a, 1)) { lo(&ar(a, 0), |l| l.v = vgr(v)); } Ok(()) });
    def(&i, "IsStuck", |_, a, o| b(o, lo(&ar(a, 0), |l| l.trabado).unwrap_or(false)));
    def(&i, "ClearStuck", |_, a, _| { lo(&ar(a, 0), |l| { l.trabado = false; l.t_trabado = 0.0; }); Ok(()) });
    let salto = |l: &mut Loco| { l.v.y = (2.0 * l.grav.max(1.0) * l.salto.max(1.0)).sqrt() * GS; l.suelo = false; };
    def(&i, "Jump", move |_, a, _| { lo(&ar(a, 0), |l| if l.suelo { salto(l); }); Ok(()) });
    def(&i, "JumpAcrossGap", move |_, a, _| { let p = vg_(&ar(a, 1)); let t = ahora(); lo(&ar(a, 0), |l| if l.suelo { if let Some(p) = p { l.meta = Some(p); l.t_ap = Some(t); } salto(l); }); Ok(()) });
    def(&i, "IsOnGround", |_, a, o| b(o, lo(&ar(a, 0), |l| l.suelo).unwrap_or(false)));
    def(&i, "IsClimbingOrJumping", |_, a, o| b(o, lo(&ar(a, 0), |l| !l.suelo).unwrap_or(false)));
    def(&i, "IsAttemptingToMove", |_, a, o| { let t = ahora(); b(o, lo(&ar(a, 0), |l| l.t_ap.map(|x| t - x < 0.25).unwrap_or(false)).unwrap_or(false)) });
    def(&i, "IsUsingLadder", |_, _, o| b(o, false));
    def(&i, "GetGroundMotionVector", |_, a, o| { let v = lo(&ar(a, 0), |l| l.v).unwrap_or_default(); let hh = (v.x * v.x + v.z * v.z).sqrt(); ok1(o, if hh > 1e-4 { vvd(v3(v.x / hh, 0.0, v.z / hh)) } else { nv(0.0, 0.0, 0.0) }) });
    def(&i, "GetCurrentAcceleration", |_, _, o| ok1(o, nv(0.0, 0.0, 0.0)));
    def(&i, "IsAreaTraversable", |_, _, o| b(o, true));
    def(&i, "GetNextBot", |_, a, o| { let id = lo(&ar(a, 0), |l| l.id).unwrap_or(-1); ok1(o, ent_por_id(id)) });
    for k in ["SetClimbAllowed", "SetJumpGapsAllowed", "SetAvoidAllowed", "SetDuckAllowed"] { def(&i, k, nada); }
    for k in ["GetClimbAllowed", "GetJumpGapsAllowed", "GetAvoidAllowed", "GetDuckAllowed"] { def(&i, k, |_, _, o| b(o, true)); }
}
fn ent_por_id(id: i64) -> Valor { g(|g| g.ents.iter().flatten().find(|x| x.0 == id).map(|x| x.1.clone())).unwrap_or_else(null) }

// ---------------- caminos sin malla de navegación ----------------
struct Medidas { r: f64, alto: f64, paso: f64, caida: f64 }
fn medidas(bot: &Valor) -> Medidas {
    let (paso, caida) = loco_de(bot).and_then(|l| lo(&l, |l| (l.paso, l.caida))).unwrap_or((18.0, 200.0));
    let esc = escala(bot); let (mut r, mut alto) = (0.3, 1.6);
    if let Some(Some([a, c])) = ce(bot, |x| x.limites) { r = a[0].abs().max(c[0].abs()).max(a[1].abs()).max(c[1].abs()) * GS * esc; alto = (c[2] - a[2]).abs() * GS * esc; }
    Medidas { r: r.clamp(0.12, 0.6), alto: if alto > 0.0 { alto.clamp(0.4, 3.0) } else { 1.6 }, paso: (if paso > 0.0 { paso } else { 18.0 } * GS).max(0.1), caida: (if caida > 0.0 { caida } else { 200.0 } * GS).clamp(0.3, 12.0) }
}
/// lo que no tapa: el propio nextbot, lo que persigue, las personas y los nextbots
struct Ign { objs: Vec<ObjId> }
fn ignorar(bot: &Valor, meta: Option<&Valor>) -> Ign {
    let mut objs: Vec<ObjId> = vec![];
    if let Some(Some(o)) = ce(bot, |x| x.o) { objs.push(o); }
    if let Some(m) = meta { if let Some(Some(o)) = ce(m, |x| x.o) { objs.push(o); } }
    let nbs: Vec<i64> = e3(|s| s.anim.iter().filter(|(_, a)| a.nb).map(|(k, _)| *k).collect());
    for id in nbs { if let Some(Some(o)) = ce(&ent_por_id(id), |x| x.o) { objs.push(o); } }
    Ign { objs }
}
/// un rayo que pasa a través de las personas
fn rayo(o: V3, d: V3, max: f64, ign: &Ign) -> Option<Golpe> {
    let mut o = o; let mut rest = max;
    for _ in 0..3 {
        let g = h(|h| h.raycast(o, d, rest, &ign.objs))?;
        if g.persona.is_none() { return Some(Golpe { t: g.t + (max - rest), ..g }); }
        let av = g.t + 0.05; o = o.add(d.scale(av)); rest -= av; if rest <= 0.0 { return None; }
    }
    None
}
fn piso(x: f64, y: f64, z: f64, r: &Medidas, ign: &Ign) -> Option<f64> { let up = r.paso + 0.06; let hh = rayo(v3(x, y + up, z), v3(0.0, -1.0, 0.0), up + r.caida, ign)?; if hh.n.y > 0.7 { Some(y + up - hh.t) } else { None } }
fn tapado(o: V3, e: V3, ign: &Ign) -> bool { let d = e.sub(o); let l = d.len(); l > 1e-4 && rayo(o, d.scale(1.0 / l), l, ign).is_some() }
fn libre(a: V3, bb: V3, r: &Medidas, ign: &Ign) -> bool {
    let (dx, dz) = (bb.x - a.x, bb.z - a.z); let l = (dx * dx + dz * dz).sqrt(); if l < 1e-3 { return true; }
    let (ux, uz) = (dx / l, dz / l); let nn = (l / 0.5).ceil().max(1.0) as usize; let rod = r.paso + 0.08; let pecho = (r.paso + 0.25).max((r.alto * 0.7).min(1.2));
    let (mut y0, mut x0, mut z0, mut cy, mut tramo) = (a.y, a.x, a.z, a.y, 0);
    for i in 1..=nn {
        let t = l * i as f64 / nn as f64; let (x, z) = (a.x + ux * t, a.z + uz * t);
        let Some(gy) = piso(x, cy, z, r, ign) else { return false }; if gy - cy > r.paso + 0.02 { return false; }
        cy = gy; tramo += 1;
        if tramo >= 4 || i == nn {
            for (hh, lados) in [(rod, &[0.0, -1.0, 1.0][..]), (pecho, &[0.0][..])] { for &sd in lados {
                if tapado(v3(x0 - uz * sd * r.r, y0 + hh, z0 + ux * sd * r.r), v3(x - uz * sd * r.r, cy + hh, z + ux * sd * r.r), ign) { return false; }
            } }
            x0 = x; z0 = z; y0 = cy; tramo = 0;
        }
    }
    true
}
/// gmnbAEstrella
fn a_estrella(a: V3, bb: V3, r: &Medidas, ign: &Ign) -> Option<(Vec<V3>, bool)> {
    let mg = 8.0; let mut c = 0.5f64.max(r.r * 1.6);
    let (x0, z0) = (a.x.min(bb.x) - mg, a.z.min(bb.z) - mg);
    let dims = |c: f64| (((a.x.max(bb.x) + mg - x0) / c).ceil() as i64, ((a.z.max(bb.z) + mg - z0) / c).ceil() as i64);
    let (mut nx, mut nz) = dims(c); if nx * nz > 40000 { c *= ((nx * nz) as f64 / 40000.0).sqrt(); let d = dims(c); nx = d.0; nz = d.1; }
    let nt = (nx * nz) as usize; let mut gc = vec![f64::INFINITY; nt]; let mut yy = vec![f64::NAN; nt]; let mut de = vec![-1i64; nt]; let mut cerrado = vec![false; nt];
    let cel = |x: f64, z: f64| (((x - x0) / c).floor() as i64).clamp(0, nx - 1) + (((z - z0) / c).floor() as i64).clamp(0, nz - 1) * nx;
    let cx = |k: i64| x0 + ((k % nx) as f64 + 0.5) * c; let cz = |k: i64| z0 + ((k / nx) as f64 + 0.5) * c;
    let (ini, fin) = (cel(a.x, a.z), cel(bb.x, bb.z)); let hf = |k: i64| { let (x, z) = (cx(k) - bb.x, cz(k) - bb.z); (x * x + z * z).sqrt() };
    let mut heap: std::collections::BinaryHeap<(std::cmp::Reverse<u64>, i64)> = Default::default();
    let clave = |f: f64| std::cmp::Reverse((f * 1000.0) as u64);
    gc[ini as usize] = 0.0; yy[ini as usize] = a.y; heap.push((clave(1.3 * hf(ini)), ini));
    let (mut mejor, mut hm, mut nodos) = (ini, hf(ini), 0);
    let pos = |k: i64, yy: &Vec<f64>| if k == ini { a } else { v3(cx(k), yy[k as usize], cz(k)) };
    let rod = r.paso + 0.08; let pecho = (r.paso + 0.25).max((r.alto * 0.7).min(1.2));
    while let Some((_, k)) = heap.pop() {
        if nodos >= 2500 { break; }
        if cerrado[k as usize] { continue; } cerrado[k as usize] = true; nodos += 1;
        let hk = hf(k); if hk < hm { hm = hk; mejor = k; }
        if k == fin { mejor = k; break; }
        let (ix, iz) = (k % nx, k / nx); let p = pos(k, &yy);
        for ddz in -1..=1 { for ddx in -1..=1 {
            if ddx == 0 && ddz == 0 { continue; } let (jx, jz) = (ix + ddx, iz + ddz); if jx < 0 || jz < 0 || jx >= nx || jz >= nz { continue; }
            let j = jx + jz * nx; if cerrado[j as usize] { continue; }
            let (qx, qz) = if j == fin { (bb.x, bb.z) } else { (cx(j), cz(j)) };
            let Some(gy) = piso(qx, p.y, qz, r, ign) else { continue }; if gy - p.y > r.paso + 0.02 { continue; }
            let (dx, dz) = (qx - p.x, qz - p.z); let l = (dx * dx + dz * dz).sqrt(); if l < 1e-4 { continue; } let (ux, uz) = (dx / l, dz / l);
            let lad: &[f64] = if k == ini || j == fin { &[0.0] } else { &[0.0, -1.0, 1.0] };
            let mut tapa = false;
            'f: for (hh, lados) in [(rod, lad), (pecho, &[0.0][..])] { for &sd in lados { if tapado(v3(p.x - uz * sd * r.r, p.y + hh, p.z + ux * sd * r.r), v3(qx - uz * sd * r.r, gy + hh, qz + ux * sd * r.r), ign) { tapa = true; break 'f; } } }
            if tapa { continue; }
            let ng = gc[k as usize] + l + (gy - p.y).max(0.0) * 2.0; if ng >= gc[j as usize] { continue; }
            gc[j as usize] = ng; yy[j as usize] = gy; de[j as usize] = k; heap.push((clave(ng + 1.3 * hf(j)), j));
        } }
    }
    let mut pts = vec![]; let mut k = mejor;
    while k >= 0 && pts.len() < 4000 { pts.push(if k == fin { v3(bb.x, yy[k as usize], bb.z) } else { pos(k, &yy) }); k = de[k as usize]; }
    pts.reverse(); if pts.is_empty() { return None; }
    Some((pts, mejor == fin))
}
fn hilo(pts: Vec<V3>, r: &Medidas, ign: &Ign) -> Vec<V3> {
    if pts.len() <= 2 { return pts; }
    let mut o = vec![pts[0]]; let mut i = 0;
    while i < pts.len() - 1 { let mut j = i + 1; while j + 1 < pts.len() && libre(pts[i], pts[j + 1], r, ign) { j += 1; } o.push(pts[j]); i = j; }
    o
}
#[derive(Default)]
pub(crate) struct Camino { ok: bool, meta: Option<V3>, ini: Option<V3>, t0: f64, tol: f64, ver: f64, pts: Vec<V3>, idx: usize, largos: Vec<f64>, rodeo: bool, t_l: f64, meta_l: Option<V3>, ini_l: Option<V3>, t_a: f64, meta_a: Option<V3>, llega_a: bool, bot: Option<Valor> }
fn ca<X>(v: &Valor, f: impl FnOnce(&mut Camino) -> X) -> Option<X> { match v { Valor::Udata(u) => u.con_mut(f), _ => None } }
/// gmnbCalcular
fn calcular(p: &Valor, bot: &Valor, meta: V3, ent: Option<&Valor>) -> bool {
    let a = ent_pos(bot); let r = medidas(bot); let ign = ignorar(bot, ent);
    let gy = piso(meta.x, meta.y + 0.2, meta.z, &r, &ign); let bb = v3(meta.x, gy.unwrap_or(meta.y), meta.z); let t = ahora();
    let st = ca(p, |c| (c.ok && !c.pts.is_empty() && !c.rodeo && t - c.t_l < 0.25 && c.meta_l.map(|m| m.sub(bb).len() < 0.75).unwrap_or(true) && c.ini_l.map(|m| m.sub(a).len() < 0.75).unwrap_or(true),
        c.rodeo && !c.pts.is_empty() && t - c.t_a < 0.5 && c.meta_a.map(|m| m.sub(bb).len() < 1.5).unwrap_or(true), c.pts.clone(), c.idx, c.llega_a)).unwrap_or((false, false, vec![], 1, false));
    let (reciente, viejo, pts0, idx0, llega_a) = st;
    let (pts, llega, rodeo, recta): (Vec<V3>, bool, bool, bool) = if reciente { (vec![a, bb], true, false, false) }
        else if libre(a, bb, &r, &ign) { (vec![a, bb], true, false, true) }
        else if viejo { let mut q: Vec<V3> = pts0[idx0.max(1).min(pts0.len())..].to_vec(); q.insert(0, a); if let Some(u) = q.last_mut() { *u = bb; } (q, llega_a, true, false) }
        else { match a_estrella(a, bb, &r, &ign) { Some((pp, ll)) => { let mut h2 = hilo(pp, &r, &ign); h2[0] = a; (h2, ll, true, false) } None => (vec![a, bb], false, true, false) } };
    let nuevo_a = rodeo && !viejo;
    ca(p, |c| {
        c.meta = Some(bb); c.ini = Some(a); c.ok = true; c.pts = pts; c.rodeo = rodeo;
        if recta { c.t_l = t; c.meta_l = Some(bb); c.ini_l = Some(a); }
        if nuevo_a { c.t_a = t; c.meta_a = Some(bb); c.llega_a = llega; }
        c.idx = 1; c.largos = vec![0.0]; for i in 1..c.pts.len() { let (u, w) = (c.pts[i - 1], c.pts[i]); let l = c.largos[i - 1] + ((w.x - u.x).powi(2) + (w.z - u.z).powi(2)).sqrt(); c.largos.push(l); }
    });
    llega
}
fn seguir(p: &Valor, bot: &Valor) {
    if !ca(p, |c| c.ok).unwrap_or(false) || !ce(bot, |x| x.vivo).unwrap_or(false) { return; }
    let pos = ent_pos(bot); let r = medidas(bot).r.max(0.3);
    let w = ca(p, |c| {
        c.bot = Some(bot.clone());
        if c.pts.is_empty() { c.pts = vec![pos, c.meta.unwrap_or(pos)]; }
        while c.idx < c.pts.len() - 1 { let w = c.pts[c.idx]; if ((w.x - pos.x).powi(2) + (w.z - pos.z).powi(2)).sqrt() < r { c.idx += 1; } else { break; } }
        let w = c.pts[c.idx.min(c.pts.len() - 1)]; let m = c.meta.unwrap_or(w); let d = ((m.x - pos.x).powi(2) + (m.z - pos.z).powi(2)).sqrt();
        if c.idx >= c.pts.len() - 1 && d <= c.tol.max(8.0) * GS { c.ok = false; return None; }
        Some(w)
    }).flatten();
    if let (Some(w), Some(l)) = (w, loco_de(bot)) { let t = ahora(); lo(&l, |l| { l.meta = Some(w); l.mirar = Some(w); l.t_ap = Some(t); }); }
}
fn tramo(c: &Camino, i: i64) -> Valor {
    let p0 = if c.pts.is_empty() { vec![c.ini.unwrap_or_default(), c.meta.or(c.ini).unwrap_or_default()] } else { c.pts.clone() };
    let k = i.clamp(0, p0.len() as i64 - 1) as usize; let w = p0[k]; let u = p0[k.saturating_sub(1)]; let d = w.sub(u); let l = d.len(); let dd = c.largos.get(k).copied().unwrap_or(0.0);
    tabla_kv(vec![("pos", vv(w)), ("type", Valor::Num(0.0)), ("how", Valor::Num(9.0)), ("distanceFromStart", Valor::Num(dd / GS)), ("length", Valor::Num(dd / GS)), ("forward", vvd(if l > 1e-4 { d.scale(1.0 / l) } else { v3(0.0, 0.0, 1.0) })), ("curvature", Valor::Num(0.0)), ("area", area(w))])
}
fn instalar_camino(e: &mut Estado) {
    let m = mt_simple("PathFollower", "PathFollower"); let i = idx(&m);
    MTS.with(|x| x.borrow_mut().insert("camino", m));
    def(&e.globales(), "Path", |_, _, o| ok1(o, Valor::Udata(Udata::nueva(Camino { tol: 25.0, ver: 300.0, idx: 1, ..Default::default() }, mt_de("camino")))));
    def(&i, "SetMinLookAheadDistance", |_, a, _| { let x = num(&ar(a, 1), 0.0); ca(&ar(a, 0), |c| c.ver = x); Ok(()) });
    def(&i, "GetMinLookAheadDistance", |_, a, o| n(o, ca(&ar(a, 0), |c| c.ver).unwrap_or(0.0)));
    def(&i, "SetGoalTolerance", |_, a, _| { let x = num(&ar(a, 1), 0.0); ca(&ar(a, 0), |c| c.tol = x); Ok(()) });
    def(&i, "GetGoalTolerance", |_, a, o| n(o, ca(&ar(a, 0), |c| c.tol).unwrap_or(0.0)));
    def(&i, "Compute", |_, a, o| { let (p, bot) = (ar(a, 0), ar(a, 1)); let Some(m) = vec_de(&ar(a, 2)) else { return b(o, false) }; if !es_ent(&bot) { return b(o, false); } let t = ahora(); ca(&p, |c| c.t0 = t); let r = calcular(&p, &bot, a_juego(m), None); b(o, r) });
    def(&i, "IsValid", |_, a, o| b(o, ca(&ar(a, 0), |c| c.ok).unwrap_or(false)));
    def(&i, "Invalidate", |_, a, _| { ca(&ar(a, 0), |c| c.ok = false); Ok(()) });
    def(&i, "GetAge", |_, a, o| { let t = ahora(); n(o, ca(&ar(a, 0), |c| t - c.t0).unwrap_or(0.0)) });
    def(&i, "ResetAge", |_, a, _| { let t = ahora(); ca(&ar(a, 0), |c| c.t0 = t); Ok(()) });
    def(&i, "GetLength", |_, a, o| n(o, ca(&ar(a, 0), |c| if c.ok { c.largos.last().copied().unwrap_or(0.0) / GS } else { 0.0 }).unwrap_or(0.0)));
    def(&i, "GetStart", |_, a, o| ok1(o, vv(ca(&ar(a, 0), |c| c.ini.unwrap_or_default()).unwrap_or_default())));
    def(&i, "GetEnd", |_, a, o| ok1(o, vv(ca(&ar(a, 0), |c| c.meta.unwrap_or_default()).unwrap_or_default())));
    let ult = |c: &Camino| if c.pts.is_empty() { 1 } else { c.pts.len() as i64 - 1 };
    def(&i, "GetCurrentGoal", |_, a, o| ok1(o, ca(&ar(a, 0), |c| tramo(c, c.idx as i64)).unwrap_or(Valor::Nil)));
    def(&i, "FirstSegment", |_, a, o| ok1(o, ca(&ar(a, 0), |c| tramo(c, 0)).unwrap_or(Valor::Nil)));
    def(&i, "LastSegment", move |_, a, o| ok1(o, ca(&ar(a, 0), |c| tramo(c, ult(c))).unwrap_or(Valor::Nil)));
    def(&i, "NextSegment", |_, a, o| ok1(o, ca(&ar(a, 0), |c| tramo(c, c.idx as i64 + 1)).unwrap_or(Valor::Nil)));
    def(&i, "PriorSegment", |_, a, o| ok1(o, ca(&ar(a, 0), |c| tramo(c, c.idx as i64 - 1)).unwrap_or(Valor::Nil)));
    def(&i, "GetAllSegments", move |_, a, o| ok1(o, ca(&ar(a, 0), |c| tab_de((0..=ult(c)).map(|k| tramo(c, k)).collect())).unwrap_or(Valor::Nil)));
    def(&i, "GetPositionOnPath", |_, a, o| { let d = num(&ar(a, 1), 0.0).max(0.0) * GS; ok1(o, vv(ca(&ar(a, 0), |c| {
        for i in 1..c.pts.len() { if c.largos[i] >= d { let (u, w) = (c.pts[i - 1], c.pts[i]); let f = (d - c.largos[i - 1]) / (c.largos[i] - c.largos[i - 1]).max(1e-6); return u.add(w.sub(u).scale(f)); } }
        c.pts.last().copied().or(c.meta).unwrap_or_default() }).unwrap_or_default())) });
    def(&i, "GetClosestPosition", |_, a, o| { let q = vec_de(&ar(a, 1)).map(a_juego); ok1(o, vv(ca(&ar(a, 0), |c| {
        let Some(q) = q else { return c.meta.unwrap_or_default() }; let (mut best, mut bd) = (c.meta.unwrap_or_default(), f64::INFINITY);
        for i in 1..c.pts.len() { let (u, w) = (c.pts[i - 1], c.pts[i]); let d = w.sub(u); let l2 = d.len_sq().max(1e-9); let t = (q.sub(u).dot(d) / l2).clamp(0.0, 1.0); let cc = u.add(d.scale(t)); let dd = cc.sub(q).len_sq(); if dd < bd { bd = dd; best = cc; } }
        best }).unwrap_or_default())) });
    def(&i, "GetCursorPosition", |_, a, o| { let p = ar(a, 0); let bot = ca(&p, |c| c.bot.clone()).flatten(); let Some(bot) = bot else { return n(o, 0.0) }; let pos = ent_pos(&bot);
        n(o, ca(&p, |c| { if c.pts.len() < 2 { return 0.0; } let i = c.idx.clamp(1, c.pts.len() - 1); let (u, w) = (c.pts[i - 1], c.pts[i]); let (dx, dz) = (w.x - u.x, w.z - u.z); let l = (dx * dx + dz * dz).sqrt().max(1e-9); let t = (((pos.x - u.x) * dx + (pos.z - u.z) * dz) / l).clamp(0.0, l); (c.largos[i - 1] + t) / GS }).unwrap_or(0.0)) });
    def(&i, "GetCursorData", |_, a, o| { let p = ar(a, 0); let bot = ca(&p, |c| c.bot.clone()).flatten(); let pos = bot.map(|b| ent_pos(&b)).unwrap_or_default(); ok1(o, tabla_kv(vec![("pos", vv(pos)), ("forward", vvd(v3(0.0, 0.0, 1.0))), ("curvature", Valor::Num(0.0))])) });
    for k in ["MoveCursorToStart", "MoveCursorToEnd", "MoveCursorTo", "MoveCursorToClosestPosition", "MoveCursor", "Draw"] { def(&i, k, nada); }
    def(&i, "GetHindrance", |_, _, o| ok1(o, null()));
    def(&i, "Update", |_, a, _| { seguir(&ar(a, 0), &ar(a, 1)); Ok(()) });
    def(&i, "Chase", |_, a, _| {
        let (p, bot, ent) = (ar(a, 0), ar(a, 1), ar(a, 2)); let t = ahora();
        if es_ent(&ent) && ce(&ent, |x| x.vivo).unwrap_or(false) && es_ent(&bot) && ca(&p, |c| !c.ok || t - c.t0 > 0.1).unwrap_or(false) { ca(&p, |c| c.t0 = t); let m = ent_pos(&ent); calcular(&p, &bot, m, Some(&ent)); }
        seguir(&p, &bot); Ok(())
    });
}
/// un área de navegación de mentira (el piso debajo de un punto)
fn area(p: V3) -> Valor {
    let c = h(|h| h.raycast(p.add(v3(0.0, 2.0, 0.0)), v3(0.0, -1.0, 0.0), 60.0, &[])).map(|x| p.add(v3(0.0, 2.0 - x.t, 0.0))).unwrap_or(p);
    let t = Tabla::nueva_ref(); t.borrow_mut().set_str("__c", vv(c)); t.borrow_mut().set_meta(mt_de("area")); Valor::Tabla(t)
}
fn instalar_nav(e: &mut Estado) {
    let m = mt_simple("CNavArea", "CNavArea"); let i = idx(&m);
    MTS.with(|x| x.borrow_mut().insert("area", m.clone()));
    let c_de = |v: &Valor| -> Valor { match v { Valor::Tabla(t) => t.borrow().get_str("__c"), _ => nv(0.0, 0.0, 0.0) } };
    let piso_de = |p: V3| h(|h| h.raycast(p.add(v3(0.0, 2.0, 0.0)), v3(0.0, -1.0, 0.0), 60.0, &[])).map(|x| p.add(v3(0.0, 2.0 - x.t, 0.0))).unwrap_or(p);
    def(&i, "GetCenter", move |_, a, o| ok1(o, c_de(&ar(a, 0))));
    def(&i, "GetClosestPointOnArea", move |_, a, o| ok1(o, match vec_de(&ar(a, 1)) { Some(p) => vv(piso_de(a_juego(p))), None => c_de(&ar(a, 0)) }));
    def(&i, "GetRandomPoint", move |e, a, o| { let c = vec_de(&c_de(&ar(a, 0))).map(a_juego).unwrap_or_default(); let (rx, rz) = (e.azar() - 0.5, e.azar() - 0.5); ok1(o, vv(piso_de(c.add(v3(rx * 8.0, 0.0, rz * 8.0))))) });
    def(&i, "GetZ", move |_, a, o| { let p = vec_de(&ar(a, 1)).map(a_juego).map(piso_de).or_else(|| vec_de(&c_de(&ar(a, 0))).map(a_juego)).unwrap_or_default(); n(o, a_source(p)[2]) });
    def(&i, "GetID", |_, _, o| n(o, 1.0)); def(&i, "GetSizeX", |_, _, o| n(o, 315.0)); def(&i, "GetSizeY", |_, _, o| n(o, 315.0));
    def(&i, "GetCorner", move |_, a, o| ok1(o, c_de(&ar(a, 0))));
    for k in ["IsValid", "Contains", "IsFlat", "IsConnected", "IsVisible", "IsOverlapping", "IsRoughlySquare"] { def(&i, k, |_, _, o| b(o, true)); }
    for k in ["IsUnderwater", "IsBlocked", "HasAttributes", "IsOpen", "IsClosed", "IsOpenListEmpty"] { def(&i, k, |_, _, o| b(o, false)); }
    for k in ["GetHidingSpots", "GetAdjacentAreas", "GetIncomingConnections", "GetLadders", "GetVisibleAreas", "GetAdjacentAreasAtSide", "GetSpotEncounters", "GetExtentInfo"] { def(&i, k, |_, _, o| ok1(o, Valor::Tabla(Tabla::nueva_ref()))); }
    for k in ["GetAdjacentCount", "GetAttributes", "ComputeAdjacentConnectionHeightChange", "ComputeGroundHeightChange", "GetCostSoFar", "GetTotalCost"] { def(&i, k, |_, _, o| n(o, 0.0)); }
    def(&i, "GetPlace", |_, _, o| ok1(o, cad("")));
    for k in ["SetAttributes", "AddHidingSpot", "Draw", "DrawSpots", "Remove", "SetPlace", "ClearSearchLists", "AddToClosedList", "AddToOpenList", "RemoveFromClosedList", "SetCostSoFar", "SetTotalCost", "SetParent", "UpdateOnOpenList"] { def(&i, k, nada); }
    let nav = lib(e, "navmesh");
    def(&nav, "IsLoaded", |_, _, o| b(o, true)); def(&nav, "GetNavAreaCount", |_, _, o| n(o, 1.0)); def(&nav, "IsGenerating", |_, _, o| b(o, false));
    for k in ["GetAllNavAreas", "Find", "FindInBox", "GetPlayerSpawnPoints"] { def(&nav, k, |_, _, o| ok1(o, Valor::Tabla(Tabla::nueva_ref()))); }
    for k in ["GetNavLadderByID", "GetMarkedArea", "GetMarkedLadder"] { def(&nav, k, nada); }
    for k in ["GetNearestNavArea", "GetNavArea"] { def(&nav, k, |_, a, o| ok1(o, area(vec_de(&ar(a, 0)).map(a_juego).unwrap_or_default()))); }
    def(&nav, "GetNavAreaByID", |_, _, o| { let j = g(|g| g.jug.clone()); ok1(o, area(ent_pos(&j))) });
    for k in ["BeginGeneration", "Load", "Save", "Reset", "AddWalkableSeed", "ClearWalkableSeeds", "SetMarkedArea", "SetMarkedLadder", "SetPlayerSpawnName"] { def(&nav, k, nada); }
    def(&nav, "GetGroundHeight", |_, a, o| { let Some(p) = vec_de(&ar(a, 0)) else { return Ok(()) }; let gp = a_juego(p).add(v3(0.0, 0.5, 0.0)); match h(|h| h.raycast(gp, v3(0.0, -1.0, 0.0), 400.0, &[])) { Some(x) => { o.push(Valor::Num(a_source(gp.add(v3(0.0, -x.t, 0.0)))[2])); o.push(nv(0.0, 0.0, 1.0)); Ok(()) } None => Ok(()) } });
}

// ---------------- la API en las entidades (gmnbApi) ----------------
fn instalar_api(_e: &mut Estado) {
    let Some(em) = g(|g| g.mt.ent_m.clone()) else { return };
    let orig = |k: &str| em.borrow().get_str(k);
    // (en los nextbots y en la vista; en lo demás, lo que había)
    let envolver = |k: &str, f: Rc<dyn Fn(&mut Estado, &[Valor], &mut Vec<Valor>) -> R>| {
        let o0 = orig(k);
        def(&em, k, move |e, a, o| { let x = ar(a, 0); if es_nb(&x) || es_vm(&x) { return f(e, a, o); } if let Valor::Func(_) = o0 { o.extend(e.llamar_aqui(&o0, a)?); } Ok(()) });
    };
    let id0 = |a: &[Valor]| ent_id(&ar(a, 0)).unwrap_or(-1);
    def(&em, "StartActivity", |e, a, _| { actos(e); let x = ar(a, 0); let act = num(&ar(a, 1), 0.0) as i32; if let Some(id) = ent_id(&x) { an(id, |s| { s.act = act; s.rate = Some(1.0); }); } secuencia(&x, Pide::Act(act)); Ok(()) });
    def(&em, "GetActivity", move |_, a, o| n(o, an_ver(id0(a), |s| s.act).unwrap_or(0) as f64));
    def(&em, "IsNextBot", |_, a, o| b(o, es_nb(&ar(a, 0))));
    def(&em, "BodyMoveXY", |_, a, _| {
        let x = ar(a, 0); if !es_nb(&x) { return Ok(()); } let Some(id) = ent_id(&x) else { return Ok(()) };
        let Some(md) = modelo_ent(&x) else { return Ok(()) }; let Some(l) = loco_de(&x) else { return Ok(()) };
        let Some((v, suelo)) = lo(&l, |l| (l.v, l.suelo)) else { return Ok(()) }; let Some(s) = an_ver(id, |s| s.sec).flatten() else { return Ok(()) };
        if !suelo { return Ok(()); }
        let vs = vsr(v); let sp = (vs[0] * vs[0] + vs[1] * vs[1]).sqrt(); if sp < 1.0 { return Ok(()); }
        let r = vs[1].atan2(vs[0]) - quat_ang(ent_q(&x))[1] * RAD; let pp = &md.m.pose_params;
        let g0 = an(id, |s| {
            if pp.iter().any(|k| k == "move_x" || k == "move_y") { s.pose.insert("move_x".into(), r.cos() as f32); s.pose.insert("move_y".into(), -r.sin() as f32); }
            if pp.iter().any(|k| k == "move_yaw") { s.pose.insert("move_yaw".into(), nrm(r / RAD) as f32); }
            s.pose.clone()
        });
        let gs = gmf::sec_vel_suelo(&md.m, s.i, &|k| g0.get(k).copied()) as f64 * escala(&x);
        if gs > 0.5 { an(id, |s| s.rate = Some((sp / gs).min(10.0))); }
        Ok(())
    });
    def(&em, "GetRangeTo", |_, a, o| { let p = ent_pos(&ar(a, 0)); let q = { let y = ar(a, 1); if es_ent(&y) { ent_pos(&y) } else { vec_de(&y).map(a_juego).unwrap_or(p) } }; n(o, p.sub(q).len() / GS) });
    def(&em, "GetRangeSquaredTo", |_, a, o| { let p = ent_pos(&ar(a, 0)); let q = { let y = ar(a, 1); if es_ent(&y) { ent_pos(&y) } else { vec_de(&y).map(a_juego).unwrap_or(p) } }; let d = p.sub(q).len() / GS; n(o, d * d) });
    def(&em, "IsAbleToSee", |_, a, o| {
        let (x, y) = (ar(a, 0), ar(a, 1)); if !es_ent(&y) || !ce(&y, |z| z.vivo).unwrap_or(false) { return b(o, false); }
        let pa = ent_pos(&x).add(v3(0.0, 1.5, 0.0)); let pb = ent_pos(&y).add(v3(0.0, 1.2, 0.0)); let d = pb.sub(pa); let l = d.len();
        let ign: Vec<ObjId> = ce(&x, |z| z.o).flatten().into_iter().collect();
        let hh = h(|h| h.raycast(pa, d.scale(1.0 / l.max(1e-4)), l, &ign)); b(o, hh.map(|g| g.t > l - 0.6).unwrap_or(true))
    });
    for (k, v) in [("GetFOV", 90.0), ("GetMaxVisionRange", 1e4), ("GetSolidMask", 33570827.0)] { def(&em, k, move |_, _, o| n(o, v)); }
    for k in ["SetFOV", "SetMaxVisionRange", "SetSolidMask"] { def(&em, k, nada); }
    let pps = |x: &Valor| modelo_ent(x).map(|m| m.m.pose_params.clone()).unwrap_or_default();
    envolver("GetNumPoseParameters", Rc::new(move |_, a, o| n(o, pps(&ar(a, 0)).len() as f64)));
    envolver("GetPoseParameterName", Rc::new(move |_, a, o| ok1(o, cad(pps(&ar(a, 0)).get(num(&ar(a, 1), 0.0) as usize).map(|s| s.as_str()).unwrap_or("")))));
    envolver("LookupPoseParameter", Rc::new(move |_, a, o| { let k = js_str(&ar(a, 1)).to_lowercase(); n(o, pps(&ar(a, 0)).iter().position(|x| x.to_lowercase() == k).map(|x| x as f64).unwrap_or(-1.0)) }));
    envolver("GetPoseParameterRange", Rc::new(|_, a, o| { let r = modelo_ent(&ar(a, 0)).and_then(|m| m.m.pose_rangos.get(num(&ar(a, 1), 0.0) as usize).copied()).unwrap_or([0.0, 1.0]); o.push(Valor::Num(r[0] as f64)); o.push(Valor::Num(r[1] as f64)); Ok(()) }));
    let pp_nom = move |x: &Valor, k: &Valor| -> String { match k { Valor::Num(i) => pps(x).get(*i as usize).cloned().unwrap_or_default(), Valor::Nil => String::new(), _ => js_str(k) } };
    envolver("SetPoseParameter", Rc::new(move |_, a, _| { let x = ar(a, 0); let k = pp_nom(&x, &ar(a, 1)); let v = num(&ar(a, 2), 0.0); if !k.is_empty() { if let Some(id) = ent_id(&x) { an(id, |s| { s.pose.insert(k, if v.is_nan() { 0.0 } else { v as f32 }); }); } } Ok(()) }));
    envolver("GetPoseParameter", Rc::new(move |_, a, o| { let x = ar(a, 0); let k = pp_nom(&x, &ar(a, 1)); n(o, ent_id(&x).and_then(|id| an_ver(id, |s| s.pose.get(&k).copied())).flatten().unwrap_or(0.0) as f64) }));
    envolver("ClearPoseParameters", Rc::new(|_, a, _| { if let Some(id) = ent_id(&ar(a, 0)) { an(id, |s| s.pose.clear()); } Ok(()) }));
    let sec = |x: &Valor, s: &Valor| -> f64 { match s { Valor::Num(i) => secuencia(x, Pide::Idx(*i as i64)), _ => secuencia(x, Pide::Nombre(js_str(s))) } };
    envolver("SetSequence", Rc::new(move |_, a, _| { sec(&ar(a, 0), &ar(a, 1)); Ok(()) }));
    envolver("ResetSequence", Rc::new(move |_, a, o| { let x = ar(a, 0); if let Some(id) = ent_id(&x) { an(id, |s| s.rate = Some(1.0)); } n(o, sec(&x, &ar(a, 1))) }));
    envolver("SendViewModelMatchingSequence", Rc::new(move |_, a, _| { sec(&ar(a, 0), &ar(a, 1)); Ok(()) }));
    envolver("ResetSequenceInfo", Rc::new(|_, a, _| { if let Some(id) = ent_id(&ar(a, 0)) { an(id, |s| s.rate = Some(1.0)); } Ok(()) }));
    envolver("LookupSequence", Rc::new(|_, a, o| {
        let k = js_str(&ar(a, 1)).to_lowercase(); let r = modelo_ent(&ar(a, 0)).and_then(|md| { let i = md.m.secuencias.iter().position(|s| s.n.to_lowercase() == k)?; let an_ = md.m.anims.get(md.m.secuencias[i].anim.max(0) as usize); Some((i as f64, an_.map(|a| (a.nf - 1).max(0) as f64 / if a.fps > 0.0 { a.fps as f64 } else { 30.0 }).unwrap_or(0.0))) });
        let (i, d) = r.unwrap_or((-1.0, 0.0)); o.push(Valor::Num(i)); o.push(Valor::Num(d)); Ok(())
    }));
    envolver("SequenceDuration", Rc::new(|_, a, o| { let x = ar(a, 0); let k = sec_de(&x, &ar(a, 1)); let id = ent_id(&x).unwrap_or(-1); let pv = pose_vals(id); n(o, modelo_ent(&x).filter(|m| k >= 0 && (k as usize) < m.m.secuencias.len()).map(|m| gmf::sec_dur(&m.m, k as usize, &|q| pv.get(q).copied()) as f64).unwrap_or(0.0)) }));
    envolver("GetVelocity", Rc::new(|_, a, o| { let x = ar(a, 0); let v = loco_de(&x).and_then(|l| lo(&l, |l| l.v)).unwrap_or_default(); ok1(o, vvr(v)) }));
    envolver("GetSequenceGroundSpeed", Rc::new(|_, a, o| { let x = ar(a, 0); let k = sec_de(&x, &ar(a, 1)); let pv = pose_vals(ent_id(&x).unwrap_or(-1)); n(o, modelo_ent(&x).filter(|m| k >= 0 && (k as usize) < m.m.secuencias.len()).map(|m| gmf::sec_vel_suelo(&m.m, k as usize, &|q| pv.get(q).copied()) as f64 * escala(&x)).unwrap_or(0.0)) }));
    envolver("GetSequenceMoveDist", Rc::new(|_, a, o| { let x = ar(a, 0); let k = sec_de(&x, &ar(a, 1)); let pv = pose_vals(ent_id(&x).unwrap_or(-1)); n(o, modelo_ent(&x).filter(|m| k >= 0 && (k as usize) < m.m.secuencias.len()).map(|m| { let (ok, p, _) = gmf::sec_mov(&m.m, k as usize, &|q| pv.get(q).copied(), 0.0, 1.0); if ok { ((p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) as f64).sqrt() } else { 0.0 } }).unwrap_or(0.0)) }));
    envolver("GetSequenceMovement", Rc::new(|_, a, o| { let x = ar(a, 0); let k = sec_de(&x, &ar(a, 1)); let pv = pose_vals(ent_id(&x).unwrap_or(-1)); let (c0, c1) = (num(&ar(a, 2), 0.0), if ar(a, 3).es_nil() { 1.0 } else { num(&ar(a, 3), 0.0) });
        let r = modelo_ent(&x).filter(|m| k >= 0 && (k as usize) < m.m.secuencias.len()).map(|m| gmf::sec_mov(&m.m, k as usize, &|q| pv.get(q).copied(), c0 as f32, c1 as f32));
        let (ok, p, y) = r.unwrap_or((false, [0.0; 3], 0.0)); o.push(Valor::Bool(ok)); o.push(nv(p[0] as f64, p[1] as f64, p[2] as f64)); o.push(na(0.0, y as f64, 0.0)); Ok(()) }));
    envolver("GetSequence", Rc::new(move |_, a, o| n(o, an_ver(id0(a), |s| s.sec.map(|x| x.i)).flatten().unwrap_or(0) as f64)));
    envolver("SetPlaybackRate", Rc::new(move |_, a, _| { let r = num(&ar(a, 1), 0.0); an(id0(a), |s| s.rate = Some(if r.is_nan() { 0.0 } else { r })); Ok(()) }));
    envolver("GetPlaybackRate", Rc::new(move |_, a, o| n(o, an_ver(id0(a), |s| s.rate).flatten().unwrap_or(1.0))));
    envolver("SetCycle", Rc::new(move |_, a, _| { let c = num(&ar(a, 1), 0.0); an(id0(a), |s| if let Some(x) = &mut s.sec { x.t = if c.is_nan() { 0.0 } else { c } * x.dur; }); Ok(()) }));
    envolver("GetCycle", Rc::new(move |_, a, o| n(o, an_ver(id0(a), |s| s.sec.map(|x| if x.dur > 0.0 { if x.lp { (x.t / x.dur) % 1.0 } else { (x.t / x.dur).min(1.0) } } else { 0.0 })).flatten().unwrap_or(0.0))));
    envolver("FrameAdvance", Rc::new(|_, _, _| Ok(())));
    envolver("SelectWeightedSequence", Rc::new(|e, a, o| { actos(e); let x = ar(a, 0); let act = num(&ar(a, 1), 0.0) as i32; let Some(md) = modelo_ent(&x) else { return n(o, -1.0) }; let l = secs_de_act(&md.m, act); match l.first() { Some(&i) => { alias(ent_id(&x).unwrap_or(-1), &md.m, i, act); n(o, i as f64) } None => n(o, -1.0) } }));
    envolver("SelectWeightedSequenceSeeded", Rc::new(|e, a, o| { actos(e); let x = ar(a, 0); let act = num(&ar(a, 1), 0.0) as i32; let Some(md) = modelo_ent(&x) else { return n(o, -1.0) }; let l = secs_de_act(&md.m, act); for &i in &l { alias(ent_id(&x).unwrap_or(-1), &md.m, i, act); } if l.is_empty() { return n(o, -1.0); } n(o, l[(num(&ar(a, 2), 0.0).floor().abs() as usize) % l.len()] as f64) }));
    envolver("GetSequenceActivity", Rc::new(|e, a, o| { actos(e); let x = ar(a, 0); let i = num(&ar(a, 1), -1.0) as i64; if let Some(Some(v)) = ent_id(&x).and_then(|id| an_ver(id, |s| s.alias.get(&(i as usize)).copied())) { return n(o, v as f64); } n(o, modelo_ent(&x).and_then(|m| m.m.secuencias.get(i.max(0) as usize).filter(|_| i >= 0).and_then(|s| act_de(&s.act))).unwrap_or(-1) as f64) }));
    envolver("GetSequenceList", Rc::new(|_, a, o| { let t = Tabla::nueva_ref(); if let Some(m) = modelo_ent(&ar(a, 0)) { for (i, s) in m.m.secuencias.iter().enumerate() { let _ = t.borrow_mut().set(Valor::Num(i as f64), cad(&s.n)); } } ok1(o, Valor::Tabla(t)) }));
    envolver("GetSequenceCount", Rc::new(|_, a, o| n(o, modelo_ent(&ar(a, 0)).map(|m| m.m.secuencias.len()).unwrap_or(0) as f64)));
    envolver("GetSequenceInfo", Rc::new(|e, a, o| { actos(e); let Some(m) = modelo_ent(&ar(a, 0)) else { return Ok(()) }; let Some(s) = m.m.secuencias.get(num(&ar(a, 1), -1.0).max(0.0) as usize) else { return Ok(()) }; let an_ = m.m.anims.get(s.anim.max(0) as usize);
        let anims: Vec<Valor> = s.grid.clone().unwrap_or(vec![s.anim]).into_iter().filter(|&x| x >= 0).map(|x| Valor::Num(x as f64)).collect();
        ok1(o, tabla_kv(vec![("label", cad(&s.n)), ("activityname", cad(&s.act)), ("activity", Valor::Num(act_de(&s.act).unwrap_or(-1) as f64)), ("numframes", Valor::Num(an_.map(|a| a.nf).unwrap_or(1) as f64)), ("fps", Valor::Num(an_.map(|a| a.fps).unwrap_or(30.0) as f64)), ("flags", Valor::Num(s.flags as f64)), ("anims", tab_de(anims))])) }));
    envolver("GetAnimInfo", Rc::new(|_, a, o| { let Some(m) = modelo_ent(&ar(a, 0)) else { return Ok(()) }; let Some(an_) = m.m.anims.get(num(&ar(a, 1), -1.0).max(0.0) as usize) else { return Ok(()) }; ok1(o, tabla_kv(vec![("label", cad(&an_.n)), ("fps", Valor::Num(an_.fps as f64)), ("numframes", Valor::Num(an_.nf as f64))])) }));
    envolver("GetAnimCount", Rc::new(|_, a, o| n(o, modelo_ent(&ar(a, 0)).map(|m| m.m.anims.len()).unwrap_or(0) as f64)));
    envolver("GetSequenceName", Rc::new(|_, a, o| { let x = ar(a, 0); let i = if ar(a, 1).es_nil() { sec_de(&x, &Valor::Nil).max(0) } else { num(&ar(a, 1), 0.0) as i64 }; ok1(o, cad(&modelo_ent(&x).and_then(|m| m.m.secuencias.get(i.max(0) as usize).map(|s| s.n.clone())).unwrap_or_else(|| "Unknown".into()))) }));
    envolver("GetSequenceActivityName", Rc::new(|_, a, o| { let x = ar(a, 0); let i = if ar(a, 1).es_nil() { sec_de(&x, &Valor::Nil).max(0) } else { num(&ar(a, 1), 0.0) as i64 }; ok1(o, cad(&modelo_ent(&x).and_then(|m| m.m.secuencias.get(i.max(0) as usize).map(|s| s.act.clone())).unwrap_or_default())) }));
    // (huesos y enganches del modelo, en el mundo)
    let mundo = |x: &Valor| -> Option<(Rc<Modelo>, Vec<[f32; 12]>)> { let md = modelo_ent(x)?; let s = ent_id(x).and_then(|id| an_ver(id, |a| a.sec)).flatten(); let w = mundo_de(&md, s.as_ref()); Some((md, w)) };
    let a_mundo = |x: &Valor, m: [f32; 12]| -> (V3, [f64; 3]) {
        let (p, q) = (ent_pos(x), ent_q(x)); let s = escala(x);
        let lp = vg([m[3] as f64, m[7] as f64, m[11] as f64], 0.0).scale(s); let wp = p.add(q.rot(lp));
        let fw = q.rot(dg([m[0] as f64, m[4] as f64, m[8] as f64])); let lf = q.rot(dg([m[1] as f64, m[5] as f64, m[9] as f64])); let up = q.rot(dg([m[2] as f64, m[6] as f64, m[10] as f64]));
        (wp, mat_ang(ds(fw), ds(lf), ds(up)))
    };
    envolver("LookupBone", Rc::new(|_, a, o| { let k = js_str(&ar(a, 1)).to_lowercase(); match modelo_ent(&ar(a, 0)).and_then(|m| m.m.huesos.iter().position(|h| h.n.to_lowercase() == k)) { Some(i) => n(o, i as f64), None => Ok(()) } }));
    envolver("GetBoneCount", Rc::new(|_, a, o| n(o, modelo_ent(&ar(a, 0)).map(|m| m.m.huesos.len()).unwrap_or(0) as f64)));
    envolver("GetBoneName", Rc::new(|_, a, o| ok1(o, cad(&modelo_ent(&ar(a, 0)).and_then(|m| m.m.huesos.get(num(&ar(a, 1), 0.0).max(0.0) as usize).map(|h| h.n.clone())).unwrap_or_else(|| "__INVALIDBONE__".into())))));
    envolver("GetBoneParent", Rc::new(|_, a, o| n(o, modelo_ent(&ar(a, 0)).and_then(|m| m.m.huesos.get(num(&ar(a, 1), 0.0).max(0.0) as usize).map(|h| h.pa)).unwrap_or(-1) as f64)));
    envolver("GetBonePosition", Rc::new(move |_, a, o| { let x = ar(a, 0); let i = num(&ar(a, 1), 0.0) as usize; match mundo(&x).and_then(|(_, w)| w.get(i).copied()) { Some(m) => { let (p, an_) = a_mundo(&x, m); o.push(vv(p)); o.push(naa(an_)); Ok(()) } None => { o.push(vv(ent_pos(&x))); o.push(naa(quat_ang(ent_q(&x)))); Ok(()) } } }));
    envolver("GetBoneMatrix", Rc::new(|_, _, _| Ok(())));
    envolver("LookupAttachment", Rc::new(|_, a, o| { let k = js_str(&ar(a, 1)).to_lowercase(); n(o, modelo_ent(&ar(a, 0)).and_then(|m| m.m.adjuntos.iter().position(|x| x.n.to_lowercase() == k)).map(|i| i as f64 + 1.0).unwrap_or(0.0)) }));
    envolver("GetAttachment", Rc::new(move |_, a, o| {
        let x = ar(a, 0); let i = num(&ar(a, 1), 0.0) as i64 - 1; let Some((md, w)) = mundo(&x) else { return Ok(()) };
        let Some(ad) = md.m.adjuntos.get(i.max(0) as usize).filter(|_| i >= 0) else { return Ok(()) };
        let m = if ad.hueso >= 0 && (ad.hueso as usize) < w.len() { gmf::mul34(&w[ad.hueso as usize], &ad.m) } else { ad.m };
        let (p, an_) = a_mundo(&x, m); ok1(o, tabla_kv(vec![("Pos", vv(p)), ("Ang", naa(an_)), ("Bone", Valor::Num(ad.hueso as f64))]))
    }));
    envolver("GetAttachments", Rc::new(|_, a, o| { let l: Vec<Valor> = modelo_ent(&ar(a, 0)).map(|m| m.m.adjuntos.iter().enumerate().map(|(i, x)| tabla_kv(vec![("id", Valor::Num(i as f64 + 1.0)), ("name", cad(&x.n))])).collect()).unwrap_or_default(); ok1(o, tab_de(l)) }));
    def(&em, "BecomeRagdoll", |e, a, o| { let x = ar(a, 0); if es_nb(&x) { quitar(e, &x); } ok1(o, null()) });
}

// ---------------- los nextbots en cada cuadro ----------------
/// gmaSpawn, antes del Initialize: si es un nextbot, su locomoción
pub(crate) fn nb_antes(ent: &Valor) -> bool {
    let Some((clase, id)) = ce(ent, |x| (x.clase.clone(), x.id)) else { return false };
    let es = clase_tabla(&clase, Lado::S).map(|t| js_str(&buscar_en_clase(&t, "Type")) == "nextbot").unwrap_or(false);
    if !es { return false; }
    let l = loco_nuevo(id);
    an(id, |a| { a.nb = true; a.loco = Some(l.clone()); });
    ce(ent, |x| x.mov = Some(0.0));
    if let Some(t) = tabla_de(ent) { if t.borrow().get_str("loco").es_nil() { t.borrow_mut().set_str("loco", l); } }
    true
}
/// después del Initialize: congelado y BehaveStart
pub(crate) fn nb_despues(e: &mut Estado, ent: &Valor) {
    if !es_nb(ent) { return; }
    if let Some(Some(o)) = ce(ent, |x| x.o) { cuerpo(o, |b| { b.congelado = true; b.cambios |= CUERPO_CONGELADO; }); }
    metodo(e, ent, "BehaveStart", Lado::S, &[]);
}
/// gmnbPaso
pub(crate) fn nb_paso(e: &mut Estado, dt: f64) {
    let ids: Vec<i64> = e3(|s| s.anim.iter().filter(|(_, a)| a.nb).map(|(k, _)| *k).collect());
    if ids.is_empty() { return; }
    actos(e);
    for id in ids {
        let ent = ent_por_id(id);
        if !es_ent(&ent) || !ce(&ent, |x| x.vivo).unwrap_or(false) { e3(|s| { s.anim.remove(&id); }); continue; }
        // (lo pedido antes de que estuviera el modelo; sin nada pedido, la secuencia 0)
        if let Some(q) = an_ver(id, |a| a.pide.clone()).flatten() { if modelo_ent(&ent).is_some() { secuencia(&ent, q); } }
        if an_ver(id, |a| a.sec.is_none() && a.pide.is_none()).unwrap_or(false) && modelo_ent(&ent).map(|m| !m.m.secuencias.is_empty()).unwrap_or(false) { secuencia(&ent, Pide::Idx(0)); }
        metodo(e, &ent, "BehaveUpdate", Lado::S, &[Valor::Num(dt)]);
        if !ce(&ent, |x| x.vivo).unwrap_or(false) { continue; }
        mover(e, &ent, dt);
        if !ce(&ent, |x| x.vivo).unwrap_or(false) { continue; }
        metodo(e, &ent, "BodyUpdate", Lado::S, &[]);
        // (avanza la secuencia y sus eventos)
        let r = an(id, |a| { let rate = a.rate.unwrap_or(1.0); a.sec.as_mut().map(|s| { let c0 = if s.dur > 0.0 { s.t / s.dur } else { 1.0 }; s.t += dt * rate; (s.i, c0, if s.dur > 0.0 { s.t / s.dur } else { 1.0 }, s.lp) }) });
        if let (Some((i, c0, c1, lp)), Some(md)) = (r, modelo_ent(&ent)) {
            if let Some(q) = md.m.secuencias.get(i) { if c1 > c0 { for x in q.ev.clone() {
                let c = x.c as f64; let cruza = if lp { if c1.floor() > c0.floor() { c > c0 % 1.0 || c <= c1 % 1.0 } else { c > c0 % 1.0 && c <= c1 % 1.0 } } else { c > c0 && c <= c1 };
                if cruza { let op = if x.op.is_empty() { x.n.clone() } else { x.op.clone() }; metodo(e, &ent, "HandleAnimEvent", Lado::S, &[Valor::Num(x.ev as f64), Valor::Num(ahora()), Valor::Num(c), Valor::Num(x.tipo as f64), cad(&op)]); if !ce(&ent, |y| y.vivo).unwrap_or(false) { break; } }
            } } }
        }
    }
}
/// gmnbMover: la locomoción de suelo
fn mover(e: &mut Estado, ent: &Valor, dt: f64) {
    let Some(lv) = loco_de(ent) else { return };
    let pos = ent_pos(ent); let t = ahora(); let ign = ignorar(ent, None);
    let Some((mut v, suelo, paso, quiere, meta)) = lo(&lv, |l| {
        let quiere = l.t_ap.map(|x| t - x < 0.25).unwrap_or(false);
        if let Some(m) = l.meta { let mut d = m.sub(pos); d.y = 0.0; let ll = d.len(); if ll > 0.02 { l.dir_mov = Some(d.scale(1.0 / ll)); l.dist_meta = ll; } else { l.dist_meta = 0.0; } }
        (l.v, l.suelo, l.paso, quiere, l.meta)
    }) else { return };
    let mut vh = v3(v.x, 0.0, v.z);
    if suelo && !quiere { vh = V3::default(); lo(&lv, |l| l.dir_mov = None); }
    else if suelo { if let Some((m, vel0, acel, decel, dm)) = lo(&lv, |l| l.dir_mov.map(|m| (m, l.vel0, l.acel, l.decel, l.dist_meta))).flatten() {
        let der = v3(m.z, 0.0, -m.x); let (fw, sd) = (vh.dot(m), vh.dot(der));
        let mt = if meta.is_some() { (vel0 * GS).min(dm / dt.max(1e-3)) } else { fw };
        let fw2 = if fw < mt { mt.min(fw + acel * GS * dt) } else { mt.max(fw - decel * GS * dt) }; let sd2 = sd * (-3.0 * dt).exp();
        vh = v3(m.x * fw2 + der.x * sd2, 0.0, m.z * fw2 + der.z * sd2);
    } }
    v.x = vh.x; v.z = vh.z;
    let sube = paso * GS; let r = medidas(ent).r.max(0.25);
    let mut hv = (v.x * v.x + v.z * v.z).sqrt(); let mut toca: Vec<Valor> = vec![];
    for k in 0..3 {
        if hv <= 0.05 { break; }
        let dir = v3(v.x / hv, 0.0, v.z / hv);
        let Some(gp) = h(|h| h.raycast(pos.add(v3(0.0, sube + 0.1, 0.0)), dir, hv * dt + r, &ign.objs)) else { break };
        let otra = match (gp.obj, gp.persona) { (Some(o), _) => Some(ent_de_obj(o)), (None, Some(_)) => Some(g(|g| g.jug.clone())), _ => None };
        if let Some(x) = &otra { if es_ent(x) && !mismo(x, ent) { toca.push(x.clone()); } }
        let es_persona = gp.persona.is_some() || otra.as_ref().map(es_nb).unwrap_or(false);
        let (nx, nz) = (gp.n.x, gp.n.z); let nl = (nx * nx + nz * nz).sqrt();
        if es_persona { let p_ = hv * dt; let kk = if p_ > 1e-6 { ((gp.t - r) / p_).clamp(0.0, 1.0) } else { 0.0 }; v.x *= kk; v.z *= kk; break; }
        if nl < 0.3 { v.x = 0.0; v.z = 0.0; hv = 0.0; break; }
        let vn = (v.x * nx + v.z * nz) / nl; if vn >= 0.0 { break; }
        v.x -= nx / nl * vn; v.z -= nz / nl * vn; hv = (v.x * v.x + v.z * v.z).sqrt();
        if k == 2 { v.x = 0.0; v.z = 0.0; hv = 0.0; }
    }
    for x in toca { let id = ent_id(&x).unwrap_or(-1); let nuevo = lo(&lv, |l| { let t0 = l.toques.get(&id).copied().unwrap_or(-1.0); if t - t0 < 0.25 { false } else { l.toques.insert(id, t); if l.toques.len() > 32 { l.toques.clear(); } true } }).unwrap_or(false); if nuevo { metodo(e, ent, "OnContact", Lado::S, &[x]); } }
    let mut nuevo = pos.add(v.scale(dt));
    let grav = lo(&lv, |l| l.grav).unwrap_or(1000.0);
    if !suelo { v.y -= grav * GS * dt; }
    let alcance = sube + (if suelo && v.y <= 0.01 { sube } else { 0.05 }).max(-v.y * dt) + 0.02;
    let hh = h(|h| h.raycast(nuevo.add(v3(0.0, sube, 0.0)), v3(0.0, -1.0, 0.0), alcance, &ign.objs));
    let suelo2 = match hh { Some(x) if v.y <= 0.01 => { nuevo.y = nuevo.y + sube - x.t; v.y = 0.0; true } _ => false };
    let aviso = lo(&lv, |l| { l.v = v; l.suelo = suelo2; let a = if l.suelo_aviso != Some(suelo2) { let r = l.vio_suelo; l.suelo_aviso = Some(suelo2); r } else { false }; if suelo2 { l.vio_suelo = true; } a }).unwrap_or(false);
    if aviso { let m = g(|g| g.mundo.clone()); metodo(e, ent, if suelo2 { "OnLandOnGround" } else { "OnLeaveGround" }, Lado::S, &[m]); }
    if !ce(ent, |x| x.vivo).unwrap_or(false) { return; }
    let anduvo = ((nuevo.x - pos.x).powi(2) + (nuevo.z - pos.z).powi(2)).sqrt();
    let ev = lo(&lv, |l| {
        if l.meta.is_some() && anduvo < 0.3 * dt { l.t_trabado += dt; if l.t_trabado > 1.0 && !l.trabado { l.trabado = true; return Some("OnStuck"); } }
        else if anduvo >= 0.3 * dt { l.t_trabado = 0.0; if l.trabado { l.trabado = false; return Some("OnUnStuck"); } }
        None
    }).flatten();
    if let Some(k) = ev { metodo(e, ent, k, Lado::S, &[]); if !ce(ent, |x| x.vivo).unwrap_or(false) { return; } }
    let (mirar, giro) = lo(&lv, |l| (l.mirar, l.giro)).unwrap_or((None, 200.0));
    let obj = match mirar { Some(m) => Some(m.sub(pos)), None => if hv > 0.1 { Some(v3(v.x, 0.0, v.z)) } else { None } };
    let mut yaw = quat_ang(ent_q(ent))[1];
    if let Some(ob) = obj { if (ob.x * ob.x + ob.z * ob.z).sqrt() > 0.01 { let mt = ob.x.atan2(ob.z) / RAD; let d = ((mt - yaw) % 360.0 + 540.0) % 360.0 - 180.0; let mx = (if giro > 0.0 { giro } else { 200.0 }) * dt; yaw += d.clamp(-mx, mx); } }
    let q = ang_quat([0.0, yaw, 0.0]);
    match ce(ent, |x| x.o).flatten() {
        Some(o) => { origen_pon(o, nuevo, Some(q)); cuerpo(o, |b| { b.q = q; b.vel = V3::default(); b.ang = V3::default(); b.congelado = true; b.cambios |= CUERPO_Q | CUERPO_VEL | CUERPO_ANG | CUERPO_CONGELADO; }); }
        None => { ce(ent, |x| { x.pos = nuevo; x.q = q; }); }
    }
    lo(&lv, |l| { l.meta = None; l.mirar = None; });
}

// ---------------- la vista del arma del addon ----------------
/// el ViewModel del arma que tiene el jugador (si su modelo está en un addon)
fn vista_modelo() -> Option<String> {
    let w = g(|g| g.swep.clone())?; let clase = ce(&w, |x| x.clase.clone())?;
    let t = clase_tabla(&clase, Lado::C).or_else(|| clase_tabla(&clase, Lado::S))?;
    let r = ruta_mdl(&js_str(&buscar_en_clase(&t, "ViewModel"))); if r.is_empty() || archivo(&r).is_none() { return None; } Some(r)
}
fn vista_id() -> Option<i64> { g(|g| g.swep.clone()).and_then(|w| ent_id(&w)) }
/// SendWeaponAnim: la secuencia del ViewModel con esa actividad (devuelve si la tenía)
pub(crate) fn vista_act(e: &mut Estado, act: i32) -> bool {
    actos(e);
    let (Some(r), Some(id)) = (vista_modelo(), vista_id()) else { return false }; let Some(md) = modelo(&r) else { return false };
    let nom = act_nombre(act); let m = &md.m;
    let i = m.secuencias.iter().position(|s| !s.act.is_empty() && s.act.eq_ignore_ascii_case(&nom))
        .or_else(|| { let re: &[&str] = match nom.as_str() { "ACT_VM_IDLE" => &["idle"], "ACT_VM_DRAW" | "ACT_VM_DEPLOY" => &["draw", "deploy"], "ACT_VM_RELOAD" => &["reload"], "ACT_VM_PRIMARYATTACK" | "ACT_VM_SECONDARYATTACK" | "ACT_VM_HITCENTER" | "ACT_VM_MISSCENTER" => &["fire", "shoot", "attack", "hit"], _ => &[] }; m.secuencias.iter().position(|s| { let n2 = s.n.to_lowercase(); re.iter().any(|k| n2.contains(k)) }) });
    let Some(i) = i else { return false };
    let s = &m.secuencias[i]; let ai = s.anim.max(0) as usize; let Some(a) = m.anims.get(ai) else { return false };
    let dur = (a.nf - 1).max(0) as f64 / if a.fps > 0.0 { a.fps as f64 } else { 30.0 };
    an(id, |x| { x.sec = Some(SecEnt { i, anim: ai, t: 0.0, lp: s.lp, dur }); x.rate = Some(1.0); }); true
}
/// lo que hace falta para dibujar la vista del arma del addon
pub struct VistaArma { pub modelo: String, pub fov: f64, pub flip: bool, pub huesos: Vec<[f32; 12]>, pub piel: i32, pub lugar: Option<(V3, Quat)> }
fn vista_cuadro(e: &mut Estado, dt: f64) -> Option<VistaArma> {
    let r = vista_modelo()?; let id = vista_id()?; let md = modelo(&r)?;
    let w = g(|g| g.swep.clone())?; let clase = ce(&w, |x| x.clase.clone())?; let t = clase_tabla(&clase, Lado::C).or_else(|| clase_tabla(&clase, Lado::S))?;
    let fov = { let f = num(&buscar_en_clase(&t, "ViewModelFOV"), 62.0); if f > 0.0 { f } else { 62.0 } }; let flip = t_(&buscar_en_clase(&t, "ViewModelFlip"));
    // (recién sacada: la de sacar; terminada una que no es bucle, la de quieto)
    if an_ver(id, |a| a.sec.is_none()).unwrap_or(true) { let dr = act_de("ACT_VM_DRAW").unwrap_or(-1); if !vista_act(e, dr) { let idl = act_de("ACT_VM_IDLE").unwrap_or(-1); if !vista_act(e, idl) && !md.m.secuencias.is_empty() { let s = &md.m.secuencias[0]; an(id, |x| x.sec = Some(SecEnt { i: 0, anim: s.anim.max(0) as usize, t: 0.0, lp: true, dur: 1.0 })); } } }
    let fin = an(id, |a| { let rate = a.rate.unwrap_or(1.0); a.sec.as_mut().map(|s| { s.t += dt * rate; !s.lp && s.t > s.dur + 0.05 }).unwrap_or(false) });
    if fin { let idl = act_de("ACT_VM_IDLE").unwrap_or(-1); if !vista_act(e, idl) { an(id, |a| if let Some(s) = &mut a.sec { s.t = s.dur; }); } }
    let s = an_ver(id, |a| a.sec).flatten()?;
    let an_ = md.m.anims.get(s.anim)?; let fps = if an_.fps > 0.0 { an_.fps as f64 } else { 30.0 }; let nfm = (an_.nf - 1).max(1) as f64;
    let fr = if s.lp { (s.t * fps) % nfm } else { (s.t * fps).min(nfm) };
    let piel = ce(&w, |x| num(&x.skin, 0.0) as i32).unwrap_or(0);
    // (SWEP:GetViewModelPosition: dónde la pone el arma —miras, correr, el balde de pochoclos—)
    let lugar = if let Valor::Func(_) = buscar_en_clase(&t, "GetViewModelPosition") {
        let c = h(|h| h.cam().clone()); let ang = dir_ang(ds(c.fwd));
        let r = metodo(e, &w, "GetViewModelPosition", Lado::C, &[vv(c.pos), naa(ang)]);
        match (r.first().and_then(vec_de), r.get(1).and_then(ang_de)) { (Some(p), Some(a)) => Some((a_juego(p), ang_quat(a))), (Some(p), None) => Some((a_juego(p), ang_quat(ang))), _ => None }
    } else { None };
    Some(VistaArma { modelo: r, fov, flip, huesos: huesos_de(&md, s.anim, fr), piel, lugar })
}
fn t_(v: &Valor) -> bool { v.es_verdad() }
fn mat_nombre(v: &Valor) -> String { match v { Valor::Udata(u) => u.con(|m: &crate::resto::Mat| m.n.clone()).unwrap_or_default(), Valor::Cad(_) => js_str(v), _ => String::new() } }

// ---------------- el dibujo de cada cuadro (gmrAntes) ----------------
/// un modelo de un addon que se dibuja: el de un objeto (`obj`) o suelto (`pos`, `q`, en el juego); `huesos`: la pose
/// (matrices de piel en el espacio de Source; None, la de reposo)
#[derive(Clone, Debug)]
pub struct DibModelo { pub obj: Option<ObjId>, pub pos: V3, pub q: Quat, pub escala: f64, pub modelo: String, pub piel: i32, pub color: [f32; 4], pub huesos: Option<Vec<[f32; 12]>> }
/// un cuadrado con un material (render.DrawSprite —de frente a la cámara— o DrawQuadEasy, con su normal)
#[derive(Clone, Debug)]
pub struct Sprite3 { pub mat: String, /** las esquinas (en el juego): la de la UV (0,0), (1,0), (1,1) y (0,1) */ pub esq: [V3; 4], pub color: [f32; 4] }
#[derive(Default, Clone, Debug)]
pub struct Dib { pub modelos: Vec<DibModelo>, pub sprites: Vec<Sprite3>, pub ocultos: Vec<ObjId>, pub vista: Option<std::rc::Rc<VistaArma2>> }
/// (la vista, para el que dibuja)
#[derive(Clone, Debug)]
pub struct VistaArma2 { pub modelo: String, pub fov: f64, pub flip: bool, pub huesos: Vec<[f32; 12]>, pub piel: i32, /** de GetViewModelPosition (en el juego) */ pub lugar: Option<(V3, Quat)> }
struct Pasada { act: Option<i64>, dm: bool, mat: String, modc: [f32; 3], blend: f32, dib: Dib }
thread_local! { static PS: RefCell<Option<Pasada>> = const { RefCell::new(None) }; }
fn ps<X>(f: impl FnOnce(&mut Pasada) -> X) -> Option<X> { PS.with(|p| p.borrow_mut().as_mut().map(f)) }
fn tinte(e: &Valor) -> [f32; 4] { let c = ce(e, |x| x.color).unwrap_or([255.0; 4]); let (m, bl) = ps(|p| (p.modc, p.blend)).unwrap_or(([1.0; 3], 1.0)); [c[0] as f32 / 255.0 * m[0], c[1] as f32 / 255.0 * m[1], c[2] as f32 / 255.0 * m[2], c[3] as f32 / 255.0 * bl] }
/// el modelo animado de un nextbot (gmnbDibujar)
fn dib_nb(ent: &Valor) -> bool {
    let Some(id) = ent_id(ent) else { return false }; let Some(md) = modelo_ent(ent) else { return false };
    let Some(o) = ce(ent, |x| x.o).flatten() else { return false };
    let s = an_ver(id, |a| a.sec).flatten();
    let huesos = s.and_then(|s| { let pv = pose_vals(id); let ia = if md.m.secuencias.get(s.i).map(|q| q.grid.is_some()).unwrap_or(false) { gmf::anim_de(&md.m, s.i, &|k| pv.get(k).copied()).max(0) as usize } else { s.anim }; let an_ = md.m.anims.get(ia)?; let fps = if an_.fps > 0.0 { an_.fps as f64 } else { 30.0 }; let nn = (an_.nf - 1).max(1) as f64; let fr = if s.lp { (s.t * fps) % nn } else { (s.t * fps).min(nn) }; Some(huesos_de(&md, ia, fr)) });
    let d = DibModelo { obj: Some(o), pos: ent_pos(ent), q: ent_q(ent), escala: escala(ent), modelo: ruta_mdl(&ce(ent, |x| x.modelo.clone()).unwrap_or_default()), piel: ce(ent, |x| num(&x.skin, 0.0) as i32).unwrap_or(0), color: tinte(ent), huesos };
    ps(|p| { p.dib.modelos.push(d); p.dib.ocultos.push(o); }); true
}
/// un modelo sin cuerpo (ClientsideModel) o el de un objeto del addon con su tinte
fn dib_suelto(ent: &Valor) {
    let Some((m, o, cs)) = ce(ent, |x| (x.modelo.clone(), x.o, x.cs)) else { return };
    let r = ruta_mdl(&m); if r.is_empty() || modelo(&r).is_none() { return; }
    if o.is_some() && !cs { return; }
    let (pos, q) = match ce(ent, |x| (x.r_origen, x.r_ang)) { Some((Some(p), a)) => (a_juego(p), a.map(ang_quat).unwrap_or_else(|| ent_q(ent))), Some((None, Some(a))) => (ent_pos(ent), ang_quat(a)), _ => (ent_pos(ent), ent_q(ent)) };
    let d = DibModelo { obj: None, pos, q, escala: escala(ent), modelo: r, piel: ce(ent, |x| num(&x.skin, 0.0) as i32).unwrap_or(0), color: tinte(ent), huesos: None };
    ps(|p| p.dib.modelos.push(d));
}
fn instalar_render(e: &mut Estado) {
    let rd = lib(e, "render");
    def(&rd, "SetMaterial", |_, a, _| { let m = mat_nombre(&ar(a, 0)); ps(|p| p.mat = m); Ok(()) });
    def(&rd, "SetColorModulation", |_, a, _| { let c = [num(&ar(a, 0), 1.0) as f32, num(&ar(a, 1), 1.0) as f32, num(&ar(a, 2), 1.0) as f32]; ps(|p| p.modc = c); Ok(()) });
    def(&rd, "GetColorModulation", |_, _, o| { let c = ps(|p| p.modc).unwrap_or([1.0; 3]); for x in c { o.push(Valor::Num(x as f64)); } Ok(()) });
    def(&rd, "SetBlend", |_, a, _| { let x = num(&ar(a, 0), 1.0) as f32; ps(|p| p.blend = x); Ok(()) });
    def(&rd, "GetBlend", |_, _, o| n(o, ps(|p| p.blend).unwrap_or(1.0) as f64));
    let col = |v: &Valor| -> [f32; 4] { match v { Valor::Tabla(t) => { let t = t.borrow(); let c = |k: &str| (num(&t.get_str(k), 255.0) / 255.0) as f32; [c("r"), c("g"), c("b"), c("a")] } _ => [1.0; 4] } };
    def(&rd, "DrawSprite", move |_, a, _| { let Some(p) = vec_de(&ar(a, 0)) else { return Ok(()) }; let (w, hh) = (num(&ar(a, 1), 8.0) * GS / 2.0, num(&ar(a, 2), 8.0) * GS / 2.0); let c = col(&ar(a, 3));
        let cam = h(|h| h.cam().clone()); let (x, y, p) = (cam.der.scale(w), cam.arr.scale(hh), a_juego(p));
        ps(|z| { let m = z.mat.clone(); if z.dib.sprites.len() < 512 { z.dib.sprites.push(Sprite3 { mat: m, esq: [p.sub(x).add(y), p.add(x).add(y), p.add(x).sub(y), p.sub(x).sub(y)], color: c }); } }); Ok(()) });
    def(&rd, "DrawQuadEasy", move |_, a, _| { let (Some(p), Some(nn)) = (vec_de(&ar(a, 0)), vec_de(&ar(a, 1))) else { return Ok(()) }; let (w, hh) = (num(&ar(a, 2), 8.0) * GS / 2.0, num(&ar(a, 3), 8.0) * GS / 2.0); let c = col(&ar(a, 4));
        let mut an_ = dir_ang(nn); an_[2] = 180.0 - num(&ar(a, 5), 0.0); let m = ang_mat(an_); let rt = dg([-m[1][0], -m[1][1], -m[1][2]]).scale(w); let u = dg(m[2]).scale(hh); let p = a_juego(p);
        ps(|z| { let mt = z.mat.clone(); if z.dib.sprites.len() < 512 { z.dib.sprites.push(Sprite3 { mat: mt, esq: [p.add(rt).add(u), p.sub(rt).add(u), p.sub(rt).sub(u), p.add(rt).sub(u)], color: c }); } }); Ok(()) });
    let em = g(|g| g.mt.ent_m.clone());
    if let Some(em) = em {
        let o0 = em.borrow().get_str("DrawModel");
        def(&em, "DrawModel", move |e, a, o| {
            let x = ar(a, 0);
            let en_pasada = PS.with(|p| p.borrow().is_some());
            if !en_pasada { if let Valor::Func(_) = o0 { o.extend(e.llamar_aqui(&o0, a)?); } return Ok(()); }
            let id = ent_id(&x); let actual = ps(|p| p.act).flatten();
            if id.is_some() && id == actual { ps(|p| p.dm = true); return Ok(()); }
            if ce(&x, |y| y.o.is_some()).unwrap_or(false) { if let Some(i) = id { an(i, |s| s.dm = true); } return Ok(()); }
            if ce(&x, |y| y.cs).unwrap_or(false) { dib_suelto(&x); }
            Ok(())
        });
    }
}
/// gmrAntes: lo que dibuja el Lua en 3D y qué modelos se ven
pub(crate) fn dibujar(e: &mut Estado, dt: f64) -> Dib {
    PS.with(|p| *p.borrow_mut() = Some(Pasada { act: None, dm: false, mat: String::new(), modc: [1.0; 3], blend: 1.0, dib: Dib::default() }));
    hook(e, "PreDrawOpaqueRenderables", C, &[Valor::Bool(false), Valor::Bool(false)]);
    let base = g(|g| g.clases.get("base_anim").or_else(|| g.clases.get("base_entity")).and_then(|c| c.c.clone().or_else(|| c.s.clone())));
    let (d0, d1) = base.map(|t| (buscar_en_clase(&t, "Draw"), buscar_en_clase(&t, "DrawTranslucent"))).unwrap_or((Valor::Nil, Valor::Nil));
    for x in g(|g| g.ents_vivas()) {
        let Some((tipo, vivo, clase, no_draw, o, cs, id)) = ce(&x, |y| (y.tipo, y.vivo, y.clase.clone(), y.no_draw, y.o, y.cs, y.id)) else { continue };
        if tipo != TipoEnt::Ent || !vivo { continue; }
        let c = clase_tabla(&clase, Lado::C);
        let Some(c) = c.filter(|_| g(|g| g.clases.get(&clase).is_some())) else { if cs && !no_draw { ps(|p| p.act = Some(id)); dib_suelto(&x); } continue };
        if no_draw { if let Some(o) = o { ps(|p| p.dib.ocultos.push(o)); } continue; }
        let nb = es_nb(&x);
        let ro = { let te = ce(&x, |y| y.tabla_c.clone()).flatten().or_else(|| tabla_de(&x)); let v = te.map(|t| t.borrow().get_str("RenderOverride")).unwrap_or(Valor::Nil); if let Valor::Func(_) = v { v } else { buscar_en_clase(&c, "RenderOverride") } };
        let reiniciar = |p: &mut Pasada| { p.act = Some(id); p.dm = false; p.mat.clear(); p.modc = [1.0; 3]; p.blend = 1.0; };
        if let Valor::Func(_) = ro {
            ps(reiniciar); llamar(e, &ro, Lado::C, &[x.clone(), Valor::Num(1.0)]);
            let dm = ps(|p| p.dm).unwrap_or(false);
            if dm && nb { dib_nb(&x); } else if let (Some(o), false) = (o, dm) { ps(|p| p.dib.ocultos.push(o)); }
            continue;
        }
        let rg = num(&buscar_en_clase(&c, "RenderGroup"), -1.0) as i32; let (trans, op) = (rg == 8 || rg == 9, rg != 8);
        let fo = if op { buscar_en_clase(&c, "Draw") } else { Valor::Nil }; let ft = if trans { buscar_en_clase(&c, "DrawTranslucent") } else { Valor::Nil };
        let propio = (matches!(fo, Valor::Func(_)) && !fo.crudo_igual(&d0)) || (matches!(ft, Valor::Func(_)) && !ft.crudo_igual(&d1) && !ft.crudo_igual(&d0));
        if !propio { if o.is_some() { if nb { dib_nb(&x); } } else { ps(|p| p.act = Some(id)); dib_suelto(&x); } continue; }
        ps(reiniciar);
        if let Valor::Func(_) = fo { llamar(e, &fo, Lado::C, &[x.clone(), Valor::Num(1.0)]); }
        if let Valor::Func(_) = ft { llamar(e, &ft, Lado::C, &[x.clone(), Valor::Num(1.0)]); }
        let dm = ps(|p| p.dm).unwrap_or(false);
        if dm && nb { dib_nb(&x); } else if let (Some(o), false) = (o, dm) { ps(|p| p.dib.ocultos.push(o)); }
    }
    ps(|p| p.act = None);
    hook(e, "PostDrawOpaqueRenderables", C, &[Valor::Bool(false), Valor::Bool(false)]);
    hook(e, "PreDrawTranslucentRenderables", C, &[Valor::Bool(false), Valor::Bool(false)]);
    hook(e, "PostDrawTranslucentRenderables", C, &[Valor::Bool(false), Valor::Bool(false)]);
    let mut d = PS.with(|p| p.borrow_mut().take()).map(|p| p.dib).unwrap_or_default();
    // (los objetos que DrawModel dibujó desde otra entidad se ven aunque su Draw no lo haya hecho)
    let vistos: HashSet<ObjId> = e3(|s| { let l: Vec<i64> = s.anim.iter().filter(|(_, a)| a.dm).map(|(k, _)| *k).collect(); for k in &l { if let Some(a) = s.anim.get_mut(k) { a.dm = false; } } l }).into_iter().filter_map(|id| ce(&ent_por_id(id), |y| y.o).flatten()).collect();
    if !vistos.is_empty() { d.ocultos.retain(|o| !vistos.contains(o)); }
    d.vista = vista_cuadro(e, dt).map(|v| std::rc::Rc::new(VistaArma2 { modelo: v.modelo, fov: v.fov, flip: v.flip, huesos: v.huesos, piel: v.piel, lugar: v.lugar }));
    d
}

pub(crate) fn instalar(e: &mut Estado) {
    olvidar(); MTS.with(|m| m.borrow_mut().clear());
    instalar_loco(); instalar_camino(e); instalar_nav(e); instalar_api(e); instalar_render(e);
}
