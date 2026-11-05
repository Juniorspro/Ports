// ---------------- puertas de los mapas de GMod (func_door, func_door_rotating, func_movelinear, prop_door_rotating) ----------------
// El lector de mapas (gmod_bsp.js) deja cada puerta en su pieza, con su eje y sus datos (gbspPuertaDe). Acá: su estado
// (cerrada → abriéndose → abierta → cerrándose), su caja de choque que se mueve con ella, «E: abrir» al mirarla, abrirse
// sola al tocarla si el mapa lo pide, no cerrarse encima de nadie y, en una sala, que todos la vean igual.
const PUERTAS = { l: [], bot: [], zona: [] };
function puertasIniciar() {
  PUERTAS.l = [];
  // (los botones y las zonas del mapa que abren puertas: gmod_bsp los lee de las salidas de Source)
  const aj = (typeof DATA !== 'undefined' && DATA.aj && DATA.aj[MUNDO.nombre]) || {};
  PUERTAS.bot = (aj.ptaBot || []).map((b) => ({ lo: v3(...b.c[0]), hi: v3(...b.c[1]), acc: b.acc }));
  PUERTAS.zona = (aj.ptaZona || []).map((z) => ({ lo: v3(...z.c[0]), hi: v3(...z.c[1]), en: z.en, sa: z.sa, una: z.una, dentro: false, hecha: false }));
  for (const md of MUNDO.modelos) {
    const x = md.A && md.A[0]; if (!x || !x.puerta) continue;
    const P = x.puerta, piv = v3(x.p[0], x.p[1], x.p[2]), q0 = new Quat(x.r[0], x.r[1], x.r[2], x.r[3]);
    const L = []; for (let k = 0; k + 2 < (P.casco || []).length; k += 3) L.push(v3(P.casco[k], P.casco[k + 1], P.casco[k + 2]));
    let lo = v3(1e9, 1e9, 1e9), hi = v3(-1e9, -1e9, -1e9); for (const p of L) { lo.set(Math.min(lo.x, p.x), Math.min(lo.y, p.y), Math.min(lo.z, p.z)); hi.set(Math.max(hi.x, p.x), Math.max(hi.y, p.y), Math.max(hi.z, p.z)); }
    const D = { i: PUERTAS.l.length, md, P, piv, q0, k: P.abierta ? 1 : 0, meta: P.abierta ? 1 : 0, sentido: P.sentido || 1, t: 0, b: null, c: v3() };
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
  // (las puertas dobles: dos hojas con el mismo nombre una al lado de la otra —o la que el mapa dice con "slavename"—
  // se abren juntas, si no una sola hoja no deja pasar)
  for (const D of PUERTAS.l) {
    const n = String(D.P.nombre || '').toLowerCase(), es = String(D.P.esclavo || '').toLowerCase();
    D.grupo = PUERTAS.l.filter((X) => X !== D && X.P.cl === D.P.cl && ((n && String(X.P.nombre || '').toLowerCase() === n && vsub(X.piv, D.piv).len() < 3) || (es && String(X.P.nombre || '').toLowerCase() === es) || (X.P.esclavo && n && String(X.P.esclavo).toLowerCase() === n)));
  }
  if (PUERTAS.l.length && typeof audioBuf === 'function') audioBuf('fn_puerta');
}
// la puerta en su lugar según cuánto está abierta (0..1): el modelo y su caja
const _pq = new Quat(), _pp = v3();
function puertaPoner(D) {
  const P = D.P, md = D.md;
  if (P.giro) {
    const ang = (P.dist * D.sentido * D.k * Math.PI) / 180;
    // (la de modelo gira en el eje de arriba del modelo; las de bloques, en el del mapa)
    const ax = P.ejeLocal ? D.q0.rot(D.eje) : D.eje;
    _pq.copy(Quat.axis(ax.x, ax.y, ax.z, ang).mul(D.q0)); _pp.copy(D.piv);
  } else { _pq.copy(D.q0); _pp.copy(D.piv).addS(D.dir, D.recorrido * D.k); }
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
// lo que le manda un botón o una zona del mapa a las puertas de ese nombre (Open, Close, Toggle)
function puertaEntrada(nom, acc) {
  for (const D of PUERTAS.l) {
    if (String(D.P.nombre || '').toLowerCase() !== nom) continue;
    if (acc === 'toggle') puertaAlternar(D); else if (acc === 'open' && D.meta < 0.5) puertaAlternar(D, true); else if (acc === 'close' && D.meta > 0.5) puertaAlternar(D, false);
  }
}
function puertaRed(d) { const D = PUERTAS.l[d.n | 0]; if (!D) return; if (d.s) D.sentido = d.s > 0 ? 1 : -1; puertaAlternar(D, !!d.a, true); }
// cada cuadro: moverse hacia donde va, cerrarse sola después de "wait", abrirse al tocarla si es de las que se tocan
function puertasPaso(dt) {
  for (const D of PUERTAS.l) {
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
      if (z.una && z.hecha) continue;
      for (const [n, a] of den ? z.en : z.sa) puertaEntrada(n, a);
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
  if (D.bot) { if (typeof sonar === 'function') sonar('fn_puerta', D.bot.lo.clone().add(D.bot.hi).scale(0.5), 0.25); for (const [n, a] of D.bot.acc) puertaEntrada(n, a); }
  else { puertaAlternar(D); for (const X of D.grupo || []) if ((X.meta > 0.5) !== (D.meta > 0.5)) puertaAlternar(X, D.meta > 0.5); }
  return true;
}
