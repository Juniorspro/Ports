// La tele y la radio con YouTube cuando el navegador no deja arrancar el video solo (Discord, 3.1, iPhone: «en la versión
// de iOS no deja ver la tele»). Safari no deja que un video con sonido de otro sitio arranque sin un toque adentro de él;
// el reproductor va detrás del juego y no recibía toques, así que la tele quedaba con la tapa y el botón de play para
// siempre. Acá no hay Safari: Chromium con la regla de autoplay que pide un gesto (--autoplay-policy=user-gesture-required,
// la que reproduce lo mismo: sin un toque en el reproductor no arranca, y un toque en la página no alcanza) y la
// identidad de un iPhone. Necesita internet (YouTube).
//  1. la tele: el video no arranca solo; a los pocos segundos el reproductor pasa adelante, en el lugar de la tele, y se
//     puede tocar (con un aviso «Tocá la tele…»);
//  2. un toque en la tele (en la pantalla del juego, donde se ve) y el video arranca CON sonido (no muteado) y avanza; el
//     reproductor vuelve detrás del juego;
//  3. la radio: lo mismo, con el reproductor visible arriba y su cartel; un toque y suena;
//  4. sin errores de JS.
// uso: node tele_toque.mjs URL_HTML [CARPETA_CAPTURAS]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, D = '/tmp'] = process.argv;
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--autoplay-policy=user-gesture-required', '--mute-audio', '--disable-site-isolation-trials', '--disable-features=IsolateOrigins,site-per-process'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1' });
await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
const p = await ctx.newPage(); const errJS = [];
p.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
await p.goto(HTML + (HTML.includes('?') ? '&' : '?') + 'test'); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.gfx = 'bajo'; GFX.auto = false; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
const ytVideo = async () => { const fr = p.frames().find((x) => /youtube/.test(x.url())); return fr ? fr.evaluate(() => { const v = document.querySelector('video'); return v ? { t: +v.currentTime.toFixed(1), muted: v.muted, paused: v.paused } : null; }).catch(() => null) : null; };
const estado = () => ev(`(() => { const c = document.getElementById('ytMini'), cs = c && getComputedStyle(c), f = c && c.querySelector('iframe'), r = f && f.getBoundingClientRect();
  return JSON.stringify({ est: YT.est, toque: c ? c.classList.contains('toque') : false, ve: c ? c.classList.contains('pantVe') : false, z: cs && cs.zIndex, toca: cs && cs.pointerEvents, op: cs && cs.opacity, cartel: c && c.querySelector('.ytToque') ? c.querySelector('.ytToque').textContent : '', caja: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null, aviso: (document.getElementById('aviso') || {}).textContent || '' }); })()`).then(JSON.parse);
// ---- la tele, de frente ----
await ev(`(() => { entidadPonerMod('pantalla', true); radioCerrar(); const e = ENTS.lista.find((x) => x.t === 'pantalla' && x.dueno === 'yo'); e.b.frozen = true; window.__T = e;
  const n = e.b.q.rot(v3(0, 0, -1)); JUG.pos.set(e.b.pos.x + n.x * 4.5, JUG.pos.y, e.b.pos.z + n.z * 4.5); JUG.vel.set(0, 0, 0); JUG.yaw = Math.atan2(-n.x, -n.z); JUG.pitch = 0;
  radioPoner(e, 'dQw4w9WgXcQ', 0, 'prueba', true); return 1; })()`);
let e1 = null; for (let i = 0; i < 30; i++) { await p.waitForTimeout(1000); e1 = await estado(); if (e1.toque) break; }
const v1 = await ytVideo();
await p.screenshot({ path: D + '/tele_toque_espera.png', timeout: 60000 }).catch(() => {});
ok('1. la tele: el video no arranca solo y el reproductor pasa adelante, donde está la tele, para tocarlo', e1.toque && e1.ve && +e1.z >= 2 && e1.toca === 'auto' && (!v1 || v1.paused) && e1.est !== 1, { e1, video: v1 });
// tocar en la pantalla del juego, donde se ve la tele (el centro de su recuadro)
if (e1.caja) await p.touchscreen.tap(e1.caja[0] + e1.caja[2] / 2, e1.caja[1] + e1.caja[3] / 2);
let e2 = null; for (let i = 0; i < 45; i++) { await p.waitForTimeout(1000); e2 = await estado(); if (e2.est === 1 && !e2.toque) break; }
const v2a = await ytVideo(); await p.waitForTimeout(4000); const v2b = await ytVideo();
await p.screenshot({ path: D + '/tele_toque_suena.png', timeout: 60000 }).catch(() => {});
ok('2. un toque en la tele: arranca con sonido, avanza y el reproductor vuelve detrás del juego', e2.est === 1 && !e2.toque && v2a && v2b && !v2b.muted && v2b.t - v2a.t > 2, { e2, video: [v2a, v2b] });
// ---- la radio (otra página: cada documento necesita su propio toque) ----
await ev(`(() => { entidadQuitar(window.__T); entidadPonerMod('radio', true); radioCerrar(); const e = radioMia(); e.b.frozen = true; JUG.pos.set(e.b.pos.x + 3, JUG.pos.y, e.b.pos.z); radioPoner(e, 'dQw4w9WgXcQ', 0, 'otra', true); return 1; })()`);
await p.waitForFunction(() => window.__ev(`YT.fuente === radioMia()`), null, { timeout: 30000 }).catch(() => {});
let e3 = null; for (let i = 0; i < 30; i++) { await p.waitForTimeout(1000); e3 = await estado(); if (e3.toque || e3.est === 1) break; }
await p.screenshot({ path: D + '/radio_toque_espera.png', timeout: 60000 }).catch(() => {});
if (e3.caja && e3.toque) await p.touchscreen.tap(e3.caja[0] + e3.caja[2] / 2, e3.caja[1] + e3.caja[3] / 2);
let e4 = null; for (let i = 0; i < 45; i++) { await p.waitForTimeout(1000); e4 = await estado(); if (e4.est === 1 && !e4.toque) break; }
const v4a = await ytVideo(); await p.waitForTimeout(3000); const v4b = await ytVideo();
ok('3. la radio: el reproductor se ve arriba con su cartel; un toque y suena (con sonido) y se vuelve a esconder', e3.toque && e3.op === '1' && e3.toca === 'auto' && /Tocá|Tap/.test(e3.cartel) && e4.est === 1 && !e4.toque && v4b && !v4b.muted && v4b.t - v4a.t > 1.5, { e3, e4, video: [v4a, v4b] });
const err = errJS.filter((e) => !/WebSocket|mqtt|net::|Failed to load/i.test(e));
ok('4. sin errores de JS', !err.length, err.slice(0, 5));
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
await b.close();
process.exit(R0.every(Boolean) ? 0 : 1);
