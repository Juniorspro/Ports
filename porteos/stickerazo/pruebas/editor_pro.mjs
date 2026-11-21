// El editor pro: deshacer/rehacer arriba, los efectos xD que se ponen y se sacan de a uno (y los lentes que se sacan de
// verdad), Forma, Fondo, Neón, Dibujar, Capas y Alinear; deshacer todo y rehacer todo; y que se guarde con su proyecto.
// uso: node editor_pro.mjs [CARPETA_FOTOS_DE_PANTALLA] (la foto: /tmp/claude-0/sz_fotos/grace_hopper.jpg)
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
const RAIZ = '/home/user/Ports/porteos/stickerazo/', WEB = RAIZ + 'web/', SAL = process.argv[2] || '/tmp/claude-0/sz_edpro', FOTO = '/tmp/claude-0/sz_fotos/grace_hopper.jpg';
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.tflite': 'application/octet-stream', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => { const f = path.join(WEB, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8995);
const { arrancar } = await import(RAIZ + 'pruebas/servidor_local.mjs'); const com = await arrancar(8996);
let fallas = 0, n = 0; const ok = (c, t, d) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); if (!c) fallas++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const err = [];
p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/status of 404|^INFO:/.test(m.text())) err.push(m.text().slice(0, 200)); });
await p.addInitScript(() => { window.SZ_API = 'http://127.0.0.1:8996'; try { localStorage.setItem('sz_bienvenida', '1'); localStorage.setItem('sz_pais', 'ar'); } catch (e) {} });
const espera = (ms) => new Promise((r) => setTimeout(r, ms)); const E = (f, a) => p.evaluate(f, a);
const foto = async (nom) => { await espera(300); await p.screenshot({ path: `${SAL}/${String(++n).padStart(2, '0')}_${nom}.png` }); };
const capas = () => E(() => window.__sz.E.st.capas.map((c) => ({ t: c.tipo, x: Math.round(c.x), y: Math.round(c.y), xd: c.xd || [], lentes: !!c.lentes, forma: c.forma || '', neon: c.neon || '', fig: c.fig || '', oculto: !!c.oculto, bloq: !!c.bloq, dibujo: !!c.dibujo })));
const hist = () => E(() => ({ des: !document.querySelector('#eDeshacer').disabled, re: !document.querySelector('#eRehacer').disabled }));
await p.goto('http://127.0.0.1:8995/index.html'); await p.waitForFunction(() => window.__sz && document.fonts.status === 'loaded');
await espera(1500); await E(() => { for (const x of document.querySelectorAll('.musicaEl')) x.remove(); });
fs.mkdirSync(SAL, { recursive: true });
// la foto → recorte → editor
const b64 = fs.readFileSync(FOTO).toString('base64');
await E(async (b64) => { const r = await fetch('data:image/jpeg;base64,' + b64); const f = new File([await r.blob()], 'grace.jpg', { type: 'image/jpeg' }); window.__sz.E.origen = 'vInicio'; await window.__sz.abrirFoto(f); }, b64);
await p.waitForFunction(() => { const E = window.__sz.E; return E.vista === 'vRecorte' && !E.ocupado && !/Buscando/.test(document.querySelector('#rAyuda').textContent); }, null, { timeout: 90000 });
await foto('recorte'); await p.click('#rSig'); try { await p.waitForFunction(() => window.__sz.E.vista === 'vEditor', null, { timeout: 15000 }); } catch (e) { await foto('trabado'); console.log('ERR', err, await E(() => window.__sz.E.vista)); process.exit(1); } await espera(800);
await foto('editor');
let h = await hist(); ok(!h.des && !h.re, 'al entrar: deshacer y rehacer apagados', h);
const barra = await E(() => [...document.querySelectorAll('#eBarra button')].map((b) => b.dataset.e));
ok(barra.length === 13 && ['dibujar', 'forma', 'fondo', 'neon', 'capas', 'alinear'].every((k) => barra.includes(k)), 'la barra tiene las herramientas nuevas (se desliza)', barra);
// mover la foto (como un gesto) → historia
const x0 = (await capas())[0].x;
await E(() => { const c = window.__sz.E.st.capas[0]; c.x += 60; window.__sz.pedirE(true); }); await espera(700);
h = await hist(); ok(h.des && !h.re, 'después de mover: se puede deshacer', h);
await p.click('#eDeshacer'); await espera(200); let L = await capas(); ok(L[0].x === x0, 'deshacer: vuelve a donde estaba', { x0, x: L[0].x });
h = await hist(); ok(!h.des && h.re, 'y ahora se puede rehacer', h);
await p.click('#eRehacer'); await espera(200); L = await capas(); ok(L[0].x === x0 + 60, 'rehacer: vuelve a moverse', L[0].x);
await E(() => { window.__sz.E.st.sel = 0; window.__sz.pedirE(true); });
// xD: de a uno
await p.click('#eBarra [data-e="xd"]'); await p.waitForSelector('#modal .opXD');
const xd = async (k) => { await p.click(`#modal .opXD[data-k="${k}"]`); await p.waitForFunction(() => !document.querySelector('#modal .opXD.girando')); await espera(150); };
const src0 = await E(() => { const c = window.__sz.E.st.capas[0]; window.__orig = c.src; return c.src.width + 'x' + c.src.height; });
await xd('ojo'); await xd('quemar'); L = await capas(); ok(JSON.stringify(L[0].xd) === '["ojo","quemar"]', 'xD: ojo de pez y quemar puestos', L[0].xd);
await foto('xd_dos');
await xd('ojo'); L = await capas(); ok(JSON.stringify(L[0].xd) === '["quemar"]', 'xD: tocar «Ojo de pez» otra vez lo saca y queda sólo quemar', L[0].xd);
await xd('lentes'); L = await capas(); ok(L.some((c) => c.lentes), 'lentes puestos', L.length);
const txt = await p.textContent('#modal .opXD[data-k="lentes"] b'); ok(txt === 'Sacar lentes', 'el botón ahora dice «Sacar lentes»', txt);
await foto('xd_lentes');
await xd('lentes'); L = await capas(); ok(!L.some((c) => c.lentes), 'tocar «Sacar lentes» los saca de verdad (no se esconden: ya no hay capa)', L.length);
await xd('lentes'); await xd('sin'); L = await capas();
const igual = await E(() => window.__sz.E.st.capas[0].src === window.__orig);
ok(!L.some((c) => c.lentes) && !L[0].xd.length && igual, '«Sacar todo»: la foto original y sin lentes', { igual, n: L.length });
await p.click('#modal [data-x="1"]'); await espera(300);
// Forma
await p.click('#eBarra [data-e="forma"]'); await p.waitForSelector('#modal .formaOp'); await p.click('#modal .formaOp[data-v="corazon"]'); await espera(200);
L = await capas(); ok(L[0].forma === 'corazon', 'Forma: la foto en corazón', L[0].forma); await foto('forma_corazon'); await p.click('#modal [data-x="1"]'); await espera(250);
// Fondo
await E(() => { window.__sz.E.st.sel = -1; window.__sz.pedirE(); });
await p.click('#eBarra [data-e="fondo"]'); await p.waitForSelector('#modal .formaOp'); await p.click('#modal .formaOp[data-v="explosion"]'); await p.click('#modal #fD [data-d="fuego"]'); await p.click('#modal #fT'); await espera(200);
L = await capas(); ok(L[0].t === 'figura' && L[0].fig === 'explosion', 'Fondo: una explosión atrás de todo, en degradé fuego con trazo', L[0]); await foto('fondo'); await p.click('#modal [data-x="1"]'); await espera(250);
// Neón a la foto
await E(() => { const s = window.__sz.E.st; s.sel = s.capas.findIndex((c) => c.tipo === 'img'); window.__sz.pedirE(); });
await p.click('#eBarra [data-e="neon"]'); await p.waitForSelector('#modal .neonC'); await p.click('#modal .neonC[data-v="#3ec7ff"]'); await espera(250);
L = await capas(); ok(L.find((c) => c.t === 'img').neon === '#3ec7ff', 'Neón celeste a la foto'); await foto('neon'); await p.click('#modal [data-x="1"]'); await espera(250);
// Dibujar: dos trazos con el dedo (mouse) y Listo
await p.click('#eBarra [data-e="dibujar"]'); await p.waitForSelector('#modal #dC'); await espera(300);
const rc = await p.locator('#eLienzo').boundingBox();
const trazo = async (pts) => { await p.mouse.move(rc.x + pts[0][0] * rc.width, rc.y + pts[0][1] * rc.height); await p.mouse.down(); for (const [x, y] of pts.slice(1)) await p.mouse.move(rc.x + x * rc.width, rc.y + y * rc.height, { steps: 6 }); await p.mouse.up(); };
await trazo([[0.2, 0.2], [0.35, 0.15], [0.5, 0.22]]); await p.click('#modal #dC [data-v="#ffd23f"]'); await trazo([[0.6, 0.7], [0.7, 0.8], [0.8, 0.7]]);
h = await hist(); ok(!(await p.isVisible('#eDeshacer')), 'dibujando, deshacer/rehacer de arriba se esconden (la hoja tiene «Trazo»)');
await foto('dibujar'); await p.click('#modal [data-x="1"]'); await espera(400);
L = await capas(); ok(L.some((c) => c.dibujo), 'el dibujo queda como capa', L.length);
// Capas
await p.click('#eBarra [data-e="capas"]'); await p.waitForSelector('#modal .capaF'); await espera(200); await foto('capas');
const nC = (await capas()).length;
await p.click(`#modal .capaF[data-i="0"] [data-a="ver"]`); await espera(150); L = await capas(); ok(L[0].oculto, 'Capas: esconder el fondo');
await p.click(`#modal .capaF[data-i="0"] [data-a="ver"]`); await espera(150);
await p.click(`#modal .capaF[data-i="1"] [data-a="dup"]`); await espera(150); L = await capas(); ok(L.length === nC + 1, 'Capas: duplicar la foto', L.length);
await p.click(`#modal .capaF[data-i="2"] [data-a="borrar"]`); await espera(150); L = await capas(); ok(L.length === nC, 'Capas: sacar la copia', L.length);
await p.click(`#modal .capaF[data-i="1"] [data-a="bloq"]`); await espera(150); L = await capas(); ok(L[1].bloq, 'Capas: trabar la foto');
const tocaTrabada = await E(() => { const s = window.__sz.E.st, c = s.capas[1]; return s.tocada(c.x, c.y); }); ok(tocaTrabada !== 1, 'trabada: tocarla no la agarra', tocaTrabada);
await p.click(`#modal .capaF[data-i="1"] [data-a="bloq"]`); await p.click('#modal [data-x="1"]'); await espera(250);
// Alinear: centrar la foto
await E(() => { const s = window.__sz.E.st; s.sel = s.capas.findIndex((c) => c.tipo === 'img' && !c.dibujo); window.__sz.pedirE(); });
await p.click('#eBarra [data-e="alinear"]'); await p.waitForSelector('#modal .opXD[data-k="c"]'); await p.click('#modal .opXD[data-k="c"]'); await espera(200);
L = await capas(); const ft = L.find((c) => c.t === 'img' && !c.dibujo); ok(ft.x === 256 && ft.y === 256, 'Alinear: la foto al centro', ft); await p.click('#modal [data-x="1"]'); await espera(500);
await foto('todo');
// deshacer todo hasta el principio y rehacer hasta el final
const pasos = await E(() => document.querySelector('#eDeshacer').disabled ? 0 : 1);
let k = 0; while (!(await E(() => document.querySelector('#eDeshacer').disabled)) && k < 80) { await p.click('#eDeshacer'); k++; }
L = await capas(); ok(L.length === 1 && L[0].t === 'img' && !L[0].forma && !L[0].neon, `deshacer ${k} veces: vuelve a la foto sola`, L);
let j = 0; while (!(await E(() => document.querySelector('#eRehacer').disabled)) && j < 80) { await p.click('#eRehacer'); j++; }
L = await capas(); ok(j === k && L.some((c) => c.t === 'figura') && L.some((c) => c.dibujo) && L.find((c) => c.t === 'img' && !c.dibujo).forma === 'corazon', `rehacer ${j} veces: todo de nuevo`, L.length);
await foto('rehecho');
// guardar
await p.click('#eGuardar'); await p.waitForSelector('#modal .emojis'); if (!(await p.$('#modal .emojis .act'))) await p.click('#modal .emojis button'); if (await p.isVisible('#gEnc')) await p.click('#gEnc');
await p.click('#modal [data-x="1"]'); await p.waitForFunction(() => window.__sz.E.vista === 'vPack' && document.querySelector('#pGrilla').children.length > 0, null, { timeout: 30000 });
const pk = await E(() => { const E = window.__sz.E, p = E.packs.find((x) => x.id === E.packId); return { n: p.stickers.length, capas: p.stickers[0].proyecto.capas.map((c) => c.tipo + (c.forma ? ':' + c.forma : '') + (c.neon ? ':neon' : '')) }; });
ok(pk.n === 1 && pk.capas.includes('img:corazon:neon') && pk.capas.includes('figura'), 'guardado con su proyecto (forma, neón, fondo, dibujo)', pk);
await foto('pack');
ok(!err.length, 'sin errores de JS', err.slice(0, 5));
console.log(`RESUMEN ${fallas ? 'con ' + fallas + ' fallas' : 'todo bien'}`); await b.close(); srv.close(); com.cerrar && com.cerrar(); process.exit(0);
