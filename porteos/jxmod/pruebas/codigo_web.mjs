// La página con código (herramientas/codigo_web.mjs): web/index.html pide un código y el juego viene cifrado en juego.bin.
//  1. sin código: aparece el pedido, el juego no arranca y el código del juego no está en claro (ni en index.html ni en
//     juego.bin, que no es un gzip);
//  2. un código equivocado: avisa y sigue cerrado;
//  3. el código bueno (escrito en minúsculas y sin guion) abre el juego; el pedido entra en un iPhone apaisado y el campo
//     queda arriba (el teclado tapa la mitad de abajo);
//  4. al volver a abrir entra solo, sin pedir el código;
//  5. sin internet (después de la primera vez) también entra solo;
//  6. un código dado de baja: lo vuelve a pedir, avisando, y se olvida el guardado;
//  7. sin crypto.subtle (la app de iPhone, con su esquema propio, puede no tenerlo): abre igual con el cifrado en JS;
//  8. sin errores de JS.
// uso: node codigo_web.mjs URL_DE_web/index.html ARCHIVO_DE_CODIGOS [CAPTURA.png]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import fs from 'fs';
const [, , URL0, ARCH, FOTO] = process.argv;
const BUENO = fs.readFileSync(ARCH, 'utf8').split('\n').find((l) => l.trim() && !l.startsWith('#')).trim().split(/\s+/)[0];
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 600)); return ok; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: FOTO ? 2 : 1, isMobile: true, hasTouch: true, locale: 'es-AR',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
await ctx.addInitScript(() => { window.__puerta = 0; new MutationObserver(() => { if (document.getElementById('jxPuerta')) window.__puerta = 1; }).observe(document, { childList: true, subtree: true }); });
const p = await ctx.newPage(); const errJS = []; p.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
const listo = (t) => p.waitForFunction(() => window.__listo, null, { timeout: t }).then(() => true, () => false);
// 1
await p.goto(URL0); await p.waitForSelector('#jxPuerta input', { timeout: 60000 });
const arranco1 = await listo(8000);
const c1 = await p.evaluate(async () => {
  const h = await (await fetch('index.html', { cache: 'no-store' })).text(), j = new Uint8Array(await (await fetch('juego.bin', { cache: 'no-store' })).arrayBuffer());
  return { claro: /function fotoGuardar|function inicioEncajar|function puertaUsar/.test(h), jsgz: (/<script id="jsgz" type="text\/plain">([^<]*)<\/script>/.exec(h) || [, '?'])[1].length, gz: j[0] === 0x1f && j[1] === 0x8b, binMB: +(j.length / 1048576).toFixed(2), titulo: document.querySelector('#jxPuerta .t span').textContent };
});
caso('1. sin código: lo pide, el juego no arranca y no está en claro', !arranco1 && !c1.claro && c1.jsgz === 0 && !c1.gz && c1.titulo === 'Ingresá tu código', { arranco: arranco1, ...c1 });
// 2
await p.fill('#jxPuerta input', 'AAAA-BBBB'); await p.click('#jxPuerta button');
await p.waitForFunction(() => /no es/.test(document.querySelector('#jxPuerta .m').textContent), null, { timeout: 15000 }).catch(() => {});
const c2 = await p.evaluate(() => ({ msj: document.querySelector('#jxPuerta .m').textContent, sigue: !!document.getElementById('jxPuerta'), guardado: localStorage.getItem('jx_codigo') }));
caso('2. código equivocado: avisa y sigue cerrado', /no es/.test(c2.msj) && c2.sigue && !c2.guardado && !(await listo(1500)), c2);
// 3
const caja = await p.evaluate(() => { const r = (s) => { const x = document.querySelector(s).getBoundingClientRect(); return { x: Math.round(x.x), y: Math.round(x.y), w: Math.round(x.width), h: Math.round(x.height), b: Math.round(x.bottom), d: Math.round(x.right) }; }; return { card: r('#jxPuerta .c'), input: r('#jxPuerta input'), boton: r('#jxPuerta button'), vw: innerWidth, vh: innerHeight }; });
if (FOTO) { await p.fill('#jxPuerta input', ''); await p.screenshot({ path: FOTO }); }
await p.fill('#jxPuerta input', BUENO.toLowerCase().replace(/-/g, ''));
const t0 = Date.now(); await p.click('#jxPuerta button');
const ok3 = await listo(180000);
const c3 = await p.evaluate(() => ({ puerta: !!document.getElementById('jxPuerta'), menu: !!document.querySelector('#rbInicio'), guardado: (localStorage.getItem('jx_codigo') || '').length }));
const entra = caja.card.x >= 0 && caja.card.d <= caja.vw && caja.card.b <= caja.vh && caja.input.h >= 44 && caja.boton.h >= 44 && caja.input.b <= 180;
caso('3. el código bueno (minúsculas, sin guion) abre el juego; el pedido entra en el iPhone y el campo queda arriba', ok3 && !c3.puerta && c3.menu && c3.guardado === 8 && entra, { ...c3, s: ((Date.now() - t0) / 1000).toFixed(1), caja });
// 4
await p.reload(); const ok4 = await listo(180000);
caso('4. al volver a abrir entra solo', ok4 && !(await p.evaluate(() => window.__puerta)), { listo: ok4, puerta: await p.evaluate(() => window.__puerta) });
// 5 (el service worker ya guardó el juego cifrado)
const sw = await p.evaluate(async () => { const ks = await caches.keys(); const k = ks.find((x) => x.startsWith('jxmod-') && x !== 'jxmod-recursos'); return k ? (await (await caches.open(k)).keys()).map((r) => r.url.split('/').pop()) : []; });
await ctx.setOffline(true); await p.reload().catch(() => {}); const ok5 = await listo(180000);
caso('5. sin internet también entra solo (el juego cifrado quedó guardado)', ok5 && sw.includes('juego.bin') && !(await p.evaluate(() => window.__puerta)), { listo: ok5, guardados: sw });
await ctx.setOffline(false);
// 6
await p.evaluate(() => localStorage.setItem('jx_codigo', 'ZZZZ2345'));
await p.reload(); await p.waitForSelector('#jxPuerta input', { timeout: 60000 }).catch(() => {});
const c6 = await p.evaluate(() => ({ puerta: !!document.getElementById('jxPuerta'), msj: (document.querySelector('#jxPuerta .m') || {}).textContent, guardado: localStorage.getItem('jx_codigo') }));
caso('6. código dado de baja: lo vuelve a pedir, avisando, y se olvida', c6.puerta && /ya no sirve/.test(c6.msj || '') && !c6.guardado && !(await listo(3000)), c6);
// 7
const ctx2 = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, locale: 'es-AR' });
await ctx2.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
await ctx2.addInitScript(() => { window.__jxSinSubtle = 1; });
const p2 = await ctx2.newPage(); p2.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
await p2.goto(URL0); await p2.waitForSelector('#jxPuerta input', { timeout: 60000 });
await p2.fill('#jxPuerta input', 'AAAA-BBBB'); await p2.click('#jxPuerta button');
await p2.waitForFunction(() => /no es/.test(document.querySelector('#jxPuerta .m').textContent), null, { timeout: 30000 }).catch(() => {});
const mal7 = await p2.evaluate(() => document.querySelector('#jxPuerta .m').textContent);
await p2.fill('#jxPuerta input', BUENO); const t7 = Date.now(); await p2.click('#jxPuerta button');
await p2.waitForFunction(() => !document.getElementById('jxPuerta'), null, { timeout: 60000 }).catch(() => {});
const abre7 = (Date.now() - t7) / 1000;
const ok7 = await p2.waitForFunction(() => window.__listo, null, { timeout: 180000 }).then(() => true, () => false);
caso('7. sin crypto.subtle abre igual (cifrado en JS)', /no es/.test(mal7) && ok7, { mal: mal7, abreS: abre7.toFixed(1), listo: ok7 });
await ctx2.close();
const e2 = errJS.filter((e) => !/WebSocket|net::|Failed to load|Failed to fetch|NetworkError|Internet|offline/i.test(e));
caso('8. sin errores de JS', !e2.length, e2.slice(0, 4));
console.log('RESUMEN ' + RES.filter(Boolean).length + '/' + RES.length);
await b.close(); process.exit(RES.every(Boolean) ? 0 : 1);
