// menús: cada menú grande tiene su X (y cierra); tocar afuera cierra y se sigue jugando (el chat sin mandar nada); tocar
// adentro no cierra; poner un prop deja el menú abierto y dice qué se puso; sin errores.
// uso: node menus_x.mjs HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(HTML, true);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500); await p.touchscreen.tap(5, 300); await p.waitForTimeout(300);
const M = { spawn: 'abrirSpawn()', pausa: 'abrirPausa()', emotes: 'abrirEmotes()', memes: 'memePanAbrir()', maq: 'maqPanelAbrir()' };
const xs = {}, fuera = {}, dentro = {};
for (const [k, f] of Object.entries(M)) {
  await ev(`cerrarPaneles(); ${f}; 1`); await p.waitForTimeout(250);
  const x = await ev(`(() => { const p = panelAbierto(), c = p && cajaDe(p), x = c && c.querySelector('.xCerrar, .mmX, .mqX'); if (!x) return null; const r = x.getBoundingClientRect(), rc = c.getBoundingClientRect(); return { ui: UI.abierto, r: [r.left + r.width / 2, r.top + r.height / 2, r.width], caja: [rc.left, rc.top, rc.right, rc.bottom] }; })()`);
  xs[k] = !!x; if (k === 'spawn') await p.screenshot({ path: D + 'menu_spawn_x.png' });
  // tocar adentro (el medio de la caja, en algo que no hace nada) no cierra
  if (x) { await p.touchscreen.tap(x.caja[0] + 14, x.caja[1] + 10); await p.waitForTimeout(150); dentro[k] = await ev(`UI.abierto`) === x.ui; }
  // la X cierra
  if (x) { await p.touchscreen.tap(x.r[0], x.r[1]); await p.waitForTimeout(200); xs[k] = (await ev(`UI.abierto`)) === null; }
  // tocar afuera cierra
  await ev(`cerrarPaneles(); ${f}; 1`); await p.waitForTimeout(200);
  const c = await ev(`(() => { const r = cajaDe(panelAbierto()).getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()`);
  const px = c[0] > 30 ? c[0] / 2 : (c[2] + innerWidthFix()) / 2;
  function innerWidthFix() { return 873; }
  await p.touchscreen.tap(px, Math.min(380, c[3] + 4 < 390 ? c[3] + 4 : 195)); await p.waitForTimeout(200);
  fuera[k] = (await ev(`UI.abierto`)) === null;
}
ok('cada menú grande tiene una X que lo cierra', Object.values(xs).every(Boolean), xs);
ok('tocar adentro no lo cierra', Object.values(dentro).every(Boolean), dentro);
ok('tocar afuera lo cierra (y se sigue jugando)', Object.values(fuera).every(Boolean) && await ev(`JUEGO.estado`) === 'juego', fuera);
// chat: tocar afuera lo cierra sin mandar
await ev(`abrirChat(); $('chatIn').value = 'hola'; window.__mand = 0; const f0 = chatEnviar; chatEnviar = function () { window.__mand++; return f0.apply(this, arguments); }; 1`); await p.waitForTimeout(200);
await p.touchscreen.tap(430, 200); await p.waitForTimeout(200);
const ch = await ev(`({ ui: UI.abierto, oc: $('chatIn').classList.contains('oc'), mand: window.__mand })`);
ok('el chat se cierra tocando afuera, sin mandar', ch.ui === null && ch.oc && ch.mand === 0, ch);
// poner props deja el menú abierto
await ev(`abrirSpawn(); UI.tab = DATA.menu.findIndex((c) => c.n === 'Props'); UI.sub = 1; spawnDibujar(); 1`); await p.waitForTimeout(200);
const sp = await ev(`(() => { const n0 = OBJS.length, nom = DATA.menu[UI.tab].sub[1].it[0]; const it = typeof nom === 'string' ? nom : nom.n; spawnElegir('Props', it); spawnElegir('Props', it); return { ui: UI.abierto, puso: OBJS.length - n0, txt: $('spPuso').textContent }; })()`);
ok('poner dos props deja el menú abierto y dice qué y cuántos', sp.ui === 'spawn' && sp.puso === 2 && /\(2\)/.test(sp.txt), sp);
await p.screenshot({ path: D + 'menu_spawn_puso.png' });
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.slice(0, 5));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
