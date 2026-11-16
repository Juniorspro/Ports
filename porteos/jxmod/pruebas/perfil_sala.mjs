// perfil: un cuadro jugando solo contra una sala de 8 jugadores remotos (simulados: su estado 10 veces por segundo, como por la red). Sin la placa de video (los dibujos no llegan a la GPU de prueba): sólo el procesador.
// uso: node perfil_sala.mjs URL_HTML [freno=4] [mapa=RB_Construct] [jugadores=8]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, FRENO = '4', MAPA = 'RB_Construct', NREM = '8'] = process.argv;
const VACIAR = () => {
  const PS = [WebGLRenderingContext.prototype].concat(typeof WebGL2RenderingContext !== 'undefined' ? [WebGL2RenderingContext.prototype] : []);
  for (const P of PS) for (const n of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements', 'clear', 'blitFramebuffer']) { const o = P[n]; if (o) P[n] = function (...a) { if (window.__vacio) return; return o.apply(this, a); }; }
};
const { b, p, err, ev } = await abrir(HTML, true, null, async (pg) => { await pg.addInitScript(VACIAR); });
const cdp = await p.context().newCDPSession(p);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('${MAPA}'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 180000 });
await p.waitForTimeout(3000);
await ev(`window.__vacio = true; 1`);
await ev(`(() => { window.__n = 0; const f = () => { window.__n++; requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`);
await cdp.send('Performance.enable'); await cdp.send('Emulation.setCPUThrottlingRate', { rate: +FRENO });
const medir = async (seg) => {
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value])), n0 = await ev('window.__n');
  await p.waitForTimeout(seg * 1000);
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value])), n1 = await ev('window.__n');
  const fr = n1 - n0; return { fps: +(fr / seg).toFixed(1), jsMsCuadro: +((m1.ScriptDuration - m0.ScriptDuration) * 1000 / fr).toFixed(2), tareasMsCuadro: +((m1.TaskDuration - m0.TaskDuration) * 1000 / fr).toFixed(2), estiloMs: +((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000 / fr).toFixed(2), layoutMs: +((m1.LayoutDuration - m0.LayoutDuration) * 1000 / fr).toFixed(2), personas: await ev('PERS.length') };
};
const solo = await medir(6);
console.log('solo', JSON.stringify(solo));
// la sala: un estado de muestra (el mío) y 8 que se mueven en círculo, 10 veces por segundo cada uno
await ev(`(() => { RED.on = true; RED.ID = 'yo1'; RED.ROOM = 'prueba'; window.publicar = publicar = () => {}; const J = JUG, N = ${+NREM};
  window.__sala = setInterval(() => { const t = performance.now() / 1000; for (let k = 0; k < N; k++) { const a = t * 0.5 + k * 0.8, x = J.pos.x + Math.cos(a) * (6 + k), z = J.pos.z + Math.sin(a) * (6 + k);
    redMensaje('prueba/e', JSON.stringify({ i: 'r' + k, n: 'Jugador' + k, k: ['Hero', 'Zombie', 'Hero', 'Gman'][k % 4], kw: 0, h: 'HatEmpty', ga: 0, u: 0, c: 0, p: [+x.toFixed(3), J.pos.y, +z.toFixed(3)], y: +(a + 1.57).toFixed(3), t: 0, v: [-Math.sin(a) * 3, 0, Math.cos(a) * 3], f: 5, a: 'PhysicsGun', e: 0, hp: 100, mu: 0, w: 0, vr: 0, rt: t })); } }, 100);
  return 1; })()`);
await p.waitForTimeout(4000);
const sala = await medir(6);
console.log('sala', JSON.stringify(sala));
// perfil de CPU de la sala
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
await p.waitForTimeout(5000);
const { profile } = await cdp.send('Profiler.stop');
const self = new Map(), byId = new Map(profile.nodes.map((n) => [n.id, n])); const dt = profile.timeDeltas; const cnt = new Map();
for (let i = 0; i < profile.samples.length; i++) cnt.set(profile.samples[i], (cnt.get(profile.samples[i]) || 0) + (dt[i] || 0));
let tot = 0; for (const [id, t] of cnt) { const n = byId.get(id), k = n.callFrame.functionName || '(' + n.callFrame.url.split('/').pop().slice(0, 20) + ')'; self.set(k, (self.get(k) || 0) + t); tot += t; }
const par = new Map(); for (const n of profile.nodes) for (const c of n.children || []) par.set(c, n.id);
const tot2 = new Map(); for (const [id, t] of cnt) { const vistos = new Set(); let x = id; while (x !== undefined) { const n = byId.get(x), k = n.callFrame.functionName; if (k && !vistos.has(k)) { vistos.add(k); tot2.set(k, (tot2.get(k) || 0) + t); } x = par.get(x); } }
console.log('total con hijos (ms en 5 s):', [...tot2.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, t]) => k + ' ' + (t / 1000).toFixed(0)).join(' | '));
const quien = new Map(); for (const [id, t] of cnt) { const n = byId.get(id), k = n.callFrame.functionName; if (!/^(querySelector|querySelectorAll|createPanner|createBiquadFilter|createGain|actualizar|getBoundingClientRect)$/.test(k)) continue; const pa = byId.get(par.get(id)), pk = k + '<-' + (pa ? pa.callFrame.functionName : '?'); quien.set(pk, (quien.get(pk) || 0) + t); }
console.log('quién llama (ms):', [...quien.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, t]) => k + ' ' + (t / 1000).toFixed(1)).join(' | '));
console.log('top propio (ms en 5 s):', [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22).map(([k, t]) => k + ' ' + (t / 1000).toFixed(0)).join(' | '));
console.log('errores', err.filter((e) => !/WebSocket|ERR_CONN|net::/.test(e)).slice(0, 3));
await b.close();
