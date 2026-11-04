// Cámara libre con el dedo (bug de Discord: «no se puede mover durante un breve tiempo, menos de 3 segundos»): toques de
// verdad (CDP Input.dispatchTouchEvent) sobre el botón de la cámara libre, el modo L, la palanca y la zona de mirar. Se mide
// cuánto tarda en moverse la cámara desde que se empuja la palanca y desde que se arrastra para mirar, en varias rondas
// (entrar, salir, volver a entrar), y que el personaje no se mueva mientras tanto.
// uso: node camlibre_toque.mjs URL_HTML
import { abrir } from './base.mjs';
const [, , HTML] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, ev, err } = await abrir(HTML, true, null);
const cdp = await p.context().newCDPSession(p);
const toque = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
const tocar = async (sel) => {
  const r = await p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, sel);
  if (!r) throw new Error('no está ' + sel);
  await toque('touchStart', [[r[0], r[1], 9]]); await p.waitForTimeout(60); await toque('touchEnd', []); await p.waitForTimeout(120);
};
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
await p.waitForTimeout(2500);
const vp = await p.evaluate(() => [innerWidth, innerHeight]);
// (un primer toque en la zona de mirar: así el juego pasa a los controles táctiles y se ven los botones)
// (hasta que aparezca el botón de la cámara libre: a veces el HUD táctil tarda un poco)
for (let i = 0; i < 10; i++) {
  await toque('touchStart', [[vp[0] * 0.6, vp[1] * 0.4, 5]]); await p.waitForTimeout(80); await toque('touchEnd', []); await p.waitForTimeout(600);
  if (await p.evaluate(() => { const e = document.querySelector('[data-btn="camLibre"]'); if (!e) return false; const q = e.getBoundingClientRect(); return q.width > 0 && getComputedStyle(e).visibility !== 'hidden' && document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2)?.closest('[data-btn="camLibre"]') === e; })) break;
}
const estado = () => ev(`({ c: R.cuadro, modo: CLIB.modo, x: CLIB.pos.x, z: CLIB.pos.z, yaw: CLIB.yaw, pitch: CLIB.pitch, jx: JUG.pos.x, jz: JUG.pos.z, ui: UI.abierto || null })`);
// cuánto tarda en cambiar algo desde que el juego recibe el primer movimiento del dedo: la página anota en qué cuadro llega
// el primer touchmove y, cuadro a cuadro, dónde está la cámara (así no cuenta lo que tarda la prueba en mirar)
await ev(`(() => { window.__mt = { mov: null, F: [], on: false }; addEventListener('touchmove', () => { if (__mt.on && __mt.mov === null) __mt.mov = [R.cuadro, performance.now()]; }, { capture: true, passive: true }); const f = () => { if (__mt.on) __mt.F.push([R.cuadro, CLIB.pos.x, CLIB.pos.z, CLIB.yaw, performance.now(), CLIB.pos.y, CLIB.my, TIEMPO.dt]); requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`);
const medir = async (gesto, cambio) => {
  const a = await estado(); await ev('(__mt.mov = null, __mt.F = [], __mt.on = true, 1)'); await gesto.empezar();
  for (let i = 0; i < 20; i++) { await gesto.paso(i); await p.waitForTimeout(50); }
  await gesto.terminar(); await p.waitForTimeout(150);
  const { mov, F } = await ev('(__mt.on = false, { mov: __mt.mov, F: __mt.F })'), s = await estado();
  let cuadros = null, ms = null;
  if (mov) { const b0 = F.filter((q) => q[0] <= mov[0]).pop() || F[0]; const q = F.find((q) => q[0] >= mov[0] && cambio(b0, q)); if (q) { cuadros = q[0] - mov[0]; ms = Math.round(q[4] - mov[1]); } }
  if (process.env.DBG) { const v = F.filter((q) => q[0] >= (mov ? mov[0] : 0)); console.log(JSON.stringify({ n: v.length, cuadros: v.length ? v[v.length - 1][0] - v[0][0] : 0, ms: v.length ? Math.round(v[v.length - 1][4] - v[0][4]) : 0, my: v.slice(0, 40).map((q) => +q[6].toFixed(2)).join(" "), dt: v.slice(0, 12).map((q) => +q[7].toFixed(3)).join(" "), d3: v.length ? +Math.hypot(v[v.length - 1][1] - v[0][1], v[v.length - 1][2] - v[0][2], v[v.length - 1][5] - v[0][5]).toFixed(2) : 0, pitch: s.pitch })); }
  return { cuadros, ms, antes: a, despues: s };
};
const palanca = { empezar: () => toque('touchStart', [[vp[0] * 0.15, vp[1] * 0.75, 1]]), paso: (i) => toque('touchMove', [[vp[0] * 0.15, vp[1] * 0.75 - Math.min(60, 30 + i * 10), 1]]), terminar: () => toque('touchEnd', []) };
const mirar = { empezar: () => toque('touchStart', [[vp[0] * 0.6, vp[1] * 0.5, 2]]), paso: (i) => toque('touchMove', [[vp[0] * 0.6 + (i + 1) * 12, vp[1] * 0.5, 2]]), terminar: () => toque('touchEnd', []) };
const res = [];
// (cuadros y programas nuevos al entrar: la primera vez el cuerpo propio se ve en tercera persona)
await ev(`(() => { window.__cl = { T: [], ult: performance.now(), on: true }; const f = () => { const t = performance.now(); __cl.T.push(t - __cl.ult); __cl.ult = t; if (__cl.on) requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`);
for (const ronda of [0, 1, 2]) {
  const pr0 = await ev('R.progs.size + R.progsPend.size'); await ev('(__cl.T.length = 0, 1)');
  await tocar('[data-btn="camLibre"]'); await tocar('[data-btn="camLibL"]'); await p.waitForTimeout(300);
  const pr1 = await ev('R.progs.size + R.progsPend.size'), cuadroMax = await ev('Math.round(Math.max(0, ...__cl.T))');
  const e0 = await estado();
  const m = await medir(palanca, (a, q) => Math.hypot(q[1] - a[1], q[2] - a[2]) > 1e-4);
  const l = await medir(mirar, (a, q) => Math.abs(q[3] - a[3]) > 1e-5);
  res.push({ ronda, programasNuevos: pr1 - pr0, cuadroMaxMs: cuadroMax, modo: e0.modo, ui: e0.ui, moverCuadros: m.cuadros, moverMs: m.ms, mirarCuadros: l.cuadros, mirarMs: l.ms, seMovio: +Math.hypot(m.despues.x - m.antes.x, m.despues.z - m.antes.z).toFixed(2), personajeSeMovio: +Math.hypot(m.despues.jx - m.antes.jx, m.despues.jz - m.antes.jz).toFixed(2) });
  await tocar('[data-btn="camLibL"]'); await tocar('[data-btn="camLibre"]'); await p.waitForTimeout(400);
}
console.log(JSON.stringify(res));
// modo R (como en Roblox): con la palanca a la derecha y el dedo quieto, el personaje camina hacia la derecha de la cámara
// (antes, al cuadro siguiente veía la palanca «ya girada» y volvía a caminar para adelante)
await tocar('[data-btn="camLibre"]'); await tocar('[data-btn="camLibR"]'); await p.waitForTimeout(300);
const r0 = await ev(`({ modo: CLIB.modo, yaw: CLIB.yaw, x: JUG.pos.x, z: JUG.pos.z })`);
await toque('touchStart', [[vp[0] * 0.15, vp[1] * 0.75, 3]]);
for (let i = 0; i < 4; i++) { await toque('touchMove', [[vp[0] * 0.15 + 15 + i * 15, vp[1] * 0.75, 3]]); await p.waitForTimeout(50); }
await p.waitForTimeout(1200);
const r1 = await ev(`({ yaw: JUG.yaw, cyaw: CLIB.yaw, x: JUG.pos.x, z: JUG.pos.z })`);
await toque('touchEnd', []); await p.waitForTimeout(200);
const meta = r1.cyaw + Math.atan2(-1, 0), dif = Math.abs(Math.atan2(Math.sin(r1.yaw - meta), Math.cos(r1.yaw - meta)));
ok('modo R: con el dedo quieto a la derecha, el personaje sigue mirando y caminando a la derecha (≤ 0,15 rad)', r0.modo === 'R' && dif <= 0.15 && Math.hypot(r1.x - r0.x, r1.z - r0.z) > 2, { modo: r0.modo, dif: +dif.toFixed(3), camino: +Math.hypot(r1.x - r0.x, r1.z - r0.z).toFixed(2) });
ok('se entra a la cámara libre L con el dedo', res.every((r) => r.modo === 'L'), res.map((r) => r.modo));
ok('la palanca mueve la cámara enseguida (en ≤ 3 cuadros desde el primer movimiento) y sigue con el dedo quieto (> 5 m en 1,3 s; a 8 m/s serían ~10) en todas las rondas', res.every((r) => r.moverCuadros !== null && r.moverCuadros <= 3 && r.seMovio > 5), res.map((r) => [r.moverCuadros, r.moverMs, r.seMovio]));
ok('arrastrar el dedo la gira enseguida (en ≤ 3 cuadros desde el primer movimiento) en todas las rondas', res.every((r) => r.mirarCuadros !== null && r.mirarCuadros <= 3), res.map((r) => [r.mirarCuadros, r.mirarMs]));
ok('al entrar no se compila nada (el cuerpo propio ya estaba listo: antes congelaba el celu) y ningún cuadro pasa de 1 s', res.every((r) => r.programasNuevos <= 0 && r.cuadroMaxMs < 1000), res.map((r) => [r.programasNuevos, r.cuadroMaxMs]));
ok('el personaje se queda quieto mientras vuela la cámara', res.every((r) => r.personajeSeMovio < 0.05), res.map((r) => r.personajeSeMovio));
const malos = err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket/i.test(x));
ok('sin errores de JS', !malos.length, malos.slice(0, 3));
await b.close();
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
