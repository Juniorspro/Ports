// ---------------- puertas de los mapas de GMod (func_door, func_door_rotating, func_movelinear, prop_door_rotating) ----------------
// El lector de mapas (gmod_bsp.js) deja cada puerta en su pieza, con su eje y sus datos (gbspPuertaDe). Acá: su estado
// (cerrada → abriéndose → abierta → cerrándose), su caja de choque que se mueve con ella, «E: abrir» al mirarla, abrirse
// sola al tocarla si el mapa lo pide, no cerrarse encima de nadie y, en una sala, que todos la vean igual.
const PUERTAS = { l: [], bot: [], zona: [] };
function puertasIniciar() {
  PUERTAS.l = [];
  // (los botones y las zonas del mapa que abren puertas: gmod_bsp los lee de las salidas de Source)
  const aj = (typeof DATA !== 'undefined' && DATA.aj && DATA.aj[MUNDO.nombre]) || {};
  PUERTAS.bot = (aj.ptaBot || []).map((b) => ({ lo: v3(...b.c[0]), hi: v3(...b.c[1]), lo0: v3(...b.c[0]), hi0: v3(...b.c[1]), sal: b.sal || { p: [], i: [], o: [], l: [] }, tog: b.tog, bloq: b.bloq, n: b.n || '', pa: b.pa || '', est: 0 }));
  PUERTAS.zona = (aj.ptaZona || []).map((z) => ({ lo: v3(...z.c[0]), hi: v3(...z.c[1]), en: z.en, sa: z.sa, una: z.una, n: z.n || '', off: !!z.off, dentro: false, hecha: false }));
  PUERTAS.caminos = new Map(); for (const c of aj.caminos || []) PUERTAS.caminos.set(c.n, { n: c.n, p: v3(c.p[0], c.p[1], c.p[2]), sig: c.sig, alt: c.alt, altOn: false, off: !!(c.sf & 1), sal: c.sal || [], vel: c.vel || 0, sf: c.sf || 0 });
  for (const md of MUNDO.modelos) {
    const x = md.A && md.A[0]; if (!x || !x.puerta) continue;
    const P = x.puerta, piv = v3(x.p[0], x.p[1], x.p[2]), q0 = new Quat(x.r[0], x.r[1], x.r[2], x.r[3]);
    if (P.tren) { trenNuevo(md, P, piv, q0); continue; }
    const L = []; for (let k = 0; k + 2 < (P.casco || []).length; k += 3) L.push(v3(P.casco[k], P.casco[k + 1], P.casco[k + 2]));
    let lo = v3(1e9, 1e9, 1e9), hi = v3(-1e9, -1e9, -1e9); for (const p of L) { lo.set(Math.min(lo.x, p.x), Math.min(lo.y, p.y), Math.min(lo.z, p.z)); hi.set(Math.max(hi.x, p.x), Math.max(hi.y, p.y), Math.max(hi.z, p.z)); }
    const D = { i: PUERTAS.l.length, md, P, piv, q0, k: P.abierta ? 1 : 0, meta: P.abierta ? 1 : 0, sentido: P.sentido || 1, t: 0, b: null, c: v3() };
    // (lo que gira —func_rotating—: su ángulo, si está andando, para qué lado y a qué parte de su velocidad)
    if (P.rot) { D.ang = 0; D.on = !!P.arranca; D.dirRot = P.rev ? -1 : 1; D.velK = 1; D.velAct = 0; }
    // (la puerta que se corre, como en Source: lo que mide en su dirección, menos 2 unidades y menos el "lip"; con un lip
    // más grande que la puerta, se corre para el otro lado —los ascensores de los mapas de HL2—)
    if (!P.giro) {
      const d = v3(P.dir[0], P.dir[1], P.dir[2]); let mn = 1e9, mx = -1e9;
      const pts = P.caja ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => v3(P.caja[i & 1][0], P.caja[(i >> 1) & 1][1], P.caja[(i >> 2) & 1][2])) : L;
      for (const p of pts) { const s = vdot(q0.rot(p), d); mn = Math.min(mn, s); mx = Math.max(mx, s); }
      D.recorrido = P.distM !== undefined ? P.distM : mx > mn ? mx - mn - 2 * GM_S - P.lip : 0; D.dir = d;
    }
    else D.eje = v3(P.eje[0], P.eje[1], P.eje[2]);
    if (L.length >= 4 && P.solida) {
      try {
        const h = hullDePuntos(L), b = new Body(h.shape, 0); D.c.copy(h.c); b.estatico = true; b.snd = /metal/i.test(md.A[0].n) ? 'metal' : 'wood'; b.puerta = D; D.b = b;
        puertaPoner(D);
        // (en la grilla de choques por todo lo que barre al moverse: cerrada y abierta)
        const A0 = Object.assign({}, b.aabb); D.k = 1 - D.k; puertaPoner(D); const A1 = b.aabb; D.k = 1 - D.k; puertaPoner(D);
        MUNDO.cajas.push(b); grillaAgregar(Math.min(A0.x0, A1.x0) - 0.3, Math.min(A0.z0, A1.z0) - 0.3, Math.max(A0.x1, A1.x1) + 0.3, Math.max(A0.z1, A1.z1) + 0.3, b);
      } catch (e) { D.b = null; }
    }
    PUERTAS.l.push(D); puertaPoner(D);
  }
  // (las puertas pegadas a un tren —con "parentname"— se corren con él)
  for (const D of PUERTAS.l) if (D.P.tren && D.P.nombre) { const n = String(D.P.nombre).toLowerCase(); for (const X of PUERTAS.l) if (X !== D && !X.P.tren && String(X.P.padre || '').toLowerCase() === n) { X.trenPadre = D; puertaPoner(X); } }
  // (las puertas dobles: dos hojas con el mismo nombre una al lado de la otra —o la que el mapa dice con "slavename"—
  // se abren juntas, si no una sola hoja no deja pasar)
  for (const D of PUERTAS.l) {
    const n = String(D.P.nombre || '').toLowerCase(), es = String(D.P.esclavo || '').toLowerCase();
    D.grupo = PUERTAS.l.filter((X) => X !== D && X.P.cl === D.P.cl && ((n && String(X.P.nombre || '').toLowerCase() === n && vsub(X.piv, D.piv).len() < 3) || (es && String(X.P.nombre || '').toLowerCase() === es) || (X.P.esclavo && n && String(X.P.esclavo).toLowerCase() === n)));
  }
  if (PUERTAS.l.length && typeof audioBuf === 'function') audioBuf('fn_puerta');
  if (typeof mioIniciar === 'function') mioIniciar();
}
// la puerta en su lugar según cuánto está abierta (0..1): el modelo y su caja
const _pq = new Quat(), _pp = v3();
function puertaPoner(D) {
  const P = D.P, md = D.md;
  if (P.rot) { _pq.copy(Quat.axis(D.eje.x, D.eje.y, D.eje.z, (D.ang * Math.PI) / 180).mul(D.q0)); _pp.copy(D.piv); }
  else if (P.giro) {
    const ang = (P.dist * D.sentido * D.k * Math.PI) / 180;
    // (la de modelo gira en el eje de arriba del modelo; las de bloques, en el del mapa)
    const ax = P.ejeLocal ? D.q0.rot(D.eje) : D.eje;
    _pq.copy(Quat.axis(ax.x, ax.y, ax.z, ang).mul(D.q0)); _pp.copy(D.piv);
  } else { _pq.copy(D.q0); _pp.copy(D.piv).addS(D.dir, D.recorrido * D.k); }
  if (D.trenPadre) _pp.add(vsub(D.trenPadre.T.pos, D.trenPadre.T.pos0));   // (pegada a un tren —la puerta de un ascensor—: se corre con él)
  md.p[0][0] = _pp.x; md.p[0][1] = _pp.y; md.p[0][2] = _pp.z; md.r[0][0] = _pq.x; md.r[0][1] = _pq.y; md.r[0][2] = _pq.z; md.r[0][3] = _pq.w; md.sucio = true;
  if (D.b) { D.b.q.copy(_pq); D.b.pos.copy(_pp).add(_pq.rot(D.c)); D.b.updateWorld(); }
}
// ¿la puerta toca al jugador? (las esferas de su cuerpo contra la caja de la puerta)
function puertaTocaJug(D, marg) {
  if (!D.b || !JUG.vivo || JUG.noclip) return false;
  for (const [dy] of (JUG.agCol && JUG.esfAg ? JUG.esfAg : JUG.esf)) {
    const c = v3(JUG.pos.x, JUG.pos.y + dy, JUG.pos.z); if (c.x < D.b.aabb.x0 - 1 || c.x > D.b.aabb.x1 + 1 || c.z < D.b.aabb.z0 - 1 || c.z > D.b.aabb.z1 + 1) continue;
    const h = hullClosest(D.b, c); if (h.inside || vsub(c, h.p).len() < JUG.radio + (marg || 0)) return true;
  }
  return false;
}
// abrir o cerrar (yo, o lo que llegó de otro jugador: red = true no vuelve a avisar)
function puertaAlternar(D, abrir, red) {
  if (abrir === undefined) abrir = D.meta < 0.5;
  if (abrir && D.P.giro && !D.P.unaVia && D.k < 0.02) {
    // (se abre para el lado contrario al de quien la abre, como en Source)
    const ax = D.P.ejeLocal ? D.q0.rot(D.eje) : D.eje, cerrada = D.piv.clone().add(D.q0.rot(D.c));
    const girada = D.piv.clone().add(Quat.axis(ax.x, ax.y, ax.z, 0.35 * Math.sign(D.P.dist || 1)).mul(D.q0).rot(D.c));
    D.sentido = vdot(vsub(girada, cerrada), vsub(JUG.pos, cerrada)) > 0 ? -1 : 1;
  }
  D.meta = abrir ? 1 : 0; D.t = 0;
  if (!D.P.silencio && typeof sonar === 'function') sonar('fn_puerta', D.b ? D.b.pos : D.piv, 0.55);
  if (!red && typeof publicar === 'function' && typeof RED !== 'undefined' && RED.on) publicar('a', { k: 'pta', n: D.i, a: abrir ? 1 : 0, s: D.sentido });
}
// lo que le manda un botón o una zona del mapa a las puertas de ese nombre (Open, Close, Toggle): mapaio.js
function puertaEntrada(nom, acc) { if (typeof mioEntrada === 'function') mioEntrada(nom, acc, '', false); }
function puertaRed(d) { const D = PUERTAS.l[d.n | 0]; if (!D) return; if (d.s) D.sentido = d.s > 0 ? 1 : -1; puertaAlternar(D, !!d.a, true); }
// cada cuadro: moverse hacia donde va, cerrarse sola después de "wait", abrirse al tocarla si es de las que se tocan
function puertasPaso(dt) {
  if (typeof mioPaso === 'function') mioPaso(dt);
  for (const D of PUERTAS.l) {
    if (D.P.tren) continue;   // (los trenes, en el paso fijo de la física: trenesPaso)
    if (D.P.rot) {
      // (arranca y frena en un segundo, como en Source)
      const meta = D.on ? D.P.vel * D.velK : 0; D.velAct += Math.sign(meta - D.velAct) * Math.min(Math.abs(meta - D.velAct), D.P.vel * dt);
      if (D.velAct > 0.01) { D.ang = (D.ang + D.velAct * D.dirRot * dt) % 360; puertaPoner(D); }
      continue;
    }
    if (D.k !== D.meta) {
      const P = D.P, vel = P.giro ? Math.max(20, P.vel) / Math.max(1, Math.abs(P.dist)) : Math.max(0.3, P.velM || 2.5) / Math.max(0.05, D.recorrido), k0 = D.k;
      D.k += Math.sign(D.meta - D.k) * Math.min(Math.abs(D.meta - D.k), dt * vel);
      puertaPoner(D);
      // (cerrándose sobre alguien: vuelve a abrirse, como las de Source)
      if (D.meta < k0 && puertaTocaJug(D, 0)) { D.k = k0; puertaPoner(D); puertaAlternar(D, true, false); }
    } else if (D.meta === 1 && D.P.espera > 0) { D.t += dt; if (D.t > D.P.espera && !puertaTocaJug(D, 0.3)) puertaAlternar(D, false); }
    if (D.P.toca && D.meta === 0 && D.k < 0.01 && puertaTocaJug(D, 0.12)) puertaAlternar(D, true);
  }
  // las zonas: al entrar y al salir (el cuerpo entero, de los pies a la cabeza)
  if (PUERTAS.zona.length && JUG.vivo && !JUG.noclip) {
    const p = JUG.pos, r = JUG.radio || 0.45, y0 = p.y - 0.95, y1 = p.y + 0.95;
    for (const z of PUERTAS.zona) {
      const den = p.x + r > z.lo.x && p.x - r < z.hi.x && p.z + r > z.lo.z && p.z - r < z.hi.z && y1 > z.lo.y && y0 < z.hi.y;
      if (den === z.dentro) continue; z.dentro = den;
      if ((z.una && z.hecha) || z.off) continue;
      if (typeof mioDisparar === 'function') mioDisparar(den ? z.en : z.sa, false);
      if (den) z.hecha = true;
    }
  }
}
// el botón del mapa que se está mirando (su caja, hasta donde llega la mano y sin atravesar paredes)
function puertaBotonApuntado(o, d, lejos, tope) {
  let mejor = null, tm = Math.min(lejos, tope + 0.08);
  for (const b of PUERTAS.bot) {
    let t0 = 0, t1 = tm;
    for (const k of ['x', 'y', 'z']) {
      if (Math.abs(d[k]) < 1e-9) { if (o[k] < b.lo[k] - 0.02 || o[k] > b.hi[k] + 0.02) { t0 = 1; t1 = 0; break; } continue; }
      let a = (b.lo[k] - 0.02 - o[k]) / d[k], c = (b.hi[k] + 0.02 - o[k]) / d[k]; if (a > c) { const s = a; a = c; c = s; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) break;
    }
    if (t0 <= t1 && t0 < tm) { tm = t0; mejor = b; }
  }
  return mejor;
}
// la puerta que se está mirando (hasta 2,6 m, desde los ojos)
function puertaApuntada() {
  if ((!PUERTAS.l.length && !PUERTAS.bot.length) || typeof CAM === 'undefined') return null;
  const lejos = 2.6 + (JUG.tercera ? vsub(JUG.ojoPos, CAM.pos).len() : 0), g = mundoRayo(CAM.pos, CAM.fwd, lejos);
  if (g && g.caja && g.caja.puerta && g.caja.puerta.P.usa) return g.caja.puerta;
  const b = PUERTAS.bot.length ? puertaBotonApuntado(CAM.pos, CAM.fwd, lejos, g ? g.t : lejos) : null;
  return b ? { bot: b } : null;
}
function puertaApunta() { const D = puertaApuntada(); return !D ? '' : 'E: ' + T(D.bot ? 'pta.boton' : D.meta > 0.5 ? 'pta.cerrar' : 'pta.abrir'); }
function puertaUsar() {
  const D = puertaApuntada(); if (!D) return false;
  if (D.bot) { if (typeof sonar === 'function') sonar('fn_puerta', D.bot.lo.clone().add(D.bot.hi).scale(0.5), 0.25); if (typeof mioBoton === 'function') mioBoton(D.bot, true); }
  else { puertaAlternar(D); for (const X of D.grupo || []) if ((X.meta > 0.5) !== (D.meta > 0.5)) puertaAlternar(X, D.meta > 0.5); }
  return true;
}
// ---------------- trenes (func_tracktrain: el ascensor de gm_mallparking, vagonetas, plataformas) ----------------
// Siguen su camino de path_track (gmod_bsp.js deja los puntos en DATA.aj.caminos): StartForward va al siguiente de cada
// punto, StartBackward al anterior; al pasar por un punto se cumplen sus salidas OnPass (en el ascensor, «elevator,Stop»
// en cada piso). Chocan con un casco por brocha y por pieza del .phy de lo que llevan pegado (la cabina), mueven lo que
// tienen pegado (botones, puertas) y llevan al jugador que está parado arriba. En una sala todos reciben el mismo botón
// (mapaio.js) y cada uno mueve el tren igual.
function trenNuevo(md, P, piv, q0) {
  const T = { pos: piv.clone(), pos0: piv.clone(), q: q0.clone(), cur: null, vel: 0, meta: 0, dir: 1 };
  const D = { i: PUERTAS.l.length, md, P, piv, q0, T, k: 0, meta: 0, sentido: 1, t: 0, b: null, bs: [], c: v3() };
  // (arranca en su primer punto, como en Source: el origen del tren va al punto —más su "height"—)
  const C = PUERTAS.caminos, ini = C.get(P.primero);
  if (ini) { T.cur = ini; T.pos.copy(ini.p); T.pos.y += P.alto || 0; }
  T.vel = T.meta = P.velIni || 0; if (T.vel < 0) T.dir = -1;
  if (P.solida) for (const H of P.cascos || []) {
    const L = []; for (let k = 0; k + 2 < H.length; k += 3) L.push(v3(H[k], H[k + 1], H[k + 2]));
    if (L.length < 4) continue;
    try { const h = hullDePuntos(L), b = new Body(h.shape, 0); b.estatico = true; b.snd = 'metal'; b.puerta = D; b.tren = D; D.bs.push({ b, c: h.c.clone() }); MUNDO.cajas.push(b); } catch (e) { /* casco que no sale */ }
  }
  D.b = D.bs.length ? D.bs[0].b : null;
  // (lo pegado a él: las puertas con "parentname" —se corren con el tren— y los botones —su caja va con él—)
  const n = String(P.nombre || '').toLowerCase();
  if (n) D.botones = PUERTAS.bot.filter((b) => b.pa === n);
  PUERTAS.l.push(D); trenPoner(D);
  // (en la grilla de choques por todo el camino que puede recorrer: cada tramo entre dos puntos, con lo que mide el tren)
  if (D.bs.length) {
    const vistos = new Set(), tramos = [], pila = ini ? [ini] : [];
    while (pila.length && vistos.size < 400) { const m = pila.pop(); if (vistos.has(m)) continue; vistos.add(m); for (const k of [m.sig, m.alt]) { const q = k && C.get(k); if (q) { tramos.push([m.p, q.p]); pila.push(q); } } }
    if (!tramos.length) tramos.push([T.pos, T.pos]);
    let r = 0; for (const { b } of D.bs) { const a = b.aabb; r = Math.max(r, Math.hypot(a.x0 - T.pos.x, a.z0 - T.pos.z), Math.hypot(a.x1 - T.pos.x, a.z1 - T.pos.z)); }
    const g = P.fija ? 0 : r;
    for (const { b } of D.bs) {
      const a = b.aabb, dx0 = Math.min(a.x0 - T.pos.x, -g), dx1 = Math.max(a.x1 - T.pos.x, g), dz0 = Math.min(a.z0 - T.pos.z, -g), dz1 = Math.max(a.z1 - T.pos.z, g);
      for (const [u, v] of tramos) grillaAgregar(Math.min(u.x, v.x) + dx0 - 0.3, Math.min(u.z, v.z) + dz0 - 0.3, Math.max(u.x, v.x) + dx1 + 0.3, Math.max(u.z, v.z) + dz1 + 0.3, b);
    }
  }
  return D;
}
// el tren en su lugar: el modelo, sus cascos y lo que lleva pegado
function trenPoner(D) {
  const T = D.T, md = D.md;
  md.p[0][0] = T.pos.x; md.p[0][1] = T.pos.y; md.p[0][2] = T.pos.z; md.r[0][0] = T.q.x; md.r[0][1] = T.q.y; md.r[0][2] = T.q.z; md.r[0][3] = T.q.w; md.sucio = true;
  for (const { b, c } of D.bs) { b.q.copy(T.q); b.pos.copy(T.pos).add(T.q.rot(c)); b.updateWorld(); }
  const d = vsub(T.pos, T.pos0);
  for (const b of D.botones || []) { b.lo.copy(b.lo0).add(d); b.hi.copy(b.hi0).add(d); }
  for (const X of PUERTAS.l) if (X.trenPadre === D) puertaPoner(X);
}
// el siguiente punto del camino (para adelante) o el anterior (para atrás)
function trenSig(n, dir) {
  const C = PUERTAS.caminos; if (!n) return null;
  if (dir > 0) { const k = n.altOn && n.alt ? n.alt : n.sig; return (k && C.get(k)) || null; }
  for (const m of C.values()) if ((m.altOn && m.alt ? m.alt : m.sig) === n.n) return m;
  return null;
}
function trenSonido(D, cual) {
  const s = cual === 'ini' ? D.P.sIni : D.P.sFin; if (!s || typeof gmSonido !== 'function' || typeof sonar !== 'function') return;
  try { const n = gmSonido(s); if (n) sonar(n, D.T.pos, 0.8 * (D.P.vol ?? 1)); } catch (e) { /* sin el sonido */ }
}
// las entradas de un tren (y las de sus puntos: EnableAlternatePath, DisablePath...)
function trenEntrada(D, inp, par) {
  const T = D.T, max = D.P.velMax || 2.5, v = +par;
  const andar = (dir, vel) => { const antes = Math.abs(T.meta) > 0.01 || Math.abs(T.vel) > 0.01; T.dir = dir; T.meta = dir * vel; if (!D.P.acel) T.vel = T.meta; if (!antes && vel > 0) trenSonido(D, 'ini'); };
  if (inp === 'startforward') andar(1, max);
  else if (inp === 'startbackward') andar(-1, max);
  else if (inp === 'stop') { const iba = Math.abs(T.vel) > 0.01; T.vel = T.meta = 0; if (iba) trenSonido(D, 'fin'); }
  else if (inp === 'resume') andar(T.dir, max);
  else if (inp === 'toggle') { if (Math.abs(T.meta) > 0.01) trenEntrada(D, 'stop', ''); else andar(T.dir, max); }
  else if (inp === 'reverse') { T.dir = -T.dir; T.meta = -T.meta; T.vel = -T.vel; }
  else if (inp === 'setspeed' && isFinite(v)) andar(T.dir, clamp(v, 0, 1) * max);
  else if (inp === 'setspeedreal' && isFinite(v)) andar(T.dir, Math.abs(v) * GM_S);
  else if ((inp === 'setspeeddir' || inp === 'setspeeddiraccel') && isFinite(v)) andar(v < 0 ? -1 : 1, Math.min(1, Math.abs(v)) * max);
  else if (inp === 'setmaxspeed' && isFinite(v)) D.P.velMax = Math.abs(v) * GM_S;
  else if (inp === 'teleporttopathtrack') { const n = PUERTAS.caminos.get(String(par || '').toLowerCase()); if (n) { T.cur = n; T.pos.copy(n.p); T.pos.y += D.P.alto || 0; trenPoner(D); } }
}
function caminoEntrada(n, inp) {
  if (inp === 'enablealternatepath') n.altOn = true; else if (inp === 'disablealternatepath') n.altOn = false; else if (inp === 'togglealternatepath') n.altOn = !n.altOn;
  else if (inp === 'enablepath') n.off = false; else if (inp === 'disablepath') n.off = true; else if (inp === 'togglepath') n.off = !n.off;
}
// (cada paso fijo de la física, antes del jugador: así lo lleva paso a paso, sin saltitos con pocos cuadros por segundo)
function trenesPaso(dt) { for (const D of PUERTAS.l) if (D.P.tren) trenPaso(D, dt); }
const _trA = v3();
function trenPaso(D, dt) {
  const T = D.T, P = D.P;
  // (la velocidad va hacia la pedida con la aceleración manual del mapa, si la tiene)
  if (T.vel !== T.meta) { const a = (Math.abs(T.meta) > Math.abs(T.vel) ? P.acel : P.decel) || 1e9; T.vel += Math.sign(T.meta - T.vel) * Math.min(Math.abs(T.meta - T.vel), a * dt); }
  if (Math.abs(T.vel) < 1e-4) return;
  const dir = T.vel > 0 ? 1 : -1; let resto = Math.abs(T.vel) * dt; _trA.copy(T.pos);
  for (let k = 0; k < 8 && resto > 1e-6; k++) {
    const h = trenSig(T.cur, dir);
    // (sin camino para ese lado, o el punto apagado: se para, como en Source)
    if (!h || h.off) { T.vel = T.meta = 0; trenSonido(D, 'fin'); break; }
    const meta = v3(h.p.x, h.p.y + (P.alto || 0), h.p.z), d = vsub(meta, T.pos), L = d.len();
    // (mirando hacia donde va, salvo los de orientación fija —el ascensor—)
    if (!P.fija && L > 0.01) { const f = vscale(d, dir / L), yaw = Math.atan2(f.x, f.z), pit = P.sinPitch ? 0 : -Math.asin(clamp(f.y, -1, 1)); T.q.copy(Quat.axis(0, 1, 0, yaw).mul(Quat.axis(1, 0, 0, pit))); }
    if (L > resto) { T.pos.addS(d, resto / L); resto = 0; break; }
    T.pos.copy(meta); resto -= L; T.cur = h;
    // al pasar el punto: sus salidas (OnPass), la velocidad nueva que pide y si para o salta al siguiente
    if (h.vel > 0) { T.meta = dir * h.vel; if (!P.acel) T.vel = T.meta; }
    if (typeof mioDisparar === 'function') mioDisparar(h.sal, false);
    if (h.sf & 16) { const s2 = trenSig(h, dir); if (s2) { T.pos.set(s2.p.x, s2.p.y + (P.alto || 0), s2.p.z); T.cur = s2; } }
    if ((h.sf & 8) || Math.abs(T.meta) < 1e-4) { if (Math.abs(T.vel) > 0.01) trenSonido(D, 'fin'); T.vel = T.meta = 0; break; }
  }
  // lo que movió: el jugador parado arriba va con el tren
  const dx = T.pos.x - _trA.x, dy = T.pos.y - _trA.y, dz = T.pos.z - _trA.z;
  if (JUG.pisa && JUG.pisa.tren === D && !JUG.vehiculo && JUG.vivo) { JUG.pos.x += dx; JUG.pos.y += dy; JUG.pos.z += dz; }
  trenPoner(D);
  // el ruido mientras anda
  if (P.sMov && typeof gmSonido === 'function' && typeof bucle === 'function' && Math.abs(T.vel) > 0.01) { try { const n = gmSonido(P.sMov); if (n) bucle('tren' + D.i, n, T.pos, 0.6 * (P.vol ?? 1), 1); } catch (e) { /* sin el ruido */ } }
}
