// La pestaña NPCs del menú de spawn (Discord: «Sección de spawnmenu pa npcs»), como la del spawnmenu de GMod:
//  1. está, antes de Vehículos, y su primera categoría tiene todos los personajes del juego, cada uno con su retrato;
//  2. tocar un personaje pone un NPC donde se apunta (≤ 0,6 m), apoyado en el piso (≤ 10 cm), mirándote (≤ 20°), y el
//     pie del menú dice qué se puso; el menú queda abierto para poner más;
//  3. con DrGBase (sus nextbots) y Walter instalados, sus NPC aparecen agrupados por su categoría (la de su
//     list.Set("NPC")) y tocar uno lo pone en el mapa;
//  4. el buscador encuentra NPCs de cualquier categoría (escribiendo «walter»);
//  5. en el celu (horizontal) la pestaña NPCs se puede tocar: queda dentro de la pantalla y nada la tapa;
//  6. sin errores de JS ni de Lua.
// uso: node npcs_menu.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, G, D = '/tmp/claude-0/npcs_menu'] = process.argv;
fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 1200) : '')); };
const INICIO = `PREFS.bienvenida = true; PREFS.tutVisto = true; idiomaAplicar('es'); GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); 1`;
const { b, p, ev, err } = await abrir(HTML + '?test', false);
await ev(INICIO);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
await p.waitForTimeout(1500);
const TAB = `(() => { const i = DATA.menu.findIndex((c) => c.npcs); if (i < 0) return -1; abrirSpawn(); $('tabs').children[i].click(); return i; })()`;
// 1
const t1 = await ev(`(() => { const i = ${TAB}, iv = DATA.menu.findIndex((c) => c.n === 'Vehicles'), C = DATA.menu[i]; const its = [...$('grilla').querySelectorAll('.it')]; return { i, iv, nombre: C && C.n, cat0: C && C.sub[0] && C.sub[0].n, chars: DATA.chars.length, items: its.length, conRetrato: its.filter((d) => { const im = d.querySelector('img'); return im && im.getAttribute('src') && !/sil/i.test(im.getAttribute('src')); }).length }; })()`);
ok('1. la pestaña NPCs está antes de Vehículos y tiene todos los personajes del juego con su retrato', t1.i >= 0 && (t1.iv < 0 || t1.i < t1.iv) && t1.items === t1.chars && t1.conRetrato >= t1.chars - 1, t1);
await p.screenshot({ path: `${D}/1_npcs.png` });
// 2
await ev(`(() => { JUG.yaw = 0.3; JUG.pitch = 0.42; return 1; })()`); await p.waitForTimeout(400);
const meta = await ev(`(() => { const h = raycast(CAM.pos, CAM.fwd, 40, null); const q = h ? vadd(CAM.pos, vscale(CAM.fwd, h.t)) : null; return q ? { x: q.x, y: q.y, z: q.z, cx: CAM.pos.x, cz: CAM.pos.z } : null; })()`);
// (quieto, para medir hacia dónde quedó mirando al ponerlo: paseando ya se da vuelta)
const n0 = await ev(`(() => { window.__act0 = NPC.act; NPC.act = { modo: 'quieto' }; return NPC.lista.length; })()`);
await ev(`(() => { const it = [...$('grilla').querySelectorAll('.it')].find((d) => d.textContent.trim() === 'Soldier'); it.click(); return 1; })()`);
await p.waitForFunction(() => window.__ev(`NPC.lista.length`) > 0, null, { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(1500);
const t2 = await ev(`(() => { const P = NPC.lista[NPC.lista.length - 1]; if (!P) return null; const pie = P.pos.y - (P.medio || 0.9), piso = pisoBajo(v3(P.pos.x, P.pos.y, P.pos.z), 0.2); const mira = Math.atan2(${meta.cx} - P.pos.x, ${meta.cz} - P.pos.z), dy = Math.atan2(Math.sin((P.yaw ?? P.ang ?? 0) - mira), Math.cos((P.yaw ?? P.ang ?? 0) - mira));
  return { skin: P.skin, lejos: +Math.hypot(P.pos.x - ${meta.x}, P.pos.z - ${meta.z}).toFixed(3), pieSobrePiso: piso === null ? null : +(pie - piso).toFixed(3), giroGrados: +(Math.abs(dy) * 180 / Math.PI).toFixed(1), pie: $('spPuso').textContent, abierto: UI.abierto }; })()`);
ok('2. tocar un personaje pone el NPC donde se apunta, en el piso, mirándote; el pie dice qué se puso y el menú sigue abierto', (await ev(`NPC.lista.length`)) === n0 + 1 && t2 && t2.skin === 'Soldier' && t2.lejos <= 0.6 && t2.pieSobrePiso !== null && Math.abs(t2.pieSobrePiso) <= 0.1 && t2.giroGrados <= 20 && /Soldier/.test(t2.pie) && t2.abierto === 'spawn', t2);
await ev(`(() => { cerrarPaneles(); NPC.act = window.__act0; return 1; })()`);
await p.screenshot({ path: `${D}/2_soldier.png` });
// 3: DrGBase y Walter
const ins = [];
for (const id of ['1560118657', '1635295969']) ins.push(await ev(`(async () => { const u = new Uint8Array(await (await fetch(${JSON.stringify(G)} + '/${id}.gma')).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, u); await A.listo; return { id: '${id}', npcs: [...((A.listas && A.listas.NPC) || new Map()).keys()].length, luaErr: (A.luaErr || []).length }; })()`));
await p.waitForTimeout(1500);
const t3 = await ev(`(() => { ${TAB}; const C = DATA.menu.find((c) => c.npcs); const cats = C.sub.slice(1).map((s) => ({ n: s.n, it: s.it.length, gm: s.it.filter((x) => /^gmnpc:/.test(x)).length })); return { cats }; })()`);
const totalGm = t3.cats.reduce((a, c) => a + c.gm, 0), esperado = ins.reduce((a, x) => a + x.npcs, 0);
// tocar el primero de la categoría de DrGBase que no sea la de Walter
const cat = t3.cats.find((c) => c.gm > 0);
const e0 = await ev(`[...GMA.ents.values()].filter((e) => e.vivo !== false && (e.tipo === 'npc' || /nextbot|drg|npc_/i.test(e.clase))).length + NPC.lista.length`);
await ev(`(() => { const C = DATA.menu.find((c) => c.npcs), k = C.sub.findIndex((s) => s.n === ${JSON.stringify(cat ? cat.n : '')}); UI.sub = k; spawnDibujar(); const it = $('grilla').querySelector('.it'); it.click(); return 1; })()`);
await p.waitForTimeout(2500);
const e1 = await ev(`[...GMA.ents.values()].filter((e) => e.vivo !== false && (e.tipo === 'npc' || /nextbot|drg|npc_/i.test(e.clase))).length + NPC.lista.length`);
ok('3. los NPC de DrGBase y Walter aparecen agrupados por su categoría y tocar uno lo pone', esperado > 0 && totalGm === esperado && !!cat && e1 === e0 + 1, { instalados: ins, cats: t3.cats, puestos: e1 - e0 });
await ev(`(() => { cerrarPaneles(); return 1; })()`);
await p.screenshot({ path: `${D}/3_addon.png` });
// 4: el buscador
const t4 = await ev(`(() => { ${TAB}; const q = $('spQ'); q.value = 'walter'; q.oninput(); const its = [...$('grilla').querySelectorAll('.it')].map((d) => d.textContent.trim()); return { its }; })()`);
ok('4. el buscador encuentra NPCs de cualquier categoría («walter»)', t4.its.length >= 1 && t4.its.every((t) => /walter/i.test(t)), t4);
await ev(`(() => { cerrarPaneles(); return 1; })()`);
// 5: en el celu
const c = await abrir(HTML + '?test', true);
await c.ev(INICIO);
await c.p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
await c.p.waitForTimeout(1500);
const t5 = await c.ev(`(() => { const i = DATA.menu.findIndex((c) => c.npcs); abrirSpawn(); const t = $('tabs').children[i]; t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = t.getBoundingClientRect(), W = innerWidth, H = innerHeight, x = r.left + r.width / 2, y = r.top + r.height / 2, el = document.elementFromPoint(x, y); return { W, H, r: [r.left, r.top, r.right, r.bottom].map(Math.round), dentro: r.left >= 0 && r.right <= W && r.top >= 0 && r.bottom <= H, tocable: !!el && (el === t || t.contains(el)) }; })()`);
await c.p.screenshot({ path: `${D}/5_celu.png` });
ok('5. en el celu la pestaña NPCs queda dentro de la pantalla y se puede tocar', t5.dentro && t5.tocable, t5);
const le = await ev(`GMA.errores.map((x) => String(x.msg || x).slice(0, 200)).slice(0, 4)`);
const e = [...err, ...c.err].filter((x) => !/WebSocket|net::|Failed to load|404|favicon|CORS|shader simplificado|willReadFrequently|\[GMod\]/i.test(x));
ok('6. sin errores de JS ni de Lua', !e.length && !le.length, { js: e.slice(0, 4), lua: le });
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await c.b.close(); await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
