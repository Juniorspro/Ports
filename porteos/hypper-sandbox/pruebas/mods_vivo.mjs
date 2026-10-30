// mods en vivo desde el menú MOD (jugando solo, con todos los oficiales instalados): prender y apagar cualquiera, fuerza,
// buscador y lo que se ve
import { abrir } from './base.mjs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/', celu = process.argv[4] === 'celu';
const { b, p, err, ev } = await abrir(HTML, celu);
const espera = (ms) => p.waitForTimeout(ms);
await ev(`PREFS.bienvenida = true; GFX.auto=false; PREFS.lang='es'; PREFS.mods = {}; INST.of = Object.fromEntries(OFICIALES.map((m) => [m.id, true])); PREFS.modFuerza = {}; PREFS.skin = 'Hero'; inicioMostrar(true); RB.mapaPartida=null; RB.mapaCom=null; RB.horaPartida='normal'; inicioMostrar(false); empezarPartida('FlatGrass')`);
await espera(4000);
await ev(`JUG.pos.set(20, 1.6, 20); JUG.vel.set(0,0,0); 1`);
console.log('sin mods: botón MOD', await ev(`MODM.boton.style.display !== 'none'`), '· gravedad', await ev(`MUNDO.gravedad`), '· vel', await ev(`JUG.vel_max.toFixed(2)`));
if (celu) await p.tap('.modmBt'); else await p.keyboard.press('KeyU');
await p.waitForFunction(() => window.__ev('MODM.abierto'), null, { timeout: 10000 }).catch(() => {}); await espera(300);
console.log('menú:', await ev(`JSON.stringify({filas: document.querySelectorAll('#modMenu .mmCat').length, buscador: !!document.getElementById('mmQ'), usar: document.querySelectorAll('#modMenu [data-mm^="nat:"]').length})`));
await p.screenshot({ path: D + 'v1_menu_vacio.png' });
// (en las filas de mods se toca el interruptor: la barra de fuerza no prende ni apaga)
const clic = async (sel) => { const s2 = /^\[data-mm="mod:/.test(sel) ? sel + ' .smSw' : sel; if (celu) await p.tap(s2); else await p.click(s2); await espera(350); };
await clic('[data-mm="mod:luna"]');
console.log('luna: gravedad', await ev(`MUNDO.gravedad.toFixed(3)`), '· fuerza visible', await ev(`!!document.querySelector('[data-mf="luna"]')`), '· botón dice', await ev(`MODM.boton.querySelector('.mmN').textContent`));
for (const v of [200, 0, 100]) { await ev(`(() => { const r = document.querySelector('[data-mf="luna"]'); r.value = ${v}; r.dispatchEvent(new Event('input', { bubbles: true })); })()`); await espera(400); console.log('  fuerza', v + '%', '→ gravedad', await ev(`MUNDO.gravedad.toFixed(3)`)); }
await clic('[data-mm="mod:veloz"]'); console.log('veloz: vel_max', await ev(`JUG.vel_max.toFixed(2)`));
await clic('[data-mm="mod:goku"]'); await espera(600);
console.log('goku: skinMod', await ev(`JUG.skinMod`), '· skin guardado sigue', await ev(`PREFS.skin`), '· cuerpo', await ev(`JUG.cuerpo.skin`), '· salto', await ev(`JUG.salto.toFixed(2)`));
await clic('[data-mm="mod:volar"]');
console.log('nativos: usar', await ev(`[...document.querySelectorAll('#modMenu [data-mm^="nat:"]')].map(e=>e.dataset.mm).join(',')`), '· NAT', await ev(`[...NAT.mods].join(',')`));
// los assets (radio, piano, pantalla) no se prenden: están en su pestaña y abren el menú de props en la sección Mods
console.log('radio entre los de jugabilidad:', await ev(`!!document.querySelector('#modMenu [data-mm="mod:radio"]')`));
await clic('[data-mm="tab:asset"]');
console.log('assets:', await ev(`[...document.querySelectorAll('#modMenu [data-mm^="props:"]')].map(e=>e.dataset.mm.slice(6)).join(',')`));
await clic('[data-mm="props:radio"]');
console.log('props abierto en Mods:', await ev(`JSON.stringify({ ui: UI.abierto, cat: document.querySelector('#cats .cat.sel') && document.querySelector('#cats .cat.sel').textContent, items: [...document.querySelectorAll('#grilla [data-mod]')].map(e=>e.dataset.mod), marca: !!document.querySelector('#grilla .marca') })`));
await ev(`cerrarPaneles(); modMenuAbrir(); MODM.tab = 'juego'; modMenuLista(); 1`); await espera(300);
await p.screenshot({ path: D + 'v2_menu_activos.png' });
// buscador
if (!celu) { await p.fill('#mmQ', 'grav'); await espera(300); console.log('buscar "grav":', await ev(`[...document.querySelectorAll('#modMenu .mmCat b')].map(e=>e.textContent).join(', ')`), '· foco sigue', await ev(`document.activeElement && document.activeElement.id`)); await p.fill('#mmQ', ''); await espera(300); }
// se guardan para la próxima partida
console.log('guardado:', await ev(`JSON.stringify({mods: PREFS.mods, fuerza: PREFS.modFuerza})`));
await ev(`modMenuCerrar(); JUG.tercera = true; JUG.yaw = 0; JUG.pitch = 0.15`); await espera(1500);
console.log('aura de goku: partículas doradas', await ev(`PART.l.filter(q => q.tipo === 'fuego' && q.col[2] < 0.4).length`));
await p.screenshot({ path: D + 'v3_aura.png' });
// súper salto con polvo y vista que se abre al correr rápido
await ev(`JUG.tercera = false; JUG.yaw = 0; ENT.teclas.add('KeyW'); ENT.teclas.add('ShiftLeft')`); await espera(600);
for (let i = 0; i < 12; i++) { await ev(`JUG.vel.z = Math.max(JUG.vel.z, 13); 1`); await espera(250); }
console.log('corriendo con veloz: fov', await ev(`CAM.fov.toFixed(1)`), 'vel', await ev(`Math.hypot(JUG.vel.x, JUG.vel.z).toFixed(1)`));
await ev(`ENT.teclas.delete('KeyW'); ENT.teclas.delete('ShiftLeft')`); await espera(1800); console.log('quieto: fov', await ev(`CAM.fov.toFixed(1)`));
await clic('.modmBt').catch(() => {}); if (!(await ev('MODM.abierto'))) await ev('modMenuAbrir()');
await clic('[data-mm="mod:salto"]'); await espera(400); await ev(`modMenuCerrar(); PART.l.length = 0; ENT.teclas.add('Space')`); await espera(250); await ev(`ENT.teclas.delete('Space')`); await espera(150);
console.log('súper salto: polvo', await ev(`PART.l.filter(q => q.tipo === 'humo').length`), '· vel.y', await ev(`JUG.vel.y.toFixed(1)`));
// modo dios: el golpe rebota
await ev('modMenuAbrir()'); await espera(200); await clic('[data-mm="mod:dios"]'); await ev(`modMenuCerrar(); PART.l.length = 0; danarJugador(30, null)`); await espera(100);
console.log('dios: vida', await ev(`JUG.vida`), '· chispas del escudo', await ev(`PART.l.filter(q => q.col[2] > 0.9).length`));
// apagar todos
await ev('modMenuAbrir()'); await espera(200);
for (const id of ['luna', 'veloz', 'goku', 'volar', 'salto', 'dios']) await clic(`[data-mm="mod:${id}"]`);
console.log('todo apagado: gravedad', await ev(`MUNDO.gravedad`), 'vel', await ev(`JUG.vel_max.toFixed(2)`), 'skinMod', await ev(`String(JUG.skinMod)`), 'NAT', await ev(`NAT.mods.size`), 'botón', JSON.stringify(await ev(`MODM.boton.querySelector('.mmN').textContent`)));
console.log('errores:', err.filter((e) => !/WebSocket|mqtt|Failed to load resource/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
await b.close();
