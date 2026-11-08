// Cielos nuevos por mapa (Discord, noviembre de 2026: «cielos diferentes a cada mapa, uno más goty con nubes dibujadas por
// vos que tapen el ambiente, pero 2D, que aparecen y desaparecen como las volumétricas, súper mega optimizado»).
//  1. cada mapa propio (los 8 del juego y los 7 de JXMod, sin gm_construct ni gm_flatgrass) tiene su preset, distinto de los
//     demás (colores o nubes); gm_construct y gm_flatgrass siguen con su cielo de caja, sin preset
//  2. lo que tapan las nubes (en la textura del cielo, por ángulo sólido, de 15° a 90° de altura) está a ±0,10 de lo que
//     pide el preset en ese momento (la capa de abajo; la de arriba, ±0,12), en cada mapa con nubes
//  3. cambian con el tiempo: sin viento, en 60 s se forma ≥ 10 % de nubes nuevas y se deshace ≥ 10 % de las que había,
//     con lo tapado a ±0,08 de lo pedido; con viento además derivan (≥ 15 % cambia); de un cuadro al siguiente (1/60 s) nada
//     salta (≤ 0,005 de media y ≤ 0,12 en el peor punto, en transparencia)
//  4. sin costuras: la textura pintada de a franjas (se rehace entera en medio segundo; acá, a 60 cuadros por segundo) da lo
//     mismo que pintada de una vez (media ≤ 1/255; el peor punto, ≤ lo que se mueve un borde en esos cuadros); en la pantalla (mirando arriba, al cenit y al
//     horizonte; sólo la pasada del cielo, con el tono de la pantalla), ningún punto suelto (chispa o agujero: > 24/255 de
//     sus dos vecinos, fuera del sol) y ninguna fila ni columna con un salto parejo (≤ 3 veces la mediana de sus vecinas)
//  5. la bruma: en el horizonte el cielo es el color de la niebla del mapa (≤ 4/255, en Bajo: sin tono)
//  6. la grieta del evento se sigue viendo encima de las nubes (≥ 10 de 255 en su zona, ≥ 3 veces el ruido de un cuadro a
//     otro) y alumbra de azul las nubes de al lado (≥ 2/255 de media en la zona, más azul que rojo)
//  7. costo (SwiftShader, 1280 × 720, la pasada de pantalla completa sincronizada con un readPixels de 1 punto y contando
//     la franja de la textura del cielo de cada cuadro; 48 pares antes/ahora seguidos, en cuatro vueltas —con la compu
//     compartida los tiempos suben y bajan juntos— y vale la mediana de las proporciones): Alto ≤ 1,00 × antes (ya tenía nubes), Medio ≤ 1,40 ×,
//     Bajo y Patata ≤ 1,50 × (antes sólo el degradé); la franja ≤ 3 ms; un salto (otra hora, otro mapa) la rehace en una
//     ráfaga de 6 cuadros (8 en Medio y Alto), cada uno ≤ 40 ms; el ruido, una vez, ≤ 120 ms
//  8. WebGL 1: compila, pinta las nubes (Alto y Patata) y tapa lo mismo (±0,10)
//  9. el ciclo del día: al atardecer (17:48) y con el sol recién puesto (18:18, el arrebol: las nubes están altas y siguen
//     alumbradas) el lado iluminado es del color del sol (rojo ≥ 1,3 × azul; a las 18:18 con brillo ≥ 0,4) y de noche
//     las nubes son oscuras (≤ 0,35 de brillo en gamma)
// 10. sin errores de JS
// Además saca las fotos (la cámara del juego) de cada mapa antes/ahora y una hoja de contacto (con FOTOS_ANTES: carpeta con
// antes_<mapa>.jpg sacadas con la versión anterior desde la misma vista).
// uso: NODE_PATH=... node cielos.mjs URL_HTML [CARPETA_FOTOS] [CARPETA_FOTOS_ANTES]
import { abrir } from './base.mjs';
import fs from 'fs'; import { execFileSync } from 'child_process';
const [, , HTML, D = '/tmp/claude-0/cielos/prueba', ANTES = ''] = process.argv;
fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const errsJS = (e) => e.filter((x) => !/broker|mqtt|WebSocket|tienda|CORS|ERR_|Failed to load|net::|willRead/i.test(x));
// el cielo de antes (el de gl.js hasta la 3.0: degradé, sol y, en Alto, nubes de ruido), para medir el costo igual
const FS_ANTES = `
precision highp float; in vec3 vD; uniform vec3 uTop, uMid, uBot, uSol, uSolC, uCam, uLuna; uniform vec2 uExp; uniform float uExpo, uTiempo, uNoche, uNubes, uSolTam, uCieloK, uAire; out vec4 o;
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
  c += uSolC * pow(s, 8.0) * 0.18 * (1.0 - abs(y)) * uAire;               // brillo del horizonte hacia el sol (sin aire, nada)
  float disco = smoothstep(1.0 - uSolTam, 1.0 - uSolTam * 0.6, s);
  c += uSolC * (disco * 40.0 + pow(s, 1200.0) * 3.0 + pow(s, 40.0) * 0.25 * uAire) * step(-0.02, y) * (1.0 - uNoche);
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
const MAPAS_P = ['Desert', 'DesertV2', 'FlatGrass', 'City', 'Base', 'BaseV2', 'Mars', 'Space', 'RB_Llanura', 'RB_Colinas', 'RB_Isla', 'RB_Ciudad', 'RB_Desierto', 'RB_Luna', 'RB_Pizzeria'];
const { b, p, err, ev } = await abrir(HTML, false);
const J = async (s) => JSON.parse(await ev(`(async () => JSON.stringify(await (${s})))()`));
const espera = (s) => ev(`new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + ${s} || performance.now() - r0 > 30000 ? ok(1) : setTimeout(f, 20)); f(); })`);
const mapa = async (m) => { await ev(`(() => { inicioMostrar(false); empezarPartida(${JSON.stringify(m)}); return 1; })()`); await p.waitForFunction((k) => window.__ev(`MUNDO.nombre === ${JSON.stringify(k)} && JUEGO.estado === 'juego'`), m, { timeout: 300000 }); await espera(1); };
const gfx = (g) => ev(`(() => { PREFS.gfx = '${g}'; PREFS.res = 100; PREFS.resDin = false; GFX.auto = false; aplicarGfx(); GFX.ahorro = 0; GFX.ahorroFijo = true; return 1; })()`);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.lang = 'es'; PREFS.evento = true; 1`); await gfx('alto');
// (en la página: lo que tapa cada capa, leído de la textura del cielo pintada con VERNUB; por ángulo sólido, de 15° a 90°)
const AYUDA = `
window.__cob = (T) => {
  const gl = R.gl, t0 = TIEMPO.t; if (T !== undefined) TIEMPO.t = T;
  CIELO.dbg = 1; cieloCTPaso(true); const X = CIELO.ct, S = X.S, px = new Uint8Array(S * S * 4), fb0 = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  gl.bindFramebuffer(gl.FRAMEBUFFER, X.fb); gl.readPixels(0, 0, S, S, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.FRAMEBUFFER, fb0);
  CIELO.dbg = 0; cieloCTPaso(true); TIEMPO.t = t0; return { S, px };
};
window.__cobDe = (r, N) => {
  const { S, px } = r, opA = N.A ? N.A.op : 1, opB = N.B ? N.B.op : 1; let w = 0, a = 0, bb = 0;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = (i + 0.5) / S * 2 - 1, y = (j + 0.5) / S * 2 - 1, rr = Math.hypot(x, y); if (rr > 0.8333) continue;
    const k = Math.sin(rr * 1.5708) / Math.max(rr, 1e-4), o = (j * S + i) * 4; w += k;
    if (px[o] >= 127.5 * opA) a += k; if (px[o + 1] >= 127.5 * opB) bb += k;
  }
  return { A: a / w, B: bb / w };
};
window.__meta = (Cp, T) => !Cp ? null : Math.min(0.97, Math.max(0.02, Cp.X.cov + Cp.ciclo[0] * Math.sin(6.2832 * _fr(T / Cp.ciclo[1] + Cp.f1))));
1`;
await ev(AYUDA);

// ---------------- 1, 2, 9 y las fotos: cada mapa ----------------
const P1 = {}, P2 = {}, foto = {};
// (RAPIDO=1: sin recorrer los mapas —para ajustar lo demás—; la prueba completa los recorre)
for (const m of process.env.RAPIDO ? [] : MAPAS_P.concat(['RB_Construct', 'RB_Flatgrass'])) {
  await mapa(m);
  await ev(`(() => { DIA.hora = 12; DIA.aplicada = -1; DIA.ciclo = false; EVT.prox = 1e9; TIEMPO.lento = 0; JUG.vel.set(0, 0, 0); for (const e of document.querySelectorAll('#aviso, .aviso')) e.style.visibility = 'hidden'; return 1; })()`);
  // (la textura del cielo se pinta entre cuadro y cuadro: se espera a que esté, hasta 20 s)
  await p.waitForFunction(() => window.__ev(`!R.cielo.nub || cieloNub(R.cielo) > 0`), null, { timeout: 20000 }).catch(() => {});
  P1[m] = await J(`(() => { const C = R.cielo, Pr = C.nub && C.nub.Pr; return { tipo: Pr ? Pr.tipo : null, caja: !!(C.cubo || C.cuboPx), firma: Pr ? JSON.stringify([Pr.top, Pr.mid, Pr.A, Pr.B, Pr.neb]) : null, nub: cieloNub(C), malos: Object.keys(CIELO.malos || {}).length }; })()`);
  if (P1[m].tipo && !/nebulosa|estrellas/.test(P1[m].tipo)) {
    // (tres momentos distintos: lo tapado contra lo pedido en cada uno)
    const r = [];
    for (const dt of [0, 97, 233]) r.push(await J(`(() => { const N = R.cielo.nub, T = TIEMPO.t + ${dt}, c = __cobDe(__cob(T), N); return { A: +c.A.toFixed(3), B: +c.B.toFixed(3), mA: +__meta(N.A, T).toFixed(3), mB: N.B ? +__meta(N.B, T).toFixed(3) : null }; })()`));
    P2[m] = r;
  }
  if (m === 'RB_Construct' || m === 'RB_Flatgrass') continue;
  // la foto desde la cámara del juego: la misma vista que las de antes (hacia la grieta, corrida 0,6, un poco arriba)
  await ev(`(() => { JUG.yaw = Math.atan2(EVT.dir.x, EVT.dir.z) + 0.6; JUG.pitch = -0.25; return 1; })()`); await espera(0.8);
  await p.screenshot({ path: D + '/ahora_' + m + '.jpg', quality: 82 });
}
const firmas = MAPAS_P.map((m) => (P1[m] || {}).firma);
if (!process.env.RAPIDO) ok('1. cada mapa propio con su preset (15, todos distintos, sin errores de sombreador); gm_construct y gm_flatgrass con su caja y sin preset',
  MAPAS_P.every((m) => P1[m].tipo && !P1[m].caja && P1[m].nub > 0 && !P1[m].malos) && new Set(firmas).size === firmas.length && ['RB_Construct', 'RB_Flatgrass'].every((m) => P1[m].caja && !P1[m].tipo),
  Object.fromEntries(Object.entries(P1).map(([k, x]) => [k, x.tipo + (x.caja ? '/caja' : '') + '/' + x.nub])));
if (!process.env.RAPIDO) ok('2. lo que tapan las nubes a ±0,10 de lo pedido (la capa alta, ±0,12), en tres momentos, en cada mapa con nubes',
  Object.values(P2).every((r) => r.every((x) => Math.abs(x.A - x.mA) <= 0.1 && (x.mB === null || Math.abs(x.B - x.mB) <= 0.12))), P2);

// ---------------- 3 y 4: el tiempo y las costuras (la llanura, en Alto) ----------------
await mapa('RB_Llanura'); await ev(`(() => { DIA.hora = 12; DIA.aplicada = -1; EVT.prox = 1e9; return 1; })()`); await espera(0.5);
const tiempo = await J(`(() => {
  const N = R.cielo.nub, T0 = TIEMPO.t, cmp = (a, b) => { const n = a.px.length / 4; let f = 0, d = 0, c0 = 0, s = 0, mx = 0, cam = 0; for (let i = 0; i < n; i++) { const x = a.px[i * 4], y = b.px[i * 4]; if (x >= 128) { c0++; if (y < 51) d++; } else if (x < 51 && y >= 128) f++; const e = Math.abs(x - y) / 255; s += e; if (e > mx) mx = e; if ((x >= 128) !== (y >= 128)) cam++; } return { form: f, desh: d, c0, media: s / n, max: mx, cambia: cam }; };
  // (sin viento: lo que se forma y se deshace es sólo eso)
  const v = [N.A.vx, N.A.vy]; N.A.vx = N.A.vy = 0;
  const a0 = __cob(T0), a1 = __cob(T0 + 60), sv = cmp(a0, a1);
  N.A.vx = v[0]; N.A.vy = v[1];
  // (con viento: contra la misma hora con viento; y de un cuadro al siguiente)
  const w0 = __cob(T0), w1 = __cob(T0 + 60), cv = cmp(w0, w1), cuadro = cmp(w0, __cob(T0 + 1 / 60));
  const c0 = __cobDe(a0, N), c1 = __cobDe(a1, N);
  return { formadas: +(sv.form / sv.c0).toFixed(3), deshechas: +(sv.desh / sv.c0).toFixed(3), tapa0: +c0.A.toFixed(3), tapa60: +c1.A.toFixed(3), meta0: +__meta(N.A, T0).toFixed(3), meta60: +__meta(N.A, T0 + 60).toFixed(3),
    conViento: +(cv.cambia / (a0.px.length / 4)).toFixed(3), cuadroMedia: +cuadro.media.toFixed(4), cuadroMax: +cuadro.max.toFixed(3) };
})()`);
ok('3. sin viento en 60 s se forman ≥ 10 % y se deshacen ≥ 10 % (lo tapado a ±0,08 de lo pedido); con viento cambia ≥ 15 % del cielo; de un cuadro al otro ≤ 0,005 de media y ≤ 0,12 en el peor punto',
  tiempo.formadas >= 0.1 && tiempo.deshechas >= 0.1 && Math.abs(tiempo.tapa0 - tiempo.meta0) <= 0.08 && Math.abs(tiempo.tapa60 - tiempo.meta60) <= 0.08 && tiempo.conViento >= 0.15 && tiempo.cuadroMedia <= 0.005 && tiempo.cuadroMax <= 0.12, tiempo);
// las franjas: un cuadro cada una, a 60 por segundo, contra una sola vez al final; y lo que se mueve un borde en esos cuadros
const franjas = await J(`(() => {
  const gl = R.gl, X = CIELO.ct, S = X.S, T0 = TIEMPO.t, lee = () => { const px = new Uint8Array(S * S * 4), fb0 = gl.getParameter(gl.FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.FRAMEBUFFER, X.fb); gl.readPixels(0, 0, S, S, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.FRAMEBUFFER, fb0); return px; };
  const dt0 = TIEMPO.dt; TIEMPO.dt = 1 / 60; const n = Math.ceil(S / cieloFranja(S));
  TIEMPO.t = T0 - n / 60; cieloCTPaso(true); X.fila = 0;
  for (let k = 1; k <= n; k++) { TIEMPO.t = T0 - (n - k) / 60; cieloCTPaso(false); }
  const A = lee(); TIEMPO.t = T0; cieloCTPaso(true); const B = lee();
  TIEMPO.t = T0 - n / 60; cieloCTPaso(true); const V = lee(); TIEMPO.t = T0; TIEMPO.dt = dt0; cieloCTPaso(true);
  let s = 0, mx = 0, mv = 0; for (let i = 0; i < A.length; i++) { const d = Math.abs(A[i] - B[i]); s += d; if (d > mx) mx = d; const e = Math.abs(V[i] - B[i]); if (e > mv) mv = e; }
  return { franjas: n, media: +(s / A.length).toFixed(3), max: mx, mueve24: mv };
})()`);
// la pantalla: mirando arriba lejos del sol, al cenit y al horizonte (sin la grieta), los saltos entre vecinos del cielo
await ev(`PREFS.evento = false; 1`);
const costura = {};
for (const [n, yaw, pitch] of [['arriba', 'Math.atan2(R.sol.x, R.sol.z) + 2.6', -0.6], ['cenit', '0.4', -1.55], ['horizonte', 'Math.atan2(R.sol.x, R.sol.z) + 1.9', -0.05]]) {
  await ev(`(() => { JUG.yaw = ${yaw}; JUG.pitch = ${pitch}; return 1; })()`); await espera(0.6);
  costura[n] = await J(`(() => {
    // (sólo la pasada del cielo —lo que se prueba—, dibujada acá en la pantalla y leída enseguida: sin el mapa, los árboles
    // ni el arma, que delante del cielo dan saltos de verdad; con la salida de Medio, que ya trae el tono de la pantalla, y la
    // textura del cielo de Alto)
    const gl = R.gl, W = R.cv.width, H = R.cv.height, px = new Uint8Array(W * H * 4), s0 = R.salida; R.salida = 'ldr';
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.clear(gl.DEPTH_BUFFER_BIT); dibujarCielo(M4.inv(R.vp)); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); R.salida = s0;
    // (sólo el cielo: los puntos cuya dirección está arriba del horizonte y lejos del sol; la mitad de arriba de la pantalla, sin el arma)
    const IVP = M4.inv(R.vp), cielo = (x, y) => { const nx = (x + 0.5) / W * 2 - 1, ny = (y + 0.5) / H * 2 - 1, w = [0, 0, 0, 0]; for (let r = 0; r < 4; r++) w[r] = IVP[r] * nx + IVP[4 + r] * ny + IVP[8 + r] + IVP[12 + r]; const d = v3(w[0] / w[3] - R.camPos.x, w[1] / w[3] - R.camPos.y, w[2] / w[3] - R.camPos.z).norm(); return d.y > 0.004 && vdot(d, R.sol) < 0.97; };
    const y0 = Math.round(H * 0.45), mask = new Uint8Array(W * H); for (let y = y0; y < H; y++) for (let x = 0; x < W; x += 1) mask[y * W + x] = cielo(x, y) ? 1 : 0;
    // (un punto suelto distinto de sus dos vecinos —para el mismo lado, en una fila o en una columna— es una chispa o un
    // agujero: eso no lo da ningún borde de nube, que es un escalón; los escalones se cuentan aparte, para ver qué tan suaves)
    let mx = 0, picos = 0; const fil = [], col = new Float64Array(W), colN = new Float64Array(W);
    const pico = (a, b0, c0) => { const d1 = a - b0, d2 = a - c0; return (d1 > 24 && d2 > 24) || (d1 < -24 && d2 < -24); };
    for (let y = y0 + 1; y < H - 1; y++) { let s = 0, n = 0; for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (!mask[i] || !mask[i + 1] || !mask[i + W] || !mask[i - 1] || !mask[i - W]) continue; for (let c = 0; c < 3; c++) { const v = px[i * 4 + c], dx = Math.abs(v - px[(i + 1) * 4 + c]), dy = Math.abs(v - px[(i + W) * 4 + c]); if (dx > mx) mx = dx; if (dy > mx) mx = dy; s += dy; col[x] += dx;
      if (pico(v, px[(i - 1) * 4 + c], px[(i + 1) * 4 + c]) || pico(v, px[(i - W) * 4 + c], px[(i + W) * 4 + c])) picos++; } n++; colN[x]++; } if (n > W * 0.2) fil.push(s / n); }
    const pmax = (a) => { let peor = 0; for (let i = 5; i < a.length - 5; i++) { const v = a.slice(i - 5, i).concat(a.slice(i + 1, i + 6)).sort((p, q) => p - q), md = Math.max(0.3, v[5]); peor = Math.max(peor, a[i] / md); } return +peor.toFixed(2); };
    const cs = []; for (let x = 0; x < W - 1; x++) if (colN[x] > (H - y0) * 0.2) cs.push(col[x] / colN[x]);
    return { picos, escalonMax: mx, filas: pmax(fil), columnas: pmax(cs), n: fil.length };
  })()`);
  await p.screenshot({ path: D + '/costura_' + n + '.jpg', quality: 82 });
}
await ev(`PREFS.evento = true; 1`);
ok('4. sin costuras: de a franjas = de una vez (media ≤ 1/255; peor punto ≤ lo que se mueve un borde en esos cuadros); en la pantalla, ningún punto suelto (> 24/255 de sus dos vecinos) y ninguna fila ni columna con salto parejo (≤ 3 × sus vecinas)',
  franjas.media <= 1 && franjas.max <= Math.max(8, franjas.mueve24) && Object.values(costura).every((x) => x.picos === 0 && x.filas <= 3 && x.columnas <= 3), { franjas, costura });

// ---------------- 5: la bruma en el horizonte, en Bajo ----------------
await gfx('bajo'); await espera(0.5);
const bruma = await J(`(() => {
  const gl = R.gl, px = new Uint8Array(4), W = R.cv.width, H = R.cv.height; JUG.pitch = 0; JUG.yaw = Math.atan2(R.sol.x, R.sol.z) + Math.PI; camaraActualizar(0); m4mul(M4.persp(CAM.fov * Math.PI / 180, W / H, 0.08, vistaLejos() * 1.05), M4.view(CAM.pos, CAM.qVista), R.vp);
  // (sólo el cielo, en toda la pantalla: el punto donde la dirección queda apenas arriba del horizonte)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.clear(gl.DEPTH_BUFFER_BIT); dibujarCielo(M4.inv(R.vp));
  const I = M4.inv(R.vp); let mejor = null;
  for (let y = 0; y < H; y++) { const ny = (y + 0.5) / H * 2 - 1, w = [0, 0, 0, 0]; for (let r = 0; r < 4; r++) w[r] = I[r] * 0 + I[4 + r] * ny + I[8 + r] + I[12 + r]; const dy = (w[1] / w[3] - R.camPos.y) / Math.hypot(w[0] / w[3] - R.camPos.x, w[1] / w[3] - R.camPos.y, w[2] / w[3] - R.camPos.z); if (dy > 0.0005 && (!mejor || dy < mejor.dy)) mejor = { y, dy }; }
  gl.readPixels(W >> 1, mejor.y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const nie = R.niebla.c.map((x) => Math.round(x * 255));
  return { cielo: [px[0], px[1], px[2]], niebla: nie, dif: Math.max(...[0, 1, 2].map((k) => Math.abs(px[k] - nie[k]))), dy: +mejor.dy.toFixed(4) };
})()`);
ok('5. en el horizonte el cielo es el color de la niebla (≤ 4/255, Bajo)', bruma.dif <= 4, bruma);
await gfx('alto');

// ---------------- 6: la grieta encima de las nubes y su luz en las nubes ----------------
const mirar = `(() => { EVT.prox = 1e9; TIEMPO.lento = 0; JUG.vel.set(0, 0, 0); JUG.yaw = Math.atan2(EVT.dir.x, EVT.dir.z); JUG.pitch = -Math.asin(EVT.dir.y) * 0.85; return 1; })()`;
await ev(mirar); await espera(1.2); await ev(mirar); await espera(0.4);
const zona = await J(`(() => { const v = R.vp, d = EVT.dir, x = v[0] * d.x + v[4] * d.y + v[8] * d.z, y = v[1] * d.x + v[5] * d.y + v[9] * d.z, w = v[3] * d.x + v[7] * d.y + v[11] * d.z; return { x: (x / w * 0.5 + 0.5) * innerWidth, y: (0.5 - y / w * 0.5) * innerHeight }; })()`);
const fot = async () => (await p.screenshot()).toString('base64');
const difer = (a, bb, r) => p.evaluate(async ([a, bb, r]) => {
  const im = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(r[0], r[1], r[2], r[3]).data; };
  const A = await im(a), B = await im(bb); let s = 0; for (let i = 0; i < A.length; i += 4) s += (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3; return s / (A.length / 4);
}, [a, bb, r]);
const con = await fot(); await espera(0.3); const con2 = await fot(); await p.screenshot({ path: D + '/grieta_nubes.jpg', quality: 85 });
await ev(`PREFS.evento = false; 1`); await espera(0.3); const sin = await fot(); await ev(`PREFS.evento = true; 1`);
const rz = [Math.max(0, Math.round(zona.x - 80)), Math.max(0, Math.round(zona.y - 80)), 160, 160];
const g6 = { dentro: +(await difer(con2, sin, rz)).toFixed(1), ruido: +(await difer(con, con2, rz)).toFixed(1) };
// (su luz en las nubes: el cielo solo, con y sin la grieta, en la zona alrededor)
g6.luz = await J(`(() => {
  const gl = R.gl, W = R.cv.width, H = R.cv.height, IVP = M4.inv(R.vp), z = ${JSON.stringify(rz)}, dpr = W / innerWidth, px = (on) => { const g = EVT.grieta; EVT.grieta = on; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.clear(gl.DEPTH_BUFFER_BIT); dibujarCielo(IVP); EVT.grieta = g; const a = new Uint8Array(4 * Math.round(z[2] * dpr) * Math.round(z[3] * dpr)); gl.readPixels(Math.round(z[0] * dpr), Math.round(H - (z[1] + z[3]) * dpr), Math.round(z[2] * dpr), Math.round(z[3] * dpr), gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
  const A = px(true), B = px(false); let s = 0, r = 0, bl = 0; for (let i = 0; i < A.length; i += 4) { s += (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3; r += A[i] - B[i]; bl += A[i + 2] - B[i + 2]; }
  const n = A.length / 4; return { media: +(s / n).toFixed(2), rojo: +(r / n).toFixed(2), azul: +(bl / n).toFixed(2) };
})()`);
ok('6. la grieta se ve encima de las nubes (≥ 10 en su zona, ≥ 3 × el ruido) y alumbra de azul las nubes de al lado (≥ 2/255, más azul que rojo)',
  g6.dentro >= 10 && g6.dentro >= 3 * g6.ruido && g6.luz.media >= 2 && g6.luz.azul > g6.luz.rojo, g6);

// ---------------- 7: el costo ----------------
await ev(`(() => { JUG.pitch = -0.4; return 1; })()`); await espera(0.5);
const costo = await J(`(() => {
  const FSA = ${JSON.stringify(FS_ANTES)}, gl = R.gl, IVP = M4.inv(R.vp), px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px), C = R.cielo, viejos = {};
  const viejo = (sal, nub) => { const k = sal + '|' + nub; return viejos[k] || (viejos[k] = shader(VS_CIELO, FSA, ['SALIDA=' + sal].concat(nub ? ['NUBES'] : []))); };
  // (el cielo de antes, con los mismos uniformes que le ponía dibujarCielo)
  const dibViejo = (sal, nub) => { const P = viejo(sal, nub), u = P.u; gl.useProgram(P.p); R.progAct = P; const L = sal && R.lin ? R.lin : null;
    gl.uniformMatrix4fv(u.uIVP, false, IVP); gl.uniform3fv(u.uTop, C.top); gl.uniform3fv(u.uMid, C.mid); gl.uniform3fv(u.uBot, C.bot); gl.uniform2fv(u.uExp, C.exp);
    gl.uniform3f(u.uSol, R.sol.x, R.sol.y, R.sol.z); gl.uniform3fv(u.uSolC, L ? L.cieloSol : C.sol); gl.uniform3f(u.uCam, R.camPos.x, R.camPos.y, R.camPos.z);
    if (sal) { gl.uniform1f(u.uExpo, R.expo); gl.uniform1f(u.uTiempo, TIEMPO.t); gl.uniform1f(u.uCieloK, 1); gl.uniform1f(u.uNoche, 0); if (u.uNubes) gl.uniform1f(u.uNubes, 0.5); if (u.uAire) gl.uniform1f(u.uAire, 1); gl.uniform1f(u.uSolTam, 0.00024); if (u.uLuna) gl.uniform3f(u.uLuna, 0, 1, 0); }
    gl.depthMask(false); gl.depthFunc(gl.LEQUAL); gl.bindVertexArray(R.quad); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null); R.vaoAct = null; gl.depthMask(true); gl.depthFunc(gl.LESS); };
  // (la franja de cada cuadro depende de cuánto dura el cuadro: se mide como a 60 por segundo)
  const dt0 = TIEMPO.dt; TIEMPO.dt = 1 / 60;
  const s0 = R.salida, l0 = GFX.luz, h0 = GFX.hdr, Q = { patata: [0, 0, 0, 0], bajo: [0, 0, 1, 0], medio: [1, 0, 2, 0], alto: [2, 1, 2, 1] }, N = 3, res = {};
  const med = (a) => { a = a.slice().sort((x, y) => x - y); return a[a.length >> 1]; };
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, R.cv.width, R.cv.height);
  // (el ruido, una vez: lo que tarda armarlo)
  let t = performance.now(); nubesRuido(256); const ruido = performance.now() - t;
  for (const q in Q) res[q] = { A: [], B: [], F: [], K: [], R: [], entera: 0 };
  // (cuatro vueltas por las calidades, 12 pares en cada una: así cada calidad se mide en cuatro momentos distintos de la compu)
  for (let vuelta = 0; vuelta < 4; vuelta++) for (const q in Q) {
    const [s, n, l, h] = Q[q], pon = () => { R.salida = ['gam', 'ldr', 'hdr'][s]; GFX.luz = l; GFX.hdr = h; }, X0 = res[q];
    pon(); cieloCTPaso(true); for (let i = 0; i < 6; i++) { dibViejo(s, n); cieloCTPaso(false); dibujarCielo(IVP); } sync();   // (calentar: el emulador arma cada programa en el primer dibujo)
    t = performance.now(); cieloCTPaso(true); sync(); X0.entera = Math.max(X0.entera, performance.now() - t);
    // (un salto: la ráfaga, de a un sexto u octavo de la textura por cuadro; vale el cuadro más caro de cada ráfaga y, entre
    // las vueltas, la mediana: un pico de la compu compartida en una sola no es la ráfaga)
    { const X = CIELO.ct; X.rafaga = true; X.filaR = 0; let m = 0; for (let i = 0; i < Math.ceil(X.S / cieloRafaga(X.S)); i++) { const t1 = performance.now(); cieloCTPaso(false); sync(); m = Math.max(m, performance.now() - t1); } if (vuelta) X0.R.push(m); }
    // (de a pares cortos, antes y ahora seguidos y en orden ABBA: con la compu compartida la carga cambia de un momento a
    // otro y así los dos la ven igual; vale la mediana de las proporciones)
    const viejoT = () => { gl.clear(gl.DEPTH_BUFFER_BIT); sync(); const t = performance.now(); for (let i = 0; i < N; i++) dibViejo(s, n); sync(); return (performance.now() - t) / N; };
    const nuevoT = () => { pon(); gl.clear(gl.DEPTH_BUFFER_BIT); sync(); const t = performance.now(); for (let i = 0; i < N; i++) { cieloCTPaso(false); dibujarCielo(IVP); } sync(); return (performance.now() - t) / N; };
    for (let r = 0; r < 12; r++) {
      let a, bb; if (r & 1) { bb = nuevoT(); a = viejoT(); } else { a = viejoT(); bb = nuevoT(); }
      X0.A.push(a); X0.B.push(bb); X0.K.push(bb / a);
      if (r < 2) { t = performance.now(); for (let i = 0; i < 12; i++) cieloCTPaso(false); sync(); X0.F.push((performance.now() - t) / 12); }
    }
    X0.S = CIELO.ct.S;
  }
  for (const q in Q) { const X0 = res[q]; const Ks = X0.K.slice().sort((x, y) => x - y); res[q] = { antes: +med(X0.A).toFixed(2), ahora: +med(X0.B).toFixed(2), k: +med(X0.K).toFixed(2), kQ: [+Ks[Ks.length >> 2].toFixed(2), +Ks[(3 * Ks.length) >> 2].toFixed(2)], franja: +med(X0.F).toFixed(2), rafaga: +med(X0.R).toFixed(1), entera: +X0.entera.toFixed(1), S: X0.S }; }
  R.salida = s0; GFX.luz = l0; GFX.hdr = h0; TIEMPO.dt = dt0; cieloCTPaso(true);
  return { px: R.cv.width + 'x' + R.cv.height, ruido: +ruido.toFixed(1), ...res };
})()`);
const topes = { patata: 1.5, bajo: 1.5, medio: 1.4, alto: 1.0 };
ok('7. costo: Alto ≤ 1,00 × antes, Medio ≤ 1,40 ×, Bajo y Patata ≤ 1,50 ×; la franja ≤ 3 ms; cada cuadro de la ráfaga de un salto ≤ 40 ms (6 u 8 cuadros); el ruido ≤ 120 ms',
  Object.keys(topes).every((q) => costo[q].k <= topes[q] && costo[q].franja <= 3 && costo[q].rafaga <= 40) && costo.ruido <= 120, costo);

// ---------------- 9: el ciclo del día ----------------
const dia = {};
for (const h of [12, 17.8, 18.3, 0]) {
  await ev(`(() => { DIA.hora = ${h}; DIA.aplicada = -1; diaAplicar(); return 1; })()`); await espera(0.3);
  dia[h] = await J(`(() => { const C = R.cielo, pal = cieloPaleta(C, cieloNoche(C)), lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return { luz: pal.luz.map((x) => +x.toFixed(3)), som: pal.som.map((x) => +x.toFixed(3)), rb: +(pal.luz[0] / Math.max(1e-3, pal.luz[2])).toFixed(2), brillo: +lum(pal.luz).toFixed(3) }; })()`);
  await ev(`(() => { JUG.yaw = Math.atan2(R.sol.x, R.sol.z) + (${h} === 0 ? 2.5 : 0.3); JUG.pitch = -0.3; return 1; })()`); await espera(0.8);
  await p.screenshot({ path: D + '/dia_' + String(h).replace('.', '_') + '.jpg', quality: 82 });
}
await ev(`(() => { DIA.hora = 12; DIA.aplicada = -1; return 1; })()`);
ok('9. ciclo del día: al atardecer y apenas puesto el sol (el arrebol) el lado iluminado es del color del sol (rojo ≥ 1,3 × azul), de noche oscuras (≤ 0,35)', dia[17.8].rb >= 1.3 && dia[18.3].rb >= 1.3 && dia[18.3].brillo >= 0.4 && dia[0].brillo <= 0.35 && dia[12].brillo > dia[0].brillo, dia);
// (las calidades, para la hoja)
for (const g of ['patata', 'bajo', 'medio', 'ultra']) { await gfx(g); await ev(`(() => { JUG.yaw = Math.atan2(EVT.dir.x, EVT.dir.z) + 0.6; JUG.pitch = -0.3; return 1; })()`); await espera(1); await p.screenshot({ path: D + '/calidad_' + g + '.jpg', quality: 82 }); }
await gfx('alto');
const errores1 = errsJS(err);
await b.close();

// ---------------- 8: WebGL 1 ----------------
const W1 = await abrir(HTML + (HTML.includes('?') ? '&' : '?') + 'gl=1', false);
await W1.ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.evento = true; PREFS.gfx = 'alto'; PREFS.res = 100; PREFS.resDin = false; GFX.auto = false; aplicarGfx(); 1`);
await W1.ev(AYUDA);
await W1.ev(`(() => { inicioMostrar(false); empezarPartida('RB_Llanura'); return 1; })()`);
await W1.p.waitForFunction(() => window.__ev(`MUNDO.nombre === 'RB_Llanura' && JUEGO.estado === 'juego'`), null, { timeout: 300000 });
const gl1 = {};
for (const g of ['alto', 'patata']) {
  await W1.ev(`(() => { PREFS.gfx = '${g}'; aplicarGfx(); EVT.prox = 1e9; JUG.yaw = Math.atan2(EVT.dir.x, EVT.dir.z) + 0.6; JUG.pitch = -0.3; return 1; })()`);
  await W1.ev(`new Promise((ok) => setTimeout(ok, 2500))`);
  gl1[g] = JSON.parse(await W1.ev(`JSON.stringify((() => { const N = R.cielo.nub, T = TIEMPO.t, c = __cobDe(__cob(T), N); return { gl1: !!R.gl1, nub: cieloNub(R.cielo), malos: Object.keys(CIELO.malos || {}), luz: GFX.luz, A: +c.A.toFixed(3), meta: +__meta(N.A, T).toFixed(3) }; })())`));
  await W1.p.screenshot({ path: D + '/webgl1_' + g + '.jpg', quality: 82 });
}
const errores2 = errsJS(W1.err);
await W1.b.close();
ok('8. WebGL 1: compila, pinta las nubes (Alto y Patata) y tapa lo mismo (±0,10)', Object.values(gl1).every((x) => x.gl1 && x.nub > 0 && !x.malos.length && Math.abs(x.A - x.meta) <= 0.1), gl1);
ok('10. sin errores de JS', !errores1.length && !errores2.length, errores1.concat(errores2).slice(0, 5));

// ---------------- la hoja de contacto (antes | ahora de cada mapa, y las calidades y el día) ----------------
try {
  const py = `
import sys, os
from PIL import Image, ImageDraw
D, A, out = sys.argv[1], sys.argv[2], sys.argv[3]
mapas = sys.argv[4].split(',')
w, h = 480, 270
filas = []
for m in mapas:
    par = []
    for pre, carp in (('antes_', A), ('ahora_', D)):
        f = os.path.join(carp, pre + m + '.jpg')
        par.append((f if os.path.exists(f) else None, (pre[:-1] + ' ' + m)))
    filas.append(par)
extra = [(os.path.join(D, n + '.jpg'), n) for n in ('calidad_patata', 'calidad_bajo', 'calidad_medio', 'calidad_ultra', 'dia_12', 'dia_17_8', 'dia_18_3', 'dia_0', 'grieta_nubes', 'costura_cenit', 'webgl1_alto')]
for i in range(0, len(extra), 2): filas.append(extra[i:i + 2])
S = Image.new('RGB', (w * 2, h * len(filas)), (16, 16, 16))
for j, fila in enumerate(filas):
    for i, (f, t) in enumerate(fila):
        if f and os.path.exists(f):
            im = Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS); d = ImageDraw.Draw(im); d.rectangle((0, 0, 8 + 6 * len(t), 14), fill=(0, 0, 0)); d.text((4, 2), t, fill=(255, 230, 0)); S.paste(im, (i * w, j * h))
S.save(out, quality=84)
print(out)
`;
  fs.writeFileSync(D + '/_hoja.py', py);
  console.log('hoja: ' + execFileSync('python3', ['-I', D + '/_hoja.py', D, ANTES || D, D + '/cielos_hoja.jpg', MAPAS_P.join(',')]).toString().trim());
} catch (e) { console.log('hoja: no se pudo (' + e.message.slice(0, 120) + ')'); }
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
process.exit(R.every(Boolean) ? 0 : 1);
