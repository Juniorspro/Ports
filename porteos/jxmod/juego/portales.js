// ---------------- puertas portal de los mapas (linked_portal_door, del addon World Portals de GMod) ----------------
// Mapas como THE BACKROOMS se hacen "infinitos" con puertas portal: cada una tiene su compañera en otra parte del mapa. Como
// en el addon, la puerta tiene un solo lado (el de adelante): de frente se ve lo que hay delante de la compañera y al
// cruzarla se sale por la compañera, con la misma dirección y velocidad (giradas lo que estén giradas las puertas: media
// vuelta sobre el eje de arriba, así se sigue de largo). De atrás no hay nada (el pasillo tapado que hay detrás).
// La vista: la escena dibujada desde la cámara llevada a la compañera, sólo lo de delante de la compañera (plano cercano
// oblicuo, como el reflejo del agua), sólo en el rectángulo de pantalla que ocupa la puerta (tijera) y sólo lo que se ve por
// el hueco (los cuatro planos de la cámara a los bordes de la compañera). En el dibujo principal, el rectángulo de la puerta
// toma esa imagen por la posición en pantalla; y una caja finita detrás del hueco tapa el corte del plano cercano cuando la
// cámara está a punto de cruzar (si no, un cuadro se veía el pasillo tapado).
const POR = {
  L: [], rt: null, vao: null, vb: null, A: null, on: false, caja: false, saltos: 0, ms: 0,
  Vv: new Float32Array(16), Pv: new Float32Array(16), VPv: new Float32Array(16), Mi: new Float32Array(16), PVc: new Float32Array(16),
  q: new Float32Array(3 * 6 * 5), nq: 0, cola: [], pl: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], npl: 0, cand: [],
};
function portalesMapa(aj) {
  POR.L = ((aj && aj.portales) || []).map((d) => Object.assign({}, d));
  for (const d of POR.L) { d.B = POR.L.find((x) => x !== d && x.n === d.par) || null; d.lx = null; }
  POR.A = null; POR.on = false;
  if (!POR.L.length) porLiberar();   // (sin puertas en el mapa: la imagen de la vista no ocupa memoria)
}
function porLiberar() {
  const gl = R.gl, X = POR.rt;
  if (X && gl) { gl.deleteTexture(X.t); gl.deleteFramebuffer(X.f); gl.deleteRenderbuffer(X.rb); }
  POR.rt = null;
}
// un punto respecto de una puerta: [adelante, derecha, arriba]
const porLocal = (d, p) => { const x = p.x - d.o[0], y = p.y - d.o[1], z = p.z - d.o[2]; return [x * d.f[0] + y * d.f[1] + z * d.f[2], x * d.r[0] + y * d.r[1] + z * d.r[2], x * d.u[0] + y * d.u[1] + z * d.u[2]]; };
// de la puerta A a su compañera: lo que está a x delante de A queda a x detrás de la compañera (media vuelta sobre el eje
// de arriba)
function porPunto(A, p) {
  const l = porLocal(A, p), B = A.B;
  return v3(B.o[0] - B.f[0] * l[0] - B.r[0] * l[1] + B.u[0] * l[2], B.o[1] - B.f[1] * l[0] - B.r[1] * l[1] + B.u[1] * l[2], B.o[2] - B.f[2] * l[0] - B.r[2] * l[1] + B.u[2] * l[2]);
}
function porDir(A, v) {
  const a = v.x * A.f[0] + v.y * A.f[1] + v.z * A.f[2], b = v.x * A.r[0] + v.y * A.r[1] + v.z * A.r[2], c = v.x * A.u[0] + v.y * A.u[1] + v.z * A.u[2], B = A.B;
  return v3(-B.f[0] * a - B.r[0] * b + B.u[0] * c, -B.f[1] * a - B.r[1] * b + B.u[1] * c, -B.f[2] * a - B.r[2] * b + B.u[2] * c);
}
// cada paso: si el jugador cruzó el plano de una puerta de adelante hacia atrás, por adentro de su rectángulo, sale por la
// compañera (en un vehículo no: como en GMod, el addon lleva a las personas)
function portalesPaso() {
  if (!POR.L.length) return;
  if (JUG.vehiculo || !JUG.vivo) { for (const d of POR.L) d.lx = null; return; }
  const p = JUG.pos;
  for (const d of POR.L) {
    if (!d.B) continue;
    const l = porLocal(d, p), dentro = Math.abs(l[1]) <= d.w && l[2] >= -d.h - 1.2 && l[2] <= d.h + 0.4 && Math.abs(l[0]) < 1.5;
    if (dentro && d.lx !== null && d.lx >= 0 && l[0] < 0) {
      const fw = porDir(d, v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)));
      JUG.pos.copy(porPunto(d, p)); JUG.vel.copy(porDir(d, JUG.vel)); JUG.yaw = Math.atan2(fw.x, fw.z);
      for (const e of POR.L) e.lx = null;   // (todas desde cero: la compañera no lo devuelve en el mismo paso)
      d.B.lx = porLocal(d.B, JUG.pos)[0]; POR.saltos++;
      return;
    }
    d.lx = dentro ? l[0] : null;
  }
}
// ---- la vista a través de la puerta ----
const VS_POR = `layout(location=0) in vec3 aP; uniform mat4 uVP; void main(){ gl_Position = uVP * vec4(aP, 1.0); }`;
const FS_POR = `precision highp float; uniform sampler2D uRT; uniform vec2 uInv; out vec4 o; void main(){ o = vec4(texture(uRT, gl_FragCoord.xy * uInv).rgb, 1.0); }`;
function porRT(w, h) {
  const gl = R.gl, X = POR.rt, hdr = R.salida === 'hdr';
  if (X && X.w === w && X.h === h && X.hdr === hdr) return X;
  porLiberar();
  const t = rtTex(w, h, ...(hdr ? R.F.hdr : R.F.ldr), gl.LINEAR), rb = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
  const f = rtFb(t, null, rb);
  if (!f) { gl.deleteTexture(t); gl.deleteRenderbuffer(rb); return null; }
  return (POR.rt = { t, f, rb, w, h, hdr });
}
// la matriz de un mapeo de puerta (como porPunto, para la cámara)
function porMat(A, out) {
  const e = [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)].map((v) => porDir(A, v)), o = porPunto(A, v3(0, 0, 0));
  out[0] = e[0].x; out[1] = e[0].y; out[2] = e[0].z; out[3] = 0; out[4] = e[1].x; out[5] = e[1].y; out[6] = e[1].z; out[7] = 0;
  out[8] = e[2].x; out[9] = e[2].y; out[10] = e[2].z; out[11] = 0; out[12] = o.x; out[13] = o.y; out[14] = o.z; out[15] = 1; return out;
}
// las esquinas de una puerta (a: -1/1 a lo ancho, b: -1/1 a lo alto, e: metros hacia adelante)
const porEsq = (d, a, b, e) => v3(d.o[0] + d.f[0] * e + d.r[0] * a * d.w + d.u[0] * b * d.h, d.o[1] + d.f[1] * e + d.r[1] * a * d.w + d.u[1] * b * d.h, d.o[2] + d.f[2] * e + d.r[2] * a * d.w + d.u[2] * b * d.h);
const POR_PROF = 0.3;   // (lo hondo de la caja de atrás: más que la distancia de la cámara a la esquina del plano cercano)
// ¿se ve la puerta? (algún punto del hueco sin nada del mapa en el medio)
function porSeVe(d, cp) {
  for (const [a, b] of [[0, 0], [-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
    const q = porEsq(d, a, b, 0.05), v = vsub(q, cp), L = v.len(); if (L < 0.3) return true;
    if (!mundoRayo(cp, vscale(v, 1 / L), L - 0.1)) return true;
  }
  return false;
}
// antes del dibujo principal: la puerta más cercana que se ve de frente se dibuja vista desde la compañera
function portalesVista(P, V) {
  POR.on = false; POR.A = null;
  if (!POR.L.length || Q.get('sinPortal')) return;
  const cp = R.camPos, C = POR.cand; C.length = 0;
  for (const d of POR.L) {
    if (!d.B) continue;
    const l = porLocal(d, cp); if (l[0] <= 0.002) continue;   // (de atrás o de canto no se ve, como en GMod)
    const dist = Math.hypot(l[0], Math.max(0, Math.abs(l[1]) - d.w), Math.max(0, Math.abs(l[2]) - d.h));
    if (dist > R.lejos || !sphereIn(R.fr, d.o[0], d.o[1], d.o[2], Math.hypot(d.w, d.h) + POR_PROF)) continue;
    C.push([dist, d, l[0]]);
  }
  if (!C.length) return;
  C.sort((a, b) => a[0] - b[0]);
  let A = null, lA = 0; for (const [, d, l0] of C) if (porSeVe(d, cp)) { A = d; lA = l0; break; }
  if (!A) return;
  const t0 = performance.now(), gl = R.gl, div = GFX.luz >= 2 ? 1 : 2, W = Math.max(16, Math.round(R.cv.width / div)), H = Math.max(16, Math.round(R.cv.height / div)), X = porRT(W, H); if (!X) return;
  // cerca del plano: también la caja de atrás (ver portalesQuad)
  const ldA = porLocal(A, cp); POR.caja = lA < 0.6 && Math.abs(ldA[1]) < A.w + 0.4 && Math.abs(ldA[2]) < A.h + 0.4;
  // el rectángulo de pantalla de la puerta (con la caja, si va): ahí solo se dibuja la vista
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, todo = false; const M = R.vp;
  for (const e of POR.caja ? [0, -POR_PROF] : [0]) for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const q = porEsq(A, a, b, e), w = M[3] * q.x + M[7] * q.y + M[11] * q.z + M[15];
    if (w < 1e-3) { todo = true; break; }
    const sx = ((M[0] * q.x + M[4] * q.y + M[8] * q.z + M[12]) / w * 0.5 + 0.5) * W, sy = ((M[1] * q.x + M[5] * q.y + M[9] * q.z + M[13]) / w * 0.5 + 0.5) * H;
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  if (todo) { x0 = 0; y0 = 0; x1 = W; y1 = H; }
  const sx0 = clamp(Math.floor(x0) - 2, 0, W), sy0 = clamp(Math.floor(y0) - 2, 0, H), sx1 = clamp(Math.ceil(x1) + 2, 0, W), sy1 = clamp(Math.ceil(y1) + 2, 0, H);
  if (sx1 <= sx0 || sy1 <= sy0) return;
  // la cámara llevada a la compañera: lo que se ve por A es lo que hay delante de la compañera
  const B = A.B; porMat(B, POR.Mi); m4mul(V, POR.Mi, POR.Vv);
  const cv = porPunto(A, cp);
  // plano cercano oblicuo en la compañera: sólo lo de delante (lo de atrás, el pasillo tapado, no). Corre unos cm hacia
  // atrás, más que el rectángulo hacia adelante (POR.off): si no, entre los dos quedaba una rayita del color del fondo
  const cOff = Math.min(0.06, lA * 0.5); POR.off = Math.min(0.03, cOff * 0.5);
  const n = B.f, Cw = [n[0], n[1], n[2], -(n[0] * B.o[0] + n[1] * B.o[1] + n[2] * B.o[2]) + cOff];
  const Vi = M4.inv(POR.Vv), Cv = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) Cv[i] = Vi[i * 4] * Cw[0] + Vi[i * 4 + 1] * Cw[1] + Vi[i * 4 + 2] * Cw[2] + Vi[i * 4 + 3] * Cw[3];
  const Pv = POR.Pv; Pv.set(P);
  const qx = (Math.sign(Cv[0]) + Pv[8]) / Pv[0], qy = (Math.sign(Cv[1]) + Pv[9]) / Pv[5], qw = (1 + Pv[10]) / Pv[14], k = 2 / (Cv[0] * qx + Cv[1] * qy - Cv[2] + Cv[3] * qw);
  Pv[2] = Cv[0] * k; Pv[6] = Cv[1] * k; Pv[10] = Cv[2] * k + 1; Pv[14] = Cv[3] * k;
  m4mul(Pv, POR.Vv, POR.VPv);
  // lo que se ve por el hueco: los planos de la cámara a cada borde de la compañera (de muy cerca del plano no hacen falta)
  const pl = POR.pl; POR.npl = 0;
  if (lA > 0.01) {
    const E = [porEsq(B, -1, -1, 0), porEsq(B, 1, -1, 0), porEsq(B, 1, 1, 0), porEsq(B, -1, 1, 0)], dc = vsub(v3(B.o[0], B.o[1], B.o[2]), cv).norm(), ref = v3(B.o[0] + dc.x, B.o[1] + dc.y, B.o[2] + dc.z);
    for (let i = 0; i < 4; i++) {
      let nn = vsub(E[i], cv).cross(vsub(E[(i + 1) & 3], cv)); const L = nn.len(); if (L < 1e-6) continue; nn = vscale(nn, 1 / L);
      let dd = -nn.dot(cv); if (nn.dot(ref) + dd < 0) { nn = vscale(nn, -1); dd = -dd; }
      const o = POR.npl * 4; pl[o] = nn.x; pl[o + 1] = nn.y; pl[o + 2] = nn.z; pl[o + 3] = dd; POR.npl++;
    }
  }
  const F = frustum(POR.VPv), lj = R.lejos, L = POR.cola; L.length = 0;
  const nb = n[0] * B.o[0] + n[1] * B.o[1] + n[2] * B.o[2];
  for (let i = 0; i < R.nItems; i++) {
    const p = R.items[i]; if (p.vista || p.mt.blend || p.mt.oculto) continue;
    if (n[0] * p.cx + n[1] * p.cy + n[2] * p.cz - nb < -p.r) continue;   // (detrás de la compañera)
    if (!sphereIn(F, p.cx, p.cy, p.cz, p.r)) continue;
    let fuera = false; for (let j = 0; j < POR.npl; j++) { const o = j * 4; if (pl[o] * p.cx + pl[o + 1] * p.cy + pl[o + 2] * p.cz + pl[o + 3] < -p.r) { fuera = true; break; } }
    if (fuera) continue;
    const dx = p.cx - cv.x, dy = p.cy - cv.y, dz = p.cz - cv.z; if (dx * dx + dy * dy + dz * dz > (lj + p.r) * (lj + p.r)) continue;
    L.push(p);
  }
  L.sort(ordenOpaco); POR.items = L.length;
  gl.bindFramebuffer(gl.FRAMEBUFFER, X.f); gl.viewport(0, 0, W, H);
  gl.enable(gl.SCISSOR_TEST); gl.scissor(sx0, sy0, sx1 - sx0, sy1 - sy0);
  const N = R.salida !== 'gam' && R.lin ? R.lin.nieC : R.niebla.c; gl.clearColor(N[0], N[1], N[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const vp0 = POR.vp0 || (POR.vp0 = new Float32Array(16)); vp0.set(R.vp); const cam = R.camPos.clone(), fr = R.fr;
  R.vp.set(POR.VPv); R.camPos.copy(cv); R.fr = F; R.marca++;
  const cola = R.cola; R.cola = L; dibujarOpacos(); R.cola = cola;
  m4mul(P, POR.Vv, POR.PVc); dibujarCielo(M4.inv(POR.PVc));
  R.vp.set(vp0); R.camPos.copy(cam); R.fr = fr; R.marca++;
  gl.disable(gl.SCISSOR_TEST);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  POR.A = A; POR.on = true; POR.ms = performance.now() - t0;
}
// en el dibujo principal, después de lo opaco: el rectángulo de la puerta con la vista del otro lado (hasta 3 cm hacia la
// cámara, para que gane al fondo del pasillo tapado si está en el mismo plano) y, si la cámara está por cruzar, la caja
function portalesQuad() {
  if (!POR.on || !POR.A || !POR.rt) return;
  const gl = R.gl, A = POR.A, k = 'porQuad'; let P = R.progs.get(k);
  if (!P) { try { P = shader(VS_POR, FS_POR, []); } catch (e) { POR.L = []; console.warn('portales', e); return; } R.progs.set(k, P); }
  if (!POR.vao) { POR.vao = gl.createVertexArray(); gl.bindVertexArray(POR.vao); POR.vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, POR.vb); gl.bufferData(gl.ARRAY_BUFFER, POR.q.byteLength, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0); gl.bindVertexArray(null); }
  const q = POR.q; let i = 0;
  const tri = (a, b, c) => { for (const v of [a, b, c]) { q[i++] = v.x; q[i++] = v.y; q[i++] = v.z; } };
  const cuad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  const e = POR.off || 0.03, f0 = [porEsq(A, -1, -1, e), porEsq(A, 1, -1, e), porEsq(A, 1, 1, e), porEsq(A, -1, 1, e)];
  cuad(f0[0], f0[1], f0[2], f0[3]);
  if (POR.caja) {
    const a = [porEsq(A, -1, -1, 0), porEsq(A, 1, -1, 0), porEsq(A, 1, 1, 0), porEsq(A, -1, 1, 0)], b = [porEsq(A, -1, -1, -POR_PROF), porEsq(A, 1, -1, -POR_PROF), porEsq(A, 1, 1, -POR_PROF), porEsq(A, -1, 1, -POR_PROF)];
    cuad(b[0], b[1], b[2], b[3]);
    for (let j = 0; j < 4; j++) cuad(a[j], a[(j + 1) & 3], b[(j + 1) & 3], b[j]);
  }
  POR.nq = i / 3;
  gl.useProgram(P.p); R.progAct = null;
  gl.uniformMatrix4fv(P.u.uVP, false, R.vp); gl.uniform2f(P.u.uInv, 1 / R.cv.width, 1 / R.cv.height);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, POR.rt.t); if (P.u.uRT) gl.uniform1i(P.u.uRT, 0); R.texAct = null;
  gl.bindVertexArray(POR.vao); gl.bindBuffer(gl.ARRAY_BUFFER, POR.vb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, q.subarray(0, i)); R.vaoAct = null;
  // (la caja coincide con las paredes del pasillo tapado: corrida un poco hacia la cámara en profundidad, gana siempre)
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
  gl.disable(gl.CULL_FACE); gl.drawArrays(gl.TRIANGLES, 0, POR.nq); gl.enable(gl.CULL_FACE);
  gl.polygonOffset(0, 0); gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.bindVertexArray(null);
}
