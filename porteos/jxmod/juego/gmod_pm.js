// ---------------- los modelos de jugador de GMod (models/player/*.mdl) como personaje ----------------
// Un cuarto de los addons más bajados del Workshop son modelos de jugador (player_manager.AddValidModel): en GMod se
// eligen y uno se ve así. Acá el personaje sigue siendo el Hero del juego por dentro (física, animaciones, emotes,
// armas en la mano, apoyo de los pies, muñeco de trapo), pero no se dibuja: se dibuja el .mdl del addon, con su piel y
// sus materiales, y cada hueso del esqueleto de Valve (ValveBiped.Bip01_*) copia el giro del hueso del Hero que le
// corresponde (cadera, columna, cuello, cabeza, clavículas, brazos, manos, dedos, piernas, pies). La copia es en el
// mundo y relativa al reposo: giro = (giro del Hero ahora · giro del Hero en reposo⁻¹) · alineación · reposo del .mdl,
// donde la alineación lleva cada hueso del .mdl a la dirección del mismo hueso del Hero en reposo (así un modelo que
// viene en pose A, con los brazos abajo, no queda con los brazos metidos en el cuerpo). Los huesos que no son del
// esqueleto (pelo, ropa, accesorios) siguen a su padre como en el reposo. La cadera va a la altura de la del Hero
// escalada al largo de las piernas del modelo, para que los pies pisen el piso.
const GMP = { cache: new Map(), n: 0 };
const GMP_VB = { pelvis: 'Hips', spine: 'Spine', spine1: 'Spine1', spine2: 'Spine2', spine4: 'Spine2', neck1: 'Neck', head1: 'Head' };
const GMP_PUNTA = { Hips: 'Spine', Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head' };
for (const [v, m] of [['l', 'Left'], ['r', 'Right']]) {
  Object.assign(GMP_VB, { [v + '_clavicle']: m + 'Shoulder', [v + '_upperarm']: m + 'Arm', [v + '_forearm']: m + 'ForeArm', [v + '_hand']: m + 'Hand', [v + '_thigh']: m + 'UpLeg', [v + '_calf']: m + 'Leg', [v + '_foot']: m + 'Foot', [v + '_toe0']: m + 'ToeBase' });
  Object.assign(GMP_PUNTA, { [m + 'Shoulder']: m + 'Arm', [m + 'Arm']: m + 'ForeArm', [m + 'ForeArm']: m + 'Hand', [m + 'Hand']: m + 'HandMiddle1', [m + 'UpLeg']: m + 'Leg', [m + 'Leg']: m + 'Foot', [m + 'Foot']: m + 'ToeBase' });
  ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].forEach((d, k) => {
    GMP_VB[v + '_finger' + k] = m + 'Hand' + d + '1'; GMP_VB[v + '_finger' + k + '1'] = m + 'Hand' + d + '2'; GMP_VB[v + '_finger' + k + '2'] = m + 'Hand' + d + '3';
    GMP_PUNTA[m + 'Hand' + d + '1'] = m + 'Hand' + d + '2'; GMP_PUNTA[m + 'Hand' + d + '2'] = m + 'Hand' + d + '3';
  });
}
const gmpEs = (s) => typeof s === 'string' && s.startsWith('gmpm:');
// el .mdl armado: árbol (huesos en los ejes del juego, en metros, y las mallas con piel), reposo y qué hueso es cuál
function gmpDef(ruta) {
  if (GMP.cache.has(ruta)) return GMP.cache.get(ruta);
  if (!gmArchivo(ruta)) return null;   // (el addon todavía no está: se vuelve a probar después)
  GMP.cache.set(ruta, null);
  let M; try { M = gmLeerModelo(ruta); } catch (e) {
    // (su geometría se está leyendo del disco: cuando llega se vuelve a armar y, si es el del jugador, se le pone)
    if (e.pendiente) { GMP.cache.delete(ruta); gmModeloPedir(ruta, () => { if (typeof PREFS !== 'undefined' && PREFS.skin === 'gmpm:' + ruta && typeof jugadorCuerpoNuevo === 'function' && JUG.vivo) jugadorCuerpoNuevo(); }); return null; }
    gmErr('personaje ' + ruta, e); return null; }
  // (un prop quieto con forma de persona: el esqueleto de Valve por defecto, ajustado a la malla: gmod_autorig.js)
  if (typeof gmarRig === 'function' && M.huesos.length <= 2 && !M.huesos.some((h) => /^valvebiped\.bip01_pelvis$/i.test(h.n))) { try { const R2 = gmarRig(M); if (R2) M = R2; } catch (e) { gmErr('rig automático ' + ruta, e); } }
  const H = M.huesos, nb = H.length, C = [[0, 1, 0], [0, 0, 1], [1, 0, 0]], CT = _m3T(C), S = GM_S;
  const pv = (p) => [S * p[1], S * p[2], S * p[0]], rot = (q) => _m2q(_m3mul(_m3mul(C, _q2m(q)), CT));
  const arb = [{ n: 'GMP_' + ++GMP.n, p: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], pa: -1 }];
  for (const h of H) arb.push({ n: h.n, p: pv(h.pos), r: rot(h.q), s: [1, 1, 1], pa: h.pa >= 0 ? 1 + h.pa : 0 });
  if (!gmvMallas(M, (h) => 1 + h, 'pm:' + ruta, arb, pv, C, false)) { gmErr('personaje ' + ruta, 'sin caras'); return null; }
  const md = new Modelo(arb); md.actualizar();
  const restQ = [], restP = [];
  for (let i = 0; i < arb.length; i++) { restQ.push(m4quat(md.W[i])); restP.push(v3(md.W[i][12], md.W[i][13], md.W[i][14])); }
  const mix = arb.map((n, i) => { if (i === 0 || i > nb) return null; const m = /^valvebiped\.bip01_(.+)$/i.exec(n.n); return (m && GMP_VB[m[1].toLowerCase()]) || null; });
  const porMix = {}; mix.forEach((m, i) => { if (m && porMix[m] === undefined) porMix[m] = i; });
  // (sin esqueleto de Valve, como un perro o un objeto con patas: se mueve con sus propias secuencias por actividad,
  // como hace GMod con esos modelos: quieto, caminar, correr, agachado, saltar)
  let secs = null;
  const calcSecs = () => {
    const busca = (acts, re, mov) => { let i = M.secuencias.findIndex((q) => acts.includes(String(q.act || '').toUpperCase())); if (i < 0) i = M.secuencias.findIndex((q) => re.test(q.n)); const ia = i >= 0 ? GMF.animDe(M, i, mov ? { move_x: 1, move_y: 0 } : null) : -1, A2 = ia >= 0 && M.anims[ia]; return A2 && A2.nf > 0 && (A2.bloque === 0 || A2.src || (M.bloques && M.bloques[A2.bloque])) ? ia : -1; };   // (también las de un bloque del .ani o de un modelo incluido)
    return { quieto: busca(['ACT_MP_STAND_IDLE', 'ACT_HL2MP_IDLE', 'ACT_IDLE'], /idle|stand/i), camina: busca(['ACT_MP_WALK', 'ACT_HL2MP_WALK', 'ACT_WALK'], /walk/i, true), corre: busca(['ACT_MP_RUN', 'ACT_HL2MP_RUN', 'ACT_RUN'], /run/i, true),
      agachado: busca(['ACT_MP_CROUCH_IDLE', 'ACT_HL2MP_IDLE_CROUCH', 'ACT_CROUCHIDLE'], /crouch|duck/i), salta: busca(['ACT_MP_JUMP', 'ACT_HL2MP_JUMP', 'ACT_JUMP'], /jump/i) };
  };
  if (porMix.Hips === undefined) secs = calcSecs();
  // lo más bajo de la malla en reposo (los pies): la cadera se pone a esa altura sobre el piso
  let piso = Infinity; for (const n of arb) if (n.m !== undefined) { const d = DATA.ms[n.m]; if (d && d.mn) piso = Math.min(piso, d.mn[1]); }
  if (!isFinite(piso)) piso = 0;
  const def = { ruta, arb, nb, restQ, restP, mix, porMix, piso, M, secs, pv, rot, recalcSecs: calcSecs };
  GMP.cache.set(ruta, def); return def;
}
// un modelo incluido que llegó tarde (de la biblioteca o de Steam): se suman sus animaciones y, en los que se mueven
// con sus propias secuencias, se vuelven a elegir (antes quedaban en la pose de referencia: la pose T)
function gmpDefAlDia(def) {
  if (typeof gmAniReintentar === 'function') gmAniReintentar();
  if (!def || !def.M || !def.M.incFaltan || !def.M.incFaltan.size || typeof gmIncluidosReintentar !== 'function') return def;
  if (gmIncluidosReintentar(def.M) && def.porMix.Hips === undefined && def.recalcSecs) def.secs = def.recalcSecs();
  return def;
}
// los modelos de jugador de los addons instalados (los de AddValidModel y los .mdl de models/player/ que no son manos
// ni animaciones)
function gmpLista() {
  const s = new Set();
  if (typeof GMA !== 'undefined' && GMA.pmodels) for (const m of GMA.pmodels.values()) s.add(String(m).toLowerCase().replace(/\\/g, '/'));
  for (const A of GMOD.addons.values()) for (const r of A.G.archivos.keys()) if (/^models\/player\/.+\.mdl$/.test(r) && !/(^|\/)(c_arms|c_|arms|hands|v_|anims?|m_anm|f_anm|z_anm|.*_anims?)[^/]*\.mdl$/.test(r)) s.add(r);
  // (y los personajes que vienen como muñeco, NPC o prop quieto: gmod_autorig.js)
  if (typeof gmarTodos === 'function') for (const x of gmarTodos()) s.add(x.r);
  return [...s].filter((r) => gmArchivo(r));
}
// lo de cada personaje: el modelo y, por hueso del .mdl, el hueso del Hero y la alineación de reposo
function gmpPreparar(P) {
  const def = gmpDefAlDia(gmpDef(P.gmpRuta)); if (!def) return null;
  if (def.secs) { const md = new Modelo(def.arb); md.fijo = def.arb.map(() => null); return { def, md, propio: true, t: 0, sec: -1, W: def.arb.map(() => new Float32Array(16)) }; }
  const D = P.D, sub = D.sub, porNom = {};
  sub.forEach((n, i) => { const m = /^mixamorig\d*:(.*)$/.exec(n.n); if (m && porNom[m[1]] === undefined) porNom[m[1]] = i; });
  if (porNom.Hips === undefined) return null;
  // (escala del Hero en reposo, para ver si achican un hueso, como la cabeza en primera persona)
  if (!D._gmpS) { const md0 = new Modelo(sub); md0.actualizar(); D._gmpS = sub.map((x, i) => Math.hypot(md0.W[i][0], md0.W[i][1], md0.W[i][2]) || 1); }
  // (los modelos de GMod en reposo miran para otro lado que el Hero —en el .mdl, de costado—: los brazos se corregían
  // con la alineación, pero la cadera y la columna no, y quedaban 90° giradas: la cintura retorcida y las piernas cruzadas.
  // Se gira todo el esqueleto del modelo lo que haga falta para que la línea de la cadera quede como la del Hero.)
  let th = 0; { const yw = (a, b) => Math.atan2(b.x - a.x, b.z - a.z), mL = def.porMix.LeftUpLeg, mR = def.porMix.RightUpLeg, hL = porNom.LeftUpLeg, hR = porNom.RightUpLeg;
    if (mL !== undefined && mR !== undefined && hL !== undefined && hR !== undefined) th = yw(D.rp[hL], D.rp[hR]) - yw(def.restP[mL], def.restP[mR]); }
  const ry = new Quat(0, Math.sin(th / 2), 0, Math.cos(th / 2)), restQ = def.restQ.map((q) => ry.clone().mul(q).norm()), restP = def.restP.map((p) => ry.rot(p));
  const hero = [], alin = [];
  for (let i = 0; i < def.arb.length; i++) {
    const m = def.mix[i], h = m ? porNom[m] : undefined; hero.push(h === undefined ? -1 : h); alin.push(null);
    if (h === undefined) continue;
    const pm = GMP_PUNTA[m], gT = pm && def.porMix[pm], hT = pm && porNom[pm];
    if (gT === undefined || hT === undefined || m === 'Hips') continue;
    const dG = vsub(restP[gT], restP[i]), dH = vsub(D.rp[hT], D.rp[h]);
    if (dG.len() > 1e-4 && dH.len() > 1e-4) alin[i] = rotEntre(dG, dH);
  }
  const hipsH = Math.max(0.1, D.rp[porNom.Hips].y), hipsG = Math.max(0.1, def.restP[def.porMix.Hips].y - def.piso);
  // (cuánto más largos o cortos son los brazos y las piernas del modelo que los del Hero: sin arma, la mano y el pie van
  // donde los tiene el Hero respecto del hombro y de la cadera, a esa escala)
  const largo = (P2, ia, ib, ic) => (ia === undefined || ib === undefined || ic === undefined ? 0 : vsub(P2[ib], P2[ia]).len() + vsub(P2[ic], P2[ib]).len());
  const esc = {}; for (const L of ['Left', 'Right']) for (const [k, x, y, z] of [['b', 'Arm', 'ForeArm', 'Hand'], ['p', 'UpLeg', 'Leg', 'Foot']]) {
    const g = largo(def.restP, def.porMix[L + x], def.porMix[L + y], def.porMix[L + z]), h = largo(D.rp, porNom[L + x], porNom[L + y], porNom[L + z]); esc[k + L] = g > 0 && h > 0 ? g / h : 1; }
  const md = new Modelo(def.arb); md.fijo = def.arb.map(() => null);
  // (piernas mucho más cortas o largas que las del Hero: los pies se escalan desde la cadera, si no un peluche de 70 cm daba
  // pasos de un metro y se hundía en el piso para llegar)
  const otraEsc = Math.abs((esc.pLeft + esc.pRight) / 2 - 1) > 0.25;
  return { def, md, hero, alin, esc, otraEsc, restQ, ry, k: hipsG / hipsH, Hh: porNom.Hips, W: def.arb.map(() => new Float32Array(16)), Q: def.arb.map(() => new Quat()), Pw: def.arb.map(() => v3()), S: new Float32Array(def.arb.length) };
}
const _gq = new Quat(), _gq2 = new Quat(), _gv = v3();
// el tobillo de un modelo de otras proporciones: donde está el del Hero respecto de la cadera del Hero (hU), escalado al
// largo de las piernas del modelo y desde la cadera del modelo; la altura, que la suela quede en el piso
function gmpPieEsc(G, L, ua, hU, T) {
  const k = G.esc['p' + L] || 1, d = vsub(T, hU), out = vadd(G.Pw[ua], vscale(d, k));
  return out;
}
// dos huesos (brazo y antebrazo, muslo y pantorrilla) para que la punta (muñeca, tobillo) llegue a T, doblando en el
// plano en que ya estaban (el codo y la rodilla para el mismo lado). Cambia los giros del mundo Q[a] y Q[b].
// polo: hacia dónde va el codo o la rodilla (el del Hero); sin él, el plano en que ya estaban (con la pierna casi recta ese
// plano sale para cualquier lado: rodillas para adentro y codos abiertos)
function gmpIK(G, a, b, c, T, polo) {
  const A = G.Pw[a], B = G.Pw[b], C = G.Pw[c], lab = vsub(B, A).len(), lbc = vsub(C, B).len(); if (lab < 1e-4 || lbc < 1e-4) return;
  const at = vsub(T, A), lt = Math.min(lab + lbc - 1e-4, Math.max(Math.abs(lab - lbc) + 1e-4, at.len())); if (at.len() < 1e-5) return;
  const d = vscale(at, 1 / at.len()), ab = vsub(B, A); let n = vsub(ab, vscale(d, vdot(ab, d)));
  if (polo) { const np = vsub(polo, vscale(d, vdot(polo, d))); if (np.len() > 1e-4) n = np; }
  if (n.len() < 1e-5) { const ac = vsub(C, A); n = vsub(ac, vscale(d, vdot(ac, d))); if (n.len() < 1e-5) return; }
  n = vscale(n, 1 / n.len());
  const ca = Math.max(-1, Math.min(1, (lab * lab + lt * lt - lbc * lbc) / (2 * lab * lt))), sa = Math.sqrt(1 - ca * ca);
  const B2 = vadd(A, vadd(vscale(d, lab * ca), vscale(n, lab * sa))), T2 = vadd(A, vscale(d, lt));
  const R1 = rotEntre(ab, vsub(B2, A)); G.Q[a].premul(R1).norm();
  const bc1 = R1.rot(vsub(C, B)), R2 = rotEntre(bc1, vsub(T2, B2)); G.Q[b].premul(R2.mul(R1)).norm();
}
// pone el .mdl en la pose del Hero de este cuadro y lo encola para dibujar
const _gpP = [0, 0, 0], _gpQ = [0, 0, 0, 1], _gpS = [1, 1, 1];   // (sin crear arreglos por hueso en cada cuadro)
function gmpDibujar(P) {
  if (!P.gmp) {
    if (P.gmp === undefined || TIEMPO.t - (P.gmpT || 0) > 2) { P.gmpT = TIEMPO.t; P.gmp = gmpPreparar(P); }
    if (!P.gmp) { P.md.encolar(); return; }   // (el addon todavía no llegó: el Hero)
  }
  if (P.gmp.propio) { gmpPropio(P); return; }
  const G = P.gmp, def = G.def, A = def.arb, hmd = P.md, D = P.D, nb = def.nb, X = def.porMix, rag = !!P.rag; hmd.actualizar();
  const rwc = D._rwc || (D._rwc = D.rw.map((q) => q.conj()));   // (los giros de reposo del Hero ya invertidos, una vez por skin)
  const raiz = hmd.raiz, rq = m4quat(raiz, _gq2), rp = v3(raiz[12], raiz[13], raiz[14]);
  G.Q[0].copy(rq); G.Pw[0].copy(rp); G.S[0] = 1; G.W[0].set(raiz); G.md.fijo[0] = G.W[0]; G.bajar = 0; G.armaD = null;
  // (1) los giros de los huesos del esqueleto: (Hero ahora · Hero en reposo⁻¹) · alineación · reposo del .mdl
  for (let i = 1; i <= nb; i++) {
    const h = G.hero[i]; if (h < 0) continue; const Q = G.Q[i];
    const W = hmd.W[h]; m4quat(W, Q); Q.mul(rwc[h]); if (G.alin[i]) Q.mul(G.alin[i]); Q.mul(G.restQ[i]).norm();
    G.S[i] = Math.sqrt(W[0] * W[0] + W[1] * W[1] + W[2] * W[2]) / D._gmpS[h];
  }
  // (2) los demás giros y todas las posiciones, de la raíz a las puntas
  const posar = () => {
    for (let i = 1; i <= nb; i++) {
      const pa = A[i].pa, h = G.hero[i];
      if (h < 0) { const r = A[i].r; G.Q[i].copy(G.Q[pa]).mul(_gq.set(r[0], r[1], r[2], r[3])).norm(); G.S[i] = G.S[pa]; }
      if (i === X.Hips && h >= 0) {
        // la cadera: donde está la del Hero, con la altura sobre la raíz escalada al largo de las piernas del modelo (la raíz del
        // Hero es donde pisa, ya con el ajuste de los pies al piso; antes se tomaba 1 m debajo del centro del cuerpo, que queda
        // unos centímetros más abajo, y en uno chico —Cartman y Kenny de South Park, a 0,13 de escala— los pies se enterraban
        // 10 a 15 cm. Tirado como muñeco, en la del muñeco del Hero, y después se apoya en el piso: gmpApoyar)
        const W = hmd.W[h], k = G.k, pi = rp.y; if (rag) G.Pw[i].set(W[12], W[13], W[14]); else G.Pw[i].set(rp.x + (W[12] - rp.x) * k, pi + (W[13] - pi) * k, rp.z + (W[14] - rp.z) * k); if (G.bajar) G.Pw[i].y -= G.bajar;
      } else { const p = A[i].p; G.Q[pa].rotTo(_gv.set(p[0] * G.S[pa], p[1] * G.S[pa], p[2] * G.S[pa]), G.Pw[i]); G.Pw[i].add(G.Pw[pa]); }
    }
  };
  posar();
  // (lejos, con menos del 15 % del alto de la pantalla: sin el ajuste de piernas ni la IK de manos y pies, que no se ven y
  // costaban dos pasadas más del esqueleto)
  // (y de muñeco tampoco: no pisa, cae como caen sus huesos)
  const cerca = !P.lejos && !rag;
  // (si las piernas del modelo no llegan a los tobillos del Hero, la cadera baja lo que falta: que pise, no que flote)
  if (cerca) { let falta = 0; for (const L of ['Left', 'Right']) { const ua = X[L + 'UpLeg'], ub = X[L + 'Leg'], uc = X[L + 'Foot'], hf = D.h[L + 'Foot']; if (ua === undefined || ub === undefined || uc === undefined || hf === undefined) continue;
      const largo = vsub(G.Pw[ub], G.Pw[ua]).len() + vsub(G.Pw[uc], G.Pw[ub]).len(), sube = (def.restP[uc].y - def.piso) - D.tobillo, hU0 = D.h[L + 'UpLeg'];
      let T = v3(hmd.W[hf][12], hmd.W[hf][13] + sube, hmd.W[hf][14]); if (G.otraEsc && hU0 !== undefined) T = gmpPieEsc(G, L, ua, v3(hmd.W[hU0][12], hmd.W[hU0][13], hmd.W[hU0][14]), T);
      falta = Math.max(falta, vsub(T, G.Pw[ua]).len() - largo * 0.995); }
    if (falta > 0) { G.bajar = falta; posar(); } else G.bajar = 0; }
  // (3) manos y pies donde los tiene el Hero (ahí está el arma, el volante, el piso): las muñecas a las del Hero y los
  // tobillos a los del Hero corridos lo que cambia la altura del tobillo sobre la suela
  let ik = false;
  if (cerca) {
    const hp = (n) => { const k = D.h[n]; return k === undefined ? null : v3(hmd.W[k][12], hmd.W[k][13], hmd.W[k][14]); };
    // (el lado del codo / la rodilla del Hero respecto de la línea hombro-muñeca / cadera-tobillo; si está casi recta, hacia
    // atrás para el codo y hacia adelante para la rodilla, según hacia dónde mira el cuerpo)
    // (la derecha: la línea de la cadera del Hero, de la izquierda a la derecha; adelante, arriba × derecha)
    const cI = hp('LeftUpLeg'), cD = hp('RightUpLeg'); let der = cI && cD ? v3(cD.x - cI.x, 0, cD.z - cI.z) : v3(0, 0, 0);
    der = der.len() > 1e-4 ? der.norm() : v3(-raiz[10], 0, raiz[8]).norm(); const fw = v3(der.z, 0, -der.x);
    const polo = (a, b, c, def0) => { if (!a || !b || !c) return def0; const u = vsub(c, a), l = u.len(); if (l < 1e-4) return def0; const un = vscale(u, 1 / l), ab = vsub(b, a), pp = vsub(ab, vscale(un, vdot(ab, un))); return pp.len() > l * 0.02 ? pp.norm() : def0; };
    const armado = !!(P.arma && P.arma !== 'Hands'); let TR = null;
    for (const L of ['Right', 'Left']) {
      const a = X[L + 'Arm'], b = X[L + 'ForeArm'], c = X[L + 'Hand'], hS = hp(L + 'Arm'), hE = hp(L + 'ForeArm'), hW = hp(L + 'Hand');
      if (a !== undefined && b !== undefined && c !== undefined && hW && hS) {
        let T;
        // (con arma: la mano derecha donde la tendría con sus brazos —el lugar de la del Hero respecto del hombro, a la escala de
        // sus brazos— y el arma va a esa mano, del tamaño del personaje (armaGmp); antes la mano iba a la del Hero y, si no
        // llegaba —un modelo chico, de brazos cortos—, el arma quedaba flotando lejos de la mano)
        if (armado && L === 'Right') { T = vadd(G.Pw[a], vscale(vsub(hW, hS), G.esc.bRight)); G.armaD = { hero: hW, pm: T, s: clamp(G.k, 0.45, 1.6) }; }
        else if (armado && TR) { const hR = hp('RightHand'); T = hR && vsub(hW, hR).len() < 0.45 ? vadd(TR, vscale(vsub(hW, hR), G.armaD ? G.armaD.s : 1)) : vadd(G.Pw[a], vscale(vsub(hW, hS), G.esc['b' + L])); }   // (las dos manos en el arma)
        else T = vadd(G.Pw[a], vscale(vsub(hW, hS), G.esc['b' + L]));
        gmpIK(G, a, b, c, T, polo(hS, hE, hW, vadd(vscale(fw, -0.7), v3(0, -0.7, 0)).norm())); ik = true; if (L === 'Right') TR = T;
      }
      const ua = X[L + 'UpLeg'], ub = X[L + 'Leg'], uc = X[L + 'Foot'], hf = D.h[L + 'Foot'];
      if (ua !== undefined && ub !== undefined && uc !== undefined && hf !== undefined) {
        // (el tobillo: donde está el del Hero —el pie apoyado no patina— corrido de costado lo que cambia el ancho de la cadera,
        // y a la altura del tobillo del modelo sobre la suela)
        const dq = m4quat(hmd.W[hf], _gq).mul(rwc[hf]), sube = (def.restP[uc].y - def.piso) - D.tobillo, hU = hp(L + 'UpLeg');
        let T = vadd(v3(hmd.W[hf][12], hmd.W[hf][13], hmd.W[hf][14]), dq.rot(v3(0, sube, 0)));
        if (hU && G.otraEsc) T = gmpPieEsc(G, L, ua, hU, T);
        else if (hU) { const lat = vdot(vsub(G.Pw[ua], hU), der); T = vadd(T, vscale(der, lat)); }
        gmpIK(G, ua, ub, uc, T, polo(hU, hp(L + 'Leg'), hp(L + 'Foot'), fw)); ik = true;
      }
    }
  }
  if (ik) posar();
  if (rag) gmpApoyar(P, G); else if (cerca && G.otraEsc && P.suelo && !P.sentado) gmpNoHundir(G, rp.y);   // (sólo los de otras medidas: en los demás la IK ya los apoya)
  if (G.armaD && X.RightHand !== undefined) G.armaD.pm = G.Pw[X.RightHand].clone();   // (donde quedó de verdad la mano)
  for (let i = 1; i <= nb; i++) { const Q = G.Q[i], s = G.S[i] < 0.02 ? 0.0001 : G.S[i]; _gpP[0] = G.Pw[i].x; _gpP[1] = G.Pw[i].y; _gpP[2] = G.Pw[i].z; _gpQ[0] = Q.x; _gpQ[1] = Q.y; _gpQ[2] = Q.z; _gpQ[3] = Q.w; _gpS[0] = _gpS[1] = _gpS[2] = s; m4trs(_gpP, _gpQ, _gpS, G.W[i]); G.md.fijo[i] = G.W[i]; }
  G.md.color = hmd.color; G.md.extra = hmd.extra; G.md.resaltar = hmd.resaltar; G.md.sinSombra = hmd.sinSombra;
  G.md.sucio = true; G.md.encolar();
}
// lo que ocupa la malla alrededor de cada hueso, en los ejes del hueso (metros, ejes del juego): de los vértices que dependen
// sobre todo de él, los de más afuera en 98 direcciones (las de la cáscara de un cubo de 5×5×5). Con eso se sabe dónde
// queda lo más bajo del modelo en cualquier pose sin recorrer toda la malla (una caja girada se pasaba de largo)
const _GMP_DIRS = []; for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) for (let z = -2; z <= 2; z++) if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) === 2) _GMP_DIRS.push([x, y, z]);
function gmpPuntos(def) {
  if (def.puntos) return def.puntos;
  const M = def.M, V = M.v, H = M.huesos, best = H.map(() => null); def.puntos = H.map(() => null); if (!V || !V.n) return def.puntos;
  for (let k = 0; k < V.n; k++) {
    let b = V.hb[k * 3], bw = V.w[k * 3]; for (let j = 1; j < 3; j++) if (V.w[k * 3 + j] > bw) { bw = V.w[k * 3 + j]; b = V.hb[k * 3 + j]; }
    const m = H[b] && H[b].p2b; if (!m) continue;
    const x = V.pos[k * 3], y = V.pos[k * 3 + 1], z = V.pos[k * 3 + 2], p = def.pv([m[0] * x + m[1] * y + m[2] * z + m[3], m[4] * x + m[5] * y + m[6] * z + m[7], m[8] * x + m[9] * y + m[10] * z + m[11]]);
    const B = best[b] || (best[b] = _GMP_DIRS.map(() => [-Infinity, null]));
    for (let d = 0; d < _GMP_DIRS.length; d++) { const D = _GMP_DIRS[d], v = D[0] * p[0] + D[1] * p[1] + D[2] * p[2]; if (v > B[d][0]) { B[d][0] = v; B[d][1] = p; } }
  }
  best.forEach((B, b) => { if (!B) return; const L = [...new Set(B.map((x) => x[1]).filter(Boolean))]; const f = new Float32Array(L.length * 3); L.forEach((p, i) => f.set(p, i * 3)); def.puntos[b] = f; });
  // (y los huesos que llegan al tercio de abajo de la malla en reposo: los únicos que pueden quedar más abajo parado)
  const ys = def.puntos.map((c, b) => { if (!c || !def.restQ[1 + b]) return null; let mn = Infinity, mx = -Infinity; for (let k = 0; k < c.length; k += 3) { const y = def.restQ[1 + b].rot(v3(c[k], c[k + 1], c[k + 2])).y + def.restP[1 + b].y; if (y < mn) mn = y; if (y > mx) mx = y; } return [mn, mx]; });
  let y0 = Infinity, y1 = -Infinity; for (const r of ys) if (r) { y0 = Math.min(y0, r[0]); y1 = Math.max(y1, r[1]); }
  def.bajos = []; ys.forEach((r, b) => { if (r && r[0] < y0 + 0.35 * (y1 - y0)) def.bajos.push(b); });
  return def.puntos;
}
// parado en el piso: lo más bajo de la malla no queda debajo de donde pisa el Hero, salvo los pies (esos los pone la IK).
// Un modelo con las piernas metidas en la malla de la cadera —el Cartman de South Park— se hundía cuando el Hero mueve la
// cadera (la malla de abajo gira con ella)
function gmpNoHundir(G, piso) {
  const def = G.def, C = gmpPuntos(def), B = def.bajos; if (!B || !B.length) return;
  const X = def.porMix, pies = def.pies || (def.pies = new Set(['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'].map((n) => X[n]).filter((x) => x !== undefined)));
  let bajo = Infinity, cual = -1;
  for (const b of B) { const i = 1 + b, c = C[b], Q = G.Q[i], s = G.S[i] || 1, y0 = G.Pw[i].y; for (let k = 0; k < c.length; k += 3) { Q.rotTo(_gpa.set(c[k] * s, c[k + 1] * s, c[k + 2] * s), _gpb); if (_gpb.y + y0 < bajo) { bajo = _gpb.y + y0; cual = i; } } }
  if (bajo < piso - 0.005 && !pies.has(cual)) { const d = piso - bajo; for (let i = 1; i <= def.nb; i++) G.Pw[i].y += d; }
}
// el muñeco de trapo con un modelo de otras medidas: apoyado donde se apoya el del Hero (lo más bajo de la malla, a la altura
// de lo más bajo de los cuerpos del muñeco). Antes la cadera iba a la del Hero escalada hacia un piso supuesto —un metro
// debajo de la cadera, que tirado en el suelo está a centímetros— y uno chico, como Cartman o Kenny de South Park, quedaba
// medio metro bajo tierra: no se veía
const _gpa = v3(), _gpb = v3(), _gpAb = v3(0, -1, 0);
function gmpApoyar(P, G) {
  let piso = Infinity; for (const [, x] of P.rag.cuerpos) if (x.b && x.b.aabb && x.b.aabb.y0 < piso) piso = x.b.aabb.y0;
  if (!isFinite(piso)) return;
  // (y nunca debajo del piso del mapa que tiene abajo: los cuerpos del muñeco se hunden un poco al apoyarse)
  if (typeof mundoRayo === 'function') { const h = mundoRayo(_gpa.set(P.pos.x, P.pos.y + 0.5, P.pos.z), _gpAb, 4); if (h) piso = Math.max(piso, P.pos.y + 0.5 - h.t); }
  const C = gmpPuntos(G.def); let bajo = Infinity;
  for (let i = 1; i <= G.def.nb; i++) {
    const c = C[i - 1]; if (!c) continue; const Q = G.Q[i], s = G.S[i] || 1, y0 = G.Pw[i].y;
    for (let k = 0; k < c.length; k += 3) { Q.rotTo(_gpa.set(c[k] * s, c[k + 1] * s, c[k + 2] * s), _gpb); if (_gpb.y + y0 < bajo) bajo = _gpb.y + y0; }
  }
  if (!isFinite(bajo)) return;
  const d = piso - bajo; for (let i = 1; i <= G.def.nb; i++) G.Pw[i].y += d;
}
// un modelo sin ValveBiped: su secuencia según lo que hace el personaje, cuadro a cuadro desde el .mdl (GMF.pose)
function gmpPropio(P) {
  const G = P.gmp, def = G.def, S = def.secs, M = def.M, A = def.arb, hmd = P.md; hmd.actualizar();
  const sp = Math.hypot(P.vel.x, P.vel.z), elige = (...L) => L.find((x) => x >= 0) ?? -1;
  const sec = !P.suelo && !P.sentado ? elige(S.salta, S.quieto) : P.agachado || P.sentado ? elige(S.agachado, S.quieto) : sp > 5 ? elige(S.corre, S.camina, S.quieto) : sp > 0.3 ? elige(S.camina, S.corre, S.quieto) : elige(S.quieto, S.camina);
  if (sec !== G.sec) { G.sec = sec; G.t = 0; }
  G.t += TIEMPO.dt || 0.016;
  G.W[0].set(hmd.raiz); G.md.fijo[0] = G.W[0];
  const An = sec >= 0 ? M.anims[sec] : null, f = An ? (G.t * (An.fps > 0 ? An.fps : 30)) % Math.max(1, An.nf - 1) : 0, f0 = Math.floor(f), w = f - f0;
  const a = An ? GMF.poseCapas(M, sec, f0) : null, b = An ? GMF.poseCapas(M, sec, Math.min(An.nf - 1, f0 + 1)) : null;
  for (let i = 1; i <= def.nb; i++) {
    const h = i - 1; let p = A[i].p, r = A[i].r;
    if (a) {
      const pp = [0, 1, 2].map((c) => a.P[h * 3 + c] * (1 - w) + b.P[h * 3 + c] * w);
      let q1 = [b.Q[h * 4], b.Q[h * 4 + 1], b.Q[h * 4 + 2], b.Q[h * 4 + 3]]; const q0 = [a.Q[h * 4], a.Q[h * 4 + 1], a.Q[h * 4 + 2], a.Q[h * 4 + 3]];
      if (q0[0] * q1[0] + q0[1] * q1[1] + q0[2] * q1[2] + q0[3] * q1[3] < 0) q1 = q1.map((x) => -x);
      const qi = q0.map((x, c) => x * (1 - w) + q1[c] * w), l = Math.hypot(...qi) || 1;
      p = def.pv(pp); r = def.rot(qi.map((x) => x / l));
    }
    m4trs(p, r, [1, 1, 1], G.W[i]); m4mul(G.W[A[i].pa], G.W[i], G.W[i]); G.md.fijo[i] = G.W[i];
  }
  G.md.color = hmd.color; G.md.extra = hmd.extra; G.md.sinSombra = hmd.sinSombra; G.md.sucio = true; G.md.encolar();
}
if (typeof module !== 'undefined') module.exports = { GMP, gmpDef, gmpLista, gmpEs };

// ---------------- el arma del addon en la mano (tercera persona) y los huesos de Valve del personaje ----------------
// En GMod el modelo de mundo del arma (w_*.mdl) va pegado por huesos al jugador: su hueso ValveBiped.Bip01_R_Hand queda
// donde está la mano del jugador. Acá la mano de Source sale del marco de la mano del personaje (muñeca, nudillo, palma)
// por la calibración de la mano de Source en ese marco (DATA.gm.manoR.C, la misma de las armas de HL2): el modelo va en
// (mano de Source) · (su hueso de la mano en reposo)⁻¹. El Lua también puede preguntar por los huesos del personaje con
// los nombres de Valve (LookupBone, GetBonePosition) y por los adjuntos del arma (GetAttachment: la punta de un sable).
const GMH = { defs: new Map(), C: {}, vb: null };
const gmhVB = () => GMH.vb || (GMH.vb = Object.keys(GMP_VB));
function gmhC(lado) {   // (por columnas, como las matrices del juego)
  if (GMH.C[lado]) return GMH.C[lado];
  const R = DATA.gm && DATA.gm[lado === 'Left' ? 'manoL' : 'manoR']; if (!R || !R.C) return null;
  const m = new Float32Array(16); for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) m[k * 4 + r] = R.C[r][k];
  return (GMH.C[lado] = m);
}
const _gmhF = new Float32Array(16), _gmhA = new Float32Array(16), _gmhB = new Float32Array(16);
// el hueso de la mano de Source de un personaje, en el mundo del juego
function gmhManoValve(P, lado, out) {
  if (!P || !P.md || !P.D) return false; const C = gmhC(lado); if (!C) return false;
  P.md.actualizar(); if (!manoMarco(P.md.W, huesosMixamo(P.D), lado, _gmhF)) return false;
  m4mul(_gmhF, C, out); return true;
}
// una matriz 3×4 de Source (filas) a una 4×4 del juego (columnas): ejes (x, y, z) → (y, z, x) y unidades → metros
function gmhDeSource(m, out) {
  const ix = [1, 2, 0]; out.fill(0); out[15] = 1;
  for (let r = 0; r < 3; r++) { for (let c = 0; c < 3; c++) out[c * 4 + r] = m[ix[r] * 4 + ix[c]]; out[12 + r] = m[ix[r] * 4 + 3] * GM_S; }
  return out;
}
// el hueso en reposo dentro del modelo (p2b lleva del modelo al hueso: se invierte)
function gmhHuesoReposo(h, out) {
  out = out || new Float32Array(16);
  if (!h || !h.p2b) { out.fill(0); out[0] = out[5] = out[10] = out[15] = 1; return out; }
  const p = h.p2b, inv = [];
  for (let r = 0; r < 3; r++) { for (let c = 0; c < 3; c++) inv[r * 4 + c] = p[c * 4 + r]; inv[r * 4 + 3] = -(p[r] * p[3] + p[4 + r] * p[7] + p[8 + r] * p[11]); }
  return gmhDeSource(inv, out);
}
function gmhInvRigida(a, out) {
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out[c * 4 + r] = a[r * 4 + c];
  for (let r = 0; r < 3; r++) out[12 + r] = -(out[r] * a[12] + out[4 + r] * a[13] + out[8 + r] * a[14]);
  out[3] = out[7] = out[11] = 0; out[15] = 1; return out;
}
// el modelo de mundo de un arma: su malla (la del prop) y su hueso de la mano en reposo, invertido
function gmhArmaDef(ruta) {
  if (GMH.defs.has(ruta)) return GMH.defs.get(ruta);
  const nom = gmPrefab('gm:' + ruta); if (!nom) return null;   // (si el archivo todavía no está, se prueba otra vez)
  const x = GMOD.pf.get(nom), M = x && x.M, nodos = DATA.pf[DATA.pfPorNombre[nom]];
  if (!M || !nodos) { GMH.defs.set(ruta, null); return null; }
  const H = M.huesos || [], hb = Math.max(0, H.findIndex((h) => /r_hand$/i.test(h.n)));
  // (la malla del prop puede estar en la pose de su primera secuencia y no en la de enlace —gmPrefab elige la que calza con
  // su .phy—: entonces la mano y los adjuntos van con los huesos de esa pose. Los modelos de mundo de TF2 traen la raíz
  // girada 90° en «idle» y la minigun y el rifle quedaban de costado en la mano: Discord, «el agarre de las armas está mal»)
  const RP = gmhPoseDeMalla(M, nodos);
  const huesos = RP ? RP.W.map((w) => gmhDeSource(w, new Float32Array(16))) : H.map((h) => gmhHuesoReposo(h));
  const Gi = gmhInvRigida(huesos[hb] || gmhHuesoReposo(H[hb]), new Float32Array(16));
  const md = new Modelo(nodos.map((n) => ({ n: n.n, p: n.p, r: n.r, s: n.s, pa: n.pa, m: n.m, mt: n.mt })));
  const d = { md, Gi, M, ruta, huesos }; GMH.defs.set(ruta, d); return d;
}
// la pose en que quedó la malla del prop (null: la de enlace): se compara la caja de la malla con la de los vértices en
// cada pose (gmPrefab no la guarda; la malla está en metros con los ejes del juego)
function gmhPoseDeMalla(M, nodos) {
  const d = nodos && nodos[0] && DATA.ms[nodos[0].m], V = M.v; if (!d || !d.mn || !d.sc || !V || !V.n || !GMF.poseReposo) return null;
  let RP = null; try { RP = GMF.poseReposo(M); } catch (e) { RP = null; } if (!RP || !RP.W) return null;
  const caja = (pos) => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let k = 0; k < V.n; k++) for (let c = 0; c < 3; c++) { const x = pos[k * 3 + [1, 2, 0][c]] * GM_S; if (x < mn[c]) mn[c] = x; if (x > mx[c]) mx[c] = x; } return [0, 1, 2].reduce((s, c) => s + Math.abs(mn[c] - d.mn[c]) + Math.abs(mx[c] - mn[c] - d.sc[c]), 0); };
  let VP = null; try { VP = GMF.posar(M, RP); } catch (e) { return null; }
  return caja(VP.pos) < caja(V.pos) ? RP : null;
}
const gmhRutaMundo = (w) => { const r = String(w.modelo || w.wm || '').toLowerCase().replace(/\\/g, '/'); return /\.mdl$/.test(r) ? (r.startsWith('models/') ? r : 'models/' + r) : null; };
// (desde el dibujo del personaje) el arma del addon que tiene en la mano: su modelo de mundo pegado a la mano
function gmhArmaMundo(P) {
  if (!P || typeof P.arma !== 'string' || !P.arma.startsWith('gm:') || P !== JUG.cuerpo || !GMA.armasJug) return false;
  const w = GMA.armasJug.get(P.arma.slice(3)); if (!w) return false;
  const ruta = gmhRutaMundo(w), A = ruta && gmhArmaDef(ruta); if (!A) return false;
  if (!gmhManoValve(P, 'Right', _gmhA)) return false;
  m4mul(_gmhA, A.Gi, _gmhB); if (typeof armaGmp === 'function') armaGmp(P, _gmhB);
  (w.mundoW || (w.mundoW = new Float32Array(16))).set(_gmhB); w.mundoRuta = ruta; w.mundoT = TIEMPO.t;
  A.md.ponerRaiz(_gmhB); A.md.encolar(); return true;
}
// un adjunto del arma en el mundo (si se dibujó hace poco en la mano)
function gmhAdjuntoArma(w, i) {
  if (!w || !w.mundoW || !w.mundoRuta || TIEMPO.t - (w.mundoT || 0) > 0.5) return null;
  const A = GMH.defs.get(w.mundoRuta), a = A && A.M.adjuntos[i - 1]; if (!a) return null;
  m4mul(w.mundoW, A.huesos[a.hueso] || A.huesos[0] || _gmhIdent(), _gmhA);
  m4mul(_gmhA, gmhDeSource(a.m, _gmhF), _gmhB); return _gmhB;
}
const _gmhI = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); const _gmhIdent = () => _gmhI;
// el arma en la mano del jugador cuando no se dibujó su modelo de mundo (en 1ª persona, o con un modelo sin mano de Valve,
// como el perro doge_player: GMod la pega a ValveBiped.Bip01_R_Hand y, si no está, queda en los pies): en la mano, si la
// hay, o adelante de los ojos, a la altura del hocico; mirando a donde apunta (columnas: izquierda, arriba, adelante)
const _gmhS = new Float32Array(16), _gmhM = new Float32Array(16);
function gmhArmaSinModelo(w) {
  if (typeof JUG === 'undefined' || w !== GMA.swep || !JUG.ojoPos) return null;
  const P = JUG.cuerpo, f = typeof gmaApunta === 'function' ? gmaApunta() : CAM.fwd;
  let p = null;
  if (P && P.md && !(P.gmp && P.gmp.propio) && gmhManoValve(P, 'Right', _gmhM)) p = vadd(v3(_gmhM[12], _gmhM[13], _gmhM[14]), vscale(f, 0.3));
  if (!p) p = vadd(vadd(JUG.ojoPos, vscale(f, 0.35)), v3(0, -0.12, 0));
  const u0 = Math.abs(f.y) > 0.98 ? v3(0, 0, 1) : v3(0, 1, 0), l = vcross(u0, f).norm(), u = vcross(f, l).norm();
  _gmhS.set([l.x, l.y, l.z, 0, u.x, u.y, u.z, 0, f.x, f.y, f.z, 0, p.x, p.y, p.z, 1]); return _gmhS;
}
// un hueso del personaje con nombre de Valve: la mano de Source calibrada; los demás, el hueso del personaje que le toca
function gmhPersona(e) { if (typeof JUG !== 'undefined' && e === GMA.jug) return JUG.cuerpo || null; return e && e.P && e.P.md && e.P.D ? e.P : null; }
function gmhHuesoMundo(e, i) {
  const P = gmhPersona(e), k = gmhVB()[i]; if (!P || !k) return null;
  if (k === 'r_hand' || k === 'l_hand') { if (gmhManoValve(P, k === 'r_hand' ? 'Right' : 'Left', _gmhB)) return _gmhB; }
  const hi = P.D.h[GMP_VB[k]]; if (hi === undefined) return null;
  P.md.actualizar(); return P.md.W[hi];
}
// las funciones de Entity que cambian (al armar el Lua)
function gmhApi(R, G) {
  const E = GMA.metas && GMA.metas.Entity; if (!E) return;
  const V = (g) => { const v = vS(g); v.__mt = GMA.mtVec; return v; }, Ag = (a) => { a.__mt = GMA.mtAng; return a; };
  const angDe = (W) => { const n = (o) => { const x = W[o], y = W[o + 1], z = W[o + 2], l = Math.hypot(x, y, z) || 1; const s = dS(v3(x / l, y / l, z / l)); return [s.x, s.y, s.z]; }; return matAng(n(8), n(0), n(4)); };
  const pos = (W) => V(v3(W[12], W[13], W[14])), tabla = (o) => { const t = new LuaTable(); for (const k in o) t.set(k, o[k]); return t; };
  const envolver = (n, f) => { const f0 = E.get(n); E.set(n, (...a) => { const r = f(...a); return r === undefined ? (typeof f0 === 'function' ? f0(...a) : undefined) : r; }); };
  const nombreVB = (s) => { const m = /^valvebiped\.bip01_(.+)$/i.exec(String(s || '')); return m ? m[1].toLowerCase() : null; };
  envolver('LookupBone', (e, n) => { if (!gmhPersona(e)) return undefined; const k = nombreVB(n), i = k ? gmhVB().indexOf(k) : -1; return i < 0 ? null : i; });
  envolver('GetBoneCount', (e) => (gmhPersona(e) ? gmhVB().length : undefined));
  envolver('GetBoneName', (e, i) => (gmhPersona(e) && gmhVB()[i] ? 'ValveBiped.Bip01_' + gmhVB()[i].replace(/^(.)_/, (x, c) => c.toUpperCase() + '_').replace(/_(.)/g, (x, c) => '_' + c.toUpperCase()) : undefined));
  envolver('GetBonePosition', (e, i) => { const W = gmhPersona(e) && gmhHuesoMundo(e, i); return W ? [pos(W), Ag(angDe(W))] : undefined; });
  envolver('GetAttachment', (e, i) => { if (!(e instanceof LEnt) || e.tipo !== 'arma') return undefined; const W = gmhAdjuntoArma(e, i) || gmhArmaSinModelo(e); return W ? tabla({ Pos: pos(W), Ang: Ag(angDe(W)), Bone: 0 }) : undefined; });
  // (las armas en la mano: sus adjuntos y su modelo, por el modelo de mundo que se dibuja)
  envolver('LookupAttachment', (e, n) => { if (!(e instanceof LEnt) || e.tipo !== 'arma' || !e.mundoRuta) return undefined; const A = GMH.defs.get(e.mundoRuta); if (!A) return undefined; const i = A.M.adjuntos.findIndex((a) => a.n.toLowerCase() === String(n).toLowerCase()); return i < 0 ? 0 : i + 1; });
  envolver('GetAttachments', (e) => { if (!(e instanceof LEnt) || e.tipo !== 'arma' || !e.mundoRuta) return undefined; const A = GMH.defs.get(e.mundoRuta); if (!A) return undefined; return R.tab(A.M.adjuntos.map((a, i) => tabla({ id: i + 1, name: a.n }))); });
}

// ---------------- Personajes de mods: los modelos de jugador de los addons, aparte de los demás mods ----------------
// El detector: un addon del Workshop es de modelos de jugador si su nombre lo dice ("Playermodel", "PM", "Player Model")
// o es un "Model" con "player" en el nombre; uno instalado, si trae models/player/*.mdl o registra AddValidModel. Esos
// salen en Personajes → Mods (con buscador: los tuyos y, abajo, los del Workshop para instalar con un toque) y en la
// pausa (Personaje), donde se cambia jugando; en la tienda de mods ya no se mezclan.
const PJM = { q: '', ws: null, cat: null, t: 0, bajando: new Set() };
function gmEsPM(x) {
  if (!x) return false; const t = String(x.t || x.n || ''), tags = Array.isArray(x.tags) ? x.tags : [];
  if (/player\s?-?models?|\bplayer\s?skin/i.test(t)) return true;
  // ("PM" sólo al final o antes de un signo: "Zero Two. PM.", "Ryuk [PM]", "Doom Slayer PM/NPC"; no "Bentley PM Continental")
  if (/\bp\.?m\.?s?(?=\s*($|[\]\)\/&+,.:|-]|and\b|y\b))/i.test(t) && !tags.some((g) => /vehicle|weapon|map/i.test(g))) return true;
  return /\bplayer\b/i.test(t) && tags.includes('Model');
}
function pjmInstalados() {
  const nom = new Map(); if (typeof GMA !== 'undefined' && GMA.pmodels) for (const [n, m] of GMA.pmodels) nom.set(String(m).toLowerCase().replace(/\\/g, '/'), n);
  return gmpLista().map((r) => {
    const A = [...GMOD.addons.values()].find((a) => a.G && a.G.archivos && a.G.archivos.has(r)), c = A && PJM.cat && PJM.cat.porId.get(String(A.id)), pg = A && PREFS.gmod && PREFS.gmod[A.id];
    const auto = typeof gmarTipo === 'function' && gmarTipo(r) === 'auto';
    return { r, n: (nom.get(r) || r.replace(/^.*\//, '').replace(/\.mdl$/, '').replace(/_/g, ' ')) + (auto ? ' · ' + T('pjm.auto') : ''), img: (A && A.meta && A.meta.img) || (pg && pg.img) || (c && c.img) || '', addon: A ? A.nombre : '' };
  });
}
function pjmBuscar() {
  if (typeof gmCatalogo !== 'function') return;
  gmCatalogo().then((C) => {
    if (!C) { PJM.ws = []; pjmDibujar(); return; } PJM.cat = C;
    const pal = PJM.q.toLowerCase().split(/\s+/).filter(Boolean);
    PJM.ws = C.L.filter((x) => gmEsPM(x) && !GMOD.addons.has(String(x.id)) && pal.every((p) => x.bus.includes(p)) && !(typeof censOficial === 'function' && censOficial() && censModMotivo(x))).sort((a, b) => b.subs - a.subs).slice(0, 36);
    pjmDibujar();
  }).catch(() => { PJM.ws = []; pjmDibujar(); });
}
// la lista (instalados y del Workshop) dentro de un contenedor con su buscador; se rehace sin tocar el buscador.
// (GOLDEN) Tarjetas como las de Personajes: la de un modelo tuyo dice «Equipar» (o «En uso»); la del Workshop, «Instalar»
function pjmListasHTML() {
  const q = PJM.q.toLowerCase().trim(), I = pjmInstalados().filter((p) => !q || (p.n + ' ' + p.addon).toLowerCase().includes(q));
  const celda = (dat, n, img, sub, o) => (typeof pjTarjeta === 'function' ? pjTarjeta(`data-pjm="${esc(dat)}"`, n, img, Object.assign({ sub }, o))
    : `<button class="pjCelda" data-pjm="${esc(dat)}"><b dir="auto">${esc(n)}</b></button>`);
  const tuyos = I.map((p) => { const sel = PREFS.skin === 'gmpm:' + p.r; return celda('sel:gmpm:' + p.r, p.n, p.img, p.addon, { sel, acc: sel ? glifo('si') + esc(T('pj.enUso')) : esc(T('pj.equipar')), accCls: sel ? 'pjAccOk' : 'pjAccEq' }); }).join('');
  const ws = PJM.ws === null ? '<p class="pjmVacio">…</p>' : PJM.ws.map((x) => { const baja = PJM.bajando.has(String(x.id));
    return celda('inst:' + x.id, x.t, x.img, baja ? T('pjm.bajando') : x.mb + ' MB', { acc: baja ? esc(T('pjm.bajando')) + '…' : glifo('bajar') + esc(T('pjm.instalar')), accCls: baja ? 'pjAccVa' : 'pjAccSi' }); }).join('') || `<p class="pjmVacio">${esc(T('pjm.sinRes'))}</p>`;
  return `<div class="pjGrid pjmGrid"><div class="rbSecc pjmTit">${esc(T('pjm.tuyos'))}<em>${I.length}</em></div>${tuyos || `<p class="pjmVacio">${esc(T('pjm.ninguno'))}</p>`}
    <div class="rbSecc pjmTit">${esc(T('pjm.workshop'))}</div>${ws}</div>`;
}
function pjmHTML() { return `<div class="pjmCaja"><div class="pjmBarra"><input class="pjmBus" type="search" dir="auto" placeholder="${esc(T('pjm.buscar'))}" value="${esc(PJM.q)}"><label class="rbBtnGris rbChico pjmImp">${glifo('subir')} ${esc(T('pjm.importar'))}<input type="file" accept=".gma,.bin" hidden></label></div><div class="pjmListas">${pjmListasHTML()}</div></div>`; }
// (antes de bajar un modelo, una pregunta: un toque sin querer bajaba megas)
function pjmConfirmar(id) {
  const x = PJM.cat && PJM.cat.porId.get(String(id)) || (PJM.ws || []).find((y) => String(y.id) === String(id));
  confirmar(T('pjm.seguro').replace('{n}', x ? x.t : id).replace('{mb}', x && x.mb ? x.mb + ' MB' : '?'), T('pjm.instalar'), () => pjmInstalar(id));
}
// importar un personaje: un .gma de la compu o del celular (un modelo de jugador de GMod); si trae uno, se lo pone
async function pjmImportar(f) {
  try { const A = await gmImportarArchivo(f); if (A && A.listo) await A.listo;
    // (importado de un archivo no tiene número del Workshop: los demás no lo pueden bajar y te ven con el Hero; se avisa)
    const L = gmpLista().filter((r) => A && A.G.archivos.has(r)); if (L.length) { pjElegirSkin('gmpm:' + L[0]); aviso(T('pjm.soloVos'), 6); } else aviso(T('pjm.sinModelo'), 3); pjmDibujar();
  } catch (e) { aviso(T('errFormato') + ': ' + String((e && e.message) || e).slice(0, 60), 3); }
}
function pjmDibujar() { for (const L of document.querySelectorAll('.pjmListas')) L.innerHTML = pjmListasHTML(); }
function pjmMontar(raiz) {
  const c = raiz.querySelector('.pjmCaja'); if (!c || c._pjm) return; c._pjm = 1;
  if (PJM.ws === null || performance.now() - PJM.t > 60000) { PJM.t = performance.now(); pjmBuscar(); }
  // (el buscador y «Importar personaje»: adentro de la caja o, en el panel de Personajes, arriba y en el pie)
  const b = c.querySelector('.pjmBus') || raiz.querySelector('.pjmBus'); let tt = 0;
  if (b) { b.addEventListener('input', () => { PJM.q = b.value; pjmDibujar(); clearTimeout(tt); tt = setTimeout(pjmBuscar, 250); }); b.addEventListener('keydown', (e) => e.stopPropagation()); }
  c.addEventListener('click', (e) => { const x = e.target.closest('[data-pjm]'); if (!x) return; e.stopPropagation(); const [k, ...r] = x.dataset.pjm.split(':'), v = r.join(':'); if (k === 'sel') pjElegirSkin(v); else if (k === 'inst') pjmConfirmar(v); });
  const fi = c.querySelector('.pjmImp input') || raiz.querySelector('.pjmImp input'); if (fi) fi.addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) pjmImportar(f); e.target.value = ''; });
}
// cambiar de personaje (del juego o de un mod): jugando, al momento; en el menú, en el de la vista
function pjElegirSkin(s) {
  if (typeof censPermite === 'function' && !censPermite(s)) return;
  PREFS.skin = s; guardarPrefs();
  const rb = typeof rbVisible === 'function' && rbVisible() && typeof RB !== 'undefined' && RB.panel === 'personajes';
  if (typeof JUEGO !== 'undefined' && JUEGO.estado === 'juego') { jugadorCuerpoNuevo(); if (!rb) aviso(T('pjm.listo') + ' ' + (gmpEs(s) ? s.replace(/^.*\//, '').replace(/\.mdl$/, '') : skinNom(s)), 2); }
  // (el del escenario de Personajes también: en el inicio y jugando, desde la pausa)
  if (typeof menuLobby === 'function' && (rb || JUEGO.estado !== 'juego')) menuLobby(true, true);
  pjmDibujar(); if (typeof pjjDibujar === 'function') pjjDibujar(); if (typeof pjEscenaTexto === 'function') pjEscenaTexto();
  for (const c of document.querySelectorAll('[data-rb^="pjSel:"]')) c.classList.toggle('sel', c.dataset.rb === 'pjSel:' + s);
}
async function pjmInstalar(id) {
  id = String(id); if (PJM.bajando.has(id)) return;
  const x = PJM.cat && PJM.cat.porId.get(id); if (typeof censOficial === 'function' && censOficial() && censModMotivo(x)) { censModAviso(); return; }
  PJM.bajando.add(id); pjmDibujar(); aviso(T('pjm.bajando') + ': ' + (x ? x.t : id), 3);
  try {
    // (por la cola de descargas: baja en segundo plano y se puede seguir jugando; al terminar se pone el personaje)
    const A = await gmcPoner(id, { nombre: x ? x.t : id, img: x ? x.img : '', callado: true }); if (A && A.listo) await A.listo;
    PJM.ws = PJM.ws ? PJM.ws.filter((y) => String(y.id) !== id) : PJM.ws;
    const L = gmpLista().filter((r) => A && A.G.archivos.has(r)); if (L.length) pjElegirSkin('gmpm:' + L[0]); else aviso(T('pjm.sinModelo'), 3);
  } catch (e) { if (!(e && e.cancelado)) aviso(String((e && e.message) || e).slice(0, 90), 3); }
  PJM.bajando.delete(id); pjmDibujar();
}
// ---- en la pausa: Personaje (los del juego, los de mods y los gorros) ----
// (GOLDEN) es el mismo panel de Personajes del inicio, con el escenario 3D, arriba de la partida; «Volver a la pausa» vuelve
// a la pausa. El panel viejo (pjjAbrirViejo) queda por si el inicio no está
function pjjAbrir() {
  if (typeof inicioMostrar !== 'function' || typeof RB === 'undefined') return pjjAbrirViejo();
  if (typeof cerrarPaneles === 'function') cerrarPaneles();
  if (typeof RBM !== 'undefined' && RBM.pjTab !== 'hat') RBM.pjTab = gmpEs(PREFS.skin) ? 'mod' : 'skin';
  RB.desdeJuego = 'pausa'; inicioMostrar(true); inicioPanel('personajes'); UI.abierto = 'personaje';
}
// (volver de Personajes a la pausa)
function pjjVolverPausa() {
  RB.desdeJuego = false; inicioMostrar(false); if (typeof menuMostrar === 'function') menuMostrar(false);
  const h = $('hud'); if (h) h.classList.remove('oc'); UI.abierto = null; abrirPausa();
}
function pjjAbrirViejo() {
  let P = $('pjJuego');
  if (!P) { P = document.createElement('div'); P.id = 'pjJuego'; P.className = 'panel oc'; document.body.appendChild(P); P.addEventListener('click', (e) => { if (e.target === P) pjjCerrar(); }); }
  PJM.tabJ = PJM.tabJ || (gmpEs(PREFS.skin) ? 'mod' : 'skin');
  P.innerHTML = `<div class="caja pjjCaja"><div class="pjjCab"><h3>${esc(T('pj.boton'))}</h3><span class="rbTabs"><button class="rbTab" data-pjj="skin">${esc(T('pj.skins'))}</button><button class="rbTab" data-pjj="mod">${esc(T('pjm.tab'))}</button></span><button class="pjjX" data-pjj="x">✕</button></div><div class="pjjCuerpo"></div></div>`;
  P.querySelector('.pjjCaja').addEventListener('click', (e) => { const b = e.target.closest('[data-pjj]'); if (!b) return; const v = b.dataset.pjj; if (v === 'x') pjjCerrar(); else { PJM.tabJ = v; pjjDibujar(); } });
  $('pausa').classList.add('oc'); P.classList.remove('oc'); UI.abierto = 'personaje'; pjjDibujar();
}
function pjjDibujar() {
  const P = $('pjJuego'); if (!P || P.classList.contains('oc')) return; const C = P.querySelector('.pjjCuerpo'); if (!C) return;
  for (const b of P.querySelectorAll('[data-pjj="skin"],[data-pjj="mod"]')) b.classList.toggle('sel', b.dataset.pjj === PJM.tabJ);
  if (PJM.tabJ === 'mod') { if (!C.querySelector('.pjmCaja')) { C.innerHTML = pjmHTML(); pjmMontar(C); } else pjmDibujar(); return; }
  C.innerHTML = `<div class="pjGrid">${DATA.chars.map((s) => { const ic = RETRATO[s] || s, img = DATA.ico[ic] ? icono(ic) : ''; return `<button class="pjCelda${PREFS.skin === s ? ' sel' : ''}" data-pjs="${esc(s)}"><i style="${img ? `background-image:url(${img})` : ''}">${img ? '' : glifo('persona')}</i><b>${esc(skinNom(s))}</b></button>`; }).join('')}</div>`;
  C.querySelector('.pjGrid').addEventListener('click', (e) => { const b = e.target.closest('[data-pjs]'); if (b) pjElegirSkin(b.dataset.pjs); });
}
function pjjCerrar() { const P = $('pjJuego'); if (P) P.classList.add('oc'); if (UI.abierto === 'personaje') { UI.abierto = 'pausa'; $('pausa').classList.remove('oc'); } }
Object.assign(IDI3, {
  'pj.boton': ['Personaje', 'Character', 'Personagem', 'Karakter', 'Watak', 'Karakter', 'キャラクター', 'ตัวละคร', 'Karakter', 'الشخصية', 'Персонаж', 'Персонаж', 'Personnage', 'Figur'],
  'pjm.tab': ['Mods', 'Mods', 'Mods', 'Mod', 'Mod', 'Mods', 'MOD', 'ม็อด', 'Modlar', 'المودات', 'Моды', 'Моди', 'Mods', 'Mods'],
  'pjm.buscar': ['Buscar personaje…', 'Search character…', 'Buscar personagem…', 'Cari karakter…', 'Cari watak…', 'Maghanap ng karakter…', 'キャラを検索…', 'ค้นหาตัวละคร…', 'Karakter ara…', 'ابحث عن شخصية…', 'Найти персонажа…', 'Знайти персонажа…', 'Chercher un personnage…', 'Figur suchen…'],
  'pjm.tuyos': ['Modelos de tus mods', 'Models from your mods', 'Modelos dos seus mods', 'Model dari mod kamu', 'Model daripada mod anda', 'Mga model mula sa mods mo', 'あなたのMODのモデル', 'โมเดลจากม็อดของคุณ', 'Modlarındaki modeller', 'نماذج من موداتك', 'Модели из твоих модов', 'Моделі з твоїх модів', 'Modèles de tes mods', 'Modelle aus deinen Mods'],
  'pjm.workshop': ['Del Workshop (tocá uno para instalarlo y ponértelo)', 'From the Workshop (tap one to install and wear it)', 'Do Workshop (toque em um para instalar e usar)', 'Dari Workshop (ketuk untuk memasang dan memakai)', 'Dari Workshop (ketik untuk pasang dan pakai)', 'Mula sa Workshop (pindutin para i-install at gamitin)', 'ワークショップから（タップで導入して着る）', 'จาก Workshop (แตะเพื่อติดตั้งและใช้)', 'Workshop’tan (yükleyip giymek için dokun)', 'من الورشة (المس واحدًا لتثبيته وارتدائه)', 'Из Workshop (нажми, чтобы установить и надеть)', 'З Workshop (натисни, щоб встановити й одягнути)', 'Du Workshop (touche pour l’installer et le porter)', 'Aus dem Workshop (antippen zum Installieren und Anziehen)'],
  'pjm.ninguno': ['Todavía no tenés modelos de jugador de mods: buscá uno abajo', 'No player models from mods yet: find one below', 'Ainda sem modelos de jogador de mods: procure um abaixo', 'Belum ada model pemain dari mod: cari di bawah', 'Belum ada model pemain daripada mod: cari di bawah', 'Wala pang player model mula sa mods: maghanap sa ibaba', 'MODのプレイヤーモデルはまだありません：下で探してね', 'ยังไม่มีโมเดลผู้เล่นจากม็อด: ค้นหาด้านล่าง', 'Henüz moddan oyuncu modeli yok: aşağıdan bul', 'لا توجد نماذج لاعب من المودات بعد: ابحث بالأسفل', 'Пока нет моделей игрока из модов: найди ниже', 'Поки немає моделей гравця з модів: знайди нижче', 'Pas encore de modèles de joueur : cherches-en un ci-dessous', 'Noch keine Spielermodelle aus Mods: unten suchen'],
  'pjm.auto': ['rig automático', 'auto-rig', 'rig automático', 'rig otomatis', 'rig automatik', 'auto-rig', '自動リグ', 'ริกอัตโนมัติ', 'otomatik iskelet', 'هيكل تلقائي', 'авториг', 'авториг', 'rig auto', 'Auto-Rig'],
  'pjm.instalar': ['Instalar', 'Install', 'Instalar', 'Pasang', 'Pasang', 'I-install', '導入', 'ติดตั้ง', 'Yükle', 'تثبيت', 'Установить', 'Встановити', 'Installer', 'Installieren'],
  'pjm.bajando': ['Bajando el personaje', 'Downloading the character', 'Baixando o personagem', 'Mengunduh karakter', 'Memuat turun watak', 'Dina-download ang karakter', 'キャラをダウンロード中', 'กำลังดาวน์โหลดตัวละคร', 'Karakter indiriliyor', 'جارٍ تنزيل الشخصية', 'Загрузка персонажа', 'Завантаження персонажа', 'Téléchargement du personnage', 'Figur wird geladen'],
  'pjm.listo': ['Ahora sos', 'You are now', 'Agora você é', 'Sekarang kamu', 'Sekarang anda', 'Ikaw na ngayon si', '今は', 'ตอนนี้คุณคือ', 'Artık sen', 'أنت الآن', 'Теперь ты', 'Тепер ти', 'Tu es maintenant', 'Du bist jetzt'],
  'pjm.sinRes': ['Sin resultados', 'No results', 'Sem resultados', 'Tidak ada hasil', 'Tiada hasil', 'Walang resulta', '結果なし', 'ไม่พบผลลัพธ์', 'Sonuç yok', 'لا نتائج', 'Ничего не найдено', 'Нічого не знайдено', 'Aucun résultat', 'Keine Ergebnisse'],
  'pjm.nota': ['Los modelos de jugador (personajes) están aparte, en', 'Player models (characters) are separate, in', 'Os modelos de jogador (personagens) estão à parte, em', 'Model pemain (karakter) ada terpisah, di', 'Model pemain (watak) diasingkan, di', 'Hiwalay ang mga player model (karakter), nasa', 'プレイヤーモデル（キャラ）は別の場所：', 'โมเดลผู้เล่น (ตัวละคร) แยกไว้ที่', 'Oyuncu modelleri (karakterler) ayrı, burada:', 'نماذج اللاعب (الشخصيات) منفصلة، في', 'Модели игрока (персонажи) отдельно, в', 'Моделі гравця (персонажі) окремо, у', 'Les modèles de joueur (personnages) sont à part, dans', 'Spielermodelle (Figuren) sind separat, unter'],
  'pjm.soloVos': ['Listo. Ojo: importado de un archivo, en multijugador los demás te ven con el Hero. Instalalo desde el Workshop para que lo vean', 'Done. Note: imported from a file, other players see you as the Hero in multiplayer. Install it from the Workshop so they can see it', 'Pronto. Atenção: importado de um arquivo, no multijogador os outros te veem com o Hero. Instale pelo Workshop para que vejam', 'Selesai. Catatan: diimpor dari file, pemain lain melihatmu sebagai Hero di multipemain. Pasang dari Workshop agar mereka bisa melihatnya', 'Siap. Nota: diimport daripada fail, pemain lain nampak anda sebagai Hero dalam multipemain. Pasang dari Workshop supaya mereka nampak', 'Tapos na. Paalala: galing sa file, Hero ang makikita ng iba sa multiplayer. I-install ito mula sa Workshop para makita nila', '完了。ファイルから読み込んだので、マルチプレイでは他の人には Hero に見えます。見えるようにするにはワークショップから入れてください', 'เสร็จแล้ว หมายเหตุ: นำเข้าจากไฟล์ ในโหมดผู้เล่นหลายคนคนอื่นจะเห็นคุณเป็น Hero ติดตั้งจาก Workshop เพื่อให้คนอื่นเห็น', 'Tamam. Not: dosyadan içe aktarıldığı için çok oyunculuda diğerleri seni Hero olarak görür. Görmeleri için Atölye’den yükle', 'تم. ملاحظة: لأنه مستورد من ملف، يراك الآخرون في اللعب الجماعي بشخصية Hero. ثبّته من الورشة ليروه', 'Готово. Учти: импортировано из файла, в мультиплеере другие видят тебя как Hero. Установи из Мастерской, чтобы его видели', 'Готово. Увага: імпортовано з файлу, у мультиплеєрі інші бачать тебе як Hero. Встанови з Майстерні, щоб його бачили', 'C’est fait. Attention : importé d’un fichier, en multijoueur les autres te voient en Hero. Installe-le depuis le Workshop pour qu’ils le voient', 'Fertig. Hinweis: aus einer Datei importiert, sehen dich andere im Mehrspieler als Hero. Installiere es aus dem Workshop, damit sie es sehen'],
  'pjm.sinModelo': ['Ese addon no trae un modelo de jugador que se pueda usar', 'That addon has no usable player model', 'Esse addon não tem modelo de jogador utilizável', 'Addon itu tidak punya model pemain yang bisa dipakai', 'Addon itu tiada model pemain yang boleh digunakan', 'Walang magagamit na player model ang addon na iyan', 'そのアドオンには使えるプレイヤーモデルがありません', 'แอดออนนี้ไม่มีโมเดลผู้เล่นที่ใช้ได้', 'Bu eklentide kullanılabilir oyuncu modeli yok', 'هذه الإضافة لا تحتوي نموذج لاعب قابلًا للاستخدام', 'В этом аддоне нет подходящей модели игрока', 'У цьому аддоні немає придатної моделі гравця', 'Cet addon n’a pas de modèle de joueur utilisable', 'Dieses Addon hat kein nutzbares Spielermodell'],
});
