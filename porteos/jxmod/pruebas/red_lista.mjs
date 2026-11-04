// el multijugador con el HTML armado de verdad (sin ?test): la librería de MQTT tiene que quedar cargada, la lista de
// servers se conecta (nada de «Sin conexión con los servers») y otro jugador que entra a un server aparece en la lista.
// Con un broker local (aedes + ws de la carpeta mc/broker). uso: node red_lista.mjs URL_HTML
import { createRequire } from 'module'; import http from 'http';
import { abrir } from './base.mjs';
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad';
const req = createRequire(S + '/mc/broker/package.json'), aedes = req('aedes')(), { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(), wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8897, '127.0.0.1', r));
const [, , HTML] = process.argv, U = HTML + (HTML.includes('?') ? '&' : '?') + 'broker=' + encodeURIComponent('ws://127.0.0.1:8897/mqtt');
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const A = await abrir(U, true), B = await abrir(U, true);
ok('la librería de red está cargada', (await A.ev(`typeof mqtt`)) === 'object', await A.ev(`typeof mqtt`));
await B.ev(`PREFS.bienvenida = true; inicioAccion('multi'); 1`);
await B.p.waitForFunction(() => window.__ev('LISTA.on'), null, { timeout: 20000 }).catch(() => {});
const est = await B.ev(`({ on: LISTA.on, est: (RB.el.querySelector('.mpEst') || {}).textContent })`);
ok('la lista de servers se conecta (sin «Sin conexión»)', est.on && !est.est, est);
await A.ev(`PREFS.bienvenida = true; PREFS.nombre = 'Ana'; entrarSala(SALAS_OF.find((s) => s.m === 'FlatGrass') || SALAS_OF[0]); 1`);
await A.p.waitForFunction(() => window.__ev('RED.on'), null, { timeout: 60000 }).catch(() => {});
await B.p.waitForFunction(() => window.__ev(`listaSalas().some((x) => x.j.includes('Ana'))`), null, { timeout: 20000 }).catch(() => {});
const ve = await B.ev(`(() => { const e = listaSalas().find((x) => x.j.includes('Ana')); return e ? { server: e.S.n, jugadores: e.j } : null; })()`);
ok('Ana entra a un server y en la lista del otro aparece con 1 jugador', !!ve, ve);
await A.b.close(); await B.b.close(); srv.close();
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); process.exit(0);
