// dos jugadores en la misma sala con un broker local: se ven, ven lo que crea el otro, lo agarran y lo mueven
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import http from 'http';
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad';   // carpeta con mc/broker (aedes + ws)
const req = createRequire(S + '/mc/broker/package.json');
const [,, html, pref] = process.argv;
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' });
wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8897, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
const abrir = async (n) => { const p = await b.newPage({ viewport: { width: 640, height: 360 } }); p.on('pageerror', (e) => errs.push(n + ': ' + e.message)); await p.goto('file://' + html + '?test&gfx=' + (process.env.GFX || 'patata') + '&broker=' + encodeURIComponent('ws://127.0.0.1:8897/mqtt')); await p.waitForFunction(() => window.__listo, null, { timeout: 120000 }); return p; };
const ev = (p, c) => p.evaluate((c) => window.__ev(c), c);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const RR = []; const ok = (n, c, d) => { RR.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(d)); };
const A = await abrir('A'); await ev(A, "PREFS.nombre='Ana'; PREFS.bienvenida = true; crearServidor({ n: 'Sala de Ana', pw: '', m: 'FlatGrass' }); 1");
await espera(3000);
const B = await abrir('B'); await ev(B, "PREFS.nombre='Beto'; PREFS.bienvenida = true; inicioMostrar(false); conectarMultijugador(); 1"); await espera(4000);
await ev(B, "const e = listaSalas().find((x) => x.S.n === 'Sala de Ana'); entrarSala(e.S); 1"); await espera(4000);
let bb = JSON.parse(await ev(B, "JSON.stringify({rem: [...RED.remotos.values()].map(r=>r.nombre), du: SALA && SALA.du, anf: soyAnfitrion()})"));
const aId = JSON.parse(await ev(A, "JSON.stringify(RED.ID)"));
ok('Beto entra a la sala de Ana y sabe que ella es la anfitriona', bb.rem.includes('Ana') && bb.du === aId && bb.anf === false, bb);
await ev(A, "DIA.hora = 0; DIA.ciclo = false; SALA.pvp = 1; SALA.mp = 5; HOST.ds = true; hostPublicar(); 1"); await espera(1200);
bb = JSON.parse(await ev(B, "JSON.stringify({hora: DIA.hora, pvp: SALA.pvp, mp: SALA.mp, ds: HOST.ds, noche: R.noche})"));
ok('la hora y las reglas del anfitrión llegan a Beto (noche, PvP, tope 5, spawn desactivado)', bb.hora === 0 && bb.pvp === 1 && bb.mp === 5 && bb.ds === true && bb.noche > 0.9, bb);
const sp = JSON.parse(await ev(B, "JSON.stringify(!!spawnDelante('Crate'))"));
ok('con el spawn desactivado Beto no puede crear cosas', sp === false, sp);
const spA = JSON.parse(await ev(A, "JSON.stringify(!!spawnDelante('Crate'))"));
ok('la anfitriona sí puede', spA === true, spA);
// Beto no puede cambiar la hora de todos (no es anfitrión): su mensaje se ignora
await ev(B, "publicar('cfg', { h: 12, c: 0, pvp: 0, nb: 1, mp: 1000, mv: 40, ds: 0 }, true); 1"); await espera(1000);
const ha = JSON.parse(await ev(A, "JSON.stringify(DIA.hora)"));
ok('un mensaje de configuración de alguien que no es anfitrión no cambia nada', ha === 0, ha);
await ev(A, "hostPublicar(); 1"); await espera(800);
// echar a Beto
const bId = JSON.parse(await ev(B, "JSON.stringify(RED.ID)"));
await ev(A, `publicar('a', { k: 'kick', to: '${bId}' }); 1`); await espera(1500);
bb = JSON.parse(await ev(B, "JSON.stringify({est: JUEGO.estado, sala: !!SALA})"));
ok('la anfitriona echa a Beto y vuelve al menú', bb.est === "principal" && bb.sala === false, bb);
console.log(errs.join('\n')); console.log(`\n${RR.filter(Boolean).length}/${RR.length}`);
await b2(); async function b2() { await (await import('process')).default.exit(0); }
