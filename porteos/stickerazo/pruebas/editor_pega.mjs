// Pegatinas (dibujos propios, por categoría) y Plantillas (con su vista previa): ponerlas, las de Premium bloqueadas sin
// Premium, y guardar el sticker con ellas. uso: node editor_pega.mjs [CARPETA_FOTOS_DE_PANTALLA]
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
const RAIZ = new URL('..', import.meta.url).pathname, WEB = RAIZ + 'web/', SAL = process.argv[2] || '/tmp/claude-0/sz_edpega', FOTO = '/tmp/claude-0/sz_fotos/grace_hopper.jpg';
fs.mkdirSync(SAL, { recursive: true });
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.tflite': 'application/octet-stream', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { const f = path.join(WEB, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8985);
const { arrancar } = await import(RAIZ + 'pruebas/servidor_local.mjs'); await arrancar(8986);
let fallas = 0, n = 0; const ok = (c, t, d) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); if (!c) fallas++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const err = [];
p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/status of 404|^INFO:/.test(m.text())) err.push(m.text().slice(0, 200)); });
await p.addInitScript(() => { window.SZ_API = 'http://127.0.0.1:8986'; try { localStorage.setItem('sz_bienvenida', '1'); localStorage.setItem('sz_pais', 'ar'); } catch (e) {} });
const espera = (ms) => new Promise((r) => setTimeout(r, ms)); const E = (f, a) => p.evaluate(f, a);
const foto = async (nom) => { await espera(300); await p.screenshot({ path: `${SAL}/${String(++n).padStart(2, '0')}_${nom}.png` }); };
await p.goto('http://127.0.0.1:8985/index.html'); await p.waitForFunction(() => window.__sz && document.fonts.status === 'loaded');
await espera(1500); await E(() => { for (const x of document.querySelectorAll('.musicaEl')) x.remove(); });
const b64 = fs.readFileSync(FOTO).toString('base64');
await E(async (b64) => { const r = await fetch('data:image/jpeg;base64,' + b64); const f = new File([await r.blob()], 'grace.jpg', { type: 'image/jpeg' }); window.__sz.E.origen = 'vInicio'; await window.__sz.abrirFoto(f); }, b64);
await p.waitForFunction(() => { const E = window.__sz.E; return E.vista === 'vRecorte' && !E.ocupado && !/Buscando/.test(document.querySelector('#rAyuda').textContent); }, null, { timeout: 90000 });
await p.click('#rSig'); await p.waitForFunction(() => window.__sz.E.vista === 'vEditor'); await espera(600);
// ---- Pegatinas ----
await p.click('#eBarra [data-e="pegatinas"]'); await p.waitForSelector('#modal .pegaOp'); await espera(300);
const cats = await E(() => [...document.querySelectorAll('#modal #pgC .chip')].map((b) => b.dataset.c));
let total = 0; for (const c of cats) { await p.click(`#modal #pgC [data-c="${c}"]`); await espera(120); total += await E(() => document.querySelectorAll('#modal .pegaOp').length); }
ok(cats.length === 5 && total >= 50, `Pegatinas: ${total} en ${cats.length} categorías (más de 50)`, cats);
const dibujadas = await E(() => [...document.querySelectorAll('#modal .pegaOp canvas')].every((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n > 500; }));
ok(dibujadas, 'cada pegatina se ve (no hay cuadros vacíos)');
await p.click('#modal #pgC [data-c="caras"]'); await espera(200); await foto('pegatinas');
await p.click('#modal .pegaOp[data-p="risa"]'); await espera(300);
let L = await E(() => window.__sz.E.st.capas.map((c) => c.pega || c.tipo));
ok(L.includes('risa') && !(await p.isVisible('#modal .hojaPega')), 'tocar una la pone en el sticker y cierra la hoja', L);
await p.click('#eBarra [data-e="pegatinas"]'); await p.waitForSelector('#modal .pegaOp'); await p.click('#modal #pgC [data-c="simbolos"]'); await espera(200);
await p.click('#modal .pegaOp[data-p="corona"]'); await espera(900);
ok(await p.isVisible('#modal .hojaPremium') && !(await E(() => window.__sz.E.st.capas.some((c) => c.pega === 'corona'))), 'sin Premium, la corona (de Premium) abre Premium y no se pone');
await E(() => { document.querySelector('#modal').className = 'modal oc'; document.querySelector('#modal').innerHTML = ''; }); await espera(200);
// ---- Plantillas ----
await p.click('#eBarra [data-e="plantillas"]'); await p.waitForSelector('#modal .plantOp'); await espera(900);
const prev = await E(() => [...document.querySelectorAll('#modal .plantOp canvas')].map((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; }));
ok(prev.length >= 12 && prev.every((n) => n > 1000), `Plantillas: ${prev.length}, todas con su vista previa`, prev.length);
await foto('plantillas');
await p.click('#modal .plantOp[data-p="cumple"]'); await espera(500);
L = await E(() => window.__sz.E.st.capas.map((c) => (c.tipo === 'texto' ? 'texto:' + c.texto + (c.curva ? ':arco' : '') : c.pega || c.tipo)));
ok(L.includes('texto:¡FELIZ CUMPLE!:arco') && L.includes('confeti') && L.includes('globoF'), 'Cumple: el texto en arco y las pegatinas de confeti y globo', L);
await foto('cumple');
await p.click('#eBarra [data-e="plantillas"]'); await p.waitForSelector('#modal .plantOp'); await p.click('#modal .plantOp[data-p="glitch"]'); await espera(900);
ok(await p.isVisible('#modal .hojaPremium') && !(await E(() => window.__sz.E.st.efecto)), 'sin Premium, la plantilla Error 404 abre Premium');
await E(() => { document.querySelector('#modal').className = 'modal oc'; document.querySelector('#modal').innerHTML = ''; }); await espera(200);
// deshacer la plantilla entera de un toque
const antes = await E(() => window.__sz.E.st.capas.length); await p.click('#eDeshacer'); await espera(200);
const despues = await E(() => window.__sz.E.st.capas.length); ok(despues === antes - 3, 'deshacer saca la plantilla entera (3 capas)', { antes, despues }); await p.click('#eRehacer'); await espera(200);
// guardar
await p.click('#eGuardar'); await p.waitForSelector('#modal .emojis'); if (!(await p.$('#modal .emojis .act'))) await p.click('#modal .emojis button'); if (await p.isVisible('#gEnc')) await p.click('#gEnc');
await p.click('#modal [data-x="1"]'); await p.waitForFunction(() => window.__sz.E.vista === 'vPack' && document.querySelector('#pGrilla').children.length > 0, null, { timeout: 60000 });
const pk = await E(() => { const E = window.__sz.E, p = E.packs.find((x) => x.id === E.packId); return p.stickers[0].proyecto.capas.filter((c) => c.pega).map((c) => c.pega); });
ok(pk.includes('risa') && pk.includes('confeti'), 'guardado con sus pegatinas en el proyecto', pk);
await foto('pack');
ok(!err.length, 'sin errores de JS', err.slice(0, 5));
console.log(`RESUMEN ${fallas ? 'con ' + fallas + ' fallas' : 'todo bien'}`); await b.close(); srv.close(); process.exit(0);
