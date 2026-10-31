import { abrir } from './base.mjs';
const { b, p, ev } = await abrir(process.argv[2]);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); window.__t0 = TIEMPO.t; empezarPartida('FlatGrass'); 1`);
for (const ms of [500, 1000, 1500, 2500, 4000]) { await p.waitForTimeout(ms === 500 ? 500 : 500); }
console.log(JSON.stringify(await ev(`({ dt: +(TIEMPO.t - window.__t0).toFixed(2), y: +JUG.pos.y.toFixed(2), vy: +JUG.vel.y.toFixed(2), suelo: JUG.suelo, fps: R.fps || null, cuerpo: JUG.cuerpo && JUG.cuerpo.skin, noclip: JUG.noclip })`)));
await b.close();
