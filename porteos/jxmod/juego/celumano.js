// ---------------- el celular en la mano (mod oficial "Celular": da el arma Celular) ----------------
// En primera persona se ve la mano derecha sosteniendo un celular 3D (la palma atrás, los dedos rodean el borde de la
// izquierda y el pulgar va por el de la derecha, como en GTA 5), y la pantalla del celular (la de siempre, con sus apps)
// va pegada sobre la pantalla 3D: se toca ahí mismo (en la compu, clic para usarlo y clic derecho o Esc para volver a
// mirar). No tapa la pantalla: ocupa un costado y se sigue caminando y mirando. En tercera persona el personaje lo
// tiene en la mano (los demás de la sala también lo ven) y la pantalla va chica en la esquina.
// El brazo es el de la vista "Hands" del juego (con sus huesos de dedos): se ubica con cinemática inversa (hombro, codo,
// muñeca) y cada dedo se dobla hasta tocar el celular, con las medidas del propio esqueleto.
const CELM = { vm: null, k: 1, foco: false, prev: null, quad: null, cssW: 270, cssH: 560, medidas: null, dedos: null };
// el celular (en metros, de verdad): 7,2 × 15 × 0,8 cm, la pantalla casi de punta a punta
const CELM_W = 0.072, CELM_H = 0.15, CELM_D = 0.0078, CELM_SW = 0.066, CELM_SH = 0.137, CELM_SY = 0.0005;
DEF_ARMAS.Celular = { nodo: '', ic: 'ico:celular', car: 0, cad: 0.3, tipo: 'celu' };
const celmEnMano = () => ARM.lista[ARM.i] === 'Celular';

// dónde va el celular respecto de la cámara: a la derecha y abajo, girado un poco hacia el centro, a la distancia que lo
// hace ocupar ~56 % del alto (66 % en pantallas táctiles, que son chicas; ahí más al centro, para no tapar los botones de
// saltar y disparar de la derecha). La vista del arma se dibuja con 60° de alto (principal.js)
const CELM_FOV = 60;
function celmUbicacion() {
  const W = VW(), H = VH(), tact = !!ENT.tactil, fr = tact ? 0.66 : 0.56;
  const tv = Math.tan(CELM_FOV * Math.PI / 360), th = tv * W / H, d = CELM_SH / (2 * fr * tv);
  // centro en la pantalla (coordenadas -1..1)
  const nx = tact ? 0.25 : 0.5, ny = tact ? -0.14 : -0.2;
  return { d, x: nx * th * d, y: ny * tv * d, yaw: 0.1 + nx * 0.12, pitch: -0.1, roll: 0.05 };
}
// la base de la cámara (derecha, arriba, adelante) y el celular en el mundo: centro y ejes (r: derecha de la pantalla,
// u: arriba, n: sale de la pantalla hacia el que mira)
function celmPose(cq, cp) {
  const q = cq || CAM.q, f = q.rot(v3(0, 0, 1)), u = q.rot(v3(0, 1, 0)), r = celmDerecha(f, u, q), U = celmUbicacion();
  const c = vadd(cp || CAM.pos, vadd(vscale(f, U.d), vadd(vscale(r, U.x), vscale(u, U.y))));
  // girado: hacia la cámara (n = -f), con un poco de giro hacia el centro, inclinado hacia atrás y apenas rotado
  let pr = r.clone(), pu = u.clone(), pn = vscale(f, -1);
  const gir = (ax, a) => { const Q = Quat.axis(ax.x, ax.y, ax.z, a); pr = Q.rot(pr); pu = Q.rot(pu); pn = Q.rot(pn); };
  gir(u, -U.yaw); gir(pr, U.pitch); gir(pn, U.roll);
  return { c, r: pr, u: pu, n: pn, cam: { f, u, r } };
}
// la derecha de la pantalla: la del motor (CAM.der) si ya está calculada, si no f × u o u × f, la que proyecta a la derecha
function celmDerecha(f, u, q) {
  const a = vcross(f, u).norm();
  // (la derecha de la cámara del motor es -X local: CAM.der; se compara con eso en el espacio de esa misma cámara)
  const ref = (q || CAM.q).rot(v3(-1, 0, 0)); if (vdot(ref, a) < 0) a.scale(-1);
  return a;
}
// un punto del celular (en su espacio: x a la derecha, y arriba, z hacia el que mira) al mundo
const celmPunto = (P, x, y, z) => vadd(P.c, vadd(vscale(P.r, x), vadd(vscale(P.u, y), vscale(P.n, z))));

// ---------------- la mano ----------------
function celmVista() {
  if (CELM.vm) return CELM.vm;
  const v = vistaArma('Hands', 'celu'); if (!v) return null;
  CELM.vm = v; const md = v.md, A = md.A;
  // la pose de partida: la de reposo del modelo (dedos estirados; el brazo y la mano los pone la cinemática inversa), sin la mano izquierda
  const il = A.findIndex((n) => n.n === 'low_poly_hand_l_update'); if (il >= 0) md.act[il] = 0;
  v.h = {}; A.forEach((n, i) => { v.h[n.n] = i; });
  v.base = { p: md.p.map((x) => x.slice()), r: md.r.map((x) => x.slice()), s: md.s.map((x) => x.slice()) };
  return v;
}
const _celmQ = new Quat();
function celmQMundo(md, i) { return m4quat(md.W[i], new Quat()).norm(); }
// pone la rotación de mundo de un hueso (la local sale de la del padre)
function celmPonerQ(md, i, qw) {
  const pa = md.A[i].pa, qp = pa >= 0 ? celmQMundo(md, pa) : m4quat(md.raiz, new Quat()).norm();
  const ql = qp.conj().mul(qw).norm(); md.r[i][0] = ql.x; md.r[i][1] = ql.y; md.r[i][2] = ql.z; md.r[i][3] = ql.w; md.sucio = true; md.actualizar();
}
// gira un hueso en el mundo (premultiplica su rotación de mundo)
function celmGirar(md, i, qd) { celmPonerQ(md, i, qd.clone().mul(celmQMundo(md, i))); }
const celmPos = (md, i) => v3(md.W[i][12], md.W[i][13], md.W[i][14]);
function celmDesde(a, b) {   // la rotación más corta que lleva la dirección a a la b
  const c = vcross(a, b), d = clamp(vdot(a, b), -1, 1), s = c.len();
  if (s < 1e-8) return d > 0 ? new Quat() : Quat.axis(Math.abs(a.x) < 0.9 ? 1 : 0, Math.abs(a.x) < 0.9 ? 0 : 1, 0, Math.PI);
  return Quat.axis(c.x, c.y, c.z, Math.atan2(s, d));
}
const CELM_DEDOS = ['Index', 'Middle', 'Ring', 'Pinky'];
// arma la pose de la mano para el celular en P (todo en el mundo, cada cuadro: sigue a la cámara)
// (se resuelve una vez con la cámara en el origen y se guarda: el celular va fijo respecto de la cámara)
function celmPosar(v, P) {
  const md = v.md, h = v.h;
  for (let i = 0; i < md.p.length; i++) { md.p[i] = v.base.p[i].slice(); md.r[i] = v.base.r[i].slice(); md.s[i] = v.base.s[i].slice(); }
  const CQ = P.camQ, CP = P.camP;
  // la escala de la vista: la mano mide lo que mide una mano (18,5 cm de la muñeca a la punta del mayor)
  vistaUbicar(v, CP, CQ, { x: 0, y: 0, z: 0, qx: 0, qy: 0 }); md.actualizar();
  if (!CELM.medidas) {
    const L = celmPos(md, h.RightHand).distTo(celmPos(md, h.RightHandMiddle4)) || 0.05;
    CELM.medidas = { esc: 0.3 * 0.185 / L };
  }
  m4trs([CP.x, CP.y, CP.z], [CQ.x, CQ.y, CQ.z, CQ.w], [1, 1, 1], _mb);
  const e = CELM.medidas.esc; m4trs([0, 0, 0], [0, 0, 0, 1], [e, e, e], _mo); m4mul(_mb, _mo, md.raiz); md.sucio = true; md.actualizar();
  // 1) la mano: el celular apoyado en la palma; los dedos hacia arriba (y un poco a la izquierda) por la espalda del
  //    celular, el pulgar por el costado derecho
  const fT = vadd(vscale(P.r, -0.36), vscale(P.u, 0.93)).norm(), nT = P.n.clone(), sT = vcross(fT, nT).norm();
  const hand = h.RightHand, f0 = vsub(celmPos(md, h.RightHandMiddle1), celmPos(md, hand)).norm(), s0r = vsub(celmPos(md, h.RightHandIndex1), celmPos(md, h.RightHandPinky1)).norm();
  const n0 = vcross(s0r, f0).norm(), s0 = vcross(f0, n0).norm();
  // rotación que lleva la base (f0, s0, n0) a (fT, sT, nT)
  const Qb = qBase(f0, s0, vcross(f0, s0)), Qt = qBase(fT, sT, vcross(fT, sT)), qd = Qt.clone().mul(Qb.conj()).norm();
  const qHand = qd.clone().mul(celmQMundo(md, hand)).norm();
  // dónde va la muñeca: los nudillos del mayor un poco abajo del medio de la espalda del celular (la palma apoyada
  // atrás, a lo que mide de grueso la mano hasta el hueso) y la muñeca abajo, asomando por debajo del celular
  const largoPalma = celmPos(md, h.RightHandMiddle1).distTo(celmPos(md, hand)), grosor = CELM.medidas.palma || 0.014;
  const nudillos = celmPunto(P, 0.004, -0.004, -CELM_D / 2 - grosor);
  const wrist = vsub(nudillos, vscale(fT, largoPalma));
  // 2) el brazo: el hombro abajo, a la derecha y atrás de la muñeca (fuera de la vista); cinemática inversa de dos huesos
  const sh = h.RightArm, el = h.RightForeArm;
  const a = celmPos(md, sh).distTo(celmPos(md, el)), b = celmPos(md, el).distTo(celmPos(md, hand));
  const dirHombro = vadd(vscale(P.cam.u, -0.55), vadd(vscale(P.cam.r, 0.45), vscale(P.cam.f, -0.7))).norm();
  const hombro = vadd(wrist, vscale(dirHombro, (a + b) * 0.86));
  // se corre todo el modelo para que el hombro quede ahí
  const dh = vsub(hombro, celmPos(md, sh)); md.raiz[12] += dh.x; md.raiz[13] += dh.y; md.raiz[14] += dh.z; md.sucio = true; md.actualizar();
  const S = celmPos(md, sh), dW = vsub(wrist, S), dist = Math.min(dW.len(), (a + b) * 0.999), dn = dW.clone().norm();
  // el codo: hacia afuera y abajo (polo)
  const polo = vadd(vscale(P.cam.r, 0.7), vscale(P.cam.u, -0.7)).norm();
  const cosA = clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1), alto = a * Math.sqrt(1 - cosA * cosA);
  const lado = vsub(polo, vscale(dn, vdot(polo, dn))).norm();
  const codo = vadd(S, vadd(vscale(dn, a * cosA), vscale(lado, alto)));
  celmGirar(md, sh, celmDesde(vsub(celmPos(md, el), S).norm(), vsub(codo, S).norm()));
  celmGirar(md, el, celmDesde(vsub(celmPos(md, hand), celmPos(md, el)).norm(), vsub(wrist, celmPos(md, el)).norm()));
  celmPonerQ(md, hand, qHand);
  // 3) los dedos y el pulgar
  CELM.dedos = celmDedos(md, (n) => h[n], P, fT, nT, sT, 1);
}
// los dedos: se juntan casi paralelos al mayor (en reposo vienen abiertos en abanico, con una apertura chica) y cada uno
// se dobla o se estira (las tres falanges) hasta que quedan apoyados en la espalda del celular: el centro de cada
// articulación y la punta a su grosor detrás (en reposo vienen curvados y atravesaban el celular). idx: nombre → hueso
function celmDedos(md, idx, P, fT, nT, sT, t) {
  const eje = vcross(fT, nT).norm(), out = {};   // (doblar hacia la palma: la punta va de f hacia n, hacia el celular)
  const GROSOR = { Index: 0.0085, Middle: 0.0088, Ring: 0.0082, Pinky: 0.0072 }, ABRE = { Index: 0.07, Middle: 0, Ring: -0.07, Pinky: -0.15 };
  for (const D of CELM_DEDOS) {
    const a1 = idx('RightHand' + D + '1'), a2 = idx('RightHand' + D + '2'); if (a1 === undefined || a2 === undefined) continue;
    const dir = vsub(celmPos(md, a2), celmPos(md, a1)); const dp = vsub(dir, vscale(nT, vdot(dir, nT))).norm();
    const meta = Quat.axis(nT.x, nT.y, nT.z, ABRE[D] * (vdot(vcross(fT, sT), nT) >= 0 ? 1 : -1)).rot(fT);
    celmGirar(md, a1, celmDesde(dp, meta));
  }
  for (const D of CELM_DEDOS) {
    const j = [1, 2, 3].map((k) => idx('RightHand' + D + k)), tip = idx('RightHand' + D + '4'); if (j.some((x) => x === undefined)) continue;
    const r0 = j.map((x) => md.r[x].slice()), zt = -(CELM_D / 2 + GROSOR[D]) * t, puntos = [j[1], j[2]].concat(tip !== undefined ? [tip] : []);
    let mejor = 0, err = 1e9;
    for (let ang = -0.9; ang <= 1.0; ang += 0.025) {
      for (let k = 0; k < 3; k++) md.r[j[k]] = r0[k].slice();
      md.sucio = true; md.actualizar();
      for (let k = 0; k < 3; k++) celmGirar(md, j[k], Quat.axis(eje.x, eje.y, eje.z, ang * [0.35, 1, 0.8][k]));
      let e = 0; for (const x of puntos) { const lz = vdot(vsub(celmPos(md, x), P.c), P.n); e += (lz - zt) * (lz - zt); }
      if (e < err) { err = e; mejor = ang; }
    }
    for (let k = 0; k < 3; k++) md.r[j[k]] = r0[k].slice();
    md.sucio = true; md.actualizar();
    for (let k = 0; k < 3; k++) celmGirar(md, j[k], Quat.axis(eje.x, eje.y, eje.z, mejor * [0.35, 1, 0.8][k]));
    out[D] = +mejor.toFixed(3);
  }
  // el pulgar: hacia arriba, por fuera del borde derecho, a la altura del canto
  const t1 = idx('RightHandThumb1'), t4 = idx('RightHandThumb4') !== undefined ? idx('RightHandThumb4') : idx('RightHandThumb3');
  if (t1 !== undefined && t4 !== undefined) {
    // (la punta va a un punto del canto derecho que esté justo a su largo: en las manos grandes el pulgar es más largo
    // que la distancia al canto y, apuntado al medio, se pasaba y quedaba cruzado por detrás)
    const b1 = celmPos(md, t1), L = b1.distTo(celmPos(md, t4)), d1 = vsub(b1, P.c), x1 = vdot(d1, P.r), y1 = vdot(d1, P.u), z1 = vdot(d1, P.n);
    const xe = (CELM_W / 2 + 0.009) * t, ze = -0.001 * t, q2 = L * L - (xe - x1) * (xe - x1) - (ze - z1) * (ze - z1);
    const ye = q2 > 0 ? Math.min(y1 + Math.sqrt(q2), CELM_H * 0.45 * t) : -CELM_H * 0.08 * t;
    const meta = celmPunto(P, xe, ye, ze);
    celmGirar(md, t1, celmDesde(vsub(celmPos(md, t4), b1).norm(), vsub(meta, b1).norm()));
  }
  return out;
}
// cuánto entra la mano en el celular (lo que hay que separarlo de la palma): cada articulación de los dedos y la muñeca
// que cae sobre el celular, con su grosor, contra la espalda
function celmExceso(md, idx, P, t) {
  let ex = 0;
  const ver = (i, r) => { if (i === undefined) return; const d = vsub(celmPos(md, i), P.c), x = vdot(d, P.r) / t, y = vdot(d, P.u) / t, z = vdot(d, P.n) / t; if (Math.abs(x) < CELM_W / 2 && Math.abs(y) < CELM_H / 2) ex = Math.max(ex, z + r + CELM_D / 2); };
  for (const D of [...CELM_DEDOS, 'Thumb']) for (const k of [1, 2, 3, 4]) ver(idx('RightHand' + D + k), D === 'Thumb' ? 0.009 : 0.008);
  ver(idx('RightHand'), 0.014);
  return ex * t;
}
// ---------------- dibujo ----------------
const CELM_MAT = {};
function celmMats() {
  if (CELM_MAT.cuerpo) return CELM_MAT;
  CELM_MAT.cuerpo = matPropio('celuCuerpo', [0.07, 0.075, 0.085], { pbr: [0.35, 0.6, 0.05] });
  CELM_MAT.marco = matPropio('celuMarco', [0.32, 0.33, 0.36], { pbr: [0.25, 0.9, 0.05] });
  CELM_MAT.vidrio = matPropio('celuVidrio', [0.01, 0.01, 0.015], { pbr: [0.08, 0.2, 0.05] });
  CELM_MAT.lente = matPropio('celuLente', [0.02, 0.02, 0.03], { pbr: [0.05, 0.6, 0.05] });
  return CELM_MAT;
}
function celmDibujarCelu(P) {
  const M = celmMats(), q = qBase(P.r, P.u, P.n);
  dibujarCaja(P.c, [CELM_W, CELM_H, CELM_D], q, M.cuerpo);
  // el marco de metal (un filo apenas más grande que el cuerpo, más finito) y el vidrio negro del frente
  dibujarCaja(celmPunto(P, 0, 0, -0.0004), [CELM_W + 0.0012, CELM_H + 0.0012, CELM_D * 0.7], q, M.marco);
  dibujarCaja(celmPunto(P, 0, 0, CELM_D / 2 + 0.0002), [CELM_W - 0.0016, CELM_H - 0.0016, 0.0005], q, M.vidrio);
  // la cámara de atrás
  dibujarCaja(celmPunto(P, -CELM_W * 0.28, CELM_H * 0.4, -CELM_D / 2 - 0.0012), [0.022, 0.022, 0.0024], q, M.lente);
}
// las cuatro esquinas de la pantalla en la pantalla del aparato (píxeles CSS): arriba-izq, arriba-der, abajo-der, abajo-izq
function celmEsquinas(P) {
  const vp = R.vp, W = VW(), H = VH(), z = CELM_D / 2 + 0.0006, out = [];
  for (const [x, y] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
    const p = celmPunto(P, x * CELM_SW / 2, CELM_SY + y * CELM_SH / 2, z);
    const cx = vp[0] * p.x + vp[4] * p.y + vp[8] * p.z + vp[12], cy = vp[1] * p.x + vp[5] * p.y + vp[9] * p.z + vp[13], cw = vp[3] * p.x + vp[7] * p.y + vp[11] * p.z + vp[15];
    if (cw <= 1e-4) return null;
    out.push([(cx / cw + 1) / 2 * W, (1 - cy / cw) / 2 * H]);
  }
  return out;
}
// la transformación CSS (perspectiva) que lleva el rectángulo de la pantalla del celular a esas cuatro esquinas
function celmMatriz(Q, w, h) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = Q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a, b, c, d, e, f, g, k;
  const den = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9 || Math.abs(den) < 1e-12) { g = 0; k = 0; }
  else { g = (dx3 * dy2 - dx2 * dy3) / den; k = (dx1 * dy3 - dx3 * dy1) / den; }
  a = x1 - x0 + g * x1; b = x3 - x0 + k * x3; c = x0; d = y1 - y0 + g * y1; e = y3 - y0 + k * y3; f = y0;
  return `matrix3d(${[a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, c, f, 0, 1].map((x) => +x.toFixed(6)).join(',')})`;
}
// cada cuadro (después de dibujar): la mano, el celular y la pantalla encima
function celmVistaDibujar() {
  const v = celmVista(); if (!v) return false;
  const md = v.md, clave = VW() + 'x' + VH() + (ENT.tactil ? 't' : '');
  // la pose de la mano y del celular respecto de la cámara: se calcula cuando cambia el tamaño de la pantalla
  if (!CELM.sol || CELM.sol.clave !== clave) {
    const Q0 = new Quat(), P0 = celmPose(Q0, v3()); P0.camQ = Q0; P0.camP = v3();
    celmPosar(v, P0);
    CELM.sol = { clave, r: md.r.map((x) => x.slice()), raiz: Float32Array.from(md.raiz), c: P0.c, rr: P0.r, u: P0.u, n: P0.n };
  }
  const S = CELM.sol;
  // un poco del balanceo al caminar (el mismo de las armas), en el espacio de la cámara
  const sw = ARM.sway || { x: 0, y: 0, z: 0 }, k = 0.3, off = v3(-(sw.x || 0) * k, (sw.y || 0) * k, (sw.z || 0) * k);
  const cq = CAM.q, cp = vadd(CAM.pos, cq.rot(off));
  for (let i = 0; i < md.r.length; i++) md.r[i] = S.r[i].slice();
  m4trs([cp.x, cp.y, cp.z], [cq.x, cq.y, cq.z, cq.w], [1, 1, 1], _mb); m4mul(_mb, S.raiz, md.raiz); md.sucio = true;
  const P = { c: vadd(cp, cq.rot(S.c)), r: cq.rot(S.rr), u: cq.rot(S.u), n: cq.rot(S.n) }; CELM.pose = P;
  md.encolar(); celmDibujarCelu(P);
  CELM.dibujado = true;
  return true;
}
// después de dibujar el cuadro: la pantalla sobre el celular 3D (o en la esquina en tercera persona)
function celmCuadro() {
  const ve = !!CELM.dibujado; CELM.dibujado = false;
  celmPantalla(ve);
  // (el botón del celular sólo con el mod)
  const tiene = ARM.lista.includes('Celular'); if (tiene !== CELM.botonVe) { CELM.botonVe = tiene; document.querySelectorAll('[data-btn=celular]').forEach((b) => { b.style.display = tiene ? '' : 'none'; }); }
}
function celmPantalla(ve) {
  const c = $('celular');
  const mano = celmEnMano() && JUEGO.estado === 'juego' && JUG.vivo;
  if (!mano) { if (c && c.classList.contains('mano')) { c.classList.remove('mano', 'tercera'); c.style.transform = ''; celCerrar(); } CELM.quad = null; if (CELM.foco) celmFoco(false); return; }
  const el = celEl();
  if (!el.classList.contains('mano')) { el.classList.add('mano'); CEL.app = CEL.app || null; celDibujar(); }
  el.classList.remove('oc'); el.classList.add('arriba');
  // (con otro menú abierto, como Ajustes, Mods o Emotes desde una app, el celular en la mano no queda encima ni toma los toques)
  el.classList.toggle('tapado', !!(UI.abierto && UI.abierto !== 'celular'));
  if (ve && CELM.pose && R.vp) {
    const Q = celmEsquinas(CELM.pose); CELM.quad = Q;
    el.classList.remove('tercera');
    if (Q) el.style.transform = celmMatriz(Q, CELM.cssW, CELM.cssH);
  } else { el.classList.add('tercera'); el.style.transform = ''; CELM.quad = null; }
}
// en la compu: clic para usar el celular (aparece el puntero), clic derecho o Esc para volver a mirar
function celmFoco(si) {
  CELM.foco = !!si;
  if (si) { UI.abierto = 'celular'; soltarPuntero(); sonar('UI_blip', null, 0.25, 1.3); }
  else if (UI.abierto === 'celular') UI.abierto = null;   // (el próximo clic en el juego vuelve a tomar el mouse)
  const c = $('celular'); if (c) c.classList.toggle('foco', CELM.foco);
}
// el botón del celular (O): saca el celular o vuelve al arma de antes
function celmSacar() {
  const i = ARM.lista.indexOf('Celular');
  if (i < 0) { aviso(T('celm.sinMod'), 2.5); return; }
  if (ARM.i === i) { const j = CELM.prev !== null && CELM.prev < ARM.lista.length && CELM.prev !== i ? CELM.prev : ARM.lista.indexOf('PhysicsGun'); elegirArma(j >= 0 ? j : 0); }
  else { CELM.prev = ARM.i; elegirArma(i); }
}
// en tercera persona (y los demás): el brazo derecho del personaje sostiene el celular delante del pecho, la pantalla
// mirando a la cara (cinemática inversa con las posiciones de sus propios huesos: sirve para cualquier personaje y tamaño)
function celmBrazo3p(P) {
  const md = P.md, h = P.D.h, sh = h.RightArm, el = h.RightForeArm, hand = h.RightHand, cab = h.Head;
  if ([sh, el, hand, cab, h.LeftArm].some((x) => x === undefined)) { P.celu3p = null; return; }
  md.actualizar();
  const t = P.tam || 1, up = v3(0, 1, 0), fw = v3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
  const der = vsub(celmPos(md, sh), celmPos(md, h.LeftArm)); der.y = 0; der.norm();
  // la mira: con la cabeza un poco gacha, el celular a 30 cm adelante y 27 cm abajo de los ojos, apenas a la derecha
  const ojo = celmPos(md, cab), c = vadd(ojo, vadd(vscale(fw, 0.3 * t), vadd(vscale(up, -0.27 * t), vscale(der, 0.05 * t))));
  const n = vsub(ojo, c).norm(), pu = vsub(fw, vscale(n, vdot(fw, n))).norm(), pr = vcross(pu, n).norm();   // (pantalla hacia los ojos; arriba del celular, hacia adelante)
  if (vdot(pr, der) < 0) pr.scale(-1);
  const Pc = { c, r: pr, u: pu, n };
  // la mano: palma contra la espalda del celular, dedos hacia arriba del celular (y algo a la izquierda)
  const fT = vadd(vscale(pr, -0.3), vscale(pu, 0.95)).norm(), nT = n.clone(), sT = vcross(fT, nT).norm();
  const hx = huesosMixamo(P.D), m1 = hx.RightHandMiddle1, i1 = hx.RightHandIndex1, p1 = hx.RightHandPinky1 !== undefined ? hx.RightHandPinky1 : hx.RightHandRing1;
  let largoPalma = 0.09 * t;
  if (m1 !== undefined) largoPalma = celmPos(md, m1).distTo(celmPos(md, hand));
  const wrist = vsub(celmPunto(Pc, 0, -0.01 * t, -(CELM_D / 2 + 0.014) * t), vscale(fT, largoPalma));
  const a = celmPos(md, sh).distTo(celmPos(md, el)), b = celmPos(md, el).distTo(celmPos(md, hand)), S = celmPos(md, sh);
  const dW = vsub(wrist, S), dist = Math.min(dW.len(), (a + b) * 0.999), dn = dW.clone().norm();
  const polo = vadd(vscale(der, 0.6), vscale(up, -0.8)).norm();
  const cosA = clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1), alto = a * Math.sqrt(1 - cosA * cosA);
  const lado = vsub(polo, vscale(dn, vdot(polo, dn))).norm(), codo = vadd(S, vadd(vscale(dn, a * cosA), vscale(lado, alto)));
  celmGirar(md, sh, celmDesde(vsub(celmPos(md, el), S).norm(), vsub(codo, S).norm()));
  celmGirar(md, el, celmDesde(vsub(celmPos(md, hand), celmPos(md, el)).norm(), vsub(wrist, celmPos(md, el)).norm()));
  if (m1 !== undefined && i1 !== undefined && p1 !== undefined) {
    const f0 = vsub(celmPos(md, m1), celmPos(md, hand)).norm(), s0r = vsub(celmPos(md, i1), celmPos(md, p1)).norm(), n0 = vcross(s0r, f0).norm(), s0 = vcross(f0, n0).norm();
    const qd = qBase(fT, sT, vcross(fT, sT)).mul(qBase(f0, s0, vcross(f0, s0)).conj()).norm();
    celmPonerQ(md, hand, qd.mul(celmQMundo(md, hand)).norm());
    // (y los dedos, apoyados en la espalda del celular: la mano queda siempre igual respecto del celular, así que se
    // calculan una vez por personaje y después se copian)
    if (!P.D.celuDedos) { celmDedos(md, (n) => hx[n], { c: vadd(c, vsub(celmPos(md, hand), wrist)), r: pr, u: pu, n }, fT, nT, sT, t); P.D.celuDedos = [1, 2, 3].flatMap((k) => [...CELM_DEDOS, 'Thumb'].map((D) => hx['RightHand' + D + k])).filter((x) => x !== undefined).map((x) => [x, md.r[x].slice()]); }
    else { for (const [x, r] of P.D.celuDedos) md.r[x] = r.slice(); md.sucio = true; }
  }
  md.actualizar();
  // el celular va donde quedó la mano (si el brazo no llega, se corre con ella), y separado de la palma lo que haga
  // falta para que ningún dedo lo atraviese (las manos gruesas)
  const real = celmPos(md, hand), C = { c: vadd(c, vsub(real, wrist)), r: pr, u: pu, n, t };
  const ex = celmExceso(md, (x) => (x === 'RightHand' ? hand : hx[x]), C, t); if (ex > 0) C.c = vadd(C.c, vscale(n, ex + 0.001 * t));
  P.celu3p = C;
}
function celmDibujar3p(P) {
  const C = P.celu3p; if (!C) return;
  const M = celmMats(), q = qBase(C.r, C.u, C.n), t = C.t;
  dibujarCaja(C.c, [CELM_W * t, CELM_H * t, CELM_D * t], q, M.cuerpo);
  dibujarCaja(vadd(C.c, vscale(C.n, CELM_D * t / 2 + 0.0004)), [(CELM_W - 0.003) * t, (CELM_H - 0.006) * t, 0.0006], q, matPropio('celuPant3p', [0.25, 0.4, 0.9], { em: [0.35, 0.55, 1.2] }));
}
