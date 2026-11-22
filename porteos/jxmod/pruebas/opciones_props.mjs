// Las Opciones de JXMod en el menú de props (antes «mods oficiales»; pedido del dueño: «los mods oficiales borrarlos
// todos y dejalos como opciones en props»), jugando solo en Pasto plano:
//  1. Props empieza por «Opciones» (y después «Mods»): las 16 de JXMod (sin Verity), las que se prenden con su luz y la
//     radio, la tele y el piano sin luz (se ponen); abajo, cómo se usan;
//  2. tocar «Gravedad lunar» la prende (la tarjeta marcada, la gravedad del mundo × 0,35) y abajo aparece su fuerza;
//     al 50 % la gravedad queda en 0,35^0,5; tocarla otra vez la apaga (la gravedad vuelve);
//  3. tocar la radio la pone delante (una entidad radio nueva) y cierra el menú;
//  4. ya no son mods: la tienda (Mods y mapas → Mods) no muestra ninguna, «Mis mods» y el menú MOD (U) tampoco, aunque
//     haya una prendida;
//  5. sin errores de JS.
// uso: node opciones_props.mjs ARCHIVO.html [CARPETA_CAPTURAS]
import { abrir } from './base.mjs';
import fs from 'fs';
const HTML = process.argv[2], D = (process.argv[3] || '/tmp/claude-0/opc_prueba') + '/'; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.mods = {}; idiomaAplicar('es'); inicioMostrar(true); RB.mapaPartida = OFICIALES_MAPAS[0]; RB.mapaCom = 'megarampa'; RB.horaPartida = 'normal'; inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego'`), null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(3000);
const ver = `(() => { const its = [...document.querySelectorAll('#grilla .it.itOpc')]; return { cats: [...document.querySelectorAll('#cats .cat')].slice(0, 3).map((d) => d.textContent), n: its.length, ids: its.map((d) => d.dataset.opc),
  luces: its.filter((d) => d.querySelector('.opcLuz')).length, on: its.filter((d) => d.classList.contains('on')).map((d) => d.dataset.opc), pie: document.getElementById('pie').textContent.slice(0, 90), fz: [...document.querySelectorAll('#pie input[data-of]')].map((r) => r.dataset.of) }; })()`;
// 1)
const a = await ev(`(() => { abrirSpawn(); UI.tab = DATA.menu.findIndex((c) => c.n === 'Props'); UI.sub = 0; UI.q = ''; spawnDibujar(); return ${ver}; })()`);
await p.screenshot({ path: D + 'o1_opciones.png' });
ok('1. Props empieza por Opciones y Mods; 16 opciones (sin Verity): 13 con luz y radio, tele y piano sin luz; abajo cómo se usan',
  a.cats[0] === 'Opciones' && a.cats[1] === 'Mods' && a.n === 16 && !a.ids.includes('verity') && a.luces === 13 && ['radio', 'pantalla', 'piano'].every((x) => a.ids.includes(x)) && /prenderla/.test(a.pie), a);
// 2)
const g0 = await ev(`MUNDO.gravedad`);
await ev(`document.querySelector('#grilla .it.itOpc[data-opc=luna]').click(); 1`); await p.waitForTimeout(300);
const a2 = await ev(ver), g1 = await ev(`MUNDO.gravedad`);
await p.screenshot({ path: D + 'o2_luna.png' });
await ev(`(() => { const r = document.querySelector('#pie input[data-of=luna]'); r.value = 50; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); return 1; })()`); await p.waitForTimeout(200);
const g2 = await ev(`MUNDO.gravedad`);
await ev(`document.querySelector('#grilla .it.itOpc[data-opc=luna]').click(); 1`); await p.waitForTimeout(300);
const a3 = await ev(ver), g3 = await ev(`MUNDO.gravedad`);
ok('2. Gravedad lunar: se prende (marcada, gravedad × 0,35, su fuerza abajo), al 50 % queda en 0,35^0,5 y se apaga (vuelve)',
  a2.on.includes('luna') && Math.abs(g1 / g0 - 0.35) < 0.01 && a2.fz.includes('luna') && Math.abs(g2 / g0 - Math.sqrt(0.35)) < 0.01 && !a3.on.includes('luna') && Math.abs(g3 - g0) < 1e-6 && !a3.fz.length,
  { g0, g1, g2, g3, on: a2.on, fz: a2.fz, despues: a3.on });
// 3)
const r0 = await ev(`ENTS.lista.filter((e) => e.t === 'radio').length`);
await ev(`(() => { abrirSpawn(); UI.tab = DATA.menu.findIndex((c) => c.n === 'Props'); UI.sub = 0; UI.q = ''; spawnDibujar(); document.querySelector('#grilla .it.itOpc[data-opc=radio]').click(); return 1; })()`); await p.waitForTimeout(800);
const r1 = await ev(`({ radios: ENTS.lista.filter((e) => e.t === 'radio').length, abierto: UI.abierto || null })`);
await ev(`cerrarPaneles(); 1`); await p.waitForTimeout(300);
await p.screenshot({ path: D + 'o3_radio.png' });
ok('3. la radio se pone delante (una entidad nueva) y el menú de props se cierra', r1.radios === r0 + 1 && r1.abierto !== 'spawn', { r0, r1 });
// 4)
await ev(`(() => { const m = opcionesJX().find((x) => x.id === 'veloz'); modAlternar('veloz'); return 1; })()`); await p.waitForTimeout(200);
const opcIds = a.ids;
const t4 = await ev(`(() => { const mis = modsTodos().map((m) => m.id), act = modsActivosAhora().map((m) => m.id), vel = +JUG.vel_max.toFixed(2);
  modMenuAbrir(); const mm = [...document.querySelectorAll('#modMenu [data-mm^="mod:"]')].map((d) => d.dataset.mm.slice(4)); modMenuCerrar();
  return { mis, act, mm, vel, insignia: (document.querySelector('.modmBt .mmN') || {}).textContent || '' }; })()`);
// (la tienda, en Mods, con lo que haya de la gente: la de verdad no se alcanza desde la prueba y no importa)
await ev(`(() => { inicioMostrar(true); RB.t.tab = 'mod'; RB.t.vista = 'explorar'; RB.t.ficha = null; RB.t.sel = null; RB.t.q = ''; RB.t.etq = ''; RB.t.p = 0; inicioPanel('tienda'); return 1; })()`);
await p.waitForTimeout(2500);
const t6 = await ev(`(() => { const S = RB.t || {}; return { tab: S.tab, items: (S.items || []).map((x) => x.id), oficiales: (S.items || []).filter((x) => x.oficial).map((x) => x.id) }; })()`).catch((e) => ({ error: String(e) }));
await p.screenshot({ path: D + 'o4_tienda.png' });
ok('4. ya no son mods: ni en Mis mods, ni en el menú MOD (aunque Velocidad esté prendida y andando), ni en la tienda',
  t4.act.includes('veloz') && !t4.mis.some((x) => opcIds.includes(x)) && !t4.mm.some((x) => opcIds.includes(x)) && !(t6.oficiales || []).length, { t4, t6 });
// 5)
const errJs = err.filter((e) => !/Failed to load resource|WebSocket connection|net::ERR|CORS policy|scheme 'file'/.test(e));
ok('5. sin errores de JS', errJs.length === 0, errJs.slice(0, 5));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close();
