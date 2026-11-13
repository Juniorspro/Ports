// El ascensor de gm_mallparking (Discord: «varias zonas de mapas, como el ascensor de gm_mallparking, no tienen colisión
// ni sirven»): es un func_tracktrain sin caras (choca con brochas invisibles) con la cabina como prop pegado y botones que
// le mandan StartForward; sus path_track lo paran en cada piso (OnPass → Stop).
//  1. el tren está, con cascos de choque, y la cabina tiene piso (un rayo para abajo adentro pega en el tren);
//  2. parado adentro, el botón de adentro lo sube a 100 pulgadas/s (2,54 m/s ±5 %) y para en el piso de arriba (±5 cm);
//  3. el jugador viaja con él: los pies quedan a la misma distancia del piso (±3 cm) en todo el viaje, siempre parado;
//  4. otra vez el botón: baja y para en el piso de abajo;
//  5. las paredes de la cabina no dejan salir (caminando 2 s para tres lados queda a < 1,9 m del medio) y el cuarto lado
//     es la puerta (sale más de 2 m);
//  6. las brochas sin caras que chocan (clips) del mapa cuentan;  7. sin errores de JS.
// uso: node ascensor_mapa.mjs URL_HTML URL_CARPETA_GMA (con 2619660952.gma) — el contenido de HL2 (la cabina) de Steam
import { abrir } from './base.mjs';
const [, , HTML, G = new URL('/gma', HTML).href] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await p.waitForTimeout(2500);
const m = await ev(`(async () => { const u = new Uint8Array(await (await fetch(${JSON.stringify(G)} + '/2619660952.gma')).arrayBuffer()); await gmInstalar('2619660952', { nombre: 'gm_mallparking', sinDeps: true }, u); const k = [...GBSP.mapas].filter(([, x]) => x.id === '2619660952').map(([k]) => k)[0]; empezarPartida(k); return k; })()`);
await p.waitForFunction((k) => window.__ev(`MUNDO.nombre === '${k}' && JUEGO.estado === 'juego'`), m, { timeout: 600000, polling: 500 });
await p.waitForTimeout(5000);
await ev(`window.__esp = async (s) => { const t0 = TIEMPO.t; for (let i = 0; i < 4000 && TIEMPO.t < t0 + s; i++) await new Promise((r) => setTimeout(r, 30)); }; 1`);
const t1 = await ev(`(() => { const D = PUERTAS.l.find((x) => x.P.tren), q = gbspG(20, -2672, -100), h = mundoRayo(v3(q[0], q[1], q[2]), v3(0, -1, 0), 4); return { tren: !!D, cascos: D ? D.bs.length : 0, piso: !!(h && h.caja && h.caja.tren), brochas: (DATA.aj[MUNDO.nombre] || {}).brochas }; })()`);
ok('1. el ascensor está, choca y la cabina tiene piso', t1.tren && t1.cascos > 0 && t1.piso, t1);
const viaje = async (ini) => ev(`(async () => { const D = PUERTAS.l.find((x) => x.P.tren); ${ini ? `const q = gbspG(20, -2672, -100); JUG.pos.set(q[0], q[1], q[2]); JUG.vel.set(0, 0, 0); await __esp(1.5);` : ''}
  const dif0 = JUG.pos.y - D.T.pos.y, y0 = D.T.pos.y; mioBoton(PUERTAS.bot.find((x) => x.n === 'elevbutton1'), true); const S = []; let vmax = 0;
  for (let i = 0; i < 40; i++) { await __esp(0.25); S.push([+(JUG.pos.y - D.T.pos.y - dif0).toFixed(3), JUG.suelo ? 1 : 0]); vmax = Math.max(vmax, Math.abs(D.T.vel)); if (i > 4 && Math.abs(D.T.vel) < 1e-3) break; }
  return { y0: +y0.toFixed(2), y1: +D.T.pos.y.toFixed(2), cur: D.T.cur && D.T.cur.n, vmax: +vmax.toFixed(2), difMax: Math.max(...S.map((x) => Math.abs(x[0]))), parado: S.every((x) => x[1]) }; })()`);
const sube = await viaje(true), arriba = await ev(`+gbspG(0, 0, 456)[1].toFixed(2)`);
ok('2. sube a 2,54 m/s y para en el piso de arriba', Math.abs(sube.vmax - 2.54) < 0.13 && Math.abs(sube.y1 - arriba) < 0.05 && sube.cur === 'path_3', { ...sube, arriba });
ok('3. el jugador viaja con él, parado, con los pies a la misma distancia del piso', sube.difMax < 0.03 && sube.parado, { difMax: sube.difMax });
const baja = await viaje(false), abajo = await ev(`+gbspG(0, 0, -73)[1].toFixed(2)`);
ok('4. baja y para en el piso de abajo', Math.abs(baja.y1 - abajo) < 0.05 && baja.cur === 'path_1' && baja.difMax < 0.03, { ...baja, abajo });
const pared = await ev(`(async () => { const D = PUERTAS.l.find((x) => x.P.tren), c = D.T.pos.clone(), out = []; for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { JUG.pos.set(c.x, D.T.pos.y - 0.7, c.z); JUG.vel.set(0, 0, 0); JUG.yaw = yaw; await __esp(0.3); ENT.teclas.add('KeyW'); await __esp(2); ENT.teclas.delete('KeyW'); await __esp(0.3); out.push(+Math.hypot(JUG.pos.x - c.x, JUG.pos.z - c.z).toFixed(2)); } return out; })()`);
const s = pared.slice().sort((a, c) => a - c);
ok('5. las paredes no dejan salir y por la puerta se sale', s[2] < 1.9 && s[3] > 2, pared);
ok('6. las brochas invisibles del mapa chocan', t1.brochas && t1.brochas.invisibles > 0, t1.brochas);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:|aborted/i.test(x));
ok('7. sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
