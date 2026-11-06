// Cámara congelada en la PC (Discord: «quise jugar con un amigo y la cámara no reconoce el movimiento del mouse»).
// La capa de los toques tapa toda la pantalla también en la compu, así que el clic le llegaba a ella y el juego nunca
// pedía trabar el mouse: sin mouse trabado la cámara no se mueve. Se prueba:
//  1. un jugador en PC: un clic en el juego traba el mouse y moverlo gira la cámara;
//  2. dos jugadores en PC (Ana arma el server, Beto entra): a los dos les pasa lo mismo;
//  3. con el mouse trabado, el clic dispara (y el derecho, el secundario);
//  4. una compu con pantalla táctil (arranca con los controles táctiles): el primer clic del mouse la pasa a los de compu
//     y traba el mouse;
//  5. en el celular un toque no lo pasa a los de compu ni pide trabar nada, y deslizar el dedo sigue girando la cámara;
//  6. sin errores de JS.
// uso: BROKER_DIR=carpeta-con-mc/broker node mouse_pc.mjs URL_HTML
import { createRequire } from 'module'; import http from 'http';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad', req = createRequire(S + '/mc/broker/package.json');
const [, , html] = process.argv;
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 600) : '')); };
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8895, '127.0.0.1', r));
const errs = [], navs = [];
// (tipo: 'pc', 'hibrida' (pantalla táctil y mouse) o 'celu')
const abrir = async (n, tipo = 'pc') => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] }); navs.push(b);
  const ctx = await b.newContext(tipo === 'celu' ? { viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : tipo === 'hibrida' ? { viewport: { width: 1280, height: 720 }, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|mqtt|Failed to load|ERR_|CORS|net::|404/i.test(m.text())) errs.push(n + ': ' + m.text().slice(0, 160)); });
  await p.goto(html + '?test&broker=ws://127.0.0.1:8895/mqtt'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  await p.evaluate((nom) => window.__ev(`(() => { cuentaPedir = () => true; cuentaFaltaPara = () => false; if (typeof cuPedirAlAbrir === 'function') cuPedirAlAbrir.hecho = true;
    PREFS.nombre = '${nom}'; idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.gfx = 'patata'; GFX.auto = false; aplicarGfx();
    // (cuántas veces se pidió trabar el mouse)
    window.__pl = 0; const o = HTMLCanvasElement.prototype.requestPointerLock; HTMLCanvasElement.prototype.requestPointerLock = function () { window.__pl++; return o.apply(this, arguments); };
    return 1; })()`), n);
  return p;
};
const ev = (P, s) => P.evaluate((x) => window.__ev(x), s);
const hasta = async (P, cond, seg) => { for (let i = 0; i < seg * 2; i++) { if (await ev(P, cond).catch(() => false)) return true; await new Promise((r) => setTimeout(r, 500)); } return false; };
// (un clic en el medio de la pantalla y diez movimientos del mouse a la derecha: ¿se pidió trabarlo, se trabó y giró?)
const probar = async (P) => {
  const y0 = await ev(P, 'JUG.yaw'); const pl0 = await ev(P, '__pl');
  const arriba = await ev(P, `(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return e && (e.id || e.tagName); })()`);
  await P.mouse.click(640, 360); await P.waitForTimeout(500);
  const r = await ev(P, `({ pidio: __pl, trabado: document.pointerLockElement === R.cv, bloq: ENT.bloqueado, tactil: ENT.tactil, claseTactil: document.body.classList.contains('tactil'), ui: UI.abierto, disparo: ENT.disparo })`);
  for (let i = 0; i < 10; i++) { await P.mouse.move(640 + (i + 1) * 20, 360); await P.waitForTimeout(40); }
  await P.waitForTimeout(300);
  const y1 = await ev(P, 'JUG.yaw');
  return { arriba, ...r, pidio: r.pidio - pl0, giro: +Math.abs(y1 - y0).toFixed(3) };
};
// 1. un jugador
const A = await abrir('Ana');
await ev(A, `(() => { inicioMostrar(false); empezarPartida('FlatGrass'); return 1; })()`);
await hasta(A, `MUNDO.nombre === 'FlatGrass' && JUEGO.estado === 'juego'`, 60); await A.waitForTimeout(1500);
const solo = await probar(A);
ok('1. un jugador en PC: el clic traba el mouse y moverlo gira la cámara', solo.pidio >= 1 && solo.trabado && solo.giro > 0.05 && !solo.disparo, solo);
// 3. con el mouse trabado el clic dispara
await A.mouse.down(); await A.waitForTimeout(150); const dis = await ev(A, `({ d: ENT.disparo, bloq: ENT.bloqueado })`); await A.mouse.up();
// (el derecho la pistola de física lo usa y lo apaga en el cuadro siguiente: se cuenta cuando se prende)
await ev(A, `(() => { window.__d2 = 0; let v = ENT.disparo2; Object.defineProperty(ENT, 'disparo2', { configurable: true, get: () => v, set: (x) => { if (x) __d2++; v = x; } }); return 1; })()`);
await A.mouse.down({ button: 'right' }); await A.waitForTimeout(150); const dis2 = await ev(A, `__d2 > 0`); await A.mouse.up({ button: 'right' });
await A.waitForTimeout(150); const suelto = await ev(A, `!ENT.disparo && !ENT.disparo2`);
ok('3. con el mouse trabado: clic izquierdo dispara, derecho el secundario, al soltar se corta', dis.d && dis.bloq && dis2 && suelto, { dis, dis2, suelto });
// (se suelta el mouse, como con Esc; si quedó algo abierto, se cierra)
await ev(A, `document.exitPointerLock(); 1`); await A.waitForTimeout(400); await ev(A, `if (UI.abierto) cerrarPaneles(); 1`);
// 2. dos jugadores
await ev(A, `(() => { conectarMultijugador(); crearServidor({ n: 'Prueba', pw: '', m: 'FlatGrass', mo: 'Free', pvp: 0, rpg: 1, nb: 0, mp: 1000, mv: 40 }); return 1; })()`);
const ana = await hasta(A, `MUNDO.nombre === 'FlatGrass' && RED.on && JUEGO.estado === 'juego' && !UI.abierto`, 120);
const sala = JSON.parse(await ev(A, `JSON.stringify((() => { const s = Object.assign({}, SALA); delete s.clave; return s; })())`));
const B = await abrir('Beto');
await ev(B, `(() => { conectarMultijugador(); entrarSala(${JSON.stringify(sala)}, ''); return 1; })()`);
const beto = await hasta(B, `MUNDO.nombre === 'FlatGrass' && JUEGO.estado === 'juego' && RED.on && !UI.abierto`, 120); await B.waitForTimeout(2500);
const seVen = await hasta(A, `RED.remotos.size >= 1`, 20).catch(() => false);
const mA = await probar(A), mB = await probar(B);
ok('2. dos jugadores en PC: a los dos el clic les traba el mouse y la cámara gira', ana && beto && mA.trabado && mB.trabado && mA.giro > 0.05 && mB.giro > 0.05, { ana: mA, beto: mB, seVen });
for (const P of [A, B]) await P.context().browser().close();
// 4. compu con pantalla táctil
const H = await abrir('Hibrida', 'hibrida');
await ev(H, `(() => { inicioMostrar(false); empezarPartida('FlatGrass'); return 1; })()`);
await hasta(H, `MUNDO.nombre === 'FlatGrass' && JUEGO.estado === 'juego'`, 60); await H.waitForTimeout(1500);
const h0 = await ev(H, `({ tactil: ENT.tactil, clase: document.body.classList.contains('tactil'), fino: matchMedia('(any-pointer: fine)').matches })`);
const h = await probar(H);
ok('4. compu con pantalla táctil: arranca táctil y el primer clic del mouse la pasa a compu y traba el mouse', h0.tactil && h.pidio >= 1 && h.trabado && !h.tactil && !h.claseTactil && h.giro > 0.05, { antes: h0, despues: h });
await H.context().browser().close();
// 5. celular
const C = await abrir('Celu', 'celu');
await ev(C, `(() => { inicioMostrar(false); empezarPartida('FlatGrass'); return 1; })()`);
await hasta(C, `MUNDO.nombre === 'FlatGrass' && JUEGO.estado === 'juego'`, 60); await C.waitForTimeout(1500);
const cy0 = await ev(C, 'JUG.yaw');
await C.touchscreen.tap(600, 200); await C.waitForTimeout(300);
const c1 = await ev(C, `({ tactil: ENT.tactil, clase: document.body.classList.contains('tactil'), pidio: __pl })`);
// (deslizar un dedo en la mitad derecha: CDP de a pasos)
const cdp = await C.context().newCDPSession(C);
const dedo = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
await dedo('touchStart', 600, 200); for (let i = 1; i <= 8; i++) { await dedo('touchMove', 600 + i * 15, 200); await C.waitForTimeout(30); } await dedo('touchEnd');
await C.waitForTimeout(300);
const cy1 = await ev(C, 'JUG.yaw');
ok('5. celular: tocar no lo pasa a compu ni pide trabar nada, y deslizar el dedo gira la cámara', c1.tactil && c1.clase && c1.pidio === 0 && Math.abs(cy1 - cy0) > 0.05, { ...c1, giro: +Math.abs(cy1 - cy0).toFixed(3) });
await C.context().browser().close();
ok('6. sin errores de JS', !errs.length, errs.slice(0, 5));
srv.close(); console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
process.exit(R0.every(Boolean) ? 0 : 1);
