// Partida en la red local (LAN / Wi-Fi) sin internet, con el broker de la app de verdad (apk/web/src/com/jxmod/app/Lan.java)
// corriendo en Java en esta compu (ServidorLan.java: lo mismo que arma Web.java en el celular) y el juego de verdad en
// Chromium, con internet cortado (sólo 127.0.0.1 y la red local) y la tienda pidiendo la cuenta de Google:
//  - Ana, en la «app» (un JXNativo de mentira que llama al Java por un control en 127.0.0.1, como el puente de Android),
//    abre Multijugador → LAN / Wi-Fi → Crear partida en la red;
//  - Beto, en la «app» de un celular, la ve sola en la lista (el anuncio por UDP que oye el Java) y entra por el puente;
//  - Caro, sin la app, abre el juego que sirve el anfitrión (http://IP:8765/) y entra desde ahí;
//  - se ven, ven lo que pone Ana (su mundo retenido), el chat, Ana es la anfitriona; Beto sale y vuelve escribiendo la IP;
//    Caro cierra el navegador de golpe y desaparece para los demás (su testamento).
// Y que desde una página https el navegador no deja abrir un ws:// a la red local pero sí a 127.0.0.1 (por eso el puente).
// uso: node red_lan.mjs CARPETA/JUEGO.html   (entorno: PUERTO=8765 y los siguientes 3 libres)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import { execFileSync, spawn } from 'child_process'; import fs from 'fs'; import path from 'path'; import os from 'os'; import https from 'https';
const [, , HTML] = process.argv;
const AQUI = path.dirname(new URL(import.meta.url).pathname), APK = path.join(AQUI, '..', 'apk');
const P = +(process.env.PUERTO || 8765), PA = P + 1, PP = P + 2, PC = P + 3;   // broker y juego, anuncio, puente, control
const DIR = path.dirname(path.resolve(HTML)), ARCH = path.basename(HTML);
const RR = []; const ok = (n, c, d) => { RR.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(d)); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
// ---- el Java: compilar y arrancar ----
const X = fs.mkdtempSync(path.join(os.tmpdir(), 'lanj'));
execFileSync('javac', ['--release', '8', '-Xlint:-options', '-encoding', 'UTF-8', '-d', X, path.join(APK, 'web/src/com/jxmod/app/Lan.java'), path.join(APK, 'pruebas/unido/ServidorLan.java')], { stdio: 'pipe' });
const J = spawn('java', ['-cp', X, 'com.jxmod.app.ServidorLan', String(P), DIR, String(PA), String(PP), String(PC)], { stdio: ['ignore', 'pipe', 'pipe'] });
// (si la prueba se cae, el Java no queda vivo ocupando los puertos)
const matar = () => { try { J.kill(); } catch (e) {} };
process.on('exit', matar); for (const s of ['uncaughtException', 'unhandledRejection']) process.on(s, (e) => { console.error(e); matar(); process.exit(1); });
J.stderr.on('data', (d) => process.stderr.write('java: ' + d));
const IPS = await new Promise((ok2, mal) => { let s = ''; J.stdout.on('data', (d) => { s += d; const m = /listo \[(.*)\]/.exec(s); if (m) ok2(m[1].split(',').map((x) => x.trim()).filter(Boolean)); }); J.on('exit', (c) => mal(new Error('java salió ' + c))); setTimeout(() => mal(new Error('java no arrancó')), 20000); });
const IP = IPS[0] || '127.0.0.1';
console.log('anfitrión en Java: broker y juego en ' + P + ', IPs ' + IPS.join(', '));
const control = async (r) => (await fetch('http://127.0.0.1:' + PC + r)).json();
// ---- los navegadores ----
const NAT = ({ pc, pp }) => {   // (addInitScript pasa un solo argumento: van juntos)
  // (lo que la app de Android le da al juego por JXNativo, llamando al Java por el control: síncrono, como en la WebView)
  const sx = (r) => { const x = new XMLHttpRequest(); x.open('GET', 'http://127.0.0.1:' + pc + r, false); x.send(); return x.responseText; }, e = encodeURIComponent;
  window.JXNativo = { lan: () => 1, lanHostear: (n, s, m, du) => sx(`/hostear?n=${e(n)}&s=${e(s)}&m=${e(m)}&du=${e(du)}`), lanParar: () => { sx('/parar'); }, lanBuscar: () => 'ok', lanHosts: () => sx('/hosts'), lanPuente: () => pp, lanIps: () => sx('/ips') };
};
const LOCAL = new RegExp('^(https?|wss?)://(127\\.0\\.0\\.1|localhost|' + IPS.map((x) => x.replace(/\./g, '\\.')).join('|') + ')(:|/)');
let BR = null;
async function abrir(nombre, celu, app, url, propio) {
  // (Ana y Beto en un Chromium, cada uno en su contexto; Caro en otro: con los tres juegos en el mismo proceso de gráficos,
  // por software en esta compu, se perdía el contexto de WebGL)
  const b = propio ? await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--disable-gpu-watchdog'] }) : BR || (BR = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--disable-gpu-watchdog'] }));
  // (ventanas chicas: los tres juegos abiertos a la vez dibujan con la CPU en esta compu)
  const ctx = await b.newContext(celu ? { viewport: { width: 640, height: 288 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } : { viewport: { width: 640, height: 360 } });
  // sin internet: sólo esta compu y la red local; y la tienda (que no responde) con la cuenta de Google pedida desde antes
  await ctx.route('**/*', (r) => (LOCAL.test(r.request().url()) || r.request().url().startsWith('data:') ? r.continue() : r.abort()));
  await ctx.addInitScript(() => { try { localStorage.setItem('jx_cu_conf', '{"google":true}'); } catch (e) {} });
  if (app) await ctx.addInitScript(NAT, { pc: PC, pp: PP });
  const p = await ctx.newPage(), err = []; p.on('pageerror', (e) => err.push(nombre + ': ' + e.message.slice(0, 200)));
  await p.goto(url, { timeout: 240000 });   // (30 MB con los otros dos dibujando con la CPU: más de los 30 s de siempre)
  await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await ev(`PREFS.nombre = ${JSON.stringify(nombre)}; PREFS.bienvenida = true; 1`);
  return { b, ctx, p, ev, err };
}
// (el broker público de siempre, inalcanzable: como sin internet)
const SINPUB = '&broker=' + encodeURIComponent('ws://127.0.0.1:9/mqtt');
const U = 'http://127.0.0.1:' + P + '/' + ARCH + '?test&gfx=patata' + SINPUB;
const clic = (Q, sel) => Q.ev(`(() => { const e = RB.el.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
// ---- Ana: anfitriona en la app ----
const A = await abrir('Ana', false, true, U);
// (Caro abre ya el juego que sirve el celular de Ana, antes de que haya partida: en esta compu, cargar el juego con otros
// dos jugando hace caer la página, también desde 127.0.0.1 —nada que ver con la red local—; y así se prueba que la
// página abierta antes encuentra la partida después)
const C = await abrir('Caro', false, false, 'http://' + IP + ':' + P + '/' + ARCH + '?test&gfx=patata&lan' + SINPUB, true);
await A.ev("inicioMostrar(true); conectarMultijugador(); 1"); await espera(500);
const conLogin = await A.ev("JSON.stringify({ falta: cuentaFaltaPara(), boton: !!RB.el.querySelector('[data-rb=lan]') })");
await clic(A, '[data-rb=lan]'); await espera(400);
const panel = await A.ev("JSON.stringify({ panel: RB.panel, crear: !!RB.el.querySelector('[data-rb=lanHost]'), dir: (RB.el.querySelector('.lanIp') || {}).textContent || '' })");
ok('sin cuenta y sin internet, Multijugador muestra «LAN / Wi-Fi» y el panel ofrece crear la partida (con la dirección para los que no tienen la app)', JSON.parse(conLogin).boton && JSON.parse(panel).crear && JSON.parse(panel).dir.includes(':' + P), { conLogin: JSON.parse(conLogin), panel: JSON.parse(panel) });
await clic(A, '[data-rb=lanHost]'); await espera(4000);
const a1 = JSON.parse(await A.ev("JSON.stringify({ on: RED.on, sala: SALA && SALA.id, lan: SALA && SALA.lan, anf: soyAnfitrion(), estado: JUEGO.estado, id: RED.ID })"));
ok('Ana está jugando en su partida de la red (broker en 127.0.0.1) y es la anfitriona', a1.on && a1.estado === 'juego' && a1.anf && /^ws:\/\/127\.0\.0\.1:\d+\/mqtt$/.test(a1.lan), a1);
await A.ev("window.__c = spawnDelante('Crate'); redObjeto(); 1");
// ---- Beto: con la app, la encuentra en la lista ----
const B = await abrir('Beto', true, true, U);
await B.ev("inicioMostrar(true); conectarMultijugador(); 1"); await espera(300);
await clic(B, '[data-rb=lan]');
let lista = []; for (let i = 0; i < 20 && !lista.length; i++) { await espera(500); lista = JSON.parse(await B.ev("JSON.stringify(LAN.lista.map((H) => [H.s, H.ip, H.puerto, H.j, H.du]))")); }
ok('Beto ve la partida de Ana sola en la lista (anuncio por UDP), con su IP y 1 jugador', lista.length === 1 && lista[0][4] === a1.id && lista[0][3] === 1 && lista[0][2] === P, lista);
await clic(B, '.lanSala [data-rb^=lanEntrar]'); await espera(4500);
const b1 = JSON.parse(await B.ev("JSON.stringify({ on: RED.on, lan: SALA && SALA.lan, du: SALA && SALA.du, anf: soyAnfitrion(), rem: [...RED.remotos.values()].map((r) => r.nombre), objs: [...RED.objs.values()].map((o) => o.nombre) })"));
ok('Beto entra por el puente de la app (ws://127.0.0.1:…/lan/IP:puerto/mqtt), ve a Ana y la caja que puso; Ana es la anfitriona', b1.on && b1.lan.includes('/lan/' + lista[0][1] + ':' + P + '/mqtt') && b1.rem.includes('Ana') && b1.objs.includes('Crate') && b1.du === a1.id && !b1.anf, b1);
// ---- Caro: sin la app, desde el juego que sirve el anfitrión ----
await C.ev("inicioMostrar(true); conectarMultijugador(); 1"); await espera(300);
await clic(C, '[data-rb=lan]');
let listaC = []; for (let i = 0; i < 10 && !listaC.length; i++) { await espera(500); listaC = JSON.parse(await C.ev("JSON.stringify(LAN.lista.map((H) => [H.s, H.du]))")); }
await clic(C, '.lanSala [data-rb^=lanEntrar]');
// (espera a que entre: carga el mapa con otros dos juegos dibujando en esta compu; tope 60 s)
for (let i = 0; i < 120; i++) { await espera(500); if (await C.ev('RED.on && RED.remotos.size >= 2 && RED.objs.size >= 1')) break; }
const c1 = JSON.parse(await C.ev("JSON.stringify({ on: RED.on, lan: SALA && SALA.lan, rem: [...RED.remotos.values()].map((r) => r.nombre).sort(), objs: [...RED.objs.values()].map((o) => o.nombre), seguro: window.isSecureContext, est: JUEGO.estado, cli: !!RED.cli, con: !!(RED.cli && RED.cli.connected), carga: !!document.querySelector('#carga:not(.oc)'), mapa: MUNDO.nombre })")); c1.err = C.err.slice(0, 4);
ok('Caro (sin la app, http://IP:' + P + '/) ve la partida y entra directo al broker del anfitrión; ve a Ana y a Beto', listaC.length === 1 && c1.on && c1.lan === 'ws://' + IP + ':' + P + '/mqtt' && c1.rem.join() === 'Ana,Beto' && c1.objs.includes('Crate'), Object.assign({ listaC }, c1));
await espera(1500);
const est = await control('/estado'), hostsAhora = JSON.parse(await B.ev("JSON.stringify(JSON.parse(JXNativo.lanHosts()).map((x) => JSON.parse(x.d).j))"));
ok('el anfitrión cuenta 3 jugadores y lo anuncia', est.jugadores === 3 && hostsAhora[0] === 3, { est, hostsAhora });
// chat y daño (PvP) por el broker de la red
await B.ev("chatEnviar('hola desde la red'); 1");
let chatA = ''; for (let k = 0; k < 30 && !chatA.includes('Beto: hola desde la red'); k++) { await espera(100); chatA = await A.ev("JSON.stringify(CHAT.map((c) => c.t))"); }
await C.ev("const r = [...RED.remotos.values()].find((x) => x.nombre === 'Ana'); danarPersona(r.P, 30, r.P.pos, v3(0, 0, 1)); 1"); await espera(800);
const vidaA = JSON.parse(await A.ev('JSON.stringify(JUG.vida)'));
ok('el chat de Beto y el daño de Caro le llegan a Ana', chatA.includes('Beto: hola desde la red') && vidaA === 70, { vidaA });
// Beto vuelve al menú y entra escribiendo la IP (y el puerto)
await B.ev('irMenuPrincipal(); 1'); await espera(1500);
await B.ev("inicioMostrar(true); conectarMultijugador(); 1"); await espera(300); await clic(B, '[data-rb=lan]'); await espera(300);
await B.ev(`RB.el.querySelector('#lanIp').value = ${JSON.stringify(IP + ':' + P)}; 1`); await clic(B, '[data-rb=lanIp]'); await espera(4500);
const b2 = JSON.parse(await B.ev("JSON.stringify({ on: RED.on, rem: [...RED.remotos.values()].map((r) => r.nombre).sort(), lan: SALA && SALA.lan })"));
ok('Beto vuelve escribiendo la IP: entra otra vez', b2.on && b2.rem.join() === 'Ana,Caro', b2);
// Caro cierra el navegador de golpe: su testamento la saca de los demás
await C.b.close(); let remA = []; for (let k = 0; k < 40; k++) { await espera(250); remA = JSON.parse(await A.ev("JSON.stringify([...RED.remotos.values()].map((r) => r.nombre).sort())")); if (!remA.includes('Caro')) break; }
ok('Caro se corta de golpe: desaparece para Ana enseguida (testamento del broker)', remA.join() === 'Beto', remA);
// Ana deja de ser anfitriona al volver al menú
await A.ev('irMenuPrincipal(); 1'); await espera(1500);
const hostsFin = await control('/hosts').catch(() => []);
ok('al volver al menú, Ana deja de anunciar la partida (ningún anuncio en el último segundo)', hostsFin.every((h) => h.edad > 1000), hostsFin);
// ---- https: el navegador no deja abrir un ws:// a la red local, pero sí a 127.0.0.1 ----
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'lanssl')); let mixto = null;
try {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(T, 'k.pem'), '-out', path.join(T, 'c.pem'), '-days', '1', '-subj', '/CN=prueba'], { stdio: 'pipe' });
  const S = https.createServer({ key: fs.readFileSync(path.join(T, 'k.pem')), cert: fs.readFileSync(path.join(T, 'c.pem')) }, (q, r) => { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end('<!doctype html><title>https</title>'); });
  await new Promise((r) => S.listen(PC + 1, '0.0.0.0', r));
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' }); const pg = await (await b.newContext({ ignoreHTTPSErrors: true })).newPage();
  await pg.goto('https://' + IP + ':' + (PC + 1) + '/');
  mixto = await pg.evaluate(async ([ip, p, pp]) => {
    const prueba = (u) => new Promise((ok2) => { try { const w = new WebSocket(u, 'mqtt'); w.onopen = () => { w.close(); ok2('abre'); }; w.onerror = () => ok2('error'); setTimeout(() => ok2('nada'), 3000); } catch (e) { ok2('bloqueado: ' + e.name); } });
    return { lan: await prueba('ws://' + ip + ':' + p + '/mqtt'), puente: await prueba('ws://127.0.0.1:' + pp + '/lan/' + ip + ':' + p + '/mqtt') };
  }, [IP, P, PP]);
  await b.close(); S.close();
} catch (e) { mixto = { error: String(e).slice(0, 160) }; }
ok('desde una página https: ws:// a la IP de la red bloqueado (contenido mixto), por el puente de 127.0.0.1 abre', mixto && /bloqueado|error/.test(mixto.lan) && mixto.puente === 'abre', mixto);
const err = [...A.err, ...B.err, ...C.err];
ok('sin errores de JS', !err.length, err.slice(0, 5));
console.log(`RESUMEN ${RR.filter(Boolean).length}/${RR.length}`);
await BR.close(); J.kill(); process.exit(0);
