// En segundo plano, todo callado (Discord, 3.1: «salís del juego y se queda el sonido en el celular»). En un celular
// emulado, jugando con todo sonando —el sonido del juego (AudioContext), un <audio> de la página (como los videos de la
// pizzería), la radio con YouTube, una maquinita con su propio AudioContext y el micrófono del chat de voz—:
//  1. la página deja de verse (lo que hace la vista web de Android en onPause: visibilityState «hidden» y el evento
//     visibilitychange; Chromium sin pantalla no oculta páginas, así que acá se da ese mismo aviso): el AudioContext
//     queda suspendido y su reloj no avanza, el <audio> en pausa, YouTube en pausa (su video no avanza), la maquinita
//     callada y el micrófono sin mandar;
//  2. vuelve a verse: todo sigue (el reloj del sonido avanza, el <audio>, YouTube y la maquinita suenan, el micrófono manda);
//  3. la app de Android lo pide con la página todavía a la vista (Web.java: __jxFondo(1) al pausarse, (0) al volver): igual;
//  4. el navegador congela la página (freeze, como Chrome con una pestaña de fondo; CDP no lo dispara en una página a la
//     vista, así que se da el aviso): se calla, y con resume sigue;
//  5. sin errores de JS.
// uso: node fondo_callado.mjs URL_HTML [CARPETA_CAPTURAS]   (YouTube necesita internet; sin internet esa parte se saltea)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, D = '/tmp'] = process.argv;
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--disable-features=IsolateOrigins,site-per-process', '--disable-site-isolation-trials'] });
const ctx = await b.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['microphone'] });
await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
const p = await ctx.newPage(); const errJS = [];
p.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
await p.goto(HTML + (HTML.includes('?') ? '&' : '?') + 'test'); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.gfx = 'patata'; GFX.auto = false; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
// lo que suena: el juego, un <audio> en la página (el sonido más largo del paquete, en bucle; se cuenta lo que avanza),
// la radio con YouTube, una maquinita y el micrófono
await ev(`(() => { audioIniciar(); AUD.ctx.resume();
  const n = DATA.son.map((x) => [x, (PK.parte('a:' + x) || []).length]).sort((a, c) => c[1] - a[1])[0][0], a = document.createElement('audio'); a.id = 'prAudio'; a.src = PK.url('a:' + n, 'audio/mpeg'); a.loop = true;
  window.__aT = 0; let ult = 0; a.addEventListener('timeupdate', () => { const t = a.currentTime; window.__aT += t >= ult ? t - ult : t; ult = t; }); document.body.appendChild(a); a.play().catch(() => {});
  entidadPonerMod('radio', true); radioCerrar(); const e = radioMia(); radioPoner(e, 'dQw4w9WgXcQ', 0, 'prueba', true); JUG.pos.set(e.b.pos.x + 2, JUG.pos.y, e.b.pos.z);
  const f = document.createElement('iframe'); f.id = 'prMaq'; f.style.cssText = 'position:fixed;left:0;top:0;width:40px;height:40px;opacity:0;pointer-events:none';
  f.srcdoc = maqConPuente('<html><head></head><body><script>window.ac = new AudioContext(); const o = ac.createOscillator(); o.connect(ac.destination); o.start();<\\/script></body></html>'); document.body.appendChild(f); MAQ.ifr = f;
  vozActivar(); return 1; })()`);
for (let i = 0; i < 40; i++) { await p.waitForTimeout(1000); if (await ev(`YT.est === 1 && !!VOZ.stream`)) break; }
await p.waitForTimeout(2000);
const yt = () => { const fr = p.frames().find((x) => /youtube/.test(x.url())); return fr ? fr.evaluate(() => { const v = document.querySelector('video'); return v ? +v.currentTime.toFixed(2) : null; }).catch(() => null) : Promise.resolve(null); };
const maq = () => { const fr = p.frames().find((x) => x !== p.mainFrame() && /about:srcdoc/.test(x.url())); return fr ? fr.evaluate(() => window.ac ? +window.ac.currentTime.toFixed(2) + ':' + window.ac.state : null).catch(() => null) : Promise.resolve(null); };
const foto = async () => ({ vis: await ev(`document.visibilityState`), ctx: await ev(`AUD.ctx.state + ':' + AUD.ctx.currentTime.toFixed(2)`), audio: await ev(`(document.getElementById('prAudio').paused ? 'pausa' : 'suena') + ':' + window.__aT.toFixed(2)`),
  ytT: await yt(), ytEst: await ev(`YT.est`), maq: await maq(), mic: await ev(`VOZ.stream ? VOZ.stream.getAudioTracks().map((t) => t.enabled).join(',') : 'sin mic'`), fondo: await ev(`typeof FONDO !== 'undefined' ? FONDO.oculto : 'sin FONDO'`) });
const avanza = (a, c) => ({ ctx: +(+c.ctx.split(':')[1] - +a.ctx.split(':')[1]).toFixed(2), audio: +(+c.audio.split(':')[1] - +a.audio.split(':')[1]).toFixed(2), yt: c.ytT !== null && a.ytT !== null ? +(c.ytT - a.ytT).toFixed(2) : null, maq: c.maq && a.maq ? +(+c.maq.split(':')[0] - +a.maq.split(':')[0]).toFixed(2) : null });
const f0 = await foto(), hayYT = f0.ytT !== null && f0.ytEst === 1;
console.log('jugando:', JSON.stringify(f0), hayYT ? '' : '(YouTube no arrancó: sin internet, esa parte no se mide)');
const callado = (d, f) => /^suspended/.test(f.ctx) && d.ctx < 0.05 && /^pausa/.test(f.audio) && d.audio < 0.05 && (!hayYT || (d.yt !== null && d.yt < 0.3)) && (d.maq === null || (d.maq < 0.05 && /suspended/.test(f.maq))) && /^false/.test(f.mic);
const suena = (d, f) => /^running/.test(f.ctx) && d.ctx > 2 && /^suena/.test(f.audio) && d.audio > 2 && (!hayYT || d.yt > 2) && (d.maq === null || d.maq > 2) && /^true/.test(f.mic);
// ---- 1: la página deja de verse ----
await ev(`Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); 1`);
await p.waitForTimeout(1500); const f1 = await foto(); await p.waitForTimeout(4000); const f1b = await foto(), d1 = avanza(f1, f1b);
ok('1. oculta: AudioContext suspendido y su reloj quieto, <audio> en pausa, YouTube en pausa, maquinita callada y micrófono sin mandar', f1.vis === 'hidden' && callado(d1, f1b), { en4s: d1, f1b });
// ---- 2: vuelve ----
await ev(`delete document.visibilityState; delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); 1`);
await p.waitForTimeout(3000); const f2 = await foto(); await p.waitForTimeout(4000); const f2b = await foto(), d2 = avanza(f2, f2b);
ok('2. vuelve: el reloj del sonido avanza, el <audio>, YouTube y la maquinita suenan, el micrófono manda', f2.vis === 'visible' && suena(d2, f2b), { en4s: d2, f2b });
// ---- 3: lo pide la app ----
await ev(`typeof __jxFondo === 'function' ? __jxFondo(1) : 0`); await p.waitForTimeout(1500); const f3 = await foto(); await p.waitForTimeout(4000); const f3b = await foto(), d3 = avanza(f3, f3b);
await ev(`typeof __jxFondo === 'function' ? __jxFondo(0) : 0`); await p.waitForTimeout(3500); const f4 = await foto(); await p.waitForTimeout(4000); const f4b = await foto(), d4 = avanza(f4, f4b);
ok('3. la app lo pide (__jxFondo 1 y 0): se calla con la página a la vista y sigue al volver', f3.vis === 'visible' && callado(d3, f3b) && suena(d4, f4b), { callada: d3, sigue: d4 });
// ---- 4: el navegador la congela (freeze/resume: Chrome con una pestaña de fondo; acá se da el aviso, como en 1) ----
await ev(`document.dispatchEvent(new Event('freeze')); 1`); await p.waitForTimeout(1500);
const f5 = await foto(); await p.waitForTimeout(4000); const f5b = await foto(), d5 = avanza(f5, f5b);
await ev(`document.dispatchEvent(new Event('resume')); 1`); await p.waitForTimeout(3500);
const f6 = await foto(); await p.waitForTimeout(4000); const f6b = await foto(), d6 = avanza(f6, f6b);
ok('4. congelada (freeze) se calla y al volver (resume) sigue', callado(d5, f5b) && suena(d6, f6b), { congelada: d5, sigue: d6 });
await p.screenshot({ path: D + '/fondo_callado.png', timeout: 60000 }).catch(() => {});
const err = errJS.filter((e) => !/WebSocket|mqtt|net::|Failed to load/i.test(e));
ok('5. sin errores de JS', !err.length, err.slice(0, 5));
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
await b.close();
process.exit(R0.every(Boolean) ? 0 : 1);
