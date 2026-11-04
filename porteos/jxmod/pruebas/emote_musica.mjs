// emotes con música (idea de Discord y diseño del dueño: ⋯ en el emote → Música → buscar en YouTube → recortar → suena
// con el emote). Ana y Beto en una sala (broker local); YouTube de prueba: la búsqueda responde un video fijo.
//  1. cada tarjeta del panel de emotes tiene ⋯; tocarlo muestra «Música» y abre el buscador
//  2. buscar muestra resultados; uno con algo que no va no se busca (el filtro de la radio)
//  3. elegir abre el editor con el video y las marcas Desde/Hasta; la parte no pasa de 60 s
//  4. Guardar lo deja anotado y la tarjeta muestra la nota musical
//  5. al hacer el emote suena esa parte (reproductor con start/end), en bucle; al terminar el emote, se apaga
//  6. Beto, a 5 m, la oye (el reproductor de la música de Ana, con volumen); a 60 m no
//  7. sin errores
// uso: BROKER_DIR=carpeta-con-mc/broker node emote_musica.mjs URL_HTML [CARPETA_FOTOS]
import { createRequire } from 'module'; import http from 'http';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad', req = createRequire(S + '/mc/broker/package.json');
const [, , html, D = '/tmp/claude-0/emu'] = process.argv;
import fs from 'fs'; fs.mkdirSync(D, { recursive: true });
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8895, '127.0.0.1', r));
const errs = [], navs = [];
const VID = 'dQw4w9WgXcQ';
const abrir = async (n) => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  navs.push(b);
  const p = await (await b.newContext({ viewport: { width: 900, height: 500 } })).newPage();
  p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|mqtt|Failed to load|ERR_|CORS|net::|youtube|ytimg|googlevideo/i.test(m.text())) errs.push(n + ': ' + m.text().slice(0, 160)); });
  // (YouTube de prueba: la búsqueda de la tienda responde un video fijo y la revisión de la IA no saca nada)
  await p.route(/\/api\/yt\?q=/, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ items: [{ id: VID, t: 'Canción de prueba', c: 'Canal', d: '3:33' }] }) }));
  await p.goto(html + '?test&broker=ws://127.0.0.1:8895/mqtt'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  await p.evaluate(() => window.__ev(`(() => { ytIA = async () => new Set(); cuentaPedir = () => true; cuentaFaltaPara = () => false; cuPedirAlAbrir.hecho = true; return 1; })()`));
  return p;
};
const ev = (P, s) => P.evaluate((x) => window.__ev(x), s), J = async (P, s) => JSON.parse(await ev(P, `(async () => JSON.stringify(await (${s})))()`));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const hasta = async (P, cond, seg) => { for (let i = 0; i < seg * 4; i++) { if (await J(P, cond).catch(() => false)) return true; await espera(250); } return false; };
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const prep = (P, n) => ev(P, `PREFS.nombre='${n}'; PREFS.lang='es'; PREFS.bienvenida=true; PREFS.tutVisto=true; PREFS.gfx='patata'; GFX.auto=false; aplicarGfx(); audioIniciar(); localStorage.removeItem('rb_emo_musica'); EMU.m = {}; 1`);
const A = await abrir('Ana'); await prep(A, 'Ana');
await ev(A, `(() => { conectarMultijugador(); crearServidor({ n: 'Baile', pw: '', m: 'FlatGrass' }); return 1; })()`);
await hasta(A, `JUEGO.estado === 'juego' && RED.on`, 90);
const sala = await J(A, `(() => { const s = Object.assign({}, SALA); delete s.clave; return s; })()`);
// 1. el panel de emotes, ⋯ y Música
await ev(A, `(() => { abrirEmotes(); emoDibujar(); return 1; })()`); await espera(600);
const t1 = await J(A, `(() => { const c = [...document.querySelectorAll('#emoLista .emoIt')], con = c.filter((x) => x.querySelector('.emoOp')); return { tarjetas: c.length, conOp: con.length, primero: con[0] && con[0].dataset.emo }; })()`);
const EMOTE = await J(A, `(() => { const b = [...document.querySelectorAll('#emoLista .emoOp')].find((x) => !/^c:/.test(x.dataset.emop)) || document.querySelector('#emoLista .emoOp'); return b && b.dataset.emop; })()`);
await A.click(`#emoLista .emoOp[data-emop="${EMOTE}"]`); await espera(300);
const menu = await J(A, `(() => { const m = document.getElementById('emuMenu'); return m ? [...m.querySelectorAll('button')].map((b) => b.textContent.trim()) : null; })()`);
await A.click('#emuMenu [data-emu="mus"]'); await espera(400);
const pan = await J(A, `(() => { const p = document.getElementById('emuPan'); return { abierto: !!p && !p.classList.contains('oc'), titulo: p && p.querySelector('.emuEmo').textContent, ph: p && p.querySelector('.emuBus input').placeholder, emotesCerrado: $('emotes').classList.contains('oc') }; })()`);
ok('1. las tarjetas tienen ⋯; tocarlo muestra Música y abre el buscador', t1.tarjetas > 0 && t1.conOp === t1.tarjetas && menu && menu.length === 1 && /Música/.test(menu[0]) && pan.abierto, { t1, menu, pan, EMOTE });
// 2. buscar (y el filtro)
await A.fill('#emuPan .emuBus input', 'cancion para bailar'); await A.click('#emuPan [data-emu="buscar"]');
const res = await hasta(A, `document.querySelectorAll('#emuPan .emuRes .radioIt').length === 1`, 10);
await A.fill('#emuPan .emuBus input', 'porno'); await A.click('#emuPan [data-emu="buscar"]'); await espera(500);
const bloq = await J(A, `({ n: document.querySelectorAll('#emuPan .emuRes .radioIt').length, txt: document.querySelector('#emuPan .emuRes').textContent.trim().slice(0, 60) })`);
await A.fill('#emuPan .emuBus input', 'cancion para bailar'); await A.click('#emuPan [data-emu="buscar"]'); await hasta(A, `document.querySelectorAll('#emuPan .emuRes .radioIt').length === 1`, 10);
ok('2. buscar muestra los resultados; una búsqueda con algo que no va no se hace', res && bloq.n === 0, { res, bloq });
// 3. el editor
await A.click('#emuPan .emuRes .radioIt'); await espera(800);
const ed = await J(A, `(() => { const p = document.getElementById('emuPan'), f = p.querySelector('.emuVid iframe'); return { ed: !p.querySelector('.emuEd').classList.contains('oc'), src: f && f.src, a: p.querySelector('.emuA').value, b: p.querySelector('.emuB').value }; })()`);
// (marcar de 10 a 25 s, y probar que la parte no pasa de 60 s)
await ev(A, `(() => { const p = document.getElementById('emuPan'), Ai = p.querySelector('.emuA'), Bi = p.querySelector('.emuB'); Ai.max = Bi.max = '200'; Bi.value = '120'; Bi.dispatchEvent(new Event('input')); return 1; })()`);
const largo = await J(A, `({ a: EMU.ed.a, b: EMU.ed.b })`);
await ev(A, `(() => { const p = document.getElementById('emuPan'), Ai = p.querySelector('.emuA'), Bi = p.querySelector('.emuB'); Ai.value = '10'; Ai.dispatchEvent(new Event('input')); Bi.value = '25'; Bi.dispatchEvent(new Event('input')); return 1; })()`);
const marc = await J(A, `({ a: EMU.ed.a, b: EMU.ed.b, txt: document.querySelector('#emuPan .emuLargo').textContent, av: document.querySelector('#emuPan .emuAv').textContent, bv: document.querySelector('#emuPan .emuBv').textContent })`);
await A.screenshot({ path: D + '/editor.png' });
ok('3. elegir abre el editor con el video y las marcas; la parte no pasa de 60 s', ed.ed && /embed\/dQw4w9WgXcQ/.test(ed.src || '') && largo.b - largo.a <= 60 && marc.a === 10 && marc.b === 25 && /15/.test(marc.txt) && marc.av === '0:10' && marc.bv === '0:25', { ed, largo, marc });
// 4. guardar
await A.click('#emuPan [data-emu="guardar"]'); await espera(600);
const guard = await J(A, `(() => { const g = JSON.parse(localStorage.getItem('rb_emo_musica') || '{}')[${JSON.stringify(EMOTE)}]; const c = document.querySelector('#emoLista .emoIt[data-emo=${JSON.stringify(EMOTE)}]'); return { g, nota: !!(c && c.querySelector('.emoMusN')), panel: document.getElementById('emuPan').classList.contains('oc') }; })()`);
ok('4. Guardar lo deja anotado y la tarjeta muestra la nota musical', guard.g && guard.g.v === VID && guard.g.a === 10 && guard.g.b === 25 && guard.nota && guard.panel, guard);
// 5. el emote suena
await ev(A, `(() => { cerrarPaneles(); JUG.vel.set(0, 0, 0); emote(${JSON.stringify(EMOTE)}); return 1; })()`);
const suena = await hasta(A, `!!(EMU.ifr && EMU.src === 'yo' && /embed\\/${VID}/.test(EMU.ifr.src) && /start=10/.test(EMU.ifr.src) && /end=25/.test(EMU.ifr.src))`, 5);
const red = await J(A, `emuRed()`);
// (el bucle: el reproductor dice que llegó a 25 s → vuelve a 10)
await ev(A, `(() => { EMU.est = 1; EMU.cur = 24.95; EMU.curT = Date.now(); EMU.seekT = 0; return 1; })()`); await espera(500);
const bucle = await J(A, `({ cur: EMU.cur })`);
ok('5. al hacer el emote suena esa parte (start=10, end=25) y va en bucle', suena && JSON.stringify(red) === JSON.stringify([VID, 10, 25]) && bucle.cur === 10, { suena, red, bucle });
// 6. Beto la oye cerca, no lejos
const B = await abrir('Beto'); await prep(B, 'Beto');
await ev(B, `(() => { conectarMultijugador(); entrarSala(${JSON.stringify(sala)}, ''); return 1; })()`);
await hasta(B, `JUEGO.estado === 'juego' && RED.on && RED.remotos.size === 1`, 90);
const pa = await J(A, `[JUG.pos.x, JUG.pos.y, JUG.pos.z]`);
const reEmote = async () => { await ev(A, `(() => { JUG.vel.set(0, 0, 0); if (!JUG.cuerpo.emote) emote(${JSON.stringify(EMOTE)}); return 1; })()`); };
await reEmote();
await ev(B, `(() => { JUG.pos.set(${pa[0] + 5}, ${pa[1]}, ${pa[2]}); JUG.vel.set(0, 0, 0); return 1; })()`);
const cerca = await hasta(B, `!!(EMU.ifr && EMU.src && EMU.src !== 'yo' && EMU.vol > 0 && /start=10/.test(EMU.ifr.src))`, 20);
const vCerca = await J(B, `({ src: EMU.src, vol: EMU.vol })`);
await reEmote();
await ev(B, `(() => { JUG.noclip = true; JUG.pos.set(${pa[0] + 60}, ${pa[1] + 2}, ${pa[2]}); JUG.vel.set(0, 0, 0); return 1; })()`);
const lejos = await hasta(B, `!EMU.ifr`, 10);
ok('6. Beto a 5 m oye la música del emote de Ana; a 60 m no', cerca && lejos, { cerca, vCerca, lejos });
// (al terminar el emote se apaga)
await ev(A, `(() => { JUG.cuerpo.emote = null; return 1; })()`);
const apaga = await hasta(A, `!EMU.ifr`, 5);
ok('5b. al terminar el emote, se apaga', apaga, apaga);
ok('7. sin errores de JS', !errs.length, errs.slice(0, 5));
for (const b of navs) await b.close(); srv.close();
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
process.exit(0);
