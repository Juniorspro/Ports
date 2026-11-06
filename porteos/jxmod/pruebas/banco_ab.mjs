// Comparación pareja de dos versiones en un procesador lento (la escena de banco_cuadro.mjs: gm_construct, 6 objetos, 10
// personajes caminando). Las dos páginas se abren en el mismo navegador y con el mismo azar (Math.random con semilla: los
// personajes aparecen en el mismo lugar y caminan igual), y se turnan por tandas (A B B A …), así lo que cambie en la
// máquina les toca a las dos. Los cuadros se corren uno detrás del otro con el paso fijo de 60 por segundo, sin dibujar
// en la GPU de prueba (sólo se mide el JavaScript del juego). Para cada nivel de TIEMPO.lento pedido.
// uso: FRENO=12 [SOMBRAS=1] [SEMILLA=7] node banco_ab.mjs URL_A URL_B [calidad=alto] [niveles=0,2] [tandas=8] [cuadros=40]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , HA, HB, CAL = 'alto', NIV = '0,2', TANDAS = '8', K = '40'] = process.argv;
const SEM = +(process.env.SEMILLA || 7), FRENO = +(process.env.FRENO || 1);
const INICIO = (sem) => {
  // (azar con semilla: mulberry32)
  let s = sem >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const PS = [WebGLRenderingContext.prototype].concat(typeof WebGL2RenderingContext !== 'undefined' ? [WebGL2RenderingContext.prototype] : []);
  for (const P of PS) for (const n of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements', 'clear', 'blitFramebuffer']) { const o = P[n]; if (o) P[n] = function (...a) { if (window.__vacio) return; return o.apply(this, a); }; }
};
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
async function abrir(html) {
  const ctx = await b.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await ctx.newPage(); await p.addInitScript(INICIO, SEM);
  await p.goto(html); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = ${JSON.stringify(CAL)}; PREFS.sombras = ${JSON.stringify(process.env.SOMBRAS || 'auto')}; PREFS.resDin = false; const p = PERFILES[PREFS.gfx]; PREFS.res = p.res; PREFS.lejos = p.lejos; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
  await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(2500);
  await ev(`(() => { JUG.pos.set(3.42, -2.72, 24.14); JUG.vel.set(0, 0, 0); return 1; })()`); await p.waitForTimeout(1500);
  await ev(`(() => { cerrarPaneles(); JUG.yaw = 0; JUG.pitch = 0.1; for (let k = 0; k < 6; k++) spawnDelante(['Crate', 'Barrel', 'Crate'][k % 3], {});
    let n = 0; for (let k = 0; k < 60 && n < 10; k++) { const d = [5, 9, 16, 20, 24, 28, 32, 36, 40, 45][n], a = k * 2.399, x = JUG.pos.x + Math.cos(a) * d, z = JUG.pos.z + Math.sin(a) * d;
      const h = raycast(v3(x, JUG.pos.y + 25, z), v3(0, -1, 0), 60); if (!h || !h.ground || h.n.y < 0.7) continue; const y = JUG.pos.y + 25 - h.t; if (Math.abs(y - JUG.pos.y) > 12) continue;
      npcCrear(['Hero', 'Soldier'][n % 2], v3(x, y + 0.05, z), 0, { modo: 'pasear', vel: 1.4, vida: 100 }); n++; }
    DIA.hora = 13; DIA.ciclo = false; diaAplicar && diaAplicar(); return 1; })()`);
  await p.waitForTimeout(3000);
  await ev(`window.__vacio = true; window.requestAnimationFrame = () => 0; 1`);
  if (FRENO > 1) { const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: FRENO }); }
  return { p, ev, html };
}
const A = await abrir(HA), B = await abrir(HB);
const niveles = NIV.split(',').map(Number), res = { A: {}, B: {} }; for (const n of niveles) { res.A[n] = []; res.B[n] = []; }
const tanda = (X, n, k) => X.ev(`(() => { TIEMPO.lento = ${n}; let T = window.__bT || performance.now(); const o = []; for (let i = 0; i < ${k}; i++) { T += 1000 / 60; const a = performance.now(); cuadro(T); o.push(performance.now() - a); } window.__bT = T; return o; })()`);
// (calentar: 60 cuadros de cada nivel en las dos)
for (const X of [A, B]) for (const n of niveles) await tanda(X, n, 60);
for (let t = 0; t < +TANDAS; t++) for (const n of (t % 2 ? niveles.slice().reverse() : niveles)) for (const [nom, X] of (t % 2 ? [['B', B], ['A', A]] : [['A', A], ['B', B]])) res[nom][n].push(...(await tanda(X, n, +K)));
const est = (a) => { const s = a.slice().sort((x, y) => x - y), p50 = s[Math.floor(s.length / 2)], b2 = a.filter((x) => x <= 8 * p50), m = b2.reduce((x, y) => x + y, 0) / b2.length; return { n: a.length, prom: +m.toFixed(2), p50: +p50.toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), picos: a.length - b2.length }; };
const info = async (X) => JSON.parse(await X.ev(`JSON.stringify({ npcs: NPC.lista.length, pos: NPC.lista.slice(0, 3).map((P) => [+P.pos.x.toFixed(1), +P.pos.z.toFixed(1)]) })`));
const o = { freno: FRENO, cal: CAL, sombras: process.env.SOMBRAS || 'auto', A: { html: HA.split('/').pop(), ...(await info(A)) }, B: { html: HB.split('/').pop(), ...(await info(B)) } };
for (const n of niveles) { const a = est(res.A[n]), c = est(res.B[n]); o['lento' + n] = { A: a, B: c, cambio: +(100 * (c.prom - a.prom) / a.prom).toFixed(1) + ' %' }; }
console.log(JSON.stringify(o));
await b.close();
