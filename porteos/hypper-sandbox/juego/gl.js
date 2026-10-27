// ---------------------------------------------------------------------------------------------------------
// dibujo: WebGL2. Todo lo que hay que dibujar en el cuadro se junta primero en una lista (malla, material,
// matriz, huesos y su esfera en el mundo) y después se usa varias veces: sombras del sol, profundidad
// (para la oclusión ambiental) y la imagen. Shaders armados por calidad:
//   luz 0: el de antes (difuso en gamma, para teléfonos muy flojos)
//   luz 1: difuso + brillo suave (gamma)
//   luz 2: luz física (GGX), reflejos del cielo, luz lineal con ACES, sombras, luces puntuales
//   luz 3: + relieve sacado de la textura, niebla con el sol, hojas que dejan pasar la luz
// Mallas y texturas se suben recién cuando se usan.
// ---------------------------------------------------------------------------------------------------------
const R = { gl: null, cv: null, progs: new Map(), prog: {}, mallas: [], tex: [], mats: [], items: [], nItems: 0, cola: [], colaT: [], vp: new Float32Array(16), view: null, proj: null,
  camPos: v3(), camF: v3(0, 0, -1), sol: v3(0.4, 0.8, 0.3).norm(), solCol: [1, 0.96, 0.84], ambS: [0.55, 0.62, 0.72], ambG: [0.3, 0.27, 0.22],
  niebla: { c: [0.8, 0.85, 0.9], a: 150, b: 600 }, cielo: null, escala: 1, dibujadas: 0, tris: 0, marca: 1, salida: 'gam', luces: [], fase: '', expo: 1,
  aoTex: null, conAO: false, lin: null };
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
const srgb = (c) => Math.pow(c, 2.2);
const srgb3 = (a) => [srgb(a[0]), srgb(a[1]), srgb(a[2])];

// ---------------- shaders ----------------
const VS = `
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec2 aU;
#ifdef SKIN
layout(location=3) in vec4 aJ; layout(location=4) in vec4 aW;
uniform vec4 uB[168];
#endif
uniform mat4 uVP, uM; uniform vec3 uQ0, uQ1; uniform vec4 uST;
out vec2 vU;
#ifndef DEPTH
out vec3 vN; out vec3 vW;
#endif
invariant gl_Position;
void main(){
  vec3 p = uQ0 + aP * uQ1;
#ifndef DEPTH
  vec3 n = aN;
#endif
#ifdef SKIN
  vec4 r0 = vec4(0.0), r1 = vec4(0.0), r2 = vec4(0.0);
  for (int k = 0; k < 4; k++) { int j = int(aJ[k]) * 3; float w = aW[k]; r0 += uB[j] * w; r1 += uB[j + 1] * w; r2 += uB[j + 2] * w; }
  vec4 q = vec4(p, 1.0); p = vec3(dot(r0, q), dot(r1, q), dot(r2, q));
#ifndef DEPTH
  n = vec3(dot(r0.xyz, n), dot(r1.xyz, n), dot(r2.xyz, n));
#endif
#endif
  vec4 w = uM * vec4(p, 1.0);
  vU = aU * uST.xy + uST.zw;
#ifndef DEPTH
  vW = w.xyz; vN = mat3(uM) * n;
#endif
  gl_Position = uVP * w;
}`;
// sólo profundidad (sombras y pasada previa): recorte por transparencia si hace falta
const FS_DEPTH = `
precision mediump float;
in vec2 vU; uniform sampler2D uT; uniform vec4 uC; out vec4 o;
void main(){
#ifdef CUT
  if (texture(uT, vU).a * uC.a < 0.5) discard;
#endif
  o = vec4(1.0);
}`;
const FS = `
#if LUZ >= 2
precision highp float;
#else
precision mediump float;
#endif
in vec3 vN; in vec2 vU; in vec3 vW;
uniform sampler2D uT;
#ifdef TERR
uniform sampler2D uT1, uT2, uT3; uniform vec4 uS1; uniform vec2 uS3;
#endif
uniform vec4 uC; uniform vec3 uSol, uSolC, uAmbS, uAmbG, uNieC, uCam, uEm; uniform vec2 uNie; uniform float uCorte;
#if LUZ >= 1
uniform vec3 uMat;
#endif
#if LUZ >= 2
uniform vec3 uTop, uMid, uBot; uniform vec2 uExp; uniform float uExpo, uCieloK;
#endif
#if SOMBRA > 0
uniform highp sampler2DShadow uSM;
#ifdef PCSS
uniform highp sampler2D uSMd;
#endif
uniform mat4 uSMm[SOMBRA]; uniform vec4 uSMr[SOMBRA]; uniform vec4 uSMk[SOMBRA]; uniform float uSMc[SOMBRA]; uniform vec3 uCamF; uniform float uSMon;
#endif
#if NLUZ > 0
uniform vec4 uLP[NLUZ], uLC[NLUZ], uLD[NLUZ]; uniform int uLN;
#endif
#ifdef AO
uniform sampler2D uAO; uniform vec2 uAOinv; uniform float uAOon;
#endif
out vec4 o;
const float PI = 3.14159265;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
#if LUZ >= 2
vec3 aces(vec3 x) { return clamp(x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 cieloCol(vec3 d) { float y = d.y; vec3 c = y > 0.0 ? mix(uMid, uTop, pow(y, uExp.x)) : mix(uMid, uBot, pow(-y, uExp.y)); return pow(c, vec3(2.2)) * uCieloK; }
// luz directa: difuso (sin /PI, como Unity) + especular GGX con visibilidad Smith-Schlick
vec3 brdf(vec3 n, vec3 v, vec3 l, vec3 dif, vec3 f0, float a) {
  float nl = dot(n, l); if (nl <= 0.0) return vec3(0.0);
  vec3 h = normalize(l + v); float nh = max(dot(n, h), 0.0), nv = max(dot(n, v), 1e-3), lh = max(dot(l, h), 0.0);
  float a2 = a * a, d = nh * nh * (a2 - 1.0) + 1.0, D = a2 / (PI * d * d);
  float k = a * 0.5, V = 0.25 / ((nl * (1.0 - k) + k) * (nv * (1.0 - k) + k));
  vec3 F = f0 + (1.0 - f0) * pow(1.0 - lh, 5.0);
  return (dif * (1.0 - F) + min(D * V, 40.0) * F * PI) * nl;
}
#endif
#if SOMBRA > 0
const vec3 PCF9[9] = vec3[9](vec3(0.0, 0.0, 2.0), vec3(-1.0, -1.0, 0.5), vec3(0.0, -1.0, 1.0), vec3(1.0, -1.0, 0.5), vec3(-1.0, 0.0, 1.0), vec3(1.0, 0.0, 1.0), vec3(-1.0, 1.0, 0.5), vec3(0.0, 1.0, 1.0), vec3(1.0, 1.0, 0.5));
float smTap(vec3 c, vec4 r) { return textureLod(uSM, vec3(clamp(c.xy, r.xy, r.zw), c.z), 0.0); }
#ifdef PCSS
const vec2 POI[16] = vec2[16](vec2(-0.94201624, -0.39906216), vec2(0.94558609, -0.76890725), vec2(-0.094184101, -0.92938870), vec2(0.34495938, 0.29387760),
  vec2(-0.91588581, 0.45771432), vec2(-0.81544232, -0.87912464), vec2(-0.38277543, 0.27676845), vec2(0.97484398, 0.75648379), vec2(0.44323325, -0.97511554),
  vec2(0.53742981, -0.47373420), vec2(-0.26496911, -0.41893023), vec2(0.79197514, 0.19090188), vec2(-0.24188840, 0.99706507), vec2(-0.81409955, 0.91437590),
  vec2(0.19984126, 0.78641367), vec2(0.14383161, -0.14100790));
#endif
float sombraCasc(int i, vec3 n, float nl) {
  vec4 k = uSMk[i], r = uSMr[i];
  vec3 c = (uSMm[i] * vec4(vW + n * k.w * (1.6 - nl), 1.0)).xyz;
  if (c.z >= 1.0) return 1.0;
#if defined(PCSS)
  float a = ign(gl_FragCoord.xy) * 6.2831853; mat2 rot = mat2(cos(a), sin(a), -sin(a), cos(a));
  float busca = k.x * 0.9, sz = 0.0, nb = 0.0;
  for (int j = 0; j < 8; j++) {
    float z = textureLod(uSMd, clamp(c.xy + rot * POI[j * 2] * busca, r.xy, r.zw), 0.0).r;
    if (z < c.z - 0.0004) { sz += z; nb += 1.0; }
  }
  if (nb < 0.5) return 1.0;
  float pen = (c.z - sz / nb) * k.y * 0.03;                 // metros de penumbra (sol algo más grande que el real: más suave)
  float rad = clamp(pen * k.x, k.z * 1.2, k.z * 14.0);
  float s = 0.0; for (int j = 0; j < 16; j++) s += smTap(vec3(c.xy + rot * POI[j] * rad, c.z), r);
  return s / 16.0;
#elif PCF == 9
  float s = 0.0;
  for (int j = 0; j < 9; j++) s += smTap(vec3(c.xy + PCF9[j].xy * k.z * 1.25, c.z), r) * PCF9[j].z;
  return s / 8.0;
#else
  return smTap(c, r);
#endif
}
float sombra(vec3 n, float nl) {
  if (uSMon < 0.5) return 1.0;
  float d = dot(vW - uCam, uCamF), fin = uSMc[SOMBRA - 1];
  if (d > fin) return 1.0;
  int i = 0;
  for (int k = 0; k < SOMBRA - 1; k++) if (d > uSMc[k]) i = k + 1;
  float s = sombraCasc(i, n, nl);
#if SOMBRA > 1
  // mezcla suave con la cascada siguiente cerca del corte
  if (i < SOMBRA - 1) { float c0 = uSMc[i], b = c0 * 0.12, t = smoothstep(c0 - b, c0, d); if (t > 0.0) s = mix(s, sombraCasc(i + 1, n, nl), t); }
#endif
  return mix(s, 1.0, smoothstep(fin * 0.82, fin, d));
}
#endif
#ifdef DET
// relieve con la textura (sin mapa de normales): gradiente de la luminancia sobre la superficie
vec3 relieve(vec3 n, float h, float k) {
  vec3 dx = dFdx(vW), dy = dFdy(vW); float hx = dFdx(h), hy = dFdy(h);
  vec3 r1 = cross(dy, n), r2 = cross(n, dx); float det = dot(dx, r1);
  vec3 g = sign(det) * (hx * r1 + hy * r2);
  return normalize(abs(det) * n - k * g);
}
#endif
void main(){
#ifdef TERR
  vec4 kc = texture(uT, vU);
  vec4 t = vec4(texture(uT1, vU * uS1.xy).rgb * kc.r + texture(uT2, vU * uS1.zw).rgb * kc.g + texture(uT3, vU * uS3).rgb * kc.b, 1.0);
#else
  vec4 t = texture(uT, vU);
#endif
  t *= uC;
#ifdef CUT
  if (t.a < uCorte) discard;
#endif
#ifdef UNLIT
#if LUZ >= 2
  vec3 col = pow(t.rgb, vec3(2.2)) * 1.4;
#else
  vec3 col = t.rgb;
#endif
#elif LUZ >= 2
  vec3 alb = pow(t.rgb, vec3(2.2));
  vec3 ng = normalize(vN); if (!gl_FrontFacing) ng = -ng;
  vec3 n = ng;
#ifdef FOL
  n = normalize(mix(n, vec3(0.0, 1.0, 0.0), 0.55));
#endif
#ifdef DET
  n = relieve(n, dot(t.rgb, vec3(0.3, 0.59, 0.11)), 0.012);
#endif
  vec3 v = normalize(uCam - vW);
  float rough = uMat.x, metal = uMat.y, a = max(rough * rough, 0.004);
  vec3 dif = alb * (1.0 - metal), f0 = mix(vec3(uMat.z), alb, metal);
  float nl = dot(n, uSol);
#if SOMBRA > 0
  float sh = nl > 0.0 ? sombra(ng, max(nl, 0.0)) : 0.0;
#else
  float sh = 1.0;
#endif
  vec3 col = brdf(n, v, uSol, dif, f0, a) * uSolC * sh;
#ifdef VERSOMBRA
  float shDbg = sh;
#endif
#ifdef FOL
  col += dif * uSolC * pow(max(dot(-v, uSol), 0.0), 4.0) * 0.6 * sh;   // luz que atraviesa las hojas
#endif
#if NLUZ > 0
  for (int i = 0; i < NLUZ; i++) {
    if (i >= uLN) break;
    vec3 L = uLP[i].xyz - vW; float d2 = dot(L, L), r = uLP[i].w;
    if (d2 > r * r) continue;
    float d = sqrt(d2); L /= d;
    float at = pow(clamp(1.0 - pow(d / r, 4.0), 0.0, 1.0), 2.0) / (d2 + 1.0);
    if (uLD[i].w > -1.0) at *= smoothstep(uLD[i].w, uLD[i].w + 0.08, dot(-L, uLD[i].xyz));
    col += brdf(n, v, L, dif, f0, max(a, 0.05)) * uLC[i].rgb * at;
  }
#endif
  // luz del cielo: difusa (hemisferio) y reflejo (el cielo en la dirección reflejada, más borroso cuanto más áspero)
  float ao = 1.0;
#ifdef AO
  if (uAOon > 0.5) ao = texture(uAO, gl_FragCoord.xy * uAOinv).r;
#endif
  vec3 amb = mix(uAmbG, uAmbS, n.y * 0.5 + 0.5);
  vec3 rf = reflect(-v, n);
  float nv = max(dot(n, v), 1e-3);
  vec3 env = mix(cieloCol(rf), amb, clamp(rough * 1.15, 0.0, 1.0));
  float hor = clamp(1.0 + 1.3 * dot(rf, ng), 0.0, 1.0); env *= hor * hor;
  vec3 Fr = f0 + (max(vec3(1.0 - rough), f0) - f0) * pow(1.0 - nv, 5.0);
  col += (dif * amb + env * Fr * mix(1.0, sh * 0.6 + 0.4, metal)) * ao + uEm * 1.6;
#elif LUZ == 1
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  float d = max(dot(n, uSol), 0.0);
  vec3 v = normalize(uCam - vW), h = normalize(uSol + v);
  float sp = pow(max(dot(n, h), 0.0), mix(8.0, 64.0, 1.0 - uMat.x)) * (1.0 - uMat.x) * 0.35 * d;
  vec3 amb = mix(uAmbG, uAmbS, n.y * 0.5 + 0.5);
  vec3 col = t.rgb * (amb + uSolC * d) + uSolC * sp + uEm;
#else
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  float d = max(dot(n, uSol), 0.0);
  vec3 amb = mix(uAmbG, uAmbS, n.y * 0.5 + 0.5);
  vec3 col = t.rgb * (amb + uSolC * d) + uEm;
#endif
  float dist = distance(vW, uCam);
  float f = clamp((dist - uNie.x) / (uNie.y - uNie.x), 0.0, 1.0);
#if LUZ >= 3
  vec3 vd = (vW - uCam) / dist;
  vec3 nc = uNieC + uSolC * pow(max(dot(vd, uSol), 0.0), 6.0) * 0.35;
  f = 1.0 - (1.0 - f) * exp(-max(0.0, dist - 20.0) * 0.0006 * exp(-max(vW.y - uCam.y + 5.0, 0.0) * 0.02));
  col = mix(col, nc, f);
#else
  col = mix(col, uNieC, f);
#endif
#if SALIDA == 2
  o = vec4(col, t.a);
#if defined(VERSOMBRA) && LUZ >= 2 && !defined(UNLIT)
  o = vec4(vec3(shDbg), 1.0) + vec4(col, 0.0) * 0.0001;
#endif
#elif SALIDA == 1
  col = pow(aces(col * uExpo), vec3(1.0 / 2.2));
  o = vec4(col + (ign(gl_FragCoord.xy) - 0.5) / 255.0, t.a);
#else
  o = vec4(col, t.a);
#endif
}`;
const VS_CIELO = `
layout(location=0) in vec2 aP; uniform mat4 uIVP; out vec3 vD;
void main(){ vec4 a = uIVP * vec4(aP, 1.0, 1.0); vD = a.xyz / a.w; gl_Position = vec4(aP, 0.99999, 1.0); }`;
const FS_CIELO = `
precision highp float; in vec3 vD; uniform vec3 uTop, uMid, uBot, uSol, uSolC, uCam, uLuna; uniform vec2 uExp; uniform float uExpo, uTiempo, uNoche, uNubes, uSolTam, uCieloK; out vec4 o;
vec3 aces(vec3 x) { return clamp(x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vD - uCam); float y = d.y;
  vec3 c = y > 0.0 ? mix(uMid, uTop, pow(y, uExp.x)) : mix(uMid, uBot, pow(-y, uExp.y));
  float s = max(dot(d, uSol), 0.0);
#if SALIDA == 0
  c += uSolC * (pow(s, 900.0) * 1.2 + pow(s, 12.0) * 0.12);
  o = vec4(c, 1.0);
#else
  c = pow(c, vec3(2.2)) * uCieloK;                                          // el degradé del juego (en gamma) pasado a lineal
  c += uSolC * pow(s, 8.0) * 0.18 * (1.0 - abs(y));                       // brillo del horizonte hacia el sol
  float disco = smoothstep(1.0 - uSolTam, 1.0 - uSolTam * 0.6, s);
  c += uSolC * (disco * 40.0 + pow(s, 1200.0) * 3.0 + pow(s, 40.0) * 0.25) * step(-0.02, y) * (1.0 - uNoche);
#ifdef NUBES
  if (y > 0.0) {
    vec2 p = d.xz / (y + 0.12) * 0.55 + uTiempo * vec2(0.004, 0.0015);
    float n = fbm(p * 1.6), cov = smoothstep(0.62 - uNubes * 0.3, 0.92, n) * smoothstep(0.0, 0.18, y);
    float lado = pow(s, 6.0);
    vec3 nc = mix(uMid * 0.85 + uSolC * 0.12, uSolC * 1.25 + uMid * 0.3, 0.35 + 0.65 * lado) * (1.0 - uNoche * 0.85);
    c = mix(c, nc, cov * 0.9);
  }
#endif
  if (uNoche > 0.0 && y > 0.0) {
    vec2 st = d.xz / (y + 0.3) * 160.0; float e = h21(floor(st));
    c += vec3(0.8, 0.85, 1.0) * step(0.9975, e) * smoothstep(0.0, 0.25, y) * uNoche * (0.6 + 0.4 * sin(uTiempo * 3.0 + e * 60.0)) * 1.5;
    float l = max(dot(d, uLuna), 0.0);
    c += vec3(0.85, 0.88, 1.0) * (smoothstep(0.9993, 0.9995, l) * 6.0 + pow(l, 60.0) * 0.08) * uNoche;
  }
#if SALIDA == 2
  o = vec4(c, 1.0);
#else
  o = vec4(pow(aces(c * uExpo), vec3(1.0 / 2.2)), 1.0);
#endif
#endif
}`;
// líneas, rayos y partículas (sin luz, color por vértice)
const VS_LIN = `
layout(location=0) in vec3 aP; layout(location=1) in vec4 aC; uniform mat4 uVP; out vec4 vC; void main(){ vC = aC; gl_Position = uVP * vec4(aP, 1.0); gl_PointSize = 6.0; }`;
const FS_LIN = `
precision mediump float; in vec4 vC; uniform float uLin; out vec4 o; void main(){ o = vC; if (uLin > 0.5) o.rgb = pow(o.rgb, vec3(2.2)) * 2.0; }`;

function shader(vs, fs, defs) {
  const gl = R.gl, pre = '#version 300 es\n' + (defs || []).map((d) => '#define ' + d.replace('=', ' ') + '\n').join('');
  const mk = (t, src) => {
    const s = gl.createShader(t); gl.shaderSource(s, src.startsWith('#version') ? src.replace('\n', '\n' + pre.slice(16)) : pre + src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + (defs || []).join(' '));
    return s;
  };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i), nm = a.name.replace('[0]', ''); u[nm] = gl.getUniformLocation(p, a.name); }
  gl.useProgram(p);
  for (const [k, v] of [['uT', 0], ['uT1', 1], ['uT2', 2], ['uT3', 3], ['uSM', 5], ['uSMd', 6], ['uAO', 7], ['uTex', 0], ['uTex2', 1], ['uTex3', 2], ['uProf', 3]]) if (u[k]) gl.uniform1i(u[k], v);
  return { p, u, marca: 0 };
}
// programa según el material y la calidad (se compila la primera vez que se usa)
function progDe(clave, modo) {
  const k = modo + '|' + clave + '|' + R.salida + '|' + (R.sombraOn ? SM.n : 0) + (R.conAO ? 'a' : '');
  let P = R.progs.get(k); if (P) return P;
  const f = clave.split(','), Q = GFX, d = [];
  for (const x of f) if (x) d.push(x);
  if (modo === 'depth') { d.push('DEPTH'); P = shader(VS, FS_DEPTH, d.filter((x) => x === 'SKIN' || x === 'CUT' || x === 'DEPTH')); }
  else {
    const luz = R.salida === 'gam' ? Math.min(1, Q.luz || 0) : Math.max(2, Q.luz || 2);
    d.push('LUZ=' + luz, 'SALIDA=' + (R.salida === 'hdr' ? 2 : R.salida === 'ldr' ? 1 : 0));
    if (luz >= 2 && R.sombraOn && Q.sombra > 0) { d.push('SOMBRA=' + SM.n, 'PCF=' + (Q.pcf || 1)); if (Q.pcss) d.push('PCSS'); } else d.push('SOMBRA=0');
    if (luz >= 2 && Q.nluz > 0) d.push('NLUZ=' + Q.nluz); else d.push('NLUZ=0');
    if (luz >= 2 && R.conAO) d.push('AO');
    if (luz >= 3 && Q.det && !f.includes('SKIN') && !f.includes('TERR')) d.push('DET');
    if (DBG.verSombra) d.push('VERSOMBRA');
    P = shader(VS, FS, d);
  }
  R.progs.set(k, P); return P;
}
function progsLimpiar() { const gl = R.gl; for (const P of R.progs.values()) gl.deleteProgram(P.p); R.progs.clear(); }
function glIniciar() {
  const cv = $('cv'); R.cv = cv;
  const gl = cv.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: TEST });
  if (!gl) throw new Error('webgl2');
  R.gl = gl;
  R.extFloat = gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  R.prog.cieloG = shader(VS_CIELO, FS_CIELO, ['SALIDA=0']);
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
    if (R.aniso && GFX.aniso) gl.texParameterf(gl.TEXTURE_2D, R.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(GFX.aniso, R.anisoMax || 16));
    t.gl = tx; img.close && img.close();
  }).catch(() => { t.gl = R.texGris; });
  return R.texGris;
}
// cambiar la calidad de textura: se borran y se vuelven a subir con el tamaño nuevo cuando se usan
function texturasRecargar() { const gl = R.gl; for (const t of R.tex) if (t && t.gl && t.gl !== R.texGris) gl.deleteTexture(t.gl); R.tex = []; }
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
  m = R.mallas[i] = { vao, d, it: d.i32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, isz: d.i32 ? 4 : 2, c, r, skin: d.sk !== undefined, idx: i };
  return m;
}
// ---------------- materiales ----------------
const SH_BLEND = /Transparent|Particles|Fade/;
// cómo brilla cada material (los del juego son casi todos difusos: áspero/metal/reflejo según de qué es)
function pbrDe(nombre) {
  const s = (nombre || '').toLowerCase();
  if (/glass|lens|transp|windows|window|screen|tv|monitor/.test(s)) return [0.06, 0, 0.06];
  if (/rubber|wheel|tire|^w4$|luggage_cart_wheels/.test(s)) return [0.88, 0, 0.03];
  if (/^body|bodyv\d|caterham|4carz|copter|aircraft|police_car|inflatable|^engine|bike2/.test(s)) return [0.32, 0.25, 0.05];
  if (/akm|akcolor|smg|sniper|shotgun|pistol|revolver|rocketlauncher|crossbow|gravtool|matter|scope|armcolor|bat|melee/.test(s)) return [0.5, 0.3, 0.04];
  if (/metal|rail|catwalk|container|fence|support|rocket|scifi|generator|oxygen|barrel|fireext|fridge|battery|spotlight|lamp|traffic|gaspump|utility|wallpanel|vending|manhole|structure|wire_|laser|jumpgate|sink|gs_box/.test(s)) return [0.45, 0.45, 0.04];
  if (/hair/.test(s)) return [0.5, 0, 0.04];
  if (/eye|teeth|lashes/.test(s)) return [0.25, 0, 0.04];
  if (/head|body|suit|shoes|_top|bottom|di_|soldier|prisoner|pilot|engineer|corpse|hat|hands|gloves|zombie|wonamman|delovoy|special|arms|mask/.test(s)) return [0.66, 0, 0.035];
  if (/road|asphalt|concrete|sidewalk|cordon|parking|rooftop|terrain|desert|grass|rock|sand|ground|floor|wall|brick|roof|bridge|city|pixelactive|warehouse|tile|ceiling/.test(s)) return [0.9, 0, 0.03];
  if (/wood|plank|log|chair|bench|table|desk|book|door|platform|frames|meuble|chevet|sieges|petitbureau|crate|box|carton/.test(s)) return [0.78, 0, 0.035];
  return [0.72, 0, 0.04];
}
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
  if (/Grass/.test(sh)) { m.cut = true; m.blend = false; m.fol = true; }
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
  if (/leaf|leafs|bush|grass/i.test(d.n || '') && (m.cut || m.unlit)) m.fol = true;
  m.pbr = pbrDe(d.n);
  m.lampara = /^(Lamp_color|GS_Lamp_color|lampes|light|abatjour|Spotlight|LampOffice)$/i.test(d.n || '');
  if (sh === 'Standard' && f._Glossiness !== undefined) { m.pbr = [clamp(1 - f._Glossiness, 0.05, 1), f._Metallic || 0, 0.04]; }
  // la hierba "sin luz" del juego en las calidades altas recibe luz y sombra como follaje
  m.claveBase = (m.terr ? 'TERR' : '') + ',' + (m.cut ? 'CUT' : '') + ',' + (m.unlit && !m.fol ? 'UNLIT' : '') + ',' + (m.fol ? 'FOL' : '');
  m.claveGam = (m.terr ? 'TERR' : '') + ',' + (m.cut ? 'CUT' : '') + ',' + (m.unlit ? 'UNLIT' : '');
  m.sombra = !m.blend && !m.add && !m.oculto;
  return (R.mats[i] = m);
}
// ---------------- la lista de cosas a dibujar de cada cuadro ----------------
// cada pedido: malla, submalla, material, matriz (o null = identidad), huesos (o null) y su esfera en el mundo
const IDM = M4.id();
function encolar(mi, sub, mat, M, huesos, extra) {
  const m = mallaGL(mi), mt = matGL(mat);
  if (mt.oculto) return;
  const s = m.d.sub[sub]; if (!s) return;
  let p = R.items[R.nItems];
  if (!p) p = R.items[R.nItems] = { m: null, s0: 0, sn: 0, mt: null, M: null, h: null, x: null, z: 0, cx: 0, cy: 0, cz: 0, r: 0, est: false, vista: false };
  R.nItems++;
  p.m = m; p.s0 = s[0]; p.sn = s[1]; p.mt = mt; p.M = M || IDM; p.h = huesos; p.x = extra || null; p.est = R.fase === 'mundo'; p.vista = R.fase === 'vista';
  if (!huesos) {
    // mallas con varias partes (el mapa viene "pegado" en una sola): la esfera de cada parte
    const e = m.d.sub.length > 1 ? esferaSub(m, sub) : null, c = e || m.c, r = e ? e[3] : m.r;
    const Mx = p.M; m4pt(Mx, c[0], c[1], c[2], _vq);
    p.cx = _vq.x; p.cy = _vq.y; p.cz = _vq.z; p.r = r * (Mx === IDM ? 1 : m4esc(Mx));
  } else {
    // con piel: el centro de la malla llevado por cada hueso, promediado (las filas son 3 x vec4 por hueso)
    let x = 0, y = 0, z = 0, n = 0; const c = m.c, H = huesos, nb = Math.min(56, H.length / 12);
    for (let b = 0; b < nb; b += 2) {
      const o = b * 12; if (!H[o] && !H[o + 5]) continue;
      x += H[o] * c[0] + H[o + 1] * c[1] + H[o + 2] * c[2] + H[o + 3]; y += H[o + 4] * c[0] + H[o + 5] * c[1] + H[o + 6] * c[2] + H[o + 7]; z += H[o + 8] * c[0] + H[o + 9] * c[1] + H[o + 10] * c[2] + H[o + 11]; n++;
    }
    if (n) { p.cx = x / n; p.cy = y / n; p.cz = z / n; } p.r = m.r * 1.6;
  }
}
const _vq = v3(), EM_LAMPARA = [2.6, 2.2, 1.5];
function esferaSub(m, sub) {
  if (!m.esf) m.esf = [];
  let e = m.esf[sub]; if (e) return e;
  const mc = mallaCPU(m.idx), P = mc.P, I = mc.I, s = m.d.sub[sub];
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  for (let k = s[0]; k < s[0] + s[1]; k++) {
    const o = I[k] * 3, x = P[o], y = P[o + 1], z = P[o + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  if (x0 > x1) return (m.esf[sub] = [m.c[0], m.c[1], m.c[2], m.r]);
  return (m.esf[sub] = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2]);
}
function itemsLimpiar() { for (let i = 0; i < R.nItems; i++) { const p = R.items[i]; p.M = null; p.h = null; p.x = null; } R.nItems = 0; }
// arma la cola de la cámara: lo que está en el campo visual y a la distancia de dibujo
function armarCola() {
  R.cola.length = 0; R.colaT.length = 0;
  const F = R.fr, cp = R.camPos, lj = R.lejos;
  for (let i = 0; i < R.nItems; i++) {
    const p = R.items[i];
    if (!p.vista) {
      if (!sphereIn(F, p.cx, p.cy, p.cz, p.r)) continue;
      const dx = p.cx - cp.x, dy = p.cy - cp.y, dz = p.cz - cp.z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > (lj + p.r) * (lj + p.r)) continue;
      p.z = -d2;
    }
    if (p.mt.blend) R.colaT.push(p); else R.cola.push(p);
  }
  R.cola.sort(ordenOpaco);
  R.colaT.sort((a, b) => a.z - b.z);
}
const ordenOpaco = (a, b) => (a.mt.claveBase < b.mt.claveBase ? -1 : a.mt.claveBase > b.mt.claveBase ? 1 : (a.m.skin - b.m.skin) || (a.mt === b.mt ? 0 : (a.mt.d.n < b.mt.d.n ? -1 : 1)));
// uniformes del cuadro para un programa (una vez por pasada)
function prepararProg(P) {
  const gl = R.gl;
  if (R.progAct !== P) { R.progAct = P; gl.useProgram(P.p); }
  if (P.marca === R.marca) return P;
  P.marca = R.marca;
  const u = P.u;
  gl.uniformMatrix4fv(u.uVP, false, R.vp);
  if (u.uSol) {
    const L = R.lin && R.salida !== 'gam' ? R.lin : R;
    // el arma en la mano no usa el mapa de sombras (se vería granulado tan cerca): la luz del sol según si la cámara está a la sombra
    const kv = R.fase === 'vista' ? (R.solVista === undefined ? 1 : R.solVista) : 1;
    gl.uniform3f(u.uSol, R.sol.x, R.sol.y, R.sol.z); gl.uniform3f(u.uSolC, L.solCol[0] * kv, L.solCol[1] * kv, L.solCol[2] * kv); gl.uniform3fv(u.uAmbS, L.ambS); gl.uniform3fv(u.uAmbG, L.ambG);
    gl.uniform3fv(u.uNieC, L.nieC || R.niebla.c); gl.uniform2f(u.uNie, R.niebla.a, R.niebla.b); gl.uniform3f(u.uCam, R.camPos.x, R.camPos.y, R.camPos.z);
    if (u.uTop && R.lin) { gl.uniform3fv(u.uTop, R.lin.topG); gl.uniform3fv(u.uMid, R.lin.midG); gl.uniform3fv(u.uBot, R.lin.botG); gl.uniform2fv(u.uExp, R.cielo ? R.cielo.exp : [0.8, 1]); gl.uniform1f(u.uCieloK, R.cieloK || 1); }
    if (u.uExpo) gl.uniform1f(u.uExpo, R.expo);
    if (u.uSMm) { sombrasUniformes(P); if (R.fase === 'vista') gl.uniform1f(u.uSMon, 0); }
    if (u.uLP) lucesUniformes(P);
    if (u.uAO) { gl.uniform2f(u.uAOinv, 1 / R.cv.width, 1 / R.cv.height); gl.uniform1f(u.uAOon, R.aoActivo && R.fase !== 'vista' ? 1 : 0); }
  }
  return P;
}
function dibujarPedido(p, P) {
  const gl = R.gl, mt = p.mt, u = P.u;
  if (R.texAct !== mt) {
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texGL(mt.tex));
    if (mt.terr && u.uS1) {
      const S = mt.terr.t;
      for (let k = 0; k < 3; k++) { gl.activeTexture(gl.TEXTURE1 + k); gl.bindTexture(gl.TEXTURE_2D, texGL(S[k] ? S[k][0] : -1)); }
      gl.uniform4f(u.uS1, S[0] ? S[0][1] : 1, S[0] ? S[0][2] : 1, S[1] ? S[1][1] : 1, S[1] ? S[1][2] : 1); gl.uniform2f(u.uS3, S[2] ? S[2][1] : 1, S[2] ? S[2][2] : 1);
      gl.activeTexture(gl.TEXTURE0);
    }
    R.texAct = mt;
  }
  const c = p.x && p.x.c ? p.x.c : mt.c;
  gl.uniform4f(u.uC, c[0], c[1], c[2], c[3]);
  if (u.uEm) gl.uniform3fv(u.uEm, p.x && p.x.em ? p.x.em : mt.lampara && R.lucesMapa ? EM_LAMPARA : mt.em);
  if (u.uCorte) gl.uniform1f(u.uCorte, 0.5);
  if (u.uMat) gl.uniform3fv(u.uMat, mt.pbr);
  gl.uniform4fv(u.uST, mt.st);
  const d = p.m.d;
  gl.uniform3f(u.uQ0, d.mn[0], d.mn[1], d.mn[2]); gl.uniform3f(u.uQ1, d.sc[0], d.sc[1], d.sc[2]);
  gl.uniformMatrix4fv(u.uM, false, p.M);
  if (p.h) gl.uniform4fv(u.uB, p.h);
  if (R.vaoAct !== p.m.vao) { gl.bindVertexArray(p.m.vao); R.vaoAct = p.m.vao; }
  gl.drawElements(gl.TRIANGLES, p.sn, p.m.it, p.s0 * p.m.isz);
  R.dibujadas++; R.tris += p.sn / 3;
}
function claveDe(p) { return (R.salida === 'gam' ? p.mt.claveGam : p.mt.claveBase) + (p.h ? ',SKIN' : ''); }
function dibujarOpacos() {
  const gl = R.gl;
  R.progAct = null; R.texAct = null; R.vaoAct = null;
  gl.disable(gl.BLEND);
  for (const p of R.cola) {
    const P = prepararProg(progDe(claveDe(p), 'main'));
    if (p.x && p.x.dobleCara) gl.disable(gl.CULL_FACE);
    dibujarPedido(p, P);
    if (p.x && p.x.dobleCara) gl.enable(gl.CULL_FACE);
  }
  R.cola.length = 0;
}
function dibujarTransparentes() {
  const gl = R.gl;
  if (!R.colaT.length) return;
  R.texAct = null;
  gl.enable(gl.BLEND); gl.depthMask(false);
  for (const p of R.colaT) { gl.blendFunc(gl.SRC_ALPHA, p.mt.add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); dibujarPedido(p, prepararProg(progDe(claveDe(p), 'main'))); }
  gl.depthMask(true); gl.disable(gl.BLEND);
  gl.bindVertexArray(null); R.vaoAct = null;
  R.colaT.length = 0;
}
// pasada sólo de profundidad (para la oclusión ambiental; y así la imagen no pinta dos veces el mismo píxel)
function dibujarProfundidad() {
  const gl = R.gl;
  R.progAct = null; R.texAct = null; R.vaoAct = null;
  gl.colorMask(false, false, false, false);
  for (const p of R.cola) {
    const P = prepararProg(progDe((p.mt.cut ? 'CUT' : '') + (p.h ? ',SKIN' : ''), 'depth'));
    if (p.mt.cut) { if (R.texAct !== p.mt) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texGL(p.mt.tex)); R.texAct = p.mt; } gl.uniform4fv(P.u.uC, p.mt.c); }
    gl.uniform4fv(P.u.uST, p.mt.st);
    const d = p.m.d; gl.uniform3f(P.u.uQ0, d.mn[0], d.mn[1], d.mn[2]); gl.uniform3f(P.u.uQ1, d.sc[0], d.sc[1], d.sc[2]);
    gl.uniformMatrix4fv(P.u.uM, false, p.M); if (p.h) gl.uniform4fv(P.u.uB, p.h);
    if (R.vaoAct !== p.m.vao) { gl.bindVertexArray(p.m.vao); R.vaoAct = p.m.vao; }
    if (p.x && p.x.dobleCara) gl.disable(gl.CULL_FACE);
    gl.drawElements(gl.TRIANGLES, p.sn, p.m.it, p.s0 * p.m.isz);
    if (p.x && p.x.dobleCara) gl.enable(gl.CULL_FACE);
  }
  gl.colorMask(true, true, true, true);
  gl.bindVertexArray(null); R.vaoAct = null; R.progAct = null; R.texAct = null;
}
// compatibilidad: arma la cola con lo encolado y lo dibuja todo
function dibujarCola() { armarCola(); dibujarOpacos(); dibujarTransparentes(); itemsLimpiar(); }
function dibujarCielo(IVP) {
  const gl = R.gl, C = R.cielo; if (!C) return;
  let P;
  if (R.salida === 'gam') P = R.prog.cieloG;
  else { const k = 'cielo|' + R.salida + '|' + (GFX.nubes ? 1 : 0); P = R.progs.get(k); if (!P) { P = shader(VS_CIELO, FS_CIELO, ['SALIDA=' + (R.salida === 'hdr' ? 2 : 1)].concat(GFX.nubes ? ['NUBES'] : [])); R.progs.set(k, P); } }
  gl.useProgram(P.p); R.progAct = P;
  const L = R.salida !== 'gam' && R.lin ? R.lin : null;
  gl.uniformMatrix4fv(P.u.uIVP, false, IVP);
  gl.uniform3fv(P.u.uTop, C.top); gl.uniform3fv(P.u.uMid, C.mid); gl.uniform3fv(P.u.uBot, C.bot); gl.uniform2fv(P.u.uExp, C.exp);
  gl.uniform3f(P.u.uSol, R.sol.x, R.sol.y, R.sol.z); gl.uniform3fv(P.u.uSolC, L ? L.cieloSol : C.sol); gl.uniform3f(P.u.uCam, R.camPos.x, R.camPos.y, R.camPos.z);
  if (R.salida !== 'gam') {
    gl.uniform1f(P.u.uExpo, R.expo); gl.uniform1f(P.u.uTiempo, TIEMPO.t); gl.uniform1f(P.u.uCieloK, R.cieloK || 1); gl.uniform1f(P.u.uNoche, R.noche || 0); gl.uniform1f(P.u.uNubes, R.nubes === undefined ? 0.5 : R.nubes);
    gl.uniform1f(P.u.uSolTam, 0.00012 + (C.solTam || 0.3) * 0.0004);
    const l = R.luna || v3(-R.sol.x, Math.abs(R.sol.y), -R.sol.z); gl.uniform3f(P.u.uLuna, l.x, l.y, l.z);
  }
  gl.depthMask(false); gl.depthFunc(gl.LEQUAL); gl.bindVertexArray(R.quad); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null); gl.depthMask(true); gl.depthFunc(gl.LESS);
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
  const gl = R.gl, P = R.prog.lin; gl.useProgram(P.p); R.progAct = P; gl.uniformMatrix4fv(P.u.uVP, false, R.vp); gl.uniform1f(P.u.uLin, R.salida === 'hdr' ? 1 : 0);
  gl.bindVertexArray(R.linVao); gl.bindBuffer(gl.ARRAY_BUFFER, R.linBuf); gl.bufferData(gl.ARRAY_BUFFER, LIN.v.subarray(0, LIN.n * 7), gl.STREAM_DRAW);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.LINES, 0, LIN.n); gl.disable(gl.BLEND); gl.bindVertexArray(null); LIN.n = 0;
}
// ---------------- luces puntuales y focos (lámparas, faros, fogonazos, explosiones) ----------------
// cada cuadro se juntan y se mandan las más cercanas a la cámara
const LUZ_P = new Float32Array(32), LUZ_C = new Float32Array(32), LUZ_D = new Float32Array(32);
function luzPuntual(p, radio, col, dir, cono) { R.luces.push({ p, r: radio, c: col, d: dir || null, k: cono === undefined ? -2 : cono }); }
function lucesPreparar() {
  const L = R.luces, n = Math.min(GFX.nluz || 0, 8), cp = R.camPos;
  if (L.length > n) L.sort((a, b) => a.p.distTo(cp) / a.r - b.p.distTo(cp) / b.r);
  R.nLuces = Math.min(n, L.length);
  for (let i = 0; i < R.nLuces; i++) {
    const l = L[i], o = i * 4, k = R.salida === 'gam' ? 1 : 1;
    LUZ_P[o] = l.p.x; LUZ_P[o + 1] = l.p.y; LUZ_P[o + 2] = l.p.z; LUZ_P[o + 3] = l.r;
    LUZ_C[o] = l.c[0] * k; LUZ_C[o + 1] = l.c[1] * k; LUZ_C[o + 2] = l.c[2] * k; LUZ_C[o + 3] = 0;
    if (l.d) { LUZ_D[o] = l.d.x; LUZ_D[o + 1] = l.d.y; LUZ_D[o + 2] = l.d.z; LUZ_D[o + 3] = l.k; } else { LUZ_D[o] = 0; LUZ_D[o + 1] = -1; LUZ_D[o + 2] = 0; LUZ_D[o + 3] = -2; }
  }
}
function lucesUniformes(P) {
  const gl = R.gl, n = GFX.nluz || 0; if (!n) return;
  gl.uniform4fv(P.u.uLP, LUZ_P, 0, n * 4); gl.uniform4fv(P.u.uLC, LUZ_C, 0, n * 4); gl.uniform4fv(P.u.uLD, LUZ_D, 0, n * 4); gl.uniform1i(P.u.uLN, R.nLuces || 0);
}
// colores del cielo y la luz pasados a lineal (para las calidades con luz física)
function luzLineal() {
  const C = R.cielo; if (!C) return;
  const k = R.lin || (R.lin = {});
  k.top = srgb3(C.top); k.mid = srgb3(C.mid); k.bot = srgb3(C.bot); k.topG = C.top; k.midG = C.mid; k.botG = C.bot;
  k.solCol = srgb3(R.solCol).map((x) => x * 2.6); k.cieloSol = srgb3(C.sol).map((x) => x * 1.2);
  // luz del cielo menos saturada (el gris de las nubes y el rebote del suelo la aclaran)
  const des = (a, t) => { const l = a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11; return a.map((x) => l + (x - l) * t); };
  k.ambS = des(srgb3(R.ambS), 0.45).map((x) => x * 1.3); k.ambG = des(srgb3(R.ambG), 0.6).map((x) => x * 1.25);
  k.nieC = srgb3(R.niebla.c);
  R.expo = 0.66 * (R.expoK || 1);
}
