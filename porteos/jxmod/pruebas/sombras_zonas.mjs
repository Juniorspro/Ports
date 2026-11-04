// Sombras en WebGL 2 con la copia por zonas (sombras.js): con gente caminando y cajas cayendo, el tiempo se congela y se
// compara la imagen con la de copiar el mapa fijo entero (como antes): tienen que ser iguales (sin sombras fantasma donde
// estuvo algo ni sombras de menos). Dos veces, con movimiento en el medio. También cuánto se repone por cuadro.
// uso: node sombras_zonas.mjs URL_HTML [CARPETA=/tmp/claude-0/sombras_zonas]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/sombras_zonas'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, ev, err } = await abrir(HTML + (HTML.includes('?') ? '&' : '?') + 'gl=2', true, null);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'alto'; PREFS.resDin = false; const q = PERFILES.alto; PREFS.res = q.res; PREFS.lejos = q.lejos; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
await ev(`(() => { cerrarPaneles(); DIA.hora = 15; DIA.ciclo = false; diaAplicar && diaAplicar(); for (const e of document.querySelectorAll('#hud, #tactil, .hud, #mira')) e.style.visibility = 'hidden';
  JUG.yaw = 0.4; JUG.pitch = 0.55; const f = CAM.fwd;
  for (let k = 0; k < 5; k++) { const d = 3 + k * 1.6, a = (k % 2 ? 1 : -1) * (0.15 + k * 0.08); npcCrear(['Hero', 'Soldier'][k % 2], v3(JUG.pos.x + (f.x * Math.cos(a) - f.z * Math.sin(a)) * d, JUG.pos.y - 0.9, JUG.pos.z + (f.x * Math.sin(a) + f.z * Math.cos(a)) * d), 0, { modo: 'pasear', vel: 1.6, vida: 100 }); }
  for (let k = 0; k < 4; k++) spawnDelante(['Crate', 'Barrel'][k % 2], {});
  return 1; })()`);
const foto = async (n) => { await p.waitForTimeout(1200); const f = `${D}/${n}.png`; await p.locator('#cv').screenshot({ path: f }); return f; };
const congelar = (si) => ev(`(() => { MODS.tiempo = ${si ? '1e-7' : '1'}; return 1; })()`);
const pares = [];
for (const ronda of [0, 1]) {
  await p.waitForTimeout(ronda ? 2500 : 4000);   // (que caminen y caigan: las zonas cambian de lugar)
  await congelar(true);
  await ev(`(() => { SM.zonaNo = false; return 1; })()`); const a = await foto('zonas_' + ronda);
  const est = await ev(`({ repuesto: SM.repuesto, atlas: SM.tam * SM.tam, zonas: SM.casc.map((c) => c.zona ? (c.zona[2] - c.zona[0]) + 'x' + (c.zona[3] - c.zona[1]) : '-').join(' '), npc: (typeof NPCS !== 'undefined' ? NPCS.length : -1) })`);
  await ev(`(() => { SM.zonaNo = true; return 1; })()`); const c = await foto('entero_' + ronda);
  await ev(`(() => { SM.zonaNo = false; return 1; })()`);
  pares.push([a, c, est]);
  await congelar(false);
}
await b.close();
fs.writeFileSync(`${D}/pares.json`, JSON.stringify(pares));
console.log(JSON.stringify({ pares, errores: err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket/i.test(x)).slice(0, 3) }));
