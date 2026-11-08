// ---------------------------------------------------------------------------------------------------------
// Evento 3.0: la grieta en el cielo de los mapas del juego y las cosas que caen de ella de vez en cuando (de 1 a 6).
// Los mapas de GMod (gm_construct, gm_flatgrass), los del Workshop y la pizzería no la tienen: ahí está su cielo.
// La grieta es un efecto propio (el del tráiler, sin copiar el de nadie): la forma de la fractura (una quebrada con
// ramas, con semilla) se pinta una vez en un lienzo y se difumina; el estallido de vetas se hornea en la placa en una
// pasada a una textura, la primera vez. Cada cuadro se dibuja sólo el cuadrado del cielo donde está —una lectura de
// textura y unas cuentas: el pulso que corre por las vetas, el núcleo y el fondo oscuro— y encima las líneas nítidas de
// la fractura (geometría con ancho en píxeles). Lo que cae: el que reparte en la sala (el de ID más chico; solo, uno
// mismo) decide cuándo, cuántas, cuáles y dónde (lejos de los jugadores y con cielo abierto arriba) y lo manda; cada
// juego dibuja la misma caída (sin física, con estela de fuego y humo) y en el golpe el que repartió pone la cosa de
// verdad (a los demás les llega por la red como cualquier objeto suyo); las que explotan, explotan en cada juego a la vez.
// ---------------------------------------------------------------------------------------------------------
const EVT = { mapa: null, grieta: false, caidas: false, dir: v3(0, 0.45, 1).norm(), e1: v3(1, 0, 0), e2: v3(0, 1, 0), tam: 0.34,
  segs: null, tex: null, texN: 0, prog: null, lprog: null, qvao: null, qvb: null, lvao: null, lvb: null, lN: 0,
  pulso: 0, prox: 1e9, cola: [], vivos: [], ms: 0, dib: 0 };
const EVT_S = 1.95;   // (la textura cubre el plano de la grieta de -1,95 a 1,95: las vetas más largas llegan a ~1,85)
// las cosas que caen: [nombre, peso, tamaño del fuego, probabilidad de explotar, tamaño de la explosión]
const EVT_COSAS = [['CajaMadera', 6, 1.2], ['Barril', 4, 1.1], ['Neumatico', 4, 1.0], ['Roca', 3, 1.8], ['Lavarropas', 3, 1.3], ['Heladera', 2, 1.4],
  ['Sofa', 2, 1.6], ['Carrito', 2, 1.2], ['Sandia', 2, 0.7], ['Cono', 2, 0.7], ['Radiador', 1, 1.0], ['Arcade', 1, 1.5], ['Contenedor', 1, 2.6],
  ['BarrilExplosivo', 3, 1.0, 0.8, 1.6], ['Garrafa', 2, 0.9, 0.8, 1.3], ['BidonNafta', 1, 0.8, 0.8, 1.1], ['Sedan', 1, 2.6, 0.4, 2.2]];
// ¿este mapa tiene la grieta? (los del juego, salvo los de GMod y la pizzería, que es bajo techo) ¿y caídas? (no en el espacio)
const evtConGrieta = (m) => (MAPAS.includes(m) || MAPAS_RB.includes(m)) && !MAPAS_GMOD.includes(m) && m !== 'RB_Pizzeria';
const evtConCaidas = (m) => evtConGrieta(m) && m !== 'Space';
const evtActivo = () => PREFS.evento !== false;
// (un modo que no va con cosas cayendo: la noche de la pizzería, el creador de mapas, un modo de juego de GMod, el editor)
const evtQuieto = () => (typeof NOC !== 'undefined' && NOC.on) || (typeof CREA !== 'undefined' && CREA.on) || (typeof EDA !== 'undefined' && EDA.on) || (typeof GMM !== 'undefined' && !!GMM.actual);
function evtHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

// ---------------- al entrar a un mapa ----------------
function eventoIniciar() {
  const m = MUNDO.nombre || ''; EVT.mapa = m;
  EVT.grieta = evtConGrieta(m); EVT.caidas = evtConCaidas(m);
  for (const c of EVT.cola) c.vis = null;
  EVT.cola.length = 0; EVT.vivos.length = 0; EVT.pulso = 0;
  // la primera, al rato de entrar (para que se vea que pasa); después, cada tanto
  EVT.prox = TIEMPO.t + 35 + Math.random() * 40;
  if (!EVT.grieta) return;
  // dónde: hacia adelante de la aparición (la que tiene dirección) o hacia donde se mira al entrar por primera vez,
  // corrida según el mapa, a 24–31° de altura; si cae cerca del sol, se corre al costado
  const s0 = MUNDO.spawns && MUNDO.spawns[0], h = evtHash(m);
  let az = (s0 && s0.yaw !== undefined ? s0.yaw : 0) + (h - 0.5) * 1.1, el = 0.42 + 0.12 * evtHash(m + '#');
  const dirDe = (a) => v3(Math.cos(el) * Math.sin(a), Math.sin(el), Math.cos(el) * Math.cos(a)).norm();
  let c = dirDe(az);
  if (R.sol && vdot(c, R.sol) > 0.8) { az += 1.25; c = dirDe(az); }
  const giro = -0.25 + 0.5 * evtHash(m + '@');
  let e1 = vcross(v3(0, 1, 0), c).norm(); const e2 = vcross(c, e1).norm(), cg = Math.cos(giro), sg = Math.sin(giro);
  EVT.dir = c; EVT.e1 = vadd(vscale(e1, cg), vscale(e2, sg)).norm(); EVT.e2 = vadd(vscale(e1, -sg), vscale(e2, cg)).norm();
  EVT.lN = 0;   // (las líneas se rearman con la dirección nueva)
  // (la textura se hornea ya, al entrar —la entrada al mapa ya es una pausa—, y no cuando se la mira por primera vez)
  if (!EVT.tex && evtActivo() && R.gl) { try { evtHornear(); } catch (e) { if (typeof cnAnotar === 'function') cnAnotar('evento', String(e && e.message || e).slice(0, 160)); } }
}

// ---------------- la forma de la fractura (la misma del tráiler: semilla 4242) ----------------
function evtForma() {
  let sem = 4242; const rnd = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
  const segs = [];
  const rama = (x, y, ang, L, nivel, ancho, brillo) => {
    let a = ang, px = x, py = y, rec = 0;
    const paso0 = [0.016, 0.013, 0.011, 0.009][nivel];
    while (rec < L) {
      const dl = paso0 * (0.55 + rnd() * 0.9);
      a += (rnd() < 0.22 ? (rnd() - 0.5) * 1.6 : (rnd() - 0.5) * 0.5) + (ang - a) * 0.3;
      const nx = px + Math.cos(a) * dl, ny = py + Math.sin(a) * dl, u = rec / L;
      segs.push({ a: [px, py], b: [nx, ny], w: ancho * (1 - 0.75 * u), i: brillo * (1 - 0.45 * u) });
      if (nivel < 3 && rnd() < [0.05, 0.055, 0.03][nivel]) {
        const s = rnd() < 0.5 ? 1 : -1;
        rama(nx, ny, a + s * (0.35 + rnd() * 0.75), L * (0.18 + rnd() * 0.32) * (1 - u * 0.45), nivel + 1, ancho * 0.62, brillo * 0.85);
      }
      px = nx; py = ny; rec += dl;
    }
  };
  const ang = -0.62;
  // (los mismos pasos que el tráiler, en el mismo orden, para que salga la misma forma: los números al azar de los tiempos de
  // aparición se siguen sacando aunque acá no se usen)
  rama(0, 0, ang, 1.0, 0, 1, 1);
  rama(0, 0, ang + Math.PI, 0.85, 0, 1, 1);
  for (let i = 0; i < 8; i++) { const x = (rnd() - 0.5) * 0.02, y = (rnd() - 0.5) * 0.02, a = i * 0.785 + rnd() * 0.4, L = 0.04 + rnd() * 0.09; rnd(); rama(x, y, a, L, 3, 0.7, 0.9); }
  for (let i = 0; i < 4; i++) { const k = 0.18 + i * 0.14, x = Math.cos(ang) * k, y = Math.sin(ang) * k, a = -1.3 - rnd() * 0.45, L = 0.35 + rnd() * 0.3; rama(x, y, a, L, 2, 0.75, 0.85); }
  return segs;
}
// difuminado de una capa (tres pasadas de caja de radio r, horizontal y vertical: casi una gaussiana)
function evtBorronear(A, n, r) {
  if (r < 1) return;
  const B = new Float32Array(A.length), w = 2 * r + 1;
  for (let pas = 0; pas < 3; pas++) {
    for (let y = 0; y < n; y++) {
      const o = y * n; let s = 0;
      for (let x = -r; x <= r; x++) s += A[o + clamp(x, 0, n - 1)];
      for (let x = 0; x < n; x++) { B[o + x] = s / w; s += A[o + Math.min(n - 1, x + r + 1)] - A[o + Math.max(0, x - r)]; }
    }
    for (let x = 0; x < n; x++) {
      let s = 0;
      for (let y = -r; y <= r; y++) s += B[clamp(y, 0, n - 1) * n + x];
      for (let y = 0; y < n; y++) { A[y * n + x] = s / w; s += B[Math.min(n - 1, y + r + 1) * n + x] - B[Math.max(0, y - r) * n + x]; }
    }
  }
}
// el resplandor de la fractura (G: angosto; B: el halo ancho): cada tramo se rasteriza acá (sólo los píxeles cerca de él,
// con la punta redonda como el lienzo) y se difumina; el lienzo 2D tardaba 0,7 s con los 663 trazos y la mezcla «lighten»
function evtRaster(n, ancho) {
  const A = new Float32Array(n * n), k = n / (2 * EVT_S), X = (p) => (p[0] / EVT_S * 0.5 + 0.5) * n, Y = (p) => (-p[1] / EVT_S * 0.5 + 0.5) * n;
  for (const g of EVT.segs) {
    const ax = X(g.a), ay = Y(g.a), bx = X(g.b), by = Y(g.b), hw = Math.max(0.3, ancho(g) * k * 0.5), dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-6;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - hw - 1)), x1 = Math.min(n - 1, Math.ceil(Math.max(ax, bx) + hw + 1));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - hw - 1)), y1 = Math.min(n - 1, Math.ceil(Math.max(ay, by) + hw + 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay; let t = (px * dx + py * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = px - t * dx, ey = py - t * dy, c = hw + 0.5 - Math.sqrt(ex * ex + ey * ey);
      if (c > 0) { const i = y * n + x, v = c > 1 ? 1 : c; if (v > A[i]) A[i] = v; }
    }
  }
  return A;
}
function evtLienzo(n) {
  const k = n / (2 * EVT_S);
  // (los mismos anchos y difuminados del tráiler, pasados a unidades del plano: allá 512 px por unidad el angosto, 256 el ancho)
  const G = evtRaster(n, (g) => (2.5 * g.w + 1) / 512); evtBorronear(G, n, Math.max(1, Math.round(Math.sqrt(12 * (5 / 512 * k) ** 2 / 3 + 1) / 2)));
  const B = evtRaster(n, (g) => (6 * g.w + 3) / 256); evtBorronear(B, n, Math.max(2, Math.round(Math.sqrt(12 * (22 / 512 * k) ** 2 / 3 + 1) / 2)));
  const u8 = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) { u8[i * 4 + 1] = Math.min(255, G[i] * 255 + 0.5); u8[i * 4 + 2] = Math.min(255, B[i] * 255 + 0.5); u8[i * 4 + 3] = 255; }
  // (fila 0 = arriba del plano)
  return u8;
}
const VS_EVT_H = `
layout(location=0) in vec2 aP; out vec2 vU;
void main(){ vU = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;
// el estallido de vetas horneado: tres capas de rayos (cada celda con su ancho, largo y brillo), más hacia "arriba" del
// desgarro; se guarda la raíz (más precisión en lo tenue) y la fase de cada veta para el pulso que corre
const FS_EVT_H = `
precision highp float; in vec2 vU; uniform sampler2D uTex; uniform float uS; out vec4 o;
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float rayos(float th, float r, float n, float ancho, float largo, float sem) {
  float x = (th / 6.2831853 + 0.5) * n, c = mod(floor(x), n), f = fract(x) - 0.5;
  float hb = h11(c * 1.37 + sem), hl = h11(c * 2.71 + sem * 3.1), hw = h11(c * 5.13 + sem * 1.7);
  float w = ancho * (0.35 + 0.9 * hw);
  float L = largo * (0.25 + 0.95 * hl * hl);
  return exp(-f * f / (w * w)) * smoothstep(L, L * 0.15, r) * smoothstep(0.015, 0.09, r) * (0.25 + 0.75 * hb * hb);
}
void main(){
  vec2 uv = (vU * 2.0 - 1.0) * uS, q = uv - vec2(-0.02, 0.06);
  float r = length(q), th = atan(q.y, q.x);
  th += (vn(vec2(r * 4.0, th * 2.0)) - 0.5) * 0.06;
  float arriba = 0.12 + 0.88 * smoothstep(-0.25, 0.85, cos(th - 0.95));
  float v = (rayos(th, r, 140.0, 0.16, 1.4, 1.0) + rayos(th, r, 330.0, 0.12, 1.19, 7.0) * 0.8 + rayos(th, r, 55.0, 0.22, 1.54, 13.0) * 0.6) * arriba;
  float x = (th / 6.2831853 + 0.5) * 140.0, ph = h11(mod(floor(x), 140.0) * 7.7 + 1.0);
  vec4 T = texture(uTex, vec2(vU.x, 1.0 - vU.y));
  o = vec4(sqrt(clamp(v / 2.4, 0.0, 1.0)), T.g, T.b, ph);
}`;
// el cuadrado del cielo donde está la grieta (en el infinito: sólo gira con la vista, como el cielo)
const VS_EVT = `
layout(location=0) in vec2 aQ; uniform mat4 uVP; uniform vec3 uC, uE1, uE2; uniform float uTam; out vec2 vQ;
void main(){ vQ = aQ; vec4 c = uVP * vec4(uC + (uE1 * aQ.x + uE2 * aQ.y) * uTam, 0.0); gl_Position = vec4(c.xy, c.w * 0.99999, c.w); }`;
const FS_EVT = `
precision highp float; in vec2 vQ; uniform sampler2D uTex; uniform float uTiempo, uPulso, uBri, uS, uExpo, uFondo; out vec4 o;
void main(){
  vec4 T = texture(uTex, vQ / (2.0 * uS) + 0.5);
  vec2 q = vQ - vec2(-0.02, 0.06); float r2 = dot(q, q), r = sqrt(r2);
  float corre = 0.65 + 0.35 * sin(r * 22.0 - uTiempo * (3.0 + T.a * 3.0) + T.a * 6.28);
  float v = T.r * T.r * 2.4 * corre;
  float arriba = 0.12 + 0.88 * smoothstep(-0.25, 0.85, (q.x * 0.5817 + q.y * 0.8134) / max(r, 0.0001));
  float nucleo = exp(-r2 / 0.0017), fondo = exp(-r2 / 0.93) * (0.4 + 0.6 * arriba), puls = 1.0 + uPulso * 0.8;
  vec3 colV = mix(vec3(0.55, 1.05, 1.7), vec3(0.06, 0.18, 1.05), smoothstep(0.0, 1.13, r));
  vec3 col = colV * v * 1.6 * puls + vec3(0.22, 0.6, 1.4) * T.g * 0.8 * puls + vec3(0.08, 0.16, 0.85) * T.b * 0.85 * puls + vec3(1.2, 1.9, 2.6) * nucleo * puls;
  col = col * uBri + vec3(0.03, 0.012, 0.11) * fondo;
  float alfa = clamp(fondo * uFondo + T.g * 0.25, 0.0, 0.92);
#if SALIDA == 2
  o = vec4(col, alfa);
#else
  o = vec4(pow(1.0 - exp(-col * uExpo), vec3(0.4545)), alfa);
#endif
}`;
// las líneas de la fractura: con ancho en píxeles (nítidas a cualquier distancia), dos pasadas (resplandor y núcleo
// blanco) y el parpadeo eléctrico de cada tramo
const VS_EVT_L = `
layout(location=0) in vec3 aA; layout(location=1) in vec3 aB; layout(location=2) in vec4 aK; layout(location=3) in vec2 aS;
uniform mat4 uVP; uniform vec2 uPx; uniform float uAnchoK, uTiempo; out float vX; out float vW; out float vI;
void main(){
  vec4 pA = uVP * vec4(aA, 0.0), pB = uVP * vec4(aB, 0.0);
  if (pA.w < 0.02 || pB.w < 0.02) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vX = 0.0; vW = 1.0; vI = 0.0; return; }
  vec2 sA = pA.xy / pA.w * 0.5 * uPx, sB = pB.xy / pB.w * 0.5 * uPx;
  vec2 dir = sB - sA; float L = length(dir); dir = L > 0.0001 ? dir / L : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  float w = aK.x * uAnchoK, med = w * 0.5 + 1.5;
  vec2 s = mix(sA - dir * med * 0.6, sB + dir * med * 0.6, aS.y) + n * aS.x * med;
  gl_Position = vec4(s / (0.5 * uPx), 0.99999, 1.0);
  vX = aS.x * med; vW = w * 0.5;
  vI = aK.y * (0.75 + 0.25 * sin(uTiempo * (23.0 + aK.w * 17.0) + aK.w * 40.0) * sin(uTiempo * 7.0 + aK.w * 9.0));
}`;
const FS_EVT_L = `
precision mediump float; in float vX; in float vW; in float vI; uniform vec3 uCol; uniform float uDuro, uExpo; out vec4 o;
void main(){ float x = abs(vX) / max(vW, 0.35); vec3 c = uCol * (uDuro > 0.5 ? exp(-x * x * 2.2) : exp(-x * x * 0.9)) * vI;
#if SALIDA == 2
  o = vec4(c, 0.0);
#else
  o = vec4(pow(1.0 - exp(-c * uExpo), vec3(0.4545)), 0.0);
#endif
}`;
// hornear la textura (una vez por partida: la forma no cambia)
function evtHornear() {
  const gl = R.gl, n = (typeof COARSE !== 'undefined' && COARSE) || (GFX.luz || 0) < 2 ? 512 : 1024;
  if (!EVT.segs) EVT.segs = evtForma();
  const u8 = evtLienzo(n);
  const tG = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tG); R.texAct = null;
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, u8);
  for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
  const fb = gl.createFramebuffer(), fbAntes = gl.getParameter(gl.FRAMEBUFFER_BINDING), vpAntes = gl.getParameter(gl.VIEWPORT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  let ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  if (ok) {
    try {
      const P = shader(VS_EVT_H, FS_EVT_H, []); gl.useProgram(P.p); R.progAct = P;
      gl.uniform1f(P.u.uS, EVT_S); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tG); R.texAct = null; gl.uniform1i(P.u.uTex, 0);
      gl.viewport(0, 0, n, n); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
      gl.bindVertexArray(R.quad); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null); R.vaoAct = null;
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.deleteProgram(P.p); R.progAct = null;
    } catch (e) { ok = false; if (typeof cnAnotar === 'function') cnAnotar('evento', 'horneado: ' + String(e && e.message || e).slice(0, 160)); }
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbAntes); gl.viewport(vpAntes[0], vpAntes[1], vpAntes[2], vpAntes[3]); gl.deleteFramebuffer(fb);
  if (!ok) { gl.deleteTexture(t); EVT.tex = tG; } else { gl.deleteTexture(tG); EVT.tex = t; }   // (sin la pasada: sólo el resplandor, sin vetas)
  EVT.texN = n;
  // el cuadrado (dos triángulos) del plano de la grieta
  EVT.qvao = gl.createVertexArray(); gl.bindVertexArray(EVT.qvao); EVT.qvb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, EVT.qvb);
  const S = EVT_S; gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-S, -S, S, -S, S, S, -S, -S, S, S, -S, S]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0); gl.bindVertexArray(null); R.vaoAct = null;
}
function evtLineasArmar() {
  const gl = R.gl, S = EVT.segs, F = 12, V = new Float32Array(S.length * 6 * F), t = EVT.tam;
  const dir = (p) => vadd(EVT.dir, vadd(vscale(EVT.e1, p[0] * t), vscale(EVT.e2, p[1] * t))).norm();
  let k = 0;
  S.forEach((g, i) => {
    const A = dir(g.a), B = dir(g.b), f = (i * 0.618) % 1;
    for (const [lado, ext] of [[-1, 0], [1, 0], [1, 1], [-1, 0], [1, 1], [-1, 1]]) { V.set([A.x, A.y, A.z, B.x, B.y, B.z, g.w, g.i, 0, f, lado, ext], k); k += F; }
  });
  if (!EVT.lvao) { EVT.lvao = gl.createVertexArray(); EVT.lvb = gl.createBuffer(); }
  gl.bindVertexArray(EVT.lvao); gl.bindBuffer(gl.ARRAY_BUFFER, EVT.lvb); gl.bufferData(gl.ARRAY_BUFFER, V, gl.STATIC_DRAW);
  const st = F * 4; gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, st, 24); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, st, 40);
  gl.bindVertexArray(null); R.vaoAct = null; EVT.lN = S.length * 6;
}
// ---------------- dibujar la grieta (después del cielo, antes de lo transparente) ----------------
function eventoCieloDibujar() {
  if (!EVT.grieta || !evtActivo() || JUEGO.estado !== 'juego' || MUNDO.nombre !== EVT.mapa) return;
  // (detrás de la vista: nada; el cuadrado abarca unos ±35° alrededor de la grieta)
  if (vdot(CAM.fwd, EVT.dir) < -0.25) return;
  const t0 = performance.now(), gl = R.gl;
  if (!EVT.tex) evtHornear();
  const sal = R.salida === 'hdr' ? 2 : R.salida === 'ldr' ? 1 : 0, kp = 'evt|' + sal;
  if (!EVT.prog || EVT.prog.k !== kp) { EVT.prog = shader(VS_EVT, FS_EVT, ['SALIDA=' + sal]); EVT.prog.k = kp; EVT.lprog = shader(VS_EVT_L, FS_EVT_L, ['SALIDA=' + sal]); }
  const P = EVT.prog, T = TIEMPO.t, puls = EVT.pulso, expo = sal === 1 ? R.expo || 1 : 0.95;
  gl.useProgram(P.p); R.progAct = P;
  gl.uniformMatrix4fv(P.u.uVP, false, R.vp);
  gl.uniform3f(P.u.uC, EVT.dir.x, EVT.dir.y, EVT.dir.z); gl.uniform3f(P.u.uE1, EVT.e1.x, EVT.e1.y, EVT.e1.z); gl.uniform3f(P.u.uE2, EVT.e2.x, EVT.e2.y, EVT.e2.z);
  gl.uniform1f(P.u.uTam, EVT.tam); gl.uniform1f(P.u.uS, EVT_S); gl.uniform1f(P.u.uTiempo, T % 1000); gl.uniform1f(P.u.uPulso, puls); gl.uniform1f(P.u.uBri, 1); if (P.u.uExpo) gl.uniform1f(P.u.uExpo, expo);
  // (de día el desgarro oscurece más el cielo detrás, para que se lea; de noche ya se lee solo)
  gl.uniform1f(P.u.uFondo, 0.62 + 0.26 * clamp(1 - (R.noche || 0), 0, 1));
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, EVT.tex); R.texAct = null; gl.uniform1i(P.u.uTex, 0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
  gl.bindVertexArray(EVT.qvao); gl.drawArrays(gl.TRIANGLES, 0, 6);
  // las líneas (en Patata no: con el resplandor alcanza)
  if ((GFX.luz || 0) >= 1 || sal) {
    if (!EVT.lN) evtLineasArmar();
    const L = EVT.lprog; gl.useProgram(L.p); R.progAct = L;
    gl.uniformMatrix4fv(L.u.uVP, false, R.vp); gl.uniform2f(L.u.uPx, R.cv.width, R.cv.height); gl.uniform1f(L.u.uTiempo, T % 1000); if (L.u.uExpo) gl.uniform1f(L.u.uExpo, expo);
    // (el grosor sigue al tamaño de la grieta en pantalla: píxeles por unidad del plano, como en el tráiler a 643)
    const ppu = EVT.tam / Math.tan(((CAM.fov || 70) * Math.PI / 180) / 2) * R.cv.height / 2, kz = ppu / 643, pul = 1 + puls * 1.4;
    gl.blendFunc(gl.ONE, gl.ONE); gl.bindVertexArray(EVT.lvao);
    gl.uniform1f(L.u.uAnchoK, Math.max(2.4, 7.0 * kz)); gl.uniform1f(L.u.uDuro, 0); gl.uniform3f(L.u.uCol, 0.18 * pul, 0.55 * pul, 1.25 * pul); gl.drawArrays(gl.TRIANGLES, 0, EVT.lN);
    gl.uniform1f(L.u.uAnchoK, Math.max(1.1, 1.9 * kz)); gl.uniform1f(L.u.uDuro, 1); gl.uniform3f(L.u.uCol, 3.0 * pul, 4.0 * pul, 5.0 * pul); gl.drawArrays(gl.TRIANGLES, 0, EVT.lN);
  }
  gl.bindVertexArray(null); R.vaoAct = null; gl.enable(gl.CULL_FACE);
  gl.depthMask(true); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND);
  EVT.ms = performance.now() - t0; EVT.dib++;
}

// ---------------- las caídas ----------------
// el que reparte: solo, uno mismo; en una sala, el de ID más chico de los que están (si dos se creen que reparten, el
// de ID más grande se calla apenas le llega una caída del otro)
function evtReparto() {
  if (typeof RED === 'undefined' || !RED.on) return true;
  let m = RED.ID; for (const id of RED.remotos.keys()) if (id < m) m = id;
  return m === RED.ID;
}
// ¿el modelo de esta cosa está acá? (si viene en un paquete que no se bajó, se pide y por ahora va otra)
function evtCosaLista(n) {
  const k = DATA.pfPorNombre[n]; if (!k) return false;
  for (const x of DATA.pf[k]) { const m = x.m >= 0 && DATA.ms[x.m]; if (m && m.k && typeof rbListo === 'function' && !rbListo(m.k)) { if (typeof rbPedir === 'function') rbPedir(m.k); return false; } }
  return true;
}
function evtElegirCosa() {
  const L = EVT_COSAS.filter((c) => evtCosaLista(c[0])); if (!L.length) return null;
  let s = 0; for (const c of L) s += c[1];
  let r = Math.random() * s; for (const c of L) { r -= c[1]; if (r <= 0) return c; }
  return L[L.length - 1];
}
// dónde cae: cerca de algún jugador (9 a 32 m), en el piso, a más de 8 m de todos y con el camino al cielo libre
function evtLugar(jug, desdeDir) {
  for (let i = 0; i < 14; i++) {
    const P = jug[(Math.random() * jug.length) | 0], a = Math.random() * 6.2832, d = 9 + Math.random() * 23;
    const x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d, alto = P.y + 70;
    const h = mundoRayo(v3(x, alto, z), v3(0, -1, 0), 160); if (!h) continue;
    const y = alto - h.t; if (Math.abs(y - P.y) > 18) continue;
    if (jug.some((q) => Math.hypot(q.x - x, q.z - z) < 8)) continue;
    const p = v3(x, y, z);
    // (el cielo, abierto en la dirección de donde viene)
    if (mundoRayo(vadd(p, v3(0, 0.6, 0)), desdeDir, 140)) continue;
    return p;
  }
  return null;
}
// una caída nueva (el que reparte)
function eventoLanzar(n) {
  if (!EVT.caidas) return 0;
  const jug = [JUG.pos.clone()]; if (typeof RED !== 'undefined' && RED.on) for (const R2 of RED.remotos.values()) if (R2.b) jug.push(R2.b.pos.clone());
  // (de la grieta, pero más desde arriba: que llueva)
  const desdeDir = vadd(EVT.dir, v3(0, 1.3, 0)).norm(), l = [];
  for (let i = 0; i < n; i++) {
    const c = evtElegirCosa(); if (!c) break;
    const p = evtLugar(jug, desdeDir); if (!p) continue;
    const lat = vcross(desdeDir, v3(0, 1, 0)).norm(), desde = vadd(p, vadd(vscale(desdeDir, 150), vscale(lat, (Math.random() - 0.5) * 30)));
    const ex = c[3] && Math.random() < c[3] ? c[4] : 0;
    l.push([c[0], +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +desde.x.toFixed(1), +desde.y.toFixed(1), +desde.z.toFixed(1), +(1.4 + i * 0.45 + Math.random() * 0.7).toFixed(2), +(2.7 + Math.random() * 0.6).toFixed(2), ex]);
  }
  if (!l.length) return 0;
  if (typeof RED !== 'undefined' && RED.on && typeof publicar === 'function') publicar('a', { k: 'cae', l });
  evtRecibir(l, true);
  return l.length;
}
// de la red: lo que mandó el que reparte
function eventoRed(d) {
  if (!Array.isArray(d.l) || !EVT.caidas || !evtActivo()) return;
  // (llegó una del de ID más chico: yo no reparto, y la próxima la decide él)
  if (typeof RED !== 'undefined' && d.i < RED.ID) EVT.prox = TIEMPO.t + 240;
  const l = [];
  for (const x of d.l.slice(0, 6)) {
    if (!Array.isArray(x) || x.length < 10 || typeof x[0] !== 'string') continue;
    const f = (i, a, b) => num(x[i], a, b, NaN); const v = [x[0].slice(0, 40), f(1, -1e4, 1e4), f(2, -1e4, 1e4), f(3, -1e4, 1e4), f(4, -1e4, 1e4), f(5, -1e4, 1e4), f(6, -1e4, 1e4), f(7, 0, 15), f(8, 1, 6), f(9, 0, 4)];
    if (v.some((y) => typeof y === 'number' && isNaN(y))) continue;
    l.push(v);
  }
  if (l.length) evtRecibir(l, false);
}
function evtRecibir(l, mia) {
  EVT.pulso = 1; evtSonido('zumbido', null);
  for (const x of l) {
    const def = EVT_COSAS.find((c) => c[0] === x[0]), sz = def ? def[2] : 1.2;
    const hasta = v3(x[1], x[2], x[3]), desde = v3(x[4], x[5], x[6]), t0 = TIEMPO.t + x[7], T = x[8];
    const c = { nombre: x[0], suelo: hasta.clone(), hasta, desde, t0, t1: t0 + T, g: -16, sz, ex: x[9], mia, estado: 0, vis: null, q0: Quat.euler(Math.random() * 6.28, Math.random() * 2 - 1, Math.random() * 2 - 1),
      giro: v3(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3), ult: null, acF: 0, acH: 0, silbo: false };
    EVT.cola.push(c);
  }
}
// el modelo que cae (sólo para dibujar: sin física ni red) y su centro; la altura del centro sobre el piso al pegar
function evtVisual(c) {
  if (!evtCosaLista(c.nombre)) return null;
  const k = DATA.pfPorNombre[c.nombre], F = formaDe(c.nombre), md = new Modelo(DATA.pf[k]); md.p[0] = [0, 0, 0]; md.sinSombra = true;
  let r = 0.3; for (const p of puntosForma(F.shape)) r = Math.max(r, p.len());
  return { md, F, r };
}
// (el giro del cuerpo de física para un giro del dibujo: las cápsulas van con su eje acostado, como en crearObjeto)
function evtQCuerpo(F, q) {
  if (!F.ejeCap) return q;
  const a = F.ejeCap, d = vdot(a, v3(0, 1, 0)); if (d >= 0.999) return q;
  const ax = vcross(v3(0, 1, 0), a).norm(); return q.clone().mul(Quat.axis(ax.x, ax.y, ax.z, Math.acos(clamp(d, -1, 1))));
}
const _evM = new Float32Array(16), _evC = new Float32Array(16);
function evtPose(c, p, q) {
  const V = c.vis; if (!V) return;
  m4trs([p.x, p.y, p.z], [q.x, q.y, q.z, q.w], [1, 1, 1], _evM);
  m4trs([-V.F.c.x, -V.F.c.y, -V.F.c.z], [0, 0, 0, 1], [1, 1, 1], _evC);
  m4mul(_evM, _evC, V.md.raiz); V.md.sucio = true;
}
const evtPos = (c, t) => { const s = t - c.t0; return v3(c.desde.x + c.v0.x * s, c.desde.y + c.v0.y * s + 0.5 * c.g * s * s, c.desde.z + c.v0.z * s); };
// fuego y humo de algo que arde (la estela: más espaciada lejos de la cámara, así el total no se dispara)
function evtLlama(p, v, sz, k, estela) {
  const az = (a, b) => a + Math.random() * (b - a), rv = (s) => v3(az(-s, s), az(-s, s), az(-s, s));
  const x = particula(vadd(p, rv(0.35 * sz)), vadd(vscale(v, 0.12), vadd(rv(1.2), v3(0, 1.2, 0))), az(0.3, 0.65), az(0.45, 0.9) * sz * (k || 1), estela ? [1, 0.8, 0.55, 0.6] : [1, 1, 1, 1], 'fuego', 1.3);
  if (x) { x.rampa = 1; x.fr = 3; x.suave = 1; }
}
function evtHumo(p, v, sz) {
  const az = (a, b) => a + Math.random() * (b - a), rv = (s) => v3(az(-s, s), az(-s, s), az(-s, s));
  const x = particula(vadd(p, rv(0.3 * sz)), vadd(vscale(v, 0.04), vadd(rv(0.8), v3(0, 1.0, 0))), az(0.9, 1.6), az(0.45, 0.75) * sz, [0.32, 0.29, 0.28, 0.42], 'humo', 1.8);
  if (x) { x.calor = 0.35; x.fr = 1.1; }
}
// cuántas caen: casi siempre una o dos, a veces seis (34 %, 24 %, 16 %, 11 %, 8 %, 7 %)
const evtCuantas = () => { const r = Math.random(); return r < 0.34 ? 1 : r < 0.58 ? 2 : r < 0.74 ? 3 : r < 0.85 ? 4 : r < 0.93 ? 5 : 6; };
function eventoPaso(dt) {
  if (MUNDO.nombre !== EVT.mapa) eventoIniciar();
  if (EVT.pulso > 0) EVT.pulso = Math.max(0, EVT.pulso - dt * 0.45);
  if (JUEGO.estado !== 'juego') return;
  const t = TIEMPO.t;
  // ¿toca una caída? (de 1 a 6: casi siempre pocas, a veces muchas)
  if (EVT.caidas && evtActivo() && t >= EVT.prox) {
    EVT.prox = t + 100 + Math.random() * 160;
    if (evtReparto() && !evtQuieto()) eventoLanzar(evtCuantas());
  }
  const Q = EVT.cola; if (!Q.length) return;
  const parte = Math.max(0.25, GFX.part || 0.5);
  for (const c of Q) {
    if (t < c.t0 || c.estado === 3) continue;
    if (c.estado === 0) {
      c.vis = evtVisual(c);
      const r = c.vis ? c.vis.r : 0.5; c.hasta = v3(c.suelo.x, c.suelo.y + r * 0.8, c.suelo.z);
      const T = c.t1 - c.t0, d = vsub(c.hasta, c.desde); c.v0 = v3(d.x / T, (d.y - 0.5 * c.g * T * T) / T, d.z / T);
      c.estado = 1;
    }
    if (c.estado === 1) {
      const tt = Math.min(t, c.t1), p = evtPos(c, tt), s = tt - c.t0, v = v3(c.v0.x, c.v0.y + c.g * s, c.v0.z);
      c.q = c.q0.clone().mul(Quat.axis(c.giro.x, c.giro.y, c.giro.z, c.giro.len() * s)); c.p = p; c.v = v;
      evtPose(c, p, c.q);
      // la estela: puntos a lo largo del camino desde el cuadro anterior (más espaciados cuanto más lejos de la cámara)
      if (c.ult) {
        const seg = vsub(p, c.ult), L = seg.len(), dc = p.distTo(CAM.pos), esp = clamp(dc * 0.025, 0.45 * c.sz, 5) / parte, kz = Math.max(1, dc / 40);
        c.acF += L; c.acH += L;
        while (c.acF >= esp) { c.acF -= esp; evtLlama(vsub(p, vscale(seg, c.acF / Math.max(L, 1e-6))), v, c.sz * kz, 1, true); }
        while (c.acH >= esp * 3) { c.acH -= esp * 3; evtHumo(vsub(p, vscale(seg, c.acH / Math.max(L, 1e-6))), v, c.sz * kz); }
      }
      c.ult = p.clone();
      if (!c.silbo && c.t1 - t < 1.7) { c.silbo = true; evtSonido('silbido', c.hasta); }
      if (t >= c.t1) evtPega(c);
    } else if (c.estado === 2) {
      // ardiendo un rato en el piso; y, si no la puse yo, hasta que llegue la de verdad por la red
      const e = t - c.tPego, p = c.o && !c.o.borrado ? c.o.b.pos : c.hasta, k = Math.max(0, 1 - e / 3.5);
      if (k > 0 && Math.random() < dt * 22 * k * parte) evtLlama(vadd(p, v3(0, 0.3, 0)), v3(), c.sz * 0.8, k);
      if (k > 0 && Math.random() < dt * 8 * k * parte) evtHumo(vadd(p, v3(0, 0.6, 0)), v3(), c.sz);
      if (c.vis && !c.mia && (evtLlegoLaReal(c) || e > 3)) c.vis = null;
      if (k <= 0 && !c.vis) c.estado = 3;
    }
  }
  for (let i = Q.length - 1; i >= 0; i--) if (Q[i].estado === 3) Q.splice(i, 1);
}
// ¿ya llegó por la red el objeto del que repartió? (el mismo, cerca de donde cayó)
function evtLlegoLaReal(c) {
  if (typeof RED === 'undefined' || !RED.objs) return true;
  for (const o of RED.objs.values()) if (o.nombre === c.nombre && !o.borrado && o.b.pos.distTo(c.hasta) < 7 && o.creado >= c.tPego - 1) return true;
  return false;
}
function evtPega(c) {
  c.estado = 2; c.tPego = TIEMPO.t; const p = c.p || c.hasta;
  if (c.ex > 0) {
    // (explota en cada juego a la vez: sin mandarla por la red, que ya la hace cada uno)
    c.vis = null; explosion.remota = true; try { explosion(c.suelo.clone().add(v3(0, 0.5, 0)), 4.5 * c.ex, 55 * c.ex); } finally { explosion.remota = false; }
    return;
  }
  CAM.temblor = Math.max(CAM.temblor || 0, clamp(1 - p.distTo(CAM.pos) / 40, 0, 0.6));
  evtSonido('golpe', p);
  // el polvo del golpe
  const x = particula(v3(c.suelo.x, c.suelo.y + 0.2, c.suelo.z), v3(), 0.6, 2.2 * c.sz, [0.78, 0.68, 0.55, 0.55], 'humo', 4); if (x) { x.tile = 3; x.modo = 2; x.suave = 1; x.grav = 0; }
  for (let i = 0; i < 6; i++) { const y = particula(vadd(c.suelo, v3(0, 0.3, 0)), v3(Math.random() * 6 - 3, 2 + Math.random() * 3, Math.random() * 6 - 3), 0.9 + Math.random() * 0.6, 0.6 * c.sz, [0.55, 0.48, 0.4, 0.5], 'humo', 2.2); if (y) { y.fr = 2.4; y.suave = 1; } }
  if (!c.vis) return;
  if (!c.mia) {
    // (la que se ve hasta que llegue la de verdad: apoyada en el piso como va a quedar aquélla)
    const qb = evtQCuerpo(c.vis.F, c.q); let minY = 1e9; for (const v of puntosForma(c.vis.F.shape)) minY = Math.min(minY, qb.rot(v).y);
    c.p = v3(p.x, c.suelo.y - minY + 0.02, p.z); evtPose(c, c.p, c.q); return;
  }
  // la de verdad (la pongo yo, que repartí): donde estaba la que caía, apoyada en el piso, con un poco del envión
  const o = crearObjeto(c.nombre, c.suelo, c.q.clone());
  c.vis = null; if (!o) return;
  const b = o.b; let minY = 1e9; for (const v of puntosForma(o.F.shape)) minY = Math.min(minY, b.q.rot(v).y);
  b.pos.set(p.x, c.suelo.y - minY + 0.02, p.z); b.vel.copy(vscale(c.v, 0.12)); b.vel.y = Math.abs(c.v.y) * 0.08;
  b.ang.set(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3); b.updateWorld(); b.wake(); o.md.sucio = true;
  c.o = o; EVT.vivos.push(o);
  if (typeof redObjeto === 'function') redObjeto();
  // (no se juntan para siempre: las más viejas se van)
  while (EVT.vivos.length > 12) { const v = EVT.vivos.shift(); if (v && !v.borrado && OBJS.includes(v)) borrarObjeto(v); }
}
// los modelos que caen (en la fase de juntar lo que se dibuja)
function eventoEncolar() {
  for (const c of EVT.cola) if (c.vis && c.estado >= 1) c.vis.md.encolar();
}
// la luz de lo que cae (en Alto y más)
function eventoLuces() {
  if (!(GFX.nluz > 0) || GFX.luz < 2) return;
  for (const c of EVT.cola) if (c.estado === 1 && c.p) luzPuntual(c.p, 10 * c.sz, [5, 2.4, 0.8]);
}
// sonidos hechos acá (Web Audio): el zumbido grave de la grieta, el silbido de lo que viene y el golpe
function evtSonido(tipo, pos) {
  if (typeof AUD === 'undefined' || !AUD.ctx || !PREFS.vol) return;
  try {
    const c = AUD.ctx, t = c.currentTime, dur = tipo === 'zumbido' ? 3.2 : tipo === 'silbido' ? 1.7 : 0.9;
    const N = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, N, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = buf; const f = c.createBiquadFilter(), g = c.createGain();
    if (tipo === 'zumbido') {
      f.type = 'lowpass'; f.frequency.value = 90; f.Q.value = 6;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else if (tipo === 'silbido') {
      f.type = 'bandpass'; f.Q.value = 2.5; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(380, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + dur * 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else {
      f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(120, t + 0.5);
      g.gain.setValueAtTime(1.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.6);
      og.gain.setValueAtTime(1.2, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); o.connect(og);
      if (pos) og.connect(fuente3D(pos, 1).g); else og.connect(AUD.master);
      o.start(t); o.stop(t + 0.75);
    }
    s.connect(f); f.connect(g);
    if (pos) g.connect(fuente3D(pos, tipo === 'silbido' ? 1.6 : 1).g); else g.connect(AUD.master);
    s.start(t); s.stop(t + dur);
  } catch (e) {}
}
// (pruebas y el menú: forzar una caída ya)
function eventoForzar(n) { EVT.prox = TIEMPO.t + 100; return eventoLanzar(clamp(n | 0 || 1, 1, 6)); }
Object.assign(IDI3, {
  'aj.evento': ['Evento 3.0: la grieta y lo que cae del cielo', 'Event 3.0: the rift and things falling from the sky', 'Evento 3.0: a fenda e o que cai do céu', 'Event 3.0: retakan dan benda jatuh dari langit',
    'Acara 3.0: rekahan dan benda jatuh dari langit', 'Event 3.0: ang lamat at mga nahuhulog mula sa langit', 'イベント3.0：空の裂け目と落ちてくる物', 'อีเวนต์ 3.0: รอยแยกและของที่ตกจากฟ้า', 'Etkinlik 3.0: yarık ve gökten düşenler',
    'حدث 3.0: الصدع وما يسقط من السماء', 'Событие 3.0: разлом и то, что падает с неба', 'Подія 3.0: розлом і те, що падає з неба', 'Événement 3.0 : la faille et ce qui tombe du ciel', 'Event 3.0: der Riss und was vom Himmel fällt'],
});
