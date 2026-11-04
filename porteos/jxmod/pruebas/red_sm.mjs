// mods del server (SM): el server baja los mods de la tienda, cada uno elige los suyos y todos ven todo
import { createRequire } from 'module'; import http from 'http';
import { createRequire as _cr } from 'module'; const { chromium } = _cr(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '.', req = createRequire(S + '/mc/broker/package.json'); // carpeta con mc/broker (aedes + ws)
const html = process.argv[2], D = (process.argv[3] || '.') + '/', API = 'https://rezobox-tienda.holasoyjuniors365.workers.dev/api/';
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8897, '127.0.0.1', r));
const publicar = async (d) => (await fetch(API + 'publicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })).json();
const borrar = async (id, clave) => (await fetch(API + 'borrar/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clave }) })).json();
const pub = [];
const m1 = await publicar({ formato: 'rezobox-mod', nombre: 'Prueba SM soldado', autor: 'Prueba', descripcion: 'skin Soldier y salto x3', icono: '🪖', etiquetas: ['personajes'], efectos: { skin: 'Soldier', salto: 3, explosion: 2.5 } }); pub.push(m1);
const m2 = await publicar({ formato: 'rezobox-mod', nombre: 'Prueba SM codigo', autor: 'Prueba', icono: '🤖', etiquetas: ['otros'], efectos: {}, codigo: "rb.on('inicio', () => rb.aviso('codigo del server corriendo', 3));" }); pub.push(m2);
console.log('publicados:', pub.map((x) => x.id || x.error).join(', '));
const navs = [], errs = [];
const abrir = async (n) => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] }); navs.push(b);
  const c = await b.newContext({ viewport: { width: 1000, height: 560 } }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160))); p.on('dialog', (d) => d.accept());
  await p.goto('file://' + html + '?test&broker=ws://127.0.0.1:8897/mqtt'); await p.waitForFunction(() => window.__listo, null, { timeout: 150000 }); return p; };
const ev = (p, c) => p.evaluate((c) => window.__ev(c), c), espera = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const A = await abrir('A'), B = await abrir('B');
  for (const [P, n] of [[A, 'Ana'], [B, 'Beto']]) await ev(P, `PREFS.nombre='${n}'; PREFS.bienvenida=true; PREFS.modsSrv = {}; PREFS.mods = {}; audioIniciar(); inicioMostrar(false); conectarMultijugador(); entrarSala(SALAS_OF.find((s) => s.m === 'FlatGrass')); 1`);
  await espera(9000);
  await ev(B, `JUG.pos.set(10, 1.6, 10); JUG.yaw = Math.PI; JUG.tercera = false; JUG.pitch = 0.15; 1`); await ev(A, `JUG.pos.set(10, 1.6, 5); JUG.yaw = 0; 1`);
  console.log('A: server tiene', await ev(A, 'SRV.mods.size'), 'mods de la tienda +', await ev(A, 'OFICIALES.length'), 'oficiales · botón SM', await ev(A, "SMOD.boton && SMOD.boton.style.display !== 'none'"));
  // A abre SM con la tecla M y activa el soldado (y el SCP y el de código)
  await A.keyboard.press('KeyM'); await espera(800);
  console.log('panel SM abierto:', await ev(A, "UI.abierto + ' · ' + document.querySelectorAll('#smLista .smIt').length + ' mods en la lista'"));
  await A.click(`[data-sm="t:${m1.id}"]`); await espera(300); await A.click('[data-sm="t:scp"]'); await espera(300); await A.click(`[data-sm="t:${m2.id}"]`); await espera(800);
  await A.screenshot({ path: D + 'sm1_panel.png' });
  console.log('A activos:', await ev(A, 'JSON.stringify([...SMOD.ids])'), 'skin', await ev(A, 'JUG.skinMod'), 'salto', await ev(A, 'JUG.salto.toFixed(2)'), 'scp', await ev(A, 'NAT.scp'), 'código cargado', await ev(A, 'MODAPI.mods.length'));
  await A.keyboard.press('KeyM'); await espera(4000);
  // B no activó nada: tiene que ver a Ana como soldado en cuatro patas, con los íconos de sus mods
  console.log('B ve a Ana:', await ev(B, "(() => { const R2 = [...RED.remotos.values()][0]; return JSON.stringify({skin: R2.skin, cuad: !!R2.P.cuad, mods: R2.mods, etiqueta: R2.tag.textContent}); })()"), '· B activos', await ev(B, 'SMOD.ids.size'));
  await B.screenshot({ path: D + 'sm2_B_ve.png' });
  await B.keyboard.press('KeyM'); await espera(800);
  console.log('B en SM ve que lo usan:', await ev(B, `smUsan().get('${m1.id}') + ' / scp ' + smUsan().get('scp')`));
  await B.click('[data-sm="f:usan"]'); await espera(400); await B.screenshot({ path: D + 'sm3_B_usan.png' }); await B.keyboard.press('Escape'); await espera(400);
  // explosión con el mod de A (x2,5): B la recibe del mismo tamaño
  await ev(B, `window.__exp = []; const _e = explosion; explosion = function(p, r, d) { if (explosion.remota || _e.remota) window.__exp.push([+r.toFixed(1), Math.round(d)]); return _e.call(this, p, r, d); }; explosion.remota = false; 1`).catch((e) => console.log('wrap', e.message));
  await ev(A, `explosion(v3(30, 1, 30), 6, 100); 1`); await espera(2500);
  console.log('explosión que llegó a B (radio, daño):', await ev(B, 'JSON.stringify(window.__exp)'));
  // se sube un mod nuevo con ellos adentro: el server lo detecta solo
  const m3 = await publicar({ formato: 'rezobox-mod', nombre: 'Prueba SM nuevo', autor: 'Prueba', icono: '🆕', etiquetas: ['diversion'], efectos: { velocidad: 2 } }); pub.push(m3);
  await espera(31000); await ev(A, 'SRV.t = 0; 1'); await espera(5000);
  console.log('A detectó el nuevo:', await ev(A, `SRV.mods.has('${m3.id}')`), '· aviso:', await ev(A, "$('aviso').textContent"));
  // A apaga todo: vuelve a su personaje
  await A.keyboard.press('KeyM'); await espera(500); await A.click('[data-sm=ninguno]'); await espera(500); await A.keyboard.press('KeyM'); await espera(3000);
  console.log('A sin mods:', await ev(A, "JSON.stringify({ids: SMOD.ids.size, skin: JUG.skinMod, scp: NAT.scp, codigo: MODAPI.mods.length})"), '· B lo ve:', await ev(B, "[...RED.remotos.values()][0].skin + ' ' + JSON.stringify([...RED.remotos.values()][0].mods)"));
} finally {
  for (const x of pub) if (x.id) console.log('borrado', x.id, JSON.stringify(await borrar(x.id, x.clave)));
  console.log('errores:', errs.join(' | ') || 'ninguno');
  for (const x of navs) await x.close(); srv.close(); process.exit(0);
}
