// ---------------------------------------------------------------------------------------------------------
// imagen final en las calidades altas: la escena se dibuja en un búfer de luz alta (HDR, flotante) con su
// profundidad en una textura. Después: oclusión ambiental (SSAO a media resolución, con desenfoque que respeta
// los bordes), resplandor (bloom en cadena de reducciones), rayos de sol entre los objetos, tono ACES con
// exposición, un poco de viñeta y antialias FXAA. En WebGL 1 los formatos salen de R.F (y si no hay medio float
// que se pueda dibujar, sin HDR; si no hay texturas de profundidad, sin oclusión ni rayos).
// ---------------------------------------------------------------------------------------------------------
const PO = { w: 0, h: 0, fb: null, col: null, prof: null, ao: [], bl: [], ray: [], ldr: null, ok: false, p: {} };
const VS_PANT = `
layout(location=0) in vec2 aP; out vec2 vUV; void main(){ vUV = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;
// oclusión ambiental: posición de vista desde la profundidad; muestras en espiral (como SAO) en un radio en metros
const FS_SSAO = `
precision highp float; in vec2 vUV; uniform sampler2D uProf; uniform vec2 uNF, uTan, uInv; uniform float uRad, uInt; out vec4 o;
float vz(vec2 uv) { float d = texture(uProf, uv).r * 2.0 - 1.0; return 2.0 * uNF.x * uNF.y / (uNF.y + uNF.x - d * (uNF.y - uNF.x)); }
vec3 vpos(vec2 uv) { float z = vz(uv); return vec3((uv * 2.0 - 1.0) * uTan * z, -z); }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  float d0 = texture(uProf, vUV).r;
  if (d0 >= 0.99999) { o = vec4(1.0); return; }
  vec3 P = vpos(vUV);
  // normal: de los vecinos más parecidos (sin errores en los bordes)
  vec3 pr = vpos(vUV + vec2(uInv.x, 0.0)), pl = vpos(vUV - vec2(uInv.x, 0.0)), pu = vpos(vUV + vec2(0.0, uInv.y)), pd = vpos(vUV - vec2(0.0, uInv.y));
  vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl, dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
  vec3 N = normalize(cross(dx, dy));
  float rPant = uRad / (-P.z * uTan.y * 2.0);               // radio en pantalla (fracción del alto)
  if (rPant < uInv.y * 1.5) { o = vec4(1.0); return; }
  rPant = min(rPant, 0.12);
  float a0 = ign(gl_FragCoord.xy) * 6.2831853, s = 0.0;
  for (int i = 0; i < NMUES; i++) {
    float t = (float(i) + 0.5) / float(NMUES), ang = a0 + t * 6.2831853 * 7.0;
    vec2 off = vec2(cos(ang), sin(ang)) * t * rPant; off.x *= uInv.x / uInv.y;
    vec3 Q = vpos(vUV + off), v = Q - P;
    float vv = dot(v, v), vn = dot(v, N);
    s += max(0.0, vn + P.z * 0.002) / (vv + 0.01) * max(0.0, 1.0 - vv / (uRad * uRad));
  }
  float ao = max(0.0, 1.0 - 2.0 * uInt * s / float(NMUES));
  o = vec4(pow(ao, 1.3), 1.0, 1.0, 1.0);
}`;
// desenfoque que no cruza bordes (por diferencia de profundidad)
const FS_AOBLUR = `
precision highp float; in vec2 vUV; uniform sampler2D uTex, uProf; uniform vec2 uDir, uNF; out vec4 o;
float vz(vec2 uv) { float d = texture(uProf, uv).r * 2.0 - 1.0; return 2.0 * uNF.x * uNF.y / (uNF.y + uNF.x - d * (uNF.y - uNF.x)); }
void main(){
  float z0 = vz(vUV), s = 0.0, w = 0.0;
  for (int i = -3; i <= 3; i++) {
    vec2 uv = vUV + uDir * float(i);
    float z = vz(uv), k = exp(-float(i * i) * 0.12) * max(0.0, 1.0 - abs(z - z0) / (z0 * 0.06 + 0.05));
    s += texture(uTex, uv).r * k; w += k;
  }
  o = vec4(s / max(w, 1e-4), 1.0, 1.0, 1.0);
}`;
// resplandor: primer paso con umbral suave, después reducir y ampliar (filtros de 4 y 9 muestras)
const FS_BRILLO = `
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uInv; uniform float uUmb; out vec4 o;
void main(){
  vec3 c = texture(uTex, vUV + uInv * vec2(-1, -1)).rgb + texture(uTex, vUV + uInv * vec2(1, -1)).rgb + texture(uTex, vUV + uInv * vec2(-1, 1)).rgb + texture(uTex, vUV + uInv * vec2(1, 1)).rgb;
  c *= 0.25; c = min(c, vec3(60.0));
  float l = max(c.r, max(c.g, c.b)), k = max(0.0, l - uUmb) / max(l, 1e-4);
  o = vec4(c * k, 1.0);
}`;
const FS_BAJA = `
precision mediump float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uInv; out vec4 o;
void main(){ vec3 c = texture(uTex, vUV).rgb * 4.0 + texture(uTex, vUV + uInv * vec2(-1, -1)).rgb + texture(uTex, vUV + uInv * vec2(1, -1)).rgb + texture(uTex, vUV + uInv * vec2(-1, 1)).rgb + texture(uTex, vUV + uInv * vec2(1, 1)).rgb; o = vec4(c / 8.0, 1.0); }`;
const FS_SUBE = `
precision mediump float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uInv; out vec4 o;
void main(){
  vec3 c = texture(uTex, vUV + uInv * vec2(-1, 0)).rgb + texture(uTex, vUV + uInv * vec2(1, 0)).rgb + texture(uTex, vUV + uInv * vec2(0, -1)).rgb + texture(uTex, vUV + uInv * vec2(0, 1)).rgb;
  c = c * 2.0 + texture(uTex, vUV + uInv * vec2(-1, -1)).rgb + texture(uTex, vUV + uInv * vec2(1, -1)).rgb + texture(uTex, vUV + uInv * vec2(-1, 1)).rgb + texture(uTex, vUV + uInv * vec2(1, 1)).rgb;
  o = vec4(c / 12.0, 1.0);
}`;
// rayos de sol: dónde se ve el cielo cerca del sol (a 1/4 de resolución) y desenfoque radial hacia el sol
const FS_RAYMASK = `
precision highp float; in vec2 vUV; uniform sampler2D uTex, uProf; uniform vec2 uSolUV, uAsp; out vec4 o;
void main(){
  float d = texture(uProf, vUV).r; vec2 v = (vUV - uSolUV) * uAsp;
  float k = d >= 0.99999 ? 1.0 : 0.0;
  vec3 c = texture(uTex, vUV).rgb;
  o = vec4(min(c, vec3(8.0)) * k * exp(-dot(v, v) * 6.0), 1.0);
}`;
const FS_RAYOS = `
precision mediump float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uSolUV; uniform float uDec; out vec4 o;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  vec2 d = (uSolUV - vUV) / 40.0; vec2 uv = vUV; vec3 s = vec3(0.0); float w = 1.0;
  for (int i = 0; i < 40; i++) { s += texture(uTex, uv).rgb * w; w *= uDec; uv += d; }
  o = vec4(s / 40.0, 1.0);
}`;
const FS_FINAL = `
precision highp float; in vec2 vUV; uniform sampler2D uTex, uTex2, uTex3; uniform float uExpo, uBloom, uRayo, uVin, uHdr; uniform vec2 uInv; out vec4 o;
vec3 aces(vec3 x) { return clamp(x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  if (uHdr > 0.5) {
    c += texture(uTex2, vUV).rgb * uBloom + texture(uTex3, vUV).rgb * uRayo;
    c = aces(c * uExpo);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, 1.18);                                 // un toque más de color
    c = c * c * (3.0 - 2.0 * c) * 0.18 + c * 0.82;             // y de contraste (curva en S suave)
    c = pow(c, vec3(1.0 / 2.2));
  }
  vec2 q = vUV - 0.5; c *= 1.0 - dot(q, q) * uVin;
  c += (ign(gl_FragCoord.xy) - 0.5) / 255.0;
  o = vec4(c, dot(c, vec3(0.299, 0.587, 0.114)));
}`;
// FXAA (versión corta de la 3.11): busca bordes por el brillo y mezcla a lo largo de ellos
const FS_FXAA = `
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uInv; out vec4 o;
void main(){
  vec4 cM = texture(uTex, vUV);
  float lM = cM.a, lN = texture(uTex, vUV + vec2(0, uInv.y)).a, lS = texture(uTex, vUV - vec2(0, uInv.y)).a, lE = texture(uTex, vUV + vec2(uInv.x, 0)).a, lW = texture(uTex, vUV - vec2(uInv.x, 0)).a;
  float mn = min(lM, min(min(lN, lS), min(lE, lW))), mx = max(lM, max(max(lN, lS), max(lE, lW))), r = mx - mn;
  if (r < max(0.0312, mx * 0.125)) { o = vec4(cM.rgb, 1.0); return; }
  float lNW = texture(uTex, vUV + vec2(-uInv.x, uInv.y)).a, lNE = texture(uTex, vUV + uInv).a, lSW = texture(uTex, vUV - uInv).a, lSE = texture(uTex, vUV + vec2(uInv.x, -uInv.y)).a;
  float hor = abs(lN + lS - 2.0 * lM) * 2.0 + abs(lNE + lSE - 2.0 * lE) + abs(lNW + lSW - 2.0 * lW);
  float ver = abs(lE + lW - 2.0 * lM) * 2.0 + abs(lNE + lNW - 2.0 * lN) + abs(lSE + lSW - 2.0 * lS);
  bool esH = hor >= ver;
  float l1 = esH ? lS : lW, l2 = esH ? lN : lE, g1 = abs(l1 - lM), g2 = abs(l2 - lM);
  float paso = esH ? uInv.y : uInv.x; float lLocal;
  if (g1 >= g2) { paso = -paso; lLocal = 0.5 * (l1 + lM); } else lLocal = 0.5 * (l2 + lM);
  float grad = 0.25 * max(g1, g2);
  vec2 uv = vUV; if (esH) uv.y += paso * 0.5; else uv.x += paso * 0.5;
  vec2 dir = esH ? vec2(uInv.x, 0.0) : vec2(0.0, uInv.y);
  vec2 u1 = uv - dir, u2 = uv + dir; float e1 = texture(uTex, u1).a - lLocal, e2 = texture(uTex, u2).a - lLocal; bool f1 = abs(e1) >= grad, f2 = abs(e2) >= grad;
  for (int i = 0; i < 10; i++) {
    if (f1 && f2) break;
    float k = i < 3 ? 1.0 : i < 6 ? 1.5 : 2.5;
    if (!f1) { u1 -= dir * k; e1 = texture(uTex, u1).a - lLocal; f1 = abs(e1) >= grad; }
    if (!f2) { u2 += dir * k; e2 = texture(uTex, u2).a - lLocal; f2 = abs(e2) >= grad; }
  }
  float d1 = esH ? vUV.x - u1.x : vUV.y - u1.y, d2 = esH ? u2.x - vUV.x : u2.y - vUV.y;
  bool masCerca1 = d1 < d2; float dmin = min(d1, d2), largo = d1 + d2;
  bool menor = lM < lLocal; bool ok = ((masCerca1 ? e1 : e2) < 0.0) != menor;
  float off = ok ? 0.5 - dmin / largo : 0.0;
  float prom = (2.0 * (lN + lS + lE + lW) + lNW + lNE + lSW + lSE) / 12.0;
  float sub = clamp(abs(prom - lM) / r, 0.0, 1.0); sub = sub * sub * (3.0 - 2.0 * sub); sub = sub * sub * 0.75;
  off = max(off, sub);
  vec2 fin = vUV; if (esH) fin.y += off * paso; else fin.x += off * paso;
  o = vec4(texture(uTex, fin).rgb, 1.0);
}`;
function rtTex(w, h, ifmt, fmt, tipo, filtro) {
  const gl = R.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, tipo, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtro); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtro);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function rtFb(col, prof, rb) {
  const gl = R.gl, f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  if (col) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, col, 0);
  if (prof) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, prof, 0);
  if (rb) gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return ok ? f : null;
}
function rt(w, h, ifmt, fmt, tipo, filtro) { const t = rtTex(w, h, ifmt, fmt, tipo, filtro); return { t, f: rtFb(t, null), w, h }; }
function postLiberar() {
  const gl = R.gl;
  const del = (x) => { if (!x) return; if (x.t) gl.deleteTexture(x.t); if (x.f) gl.deleteFramebuffer(x.f); };
  if (PO.fb) gl.deleteFramebuffer(PO.fb); if (PO.col) gl.deleteTexture(PO.col); if (PO.prof) gl.deleteTexture(PO.prof); if (PO.rb) gl.deleteRenderbuffer(PO.rb); PO.rb = null;
  for (const x of PO.ao.concat(PO.bl, PO.ray, [PO.ldr])) del(x);
  PO.fb = PO.col = PO.prof = PO.ldr = null; PO.ao = []; PO.bl = []; PO.ray = []; PO.w = PO.h = 0; PO.ok = false;
}
// arma (o rehace si cambió el tamaño) los búferes
function postPreparar() {
  const gl = R.gl, w = R.cv.width, h = R.cv.height;
  if (PO.ok && PO.w === w && PO.h === h && PO.cfg === postCfg()) return true;
  postLiberar();
  PO.w = w; PO.h = h; PO.cfg = postCfg();
  const hdr = R.extFloat && GFX.hdr;
  PO.hdr = !!hdr;
  const F = R.F;
  PO.col = rtTex(w, h, ...(hdr ? F.hdr : F.ldr), gl.LINEAR);
  if (R.depthTex) PO.prof = rtTex(w, h, ...F.prof, gl.NEAREST);
  else { PO.rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, PO.rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h); }
  PO.fb = rtFb(PO.col, PO.prof, PO.rb);
  if (!PO.fb) { postLiberar(); return false; }
  const w2 = Math.max(1, w >> 1), h2 = Math.max(1, h >> 1), densa = postDensa(), wa = densa ? Math.max(1, w >> 2) : w2, ha = densa ? Math.max(1, h >> 2) : h2;
  if (GFX.ao && R.depthTex) PO.ao = [rt(wa, ha, ...F.r8, gl.LINEAR), rt(wa, ha, ...F.r8, gl.LINEAR)];
  if (GFX.bloom && hdr) {
    let bw = w2, bh = h2; const n = GFX.bloom >= 2 ? 6 : 5;
    for (let i = 0; i < n && bw >= 4 && bh >= 4; i++) { PO.bl.push(rt(bw, bh, ...F.hdr, gl.LINEAR)); bw >>= 1; bh >>= 1; }
  }
  if (GFX.rayos && hdr && R.depthTex) { const w4 = Math.max(1, w >> 2), h4 = Math.max(1, h >> 2); PO.ray = [rt(w4, h4, ...F.hdr, gl.LINEAR), rt(w4, h4, ...F.hdr, gl.LINEAR)]; }
  if (GFX.fxaa && !densa) PO.ldr = rt(w, h, ...F.ldr, gl.LINEAR);
  if (!PO.p.final) {
    const mk = (fs, d) => shader(VS_PANT, fs, d);
    PO.p.ssao8 = mk(FS_SSAO, ['NMUES=8']); PO.p.ssao16 = mk(FS_SSAO, ['NMUES=14']); PO.p.aoblur = mk(FS_AOBLUR);
    PO.p.brillo = mk(FS_BRILLO); PO.p.baja = mk(FS_BAJA); PO.p.sube = mk(FS_SUBE); PO.p.raymask = mk(FS_RAYMASK); PO.p.rayos = mk(FS_RAYOS);
    PO.p.final = mk(FS_FINAL); PO.p.fxaa = mk(FS_FXAA);
  }
  PO.ok = true; return true;
}
// densidad: puntos del lienzo por punto de la pantalla. Con 1,5 o más (celulares, pantallas retina) los efectos van a
// la resolución que se nota: la oclusión a un cuarto y sin FXAA (los bordes ya no se ven serruchados)
const postDensa = () => R.cv.width / Math.max(1, VW()) >= 1.5;
function postCfg() { return [GFX.hdr, GFX.ao, GFX.bloom, GFX.rayos, GFX.fxaa, postDensa() ? 1 : 0].join(','); }
function pasadaPant(P, fb, w, h) {
  const gl = R.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, w, h);
  gl.useProgram(P.p); R.progAct = P; gl.bindVertexArray(R.quad); gl.drawArrays(gl.TRIANGLES, 0, 3);
}
function texEn(u, t) { const gl = R.gl; gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t); }
// la escena va al búfer propio
function postEmpezar() {
  const gl = R.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, PO.fb); gl.viewport(0, 0, PO.w, PO.h);
}
// oclusión ambiental con la profundidad que ya se dibujó (antes de la imagen)
function postAO(cerca, lejos, fovy) {
  const gl = R.gl, A = PO.ao; if (!A.length) return;
  gl.disable(gl.DEPTH_TEST);
  const P = GFX.ao >= 2 ? PO.p.ssao16 : PO.p.ssao8, ty = Math.tan(fovy / 2), asp = PO.w / PO.h;
  gl.useProgram(P.p); texEn(3, PO.prof);
  gl.uniform2f(P.u.uNF, cerca, lejos); gl.uniform2f(P.u.uTan, ty * asp, ty); gl.uniform2f(P.u.uInv, 1 / A[0].w, 1 / A[0].h);
  gl.uniform1f(P.u.uRad, GFX.ao >= 2 ? 0.9 : 0.7); gl.uniform1f(P.u.uInt, GFX.ao >= 2 ? 0.9 : 0.75);
  pasadaPant(P, A[0].f, A[0].w, A[0].h);
  const B = PO.p.aoblur; gl.useProgram(B.p); gl.uniform2f(B.u.uNF, cerca, lejos); texEn(3, PO.prof);
  texEn(0, A[0].t); gl.uniform2f(B.u.uDir, 1 / A[0].w, 0); pasadaPant(B, A[1].f, A[1].w, A[1].h);
  texEn(0, A[1].t); gl.uniform2f(B.u.uDir, 0, 1 / A[0].h); pasadaPant(B, A[0].f, A[0].w, A[0].h);
  texEn(7, A[0].t); texEn(0, null); texEn(3, null);
  gl.enable(gl.DEPTH_TEST);
  R.aoActivo = true;
  postEmpezar();
}
// del búfer de la escena a la pantalla
function postTerminar() {
  const gl = R.gl, W = PO.w, H = PO.h;
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(false);
  // resplandor
  const BL = PO.bl;
  if (BL.length) {
    let P = PO.p.brillo; gl.useProgram(P.p); texEn(0, PO.col); gl.uniform2f(P.u.uInv, 0.5 / W, 0.5 / H); gl.uniform1f(P.u.uUmb, 1.0);
    pasadaPant(P, BL[0].f, BL[0].w, BL[0].h);
    P = PO.p.baja; gl.useProgram(P.p);
    for (let i = 1; i < BL.length; i++) { texEn(0, BL[i - 1].t); gl.uniform2f(P.u.uInv, 1 / BL[i - 1].w, 1 / BL[i - 1].h); pasadaPant(P, BL[i].f, BL[i].w, BL[i].h); }
    P = PO.p.sube; gl.useProgram(P.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = BL.length - 1; i > 0; i--) { texEn(0, BL[i].t); gl.uniform2f(P.u.uInv, 0.5 / BL[i].w, 0.5 / BL[i].h); pasadaPant(P, BL[i - 1].f, BL[i - 1].w, BL[i - 1].h); }
    gl.disable(gl.BLEND);
  }
  // rayos de sol
  let rayo = 0;
  if (PO.ray.length && R.sol.y > -0.05 && !R.noche) {
    const s = R.sol, vp = R.vpMundo, x = vp[0] * s.x + vp[4] * s.y + vp[8] * s.z, y = vp[1] * s.x + vp[5] * s.y + vp[9] * s.z, w = vp[3] * s.x + vp[7] * s.y + vp[11] * s.z;
    if (w > 0) {
      const su = x / w * 0.5 + 0.5, sv = y / w * 0.5 + 0.5, fuera = Math.max(0, Math.abs(su - 0.5) - 0.5, Math.abs(sv - 0.5) - 0.5);
      rayo = clamp(1 - fuera * 2.5, 0, 1) * clamp(vdot(R.camF, s) * 2, 0, 1) * 0.55;
      if (rayo > 0.01) {
        let P = PO.p.raymask; gl.useProgram(P.p); texEn(0, PO.col); texEn(3, PO.prof); gl.uniform2f(P.u.uSolUV, su, sv); gl.uniform2f(P.u.uAsp, PO.w / PO.h, 1);
        pasadaPant(P, PO.ray[0].f, PO.ray[0].w, PO.ray[0].h);
        P = PO.p.rayos; gl.useProgram(P.p); texEn(0, PO.ray[0].t); gl.uniform2f(P.u.uSolUV, su, sv); gl.uniform1f(P.u.uDec, 0.975);
        pasadaPant(P, PO.ray[1].f, PO.ray[1].w, PO.ray[1].h);
      }
    }
  }
  // tono, viñeta y (si hay) FXAA
  const P = PO.p.final; gl.useProgram(P.p);
  texEn(0, PO.col); texEn(1, BL.length ? BL[0].t : null); texEn(2, rayo > 0.01 ? PO.ray[1].t : null);
  gl.uniform1f(P.u.uExpo, R.expo); gl.uniform1f(P.u.uBloom, BL.length ? (GFX.bloom >= 2 ? 0.07 : 0.055) : 0); gl.uniform1f(P.u.uRayo, rayo); gl.uniform1f(P.u.uVin, 0.32); gl.uniform1f(P.u.uHdr, PO.hdr ? 1 : 0);
  gl.uniform2f(P.u.uInv, 1 / W, 1 / H);
  if (PO.ldr) {
    pasadaPant(P, PO.ldr.f, W, H);
    const F = PO.p.fxaa; gl.useProgram(F.p); texEn(0, PO.ldr.t); gl.uniform2f(F.u.uInv, 1 / W, 1 / H);
    pasadaPant(F, null, W, H);
  } else pasadaPant(P, null, W, H);
  for (let i = 0; i < 4; i++) texEn(i, null);
  gl.activeTexture(gl.TEXTURE0); gl.bindVertexArray(null);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
  R.progAct = null; R.texAct = null; R.vaoAct = null;
}
