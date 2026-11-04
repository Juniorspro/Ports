// ¿en qué se va el tiempo de un arma de addon? La pone en la mano y perfila (con el perfilador de Chrome) N llamadas a
// una parte del cuadro (por defecto la vista del arma, gmrVistaArma): da las funciones con más tiempo propio.
// uso: node prof_arma.mjs URL_HTML URL_CARPETA_GMA ID ARMA [parte=gmrVistaArma] [N=300]
import { abrir } from './base.mjs';
const [, , HTML, CARP, ID, ARMA, PARTE = 'gmrVistaArma', N = '300'] = process.argv;
const { b, p, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; PREFS.resDin = false; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
await ev(`(async () => { const r = await fetch(${JSON.stringify(CARP)} + '/${ID}.gma'); const A = await gmInstalar('${ID}', { nombre: '${ID}', sinDeps: true }, new Uint8Array(await r.arrayBuffer())); await A.listo;
  gmaDarArma('${ARMA}'); elegirArma(ARM.lista.indexOf('gm:${ARMA}')); return 1; })()`);
await p.waitForTimeout(2000);
// (calentar: que el código ya esté compilado como en el juego)
await ev(`(() => { for (let i = 0; i < 100; i++) { try { ${PARTE}(); } catch (e) {} } return 1; })()`);
const cdp = await p.context().newCDPSession(p);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 50 }); await cdp.send('Profiler.start');
const t = await ev(`(() => { const t0 = performance.now(); for (let i = 0; i < ${+N}; i++) { try { ${PARTE}(); } catch (e) {} } return (performance.now() - t0) / ${+N}; })()`);
const { profile } = await cdp.send('Profiler.stop');
const dt = []; for (let i = 0; i < profile.timeDeltas.length; i++) dt.push(profile.timeDeltas[i]);
const self = new Map(), porId = new Map(profile.nodes.map((n) => [n.id, n]));
for (let i = 0; i < profile.samples.length; i++) { const n = porId.get(profile.samples[i]); const f = n.callFrame, k = (f.functionName || '(anónima)') + ':' + f.lineNumber; self.set(k, (self.get(k) || 0) + (dt[i] || 0)); }
const tot = [...self.values()].reduce((a, b) => a + b, 0);
console.log(`${ARMA} ${PARTE}: ${t.toFixed(3)} ms por llamada`);
for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(((v / tot) * 100).toFixed(1).padStart(5) + ' %  ' + k);
// (y el tiempo total, con lo que llaman, de cada función: dice qué parte grande es la que pesa)
const hijos = new Map(profile.nodes.map((n) => [n.id, n.children || []])), propio = new Map();
for (let i = 0; i < profile.samples.length; i++) propio.set(profile.samples[i], (propio.get(profile.samples[i]) || 0) + (dt[i] || 0));
const total = new Map();
const rec = (id, pila) => { const n = porId.get(id), f = n.callFrame, k = (f.functionName || '(anónima)') + ':' + f.lineNumber; let s = propio.get(id) || 0; const nueva = pila.has(k) ? pila : new Set([...pila, k]);
  for (const h of hijos.get(id)) s += rec(h, nueva); if (!pila.has(k)) total.set(k, (total.get(k) || 0) + s); return s; };
rec(profile.nodes[0].id, new Set());
console.log('--- total (con lo que llama)');
for (const [k, v] of [...total.entries()].filter(([k]) => !/^\((root|program|idle|garbage)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(((v / tot) * 100).toFixed(1).padStart(5) + ' %  ' + k);
await b.close(); process.exit(0);
