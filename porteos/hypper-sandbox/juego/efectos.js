// ---------------------------------------------------------------------------------------------------------
// efectos: partículas en carteles (humo, fuego, chispas, polvo), fogonazo del arma, trazas de bala.
// Un solo búfer dinámico; en "patata" se crean muchas menos.
// ---------------------------------------------------------------------------------------------------------
const VS_PART = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec4 aC; layout(location=2) in vec3 aE;
uniform mat4 uVP; uniform vec3 uDer, uArr; out vec4 vC; out vec2 vU;
void main(){ vC = aC; vU = aE.xy * 0.5 + 0.5; vec3 p = aP + (uDer * aE.x + uArr * aE.y) * aE.z; gl_Position = uVP * vec4(p, 1.0); }`;
const FS_PART = `#version 300 es
precision mediump float; in vec4 vC; in vec2 vU; uniform sampler2D uT; uniform float uLin, uBri; out vec4 o;
void main(){ vec4 t = texture(uT, vU); o = vec4(vC.rgb * t.rgb, vC.a * t.a); if (uLin > 0.5) o.rgb = pow(o.rgb, vec3(2.2)) * uBri; }`;
const PART = { l: [], max: 600, buf: null, vao: null, data: new Float32Array(600 * 6 * 10), tex: {} };
function efectosIniciar() {
  const gl = R.gl; PART.prog = shader(VS_PART, FS_PART);
  PART.vao = gl.createVertexArray(); gl.bindVertexArray(PART.vao); PART.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, PART.buf);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 40, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 40, 28);
  gl.bindVertexArray(null);
  // textura de punto suave (procedural)
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.generateMipmap(gl.TEXTURE_2D);
  PART.tex.punto = t;
  const fi = DATA.tx.findIndex((t) => /MuzzleFlash2/.test(t.n)); PART.fogTex = fi;
}
// tipo: 'humo' y 'gota' (alfa; la gota cae y se ve desde el primer cuadro), 'fuego'/'chispa'/'fog' (suma)
function particula(p, v, vida, tam, col, tipo, crece) {
  if (PART.l.length >= PART.max * GFX.part) return;
  PART.l.push({ p: p.clone(), v: v.clone(), vida, t: 0, tam, col, tipo: tipo || 'humo', crece: crece === undefined ? (tipo === 'humo' ? 1.8 : 0.3) : crece, grav: tipo === 'chispa' || tipo === 'gota' ? 1 : tipo === 'humo' ? -0.05 : 0 });
}
function efectosPaso(dt) {
  const L = PART.l;
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i]; q.t += dt; if (q.t >= q.vida) { L[i] = L[L.length - 1]; L.pop(); continue; }
    q.v.y -= GRAV * q.grav * dt; q.p.addS(q.v, dt); if (q.tipo === 'humo') q.v.scale(Math.exp(-dt * 1.5));
  }
  if (EF.fog > 0) EF.fog -= dt;
  for (let i = LUCES_T.length - 1; i >= 0; i--) { LUCES_T[i].t -= dt; if (LUCES_T[i].t <= 0) LUCES_T.splice(i, 1); }
  for (let i = TRAZAS.length - 1; i >= 0; i--) { TRAZAS[i].t -= dt; if (TRAZAS[i].t <= 0) TRAZAS.splice(i, 1); }
}
function dibujarEfectos() {
  const L = PART.l;
  if (PART.extra && PART.extra.length) dibujarCarteles();
  if (!L.length) return;
  const gl = R.gl, P = PART.prog;
  // ordenar: primero los de alfa (humo), después los que suman luz
  const D = PART.data; let n = 0;
  const pasada = (aditivo) => {
    n = 0;
    for (const q of L) {
      const gota = q.tipo === 'gota';
      if ((q.tipo !== 'humo' && !gota) !== aditivo) continue;
      const k = q.t / q.vida, a = gota ? q.col[3] * (1 - k * k) : q.col[3] * (1 - k) * (aditivo ? 1 : Math.min(1, k * 6)), s = q.tam * (1 + q.crece * k);
      for (let v = 0; v < 6; v++) {
        if (n >= PART.max * 6) break;
        const o = n * 10; D[o] = q.p.x; D[o + 1] = q.p.y; D[o + 2] = q.p.z; D[o + 3] = q.col[0]; D[o + 4] = q.col[1]; D[o + 5] = q.col[2]; D[o + 6] = a;
        D[o + 7] = ESQ[v * 2]; D[o + 8] = ESQ[v * 2 + 1]; D[o + 9] = s; n++;
      }
    }
    if (!n) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, PART.buf); gl.bufferData(gl.ARRAY_BUFFER, D.subarray(0, n * 10), gl.STREAM_DRAW);
    gl.blendFunc(gl.SRC_ALPHA, aditivo ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); gl.uniform1f(P.u.uBri, aditivo ? 5 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, n);
  };
  gl.useProgram(P.p); R.progAct = P; gl.uniformMatrix4fv(P.u.uVP, false, R.vp); gl.uniform1f(P.u.uLin, R.salida === 'hdr' ? 1 : 0);
  gl.uniform3f(P.u.uDer, CAM.der.x, CAM.der.y, CAM.der.z); gl.uniform3f(P.u.uArr, CAM.arr.x, CAM.arr.y, CAM.arr.z);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, PART.tex.punto); R.texAct = null;
  gl.bindVertexArray(PART.vao); gl.enable(gl.BLEND); gl.depthMask(false);
  pasada(false); pasada(true);
  gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null); R.vaoAct = null;
}
function dibujarCarteles() {
  const gl = R.gl, P = PART.prog, D = PART.data;
  gl.useProgram(P.p); R.progAct = P; gl.uniformMatrix4fv(P.u.uVP, false, R.vp); gl.uniform1f(P.u.uLin, R.salida === 'hdr' ? 1 : 0); gl.uniform1f(P.u.uBri, 1);
  gl.uniform3f(P.u.uDer, CAM.der.x, CAM.der.y, CAM.der.z); gl.uniform3f(P.u.uArr, 0, 1, 0);
  gl.bindVertexArray(PART.vao); gl.bindBuffer(gl.ARRAY_BUFFER, PART.buf); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE);
  for (const c of PART.extra) {
    let n = 0; for (const k of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) { D.set([c.p.x, c.p.y, c.p.z, 1, 1, 1, 1, k[0], k[1], c.s], n * 10); n++; }
    gl.bufferData(gl.ARRAY_BUFFER, D.subarray(0, 60), gl.STREAM_DRAW); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, c.tex); gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.bindVertexArray(null); R.vaoAct = null; R.texAct = null; PART.extra.length = 0;
}
const ESQ = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];
const EF = { fog: 0 }, TRAZAS = [], LUCES_T = [];
// luces que duran un rato (explosiones, chispazos) y las de cada cuadro (fogonazo, lámparas, faros)
function luzTemporal(p, r, c, dur) { LUCES_T.push({ p: p.clone(), r, c, t: dur, dur }); }
function lucesJuntar() {
  R.luces.length = 0; R.esp.length = 0; nocheLucesEsp();
  if (!(GFX.nluz > 0) || GFX.luz < 2) return;
  for (const l of LUCES_T) { const k = l.t / l.dur; luzPuntual(l.p, l.r, [l.c[0] * k, l.c[1] * k, l.c[2] * k]); }
  for (const l of MUNDO.luces) luzPuntual(l.p, l.r, l.c, l.d, l.k);   // (las del mapa)
  if (EF.fog > 0) { const p = vistaPuntaMundo() || vadd(CAM.pos, vscale(CAM.fwd, 0.8)); luzPuntual(p, 7, [6, 4.2, 2]); }
  for (const o of OBJS) {
    if (o.logica && o.logica.tipo === 'Lamp' && o.logica.luz) luzPuntual(vadd(o.b.pos, v3(0, 0.3, 0)), Math.max(4, (o.logica.params.Range || 10)), [3.2, 2.8, 2.0]);
    if (o.veh && typeof vehiculoLuces === 'function') vehiculoLuces(o);
  }
  entidadesLuces(); cicLuces(); verLuces(); nocheLuces();
}
function efectoTraza(a, b) { TRAZAS.push({ a: a.clone(), b: b.clone(), t: 0.06 }); }
function dibujarTrazas() { for (const t of TRAZAS) linea(t.a, t.b, [1, 0.92, 0.6, 0.8 * t.t / 0.06]); }
function efectoFogonazo() {
  EF.fog = 0.05;
  const p = vistaPuntaMundo(); if (p) particula(p, v3(), 0.06, 0.12, [1, 0.8, 0.4, 1], 'fog', 1.2);
}
function efectoImpacto(p, n, tipo) {
  const k = GFX.part > 0.5 ? 6 : 2;
  for (let i = 0; i < k; i++) {
    const v = vadd(vscale(n, 1.5 + Math.random() * 2), v3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2));
    particula(vadd(p, vscale(n, 0.03)), v, 0.25 + Math.random() * 0.2, 0.025, [1, 0.85, 0.5, 1], 'chispa', 0);
  }
  particula(vadd(p, vscale(n, 0.05)), vscale(n, 0.4), 0.7, 0.12, tipo === 'cuerpo' ? [0.6, 0.55, 0.5, 0.5] : [0.75, 0.7, 0.62, 0.55], 'humo');
}
function efectoExplosion(p) {
  const k = Math.round(14 * GFX.part + 4);
  for (let i = 0; i < k; i++) {
    const d = v3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).norm();
    particula(p, vscale(d, 3 + Math.random() * 5), 0.45 + Math.random() * 0.3, 0.6 + Math.random() * 0.6, [1, 0.55 + Math.random() * 0.3, 0.15, 1], 'fuego', 1.2);
    particula(p, vscale(d, 1 + Math.random() * 3), 1.6 + Math.random() * 1.2, 0.8 + Math.random() * 0.8, [0.22, 0.21, 0.2, 0.7], 'humo', 2.2);
  }
  for (let i = 0; i < k; i++) particula(p, vscale(v3(Math.random() - 0.5, Math.random(), Math.random() - 0.5).norm(), 8 + Math.random() * 8), 0.5 + Math.random() * 0.5, 0.04, [1, 0.8, 0.4, 1], 'chispa', 0);
  particula(p, v3(), 0.18, 3.5, [1, 0.8, 0.5, 0.9], 'fuego', 0.4);
  luzTemporal(vadd(p, v3(0, 1, 0)), 22, [40, 22, 8], 0.7);
}
function efectoCongelar(b) { for (let i = 0; i < 8; i++) particula(vadd(b.pos, v3((Math.random() - 0.5) * b.r, (Math.random() - 0.5) * b.r, (Math.random() - 0.5) * b.r)), v3(0, 0.4, 0), 0.6, 0.08, [0.5, 0.85, 1, 1], 'fog', 0.5); }
