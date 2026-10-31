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
  // el giro del cuerpo (cuaternión) se suma del mismo lado que lo que ya hay: q y -q son el mismo giro, pero mezclados se anulan
  const sq = (out[3] * val(10) + out[4] * val(11) * (espejo ? -1 : 1) + out[5] * val(12) * (espejo ? -1 : 1) + out[6] * val(13)) < 0 ? -1 : 1;
  for (let k = 0; k < NV; k++) {
    if (soloArriba && !HUM_ARRIBA[k]) continue;
    let attr, s = 1;
    if (k < 7) { attr = 7 + k; if (espejo && (k === 0 || k === 4 || k === 5)) s = -1; if (k >= 3) s *= sq; }
    else { const m = k - 7, mm = espejo ? HUM_ESPEJO[m] : m; attr = 42 + mm; if (espejo && HUM_NEG.has(m)) s = -1; }
    out[k] += val(attr) * s * w;
  }
}
const _hq = new Quat(), _hq2 = new Quat(), _hq3 = new Quat(), _hArriba = v3(0, 1, 0);
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
// agachado: piernas como sentado (cadera y rodillas dobladas) y el torso un poco adelante; la altura la corrige el piso.
// Caminando agachado (mov > 0) se suma la diferencia entre sentado y parado a las piernas que corren: siguen dando
// pasos, dobladas (antes quedaban quietas y el cuerpo se deslizaba)
const PIERNAS = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];
function humAgachar(T, k, mov) {
  const S = humClipNombre('Sit 0', 'Sitting Idle') || (DATA.hu.est['Sit 0'] && DATA.hu.est['Sit 0'][0]); if (!S) return;
  const U = humAgachar.U || (humAgachar.U = new Float32Array(NV)); U.fill(0); humClip(S, 0, 1, U);
  let I = humAgachar.I;
  if (!I) { I = humAgachar.I = new Float32Array(NV); const c = humClipNombre('Pose', 'IdleLookAround_loop') || DATA.hu.est.Locomotion[0]; humClip(c, 0, 1, I); }
  const m0 = mov || 0;
  for (const m of PIERNAS) T[7 + m] += (U[7 + m] * 0.8 - (T[7 + m] * (1 - m0) + I[7 + m] * m0)) * k;
  T[7 + 0] += 0.25 * k; T[7 + 3] += 0.15 * k;      // espalda y pecho hacia adelante
}
// locomoción medida en cada personaje: para cada clip de correr (y su espejo) hacia dónde va y a qué velocidad a ritmo
// normal, sacado de la punta del pie apoyado (la del pie más bajo cuando toca el piso), y en qué momento del ciclo
// apoya el pie izquierdo. Con eso se eligen los dos clips más cercanos a la dirección real (antes la diagonal de atrás
// a la derecha usaba el clip de atrás a la izquierda) y el ritmo sigue a la velocidad (el pie que pisa no patina)
const LOCO_AMP = [0.35, 0.5, 0.65, 0.8, 1];
function humLoco(P) {
  const H = P.hum, D = P.D; if (H.loco) return H.loco; if (D.loco) return (H.loco = D.loco);
  const md = P.md, sub = D.sub, h = D.h;
  let lt = sub.findIndex((n) => /LeftToeBase$/.test(n.n)), rt = sub.findIndex((n) => /RightToeBase$/.test(n.n));
  if (lt < 0 || rt < 0) { lt = h.LeftFoot; rt = h.RightFoot; }
  const raiz = md.raiz.slice(), vG = H.v.slice(); md.raiz.set(IDM);
  const idle = humClipNombre('Pose', 'IdleLookAround_loop') || humClipNombre('Pose', 'Idle01');
  // con pasos más cortos (mezclado con estar parado, como a poca velocidad) el pie no avanza en proporción: se mide igual
  const medir = (c, esp, amp) => {
    const n = Math.max(24, Math.round(c.d * (amp < 1 ? 72 : 120))), F = [];
    for (let i = 0; i <= n; i++) {
      H.v.fill(0); if (amp < 1 && idle) humClip(idle, 0, 1 - amp, H.v); humClip(c, c.d * (i % n) / n, amp, H.v, esp); humAplicar(P); md.sucio = true; md.actualizar();
      const A = md.W[lt], B = md.W[rt]; F.push([A[12], A[13], A[14], B[12], B[13], B[14]]);
    }
    let ymin = 1e9, f0 = 0, yl = 1e9; for (let i = 0; i < n; i++) { ymin = Math.min(ymin, F[i][1], F[i][4]); if (F[i][1] < yl) { yl = F[i][1]; f0 = i / n; } }
    let sx = 0, sz = 0, k = 0;
    for (let i = 1; i <= n; i++) {
      const A = F[i], B = F[i - 1], o = A[1] <= A[4] ? 0 : 3; if (o !== (B[1] <= B[4] ? 0 : 3) || A[o + 1] > ymin + 0.04) continue;
      sx += A[o] - B[o]; sz += A[o + 2] - B[o + 2]; k++;
    }
    if (!k) return null;
    const t = k / n * c.d; return { vx: -sx / t, vz: -sz / t, f0 };
  };
  const L = [], vistos = new Set();
  for (const c of DATA.hu.est.Locomotion) {
    if (vistos.has(c.n) || /idle/i.test(c.n)) continue; vistos.add(c.n);
    for (const esp of [false, true]) {
      const m = medir(c, esp, 1); if (!m) continue;
      const v = clamp(Math.hypot(m.vx, m.vz), 1, 9), vs = LOCO_AMP.map((a) => { if (a === 1) return v; const q = medir(c, esp, a); return q ? clamp(Math.hypot(q.vx, q.vz), 0.2, 9) : v * a; });
      // ángulo como lo usa el juego: 0 adelante, + a la derecha (la derecha del modelo es -x)
      L.push({ c, esp, ang: Math.atan2(-m.vx, m.vz), v, vs, f0: m.f0 });
    }
  }
  L.sort((a, b) => a.ang - b.ang);
  md.raiz.set(raiz); H.v.set(vG); md.sucio = true;
  return (H.loco = D.loco = L);
}
// velocidad del pie apoyado de un clip con pasos de tamaño amp (interpolada entre las medidas)
function locoV(l, amp) {
  const A = LOCO_AMP; if (amp <= A[0]) return l.vs[0] * amp / A[0];
  for (let i = 1; i < A.length; i++) if (amp <= A[i]) { const t = (amp - A[i - 1]) / (A[i] - A[i - 1]); return l.vs[i - 1] + (l.vs[i] - l.vs[i - 1]) * t; }
  return l.v;
}
const POSE_ARMA = { Pistol: 'idle_armed2_m', Revolver: 'idle_armed2_m', PhysicsGun: 'gm_idle_gravgun', GravityGun: 'gm_idle_gravgun', ToolBaton: 'gm_idle_pistol', Camera: 'idle_armed2_m',
  Smg: 'SniperRifleAim', Akm: 'SniperRifleAim', Sniper: 'SniperRifleAim', Shotgun: 'SniperRifleAim', Crossbow: 'SniperRifleAim', RPG: 'SniperRifleAim', Bat: '1HandSwordReady',
  Crowbar: 'gm_idle_melee' };   // (las gm_*: las posturas de los jugadores de GMod, de herramientas/gmod.py)
// acciones del torso (la parte de arriba toma el clip; las piernas siguen caminando)
const ACC_ARMA = {
  Pistol: ['blend_shoot_1', 'blend_reload_1'], Revolver: ['blend_shoot_1', 'blend_reload_1'], Camera: ['blend_shoot_1', null], ToolBaton: ['gm_range_pistol', null],
  PhysicsGun: [null, null], GravityGun: ['gm_range_gravgun', null], Smg: ['blend_shoot_2', 'blend_reload_2'], Akm: ['blend_shoot_2', 'blend_reload_2'],
  Shotgun: ['blend_shoot_2', 'blend_reload_2'], Sniper: ['blend_shoot_2', 'SniperRifleReload'], Crossbow: ['blend_shoot_2', 'blend_reload_2'],
  RPG: ['RPGAttack', 'blend_reload_2'], Bat: ['1HandSwordBackswing', null], Hands: ['Attack04', null], Crowbar: ['gm_range_melee', null],
};
function humAccion(P, tipo) {
  if (!P || !P.hum || !DATA.hu) return;
  const A = ACC_ARMA[P.arma] || [null, null];
  let c = null;
  if (tipo === 'tiro' && A[0]) c = humClipNombre('Shooting', A[0]) || humClipNombre('Blend Tree', A[0]);
  else if (tipo === 'recarga' && A[1]) c = humClipNombre('Reload', A[1]);
  else if (tipo === 'golpe') c = humClipNombre('Hit', 'standing_react_large_gut');
  if (!c) return;
  const dur = tipo === 'tiro' && !/^gm_/.test(A[0]) ? Math.min(c.d, A[0] === '1HandSwordBackswing' || A[0] === 'Attack04' ? 0.7 : 0.35) : c.d;   // (los gestos de GMod, enteros)
  // si corta otra acción a la mitad, se parte de la pose que se ve (sin saltar a la pose base)
  if (P.accion && P.hum) P.hum.clave = '';
  P.accion = { c, t: 0, dur, peso: tipo === 'golpe' ? 0.75 : 1, tipo };
}
function humEstado(n) { return DATA.hu.est[n]; }
function humClipNombre(est, nombre) { const L = humEstado(est); return L && L.find((c) => c.n === nombre); }
function animarHumano(P, dt) {
  const H = P.hum, E = DATA.hu.est, T = H.tmp; T.fill(0);
  H.t += dt; H.gm = false;
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
    if (sp < 0.3) { humClip(idle, H.t, 1, T); H.mov = 0; H.cadera = (H.cadera || 0) * Math.max(0, 1 - dt * 6); }
    else {
      const f = v3(Math.sin(P.yaw), 0, Math.cos(P.yaw)), dx = P.vel.x / sp, dz = P.vel.z / sp;
      const fw = f.x * dx + f.z * dz, rt = -(f.z * dx - f.x * dz);  // + = derecha (cámara mira +Z con media vuelta)
      const ang = Math.atan2(rt, fw); // 0 adelante, +π/2 derecha
      // la cadera y las piernas giran hacia donde va (hasta 50°; el torso sigue mirando adonde apunta): así se usan
      // sobre todo los clips de adelante y de atrás, que pisan bien (los de costado del juego no van derecho al costado)
      if (H.atras === undefined) H.atras = false;
      if (Math.abs(ang) > 1.92) H.atras = true; else if (Math.abs(ang) < 1.75) H.atras = false;
      const metaC = clamp((H.atras ? ang - Math.sign(ang) * Math.PI : ang) * 0.6, -0.87, 0.87);
      H.cadera = (H.cadera || 0) + (metaC - (H.cadera || 0)) * Math.min(1, dt * 8);
      let angL = ang - H.cadera; if (angL > Math.PI) angL -= TAU; if (angL < -Math.PI) angL += TAU;
      // a poca velocidad, pasos más cortos (mezclado con estar parado) en vez de correr en cámara lenta
      const amp = clamp(sp / 3.2, 0.35, 1), LO = humLoco(P);
      // los dos clips medidos que rodean la dirección (dando la vuelta por atrás)
      let j = LO.length - 1; for (let i = 0; i < LO.length; i++) if (LO[i].ang <= angL) j = i;
      const A = LO[j], B = LO[(j + 1) % LO.length]; H.par = j;
      let da = B.ang - A.ang; if (da <= 0) da += TAU;
      let w = angL - A.ang; if (w < 0) w += TAU; w = clamp(w / da, 0, 1);
      // fase del ciclo (0..1): avanza para que el pie apoyado vaya a la misma velocidad que el cuerpo
      // (el pie de la mezcla avanza como la mezcla de los dos pies, cada clip a su ritmo)
      H.fase = ((H.fase || 0) + dt * sp / ((1 - w) * locoV(A, amp) * A.c.d + w * locoV(B, amp) * B.c.d)) % 1;
      if (amp < 1) humClip(idle, H.t, 1 - amp, T);
      humClip(A.c, ((H.fase + A.f0) % 1) * A.c.d, amp * (1 - w), T, A.esp);
      humClip(B.c, ((H.fase + B.f0) % 1) * B.c.d, amp * w, T, B.esp);
      H.mov = amp;
    }
    // con arma: el torso y los brazos toman la pose del arma
    const pa = P.arma && POSE_ARMA[P.arma] ? humClipNombre('Pose', P.poseForzada || POSE_ARMA[P.arma]) : null;
    if (pa) { const U = H.tmp2; U.fill(0); humClip(pa, H.t, 1, U, false, true); for (let k = 0; k < NV; k++) if (HUM_ARRIBA[k]) T[k] = U[k]; H.gm = !H.mov && /^gm_/.test(pa.n); }
    // aterrizaje: un golpe de rodillas que se recupera solo
    if (H.aire > 0.25) H.caida = Math.min(1, H.aire / 0.9);
    H.aire = 0;
    H.caida = Math.max(0, (H.caida || 0) - dt * 3.2);
    const agach = Math.max(P.agachado ? 1 : 0, H.caida * 0.55);
    H.agach = (H.agach || 0) + (agach - (H.agach || 0)) * Math.min(1, dt * 10);
    if (H.agach > 0.01) humAgachar(T, H.agach, H.mov || 0);
  }
  // acción del torso encima de todo (con entrada y salida suaves)
  const A = P.accion;
  if (A && !P.emote && !P.sentado) {
    A.t += dt;
    if (A.t >= A.dur) P.accion = null;
    else {
      // entrada suave (sin tirón al empezar): rápida para el disparo, más lenta para recargar o recibir un golpe
      const e = Math.min(1, A.t / (A.tipo === 'tiro' ? 0.06 : 0.14)), w = A.peso * (A.tipo === 'tiro' ? e : e * e * (3 - 2 * e)) * Math.min(1, (A.dur - A.t) / 0.12), U = H.tmp2; U.fill(0);
      humClip(A.c, Math.min(A.t, A.c.d - 0.001), 1, U, false, true);
      for (let k = 0; k < NV; k++) if (HUM_ARRIBA[k]) T[k] += (U[k] - T[k]) * w;
    }
  }
  // transición suave sólo cuando cambia el estado (quieto/corriendo/en el aire/sentado/emote/arma): la diferencia con
  // la pose anterior se guarda y se apaga en ~0,2 s. Antes se filtraba todo el tiempo y eso achicaba el paso de las
  // piernas a menos de la mitad (los pies patinaban)
  const sp0 = Math.hypot(P.vel.x, P.vel.z);
  const clave = (P.emote || '') + '|' + (P.sentado ? (P.manejando ? 'm' : 's') : '') + '|' + (!P.suelo ? 'a' : sp0 < 0.3 ? 'q' : 'c' + H.par) + '|' + (P.arma || '');
  // parado con un arma de GMod, el torso apunta al frente aunque la cadera se mueva con la animación de quieto (la de mirar
  // alrededor la gira hasta 35° y el arma giraba con ella), como el aim_yaw de GMod: las posturas se hornearon con la
  // cadera derecha. El giro que la compensa es parte de la pose: en los cambios de estado se mezcla igual que ella (al
  // arrancar a caminar se apaga a la par de la cadera, al cambiar de arma parado entra suave)
  const gyT = H.gm ? Math.atan2(2 * (T[6] * T[4] + T[3] * T[5]), 1 - 2 * (T[4] * T[4] + T[3] * T[3])) : 0;
  if (!H.listo) { H.v.set(T); H.o = new Float32Array(NV); H.clave = clave; H.listo = true; H.gyO = 0; }
  if (clave !== H.clave) {
    if (H.v[3] * T[3] + H.v[4] * T[4] + H.v[5] * T[5] + H.v[6] * T[6] < 0) for (let k = 3; k < 7; k++) H.v[k] = -H.v[k];
    for (let k = 0; k < NV; k++) H.o[k] = H.v[k] - T[k]; H.clave = clave; H.oT = 0; H.gyO = (H.gy || 0) - gyT;
  } else H.oT = (H.oT || 0) + dt;
  // se apaga como un resorte amortiguado (arranca sin velocidad: antes el primer cuadro daba el tirón más grande)
  const ko = 16 * H.oT, fo = ko > 12 ? 0 : (1 + ko) * Math.exp(-ko);
  for (let k = 0; k < NV; k++) H.v[k] = T[k] + H.o[k] * fo;
  H.gy = gyT + (H.gyO || 0) * fo;
  humAplicar(P);
  // cadera girada hacia donde camina (el torso vuelve) y mirar arriba/abajo con la cabeza y el pecho
  // (la cadera vuelve de a poco al salir de un emote, del asiento o del aire; antes saltaba de golpe)
  H.cadW = (H.cadW ?? 1) + ((P.emote || P.sentado || !P.suelo ? 0 : 1) - (H.cadW ?? 1)) * Math.min(1, dt * 10);
  const cad = (H.cadera || 0) * H.cadW;
  const gy = Math.abs(H.gy) > 1e-3 ? H.gy : 0;
  if (P.mira || Math.abs(cad) > 0.01 || gy) {
    P.acc = {};
    if (Math.abs(cad) > 0.01) { girar(P, 'Hips', 0, 1, 0, -cad); girar(P, 'Spine', 0, 1, 0, cad * 0.45); girar(P, 'Spine1', 0, 1, 0, cad * 0.3); girar(P, 'Spine2', 0, 1, 0, cad * 0.25); }
    if (P.mira) { girar(P, 'Spine2', 1, 0, 0, P.mira * 0.3); girar(P, 'Head', 1, 0, 0, P.mira * 0.4); }
    aplicarGiros(P);
    // (sobre la vertical del mundo: sobre el eje de reposo de cada vértebra, que se inclina con el cuerpo, la cara cabeceaba;
    // con el modelo marcado para recalcular, que girarMundo parte de las matrices del mundo: con las del cuadro anterior,
    // que ya traían el giro, se sumaba cuadro a cuadro y el torso daba vueltas)
    if (gy) { P.md.sucio = true; girarMundo(P, 'Spine', _hArriba, gy * 0.45); girarMundo(P, 'Spine1', _hArriba, gy * 0.3); girarMundo(P, 'Spine2', _hArriba, gy * 0.25); }
  }
}
