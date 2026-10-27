// ---------------------------------------------------------------------------------------------------------
// dibujo: WebGL2, un solo shader con variantes (piel, recorte, terreno, sin luz), mallas y texturas que se
// suben recién cuando se usan, cielo degradé con sol y niebla. Pensado para que ande en teléfonos flojos.
// ---------------------------------------------------------------------------------------------------------
const R = { gl: null, cv: null, prog: {}, mallas: [], tex: [], mats: [], cola: [], colaT: [], vp: new Float32Array(16), view: null, proj: null,
  camPos: v3(), sol: v3(0.4, 0.8, 0.3).norm(), solCol: [1, 0.96, 0.84], ambS: [0.55, 0.62, 0.72], ambG: [0.3, 0.27, 0.22],
  niebla: { c: [0.8, 0.85, 0.9], a: 150, b: 600 }, cielo: null, escala: 1, dibujadas: 0, tris: 0 };
const _m4a = new Float32Array(16), _m4b = new Float32Array(16);
function m4mul(a, b, out) {
  const a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5], a6 = a[6], a7 = a[7], a8 = a[8], a9 = a[9], a10 = a[10], a11 = a[11], a12 = a[12], a13 = a[13], a14 = a[14], a15 = a[15];
  for (let i = 0; i < 16; i += 4) {
    const b0 = b[i], b1 = b[i + 1], b2 = b[i + 2], b3 = b[i + 3];
    out[i] = a0 * b0 + a4 * b1 + a8 * b2 + a12 * b3; out[i + 1] = a1 * b0 + a5 * b1 + a9 * b2 + a13 * b3;
    out[i + 2] = a2 * b0 + a6 * b1 + a10 * b2 + a14 * b3; out[i + 3] = a3 * b0 + a7 * b1 + a11 * b2 + a15 * b3;
  }
  return out;
}
// matriz desde posición [x,y,z], rotación [x,y,z,w] y escala [x,y,z]
function m4trs(p, r, s, out) {
  const x = r[0], y = r[1], z = r[2], w = r[3], sx = s[0], sy = s[1], sz = s[2], m = out;
  m[0] = (1 - 2 * (y * y + z * z)) * sx; m[1] = 2 * (x * y + z * w) * sx; m[2] = 2 * (x * z - y * w) * sx; m[3] = 0;
  m[4] = 2 * (x * y - z * w) * sy; m[5] = (1 - 2 * (x * x + z * z)) * sy; m[6] = 2 * (y * z + x * w) * sy; m[7] = 0;
  m[8] = 2 * (x * z + y * w) * sz; m[9] = 2 * (y * z - x * w) * sz; m[10] = (1 - 2 * (x * x + y * y)) * sz; m[11] = 0;
  m[12] = p[0]; m[13] = p[1]; m[14] = p[2]; m[15] = 1; return m;
}
const m4pt = (m, x, y, z, o) => o.set(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
const m4esc = (m) => Math.max(Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10]));

const VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec2 aU;
#ifdef SKIN
layout(location=3) in vec4 aJ; layout(location=4) in vec4 aW;
uniform vec4 uB[168];
#endif
uniform mat4 uVP, uM; uniform vec3 uQ0, uQ1; uniform vec4 uST; uniform vec3 uCam;
out vec3 vN; out vec2 vU; out vec3 vW;
void main(){
  vec3 p = uQ0 + aP * uQ1; vec3 n = aN;
#ifdef SKIN
  vec4 r0 = vec4(0.0), r1 = vec4(0.0), r2 = vec4(0.0);
  for (int k = 0; k < 4; k++) { int j = int(aJ[k]) * 3; float w = aW[k]; r0 += uB[j] * w; r1 += uB[j + 1] * w; r2 += uB[j + 2] * w; }
  vec4 q = vec4(p, 1.0); p = vec3(dot(r0, q), dot(r1, q), dot(r2, q));
  n = vec3(dot(r0.xyz, n), dot(r1.xyz, n), dot(r2.xyz, n));
#endif
  vec4 w = uM * vec4(p, 1.0); vW = w.xyz; vN = mat3(uM) * n; vU = aU * uST.xy + uST.zw;
  gl_Position = uVP * w;
}`;
const FS = `#version 300 es
precision mediump float;
in vec3 vN; in vec2 vU; in vec3 vW;
uniform sampler2D uT;
#ifdef TERR
uniform sampler2D uT1, uT2, uT3; uniform vec4 uS1; uniform vec2 uS3;
#endif
uniform vec4 uC; uniform vec3 uSol, uSolC, uAmbS, uAmbG, uNieC, uCam, uEm; uniform vec2 uNie; uniform float uCorte;
out vec4 o;
void main(){
#ifdef TERR
  vec4 k = texture(uT, vU);
  vec2 u = vU;
  vec3 c = texture(uT1, u * uS1.xy).rgb * k.r + texture(uT2, u * uS1.zw).rgb * k.g + texture(uT3, u * uS3).rgb * k.b;
  vec4 t = vec4(c, 1.0);
#else
  vec4 t = texture(uT, vU);
#endif
  t *= uC;
#ifdef CUT
  if (t.a < uCorte) discard;
#endif
#ifdef UNLIT
  vec3 col = t.rgb;
#else
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  float d = max(dot(n, uSol), 0.0);
  vec3 amb = mix(uAmbG, uAmbS, n.y * 0.5 + 0.5);
  vec3 col = t.rgb * (amb + uSolC * d) + uEm;
#endif
  float f = clamp((distance(vW, uCam) - uNie.x) / (uNie.y - uNie.x), 0.0, 1.0);
  o = vec4(mix(col, uNieC, f), t.a);
}`;
const VS_CIELO = `#version 300 es
layout(location=0) in vec2 aP; uniform mat4 uIVP; out vec3 vD;
void main(){ vec4 a = uIVP * vec4(aP, 1.0, 1.0); vD = a.xyz / a.w; gl_Position = vec4(aP, 0.9999, 1.0); }`;
const FS_CIELO = `#version 300 es
precision mediump float; in vec3 vD; uniform vec3 uTop, uMid, uBot, uSol, uSolC, uCam; uniform vec2 uExp; out vec4 o;
void main(){
  vec3 d = normalize(vD - uCam); float y = d.y;
  vec3 c = y > 0.0 ? mix(uMid, uTop, pow(y, uExp.x)) : mix(uMid, uBot, pow(-y, uExp.y));
  float s = max(dot(d, uSol), 0.0); c += uSolC * (pow(s, 900.0) * 1.2 + pow(s, 12.0) * 0.12);
  o = vec4(c, 1.0);
}`;
// líneas, rayos y partículas (sin luz, color por vértice)
const VS_LIN = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec4 aC; uniform mat4 uVP; out vec4 vC; void main(){ vC = aC; gl_Position = uVP * vec4(aP, 1.0); gl_PointSize = 6.0; }`;
const FS_LIN = `#version 300 es
precision mediump float; in vec4 vC; out vec4 o; void main(){ o = vC; }`;

function shader(vs, fs, defs) {
  const gl = R.gl, pre = (defs || []).map((d) => '#define ' + d + '\n').join('');
  const mk = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src.replace('\n', '\n' + pre)); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i), nm = a.name.replace('[0]', ''); u[nm] = gl.getUniformLocation(p, a.name); }
  gl.useProgram(p);
  for (const [k, v] of [['uT', 0], ['uT1', 1], ['uT2', 2], ['uT3', 3]]) if (u[k]) gl.uniform1i(u[k], v);
  return { p, u };
}
function glIniciar() {
  const cv = $('cv'); R.cv = cv;
  const gl = cv.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: TEST });
  if (!gl) throw new Error('webgl2');
  R.gl = gl;
  for (const [k, d] of [['base', []], ['cut', ['CUT']], ['unlit', ['UNLIT']], ['unlitcut', ['UNLIT', 'CUT']], ['terr', ['TERR']], ['skin', ['SKIN']], ['skincut', ['SKIN', 'CUT']]])
    R.prog[k] = shader(VS, FS, d);
  R.prog.cielo = shader(VS_CIELO, FS_CIELO);
  R.prog.lin = shader(VS_LIN, FS_LIN);
  R.quad = gl.createVertexArray(); gl.bindVertexArray(R.quad);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  R.linBuf = gl.createBuffer(); R.linVao = gl.createVertexArray(); gl.bindVertexArray(R.linVao); gl.bindBuffer(gl.ARRAY_BUFFER, R.linBuf);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
  gl.bindVertexArray(null);
  // textura de espera (gris) mientras se decodifica la real
  R.texGris = texSolida([200, 200, 200, 255]); R.texBlanca = texSolida([255, 255, 255, 255]);
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
}
function texSolida(c) {
  const gl = R.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(c)); return t;
}
// ---------------- texturas (se decodifican cuando hacen falta) ----------------
function texGL(i) {
  if (i == null || i < 0) return R.texBlanca;
  let t = R.tex[i];
  if (t) return t.gl || R.texGris;
  t = R.tex[i] = { gl: null };
  const blob = new Blob([PK.parte('t' + i)], { type: 'image/webp' });
  createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }).then((img) => {
    const gl = R.gl, tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
    let src = img;
    if (GFX.texMax && Math.max(img.width, img.height) > GFX.texMax) {
      const k = GFX.texMax / Math.max(img.width, img.height), c = document.createElement('canvas');
      c.width = Math.max(4, Math.round(img.width * k)); c.height = Math.max(4, Math.round(img.height * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); src = c;
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    if (R.aniso && GFX.aniso) gl.texParameterf(gl.TEXTURE_2D, R.aniso.TEXTURE_MAX_ANISOTROPY_EXT, GFX.aniso);
    t.gl = tx; img.close && img.close();
  }).catch(() => { t.gl = R.texGris; });
  return R.texGris;
}
// ---------------- mallas (de los datos del juego al GPU) ----------------
function mallaGL(i) {
  let m = R.mallas[i]; if (m) return m;
  const d = DATA.ms[i], gl = R.gl, vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, BIN, gl.STATIC_DRAW, d.o, d.v * 14);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.UNSIGNED_SHORT, true, 14, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.BYTE, true, 14, 6);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.HALF_FLOAT, false, 14, 10);
  if (d.sk !== undefined) {
    const sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.bufferData(gl.ARRAY_BUFFER, BIN, gl.STATIC_DRAW, d.sk, d.v * 8);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, false, 8, 0);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, 8, 4);
  }
  let n = 0; for (const s of d.sub) n = Math.max(n, s[0] + s[1]);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  const bytes = BIN.slice(d.i, d.i + n * (d.i32 ? 4 : 2));
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, bytes, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  // esfera que la envuelve (para no dibujar lo que no se ve)
  const c = [d.mn[0] + d.sc[0] / 2, d.mn[1] + d.sc[1] / 2, d.mn[2] + d.sc[2] / 2], r = Math.hypot(d.sc[0], d.sc[1], d.sc[2]) / 2;
  m = R.mallas[i] = { vao, d, it: d.i32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, isz: d.i32 ? 4 : 2, c, r, skin: d.sk !== undefined };
  return m;
}
// ---------------- materiales ----------------
const SH_BLEND = /Transparent|Particles|Fade/;
function matGL(i) {
  let m = R.mats[i]; if (m) return m;
  const d = DATA.mt[i] || {}, sh = d.sh || '', f = d.f || {}, tt = d.tt || {};
  m = { d, c: d.c && !/^Mobile\//.test(sh) ? d.c.slice() : [1, 1, 1, 1], tex: d.t, st: [1, 1, 0, 0], blend: false, cut: false, unlit: false, terr: null, add: false, oculto: false, em: [0, 0, 0] };
  if (d.ts) m.st = [d.ts[0], d.ts[1], d.to[0], d.to[1]];
  const mode = f._Mode || 0;
  if (sh === 'Standard' && mode >= 2) m.blend = true;
  if (sh === 'Standard' && mode === 1) m.cut = true;
  if (SH_BLEND.test(sh)) m.blend = true;
  if (/Unlit|Particles|GUI|Grass/.test(sh)) m.unlit = true;
  if (/Grass/.test(sh)) { m.cut = true; m.blend = false; }
  if (/Additive/.test(sh)) m.add = true;
  if (/ShadowDrawer|GUI\/Text/.test(sh)) m.oculto = true;
  if (sh === 'Standard' && d.e) m.em = d.e.map((x) => x * 0.6);
  if (/Terrain To Mesh/.test(sh) && tt._V_T2M_Control) {
    const esc = (k) => { const x = tt['_V_T2M_Splat' + k]; if (!x) return null; const u = f['_V_T2M_Splat' + k + '_uvScale'] || 1; return [x[0], x[1] * u, x[2] * u]; };
    m.terr = { ctl: tt._V_T2M_Control[0], t: [esc(1), esc(2), esc(3)] };
    m.tex = m.terr.ctl;
  }
  if (m.tex === undefined && tt._MainTex) { m.tex = tt._MainTex[0]; m.st = tt._MainTex.slice(1); }
  if (m.tex !== undefined && m.tex >= 0 && DATA.tx[m.tex] && DATA.tx[m.tex].a && !m.blend && /Cutout|Vertex|Standard/.test(sh) && mode !== 0) m.cut = true;
  m.prog = m.terr ? 'terr' : m.unlit ? (m.cut ? 'unlitcut' : 'unlit') : m.cut ? 'cut' : 'base';
  return (R.mats[i] = m);
}
// ---------------- la cola de dibujo de cada cuadro ----------------
// cada pedido: malla, submalla (o rango), material, matriz (o null = identidad), huesos (o null)
const IDM = M4.id();
function encolar(mi, sub, mat, M, huesos, extra) {
  const m = mallaGL(mi), mt = matGL(mat);
  if (mt.oculto) return;
  // descartar lo que no está en el campo visual
  if (!huesos) {
    const Mx = M || IDM;
    m4pt(Mx, m.c[0], m.c[1], m.c[2], _vq);
    const r = m.r * m4esc(Mx);
    if (!sphereIn(R.fr, _vq.x, _vq.y, _vq.z, r)) return;
    const dx = _vq.x - R.camPos.x, dy = _vq.y - R.camPos.y, dz = _vq.z - R.camPos.z;
    if (dx * dx + dy * dy + dz * dz > (R.lejos + r) * (R.lejos + r)) return;
  }
  const s = m.d.sub[sub]; if (!s) return;
  const p = { m, s0: s[0], sn: s[1], mt, M: M || IDM, h: huesos, x: extra || null, z: 0 };
  if (mt.blend) { p.z = -((_vq.x - R.camPos.x) ** 2 + (_vq.y - R.camPos.y) ** 2 + (_vq.z - R.camPos.z) ** 2); R.colaT.push(p); }
  else R.cola.push(p);
}
const _vq = v3();
function usarProg(nombre) {
  const gl = R.gl, P = R.prog[nombre];
  if (R.progAct === P) return P;
  R.progAct = P; gl.useProgram(P.p);
  gl.uniformMatrix4fv(P.u.uVP, false, R.vp);
  if (P.u.uSol) {
    gl.uniform3f(P.u.uSol, R.sol.x, R.sol.y, R.sol.z); gl.uniform3fv(P.u.uSolC, R.solCol); gl.uniform3fv(P.u.uAmbS, R.ambS); gl.uniform3fv(P.u.uAmbG, R.ambG);
    gl.uniform3fv(P.u.uNieC, R.niebla.c); gl.uniform2f(P.u.uNie, R.niebla.a, R.niebla.b); gl.uniform3f(P.u.uCam, R.camPos.x, R.camPos.y, R.camPos.z);
  }
  return P;
}
function dibujarPedido(p) {
  const gl = R.gl, mt = p.mt;
  const prog = p.h ? (mt.cut ? 'skincut' : 'skin') : mt.prog;
  const P = usarProg(prog);
  if (R.texAct !== mt) {
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texGL(mt.tex));
    if (mt.terr) {
      const S = mt.terr.t;
      for (let k = 0; k < 3; k++) { gl.activeTexture(gl.TEXTURE1 + k); gl.bindTexture(gl.TEXTURE_2D, texGL(S[k] ? S[k][0] : -1)); }
      gl.uniform4f(P.u.uS1, S[0] ? S[0][1] : 1, S[0] ? S[0][2] : 1, S[1] ? S[1][1] : 1, S[1] ? S[1][2] : 1); gl.uniform2f(P.u.uS3, S[2] ? S[2][1] : 1, S[2] ? S[2][2] : 1);
      gl.activeTexture(gl.TEXTURE0);
    }
    R.texAct = mt;
  }
  const c = p.x && p.x.c ? p.x.c : mt.c;
  gl.uniform4f(P.u.uC, c[0], c[1], c[2], c[3]);
  if (P.u.uEm) gl.uniform3fv(P.u.uEm, p.x && p.x.em ? p.x.em : mt.em);
  if (P.u.uCorte) gl.uniform1f(P.u.uCorte, 0.5);
  gl.uniform4fv(P.u.uST, mt.st);
  const d = p.m.d;
  gl.uniform3f(P.u.uQ0, d.mn[0], d.mn[1], d.mn[2]); gl.uniform3f(P.u.uQ1, d.sc[0], d.sc[1], d.sc[2]);
  gl.uniformMatrix4fv(P.u.uM, false, p.M);
  if (p.h) gl.uniform4fv(P.u.uB, p.h);
  if (R.vaoAct !== p.m.vao) { gl.bindVertexArray(p.m.vao); R.vaoAct = p.m.vao; }
  gl.drawElements(gl.TRIANGLES, p.sn, p.m.it, p.s0 * p.m.isz);
  R.dibujadas++; R.tris += p.sn / 3;
}
function dibujarCola() {
  const gl = R.gl;
  R.progAct = null; R.texAct = null; R.vaoAct = null;
  // opacos: agrupados por programa y material
  R.cola.sort((a, b) => (a.mt.prog < b.mt.prog ? -1 : a.mt.prog > b.mt.prog ? 1 : 0) || (a.mt === b.mt ? 0 : (a.mt.d.n < b.mt.d.n ? -1 : 1)));
  gl.disable(gl.BLEND); gl.depthMask(true);
  for (const p of R.cola) { if (p.x && p.x.dobleCara) gl.disable(gl.CULL_FACE); dibujarPedido(p); if (p.x && p.x.dobleCara) gl.enable(gl.CULL_FACE); }
  // transparentes de atrás para adelante
  R.colaT.sort((a, b) => a.z - b.z);
  gl.enable(gl.BLEND); gl.depthMask(false);
  for (const p of R.colaT) { gl.blendFunc(gl.SRC_ALPHA, p.mt.add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); dibujarPedido(p); }
  gl.depthMask(true); gl.disable(gl.BLEND);
  gl.bindVertexArray(null); R.vaoAct = null;
  R.cola.length = 0; R.colaT.length = 0;
}
function dibujarCielo(IVP) {
  const gl = R.gl, P = R.prog.cielo, C = R.cielo; if (!C) return;
  gl.useProgram(P.p); R.progAct = P;
  gl.uniformMatrix4fv(P.u.uIVP, false, IVP);
  gl.uniform3fv(P.u.uTop, C.top); gl.uniform3fv(P.u.uMid, C.mid); gl.uniform3fv(P.u.uBot, C.bot); gl.uniform2fv(P.u.uExp, C.exp);
  gl.uniform3f(P.u.uSol, R.sol.x, R.sol.y, R.sol.z); gl.uniform3fv(P.u.uSolC, C.sol); gl.uniform3f(P.u.uCam, R.camPos.x, R.camPos.y, R.camPos.z);
  gl.depthMask(false); gl.bindVertexArray(R.quad); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null); gl.depthMask(true);
}
// líneas sueltas (rayos de la pistola física, el cable, la mira de herramientas)
const LIN = { v: new Float32Array(7 * 4096), n: 0, pts: new Float32Array(7 * 1024), np: 0 };
function linea(a, b, c) {
  if (LIN.n + 2 > 4096) return; const v = LIN.v; let i = LIN.n * 7;
  v[i] = a.x; v[i + 1] = a.y; v[i + 2] = a.z; v[i + 3] = c[0]; v[i + 4] = c[1]; v[i + 5] = c[2]; v[i + 6] = c[3]; i += 7;
  v[i] = b.x; v[i + 1] = b.y; v[i + 2] = b.z; v[i + 3] = c[0]; v[i + 4] = c[1]; v[i + 5] = c[2]; v[i + 6] = c[3]; LIN.n += 2;
}
function dibujarLineas() {
  if (!LIN.n) return;
  const gl = R.gl, P = R.prog.lin; gl.useProgram(P.p); R.progAct = P; gl.uniformMatrix4fv(P.u.uVP, false, R.vp);
  gl.bindVertexArray(R.linVao); gl.bindBuffer(gl.ARRAY_BUFFER, R.linBuf); gl.bufferData(gl.ARRAY_BUFFER, LIN.v.subarray(0, LIN.n * 7), gl.STREAM_DRAW);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.LINES, 0, LIN.n); gl.disable(gl.BLEND); gl.bindVertexArray(null); LIN.n = 0;
}
