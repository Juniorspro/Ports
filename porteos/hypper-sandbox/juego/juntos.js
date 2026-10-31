// ---------------- emotes de a dos (con otro jugador o con un NPC) ----------------
// Capturas de dos personas grabadas juntas (CMU: el sujeto A y el B en el mismo espacio): dar la mano, chocar los cinco,
// consolar, ir de la mano, tirar del brazo, ayudar a levantarse y bailar salsa. Elegís uno en Emotes → Juntos y se lo
// pedís al que tenés más cerca adelante (hasta 3 m); el otro acepta (un cartel con Aceptar, o E) y los dos lo hacen
// ubicados como se grabó: el que lo pidió no se mueve, el otro queda donde corresponde. Con un NPC acepta solo.
// Mientras dura, el cuerpo sigue la captura entera (sin sacarle el viaje: se acercan, se alejan) y al terminar cada uno
// queda donde terminó su cuerpo. En la sala lo ven todos.
// (c: dónde se tocan: pares de huesos de A y de B; se usa el par que más se acerca, o todos juntos si 'todos')
const JUNTOS = [
  { id: 'mano', a: '18_01', b: '19_01', c: [['RightHand', 'RightHand']] },
  { id: 'cinco', a: '20_11', b: '21_11', c: [['RightHand', 'RightHand'], ['RightHand', 'LeftHand'], ['LeftHand', 'RightHand'], ['LeftHand', 'LeftHand']] },
  { id: 'consolar', a: '22_05', b: '23_05', c: [['RightHand', 'LeftShoulder'], ['LeftHand', 'RightShoulder']], todos: true, alcance: true },
  { id: 'demano', a: '22_08', b: '23_08', c: [['RightHand', 'LeftHand'], ['LeftHand', 'RightHand']], alcance: true },
  { id: 'tirar', a: '18_05', b: '19_05', alcance: true, c: [['RightHand', 'LeftForeArm'], ['RightHand', 'RightForeArm'], ['LeftHand', 'LeftForeArm'], ['LeftHand', 'RightForeArm']] },
  { id: 'levantar', a: '22_01', b: '23_01', c: [['RightHand', 'RightHand'], ['RightHand', 'LeftHand'], ['LeftHand', 'RightHand'], ['LeftHand', 'LeftHand']] },
  { id: 'salsa', a: '60_01', b: '61_01', c: [['RightHand', 'LeftHand'], ['LeftHand', 'RightHand']] },
];
// la pose de un personaje en un cuadro de la captura, en el espacio de la escena (origen 0, sin girar): los huesos pedidos
function juntosPose(P, C, f, huesos) {
  const md = P.md, nb = md.r.length, hi = P.D.h.Hips, guarda = { r: md.r.map((q) => q.slice()), p: md.p.map((q) => q.slice()), raiz: md.raiz.slice(), esc: P.escena };
  for (let i = 0; i < nb; i++) { const b0 = P.base[i]; md.r[i][0] = b0[0]; md.r[i][1] = b0[1]; md.r[i][2] = b0[2]; md.r[i][3] = b0[3]; }
  if (hi !== undefined) { const s0 = P.D.sub[hi].p; md.p[hi][0] = s0[0]; md.p[hi][1] = s0[1]; md.p[hi][2] = s0[2]; }
  P.escena = { id: C.id }; emoAplicar(P, C, f, 1); P.escena = guarda.esc;
  md.ponerRaiz(M4.id()); md.actualizar();
  const out = {}; for (const n of huesos) { const i = P.D.h[n]; if (i !== undefined) out[n] = v3(md.W[i][12], md.W[i][13], md.W[i][14]); }
  for (let i = 0; i < nb; i++) md.r[i] = guarda.r[i]; for (let i = 0; i < md.p.length; i++) md.p[i] = guarda.p[i]; md.ponerRaiz(guarda.raiz); md.sucio = true;
  return out;
}
// cuánto correr a B (en la escena) para que en el momento de contacto se toquen de verdad (los esqueletos del juego no
// son los de las personas grabadas: brazos y altura distintos). En los pares donde la captura dejó las caderas encimadas
// (alcance: consolar, de la mano, tirar), el contacto es cuando A estira más las manos
function juntosAjuste(J, PA, PB) {
  const A = emoClip('c:' + J.a), B = emoClip('c:' + J.b), hs = [...new Set(J.c.flat().concat(['Hips']))]; let mejor = null;
  const n = Math.min(A.nf, B.nf), paso = Math.max(1, Math.round(n / 60));
  let fA = -1; if (J.alcance) { let m = -1; for (let f = 0; f < n; f += paso) { const pa = juntosPose(PA, A, f, hs); let s = 0; for (const c of J.c) if (pa[c[0]]) s += Math.hypot(pa[c[0]].x - pa.Hips.x, pa[c[0]].z - pa.Hips.z); if (s > m) { m = s; fA = f; } } }
  for (let f = 0; f < n; f += paso) {
    if (fA >= 0 && f !== fA) continue;
    const pa = juntosPose(PA, A, f, hs), pb = juntosPose(PB, B, f, hs); let d = 0, dx = 0, dz = 0, k = 0;
    const pares = J.todos ? J.c : [J.c.reduce((m, c) => (pa[c[0]] && pb[c[1]] && (!m || pa[c[0]].distTo(pb[c[1]]) < pa[m[0]].distTo(pb[m[1]])) ? c : m), null)].filter(Boolean);
    for (const [x, y] of pares) { if (!pa[x] || !pb[y]) continue; d += pa[x].distTo(pb[y]); dx += pa[x].x - pb[y].x; dz += pa[x].z - pb[y].z; k++; }
    if (k && (!mejor || d / k < mejor.d)) mejor = { d: d / k, dx: dx / k, dz: dz / k, f };
  }
  return mejor ? [mejor.dx, mejor.dz] : [0, 0];
}
const JNT = { pedido: null, mio: null, cartel: null };
const juntosDe = (id) => JUNTOS.find((j) => j.id === id);
// el de adelante más cerca (jugador o NPC), hasta 3 m
function juntosObjetivo() {
  const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); let mejor = null, dm = 3;
  const ver = (P, id) => { if (!P || P.rag || P.vivo === false || P.escena) return; const d = v3(P.pos.x - JUG.pos.x, 0, P.pos.z - JUG.pos.z), L = d.len(); if (L < dm && (L < 1 || vdot(d, f) / L > 0.3)) { dm = L; mejor = { P, id }; } };
  for (const R2 of RED.remotos.values()) ver(R2.P, R2.id);
  if (typeof NPC !== 'undefined') for (const P of NPC.lista) ver(P, 'npc:' + P.npcId);
  return mejor;
}
async function juntosPedir(id) {
  const J = juntosDe(id); if (!J || !JUG.cuerpo || JUG.vehiculo) return;
  const o = juntosObjetivo(); if (!o) { aviso(T('jnt.nadie'), 2); return; }
  await Promise.all([emoCargar('c:' + J.a), emoCargar('c:' + J.b)]);
  if (o.id.startsWith('npc:')) { juntosEmpezar(J, null, o.P); return; }   // (un NPC acepta solo)
  JNT.mio = { e: id, a: o.id, t: TIEMPO.t };
  publicar('a', { k: 'jntP', to: o.id, e: id }); aviso(T('jnt.esperando'), 3);
}
// el que lo pidió: arma la escena (el que pide no se mueve; el otro va a su lugar de la captura) y la manda a todos
function juntosEmpezar(J, idB, PB) {
  const A0 = emoClip('c:' + J.a), B0 = emoClip('c:' + J.b); if (!A0 || !B0) return;
  const b0 = JUG.cuerpo.D.sub[JUG.cuerpo.D.h.Hips].p, aj = juntosAjuste(J, JUG.cuerpo, PB);
  const ha = [A0.h[0] / 1000 + b0[0], A0.h[2] / 1000 + b0[2]], hb = [B0.h[0] / 1000 + b0[0] + aj[0], B0.h[2] / 1000 + b0[2] + aj[1]];
  const dc = Math.atan2(hb[0] - ha[0], hb[1] - ha[1]), dw = Math.atan2(PB.pos.x - JUG.pos.x, PB.pos.z - JUG.pos.z), th = dw - dc;
  // (en la captura la cadera está a b0 + h del origen del modelo: el origen O tal que la cadera de A caiga sobre mí)
  const ca = Math.cos(th), sa = Math.sin(th), rot = (x, z) => [x * ca + z * sa, -x * sa + z * ca], ra = rot(ha[0], ha[1]);
  const O = v3(JUG.pos.x - ra[0], (JUG.pos.y + PB.pos.y) / 2, JUG.pos.z - ra[1]);
  const rb = rot(aj[0], aj[1]), esc = { e: J.id, O: [r3(O.x), r3(O.y), r3(O.z)], ob: [r3(O.x + rb[0]), r3(O.y), r3(O.z + rb[1])], th: Math.round(th * 1000) / 1000 };
  juntosAplicar(esc, JUG.cuerpo, 'a'); juntosAplicar(esc, PB, 'b');
  if (idB && RED.on) publicar('a', Object.assign({ k: 'jnt', a: RED.ID, b: idB }, esc));
}
function juntosAplicar(esc, P, rol) {
  const J = juntosDe(esc.e); if (!J || !P) return;
  const id = 'c:' + (rol === 'a' ? J.a : J.b), o = rol === 'b' && Array.isArray(esc.ob) ? esc.ob : esc.O;   // (B, corrido para que se toquen)
  P.escena = { O: v3(num(o[0], -1e4, 1e4, 0), num(o[1], -1e4, 1e4, 0), num(o[2], -1e4, 1e4, 0)), yaw: num(esc.th, -20, 20, 0), id };
  P.emote = id; P.emoteT = 0; if (P === JUG.cuerpo) { JUG.vel.set(0, 0, 0); if (typeof emoUsado === 'function') emoUsado(id); }
  sonEmote && sonEmote(P, id);
}
// cada cuadro: los que están en una escena quedan en su origen; al terminar, cada uno queda donde terminó su cuerpo
function juntosPaso() {
  if (JNT.pedido && TIEMPO.t - JNT.pedido.t > 10) juntosCartel(null);
  if (JNT.mio && TIEMPO.t - JNT.mio.t > 12) JNT.mio = null;
  for (const P of PERS) {
    const E = P.escena; if (!E) continue;
    if (P.emote !== E.id) {   // (terminó o se cortó): la cápsula al lugar de la cadera
      const hi = P.D.h.Hips, W = hi !== undefined && P.md.W[hi];
      if (W) { const x = W[12], z = W[14]; if (P === JUG.cuerpo) { JUG.pos.x = x; JUG.pos.z = z; JUG.vel.set(0, 0, 0); } else if (P.npc) { P.pos.x = x; P.pos.z = z; } }
      P.escena = null; P.jntFin = TIEMPO.t + 1.5; continue;   // (un segundo y medio sin empujarse: terminan cerca)
    }
    P.pos.set(E.O.x, E.O.y, E.O.z); P.yaw = E.yaw; P.vel.set(0, 0, 0); P.suelo = true;
    if (P === JUG.cuerpo) { JUG.vel.set(0, 0, 0); const hi = P.D.h.Hips, W = hi !== undefined && P.md.W[hi]; if (W) { JUG.pos.x = W[12]; JUG.pos.z = W[14]; } }   // (la cámara va con el cuerpo)
  }
}
// el cartel del que recibe el pedido: "Ana quiere chocar los cinco" [Aceptar] [No] (o E)
function juntosCartel(p) {
  JNT.pedido = p; let c = JNT.cartel;
  if (!p) { if (c) c.classList.add('oc'); return; }
  if (!c) {
    c = JNT.cartel = document.createElement('div'); c.id = 'jntCartel'; c.className = 'oc'; document.body.appendChild(c);
    c.addEventListener('click', (e) => { const b = e.target.closest('[data-jnt]'); if (!b) return; if (b.dataset.jnt === 'si') juntosAceptar(); else juntosCartel(null); });
  }
  const R2 = RED.remotos.get(p.de), quien = R2 ? R2.nombre : '?';
  c.innerHTML = `<span><b dir="auto">${esc(quien)}</b> ${esc(T('jnt.quiere'))}: <b>${esc(T('jnt.' + p.e))}</b></span><button data-jnt="si">${esc(T('jnt.aceptar'))} (E)</button><button data-jnt="no">${esc(T('jnt.no'))}</button>`;
  c.classList.remove('oc'); sonar('UI_blip', null, 0.5, 1.2);
}
async function juntosAceptar() {
  const p = JNT.pedido; if (!p) return false; juntosCartel(null);
  const J = juntosDe(p.e); if (!J) return true;
  await Promise.all([emoCargar('c:' + J.a), emoCargar('c:' + J.b)]);
  publicar('a', { k: 'jntS', to: p.de, e: p.e }); return true;
}
function juntosRed(d) {
  if (d.k === 'jntP' && d.to === RED.ID && juntosDe(d.e)) { juntosCartel({ de: d.i, e: d.e, t: TIEMPO.t }); return; }
  if (d.k === 'jntS' && d.to === RED.ID && JNT.mio && JNT.mio.a === d.i && JNT.mio.e === d.e) { const R2 = RED.remotos.get(d.i); JNT.mio = null; if (R2) juntosEmpezar(juntosDe(d.e), d.i, R2.P); return; }
  if (d.k === 'jnt' && juntosDe(d.e) && Array.isArray(d.O)) {
    const J = juntosDe(d.e); Promise.all([emoCargar('c:' + J.a), emoCargar('c:' + J.b)]).then(() => {
      for (const [rol, id] of [['a', d.a], ['b', d.b]]) { const P = id === RED.ID ? JUG.cuerpo : RED.remotos.get(id) && RED.remotos.get(id).P; if (P) juntosAplicar(d, P, rol); }
    });
  }
}
