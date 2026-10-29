import { createRequire } from 'module'; import http from 'http';
import { createRequire as _cr } from 'module'; const { chromium } = _cr(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '.', req = createRequire(S + '/mc/broker/package.json'); // carpeta con mc/broker (aedes + ws)
const [, , html] = process.argv;
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8897, '127.0.0.1', r));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const abrir = async (n) => { const c = await b.newContext({ viewport: { width: 640, height: 360 }, permissions: ['microphone'] }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 120)));
  await p.goto('file://' + html + '?test&gfx=patata&broker=ws://127.0.0.1:8897/mqtt'); await p.waitForFunction(() => window.__listo, null, { timeout: 120000 }); return p; };
const ev = (p, c) => p.evaluate((c) => window.__ev(c), c), espera = (ms) => new Promise((r) => setTimeout(r, ms));
const A = await abrir('A'), B = await abrir('B');
await ev(A, "PREFS.nombre='Ana'; PREFS.bienvenida=true; audioIniciar(); entrarSala(SALAS_OF.find((s) => s.m === 'FlatGrass')); 1");
await ev(B, "PREFS.nombre='Beto'; PREFS.bienvenida=true; audioIniciar(); entrarSala(SALAS_OF.find((s) => s.m === 'FlatGrass')); 1");
await espera(5000);
console.log('se ven:', await ev(A, "[...RED.remotos.values()].map(r=>r.nombre).join(',')"), '/', await ev(B, "[...RED.remotos.values()].map(r=>r.nombre).join(',')"));
console.log('botón del micrófono visible:', await ev(A, "$('vozBt') && $('vozBt').style.display !== 'none'"));
await ev(A, 'vozActivar()'); await espera(6000);
console.log('Ana manda a:', await ev(A, '[...VOZ.sal.keys()].length'), 'Beto recibe de:', await ev(B, '[...VOZ.ent.keys()].length'));
let nivel = 0; for (let i = 0; i < 20; i++) { nivel = Math.max(nivel, await ev(B, "(() => { const C = [...VOZ.ent.values()][0]; if (!C || !C.an) return 0; C.an.getByteTimeDomainData(C.nivel); let m = 0; for (const v of C.nivel) m = Math.max(m, Math.abs(v - 128)); return m; })()")); await espera(100); }
console.log('estado del audio de Beto:', await ev(B, 'AUD.ctx && AUD.ctx.state'), 'pista:', await ev(B, "(() => { const C = [...VOZ.ent.values()][0]; return C && C.el ? C.el.srcObject.getAudioTracks().map(t => t.readyState + '/' + t.muted).join(',') : '-'; })()"));
console.log('nivel de la voz de Ana en Beto:', nivel);
await ev(A, 'vozApagar()'); await espera(1500);
console.log('al apagar, Beto recibe de:', await ev(B, '[...VOZ.ent.keys()].length'));
console.log('errores:', errs.join(' | ') || 'ninguno');
await b.close(); srv.close(); process.exit(0);
