// Banco de cuadros parejo para comparar versiones en un procesador lento: la misma escena que perfil_cuadro.mjs
// (gm_construct, props, 6 personajes), pero los cuadros se corren uno detrás del otro con el paso fijo de 60 por segundo
// (sin esperar a la pantalla) y sin espiar WebGL, así lo que se mide es sólo el JavaScript del juego. Con VACIO los
// dibujos no llegan a la GPU de prueba. Mide por tandas alternando los niveles de TIEMPO.lento pedidos (0, 1, 2) en la
// misma página, así el ruido de la máquina les toca a todos por igual.
// uso: FRENO=12 [SOMBRAS=1] node banco_cuadro.mjs URL_HTML [calidad=alto] [niveles=0,2] [tandas=6] [cuadros=40]
import { abrir } from './base.mjs';
const [, , HTML, CAL = 'alto', NIV = '0,2', TANDAS = '6', K = '40'] = process.argv;
const VACIAR = () => {
  const PS = [WebGLRenderingContext.prototype].concat(typeof WebGL2RenderingContext !== 'undefined' ? [WebGL2RenderingContext.prototype] : []);
  for (const P of PS) for (const n of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements', 'clear', 'blitFramebuffer']) { const o = P[n]; if (o) P[n] = function (...a) { if (window.__vacio) return; return o.apply(this, a); }; }
};
const { b, p, ev } = await abrir(HTML, true, null, async (pg) => { await pg.addInitScript(VACIAR); });
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = ${JSON.stringify(CAL)}; PREFS.sombras = ${JSON.stringify(process.env.SOMBRAS || 'auto')}; PREFS.resDin = false; const p = PERFILES[PREFS.gfx]; PREFS.res = p.res; PREFS.lejos = p.lejos; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(2500);
await ev(`(() => { JUG.pos.set(${process.env.POS || '3.42,-2.72,24.14'}); JUG.vel.set(0, 0, 0); return 1; })()`); await p.waitForTimeout(1500);
// (10 personajes: 2 cerca y el resto a más de 15 y 30 m, como en un mapa con NPCs repartidos)
await ev(`(() => { cerrarPaneles(); JUG.yaw = 0; JUG.pitch = 0.1; for (let k = 0; k < 6; k++) spawnDelante(['Crate', 'Barrel', 'Crate'][k % 3], {});
  // (cada uno donde hay piso: un rayo desde arriba; si no hay, otro ángulo)
  let n = 0; for (let k = 0; k < 60 && n < 10; k++) { const d = [5, 9, 16, 20, 24, 28, 32, 36, 40, 45][n], a = k * 2.399, x = JUG.pos.x + Math.cos(a) * d, z = JUG.pos.z + Math.sin(a) * d;
    const h = raycast(v3(x, JUG.pos.y + 25, z), v3(0, -1, 0), 60); if (!h || !h.ground || h.n.y < 0.7) continue; const y = JUG.pos.y + 25 - h.t; if (Math.abs(y - JUG.pos.y) > 12) continue;
    npcCrear(['Hero', 'Soldier'][n % 2], v3(x, y + 0.05, z), 0, { modo: 'pasear', vel: 1.4, vida: 100 }); n++; }
  DIA.hora = 13; DIA.ciclo = false; diaAplicar && diaAplicar(); return 1; })()`);
await p.waitForTimeout(4000);
await ev(`window.__vacio = true; window.__rafO = requestAnimationFrame; window.requestAnimationFrame = () => 0; 1`);
await p.waitForTimeout(300);
const FRENO = +(process.env.FRENO || 1); let cdp = null;
if (FRENO > 1) { cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: FRENO }); }
const niveles = NIV.split(',').map(Number), res = Object.fromEntries(niveles.map((n) => [n, []]));
// (calentar: unos cuadros de cada nivel antes de medir)
for (const n of niveles) await ev(`(() => { TIEMPO.lento = ${n}; let T = window.__bT || performance.now(); for (let i = 0; i < 40; i++) { T += 1000 / 60; cuadro(T); } window.__bT = T; return 1; })()`);
for (let t = 0; t < +TANDAS; t++) for (const n of (t % 2 ? niveles.slice().reverse() : niveles)) {
  const v = await ev(`(() => { TIEMPO.lento = ${n}; let T = window.__bT; const o = []; for (let i = 0; i < ${+K}; i++) { T += 1000 / 60; const a = performance.now(); cuadro(T); o.push(performance.now() - a); } window.__bT = T; return o; })()`);
  res[n].push(...v);
}
// (picos: cuadros de más de 8 veces la mediana. Con la placa de prueba —SwiftShader, en el procesador— a veces se traba
// un par de segundos una vez por corrida, pase lo que pase en el juego —le pasa igual a la versión anterior—: se cuentan
// aparte y el promedio es sin ellos, así no decide la comparación dónde cayó esa traba)
const est = (a) => { const s = a.slice().sort((x, y) => x - y), p50 = s[Math.floor(s.length / 2)], b = a.filter((x) => x <= 8 * p50), m = b.reduce((x, y) => x + y, 0) / b.length; return { n: a.length, prom: +m.toFixed(2), p50: +p50.toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), picos: a.length - b.length }; };
const info = await ev(`({ gfx: GFX.nombre, lienzo: R.cv.width + 'x' + R.cv.height, npcs: NPC.lista.length, lejos15: NPC.lista.filter((P) => Math.hypot(P.pos.x - CAM.pos.x, P.pos.z - CAM.pos.z) > 15).length })`);
console.log(JSON.stringify({ html: HTML.split('/').pop(), freno: FRENO, ...info, niveles: Object.fromEntries(niveles.map((n) => [n, est(res[n])])) }));
await b.close();
