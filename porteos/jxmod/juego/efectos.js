// ---------------------------------------------------------------------------------------------------------
// efectos: partículas en carteles (humo, fuego, chispas, polvo), fogonazo del arma, trazas de bala.
// Un solo búfer dinámico y un atlas de 4 texturas hechas acá (punto suave, bocanada de humo, llama y anillo); cada
// partícula gira, las chispas se estiran a lo largo de su velocidad y la onda de una explosión va plana en el piso.
// En "patata" se crean muchas menos.
// ---------------------------------------------------------------------------------------------------------
// (aX: giro, cuadro del atlas —-1 = la textura entera— y modo: 0 cartel, 1 estirada por aS, 2 plana en el piso)
const VS_PART = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec4 aC; layout(location=2) in vec3 aE; layout(location=3) in vec3 aX; layout(location=4) in vec3 aS;
uniform mat4 uVP; uniform vec3 uDer, uArr, uCam; out vec4 vC; out vec2 vU; out vec2 vF;
void main(){ vC = aC; vec2 e = aE.xy; float s = aE.z, c = cos(aX.x), sn = sin(aX.x); vec2 r = vec2(e.x * c - e.y * sn, e.x * sn + e.y * c);
  vec2 uv = e * 0.5 + 0.5; vU = aX.y < -0.5 ? uv : (vec2(mod(aX.y, 2.0), floor(aX.y * 0.5)) + uv * 0.96 + 0.02) * 0.5;
  vec3 p;
  if (aX.z > 1.5) p = aP + vec3(r.x, 0.0, r.y) * s;
  else if (aX.z > 0.5) { float l = length(aS); vec3 dn = l > 0.00001 ? aS / l : uArr; vec3 a = normalize(cross(dn, aP - uCam) + vec3(0.000001)); p = aP + a * (e.x * s) + dn * (e.y * (l * 0.5 + s)) - aS * 0.5; }
  else p = aP + (uDer * r.x + uArr * r.y) * s;
  vF = aX.z < 0.5 && aS.y > 0.5 ? vec2(p.y - aS.x, s * 0.45) : vec2(1.0, 0.001);
  gl_Position = uVP * vec4(p, 1.0); }`;
const FS_PART = `#version 300 es
precision mediump float; in vec4 vC; in vec2 vU; in vec2 vF; uniform sampler2D uT; uniform float uLin, uBri; out vec4 o;
void main(){ vec4 t = texture(uT, vU); o = vec4(vC.rgb * t.rgb, vC.a * t.a * clamp(vF.x / vF.y, 0.0, 1.0)); if (uLin > 0.5) o.rgb = pow(o.rgb, vec3(2.2)) * uBri; }`;
const PART_F = 16;   // (números por vértice)
const PART = { l: [], max: 600, buf: null, vao: null, data: new Float32Array(900 * 6 * PART_F), tex: {}, orden: [] };
const partTope = () => (GFX.part >= 0.8 ? 900 : 600) * GFX.part;
// el atlas (256×256, cuadros de 128): 0 punto suave, 1 bocanada de humo (ruido fractal, más clara arriba), 2 llama
// (ruido turbulento con el centro caliente y los bordes deshilachados), 3 anillo (la onda en el piso)
function efectosAtlas() {
  const N = 256, T = 128, u8 = new Uint8Array(N * N * 4);
  let sem = 1234567; const azar = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  const G = 32, tab = new Float32Array(G * G); for (let i = 0; i < tab.length; i++) tab[i] = azar();
  const vr = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), g = (a, b) => tab[(b & (G - 1)) * G + (a & (G - 1))];
    return (g(xi, yi) * (1 - sx) + g(xi + 1, yi) * sx) * (1 - sy) + (g(xi, yi + 1) * (1 - sx) + g(xi + 1, yi + 1) * sx) * sy; };
  const fbm = (x, y, o) => { let s = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < o; i++) { s += a * vr(x * f, y * f); t += a; f *= 2.03; a *= 0.5; } return s / t; };
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const pon = (tx, ty, f) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const c = f((x + 0.5) / T * 2 - 1, (y + 0.5) / T * 2 - 1), o = ((ty * T + y) * N + tx * T + x) * 4; for (let k = 0; k < 4; k++) u8[o + k] = Math.round(Math.min(1, Math.max(0, c[k])) * 255); } };
  pon(0, 0, (x, y) => { const d = Math.hypot(x, y); return [1, 1, 1, d >= 1 ? 0 : d < 0.45 ? 1 - d : 0.55 * (1 - (d - 0.45) / 0.55)]; });
  pon(1, 0, (x, y) => { const d = Math.hypot(x, y), n = fbm(x * 2.1 + 5, y * 2.1 + 9, 5), m = ss(1, 0.3, d + (n - 0.5) * 0.6), a = ss(0.1, 0.62, m * (0.5 + n * 0.8));
    const l = 0.6 + 0.4 * ss(0.25, 0.8, n) + 0.16 * y; return [l, l, l * 0.98, a]; });
  pon(0, 1, (x, y) => { const d = Math.hypot(x, y), n = fbm(x * 2.8 + 17, y * 2.8 + 3, 5), t = 1 - Math.abs(fbm(x * 4.5 + 40, y * 4.5 + 11, 4) * 2 - 1), m = ss(1, 0.15, d + (n - 0.5) * 0.75);
    const a = ss(0.04, 0.7, m * (0.3 + 0.7 * n) + t * 0.3 * m), l = 0.55 + 0.45 * ss(0.25, 0.85, m * n + t * 0.35); return [l, l, l, a]; });
  pon(1, 1, (x, y) => { const d = Math.hypot(x, y), n = fbm(x * 5 + 70, y * 5 + 2, 3); return [1, 1, 1, d > 1 ? 0 : Math.max(0, 1 - Math.abs(d - 0.76) / 0.22) ** 2 * (0.55 + 0.45 * n)]; });
  const gl = R.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, u8); gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function efectosIniciar() {
  const gl = R.gl; PART.prog = shader(VS_PART, FS_PART);
  PART.vao = gl.createVertexArray(); gl.bindVertexArray(PART.vao); PART.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, PART.buf);
  const B = PART_F * 4; [[0, 3, 0], [1, 4, 12], [2, 3, 28], [3, 3, 40], [4, 3, 52]].forEach(([l, n, o]) => { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, B, o); });
  gl.bindVertexArray(null);
  PART.tex.punto = PART.tex.atlas = efectosAtlas();
  const fi = DATA.tx.findIndex((t) => /MuzzleFlash2/.test(t.n)); PART.fogTex = fi;
}
// tipo: 'humo' y 'gota' (alfa; la gota cae y se ve desde el primer cuadro), 'fuego'/'chispa'/'fog' (suma).
// Devuelve la partícula para ajustarla: fr (freno del aire), rampa (fuego que se enfría: blanco → naranja → rojo),
// calor (s en que el humo sale iluminado por el fuego), suave (crece rápido y después despacio), piso (rebota ahí),
// estela (deja humo), t negativo (aparece después), tile/modo (cuadro del atlas y forma)
function particula(p, v, vida, tam, col, tipo, crece) {
  if (PART.l.length >= partTope()) return null;
  tipo = tipo || 'humo'; const humo = tipo === 'humo';
  const q = { p: p.clone(), v: v.clone(), vida, t: 0, tam, col, tipo, crece: crece === undefined ? (humo ? 1.8 : 0.3) : crece, grav: tipo === 'chispa' || tipo === 'gota' ? 1 : humo ? -0.05 : 0,
    rot: humo ? (Math.random() - 0.5) * 1.4 : Math.random() * 6.2832, dr: (Math.random() - 0.5) * (humo ? 0.5 : 1.6), tile: humo ? 1 : tipo === 'fuego' ? 2 : 0, modo: tipo === 'chispa' ? 1 : 0, fr: 0, rampa: 0, calor: 0, suave: 0, piso: null, estela: 0, suelo: null };
  PART.l.push(q); return q;
}
function efectosPaso(dt) {
  const L = PART.l;
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i]; q.t += dt; if (q.t >= q.vida) { L[i] = L[L.length - 1]; L.pop(); continue; }
    if (q.t < 0) continue;
    q.v.y -= GRAV * q.grav * dt; if (q.fr) q.v.scale(Math.exp(-dt * q.fr)); else if (q.tipo === 'humo') q.v.scale(Math.exp(-dt * 1.5));
    q.p.addS(q.v, dt); q.rot += q.dr * dt;
    if (q.piso !== null && q.p.y < q.piso && q.v.y < 0) { q.p.y = q.piso; q.v.y *= -0.3; q.v.x *= 0.55; q.v.z *= 0.55; if (q.tipo === 'chispa' && Math.abs(q.v.y) < 0.8) q.vida = Math.min(q.vida, q.t + 0.15); }
    if (q.estela && (q.et = (q.et || 0) - dt) <= 0 && q.t < q.vida * 0.8) { q.et = 0.035; const h = particula(q.p, v3(0, 0.25, 0), 0.6, q.estela, [0.3, 0.29, 0.28, 0.4], 'humo', 1.6); if (h) { h.calor = 0.2; h.dr = 0; h.modo = 1; h.sv = vscale(q.v, 0.04); h.grav = 0; } }   // (cada bocanada estirada hasta la anterior: una estela seguida)
  }
  if (EF.fog > 0) EF.fog -= dt;
  for (let i = LUCES_T.length - 1; i >= 0; i--) { LUCES_T[i].t -= dt; if (LUCES_T[i].t <= 0) LUCES_T.splice(i, 1); }
  for (let i = TRAZAS.length - 1; i >= 0; i--) { TRAZAS[i].t -= dt; if (TRAZAS[i].t <= 0) TRAZAS.splice(i, 1); }
}
// el fuego que se enfría (rampa) y la luz con la que se ve el humo (el cielo y el sol del momento: de noche, oscuro)
const _RAMPA = [[0, 1, 0.97, 0.86], [0.12, 1, 0.8, 0.38], [0.42, 0.96, 0.4, 0.09], [1, 0.32, 0.07, 0.02]];
function partRampa(k, o) { let i = 1; while (i < 3 && k > _RAMPA[i][0]) i++; const a = _RAMPA[i - 1], b = _RAMPA[i], f = Math.min(1, Math.max(0, (k - a[0]) / (b[0] - a[0]))); for (let j = 0; j < 3; j++) o[j] = a[j + 1] + (b[j + 1] - a[j + 1]) * f; return o; }
const _PC = [0, 0, 0], _PL = [1, 1, 1];
function partLuz() { const A = R.ambS, S = R.solCol; for (let j = 0; j < 3; j++) _PL[j] = A && S ? Math.min(1.15, 0.12 + A[j] * 1.4 + S[j] * 0.5) : 1; return _PL; }
// escribe los 6 vértices de un cartel en D desde n (vértices); devuelve el nuevo n
function partVertices(D, n, x, y, z, r, g, b, a, s, rot, tile, modo, sx, sy, sz) {
  for (let v = 0; v < 6; v++) { const o = (n + v) * PART_F; D[o] = x; D[o + 1] = y; D[o + 2] = z; D[o + 3] = r; D[o + 4] = g; D[o + 5] = b; D[o + 6] = a; D[o + 7] = ESQ[v * 2]; D[o + 8] = ESQ[v * 2 + 1]; D[o + 9] = s; D[o + 10] = rot; D[o + 11] = tile; D[o + 12] = modo; D[o + 13] = sx; D[o + 14] = sy; D[o + 15] = sz; }
  return n + 6;
}
function dibujarEfectos() {
  const L = PART.l;
  if (PART.extra && PART.extra.length) dibujarCarteles();
  if (!L.length) return;
  const gl = R.gl, P = PART.prog, D = PART.data, tope = Math.min(D.length / PART_F, 900 * 6), luz = partLuz(), cam = CAM.pos;
  const pasada = (aditivo) => {
    // (las de alfa de lejos a cerca, para que se encimen bien)
    const O = PART.orden; O.length = 0;
    for (const q of L) { if (q.t < 0 || (q.tipo !== 'humo' && q.tipo !== 'gota') !== aditivo) continue; O.push(q); }
    if (!O.length) return;
    if (!aditivo && O.length > 1 && O.length < 700) { for (const q of O) q.d2 = (q.p.x - cam.x) ** 2 + (q.p.y - cam.y) ** 2 + (q.p.z - cam.z) ** 2; O.sort((a, b) => b.d2 - a.d2); }
    let n = 0;
    for (const q of O) {
      if (n + 6 > tope) break;
      const k = q.t / q.vida, gota = q.tipo === 'gota', c = q.col;
      let a, r = c[0], g = c[1], b = c[2];
      if (gota) a = c[3] * (1 - k * k);
      else if (!aditivo) { a = c[3] * Math.min(1, k * 7) * (1 - k * k); r *= luz[0]; g *= luz[1]; b *= luz[2]; if (q.calor && q.t < q.calor) { const h = (1 - q.t / q.calor) ** 2; r += (1 - r) * h * 0.9; g += (0.48 - g) * h * 0.9; b += (0.16 - b) * h * 0.9; } }
      else if (q.rampa) { partRampa(k, _PC); r *= _PC[0]; g *= _PC[1]; b *= _PC[2]; a = c[3] * (1 - k) ** 1.2; }
      else a = c[3] * (1 - k);
      const s = q.tam * (1 + q.crece * (q.suave ? 1 - (1 - k) * (1 - k) : k));
      // (las chispas, estiradas a lo largo de su velocidad; el humo que toca el piso se desvanece contra él en vez de cortarse)
      if (q.modo === 1) { const e = q.sv ? 1 : 0.06, w = q.sv || q.v; n = partVertices(D, n, q.p.x, q.p.y, q.p.z, r, g, b, a, s, q.rot, q.tile, 1, w.x * e, w.y * e, w.z * e); }
      else n = partVertices(D, n, q.p.x, q.p.y, q.p.z, r, g, b, a, s, q.rot, q.tile, q.modo, q.suelo ?? 0, q.suelo === null ? 0 : 1, 0);
    }
    if (!n) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, PART.buf); gl.bufferData(gl.ARRAY_BUFFER, D.subarray(0, n * PART_F), gl.STREAM_DRAW);
    gl.blendFunc(gl.SRC_ALPHA, aditivo ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); gl.uniform1f(P.u.uBri, aditivo ? 5 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, n);
  };
  gl.useProgram(P.p); R.progAct = P; gl.uniformMatrix4fv(P.u.uVP, false, R.vp); gl.uniform1f(P.u.uLin, R.salida === 'hdr' ? 1 : 0);
  gl.uniform3f(P.u.uDer, CAM.der.x, CAM.der.y, CAM.der.z); gl.uniform3f(P.u.uArr, CAM.arr.x, CAM.arr.y, CAM.arr.z); gl.uniform3f(P.u.uCam, cam.x, cam.y, cam.z);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, PART.tex.atlas); R.texAct = null;
  gl.bindVertexArray(PART.vao); gl.enable(gl.BLEND); gl.depthMask(false); gl.disable(gl.CULL_FACE);
  pasada(false); pasada(true);
  gl.enable(gl.CULL_FACE); gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null); R.vaoAct = null;
}
function dibujarCarteles() {
  const gl = R.gl, P = PART.prog, D = PART.data;
  gl.useProgram(P.p); R.progAct = P; gl.uniformMatrix4fv(P.u.uVP, false, R.vp); gl.uniform1f(P.u.uLin, R.salida === 'hdr' ? 1 : 0); gl.uniform1f(P.u.uBri, 1);
  gl.uniform3f(P.u.uDer, CAM.der.x, CAM.der.y, CAM.der.z); gl.uniform3f(P.u.uArr, 0, 1, 0); gl.uniform3f(P.u.uCam, CAM.pos.x, CAM.pos.y, CAM.pos.z);
  gl.bindVertexArray(PART.vao); gl.bindBuffer(gl.ARRAY_BUFFER, PART.buf); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE);
  for (const c of PART.extra) {
    partVertices(D, 0, c.p.x, c.p.y, c.p.z, 1, 1, 1, 1, c.s, 0, -1, 0, 0, 0, 0);
    gl.bufferData(gl.ARRAY_BUFFER, D.subarray(0, 6 * PART_F), gl.STREAM_DRAW); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, c.tex); gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.bindVertexArray(null); R.vaoAct = null; R.texAct = null; PART.extra.length = 0;
}
const ESQ = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];
const EF = { fog: 0 }, TRAZAS = [], LUCES_T = [];
// luces que duran un rato (explosiones, chispazos) y las de cada cuadro (fogonazo, lámparas, faros)
function luzTemporal(p, r, c, dur) { LUCES_T.push({ p: p.clone(), r, c, t: dur, dur }); }
function lucesJuntar() {
  R.luces.length = 0; R.esp.length = 0; nocheLucesEsp(); linternaLuces();
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
// explosión (RPG, granadas, barriles, env_explosion, los addons): destello, bola de fuego que sale rápido, frena y se
// enfría, humo iluminado por el fuego que sube y se abre, chispas que caen y rebotan; en Bajo y más, la onda en el piso
// y el polvo que corre por el suelo; en Medio y más, escombros con estela de humo; en Alto y más, brasas que flotan.
// esc: tamaño (1 = una granada de HL2)
function efectoExplosion(p, esc) {
  esc = esc > 0 ? Math.min(6, esc) : 1;
  const q = GFX.part || 0.5, n = (x) => Math.max(1, Math.round(x * q)), az = (a, b) => a + Math.random() * (b - a);
  const y0 = typeof pisoBajo === 'function' ? pisoBajo(v3(p.x, p.y + 0.5, p.z), 6 * esc) : null, enPiso = y0 !== null && p.y - y0 < 2.5 * esc, piso = y0 ?? p.y - 1;
  const dir = () => { const d = v3(az(-1, 1), az(enPiso ? -0.15 : -1, 1), az(-1, 1)); return d.len() < 0.05 ? v3(0, 1, 0) : d.norm(); };
  let x;
  // destello (un instante) y su luz
  x = particula(p, v3(), 0.14, 4.5 * esc, [1, 0.93, 0.78, 1], 'fog', 0.7);
  for (let i = 0, m = n(24); i < m; i++) { const d = dir(); x = particula(vadd(p, vscale(d, az(0, 0.45) * esc)), vadd(vscale(d, az(3, 10.5) * esc), v3(0, az(0.5, 2.2), 0)), az(0.45, 1), az(0.65, 1.3) * esc, [1, 1, 1, 1], 'fuego', 1.7); if (x) { x.fr = 4.2; x.rampa = 1; x.suave = 1; x.suelo = piso; } }
  // (el humo: gris oscuro iluminado por el cielo, sube como columna y se abre; no tapa toda la pantalla)
  for (let i = 0, m = n(16); i < m; i++) { const d = dir(); x = particula(vadd(p, vscale(d, az(0.2, 0.8) * esc)), vadd(vscale(d, az(1.2, 4) * esc), v3(0, az(1.8, 3.6), 0)), az(3, 6) * (q >= 0.8 ? 1 : 0.7), az(0.8, 1.35) * esc, [0.3, 0.29, 0.28, 0.72], 'humo', 1.9); if (x) { x.fr = 1.5; x.calor = 0.85; x.suave = 1; x.t = -az(0.03, 0.28); x.grav = -0.2; x.suelo = piso; } }
  for (let i = 0, m = n(28); i < m; i++) { x = particula(p, vscale(dir(), az(8, 22) * Math.sqrt(esc)), az(0.5, 1.4), 0.032 * Math.sqrt(esc), [1, 0.78, 0.4, 1], 'chispa', 0); if (x) { x.fr = 0.7; x.piso = piso + 0.02; } }
  if (enPiso && q >= 0.5) {
    x = particula(v3(p.x, piso + 0.07, p.z), v3(), 0.5, 1.2 * esc, [0.78, 0.68, 0.55, 0.5], 'humo', 8); if (x) { x.tile = 3; x.modo = 2; x.suave = 1; x.calor = 0.12; x.fr = 0; x.grav = 0; x.dr = 0; }
    for (let i = 0, m = n(14); i < m; i++) { const u = Math.random() * 6.2832, d = v3(Math.cos(u), 0, Math.sin(u)); x = particula(vadd(v3(p.x, piso + 0.35 * esc, p.z), vscale(d, 0.8 * esc)), vscale(d, az(5, 11) * esc), az(1.6, 3), az(0.55, 1) * esc, [0.55, 0.48, 0.4, 0.5], 'humo', 2.4); if (x) { x.fr = 2.6; x.grav = -0.02; x.suave = 1; x.t = -az(0, 0.08); x.suelo = piso; } }
  }
  if (q >= 0.8) for (let i = 0, m = n(10); i < m; i++) { const d = dir(); d.y = Math.abs(d.y) + 0.4; x = particula(p, vscale(d.norm(), az(7, 15) * Math.sqrt(esc)), az(1.2, 2.2), az(0.05, 0.11) * esc, [0.07, 0.06, 0.05, 1], 'gota', 0); if (x) { x.piso = piso + 0.03; x.estela = 0.16 * esc; x.tile = 1; x.dr = az(-6, 6); } }
  if (q >= 1) for (let i = 0, m = n(16); i < m; i++) { x = particula(vadd(p, vscale(dir(), az(0.3, 1.5) * esc)), v3(az(-1, 1), az(0.5, 2), az(-1, 1)), az(2, 4), 0.025, [1, 0.55, 0.15, 1], 'chispa', 0); if (x) { x.grav = -0.03; x.fr = 1.2; x.modo = 0; x.t = -az(0.2, 0.8); } }
  luzTemporal(vadd(p, v3(0, 1, 0)), 24 * esc, [46, 26, 9], 0.8);
  luzTemporal(vadd(p, v3(0, 0.6, 0)), 9 * esc, [7, 3, 1], 2.2);
  const dj = CAM.pos.distTo(p); CAM.temblor = Math.max(CAM.temblor || 0, clamp(1.3 - dj / (28 * esc), 0, 1));
}
function efectoCongelar(b) { for (let i = 0; i < 8; i++) particula(vadd(b.pos, v3((Math.random() - 0.5) * b.r, (Math.random() - 0.5) * b.r, (Math.random() - 0.5) * b.r)), v3(0, 0.4, 0), 0.6, 0.08, [0.5, 0.85, 1, 1], 'fog', 0.5); }
