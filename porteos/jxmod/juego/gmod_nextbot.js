// ---------------- nextbots de los addons (ENT.Base = "base_nextbot"): SCP, los "nextbots" que persiguen, zombis ----------------
// Como en GMod: al crearse corre BehaveStart (la corrutina de RunBehaviour) y cada cuadro BehaveUpdate (la sigue hasta su
// próximo coroutine.yield; gmod_lua.js tiene corrutinas de verdad), después se mueve con su locomoción (self.loco:
// Approach, FaceTowards, velocidad deseada, aceleración, gravedad, saltar, trabarse) y BodyUpdate. Path("Follow") no
// tiene malla de navegación (los mapas del juego no la traen): el camino es la recta a la meta, que la locomoción sigue
// pisando el piso (subiendo escalones y cayendo) y frenando contra lo que no puede pasar (ahí se traba, como en GMod).
// StartActivity / SetSequence ponen la secuencia del modelo por su actividad (ACT_RUN, ACT_WALK, ACT_IDLE...) o por su
// nombre, y el modelo se dibuja animado (gmod_pm.js: los huesos del .mdl cuadro a cuadro).
const GMNB = { mtLoco: null, mtPath: null, actNum: null };
const gmnbEs = (e) => { const t = claseTabla(e.clase, 'S'); return !!t && buscarEnClase(t, 'Type') === 'nextbot'; };
// el número de una constante ACT_ (las del prelude o las que da el __index de las globales)
const gmnbNum = (n) => { try { const v = GMA.R.ix(GMA.R.G, n); return typeof v === 'number' ? v : undefined; } catch (e) { return undefined; } };
// la locomoción de un nextbot (self.loco)
function gmnbLoco(e) {
  if (e.loco) return e.loco;
  if (!GMNB.mtLoco) {
    const M = (GMNB.mtLoco = new LuaTable()), I = new LuaTable(); M.set('__index', I); M.set('MetaName', 'CLuaLocomotion');
    const L = (n, f) => I.set(n, (l, ...a) => f(l.st, l, ...a));
    L('Approach', (s, l, g) => { if (g instanceof LVec) s.meta = vG(g); }); L('FaceTowards', (s, l, g) => { if (g instanceof LVec) s.mirar = vG(g); });
    L('SetDesiredSpeed', (s, l, v) => { s.vel0 = +v || 0; }); L('GetDesiredSpeed', (s) => s.vel0);
    L('SetAcceleration', (s, l, v) => { s.acel = +v || 0; }); L('GetAcceleration', (s) => s.acel); L('SetDeceleration', (s, l, v) => { s.decel = +v || 0; }); L('GetDeceleration', (s) => s.decel);
    L('SetJumpHeight', (s, l, v) => { s.salto = +v || 0; }); L('GetJumpHeight', (s) => s.salto); L('SetStepHeight', (s, l, v) => { s.paso = +v || 0; }); L('GetStepHeight', (s) => s.paso);
    L('SetMaxYawRate', (s, l, v) => { s.giro = +v || 0; }); L('GetMaxYawRate', (s) => s.giro); L('SetGravity', (s, l, v) => { s.grav = +v; }); L('GetGravity', (s) => s.grav);
    L('SetDeathDropHeight', (s, l, v) => { s.caida = +v || 0; }); L('GetDeathDropHeight', (s) => s.caida);
    L('GetVelocity', (s) => GMA.Vd(s.v)); L('SetVelocity', (s, l, v) => { if (v instanceof LVec) s.v.copy(vG(v)); });
    L('IsStuck', (s) => s.trabado); L('ClearStuck', (s) => { s.trabado = false; s.tTrabado = 0; });
    L('Jump', (s) => { if (s.suelo) { s.v.y = Math.sqrt(2 * Math.max(1, s.grav) * Math.max(1, s.salto)) * GS; s.suelo = false; } });
    L('JumpAcrossGap', (s, l, g) => { if (s.suelo) { if (g instanceof LVec) s.meta = vG(g); s.v.y = Math.sqrt(2 * Math.max(1, s.grav) * Math.max(1, s.salto)) * GS; s.suelo = false; } });
    L('IsOnGround', (s) => s.suelo); L('IsClimbingOrJumping', (s) => !s.suelo); L('IsAttemptingToMove', (s) => !!s.metaAnt); L('IsUsingLadder', () => false);
    L('GetGroundMotionVector', (s) => { const h = Math.hypot(s.v.x, s.v.z); return h > 1e-4 ? GMA.Vd(v3(s.v.x / h, 0, s.v.z / h)) : GMA.nv(0, 0, 0); });
    L('GetCurrentAcceleration', () => GMA.nv(0, 0, 0)); L('IsAreaTraversable', () => true); L('GetNextBot', (s, l) => l.e);
    for (const n of ['SetClimbAllowed', 'SetJumpGapsAllowed', 'SetAvoidAllowed', 'SetDuckAllowed']) L(n, () => {});
    for (const n of ['GetClimbAllowed', 'GetJumpGapsAllowed', 'GetAvoidAllowed', 'GetDuckAllowed']) L(n, () => true);
  }
  return (e.loco = { __mt: GMNB.mtLoco, e, st: { meta: null, metaAnt: null, mirar: null, vel0: 0, acel: 400, decel: 400, salto: 58, paso: 18, giro: 200, grav: 1000, caida: 200, v: v3(), suelo: false, trabado: false, tTrabado: 0 } });
}
// Path("Follow" | "Chase"): sin malla de navegación, la recta a la meta
function gmnbPath() {
  if (!GMNB.mtPath) {
    const M = (GMNB.mtPath = new LuaTable()), I = new LuaTable(); M.set('__index', I); M.set('MetaName', 'PathFollower');
    const P = (n, f) => I.set(n, (p, ...a) => f(p, ...a));
    P('SetMinLookAheadDistance', (p, d) => { p.ver = +d || 0; }); P('GetMinLookAheadDistance', (p) => p.ver);
    P('SetGoalTolerance', (p, d) => { p.tol = +d || 0; }); P('GetGoalTolerance', (p) => p.tol);
    P('Compute', (p, bot, pos) => { if (!(pos instanceof LVec) || !(bot instanceof LEnt)) return false; p.meta = vG(pos); p.ini = gmaEntPos(bot); p.t0 = TIEMPO.t; p.ok = true; return true; });
    P('IsValid', (p) => !!p.ok); P('Invalidate', (p) => { p.ok = false; }); P('GetAge', (p) => TIEMPO.t - p.t0);
    P('GetLength', (p) => (p.ok ? vsub(p.meta, p.ini).len() / GS : 0)); P('GetStart', (p) => GMA.V(p.ini || v3())); P('GetEnd', (p) => GMA.V(p.meta || v3()));
    P('GetCurrentGoal', (p) => { const t = new LuaTable(); t.set('pos', GMA.V(p.meta || v3())); t.set('type', 0); return t; }); P('FirstSegment', (p) => { const t = new LuaTable(); t.set('pos', GMA.V(p.ini || v3())); return t; }); P('LastSegment', (p) => { const t = new LuaTable(); t.set('pos', GMA.V(p.meta || v3())); return t; });
    P('GetAllSegments', (p) => { const t = new LuaTable(); for (const x of [p.ini, p.meta]) { const s = new LuaTable(); s.set('pos', GMA.V(x || v3())); t.a.push(s); } return t; });
    P('GetPositionOnPath', (p) => GMA.V(p.meta || v3())); P('GetClosestPosition', (p) => GMA.V(p.meta || v3())); P('GetCursorPosition', () => 0); P('GetCursorData', () => new LuaTable());
    P('ResetAge', (p) => { p.t0 = TIEMPO.t; }); P('MoveCursorToStart', () => {}); P('MoveCursorToEnd', () => {}); P('MoveCursorTo', () => {}); P('MoveCursorToClosestPosition', () => {}); P('MoveCursor', () => {}); P('Draw', () => {}); P('GetHindrance', () => NULL_ENT);
    // seguirlo: la locomoción va hacia la meta y mira para ahí; cerca de la meta, el camino terminó
    const seguir = (p, bot) => {
      if (!p.ok || !(bot instanceof LEnt) || !bot.vivo) return;
      const pos = gmaEntPos(bot), d = vsub(p.meta, pos); d.y = 0;
      if (d.len() <= Math.max(p.tol || 20, 8) * GS) { p.ok = false; return; }
      const l = gmnbLoco(bot).st; l.meta = p.meta.clone(); l.mirar = p.meta.clone();
    };
    P('Update', (p, bot) => seguir(p, bot));
    P('Chase', (p, bot, ent) => { if (ent instanceof LEnt && ent.vivo) { p.meta = gmaEntPos(ent); p.ok = true; if (!p.t0) p.t0 = TIEMPO.t; } seguir(p, bot); });
  }
  return { __mt: GMNB.mtPath, ok: false, meta: null, ini: null, t0: 0, tol: 25, ver: 300 };
}
// la API: Path(), métodos de NextBot en las entidades, navmesh de mentira (todo el piso se puede pisar)
function gmnbApi() {
  const R = GMA.R, G = R.G, def = (t, n, f) => t.set(n, f), EM = GMA.metas && GMA.metas.Entity, E = (n, f) => EM && EM.set(n, f);
  def(G, 'Path', () => gmnbPath());
  E('StartActivity', (e, act) => { e.nbAct = +act || 0; gmnbSecuencia(e, { act: e.nbAct }); }); E('GetActivity', (e) => e.nbAct || 0);
  E('BodyMoveXY', () => {}); E('GetRangeTo', (e, x) => vsub(gmaEntPos(e), x instanceof LEnt ? gmaEntPos(x) : x instanceof LVec ? vG(x) : gmaEntPos(e)).len() / GS);
  E('GetRangeSquaredTo', (e, x) => { const d = vsub(gmaEntPos(e), x instanceof LEnt ? gmaEntPos(x) : x instanceof LVec ? vG(x) : gmaEntPos(e)).len() / GS; return d * d; });
  E('SetFOV', (e, v) => { e.nbFov = +v || 90; }); E('GetFOV', (e) => e.nbFov || 90); E('SetMaxVisionRange', (e, v) => { e.nbVista = +v || 0; }); E('GetMaxVisionRange', (e) => e.nbVista || 1e4);
  E('IsAbleToSee', (e, o) => { if (!(o instanceof LEnt) || !o.vivo) return false; const a = vadd(gmaEntPos(e), v3(0, 1.5, 0)), b = vadd(gmaEntPos(o), v3(0, 1.2, 0)), d = vsub(b, a), l = d.len(); if (l / GS > (e.nbVista || 1e4)) return false; const h = raycast(a, vscale(d, 1 / Math.max(1e-4, l)), l, e.o ? e.o.b : null); return !h || h.t > l - 0.6; });
  E('GetSolidMask', () => 33570827); E('SetSolidMask', () => {}); E('GetLastKnownPosition', (e, o) => GMA.V(o instanceof LEnt ? gmaEntPos(o) : v3()));
  E('BecomeRagdoll', (e) => { gmaQuitar(e); return NULL_ENT; });
  // secuencias del modelo en los nextbots (en lo demás queda lo que había, como las de la vista del arma)
  const envolver = (n, f) => { const orig = EM && EM.get(n); E(n, (e, ...a) => (e.nb ? f(e, ...a) : typeof orig === 'function' ? orig(e, ...a) : undefined)); };
  const sec = (e, s) => gmnbSecuencia(e, typeof s === 'number' ? { idx: s } : { nombre: s });
  envolver('SetSequence', (e, s) => sec(e, s)); envolver('ResetSequence', (e, s) => sec(e, s)); envolver('ResetSequenceInfo', () => {});
  envolver('LookupSequence', (e, n) => { const d = gmnbDef(e); if (!d) return [-1, 0]; const i = d.M.secuencias.findIndex((s) => s.n.toLowerCase() === String(n).toLowerCase()); if (i < 0) return [-1, 0]; const a = d.M.anims[d.M.secuencias[i].anim]; return [i, a ? Math.max(0, (a.nf - 1) / (a.fps > 0 ? a.fps : 30)) : 0]; });
  envolver('SequenceDuration', (e, i) => { const d = gmnbDef(e); const k = i === undefined ? (e.nbSec ? e.nbSec.i : -1) : +i; const s = d && d.M.secuencias[k], a = s && d.M.anims[s.anim]; return a ? Math.max(0, (a.nf - 1) / (a.fps > 0 ? a.fps : 30)) : 0; });
  envolver('GetSequence', (e) => (e.nbSec ? e.nbSec.i : 0)); envolver('SetPlaybackRate', (e, r) => { e.nbRate = +r || 0; }); envolver('GetPlaybackRate', (e) => e.nbRate ?? 1);
  envolver('SetCycle', (e, c) => { if (e.nbSec) e.nbSec.t = (+c || 0) * e.nbSec.dur; }); envolver('GetCycle', (e) => (e.nbSec && e.nbSec.dur > 0 ? (e.nbSec.loop ? (e.nbSec.t / e.nbSec.dur) % 1 : Math.min(1, e.nbSec.t / e.nbSec.dur)) : 0));
  envolver('SelectWeightedSequence', (e, act) => { const d = gmnbDef(e); if (!d) return -1; const i = d.M.secuencias.findIndex((s) => s.act && gmnbNum(String(s.act).toUpperCase()) === +act); return i; });
  envolver('GetSequenceActivity', (e, i) => { const d = gmnbDef(e), s = d && d.M.secuencias[+i]; return s && s.act ? gmnbNum(String(s.act).toUpperCase()) || -1 : -1; });
  envolver('FrameAdvance', () => {});
  const nav = R.G.get('navmesh'); if (nav instanceof LuaTable) {
    // (sin malla de navegación: las listas vacías y las búsquedas sin área; los bots igual caminan derecho a su meta)
    nav.set('IsLoaded', () => true); nav.set('GetNavAreaCount', () => 1); nav.set('IsGenerating', () => false);
    for (const n of ['GetAllNavAreas', 'Find', 'FindInBox', 'GetPlayerSpawnPoints']) nav.set(n, () => new LuaTable());
    for (const n of ['GetNavLadderByID', 'GetMarkedArea', 'GetMarkedLadder']) nav.set(n, () => undefined);
    // (el área "más cercana": una de mentira en el piso debajo del punto, para los bots que preguntan si están en la malla)
    const area = (p) => gmnbArea(p instanceof LVec ? vG(p) : v3());
    nav.set('GetNearestNavArea', (p) => area(p)); nav.set('GetNavArea', (p) => area(p)); nav.set('GetNavAreaByID', () => area(GMA.V(gmaEntPos(GMA.jug))));
    for (const n of ['BeginGeneration', 'Load', 'Save', 'Reset', 'AddWalkableSeed', 'ClearWalkableSeeds', 'SetMarkedArea', 'SetMarkedLadder', 'SetPlayerSpawnName']) nav.set(n, () => {});
    nav.set('GetGroundHeight', (p) => { if (!(p instanceof LVec)) return undefined; const g = vG(p), h = raycast(vadd(g, v3(0, 0.5, 0)), v3(0, -1, 0), 400, null); return h ? [vS(vadd(vadd(g, v3(0, 0.5, 0)), v3(0, -h.t, 0))).z, GMA.nv(0, 0, 1)] : undefined; });
  }
}
// un área de navegación de mentira (CNavArea): el piso debajo de un punto, de 8 m de lado
function gmnbArea(g) {
  if (!GMNB.mtArea) {
    const M = (GMNB.mtArea = new LuaTable()), I = new LuaTable(); M.set('__index', I); M.set('MetaName', 'CNavArea');
    const A = (n, f) => I.set(n, (a, ...x) => f(a, ...x)), piso = (q) => { const h = raycast(vadd(q, v3(0, 2, 0)), v3(0, -1, 0), 60, null); return h ? vadd(q, v3(0, 2 - h.t, 0)) : q; };
    A('GetCenter', (a) => GMA.V(a.c)); A('GetClosestPointOnArea', (a, p) => GMA.V(p instanceof LVec ? piso(vG(p)) : a.c)); A('GetRandomPoint', (a) => GMA.V(piso(vadd(a.c, v3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8)))));
    A('IsValid', () => true); A('GetID', () => 1); A('Contains', () => true); A('IsUnderwater', () => false); A('IsFlat', () => true); A('IsBlocked', () => false); A('IsConnected', () => true); A('IsVisible', () => true); A('IsOverlapping', () => true); A('IsRoughlySquare', () => true);
    A('GetZ', (a, p) => (p instanceof LVec ? vS(piso(vG(p))).z : vS(a.c).z)); A('GetSizeX', () => 315); A('GetSizeY', () => 315); A('GetCorner', (a) => GMA.V(a.c)); A('GetExtentInfo', () => new LuaTable());
    for (const n of ['GetHidingSpots', 'GetAdjacentAreas', 'GetIncomingConnections', 'GetLadders', 'GetVisibleAreas', 'GetAdjacentAreasAtSide', 'GetSpotEncounters']) A(n, () => new LuaTable());
    A('GetAdjacentCount', () => 0); A('GetAttributes', () => 0); A('HasAttributes', () => false); A('GetPlace', () => ''); A('ComputeAdjacentConnectionHeightChange', () => 0); A('ComputeGroundHeightChange', () => 0);
    for (const n of ['SetAttributes', 'AddHidingSpot', 'Draw', 'DrawSpots', 'Remove', 'SetPlace', 'ClearSearchLists', 'AddToClosedList', 'AddToOpenList', 'RemoveFromClosedList', 'SetCostSoFar', 'SetTotalCost', 'SetParent', 'UpdateOnOpenList']) A(n, () => {});
    for (const n of ['IsOpen', 'IsClosed', 'IsOpenListEmpty']) A(n, () => false); A('GetCostSoFar', () => 0); A('GetTotalCost', () => 0); A('GetParent', () => undefined);
  }
  const h = raycast(vadd(g, v3(0, 2, 0)), v3(0, -1, 0), 60, null);
  return { __mt: GMNB.mtArea, c: h ? vadd(g, v3(0, 2 - h.t, 0)) : g.clone() };
}
// la secuencia del modelo (por actividad o por nombre): el dibujo la anima
function gmnbSecuencia(e, q) {
  const def = gmnbDef(e); if (!def) return 0;
  const M = def.M; let i = -1;
  if (q.nombre !== undefined) { const n = String(q.nombre).toLowerCase(); i = M.secuencias.findIndex((s) => s.n.toLowerCase() === n); }
  else if (q.idx !== undefined) i = q.idx;
  else if (q.act) {
    i = M.secuencias.findIndex((s) => s.act && gmnbNum(String(s.act).toUpperCase()) === q.act);
    if (i < 0) { const nom = ['ACT_RUN', 'ACT_WALK', 'ACT_IDLE', 'ACT_JUMP', 'ACT_MELEE_ATTACK1'].find((n) => gmnbNum(n) === q.act); const re = nom === 'ACT_RUN' ? /run/i : nom === 'ACT_WALK' ? /walk/i : nom === 'ACT_IDLE' ? /idle/i : nom === 'ACT_JUMP' ? /jump/i : /attack|melee/i; if (nom) i = M.secuencias.findIndex((s) => re.test(s.n)); }
  }
  if (i < 0 || !M.secuencias[i]) return 0;
  const a = M.anims[M.secuencias[i].anim]; if (!a) return 0;
  e.nbSec = { i, anim: M.secuencias[i].anim, t: 0, loop: M.secuencias[i].loop, dur: Math.max(0, (a.nf - 1) / (a.fps > 0 ? a.fps : 30)) };
  return e.nbSec.dur;
}
function gmnbDef(e) { const m = String(e.modelo || '').toLowerCase(); if (!m || typeof gmpDef !== 'function') return null; if (e.nbDefDe !== m) { e.nbDefDe = m; e.nbDef = gmpDef(m) || null; e.nbMd = null; } return e.nbDef; }
// cada cuadro: la corrutina, la locomoción y el cuerpo
function gmnbPaso(dt) {
  for (const e of GMA.ents.values()) {
    if (!e.nb || !e.vivo) continue;
    metodo(e, 'BehaveUpdate', 'S', dt);
    if (!e.vivo) continue;
    gmnbMover(e, dt);
    metodo(e, 'BodyUpdate', 'S');
    if (e.nbSec) e.nbSec.t += dt * (e.nbRate || 1);
  }
}
const _nbq = new Quat();
function gmnbMover(e, dt) {
  const L = gmnbLoco(e).st, pos = gmaEntPos(e), v = L.v;
  // hacia la meta de este cuadro (Approach), con aceleración; si no hay, frena
  const vh = v3(v.x, 0, v.z); let quiere = v3();
  if (L.meta) { const d = vsub(L.meta, pos); d.y = 0; const l = d.len(); if (l > 0.02) quiere = vscale(d, Math.min(L.vel0 * GS, l / Math.max(dt, 1e-3)) / l); }
  const dif = vsub(quiere, vh), dl = dif.len(), ac = (quiere.len() > vh.len() ? L.acel : L.decel) * GS * dt;
  if (dl > 1e-5) vh.add(vscale(dif, Math.min(1, ac / dl)));
  v.x = vh.x; v.z = vh.z;
  // gravedad y piso: rayo para abajo desde la altura de un escalón
  const sube = L.paso * GS, nuevo = vadd(pos, vscale(v, dt));
  if (!L.suelo) v.y -= L.grav * GS * dt;
  const ign = e.o ? e.o.b : null, h = raycast(vadd(nuevo, v3(0, sube, 0)), v3(0, -1, 0), sube + Math.max(0.05, -v.y * dt) + 0.02, ign);
  if (h && v.y <= 0.01) { nuevo.y = nuevo.y + sube - h.t; v.y = 0; L.suelo = true; } else L.suelo = false;
  // contra lo que no puede pasar (a la altura de la rodilla): frena y, si sigue queriendo ir, se traba
  const hv = Math.hypot(v.x, v.z);
  if (hv > 0.05) {
    const dir = v3(v.x / hv, 0, v.z / hv), r = raycast(vadd(pos, v3(0, sube + 0.1, 0)), dir, hv * dt + 0.35, ign);
    if (r && r.body !== (e.o && e.o.b)) { nuevo.x = pos.x; nuevo.z = pos.z; v.x = 0; v.z = 0; }
  }
  if (L.meta && Math.hypot(nuevo.x - pos.x, nuevo.z - pos.z) < 0.02 * dt * 60 * 0.25) { L.tTrabado += dt; if (L.tTrabado > 1) L.trabado = true; } else L.tTrabado = 0;
  // mirar: hacia FaceTowards o hacia donde camina, con giro máximo (en grados de Source: x del juego = y de Source)
  const objetivo = L.mirar ? vsub(L.mirar, pos) : hv > 0.1 ? v3(v.x, 0, v.z) : null, a0 = quatAng(entQ(e));
  let yaw = a0.y;
  if (objetivo && Math.hypot(objetivo.x, objetivo.z) > 0.01) { const meta = Math.atan2(objetivo.x, objetivo.z) * 180 / Math.PI, d = ((meta - yaw) % 360 + 540) % 360 - 180, mx = (L.giro || 200) * dt; yaw += Math.max(-mx, Math.min(mx, d)); }
  _nbq.copy(angQuat(new LAng(0, yaw, 0)));
  if (e.o) { const b = e.o.b; b.q.copy(_nbq); gmaOrigenPon(e.o, nuevo, _nbq); b.vel.set(0, 0, 0); b.ang.set(0, 0, 0); b.frozen = true; b.updateWorld && b.updateWorld(); } else { e.pos.copy(nuevo); e.q.copy(_nbq); }
  L.metaAnt = L.meta; L.meta = null; L.mirar = null;
}
// el modelo animado (si su Draw llama DrawModel o no tiene Draw): en lugar del modelo quieto del cuerpo
function gmnbDibujar(e) {
  const def = gmnbDef(e); if (!def || !e.o || e.o.md.oculto) return false;
  if (!e.nbMd) { e.nbMd = new Modelo(def.arb); e.nbMd.fijo = def.arb.map(() => null); e.nbW = def.arb.map(() => new Float32Array(16)); }
  const md = e.nbMd, A = def.arb, M = def.M, W = e.nbW, s = e.nbSec;
  const org = gmaOrigen(e.o); m4trs([org.x, org.y, org.z], [e.o.b.q.x, e.o.b.q.y, e.o.b.q.z, e.o.b.q.w], [1, 1, 1], W[0]); md.fijo[0] = W[0];
  let pa = null, pb = null, w = 0;
  if (s) { const An = M.anims[s.anim], fps = An.fps > 0 ? An.fps : 30, n = Math.max(1, An.nf - 1), fr = s.loop ? (s.t * fps) % n : Math.min(n, s.t * fps), f0 = Math.floor(fr); w = fr - f0; pa = GMF.poseCapas(M, s.anim, f0); pb = GMF.poseCapas(M, s.anim, Math.min(An.nf - 1, f0 + 1)); }
  for (let i = 1; i <= def.nb; i++) {
    const h = i - 1; let p = A[i].p, r = A[i].r;
    if (pa) {
      const pp = [0, 1, 2].map((c) => pa.P[h * 3 + c] * (1 - w) + pb.P[h * 3 + c] * w);
      let q1 = [pb.Q[h * 4], pb.Q[h * 4 + 1], pb.Q[h * 4 + 2], pb.Q[h * 4 + 3]]; const q0 = [pa.Q[h * 4], pa.Q[h * 4 + 1], pa.Q[h * 4 + 2], pa.Q[h * 4 + 3]];
      if (q0[0] * q1[0] + q0[1] * q1[1] + q0[2] * q1[2] + q0[3] * q1[3] < 0) q1 = q1.map((x) => -x);
      const qi = q0.map((x, c) => x * (1 - w) + q1[c] * w), l = Math.hypot(...qi) || 1; p = def.pv(pp); r = def.rot(qi.map((x) => x / l));
    }
    m4trs(p, r, [1, 1, 1], W[i]); m4mul(W[A[i].pa], W[i], W[i]); md.fijo[i] = W[i];
  }
  md.color = e.o.md.color; md.sucio = true; md.encolar(); e.o.md.oculto = true;
  return true;
}
if (typeof module !== 'undefined') module.exports = { gmnbLoco, gmnbPath, gmnbApi, gmnbPaso, gmnbEs, gmnbDibujar };
