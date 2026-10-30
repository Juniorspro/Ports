// la noche en la pizzería en una sala: Ana y Beto entran al server oficial del mapa; hay uno solo que la maneja y los dos
// ven lo mismo (hora, energía, animatrónicos); Beto (que no la maneja) cierra una puerta y prende la linterna y Ana lo
// ve; un animatrónico agarra a Beto (le sale el susto a él); al irse Ana, Beto sigue manejando la noche desde donde estaba.
// uso: BROKER_DIR=carpeta-con-mc/broker node red_noche.mjs Hypper.html
import { createRequire } from 'module'; import http from 'http';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad', req = createRequire(S + '/mc/broker/package.json');
const html = process.argv[2];
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8898, '127.0.0.1', r));
const navs = [], errs = [];
const abrir = async (n) => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] }); navs.push(b);
  const p = await (await b.newContext({ viewport: { width: 800, height: 450 } })).newPage();
  p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|mqtt|Failed to load/i.test(m.text())) errs.push(n + ': ' + m.text().slice(0, 160)); });
  await p.goto('file://' + html + '?test&broker=ws://127.0.0.1:8898/mqtt'); await p.waitForFunction(() => window.__listo, null, { timeout: 150000 }); return p;
};
const ev = (P, s) => P.evaluate((x) => window.__ev(x), s), J = async (P, s) => JSON.parse(await ev(P, `JSON.stringify(${s})`));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const entrar = (P, n) => ev(P, `PREFS.nombre='${n}'; PREFS.lang='es'; PREFS.bienvenida=true; PREFS.calidad='patata'; GFX.auto=false; aplicarGfx(); audioIniciar(); inicioMostrar(false); conectarMultijugador(); entrarSala(SALAS_OF.find((s) => s.m === 'RB_Pizzeria')); 1`);
const A = await abrir('Ana'), B = await abrir('Beto');
await entrar(A, 'Ana'); await espera(4000); await entrar(B, 'Beto');
let ok = 0, mal = 0; const chk = (c, t) => { console.log((c ? 'OK  ' : 'MAL ') + t); c ? ok++ : mal++; };
for (let i = 0; i < 40; i++) { await espera(1000); const [a, b] = [await J(A, `{on: NOC.on, red: RED.on, n: RED.remotos.size}`), await J(B, `{on: NOC.on, red: RED.on, n: RED.remotos.size}`)]; if (a.on && b.on && a.n && b.n) break; }
await espera(6000);
const est = async (P) => J(P, `{id: RED.ID, ctl: NOC.ctl, estado: NOC.estado, hora: +NOC.hora.toFixed(3), poder: +NOC.poder.toFixed(1), puerta: NOC.puerta, a: NOC.anim.map(x => [+x.pos.x.toFixed(1), +x.pos.z.toFixed(1)]), fuera: [...NOC.fuera], susto: !!NOC.susto}`);
let a = await est(A), b = await est(B);
console.log('Ana', JSON.stringify(a)); console.log('Beto', JSON.stringify(b));
chk(a.ctl !== b.ctl, 'uno solo maneja la noche (Ana ' + a.ctl + ', Beto ' + b.ctl + ')');
const [M, O] = a.ctl ? [A, B] : [B, A], mId = a.ctl ? a.id : b.id, oId = a.ctl ? b.id : a.id;
chk(Math.abs(a.hora - b.hora) < 0.02 && Math.abs(a.poder - b.poder) < 1, 'misma hora y energía (' + a.hora + '/' + b.hora + ', ' + a.poder + '/' + b.poder + ')');
// los animatrónicos caminan en el que maneja y el otro los ve en el mismo lugar
await ev(M, `NOC.noche = 6; for (const x of NOC.anim) x.tMov = 0; 0`); await espera(8000);
const am = await J(M, `NOC.anim.map(x => [x.pos.x, x.pos.z, x.nodo])`), ao = await J(O, `NOC.anim.map(x => [x.pos.x, x.pos.z, x.nodo])`);
const dmax = Math.max(...am.map((p, k) => Math.hypot(p[0] - ao[k][0], p[1] - ao[k][1])));
console.log('animatrónicos (maneja):', am.map((x) => x[2]).join(' '), '| distancia máx. entre los dos:', dmax.toFixed(2), 'm');
chk(dmax < 1.5, 'los animatrónicos están en el mismo lugar para los dos');
// el que no maneja cierra la puerta izquierda (pedido por la red) y prende la linterna
await ev(O, `JUG.pos.set(-23.3, 1.4, -1.3); JUG.vel.set(0,0,0); const bt = nocheBotones().find(x => x.que==='puerta' && x.lado==='izq'); const d = vsub(bt.p, vadd(JUG.pos, v3(0, JUG.ojo, 0))); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = Math.asin(-d.y / d.len()); 0`);
await espera(800); await ev(O, `usar(); nocheLinterna(); 0`); await espera(2500);
const pm = await J(M, `{p: NOC.puerta.izq, k: +NOC.pk.izq.toFixed(2), luzRemota: [...RED.remotos.values()].some(r => r.f & 128)}`), po = await J(O, `{p: NOC.puerta.izq, k: +NOC.pk.izq.toFixed(2), caja: +NOC.cuerpoP.izq.pos.y.toFixed(2)}`);
console.log('puerta izq: maneja', JSON.stringify(pm), '| el otro', JSON.stringify(po));
chk(pm.p && po.p && po.k > 0.9 && po.caja < 5, 'la puerta que cerró el otro está cerrada (y choca) en los dos');
chk(pm.luzRemota, 'el que maneja ve la linterna del otro');
// un animatrónico agarra al que no maneja: el susto le sale a él
await ev(M, `nocheAgarrar(NOC.anim[1], '${oId}'); 0`); await espera(1500);
const so = await J(O, `{susto: !!NOC.susto, fuera: NOC.fuera.has(RED.ID)}`), sm = await J(M, `{susto: !!NOC.susto, fuera: [...NOC.fuera]}`);
console.log('agarrado:', JSON.stringify(so), '| maneja:', JSON.stringify(sm));
chk(so.susto && !sm.susto && sm.fuera.includes(oId), 'el susto le sale sólo al que agarraron');
await espera(6000);
console.log('después del susto (el agarrado mira las cámaras):', JSON.stringify(await J(O, `{cam: NOC.cam, abierto: UI.abierto}`)));
// se va el que maneja: el otro sigue con la noche desde donde estaba
const h0 = (await est(O)).hora;
await ev(M, `redSalir(); 0`); await navs[a.ctl ? 0 : 1].close();
for (let i = 0; i < 60 && !(await J(O, 'NOC.ctl')); i++) await espera(1000);
await espera(3000);
const fin = await est(O);
console.log('se fue el que manejaba:', JSON.stringify(fin));
chk(fin.ctl && fin.hora >= h0, 'el que queda maneja la noche y la hora sigue (' + h0 + ' → ' + fin.hora + ')');
console.log('errores:', errs.slice(0, 8).join(' | ') || 'ninguno');
console.log(`resultado: ${ok} bien, ${mal} mal`);
for (const n of navs) await n.close().catch(() => {}); srv.close(); process.exit(0);
