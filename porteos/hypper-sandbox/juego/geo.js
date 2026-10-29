// ---------------- formas propias: mallas hechas por código (rampa, piano, radio, botones, marcadores) ----------------
// Van por el mismo camino de dibujo que las del juego (mismo vértice, luz y sombras). Las fijas se suman al mapa: sus
// triángulos chocan con el jugador, los autos (las ruedas tiran rayos) y los objetos, y las cajas fijas igual.
const GEO = { malla: 0, mat: 0, cubo: -1, mats: {}, pool: [], pi: 0 };
const _f32 = new Float32Array(1), _u32 = new Uint32Array(_f32.buffer);
function aMedio(v) { _f32[0] = v; const x = _u32[0], s = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 112, m = (x >>> 13) & 0x3ff; return e <= 0 ? s : e > 30 ? s | 0x7bff : s | (e << 10) | m; }
const geoNuevo = () => ({ P: [], N: [], U: [], I: [] });
// cuadrilátero (a b c d en orden alrededor) con su normal; se da vuelta solo si viene al revés. UV en metros / esc
function geoQuad(B, a, b, c, d, n, esc) {
  const k = B.P.length / 3, e = esc || 1, w = a.distTo(b) / e, h = a.distTo(d) / e;
  if (vdot(vcross(vsub(b, a), vsub(c, a)), n) < 0) { const t = b; b = d; d = t; }
  for (const p of [a, b, c, d]) { B.P.push(p.x, p.y, p.z); B.N.push(n.x, n.y, n.z); }
  B.U.push(0, 0, w, 0, w, h, 0, h); B.I.push(k, k + 1, k + 2, k, k + 2, k + 3);
}
// caja: centro, medios lados [x, y, z] y giro
function geoCaja(B, c, h, q, esc) {
  q = q || new Quat();
  const E = [q.rot(v3(1, 0, 0)), q.rot(v3(0, 1, 0)), q.rot(v3(0, 0, 1))];
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
    const n = vscale(E[a], s), u = E[(a + 1) % 3], v = E[(a + 2) % 3], hu = h[(a + 1) % 3], hv = h[(a + 2) % 3];
    const o = vadd(c, vscale(n, h[a])), p = (i, j) => vadd(o, vadd(vscale(u, i * hu), vscale(v, j * hv)));
    geoQuad(B, p(-1, -1), p(1, -1), p(1, 1), p(-1, 1), n, esc);
  }
}
// sube la malla a la placa de video con el formato de las del juego (posición en 16 bits, normal en 8, UV en medio float)
function mallaPropia(B) {
  const gl = R.gl, nv = B.P.length / 3; if (!nv || !gl) return -1;
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let k = 0; k < nv * 3; k++) { const a = k % 3; if (B.P[k] < mn[a]) mn[a] = B.P[k]; if (B.P[k] > mx[a]) mx[a] = B.P[k]; }
  const sc = [0, 1, 2].map((a) => Math.max(1e-4, mx[a] - mn[a])), dv = new DataView(new ArrayBuffer(nv * 14));
  for (let k = 0; k < nv; k++) {
    const o = k * 14;
    for (let a = 0; a < 3; a++) { dv.setUint16(o + a * 2, Math.round((B.P[k * 3 + a] - mn[a]) / sc[a] * 65535), true); dv.setInt8(o + 6 + a, Math.round(clamp(B.N[k * 3 + a], -1, 1) * 127)); }
    dv.setUint16(o + 10, aMedio(B.U[k * 2] || 0), true); dv.setUint16(o + 12, aMedio(B.U[k * 2 + 1] || 0), true);
  }
  const i32 = nv > 65535, idx = i32 ? new Uint32Array(B.I) : new Uint16Array(B.I), vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, dv.buffer, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.UNSIGNED_SHORT, true, 14, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.BYTE, true, 14, 6);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, R.gl1 ? gl.UNSIGNED_SHORT : gl.HALF_FLOAT, false, 14, 10);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null); R.vaoAct = null;
  const id = DATA.ms.length + GEO.malla++;
  R.mallas[id] = { vao, vb, ib, d: { mn, sc, sub: [[0, B.I.length]], v: nv, i32 }, it: i32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, isz: i32 ? 4 : 2,
    c: [0, 1, 2].map((a) => mn[a] + sc[a] / 2), r: Math.hypot(sc[0], sc[1], sc[2]) / 2, skin: false, idx: id, propia: true };
  return id;
}
function mallaPropiaBorrar(id) { const m = R.mallas[id]; if (!m || !m.propia) return; const gl = R.gl; gl.deleteBuffer(m.vb); gl.deleteBuffer(m.ib); gl.deleteVertexArray(m.vao); R.mallas[id] = null; }
// material propio: color, brillo y opcionalmente la textura de un material del juego (por nombre)
function matPropio(clave, c, o) {
  if (GEO.mats[clave] !== undefined) return GEO.mats[clave];
  o = o || {}; const id = DATA.mt.length + GEO.mat++, base = o.de !== undefined && o.de >= 0 ? matGL(o.de) : null;
  R.mats[id] = { d: {}, c: [c[0], c[1], c[2], 1], tex: base ? base.tex : -1, st: base ? base.st.slice() : [1, 1, 0, 0], blend: false, cut: false, unlit: false, terr: null, add: false, oculto: false,
    em: o.em || [0, 0, 0], pbr: o.pbr || (base ? base.pbr : [0.7, 0, 0.04]), lampara: false, fol: false, claveBase: ',,,', claveGam: ',,', sombra: true };
  return (GEO.mats[clave] = id);
}
// un material del juego con textura cuyo nombre encaje (asfalto para la rampa, madera, metal)
function matDelJuego(re) {
  for (let i = 0; i < DATA.mt.length; i++) { const d = DATA.mt[i]; if (!d || !re.test(d.n || '')) continue; const m = matGL(i); if (m.tex !== undefined && m.tex >= 0 && !m.blend && !m.terr && !m.cut) return i; }
  return -1;
}
function geoCubo() { if (GEO.cubo < 0 || !R.mallas[GEO.cubo]) { const B = geoNuevo(); geoCaja(B, v3(), [0.5, 0.5, 0.5]); GEO.cubo = mallaPropia(B); } return GEO.cubo; }
// una caja de cualquier tamaño con el cubo de 1 m (para lo que se mueve: teclas, botones, marcadores). Las matrices
// salen de una pila que se vacía al empezar cada cuadro (la cola de dibujo las usa hasta el final del cuadro)
function dibujarCaja(c, tam, q, mat, extra) {
  const M = GEO.pool[GEO.pi] || (GEO.pool[GEO.pi] = new Float32Array(16)); GEO.pi++; m4trs([c.x, c.y, c.z], q ? [q.x, q.y, q.z, q.w] : [0, 0, 0, 1], tam, M);
  encolar(geoCubo(), 0, mat, M, null, extra || null);
}
// ---------------- choques: triángulos y cajas que se suman al mapa ----------------
function mundoSumarTris(tris) {
  const n0 = MUNDO.nt, T = new Float32Array(MUNDO.T.length + tris.length); T.set(MUNDO.T); T.set(tris, MUNDO.T.length);
  const TN = new Float32Array(T.length / 3); TN.set(MUNDO.TN);
  MUNDO.T = T; MUNDO.TN = TN; MUNDO.nt = T.length / 9;
  for (let t = n0; t < MUNDO.nt; t++) {
    const o = t * 9, ux = T[o + 3] - T[o], uy = T[o + 4] - T[o + 1], uz = T[o + 5] - T[o + 2], vx = T[o + 6] - T[o], vy = T[o + 7] - T[o + 1], vz = T[o + 8] - T[o + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
    TN[t * 3] = nx / l; TN[t * 3 + 1] = ny / l; TN[t * 3 + 2] = nz / l;
    grillaAgregar(Math.min(T[o], T[o + 3], T[o + 6]), Math.min(T[o + 2], T[o + 5], T[o + 8]), Math.max(T[o], T[o + 3], T[o + 6]), Math.max(T[o + 2], T[o + 5], T[o + 8]), t);
    MUNDO.lo.y = Math.min(MUNDO.lo.y, T[o + 1], T[o + 4], T[o + 7]); MUNDO.hi.y = Math.max(MUNDO.hi.y, T[o + 1], T[o + 4], T[o + 7]);
  }
  MUNDO.triMarca = undefined; // (mundoRayo y trisCerca la vuelven a armar del tamaño nuevo)
  return [n0, MUNDO.nt];
}
// se "quitan" mandándolos lejísimos (la grilla los sigue nombrando, pero ya no tocan nada)
function mundoQuitarTris(r) {
  if (!r) return; const T = MUNDO.T;
  for (let t = r[0]; t < r[1]; t++) { for (let k = 0; k < 9; k++) T[t * 9 + k] = k % 3 === 1 ? -1e6 : 0; MUNDO.triCuerpo[t] = null; }
}
// caja fija (piso, tecla, pared): choca como las cajas del mapa
function cajaFija(c, h, q) {
  const b = new Body(boxShape(h[0], h[1], h[2]), 0); b.pos.copy(c); if (q) b.q.copy(q); b.updateWorld(); b.estatico = true; b.snd = 'wood';
  MUNDO.cajas.push(b); const a = b.aabb; grillaAgregar(a.x0, a.z0, a.x1, a.z1, b); return b;
}
function cajaQuitar(b) {
  if (!b) return; const i = MUNDO.cajas.indexOf(b); if (i >= 0) MUNDO.cajas.splice(i, 1);
  const a = b.aabb, c = MUNDO.celda;
  for (let x = Math.floor(a.x0 / c); x <= Math.floor(a.x1 / c); x++) for (let z = Math.floor(a.z0 / c); z <= Math.floor(a.z1 / c); z++) {
    const l = MUNDO.grilla.get(_clave(x, z)); if (!l) continue; const k = l.indexOf(b); if (k >= 0) l.splice(k, 1);
  }
}
// ¿qué hay abajo de un punto? (para apoyar cosas en el piso)
function pisoBajo(p, alto) { const a = alto === undefined ? 2 : alto, h = mundoRayo(vadd(p, v3(0, a, 0)), v3(0, -1, 0), 400); return h ? p.y + a - h.t : null; }
