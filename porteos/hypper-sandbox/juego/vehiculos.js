// ---------------------------------------------------------------------------------------------------------
// vehículos: autos (suspensión por rueda con los WheelCollider del juego: radio, recorrido, resorte y
// amortiguador), moto (dos ruedas que se mantiene derecha), helicópteros, avión y asientos (sillas, banco,
// inodoro, cama, bote). Se sube con E (o el botón de usar) y se baja con F.
// ---------------------------------------------------------------------------------------------------------
const VEHS = [];
function vehiculoNuevo(o) {
  const arb = o.md.A, mb = arb[0].mb || [];
  const tipo = mb.includes('HelicopterController') ? 'heli' : mb.includes('AeroplaneController') ? 'avion' : mb.includes('RB_Controller') ? 'moto' : mb.includes('SCC_Drivetrain') ? 'auto' : 'asiento';
  // marco de la raíz (sin la posición del prefab)
  const md = new Modelo(arb); md.p[0] = [0, 0, 0]; md.sucio = true; md.actualizar();
  const enCuerpo = (W) => v3(W[12] - o.c.x, W[13] - o.c.y, W[14] - o.c.z);   // punto del marco raíz → local del cuerpo (sin girar)
  const V = { o, tipo, ruedas: [], asientos: [], vida: tipo === 'asiento' ? 1e9 : 400, roto: false, motor: 0, giro: 0, gas: 0, rpm: 0, vel: 0, aleteo: 0, rotores: [], conductor: null };
  for (let i = 0; i < arb.length; i++) {
    const x = arb[i];
    if (/^SitPoint/.test(x.n)) V.asientos.push(enCuerpo(md.W[i]));
    if (x.wc && md.act[i]) {
      const p = enCuerpo(md.W[i]); p.y += x.wc.c[1];
      V.ruedas.push({ p, r: x.wc.r, sd: Math.max(0.08, x.wc.sd), sp: x.wc.sp || 35000, da: x.wc.da || 2000, del: p.z > 0, comp: 0, giro: 0, vis: -1, n: x.n, toca: false });
    }
    if ((x.mb || []).includes('HeliRotorController')) V.rotores.push({ i, eje: /small|tail/i.test(x.n) ? v3(1, 0, 0) : v3(0, 1, 0) });
    if ((x.mb || []).includes('JetParticleEffect') && md.act[i]) { V.jets = V.jets || []; V.jets.push(enCuerpo(md.W[i])); }
    if (/Propeller/.test(x.n) && x.m !== undefined) V.rotores.push({ i, eje: v3(0, 0, 1) });
  }
  // la moto: dos rayos (adelante y atrás)
  if (tipo === 'moto' && V.ruedas.length < 2) {
    const fr = arb.findIndex((n) => n.n === 'FrontRayPos'), rr = arb.findIndex((n) => n.n === 'RearRayPos');
    V.ruedas = [];
    for (const [k, del] of [[fr, true], [rr, false]]) if (k >= 0) { const p = enCuerpo(md.W[k]); p.y += 0.38; V.ruedas.push({ p, r: 0.38, sd: 0.25, sp: 30000 * 0.5, da: 2500 * 0.5, del, comp: 0, giro: 0, vis: -1, toca: false }); }
  }
  // ruedas que se ven: el nodo con malla más cercano a cada rueda (nombre parecido)
  const vis = [];
  for (let i = 0; i < arb.length; i++) {
    const x = arb[i]; if (!md.act[i]) continue;
    if (/wheel|^F[LR]$|^R[LR]$|tire|rueda/i.test(x.n) && !x.wc && (x.m >= 0 || arb.some((c) => c.pa === i && c.m >= 0))) vis.push(i);
  }
  const cen = (i) => {
    // centro de la malla del nodo (o de su hijo con malla) en el marco del nodo
    let k = i; if (!(arb[i].m >= 0)) k = arb.findIndex((c) => c.pa === i && c.m >= 0);
    if (k < 0) return { local: v3(), mundo: v3(md.W[i][12], md.W[i][13], md.W[i][14]) };
    const d = DATA.ms[arb[k].m], cl = v3(d.mn[0] + d.sc[0] / 2, d.mn[1] + d.sc[1] / 2, d.mn[2] + d.sc[2] / 2);
    const Wk = md.W[k], Wi = md.W[i], pw = m4pt(Wk, cl.x, cl.y, cl.z, v3());
    const inv = M4.inv(Wi); return { local: m4pt(inv, pw.x, pw.y, pw.z, v3()), mundo: pw };
  };
  const usados = new Set();
  for (const w of V.ruedas) {
    let best = -1, bd = 1e9, bc = null;
    for (const i of vis) { if (usados.has(i)) continue; const c = cen(i), d = vsub(vsub(c.mundo, o.c), w.p).len(); if (d < bd) { bd = d; best = i; bc = c; } }
    if (best >= 0 && bd < 1.5) {
      usados.add(best); w.vis = best; w.cl = bc.local;
      // ejes del auto (x = eje de la rueda, y = arriba) vistos desde el nodo de la rueda
      const q = m4quat(md.W[best]).conj(); w.ejeX = q.rot(v3(1, 0, 0)); w.ejeY = q.rot(v3(0, 1, 0));
    }
  }
  for (const r of V.rotores) { const c = cen(r.i), q = m4quat(md.W[r.i]).conj(); r.cl = c.local; r.ejeL = q.rot(r.eje); r.ang = 0; }
  o.md.E = []; o.veh = V; o.b.noGrabCar = false; VEHS.push(V);
  if (tipo !== 'asiento') { o.b.angDamp = 0.6; o.b.fric = 0.4; }
  return V;
}
function vehiculoBorrar(o) { const i = VEHS.indexOf(o.veh); if (i >= 0) VEHS.splice(i, 1); }
// rueda: matriz extra = T(c) · R(giro de dirección) · R(vuelta) · T(-c)
const _eM = new Float32Array(16), _eA = new Float32Array(16);
function matrizGiro(cl, ejes, out) {
  // ejes: lista de [eje, ángulo]
  m4trs([cl.x, cl.y, cl.z], [0, 0, 0, 1], [1, 1, 1], out);
  for (const [e, a] of ejes) { const q = Quat.axis(e.x, e.y, e.z, a); m4trs([0, 0, 0], [q.x, q.y, q.z, q.w], [1, 1, 1], _eA); m4mul(out, _eA, out); }
  m4trs([-cl.x, -cl.y, -cl.z], [0, 0, 0, 1], [1, 1, 1], _eA); m4mul(out, _eA, out);
  return out;
}
function vehiculoAntesDeDibujar(o) {
  const V = o.veh, E = o.md.E;
  for (const w of V.ruedas) {
    if (w.vis < 0) continue;
    const M = E[w.vis] || (E[w.vis] = new Float32Array(16));
    matrizGiro(w.cl, [[w.ejeY, w.del ? -V.giro * 0.6 : 0], [w.ejeX, w.giroAng || 0]], M);
    // la suspensión sube y baja la rueda
    const t = w.ejeY; M[12] += t.x * (w.compVis || 0); M[13] += t.y * (w.compVis || 0); M[14] += t.z * (w.compVis || 0);
  }
  for (const r of V.rotores) { const M = E[r.i] || (E[r.i] = new Float32Array(16)); matrizGiro(r.cl, [[r.ejeL, r.ang]], M); }
  o.md.sucio = true;
}
// ---------------- manejar ----------------
function vehiculosPaso(dt, ent) {
  for (const V of VEHS) {
    const o = V.o, b = o.b; if (V.roto && V.tipo !== 'asiento') { V.motor = 0; }
    const yo = JUG.vehiculo === o && JUG.asiento === 0;
    const mando = yo && !V.roto ? ent : null;
    if (V.tipo === 'auto' || V.tipo === 'moto') autoPaso(V, dt, mando);
    else if (V.tipo === 'heli') heliPaso(V, dt, mando);
    else if (V.tipo === 'avion') avionPaso(V, dt, mando);
    for (const r of V.rotores) r.ang += dt * V.motor * (V.tipo === 'avion' ? 60 : r.eje.x ? 70 : 38);
    // llamas de los motores del avión (más largas con más potencia)
    if (V.jets && V.motor > 0.08 && Math.random() < 0.85 * GFX.part + 0.15) {
      const f = b.q.rot(v3(0, 0, 1));
      for (const j of V.jets) {
        const p = vadd(b.pos, b.q.rot(j));
        particula(p, vadd(vscale(f, -10 - 14 * V.motor), b.vel), 0.07 + 0.08 * V.motor, 0.18 + 0.22 * V.motor, [1, 0.55, 0.2, 1], 'fuego', 0.2);
        if (Math.random() < 0.3) particula(p, vadd(vscale(f, -4), vscale(b.vel, 0.9)), 1.2, 0.35, [0.55, 0.55, 0.55, 0.25], 'humo', 2);
      }
      if (V.jets.length) luzTemporal(vadd(b.pos, b.q.rot(V.jets[0])), 8, [3 * V.motor, 1.8 * V.motor, 0.7 * V.motor], 0.05);
    }
    // sonido del motor
    if (V.motor > 0.02) {
      const s = V.tipo === 'heli' ? 'Helicopter' : V.tipo === 'avion' ? 'PropellerEngine' : 'Big4Stroke';
      bucle('veh' + o.id, s, b.pos, 0.6 * Math.min(1, V.motor), V.tipo === 'auto' || V.tipo === 'moto' ? 0.7 + V.rpm * 0.9 : 0.8 + V.motor * 0.3);
    }
  }
}
function autoPaso(V, dt, ent) {
  const b = V.o.b, up = b.q.rot(v3(0, 1, 0)), fwd = b.q.rot(v3(0, 0, 1)), rgt = b.q.rot(v3(1, 0, 0));
  // la dirección se endurece con la velocidad (a 30 m/s dobla un tercio): así no vuelca en las curvas
  const vAbs = Math.abs(V.vel || 0), objetivo = ent ? -ent.x / (1 + vAbs / 14) : 0;
  V.giro += (objetivo - V.giro) * Math.min(1, dt * 6);
  const gas = ent ? ent.y : 0, freno = ent && ent.saltar;
  V.motor += ((ent ? 1 : 0) - V.motor) * Math.min(1, dt * 2);
  const vz = vdot(b.vel, fwd); V.vel = vz; V.rpm = Math.min(1, Math.abs(vz) / 30);
  const m = b.mass, nr = V.ruedas.length || 1;
  let tocan = 0;
  for (const w of V.ruedas) {
    const pw = vadd(b.pos, b.q.rot(w.p)), dir = vscale(up, -1), L = w.sd + w.r;
    const h = raycast(pw, dir, L + 0.05, b);
    w.toca = !!h && h.t <= L;
    if (!w.toca) { w.comp = 0; w.compVis = -w.sd * 0.5; w.marcaP = null; continue; }
    tocan++;
    const x = L - h.t, r = vsub(vadd(pw, vscale(dir, h.t)), b.pos);
    const vp = vadd(b.vel, vcross(b.ang, r)), vn = vdot(vp, up);
    let F = w.sp * x - w.da * 1.8 * vn; if (F < 0) F = 0;
    F = Math.min(F, m * 40);
    b.wake(); b.applyVel(vscale(up, F * dt), r, 1);
    w.compVis = x - w.sd * 0.5;
    // agarre: lateral (que no patine de costado) y avance
    const dirW = w.del ? b.q.rot(Quat.axis(0, 1, 0, V.giro * 0.6).rot(v3(0, 0, 1))) : fwd;
    const latW = vcross(up, dirW).norm();
    const vlat = vdot(vp, latW), vlon = vdot(vp, dirW);
    // marca en el piso si la rueda patina de costado o frena fuerte
    const pc = vadd(pw, vscale(dir, h.t)), pat = Math.abs(vlat) > 3.5 || (freno && Math.abs(vlon) > 4);
    if (pat && w.marcaP) marcaTramo(w.marcaP, pc, h.n, V.tipo === 'moto' ? 0.14 : 0.24, (Math.abs(vlat) - 2) / 8 + (freno ? 0.5 : 0));
    w.marcaP = pat ? pc : null;
    const agarre = (freno && !w.del ? 0.35 : 1) * Math.min(F * dt, m * 25 * dt / nr * 3);
    const jl = clamp(-vlat * m / nr * 0.9, -agarre * 1.05, agarre * 1.05);
    // el agarre de costado se aplica a la altura del centro de masa (las cubiertas no lo hacen rolar)
    const rL = vsub(r, vscale(up, vdot(r, up) * 0.85));
    b.applyVel(vscale(latW, jl), rL, 1);
    // motor (tracción en todas) y freno
    let fz = 0;
    const vmax = V.tipo === 'moto' ? 34 : 32;
    if (gas > 0.05) fz = gas * (vlon < vmax ? 1 : 0) * m * 9 / nr;
    if (gas < -0.05) fz = vlon > 1 ? gas * m * 14 / nr : gas * (vlon > -10 ? 1 : 0) * m * 6 / nr;
    if (freno) fz = -Math.sign(vlon) * Math.min(Math.abs(vlon) * m / nr / dt, m * 12 / nr);
    if (!gas && !freno) fz = -vlon * m * 0.15 / nr;
    b.applyVel(vscale(dirW, fz * dt), vsub(r, vscale(up, vdot(r, up) * 0.7)), 1);
    w.giroAng = (w.giroAng || 0) + vlon / w.r * dt;
  }
  // barra estabilizadora: frena el giro de costado (rolido) y lo endereza un poco mientras toca el piso
  if (tocan >= 2 && V.tipo !== 'moto') {
    const rol = vdot(b.ang, fwd), cab = vdot(b.ang, rgt);
    b.ang.addS(fwd, -rol * Math.min(1, dt * 6)); b.ang.addS(rgt, -cab * Math.min(1, dt * 2));
    const inclin = vdot(rgt, v3(0, 1, 0)); b.ang.addS(fwd, inclin * dt * 4);
  }
  // quieto sin acelerar: freno de mano suave (que no quede temblando)
  if (tocan && !gas && Math.hypot(b.vel.x, b.vel.z) < 0.6 && !V.roto) { b.vel.x *= Math.exp(-dt * 6); b.vel.z *= Math.exp(-dt * 6); b.ang.scale(Math.exp(-dt * 4)); }
  if (!tocan) for (const w of V.ruedas) w.giroAng = (w.giroAng || 0) + V.vel / w.r * dt * 0.98;
  // la moto se mantiene derecha (y se inclina al doblar)
  if (V.tipo === 'moto' && !V.roto) {
    const inc = clamp(-V.giro * clamp(Math.abs(V.vel) / 12, 0, 1) * 1.6, -0.6, 0.6);   // se inclina hacia la curva
    const deseado = Quat.axis(fwd.x, fwd.y, fwd.z, inc).rot(v3(0, 1, 0));
    const c = vcross(up, deseado);
    b.ang.addS(c, dt * 30); b.ang.addS(vscale(fwd, vdot(b.ang, fwd)), -dt * 4);
    if (tocan) b.ang.addS(up, (-V.giro * clamp(V.vel / 6, -1, 1) * 1.8 - vdot(b.ang, up)) * dt * 6);
  }
  // choque de frente con la moto: el piloto sale volando (como el CrashController del juego)
  if (V.tipo === 'moto' && JUG.vehiculo === V.o && (V.velAnt || 0) - Math.abs(V.vel) > 9) {
    const vAnt = V.velAnt; salirVehiculo(); JUG.vel.copy(vadd(vscale(fwd, vAnt * 0.7), v3(0, 4, 0))); aviso('¡Te caíste!', 1.5); CAM.temblor = 0.8;
  }
  V.velAnt = Math.abs(V.vel);
  // si quedó dado vuelta y quieto, se endereza solo
  if (up.y < 0.2 && b.vel.len() < 1 && JUG.vehiculo === V.o) { V.vuelcoT = (V.vuelcoT || 0) + dt; if (V.vuelcoT > 2) { b.q.copy(Quat.axis(0, 1, 0, Math.atan2(fwd.x, fwd.z))); b.pos.y += 1.2; V.vuelcoT = 0; } }
}
function heliPaso(V, dt, ent) {
  const b = V.o.b, up = b.q.rot(v3(0, 1, 0)), fwd = b.q.rot(v3(0, 0, 1)), rgt = b.q.rot(v3(1, 0, 0)), m = b.mass;
  V.motor += ((ent ? 1 : 0) - V.motor) * Math.min(1, dt * 1.2);
  if (V.motor < 0.05) return;
  b.wake();
  const g = GRAV * MUNDO.gravedad;
  const sub = ent ? (ent.saltar ? 1 : 0) - (ent.agachar ? 1 : 0) : 0;
  // empuje sobre el eje del rotor: con el motor arriba cancela el peso; con espacio/agacharse sube o baja
  const k = clamp((V.motor - 0.3) / 0.5, 0, 1);
  const emp = g * (1 + sub * 0.7) * k / Math.max(0.5, up.y);
  b.vel.addS(up, emp * dt);
  // frenado del aire (más en vertical, así queda quieto en el aire)
  const vv = b.vel.y; b.vel.y -= vv * Math.min(1, dt * 1.2) * k; b.vel.x *= Math.exp(-dt * 0.35); b.vel.z *= Math.exp(-dt * 0.35);
  // inclinación: adelante/atrás y costado; giro con la palanca
  const pdes = ent ? ent.y * 0.35 : 0, rdes = 0;
  const pit = Math.asin(clamp(-fwd.y, -1, 1)), rol = Math.asin(clamp(rgt.y, -1, 1));
  b.ang.addS(rgt, (pdes - pit) * dt * 8); b.ang.addS(fwd, (rdes - rol) * dt * 8);
  const ydes = ent ? -ent.x * 1.6 : 0; b.ang.addS(v3(0, 1, 0), (ydes - b.ang.y) * dt * 3);
  b.ang.scale(Math.exp(-dt * 2));
}
function avionPaso(V, dt, ent) {
  const b = V.o.b, up = b.q.rot(v3(0, 1, 0)), fwd = b.q.rot(v3(0, 0, 1)), rgt = b.q.rot(v3(1, 0, 0)), m = b.mass;
  const acel = ent ? (ent.saltar ? 1 : ent.agachar ? -1 : 0) : -0.3;
  V.motor = clamp(V.motor + acel * dt * 0.4, 0, 1);
  if (V.motor < 0.01 && b.vel.len() < 0.5) return;
  b.wake();
  const vz = vdot(b.vel, fwd), g = GRAV * MUNDO.gravedad;
  b.vel.addS(fwd, V.motor * 14 * dt);
  // sustentación según la velocidad; arrastre lateral y vertical (las alas "agarran" el aire)
  const lift = clamp(vz / 28, 0, 1.3) * g;
  b.vel.addS(up, lift * dt);
  const vlat = vdot(b.vel, rgt), vver = vdot(b.vel, up);
  b.vel.addS(rgt, -vlat * dt * 1.5); b.vel.addS(up, -vver * dt * 0.8 * clamp(vz / 20, 0, 1));
  b.vel.scale(Math.exp(-dt * 0.02));
  const ctl = clamp(vz / 20, 0, 1);
  if (ent) { b.ang.addS(rgt, ent.y * dt * 2.2 * ctl); b.ang.addS(fwd, -ent.x * dt * 3 * ctl); }
  // alinear la nariz con la velocidad
  if (vz > 5) { const vd = vscale(b.vel, 1 / b.vel.len()); b.ang.addS(vcross(fwd, vd), dt * 3); }
  b.ang.scale(Math.exp(-dt * 1.5));
}
// ---------------- subir y bajar ----------------
function usar() {
  if (JUG.vehiculo) { salirVehiculo(); return; }
  const h = raycast(CAM.pos, CAM.fwd, 4.5, null);
  if (h && h.body && h.body.ent && entidadUsar(h.body.ent)) return; // radio
  { const e = !h || !h.body || !h.body.obj ? entidadCerca() : null; if (e && entidadUsar(e)) return; } // botón de autos al lado
  if (!h || !h.body || !h.body.obj) return;
  const o = h.body.obj;
  if (o.logica && usarLogica(o)) return;
  if (o.veh) { subirVehiculo(o); return; }
  if (o.tipo === 'arma') { darArma(o.nombre); borrarObjeto(o); return; }
  if (o.tipo === 'interactivo') { interactuar(o); return; }
}
function interactuar(o) {
  if (o.nombre === 'question_block') { const d = ['Crate', 'Pumpkin', 'bouncy_ball', 'Cone', 'Tire', 'Barrel'][(Math.random() * 6) | 0]; crearObjeto(d, vadd(o.b.pos, v3(0, 1.2, 0)), new Quat()); sonar('Click', o.b.pos, 0.8); }
  else if (o.nombre === 'c_ck') { sonar('BODY_Fart_mono', o.b.pos, 1, 0.8 + Math.random() * 0.5); o.b.vel.y += 5; o.b.wake(); }
  else if (o.nombre === 'bouncy_ball') { o.b.vel.y += 8; o.b.wake(); }
}
function subirVehiculo(o) {
  const V = o.veh; if (!V.asientos.length) V.asientos.push(v3(0, 0.6, 0));
  const ocup = new Set(VEHS.flatMap((x) => (x.ocupados || [])));
  let a = 0; if (V.conductor && V.conductor !== 'yo') a = 1; if (a >= V.asientos.length) return;
  soltarAgarre(); soltarGrav(); redReclamar(o);
  JUG.vehiculo = o; JUG.asiento = a; JUG.vehiculoCuerpo = o.b; V.conductor = a === 0 ? 'yo' : V.conductor;
  if (V.tipo !== 'asiento') sonar(V.tipo === 'auto' || V.tipo === 'moto' ? 'Engine_On' : 'BuggyEngineOn', o.b.pos, 0.7);
  JUG.yawAuto = 0; JUG.pitch = 0.15;
  aviso(V.tipo === 'asiento' ? 'F para pararte' : 'F para bajar', 2);
  if (typeof redSubir === 'function') redSubir(o, a);
}
function salirVehiculo() {
  const o = JUG.vehiculo; if (!o) return;
  const V = o.veh; if (V && V.conductor === 'yo') V.conductor = null;
  const b = o.b, lado = b.q.rot(v3(JUG.asiento % 2 ? -1.6 : 1.6, 0.6, 0));
  JUG.pos.copy(vadd(b.pos, lado)); JUG.vel.copy(b.vel);
  const h = mundoRayo(vadd(JUG.pos, v3(0, 3, 0)), v3(0, -1, 0), 8); if (h) JUG.pos.y = JUG.pos.y + 3 - h.t + 1.05;
  JUG.vehiculo = null; JUG.vehiculoCuerpo = null;
  if (V && V.tipo !== 'asiento') sonar('Engine_Off', b.pos, 0.6);
  if (typeof redSubir === 'function') redSubir(null, 0);
}
function vehiculoRoto(o) { const V = o.veh; V.roto = true; explosion(o.b.pos.clone(), 5, 60); o.color = null; o.md.color = [0.25, 0.23, 0.22, 1]; }
// cámara dentro del vehículo: tercera persona que sigue (o primera persona en el asiento)
function vehiculoCamara(o, out) {
  const V = o.veh, b = o.b, J = JUG;
  const asiento = V.asientos[J.asiento] || v3(0, 1, 0);
  const pSeat = vadd(b.pos, b.q.rot(vadd(asiento, v3(0, 0.75, 0))));
  J.pos.copy(vadd(pSeat, v3(0, -0.5, 0)));
  const qb = b.q.clone();
  if (!J.fpVeh) {
    // tercera persona: la cámara gira con el mouse alrededor del vehículo
    const q = Quat.euler(J.yaw, J.pitch);
    const tam = V.tipo === 'heli' || V.tipo === 'avion' ? 11 : V.tipo === 'asiento' ? 3 : 6.5;
    const centro = vadd(b.pos, v3(0, V.tipo === 'asiento' ? 1.2 : 1.6, 0)), atras = q.rot(v3(0, 0, -tam));
    const d = atras.len(), dir = vscale(atras, 1 / d), h = mundoRayo(centro, dir, d);
    out.pos.copy(centro).addS(dir, h ? Math.max(0.5, h.t - 0.3) : d); out.q.copy(q);
  } else { out.pos.copy(pSeat); out.q.copy(qb.mul(Quat.euler(J.yaw, J.pitch))); }
  J.ojoPos.copy(pSeat);
  return out;
}
