// Sonda de un addon del Workshop (para los reportes de «este mod no anda»): lo baja como el jugador (con lo que pide),
// dice qué trae (armas, entidades, NPC), y prueba cada arma (sacarla, disparar 3 s con el botón principal y 2 s con el
// secundario) y cada entidad (ponerla adelante, tocarla con «usar» y levantarla con la palanca). Junta los errores de Lua
// y de JS de cada paso, y saca fotos. uso: node mod_sonda.mjs URL_HTML ID [CARPETA]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, ID, D = '/tmp/claude-0/mod_sonda'] = process.argv; fs.mkdirSync(D, { recursive: true });
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
const errLua = () => ev(`[...(GMA.errores || [])].map((e) => String(e.m || e.msg || e).slice(0, 220))`);
const ins = await ev(`(async () => { const A = await gmInstalar('${ID}', { nombre: '${ID}' }); if (A && A.listo) await A.listo; await new Promise((r) => setTimeout(r, 1500));
  return { nombre: A.nombre, items: gmbItems(A), luaErr: (A.luaErr || []).slice(0, 8).map((e) => String(e.m || e.msg || e).slice(0, 220)), deps: A.deps || [], grandes: A.depsGrandes || [] }; })()`);
console.log('ADDON', JSON.stringify(ins, null, 1));
let e0 = (await errLua()).length, n = 0;
const nuevos = async (que) => { const L = await errLua(); const x = L.slice(e0); e0 = L.length; const j = err.splice(0); console.log(`  [${que}] errores Lua: ${x.length}${x.length ? '\n    ' + x.slice(0, 6).join('\n    ') : ''}${j.length ? '\n  JS: ' + j.slice(0, 4).join(' | ') : ''}`); };
for (const w of ins.items.armas) {
  await ev(`spawnElegir('armas', ${JSON.stringify(w)}); 1`); await p.waitForTimeout(1500);
  const enMano = await ev(`({ arma: ARM.lista[ARM.i], vista: !!(typeof GMV !== 'undefined' && GMV.actual), clip: (typeof gmaArmaActual === 'function' && gmaArmaActual()) ? 1 : 0 })`);
  await p.screenshot({ path: `${D}/${++n}_${w.replace(/\W/g, '_')}_mano.png` });
  await ev(`ENT.disparo = true; 1`); await p.waitForTimeout(1500); await p.screenshot({ path: `${D}/${++n}_${w.replace(/\W/g, '_')}_dispara.png` }); await p.waitForTimeout(1500); await ev(`ENT.disparo = false; 1`);
  await ev(`ENT.disparo2 = true; ENT.teclas.add('Mouse2'); 1`); await p.waitForTimeout(2000); await ev(`ENT.disparo2 = false; ENT.teclas.delete('Mouse2'); 1`);
  await ev(`ENT.teclas.add('KeyR'); 1`); await p.waitForTimeout(400); await ev(`ENT.teclas.delete('KeyR'); 1`); await p.waitForTimeout(800);
  console.log('ARMA', w, JSON.stringify(enMano)); await nuevos(w);
}
for (const e of ins.items.ents) {
  const antes = await ev(`OBJS.length`);
  await ev(`spawnElegir('ents', ${JSON.stringify(e)}); 1`); await p.waitForTimeout(2500);
  const r = await ev(`({ objs: OBJS.length - ${antes}, gents: typeof GMA !== 'undefined' && GMA.ents ? GMA.ents.size : 0 })`);
  await p.screenshot({ path: `${D}/${++n}_${e.replace(/\W/g, '_')}_puesta.png` });
  // («usar» mirando adelante, y agarrarla con la palanca —la Physics Gun—)
  await ev(`ENT.teclas.add('KeyE'); 1`); await p.waitForTimeout(500); await ev(`ENT.teclas.delete('KeyE'); 1`); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${D}/${++n}_${e.replace(/\W/g, '_')}_usar.png` });
  await ev(`elegirArma(ARM.lista.indexOf('PhysicsGun')); 1`); await p.waitForTimeout(600); await ev(`ENT.disparo = true; 1`); await p.waitForTimeout(2000);
  await p.screenshot({ path: `${D}/${++n}_${e.replace(/\W/g, '_')}_agarrada.png` }); await ev(`ENT.disparo = false; 1`); await p.waitForTimeout(1500);
  const r2 = await ev(`({ vivo: JUG.vivo, armas: ARM.lista.slice(-4), ui: UI.abierto || null, cong: !!JUG.congelado, bloq: !!JUG.bloqueado, vel: +Math.hypot(JUG.vel ? JUG.vel.x : 0, JUG.vel ? JUG.vel.z : 0).toFixed(2) })`);
  console.log('ENT', e, JSON.stringify(r), JSON.stringify(r2)); await nuevos(e);
}
console.log('FIN · errores JS sueltos:', JSON.stringify(err.slice(0, 5))); await b.close(); process.exit(0);
