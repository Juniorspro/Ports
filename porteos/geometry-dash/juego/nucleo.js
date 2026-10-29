// Núcleo: lo que en el juego hace cocos2d-x (dibujo por lotes en WebGL, nodos, sprites de hojas,
// fuentes BMFont, acciones, toques, sonido y guardado). Coordenadas como cocos: y para arriba, en
// "puntos" de una pantalla de 320 de alto (el ancho sale de la proporción del teléfono).
'use strict';
const GD = window.GD = {};

// ---------- WebGL ----------
const R = GD.R = {};
R.init = function (canvas) {
  const gl = R.gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  const vs = `#version 300 es
  in vec2 p; in vec2 t; in vec4 c; in uvec4 e; uniform mat3 M; out vec2 vt; out vec4 vc; flat out uvec4 ve;
  void main(){ vec3 q = M*vec3(p,1.); gl_Position = vec4(q.xy,0.,1.); vt=t; vc=c; ve=e; }`;
  // un lote mezcla hasta 8 texturas, lo aditivo y lo blanco: e = (textura, aditivo, blanco)
  // la salida va premultiplicada: lo aditivo sale con alfa 0 y la mezcla (1, 1-alfa) lo suma
  const fs = `#version 300 es
  precision mediump float; in vec2 vt; in vec4 vc; flat in uvec4 ve; uniform sampler2D T[8]; out vec4 o;
  void main(){ vec4 x; uint s = ve.x;
    if (s < 4u) { if (s < 2u) x = s == 0u ? texture(T[0], vt) : texture(T[1], vt); else x = s == 2u ? texture(T[2], vt) : texture(T[3], vt); }
    else { if (s < 6u) x = s == 4u ? texture(T[4], vt) : texture(T[5], vt); else x = s == 6u ? texture(T[6], vt) : texture(T[7], vt); }
    if (ve.z == 1u) x = vec4(1.,1.,1.,x.a);
    x *= vc; o = vec4(x.rgb*x.a, ve.y == 1u ? 0. : x.a); }`;
  const sh = (t, s) => { const h = gl.createShader(t); gl.shaderSource(h, s); gl.compileShader(h); if (!gl.getShaderParameter(h, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(h); return h; };
  const pr = R.prog = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(pr, 0, 'p'); gl.bindAttribLocation(pr, 1, 't'); gl.bindAttribLocation(pr, 2, 'c'); gl.bindAttribLocation(pr, 3, 'e');
  gl.linkProgram(pr); gl.useProgram(pr);
  R.uM = gl.getUniformLocation(pr, 'M');
  gl.uniform1iv(gl.getUniformLocation(pr, 'T'), [0, 1, 2, 3, 4, 5, 6, 7]);
  R.MAX = 16384; R.ST = 6; // 6 palabras por vértice: x y u v color extra
  R.buf = new ArrayBuffer(R.MAX * 4 * R.ST * 4); R.f32 = new Float32Array(R.buf); R.u32 = new Uint32Array(R.buf);
  R.vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, R.vbo); gl.bufferData(gl.ARRAY_BUFFER, R.buf.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 8);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 24, 16);
  gl.enableVertexAttribArray(3); gl.vertexAttribIPointer(3, 4, gl.UNSIGNED_BYTE, 24, 20);
  const idx = new Uint16Array(R.MAX * 6);
  for (let i = 0; i < R.MAX; i++) { idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6); }
  R.ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST);
  R.n = 0; R.tex = null; R.slots = [null, null, null, null, null, null, null, null]; R.ns = 0;
  const w = new Uint8Array([255, 255, 255, 255]);
  R.blanco = R.texDe(w, 1, 1);
};
R.texDe = function (src, w, h) {
  R.flush(); R.tex = null; // la textura nueva se ata en la unidad activa: el lote siguiente vuelve a atar las suyas
  const gl = R.gl, t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  if (src instanceof Uint8Array) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { t, w: w || src.width, h: h || src.height };
};
R.repetir = function (tx) { // los fondos y pisos se repiten a lo ancho
  R.flush(); const gl = R.gl; gl.bindTexture(gl.TEXTURE_2D, tx.t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); R.tex = null;
};
R.flush = function () {
  if (!R.n) return;
  const gl = R.gl;
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, R.f32, 0, R.n * 4 * R.ST);
  gl.drawElements(gl.TRIANGLES, R.n * 6, gl.UNSIGNED_SHORT, 0);
  R.n = 0; R.draws++;
};
R.estado = function (tex, add, modo) {
  if (R.tex === null) { R.flush(); R.slots.fill(null); R.ns = 0; R.tex = true; } // alguien tocó las texturas atadas
  if (R.n >= R.MAX) R.flush();
  let k = R.slots.indexOf(tex);
  if (k < 0) {
    if (R.ns === 8) { R.flush(); R.slots.fill(null); R.ns = 0; }
    k = R.ns++; R.slots[k] = tex;
    const gl = R.gl; gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, tex.t);
  }
  return k | (add ? 256 : 0) | (modo === 1 ? 65536 : 0);
};
// cuadrilátero: 4 esquinas ya transformadas (x0..y3) + uv + color empaquetado (abgr)
R.quad = function (tex, add, modo, xs, uv, col) {
  const e = R.estado(tex, add, modo);
  const f = R.f32, u = R.u32; let o = R.n * 24;
  for (let i = 0; i < 4; i++) { f[o] = xs[i * 2]; f[o + 1] = xs[i * 2 + 1]; f[o + 2] = uv[i * 2]; f[o + 3] = uv[i * 2 + 1]; u[o + 4] = col; u[o + 5] = e; o += 6; }
  R.n++;
};
// igual pero con un color por esquina (degradados del selector de colores)
R.quad4 = function (tex, add, xs, uv, cols) {
  const e = R.estado(tex, add, 0);
  const f = R.f32, u = R.u32; let o = R.n * 24;
  for (let i = 0; i < 4; i++) { f[o] = xs[i * 2]; f[o + 1] = xs[i * 2 + 1]; f[o + 2] = uv[i * 2]; f[o + 3] = uv[i * 2 + 1]; u[o + 4] = cols[i]; u[o + 5] = e; o += 6; }
  R.n++;
};
R.empezar = function (w, h, pw, ph) {
  const gl = R.gl; R.draws = 0;
  gl.viewport(0, 0, pw, ph);
  gl.uniformMatrix3fv(R.uM, false, [2 / w, 0, 0, 0, 2 / h, 0, -1, -1, 1]);
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  R.tex = null;
};
GD.col = (r, g, b, a) => ((a & 255) << 24 | (b & 255) << 16 | (g & 255) << 8 | (r & 255)) >>> 0;

// ---------- hojas de sprites ----------
const T = GD.T = { marcos: {}, tex: {}, cargando: {} };
T.cargarImg = function (url) {
  return new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('no carga ' + url)); i.src = url; });
};
T.textura = async function (nombre, carpeta = 'tex') {
  if (T.tex[nombre]) return T.tex[nombre];
  if (!T.cargando[nombre]) {
    const blob = GD.paq[`${carpeta}/${nombre}.webp`];
    // lo que vino en un paquete sale de memoria; lo demás se pide suelto
    T.cargando[nombre] = (blob ? createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }) : T.cargarImg(GD.ruta(`datos/${carpeta}/${nombre}.webp`)))
      .then(i => (T.tex[nombre] = R.texDe(i)));
  }
  return T.cargando[nombre];
};
// paquete: [4 bytes largo del índice][índice JSON {ruta: [desde, largo]}][archivos]
GD.paq = {};
GD.cargarPaquete = async function (url, avance) {
  const r = await fetch(GD.ruta(url)); if (!r.ok) throw new Error('no carga ' + url);
  let buf;
  const total = +r.headers.get('Content-Length') || 0;
  if (avance && r.body && total) {
    const lector = r.body.getReader(), partes = []; let n = 0;
    for (;;) { const { done, value } = await lector.read(); if (done) break; partes.push(value); n += value.length; avance(n / total); }
    buf = new Uint8Array(n); let o = 0; for (const p of partes) { buf.set(p, o); o += p.length; }
  } else buf = new Uint8Array(await r.arrayBuffer());
  const largo = new DataView(buf.buffer, buf.byteOffset, 4).getUint32(0, true);
  const idx = JSON.parse(new TextDecoder().decode(buf.subarray(4, 4 + largo))), base = 4 + largo;
  for (const ruta in idx) { const [a, n] = idx[ruta]; GD.paq[ruta] = new Blob([buf.subarray(base + a, base + a + n)]); }
  return idx;
};
// marco: {tx, x,y,w,h (px en la hoja), rot, ox, oy, sw, sh (puntos)}
T.registrar = function (hoja, tx, marcos) {
  for (const n in marcos) {
    const [x, y, w, h, rot, ox, oy, sw, sh] = marcos[n];
    T.marcos[n] = { tx, x, y, w, h, rot, ox: ox / 2, oy: oy / 2, sw: sw / 2, sh: sh / 2, cw: w / 2, ch: h / 2, hoja };
  }
};
T.marcoTextura = function (nombre, tx) { // una textura suelta como si fuese un marco (las de baja resolución van a 1 punto por píxel)
  const k = GD.datos && GD.datos.sd && GD.datos.sd.includes(nombre) ? 1 : 0.5;
  return T.marcos[nombre + '.png'] = { tx, x: 0, y: 0, w: tx.w, h: tx.h, rot: 0, ox: 0, oy: 0, sw: tx.w * k, sh: tx.h * k, cw: tx.w * k, ch: tx.h * k };
};
T.m = n => T.marcos[n] || T.marcos[n + '.png'];

// ---------- nodos ----------
const _xs = new Float32Array(8), _uv = new Float32Array(8);
// sin cierres ni arreglos por cuadro: las 4 esquinas transformadas y las uv de un rectángulo
R.esquinas = function (X, w, x0, y0, x1, y1) { // arriba-izq, arriba-der, abajo-izq, abajo-der
  const a = w[0], b = w[1], c = w[2], d = w[3], e = w[4], f = w[5];
  X[0] = a * x0 + c * y1 + e; X[1] = b * x0 + d * y1 + f; X[2] = a * x1 + c * y1 + e; X[3] = b * x1 + d * y1 + f;
  X[4] = a * x0 + c * y0 + e; X[5] = b * x0 + d * y0 + f; X[6] = a * x1 + c * y0 + e; X[7] = b * x1 + d * y0 + f;
};
R.uvRect = function (U, u0, v0, u1, v1) { U[0] = u0; U[1] = v0; U[2] = u1; U[3] = v0; U[4] = u0; U[5] = v1; U[6] = u1; U[7] = v1; };
class Nodo {
  constructor() {
    this.x = 0; this.y = 0; this.sx = 1; this.sy = 1; this.rot = 0; this.skx = 0; this.sky = 0;
    this.ax = 0.5; this.ay = 0.5; this.w = 0; this.h = 0; this.z = 0; this.vis = true;
    this.op = 255; this.r = 255; this.g = 255; this.b = 255; this.hijos = []; this.padre = null;
    this.acciones = []; this.cascada = true; this._orden = 0; this.etiqueta = 0;
  }
  pos(x, y) { this.x = x; this.y = y; return this; }
  esc(s, t) { this.sx = s; this.sy = t === undefined ? s : t; return this; }
  set escala(s) { this.sx = this.sy = s; } get escala() { return this.sx; }
  anc(x, y) { this.ax = x; this.ay = y; return this; }
  color(r, g, b) { if (Array.isArray(r)) [r, g, b] = r; this.r = r; this.g = g; this.b = b; return this; }
  agregar(n, z = 0, etq) { if (n.padre) n.padre.quitar(n); n.padre = this; n.z = z; n._orden = Nodo._c++; if (etq !== undefined) n.etiqueta = etq; this.hijos.push(n); this._sucio = true; n.alEntrar && n.alEntrar(); return n; }
  quitar(n) { const i = this.hijos.indexOf(n); if (i >= 0) this.hijos.splice(i, 1); n.padre = null; n.alSalir && n.alSalir(); }
  sacar() { this.padre && this.padre.quitar(this); }
  hijo(e) { return this.hijos.find(h => h.etiqueta === e); }
  vaciar() { for (const h of this.hijos.slice()) this.quitar(h); }
  correr(a) { a.empezar(this); this.acciones.push(a); return a; }
  parar(a) { if (!a) this.acciones.length = 0; else { const i = this.acciones.indexOf(a); if (i >= 0) this.acciones.splice(i, 1); } }
  pararEtq(t) { this.acciones = this.acciones.filter(a => a.etq !== t); }
  accionEtq(t) { return this.acciones.find(a => a.etq === t); }
  // matriz local → padre: T(x,y)·R·S·T(-ax·w, -ay·h); en cocos la rotación es en sentido horario
  matriz(m) {
    const r = -this.rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const kx = Math.tan(this.skx * Math.PI / 180), ky = Math.tan(this.sky * Math.PI / 180);
    let a = c * this.sx, b = s * this.sx, cc = -s * this.sy, d = c * this.sy;
    if (kx || ky) { const a2 = a + cc * ky, b2 = b + d * ky, c2 = a * kx + cc, d2 = b * kx + d; a = a2; b = b2; cc = c2; d = d2; }
    const px = -this.ax * this.w, py = -this.ay * this.h;
    m[0] = a; m[1] = b; m[2] = cc; m[3] = d; m[4] = this.x + a * px + cc * py; m[5] = this.y + b * px + d * py;
    return m;
  }
  aMundo(x, y) { // punto local → coordenadas de la escena
    let n = this, m = new Float32Array(6);
    while (n) { n.matriz(m); const X = m[0] * x + m[2] * y + m[4], Y = m[1] * x + m[3] * y + m[5]; x = X; y = Y; n = n.padre; }
    return [x, y];
  }
  aLocal(x, y) {
    const cad = []; for (let n = this; n; n = n.padre) cad.unshift(n);
    const m = new Float32Array(6);
    for (const n of cad) { n.matriz(m); const det = m[0] * m[3] - m[1] * m[2]; const dx = x - m[4], dy = y - m[5]; x = (m[3] * dx - m[2] * dy) / det; y = (-m[1] * dx + m[0] * dy) / det; }
    return [x, y];
  }
  caja() { return [0, 0, this.w, this.h]; }
  toca(x, y) { const [lx, ly] = this.aLocal(x, y); const [a, b, c, d] = this.caja(); return lx >= a && ly >= b && lx <= c && ly <= d; }
  actualizar(dt) {
    // copia de la lista (alguno puede sacarse o agregar) en un arreglo reusado por profundidad: sin basura
    const ac = this.acciones, na = ac.length;
    if (na) {
      const c = Nodo._copia(ac, na);
      for (let i = 0; i < na; i++) { const a = c[i]; c[i] = null; a.paso(dt); if (a.fin) this.parar(a); }
      Nodo._prof--;
    }
    if (this.alActualizar) this.alActualizar(dt);
    const hs = this.hijos, nh = hs.length;
    if (nh) {
      const c = Nodo._copia(hs, nh);
      for (let i = 0; i < nh; i++) { const h = c[i]; c[i] = null; h.actualizar(dt); }
      Nodo._prof--;
    }
  }
  dibujar(pm, op, cr, cg, cb) {
    if (!this.vis) return;
    const m = this._m || (this._m = new Float32Array(6)); this.matriz(m);
    const w = this._w || (this._w = new Float32Array(6));
    w[0] = pm[0] * m[0] + pm[2] * m[1]; w[1] = pm[1] * m[0] + pm[3] * m[1];
    w[2] = pm[0] * m[2] + pm[2] * m[3]; w[3] = pm[1] * m[2] + pm[3] * m[3];
    w[4] = pm[0] * m[4] + pm[2] * m[5] + pm[4]; w[5] = pm[1] * m[4] + pm[3] * m[5] + pm[5];
    let o = this.op * op / 255, r = this.r, g = this.g, b = this.b;
    if (this.cascada) { r = r * cr / 255; g = g * cg / 255; b = b * cb / 255; } else op = 255;
    if (this._sucio) { this.hijos.sort((a, b) => a.z - b.z || a._orden - b._orden); this._sucio = false; }
    const hs = this.hijos; let i = 0;
    const co = this.cascadaOp === false ? 255 : o, hr = this.cascada ? r : 255, hg = this.cascada ? g : 255, hb = this.cascada ? b : 255;
    for (; i < hs.length && hs[i].z < 0; i++) hs[i].dibujar(w, co, hr, hg, hb);
    this.pintar(w, o, r, g, b);
    for (; i < hs.length; i++) hs[i].dibujar(w, co, hr, hg, hb);
  }
  pintar() { }
}
Nodo._c = 0;
Nodo._pila = []; Nodo._prof = 0;
Nodo._copia = function (l, n) { const c = Nodo._pila[Nodo._prof] || (Nodo._pila[Nodo._prof] = []); Nodo._prof++; for (let i = 0; i < n; i++) c[i] = l[i]; return c; };
GD.Nodo = Nodo;

class Sprite extends Nodo {
  constructor(marco) { super(); this.add = false; this.fx = false; this.fy = false; this.modo = 0; if (marco) this.marco(marco); }
  marco(n) {
    const f = typeof n === 'string' ? T.m(n) : n;
    if (!f) { console.warn('falta marco', n); this.f = null; return this; }
    this.f = f; this.w = f.sw; this.h = f.sh; return this;
  }
  pintar(w, o, r, g, b) {
    const f = this.f; if (!f || o <= 0) return;
    if (this.repX) { // textura suelta repetida a lo ancho (barras de progreso)
      if (!f.tx.rep) { GD.R.repetir(f.tx); f.tx.rep = true; }
      const ancho = this.repX * (this.recorte === undefined || this.recorte === null ? 1 : this.recorte), xs = _xs, uv = _uv;
      R.esquinas(xs, w, 0, 0, ancho, f.sh);
      R.uvRect(uv, 0, 0, ancho / f.sw, 1);
      R.quad(f.tx, this.add, this.modo, xs, uv, GD.col(r, g, b, o)); return;
    }
    // el recorte de la hoja va centrado en el tamaño original más el desplazamiento
    let x0 = (f.sw - f.cw) / 2 + f.ox, y0 = (f.sh - f.ch) / 2 + f.oy, x1 = x0 + f.cw, y1 = y0 + f.ch;
    if (this.fx) { const t = f.sw - x0; x0 = f.sw - x1; x1 = t; }
    if (this.fy) { const t = f.sh - y0; y0 = f.sh - y1; y1 = t; }
    if (this.recorte) { const k = this.recorte; x1 = x0 + (x1 - x0) * k; } // barras de progreso
    const xs = _xs, uv = _uv;
    R.esquinas(xs, w, x0, y0, x1, y1);
    const tw = f.tx.w, th = f.tx.h;
    const u0 = f.x / tw, v0 = f.y / th;
    const kx = this.recorte || 1;
    // esquinas en orden arriba-izq, arriba-der, abajo-izq, abajo-der; espejar = cambiar columnas o filas
    const i0 = (this.fx ? 2 : 0) + (this.fy ? 4 : 0), i1 = i0 ^ 2, i2 = i0 ^ 4, i3 = i0 ^ 6;
    if (!f.rot) {
      const u1 = (f.x + f.w * kx) / tw, v1 = (f.y + f.h) / th;
      uv[i0] = u0; uv[i0 + 1] = v0; uv[i1] = u1; uv[i1 + 1] = v0; uv[i2] = u0; uv[i2 + 1] = v1; uv[i3] = u1; uv[i3 + 1] = v1;
    } else { // en la hoja está girado 90° en sentido horario: ancho y alto cambiados
      const u1 = (f.x + f.h) / tw, v1 = (f.y + f.w * kx) / th;
      uv[i0] = u1; uv[i0 + 1] = v0; uv[i1] = u1; uv[i1 + 1] = v1; uv[i2] = u0; uv[i2 + 1] = v0; uv[i3] = u0; uv[i3 + 1] = v1;
    }
    R.quad(f.tx, this.add, this.modo, xs, uv, GD.col(r, g, b, o));
  }
}
GD.Sprite = Sprite;

// rectángulo de color liso (capas de color, fundidos)
class Rect extends Nodo {
  constructor(w, h, r = 0, g = 0, b = 0, a = 255) { super(); this.w = w; this.h = h; this.ax = this.ay = 0; this.color(r, g, b); this.op = a; this.add = false; }
  pintar(w, o, r, g, b) {
    if (o <= 0) return;
    const xs = _xs, P = (i, x, y) => { xs[i] = w[0] * x + w[2] * y + w[4]; xs[i + 1] = w[1] * x + w[3] * y + w[5]; };
    P(0, 0, this.h); P(2, this.w, this.h); P(4, 0, 0); P(6, this.w, 0);
    _uv.fill(0.5);
    R.quad(R.blanco, this.add, 0, xs, _uv, GD.col(r, g, b, o));
  }
}
GD.Rect = Rect;

// ---------- textos BMFont ----------
class Texto extends Nodo {
  constructor(txt, fuente = 'bigFont', ancho = 0, alin = 1) {
    super(); this.fuente = fuente; this.alin = alin; this.anchoMax = ancho; this.texto(txt);
  }
  texto(t) { this.t = String(t); this._armar(); return this; }
  _armar() {
    const F = GD.fuentes[this.fuente]; this.letras = [];
    if (!F) { this.w = this.h = 0; return; }
    const lh = F.lh / 2, lineas = [];
    for (const par of this.t.split('\n')) {
      if (!this.anchoMax) { lineas.push(par); continue; }
      let act = '';
      for (const pal of par.split(' ')) {
        const prueba = act ? act + ' ' + pal : pal;
        if (act && this._ancho(prueba, F) > this.anchoMax) { lineas.push(act); act = pal; } else act = prueba;
      }
      lineas.push(act);
    }
    let mw = 0; const anchos = lineas.map(l => { const a = this._ancho(l, F); mw = Math.max(mw, a); return a; });
    this.w = this.anchoMax || mw; this.h = lh * lineas.length;
    lineas.forEach((l, i) => {
      let x = this.alin === 0 ? 0 : this.alin === 2 ? this.w - anchos[i] : (this.w - anchos[i]) / 2;
      const yb = this.h - lh * i; let prev = 0;
      for (const ch of l) {
        const id = ch.codePointAt(0), c = F.chars[id] || F.chars[63]; if (!c) continue;
        if (prev && F.kern[prev + ',' + id]) x += F.kern[prev + ',' + id] / 2;
        if (c[2] > 0) this.letras.push({ x: x + c[4] / 2, y: yb - c[5] / 2 - c[3] / 2, c, u0: 0, v0: 0, u1: 0, v1: 0, tw: 0 });
        x += c[6] / 2; prev = id;
      }
    });
  }
  _ancho(l, F) { let a = 0; for (let i = 0; i < l.length; i++) { const k = l.codePointAt(i); if (k > 0xffff) i++; const c = F.chars[k] || F.chars[63]; if (c) a += c[6] / 2; } return a; }
  pintar(w, o, r, g, b) {
    const F = GD.fuentes[this.fuente]; if (!F || !F.tx || o <= 0) return;
    const tw = F.tx.w, th = F.tx.h, col = GD.col(r, g, b, o);
    const ls = this.letras;
    for (let i = 0; i < ls.length; i++) {
      const L = ls[i], c = L.c;
      if (L.tw !== tw) { L.tw = tw; L.u0 = c[0] / tw; L.v0 = c[1] / th; L.u1 = (c[0] + c[2]) / tw; L.v1 = (c[1] + c[3]) / th; }
      R.esquinas(_xs, w, L.x, L.y, L.x + c[2] / 2, L.y + c[3] / 2);
      R.uvRect(_uv, L.u0, L.v0, L.u1, L.v1);
      R.quad(F.tx, false, 0, _xs, _uv, col);
    }
  }
  // achica el texto para que entre en un ancho (como limitLabelWidth del juego)
  limitar(ancho, max = 1, min = 0) { const k = this.w ? Math.min(max, ancho / this.w) : max; this.escala = Math.max(min, k); return this; }
}
GD.Texto = Texto;
GD.fuentes = {};

// ---------- acciones ----------
const E = GD.E = { // curvas como las de cocos2d
  lin: t => t,
  in: r => t => Math.pow(t, r), out: r => t => Math.pow(t, 1 / r),
  inOut: r => t => (t *= 2) < 1 ? 0.5 * Math.pow(t, r) : 1 - 0.5 * Math.pow(2 - t, r),
  bounceOut: t => { if (t < 1 / 2.75) return 7.5625 * t * t; if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; } if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; } t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375; },
  elasticOut: (p = 0.3) => t => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t - p / 4) * Math.PI * 2 / p) + 1,
  elasticIn: (p = 0.3) => t => t === 0 || t === 1 ? t : -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1 - p / 4) * Math.PI * 2 / p),
  elasticInOut: (p = 0.3) => t => { if (t === 0 || t === 1) return t; t *= 2; const s = p / 4; return t < 1 ? -0.5 * Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1 - s) * Math.PI * 2 / p) : Math.pow(2, -10 * (t - 1)) * Math.sin((t - 1 - s) * Math.PI * 2 / p) * 0.5 + 1; },
  backOut: t => { const s = 1.70158; t -= 1; return t * t * ((s + 1) * t + s) + 1; },
  backIn: t => { const s = 1.70158; return t * t * ((s + 1) * t - s); },
  sineInOut: t => -0.5 * (Math.cos(Math.PI * t) - 1), sineIn: t => 1 - Math.cos(t * Math.PI / 2), sineOut: t => Math.sin(t * Math.PI / 2),
  expoInOut: t => t === 0 || t === 1 ? t : (t *= 2) < 1 ? 0.5 * Math.pow(2, 10 * (t - 1)) : 0.5 * (2 - Math.pow(2, -10 * (t - 1))),
  expoIn: t => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)), expoOut: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  bounceIn: t => 1 - E.bounceOut(1 - t), bounceInOut: t => t < 0.5 ? (1 - E.bounceOut(1 - t * 2)) * 0.5 : E.bounceOut(t * 2 - 1) * 0.5 + 0.5,
  backInOut: t => { const s = 1.70158 * 1.525; t *= 2; if (t < 1) return (t * t * ((s + 1) * t - s)) / 2; t -= 2; return (t * t * ((s + 1) * t + s)) / 2 + 1; },
};
// easing del juego por número (los triggers usan 0..18 y una tasa)
E.gd = function (tipo, tasa = 2) {
  switch (tipo | 0) {
    case 1: return E.inOut(tasa); case 2: return E.in(tasa); case 3: return E.out(tasa);
    case 4: return E.elasticInOut(tasa); case 5: return E.elasticIn(tasa); case 6: return E.elasticOut(tasa);
    case 7: return E.bounceInOut; case 8: return E.bounceIn; case 9: return E.bounceOut;
    case 10: return E.expoInOut; case 11: return E.expoIn; case 12: return E.expoOut;
    case 13: return E.sineInOut; case 14: return E.sineIn; case 15: return E.sineOut;
    case 16: return E.backInOut; case 17: return E.backIn; case 18: return E.backOut;
    default: return E.lin;
  }
};
class Accion {
  constructor(dur, curva = E.lin) { this.dur = dur; this.t = 0; this.fin = false; this.curva = curva; }
  empezar(n) { this.n = n; this.t = 0; this.fin = false; this.ini && this.ini(n); if (this.dur <= 0) { this.aplicar(1); this.fin = true; } }
  paso(dt) { if (this.fin) return; this.t += dt; const k = Math.min(1, this.t / this.dur); this.aplicar(this.curva(k)); if (k >= 1) { this.fin = true; this.sobra = this.t - this.dur; } }
  aplicar() { }
  e(c) { this.curva = c; return this; }
  tag(t) { this.etq = t; return this; }
}
const A = GD.A = {};
A.mover = (d, x, y) => Object.assign(new Accion(d), { ini(n) { this.a = [n.x, n.y]; }, aplicar(k) { this.n.x = this.a[0] + (x - this.a[0]) * k; this.n.y = this.a[1] + (y - this.a[1]) * k; } });
A.moverPor = (d, dx, dy) => Object.assign(new Accion(d), { ini(n) { this.a = [n.x, n.y]; }, aplicar(k) { this.n.x = this.a[0] + dx * k; this.n.y = this.a[1] + dy * k; } });
A.escala = (d, s, t) => Object.assign(new Accion(d), { ini(n) { this.a = [n.sx, n.sy]; }, aplicar(k) { this.n.sx = this.a[0] + (s - this.a[0]) * k; this.n.sy = this.a[1] + ((t === undefined ? s : t) - this.a[1]) * k; } });
A.girar = (d, r) => Object.assign(new Accion(d), { ini(n) { this.a = n.rot; }, aplicar(k) { this.n.rot = this.a + (r - this.a) * k; } });
A.girarPor = (d, r) => Object.assign(new Accion(d), { ini(n) { this.a = n.rot; }, aplicar(k) { this.n.rot = this.a + r * k; } });
A.op = (d, o) => Object.assign(new Accion(d), { ini(n) { this.a = n.op; }, aplicar(k) { this.n.op = this.a + (o - this.a) * k; } });
A.tinte = (d, r, g, b) => Object.assign(new Accion(d), { ini(n) { this.a = [n.r, n.g, n.b]; }, aplicar(k) { const a = this.a; this.n.r = a[0] + (r - a[0]) * k; this.n.g = a[1] + (g - a[1]) * k; this.n.b = a[2] + (b - a[2]) * k; } });
A.esperar = d => new Accion(d);
A.fn = f => Object.assign(new Accion(0), { aplicar() { f(this.n); } });
A.quitar = () => A.fn(n => n.sacar());
A.sec = (...as) => Object.assign(new Accion(0), {
  ini(n) { this.i = 0; this.fin = false; as[0].empezar(n); this.dur = 1e9; },
  paso(dt) {
    let r = dt;
    while (this.i < as.length) {
      const a = as[this.i]; if (!a.fin) a.paso(r); if (!a.fin) return;
      r = a.sobra || 0; a.sobra = 0; this.i++; if (this.i < as.length) as[this.i].empezar(this.n); else { this.fin = true; return; }
      if (r <= 0) r = 0;
    }
  },
  empezar(n) { this.n = n; this.ini(n); },
});
A.junto = (...as) => Object.assign(new Accion(0), { empezar(n) { this.n = n; this.fin = false; as.forEach(a => a.empezar(n)); }, paso(dt) { let f = true; for (const a of as) { if (!a.fin) a.paso(dt); f = f && a.fin; } this.fin = f; } });
A.siempre = a => Object.assign(new Accion(0), { empezar(n) { this.n = n; this.fin = false; a.empezar(n); }, paso(dt) { a.paso(dt); if (a.fin) { const s = a.sobra || 0; a.empezar(this.n); if (s) a.paso(s); } } });
A.repetir = (a, veces) => Object.assign(new Accion(0), { empezar(n) { this.n = n; this.fin = false; this.k = 0; a.empezar(n); }, paso(dt) { a.paso(dt); if (a.fin) { if (++this.k >= veces) this.fin = true; else a.empezar(this.n); } } });
A.marcos = (lista, demora, siempre = true) => Object.assign(new Accion(lista.length * demora), { aplicar(k) { const i = Math.min(lista.length - 1, Math.floor(k * lista.length)); this.n.marco(lista[i]); } , paso(dt) { this.t += dt; if (siempre) this.t %= this.dur; const k = Math.min(0.9999, this.t / this.dur); this.aplicar(k); if (!siempre && this.t >= this.dur) this.fin = true; } });
GD.Accion = Accion;

// ---------- escenas, toques ----------
const D = GD.D = { escena: null, tiempo: 0, toques: [], ancho: 480, alto: 320, dtFijo: 0 };
D.medir = function () {
  const c = D.canvas, dpr = Math.min(window.devicePixelRatio || 1, 2);
  // con el teléfono parado el juego se gira 90° (es un juego acostado)
  const vw = window.innerWidth || 1, vh = window.innerHeight || 1, girar = vh > vw * 1.05;
  if (girar !== D.girado || vw !== D._vw || vh !== D._vh) {
    D.girado = girar; D._vw = vw; D._vh = vh;
    const st = c.style;
    if (girar) { st.width = vh + 'px'; st.height = vw + 'px'; st.transformOrigin = '0 0'; st.transform = `translateX(${vw}px) rotate(90deg)`; }
    else { st.width = '100%'; st.height = '100%'; st.transform = ''; }
  }
  const cw = girar ? vh : (c.clientWidth || 1), ch = girar ? vw : (c.clientHeight || 1);
  const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
  if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
  D.alto = 320; D.ancho = 320 * cw / ch; D.k = ph / 320;
  return [pw, ph];
};
D.error = function (e) { if (!D._errores || D._errores < 20) { D._errores = (D._errores || 0) + 1; console.error(e); } };
D.cambiar = function (esc, fundido = 0.5) {
  if (!fundido || !D.escena) { D._poner(esc); return; }
  if (D._transicion) return;
  const vieja = D.escena, cubre = new Rect(D.ancho, D.alto, 0, 0, 0, 0); cubre.z = 1e6;
  D._transicion = true;
  const fase = { t: 0 };
  D._fundido = { cubre, dur: fundido / 2, t: 0, a: vieja, b: esc, etapa: 0 };
};
D._poner = function (esc) {
  const v = D.escena; D.escena = esc;
  if (v && v.alSalir) v.alSalir();
  if (!esc._iniciada) { esc._iniciada = true; esc.alCrear && esc.alCrear(); }
  esc.alEntrar && esc.alEntrar();
};
D.ciclo = function (ms) {
  const dt = Math.min(0.1, (ms - (D._ult || ms)) / 1000); D._ult = ms; D.tiempo += dt; D.dt = dt;
  const [pw, ph] = D.medir();
  // un error en un cuadro no puede congelar el juego: se avisa y se sigue
  try { if (D.escena) D.escena.actualizar(dt); } catch (e) { D.error(e); }
  const fu = D._fundido;
  if (fu) {
    fu.t += dt;
    if (fu.etapa === 0 && fu.t >= fu.dur) { D._poner(fu.b); fu.etapa = 1; fu.t = 0; }
    if (fu.etapa === 1 && fu.t >= fu.dur) { D._fundido = null; D._transicion = false; }
  }
  R.empezar(D.ancho, D.alto, pw, ph);
  const id = new Float32Array([1, 0, 0, 1, 0, 0]);
  try { if (D.escena) D.escena.dibujar(id, 255, 255, 255, 255); } catch (e) { D.error(e); }
  if (D._fundido) { const f = D._fundido; const k = f.etapa === 0 ? f.t / f.dur : 1 - f.t / f.dur; const q = new Rect(D.ancho, D.alto, 0, 0, 0, Math.max(0, Math.min(255, k * 255))); q.dibujar(id, 255, 255, 255, 255); }
  R.flush();
  requestAnimationFrame(D.ciclo);
};
// los toques van primero a quien los tomó; si no, a la pila de "capturadores" (popups arriba de todo)
D.pila = [];
D.empujar = n => D.pila.push(n);
D.soltarPila = n => { const i = D.pila.indexOf(n); if (i >= 0) D.pila.splice(i, 1); };
D.aPuntos = e => {
  if (D.girado) { // pantalla girada 90°: x de la pantalla = alto del juego (de abajo hacia arriba en el juego es de derecha a izquierda)
    return [e.clientY / D._vh * D.ancho, (e.clientX / D._vw) * D.alto];
  }
  const r = D.canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * D.ancho, (1 - (e.clientY - r.top) / r.height) * D.alto];
};
D.instalarToques = function (c) {
  const due = {};
  const dar = (tipo, e) => {
    const [x, y] = D.aPuntos(e), id = e.pointerId;
    if (tipo === 'ini') {
      if (D._fundido) return;
      const capt = D.pila.length ? [D.pila[D.pila.length - 1]] : [];
      const lista = capt.concat(D.escena ? [D.escena] : []);
      for (const n of lista) if (n.alTocar && n.alTocar(x, y, id) !== false) { due[id] = n; break; }
      if (D.pila.length && !due[id]) due[id] = D.pila[D.pila.length - 1];
    } else if (due[id]) {
      tipo === 'mov' ? due[id].alMover && due[id].alMover(x, y, id) : (due[id].alSoltar && due[id].alSoltar(x, y, id), delete due[id]);
    }
  };
  c.addEventListener('pointerdown', e => { e.preventDefault(); GD.S.despertar(); c.setPointerCapture && c.setPointerCapture(e.pointerId); dar('ini', e); });
  c.addEventListener('pointermove', e => dar('mov', e));
  c.addEventListener('pointerup', e => dar('fin', e));
  c.addEventListener('pointercancel', e => dar('fin', e));
  c.addEventListener('contextmenu', e => e.preventDefault());
  // las teclas van a la ventana de arriba (como los toques); si no las atiende, a la escena
  D.destinoTecla = () => { const t = D.pila[D.pila.length - 1]; return t && t.alTecla ? t : D.escena; };
  window.addEventListener('keydown', e => { if (e.repeat) return; const d = D.destinoTecla(); d && d.alTecla && d.alTecla(e.code, true, e); });
  window.addEventListener('keyup', e => { const d = D.destinoTecla(); d && d.alTecla && d.alTecla(e.code, false, e); });
  c.addEventListener('wheel', e => { D.escena && D.escena.alRueda && D.escena.alRueda(e.deltaY, ...D.aPuntos(e)); }, { passive: true });
};

// ---------- sonido ----------
const S = GD.S = { buf: {}, pend: {}, vMus: 1, vSfx: 1 };
S.init = function () {
  S.ctx = new (window.AudioContext || window.webkitAudioContext)(); S.gm = S.ctx.createGain(); S.gm.connect(S.ctx.destination); S.gs = S.ctx.createGain(); S.gs.connect(S.ctx.destination);
  // volumen de la música en el momento: hace latir los aros y los objetos de pulso, como el juego
  S.an = S.ctx.createAnalyser(); S.an.fftSize = 512; S.gm.connect(S.an); S.datosAn = new Uint8Array(S.an.fftSize); S.pulso = 0;
};
S.medir = function () {
  if (!S.an || !S.mNodo) { S.pulso *= 0.9; return S.pulso; }
  S.an.getByteTimeDomainData(S.datosAn); let m = 0;
  for (let i = 0; i < S.datosAn.length; i++) { const v = Math.abs(S.datosAn[i] - 128); if (v > m) m = v; }
  const obj = Math.min(1, m / 100); S.pulso += (obj - S.pulso) * (obj > S.pulso ? 0.6 : 0.15);
  return S.pulso;
};
S.despertar = () => { if (S.ctx && S.ctx.state !== 'running') S.ctx.resume(); };
S.cargar = function (ruta) {
  if (S.buf[ruta]) return Promise.resolve(S.buf[ruta]);
  const enPaq = GD.paq[ruta.replace(/^datos\//, '')];
  if (!S.pend[ruta]) S.pend[ruta] = (enPaq ? enPaq.arrayBuffer() : fetch(/^(https?:|blob:)/.test(ruta) ? ruta : GD.ruta(ruta)).then(r => { if (!r.ok) throw new Error(ruta); return r.arrayBuffer(); }))
    .then(a => S.ctx.decodeAudioData(a)).then(b => (S.buf[ruta] = b)).catch(e => { console.warn('sonido', ruta, e.message); delete S.pend[ruta]; return null; });
  return S.pend[ruta];
};
S.efecto = function (nombre, vol = 1, tono = 1) {
  const ruta = nombre.includes('/') ? nombre : 'datos/son/' + nombre;
  const b = S.buf[ruta];
  if (!b) { S.cargar(ruta); return null; }
  const s = S.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = tono;
  const g = S.ctx.createGain(); g.gain.value = vol * S.vSfx; s.connect(g); g.connect(S.gs); s.start(); return s;
};
// música: un solo tema a la vez, con desde (segundos) para empezar en la parte del nivel
S.musica = async function (ruta, desde = 0, bucle = true, fundido = 0) {
  if (S.mRuta === ruta && S.mNodo && bucle) return;
  S.pararMusica();
  S.mRuta = ruta; const tok = S.mTok = {};
  const b = await S.cargar(ruta); if (!b || S.mTok !== tok) return;
  const s = S.ctx.createBufferSource(); s.buffer = b; s.loop = bucle;
  const g = S.ctx.createGain(); g.gain.value = S.vMus; s.connect(g); g.connect(S.gm);
  if (fundido) { g.gain.setValueAtTime(0, S.ctx.currentTime); g.gain.linearRampToValueAtTime(S.vMus, S.ctx.currentTime + fundido); }
  s.start(0, Math.max(0, desde) % b.duration); S.mNodo = s; S.mGan = g; S.mIni = S.ctx.currentTime - desde;
};
S.pararMusica = function () { if (S.mNodo) { try { S.mNodo.stop(); } catch (e) { } S.mNodo = null; } S.mRuta = null; S.mTok = null; };
S.pausar = function () { if (S.ctx) S.ctx.suspend(); }; S.seguir = function () { if (S.ctx) S.ctx.resume(); };
S.tiempo = () => S.mNodo ? S.ctx.currentTime - S.mIni : 0;
S.volMusica = v => { S.vMus = v; if (S.mGan) S.mGan.gain.value = v; };

// ---------- guardado ----------
const G = GD.G = {};
G.leer = (k, def) => { try { const v = localStorage.getItem('gd22.' + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } };
G.escribir = (k, v) => { try { localStorage.setItem('gd22.' + k, JSON.stringify(v)); } catch (e) { } };
// los niveles del editor pueden ser grandes: van a IndexedDB
G.db = () => G._db || (G._db = new Promise((ok, mal) => { const r = indexedDB.open('gd22', 1); r.onupgradeneeded = () => { r.result.createObjectStore('niveles'); r.result.createObjectStore('bajados'); }; r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); }));
G.idb = async (tienda, modo, f) => { const db = await G.db(); return new Promise((ok, mal) => { const t = db.transaction(tienda, modo); const q = f(t.objectStore(tienda)); t.oncomplete = () => ok(q && q.result); t.onerror = () => mal(t.error); }); };
G.idbPoner = (t, k, v) => G.idb(t, 'readwrite', s => s.put(v, k));
G.idbLeer = (t, k) => G.idb(t, 'readonly', s => s.get(k));
G.idbBorrar = (t, k) => G.idb(t, 'readwrite', s => s.delete(k));
G.idbTodo = (t) => G.idb(t, 'readonly', s => s.getAll());

GD.ruta = r => (GD.base || '') + r;
GD.azar = (a, b) => a + Math.random() * (b - a);
GD.lerp = (a, b, k) => a + (b - a) * k;
GD.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
