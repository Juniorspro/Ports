// ---------------------------------------------------------------------------------------------------------
// las armas propias de JXMod (3.9): pedido del dueño, «el juego ahora sí debe ser único». La Physics Gun, la Gravity Gun,
// la Tool Gun y la palanca se ven con modelos hechos acá, en código (nada de Half-Life ni de GMod), con el amarillo y
// negro de JXMod. Por dentro siguen siendo las mismas armas (los mismos nombres y lo que hacen): las partidas guardadas,
// los servers y los addons andan igual. Las de GMod y Half-Life quedan en el mod de la comunidad «Armas clásicas», que
// viene instalado: prendido, se ven ésas.
// Los modelos: piezas (cajas biseladas, cilindros, anillos, esferas) armadas en metros, con el origen donde va la mano
// derecha (+z adelante, por donde sale el rayo; +y arriba; +x a la derecha), una malla por material.
// ---------------------------------------------------------------------------------------------------------
const AJX = { modelos: {}, mats: null, t: 0 };

// ---------------- el kit de modelado ----------------
const ajxNuevo = () => ({ P: [], N: [], U: [], I: [] });
function ajxVert(B, p, n, u, v) { B.P.push(p.x, p.y, p.z); B.N.push(n.x, n.y, n.z); B.U.push(u, v); return B.P.length / 3 - 1; }
function ajxTri(B, a, b, c) { B.I.push(a, b, c); }
// una base (dos ejes perpendiculares a d)
function ajxBase(d) { const a = Math.abs(d.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0), x = vcross(a, d).norm(), y = vcross(d, x).norm(); return [x, y]; }
// cilindro (o cono truncado) de a a b, radios r0 y r1, con tapas; seg lados; suave (normales que siguen la curva)
function ajxCil(B, a, b, r0, r1, seg, tapas, fase) {
  const d = vsub(b, a), L = d.len(); d.norm(); const [ex, ey] = ajxBase(d), n = seg || 16, f0 = fase || 0;
  const k0 = B.P.length / 3, inc = (r0 - r1) / L;   // (la normal de un cono se inclina hacia la punta)
  for (let i = 0; i <= n; i++) {
    const t = f0 + i / n * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), rad = vadd(vscale(ex, c), vscale(ey, s)), nn = vadd(rad, vscale(d, inc)).norm();
    ajxVert(B, vadd(a, vscale(rad, r0)), nn, i / n * 2 * Math.PI * r0 / 0.1, 0); ajxVert(B, vadd(b, vscale(rad, r1)), nn, i / n * 2 * Math.PI * r1 / 0.1, L / 0.1);
  }
  for (let i = 0; i < n; i++) { const p = k0 + i * 2; ajxTri(B, p, p + 2, p + 1); ajxTri(B, p + 1, p + 2, p + 3); }
  if (tapas) for (const [o, r, s] of [[a, r0, -1], [b, r1, 1]]) {
    if (r <= 1e-5) continue; const nn = vscale(d, s), c0 = ajxVert(B, o, nn, 0.5, 0.5), k = B.P.length / 3;
    for (let i = 0; i <= n; i++) { const t = f0 + i / n * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t); ajxVert(B, vadd(o, vadd(vscale(ex, c * r), vscale(ey, sn * r))), nn, 0.5 + c * 0.5, 0.5 + sn * 0.5); }
    for (let i = 0; i < n; i++) s > 0 ? ajxTri(B, c0, k + i, k + i + 1) : ajxTri(B, c0, k + i + 1, k + i);
  }
}
// anillo (toro) alrededor del eje d en c: radio R y grosor r
function ajxToro(B, c, d, R, r, s1, s2) {
  d = d.clone().norm(); const [ex, ey] = ajxBase(d), n1 = s1 || 24, n2 = s2 || 10, k0 = B.P.length / 3;
  for (let i = 0; i <= n1; i++) {
    const t = i / n1 * Math.PI * 2, rad = vadd(vscale(ex, Math.cos(t)), vscale(ey, Math.sin(t))), cc = vadd(c, vscale(rad, R));
    for (let j = 0; j <= n2; j++) { const u = j / n2 * Math.PI * 2, nn = vadd(vscale(rad, Math.cos(u)), vscale(d, Math.sin(u))).norm(); ajxVert(B, vadd(cc, vscale(nn, r)), nn, i / n1 * 4, j / n2); }
  }
  for (let i = 0; i < n1; i++) for (let j = 0; j < n2; j++) { const a = k0 + i * (n2 + 1) + j, b = a + n2 + 1; ajxTri(B, a, b, a + 1); ajxTri(B, a + 1, b, b + 1); }
}
// esfera
function ajxEsfera(B, c, r, seg) {
  const n = seg || 14, k0 = B.P.length / 3;
  for (let i = 0; i <= n; i++) { const th = i / n * Math.PI; for (let j = 0; j <= n * 2; j++) { const ph = j / (n * 2) * Math.PI * 2, nn = v3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)); ajxVert(B, vadd(c, vscale(nn, r)), nn, j / (n * 2), i / n); } }
  for (let i = 0; i < n; i++) for (let j = 0; j < n * 2; j++) { const a = k0 + i * (n * 2 + 1) + j, b = a + n * 2 + 1; ajxTri(B, a, a + 1, b); ajxTri(B, a + 1, b + 1, b); }
}
// caja biselada: centro, medios lados h [x, y, z], giro q y bisel e (los filos cortados a 45°: las caras chicas en los
// filos y triángulos en las esquinas, cada uno con su normal)
function ajxCaja(B, c, h, q, e) {
  q = q || new Quat(); e = Math.min(e === undefined ? 0.004 : e, h[0] * 0.45, h[1] * 0.45, h[2] * 0.45);
  const E = [q.rot(v3(1, 0, 0)), q.rot(v3(0, 1, 0)), q.rot(v3(0, 0, 1))];
  // (el punto de la esquina (sx, sy, sz) metido e en los ejes que no son 'a')
  const P = (sx, sy, sz, a) => { const s = [sx, sy, sz], o = [0, 1, 2].map((k) => s[k] * (k === a ? h[k] : h[k] - e)); return vadd(c, vadd(vscale(E[0], o[0]), vadd(vscale(E[1], o[1]), vscale(E[2], o[2])))); };
  const quad = (p0, p1, p2, p3, n) => { const k = B.P.length / 3, w = p0.distTo(p1) / 0.1, hh = p0.distTo(p3) / 0.1; ajxVert(B, p0, n, 0, 0); ajxVert(B, p1, n, w, 0); ajxVert(B, p2, n, w, hh); ajxVert(B, p3, n, 0, hh);
    if (vdot(vcross(vsub(p1, p0), vsub(p2, p0)), n) < 0) { ajxTri(B, k, k + 2, k + 1); ajxTri(B, k, k + 3, k + 2); } else { ajxTri(B, k, k + 1, k + 2); ajxTri(B, k, k + 2, k + 3); } };
  const tri = (p0, p1, p2, n) => { const k = B.P.length / 3; ajxVert(B, p0, n, 0, 0); ajxVert(B, p1, n, 1, 0); ajxVert(B, p2, n, 0, 1); if (vdot(vcross(vsub(p1, p0), vsub(p2, p0)), n) < 0) ajxTri(B, k, k + 2, k + 1); else ajxTri(B, k, k + 1, k + 2); };
  // las 6 caras
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
    const b = (a + 1) % 3, cc = (a + 2) % 3, pt = (i, j) => { const v = [0, 0, 0]; v[a] = s; v[b] = i; v[cc] = j; return P(v[0], v[1], v[2], a); };
    quad(pt(-1, -1), pt(1, -1), pt(1, 1), pt(-1, 1), vscale(E[a], s));
  }
  // los 12 filos (entre la cara a y la b, a lo largo de c)
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) { const cc = 3 - a - b; for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
    const pt = (sc, de) => { const v = [0, 0, 0]; v[a] = sa; v[b] = sb; v[cc] = sc; return P(v[0], v[1], v[2], de); };
    quad(pt(-1, a), pt(1, a), pt(1, b), pt(-1, b), vadd(vscale(E[a], sa), vscale(E[b], sb)).norm());
  } }
  // las 8 esquinas
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) tri(P(sx, sy, sz, 0), P(sx, sy, sz, 1), P(sx, sy, sz, 2), vadd(vscale(E[0], sx), vadd(vscale(E[1], sy), vscale(E[2], sz))).norm());
}
const ajxQ = (ax, ay, az) => Quat.euler(ay || 0, ax || 0, az || 0);   // (giros en radianes: x arriba/abajo, y a los costados)

// ---------------- los materiales ----------------
function ajxMats() {
  if (AJX.mats) return AJX.mats;
  AJX.mats = {
    amarillo: matPropio('ajxAmarillo', [0.95, 0.62, 0.05], { pbr: [0.32, 0.15, 0.05] }),   // (pintura: el amarillo de JXMod)
    negro: matPropio('ajxNegro', [0.035, 0.037, 0.042], { pbr: [0.45, 0.35, 0.05] }),
    metal: matPropio('ajxMetal', [0.22, 0.23, 0.25], { pbr: [0.28, 0.95, 0.05] }),
    acero: matPropio('ajxAcero', [0.55, 0.56, 0.58], { pbr: [0.2, 1, 0.05] }),
    goma: matPropio('ajxGoma', [0.02, 0.02, 0.022], { pbr: [0.85, 0, 0.04] }),
    cobre: matPropio('ajxCobre', [0.72, 0.38, 0.18], { pbr: [0.3, 1, 0.05] }),
    brillo: matPropio('ajxBrillo', [1, 0.72, 0.18], { pbr: [0.3, 0, 0.04], em: [5.5, 3.4, 0.6] }),   // (lo que brilla: ámbar)
    brilloSuave: matPropio('ajxBrilloS', [1, 0.6, 0.15], { pbr: [0.4, 0, 0.04], em: [1.6, 0.9, 0.15] }),
    vidrio: matPropio('ajxVidrio', [0.05, 0.06, 0.07], { pbr: [0.06, 0.3, 0.06] }),
  };
  return AJX.mats;
}

// ---------------- la Physics Gun de JXMod («el Manipulador») ----------------
// Cuerpo amarillo con el lomo negro, la batería atrás con su anillo de luz, tres bobinas de cobre en el caño, dos garras
// arriba y abajo de la boca y el núcleo ámbar en la punta; el mango y el puño de adelante de goma. ~56 cm de largo.
function ajxModeloFisica() {
  const p = {}, B = (k) => p[k] || (p[k] = ajxNuevo()), V = v3;
  // el cuerpo: una caja larga amarilla con el lomo y la panza negros
  ajxCaja(B('amarillo'), V(0, 0.072, 0.115), [0.034, 0.042, 0.19], null, 0.009);
  ajxCaja(B('negro'), V(0, 0.118, 0.1), [0.026, 0.008, 0.165], null, 0.004);                 // el lomo
  for (let i = 0; i < 6; i++) ajxCaja(B('metal'), V(0, 0.128, 0.0 + i * 0.035), [0.018, 0.003, 0.008], null, 0.0015);   // las aletas del lomo
  ajxCaja(B('negro'), V(0, 0.031, 0.14), [0.03, 0.006, 0.15], null, 0.003);                   // la panza
  // los costados: una franja negra con rayas amarillas en diagonal (la cinta de peligro) y la pantallita
  for (const sx of [-1, 1]) {
    ajxCaja(B('negro'), V(sx * 0.0345, 0.072, 0.175), [0.002, 0.014, 0.075], null, 0.001);
    for (let i = 0; i < 6; i++) ajxCaja(B('amarillo'), V(sx * 0.0362, 0.072, 0.115 + i * 0.024), [0.0015, 0.0125, 0.004], ajxQ(0.6, 0, 0), 0.0005);
    ajxCaja(B('vidrio'), V(sx * 0.035, 0.075, 0.035), [0.002, 0.016, 0.026], null, 0.002);
    ajxCaja(B('brilloSuave'), V(sx * 0.0366, 0.075, 0.035), [0.0007, 0.011, 0.02], null, 0.0004);
  }
  // atrás: la batería, una caja negra con la tapa amarilla y dos luces chicas de carga (de atrás no parece una boca)
  ajxCaja(B('negro'), V(0, 0.07, -0.098), [0.03, 0.036, 0.03], null, 0.007);
  ajxCaja(B('amarillo'), V(0, 0.07, -0.13), [0.026, 0.032, 0.004], null, 0.003);
  ajxCaja(B('metal'), V(0, 0.07, -0.136), [0.016, 0.02, 0.003], null, 0.002);
  for (const sy of [-1, 1]) ajxCaja(B('brilloSuave'), V(0.0315, 0.07 + sy * 0.014, -0.098), [0.0012, 0.006, 0.012], null, 0.0006);
  // adelante: el caño de metal con tres bobinas de cobre (cada una con su línea de luz)
  ajxCil(B('metal'), V(0, 0.07, 0.29), V(0, 0.07, 0.43), 0.022, 0.02, 24, false);
  for (let i = 0; i < 3; i++) { const z = 0.315 + i * 0.035; ajxToro(B('cobre'), V(0, 0.07, z), V(0, 0, 1), 0.026, 0.0075, 28, 10); ajxToro(B('brilloSuave'), V(0, 0.07, z + 0.012), V(0, 0, 1), 0.023, 0.0016, 24, 6); }
  // las garras: arriba y abajo de la boca, salen del cuerpo y se cierran hacia el núcleo
  for (const sy of [-1, 1]) {
    ajxCaja(B('amarillo'), V(0, 0.07 + sy * 0.042, 0.33), [0.012, 0.006, 0.05], ajxQ(sy * 0.12, 0, 0), 0.003);
    ajxCaja(B('negro'), V(0, 0.07 + sy * 0.034, 0.405), [0.01, 0.005, 0.035], ajxQ(sy * 0.42, 0, 0), 0.003);
    ajxCaja(B('acero'), V(0, 0.07 + sy * 0.02, 0.437), [0.008, 0.004, 0.012], ajxQ(sy * 0.9, 0, 0), 0.002);
  }
  // el núcleo: una esfera ámbar en la boca, adentro de un aro de acero
  ajxEsfera(B('brillo'), V(0, 0.07, 0.445), 0.014, 14);
  ajxToro(B('acero'), V(0, 0.07, 0.432), V(0, 0, 1), 0.021, 0.0035, 28, 8);
  // el mango (inclinado 14° hacia atrás, de goma con tres ranuras), el gatillo y su guardamonte
  const qm = ajxQ(0.24, 0, 0);
  ajxCaja(B('goma'), V(0, -0.025, -0.012), [0.017, 0.058, 0.024], qm, 0.008);
  for (let i = 0; i < 3; i++) ajxCaja(B('negro'), vadd(V(0, -0.025, -0.012), qm.rot(V(0, 0.03 - i * 0.026, 0.024))), [0.0175, 0.0035, 0.003], qm, 0.0015);
  ajxCaja(B('amarillo'), vadd(V(0, -0.025, -0.012), qm.rot(V(0, -0.06, 0))), [0.019, 0.006, 0.028], qm, 0.004);   // la base del mango
  ajxCaja(B('metal'), V(0, 0.012, 0.028), [0.005, 0.014, 0.004], ajxQ(0.35, 0, 0), 0.002);            // el gatillo
  ajxCaja(B('negro'), V(0, -0.006, 0.042), [0.006, 0.003, 0.03], null, 0.0015);                     // el guardamonte
  ajxCaja(B('negro'), V(0, 0.01, 0.07), [0.006, 0.018, 0.003], null, 0.0015);
  // abajo, adelante: el emisor de la panza (una lente ámbar en su soporte)
  ajxCaja(B('negro'), V(0, 0.018, 0.25), [0.014, 0.01, 0.03], null, 0.004);
  ajxCil(B('brilloSuave'), V(0, 0.008, 0.25), V(0, 0.005, 0.25), 0.008, 0.008, 16, true);
  return { partes: p, boca: V(0, 0.07, 0.46), mano: { p: V(0, -0.01, -0.012), eje: qm.rot(V(0, 1, 0)) }, gatillo: V(0, 0.002, 0.034), manoI: null, luz: [1, 0.72, 0.18] };
}
const AJX_DISENOS = { fisica: ajxModeloFisica };
// las mallas de un modelo (se arman una vez y quedan en la placa)
function ajxModelo(nom) {
  let m = AJX.modelos[nom]; if (m && m.partes.every((x) => R.mallas[x.malla])) return m;
  const D = AJX_DISENOS[nom](), M = ajxMats(), partes = [];
  for (const k in D.partes) { const B = D.partes[k]; if (!B.I.length) continue; const id = mallaPropia(B); if (id >= 0) partes.push({ malla: id, mat: M[k], tris: B.I.length / 3 }); }
  return (AJX.modelos[nom] = Object.assign({}, D, { partes, cpu: D.partes }));
}
function ajxDibujarModelo(m, M) { for (const x of m.partes) encolar(x.malla, 0, x.mat, M, null, null); }

// ---------------- en la mano, en primera persona ----------------
// dónde va respecto de la cámara (en metros: a la derecha, abajo y adelante) y cuánto se gira hacia el centro
const AJX_VISTA = { fisica: { p: [-0.17, -0.18, 0.5], giro: [0.01, 0.13, -0.05] } };   // (en el espacio de la cámara la derecha de la pantalla es -x)
// ¿se ven las propias? (con el mod de la comunidad «Armas clásicas» prendido, las de GMod)
const ajxActivas = () => !(typeof MODS !== 'undefined' && MODS.armasClasicas);
const ajxDeArma = (n) => { const D = typeof DEF_ARMAS !== 'undefined' && DEF_ARMAS[n]; return D && D.jx && ajxActivas() ? D.jx : null; };
// la inversa de una matriz de giro y lugar (sin escala): el giro transpuesto y el lugar al revés
function ajxInvRigida(m, o) {
  o[0] = m[0]; o[1] = m[4]; o[2] = m[8]; o[3] = 0; o[4] = m[1]; o[5] = m[5]; o[6] = m[9]; o[7] = 0; o[8] = m[2]; o[9] = m[6]; o[10] = m[10]; o[11] = 0;
  o[12] = -(m[0] * m[12] + m[1] * m[13] + m[2] * m[14]); o[13] = -(m[4] * m[12] + m[5] * m[13] + m[6] * m[14]); o[14] = -(m[8] * m[12] + m[9] * m[13] + m[10] * m[14]); o[15] = 1; return o;
}
const _ajM = new Float32Array(16), _ajA = new Float32Array(16), _ajB = new Float32Array(16), _ajC = new Float32Array(16), _ajD = new Float32Array(16), _ajE = new Float32Array(16), _ajF = new Float32Array(16);
function ajxVistaDibujar(nom) {
  const m = ajxModelo(nom), C = AJX_VISTA[nom] || AJX_VISTA.fisica, t = TIEMPO.t;
  if (AJX.ult !== nom) { AJX.ult = nom; AJX.sacarT = t; ajxSonidos(); }
  // sacarla: sube desde abajo girando (0,45 s); sostener algo: tiembla apenas y el núcleo late
  const ks = clamp((t - (AJX.sacarT || -9)) / 0.45, 0, 1), es = 1 - Math.pow(1 - ks, 3);
  const sost = typeof ARM !== 'undefined' && !!ARM.agarre, vib = sost ? 0.0012 : 0;
  const sw = (typeof ARM !== 'undefined' && ARM.sway) || {}, k = 0.3;
  const px = C.p[0] - (sw.x || 0) * k + Math.sin(t * 41) * vib, py = C.p[1] + (sw.y || 0) * k - (1 - es) * 0.28 + Math.sin(t * 37) * vib, pz = C.p[2] + (sw.z || 0) * k - (1 - es) * 0.06;
  const q = Quat.euler(C.giro[1] + (sw.qy || 0) * 0.6, C.giro[0] + (1 - es) * 0.9 + (sw.qx || 0) * 0.6, C.giro[2] + (1 - es) * -0.4);
  const cf = AJX.camFija, cq = cf ? cf.q : CAM.q, cp = cf ? cf.p : CAM.pos;   // (camFija: las pruebas miran la mano de costado)
  m4trs([cp.x, cp.y, cp.z], [cq.x, cq.y, cq.z, cq.w], [1, 1, 1], _ajA);
  if (typeof armaAjAplicar === 'function') armaAjAplicar(_ajA, typeof ARM !== 'undefined' ? ARM.apK || 0 : 0);   // (cómo la agarra cada uno: armaaj.js)
  // (el movimiento —sacarla, el balanceo— respecto del lugar de siempre: lo mismo para el arma y para las manos)
  const q0 = Quat.euler(C.giro[1], C.giro[0], C.giro[2]);
  m4trs([C.p[0], C.p[1], C.p[2]], [q0.x, q0.y, q0.z, q0.w], [1, 1, 1], _ajC); ajxInvRigida(_ajC, _ajD);
  m4trs([px, py, pz], [q.x, q.y, q.z, q.w], [1, 1, 1], _ajB); m4mul(_ajB, _ajD, _ajE);   // (la base de siempre → la de ahora)
  m4mul(_ajA, _ajE, _ajF);   // (cámara × movimiento)
  m4mul(_ajF, _ajC, _ajM);
  ajxDibujarModelo(m, _ajM);
  ajxManosDibujar(nom, m, _ajF);
  AJX.vistaM = _ajM; AJX.vistaMod = m; AJX.vistaT = t;
  return true;
}
// la boca del arma en el mundo (para el rayo), si se dibujó en este cuadro
function ajxBocaMundo() {
  const M = AJX.vistaM, m = AJX.vistaMod; if (!M || !m || AJX.vistaT !== TIEMPO.t) return null;
  const b = m.boca; return v3(M[0] * b.x + M[4] * b.y + M[8] * b.z + M[12], M[1] * b.x + M[5] * b.y + M[9] * b.z + M[13], M[2] * b.x + M[6] * b.y + M[10] * b.z + M[14]);
}
// en el mundo: lo que se pidió mostrar suelto (AJX.vitrina: [{ nom, M }]), para las pruebas, el tráiler y los íconos
function ajxMundoDibujar() { if (AJX.vitrina) for (const x of AJX.vitrina) ajxDibujarModelo(ajxModelo(x.nom), x.M); }

// ---------------- las manos: las de la vista «Hands» agarrando el arma (cinemática inversa, como el celular) ----------------
// La derecha rodea el mango (los nudillos por el filo de adelante, la palma contra el costado derecho, los dedos por
// adelante y el pulgar del otro lado) con el índice en el gatillo; la izquierda, el puño de adelante. Se resuelve con la
// cámara en el origen y el arma en su lugar de siempre (una vez por arma y tamaño de pantalla); cada cuadro sólo se mueve.
const AJX_MANOS = { v: null, sol: {}, esc: 0 };
function ajxManosVista() {
  if (AJX_MANOS.v) return AJX_MANOS.v;
  const v = vistaArma('Hands', 'ajx'); if (!v) return null;
  const md = v.md; v.h = {}; md.A.forEach((n, i) => { v.h[n.n] = i; });
  v.base = { p: md.p.map((x) => x.slice()), r: md.r.map((x) => x.slice()), s: md.s.map((x) => x.slice()) };
  return (AJX_MANOS.v = v);
}
const ajxPunto = (M, p) => v3(M[0] * p.x + M[4] * p.y + M[8] * p.z + M[12], M[1] * p.x + M[5] * p.y + M[9] * p.z + M[13], M[2] * p.x + M[6] * p.y + M[10] * p.z + M[14]);
const ajxDir = (M, d) => v3(M[0] * d.x + M[4] * d.y + M[8] * d.z, M[1] * d.x + M[5] * d.y + M[9] * d.z, M[2] * d.x + M[6] * d.y + M[10] * d.z).norm();
const _ajO = new Float32Array(16);
// el brazo de un lado (L: 'Right' o 'Left') con la mano en (fT: de la muñeca a los nudillos, sT: del meñique al índice) y
// los nudillos del mayor en k; el hombro atrás, abajo y hacia su lado; el codo hacia afuera y abajo
function ajxBrazo(md, h, L, fT, sT, k, lado) {
  const hand = h[L + 'Hand'], sh = h[L + 'Arm'], el = h[L + 'ForeArm'], m1 = h[L + 'HandMiddle1'], i1 = h[L + 'HandIndex1'], p1 = h[L + 'HandPinky1'];
  if ([hand, sh, el, m1, i1, p1].some((x) => x === undefined)) return false;
  const f0 = vsub(celmPos(md, m1), celmPos(md, hand)).norm(), s0r = vsub(celmPos(md, i1), celmPos(md, p1)).norm();
  const n0 = vcross(s0r, f0).norm(), s0 = vcross(f0, n0).norm();
  const Qb = qBase(f0, s0, vcross(f0, s0)), Qt = qBase(fT, sT, vcross(fT, sT)), qd = Qt.clone().mul(Qb.conj()).norm();
  const qHand = qd.clone().mul(celmQMundo(md, hand)).norm();
  const largoPalma = celmPos(md, m1).distTo(celmPos(md, hand)), wrist = vsub(k, vscale(fT, largoPalma));
  const a = celmPos(md, sh).distTo(celmPos(md, el)), b = celmPos(md, el).distTo(celmPos(md, hand));
  const dirHombro = v3(-0.42 * lado, -0.5, -0.75).norm(), hombro = vadd(wrist, vscale(dirHombro, (a + b) * 0.88));
  if (L === 'Right') { const dh = vsub(hombro, celmPos(md, sh)); md.raiz[12] += dh.x; md.raiz[13] += dh.y; md.raiz[14] += dh.z; md.sucio = true; md.actualizar(); }
  const S = celmPos(md, sh), dW = vsub(wrist, S), dist = Math.min(dW.len(), (a + b) * 0.999), dn = dW.clone().norm();
  const polo = v3(-0.75 * lado, -0.65, 0).norm(), cosA = clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1), alto = a * Math.sqrt(1 - cosA * cosA);
  const lat = vsub(polo, vscale(dn, vdot(polo, dn))).norm(), codo = vadd(S, vadd(vscale(dn, a * cosA), vscale(lat, alto)));
  celmGirar(md, sh, celmDesde(vsub(celmPos(md, el), S).norm(), vsub(codo, S).norm()));
  celmGirar(md, el, celmDesde(vsub(celmPos(md, hand), celmPos(md, el)).norm(), vsub(wrist, celmPos(md, el)).norm()));
  celmPonerQ(md, hand, qHand);
  return true;
}
// los dedos de un lado alrededor de un mango (eje: punto c y dirección g; radio r): cada dedo, juntos y casi paralelos,
// se dobla (las tres falanges) hasta que sus articulaciones quedan a r + su grosor del eje; el índice, si hay gatillo,
// hasta que la punta lo toca; el pulgar apunta a pul (un punto del otro costado)
function ajxDedos(md, h, L, fT, sT, c, g, r, gat, pul) {
  const nT = vcross(fT, sT).norm(), GROSOR = { Index: 0.0085, Middle: 0.0088, Ring: 0.0082, Pinky: 0.0072 }, ABRE = { Index: 0.06, Middle: 0, Ring: -0.06, Pinky: -0.13 };
  const aEje = (p) => { const d = vsub(p, c); return vsub(d, vscale(g, vdot(d, g))).len(); };
  // (los dedos juntos, casi paralelos al mayor, como en el celular: en reposo vienen abiertos en abanico)
  for (const D of CELM_DEDOS) {
    const a1 = h[L + 'Hand' + D + '1'], a2 = h[L + 'Hand' + D + '2']; if (a1 === undefined || a2 === undefined) continue;
    const dir = vsub(celmPos(md, a2), celmPos(md, a1)), dp = vsub(dir, vscale(nT, vdot(dir, nT))).norm();
    celmGirar(md, a1, celmDesde(dp, Quat.axis(nT.x, nT.y, nT.z, ABRE[D] * (L === 'Right' ? 1 : -1)).rot(fT)));
  }
  // (hacia dónde se cierra: el giro chico que acerca la punta del mayor al eje del mango)
  let eje = sT.clone();
  { const j = [1, 2, 3].map((x) => h[L + 'HandMiddle' + x]), tip = h[L + 'HandMiddle4'];
    if (!j.some((x) => x === undefined)) { const r0 = j.map((x) => md.r[x].slice()), punta = () => celmPos(md, tip !== undefined ? tip : j[2]), d0 = aEje(punta());
      for (let x = 0; x < 3; x++) celmGirar(md, j[x], Quat.axis(eje.x, eje.y, eje.z, 0.3));
      if (aEje(punta()) > d0) eje = vscale(eje, -1);
      for (let x = 0; x < 3; x++) md.r[j[x]] = r0[x].slice(); md.sucio = true; md.actualizar(); } }
  for (const D of CELM_DEDOS) {
    const j = [1, 2, 3].map((x) => h[L + 'Hand' + D + x]), tip = h[L + 'Hand' + D + '4']; if (j.some((x) => x === undefined)) continue;
    const r0 = j.map((x) => md.r[x].slice()), pts = [j[1], j[2]].concat(tip !== undefined ? [tip] : []), conGat = D === 'Index' && gat;
    let mejor = 0, err = 1e9;
    for (let ang = 0; ang <= 2.6; ang += 0.03) {
      for (let x = 0; x < 3; x++) md.r[j[x]] = r0[x].slice();
      md.sucio = true; md.actualizar();
      for (let x = 0; x < 3; x++) celmGirar(md, j[x], Quat.axis(eje.x, eje.y, eje.z, ang * [0.45, 1, 0.75][x]));
      let e = 0;
      if (conGat) { const pt = celmPos(md, tip !== undefined ? tip : j[2]); e = pt.distTo(gat) ** 2; }
      else for (const x of pts) { const d = aEje(celmPos(md, x)) - (r + GROSOR[D]); e += d < 0 ? 6 * d * d : d * d; }   // (adentro del mango cuesta más)
      if (e < err) { err = e; mejor = ang; }
    }
    for (let x = 0; x < 3; x++) md.r[j[x]] = r0[x].slice();
    md.sucio = true; md.actualizar();
    for (let x = 0; x < 3; x++) celmGirar(md, j[x], Quat.axis(eje.x, eje.y, eje.z, mejor * [0.45, 1, 0.75][x]));
  }
  const t1 = h[L + 'HandThumb1'], t4 = h[L + 'HandThumb4'] !== undefined ? h[L + 'HandThumb4'] : h[L + 'HandThumb3'];
  if (t1 !== undefined && t4 !== undefined && pul) { const b1 = celmPos(md, t1); celmGirar(md, t1, celmDesde(vsub(celmPos(md, t4), b1).norm(), vsub(pul, b1).norm())); }
}
function ajxManosResolver(nom, m, Mb) {
  const v = ajxManosVista(); if (!v) return null;
  const md = v.md, h = v.h;
  for (let i = 0; i < md.p.length; i++) { md.p[i] = v.base.p[i].slice(); md.r[i] = v.base.r[i].slice(); md.s[i] = v.base.s[i].slice(); }
  for (let i = 0; i < md.act.length; i++) md.act[i] = 1;
  vistaUbicar(v, v3(), new Quat(), { x: 0, y: 0, z: 0, qx: 0, qy: 0 }); md.actualizar();
  if (!AJX_MANOS.esc) { const Lm = celmPos(md, h.RightHand).distTo(celmPos(md, h.RightHandMiddle4)) || 0.05; AJX_MANOS.esc = 0.3 * 0.185 / Lm; }
  const e = AJX_MANOS.esc; m4trs([0, 0, 0], [0, 0, 0, 1], [e, e, e], md.raiz); md.sucio = true; md.actualizar();
  // el arma en el espacio de la cámara: adelante F, arriba U, su costado derecho Rd (el local -x)
  const F = ajxDir(Mb, v3(0, 0, 1)), Rd = ajxDir(Mb, v3(-1, 0, 0));
  // la derecha: el eje del mango, los nudillos en el filo de adelante-derecha, la muñeca atrás-derecha
  const gD = ajxDir(Mb, m.mano.eje), cD = ajxPunto(Mb, m.mano.p), adel = vsub(F, vscale(gD, vdot(F, gD))).norm();
  const sD = gD.clone(), fD0 = vadd(vscale(Rd, -0.95), vscale(adel, 0.3)), fD = vsub(fD0, vscale(sD, vdot(fD0, sD))).norm();
  const kD = vadd(cD, vadd(vscale(Rd, 0.016), vadd(vscale(adel, 0.022), vscale(sD, 0.004))));
  ajxBrazo(md, h, 'Right', fD, sD, kD, 1);
  ajxDedos(md, h, 'Right', fD, sD, cD, gD, 0.02, m.gatillo ? ajxPunto(Mb, m.gatillo) : null, vadd(cD, vadd(vscale(Rd, -0.026), vadd(vscale(sD, 0.03), vscale(adel, -0.005)))));
  // la izquierda: el puño de adelante (si tiene), desde el costado izquierdo
  const il = md.A.findIndex((n) => n.n === 'low_poly_hand_l_update');
  if (m.manoI) {
    const gI = ajxDir(Mb, m.manoI.eje || v3(0, 1, 0)), cI = ajxPunto(Mb, m.manoI.p), adI = vsub(F, vscale(gI, vdot(F, gI))).norm();
    const sI = gI.clone(), fI0 = vadd(vscale(Rd, 0.95), vscale(adI, 0.3)), fI = vsub(fI0, vscale(sI, vdot(fI0, sI))).norm();
    const kI = vadd(cI, vadd(vscale(Rd, -0.016), vadd(vscale(adI, 0.02), vscale(sI, 0.004))));
    ajxBrazo(md, h, 'Left', fI, sI, kI, -1);
    ajxDedos(md, h, 'Left', fI, sI, cI, gI, 0.017, null, vadd(cI, vadd(vscale(Rd, 0.024), vscale(sI, 0.025))));
  } else if (il >= 0) md.act[il] = 0;
  md.sucio = true; md.actualizar();
  return { r: md.r.map((x) => x.slice()), raiz: Float32Array.from(md.raiz), act: Array.from(md.act) };
}
function ajxManosDibujar(nom, m, Mmov) {
  const v = ajxManosVista(); if (!v) return;
  const md = v.md, clave = nom + '|' + VW() + 'x' + VH();
  let S = AJX_MANOS.sol[clave];
  if (!S) { const C = AJX_VISTA[nom] || AJX_VISTA.fisica, q0 = Quat.euler(C.giro[1], C.giro[0], C.giro[2]), Mb = new Float32Array(16); m4trs(C.p, [q0.x, q0.y, q0.z, q0.w], [1, 1, 1], Mb); S = AJX_MANOS.sol[clave] = ajxManosResolver(nom, m, Mb); if (!S) return; }
  for (let i = 0; i < md.r.length; i++) md.r[i] = S.r[i].slice();
  for (let i = 0; i < md.act.length; i++) md.act[i] = S.act[i];
  m4mul(Mmov, S.raiz, md.raiz); md.sucio = true; md.encolar();
}

// ---------------- en la mano del personaje (tercera persona, y lo que ven los demás) ----------------
// El marco de la mano (manoMarco, personas.js: x de la muñeca a los nudillos, y la normal de la palma, z de costado) y el
// mango en la palma: adelante del arma hacia los nudillos (un poco hacia abajo), arriba del arma hacia el índice, el
// costado izquierdo del arma contra la palma. Escalada con el tamaño de la mano, como las de GMod.
const _aj3F = new Float32Array(16), _aj3G = new Float32Array(16), _aj3M = new Float32Array(16);
// (la pose de pistola, en el marco de la mano: las columnas son a dónde van la izquierda, el arriba y el adelante del
// arma, y dónde va su origen —el mango—; medida sobre la mano del Hero)
const AJX_3P = { fisica: { X: [-0.034, -0.996, -0.082], Y: [0.107, 0.078, -0.991], Z: [0.994, -0.042, 0.104], o: [0.042, -0.024, -0.045] } };
function ajxDibujar3p(P) {
  const nom = ajxDeArma(P.arma); if (!nom) return false;
  const m = ajxModelo(nom), C = AJX_3P[nom] || AJX_3P.fisica;
  P.md.actualizar(); const L = manoMarco(P.md.W, huesosMixamo(P.D), 'Right', _aj3F); if (!L) return false;
  const k = clamp(L / ((DATA.gm && DATA.gm.manoR && DATA.gm.manoR.L) || 0.0993), 0.3, 2.6);
  const X = C.X, Y = C.Y, Z = C.Z;
  _aj3G.set([X[0] * k, X[1] * k, X[2] * k, 0, Y[0] * k, Y[1] * k, Y[2] * k, 0, Z[0] * k, Z[1] * k, Z[2] * k, 0, C.o[0] * k, C.o[1] * k, C.o[2] * k, 1]);
  m4mul(_aj3F, _aj3G, _aj3M); if (typeof armaGmp === 'function') armaGmp(P, _aj3M);
  ajxDibujarModelo(m, _aj3M);
  return true;
}

// ---------------- el ícono (la barra de armas y el menú): el mismo modelo, dibujado en 2D ----------------
// Los triángulos de cada pieza proyectados de costado (un poco de arriba y de adelante), del más lejano al más cercano,
// con la luz de arriba a la izquierda; lo que brilla, sin sombra. Sin archivos: sale del modelo.
const AJX_COLOR = { amarillo: [242, 170, 30], negro: [26, 27, 31], metal: [86, 90, 98], acero: [170, 174, 182], goma: [16, 16, 18], cobre: [190, 105, 52], brillo: [255, 214, 120], brilloSuave: [255, 186, 80], vidrio: [30, 34, 40] };
const AJX_EMITE = new Set(['brillo', 'brilloSuave']);
function ajxIcono(nom, W, H) {
  W = W || 256; H = H || 128;
  const D = AJX_DISENOS[nom](), tris = [], yaw = -1.25, pit = 0.32, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
  // (girar: primero de costado —yaw— y después un poco desde arriba —pit—; luz fija en la vista)
  const vista = (x, y, z) => { const x1 = x * cy + z * sy, z1 = -x * sy + z * cy, y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp; return [x1, y1, z2]; };
  const luz = (() => { const l = [-0.45, 0.75, -0.5], n = Math.hypot(...l); return l.map((x) => x / n); })();
  for (const k in D.partes) {
    const B = D.partes[k], c = AJX_COLOR[k] || [128, 128, 128], em = AJX_EMITE.has(k);
    for (let t = 0; t < B.I.length; t += 3) {
      const v = [0, 1, 2].map((j) => { const i = B.I[t + j] * 3; return vista(B.P[i], B.P[i + 1], B.P[i + 2]); });
      const ux = v[1][0] - v[0][0], uy = v[1][1] - v[0][1], uz = v[1][2] - v[0][2], wx = v[2][0] - v[0][0], wy = v[2][1] - v[0][1], wz = v[2][2] - v[0][2];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      if (nz > 0) continue;   // (de espaldas: no se ve)
      const d = Math.max(0, -(nx * luz[0] + ny * luz[1] + nz * luz[2])), f = em ? 1 : 0.38 + 0.72 * d;
      tris.push({ v, z: (v[0][2] + v[1][2] + v[2][2]) / 3, col: c.map((x) => Math.min(255, Math.round(x * f))) });
    }
  }
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const T of tris) for (const p of T.v) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const esc = Math.min(W * 0.9 / (x1 - x0), H * 0.86 / (y1 - y0)), ox = W / 2 - (x0 + x1) / 2 * esc, oy = H / 2 + (y0 + y1) / 2 * esc;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  tris.sort((a, b) => b.z - a.z);
  g.lineJoin = 'round';
  for (const T of tris) {
    g.beginPath(); g.moveTo(ox + T.v[0][0] * esc, oy - T.v[0][1] * esc); g.lineTo(ox + T.v[1][0] * esc, oy - T.v[1][1] * esc); g.lineTo(ox + T.v[2][0] * esc, oy - T.v[2][1] * esc); g.closePath();
    const c = 'rgb(' + T.col.join(',') + ')'; g.fillStyle = c; g.strokeStyle = c; g.lineWidth = 0.6; g.fill(); g.stroke();
  }
  return cv.toDataURL('image/png');
}
// ---------------- los sonidos: hechos acá (síntesis), sin los de Half-Life ni GMod ----------------
// El zumbido de sostener (un segundo que se repite sin corte: dos tonos con un leve batido y un ronroneo), el de sacarla
// (un chasquido y una subida corta) y el de soltar (una bajada). Se arman una vez, cuando ya hay sonido.
const AJX_SON = { fisica: { sS: 'JX_FisSacar', sSuelta: 'JX_FisSuelta', sSosten: 'JX_FisSosten' } };
function ajxSonidos() {
  if (typeof AUD === 'undefined' || !AUD.ctx || AJX.sonListos) return; AJX.sonListos = true;
  const c = AUD.ctx, sr = c.sampleRate, hacer = (nom, seg, f) => { const b = c.createBuffer(1, Math.round(sr * seg), sr), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = f(i / sr, i); AUD.buf[nom] = b; };
  // (sostener: 1 s exacto, frecuencias con ciclos enteros en un segundo para que el bucle no tenga costura)
  hacer('JX_FisSosten', 1, (t) => { const w = 2 * Math.PI; return 0.22 * Math.sin(w * 96 * t) + 0.12 * Math.sin(w * 192 * t + 0.4) + 0.08 * Math.sin(w * 291 * t) * (0.6 + 0.4 * Math.sin(w * 6 * t)) + 0.05 * Math.sin(w * 588 * t) * Math.sin(w * 3 * t); });
  hacer('JX_FisSacar', 0.32, (t, i) => { const env = Math.min(1, t / 0.005) * Math.exp(-t * 11), f = 260 + 900 * Math.min(1, t / 0.16); return env * (0.4 * Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sign(Math.sin(2 * Math.PI * f * 0.5 * t)) * Math.exp(-t * 30) + (i < sr * 0.004 ? (Math.random() * 2 - 1) * 0.5 : 0)); });
  hacer('JX_FisSuelta', 0.22, (t) => { const env = Math.min(1, t / 0.004) * Math.exp(-t * 16), f = 820 - 620 * Math.min(1, t / 0.18); return env * (0.45 * Math.sin(2 * Math.PI * f * t) + 0.15 * Math.sin(2 * Math.PI * f * 2.01 * t)); });
}
// al empezar: el ícono y los sonidos de cada arma propia (y los de antes, para volver con las clásicas)
function ajxAplicar() {
  if (typeof DEF_ARMAS === 'undefined') return;
  ajxSonidos();
  for (const n in DEF_ARMAS) {
    const D = DEF_ARMAS[n]; if (!D.jx) continue;
    if (D.icClasico === undefined) D.icClasico = D.ic;
    const S = AJX_SON[D.jx] || {}; if (!D.sonClasico) { D.sonClasico = {}; for (const k in S) D.sonClasico[k] = D[k]; }
    for (const k in S) D[k] = ajxActivas() ? S[k] : D.sonClasico[k];
    if (ajxActivas()) { if (!AJX.iconos) AJX.iconos = {}; D.ic = AJX.iconos[D.jx] || (AJX.iconos[D.jx] = (() => { try { return ajxIcono(D.jx); } catch (e) { return D.icClasico; } })()); }
    else D.ic = D.icClasico;
  }
}
setTimeout(ajxAplicar, 0);
