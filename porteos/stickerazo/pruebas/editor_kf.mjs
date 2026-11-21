// El editor pro, parte 2: Movimiento (puntos clave, Premium) y Efectos de video (unos gratis, otros Premium).
// Sin Premium, Movimiento y Glitch abren la hoja de Premium; con Premium: dos puntos ◆ (uno en 0 s y otro a la mitad,
// moviendo la foto con el dedo), entre los dos se mueve sola, «Rebote», 3 s, «Que vuelva»; deshacer saca el último cambio;
// y se guarda animado (WebP animado ≤ 500 KB) con su proyecto. uso: node editor_kf.mjs [CARPETA_FOTOS_DE_PANTALLA]
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
const RAIZ = new URL('..', import.meta.url).pathname, WEB = RAIZ + 'web/', SAL = process.argv[2] || '/tmp/claude-0/sz_edkf', FOTO = '/tmp/claude-0/sz_fotos/grace_hopper.jpg';
fs.mkdirSync(SAL, { recursive: true });
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.tflite': 'application/octet-stream', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { const f = path.join(WEB, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8987);
const { arrancar } = await import(RAIZ + 'pruebas/servidor_local.mjs'); await arrancar(8988);
let fallas = 0, n = 0; const ok = (c, t, d) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); if (!c) fallas++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const err = [];
p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/status of 404|^INFO:/.test(m.text())) err.push(m.text().slice(0, 200)); });
await p.addInitScript(() => { window.SZ_API = 'http://127.0.0.1:8988'; try { localStorage.setItem('sz_bienvenida', '1'); localStorage.setItem('sz_pais', 'ar'); } catch (e) {} });
const espera = (ms) => new Promise((r) => setTimeout(r, ms)); const E = (f, a) => p.evaluate(f, a);
const foto = async (nom) => { await espera(300); await p.screenshot({ path: `${SAL}/${String(++n).padStart(2, '0')}_${nom}.png` }); };
await p.goto('http://127.0.0.1:8987/index.html'); await p.waitForFunction(() => window.__sz && document.fonts.status === 'loaded');
await espera(1500); await E(() => { for (const x of document.querySelectorAll('.musicaEl')) x.remove(); });
const b64 = fs.readFileSync(FOTO).toString('base64');
await E(async (b64) => { const r = await fetch('data:image/jpeg;base64,' + b64); const f = new File([await r.blob()], 'grace.jpg', { type: 'image/jpeg' }); window.__sz.E.origen = 'vInicio'; await window.__sz.abrirFoto(f); }, b64);
await p.waitForFunction(() => { const E = window.__sz.E; return E.vista === 'vRecorte' && !E.ocupado && !/Buscando/.test(document.querySelector('#rAyuda').textContent); }, null, { timeout: 90000 });
await p.click('#rSig'); await p.waitForFunction(() => window.__sz.E.vista === 'vEditor'); await espera(600);
// ---- sin Premium ----
await p.click('#eBarra [data-e="mov"]'); await espera(900);
ok(await p.isVisible('#modal .hojaPremium'), 'sin Premium: Movimiento abre la hoja de Premium'); await foto('mov_sin_premium');
await E(() => { document.querySelector('#modal').className = 'modal oc'; document.querySelector('#modal').innerHTML = ''; }); await espera(200);
await p.click('#eBarra [data-e="efectos"]'); await p.waitForSelector('#modal #vfL');
const coronas = await E(() => document.querySelectorAll('#modal #vfL .corona').length); ok(coronas >= 6, 'Efectos: los de Premium con 👑', coronas);
await foto('efectos');
await p.click('#modal #vfL [data-v="temblor"]'); await espera(200);
ok(await E(() => window.__sz.E.st.efecto === 'temblor' && window.__sz.E.st.animado()), 'Temblor (gratis): puesto, y el sticker queda animado');
await p.click('#modal #vfL [data-v="glitch"]'); await espera(900);
ok(await p.isVisible('#modal .hojaPremium') && await E(() => window.__sz.E.st.efecto === 'temblor'), 'Glitch sin Premium: abre Premium y no lo pone');
await E(() => { document.querySelector('#modal').className = 'modal oc'; document.querySelector('#modal').innerHTML = ''; }); await espera(200);
// ---- con Premium ----
await p.route('**/api/premium', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ disponible: true, precios: { mes: '1.99', anio: '14.99', vida: '29.99' }, beneficios: [], yo: { premium: true, tipo: 'vida', hasta: Date.now() + 1e11 } }) }));
await E(async () => { localStorage.setItem('sz_cuenta', JSON.stringify({ nombre: 'prueba', token: 'x' })); await window.__sz.C.cargarPremium(); });
ok(await E(() => window.__sz.C.esPremium()), 'ahora es Premium');
await E(() => { const s = window.__sz.E.st; delete s.efecto; s.sel = s.capas.findIndex((c) => c.tipo === 'img'); window.__sz.pedirE(true); });
await p.click('#eBarra [data-e="mov"]'); await p.waitForSelector('#modal #kPista'); await espera(300);
await p.click('#modal #kPunto'); await espera(200);
let kf = await E(() => (window.__sz.E.st.capas[window.__sz.E.st.sel].kf || []).map((f) => ({ t: f.t, x: Math.round(f.x) })));
ok(kf.length === 1 && kf[0].t === 0, '◆ Punto en 0 s', kf);
// el cabezal a la mitad (tocar la pista) y mover la foto con el dedo
const pb = await p.locator('#modal #kPista').boundingBox(); await p.mouse.click(pb.x + pb.width * 0.5, pb.y + pb.height / 2); await espera(200);
const t = await E(() => window.__sz.E.kf.t); ok(Math.abs(t - 0.5) < 0.03, 'el cabezal a la mitad', t);
const rc = await p.locator('#eLienzo').boundingBox(), cx = rc.x + rc.width / 2, cy = rc.y + rc.height / 2;
await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + 70, cy - 30, { steps: 8 }); await p.mouse.up(); await espera(700);
kf = await E(() => (window.__sz.E.st.capas[window.__sz.E.st.sel].kf || []).map((f) => ({ t: f.t, x: Math.round(f.x), y: Math.round(f.y) })));
ok(kf.length === 2 && kf[1].t > 0.45 && kf[1].x > kf[0].x + 30, 'mover la foto con el cabezal a la mitad deja un segundo punto ◆ (corrida)', kf);
const medio = await E(() => { const s = window.__sz.E.st, c = s.capas[s.sel]; return Math.round(s.pose(c, 0.25).x); });
ok(medio > kf[0].x && medio < kf[1].x, 'a un cuarto, está entre los dos puntos', { medio });
const nPuntos = await E(() => document.querySelectorAll('#modal .kfP').length); ok(nPuntos === 2, 'la pista muestra los dos ◆', nPuntos);
await p.click('#modal #kEase [data-e="rebote"]'); await p.click('#modal #kDur [data-d="3"]'); await espera(200);
const est = await E(() => { const s = window.__sz.E.st, c = s.capas[s.sel]; return { ease: c.kf[1].ease, dur: s.kfDur, D: s.duracion() }; });
ok(est.ease === 'rebote' && est.dur === 3 && est.D === 3, '«Rebote» en el punto y dura 3 s', est);
await p.click('#modal #kBucle'); await espera(200);
kf = await E(() => window.__sz.E.st.capas[window.__sz.E.st.sel].kf.map((f) => ({ t: f.t, x: Math.round(f.x) })));
ok(kf.length === 3 && kf[2].t === 1 && kf[2].x === kf[0].x, '«Que vuelva»: un punto al final igual al primero', kf);
await p.click('#modal #kPlay'); await espera(700); const avanza = await E(() => window.__sz.E.kf.t); ok(avanza > 0.05 && avanza < 1, 'Reproducir: el cabezal avanza', avanza);
await foto('movimiento'); await p.click('#modal #kPlay');
await p.click('#modal [data-x="1"]'); await espera(800);
ok(await E(() => !window.__sz.E.kf && window.__sz.E.st.animado()), 'Listo: el sticker queda animado con el movimiento');
// deshacer: saca «Que vuelva»
await p.click('#eDeshacer'); await espera(200);
const nk = await E(() => { const s = window.__sz.E.st, c = s.capas.find((x) => x.tipo === 'img' && !x.lentes); return c.kf ? c.kf.length : 0; });
ok(nk === 2, 'deshacer saca el último punto', nk); await p.click('#eRehacer'); await espera(200);
// Glitch con Premium, y guardar animado
await p.click('#eBarra [data-e="efectos"]'); await p.waitForSelector('#modal #vfL'); await p.click('#modal #vfL [data-v="glitch"]'); await espera(300);
ok(await E(() => window.__sz.E.st.efecto === 'glitch'), 'Glitch con Premium: puesto'); await foto('glitch'); await p.click('#modal [data-x="1"]'); await espera(300);
await p.click('#eGuardar'); await p.waitForSelector('#modal .emojis'); if (!(await p.$('#modal .emojis .act'))) await p.click('#modal .emojis button'); if (await p.isVisible('#gEnc')) await p.click('#gEnc');
const t0 = Date.now(); await p.click('#modal [data-x="1"]'); try { await p.waitForFunction(() => window.__sz.E.vista === 'vPack' && document.querySelector('#pGrilla').children.length > 0, null, { timeout: 150000 }); } catch (e) { await foto('trabado'); console.log('TRABADO', (Date.now() - t0) / 1000, await E(() => [window.__sz.E.vista, document.querySelector('#aviso').textContent, document.querySelector('#modal').innerText.slice(0, 200)]), err); process.exit(1); }
const pk = await E(() => { const E = window.__sz.E, p = E.packs.find((x) => x.id === E.packId); const st = p.stickers[0]; return { animado: !!p.animado, kb: st.kb || st.bytes || null, efecto: st.proyecto.efecto, kfDur: st.proyecto.kfDur, kf: (st.proyecto.capas.find((c) => c.kf) || {}).kf?.length }; });
ok(pk.animado && pk.efecto === 'glitch' && pk.kfDur === 3 && pk.kf === 3, `guardado animado en ${((Date.now() - t0) / 1000).toFixed(1)} s, con el movimiento y el efecto en su proyecto`, pk);
await foto('pack');
ok(!err.length, 'sin errores de JS', err.slice(0, 5));
console.log(`RESUMEN ${fallas ? 'con ' + fallas + ' fallas' : 'todo bien'}`); await b.close(); srv.close(); process.exit(0);
