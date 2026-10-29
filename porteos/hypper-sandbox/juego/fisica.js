// ---------------------------------------------------------------------------------------------------------
// física: cuerpos rígidos con XPBD (posiciones con subpasos, como en "Detailed Rigid Body Simulation with
// Extended Position Based Dynamics"). Choques entre poliedros convexos (cajas, barriles, conos) con SAT y
// recorte de caras, esferas y cápsulas; el suelo, las construcciones; uniones con límites (muñeco de trapo);
// cuerpos que se duermen cuando quedan quietos. El mundo fijo (mapa) son triángulos y cajas en una grilla.
// ---------------------------------------------------------------------------------------------------------
const GRAV = 9.81;
const PH = { bodies: [], joints: [], sub: 12, contacts: [], hits: [], time: 0, nextId: 1 };
const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), _e = new V3();

// ---------------- formas ----------------
// poliedro convexo: vértices, caras (normal, distancia, índices en orden), direcciones de aristas, aristas
function hullFrom(verts, faces) {
  const F = faces.map((ix) => {
    const a = verts[ix[0]], b = verts[ix[1]], c = verts[ix[2]];
    const n = vcross(vsub(b, a), vsub(c, a)).norm();
    return { n, d: vdot(n, a), ix };
  });
  const E = [], dirs = [], seen = new Set();
  for (const f of faces) for (let i = 0; i < f.length; i++) {
    const a = f[i], b = f[(i + 1) % f.length], k = a < b ? a + ',' + b : b + ',' + a;
    if (seen.has(k)) continue; seen.add(k); E.push([a, b]);
    const d = vsub(verts[b], verts[a]).norm();
    if (!dirs.some((u) => Math.abs(vdot(u, d)) > 0.999)) dirs.push(d);
  }
  let r = 0; for (const v of verts) r = Math.max(r, v.len());
  return { type: 'hull', v: verts, f: F, e: E, dirs, r };
}
function boxShape(hx, hy, hz) {
  const v = [];
  for (const z of [-hz, hz]) for (const y of [-hy, hy]) for (const x of [-hx, hx]) v.push(v3(x, y, z));
  // índices: x + 2y + 4z
  const faces = [[1, 3, 7, 5], [0, 4, 6, 2], [2, 6, 7, 3], [0, 1, 5, 4], [4, 5, 7, 6], [0, 2, 3, 1]];
  const s = hullFrom(v, faces); s.box = v3(hx, hy, hz); return s;
}
// prisma de n lados sobre el eje Y (barriles, cubiertas) o cono truncado
function prismShape(r0, r1, hy, n) {
  const v = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; v.push(v3(Math.cos(a) * r0, -hy, Math.sin(a) * r0)); }
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; v.push(v3(Math.cos(a) * r1, hy, Math.sin(a) * r1)); }
  const faces = [];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push([i, n + i, n + j, j]); }   // costados
  faces.push([...Array(n).keys()].map((i) => n + ((n - i) % n)));                           // tapa de arriba (ángulo decreciente)
  faces.push([...Array(n).keys()]);                                                         // tapa de abajo
  const s = hullFrom(v, faces);
  for (const f of s.f) if (vdot(f.n, s.v[f.ix[0]]) < 0) { f.ix.reverse(); f.n.scale(-1); f.d = -f.d; }
  return s;
}
function sphereShape(r) { return { type: 'sphere', r }; }
// varias formas pegadas (una por cada collider del objeto, como en Unity): partes = [{ shape, p (local), q (local) }]
function compoundShape(partes) {
  let r = 0;
  for (const h of partes) r = Math.max(r, h.p.len() + (h.shape.type === 'capsule' ? h.shape.r + h.shape.hh : h.shape.r));
  return { type: 'compound', partes, r };
}
// puntos extremos de una forma en su marco (para la caja que la envuelve, la inercia y dónde apoya)
function puntosForma(sh) {
  if (sh.type === 'hull') return sh.v;
  if (sh.type === 'sphere') { const r = sh.r; return [v3(r, 0, 0), v3(-r, 0, 0), v3(0, r, 0), v3(0, -r, 0), v3(0, 0, r), v3(0, 0, -r)]; }
  if (sh.type === 'capsule') { const r = sh.r, h = sh.hh; return [v3(r, h, 0), v3(-r, h, 0), v3(0, h + r, 0), v3(0, h, r), v3(0, h, -r), v3(r, -h, 0), v3(-r, -h, 0), v3(0, -h - r, 0), v3(0, -h, r), v3(0, -h, -r)]; }
  const out = []; for (const h of sh.partes) for (const p of puntosForma(h.shape)) out.push(h.q.rot(p).add(h.p)); return out;
}
function capsuleShape(r, hh) { return { type: 'capsule', r, hh }; }   // eje Y local, hh = medio largo del tramo recto
// inercia (diagonal, local) de cada forma
function inertia(sh, m) {
  if (sh.type === 'sphere') { const k = 0.4 * m * sh.r * sh.r; return v3(k, k, k); }
  if (sh.type === 'capsule') { const r = sh.r, h = sh.hh * 2 + r; const ix = m * (3 * r * r + h * h) / 12, iy = Math.max(0.5 * m * r * r, ix * 0.5); return v3(ix, iy, ix); }
  let lo = v3(1e9, 1e9, 1e9), hi = v3(-1e9, -1e9, -1e9);
  for (const p of puntosForma(sh)) { lo.set(Math.min(lo.x, p.x), Math.min(lo.y, p.y), Math.min(lo.z, p.z)); hi.set(Math.max(hi.x, p.x), Math.max(hi.y, p.y), Math.max(hi.z, p.z)); }
  const d = vsub(hi, lo);
  return v3(m * (d.y * d.y + d.z * d.z) / 12, m * (d.x * d.x + d.z * d.z) / 12, m * (d.x * d.x + d.y * d.y) / 12);
}

// ---------------- cuerpos ----------------
class Body {
  constructor(shape, mass, opt) {
    opt = opt || {};
    this.id = PH.nextId++; this.shape = shape; this.mass = mass; this.invMass = mass > 0 ? 1 / mass : 0;
    const I = inertia(shape, mass); this.invI = v3(I.x ? 1 / I.x : 0, I.y ? 1 / I.y : 0, I.z ? 1 / I.z : 0);
    this.pos = v3(); this.q = new Quat(); this.vel = v3(); this.ang = v3();
    this.prevPos = v3(); this.prevQ = new Quat(); this.vPre = v3(); this.wPre = v3();
    this.fric = opt.fric === undefined ? 0.6 : opt.fric; this.rest = opt.rest === undefined ? 0.15 : opt.rest;
    this.sleep = false; this.sleepT = 0; this.frozen = false; this.held = false; this.noCollide = opt.noCollide || null;
    this.buoy = opt.buoy === undefined ? 1 : opt.buoy; this.group = opt.group || 0; this.kind = opt.kind || ''; this.snd = opt.snd || 'wood';
    this.wv = []; this.wn = []; this.aabb = { x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0 };
    this.r = shape.type === 'sphere' ? shape.r : shape.type === 'capsule' ? shape.r + shape.hh : shape.r;
    this.lastHit = 0; this.spec = 0.005; this.damp = opt.damp || 0; this.angDamp = opt.angDamp || 0;
    if (shape.type === 'compound') this.hijos = shape.partes.map((pt) => hijoDe(this, pt));
  }
  get dynamic() { return this.invMass > 0 && !this.frozen; }
  // lo que el solver puede mover (uno dormido hace de piso hasta que algo con fuerza lo despierte)
  get awake() { return this.invMass > 0 && !this.frozen && !this.sleep; }
  get lively() { return this.held || this.vel.lenSq() > 0.04 || this.ang.lenSq() > 0.12; }
  // multiplica por la inercia inversa en el mundo
  invIw(v, out) {
    this.q.invRotTo(v, out); out.set(out.x * this.invI.x, out.y * this.invI.y, out.z * this.invI.z); return this.q.rotTo(out, out);
  }
  // masa inversa generalizada en un punto r (relativo al centro), dirección n
  wAt(r, n) { if (!this.awake) return 0; r.crossTo(n, _e); const t = this.invIw(_e, new V3()); return this.invMass + _e.dot(t); }
  // aplica una corrección de posición p (vector) en el punto r
  applyPos(p, r, sign) {
    if (!this.awake) return;
    this.pos.addS(p, this.invMass * sign);
    r.crossTo(p, _d); const w = this.invIw(_d, new V3()); w.scale(sign);
    this.q.integrate(w, 1); // aproximación de primer orden (como en el artículo)
  }
  applyVel(p, r, sign) {
    if (!this.awake) return;
    this.vel.addS(p, this.invMass * sign);
    r.crossTo(p, _d); const w = this.invIw(_d, new V3()); this.ang.addS(w, sign);
  }
  wake() { this.sleep = false; this.sleepT = 0; this.ancT = 0; }
  // vértices y normales en el mundo (para los choques)
  updateWorld() {
    const sh = this.shape, a = this.aabb;
    if (sh.type === 'hull') {
      if (this.wv.length !== sh.v.length) { this.wv = sh.v.map(() => v3()); this.wn = sh.f.map(() => v3()); }
      let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
      for (let i = 0; i < sh.v.length; i++) {
        const w = this.q.rotTo(sh.v[i], this.wv[i]).add(this.pos);
        if (w.x < x0) x0 = w.x; if (w.y < y0) y0 = w.y; if (w.z < z0) z0 = w.z; if (w.x > x1) x1 = w.x; if (w.y > y1) y1 = w.y; if (w.z > z1) z1 = w.z;
      }
      for (let i = 0; i < sh.f.length; i++) this.q.rotTo(sh.f[i].n, this.wn[i]);
      a.x0 = x0; a.y0 = y0; a.z0 = z0; a.x1 = x1; a.y1 = y1; a.z1 = z1;
    } else if (sh.type === 'compound') {
      let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
      for (const h of this.hijos) {
        this.q.rotTo(h.pl, h.pos).add(this.pos); h.q.mulTo(this.q, h.ql); h.updateWorld();
        const b = h.aabb; if (b.x0 < x0) x0 = b.x0; if (b.y0 < y0) y0 = b.y0; if (b.z0 < z0) z0 = b.z0; if (b.x1 > x1) x1 = b.x1; if (b.y1 > y1) y1 = b.y1; if (b.z1 > z1) z1 = b.z1;
      }
      a.x0 = x0; a.y0 = y0; a.z0 = z0; a.x1 = x1; a.y1 = y1; a.z1 = z1;
    } else if (sh.type === 'sphere') {
      const r = sh.r; a.x0 = this.pos.x - r; a.y0 = this.pos.y - r; a.z0 = this.pos.z - r; a.x1 = this.pos.x + r; a.y1 = this.pos.y + r; a.z1 = this.pos.z + r;
    } else {
      const ax = this.q.rot(v3(0, sh.hh, 0)), r = sh.r;
      this.capA = vadd(this.pos, ax); this.capB = vsub(this.pos, ax);
      a.x0 = Math.min(this.capA.x, this.capB.x) - r; a.y0 = Math.min(this.capA.y, this.capB.y) - r; a.z0 = Math.min(this.capA.z, this.capB.z) - r;
      a.x1 = Math.max(this.capA.x, this.capB.x) + r; a.y1 = Math.max(this.capA.y, this.capB.y) + r; a.z1 = Math.max(this.capA.z, this.capB.z) + r;
    }
  }
}
// cada parte de un cuerpo compuesto: un "cuerpo" liviano con su forma en el mundo; lo demás (masa, velocidad,
// si se mueve o duerme) es el del padre. Los contactos que arma se pasan al padre (contactosAlPadre).
function hijoDe(padre, pt) {
  const h = Object.create(Body.prototype);
  h.padre = padre; h.shape = pt.shape; h.pl = pt.p; h.ql = pt.q; h.pos = v3(); h.q = new Quat(); h.wv = []; h.wn = [];
  h.aabb = { x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0 }; h.id = padre.id;
  h.r = pt.shape.type === 'sphere' ? pt.shape.r : pt.shape.type === 'capsule' ? pt.shape.r + pt.shape.hh : pt.shape.r;
  for (const k of ['dynamic', 'awake', 'spec', 'fric', 'rest', 'sleep', 'vel', 'ang', 'mass', 'invMass', 'held', 'frozen', 'obj', 'persona', 'group', 'noPhys', 'noJug', 'noGrab', 'estatico', 'snd'])
    Object.defineProperty(h, k, { get() { return padre[k]; }, configurable: true });
  return h;
}
function addBody(b) { PH.bodies.push(b); b.updateWorld(); return b; }
function removeBody(b) {
  const i = PH.bodies.indexOf(b); if (i >= 0) PH.bodies.splice(i, 1);
  PH.joints = PH.joints.filter((j) => j.a !== b && j.b !== b);
  for (const o of PH.bodies) if (o.sleep) o.wake();
}
// ---------------- contactos ----------------
// un contacto: cuerpos A y B (B puede ser null = suelo o estático), puntos locales, normal de B hacia A
function mkContact(A, B, pA, pB, n, depth) {
  const c = { A, B, n: n.clone(), rA: v3(), rB: v3(), wB: null, lamN: 0, depth, vnPre: 0 };
  A.q.invRotTo(vsub(pA, A.pos), c.rA);
  if (B && B.dynamic) B.q.invRotTo(vsub(pB, B.pos), c.rB); else c.wB = pB.clone();
  PH.contacts.push(c);
  return c;
}
// SAT entre dos poliedros (en el mundo). Devuelve el eje de menor penetración y sus datos
function faceQuery(A, B, m) {
  let best = -1e9, bi = -1;
  for (let i = 0; i < A.wn.length; i++) {
    const n = A.wn[i], d = vdot(n, A.wv[A.shape.f[i].ix[0]]);
    let mn = 1e9; for (const v of B.wv) { const s = vdot(n, v) - d; if (s < mn) mn = s; }
    if (mn > best) { best = mn; bi = i; }
    if (best > m) return { sep: best, i: bi };
  }
  return { sep: best, i: bi };
}
function edgeQuery(A, B, m) {
  let best = -1e9, axis = null, ea = 0, eb = 0;
  const cA = A.pos, cB = B.pos;
  const dA = A.shape.dirs.map((d) => A.q.rot(d)), dB = B.shape.dirs.map((d) => B.q.rot(d));
  for (let i = 0; i < dA.length; i++) for (let j = 0; j < dB.length; j++) {
    const ax = vcross(dA[i], dB[j]); const l = ax.len(); if (l < 1e-4) continue; ax.scale(1 / l);
    if (vdot(ax, vsub(cA, cB)) < 0) ax.scale(-1);
    let minA = 1e9, maxB = -1e9;
    for (const v of A.wv) { const s = vdot(ax, v); if (s < minA) minA = s; }
    for (const v of B.wv) { const s = vdot(ax, v); if (s > maxB) maxB = s; }
    const sep = minA - maxB;
    if (sep > best) { best = sep; axis = ax; ea = i; eb = j; }
    if (best > m) return { sep: best };
  }
  return { sep: best, axis, ea, eb };
}
// recorta un polígono contra un plano (se queda con lo de adentro: n·p <= d)
function clipPoly(poly, n, d) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = vdot(n, a) - d, db = vdot(n, b) - d;
    if (da <= 0) out.push(a);
    if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push(v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)); }
  }
  return out;
}
// contactos entre dos poliedros: cara contra cara (recortando) o arista contra arista
function hullHull(A, B) {
  const m = A.spec + (B.spec || 0);
  const fa = faceQuery(A, B, m); if (fa.sep > m) return;
  const fb = faceQuery(B, A, m); if (fb.sep > m) return;
  const ee = edgeQuery(A, B, m); if (ee.sep > m) return;
  const faceBest = Math.max(fa.sep, fb.sep);
  if (ee.axis && ee.sep > faceBest + 0.01) {
    // arista contra arista: los puntos más cercanos de las aristas de soporte
    const n = ee.axis;
    const supA = edgeSupport(A, vscale(n, -1), ee.ea), supB = edgeSupport(B, n, ee.eb);
    if (!supA || !supB) return;
    const [p, q] = segClosest(supA[0], supA[1], supB[0], supB[1]);
    const depth = -vdot(vsub(p, q), n);
    if (depth > -m) mkContact(A, B, p, q, n, depth);
    return;
  }
  // cara de referencia: la de menor penetración (con preferencia por A)
  let ref = A, inc = B, fi = fa.i, flip = false;
  if (fb.sep > fa.sep + 0.005) { ref = B; inc = A; fi = fb.i; flip = true; }
  const rn = ref.wn[fi], rf = ref.shape.f[fi], rd = vdot(rn, ref.wv[rf.ix[0]]);
  // cara incidente: la más opuesta a la normal de referencia
  let ii = 0, mn = 1e9; for (let i = 0; i < inc.wn.length; i++) { const s = vdot(inc.wn[i], rn); if (s < mn) { mn = s; ii = i; } }
  let poly = inc.shape.f[ii].ix.map((k) => inc.wv[k].clone());
  // recortar contra los costados de la cara de referencia
  const rv = rf.ix.map((k) => ref.wv[k]);
  for (let i = 0; i < rv.length && poly.length; i++) {
    const a = rv[i], b = rv[(i + 1) % rv.length], sn = vcross(vsub(b, a), rn).norm();
    poly = clipPoly(poly, sn, vdot(sn, a));
  }
  // puntos debajo de la cara de referencia
  let pts = [];
  for (const p of poly) { const s = vdot(rn, p) - rd; if (s <= m) pts.push({ p, depth: -s }); }
  if (pts.length > 4) pts = reduce4(pts, rn);
  for (const c of pts) {
    const onRef = vsub(c.p, vscale(rn, vdot(rn, c.p) - rd));
    // la normal va de B hacia A
    if (!flip) mkContact(A, B, onRef, c.p, vscale(rn, -1), c.depth);   // cara de A: el punto de A está en la cara, el de B es el vértice metido
    else mkContact(A, B, c.p, onRef, rn, c.depth);                    // cara de B: el vértice de A metido y su proyección en la cara de B
  }
}
// poliedro contra un triángulo de las formas propias (rampas): sólo vértices contra la cara, con la normal de la cara.
// Así lo que se desliza no se traba en las aristas internas entre triángulos (los choques de arista daban normales
// falsas y frenaban de golpe un auto a 35 m/s)
function hullTri(A, B) {
  const T = MUNDO.T, o = B.tri * 9, m = A.spec + (B.spec || 0);
  const a = v3(T[o], T[o + 1], T[o + 2]), e0 = v3(T[o + 3] - a.x, T[o + 4] - a.y, T[o + 5] - a.z), e1 = v3(T[o + 6] - a.x, T[o + 7] - a.y, T[o + 8] - a.z);
  const d00 = vdot(e0, e0), d01 = vdot(e0, e1), d11 = vdot(e1, e1), den = d00 * d11 - d01 * d01; if (Math.abs(den) < 1e-12) return;
  const n = B.tn.clone(); if (vdot(vsub(A.pos, a), n) < 0) n.scale(-1);
  let pts = [];
  for (const v of A.wv) {
    const s = vdot(vsub(v, a), n); if (s > m || s < -1.2) continue;
    const q = vsub(v, vscale(n, s)), w = vsub(q, a), d20 = vdot(w, e0), d21 = vdot(w, e1);
    const bv = (d11 * d20 - d01 * d21) / den, bw = (d00 * d21 - d01 * d20) / den;
    if (bv < -0.02 || bw < -0.02 || bv + bw > 1.02) continue;
    pts.push({ p: v, q, depth: -s });
  }
  if (pts.length > 4) pts = reduce4(pts, n);
  for (const c of pts) mkContact(A, B, c.p, c.q, n, c.depth);
}
function reduce4(pts, n) {
  // el más hondo, el más lejano a él, y los dos que más área agregan
  pts.sort((a, b) => b.depth - a.depth);
  const out = [pts[0]]; let far = null, fd = -1;
  for (const p of pts) { const d = vsub(p.p, out[0].p).lenSq(); if (d > fd) { fd = d; far = p; } }
  out.push(far);
  const area = (a, b, c) => vdot(vcross(vsub(b.p, a.p), vsub(c.p, a.p)), n);
  let p3 = null, best = -1e9; for (const p of pts) { const s = area(out[0], out[1], p); if (s > best) { best = s; p3 = p; } } if (p3) out.push(p3);
  let p4 = null; best = 1e9; for (const p of pts) { const s = area(out[0], out[1], p); if (s < best) { best = s; p4 = p; } } if (p4 && p4 !== p3) out.push(p4);
  return out;
}
function edgeSupport(H, n, di) {
  // arista de H más metida hacia n con dirección parecida a la dirección di
  const d = H.q.rot(H.shape.dirs[di]); let best = -1e9, res = null;
  for (const [i, j] of H.shape.e) {
    const a = H.wv[i], b = H.wv[j], e = vsub(b, a).norm(); if (Math.abs(vdot(e, d)) < 0.99) continue;
    const s = vdot(n, a) + vdot(n, b); if (s > best) { best = s; res = [a, b]; }
  }
  return res;
}
function segClosest(p1, q1, p2, q2) {
  const d1 = vsub(q1, p1), d2 = vsub(q2, p2), r = vsub(p1, p2), a = vdot(d1, d1), e = vdot(d2, d2), f = vdot(d2, r);
  let s, t;
  if (a < 1e-9 && e < 1e-9) return [p1.clone(), p2.clone()];
  if (a < 1e-9) { s = 0; t = clamp(f / e, 0, 1); }
  else { const c = vdot(d1, r); if (e < 1e-9) { t = 0; s = clamp(-c / a, 0, 1); } else { const b = vdot(d1, d2), den = a * e - b * b; s = den > 1e-9 ? clamp((b * f - c * e) / den, 0, 1) : 0; t = (b * s + f) / e; if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); } } }
  return [vadd(p1, vscale(d1, s)), vadd(p2, vscale(d2, t))];
}
// punto de un poliedro más cercano a p (y si p está adentro)
function hullClosest(H, p) {
  let maxS = -1e9, fi = 0;
  for (let i = 0; i < H.wn.length; i++) { const s = vdot(H.wn[i], p) - vdot(H.wn[i], H.wv[H.shape.f[i].ix[0]]); if (s > maxS) { maxS = s; fi = i; } }
  if (maxS <= 0) { const n = H.wn[fi]; return { p: vsub(p, vscale(n, maxS)), inside: true, n: n.clone(), d: maxS }; }
  // afuera: proyección sobre la cara, recortada al polígono; si cae afuera, el más cercano entre aristas
  const f = H.shape.f[fi], n = H.wn[fi], q = vsub(p, vscale(n, maxS));
  const vs = f.ix.map((k) => H.wv[k]);
  let inPoly = true;
  for (let i = 0; i < vs.length; i++) { const a = vs[i], b = vs[(i + 1) % vs.length]; if (vdot(vcross(vsub(b, a), vsub(q, a)), n) < -1e-6) { inPoly = false; break; } }
  if (inPoly) return { p: q, inside: false };
  let best = null, bd = 1e9;
  for (const [i, j] of H.shape.e) {
    const a = H.wv[i], b = H.wv[j], ab = vsub(b, a), t = clamp(vdot(vsub(p, a), ab) / vdot(ab, ab), 0, 1), c = vadd(a, vscale(ab, t)), d = vsub(p, c).lenSq();
    if (d < bd) { bd = d; best = c; }
  }
  return { p: best, inside: false };
}
function sphereHull(A, ca, r, H, flipAB) {
  const c = hullClosest(H, ca);
  let n, depth, pS;
  if (c.inside) { n = c.n; depth = r - c.d; pS = vsub(ca, vscale(n, r)); }
  else { const d = vsub(ca, c.p), L = d.len(); if (L >= r + A.spec + (H.spec || 0) || L < 1e-9) return; n = d.scale(1 / L); depth = r - L; pS = vsub(ca, vscale(n, r)); }
  if (!flipAB) mkContact(A, H, pS, c.p, n, depth);
  else mkContact(H, A, c.p, pS, vscale(n, -1), depth);
}
function sphereSphere(A, ca, ra, B, cb, rb) {
  const d = vsub(ca, cb), L = d.len(); if (L >= ra + rb + A.spec + (B.spec || 0) || L < 1e-9) return;
  const n = d.scale(1 / L); mkContact(A, B, vsub(ca, vscale(n, ra)), vadd(cb, vscale(n, rb)), n, ra + rb - L);
}
// las cápsulas se tratan como esferas a lo largo del eje (alcanza para el muñeco)
function capSpheres(b) { const A = b.capA, B = b.capB; return [A, vscale(vadd(A, B), 0.5), B]; }
const _wp = v3();
function contactosAlPadre(n0, PA, PB, a, b) {
  for (let i = n0; i < PH.contacts.length; i++) {
    const c = PH.contacts[i];
    if (a !== PA) { a.q.rotTo(c.rA, _wp).add(a.pos); PA.q.invRotTo(_wp.sub(PA.pos), c.rA); c.A = PA; }
    if (b !== PB) { if (!c.wB) { b.q.rotTo(c.rB, _wp).add(b.pos); PB.q.invRotTo(_wp.sub(PB.pos), c.rB); } c.B = PB; }
  }
}
function collidePair(A, B) {
  if (A.hijos || B.hijos) {
    const LA = A.hijos || [A], LB = B.hijos || [B], m = A.spec + (B.spec || 0) + 0.02;
    for (const a of LA) {
      const p = a.aabb;
      for (const b of LB) {
        const q = b.aabb;
        if (p.x0 > q.x1 + m || p.x1 < q.x0 - m || p.y0 > q.y1 + m || p.y1 < q.y0 - m || p.z0 > q.z1 + m || p.z1 < q.z0 - m) continue;
        const n0 = PH.contacts.length; collidePair(a, b); contactosAlPadre(n0, A, B, a, b);
      }
    }
    return;
  }
  const ta = A.shape.type, tb = B.shape.type;
  if (ta === 'hull' && B.propio) return hullTri(A, B);
  if (ta === 'hull' && tb === 'hull') return hullHull(A, B);
  if (ta === 'sphere' && tb === 'hull') return sphereHull(A, A.pos, A.shape.r, B, false);
  if (ta === 'hull' && tb === 'sphere') return sphereHull(B, B.pos, B.shape.r, A, true);
  if (ta === 'sphere' && tb === 'sphere') return sphereSphere(A, A.pos, A.shape.r, B, B.pos, B.shape.r);
  const sa = ta === 'capsule' ? capSpheres(A) : ta === 'sphere' ? [A.pos] : null, sb = tb === 'capsule' ? capSpheres(B) : tb === 'sphere' ? [B.pos] : null;
  const ra = ta === 'hull' ? 0 : A.shape.r, rb = tb === 'hull' ? 0 : B.shape.r;
  if (sa && sb) { let best = null; for (const p of sa) for (const q of sb) { const d = vsub(p, q).len(); if (!best || d < best.d) best = { p, q, d }; } if (best) sphereSphere(A, best.p, ra, B, best.q, rb); return; }
  if (sa) for (const p of sa) sphereHull(A, p, ra, B, false);
  else for (const q of sb) sphereHull(B, q, rb, A, true);
}
const _near = [];
function detect(dt) {
  PH.contacts.length = 0;
  const B = PH.bodies;
  // margen especulativo: lo que el cuerpo puede llegar a moverse en este cuadro (así el contacto ya existe
  // antes de meterse y el choque no se resuelve empujando de golpe)
  let mx = 0;
  for (const b of B) {
    if (!b.sleep) b.updateWorld();
    b.spec = b.dynamic && !b.sleep ? Math.min(1.5, 0.01 + (b.vel.len() + b.ang.len() * b.r) * dt * 1.3 + GRAV * dt * dt) : 0.005;
    if (b.spec > mx) mx = b.spec;
  }
  for (let i = 0; i < B.length; i++) {
    const a = B[i];
    if (a.sleep && !a.held) continue;
    if (!a.dynamic) continue;
    const A = a.aabb, m = a.spec + 0.02;
    mundoCerca(A.x0 - m, A.y0 - m, A.z0 - m, A.x1 + m, A.y1 + m, A.z1 + m, _near);
    for (const s of _near) collidePair(a, s);
  }
  // pares de cuerpos (barrido por x)
  const order = B.slice().sort((p, q) => p.aabb.x0 - q.aabb.x0);
  for (let i = 0; i < order.length; i++) {
    const a = order[i], A = a.aabb;
    for (let j = i + 1; j < order.length; j++) {
      const b = order[j], Bb = b.aabb;
      if (Bb.x0 > A.x1 + 2 * mx + 0.02) break;
      const g = a.spec + b.spec + 0.02;
      if (Bb.x0 > A.x1 + g || Bb.y0 > A.y1 + g || Bb.y1 < A.y0 - g || Bb.z0 > A.z1 + g || Bb.z1 < A.z0 - g) continue;
      if (!a.dynamic && !b.dynamic) continue;
      if ((a.sleep || !a.dynamic) && (b.sleep || !b.dynamic)) continue;
      if (a.group && a.group === b.group) continue;
      if (a.noPhys || b.noPhys) continue;
      if (a.noCollide && a.noCollide.has(b)) continue;
      const n0 = PH.contacts.length;
      if (a.dynamic) collidePair(a, b); else collidePair(b, a);
      if (PH.contacts.length > n0) { if (a.sleep && b.lively) a.wake(); if (b.sleep && a.lively) b.wake(); }
    }
  }
  // las partes unidas (muñeco) se despiertan juntas
  for (let k = 0; k < 3; k++) for (const j of PH.joints) if (j.a.sleep !== j.b.sleep) { j.a.wake(); j.b.wake(); }
}

// ---------------- uniones (muñeco de trapo) ----------------
// una unión esférica con cono de giro (swing) y límite de torsión (twist), o bisagra (hinge)
function addJoint(a, b, worldPt, axisWorld, opt) {
  opt = opt || {};
  const j = { a, b, pa: a.q.conj().rot(vsub(worldPt, a.pos)), pb: b.q.conj().rot(vsub(worldPt, b.pos)), swing: opt.swing === undefined ? 0.8 : opt.swing, twist: opt.twist === undefined ? 0.5 : opt.twist, hinge: !!opt.hinge, lo: opt.lo || 0, hi: opt.hi || 0 };
  // ejes de referencia en cada cuerpo (el eje de la unión y un perpendicular)
  const ax = axisWorld.clone().norm(), perp = Math.abs(ax.y) < 0.9 ? vcross(ax, v3(0, 1, 0)).norm() : vcross(ax, v3(1, 0, 0)).norm();
  j.axA = a.q.conj().rot(ax); j.axB = b.q.conj().rot(ax); j.pA = a.q.conj().rot(perp); j.pB = b.q.conj().rot(perp);
  if (opt.hingeAxis) { const h = opt.hingeAxis.clone().norm(); j.hA = a.q.conj().rot(h); j.hB = b.q.conj().rot(h); }
  a.jointed = b.jointed = true;
  PH.joints.push(j); return j;
}
// corrección angular: girar a y b para achicar el ángulo 'ang' alrededor de 'n' (mundo)
function applyRot(a, b, n, ang) {
  const ta = a.dynamic ? a.invIw(n, new V3()) : v3(), tb = b.dynamic ? b.invIw(n, new V3()) : v3();
  const w = n.dot(ta) + n.dot(tb); if (w < 1e-9) return;
  const l = ang / w;
  if (a.dynamic) a.q.integrate(vscale(ta, l), 1);
  if (b.dynamic) b.q.integrate(vscale(tb, -l), 1);
}
function solveJoint(j) {
  const a = j.a, b = j.b;
  // 1) los puntos de enganche coinciden
  const ra = a.q.rot(j.pa), rb = b.q.rot(j.pb);
  const d = vsub(vadd(b.pos, rb), vadd(a.pos, ra)), L = d.len();
  if (L > 1e-6) {
    const n = vscale(d, 1 / L), w = a.wAt(ra, n) + b.wAt(rb, n);
    if (w > 1e-9) { const p = vscale(n, L / w); a.applyPos(p, ra, 1); b.applyPos(p, rb, -1); }
  }
  const A1 = a.q.rot(j.axA), B1 = b.q.rot(j.axB);
  if (j.hinge) {
    // bisagra: alinear ejes y limitar el ángulo
    const hA = a.q.rot(j.hA), hB = b.q.rot(j.hB), c = vcross(hA, hB), s = c.len();
    if (s > 1e-5) applyRot(a, b, c.scale(1 / s), Math.asin(Math.min(1, s)));
    const hA2 = a.q.rot(j.hA), pa = a.q.rot(j.axA), pb = b.q.rot(j.axB);
    const ang = Math.atan2(vdot(vcross(pa, pb), hA2), vdot(pa, pb));
    if (ang < j.lo) applyRot(a, b, hA2, ang - j.lo); else if (ang > j.hi) applyRot(a, b, hA2, ang - j.hi);
    return;
  }
  // 2) cono de giro
  const cs = clamp(vdot(A1, B1), -1, 1), sw = Math.acos(cs);
  if (sw > j.swing) { const n = vcross(A1, B1); const l = n.len(); if (l > 1e-6) applyRot(a, b, n.scale(1 / l), sw - j.swing); }
  // 3) torsión alrededor del eje
  if (j.twist < Math.PI) {
    const A2 = a.q.rot(j.axA), B2 = b.q.rot(j.axB), n = vadd(A2, B2).norm();
    const pa = a.q.rot(j.pA), pb = b.q.rot(j.pB);
    const pa2 = vsub(pa, vscale(n, vdot(n, pa))).norm(), pb2 = vsub(pb, vscale(n, vdot(n, pb))).norm();
    const tw = Math.atan2(vdot(vcross(pa2, pb2), n), vdot(pa2, pb2));
    if (Math.abs(tw) > j.twist) applyRot(a, b, n, tw - Math.sign(tw) * j.twist);
  }
}

// ---------------- el paso de la simulación ----------------
const MAXDEP = 4, BOUNCE_V = 0.5;   // m/s: lo más rápido que se separa algo metido; bajo esto no rebota
// velocidad relativa normal en el punto de contacto (negativa = se acercan)
function contactVn(c) {
  const A = c.A, rA = A.q.rot(c.rA), vA = vadd(A.vel, vcross(A.ang, rA));
  if (c.wB) return vdot(vA, c.n);
  const vB = vadd(c.B.vel, vcross(c.B.ang, c.B.q.rot(c.rB)));
  return vdot(vsub(vA, vB), c.n);
}
function solveContactPos(c, h) {
  const A = c.A, B = c.B;
  const rA = A.q.rot(c.rA), pA = vadd(A.pos, rA);
  let rB = null, pB;
  if (c.wB) pB = c.wB; else { rB = B.q.rot(c.rB); pB = vadd(B.pos, rB); }
  const n = c.n, sep = vdot(vsub(pA, pB), n);
  if (sep >= 0) { c.active = false; return; }
  c.active = true;
  if (!c.hit && c.vnPre < -2.2) { c.hit = true; if (PH.time - A.lastHit > 0.12) { A.lastHit = PH.time; PH.hits.push({ b: A, o: B, v: -c.vnPre, p: pA }); } }
  const wA = A.wAt(rA, n), wB = rB ? B.wAt(rB, n) : 0, w = wA + wB; if (w < 1e-9) return;
  const dl = Math.min(-sep, MAXDEP * h) / w; c.lamN += dl;
  const p = vscale(n, dl);
  A.applyPos(p, rA, 1); if (rB) B.applyPos(p, rB, -1);
  // fricción: lo que el punto patinó en este subpaso se deshace entero (estática) o hasta lo que da el cono (dinámica)
  const pA0 = vadd(A.prevPos, A.prevQ.rot(c.rA)), pB0 = rB ? vadd(B.prevPos, B.prevQ.rot(c.rB)) : pB;
  const rA2 = A.q.rot(c.rA), rB2 = rB ? B.q.rot(c.rB) : null;
  const pA1 = vadd(A.pos, rA2), pB1 = rB ? vadd(B.pos, rB2) : pB;
  const dp = vsub(vsub(pA1, pA0), vsub(pB1, pB0)), dpt = vsub(dp, vscale(n, vdot(dp, n))), tl = dpt.len();
  if (tl > 1e-9) {
    const mu = Math.sqrt(A.fric * (B ? B.fric : 0.7)), t = vscale(dpt, 1 / tl);
    const wt = A.wAt(rA2, t) + (rB2 ? B.wAt(rB2, t) : 0);
    if (wt > 1e-9) {
      let dlt = tl / wt; const lim = mu * c.lamN;
      if (dlt > lim * 1.25) dlt = lim * 0.9;     // patina: fricción dinámica algo menor que la estática
      const pt = vscale(t, -dlt); A.applyPos(pt, rA2, 1); if (rB2) B.applyPos(pt, rB2, -1);
    }
  }
}
// velocidades: sacar la velocidad artificial del empuje y dejar sólo el rebote
function solveContactVel(c) {
  if (!c.active) return;
  const A = c.A, B = c.B, n = c.n;
  const rA = A.q.rot(c.rA), rB = c.wB ? null : B.q.rot(c.rB);
  const vn = contactVn(c);
  const e = c.vnPre > -BOUNCE_V ? 0 : Math.max(A.rest, B ? B.rest : 0.2);
  const target = Math.max(-e * c.vnPre, 0), dv = target - vn;
  if (Math.abs(dv) < 1e-6) return;
  const w = A.wAt(rA, n) + (rB ? B.wAt(rB, n) : 0); if (w < 1e-9) return;
  const p = vscale(n, dv / w);
  A.applyVel(p, rA, 1); if (rB) B.applyVel(p, rB, -1);
}
function physStep(dt) {
  PH.time += dt;
  detect(dt);
  const B = PH.bodies, n = PH.sub, h = dt / n, C = PH.contacts;
  for (let s = 0; s < n; s++) {
    for (const b of B) {
      if (!b.dynamic || b.sleep) continue;
      b.prevPos.copy(b.pos); b.prevQ.copy(b.q);
      if (!b.held) b.vel.y -= GRAV * (PH.gscale || 1) * h;
      b.pos.addS(b.vel, h);
      b.q.integrate(b.ang, h);
    }
    // velocidad con la que llega cada contacto (para el rebote y el ruido)
    for (const c of C) c.vnPre = contactVn(c);
    if (typeof alImpacto === 'function') for (const c of C) if (c.vnPre < -3.2 && c.A.ragdoll && c.A.ragdoll.vuela && (!c.B || !c.B.dynamic)) alImpacto(c);
    for (const j of PH.joints) solveJoint(j);
    for (const c of C) { if ((c.A.dynamic && !c.A.sleep) || (c.B && c.B.dynamic && !c.B.sleep)) solveContactPos(c, h); }
    for (const b of B) {
      if (!b.dynamic || b.sleep) continue;
      b.vel.set((b.pos.x - b.prevPos.x) / h, (b.pos.y - b.prevPos.y) / h, (b.pos.z - b.prevPos.z) / h);
      const dq = new Quat().mulTo(b.q, b.prevQ.conj());
      const k = (dq.w >= 0 ? 2 : -2) / h; b.ang.set(dq.x * k, dq.y * k, dq.z * k);
    }
    for (let it = 0, ni = PH.velIter || 2; it < ni; it++) for (const c of C) solveContactVel(c);
    for (const c of C) c.lamN = 0;
  }
  // dormir lo que quedó quieto (y amortiguar un poco el giro eterno)
  for (const b of B) {
    b.calm = true; if (!b.dynamic || b.sleep) continue;
    b.ang.scale(Math.exp(-dt * (0.12 + b.angDamp))); b.vel.scale(Math.exp(-dt * (0.02 + b.damp)));
    if (b.pos.y < -300) b.dead = true;
    if (b.held) { b.wake(); b.calm = false; continue; }
    // las partes de un muñeco tiemblan un poco entre sus uniones: umbral más flojo
    if (b.vel.lenSq() < (b.jointed ? 0.03 : 0.012) && b.ang.lenSq() < (b.jointed ? 0.5 : 0.03)) b.sleepT += dt; else b.sleepT = 0;
    // además: si en un segundo casi no se movió de lugar (tiembla en el mismo sitio), también está quieto
    if (!b.anc) { b.anc = b.pos.clone(); b.ancQ = b.q.clone(); b.ancT = 0; }
    const dq = Math.abs(b.q.x * b.ancQ.x + b.q.y * b.ancQ.y + b.q.z * b.ancQ.z + b.q.w * b.ancQ.w);
    if (b.pos.distTo(b.anc) > 0.016 || dq < 0.99966) { b.anc.copy(b.pos); b.ancQ.copy(b.q); b.ancT = 0; } else b.ancT += dt;
    b.calm = b.sleepT > 0.7 || b.ancT > 1.0;
  }
  // un muñeco se duerme entero o nada
  for (let k = 0; k < 3; k++) for (const j of PH.joints) if (j.a.calm !== j.b.calm) j.a.calm = j.b.calm = false;
  for (const b of B) if (b.calm && !b.sleep && b.dynamic) { b.sleep = true; b.vel.set(0, 0, 0); b.ang.set(0, 0, 0); }
}

// ---------------- rayos (para apuntar, crear cosas y la cámara) ----------------
function rayHull(H, o, d, tmax) {
  let t0 = 0, t1 = tmax, nIn = null;
  for (let i = 0; i < H.wn.length; i++) {
    const n = H.wn[i], dd = vdot(n, H.wv[H.shape.f[i].ix[0]]), den = vdot(n, d), dist = dd - vdot(n, o);
    if (Math.abs(den) < 1e-9) { if (dist < 0) return null; continue; }
    const t = dist / den;
    if (den < 0) { if (t > t0) { t0 = t; nIn = n; } } else if (t < t1) t1 = t;
    if (t0 > t1) return null;
  }
  return nIn ? { t: t0, n: nIn.clone() } : null;
}
function raySphere(c, r, o, d, tmax) {
  const m = vsub(o, c), b = vdot(m, d), cc = vdot(m, m) - r * r; if (cc > 0 && b > 0) return null;
  const disc = b * b - cc; if (disc < 0) return null; const t = -b - Math.sqrt(disc); if (t < 0 || t > tmax) return null;
  return { t, n: vsub(vadd(o, vscale(d, t)), c).norm() };
}
function rayForma(b, o, d, L) {
  if (b.shape.type === 'hull') return rayHull(b, o, d, L);
  if (b.shape.type === 'sphere') return raySphere(b.pos, b.shape.r, o, d, L);
  let h = null; for (const p of capSpheres(b)) { const k = raySphere(p, b.shape.r, o, d, h ? h.t : L); if (k && (!h || k.t < h.t)) h = k; } return h;
}
// el rayo contra todo: devuelve { t, n, p, body (o null), stat (caja estática o null) }
function raycast(o, d, tmax, ignore) {
  let best = null;
  const g = mundoRayo(o, d, tmax); if (g) best = { t: g.t, n: g.n, body: null, stat: g, ground: true };
  const lim = () => (best ? best.t : tmax);
  for (const b of PH.bodies) {
    if (b.noRay || (ignore && (ignore === b || (ignore.has && ignore.has(b))))) continue;
    const L = lim(), c = b.pos, m = vsub(c, o), tc = vdot(m, d); if (tc < -b.r || tc > L + b.r) continue;
    if (m.lenSq() - tc * tc > b.r * b.r) continue;
    if (b.sleep || !b.capA && b.shape.type === 'capsule') b.updateWorld();
    let h = null;
    if (b.hijos) { for (const c of b.hijos) { const k = rayForma(c, o, d, h ? h.t : L); if (k && (!h || k.t < h.t)) h = k; } }
    else h = rayForma(b, o, d, L);
    if (h && h.t < lim()) best = { t: h.t, n: h.n, body: b, stat: null };
  }
  if (best) best.p = vadd(o, vscale(d, best.t));
  return best;
}
