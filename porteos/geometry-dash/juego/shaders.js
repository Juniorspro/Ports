// Efectos de pantalla de la 2.2 (triggers de shader 2904-2924): cuando hay alguno prendido, el mundo
// se dibuja en una textura y se pasa por un programa que aplica gris, sepia, invertir, tono, editar
// color, aberración cromática, pixelado, lente, desenfoque radial, abultar, pellizcar, ondas de choque
// y glitch. Los valores se animan con la duración y la curva del trigger, como el juego.
'use strict';
(() => {
const R = GD.R, TR = GD.TR, H = TR.H;
const n = (v, d = 0) => v === undefined || v === '' ? d : +v;
const SH = GD.Shaders = {};
SH.base = () => ({ gris: 0, grisTinte: 0, sepia: 0, inv: 0, invRGB: [1, 1, 1], tono: 0, mul: [1, 1, 1], suma: [0, 0, 0], croma: [0, 0], pix: [0, 0],
  lente: { fuerza: 0, tam: 0, fundido: 0, c: null, tinte: 0 }, radial: { fuerza: 0, tam: 0, c: null }, bulto: { fuerza: 0, radio: 0, c: null },
  pellizco: { x: 0, y: 0, radio: 0, c: null }, glitch: { fuerza: 0, vel: 1, alto: 0.1, dx: 0 }, cglitch: { fuerza: 0, vel: 1, rgb: 0, alto: 0.05 }, ondas: [] });
SH.estado = p => p.tr.sh || (p.tr.sh = SH.base());
SH.activo = s => !!s && (s.gris > 0.001 || s.sepia > 0.001 || s.inv > 0.001 || Math.abs(s.tono) > 0.01 || s.mul.some(v => Math.abs(v - 1) > 0.001) || s.suma.some(v => Math.abs(v) > 0.001) ||
  Math.abs(s.croma[0]) > 0.05 || Math.abs(s.croma[1]) > 0.05 || s.pix[0] > 1.01 || s.pix[1] > 1.01 || s.lente.fuerza > 0.001 || s.radial.fuerza > 0.001 ||
  Math.abs(s.bulto.fuerza) > 0.001 || Math.abs(s.pellizco.x) + Math.abs(s.pellizco.y) > 0.001 || s.glitch.fuerza > 0.001 || s.cglitch.fuerza > 0.001 || s.ondas.length > 0);

// ---------- animación de valores ----------
const leer = (o, ruta) => ruta.split('.').reduce((x, k) => x[k], o);
const poner = (o, ruta, v) => { const ks = ruta.split('.'), u = ks.pop(); ks.reduce((x, k) => x[k], o)[u] = v; };
// campos: [ruta, valor final]; el valor inicial es el de ahora (así se encadenan como en el juego)
const animar = (p, r, campos) => {
  const s = SH.estado(p);
  TR.accion(p, { k: 'sh', campos: campos.map(([ruta, fin]) => [ruta, leer(s, ruta), fin]), dur: n(r[10], 0), e: r[30] | 0, r: n(r[85], 2) });
};
SH.paso = function (p, a, k) { const s = SH.estado(p); for (const [ruta, ini, fin] of a.campos) poner(s, ruta, ini + (fin - ini) * k); };
// centro de un efecto: un grupo (51), el jugador 1 o 2 (138/200) o el centro de la pantalla corrido (290/291)
const centro = r => ({ g: r[188] == 1 || r[51] ? r[51] | 0 : 0, p1: r[138] == 1, p2: r[200] == 1, ox: n(r[290]), oy: n(r[291]) });
SH.aPantalla = function (p, c) {
  const D = GD.D, w = p.vista;
  let x = D.ancho / 2 + (c ? c.ox : 0), y = D.alto / 2 + (c ? c.oy : 0);
  if (c && w) {
    let mx = null;
    if (c.p1 && p.j) mx = [p.j.x, p.j.y]; else if (c.p2 && p.j2) mx = [p.j2.x, p.j2.y]; else if (c.g) mx = TR.centro(p, c.g);
    if (mx) { x = w[0] * mx[0] + w[2] * mx[1] + w[4] + c.ox; y = w[1] * mx[0] + w[3] * mx[1] + w[5] + c.oy; }
  }
  return [x, y];
};

// ---------- los triggers ----------
H.shader = function (p, o, r) { if (r[192] == 1) { const s = SH.estado(p), ondas = s.ondas; Object.assign(s, SH.base()); ondas.length = 0; p.tr.acciones = p.tr.acciones.filter(a => a.k !== 'sh'); } };
H.shGris = function (p, o, r) { const s = SH.estado(p); s.grisTinte = r[190] == 1 ? (r[51] | 0) : 0; animar(p, r, [['gris', n(r[176], 0)]]); };
H.shSepia = (p, o, r) => animar(p, r, [['sepia', n(r[176], 0)]]);
H.shInvertir = function (p, o, r) {
  const c = [['inv', n(r[176], 0)]];
  if (r[188] == 1) c.push(['invRGB.0', n(r[179], 1)], ['invRGB.1', n(r[180], 1)], ['invRGB.2', n(r[189], 1)]); else c.push(['invRGB.0', 1], ['invRGB.1', 1], ['invRGB.2', 1]);
  animar(p, r, c);
};
H.shTono = (p, o, r) => animar(p, r, [['tono', n(r[176], 0)]]);
H.shColor = (p, o, r) => animar(p, r, [['mul.0', n(r[176], 1)], ['mul.1', n(r[191], 1)], ['mul.2', n(r[175], 1)], ['suma.0', n(r[179], 0)], ['suma.1', n(r[180], 0)], ['suma.2', n(r[189], 0)]]);
H.shCroma = function (p, o, r) { const c = []; if (r[188] == 1 || r[190] != 1) c.push(['croma.0', n(r[180], 0)]); if (r[190] == 1 || r[188] != 1) c.push(['croma.1', n(r[189], 0)]); animar(p, r, c); };
H.shPixel = function (p, o, r) { const c = []; if (r[188] == 1 || r[190] != 1) c.push(['pix.0', n(r[180], 0)]); if (r[190] == 1 || r[188] != 1) c.push(['pix.1', n(r[189], 0)]); animar(p, r, c); };
H.shLente = function (p, o, r) { const s = SH.estado(p); s.lente.c = centro(r); s.lente.tinte = r[71] | 0; animar(p, r, [['lente.fuerza', n(r[176], 0)], ['lente.tam', n(r[179], 0)], ['lente.fundido', n(r[181], 0)]]); };
H.shRadial = function (p, o, r) { const s = SH.estado(p); s.radial.c = centro(r); animar(p, r, [['radial.fuerza', n(r[176], 0)], ['radial.tam', n(r[179], 0)]]); };
H.shMovimiento = (p, o, r) => animar(p, r, [['croma.0', 0]]); // desenfoque de movimiento: sin equivalente fiel todavía
H.shBulto = function (p, o, r) { const s = SH.estado(p); s.bulto.c = centro(r); animar(p, r, [['bulto.fuerza', n(r[176], 0)], ['bulto.radio', n(r[180], 0)]]); };
H.shPellizco = function (p, o, r) { const s = SH.estado(p); s.pellizco.c = centro(r); animar(p, r, [['pellizco.x', n(r[180], 0)], ['pellizco.y', n(r[189], 0)], ['pellizco.radio', n(r[512], 0)]]); };
H.shGlitch = function (p, o, r) { const s = SH.estado(p); s.glitch.vel = n(r[175], 1); s.glitch.alto = n(r[179], 0.1); s.glitch.dx = n(r[191], 0); animar(p, r, [['glitch.fuerza', n(r[176], 0)]]); };
H.shCGlitch = function (p, o, r) { const s = SH.estado(p); s.cglitch.vel = n(r[175], 1); s.cglitch.rgb = n(r[180], 0); s.cglitch.alto = n(r[189], 0.05); animar(p, r, [['cglitch.fuerza', n(r[176], 0)]]); };
// onda de choque: un anillo que crece desde el centro y se apaga
H.shOnda = function (p, o, r) {
  const s = SH.estado(p);
  s.ondas.push({ t: -n(r[177]), vel: n(r[175], 1), fuerza: n(r[176], 1), grosor: n(r[180], 10), ancho: n(r[179], 1), fi: n(r[181]), fo: n(r[182]), max: n(r[512]), inv: r[184] == 1, c: centro(r), linea: o.id === 2907 });
};
Object.assign(TR.def, { 2904: 'shader', 2905: 'shOnda', 2907: 'shOnda', 2909: 'shGlitch', 2910: 'shCroma', 2911: 'shCGlitch', 2912: 'shPixel', 2913: 'shLente', 2914: 'shRadial',
  2915: 'shMovimiento', 2916: 'shBulto', 2917: 'shPellizco', 2919: 'shGris', 2920: 'shSepia', 2921: 'shInvertir', 2922: 'shTono', 2923: 'shColor' });
SH.cuadro = function (p, dt) {
  const s = p.tr && p.tr.sh; if (!s) return;
  for (const w of s.ondas) w.t += dt * (p.tr.escalaT || 1);
  s.ondas = s.ondas.filter(w => { const rad = Math.max(0, w.t) * w.vel * 400; return w.t < 6 && (!w.max || rad < w.max * 2 + 200); });
};

// ---------- el programa de la pasada final ----------
const VS = `#version 300 es
in vec2 p; in vec2 t; uniform mat3 M; out vec2 vt;
void main(){ vec3 q = M*vec3(p,1.); gl_Position = vec4(q.xy,0.,1.); vt=t; }`;
const FS = `#version 300 es
precision highp float; in vec2 vt; out vec4 o; uniform sampler2D T; uniform vec2 res; uniform float tiempo;
uniform float gris, sepia, inv, tono; uniform vec3 grisCol, invRGB, mul, suma; uniform vec2 croma, pix;
uniform vec4 lente; uniform float lenteF; uniform vec3 lenteCol; uniform vec4 radial; uniform vec4 bulto; uniform vec4 pell; uniform vec2 pellR;
uniform vec4 onda[4]; uniform vec4 ondaB[4]; uniform int nOndas; uniform vec3 glitch; uniform vec3 cglitch;
float az(float x){ return fract(sin(x*12.9898)*43758.5453); }
vec3 rotarTono(vec3 c, float g){ float a = radians(g), co = cos(a), si = sin(a);
  mat3 m = mat3(.299+.701*co+.168*si, .587-.587*co+.330*si, .114-.114*co-.497*si, .299-.299*co-.328*si, .587+.413*co+.035*si, .114-.114*co+.292*si, .299-.3*co+1.25*si, .587-.588*co-1.05*si, .114+.886*co-.203*si);
  return clamp(c*m, 0., 1.); }
void main(){
  vec2 q = vt*res;
  // deformaciones (en píxeles de pantalla)
  if (bulto.w != 0. && bulto.z > 0.) { vec2 d = q-bulto.xy; float l = length(d); if (l < bulto.z) { float k = l/bulto.z; q = bulto.xy + d*mix(1., pow(k, bulto.w), 1.-k); } }
  if (pellR.x > 0. && (pell.z != 0. || pell.w != 0.)) { vec2 d = q-pell.xy; float l = length(d); if (l < pellR.x) { float k = 1.-l/pellR.x; q -= d*k*k*vec2(pell.z, pell.w)*.5; } }
  for (int i=0;i<4;i++){ if (i>=nOndas) break; vec4 w = onda[i]; vec4 b = ondaB[i]; float l = (b.w>.5) ? abs(q.x-w.x) : length(q-w.xy); float d = l-w.z;
    if (abs(d) < b.x) { float k = (1.-abs(d)/b.x)*w.w; vec2 dir = (b.w>.5) ? vec2(sign(q.x-w.x),0.) : normalize(q-w.xy+1e-4); q -= dir*k*b.y*(b.z>.5?-1.:1.); } }
  if (glitch.x > 0.) { float fila = floor(vt.y/max(.01,glitch.z)); float r = az(fila+floor(tiempo*glitch.y*20.)); if (r < glitch.x*.6) q.x += (az(fila*7.+floor(tiempo*glitch.y*20.))-.5)*glitch.x*res.x*.15; }
  if (pix.x > 1.) q.x = (floor(q.x/pix.x)+.5)*pix.x;
  if (pix.y > 1.) q.y = (floor(q.y/pix.y)+.5)*pix.y;
  vec2 uv = q/res; vec2 cr = croma/res;
  if (cglitch.x > 0.) { float fila = floor(vt.y/max(.005,cglitch.z)); float r = az(fila+floor(tiempo*cglitch.y*15.)); if (r < cglitch.x*.5) { cr += vec2((az(fila*3.1+tiempo)-.5)*cglitch.x*.05 + cglitch.y*.0, 0.); uv.x += (r-.25)*cglitch.x*.02; } }
  vec3 c;
  if (cr != vec2(0.)) c = vec3(texture(T, uv+cr).r, texture(T, uv).g, texture(T, uv-cr).b); else c = texture(T, uv).rgb;
  if (radial.w > 0.) { vec2 ctr = radial.xy/res; vec3 acc = vec3(0.); for (int i=0;i<16;i++){ float k = float(i)/15.; acc += texture(T, mix(uv, ctr, k*radial.w*.25)).rgb; } c = acc/16.; }
  // color
  c = c*mul + suma;
  if (tono != 0.) c = rotarTono(c, tono);
  float lum = dot(c, vec3(.299,.587,.114));
  if (gris > 0.) c = mix(c, grisCol*lum, clamp(gris,0.,1.));
  if (sepia > 0.) { vec3 s = vec3(dot(c, vec3(.393,.769,.189)), dot(c, vec3(.349,.686,.168)), dot(c, vec3(.272,.534,.131))); c = mix(c, s, clamp(sepia,0.,1.)); }
  if (inv > 0.) c = mix(c, 1.-c, clamp(inv,0.,1.)*invRGB);
  if (lente.w > 0.) { float l = length(q-lente.xy); float k = smoothstep(lente.z, lente.z+max(1.,lenteF), l); c = mix(c, lenteCol, k*clamp(lente.w,0.,1.)); }
  o = vec4(clamp(c,0.,1.), 1.);
}`;
let prog = null, U = {}, fbo = null, ftex = null, fw = 0, fh = 0;
const preparar = function () {
  const gl = R.gl;
  if (!prog) {
    const sh = (t, s) => { const h = gl.createShader(t); gl.shaderSource(h, s); gl.compileShader(h); if (!gl.getShaderParameter(h, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(h)); return h; };
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(prog, 0, 'p'); gl.bindAttribLocation(prog, 1, 't'); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    for (const k of ['M', 'T', 'res', 'tiempo', 'gris', 'sepia', 'inv', 'tono', 'grisCol', 'invRGB', 'mul', 'suma', 'croma', 'pix', 'lente', 'lenteF', 'lenteCol', 'radial', 'bulto', 'pell', 'pellR', 'onda', 'ondaB', 'nOndas', 'glitch', 'cglitch']) U[k] = gl.getUniformLocation(prog, k);
  }
  const c = R.gl.canvas;
  if (!fbo || fw !== c.width || fh !== c.height) {
    fw = c.width; fh = c.height;
    if (ftex) gl.deleteTexture(ftex); if (!fbo) fbo = gl.createFramebuffer();
    ftex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, ftex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ftex, 0);
    R.tex = null;
  }
};
// empieza a dibujar el mundo en la textura (si hay efectos); devuelve si quedó activo
SH.empezar = function (p) {
  if (!SH.activo(p.tr && p.tr.sh)) return false;
  R.flush();
  try { preparar(); } catch (e) { GD.D.error(e); SH.roto = true; return false; }
  const gl = R.gl; R.tex = null; gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, fw, fh); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  return true;
};
SH.terminar = function (p) {
  const gl = R.gl, D = GD.D, s = p.tr.sh, k = D.k;
  R.flush(); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, fw, fh);
  gl.useProgram(prog);
  gl.uniformMatrix3fv(U.M, false, [2 / D.ancho, 0, 0, 0, 2 / D.alto, 0, -1, -1, 1]);
  gl.uniform1i(U.T, 0); gl.uniform2f(U.res, fw, fh); gl.uniform1f(U.tiempo, p.tiempo || 0);
  gl.uniform1f(U.gris, s.gris); gl.uniform1f(U.sepia, s.sepia); gl.uniform1f(U.inv, s.inv); gl.uniform1f(U.tono, s.tono);
  const gc = s.grisTinte ? p.cols.valor(s.grisTinte) : null; gl.uniform3f(U.grisCol, gc ? gc.r / 255 : 1, gc ? gc.g / 255 : 1, gc ? gc.b / 255 : 1);
  gl.uniform3fv(U.invRGB, s.invRGB); gl.uniform3fv(U.mul, s.mul); gl.uniform3fv(U.suma, s.suma);
  gl.uniform2f(U.croma, s.croma[0] * k, s.croma[1] * k); gl.uniform2f(U.pix, s.pix[0] * k, s.pix[1] * k);
  const pt = c => { const [x, y] = SH.aPantalla(p, c); return [x * k, y * k]; };
  if (s.lente.fuerza > 0) { const [x, y] = pt(s.lente.c); gl.uniform4f(U.lente, x, y, s.lente.tam * k * 30, s.lente.fuerza); gl.uniform1f(U.lenteF, s.lente.fundido * k * 30); const t = s.lente.tinte ? p.cols.valor(s.lente.tinte) : null; gl.uniform3f(U.lenteCol, t ? t.r / 255 : 0, t ? t.g / 255 : 0, t ? t.b / 255 : 0); }
  else gl.uniform4f(U.lente, 0, 0, 0, 0);
  if (s.radial.fuerza > 0) { const [x, y] = pt(s.radial.c); gl.uniform4f(U.radial, x, y, s.radial.tam, s.radial.fuerza); } else gl.uniform4f(U.radial, 0, 0, 0, 0);
  if (s.bulto.fuerza) { const [x, y] = pt(s.bulto.c); gl.uniform4f(U.bulto, x, y, (s.bulto.radio || 5) * k * 30, 1 + s.bulto.fuerza); } else gl.uniform4f(U.bulto, 0, 0, 0, 0);
  if (s.pellizco.x || s.pellizco.y) { const [x, y] = pt(s.pellizco.c); gl.uniform4f(U.pell, x, y, s.pellizco.x, s.pellizco.y); gl.uniform2f(U.pellR, (s.pellizco.radio || 200) * k, 0); } else gl.uniform2f(U.pellR, 0, 0);
  const ondas = s.ondas.slice(0, 4), A = new Float32Array(16), B = new Float32Array(16);
  ondas.forEach((w, i) => {
    const [x, y] = pt(w.c), t = Math.max(0, w.t), rad = t * w.vel * 400 * k, fin = w.max ? w.max * k * 2 : fh * 2;
    let a = 1; if (w.fi > 0 && t < w.fi) a = t / w.fi; const quedan = (fin - rad) / Math.max(1, w.vel * 400 * k); if (w.fo > 0 && quedan < w.fo) a *= Math.max(0, quedan / w.fo);
    A.set([x, y, rad, a * Math.min(1, w.fuerza)], i * 4); B.set([Math.max(2, w.grosor * k), w.ancho * 10 * k, w.inv ? 1 : 0, w.linea ? 1 : 0], i * 4);
  });
  gl.uniform4fv(U.onda, A); gl.uniform4fv(U.ondaB, B); gl.uniform1i(U.nOndas, ondas.length);
  gl.uniform3f(U.glitch, s.glitch.fuerza, s.glitch.vel, s.glitch.alto); gl.uniform3f(U.cglitch, s.cglitch.fuerza, s.cglitch.vel, s.cglitch.alto);
  // un cuadro de pantalla completa con la textura (y invertida: la textura del framebuffer viene de abajo)
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ftex); gl.disable(gl.BLEND);
  const f = R.f32, u = R.u32, W = D.ancho, Hh = D.alto, q = [[0, Hh, 0, 1], [W, Hh, 1, 1], [0, 0, 0, 0], [W, 0, 1, 0]];
  for (let i = 0; i < 4; i++) { const o = i * R.ST; f[o] = q[i][0]; f[o + 1] = q[i][1]; f[o + 2] = q[i][2]; f[o + 3] = q[i][3]; u[o + 4] = 0xffffffff; u[o + 5] = 0; }
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, R.f32, 0, 4 * R.ST); gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  gl.enable(gl.BLEND); gl.useProgram(R.prog); R.tex = null;
};
})();
