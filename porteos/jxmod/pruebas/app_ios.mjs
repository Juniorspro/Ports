// La app web instalable para iPhone/iPad (web/index.html, armada con PK_BIN=1 APP_WEB=1 + herramientas/web_app.py).
// En Chromium con lo de un iPhone (pantalla, toque, el navegador que dice ser Safari de iOS 17): acá no hay WebKit, así
// que esto prueba el juego y la app web, no las rarezas de Safari.
//  1. arranca como iPhone: calidad Media de entrada, DirectX 90 (como celular), la página marcada como iOS; el pellizco no
//     hace zoom; el manifiesto (pantalla completa, horizontal) y los íconos de inicio (180 para iOS, 192 y 512) cargan;
//  2. en Safari sin instalar aparece cómo instalarla (Compartir → «Agregar a inicio») y «Listo» lo saca para siempre;
//  3. el service worker queda guardando el juego (index.html y pk.bin);
//  4. sin internet: se jugó una vez gm_construct con internet; cortado internet, la app vuelve a abrir y esa partida anda;
//  5. sin errores de JS.
// uso: node app_ios.mjs URL_DE_web/index.html
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , URL0] = process.argv;
const caso = (n, ok, info) => { console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 600)); return ok; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
// (con la página con código: JX_CODIGO=un código de la lista, como si ya se hubiera puesto una vez)
if (process.env.JX_CODIGO) await ctx.addInitScript((c) => { try { if (!localStorage.getItem('jx_codigo')) localStorage.setItem('jx_codigo', c); } catch (e) {} }, process.env.JX_CODIGO.toUpperCase().replace(/[^A-Z0-9]/g, ''));
await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
const p = await ctx.newPage(); const errJS = [];
p.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
const abrir = async () => { await p.goto(URL0); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 }); };
let bien = 0, tot = 0;
await abrir();
await p.waitForTimeout(4800);
const c1 = await ev(`(async () => {
  const m = document.querySelector('link[rel=manifest]'), ap = document.querySelector('link[rel=apple-touch-icon]');
  const man = m ? await (await fetch(m.href)).json() : null;
  const tam = async (u) => { const im = new Image(); im.src = new URL(u, location.href).href; await im.decode().catch(() => {}); return im.naturalWidth + 'x' + im.naturalHeight; };
  const iconos = man ? await Promise.all(man.icons.map((i) => tam(i.src))) : [];
  const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g);
  return { ios: IOS, ipad: IOS_IPAD, clase: document.documentElement.classList.contains('ios'), calidad: GFX.nombre, dx: gmrtSM3() ? 95 : 90, pellizco: g.defaultPrevented,
    manifiesto: man && { display: man.display, orientation: man.orientation, start: man.start_url }, iconos, apple: ap ? await tam(ap.getAttribute('href')) : null,
    aviso: (document.getElementById('iosInst') || {}).innerText || null };
})()`);
tot++; if (caso('1. arranca como iPhone (Media, DirectX 90), sin zoom al pellizcar, manifiesto e íconos', c1.ios && !c1.ipad && c1.clase && c1.calidad === 'medio' && c1.dx === 90 && c1.pellizco && c1.manifiesto && c1.manifiesto.display === 'fullscreen' && c1.manifiesto.orientation === 'landscape' && c1.iconos.join() === '192x192,512x512,512x512' && c1.apple === '180x180', c1)) bien++;
await p.click('#iosInst button').catch(() => {});
await p.waitForTimeout(300);
const c2 = await ev(`({ sigue: !!document.getElementById('iosInst'), guardado: !!localStorage.getItem('jx_ios_aviso') })`);
tot++; if (caso('2. el aviso de cómo instalarla en Safari, y «Listo» lo saca', /Agregar a inicio/.test(c1.aviso || '') && !c2.sigue && c2.guardado, { aviso: c1.aviso, ...c2 })) bien++;
// (el service worker toma la página en la próxima apertura)
await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.ready.then(() => true), null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(3000);
await abrir();
const c3 = await p.evaluate(async () => { const ks = await caches.keys(), v = ks.find((k) => /^jxmod-[0-9a-f]{12}$/.test(k)); const c = v && await caches.open(v); const tiene = c ? (await c.keys()).map((r) => r.url.split('/').pop()) : [];
  return { controla: !!navigator.serviceWorker.controller, caches: ks, tiene }; });
tot++; if (caso('3. el service worker guarda el juego (index.html, pk.bin, íconos)', c3.controla && c3.tiene.includes('index.html') && c3.tiene.includes('pk.bin') && c3.tiene.includes('icono-180.png'), c3)) bien++;
// 4: una partida con internet (así se guarda lo que baja de rb/), después sin internet
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; guardarPrefs(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 180000 });
await p.waitForTimeout(3000);
const recursos = await p.evaluate(async () => (await (await caches.open('jxmod-recursos')).keys()).length);
await ctx.setOffline(true);
await abrir();
const sinRed = await ev(`({ listo: !!window.__listo, online: navigator.onLine })`);
await ev(`inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
const jugo = await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 180000 }).then(() => true).catch(() => false);
await p.waitForFunction(() => !window.__intro || window.__intro.fin, null, { timeout: 90000 }).catch(() => {});
await p.waitForTimeout(2500);
const c4 = await ev(`({ estado: JUEGO.estado, mapa: MUNDO.nombre, tris: MUNDO.TN ? MUNDO.TN.length / 3 : 0 })`);
await p.screenshot({ path: '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad/ios_sin_red.png', timeout: 120000 }).catch(() => {});
await ctx.setOffline(false);
tot++; if (caso('4. sin internet la app abre y la partida que ya se jugó anda', sinRed.listo && !sinRed.online && jugo && c4.tris > 1000, { recursosGuardados: recursos, sinRed, ...c4 })) bien++;
const err = errJS.filter((e) => !/WebSocket|net::|Failed to load|Failed to fetch|NetworkError|Load failed/i.test(e));
tot++; if (caso('5. sin errores de JS', !err.length, { err: err.slice(0, 6) })) bien++;
console.log('RESUMEN ' + bien + '/' + tot);
await b.close();
process.exit(bien === tot ? 0 : 1);
