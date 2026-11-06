// ---------------------------------------------------------------------------------------------------------
// sombras del sol: mapas de profundidad en cascada (1 a 3) en un atlas de 2x2. Cada cascada es una caja
// ortográfica alrededor de un tramo de lo que ve la cámara, con el centro pegado a una grilla (no tiembla al
// moverse). El mapa fijo se dibuja en una copia aparte que sólo se rehace cuando la caja cambia de casillero
// o se mueve el sol; cada cuadro se copia y encima van las cosas que se mueven (props, personas, autos).
// En WebGL 1 la copia es un dibujo que escribe la profundidad (si el aparato no puede, se dibuja todo cada cuadro).
// ---------------------------------------------------------------------------------------------------------
const SM = { n: 0, tam: 0, celda: 0, tex: null, texC: null, fb: null, fbC: null, rb: [], sinCache: false, sCmp: null, sRaw: null, casc: [], solAnt: v3(), mapa: '', fr: [],
  mm: new Float32Array(48), mr: new Float32Array(12), mk: new Float32Array(12), mc: new Float32Array(3), rehechas: 0 };
const SM_EXT = 260;   // metros hacia el sol que se agregan a la caja (techos y montañas que tapan desde lejos)
function sombrasLiberar() {
  const gl = R.gl; if (!SM.tex) return;
  gl.deleteTexture(SM.tex); if (SM.texC) gl.deleteTexture(SM.texC); gl.deleteFramebuffer(SM.fb); if (SM.fbC) gl.deleteFramebuffer(SM.fbC);
  for (const r of SM.rb) gl.deleteRenderbuffer(r);
  SM.tex = SM.texC = SM.fb = SM.fbC = null; SM.rb = []; SM.n = 0; SM.casc = [];
}
function sombrasIniciar(n, tam) {
  const gl = R.gl;
  if (SM.tex && SM.n === n && SM.tam === tam) return true;
  sombrasLiberar();
  const mk = () => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    if (R.gl1) gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, tam, tam, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    else gl.texStorage2D(gl.TEXTURE_2D, 1, GFX.memBaja ? gl.DEPTH_COMPONENT16 : gl.DEPTH_COMPONENT24, tam, tam);   // (memoria baja: 16 bits; con la caja de las sombras, pasos de ~5 mm, menos que el margen de 2 cm)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t, 0);
    if (!R.gl1) { gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); }
    let ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    // algunos WebGL 1 no aceptan un búfer sólo de profundidad: se le agrega un color chiquito por píxel
    if (!ok && R.gl1) {
      const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA4, tam, tam);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb); SM.rb.push(rb);
      ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    }
    return { t, f, ok };
  };
  SM.sinCache = R.gl1 && !R.fragDepth;
  const a = mk(), b = SM.sinCache ? { t: null, f: null, ok: true } : mk();
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!a.ok || !b.ok) { SM.tex = a.t; SM.texC = b.t; SM.fb = a.f; SM.fbC = b.f; sombrasLiberar(); return false; }
  SM.tex = a.t; SM.fb = a.f; SM.texC = b.t; SM.fbC = b.f; SM.n = n; SM.tam = tam; SM.celda = n === 1 ? tam : tam / 2;
  if (!R.gl1 && !SM.sCmp) {
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
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(DBG.offF === undefined ? 1.6 : DBG.offF, DBG.offU === undefined ? 3.0 : DBG.offU);
  gl.enable(gl.SCISSOR_TEST);
  let rehizo = false;
  if (SM.sinCache) {
    // sin copia: todo cada cuadro
    gl.bindFramebuffer(gl.FRAMEBUFFER, SM.fb);
    for (let i = 0; i < n; i++) { const C = SM.casc[i]; vpCelda(i); gl.clear(gl.DEPTH_BUFFER_BIT); sombrasDibujar(C, true, i); sombrasDibujar(C, false, i); C.sucia = false; }
  } else {
    for (let i = 0; i < n; i++) {
      const C = SM.casc[i]; if (!C.sucia) continue;
      gl.bindFramebuffer(gl.FRAMEBUFFER, SM.fbC); vpCelda(i); gl.clear(gl.DEPTH_BUFFER_BIT);
      sombrasDibujar(C, true, i); C.sucia = false; C.rehecha = true; rehizo = true; SM.rehechas++;
    }
    gl.disable(gl.SCISSOR_TEST);
    if (R.gl1) {
      sombrasCopiar();
      gl.bindFramebuffer(gl.FRAMEBUFFER, SM.fb); gl.enable(gl.SCISSOR_TEST);
      for (let i = 0; i < n; i++) { vpCelda(i); sombrasDibujar(SM.casc[i], false, i); }
    } else {
      // WebGL 2: copiar el mapa fijo entero (2048² de profundidad) y volver a traerlo para dibujar encima era, cada cuadro,
      // lo que más memoria movía en los celus. Ahora en cada cascada se repone sólo la zona donde estuvo o está algo que se
      // mueve (la del cuadro anterior y la de éste), y lo que se mueve se dibuja recortado a su zona: el resto del atlas ya
      // tiene el mapa fijo de antes. Si la cascada se rehizo (o es la primera vez), se repone entera.
      SM.repuesto = 0;
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, SM.fbC); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, SM.fb);
      for (let i = 0; i < n; i++) {
        const C = SM.casc[i], z = sombrasZona(C, i), c = SM.celda, x0 = SM.n === 1 ? 0 : (i % 2) * c, y0 = SM.n === 1 ? 0 : Math.floor(i / 2) * c;
        const r = C.rehecha || !C.zonaAnt || SM.zonaNo ? [x0, y0, x0 + c, y0 + c] : zonaUnir(C.zonaAnt, z);   // (zonaNo: todo, para comparar en las pruebas)
        if (r && r[2] > r[0] && r[3] > r[1]) { gl.blitFramebuffer(r[0], r[1], r[2], r[3], r[0], r[1], r[2], r[3], gl.DEPTH_BUFFER_BIT, gl.NEAREST); SM.repuesto += (r[2] - r[0]) * (r[3] - r[1]); }
        C.zona = z; C.zonaAnt = z || [0, 0, 0, 0]; C.rehecha = false;
      }
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, SM.fb); gl.enable(gl.SCISSOR_TEST);
      for (let i = 0; i < n; i++) { const z = SM.casc[i].zona; if (!z) continue; vpCelda(i); gl.scissor(z[0], z[1], z[2] - z[0], z[3] - z[1]); sombrasDibujar(SM.casc[i], false, i); }
    }
  }
  gl.disable(gl.SCISSOR_TEST); gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  R.vp = vpGuard; R.fr = frGuard; R.fase = faseG; R.marca++;
  SM.rehizo = rehizo;
}
// WebGL 1: copia la profundidad del mapa fijo al atlas dibujando un triángulo que la escribe tal cual
const FS_COPIA_PROF = `
precision highp float; in vec2 vUV; uniform sampler2D uT; out vec4 o;
void main(){ gl_FragDepthEXT = texture(uT, vUV).r; o = vec4(0.0); }`;
function sombrasCopiar() {
  const gl = R.gl;
  if (!SM.copia) SM.copia = shader(VS_PANT, FS_COPIA_PROF, ['#extension GL_EXT_frag_depth : enable']);
  gl.bindFramebuffer(gl.FRAMEBUFFER, SM.fb); gl.viewport(0, 0, SM.tam, SM.tam);
  gl.disable(gl.POLYGON_OFFSET_FILL); gl.disable(gl.CULL_FACE); gl.depthFunc(gl.ALWAYS); gl.colorMask(false, false, false, false);
  gl.useProgram(SM.copia.p); R.progAct = SM.copia; gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, SM.texC); R.texAct = null;
  gl.bindVertexArray(R.quad); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null); R.vaoAct = null;
  gl.depthFunc(gl.LESS); gl.colorMask(true, true, true, true); gl.enable(gl.CULL_FACE); gl.enable(gl.POLYGON_OFFSET_FILL);
}
// la zona del atlas (en puntos: x0, y0, x1, y1) que tapan las cosas que se mueven en una cascada; null si no hay ninguna.
// La caja es ortográfica: el centro proyectado y el radio en metros pasado a puntos (con margen: los personajes animados
// pueden salirse un poco de su esfera). Mismo filtro que sombrasDibujar.
function sombrasZona(C, ci) {
  const F = C.fr, minR = ci >= 1 ? (2 * C.R / SM.celda) * 1.5 : 0, M = C.VP, c = SM.celda, h = c / 2;
  const x0 = SM.n === 1 ? 0 : (ci % 2) * c, y0 = SM.n === 1 ? 0 : Math.floor(ci / 2) * c;
  let a = 1e9, b = 1e9, d = -1e9, e = -1e9;
  for (let i = 0; i < R.nItems; i++) {
    const p = R.items[i];
    if (p.est !== false || p.vista || p.ns || !p.mt.sombra || p.r < minR) continue;
    if (!sphereIn(F, p.cx, p.cy, p.cz, p.r)) continue;
    const nx = M[0] * p.cx + M[4] * p.cy + M[8] * p.cz + M[12], ny = M[1] * p.cx + M[5] * p.cy + M[9] * p.cz + M[13], rr = (p.r * 1.3 / C.R) * h + 6;
    const px = x0 + (nx * 0.5 + 0.5) * c, py = y0 + (ny * 0.5 + 0.5) * c;
    if (px - rr < a) a = px - rr; if (py - rr < b) b = py - rr; if (px + rr > d) d = px + rr; if (py + rr > e) e = py + rr;
  }
  if (d < a) return null;
  const z = [Math.max(x0, Math.floor(a)), Math.max(y0, Math.floor(b)), Math.min(x0 + c, Math.ceil(d)), Math.min(y0 + c, Math.ceil(e))];
  return z[2] > z[0] && z[3] > z[1] ? z : null;
}
const zonaUnir = (a, b) => { if (!b) return a[2] > a[0] ? a : null; if (!(a[2] > a[0])) return b; return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; };
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
    if (p.est !== estaticos || p.vista || p.ns || !p.mt.sombra || p.r < minR) continue;
    if (!sphereIn(F, p.cx, p.cy, p.cz, p.r)) continue;
    const cut = p.mt.cut, P0 = progDeP(p, true); if (!P0) continue;   // (el programa recordado en su material: gl.js)
    const P = prepararProg(P0);
    if (cut) { if (R.texAct !== p.mt) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texGL(p.mt.tex)); R.texAct = p.mt; } uniV(P.u, 'uC', p.mt.c, 4); }
    uniV(P.u, 'uST', p.mt.st, 4);
    const doble = cut || (p.x && p.x.dobleCara);
    if (doble) gl.disable(gl.CULL_FACE);
    geomDibujar(p, P.u);
    if (doble) gl.enable(gl.CULL_FACE);
    SM.dib = (SM.dib || 0) + 1;
  }
  gl.bindVertexArray(null); R.vaoAct = null; R.progAct = null; R.texAct = null;
}
// las texturas y los números de las cascadas para el shader de la imagen
function sombrasUniformes(P) {
  const gl = R.gl, u = P.u, n = SM.n;
  if (R.gl1) { gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, SM.tex); if (u.uSMtam) u1f(P, u.uSMtam, SM.tam); }
  else {
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, SM.tex); gl.bindSampler(5, SM.sCmp);
    if (u.uSMd) { gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, SM.tex); gl.bindSampler(6, SM.sRaw); }
  }
  gl.activeTexture(gl.TEXTURE0);
  // (sólo lo que cambió desde la última vez que se le mandó a este programa: ver _uval en gl.js)
  uNv(P, u.uSMm, sub(SM.mm, n * 16), n * 16, 16); uNv(P, u.uSMr, sub(SM.mr, n * 4), n * 4, 4); uNv(P, u.uSMk, sub(SM.mk, n * 4), n * 4, 4);
  uNv(P, u.uSMc, sub(SM.mc, n), n, 1); u3f(P, u.uCamF, R.camF.x, R.camF.y, R.camF.z); u1f(P, u.uSMon, 1);
}
