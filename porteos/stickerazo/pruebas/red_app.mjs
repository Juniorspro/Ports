// La zona social y el chat en la app, con dos personas en dos celulares: @ana publica con una foto, @beto la ve en
// «Social», le da me gusta, entra a su perfil y le pide amistad; @ana acepta desde el chat, le escribe, @beto le contesta
// con una pegatina, @ana la recibe sola (sin tocar nada) y denuncia un mensaje con un toque largo.
// uso: node red_app.mjs [CARPETA_FOTOS_DE_PANTALLA]
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
const { arrancar } = await import('./servidor_local.mjs');
const SAL = process.argv[2] || '/tmp/claude-0/sz_red_app', WEB = new URL('../web/', import.meta.url).pathname; fs.mkdirSync(SAL, { recursive: true });
const COM = 8966, APP = 8967; let fallas = 0, n = 0; const ok = (c, t, d) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); if (!c) fallas++; };
const { env } = await arrancar(COM);
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.webp': 'image/webp', '.png': 'image/png', '.wasm': 'application/wasm' };
const web = http.createServer((q, r) => { const f = path.join(WEB, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(APP);
const reg = async (nombre) => (await (await fetch(`http://127.0.0.1:${COM}/api/registro`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre }) })).json());
await fetch(`http://127.0.0.1:${COM}/api/config`);
const ra = await reg('ana'); await env.DB.prepare('DELETE FROM limites').run(); const rb = await reg('beto');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const err = [];
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function celu(c, nombre) {
  const ctx = await b.newContext({ viewport: { width: +(process.env.ANCHO || 393), height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([api, c]) => { window.SZ_API = api; try { localStorage.setItem('sz_cuenta', JSON.stringify(c)); localStorage.setItem('sz_bienvenida', '1'); localStorage.setItem('sz_pais', 'ar'); localStorage.setItem('sz_oferta_vista', String(Date.now())); } catch (e) { /* nada */ } }, [`http://127.0.0.1:${COM}`, { token: c.token, nombre: c.usuario.nombre, id: c.usuario.id }]);
  const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(nombre + ': ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/status of 404|^INFO:/.test(m.text())) err.push(nombre + ': ' + m.text().slice(0, 160)); });
  await p.goto(`http://127.0.0.1:${APP}/index.html`); await p.waitForFunction(() => window.__sz); await espera(1200); await p.evaluate(() => { for (const x of document.querySelectorAll('.musicaEl')) x.remove(); });
  return { p, foto: async (k) => { await espera(300); await p.screenshot({ path: `${SAL}/${String(++n).padStart(2, '0')}_${nombre}_${k}.png` }); } };
}
const A = await celu(ra, 'ana'), B = await celu(rb, 'beto');
// ---- @ana publica con una foto ----
await A.p.click('#tabs [data-t="Social"]'); await A.p.waitForSelector('#socialLista .soNuevo'); await espera(400);
await A.p.click('#socialLista .soNuevo'); await A.p.waitForSelector('#poTxt'); await A.p.fill('#poTxt', '¡Mi primera publicación en Stickerazo!');
const [fc] = await Promise.all([A.p.waitForEvent('filechooser'), A.p.click('[data-po="foto"]')]); await fc.setFiles('/tmp/claude-0/sz_fotos/burger.jpg');
await A.p.waitForSelector('#poMedia .poIt'); await A.foto('publicar');
await A.p.click('.hojaPost [data-x="1"]'); await A.p.waitForSelector('.soPost .soMedia img'); await espera(600);
ok(/primera publicación/.test(await A.p.textContent('.soPost .soTxt')), '@ana publicó: aparece arriba de todo, con la foto'); await A.foto('social');
// ---- @beto la ve, le da me gusta y le pide amistad ----
await B.p.click('#tabs [data-t="Social"]'); await B.p.waitForSelector('#socialLista .soPost'); await espera(400);
await B.p.click('.soPost .soLike'); await espera(500);
ok((await B.p.textContent('.soPost .soLike span')) === '1' && await B.p.evaluate(() => document.querySelector('.soPost .soLike').classList.contains('si')), '@beto la ve en la pestaña Comunidad y le da me gusta'); await B.foto('social_like');
await B.p.click('.soPost .autor'); await B.p.waitForSelector('#vUsuario [data-amistad]'); await espera(400); await B.foto('perfil_ana');
await B.p.click('#vUsuario [data-amistad]'); await espera(500);
ok((await B.p.getAttribute('#vUsuario [data-amistad]', 'data-amistad')) === 'enviado', 'en el perfil de @ana: «Agregar amigo» → «Pedido enviado»');
// ---- @ana: el aviso en el botón del chat, acepta ----
await A.p.reload(); await A.p.waitForFunction(() => window.__sz); await espera(2000); await A.p.evaluate(() => { for (const x of document.querySelectorAll('.musicaEl')) x.remove(); });
ok(await A.p.evaluate(() => { const b = document.querySelector('#tabs [data-t="Chat"] .badge'); return b && !b.classList.contains('oc') && b.textContent === '1'; }), '@ana tiene un aviso en el botón «Chat» de abajo (el pedido)');
await A.p.click('#tabs [data-t="Chat"]'); await A.p.waitForSelector('[data-acepta]'); await espera(300); await A.foto('chat_pedido');
await A.p.click('[data-acepta]'); await A.p.waitForSelector('[data-chat]'); await espera(300);
ok(await A.p.isVisible('[data-chat]'), 'acepta: ahora @beto está en sus chats'); await A.foto('chat_lista');
// ---- chatean ----
await A.p.click('[data-chat]'); await A.p.waitForSelector('#cvTxt'); await A.p.fill('#cvTxt', '¡Hola Beto! ¿Todo bien?'); await A.p.press('#cvTxt', 'Enter'); await A.p.waitForSelector('.cvMsg.mio');
ok(/Hola Beto/.test(await A.p.textContent('.cvMsg.mio')), '@ana le escribe');
await B.p.evaluate(() => window.__sz.ir('vInicio', true)); await B.p.click('#tabs [data-t="Chat"]'); await B.p.waitForSelector('[data-chat]'); await espera(300);
ok(/1/.test(await B.p.textContent('[data-chat] .chSinLeer').catch(() => '')), '@beto ve el chat con 1 sin leer');
await B.p.click('[data-chat]'); await B.p.waitForSelector('#cvTxt'); await B.p.click('#vConv .volver'); await espera(400);
ok(await B.p.evaluate(() => window.__sz.E.vista === 'vInicio' && window.__sz.E.tab === 'Chat' && !document.querySelector('#tabChat').classList.contains('oc')), 'volver desde una conversación: a la pestaña Chat');
await B.p.click('[data-chat]'); await B.p.waitForSelector('.cvMsg:not(.mio)'); ok(/Hola Beto/.test(await B.p.textContent('.cvMsg:not(.mio)')), '@beto lee el mensaje');
await B.p.click('#cvSt'); await B.p.waitForSelector('.hojaPega button[data-pega="risa"]'); await espera(300); await B.foto('stickers_chat');
await B.p.click('.hojaPega button[data-pega="risa"]'); await B.p.waitForSelector('.cvMsg.mio .cvPega canvas'); await B.foto('conversacion');
await A.p.waitForSelector('.cvMsg:not(.mio) .cvPega canvas', { timeout: 10000 }).catch(() => {});
ok(await A.p.isVisible('.cvMsg:not(.mio) .cvPega canvas'), '@ana recibe la pegatina sola (sin tocar nada)'); await A.foto('conversacion');
// ---- denunciar un mensaje con un toque largo ----
const box = await A.p.locator('.cvMsg:not(.mio)').last().boundingBox(); await A.p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await A.p.mouse.down(); await espera(800); await A.p.mouse.up();
await A.p.waitForSelector('#modal [data-m="spam"]', { timeout: 4000 }).catch(() => {}); ok(await A.p.isVisible('#modal [data-m="spam"]'), 'toque largo sobre un mensaje: denunciar');
await A.p.click('#modal [data-m="spam"]'); await espera(500);
const rep = await env.DB.prepare('SELECT COUNT(*) AS n FROM msg_reportes').first(); ok(rep.n === 1, 'la denuncia llega al servidor');
ok(!err.length, 'sin errores de JS', err.slice(0, 5));
console.log(`RESUMEN ${fallas ? 'con ' + fallas + ' fallas' : 'todo bien'}`); await b.close(); web.close(); process.exit(0);
