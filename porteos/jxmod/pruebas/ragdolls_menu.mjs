// La pestaña Ragdolls del menú (Bugs y sugerencias: «que haga ragdolls» za7gix4d, «sección de ragdolls» 582w89z5). Con
// «FNaF SL - Funtime Foxy (Ragdoll)» (1544329722, esqueleto propio) y «Food and Household items» (108024198, sólo props):
//  1. está la pestaña Ragdolls, después de NPCs, con los personajes del juego, la sección del addon de Foxy (con su
//     muñeco) y sin la del addon de comida (sus props son de una pieza);
//  2. tocar el muñeco de Foxy lo pone como muñeco de trapo (un cuerpo por pieza), y uno de los personajes del juego cae
//     como muñeco;
//  3. sin errores de Lua ni de JS. Fotos del menú (compu y celular con CELU=1).
// uso: node ragdolls_menu.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/ragdolls_menu'] = process.argv; fs.mkdirSync(D, { recursive: true });
const suf = process.env.CELU ? '_celu' : '';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const { b, p, err, ev } = await abrir(HTML + '?test', !!process.env.CELU);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.lang = 'es'; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
for (const [id, n] of [['1544329722', 'foxy'], ['108024198', 'comida']]) await ev(`(async () => { const A = await gmInstalar('${id}', { nombre: '${n}' }); if (A && A.listo) await A.listo; return 1; })()`);
await p.waitForTimeout(1500);
const e0 = await ev(`GMA.errores.length`);
// abrir el menú en Ragdolls (los .phy de los addons que se leen de a pedazos se miran al armarla: se espera que termine)
await ev(`(() => { spawnTabs(); UI.tab = DATA.menu.findIndex((c) => c.rags); UI.sub = 0; abrirSpawn(); return 1; })()`);
for (let k = 0; k < 30 && await ev(`!!GMRG.mirando`); k++) await p.waitForTimeout(300);
await ev(`(() => { spawnRagdollsTab(); spawnDibujar(); return 1; })()`); await p.waitForTimeout(300);
const st = await ev(`(() => { const C = DATA.menu.find((c) => c.rags), i = DATA.menu.indexOf(C), j = DATA.menu.findIndex((c) => c.npcs);
  return { i, j, subs: C ? C.sub.map((s) => [s.n, s.it.length, s.it.slice(0, 3)]) : null, tab: $('tabs').children[i] && $('tabs').children[i].textContent }; })()`);
const foxy = st.subs && st.subs.find((s) => s[2].some((x) => /foxy/i.test(x)));
const comida = st.subs && st.subs.find((s) => s[0] === 'comida');
ok('1. pestaña Ragdolls después de NPCs, con los personajes del juego y Foxy, sin el addon de comida', st.i === st.j + 1 && st.subs[0][1] > 0 && !!foxy && !comida, st);
await p.screenshot({ path: D + '/1_menu' + suf + '.png', timeout: 150000 });
// la sección de Foxy
const iF = st.subs.indexOf(foxy);
await ev(`(() => { UI.sub = ${iF}; spawnDibujar(); return 1; })()`); await p.waitForTimeout(1200);
await p.screenshot({ path: D + '/2_foxy' + suf + '.png', timeout: 150000 });
// 2: tocar el muñeco (como el jugador: el primer ítem de la grilla)
await ev(`(() => { JUG.yaw = 0; JUG.pitch = 0.2; return 1; })()`);
const n0 = await ev(`GMRG.lista.size`);
await ev(`(() => { document.querySelector('#grilla .it').click(); return 1; })()`);
let n1 = n0; for (let k = 0; k < 30 && n1 === n0; k++) { await p.waitForTimeout(300); n1 = await ev(`GMRG.lista.size`); }
const cuerpos = await ev(`(() => { const e = [...GMRG.lista].pop(); return e ? e.ragGen.cuerpos.length : 0; })()`);
// un personaje del juego como muñeco
await ev(`(() => { UI.sub = 0; spawnDibujar(); return 1; })()`); await p.waitForTimeout(300);
const m0 = await ev(`PERS.filter((P) => P.muneco || P.ragdoll || P.esMuneco).length`);
await ev(`(() => { document.querySelector('#grilla .it').click(); return 1; })()`); await p.waitForTimeout(800);
const m1 = await ev(`PERS.filter((P) => P.muneco || P.ragdoll || P.esMuneco).length`);
ok('2. el muñeco de Foxy sale como muñeco de trapo y un personaje del juego cae como muñeco', n1 === n0 + 1 && cuerpos >= 2 && m1 > m0, { n0, n1, cuerpos, m0, m1 });
await ev(`(() => { cerrarPaneles(); return 1; })()`); await p.waitForTimeout(1500);
await p.screenshot({ path: D + '/3_puestos' + suf + '.png', timeout: 150000 });
const e1 = await ev(`GMA.errores.slice(${e0})`), errJs = err.filter((x) => !/WebSocket connection to|Failed to load resource/.test(x));
ok('3. sin errores de Lua ni de JS', !e1.length && !errJs.length, { lua: e1.slice(0, 4), js: errJs.slice(0, 4) });
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await b.close();
process.exit(R.every(Boolean) ? 0 : 1);
