// dos jugadores en la misma sala con un broker local: se ven, ven lo que crea el otro, lo agarran y lo mueven
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import http from 'http';
const S = process.env.SCRATCH || '.';
const req = createRequire(S + '/mc/broker/package.json');
const [,, html, pref] = process.argv;
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' });
wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8897, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
const abrir = async (n) => { const p = await b.newPage({ viewport: { width: 640, height: 360 } }); p.on('pageerror', (e) => errs.push(n + ': ' + e.message)); await p.goto('file://' + html + '?test&broker=' + encodeURIComponent('ws://127.0.0.1:8897/mqtt')); await p.waitForFunction(() => window.__listo, null, { timeout: 120000 }); return p; };
const ev = (p, c) => p.evaluate((c) => window.__ev(c), c);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(d)); };
const A = await abrir('A'); await ev(A, "PREFS.nombre='Ana'; PREFS.modo='libre'; PREFS.skin='Soldier'; empezarPartida('FlatGrass'); 1");
const B = await abrir('B'); await ev(B, "PREFS.nombre='Beto'; PREFS.modo='libre'; PREFS.skin='Jean'; PREFS.gorro='HatParty'; empezarPartida('FlatGrass'); 1");
await espera(4000);
let a = await ev(A, "JSON.stringify({on:RED.on, rem:[...RED.remotos.values()].map(r=>r.nombre+':'+r.skin)})"), bb = await ev(B, "JSON.stringify({on:RED.on, rem:[...RED.remotos.values()].map(r=>r.nombre+':'+r.skin)})");
ok('los dos conectados y se ven', JSON.parse(a).rem.includes('Beto:Jean') && JSON.parse(bb).rem.includes('Ana:Soldier'), { a, bb });
await ev(A, "window.__c = crearObjeto('Crate', v3(JUG.pos.x+2, JUG.pos.y, JUG.pos.z+3), new Quat()); redObjeto(); 1");
await espera(2500);
bb = JSON.parse(await ev(B, "JSON.stringify([...RED.objs.values()].map(o=>[o.nombre,o.key,o.b.pos.x.toFixed(2),o.b.pos.y.toFixed(2)]))"));
const pa = JSON.parse(await ev(A, "JSON.stringify([window.__c.b.pos.x, window.__c.b.pos.y])"));
ok('Beto ve la caja de Ana en el mismo lugar', bb.length === 1 && bb[0][0] === 'Crate' && Math.abs(bb[0][2] - pa[0]) < 0.05, { bb, pa });
// Ana tira la caja para arriba: Beto la ve moverse
await ev(A, "window.__c.b.wake(); window.__c.b.vel.set(0,9,4); 1"); await espera(500);
const yb = JSON.parse(await ev(B, "JSON.stringify([...RED.objs.values()][0].b.pos.y)")), ya = JSON.parse(await ev(A, "JSON.stringify(window.__c.b.pos.y)"));
ok('el movimiento llega (en el aire en los dos)', yb > pa[1] + 0.5 && Math.abs(yb - ya) < 1.2, { ya, yb });
await espera(3000);
// Beto la reclama (como al agarrarla) y la mueve
await ev(B, "const o=[...RED.objs.values()][0]; redReclamar(o); o.b.frozen=false; o.b.wake(); o.b.vel.set(0,7,0); 1"); await espera(700);
const auth = JSON.parse(await ev(A, "JSON.stringify([window.__c.auth, RED.ID, window.__c.b.frozen])")), yA2 = JSON.parse(await ev(A, "JSON.stringify(window.__c.b.pos.y)"));
const idB = JSON.parse(await ev(B, "JSON.stringify(RED.ID)"));
ok('Ana ve que ahora la simula Beto y la caja sube en la pantalla de Ana', auth[0] === idB && auth[2] === true && yA2 > pa[1] + 0.5, { auth, idB, yA2 });
// chat y daño
await ev(B, "chatEnviar('hola ana'); 1"); await espera(600);
const chatA = await ev(A, "JSON.stringify(CHAT.map(c=>c.t))");
ok('el chat llega', chatA.includes('Beto: hola ana'), chatA);
await ev(B, "const r=[...RED.remotos.values()][0]; danarPersona(r.P, 30, r.P.pos, v3(0,0,1)); 1"); await espera(600);
const vidaA = JSON.parse(await ev(A, "JSON.stringify(JUG.vida)"));
ok('el daño llega a Ana', vidaA === 70, vidaA);
await A.screenshot({ path: pref + '_A.png' }); await B.screenshot({ path: pref + '_B.png' });
// Beto se va: Ana deja de verlo
await ev(B, "irMenuPrincipal(); 1"); await espera(1500);
a = JSON.parse(await ev(A, "JSON.stringify({rem:RED.remotos.size})"));
ok('al irse Beto, Ana deja de verlo', a.rem === 0, a);
console.log(errs.join('\n')); console.log(R.filter(Boolean).length + '/' + R.length);
await b.close(); srv.close(); process.exit(0);
