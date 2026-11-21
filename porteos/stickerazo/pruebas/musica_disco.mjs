// La música en la esquina de abajo: al elegir una canción aparece el disco girando, una X arriba y el video de YouTube a
// la vista (200×200, como pide YouTube) al lado del disco; tocar el disco la pausa (el video se esconde y queda el disco
// quieto con «seguir»), tocarlo otra vez sigue, y la X la cierra. Nada tapa la barra de abajo ni se sale de la pantalla.
// YouTube y su búsqueda van de mentira (sin internet). uso: node musica_disco.mjs [CARPETA_FOTOS] (ANCHO=360 para otro celu)
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
const SAL = process.argv[2] || '/tmp/claude-0/sz_musica_disco', WEB = new URL('../web/', import.meta.url).pathname; fs.mkdirSync(SAL, { recursive: true });
const APP = 8976, ANCHO = +(process.env.ANCHO || 393); let fallas = 0, n = 0; const ok = (c, t, d) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); if (!c) fallas++; };
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.webp': 'image/webp', '.png': 'image/png', '.wasm': 'application/wasm' };
const web = http.createServer((q, r) => { const f = path.join(WEB, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(APP);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: ANCHO, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const err = []; const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/status of 404|^INFO:|Failed to load resource/.test(m.text())) err.push(m.text().slice(0, 160)); });
await ctx.addInitScript(() => { window.SZ_API = 'http://127.0.0.1:9'; try { localStorage.setItem('sz_bienvenida', '1'); localStorage.setItem('sz_pais', 'ar'); localStorage.setItem('sz_oferta_vista', String(Date.now())); } catch (e) { /* nada */ } });
// (la búsqueda y el reproductor de YouTube, de mentira: cuenta las veces que se pausa, sigue y se cierra)
await ctx.route('**/api/yt?**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ items: [{ id: 'abcdefghijk', t: 'Canción de prueba', c: 'Banda de prueba', d: '3:21' }, { id: 'zyxwvutsrqp', t: 'Otra', c: 'Otro', d: '2:10' }] }) }));
await ctx.route('https://www.youtube.com/iframe_api', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: `window.__yt={pausa:0,sigue:0,fin:0};window.YT={Player:function(el,o){var f=document.createElement('iframe');f.width=o.width;f.height=o.height;f.className='ytFalso';f.dataset.v=o.videoId;el.replaceWith(f);var e=function(d){o.events&&o.events.onStateChange&&o.events.onStateChange({data:d})};this.destroy=function(){__yt.fin++;f.remove()};this.pauseVideo=function(){__yt.pausa++;e(2)};this.playVideo=function(){__yt.sigue++;e(1)};this.loadVideoById=function(v){f.dataset.v=v;e(1)};this.cueVideoById=function(v){f.dataset.v=v};setTimeout(function(){e(1)},100)}};setTimeout(function(){window.onYouTubeIframeAPIReady&&window.onYouTubeIframeAPIReady()},10);` }));
await ctx.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
const espera = (ms) => new Promise((r) => setTimeout(r, ms)); const foto = async (k) => { await espera(450); await p.screenshot({ path: `${SAL}/${++n}_${k}.png` }); };
await p.goto(`http://127.0.0.1:${APP}/index.html`); await p.waitForFunction(() => window.__sz); await espera(1500);
await p.evaluate(() => { for (const x of document.querySelectorAll('.musicaEl')) x.remove(); });
// elegir una canción
await p.click('#botonMusica'); await p.waitForSelector('.musicaEl .muIt[data-k="0"]'); await p.click('.musicaEl .muIt[data-k="0"]');
await p.waitForSelector('.radioFlota .ytFalso'); await espera(700); await foto('sonando');
const medir = () => p.evaluate(() => {
  const el = document.querySelector('.radioFlota'), r = (s) => { const x = el && el.querySelector(s); if (!x) return null; const b = x.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), b: Math.round(b.bottom) }; };
  const caja = r('.rfCaja'), iframe = r('.ytFalso'), disco = r('.rfDisco'), x = r('.rfX'), boton = r('.rfBoton'), barra = document.querySelector('#tabs').getBoundingClientRect();
  const gira = el ? getComputedStyle(el.querySelector('.rfGira')).animationPlayState : '';
  // (¿algo de los controles tapa el video? YouTube no deja poner nada encima)
  const encima = (a) => a && caja && caja.w > 10 && a.x < caja.r && a.r > caja.x && a.y < caja.b && a.b > caja.y;
  const visibleVideo = caja && caja.w >= 200 && caja.h >= 200 && getComputedStyle(document.querySelector('.rfCaja')).opacity === '1';
  return { hay: !!el, min: el ? el.classList.contains('min') : null, caja, iframe, disco, x, boton, gira, visibleVideo, tapaVideo: !!(encima(x) || encima(boton)),
    dentro: !!el && [caja, disco, x].filter(Boolean).every((a) => a.w === 0 || (a.x >= 0 && a.r <= innerWidth && a.y >= 0)), sobreBarra: !!el && [disco, x, caja].filter(Boolean).some((a) => a.w > 0 && a.b > barra.top),
    etiqueta: el ? el.querySelector('.rfDisco').getAttribute('aria-label') : '', icono: el ? el.querySelector('.rfBoton i').dataset.i : '' };
});
let m = await medir();
ok(m.hay && !m.min && m.visibleVideo && m.iframe && m.iframe.w >= 200 && m.iframe.h >= 200, 'elegida: suena con el video de YouTube a la vista (200×200)', { caja: m.caja });
ok(m.gira === 'running' && m.icono === 'pausa' && m.etiqueta === 'Pausar', 'el disco gira, con el botón de pausa en el medio', { gira: m.gira, icono: m.icono });
ok(m.x && m.x.b <= m.caja.y + 2, 'la X está arriba', { x: m.x, caja: m.caja });
ok(!m.tapaVideo, 'ni la X ni la pausa tapan el video de YouTube');
ok(m.dentro && !m.sobreBarra, 'todo adentro de la pantalla y sin tapar la barra de abajo', { disco: m.disco });
// pausar: tocar el disco
await p.click('.radioFlota .rfDisco'); await espera(600); await foto('pausa');
m = await medir(); let yt = await p.evaluate(() => window.__yt);
ok(m.min && yt.pausa === 1 && m.caja.w === 0 && m.gira === 'paused' && m.icono === 'play' && m.etiqueta === 'Seguir', 'tocar el disco la pausa: el video se esconde y queda el disco quieto con «seguir»', { yt, caja: m.caja, gira: m.gira, icono: m.icono });
ok(m.dentro && !m.sobreBarra, 'en pausa, el disco queda en la esquina, sin tapar la barra', { disco: m.disco });
// seguir
await p.click('.radioFlota .rfDisco'); await espera(600);
m = await medir(); yt = await p.evaluate(() => window.__yt);
ok(!m.min && yt.sigue === 1 && m.visibleVideo && m.gira === 'running' && m.icono === 'pausa', 'tocarlo otra vez: sigue sonando, con el video a la vista', { yt });
// la X
await p.click('.radioFlota .rfX'); await espera(600); await foto('cerrada');
yt = await p.evaluate(() => window.__yt); m = await medir();
ok(!m.hay && yt.fin === 1, 'la X la cierra (y se apaga el reproductor)', { yt });
ok(!err.length, 'sin errores de JS', err.slice(0, 5));
console.log(`RESUMEN ${fallas ? 'con ' + fallas + ' fallas' : 'todo bien'}`); await b.close(); web.close(); process.exit(0);
