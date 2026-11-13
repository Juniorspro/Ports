// La caja negra avisa «El juego se trabó» sólo si se trabó (Discord, 3.1: a Juanpepo le salió con el juego todavía
// cargando, sin mapa ni mods y sin motor gráfico —{"juego":"carga","mapa":"","motor":"-","mods":[],...}—: esa vez el
// aparato no dio WebGL al arrancar; no se trabó). Cada caso abre el juego con lo que quedó de la vez anterior:
//  1. el registro de Juanpepo tal cual (3.1, sin WebGL y cargando) con el juego «andando» (rb_vivo): sin aviso y sin bajar
//     los gráficos;
//  2. la vez anterior se ocultó con el juego vivo y después la cerró el sistema: sin aviso;
//  3. la vez anterior se cortó jugando, a la vista: aviso (un cierre de verdad);
//  4. la app de Android dice cómo terminó: «atras:ok» sin aviso; «adelante» y «atras:sin latido 50 s», con aviso;
//  5. de punta a punta: jugando se va a segundo plano y se cae el proceso (lo cierra el sistema) → al volver, sin aviso;
//     jugando a la vista se cae el proceso → con aviso;
//  6. WebGL que no está las 2 primeras veces que se pide (pasajero): el juego arranca igual, sin el cartel de error;
//  7. sin errores de JS.
// uso: node caja_falso.mjs URL_HTML
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML] = process.argv;
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 600) : '')); };
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const errJS = [];
// el registro de la 3.1 de la captura de Juanpepo (lo que se ve en el cartel)
const JUANPEPO = { v: '3.1 · 11/11/2026 01:14 UTC', t: Date.now() - 135000, paso: '', addon: '', l: [], e: { juego: 'carga', mapa: '', fps: 60, motor: '-', dx: 90, memJS: '38/1020 MB', ram: 4, mods: [], instalados: 6, cola: [] } };
const JUGANDO = { v: '3.1', t: Date.now() - 60000, paso: '', addon: '', l: [], e: { juego: 'juego', mapa: 'FlatGrass', calidad: 'bajo', fps: 41, motor: 'webgl2', dx: 90, mods: [], ini: 'ok' } };
// abre el juego en un contexto nuevo con lo guardado de la vez anterior (ls) y, si se pide, la app de Android de mentira
async function abrir(ls, nativo, gl) {
  const ctx = await b.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  await ctx.addInitScript(({ ls, nativo, gl }) => {
    if (!sessionStorage.getItem('__prep')) { sessionStorage.setItem('__prep', '1'); for (const k in ls) localStorage.setItem(k, ls[k]); }
    if (nativo !== null) window.JXNativo = new Proxy({}, { get: (o, k) => (k === 'cierreAnterior' ? () => nativo : k === 'registroNativo' ? () => '' : k === 'red' ? undefined : () => {}) });
    // (WebGL que falla las primeras «gl» veces: las cuenta la pestaña, también después de recargar)
    if (gl) { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, o) { if (/webgl/.test(t)) { const n = +sessionStorage.getItem('__glN') || 0; sessionStorage.setItem('__glN', String(n + 1)); if (n < gl) return null; } return g.call(this, t, o); }; }
  }, { ls: ls || {}, nativo: nativo === undefined ? null : nativo, gl: gl || 0 });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
  await p.goto(HTML); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 }); await p.waitForTimeout(2500);
  return { ctx, p, ev: (s) => p.evaluate((x) => window.__ev(x), s) };
}
const aviso = (ev) => ev(`JSON.stringify({ aviso: !!document.getElementById('cnVen'), titulo: document.getElementById('cnVen') ? document.querySelector('#cnVen b').textContent : '', cierreNuevo: CIERRE.nuevo, cierres: CIERRE.n, errorInicio: !!INI.err })`).then(JSON.parse);
const vivo = () => String(Date.now() - 20000);
// 1
{ const { ctx, ev } = await abrir({ jx_caja: JSON.stringify(JUANPEPO), rb_vivo: vivo() }); const a = await aviso(ev); ok('1. el registro de Juanpepo (sin WebGL, cargando): sin «se trabó» y sin bajar gráficos', !a.aviso && !a.cierreNuevo, a); await ctx.close(); }
// 2
{ const { ctx, ev } = await abrir({ jx_caja: JSON.stringify(Object.assign({}, JUGANDO, { oc: Date.now() - 50000 })), rb_vivo: vivo() }); const a = await aviso(ev); ok('2. se ocultó con el juego vivo y lo cerró el sistema: sin aviso', !a.aviso && !a.cierreNuevo, a); await ctx.close(); }
// 3
{ const { ctx, ev } = await abrir({ jx_caja: JSON.stringify(JUGANDO), rb_vivo: vivo() }); const a = await aviso(ev); ok('3. se cortó jugando a la vista: con aviso', a.aviso && a.cierreNuevo, a); await ctx.close(); }
// 4
for (const [nat, quiere] of [['atras:ok', false], ['adelante', true], ['atras:sin latido 50 s', true]]) {
  const { ctx, ev } = await abrir({ jx_caja: JSON.stringify(JUGANDO), rb_vivo: vivo() }, nat); const a = await aviso(ev);
  ok('4. la app dice «' + nat + '»: ' + (quiere ? 'con' : 'sin') + ' aviso', a.aviso === quiere && a.cierreNuevo === quiere, a); await ctx.close();
}
// 5 (de punta a punta: la vez anterior de verdad, en la misma «compu»)
for (const [atras, quiere] of [[true, false], [false, true]]) {
  const { ctx, p, ev } = await abrir({});
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.gfx = 'patata'; GFX.auto = false; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego'`), null, { timeout: 120000 }); await p.waitForTimeout(3000);
  // (a segundo plano: lo que hace la vista web de Android en onPause —Chromium sin pantalla no oculta páginas—)
  const otra = null; if (atras) { await ev(`Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); 1`); await p.waitForTimeout(1500); }
  const antes = await ev(`JSON.stringify({ vis: document.visibilityState, vivo: !!localStorage.getItem('rb_vivo'), oc: JSON.parse(localStorage.getItem('jx_caja')).oc })`).then(JSON.parse);
  // (se cae el proceso sin avisar; lo que quedó guardado es lo que encuentra la próxima vez. Si al ocultarse borró rb_vivo,
  // se lo vuelve a poner: como si el sistema lo hubiera cortado antes de guardar —lo peor que puede pasar—)
  await ev(`localStorage.setItem('rb_vivo', String(Date.now())); 1`);
  const s = await ctx.newCDPSession(p); s.send('Page.crash').catch(() => {}); await new Promise((r) => setTimeout(r, 1500)); await Promise.race([p.close().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]); if (otra) await otra.close();
  const p2 = await ctx.newPage(); p2.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
  await p2.goto(HTML); await p2.waitForFunction(() => window.__listo, null, { timeout: 240000 }); await p2.waitForTimeout(2500);
  const a = await aviso((x) => p2.evaluate((y) => window.__ev(y), x));
  ok('5. ' + (atras ? 'en segundo plano' : 'a la vista') + ' se cae el proceso: ' + (quiere ? 'con' : 'sin') + ' aviso', a.aviso === quiere, { antes, despues: a });
  await ctx.close();
}
// 6
{ const { ctx, ev } = await abrir({}, undefined, 4); const a = await aviso(ev); const g = await ev(`JSON.stringify({ gl: !!R.gl, motor: R.gl1 ? 'webgl1' : 'webgl2', listo: INI.ok })`).then(JSON.parse);
  ok('6. WebGL que no está las 2 primeras veces que se pide (WebGL 2 y 1): arranca igual, sin cartel de error', g.gl && g.listo && !a.errorInicio && !a.aviso, Object.assign(g, a)); await ctx.close(); }
const err = errJS.filter((e) => !/WebSocket|mqtt|net::|Failed to load/i.test(e));
ok('7. sin errores de JS', !err.length, err.slice(0, 5));
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
await b.close();
process.exit(R0.every(Boolean) ? 0 : 1);
