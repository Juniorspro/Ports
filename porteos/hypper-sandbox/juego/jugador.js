// ---------------------------------------------------------------------------------------------------------
// el jugador: cápsula de 2 m (como en el juego: radio 0,5, ojos a 0,72 sobre el centro), camina a 6 m/s,
// salta 1,1 m. Choca con el mapa (triángulos y cajas) y empuja los objetos. Primera y tercera persona.
// La "adelante" del jugador es +Z (como en el juego); la cámara mira con un giro de media vuelta.
// ---------------------------------------------------------------------------------------------------------
const JUG = { pos: v3(0, 5, 0), vel: v3(), yaw: 0, pitch: 0, suelo: false, sueloN: v3(0, 1, 0), radio: 0.45, medio: 0.5, ojo: 0.72,
  vida: 100, vivo: true, tercera: false, vel_max: 6, acel: 18, salto: 1.1, q: new Quat(), qv: new Quat(), ojoPos: v3(), adelante: v3(0, 0, 1),
  vehiculo: null, tiempoSuelo: 0, sobre: null, muertoT: 0, camPos: v3(), noclip: false };
const _p1 = v3(), _p2 = v3(), _pn = v3(), _trisJ = [], _cercaJ = [];
const MEDIA_VUELTA = Quat.axis(0, 1, 0, Math.PI);
function jugadorAparecer() {
  const s = MUNDO.spawns[(Math.random() * MUNDO.spawns.length) | 0] || v3(0, 5, 0);
  JUG.pos.set(s.x, s.y + 1.2, s.z); JUG.vel.set(0, 0, 0); JUG.vida = 100; JUG.vivo = true; JUG.vehiculo = null;
}
// empuja una esfera (centro c, radio r) fuera del mundo; devuelve la corrección y anota el piso
function esferaFuera(c, r, corr, esPie) {
  trisCerca(c.x - r, c.z - r, c.x + r, c.z + r, _trisJ);
  for (const t of _trisJ) {
    triCercano(t, c.x, c.y, c.z, _p1);
    const dx = c.x - _p1.x, dy = c.y - _p1.y, dz = c.z - _p1.z, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= r * r) continue;
    const d = Math.sqrt(d2);
    let nx, ny, nz;
    if (d > 1e-6) { nx = dx / d; ny = dy / d; nz = dz / d; } else { nx = MUNDO.TN[t * 3]; ny = MUNDO.TN[t * 3 + 1]; nz = MUNDO.TN[t * 3 + 2]; }
    const k = r - d; c.x += nx * k; c.y += ny * k; c.z += nz * k; corr.x += nx * k; corr.y += ny * k; corr.z += nz * k;
    if (esPie && ny > 0.6) { JUG.suelo = true; JUG.sueloN.set(nx, ny, nz); }
  }
  mundoCerca(c.x - r, c.y - r, c.z - r, c.x + r, c.y + r, c.z + r, _cercaJ);
  for (const b of _cercaJ) if (b.tri === undefined) empujarDeCuerpo(b, c, r, corr, esPie, false);
}
function empujarDeCuerpo(b, c, r, corr, esPie, dinamico) {
  let q, n, d;
  if (b.shape.type === 'hull') {
    const h = hullClosest(b, c);
    if (h.inside) { n = h.n; d = -h.d + r; q = h.p; }
    else { const dx = c.x - h.p.x, dy = c.y - h.p.y, dz = c.z - h.p.z, L = Math.hypot(dx, dy, dz); if (L >= r || L < 1e-6) return; n = v3(dx / L, dy / L, dz / L); d = r - L; }
  } else {
    const ps = b.shape.type === 'sphere' ? [b.pos] : capSpheres(b); let best = null;
    for (const p of ps) { const L = vsub(c, p).len(); if (!best || L < best.L) best = { p, L }; }
    const rr = b.shape.r + r; if (best.L >= rr || best.L < 1e-6) return;
    n = vsub(c, best.p).scale(1 / best.L); d = rr - best.L;
  }
  if (dinamico) {
    // el objeto también se corre según su masa (un auto casi no, una caja sí)
    const k = 80 / (80 + b.mass);
    c.addS(n, d * (1 - k)); corr.addS(n, d * (1 - k));
    if (n.y < 0.6) { b.wake(); b.vel.addS(n, -Math.min(2, d * 30) * k); }
  } else { c.addS(n, d); corr.addS(n, d); }
  if (esPie && n.y > 0.6) { JUG.suelo = true; JUG.sueloN.copy(n); if (dinamico) JUG.sobre = b; }
}
function jugadorPaso(dt, ent) {
  const J = JUG;
  J.q.copy(Quat.euler(J.yaw, J.pitch));
  const qy = Quat.axis(0, 1, 0, J.yaw);
  if (!J.vivo) { J.muertoT -= dt; return; }
  if (J.vehiculo) return;
  // deseo de movimiento en el plano
  const f = qy.rot(v3(0, 0, 1)), rgt = qy.rot(v3(-1, 0, 0));
  const wish = v3(f.x * ent.y + rgt.x * ent.x, 0, f.z * ent.y + rgt.z * ent.x);
  const wl = Math.min(1, wish.len()); if (wl > 1e-3) wish.scale(1 / wish.len());
  const vmax = J.vel_max * (ent.correr ? 1.35 : 1) * (ent.agachar ? 0.5 : 1);
  if (J.noclip) {
    const fv = J.q.rot(v3(0, 0, 1));
    J.vel.set((fv.x * ent.y + rgt.x * ent.x) * vmax * 2, (fv.y * ent.y + (ent.saltar ? 1 : 0) - (ent.agachar ? 1 : 0)) * vmax * 2, (fv.z * ent.y + rgt.z * ent.x) * vmax * 2);
    J.pos.addS(J.vel, dt); return;
  }
  const acel = J.suelo ? J.acel : J.acel * 0.35;
  const tx = wish.x * vmax * wl, tz = wish.z * vmax * wl;
  let base = J.sobre && J.suelo ? J.sobre.vel : null;
  const rvx = J.vel.x - (base ? base.x : 0), rvz = J.vel.z - (base ? base.z : 0);
  const dvx = tx - rvx, dvz = tz - rvz, dl = Math.hypot(dvx, dvz), mx = acel * dt * (J.suelo || wl > 0 ? 1 : 0.2);
  if (dl > 0) { const k = Math.min(1, mx / dl); J.vel.x += dvx * k; J.vel.z += dvz * k; }
  if (J.suelo && ent.saltar && J.tiempoSuelo > 0.05) { J.vel.y = Math.sqrt(2 * GRAV * MUNDO.gravedad * J.salto); J.suelo = false; J.tiempoSuelo = 0; }
  if (!J.suelo) J.vel.y -= GRAV * MUNDO.gravedad * dt; else if (J.vel.y < 0) J.vel.y = -0.5;
  // moverse en pasos chicos y sacar la cápsula de lo que pise
  const pasos = Math.max(1, Math.ceil(J.vel.len() * dt / 0.25));
  const eraSuelo = J.suelo; J.suelo = false; J.sobre = null;
  for (let s = 0; s < pasos; s++) {
    J.pos.addS(J.vel, dt / pasos);
    for (let it = 0; it < 2; it++) {
      const corr = _pn.set(0, 0, 0);
      for (const [dy, pie] of [[-J.medio, true], [0, false], [J.medio, false]]) {
        _p2.set(J.pos.x, J.pos.y + dy, J.pos.z);
        esferaFuera(_p2, J.radio, corr, pie);
        // objetos sueltos
        for (const b of PH.bodies) {
          if (b.noJug || b.held || b === J.vehiculoCuerpo) continue;
          const a = b.aabb; if (_p2.x + J.radio < a.x0 || _p2.x - J.radio > a.x1 || _p2.y + J.radio < a.y0 || _p2.y - J.radio > a.y1 || _p2.z + J.radio < a.z0 || _p2.z - J.radio > a.z1) continue;
          empujarDeCuerpo(b, _p2, J.radio, corr, pie, b.dynamic);
        }
        J.pos.set(_p2.x, _p2.y - dy, _p2.z);
      }
      // quitar la velocidad que va contra lo que chocó
      const cl = corr.len();
      if (cl > 1e-5) { const n = corr.scale(1 / cl), vn = vdot(J.vel, n); if (vn < 0) J.vel.addS(n, -vn); } else break;
    }
  }
  // pegarse al piso al bajar rampas (si estaba en el piso y no saltó)
  if (!J.suelo && eraSuelo && J.vel.y <= 0) {
    const h = mundoRayo(v3(J.pos.x, J.pos.y - J.medio, J.pos.z), v3(0, -1, 0), J.radio + 0.35);
    if (h && h.n.y > 0.6) { J.pos.y -= h.t - J.radio; J.suelo = true; J.vel.y = -0.5; }
  }
  if (J.suelo) { J.tiempoSuelo += dt; if (wl < 0.01 && !base) { const k = Math.exp(-dt * 12); J.vel.x *= k; J.vel.z *= k; } } else J.tiempoSuelo = 0;
  if (J.pos.y < MUNDO.lo.y - 60) jugadorAparecer();
}
// ubica la cámara (primera o tercera persona) y devuelve su posición y rotación
function jugadorCamara(out) {
  const J = JUG;
  if (J.vehiculo) return vehiculoCamara(J.vehiculo, out);
  J.ojoPos.set(J.pos.x, J.pos.y + J.ojo * (ENT.agachar && !J.noclip ? 0.55 : 1), J.pos.z);
  J.q.copy(Quat.euler(J.yaw, J.pitch));
  J.adelante.copy(J.q.rot(v3(0, 0, 1)));
  out.q.copy(J.q);
  if (J.tercera || !J.vivo) {
    const atras = vscale(J.adelante, -3.1), d = atras.len(), dir = vscale(atras, 1 / d);
    const h = mundoRayo(J.ojoPos, dir, d + 0.3), L = h ? Math.max(0.3, h.t - 0.3) : d;
    out.pos.copy(J.ojoPos).addS(dir, L);
  } else out.pos.copy(J.ojoPos);
  return out;
}
