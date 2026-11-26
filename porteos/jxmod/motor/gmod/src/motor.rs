//! Los ayudantes del motor (gmod_api.js, «ayudantes del motor»): hooks, dónde está cada entidad, crear y borrar su
//! cuerpo, aparecer y quitar, daño, trazas, balas, entradas (Fire/Input), las teclas de GMod y las armas de los addons.

use crate::anfitrion::*;
use crate::mates::*;
use crate::nucleo::*;
use crate::valores::buscar_en_clase_v;
use jxlua::{Estado, Tabla, TablaRef, Valor};
use std::rc::Rc;

pub(crate) const SC: &[Lado] = &[Lado::S, Lado::C];
pub(crate) const S: &[Lado] = &[Lado::S];
pub(crate) const C: &[Lado] = &[Lado::C];

// ---------------- hooks ----------------
/// gmaHook: corre un evento en los lados pedidos; el primero que devuelve algo corta
pub(crate) fn hook(e: &mut Estado, ev: &str, ctx: &[Lado], args: &[Valor]) -> Vec<Valor> {
    let ids: Vec<Valor> = match g(|g| g.hooks.get(ev).map(|h| h.iter().map(|x| x.0.clone()).collect::<Vec<_>>())) { Some(v) if !v.is_empty() => v, _ => return Vec::new() };
    for id in ids {
        let obj = matches!(id, Valor::Tabla(_) | Valor::Udata(_));
        if obj && es_ent(&id) && !ent_valida(&id) {
            g(|g| if let Some(hs) = g.hooks.get_mut(ev) { hs.retain(|x| !x.0.crudo_igual(&id)); });
            continue;
        }
        for &c in ctx {
            let Some((f, a)) = g(|g| g.hooks.get(ev).and_then(|hs| hs.iter().find(|x| x.0.crudo_igual(&id))).and_then(|x| { let h = &x.1; let f = if c == Lado::S { h.s.clone() } else { h.c.clone() }; f.map(|f| (f, h.a.clone())) })) else { continue };
            let (ha0, he0) = g(|g| (std::mem::replace(&mut g.hook_addon, a), std::mem::replace(&mut g.hook_ev, Some(ev.to_string()))));
            g(|g| g.ult_err = false);
            let r = if obj {
                let mut v = Vec::with_capacity(args.len() + 1);
                v.push(id.clone());
                v.extend_from_slice(args);
                llamar(e, &f, c, &v)
            } else { llamar(e, &f, c, args) };
            g(|g| { g.hook_addon = ha0; g.hook_ev = he0; });
            let fallo = g(|g| g.ult_err);
            let mut sacado = false;
            g(|g| {
                if let Some(hs) = g.hooks.get_mut(ev) {
                    if let Some(i) = hs.iter().position(|x| x.0.crudo_igual(&id)) {
                        let hk = &mut hs[i].1;
                        let n = if c == Lado::S { &mut hk.ns } else { &mut hk.nc };
                        if fallo { *n += 1; if *n > 300 { if c == Lado::S { hk.s = None; } else { hk.c = None; } sacado = true; if hk.s.is_none() && hk.c.is_none() { hs.remove(i); } } } else { *n = 0; }
                    }
                }
            });
            if sacado { gma_err(&format!("hook {} {} sacado: falla siempre", ev, if obj { "(entidad)".to_string() } else { js_str(&id) })); }
            if !r.is_empty() && !r[0].es_nil() { return r; }
        }
    }
    Vec::new()
}
pub(crate) fn hay_hook(ev: &str) -> bool { g(|g| g.hooks.has(ev)) }

// ---------------- dónde está cada cosa ----------------
pub(crate) fn cuerpo<R>(o: ObjId, f: impl FnOnce(&mut Cuerpo) -> R) -> Option<R> { h(|h| h.cuerpo(o).map(f)) }
/// gmaOrigen: el origen del modelo de un objeto
pub(crate) fn origen(o: ObjId) -> Option<V3> { cuerpo(o, |b| match b.c { Some(c) => b.pos.sub(b.q.rot(c)), None => b.pos }) }
/// gmaOrigenPon
pub(crate) fn origen_pon(o: ObjId, p: V3, q: Option<Quat>) { cuerpo(o, |b| { b.pos = p; if let Some(c) = b.c { b.pos = b.pos.add(q.unwrap_or(b.q).rot(c)); } b.cambios |= CUERPO_POS; }); }

/// gmaEntPos: los pies del jugador, el origen del modelo de un objeto o donde quedó
pub(crate) fn ent_pos(e: &Valor) -> V3 {
    let Some((tipo, o, pos)) = ce(e, |x| (x.tipo, x.o, x.pos)) else { return V3::default() };
    if tipo == TipoEnt::Jug {
        if es_jug(e) { return h(|h| { let j = h.jug(); j.pos.add(v3(0.0, -(j.medio + j.radio), 0.0)) }); }
        return V3::default();
    }
    if tipo == TipoEnt::Arma { if let Some((p, _)) = arma_en_mano(e) { return p; } }
    if let Some(o) = o { if let Some(p) = origen(o) { return p; } }
    pos
}
/// el arma que tiene en la mano el jugador va donde la pone el juego (el modelo de mundo en la mano: sus enganches —la
/// hoja del sable— salen de ahí)
fn arma_en_mano(e: &Valor) -> Option<(V3, Quat)> {
    if !g(|g| g.swep.as_ref().map(|w| mismo(w, e)).unwrap_or(false)) { return None; }
    h(|h| h.arma_mundo())
}
/// entQ
pub(crate) fn ent_q(e: &Valor) -> Quat {
    let Some((tipo, o, q)) = ce(e, |x| (x.tipo, x.o, x.q)) else { return Quat::default() };
    if tipo == TipoEnt::Jug { let yaw = if es_jug(e) { h(|h| h.jug().yaw) } else { 0.0 }; return Quat::axis(0.0, 1.0, 0.0, yaw); }
    if tipo == TipoEnt::Arma { if let Some((_, q)) = arma_en_mano(e) { return q; } }
    if let Some(o) = o { if let Some(q) = cuerpo(o, |b| b.q) { return q; } }
    q
}
/// gmaOjo: los ojos del jugador (en 3ª persona, los del personaje)
pub(crate) fn ojo() -> V3 { h(|h| { let j = h.jug().clone(); let c = h.cam().pos; if j.tercera && j.vehiculo.is_none() { j.ojo_pos.unwrap_or(c) } else { c } }) }
/// gmaApunta: hacia dónde apunta (en 3ª persona, a lo que está en la mira desde los ojos del personaje)
pub(crate) fn apunta() -> V3 {
    let (j, c, f) = h(|h| { let j = h.jug().clone(); let cam = h.cam().clone(); (j, cam.pos, cam.fwd) });
    let Some(o) = j.ojo_pos.filter(|_| j.tercera && j.vehiculo.is_none()) else { return f };
    let t0 = o.sub(c).dot(f).max(0.0);
    let hit = h(|h| h.raycast(c.add(f.scale(t0)), f, 300.0, &[]));
    let q = c.add(f.scale(t0 + hit.map(|x| x.t).unwrap_or(300.0)));
    let d = q.sub(o);
    let l = d.len();
    let d = if l > 0.3 { d.scale(1.0 / l) } else { f };
    if d.dot(f) < 0.2 { f } else { d }
}

// ---------------- cuerpos de las entidades ----------------
/// gmaPrefabDeModelo
fn prefab_de_modelo(ruta: &str) -> Option<String> {
    if ruta.is_empty() { return None; }
    let mut r = ruta.to_lowercase().replace('\\', "/");
    if !r.starts_with("models/") { r = format!("models/{}", r); }
    if r.starts_with("models/jxmod/") && !r["models/jxmod/".len()..].contains('/') && r.ends_with(".mdl") { return None; }
    let en_addon = archivo(&r).is_some();
    let p = h(|h| h.prefab(&r, en_addon))?;
    if !en_addon && p.sustituto { g(|g| { if g.modelos_faltan.len() > 500 { g.modelos_faltan.clear(); } g.modelos_faltan.insert(r.clone()); }); }
    Some(p.nombre)
}
/// gmaRehacer: el cuerpo de la entidad, de nuevo, con su modelo
pub(crate) fn rehacer(e: &Valor) {
    let Some((cs, o, modelo, pos, q, mov)) = ce(e, |x| (x.cs, x.o, x.modelo.clone(), x.pos, x.q, x.mov)) else { return };
    if cs {
        if let Some(o) = o { g(|g| g.ent_por_obj.remove(&o)); h(|h| h.borrar_objeto(o)); ce(e, |x| x.o = None); }
        return;
    }
    let pf = prefab_de_modelo(&modelo);
    let (pos, q, vel) = match o.and_then(|o| cuerpo(o, |b| (b.q, b.vel))) {
        Some((bq, bv)) => (origen(o.unwrap()).unwrap_or(pos), bq, Some(bv)),
        None => (pos, q, None),
    };
    if let Some(o) = o { g(|g| g.ent_por_obj.remove(&o)); h(|h| h.borrar_objeto(o)); ce(e, |x| x.o = None); }
    let Some(pf) = pf else { return };
    let Some(no) = h(|h| h.crear_objeto(&pf, pos, q)) else { return };
    ce(e, |x| { x.o = Some(no); x.o_modelo = Some(modelo.clone()); x.fijo_ns = false; });
    g(|g| { g.ent_por_obj.insert(no, e.clone()); g.obj_prefab.insert(no, pf.clone()); });
    cuerpo(no, |b| { if mov == Some(0.0) { b.congelado = true; } if let Some(v) = vel { b.vel = v; } });
    solidez(e);
}
pub(crate) const GRUPO_SIN_JUG: [i32; 11] = [1, 2, 3, 10, 11, 12, 14, 15, 16, 17, 20];
pub(crate) const GRUPO_SIN_FIS: [i32; 6] = [1, 2, 10, 12, 14, 20];
/// gmaSolidoTipo
pub(crate) fn solido_tipo(e: &Valor) -> i32 {
    let Some((ns, st, clase)) = ce(e, |x| (x.no_solido, x.solido_t, x.clase.clone())) else { return 0 };
    if ns { return 0; }
    if let Some(t) = st { return t; }
    if clase_tabla(&clase, Lado::S).is_some() { 0 } else { 6 }
}
/// gmaSolidez: con qué choca su cuerpo
pub(crate) fn solidez(e: &Valor) {
    let Some((o, tipo, padre, soldado, gc, dueno, fijo, mov)) = ce(e, |x| (x.o, x.tipo, x.padre.is_some(), x.soldado_a.is_some(), x.grupo_col, x.dueno.clone(), x.fijo_ns, x.mov)) else { return };
    let Some(o) = o else { return };
    if tipo != TipoEnt::Ent { return; }
    if cuerpo(o, |b| b.veh) != Some(false) { return; }
    let nada = solido_tipo(e) == 0 || padre || soldado;
    let del_jug = dueno.map(|d| es_jug(&d)).unwrap_or(false);
    let mut fijo2 = fijo;
    cuerpo(o, |b| {
        b.no_jug = nada || GRUPO_SIN_JUG.contains(&gc) || del_jug;
        b.no_phys = nada || GRUPO_SIN_FIS.contains(&gc);
        b.no_ray = nada;
        b.cambios |= CUERPO_OTROS;
        if nada { if !fijo { fijo2 = true; b.congelado = true; b.vel = V3::default(); b.ang = V3::default(); b.cambios |= CUERPO_CONGELADO | CUERPO_VEL | CUERPO_ANG; } }
        else if fijo { fijo2 = false; b.congelado = mov == Some(0.0); b.cambios |= CUERPO_CONGELADO; if !b.congelado { b.despertar(); } }
    });
    ce(e, |x| x.fijo_ns = fijo2);
}

// ---------------- pegadas (SetParent, soldaduras) ----------------
pub(crate) fn padre_de(e: &Valor) -> Option<Valor> { ce(e, |x| x.padre.clone().or_else(|| x.soldado_a.clone())).flatten() }
/// gmaPadre
pub(crate) fn poner_padre(e: &Valor, p: Option<Valor>, soldar: bool) {
    let mut x = p.clone();
    let mut n = 0;
    while let Some(v) = x { if mismo(&v, e) { return; } if n >= 32 { break; } x = padre_de(&v); n += 1; }
    ce(e, |x| if soldar { x.soldado_a = p.clone() } else { x.padre = p.clone() });
    if padre_de(e).is_some() {
        padre_fijar(e, None);
        g(|g| if !g.hijos.iter().any(|x| mismo(x, e)) { g.hijos.push(e.clone()) });
    } else { g(|g| g.hijos.retain(|x| !mismo(x, e))); }
    g(|g| g.hijos_orden = None);
    solidez(e);
}
/// gmaPadreFijar: dónde está respecto del padre ('pos', 'ang' o los dos)
pub(crate) fn padre_fijar(e: &Valor, que: Option<&str>) {
    let Some(p) = padre_de(e) else { return };
    let qi = ent_q(&p).conj();
    let (off, pq) = ce(e, |x| (x.padre_off, x.padre_q)).unwrap_or((None, None));
    let nuevo_off = if que != Some("ang") || off.is_none() { Some(qi.rot(ent_pos(e).sub(ent_pos(&p)))) } else { off };
    let nuevo_q = if que != Some("pos") || pq.is_none() { Some(qi.mul(ent_q(e))) } else { pq };
    ce(e, |x| { x.padre_off = nuevo_off; x.padre_q = nuevo_q; });
}
/// gmaHijoMover
pub(crate) fn hijo_mover(e: &Valor) {
    let Some(p) = padre_de(e) else { return };
    let Some((Some(off), pq, o)) = ce(e, |x| (x.padre_off, x.padre_q, x.o)) else { return };
    let qp = ent_q(&p);
    let w = ent_pos(&p).add(qp.rot(off));
    let q = qp.mul(pq.unwrap_or_default());
    if let Some(o) = o.filter(|o| cuerpo(*o, |_| ()).is_some()) {
        cuerpo(o, |b| { b.q = q; b.vel = V3::default(); b.ang = V3::default(); b.cambios |= CUERPO_Q | CUERPO_VEL | CUERPO_ANG; });
        origen_pon(o, w, Some(q));
    } else { ce(e, |x| { x.pos = w; x.q = q; }); }
}
/// gmaSoldar (constraint.Weld y Axis)
pub(crate) fn soldar(a: &Valor, b: &Valor) {
    let (Some(ta), Some(tb)) = (ent_tipo(a), ent_tipo(b)) else { return };
    if mismo(a, b) || ta == TipoEnt::Jug || tb == TipoEnt::Jug { return; }
    if ta == TipoEnt::Mundo || tb == TipoEnt::Mundo {
        let e = if ta == TipoEnt::Mundo { b } else { a };
        if let Some((Some(o), TipoEnt::Ent)) = ce(e, |x| (x.o, x.tipo)) { ce(e, |x| x.mov = Some(0.0)); cuerpo(o, |c| { c.congelado = true; c.vel = V3::default(); c.cambios |= CUERPO_CONGELADO | CUERPO_VEL; }); }
        return;
    }
    let peso = |x: &Valor| {
        let ini = g(|g| g.iniciando.as_ref().map(|i| mismo(i, x)).unwrap_or(false));
        let (o, clase) = ce(x, |e| (e.o, e.clase.clone())).unwrap();
        (if ini { 1e12 } else { 0.0 }) + (if o.is_none() && clase_tabla(&clase, Lado::S).is_some() { 1e9 } else { 0.0 }) + o.and_then(|o| cuerpo(o, |c| c.masa)).unwrap_or(0.0)
    };
    let (mut padre, mut hija) = (a.clone(), b.clone());
    if peso(b) > peso(a) { padre = b.clone(); hija = a.clone(); }
    if padre_de(&hija).is_some() { if padre_de(&padre).is_some() { return; } std::mem::swap(&mut padre, &mut hija); }
    poner_padre(&hija, Some(padre), true);
}
pub(crate) fn desoldar(e: &Valor) -> bool {
    if !es_ent(e) { return false; }
    let mut hubo = false;
    if ce(e, |x| x.soldado_a.is_some()).unwrap_or(false) { poner_padre(e, None, true); hubo = true; }
    let hijos = g(|g| g.hijos.clone());
    for x in hijos { if ce(&x, |y| y.soldado_a.as_ref().map(|s| mismo(s, e)).unwrap_or(false)).unwrap_or(false) { poner_padre(&x, None, true); hubo = true; } }
    hubo
}
/// gmaHijosPaso: las pegadas van con su padre
pub(crate) fn hijos_paso(e: &mut Estado) {
    if g(|g| g.hijos.is_empty()) { return; }
    let n = g(|g| g.hijos.len());
    if g(|g| g.hijos_orden.as_ref().map(|o| o.len() != n).unwrap_or(true)) {
        let hs = g(|g| g.hijos.clone());
        let mut con: Vec<(usize, Valor)> = hs.into_iter().map(|x| { let mut n = 0; let mut p = padre_de(&x); while let Some(q) = p { n += 1; if n >= 32 { break; } p = padre_de(&q); } (n, x) }).collect();
        con.sort_by_key(|x| x.0);
        g(|g| g.hijos_orden = Some(con.into_iter().map(|x| x.1).collect()));
    }
    let orden = g(|g| g.hijos_orden.clone().unwrap_or_default());
    for x in orden {
        if !g(|g| g.hijos.iter().any(|y| mismo(y, &x))) { continue; }
        let p = padre_de(&x);
        let vivo = ce(&x, |y| y.vivo).unwrap_or(false);
        if !vivo || p.is_none() { g(|g| { g.hijos.retain(|y| !mismo(y, &x)); g.hijos_orden = None; }); continue; }
        let p = p.unwrap();
        let (pv, po) = ce(&p, |y| (y.vivo, y.o)).unwrap_or((false, None));
        if !pv || po.map(|o| cuerpo(o, |_| ()).is_none()).unwrap_or(false) { g(|g| { g.hijos.retain(|y| !mismo(y, &x)); g.hijos_orden = None; }); quitar(e, &x); continue; }
        hijo_mover(&x);
    }
}

// ---------------- aparecer y quitar ----------------
/// gmaPreparar: SetupDataTables una vez
pub(crate) fn preparar(e: &mut Estado, ent: &Valor) {
    let Some((listo, vivo, clase)) = ce(ent, |x| (x.dt_listo, x.vivo, x.clase.clone())) else { return };
    if listo || !vivo { return; }
    ce(ent, |x| x.dt_listo = true);
    if clase_tabla(&clase, Lado::S).is_some() { metodo(e, ent, "SetupDataTables", Lado::S, &[]); }
}
/// gmaSpawn
pub(crate) fn spawn(e: &mut Estado, ent: &Valor) {
    let Some((creado, vivo)) = ce(ent, |x| (x.creado, x.vivo)) else { return };
    if creado || !vivo { return; }
    ce(ent, |x| x.creado = true);
    preparar(e, ent);
    let nb = crate::modelos::nb_antes(ent);
    let ini0 = g(|g| std::mem::replace(&mut g.iniciando, Some(ent.clone())));
    let solo_c = ce(ent, |x| x.solo_c).unwrap_or(false);
    metodo(e, ent, "Initialize", if solo_c { Lado::C } else { Lado::S }, &[]);
    g(|g| g.iniciando = ini0);
    let Some((vivo, o, om, modelo, clase)) = ce(ent, |x| (x.vivo, x.o, x.o_modelo.clone(), x.modelo.clone(), x.clase.clone())) else { return };
    if !vivo { return; }
    if o.is_none() || om.as_deref() != Some(modelo.as_str()) { rehacer(ent); }
    if nb { crate::modelos::nb_despues(e, ent); if !ce(ent, |x| x.vivo).unwrap_or(false) { return; } }
    let separado = g(|g| g.clases.get(&clase).map(|c| match (&c.c, &c.s) { (Some(cc), Some(ss)) => !Rc::ptr_eq(cc, ss), (Some(_), None) => true, _ => false }).unwrap_or(false));
    if !solo_c && separado { metodo(e, ent, "Initialize", Lado::C, &[]); }
    if !solo_c { hook(e, "OnEntityCreated", S, &[ent.clone()]); }
    hook(e, "OnEntityCreated", C, &[ent.clone()]);
}
/// gmaQuitar
pub(crate) fn quitar(e: &mut Estado, ent: &Valor) {
    let Some((vivo, tipo, clase)) = ce(ent, |x| (x.vivo, x.tipo, x.clase.clone())) else { return };
    if !vivo || tipo == TipoEnt::Jug { return; }
    ce(ent, |x| x.vivo = false);
    metodo(e, ent, "OnRemove", Lado::S, &[]);
    let c_rem = g(|g| g.clases.get(&clase).and_then(|c| c.c.clone())).map(|c| !tget(&c, "OnRemove").es_nil()).unwrap_or(false);
    if c_rem { metodo(e, ent, "OnRemove", Lado::C, &[]); }
    hook(e, "EntityRemoved", S, &[ent.clone()]);
    if let Some(o) = ce(ent, |x| x.o.take()).flatten() { g(|g| g.ent_por_obj.remove(&o)); h(|h| h.borrar_objeto(o)); }
    if let Some(id) = ent_id(ent) { g(|g| g.ent_delete(id)); }
}

// ---------------- sonidos ----------------
/// gmaSonar: un sonido por su ruta o su guion (sound.Add)
pub(crate) fn sonar(e: &mut Estado, s: &str, pos: Option<V3>, vol: Valor, tono: Valor) {
    if s.is_empty() { return; }
    let mut s = s.to_string();
    let (mut vol, mut tono) = (vol, tono);
    if let Some((w, v, p)) = g(|g| g.guiones.get(&s.to_lowercase()).cloned()) {
        let r = e.azar();
        s = w.get((r * w.len() as f64) as usize).cloned().unwrap_or_default();
        if vol.es_nil() { vol = v; }
        if tono.es_nil() { tono = p; }
    }
    if s.is_empty() { return; }
    let n = s.to_lowercase().replace('\\', "/");
    let vol = jmax(0.05, jmin(2.0, if vol.es_nil() { 1.0 } else { mas(&vol) }));
    let tono = if js_t(&tono) { jmax(0.3, jmin(2.5, mas(&tono) / 100.0)) } else { 1.0 };
    h(|h| h.sonido(&n, pos, vol, tono));
}

// ---------------- daño ----------------
/// un CTakeDamageInfo
#[derive(Clone)]
pub(crate) struct DmgInfo {
    pub dan: Valor,
    pub at: Valor,
    pub inf: Valor,
    pub tipo: Valor,
    pub pos: Valor,
    pub fuerza: Valor,
}
pub(crate) fn dmg_info(dan: f64, at: Option<Valor>, inf: Option<Valor>, pos: Option<Valor>) -> Valor {
    let mt = g(|g| g.mt.dmg.clone());
    let d = DmgInfo { dan: Valor::Num(dan), at: at.filter(|x| !x.es_nil()).unwrap_or_else(null), inf: inf.filter(|x| !x.es_nil()).unwrap_or_else(null), tipo: Valor::Num(0.0), pos: pos.unwrap_or(Valor::Nil), fuerza: Valor::Nil };
    Valor::Udata(jxlua::Udata::nueva(d, mt))
}
pub(crate) fn di<R>(v: &Valor, f: impl FnOnce(&mut DmgInfo) -> R) -> Option<R> { match v { Valor::Udata(u) => u.con_mut(f), _ => None } }
/// gmaDanar
pub(crate) fn danar(e: &mut Estado, ent: &Valor, dan: f64, at: Valor, inf: Valor, dinfo: Option<Valor>) {
    if !es_ent(ent) { return; }
    let d = dinfo.unwrap_or_else(|| dmg_info(dan, Some(at), Some(inf), None));
    let r = hook(e, "EntityTakeDamage", S, &[ent.clone(), d.clone()]);
    if matches!(r.first(), Some(Valor::Bool(true))) { return; }
    let dn = di(&d, |x| x.dan.clone()).unwrap_or(Valor::Nil);
    if es_jug(ent) { h(|h| h.danar_jugador(mas(&dn))); return; }
    let (clase, o) = ce(ent, |x| (x.clase.clone(), x.o)).unwrap();
    if clase_tabla(&clase, Lado::S).is_some() { metodo(e, ent, "OnTakeDamage", Lado::S, &[d]); return; }
    if let Some(o) = o { if let Some(p) = cuerpo(o, |b| b.pos) { h(|h| h.danar_objeto(o, mas(&dn), p, v3(0.0, 1.0, 0.0))); } }
}
/// gmaEmpujarDano: la fuerza del daño mueve lo que tiene física
pub(crate) fn empujar_dano(ent: &Valor, d: &Valor, p: Option<[f64; 3]>) {
    let Some(o) = ce(ent, |x| x.o).flatten() else { return };
    let Some(f) = di(d, |x| vec_de(&x.fuerza)).flatten() else { return };
    let Some((din, masa, pos)) = cuerpo(o, |b| (b.dinamico, b.masa, b.pos)) else { return };
    if !din { return; }
    let mut imp = vgr(f).scale(GS);
    let m = if masa.is_nan() || masa == 0.0 { 20.0 } else { masa }.max(1.0);
    let l = imp.len() / m;
    if !(l > 1e-4) { return; }
    if l > 12.0 { imp = imp.scale(12.0 / l); }
    let rel = p.map(|p| a_juego(p).sub(pos)).unwrap_or_default();
    cuerpo(o, |b| { b.despertar(); aplicar_vel(b, imp, rel); });
}
/// applyVel de la física del juego: un impulso en un punto (acá: a la velocidad lineal, dividido por la masa)
pub(crate) fn aplicar_vel(b: &mut Cuerpo, imp: V3, _rel: V3) { let m = if b.masa > 0.0 { b.masa } else { 1.0 }; b.vel = b.vel.add(imp.scale(1.0 / m)); b.cambios |= CUERPO_VEL; }
/// gmaMovTipoJug
pub(crate) fn mov_tipo_jug(tm: f64) {
    if !tm.is_finite() { return; }
    let jug = g(|g| g.jug.clone());
    let nl = ce(&jug, |x| x.noclip_lua).unwrap_or(false);
    if tm == 8.0 { if !h(|h| h.jug().noclip) { h(|h| h.jug().noclip = true); ce(&jug, |x| x.noclip_lua = true); } }
    else if nl { h(|h| h.jug().noclip = false); ce(&jug, |x| x.noclip_lua = false); }
    ce(&jug, |x| x.mov = if tm == 2.0 { None } else { Some(tm) });
}
/// gmaVelJugador
pub(crate) fn vel_jugador(v: V3, poner: bool) {
    h(|h| {
        let j = h.jug();
        j.vel = if poner { v } else { j.vel.add(v) };
        if v.y > 0.3 && j.vel.y > 0.3 { j.suelo = false; j.tiempo_suelo = 0.0; j.salto_t = j.reloj; }
    });
}
/// gmaUsar
pub(crate) fn usar(e: &mut Estado, ent: &Valor, act: &Valor) {
    if !es_ent(ent) { return; }
    let p = if es_ent(act) { act.clone() } else { g(|g| g.jug.clone()) };
    let r = hook(e, "PlayerUse", S, &[p.clone(), ent.clone()]);
    if matches!(r.first(), Some(Valor::Bool(false))) { return; }
    metodo(e, ent, "Use", Lado::S, &[p.clone(), p, Valor::Num(1.0), Valor::Num(1.0)]);
}

// ---------------- trazas ----------------
/// la entidad de un objeto del juego (entDeObj)
pub(crate) fn ent_de_obj(o: ObjId) -> Valor {
    if let Some(e) = g(|g| g.ent_por_obj.get(&o).cloned()) { return e; }
    let e = nueva_ent("prop_physics", TipoEnt::Ent);
    ce(&e, |x| { x.o = Some(o); x.modelo = "models/error.mdl".into(); });
    g(|g| g.ent_por_obj.insert(o, e.clone()));
    e
}
/// gmaTraza: una traza como la de GMod (la tabla de resultado)
pub(crate) fn traza(o: V3, d: V3, max: f64, ignorar: &[ObjId], pre: Option<Option<Golpe>>) -> Valor {
    let hit = match pre { Some(x) => x, None => h(|h| h.raycast(o, d, max, ignorar)) };
    let fin = match &hit { Some(x) => o.add(d.scale(x.t)), None => o.add(d.scale(max)) };
    let ent = match &hit { Some(x) => match x.obj { Some(ob) => ent_de_obj(ob), None => g(|g| g.mundo.clone()) }, None => null() };
    let tip = ent_tipo(&ent);
    let t = Tabla::nueva_ref();
    {
        let mut b = t.borrow_mut();
        b.set_str("Hit", Valor::Bool(hit.is_some()));
        b.set_str("HitPos", vv(fin));
        b.set_str("HitNormal", vvd(match &hit { Some(x) => x.n, None => d.scale(-1.0) }));
        b.set_str("Normal", vvd(d));
        b.set_str("StartPos", vv(o));
        b.set_str("Fraction", Valor::Num(match &hit { Some(x) => x.t / max, None => 1.0 }));
        b.set_str("Entity", ent);
        let cuerpo_h = hit.as_ref().map(|x| x.obj.is_some() || x.persona.is_some()).unwrap_or(false);
        b.set_str("HitWorld", Valor::Bool(hit.is_some() && !cuerpo_h));
        b.set_str("HitNonWorld", Valor::Bool(hit.is_some() && cuerpo_h));
        b.set_str("HitSky", Valor::Bool(false));
        b.set_str("HitNoDraw", Valor::Bool(false));
        b.set_str("MatType", Valor::Num(if matches!(tip, Some(TipoEnt::Npc) | Some(TipoEnt::Jug)) { 70.0 } else { 67.0 }));
        b.set_str("PhysicsBone", Valor::Num(0.0));
        b.set_str("HitBox", Valor::Num(0.0));
        b.set_str("HitGroup", Valor::Num(0.0));
        b.set_str("SurfaceProps", Valor::Num(0.0));
        b.set_str("StartSolid", Valor::Bool(false));
        b.set_str("AllSolid", Valor::Bool(false));
        b.set_str("FractionLeftSolid", Valor::Num(0.0));
        b.set_str("HitTexture", cad("**studio**"));
        b.set_str("Contents", Valor::Num(if hit.is_some() { 1.0 } else { 0.0 }));
    }
    Valor::Tabla(t)
}
/// gmaIgnorar: el filtro de una traza → los cuerpos a ignorar
pub(crate) fn ignorar(f: &Valor) -> Vec<ObjId> {
    let mut s = Vec::new();
    let mut add = |x: &Valor| if let Some(Some(o)) = ce(x, |e| e.o) { if !s.contains(&o) { s.push(o); } };
    match f { Valor::Tabla(t) => { for (_, v) in t.borrow().pares() { add(&v); } } x => add(x) }
    s
}

// ---------------- balas ----------------
fn municion(n: &str) -> Option<f64> {
    Some(match n { "pistol" => 12.0, "smg1" => 12.0, "ar2" => 11.0, "buckshot" => 9.0, "357" => 40.0, "xbowbolt" => 100.0, "sniperround" => 50.0, "sniperpenetratedround" => 50.0, "airboatgun" => 10.0, "alyxgun" => 8.0, "gaussenergy" => 15.0, _ => return None })
}
/// Entity:FireBullets (gmaBalas)
pub(crate) fn balas(e: &mut Estado, ent: &Valor, b: &Valor) {
    let Valor::Tabla(bt) = b else { return };
    if g(|g| g.balas_prof) >= 6 { return; }
    g(|g| g.balas_prof += 1);
    balas0(e, ent, bt);
    g(|g| g.balas_prof -= 1);
}
fn balas0(e: &mut Estado, ent: &Valor, b: &TablaRef) {
    let gt = |k: &str| tget(b, k);
    let n = (i32_de(mas(&gt("Num"))).max(0) as f64).max(1.0).min(40.0);
    let n = if n == 0.0 { 1.0 } else { n };
    let cam = h(|h| h.cam().clone());
    let src = vec_de(&gt("Src")).map(a_juego).unwrap_or(cam.pos);
    let dir0 = vec_de(&gt("Dir")).map(|d| dg(d).norm()).unwrap_or(cam.fwd);
    let sp = vec_de(&gt("Spread")).unwrap_or([0.0; 3]);
    let cb = gt("Callback");
    let dd = mas(&gt("Distance"));
    let dist = (if dd == 0.0 || dd.is_nan() { 56756.0 } else { dd } * GS).min(400.0);
    let ff = mas(&gt("Force"));
    let fuerza = if ff == 0.0 || ff.is_nan() { 1.0 } else { ff };
    let mut dan = mas(&gt("Damage"));
    if !(dan > 0.0) { let am = gt("AmmoType"); let k = if t(&am) { js_str(&am).to_lowercase() } else { String::new() }; dan = municion(&k).unwrap_or(10.0); }
    let tr0 = gt("Tracer");
    let trac = if tr0.es_nil() { 1.0 } else { let x = mas(&tr0); if x.is_nan() { 0.0 } else { x } };
    let tn = gt("TracerName");
    let tnom = if t(&tn) { js_str(&tn) } else { "Tracer".to_string() };
    let at = if es_ent(&gt("Attacker")) { gt("Attacker") } else { ent.clone() };
    let tipo = ent_tipo(ent);
    let swep = g(|g| g.swep.clone()).filter(|w| ce(w, |x| x.vivo).unwrap_or(false));
    let wep = if tipo == Some(TipoEnt::Arma) { Some(ent.clone()) } else if es_jug(ent) { swep } else { None };
    let inf = if es_ent(&gt("Inflictor")) { gt("Inflictor") } else { wep.clone().unwrap_or_else(|| ent.clone()) };
    let mut ign = ignorar(&gt("IgnoreEntity"));
    if es_jug(ent) { if let Some(v) = h(|h| h.jug().vehiculo) { ign.push(v); } }
    if let Some(Some(o)) = ce(ent, |x| x.o) { ign.push(o); }
    let der = dir0.cross(if dir0.y.abs() > 0.99 { v3(1.0, 0.0, 0.0) } else { v3(0.0, 1.0, 0.0) }).norm();
    let arr = der.cross(dir0).norm();
    let ctx = g(|g| g.ctx);
    for _ in 0..(n as usize) {
        let x = e.azar() - 0.5 + (e.azar() - 0.5);
        let y = e.azar() - 0.5 + (e.azar() - 0.5);
        let d = dir0.add(der.scale(x * sp[0]).add(arr.scale(y * sp[1]))).norm();
        let hit = h(|h| h.raycast(src, d, dist, &ign));
        let fin = match &hit { Some(x) => x.p, None => src.add(d.scale(dist)) };
        let nb = g(|g| { g.n_bala += 1; g.n_bala });
        if trac > 0.0 && (nb as f64) % trac == 0.0 { trazadora(e, &tnom, src, fin, wep.clone().unwrap_or_else(|| ent.clone())); }
        let tr = traza(src, d, dist, &[], Some(hit.clone()));
        let dinfo = dmg_info(dan, Some(at.clone()), Some(inf.clone()), Some(vv(fin)));
        di(&dinfo, |x| { x.tipo = Valor::Num(2.0); x.fuerza = vvd(d.scale(dan * fuerza)); });
        let (mut ef, mut da) = (true, true);
        if matches!(cb, Valor::Func(_)) {
            let r = llamar(e, &cb, ctx, &[at.clone(), tr.clone(), dinfo.clone()]);
            if let Some(Valor::Tabla(o)) = r.first() { if matches!(tget(o, "effects"), Valor::Bool(false)) { ef = false; } if matches!(tget(o, "damage"), Valor::Bool(false)) { da = false; } }
        }
        let Some(hit) = hit else { continue };
        if ef {
            let r = match &wep { Some(w) => metodo(e, w, "DoImpactEffect", g(|g| g.ctx), &[tr.clone(), Valor::Num(2.0)]), None => Vec::new() };
            if !matches!(r.first(), Some(Valor::Bool(true))) { h(|h| h.efecto_impacto(hit.p, hit.n, hit.persona.is_some())); }
        }
        if da { dano_bala(e, &hit, d, &dinfo, fuerza); }
    }
}
/// gmaTrazadora
pub(crate) fn trazadora(e: &mut Estado, n: &str, a: V3, b: V3, ent: Valor) {
    let d = Tabla::nueva_ref();
    {
        let mut x = d.borrow_mut();
        x.set_str("Start", vv(a)); x.set_str("Origin", vv(b)); x.set_str("Entity", ent); x.set_str("Attachment", Valor::Num(1.0));
        x.set_str("Scale", Valor::Num(5000.0)); x.set_str("Flags", Valor::Num(0.0)); x.set_str("Normal", vvd(b.sub(a).norm()));
    }
    efecto(e, n, Some(d));
}
/// gmaDanoBala
fn dano_bala(e: &mut Estado, hit: &Golpe, d: V3, dinfo: &Valor, fuerza: f64) {
    let Some(o) = hit.obj else {
        if let Some(p) = hit.persona { let dn = di(dinfo, |x| mas(&x.dan)).unwrap_or(0.0); h(|h| h.danar_persona(p, dn, hit.p, d)); }
        return;
    };
    let dn = di(dinfo, |x| mas(&x.dan)).unwrap_or(0.0);
    if let Some((din, masa, pos)) = cuerpo(o, |b| { b.despertar(); (b.dinamico, b.masa, b.pos) }) {
        if din { let k = (dn * 0.6 * fuerza.max(0.25).min(4.0) / (masa * 0.05).max(1.0)).min(8.0); cuerpo(o, |b| aplicar_vel(b, d.scale(k), hit.p.sub(pos))); }
    }
    let ent = g(|g| g.ent_por_obj.get(&o).cloned());
    if let Some(ent) = ent {
        let clase = ce(&ent, |x| x.clase.clone()).unwrap_or_default();
        if clase_tabla(&clase, Lado::S).is_some() && !g(|g| g.danando) {
            g(|g| g.danando = true);
            let (at, inf) = di(dinfo, |x| (x.at.clone(), x.inf.clone())).unwrap();
            danar(e, &ent, dn, at, inf, Some(dinfo.clone()));
            g(|g| g.danando = false);
            return;
        }
    }
    h(|h| h.danar_objeto(o, dn, hit.p, d));
}

// ---------------- entradas (Fire, Input) ----------------
/// gmaEntrada
pub(crate) fn entrada(e: &mut Estado, ent: &Valor, inp: &str, val: Valor) {
    let Some((vivo, clase)) = ce(ent, |x| (x.vivo, x.clase.clone())) else { return };
    if !vivo { return; }
    let i = inp.to_lowercase();
    let kv = |k: &str| ce(ent, |x| { let a = x.kv.get(&cad(k)).cloned(); a.filter(|v| !v.es_nil()).or_else(|| x.kv.get(&cad(&k.to_lowercase())).cloned()) }).flatten().unwrap_or(Valor::Nil);
    let p = ent_pos(ent);
    if i == "kill" || i == "killhierarchy" { quitar(e, ent); return; }
    if clase == "env_explosion" && i == "explode" {
        let mag = mas(&kv("iMagnitude"));
        let m = if mag.is_finite() { mag } else { 100.0 };
        let ro = mas(&kv("iRadiusOverride"));
        let r = (if ro == 0.0 || ro.is_nan() { m * 2.5 } else { ro }) * GS;
        if m > 0.0 { h(|h| h.explosion(p, r.max(0.5), m, false)); } else { h(|h| h.efecto_explosion(p)); sonar(e, "GrenadeExplode", Some(p), Valor::Num(1.2), Valor::Nil); }
        if i32_de(mas(&kv("spawnflags"))) & 2 == 0 { quitar(e, ent); }
        return;
    }
    if clase == "env_physexplosion" && i == "explode" {
        let mm = mas(&kv("magnitude"));
        let m = if mm == 0.0 || mm.is_nan() { 100.0 } else { mm };
        let rr = mas(&kv("radius"));
        let r = (if rr == 0.0 || rr.is_nan() { 128.0 } else { rr }) * GS;
        for o in h(|h| h.objetos()) {
            cuerpo(o, |b| { let d = b.pos.sub(p); let l = d.len(); if l < r && b.dinamico { b.despertar(); aplicar_vel(b, d.norm().scale(m * 0.05 * (1.0 - l / r)), V3::default()); } });
        }
        return;
    }
    if clase == "env_spark" && i.contains("spark") {
        for _ in 0..10 { let v = v3(e.azar() * 4.0 - 2.0, e.azar() * 3.0, e.azar() * 4.0 - 2.0); h(|h| h.particula(p, v, 0.4, 0.03, [1.0, 0.8, 0.3, 1.0], "chispa", None)); }
        return;
    }
    if clase == "env_shake" && i.contains("startshake") { let a = mas(&kv("amplitude")); let a = if a == 0.0 || a.is_nan() { 4.0 } else { a }; h(|h| h.sacudir((a / 16.0).min(1.0))); return; }
    if (clase == "point_hurt" || clase == "env_fire") && (i.contains("hurt") || i.contains("startfire") || i.contains("enable")) {
        let a = mas(&kv("DamageRadius"));
        let b2 = mas(&kv("firesize"));
        let r = (if a != 0.0 && !a.is_nan() { a } else if b2 != 0.0 && !b2.is_nan() { b2 } else { 64.0 }) * GS;
        let dn = mas(&kv("Damage"));
        let dn = if dn == 0.0 || dn.is_nan() { 10.0 } else { dn };
        if h(|h| h.jug().pos).sub(p).len() < r { h(|h| h.danar_jugador(dn)); }
        return;
    }
    if clase_tabla(&clase, Lado::S).is_some() { let j = g(|g| g.jug.clone()); metodo(e, ent, "AcceptInput", Lado::S, &[cad(inp), j.clone(), j, val]); }
}

// ---------------- efectos (util.Effect) ----------------
/// gmaEfecto: un efecto de Lua del addon o uno de los de Source (trazadoras, fogonazos, explosiones, chispas...)
pub(crate) fn efecto(e: &mut Estado, n: &str, d: Option<TablaRef>) {
    let gd = |k: &str| d.as_ref().map(|t| tget(t, k)).unwrap_or(Valor::Nil);
    let cam = h(|h| h.cam().pos);
    let o = vec_de(&gd("Origin")).map(a_juego).unwrap_or(cam);
    let nl = vec_de(&gd("Normal")).map(dg).unwrap_or(v3(0.0, 1.0, 0.0));
    let ln = n.to_lowercase();
    if g(|g| g.efectos.has(&ln)) { h(|h| h.efecto_lua(&ln)); return; }
    let ent = gd("Entity");
    let mia = es_ent(&ent) && (es_jug(&ent) || g(|g| g.swep.as_ref().map(|w| mismo(w, &ent)).unwrap_or(false)) || ce(&ent, |x| (x.tipo == TipoEnt::Arma && x.dueno.as_ref().map(es_jug).unwrap_or(false)) || x.tipo == TipoEnt::Vm).unwrap_or(false));
    if ln.contains("tracer") { if let Some(a) = vec_de(&gd("Start")).map(a_juego) { h(|h| h.efecto_traza(a, o)); } return; }
    if ln.contains("muzzle") { if mia { h(|h| h.efecto_fogonazo()); } else { h(|h| h.particula(o, V3::default(), 0.06, 0.12, [1.0, 0.8, 0.4, 1.0], "fuego", Some(0.0))); } return; }
    if ln.contains("shell") || ln.contains("eject") { return; }
    if ln.contains("explo") || ln.contains("megabomb") { h(|h| h.efecto_explosion(o)); sonar(e, "GrenadeExplode", Some(o), Valor::Num(1.2), Valor::Nil); }
    else if ["spark", "tesla", "cball", "stunstick", "manhack", "electric", "glassimpact", "metalspark"].iter().any(|x| ln.contains(x)) {
        for _ in 0..12 {
            let k = 2.0 + e.azar() * 3.0;
            let v = nl.scale(k).add(v3(e.azar() * 4.0 - 2.0, e.azar() * 3.0, e.azar() * 4.0 - 2.0));
            let vida = 0.35 + e.azar() * 0.3;
            h(|h| h.particula(o, v, vida, 0.03, [1.0, 0.8, 0.3, 1.0], "chispa", None));
        }
    }
    else if ln.contains("blood") { h(|h| h.efecto_impacto(o, nl, true)); }
    else if ln.contains("impact") { h(|h| h.efecto_impacto(o, nl, false)); }
    else if ln.contains("splash") || ln.contains("water") { for _ in 0..10 { let v = v3(e.azar() * 2.0 - 1.0, 2.0 + e.azar() * 3.0, e.azar() * 2.0 - 1.0); h(|h| h.particula(o, v, 0.8, 0.06, [0.7, 0.8, 1.0, 0.8], "gota", None)); } }
    else if ln.contains("smoke") || ln.contains("dust") || ln.contains("thumper") { for _ in 0..6 { let v = v3(e.azar() - 0.5, 0.6, e.azar() - 0.5); h(|h| h.particula(o, v, 2.0, 0.5, [0.6, 0.6, 0.6, 0.5], "humo", None)); } }
}

// ---------------- teclas ----------------
/// gmaTeclas: los bits IN_* que se aprietan en este cuadro
pub(crate) fn teclas() -> u32 {
    h(|h| {
        if h.jug().bloqueado { return 0; }
        let en = h.entrada().clone();
        let tiene = |c: &str| en.teclas.iter().any(|x| x == c) || en.teclas_mod.iter().any(|x| x == c);
        let mut k = 0u32;
        if en.disparo { k |= 1; }
        if en.disparo2 { k |= 2048; }
        if en.saltar || tiene("Space") { k |= 2; }
        if en.agachar || tiene("ControlLeft") { k |= 4; }
        if tiene("KeyW") || en.y > 0.3 { k |= 8; }
        if tiene("KeyS") || en.y < -0.3 { k |= 16; }
        if tiene("KeyA") || en.x < -0.3 { k |= 512; }
        if tiene("KeyD") || en.x > 0.3 { k |= 1024; }
        if tiene("KeyE") { k |= 32; }
        if tiene("KeyR") { k |= 8192; }
        if (en.correr && !en.correr_palanca) || tiene("ShiftLeft") || tiene("ShiftRight") { k |= 131072; }
        if tiene("AltLeft") { k |= 262144; }
        k | en.in_mod
    })
}
/// gmaTecla (Player:KeyDown): un efecto siempre activo no ve el ataque
pub(crate) fn tecla(e: &mut Estado, k: u32) -> bool { let m = if fantasma(e).is_some() { k & !(1 | 2048) } else { k }; teclas() & m != 0 }
/// GMA_KEYJS: el número de tecla de GMod de cada código del navegador (armado una vez)
pub(crate) fn keyjs() -> &'static [String] {
    static K: std::sync::OnceLock<Vec<String>> = std::sync::OnceLock::new();
    K.get_or_init(armar_keyjs)
}
fn armar_keyjs() -> Vec<String> {
    let mut t = vec![String::new(); 104];
    for i in 0..=9 { t[1 + i] = format!("Digit{}", i); }
    for i in 0..26 { t[11 + i] = format!("Key{}", (65 + i as u8) as char); }
    for i in 0..=9 { t[37 + i] = format!("Numpad{}", i); }
    for (i, c) in ["NumpadDivide", "NumpadMultiply", "NumpadSubtract", "NumpadAdd", "NumpadEnter", "NumpadDecimal", "BracketLeft", "BracketRight", "Semicolon", "Quote", "Backquote", "Comma", "Period", "Slash", "Backslash", "Minus", "Equal", "Enter", "Space", "Backspace", "Tab", "CapsLock", "NumLock", "Escape", "ScrollLock", "Insert", "Delete", "Home", "End", "PageUp", "PageDown", "Pause", "ShiftLeft", "ShiftRight", "AltLeft", "AltRight", "ControlLeft", "ControlRight", "MetaLeft", "MetaRight", "ContextMenu", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].iter().enumerate() { t[47 + i] = c.to_string(); }
    for i in 1..=12 { t[91 + i] = format!("F{}", i); }
    t
}
/// gmaBotones: los botones de GMod (KEY_*, MOUSE_*) apretados, en orden
pub(crate) fn botones() -> Vec<u32> {
    let mut s: Vec<u32> = Vec::new();
    let (en, bloq) = h(|h| (h.entrada().clone(), h.jug().bloqueado));
    if en.ui_abierto || bloq { return s; }
    let kj = keyjs();
    let pon = |s: &mut Vec<u32>, n: u32| if !s.contains(&n) { s.push(n); };
    for c in en.teclas.iter().chain(en.teclas_mod.iter()) { if let Some(n) = kj.iter().position(|x| x == c) { if n > 0 { pon(&mut s, n as u32); } } }
    if en.raton != 0 { pon(&mut s, en.raton); }
    if en.saltar { pon(&mut s, 65); }
    if en.agachar { pon(&mut s, 83); }
    if en.correr { pon(&mut s, 79); }
    if en.disparo { pon(&mut s, 107); }
    if en.disparo2 { pon(&mut s, 108); }
    s
}
/// gmaSwepPrim / gmaSwepSec
pub(crate) fn swep_dato(w: &Valor, sub: &str, k: &str) -> Valor {
    let Some(clase) = ce(w, |x| x.clase.clone()) else { return Valor::Nil };
    let Some(c) = clase_tabla(&clase, Lado::S) else { return Valor::Nil };
    match buscar_en_clase(&c, sub) { Valor::Tabla(p) => tget(&p, k), _ => Valor::Nil }
}
/// gmaConsola2: un comando de consola (concommand o variable)
pub(crate) fn consola2(e: &mut Estado, c: &str) {
    let p: Vec<String> = c.split_whitespace().map(String::from).collect();
    let p0 = p.first().cloned().unwrap_or_default();
    if let Some((f, ctx)) = g(|g| g.cmds.get(&p0).cloned()) {
        let jug = g(|g| g.jug.clone());
        let args = tab_de(p[1.min(p.len())..].iter().map(|x| cad(x)).collect());
        llamar(e, &f, ctx, &[jug, cad(&p0), args, Valor::from(p[1.min(p.len())..].join(" "))]);
    } else if g(|g| g.cvars.contains_key(&p0)) && p.len() > 1 { cvar_poner(e, &p0, &p[1..].join(" ")); }
}
/// gmaCvarPoner
pub(crate) fn cvar_poner(e: &mut Estado, n: &str, v: &str) {
    let Some(c) = g(|g| g.cvars.get(n).cloned()) else { return };
    let viejo = std::mem::replace(&mut c.borrow_mut().v, v.to_string());
    let cbs = c.borrow().cbs.clone();
    for (f, ctx) in cbs { llamar(e, &f, ctx, &[cad(n), cad(&viejo), cad(v)]); }
}

// ---------------- armas de los addons ----------------
pub(crate) fn hl2_arma(c: &str) -> Option<&'static str> {
    Some(match c {
        "weapon_crowbar" => "Crowbar", "weapon_physgun" => "PhysicsGun", "gmod_tool" => "ToolBaton", "weapon_rpg" => "RPG", "weapon_pistol" => "Pistol", "gmod_camera" => "Camera",
        "weapon_fists" | "weapon_hands" => "Hands", "weapon_357" => "Revolver", "weapon_smg1" => "Smg", "weapon_ar2" => "Akm", "weapon_shotgun" => "Shotgun", "weapon_crossbow" => "Crossbow",
        "weapon_stunstick" => "Bat", "weapon_physcannon" => "GravityGun", _ => return None,
    })
}
pub(crate) const HL2_ORDEN: [(&str, &str); 15] = [("weapon_crowbar", "Crowbar"), ("weapon_physgun", "PhysicsGun"), ("gmod_tool", "ToolBaton"), ("weapon_rpg", "RPG"), ("weapon_pistol", "Pistol"), ("gmod_camera", "Camera"), ("weapon_fists", "Hands"), ("weapon_hands", "Hands"), ("weapon_357", "Revolver"), ("weapon_smg1", "Smg"), ("weapon_ar2", "Akm"), ("weapon_shotgun", "Shotgun"), ("weapon_crossbow", "Crossbow"), ("weapon_stunstick", "Bat"), ("weapon_physcannon", "GravityGun")];
/// la clase de addon de un arma del inventario del juego ("gm:<clase>")
pub(crate) fn gm_de(n: &str) -> Option<String> { n.strip_prefix("gm:").map(String::from) }
/// gmaArmaJuego: el arma del juego que se tiene en la mano, como entidad de Lua
pub(crate) fn arma_juego() -> Option<Valor> {
    let n = h(|h| h.armas().actual().map(String::from))?;
    if !h(|h| h.arma_definida(&n)) || n.starts_with("gm:") { return None; }
    if let Some(w) = g(|g| g.armas_juego.get(&n).cloned()) { return Some(w); }
    let cl = HL2_ORDEN.iter().find(|x| x.1 == n).map(|x| x.0.to_string()).unwrap_or_else(|| format!("jx_{}", n));
    let w = nueva_ent(&cl, TipoEnt::Arma);
    let id = ent_id(&w).unwrap();
    g(|g| g.ent_delete(id));
    let jug = g(|g| g.jug.clone());
    ce(&w, |x| { x.dueno = Some(jug); x.creado = true; x.juego = Some(n.clone()); x.clip1 = Some(-1.0); });
    g(|g| g.armas_juego.insert(n, w.clone()));
    Some(w)
}
/// GetActiveWeapon
pub(crate) fn arma_activa(e: &mut Estado) -> Valor { fantasma(e).or_else(|| g(|g| g.swep.clone())).or_else(arma_juego).unwrap_or_else(null) }

// ---------------- efectos siempre activos (gmaFantasma) ----------------
const EV_SIN_FANTASMA: [&str; 21] = ["PlayerBindPress", "CreateMove", "StartCommand", "SetupMove", "Move", "FinishMove", "KeyPress", "KeyRelease", "PlayerButtonDown", "PlayerButtonUp", "InputMouseApply", "AdjustMouseSensitivity", "PreDrawViewModel", "PostDrawViewModel", "CalcViewModelView", "PlayerSwitchWeapon", "PlayerCanPickupWeapon", "WeaponEquip", "PlayerDroppedWeapon", "OnSpawnMenuOpen", "OnContextMenuOpen"];
const EV_PANTALLA: [&str; 14] = ["RenderScreenspaceEffects", "DrawOverlay", "PostDrawHUD", "PreDrawHUD", "HUDPaintBackground", "GetMotionBlurValues", "PostRender", "RenderScene", "PreDrawEffects", "PostDrawEffects", "SetupWorldFog", "SetupSkyboxFog", "PreDrawSkyBox", "PostDraw2DSkyBox"];
/// gmaEfectoObjeto: ¿el addon es un efecto de pantalla que depende de tener su arma? (la clase de esa arma)
fn efecto_objeto(a: &Rc<std::cell::RefCell<Addon>>) -> Option<String> {
    if let Some(r) = &a.borrow().ef_obj { return r.clone(); }
    let (id, sw, lua, corridos) = { let x = a.borrow(); (x.id.clone(), x.sweps.clone(), x.lua.clone(), x.lua_corridos) };
    let mut r = None;
    if (1..=2).contains(&sw.len()) {
        let dibuja = g(|g| g.hooks.v.iter().any(|(ev, hs)| EV_PANTALLA.contains(&ev.as_str()) && hs.iter().any(|(_, hk)| hk.a.as_deref() == Some(&id) && hk.c.is_some())));
        if dibuja {
            let de_arma = |ru: &str| sw.iter().any(|c| { let c = c.to_lowercase(); ru.starts_with(&format!("lua/weapons/{}/", c)) || ru == format!("lua/weapons/{}.lua", c) });
            let (mut src, mut arma) = (Vec::<u8>::new(), Vec::<u8>::new());
            for ru in &lua {
                let Some(b) = a.borrow().archivos.get(ru).cloned() else { continue };
                if src.len() + arma.len() > 6_000_000 { continue; }
                if de_arma(ru) { arma.extend_from_slice(&b); arma.push(b'\n'); } else if !ru.starts_with("lua/entities/") { src.extend_from_slice(&b); src.push(b'\n'); }
            }
            let tiene = |h: &[u8], n: &[u8]| h.windows(n.len()).any(|w| w == n);
            let llama = |h: &[u8], f: &[u8]| { let mut i = 0; while let Some(p) = h[i..].windows(f.len()).position(|w| w == f) { let mut j = i + p + f.len(); while j < h.len() && (h[j] as char).is_whitespace() { j += 1; } if j < h.len() && h[j] == b'(' { return true; } i += p + 1; } false };
            let pp = ["UpdateScreenEffectTexture", "DrawColorModify", "DrawMaterialOverlay", "DrawBloom", "DrawSharpen", "DrawMotionBlur", "DrawToyTown", "DrawSobel", "DrawTexturize", "DrawScreenQuad", "GetScreenEffectTexture", "CopyRenderTargetToTexture", "DrawBokehDOF", "UpdateRefractTexture"];
            if llama(&src, b"GetActiveWeapon") && pp.iter().any(|x| tiene(&src, x.as_bytes())) && !llama(&arma, b"ents.Create") {
                r = sw.iter().find(|c| tiene(&src, format!("\"{}\"", c).as_bytes()) || tiene(&src, format!("'{}'", c).as_bytes())).cloned();
            }
        }
    }
    if corridos > 0 { a.borrow_mut().ef_obj = Some(r.clone()); }
    r
}
/// gmaFantasma: el arma de mentira que ve un efecto siempre activo dentro de sus hooks (o None)
pub(crate) fn fantasma(e: &mut Estado) -> Option<Valor> {
    let (a, ctx, ev) = g(|g| (g.hook_addon.clone(), g.ctx, g.hook_ev.clone()));
    let a = a?;
    if ctx != Lado::C || ev.as_deref().map(|x| EV_SIN_FANTASMA.contains(&x)).unwrap_or(false) { return None; }
    let f = match g(|g| g.fantasmas.get(&a).cloned()) {
        Some(f) => f,
        None => {
            let mut f = None;
            let ad = g(|g| g.addons.iter().find(|x| x.borrow().id == a).cloned());
            let c = ad.as_ref().and_then(efecto_objeto);
            if let Some(c) = c.filter(|c| g(|g| g.armas.has(c))) {
                let w = nueva_ent(&c, TipoEnt::Arma);
                let jug = g(|g| g.jug.clone());
                let cs = swep_dato(&w, "Primary", "ClipSize");
                let ct = clase_tabla(&c, Lado::S);
                let (vm, wm) = ct.as_ref().map(|t| (buscar_en_clase(t, "ViewModel"), buscar_en_clase(t, "WorldModel"))).unwrap_or((Valor::Nil, Valor::Nil));
                ce(&w, |x| { x.dueno = Some(jug); x.creado = true; x.clip1 = Some(if cs.es_nil() || mas(&cs) < 0.0 { -1.0 } else { mas(&cs) }); x.vm = vm; x.wm = wm; });
                f = Some((w.clone(), c.clone()));
                g(|g| g.fantasmas.insert(a.clone(), f.clone()));
                let he = g(|g| std::mem::replace(&mut g.hook_ev, Some("PlayerSwitchWeapon".into())));
                preparar(e, &w);
                metodo(e, &w, "Initialize", Lado::S, &[]);
                let sep = g(|g| g.armas.get(&c).map(|x| match (&x.c, &x.s) { (Some(cc), Some(ss)) => !Rc::ptr_eq(cc, ss), (Some(_), None) => true, _ => false }).unwrap_or(false));
                if sep { iniciar_cliente(e, &w); }
                g(|g| g.hook_ev = he);
            }
            g(|g| g.fantasmas.insert(a.clone(), f.clone()));
            f
        }
    };
    let (w, clase) = f?;
    if g(|g| g.swep.as_ref().and_then(|s| ce(s, |x| x.clase.clone())).map(|x| x == clase).unwrap_or(false)) { return None; }
    if !h(|h| h.jug().vivo) { return None; }
    Some(w)
}
const GMA_VM: [(&str, &str); 13] = [("pistol", "Pistol"), ("357", "Revolver"), ("smg1", "Smg"), ("irifle", "Akm"), ("shotgun", "Shotgun"), ("rpg", "RPG"), ("crossbow", "Crossbow"), ("crowbar", "Crowbar"), ("stunstick", "Bat"), ("physcannon", "GravityGun"), ("toolgun", "ToolBaton"), ("physics", "PhysicsGun"), ("hands", "Hands")];
fn hold_base(h0: &str) -> Option<&'static str> {
    Some(match h0 { "pistol" | "duel" => "Pistol", "revolver" => "Revolver", "smg" => "Smg", "ar2" => "Akm", "shotgun" => "Shotgun", "rpg" => "RPG", "crossbow" => "Crossbow", "melee" | "knife" => "Crowbar", "melee2" => "Bat", "fist" | "normal" | "grenade" | "slam" | "magic" | "passive" => "Hands", "camera" => "Camera", "physgun" => "PhysicsGun", _ => return None })
}
/// gmaVistaBase: el arma del juego cuya vista usa un arma de un addon (None: trae la suya)
fn vista_base(vm: &str, hold: &str) -> Option<String> {
    let m = vm.to_lowercase().replace('\\', "/");
    if !m.is_empty() && (archivo(&m).is_some() || existe(&m)) { return None; }
    let def = |n: &str| h(|h| h.arma_definida(n));
    for (k, n) in GMA_VM {
        let ok = match k {
            "irifle" => m.contains("v_irifle") || m.contains("c_irifle") || m.contains("ar2"),
            "physcannon" => m.contains("physcannon"),
            "toolgun" => m.contains("toolgun"),
            "physics" => m.contains("v_physics") || m.contains("c_physics") || m.contains("physgun"),
            "hands" => ["v_grenade", "c_grenade", "v_slam", "c_slam", "v_bugbait", "c_bugbait", "v_medkit", "c_medkit", "c_arms", "hands", "fists"].iter().any(|x| m.contains(x)),
            _ => { let p1 = format!("v_{}", k); let p2 = format!("c_{}", k); [p1, p2].iter().any(|p| m.match_indices(p.as_str()).any(|(i, _)| { let fin = i + p.len(); fin >= m.len() || !m.as_bytes()[fin].is_ascii_alphanumeric() && m.as_bytes()[fin] != b'_' })) }
        };
        if ok && def(n) { return Some(n.to_string()); }
    }
    let hb = hold_base(&hold.to_lowercase());
    if let Some(hb) = hb { if def(hb) { return Some(hb.to_string()); } }
    if def("Pistol") { Some("Pistol".into()) } else { None }
}
/// gmaDarArma: un arma de un addon al jugador (dado: Player:Give, queda en el inventario sin cambiar la de la mano)
pub(crate) fn dar_arma(e: &mut Estado, clase: &str, dado: bool) -> Valor {
    let dar = |n: &str| {
        let (hay, actual) = h(|h| { let a = h.armas(); (!a.lista.is_empty(), a.actual().is_some()) });
        if dado && hay && actual {
            if h(|h| h.arma_definida(n)) && !h(|h| h.armas().lista.iter().any(|x| x == n)) { h(|h| h.armas().lista.push(n.to_string())); }
        } else { h(|h| h.dar_arma(n)); }
    };
    if let Some(n) = hl2_arma(clase) { if h(|h| h.arma_definida(n)) { dar(n); return null(); } }
    if !g(|g| g.armas.has(clase)) { return null(); }
    let w = match g(|g| g.armas_jug.get(&clase.to_string()).cloned()) {
        Some(w) => w,
        None => {
            let w = nueva_ent(clase, TipoEnt::Arma);
            let jug = g(|g| g.jug.clone());
            let cs = swep_dato(&w, "Primary", "ClipSize");
            let dc = swep_dato(&w, "Primary", "DefaultClip");
            let clip = if cs.es_nil() || mas(&cs) < 0.0 { -1.0 } else if dc.es_nil() || mas(&dc) < 0.0 { mas(&cs) } else { mas(&cs).min(mas(&dc)) };
            let c = clase_tabla(clase, Lado::S);
            let vm = c.as_ref().map(|c| buscar_en_clase(c, "ViewModel")).unwrap_or(Valor::Nil);
            let wm = c.as_ref().map(|c| buscar_en_clase(c, "WorldModel")).unwrap_or(Valor::Nil);
            ce(&w, |x| { x.dueno = Some(jug); x.clip1 = Some(clip); x.creado = true; x.vm = vm.clone(); x.wm = wm.clone(); });
            g(|g| g.armas_jug.set(clase.to_string(), w.clone()));
            let hold = c.as_ref().map(|c| buscar_en_clase(c, "HoldType")).unwrap_or(Valor::Nil);
            let base = vista_base(&if t(&vm) { js_str(&vm) } else { String::new() }, &if t(&hold) { js_str(&hold) } else { String::new() });
            let nom = crate::resto::nombre_clase(e, true, clase);
            h(|h| h.registrar_arma(&format!("gm:{}", clase), base.as_deref(), &nom));
            preparar(e, &w);
            metodo(e, &w, "Initialize", Lado::S, &[]);
            let sep = g(|g| g.armas.get(clase).map(|c| match (&c.c, &c.s) { (Some(cc), Some(ss)) => !Rc::ptr_eq(cc, ss), (Some(_), None) => true, _ => false }).unwrap_or(false));
            if sep { iniciar_cliente(e, &w); }
            w
        }
    };
    dar(&format!("gm:{}", clase));
    w
}
/// gmaIniciarCliente: el Initialize del cliente de un arma
pub(crate) fn iniciar_cliente(e: &mut Estado, w: &Valor) {
    let i0 = g(|g| std::mem::replace(&mut g.ini_c, Some(w.clone())));
    metodo(e, w, "Initialize", Lado::C, &[]);
    g(|g| g.ini_c = i0);
}
/// gmaQuitarArma
pub(crate) fn quitar_arma(clase: &str) {
    if g(|g| g.armas_jug.delete(&clase.to_string())).is_none() { return; }
    let n = format!("gm:{}", clase);
    let i = h(|h| h.armas().lista.iter().position(|x| *x == n));
    if let Some(i) = i {
        let nuevo = h(|h| { let a = h.armas(); a.lista.remove(i); if a.i >= a.lista.len() { a.i = 0; } a.i });
        h(|h| h.elegir_arma(nuevo));
    }
}
/// gmaAnimVista: SendWeaponAnim → la animación de la vista del juego (el juego la elige por la actividad)
pub(crate) fn anim_vista(e: &mut Estado, w: &Valor, act: &Valor) {
    if !g(|g| g.swep.as_ref().map(|s| mismo(s, w)).unwrap_or(false)) { return; }
    let gl = e.globales();
    let es = |k: &str| { let v = gl.borrow().get_str(k); !v.es_nil() && v.crudo_igual(act) };
    let clip = if es("ACT_VM_PRIMARYATTACK") || es("ACT_VM_HITCENTER") || es("ACT_VM_MISSCENTER") { "fuego" } else if es("ACT_VM_SECONDARYATTACK") { "fuego2" } else if es("ACT_VM_RELOAD") { "recarga" } else if es("ACT_VM_DRAW") { "sacar" } else if es("ACT_VM_IDLE") { "quieto" } else { return };
    h(|h| h.animar_vista(clip));
    crate::modelos::vista_act(e, num(act, -1.0) as i32);
}
/// gmaSwepPaso: cada cuadro, con un arma de un addon en la mano (ataques, recarga, Think; Deploy/Holster al cambiar)
pub(crate) fn swep_paso(e: &mut Estado) {
    let n = h(|h| h.armas().actual().map(String::from));
    let w = n.as_deref().and_then(gm_de).and_then(|c| g(|g| g.armas_jug.get(&c).cloned()));
    let actual = g(|g| g.swep.clone());
    let distinta = match (&w, &actual) { (Some(a), Some(b)) => !mismo(a, b), (None, None) => false, _ => true };
    if distinta {
        if let Some(o) = &actual {
            if ce(o, |x| x.vivo).unwrap_or(false) {
                metodo(e, o, "Holster", Lado::S, &[]);
                let clase = ce(o, |x| x.clase.clone()).unwrap_or_default();
                let sep = g(|g| g.armas.get(&clase).map(|c| match (&c.c, &c.s) { (Some(cc), Some(ss)) => !Rc::ptr_eq(cc, ss), (Some(_), None) => true, _ => false }).unwrap_or(false));
                if sep { metodo(e, o, "Holster", Lado::C, &[]); }
            }
            if g(|g| g.fov_arma.as_ref().map(|f| mismo(f, o)).unwrap_or(false)) { g(|g| { g.fov_lua = 0.0; g.fov_arma = None; }); }
        }
        g(|g| g.swep = w.clone());
        if let Some(w) = &w { metodo(e, w, "Deploy", Lado::S, &[]); }
    }
    let Some(w) = w else { return };
    let (ui, vivo, bloq) = h(|h| (h.entrada().ui_abierto, h.jug().vivo, h.jug().bloqueado));
    if ui || !vivo || bloq { ce(&w, |x| x.prev_p = false); return; }
    let tec_frame = g(|g| g.tec_ant);
    if let Some(tw) = ce(&w, |x| x.tec_w).flatten() { g(|g| g.tec_ant = tw); }
    swep_paso2(e, &w);
    g(|g| g.tec_ant = tec_frame);
    let k = teclas();
    ce(&w, |x| x.tec_w = Some(k));
}
fn swep_paso2(e: &mut Estado, w: &Valor) {
    let tt = h(|h| h.tiempo());
    let rec = ce(w, |x| x.recarga).unwrap_or(0.0);
    if rec != 0.0 && tt >= rec {
        ce(w, |x| x.recarga = 0.0);
        let cs = mas(&swep_dato(w, "Primary", "ClipSize"));
        if cs > 0.0 { ce(w, |x| x.clip1 = Some(cs)); }
    }
    let auto = t(&swep_dato(w, "Primary", "Automatic"));
    let (disp, disp2, tiene_r) = h(|h| { let en = h.entrada(); (en.disparo, en.disparo2, en.tiene("KeyR")) });
    let (prev_p, next_p, recarga) = ce(w, |x| (x.prev_p, x.next_p, x.recarga)).unwrap();
    if disp && (auto || !prev_p) && tt >= next_p && recarga == 0.0 { metodo(e, w, "PrimaryAttack", Lado::S, &[]); }
    ce(w, |x| x.prev_p = disp);
    let auto2 = t(&swep_dato(w, "Secondary", "Automatic"));
    let (prev_s, next_s, recarga) = ce(w, |x| (x.prev_s, x.next_s, x.recarga)).unwrap();
    if disp2 && (auto2 || !prev_s) && tt >= next_s && recarga == 0.0 { metodo(e, w, "SecondaryAttack", Lado::S, &[]); }
    ce(w, |x| x.prev_s = disp2);
    let pr = tiene_r || g(|g| std::mem::replace(&mut g.pedir_recarga, false));
    if pr { if !ce(w, |x| x.prev_r).unwrap_or(true) { metodo(e, w, "Reload", Lado::S, &[]); } ce(w, |x| x.prev_r = true); } else { ce(w, |x| x.prev_r = false); }
    metodo(e, w, "Think", Lado::S, &[]);
}
/// gmaArmasSuelo: pasar por encima de un arma tirada la agarra
pub(crate) fn armas_suelo(e: &mut Estado) {
    let ents = g(|g| g.ents_vivas());
    let j = h(|h| h.jug().clone());
    for x in ents {
        let Some((Some(c), true, Some(o))) = ce(&x, |y| (y.arma_suelo.clone(), y.vivo, y.o)) else { continue };
        let Some(p) = cuerpo(o, |b| b.pos) else { continue };
        let (dx, dz, dy) = (p.x - j.pos.x, p.z - j.pos.z, p.y - (j.pos.y - if j.medio == 0.0 { 0.9 } else { j.medio }));
        if dx * dx + dz * dz < 1.1 * 1.1 && dy.abs() < 1.6 { quitar(e, &x); dar_arma(e, &c, false); }
    }
}

/// un valor de la clase de un arma por su nombre (buscarEnClase con clave de Lua)
#[allow(dead_code)]
pub(crate) fn dato_clase(t: &TablaRef, k: &str) -> Valor { buscar_en_clase_v(t, &cad(k)) }
