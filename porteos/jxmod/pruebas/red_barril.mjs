// Barriles explosivos en multijugador: cada explosión se ve una sola vez en cada pantalla (antes, al explotar el barril de
// otro, la copia de ese barril también explotaba en la pantalla del que la recibía y mandaba su explosión de vuelta: el
// dueño veía dos). Dos jugadores (Ana y Beto) en una sala con un broker local; se cuentan las explosiones de cada uno.
//  1. Ana hace explotar su barril: una explosión en cada pantalla y el barril desaparece en las dos
//  2. Beto le dispara al barril de Ana (su copia): una explosión en cada pantalla y el barril desaparece en las dos
//  3. dos barriles de Ana a 2 m: el primero hace explotar al segundo; dos explosiones en cada pantalla (no tres ni cuatro)
//  4. un barril de Ana junto a uno de Beto: explota el de Ana y arrastra al de Beto; dos en cada pantalla
//  5. los dos le pegan al mismo barril en el mismo instante: una explosión en cada pantalla
//  6. sin errores de JS
// uso: node red_barril.mjs RUTA_HTML   (entorno: BROKER_DIR = carpeta con mc/broker)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import http from 'http';
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad';
const req = createRequire(S + '/mc/broker/package.json');
const [, , html] = process.argv;
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' });
wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8897, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const errs = [];
const url = /^https?:/.test(html) ? html : 'file://' + html;
const abrir = async (n) => { const p = await b.newPage({ viewport: { width: 640, height: 360 } }); await p.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' })); p.on('pageerror', (e) => errs.push(n + ': ' + e.message)); await p.goto(url + (url.includes('?') ? '&' : '?') + 'test&gfx=patata&broker=' + encodeURIComponent('ws://127.0.0.1:8897/mqtt')); await p.waitForFunction(() => window.__listo, null, { timeout: 120000 }); return p; };
const ev = (p, c) => p.evaluate((c) => window.__ev(c), c);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(d)); };
// (cuenta las explosiones: envuelve explosion() sin perder sus banderas, que se leen por el nombre global)
const contar = `(() => { if (!window.__e0) { window.__e0 = explosion; explosion = function (...a) { window.__nexp = (window.__nexp || 0) + 1; return window.__e0.apply(this, a); }; } window.__nexp = 0; return 1; })()`;
const A = await abrir('A'); await ev(A, "PREFS.nombre='Ana'; PREFS.evento=false; entrarSala(SALAS_OF.find((s) => s.m === 'FlatGrass')); 1");
const B = await abrir('B'); await ev(B, "PREFS.nombre='Beto'; PREFS.evento=false; entrarSala(SALAS_OF.find((s) => s.m === 'FlatGrass')); 1");
await espera(5000);
const conect = [await ev(A, 'RED.remotos.size'), await ev(B, 'RED.remotos.size')];
// (lejos de los jugadores, para que nadie se muera ni lo empuje: 25 m adelante de Ana)
const lugar = `(() => { const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); return v3(JUG.pos.x + f.x * 25, JUG.pos.y + 0.5, JUG.pos.z + f.z * 25); })()`;
// (Ana pone el suyo y Beto lo ubica en el mismo lugar; el lugar es el de Ana)
const lugarDeAna = await ev(A, `(() => { const p = ${lugar}; return [p.x, p.y, p.z]; })()`);
const ponerEn = async (P, dx) => ev(P, `(() => { const p = v3(${lugarDeAna[0]} + ${dx}, ${lugarDeAna[1]}, ${lugarDeAna[2]}); const o = crearObjeto('BarrilExplosivo', p, new Quat()); o.b.frozen = true; redObjeto(); return claveObj(o); })()`);
const hay = (P, k) => ev(P, `(() => { const o = buscarObjeto(${JSON.stringify(k)}); return !!(o && !o.borrado && OBJS.includes(o)); })()`);
const cuenta = async () => [await ev(A, 'window.__nexp'), await ev(B, 'window.__nexp')];
const reset = async () => { await ev(A, contar); await ev(B, contar); };
// ---- 1 ----
await reset(); let k1 = await ponerEn(A, 0); await espera(2500); const veB1 = await hay(B, k1);
await ev(A, `(() => { const o = buscarObjeto(${JSON.stringify(k1)}); danarObjeto(o, 999, o.b.pos, v3(0, 1, 0)); return 1; })()`); await espera(2500);
let c = await cuenta(), q = [await hay(A, k1), await hay(B, k1)];
ok('1. Ana hace explotar su barril: una explosión en cada pantalla y el barril se va en las dos', conect[0] === 1 && conect[1] === 1 && veB1 && c[0] === 1 && c[1] === 1 && !q[0] && !q[1], { conect, veB1, explosiones: c, queda: q });
// ---- 2 ----
await reset(); let k2 = await ponerEn(A, 0); await espera(2500);
await ev(B, `(() => { const o = buscarObjeto(${JSON.stringify(k2)}); danarObjeto(o, 999, o.b.pos, v3(0, 1, 0)); return 1; })()`); await espera(2500);
c = await cuenta(); q = [await hay(A, k2), await hay(B, k2)];
ok('2. Beto le dispara al barril de Ana: una explosión en cada pantalla y el barril se va en las dos', c[0] === 1 && c[1] === 1 && !q[0] && !q[1], { explosiones: c, queda: q });
// ---- 3 ----
await reset(); let k3a = await ponerEn(A, 0), k3b = await ponerEn(A, 2); await espera(2500);
await ev(A, `(() => { const o = buscarObjeto(${JSON.stringify(k3a)}); danarObjeto(o, 999, o.b.pos, v3(0, 1, 0)); return 1; })()`); await espera(3000);
c = await cuenta(); q = [await hay(A, k3a), await hay(A, k3b), await hay(B, k3a), await hay(B, k3b)];
ok('3. dos barriles de Ana: uno arrastra al otro; dos explosiones en cada pantalla', c[0] === 2 && c[1] === 2 && !q.some(Boolean), { explosiones: c, queda: q });
// ---- 4 ----
await reset(); let k4a = await ponerEn(A, 0), k4b = await ponerEn(B, 2); await espera(2500);
await ev(A, `(() => { const o = buscarObjeto(${JSON.stringify(k4a)}); danarObjeto(o, 999, o.b.pos, v3(0, 1, 0)); return 1; })()`); await espera(3000);
c = await cuenta(); q = [await hay(A, k4a), await hay(A, k4b), await hay(B, k4a), await hay(B, k4b)];
ok('4. el barril de Ana arrastra al de Beto: dos explosiones en cada pantalla', c[0] === 2 && c[1] === 2 && !q.some(Boolean), { explosiones: c, queda: q });
// ---- 5 ----
await reset(); let k5 = await ponerEn(A, 0); await espera(2500);
const golpe = `(() => { const o = buscarObjeto(${JSON.stringify(k5)}); danarObjeto(o, 999, o.b.pos, v3(0, 1, 0)); return 1; })()`;
await Promise.all([ev(A, golpe), ev(B, golpe)]); await espera(2500);
c = await cuenta(); q = [await hay(A, k5), await hay(B, k5)];
ok('5. los dos le pegan al mismo barril a la vez: una explosión en cada pantalla', c[0] === 1 && c[1] === 1 && !q[0] && !q[1], { explosiones: c, queda: q });
const e2 = errs.filter((x) => !/broker|mqtt|tienda|CORS|ERR_FAILED|Failed to load|net::|willRead/i.test(x));
ok('6. sin errores de JS', !e2.length, e2.slice(0, 4));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); srv.close(); process.exit(R.every(Boolean) ? 0 : 1);
