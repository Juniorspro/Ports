// La comparación de FPS de Ajustes (juego/banco.js) de punta a punta: mide WebGL 1 y WebGL 2 en gm_construct en Alto,
// vuelve al motor y a los ajustes de antes y muestra la tabla. Los números de acá son de esta máquina (sin GPU: SwiftShader
// dibuja con la CPU), sirven para comparar los motores entre sí y ver el costo del lado de JS, no para saber los FPS de un celu.
// uso: node banco.mjs URL_HTML [segundos=8]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, SEG = '8'] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML, true, null);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; guardarPrefs(); 1`);
const antes = await ev(`({ motor: R.gl1 ? 'webgl1' : 'webgl2', gfx: PREFS.gfx, resDin: PREFS.resDin, res: PREFS.res })`);
const t0 = Date.now();
await ev(`bancoEmpezar('alto', ${+SEG}, 3); 1`);
await p.waitForFunction(() => !!document.querySelector('.bancoT'), null, { timeout: 900000, polling: 2000 });
await p.waitForTimeout(500);
const r = await ev(`({ ult: JSON.parse(localStorage.getItem('jx_banco_ult')), motor: R.gl1 ? 'webgl1' : 'webgl2', gfx: PREFS.gfx, resDin: PREFS.resDin, res: PREFS.res, enCurso: localStorage.getItem('jx_banco'), tabla: document.querySelector('.bancoT').innerText, texto: document.getElementById('banco').dataset.texto })`);
await p.screenshot({ path: '/tmp/claude-0/reg/banco_tabla.png' });
console.log(r.tabla); console.log(r.texto); console.log('tardó ' + Math.round((Date.now() - t0) / 1000) + ' s');
const M = r.ult.motores, res = r.ult.res;
ok('midió los dos motores (WebGL 1 y WebGL 2)', M.join() === 'webgl1,webgl2' && M.every((m) => res[m] && res[m].fps > 0 && !res[m].falla), res);
ok('la misma resolución en los dos', new Set(M.map((m) => res[m].w + 'x' + res[m].h)).size === 1, M.map((m) => res[m].w + 'x' + res[m].h));
ok('volvió al motor y a los ajustes de antes', r.motor === antes.motor && r.gfx === antes.gfx && r.resDin === antes.resDin && r.res === antes.res && !r.enCurso, { antes, despues: { motor: r.motor, gfx: r.gfx, resDin: r.resDin, res: r.res } });
const malos = err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket connection to 'wss:|NPC|npc\.max/i.test(x));
ok('sin errores de JS', !malos.length, malos.slice(0, 5));
await b.close();
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
