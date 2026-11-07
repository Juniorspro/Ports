// La mancha blanca del agua (video del usuario: una bola blanca suave que lo sigue sobre el lago y, buceando, un velo
// blanco que tapa media pantalla). La bola era el brillo del sol en el agua: se sumaba entero (×6 el color del sol) sin
// el Fresnel, así que mirando el agua desde arriba el reflejo del sol era una mancha blanca quemada de varios metros
// que se movía con la cámara. El velo era la niebla de abajo del agua: en Ultra le sumaba la luz del sol en blanco.
// En el lago de gm_construct, con el cuadro quieto (mismo tiempo de las olas en las dos versiones), la cámara apuntada
// justo al reflejo del sol, a 2, 4, 8 y 20 m sobre el agua, al mediodía y a media mañana, en cada calidad:
//  1. con el sol alto (≥ 35°) y mirando para abajo no hay mancha: la mancha blanca más grande (píxeles con los tres
//     canales ≥ 235, pegados) ocupa ≤ 0,15 % de la pantalla y en total hay ≤ 0,3 % de píxeles blancos;
//  2. buceando 3 m bajo el agua (lo más hondo del lago) y mirando al sol, sin velo blanco: ≤ 2 % de píxeles blanquecinos
//     (claros y casi sin color) y la luz de arriba del color del agua (en Ultra la niebla sumaba el sol en blanco: buceando
//     y mirando para arriba un velo blanco tapaba media pantalla —la otra mitad del video—);
//  3. con el sol bajo (atardecer) y mirando hacia el sol a ras del agua, el agua sigue brillando: hay destellos (≥ 0,02 %
//     de píxeles muy claros, y al menos la mitad que antes) — no se apagó el brillo, sólo dejó de ser una mancha;
//  4. mirando para el otro lado (sin el sol en el agua) la foto es la misma que antes (diferencia media ≤ 1 nivel)
//     — sólo si se pasa la versión anterior como segundo HTML;
//  5. sin errores de JS.
// uso: node agua_sol.mjs URL_HTML [URL_HTML_ANTES] [calidades=bajo,medio,alto,ultra] [carpeta de fotos]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, ANTES = '', CALS = 'bajo,medio,alto,ultra', FOTOS = ''] = process.argv;
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 1200) : '')); };
const conTest = (u) => u + (u.includes('?') ? '&' : '?') + 'test';
// lo que se mide en la página: el cuadro dibujado a mano con el tiempo de las olas fijo, leído de la pantalla
const MEDIR = `(async (alto, hora, mirar, fotoN) => {
  DIA.hora = hora; DIA.ciclo = false; if (typeof diaAplicar === 'function') diaAplicar();
  const v = AGUA.vols.filter((x) => !x.rec).sort((a, b) => (b.ax1 - b.ax0) * (b.az1 - b.az0) - (a.ax1 - a.ax0) * (a.az1 - a.az0))[0];
  const S = R.sol.clone();
  let cx = (v.ax0 + v.ax1) / 2, cz = (v.az0 + v.az1) / 2;
  if (mirar === 'buceo') {
    // (el lugar más hondo del lago: rayos para abajo desde la superficie en una grilla)
    let hondo = 0;
    // (con piso a menos de 30 m y nada entre la cámara —3 m abajo— y la superficie, mirando al sol)
    for (let i = 1; i < 24; i++) for (let j = 1; j < 24; j++) { const x = v.ax0 + (v.ax1 - v.ax0) * i / 24, z = v.az0 + (v.az1 - v.az0) * j / 24; if (!aguaPisa(v, x, z)) continue; const hh = mundoRayo(v3(x, v.y1 - 0.05, z), v3(0, -1, 0), 30); if (!hh || hh.t < 5) continue; if (mundoRayo(v3(x, v.y1 - 3, z), S, 6)) continue; if (hh.t > hondo) { hondo = hh.t; cx = x; cz = z; } }
    window.__hondo = hondo;
  }
  // a dónde mira: al reflejo del sol (el rayo de la cámara rebota en el agua y va al sol) o para el otro lado
  let d = mirar === 'sol' ? v3(S.x, -S.y, S.z) : mirar === 'rasante' ? v3(S.x, -Math.max(0.05, S.y), S.z) : mirar === 'buceo' ? v3(S.x, S.y, S.z) : v3(-S.x, -0.55, -S.z);
  d = d.norm();
  // (la cámara se aleja del punto del reflejo lo que haga falta para verlo en el centro, a la altura pedida)
  const t = mirar === 'buceo' ? 0 : alto / Math.max(0.05, -d.y), px = cx - d.x * t, pz = cz - d.z * t;
  JUG.noclip = true; JUG.vel.set(0, 0, 0);
  const ojo = JUG.ojoAlto || 1.6;
  const pon = (yaw) => { JUG.yaw = yaw; JUG.pitch = Math.asin(-d.y); JUG.pos.set(px, v.y1 + alto - ojo + 0.95, pz); };
  let T = window.__T || performance.now(); const paso = () => { T += 1000 / 60; window.__T = T; AGUA.t = 7.25; cuadro(T); };
  // (el signo del ángulo: se prueba cuál de los cuatro deja la cámara mirando para d)
  let mejor = 0, md = -2;
  for (const y of [Math.atan2(d.x, d.z), Math.atan2(-d.x, -d.z), Math.atan2(d.x, -d.z), Math.atan2(-d.x, d.z)]) { pon(y); paso(); const f = CAM.fwd, k = (f.x * d.x + f.z * d.z) / Math.max(1e-6, Math.hypot(f.x, f.z) * Math.hypot(d.x, d.z)); if (k > md) { md = k; mejor = y; } }
  pon(mejor); for (let i = 0; i < 6; i++) paso();
  const gl = R.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, p = new Uint8Array(w * h * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, p);
  // (sin la esquina de abajo a la derecha: el arma en la mano)
  const fuera = (x, y) => x > w * 0.55 && y < h * 0.62;
  let blancos = 0, claros = 0, lechosos = 0, n = 0, sr = 0, sg = 0, sb = 0, nc = 0; const B = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (fuera(x, y)) continue; const o = (y * w + x) * 4, m = Math.min(p[o], p[o + 1], p[o + 2]), M = Math.max(p[o], p[o + 1], p[o + 2]), Y = 0.2126 * p[o] + 0.7152 * p[o + 1] + 0.0722 * p[o + 2]; n++;
    if (m >= 235) { blancos++; B[y * w + x] = 1; } if (Y >= 200) claros++; if (Y >= 100 && (M - m) / Math.max(1, M) <= 0.3) lechosos++;
    if (Math.abs(x - w / 2) < h * 0.2 && Math.abs(y - h / 2) < h * 0.2) { sr += p[o]; sg += p[o + 1]; sb += p[o + 2]; nc++; }
  }
  // la mancha más grande (píxeles blancos pegados)
  let mancha = 0; const pila = [];
  for (let i = 0; i < w * h; i++) { if (B[i] !== 1) continue; let c = 0; B[i] = 2; pila.push(i); while (pila.length) { const j = pila.pop(); c++; const x = j % w, y = (j / w) | 0; for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1]) if (k >= 0 && B[k] === 1) { B[k] = 2; pila.push(k); } } if (c > mancha) mancha = c; }
  // el velo: lo claro del centro contra el anillo de alrededor (luminancia media)
  const lum = (x0, y0, r0, r1) => { r0 = Math.round(r0); r1 = Math.round(r1); let s = 0, c = 0; for (let y = Math.max(0, y0 - r1); y < Math.min(h, y0 + r1); y += 2) for (let x = Math.max(0, x0 - r1); x < Math.min(w, x0 + r1); x += 2) { if (fuera(x, y)) continue; const dd = Math.hypot(x - x0, y - y0); if (dd < r0 || dd >= r1) continue; const o = (y * w + x) * 4; s += 0.2126 * p[o] + 0.7152 * p[o + 1] + 0.0722 * p[o + 2]; c++; } return c ? s / c : 0; };
  const hc = Math.round(h * 0.5), wc = Math.round(w * 0.5), centro = lum(wc, hc, 0, h * 0.18), anillo = lum(wc, hc, h * 0.3, h * 0.45);
  let foto = null;
  if (fotoN) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), im = x.createImageData(w, h); for (let y = 0; y < h; y++) im.data.set(p.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4); x.putImageData(im, 0, 0); foto = c.toDataURL('image/png').split(',')[1]; }
  // (para comparar con la otra versión: la foto chica en gris)
  const chica = []; for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) { const o = (y * w + x) * 4; chica.push((p[o] + p[o + 1] + p[o + 2]) / 3 | 0); }
  return JSON.stringify({ elev: +(Math.asin(S.y) * 180 / Math.PI).toFixed(1), blancoPct: +(100 * blancos / n).toFixed(3), claroPct: +(100 * claros / n).toFixed(3), manchaPct: +(100 * mancha / n).toFixed(3), velo: +(centro - anillo).toFixed(1), lechoPct: +(100 * lechosos / n).toFixed(2), centroRGB: [sr / nc | 0, sg / nc | 0, sb / nc | 0], hondo: window.__hondo, camY: +(CAM.pos.y - v.y1).toFixed(2), foto, chica });
})`;
async function correr(html, cal, fotos) {
  const { b, p, err, ev } = await abrir(conTest(html), true);
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; idiomaAplicar('es'); GFX.auto = false; PREFS.gfx = ${JSON.stringify(cal)}; const pf = PERFILES[PREFS.gfx]; PREFS.res = pf.res; PREFS.lejos = pf.lejos; PREFS.resDin = false; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
  await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(2500);
  await ev(`(() => { cerrarPaneles(); window.requestAnimationFrame = () => 0; return 1; })()`); await p.waitForTimeout(300);
  const out = {};
  for (const [nom, alto, hora, mirar] of [['sol2', 2, 12.5, 'sol'], ['sol4', 4, 12.5, 'sol'], ['sol8', 8, 12.5, 'sol'], ['sol20', 20, 12.5, 'sol'], ['man4', 4, 10, 'sol'], ['man20', 20, 10, 'sol'], ['tarde', 2, 17.4, 'rasante'], ['otro', 4, 12.5, 'otro'], ['buceo', -3, 12.5, 'buceo'], ['buceo10', -3, 10, 'buceo']]) {
    const r = JSON.parse(await ev(`${MEDIR}(${alto}, ${hora}, ${JSON.stringify(mirar)}, ${fotos ? 1 : 0})`));
    if (r.foto && fotos) { fs.mkdirSync(fotos, { recursive: true }); fs.writeFileSync(`${fotos}/${cal}_${nom}.png`, Buffer.from(r.foto, 'base64')); }
    delete r.foto; out[nom] = r;
  }
  const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|CORS|shader simplificado|willReadFrequently/i.test(x));
  await b.close();
  return { out, e };
}
const res = {};
for (const cal of CALS.split(',')) {
  res[cal] = await correr(HTML, cal, FOTOS ? FOTOS + '/despues' : '');
  if (ANTES) res[cal].antes = await correr(ANTES, cal, FOTOS ? FOTOS + '/antes' : '');
  const o = res[cal].out;
  console.log(cal, JSON.stringify(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [v.elev, v.blancoPct, v.manchaPct, v.velo, v.claroPct]]))));
  if (ANTES) { const a = res[cal].antes.out; console.log(cal + ' antes', JSON.stringify(Object.fromEntries(Object.entries(a).map(([k, v]) => [k, [v.elev, v.blancoPct, v.manchaPct, v.velo, v.claroPct]])))); }
}
const altos = ['sol2', 'sol4', 'sol8', 'sol20', 'man4', 'man20'];
const cals = Object.keys(res);
ok('1. sol alto, mirando el reflejo desde 2 a 20 m: sin mancha blanca (la más grande ≤ 0,15 %, blancos ≤ 0,3 %)',
  cals.every((c) => altos.every((k) => res[c].out[k].elev < 35 || (res[c].out[k].manchaPct <= 0.15 && res[c].out[k].blancoPct <= 0.3))),
  cals.map((c) => [c, altos.map((k) => [k, res[c].out[k].elev, res[c].out[k].manchaPct, res[c].out[k].blancoPct])]));
ok('2. buceando y mirando al sol: sin velo blanco (≤ 2 % de píxeles blanquecinos: claros y casi sin color) y la luz del color del agua (verde y azul > rojo × 1,4)',
  cals.every((c) => ['buceo', 'buceo10'].every((k) => { const r = res[c].out[k], q = r.centroRGB; return r.lechoPct <= 2 && Math.min(q[1], q[2]) > q[0] * 1.4; })),
  cals.map((c) => [c, ['buceo', 'buceo10'].map((k) => [k, res[c].out[k].lechoPct, res[c].out[k].centroRGB, ANTES ? ['antes', res[c].antes.out[k].lechoPct, res[c].antes.out[k].centroRGB] : '-'])]));
ok('3. al atardecer, mirando al sol a ras del agua, el agua sigue brillando (≥ 0,02 % de píxeles muy claros' + (ANTES ? ' y al menos la mitad que antes)' : ')'),
  cals.every((c) => res[c].out.tarde.claroPct >= 0.02 && (!ANTES || res[c].out.tarde.claroPct >= 0.5 * res[c].antes.out.tarde.claroPct)),
  cals.map((c) => [c, res[c].out.tarde.elev, res[c].out.tarde.claroPct, ANTES ? res[c].antes.out.tarde.claroPct : '-']));
if (ANTES) {
  const dif = cals.map((c) => { const a = res[c].antes.out.otro.chica, d = res[c].out.otro.chica; let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - d[i]); return [c, +(s / a.length).toFixed(2)]; });
  ok('4. mirando para el otro lado, la misma foto que antes (diferencia media ≤ 1 nivel)', dif.every((x) => x[1] <= 1), dif);
}
const errs = cals.flatMap((c) => res[c].e.concat(res[c].antes ? res[c].antes.e : []));
ok('5. sin errores de JS', !errs.length, errs.slice(0, 4));
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
process.exit(R0.every(Boolean) ? 0 : 1);
