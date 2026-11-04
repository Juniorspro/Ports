// ---------------------------------------------------------------------------------------------------------
// marcas de frenada (el SkidManager del juego): cuando una rueda patina de costado o frena fuerte deja una
// franja oscura en el piso que se va borrando. Un solo búfer circular de tiras, dibujado con el programa de
// líneas (color por vértice) apenas despegado del piso.
// ---------------------------------------------------------------------------------------------------------
const MARCAS = { max: 900, v: null, n: 0, ini: 0, buf: null, vao: null, sucio: false };
function marcasIniciar() {
  const gl = R.gl;
  MARCAS.v = new Float32Array(MARCAS.max * 6 * 7);
  MARCAS.vao = gl.createVertexArray(); gl.bindVertexArray(MARCAS.vao); MARCAS.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, MARCAS.buf);
  gl.bufferData(gl.ARRAY_BUFFER, MARCAS.v.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
  gl.bindVertexArray(null);
}
function marcasLimpiar() { MARCAS.n = 0; MARCAS.ini = 0; MARCAS.sucio = true; }
// un tramo de a (punto anterior de la rueda) a b, sobre un piso con normal n, ancho w, fuerza k (0..1)
function marcaTramo(a, b, n, w, k) {
  if (!MARCAS.v) return;
  const d = vsub(b, a), L = d.len(); if (L < 0.02 || L > 3) return;
  const lado = vcross(n, d).norm().scale(w / 2), e = vscale(n, 0.02), al = clamp(k, 0.15, 1) * 0.55;
  const p = [vadd(vadd(a, lado), e), vadd(vsub(a, lado), e), vadd(vsub(b, lado), e), vadd(vadd(b, lado), e)];
  const i = (MARCAS.ini + MARCAS.n) % MARCAS.max; if (MARCAS.n < MARCAS.max) MARCAS.n++; else MARCAS.ini = (MARCAS.ini + 1) % MARCAS.max;
  const V = MARCAS.v; let o = i * 42;
  for (const q of [p[0], p[1], p[2], p[0], p[2], p[3]]) { V[o] = q.x; V[o + 1] = q.y; V[o + 2] = q.z; V[o + 3] = 0.05; V[o + 4] = 0.05; V[o + 5] = 0.05; V[o + 6] = al; o += 7; }
  MARCAS.sucio = true;
}
function dibujarMarcas() {
  if (!MARCAS.n || !MARCAS.vao) return;
  const gl = R.gl, P = R.prog.lin;
  if (MARCAS.sucio) { gl.bindBuffer(gl.ARRAY_BUFFER, MARCAS.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, MARCAS.v); MARCAS.sucio = false; }
  gl.useProgram(P.p); R.progAct = P; gl.uniformMatrix4fv(P.u.uVP, false, R.vp); gl.uniform1f(P.u.uLin, 0);
  gl.bindVertexArray(MARCAS.vao);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4); gl.disable(gl.CULL_FACE);
  gl.drawArrays(gl.TRIANGLES, 0, MARCAS.max * 6);
  gl.enable(gl.CULL_FACE); gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null); R.vaoAct = null;
}
