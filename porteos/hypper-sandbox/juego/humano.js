// ---------------------------------------------------------------------------------------------------------
// animaciones reales de los personajes: los clips humanoides del juego vienen en "músculos" de Unity
// (valores -1..1 por grado de libertad). Con los ejes de cada Avatar (preQ, postQ, signo y límites) se
// convierten en la rotación de cada hueso: q = preQ · ZYRoll(tan(ángulo/2)·signo) · postQ⁻¹.
// Estados como el Animator del juego: Locomotion (8 direcciones), Fall, Sit, Pose (arma), emotes.
// ---------------------------------------------------------------------------------------------------------
// hueso humano (orden de Mecanim) → músculo en x (giro), y, z
const HUM_DOF = { 7: [2, 1, 0], 8: [5, 4, 3], 9: [8, 7, 6], 10: [11, 10, 9], 11: [14, 13, 12], 1: [23, 22, 21], 2: [31, 30, 29], 3: [25, -1, 24], 4: [33, -1, 32],
  5: [27, -1, 26], 6: [35, -1, 34], 12: [-1, 38, 37], 13: [-1, 47, 46], 14: [41, 40, 39], 15: [50, 49, 48], 16: [43, -1, 42], 17: [52, -1, 51], 18: [-1, 45, 44], 19: [-1, 54, 53], 20: [-1, -1, 28], 21: [-1, -1, 36] };
const NV = 62; // 0-2 RootT, 3-6 RootQ, 7.. 55 músculos
const HUM_ARRIBA = new Uint8Array(NV); for (let k = 0; k < 15; k++) HUM_ARRIBA[7 + k] = 1; for (let k = 37; k < 55; k++) HUM_ARRIBA[7 + k] = 1;
// espejo (izquierda ↔ derecha) para correr de costado hacia la izquierda
const HUM_ESPEJO = (() => {
  const m = []; for (let k = 0; k < 55; k++) m[k] = k;
  for (let k = 21; k < 29; k++) { m[k] = k + 8; m[k + 8] = k; }
  for (let k = 37; k < 46; k++) { m[k] = k + 9; m[k + 9] = k; }
  m[15] = 17; m[17] = 15; m[16] = 18; m[18] = 16;
  return m;
})();
const HUM_NEG = new Set([1, 2, 4, 5, 7, 8, 10, 11, 13, 14, 20]);   // izquierda-derecha y giros del tronco cambian de signo
function humanoPreparar(P) {
  if (!DATA.hu) return null;
  const x0 = P.D.sub[0], av = x0.an && DATA.hu.av[x0.an.av];
  if (!av) return null;
  const porNombre = {}; P.D.sub.forEach((n, i) => { if (porNombre[n.n] === undefined) porNombre[n.n] = i; });
  const huesos = [];
  for (const h of av.h) { const i = porNombre[h[1]]; if (i !== undefined && HUM_DOF[h[0]]) huesos.push({ i, b: h[0], pre: h[2], post: h[3], sg: h[4], mn: h[5], mx: h[6] }); }
  const ci = porNombre[av.cadera]; if (ci === undefined) return null;
  return { av, huesos, ci, v: new Float32Array(NV), meta: new Float32Array(NV), tmp: new Float32Array(NV), tmp2: new Float32Array(NV), t: 0, est: '', tEst: 0, listo: false };
}
// valor de un clip en t (con espejo opcional), sumado con peso w
function humClip(c, t, w, out, espejo, soloArriba) {
  const fps = DATA.hu.fps, n = c.nf, f = Math.min(n - 1, Math.max(0, (c.loop || true) ? (t % c.d) * fps : Math.min(c.d, t) * fps));
  const i0 = Math.floor(f), i1 = Math.min(n - 1, i0 + 1), a = f - i0;
  const val = (attr) => { const k = c.c[attr]; if (!k) return attr === 13 ? 1 : attr === 8 ? 1 : 0; if (k.length === 1) return k[0]; return k[i0] * (1 - a) + k[i1] * a; };
  for (let k = 0; k < NV; k++) {
    if (soloArriba && !HUM_ARRIBA[k]) continue;
    let attr, s = 1;
    if (k < 7) { attr = 7 + k; if (espejo && (k === 0 || k === 4 || k === 5)) s = -1; }
    else { const m = k - 7, mm = espejo ? HUM_ESPEJO[m] : m; attr = 42 + mm; if (espejo && HUM_NEG.has(m)) s = -1; }
    out[k] += val(attr) * s * w;
  }
}
const _hq = new Quat(), _hq2 = new Quat(), _hq3 = new Quat();
function qArr(a, q) { return q.set(a[0], a[1], a[2], a[3]); }
// convierte los valores a rotaciones de los huesos (en Unity) y los pasa al modelo (espacio espejado: x, -y, -z, w)
function humAplicar(P) {
  const H = P.hum, v = H.v, md = P.md;
  for (const h of H.huesos) {
    const d = HUM_DOF[h.b], a = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      if (d[k] < 0) continue;
      const m = v[7 + d[k]], ang = m < 0 ? m * -h.mn[k] : m * h.mx[k];
      a[k] = Math.tan(clamp(ang * 0.5, -1.5, 1.5)) * h.sg[k];
    }
    _hq.set(a[0], a[1] + a[0] * a[2], a[2] - a[0] * a[1], 1).norm();
    qArr(h.pre, _hq2).mul(_hq); _hq3.set(-h.post[0], -h.post[1], -h.post[2], h.post[3]); _hq2.mul(_hq3).norm();
    const r = md.r[h.i]; r[0] = _hq2.x; r[1] = -_hq2.y; r[2] = -_hq2.z; r[3] = _hq2.w;
  }
  // cadera desde el "cuerpo" (centro de masa) del clip; en el lugar (sólo la altura)
  const av = H.av, bq = _hq.set(v[3], v[4], v[5], v[6]).norm();
  const by = v[1] * av.esc;
  const off = bq.rot(v3(av.dt[0], av.dt[1], av.dt[2]));
  const hq = bq.clone().mul(qArr(av.dq, _hq3)).norm();
  const p = md.p[H.ci]; p[0] = -(av.rt[0] + off.x); p[1] = by + off.y; p[2] = av.rt[2] + off.z;
  const r = md.r[H.ci]; r[0] = hq.x; r[1] = -hq.y; r[2] = -hq.z; r[3] = hq.w;
}
// agachado: piernas como sentado (cadera y rodillas dobladas) y el torso un poco adelante; la altura la corrige el piso
const PIERNAS = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];
function humAgachar(T, k) {
  const S = humClipNombre('Sit 0', 'Sitting Idle') || (DATA.hu.est['Sit 0'] && DATA.hu.est['Sit 0'][0]); if (!S) return;
  const U = humAgachar.U || (humAgachar.U = new Float32Array(NV)); U.fill(0); humClip(S, 0, 1, U);
  for (const m of PIERNAS) T[7 + m] += (U[7 + m] * 0.8 - T[7 + m]) * k;
  T[7 + 0] += 0.25 * k; T[7 + 3] += 0.15 * k;      // espalda y pecho hacia adelante
}
const POSE_ARMA = { Pistol: 'idle_armed2_m', Revolver: 'idle_armed2_m', PhysicsGun: 'idle_armed2_m', GravityGun: 'idle_armed2_m', ToolBaton: 'idle_armed2_m', Camera: 'idle_armed2_m',
  Smg: 'SniperRifleAim', Akm: 'SniperRifleAim', Sniper: 'SniperRifleAim', Shotgun: 'SniperRifleAim', Crossbow: 'SniperRifleAim', RPG: 'SniperRifleAim', Bat: '1HandSwordReady' };
// acciones del torso (la parte de arriba toma el clip; las piernas siguen caminando)
const ACC_ARMA = {
  Pistol: ['blend_shoot_1', 'blend_reload_1'], Revolver: ['blend_shoot_1', 'blend_reload_1'], Camera: ['blend_shoot_1', null], ToolBaton: ['1HandSwordBackswing', null],
  PhysicsGun: [null, null], GravityGun: ['blend_shoot_1', null], Smg: ['blend_shoot_2', 'blend_reload_2'], Akm: ['blend_shoot_2', 'blend_reload_2'],
  Shotgun: ['blend_shoot_2', 'blend_reload_2'], Sniper: ['blend_shoot_2', 'SniperRifleReload'], Crossbow: ['blend_shoot_2', 'blend_reload_2'],
  RPG: ['RPGAttack', 'blend_reload_2'], Bat: ['1HandSwordBackswing', null], Hands: ['Attack04', null],
};
function humAccion(P, tipo) {
  if (!P || !P.hum || !DATA.hu) return;
  const A = ACC_ARMA[P.arma] || [null, null];
  let c = null;
  if (tipo === 'tiro' && A[0]) c = humClipNombre('Shooting', A[0]) || humClipNombre('Blend Tree', A[0]);
  else if (tipo === 'recarga' && A[1]) c = humClipNombre('Reload', A[1]);
  else if (tipo === 'golpe') c = humClipNombre('Hit', 'standing_react_large_gut');
  if (!c) return;
  const dur = tipo === 'tiro' ? Math.min(c.d, A[0] === '1HandSwordBackswing' || A[0] === 'Attack04' ? 0.7 : 0.35) : c.d;
  P.accion = { c, t: 0, dur, peso: tipo === 'golpe' ? 0.75 : 1, tipo };
}
function humEstado(n) { return DATA.hu.est[n]; }
function humClipNombre(est, nombre) { const L = humEstado(est); return L && L.find((c) => c.n === nombre); }
function animarHumano(P, dt) {
  const H = P.hum, E = DATA.hu.est, T = H.tmp; T.fill(0);
  H.t += dt;
  // la dirección del movimiento respecto de adonde mira
  const sp = Math.hypot(P.vel.x, P.vel.z);
  if (P.emote && E[P.emote]) {
    const c = E[P.emote][0]; humClip(c, P.emoteT, 1, T);
    if ((P.emote === 'Backflip' || P.emote === 'Kick') && P.emoteT > c.d) P.emote = null;
  } else if (P.sentado) {
    humClip(E[P.manejando ? 'Sit' : 'Sit 0'][0], H.t, 1, T);
  } else if (!P.suelo) {
    // al despegar: el salto del juego; después, cayendo
    H.aire = (H.aire || 0) + dt;
    const sal = E.FallOld && E.FallOld[0];
    if (sal && H.aire < 0.45 && P.vel.y > -1) humClip(sal, 0.18 + H.aire * 0.9, 1, T);
    else { const k = sal ? clamp((H.aire - 0.45) / 0.25, 0, 1) : 1; if (k < 1) humClip(sal, 0.58, 1 - k, T); humClip(E.Fall[0], H.t, k, T); }
  } else {
    const L = E.Locomotion, idle = humClipNombre('Pose', 'IdleLookAround_loop') || humClipNombre('Pose', 'Idle01') || L[0];
    if (sp < 0.3) humClip(idle, H.t, 1, T);
    else {
      const f = v3(Math.sin(P.yaw), 0, Math.cos(P.yaw)), dx = P.vel.x / sp, dz = P.vel.z / sp;
      const fw = f.x * dx + f.z * dz, rt = -(f.z * dx - f.x * dz);  // + = derecha (cámara mira +Z con media vuelta)
      const ang = Math.atan2(rt, fw); // 0 adelante, +π/2 derecha
      const k = Math.min(1, sp / 4), esp = ang < 0, aa = Math.abs(ang);
      // 0 adelante, 45° diagonal, 90° costado, 135° diagonal atrás, 180° atrás
      const tabla = [[0, 'RunningUnarmed'], [Math.PI / 4, 'Run_FrontCorner'], [Math.PI / 2, 'RunRight'], [3 * Math.PI / 4, 'Run_BackCorner'], [Math.PI, 'Run_Back']];
      let j = 0; while (j < tabla.length - 2 && aa > tabla[j + 1][0]) j++;
      const w = clamp((aa - tabla[j][0]) / (tabla[j + 1][0] - tabla[j][0]), 0, 1);
      const cA = L.find((c) => c.n === tabla[j][1]), cB = L.find((c) => c.n === tabla[j + 1][1]);
      const vel = clamp(sp / 5.5, 0.6, 1.6);
      H.fase = (H.fase || 0) + dt * vel;
      if (k < 1) humClip(idle, H.t, 1 - k, T);
      humClip(cA, H.fase, k * (1 - w), T, esp && cA.n !== 'RunningUnarmed' && cA.n !== 'Run_Back');
      humClip(cB, H.fase, k * w, T, esp && cB.n !== 'RunningUnarmed' && cB.n !== 'Run_Back');
    }
    // con arma: el torso y los brazos toman la pose del arma
    const pa = P.arma && POSE_ARMA[P.arma] ? humClipNombre('Pose', P.poseForzada || POSE_ARMA[P.arma]) : null;
    if (pa) { const U = H.tmp2; U.fill(0); humClip(pa, H.t, 1, U, false, true); for (let k = 0; k < NV; k++) if (HUM_ARRIBA[k]) T[k] = U[k]; }
    // aterrizaje: un golpe de rodillas que se recupera solo
    if (H.aire > 0.25) H.caida = Math.min(1, H.aire / 0.9);
    H.aire = 0;
    H.caida = Math.max(0, (H.caida || 0) - dt * 3.2);
    const agach = Math.max(P.agachado ? 1 : 0, H.caida * 0.55);
    H.agach = (H.agach || 0) + (agach - (H.agach || 0)) * Math.min(1, dt * 10);
    if (H.agach > 0.01) humAgachar(T, H.agach);
  }
  // acción del torso encima de todo (con entrada y salida suaves)
  const A = P.accion;
  if (A && !P.emote && !P.sentado) {
    A.t += dt;
    if (A.t >= A.dur) P.accion = null;
    else {
      const w = A.peso * Math.min(1, A.t / 0.06) * Math.min(1, (A.dur - A.t) / 0.12), U = H.tmp2; U.fill(0);
      humClip(A.c, Math.min(A.t, A.c.d - 0.001), 1, U, false, true);
      for (let k = 0; k < NV; k++) if (HUM_ARRIBA[k]) T[k] += (U[k] - T[k]) * w;
    }
  }
  // transición suave entre estados
  if (!H.listo) { H.v.set(T); H.listo = true; }
  const a = 1 - Math.exp(-dt * 12);
  for (let k = 0; k < NV; k++) H.v[k] += (T[k] - H.v[k]) * a;
  humAplicar(P);
  // mirar arriba/abajo con la cabeza y el pecho
  if (P.mira) { P.acc = {}; girar(P, 'Spine2', 1, 0, 0, P.mira * 0.3); girar(P, 'Head', 1, 0, 0, P.mira * 0.4); aplicarGiros(P); }
}
