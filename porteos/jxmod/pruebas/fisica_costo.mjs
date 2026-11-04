// lo que cuesta la física contra el mapa: en un mapa, 8 autos andando y 40 cajas cayendo y rodando por el terreno, 600
// pasos de física (a 60 por segundo, simulados): milisegundos por paso (promedio y el peor) y cuántos triángulos del
// mapa se tocaron por primera vez. Para comparar dos versiones en las mismas condiciones (misma semilla).
// uso: node fisica_costo.mjs URL_HTML [MAPA] [abierto]  (abierto: los autos repartidos por el mapa andando casi derecho;
// si no, todos juntos dando vueltas cerca de la aparición, donde en RB_Colinas chocan contra rocas de miles de triángulos)
import { abrir } from './base.mjs';
const { b, p, err, ev } = await abrir(process.argv[2]);
const MAPA = process.argv[3] || 'RB_Colinas', ABIERTO = process.argv[4] === 'abierto';
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('${MAPA}'); 1`);
await p.waitForFunction((mm) => window.__ev(`MUNDO.nombre === '${mm}' && JUEGO.estado === 'juego'`), MAPA, { timeout: 90000 });
await p.waitForTimeout(2500);
const r = await ev(`(async () => {
  const ABIERTO = ${ABIERTO}; JUEGO.pausaFisica = true; let s = 7; const az = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const sp = MUNDO.spawns.length ? MUNDO.spawns[0] : v3(0, 5, 0), autos = [], cajas = [];
  for (let k = 0; k < 8; k++) { const x = sp.x + (ABIERTO ? (k - 4) * 22 : (k - 4) * 8), z = sp.z + (ABIERTO ? ((k * 7) % 5 - 2) * 20 : 10), y = pisoBajo(v3(x, sp.y + 30, z), 80); if (y === null) continue; const o = crearObjeto('Sedan', v3(x, y + 1.2, z), Quat.axis(0, 1, 0, az() * 6.28), {}); if (o && o.veh) autos.push(o); }
  for (let k = 0; k < 40; k++) { const x = sp.x + (az() - 0.5) * 40, z = sp.z + (az() - 0.5) * 40, y = pisoBajo(v3(x, sp.y + 30, z), 80); if (y === null) continue; const o = crearObjeto('WoodenBox', v3(x, y + 2 + az() * 4, z), Quat.axis(az(), 1, az(), az() * 6), {}); if (o) cajas.push(o); }
  const ent = { x: ABIERTO ? 0.05 : 0.3, y: 1, saltar: false, correr: false }, ms = []; const n0 = MUNDO.triCuerpo.filter(Boolean).length;
  for (let i = 0; i < 600; i++) { const t0 = performance.now(); for (const o of autos) autoPaso(o.veh, 1 / 60, ent); physStep(1 / 60); ms.push(performance.now() - t0); }
  ms.sort((a, b) => a - b); const prom = ms.reduce((a, b) => a + b, 0) / ms.length;
  return { autos: autos.length, cajas: cajas.length, cuerpos: PH.bodies.length, ms: +prom.toFixed(3), p95: +ms[Math.floor(ms.length * 0.95)].toFixed(3), peor: +ms[ms.length - 1].toFixed(2), trisNuevos: MUNDO.triCuerpo.filter(Boolean).length - n0 }; })()`);
console.log(MAPA, JSON.stringify(r));
await b.close();
