// ---------------------------------------------------------------------------------------------------------
// sombras del sol: mapas de profundidad en cascada (1 a 3) en un atlas de 2x2. Cada cascada es una caja
// ortográfica alrededor de un tramo de lo que ve la cámara, con el centro pegado a una grilla (no tiembla al
// moverse). El mapa fijo se dibuja en una copia aparte que sólo se rehace cuando la caja cambia de casillero
// o se mueve el sol; cada cuadro se copia y encima van las cosas que se mueven (props, personas, autos).
// ---------------------------------------------------------------------------------------------------------
const SM = { n: 0, tam: 0, celda: 0, tex: null, texC: null, fb: null, fbC: null, sCmp: null, sRaw: null, casc: [], solAnt: v3(), mapa: '', fr: [],
  mm: new Float32Array(48), mr: new Float32Array(12), mk: new Float32Array(12), mc: new Float32Array(3), rehechas: 0 };
const SM_EXT = 260;   // metros hacia el sol que se agregan a la caja (techos y montañas que tapan desde lejos)
function sombrasLiberar() {
  const gl = R.gl; if (!SM.tex) return;
  gl.deleteTexture(SM.tex); gl.deleteTexture(SM.texC); gl.deleteFramebuffer(SM.fb); gl.deleteFramebuffer(SM.fbC);
  SM.tex = SM.texC = SM.fb = SM.fbC = null; SM.n = 0; SM.casc = [];
}
function sombrasIniciar(n, tam) {
  const gl = R.gl;
  if (SM.tex && SM.n === n && SM.tam === tam) return true;
  sombrasLiberar();
  const mk = () => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, tam, tam);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    return { t, f, ok };
  };
  const a = mk(), b = mk();
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!a.ok || !b.ok) { SM.tex = a.t; SM.texC = b.t; SM.fb = a.f; SM.fbC = b.f; sombrasLiberar(); return false; }
  SM.tex = a.t; SM.fb = a.f; SM.texC = b.t; SM.fbC = b.f; SM.n = n; SM.tam = tam; SM.celda = n === 1 ? tam : tam / 2;
  if (!SM.sCmp) {
    SM.sCmp = gl.createSampler();
    gl.samplerParameteri(SM.sCmp, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.samplerParameteri(SM.sCmp, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.samplerParameteri(SM.sCmp, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.samplerParameteri(SM.sCmp, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.samplerParameteri(SM.sCmp, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.samplerParameteri(SM.sCmp, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    SM.sRaw = gl.createSampler();
    gl.samplerParameteri(SM.sRaw, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.samplerParameteri(SM.sRaw, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.samplerParameteri(SM.sRaw, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.samplerParameteri(SM.sRaw, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  for (let i = 0; i < n; i++) SM.casc.push({ cx: 1e9, cy: 1e9, cz: 1e9, R: 0, sucia: true, V: new Float32Array(16), P: new Float32Array(16), VP: new Float32Array(16), corte: 0 });
  return true;
}
// cortes de las cascadas sobre la distancia de las sombras (mezcla de reparto logarítmico y parejo)
function sombrasCortes(n, lejos) {
  const c = [], cerca = 0.1, l = 0.82;
  for (let i = 1; i <= n; i++) { const f = i / n; c.push(l * cerca * Math.pow(lejos / cerca, f) + (1 - l) * (cerca + (lejos - cerca) * f)); }
  return c;
}
const _smX = v3(), _smY = v3(), _smZ = v3(), _smC = v3();
function sombrasActualizar() {
  const gl = R.gl, n = SM.n; if (!n) return;
  // ejes de la luz (Z = hacia el sol)
  _smZ.copy(R.sol).norm();
  const up = Math.abs(_smZ.y) > 0.95 ? v3(0, 0, 1) : v3(0, 1, 0);
  _smX.copy(vcross(up, _smZ)).norm(); _smY.copy(vcross(_smZ, _smX));
  const cambioSol = SM.solAnt.distTo(_smZ) > 0.0015 || SM.mapa !== MUNDO.nombre;
  if (cambioSol) { SM.solAnt.copy(_smZ); SM.mapa = MUNDO.nombre; for (const c of SM.casc) c.sucia = true; }
  // tramos de lo que ve la cámara y la esfera que envuelve cada uno
  const cortes = sombrasCortes(n, GFX.sDist), asp = R.cv.width / R.cv.height, ty = Math.tan(Math.max(CAM.fov, 60) * Math.PI / 360), kk = Math.hypot(ty, ty * asp);
  let a = 0.1;
  for (let i = 0; i < n; i++) {
    const C = SM.casc[i], b = cortes[i];
    let z0 = (b + a) * (1 + kk * kk) / 2, r;
    if (z0 > b) { z0 = b; r = b * kk; } else r = Math.hypot(b - z0, b * kk);
    r = Math.ceil(r * 1.04);
    _smC.copy(R.camPos).addS(R.camF, z0);
    // caja algo más grande y centro en casilleros de 1/4 de la caja (en el plano de la luz)
    const Rr = r * 8 / 7, paso = Rr / 4;
    const lx = Math.round(vdot(_smC, _smX) / paso) * paso, ly = Math.round(vdot(_smC, _smY) / paso) * paso, lz = Math.round(vdot(_smC, _smZ) / (paso * 4)) * (paso * 4);
    if (lx !== C.cx || ly !== C.cy || lz !== C.cz || Rr !== C.R) {
      C.cx = lx; C.cy = ly; C.cz = lz; C.R = Rr; C.sucia = true;
      const ctr = v3(_smX.x * lx + _smY.x * ly + _smZ.x * lz, _smX.y * lx + _smY.y * ly + _smZ.y * lz, _smX.z * lx + _smY.z * ly + _smZ.z * lz);
      const ojo = vadd(ctr, vscale(_smZ, Rr + SM_EXT));
      C.V.set(M4.lookAt(ojo, ctr, up));
      C.P.set(M4.ortho(-Rr, Rr, -Rr, Rr, 0.5, 2 * Rr + SM_EXT + 40));
      m4mul(C.P, C.V, C.VP);
      C.fr = frustum(C.VP);
    }
    C.corte = b; a = b;
  }
  // matrices para leer el atlas: atlas · sesgo(0,5) · P · V
  const cel = SM.n === 1 ? 1 : 0.5;
  for (let i = 0; i < n; i++) {
    const C = SM.casc[i], ox = SM.n === 1 ? 0 : (i % 2) * 0.5, oy = SM.n === 1 ? 0 : Math.floor(i / 2) * 0.5;
    const B = new Float32Array([0.5 * cel, 0, 0, 0, 0, 0.5 * cel, 0, 0, 0, 0, 0.5, 0, ox + 0.5 * cel, oy + 0.5 * cel, 0.5, 1]);
    SM.mm.set(m4mul(B, C.VP, _m4a), i * 16);
    const tx = 1 / SM.tam;
    SM.mr[i * 4] = ox + tx; SM.mr[i * 4 + 1] = oy + tx; SM.mr[i * 4 + 2] = ox + cel - tx; SM.mr[i * 4 + 3] = oy + cel - tx;
    const uvPorM = cel / (2 * C.R);
    SM.mk[i * 4] = uvPorM; SM.mk[i * 4 + 1] = 2 * C.R + SM_EXT + 39.5; SM.mk[i * 4 + 2] = tx; SM.mk[i * 4 + 3] = (2 * C.R / SM.celda) * 1.2;
    SM.mc[i] = C.corte;
  }
  // dibujar: primero las cascadas viejas del mapa fijo, después copiar y agregar lo que se mueve
  const vpGuard = R.vp, frGuard = R.fr, faseG = R.fase;
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.6, 3.0);
  gl.enable(gl.SCISSOR_TEST);
  let rehizo = false;
  for (let i = 0; i < n; i++) {
    const C = SM.casc[i]; if (!C.sucia) continue;
    gl.bindFramebuffer(gl.FRAMEBUFFER, SM.fbC); vpCelda(i); gl.clear(gl.DEPTH_BUFFER_BIT);
    sombrasDibujar(C, true, i); C.sucia = false; rehizo = true; SM.rehechas++;
  }
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, SM.fbC); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, SM.fb);
  gl.disable(gl.SCISSOR_TEST);
  gl.blitFramebuffer(0, 0, SM.tam, SM.tam, 0, 0, SM.tam, SM.tam, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, SM.fb); gl.enable(gl.SCISSOR_TEST);
  for (let i = 0; i < n; i++) { vpCelda(i); sombrasDibujar(SM.casc[i], false, i); }
  gl.disable(gl.SCISSOR_TEST); gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  R.vp = vpGuard; R.fr = frGuard; R.fase = faseG; R.marca++;
  SM.rehizo = rehizo;
}
function vpCelda(i) {
  const gl = R.gl, c = SM.celda, x = SM.n === 1 ? 0 : (i % 2) * c, y = SM.n === 1 ? 0 : Math.floor(i / 2) * c;
  gl.viewport(x, y, c, c); gl.scissor(x, y, c, c);
}
const _smVP = new Float32Array(16);
function sombrasDibujar(C, estaticos, ci) {
  const gl = R.gl, F = C.fr, minR = ci >= 1 ? (2 * C.R / SM.celda) * 1.5 : 0;
  _smVP.set(C.VP); R.vp = _smVP; R.marca++;
  R.progAct = null; R.texAct = null; R.vaoAct = null;
  for (let i = 0; i < R.nItems; i++) {
    const p = R.items[i];
    if (p.est !== estaticos || p.vista || !p.mt.sombra || p.r < minR) continue;
    if (!sphereIn(F, p.cx, p.cy, p.cz, p.r)) continue;
    const cut = p.mt.cut, P = prepararProg(progDe((cut ? 'CUT' : '') + (p.h ? ',SKIN' : ''), 'depth'));
    if (cut) { if (R.texAct !== p.mt) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texGL(p.mt.tex)); R.texAct = p.mt; } gl.uniform4fv(P.u.uC, p.mt.c); }
    gl.uniform4fv(P.u.uST, p.mt.st);
    const d = p.m.d; gl.uniform3f(P.u.uQ0, d.mn[0], d.mn[1], d.mn[2]); gl.uniform3f(P.u.uQ1, d.sc[0], d.sc[1], d.sc[2]);
    gl.uniformMatrix4fv(P.u.uM, false, p.M); if (p.h) gl.uniform4fv(P.u.uB, p.h);
    if (R.vaoAct !== p.m.vao) { gl.bindVertexArray(p.m.vao); R.vaoAct = p.m.vao; }
    const doble = cut || (p.x && p.x.dobleCara);
    if (doble) gl.disable(gl.CULL_FACE);
    gl.drawElements(gl.TRIANGLES, p.sn, p.m.it, p.s0 * p.m.isz);
    if (doble) gl.enable(gl.CULL_FACE);
    SM.dib = (SM.dib || 0) + 1;
  }
  gl.bindVertexArray(null); R.vaoAct = null; R.progAct = null; R.texAct = null;
}
// las texturas y los números de las cascadas para el shader de la imagen
function sombrasUniformes(P) {
  const gl = R.gl, u = P.u, n = SM.n;
  gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, SM.tex); gl.bindSampler(5, SM.sCmp);
  if (u.uSMd) { gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, SM.tex); gl.bindSampler(6, SM.sRaw); }
  gl.activeTexture(gl.TEXTURE0);
  gl.uniformMatrix4fv(u.uSMm, false, SM.mm, 0, n * 16); gl.uniform4fv(u.uSMr, SM.mr, 0, n * 4); gl.uniform4fv(u.uSMk, SM.mk, 0, n * 4);
  gl.uniform1fv(u.uSMc, SM.mc, 0, n); gl.uniform3f(u.uCamF, R.camF.x, R.camF.y, R.camF.z); gl.uniform1f(u.uSMon, 1);
}
