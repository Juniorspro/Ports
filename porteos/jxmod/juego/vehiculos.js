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
  // (el conductor va adentro: los Derby traen primero dos lugares sobre el capó y dos atrás mirando para atrás; con el primero
  // de la lista el personaje quedaba afuera del auto. Se ponen primero los asientos que están entre los ejes)
  if (tipo === 'auto' && V.ruedas.length >= 2 && V.asientos.length > 1) {
    const zs = V.ruedas.map((w) => w.p.z), zf = Math.max(...zs), zr = Math.min(...zs), adentro = (a) => a.z < zf - 0.2 && a.z > zr + 0.2;
    V.asientos = [...V.asientos.filter(adentro), ...V.asientos.filter((a) => !adentro(a))];
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
  // (sin los grupos: en el Sofie el nodo que junta las cuatro ruedas se llama «wheels» y tiene mallas abajo; la rueda de
  // atrás a la izquierda lo tomaba como su dibujo y al girar se llevaba el grupo entero: las ruedas volaban alrededor del
  // auto, cada vez más lejos. Un nodo que tiene otra rueda adentro no es una rueda)
  const anc = (a, d) => { for (let k = arb[d].pa; k >= 0; k = arb[k].pa) if (k === a) return true; return false; };
  const visR = vis.filter((i) => !vis.some((j) => j !== i && anc(i, j)));
  const usados = new Set();
  for (const w of V.ruedas) {
    let best = -1, bd = 1e9, bc = null;
    // (primero la que se llama igual que la rueda de la física —FLwheel, BRwheel…—; si no, la más cercana)
    const igual = w.n ? visR.filter((i) => !usados.has(i) && arb[i].n.toLowerCase() === w.n.toLowerCase()) : [];
    for (const i of igual.length ? igual : visR) { if (usados.has(i)) continue; const c = cen(i), d = vsub(vsub(c.mundo, o.c), w.p).len(); if (d < bd) { bd = d; best = i; bc = c; } }
    if (best >= 0 && bd < 1.5) {
      usados.add(best); w.vis = best; w.cl = bc.local;
      // ejes del auto (x = eje de la rueda, y = arriba) vistos desde el nodo de la rueda
      const q = m4quat(md.W[best]).conj(); w.ejeX = q.rot(v3(1, 0, 0)); w.ejeY = q.rot(v3(0, 1, 0));
      // (si el nodo de la rueda está espejado, el giro alrededor de su eje se ve al revés)
      const Wb = md.W[best]; w.esp = Wb[0] * (Wb[5] * Wb[10] - Wb[9] * Wb[6]) - Wb[4] * (Wb[1] * Wb[10] - Wb[9] * Wb[2]) + Wb[8] * (Wb[1] * Wb[6] - Wb[5] * Wb[2]) < 0 ? -1 : 1;
      // (la escala del nodo en el auto: la suspensión mueve la rueda en sus unidades. La silla de ruedas trae las ruedas con
      // escala 220 —el modelo viene en unidades chicas— y 10 cm de suspensión la llevaban 22 m lejos)
      w.esc = Math.max(1e-6, Math.hypot(Wb[0], Wb[1], Wb[2]));
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
    // (la rueda de adelante dibujada gira para el mismo lado que la de la física: antes se veía al revés)
    matrizGiro(w.cl, [[w.ejeY, w.del ? V.giro * 0.6 * (w.esp || 1) : 0], [w.ejeX, w.giroAng || 0]], M);
    // la suspensión sube y baja la rueda
    const t = w.ejeY, k = (w.compVis || 0) / (w.esc || 1); M[12] += t.x * k; M[13] += t.y * k; M[14] += t.z * k;
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
    // sonido del motor (la bici no tiene: va a pedal; el cohete suena aparte)
    if (V.motor > 0.02 && !V.bici) {
      const s = V.tipo === 'heli' ? 'Helicopter' : V.tipo === 'avion' ? 'PropellerEngine' : 'Big4Stroke';
      bucle('veh' + o.id, s, b.pos, 0.6 * Math.min(1, V.motor), V.tipo === 'auto' || V.tipo === 'moto' ? 0.7 + V.rpm * 0.9 : 0.8 + V.motor * 0.3);
    }
  }
}
function autoPaso(V, dt, ent) {
  const b = V.o.b, up = b.q.rot(v3(0, 1, 0)), fwd = b.q.rot(v3(0, 0, 1)), rgt = b.q.rot(v3(1, 0, 0));
  // la bici con cohete: Shift (o el botón) prende el cohete: empuja fuerte para adelante (hasta 48 m/s)
  V.bici = V.o.art === 'bici';
  if (V.bici) { V.turbo = !!(ent && (ent.correr || ENT.turbo)) && !V.roto;
    if (V.turbo !== !!V.turboEnv && JUG.vehiculo === V.o) { V.turboEnv = V.turbo; if (RED.on) publicar('a', { k: 'turbo', o: V.o.remoto ? V.o.key : claveObj(V.o), on: V.turbo ? 1 : 0 }); } if (V.turbo || V.turboRed) { if (V.turbo && vdot(b.vel, fwd) < 48) { b.wake(); b.vel.addS(fwd, 22 * dt); } cohetePaso(V, dt); } }
  // la dirección se endurece con la velocidad (a 30 m/s dobla un tercio): así no vuelca en las curvas
  const vAbs = Math.abs(V.vel || 0), objetivo = ent ? -ent.x / (1 + vAbs / 24) : 0;
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
    const vmax = V.bici ? (V.turbo ? 48 : 13) : V.tipo === 'moto' ? 34 : 32;
    if (gas > 0.05) fz = gas * (vlon < vmax ? 1 : 0) * m * (V.bici ? 4.5 : 9) / nr;   // (la bici, a pedal)
    if (gas < -0.05) fz = vlon > 1 ? gas * m * 14 / nr : gas * (vlon > -10 ? 1 : 0) * m * 6 / nr;
    if (freno) fz = -Math.sign(vlon) * Math.min(Math.abs(vlon) * m / nr / dt, m * 12 / nr);
    if (!gas && !freno) fz = -vlon * m * 0.15 / nr;
    b.applyVel(vscale(dirW, fz * dt), vsub(r, vscale(up, vdot(r, up) * 0.7)), 1);
    w.giroAng = (w.giroAng || 0) + vlon / w.r * dt;
  }
  // dirección de arcade: con 3 ruedas en el piso el auto gira a lo que pide el volante (bicicleta: v · tan δ / distancia entre
  // ejes), con tope de 1,6 g de costado; antes las cubiertas lo dejaban de largo (radio de 20 m a 10 m/s con el volante a
  // fondo, 55 m a 20 m/s). Se lleva la velocidad de giro hacia esa, sin tocar el rolido
  if (tocan >= 3 && V.tipo === 'auto' && Math.abs(vz) > 0.8 && !V.roto) {
    if (V.ejes === undefined) { const zs = V.ruedas.map((w) => w.p.z); V.ejes = Math.max(1.5, Math.max(...zs) - Math.min(...zs)); }
    const del = V.giro * 0.6, wDes = clamp(vz * Math.tan(del) / V.ejes, -16 / Math.abs(vz), 16 / Math.abs(vz)), wAct = vdot(b.ang, up);
    b.ang.addS(up, (wDes - wAct) * Math.min(1, dt * 14));
    // (y la velocidad sigue un poco más a la trompa: menos derrape de costado en la curva)
    const lat = vdot(b.vel, rgt); b.vel.addS(rgt, -lat * Math.min(1, dt * 2.5));
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
    const vAnt = V.velAnt; salirVehiculo(); JUG.vel.copy(vadd(vscale(fwd, vAnt * 0.7), v3(0, 4, 0))); CAM.temblor = 0.8;   // (sin cartel de «¡Te caíste!»: el golpe ya se ve)
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
  if (JNT.pedido) { juntosAceptar(); return; }   // (te pidieron un emote de a dos: E acepta)
  if (JUG.vehiculo) { salirVehiculo(); return; }
  if (nocheUsar()) return; // (botón de puerta o de luz de la oficina de la pizzería)
  if (typeof puertaUsar === 'function' && puertaUsar()) return;   // (una puerta del mapa: puertas.js)
  // (desde los ojos, como en GMod: con la cámara en tercera persona —la de un modo como Prop Hunt— el rayo arranca en el
  // punto de la línea de mira más cercano al jugador; si no, lo de entre la cámara y el jugador tapaba y no llegaba)
  let o0 = CAM.pos; { const ojo = JUG.ojoPos; if (ojo && vsub(ojo, CAM.pos).len() > 0.6) { const t = Math.max(0, vdot(vsub(ojo, CAM.pos), CAM.fwd)); o0 = vadd(CAM.pos, vscale(CAM.fwd, t)); } }
  const h = raycast(o0, CAM.fwd, 4.5, null);
  if (h && h.body && h.body.ent && entidadUsar(h.body.ent)) return; // radio
  { const e = !h || !h.body || !h.body.obj ? entidadCerca() : null; if (e && entidadUsar(e)) return; } // botón de autos al lado
  if ((!h || !h.body || !h.body.obj) && typeof gmaAsientoMirado === 'function' && gmaAsientoMirado()) return;   // (el asiento de un addon, fuera de su casco)
  if (!h || !h.body || !h.body.obj) { sonar('UI_niega', null, 0.3); return; }   // (nada para usar: el sonido de HL2)
  const o = h.body.obj;
  if ((o.gmEnt || (typeof GMA !== 'undefined' && GMA.modo)) && typeof gmaUsarObj === 'function' && gmaUsarObj(o)) return;   // (una entidad de un addon de GMod: su Use; con un modo de juego, también su PlayerUse para lo demás)
  if (o.nombre === 'Arcade') { maqUsar(o); return; }
  if (o.nk) { nukeUsar(o); return; }   // (una bomba nuclear: armarla)
  if (o.art && artUsar(o)) return;   // (la catapulta, la bomba de Rick Prime)   // (la maquinita: elegir un juego y jugarlo)
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
    const tam = V.camDist || (V.tipo === 'heli' || V.tipo === 'avion' ? 11 : V.tipo === 'asiento' ? 3 : 6.5);   // (camDist: los de los addons, según su tamaño)
    const centro = vadd(b.pos, v3(0, V.tipo === 'asiento' ? 1.2 : 1.6, 0)), atras = q.rot(v3(0, 0, -tam));
    const d = atras.len(), dir = vscale(atras, 1 / d), h = mundoRayo(centro, dir, d);
    out.pos.copy(centro).addS(dir, h ? Math.max(0.5, h.t - 0.3) : d); out.q.copy(q);
  } else { out.pos.copy(pSeat); out.q.copy(qb.mul(Quat.euler(J.yaw, J.pitch))); }
  J.ojoPos.copy(pSeat);
  return out;
}
// ---------------- bocina (H en la compu, el botón mientras manejás en el celular) ----------------
// Sintetizada (no hay sonido en el paquete): los autos, dos tonos en diente de sierra filtrados (la policía más aguda),
// la moto un tono agudo y la bici con cohete un timbre de bici (ring ring). Sale del vehículo (3D) y en la sala la
// oyen los demás mientras la tocás.
const BOC = { mia: false };
const bocTipo = (V) => (V.o.art === 'bici' ? 'timbre' : V.tipo === 'moto' ? 'moto' : /police/i.test(V.o.nombre) ? 'policia' : V.tipo === 'auto' ? 'auto' : null);
function bocinaSonar(V, si) {
  const tipo = bocTipo(V); if (!tipo || !AUD.ctx) return;
  if (si === !!V.boc) return;
  if (!si) { const B = V.boc; V.boc = null; const t = AUD.ctx.currentTime; try { B.F.g.gain.setTargetAtTime(0, t, 0.025); for (const o of B.os) o.stop(t + 0.15); clearInterval(B.iv); } catch (e) {} return; }
  const c = AUD.ctx, F = fuente3D(V.o.b.pos, 0), t = c.currentTime, os = [];
  if (tipo === 'timbre') {
    // timbre: dos parciales de campana que se apagan rápido, cada 0,28 s
    const g = c.createGain(); g.gain.value = 0; g.connect(F.g); F.g.gain.value = 0.55;
    for (const [f, a] of [[2650, 1], [4100, 0.45], [5600, 0.2]]) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const ga = c.createGain(); ga.gain.value = a; o.connect(ga); ga.connect(g); o.start(); os.push(o); }
    const golpe = () => { const n = c.currentTime; g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(0.9, n); g.gain.setTargetAtTime(0, n + 0.01, 0.07); };
    golpe(); V.boc = { F, os, iv: setInterval(golpe, 280) }; return;
  }
  const fr = tipo === 'moto' ? [560, 700] : tipo === 'policia' ? [440, 554] : [370, 466];
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = tipo === 'moto' ? 3200 : 2200; lp.Q.value = 2; lp.connect(F.g);
  for (const f of fr) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); os.push(o); }
  F.g.gain.setValueAtTime(0, t); F.g.gain.linearRampToValueAtTime(0.32, t + 0.02);
  V.boc = { F, os };
}
function bocinaPaso() {
  const o = JUG.vehiculo, V = o && o.veh, mia = !!(V && JUG.asiento === 0 && !V.roto && (ENT.bocina || (ENT.teclas.has('KeyH') && !UI.abierto)));
  if (V) { if (mia !== !!V.boc && !V.bocRed) bocinaSonar(V, mia); }
  if (mia !== BOC.mia) { BOC.mia = mia; if (RED.on && o && !o.remoto) publicar('a', { k: 'bocina', o: claveObj(o), on: mia ? 1 : 0 }); else if (RED.on && o) publicar('a', { k: 'bocina', o: o.key, on: mia ? 1 : 0 }); }
  for (const W of VEHS) {
    if (W.boc) ponerPos(W.boc.F.p, W.o.b.pos);
    if (W.bocRed && TIEMPO.t - W.bocRed > 6) { W.bocRed = 0; bocinaSonar(W, false); }   // (por si no llegó el "soltó")
    if (W.boc && W !== V && !W.bocRed) bocinaSonar(W, false);
  }
}
function bocinaRed(d) {
  const o = typeof d.o === 'string' ? buscarObjeto(d.o) : null, V = o && o.veh; if (!V) return;
  if (d.on) { V.bocRed = TIEMPO.t; bocinaSonar(V, true); } else { V.bocRed = 0; bocinaSonar(V, false); }
}
// ---------------- el cohete de la bici: fuego, humo, luz y su ruido (para todos: el estado del turbo viaja por la red) ----------------
function cohetePaso(V, dt) {
  const b = V.o.b, f = b.q.rot(v3(0, 0, 1)), t = V.tobera || (V.tobera = coheteTobera(V.o)), p = vadd(b.pos, b.q.rot(t));
  if (Math.random() < 0.9 * GFX.part + 0.1) {
    particula(p, vadd(vscale(f, -12 - Math.random() * 6), b.vel), 0.12, 0.28, [1, 0.6, 0.18, 1], 'fuego', 0.25);
    if (Math.random() < 0.5) particula(p, vadd(vscale(f, -5), vscale(b.vel, 0.85)), 1.4, 0.45, [0.6, 0.6, 0.6, 0.3], 'humo', 2.2);
  }
  luzTemporal(p, 9, [3.2, 1.7, 0.6], 0.05);
  bucle('cohete' + V.o.id, 'HR_Rocket', p, 0.7, 1);
  if (JUG.vehiculo === V.o && V.turbo) CAM.temblor = Math.max(CAM.temblor || 0, 0.06);
}
// la tobera: el nodo CoheteTobera del prefab (o la punta de atrás, arriba)
function coheteTobera(o) {
  const arb = o.md.A, i = arb.findIndex((n) => n.n === 'CoheteTobera');
  if (i >= 0) { const md = new Modelo(arb); md.p[0] = [0, 0, 0]; md.r[0] = [0, 0, 0, 1]; md.sucio = true; md.actualizar(); const W = md.W[i]; return v3(W[12] - o.c.x, W[13] - o.c.y, W[14] - o.c.z); }
  const a = o.b.aabb; return v3(0, 0.3, -(a.z1 - a.z0) * 0.5);
}
function turboRed(d) {
  const o = typeof d.o === 'string' ? buscarObjeto(d.o) : null, V = o && o.veh; if (!V) return;
  V.turboRed = d.on ? 1 : 0;
}
// ---------------- sentado de verdad: la cabina de cada auto y el cuerpo de cada personaje ----------------
// (Discord: «pies traspasando el suelo del auto», con un deportivo de un addon). Antes el cuerpo iba a una altura fija bajo
// el asiento (1 m por la escala del personaje): los grandes quedaban hundidos, los chicos flotando, y la pose de sentado
// —la de una silla: las canillas paradas, los pies 80 cm bajo la cadera— en un auto bajo dejaba las piernas abajo del
// auto. Ahora, de la malla del auto (una vez por asiento): el almohadón debajo del asiento y el piso de adelante; la
// cadera de cada personaje va sobre el almohadón y los pies al piso, con las rodillas dobladas lo que haga falta.
// (la malla del auto en su marco, en una grilla de 10 cm para preguntar qué cruza una vertical; sin las ruedas)
function vehCols(V) {
  if (V.cols) return V.cols;
  const o = V.o, inv = o.b.q.clone().conj(), sin = new Set(V.ruedas.map((w) => w.vis).filter((i) => i >= 0)), A = o.md.A, T = [];
  const deRueda = (i) => { for (let k = i; k >= 0; k = A[k].pa) if (sin.has(k)) return true; return false; };
  o.md.sucio = true; o.md.actualizar();
  for (let i = 0; i < A.length; i++) {
    const x = A[i]; if (!(x.m >= 0) || !o.md.ver[i] || /collider/i.test(x.n) || deRueda(i)) continue;
    const mc = mallaCPU(x.m); if (!mc) return null;   // (la malla todavía no llegó: se prueba otra vez)
    const W = o.md.W[i], P = mc.P, I = mc.I, L = new Float32Array(P.length), w = v3();
    for (let k = 0; k < P.length; k += 3) { m4pt(W, P[k], P[k + 1], P[k + 2], w); const l = inv.rot(vsub(w, o.b.pos)); L[k] = l.x; L[k + 1] = l.y; L[k + 2] = l.z; }
    let n = 0; for (const s of mc.d.sub) n = Math.max(n, s[0] + s[1]);
    for (let k = 0; k + 2 < n; k += 3) for (const j of [I[k], I[k + 1], I[k + 2]]) T.push(L[j * 3], L[j * 3 + 1], L[j * 3 + 2]);
  }
  const C = 0.1, G = new Map();
  for (let t = 0; t < T.length; t += 9) {
    const x0 = Math.floor(Math.min(T[t], T[t + 3], T[t + 6]) / C), x1 = Math.floor(Math.max(T[t], T[t + 3], T[t + 6]) / C), z0 = Math.floor(Math.min(T[t + 2], T[t + 5], T[t + 8]) / C), z1 = Math.floor(Math.max(T[t + 2], T[t + 5], T[t + 8]) / C);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 2500) continue;
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i * 4096 + j; let l = G.get(k); if (!l) G.set(k, (l = [])); l.push(t); }
  }
  // (las alturas de lo que cruza la vertical por x, z)
  const cortes = (x, z) => {
    const l = G.get(Math.floor(x / C) * 4096 + Math.floor(z / C)) || [], ys = [];
    for (const t of l) {
      const ax = T[t], ay = T[t + 1], az = T[t + 2], bx = T[t + 3], by = T[t + 4], bz = T[t + 5], cx = T[t + 6], cy = T[t + 7], cz = T[t + 8];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-10) continue;
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w = 1 - u - v;
      if (u >= -1e-4 && v >= -1e-4 && w >= -1e-4) ys.push(u * ay + v * by + w * cy);
    }
    return ys;
  };
  return (V.cols = { cortes, n: T.length / 9 });
}
// la cabina de un asiento (en el marco del auto): el almohadón y el piso de adelante (de 30 a 90 cm adelante: lo más alto
// que queda 12 cm o más bajo el almohadón) y hasta dónde llega ese piso (la pared de los pedales). El almohadón: en los
// autos del juego, donde ya se sentaba el Hero (su punto de asiento —SitPoint— está hecho para él: cadera 24 cm arriba,
// 10 cm sobre el almohadón); en los de los addons de GMod, el punto sale de los ojos del conductor (vehicle_driver_eyes)
// y el almohadón se mide en la malla: lo más alto debajo de ese punto (de 35 cm abajo a 25 cm arriba); si no hay malla
// ahí, los ojos menos lo que hay de los ojos a la cadera del Hero sentado (0,69 m)
function vehCabina(V, a) {
  V.cab = V.cab || []; if (V.cab[a]) return V.cab[a];
  const S = V.asientos[a], C = S && vehCols(V); if (!C) return null;
  let coj = null;
  if (/^gmveh:/.test(V.o.nombre || '')) {
    for (const [dx, dz] of [[0, 0], [0.06, 0], [-0.06, 0], [0, -0.06], [0, 0.06]]) for (const y of C.cortes(S.x + dx, S.z + dz)) if (y < S.y + 0.25 && y > S.y - 0.35 && (coj === null || y > coj)) coj = y;
    if (coj === null) coj = S.y - 0.04;
  } else coj = S.y + 0.14;
  const R = { coj, piso: null, lejos: null };
  {
    const pisos = [];
    for (let dz = 0.3; dz <= 0.901; dz += 0.05) {
      let p = null; for (const dx of [-0.12, 0, 0.12]) for (const y of C.cortes(S.x + dx, S.z + dz)) if (y < coj - 0.12 && y > coj - 1.2 && (p === null || y > p)) p = y;
      if (p === null) break;   // (adelante no hay piso: se terminó la cabina)
      pisos.push([dz, p]); R.lejos = dz;
    }
    // (el piso de los pies: lo más alto de esos —los pedales, la pared de adelante inclinada—)
    if (pisos.length) R.piso = Math.max(...pisos.map((x) => x[1]));
  }
  return (V.cab[a] = R);
}
// el cuerpo sentado: la cadera sobre el almohadón y los pies apoyados en el piso de adelante (después de ubicarPersona)
const _apF = v3(), _apU = v3();
function asientoPose(P) {
  const o = P.vehO, V = o && o.veh; if (!V || !P.sentado || V.tipo !== 'auto' || P.rag) return;
  const a = P.vehA || 0, cab = vehCabina(V, a), h = P.D.h; if (!cab || cab.coj === null || h.Hips === undefined) return;
  const md = P.md, q = o.b.q, qi = q.clone().conj(), W = md.W; md.actualizar();
  const loc = (W2) => qi.rot(vsub(v3(W2[12], W2[13], W2[14]), o.b.pos));
  // (la escala del personaje; la cadera de la pose de sentado queda 10 cm sobre el almohadón en el Hero)
  // (y si lo que la piel pega a los muslos baja de la cadera más que lo que se hunde en el asiento —20 cm en el Hero: el
  // almohadón y el hueco de abajo—, la cadera sube lo que falta: a Jake el muslo le arrastra parte de la panza y se metía
  // 33 cm abajo de la cadera, por debajo del auto)
  if (P.faldon === undefined) { const F = asientoFaldon(P, o); P.faldon = F.cadera; P.nalga = F.muslos; }
  const s = clamp(P.tam || 1, 0.3, 3), cad = loc(W[h.Hips]), dy = Math.max(cab.coj + 0.1 * s, cab.coj - 0.2 * s + (P.nalga || 0)) - cad.y;
  _apU.copy(q.rot(v3(0, 1, 0))); _apF.copy(q.rot(v3(0, 0, 1)));
  md.raiz[12] += _apU.x * dy; md.raiz[13] += _apU.y * dy; md.raiz[14] += _apU.z * dy; md.sucio = true; md.actualizar();
  // (el origen del modelo, que parado está en los pies, sentado quedaba 1 m abajo de la cadera: lo que va pegado a él —en
  // BoiledOne, una cuarta parte de la malla— salía por debajo del auto. Sube hasta el almohadón y la cadera baja lo mismo
  // en su hueso padre: el cuerpo queda igual)
  const H = P.hum, ci = H && H.ci;
  if (H && ci === h.Hips && P.D.sub[ci].pa >= 0) {
    const r0 = qi.rot(v3(md.raiz[12] - o.b.pos.x, md.raiz[13] - o.b.pos.y, md.raiz[14] - o.b.pos.z)), sube = cab.coj - r0.y;
    if (sube > 0.01) {
      md.raiz[12] += _apU.x * sube; md.raiz[13] += _apU.y * sube; md.raiz[14] += _apU.z * sube;
      // (la cadera, una vez por pose nueva: humAplicar la vuelve a poner en cada cuadro animado)
      if (H.nAp !== P.apNAp) { P.apNAp = H.nAp; const Ip = M4.inv(W[P.D.sub[ci].pa]), p = md.p[ci], dx = -_apU.x * sube, dyy = -_apU.y * sube, dz = -_apU.z * sube; p[0] += Ip[0] * dx + Ip[4] * dyy + Ip[8] * dz; p[1] += Ip[1] * dx + Ip[5] * dyy + Ip[9] * dz; p[2] += Ip[2] * dx + Ip[6] * dyy + Ip[10] * dz; }
      md.sucio = true; md.actualizar();
    }
  }
  // (lo que cuelga de la cadera —el sobretodo de BoiledOne, 1,2 m pegado entero al hueso de la cadera—: sentado, va para
  // adelante sobre las piernas como un abrigo, no para abajo atravesando el asiento y el piso. Se inclina la cadera hacia
  // adelante lo justo y la columna vuelve a como estaba: el torso no cambia)
  if (P.faldon > 0.35 * s && cab.piso !== null) {
    const hy = loc(W[h.Hips]).y, c = clamp((hy - cab.piso - 0.05) / P.faldon, 0.09, 1), th = Math.acos(c), eje = q.rot(v3(1, 0, 0));
    if (th > 0.02) { girarMundo(P, 'Hips', eje, -th); girarMundo(P, 'Spine', eje, th); md.sucio = true; md.actualizar(); }
  }
  // los pies: al piso de adelante, a lo que da la pierna (88 % estirada), sin pasar la pared de los pedales
  if (cab.piso === null) return;
  const zTope = V.asientos[a].z + (cab.lejos || 0.6) - 0.06;
  for (const [u, k, f] of [[h.LeftUpLeg, h.LeftLeg, h.LeftFoot], [h.RightUpLeg, h.RightLeg, h.RightFoot]]) {
    if (u === undefined || k === undefined || f === undefined) continue;
    const Hp = loc(W[u]), Kp = loc(W[k]), Fp = loc(W[f]), largo = Hp.distTo(Kp) + Kp.distTo(Fp), yPie = cab.piso + 0.08 * s, alto = Hp.y - yPie;
    // (si el pie ya queda arriba del piso y adentro de la cabina, como está)
    if (Fp.y >= yPie - 0.005 && Fp.z <= zTope) continue;
    const adel = Math.max(0.05, Math.min(Math.sqrt(Math.max(0, (largo * 0.88) ** 2 - alto * alto)), zTope - Hp.z));
    const T = vadd(o.b.pos, q.rot(v3(Fp.x, yPie, Hp.z + adel)));
    // (la rodilla hacia arriba y adelante; el pie, con el giro que tenía —plano en el piso—: si no, giraba con la canilla y
    // en los de pies largos, como BoiledOne, la punta atravesaba el piso casi un metro)
    ik2(P, u, k, f, T, vadd(vscale(_apU, 0.8), vscale(_apF, 0.6)), m4quat(W[f])); md.sucio = true; md.actualizar();
  }
}
// cuánto cuelga debajo de la cadera (en la pose de sentado, sobre la vertical del auto) lo que la piel pega sobre todo a la
// cadera (en una persona, ≈ 15 cm; en uno con sobretodo, el sobretodo entero) y lo que pega a los muslos
function asientoFaldon(P, o) {
  const md = P.md, ih = P.D.h.Hips, qi = o.b.q.clone().conj(); let L = 0, Lm = 0;
  try {
    md.actualizar(); const Wh = md.W[ih], hy = qi.rot(v3(Wh[12] - o.b.pos.x, Wh[13] - o.b.pos.y, Wh[14] - o.b.pos.z)).y;
    for (let i = 0; i < md.A.length; i++) {
      const x = md.A[i]; if (!x.bo || !md.ver[i]) continue; const pz = md.pieles.find((z) => z.i === i), m = mallaGL(x.m); if (!pz || !m) continue;
      const d = m.d, B = binDe(d), j = x.bo.indexOf(ih), jm = [P.D.h.LeftUpLeg, P.D.h.RightUpLeg].map((u) => (u === undefined ? -2 : x.bo.indexOf(u))); if ((j < 0 && jm[0] < 0 && jm[1] < 0) || !B) continue;
      const out = new Float32Array(d.v * 6); pielCalcular(m, pz.h, out, null);
      for (let k = 0; k < d.v; k++) {
        const q = d.sk + k * 8; let mj = 0, mw = -1; for (let c = 0; c < 4; c++) if (B[q + 4 + c] > mw) { mw = B[q + 4 + c]; mj = B[q + c]; }
        const muslo = mj === jm[0] || mj === jm[1]; if (mj !== j && !muslo) continue;
        const y = qi.rot(v3(out[k * 6] - o.b.pos.x, out[k * 6 + 1] - o.b.pos.y, out[k * 6 + 2] - o.b.pos.z)).y;
        if (muslo) { if (hy - y > Lm) Lm = hy - y; } else if (hy - y > L) L = hy - y;
      }
    }
  } catch (e) { return { cadera: 0, muslos: 0 }; }
  return { cadera: L, muslos: Lm };
}
