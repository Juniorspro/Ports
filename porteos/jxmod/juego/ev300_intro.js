// ---------------------------------------------------------------------------------------------------------
// El evento de los 300 (ev300.js): la cinta del principio, ~34 s, en el motor y en VHS. Un cuarto de hormigón armado acá
// (una malla con piso, techo y cuatro paredes, la de enfrente con la puerta) lleno de cámaras con trípode que te
// apuntan, todas con la luz de REC, y dos monitores con estática; vos, atado a una silla (tu personaje sentado, con las
// manos atrás y sogas en el pecho, la cintura y los tobillos); la cámara en los ojos y el cuello que gira lo que puede.
// Pepe habla (el Loquendo robot, ev300_son.js) y en el medio, tres recuerdos de lo que le hicimos —de día, en primera
// persona y «bajo el agua» (la imagen ondula y el sonido llega apagado)—: palancazos, una patada y el barril que
// explota a su lado. Al final se apaga la luz, se abre la puerta y entra la entidad (Pepe deformado, oscuro, con un bate):
// camina hasta la silla y te pega. Negro.
// ---------------------------------------------------------------------------------------------------------
const EV3I = { C: null, malla: -1, mat: -1, sil: null, yo: null, cams: [], monis: [], ent: null, puerta: null, fb: null, voz: {}, yaw0: 0, golpeado: false, hd: v3(), cuerpoOk: false };
// (dónde: en el pasto del medio de gm_construct, lejos de todo; el cuarto se borra al terminar)
const EV3I_LUGAR = [24, -42];
// el guion: [segundo, qué]
const EV3I_GUION = [
  [2.0, 'v:i1'], [5.6, 'v:i2'], [9.7, 'fb:1'], [11.6, 'v:i3'], [15.8, 'fb:2'], [17.7, 'v:i4'], [21.6, 'fb:3'], [23.5, 'v:i5'],
  [25.4, 'v:i6'], [29.0, 'apagon'], [29.7, 'puerta'], [30.1, 'v:i7'], [31.5, 'swing'], [32.2, 'golpe'], [34.2, 'fin'],
];
const EV3I_FB_DUR = 1.6;
function ev3IntroArmar() {
  ev3Limpiar(); EV3.hora0 = performance.now(); EV3I.golpeado = false; EV3I.fb = null; EV3I.paso = 0; EV3I.cuerpoOk = false; EV3I.calib = null;
  document.body.classList.add('ev3Quieto'); VHS.negro = 1; VHS.dano = 0.6;
  vhsTexto('I', 'PLAY ▶'); vhsTexto('D', 'SP'); vhsTexto('AD', 'NOV. 19 1998');
  const x = EV3I_LUGAR[0], z = EV3I_LUGAR[1], y = ev3Piso(x, z); EV3I.C = v3(x, y, z);
  // el cuarto: 6 × 7 m y 2,9 de alto, la puerta (1,1 m) en la pared de enfrente (+z), corrida a la izquierda
  const B = geoNuevo(), A = 3.0, X = 3.0, Z = 3.5, e = 0.12, H = 2.9, pu = [-1.6, -0.5];
  geoCaja(B, v3(x, y - 0.04, z), [X + e, 0.06, Z + e], null, 2);                 // piso (2 cm arriba del pasto)
  geoCaja(B, v3(x, y + H + 0.06, z), [X + e, 0.06, Z + e], null, 2);             // techo
  geoCaja(B, v3(x - X, y + H / 2, z), [e, H / 2, Z], null, 2); geoCaja(B, v3(x + X, y + H / 2, z), [e, H / 2, Z], null, 2);   // costados
  geoCaja(B, v3(x, y + H / 2, z - Z), [X, H / 2, e], null, 2);                   // atrás
  // (enfrente, con el hueco de la puerta: de pu[0] a pu[1] en x, 2,1 m de alto)
  geoCaja(B, v3(x + (pu[0] - X) / 2, y + H / 2, z + Z), [(pu[0] + X) / 2, H / 2, e], null, 2);
  geoCaja(B, v3(x + (pu[1] + X) / 2, y + H / 2, z + Z), [(X - pu[1]) / 2, H / 2, e], null, 2);
  geoCaja(B, v3(x + (pu[0] + pu[1]) / 2, y + (2.1 + H) / 2, z + Z), [(pu[1] - pu[0]) / 2, (H - 2.1) / 2, e], null, 2);
  if (EV3I.malla >= 0) mallaPropiaBorrar(EV3I.malla);
  EV3I.malla = mallaPropia(B);
  const base = (typeof matDelJuego === 'function') ? [/concrete/i, /cement/i, /plaster/i, /wall/i].map((r) => matDelJuego(r)).find((i) => i >= 0) : -1;
  EV3I.mat = ev3Mat('cuarto', [0.55, 0.52, 0.48], { de: base === undefined ? -1 : base, pbr: [0.95, 0, 0.03] });
  EV3I.matRojo = ev3Mat('rec', [0.2, 0.02, 0.02], { em: [9, 0.4, 0.3] });
  EV3I.matSoga = ev3Mat('soga', [0.46, 0.35, 0.22], { pbr: [0.95, 0, 0.02] });
  EV3I.matBulbo = ev3Mat('bulbo', [1, 0.9, 0.7], { em: [6, 5, 3.5] });
  EV3I.matEst = ev3Mat('estatica', [0.5, 0.52, 0.56], { em: [0.8, 0.85, 0.95] });
  EV3I.matCable = ev3Mat('cable', [0.05, 0.05, 0.05]);
  // la silla en el medio, mirando a la puerta (+z); la puerta, una de madera que después se abre
  EV3I.sil = ev3Prop('Silla', v3(x, y + 0.5, z - 0.4), Quat.axis(0, 1, 0, EV3I_SILLA_YAW), { piso: y });
  EV3I.puerta = ev3Prop('door_wood', v3(x + (pu[0] + pu[1]) / 2, y + 1.2, z + Z), new Quat(), { piso: y });
  EV3I.puertaQ0 = EV3I.puerta ? EV3I.puerta.b.q.clone() : null; EV3I.puertaP0 = EV3I.puerta ? EV3I.puerta.b.pos.clone() : null;
  // las cámaras: en ronda delante y a los costados (a la altura de los ojos, apuntándote), y arriba de cajas contra las paredes
  EV3I.cams = [];
  const ojo = v3(x, y + 1.15, z - 0.4);
  const ronda = [[-1.9, 1.4], [-0.9, 2.1], [0.4, 2.3], [1.5, 1.8], [2.3, 0.6], [-2.4, 0.3], [2.4, -1.2], [-2.3, -1.4], [1.0, 1.0], [-1.2, 0.9]];
  for (const [dx, dz] of ronda) EV3I.cams.push(ev3IntroCam(v3(x + dx, y, z - 0.4 + dz), ojo, y));
  for (const [dx, dz] of [[-2.6, 2.9], [2.6, 2.9], [2.6, -3.0], [-2.6, -3.0], [0.9, 3.0]]) {
    const c = ev3Prop('Crate', v3(x + dx, y + 0.5, z + dz), Quat.axis(0, 1, 0, dx * 0.7), { piso: y });
    EV3I.cams.push(ev3IntroCam(v3(x + dx, y + 1.02, z + dz), ojo, y + 1.02));
  }
  // los monitores con la estática, en una mesa a la derecha
  ev3Prop('Mesa', v3(x + 2.2, y + 0.4, z + 1.1), Quat.axis(0, 1, 0, Math.PI / 2), { piso: y });
  EV3I.monis = [];
  for (const dz of [0.65, 1.5]) { const m = ev3Prop('OldMonitor', v3(x + 2.25, y + 1.1, z + dz), Quat.axis(0, 1, 0, -Math.PI / 2 + EV3I_MONI_YAW), { piso: y + 0.76 }); if (m) EV3I.monis.push(m); }
  // tu cuerpo: tu personaje, sentado (la pose de manejar), sin cabeza a la vista (la cámara está ahí)
  const sk = JUG.skinRol || JUG.skinMod || PREFS.skin || 'Hero';
  const P = crearPersona(sk, 'HatEmpty', { nombre: '' }); EV3.pers.push(P); EV3I.yo = P;
  P.sentado = true; P.manejando = true; P.suelo = true; P.yaw = 0; P.vel.set(0, 0, 0); P.pos.set(x, y + 0.82, z - 0.4); P.ev3Atado = true;
  ev3Atar(P);
  // el jugador de verdad, quieto en la silla (lo que se ve es de la cámara de acá)
  JUG.pos.set(x, y + 0.97, z - 0.4); JUG.vel.set(0, 0, 0); JUG.bloqueado = true; JUG.yaw = 0; JUG.pitch = 0.05; EV3I.yaw0 = 0;
  if (typeof linternaAlternar === 'function') linternaAlternar(false);
  ev3Bucle('cinta', 'cinta', 0.05); ev3Bucle('grave', 'grave', 0.0);
}
const EV3I_SILLA_YAW = Math.PI, EV3I_MONI_YAW = 0, EV3_NEGRO = [0.11, 0.045, 0.045];
let EV3I_CAM_YAW = Math.PI / 2;
// una cámara con trípode apuntándote (CamaraTripode: el lente mira a su +z girado EV3I_CAM_YAW)
function ev3IntroCam(p, ojo, piso) {
  const d = vsub(ojo, p), yaw = Math.atan2(d.x, d.z) + EV3I_CAM_YAW;
  const o = ev3Prop('CamaraTripode', v3(p.x, piso + 0.8, p.z), Quat.axis(0, 1, 0, yaw), { piso });
  return o ? { o, yaw, fase: Math.random() * 6 } : null;
}
// las manos atrás, atadas detrás del respaldo: encima de la pose de sentado, cada brazo y antebrazo se gira para que
// apunte adonde tiene que ir (en el mundo: el brazo abajo y atrás, el antebrazo hacia el otro, por detrás). Se calcula
// con la pose del cuadro anterior y queda fija: al otro cuadro el brazo ya apunta ahí y el giro que falta es nada
function ev3Atar(P) {
  P.poseExtra = (Q) => {
    if (!Q.ev3Atado) return; const md = Q.md;
    if (md.W && !Q.ev3SueltaBrazos) {
      const f = v3(Math.sin(Q.yaw), 0, Math.cos(Q.yaw)), izq = v3(f.z, 0, -f.x);
      for (const [lado, s] of [['Left', 1], ['Right', -1]]) {
        const L = vscale(izq, s);
        ev3Apuntar(Q, lado + 'Arm', lado + 'ForeArm', vadd(vadd(v3(0, -0.85, 0), vscale(f, -0.5)), vscale(L, 0.1)));
        ev3Apuntar(Q, lado + 'ForeArm', lado + 'Hand', vadd(vadd(vscale(L, -0.9), vscale(f, -0.22)), v3(0, -0.1, 0)));
      }
    }
    if (Q.ev3SinCabeza) { const i = Q.D.h.Head; if (i !== undefined) { const sc = md.s[i]; sc[0] = sc[1] = sc[2] = 0.001; } }
    md.sucio = true;
  };
}
// gira el hueso (en su rotación local) para que el tramo hasta el hijo apunte a dir (en el mundo)
function ev3Apuntar(Q, hueso, hijo, dir) {
  const md = Q.md, i = Q.D.h[hueso], c = Q.D.h[hijo]; if (i === undefined || c === undefined || !md.A[i]) return;
  const W = md.W, Wi = W[i], Wc = W[c], pa = md.A[i].pa; if (!Wi || !Wc || !(pa >= 0) || !W[pa]) return;
  const d0 = v3(Wc[12] - Wi[12], Wc[13] - Wi[13], Wc[14] - Wi[14]), L = d0.len(); if (!(L > 1e-4)) return; d0.scale(1 / L);
  const dq = ev3QDesde(d0, dir.clone().norm()), qW = ev3QDeM(Wi), qP = ev3QDeM(W[pa]);
  const loc = qP.conj().mul(dq.mul(qW)).norm(); if (!isFinite(loc.w)) return;
  const r = md.r[i]; r[0] = loc.x; r[1] = loc.y; r[2] = loc.z; r[3] = loc.w;
}
// el giro de una matriz (sin la escala) y el giro que lleva a hasta b
function ev3QDeM(M) {
  const n0 = Math.hypot(M[0], M[1], M[2]) || 1, n1 = Math.hypot(M[4], M[5], M[6]) || 1, n2 = Math.hypot(M[8], M[9], M[10]) || 1;
  const m00 = M[0] / n0, m10 = M[1] / n0, m20 = M[2] / n0, m01 = M[4] / n1, m11 = M[5] / n1, m21 = M[6] / n1, m02 = M[8] / n2, m12 = M[9] / n2, m22 = M[10] / n2, tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; w = 0.25 * s; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s; }
  return new Quat(x, y, z, w).norm();
}
function ev3QDesde(a, b) {
  const c = vdot(a, b);
  if (c < -0.9999) { const ej = Math.abs(a.x) < 0.9 ? v3(1, 0, 0) : v3(0, 1, 0), ax = vcross(a, ej).norm(); return Quat.axis(ax.x, ax.y, ax.z, Math.PI); }
  const x = vcross(a, b); return new Quat(x.x, x.y, x.z, 1 + c).norm();
}
// Pepe (o la entidad): deformado de verdad en 3D (el cuello más largo, la cabeza alta y angosta, inclinada y temblando),
// como en los videos: P.defK de 0 a 1
function ev3Deformar(P, k) {
  if (!P) return; P.defK = k; if (P.ev3Def) return; P.ev3Def = true;
  const ant = P.poseExtra;
  P.poseExtra = (Q) => {
    if (ant) ant(Q);
    const md = Q.md, h = Q.D.h.Head, n = Q.D.h.Neck; if (h === undefined || n === undefined) return;
    const sN = md.s[n], sH = md.s[h], kk = Math.max(0, Q.defK || 0);
    if (!Q.defS0) Q.defS0 = { n: sN.slice(), h: sH.slice() };
    const nx = 1 - 0.3 * kk, ny = 1 + 1.45 * kk;
    sN[0] = Q.defS0.n[0] * nx; sN[1] = Q.defS0.n[1] * ny; sN[2] = Q.defS0.n[2] * nx;
    sH[0] = Q.defS0.h[0] * (1 - 0.16 * kk) / nx; sH[1] = Q.defS0.h[1] * (1 + 0.85 * kk) / ny; sH[2] = Q.defS0.h[2] * (1 + 0.05 * kk) / nx;
    if (kk > 0.001) {
      const tt = TIEMPO.t, j = kk * kk * (Math.sin(tt * 37) * 0.05 + Math.sin(tt * 23 + 1) * 0.04);
      const r = md.r[h], q = new Quat(r[0], r[1], r[2], r[3]).mul(Quat.axis(1, 0, 0, 0.72 * kk + j)).mul(Quat.axis(0, 0, 1, -0.14 * kk + j * 0.6)).norm();
      r[0] = q.x; r[1] = q.y; r[2] = q.z; r[3] = q.w;
      const rn = md.r[n], qn = new Quat(rn[0], rn[1], rn[2], rn[3]).mul(Quat.axis(1, 0, 0, -0.25 * kk)).mul(Quat.axis(0, 0, 1, -0.1 * kk)).norm(); rn[0] = qn.x; rn[1] = qn.y; rn[2] = qn.z; rn[3] = qn.w;
    }
    md.sucio = true;
  };
}
// la posición del mundo de un hueso de una persona
function ev3Hueso(P, n, out) { const i = P && P.D && P.D.h[n], W = i !== undefined && P.md && P.md.W && P.md.W[i]; if (!W) return null; return (out || v3()).set(W[12], W[13], W[14]); }
// ---------------- cada cuadro ----------------
function ev3IntroPaso(dt) {
  const t = EV3.t, C = EV3I.C, P = EV3I.yo;
  // el cuerpo en la silla: la cadera sobre el asiento (se corrige con lo que da la pose, los primeros cuadros)
  if (P && PERS.includes(P)) {
    P.sentado = true; P.manejando = true; P.suelo = true; P.vel.set(0, 0, 0); P.yaw = 0; P.ev3SinCabeza = !EV3I.fb;
    // (una sola vez: con la persona quieta unos cuadros, cuánto queda la cadera de su posición; después, fija)
    if (!EV3I.cuerpoOk) {
      const k = EV3I.calib || (EV3I.calib = { n: 0, p0: P.pos.clone() }); P.pos.copy(k.p0);
      if (++k.n >= 4) { const hc = ev3Hueso(P, 'Hips'); if (hc && isFinite(hc.x) && hc.distTo(k.p0) < 3) { P.pos.copy(vadd(k.p0, vsub(v3(C.x, C.y + 0.5, C.z - 0.44), hc))); EV3I.cuerpoOk = true; EV3I.pFijo = P.pos.clone(); } else if (k.n > 30) { EV3I.cuerpoOk = true; EV3I.pFijo = k.p0.clone(); } }
    } else P.pos.copy(EV3I.pFijo);
  }
  // el guion
  while (EV3I.paso < EV3I_GUION.length && t >= EV3I_GUION[EV3I.paso][0]) { ev3IntroAccion(EV3I_GUION[EV3I.paso][1]); EV3I.paso++; }
  // la imagen: entra de a poco; la cinta gastada al principio
  if (t < 3) { VHS.negro = clamp(1 - (t - 0.8) / 1.6, 0, 1); VHS.dano = 0.6 - 0.25 * clamp(t / 3, 0, 1); }
  // el latido (más rápido al final) y el grave que sube
  EV3I.latT = (EV3I.latT || 0) - dt; if (EV3I.latT <= 0 && t > 1 && !EV3I.golpeado) { EV3I.latT = t > 28 ? 0.55 : t > 20 ? 0.75 : 0.95; ev3Son('latido', 0, 0.55); }
  ev3Bucle('grave', 'grave', clamp((t - 1) / 20, 0, 1) * 0.5 + (t > 29 ? 0.3 : 0));
  // los recuerdos
  const F = EV3I.fb;
  if (F) {
    F.t += dt; ev3FbPaso(F, dt);
    VHS.agua = clamp(Math.min(F.t / 0.18, (EV3I_FB_DUR - F.t) / 0.25), 0, 1); ev3Agua(VHS.agua);
    VHS.blanco = F.t < 0.12 ? 1 - F.t / 0.12 : 0;
    if (F.t >= EV3I_FB_DUR) ev3FbFin();
  }
  // la entidad: entra por la puerta y camina hasta la silla
  const E = EV3I.ent;
  if (E && PERS.includes(E)) {
    const meta = v3(C.x + 0.1, C.y, C.z + 0.55), d = v3(meta.x - E.pos.x, 0, meta.z - E.pos.z), L = Math.hypot(d.x, d.z);
    if (t > 30.0 && L > 0.05 && !EV3I.swing) { const v = Math.min(1.5, L / Math.max(dt, 1e-3)); E.vel.set(d.x / L * v, 0, d.z / L * v); E.pos.x += E.vel.x * dt; E.pos.z += E.vel.z * dt; E.yaw = Math.atan2(d.x, d.z); }
    else { E.vel.set(0, 0, 0); E.yaw = Math.atan2(C.x - E.pos.x, (C.z - 0.4) - E.pos.z); }
    E.pos.y = C.y + 0.96; E.suelo = true; ev3Deformar(E, 0.85 + 0.15 * Math.sin(t * 3)); if (E.md) E.md.tinte = EV3_NEGRO;   // (el modelo se cambia cuando termina de cargar: el tinte, cada cuadro)
  }
  // la puerta se abre
  if (EV3I.puertaT !== undefined && EV3I.puerta) {
    const k = clamp((t - EV3I.puertaT) / 1.2, 0, 1), s = k * k * (3 - 2 * k), o = EV3I.puerta, hinge = vadd(EV3I.puertaP0, v3(-0.55, 0, 0));
    const q = Quat.axis(0, 1, 0, -1.6 * s).mul(EV3I.puertaQ0); o.b.q.copy(q); o.b.pos.copy(vadd(hinge, Quat.axis(0, 1, 0, -1.6 * s).rot(v3(0.55, 0, 0)))); o.b.updateWorld && o.b.updateWorld();
  }
  // el golpe: rojo, sacudón y a negro
  if (EV3I.golpeado) { const k = t - EV3I.golpeT; VHS.rojo = clamp(1 - k / 0.5, 0, 1); VHS.sacudon = clamp(1 - k / 0.7, 0, 1); VHS.negro = clamp((k - 0.15) / 0.2, 0, 1); VHS.dano = 0.9; }
}
function ev3IntroAccion(a) {
  const C = EV3I.C;
  if (a.startsWith('v:')) { ev3Voz(a.slice(2), 1); return; }
  if (a.startsWith('fb:')) { ev3FbEmpezar(+a.slice(3)); return; }
  if (a === 'apagon') { EV3I.apagado = true; ev3Son('electrico', 0, 0.6); return; }
  if (a === 'puerta') {
    EV3I.apagado = false; EV3I.rojo = true; EV3I.puertaT = EV3.t; ev3Son('chirrido', 0, 1);
    // la entidad: Pepe, deformado, oscuro, más alto y con un bate, en la puerta
    const E = crearPersona('Engineer', 'HatEmpty', { nombre: '' }); EV3.pers.push(E); EV3I.ent = E;
    E.pos.set(C.x - 1.05, C.y + 0.96, C.z + 3.9); E.yaw = Math.PI; E.vel.set(0, 0, 0); E.suelo = true; E.arma = 'Bat'; E.escVis = 1.18;
    if (E.md) E.md.tinte = EV3_NEGRO;
    ev3Deformar(E, 1);
    return;
  }
  if (a === 'swing') { EV3I.swing = true; if (EV3I.ent) humAccion(EV3I.ent, 'tiro'); sonar('CB_Swing', null, 0.9, 0.8); return; }
  if (a === 'golpe') {
    EV3I.golpeado = true; EV3I.golpeT = EV3.t; ev3Son('golpe', 0, 1.2); sonar('CB_Flesh' + (1 + ((Math.random() * 5) | 0)), null, 1); CAM.temblor = 1;
    ev3Bucle('grave', 'grave', 0); ev3Bucle('cinta', 'cinta', 0.2); return;
  }
  if (a === 'fin') { ev3Bucle('cinta', 'cinta', 0.05); vhsTexto('I', 'STOP ■'); setTimeout(() => { if (EV3.fase === 'intro') ev3Fase('despertar'); }, 900); }
}
// ---------------- los recuerdos (de día, en primera persona, bajo el agua) ----------------
// 1: palancazos a Pepe; 2: una patada; 3: un tiro al barril explosivo al lado de Pepe
const EV3I_FB_LUGAR = [[6, -14], [-6, -18], [14, -24]];
function ev3FbEmpezar(n) {
  const [x, z] = EV3I_FB_LUGAR[n - 1], y = ev3Piso(x, z), F = { n, t: 0, x, z, y, pepe: null, barril: null, hecho: 0 };
  EV3I.fb = F;
  DIA.hora = 12.5; DIA.aplicada = -1; if (typeof diaAplicar === 'function') diaAplicar();
  // vos, parado, mirando a Pepe (la cámara de siempre: la de los ojos del jugador)
  JUG.pos.set(x, y + 0.97, z); JUG.vel.set(0, 0, 0); JUG.bloqueado = true; JUG.yaw = 0; JUG.pitch = 0.08;
  const pe = npcCrear('Engineer', v3(x, y, z + (n === 2 ? 1.05 : 1.55)), Math.PI, { modo: 'quieto', emote: '', vida: n === 1 ? 30 : 100 });
  if (pe) { EV3.pers.push(pe); pe.ia.ragT = 1e9; F.pepe = pe; }
  if (n === 1) { ARM.lista = ['Crowbar']; ARM.i = 0; if (typeof elegirArma === 'function') elegirArma(0); EV3.sinVista = false; }
  else if (n === 2) { ARM.lista = ['Hands']; ARM.i = 0; EV3.sinVista = true; }
  else if (n === 3) {
    ARM.lista = ['Pistol']; ARM.i = 0; if (typeof elegirArma === 'function') elegirArma(0); EV3.sinVista = false;
    const b = ev3Prop('BarrilExplosivo', v3(x + 0.85, y + 0.6, z + 2.3), new Quat(), { piso: y }); if (b) { b.b.frozen = false; F.barril = b; }
    if (pe) { pe.pos.x = x - 0.1; pe.pos.z = z + 2.0; }
    // (mirando al barril)
    const d = vsub(v3(x + 0.85, y + 0.55, z + 2.3), v3(x, y + 1.6, z)); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z));
  }
}
function ev3FbPaso(F, dt) {
  const pe = F.pepe, D = typeof DEF_ARMAS !== 'undefined' ? DEF_ARMAS : {};
  if (pe && !pe.rag) pe.vel.set(0, 0, 0);
  // (cada golpe en su momento, hecho acá —la animación del arma en la mano, el sonido, la sangre, Pepe que se dobla—: no
  // depende de que el arma ya esté lista para disparar)
  const golpe = (n) => { const pp = pe ? vadd(pe.pos, v3(0, 0.55, 0)) : null; if (pp) { sonar('CB_Flesh' + n, pp, 1); ev3Sangre(pp); } if (pe && !pe.rag) humAccion(pe, 'golpe'); CAM.temblor = Math.max(CAM.temblor, 0.35); };
  if (F.n === 1) {
    if (F.hecho === 0 && F.t > 0.22) { F.hecho = 1; if (ARM.v && D.Crowbar) vistaTocar(ARM.v, D.Crowbar.pega[0]); sonar('CB_Swing', null, 0.8); }
    if (F.hecho === 1 && F.t > 0.34) { F.hecho = 2; golpe(2); }
    if (F.hecho === 2 && F.t > 0.8) { F.hecho = 3; if (ARM.v && D.Crowbar) vistaTocar(ARM.v, D.Crowbar.pega[1]); sonar('CB_Swing', null, 0.8); }
    if (F.hecho === 3 && F.t > 0.92) { F.hecho = 4; golpe(4); if (pe && typeof npcTumbar === 'function') npcTumbar(pe, vadd(vscale(Quat.euler(JUG.yaw, 0).rot(v3(0, 0, 1)), 8), v3(0, 2.5, 0))); }
  }
  if (F.n === 2) {
    if (F.hecho === 0 && F.t > 0.28) { F.hecho = 1; if (typeof patear === 'function') patear(); }
    if (F.hecho === 1 && F.t > 0.55) { F.hecho = 2; golpe(3); if (pe && !pe.rag && typeof npcTumbar === 'function') npcTumbar(pe, vadd(vscale(Quat.euler(JUG.yaw, 0).rot(v3(0, 0, 1)), 11), v3(0, 3.5, 0))); }
  }
  if (F.n === 3) {
    if (F.hecho === 0 && F.t > 0.3) { F.hecho = 1; if (ARM.v && D.Pistol) vistaTocar(ARM.v, D.Pistol.fuego); sonar(D.Pistol ? D.Pistol.sF : 'Click', null, 0.9); }
    if (F.hecho === 1 && F.t > 0.38) {
      F.hecho = 2; const b = F.barril; const pb = b && OBJS.includes(b) ? b.b.pos.clone() : v3(F.x + 0.85, F.y + 0.5, F.z + 2.3);
      if (b && OBJS.includes(b)) borrarObjeto(b, true); F.barril = null;
      if (typeof explosion === 'function') explosion(pb, 6, 100);
      if (pe && !pe.rag && typeof npcTumbar === 'function') { const d = vsub(pe.pos, pb); d.y = 0; const L = d.len() || 1; npcTumbar(pe, vadd(vscale(d, 14 / L), v3(0, 9, 0))); }
      CAM.temblor = 1;
    }
  }
}
// sangre: unas gotas rojas que saltan y caen
function ev3Sangre(p) { for (let i = 0; i < 10; i++) particula(vadd(p, v3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2)), v3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3), 0.6 + Math.random() * 0.4, 0.035 + Math.random() * 0.03, [0.45, 0.02, 0.02, 1], 'chispa', 0); }
function ev3FbFin() {
  const F = EV3I.fb; EV3I.fb = null; VHS.agua = 0; VHS.blanco = 0; ev3Agua(0); ENT.disparo = false; EV3.fbDisparo = 0;
  if (F.pepe) { const i = EV3.pers.indexOf(F.pepe); if (i >= 0) EV3.pers.splice(i, 1); if (F.pepe.npc) npcQuitar(F.pepe); else if (PERS.includes(F.pepe)) borrarPersona(F.pepe); }
  for (const P of PERS.slice()) if (P.npc && P.rag && P.skin === 'Engineer' && P.pos.distTo(v3(F.x, F.y, F.z)) < 30 && !EV3.pers.includes(P)) borrarPersona(P);
  if (F.barril && OBJS.includes(F.barril)) borrarObjeto(F.barril, true);
  DIA.hora = 1.5; DIA.aplicada = -1; if (typeof diaAplicar === 'function') diaAplicar();
  ARM.lista = ['Hands']; ARM.i = 0; EV3.sinVista = true;
  const C = EV3I.C; JUG.pos.set(C.x, C.y + 0.97, C.z - 0.4); JUG.vel.set(0, 0, 0); JUG.bloqueado = true; JUG.yaw = EV3I.yawVuelta || 0; JUG.pitch = EV3I.pitchVuelta || 0.05;
}
// ---------------- la cámara: en los ojos, con lo que deja girar el cuello ----------------
function ev3IntroCamara(Cm) {
  if (EV3I.fb) return false;   // (los recuerdos: la cámara de siempre)
  const P = EV3I.yo, C = EV3I.C; if (!P || !C) return false;
  // (el cuello: 75° para cada lado, de 25° para arriba a 63° para abajo —la panza y las piernas—)
  let dy = JUG.yaw - EV3I.yaw0; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); dy = clamp(dy, -1.3, 1.3); JUG.yaw = EV3I.yaw0 + dy; JUG.pitch = clamp(JUG.pitch, -0.45, 1.1);
  // (al final, cuando la entidad se acerca, la cabeza va sola hacia ella)
  if (EV3I.ent && EV3.t > 30.6) { const E = EV3I.ent, d = vsub(ev3Hueso(E, 'Head') || vadd(E.pos, v3(0, 0.8, 0)), Cm.pos); const my = Math.atan2(d.x, d.z), mp = -Math.atan2(d.y, Math.hypot(d.x, d.z)); const k = Math.min(1, TIEMPO.dt * 2.2); let e2 = my - JUG.yaw; e2 = Math.atan2(Math.sin(e2), Math.cos(e2)); JUG.yaw += e2 * k; JUG.pitch += (mp - JUG.pitch) * k; }
  EV3I.yawVuelta = JUG.yaw; EV3I.pitchVuelta = JUG.pitch;
  const h = EV3I.cuerpoOk ? ev3Hueso(P, 'Head', EV3I.hd) : null;
  let ojo = h && isFinite(h.x) && h.distTo(C) < 4 ? vadd(h, v3(0, 0.07, 0)) : v3(C.x, C.y + 1.18, C.z - 0.4);
  ojo = vadd(ojo, vscale(Quat.euler(JUG.yaw, 0).rot(v3(0, 0, 1)), 0.07));
  // (respirando: un vaivén chico; más agitado al final)
  const t = EV3.t, ag = t > 28 ? 2.2 : 1;
  Cm.pos.copy(vadd(ojo, v3(0, Math.sin(t * 1.7 * ag) * 0.006 * ag, 0)));
  Cm.q.copy(Quat.euler(JUG.yaw + Math.sin(t * 0.7) * 0.01, JUG.pitch + Math.sin(t * 1.7 * ag) * 0.008 * ag));
  return true;
}
// ---------------- lo dibujado a mano: el cuarto, las sogas, las luces de REC, la lamparita, la estática ----------------
function ev3IntroDibujar() {
  if (EV3I.malla >= 0 && R.mallas[EV3I.malla]) encolar(EV3I.malla, 0, EV3I.mat, IDM, null, null);
  const t = EV3.t, C = EV3I.C;
  // la lamparita colgando del techo, con su cable
  const bp = v3(C.x, C.y + 2.35, C.z - 0.1);
  dibujarCaja(vadd(bp, v3(0, 0.29, 0)), [0.012, 0.55, 0.012], null, EV3I.matCable);
  if (!EV3I.apagado) dibujarCaja(bp, [0.07, 0.1, 0.07], null, EV3I.matBulbo);
  // la luz de REC de cada cámara (titila; al final, todas juntas)
  const juntas = t > 25.4 && t < 29;
  for (const c of EV3I.cams) {
    if (!c || !OBJS.includes(c.o)) continue;
    const on = juntas ? Math.floor(t * 2) % 2 === 0 : Math.floor((t + c.fase) * 1.25) % 2 === 0; if (!on) continue;
    const q = c.o.b.q, p = vadd(c.o.b.pos, q.rot(EV3I_REC));
    dibujarCaja(p, [0.025, 0.025, 0.025], q, EV3I.matRojo);
  }
  // la estática de los monitores (la pantalla: una caja finita adelante, que titila)
  for (const m of EV3I.monis) { if (!OBJS.includes(m)) continue; const q = m.b.q, p = vadd(m.b.pos, q.rot(EV3I_PANT)); const k = 0.55 + 0.45 * Math.random(); dibujarCaja(p, [0.42 * k + 0.1, 0.32, 0.01], q, EV3I.matEst); }
  // las sogas (del cuerpo: pecho y cintura contra el respaldo, los tobillos)
  const P = EV3I.yo; if (P && PERS.includes(P) && !EV3I.fb) ev3Sogas(P);
}
// (dónde están la luz de REC y la pantalla, en los ejes del modelo: calibrado mirando)
let EV3I_REC = v3(0.0, 0.62, 0.32), EV3I_PANT = v3(0, 0.1, 0.3);
function ev3Sogas(P) {
  const yaw = P.yaw, qy = Quat.axis(0, 1, 0, yaw), M = EV3I.matSoga;
  const anillo = (c, rx, rz, n, grueso) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const p0 = vadd(c, qy.rot(v3(Math.sin(a0) * rx, 0, Math.cos(a0) * rz))), p1 = vadd(c, qy.rot(v3(Math.sin(a1) * rx, 0, Math.cos(a1) * rz)));
      const m = vscale(vadd(p0, p1), 0.5), d = vsub(p1, p0), L = d.len();
      dibujarCaja(m, [grueso, grueso, L * 1.02], Quat.euler(Math.atan2(d.x, d.z), 0), M);
    }
  };
  const ch = ev3Hueso(P, 'Spine2'), ci = ev3Hueso(P, 'Spine'), la = ev3Hueso(P, 'LeftFoot'), ra = ev3Hueso(P, 'RightFoot');
  // (el anillo va un poco atrás: abraza también el respaldo)
  if (ch) { anillo(vadd(ch, qy.rot(v3(0, -0.02, -0.06))), 0.21, 0.2, 12, 0.017); anillo(vadd(ch, qy.rot(v3(0, -0.09, -0.06))), 0.2, 0.19, 12, 0.017); }
  if (ci) anillo(vadd(ci, qy.rot(v3(0, 0.0, -0.05))), 0.19, 0.17, 12, 0.017);
  if (la && ra) { const c = vscale(vadd(la, ra), 0.5); anillo(vadd(c, v3(0, 0.1, 0)), 0.15, 0.08, 10, 0.016); }
}
function ev3IntroLuces() {
  const C = EV3I.C; if (!C) return; const t = EV3.t;
  if (EV3I.fb) return;   // (de día: el sol)
  // la lamparita: titila, y de golpe baja
  let f = 1; const r = Math.sin(t * 23.1) * Math.sin(t * 7.3); if (r > 0.86) f = 0.25; if (t > 26 && Math.random() < 0.08) f = 0.1;
  if (!EV3I.apagado) luzEspecial(v3(C.x, C.y + 2.25, C.z - 0.1), 7.5, [3.6 * f, 3.1 * f, 2.3 * f], null, -2, 9);
  // los monitores: un poco de azul
  luzEspecial(v3(C.x + 1.9, C.y + 1.25, C.z + 1.1), 3.2, [0.5, 0.6, 0.75].map((x) => x * (0.7 + 0.3 * Math.random())), null, -2, 6);
  // afuera de la puerta, rojo (cuando se abre)
  if (EV3I.rojo) luzEspecial(v3(C.x - 1.05, C.y + 2.0, C.z + 4.6), 7, [3.2, 0.35, 0.3], null, -2, 8);
}
// ---------------- después del golpe ----------------
function ev3DespertarArmar() { EV3.despierta = 0; ev3Fase('puzles'); }
function ev3DespertarPaso() {}
// (al dejar la intro: todo lo del cuarto se va)
function ev3Salir(ant) {
  if (ant === 'intro') {
    ev3Limpiar(); document.body.classList.remove('ev3Quieto'); VHS.rojo = VHS.sacudon = VHS.agua = VHS.blanco = 0; ev3Agua(0);
    if (EV3I.malla >= 0) { mallaPropiaBorrar(EV3I.malla); EV3I.malla = -1; }
    EV3I.ent = null; EV3I.yo = null; EV3I.cams = []; EV3I.monis = []; EV3I.fb = null; EV3I.swing = false; EV3I.rojo = false; EV3I.apagado = false; EV3I.puertaT = undefined;
    ev3BucleParar('grave');
  }
}
