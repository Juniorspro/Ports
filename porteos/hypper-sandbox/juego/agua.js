// ---------------------------------------------------------------------------------------------------------
// agua: los volúmenes (los de los mapas y lo que tienen adentro los recipientes: cubeta, bañeras, pileta), lo que
// flota, nadar, la vista y el sonido debajo del agua, los chapoteos, el chorro de un recipiente que se vuelca y los
// charcos que deja (una grilla de agua poco profunda que corre hacia lo bajo), y el reflejo del agua en Alto y Ultra.
// Barato a propósito: los volúmenes son cajas (giradas sólo alrededor de la vertical), el empuje se calcula con unos
// pocos puntos por cuerpo una vez por paso de física, las gotas son pocas y los charcos, grillas chicas que se secan.
// ---------------------------------------------------------------------------------------------------------
const AGUA = { vols: [], gotas: [], charcos: [], bajo: false, camVol: null, t: 0, mat: -1, quad: null, disco: null, rt: null, refOn: false, gotaT: 0, cola: [] };
const AGUA_RHO = 1000;
const _a1 = v3(), _a2 = v3(), _a3 = v3(), _a4 = v3();

// ---------------- volúmenes ----------------
// un volumen: el pie (centro cx, cz; medio ancho hx, hz; girado: ca, sa = coseno y seno del eje x), el fondo y0 y el
// agua hasta y1. Los de un recipiente (rec: el objeto) se recalculan en cada paso
function aguaVolumen(o) { const v = Object.assign({ cx: 0, cz: 0, hx: 1, hz: 1, ca: 1, sa: 0, y0: 0, y1: 0 }, o); aguaCaja(v); AGUA.vols.push(v); return v; }
// la caja alineada que envuelve el pie (para descartar rápido)
function aguaCaja(v) {
  const ex = Math.abs(v.hx * v.ca) + Math.abs(v.hz * v.sa), ez = Math.abs(v.hx * v.sa) + Math.abs(v.hz * v.ca);
  v.ax0 = v.cx - ex; v.ax1 = v.cx + ex; v.az0 = v.cz - ez; v.az1 = v.cz + ez;
}
// los volúmenes del mapa (de gmod.py: cajas lo-hi con el agua hasta arriba)
function aguaMapa(lista) {
  AGUA.vols.length = 0; AGUA.gotas.length = 0; AGUA.bajo = false; AGUA.camVol = null;
  for (const c of AGUA.charcos) aguaCharcoLiberar(c); AGUA.charcos.length = 0;
  for (const a of lista || []) aguaVolumen({ cx: (a.lo[0] + a.hi[0]) / 2, cz: (a.lo[2] + a.hi[2]) / 2, hx: (a.hi[0] - a.lo[0]) / 2, hz: (a.hi[2] - a.lo[2]) / 2, y0: a.lo[1], y1: a.hi[1], mapa: true });
}
const aguaPisa = (v, x, z) => {
  if (x < v.ax0 || x > v.ax1 || z < v.az0 || z > v.az1) return false;
  const dx = x - v.cx, dz = z - v.cz;
  return Math.abs(dx * v.ca + dz * v.sa) <= v.hx && Math.abs(dz * v.ca - dx * v.sa) <= v.hz;
};
// el volumen con agua en (x, y, z), o hasta "arriba" metros por encima de su superficie; "salvo": uno que no cuenta
function aguaEn(x, y, z, arriba, salvo) {
  const A = AGUA.vols;
  for (let i = 0; i < A.length; i++) {
    const v = A[i];
    if (v === salvo || v.y1 <= v.y0 + 0.002 || y < v.y0 - 0.02 || y > v.y1 + (arriba || 0)) continue;
    if (aguaPisa(v, x, z)) return v;
  }
  return null;
}

// ---------------- recipientes (la cubeta, las bañeras, la pileta) ----------------
// el prefab trae el interior (una caja en su marco: lo, hi), cuánto entra (l, litros) y si es redondo (r)
function aguaRecipiente(o, r) {
  o.rec = { lo: v3(r.lo[0], r.lo[1], r.lo[2]), hi: v3(r.hi[0], r.hi[1], r.hi[2]), cap: r.l, l: 0, redondo: !!r.r, masa0: o.b.mass, vol: null, gotas: 0, chorroT: 0, boca: v3(), sale: 0 };
  o.rec.vol = aguaVolumen({ rec: o, y0: 0, y1: 0, redondo: !!r.r });
}
const BOCA_R = [[1, 0], [0.707, 0.707], [0, 1], [-0.707, 0.707], [-1, 0], [-0.707, -0.707], [0, -1], [0.707, -0.707]];
const BOCA_C = [[1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0]];
function aguaRecipientesPaso(dt) {
  const A = AGUA.vols;
  for (let i = A.length - 1; i >= 0; i--) {
    const v = A[i]; if (!v.rec) continue;
    const o = v.rec, R = o.rec, b = o.b;
    if (o.borrado) { A.splice(i, 1); continue; }
    const q = b.q, lo = R.lo, hi = R.hi, cx = (lo.x + hi.x) / 2 - o.c.x, cz = (lo.z + hi.z) / 2 - o.c.z, hx = (hi.x - lo.x) / 2, hz = (hi.z - lo.z) / 2;
    const area = (R.redondo ? Math.PI : 4) * hx * hz, up = q.rotTo(_a1.set(0, 1, 0), _a1).y, ex = q.rotTo(_a2.set(1, 0, 0), _a2), exx = ex.x, exz = ex.z;
    const fondo = q.rotTo(_a3.set(cx, lo.y - o.c.y, cz), _a3).add(b.pos);   // (el centro del fondo de adentro)
    // la boca: el punto más bajo del borde (con la cubeta inclinada, por ahí se vuelca)
    let boca = 1e9; const B = R.redondo ? BOCA_R : BOCA_C;
    for (const [sx, sz] of B) { const p = q.rotTo(_a4.set(cx + sx * hx, hi.y - o.c.y, cz + sz * hz), _a4).add(b.pos); if (p.y < boca) { boca = p.y; R.boca.copy(p); } }
    const nivel = fondo.y + R.l / 1000 / area;
    // se vuelca: lo que pasa la boca sale por ahí (dada vuelta se vacía en un segundo)
    let sale = 0;
    if (R.l > 0) {
      if (up < 0.2) sale = Math.min(R.l, dt * R.cap * (1.2 - up));
      else if (nivel > boca) sale = Math.min(R.l, (nivel - boca) * area * 1000, dt * Math.max(8, R.cap * 1.5));
    }
    if (sale > 1e-4) { R.l -= sale; aguaChorro(o, sale, up); }
    // se llena: metida en otra agua (el lago, la bañera) sube hasta el nivel de afuera, o hasta la boca
    const afuera = up > 0.3 ? aguaEn(fondo.x, fondo.y + 0.01, fondo.z, 0, v) : null;
    if (afuera) { const meta = Math.min(R.cap, Math.max(0, Math.min(afuera.y1, boca) - fondo.y) * area * 1000); if (meta > R.l) R.l = Math.min(meta, R.l + dt * Math.max(25, R.cap * 0.6)); }
    R.l = clamp(R.l, 0, R.cap);
    // el agua que tiene adentro (para lo que flota en la bañera, las gotas que caen y el dibujo)
    const L = Math.hypot(exx, exz) || 1, y1 = R.l > 0.02 && up > 0.3 ? Math.min(fondo.y + R.l / 1000 / area, boca) : fondo.y;
    if (Math.abs(y1 - v.y1) > 0.004) aguaDespertar(v);
    v.cx = fondo.x; v.cz = fondo.z; v.ca = exx / L; v.sa = exz / L; v.hx = hx * 0.95; v.hz = hz * 0.95; v.y0 = fondo.y; v.y1 = y1; v.boca = boca; v.up = up; aguaCaja(v);
    // el agua pesa (y la inercia sube con la masa)
    const m = R.masa0 + R.l; if (Math.abs(m - b.mass) > 0.05) { const k = b.mass / m; b.mass = m; b.invMass = 1 / m; b.invI.scale(k); }
  }
}
// despierta lo que toca un volumen que cambió de nivel (lo dormido no se mueve solo)
function aguaDespertar(v) {
  for (const b of PH.bodies) { if (!b.sleep) continue; const a = b.aabb; if (a.x1 < v.ax0 || a.x0 > v.ax1 || a.z1 < v.az0 || a.z0 > v.az1 || a.y0 > Math.max(v.y1, v.boca || v.y1) + 0.1 || a.y1 < v.y0) continue; b.wake(); }
}
// el chorro: gotas desde la boca, con la velocidad del recipiente y un poco hacia afuera
function aguaChorro(o, litros, up) {
  const R = o.rec, b = o.b, p = R.boca, c = b.pos;
  const dx = p.x - c.x, dz = p.z - c.z, L = Math.hypot(dx, dz) || 1, k = clamp(1 - up, 0.2, 1.2) * 1.1;
  R.gotas += litros; R.chorroT = 0.25; R.sale = litros;
  // de a 0,12 l por gota (más cargadas si ya hay muchas)
  const porGota = AGUA.gotas.length > 160 ? 0.5 : 0.12;
  while (R.gotas >= porGota) {
    R.gotas -= porGota;
    // (un poco afuera del borde y arriba: dada vuelta, la boca toca el piso y la gota no tiene que nacer adentro de él)
    aguaGota(_a1.set(p.x + dx / L * 0.04 + (Math.random() - 0.5) * 0.04, p.y + 0.04, p.z + dz / L * 0.04 + (Math.random() - 0.5) * 0.04),
      _a2.set(b.vel.x + dx / L * k + (Math.random() - 0.5) * 0.15, b.vel.y + (Math.random() - 0.5) * 0.15, b.vel.z + dz / L * k + (Math.random() - 0.5) * 0.15), porGota, b);
  }
}
// el recipiente cuyo interior (de la boca para abajo) tiene al punto: ahí caen las gotas aunque esté vacío
function aguaRecipienteEn(x, y, z) {
  for (const v of AGUA.vols) { if (!v.rec || v.up < 0.5 || y > v.boca + 0.02 || y < v.y0 - 0.05) continue; if (aguaPisa(v, x, z)) return v; }
  return null;
}

// ---------------- lo que flota ----------------
function formaVolumen(sh) {
  if (sh.type === 'sphere') return 4.18879 * sh.r * sh.r * sh.r;
  if (sh.type === 'capsule') return Math.PI * sh.r * sh.r * 2 * sh.hh + 4.18879 * sh.r * sh.r * sh.r;
  if (sh.type === 'compound') { let s = 0; for (const pt of sh.partes) s += formaVolumen(pt.shape); return s; }
  // casco: tetraedros desde el centro, cara por cara (en abanico)
  let V = 0; const P = sh.v;
  for (const f of sh.f) { const a = P[f.ix[0]]; for (let k = 1; k + 1 < f.ix.length; k++) V += vdot(a, vcross(P[f.ix[k]], P[f.ix[k + 1]])) / 6; }
  return Math.max(1e-4, Math.abs(V));
}
function dentroForma(sh, p) {
  if (sh.type === 'sphere') return p.lenSq() <= sh.r * sh.r;
  if (sh.type === 'capsule') { const y = clamp(p.y, -sh.hh, sh.hh); return p.x * p.x + (p.y - y) * (p.y - y) + p.z * p.z <= sh.r * sh.r; }
  if (sh.type === 'compound') { for (const pt of sh.partes) if (dentroForma(pt.shape, pt.q.conj().rot(vsub(p, pt.p)))) return true; return false; }
  for (const f of sh.f) if (vdot(f.n, p) - f.d > 1e-6) return false;
  return true;
}
// los puntos de un cuerpo (en su marco): una grilla 3×3×3 en su caja con los que caen adentro de la forma, cada uno con
// su parte del volumen. Un recipiente desplaza también el aire de adentro (por eso flota una cubeta vacía)
function aguaPuntos(b) {
  if (b.aguaP) return b.aguaP;
  const sh = b.shape, lo = v3(1e9, 1e9, 1e9), hi = v3(-1e9, -1e9, -1e9);
  for (const p of puntosForma(sh)) { lo.set(Math.min(lo.x, p.x), Math.min(lo.y, p.y), Math.min(lo.z, p.z)); hi.set(Math.max(hi.x, p.x), Math.max(hi.y, p.y), Math.max(hi.z, p.z)); }
  const rec = b.obj && b.obj.rec, d = vsub(hi, lo), V = rec ? d.x * d.y * d.z * 0.8 : formaVolumen(sh);
  let n = 3, pts = [];
  for (let intento = 0; intento < 2 && pts.length < 4; intento++, n = 5) {
    pts = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      const p = v3(lo.x + d.x * (i + 0.5) / n, lo.y + d.y * (j + 0.5) / n, lo.z + d.z * (k + 0.5) / n);
      if (rec || dentroForma(sh, p)) pts.push(p);
    }
  }
  if (!pts.length) pts.push(v3());
  return (b.aguaP = { pts, w: V / pts.length, V, cel: Math.max(d.y / n, 0.03) });
}
// empuje (por cada punto bajo el agua: el peso del agua que desplaza) y arrastre (contra la velocidad de cada punto),
// una vez por paso de física. La densidad se toma entre 250 y 9000 kg/m³: un prop con masa de juguete no sale volando
function aguaCuerpos(dt) {
  if (!AGUA.vols.length) return;
  for (const b of PH.bodies) {
    if (!b.dynamic || b.sleep || b.noPhys || b.held) continue;
    const a = b.aabb; let toca = null;
    for (const v of AGUA.vols) {
      if (v.rec && v.rec.b === b) continue;
      if (v.y1 <= v.y0 + 0.002 || a.y0 > v.y1 || a.y1 < v.y0 - 0.05 || a.x1 < v.ax0 || a.x0 > v.ax1 || a.z1 < v.az0 || a.z0 > v.az1) continue;
      toca = v; break;
    }
    const antes = b.aguaK || 0;
    if (!toca) { b.aguaK = 0; continue; }
    const S = aguaPuntos(b), q = b.q, rec = b.obj && b.obj.rec, m = b.mass;
    // (los muñecos flotan como una persona: con el 85 % del cuerpo bajo el agua, sea cual sea la masa de cada parte)
    // (la madera flota: los props livianos, que suenan a madera, como mucho a 700 kg/m³, como en GMod)
    const rho = b.dens || clamp(m / S.V, 250, b.snd === 'wood' ? 700 : 9000), k = b.persona ? 1.18 * m / (AGUA_RHO * S.V) : (b.buoy || 1) * m / (rho * S.V);   // (= 1 si la densidad quedó como es)
    let fx = 0, fy = 0, fz = 0, tx = 0, ty = 0, tz = 0, sub = 0;
    for (const pl of S.pts) {
      const r = q.rotTo(pl, _a1), x = b.pos.x + r.x, y = b.pos.y + r.y, z = b.pos.z + r.z;
      const v = y < toca.y1 + S.cel * 0.5 && aguaPisa(toca, x, z) ? toca : aguaEn(x, y - S.cel * 0.5, z, S.cel * 0.5, rec ? rec.vol : null);
      if (!v) continue;
      let f = clamp((v.y1 - y) / S.cel + 0.5, 0, 1);   // (la celda del punto, sumergida en parte: sin saltos en la superficie)
      if (rec && y < rec.vol.y1 && aguaPisa(rec.vol, x, z)) f = 0;   // (adentro del recipiente, con su agua: no desplaza)
      if (f <= 0) continue;
      sub += f;
      const vx = b.vel.x + b.ang.y * r.z - b.ang.z * r.y, vy = b.vel.y + b.ang.z * r.x - b.ang.x * r.z, vz = b.vel.z + b.ang.x * r.y - b.ang.y * r.x;
      const fu = AGUA_RHO * 9.81 * S.w * f * k, cd = AGUA_RHO * S.w * f * 1.8 * k;
      const Fx = -cd * vx, Fy = fu - cd * vy, Fz = -cd * vz;
      fx += Fx; fy += Fy; fz += Fz; tx += r.y * Fz - r.z * Fy; ty += r.z * Fx - r.x * Fz; tz += r.x * Fy - r.y * Fx;
    }
    b.aguaK = sub / S.pts.length;
    if (sub <= 0) continue;
    const im = dt * b.invMass; b.vel.x += fx * im; b.vel.y += fy * im; b.vel.z += fz * im;
    const w = b.invIw(_a2.set(tx, ty, tz), _a3); b.ang.x += w.x * dt; b.ang.y += w.y * dt; b.ang.z += w.z * dt;
    // (las olas que hace al moverse se llevan energía: sube y baja menos veces antes de quedarse flotando)
    // (y el agua frena los giros aunque toque poco: un sofá que cae girando no sigue dando vueltas al flotar)
    const am = Math.exp(-dt * 2.2 * b.aguaK), aa = Math.exp(-dt * (1.2 + 2.5 * b.aguaK)); b.vel.y *= am; b.ang.x *= aa; b.ang.y *= aa; b.ang.z *= aa;
    // al entrar con velocidad, salpica (más cuanto más pesado y más rápido)
    if (antes === 0 && b.vel.y < -1.6) aguaSalpicar(v3(b.pos.x, toca.y1, b.pos.z), clamp(-b.vel.y * Math.sqrt(m) / 45, 0.12, 1));
  }
}

// cada paso de física, antes del paso: los recipientes y lo que flota
function aguaFisica(dt) { if (!AGUA.vols.length) return; aguaRecipientesPaso(dt); aguaCuerpos(dt); }

// ---------------- el jugador: vadear, nadar, ahogarse ----------------
// devuelve true si nadó (el movimiento de este paso ya está hecho)
function aguaJugador(dt, ent) {
  const J = JUG, pies = J.pos.y - 0.95, alto = 1.9 * J.tam, v = AGUA.vols.length ? aguaEn(J.pos.x, pies + 0.02, J.pos.z, 0) : null;
  const hondo = v ? Math.max(0, v.y1 - pies) : 0, ojos = pies + J.ojoAlto;
  J.hondo = hondo; J.vadeo = 1 - 0.45 * clamp(hondo / (0.62 * alto), 0, 1);   // (con el agua a la cintura, 55 % más lento)
  // el aire: con los ojos bajo el agua dura 12 s; después se ahoga de a 10 por segundo, como en HL2
  if (v && ojos < v.y1 - 0.03) {
    J.aire = (J.aire === undefined ? 12 : J.aire) - dt;
    if (J.aire < 0) { J.ahogoT = (J.ahogoT || 0) - dt; if (J.ahogoT <= 0) { J.ahogoT = 1; danarJugador(10); sonar('AG_Ahogo' + (1 + ((Math.random() * 3) | 0)), null, 0.7); } }
  } else { J.aire = Math.min(12, (J.aire === undefined ? 12 : J.aire) + dt * 4); J.ahogoT = 0; }
  const antes = J.nada; J.nada = !!v && hondo > 0.66 * alto && !J.noclip;   // (el agua pasa el pecho)
  if (!J.nada) return false;
  if (!antes && J.vel.y < -2) aguaSalpicar(v3(J.pos.x, v.y1, J.pos.z), clamp(-J.vel.y / 12, 0.3, 1));
  // como en Source: se nada hacia donde mira la cámara; el salto sube y agacharse baja
  const fv = J.q.rot(_a1.set(0, 0, 1)), rgt = Quat.axis(0, 1, 0, J.yaw).rot(_a2.set(-1, 0, 0));
  // (mirar un poco para abajo no te hunde: hasta 20° se nada por la superficie; en el celular la cámara casi nunca queda
  // derecha y avanzar te llevaba al fondo. Más inclinada, se bucea)
  const DZ = 0.34, fy = Math.abs(fv.y) < DZ ? 0 : (fv.y - Math.sign(fv.y) * DZ) / (1 - DZ);
  const w = _a3.set(fv.x * ent.y + rgt.x * ent.x, fy * ent.y + (ent.saltar ? 1 : 0) - (ent.agachar ? 1 : 0), fv.z * ent.y + rgt.z * ent.x);
  const wl = Math.min(1, w.len()); if (wl > 1e-3) w.scale(1 / w.len());
  const vm = J.vel_max * 0.62 * (ent.correr ? 1.3 : 1);
  let ty = w.y * vm * wl;
  // sin apretar nada flota con la cara justo afuera; nadando derecho cerca de la superficie, se queda en la superficie
  if (wl < 0.05 || (Math.abs(w.y) < 0.05 && ojos > v.y1 - 0.45)) ty = clamp((v.y1 + 0.12 - ojos) * 2.2, -0.8, 1.6);
  if (ojos > v.y1 + 0.3 && ty > 0) ty = 0;   // (nadando para arriba no sale volando del agua)
  const kv = Math.min(1, dt * (3.2 + Math.abs(J.vel.y) * 0.9));   // (al caer rápido el agua frena enseguida)
  J.vel.x += (w.x * vm * wl - J.vel.x) * kv; J.vel.y += (ty - J.vel.y) * kv; J.vel.z += (w.z * vm * wl - J.vel.z) * kv;
  // salir del agua: con el salto, en la superficie y contra un borde que está a menos de un metro sobre el agua
  if (ent.saltar && ojos > v.y1 - 0.35 && J.tiempoSalida <= 0) {
    const f = Quat.axis(0, 1, 0, J.yaw).rot(_a4.set(0, 0, 1)), cint = v3(J.pos.x, v.y1 - 0.1, J.pos.z), alto1 = v3(J.pos.x, v.y1 + 1.05, J.pos.z);
    const pared = mundoRayo(cint, f, J.radio + 0.6), libre = !mundoRayo(alto1, f, J.radio + 0.7);
    if (pared && libre) { J.vel.y = 6.4; J.vel.x = f.x * 2.2; J.vel.z = f.z * 2.2; J.tiempoSalida = 0.6; }
  }
  J.tiempoSalida = (J.tiempoSalida || 0) - dt;
  jugadorMoverChocar(dt);
  J.tiempoSuelo = 0; J.bobK = (J.bobK || 0) * Math.exp(-dt * 8);
  return true;
}
// ¿la persona nada? (con el pecho bajo el agua; los de la red con su propia posición): el volumen, o null
function aguaNadaPersona(P) {
  if (!AGUA.vols.length || !P.pos) return null;
  if (P === JUG.cuerpo) return JUG.nada ? aguaEn(JUG.pos.x, JUG.pos.y - 0.93, JUG.pos.z, 0) : null;
  const t = P.tam || 1, pecho = P.pos.y - 0.95 + 1.25 * t, v = aguaEn(P.pos.x, pecho, P.pos.z, 0);
  return v && pecho < v.y1 ? v : null;
}

// ---------------- gotas (el chorro de un recipiente) ----------------
function aguaGota(p, v, l, b) {
  if (AGUA.gotas.length >= 220) { AGUA.gotas[AGUA.gotas.length - 1].l += l; return; }
  AGUA.gotas.push({ p: p.clone(), v: v.clone(), l, t: 0, b: b || null });   // (b: el recipiente de donde sale, que no la ataja)
}
const _gNada = v3();
function aguaGotasPaso(dt) {
  const G = AGUA.gotas; AGUA.gotaT -= dt;
  for (let i = G.length - 1; i >= 0; i--) {
    const g = G[i]; g.t += dt; g.v.y -= 9.81 * dt;
    const dx = g.v.x * dt, dy = g.v.y * dt, dz = g.v.z * dt, L = Math.hypot(dx, dy, dz), nx = g.p.x + dx, ny = g.p.y + dy, nz = g.p.z + dz;
    let fin = false;
    // en un recipiente (aunque esté vacío): se suma; en el lago: salpica un poco
    const rc = aguaRecipienteEn(nx, ny, nz);
    if (rc && rc.rec.rec.l < rc.rec.rec.cap) { rc.rec.rec.l = Math.min(rc.rec.rec.cap, rc.rec.rec.l + g.l); fin = true; }
    else {
      const vol = aguaEn(nx, ny, nz, 0);
      if (vol && !vol.rec) { if (Math.random() < 0.3) particula(_a1.set(nx, vol.y1, nz), _a2.set((Math.random() - 0.5) * 0.6, 1 + Math.random(), (Math.random() - 0.5) * 0.6), 0.4, 0.04, [0.85, 0.93, 1, 0.6], 'gota', 0); fin = true; }
      else if (L > 1e-5) {
        // contra el piso o algo: un rayo por el tramo de este cuadro; ahí el agua hace (o agranda) un charco
        const h = raycast(g.p, _a3.set(dx / L, dy / L, dz / L), L, g.t < 0.25 ? g.b : null);
        if (h) {
          aguaCharco(h.p, g.l);
          if (Math.random() < 0.25) particula(h.p, _a2.set((Math.random() - 0.5) * 0.8, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 0.8), 0.35, 0.035, [0.85, 0.93, 1, 0.55], 'gota', 0);
          if (AGUA.gotaT <= 0) { AGUA.gotaT = 0.09; sonar('AG_Gota' + (1 + ((Math.random() * 4) | 0)), h.p, 0.25, 0.9 + Math.random() * 0.3); }
          fin = true;
        }
      }
    }
    if (fin || g.t > 4 || ny < MUNDO.lo.y - 20) { G[i] = G[G.length - 1]; G.pop(); continue; }
    g.p.set(nx, ny, nz);
    // se dibuja como una partícula de un cuadro
    particula(g.p, _gNada, (TIEMPO.dt || 0.016) * 1.05, 0.055, [0.72, 0.86, 1, 0.7], 'gota', 0);
  }
}

// ---------------- charcos ----------------
// una grilla de agua poco profunda (tubos virtuales, de Mei y otros): el agua pasa a la celda vecina según la diferencia
// de altura (piso + agua), con el piso medido una vez con rayos. El anillo de afuera se lleva el agua (corre lejos) y
// el agua se seca de a poco: el charco se apaga solo. Cada celda se queda con 2 mm (la tensión superficial: en un piso
// plano el charco deja de correr; sin esto se estiraba hasta el borde y se iba entero). Se calcula a 30 pasos por segundo
const CH_N = 24, CH_D = 0.25, CH_M = CH_N + 2, CH_RET = 0.002;
function aguaCharco(p, litros) {
  let c = null;
  for (const x of AGUA.charcos) if (Math.abs(p.x - x.cx) < x.mitad - 0.6 && Math.abs(p.z - x.cz) < x.mitad - 0.6 && Math.abs(p.y - x.y) < 1.2) { c = x; break; }
  if (!c) {
    if (AGUA.charcos.length >= 6) { let viejo = AGUA.charcos[0]; for (const x of AGUA.charcos) if (x.total < viejo.total) viejo = x; aguaCharcoLiberar(viejo); AGUA.charcos.splice(AGUA.charcos.indexOf(viejo), 1); }
    c = aguaCharcoNuevo(p);
  }
  const i = Math.floor((p.x - c.x0) / CH_D) + 1, j = Math.floor((p.z - c.z0) / CH_D) + 1;
  if (i < 1 || j < 1 || i > CH_N || j > CH_N) return;
  c.w[j * CH_M + i] += litros / 1000 / (CH_D * CH_D);
}
function aguaCharcoNuevo(p) {
  const M = CH_M, c = { cx: p.x, cz: p.z, y: p.y, mitad: CH_N * CH_D / 2, x0: p.x - CH_N * CH_D / 2, z0: p.z - CH_N * CH_D / 2, hT: new Float32Array(M * M), w: new Float32Array(M * M), fl: new Float32Array(M * M * 4), acc: 0, total: 0, malla: null, sucio: true };
  // el piso de cada celda (y del anillo de afuera): un rayo hacia abajo; sin piso, un pozo (el agua se va por ahí)
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    // (sólo el mundo: un prop encima, como la cubeta volcada, no es el piso)
    const x = c.x0 + (i - 0.5) * CH_D, z = c.z0 + (j - 0.5) * CH_D, h = mundoRayo(_a1.set(x, p.y + 1.1, z), _a2.set(0, -1, 0), 3.5);
    c.hT[j * M + i] = h ? p.y + 1.1 - h.t : p.y - 6;
  }
  AGUA.charcos.push(c); return c;
}
function aguaCharcoPaso(c, dt) {
  const M = CH_M, A = CH_D * CH_D, w = c.w, hT = c.hT, fl = c.fl, K = dt * 9.81 * A / CH_D, amort = Math.exp(-dt * 1.5);
  // flujos de salida hacia los cuatro vecinos (0 der, 1 izq, 2 abajo, 3 arriba)
  for (let j = 1; j <= CH_N; j++) for (let i = 1; i <= CH_N; i++) {
    const k = j * M + i, H = hT[k] + w[k], o = k * 4;
    let f0 = Math.max(0, fl[o] * amort + K * (H - hT[k + 1] - w[k + 1])), f1 = Math.max(0, fl[o + 1] * amort + K * (H - hT[k - 1] - w[k - 1]));
    let f2 = Math.max(0, fl[o + 2] * amort + K * (H - hT[k + M] - w[k + M])), f3 = Math.max(0, fl[o + 3] * amort + K * (H - hT[k - M] - w[k - M]));
    const s = (f0 + f1 + f2 + f3) * dt, tope = Math.max(0, w[k] - CH_RET) * A;
    if (s > tope && s > 0) { const e = tope / s; f0 *= e; f1 *= e; f2 *= e; f3 *= e; }
    fl[o] = f0; fl[o + 1] = f1; fl[o + 2] = f2; fl[o + 3] = f3;
  }
  // el agua de cada celda: lo que entra menos lo que sale; se seca 0,06 mm por segundo
  let total = 0;
  for (let j = 1; j <= CH_N; j++) for (let i = 1; i <= CH_N; i++) {
    const k = j * M + i, o = k * 4;
    const entra = (i > 1 ? fl[(k - 1) * 4] : 0) + (i < CH_N ? fl[(k + 1) * 4 + 1] : 0) + (j > 1 ? fl[(k - M) * 4 + 2] : 0) + (j < CH_N ? fl[(k + M) * 4 + 3] : 0);
    const nw = w[k] + dt * (entra - fl[o] - fl[o + 1] - fl[o + 2] - fl[o + 3]) / A;
    w[k] = Math.max(0, nw - dt * 0.00006); total += w[k];
  }
  c.total = total * A * 1000; c.sucio = true;
}
function aguaCharcosPaso(dt) {
  for (let i = AGUA.charcos.length - 1; i >= 0; i--) {
    const c = AGUA.charcos[i]; c.acc += dt;
    while (c.acc >= 1 / 30) { c.acc -= 1 / 30; aguaCharcoPaso(c, 1 / 30); }
    if (c.total < 0.03 && c.t > 1) { aguaCharcoLiberar(c); AGUA.charcos.splice(i, 1); continue; }
    c.t = (c.t || 0) + dt;
  }
}
function aguaCharcoLiberar(c) { if (c.malla && R.gl) { const gl = R.gl; gl.deleteBuffer(c.malla.vb); gl.deleteBuffer(c.malla.ib); gl.deleteVertexArray(c.malla.vao); } c.malla = null; }

// ---------------- chapoteos y sonidos ----------------
function aguaSalpicar(p, k) {
  const n = Math.round((6 + 26 * k) * Math.max(0.3, GFX.part || 1));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, r = Math.random();
    particula(p, _a1.set(Math.cos(a) * r * 2.4 * k, 1.8 + 4.5 * k * Math.random(), Math.sin(a) * r * 2.4 * k), 0.5 + 0.5 * Math.random(), 0.04 + 0.09 * k * Math.random(), [0.85, 0.93, 1, 0.75], 'gota', 0.2);
  }
  particula(p, _a1.set(0, 0.25, 0), 0.7, 0.3 + 0.9 * k, [0.95, 0.98, 1, 0.45], 'humo', 1.6);   // (espuma)
  sonar('AG_Salpica' + (1 + ((Math.random() * 3) | 0)), p, 0.3 + 0.7 * k, 0.9 + Math.random() * 0.25);
}
// cada cuadro: la cámara (¿bajo el agua?), los sonidos (el lago cerca, debajo del agua, brazadas, chorros), gotas y charcos
function aguaPaso(dt) {
  AGUA.t += dt;
  const c = CAM.pos, v = AGUA.vols.length ? aguaEn(c.x, c.y, c.z, 0) : null, bajo = !!v && c.y < v.y1 - 0.01;
  if (bajo !== AGUA.bajo && JUEGO.estado === 'juego') sonar(bajo ? 'AG_Salpica2' : 'AG_Salpica1', null, 0.3, bajo ? 0.75 : 1.1);
  AGUA.bajo = bajo; AGUA.camVol = bajo ? v : null;
  if (JUEGO.estado !== 'juego') return;
  if (bajo) bucle('aguaBajo', 'AG_Bajo', null, 0.55);
  // el lago se oye cerca de la orilla (el punto de su superficie más cercano)
  let lago = null, dl = 45;
  for (const w of AGUA.vols) {
    if (!w.mapa) continue;
    const x = clamp(c.x, w.ax0, w.ax1), z = clamp(c.z, w.az0, w.az1), d = Math.hypot(x - c.x, w.y1 - c.y, z - c.z);
    if (d < dl) { dl = d; lago = _a4.set(x, w.y1, z); }
  }
  if (lago && !bajo) bucle('aguaLago', 'AG_Lago', lago, 0.35 * (1 - dl / 45));
  // brazadas y pasos en el agua
  const J = JUG;
  if (J.vivo && (J.nada || J.hondo > 0.25)) {
    const vh = Math.hypot(J.vel.x, J.vel.z) + (J.nada ? Math.abs(J.vel.y) * 0.5 : 0);
    J.brazaT = (J.brazaT || 0) - dt * Math.min(2.6, 0.6 + vh / 2);
    if (vh > 0.5 && J.brazaT <= 0) { J.brazaT = 1; sonar('AG_Paso' + (1 + ((Math.random() * 8) | 0)), J.pos, J.nada ? 0.4 : 0.3, 0.95 + Math.random() * 0.1); }
  }
  // el chorro de cada recipiente que se vuelca
  for (const w of AGUA.vols) if (w.rec && w.rec.rec.chorroT > 0) { const R = w.rec.rec; R.chorroT -= dt; bucle('chorro' + w.rec.id, 'AG_Chorro', R.boca, clamp(R.sale / Math.max(dt, 1e-3) / 20, 0.15, 0.8)); }
  aguaGotasPaso(dt); aguaCharcosPaso(dt);
}

// ---------------- dibujo ----------------
// la niebla debajo del agua (de cerca, del color del agua): se pone antes de dibujar y se devuelve la de antes
function aguaNiebla() {
  if (!AGUA.bajo) return null;
  const antes = R.niebla, col = AGUA.camVol && AGUA.camVol.rec ? [0.32, 0.5, 0.56] : [0.08, 0.24, 0.27];
  R.niebla = { c: col, a: 0, b: AGUA.camVol && AGUA.camVol.rec ? 4 : 16 };
  return antes;
}
function aguaMallaGL(V, I, dinamica) {
  const gl = R.gl, vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, V, dinamica ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
  gl.disableVertexAttribArray(2); gl.vertexAttrib2f(2, 0, 0);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I, dinamica ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
  gl.bindVertexArray(null); R.vaoAct = null;
  return { vao, vb, ib, it: gl.UNSIGNED_SHORT, isz: 2, d: { mn: [0, 0, 0], sc: [1, 1, 1], sub: [[0, I.length]] }, skin: 0, n: I.length };
}
// la superficie del agua de un recipiente: un disco o un cuadrado de lado 2 en y = 0 (se escala con la matriz)
function aguaMallasBase() {
  if (AGUA.quad) return;
  const vq = new Float32Array([-1, 0, -1, 0, 1, 0, 1, 1, 0, -1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, -1, 0, 1, 0, 1, 0, 1]);
  AGUA.quad = aguaMallaGL(vq, new Uint16Array([0, 2, 1, 0, 3, 2]));
  const N = 20, vd = new Float32Array((N + 1) * 7), id = [];
  vd.set([0, 0, 0, 0, 1, 0, 1], 0);
  for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2; vd.set([Math.cos(a), 0, Math.sin(a), 0, 1, 0, 1], (k + 1) * 7); id.push(0, 1 + ((k + 1) % N), 1 + k); }
  AGUA.disco = aguaMallaGL(vd, new Uint16Array(id));
  // el material del agua de los recipientes y los charcos (sin reflejo: son chicos)
  AGUA.mat = DATA.mt.length; DATA.mt.push({ n: 'RB_agua', sh: 'Legacy Shaders/Transparent/Diffuse', c: [0.28, 0.45, 0.5, 1], agua: [0.28, 0.45, 0.5], t: -1 });
}
function aguaEncolarMalla(m, M, cx, cy, cz, r, extra) {
  let p = R.items[R.nItems];
  if (!p) p = R.items[R.nItems] = { m: null, s0: 0, sn: 0, mt: null, M: null, h: null, x: null, z: 0, cx: 0, cy: 0, cz: 0, r: 0, est: false, vista: false };
  R.nItems++;
  p.m = m; p.s0 = 0; p.sn = m.n; p.mt = matGL(AGUA.mat); p.M = M; p.h = null; p.x = extra; p.est = false; p.vista = false; p.cx = cx; p.cy = cy; p.cz = cz; p.r = r;
}
const AG_EXTRA_REC = { agua: [0.35, 0.55, 0, 0] }, AG_EXTRA_CH = { agua: [0.12, 0.45, 0, 1] };
// el agua de los recipientes y los charcos, a la cola de dibujo
function aguaEncolar() {
  if (!R.gl) return;
  aguaMallasBase();
  for (const v of AGUA.vols) {
    if (!v.rec || v.y1 <= v.y0 + 0.004) continue;
    const M = v.M || (v.M = new Float32Array(16));
    M.fill(0); M[0] = v.ca * v.hx; M[2] = v.sa * v.hx; M[5] = 1; M[8] = -v.sa * v.hz; M[10] = v.ca * v.hz; M[12] = v.cx; M[13] = v.y1; M[14] = v.cz; M[15] = 1;
    aguaEncolarMalla(v.redondo ? AGUA.disco : AGUA.quad, M, v.cx, v.y1, v.cz, Math.hypot(v.hx, v.hz), AG_EXTRA_REC);
  }
  for (const c of AGUA.charcos) {
    if (c.sucio) aguaCharcoMalla(c);
    if (c.malla && c.malla.n) aguaEncolarMalla(c.malla, IDM, c.cx, c.y, c.cz, c.mitad * 1.5, AG_EXTRA_CH);
  }
}
// la malla de un charco: un vértice por celda a la altura del piso más el agua; sólo los cuadros con agua en alguna
// esquina (el alfa de cada vértice, en el 4.º lugar de la normal, según lo hondo)
function aguaCharcoMalla(c) {
  const M = CH_M, gl = R.gl, n = CH_N, V = c.V || (c.V = new Float32Array(n * n * 7)), I = c.I || (c.I = new Uint16Array((n - 1) * (n - 1) * 6));
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = (j + 1) * M + i + 1, o = (j * n + i) * 7;
    V[o] = c.x0 + (i + 0.5) * CH_D; V[o + 1] = c.hT[k] + c.w[k] + 0.006; V[o + 2] = c.z0 + (j + 0.5) * CH_D;
    V[o + 3] = 0; V[o + 4] = 1; V[o + 5] = 0; V[o + 6] = clamp(c.w[k] / 0.0015, 0, 1);
  }
  let ni = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, d = a + n, e = d + 1;
    if (V[a * 7 + 6] + V[b * 7 + 6] + V[d * 7 + 6] + V[e * 7 + 6] <= 0) continue;
    I[ni++] = a; I[ni++] = d; I[ni++] = b; I[ni++] = b; I[ni++] = d; I[ni++] = e;
  }
  if (!c.malla) c.malla = aguaMallaGL(V, I, true);
  else { gl.bindBuffer(gl.ARRAY_BUFFER, c.malla.vb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, V); gl.bindVertexArray(null); R.vaoAct = null; gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, c.malla.ib); gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, I.subarray(0, ni)); }
  c.malla.n = ni; c.malla.d.sub[0][1] = ni; c.sucio = false;
}
// los uniformes del agua para un pedido (la hora de las ondas, cuánto se mueve, el alfa, el reflejo)
function aguaUniformes(p, u) {
  const gl = R.gl, k = p.x && p.x.agua ? p.x.agua : null;
  if (u.uAguaT) gl.uniform1f(u.uAguaT, AGUA.t);
  if (u.uAguaK) { if (k) gl.uniform4f(u.uAguaK, k[0], k[1], k[2], k[3]); else gl.uniform4f(u.uAguaK, 1, 0.72, 0, 0); }   // (el del mapa: más turbia)
  const ref = AGUA.refOn && !k && p.mt.refleja;
  if (u.uRefOn) gl.uniform1f(u.uRefOn, ref ? 1 : 0);
  if (u.uRef && ref) { gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, AGUA.rt.t); gl.activeTexture(gl.TEXTURE0); gl.uniform2f(u.uRefInv, 1 / R.cv.width, 1 / R.cv.height); }
}

// ---------------- reflejo (Alto y Ultra) ----------------
// la escena espejada en el plano del agua, a la mitad (Ultra) o a un tercio (Alto) de la resolución, y sólo con agua
// grande a la vista y la cámara arriba de ella. El plano cercano oblicuo (Lengyel) corta lo de abajo del agua sin
// descartar píxeles en los sombreadores (descartar apaga el corte temprano por profundidad en todas las placas)
const _esp = new Float32Array(16), _vR = new Float32Array(16), _pR = new Float32Array(16), _vpR = new Float32Array(16), _vpG = new Float32Array(16), _cieloR = new Float32Array(16);
function aguaRT(w, h) {
  const gl = R.gl, X = AGUA.rt, hdr = R.salida === 'hdr';
  if (X && X.w === w && X.h === h && X.hdr === hdr) return X;
  if (X) { gl.deleteTexture(X.t); gl.deleteFramebuffer(X.f); gl.deleteRenderbuffer(X.rb); AGUA.rt = null; }
  const t = rtTex(w, h, ...(hdr ? R.F.hdr : R.F.ldr), gl.LINEAR), rb = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
  const f = rtFb(t, null, rb);
  if (!f) { gl.deleteTexture(t); gl.deleteRenderbuffer(rb); return null; }
  return (AGUA.rt = { t, f, rb, w, h, hdr });
}
function aguaReflejo(P, V) {
  AGUA.refOn = false;
  const div = GFX.refl || 0; if (!div || AGUA.bajo || R.salida === 'gam') return;
  // la altura del agua que refleja, la más cercana de las que se ven
  let h = null, mejor = -1e18;
  for (const p of R.colaT) if (p.mt.refleja && p.z > mejor) { mejor = p.z; h = p.cy; }
  if (h === null || CAM.pos.y < h + 0.05) return;
  const gl = R.gl, W = Math.max(16, (R.cv.width / div) | 0), H = Math.max(16, (R.cv.height / div) | 0), X = aguaRT(W, H); if (!X) return;
  // la vista espejada en y = h y la proyección con el plano cercano en el agua
  _esp.fill(0); _esp[0] = 1; _esp[5] = -1; _esp[10] = 1; _esp[15] = 1; _esp[13] = 2 * h;
  m4mul(V, _esp, _vR); _pR.set(P);
  const Vi = M4.inv(_vR), C = [0, 0, 0, 0], Cw = [0, 1, 0, -h];
  for (let i = 0; i < 4; i++) C[i] = Vi[i * 4] * Cw[0] + Vi[i * 4 + 1] * Cw[1] + Vi[i * 4 + 2] * Cw[2] + Vi[i * 4 + 3] * Cw[3];
  const qx = (Math.sign(C[0]) + _pR[8]) / _pR[0], qy = (Math.sign(C[1]) + _pR[9]) / _pR[5], qw = (1 + _pR[10]) / _pR[14], k = 2 / (C[0] * qx + C[1] * qy - C[2] + C[3] * qw);
  _pR[2] = C[0] * k; _pR[6] = C[1] * k; _pR[10] = C[2] * k + 1; _pR[14] = C[3] * k;
  m4mul(_pR, _vR, _vpR); m4mul(P, _vR, _cieloR);
  // lo que entra en el reflejo: lo opaco de arriba del agua dentro del cono espejado (lo muy chico y lejano, no)
  const F = frustum(_vpR), cx = CAM.pos.x, cy = 2 * h - CAM.pos.y, cz = CAM.pos.z, lj = R.lejos * 0.7, L = AGUA.cola; L.length = 0;
  for (let i = 0; i < R.nItems; i++) {
    const p = R.items[i]; if (p.vista || p.mt.blend || p.mt.oculto || p.cy + p.r < h) continue;
    if (!sphereIn(F, p.cx, p.cy, p.cz, p.r)) continue;
    const dx = p.cx - cx, dy = p.cy - cy, dz = p.cz - cz, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > (lj + p.r) * (lj + p.r) || p.r * p.r < d2 * 0.00004) continue;
    L.push(p);
  }
  L.sort(ordenOpaco);
  gl.bindFramebuffer(gl.FRAMEBUFFER, X.f); gl.viewport(0, 0, W, H);
  const N = R.lin ? R.lin.nieC : R.niebla.c; gl.clearColor(N[0], N[1], N[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  _vpG.set(R.vp); const cam = R.camPos.clone(), fr = R.fr;
  R.vp.set(_vpR); R.camPos.set(cx, cy, cz); R.fr = F; R.marca++;
  gl.frontFace(gl.CW);   // (el espejo da vuelta las caras)
  const cola = R.cola; R.cola = L; dibujarOpacos(); R.cola = cola;
  dibujarCielo(M4.inv(_cieloR));
  gl.frontFace(gl.CCW);
  R.vp.set(_vpG); R.camPos.copy(cam); R.fr = fr; R.marca++;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  AGUA.refOn = true;
}
