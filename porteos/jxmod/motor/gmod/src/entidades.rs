//! Los métodos de las entidades, el jugador, las armas y los objetos físicos (gmaApiEntidades de la web).

use crate::anfitrion::*;
use crate::mates::*;
use crate::motor::*;
use crate::nucleo::*;
use crate::valores::{buscar_en_clase_v, color, dt_l};
use jxlua::{Error, Estado, Tabla, TablaRef, Udata, Valor};
use std::rc::Weak;

type R = Result<(), Error>;
fn yo(v: &Valor) -> bool { es_jug(v) }
fn s0(a: &[Valor]) -> Valor { ar(a, 0) }
/// (un nil que devuelve una función de la web es «undefined»: no es ningún valor, como E0)
fn ok1(o: &mut Vec<Valor>, v: Valor) -> R { if !v.es_nil() { o.push(v); } Ok(()) }
fn b(o: &mut Vec<Valor>, x: bool) -> R { o.push(Valor::Bool(x)); Ok(()) }
fn n(o: &mut Vec<Valor>, x: f64) -> R { o.push(Valor::Num(x)); Ok(()) }
fn s(o: &mut Vec<Valor>, x: &str) -> R { o.push(cad(x)); Ok(()) }

/// el objeto físico de una entidad (PhysObj): no la mantiene viva
pub(crate) struct Fis(pub Weak<Udata>);
pub(crate) fn fis_ent(v: &Valor) -> Valor { match v { Valor::Udata(u) => u.con(|f: &Fis| fuerte(&f.0)).unwrap_or(Valor::Nil), _ => Valor::Nil } }
/// GetPhysicsObject (uno por entidad)
pub(crate) fn fis_de(e: &Valor) -> Valor {
    if let Some(Some(f)) = ce(e, |x| x.fis.clone()) { return f; }
    let mt = g(|g| g.mt.phy.clone());
    let f = Valor::Udata(Udata::nueva(Fis(debil(e)), mt));
    ce(e, |x| x.fis = Some(f.clone()));
    f
}

/// la caja local de la entidad (SetCollisionBounds o la del modelo)
fn caja(e: &Valor) -> ([f64; 3], [f64; 3]) {
    let Some((lim, tipo, esc, o)) = ce(e, |x| (x.limites, x.tipo, x.escala, x.o)) else { return ([-8.0, -8.0, 0.0], [8.0, 8.0, 16.0]) };
    if let (Some([a, bb]), true) = (lim, tipo != TipoEnt::Jug) {
        let s = if esc == 0.0 || esc.is_nan() { 1.0 } else { esc };
        return ([a[0].min(bb[0]) * s, a[1].min(bb[1]) * s, a[2].min(bb[2]) * s], [a[0].max(bb[0]) * s, a[1].max(bb[1]) * s, a[2].max(bb[2]) * s]);
    }
    let d = o.and_then(|o| g(|g| g.obj_prefab.get(&o).cloned())).and_then(|p| h(|h| h.caja_prefab(&p)));
    match d {
        Some((mn, sc)) => (vsr(v3(mn[0], mn[1], mn[2])), vsr(v3(mn[0] + sc[0], mn[1] + sc[1], mn[2] + sc[2]))),
        None => ([-8.0, -8.0, 0.0], [8.0, 8.0, 16.0]),
    }
}
fn dir_e(e: &Valor, k: usize) -> Valor {
    let a = if yo(e) { dir_ang(ds(h(|h| h.cam().fwd))) } else { quat_ang(ent_q(e)) };
    let m = ang_mat(a);
    let v = if k == 1 { [-m[1][0], -m[1][1], -m[1][2]] } else { m[k] };
    nva(v)
}
/// SetPos
pub(crate) fn set_pos(e: &Valor, v: &Valor) {
    let Some(p0) = vec_de(v) else { return };
    let p = a_juego(p0);
    if yo(e) { h(|h| { let j = h.jug(); j.pos = p.add(v3(0.0, j.medio + j.radio, 0.0)); j.vel = V3::default(); }); }
    else if let Some(Some(o)) = ce(e, |x| x.o).filter(|o| o.map(|o| cuerpo(o, |_| ()).is_some()).unwrap_or(false)) {
        let antes = origen(o);
        ce(e, |x| x.pos_antes = antes);
        origen_pon(o, p, None);
        cuerpo(o, |b| b.despertar());
    } else { ce(e, |x| { x.pos_antes = Some(x.pos); x.pos = p; }); }
    if ce(e, |x| x.padre.is_some() || x.soldado_a.is_some()).unwrap_or(false) { padre_fijar(e, Some("pos")); }
}
pub(crate) fn set_angles(e: &Valor, a: &Valor) {
    let Some(an) = ang_de(a) else { return };
    let q = ang_quat(an);
    if yo(e) { let f = q.rot(v3(0.0, 0.0, 1.0)); h(|h| h.jug().yaw = f.x.atan2(f.z)); }
    else if let Some(Some(o)) = ce(e, |x| x.o).filter(|o| o.map(|o| cuerpo(o, |_| ()).is_some()).unwrap_or(false)) {
        let org = origen(o).unwrap_or_default();
        cuerpo(o, |b| { b.q = q; b.cambios |= CUERPO_Q; });
        origen_pon(o, org, None);
        cuerpo(o, |b| b.despertar());
    } else { ce(e, |x| x.q = q); }
    if ce(e, |x| x.padre.is_some() || x.soldado_a.is_some()).unwrap_or(false) { padre_fijar(e, Some("ang")); }
}
pub(crate) fn ent_angles(e: &Valor) -> [f64; 3] {
    if yo(e) { let yaw = h(|h| h.jug().yaw); return [0.0, quat_ang(Quat::axis(0.0, 1.0, 0.0, yaw))[1], 0.0]; }
    quat_ang(ent_q(e))
}
fn d0_nw(t: &str) -> Valor {
    if t.contains("Int") || t.contains("Float") { Valor::Num(0.0) } else if t.contains("Bool") { Valor::Bool(false) } else if t.contains("String") { cad("") } else if t.contains("Entity") { null() } else if t.contains("Vector") { nv(0.0, 0.0, 0.0) } else if t.contains("Angle") { na(0.0, 0.0, 0.0) } else { Valor::Nil }
}

pub(crate) fn instalar(_e: &mut Estado) {
    let (ent_m, ply_m, wep_m, npc_m, phy_m) = g(|g| (g.mt.ent_m.clone().unwrap(), g.mt.ply_m.clone().unwrap(), g.mt.wep_m.clone().unwrap(), g.mt.npc_m.clone().unwrap(), g.mt.phy_m.clone().unwrap()));
    let em = &ent_m;
    def(em, "IsValid", |_, a, o| b(o, ent_valida(&s0(a))));
    def(em, "EntIndex", |_, a, o| { let x = s0(a); n(o, if yo(&x) { 1.0 } else { ent_id(&x).unwrap_or(0) as f64 }) });
    def(em, "GetClass", |_, a, o| { let c = ce(&s0(a), |x| x.clase_nom.clone().unwrap_or_else(|| x.clase.clone())); ok1(o, c.map(|c| cad(&c)).unwrap_or(Valor::Nil)) });
    def(em, "GetPos", |_, a, o| ok1(o, vv(ent_pos(&s0(a)))));
    def(em, "SetPos", |_, a, _| { set_pos(&s0(a), &ar(a, 1)); Ok(()) });
    def(em, "GetAngles", |_, a, o| ok1(o, naa(ent_angles(&s0(a)))));
    def(em, "SetAngles", |_, a, _| { set_angles(&s0(a), &ar(a, 1)); Ok(()) });
    def(em, "GetVelocity", |_, a, o| {
        let x = s0(a);
        let v = if yo(&x) { h(|h| h.jug().vel) } else { ce(&x, |y| y.o).flatten().and_then(|o| cuerpo(o, |b| b.vel)).unwrap_or_default() };
        ok1(o, vvr(v))
    });
    def(em, "SetVelocity", |_, a, _| {
        let x = s0(a);
        let gv = vgr(vec_de(&ar(a, 1)).unwrap_or([f64::NAN; 3]));
        if yo(&x) { vel_jugador(gv, false); } else if let Some(Some(ob)) = ce(&x, |y| y.o) { cuerpo(ob, |b| { b.vel = gv; b.cambios |= CUERPO_VEL; b.despertar(); }); }
        Ok(())
    });
    def(em, "GetForward", |_, a, o| ok1(o, dir_e(&s0(a), 0)));
    def(em, "GetRight", |_, a, o| ok1(o, dir_e(&s0(a), 1)));
    def(em, "GetUp", |_, a, o| ok1(o, dir_e(&s0(a), 2)));
    def(em, "LocalToWorld", |_, a, o| { let x = s0(a); let v = vgr(crate::valores::vx(&ar(a, 1))?); ok1(o, vv(ent_pos(&x).add(ent_q(&x).rot(v)))) });
    def(em, "WorldToLocal", |_, a, o| { let x = s0(a); let v = a_juego(crate::valores::vx(&ar(a, 1))?); ok1(o, vvr(ent_q(&x).conj().rot(v.sub(ent_pos(&x))))) });
    def(em, "LocalToWorldAngles", |_, a, o| { let x = s0(a); let q = ang_quat(crate::valores::ax(&ar(a, 1))?); ok1(o, naa(quat_ang(Quat::mul_to(ent_q(&x), q)))) });
    def(em, "WorldToLocalAngles", |_, a, o| { let x = s0(a); let q = ang_quat(crate::valores::ax(&ar(a, 1))?); ok1(o, naa(quat_ang(Quat::mul_to(ent_q(&x).conj(), q)))) });
    def(em, "OBBMins", |_, a, o| ok1(o, nva(caja(&s0(a)).0)));
    def(em, "OBBMaxs", |_, a, o| ok1(o, nva(caja(&s0(a)).1)));
    def(em, "OBBCenter", |_, a, o| { let (p, q) = caja(&s0(a)); ok1(o, nv((p[0] + q[0]) / 2.0, (p[1] + q[1]) / 2.0, (p[2] + q[2]) / 2.0)) });
    def(em, "WorldSpaceCenter", |_, a, o| { let x = s0(a); let (p, q) = caja(&x); let c = vgr([(p[0] + q[0]) / 2.0, (p[1] + q[1]) / 2.0, (p[2] + q[2]) / 2.0]); ok1(o, vv(ent_pos(&x).add(ent_q(&x).rot(c)))) });
    def(em, "BoundingRadius", |_, a, o| { let (p, q) = caja(&s0(a)); n(o, js_hypot(&[q[0] - p[0], q[1] - p[1], q[2] - p[2]]) / 2.0) });
    def(em, "SetModel", |e, a, _| {
        let x = s0(a);
        let mut m = ar(a, 1);
        if let Valor::Tabla(t) = &m { let len = t.borrow().len(); let i = 1 + (e.azar() * (len.max(1) as f64)).floor() as i64; let v = t.borrow().get_int(i); m = if js_t(&v) { v } else { t.borrow().get_int(1) }; }
        let ms = if js_t(&m) { js_str(&m) } else { String::new() }.to_lowercase().replace('\\', "/");
        let rehace = ce(&x, |y| { y.modelo = ms.clone(); y.creado && y.vivo && y.o.is_some() }).unwrap_or(false) || g(|g| g.iniciando.as_ref().map(|i| mismo(i, &x)).unwrap_or(false)) && ce(&x, |y| y.creado && y.vivo).unwrap_or(false);
        if rehace { rehacer(&x); }
        Ok(())
    });
    def(em, "GetModel", |_, a, o| { let m = ce(&s0(a), |x| x.modelo.clone()); ok1(o, m.map(|m| cad(&m)).unwrap_or(Valor::Nil)) });
    def(em, "Spawn", |e, a, _| { spawn(e, &s0(a)); Ok(()) });
    def(em, "Activate", nada);
    def(em, "Remove", |e, a, _| { quitar(e, &s0(a)); Ok(()) });
    def(em, "SetColor", |_, a, _| { if let Valor::Tabla(c) = ar(a, 1) { let v: Vec<f64> = ["r", "g", "b", "a"].iter().map(|k| num(&tget(&c, k), 255.0)).collect(); ce(&s0(a), |x| x.color = [v[0], v[1], v[2], v[3]]); } Ok(()) });
    def(em, "GetColor", |_, a, o| { let c = ce(&s0(a), |x| x.color).unwrap_or([255.0; 4]); ok1(o, crate::valores::colorf(c[0], c[1], c[2], c[3])) });
    def(em, "SetMaterial", |_, a, _| { ce(&s0(a), |x| x.material = ar(a, 1)); Ok(()) });
    def(em, "GetMaterial", |_, a, o| { let m = ce(&s0(a), |x| x.material.clone()).unwrap_or(Valor::Nil); ok1(o, if js_t(&m) { m } else { cad("") }) });
    def(em, "GetMaterials", |_, _, o| ok1(o, Valor::Tabla(Tabla::nueva_ref())));
    def(em, "SetSkin", |_, a, _| { ce(&s0(a), |x| x.skin = ar(a, 1)); Ok(()) });
    def(em, "GetSkin", |_, a, o| { let m = ce(&s0(a), |x| x.skin.clone()).unwrap_or(Valor::Nil); ok1(o, if js_t(&m) { m } else { Valor::Num(0.0) }) });
    def(em, "SkinCount", |_, _, o| n(o, 1.0));
    def(em, "SetBodygroup", nada);
    def(em, "GetBodygroup", |_, _, o| n(o, 0.0));
    def(em, "SetBodyGroups", nada);
    def(em, "GetNumBodyGroups", |_, _, o| n(o, 1.0));
    def(em, "GetBodyGroups", |_, _, o| {
        let sm = Tabla::nueva_ref(); let _ = sm.borrow_mut().set(Valor::Num(0.0), cad(""));
        let gg = tabla_kv(vec![("id", Valor::Num(0.0)), ("name", cad("studio")), ("num", Valor::Num(1.0)), ("submodels", Valor::Tabla(sm))]);
        ok1(o, tab_de(vec![gg]))
    });
    def(em, "GetBodygroupCount", |_, _, o| n(o, 1.0));
    def(em, "GetBodygroupName", |_, _, o| s(o, "studio"));
    def(em, "FindBodygroupByName", |_, _, o| n(o, -1.0));
    def(em, "SetIK", nada);
    def(em, "SetNoDraw", |_, a, _| { let v = t(&ar(a, 1)); if let Some(ob) = ce(&s0(a), |x| { x.no_draw = v; x.o }).flatten() { cuerpo(ob, |c| { c.oculto = v; c.cambios |= CUERPO_OTROS; }); } Ok(()) });
    def(em, "GetNoDraw", |_, a, o| b(o, ce(&s0(a), |x| x.no_draw).unwrap_or(false)));
    for k in ["DrawShadow", "SetRenderMode", "SetRenderFX", "DrawModel", "SetModelScale", "SetUseType", "SetTrigger", "SetLagCompensated", "SetPredictable", "AddEffects", "RemoveEffects", "AddFlags", "RemoveFlags", "SetSolidFlags", "SetSequence", "ResetSequence", "SetPlaybackRate", "SetCycle", "FrameAdvance", "SetPoseParameter", "ManipulateBoneAngles", "ManipulateBonePosition", "ManipulateBoneScale", "SetupBones", "InvalidateBoneCache", "SetAnimation", "SetLocalVelocity", "SetFriction", "SetElasticity", "StartMotionController", "StopMotionController", "SetSubMaterial", "CallOnRemove", "DeleteOnRemove", "SetShouldServerRagdoll", "SetSpawnEffect", "SetBloodColor", "AddCallback", "SetHitboxSet", "EnableCustomCollisions", "CollisionRulesChanged", "RemoveAllDecals", "SetSaveValue", "MarkShadowAsDirty", "CreateShadow", "DestroyShadow", "SetRenderBounds", "SetRenderBoundsWS", "SetRenderOrigin", "SetRenderAngles", "SetLOD", "UseClientSideAnimation", "SetAutomaticFrameAdvance", "SetLocalAngularVelocity", "SetMoveCollide", "Input", "TakePhysicsDamage", "SetCreator", "PhysWake", "StopParticles"] { def(em, k, nada); }
    def(em, "DrawModel", |_, a, _| { let x = s0(a); if let Some((TipoEnt::Manos, _)) | None = ce(&x, |y| (y.tipo, ())) { return Ok(()); } let id = ent_id(&x).unwrap_or(0) as f64; h(|h| h.dibujar_modelo(id)); Ok(()) });
    fn manip(a: &[Valor], k: usize, v: [f64; 3]) {
        let i = mas(&ar(a, 1)).trunc();
        if !(i >= 0.0) || i > 255.0 { return; }
        ce(&ar(a, 0), |x| { let m = x.manip.entry(i as i64).or_insert([[0.0; 3], [0.0; 3], [1.0; 3]]); m[k] = v; });
    }
    def(em, "ManipulateBonePosition", |_, a, _| { if let Some(v) = vec_de(&ar(a, 2)) { manip(a, 0, v); } Ok(()) });
    def(em, "ManipulateBoneAngles", |_, a, _| { if let Some(v) = ang_de(&ar(a, 2)) { manip(a, 1, v); } Ok(()) });
    def(em, "ManipulateBoneScale", |_, a, _| { if let Some(v) = vec_de(&ar(a, 2)) { manip(a, 2, v.map(|x| if x.is_finite() { x } else { 1.0 })); } Ok(()) });
    def(em, "AddCallback", |_, a, o| {
        let f = ar(a, 2);
        if !matches!(f, Valor::Func(_)) { return n(o, 0.0); }
        let k = js_str(&ar(a, 1)).to_lowercase();
        let id = g(|g| { g.cb_n += 1; g.cb_n });
        ce(&s0(a), |x| x.cbs.entry(k).or_default().set(id, f));
        n(o, id as f64)
    });
    def(em, "RemoveCallback", |_, a, _| { let k = js_str(&ar(a, 1)).to_lowercase(); let id = mas(&ar(a, 2)); ce(&s0(a), |x| if let Some(m) = x.cbs.get_mut(&k) { if id >= 0.0 { m.delete(&(id as u64)); } }); Ok(()) });
    def(em, "GetCallbacks", |_, a, o| { let k = js_str(&ar(a, 1)).to_lowercase(); let v = ce(&s0(a), |x| x.cbs.get(&k).map(|m| m.v.iter().map(|y| y.1.clone()).collect::<Vec<_>>())).flatten().unwrap_or_default(); ok1(o, tab_de(v)) });
    def(em, "SetSubMaterial", |_, a, _| {
        let i = ar(a, 1);
        if i.es_nil() { ce(&s0(a), |x| x.sub_mat = None); return Ok(()); }
        let k = { let v = mas(&i).trunc(); if v.is_nan() { 0 } else { v as i64 } };
        let m = ar(a, 2);
        let ms = if m.es_nil() { String::new() } else { js_str(&m) };
        ce(&s0(a), |x| { x.sub_mat.get_or_insert_with(Default::default).insert(k, ms); });
        Ok(())
    });
    def(em, "GetSubMaterial", |_, a, o| { let k = { let v = mas(&ar(a, 1)).trunc(); if v.is_nan() { 0 } else { v as i64 } }; let m = ce(&s0(a), |x| x.sub_mat.as_ref().and_then(|m| m.get(&k).cloned())).flatten().unwrap_or_default(); s(o, &m) });
    def(em, "HasBoneManipulations", |_, a, o| b(o, ce(&s0(a), |x| x.manip.values().any(|m| m[0].iter().any(|v| *v != 0.0) || m[1].iter().any(|v| *v != 0.0) || m[2].iter().any(|v| *v != 1.0))).unwrap_or(false)));
    for k in ["SetNPCMinBurst", "SetNPCMaxBurst", "SetNPCFireRate", "SetPhysicsAttacker", "SetupWeaponHoldTypeForAI", "SetHullType", "SetHullSizeNormal", "SetAllowFullRotation", "AddEFlags", "RemoveEFlags", "SetNPCState", "SetMaxYawSpeed", "CapabilitiesAdd", "CapabilitiesRemove", "CapabilitiesClear", "DisableMatrix", "SetMoveType", "SetKeyValue", "SetSurroundingBounds", "SetSurroundingBoundsType", "SetCollisionBoundsWS"] {
        if em.borrow().get_str(k).es_nil() { def(em, k, nada); }
    }
    def(em, "IsEFlagSet", |_, _, o| b(o, false));
    def(em, "IsPlayerHolding", |_, _, o| b(o, false));
    def(em, "GetManipulateBoneAngles", |_, _, o| ok1(o, na(0.0, 0.0, 0.0)));
    def(em, "GetManipulateBonePosition", |_, _, o| ok1(o, nv(0.0, 0.0, 0.0)));
    def(em, "GetManipulateBoneScale", |_, _, o| ok1(o, nv(1.0, 1.0, 1.0)));
    def(em, "SetCollisionBounds", |_, a, _| { if let (Some(p), Some(q)) = (vec_de(&ar(a, 1)), vec_de(&ar(a, 2))) { ce(&s0(a), |x| x.limites = Some([p, q])); } Ok(()) });
    let lim_o_caja = |x: &Valor| ce(x, |y| y.limites).flatten().map(|l| (l[0], l[1])).unwrap_or_else(|| caja(x));
    def(em, "GetCollisionBounds", move |_, a, o| { let (p, q) = lim_o_caja(&s0(a)); o.push(nva(p)); o.push(nva(q)); Ok(()) });
    def(em, "GetRenderBounds", move |_, a, o| { let (p, q) = lim_o_caja(&s0(a)); o.push(nva(p)); o.push(nva(q)); Ok(()) });
    def(em, "GetModelBounds", |_, a, o| { let (p, q) = caja(&s0(a)); o.push(nva(p)); o.push(nva(q)); Ok(()) });
    def(em, "EnableMatrix", nada);
    def(em, "DisableMatrix", nada);
    def(em, "GetSurroundingBounds", move |_, a, o| { let x = s0(a); let (p, q) = lim_o_caja(&x); let c = a_source(ent_pos(&x)); o.push(nv(c[0] + p[0], c[1] + p[1], c[2] + p[2])); o.push(nv(c[0] + q[0], c[1] + q[1], c[2] + q[2])); Ok(()) });
    def(&ply_m, "CrosshairDisable", |_, a, _| { ce(&s0(a), |x| x.sin_mira = true); Ok(()) });
    def(&ply_m, "CrosshairEnable", |_, a, _| { ce(&s0(a), |x| x.sin_mira = false); Ok(()) });
    def(&ply_m, "SetViewEntity", |_, a, _| { let v = ar(a, 1); let ok = ent_tipo(&v).map(|t| t != TipoEnt::Null).unwrap_or(false); ce(&s0(a), |x| x.vista_ent = if ok { Some(v) } else { None }); Ok(()) });
    def(&ply_m, "GetViewEntity", |_, a, o| { let x = s0(a); let v = ce(&x, |y| y.vista_ent.clone()).flatten(); ok1(o, match v { Some(v) if ent_valida(&v) => v, _ => x }) });
    def(&ply_m, "SetViewOffset", |_, a, _| { if let Some(v) = vec_de(&ar(a, 1)) { ce(&s0(a), |x| x.vista_off = Some(v)); } Ok(()) });
    def(&ply_m, "GetViewOffset", |_, a, o| ok1(o, nva(ce(&s0(a), |x| x.vista_off).flatten().unwrap_or([0.0, 0.0, 64.0]))));
    def(&ply_m, "SetViewOffsetDucked", nada);
    def(&ply_m, "GetViewOffsetDucked", |_, _, o| ok1(o, nv(0.0, 0.0, 28.0)));
    def(&ply_m, "SetHull", nada);
    def(&ply_m, "SetHullDuck", nada);
    def(&ply_m, "GetHull", |_, _, o| { o.push(nv(-16.0, -16.0, 0.0)); o.push(nv(16.0, 16.0, 72.0)); Ok(()) });
    def(&ply_m, "GetHullDuck", |_, _, o| { o.push(nv(-16.0, -16.0, 0.0)); o.push(nv(16.0, 16.0, 36.0)); Ok(()) });
    def(em, "SetRenderOrigin", |_, a, _| { let v = vec_de(&ar(a, 1)); ce(&s0(a), |x| x.r_origen = v); Ok(()) });
    def(em, "GetRenderOrigin", |_, a, o| { let x = s0(a); match ce(&x, |y| y.r_origen).flatten() { Some(v) => ok1(o, nva(v)), None => ok1(o, vv(ent_pos(&x))) } });
    def(em, "SetRenderAngles", |_, a, _| { let v = ang_de(&ar(a, 1)); ce(&s0(a), |x| x.r_ang = v); Ok(()) });
    def(em, "GetRenderAngles", |_, a, o| { let x = s0(a); match ce(&x, |y| y.r_ang).flatten() { Some(v) => ok1(o, naa(v)), None => ok1(o, naa(quat_ang(ent_q(&x)))) } });
    def(em, "SetModelScale", |_, a, _| { let sv = mas(&ar(a, 1)); let bb = if sv > 0.0 { sv } else { 1.0 }; ce(&s0(a), |x| x.escala = bb); Ok(()) });
    def(em, "GetModelScale", |_, a, o| { let v = ce(&s0(a), |x| x.escala).unwrap_or(1.0); n(o, if v == 0.0 || v.is_nan() { 1.0 } else { v }) });
    def(em, "PhysicsInit", |_, a, o| {
        let x = s0(a);
        let tp = i32_de(num(&ar(a, 1), 6.0));
        let r = ce(&x, |y| { y.solido_t = Some(tp); y.creado && y.vivo && y.o.is_none() && !y.modelo.is_empty() }).unwrap_or(false);
        if r { rehacer(&x); }
        solidez(&x);
        b(o, true)
    });
    for k in ["PhysicsInitSphere", "PhysicsInitBox"] { def(em, k, |_, a, o| { let x = s0(a); ce(&x, |y| y.solido_t = Some(6)); solidez(&x); b(o, true) }); }
    def(em, "PhysicsInitShadow", |_, _, o| b(o, true));
    def(em, "PhysicsDestroy", nada);
    def(em, "SetMoveType", |_, a, _| {
        let x = s0(a);
        if yo(&x) { mov_tipo_jug(mas(&ar(a, 1))); return Ok(()); }
        let tv = ar(a, 1);
        let tn = mas(&tv);
        if let Some(ob) = ce(&x, |y| { y.mov = if tv.es_nil() { None } else { Some(tn) }; y.o }).flatten() { cuerpo(ob, |c| { c.congelado = tn == 0.0; c.cambios |= CUERPO_CONGELADO; if tn != 0.0 { c.despertar(); } }); }
        Ok(())
    });
    def(em, "GetMoveType", |_, a, o| { let x = s0(a); let m = ce(&x, |y| y.mov).flatten(); n(o, if yo(&x) { m.unwrap_or(if h(|h| h.jug().noclip) { 8.0 } else { 2.0 }) } else { m.unwrap_or(6.0) }) });
    def(em, "GetSequence", |_, _, o| n(o, 0.0));
    def(em, "LookupSequence", |_, _, o| { o.push(Valor::Num(-1.0)); o.push(Valor::Num(0.0)); Ok(()) });
    def(em, "SelectWeightedSequence", |_, _, o| n(o, -1.0));
    def(em, "SelectWeightedSequenceSeeded", |_, _, o| n(o, -1.0));
    def(em, "GetSequenceName", |_, _, o| s(o, "Unknown"));
    def(em, "GetSequenceActivity", |_, _, o| n(o, -1.0));
    def(em, "SequenceDuration", |_, _, o| n(o, 1.0));
    def(em, "GetPlaybackRate", |_, a, o| n(o, ce(&s0(a), |x| x.vel_anim).unwrap_or(1.0)));
    def(em, "SetPlaybackRate", |_, a, _| { let r = mas(&ar(a, 1)); ce(&s0(a), |x| x.vel_anim = if r.is_finite() { r } else { 1.0 }); Ok(()) });
    def(em, "GetCycle", |_, _, o| n(o, 0.0));
    def(em, "GetPoseParameter", |_, _, o| n(o, 0.0));
    def(em, "GetNumPoseParameters", |_, _, o| n(o, 0.0));
    def(em, "GetSequenceMovement", |_, _, o| b(o, false));
    def(em, "GetSequenceGroundSpeed", |_, a, o| {
        let c = ce(&s0(a), |x| x.clase.clone()).and_then(|c| clase_tabla(&c, g(|g| g.ctx)));
        let w = c.map(|c| buscar_en_clase(&c, "WalkSpeed")).unwrap_or(Valor::Nil);
        n(o, match w { Valor::Num(x) if x > 0.0 => x, _ => 100.0 })
    });
    def(em, "GetPoseParameterName", |_, _, o| s(o, ""));
    def(em, "LookupPoseParameter", |_, _, o| n(o, -1.0));
    def(em, "GetPoseParameterRange", |_, _, o| { o.push(Valor::Num(0.0)); o.push(Valor::Num(1.0)); Ok(()) });
    def(em, "GetPhysicsObject", |_, a, o| ok1(o, fis_de(&s0(a))));
    def(em, "GetPhysicsObjectCount", |_, a, o| n(o, if ce(&s0(a), |x| x.o.is_some()).unwrap_or(false) { 1.0 } else { 0.0 }));
    def(em, "GetPhysicsObjectNum", |e, a, o| { let f = g(|g| g.mt.ent_m.clone()).unwrap().borrow().get_str("GetPhysicsObject"); o.extend(e.llamar_aqui(&f, &[s0(a)])?); Ok(()) });
    def(em, "EmitSound", |_, a, _| {
        let x = s0(a);
        let id = if es_ent(&x) { Some(if yo(&x) { ent_id(&x).unwrap_or(0) as f64 } else { ent_id(&x).unwrap_or(0) as f64 }) } else { None };
        let op = |i: usize| { let v = ar(a, i); if v.es_nil() { None } else { Some(mas(&v)) } };
        let sn = js_str(&ar(a, 1));
        h(|h| h.emitir_sonido(id, &sn, op(2), op(3), op(4), op(5)));
        Ok(())
    });
    def(em, "StopSound", |_, a, _| { let x = s0(a); let id = ent_id(&x).map(|v| v as f64); let sn = js_str(&ar(a, 1)); h(|h| h.parar_sonido(id, &sn)); Ok(()) });
    def(em, "Health", |_, a, o| { let x = s0(a); if yo(&x) { return n(o, h(|h| h.jug().vida).round().max(0.0)); } n(o, ce(&x, |y| y.vida).unwrap_or(0.0)) });
    def(em, "SetHealth", |_, a, _| { let x = s0(a); let v = num(&ar(a, 1), 100.0); if yo(&x) { h(|h| h.jug().vida = v); } else { ce(&x, |y| y.vida = v); } Ok(()) });
    def(em, "GetMaxHealth", |_, a, o| { let x = s0(a); n(o, if yo(&x) { 100.0 } else { ce(&x, |y| y.vida_max).unwrap_or(100.0) }) });
    def(em, "SetMaxHealth", |_, a, _| { let v = num(&ar(a, 1), 100.0); ce(&s0(a), |y| y.vida_max = v); Ok(()) });
    def(em, "TakeDamage", |e, a, _| { danar(e, &s0(a), num(&ar(a, 1), 0.0), ar(a, 2), ar(a, 3), None); Ok(()) });
    def(em, "TakeDamageInfo", |e, a, _| {
        let x = s0(a);
        let d = ar(a, 1);
        let (dn, at, inf) = di(&d, |y| (y.dan.clone(), y.at.clone(), y.inf.clone())).unwrap_or((Valor::Nil, Valor::Nil, Valor::Nil));
        let dnv = if js_t(&dn) { mas(&dn) } else { 0.0 };
        danar(e, &x, dnv, at, inf, if di(&d, |_| ()).is_some() { Some(d.clone()) } else { None });
        empujar_dano(&x, &d, None);
        Ok(())
    });
    def(em, "DispatchTraceAttack", |e, a, _| {
        let x = s0(a);
        let d = ar(a, 1);
        let ok = ce(&x, |y| y.vivo && y.tipo != TipoEnt::Null && y.tipo != TipoEnt::Mundo).unwrap_or(false);
        if !ok || di(&d, |_| ()).is_none() { return Ok(()); }
        let p = match ar(a, 2) { Valor::Tabla(t) => vec_de(&tget(&t, "HitPos")).map(|_| tget(&t, "HitPos")), _ => None };
        if let Some(p) = &p { di(&d, |y| if y.pos.es_nil() { y.pos = p.clone(); }); }
        let (dn, at, inf) = di(&d, |y| (mas(&y.dan), y.at.clone(), y.inf.clone())).unwrap();
        danar(e, &x, if dn.is_nan() { 0.0 } else { dn }, at, inf, Some(d.clone()));
        empujar_dano(&x, &d, p.and_then(|p| vec_de(&p)));
        Ok(())
    });
    for k in ["NextThink", "SetNextThink"] { def(em, k, |_, a, _| { let v = num(&ar(a, 1), 0.0); ce(&s0(a), |x| x.prox = Some(v)); Ok(()) }); }
    def(em, "SetOwner", |_, a, _| { let x = s0(a); let ow = ar(a, 1); ce(&x, |y| y.dueno = if es_ent(&ow) { Some(ow) } else { None }); solidez(&x); Ok(()) });
    def(em, "GetOwner", |_, a, o| { let d = ce(&s0(a), |x| x.dueno.clone()).flatten(); ok1(o, opt_null(&d)) });
    def(em, "SetParent", |_, a, _| {
        let x = s0(a);
        let p = ar(a, 1);
        let ok = es_ent(&p) && !mismo(&p, &x) && ent_tipo(&p) != Some(TipoEnt::Mundo);
        poner_padre(&x, if ok { Some(p) } else { None }, false);
        Ok(())
    });
    def(em, "GetParent", |_, a, o| { let d = ce(&s0(a), |x| x.padre.clone()).flatten(); ok1(o, opt_null(&d)) });
    def(em, "GetMoveParent", |_, a, o| { let d = ce(&s0(a), |x| x.padre.clone()).flatten(); ok1(o, opt_null(&d)) });
    def(em, "GetChildren", |_, a, o| {
        let x = s0(a);
        let hs = g(|g| g.hijos.clone());
        let v: Vec<Valor> = hs.into_iter().filter(|hh| ce(hh, |y| y.padre.as_ref().map(|p| mismo(p, &x)).unwrap_or(false) && y.vivo).unwrap_or(false)).collect();
        ok1(o, tab_de(v))
    });
    def(em, "SetSolid", |_, a, _| { let x = s0(a); let tv = i32_de(num(&ar(a, 1), 0.0)); ce(&x, |y| y.solido_t = Some(tv)); solidez(&x); Ok(()) });
    def(em, "GetSolid", |_, a, o| n(o, solido_tipo(&s0(a)) as f64));
    def(em, "SetNotSolid", |_, a, _| { let x = s0(a); let v = ar(a, 1); let ns = !matches!(v, Valor::Bool(false) | Valor::Nil); ce(&x, |y| y.no_solido = ns); solidez(&x); Ok(()) });
    def(em, "IsSolid", |_, a, o| b(o, solido_tipo(&s0(a)) != 0));
    def(em, "SetCollisionGroup", |_, a, _| { let x = s0(a); let gv = i32_de(num(&ar(a, 1), 0.0)); ce(&x, |y| y.grupo_col = gv); solidez(&x); Ok(()) });
    def(em, "GetCollisionGroup", |_, a, o| n(o, ce(&s0(a), |x| x.grupo_col).unwrap_or(0) as f64));
    def(em, "GetCreator", |_, a, o| { let c = ce(&s0(a), |x| x.creador.clone()).flatten(); ok1(o, c.filter(|v| !v.es_nil()).unwrap_or_else(|| g(|g| g.jug.clone()))) });
    def(em, "SetCreator", |_, a, _| { ce(&s0(a), |x| x.creador = Some(ar(a, 1))); Ok(()) });
    def(em, "IsPlayer", |_, a, o| b(o, ent_tipo(&s0(a)) == Some(TipoEnt::Jug)));
    def(em, "IsNPC", |_, a, o| b(o, ent_tipo(&s0(a)) == Some(TipoEnt::Npc)));
    def(em, "IsWeapon", |_, a, o| b(o, ent_tipo(&s0(a)) == Some(TipoEnt::Arma)));
    def(em, "IsVehicle", |_, a, o| { let ob = ce(&s0(a), |x| x.o).flatten(); b(o, ob.and_then(|ob| cuerpo(ob, |c| c.veh)).unwrap_or(false)) });
    def(em, "IsWorld", |_, a, o| b(o, ent_tipo(&s0(a)) == Some(TipoEnt::Mundo)));
    def(em, "IsRagdoll", |_, a, o| b(o, ce(&s0(a), |x| x.clase == "prop_ragdoll").unwrap_or(false)));
    def(em, "IsNextBot", |_, _, o| b(o, false));
    let en_suelo = |x: &Valor| if yo(x) { h(|h| h.jug().suelo) } else { ce(x, |y| y.o).flatten().and_then(|ob| cuerpo(ob, |c| c.dormido)).unwrap_or(false) };
    def(em, "IsOnGround", move |_, a, o| b(o, en_suelo(&s0(a))));
    def(em, "GetGroundEntity", |_, _, o| ok1(o, g(|g| g.mundo.clone())));
    def(em, "WaterLevel", |_, _, o| n(o, 0.0));
    def(em, "IsOnFire", |_, a, o| b(o, ce(&s0(a), |x| x.fuego != 0.0 && !x.fuego.is_nan()).unwrap_or(false)));
    def(em, "Ignite", |_, a, _| { let tt = h(|h| h.tiempo()) + num(&ar(a, 1), 5.0); ce(&s0(a), |x| x.fuego = tt); Ok(()) });
    def(em, "Extinguish", |_, a, _| { ce(&s0(a), |x| x.fuego = 0.0); Ok(()) });
    def(em, "IsInWorld", |_, _, o| b(o, true));
    def(em, "Visible", |_, _, o| b(o, true));
    def(em, "IsDormant", |_, _, o| b(o, false));
    def(em, "GetInternalVariable", |_, a, o| { let k = cad(&js_str(&ar(a, 1))); ok1(o, ce(&s0(a), |x| x.kv.get(&k).cloned()).flatten().unwrap_or(Valor::Nil)) });
    let banderas = |x: &Valor| ce(x, |y| y.sf.unwrap_or_else(|| i32_de(mas(&y.kv.get(&cad("spawnflags")).cloned().filter(js_t).unwrap_or(Valor::Num(0.0)))))).unwrap_or(0);
    def(em, "GetSpawnFlags", move |_, a, o| n(o, banderas(&s0(a)) as f64));
    def(em, "HasSpawnFlags", move |_, a, o| b(o, banderas(&s0(a)) & i32_de(num(&ar(a, 1), 0.0)) != 0));
    def(em, "Fire", |_, a, _| {
        let x = s0(a);
        let inp = ar(a, 1);
        let inp = if js_t(&inp) { js_str(&inp) } else { String::new() };
        let val = ar(a, 2);
        let dem = mas(&ar(a, 3));
        let tt = h(|h| h.tiempo()) + if dem > 0.0 { dem } else { 0.0 };
        g(|g| g.t_simples.push(TSimple { t: tt, f: Accion::Rust(Box::new(move |e| { if ce(&x, |y| y.vivo).unwrap_or(false) { entrada(e, &x, &inp, val); } })), ctx: Lado::S }));
        Ok(())
    });
    def(em, "Input", |e, a, _| { let inp = ar(a, 1); let inp = if js_t(&inp) { js_str(&inp) } else { String::new() }; entrada(e, &s0(a), &inp, ar(a, 4)); Ok(()) });
    def(em, "SetKeyValue", |_, a, _| { let (k, v) = (ar(a, 1), ar(a, 2)); ce(&s0(a), |x| x.kv.set(k, v)); Ok(()) });
    def(em, "GetKeyValues", |_, a, o| {
        let t = Tabla::nueva_ref();
        if let Some(kv) = ce(&s0(a), |x| x.kv.v.clone()) { for (k, v) in kv { let _ = t.borrow_mut().set(cad(&js_str(&k)), v); } }
        ok1(o, Valor::Tabla(t))
    });
    def(em, "GetTable", |_, a, o| {
        let x = s0(a);
        let Some(tb) = tabla_de(&x) else { return ok1(o, Valor::Nil) };
        if tb.borrow().meta().is_none() {
            let m = Tabla::nueva_ref();
            let w = debil(&x);
            let tb2 = std::rc::Rc::downgrade(&tb);
            def(&m, "__index", move |e, a, o| {
                let x = fuerte(&w);
                let k = ar(a, 1);
                if let Valor::Cad(c) = &k {
                    match c.bytes() {
                        b"dt" => return ok1(o, Valor::Tabla(dt_l(&x))),
                        b"Entity" | b"Weapon" => return ok1(o, x),
                        b"Owner" => { let d = ce(&x, |y| y.dueno.clone()).flatten(); return ok1(o, opt_null(&d)); }
                        _ => {}
                    }
                }
                let c = ce(&x, |y| y.clase.clone()).and_then(|c| clase_tabla(&c, g(|g| g.ctx)));
                if let Some(c) = c { let v = buscar_en_clase_v(&c, &k); if !v.es_nil() { return ok1(o, v); } }
                let em = g(|g| g.mt.ent.clone().unwrap());
                let ix = em.borrow().get_str("__index");
                let f = e.llamar_uno(&ix, &[x.clone(), k])?;
                if let Valor::Func(_) = &f {
                    let tbw = tb2.clone();
                    let xw = debil(&x);
                    let f2 = f.clone();
                    return ok1(o, fnat(move |e, a, o| {
                        let mut v = a.to_vec();
                        if let (Some(Valor::Tabla(s)), Some(tb)) = (v.first(), tbw.upgrade()) { if std::rc::Rc::ptr_eq(s, &tb) { v[0] = fuerte(&xw); } }
                        o.extend(e.llamar_aqui(&f2, &v)?);
                        Ok(())
                    }));
                }
                ok1(o, f)
            });
            tb.borrow_mut().set_meta(Some(m));
        }
        ok1(o, Valor::Tabla(tb))
    });
    def(em, "SetTable", |_, a, _| { if let Valor::Tabla(t) = ar(a, 1) { let lado = g(|g| g.ctx); ce(&s0(a), |x| if lado == Lado::C { x.tabla_c = Some(t) } else { x.tabla = t }); } Ok(()) });
    def(em, "SetVar", |_, a, _| { if let Some(t) = tabla_de(&s0(a)) { let _ = t.borrow_mut().set(ar(a, 1), ar(a, 2)); } Ok(()) });
    def(em, "GetVar", |_, a, o| { let v = tabla_de(&s0(a)).map(|t| t.borrow().get(&ar(a, 1))).unwrap_or(Valor::Nil); ok1(o, if v.es_nil() { ar(a, 2) } else { v }) });
    def(em, "GetBoneCount", |_, _, o| n(o, 0.0));
    def(em, "GetBoneName", |_, _, o| s(o, "__INVALIDBONE__"));
    def(em, "LookupBone", |_, _, o| ok1(o, Valor::Nil));
    def(em, "GetBonePosition", |_, a, o| { let x = s0(a); o.push(vv(ent_pos(&x))); o.push(naa(quat_ang(ent_q(&x)))); Ok(()) });
    def(em, "GetBoneMatrix", |_, _, o| ok1(o, Valor::Nil));
    def(em, "LookupAttachment", |_, _, o| n(o, 0.0));
    def(em, "GetAttachment", |_, a, o| {
        let x = s0(a);
        if ent_tipo(&x) == Some(TipoEnt::Vm) {
            let c = h(|h| h.cam().clone());
            let p = c.pos.add(c.fwd.scale(0.6).add(c.der.scale(0.15).add(c.arr.scale(-0.12))));
            return ok1(o, tabla_kv(vec![("Pos", vv(p)), ("Ang", naa(dir_ang(ds(c.fwd)))), ("Bone", Valor::Num(0.0))]));
        }
        ok1(o, tabla_kv(vec![("Pos", vv(ent_pos(&x))), ("Ang", naa(quat_ang(ent_q(&x)))), ("Bone", Valor::Num(0.0))]))
    });
    def(em, "GetAttachments", |_, _, o| ok1(o, Valor::Tabla(Tabla::nueva_ref())));
    def(em, "Use", |e, a, _| { let act = ar(a, 1); let act = if t(&act) { act } else { ar(a, 2) }; usar(e, &s0(a), &act); Ok(()) });
    def(em, "GetName", |_, a, o| { let v = ce(&s0(a), |x| x.nombre.clone()).unwrap_or(Valor::Nil); ok1(o, if js_t(&v) { v } else { cad("") }) });
    def(em, "SetName", |_, a, _| { ce(&s0(a), |x| x.nombre = ar(a, 1)); Ok(()) });
    def(em, "MapCreationID", |_, _, o| n(o, -1.0));
    def(em, "GetCreationID", |_, a, o| { let x = s0(a); n(o, if ent_tipo(&x) == Some(TipoEnt::Jug) { 1.0 } else { ent_id(&x).unwrap_or(0) as f64 }) });
    def(em, "GetSpawnEffect", |_, _, o| b(o, false));
    def(em, "GetBrushPlane", |_, _, o| ok1(o, Valor::Nil));
    for k in ["GetFlags", "GetEffects", "GetRenderMode", "GetMoveCollide"] { def(em, k, |_, _, o| n(o, 0.0)); }
    for k in ["IsFlagSet", "IsEffectActive"] { def(em, k, |_, _, o| b(o, false)); }
    def(em, "GetNetworkOrigin", |_, a, o| ok1(o, vv(ent_pos(&s0(a)))));
    def(em, "GetLocalPos", |_, a, o| { let x = s0(a); match ce(&x, |y| if y.padre.is_some() { y.padre_off } else { None }).flatten() { Some(v) => ok1(o, vvr(v)), None => ok1(o, vv(ent_pos(&x))) } });
    def(em, "SetLocalPos", |e, a, _| {
        let x = s0(a);
        let v = ar(a, 1);
        if let (true, Some(p)) = (ce(&x, |y| y.padre.is_some()).unwrap_or(false), vec_de(&v)) { ce(&x, |y| y.padre_off = Some(vgr(p))); hijo_mover(&x); } else { let f = g(|g| g.mt.ent_m.clone()).unwrap().borrow().get_str("SetPos"); e.llamar_aqui(&f, &[x, v])?; }
        Ok(())
    });
    def(em, "GetLocalAngles", |e, a, o| { let x = s0(a); match ce(&x, |y| if y.padre.is_some() { y.padre_q } else { None }).flatten() { Some(q) => ok1(o, naa(quat_ang(q))), None => { let f = g(|g| g.mt.ent_m.clone()).unwrap().borrow().get_str("GetAngles"); o.extend(e.llamar_aqui(&f, &[x])?); Ok(()) } } });
    def(em, "SetLocalAngles", |e, a, _| {
        let x = s0(a);
        let v = ar(a, 1);
        if let (true, Some(an)) = (ce(&x, |y| y.padre.is_some()).unwrap_or(false), ang_de(&v)) { ce(&x, |y| y.padre_q = Some(ang_quat(an))); hijo_mover(&x); } else { let f = g(|g| g.mt.ent_m.clone()).unwrap().borrow().get_str("SetAngles"); e.llamar_aqui(&f, &[x, v])?; }
        Ok(())
    });
    def(em, "EyePos", |_, a, o| { let x = s0(a); ok1(o, vv(if yo(&x) { ojo() } else { ent_pos(&x) })) });
    def(em, "EyeAngles", |_, a, o| { let x = s0(a); ok1(o, naa(if yo(&x) { dir_ang(ds(apunta())) } else { quat_ang(ent_q(&x)) })) });
    def(em, "GetGravity", |_, _, o| n(o, 1.0));
    def(em, "SetGravity", nada);
    def(em, "GetElasticity", |_, _, o| n(o, 1.0));
    def(em, "GetFriction", |_, _, o| n(o, 1.0));
    // ---- NW y DT ----
    for tp in ["Int", "Float", "Bool", "String", "Entity", "Vector", "Angle", "Var", "2Int", "2Float", "2Bool", "2String", "2Entity", "2Vector", "2Angle", "2Var"] {
        let set = |_: &mut Estado, a: &[Valor], _: &mut Vec<Valor>| -> R { let (k, v) = (ar(a, 1), ar(a, 2)); ce(&s0(a), |x| x.nw.set(k, v)); Ok(()) };
        let tp2 = tp.to_string();
        let get = move |_: &mut Estado, a: &[Valor], o: &mut Vec<Valor>| -> R {
            let k = ar(a, 1);
            let r = ce(&s0(a), |x| if x.nw.has(&k) { Some(x.nw.get(&k).cloned().unwrap_or(Valor::Nil)) } else { None }).flatten();
            ok1(o, match r { Some(v) => v, None => { let d = ar(a, 2); if !d.es_nil() { d } else { d0_nw(&tp2) } } })
        };
        def(em, &format!("SetNW{}", tp), set);
        def(em, &format!("GetNW{}", tp), get.clone());
        let tq = tp.replace('2', "");
        def(em, &format!("SetNetworked{}", tq), set);
        def(em, &format!("GetNetworked{}", tq), get);
        let tp3 = tp.to_string();
        def(em, &format!("SetDT{}", tp), move |_, a, _| {
            let x = s0(a);
            let (k, v) = (ar(a, 1), ar(a, 2));
            let slot = format!("{}{}", tp3, js_str(&k));
            let nm = ce(&x, |y| y.dt_slot.get(&slot).cloned()).flatten();
            match nm { Some(nm) if js_t(&nm) => { let _ = dt_l(&x).borrow_mut().set(nm, v); } _ => { ce(&x, |y| y.nw.set(cad(&format!("dt{}", slot)), v)); } }
            Ok(())
        });
        let tp4 = tp.to_string();
        def(em, &format!("GetDT{}", tp), move |_, a, o| {
            let x = s0(a);
            let slot = format!("{}{}", tp4, js_str(&ar(a, 1)));
            let nm = ce(&x, |y| y.dt_slot.get(&slot).cloned()).flatten();
            let v = match nm { Some(nm) if js_t(&nm) => dt_l(&x).borrow().get(&nm), _ => ce(&x, |y| y.nw.get(&cad(&format!("dt{}", slot))).cloned()).flatten().unwrap_or(Valor::Nil) };
            ok1(o, if v.es_nil() { d0_nw(&tp4) } else { v })
        });
    }
    def(em, "SetNWVarProxy", nada);
    def(em, "GetNWVarTable", |_, a, o| {
        let t = Tabla::nueva_ref();
        if let Some(kv) = ce(&s0(a), |x| x.nw.v.clone()) { for (k, v) in kv { let _ = t.borrow_mut().set(cad(&js_str(&k)), v); } }
        ok1(o, Valor::Tabla(t))
    });
    def(em, "NetworkVar", |_, a, _| {
        let x = s0(a);
        let tp = js_str(&ar(a, 1));
        let slot = ar(a, 2);
        let nombre = if matches!(slot, Valor::Cad(_)) { slot.clone() } else { ar(a, 3) };
        let d0 = d0_nw(&tp);
        if let Valor::Num(_) = slot { let k = format!("{}{}", tp, js_str(&slot)); let nm = nombre.clone(); ce(&x, |y| y.dt_slot.insert(k, nm)); }
        let dl = dt_l(&x);
        if dl.borrow().get(&nombre).es_nil() && !d0.es_nil() { let _ = dl.borrow_mut().set(nombre.clone(), d0.clone()); }
        let dt = ce(&x, |y| y.dt.get_or_insert_with(Tabla::nueva_ref).clone()).unwrap();
        let nm = js_str(&nombre);
        let w = debil(&x);
        let (n1, w1) = (nombre.clone(), w.clone());
        dt.borrow_mut().set_str(&format!("Set{}", nm), fnat(move |_, a, _| { let s = ar(a, 0); let e = if es_ent(&s) { s } else { fuerte(&w1) }; let _ = dt_l(&e).borrow_mut().set(n1.clone(), ar(a, 1)); Ok(()) }));
        let (n2, w2) = (nombre.clone(), w);
        dt.borrow_mut().set_str(&format!("Get{}", nm), fnat(move |_, a, o| { let s = ar(a, 0); let e = if es_ent(&s) { s } else { fuerte(&w2) }; let v = dt_l(&e).borrow().get(&n2); ok1(o, if v.es_nil() { d0.clone() } else { v }) }));
        Ok(())
    });
    def(em, "DTVar", |_, a, _| {
        let x = s0(a);
        let tp = js_str(&ar(a, 1));
        let nombre = ar(a, 3);
        let k = format!("{}{}", tp, js_str(&ar(a, 2)));
        let nm = nombre.clone();
        ce(&x, |y| y.dt_slot.insert(k, nm));
        let d0 = d0_nw(&tp);
        let dl = dt_l(&x);
        if dl.borrow().get(&nombre).es_nil() && !d0.es_nil() { let _ = dl.borrow_mut().set(nombre, d0); }
        Ok(())
    });
    for k in ["NetworkVarElement", "NetworkVarNotify", "InstallDataTable"] { def(em, k, nada); }
    def(em, "FireBullets", |e, a, _| { balas(e, &s0(a), &ar(a, 1)); Ok(()) });
    def(em, "MuzzleFlash", |_, a, _| { if yo(&s0(a)) { h(|h| h.efecto_fogonazo()); } Ok(()) });
    // ---- jugador ----
    let pm = &ply_m;
    for k in ["Nick", "Name", "GetName"] { def(pm, k, |_, _, o| { let nm = h(|h| h.nombre_jugador()); s(o, &nm) }); }
    def(pm, "SteamID", |_, _, o| s(o, "STEAM_0:0:1248"));
    def(pm, "SteamID64", |_, _, o| s(o, "765611910000000001"));
    for k in ["UniqueID", "AccountID", "UserID", "Team"] { def(pm, k, |_, _, o| n(o, 1.0)); }
    for k in ["Ping", "Frags", "Deaths"] { def(pm, k, |_, _, o| n(o, 0.0)); }
    def(pm, "IsBot", |_, _, o| b(o, false));
    def(pm, "SetTeam", nada);
    def(pm, "GetUserGroup", |_, _, o| s(o, "superadmin"));
    for k in ["IsAdmin", "IsSuperAdmin", "IsListenServerHost", "IsFullyAuthenticated"] { def(pm, k, |_, _, o| b(o, true)); }
    def(pm, "IsUserGroup", |_, a, o| { let gg = ar(a, 1); b(o, ["superadmin", "admin", "user"].iter().any(|x| matches!(&gg, Valor::Cad(c) if c.bytes() == x.as_bytes()))) });
    def(pm, "Alive", |_, _, o| b(o, h(|h| h.jug().vivo)));
    def(pm, "Armor", |_, _, o| n(o, g(|g| g.armor)));
    def(pm, "SetArmor", |_, a, _| { let v = num(&ar(a, 1), 0.0); g(|g| g.armor = v); Ok(()) });
    for k in ["Kill", "KillSilent"] { def(pm, k, |_, _, _| { h(|h| h.matar_jugador()); Ok(()) }); }
    def(pm, "GetActiveWeapon", |e, _, o| ok1(o, arma_activa(e)));
    def(pm, "SetDSP", nada);
    def(pm, "Give", |e, a, o| { let p = s0(a); if yo(&p) { let c = js_str(&ar(a, 1)); ok1(o, dar_arma(e, &c, true)) } else { ok1(o, null()) } });
    def(pm, "StripWeapon", |_, a, _| { quitar_arma(&js_str(&ar(a, 1))); Ok(()) });
    def(pm, "StripWeapons", nada);
    def(pm, "HasWeapon", |e, a, o| {
        let c = js_str(&ar(a, 1));
        if g(|g| g.armas_jug.has(&c)) { return b(o, true); }
        if let Some(f) = fantasma(e) { if ce(&f, |x| x.clase == c).unwrap_or(false) { return b(o, true); } }
        let nm = hl2_arma(&c).map(String::from).or_else(|| c.strip_prefix("jx_").map(String::from));
        b(o, nm.map(|nm| h(|h| h.armas().lista.iter().any(|x| *x == nm))).unwrap_or(false))
    });
    def(pm, "GetWeapon", |e, a, o| { let c = js_str(&ar(a, 1)); if let Some(w) = g(|g| g.armas_jug.get(&c).cloned()) { return ok1(o, w); } let f = fantasma(e).filter(|f| ce(f, |x| x.clase == c).unwrap_or(false)); ok1(o, f.unwrap_or_else(null)) });
    def(pm, "GetWeapons", |_, _, o| ok1(o, tab_de(g(|g| g.armas_jug.v.iter().map(|x| x.1.clone()).collect()))));
    def(pm, "SelectWeapon", |_, a, _| {
        let mut c = ar(a, 1);
        if let Some(cl) = ce(&c, |x| x.clase.clone()) { c = cad(&cl); }
        let cs = js_str(&c);
        if g(|g| g.armas_jug.has(&cs)) { let nm = format!("gm:{}", cs); if h(|h| h.arma_definida(&nm)) { h(|h| h.elegir_arma_callado(&nm)); } }
        else {
            let nm = hl2_arma(&cs).map(String::from).or_else(|| if matches!(c, Valor::Cad(_)) { cs.strip_prefix("jx_").map(String::from) } else { None });
            if let Some(nm) = nm { if h(|h| h.armas().lista.iter().any(|x| *x == nm)) { h(|h| h.elegir_arma_callado(&nm)); } }
        }
        Ok(())
    });
    def(pm, "SetActiveWeapon", nada);
    def(pm, "GetLaggedMovementValue", |_, _, o| n(o, g(|g| g.lag_mov).unwrap_or(1.0)));
    def(pm, "SetLaggedMovementValue", |_, a, _| { let v = num(&ar(a, 1), 1.0); g(|g| g.lag_mov = Some(v)); Ok(()) });
    def(pm, "GetAmmoCount", |_, _, o| n(o, 999.0));
    for k in ["GiveAmmo", "RemoveAmmo", "SetAmmo", "StripAmmo"] { def(pm, k, nada); }
    for k in ["GetEyeTrace", "GetEyeTraceNoCursor"] { def(pm, k, |_, _, o| ok1(o, traza(ojo(), apunta(), 32768.0 * GS, &[], None))); }
    def(pm, "CheckLimit", |_, _, o| b(o, true));
    def(pm, "GetCount", |_, _, o| n(o, 0.0));
    for k in ["AddCount", "AddCleanup", "LimitHit"] { def(pm, k, nada); }
    def(pm, "ShouldDrawLocalPlayer", |_, _, o| b(o, h(|h| h.jug().tercera)));
    def(pm, "GetShootPos", |_, _, o| ok1(o, vv(ojo())));
    def(pm, "GetAimVector", |_, _, o| ok1(o, vvd(apunta())));
    def(pm, "SetEyeAngles", |_, a, _| {
        let an = crate::valores::ax(&ar(a, 1))?;
        let f = dg(ang_mat(an)[0]);
        h(|h| { let j = h.jug(); j.yaw = f.x.atan2(f.z); j.pitch = (-(f.y.clamp(-1.0, 1.0)).asin()).clamp(-1.55, 1.55); });
        Ok(())
    });
    def(pm, "KeyDown", |e, a, o| b(o, tecla(e, i32_de(mas(&ar(a, 1))) as u32)));
    def(pm, "KeyPressed", |e, a, o| { let k = i32_de(mas(&ar(a, 1))) as u32; b(o, tecla(e, k) && g(|g| g.tec_ant) & k == 0) });
    def(pm, "KeyReleased", |e, a, o| { let k = i32_de(mas(&ar(a, 1))) as u32; b(o, !tecla(e, k) && g(|g| g.tec_ant) & k != 0) });
    def(pm, "KeyDownLast", |_, a, o| { let k = i32_de(mas(&ar(a, 1))) as u32; b(o, g(|g| g.tec_ant) & k != 0) });
    def(pm, "ChatPrint", |_, a, _| { let sv = js_str(&ar(a, 1)); h(|h| h.chat(&sv)); Ok(()) });
    def(pm, "PrintMessage", |_, a, _| { let sv = js_str(&ar(a, 2)); if matches!(ar(a, 1), Valor::Num(x) if x == 4.0) { h(|h| h.aviso(&sv, 3.0)); } else { h(|h| h.chat(&sv)); } Ok(()) });
    def(pm, "SetWalkSpeed", |_, a, _| { let v = num(&ar(a, 1), 200.0); g(|g| g.walk = Some(v)); h(|h| h.jug().vel_max = v * GS); Ok(()) });
    def(pm, "GetWalkSpeed", |_, _, o| n(o, g(|g| g.walk).filter(|x| *x != 0.0).unwrap_or(200.0)));
    def(pm, "SetRunSpeed", |_, a, _| { let v = num(&ar(a, 1), 400.0); g(|g| g.run = Some(v)); Ok(()) });
    def(pm, "GetStepSize", |_, _, o| n(o, g(|g| g.escalon).filter(|x| *x != 0.0).unwrap_or(18.0)));
    def(pm, "SetStepSize", |_, a, _| { let v = num(&ar(a, 1), 18.0); g(|g| g.escalon = Some(v)); Ok(()) });
    def(pm, "GetRunSpeed", |_, _, o| { let r = g(|g| g.run).filter(|x| *x != 0.0); n(o, r.unwrap_or_else(|| { let vm = h(|h| h.jug().vel_max); let vm = if vm == 0.0 { 6.0 } else { vm }; (vm * 1.35 / GS).round() })) });
    def(pm, "SetJumpPower", |_, a, _| { let v = num(&ar(a, 1), 200.0); g(|g| g.jump = Some(v)); h(|h| h.jug().salto = 1.1 * (v / 200.0)); Ok(()) });
    def(pm, "GetJumpPower", |_, _, o| n(o, g(|g| g.jump).filter(|x| *x != 0.0).unwrap_or(200.0)));
    for k in ["SetMaxSpeed", "SetCrouchedWalkSpeed", "SetDuckSpeed", "SetAllowWeaponsInVehicle"] { def(pm, k, nada); }
    def(pm, "GetAllowWeaponsInVehicle", |_, _, o| b(o, false));
    def(pm, "InVehicle", |_, _, o| b(o, h(|h| h.jug().vehiculo.is_some())));
    def(pm, "GetVehicle", |_, _, o| { let v = h(|h| h.jug().vehiculo); ok1(o, v.map(ent_de_obj).unwrap_or_else(null)) });
    def(pm, "Crouching", |_, _, o| b(o, h(|h| h.jug().agachado)));
    def(pm, "IsSprinting", |_, _, o| b(o, h(|h| h.entrada().correr)));
    fn punch(p: &Valor) -> [f64; 3] { ce(p, |x| *x.punch.get_or_insert([0.0; 3])).unwrap_or([0.0; 3]) }
    def(pm, "ViewPunch", |_, a, _| {
        let Some(an) = ang_de(&ar(a, 1)) else { return Ok(()) };
        let p = s0(a);
        let q = punch(&p);
        ce(&p, |x| x.punch = Some([q[0] + an[0], q[1] + an[1], q[2] + an[2]]));
        h(|h| { let c = h.cam(); c.temblor = jmax(c.temblor, jmin(0.6, an[0].abs() / 10.0)); });
        Ok(())
    });
    def(pm, "ViewPunchReset", |_, a, _| { let tv = mas(&ar(a, 1)); if !(tv > 0.0) { ce(&s0(a), |x| x.punch = Some([0.0; 3])); } Ok(()) });
    def(pm, "SetViewPunchAngles", |_, a, _| { if let Some(an) = ang_de(&ar(a, 1)) { ce(&s0(a), |x| x.punch = Some(an)); } Ok(()) });
    def(pm, "SetViewPunchVelocity", nada);
    for k in ["GetViewPunchAngles", "GetPunchAngle"] { def(pm, k, |_, a, o| ok1(o, naa(punch(&s0(a))))); }
    def(pm, "GetViewPunchVelocity", |_, _, o| ok1(o, na(0.0, 0.0, 0.0)));
    def(pm, "GetViewModel", |_, _, o| { let v = g(|g| g.vm_ent.clone()); ok1(o, match v { Some(v) => v, None => { let v = nueva_ent("viewmodel", TipoEnt::Vm); g(|g| g.vm_ent = Some(v.clone())); v } }) });
    let manos = || { if let Some(m) = g(|g| g.manos_ent.clone()).filter(|m| ce(m, |x| x.vivo).unwrap_or(false)) { return m; } let m = nueva_ent("gmod_hands", TipoEnt::Manos); ce(&m, |x| x.creado = true); g(|g| g.manos_ent = Some(m.clone())); m };
    def(pm, "GetHands", move |_, _, o| ok1(o, manos()));
    def(pm, "SetupHands", move |_, _, _| { manos(); Ok(()) });
    def(pm, "ConCommand", |e, a, _| { consola2(e, &js_str(&ar(a, 1))); Ok(()) });
    def(pm, "SendLua", nada);
    def(pm, "GetInfo", |_, a, o| { let k = js_str(&ar(a, 1)); let c = g(|g| g.cvars.get(&k).cloned()); s(o, &c.map(|c| c.borrow().v.clone()).unwrap_or_default()) });
    def(pm, "GetInfoNum", |_, a, o| { let k = js_str(&ar(a, 1)); let d = ar(a, 2); let c = g(|g| g.cvars.get(&k).cloned()); ok1(o, match c { Some(c) => { let v = cad(&c.borrow().v); Estado::a_numero(&v).map(Valor::Num).unwrap_or(d) } None => d }) });
    def(pm, "SetModel", nada);
    def(pm, "GetModel", |_, _, o| s(o, "models/player/kleiner.mdl"));
    def(pm, "SetPlayerColor", nada);
    def(pm, "GetPlayerColor", |_, _, o| ok1(o, nv(0.24, 0.34, 0.41)));
    def(pm, "SetWeaponColor", nada);
    def(pm, "GetWeaponColor", |_, _, o| ok1(o, nv(0.3, 1.8, 2.1)));
    def(pm, "GetObserverMode", |_, _, o| n(o, 0.0));
    for k in ["Spectate", "UnSpectate", "DrawWorldModel", "AddFrags", "AddDeaths", "SetFrags", "SetDeaths"] { def(pm, k, nada); }
    def(pm, "Freeze", |_, a, _| { let v = t(&ar(a, 1)); h(|h| h.jug().congelado = v); Ok(()) });
    def(pm, "IsFrozen", |_, _, o| b(o, h(|h| h.jug().congelado)));
    def(pm, "Lock", |_, _, _| { h(|h| h.jug().bloqueado = true); Ok(()) });
    def(pm, "UnLock", |_, _, _| { h(|h| h.jug().bloqueado = false); Ok(()) });
    def(pm, "DrawViewModel", |_, a, _| { let off = matches!(ar(a, 1), Valor::Bool(false)); if let Some(w) = g(|g| g.swep.clone()) { ce(&w, |x| x.vm_apagada = off); } Ok(()) });
    def(pm, "GetFOV", |_, _, o| { let f = h(|h| h.cam().fov); n(o, if f == 0.0 || f.is_nan() { 75.0 } else { f }) });
    def(pm, "SetFOV", |_, a, _| {
        if !yo(&s0(a)) { return Ok(()); }
        let x = num(&ar(a, 1), 0.0);
        let sw = g(|g| g.swep.clone());
        g(|g| { g.fov_lua = if x > 0.0 { x.min(170.0).max(1.0) } else { 0.0 }; g.fov_arma = if x > 0.0 { sw } else { None }; });
        Ok(())
    });
    def(pm, "IPAddress", |_, _, o| s(o, "loopback"));
    def(pm, "TimeConnected", |_, _, o| n(o, h(|h| h.tiempo())));
    def(pm, "LastHitGroup", |_, _, o| n(o, 0.0));
    def(pm, "GetRagdollEntity", |_, _, o| ok1(o, null()));
    def(pm, "GetEyeTraceNoCursor", |_, _, o| { let c = h(|h| h.cam().clone()); ok1(o, traza(c.pos, c.fwd, 32768.0 * GS, &[], None)) });
    for k in ["IsTyping", "IsSpeaking", "IsMuted"] { def(pm, k, |_, _, o| b(o, false)); }
    for k in ["SetNoTarget", "GodEnable", "GodDisable"] { def(pm, k, nada); }
    def(pm, "HasGodMode", |_, _, o| b(o, false));
    // ---- armas ----
    let wm = &wep_m;
    def(wm, "Clip1", |_, a, o| n(o, ce(&s0(a), |x| x.clip1).flatten().unwrap_or(-1.0)));
    def(wm, "Clip2", |_, a, o| n(o, ce(&s0(a), |x| x.clip2).flatten().unwrap_or(-1.0)));
    def(wm, "SetClip1", |_, a, _| { let v = num(&ar(a, 1), 0.0); ce(&s0(a), |x| x.clip1 = Some(v)); Ok(()) });
    def(wm, "SetClip2", |_, a, _| { let v = num(&ar(a, 1), 0.0); ce(&s0(a), |x| x.clip2 = Some(v)); Ok(()) });
    def(wm, "GetPrimaryAmmoType", |_, _, o| n(o, 1.0));
    def(wm, "GetSecondaryAmmoType", |_, _, o| n(o, -1.0));
    for k in ["Ammo1", "Ammo2"] { def(wm, k, |_, _, o| n(o, 999.0)); }
    def(wm, "GetMaxClip1", |_, a, o| { let v = swep_dato(&s0(a), "Primary", "ClipSize"); ok1(o, if v.es_nil() { Valor::Num(-1.0) } else { v }) });
    def(wm, "GetMaxClip2", |_, _, o| n(o, -1.0));
    def(wm, "SetNextPrimaryFire", |_, a, _| { let v = num(&ar(a, 1), 0.0); ce(&s0(a), |x| x.next_p = v); Ok(()) });
    def(wm, "GetNextPrimaryFire", |_, a, o| n(o, ce(&s0(a), |x| x.next_p).filter(|v| !v.is_nan()).unwrap_or(0.0)));
    def(wm, "SetNextSecondaryFire", |_, a, _| { let v = num(&ar(a, 1), 0.0); ce(&s0(a), |x| x.next_s = v); Ok(()) });
    def(wm, "GetNextSecondaryFire", |_, a, o| n(o, ce(&s0(a), |x| x.next_s).filter(|v| !v.is_nan()).unwrap_or(0.0)));
    def(wm, "SendWeaponAnim", |e, a, _| { anim_vista(e, &s0(a), &ar(a, 1)); Ok(()) });
    for k in ["SetHoldType", "SetWeaponHoldType"] { def(wm, k, |_, a, _| { ce(&s0(a), |x| x.hold = ar(a, 1)); Ok(()) }); }
    def(wm, "GetHoldType", |_, a, o| { let v = ce(&s0(a), |x| x.hold.clone()).unwrap_or(Valor::Nil); ok1(o, if js_t(&v) { v } else { cad("pistol") }) });
    def(wm, "DefaultReload", |e, a, o| {
        let w = s0(a);
        let mx = swep_dato(&w, "Primary", "ClipSize");
        let (clip, rec) = ce(&w, |x| (x.clip1, x.recarga)).unwrap_or((None, 0.0));
        if mx.es_nil() || mas(&mx) < 0.0 || clip.map(|c| c >= mas(&mx)).unwrap_or(false) || rec != 0.0 { return b(o, false); }
        let act = ar(a, 1);
        let act = if matches!(act, Valor::Num(_)) { act } else { e.globales().borrow().get_str("ACT_VM_RELOAD") };
        anim_vista(e, &w, &act);
        let tt = h(|h| h.tiempo());
        ce(&w, |x| { x.recarga = tt + 1.4; x.next_p = jmax(x.next_p, x.recarga); x.next_s = jmax(x.next_s, x.recarga); });
        b(o, true)
    });
    def(wm, "GetActivity", |_, _, o| n(o, 0.0));
    def(wm, "CallOnClient", |_, a, _| {
        let w = s0(a);
        let nm = ar(a, 1);
        if g(|g| g.ctx) != Lado::S || nm.es_nil() { return Ok(()); }
        let nom = js_str(&nm);
        let arg = ar(a, 2);
        let x = if arg.es_nil() { String::new() } else { js_str(&arg) };
        let f: Box<dyn FnOnce(&mut Estado)> = Box::new(move |e| { let es = g(|g| g.swep.as_ref().map(|s| mismo(s, &w)).unwrap_or(false)); if ce(&w, |y| y.vivo).unwrap_or(false) && es { metodo(e, &w, &nom, Lado::C, &[cad(&x)]); } });
        g(|gg| gg.t_simples.push(TSimple { t: 0.0, f: Accion::Rust(f), ctx: Lado::C }));
        Ok(())
    });
    def(wm, "IsCarriedByLocalPlayer", |_, a, o| b(o, ce(&s0(a), |x| x.dueno.as_ref().map(es_jug).unwrap_or(false)).unwrap_or(false)));
    def(wm, "GetPrintName", |_, a, o| {
        let clase = ce(&s0(a), |x| x.clase.clone()).unwrap_or_default();
        let v = clase_tabla(&clase, Lado::S).map(|c| tget(&c, "PrintName")).unwrap_or(Valor::Nil);
        ok1(o, if js_t(&v) { v } else { cad(&clase) })
    });
    def(wm, "SetDeploySpeed", nada);
    def(wm, "IsScripted", |_, _, o| b(o, true));
    def(wm, "Clip1Max", |_, _, o| n(o, 0.0));
    def(wm, "HasAmmo", |_, a, o| b(o, ce(&s0(a), |x| x.clip1.unwrap_or(1.0)).unwrap_or(1.0) > 0.0));
    def(wm, "LastShootTime", |_, a, o| n(o, ce(&s0(a), |x| x.ult_tiro).unwrap_or(0.0)));
    def(wm, "SetLastShootTime", |_, a, _| { let tt = h(|h| h.tiempo()); ce(&s0(a), |x| x.ult_tiro = tt); Ok(()) });
    def(wm, "IsWeaponVisible", |_, _, o| b(o, true));
    def(wm, "GetWeaponViewModel", |_, a, o| { let v = ce(&s0(a), |x| x.vm.clone()).unwrap_or(Valor::Nil); ok1(o, if js_t(&v) { v } else { cad("") }) });
    def(wm, "GetWeaponWorldModel", |_, a, o| { let v = ce(&s0(a), |x| x.wm.clone()).unwrap_or(Valor::Nil); ok1(o, if js_t(&v) { v } else { cad("") }) });
    // ---- física ----
    let mp = Tabla::nueva_ref();
    mp.borrow_mut().set_str("__index", Valor::Tabla(phy_m.clone()));
    def(&mp, "__tostring", |_, a, o| { let id = ent_id(&fis_ent(&s0(a))).unwrap_or(0); ok1(o, Valor::from(format!("PhysObject [{}]", id))) });
    g(|g| g.mt.phy = Some(mp));
    let fm = &phy_m;
    let bo = |f: &Valor| -> Option<ObjId> { ce(&fis_ent(f), |x| x.o).flatten().filter(|o| cuerpo(*o, |_| ()).is_some()) };
    def(fm, "IsValid", move |_, a, o| b(o, bo(&s0(a)).is_some()));
    def(fm, "Wake", move |_, a, _| { if let Some(ob) = bo(&s0(a)) { cuerpo(ob, |c| c.despertar()); } Ok(()) });
    def(fm, "Sleep", nada);
    def(fm, "IsAsleep", move |_, a, o| b(o, bo(&s0(a)).and_then(|ob| cuerpo(ob, |c| c.dormido)).unwrap_or(false)));
    def(fm, "EnableMotion", move |_, a, _| {
        let f = s0(a);
        let Some(ob) = bo(&f) else { return Ok(()) };
        let sv = t(&ar(a, 1));
        let ent = fis_ent(&f);
        if sv && padre_de(&ent).is_some() { return Ok(()); }
        cuerpo(ob, |c| { c.congelado = !sv; c.cambios |= CUERPO_CONGELADO; if sv { c.despertar(); } });
        Ok(())
    });
    for k in ["IsMotionEnabled", "IsMoveable"] { def(fm, k, move |_, a, o| b(o, bo(&s0(a)).and_then(|ob| cuerpo(ob, |c| !c.congelado)).unwrap_or(false))); }
    def(fm, "EnableGravity", move |_, a, _| { let sv = t(&ar(a, 1)); if let Some(ob) = bo(&s0(a)) { cuerpo(ob, |c| { c.sin_grav = !sv; c.cambios |= CUERPO_OTROS; }); } Ok(()) });
    def(fm, "IsGravityEnabled", move |_, a, o| b(o, !bo(&s0(a)).and_then(|ob| cuerpo(ob, |c| c.sin_grav)).unwrap_or(false)));
    for k in ["EnableCollisions", "EnableDrag", "SetMaterial", "SetDamping", "SetDragCoefficient", "SetBuoyancyRatio", "SetInertia", "OutputDebugInfo", "RecheckCollisionFilter", "ComputeShadowControl", "UpdateShadow"] { def(fm, k, nada); }
    def(fm, "ApplyForceCenter", move |_, a, _| {
        let (Some(ob), Some(fv)) = (bo(&s0(a)), vec_de(&ar(a, 1))) else { return Ok(()) };
        cuerpo(ob, |c| if c.masa != 0.0 && !c.masa.is_nan() { c.despertar(); c.vel = c.vel.add(vgr(fv).scale(1.0 / c.masa)); c.cambios |= CUERPO_VEL; });
        Ok(())
    });
    def(fm, "ApplyForceOffset", move |_, a, _| {
        let (Some(ob), Some(fv)) = (bo(&s0(a)), vec_de(&ar(a, 1))) else { return Ok(()) };
        cuerpo(ob, |c| if c.masa != 0.0 && !c.masa.is_nan() { c.despertar(); c.vel = c.vel.add(vgr(fv).scale(1.0 / c.masa)); c.cambios |= CUERPO_VEL; });
        Ok(())
    });
    def(fm, "ApplyTorqueCenter", move |_, a, _| { let (Some(ob), Some(tv)) = (bo(&s0(a)), vec_de(&ar(a, 1))) else { return Ok(()) }; cuerpo(ob, |c| { c.despertar(); c.ang = c.ang.add(dg(tv).scale(0.0005)); c.cambios |= CUERPO_ANG; }); Ok(()) });
    for k in ["SetVelocity", "SetVelocityInstantaneous"] { def(fm, k, move |_, a, _| { if let Some(ob) = bo(&s0(a)) { let v = vgr(vec_de(&ar(a, 1)).unwrap_or([f64::NAN; 3])); cuerpo(ob, |c| { c.vel = v; c.cambios |= CUERPO_VEL; c.despertar(); }); } Ok(()) }); }
    def(fm, "AddVelocity", move |_, a, _| { if let Some(ob) = bo(&s0(a)) { let v = vgr(vec_de(&ar(a, 1)).unwrap_or([f64::NAN; 3])); cuerpo(ob, |c| { c.vel = c.vel.add(v); c.cambios |= CUERPO_VEL; c.despertar(); }); } Ok(()) });
    def(fm, "GetVelocity", move |_, a, o| ok1(o, vvr(bo(&s0(a)).and_then(|ob| cuerpo(ob, |c| c.vel)).unwrap_or_default())));
    def(fm, "GetAngleVelocity", move |_, a, o| ok1(o, vvd(bo(&s0(a)).and_then(|ob| cuerpo(ob, |c| c.ang.scale(1.0 / RAD))).unwrap_or_default())));
    def(fm, "AddAngleVelocity", move |_, a, _| { let (Some(ob), Some(av)) = (bo(&s0(a)), vec_de(&ar(a, 1))) else { return Ok(()) }; cuerpo(ob, |c| { c.despertar(); c.ang = c.ang.add(c.q.rot(dg(av)).scale(RAD)); c.cambios |= CUERPO_ANG; }); Ok(()) });
    def(fm, "SetMass", move |_, a, _| { if let Some(ob) = bo(&s0(a)) { let m = num(&ar(a, 1), 1.0); cuerpo(ob, |c| { c.masa = m; c.cambios |= CUERPO_MASA; }); } Ok(()) });
    def(fm, "GetMass", move |_, a, o| n(o, bo(&s0(a)).and_then(|ob| cuerpo(ob, |c| if c.masa == 0.0 || c.masa.is_nan() { 1.0 } else { c.masa })).unwrap_or(0.0)));
    def(fm, "GetPos", move |_, a, o| { let ob = ce(&fis_ent(&s0(a)), |x| x.o).flatten(); ok1(o, vv(ob.and_then(origen).unwrap_or_default())) });
    def(fm, "SetPos", move |_, a, _| { if let Some(Some(ob)) = ce(&fis_ent(&s0(a)), |x| x.o) { let p = a_juego(vec_de(&ar(a, 1)).unwrap_or([f64::NAN; 3])); origen_pon(ob, p, None); cuerpo(ob, |c| c.despertar()); } Ok(()) });
    def(fm, "GetAngles", move |_, a, o| ok1(o, naa(quat_ang(bo(&s0(a)).and_then(|ob| cuerpo(ob, |c| c.q)).unwrap_or_default()))));
    def(fm, "SetAngles", move |_, a, _| { if let Some(ob) = bo(&s0(a)) { let q = ang_quat(ang_de(&ar(a, 1)).unwrap_or([0.0; 3])); cuerpo(ob, |c| { c.q = q; c.cambios |= CUERPO_Q; c.despertar(); }); } Ok(()) });
    def(fm, "GetEntity", |_, a, o| ok1(o, fis_ent(&s0(a))));
    def(fm, "GetMaterial", |_, _, o| s(o, "metal"));
    def(fm, "GetInertia", |_, _, o| ok1(o, nv(1.0, 1.0, 1.0)));
    {
        let em2 = ent_m.clone();
        def(fm, "LocalToWorld", move |e, a, o| { let f = em2.borrow().get_str("LocalToWorld"); o.extend(e.llamar_aqui(&f, &[fis_ent(&s0(a)), ar(a, 1)])?); Ok(()) });
        let em3 = ent_m.clone();
        def(fm, "WorldToLocal", move |e, a, o| { let f = em3.borrow().get_str("WorldToLocal"); o.extend(e.llamar_aqui(&f, &[fis_ent(&s0(a)), ar(a, 1)])?); Ok(()) });
    }
    def(fm, "GetVolume", move |_, a, o| n(o, bo(&s0(a)).and_then(|ob| cuerpo(ob, |c| { let (p, q) = (c.aabb[0], c.aabb[1]); ((q.x - p.x) * (q.y - p.y) * (q.z - p.z)).abs() * 0.6 / (GS * GS * GS) })).unwrap_or(0.0)));
    def(fm, "GetMassCenter", |_, a, o| { let ob = ce(&fis_ent(&s0(a)), |x| x.o).flatten(); let c = ob.and_then(|ob| cuerpo(ob, |c| c.c)).flatten(); ok1(o, c.map(vvr).unwrap_or_else(|| nv(0.0, 0.0, 0.0))) });
    // ---- lo que usan muchos addons ----
    let solo = |m: &TablaRef, k: &str, f: Valor| if m.borrow().get_str(k).es_nil() { m.borrow_mut().set_str(k, f); };
    solo(em, "OnGround", fnat(move |_, a, o| b(o, en_suelo(&s0(a)))));
    solo(em, "DropToFloor", fnat(|_, a, _| {
        let x = s0(a);
        if yo(&x) {
            let p = h(|h| h.jug().pos);
            if let Some(hit) = h(|h| h.raycast(v3(p.x, p.y + 0.5, p.z), v3(0.0, -1.0, 0.0), 60.0, &[])) { let y = p.y + 0.5 - hit.t; h(|h| { let j = h.jug(); j.pos.y = y + j.medio + j.radio; j.vel.y = 0.0; }); }
            return Ok(());
        }
        let Some(Some(ob)) = ce(&x, |y| y.o) else { return Ok(()) };
        let Some(aa) = cuerpo(ob, |c| c.aabb) else { return Ok(()) };
        let pp = v3((aa[0].x + aa[1].x) / 2.0, aa[0].y, (aa[0].z + aa[1].z) / 2.0);
        if let Some(hit) = h(|h| h.raycast(v3(pp.x, pp.y + 0.5, pp.z), v3(0.0, -1.0, 0.0), 60.0, &[])) { let y = pp.y + 0.5 - hit.t; cuerpo(ob, |c| { c.pos.y += y - aa[0].y; c.vel = V3::default(); c.cambios |= CUERPO_POS | CUERPO_VEL; c.despertar(); }); }
        Ok(())
    }));
    fn aabb_mundo(x: &Valor) -> ([f64; 3], [f64; 3]) {
        if es_jug(x) { let j = h(|h| h.jug().clone()); let (p, r) = (j.pos, j.radio); return (a_source(v3(p.x - r, p.y - j.medio - r, p.z - r)), a_source(v3(p.x + r, p.y + j.ojo_alto - j.medio, p.z + r))); }
        if let Some(Some([l0, l1])) = ce(x, |y| if y.tipo != TipoEnt::Jug { y.limites } else { None }) {
            let sc = ce(x, |y| if y.escala == 0.0 || y.escala.is_nan() { 1.0 } else { y.escala }).unwrap_or(1.0);
            let (q, p) = (ent_q(x), ent_pos(x));
            let (mut lo, mut hi) = ([f64::INFINITY; 3], [f64::NEG_INFINITY; 3]);
            for c in 0..8 {
                let w = a_source(p.add(q.rot(vgr([if c & 1 != 0 { l1[0] } else { l0[0] } * sc, if c & 2 != 0 { l1[1] } else { l0[1] } * sc, if c & 4 != 0 { l1[2] } else { l0[2] } * sc]))));
                for i in 0..3 { lo[i] = lo[i].min(w[i]); hi[i] = hi[i].max(w[i]); }
            }
            return (lo, hi);
        }
        let ob = ce(x, |y| y.o).flatten();
        let Some(aa) = ob.and_then(|ob| cuerpo(ob, |c| c.aabb)) else { let p = a_source(ent_pos(x)); return (p, p); };
        let (p0, p1) = (a_source(aa[0]), a_source(aa[1]));
        ([p0[0].min(p1[0]), p0[1].min(p1[1]), p0[2].min(p1[2])], [p0[0].max(p1[0]), p0[1].max(p1[1]), p0[2].max(p1[2])])
    }
    solo(em, "WorldSpaceAABB", fnat(|_, a, o| { let (p, q) = aabb_mundo(&s0(a)); o.push(nva(p)); o.push(nva(q)); Ok(()) }));
    solo(em, "NearestPoint", fnat(|_, a, o| {
        let (p, q) = aabb_mundo(&s0(a));
        match vec_de(&ar(a, 1)) { None => ok1(o, nv((p[0] + q[0]) / 2.0, (p[1] + q[1]) / 2.0, (p[2] + q[2]) / 2.0)), Some(v) => ok1(o, nv(v[0].max(p[0]).min(q[0]), v[1].max(p[1]).min(q[1]), v[2].max(p[2]).min(q[2]))) }
    }));
    solo(em, "GetFlexNum", fnat(|_, _, o| n(o, 0.0)));
    solo(em, "GetFlexName", fnat(|_, _, o| s(o, "")));
    solo(em, "GetFlexWeight", fnat(|_, _, o| n(o, 0.0)));
    solo(em, "SetFlexWeight", fnat(nada));
    solo(em, "SetFlexScale", fnat(nada));
    solo(em, "GetFlexScale", fnat(|_, _, o| n(o, 1.0)));
    for k in ["SetExpensiveShadow", "SetTransmitWithParent", "SetPreventTransmit", "SetNetworkKeyValue", "SetGroundEntity", "SetShouldPlayPickupSound", "AddToMotionController", "RemoveFromMotionController", "StartMotionController", "StopMotionController", "SetLagCompensated"] { solo(em, k, fnat(nada)); }
    solo(em, "GetShouldPlayPickupSound", fnat(|_, _, o| b(o, false)));
    solo(pm, "LagCompensation", fnat(nada));
    solo(pm, "Flashlight", fnat(|_, a, _| { let on = t(&ar(a, 1)); h(|h| h.linterna(on)); Ok(()) }));
    solo(pm, "FlashlightIsOn", fnat(|_, _, o| b(o, false)));
    solo(pm, "AllowFlashlight", fnat(nada));
    solo(pm, "CanUseFlashlight", fnat(|_, _, o| b(o, true)));
    solo(pm, "GetCrouchedWalkSpeed", fnat(|_, _, o| n(o, g(|g| g.agachado).unwrap_or(0.3))));
    solo(pm, "SetCrouchedWalkSpeed", fnat(|_, a, _| { let v = num(&ar(a, 1), 0.3); g(|g| g.agachado = Some(v)); Ok(()) }));
    solo(pm, "GetMaxSpeed", fnat(|_, _, o| n(o, g(|g| g.run).filter(|x| *x != 0.0).unwrap_or(400.0))));
    solo(pm, "SetMaxSpeed", fnat(nada));
    solo(pm, "GetObserverTarget", fnat(|_, _, o| ok1(o, null())));
    solo(pm, "GetObserverMode", fnat(|_, _, o| n(o, 0.0)));
    solo(pm, "IsPlayingTaunt", fnat(|_, _, o| b(o, false)));
    solo(pm, "IsConnected", fnat(|_, _, o| b(o, true)));
    solo(pm, "VoiceVolume", fnat(|_, _, o| n(o, 0.0)));
    def(pm, "SetAnimation", nada);
    for k in ["AnimRestartGesture", "AnimResetGestureSlot", "AnimSetGestureWeight", "ExitVehicle", "EnterVehicle", "DropObject", "PickupObject"] { solo(pm, k, fnat(nada)); }
    solo(em, "GetPassenger", fnat(|_, _, o| ok1(o, null())));
    solo(em, "GetDriver", fnat(|_, _, o| ok1(o, null())));
    solo(em, "GetThirdPersonMode", fnat(|_, _, o| b(o, !h(|h| h.jug().fp_veh))));
    solo(em, "SetThirdPersonMode", fnat(|_, a, _| { let v = t(&ar(a, 1)); h(|h| h.jug().fp_veh = !v); Ok(()) }));
    solo(em, "GetVehicleClass", fnat(|_, a, o| { let c = ce(&s0(a), |x| x.clase.clone()).unwrap_or_default(); s(o, &c) }));
    solo(pm, "GetPData", fnat(|_, a, o| { let k = js_str(&ar(a, 1)); match h(|h| h.dato(&format!("pdata:{}", k))) { Some(v) => s(o, &v), None => ok1(o, ar(a, 2)) } }));
    solo(pm, "SetPData", fnat(|e, a, o| { let k = js_str(&ar(a, 1)); let v = ar(a, 2); let sv = match &v { Valor::Num(_) | Valor::Bool(_) => js_str(&v), _ => e.tostring(&v)?.texto().into_owned() }; h(|h| h.poner_dato(&format!("pdata:{}", k), Some(&sv))); b(o, true) }));
    solo(pm, "RemovePData", fnat(|_, a, o| { let k = js_str(&ar(a, 1)); h(|h| h.poner_dato(&format!("pdata:{}", k), None)); b(o, true) }));
    solo(pm, "ScreenFade", fnat(nada));
    // ---- NPC ----
    let nm = &npc_m;
    def(nm, "SetCondition", |_, a, _| { let c = i32_de(mas(&ar(a, 1))); ce(&s0(a), |x| { if c == 67 || c == 68 { x.congelado = c == 67; } if !x.conds.contains(&c) { x.conds.push(c); } if c == 68 { x.conds.retain(|y| *y != 67); } else if c == 67 { x.conds.retain(|y| *y != 68); } }); Ok(()) });
    def(nm, "HasCondition", |_, a, o| { let c = i32_de(mas(&ar(a, 1))); b(o, ce(&s0(a), |x| x.conds.contains(&c)).unwrap_or(false)) });
    def(nm, "ClearCondition", |_, a, _| { let c = i32_de(mas(&ar(a, 1))); ce(&s0(a), |x| { x.conds.retain(|y| *y != c); if c == 67 { x.congelado = false; } }); Ok(()) });
    def(nm, "SetNPCState", |_, a, _| { let c = i32_de(mas(&ar(a, 1))); ce(&s0(a), |x| x.npc_estado = Some(c)); Ok(()) });
    def(nm, "GetNPCState", |_, a, o| n(o, ce(&s0(a), |x| x.npc_estado.unwrap_or(1)).unwrap_or(1) as f64));
    solo(nm, "SetSchedule", fnat(nada));
    solo(nm, "GetEnemy", fnat(|_, a, o| { let v = ce(&s0(a), |x| x.enemigo.clone()).flatten(); ok1(o, opt_null(&v)) }));
    solo(nm, "SetEnemy", fnat(|_, a, _| { let v = ar(a, 1); ce(&s0(a), |x| x.enemigo = if es_ent(&v) { Some(v) } else { None }); Ok(()) }));
    solo(nm, "ClearEnemyMemory", fnat(|_, a, _| { ce(&s0(a), |x| x.enemigo = None); Ok(()) }));
    let _ = color;
}
