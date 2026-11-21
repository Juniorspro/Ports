// La canción del perfil (como en Instagram) y los avatares con pegatinas: en «Editar perfil» se elige una pegatina de
// cara y una canción (el buscador de música); el perfil la muestra, al tocarla suena en una tarjeta con el reproductor
// de YouTube a la vista (200×200) y al ir a otra pestaña se corta. YouTube y su búsqueda van de mentira (sin internet).
// uso: node perfil_cancion.mjs [CARPETA_FOTOS_DE_PANTALLA]
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
const { arrancar } = await import('./servidor_local.mjs');
const SAL = process.argv[2] || '/tmp/claude-0/sz_cancion', WEB = new URL('../web/', import.meta.url).pathname; fs.mkdirSync(SAL, { recursive: true });
const COM = 8974, APP = 8975; let fallas = 0, n = 0; const ok = (c, t, d) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); if (!c) fallas++; };
await arrancar(COM);
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.webp': 'image/webp', '.png': 'image/png', '.wasm': 'application/wasm' };
const web = http.createServer((q, r) => { const f = path.join(WEB, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(APP);
const reg = await (await fetch(`http://127.0.0.1:${COM}/api/registro`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: 'con.cancion' }) })).json();
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const err = []; const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/status of 404|^INFO:/.test(m.text())) err.push(m.text().slice(0, 160)); });
await ctx.addInitScript(([api, c]) => { window.SZ_API = api; try { localStorage.setItem('sz_cuenta', JSON.stringify(c)); localStorage.setItem('sz_bienvenida', '1'); localStorage.setItem('sz_oferta_vista', String(Date.now())); } catch (e) { /* nada */ } }, [`http://127.0.0.1:${COM}`, { token: reg.token, nombre: reg.usuario.nombre, id: reg.usuario.id }]);
// (la búsqueda de YouTube y su reproductor, de mentira)
await ctx.route('**/api/yt?**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ items: [{ id: 'abcdefghijk', t: 'Canción de prueba', c: 'Banda de prueba', d: '3:21' }, { id: 'zyxwvutsrqp', t: 'Otra', c: 'Otro', d: '2:10' }] }) }));
await ctx.route('https://www.youtube.com/iframe_api', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: `window.YT={Player:function(el,o){var f=document.createElement('iframe');f.width=o.width;f.height=o.height;f.className='ytFalso';f.dataset.v=o.videoId;el.replaceWith(f);this.destroy=function(){f.remove()};this.pauseVideo=function(){};setTimeout(function(){o.events&&o.events.onStateChange&&o.events.onStateChange({data:1})},100)}};setTimeout(function(){window.onYouTubeIframeAPIReady&&window.onYouTubeIframeAPIReady()},10);` }));
await ctx.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
const espera = (ms) => new Promise((r) => setTimeout(r, ms)); const foto = async (k) => { await espera(300); await p.screenshot({ path: `${SAL}/${++n}_${k}.png` }); };
await p.goto(`http://127.0.0.1:${APP}/index.html`); await p.waitForFunction(() => window.__sz); await espera(1500);
await p.evaluate(() => { for (const x of document.querySelectorAll('.musicaEl')) x.remove(); window.__sz.pestaña('Perfil'); });
await p.waitForSelector('[data-editar]'); await espera(500);
const av0 = await p.evaluate(() => { const a = document.querySelector('#tabPerfil .avG, #tabPerfil .av'); return a ? { pega: !!a.querySelector('.pegaUI canvas'), txt: a.textContent.trim() } : null; });
ok(av0 && av0.pega && !av0.txt, 'el avatar de una cuenta nueva es una pegatina (no un emoji)', av0);
await p.click('[data-editar]'); await p.waitForSelector('#epE'); await espera(400);
const nPegas = await p.evaluate(() => document.querySelectorAll('#epE button canvas').length); ok(nPegas >= 20, `«Editar perfil»: ${nPegas} pegatinas para elegir de avatar`);
await p.click('#epE [data-v="p:ojitos"]'); await espera(200);
await p.click('#epCan'); await p.waitForSelector('.cancionEl input'); await p.fill('.cancionEl input', 'prueba'); await p.press('.cancionEl input', 'Enter'); await p.waitForSelector('.cancionEl .muIt[data-k="0"]'); await foto('elegir_cancion');
await p.click('.cancionEl .muIt[data-k="0"]'); await espera(500);
ok(/Canción de prueba/.test(await p.textContent('#epCanT')), 'elegida: la fila muestra la canción');
await foto('editar'); await p.click('#modal [data-x="1"]'); await p.waitForSelector('.cancionChip', { timeout: 10000 }); await espera(500);
const yo = await (await fetch(`http://127.0.0.1:${COM}/api/yo`, { headers: { Authorization: 'Bearer ' + reg.token } })).json();
ok(yo.usuario.cancion && yo.usuario.cancion.id === 'abcdefghijk' && yo.usuario.avatar.e === 'p:ojitos', 'guardado en el servidor: la canción y el avatar', { c: yo.usuario.cancion, e: yo.usuario.avatar.e });
await foto('perfil');
await p.click('.cancionChip'); await p.waitForSelector('.cancionTarjeta .ytFalso'); await espera(400);
const tj = await p.evaluate(() => { const f = document.querySelector('.cancionTarjeta .ytFalso'), r = f.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), v: f.dataset.v, visible: r.top >= 0 && r.bottom <= innerHeight + 400, sonando: document.querySelector('.cancionTarjeta').classList.contains('sonando') }; });
ok(tj.w >= 200 && tj.h >= 200 && tj.v === 'abcdefghijk' && tj.sonando, 'al tocarla suena en una tarjeta con el reproductor de YouTube a la vista (200×200)', tj);
await p.locator('.cancionTarjeta').scrollIntoViewIfNeeded(); await foto('sonando');
await p.evaluate(() => window.__sz.pestaña('Feed')); await espera(400);
ok(await p.evaluate(() => !document.querySelector('.cancionTarjeta') && !document.querySelector('.ytFalso')), 'al ir a otra pestaña, se corta');
ok(!err.length, 'sin errores de JS', err.slice(0, 4));
console.log(`RESUMEN ${fallas ? 'con ' + fallas + ' fallas' : 'todo bien'}`); await b.close(); web.close(); process.exit(0);
