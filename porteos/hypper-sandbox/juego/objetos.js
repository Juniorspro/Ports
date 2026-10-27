// ---------------------------------------------------------------------------------------------------------
// objetos del menú (props): el modelo del juego + un cuerpo rígido armado con sus colliders (casco convexo
// de las cajas/mallas; esfera o cápsula si es eso solo) y su masa del Rigidbody original.
// ---------------------------------------------------------------------------------------------------------
const OBJS = [];
let _objId = 1;
// casco convexo (incremental): devuelve vértices y caras (polígonos con las coplanares unidas)
function cascoConvexo(P) {
  const n = P.length; if (n < 4) return null;
  // reducir: extremos en 26 direcciones si hay muchos puntos
  if (n > 16) {
    // pocos puntos = choques baratos: los extremos en 14 direcciones (ejes y diagonales)
    const D = []; for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if ((x || y || z) && (Math.abs(x) + Math.abs(y) + Math.abs(z) !== 2)) D.push(v3(x, y, z).norm());
    const S = new Set(); for (const d of D) { let bi = 0, bv = -1e9; for (let i = 0; i < n; i++) { const s = vdot(P[i], d); if (s > bv) { bv = s; bi = i; } } S.add(bi); }
    P = [...S].map((i) => P[i]); if (P.length < 4) return null;
  }
  // tetraedro inicial
  let i0 = 0, i1 = 0; for (let i = 1; i < P.length; i++) { if (P[i].x < P[i0].x) i0 = i; if (P[i].x > P[i1].x) i1 = i; }
  if (i0 === i1) i1 = (i0 + 1) % P.length;
  const lineD = (i) => { const ab = vsub(P[i1], P[i0]), ap = vsub(P[i], P[i0]); return vcross(ab, ap).lenSq(); };
  let i2 = -1, bd = 1e-12; for (let i = 0; i < P.length; i++) { const d = lineD(i); if (d > bd) { bd = d; i2 = i; } } if (i2 < 0) return null;
  const nrm = vcross(vsub(P[i1], P[i0]), vsub(P[i2], P[i0])).norm();
  let i3 = -1; bd = 1e-6; for (let i = 0; i < P.length; i++) { const d = Math.abs(vdot(nrm, vsub(P[i], P[i0]))); if (d > bd) { bd = d; i3 = i; } } if (i3 < 0) return null;
  let F = [];
  const mkF = (a, b, c) => { const nn = vcross(vsub(P[b], P[a]), vsub(P[c], P[a])); const l = nn.len(); if (l < 1e-12) return null; nn.scale(1 / l); return { v: [a, b, c], n: nn, d: vdot(nn, P[a]) }; };
  const cen = vscale(vadd(vadd(P[i0], P[i1]), vadd(P[i2], P[i3])), 0.25);
  for (const t of [[i0, i1, i2], [i0, i2, i3], [i0, i3, i1], [i1, i3, i2]]) { let f = mkF(t[0], t[1], t[2]); if (vdot(f.n, cen) - f.d > 0) f = mkF(t[0], t[2], t[1]); F.push(f); }
  const eps = 1e-6;
  for (let p = 0; p < P.length; p++) {
    if (p === i0 || p === i1 || p === i2 || p === i3) continue;
    const vis = F.filter((f) => vdot(f.n, P[p]) - f.d > eps); if (!vis.length) continue;
    const ed = new Map();
    for (const f of vis) for (let k = 0; k < 3; k++) { const a = f.v[k], b = f.v[(k + 1) % 3]; ed.set(a + ',' + b, [a, b]); }
    const hor = []; for (const [k, e] of ed) if (!ed.has(e[1] + ',' + e[0])) hor.push(e);
    F = F.filter((f) => !vis.includes(f));
    for (const e of hor) { const f = mkF(e[0], e[1], p); if (f) F.push(f); }
  }
  // unir caras coplanares en polígonos
  const grupos = [];
  for (const f of F) { let g = grupos.find((g) => vdot(g.n, f.n) > 0.9995 && Math.abs(g.d - f.d) < 2e-3); if (!g) grupos.push((g = { n: f.n, d: f.d, s: new Set() })); f.v.forEach((i) => g.s.add(i)); }
  const usados = new Map(), V = [], caras = [];
  const idx = (i) => { if (!usados.has(i)) { usados.set(i, V.length); V.push(P[i].clone()); } return usados.get(i); };
  for (const g of grupos) {
    const ids = [...g.s]; const c = ids.reduce((a, i) => a.add(P[i]), v3()).scale(1 / ids.length);
    const u = vsub(P[ids[0]], c).norm(), w = vcross(g.n, u);
    ids.sort((a, b) => { const pa = vsub(P[a], c), pb = vsub(P[b], c); return Math.atan2(vdot(pa, w), vdot(pa, u)) - Math.atan2(vdot(pb, w), vdot(pb, u)); });
    // sacar los puntos alineados (en medio de una arista)
    const lim = ids.filter((id, k) => { const a = P[ids[(k + ids.length - 1) % ids.length]], b = P[id], d = P[ids[(k + 1) % ids.length]]; return vcross(vsub(b, a), vsub(d, b)).len() > 1e-7; });
    if (lim.length >= 3) caras.push(lim.map(idx));
  }
  return { v: V, f: caras };
}
// puntos de los colliders de un árbol en el marco de la raíz
function formaDeArbol(arb) {
  const md = new Modelo(arb); md.p[0] = [0, 0, 0]; md.sucio = true; md.actualizar();
  const pts = [], solos = []; let tr = 0;
  const pt = v3();
  for (let i = 0; i < arb.length; i++) {
    const x = arb[i]; if (!md.act[i] || !x.col) continue;
    const W = md.W[i];
    for (const c of x.col) {
      if (c.tr) { tr++; continue; }
      if (c.k === 'b') { for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) pts.push(m4pt(W, c.c[0] + c.s[0] * sx, c.c[1] + c.s[1] * sy, c.c[2] + c.s[2] * sz, v3())); }
      else if (c.k === 's' || c.k === 'c') {
        const s = m4esc(W), r = c.r * s, cen = m4pt(W, c.c[0], c.c[1], c.c[2], v3()), hh = c.k === 'c' ? Math.max(0, c.h * s / 2 - r) : 0;
        const ax = c.k === 'c' ? m4pt(W, c.d === 0 ? 1 : 0, c.d === 1 ? 1 : 0, c.d === 2 ? 1 : 0, v3()).sub(m4pt(W, 0, 0, 0, v3())).norm() : v3(0, 1, 0);
        solos.push({ k: c.k, c: cen, r, hh, ax });
        for (let a = 0; a < 8; a++) for (const e of [-1, 1]) { const ang = a / 8 * TAU; const d = v3(Math.cos(ang) * r, 0, Math.sin(ang) * r); pts.push(vadd(cen, d).addS(ax, e * hh)); }
        pts.push(vadd(cen, vscale(ax, hh + r)), vsub(cen, vscale(ax, hh + r)));
      } else if (c.k === 'm' && c.m >= 0) {
        const mc = mallaCPU(c.m), P = mc.P, step = Math.max(1, Math.floor(P.length / 3 / 400));
        for (let k = 0; k < P.length; k += 3 * step) pts.push(m4pt(W, P[k], P[k + 1], P[k + 2], v3()));
      }
    }
  }
  // sin colliders: la caja de las mallas que se ven
  if (!pts.length) {
    for (let i = 0; i < arb.length; i++) {
      const x = arb[i]; if (!md.ver[i]) continue; const d = DATA.ms[x.m];
      for (const sx of [0, 1]) for (const sy of [0, 1]) for (const sz of [0, 1]) pts.push(m4pt(md.W[i], d.mn[0] + d.sc[0] * sx, d.mn[1] + d.sc[1] * sy, d.mn[2] + d.sc[2] * sz, v3()));
    }
  }
  if (!pts.length) pts.push(v3(-0.2, -0.2, -0.2), v3(0.2, 0.2, 0.2), v3(-0.2, 0.2, 0.2), v3(0.2, -0.2, -0.2));
  if (solos.length === 1 && pts.length === (solos[0].k === 's' ? 18 : 18)) {
    const s = solos[0];
    if (s.k === 's') return { shape: sphereShape(Math.max(0.02, s.r)), c: s.c, sinCol: !tr && false };
    return { shape: capsuleShape(s.r, s.hh), c: s.c, ejeCap: s.ax };
  }
  const cs = cascoConvexo(pts);
  if (!cs) { let lo = v3(1e9, 1e9, 1e9), hi = v3(-1e9, -1e9, -1e9); for (const p of pts) { lo.set(Math.min(lo.x, p.x), Math.min(lo.y, p.y), Math.min(lo.z, p.z)); hi.set(Math.max(hi.x, p.x), Math.max(hi.y, p.y), Math.max(hi.z, p.z)); }
    const c = vscale(vadd(lo, hi), 0.5), h = vscale(vsub(hi, lo), 0.5); return { shape: boxShape(Math.max(h.x, 0.02), Math.max(h.y, 0.02), Math.max(h.z, 0.02)), c }; }
  const c = cs.v.reduce((a, p) => a.add(p), v3()).scale(1 / cs.v.length);
  const vs = cs.v.map((p) => vsub(p, c));
  const sh = hullFrom(vs, cs.f);
  for (const f of sh.f) if (vdot(f.n, vs[f.ix[0]]) < 0) { f.ix.reverse(); f.n.scale(-1); f.d = -f.d; }
  // como mucho 8 direcciones de aristas (las casi paralelas se juntan): la prueba arista-arista cuesta n²
  if (sh.dirs.length > 8) { const D = []; for (const d of sh.dirs) if (!D.some((u) => Math.abs(vdot(u, d)) > 0.93)) D.push(d); sh.dirs = D.slice(0, 8); }
  return { shape: sh, c, soloGatillo: !pts.length && tr > 0 };
}
const _formas = {};
function formaDe(nombre) { if (!_formas[nombre]) _formas[nombre] = formaDeArbol(DATA.pf[DATA.pfPorNombre[nombre]]); return _formas[nombre]; }
// tipo de cosa según los scripts del prefab
function tipoDe(arb) {
  const mb = arb[0].mb || [];
  if (mb.includes('Vehicle') || mb.includes('RB_Controller')) return 'vehiculo';
  if (mb.includes('ExplodeProp')) return 'explota';
  if (mb.includes('InteractableProp')) return 'interactivo';
  if (mb.includes('WeaponProp')) return 'arma';
  return 'prop';
}
function crearObjeto(nombre, pos, q, opt) {
  opt = opt || {};
  const key = DATA.pfPorNombre[nombre]; if (!key) return null;
  const arb = DATA.pf[key], F = formaDe(nombre);
  const md = new Modelo(arb); md.p[0] = [0, 0, 0];
  const rb = arb[0].rb, masa = opt.masa || (rb ? Math.max(0.5, rb.m) : 20);
  const tipo = tipoDe(arb);
  const b = new Body(F.shape, masa, { fric: 0.6, rest: nombre === 'bouncy_ball' ? 0.92 : 0.12 });
  b.q.copy(q || new Quat());
  if (F.ejeCap) { const r = new Quat(); const a = F.ejeCap; const d = vdot(a, v3(0, 1, 0)); if (d < 0.999) { const ax = vcross(v3(0, 1, 0), a).norm(); r.copy(Quat.axis(ax.x, ax.y, ax.z, Math.acos(clamp(d, -1, 1)))); } b.capQ = r; b.q.mul(r); }
  // la posición pedida es la del piso: subir para que la base quede apoyada
  let minY = 0;
  if (F.shape.type === 'hull') { minY = 1e9; for (const v of F.shape.v) minY = Math.min(minY, b.q.rot(v).y); }
  else minY = -(F.shape.r + (F.shape.hh || 0));
  b.pos.set(pos.x, pos.y - minY + 0.01, pos.z);
  if (opt.exacto) { const c = b.q.rot(F.c); b.pos.copy(pos).add(c); }
  b.updateWorld();
  const o = { id: opt.id || _objId++, nombre, tipo, md, b, c: F.c, F, creado: TIEMPO.t, dueno: opt.dueno || 'yo' };
  b.obj = o; b.snd = masa > 300 ? 'metal' : 'wood';
  if (opt.congelado) b.frozen = true;
  if (F.soloGatillo || /^decal_/.test(nombre)) { b.noPhys = true; b.frozen = true; }
  if (/^(Bush)$/.test(nombre)) b.noPhys = true;
  addBody(b); OBJS.push(o);
  if (tipo === 'vehiculo' && typeof vehiculoNuevo === 'function') vehiculoNuevo(o);
  if (tipo === 'explota' || tipo === 'interactivo') o.vidaObj = 1;
  return o;
}
function borrarObjeto(o, local) {
  if (!local && typeof redBorrar === 'function') redBorrar(o);
  const i = OBJS.indexOf(o); if (i >= 0) OBJS.splice(i, 1);
  removeBody(o.b); if (o.veh && typeof vehiculoBorrar === 'function') vehiculoBorrar(o);
  if (JUG.vehiculo === o) salirVehiculo();
}
const _mo = new Float32Array(16), _mb = new Float32Array(16);
function objetoMatriz(o) {
  const b = o.b;
  m4trs([b.pos.x, b.pos.y, b.pos.z], [b.q.x, b.q.y, b.q.z, b.q.w], [1, 1, 1], _mb);
  if (b.capQ) { const cq = b.capQ.conj(); m4trs([0, 0, 0], [cq.x, cq.y, cq.z, cq.w], [1, 1, 1], _mo); m4mul(_mb, _mo, _mb); }
  m4trs([-o.c.x, -o.c.y, -o.c.z], [0, 0, 0, 1], [1, 1, 1], _mo);
  m4mul(_mb, _mo, o.md.raiz); o.md.sucio = true;
}
function dibujarObjetos() {
  for (const o of OBJS) {
    if (o.b.sleep && o.dibujado && !o.md.sucio) { o.md.encolar(); continue; }
    if (o.veh && typeof vehiculoAntesDeDibujar === 'function') vehiculoAntesDeDibujar(o);
    objetoMatriz(o); o.md.encolar(); o.dibujado = true;
  }
}
