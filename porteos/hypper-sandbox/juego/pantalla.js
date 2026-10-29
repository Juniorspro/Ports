// ---------------- pantalla: una tele (o pantalla gigante) que pasa videos de YouTube de verdad ----------------
// El video es el reproductor de YouTube de la radio (uno solo: el de la fuente más cercana), puesto DETRÁS del juego con
// la perspectiva de la pantalla: una matriz CSS proyectiva lleva sus cuatro esquinas a donde caen en la imagen. El juego
// deja un hueco transparente justo ahí, sólo donde la pantalla se ve: lo que pasa por delante (gente, objetos, el arma)
// la tapa de verdad, porque el hueco se recorta con la profundidad de la escena. Se agarra, se tira y se pega donde sea
// con la pistola de física como la radio, se elige el tamaño (de tele a pantalla de cine) y en la sala todos ven el
// mismo video al mismo tiempo. Las otras pantallas (más lejos) muestran la tapa del video que tienen puesto.
const PANT_TAM = [1.2, 2, 3.2, 5, 8]; // ancho de la imagen en metros
const TELE = { prog: null, progP: null, buf: null, vao: null, v: new Float32Array(12), vis: false, esq: null, css: '', tapas: new Map() };
// medidas: imagen (w × h), marco, pie y cuello (o dos patas en las grandes); el cuerpo de física va del piso a la punta
function pantMedidas(e) {
  const w = clamp(+e.prm.w || 2, 0.6, 12), h = w * 9 / 16, b = 0.03 + w * 0.01, prof = 0.05 + w * 0.006, cu = w <= 3.2 ? 0.1 + 0.06 * w : 0.25 + 0.05 * w;
  const pieW = w <= 3.2 ? Math.min(1.1, 0.25 + w * 0.22) : w * 0.9, pieD = w <= 3.2 ? 0.3 : 0.6 + w * 0.05, T = 0.03 + cu + h + 2 * b;
  return { w, h, b, prof, cu, pieW, pieD, T, cy: 0.03 + cu + b + h / 2 - T / 2 }; // (cy: centro de la imagen sobre el centro del cuerpo)
}
function pantCuerpo(e) {
  const M = pantMedidas(e), b = new Body(boxShape(Math.max(M.w / 2 + M.b, M.pieW / 2), M.T / 2, Math.max(M.prof / 2, M.pieD / 2)), 8 + M.w * M.w * 4, { fric: 0.7, rest: 0.05 });
  b.ent = e; b.snd = 'metal'; e.M = M; return b;
}
// cambiar el tamaño: otro cuerpo en el mismo lugar (apoyado en el mismo piso)
function pantTamano(e, w) {
  if (!e || e.t !== 'pantalla') return;
  const base = vsub(e.b.pos, e.b.q.rot(v3(0, e.M.T / 2, 0))), q = e.b.q.clone(), fz = e.b.frozen, estaba = PH.bodies.includes(e.b);
  if (ARM.agarre && ARM.agarre.b === e.b) soltarAgarre(false);
  if (ARM.grav && ARM.grav.b === e.b) soltarGrav();
  if (estaba) removeBody(e.b);
  e.prm.w = clamp(+w || 2, 0.6, 12); e.b = pantCuerpo(e);
  e.b.q.copy(q); e.b.pos.copy(vadd(base, q.rot(v3(0, e.M.T / 2, 0)))); e.b.frozen = fz;
  if (e.dueno !== 'yo') { e.b.frozen = true; e.b.noGrab = true; }
  if (estaba) addBody(e.b); e.b.updateWorld();
}
ENT_TIPO.pantalla = {
  crear(e) {
    const b = pantCuerpo(e), q = e.prm.q;
    b.pos.copy(vadd(e.p, v3(0, e.M.T / 2, 0)));
    const qq = Array.isArray(q) && q.length === 4 ? new Quat(+q[0] || 0, +q[1] || 0, +q[2] || 0, +q[3] || 0) : null;
    b.q.copy(qq && Math.hypot(qq.x, qq.y, qq.z, qq.w) > 0.5 ? qq.norm() : e.q); e.b = b;
    if (e.prm.fz) b.frozen = true;
    if (e.dueno !== 'yo') { b.frozen = true; b.noGrab = true; } // (la de otro la mueve su dueño: llega por la red)
    addBody(b);
    const v = ytId(e.prm.v); if (v) { e.vid = v; e.t0 = ahoraS(); }
  },
  paso(e, dt) { if (e.dueno !== 'yo') radioRemotaPaso(e, dt); else radioRedPaso(e, dt); },
  dibujar(e) {
    const M = e.M, c = e.b.pos, q = e.b.q, w = (x, y, z) => vadd(c, q.rot(v3(x, y, z)));
    const mM = matPropio('pantMarco', [0.025, 0.026, 0.03], { pbr: [0.35, 0.3, 0.05] }), mV = matPropio('pantVidrio', [0.006, 0.007, 0.01], { pbr: [0.06, 0, 0.9] });
    const yI = M.cy, fz = -M.prof / 2, hueco = TELE.vis && YT.fuente === e;
    // marco (cuatro barras) y la tapa de atrás (3 cm más adentro: el hueco del video queda delante de ella)
    dibujarCaja(w(0, yI + M.h / 2 + M.b / 2, 0), [M.w + 2 * M.b, M.b, M.prof], q, mM);
    dibujarCaja(w(0, yI - M.h / 2 - M.b / 2, 0), [M.w + 2 * M.b, M.b, M.prof], q, mM);
    for (const sx of [-1, 1]) dibujarCaja(w(sx * (M.w / 2 + M.b / 2), yI, 0), [M.b, M.h, M.prof], q, mM);
    dibujarCaja(w(0, yI, 0.015), [M.w, M.h, M.prof - 0.03], q, mM);
    // el vidrio: apagado, o la tapa del video si tiene uno puesto y no es la que se ve ahora
    if (!hueco) {
      const tp = e.vid ? pantTapa(e.vid) : null;
      if (tp && tp.mat !== null) dibujarCaja(w(0, yI, fz + 0.012), [M.w, M.h, 0.004], q, tp.mat);
      else dibujarCaja(w(0, yI, fz + 0.012), [M.w, M.h, 0.004], q, mV, e.vid ? { em: [0.02, 0.03, 0.06] } : null);
    }
    // luz de encendido abajo a la derecha
    dibujarCaja(w(M.w / 2 - 0.04, yI - M.h / 2 - M.b / 2, fz - 0.001), [0.018, 0.008, 0.004], q, mM, { em: e.vid ? [0.1, 1.2, 0.3] : [1, 0.12, 0.08] });
    // pie y cuello (las grandes van sobre dos patas)
    const yb = -M.T / 2;
    dibujarCaja(w(0, yb + 0.015, 0), [M.pieW, 0.03, M.pieD], q, mM);
    if (M.w <= 3.2) dibujarCaja(w(0, yb + 0.03 + M.cu / 2, 0.01), [0.08 + M.w * 0.02, M.cu + 0.02, 0.05], q, mM);
    else for (const sx of [-0.4, 0.4]) dibujarCaja(w(sx * M.w, yb + 0.03 + M.cu / 2, 0.01), [0.12, M.cu + 0.02, 0.12], q, mM);
  },
  usar(e) { if (e.dueno !== 'yo') { aviso(T('ra.deOtro'), 2); return true; } radioAbrir(e); return true; },
};
ENT_INFO.pantalla = ['pantalla', { v: '', vol: 1, r: 60, w: 2 }];
// la tapa del video (miniatura de YouTube, sin luz: como una imagen encendida) para las pantallas que no son la que suena
function pantTapa(vid) {
  let t = TELE.tapas.get(vid);
  if (t) { if (t.im && t.k && !R.tex[t.k]) pantTapaSubir(t); return t; } // (al cambiar la calidad se borran las texturas)
  if (TELE.tapas.size > 24) for (const [k, x] of TELE.tapas) { if (x.k && R.tex[x.k]) { R.gl.deleteTexture(R.tex[x.k].gl); delete R.tex[x.k]; } TELE.tapas.delete(k); break; }
  t = { mat: null, k: 0, im: null }; TELE.tapas.set(vid, t);
  const im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = () => { t.im = im; t.k = DATA.tx.length + 5000 + (TELE.nTex = (TELE.nTex || 0) + 1); pantTapaSubir(t); };
  im.src = `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`;
  return t;
}
function pantTapaSubir(t) {
  const gl = R.gl, tx = gl.createTexture(); let src = t.im; try { src = texAjustar(t.im, 512); } catch (x) {}
  gl.bindTexture(gl.TEXTURE_2D, tx); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, src === t.im);
  try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch (x) { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); return; }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  R.tex[t.k] = { gl: tx };
  if (t.mat === null) { t.mat = matPropio('pantTapa' + t.k, [1, 1, 1], { pbr: [0.3, 0, 0.04] }); const m = R.mats[t.mat]; m.tex = t.k; m.unlit = true; m.claveBase = ',,UNLIT,'; m.claveGam = ',,UNLIT'; }
}
// ---------------- el hueco: después de la imagen final, alfa 0 donde la pantalla se ve ----------------
const VS_PANT_H = `layout(location=0) in vec3 aP; uniform mat4 uVP; void main(){ gl_Position = uVP * vec4(aP, 1.0); }`;
const FS_PANT_H = `precision highp float; uniform sampler2D uProf; uniform vec2 uInv; out vec4 o;
void main(){
#ifdef PROF
  if (texture(uProf, gl_FragCoord.xy * uInv).r < gl_FragCoord.z) discard;
#endif
  o = vec4(0.0);
}`;
// las esquinas de la imagen (arriba-izq, arriba-der, abajo-der, abajo-izq vistas de frente) en el mundo y en la pantalla
function pantEsquinas(e) {
  const M = e.M, c = e.b.pos, q = e.b.q, z = -M.prof / 2 - 0.002, x = M.w / 2, y = M.h / 2;
  return [[x, M.cy + y], [-x, M.cy + y], [-x, M.cy - y], [x, M.cy - y]].map(([a, b]) => vadd(c, q.rot(v3(a, b, z)))); // (mira a -Z: su izquierda es +X)
}
function pantProyectar(P, vp, W, H) {
  const out = [];
  for (const p of P) {
    const x = vp[0] * p.x + vp[4] * p.y + vp[8] * p.z + vp[12], y = vp[1] * p.x + vp[5] * p.y + vp[9] * p.z + vp[13], w = vp[3] * p.x + vp[7] * p.y + vp[11] * p.z + vp[15];
    if (w < 0.12) return null;
    out.push([(x / w * 0.5 + 0.5) * W, (0.5 - y / w * 0.5) * H]);
  }
  return out;
}
// matriz CSS que lleva el rectángulo (0,0)-(ancho,alto) a los cuatro puntos (homografía de Heckbert)
function pantMatriz(an, al, P) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = P;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3, den = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(den) < 1e-9) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, ee = y3 - y0 + h * y3;
  const m = [a / an, d / an, 0, g / an, b / al, ee / al, 0, h / al, 0, 0, 1, 0, x0, y0, 0, 1];
  return m.every(Number.isFinite) ? 'matrix3d(' + m.map((v) => +v.toFixed(6)).join(',') + ')' : null;
}
// alfa 1 en todo lo dibujado (las mezclas de partículas lo bajan) y el hueco de la pantalla que suena, si se ve
function pantFinCuadro(usaPost) {
  const gl = R.gl, W = R.cv.width, H = R.cv.height;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
  gl.colorMask(false, false, false, true); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.colorMask(true, true, true, true);
  const e = YT.fuente, ok = e && e.t === 'pantalla' && YT.ifr && JUEGO.estado === 'juego' && ENTS.lista.includes(e);
  let vis = false;
  if (ok) {
    const P = pantEsquinas(e), n = e.b.q.rot(v3(0, 0, -1)), cw = R.cv.clientWidth || W, ch = R.cv.clientHeight || H;
    const frente = vdot(vsub(CAM.pos, P[0]), n) > 0.02, pp = frente ? pantProyectar(P, R.vpMundo, cw, ch) : null;
    if (pp) {
      const area = Math.abs((pp[0][0] - pp[2][0]) * (pp[1][1] - pp[3][1]) - (pp[1][0] - pp[3][0]) * (pp[0][1] - pp[2][1])) / 2;
      const mx = pantMatriz(960, 540, pp);
      if (mx && area > 30) {
        vis = true;
        if (mx !== TELE.css) { YT.caja.style.transform = mx; TELE.css = mx; }
        pantHueco(P, usaPost && PO.prof, W, H);
      }
    }
  }
  if (vis !== TELE.vis) { TELE.vis = vis; if (YT.caja) YT.caja.classList.toggle('pantVe', vis); }
}
function pantHueco(P, prof, W, H) {
  const gl = R.gl;
  if (!TELE.prog) {
    TELE.prog = shader(VS_PANT_H, FS_PANT_H); TELE.progP = shader(VS_PANT_H, FS_PANT_H, ['PROF']);
    TELE.buf = gl.createBuffer(); TELE.vao = gl.createVertexArray(); gl.bindVertexArray(TELE.vao); gl.bindBuffer(gl.ARRAY_BUFFER, TELE.buf);
    gl.bufferData(gl.ARRAY_BUFFER, TELE.v.byteLength, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  }
  // (tira: arriba-izq, arriba-der, abajo-izq, abajo-der)
  [P[0], P[1], P[3], P[2]].forEach((p, i) => { TELE.v[i * 3] = p.x; TELE.v[i * 3 + 1] = p.y; TELE.v[i * 3 + 2] = p.z; });
  const Pg = prof ? TELE.progP : TELE.prog; gl.useProgram(Pg.p); R.progAct = Pg;
  gl.uniformMatrix4fv(Pg.u.uVP, false, R.vpMundo);
  if (prof) { gl.uniform2f(Pg.u.uInv, 1 / W, 1 / H); texEn(3, prof); }
  gl.bindVertexArray(TELE.vao); R.vaoAct = null; gl.bindBuffer(gl.ARRAY_BUFFER, TELE.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, TELE.v);
  const cull = gl.isEnabled(gl.CULL_FACE);
  gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.depthMask(false);
  // sin la imagen final aparte, la profundidad de la escena está en la pantalla misma: alcanza con la prueba normal
  if (prof) gl.disable(gl.DEPTH_TEST); else { gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); }
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); if (cull) gl.enable(gl.CULL_FACE);
  gl.bindVertexArray(null); R.vaoAct = null; R.progAct = null; if (prof) texEn(3, null);
}
