// ---------------------------------------------------------------------------------------------------------
// destrucción: los autos se abollan de verdad (la carrocería se hunde donde pegó, para el lado del golpe y según la
// fuerza: un toque deja una marca, a 100 km/h contra una pared se aplasta la trompa), saltan chispas, vidrios y
// pedazos, en los choques fuertes se sueltan las ruedas, el motor echa humo cuando está dañado y prende fuego antes de
// explotar; al explotar la carrocería se infla y queda ardiendo. Y lo que queda de una explosión en el piso: fuego que
// se va apagando y una columna de humo.
// Barato: nada corre si no hay choques ni autos dañados. Cada auto golpeado lleva una copia de los vértices sólo de
// los nodos que tocó el golpe (se sube a la placa una vez por golpe, nunca en cada cuadro), con tope de autos abollados
// a la vez (los más viejos vuelven a su malla original) y se suelta todo cuando el auto se borra.
// El sonido del choque (metal que se arruga, golpe sordo, vidrios) está hecho acá, con ruido y parciales que se apagan.
// ---------------------------------------------------------------------------------------------------------
const DES = { autos: [], fuegos: [], piezas: [], tope: 10, revisar: 0, vidaMax: 400, sonidos: null };
const _desH = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 1440662683) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
// ruido suave (valor en una grilla de 1, interpolado): las arrugas de la chapa
function desRuido(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz); let r = 0;
  for (let c = 0; c < 8; c++) { const a = c & 1, b = (c >> 1) & 1, d = c >> 2; r += _desH(xi + a, yi + b, zi + d) * (a ? sx : 1 - sx) * (b ? sy : 1 - sy) * (d ? sz : 1 - sz); }
  return r;
}
const desEsc = (W) => (Math.hypot(W[0], W[1], W[2]) + Math.hypot(W[4], W[5], W[6]) + Math.hypot(W[8], W[9], W[10])) / 3;
// (un vector del mundo llevado al marco de un nodo: sólo la parte lineal de la inversa)
const desLin = (I, v) => v3(I[0] * v.x + I[4] * v.y + I[8] * v.z, I[1] * v.x + I[5] * v.y + I[9] * v.z, I[2] * v.x + I[6] * v.y + I[10] * v.z);
// el estado de destrucción de un auto (se crea con el primer golpe)
function desDe(o) {
  if (o.des) return o.des;
  const C = (o.des = { n: {}, t: TIEMPO.t, ht: 0, ft: 0, lt: 0, rotoT: -1, caja: null });
  if (!DES.autos.includes(o)) DES.autos.push(o);
  return C;
}
// la caja de la carrocería en el marco del cuerpo (sin las ruedas)
function desCaja(o) {
  const C = desDe(o); if (C.caja) return C.caja;
  const inv = o.b.q.clone().conj(), A = o.md.A, mn = v3(1e9, 1e9, 1e9), mx = v3(-1e9, -1e9, -1e9), w = v3();
  objetoMatriz(o); o.md.actualizar();
  for (let i = 0; i < A.length; i++) {
    if (!desCarroceria(o, i)) continue; const d = DATA.ms[A[i].m], W = o.md.W[i];
    for (let c = 0; c < 8; c++) { m4pt(W, d.mn[0] + d.sc[0] * (c & 1), d.mn[1] + d.sc[1] * ((c >> 1) & 1), d.mn[2] + d.sc[2] * (c >> 2), w); const l = inv.rot(vsub(w, o.b.pos)); mn.x = Math.min(mn.x, l.x); mn.y = Math.min(mn.y, l.y); mn.z = Math.min(mn.z, l.z); mx.x = Math.max(mx.x, l.x); mx.y = Math.max(mx.y, l.y); mx.z = Math.max(mx.z, l.z); }
  }
  if (mn.x > mx.x) { const a = o.b.aabb; mn.set(-1, -0.6, -2.2); mx.set(1, 0.7, 2.2); if (a) { const h = v3((a.x1 - a.x0) / 2, (a.y1 - a.y0) / 2, (a.z1 - a.z0) / 2); mn.set(-h.x, -h.y, -h.z); mx.copy(h); } }
  return (C.caja = { mn, mx });
}
// ¿el nodo i es parte de la carrocería? (con malla, visible, sin piel ni luz horneada, y no es una rueda ni un colisionador)
function desCarroceria(o, i) {
  const A = o.md.A, x = A[i]; if (!(x.m >= 0) || !o.md.ver[i] || x.bo || /collider/i.test(x.n)) return false;
  const V = o.veh, RU = V ? V.ruedas : [];
  for (let k = i; k >= 0; k = A[k].pa) if (RU.some((w) => w.vis === k) || (V && V.sueltas && V.sueltas.includes(k))) return false;
  return true;
}
// la copia de un nodo: sus vértices (posiciones, normales y uv, como en el paquete) en un búfer propio
function desNodo(o, i) {
  const C = desDe(o); if (C.n[i] !== undefined) return C.n[i];
  C.n[i] = null;
  const x = o.md.A[i], m = mallaGL(x.m), mc = m && mallaCPU(x.m); if (!m || !mc || m.skin || m.d.lm !== undefined || m.propia) return null;
  if (!m.vao) mallaSubir(m);   // (con JX Motor la malla puede no estar en WebGL todavía: la copia usa sus índices)
  const d = m.d, BIN = binDe(d); if (!BIN) return null;
  const V = BIN.slice(d.o, d.o + d.v * 14), gl = R.gl;
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, V, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.UNSIGNED_SHORT, true, 14, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.BYTE, true, 14, 6);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, R.gl1 ? gl.UNSIGNED_SHORT : gl.HALF_FLOAT, false, 14, 10);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
  gl.bindVertexArray(null); R.vaoAct = null;
  const id = ID_PROPIO + GEO.malla++;
  R.mallas[id] = Object.assign({}, m, { vao, vb, cpuS: undefined, desDe: x.m });
  if (!o.md.mCambio) o.md.mCambio = {};
  o.md.mCambio[i] = id;
  // (los triángulos de cada vértice, para rehacer las normales de lo que se hundió)
  let n = 0; for (const s of d.sub) n = Math.max(n, s[0] + s[1]);
  const I = mc.I, cu = new Uint32Array(d.v + 1);
  for (let k = 0; k < n; k++) cu[I[k] + 1]++;
  for (let k = 0; k < d.v; k++) cu[k + 1] += cu[k];
  const T = new Uint32Array(n), p = cu.slice(0, d.v);
  for (let k = 0; k < n; k++) T[p[I[k]]++] = (k / 3) | 0;
  const N = { id, i, vb, vao, V, dv: new DataView(V.buffer), S8: new Int8Array(V.buffer), P: new Float32Array(mc.P), I, cu, T, D: new Float32Array(d.v), d, base: x.m };
  return (C.n[i] = N);
}
function desSoltarNodo(o, N) {
  if (!N) return; const gl = R.gl;
  if (gl) { gl.deleteBuffer(N.vb); gl.deleteVertexArray(N.vao); }
  R.mallas[N.id] = undefined; if (o.md.mCambio && o.md.mCambio[N.i] === N.id) delete o.md.mCambio[N.i];
}
// todo lo de un auto: vuelve a su malla original
function desSoltar(o) {
  const C = o.des; if (!C) return;
  for (const k in C.n) desSoltarNodo(o, C.n[k]);
  C.n = {}; C.abollado = false;
}
// sube a la placa los vértices que cambiaron y rehace sus normales (las de los triángulos que los tocan, mezcladas con
// las originales según cuánto se hundió cada uno: un raspón no cambia el brillo de la chapa, una trompa aplastada sí)
function desSubir(N, cambio) {
  const { P, I, cu, T, dv, S8, d, D } = N, mn = d.mn, sc = d.sc, nr = v3();
  for (const k of cambio) {
    for (let a = 0; a < 3; a++) dv.setUint16(k * 14 + a * 2, clamp(Math.round((P[k * 3 + a] - mn[a]) / (sc[a] || 1) * 65535), 0, 65535), true);
    let nx = 0, ny = 0, nz = 0;
    for (let q = cu[k]; q < cu[k + 1]; q++) {
      const t = T[q] * 3, a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      nx += uy * vz - uz * vy; ny += uz * vx - ux * vz; nz += ux * vy - uy * vx;
    }
    const o = k * 14 + 6, ox = S8[o] / 127, oy = S8[o + 1] / 127, oz = S8[o + 2] / 127, L = Math.hypot(nx, ny, nz); if (L < 1e-12) continue;
    nr.set(nx / L, ny / L, nz / L); if (nr.x * ox + nr.y * oy + nr.z * oz < 0) nr.scale(-1);   // (el sentido de los triángulos: el de la normal original)
    const w = clamp(D[k] / 0.05, 0, 0.85), mx = ox + (nr.x - ox) * w, my = oy + (nr.y - oy) * w, mz = oz + (nr.z - oz) * w, Lm = Math.hypot(mx, my, mz) || 1;
    S8[o] = Math.round(mx / Lm * 127); S8[o + 1] = Math.round(my / Lm * 127); S8[o + 2] = Math.round(mz / Lm * 127);
  }
  const gl = R.gl; gl.bindBuffer(gl.ARRAY_BUFFER, N.vb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, N.V);
}
// abolladura: hunde la chapa alrededor de pw (mundo) hacia dir (para adentro del auto), hondo m de profundidad en el
// punto del golpe, que se apaga en radio m de costado y hacia adentro; con arrugas (ruido) y un poco de corrimiento de
// costado. modo 'inflar': cada vértice para afuera desde pw (la explosión de adentro)
function desAbollar(o, pw, dir, hondo, radio, modo) {
  if (!R.gl || hondo < 0.004) return 0;
  const C = desDe(o), A = o.md.A, tope = 0.75; let total = 0;
  objetoMatriz(o); o.md.actualizar();
  for (let i = 0; i < A.length; i++) {
    if (!desCarroceria(o, i)) continue;
    const d = DATA.ms[A[i].m], W = o.md.W[i], s = desEsc(W) || 1;
    const cw = m4pt(W, d.mn[0] + d.sc[0] / 2, d.mn[1] + d.sc[1] / 2, d.mn[2] + d.sc[2] / 2, v3()), rn = Math.hypot(d.sc[0], d.sc[1], d.sc[2]) / 2 * s;
    if (cw.distTo(pw) > rn + radio) continue;
    const N = desNodo(o, i); if (!N) continue;
    const Iw = M4.inv(W), pl = m4pt(Iw, pw.x, pw.y, pw.z, v3()), dl = desLin(Iw, dir).norm(), Rl = radio / s, R2 = Rl * Rl, P = N.P, D = N.D, nv = N.d.v, cambio = [];
    // (de costado: un eje perpendicular al golpe, para que la chapa se arrugue y no sólo se corra)
    const up = desLin(Iw, Math.abs(dir.y) < 0.8 ? v3(0, 1, 0) : v3(1, 0, 0)), lat = vcross(dl, up).norm(), k0 = 1 / 0.2;
    for (let k = 0; k < nv; k++) {
      const x = P[k * 3] - pl.x, y = P[k * 3 + 1] - pl.y, z = P[k * 3 + 2] - pl.z, d2 = x * x + y * y + z * z;
      if (d2 > R2 * 2.2) continue;
      const wx = (P[k * 3] * s) * k0, wy = (P[k * 3 + 1] * s) * k0, wz = (P[k * 3 + 2] * s) * k0, ru = desRuido(wx, wy, wz);
      let mov, ex, ey, ez;
      if (modo === 'inflar') {
        const L = Math.sqrt(d2) || 1, f = clamp(1 - L / Rl, 0, 1); if (f <= 0) continue;
        mov = hondo / s * (0.35 + 0.65 * f) * (0.4 + 1.2 * ru); ex = x / L; ey = y / L; ez = z / L;
      } else {
        const al = x * dl.x + y * dl.y + z * dl.z, p2 = Math.max(0, d2 - al * al); if (p2 > R2) continue;
        const fp = (1 - p2 / R2) ** 2, fa = al <= 0 ? 1 : Math.exp(-al / (Rl * 0.85));
        mov = hondo / s * fp * fa * (0.7 + 0.6 * ru);
        const sl = (desRuido(wx + 17.3, wy + 4.1, wz + 9.7) - 0.5) * 0.55;   // (la arruga: para un costado o el otro)
        ex = dl.x + lat.x * sl; ey = dl.y + lat.y * sl; ez = dl.z + lat.z * sl;
      }
      const m = Math.min(mov, (tope - D[k]) / s); if (m * s < 0.0015) continue;
      P[k * 3] += ex * m; P[k * 3 + 1] += ey * m; P[k * 3 + 2] += ez * m; D[k] += m * s; total += m * s; cambio.push(k);
    }
    if (!cambio.length) continue;
    // (los vecinos de lo que se movió también cambian de normal: los vértices de sus triángulos)
    const ve = new Set(cambio);
    for (const k of cambio) for (let q = N.cu[k]; q < N.cu[k + 1]; q++) { const t = N.T[q] * 3; ve.add(N.I[t]); ve.add(N.I[t + 1]); ve.add(N.I[t + 2]); }
    desSubir(N, ve); C.abollado = true;
  }
  C.t = TIEMPO.t;
  return total;
}
// ---------------- el golpe: de un choque de la física ----------------
function desGolpe(o, h, lado) {
  const V = o.veh, b = lado ? h.o : h.b, otro = lado ? h.b : h.o; if (!V || !b || !h.n) return;
  const m2 = otro && otro.dynamic && !otro.frozen ? otro.mass || 50 : 1e9, kM = m2 >= 1e8 ? 1 : m2 / (m2 + 250), ve = h.v * (0.35 + 0.65 * kM);
  if (ve < 6) return;
  const rl = lado ? h.rb : h.ra, pw = rl ? vadd(b.pos, b.q.rot(rl)) : h.p.clone(), dir = lado ? vscale(h.n, -1) : h.n.clone();
  const fuerte = clamp((ve - 6) / 22, 0, 1);
  desAbollar(o, pw, dir, clamp((ve - 5) * 0.021, 0, 0.5), 0.5 + ve * 0.032);
  desChispas(o, pw, dir, ve);
  desSonar(pw, ve, ve > 11 && Math.random() < 0.85);
  if (JUG.vehiculo === o) CAM.temblor = Math.max(CAM.temblor || 0, clamp((ve - 6) / 20, 0, 0.9));
  // (el daño: sólo el dueño del auto, como con las balas y las explosiones —el otro recibe cómo quedó—)
  if (!o.remoto && ve > 7 && !V.roto) { V.vida -= Math.pow(ve - 7, 1.5) * 3; if (V.vida <= 0) vehiculoRoto(o); }
  // ruedas que se sueltan: las que están cerca del golpe, en los choques fuertes
  if (ve > 15) for (const w of V.ruedas.slice()) {
    const pr = vadd(b.pos, b.q.rot(w.p)); if (pr.distTo(pw) > w.r + 0.75) continue;
    if (Math.random() < (ve - 15) / 10) desSoltarRueda(o, w, vscale(dir, -(2 + fuerte * 5)));
  }
}
// chispas que saltan del golpe, pedazos de chapa y de plástico, vidrios (los golpes fuertes) y polvo
function desChispas(o, pw, dir, ve) {
  const q = GFX.part || 0.5, n = (x) => Math.max(1, Math.round(x * q)), az = (a, b) => a + Math.random() * (b - a);
  const fuera = vscale(dir, -1), y0 = typeof pisoBajo === 'function' ? pisoBajo(pw, 3) : null, piso = y0 ?? pw.y - 1, f = clamp((ve - 6) / 20, 0, 1.3);
  const rebote = (k) => { const r = vadd(vscale(fuera, az(0.4, 1)), v3(az(-0.8, 0.8), az(0.1, 1), az(-0.8, 0.8))); return vadd(r.norm().scale(k), vscale(o.b.vel, 0.6)); };
  let x;
  for (let i = 0, m = n(8 + f * 30); i < m; i++) { x = particula(pw, rebote(az(3, 9) * (0.6 + f)), az(0.25, 0.7), 0.022, [1, 0.8, 0.45, 1], 'chispa', 0); if (x) { x.fr = 0.6; x.piso = piso + 0.02; } }
  // (pedazos: gris oscuro y del color del auto; caen, rebotan y se quedan un rato)
  const col = (o.color && o.color.length >= 3) ? o.color : (o.md.color || [0.5, 0.5, 0.52]);
  if (ve > 10) for (let i = 0, m = n(3 + f * 12); i < m; i++) { const c = Math.random() < 0.5 ? [0.08, 0.08, 0.09, 1] : [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8, 1]; x = particula(pw, rebote(az(2, 6) * (0.6 + f)), az(1.4, 2.6), az(0.025, 0.06), c, 'gota', 0); if (x) { x.piso = piso + 0.02; x.fr = 0.3; } }
  // (vidrios: astillas celestes que brillan y caen, y algunos destellos)
  if (ve > 11) {
    for (let i = 0, m = n(8 + f * 26); i < m; i++) { x = particula(vadd(pw, v3(az(-0.4, 0.4), az(0, 0.5), az(-0.4, 0.4))), rebote(az(1.5, 5)), az(1, 2), az(0.012, 0.03), [0.72, 0.84, 0.9, 0.85], 'gota', 0); if (x) { x.piso = piso + 0.015; x.fr = 0.4; } }
    for (let i = 0, m = n(4 + f * 8); i < m; i++) { x = particula(pw, rebote(az(1, 4)), az(0.3, 0.8), 0.03, [0.75, 0.9, 1, 0.9], 'chispa', 0); if (x) { x.piso = piso + 0.02; x.modo = 0; } }
  }
  // (polvo y humo del golpe)
  for (let i = 0, m = n(2 + f * 6); i < m; i++) { x = particula(vadd(pw, vscale(fuera, 0.2)), vadd(vscale(rebote(az(0.5, 1.6)), 1), v3(0, 0.4, 0)), az(0.9, 1.8), az(0.25, 0.5) * (0.6 + f), [0.6, 0.57, 0.53, 0.42], 'humo', 2.2); if (x) x.fr = 2; }
  if (ve > 14) luzTemporal(pw, 4 + f * 4, [6, 4, 2], 0.08);
}
// una rueda que se suelta: deja de estar en la física del auto, se esconde la de la carrocería y sale rodando una de verdad
function desSoltarRueda(o, w, empuje) {
  const V = o.veh, i = V.ruedas.indexOf(w); if (i < 0) return;
  V.ruedas.splice(i, 1); (V.sueltas || (V.sueltas = [])).push(w.vis);
  const A = o.md.A; if (w.vis >= 0) for (let k = 0; k < A.length; k++) { let j = k; while (j >= 0 && j !== w.vis) j = A[j].pa; if (j === w.vis) o.md.ver[k] = 0; }
  const b = o.b, pw = vadd(b.pos, b.q.rot(w.p));
  desChispas(o, pw, b.q.rot(v3(w.p.x > 0 ? -1 : 1, 0, 0)), 16);
  const P = desRuedaPieza(o, w); if (!P) return;
  const lado = b.q.rot(v3(w.p.x > 0 ? 1 : -1, 0, 0));
  P.b.vel.copy(vadd(vadd(b.vel, vscale(lado, 2.5 + Math.random() * 3)), vadd(empuje || v3(), v3(0, 2 + Math.random() * 2, 0))));
  const gira = vdot(b.vel, b.q.rot(v3(0, 0, 1))) / (w.r || 0.35);   // (sigue rodando como venía, con un poco de bamboleo)
  P.b.ang.copy(vadd(vscale(b.q.rot(v3(1, 0, 0)), gira), v3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4)));
}
// la rueda que se soltó: su misma malla (al tamaño y con el material del auto) sobre un cilindro de la física que rueda y
// rebota. No es un objeto del juego (no se guarda ni viaja por la red: cada uno ve la suya); dura 40 s, hasta 8 a la vez
const _desB = new Float32Array(16);
function desRuedaPieza(o, w) {
  const A = o.md.A, k = w.vis; if (k < 0 || typeof prismShape !== 'function') return null;
  const km = A[k].m >= 0 ? k : A.findIndex((c) => c.pa === k && c.m >= 0); if (km < 0) return null;
  objetoMatriz(o); o.md.actualizar();
  const x = A[km], W = new Float32Array(o.md.W[km]), d = DATA.ms[x.m], b0 = o.b, eje = b0.q.rot(v3(1, 0, 0)), c = v3(), w3 = v3();
  let a0 = 1e9, a1 = -1e9;
  for (let i = 0; i < 8; i++) { m4pt(W, d.mn[0] + d.sc[0] * (i & 1), d.mn[1] + d.sc[1] * ((i >> 1) & 1), d.mn[2] + d.sc[2] * (i >> 2), w3); const t = vdot(w3, eje); a0 = Math.min(a0, t); a1 = Math.max(a1, t); c.addS(w3, 1 / 8); }
  const hw = clamp((a1 - a0) / 2, 0.06, 0.3), r = clamp(w.r || 0.35, 0.15, 0.8), q = b0.q.clone().mul(Quat.axis(0, 0, 1, Math.PI / 2));
  const b = new Body(prismShape(r, r, hw, 14), 22, { fric: 0.9, rest: 0.3 });
  b.pos.copy(c); b.q.copy(q); b.updateWorld(); addBody(b);
  // (un rato sin chocar con el auto del que salió: arranca metida en el guardabarros)
  (b.noCollide = new Set()).add(b0); (b0.noCollide || (b0.noCollide = new Set())).add(b);
  m4trs([c.x, c.y, c.z], [q.x, q.y, q.z, q.w], [1, 1, 1], _desB);
  const M = new Float32Array(16); m4mul(M4.inv(_desB), W, M);
  if (DES.piezas.length >= 8) desPiezaQuitar(DES.piezas[0]);
  const P = { b, de: b0, M, W: new Float32Array(16), mi: x.m, sb: x.sb ? x.sb[0] : 0, mt: x.mt, ex: o.color ? { c: o.color } : o.md.color ? { c: o.md.color } : null, t: TIEMPO.t };
  DES.piezas.push(P); return P;
}
function desPiezaQuitar(P) {
  const i = DES.piezas.indexOf(P); if (i >= 0) DES.piezas.splice(i, 1);
  if (P.de && P.de.noCollide) P.de.noCollide.delete(P.b);
  removeBody(P.b);
}
// (en la cola de dibujo, con los objetos)
function desDibujar() {
  for (const P of DES.piezas) {
    const b = P.b; m4trs([b.pos.x, b.pos.y, b.pos.z], [b.q.x, b.q.y, b.q.z, b.q.w], [1, 1, 1], _desB); m4mul(_desB, P.M, P.W);
    for (let k = 0; k < P.mt.length; k++) encolar(P.mi, P.sb + k, P.mt[k], P.W, null, P.ex);
  }
}
// ---------------- explosiones ----------------
// una explosión cerca: la chapa se hunde del lado de la explosión (y vuelan vidrios)
function desExplosion(o, p, k, radio) {
  const V = o.veh; if (!V || V.tipo === 'asiento' || k <= 0.02) return;
  const c = desCaja(o), b = o.b, cl = vscale(vadd(c.mn, c.mx), 0.5), cw = vadd(b.pos, b.q.rot(cl)), d = vsub(cw, p), L = d.len(); if (L < 0.6) return;
  const dir = vscale(d, 1 / L), dl = b.q.clone().conj().rot(vscale(dir, -1)), h = vscale(vsub(c.mx, c.mn), 0.5);
  const t = Math.min(Math.abs(dl.x) > 1e-4 ? h.x / Math.abs(dl.x) : 1e9, Math.abs(dl.y) > 1e-4 ? h.y / Math.abs(dl.y) : 1e9, Math.abs(dl.z) > 1e-4 ? h.z / Math.abs(dl.z) : 1e9);
  const pw = vadd(cw, b.q.rot(vscale(dl, t)));
  desAbollar(o, pw, dir, clamp(k * 0.32, 0, 0.32), 1.1 + radio * 0.12);
  desChispas(o, pw, dir, 8 + k * 14);
}
// el auto explotó: la carrocería se infla desde adentro, saltan una o dos ruedas y queda prendido fuego
function desRoto(o) {
  const V = o.veh, C = desDe(o), c = desCaja(o), b = o.b, cl = vscale(vadd(c.mn, c.mx), 0.5); C.rotoT = TIEMPO.t;
  desAbollar(o, vadd(b.pos, b.q.rot(vadd(cl, v3(0, (c.mx.y - c.mn.y) * 0.1, 0)))), v3(0, 1, 0), 0.13, Math.max(2, (c.mx.z - c.mn.z) * 0.7), 'inflar');
  if (V.tipo === 'auto') { const L = V.ruedas.slice().sort(() => Math.random() - 0.5); for (let i = 0; i < Math.min(L.length, 1 + (Math.random() < 0.6 ? 1 : 0)); i++) desSoltarRueda(o, L[i], v3(0, 3, 0)); }
  desSonar(b.pos, 30, true);
}
// fuego que queda en el piso después de una explosión (se va apagando) y su humo
function desFuego(p, esc) {
  if ((GFX.part || 0) < 0.3) return;
  if (DES.fuegos.length >= 6) DES.fuegos.shift();
  DES.fuegos.push({ p: p.clone(), esc, t: 0, dur: 4 + esc * 2.2 + Math.random() * 2, et: 0, ht: 0, lt: 0 });
}
// la quemadura en el piso: tiras oscuras en estrella desde el centro (las marcas de frenada: se borran solas con el tope)
function desQuemadura(p, n, esc) {
  if (typeof marcaTramo !== 'function') return;
  const c = v3(p.x, p.y + 0.01, p.z), m = 9 + Math.round(esc * 2);
  for (let i = 0; i < m; i++) {
    const u = (i / m) * Math.PI * 2 + Math.random() * 0.4, L = Math.min(2.9, (0.75 + Math.random() * 0.75) * esc), d = v3(Math.cos(u), 0, Math.sin(u));
    marcaTramo(vsub(c, vscale(d, 0.15 * esc)), vadd(c, vscale(d, L)), n, L * (0.55 + Math.random() * 0.25), 0.55 + Math.random() * 0.3);
  }
  // (el centro, más quemado)
  for (let i = 0; i < 3; i++) { const u = Math.random() * Math.PI, d = v3(Math.cos(u), 0, Math.sin(u)), L = Math.min(2.9, 0.7 * esc); marcaTramo(vsub(c, vscale(d, L / 2)), vadd(c, vscale(d, L / 2)), n, L * 0.8, 0.8); }
}
// ---------------- cada cuadro (después de la física: lee los choques de este cuadro) ----------------
function desPaso(dt) {
  const H = PH.hits;
  for (let j = 0; j < H.length && j < 48; j++) {
    const h = H[j];
    for (let lado = 0; lado < 2; lado++) { const b = lado ? h.o : h.b, o = b && b.obj; if (o && o.veh && o.veh.tipo !== 'asiento' && !o.borrado) desGolpe(o, h, lado); }
  }
  if (!DES.sonidos && VEHS.length) desPrecalentar();
  for (let i = DES.piezas.length - 1; i >= 0; i--) { const P = DES.piezas[i]; if (P.de && TIEMPO.t - P.t > 0.6 && P.b.noCollide) { P.b.noCollide = null; if (P.de.noCollide) P.de.noCollide.delete(P.b); P.de = null; } if (TIEMPO.t - P.t > 40 || TIEMPO.t < P.t) desPiezaQuitar(P); }
  if (!DES.autos.length && !DES.fuegos.length && !DES.piezas.length) return;
  const q = GFX.part || 0.5, az = (a, b) => a + Math.random() * (b - a), cam = CAM.pos, t = TIEMPO.t;
  // (una vez por segundo: lo que se borró suelta sus búferes; y el tope de autos abollados)
  if ((DES.revisar -= dt) <= 0) {
    DES.revisar = 1;
    for (let i = DES.autos.length - 1; i >= 0; i--) { const o = DES.autos[i]; if (o.borrado || !OBJS.includes(o)) { desSoltar(o); DES.autos.splice(i, 1); } }
    const ab = DES.autos.filter((o) => o.des && o.des.abollado).sort((a, b) => a.des.t - b.des.t);
    for (let i = 0; i < ab.length - DES.tope; i++) desSoltar(ab[i]);
    for (const P of DES.piezas.slice()) if (!PH.bodies.includes(P.b)) desPiezaQuitar(P);   // (otro mapa: la física se vació)
  }
  let luces = 0;
  for (const o of DES.autos) {
    const V = o.veh, C = o.des; if (!V || !C) continue;
    const f = V.roto ? 0 : V.vida / DES.vidaMax, tr = C.rotoT >= 0 ? t - C.rotoT : -1;
    const arde = (!V.roto && f < 0.25) || (tr >= 0 && tr < 24), humea = arde || f < 0.6 || (tr >= 0 && tr < 60);
    if (!humea) continue;
    const dc = cam.distTo(o.b.pos); if (dc > 150) continue;
    const lejos = dc > 60 ? 0.45 : 1, c = desCaja(o), b = o.b;
    // (el motor: adelante, a la altura del capó; ya explotado, de toda la carrocería)
    const motor = () => {
      if (tr >= 0) return vadd(b.pos, b.q.rot(v3(az(c.mn.x, c.mx.x) * 0.7, c.mn.y + (c.mx.y - c.mn.y) * az(0.45, 0.8), az(c.mn.z, c.mx.z) * 0.75)));
      return vadd(b.pos, b.q.rot(v3(az(-0.35, 0.35), c.mn.y + (c.mx.y - c.mn.y) * 0.6, c.mx.z - Math.min(0.85, (c.mx.z - c.mn.z) * 0.17) + az(-0.25, 0.25))));
    };
    const dano = tr >= 0 ? (tr < 24 ? 1 : clamp(1 - (tr - 24) / 36, 0, 1) * 0.7) : clamp((0.6 - f) / 0.6, 0, 1);
    C.ht -= dt * (5 + 15 * dano) * q * lejos;
    while (C.ht <= 0) {
      C.ht += 1; const p = motor(), osc = 0.12 + 0.2 * dano;
      const x = particula(p, vadd(vscale(b.vel, 0.3), v3(az(-0.3, 0.3), az(1.1, 2.1), az(-0.3, 0.3))), az(2.2, 4) * (0.7 + dano * 0.6), az(0.22, 0.38) * (0.8 + dano * 0.6), [0.55 - osc, 0.54 - osc, 0.53 - osc, 0.38 + dano * 0.25], 'humo', 2.4);
      if (x) { x.fr = 0.9; x.calor = arde ? 0.35 : 0; }
    }
    if (arde) {
      // (llamas chicas y muchas, que suben rápido y se apagan: no bolas naranjas que tapan el auto)
      const k = tr >= 0 ? 1 + clamp(1 - tr / 24, 0, 1) * 0.45 : 0.75;
      C.ft -= dt * 30 * k * q * lejos;
      while (C.ft <= 0) { C.ft += 1; const x = particula(motor(), vadd(vscale(b.vel, 0.5), v3(az(-0.25, 0.25), az(1.8, 3.4), az(-0.25, 0.25))), az(0.3, 0.6), az(0.13, 0.26) * k, [1, 1, 1, 0.85], 'fuego', 0.8); if (x) { x.rampa = 1; x.fr = 1.6; x.grav = -0.1; } }
      if ((C.lt -= dt) <= 0 && luces < 4 && dc < 70) { C.lt = 0.09; luces++; const a = 0.7 + Math.random() * 0.6; luzTemporal(vadd(motor(), v3(0, 0.6, 0)), 6 + 3 * k, [5 * a * k, 2.4 * a * k, 0.7 * a * k], 0.12); }
    }
  }
  for (let i = DES.fuegos.length - 1; i >= 0; i--) {
    const F = DES.fuegos[i]; F.t += dt; if (F.t >= F.dur) { DES.fuegos.splice(i, 1); continue; }
    const dc = cam.distTo(F.p); if (dc > 150) continue;
    const k = 1 - F.t / F.dur, e = F.esc, lejos = dc > 60 ? 0.45 : 1;
    F.et -= dt * 26 * k * q * lejos * Math.min(2, e);
    while (F.et <= 0) { F.et += 1; const u = Math.random() * 6.2832, r = Math.sqrt(Math.random()) * 0.9 * e * (0.5 + 0.5 * k); const x = particula(v3(F.p.x + Math.cos(u) * r, F.p.y + 0.05, F.p.z + Math.sin(u) * r), v3(az(-0.2, 0.2), az(1.4, 2.8), az(-0.2, 0.2)), az(0.3, 0.6), az(0.12, 0.26) * Math.sqrt(e) * (0.5 + 0.5 * k), [1, 1, 1, 0.85], 'fuego', 0.9); if (x) { x.rampa = 1; x.fr = 1.4; x.grav = -0.06; } }
    F.ht -= dt * 7 * q * lejos;
    while (F.ht <= 0) { F.ht += 1; const x = particula(vadd(F.p, v3(az(-0.4, 0.4) * e, 0.5 + az(0, 0.4), az(-0.4, 0.4) * e)), v3(az(-0.25, 0.25), az(1.5, 2.6), az(-0.25, 0.25)), az(3, 5), az(0.35, 0.6) * e, [0.24, 0.23, 0.22, 0.55 * (0.4 + 0.6 * k)], 'humo', 2.6); if (x) { x.fr = 0.7; x.calor = 0.5; } }
    if ((F.lt -= dt) <= 0 && luces < 6 && dc < 70) { F.lt = 0.1; luces++; const a = (0.7 + Math.random() * 0.6) * k; luzTemporal(v3(F.p.x, F.p.y + 0.8, F.p.z), 5 + 3 * e, [6 * a, 2.8 * a, 0.8 * a], 0.13); }
  }
}
// ---------------- el sonido (hecho acá: una vez por variante, después es un sonido más) ----------------
function desSonido(tipo, va) {
  const c = AUD.ctx; if (!c) return null;
  const nombre = 'DES_' + tipo + va; if (AUD.buf[nombre]) return nombre;
  const sr = c.sampleRate, dur = tipo === 'vidrio' ? 1.1 : tipo === 'fuerte' ? 1.6 : 0.7, N = Math.floor(sr * dur);
  let b; try { b = c.createBuffer(1, N, sr); } catch (e) { return null; }
  const d = b.getChannelData(0); let sem = 7919 * (va + 1) + tipo.length * 104729;
  const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647), ruido = () => az() * 2 - 1;
  // (un grano: ruido por un filtro pasabanda —variable de estado— con ataque corto y caída exponencial)
  const grano = (t0, L, fc, Q, a) => {
    const i0 = Math.floor(t0 * sr), n = Math.floor((L * 5) * sr), qd = 1 / Q, F = Math.min((Math.sqrt(4 + qd * qd) - qd) * 0.9, 2 * Math.sin(Math.PI * Math.min(fc, sr * 0.45) / sr)); let lo = 0, bp = 0;   // (con tope: el filtro de estado se vuelve inestable cerca de la mitad de la frecuencia del audio)
    for (let i = 0; i < n && i0 + i < N; i++) { const t = i / sr, env = Math.min(1, t / 0.0015) * Math.exp(-t / L); const hp = ruido() - lo - bp * qd; bp += F * hp; lo += F * bp; d[i0 + i] += bp * a * env; }
  };
  const parcial = (t0, f, tau, a) => { const i0 = Math.floor(t0 * sr), n = Math.floor(tau * 6 * sr), w = 2 * Math.PI * f / sr; if (f > sr * 0.45) return; for (let i = 0; i < n && i0 + i < N; i++) { const t = i / sr; d[i0 + i] += Math.sin(w * i) * a * Math.exp(-t / tau) * Math.min(1, t / 0.001); } };
  if (tipo === 'vidrio') {
    grano(0, 0.035, 6000, 0.7, 0.9); grano(0.004, 0.05, 3500, 0.8, 0.6);
    for (let k = 0; k < 110; k++) { const t0 = Math.pow(az(), 2.1) * 0.95; parcial(t0, 2400 + az() * 7000, 0.004 + az() * 0.022, 0.32 * (1 - t0) * (0.3 + 0.7 * az())); }
  } else {
    const fuerte = tipo === 'fuerte', ph = { v: 0 };
    // golpe sordo (de 90 a 38 Hz)
    for (let i = 0; i < N; i++) { const t = i / sr, f = 38 + 55 * Math.exp(-t * 16); ph.v += 2 * Math.PI * f / sr; d[i] += Math.sin(ph.v) * Math.exp(-t * (fuerte ? 7 : 12)) * Math.min(1, t / 0.002) * 0.95; }
    // chapa que se arruga: granos de ruido muy juntos al principio
    const G = fuerte ? 46 : 14, T = fuerte ? 0.42 : 0.1;
    for (let k = 0; k < G; k++) { const t0 = Math.pow(az(), 1.7) * T; grano(t0, 0.004 + az() * 0.02, 500 + az() * 3800, 1.3 + az() * 2, 0.55 * Math.exp(-t0 * 3) * (0.4 + 0.6 * az())); }
    // el metal que suena (parciales inarmónicos)
    const f0 = 120 + az() * 70;
    [1, 2.32, 4.25, 6.63, 9.38, 12.5, 16.1].forEach((r, k) => parcial(az() * 0.01, f0 * r * (1 + (az() - 0.5) * 0.05), (fuerte ? 0.55 : 0.28) / (1 + k * 0.4), 0.16 / (1 + k * 0.45)));
    // pedazos que caen y traquetean
    if (fuerte) for (let k = 0; k < 14; k++) { const t0 = 0.3 + az() * 1.1; grano(t0, 0.003 + az() * 0.006, 2000 + az() * 3500, 3, 0.14 * (1 - t0 / dur)); }
  }
  let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(d[i]));
  if (pk > 0) { const g = 0.9 / pk; for (let i = 0; i < N; i++) d[i] *= g; }
  AUD.buf[nombre] = b; return nombre;
}
// (las 9 variantes se hacen de a una en los ratos libres del navegador apenas hay un vehículo: así el primer choque no
// se traba armando el sonido)
function desPrecalentar() {
  if (!AUD.ctx) return; DES.sonidos = [];
  for (const t of ['golpe', 'fuerte', 'vidrio']) for (let v = 0; v < 3; v++) DES.sonidos.push([t, v]);
  const uno = () => { const x = DES.sonidos.shift(); if (!x) return; desSonido(x[0], x[1]); luego(); };
  const luego = () => (window.requestIdleCallback ? requestIdleCallback(uno, { timeout: 2000 }) : setTimeout(uno, 120));
  luego();
}
function desSonar(p, ve, vidrio) {
  if (!AUD.ctx || !PREFS.vol) return;
  const va = (Math.random() * 3) | 0, fuerte = ve > 14, n = desSonido(fuerte ? 'fuerte' : 'golpe', va), tono = 0.85 + Math.random() * 0.3;
  if (n) sonar(n, p, clamp(ve / 14, 0.45, 1.7), tono);
  if (vidrio) { const nv = desSonido('vidrio', va); if (nv) sonar(nv, p, clamp(ve / 22, 0.35, 1), 0.9 + Math.random() * 0.25); }
}
