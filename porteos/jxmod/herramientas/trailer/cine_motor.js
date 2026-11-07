// CINE: motor de cinemática para el tráiler. Se evalúa dentro del juego (window.__ev) una sola vez.
// Engancha: el fov, el corrimiento de subpíxel (suavizado por acumulación), saltear el dibujo en los tramos sin foto,
// sin arma en la mano, sin cabeza (cámara en los ojos del cuerpo), la pose de los brazos (IK) y la grieta del cielo.
(() => {
  const C = window.CINE = window.CINE || {};
  if (C.listo) return 'ya';
  C.listo = true;
  Object.assign(C, { fov: 0, jx: 0, jy: 0, saltar: false, sinVista: true, sinCabeza: null, pose: null, grieta: { on: false, abre: 0, pulso: 0, brillo: 1, t: 0 },
    objs: [], sinTemblor: true, luces: [] });
  // ---------------- enganches ----------------
  const camA = camaraActualizar;
  // C.aspK: para otro formato de cuadro (4:3), agranda el ángulo de visión vertical: tan(fov/2) se multiplica por aspK
  // (con aspK = 1080/804 cada píxel ve lo mismo que en el panorámico 2,39:1 y el cuadro 4:3 es su franja del medio, más alta)
  // (sólo cuando el lienzo no es panorámico: en 1920×804 no cambia nada)
  C.kFmt = () => (R.cv.width / R.cv.height > 2.2 ? 1 : (C.aspK || 1));
  C.fovReal = (f) => { const k = C.kFmt(); return k !== 1 ? Math.atan(k * Math.tan(f * Math.PI / 360)) * 360 / Math.PI : f; };
  camaraActualizar = function (dt) { if (C.sinTemblor) CAM.temblor = 0; camA(dt); if (C.fov) CAM.fov = C.fovReal(C.fov); };
  const persp = M4.persp;
  M4.persp = function (f, a, n, l) { const P = persp.call(M4, f, a, n, l); if (C.jx || C.jy) { P[8] -= C.jx * 2 / R.cv.width; P[9] -= C.jy * 2 / R.cv.height; } return P; };
  const dib = dibujar;
  dibujar = function () { if (C.saltar) return; dib(); };
  const vis = dibujarVista;
  dibujarVista = function () { return C.sinVista ? false : vis(); };
  // sin sombra del cuerpo propio (C.sinSombraYo): el juego la vuelve a poner en cada cuadro antes de dibujar a cada persona
  // (personas.js: P.md.sinSombra = !yo && …), así que se pisa justo antes de dibujarla
  const dibP = dibujarPersona;
  dibujarPersona = function (P) {
    if (P === JUG.cuerpo && P.md) {
      if (C.sinSombraYo) P.md.sinSombra = true;
      // el cuerpo en el tiempo exacto del subcuadro (ver C.suaveJug): lo que pasó desde el último paso de física, con su
      // velocidad; el giro, el de este subcuadro
      if (C.suaveJug && JUG.vivo && !JUG.vehiculo && !P.rag) {
        const a = TIEMPO.acc || 0, p0 = P.pos.clone(), y0 = P.yaw;
        P.pos.set(JUG.pos.x + JUG.vel.x * a, JUG.pos.y + JUG.vel.y * a, JUG.pos.z + JUG.vel.z * a); P.yaw = JUG.yaw;
        try { return dibP(P); } finally { P.pos.copy(p0); P.yaw = y0; }
      }
    }
    return dibP(P);
  };
  // C.suaveJug: la física del juego avanza a pasos fijos de 1/60 s y los subcuadros (y la cámara) en tiempo continuo. Sin
  // esto, con el desenfoque de movimiento el que corre salía doble: la cámara se calculaba con la posición de antes del
  // paso y el cuerpo se dibujaba con la de después. La escena (la cámara) ve al jugador adelantado con su velocidad hasta
  // el instante del subcuadro, y el cuerpo se dibuja en ese mismo instante
  C.suaveJug = true;
  C.conJugSuave = (dt, fn) => {
    if (!C.suaveJug || !JUG.vivo || JUG.vehiculo) return fn();
    const a = (TIEMPO.acc || 0) + dt, p0 = JUG.pos.clone();
    const pe = v3(p0.x + JUG.vel.x * a, p0.y + JUG.vel.y * a, p0.z + JUG.vel.z * a);
    JUG.pos.copy(pe);
    try { return fn(); } finally {
      if (JUG.pos.x === pe.x && JUG.pos.y === pe.y && JUG.pos.z === pe.z) JUG.pos.copy(p0);   // (si la escena lo movió a propósito —un corte—, queda)
    }
  };
  const ubi = ubicarPersona;
  ubicarPersona = function (P) {
    ubi(P);
    if (C.sinCabeza && P === C.sinCabeza) patadaCabeza(P, true, true);
    if (C.pose && P === JUG.cuerpo) C.pose(P);
  };
  const cie = dibujarCielo;
  dibujarCielo = function (IVP) { cie(IVP); if (C.grieta.on && (C.grieta.abre > 0 || C.grieta.estrellas > 0)) grietaDibujar(IVP); };
  const lj = lucesJuntar;
  lucesJuntar = function () { lj(); for (const l of C.luces) { if (l.esp) luzEspecial(l.p, l.r, l.c, l.d || null, l.k, 9, false); else luzPuntual(l.p, l.r, l.c); } };

  // partículas sin tope (el juego dibuja hasta 900 por pasada: se dibujan por tandas, de lejos a cerca)
  const de = dibujarEfectos;
  dibujarEfectos = function () {
    const L = PART.l; if (L.length <= 640) return de();
    const cam = CAM.pos, todas = L.slice();
    for (const q of todas) q.d2c = (q.p.x - cam.x) ** 2 + (q.p.y - cam.y) ** 2 + (q.p.z - cam.z) ** 2;
    todas.sort((a, b) => b.d2c - a.d2c);
    try { for (let i = 0; i < todas.length; i += 640) { PART.l = todas.slice(i, i + 640); de(); } } finally { PART.l = L; }
  };
  C.part = (p, v, vida, tam, col, tipo, crece) => {
    const humo = tipo === 'humo';
    const q = { p: p.clone(), v: v.clone(), vida, t: 0, tam, col, tipo, crece: crece === undefined ? (humo ? 1.8 : 0.3) : crece, grav: tipo === 'chispa' || tipo === 'gota' ? 1 : humo ? -0.05 : 0,
      rot: humo ? (Math.random() - 0.5) * 1.4 : Math.random() * 6.2832, dr: (Math.random() - 0.5) * (humo ? 0.5 : 1.6), tile: humo ? 1 : tipo === 'fuego' ? 2 : 0, modo: tipo === 'chispa' ? 1 : 0, fr: 0, rampa: 0, calor: 0, suave: 0, piso: null, estela: 0, suelo: null };
    PART.l.push(q); return q;
  };
  const az = (a, b) => a + Math.random() * (b - a), rv = (k) => v3(az(-k, k), az(-k, k), az(-k, k));
  // fuego y humo de algo que arde en p (sz: tamaño de la cosa, v: su velocidad)
  C.llama = (p, v, sz, k) => {
    k = k === undefined ? 1 : k;
    let x = C.part(vadd(p, rv(0.35 * sz)), vadd(vscale(v, 0.12), vadd(rv(1.2), v3(0, 1.2, 0))), az(0.3, 0.65), az(0.45, 0.9) * sz * k, [1, 1, 1, 1], 'fuego', 1.3);
    x.rampa = 1; x.fr = 3; x.suave = 1;
  };
  C.humo = (p, v, sz, k) => {
    k = k === undefined ? 1 : k;
    const x = C.part(vadd(p, rv(0.3 * sz)), vadd(vscale(v, 0.04), vadd(rv(0.8), v3(0, 1.0, 0))), az(0.9, 1.6), az(0.45, 0.75) * sz * k, [0.32, 0.29, 0.28, 0.42], 'humo', 1.8);
    x.calor = 0.35; x.fr = 1.1;
  };
  // ---------------- cosas que caen de la grieta ----------------
  // cinemáticas (sin física) hasta que pegan: p(t) = desde + v0·s + ½·g·s², con la llegada justa en t1
  C.caidas = [];
  C.caida = (op) => {
    const c = Object.assign({ g: -16, fuego: true, sz: 1.5, explota: 0, quedar: false, giro: v3(az(-3, 3), az(-3, 3), az(-3, 3)) }, op);
    if (c.hasta && c.desde) { const T = c.t1 - c.t0, d = vsub(c.hasta, c.desde); c.v0 = v3(d.x / T, (d.y - 0.5 * c.g * T * T) / T, d.z / T); }
    c.q0 = Quat.euler(az(0, 6.28), az(-1, 1), az(-1, 1));
    c.o = null; c.estado = 0; c.ult = null; c.acF = 0; c.acH = 0;
    C.caidas.push(c); return c;
  };
  C.caidaPos = (c, t) => { const s = t - c.t0; return v3(c.desde.x + c.v0.x * s, c.desde.y + c.v0.y * s + 0.5 * c.g * s * s, c.desde.z + c.v0.z * s); };
  C.caidasPaso = (t, dt) => {
    for (const c of C.caidas) {
      if (t < c.t0 || c.estado === 3) continue;
      if (c.estado === 0) {
        // (el lugar del golpe y de salida se pueden calcular al aparecer: donde va a estar él)
        if (c.hastaF) c.hasta = c.hastaF(c);
        if (c.desdeF) c.desde = c.desdeF(c);
        if (c.hastaF || c.desdeF) { const T = c.t1 - c.t0, d = vsub(c.hasta, c.desde); c.v0 = v3(d.x / T, (d.y - 0.5 * c.g * T * T) / T, d.z / T); }
        c.o = crearObjeto(c.nombre, C.caidaPos(c, t), c.q0.clone()); c.estado = 1;
        if (!c.o) { c.estado = 3; continue; }
        if (c.escala) { c.o.esc = c.escala; }
        c.o.b.frozen = true; c.o.md.sinSombra = true;
      }
      const o = c.o, b = o ? o.b : null;
      if (c.estado === 1) {
        const tt = Math.min(t, c.t1), p = C.caidaPos(c, tt), s = tt - c.t0;
        const v = v3(c.v0.x, c.v0.y + c.g * s, c.v0.z);
        b.pos.copy(p); b.q.copy(c.q0.clone().mul(Quat.axis(c.giro.x, c.giro.y, c.giro.z, c.giro.len() * s))); b.vel.set(0, 0, 0); b.ang.set(0, 0, 0);
        b.sleep = false; b.updateWorld(); o.md.sucio = true;
        // la estela: puntos a lo largo del camino recorrido desde el subcuadro anterior
        if (c.fuego && c.ult) {
          const seg = vsub(p, c.ult), L = seg.len();
          c.acF += L; c.acH += L;
          const pf = 0.45 * c.sz, ph = 1.3 * c.sz;
          while (c.acF >= pf) { c.acF -= pf; C.llama(vsub(p, vscale(seg, c.acF / Math.max(L, 1e-6))), v, c.sz); }
          while (c.acH >= ph) { c.acH -= ph; C.humo(vsub(p, vscale(seg, c.acH / Math.max(L, 1e-6))), v, c.sz); }
        }
        c.ult = p.clone();
        if (t >= c.t1) {
          c.estado = 2; c.tPego = t;
          if (c.explota > 0) { efectoExplosion(c.hasta, c.explota); C.golpe = Math.max(C.golpe || 0, 1); }
          else if (!c.sinPolvo) { const x = particula(v3(c.hasta.x, c.hasta.y + 0.2, c.hasta.z), v3(), 0.6, 2.2 * c.sz, [0.78, 0.68, 0.55, 0.55], 'humo', 4); if (x) { x.tile = 3; x.modo = 2; x.suave = 1; x.grav = 0; } }
          if (c.clavar) { o.md.sinSombra = false; b.vel.set(0, 0, 0); b.ang.set(0, 0, 0); }
          else if (c.quedar) { o.md.sinSombra = false; b.frozen = false; b.vel.copy(vscale(v, c.rebote === undefined ? 0.18 : c.rebote)); b.vel.y = Math.abs(v.y) * (c.salto === undefined ? 0.12 : c.salto); b.ang.set(az(-4, 4), az(-4, 4), az(-4, 4)); b.wake(); }
          else { borrarObjeto(o, true); c.o = null; if (!c.explota) c.estado = 3; }
        }
      } else if (c.estado === 2) {
        // ardiendo en el piso un rato
        if (c.explotaEn && !c.exploto && t >= c.explotaEn) {
          c.exploto = true; const pe = c.o ? c.o.b.pos.clone() : c.hasta.clone();
          efectoExplosion(pe, c.explotaEsc || 2.5); C.golpe = Math.max(C.golpe || 0, 1.4); if (c.o) { borrarObjeto(c.o, true); c.o = null; } c.hasta = pe; c.tPego = t; c.fuego = true;
        }
        const ard = c.arde === undefined ? 2.5 : c.arde, e = t - c.tPego;
        if (e > ard) { c.estado = 3; continue; }
        const p = c.o ? c.o.b.pos : c.hasta, k = 1 - e / ard;
        if (c.fuego && Math.random() < dt * 22 * k) C.llama(vadd(p, v3(0, 0.3, 0)), v3(), c.sz * 0.8, k);
        if (c.fuego && Math.random() < dt * 9 * k) C.humo(vadd(p, v3(0, 0.6, 0)), v3(), c.sz, 1);
      }
    }
  };
  // luces de lo que arde (las más cercanas a la cámara las elige el juego)
  C.caidasLuces = () => {
    for (const c of C.caidas) {
      if (!c.fuego || c.estado === 0 || c.estado === 3) continue;
      const p = c.estado === 1 && c.o ? c.o.b.pos : (c.o ? c.o.b.pos : c.hasta);
      const k = c.estado === 1 ? 1 : Math.max(0, 1 - (C.tAct - c.tPego) / (c.arde || 2.5));
      C.luces.push({ p: vadd(p, v3(0, 0.5, 0)), r: 10 + 6 * c.sz, c: [7 * k, 3.2 * k, 1.0 * k] });
    }
  };

  C.precalentar = (nombres) => {
    const f = CAM.fwd, out = [];
    nombres.forEach((n, i) => { const o = crearObjeto(n, vadd(CAM.pos, vadd(vscale(f, 6 + i * 1.5), v3((i % 3 - 1) * 1.5, 0, 0))), new Quat()); if (o) { o.b.frozen = true; out.push(o); } });
    C.calientes = out; return out.length;
  };
  C.enfriar = () => { for (const o of C.calientes || []) borrarObjeto(o, true); C.calientes = []; return 1; };
  // ---------------- el mar (la playa): olas de Gerstner, espuma, arena mojada, cielo reflejado, destellos del sol ----------------
  // Una malla polar alrededor de la cámara (densa cerca, hasta 3 km). La altura del terreno (una textura de 1 m) da la
  // profundidad: el color del agua, lo transparente en la orilla, la espuma y, donde el terreno está arriba del agua, la
  // arena mojada (la malla se apoya sobre la arena y oscurece/abrillanta la franja que moja la ola)
  const MAR = C.mar = { on: false, nivel: 9.5, t: 0, prog: null, vao: null, nInd: 0, alt: null, area: null };
  C.marPreparar = (op) => {
    Object.assign(MAR, op);
    const gl = R.gl;
    // la altura del terreno en el área (1 m)
    const [x0, z0, sx, sz] = MAR.area, paso = MAR.paso || 1, nx = Math.round(sx / paso) + 1, nz = Math.round(sz / paso) + 1;
    const H = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const y = pisoBajo(v3(x0 + i * paso, MAR.nivel - 40, z0 + j * paso), 80); H[j * nx + i] = y === null ? MAR.nivel - 40 : y; }
    MAR.alt = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, MAR.alt); R.texAct = null;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, nx, nz, 0, gl.RED, gl.FLOAT, H);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    MAR.altR = [x0, z0, 1 / (sx + paso), 1 / (sz + paso)];
    // la malla polar
    const NR = 240, NA = 400, V = new Float32Array((NR + 1) * NA * 2);
    for (let i = 0; i <= NR; i++) { const u = i / NR, r = 3000 * (Math.exp(6.2 * u) - 1) / (Math.exp(6.2) - 1); for (let j = 0; j < NA; j++) { const a = j / NA * Math.PI * 2, o = (i * NA + j) * 2; V[o] = Math.cos(a) * r; V[o + 1] = Math.sin(a) * r; } }
    const I = new Uint32Array(NR * NA * 6); let k = 0;
    for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) { const a = i * NA + j, b = i * NA + (j + 1) % NA, c = (i + 1) * NA + j, d = (i + 1) * NA + (j + 1) % NA; I[k++] = a; I[k++] = c; I[k++] = b; I[k++] = b; I[k++] = c; I[k++] = d; }
    MAR.vao = gl.createVertexArray(); gl.bindVertexArray(MAR.vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, V, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I, gl.STATIC_DRAW);
    gl.bindVertexArray(null); R.vaoAct = null; MAR.nInd = k;
    // las olas: dirección (hacia la orilla, que está al oeste), largo, alto
    const base = MAR.haciaOrilla || [-1, 0];
    const rot = (d, a) => [d[0] * Math.cos(a) - d[1] * Math.sin(a), d[0] * Math.sin(a) + d[1] * Math.cos(a)];
    const olas = [[0.0, 38, 0.32], [0.35, 24, 0.20], [-0.42, 17, 0.14], [0.9, 11, 0.07], [-1.1, 7.5, 0.05], [0.2, 5.2, 0.035], [-0.6, 3.6, 0.022], [1.4, 2.6, 0.015]];
    MAR.olas = new Float32Array(32);
    olas.forEach(([a, L, A], i) => { const d = rot(base, a); MAR.olas.set([d[0], d[1], L, A * (MAR.altoOlas || 1)], i * 4); });
    MAR.on = true; return nx * nz;
  };
  const VS_MAR = `
layout(location=0) in vec2 aP;
uniform mat4 uVP; uniform vec3 uCen; uniform float uT, uNivel, uSube; uniform sampler2D uAlt; uniform vec4 uAltR; uniform vec4 uOla[8];
out vec3 vW; out float vH; out float vJ; out vec3 vN; out float vD; out float vY;
float altura(vec2 xz) { vec2 uv = (xz - uAltR.xy) * uAltR.zw; if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return uNivel - 40.0; return texture(uAlt, uv).r; }
void main() {
  vec2 xz = uCen.xz + aP; float d = length(aP);
  float h = altura(xz), prof = uNivel - h;
  float kO = smoothstep(-0.3, 3.0, prof);
  vec3 p = vec3(xz.x, uNivel + uSube, xz.y); vec3 n = vec3(0.0, 1.0, 0.0); float J = 1.0;
  for (int i = 0; i < 8; i++) {
    vec4 o = uOla[i]; float k = 6.2832 / o.z, w = sqrt(9.81 * k);
    float A = o.w * kO * (1.0 - smoothstep(o.z * 18.0, o.z * 40.0, d));
    float Q = 0.55 / (k * max(o.w, 1e-4) * 8.0);
    float th = k * dot(o.xy, xz) - w * uT + float(i) * 1.7;
    float c = cos(th), s = sin(th);
    p.x += Q * A * o.x * c; p.z += Q * A * o.y * c; p.y += A * s;
    n.x -= o.x * k * A * c; n.z -= o.y * k * A * c; n.y -= Q * k * A * s; J -= Q * k * A * s;
  }
  // sobre la arena (lo que está arriba del agua): la malla se apoya en la arena, apenas encima
  float encima = h + 0.035;
  vY = p.y;
  if (p.y < encima) p.y = encima;
  vW = p; vH = h; vJ = J; vN = n; vD = d;
  gl_Position = uVP * vec4(p, 1.0);
}`;
  const FS_MAR = `
precision highp float;
in vec3 vW; in float vH; in float vJ; in vec3 vN; in float vD; in float vY;
uniform vec3 uCam, uSol, uSolC, uTop, uMid, uBot, uNieC, uAmb; uniform vec2 uExp; uniform float uT, uNivel, uSube, uMojado, uNieA, uNieB, uCieloK; uniform sampler2D uAlt; uniform vec4 uAltR;
out vec4 o;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.07 + vec2(3.1, 1.7); a *= 0.5; } return s; }
float altura(vec2 xz) { vec2 uv = (xz - uAltR.xy) * uAltR.zw; if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return uNivel - 40.0; return texture(uAlt, uv).r; }
vec3 cielo(vec3 r) {
  float y = max(r.y, 0.0);
  vec3 c = mix(uMid, uTop, pow(y, uExp.x)) * uCieloK;
  float s = max(dot(r, uSol), 0.0);
  c += uSolC * (pow(s, 8.0) * 0.25 * (1.0 - y) + pow(s, 60.0) * 0.6);
  return c;
}
void main() {
  vec3 v = normalize(uCam - vW); float d = distance(uCam, vW);
  float h = altura(vW.xz), prof = uNivel + uSube - h;
  // ondas chicas encima de las de Gerstner (se apagan a lo lejos)
  float fd = 1.0 / (1.0 + d * 0.035);
  vec2 g = vec2(0.0);
  g += vec2(0.80, 0.60) * cos(dot(vW.xz, vec2(0.80, 0.60)) * 2.3 + uT * 3.1) * 0.05;
  g += vec2(-0.45, 0.89) * cos(dot(vW.xz, vec2(-0.45, 0.89)) * 3.7 + uT * 3.9) * 0.035;
  g += vec2(0.96, -0.28) * cos(dot(vW.xz, vec2(0.96, -0.28)) * 6.1 + uT * 5.0) * 0.025;
  g += vec2(-0.70, -0.71) * cos(dot(vW.xz, vec2(-0.70, -0.71)) * 9.7 + uT * 6.3) * 0.018;
  g += vec2(0.2, -0.98) * cos(dot(vW.xz, vec2(0.2, -0.98)) * 14.3 + uT * 7.7) * 0.012;
  vec3 n = normalize(normalize(vN) + vec3(-g.x, 0.0, -g.y) * fd * 1.4);
  if (vY < vH + 0.035) {
    // arena mojada: la franja que moja la ola (más oscura y con brillo de cielo); el resto, nada
    float sobre = h - (uNivel + uSube);
    float moj = (1.0 - smoothstep(0.0, uMojado, sobre)) * step(-0.02, sobre);
    if (moj < 0.01) discard;
    vec3 r = reflect(-v, vec3(0.0, 1.0, 0.0)); r.y = abs(r.y);
    float fr = 0.02 + 0.6 * pow(1.0 - max(dot(v, vec3(0.0, 1.0, 0.0)), 0.0), 5.0);
    vec3 brillo = cielo(r) * fr * moj * 0.8 + uSolC * pow(max(dot(r, uSol), 0.0), 300.0) * 2.0 * moj;
    // espuma que queda en la arena al bajar la ola
    float esp = smoothstep(0.55, 0.85, fbm(vW.xz * 3.0 + vec2(uT * 0.1, 0.0))) * (1.0 - smoothstep(0.0, uMojado * 0.35, sobre)) * moj;
    vec3 col = brillo + vec3(0.9) * (uAmb + uSolC * max(uSol.y, 0.1) * 0.5) * esp * 0.6;
    float fN = clamp((d - uNieA) / max(1.0, uNieB - uNieA), 0.0, 1.0);
    o = vec4(col * (1.0 - fN), (0.42 * moj + esp * 0.3) * (1.0 - fN));
    return;
  }
  float ndv = max(dot(n, v), 0.0);
  float fr = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  vec3 r = reflect(-v, n); r.y = abs(r.y);
  vec3 refl = cielo(r);
  // el cuerpo del agua: turquesa en lo bajo, azul profundo en lo hondo; luz que pasa por las crestas
  vec3 hondo = vec3(0.004, 0.028, 0.055), bajo = vec3(0.02, 0.17, 0.17);
  vec3 cuerpo = mix(bajo, hondo, smoothstep(0.3, 7.0, prof)) * (uAmb * 1.6 + uSolC * max(uSol.y, 0.05) * 0.35);
  float cresta = clamp((vY - uNivel - uSube) * 1.6, 0.0, 1.0);
  cuerpo += vec3(0.02, 0.24, 0.20) * uSolC * pow(max(dot(v, -uSol) * 0.5 + 0.5, 0.0), 3.0) * cresta * 0.5;
  // el sol: un destello fino y un camino de chispas
  float rs = max(dot(r, uSol), 0.0);
  vec3 spec = uSolC * (pow(rs, 1800.0) * 60.0 + pow(rs, 220.0) * 3.0 * fd) * step(0.0, uSol.y);
  vec3 col = mix(cuerpo, refl, fr) + spec;
  // espuma: en la orilla, las líneas que llegan y las crestas que rompen
  float ruido = fbm(vW.xz * 1.7 + vec2(uT * 0.25, uT * 0.13));
  float orilla = (1.0 - smoothstep(0.0, 0.45, prof)) * smoothstep(0.3, 0.6, ruido + 0.25);
  float lineas = smoothstep(0.75, 1.0, sin(prof * 3.2 - uT * 1.35 + ruido * 2.5)) * (1.0 - smoothstep(0.4, 3.5, prof)) * smoothstep(0.4, 0.7, ruido);
  float rompe = smoothstep(0.55, 0.05, vJ) * smoothstep(0.45, 0.7, ruido);
  float esp = clamp(orilla + lineas * 0.8 + rompe, 0.0, 1.0) * fd * 1.3;
  vec3 espC = vec3(0.92, 0.95, 0.97) * (uAmb * 1.4 + uSolC * max(dot(n, uSol), 0.0) * 0.8);
  col = mix(col, espC, clamp(esp, 0.0, 0.9));
  // niebla (como el resto: hacia el horizonte se funde con el cielo)
  float fN = clamp((d - uNieA) / max(1.0, uNieB - uNieA), 0.0, 1.0);
  col = mix(col, uNieC, fN * fN * 0.85);
  // lo que deja ver de la arena: la luz que entra (1 − Fresnel) y atraviesa la profundidad (y algo de espuma)
  float Tr = exp(-max(prof, 0.0) * 2.4) * (1.0 - esp);
  vec3 sinArena = mix(cuerpo, refl, fr) + spec;          // (lo de arriba, sin la espuma)
  sinArena = mix(sinArena, espC, clamp(esp, 0.0, 0.9));
  sinArena = mix(sinArena, uNieC, fN * fN * 0.85);
  float a = clamp(fr + (1.0 - fr) * (1.0 - Tr), 0.0, 1.0);
  vec3 pre = (refl * fr + spec) + (1.0 - fr) * cuerpo * (1.0 - Tr);
  pre = mix(pre, espC, clamp(esp, 0.0, 0.9) * (1.0 - fr * 0.5));
  pre = mix(pre, uNieC * a, fN * fN * 0.85);
  // (la arena del fondo, oscurecida y teñida por el agua: más absorción del rojo)
  o = vec4(pre, min(1.0, a + 0.22 * (1.0 - a)));
}`;
  C.marDibujar = () => {
    if (!MAR.on || R.salida !== 'hdr') return;
    const gl = R.gl, L = R.lin;
    if (!MAR.prog) MAR.prog = shader(VS_MAR, FS_MAR, []);
    const P = MAR.prog; gl.useProgram(P.p); R.progAct = P;
    gl.uniformMatrix4fv(P.u.uVP, false, R.vp);
    const cx = Math.round(R.camPos.x / 4) * 4, cz = Math.round(R.camPos.z / 4) * 4;
    gl.uniform3f(P.u.uCen, cx, 0, cz); gl.uniform3f(P.u.uCam, R.camPos.x, R.camPos.y, R.camPos.z);
    gl.uniform1f(P.u.uT, MAR.t); gl.uniform1f(P.u.uNivel, MAR.nivel); gl.uniform1f(P.u.uSube, MAR.sube || 0); gl.uniform1f(P.u.uMojado, MAR.mojado || 0.5);
    gl.uniform4fv(P.u['uOla[0]'] || P.u.uOla, MAR.olas);
    gl.uniform4f(P.u.uAltR, MAR.altR[0], MAR.altR[1], MAR.altR[2], MAR.altR[3]);
    gl.uniform3f(P.u.uSol, R.sol.x, R.sol.y, R.sol.z); gl.uniform3fv(P.u.uSolC, L.cieloSol.map((x) => x * (MAR.solK || 1)));
    gl.uniform3fv(P.u.uTop, L.top); gl.uniform3fv(P.u.uMid, L.mid); gl.uniform3fv(P.u.uBot, L.bot); gl.uniform2fv(P.u.uExp, R.cielo.exp); gl.uniform1f(P.u.uCieloK, R.cieloK || 1);
    gl.uniform3fv(P.u.uNieC, MAR.nieC || L.nieC); gl.uniform1f(P.u.uNieA, MAR.nieA || R.niebla.a); gl.uniform1f(P.u.uNieB, MAR.nieB || R.niebla.b);
    gl.uniform3fv(P.u.uAmb, L.ambS);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, MAR.alt); R.texAct = null; gl.uniform1i(P.u.uAlt, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE); gl.depthFunc(gl.LEQUAL);
    gl.bindVertexArray(MAR.vao); gl.drawElements(gl.TRIANGLES, MAR.nInd, gl.UNSIGNED_INT, 0); gl.bindVertexArray(null); R.vaoAct = null;
    gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.depthFunc(gl.LESS);
  };
  const dm = dibujarMarcas;
  dibujarMarcas = function () { dm(); try { C.marDibujar(); } catch (e) { C.marError = String(e && e.message || e); MAR.on = false; } };

  // ---------------- modelos sueltos (p. ej. el arma de mundo de la Physics Gun tirada en la arena) ----------------
  C.sueltos = [];
  C.modeloArma = (nombre) => {
    const A = DATA.gm && DATA.gm.armas && DATA.gm.armas[nombre];
    if (A) return { md: new Modelo([{ n: nombre, p: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], pa: -1, m: A.m, mt: A.mt }]), G: A.G, gm: true };
    const D = arma3p({ armas3p: {} }, nombre); return D ? { md: D.md, G: null, gm: false } : null;
  };
  C.suelto = (nombre, pos, q, esc) => { const M = C.modeloArma(nombre); if (!M) return null; const s = Object.assign(M, { pos: pos.clone(), q: q.clone(), esc: esc || 1, W: new Float32Array(16), visible: true }); C.sueltos.push(s); return s; };
  const dob = dibujarObjetos;
  dibujarObjetos = function () {
    dob();
    for (const s of C.sueltos) { if (!s.visible) continue; m4trs([s.pos.x, s.pos.y, s.pos.z], [s.q.x, s.q.y, s.q.z, s.q.w], [s.esc, s.esc, s.esc], s.W); s.md.ponerRaiz(s.W); s.md.encolar(); }
  };
  // explosiones del juego, ajustadas para la cámara de cine: el destello y el anillo de polvo del piso (que con esta luz
  // se veían como domos blancos) más chicos y oscuros; la bola de fuego y el humo quedan como son
  const ex0 = efectoExplosion;
  efectoExplosion = function (p, esc) {
    const n0 = PART.l.length; ex0(p, esc);
    for (let i = n0; i < PART.l.length; i++) {
      const q = PART.l[i];
      if (q.tipo === 'fog') { q.tam *= 0.45; q.col = [q.col[0] * 0.8, q.col[1] * 0.7, q.col[2] * 0.6, q.col[3]]; }
      else if (q.tipo === 'humo' && q.tile === 3) { q.tam *= 0.55; q.col = [0.42, 0.34, 0.27, q.col[3] * 0.55]; }
      else if (q.tipo === 'humo') { q.col = [q.col[0] * 0.75, q.col[1] * 0.72, q.col[2] * 0.7, q.col[3]]; }
    }
  };
  // ---------------- utilidades de tiempo ----------------
  C.tramo = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  C.suave = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  C.suave2 = (x) => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
  C.salida = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);   // (rápido y frena)
  C.entrada = (x) => Math.pow(clamp(x, 0, 1), 3);
  // ruido suave 1D (para la cámara en mano): suma de senos con fases fijas
  C.ruido = (t, s) => { s = s || 0; return Math.sin(t * 1.7 + s * 3.1) * 0.5 + Math.sin(t * 2.9 + s * 1.3 + 1.1) * 0.3 + Math.sin(t * 5.3 + s * 4.7 + 2.3) * 0.2; };
  // claves [[t, valor (número o arreglo)], ...] con mezcla suave entre claves
  C.claves = (t, K, f) => {
    f = f || C.suave2;
    if (t <= K[0][0]) return K[0][1];
    for (let i = 0; i + 1 < K.length; i++) {
      const [ta, a] = K[i], [tb, b] = K[i + 1];
      if (t <= tb) { const u = f((t - ta) / (tb - ta)); return Array.isArray(a) ? a.map((x, j) => x + (b[j] - x) * u) : a + (b - a) * u; }
    }
    return K[K.length - 1][1];
  };
  C.v = (a) => v3(a[0], a[1], a[2]);
  // golpes de la canción: un pulso que sube rápido y baja en "caida" s
  C.pulsos = (t, golpes, caida) => { let s = 0; for (const g of golpes) { const d = t - (Array.isArray(g) ? g[0] : g), k = Array.isArray(g) ? g[1] : 1; if (d >= -0.02 && d < caida * 4) s = Math.max(s, k * (d < 0 ? 1 + d / 0.02 : Math.exp(-d / caida))); } return s; };

  // ---------------- cámara ----------------
  // q de cámara que mira de p a o (yaw/pitch como el juego, roll en radianes)
  C.qMirar = (p, o, roll) => { const d = vsub(o, p); const yaw = Math.atan2(d.x, d.z), pit = -Math.atan2(d.y, Math.hypot(d.x, d.z)); return Quat.euler(yaw, pit, roll || 0); };
  C.camara = (p, o, roll, fov) => { if (!DBG.cam) DBG.cam = { p: v3(), q: new Quat() }; DBG.cam.p.copy(p); DBG.cam.q.copy(C.qMirar(p, o, roll)); if (fov) C.fov = fov; };
  C.camaraQ = (p, q, fov) => { if (!DBG.cam) DBG.cam = { p: v3(), q: new Quat() }; DBG.cam.p.copy(p); DBG.cam.q.copy(q); if (fov) C.fov = fov; };

  // ---------------- brazos (IK de dos huesos) ----------------
  // pone el brazo L ('Left'/'Right') con la muñeca en wrist, los dedos hacia fT y la palma mirando hacia nT; el codo hacia polo
  C.brazo = (P, L, wrist, fT, nT, polo) => {
    const md = P.md, h = P.D.h, hx = huesosMixamo(P.D);
    const sh = h[L + 'Arm'], el = h[L + 'ForeArm'], hand = h[L + 'Hand']; if ([sh, el, hand].some((x) => x === undefined)) return;
    md.actualizar();
    const a = celmPos(md, sh).distTo(celmPos(md, el)), b = celmPos(md, el).distTo(celmPos(md, hand)), S = celmPos(md, sh);
    const dW = vsub(wrist, S), dist = Math.min(dW.len(), (a + b) * 0.999), dn = dW.clone().norm();
    const cosA = clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1), alto = a * Math.sqrt(1 - cosA * cosA);
    const lado = vsub(polo, vscale(dn, vdot(polo, dn))).norm(), codo = vadd(S, vadd(vscale(dn, a * cosA), vscale(lado, alto)));
    celmGirar(md, sh, celmDesde(vsub(celmPos(md, el), S).norm(), vsub(codo, S).norm()));
    celmGirar(md, el, celmDesde(vsub(celmPos(md, hand), celmPos(md, el)).norm(), vsub(wrist, celmPos(md, el)).norm()));
    const m1 = hx[L + 'HandMiddle1'], i1 = hx[L + 'HandIndex1'], p1 = hx[L + 'HandPinky1'] !== undefined ? hx[L + 'HandPinky1'] : hx[L + 'HandRing1'];
    if (m1 !== undefined && i1 !== undefined && p1 !== undefined) {
      md.actualizar();
      // (sin fT: los dedos siguen al antebrazo, doblados "flex" hacia la palma; con nT = 'ojo' la palma mira al punto dado)
      if (!fT || fT.flex !== undefined) { const fa = vsub(celmPos(md, hand), celmPos(md, el)).norm(); const fl = fT ? fT.flex : 0; fT = vadd(fa, vscale(nT, fl)).norm(); }
      const f0 = vsub(celmPos(md, m1), celmPos(md, hand)).norm();
      let s0r = vsub(celmPos(md, i1), celmPos(md, p1)).norm(); if (L === 'Left') s0r = vscale(s0r, -1);
      const n0 = vcross(s0r, f0).norm(), s0 = vcross(f0, n0).norm();
      const sT = vcross(fT, nT).norm();
      const qd = qBase(fT, sT, vcross(fT, sT)).mul(qBase(f0, s0, vcross(f0, s0)).conj()).norm();
      celmPonerQ(md, hand, qd.mul(celmQMundo(md, hand)).norm());
    }
    md.actualizar();
  };
  // dedos: dobla las falanges (k 0 = como vienen, 1 = puño) — giro alrededor del eje de los nudillos
  C.dedos = (P, L, k) => {
    const md = P.md, hx = huesosMixamo(P.D);
    for (const D of ['Index', 'Middle', 'Ring', 'Pinky']) for (const j of [1, 2, 3]) {
      const i = hx[L + 'Hand' + D + j]; if (i === undefined) continue;
      const r = md.r[i], q = new Quat(r[0], r[1], r[2], r[3]).mul(Quat.axis(1, 0, 0, k * (j === 1 ? 0.5 : 0.7))).norm(); r[0] = q.x; r[1] = q.y; r[2] = q.z; r[3] = q.w;
    }
    md.sucio = true; md.actualizar();
  };
  C.hueso = (P, n) => { const i = P.D.h[n]; if (i === undefined) return null; P.md.actualizar(); return celmPos(P.md, i); };

  // ---------------- cielo y luz ----------------
  // k: 0 el mapa como es, 1 el cielo violeta de la grieta. dir: de dónde viene la luz (la grieta)
  C.cielo = (k, op) => {
    const B0 = DIA.base; if (!B0 || !B0.cielo) return;
    op = op || {};
    // (una base propia para el plano —la luz de la tarde— en lugar de la del mapa)
    const B = op.base ? { sol: op.base.dir || B0.sol, solCol: op.base.solCol || B0.solCol, ambS: op.base.ambS || B0.ambS, ambG: op.base.ambG || B0.ambG, niebla: { c: op.base.niebla || B0.niebla.c },
      cielo: { top: op.base.top || B0.cielo.top, mid: op.base.mid || B0.cielo.mid, bot: op.base.bot || B0.cielo.bot, sol: op.base.sol || B0.cielo.sol } } : B0;
    const m = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const V = Object.assign({ top: [0.07, 0.045, 0.26], mid: [0.66, 0.42, 0.84], bot: [0.52, 0.38, 0.60], sol: [0.0, 0.0, 0.0], solCol: [0.85, 0.60, 0.72], ambS: [0.24, 0.20, 0.36], ambG: [0.30, 0.20, 0.18], noche: 0.0, nubes: 0.62 }, op.V || {});
    const Cc = R.cielo;
    Cc.top = m(B.cielo.top, V.top, k); Cc.mid = m(B.cielo.mid, V.mid, k); Cc.bot = m(B.cielo.bot, V.bot, k); Cc.sol = m(B.cielo.sol, V.sol, k);
    R.solCol = m(B.solCol, V.solCol, k); R.ambS = m(B.ambS, V.ambS, k); R.ambG = m(B.ambG, V.ambG, k);
    if (op.dir) R.sol.copy(op.dir); else R.sol.copy(B.sol); R.sol.norm();
    R.niebla.c = m(B.niebla.c, V.mid, k);
    R.noche = V.noche * k; R.expoK = 1; R.nubes = 0.5 + (V.nubes - 0.5) * k; R.luna = v3(0, -1, 0); C.grieta.estrellas = (op.estrellas === undefined ? 0.85 : op.estrellas) * k;
    if (op.solTam !== undefined) Cc.solTam = op.solTam;
    DIA.aplicada = DIA.hora;
  };

  // ---------------- la grieta del cielo (efecto propio) ----------------
  // La forma: una grieta principal quebrada con ramas (subdivisión al azar con semilla), dibujada en un lienzo 2D (núcleo en
  // rojo, resplandor en verde) en el plano tangente al cielo en la dirección de la grieta; un pase de pantalla completa
  // la proyecta al cielo y le suma las vetas que salen en abanico, el halo oscuro y el pulso
  let semilla = 7;
  const rnd = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
  const G = C.grieta;
  G.lienzo = null; G.tex = null; G.prog = null; G.segs = null; G.abreDib = -1;
  // forma de la fractura: la principal quebrada (giros bruscos + deriva), ramas y ramitas (hasta 3 niveles), una
  // estrella de grietas cortas en el centro y raíces largas hacia abajo a la derecha; t = cuándo aparece (0..1)
  function grietaForma() {
    semilla = 4242; const segs = [];
    const rama = (x, y, ang, L, nivel, t0, ancho, tEsc, brillo) => {
      let a = ang, px = x, py = y, rec = 0;
      const paso0 = [0.016, 0.013, 0.011, 0.009][nivel];
      while (rec < L) {
        const dl = paso0 * (0.55 + rnd() * 0.9);
        // quiebres bruscos de vez en cuando, y vuelve a su rumbo
        a += (rnd() < 0.22 ? (rnd() - 0.5) * 1.6 : (rnd() - 0.5) * 0.5) + (ang - a) * 0.3;
        const nx = px + Math.cos(a) * dl, ny = py + Math.sin(a) * dl, u = rec / L;
        segs.push({ a: [px, py], b: [nx, ny], t: t0 + rec * tEsc, w: ancho * (1 - 0.75 * u), n: nivel, i: brillo * (1 - 0.45 * u) });
        if (nivel < 3 && rnd() < [0.05, 0.055, 0.03][nivel]) {
          const s = rnd() < 0.5 ? 1 : -1;
          rama(nx, ny, a + s * (0.35 + rnd() * 0.75), L * (0.18 + rnd() * 0.32) * (1 - u * 0.45), nivel + 1, t0 + rec * tEsc + 0.03, ancho * 0.62, tEsc * 1.25, brillo * 0.85);
        }
        px = nx; py = ny; rec += dl;
      }
    };
    const ang = -0.62;
    rama(0, 0, ang, 1.0, 0, 0, 1, 0.33, 1);
    rama(0, 0, ang + Math.PI, 0.85, 0, 0, 1, 0.33, 1);
    for (let i = 0; i < 8; i++) rama((rnd() - 0.5) * 0.02, (rnd() - 0.5) * 0.02, i * 0.785 + rnd() * 0.4, 0.04 + rnd() * 0.09, 3, 0.02 + rnd() * 0.05, 0.7, 0.6, 0.9);
    // raíces: ramas largas que caen desde la mitad de abajo de la principal
    for (let i = 0; i < 4; i++) { const k = 0.18 + i * 0.14, x = Math.cos(ang) * k, y = Math.sin(ang) * k; rama(x, y, -1.3 - rnd() * 0.45, 0.35 + rnd() * 0.3, 2, 0.12 + k * 0.4, 0.75, 0.4, 0.85); }
    return segs;
  }
  // el resplandor suave (verde: cerca; azul: lejos) en un lienzo, a partir de lo abierto
  function grietaPintar(abre) {
    const N = 1024, N2 = 512;
    if (!G.lienzo) {
      const mk = (n) => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
      G.lienzo = mk(N); G.cb = mk(N2); G.segs = grietaForma(); G.lineasVB = null;
    }
    const vis = [];
    for (const g of G.segs) { if (g.t > abre) continue; const u = clamp((abre - g.t) / 0.03, 0, 1); vis.push([g, [g.a[0] + (g.b[0] - g.a[0]) * u, g.a[1] + (g.b[1] - g.a[1]) * u]]); }
    const lineas = (cv, col, ancho) => {
      const c = cv.getContext('2d'), n = cv.width;
      c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.fillStyle = '#000'; c.fillRect(0, 0, n, n);
      c.globalCompositeOperation = 'lighten'; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = col;
      const X = (p) => (p[0] * 0.5 + 0.5) * n, Y = (p) => (-p[1] * 0.5 + 0.5) * n;
      for (const [g, b] of vis) { c.lineWidth = Math.max(0.8, ancho(g) * n / 1024); c.beginPath(); c.moveTo(X(g.a), Y(g.a)); c.lineTo(X(b), Y(b)); c.stroke(); }
    };
    lineas(G.lienzo, 'rgb(0,255,0)', (g) => 2.5 * g.w + 1);
    lineas(G.cb, 'rgb(0,0,255)', (g) => 6 * g.w + 3);
    const c = G.lienzo.getContext('2d');
    const tmp = G.tmp || (G.tmp = (() => { const x = document.createElement('canvas'); x.width = x.height = N; return x; })());
    const ct = tmp.getContext('2d'); ct.globalCompositeOperation = 'source-over'; ct.filter = 'blur(5px)'; ct.clearRect(0, 0, N, N); ct.drawImage(G.lienzo, 0, 0); ct.filter = 'none';
    c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.fillRect(0, 0, N, N); c.drawImage(tmp, 0, 0);
    c.globalCompositeOperation = 'lighter'; c.filter = 'blur(22px)'; c.drawImage(G.cb, 0, 0, N, N); c.filter = 'none'; c.globalCompositeOperation = 'source-over';
    const gl = R.gl;
    if (!G.tex) G.tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.tex); R.texAct = null;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, G.lienzo);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    G.abreDib = abre;
  }
  const VS_G = `
layout(location=0) in vec2 aP; uniform mat4 uIVP; out vec3 vD;
void main(){ vec4 a = uIVP * vec4(aP, 1.0, 1.0); vD = a.xyz / a.w; gl_Position = vec4(aP, 0.99999, 1.0); }`;
  // el estallido: cientos de vetas finas (tres capas de rayos con largo y brillo propios), más hacia "arriba" del
  // desgarro; el fondo del estallido se hunde en índigo para que resalten; el resplandor de la fractura
  const FS_G = `
precision highp float; in vec3 vD; uniform vec3 uCam, uC, uE1, uE2; uniform float uAbre, uT, uPulso, uTam, uBri, uRayos, uEstr; uniform sampler2D uTex; out vec4 o;
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
// una capa de rayos: n celdas angulares, cada una con su ancho, largo, brillo y un pulso que corre hacia afuera
float rayos(float th, float r, float n, float ancho, float largo, float sem, float t) {
  float x = (th / 6.2831853 + 0.5) * n, c = mod(floor(x), n), f = fract(x) - 0.5;
  float hb = h11(c * 1.37 + sem), hl = h11(c * 2.71 + sem * 3.1), hw = h11(c * 5.13 + sem * 1.7), hp = h11(c * 7.7 + sem);
  float w = ancho * (0.35 + 0.9 * hw);
  float perfil = exp(-f * f / (w * w));
  float L = largo * (0.25 + 0.95 * hl * hl);
  float rad = smoothstep(L, L * 0.15, r) * smoothstep(0.015, 0.09, r);
  float corre = 0.65 + 0.35 * sin(r * 22.0 - t * (3.0 + hp * 3.0) + hp * 6.28);
  return perfil * rad * (0.25 + 0.75 * hb * hb) * corre;
}
vec3 estrellas(vec3 d) {
  if (uEstr <= 0.0 || d.y < 0.02) return vec3(0.0);
  float el = asin(clamp(d.y, -1.0, 1.0));
  vec2 sp = vec2(atan(d.z, d.x) * cos(el), el) * 57.2958 / 0.75;
  vec2 cell = floor(sp), f = fract(sp) - 0.5;
  float h = h21(cell);
  if (h < 0.955) return vec3(0.0);
  vec2 off = vec2(h21(cell + 3.1), h21(cell + 7.7)) - 0.5;
  float dd = length(f - off * 0.7);
  float px = max(fwidth(sp.x), fwidth(sp.y));
  float rad = (0.25 + 0.8 * h21(cell + 11.0)) * px;
  float st = smoothstep(rad + px, rad * 0.25, dd);
  float tw = 0.6 + 0.4 * sin(uT * (2.0 + 4.0 * h21(cell + 5.0)) + h * 30.0);
  float b = pow(h21(cell + 13.0), 3.0) * 2.2 + 0.25;
  return vec3(0.82, 0.88, 1.0) * st * b * tw * uEstr * smoothstep(0.06, 0.4, d.y);
}
void main(){
  vec3 d = normalize(vD - uCam);
  vec3 cE = estrellas(d);
  float cz = dot(d, uC);
  if (cz < 0.2) { o = vec4(cE, 0.0); return; }
  vec2 uv = vec2(dot(d, uE1), dot(d, uE2)) / cz / uTam;
  vec2 q = uv - vec2(-0.02, 0.06);
  float r = length(q), th = atan(q.y, q.x);
  th += (vn(vec2(r * 4.0, th * 2.0)) - 0.5) * 0.06;
  vec2 st = vec2(uv.x * 0.5 + 0.5, 0.5 - uv.y * 0.5);
  vec4 T = (st.x > 0.0 && st.x < 1.0 && st.y > 0.0 && st.y < 1.0) ? texture(uTex, st) : vec4(0.0);
  float glow = T.g, haloL = T.b;
  float A = clamp(uAbre, 0.0, 1.0);
  // el abanico: más hacia arriba del desgarro (perpendicular a la fractura, que va a -0,62 rad)
  float arriba = 0.12 + 0.88 * smoothstep(-0.25, 0.85, cos(th - 0.95));
  float ext = (0.15 + 1.25 * smoothstep(0.1, 0.75, A)) * (1.0 + 0.25 * uPulso) * uRayos;
  float v = rayos(th, r, 140.0, 0.16, ext, 1.0, uT) * 1.0
          + rayos(th, r, 330.0, 0.12, ext * 0.85, 7.0, uT * 1.3) * 0.8
          + rayos(th, r, 55.0, 0.22, ext * 1.1, 13.0, uT * 0.7) * 0.6;
  v *= arriba * smoothstep(0.05, 0.4, A);
  // núcleo del estallido: blanco celeste en el centro
  float nucleo = exp(-r * r / (0.0005 + 0.0012 * A)) * smoothstep(0.0, 0.2, A);
  // fondo: índigo profundo detrás del estallido
  float fondo = exp(-r * r / (0.18 + 0.75 * A)) * smoothstep(0.0, 0.35, A) * (0.4 + 0.6 * arriba);
  float puls = 1.0 + uPulso * 0.8;
  vec3 colV = mix(vec3(0.55, 1.05, 1.7), vec3(0.06, 0.18, 1.05), smoothstep(0.0, ext * 0.8 + 0.01, r));
  vec3 col = colV * v * 1.6 * puls;
  col += vec3(0.22, 0.6, 1.4) * glow * (0.35 + 0.45 * A) * puls;
  col += vec3(0.08, 0.16, 0.85) * haloL * (0.35 + 0.5 * A) * puls;
  col += vec3(1.2, 1.9, 2.6) * nucleo * puls;
  col *= uBri;
  float alfa = clamp(fondo * 0.62 + glow * 0.2, 0.0, 0.8);
  col += vec3(0.02, 0.01, 0.10) * fondo;
  col += cE * (1.0 - clamp(fondo * 0.8 + v * 2.0, 0.0, 1.0));
  o = vec4(col, alfa);
}`;
  // las líneas de la fractura: geometría en el cielo con ancho en píxeles (nítidas a cualquier zoom), dos pasadas
  // (resplandor angosto y núcleo blanco), con parpadeo eléctrico y el tramo de la frontera que crece
  const VS_L = `
layout(location=0) in vec3 aA; layout(location=1) in vec3 aB; layout(location=2) in vec4 aK; layout(location=3) in vec2 aS;
uniform mat4 uVP; uniform vec2 uPx; uniform float uAbre, uAnchoK, uT;
out float vX; out float vW; out float vI;
void main(){
  float t0 = aK.z, w = aK.x * uAnchoK, I = aK.y;
  float u = clamp((uAbre - t0) / 0.03, 0.0, 1.0);
  vec4 pA = uVP * vec4(aA, 0.0), pB0 = uVP * vec4(aB, 0.0);
  vec3 dB = normalize(mix(aA, aB, u)); vec4 pB = uVP * vec4(dB, 0.0);
  if (u <= 0.0 || pA.w < 0.02 || pB.w < 0.02) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vX = 0.0; vW = 1.0; vI = 0.0; return; }
  vec2 sA = pA.xy / pA.w * 0.5 * uPx, sB = pB.xy / pB.w * 0.5 * uPx;
  vec2 dir = sB - sA; float L = length(dir); dir = L > 1e-4 ? dir / L : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  float lado = aS.x, ext = aS.y, med = w * 0.5 + 1.5;
  vec2 s = mix(sA - dir * med * 0.6, sB + dir * med * 0.6, ext) + n * lado * med;
  gl_Position = vec4(s / (0.5 * uPx), 0.99999, 1.0);
  vX = lado * med; vW = w * 0.5;
  float parpa = 0.75 + 0.25 * sin(uT * (23.0 + aK.w * 17.0) + aK.w * 40.0) * sin(uT * 7.0 + aK.w * 9.0);
  vI = I * parpa;
}`;
  const FS_L = `
precision highp float; in float vX; in float vW; in float vI; uniform vec3 uCol; uniform float uDuro; out vec4 o;
void main(){ float x = abs(vX) / max(vW, 0.35); float k = uDuro > 0.5 ? exp(-x * x * 2.2) : exp(-x * x * 0.9); o = vec4(uCol * k * vI, 0.0); }`;
  function lineasArmar() {
    const gl = R.gl, S = G.segs, F = 12;   // (por vértice: aA 3, aB 3, aK 4, aS 2)
    const V = new Float32Array(S.length * 6 * F);
    const dir = (p) => { const t = G.tam || 0.78; return vadd(G.dir, vadd(vscale(G.e1, p[0] * t), vscale(G.e2, p[1] * t))).norm(); };
    let k = 0;
    S.forEach((g, i) => {
      const A = dir(g.a), B = dir(g.b), K = [g.w, g.i, g.t, (i * 0.618) % 1];
      for (const [lado, ext] of [[-1, 0], [1, 0], [1, 1], [-1, 0], [1, 1], [-1, 1]]) { V.set([A.x, A.y, A.z, B.x, B.y, B.z, K[0], K[1], K[2], K[3], lado, ext], k); k += F; }
    });
    if (!G.lvao) { G.lvao = gl.createVertexArray(); G.lvb = gl.createBuffer(); }
    gl.bindVertexArray(G.lvao); gl.bindBuffer(gl.ARRAY_BUFFER, G.lvb); gl.bufferData(gl.ARRAY_BUFFER, V, gl.STATIC_DRAW);
    const st = F * 4; gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, st, 24); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, st, 40);
    gl.bindVertexArray(null); R.vaoAct = null; G.lineasN = S.length * 6; G.lineasClave = [G.dir.x, G.dir.y, G.dir.z, G.e1.x, G.e1.y, G.e1.z, G.tam].join(',');
  }
  function grietaDibujar(IVP) {
    if (R.salida !== 'hdr') return;
    const gl = R.gl;
    if (Math.abs(G.abre - G.abreDib) > 0.0005 || !G.tex) grietaPintar(G.abre);
    if (!G.prog) G.prog = shader(VS_G, FS_G, []);
    const P = G.prog; gl.useProgram(P.p); R.progAct = P;
    gl.uniformMatrix4fv(P.u.uIVP, false, IVP);
    gl.uniform3f(P.u.uCam, R.camPos.x, R.camPos.y, R.camPos.z);
    const c = G.dir, e1 = G.e1, e2 = G.e2;
    gl.uniform3f(P.u.uC, c.x, c.y, c.z); gl.uniform3f(P.u.uE1, e1.x, e1.y, e1.z); gl.uniform3f(P.u.uE2, e2.x, e2.y, e2.z);
    gl.uniform1f(P.u.uAbre, G.abre); gl.uniform1f(P.u.uT, G.t); gl.uniform1f(P.u.uPulso, G.pulso); gl.uniform1f(P.u.uTam, G.tam || 0.78); gl.uniform1f(P.u.uBri, G.brillo); gl.uniform1f(P.u.uRayos, G.rayos === undefined ? 1 : G.rayos); gl.uniform1f(P.u.uEstr, G.estrellas || 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.tex); R.texAct = null; gl.uniform1i(P.u.uTex, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false); gl.depthFunc(gl.LEQUAL); gl.bindVertexArray(R.quad); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null); R.vaoAct = null;
    // las líneas
    const clave = [G.dir.x, G.dir.y, G.dir.z, G.e1.x, G.e1.y, G.e1.z, G.tam].join(',');
    if (!G.lvao || G.lineasClave !== clave) lineasArmar();
    if (!G.lprog) G.lprog = shader(VS_L, FS_L, []);
    const L = G.lprog; gl.useProgram(L.p); R.progAct = L;
    gl.uniformMatrix4fv(L.u.uVP, false, R.vp); gl.uniform2f(L.u.uPx, R.cv.width, R.cv.height); gl.uniform1f(L.u.uAbre, G.abre); gl.uniform1f(L.u.uT, G.t);
    const kz = Math.sqrt(Math.max(1, 52 / (C.fov || CAM.fov || 52))) * (R.cv.height / C.kFmt() / 804);   // (mismo grosor por grado que en 2,39:1)
    gl.blendFunc(gl.ONE, gl.ONE); gl.disable(gl.CULL_FACE); gl.bindVertexArray(G.lvao);
    const pul = 1 + G.pulso * 1.4;
    // resplandor angosto (cian) y núcleo (blanco)
    gl.uniform1f(L.u.uAnchoK, 7.0 * kz); gl.uniform1f(L.u.uDuro, 0); gl.uniform3f(L.u.uCol, 0.18 * pul * G.brillo, 0.55 * pul * G.brillo, 1.25 * pul * G.brillo); gl.drawArrays(gl.TRIANGLES, 0, G.lineasN);
    gl.uniform1f(L.u.uAnchoK, 1.9 * kz); gl.uniform1f(L.u.uDuro, 1); gl.uniform3f(L.u.uCol, 3.0 * pul * G.brillo, 4.0 * pul * G.brillo, 5.0 * pul * G.brillo); gl.drawArrays(gl.TRIANGLES, 0, G.lineasN);
    gl.bindVertexArray(null); R.vaoAct = null; gl.enable(gl.CULL_FACE);
    gl.depthMask(true); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND);
  }
  // la dirección de la grieta en el cielo (y su plano): elevación y rumbo en radianes, giro del dibujo
  C.grietaDir = (az, el, giro) => {
    const c = v3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).norm();
    let e1 = vcross(v3(0, 1, 0), c).norm(); let e2 = vcross(c, e1).norm();
    const g = giro || 0, cg = Math.cos(g), sg = Math.sin(g);
    const f1 = vadd(vscale(e1, cg), vscale(e2, sg)), f2 = vadd(vscale(e1, -sg), vscale(e2, cg));
    G.dir = c; G.e1 = f1; G.e2 = f2; return c;
  };
  C.grietaDir(0, 0.6, 0);

  // ---------------- captura con acumulación (suavizado + desenfoque de movimiento) ----------------
  C.acc = null; C.tUlt = null; C.escena = null;
  const hal = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  // un cuadro del video en el tiempo t0 del plano: n subcuadros repartidos en "obt" del cuadro (0,5 = obturador de
  // 180°), cada uno corrido una fracción de píxel distinta (puntos de Halton), promediados. Antes de cada subcuadro,
  // C.escena(t, dt) pone la cámara, la grieta y los objetos de ese instante
  C.renderCuadro = (t0, n, obt, q, fps) => {
    const W = R.cv.width, H = R.cv.height, fd = 1 / (fps || 24);
    if (!C.acc || C.acc.width !== W || C.acc.height !== H) { C.acc = document.createElement('canvas'); C.acc.width = W; C.acc.height = H; }
    const ctx = C.acc.getContext('2d');
    for (let i = 0; i < n; i++) {
      const ti = t0 + (n > 1 ? i * fd * obt / n : 0), dt = C.tUlt === null ? fd : Math.max(0, ti - C.tUlt);
      C.jx = n > 1 ? hal(i + 1, 2) - 0.5 : 0; C.jy = n > 1 ? hal(i + 1, 3) - 0.5 : 0;
      if (C.escena) C.conJugSuave(dt, () => C.escena(ti, dt));
      window.__T += dt * 1000; C.saltar = false; cuadro(window.__T); C.tUlt = ti;
      ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(R.cv, 0, 0);
    }
    C.jx = C.jy = 0; ctx.globalAlpha = 1;
    return q === 0 ? 1 : C.acc.toDataURL('image/jpeg', q || 0.95);
  };
  // avanzar el tiempo sin dibujar (para dejar que las cosas se acomoden antes del plano)
  C.avanzar = (t, dt) => { if (C.escena) C.conJugSuave(dt, () => C.escena(t, dt)); window.__T += dt * 1000; C.saltar = true; cuadro(window.__T); C.saltar = false; C.tUlt = t; };
  return 'ok';
})();
