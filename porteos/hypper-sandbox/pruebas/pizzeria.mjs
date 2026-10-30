// la pizzería: entra al mapa y saca fotos desde varios lugares (oficina, pasillos, comedor, escenario) con cada calidad
// uso: node pizzeria.mjs HTML CARPETA [calidad] [lugares JSON]
import { abrir } from './base.mjs';
const HTML = process.argv[2], SALIDA = (process.argv[3] || '.') + '/', CAL = process.argv[4] || 'alto';
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto=false; PREFS.calidad='${CAL}'; aplicarGfx && aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Pizzeria')`);
await p.waitForTimeout(4000);
if (process.env.CLARO) await ev(`window.__claro = setInterval(() => { R.ambS=[0.55,0.55,0.55]; R.ambG=[0.45,0.45,0.45]; R.niebla = { c: [0,0,0], a: 400, b: 500 }; DIA.aplicada = 99; }, 50); 0`);
const lugares = process.argv[5] ? JSON.parse(process.argv[5]) : [['aparicion', null]];
for (const [nom, l] of lugares) {
  if (l) await ev(`JUG.noclip = true; JUG.pos.set(${l[0]}, ${l[1]}, ${l[2]}); JUG.vel.set(0,0,0); JUG.yaw = ${l[3]}; JUG.pitch = ${l[4] || 0}; 0`);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: SALIDA + 'pz_' + nom + '.png' });
  console.log(nom, await ev(`JSON.stringify({pos:[+JUG.pos.x.toFixed(2),+JUG.pos.y.toFixed(2),+JUG.pos.z.toFixed(2)], suelo: JUG.suelo, fps: Math.round(TIEMPO.fps), tris: R.tris, dib: R.dibujadas})`));
}
console.log('errores:', err.filter((e) => !/WebSocket|mqtt/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
await b.close();
