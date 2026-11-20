// La app entera en un celular simulado (toques de verdad por CDP): crear stickers de fotos y de texto, recortar con el
// dedo, decorar con gestos, guardar en un pack y revisar que cada archivo sea lo que pide WhatsApp
// (512×512, WebP ≤ 100 KB, fondo transparente; ícono 96×96 PNG ≤ 50 KB; 1 a 3 emojis por sticker).
// MODO=app: como en el celular: la página le habla por window.SZN (sincrónico, como la WebView) al Java de verdad
// (Almacen, en pruebas/ServidorPrueba.java) y al final se revisa lo que le contestaría el proveedor a WhatsApp.
// uso: [MODO=app] node app.mjs CARPETA_FOTOS [SALIDA=/tmp/claude-0/sz_app]
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http'; import { execFileSync, spawn } from 'child_process';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
const [, , FOTOS, SAL = '/tmp/claude-0/sz_app'] = process.argv; fs.mkdirSync(SAL, { recursive: true }); for (const f of fs.readdirSync(SAL)) if (f.endsWith('.png')) fs.unlinkSync(path.join(SAL, f));
const WEB = new URL('../web/', import.meta.url).pathname;
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.tflite': 'application/octet-stream', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const APP = process.env.MODO === 'app', PUERTO = APP ? 8984 : 8982, PUERTO_COM = APP ? 8993 : 8992;
// (la comunidad: el servidor de verdad sobre SQLite, en la compu)
const { arrancar } = await import('./servidor_local.mjs'); const com = await arrancar(PUERTO_COM);
let srv, java;
if (APP) {
  // el «celular»: el Almacen de verdad, con una carpeta de datos vacía
  const RAIZ = new URL('..', import.meta.url).pathname, CL = '/tmp/claude-0/sz_java/srv', DATOS = '/tmp/claude-0/sz_java/datos_app';
  fs.rmSync(DATOS, { recursive: true, force: true }); fs.mkdirSync(CL, { recursive: true });
  execFileSync('javac', ['--release', '8', '-Xlint:-options', '-encoding', 'UTF-8', '-d', CL, ...['Json', 'Almacen'].map((c) => `${RAIZ}android/src/com/stickerazo/app/${c}.java`), `${RAIZ}pruebas/ServidorPrueba.java`], { stdio: 'pipe' });
  java = spawn('java', ['-cp', CL, 'com.stickerazo.app.ServidorPrueba', String(PUERTO), WEB, DATOS], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok) => java.stdout.on('data', (d) => { if (/listo/.test(d)) ok(); }));
} else srv = http.createServer((q, r) => { const f = path.join(WEB, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(PUERTO);

let fallas = 0; const ok = (c, txt) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + txt); if (!c) fallas++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const err = []; const aPropósito = (u) => u.includes('..%2F'); // (el intento de colar «..» de la prueba: tiene que dar 404)
p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/^INFO:/.test(m.text()) && !(APP && /status of 404/.test(m.text()) && aPropósito(m.location().url || ''))) err.push('consola: ' + m.text().slice(0, 300) + ' ' + (m.location().url || '')); }); p.on('requestfailed', (q) => { if (!aPropósito(q.url())) err.push('falló ' + q.url()); }); p.on('response', (q) => { if (q.status() >= 400 && !aPropósito(q.url())) err.push(q.status() + ' ' + q.url()); });
const cdp = await ctx.newCDPSession(p);
await p.addInitScript((u) => { window.SZ_API = u; }, `http://127.0.0.1:${PUERTO_COM}`);
// window.SZN como el de la app (Puente.java): sincrónico, con los mismos nombres y lo mismo que devuelve
if (APP) await p.addInitScript(() => {
  const llamar = (m, a) => { const x = new XMLHttpRequest(); x.open('POST', '/szn/' + m, false); x.send(JSON.stringify(a)); if (x.status !== 200) throw new Error('SZN.' + m + ': ' + x.status); return JSON.parse(x.responseText); };
  window.SZN = {
    leerPacks: () => llamar('leerPacks', []), guardarPacks: (j) => llamar('guardarPacks', [j]), guardarArchivo: (pk, n, b64) => llamar('guardarArchivo', [pk, n, b64]),
    borrarArchivo: (pk, n) => llamar('borrarArchivo', [pk, n]), borrarPack: (pk) => llamar('borrarPack', [pk]),
    agregarAWhatsApp: (id, nombre, resp) => { llamar('agregar', [id, nombre]); setTimeout(() => window.__szResponder(resp, 'ok'), 40); },
    estaEnWhatsApp: (id) => llamar('estaEnWhatsApp', [id]), hayWhatsApp: () => true, compartir: () => true, version: () => 'prueba',
  };
});
const toque = (tipo, pts) => cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let nFoto = 0; const foto = async (nombre) => { await espera(260); await p.screenshot({ path: path.join(SAL, `${String(++nFoto).padStart(2, '0')}_${nombre}.png`) }); };
const E = (f, a) => p.evaluate(f, a);
const listoRecorte = () => p.waitForFunction(() => { const E = window.__sz.E; return E.vista === 'vRecorte' && !E.ocupado && !/Buscando/.test(document.querySelector('#rAyuda').textContent); }, null, { timeout: 60000 });
const adentro = () => E(() => { const E = window.__sz.E, d = E.mascara.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, E.W, E.H).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++; return n / (E.W * E.H); });
// de coordenadas de la foto / del sticker a la pantalla (CSS px)
const pantallaFoto = (x, y) => E(([x, y]) => { const RV = { c: document.querySelector('#rLienzo') }, r = RV.c.getBoundingClientRect(), E = window.__sz.E, d = Math.min(3, devicePixelRatio), w = r.width * d, h = r.height * d, pad = 4 * d, esc = Math.min((w - 2 * pad) / E.W, (h - 2 * pad) / E.H); return [r.left + ((w - E.W * esc) / 2 + x * esc) / d, r.top + ((h - E.H * esc) / 2 + y * esc) / d]; }, [x, y]);
const pantallaSt = (x, y) => E(([x, y]) => { const c = document.querySelector('#eLienzo'), r = c.getBoundingClientRect(), d = Math.min(3, devicePixelRatio), w = r.width * d, h = r.height * d, lado = Math.min(w, h) - 8 * d; return [r.left + ((w - lado) / 2 + (x * lado) / 512) / d, r.top + ((h - lado) / 2 + (y * lado) / 512) / d]; }, [x, y]);
async function elegirFoto(boton, archivo) { const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click(boton)]); await fc.setFiles(path.join(FOTOS, archivo)); }
async function guardar(emoji) {
  await p.click('#eGuardar'); await p.waitForSelector('#modal .emojis');
  if (emoji) await p.click(`#modal .emojis button[data-v="${emoji}"]`);
  if (await p.isVisible('#gEnc')) { console.log('     (avisó que se sale: «Que entre todo»)'); await p.click('#gEnc'); }
  await p.click('#modal [data-x="1"]'); await p.waitForFunction(() => window.__sz.E.vista === 'vPack' && document.querySelector('#pGrilla').children.length > 0);
}

await p.goto(`http://127.0.0.1:${PUERTO}/index.html`); await p.waitForFunction(() => window.__sz && document.fonts.status === 'loaded');
await E(() => new Promise((r) => { const q = indexedDB.deleteDatabase('stickerazo'); q.onsuccess = q.onerror = q.onblocked = r; }));
await p.reload(); await p.waitForFunction(() => window.__sz);
await p.waitForSelector('#feedLista .vacio'); await foto('inicio_vacio');
ok(await p.isVisible('#tabFeed') && /tranqui/.test(await p.textContent('#feedLista')), 'arranca en el feed de la comunidad (vacío: «Está todo muy tranqui»)');
await p.click('#tabs [data-t="Crear"]');

// ---------- 1: una persona (recorte automático), pincel y tocar ----------
let t0 = Date.now(); await elegirFoto('#bCrear', 'grace_hopper.jpg'); await listoRecorte();
const msAuto = Date.now() - t0, a1 = await adentro(); ok(a1 > 0.2 && a1 < 0.9, `recorte automático de una persona: ${(a1 * 100).toFixed(1)} % de la foto, ${msAuto} ms (con la carga de modelos)`);
await foto('recorte_persona');
// el pincel «Borrar» con el dedo (con la lupa), y Deshacer
await p.click('#rHerr [data-h="borrar"]');
const W = await E(() => window.__sz.E.W), H = await E(() => window.__sz.E.H);
const [bx0, by0] = await pantallaFoto(W * 0.35, H * 0.55), [bx1, by1] = await pantallaFoto(W * 0.65, H * 0.6);
await toque('touchStart', [[bx0, by0]]); for (let k = 1; k <= 12; k++) await toque('touchMove', [[bx0 + ((bx1 - bx0) * k) / 12, by0 + ((by1 - by0) * k) / 12]]);
await foto('pincel_lupa'); await toque('touchEnd', []);
const a2 = await adentro(); ok(a2 < a1 - 0.01, `Borrar con el dedo saca: ${(a1 * 100).toFixed(1)} → ${(a2 * 100).toFixed(1)} %`);
await p.click('#rHerr [data-h="deshacer"]'); const a3 = await adentro(); ok(Math.abs(a3 - a1) < 0.001, `Deshacer lo devuelve: ${(a3 * 100).toFixed(1)} %`);
// tocar el fondo lo suma; tocarlo de nuevo (ya adentro) lo saca
await p.click('#rHerr [data-h="tocar"]');
const [fx, fy] = await pantallaFoto(W * 0.06, H * 0.08); await toque('touchStart', [[fx, fy]]); await toque('touchEnd', []);
await p.waitForFunction(() => !window.__sz.E.ocupado); const a4 = await adentro(); ok(a4 > a1 + 0.01, `Tocar el fondo lo suma: ${(a1 * 100).toFixed(1)} → ${(a4 * 100).toFixed(1)} %`);
await toque('touchStart', [[fx, fy]]); await toque('touchEnd', []); await p.waitForFunction(() => !window.__sz.E.ocupado);
const a5 = await adentro(); ok(a5 < a4 - 0.01, `Tocarlo otra vez lo saca: ${(a4 * 100).toFixed(1)} → ${(a5 * 100).toFixed(1)} %`);
await p.click('#rModos [data-m="auto"]'); await p.waitForFunction(() => !window.__sz.E.ocupado);
// al editor
await p.click('#rSig'); await p.waitForFunction(() => window.__sz.E.vista === 'vEditor');
await foto('editor_foto');
await p.click('#vEditor [data-e="texto"]'); await p.fill('#tTx', 'CUANDO COMPILA\nDE UNA'); await p.click('#tF [data-v="LuckiestGuy"]'); await p.click('#tC [data-v="#ffd23f"]');
await foto('hoja_texto'); await p.click('#modal [data-x="1"]');
const tx = await E(() => { const c = window.__sz.E.st.capas.find((c) => c.tipo === 'texto'); return { x: c.x, y: c.y }; });
// arrastrar el texto con el dedo
const [sx, sy] = await pantallaSt(tx.x, tx.y), [sx2, sy2] = await pantallaSt(tx.x, tx.y - 40);
await toque('touchStart', [[sx, sy]]); for (let k = 1; k <= 8; k++) await toque('touchMove', [[sx, sy + ((sy2 - sy) * k) / 8]]); await toque('touchEnd', []);
const tx2 = await E(() => { const c = window.__sz.E.st.capas.find((c) => c.tipo === 'texto'); return { x: c.x, y: c.y }; });
ok(Math.abs(tx2.y - (tx.y - 40)) < 3 && Math.abs(tx2.x - tx.x) < 3, `arrastrar el texto: y ${tx.y.toFixed(0)} → ${tx2.y.toFixed(0)} (esperado ${(tx.y - 40).toFixed(0)})`);
// pinza de dos dedos sobre la foto: agranda y gira
await p.evaluate(() => { window.__sz.E.st.sel = -1; });
const img0 = await E(() => { const c = window.__sz.E.st.capas.find((c) => c.tipo === 'img'); return { esc: c.esc, rot: c.rot }; });
const [cx, cy] = await pantallaSt(256, 256); const R0 = 50, R1 = 62, A1 = 0.25;
await toque('touchStart', [[cx - R0, cy], [cx + R0, cy]]);
for (let k = 1; k <= 10; k++) { const r = R0 + ((R1 - R0) * k) / 10, a = (A1 * k) / 10; await toque('touchMove', [[cx - r * Math.cos(a), cy - r * Math.sin(a)], [cx + r * Math.cos(a), cy + r * Math.sin(a)]]); }
await toque('touchEnd', []);
const img1 = await E(() => { const c = window.__sz.E.st.capas.find((c) => c.tipo === 'img'); return { esc: c.esc, rot: c.rot }; });
ok(Math.abs(img1.esc / img0.esc - R1 / R0) < 0.03 && Math.abs(img1.rot - img0.rot - A1) < 0.03, `pinza: escala ×${(img1.esc / img0.esc).toFixed(3)} (esperado ×${(R1 / R0).toFixed(3)}), giro ${(img1.rot - img0.rot).toFixed(3)} (esperado ${A1})`);
await p.click('#vEditor [data-e="emoji"]'); await p.click('#modal .emojis button[data-v="😎"]');
await foto('editor_decorado');
await p.click('#eGuardar'); await p.waitForSelector('#modal .emojis'); await foto('hoja_guardar');
ok(await p.isVisible('#gEnc'), 'agrandada de más: avisa que se sale'); await p.click('#gEnc'); ok(!(await p.isVisible('#gSale')), '«Que entre todo» la acomoda'); await foto('hoja_guardar_encajado');
await p.click('#modal [data-x="1"]'); await p.waitForFunction(() => window.__sz.E.vista === 'vPack' && document.querySelector('#pGrilla .st img'));
await foto('pack_1');
ok(await p.isDisabled('#pWhats'), 'con 1 sticker «Agregar a WhatsApp» está apagado');

// ---------- 2: un perro (sin cara: recorta lo del medio) ----------
await p.click('#pMas'); await p.waitForSelector('#modal [data-x="galeria"]');
const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#modal [data-x="galeria"]')]); t0 = Date.now(); await fc.setFiles(path.join(FOTOS, 'YellowLabradorLooking_new.jpg'));
await listoRecorte(); ok((await adentro()) > 0.1, `perro: ${((await adentro()) * 100).toFixed(1)} % en ${Date.now() - t0} ms`); await foto('recorte_perro');
await p.click('#rSig'); await p.waitForFunction(() => window.__sz.E.vista === 'vEditor');
await p.click('#vEditor [data-e="texto"]'); await p.fill('#tTx', '¿Y MI MILANESA?'); await p.click('#tF [data-v="Bangers"]'); await p.click('#modal [data-x="1"]');
await p.click('#vEditor [data-e="borde"]'); await p.click('#bG [data-v="18"]'); await foto('hoja_borde');
ok(await E(() => { const c = document.querySelector('#vEditor .lienzoCont').getBoundingClientRect(), hj = document.querySelector('#modal .hoja').getBoundingClientRect(), l = document.querySelector('#eLienzo'), d = Math.min(3, devicePixelRatio), lado = (Math.min(l.width, l.height) - 8 * d) / d; return c.top + (c.height + lado) / 2 <= hj.top + 1; }), 'con la hoja del borde abierta se ve el sticker entero'); await p.click('#modal [data-x="1"]');
await guardar('🐶');

// ---------- 3: sólo texto ----------
await p.click('#pMas'); await p.click('#modal [data-x="texto"]'); await p.waitForSelector('#tTx');
await p.fill('#tTx', 'Re\nque sí'); await p.click('#tF [data-v="Pacifico"]'); await p.click('#tC [data-v="#ff3e8a"]'); await p.click('#tB [data-v="#ffffff"]'); await p.click('#modal [data-x="1"]');
await p.click('#vEditor [data-e="emoji"]'); await p.click('#modal .emojis button[data-v="🧉"]');
await foto('solo_texto'); await guardar('👍');

// ---------- 4: una hamburguesa (Entera + Borrar), y otra persona con la mano ----------
await p.click('#pMas'); const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.click('#modal [data-x="galeria"]')]); await fc2.setFiles(path.join(FOTOS, 'burger.jpg'));
await listoRecorte(); await foto('recorte_hamburguesa');
await p.click('#rSig'); await p.waitForFunction(() => window.__sz.E.vista === 'vEditor');
await p.click('#vEditor [data-e="texto"]'); await p.fill('#tTx', 'HOY NO\nME CUIDO'); await p.click('#tF [data-v="Anton"]'); await p.click('#modal [data-x="1"]');
await guardar('🍕');
await foto('pack_4');
ok(!(await p.isDisabled('#pWhats')), 'con 4 stickers «Agregar a WhatsApp» está prendido');
if (APP) {
  ok(await E(() => window.__sz && (window.SZN && true)), 'la página usa el puente de la app (window.SZN)');
  await p.click('#pWhats'); await p.waitForFunction(() => /Ya está/.test(document.querySelector('#pWhats').textContent), null, { timeout: 5000 }).catch(() => {});
  ok(/Ya está en WhatsApp/.test(await p.textContent('#pWhats')), 'después de agregarlo, el botón dice «Ya está en WhatsApp»'); await foto('pack_agregado');
} else { await p.click('#pWhats'); await p.waitForSelector('#modal .hoja'); ok(/app/.test(await p.textContent('#modal')), 'en el navegador explica que se agrega desde la app'); await p.click('#modal [data-x="1"]'); }

// ---------- 5: editar un sticker ya guardado (el perro: le cambio el texto) ----------
const packDe = () => E(() => { const E = window.__sz.E, p = E.packs.find((x) => x.id === E.packId); return JSON.parse(JSON.stringify(p)); });
const antes = await packDe(), st1 = antes.stickers[1];
await p.click('#pGrilla .st[data-n="1"]'); await p.click('#modal [data-x="editar"]'); await p.waitForFunction(() => window.__sz.E.vista === 'vEditor' && window.__sz.E.st);
const tt = await E(() => { const c = window.__sz.E.st.capas.find((c) => c.tipo === 'texto'); return { x: c.x, y: c.y }; });
const [ex, ey] = await pantallaSt(tt.x, tt.y);
for (let k = 0; k < 2; k++) { await toque('touchStart', [[ex, ey]]); await toque('touchEnd', []); await espera(80); }
await p.waitForSelector('#tTx'); ok((await p.inputValue('#tTx')) === '¿Y MI MILANESA?', 'editar: el texto guardado vuelve a aparecer, se cambia tocándolo dos veces');
await p.fill('#tTx', '¿Y MI ASADO?'); await p.click('#modal [data-x="1"]');
await p.click('#eGuardar'); await p.waitForSelector('#modal #gP');
ok(await p.isVisible('#gP [data-v="cambiar"].act'), 'editar: al guardar, lo marcado es cambiar ese mismo sticker');
await p.click('#modal [data-x="1"]'); await p.waitForFunction(() => window.__sz.E.vista === 'vPack' && document.querySelector('#modal').classList.contains('oc'), null, { timeout: 30000 });
const desp = await packDe(), st1b = desp.stickers[1];
ok(desp.stickers.length === antes.stickers.length && st1b.archivo === st1.archivo && st1b.proyecto.capas.find((c) => c.tipo === 'texto').texto === '¿Y MI ASADO?' && desp.v > antes.v,
  `editar: mismo archivo (${st1b.archivo}), texto nuevo, versión del pack ${antes.v} → ${desp.v} (WhatsApp lo vuelve a leer)`);
await foto('pack_editado');

// ---------- 6: animado de un toque, emojis según el texto, y completar a 3 ----------
await p.click('#pMas'); await p.click('#modal [data-x="texto"]'); await p.waitForSelector('#tTx');
await p.fill('#tTx', 'JAJAJA\nqué hacés'); await p.click('#tF [data-v="LuckiestGuy"]'); await p.click('#tC [data-v="#ffd23f"]'); await p.click('#tB [data-v="#111111"]'); await p.click('#modal [data-x="1"]');
await p.click('#vEditor [data-e="emoji"]'); await p.click('#modal .emojis button[data-v="🧉"]');
await E(() => { window.__sz.E.st.sel = -1; });
await p.click('#vEditor [data-e="animar"]'); await p.click('#aL [data-v="temblor"]');
await E(() => { const s = window.__sz.E.st; s.sel = s.capas.findIndex((c) => c.tipo === 'texto'); });
await p.click('#modal [data-x="1"]'); await p.click('#vEditor [data-e="animar"]'); await p.click('#aL [data-v="aparecer"]'); await foto('hoja_animar'); await p.click('#modal [data-x="1"]');
const mueve = await E(() => { const s = window.__sz.E.st, a = s.componer(0).getContext('2d').getImageData(0, 0, 512, 512).data, b = s.componer(0.5).getContext('2d').getImageData(0, 0, 512, 512).data; let n = 0; for (let i = 3; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 60) n++; return { n, anims: s.capas.map((c) => c.anim || '-').join(','), D: s.duracion() }; });
ok(mueve.n > 2000 && mueve.anims === 'aparecer,temblor', `animar: texto «Escribir» y emoji «Temblor» (${mueve.anims}, ${mueve.D} s); entre t=0 y t=0,5 cambian ${mueve.n} píxeles`);
await p.click('#eGuardar'); await p.waitForSelector('#modal #gP');
const sug = await E(() => [...document.querySelectorAll('#modal .emojis .act')].map((b) => b.dataset.v));
ok(sug.includes('🧉') && sug.includes('😂'), `emojis automáticos: «JAJAJA» y el mate → ${sug.join(' ')}`);
const opciones = await E(() => [...document.querySelectorAll('#gP button')].map((b) => b.dataset.v));
ok(opciones.length === 1 && opciones[0] === 'nuevo', 'un animado no se ofrece para el pack de quietos (WhatsApp no los mezcla): sólo «pack animado nuevo»');
await foto('guardar_animado');
t0 = Date.now(); await p.click('#modal [data-x="1"]'); await p.waitForFunction(() => window.__sz.E.vista === 'vPack' && document.querySelector('#modal').classList.contains('oc'), null, { timeout: 60000 });
const pa = await packDe(); ok(pa.animado === true && pa.stickers.length === 1 && pa.nombre === 'Mis animados', `pack animado nuevo «${pa.nombre}» con 1 sticker (armado en ${Date.now() - t0} ms)`);
ok(await p.isVisible('#pCompletar') && /2 variaciones/.test(await p.textContent('#pCompletar')), 'con 1 sticker ofrece «Completar con 2 variaciones»');
t0 = Date.now(); await p.click('#pCompletar'); await p.waitForFunction(() => { const E = window.__sz.E, x = E.packs.find((y) => y.id === E.packId); return x && x.stickers.length === 3 && document.querySelector('#modal').classList.contains('oc'); }, null, { timeout: 120000 });
const pc = await packDe(); ok(pc.stickers.length === 3 && !(await p.isVisible('#pCompletar')) && !(await p.isDisabled('#pWhats')), `completar: 3 stickers en ${Date.now() - t0} ms, ya se puede agregar a WhatsApp`);
const anims = pc.stickers.map((x) => x.proyecto.capas.map((c) => c.anim || '-').join('+')).join(' | ');
ok(new Set(pc.stickers.map((x) => JSON.stringify(x.proyecto.capas.map((c) => [c.anim, Math.round(c.x)])) + x.proyecto.colorBorde)).size === 3, `las variaciones son distintas: ${anims}`);
await espera(500); await foto('pack_animado');

// ---------- 7: solo la cara, y el cabezón que mueve la cabeza (con un globo con frase lista), al pack animado ----------
await p.click('#pMas'); const [fc3] = await Promise.all([p.waitForEvent('filechooser'), p.click('#modal [data-x="galeria"]')]); await fc3.setFiles(path.join(FOTOS, 'grace_hopper.jpg'));
await listoRecorte(); const persona = await adentro();
await p.click('#rModos [data-m="cara"]'); const cara = await adentro(); await foto('solo_cara');
ok(cara > 0.05 && cara < persona * 0.6 && await p.isVisible('#rModos [data-m="cara"].act'), `Solo cara: ${(persona * 100).toFixed(1)} % (persona) → ${(cara * 100).toFixed(1)} % (la cabeza)`);
const cajaCara = await E(() => { const E = window.__sz.E, d = E.mascara.getContext('2d').getImageData(0, 0, E.W, E.H).data; let y1 = 0, y0 = E.H; for (let y = 0; y < E.H; y++) for (let x = 0; x < E.W; x++) if (d[(y * E.W + x) * 4 + 3] > 128) { if (y < y0) y0 = y; y1 = y; } return { y0: y0 / E.H, y1: y1 / E.H }; });
ok(cajaCara.y1 < 0.75, `Solo cara: no baja al cuerpo (llega hasta el ${(cajaCara.y1 * 100).toFixed(0)} % de la foto; empieza en el ${(cajaCara.y0 * 100).toFixed(0)} %)`);
await p.click('#rModos [data-m="cabezon"]'); ok(Math.abs((await adentro()) - persona) < 0.002, 'Cabezón: vuelve a la persona entera');
await p.click('#rSig'); await p.waitForFunction(() => window.__sz.E.vista === 'vEditor');
const cz = await E(() => { const s = window.__sz.E.st, c = s.capas.find((x) => x.cabeza), b = s.capas.find((x) => x.recorte); return c && b ? { n: s.capas.length, sel: s.sel, alto: c.src.height * c.esc, ancho: c.src.width * c.esc, cuerpoAlto: b.src.height * b.esc, cuello: c.y + (c.src.height * c.esc) / 2, cuerpoArriba: b.y - (b.src.height * b.esc) / 2 } : null; });
ok(cz && cz.n === 2 && cz.sel === 1 && cz.cuello > cz.cuerpoArriba, `Cabezón: cuerpo y cabeza en dos capas (cabeza de ${cz && cz.alto.toFixed(0)} px apoyada en el cuello, tocando el cuerpo; seleccionada)`);
await p.click('#vEditor [data-e="animar"]'); await p.click('#aL [data-v="bamboleo"]'); await p.click('#modal [data-x="1"]');
await E(() => { window.__sz.E.st.sel = -1; });
await p.click('#vEditor [data-e="texto"]'); await p.click('#tI [data-v="QUÉ HACÉS"]'); await p.click('#tE [data-v="globo"]'); await foto('texto_globo'); await p.click('#modal [data-x="1"]');
const gl = await E(() => { const c = window.__sz.E.st.capas.find((x) => x.tipo === 'texto'); return { texto: c.texto, globo: c.globo, y: c.y, color: c.color }; });
ok(gl.texto === 'QUÉ HACÉS' && gl.globo && gl.y < 256 && gl.color === '#111111', `frase lista «${gl.texto}» en globo, arriba (y ${gl.y.toFixed(0)}), letras oscuras`);
await espera(400); await foto('cabezon');
await p.click('#eGuardar'); await p.waitForSelector('#modal #gP');
const opc2 = await E(() => [...document.querySelectorAll('#gP button')].map((b) => b.dataset.v + (b.classList.contains('act') ? '*' : '')));
ok(opc2.length === 2 && /\*$/.test(opc2[0]), `el cabezón animado va al pack animado que ya está (opciones: ${opc2.join(', ')})`);
t0 = Date.now(); await p.click('#modal [data-x="1"]'); await p.waitForFunction(() => window.__sz.E.vista === 'vPack' && document.querySelector('#modal').classList.contains('oc'), null, { timeout: 60000 });
const pa4 = await packDe(); ok(pa4.animado && pa4.stickers.length === 4, `pack animado con ${pa4.stickers.length} (el cabezón, ${Date.now() - t0} ms)`);
await espera(600); await foto('pack_animado_4');

// ---------- 8: pack express (5 fotos de una) ----------
await p.click('.volver:visible'); await p.waitForFunction(() => window.__sz.E.vista === 'vInicio');
await p.waitForSelector('#tabMios .packItem', { timeout: 5000 }).catch(() => {}); ok(await p.isVisible('#tabMios .packItem'), 'volver de un pack lleva a la pestaña «Mis packs»'); await p.click('#tabs [data-t="Crear"]'); await p.waitForSelector('#bExpress', { state: 'visible' });
const [fc4] = await Promise.all([p.waitForEvent('filechooser'), p.click('#bExpress')]);
ok(fc4.isMultiple(), 'Pack express: el selector deja elegir varias');
t0 = Date.now(); await fc4.setFiles(['cat.jpg', 'burger.jpg', 'pointing_up.jpg', 'thumb_up.jpg', 'portrait.jpg'].map((f) => path.join(FOTOS, f)));
await p.waitForFunction(() => document.querySelectorAll('#xL img').length >= 2, null, { timeout: 60000 }); await foto('pack_express_armando');
await p.waitForFunction(() => window.__sz.E.vista === 'vPack' && document.querySelector('#modal').classList.contains('oc'), null, { timeout: 120000 });
const px = await packDe(); ok(px.stickers.length === 5 && /^Pack express/.test(px.nombre) && px.stickers.every((x) => x.proyecto && x.proyecto.capas.length === 1), `Pack express: «${px.nombre}» con ${px.stickers.length} stickers en ${Date.now() - t0} ms (editables)`);
await espera(400); await foto('pack_express');

// ---------- 9: packs listos (nuestros, editables) y buscar ----------
await p.click('.volver:visible'); await p.click('#tabs [data-t="Listos"]');
await p.waitForFunction(() => document.querySelectorAll('#listos .listo').length >= 31 && !document.querySelector('#listos img[data-l]'), null, { timeout: 30000 });
await foto('packs_listos');
const buscarQ = async (q) => { await p.fill('#qBuscar', q); await espera(450); return E(() => ({ mios: document.querySelectorAll('#resBuscar .st').length, listos: [...document.querySelectorAll('#listos .listo .packCab > b:first-child')].map((b) => b.textContent), nada: !!document.querySelector('.nada2') })); };
const b1 = await buscarQ('mate'); ok(b1.listos.includes('Mate y facturas'), `buscar «mate»: ${b1.listos.join(', ')}`);
const b2 = await buscarQ('🧉'); ok(b2.mios >= 4 && b2.listos.includes('Mate y facturas'), `buscar «🧉»: ${b2.mios} stickers tuyos y ${b2.listos.join(', ')}`); await foto('buscar_emoji');
const b3 = await buscarQ('jaja'); ok(b3.mios >= 3 && b3.listos.includes('Animados que hablan'), `buscar «jaja» (sin importar mayúsculas): ${b3.mios} tuyos, ${b3.listos.join(', ')}`);
const b4 = await buscarQ('xyzw'); ok(b4.nada && !b4.mios && !b4.listos.length, 'buscar algo que no está: lo dice');
await p.fill('#qBuscar', ''); await espera(450);
await p.click('#listos .listo[data-l="animados"]'); await p.waitForSelector('#modal .hojaGrilla'); await p.waitForFunction(() => !document.querySelector('#modal img[data-l]'));
await foto('hoja_listo'); await p.click('#modal .hojaGrilla button[data-i="0"]'); await p.waitForFunction(() => window.__sz.E.vista === 'vEditor');
const el = await E(() => window.__sz.E.st.capas.map((c) => (c.tipo === 'texto' ? c.texto : c.ch) + ':' + (c.anim || '-')).join(' '));
ok(/JAJAJA:temblor/.test(el), `un sticker listo se abre en el editor para cambiarlo (${el})`);
await E(() => window.__szAtras()); await p.waitForSelector('#modal [data-x="1"]'); await p.click('#modal [data-x="1"]'); await p.waitForFunction(() => window.__sz.E.vista === 'vInicio');
await p.click('#listos .listo[data-l="respuestas"]'); await p.waitForSelector('#modal [data-x="1"]');
t0 = Date.now(); await p.click('#modal [data-x="1"]'); await p.waitForFunction(() => window.__sz.E.vista === 'vPack' && document.querySelector('#modal').classList.contains('oc'), null, { timeout: 120000 });
const pr = await packDe(); ok(pr.nombre === 'Respuestas al toque' && pr.stickers.length === 10 && !pr.animado && pr.stickers.every((x) => x.proyecto), `agregar un pack listo: «${pr.nombre}» con ${pr.stickers.length} stickers en ${Date.now() - t0} ms (editables)`);
await espera(400); await foto('pack_listo_agregado');

// ---------- los archivos: lo que tiene cada pack, y (como la app) lo que lee WhatsApp ----------
const r = await E(async (APP) => {
  let packs = [], arch = [], wa = null, fuentesFaltan = 0;
  if (APP) {
    const j = async (u) => (await fetch(u)).json(), traer = async (id, n) => (await fetch(`/whatsapp/stickers_asset/${id}/${n}`)).blob();
    const meta = await j('/whatsapp/metadata'); wa = { columnas: meta.columnas, filas: meta.filas, colSt: null };
    for (const fp of meta.filas) {
      const id = fp[0], st = await j('/whatsapp/stickers/' + id); wa.colSt = st.columnas;
      packs.push({ id, nombre: fp[1], v: +fp[10], animado: fp[12] === 1, stickers: st.filas.map((x) => ({ archivo: x[0], emojis: x[1].split(',') })) });
      arch.push([id, fp[3], await traer(id, fp[3])]); for (const x of st.filas) arch.push([id, x[0], await traer(id, x[0])]);
    }
    const id0 = meta.filas[0][0]; wa.una = (await j('/whatsapp/metadata/' + id0)).filas.length; wa.nada = (await j('/whatsapp/stickers/noexiste')).filas.length;
    wa.mal = (await fetch(`/whatsapp/stickers_asset/${id0}/..%2Fpacks.json`)).status;
  } else {
    const d = await new Promise((ok) => { const q = indexedDB.open('stickerazo', 1); q.onsuccess = () => ok(q.result); });
    const leer = (st) => new Promise((ok) => { const t = d.transaction(st), s = t.objectStore(st), ks = s.getAllKeys(), vs = s.getAll(); t.oncomplete = () => ok(new Map(ks.result.map((k, i) => [k, vs.result[i]]))); });
    const datos = await leer('datos'), archivos = await leer('archivos'); packs = datos.get('packs');
    for (const p of packs) {
      arch.push([p.id, p.bandeja, archivos.get(p.id + '/' + p.bandeja)]);
      for (const s of p.stickers) { arch.push([p.id, s.archivo, archivos.get(p.id + '/' + s.archivo)]); for (const f of (s.proyecto && s.proyecto.fuentes) || ['(sin proyecto)']) if (!archivos.has(p.id + '/' + f)) fuentesFaltan++; }
    }
  }
  const out = [], hoja = document.createElement('canvas'); hoja.width = 4 * 260; hoja.height = Math.ceil(arch.length / 4) * 260; const g = hoja.getContext('2d'); let i = 0;
  for (const [id, k, bl] of arch) {
    const dec = new ImageDecoder({ data: await bl.arrayBuffer(), type: bl.type }); await dec.tracks.ready;
    const n = dec.tracks.selectedTrack.frameCount; let total = 0, minMs = 1e9, c = null;
    for (let f = 0; f < n; f++) {
      const fr = (await dec.decode({ frameIndex: f })).image, ms = (fr.duration || 0) / 1000; total += ms; if (n > 1) minMs = Math.min(minMs, ms);
      if (f === 0) { c = document.createElement('canvas'); c.width = fr.displayWidth; c.height = fr.displayHeight; c.getContext('2d').drawImage(fr, 0, 0); }
      fr.close();
    }
    const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, esquinas = [0, c.width - 1, (c.height - 1) * c.width, c.height * c.width - 1].map((j) => px[j * 4 + 3]);
    let fuera = 0; if (c.width === 512) for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) if ((x < 12 || x >= 500 || y < 12 || y >= 500) && px[(y * 512 + x) * 4 + 3] > 40) fuera++;
    out.push({ id, k, tipo: bl.type, kb: +(bl.size / 1024).toFixed(1), w: c.width, h: c.height, cuadros: n, total: Math.round(total), minMs: n > 1 ? Math.round(minMs) : null, esquinas, fuera });
    const x0 = (i % 4) * 260, y0 = Math.floor(i / 4) * 260; for (let y = 0; y < 256; y += 16) for (let x = 0; x < 256; x += 16) { g.fillStyle = ((x + y) / 16) % 2 ? '#c8c8c8' : '#eeeeee'; g.fillRect(x0 + x, y0 + y, 16, 16); }
    g.drawImage(c, x0 + (256 - Math.min(256, c.width)) / 2, y0 + (256 - Math.min(256, c.height)) / 2, Math.min(256, c.width), Math.min(256, c.height)); i++;
  }
  return { packs, out, wa, fuentesFaltan, hoja: hoja.toDataURL('image/png') };
}, APP);
fs.writeFileSync(path.join(SAL, 'stickers.png'), Buffer.from(r.hoja.split(',')[1], 'base64'));
const quieto = r.packs.find((x) => x.nombre === 'Mis stickers'), animado = r.packs.find((x) => x.animado), express = r.packs.find((x) => /express/.test(x.nombre)), resp = r.packs.find((x) => /Respuestas/.test(x.nombre));
ok(r.packs.length === 4 && quieto && quieto.stickers.length === 4 && animado && animado.stickers.length === 4 && express && express.stickers.length === 5 && resp && resp.stickers.length === 10,
  `4 packs: «${quieto && quieto.nombre}» con ${quieto && quieto.stickers.length} quietos, «${animado && animado.nombre}» con ${animado && animado.stickers.length} animados, «${express && express.nombre}» con ${express && express.stickers.length} y «${resp && resp.nombre}» con ${resp && resp.stickers.length}`);
if (!APP) ok(r.fuentesFaltan === 0, `cada sticker guardó su proyecto con sus imágenes (faltan ${r.fuentesFaltan})`);
if (APP) {
  const c = r.wa.columnas, fila = (p) => r.wa.filas.find((f) => f[0] === p.id), col = (f, n) => f[c.indexOf(n)], fq = fila(quieto), fa = fila(animado);
  ok(c.length === 13 && c[0] === 'sticker_pack_identifier' && c[10] === 'image_data_version' && r.wa.colSt.join(',') === 'sticker_file_name,sticker_emoji,sticker_accessibility_text', 'WhatsApp: las columnas del contrato (13 del pack, 3 de cada sticker)');
  ok(/^[A-Za-z0-9_.\- ]{1,128}$/.test(col(fq, 'sticker_pack_identifier')) && col(fq, 'sticker_pack_publisher') === 'Stickerazo' && /\.png$/.test(col(fq, 'sticker_pack_icon')) && /\.png$/.test(col(fa, 'sticker_pack_icon')),
    `WhatsApp: ids «${col(fq, 'sticker_pack_identifier')}» y «${col(fa, 'sticker_pack_identifier')}», autor Stickerazo, íconos PNG`);
  ok(col(fq, 'animated_sticker_pack') === 0 && col(fa, 'animated_sticker_pack') === 1 && +col(fq, 'image_data_version') >= 5 && /play\.google\.com/.test(col(fq, 'android_play_store_link')),
    `WhatsApp: animated_sticker_pack 0 y 1; versión de las imágenes ${col(fq, 'image_data_version')} (subió al editar)`);
  ok(r.wa.una === 1 && r.wa.nada === 0 && r.wa.mal === 404, 'WhatsApp: metadata/<id> da 1 fila; un pack que no está, 0; un nombre con «..», 404');
}
for (const pq of r.packs) for (const s of pq.stickers) ok(s.emojis.length >= 1 && s.emojis.length <= 3, `${pq.animado ? 'animado' : 'quieto'} ${s.archivo}: emojis ${s.emojis.join(' ')}`);
for (const a of r.out) {
  const pq = r.packs.find((x) => x.id === a.id), nom = `${pq.animado ? 'animado' : 'quieto'} ${a.k}`;
  if (/bandeja/.test(a.k)) ok(a.tipo === 'image/png' && a.w === 96 && a.h === 96 && a.kb <= 50 && a.cuadros === 1, `${nom}: ${a.tipo} ${a.w}×${a.h} ${a.kb} KB, quieto`);
  else if (pq.animado) ok(a.tipo === 'image/webp' && a.w === 512 && a.h === 512 && a.kb <= 500 && a.cuadros > 1 && a.total <= 10000 && a.minMs >= 8 && a.esquinas.every((v) => v === 0) && a.fuera < 200,
    `${nom}: ${a.w}×${a.h} ${a.kb} KB (≤ 500), ${a.cuadros} cuadros, ${a.total} ms, el más corto ${a.minMs} ms, esquinas ${a.esquinas.join('/')}, margen ${a.fuera}`);
  else ok(a.tipo === 'image/webp' && a.w === 512 && a.h === 512 && a.kb <= 100 && a.cuadros === 1 && a.esquinas.every((v) => v === 0) && a.fuera < 200, `${nom}: ${a.w}×${a.h} ${a.kb} KB (≤ 100), quieto, esquinas ${a.esquinas.join('/')}, margen ${a.fuera}`);
}
// ---------- inicio con el pack, la hoja de un sticker, atrás ----------
await p.click('#pGrilla .st[data-n="1"]'); await p.waitForSelector('#modal .stGrande img'); await foto('hoja_sticker');
ok((await E(() => window.__szAtras())) === true && !(await E(() => !document.querySelector('#modal').classList.contains('oc'))), 'atrás cierra la hoja');
ok((await E(() => window.__szAtras())) === true && (await E(() => window.__sz.E.vista)) === 'vInicio', 'atrás desde el pack vuelve al inicio');
await p.waitForSelector('.packItem .tira img'); await foto('inicio_pack');
ok((await E(() => window.__szAtras())) === true && (await E(() => window.__sz.E.tab)) === 'Feed', 'atrás en «Mis packs» vuelve al feed');
ok((await E(() => window.__szAtras())) === false, 'atrás en el feed: sale de la app'); await p.click('#tabs [data-t="Crear"]'); await foto('inicio_crear');
console.log('errores de la página:', JSON.stringify(err)); if (err.length) fallas++;
console.log(fallas ? `${fallas} FALLAS` : 'TODO BIEN');
await b.close(); if (srv) srv.close(); if (java) java.kill(); com.srv.close(); process.exit(fallas ? 1 : 0);
