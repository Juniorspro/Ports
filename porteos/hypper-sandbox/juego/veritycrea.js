// ---------------- Verity crea: mods con mecánicas (código), construcciones en el mundo y animaciones ----------------
// Se le pide con palabras: charlando ("Verity, haceme un mod de..."), desde su panel, desde el creador de mapas o desde el
// editor de animaciones. Lo arma un modelo más grande que el de la charla: con tu clave de Google AI Studio, directo
// desde acá; si no, la tienda (Gemini en los servers premium o con el permiso del dueño; si no, los modelos gratis); y si
// no, el modelo público. Todo lo que vuelve se revisa (formato.js): el mod queda instalado y prendido (su código corre
// aislado como el de cualquier mod), la construcción aparece de a poco delante tuyo (en el creador, donde mirás) y la
// animación se abre en el editor, lista para tocarla, guardarla o publicarla.
const VCR = { ocupado: false, obra: null, ult: null, sinTienda: false, caja: new Map() };

// ---------------- pedir ----------------
// el tamaño de un prop (su forma): de dónde a dónde va en cada eje, en metros, sin girar
function verCaja(n) {
  if (VCR.caja.has(n)) return VCR.caja.get(n);
  let c = null;
  try {
    const P = puntosForma(formaDe(n).shape);
    if (P.length) { const a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9]; for (const v of P) { a[0] = Math.min(a[0], v.x); a[1] = Math.min(a[1], v.y); a[2] = Math.min(a[2], v.z); b[0] = Math.max(b[0], v.x); b[1] = Math.max(b[1], v.y); b[2] = Math.max(b[2], v.z); } c = { a, b, s: [b[0] - a[0], b[1] - a[1], b[2] - a[2]] }; }
  } catch (e) {}
  VCR.caja.set(n, c); return c;
}
// los props que puede usar (los de Verity y los del menú de props), con su tamaño
function verCatalogo() {
  const L = [], vistos = new Set();
  const sumar = (n) => { if (L.length >= 220 || vistos.has(n) || !DATA.pfPorNombre[n]) return; vistos.add(n); const c = verCaja(n); if (c && Math.min(...c.s) > 0.02) L.push([n, ...c.s.map((x) => Math.round(x * 10) / 10)]); };
  for (const n of VERITY_PROPS) sumar(n);
  const C = (DATA.menu || []).find((c) => c.n === 'Props'); if (C) for (const s of C.sub) for (const n of s.it) sumar(n);
  return L;
}
// lo que vuelve de la tienda: se revisa otra vez acá
function verCrearRevisar(tipo, o) {
  if (!o || o.tipo !== tipo) return null;
  if (tipo === 'mod') { const m = validarRB(o.mod); return typeof m === 'string' ? null : { tipo, decir: rbTexto(o.decir, 280), mod: m }; }
  return verityCreacion(tipo, JSON.stringify(Object.assign({}, o[tipo] || {}, { decir: o.decir })));
}
async function verCrearPedir(tipo, q, prev) {
  const d = { tipo, q, l: verLengua(), props: verCatalogo(), armas: Object.keys(DEF_ARMAS), prev: prev || '', tk: PREFS.verTk || '', salaId: verSala() ? SALA.id : '' };
  const msgs = verityCrearMensajes(d); if (!msgs) return null;
  // con tu clave: directo a Google, el modelo mejor primero
  if (verGemPropia()) {
    VER.gemMala = false;
    for (const m of VERITY_GEMINI_CREA) { try { const o = await verGemPedir(m, verityAGemini(msgs, 8192), 110000); const v = o && verityCreacion(tipo, o.texto); if (v) return v; if (VER.gemMala) break; } catch (e) {} }
  }
  if (!VCR.sinTienda) {
    try {
      const r = await fetch(TIENDA_URL + 'verity/crear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d), signal: verTiempo(170000) });
      if (r.ok) { const v = verCrearRevisar(tipo, await r.json()); if (v) return v; }
      else if (r.status === 404 || r.status === 405) VCR.sinTienda = true; // (la tienda todavía no sabe crear)
      else if (r.status === 429) return { error: 'cupo' };
    } catch (e) {}
  }
  const t = await verPublicoTexto(msgs, 150000); // (el modelo público: un turno cada 30 s)
  return t ? verityCreacion(tipo, t) : null;
}
// lo que dice Verity (con su voz si está acá; si no, un aviso)
function verCrearDecir(t, emo) {
  if (VER.on && VER.yo) { VER.hist.push(['v', t]); VER.hist = VER.hist.slice(-12); verDecir(VER.yo, t, emo, verIdiomaDe(t, verLengua())); verLog(); }
  else aviso(t, 4);
}
// inventar (crear algo nuevo): tipo 'mod' | 'mapa' | 'anim'; opt.cambiar: cambiar lo último que hizo de ese tipo (verCrear es poner un prop)
async function verInventar(tipo, q, opt) {
  opt = opt || {}; q = rbTexto(q, 600); if (!q || !VERITY_CREA.includes(tipo) || JUEGO.estado !== 'juego') return false;
  if (VCR.ocupado) { aviso(T('ver.cr.ocupada'), 2.5); return false; }
  const prev = opt.cambiar && VCR.ult && VCR.ult.tipo === tipo ? VCR.ult.prev : '';
  VCR.ocupado = true; verCreaEstado();
  let v = null; try { v = await verCrearPedir(tipo, q, prev); } catch (e) { console.warn('verity crear', e); }
  // el código del mod se compila (sin correrlo) antes de instalarlo: si tiene un error, se le pide una vez que lo arregle;
  // si sigue mal, queda sin código (con sus efectos, si tiene)
  const mal = (c) => { try { new Function(c); return ''; } catch (e) { return String((e && e.message) || e).slice(0, 160); } };
  if (v && v.mod && v.mod.codigo && mal(v.mod.codigo)) {
    let w = null; try { w = await verCrearPedir('mod', `Fix this JavaScript error in "codigo": ${mal(v.mod.codigo)}. Keep everything else and return the whole JSON.`, JSON.stringify({ nombre: v.mod.nombre, descripcion: v.mod.descripcion, efectos: v.mod.efectos, codigo: v.mod.codigo })); } catch (e) {}
    if (w && w.mod && (!w.mod.codigo || !mal(w.mod.codigo))) v = Object.assign(w, { decir: v.decir || w.decir }); else delete v.mod.codigo;
  }
  VCR.ocupado = false; verCreaEstado();
  if (!v || v.error) { verCrearDecir(T(v && v.error === 'cupo' ? 'ver.cupo' : 'ver.cr.mal'), 'triste'); return false; }
  let ok = false;
  try { ok = tipo === 'mod' ? verCrearMod(v.mod, !!prev) : tipo === 'mapa' ? verCrearMapa(v.mapa) : verCrearAnim(v.anim); } catch (e) { console.warn('verity crear', e); }
  if (!ok) { verCrearDecir(T('ver.cr.mal'), 'triste'); return false; }
  if (VER.yo) { VER.yo.emo = 'emocionada'; VER.yo.emoT = 3; }
  verCrearDecir(v.decir || T('ver.cr.listo'), 'emocionada');
  return true;
}
// mientras crea: piensa (cara y globito) y los botones de crear se ven ocupados
function verCreaEstado() {
  const si = VCR.ocupado;
  if (VER.yo) { VER.yo.pensando = si; if (si) verGlobo(VER.yo, '', 0, true); else verGlobo(VER.yo, '', 0); }
  if (si) aviso(T('ver.cr.haciendo'), 4);
  document.querySelectorAll('[data-vcr]').forEach((b) => b.classList.toggle('ocupado', si));
}

// ---------------- el mod: instalado y prendido ----------------
function verCrearMod(m, cambiar) {
  const viejo = cambiar && VCR.ult && VCR.ult.tipo === 'mod' && INST.mods[VCR.ult.id] ? VCR.ult.id : null;
  const id = viejo || 'local-v' + Math.random().toString(36).slice(2, 9);
  m.id = id; INST.mods[id] = m; guardarLS('rb_instalados', INST);
  const e = Object.assign({}, m.efectos); delete e.aparecer;
  VCR.ult = { tipo: 'mod', id, prev: JSON.stringify({ nombre: m.nombre, descripcion: m.descripcion, icono: String(m.icono).replace(/^ico:/, ''), efectos: e, codigo: m.codigo || '' }) };
  if (!(typeof CREA !== 'undefined' && CREA.on)) {
    const f = modsFuente(); f[id] = true; (PREFS.codigoOk || (PREFS.codigoOk = {}))[id] = 1; guardarPrefs();
    if (viejo) SMOD.cod = null; // (para que vuelva a cargar su código)
    smAplicar(false); modEfectoCambio(true);
    if (typeof SMOD !== 'undefined' && SMOD.abierto) smDibujar();
  }
  return true;
}

// ---------------- la construcción: delante tuyo (en el creador de mapas, donde mirás) ----------------
const verNombreExacto = (n) => { if (DATA.pfPorNombre[n]) return n; const b = String(n).toLowerCase(); return Object.keys(DATA.pfPorNombre).find((x) => x.toLowerCase() === b) || null; };
function verCrearMapa(M) {
  const enCrea = typeof CREA !== 'undefined' && CREA.on;
  // el marco: adelante y a la derecha de la cámara, en el piso
  const f = v3(CAM.fwd.x, 0, CAM.fwd.z); if (f.len() < 1e-3) f.set(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); f.norm();
  const der = v3(CAM.der.x, 0, CAM.der.z); if (der.len() < 1e-3 || Math.abs(vdot(der.norm(), f)) > 0.2) der.copy(vcross(f, v3(0, 1, 0)).norm());
  let O = null;
  if (enCrea) { const h = raycast(CAM.pos, CAM.fwd, 80, null); if (h && h.p.distTo(CAM.pos) > 3) O = h.p.clone(); }
  if (!O) { const p = vadd(JUG.pos, vscale(f, enCrea ? 10 : 4)), y = pisoBajo(v3(p.x, JUG.pos.y + 2, p.z), 8); p.y = y === null ? JUG.pos.y - 0.95 : y; O = p; }
  const yaw0 = Math.atan2(f.x, f.z), aMundo = (p) => { const w = vadd(vadd(O, vscale(der, p[0])), vscale(f, p[2])); w.y = O.y + p[1]; return w; };
  const L = [];
  for (const x of M.objetos.slice(0, 180)) {
    const n = verNombreExacto(x.n), c = n && verCaja(n); if (!c || (!enCrea && !reglaSala(n))) continue;
    // (p es el centro de abajo del prop: crearObjeto ya lo apoya por su base; acá sólo se corre lo que su forma no está centrada)
    const q = Quat.axis(0, 1, 0, yaw0 + x.yaw * Math.PI / 180), off = q.rot(v3((c.a[0] + c.b[0]) / 2, 0, (c.a[2] + c.b[2]) / 2));
    L.push({ n, p: vsub(aMundo(x.p), off), q, f: !!x.f });
  }
  // las entidades pasan por la misma revisión que las de un mapa
  const E = M.entidades.slice(0, 16).map((x) => {
    const prm = Object.assign({}, x.prm); if (x.t === 'teleport' && Array.isArray(prm.a) && prm.a.length === 3) { const a = aMundo(prm.a.map((v) => +v || 0)); prm.a = [a.x, a.y, a.z].map((v) => +v.toFixed(2)); }
    const w = aMundo(x.p), yy = yaw0 + x.yaw * Math.PI / 180; return { t: x.t, p: [w.x, w.y, w.z], yaw: ((yy + Math.PI) % TAU + TAU) % TAU - Math.PI, prm };
  });
  const v = E.length ? validarRB({ formato: 'rezobox-mapa', nombre: 'Verity', base: 'FlatGrass', entidades: E }) : null;
  const ents = v && typeof v === 'object' ? v.entidades : [];
  if (!L.length && !ents.length) return false;
  // de abajo para arriba, de a poco (con su rayito, si está acá)
  L.sort((a, b) => a.p.y - b.p.y);
  VCR.obra = { L, E: ents, i: 0, t: 0, enCrea, n: 0 };
  VCR.ult = { tipo: 'mapa', prev: JSON.stringify(M).slice(0, 9000) };
  return true;
}
function verCreaPaso(dt) {
  const W = VCR.obra; if (!W) return;
  if (JUEGO.estado !== 'juego' || (W.enCrea && !(typeof CREA !== 'undefined' && CREA.on))) { VCR.obra = null; return; }
  W.t -= dt; if (W.t > 0) return; W.t = 0.03;
  for (let k = 0; k < 3 && W.i < W.L.length; k++) {
    const x = W.L[W.i++], o = crearObjeto(x.n, x.p, x.q, { congelado: x.f }); if (!o) continue; W.n++;
    if (!W.enCrea) { o.verity = true; VER.mios.push(o); DESHACER.push(o); redObjeto(o); }
    if (VER.on && VER.yo && W.i % 3 === 0) verHaz(x.p);
  }
  if (W.i < W.L.length) return;
  for (const x of W.E) { const red = !W.enCrea && !!RED.on, e = entidadCrear(x, { red }); if (e && red) entidadRed('ent', e); }
  if (W.enCrea && typeof creadorBarraDibujar === 'function') creadorBarraDibujar();
  VCR.obra = null;
}

// ---------------- la animación: de direcciones de brazos y piernas a huesos (en el editor) ----------------
// Cada clave dice adónde apunta el brazo o el muslo (en el marco del personaje: afuera, arriba, adelante), cuánto se
// doblan codos y rodillas y cuánto se giran cuerpo, torso y cabeza. Se arma pose por pose sobre el muñeco del editor:
// cada hueso gira en el mundo lo justo para apuntar adonde dice (el giro más corto desde donde estaba) y eso se pasa a
// su giro local (el del padre ya puesto), así sirve para cualquier personaje.
function verAnimClaves(A) {
  const P = EDA.P, md = P.md, base = EDA.base, idx = (n) => edaI(n);
  const hay = ['Hips', 'Spine', 'RightArm', 'RightForeArm', 'RightHand', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightUpLeg', 'RightLeg', 'RightFoot', 'LeftUpLeg', 'LeftLeg', 'LeftFoot'].every((n) => idx(n) >= 0 && base.q[n]);
  if (!hay) return null;
  const poner = (po) => { EDA_HUESOS.forEach((n, k) => { const i = EDA.idx[k], v = po.q[n]; if (i >= 0 && v) { const r = md.r[i]; r[0] = v[0]; r[1] = v[1]; r[2] = v[2]; r[3] = v[3]; } }); const hi = idx('Hips'), p = md.p[hi]; p[0] = po.h[0]; p[1] = po.h[1]; p[2] = po.h[2]; md.sucio = true; md.actualizar(); };
  const pos = (n) => { const M = md.W[idx(n)]; return v3(M[12], M[13], M[14]); }, rotW = (n) => m4quat(md.W[idx(n)]);
  const dirDe = (a, b) => vsub(pos(b), pos(a)).norm();
  P.pos.copy(EDA.centro);
  poner(base);
  // el marco del personaje parado: derecha (de hombro a hombro), arriba y adelante (hacia donde apuntan los pies)
  const U0 = v3(0, 1, 0), R0 = vsub(pos('RightArm'), pos('LeftArm')); R0.y = 0; R0.norm();
  // (del tobillo a la punta del pie; la rodilla no sirve: parado puede quedar más adelante que la punta)
  const F0 = vcross(R0, U0).norm(), pies = idx('RightToeBase') >= 0 && idx('LeftToeBase') >= 0 ? vadd(vsub(pos('RightToeBase'), pos('RightFoot')), vsub(pos('LeftToeBase'), pos('LeftFoot'))) : vsub(pos('RightFoot'), pos('RightLeg'));
  pies.y = 0; if (vdot(F0, pies) < 0) F0.set(-F0.x, -F0.y, -F0.z);
  // las bisagras de codos y rodillas (con el brazo o la pierna como están parados) y los giros de base
  const bis = {}, rot0 = {};
  for (const [n, h, s] of [['RightArm', 'RightForeArm', 1], ['LeftArm', 'LeftForeArm', 1], ['RightUpLeg', 'RightLeg', -1], ['LeftUpLeg', 'LeftLeg', -1]]) { bis[n] = vscale(vcross(dirDe(n, h), F0).norm(), s); rot0[n] = rotW(n); }
  // la cadera: de metros en el mundo a su lugar local (cuánto se mueve por unidad, medido)
  const h0 = pos('Hips'), eps = Math.max(0.01, 0.1 * Math.hypot(base.h[0], base.h[1], base.h[2])), J = [];
  for (let c = 0; c < 3; c++) { const po = edaCopia(base); po.h[c] += eps; poner(po); J.push(vscale(vsub(pos('Hips'), h0), 1 / eps)); }
  poner(base);
  const det = vdot(J[0], vcross(J[1], J[2]));
  const aLocal = (w) => (Math.abs(det) < 1e-9 ? [0, 0, 0] : [vdot(w, vcross(J[1], J[2])) / det, vdot(J[0], vcross(w, J[2])) / det, vdot(J[0], vcross(J[1], w)) / det]);
  const rad = Math.PI / 180;
  const qDe = (a, b) => { const d = vdot(a, b); if (d < -0.9999) { let ax = vcross(a, v3(1, 0, 0)); if (ax.len() < 1e-3) ax = vcross(a, v3(0, 0, 1)); ax.norm(); return Quat.axis(ax.x, ax.y, ax.z, Math.PI); } const c = vcross(a, b); return new Quat(c.x, c.y, c.z, 1 + d).norm(); };
  // [adelante, a su derecha, girar a su derecha] en grados: cada eje se elige por adónde lleva (arriba → adelante, arriba →
  // derecha, adelante → derecha), así no importa cómo esté armado el mundo
  // (se devuelve aparte el giro alrededor de su "arriba" y la inclinación)
  const giro2 = (g, R, U, F) => { const ax = (a, b) => vcross(a, b).norm(); return [Quat.axis(...xyz(ax(F, R)), g[2] * rad), Quat.axis(...xyz(ax(U, F)), g[0] * rad).mul(Quat.axis(...xyz(ax(U, R)), g[1] * rad))]; };
  const giro3 = (g, R, U, F) => { const [a, b] = giro2(g, R, U, F); return a.mul(b); };
  const xyz = (v) => [v.x, v.y, v.z], angDe = (a, b) => Math.acos(clamp(vdot(a, b), -1, 1));
  const esp = ['Spine', 'Spine1', 'Spine2'].filter((n) => idx(n) >= 0 && base.q[n]), cuello = idx('Neck') >= 0 ? 'Neck' : 'Head';
  const K = []; let S = {};
  for (const k of A.claves) {
    S = Object.assign({}, S, k);
    const po = edaCopia(base); poner(po);
    // girar el hueso n en el mundo con dq (sobre su giro de ahora)
    const girar = (n, dq) => { const v = po.q[n], ql = new Quat(v[0], v[1], v[2], v[3]), Wp = rotW(n).mul(ql.conj()).norm(); const nq = Wp.clone().conj().mul(dq).mul(Wp).mul(ql).norm(); po.q[n] = [nq.x, nq.y, nq.z, nq.w]; poner(po); };
    if (S.cadera) { const c = S.cadera, l = aLocal(vadd(vadd(vscale(R0, c[0]), vscale(U0, c[1])), vscale(F0, c[2]))); po.h = base.h.map((v, i) => v + l[i]); poner(po); }
    // todo el cuerpo (desde la cadera), el torso (repartido en la espalda) y la cabeza (cuello y cabeza)
    const Qb = S.cuerpo ? giro3(S.cuerpo, R0, U0, F0) : new Quat(); if (S.cuerpo) girar('Hips', Qb);
    const R1 = Qb.rot(R0), U1 = Qb.rot(U0), F1 = Qb.rot(F0);
    let Qt = new Quat();
    if (S.torso && esp.length) {
      // la inclinación repartida en la espalda (curva), ajustada para que la línea de la espalda (de su base al cuello)
      // quede justo en lo pedido; después el giro alrededor de su arriba, repartido igual
      const [Qg, Qi] = giro2(S.torso, R1, U1, F1), antes = edaCopia(po), ch0 = dirDe(esp[0], cuello), meta = angDe(ch0, Qi.rot(ch0));
      let k = 1;
      for (let it = 0; it < 4 && meta > 1e-3; it++) {
        Object.assign(po, edaCopia(antes)); poner(po);
        const parte = new Quat().slerpTo(Qi, k / esp.length); for (const n of esp) girar(n, parte);
        const hay = angDe(ch0, dirDe(esp[0], cuello)); if (hay < 1e-4 || Math.abs(hay - meta) < 0.2 * rad) break; k *= meta / hay;
      }
      const parte = new Quat().slerpTo(Qg, 1 / esp.length); for (const n of esp) girar(n, parte);
      Qt = Qg.clone().mul(Qi);
    }
    // (los brazos y la cabeza, en el marco del tronco: como lo pidió, que es como quedó la línea de la espalda)
    const Qa = Qt.clone().mul(Qb), R2 = Qa.rot(R0), U2 = Qa.rot(U0), F2 = Qa.rot(F0);
    if (S.cabeza) { const Qh = giro3(S.cabeza, R2, U2, F2); if (idx('Neck') >= 0 && base.q.Neck) { girar('Neck', new Quat().slerpTo(Qh, 0.4)); girar('Head', new Quat().slerpTo(Qh, 0.6)); } else if (idx('Head') >= 0) girar('Head', Qh); }
    // brazos y piernas: adonde apuntan (afuera es hacia su lado) y cuánto se doblan
    for (const [clave, flex, a, b, c, lado, marco] of [['brazoD', 'codoD', 'RightArm', 'RightForeArm', 'RightHand', 1, 2], ['brazoI', 'codoI', 'LeftArm', 'LeftForeArm', 'LeftHand', -1, 2],
      ['piernaD', 'rodillaD', 'RightUpLeg', 'RightLeg', 'RightFoot', 1, 1], ['piernaI', 'rodillaI', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', -1, 1]]) {
      const [R, U, F] = marco === 2 ? [R2, U2, F2] : [R1, U1, F1];
      if (S[clave]) {
        const d = S[clave], t = vadd(vadd(vscale(R, lado * d[0]), vscale(U, d[1])), vscale(F, d[2])).norm(), cur = dirDe(a, b);
        // (si va al revés de donde está, pasa por el costado: los brazos por afuera, las piernas por adelante)
        const medio = marco === 2 ? vscale(R, lado) : F.clone();
        girar(a, vdot(cur, t) < -0.6 ? qDe(medio, t).mul(qDe(cur, medio)) : qDe(cur, t));
      }
      // (el doblez es desde el brazo o la pierna derechos: 0 = derecho; la bisagra acompaña al hueso de arriba)
      if (S[clave] || S[flex] != null) {
        const h = rotW(a).mul(rot0[a].conj()).norm().rot(bis[a]), arr = dirDe(a, b), quiere = Quat.axis(h.x, h.y, h.z, (S[flex] || 0) * rad).rot(arr);
        girar(b, qDe(dirDe(b, c), quiere));
      }
    }
    K.push(Object.assign(edaCopia(po), { t: k.t, cam: null }));
  }
  poner(base);
  // (si se repite, la última es la primera)
  if (A.loop && K.length > 1 && Math.abs(K[K.length - 1].t - A.dur) > 1e-3) K.push(Object.assign(edaCopia(K[0]), { t: A.dur }));
  return K.every((k) => Object.values(k.q).every((v) => v.every(Number.isFinite)) && k.h.every(Number.isFinite)) ? K : null;
}
function verCrearAnim(A) {
  if (!EDA.on) edaAbrir();
  if (!EDA.on || !EDA.P) return false;
  const K = verAnimClaves(A); if (!K) return false;
  EDA.keys = K; EDA.dur = A.dur; EDA.loop = A.loop; EDA.cat = A.cat; if (A.nombre) EDA.nombre = A.nombre; EDA.id = null;
  EDA.t = 0; EDA.play = true; EDA.cine = false; EDA.cambio = true;
  VCR.ult = { tipo: 'anim', prev: JSON.stringify(A).slice(0, 9000) };
  edaDibujar(); return true;
}

// ---------------- el pedido en pantalla: qué querés que cree ----------------
function verCreaPanel(tipo) {
  if (JUEGO.estado !== 'juego') return;
  let t = $('verCrea');
  if (!t) {
    t = document.createElement('div'); t.id = 'verCrea'; t.className = 'verTuto oc';
    t.innerHTML = `<div class="verTutoC verCreaC">${icoHTML('ico:verity')}<b></b><div class="verCreaTipos"></div><textarea id="verCreaIn" rows="3" maxlength="600" dir="auto" spellcheck="false"></textarea>
      <label class="verCreaCam"><input type="checkbox"><span></span></label><small class="verCreaMejor" dir="auto"></small>
      <div class="verIAb"><button class="boton" data-c="ok" data-vcr="1">${glifo('si')}<span></span></button><button class="boton gris" data-c="cerrar">${glifo('no')}</button></div></div>`;
    // (desde el editor de animaciones se vuelve a él)
    const cerrar = () => { t.classList.add('oc'); if (UI.abierto === 'verCrea') UI.abierto = EDA.on ? 'eda' : null; };
    const ir = () => {
      const i = $('verCreaIn'), q = i.value.trim(); if (!q || VCR.ocupado) return;
      const cambiar = t.querySelector('.verCreaCam input').checked && !t.querySelector('.verCreaCam').hidden;
      i.value = ''; cerrar(); if (VER.on) VER.hist.push(['u', q]);
      verInventar(VCR.tipo, q, { cambiar });
    };
    t.addEventListener('click', (ev) => {
      if (ev.target === t || ev.target.closest('[data-c=cerrar]')) cerrar();
      else if (ev.target.closest('[data-c=ok]')) ir();
      else { const b = ev.target.closest('[data-tipo]'); if (b) verCreaPanel(b.dataset.tipo); }
    });
    t.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); ir(); } if (ev.key === 'Escape') cerrar(); });
    document.body.appendChild(t);
  }
  VCR.tipo = VERITY_CREA.includes(tipo) ? tipo : 'mod';
  t.querySelector('b').textContent = T('ver.cr.t.' + VCR.tipo);
  t.querySelector('.verCreaTipos').innerHTML = VERITY_CREA.map((k) => `<button class="${k === VCR.tipo ? 'sel' : ''}" data-tipo="${k}">${glifo({ mod: 'codigo', mapa: 'props', anim: 'persona' }[k])}<span>${esc(T('ver.cr.' + k))}</span></button>`).join('');
  $('verCreaIn').placeholder = T('ver.cr.ph.' + VCR.tipo);
  const cam = t.querySelector('.verCreaCam'); cam.hidden = !(VCR.ult && VCR.ult.tipo === VCR.tipo); cam.querySelector('span').textContent = T('ver.cr.cambiar');
  t.querySelector('.verCreaMejor').textContent = verCerebro() === 'normal' ? T('ver.cr.mejor') : T('ver.ia.' + verCerebro());
  t.querySelector('[data-c=ok] span').textContent = T('ver.cr.ok'); t.querySelector('[data-c=ok]').classList.toggle('ocupado', VCR.ocupado);
  if (!EDA.on) cerrarPaneles(); t.classList.remove('oc'); UI.abierto = 'verCrea'; soltarPuntero();
  if (!document.body.classList.contains('tactil')) setTimeout(() => $('verCreaIn').focus(), 30);
}
