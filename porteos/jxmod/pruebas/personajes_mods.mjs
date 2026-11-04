// personajes de mods: el detector separa los modelos de jugador del resto de los mods (catálogo e instalados); en
// Personajes → Mods salen los instalados (con buscador) y los del Workshop para instalar; jugando, la pausa tiene
// Personaje y el cambio es al momento (del juego y de mods).
// uso: node personajes_mods.mjs URL_HTML URL_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const G = process.argv[3], D = (process.argv[4] || '.') + '/';
const { b, p, err, ev } = await abrir(process.argv[2], false);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; 1`);
const det = await ev(`(async () => { const C = await gmCatalogo(); const pm = C.L.filter((x) => gmEsPM(x));
  const malos = ['M9K Assault Rifles', 'Wiremod', 'TDMCars - Ford', 'Nuke Pack 4', 'Portal Gun'].filter((t) => gmEsPM({ t }));
  const malos2 = ['Bentley PM Continental GT'].filter((t) => gmEsPM({ t })); const buenos = ['Iron Man [Playermodel/NPC]', 'Spider-Man Player Model', 'Zero Two. PM.', 'Metropolice Playermodels', 'Ryuk [PM]'].filter((t) => gmEsPM({ t }));
  return { total: C.L.length, pm: pm.length, top: pm.sort((a, b) => b.subs - a.subs).slice(0, 6).map((x) => x.t), malos: malos.concat(malos2), buenos }; })()`);
ok('el detector encuentra los modelos de jugador del catálogo y no confunde mods comunes', det.pm > 100 && !det.malos.length && det.buenos.length === 5, det);
await ev(`(async () => { const A = await gmInstalar('158326196', { nombre: 'Iron Man' }, new Uint8Array(await (await fetch('${G}/158326196.gma')).arrayBuffer())); await A.listo; return 1; })()`);
// menú principal: Personajes → Mods
const m = await ev(`(async () => { RBM.pjTab = 'mod'; inicioPanel('personajes'); await new Promise((r) => setTimeout(r, 2500));
  const celdas = () => [...document.querySelectorAll('.pjmListas .pjCelda')].map((c) => c.dataset.pjm);
  const todas = celdas(); const bus = document.querySelector('.pjmBus'); bus.value = 'patriot'; bus.dispatchEvent(new Event('input')); await new Promise((r) => setTimeout(r, 600));
  const fil = celdas().filter((x) => /^sel:/.test(x)); const c = document.querySelector('.pjmListas [data-pjm^="sel:"]'); if (c) c.click(); await new Promise((r) => setTimeout(r, 400));
  return { inst: todas.filter((x) => /^sel:/.test(x)).length, ws: todas.filter((x) => /^inst:/.test(x)).length, fil, skin: PREFS.skin, sel: !!document.querySelector('.pjmListas .pjCelda.sel') }; })()`);
await p.screenshot({ path: D + 'pj_menu_mods.png' });
// (desde la 2.7 también se pueden poner los muñecos/NPC con esqueleto de Valve: los 2 de jugador y los 2 de NPC de Iron Man)
ok('Personajes → Mods muestra los instalados (4 de Iron Man: 2 de jugador y 2 de NPC) y los del Workshop', m.inst === 4 && m.ws > 5, m);
ok('el buscador filtra (patriot → los 2 de patriot) y tocar lo pone', m.fil.length === 2 && m.fil.every((x) => /patriot/.test(x)) && /patriot/.test(m.skin) && m.sel, m);
// jugando: pausa → Personaje
await ev(`inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 60000 });
const j = await ev(`(async () => { const esp = (s) => new Promise((r) => setTimeout(r, s * 1000)); JUG.tercera = true; PJM.q = ''; abrirPausa(); document.getElementById('bPersonaje').click(); await esp(0.5);
  const vis = !document.getElementById('pjJuego').classList.contains('oc'), boton = document.getElementById('bPersonaje').textContent;
  document.querySelector('#pjJuego [data-pjj="mod"]').click(); await esp(1.5);
  const c = [...document.querySelectorAll('#pjJuego [data-pjm^="sel:"]')].find((x) => /mark7/.test(x.dataset.pjm)); if (c) c.click(); await esp(2.5);
  const r1 = JUG.cuerpo && JUG.cuerpo.gmpRuta || '';
  document.querySelector('#pjJuego [data-pjj="skin"]').click(); await esp(0.4); const s0 = DATA.chars.find((s) => s !== 'Hero') || DATA.chars[0]; const b2 = document.querySelector('#pjJuego [data-pjs="' + s0 + '"]'); if (b2) b2.click(); await esp(1.5);
  const r2 = JUG.cuerpo && JUG.cuerpo.skin; document.querySelector('#pjJuego [data-pjj="x"]').click(); await esp(0.3);
  return { vis, boton, r1, s0, r2, cerrado: document.getElementById('pjJuego').classList.contains('oc'), pausa: !document.getElementById('pausa').classList.contains('oc') }; })()`);
await p.screenshot({ path: D + 'pj_pausa.png' });
ok('la pausa tiene Personaje y abre el panel', j.vis && !!j.boton, j);
ok('jugando, elegir un modelo de mod lo pone al momento (mark7)', /mark7/.test(j.r1), j.r1);
ok('y uno del juego también', j.r2 === j.s0, { r2: j.r2, s0: j.s0 });
ok('la X vuelve a la pausa', j.cerrado && j.pausa, j);
// (el broker público de la red a veces no contesta desde la máquina de pruebas: no es un error del juego)
const e = err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket connection to 'wss:/i.test(x));
ok('sin errores de JS', !e.length, e.slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN ' + R.length + '/' + R.length : 'FALLAN ' + R.filter((x) => !x).length + '/' + R.length);
await b.close();
