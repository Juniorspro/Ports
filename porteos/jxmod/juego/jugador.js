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
// el cuerpo según el alto del personaje (k: 1 = el de siempre, 1,9 m): los pies quedan donde estaban (la esfera de abajo
// no cambia) y arriba van las esferas que entren hasta la cabeza; los ojos a 1,67 m de los pies en el de siempre
JUG.esf = [[-0.5, true], [0, false], [0.5, false]]; JUG.ojoAlto = 1.67; JUG.tam = 1;
// agachado (como en GMod: el cuerpo mide la mitad —72 → 36 unidades— y los ojos van a 28 de 64): las esferas de abajo
// hasta la mitad del alto, y los ojos bien abajo (antes sólo bajaban un 19 % y el cuerpo no cambiaba: no se pasaba por
// ningún hueco bajo)
function jugadorAgEsf() {
  const J = JUG, pie = -J.medio - J.radio, tope = J.esf[J.esf.length - 1][0] + J.radio, topeAg = pie + (tope - pie) * 0.5, alto = topeAg - J.radio;
  J.esfAg = alto > -J.medio + 1e-3 ? [[-J.medio, true], [alto, false]] : [[-J.medio, true]];
  J.ojoAg = Math.min(J.ojoAlto * 0.44, topeAg - pie - 0.18);
}
jugadorAgEsf();
// (los altos, como Sunman o The Boiled One, chocan como uno de 1,9 m para pasar por las puertas: se ven más altos y los ojos
// van a su altura, salvo abajo de un techo)
function jugadorTam(k, ojo) {
  const J = JUG, tope = Math.max(-J.medio, -0.95 + 1.9 * Math.min(k, 1) - J.radio), n = Math.max(1, Math.ceil((tope + J.medio) / 0.5 - 1e-6) + 1);
  J.esf = []; for (let i = 0; i < n; i++) J.esf.push([n > 1 ? -J.medio + (tope + J.medio) * i / (n - 1) : -J.medio, i === 0]);
  J.ojoAlto = 1.67 * k * (ojo || 1); J.tam = k; jugadorAgEsf();
}
// ¿se puede parar? (agachado bajo un techo, una mesa o un ducto, se queda agachado hasta salir, como en GMod)
const _cab = v3(), _cabC = v3();
function jugadorCabeParado() {
  const J = JUG, ya = J.esfAg[J.esfAg.length - 1][0];
  for (const [dy] of J.esf) {
    if (dy <= ya + 1e-3) continue;
    _cab.set(J.pos.x, J.pos.y + dy, J.pos.z); _cabC.set(0, 0, 0);
    esferaFuera(_cab, J.radio * 0.96, _cabC, false);
    if (_cabC.len() > 0.01) return false;
  }
  return true;
}
function jugadorAparecer() {
  const s = MUNDO.spawns[(Math.random() * MUNDO.spawns.length) | 0] || v3(0, 5, 0);
  JUG.pos.set(s.x, s.y + 1.2, s.z); JUG.vel.set(0, 0, 0); JUG.vida = JUG.vidaMax || 100; JUG.vivo = true; JUG.vehiculo = null;
  if (s.yaw !== undefined) JUG.yaw = s.yaw; // puntos de aparición de un mapa de la comunidad (con su dirección)
  // (apoyado en el piso de una: la aparición de los mapas del Workshop está unos centímetros arriba, y si el modo de
  // juego congela al aparecer —la pre-ronda de Prop Hunt— quedaba flotando 0,7 m en el aire)
  if (typeof mundoRayo === 'function' && JUG.medio !== undefined) { const h = mundoRayo(v3(JUG.pos.x, JUG.pos.y - JUG.medio, JUG.pos.z), v3(0, -1, 0), 2.5); if (h && h.n.y > 0.6 && h.t > JUG.radio) { JUG.pos.y -= h.t - JUG.radio; JUG.suelo = true; } }
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
    const k = r - d;
    // (los pies sobre piso caminable se sacan sólo para arriba: empujados según la pendiente, parado en una loma te ibas
    // resbalando de a poco hacia abajo)
    if (esPie && ny > 0.6) { const kv = k / ny; c.y += kv; corr.y += kv; JUG.suelo = true; JUG.sueloN.set(nx, ny, nz); }
    else { c.x += nx * k; c.y += ny * k; c.z += nz * k; corr.x += nx * k; corr.y += ny * k; corr.z += nz * k; }
  }
  mundoCerca(c.x - r, c.y - r, c.z - r, c.x + r, c.y + r, c.z + r, _cercaJ);
  for (const b of _cercaJ) if (b.tri === undefined) empujarDeCuerpo(b, c, r, corr, esPie, false);
}
function empujarDeCuerpo(b, c, r, corr, esPie, dinamico) {
  if (b.hijos) {
    for (const h of b.hijos) {
      const a = h.aabb; if (c.x + r < a.x0 || c.x - r > a.x1 || c.y + r < a.y0 || c.y - r > a.y1 || c.z + r < a.z0 || c.z - r > a.z1) continue;
      empujarDeCuerpo(h, c, r, corr, esPie, dinamico);
    }
    return;
  }
  const B = b.padre || b;
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
    const k = 80 / (80 + B.mass);
    c.addS(n, d * (1 - k)); corr.addS(n, d * (1 - k));
    if (n.y < 0.6) { B.wake(); B.vel.addS(n, -Math.min(2, d * 30) * k); }
  } else if (esPie && n.y > 0.6) { const kv = d / n.y; c.y += kv; corr.y += kv; }   // (el pie sobre algo pisable sale para arriba, como en el piso del mapa: en la punta de un escalón de cajas resbalaba para atrás)
  else { c.addS(n, d); corr.addS(n, d); }
  if (esPie && n.y > 0.6) { JUG.suelo = true; JUG.sueloN.copy(n); JUG.pisa = B; if (dinamico) JUG.sobre = B; }
}
function jugadorPaso(dt, ent) {
  const J = JUG; if (typeof linternaPaso === 'function') linternaPaso();
  J.q.copy(Quat.euler(J.yaw, J.pitch));
  const qy = Quat.axis(0, 1, 0, J.yaw);
  if (!J.vivo) { J.muertoT -= dt; return; }
  if (J.vehiculo) return;
  // jugando una maquinita: quieto en su lugar, pegado al panel (la física lo correría: el cuerpo tiene 0,45 m de radio)
  if (J.maqFijo) { if (UI.abierto === 'maqv' && MAQ.j) { J.pos.copy(J.maqFijo); J.vel.set(0, 0, 0); J.suelo = true; return; } J.maqFijo = null; }
  // (congelado por el Lua —Player:Freeze, la pre-ronda de los modos de Fretta—: no camina ni salta, pero cae al piso)
  if (J.congelado) { ent = { x: 0, y: 0, saltar: false, agachar: false, correr: false }; J.vel.x = 0; J.vel.z = 0; }
  if (natMover(dt, ent)) return; // volar, muñeco o SCP (mods)
  if (aguaJugador(dt, ent)) return; // nadando (agua.js); vadeando, más lento
  // deseo de movimiento en el plano
  const f = qy.rot(v3(0, 0, 1)), rgt = qy.rot(v3(-1, 0, 0));
  const wish = v3(f.x * ent.y + rgt.x * ent.x, 0, f.z * ent.y + rgt.z * ent.x);
  const wl = Math.min(1, wish.len()); if (wl > 1e-3) wish.scale(1 / wish.len());
  if (ent.correr && !J.corriaAntes && J.suelo && wl > 0.2 && TIEMPO.t - (J.corrT || -9) > 2) { J.corrT = TIEMPO.t; sonar('PL_correr', null, 0.18); } J.corriaAntes = !!ent.correr;
  if (ent.agachar || J.noclip) J.agCol = !J.noclip && !!ent.agachar; else if (J.agCol && jugadorCabeParado()) J.agCol = false;
  const agachado = !!(ent.agachar || J.agCol);
  const vmax = J.vel_max * (ent.correr ? 1.35 : 1) * (agachado ? 0.5 : 1) * (J.vadeo || 1) * (patadaActiva(J.cuerpo) ? 0.35 : 1);   // (pateando, casi quieto)
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
  // (la gravedad de un mod en una sala es sólo del jugador: J.grav; negativa también: sube)
  const gJ = GRAV * MUNDO.gravedad * (J.grav || 1);
  // (también recién despegado del piso, 0,12 s: subiendo una escalera el pie toca las puntas de los escalones y no siempre
  // queda «en el piso» justo cuando se aprieta saltar)
  if (ent.saltar && ((J.suelo && J.tiempoSuelo > 0.05) || (!J.suelo && (J.tAire || 0) < 0.12 && TIEMPO.t - (J.saltoT || -9) > 0.4 && J.vel.y < 1))) { J.vel.y = Math.sqrt(2 * Math.abs(gJ) * J.salto) * (gJ < 0 ? -1 : 1); J.suelo = false; J.tiempoSuelo = 0; J.saltoT = TIEMPO.t; if (J.cuerpo) sonPaso(J.cuerpo, true, J.pos, 0.75); }   // (al saltar suena el paso, como en HL2)
  if (!J.suelo) J.vel.y -= gJ * dt; else if (J.vel.y < 0) J.vel.y = -0.5;
  const vyAntes = J.vel.y, eraSuelo = J.suelo;
  _esc0.copy(J.pos); _esc1.copy(J.vel);
  jugadorMoverChocar(dt);
  // (también apenas despegado del piso: apoyado en la punta de un escalón el pie no cuenta como piso y quedaba trabado)
  if (!ent.saltar && (eraSuelo || ((J.tAire || 0) < 0.25 && J.vel.y < 1))) jugadorEscalon(dt, _esc0, _esc1, tx, tz);
  // (caminando —sin haber saltado—, chocar con la punta de un escalón o de una caja no lanza para arriba: el choque
  // convertía parte de la velocidad hacia adelante en velocidad hacia arriba y en una escalera se iba a los saltitos, casi
  // sin pisar, y por eso no se podía saltar. Arriba sólo lo que suba lo que pisa —un ascensor—)
  if (!ent.saltar && TIEMPO.t - (J.saltoT || -9) > 0.35 && (eraSuelo || (J.tAire || 0) < 0.25) && gJ > 0) { const vb = base ? Math.max(0, base.y) : 0; if (J.vel.y > vb) J.vel.y = vb; }
  J.tAire = J.suelo ? 0 : (J.tAire || 0) + dt;
  // cama elástica: al pisarla rebota (más alto si venía cayendo o si salta justo; agachado frena)
  const ce = J.suelo && J.pisa && J.pisa.obj;
  if (ce && ce.salta && !ent.agachar && J.sueloN.y > 0.8) {
    J.vel.y = clamp(-vyAntes * 0.9, 7.5, 24) + (ent.saltar ? 3.5 : 0); J.suelo = false; J.tiempoSuelo = 0;
    if (vyAntes < -2) { sonarResorte(J.pos, Math.min(1, -vyAntes / 14)); J.pisa.wake && J.pisa.wake(); }
    return;
  }
  // pegarse al piso al bajar rampas (si estaba en el piso y no saltó)
  if (!J.suelo && eraSuelo && J.vel.y <= 0) {
    const h = mundoRayo(v3(J.pos.x, J.pos.y - J.medio, J.pos.z), v3(0, -1, 0), J.radio + 0.35);
    if (h && h.n.y > 0.6) {
      J.pos.y -= h.t - J.radio; J.suelo = true; J.vel.y = -0.5;
      // (el rayo mira sólo el mapa: al bajar del borde de una caja suelta, el pie quedaba 20 cm metido en ella durante un
      // cuadro y después salía de golpe. Ahora se saca enseguida de lo que haya tocado al bajar)
      jugadorMoverChocar(0); J.suelo = true;
    }
  }
  if (J.suelo) { J.tiempoSuelo += dt; if (wl < 0.01 && !base) { const k = Math.exp(-dt * 12); J.vel.x *= k; J.vel.z *= k; } } else J.tiempoSuelo = 0;
  // cámara: golpe al caer (según la velocidad de caída) y balanceo de la cabeza al caminar
  if (!eraSuelo && J.suelo && vyAntes < -3) {
    J.caidaV = Math.max(J.caidaV || 0, Math.min(3, -vyAntes * 0.36)); if (vyAntes < -7) CAM.temblor = Math.max(CAM.temblor, 0.25);
    // (el golpe sordo del cuerpo al caer; de muy alto, también el quejido de la caída de HL2)
    if (vyAntes < -6) sonar('PL_golpe' + (1 + ((Math.random() * 3) | 0)), null, Math.min(0.8, -vyAntes / 18));
    if (vyAntes < -11) sonar('PL_caida' + (1 + ((Math.random() * 2) | 0)), null, 0.7);
  }
  const vh = Math.hypot(J.vel.x, J.vel.z);
  if (J.suelo) J.bob = (J.bob || 0) + vh * dt * 1.75;
  J.bobK = (J.bobK || 0) + ((J.suelo ? Math.min(1, vh / 6) : 0) - (J.bobK || 0)) * Math.min(1, dt * 8);
  J.agK = (J.agK || 0) + ((agachado ? 1 : 0) - (J.agK || 0)) * Math.min(1, dt * 12);
  if (J.pos.y < MUNDO.lo.y - 60) jugadorAparecer();
}
// subir un escalón (como Source: StepSize 18 unidades, ~0,45 m acá). Las esferas solas trepan un borde bajo, pero uno de
// escalera común (8–16 unidades) las frenaba casi de golpe: subir costaba muchísimo y en el borde de cada escalón el pie
// no quedaba apoyado (no saltaba). Si el paso normal avanzó menos del 92 % de lo que quería: se prueba subir, avanzar y
// bajar; si así avanza más y queda parado en piso caminable, vale ese
const _esc0 = v3(), _esc1 = v3(), _escP = v3(), _escV = v3(), _escN = v3();
function jugadorEscalon(dt, p0, v0, tx, tz) {
  // (lo que el jugador quiere llevar, como Source: contra el escalón la velocidad de verdad ya quedó en casi cero)
  const J = JUG, vx = Math.hypot(tx, tz) > Math.hypot(v0.x, v0.z) ? tx : v0.x, vz = Math.hypot(tx, tz) > Math.hypot(v0.x, v0.z) ? tz : v0.z;
  const quiero = Math.hypot(vx, vz) * dt; if (quiero < 1e-4 || J.vehiculo || J.noclip) return;
  const hecho = Math.hypot(J.pos.x - p0.x, J.pos.z - p0.z); if (hecho > quiero * 0.92) return;
  _escP.copy(J.pos); _escV.copy(J.vel); _escN.copy(J.sueloN); const A = { suelo: J.suelo, sobre: J.sobre, pisa: J.pisa };
  const ESC = 0.45 * Math.max(0.6, Math.min(1, J.tam || 1));
  J.pos.copy(p0); J.vel.set(0, ESC / dt, 0); jugadorMoverChocar(dt);
  const subio = J.pos.y - p0.y;
  let vale = subio > 0.04;
  if (vale) {
    J.vel.set(vx, 0, vz); jugadorMoverChocar(dt);
    // (la bajada en pasitos de 4 cm: de a 17 el pie atravesaba la punta del escalón y lo empujaba para atrás)
    J.vel.set(0, -(subio + 0.06) / dt, 0); jugadorMoverChocar(dt, 0.04);
    const avance = Math.hypot(J.pos.x - p0.x, J.pos.z - p0.z), dh = J.pos.y - p0.y;
    // (apoyado arriba, aunque sea en la punta del escalón: el cuadro siguiente termina de subir)
    vale = J.suelo && avance > hecho + quiero * 0.08 && dh > -0.02 && dh < ESC + 0.02;
    if (vale) { J.vel.set(vx, -0.5, vz); J.ojoEsc = (J.ojoEsc || 0) + Math.max(0, dh); return; }
  }
  J.pos.copy(_escP); J.vel.copy(_escV); J.sueloN.copy(_escN); J.suelo = A.suelo; J.sobre = A.sobre; J.pisa = A.pisa;
}
// moverse en pasos chicos y sacar la cápsula de lo que toque (también lo usa volar)
function jugadorMoverChocar(dt, tramo) {
  const J = JUG, pasos = Math.max(1, Math.ceil(J.vel.len() * dt / (tramo || 0.25)));
  J.suelo = false; J.sobre = null; J.pisa = null;
  for (let s = 0; s < pasos; s++) {
    J.pos.addS(J.vel, dt / pasos);
    for (let it = 0; it < 2; it++) {
      const corr = _pn.set(0, 0, 0);
      for (const [dy, pie] of (J.agCol && J.esfAg ? J.esfAg : J.esf)) {
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
}
const _ojoT = v3(0, 0, 0), _ojoArr = v3(0, 1, 0), _ojoAdelante = [0, 0.2, 0.35, 0.5];
// ubica la cámara (primera o tercera persona) y devuelve su posición y rotación
function jugadorCamara(out) {
  const J = JUG;
  if (J.vehiculo) return vehiculoCamara(J.vehiculo, out);
  // agacharse suave, hundida al caer (resorte amortiguado) y balanceo al caminar
  const dt = TIEMPO.dt || 0.016;
  J.caidaV = J.caidaV || 0; J.caidaP = J.caidaP || 0;
  J.caidaV += (-J.caidaP * 90 - J.caidaV * 13) * dt; J.caidaP += J.caidaV * dt;
  const ag = J.noclip ? 0 : (J.agK || 0), bob = J.bobK || 0, ph = J.bob || 0;
  const dy = -J.caidaP * 0.45 + Math.abs(Math.sin(ph)) * 0.035 * bob - 0.015 * bob;
  if (NAT.scp && J.vivo) J.ojoPos.copy(J.pos).addS(NAT.up, 0.5); // SCP: los ojos cerca del piso que pisa
  else {
    // (agachado: los ojos a la altura de agachado de GMod; al subir un escalón, la cámara lo sigue en 0,1 s en vez de saltar)
    J.ojoEsc = (J.ojoEsc || 0) * Math.exp(-dt * 10);   // (~0,1 s, como cl_smoothtime de Source)
    let oy = J.pos.y - 0.95 + J.ojoAlto + ((J.ojoAg || J.ojoAlto * 0.44) - J.ojoAlto) * ag + dy - J.ojoEsc;
    // un alto bajo un techo (una puerta, la pizzería): los ojos bajan hasta quedar debajo, sin saltos
    // (se mira arriba donde está y donde va a estar en 0,2, 0,35 y 0,5 s, así baja antes de llegar, y lo que bajó se mantiene
    // 0,6 s para no volver a subir entre que el punto de adelante pasó la viga y uno llega abajo: a lo sumo 2 m/s, sin saltos)
    let baja = 0;
    if (J.tam > 1 && !J.noclip) {
      const b = J.pos.y - 0.95 + 1.75;
      if (oy + 0.2 > b) for (const k of _ojoAdelante) {
        _ojoT.set(J.pos.x + J.vel.x * k, b, J.pos.z + J.vel.z * k);
        const h = raycast(_ojoT, _ojoArr, oy + 0.2 - b, null); if (h) baja = Math.max(baja, oy - (b + h.t - 0.25));   // (el mapa y los objetos)
      }
      const t = TIEMPO.t || 0, m = J.ojoMem || (J.ojoMem = { v: 0, t: -9 });
      if (baja >= m.v || t - m.t > 0.6) { m.v = baja; m.t = t; } else baja = m.v;
    }
    const db = baja - (J.ojoBaja || 0), vmax = (db > 0 ? 2 : 1.2) * dt;
    J.ojoBaja = (J.ojoBaja || 0) + clamp(db * Math.min(1, dt * 12), -vmax, vmax);
    J.ojoPos.set(J.pos.x, oy - J.ojoBaja, J.pos.z);
    // haciendo un emote en primera persona: los ojos van con la cabeza del cuerpo (un poco adelante de la cara), así se ve
    // el cuerpo desde afuera y no por dentro del cuello cuando el emote inclina la cabeza
    const P = J.cuerpo, em = P && P.emote && P.emote !== 'Patada' && typeof cuerpoEnPrimera === 'function' && cuerpoEnPrimera(P);
    J.ojoEmK = (J.ojoEmK || 0) + ((em ? 1 : 0) - (J.ojoEmK || 0)) * Math.min(1, dt * 8);
    // (los emotes que bajan la cabeza al piso —breakdance, rodar, acostarse—: la cabeza no sirve de ojos, la cámara se
    // metía debajo del suelo y se veía el cielo; mientras la cabeza está a más de 0,6 m por debajo de los ojos parado, la
    // cámara pasa sola a tercera persona y vuelve al levantarse; y los ojos nunca atraviesan el piso ni una pared)
    J.ojoParado = J.ojoParado || v3(0, 0, 0); J.ojoParado.copy(J.ojoPos);
    let em3 = 0;
    if (J.ojoEmK > 0.001 && P && P.D.h.Head !== undefined) {
      const W = P.md.W[P.D.h.Head], f = v3(Math.sin(J.yaw), 0, Math.cos(J.yaw)), t = P.tam || 1;
      const cx = W[12] + f.x * 0.16 * t, cy = W[13] + 0.06 * t, cz = W[14] + f.z * 0.16 * t, k = J.ojoEmK;
      const baja = J.ojoParado.y - cy; em3 = em ? (baja > 0.6 * t ? 1 : baja < 0.35 * t ? 0 : (J.emo3Meta || 0)) : 0;
      J.ojoPos.set(J.ojoPos.x + (cx - J.ojoPos.x) * k, J.ojoPos.y + (cy - J.ojoPos.y) * k, J.ojoPos.z + (cz - J.ojoPos.z) * k);
      const d = vsub(J.ojoPos, J.ojoParado), L = d.len();
      if (L > 0.02) { const h = mundoRayo(J.ojoParado, vscale(d, 1 / L), L + 0.2); if (h && h.t < L + 0.2) J.ojoPos.copy(J.ojoParado).addS(vscale(d, 1 / L), Math.max(0, h.t - 0.2)); }
    }
    J.emo3Meta = em3; J.emo3K = (J.emo3K || 0) + (em3 - (J.emo3K || 0)) * Math.min(1, dt * 5);
  }
  J.q.copy(Quat.euler(J.yaw, J.pitch, Math.sin(ph) * 0.006 * bob));
  J.adelante.copy(J.q.rot(v3(0, 0, 1)));
  out.q.copy(J.q);
  if (J.tercera || !J.vivo) {
    const atras = vscale(J.adelante, -3.1 * clamp(0.45 + 0.55 * J.tam, 0.6, 1)), d = atras.len(), dir = vscale(atras, 1 / d);   // (más cerca de los bajitos)
    const h = mundoRayo(J.ojoPos, dir, d + 0.3), L = h ? Math.max(0.3, h.t - 0.3) : d;
    out.pos.copy(J.ojoPos).addS(dir, L);
  } else if ((J.emo3K || 0) > 0.001 && J.ojoParado) {
    // (el emote de piso en tercera persona: desde atrás, a la altura de los ojos parado, mezclado con la vista de la cabeza)
    const atras = vscale(J.adelante, -3.1 * clamp(0.45 + 0.55 * J.tam, 0.6, 1)), d = atras.len(), dir = vscale(atras, 1 / d);
    const h = mundoRayo(J.ojoParado, dir, d + 0.3), L = h ? Math.max(0.3, h.t - 0.3) : d, k = ss01(J.emo3K);
    const x = J.ojoParado.x + dir.x * L, y = J.ojoParado.y + dir.y * L, z = J.ojoParado.z + dir.z * L;
    out.pos.set(J.ojoPos.x + (x - J.ojoPos.x) * k, J.ojoPos.y + (y - J.ojoPos.y) * k, J.ojoPos.z + (z - J.ojoPos.z) * k);
  } else out.pos.copy(J.ojoPos);
  return out;
}
