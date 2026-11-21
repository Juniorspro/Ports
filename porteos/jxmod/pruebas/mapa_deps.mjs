// un mapa del Workshop al que le falta contenido pesado (las texturas de «The Showgrounds - SMG4» vienen en otro addon de
// 731 MB y no se bajaban solas por el tope): al entrar aparece el cartel con cuánto pesa, «Bajar» lo instala, el mapa se
// vuelve a armar y se sigue jugando; al volver a entrar ya no pregunta. Para no bajar 2 GB, un mapa chico (SMG4 - Old Home)
// con un «requerido» chico puesto a mano (Showgrounds Dependencies #2, 55 MB).
// uso: node mapa_deps.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, D = '/tmp/claude-0/mapa_deps'] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
(await import('fs')).mkdirSync(D, { recursive: true });
const MAPA_ID = '3245482984', DEP = '2992370816';
const { b, p, err, ev } = await abrir(HTML, true);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2000);
const mapa = await ev(`(async () => { const A = await gmInstalar('${MAPA_ID}', { nombre: '${MAPA_ID}' }); if (A && A.listo) await A.listo;
  PREFS.gmod['${MAPA_ID}'].req = ['${DEP}']; return [...GBSP.mapas].filter(([k, x]) => x.id === '${MAPA_ID}').map(([k]) => k)[0]; })()`);
ok('el mapa chico se instala', !!mapa, mapa);
// (lo que dicen los avisos de abajo, para ver el progreso y el «Listo»)
await ev(`window.__avisos = []; new MutationObserver(() => window.__avisos.push($('aviso').textContent)).observe($('aviso'), { childList: true, characterData: true, subtree: true }); 1`);
await ev(`empezarPartida(${JSON.stringify(mapa)}); 1`);
await p.waitForFunction((k) => window.__ev(`MUNDO.nombre === ${JSON.stringify(k)} && JUEGO.estado === 'juego'`), mapa, { timeout: 120000 });
const esc0 = await ev(`(window.__esc0 = DATA.esc[${JSON.stringify(mapa)}], 1)`);
const vio = await p.waitForFunction(() => { const d = document.getElementById('cfDlg'); return d && d.className !== 'oc' && d.textContent; }, null, { timeout: 30000 }).then((h) => h.jsonValue(), () => null);
await p.waitForTimeout(700); await p.screenshot({ path: D + '/1_cartel.png' });
ok('al entrar aparece el cartel con lo que falta y cuánto pesa', !!vio && /1 (paquete|separate pack)/.test(vio) && /\(5[5-9] MB\)/.test(vio) && /(Bajar|Download) \(5[5-9] MB\)/.test(vio), vio);
const t0 = Date.now();
await p.click('#cfDlg [data-cf="si"]');
let fin = false, falla = null;
for (let i = 0; i < 480 && !fin; i++) { await p.waitForTimeout(1000); try { fin = await ev(`!!(GMOD.addons.has('${DEP}') && MUNDO.nombre === ${JSON.stringify(mapa)} && JUEGO.estado === 'juego' && DATA.esc[${JSON.stringify(mapa)}] && DATA.esc[${JSON.stringify(mapa)}] !== window.__esc0)`); } catch (e) { falla = e.message.slice(0, 200); } }
if (falla) console.log('(al esperar:', falla, ')');
const seg = (Date.now() - t0) / 1000; await p.waitForTimeout(1500);
await p.screenshot({ path: D + '/2_rearmado.png' });
const av = await ev(`window.__avisos.filter((x, i, a) => x && x !== a[i - 1])`);
ok(`«Bajar» lo instala, avisa el progreso y el mapa se vuelve a armar (${seg.toFixed(0)} s)`, fin && av.some((x) => /(Bajando lo que le falta al mapa|Downloading what the map is missing)/.test(x)) && av.some((x) => /(Listo: el mapa se vuelve a armar|Done: rebuilding the map)/.test(x)), { fin, avisos: av.slice(0, 4).concat(av.slice(-3)) });
ok('queda guardado entre los instalados', await ev(`!!(PREFS.gmod['${DEP}'])`));
const estado = await ev(`({ vivo: JUG.vivo, suelo: JUG.suelo, ui: UI.abierto || null })`);
ok('se sigue jugando: vivo y parado en el piso', estado.vivo && estado.suelo && !estado.ui, estado);
// (otra vez al mismo mapa: ya no falta nada, no pregunta)
await ev(`empezarPartida('FlatGrass'); 1`); await p.waitForTimeout(1500); await ev(`empezarPartida(${JSON.stringify(mapa)}); 1`);
await p.waitForFunction((k) => window.__ev(`MUNDO.nombre === ${JSON.stringify(k)} && JUEGO.estado === 'juego'`), mapa, { timeout: 120000 });
await p.waitForTimeout(6000);
ok('al volver a entrar no pregunta de nuevo', await p.evaluate(() => { const d = document.getElementById('cfDlg'); return !d || d.className === 'oc'; }));
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|409|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
