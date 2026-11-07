// La linterna hace sombra (Discord: «que la linterna haga sombra: lo que tapa la luz deja la sombra detrás»). De noche en
// Pasto plano, en tercera persona, con la linterna prendida y una caja de madera de 1 m apoyada a 3 m, vista de costado y desde arriba;
// cada foto con la sombra y sin ella (DBG.sinEsh), el mismo instante. Para Medio, Alto y Ultra:
//  1. hay sombra: los puntos que la sombra oscurece (menos del 60 % de la luz sin sombra) son ≥ 1500 y el 90 % o más
//     caen donde dice la geometría (la caja proyectada desde la linterna sobre el piso, con 10 px de margen);
//  2. la sombra es oscura y llena: en la zona prevista (sin el borde ni la caja) ≥ 70 % de los puntos están oscurecidos;
//  3. sin «acné» ni manchas: fuera de la sombra prevista y de la caja, lo iluminado queda igual (≥ 99,5 % de los puntos a
//     ≤ 3 niveles de la foto sin sombra, y no peor que dos fotos sin sombra del mismo instante entre sí);
//  4. Ultra suaviza el borde (4 lecturas: hay puntos de penumbra entre 15 % y 85 %);
//  5. en Bajo y en Patata no hay sombra de linterna (ni el mapa, ni la pasada, ni el shader) y en WebGL 1 tampoco;
//  6. lo que cuesta: con la linterna prendida, una pasada de profundidad con sólo lo que entra en el cono (≤ 6 dibujos) y
//     el cuadro entero en Alto, con y sin la sombra (alternando, 3 veces): ≤ 15 % más en esta compu, que no tiene placa de
//     video (todo lo dibuja la CPU, así que mide de más: en un celu con GPU la sombra cuesta mucho menos);
//  7. sin errores de JS ni de WebGL.
// uso: node linterna_sombra.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/linterna_sombra'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 1200) : '')); };
const err = [];
// una escena fija y dos fotos (con y sin la sombra), con los mismos cuadros manuales
const ESCENA = (cal) => `(async () => {
  GFX.auto = false; PREFS.gfx = '${cal}'; PREFS.sombras = 'auto'; aplicarGfx();
  DIA.ciclo = false; DIA.hora = 0; DIA.aplicada = -1; JUG.noclip = false; JUG.yaw = 0; JUG.pitch = 0.25; JUG.vel.set(0, 0, 0);
  // (en tercera persona: la linterna va en el cuerpo y la cámara, detrás y arriba, ve la sombra entera; sin el arma en la
  // mano, que se mueve y ensuciaba la comparación)
  JUG.tercera = true; const iM = ARM.lista.indexOf('Hands'); if (iM >= 0) elegirArma(iM);
  if (window.__caja) { try { borrarObjeto(window.__caja); } catch (e) {} }
  const q = JUG.pos.clone().addS(v3(0, 0, 1), 3.0); window.__caja = crearObjeto('CajaMadera', v3(q.x, JUG.pos.y, q.z), Quat.euler(0, 0), { congelado: true });
  // (apoyada en el piso: se crea a la altura del jugador y, congelada, quedaba flotando)
  const o = window.__caja, a = o.b.aabb, h = raycast(v3((a.x0 + a.x1) / 2, a.y0 - 0.01, (a.z0 + a.z1) / 2), v3(0, -1, 0), 20, o.b);
  if (h && h.p) { o.b.pos.y -= a.y0 - h.p.y; if (o.b.updateWorld) o.b.updateWorld(); }
  if (!LINT.on) linternaAlternar(true);
  // la foto, de costado y desde arriba (cámara libre que vuela): desde atrás de la linterna, la caja tapa casi toda su
  // propia sombra; la linterna sigue la mira del jugador, no la cámara libre
  if (CLIB.modo !== 'L') clibElegir('L');
  const Tm = v3(JUG.pos.x, JUG.pos.y - JUG.medio, JUG.pos.z + 6.5), Cm = vadd(Tm, v3(8, 6, -1)), dm = vsub(Tm, Cm);
  CLIB.pos.copy(Cm); CLIB.yaw = Math.atan2(dm.x, dm.z); CLIB.pitch = Math.atan2(-dm.y, Math.hypot(dm.x, dm.z));
  return 1; })()`;
// las fotos: siempre el mismo instante (T0), para que las dos —con y sin sombra— sean el mismo cuadro
// (con los cuadros a mano, sin el pedido del cuadro siguiente: cada cuadro() pide otro y, si no, cada foto dejaba 8 bucles
// de dibujo más corriendo a la vez, hasta ahogar la página)
const FOTO = (T0) => `(() => { const raf0 = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; try {
  let T = ${T0}; for (let i = 0; i < 8; i++) { T += 1000 / 60; cuadro(T); }
  const gl = R.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let s = ''; for (let i = 0; i < w * h; i++) s += String.fromCharCode(Math.round(0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]));
  return { w, h, Y: btoa(s) };
} finally { window.requestAnimationFrame = raf0; } })()`;
const desc = (F) => Uint8Array.from(Buffer.from(F.Y, 'base64'));
// la sombra prevista: la caja (su caja de choque) proyectada desde la linterna sobre el piso, en la pantalla; y la caja
const PREVISTA = `(() => {
  const o = window.__caja, a = o.b.aabb, L = R.espShL || (R.esp[0]), lp = L.p, vp = R.vpMundo, gl = R.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const pant = (x, y, z) => { const X = vp[0] * x + vp[4] * y + vp[8] * z + vp[12], Yy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13], W = vp[3] * x + vp[7] * y + vp[11] * z + vp[15]; return [(X / W * 0.5 + 0.5) * w, (Yy / W * 0.5 + 0.5) * h]; };
  const piso = a.y0, sombra = [], caja = [];
  for (const x of [a.x0, a.x1]) for (const y of [a.y0, a.y1]) for (const z of [a.z0, a.z1]) {
    caja.push(pant(x, y, z));
    const t = (piso - lp.y) / (y - lp.y); if (!(t > 0)) continue;   // (la luz más baja que la esquina: no llega al piso)
    sombra.push(pant(lp.x + (x - lp.x) * t, piso, lp.z + (z - lp.z) * t));
  }
  return { sombra, caja, w, h, luz: [lp.x, lp.y, lp.z].map((v) => +v.toFixed(2)), aabb: [a.x0, a.y0, a.z0, a.x1, a.y1, a.z1].map((v) => +v.toFixed(2)) };
})()`;
// envolvente convexa y si un punto cae adentro (con margen en px: >0 agranda, <0 achica)
const casco = (P) => { const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1)); };
const dentro = (C, x, y, m) => { let dmin = Infinity; for (let i = 0; i < C.length; i++) { const a = C[i], b = C[(i + 1) % C.length], ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey) || 1, d = ((x - a[0]) * ey - (y - a[1]) * ex) / L; dmin = Math.min(dmin, -d); } return dmin >= -m; };
const { b, p, ev, err: e0 } = await abrir(HTML + '?test', false);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'alto'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
await p.waitForTimeout(2000);
const res = {};
for (const cal of ['medio', 'alto', 'ultra']) {
  await ev(ESCENA(cal)); await p.waitForTimeout(2500);   // (que compile y que la caja quede quieta)
  const T0 = await ev(`performance.now() + 100000`);
  await ev(`(() => { DBG.sinEsh = false; return 1; })()`); const A = await ev(FOTO(T0));
  const pre = await ev(PREVISTA), info = await ev(`({ espSh: GFX.espSh, tam: ESH.tam, on: R.espShOn, dib: ESH.dib, ms: +ESH.ms.toFixed(2), prog: [...R.progs.keys()].filter((k) => /e[12]$/.test(k)).length })`);
  await p.screenshot({ path: `${D}/${cal}_con.png` });
  await ev(`(() => { DBG.sinEsh = true; return 1; })()`); const B = await ev(FOTO(T0)), C0 = await ev(FOTO(T0));
  await p.screenshot({ path: `${D}/${cal}_sin.png` });
  await ev(`(() => { DBG.sinEsh = false; return 1; })()`);
  const { w, h } = A, Ya = desc(A), Yb = desc(B), Yc = desc(C0);
  // (readPixels: y de abajo hacia arriba, como la proyección)
  const Cs = casco(pre.sombra), Cb = casco(pre.caja);
  let oscu = 0, oscuEn = 0, prev = 0, prevOsc = 0, fuera = 0, fueraIg = 0, fueraRuido = 0, penumbra = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, ya = Ya[i], yb = Yb[i]; if (yb < 20) continue;   // (sólo lo que ilumina la linterna)
    const enCaja = dentro(Cb, x, y, 3), enS = dentro(Cs, x, y, 10), enSin = dentro(Cs, x, y, -6) && !dentro(Cb, x, y, 6);
    const os = ya < 0.6 * yb;
    if (os && !enCaja) { oscu++; if (enS) oscuEn++; }
    if (enSin) { prev++; if (os) prevOsc++; }
    if (enS && !enCaja && ya > 0.15 * yb && ya < 0.85 * yb) penumbra++;   // (el borde: de la sombra a la luz)
    if (!enS && !enCaja) { fuera++; if (Math.abs(ya - yb) <= 3) fueraIg++; if (Math.abs(Yc[i] - yb) <= 3) fueraRuido++; }
  }
  res[cal] = { ...info, oscu, enPrevista: +(oscuEn / Math.max(1, oscu)).toFixed(3), llena: +(prevOsc / Math.max(1, prev)).toFixed(3), prev, igualFuera: +(fueraIg / Math.max(1, fuera)).toFixed(4), ruido: +(fueraRuido / Math.max(1, fuera)).toFixed(4), penumbra, luz: pre.luz };
}
console.log(JSON.stringify(res));
ok('1. hay sombra y cae donde la caja tapa la linterna (≥ 1500 puntos, ≥ 90 % en la zona prevista)', ['medio', 'alto', 'ultra'].every((c) => res[c].oscu >= 1500 && res[c].enPrevista >= 0.9), Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { oscu: v.oscu, enPrevista: v.enPrevista }])));
ok('2. la sombra es oscura y llena (≥ 70 % de la zona prevista oscurecida)', ['medio', 'alto', 'ultra'].every((c) => res[c].llena >= 0.7), Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { llena: v.llena, prev: v.prev }])));
ok('3. sin acné ni manchas: lo iluminado fuera de la sombra queda igual (≥ 99,5 %, y no más distinto que dos fotos iguales sin sombra entre sí, +0,2 %)', ['medio', 'alto', 'ultra'].every((c) => res[c].igualFuera >= 0.995 && res[c].igualFuera >= res[c].ruido - 0.002), Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { igual: v.igualFuera, ruido: v.ruido }])));
ok('4. Ultra: mapa de 1024 y borde suavizado (hay penumbra); Medio y Alto, 512', res.ultra.tam === 1024 && res.ultra.penumbra > 0 && res.medio.tam === 512 && res.alto.tam === 512, { ultra: { tam: res.ultra.tam, penumbra: res.ultra.penumbra }, alto: res.alto.tam, medio: res.medio.tam });
// 5: Bajo y Patata
const bajas = {};
for (const cal of ['bajo', 'patata']) {
  await ev(ESCENA(cal)); await p.waitForTimeout(1500);
  bajas[cal] = await ev(`(() => { const raf0 = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; try { let T = window.__T || performance.now(); for (let i = 0; i < 4; i++) { T += 16; window.__T = T; cuadro(T); } } finally { window.requestAnimationFrame = raf0; } return { espSh: GFX.espSh, tex: !!ESH.tex, on: !!R.espShOn, prog: [...R.progs.keys()].filter((k) => /e[12]$/.test(k)).length }; })()`);
}
ok('5. en Bajo y Patata no hay sombra de linterna (ni mapa, ni pasada, ni shader)', Object.values(bajas).every((x) => !x.espSh && !x.tex && !x.on && !x.prog), bajas);
// 6: lo que cuesta (Alto)
await ev(ESCENA('alto')); await p.waitForTimeout(2500);
const MEDIR = (sin) => `(() => { DBG.sinEsh = ${sin}; const gl = R.gl, raf0 = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; try { let T = window.__T || performance.now(); for (let i = 0; i < 5; i++) { T += 16.7; cuadro(T); } gl.finish();
  const t0 = performance.now(); let pase = 0; for (let i = 0; i < 30; i++) { T += 16.7; cuadro(T); pase += ESH.ms; } gl.finish(); window.__T = T; return { ms: (performance.now() - t0) / 30, pase: pase / 30, dib: ESH.dib }; } finally { window.requestAnimationFrame = raf0; } })()`;
const con = [], sin = [];
for (let k = 0; k < 3; k++) { con.push(await ev(MEDIR(false))); sin.push(await ev(MEDIR(true))); }
await ev(`(() => { DBG.sinEsh = false; return 1; })()`);
const med = (L, f) => { const v = L.map(f).sort((a, b) => a - b); return +v[1].toFixed(2); };
const costo = { conMs: med(con, (x) => x.ms), sinMs: med(sin, (x) => x.ms), pasadaCpuMs: med(con, (x) => x.pase), dibujos: con[0].dib };
costo.extraPct = +((costo.conMs / costo.sinMs - 1) * 100).toFixed(1);
ok('6. lo que cuesta, en Alto: una pasada con lo que entra en el cono (≤ 6 dibujos) y ≤ 15 % más de cuadro (sin placa de video)', costo.dibujos >= 1 && costo.dibujos <= 6 && costo.extraPct <= 15, costo);
// 7: WebGL 1
// (el jugador que eligió WebGL 1: guardado antes de abrir, como en motores.mjs)
const b1 = await abrir(HTML + '?test', false, null, async (pg) => { await pg.addInitScript(() => { try { if (!sessionStorage.getItem('__gl1')) { sessionStorage.setItem('__gl1', '1'); localStorage.setItem('jx_prefs', JSON.stringify({ motor: 'webgl1', motorV: 2, bienvenida: true, tutVisto: true, gfx: 'alto' })); } } catch (e) {} }); }).catch(() => null);
let gl1 = null;
if (b1) { gl1 = await b1.ev(`(() => { GFX.auto = false; PREFS.gfx = 'alto'; aplicarGfx(); return { gl1: !!R.gl1, espSh: GFX.espSh, tex: !!ESH.tex }; })()`).catch((e) => ({ error: String(e).slice(0, 200) })); err.push(...b1.err); await b1.b.close(); }
err.push(...e0);
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|CORS|shader simplificado|willReadFrequently|\[GMod\]/i.test(x));
ok('7. sin errores de JS ni de WebGL; en WebGL 1, sin sombra de linterna', !e.length && gl1 && gl1.gl1 && !gl1.espSh && !gl1.tex, { errores: e.slice(0, 4), gl1 });
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
