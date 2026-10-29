// ---------------------------------------------------------------------------------------------------------
// personajes: los 14 skins del juego (huesos mixamo) con su gorro, animación hecha por código (parado,
// caminar, correr, saltar, agacharse, sentado, sostener el arma y los 15 emotes) y muñeco de trapo armado
// con los HitBox del juego (cajas y cápsulas con sus masas).
// ---------------------------------------------------------------------------------------------------------
const PERS = [];
const HUESOS = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
const _skinCache = {};
function datosSkin(skin) {
  if (_skinCache[skin]) return _skinCache[skin];
  const arb = arbolJugador(), cr = arb.findIndex((n) => n.n === 'CharactersRoot');
  let si = arb.findIndex((n) => n.pa === cr && n.n === skin); if (si < 0) si = arb.findIndex((n) => n.pa === cr && n.n === 'Hero');
  const sub = subArbol(arb, si);
  const md = new Modelo(sub); md.actualizar();
  const h = {}; for (let i = 0; i < sub.length; i++) { const m = /^mixamorig\d*:(.*)$/.exec(sub[i].n); if (m && HUESOS.includes(m[1]) && h[m[1]] === undefined) h[m[1]] = i; }
  const rw = sub.map((x, i) => m4quat(md.W[i]));
  const rp = sub.map((x, i) => v3(md.W[i][12], md.W[i][13], md.W[i][14]));
  // altura del tobillo con el personaje parado (para apoyar los pies en el piso)
  const tobillo = h.LeftFoot !== undefined && h.RightFoot !== undefined ? Math.max(0.02, Math.min(rp[h.LeftFoot].y, rp[h.RightFoot].y)) : 0.08;
  return (_skinCache[skin] = { sub, h, rw, rp, cr, tobillo });
}
function crearPersona(skin, gorro, opt) {
  const D = datosSkin(skin), md = new Modelo(D.sub);
  const P = { skin, gorro, md, D, pos: v3(), yaw: 0, vel: v3(), suelo: true, sentado: false, agachado: false, arma: null, emote: null, emoteT: 0, t: Math.random() * 10,
    fase: 0, vivo: true, rag: null, vida: 100, base: md.r.map((r) => r.slice()), visible: true, nombre: (opt && opt.nombre) || '', mira: 0 };
  // gorro: sub-árbol del contenedor Hats, pegado a la cabeza
  if (gorro && gorro !== 'HatEmpty') {
    const arb = arbolJugador(), hats = arb.findIndex((n, i) => n.n === 'Hats' && arb[n.pa] && arb[n.pa].n === 'CharactersRoot');
    const gi = arb.findIndex((n) => n.pa === hats && n.n === gorro);
    if (gi >= 0) { P.gorroMd = new Modelo(subArbol(arb, gi)); P.gorroL = new Float32Array(16); m4trs(arb[gi].p, arb[gi].r, arb[gi].s, P.gorroL); P.gorroMd.p[0] = [0, 0, 0]; P.gorroMd.r[0] = [0, 0, 0, 1]; P.gorroMd.s[0] = [1, 1, 1]; }
  }
  P.hum = humanoPreparar(P);
  PERS.push(P); return P;
}
function borrarPersona(P) { const i = PERS.indexOf(P); if (i >= 0) PERS.splice(i, 1); if (P.rag) ragdollFin(P); }
// gira un hueso alrededor de un eje del personaje (en reposo). Los giros se acumulan en el orden en que se
// piden (el último queda "afuera") y al final: r = r0 · (q0⁻¹ · R · q0)
const _qa = new Quat(), _qb = new Quat();
function girar(P, nombre, ax, ay, az, ang) {
  const i = P.D.h[nombre]; if (i === undefined || !ang) return;
  const R = Quat.axis(ax, ay, az, ang), acc = P.acc[i];
  P.acc[i] = acc ? R.mul(acc) : R;
}
function aplicarGiros(P) {
  for (const k in P.acc) {
    const i = +k, q0 = P.D.rw[i];
    _qa.mulTo(q0.conj(), P.acc[k]).mul(q0);
    const r = P.md.r[i]; _qb.set(r[0], r[1], r[2], r[3]).mul(_qa).norm(); r[0] = _qb.x; r[1] = _qb.y; r[2] = _qb.z; r[3] = _qb.w;
  }
}
// el cuerpo según lo que hace
function animarPersona(P, dt) {
  if (P.cuad) { natCuadPose(P, dt); return; } // SCP en cuatro patas (mod)
  if (P.hum) { if (P.emote) P.emoteT += dt; animarHumano(P, dt); if (P.poseExtra) P.poseExtra(P, dt); return; }
  P.acc = {}; animarPersona0(P, dt); aplicarGiros(P);
}
function animarPersona0(P, dt) {
  const md = P.md; for (let i = 0; i < md.r.length; i++) { const b = P.base[i], r = md.r[i]; r[0] = b[0]; r[1] = b[1]; r[2] = b[2]; r[3] = b[3]; }
  P.t += dt;
  const sp = Math.hypot(P.vel.x, P.vel.z), corre = sp > 6.5, k = clamp(sp / 6, 0, 1.4);
  P.fase += dt * (sp > 0.2 ? 2.2 + sp * 0.9 : 0);
  const s = Math.sin(P.fase), c = Math.cos(P.fase), t = P.t;
  // brazos abajo (el modelo viene en T)
  const brazo = 1.2;
  girar(P, 'LeftArm', 0, 0, 1, -brazo); girar(P, 'RightArm', 0, 0, 1, brazo);
  girar(P, 'LeftForeArm', 0, 1, 0, 0.25); girar(P, 'RightForeArm', 0, 1, 0, -0.25);
  if (P.emote) { animarEmote(P, dt); return; }
  if (P.sentado) {
    girar(P, 'LeftUpLeg', 1, 0, 0, -1.45); girar(P, 'RightUpLeg', 1, 0, 0, -1.45);
    girar(P, 'LeftLeg', 1, 0, 0, 1.45); girar(P, 'RightLeg', 1, 0, 0, 1.45);
    if (P.manejando) { girar(P, 'LeftArm', 1, 0, 0, -0.9); girar(P, 'RightArm', 1, 0, 0, -0.9); girar(P, 'LeftForeArm', 0, 1, 0, 0.6); girar(P, 'RightForeArm', 0, 1, 0, -0.6); }
    return;
  }
  if (!P.suelo) {
    girar(P, 'LeftUpLeg', 1, 0, 0, -0.5); girar(P, 'RightUpLeg', 1, 0, 0, -0.2); girar(P, 'LeftLeg', 1, 0, 0, 0.8); girar(P, 'RightLeg', 1, 0, 0, 0.4);
    girar(P, 'LeftArm', 0, 0, 1, 0.5); girar(P, 'RightArm', 0, 0, 1, -0.5);
  } else if (sp > 0.2) {
    const a = (corre ? 0.75 : 0.5) * Math.min(1, k);
    girar(P, 'LeftUpLeg', 1, 0, 0, s * a); girar(P, 'RightUpLeg', 1, 0, 0, -s * a);
    girar(P, 'LeftLeg', 1, 0, 0, Math.max(0, -c) * a * 1.4 + 0.05); girar(P, 'RightLeg', 1, 0, 0, Math.max(0, c) * a * 1.4 + 0.05);
    girar(P, 'LeftArm', 1, 0, 0, -s * a * 0.8); girar(P, 'RightArm', 1, 0, 0, s * a * 0.8);
    girar(P, 'Spine', 1, 0, 0, corre ? 0.18 : 0.06); girar(P, 'Spine1', 0, 1, 0, s * 0.08);
  } else {
    girar(P, 'Spine1', 1, 0, 0, Math.sin(t * 1.6) * 0.02); girar(P, 'LeftArm', 0, 0, 1, Math.sin(t * 1.6) * 0.03);
  }
  if (P.agachado) { girar(P, 'LeftUpLeg', 1, 0, 0, -1.0); girar(P, 'RightUpLeg', 1, 0, 0, -1.0); girar(P, 'LeftLeg', 1, 0, 0, 1.6); girar(P, 'RightLeg', 1, 0, 0, 1.6); girar(P, 'Spine', 1, 0, 0, 0.35); }
  // con arma: los brazos hacia adelante y la cabeza/espalda siguen la mira
  if (P.arma && P.arma !== 'Hands') {
    girar(P, 'RightArm', 1, 0, 0, -1.3); girar(P, 'RightArm', 0, 1, 0, 0.2); girar(P, 'RightForeArm', 0, 1, 0, -0.15);
    girar(P, 'LeftArm', 1, 0, 0, -1.25); girar(P, 'LeftArm', 0, 1, 0, -0.75); girar(P, 'LeftForeArm', 0, 1, 0, 0.7);
  }
  girar(P, 'Spine2', 1, 0, 0, P.mira * 0.35); girar(P, 'Head', 1, 0, 0, P.mira * 0.5);
}
function animarEmote(P, dt) {
  P.emoteT += dt; const t = P.emoteT, s = Math.sin(t * 6), e = P.emote;
  switch (e) {
    case 'Hi': girar(P, 'RightArm', 0, 0, 1, -2.5); girar(P, 'RightForeArm', 0, 0, 1, -0.4 + s * 0.4); break;
    case 'Clap': { const a = 0.45 + Math.abs(s) * 0.4; girar(P, 'LeftArm', 1, 0, 0, -1.2); girar(P, 'RightArm', 1, 0, 0, -1.2); girar(P, 'LeftArm', 0, 1, 0, -a); girar(P, 'RightArm', 0, 1, 0, a); break; }
    case 'Victory': girar(P, 'LeftArm', 0, 0, 1, 2.6 + s * 0.15); girar(P, 'RightArm', 0, 0, 1, -2.6 - s * 0.15); break;
    case 'Disagree': girar(P, 'Head', 0, 1, 0, s * 0.5); girar(P, 'RightArm', 1, 0, 0, -0.6); girar(P, 'RightForeArm', 0, 1, 0, -1.2); break;
    case 'ChickenDance': { girar(P, 'LeftArm', 0, 0, 1, 1.1 + s * 0.5); girar(P, 'RightArm', 0, 0, 1, -1.1 - s * 0.5); girar(P, 'LeftForeArm', 0, 1, 0, 2.2); girar(P, 'RightForeArm', 0, 1, 0, -2.2); girar(P, 'Hips', 0, 1, 0, s * 0.3); girar(P, 'LeftUpLeg', 1, 0, 0, Math.max(0, s) * -0.6); girar(P, 'LeftLeg', 1, 0, 0, Math.max(0, s) * 0.9); break; }
    case 'Sitting': girar(P, 'LeftUpLeg', 1, 0, 0, -1.45); girar(P, 'RightUpLeg', 1, 0, 0, -1.45); girar(P, 'LeftLeg', 1, 0, 0, 1.45); girar(P, 'RightLeg', 1, 0, 0, 1.45); break;
    case 'Scream': girar(P, 'Head', 1, 0, 0, -0.5); girar(P, 'Spine2', 1, 0, 0, -0.3); girar(P, 'LeftArm', 0, 0, 1, 1.9 + s * 0.1); girar(P, 'RightArm', 0, 0, 1, -1.9 - s * 0.1); break;
    case 'Kick': { const k = Math.sin(Math.min(1, t * 1.6) * Math.PI); girar(P, 'RightUpLeg', 1, 0, 0, -1.7 * k); girar(P, 'RightUpLeg', 0, 0, 1, 0.6 * k); girar(P, 'Spine', 0, 1, 0, 1.2 * k); girar(P, 'LeftArm', 0, 0, 1, 1.0); break; }
    case 'FightIdle': girar(P, 'LeftArm', 1, 0, 0, -1.2); girar(P, 'RightArm', 1, 0, 0, -1.0); girar(P, 'LeftForeArm', 0, 1, 0, 2); girar(P, 'RightForeArm', 0, 1, 0, -2); girar(P, 'Spine1', 0, 1, 0, s * 0.1); girar(P, 'LeftUpLeg', 1, 0, 0, -0.3); girar(P, 'LeftLeg', 1, 0, 0, 0.4); break;
    case 'AirSquat': { const q = (Math.sin(t * 3) + 1) / 2; girar(P, 'LeftUpLeg', 1, 0, 0, -1.4 * q); girar(P, 'RightUpLeg', 1, 0, 0, -1.4 * q); girar(P, 'LeftLeg', 1, 0, 0, 2.2 * q); girar(P, 'RightLeg', 1, 0, 0, 2.2 * q); girar(P, 'LeftArm', 1, 0, 0, -1.5 * q); girar(P, 'RightArm', 1, 0, 0, -1.5 * q); P.bajar = 0.45 * q; break; }
    case 'Techno': girar(P, 'RightArm', 0, 0, 1, -1.6 - Math.max(0, s) * 1.2); girar(P, 'LeftArm', 1, 0, 0, -1.2); girar(P, 'LeftForeArm', 0, 1, 0, 1.6); girar(P, 'Hips', 0, 1, 0, s * 0.15); girar(P, 'Head', 1, 0, 0, Math.abs(s) * 0.3); break;
    case 'Twerk': { girar(P, 'Spine', 1, 0, 0, 0.6); girar(P, 'Hips', 1, 0, 0, -0.4 + s * 0.35); girar(P, 'LeftUpLeg', 1, 0, 0, -0.7); girar(P, 'RightUpLeg', 1, 0, 0, -0.7); girar(P, 'LeftLeg', 1, 0, 0, 0.9); girar(P, 'RightLeg', 1, 0, 0, 0.9); girar(P, 'LeftArm', 0, 0, 1, 0.3); girar(P, 'RightArm', 0, 0, 1, -0.3); P.bajar = 0.25; break; }
    case 'Bencao': girar(P, 'RightArm', 1, 0, 0, -1.2); girar(P, 'RightForeArm', 0, 1, 0, -1.8 + s * 0.3); girar(P, 'Head', 1, 0, 0, 0.3); break;
    case 'Flair': { girar(P, 'Hips', 0, 1, 0, t * 8); girar(P, 'LeftUpLeg', 0, 0, 1, 1.0); girar(P, 'RightUpLeg', 0, 0, 1, -1.0); girar(P, 'LeftArm', 0, 0, 1, 1.0); girar(P, 'RightArm', 0, 0, 1, -1.0); break; }
    case 'Backflip': { const k = clamp(t / 1.1, 0, 1); girar(P, 'Hips', 1, 0, 0, -k * TAU); P.subir = Math.sin(k * Math.PI) * 1.1; girar(P, 'LeftUpLeg', 1, 0, 0, -Math.sin(k * Math.PI) * 1.4); girar(P, 'RightUpLeg', 1, 0, 0, -Math.sin(k * Math.PI) * 1.4); girar(P, 'LeftLeg', 1, 0, 0, Math.sin(k * Math.PI) * 1.8); girar(P, 'RightLeg', 1, 0, 0, Math.sin(k * Math.PI) * 1.8); if (t > 1.3) P.emote = null; break; }
  }
  if (t > 12 && e !== 'Sitting') P.emote = null;
}
function ubicarPersona(P) {
  if (P.rag || P.cuad) return;
  const y = P.pos.y - 1 - (P.bajar || 0) + (P.subir || 0) - (P.sentado ? 0.02 : 0);
  if (P.qVeh && P.sentado) {
    // sentado: el giro completo del vehículo, con el pivote en la cadera (1 m arriba de los pies)
    const q = P.qVeh, d = q.rot(v3(0, -1, 0));
    m4trs([P.pos.x + d.x, P.pos.y + d.y - (P.bajar || 0), P.pos.z + d.z], [q.x, q.y, q.z, q.w], [1, 1, 1], P.md.raiz);
  } else if (P.inclin) {
    // volando (mod): el cuerpo inclinado con el pivote en la cadera
    const q = Quat.axis(0, 1, 0, P.yaw).mul(P.inclin), d = q.rot(v3(0, -1, 0));
    m4trs([P.pos.x + d.x, P.pos.y + d.y, P.pos.z + d.z], [q.x, q.y, q.z, q.w], [1, 1, 1], P.md.raiz);
  } else m4trs([P.pos.x, y, P.pos.z], [0, Math.sin(P.yaw / 2), 0, Math.cos(P.yaw / 2)], [1, 1, 1], P.md.raiz);
  P.md.sucio = true;
  P.bajar = 0; P.subir = 0;
}
function dibujarPersona(P) {
  if (!P.visible) return;
  P.cDib = PERS_N; // (lo que se lleva puesto, como la radio en la espalda, usa los huesos de este cuadro)
  ubicarPersona(P);
  // (sentado, en un emote o en el piso como muñeco no se clavan los pies; se olvida el apoyo viejo para no tirar del pie al volver)
  if (!P.rag && P.hum && !P.sentado && !P.emote && !P.inclin && !P.cuad) { aterrizarPies(P); piesIK(P, TIEMPO.dt || 0.016); } else P.ik = null;
  P.md.encolar();
  if (P.gorroMd) {
    const hi = P.D.h.Head;
    if (hi !== undefined) { P.md.actualizar(); m4mul(P.md.W[hi], P.gorroL, _mb); P.gorroMd.ponerRaiz(_mb); P.gorroMd.encolar(); }
  }
  // el arma en la mano derecha (los modelos de tercera persona del juego, con su lugar en la mano)
  if (P.arma && !P.rag && !P.sentado && !P.emote && !P.cuad) {
    const A = arma3p(P, P.arma), hi = P.D.h.RightHand;
    if (A && hi !== undefined) { P.md.actualizar(); m4mul(P.md.W[hi], A.W, _mb); A.md.ponerRaiz(_mb); A.md.encolar(); }
  }
}
// pies en el piso: después de animar, se sube o baja el cuerpo para que el pie más bajo quede apoyado
// (agachado o al caer, del todo; caminando, sólo que no se hunda ni flote más de unos centímetros)
function aterrizarPies(P) {
  const md = P.md, h = P.D.h; if (h.LeftFoot === undefined || h.RightFoot === undefined) return;
  md.actualizar();
  const yl = md.W[h.LeftFoot][13], yr = md.W[h.RightFoot][13], piso = P.pos.y - 1;
  const dy = piso + P.D.tobillo - Math.min(yl, yr), lleno = P.hum && P.hum.agach > 0.05;
  const meta = clamp(dy, lleno ? -0.75 : -0.06, 0.5);
  P.pieCorr = (P.pieCorr || 0) + (meta - (P.pieCorr || 0)) * Math.min(1, (TIEMPO.dt || 0.016) * 18);
  if (Math.abs(P.pieCorr) > 1e-4) { md.raiz[13] += P.pieCorr; md.sucio = true; }
}
// pies clavados: cuando un pie pisa, su lugar en el piso queda fijo mientras dure el apoyo y la pierna se acomoda
// (dos huesos: muslo y pantorrilla, la rodilla en el mismo plano que traía). Así el pie que pisa no patina aunque el
// clip no coincida del todo con la velocidad o la dirección. Se suelta al levantar el pie, si la pierna no llega o
// después de 0,7 s, con entrada y salida suaves
const IK_PIERNA = { L: ['LeftUpLeg', 'LeftLeg', 'LeftFoot'], R: ['RightUpLeg', 'RightLeg', 'RightFoot'] };
function rotEntre(a, b) {
  const la = a.len(), lb = b.len(); if (la < 1e-6 || lb < 1e-6) return new Quat();
  const c = vcross(a, b), s = c.len() / (la * lb), d = vdot(a, b) / (la * lb);
  if (s < 1e-7) return new Quat();
  return Quat.axis(c.x, c.y, c.z, Math.atan2(s, d));
}
function piesIK(P, dt) {
  if (!P.suelo || P.sentado || P.emote || P.rag || DBG.sinIK) { P.ik = null; return; }
  const md = P.md, h = P.D.h, A = P.D.sub; md.actualizar();
  const W = md.W, piso = P.pos.y - 1, sp = Math.hypot(P.vel.x, P.vel.z), tob = P.D.tobillo;
  const ik = P.ik || (P.ik = { L: { w: 0 }, R: { w: 0 } });
  const D = P.D; if (!D.ikDedo) D.ikDedo = { L: D.sub.findIndex((n) => /LeftToeBase$/.test(n.n)), R: D.sub.findIndex((n) => /RightToeBase$/.test(n.n)) };
  let cambio = false;
  for (const lado of ['L', 'R']) {
    const [nU, nK, nA] = IK_PIERNA[lado], iU = h[nU], iK = h[nK], iA = h[nA];
    if (iU === undefined || iK === undefined || iA === undefined) continue;
    const S = ik[lado], Hp = v3(W[iU][12], W[iU][13], W[iU][14]), Kp = v3(W[iK][12], W[iK][13], W[iK][14]), Ap = v3(W[iA][12], W[iA][13], W[iA][14]);
    // el punto que pisa: entre el tobillo y la punta (al levantar el talón, el pie gira sobre la punta)
    const iT = D.ikDedo[lado], kc = 0.5, Cp = iT >= 0 ? v3(Ap.x + (W[iT][12] - Ap.x) * kc, 0, Ap.z + (W[iT][14] - Ap.z) * kc) : v3(Ap.x, 0, Ap.z);
    const vel = S.prev ? Math.hypot(Cp.x - S.prev.x, Cp.z - S.prev.z) / Math.max(dt, 1e-3) : 0;
    S.prev = Cp;
    const alto = Ap.y - piso - tob, a = Kp.distTo(Hp), b = Ap.distTo(Kp);
    // pisa: el pie (sin corregir) toca el piso y no va hacia adelante mucho más rápido que el cuerpo
    const apoya = alto < 0.03 && vel < sp + 1.5;
    if (apoya && !S.lock && S.w < 0.05) { S.lock = Cp; S.t = 0; }
    if (S.lock) {
      S.t += dt;
      // se suelta cuando el clip levanta el pie o cuando la pierna ya no llega (no se arrastra)
      // se suelta cuando el clip levanta el pie o cuando la pierna ya no llega (no se arrastra)
      const lejos = Math.hypot(Ap.x + S.lock.x - Cp.x - Hp.x, Ap.y - Hp.y, Ap.z + S.lock.z - Cp.z - Hp.z) > (a + b) * 0.985;
      if (alto > 0.07 || lejos || S.t > 1.0) S.lock = null; else S.ult = S.lock;
    }
    S.w = S.lock ? Math.min(1, S.w + dt / 0.05) : Math.max(0, S.w - dt / 0.12);
    if (S.w <= 0.001 || !S.ult) continue;
    const T = v3(Ap.x + (S.ult.x - Cp.x) * S.w, Ap.y, Ap.z + (S.ult.z - Cp.z) * S.w);
    // la rodilla nueva: misma distancia a la cadera y al tobillo, en el plano que trae la pierna
    const d = clamp(T.distTo(Hp), Math.abs(a - b) + 1e-3, a + b - 1e-3), dir = vsub(T, Hp).norm();
    const x = (a * a - b * b + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, a * a - x * x));
    let pol = vsub(Kp, Hp); pol = vsub(pol, vscale(dir, vdot(pol, dir)));
    if (pol.len() < 1e-5) pol = v3(Math.sin(P.yaw), 0, Math.cos(P.yaw)); pol.norm();
    const Kn = vadd(Hp, vadd(vscale(dir, x), vscale(pol, hh)));
    // giros en el mundo y de vuelta a cada hueso (el pie conserva su giro en el mundo)
    const qU = m4quat(W[iU]), qK = m4quat(W[iK]), qA = m4quat(W[iA]), qPU = m4quat(W[A[iU].pa]);
    const R1 = rotEntre(vsub(Kp, Hp), vsub(Kn, Hp)), qUn = R1.clone().mul(qU);
    const A2 = vadd(Hp, R1.rot(vsub(Ap, Hp)));
    const R2 = rotEntre(vsub(A2, Kn), vsub(T, Kn)), qKn = R2.clone().mul(R1).mul(qK);
    const pon = (i, q) => { q.norm(); const r = md.r[i]; r[0] = q.x; r[1] = q.y; r[2] = q.z; r[3] = q.w; };
    pon(iU, qPU.conj().mul(qUn)); pon(iK, qUn.conj().mul(qKn)); pon(iA, qKn.conj().mul(qA));
    cambio = true;
  }
  if (cambio) md.sucio = true;
}
const ARMA_3P = { Pistol: 'pistol', Revolver: 'revolver', Smg: 'smg', Akm: 'Akm', Sniper: 'sniper', Shotgun: 'Shotgun', RPG: 'RocketLauncher', Crossbow: 'crossbow', Bat: 'bat', GravityGun: 'GravityGun', PhysicsGun: 'PhysicGun', ToolBaton: 'ToolBaton' };
const _arma3pDatos = {};
function arma3p(P, nombre) {
  P.armas3p = P.armas3p || {};
  if (P.armas3p[nombre] !== undefined) return P.armas3p[nombre];
  let D = _arma3pDatos[nombre];
  if (D === undefined) {
    const arb = arbolJugador(), cr = arb.findIndex((n) => n.n === 'CharactersRoot'), wi = arb.findIndex((n) => n.pa === cr && n.n === 'Weapons');
    const ni = ARMA_3P[nombre] ? arb.findIndex((n) => n.pa === wi && n.n === ARMA_3P[nombre]) : -1;
    if (wi < 0 || ni < 0) D = null;
    else { const W = new Float32Array(16); m4trs(arb[wi].p, arb[wi].r, arb[wi].s, W); D = { sub: subArbol(arb, ni), W }; }
    _arma3pDatos[nombre] = D;
  }
  return (P.armas3p[nombre] = D ? { md: new Modelo(D.sub), W: D.W } : null);
}
// ---------------- muñeco de trapo ----------------
function ragdoll(P, impulso, donde) {
  if (P.rag) return;
  ubicarPersona(P); P.md.sucio = true; P.md.actualizar();
  const md = P.md, A = md.A, cuerpos = new Map();
  for (let i = 0; i < A.length; i++) {
    const x = A[i]; if (!x.rb || !x.col) continue;
    const c = x.col[0], W = md.W[i], s = m4esc(W);
    let sh, cen = m4pt(W, c.c[0], c.c[1], c.c[2], v3());
    if (c.k === 'b') sh = boxShape(Math.max(0.03, Math.abs(c.s[0] * s) / 2), Math.max(0.03, Math.abs(c.s[1] * s) / 2), Math.max(0.03, Math.abs(c.s[2] * s) / 2));
    else if (c.k === 'c') sh = capsuleShape(c.r * s, Math.max(0.01, c.h * s / 2 - c.r * s));
    else sh = sphereShape((c.r || 0.1) * s);
    const b = new Body(sh, Math.max(1, x.rb.m), { fric: 0.8, rest: 0.05, damp: 0.1, angDamp: 0.8 });
    b.pos.copy(cen); b.q.copy(m4quat(W));
    if (c.k === 'c' && c.d !== 1) b.q.mul(c.d === 0 ? Quat.axis(0, 0, 1, Math.PI / 2) : Quat.axis(1, 0, 0, Math.PI / 2));
    b.group = 1000 + (P.id || PERS.indexOf(P)); b.persona = P; b.noJug = true; b.noGrab = false;
    b.vel.copy(P.vel); addBody(b);
    // del cuerpo al hueso: W = M(cuerpo) · off
    const Mb = m4trs([b.pos.x, b.pos.y, b.pos.z], [b.q.x, b.q.y, b.q.z, b.q.w], [1, 1, 1], new Float32Array(16));
    cuerpos.set(i, { b, off: m4mul(M4.inv(Mb), W, new Float32Array(16)) });
  }
  // uniones con el ancestro más cercano que tenga cuerpo
  for (const [i, e] of cuerpos) {
    let p = A[i].pa; while (p >= 0 && !cuerpos.has(p)) p = A[p].pa;
    if (p < 0) continue;
    const W = md.W[i], pt = v3(W[12], W[13], W[14]), nom = A[i].n;
    const ax = vsub(pt, v3(md.W[p][12], md.W[p][13], md.W[p][14])); if (ax.len() < 1e-4) ax.set(0, 1, 0);
    const rod = /Leg$|ForeArm$/.test(nom);
    addJoint(cuerpos.get(p).b, e.b, pt, ax.norm(), rod ? { hinge: false, swing: 0.25, twist: 0.2 } : { swing: /Head/.test(nom) ? 0.6 : 0.9, twist: 0.5 });
  }
  if (impulso) { let best = null, bd = 1e9; for (const [i, e] of cuerpos) { const d = e.b.pos.distTo(donde || P.pos); if (d < bd) { bd = d; best = e.b; } } if (best) best.vel.add(impulso); }
  md.fijo = []; P.rag = { cuerpos, t: 0 };
}
function ragdollPaso(P) {
  const R2 = P.rag; if (!R2) return;
  for (const [i, e] of R2.cuerpos) { const b = e.b; const M = m4trs([b.pos.x, b.pos.y, b.pos.z], [b.q.x, b.q.y, b.q.z, b.q.w], [1, 1, 1], _mb); P.md.fijo[i] = m4mul(M, e.off, P.md.fijo[i] || new Float32Array(16)); }
  // los huesos sin cuerpo siguen a su padre
  P.md.sucio = true;
  const h = R2.cuerpos.get(P.D.h.Hips); if (h) P.pos.copy(h.b.pos);
}
function ragdollFin(P) { if (!P.rag) return; for (const [, e] of P.rag.cuerpos) removeBody(e.b); P.rag = null; P.md.fijo = null; P.md.sucio = true; }
// ---------------- daño ----------------
function danarPersona(P, dan, pos, d) {
  if (P === JUG.cuerpo) { danarJugador(dan, pos); return; }
  if (P.vivo !== false) humAccion(P, 'golpe');
  if (P.npc && P.vivo) { P.vida -= dan; if (P.vida <= 0) { P.vivo = false; ragdoll(P, vscale(d.clone().norm(), Math.min(12, dan * 0.3)), pos); P.muertoT = 8; } }
  if (P.remoto && typeof redDano === 'function') redDano(P, dan, d);
}
// ---------------- el cuerpo del jugador (tercera persona, vehículos, muerte) ----------------
function jugadorCuerpoNuevo() {
  if (JUG.cuerpo) borrarPersona(JUG.cuerpo);
  JUG.cuerpo = crearPersona(JUG.skinRol || JUG.skinMod || PREFS.skin, PREFS.gorro, { nombre: PREFS.nombre });
}
function jugadorRagdoll() { const P = JUG.cuerpo; if (!P) return; P.vel.copy(JUG.vel); ragdoll(P, vscale(JUG.vel, 0.2)); }
function emote(e) { if (!JUG.cuerpo || JUG.vehiculo) return; JUG.cuerpo.emote = e; JUG.cuerpo.emoteT = 0; if (!JUG.tercera) { JUG.tercera = true; JUG.terceraEmote = true; } if (typeof redEmote === 'function') redEmote(e); }
function personasPaso(dt) {
  const P = JUG.cuerpo;
  if (P) {
    if (!JUG.vivo || NAT.rag) ragdollPaso(P);
    else {
      if (P.rag) ragdollFin(P);
      P.pos.copy(JUG.pos); P.vel.copy(JUG.vel); P.suelo = JUG.suelo || !!JUG.vehiculo; P.agachado = ENT.agachar && !JUG.vehiculo;
      P.yaw = JUG.vehiculo ? Math.atan2(...(() => { const f = JUG.vehiculo.b.q.rot(v3(0, 0, 1)); return [f.x, f.z]; })()) : JUG.yaw;
      P.sentado = !!JUG.vehiculo; P.manejando = !!JUG.vehiculo && JUG.asiento === 0 && JUG.vehiculo.veh.tipo !== 'asiento';
      P.qVeh = JUG.vehiculo ? JUG.vehiculo.b.q : null;
      P.arma = JUG.vehiculo ? null : ARM.lista[ARM.i]; P.mira = JUG.pitch;
      if (P.emote && (Math.hypot(JUG.vel.x, JUG.vel.z) > 0.5 || !JUG.suelo)) { P.emote = null; if (JUG.terceraEmote) { JUG.tercera = false; JUG.terceraEmote = false; } }
      if (!P.emote && JUG.terceraEmote) { JUG.tercera = false; JUG.terceraEmote = false; }
      natPersona(P, dt);
    }
  }
  for (const Q2 of PERS) {
    if (Q2 === P) continue;
    if (Q2.rag) { ragdollPaso(Q2); if (Q2.npc && (Q2.muertoT -= dt) <= 0) borrarPersona(Q2); }
  }
}
function dibujarPersonas() {
  PERS_N++;
  for (const P of PERS) {
    if (P === JUG.cuerpo) { const ver = JUG.tercera || !JUG.vivo || (JUG.vehiculo && !JUG.fpVeh); if (!ver) continue; }
    if (!P.rag) animarPersona(P, TIEMPO.dt);
    dibujarPersona(P);
  }
}
function personasLimpiar() { for (const P of PERS.slice()) borrarPersona(P); JUG.cuerpo = null; }
