// maquinitas: el gabinete (Arcade) abre la biblioteca, los juegos incluidos se juegan en el medio con el mundo atrás, el HUD
// se va y en el celular aparecen la palanca, la cruceta y los botones, que le llegan al juego como teclas de PC (el
// puente de adentro devuelve un eco); el juego está aislado (sin mismo origen: no ve la página ni el almacenamiento) y
// tiene un localStorage que no falla; importar un HTML lo guarda en "Mis juegos"; la pantalla del gabinete muestra la
// tapa; en la sala, el aviso de qué juego tiene un gabinete y el HTML de a pedazos (armado igual del otro lado); sin errores.
// uso: node maquinitas.mjs HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(HTML, true);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); DIA.hora = 12; DIA.aplicada = -1; 1`);
await p.waitForTimeout(2500);
// un gabinete adelante, mirándolo
await ev(`(() => { const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), piso = pisoBajo(v3(JUG.pos.x, JUG.pos.y + 2, JUG.pos.z), 10);
  const o = window.__a = crearObjeto('Arcade', v3(JUG.pos.x + f.x * 1.6, piso, JUG.pos.z + f.z * 1.6), Quat.axis(0, 1, 0, JUG.yaw + Math.PI)); for (let i = 0; i < 60; i++) physStep(1 / 60);
  JUG.pitch = 0.3; return 1; })()`);
await p.waitForTimeout(500);
ok('mirando el gabinete dice "E: Jugar"', await ev(`$('usarTxt').textContent`) === 'E: ' + (await ev(`T('maq.jugar')`)), await ev(`$('usarTxt').textContent`));
await ev(`usar(); 1`); await p.waitForTimeout(400);
const pan = await ev(`({ ui: UI.abierto, n: document.querySelectorAll('#maqPan .mqIt').length, vis: !$('maqPan').classList.contains('oc') })`);
ok('usar el gabinete abre la biblioteca con los 3 juegos incluidos', pan.ui === 'maq' && pan.vis && pan.n === 3, pan);
await p.screenshot({ path: D + 'maq_biblioteca.png' });
await ev(`document.querySelector('#maqPan [data-mq="jugar:rb:serpiente"]').click(); 1`); await p.waitForTimeout(1200);
const vis = await ev(`(() => { const f = document.querySelector('#maqVista iframe'), r = f.getBoundingClientRect(), cv = $('cv').getBoundingClientRect();
  return { ui: UI.abierto, sandbox: f.getAttribute('sandbox'), puente: (f.srcdoc || '').includes('rbMaq'), maqOn: document.body.classList.contains('maqOn'), hud: getComputedStyle($('hud')).visibility,
    area: +(r.width * r.height / (innerWidth * innerHeight)).toFixed(2), centro: [+((r.left + r.width / 2) / innerWidth).toFixed(2)], cv: cv.width > 0,
    ctrl: ['.mqIzq', '.mqDer', '.mqMed'].map((s) => getComputedStyle(document.querySelector('#maqVista ' + s)).display), gab: window.__a.maq && window.__a.maq.g }; })()`);
ok('elegir "Serpiente" lo pone en el gabinete y lo abre en el medio (el mundo se ve alrededor: el juego ocupa < 60 % de la pantalla)', vis.ui === 'maqv' && vis.gab === 'rb:serpiente' && vis.area > 0.2 && vis.area < 0.6 && Math.abs(vis.centro[0] - 0.5) < 0.02, vis);
ok('aislado: sandbox sin mismo origen, con el puente de teclas', vis.sandbox === 'allow-scripts allow-pointer-lock' && vis.puente, vis.sandbox);
ok('el HUD de siempre se va y aparecen la palanca, la cruceta, A B X Y, Select y Start', vis.maqOn && vis.hud === 'hidden' && vis.ctrl.every((x) => x !== 'none'), [vis.hud, vis.ctrl]);
await p.screenshot({ path: D + 'maq_jugando_celu.png' });
// los botones de verdad (toques) y la palanca (arrastrar a la derecha): el juego recibe las teclas de PC
const pos = async (sel) => { const r = await p.evaluate((s) => { const x = document.querySelector(s).getBoundingClientRect(); return [x.left + x.width / 2, x.top + x.height / 2, x.width]; }, sel); return r; };
const [ax, ay] = await pos('#maqVista .bA'); await p.touchscreen.tap(ax, ay); await p.waitForTimeout(300);
const [cx, cy] = await pos('#maqVista .cA'); await p.touchscreen.tap(cx, cy); await p.waitForTimeout(300);
const [jx, jy, jw] = await pos('#maqVista .mqPalanca'); await p.mouse.move(jx, jy); await p.mouse.down(); await p.mouse.move(jx + jw * 0.4, jy, { steps: 4 }); await p.waitForTimeout(250); await p.mouse.up(); await p.waitForTimeout(300);
const eco = await ev(`MAQ.eco.slice()`);
ok('A, la cruceta y la palanca llegan al juego como Espacio, Flecha arriba y Flecha derecha (y se sueltan)', ['keydown: ', 'keyup: ', 'keydown:ArrowUp', 'keyup:ArrowUp', 'keydown:ArrowRight', 'keyup:ArrowRight'].every((k) => eco.includes(k)), eco);
// un juego importado que cuenta lo que ve: ¿llegan las teclas?, ¿anda localStorage?, ¿puede tocar la página de afuera?
const PRUEBA = `<!doctype html><html><head><title>t</title></head><body><script>
var ls; try { localStorage.setItem('a', '1'); ls = localStorage.getItem('a'); } catch (e) { ls = 'falla'; }
var afuera; try { afuera = parent.document.title ? 'abierto' : 'abierto'; } catch (e) { afuera = 'aislado'; }
var guardado; try { guardado = parent.localStorage.length >= 0 ? 'abierto' : ''; } catch (e) { guardado = 'aislado'; }
addEventListener('keydown', function (e) { parent.postMessage({ rbPrueba: e.key + '/' + e.keyCode, ls: ls, afuera: afuera, guardado: guardado }, '*'); });
<\/script></body></html>`;
const imp = await ev(`(async () => { const j = await maqImportarTexto('Prueba.html', ${JSON.stringify(PRUEBA)}, 'wasd'); const mios = await maqMios(); MAQ.tab = 'mios'; maqVistaCerrar(); MAQ.obj = window.__a; maqPanelAbrir(); await new Promise((ok) => setTimeout(ok, 300));
  return { id: j && j.id, ctrl: j && j.ctrl, enMios: mios.some((x) => x.id === j.id), lista: [...document.querySelectorAll('#maqPan .mqIt b')].map((x) => x.textContent) }; })()`);
ok('importar un HTML lo guarda en "Mis juegos" (en el navegador) con sus controles', imp.enMios && imp.ctrl === 'wasd' && imp.lista.includes('Prueba'), imp);
await ev(`window.__msg = []; addEventListener('message', (e) => { if (e.data && e.data.rbPrueba) window.__msg.push(e.data); }); document.querySelector('#maqPan [data-mq="jugar:${imp.id}"]').click(); 1`);
await p.waitForTimeout(1200);
const [xx, xy] = await pos('#maqVista .cD'); await p.touchscreen.tap(xx, xy); await p.waitForTimeout(400);
const m = await ev(`window.__msg[0] || null`);
ok('con WASD la cruceta derecha llega como "d" (keyCode 68); localStorage anda adentro; no puede tocar la página ni el almacenamiento de afuera', m && m.rbPrueba === 'd/68' && m.ls === '1' && m.afuera === 'aislado' && m.guardado === 'aislado', m);
// la pantalla del gabinete: la tapa del juego que tiene
await ev(`maqVistaCerrar(); window.__a.maq = { g: 'rb:meteoros', n: 'Meteoros', c: 'flechas', de: '' }; 1`); await p.waitForTimeout(600);
const tapa = await ev(`(() => { const t = MAQ.tapas.get('rb:meteoros'); return { tapa: !!t, tex: !!(t && R.tex[t.k]), mat: t && t.mat }; })()`);
ok('la pantalla del gabinete muestra la tapa del juego que tiene', tapa.tapa && tapa.tex, tapa);
await ev(`JUG.pitch = 0.15; 1`); await p.waitForTimeout(400); await p.screenshot({ path: D + 'maq_gabinete.png' });
// en la sala (simulado): otro jugador pone un juego en mi gabinete y me pasa el HTML de a pedazos
const sala = await ev(`(async () => {
  maqRed({ k: 'maq', o: claveObj(window.__a), g: '${imp.id}', n: 'Prueba', c: 'wasd', i: 'otro' });
  const j = (await maqMios()).find((x) => x.id === '${imp.id}'), relleno = Array.from({ length: 30000 }, () => Math.random().toString(36).slice(2, 6)).join(''), { P, z } = await maqPedazos({ ...j, html: j.html + '<!--' + relleno + '-->' });
  MAQ.sala.delete(j.id); for (let x = P.length - 1; x >= 0; x--) await maqRed({ k: 'maqd', g: j.id, x, n: P.length, z, d: P[x], i: 'otro' });
  const llego = MAQ.sala.get(j.id);
  return { gab: window.__a.maq, mundo: maqAlMundo(window.__a), pedazos: P.length, comprimido: z, igual: !!llego && llego.html === j.html + '<!--' + relleno + '-->', ctrl: llego && llego.ctrl }; })()`);
ok('en la sala: el aviso pone el juego en el gabinete (y va en el estado del mundo para los que entran después)', sala.gab && sala.gab.g === imp.id && sala.gab.de === 'otro' && Array.isArray(sala.mundo) && sala.mundo[0] === imp.id, { gab: sala.gab, mundo: sala.mundo });
ok('el HTML llega de a pedazos (comprimido, en cualquier orden) y queda igual', sala.igual && sala.pedazos >= 3 && sala.ctrl === 'wasd', { pedazos: sala.pedazos, z: sala.comprimido, igual: sala.igual });
await ev(`maqVistaCerrar(); cerrarPaneles(); 1`);
const fin = await ev(`({ ui: UI.abierto, maqOn: document.body.classList.contains('maqOn'), ifr: !!document.querySelector('#maqVista iframe') })`);
ok('al salir vuelve todo (sin juego corriendo, HUD de nuevo)', !fin.ui && !fin.maqOn && !fin.ifr, fin);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::/.test(e)).slice(0, 5));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
