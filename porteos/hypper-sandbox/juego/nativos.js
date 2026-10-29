// ---------------- mods oficiales nativos: volar, muñeco de trapo que otros agarran y SCP en cuatro patas ----------------
// Cada uno suma una fila al menú MOD de arriba (y una tecla). Volar: empuje hacia donde mirás con inercia; el cuerpo se inclina con
// resortes (adelante al acelerar, de costado al doblar) y las piernas se balancean. Muñeco: te dejás caer y cualquiera
// de la sala te puede agarrar con la pistola de física o la de gravedad (tira de tu cuerpo en tu juego). SCP: caminás
// en cuatro patas pegado a cualquier superficie (piso, paredes, techo), corrés rápido y cada pata pisa sola
// (paso procedural: el pie queda clavado hasta que se aleja de su lugar y da el paso en diagonal con su par).
const NAT = { mods: new Set(), volando: false, rag: false, scp: false, terc: null, pies: null,
  up: v3(0, 1, 0), fw: v3(0, 0, 1), pegado: false, suelta: 0, jalo: null, jalado: null, tJalo: 0 };
const NAT_BOTON = { volar: 'KeyG', ragdoll: 'KeyX', scp: 'KeyJ', piano: 'KeyK', radio: 'KeyL' };
const wp = (W) => v3(W[12], W[13], W[14]);
function qBase(x, y, z) { const m = new Float32Array(16); m[0] = x.x; m[1] = x.y; m[2] = x.z; m[4] = y.x; m[5] = y.y; m[6] = y.z; m[8] = z.x; m[9] = z.y; m[10] = z.z; m[15] = 1; return m4quat(m); }

// se llama al empezar la partida con los mods nativos activos
// (en una sala se vuelve a llamar al prender o apagar mods con SM: lo que sigue activo no se corta)
function natIniciar(lista) {
  const nuevo = new Set(lista), antes = NAT.mods;
  if (NAT.volando && !nuevo.has('volar')) natVolar(false); if (NAT.rag && !nuevo.has('ragdoll')) natRag(false); if (NAT.scp && !nuevo.has('scp')) natScp(false);
  const scp = nuevo.has('scp') && !antes.has('scp');
  NAT.mods = nuevo; modMenuBoton();
  if (scp) setTimeout(() => natScp(true), 50);
}
function natFin() {
  if (NAT.rag) natRag(false); if (NAT.volando) natVolar(false); if (NAT.scp) natScp(false);
  NAT.mods.clear(); NAT.jalo = NAT.jalado = null; modMenuBoton();
}
function natMarcar() { if (typeof modMenuLista === 'function') modMenuLista(); }
function natAccion(k) {
  if (JUEGO.estado !== 'juego') return;
  if (k === 'volar') natVolar(!NAT.volando);
  else if (k === 'ragdoll') natRag(!NAT.rag);
  else if (k === 'scp') natScp(!NAT.scp);
  else if (k === 'piano' || k === 'radio') entidadPonerMod(k);
}
addEventListener('keydown', (e) => {
  if (e.repeat || JUEGO.estado !== 'juego' || (UI.abierto && UI.abierto !== 'modm') || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
  for (const k of NAT.mods) if (NAT_BOTON[k] === e.code) natAccion(k);
});
// tercera persona mientras dura (y vuelve como estaba)
function natTercera(si) {
  if (si) { if (NAT.terc === null) NAT.terc = JUG.tercera; JUG.tercera = true; }
  else if (!NAT.volando && !NAT.rag && !NAT.scp && NAT.terc !== null) { JUG.tercera = NAT.terc; NAT.terc = null; }
}
function natVolar(si) {
  if (si && (!JUG.vivo || JUG.vehiculo)) return;
  if (si && NAT.rag) natRag(false); if (si && NAT.scp) natScp(false);
  NAT.volando = si; if (si) { JUG.noclip = false; JUG.vel.y = Math.max(JUG.vel.y, 3); aviso(T('volarSi'), 1.5); }
  natTercera(si); natMarcar(); redSubir();
}
function natScp(si) {
  if (si && NAT.rag) natRag(false); if (si && NAT.volando) natVolar(false);
  NAT.scp = si; NAT.up.set(0, 1, 0); NAT.pegado = false; NAT.suelta = 0;
  if (si) { NAT.fw.set(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); JUG.noclip = false; }
  else if (JUG.cuerpo) { JUG.cuerpo.cuad = null; JUG.cuerpo.marcha = null; JUG.cuerpo.md.color = null; JUG.pos.y += 0.5; }
  natTercera(si); natMarcar(); redSubir();
}
// ---------------- muñeco de trapo a voluntad ----------------
function natRag(si) {
  const P = JUG.cuerpo;
  if (si) {
    if (NAT.rag || !JUG.vivo || JUG.vehiculo || !P) return;
    if (NAT.volando) natVolar(false); if (NAT.scp) natScp(false);
    NAT.rag = true; soltarAgarre(); soltarGrav(); P.pos.copy(JUG.pos); P.vel.copy(JUG.vel); P.inclin = null; P.cuad = null; P.marcha = null;
    ragdoll(P, vscale(JUG.vel, 0.3)); natTercera(true);
  } else {
    if (!NAT.rag) return; NAT.rag = false; NAT.jalado = null;
    if (P && P.rag && JUG.vivo) {
      const hb = P.rag.cuerpos.get(P.D.h.Hips), h = hb ? hb.b.pos.clone() : JUG.pos.clone();
      ragdollFin(P); const y = pisoBajo(h, 1.2);
      JUG.pos.set(h.x, y !== null && h.y - y < 2.5 ? y + 1.02 : h.y + 0.6, h.z); JUG.vel.set(0, 0, 0);
    }
    natTercera(false);
  }
  natMarcar(); redSubir();
}
// ---------------- movimiento (lo llama jugadorPaso; devuelve true si ya movió al jugador) ----------------
function natMover(dt, ent) {
  if (NAT.rag) {
    const P = JUG.cuerpo, hb = P && P.rag && P.rag.cuerpos.get(P.D.h.Hips);
    if (!hb) { natRag(false); return false; }
    JUG.pos.copy(hb.b.pos); JUG.pos.y += 0.15; JUG.vel.copy(hb.b.vel); JUG.suelo = false;
    // te tiran de un lado del cuerpo desde otro juego: resorte hacia donde te llevan
    const J2 = NAT.jalado;
    if (J2 && TIEMPO.t - J2.t < 0.45) { const b = J2.b, d = vsub(J2.p, b.pos), v = vscale(d, 12); if (v.len() > 45) v.scale(45 / v.len()); b.vel.lerpTo(v, 0.6); b.wake(); }
    return true;
  }
  if (NAT.volando) { natVolarPaso(dt, ent); return true; }
  if (NAT.scp) { natScpPaso(dt, ent); return true; }
  return false;
}
function natVolarPaso(dt, ent) {
  const J = JUG, fv = J.q.rot(v3(0, 0, 1)), rgt = Quat.axis(0, 1, 0, J.yaw).rot(v3(-1, 0, 0));
  const wish = v3(fv.x * ent.y + rgt.x * ent.x, fv.y * ent.y + (ent.saltar ? 1 : 0) - (ent.agachar ? 1 : 0), fv.z * ent.y + rgt.z * ent.x);
  const wl = Math.min(1, wish.len()); if (wl > 1e-3) wish.scale(1 / wish.len());
  const vmax = (ent.correr ? 46 : 20) * Math.sqrt(MODS.velocidad || 1), ac = ent.correr ? 38 : 24;
  const dv = vsub(vscale(wish, vmax * wl), J.vel), dl = dv.len(), mx = (wl > 0.01 ? ac : 10) * dt;
  if (dl > 0) J.vel.addS(dv, Math.min(1, mx / dl));
  J.vel.y -= GRAV * MUNDO.gravedad * dt * 0.04;
  jugadorMoverChocar(dt);
  J.bobK = 0; J.agK = 0;
  if (J.pos.y < MUNDO.lo.y - 60) jugadorAparecer();
}
// SCP: una esfera que se pega a la superficie que pisa; "arriba" es la normal de esa superficie
const SCP_ALTO = 0.55, SCP_R = 0.42;
function natScpPaso(dt, ent) {
  const J = JUG, up = NAT.up;
  // adelante: en pisos y techos según adonde mira (sin inclinar); en paredes, con la inclinación de la cámara
  let fw;
  if (Math.abs(up.y) > 0.7) fw = v3(Math.sin(J.yaw), 0, Math.cos(J.yaw)); else fw = J.q.rot(v3(0, 0, 1));
  fw = vsub(fw, vscale(up, vdot(fw, up)));
  if (fw.len() < 0.2) { fw = vsub(v3(0, 1, 0), vscale(up, up.y)); if (fw.len() < 0.2) fw = v3(Math.sin(J.yaw), 0, Math.cos(J.yaw)); }
  fw.norm(); const rt = vcross(fw, up).norm();
  const wish = vadd(vscale(fw, ent.y), vscale(rt, ent.x)), wl = Math.min(1, wish.len()); if (wl > 1e-3) wish.scale(1 / wish.len());
  const vmax = J.vel_max * (ent.correr ? 2.9 : 1.3);
  NAT.suelta -= dt;
  if (NAT.pegado) {
    const vn = vdot(J.vel, up), vt = vsub(J.vel, vscale(up, vn)), dv = vsub(vscale(wish, vmax * wl), vt), dl = dv.len(), mx = (wl > 0.01 ? 55 : 40) * dt;
    if (dl > 0) vt.addS(dv, Math.min(1, mx / dl));
    J.vel.copy(vt).addS(up, Math.min(0, vn) - 6 * dt);
    if (ent.saltar && NAT.suelta < -0.15) { J.vel.addS(up, 7); J.vel.y += 2.5; NAT.pegado = false; NAT.suelta = 0.35; }
  } else {
    J.vel.y -= GRAV * MUNDO.gravedad * (J.grav || 1) * dt;
    const dv = vsub(vscale(wish, vmax * wl), v3(J.vel.x, 0, J.vel.z)); J.vel.x += dv.x * Math.min(1, dt * 1.5); J.vel.z += dv.z * Math.min(1, dt * 1.5);
    up.lerpTo(v3(0, 1, 0), Math.min(1, dt * 3)).norm();
  }
  // moverse en pasos chicos sacando la esfera de lo que toca
  const pasos = Math.max(1, Math.ceil(J.vel.len() * dt / 0.2)); let toco = null;
  for (let s = 0; s < pasos; s++) {
    J.pos.addS(J.vel, dt / pasos);
    const corr = v3(), c = J.pos.clone();
    esferaFuera(c, SCP_R, corr, false);
    for (const b of PH.bodies) {
      if (b.noJug || b.held || b.persona === JUG.cuerpo) continue;
      const a = b.aabb; if (c.x + SCP_R < a.x0 || c.x - SCP_R > a.x1 || c.y + SCP_R < a.y0 || c.y - SCP_R > a.y1 || c.z + SCP_R < a.z0 || c.z - SCP_R > a.z1) continue;
      empujarDeCuerpo(b, c, SCP_R, corr, false, b.dynamic);
    }
    J.pos.copy(c);
    const cl = corr.len(); if (cl > 1e-5) { const n = corr.scale(1 / cl), vn = vdot(J.vel, n); if (vn < 0) J.vel.addS(n, -vn); toco = n; }
  }
  // la superficie: abajo; una pared adelante (para trepar); o, al pasar un borde, la cara de la vuelta
  // (la pared de adelante se busca hacia donde querés ir: contra la pared la velocidad ya es cero)
  const mov = vsub(J.vel, vscale(up, vdot(J.vel, up))), ml = mov.len(), dm = wl > 0.1 ? wish.clone() : ml > 0.3 ? vscale(mov, 1 / ml) : null;
  let nMeta = null;
  if (NAT.suelta <= 0) {
    const hA = raycast(J.pos, vscale(up, -1), SCP_ALTO + 0.9, null);
    if (hA) nMeta = hA.n;
    if (dm) { const hF = raycast(J.pos, dm, 0.9, null); if (hF && vdot(hF.n, up) < 0.6) nMeta = hF.n; }
    if (!hA && NAT.pegado && dm) { const hB = raycast(vadd(J.pos, vadd(vscale(up, -0.95), vscale(dm, 0.55))), vscale(dm, -1), 1.4, null); if (hB) nMeta = hB.n; }
    if (!nMeta && toco && !NAT.pegado) nMeta = toco;
  }
  if (nMeta) {
    up.lerpTo(nMeta, Math.min(1, dt * 10)).norm();
    const hS = raycast(J.pos, vscale(nMeta, -1), SCP_ALTO + 1, null);
    if (hS) { J.pos.addS(nMeta, (SCP_ALTO - hS.t) * Math.min(1, dt * 18)); const vn = vdot(J.vel, nMeta); if (vn > 0 && NAT.pegado) J.vel.addS(nMeta, -vn * Math.min(1, dt * 10)); NAT.pegado = true; }
    else NAT.pegado = false;
  } else NAT.pegado = false;
  J.suelo = NAT.pegado; J.bobK = 0; J.agK = 0;
  if (dm && NAT.pegado) NAT.fw.lerpTo(dm, Math.min(1, dt * 10)); else if (wl < 0.01) NAT.fw.lerpTo(fw, Math.min(1, dt * 4));
  NAT.fw.addS(up, -vdot(NAT.fw, up)); if (NAT.fw.len() < 1e-3) NAT.fw.copy(fw); NAT.fw.norm();
  if (J.pos.y < MUNDO.lo.y - 60) { jugadorAparecer(); up.set(0, 1, 0); }
}
// ---------------- cada cuadro: botones, agarres por la red ----------------
function natPaso(dt) {
  if (NAT.rag && !JUG.vivo) { NAT.rag = false; NAT.jalado = null; natTercera(false); natMarcar(); }
  if (NAT.volando && (!JUG.vivo || JUG.vehiculo)) natVolar(false);
  // si agarro el muñeco de otro jugador, le mando adónde lo llevo
  const b = ARM.agarre ? ARM.agarre.b : ARM.grav ? ARM.grav.b : null, P = b && b.persona;
  if (P && P.remoto && P.rag && RED.on) {
    let h = -1; for (const [i, e] of P.rag.cuerpos) if (e.b === b) h = i;
    NAT.jalo = { P, b, h }; P.jaladoT = TIEMPO.t;
    if ((NAT.tJalo -= dt) <= 0) { NAT.tJalo = 1 / 15; publicar('a', { k: 'jalar', to: P.remoto, h, p: [r3(b.pos.x), r3(b.pos.y), r3(b.pos.z)] }); }
  } else if (NAT.jalo) {
    const J2 = NAT.jalo; NAT.jalo = null;
    if (RED.on) publicar('a', { k: 'jalar', to: J2.P.remoto, h: J2.h, fin: 1, v: [r3(J2.b.vel.x), r3(J2.b.vel.y), r3(J2.b.vel.z)] });
  }
}
// un golpe de la pistola de gravedad al muñeco de otro: también se lo mando
function natEmpujon(b) {
  const P = b && b.persona; if (!P || !P.remoto || !P.rag || !RED.on) return;
  let h = -1; for (const [i, e] of P.rag.cuerpos) if (e.b === b) h = i;
  publicar('a', { k: 'jalar', to: P.remoto, h, fin: 1, v: [r3(b.vel.x), r3(b.vel.y), r3(b.vel.z)] });
}
function natRed(d) {
  if (d.k !== 'jalar' || d.to !== RED.ID) return;
  const P = JUG.cuerpo; if (!P || !P.rag) return;
  const e = P.rag.cuerpos.get(d.h | 0) || P.rag.cuerpos.get(P.D.h.Hips); if (!e) return;
  if (d.fin) { NAT.jalado = null; if (Array.isArray(d.v)) { e.b.vel.set(num(d.v[0], -80, 80, 0), num(d.v[1], -80, 80, 0), num(d.v[2], -80, 80, 0)); e.b.wake(); } return; }
  if (!Array.isArray(d.p)) return;
  NAT.jalado = { b: e.b, p: v3(num(d.p[0], -1e4, 1e4, 0), num(d.p[1], -1e4, 1e4, 0), num(d.p[2], -1e4, 1e4, 0)), t: TIEMPO.t };
}
const natBits = () => (NAT.volando ? 16 : 0) | (NAT.rag ? 32 : 0) | (NAT.scp && !JUG.vehiculo ? 64 : 0);
// el cuerpo del jugador local según el mod (lo llama personasPaso)
function natPersona(P, dt) {
  if (!P || P.rag) return;
  natCuerpo(P, dt, { volando: NAT.volando && !JUG.vehiculo, scp: NAT.scp && !JUG.vehiculo, vel: JUG.vel, yaw: JUG.yaw, up: NAT.up, fw: NAT.fw });
  NAT.pies = P.marcha ? P.marcha.pies.filter((f) => f.p && f.t >= 1).map((f) => f) : null;
}
// el de otro jugador (lo llama remotoPaso con lo que llegó)
function natRemoto(R2, dt) {
  const P = R2.P, f = R2.f | 0;
  if (P.rag) {
    // muñeco a voluntad de otro: la cadera sigue a la suya (salvo mientras lo agarro yo)
    if (f & 32 && TIEMPO.t - (P.jaladoT || -9) > 0.5) {
      const e = P.rag.cuerpos.get(P.D.h.Hips);
      if (e) { const d = vsub(R2.pos, e.b.pos); if (d.len() > 5) for (const [, x] of P.rag.cuerpos) { x.b.pos.add(d); x.b.updateWorld(); } else { e.b.vel.lerpTo(vscale(d, 7), 0.2); e.b.wake(); } }
    }
    return;
  }
  const up = R2.up || v3(0, 1, 0); if (!P.upS) P.upS = up.clone(); P.upS.lerpTo(up, Math.min(1, dt * 8)).norm();
  const sp = vsub(R2.vel, vscale(P.upS, vdot(R2.vel, P.upS)));
  if (!P.fwS) P.fwS = v3(Math.sin(R2.yaw), 0, Math.cos(R2.yaw));
  P.fwS.lerpTo(sp.len() > 0.4 ? sp.norm() : v3(Math.sin(R2.yaw), 0, Math.cos(R2.yaw)), Math.min(1, dt * 8));
  P.fwS.addS(P.upS, -vdot(P.fwS, P.upS)); if (P.fwS.len() < 1e-3) P.fwS.set(0, 0, 1); P.fwS.norm();
  P.cuerpoRed = R2.b;
  natCuerpo(P, dt, { volando: !!(f & 16) && !R2.veh, scp: !!(f & 64) && !R2.veh, vel: R2.vel, yaw: R2.yaw, up: P.upS, fw: P.fwS });
}
function natCuerpo(P, dt, S) {
  if (S.volando) { P.inclin = natInclinar(P, S.vel, S.yaw, dt); P.velVuelo = S.vel.len(); P.suelo = true; P.vel.set(0, 0, 0); P.poseExtra = natVueloPose; }
  else { P.inclin = null; P.vuelo = null; P.poseExtra = null; }
  if (S.scp) { P.cuad = { up: S.up, fw: S.fw, vel: S.vel }; if (!P.md.color) P.md.color = [1.28, 1.24, 1.2, 1]; }
  else if (P.cuad) { P.cuad = null; P.marcha = null; P.md.color = null; }
}
// ---------------- volar: el cuerpo inclinado con resortes ----------------
function natInclinar(P, vel, yaw, dt) {
  const V = P.vuelo || (P.vuelo = { px: 0, pv: 0, rx: 0, rv: 0, lx: 0, lv: 0, yaw, va: vel.clone() });
  const fy = v3(Math.sin(yaw), 0, Math.cos(yaw)), ry = v3(-Math.cos(yaw), 0, Math.sin(yaw)), vf = vdot(vel, fy), vr = vdot(vel, ry);
  let dy = yaw - V.yaw; dy = ((dy + Math.PI) % TAU + TAU) % TAU - Math.PI; V.yaw = yaw; const yr = dt > 0 ? dy / dt : 0;
  const acc = vscale(vsub(vel, V.va), 1 / Math.max(dt, 1e-3)); V.va.copy(vel); const af = clamp(vdot(acc, fy), -60, 60), ar = clamp(vdot(acc, ry), -60, 60);
  // adelante según la velocidad; de costado hacia donde empuja (como un avión que dobla: se inclina hacia la curva)
  V.ar = (V.ar || 0) + (ar - (V.ar || 0)) * Math.min(1, dt * 8);
  const tp = clamp(Math.atan2(vf, 7) * 1.15 - clamp(vel.y, -20, 20) * 0.012, -0.55, 1.42), tr = clamp(V.ar * 0.05 - clamp(yr, -6, 6) * 0.12 + vr * 0.004, -0.9, 0.9);
  const k = Math.min(dt, 0.05);
  V.pv += ((tp - V.px) * 38 - V.pv * 6.5) * k; V.px += V.pv * k;
  V.rv += ((tr - V.rx) * 34 - V.rv * 6) * k; V.rx += V.rv * k;
  V.lv += ((clamp(-af * 0.025, -0.7, 0.7) - V.lx) * 26 - V.lv * 2.6) * k; V.lx += V.lv * k;
  return Quat.axis(1, 0, 0, V.px).mul(Quat.axis(0, 0, 1, V.rx));
}
// apunta un hueso (hacia su hijo) en una dirección del mundo, con peso
function huesoApuntar(P, nom, hijo, dir, k) {
  const md = P.md, h = P.D.h, i = h[nom], j = h[hijo]; if (i === undefined || j === undefined || k <= 0.001) return;
  md.actualizar(); const W = md.W, cur = vsub(wp(W[j]), wp(W[i])); if (cur.len() < 1e-5) return; cur.norm();
  const des = vadd(vscale(cur, 1 - k), vscale(dir, k)); if (des.len() < 1e-5) return; des.norm();
  const qW = rotEntre(cur, des).mul(m4quat(W[i])), ql = m4quat(W[P.D.sub[i].pa]).conj().mul(qW).norm();
  const r = md.r[i]; r[0] = ql.x; r[1] = ql.y; r[2] = ql.z; r[3] = ql.w; md.sucio = true;
}
function natVueloPose(P) {
  const V = P.vuelo; if (!V) return;
  const q = Quat.axis(0, 1, 0, P.yaw).mul(P.inclin || new Quat()), up = q.rot(v3(0, 1, 0)), fw = q.rot(v3(0, 0, 1)), iz = q.rot(v3(1, 0, 0));
  const k = clamp(((P.velVuelo || 0) - 3) / 12, 0, 1);
  // a toda velocidad, como Superman: el brazo derecho adelante y el izquierdo pegado al cuerpo
  huesoApuntar(P, 'RightArm', 'RightForeArm', up, 0.92 * k); huesoApuntar(P, 'RightForeArm', 'RightHand', up, 0.92 * k);
  const bajo = vadd(vscale(up, -0.9), vscale(iz, 0.25)).norm();
  huesoApuntar(P, 'LeftArm', 'LeftForeArm', bajo, 0.7 * k); huesoApuntar(P, 'LeftForeArm', 'LeftHand', bajo, 0.7 * k);
  // piernas juntas que se balancean con la aceleración (quedan atrás al arrancar y se adelantan al frenar)
  for (const [u, l, s] of [['LeftUpLeg', 'LeftLeg', 1], ['RightUpLeg', 'RightLeg', -1]]) {
    const d = vadd(vadd(vscale(up, -1), vscale(fw, V.lx * 0.8 + (1 - k) * 0.25)), vscale(iz, s * 0.04)).norm();
    huesoApuntar(P, u, l, d, 0.75 + 0.2 * k);
    huesoApuntar(P, l, l === 'LeftLeg' ? 'LeftFoot' : 'RightFoot', vadd(d, vscale(fw, -0.35 * (1 - k))).norm(), 0.7 + 0.25 * k);
  }
}
// ---------------- SCP: pose en cuatro patas y paso procedural ----------------
const PATAS = [['LeftArm', 'LeftForeArm', 'LeftHand', 1, true, 0], ['RightArm', 'RightForeArm', 'RightHand', -1, true, 1], ['LeftUpLeg', 'LeftLeg', 'LeftFoot', 1, false, 1], ['RightUpLeg', 'RightLeg', 'RightFoot', -1, false, 0]];
function girarMundo(P, nom, eje, ang) {
  const md = P.md, i = P.D.h[nom]; if (i === undefined) return; md.actualizar();
  const qW = Quat.axis(eje.x, eje.y, eje.z, ang).mul(m4quat(md.W[i])), ql = m4quat(md.W[P.D.sub[i].pa]).conj().mul(qW).norm();
  const r = md.r[i]; r[0] = ql.x; r[1] = ql.y; r[2] = ql.z; r[3] = ql.w; md.sucio = true;
}
// dos huesos (brazo y antebrazo, o muslo y pierna) hasta el punto T; el codo/rodilla hacia "polo"; la punta con giro qFin
function ik2(P, iU, iK, iA, T, polo, qFin) {
  const md = P.md, W = md.W, A = P.D.sub;
  const Hp = wp(W[iU]), Kp = wp(W[iK]), Ap = wp(W[iA]), a = Kp.distTo(Hp), b = Ap.distTo(Kp);
  const d = clamp(T.distTo(Hp), Math.abs(a - b) + 1e-3, a + b - 1e-3), dir = vsub(T, Hp).norm();
  const x = (a * a - b * b + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, a * a - x * x));
  let pl = vsub(polo, vscale(dir, vdot(polo, dir))); if (pl.len() < 1e-5) pl = vsub(Kp, Hp); pl.norm();
  const Kn = vadd(Hp, vadd(vscale(dir, x), vscale(pl, hh))), Tn = vadd(Hp, vscale(dir, d));
  const qU = m4quat(W[iU]), qK = m4quat(W[iK]), qPU = m4quat(W[A[iU].pa]);
  const R1 = rotEntre(vsub(Kp, Hp), vsub(Kn, Hp)), qUn = R1.clone().mul(qU), A2 = vadd(Hp, R1.rot(vsub(Ap, Hp)));
  const qKn = rotEntre(vsub(A2, Kn), vsub(Tn, Kn)).mul(R1).mul(qK);
  const pon = (i, q) => { q.norm(); const r = md.r[i]; r[0] = q.x; r[1] = q.y; r[2] = q.z; r[3] = q.w; };
  pon(iU, qPU.conj().mul(qUn)); pon(iK, qUn.clone().conj().mul(qKn)); if (qFin) pon(iA, qKn.clone().conj().mul(qFin));
}
const ss01 = (u) => u * u * (3 - 2 * u);
function natCuadPose(P, dt) {
  const C = P.cuad, md = P.md, D = P.D, h = D.h; if (h.Hips === undefined) return;
  for (let i = 0; i < md.r.length; i++) { const b = P.base[i], r = md.r[i]; r[0] = b[0]; r[1] = b[1]; r[2] = b[2]; r[3] = b[3]; }
  if (P.hum) md.p[P.hum.ci] = D.sub[P.hum.ci].p.slice();
  const up = C.up.clone().norm(), X = vcross(up, C.fw).norm(), fw = vcross(X, up).norm();
  const Qs = qBase(X, up, fw), Qr = Qs.clone().mul(Quat.axis(1, 0, 0, Math.PI / 2));
  const vt = vsub(C.vel, vscale(up, vdot(C.vel, up))), sp = vt.len();
  // respiración / paso: el cuerpo sube y baja un poco con la marcha
  const M = P.marcha || (P.marcha = { pies: PATAS.map(([u, k, a, s, brazo, g]) => ({ iU: h[u], iK: h[k], iA: h[a], s, brazo, g, p: null, de: v3(), a: v3(), t: 1 })), fase: 0 });
  const enPaso = M.pies.some((f) => f.t < 1);
  const hipsW = vadd(vadd(P.pos, vscale(fw, -0.3)), vscale(up, enPaso ? 0.025 : 0));
  const raiz = vsub(hipsW, Qr.rot(D.rp[h.Hips]));
  m4trs([raiz.x, raiz.y, raiz.z], [Qr.x, Qr.y, Qr.z, Qr.w], [1, 1, 1], md.raiz); md.sucio = true;
  // cabeza: mira adelante (el cuello y la cabeza se levantan)
  const ejeC = vscale(X, -1); girarMundo(P, 'Neck', ejeC, 0.75); girarMundo(P, 'Head', ejeC, 0.55);
  md.actualizar();
  const W = md.W, ign = P.cuerpoRed || null, enAire = !(P === JUG.cuerpo ? NAT.pegado : true) && P === JUG.cuerpo;
  const largo = clamp(0.3 + sp * 0.055, 0.3, 1.05), dur = clamp(0.27 - sp * 0.009, 0.1, 0.27), alto = 0.09 + Math.min(0.2, sp * 0.012);
  const otro = (g) => M.pies.some((f) => f.g !== g && f.t < 1);
  for (const f of M.pies) {
    if (f.iU === undefined || f.iK === undefined || f.iA === undefined) continue;
    const raizP = wp(W[f.iU]), lead = vscale(vt, f.brazo ? 0.11 : 0.09);
    if (lead.len() > 0.5) lead.scale(0.5 / lead.len());
    const casa0 = vadd(vadd(raizP, vscale(X, f.s * (f.brazo ? 0.12 : 0.07))), lead);
    const hit = enAire ? null : raycast(vadd(casa0, vscale(up, 0.3)), vscale(up, -1), 1.7, ign);
    const casa = hit ? hit.p : vsub(casa0, vscale(up, 0.45));
    if (!f.p || f.p.distTo(raizP) > 2.2) { f.p = casa.clone(); f.t = 1; }
    if (!hit) { f.p.lerpTo(casa, Math.min(1, dt * 10)); f.t = 1; }
    else if (f.t >= 1) {
      if (f.p.distTo(casa) > largo && !otro(f.g)) for (const g of M.pies) if (g.g === f.g && g.t >= 1 && g.p) { g.de.copy(g.p); g.t = 0; g.nuevo = true; }
    }
    if (f.nuevo) { f.a.copy(casa); f.nuevo = false; }
    if (f.t < 1) {
      f.t = Math.min(1, f.t + dt / dur); const u = ss01(f.t);
      f.p = vadd(vadd(vscale(f.de, 1 - u), vscale(f.a, u)), vscale(up, Math.sin(Math.PI * f.t) * alto));
      f.a.lerpTo(casa, Math.min(1, dt * 6));
    }
  }
  // brazos y piernas hasta cada pie (manos apoyadas con la palma abajo, pies planos)
  const qMI = qBase(fw, up, vcross(fw, up)), mfw = vscale(fw, -1), qMD = qBase(mfw, up, vcross(mfw, up));
  for (const f of M.pies) {
    if (!f.p || f.iU === undefined || f.iK === undefined || f.iA === undefined) continue;
    const T = vadd(f.p, vscale(up, f.brazo ? 0.05 : 0.09));
    const polo = f.brazo ? vadd(vscale(fw, -1), vscale(X, f.s * 0.7)) : vadd(fw, vscale(up, -0.35));
    const qFin = (f.brazo ? (f.s > 0 ? qMI : qMD) : Qs).clone().mul(D.rw[f.iA]);
    ik2(P, f.iU, f.iK, f.iA, T, polo, qFin);
  }
  md.sucio = true;
}
