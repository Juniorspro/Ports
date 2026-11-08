// ---------------- la nuclear volumétrica (la del tráiler, en el juego) ----------------
// El hongo del tráiler (herramientas/trailer/cine_motor.js): un volumen con marcha de rayos cuya forma cambia con el tiempo
// desde la detonación —la bola de fuego que sube, el toro que rueda con un domo encima, el tallo que chupa del piso y la
// falda de polvo que corre por el suelo—, con el borde comido por ruido 3D (coliflor), la luz del sol con sombra propia,
// la del cielo y del suelo, y el fuego de adentro que brilla y alumbra el humo. En el juego:
//  · en Medio, Alto y Ultra con WebGL 2 (en Bajo, Patata o WebGL 1 quedan los carteles de nucleares.js);
//  · se dibuja en un búfer chico (un tercio a la mitad de la pantalla, según la calidad) con menos pasos que en el
//    tráiler, y se pega encima de la escena con la profundidad del punto donde el rayo entra al humo (lo de adelante lo tapa);
//  · cada bomba a su escala: el tráiler es una de R ≈ 260 m (≈ 4 Mt); todo se mide en «metros del tráiler» (R / 260) y
//    las grandes van más despacio (el tiempo, con la raíz cúbica del tamaño, más o menos);
//  · en el aire, la bola nace arriba y el tallo sube después; en el agua (y los barcos), blanca; la subterránea y la del
//    espacio siguen con los carteles (no hacen hongo);
//  · el ruido 3D (64³) se arma de a poco cuando se abre la sección de nucleares o se arma una bomba (unos milisegundos
//    por cuadro: no traba); si una explota antes de que esté, va con carteles hasta que esté.
const NUKV = { tex: null, ruido: null, progs: {}, fb: null, tc: null, td: null, w: 0, h: 0, ms: 0, dib: 0, E: null,
  // (la luz y el color del humo: más oscuro y con menos luz del cielo que en el tráiler, que tenía la luz de la tarde)
  solK: 0.9, ambK: 1.6, albH: [0.5, 0.4, 0.35], albT: [0.48, 0.39, 0.32], albF: [0.55, 0.46, 0.38] };
const NV_R0 = 260;
const NV_CAL = {
  medio: { esc: 0.34, pasos: 32, som: 1, bul: 0, pk: 1.6, max: 520 },
  alto: { esc: 0.42, pasos: 48, som: 2, bul: 1, pk: 1.25, max: 680 },
  ultra: { esc: 0.5, pasos: 64, som: 3, bul: 1, pk: 1.0, max: 820 },
};
const NV_TIPOS = { aire: 1, bomba: 1, misil: 1, ficcion: 1, torre: 1, suelo: 1, artilleria: 1, agua: 1, barco: 1 };
// la calidad del hongo (null: carteles)
function nvCalidad() {
  if (R.gl1 || !R.extFloat || R.salida === 'gam' || NUKV.no || (typeof AGUA !== 'undefined' && AGUA.bajo)) return null;
  return GFX.luz >= 3 ? NV_CAL.ultra : GFX.hdr ? NV_CAL.alto : GFX.luz >= 2 ? NV_CAL.medio : null;
}
// (que esté listo cuando haga falta: el ruido y el programa, sin trabar)
function nvPreparar() {
  if (R.gl1 || !R.extFloat) return;
  nvRuidoEmpezar();
  const q = nvCalidad(); if (q) nvProg(q);
}

// ---------------- el ruido 3D (el mismo del tráiler: la misma semilla, el mismo orden) ----------------
function nvRuidoEmpezar() {
  if (NUKV.tex || NUKV.ruido) return;
  const N = 64, n3 = N * N * N;
  let sem = 11; const rnd = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
  const puntos = (f) => { const P = new Float32Array(f * f * f * 3); for (let i = 0; i < P.length; i++) P[i] = rnd(); return P; };
  const grads = (f) => { const G = new Float32Array(f * f * f * 3); for (let i = 0; i < f * f * f; i++) { const a = rnd() * 6.2832, zz = rnd() * 2 - 1, r = Math.sqrt(1 - zz * zz); G[i * 3] = r * Math.cos(a); G[i * 3 + 1] = r * Math.sin(a); G[i * 3 + 2] = zz; } return G; };
  // (en el tráiler cada celular arma sus puntos y cada gradiente sus vectores al empezar, en este orden)
  const C = [4, 8, 16].map((f) => ({ f, P: puntos(f) })), G = [4, 8, 16, 32].map((f) => ({ f, G: grads(f) }));
  NUKV.ruido = { N, z: 0, y: 0, C, G, cel: C.map(() => new Float32Array(n3)), gr: G.map(() => new Float32Array(n3)), mn: [9, 9, 9], mx: [-9, -9, -9] }; NUKV.tRuido0 = performance.now();
  setTimeout(nvRuidoPaso, 0);
}
function nvRuidoPaso() {
  const S = NUKV.ruido; if (!S) return;
  const N = S.N, t0 = performance.now(), w3 = (i, f) => ((i % f) + f) % f, fd = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  // (de a filas de 64: en un celular una capa entera de 64 × 64 tardaba lo de varios cuadros)
  while (S.z < N && performance.now() - t0 < 6) {
    const z = S.z, y = S.y;
    for (let k = 0; k < S.C.length; k++) {
      const { f, P } = S.C[k], o = S.cel[k], kk = f / N;
      for (let x = 0; x < N; x++) {
        const px = (x + 0.5) * kk, py = (y + 0.5) * kk, pz = (z + 0.5) * kk, cx = Math.floor(px), cy = Math.floor(py), cz = Math.floor(pz);
        let m = 9;
        for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const ix = cx + dx, iy = cy + dy, iz = cz + dz, j = ((w3(iz, f) * f + w3(iy, f)) * f + w3(ix, f)) * 3;
          const ex = ix + P[j] - px, ey = iy + P[j + 1] - py, ez = iz + P[j + 2] - pz, d = ex * ex + ey * ey + ez * ez;
          if (d < m) m = d;
        }
        const v = 1 - m; o[(z * N + y) * N + x] = v; if (v < S.mn[k]) S.mn[k] = v; if (v > S.mx[k]) S.mx[k] = v;
      }
    }
    for (let k = 0; k < S.G.length; k++) {
      const { f, G } = S.G[k], o = S.gr[k], kk = f / N;
      const g = (ix, iy, iz, x, yy, zz) => { const j = ((w3(iz, f) * f + w3(iy, f)) * f + w3(ix, f)) * 3; return G[j] * x + G[j + 1] * yy + G[j + 2] * zz; };
      for (let xx = 0; xx < N; xx++) {
        const px = (xx + 0.5) * kk, py = (y + 0.5) * kk, pz = (z + 0.5) * kk, ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
        const fx = px - ix, fy = py - iy, fz = pz - iz, u = fd(fx), v = fd(fy), w = fd(fz);
        const a = g(ix, iy, iz, fx, fy, fz), b = g(ix + 1, iy, iz, fx - 1, fy, fz), c = g(ix, iy + 1, iz, fx, fy - 1, fz), d = g(ix + 1, iy + 1, iz, fx - 1, fy - 1, fz);
        const e = g(ix, iy, iz + 1, fx, fy, fz - 1), f2 = g(ix + 1, iy, iz + 1, fx - 1, fy, fz - 1), h = g(ix, iy + 1, iz + 1, fx, fy - 1, fz - 1), mm = g(ix + 1, iy + 1, iz + 1, fx - 1, fy - 1, fz - 1);
        const x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f2 - e) * u, x4 = h + (mm - h) * u, y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
        o[(z * N + y) * N + xx] = y1 + (y2 - y1) * w;
      }
    }
    if (++S.y === N) { S.y = 0; S.z++; }
  }
  NUKV.tramoMax = Math.max(NUKV.tramoMax || 0, performance.now() - t0);   // (el tramo más largo: para ver que no traba)
  if (S.z < N) { setTimeout(nvRuidoPaso, 0); return; }
  // (los cuatro canales, como en el tráiler: R bultos grandes, G medianos, B coliflor chica, A jirones)
  const n3 = N * N * N, D = new Uint8Array(n3 * 4), cl = (x) => Math.max(0, Math.min(255, Math.round(x * 255)));
  const [c4, c8, c16] = S.cel.map((o, k) => { const mn = S.mn[k], r = S.mx[k] - mn; for (let i = 0; i < n3; i++) o[i] = (o[i] - mn) / r; return o; });
  const [g4, g8, g16, g32] = S.gr;
  for (let i = 0; i < n3; i++) {
    const pf = 0.5 + 0.9 * (0.5 * g4[i] + 0.25 * g8[i] + 0.125 * g16[i]);
    D[i * 4] = cl(0.62 * c4[i] + 0.38 * pf); D[i * 4 + 1] = cl(c8[i]); D[i * 4 + 2] = cl(c16[i]);
    D[i * 4 + 3] = cl(0.5 + 0.9 * (0.5 * g8[i] + 0.25 * g16[i] + 0.125 * g32[i]));
  }
  const gl = R.gl, tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, tex); R.texAct = null;
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, N, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, D);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  for (const w of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, w, gl.REPEAT);
  gl.bindTexture(gl.TEXTURE_3D, null);
  NUKV.tex = tex; NUKV.ruido = null; NUKV.msRuido = performance.now() - (NUKV.tRuido0 || performance.now());
}

// ---------------- los shaders ----------------
const VS_NV = `
layout(location=0) in vec2 aP; uniform mat4 uIVP; out vec3 vD;
void main(){ vec4 a = uIVP * vec4(aP, 1.0, 1.0); vD = a.xyz / a.w; gl_Position = vec4(aP, 0.5, 1.0); }`;
// (el del tráiler, con: el rayo en «metros del tráiler» —uEsc—, los pasos y las muestras de sombra según la calidad, la
// salida en dos búferes —el color con alfa y la distancia del punto donde entra al humo— y la niebla medida en metros)
const FS_NV = `
precision highp float; precision highp sampler3D;
in vec3 vD;
uniform vec3 uCam, uO, uSol, uSolC, uAmbS, uAmbG, uNieC, uAlbH, uAlbT, uAlbF;
uniform float uNieA, uNieB, uNieK, uSem, uEsc;
uniform vec4 uCap, uTallo, uFalda, uFuego, uDens;
uniform vec2 uCaja;
uniform sampler3D uRu;
layout(location = 0) out vec4 o;
layout(location = 1) out vec4 oD;
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float sdHongo(vec3 p) {
  float rho = length(p.xz);
  float st = length(vec2(rho - uCap.y, p.y - uCap.x)) - uCap.z;
  float ax = uCap.y + 0.62 * uCap.z, ay = 1.0 * uCap.z;
  vec2 e = vec2(rho / ax, (p.y - uCap.x - 0.22 * uCap.z) / ay);
  float sd = max((length(e) - 1.0) * min(ax, ay), uCap.x - 0.15 * uCap.z - p.y);
  return smin(st, sd, 0.3 * uCap.z);
}
float sdTallo(vec3 p) {
  float top = uTallo.z, u = clamp(p.y / max(top, 1.0), 0.0, 1.0);
  float r = mix(uTallo.x, uTallo.y, u) + uTallo.x * 1.3 * exp(-p.y / 20.0);
  r *= 1.0 + 0.22 * sin(p.y * 0.034 - uTallo.w * 0.06) + 0.12 * sin(p.y * 0.083 + 1.7 - uTallo.w * 0.11);
  return max(length(p.xz) - r, p.y - top) + (1.0 - uDens.w) * 80.0;
}
float sdFalda(vec3 p) {
  float rho = length(p.xz), w = 0.5 * uFalda.z;
  vec2 d = vec2((rho - uFalda.x + w) / w, p.y / uFalda.y);
  float s1 = (length(d) - 1.0) * min(w, uFalda.y);
  float s2 = max(rho - uFalda.x + w, p.y - 0.45 * uFalda.y);
  return min(s1, s2) + (1.0 - uFalda.w) * 60.0;
}
vec3 qHongo(vec3 p) {
  float rho = length(p.xz); vec2 dir = rho > 0.01 ? p.xz / rho : vec2(1.0, 0.0);
  vec2 d = vec2(rho - uCap.y, p.y - uCap.x);
  float a = uCap.w * smoothstep(0.0, 0.8 * uCap.y + 1.0, rho), c = cos(a), s = sin(a);
  vec2 r = vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  float rr = uCap.y + r.x;
  return vec3(dir.x * rr, uCap.x + r.y, dir.y * rr);
}
float ruido(vec3 q, float L) {
  vec4 a = texture(uRu, q / L), b = texture(uRu, q / (L * 0.29));
  return (a.r - 0.5) * 0.56 + (a.g - 0.5) * 0.24 + (b.b - 0.5) * 0.13 + (b.a - 0.5) * 0.07;
}
float ruidoG(vec3 q, float L) { vec4 a = texture(uRu, q / L); return (a.r - 0.5) * 0.56 + (a.g - 0.5) * 0.24; }
vec3 cuerpoNegro(float T) {
  vec3 c = vec3(1.0, 0.18, 0.02);
  c = mix(c, vec3(1.0, 0.42, 0.08), smoothstep(0.25, 0.5, T));
  c = mix(c, vec3(1.0, 0.72, 0.36), smoothstep(0.5, 0.78, T));
  c = mix(c, vec3(1.0, 0.95, 0.86), smoothstep(0.78, 1.05, T));
  return c * (0.2 + 0.8 * smoothstep(0.1, 0.55, T));
}
float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5); }
float medio(vec3 p, out vec3 cual, out float cal, out float sBase, out float dSup) {
  float sh = sdHongo(p), stl = sdTallo(p), sf = sdFalda(p);
  sBase = min(sh, min(stl, sf));
  float Rn = uCap.z, Ah = 0.62 * Rn, At = 1.0 * uTallo.x + 8.0, Af = 1.0 * uFalda.y + 6.0;
  float m = sBase;
  float nh = 0.0, nt = 0.0, nf = 0.0;
  if (sh < m + Ah * 0.6 && sh < Ah * 0.6) nh = ruido(qHongo(p), 2.3 * Rn);
  if (stl < m + At * 0.6 && stl < At * 0.6) { float g = 0.004 * p.y + 0.12 * uTallo.w / 32.0, cg = cos(g), sg = sin(g); nt = ruido(vec3(cg * p.x - sg * p.z, p.y - uTallo.w, sg * p.x + cg * p.z), 1.3 * uTallo.x + 18.0); }
  if (sf < m + Af * 0.6 && sf < Af * 0.6) { float k = 120.0 / max(uFalda.x, 60.0); nf = ruido(vec3(p.x * k, p.y * 1.6, p.z * k) + vec3(17.0, 0.0, 31.0), 75.0); }
  float blando = 3.0 + 0.02 * Rn;
  float dh = clamp(-(sh - Ah * 2.0 * nh) / blando, 0.0, 1.0) * uDens.x;
  float dt = clamp(-(stl - At * 2.0 * nt) / (blando * 1.6), 0.0, 1.0) * uDens.y;
  float df = clamp(-(sf - Af * 2.0 * nf) / (blando * 2.0), 0.0, 1.0) * uDens.z * (1.0 - smoothstep(0.0, uFalda.y * 1.4, p.y) * 0.6);
  // (la distancia a la superficie ya deformada por el ruido: afuera, cuánto se puede saltar sin pisar humo)
  dSup = min(sh - Ah * 2.0 * nh, min(stl - At * 2.0 * nt, sf - Af * 2.0 * nf));
  float tot = max(dh, max(dt, df));
  cual = vec3(dh, dt, df) / max(dh + dt + df, 1e-6);
  float prof = -(sh - Ah * 2.0 * nh);
  float bajo = 1.0 - smoothstep(-0.6 * Rn, 0.7 * Rn, p.y - uCap.x);
  float piel = mix(3.0, 0.4 * Rn, uFuego.z) * mix(1.0, 0.45, bajo);   // (más fina que en el tráiler: el fuego de adentro se ve más tiempo)
  cal = smoothstep(piel * 0.6, piel * 1.6 + 6.0, prof) * mix(1.0, 0.35 + 0.65 * bajo, uFuego.z) * cual.x;
  cal += smoothstep(0.55, 1.0, p.y / max(uTallo.z, 1.0)) * (1.0 - uFuego.z * 0.85) * 0.7 * cual.y * smoothstep(2.0, 12.0, -(stl - At * 2.0 * nt));
  return tot;
}
float base(vec3 p) { return min(sdHongo(p), min(sdTallo(p), sdFalda(p))); }
float medioG(vec3 p) {
  float sh = sdHongo(p), stl = sdTallo(p), sf = sdFalda(p), Rn = uCap.z, Ah = 0.62 * Rn, At = 1.0 * uTallo.x + 8.0, Af = 1.0 * uFalda.y + 6.0, blando = 3.0 + 0.02 * Rn;
  float dh = 0.0, dt = 0.0, df = 0.0;
  if (sh < Ah * 0.6) dh = clamp(-(sh - Ah * 2.0 * ruidoG(qHongo(p), 2.3 * Rn)) / blando, 0.0, 1.0) * uDens.x;
  if (stl < At * 0.6) dt = clamp(-(stl - At * 2.0 * ruidoG(vec3(p.x, p.y - uTallo.w, p.z), 1.3 * uTallo.x + 18.0)) / (blando * 1.6), 0.0, 1.0) * uDens.y;
  if (sf < Af * 0.6) df = clamp(-sf / (blando * 2.0), 0.0, 1.0) * uDens.z;
  return max(dh, max(dt, df));
}
void main() {
  vec3 rd = normalize(vD - uCam), ro = (uCam - uO) / uEsc;
  float a = dot(rd.xz, rd.xz), b = dot(ro.xz, rd.xz), c = dot(ro.xz, ro.xz) - uCaja.x * uCaja.x, disc = b * b - a * c;
  if (disc <= 0.0 || a < 1e-9) discard;
  float sq = sqrt(disc), t0 = (-b - sq) / a, t1 = (-b + sq) / a;
  float ty0 = (0.0 - ro.y) / rd.y, ty1 = (uCaja.y - ro.y) / rd.y;
  float tA = max(max(t0, min(ty0, ty1)), 0.0), tB = min(t1, max(ty0, ty1));
  if (tA >= tB) discard;
  float Rn = uCap.z, paso = max(2.2, 0.045 * Rn) * PASOK;
  float t = tA + h12(gl_FragCoord.xy + uSem) * paso, Tr = 1.0, tHit = -1.0;
  vec3 col = vec3(0.0);
  float cosT = dot(rd, uSol), fase = mix(hg(cosT, 0.3), hg(cosT, -0.1), 0.45) * 0.8 + 0.2;
  float margen = 0.62 * Rn + 8.0;
  for (int i = 0; i < PASOS; i++) {
    if (t > tB || Tr < 0.02) break;
    vec3 p = ro + rd * t;
    float sb = base(p);
    if (sb > margen) { t += max(sb - margen * 0.9, paso); continue; }
    vec3 cual; float cal, sBase, dSup;
    float sig = medio(p, cual, cal, sBase, dSup);
    // (afuera del humo, aunque cerca: se salta lo que asegura la superficie con ruido; con pocos pasos, si se fuera de a uno
    // por la franja que rodea al hongo, el rayo se terminaba antes de cruzarlo y el sombrero quedaba transparente)
    if (sig <= 0.0005) { t += max(paso, dSup * 0.6); continue; }
    {
      if (tHit < 0.0) tHit = t;
      float sl = 0.0;
      for (int j = 1; j <= SOMBRA; j++) { float d = float(j * j) * 10.0 + 4.0; sl += clamp(-base(p + uSol * d) / (0.3 * Rn), 0.0, 1.0) * float(2 * j - 1) * 10.0; }
      sl *= SOMBRAK;
      float sigK = dot(cual, uDens.xyz);
#if BULTOS
      float sig2 = medioG(p + uSol * (0.09 * Rn + 2.0));
      float bul = clamp(1.0 - (sig2 - sig) / max(sigK, 1e-4) * 0.9, 0.12, 1.0);
#else
      float bul = 1.0;
#endif
      float Ts = max(exp(-sl * sigK * 0.9), 0.3 * exp(-sl * sigK * 0.15)) * bul;
      vec3 alb = uAlbH * cual.x + uAlbT * cual.y + uAlbF * cual.z;
      alb *= mix(1.0, 0.55, uFuego.z * cual.x * (1.0 - smoothstep(-0.3 * Rn, 0.9 * Rn, p.y - uCap.x)));
      float arriba = clamp((p.y - uCap.x) / (1.2 * Rn) * 0.5 + 0.5, 0.0, 1.0);
      float occ = exp(-max(0.0, -sBase) / (0.55 * Rn));
      vec3 amb = (uAmbS * (0.45 + 0.55 * arriba) + uAmbG * (0.55 - 0.4 * arriba)) * occ;
      float dt2 = length(vec2(length(p.xz) - uCap.y, p.y - uCap.x));
      vec3 fuegoL = cuerpoNegro(uFuego.y * 0.85) * uFuego.w * (Rn * Rn) / (Rn * Rn + dt2 * dt2 * 1.6) * (cual.y + cual.z + cual.x * 0.5 * (1.0 - smoothstep(-0.5 * Rn, 0.2 * Rn, p.y - uCap.x)));
      float Rext = uCap.y + uCap.z, cov = (1.0 - smoothstep(0.8 * Rext, 1.15 * Rext, length(p.xz))) * (1.0 - smoothstep(uCap.x - 0.9 * Rn, uCap.x - 0.3 * Rn, p.y)) * (1.0 - cual.x);
      amb *= mix(1.0, 0.38, cov); Ts *= mix(1.0, 0.3, cov);
      vec3 S = alb * (uSolC * fase * Ts + amb + fuegoL);
      S += cuerpoNegro(uFuego.y + 0.25 * cal) * uFuego.x * cal;
      float fN = clamp((t * uEsc - uNieA) / max(1.0, uNieB - uNieA), 0.0, 1.0);
      S = mix(S, uNieC, fN * fN * uNieK);
      float Tp = exp(-sig * paso);
      col += Tr * (1.0 - Tp) * S; Tr *= Tp;
    }
    t += paso;
  }
  if (Tr < 0.03) { col /= (1.0 - Tr); Tr = 0.0; }
  if (tHit < 0.0 || Tr > 0.998) discard;
  o = vec4(col, 1.0 - Tr);
  oD = vec4(tHit * uEsc, 0.0, 0.0, 1.0);
}`;
// el pegado sobre la escena: el color del búfer chico (suave) y la profundidad del punto donde entra al humo
const FS_NVC = `
precision highp float; in vec3 vD;
uniform sampler2D uCol, uDist; uniform mat4 uVP; uniform vec3 uCam; uniform vec2 uInv; uniform float uExpo;
out vec4 o;
void main(){
  vec2 uv = gl_FragCoord.xy * uInv;
  vec4 c = texture(uCol, uv);
  if (c.a < 0.004) discard;
  float d = texture(uDist, uv).r;
  vec4 cl = uVP * vec4(uCam + normalize(vD - uCam) * d, 1.0);
  gl_FragDepth = clamp(cl.z / cl.w * 0.5 + 0.5, 0.0, 0.99998);
#if SALIDA == 2
  o = c;
#else
  vec3 u = c.rgb / c.a; o = vec4(pow(1.0 - exp(-u * uExpo), vec3(0.4545)) * c.a, c.a);
#endif
}`;
// el programa de una calidad (con KHR_parallel_shader_compile se compila sin frenar: hasta que esté, carteles)
function nvProg(q) {
  const k = q.pasos + '|' + q.som + '|' + q.bul, P = NUKV.progs[k];
  if (P && P.listo) return P;
  if (!P) {
    const sk = (90 / [0, 10, 40, 90][q.som]).toFixed(3);
    NUKV.progs[k] = { o: shaderEmpezar(VS_NV, FS_NV, ['PASOS=' + q.pasos, 'SOMBRA=' + q.som, 'SOMBRAK=' + sk, 'BULTOS=' + q.bul, 'PASOK=' + q.pk.toFixed(2)]) };
    return null;
  }
  if (!shaderListo(P.o)) return null;
  try { Object.assign(P, shaderTerminar(P.o)); P.listo = true; return P; } catch (e) { NUKV.no = true; NUKV.err = String(e && e.message || e).slice(0, 300); return null; }
}
function nvComp(sal) {
  const k = 'c' + sal; let P = NUKV.progs[k];
  if (!P) P = NUKV.progs[k] = { o: shaderEmpezar(VS_NV, FS_NVC, ['SALIDA=' + sal]) };
  if (P.listo) return P;
  if (!shaderListo(P.o)) return null;
  try { Object.assign(P, shaderTerminar(P.o)); P.listo = true; return P; } catch (e) { NUKV.no = true; NUKV.err = String(e && e.message || e).slice(0, 300); return null; }
}
// el búfer chico: el color (con alfa) y la distancia a la que el rayo entra al humo
function nvBufer(w, h) {
  const gl = R.gl;
  if (NUKV.fb && NUKV.w === w && NUKV.h === h) return NUKV.ok;
  if (NUKV.fb) { gl.deleteFramebuffer(NUKV.fb); gl.deleteTexture(NUKV.tc); gl.deleteTexture(NUKV.td); }
  const tx = (fi, fo, ty, filtro) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, fi, w, h, 0, fo, ty, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtro); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtro);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  gl.activeTexture(gl.TEXTURE0);
  NUKV.tc = tx(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR); NUKV.td = tx(gl.R16F, gl.RED, gl.HALF_FLOAT, gl.NEAREST);
  gl.bindTexture(gl.TEXTURE_2D, null); R.texAct = null;
  NUKV.fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, NUKV.fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, NUKV.tc, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, NUKV.td, 0);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  NUKV.ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; NUKV.w = w; NUKV.h = h;
  if (!NUKV.ok) NUKV.no = true;   // (si la placa no puede, carteles)
  return NUKV.ok;
}

// ---------------- la forma en el tiempo (la del tráiler, a la escala de cada bomba) ----------------
const nvAire = (t) => t === 'aire' || t === 'bomba' || t === 'misil' || t === 'ficcion';
function nvEstado(E) {
  const e = Math.exp, sv = (x) => x * x * (3 - 2 * x), tr = (t, a, b) => clamp((t - a) / (b - a), 0, 1), mx = (a, b, k) => a + (b - a) * k;
  const s = E.R / NV_R0, ts = 1.5 * clamp(Math.pow(s, 0.35), 0.6, 1.9), tau = E.t / ts;
  const aire = nvAire(E.tipo), agua = E.tipo === 'agua' || E.tipo === 'barco';
  // (en el aire: la bola nace a su altura —en metros del tráiler— y el tallo tarda en subir del piso)
  const hb = aire ? Math.max(0, (E.p.y - E.piso) / s - 25) : 0, tallo0 = aire ? 1.2 : 0;
  const Rf = 95 * (1 - e(-tau * 4.0));
  const H = 25 + hb + (tau > 0.15 ? 430 * (1 - e(-(tau - 0.15) / 2.4)) : 0);
  const m = sv(tr(tau, 0.45, 2.6));
  const Rm = m * 140 * (1 - e(-tau / 2.5));
  const Rn = Math.max(1, mx(Rf, 58 + 30 * (1 - e(-tau / 3)), m));
  const top = Math.min(H - 0.4 * Rn, 160 * Math.max(0, tau - 0.4 - tallo0));
  const Rb = 30 + 400 * (1 - e(-tau / 2.2)), hb2 = 12 + 30 * (1 - e(-tau / 2)), wb = 40 + 50 * (1 - e(-tau / 3));
  // (el fuego dura más que en el tráiler —que eran 4 s de plano—: en el juego se lo mira un rato)
  let fuego = 60 * e(-tau * 3.5) + 8 * e(-tau * 0.6) + 2 * e(-tau / 5); if (agua) fuego *= 0.55;
  // (se va: en los últimos 40 s de las 150 que dura, se adelgaza)
  const fin = clamp((E.dura - E.t) / 40, 0, 1);
  return {
    s, cap: [H, Rm, Rn, (E.seed % 7) + 0.33 * tau],
    tallo: [28 + 14 * (1 - e(-tau / 3)), 20 + 14 * (1 - e(-tau / 3)), Math.max(1, top), 32 * tau],
    falda: [Rb, hb2, wb, sv(tr(tau, 0.1, 0.6)) * (1 - 0.4 * sv(tr(tau, 4, 8))) * (aire ? 0.7 : 1)],
    fuegoV: [fuego, 0.25 + 0.8 * e(-tau * 1.4), sv(tr(tau, 0.15, 1.5)), fuego * 0.12],
    dens: [0.1 * fin, 0.06 * fin, 0.04 * fin, sv(tr(tau, 0.4 + tallo0, 1.2 + tallo0))],
    caja: [Math.max(Rb + 30, Rm + Rn * 1.4 + 40), H + Rn * 1.6 + 40],
    agua, fuego, H, Rn,
  };
}
// ¿cuál se dibuja con volumen? (la más cercana de las que hacen hongo y se ven; una por vez)
function nvElegir() {
  let mejor = null, dm = 1e18;
  for (const E of NUK.vivas) {
    E.vol = false;
    if (!NV_TIPOS[E.tipo] || E.t > E.dura) continue;
    const S = nvEstado(E), s = S.s, r = Math.hypot(S.caja[0], S.caja[1] * 0.5) * s, c = v3(E.p.x, E.piso + S.caja[1] * 0.5 * s, E.p.z);
    // (sin el plano lejano de la vista: un hongo se ve de mucho más lejos que el mapa; los otros cinco, sí)
    let ve = true; for (let i = 0; i < 5; i++) { const q = R.fr[i]; if (q[0] * c.x + q[1] * c.y + q[2] * c.z + q[3] < -r) { ve = false; break; } }
    if (!ve) { NUKV.fuera = [+c.distTo(CAM.pos).toFixed(0), +r.toFixed(0)]; continue; }
    // (cuánto de la pantalla tapa, más o menos: la esfera proyectada; adentro, toda)
    const d = c.distTo(CAM.pos), ry = d <= r ? 9 : Math.tan(Math.asin(r / d)) / Math.tan((CAM.fov || 70) * Math.PI / 360);
    S.tapa = Math.min(1, Math.PI * ry * ry * (R.cv.height / R.cv.width) / 4); S.c = c; S.r = r; S.d = d; S.ry = ry;
    if (d < dm) { dm = d; mejor = [E, S]; }
  }
  return mejor;
}
function nvDibujar() {
  if (!NUK.vivas.length) return;
  // (NUKV.razon: por qué no se dibujó con volumen —para las pruebas—)
  const q = nvCalidad(); if (!q) { for (const E of NUK.vivas) E.vol = false; NUKV.razon = 'calidad'; return; }
  if (!NUKV.tex) { nvRuidoEmpezar(); for (const E of NUK.vivas) E.vol = false; NUKV.razon = 'ruido'; return; }
  const P = nvProg(q), C = nvComp(R.salida === 'hdr' ? 2 : 1); if (!P || !C) { for (const E of NUK.vivas) E.vol = false; NUKV.razon = 'programa'; return; }
  const el = nvElegir(); if (!el) { NUKV.razon = 'no se ve'; return; }
  NUKV.razon = '';
  const [E, S] = el, gl = R.gl, t0 = performance.now();
  const W = R.usaPost ? PO.w : R.cv.width, H = R.usaPost ? PO.h : R.cv.height;
  // (el búfer chico, más chico cuando el hongo llena la pantalla: es humo, suave, y así no cuesta 5 a 9 veces el cielo)
  const k = Math.min(q.esc * clamp(Math.sqrt(0.15 / Math.max(S.tapa, 1e-3)), 0.6, 1), q.max / W), w = Math.max(16, Math.round(W * k)), h = Math.max(16, Math.round(H * k));
  if (!nvBufer(w, h)) { E.vol = false; return; }
  E.vol = true;
  const IVP = NUKV.ivp || (NUKV.ivp = new Float32Array(16)); IVP.set(M4.inv(R.vp));
  // (el rectángulo de la pantalla donde cae, con margen: las dos pasadas sólo ahí —de lejos casi no cuesta—; de cerca, toda)
  let rc = null;
  if (S.d > S.r * 1.15) {
    const v = R.vp, c = S.c, x = v[0] * c.x + v[4] * c.y + v[8] * c.z + v[12], y = v[1] * c.x + v[5] * c.y + v[9] * c.z + v[13], ww = v[3] * c.x + v[7] * c.y + v[11] * c.z + v[15];
    if (ww > 0) { const ry = S.ry * 1.3, rx = ry * H / W, nx = x / ww, ny = y / ww; rc = [clamp((nx - rx) * 0.5 + 0.5, 0, 1), clamp((ny - ry) * 0.5 + 0.5, 0, 1), clamp((nx + rx) * 0.5 + 0.5, 0, 1), clamp((ny + ry) * 0.5 + 0.5, 0, 1)]; if (rc[2] <= rc[0] || rc[3] <= rc[1]) { E.vol = false; NUKV.razon = 'fuera'; return; } }
  }
  const tijera = (ancho, alto) => { if (!rc) { gl.disable(gl.SCISSOR_TEST); return; } gl.enable(gl.SCISSOR_TEST); const x0 = Math.floor(rc[0] * ancho), y0 = Math.floor(rc[1] * alto); gl.scissor(x0, y0, Math.ceil(rc[2] * ancho) - x0 + 1, Math.ceil(rc[3] * alto) - y0 + 1); };
  NUKV.rc = rc;
  // 1) el humo en el búfer chico
  gl.bindFramebuffer(gl.FRAMEBUFFER, NUKV.fb); gl.viewport(0, 0, w, h);
  gl.disable(gl.SCISSOR_TEST); gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]); gl.clearBufferfv(gl.COLOR, 1, [60000, 0, 0, 0]); tijera(w, h);
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(false); gl.disable(gl.CULL_FACE);
  gl.useProgram(P.p); R.progAct = P; const u = P.u, L = R.lin, agua = S.agua;
  gl.uniformMatrix4fv(u.uIVP, false, IVP);
  gl.uniform3f(u.uCam, R.camPos.x, R.camPos.y, R.camPos.z); gl.uniform3f(u.uO, E.p.x, E.piso, E.p.z); gl.uniform1f(u.uEsc, S.s);
  gl.uniform3f(u.uSol, R.sol.x, R.sol.y, R.sol.z); gl.uniform3fv(u.uSolC, L.solCol.map((x) => x * NUKV.solK));
  gl.uniform3fv(u.uAmbS, L.ambS.map((x) => x * NUKV.ambK)); gl.uniform3fv(u.uAmbG, L.ambG.map((x) => x * NUKV.ambK));
  // (la niebla sobre el hongo empieza donde termina la del mapa y llega a lo sumo al 60 %: se ve de lejos, con algo de bruma)
  gl.uniform3fv(u.uNieC, L.nieC); gl.uniform1f(u.uNieA, R.niebla.b); gl.uniform1f(u.uNieB, R.niebla.b + 2500); gl.uniform1f(u.uNieK, 0.6);
  gl.uniform3fv(u.uAlbH, agua ? [0.86, 0.87, 0.9] : NUKV.albH); gl.uniform3fv(u.uAlbT, agua ? [0.88, 0.89, 0.92] : NUKV.albT); gl.uniform3fv(u.uAlbF, agua ? [0.9, 0.91, 0.94] : NUKV.albF);
  gl.uniform1f(u.uSem, (E.seed % 977) * 7.31);
  gl.uniform4fv(u.uCap, S.cap); gl.uniform4fv(u.uTallo, S.tallo); gl.uniform4fv(u.uFalda, S.falda); gl.uniform4fv(u.uFuego, S.fuegoV); gl.uniform4fv(u.uDens, S.dens);
  gl.uniform2f(u.uCaja, S.caja[0], S.caja[1]);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, NUKV.tex); R.texAct = null; gl.uniform1i(u.uRu, 0);
  gl.bindVertexArray(R.quad); gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindTexture(gl.TEXTURE_3D, null);
  // 2) pegarlo en la escena, con la profundidad de donde entra el rayo
  gl.bindFramebuffer(gl.FRAMEBUFFER, R.usaPost ? PO.fb : null); gl.viewport(0, 0, W, H); tijera(W, H);
  gl.useProgram(C.p); R.progAct = C; const v = C.u;
  gl.uniformMatrix4fv(v.uIVP, false, IVP); gl.uniformMatrix4fv(v.uVP, false, R.vp); gl.uniform3f(v.uCam, R.camPos.x, R.camPos.y, R.camPos.z);
  gl.uniform2f(v.uInv, 1 / W, 1 / H); if (v.uExpo) gl.uniform1f(v.uExpo, R.expo || 1);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, NUKV.tc); gl.uniform1i(v.uCol, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, NUKV.td); gl.uniform1i(v.uDist, 1); gl.activeTexture(gl.TEXTURE0); R.texAct = null;
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null); R.vaoAct = null;
  gl.depthFunc(gl.LESS); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST);
  NUKV.ms = performance.now() - t0; NUKV.dib++; NUKV.E = E;
}
