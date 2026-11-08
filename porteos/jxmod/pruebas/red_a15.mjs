// Galaxy A15 en multijugador (Discord: «0 fps en multijugador, solo anda bien»): un celular emulado como el A15 (pantalla
// 873×393 a 2×, táctil, el user agent y el modelo SM-A155F → Helio G99 → calidad Medio, 4 GB, 8 núcleos, procesador
// frenado FRENO veces) entra a una sala con N jugadores que caminan en círculos alrededor, saltan y tiran (bots en un broker
// local que mandan lo mismo que el juego: su estado 10 veces por segundo, su mundo retenido y los tiros).
// Se mide cada cuadro después de los primeros 10 s: promedio ≥ 30 fps, ninguno de más de 250 ms y sin errores.
// La placa del A15 (Mali-G57 MC2) no se puede emular: SwiftShader dibuja con el mismo procesador (compartido con otras
// pruebas) y taparía todo; por eso los dibujos de WebGL no llegan a la GPU de prueba (VACIO=0 para dibujar igual) y se mide
// lo que hace el celular con su procesador: el JavaScript, los estilos, el diseño y el pintado de la página, y la
// composición de las capas (lo que se rompía: el texto de la sala y los nombres se escribían en cada cuadro y la capa de
// los controles, de pantalla completa, se volvía a pintar y rasterizar en cada cuadro).
// uso: node red_a15.mjs HTML_o_URL [N=4] [SEG=30]   (entorno: FRENO=5, VACIO=1, RICO=1 sala con cosas y NPCs, PUERTO,
//      BROKER_DIR = carpeta con mc/broker (aedes + ws), BASE = otro HTML para comparar en las mismas condiciones)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import http from 'http';
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad';
const req = createRequire(S + '/mc/broker/package.json');
const [, , HTML, N0 = '4', SEG0 = '30'] = process.argv;
const N = +N0, SEG = Math.max(15, +SEG0), FRENO = +(process.env.FRENO || 5), VACIO = process.env.VACIO !== '0', RICO = !!process.env.RICO;
const PUERTO = +(process.env.PUERTO || 8898), BROKER = 'ws://127.0.0.1:' + PUERTO + '/mqtt';
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' });
wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(PUERTO, '127.0.0.1', r));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const pub = (topic, obj, retain) => new Promise((r) => aedes.publish({ cmd: 'publish', topic, payload: Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)), qos: 0, retain: !!retain }, r));
const RR = []; const ok = (n, c, d) => { RR.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(d)); };
// ---- los jugadores de la sala (bots): caminan en círculo delante de la aparición, saltan cada tanto y tiran ----
const SALA = { id: 'pruebaa15', n: 'Prueba A15', m: 'FlatGrass', mo: 'Free', of: 0, pvp: 1, rpg: 1, nb: 1, mp: 1000, mv: 40, pw: 0 };
const ROOM = 'jxmod_v1_r_' + SALA.id, SKINS = ['Soldier', 'Jean', 'Zombi', 'Vegeta', 'Goku', 'Rick'], PROPS = ['Crate', 'Barrel', 'Box1', 'Chair1', 'Cone', 'Table', 'Tire', 'Box3'];
let bots = [], botsT = null;
function botsCrear() {
  bots = []; for (let i = 0; i < N; i++) bots.push({ id: 'bot' + i + Math.random().toString(36).slice(2, 7), n: 'Bot' + i, k: SKINS[i % SKINS.length], r: 4 + 2.5 * i, w: 0.35 + 0.07 * i, a0: i * 1.3, t: 0 });
  clearInterval(botsT);
  botsT = setInterval(() => {
    for (const B of bots) {
      B.t += 0.1; const a = B.a0 + B.t * B.w, x = Math.cos(a) * B.r, z = 3 + Math.sin(a) * B.r, vx = -Math.sin(a) * B.r * B.w, vz = Math.cos(a) * B.r * B.w;
      const salto = (Math.floor(B.t * 10) % 37) < 4;
      pub(ROOM + '/e', { n: B.n, k: B.k, kw: 0, h: 'HatParty', ga: 0, u: 0, c: 0, p: [+x.toFixed(3), salto ? 2.08 : 1.48, +z.toFixed(3)], y: +Math.atan2(vx, vz).toFixed(3), t: 0, v: [+vx.toFixed(3), salto ? 2 : 0, +vz.toFixed(3)], f: salto ? 4 : 5, a: 'Pistol', e: 0, mu: 0, w: 0, vr: 0, i: B.id });
      if (Math.random() < 0.05) pub(ROOM + '/a', { k: 'tiro', a: 'Pistol', p: [x, 2.2, z], d: [Math.cos(a), 0, Math.sin(a)], i: B.id });
      if (RICO) {   // (tres cosas agarradas que se mueven y dos NPC que caminan)
        const l = []; for (let j = 0; j < 3; j++) { const b = B.t * 0.8 + j * 2.1; l.push([100 + j, +(x + Math.cos(b) * 2).toFixed(3), +(1.2 + 0.5 * Math.sin(b * 2)).toFixed(3), +(z + Math.sin(b) * 2).toFixed(3), 0, +Math.sin(b / 2).toFixed(4), 0, +Math.cos(b / 2).toFixed(4)]); }
        pub(ROOM + '/m', { l, i: B.id });
        if (Math.round(B.t * 10) % 2 === 0) pub(ROOM + '/a', { k: 'npcs', l: [0, 1].map((j) => [j + 1, j ? 'Zombi' : 'Soldier', +(x + 3 + j).toFixed(3), 1.48, +(z - 3).toFixed(3), 0, +vx.toFixed(3), 0, +vz.toFixed(3), 1, '', '', 0, 0]), i: B.id });
      }
    }
  }, 100);
}
async function botsEntrar() {
  for (const [bi, B] of bots.entries()) {
    await pub('jxmod_v1_l/' + B.id, { s: SALA, j: B.n, t: Math.round(Date.now() / 1000) }, true);
    const o = [[1, 'Crate', 2 + bi, 1.0, 8, 0, 0, 0, 1, 0, 0]];
    if (RICO) { for (let j = 0; j < 25; j++) o.push([2 + j, PROPS[j % PROPS.length], -12 + j, 0.6, -6 - 3 * bi, 0, 0, 0, 1, 1, 0]); for (let j = 0; j < 3; j++) o.push([100 + j, 'Crate', 3 * bi, 1.2, 8 + j, 0, 0, 0, 1, 0, 0]); }
    await pub(ROOM + '/w/' + B.id, { o, e: [], md: [], i: B.id }, true);
  }
}
async function botsSalir() { clearInterval(botsT); for (const B of bots) { await pub(ROOM + '/w/' + B.id, '', true); await pub('jxmod_v1_l/' + B.id, '', true); } }
// ---- el Galaxy A15 ----
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
async function medir(html) {
  botsCrear();
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  await ctx.addInitScript((vacio) => {
    // (lo que el navegador del A15 dice de sí mismo: el modelo por Client Hints, 4 GB y 8 núcleos)
    Object.defineProperty(Navigator.prototype, 'deviceMemory', { configurable: true, get: () => 4 });
    Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { configurable: true, get: () => 8 });
    const uad = { brands: [{ brand: 'Chromium', version: '130' }], mobile: true, platform: 'Android', getHighEntropyValues: async () => ({ model: 'SM-A155F', platform: 'Android', platformVersion: '14.0.0', mobile: true }), toJSON() { return {}; } };
    Object.defineProperty(Navigator.prototype, 'userAgentData', { configurable: true, get: () => uad });
    // (el momento de cada cuadro: otra cola de requestAnimationFrame, que corre en el mismo cuadro que el juego)
    window.__cuadros = []; const f = () => { window.__cuadros.push(performance.now()); requestAnimationFrame(f); }; requestAnimationFrame(f);
    if (vacio) {
      const PS = [WebGLRenderingContext.prototype].concat(typeof WebGL2RenderingContext !== 'undefined' ? [WebGL2RenderingContext.prototype] : []);
      for (const P of PS) for (const n of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements', 'clear', 'blitFramebuffer']) { const o = P[n]; if (o) P[n] = function (...a) { if (window.__vacio) return; return o.apply(this, a); }; }
    }
  }, VACIO);
  const p = await ctx.newPage(), err = [];
  p.on('pageerror', (e) => err.push(e.message.slice(0, 200)));
  const cdp = await ctx.newCDPSession(p);
  const url = (/^https?:/.test(html) ? html : 'file://' + html), sep = url.includes('?') ? '&' : '?';
  await p.goto(url + sep + 'test&broker=' + encodeURIComponent(BROKER));
  await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  const det = JSON.parse(await ev('JSON.stringify({ nom: CELU.det && CELU.det.nom, perfil: GFX.nombre, tactil: COARSE })'));
  await botsEntrar();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: FRENO });
  if (VACIO) await ev('window.__vacio = true; 1');
  await ev(`PREFS.nombre = 'A15'; PREFS.bienvenida = true; entrarSala(${JSON.stringify(SALA)}); 1`);
  await ev('window.__cuadros.length = 0; 1');
  // (lo que cambia en la página en cada cuadro, entre los 12 y los 16 s)
  let mut = null;
  for (let s = 0; s < SEG; s++) {
    if (s === 12) mut = ev(`(async () => { const c = {}; let n = 0, on = true; const mo = new MutationObserver((l) => { for (const m of l) { const e = m.target.nodeType === 1 ? m.target : m.target.parentElement; const k = (e && (e.id || e.className) || '?') + ':' + m.type; c[k] = (c[k] || 0) + 1; } }); mo.observe(document.body, { subtree: true, attributes: true, childList: true, characterData: true }); const f = () => { if (on) { n++; requestAnimationFrame(f); } }; requestAnimationFrame(f); await new Promise((r) => setTimeout(r, 4000)); on = false; mo.disconnect(); return JSON.stringify({ n, c }); })()`);
    await espera(1000);
  }
  const C = await p.evaluate(() => window.__cuadros);
  const est = JSON.parse(await ev("JSON.stringify({ on: RED.on, rem: RED.remotos.size, sala: SALA && SALA.id, etiqueta: getComputedStyle([...RED.remotos.values()][0].tag).willChange, redEst: $('redEst').textContent })"));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await b.close(); await botsSalir();
  const d = []; for (let i = 1; i < C.length; i++) if (C[i] - C[0] > 10000) d.push(C[i] - C[i - 1]);
  const o = d.slice().sort((a, b) => a - b), tot = o.reduce((a, b) => a + b, 0), pct = (q) => (o.length ? o[Math.min(o.length - 1, Math.floor(q * o.length))] : 0);
  const M = mut ? JSON.parse(await mut) : { n: 1, c: {} }, porCuadro = Object.fromEntries(Object.entries(M.c).map(([k, v]) => [k, +(v / Math.max(1, M.n)).toFixed(2)]));
  return { det, est, err, cuadros: o.length, fps: o.length ? +(1000 * o.length / tot).toFixed(1) : 0, p50: +pct(0.5).toFixed(1), p95: +pct(0.95).toFixed(1), max: +(o[o.length - 1] || 0).toFixed(0), largos: o.filter((x) => x > 250).length, porCuadro };
}
console.log(`Galaxy A15 emulado: procesador ×${FRENO} más lento, ${N} jugadores${RICO ? ' (sala con cosas y NPCs)' : ''}, ${VACIO ? 'sin dibujar en la GPU de prueba' : 'dibujando con SwiftShader'}, ${SEG} s`);
if (process.env.BASE) { const r = await medir(process.env.BASE); console.log('BASE (para comparar):', JSON.stringify({ fps: r.fps, p50: r.p50, p95: r.p95, max: r.max, largos: r.largos, porCuadro: r.porCuadro })); }
const r = await medir(HTML);
console.log('medido:', JSON.stringify({ fps: r.fps, p50: r.p50, p95: r.p95, max: r.max, largos: r.largos, cuadros: r.cuadros }));
ok('el juego reconoce el Galaxy A15 (Helio G99) y elige Medio, con los controles táctiles', r.det.nom === 'Samsung Galaxy A15' && r.det.perfil === 'medio' && r.det.tactil, r.det);
ok(`está en la sala y ve a los ${N} jugadores`, r.est.on && r.est.rem === N && r.est.sala === SALA.id, r.est);
ok('promedio de 30 fps o más después de los primeros 10 s', r.fps >= 30, { fps: r.fps, p50: r.p50, p95: r.p95 });
ok('ningún cuadro de más de 250 ms después de los primeros 10 s', r.largos === 0 && r.cuadros > 0, { max: r.max, largos: r.largos });
ok('los nombres de los jugadores van en su propia capa (moverlos no vuelve a pintar los controles)', r.est.etiqueta === 'transform', r.est.etiqueta);
const otros = Object.entries(r.porCuadro).filter(([k, v]) => !/^etiqueta:attributes$/.test(k) && v > 0.2);
ok('en cada cuadro sólo se mueven los nombres: nada más de la página cambia (el texto de la sala ya no se reescribe)', !otros.length, r.porCuadro);
ok('sin errores de JS', !r.err.length, r.err.slice(0, 5));
console.log(`RESUMEN ${RR.filter(Boolean).length}/${RR.length}`);
srv.close(); process.exit(0);
