// ---------------- nextbots de los addons (ENT.Base = "base_nextbot"): SCP, los "nextbots" que persiguen, zombis ----------------
// Como en GMod: al crearse corre BehaveStart (la corrutina de RunBehaviour) y cada cuadro BehaveUpdate (la sigue hasta su
// próximo coroutine.yield; gmod_lua.js tiene corrutinas de verdad), después se mueve con su locomoción (self.loco:
// Approach, FaceTowards, velocidad deseada, aceleración, gravedad, saltar, trabarse) y BodyUpdate. Path("Follow") no
// tiene malla de navegación (los mapas del juego no la traen): el camino es la recta a la meta si está libre y, si no, uno
// que rodea lo que hay en el medio (A* en una grilla sobre el piso, gmnbAEstrella); la locomoción lo sigue pisando el piso
// (subiendo escalones y cayendo) y resbalando a lo largo de lo que no puede pasar, como en GMod.
// StartActivity / SetSequence ponen la secuencia del modelo por su actividad (ACT_RUN, ACT_WALK, ACT_IDLE...) o por su
// nombre, y el modelo se dibuja animado (gmod_pm.js: los huesos del .mdl cuadro a cuadro).
const GMNB = { mtLoco: null, mtPath: null, actNum: null, sysDesc: 0, sysUlt: 0, ambito: 0 };
// SysTime para el Lua, sin lo que tardan los caminos de acá. Los nextbots de la base de Sanic —Obunga, Walter, Smiley, Doge,
// Shaq: los más bajados— miden con SysTime cuánto tarda Path:Compute y, si pasa de 5 ms, no vuelven a buscar camino por
// 5 s («workaround for the navmesh pathing bug»). En GMod el camino sale de la malla de navegación en una fracción de
// milisegundo; acá, con rayos y A* en JavaScript, en un celular pasaba de 5 ms casi siempre: el nextbot seguía un camino
// viejo o se quedaba parado hasta 5 s («nextbots lentos»). El tiempo de los caminos no cuenta (y se recupera de a poco,
// a un cuarto de la velocidad del reloj, para no quedar atrasado)
function gmnbSysTime() {
  const t = performance.now() / 1000;
  if (GMNB.sysDesc > 0 && GMNB.sysUlt) { GMNB.sysDesc = Math.max(0, GMNB.sysDesc - Math.max(0, t - GMNB.sysUlt) * 0.25); }
  GMNB.sysUlt = t; return t - GMNB.sysDesc;
}
function gmnbSinTiempo(f) { const t0 = performance.now(); try { return f(); } finally { GMNB.sysDesc += (performance.now() - t0) / 1000; GMNB.sysUlt = performance.now() / 1000; } }
const gmnbEs = (e) => { const t = claseTabla(e.clase, 'S'); return !!t && buscarEnClase(t, 'Type') === 'nextbot'; };
// la escala del modelo de ahora (SetModelScale con tiempo: va de la de antes a la nueva en ese tiempo, como en GMod)
function gmnbEscala(e) {
  const z = e.escalaDe; if (z && TIEMPO.t < z.t1) { const f = Math.max(0, Math.min(1, (TIEMPO.t - z.t0) / Math.max(1e-3, z.t1 - z.t0))); return z.a + (z.b - z.a) * f; }
  const s = +e.escala; return s > 0 ? s : 1;
}
// el número de una constante ACT_ (las del prelude o las que da el __index de las globales)
const gmnbNum = (n) => { try { const v = GMA.R.ix(GMA.R.G, n); return typeof v === 'number' ? v : undefined; } catch (e) { return undefined; } };
// la locomoción de un nextbot (self.loco)
function gmnbLoco(e) {
  if (e.loco) return e.loco;
  if (!GMNB.mtLoco) {
    const M = (GMNB.mtLoco = new LuaTable()), I = new LuaTable(); M.set('__index', I); M.set('MetaName', 'CLuaLocomotion');
    const L = (n, f) => I.set(n, (l, ...a) => f(l.st, l, ...a));
    L('Approach', (s, l, g) => { if (g instanceof LVec) { s.meta = vG(g); s.tAp = TIEMPO.t; } }); L('FaceTowards', (s, l, g) => { if (g instanceof LVec) s.mirar = vG(g); });
    L('SetDesiredSpeed', (s, l, v) => { s.vel0 = +v || 0; }); L('GetDesiredSpeed', (s) => s.vel0);
    L('SetAcceleration', (s, l, v) => { s.acel = +v || 0; }); L('GetAcceleration', (s) => s.acel); L('SetDeceleration', (s, l, v) => { s.decel = +v || 0; }); L('GetDeceleration', (s) => s.decel);
    L('SetJumpHeight', (s, l, v) => { s.salto = +v || 0; }); L('GetJumpHeight', (s) => s.salto); L('SetStepHeight', (s, l, v) => { s.paso = +v || 0; }); L('GetStepHeight', (s) => s.paso);
    L('SetMaxYawRate', (s, l, v) => { s.giro = +v || 0; }); L('GetMaxYawRate', (s) => s.giro); L('SetGravity', (s, l, v) => { s.grav = +v; }); L('GetGravity', (s) => s.grav);
    L('SetDeathDropHeight', (s, l, v) => { s.caida = +v || 0; }); L('GetDeathDropHeight', (s) => s.caida);
    // (en pulgadas por segundo, como SetVelocity y como GMod: antes salía en metros —39 veces menos— y DrGBase, que toma la
    // velocidad del nextbot de acá, ponía el paso de la animación en velocidad / velocidad de suelo ≈ 1/39: caminaban como
    // en cámara lenta; y SetVelocity(GetVelocity() + empujón) achicaba la velocidad en cada salto)
    L('GetVelocity', (s) => GMA.Vr(s.v)); L('SetVelocity', (s, l, v) => { if (v instanceof LVec) s.v.copy(vGr(v)); });
    L('IsStuck', (s) => s.trabado); L('ClearStuck', (s) => { s.trabado = false; s.tTrabado = 0; });
    L('Jump', (s) => { if (s.suelo) { s.v.y = Math.sqrt(2 * Math.max(1, s.grav) * Math.max(1, s.salto)) * GS; s.suelo = false; } });
    L('JumpAcrossGap', (s, l, g) => { if (s.suelo) { if (g instanceof LVec) { s.meta = vG(g); s.tAp = TIEMPO.t; } s.v.y = Math.sqrt(2 * Math.max(1, s.grav) * Math.max(1, s.salto)) * GS; s.suelo = false; } });
    L('IsOnGround', (s) => s.suelo); L('IsClimbingOrJumping', (s) => !s.suelo); L('IsAttemptingToMove', (s) => s.tAp !== undefined && TIEMPO.t - s.tAp < 0.25); L('IsUsingLadder', () => false);
    L('GetGroundMotionVector', (s) => { const h = Math.hypot(s.v.x, s.v.z); return h > 1e-4 ? GMA.Vd(v3(s.v.x / h, 0, s.v.z / h)) : GMA.nv(0, 0, 0); });
    L('GetCurrentAcceleration', () => GMA.nv(0, 0, 0)); L('IsAreaTraversable', () => true); L('GetNextBot', (s, l) => l.e);
    for (const n of ['SetClimbAllowed', 'SetJumpGapsAllowed', 'SetAvoidAllowed', 'SetDuckAllowed']) L(n, () => {});
    for (const n of ['GetClimbAllowed', 'GetJumpGapsAllowed', 'GetAvoidAllowed', 'GetDuckAllowed']) L(n, () => true);
  }
  return (e.loco = { __mt: GMNB.mtLoco, e, st: { meta: null, metaAnt: null, mirar: null, vel0: 0, acel: 400, decel: 400, salto: 58, paso: 18, giro: 200, grav: 1000, caida: 200, v: v3(), suelo: false, trabado: false, tTrabado: 0 } });
}
// ---- caminos sin malla de navegación ----
// GMod arma los caminos sobre la malla de navegación del mapa (nav_generate) y los mapas del juego no la traen: antes el
// camino era siempre la recta a la meta y, con una pared, una caja o un auto en el medio, el nextbot caminaba contra eso
// hasta trabarse («los nextbots 3D son muy tontos»). Ahora, si la recta está tapada, se busca el camino con A* en una
// grilla sobre el piso alrededor del nextbot y de la meta: cada celda con piso debajo (sin escalones más altos que su
// StepHeight ni caídas más hondas que su DeathDropHeight) y lugar para su ancho (rayos a la rodilla, a los costados, y al
// pecho). Después se acorta tirando del hilo (de cada punto, al más lejano al que se llega derecho). Lo que camina
// (jugadores, NPCs, otros nextbots) no cuenta como pared: se mueve, y en GMod tampoco está en la malla.
const GMNB_RUTA = { celda: 0.5, nodos: 2500, margen: 8, peso: 1.3, cada: 0.5 };
// lo que no tapa: el propio nextbot, lo que persigue y todo lo que camina
function gmnbIgnorar(bot, meta) {
  const ob = bot && bot.o && bot.o.b, mb = meta instanceof LEnt && meta.o ? meta.o.b : null;
  return { has: (b) => b === ob || b === mb || !!b.persona || !!b.noPhys || !!(b.obj && b.obj.gmEnt && b.obj.gmEnt.nb) };
}
// las medidas del nextbot para caminar: ancho (de sus límites de choque, entre 12 cm y 60 cm), alto, escalón y caída
function gmnbMedidas(bot) {
  const L = gmnbLoco(bot).st, esc = +bot.escala || 1; let r = 0.3, alto = 1.6;
  const lim = bot.limites; if (lim) { r = Math.max(Math.abs(lim[0].x), Math.abs(lim[1].x), Math.abs(lim[0].y), Math.abs(lim[1].y)) * GS * esc; alto = Math.abs(lim[1].z - lim[0].z) * GS * esc; }
  return { r: Math.max(0.12, Math.min(0.6, r)), alto: Math.max(0.4, Math.min(3, alto || 1.6)), paso: Math.max(0.1, (L.paso || 18) * GS), caida: Math.max(0.3, Math.min(12, (L.caida || 200) * GS)) };
}
// el piso debajo de (x, z) cerca de la altura y (subiendo hasta un escalón y bajando hasta la caída), o null
function gmnbPiso(x, y, z, R, ign) { const up = R.paso + 0.06, h = raycast(v3(x, y + up, z), v3(0, -1, 0), up + R.caida, ign); return h && h.n.y > 0.7 ? y + up - h.t : null; }
// ¿se va derecho de a a b? el piso cada medio metro (escalones y caídas) y, por tramos que siguen el piso, rayos a la
// rodilla —en el medio y a los costados, a su ancho— y al pecho
function gmnbLibre(a, b, R, ign) {
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz); if (L < 1e-3) return true;
  const ux = dx / L, uz = dz / L, n = Math.max(1, Math.ceil(L / 0.5)), rod = R.paso + 0.08, pecho = Math.max(R.paso + 0.25, Math.min(1.2, R.alto * 0.7));
  let y0 = a.y, x0 = a.x, z0 = a.z, cy = a.y, tramo = 0;
  for (let i = 1; i <= n; i++) {
    const t = (L * i) / n, x = a.x + ux * t, z = a.z + uz * t, g = gmnbPiso(x, cy, z, R, ign);
    if (g === null || g - cy > R.paso + 0.02) return false;
    cy = g; tramo++;
    // (cada 2 m o al final: los rayos del tramo, de piso a piso)
    if (tramo >= 4 || i === n) {
      for (const [hh, lados] of [[rod, [0, -1, 1]], [pecho, [0]]]) for (const sd of lados) {
        const ox = x0 - uz * sd * R.r, oz = z0 + ux * sd * R.r, o = v3(ox, y0 + hh, oz), e = v3(x - uz * sd * R.r, cy + hh, z + ux * sd * R.r), d = vsub(e, o), l = d.len();
        if (l > 1e-4 && raycast(o, d.scale(1 / l), l, ign)) return false;
      }
      x0 = x; z0 = z; y0 = cy; tramo = 0;
    }
  }
  return true;
}
// A* en la grilla: de a (los pies del nextbot) a b; devuelve los puntos (con la altura del piso) o null. Si no llega,
// el camino hasta la celda más cercana a la meta (como GMod, que lleva hasta el área más cercana) y llega = false
function gmnbAEstrella(a, b, R, ign) {
  const M = GMNB_RUTA.margen; let c = Math.max(GMNB_RUTA.celda, R.r * 1.6);
  const x0 = Math.min(a.x, b.x) - M, z0 = Math.min(a.z, b.z) - M; let nx = Math.ceil((Math.max(a.x, b.x) + M - x0) / c), nz = Math.ceil((Math.max(a.z, b.z) + M - z0) / c);
  if (nx * nz > 40000) { c *= Math.sqrt((nx * nz) / 40000); nx = Math.ceil((Math.max(a.x, b.x) + M - x0) / c); nz = Math.ceil((Math.max(a.z, b.z) + M - z0) / c); }
  const N = nx * nz, g = new Float32Array(N).fill(Infinity), y = new Float32Array(N).fill(NaN), de = new Int32Array(N).fill(-1), cerrado = new Uint8Array(N);
  const cel = (x, z) => Math.max(0, Math.min(nx - 1, Math.floor((x - x0) / c))) + Math.max(0, Math.min(nz - 1, Math.floor((z - z0) / c))) * nx;
  const cx = (k) => x0 + ((k % nx) + 0.5) * c, cz = (k) => z0 + (Math.floor(k / nx) + 0.5) * c;
  const ini = cel(a.x, a.z), fin = cel(b.x, b.z), h = (k) => Math.hypot(cx(k) - b.x, cz(k) - b.z);
  // (montículo binario de [f, k])
  const H = []; const push = (f, k) => { H.push([f, k]); let i = H.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (H[q][0] <= H[i][0]) break; [H[q], H[i]] = [H[i], H[q]]; i = q; } };
  const pop = () => { const r = H[0], u = H.pop(); if (H.length) { H[0] = u; let i = 0; for (;;) { const l = 2 * i + 1, rr = l + 1; let m = i; if (l < H.length && H[l][0] < H[m][0]) m = l; if (rr < H.length && H[rr][0] < H[m][0]) m = rr; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } } return r; };
  g[ini] = 0; y[ini] = a.y; push(GMNB_RUTA.peso * h(ini), ini);
  let mejor = ini, hm = h(ini), nodos = 0;
  const pos = (k) => (k === ini ? v3(a.x, a.y, a.z) : v3(cx(k), y[k], cz(k)));
  const rod = R.paso + 0.08, pecho = Math.max(R.paso + 0.25, Math.min(1.2, R.alto * 0.7));
  while (H.length && nodos < GMNB_RUTA.nodos) {
    const [, k] = pop(); if (cerrado[k]) continue; cerrado[k] = 1; nodos++;
    const hk = h(k); if (hk < hm) { hm = hk; mejor = k; }
    if (k === fin) { mejor = k; break; }
    const ix = k % nx, iz = Math.floor(k / nx), p = pos(k);
    for (let ddz = -1; ddz <= 1; ddz++) for (let ddx = -1; ddx <= 1; ddx++) {
      if (!ddx && !ddz) continue; const jx = ix + ddx, jz = iz + ddz; if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
      const j = jx + jz * nx; if (cerrado[j]) continue;
      const qx = j === fin ? b.x : cx(j), qz = j === fin ? b.z : cz(j), gy = gmnbPiso(qx, p.y, qz, R, ign);
      if (gy === null || gy - p.y > R.paso + 0.02) continue;
      const dx = qx - p.x, dz = qz - p.z, L = Math.hypot(dx, dz); if (L < 1e-4) continue; const ux = dx / L, uz = dz / L;
      let tapa = false;
      // (desde donde está parado o hasta la meta, sólo el rayo del medio: pegado a una pared, los de los costados ya la tocan)
      const lad = k === ini || j === fin ? [0] : [0, -1, 1];
      for (const [hh, lados] of [[rod, lad], [pecho, [0]]]) { for (const sd of lados) { const o = v3(p.x - uz * sd * R.r, p.y + hh, p.z + ux * sd * R.r), e = v3(qx - uz * sd * R.r, gy + hh, qz + ux * sd * R.r), d = vsub(e, o), l = d.len(); if (l > 1e-4 && raycast(o, d.scale(1 / l), l, ign)) { tapa = true; break; } } if (tapa) break; }
      if (tapa) continue;
      const ng = g[k] + L + Math.max(0, gy - p.y) * 2; if (ng >= g[j]) continue;
      g[j] = ng; y[j] = gy; de[j] = k; push(ng + GMNB_RUTA.peso * h(j), j);
    }
  }
  const pts = []; for (let k = mejor; k >= 0 && pts.length < 4000; k = de[k]) pts.push(k === fin ? v3(b.x, y[k], b.z) : pos(k));
  pts.reverse(); if (!pts.length) return null;
  return { pts, llega: mejor === fin, nodos };
}
// tirar del hilo: de cada punto, hacia adelante mientras se llegue derecho (cada prueba son decenas de rayos: así son
// tantas como puntos tiene el camino, no el cuadrado)
function gmnbHilo(pts, R, ign) {
  if (pts.length <= 2) return pts;
  const o = [pts[0]]; let i = 0;
  while (i < pts.length - 1) { let j = i + 1; while (j + 1 < pts.length && gmnbLibre(pts[i], pts[j + 1], R, ign)) j++; o.push(pts[j]); i = j; }
  return o;
}
// Path("Follow" | "Chase"): la recta a la meta si está libre; si no, el camino de la grilla
function gmnbCalcular(p, bot, meta, ent) {
  const a = gmaEntPos(bot), R = gmnbMedidas(bot), ign = gmnbIgnorar(bot, ent), g = gmnbPiso(meta.x, meta.y + 0.2, meta.z, R, ign), b = v3(meta.x, g === null ? meta.y : g, meta.z);
  // (la recta recién comprobada —hace menos de un cuarto de segundo, con el nextbot y la meta casi en el mismo lugar— no
  // se vuelve a comprobar: los addons llaman a Compute cada 0,1 s y cada comprobación son decenas de rayos)
  const reciente = p.ok && p.pts && !p.rodeo && TIEMPO.t - (p.tL || 0) < 0.25 && vsub(p.metaL || b, b).len() < 0.75 && vsub(p.iniL || a, a).len() < 0.75;
  p.meta = b; p.ini = a; p.ok = true; p.llega = true;
  if (reciente) p.pts = [a, b];
  else if (gmnbLibre(a, b, R, ign)) { p.pts = [a, b]; p.rodeo = false; p.tL = TIEMPO.t; p.metaL = b.clone(); p.iniL = a.clone(); }
  else {
    // (el A* no se repite en cada Compute —DrGBase y los clásicos lo piden cada 0,1 s—: si hace menos de medio segundo y la
    // meta se movió poco, el mismo camino con la meta nueva al final)
    const viejo = p.rodeo && p.pts && TIEMPO.t - (p.tA || 0) < GMNB_RUTA.cada && vsub(p.metaA || b, b).len() < 1.5;
    if (viejo) { const q = p.pts.slice(Math.max(1, p.idx || 1)); q.unshift(a); q[q.length - 1] = b; p.pts = q; p.llega = p.llegaA; }
    else {
      const t0 = performance.now(), r = gmnbAEstrella(a, b, R, ign);
      if (r) { p.pts = gmnbHilo(r.pts, R, ign); p.pts[0] = a; p.llega = r.llega; } else { p.pts = [a, b]; p.llega = false; }
      // (cuánto cuesta: cuántas búsquedas, el tiempo medio y el peor, para medirlo)
      const ms = performance.now() - t0, E = GMNB.rutas || (GMNB.rutas = { n: 0, ms: 0, max: 0 }); E.n++; E.ms += ms; E.max = Math.max(E.max, ms);
      p.rodeo = true; p.tA = TIEMPO.t; p.metaA = b.clone(); p.llegaA = p.llega; p.nodos = r ? r.nodos : 0;
    }
  }
  p.idx = 1; p.largos = [0]; for (let i = 1; i < p.pts.length; i++) { const u = p.pts[i - 1], w = p.pts[i]; p.largos.push(p.largos[i - 1] + Math.hypot(w.x - u.x, w.z - u.z)); }
  return p.llega;
}
function gmnbPath() {
  if (!GMNB.mtPath) {
    const M = (GMNB.mtPath = new LuaTable()), I = new LuaTable(); M.set('__index', I); M.set('MetaName', 'PathFollower');
    const P = (n, f) => I.set(n, (p, ...a) => f(p, ...a));
    P('SetMinLookAheadDistance', (p, d) => { p.ver = +d || 0; }); P('GetMinLookAheadDistance', (p) => p.ver);
    P('SetGoalTolerance', (p, d) => { p.tol = +d || 0; }); P('GetGoalTolerance', (p) => p.tol);
    // (devuelve si el camino llega a la meta; si no, igual queda uno hasta lo más cerca, como en GMod)
    P('Compute', (p, bot, pos) => { if (!(pos instanceof LVec) || !(bot instanceof LEnt)) return false; p.t0 = TIEMPO.t; return gmnbSinTiempo(() => gmnbCalcular(p, bot, vG(pos), null)); });
    P('IsValid', (p) => !!p.ok); P('Invalidate', (p) => { p.ok = false; }); P('GetAge', (p) => TIEMPO.t - p.t0);
    const largo = (p) => (p.largos ? p.largos[p.largos.length - 1] : 0);
    P('GetLength', (p) => (p.ok ? largo(p) / GS : 0)); P('GetStart', (p) => GMA.V(p.ini || v3())); P('GetEnd', (p) => GMA.V(p.meta || v3()));
    // (los tramos como los de GMod: posición, tipo —0: por el piso—, distancia desde el principio, largo y hacia dónde va)
    const tramo = (p, i) => {
      const P0 = p.pts || [p.ini || v3(), p.meta || p.ini || v3()], k = Math.max(0, Math.min(P0.length - 1, i)), t = new LuaTable(), w = P0[k], u = P0[Math.max(0, k - 1)], d = v3(w.x - u.x, w.y - u.y, w.z - u.z), L = d.len();
      const dd = p.largos ? p.largos[k] : 0; t.set('pos', GMA.V(w)); t.set('type', 0); t.set('how', 9); t.set('distanceFromStart', dd / GS); t.set('length', dd / GS);
      t.set('forward', GMA.Vd(L > 1e-4 ? vscale(d, 1 / L) : v3(0, 0, 1))); t.set('curvature', 0); t.set('area', gmnbArea(w)); return t;
    };
    const ult = (p) => (p.pts ? p.pts.length - 1 : 1);
    P('GetCurrentGoal', (p) => tramo(p, p.idx || 1)); P('FirstSegment', (p) => tramo(p, 0)); P('LastSegment', (p) => tramo(p, ult(p))); P('NextSegment', (p) => tramo(p, (p.idx || 1) + 1)); P('PriorSegment', (p) => tramo(p, (p.idx || 1) - 1));
    P('GetAllSegments', (p) => { const t = new LuaTable(); for (let i = 0; i <= ult(p); i++) t.a.push(tramo(p, i)); return t; });
    // (lo recorrido: lo que lleva hasta el punto anterior más lo que avanzó en el tramo de ahora)
    const cursor = (p, pos) => { if (!p.pts || !p.largos) return 0; const i = Math.max(1, Math.min(ult(p), p.idx || 1)), u = p.pts[i - 1], w = p.pts[i], dx = w.x - u.x, dz = w.z - u.z, L = Math.hypot(dx, dz) || 1, t = Math.max(0, Math.min(L, ((pos.x - u.x) * dx + (pos.z - u.z) * dz) / L)); return p.largos[i - 1] + t; };
    const enCamino = (p, d) => { if (!p.pts) return p.meta || v3(); for (let i = 1; i < p.pts.length; i++) if (p.largos[i] >= d) { const u = p.pts[i - 1], w = p.pts[i], f = (d - p.largos[i - 1]) / Math.max(1e-6, p.largos[i] - p.largos[i - 1]); return v3(u.x + (w.x - u.x) * f, u.y + (w.y - u.y) * f, u.z + (w.z - u.z) * f); } return p.pts[p.pts.length - 1].clone(); };
    P('GetPositionOnPath', (p, d) => GMA.V(enCamino(p, Math.max(0, +d || 0) * GS)));
    P('GetClosestPosition', (p, pos) => { if (!(pos instanceof LVec) || !p.pts) return GMA.V(p.meta || v3()); const q = vG(pos); let best = null, bd = Infinity; for (let i = 1; i < p.pts.length; i++) { const u = p.pts[i - 1], w = p.pts[i], d = vsub(w, u), L2 = d.lenSq() || 1e-9, t = Math.max(0, Math.min(1, vdot(vsub(q, u), d) / L2)), c = vadd(u, vscale(d, t)), dd = vsub(c, q).lenSq(); if (dd < bd) { bd = dd; best = c; } } return GMA.V(best || p.meta); });
    P('GetCursorPosition', (p) => (p.bot ? cursor(p, gmaEntPos(p.bot)) / GS : 0)); P('GetCursorData', (p) => { const t = new LuaTable(); t.set('pos', GMA.V(p.bot ? gmaEntPos(p.bot) : p.ini || v3())); t.set('forward', GMA.Vd(v3(0, 0, 1))); t.set('curvature', 0); return t; });
    P('ResetAge', (p) => { p.t0 = TIEMPO.t; }); P('MoveCursorToStart', () => {}); P('MoveCursorToEnd', () => {}); P('MoveCursorTo', () => {}); P('MoveCursorToClosestPosition', () => {}); P('MoveCursor', () => {}); P('Draw', () => {}); P('GetHindrance', () => NULL_ENT);
    // seguirlo: la locomoción va hacia el punto de ahora y mira para ahí; al llegar a uno (a su ancho), el siguiente;
    // cerca de la meta, el camino terminó
    const seguir = (p, bot) => {
      if (!p.ok || !(bot instanceof LEnt) || !bot.vivo) return;
      p.bot = bot;
      const pos = gmaEntPos(bot), P0 = p.pts || [pos, p.meta], R = Math.max(0.3, gmnbMedidas(bot).r);
      while ((p.idx || 1) < P0.length - 1) { const w = P0[p.idx || 1]; if (Math.hypot(w.x - pos.x, w.z - pos.z) < R) p.idx = (p.idx || 1) + 1; else break; }
      const w = P0[Math.min(P0.length - 1, p.idx || 1)], d = v3(p.meta.x - pos.x, 0, p.meta.z - pos.z);
      if ((p.idx || 1) >= P0.length - 1 && d.len() <= Math.max(p.tol || 20, 8) * GS) { p.ok = false; return; }
      const l = gmnbLoco(bot).st; l.meta = w.clone(); l.mirar = w.clone(); l.tAp = TIEMPO.t;   // (como su Approach)
    };
    P('Update', (p, bot) => seguir(p, bot));
    P('Chase', (p, bot, ent) => { if (ent instanceof LEnt && ent.vivo && bot instanceof LEnt && (!p.ok || TIEMPO.t - (p.t0 || 0) > 0.1)) { p.t0 = TIEMPO.t; gmnbSinTiempo(() => gmnbCalcular(p, bot, gmaEntPos(ent), ent)); } seguir(p, bot); });
  }
  return { __mt: GMNB.mtPath, ok: false, meta: null, ini: null, t0: 0, tol: 25, ver: 300, pts: null, idx: 1, largos: null };
}
// la API: Path(), métodos de NextBot en las entidades, navmesh de mentira (todo el piso se puede pisar)
function gmnbApi() {
  const R = GMA.R, G = R.G, def = (t, n, f) => t.set(n, f), EM = GMA.metas && GMA.metas.Entity, E = (n, f) => EM && EM.set(n, f);
  def(G, 'Path', () => gmnbPath());
  // (las metatablas de verdad para FindMetaTable: DrGBase cambia PathFollower:Compute para anotar si el camino salió; con
  // una tabla suelta su cambio no llegaba a los caminos, nunca «salía» y todo enemigo le quedaba inalcanzable)
  if (GMA.metas) { gmnbPath(); gmnbArea(v3()); gmnbLoco({}); GMA.metas.PathFollower = GMNB.mtPath.get('__index'); GMA.metas.CLuaLocomotion = GMNB.mtLoco.get('__index'); GMA.metas.CNavArea = GMNB.mtArea.get('__index'); }
  // (y la de los nextbots, «NextBot», que la busca primero cuando el método es de un nextbot y si no tiene uno, el de Entity,
  // como en GMod. DrGBase cambia ahí BodyMoveXY —move_x/move_y y el paso de la animación según la velocidad—, StartActivity
  // y GetActivity: en una tabla suelta sus cambios no llegaban a ningún nextbot. Sin move_x/move_y, los de modelo de jugador
  // corrían con la celda del medio de la mezcla —a_WalkC, caminar en el lugar— y el paso en 1: se deslizaban «caminando
  // muy despacio»)
  if (GMA.metas && GMA.metas.Entity && !GMA.metas.NextBot) { const NB = new LuaTablaLados(), m = new LuaTable(); NB.set('MetaName', 'NextBot'); NB.set('__index', NB); m.set('__index', GMA.metas.Entity); NB.mt = m; GMA.metas.NextBot = NB; }
  E('StartActivity', (e, act) => { e.nbAct = +act || 0; e.nbRate = 1; gmnbSecuencia(e, { act: e.nbAct }); }); E('GetActivity', (e) => e.nbAct || 0);
  // BodyMoveXY como el de GMod: move_x/move_y (y move_yaw) según hacia dónde camina respecto de adónde mira, si el modelo los
  // tiene, y el paso de la animación: velocidad sobre la velocidad de suelo de la secuencia (hasta 10 veces). Antes no hacía
  // nada: las mezclas de caminar quedaban en una celda fija y el paso, siempre en 1
  E('BodyMoveXY', (e) => {
    if (!e.nb) return; const d = gmnbDef(e), L = gmnbLoco(e).st; if (!d || !e.nbSec || !L.suelo) return;
    const v = vSr(L.v), sp = Math.hypot(v.x, v.y); if (sp < 1) return;
    const pp = d.M.poseParams || [], r = Math.atan2(v.y, v.x) - quatAng(entQ(e)).y * Math.PI / 180, P = e.poseVals || (e.poseVals = {});
    if (pp.includes('move_x') || pp.includes('move_y')) { P.move_x = Math.cos(r); P.move_y = -Math.sin(r); }
    if (pp.includes('move_yaw')) P.move_yaw = ((r * 180 / Math.PI) % 360 + 540) % 360 - 180;
    const g = GMF.secVelSuelo(d.M, e.nbSec.i, P) * gmnbEscala(e); if (g > 0.5) e.nbRate = Math.min(10, sp / g);
  });
  E('GetRangeTo', (e, x) => vsub(gmaEntPos(e), x instanceof LEnt ? gmaEntPos(x) : x instanceof LVec ? vG(x) : gmaEntPos(e)).len() / GS);
  E('GetRangeSquaredTo', (e, x) => { const d = vsub(gmaEntPos(e), x instanceof LEnt ? gmaEntPos(x) : x instanceof LVec ? vG(x) : gmaEntPos(e)).len() / GS; return d * d; });
  E('SetFOV', (e, v) => { e.nbFov = +v || 90; }); E('GetFOV', (e) => e.nbFov || 90); E('SetMaxVisionRange', (e, v) => { e.nbVista = +v || 0; }); E('GetMaxVisionRange', (e) => e.nbVista || 1e4);
  E('IsAbleToSee', (e, o) => { if (!(o instanceof LEnt) || !o.vivo) return false; const a = vadd(gmaEntPos(e), v3(0, 1.5, 0)), b = vadd(gmaEntPos(o), v3(0, 1.2, 0)), d = vsub(b, a), l = d.len(); if (l / GS > (e.nbVista || 1e4)) return false; const h = raycast(a, vscale(d, 1 / Math.max(1e-4, l)), l, e.o ? e.o.b : null); return !h || h.t > l - 0.6; });
  E('GetSolidMask', () => 33570827); E('SetSolidMask', () => {}); E('GetLastKnownPosition', (e, o) => GMA.V(o instanceof LEnt ? gmaEntPos(o) : v3()));
  E('BecomeRagdoll', (e) => { gmaQuitar(e); return NULL_ENT; });
  // secuencias del modelo en los nextbots (en lo demás queda lo que había, como las de la vista del arma)
  const envolver = (n, f) => { const orig = EM && EM.get(n); E(n, (e, ...a) => (e.nb ? f(e, ...a) : typeof orig === 'function' ? orig(e, ...a) : undefined)); };
  const sec = (e, s) => gmnbSecuencia(e, typeof s === 'number' ? { idx: s } : { nombre: s });
  // los parámetros de pose del modelo (con los de sus modelos incluidos): move_x/move_y eligen la celda de las mezclas de
  // caminar (gmnbDibujar), y DrGBase los mira para saber si es un modelo de jugador (ACT_HL2MP_*) o de NPC (ACT_IDLE...):
  // antes decían que no había ninguno y un nextbot con modelo de jugador pedía animaciones de NPC y quedaba en pose T
  const pps = (e) => { const d = gmnbDef(e); return (d && d.M.poseParams) || []; };
  const ppNom = (e, n) => (typeof n === 'number' ? pps(e)[n] : String(n == null ? '' : n));
  envolver('GetNumPoseParameters', (e) => pps(e).length);
  envolver('GetPoseParameterName', (e, i) => pps(e)[+i] || '');
  envolver('LookupPoseParameter', (e, n) => { const k = String(n).toLowerCase(); return pps(e).findIndex((x) => String(x).toLowerCase() === k); });
  envolver('GetPoseParameterRange', (e, i) => { const d = gmnbDef(e), r = d && d.M.poseRangos && d.M.poseRangos[+i]; return r ? [r[0], r[1]] : [0, 1]; });
  envolver('SetPoseParameter', (e, n, v) => { const k = ppNom(e, n); if (k) (e.poseVals || (e.poseVals = {}))[k] = +v || 0; });
  envolver('GetPoseParameter', (e, n) => { const k = ppNom(e, n); return (e.poseVals && e.poseVals[k]) || 0; });
  envolver('ClearPoseParameters', (e) => { e.poseVals = {}; });
  // (ResetSequence y ResetSequenceInfo vuelven el paso a 1, como en Source)
  envolver('SetSequence', (e, s) => sec(e, s)); envolver('ResetSequence', (e, s) => { e.nbRate = 1; return sec(e, s); }); envolver('ResetSequenceInfo', (e) => { e.nbRate = 1; });
  envolver('LookupSequence', (e, n) => { const d = gmnbDef(e); if (!d) return [-1, 0]; const i = d.M.secuencias.findIndex((s) => s.n.toLowerCase() === String(n).toLowerCase()); if (i < 0) return [-1, 0]; const a = d.M.anims[d.M.secuencias[i].anim]; return [i, a ? Math.max(0, (a.nf - 1) / (a.fps > 0 ? a.fps : 30)) : 0]; });
  const secDe = (e, i) => (i === undefined || i === null ? (e.nbSec ? e.nbSec.i : -1) : +i), secOk = (d, k) => !!(d && d.M.secuencias[k]);
  envolver('SequenceDuration', (e, i) => { const d = gmnbDef(e), k = secDe(e, i); return secOk(d, k) ? GMF.secDur(d.M, k, e.poseVals) : 0; });
  // la velocidad del nextbot es la de su locomoción (en pulgadas por segundo), como en GMod; antes daba la del cuerpo, que
  // está quieto (lo mueve la locomoción): 0
  envolver('GetVelocity', (e) => GMA.Vr(gmnbLoco(e).st.v));
  // lo que avanzan las secuencias según sus walkframes (GMF.secMov), con los parámetros de pose de ahora: los de DrGBase con
  // UseWalkframes caminan a esa velocidad. Antes era un número fijo (su WalkSpeed o 100): la hormiga león, que corre a 355
  // pulgadas por segundo, iba a 100
  // (mientras el modelo o las animaciones que incluye todavía no llegaron —de la biblioteca o de Steam— y la secuencia de
  // ahora no avanza, lo de antes: su WalkSpeed o 100; si no, uno con UseWalkframes quedaba quieto esperándolas)
  const vsOrig = EM && EM.get('GetSequenceGroundSpeed'), vsAntes = (e, i) => (typeof vsOrig === 'function' ? vsOrig(e, i) : 0);
  // (por la escala del modelo, como Source —CBaseAnimating::GetSequenceGroundSpeed multiplica por GetModelScale—: uno al
  // doble de tamaño da pasos del doble de largo y DrGBase, que pone el paso de la animación en velocidad / esto, no patina)
  envolver('GetSequenceGroundSpeed', (e, i) => { const d = gmnbDef(e), k = secDe(e, i); if (!secOk(d, k)) return vsAntes(e, i); const v = GMF.secVelSuelo(d.M, k, e.poseVals) * gmnbEscala(e); return v > 0 || !(d.M.incFaltan && d.M.incFaltan.size) ? v : vsAntes(e, i); });
  envolver('GetSequenceMoveDist', (e, i) => { const d = gmnbDef(e), k = secDe(e, i); if (!secOk(d, k)) return 0; const m = GMF.secMov(d.M, k, e.poseVals, 0, 1); return m.ok ? Math.hypot(m.p[0], m.p[1], m.p[2]) : 0; });
  envolver('GetSequenceMovement', (e, i, c0, c1) => { const d = gmnbDef(e), k = secDe(e, i); if (!secOk(d, k)) return [false, GMA.nv(0, 0, 0), GMA.A(new LAng(0, 0, 0))]; const m = GMF.secMov(d.M, k, e.poseVals, +c0 || 0, c1 === undefined ? 1 : +c1 || 0); return [m.ok, GMA.nv(m.p[0], m.p[1], m.p[2]), GMA.A(new LAng(0, m.y, 0))]; });
  envolver('GetSequence', (e) => (e.nbSec ? e.nbSec.i : 0)); envolver('SetPlaybackRate', (e, r) => { e.nbRate = +r || 0; }); envolver('GetPlaybackRate', (e) => e.nbRate ?? 1);
  envolver('SetCycle', (e, c) => { if (e.nbSec) e.nbSec.t = (+c || 0) * e.nbSec.dur; }); envolver('GetCycle', (e) => (e.nbSec && e.nbSec.dur > 0 ? (e.nbSec.loop ? (e.nbSec.t / e.nbSec.dur) % 1 : Math.min(1, e.nbSec.t / e.nbSec.dur)) : 0));
  envolver('SelectWeightedSequence', (e, act) => { const d = gmnbDef(e); if (!d) return -1; const L = gmnbSecsDeAct(d.M, act); if (!L.length) return -1; gmnbAlias(e, d.M, L[0], act); return L[0]; });
  envolver('GetSequenceActivity', (e, i) => { if (e.nbAlias && e.nbAlias[+i] !== undefined) return e.nbAlias[+i]; const d = gmnbDef(e), s = d && d.M.secuencias[+i]; return s && s.act ? gmnbNum(String(s.act).toUpperCase()) || -1 : -1; });
  envolver('FrameAdvance', () => {});
  // (las secuencias de una actividad, para elegir una —GMod sortea entre las que tienen esa actividad—; la lista y la
  // cuenta de secuencias, con las que DrGBase busca las suyas: el zombie no encontraba su golpe y nunca atacaba)
  const deAct = (e, act) => { const d = gmnbDef(e); if (!d) return []; const L = gmnbSecsDeAct(d.M, act); for (const i of L) gmnbAlias(e, d.M, i, act); return L; };
  envolver('SelectWeightedSequenceSeeded', (e, act, semilla) => { const L = deAct(e, act); return L.length ? L[Math.abs(Math.floor(+semilla || 0)) % L.length] : -1; });
  envolver('GetSequenceList', (e) => { const d = gmnbDef(e), t = new LuaTable(); if (d) d.M.secuencias.forEach((s, i) => t.set(i, s.n)); return t; });
  envolver('GetSequenceCount', (e) => { const d = gmnbDef(e); return d ? d.M.secuencias.length : 0; });
  envolver('GetSequenceInfo', (e, i) => { const d = gmnbDef(e), s = d && d.M.secuencias[+i]; if (!s) return undefined; const a = d.M.anims[s.anim], t = new LuaTable(); t.set('label', s.n); t.set('activityname', s.act || ''); t.set('activity', s.act ? gmnbNum(String(s.act).toUpperCase()) || -1 : -1); t.set('numframes', a ? a.nf : 1); t.set('fps', a ? a.fps : 30); t.set('flags', s.flags || 0);
    t.set('anims', R.tab((s.grid || [s.anim]).filter((x) => x >= 0))); return t; });   // (y sus animaciones, para GetAnimInfo: DrGBase.AddAnimEvent)
  envolver('GetAnimInfo', (e, i) => { const d = gmnbDef(e), a = d && d.M.anims[+i]; if (!a) return undefined; const t = new LuaTable(); t.set('label', a.n); t.set('fps', a.fps); t.set('numframes', a.nf); return t; });
  envolver('GetAnimCount', (e) => { const d = gmnbDef(e); return d ? d.M.anims.length : 0; });
  // (el nombre y la actividad de una secuencia: DrGBase decide así si la animación que corre es un ataque)
  envolver('GetSequenceName', (e, i) => { const d = gmnbDef(e), s = d && d.M.secuencias[i === undefined ? (e.nbSec ? e.nbSec.i : 0) : +i]; return s ? s.n : 'Unknown'; });
  envolver('GetSequenceActivityName', (e, i) => { const d = gmnbDef(e), s = d && d.M.secuencias[i === undefined ? (e.nbSec ? e.nbSec.i : 0) : +i]; return s && s.act ? String(s.act) : ''; });
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
// (el nombre de una actividad por su número: ACT_HL2MP_RUN_FAST, ACT_MP_WALK...)
const _gmnbActNom = new Map();
function gmnbActNombre(v) {
  if (!_gmnbActNom.size && GMA.R) { const G = GMA.R.G; for (const k of G.claves()) if (typeof k === 'string' && /^ACT_/.test(k)) { const x = G.get(k); if (typeof x === 'number' && !_gmnbActNom.has(x)) _gmnbActNom.set(x, k); } }
  return _gmnbActNom.get(v) || '';
}
// las secuencias de una actividad; si el modelo no tiene ninguna, las de la actividad equivalente (de NPC ↔ de jugador:
// ACT_IDLE ↔ ACT_HL2MP_IDLE, ACT_RUN ↔ ACT_HL2MP_RUN...: la más simple de su clase) y si no, por el nombre. Un nextbot con
// modelo de jugador que todavía no se había bajado cuando arrancó pedía las de NPC y quedaba en pose T
const gmnbClase = (nom) => { nom = String(nom || '').toUpperCase(); if (!nom) return ''; if (/CROUCH|COVER_LOW/.test(nom)) return /WALK|RUN/.test(nom) ? 'cwalk' : 'cidle'; if (/JUMP|GLIDE/.test(nom)) return 'jump'; if (/RELOAD/.test(nom)) return 'reload'; if (/ATTACK|MELEE|RANGE|SHOOT|FIRE/.test(nom)) return 'attack'; if (/RUN/.test(nom)) return 'run'; if (/WALK/.test(nom)) return 'walk'; if (/IDLE/.test(nom)) return 'idle'; return ''; };
function gmnbSecsDeAct(M, act) {
  const L = []; M.secuencias.forEach((s, i) => { if (s.act && gmnbNum(String(s.act).toUpperCase()) === +act) L.push(i); });
  if (L.length) return L;
  const cat = gmnbClase(gmnbActNombre(+act)); if (!cat) return L;
  let mejor = null;
  M.secuencias.forEach((s, i) => { if (!s.act) return; const n = String(s.act).toUpperCase(); if (gmnbClase(n) !== cat) return; if (!mejor || n.length < mejor.a.length) mejor = { a: n, L: [i] }; else if (n === mejor.a) mejor.L.push(i); });
  if (mejor) return mejor.L;
  const re = { idle: /idle|stand/i, walk: /walk/i, run: /run/i, jump: /jump|glide/i, attack: /attack|melee|shoot|fire/i, cidle: /crouch|duck/i, cwalk: /crouch|duck/i, reload: /reload/i }[cat];
  M.secuencias.forEach((s, i) => { if (re && re.test(s.n)) L.push(i); }); return L.slice(0, 8);
}
function gmnbAlias(e, M, i, act) { const s = M.secuencias[i]; if (s && !(s.act && gmnbNum(String(s.act).toUpperCase()) === +act)) { (e.nbAlias || (e.nbAlias = {}))[i] = +act; e.nbAliasN = M.secuencias.length; } }
function gmnbSecuencia(e, q) {
  // (el pedido se guarda si el modelo todavía no llegó —de la biblioteca o de Steam— y se cumple apenas llega, en gmnbPaso.
  // Antes se perdía: los nextbots clásicos piden su animación una sola vez al arrancar —SCP-049, StartActivity al empezar
  // a perseguir— y la persecución entera la hacían en la pose de referencia, deslizándose; y en DrGBase, si la de quieto
  // era la secuencia 0, GetSequence ya daba 0 y nunca la volvía a pedir: Doro quedaba duro)
  const def = gmnbDef(e); if (!def) { e.nbPide = q; e.nbPideN = -1; return 0; }
  const M = def.M;
  const buscar = () => {
    let i = -1;
    if (q.nombre !== undefined) { const n = String(q.nombre).toLowerCase(); i = M.secuencias.findIndex((s) => s.n.toLowerCase() === n); }
    else if (q.idx !== undefined) i = q.idx;
    else if (q.act) { const L = gmnbSecsDeAct(M, q.act); i = L.length ? L[0] : -1; if (i >= 0) gmnbAlias(e, M, i, q.act); }
    return i;
  };
  let i = buscar();
  // (las animaciones de un modelo incluido que llegó recién —de la biblioteca o de Steam—: se suman y se busca otra vez)
  if ((i < 0 || !M.secuencias[i]) && typeof gmIncluidosReintentar === 'function' && gmIncluidosReintentar(M)) i = buscar();
  if (i < 0 || !M.secuencias[i]) { e.nbPide = q; e.nbPideN = M.secuencias.length; return 0; }
  // (una mezcla —las de apuntar de m_anm, swim_idle_pistol del SCP-049— no tiene una animación sola: la de su celda según
  // los parámetros de pose, o la primera que haya. Antes no se ponía ninguna y el nextbot quedaba en la pose de referencia)
  const sq = M.secuencias[i]; let ai = sq.anim;
  if (!M.anims[ai] && sq.grid) { ai = GMF.animDe(M, i, e.poseVals); if (!M.anims[ai]) ai = sq.grid.find((x) => x >= 0 && M.anims[x]); }
  const a = M.anims[ai]; if (!a) { e.nbPide = q; e.nbPideN = M.secuencias.length; return 0; }
  e.nbPide = null;
  e.nbSec = { i, anim: ai, t: 0, loop: sq.loop, dur: Math.max(0, (a.nf - 1) / (a.fps > 0 ? a.fps : 30)) };
  return e.nbSec.dur;
}
// los eventos de la animación que se cruzaron en este paso (de c0 a c1, en ciclos; si da la vuelta, los del final y los
// del principio): a ENT:HandleAnimEvent(evento, tiempo, ciclo, tipo, opciones), como el motor de Source. Los de DrGBase
// (OnAnimEvent) pegan ahí: el zombie golpeaba el aire sin hacer daño
function gmnbEventos(e, S, c0, c1) {
  const def = gmnbDef(e), q = def && def.M.secuencias[S.i]; if (!q || !q.ev || !(c1 > c0)) return;
  const cruza = (c) => (S.loop ? (Math.floor(c1) > Math.floor(c0) ? c > c0 % 1 || c <= c1 % 1 : c > c0 % 1 && c <= c1 % 1) : c > c0 && c <= c1);
  for (const x of q.ev) if (cruza(x.c)) { metodo(e, 'HandleAnimEvent', 'S', x.ev, TIEMPO.t, x.c, x.tipo, x.op || x.n || ''); if (!e.vivo) return; }
}
function gmnbDef(e) {
  const m = String(e.modelo || '').toLowerCase(); if (!m || typeof gmpDef !== 'function') return null;
  if (e.nbDefDe !== m) { e.nbDefDe = m; e.nbDef = gmpDef(m) || null; e.nbMd = null; }
  const d = e.nbDef; if (!d) return null;
  // (y la secuencia que pidió y no estaba, cuando llegan las animaciones)
  if (d.M.incFaltan && d.M.incFaltan.size && typeof gmpDefAlDia === 'function') { const n0 = d.M.secuencias.length; gmpDefAlDia(d); if (d.M.secuencias.length > n0 && e.nbPide) gmnbSecuencia(e, e.nbPide); }
  // (los parámetros de pose que llegaron con un modelo incluido después de que el nextbot arrancó —m_anm.mdl, de la
  // biblioteca o de Steam—: DrGBase los anota una sola vez al crearse y, sin move_x/move_y, nunca los ponía: corría con la
  // celda del medio de la mezcla, deslizándose sin mover las piernas. Se le suman, como si hubieran estado desde el principio)
  const np = d.M.poseParams ? d.M.poseParams.length : 0, t = np && e.tabla ? e.tabla.get('_DrGBasePoseParameters') : null;
  if (t instanceof LuaTable && t.h.size < np) for (const n of d.M.poseParams) if (t.get(n) === undefined) t.set(n, true);
  return d;
}
// cada cuadro: la corrutina, la locomoción y el cuerpo
function gmnbPaso(dt) {
  if (typeof gmAniReintentar === 'function') gmAniReintentar();   // (los .ani que se pidieron y todavía no llegaban)
  gmnbRedPaso(dt);   // (multijugador: los míos a los demás, los de los demás acá)
  for (const e of GMA.ents.values()) {
    if (!e.nb || !e.vivo || e.nbRem) continue;
    // (y los clips de jugador de los mapas del Workshop no lo frenan ni son piso para él: en Source el playerclip frena sólo
    // a los jugadores. Desde la 3.2 esas brochas chocan —gmod_bsp.js— y en los mapas que las usan los nextbots quedaban
    // trabados contra paredes invisibles; igual que con las balas: MUNDO.bala)
    const b0 = MUNDO.bala; GMNB.ambito++; MUNDO.bala = true; try { gmnbPaso1(e, dt); } finally { GMNB.ambito--; MUNDO.bala = b0; }
  }
}
// (lo de un nextbot en un cuadro; mientras corre su Lua, los demás jugadores de la sala existen para él: gmnbRemLista)
function gmnbPaso1(e, dt) {
  // (el modelo que se estaba bajando no llegó en 25 s: la caja, como antes —gmaRehacer—)
  if (e.nbEspera && !e.o && TIEMPO.t - e.nbEspera > 25) { e.nbSinEspera = true; gmaRehacer(e); }
  {
    // (la secuencia pedida antes de que llegaran el modelo o sus animaciones: se pide otra vez cuando hay algo nuevo)
    const d = gmnbDef(e);
    if (d) {
      if (e.nbPide && d.M.secuencias.length !== e.nbPideN) gmnbSecuencia(e, e.nbPide);
      // (las equivalentes que se usaron mientras faltaban las animaciones de un modelo incluido —la «idle» propia del G-Man
      // por ACT_HL2MP_IDLE antes de que llegara m_anm.mdl— dejan de valer cuando llegan: si no, DrGBase creía que ya estaba
      // en esa actividad y nunca pedía la de verdad; la que se está viendo así se pide otra vez por su actividad)
      if (e.nbAlias && e.nbAliasN !== d.M.secuencias.length) { const act = e.nbSec ? e.nbAlias[e.nbSec.i] : undefined; e.nbAlias = null; if (act !== undefined) gmnbSecuencia(e, { act }); }
      // (sin nada pedido, la secuencia 0, como cualquier entidad de Source recién creada: GetSequence ya decía 0 y DrGBase,
      // si su animación de quieto era la 0, no la pedía nunca)
      if (!e.nbSec && !e.nbPide && d.M.secuencias.length) gmnbSecuencia(e, { idx: 0 });
    }
    metodo(e, 'BehaveUpdate', 'S', dt);
    if (!e.vivo) return;
    gmnbMover(e, dt);
    metodo(e, 'BodyUpdate', 'S');
    if (e.nbSec) { const S = e.nbSec, c0 = S.dur > 0 ? S.t / S.dur : 1; S.t += dt * (e.nbRate ?? 1); gmnbEventos(e, S, c0, S.dur > 0 ? S.t / S.dur : 1); }   // (paso 0: quieta, como en GMod)
  }
}
const _nbq = new Quat();
function gmnbMover(e, dt) {
  const L = gmnbLoco(e).st, pos = gmaEntPos(e), v = L.v, ign = e.o ? e.o.b : null;
  // como la locomoción de suelo de GMod (NextBotGroundLocomotion): hacia la meta de este cuadro (Approach) acelera con su
  // Acceleration hasta su DesiredSpeed —o frena con su Deceleration— en la dirección de la meta; lo que va de costado lo
  // frena el roce de costado (3 por segundo, el GetFrictionSideways de Source: dobla con algo de inercia y se endereza en
  // un tercio de segundo); y en el piso, si hace más de 0,25 s que no se le pide moverse, se para en seco. Antes la
  // velocidad entera iba hacia la pedida con la aceleración del addon: para doblar 90° a 650 pulgadas/s con 500 de
  // aceleración tardaba 1,8 s y se pasaba 10 m de largo, y al llegar seguía deslizándose 8 m frenando («resbaladizos»)
  const vh = v3(v.x, 0, v.z), quiereMover = L.tAp !== undefined && TIEMPO.t - L.tAp < 0.25;
  if (L.meta) { const d = vsub(L.meta, pos); d.y = 0; const l = d.len(); if (l > 0.02) L.dirMov = vscale(d, 1 / l), L.distMeta = l; else L.distMeta = 0; }
  if (L.suelo && !quiereMover) { vh.set(0, 0, 0); L.dirMov = null; }
  else if (L.suelo && L.dirMov) {
    const m = L.dirMov, der = v3(m.z, 0, -m.x), fw = vdot(vh, m), sd = vdot(vh, der);
    // (hasta su velocidad, sin pasarse de la meta en este paso)
    const meta = L.meta ? Math.min(L.vel0 * GS, (L.distMeta || 0) / Math.max(dt, 1e-3)) : fw;
    const fw2 = fw < meta ? Math.min(meta, fw + L.acel * GS * dt) : Math.max(meta, fw - L.decel * GS * dt), sd2 = sd * Math.exp(-3 * dt);
    vh.set(m.x * fw2 + der.x * sd2, 0, m.z * fw2 + der.z * sd2);
  }
  v.x = vh.x; v.z = vh.z;
  // contra lo que no puede pasar (a la altura de la rodilla): resbala a lo largo de la pared, como la locomoción de GMod
  // (NextBotGroundLocomotion: choca, saca lo que va contra la pared y sigue con el resto). Antes frenaba en seco y con la
  // pared apenas cruzada se quedaba pegado. Contra una persona (el jugador, un NPC) o un nextbot frena y la toca: su
  // OnContact, como en GMod (DrGBase ve así a quien lo toca)
  const sube = L.paso * GS, R = Math.max(0.25, gmnbMedidas(e).r);
  let hv = Math.hypot(v.x, v.z);
  for (let k = 0; k < 3 && hv > 0.05; k++) {
    const dir = v3(v.x / hv, 0, v.z / hv), r = raycast(vadd(pos, v3(0, sube + 0.1, 0)), dir, hv * dt + R, ign);
    if (!r) break;
    const b = r.body, ent = b ? (b.persona && typeof gmaEntPersona === 'function' ? gmaEntPersona(b.persona) : b.obj && typeof entDeObj === 'function' ? entDeObj(b.obj) : null) : null;
    if (ent instanceof LEnt && ent !== e) gmnbToca(e, L, ent);
    const nx = r.n.x, nz = r.n.z, nl = Math.hypot(nx, nz);
    // (contra una persona —otro jugador, un NPC— o un nextbot: hasta tocarla, casco con casco, y ahí se para. Antes frenaba
    // apenas el rayo la veía, a su ancho más lo que avanza en un cuadro: a 16 m/s y 20 cuadros por segundo, 1,7 m antes; el
    // golpe de Doro —55 pulgadas, 1,4 m— no llegaba a los otros jugadores, que tienen cuerpo. El de uno mismo no tiene)
    if (b && (b.persona || (b.obj && b.obj.gmEnt && b.obj.gmEnt.nb))) { const paso = hv * dt, k = paso > 1e-6 ? Math.max(0, Math.min(1, (r.t - R) / paso)) : 0; v.x *= k; v.z *= k; hv *= k; break; }
    if (nl < 0.3) { v.x = 0; v.z = 0; hv = 0; break; }
    const vn = (v.x * nx + v.z * nz) / nl; if (vn >= 0) break;
    v.x -= (nx / nl) * vn; v.z -= (nz / nl) * vn; hv = Math.hypot(v.x, v.z);
    if (k === 2) { v.x = 0; v.z = 0; hv = 0; }
  }
  // gravedad y piso: rayo para abajo desde la altura de un escalón (y, si venía caminando por el piso, hasta un escalón
  // más abajo: baja las pendientes y los escalones pegado al piso, sin «despegar» en cada bajada)
  const nuevo = vadd(pos, vscale(v, dt)), sueloAntes = L.suelo;
  if (!L.suelo) v.y -= L.grav * GS * dt;
  const h = raycast(vadd(nuevo, v3(0, sube, 0)), v3(0, -1, 0), sube + Math.max(sueloAntes && v.y <= 0.01 ? sube : 0.05, -v.y * dt) + 0.02, ign);
  if (h && v.y <= 0.01) { nuevo.y = nuevo.y + sube - h.t; v.y = 0; L.suelo = true; } else L.suelo = false;
  // (al despegar y al caer, OnLeaveGround y OnLandOnGround, como en GMod: con eso los clásicos ponen la animación de saltar
  // y la de seguir, y DrGBase la de caer y aterrizar. No en el primer contacto con el piso al aparecer)
  if (L.suelo !== L.sueloAviso) { if (L.vioSuelo) metodo(e, L.suelo ? 'OnLandOnGround' : 'OnLeaveGround', 'S', GMA.mundo); L.sueloAviso = L.suelo; }
  if (L.suelo) L.vioSuelo = true;
  if (!e.vivo) return;
  // trabado: quiere ir y no avanza en un segundo (OnStuck); cuando vuelve a avanzar, OnUnStuck
  const anduvo = Math.hypot(nuevo.x - pos.x, nuevo.z - pos.z);
  if (L.meta && anduvo < 0.3 * dt) { L.tTrabado += dt; if (L.tTrabado > 1 && !L.trabado) { L.trabado = true; metodo(e, 'OnStuck', 'S'); if (!e.vivo) return; } }
  else if (anduvo >= 0.3 * dt) { L.tTrabado = 0; if (L.trabado) { L.trabado = false; metodo(e, 'OnUnStuck', 'S'); if (!e.vivo) return; } }
  // mirar: hacia FaceTowards o hacia donde camina, con giro máximo (en grados de Source: x del juego = y de Source)
  const objetivo = L.mirar ? vsub(L.mirar, pos) : hv > 0.1 ? v3(v.x, 0, v.z) : null, a0 = quatAng(entQ(e));
  let yaw = a0.y;
  if (objetivo && Math.hypot(objetivo.x, objetivo.z) > 0.01) { const meta = Math.atan2(objetivo.x, objetivo.z) * 180 / Math.PI, d = ((meta - yaw) % 360 + 540) % 360 - 180, mx = (L.giro || 200) * dt; yaw += Math.max(-mx, Math.min(mx, d)); }
  _nbq.copy(angQuat(new LAng(0, yaw, 0)));
  if (e.o) { const b = e.o.b; b.q.copy(_nbq); gmaOrigenPon(e.o, nuevo, _nbq); b.vel.set(0, 0, 0); b.ang.set(0, 0, 0); b.frozen = true; b.updateWorld && b.updateWorld(); } else { e.pos.copy(nuevo); e.q.copy(_nbq); }
  L.metaAnt = L.meta; L.meta = null; L.mirar = null;
}
// lo que toca el nextbot al caminar: su OnContact (cada cuarto de segundo mientras lo toca, no en cada cuadro)
function gmnbToca(e, L, ent) {
  const T = L.toques || (L.toques = new Map()), t0 = T.get(ent) || -1;
  if (TIEMPO.t - t0 < 0.25) return; T.set(ent, TIEMPO.t); if (T.size > 32) T.clear();
  metodo(e, 'OnContact', 'S', ent);
}
// el modelo animado (si su Draw llama DrawModel o no tiene Draw): en lugar del modelo quieto del cuerpo
function gmnbDibujar(e) {
  const def = gmnbDef(e); if (!def || !e.o || e.o.md.oculto) return false;
  if (!e.nbMd) { e.nbMd = new Modelo(def.arb); e.nbMd.fijo = def.arb.map(() => null); e.nbW = def.arb.map(() => new Float32Array(16)); }
  const md = e.nbMd, A = def.arb, M = def.M, W = e.nbW, s = e.nbSec;
  // (con su escala de modelo —SetModelScale, la ENT.ModelScale de DrGBase—: GMod dibuja los huesos y la malla escalados
  // desde los pies; antes se ignoraba y los que la usan salían de su tamaño sin escalar)
  const org = gmaOrigen(e.o), es = gmnbEscala(e); m4trs([org.x, org.y, org.z], [e.o.b.q.x, e.o.b.q.y, e.o.b.q.z, e.o.b.q.w], [es, es, es], W[0]); md.fijo[0] = W[0];
  let pa = null, pb = null, w = 0;
  // (en una mezcla, la celda según los parámetros de pose; los que no se pusieron valen 0, como en Source. Antes, sin ninguno
  // puesto, la primera celda: en los de modelo de jugador, correr en diagonal para atrás)
  if (s) { const ia = M.secuencias[s.i] && M.secuencias[s.i].grid ? GMF.animDe(M, s.i, e.poseVals) : s.anim, An = M.anims[ia] || M.anims[s.anim], fps = An.fps > 0 ? An.fps : 30, n = Math.max(1, An.nf - 1), fr = s.loop ? (s.t * fps) % n : Math.min(n, s.t * fps), f0 = Math.floor(fr); w = fr - f0; pa = GMF.poseCapas(M, ia, f0); pb = GMF.poseCapas(M, ia, Math.min(An.nf - 1, f0 + 1)); }
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
// ---------------- multijugador: los demás ven tus nextbots, y tus nextbots los persiguen y los matan ----------------
// Cada jugador corre el Lua de sus nextbots, como el servidor de GMod los suyos. Antes los demás no los veían bien —los de
// imagen no se veían; los 3D quedaban quietos en la pose de referencia y saltaban cada 8 s, con el mundo de su dueño— y no
// los perseguían ni los mataban: para el Lua no había otro jugador que uno mismo. Ahora:
//  - el dueño manda 10 veces por segundo los suyos (clase, addon, modelo, dónde están, para dónde miran, la secuencia y su
//    momento, la escala, la piel y, si es una imagen, cuál y de qué tamaño); los demás los ven moverse y animarse: con su
//    propio Lua del lado del cliente si tienen el addon (la imagen, la música de persecución), y si no, con el modelo o la
//    imagen del addon, que se baja de visita (sólo sus archivos, sin su Lua, como el modelo de jugador de otro);
//  - mientras corre el Lua de un nextbot (gmnbPaso, su Think, su Initialize), los demás jugadores de la sala existen para él
//    —player.GetAll, ents.FindInSphere, ents.GetAll…— como jugadores de Lua con lo que hace falta para cazarlos: dónde están,
//    si viven, su vida, su nombre. Lo demás de un jugador, sobre otro, no hace nada (un SetPos o un SetModel de otro jugador
//    no mueve ni cambia al de uno). Fuera del Lua de los nextbots no se ven: los modos de juego siguen como estaban;
//  - lo que el nextbot les pega les llega (con el empujón); lo que uno le pega al de otro le llega a su dueño.
const GMNB_RED = { t: 0, rem: new Map(), jug: new Map(), habia: false, m: null };
const gmnbRedOn = () => typeof RED !== 'undefined' && !!RED.on;
const gmnbR3 = (x) => Math.round((+x || 0) * 1000) / 1000;
// (con el Lua de cero —se sacó o deshabilitó un mod—, lo de antes no va más)
function gmnbRedGen() { if (GMNB_RED.gen !== GMA.gen) { GMNB_RED.gen = GMA.gen; GMNB_RED.jug.clear(); GMNB_RED.rem.clear(); GMNB_RED.m = null; } }
// los jugadores de la sala como jugadores de Lua (sin entrar en GMA.ents: sólo los ve el Lua de los nextbots)
function gmnbRemJugadores(on) {
  gmnbRedGen(); const M = GMNB_RED.jug;
  if (!on) { if (M.size) { for (const e of M.values()) e.vivo = false; M.clear(); } return; }
  for (const R2 of RED.remotos.values()) if (!M.has(R2.id)) gmnbJugRem(R2.id);
  for (const [id, e] of M) { const R2 = RED.remotos.get(id); if (!R2) { e.vivo = false; M.delete(id); } else { e.remoto = R2; e.P = R2.P; } }
}
function gmnbJugRem(id) {
  gmnbRedGen(); let e = GMNB_RED.jug.get(id); if (e) return e;
  const R2 = typeof RED !== 'undefined' && RED.remotos.get(id); if (!R2 || !GMA.R) return null;
  e = new LEnt('player', 'jug'); GMA.ents.delete(e.id); e.remoto = R2; e.P = R2.P; e.nRem = GMNB_RED.jug.size + 2; GMNB_RED.jug.set(id, e);
  // (como un jugador que entra: DrGBase arma ahí su relación con él)
  GMNB.ambito++; try { gmaHook('OnEntityCreated', 'S', e); } finally { GMNB.ambito--; }
  return e;
}
// los que se agregan a las listas del Lua mientras corre el de un nextbot
function gmnbRemLista() {
  if (!GMNB.ambito || !GMNB_RED.jug.size) return [];
  const L = []; for (const e of GMNB_RED.jug.values()) if (e.vivo && e.P && e.P.visible !== false && !e.P.escena) L.push(e);
  return L;
}
// la vida de otro jugador: la que manda él y, por un momento después de un golpe de acá, la que le dejó ese golpe (si
// no, el nextbot no ve que lo lastimó y sigue pegándole o no busca otro)
function gmnbRemVida(e) {
  const R2 = e.remoto, hp = R2 && Number.isFinite(R2.hp) ? R2.hp : 100;
  if (!R2 || !(R2.f & 4)) return 0;
  return e.danoT && TIEMPO.t - e.danoT < 2 ? Math.max(0, Math.min(hp, e.hpEst)) : hp;
}
// los métodos de otro jugador en el Lua (los demás no hacen nada)
function gmnbRemMetodos() {
  if (GMNB_RED.m) return GMNB_RED.m;
  const V = GMA.V, Vr = GMA.Vr, A = GMA.A, E = GMA.metas.Entity, M = new Map(), R2 = (e) => e.remoto;
  const pies = (e) => gmaEntPos(e), ojo = (e) => vadd(pies(e), v3(0, (R2(e).f & 2 ? 28 : 64) * GS, 0)), yaw = (e) => (e.P ? e.P.yaw || 0 : 0);
  const caja = (e) => [new LVec(-16, -16, 0), new LVec(16, 16, R2(e).f & 2 ? 36 : 72)];
  const vec = (v) => { v.__mt = GMA.mtVec; return v; };
  const nom = (e) => String(R2(e).nombre || 'Player'), hsh = (e) => { let h = 7; for (const c of String(R2(e).id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 1e8; };
  Object.entries({
    IsValid: (e) => !!(e.vivo && RED.remotos.has(R2(e).id)), IsPlayer: () => true, IsNPC: () => false, IsNextBot: () => false, IsBot: () => false, IsWorld: () => false, IsWeapon: () => false, IsVehicle: () => false, IsRagdoll: () => false,
    Alive: (e) => gmnbRemVida(e) > 0, Health: (e) => Math.round(gmnbRemVida(e)), GetMaxHealth: () => 100, Armor: () => 0, GetMaxArmor: () => 100,
    GetPos: (e) => V(pies(e)), EyePos: (e) => V(ojo(e)), GetShootPos: (e) => V(ojo(e)), WorldSpaceCenter: (e) => V(vadd(pies(e), v3(0, 36 * GS, 0))),
    GetAngles: (e) => A(quatAng(Quat.axis(0, 1, 0, yaw(e)))), EyeAngles: (e) => A(new LAng(0, quatAng(Quat.axis(0, 1, 0, yaw(e))).y, 0)), GetAimVector: (e) => GMA.Vd(Quat.axis(0, 1, 0, yaw(e)).rot(v3(0, 0, 1))),
    GetForward: (e) => GMA.Vd(Quat.axis(0, 1, 0, yaw(e)).rot(v3(0, 0, 1))), GetVelocity: (e) => Vr(R2(e).vel || v3()), GetAbsVelocity: (e) => Vr(R2(e).vel || v3()),
    OBBMins: (e) => vec(caja(e)[0]), OBBMaxs: (e) => vec(caja(e)[1]), OBBCenter: (e) => GMA.nv(0, 0, caja(e)[1].z / 2), GetCollisionBounds: (e) => { const [a, b] = caja(e); return [vec(a), vec(b)]; },
    GetHull: () => [vec(new LVec(-16, -16, 0)), vec(new LVec(16, 16, 72))], GetHullDuck: () => [vec(new LVec(-16, -16, 0)), vec(new LVec(16, 16, 36))], BoundingRadius: () => 41,
    LocalToWorld: (e, v) => V(pies(e).add(Quat.axis(0, 1, 0, yaw(e)).rot(vGr(v instanceof LVec ? v : new LVec())))), WorldToLocal: (e, v) => Vr(Quat.axis(0, 1, 0, yaw(e)).conj().rot(vsub(vG(v instanceof LVec ? v : new LVec()), pies(e)))),
    NearestPoint: (e, p) => { if (!(p instanceof LVec)) return V(pies(e)); const q = vSr(vsub(vG(p), pies(e))), [a, b] = caja(e); return V(vadd(pies(e), vGr(new LVec(Math.max(a.x, Math.min(b.x, q.x)), Math.max(a.y, Math.min(b.y, q.y)), Math.max(a.z, Math.min(b.z, q.z)))))); },
    Nick: nom, Name: nom, GetName: nom, SteamID: (e) => 'STEAM_0:1:' + hsh(e), SteamID64: (e) => '7656119' + String(8e9 + hsh(e)), UniqueID: (e) => hsh(e), AccountID: (e) => hsh(e), UserID: (e) => e.nRem, EntIndex: (e) => e.nRem,
    GetClass: () => 'player', Team: () => 1001, GetModel: () => 'models/player/kleiner.mdl', GetModelScale: () => 1, GetSkin: () => 0, GetTable: (e) => e.tabla,
    OnGround: (e) => !!(R2(e).f & 1), IsOnGround: (e) => !!(R2(e).f & 1), Crouching: (e) => !!(R2(e).f & 2), InVehicle: (e) => !!R2(e).veh, GetVehicle: () => NULL_ENT, GetActiveWeapon: () => NULL_ENT, GetWeapons: () => new LuaTable(),
    WaterLevel: () => 0, GetMoveType: () => 2, GetObserverMode: () => 0, GetNoTarget: () => false, IsFlagSet: () => false, GetFlags: (e) => (R2(e).f & 1 ? 1 : 0) | (R2(e).f & 2 ? 2 : 0), KeyDown: () => false, IsAdmin: () => false, IsSuperAdmin: () => false,
    IsListenServerHost: () => false, IsFrozen: () => false, Ping: () => 50, Frags: () => 0, Deaths: () => 0, GetRunSpeed: () => 400, GetWalkSpeed: () => 200, GetCreationID: (e) => e.id, MapCreationID: () => -1,
    // (lo que en GMod mira si hay algo en el medio)
    Visible: (e, o) => { if (!(o instanceof LEnt)) return false; const a = ojo(e), b = vadd(gmaEntPos(o), v3(0, 0.6, 0)), d = vsub(b, a), l = d.len(); const h = l > 1e-3 ? raycast(a, vscale(d, 1 / l), l, R2(e).b) : null; return !h || h.t > l - 0.4; },
    IsLineOfSightClear: (e, x) => { const b = x instanceof LEnt ? vadd(gmaEntPos(x), v3(0, 0.6, 0)) : x instanceof LVec ? vG(x) : null; if (!b) return false; const a = ojo(e), d = vsub(b, a), l = d.len(); return !(l > 1e-3 && raycast(a, vscale(d, 1 / l), l, R2(e).b)); },
    // (el daño y el empujón le llegan a él: gmnbRemDanar)
    TakeDamage: (e, d, at, inf) => gmaDanar(e, +d || 0, at, inf), TakeDamageInfo: (e, di) => gmaDanar(e, (di && di.dan) || 0, di && di.at, di && di.inf, di),
    // (matarlo o empujarlo, sólo desde el Lua de un nextbot: lo de uno a otro jugador va con PvP, por gmnbRemDanar)
    Kill: (e) => { if (GMNB.ambito) gmnbRemDanar(e, { dan: 1e6, at: NULL_ENT, inf: NULL_ENT }, true); }, KillSilent: (e) => { if (GMNB.ambito) gmnbRemDanar(e, { dan: 1e6, at: NULL_ENT, inf: NULL_ENT }, true); },
    SetVelocity: (e, v) => { if (GMNB.ambito && v instanceof LVec) gmnbRemEmpujar(e, vGr(v)); },
  }).forEach(([k, f]) => M.set(k, f));
  // (de los de Entity, los que sólo leen o suenan: con dónde está él)
  for (const k of ['EmitSound', 'StopSound', 'GetRight', 'GetUp', 'GetNWBool', 'GetNWInt', 'GetNWFloat', 'GetNWString', 'GetNWEntity', 'GetNWVector', 'GetNWAngle', 'GetNW2Bool', 'GetNW2Int', 'GetNW2Float', 'GetNW2String', 'GetNW2Entity', 'GetNW2Vector', 'GetNW2Angle', 'GetNetworkedBool', 'GetNetworkedInt', 'GetNetworkedString', 'GetNetworkedEntity', 'CallOnRemove', 'RemoveCallOnRemove', 'GetBoneCount', 'LookupBone', 'GetAttachment', 'LookupAttachment']) { const f = E.get(k); if (typeof f === 'function' && !M.has(k)) M.set(k, f); }
  M.set('GetBonePosition', (e) => [V(vadd(pies(e), v3(0, 1.2, 0))), A(new LAng(0, 0, 0))]);
  return (GMNB_RED.m = M);
}
const _gmnbNada = () => undefined, _gmnbNo = () => false, _gmnbNulo = () => NULL_ENT;
// el __index de otro jugador (gmod_api.js: EM): lo suyo; de los métodos del motor, los de gmnbRemMetodos y, los demás, uno
// que no hace nada (un SetPos o un StripWeapons de otro no le toca nada al de uno; un GetWeapon da NULL, como sin el arma);
// lo que los addons les agregan a los jugadores —FindMetaTable("Player").X = function…— corre igual: es su Lua, con él
function gmnbRemIndice(e, k) {
  const T0 = GMA.ctx === 'C' ? e.tablaC || e.tabla : e.tabla; const v = T0.get(k); if (v !== undefined) return v;
  if (typeof k !== 'string') return undefined;
  const f = gmnbRemMetodos().get(k); if (f) return f;
  const nat = GMNB_RED.nativos, pm = GMA.metas.Player.get(k), em = GMA.metas.Entity.get(k);
  if (nat && (nat.P.has(k) || nat.E.has(k))) return /^(Is|Has|Can|Should)/.test(k) ? _gmnbNo : /^Get(Weapon|ActiveWeapon|Vehicle|GroundEntity|ObserverTarget|RagdollEntity|Hands|ViewModel|Owner|Parent|Driver|Enemy)$/.test(k) ? _gmnbNulo : _gmnbNada;
  if (typeof pm === 'function') return pm;
  if (typeof em === 'function') return em;
  return undefined;
}
// (los métodos del motor, antes de que corra el Lua de los addons: lo que se agregue después es de ellos)
function gmnbNativos() { if (GMA.metas) GMNB_RED.nativos = { P: new Set(GMA.metas.Player.claves()), E: new Set(GMA.metas.Entity.claves()) }; }
// el Lua le pegó a otro jugador: si fue un nextbot (o su Lua), le llega como golpe de nextbot —también sin PvP, como en
// GMod, donde los NPC matan a todos—; si no (uno mismo, su arma, una entidad de uno), como siempre: sólo con PvP
function gmnbRemDanar(e, di, siempre) {
  const R2 = e.remoto, dan = Math.max(0, +di.dan || 0); if (!R2 || !(dan > 0) || !gmnbRedOn()) return;
  const at = di.at, inf = di.inf, mio = !siempre && !GMNB.ambito && !(at instanceof LEnt && at.nb) && !(inf instanceof LEnt && inf.nb);
  const de = at instanceof LEnt && at.vivo && at.tipo !== 'null' ? gmaEntPos(at) : inf instanceof LEnt && inf.vivo && inf.tipo !== 'null' ? gmaEntPos(inf) : null, dir = de ? vsub(gmaEntPos(e), de) : v3(0, 0, 1); dir.y = 0; if (dir.lenSq() < 1e-6) dir.set(0, 0, 1); dir.norm();
  if (mio) { if (typeof redDano === 'function' && R2.P) redDano(R2.P, dan, dir); return; }
  e.hpEst = Math.max(0, (e.danoT && TIEMPO.t - e.danoT < 2 ? e.hpEst : gmnbRemVida(e)) - dan); e.danoT = TIEMPO.t;
  publicar('a', { k: 'gnbd', to: R2.id, d: Math.round(Math.min(dan, 1e6)), v: [gmnbR3(dir.x), gmnbR3(dir.y), gmnbR3(dir.z)], c: at instanceof LEnt ? String(at.claseNom || at.clase).slice(0, 40) : '' });
}
function gmnbRemEmpujar(e, v) {
  const R2 = e.remoto; if (!R2 || !gmnbRedOn()) return; const l = v.len(); if (!(l > 0.05)) return; if (l > 40) v.scale(40 / l);
  publicar('a', { k: 'gnbv', to: R2.id, v: [gmnbR3(v.x), gmnbR3(v.y), gmnbR3(v.z)] });
}
// ---- el dueño: manda los suyos ----
function gmnbRedPaso(dt) {
  const on = gmnbRedOn();
  gmnbRemJugadores(on);
  if (!on) { for (const [k, X] of [...GMNB_RED.rem]) gmnbTitereQuitar(k, X); GMNB_RED.habia = false; return; }
  gmnbTiteresPaso();
  if ((GMNB_RED.t -= dt) > 0) return; GMNB_RED.t = 0.1;
  const l = [], R3 = gmnbR3;
  for (const e of GMA.ents.values()) {
    if (!e.nb || !e.vivo || e.nbRem || !e.creado || l.length >= 24) continue;
    const c = GMA.clases.get(e.clase), w = c && c.addon && c.addon.id, wid = /^\d{3,12}$/.test(String(w)) ? String(w) : '';
    const p = gmaEntPos(e), y = quatAng(entQ(e)).y, S = e.nbSec, pv = e.poseVals || {}, sp = e.nbSpr && TIEMPO.t - e.nbSpr.t < 1 ? e.nbSpr : null;
    l.push([e.id, String(e.clase).slice(0, 64), wid, String(e.modelo || '').slice(0, 160), R3(p.x), R3(p.y), R3(p.z), Math.round(y * 10) / 10, S ? S.i : -1, S ? R3(S.t) : 0, R3(e.nbRate ?? 1),
      R3(gmnbEscala(e)), +e.skin || 0, R3(pv.move_x), R3(pv.move_y), sp ? [String(sp.mat).slice(0, 120), R3(sp.dz), R3(sp.w), R3(sp.h)] : 0, e.noDraw ? 1 : 0]);
  }
  if (l.length || GMNB_RED.habia) publicar('a', { k: 'gnb', t: Math.round(TIEMPO.t * 1000) / 1000, l });   // (con la hora de mi juego: los demás lo dibujan entre dos muestras)
  GMNB_RED.habia = l.length > 0;
}
// ---- lo que llega ----
function gmnbRedRecibir(d) {
  if (!d || typeof d.k !== 'string' || typeof d.i !== 'string') return;
  if (d.k === 'gnb') { if (Array.isArray(d.l)) gmnbTiteres(d.i, d.l, num(d.t, 0, 1e9, 0)); return; }
  if (d.to !== RED.ID) return;
  const vec = (a, m) => (Array.isArray(a) ? v3(num(a[0], -m, m, 0), num(a[1], -m, m, 0), num(a[2], -m, m, 0)) : null);
  if (d.k === 'gnbd') {
    // (el nextbot de otro me pegó)
    if (!JUG.vivo || (typeof SALA !== 'undefined' && SALA && SALA.nb === 0)) return;
    const dan = num(d.d, 0, 1e6, 0), dir = vec(d.v, 1); if (!(dan > 0)) return;
    danarJugador(dan, null);
    if (dir && JUG.vivo) JUG.vel.addS(dir, Math.min(6, dan * 0.05));
  } else if (d.k === 'gnbv') {
    const v = vec(d.v, 40); if (v && JUG.vivo && !JUG.vehiculo) JUG.vel.add(v);
  } else if (d.k === 'gnbg') {
    // (le pegaron a uno de mis nextbots: se lo pega el otro jugador, como si estuviera acá)
    const e = GMA.ents.get(d.n | 0); if (!e || !e.nb || e.nbRem || !e.vivo) return;
    const at = gmnbJugRem(d.i) || NULL_ENT; GMNB.ambito++; try { gmaDanar(e, num(d.d, 0, 1e5, 0), at, at); } finally { GMNB.ambito--; }
  }
}
// ---- los de los demás: títeres ----
function gmnbTiteres(de, l, rt) {
  if (!GMA.R) gmaIniciar();
  if (!GMA.activo) GMA.activo = true;   // (sin addons propios el Lua no corría: los de los demás igual se ven)
  gmnbRedGen(); const vivos = new Set(), ahora = performance.now() / 1000;
  for (const x of l.slice(0, 24)) {
    if (!Array.isArray(x) || x.length < 12) continue;
    const key = de + '/' + (x[0] | 0); vivos.add(key);
    let X = GMNB_RED.rem.get(key);
    const clase = String(x[1] || '').slice(0, 64), modelo = String(x[3] || '').toLowerCase().replace(/\\/g, '/').slice(0, 160);
    if (X && (X.clase !== clase || X.modelo !== modelo)) { gmnbTitereQuitar(key, X); X = null; }
    if (!X) { X = gmnbTitere(de, key, clase, String(x[2] || ''), modelo); if (!X) continue; }
    X.t = TIEMPO.t; X.esc = num(x[11], 0.01, 100, 1); X.skin = x[12] | 0; X.mx = num(x[13], -2, 2, 0); X.my = num(x[14], -2, 2, 0);
    X.spr = Array.isArray(x[15]) && typeof x[15][0] === 'string' ? x[15] : null; X.oculto = x[16] === 1;
    // (la muestra, con la hora del juego del dueño: se lo dibuja un poco atrás, entre dos muestras, como a los demás
    // jugadores —remotoMuestra—; así va parejo aunque los mensajes lleguen a destiempo)
    const m = { rt, p: v3(num(x[4], -1e5, 1e5, 0), num(x[5], -1e5, 1e5, 0), num(x[6], -1e5, 1e5, 0)), yaw: num(x[7], -1e4, 1e4, 0), sec: x[8] | 0, ciclo: num(x[9], 0, 1e6, 0), rate: num(x[10], -20, 20, 1), lleg: ahora };
    const L = X.mm, u = L[L.length - 1];
    if (u && rt <= u.rt) { if (rt < u.rt - 2) { L.length = 0; X.rr = undefined; X.H.length = 0; } else continue; }   // (repetida o vieja; muy atrás: recargó)
    const H = X.H; H.push([rt, ahora]); while (H.length > 2 && ahora - H[0][1] > 2.5) H.shift();
    const sH = H[H.length - 1][1] - H[0][1]; X.rit = sH > 0.5 ? clamp((H[H.length - 1][0] - H[0][0]) / sH, 0.05, 1.5) : 1;
    if (u) { const dR = rt - u.rt, dA = (ahora - u.lleg) * (X.rit < 0.8 ? X.rit : 1); if (dR < 0.5) X.int = X.int ? X.int + (dR - X.int) * 0.15 : dR; if (dR < 2) X.jit = (X.jit || 0) + (Math.abs(dA - dR) - (X.jit || 0)) * 0.15; }
    if (u && vsub(m.p, u.p).len() > 12) { L.length = 0; X.rr = undefined; }   // (un salto grande —un SetPos—: va de una)
    L.push(m); if (L.length > 16) L.shift();
    // (cuánto atrás: lo que tardan en llegar dos seguidas y lo que varía, como a los jugadores —con menos atraso hay que
    // adivinar más y en cada giro se lo veía hasta 3 m corrido—; sin la siguiente, sigue con su velocidad hasta 0,2 s)
    const D = clamp((X.int || 0.1) * 1.15 + 2.5 * (X.jit || 0), 0.1, 0.5);
    if (X.rr === undefined || L.length === 1) { X.rr = rt - D; X.rrErr = 0; X.mmT = ahora; }
    else { X.rrErr = rt - X.rr - D; if (Math.abs(X.rrErr) > 0.75) { X.rr = rt - D; X.rrErr = 0; } }
  }
  for (const [k, X] of [...GMNB_RED.rem]) if (X.de === de && !vivos.has(k)) gmnbTitereQuitar(k, X);
}
function gmnbTitere(de, key, clase, wid, modelo) {
  if (!clase) return null;
  const c = GMA.clases.get(clase), conClase = !!(c && (c.C || c.S));
  const e = new LEnt(conClase ? clase : 'gmnb_remoto', 'ent'); e.claseNom = clase;
  const X = { de, key, clase, wid, modelo, e, mm: [], H: [], pos: v3(), t: TIEMPO.t, esc: 1, skin: 0, mx: 0, my: 0, spr: null, oculto: false, conClase };
  e.nbRem = X; e.nb = true; e.creado = true; e.dtListo = true; e.mov = 0; e.modelo = modelo;
  GMNB_RED.rem.set(key, X);
  if (conClase) {
    // (con el addon: lo suyo del lado del cliente —NetworkVars e Initialize—, como lo que ve un jugador en GMod)
    GMNB.ambito++; try { if (c.S) metodo(e, 'SetupDataTables', 'S'); if (c.C && c.C !== c.S) metodo(e, 'Initialize', 'C'); } catch (x) {} finally { GMNB.ambito--; }
  }
  if (modelo) gmaRehacer(e);
  // (sin el addon: de visita, sólo sus archivos —el modelo, la imagen—; al llegar se arma)
  // (y lo que se dibujó antes de que llegara —la imagen, que quedó en blanco— se vuelve a cargar: gmlLlegaron)
  if (/^\d{3,12}$/.test(wid) && typeof gmVisita === 'function' && !GMOD.addons.has(wid)) gmVisita(wid).then((A) => { if (!A) return; try { if (typeof gmlLlegaron === 'function') gmlLlegaron([...A.G.archivos.keys()]); } catch (x) {} if (e.vivo && e.modelo) { e.nbDefDe = null; gmaRehacer(e); } });
  return X;
}
function gmnbTitereQuitar(key, X) {
  GMNB_RED.rem.delete(key); const e = X.e; if (!e.vivo) return; e.vivo = false;
  const c = GMA.clases.get(e.clase); if (X.conClase && c && c.C && c.C !== c.S && c.C.get('OnRemove')) { try { metodo(e, 'OnRemove', 'C'); } catch (x) {} }
  if (e.o) { GMA.entPorObj.delete(e.o); if (!e.o.borrado) borrarObjeto(e.o, true); e.o = null; }
  GMA.ents.delete(e.id);
}
// cada cuadro: donde estaba en el juego de su dueño un momento atrás (entre las dos muestras de ese momento; sin la que
// sigue, con su velocidad hasta 0,2 s), mirando para donde miraba y en ese momento de su animación
function gmnbTiteresPaso() {
  const ahora = performance.now() / 1000;
  for (const [key, X] of [...GMNB_RED.rem]) {
    const e = X.e, L = X.mm;
    if (!e.vivo || TIEMPO.t - X.t > 3 || !RED.remotos.has(X.de)) { gmnbTitereQuitar(key, X); continue; }
    if (!L.length) continue;
    const dtr = clamp(ahora - (X.mmT || ahora), 0, 0.5); X.mmT = ahora;
    X.ritS = (X.ritS || 1) + (((X.rit || 1) < 0.8 ? X.rit : 1) - (X.ritS || 1)) * Math.min(1, dtr * 1.5);
    const adv = dtr * X.ritS * (1 + clamp((X.rrErr || 0) * 0.6, -0.6, 0.25));
    X.rr = Math.min(X.rr + adv, L[L.length - 1].rt + 0.2); X.rrErr = (X.rrErr || 0) - (adv - dtr * X.ritS);
    while (L.length > 2 && L[1].rt <= X.rr) L.shift();
    const a = L[0], b = L[1], rr = X.rr; let s = a, yaw = a.yaw;
    if (!b || rr >= b.rt) {
      const u = b || a, w = b ? a : null, ex = clamp(rr - u.rt, 0, 0.2);
      if (w && u.rt > w.rt) { const k = ex / (u.rt - w.rt); X.pos.set(u.p.x + (u.p.x - w.p.x) * k, u.p.y + (u.p.y - w.p.y) * k, u.p.z + (u.p.z - w.p.z) * k); } else X.pos.copy(u.p);
      s = u; yaw = u.yaw;
    } else if (rr <= a.rt) X.pos.copy(a.p);
    else {
      const f = (rr - a.rt) / (b.rt - a.rt); X.pos.set(a.p.x + (b.p.x - a.p.x) * f, a.p.y + (b.p.y - a.p.y) * f, a.p.z + (b.p.z - a.p.z) * f);
      yaw = a.yaw + ((((b.yaw - a.yaw) % 360) + 540) % 360 - 180) * f;
    }
    const q = angQuat(new LAng(0, yaw, 0));
    e.escala = X.esc; e.skin = X.skin; e.noDraw = X.oculto;
    if (e.o) {
      const bd = e.o.b; bd.q.copy(q); gmaOrigenPon(e.o, X.pos, q); bd.vel.set(0, 0, 0); bd.ang.set(0, 0, 0); bd.frozen = true; bd.noJug = true; bd.noGrab = true; if (bd.updateWorld) bd.updateWorld();
      e.o.remoto = true; e.o.key = 'gnb:' + key;   // (no es mío: no va en mi mundo)
    } else { e.pos.copy(X.pos); e.q.copy(q); }
    // (la secuencia de ese momento y por dónde iba: la de la muestra, adelantada con su paso)
    const d = s.sec >= 0 ? gmnbDef(e) : null;
    if (d && d.M.secuencias[s.sec]) {
      if (!e.nbSec || e.nbSec.i !== s.sec) gmnbSecuencia(e, { idx: s.sec });
      if (e.nbSec) e.nbSec.t = s.ciclo + Math.max(0, rr - s.rt) * s.rate;
      const pv = e.poseVals || (e.poseVals = {}); pv.move_x = X.mx; pv.move_y = X.my;
    }
  }
}
// el dibujo de uno de otro sin su addon (gmod_render.js): su modelo animado o su imagen, mirando a los ojos como la dibujan
// los de la base de Sanic (inclinada un tercio hacia arriba)
function gmnbRemDibujar(e) {
  const X = e.nbRem; if (!X || e.noDraw) { if (e.o) e.o.md.oculto = true; return; }
  if (e.o) { e.o.md.oculto = false; e.o.md.color = null; if (gmnbDef(e)) gmnbDibujar(e); return; }
  if (!X.spr) return;
  const [mat, dz, w, h] = X.spr, rq = GMA.R && GMA.R.G.get('render'), dq = rq && rq.get('DrawQuadEasy'); if (typeof dq !== 'function') return;
  const p = vadd(gmaEntPos(e), v3(0, (+dz || 0) * GS, 0)), n = vsub(CAM.pos, p), nl = n.len() || 1, hz = Math.hypot(n.x, n.z) || 1, pit = Math.acos(Math.max(-1, Math.min(1, hz / nl))) / 3;
  const nn = v3((n.x / hz) * Math.cos(pit), Math.sin(pit), (n.z / hz) * Math.cos(pit));
  // (hasta que llega su textura —del addon de visita, unos segundos— no se dibuja: si no, era un cuadrado blanco)
  const m = gmaMaterial(String(mat)); if (!m.ok) return; GR.mat = m; GR.entAct = e;
  dq(GMA.V(p), GMA.Vd(nn), +w || 64, +h || 64, undefined, 180);
}
// (lo que dibuja uno mío que es una imagen: el material y el tamaño, para los que no tienen su addon. Desde gmod_render.js)
function gmnbAnotarImagen(e, P, w, h) {
  if (!e || !e.nb || e.nbRem || !GR.mat || !GR.mat.n) return;
  const dz = (P.y - gmaEntPos(e).y) / GS, x = e.nbSpr;
  if (x && x.t === TIEMPO.t && x.w * x.h >= w * h) return;   // (la más grande del cuadro)
  e.nbSpr = { mat: GR.mat.n, dz, w, h, t: TIEMPO.t };
}
// (uno de otro al que le pego: le llega a su dueño, que es el que lo mueve)
function gmnbTitereGolpe(e, di) {
  const X = e.nbRem; if (!X || !gmnbRedOn()) return;
  publicar('a', { k: 'gnbg', to: X.de, n: +X.key.split('/')[1] | 0, d: Math.round(Math.min(1e5, Math.max(0, +di.dan || 0))) });
}
if (typeof module !== 'undefined') module.exports = { gmnbLoco, gmnbPath, gmnbApi, gmnbPaso, gmnbEs, gmnbDibujar, gmnbRedRecibir, gmnbRemIndice, gmnbRemLista, gmnbJugRem, gmnbRemDanar };
