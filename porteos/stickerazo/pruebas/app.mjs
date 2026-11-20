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
const APP = process.env.MODO === 'app', PUERTO = APP ? 8984 : 8982;
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
await foto('inicio_vacio');

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
await p.click('#rHerr [data-h="auto"]'); await p.waitForFunction(() => !window.__sz.E.ocupado);
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

// ---------- los archivos ----------
const r = await E(async (APP) => {
  let packs, arch, wa = null;
  if (APP) {
    // lo que lee WhatsApp del proveedor: la fila del pack, las de los stickers y cada archivo
    const j = async (u) => (await fetch(u)).json(), meta = await j('/whatsapp/metadata'), fp = meta.filas[0], id = fp[0], st = await j('/whatsapp/stickers/' + id);
    const una = await j('/whatsapp/metadata/' + id), nada = await j('/whatsapp/stickers/noexiste');
    const traer = async (n) => [id + '/' + n, await (await fetch(`/whatsapp/stickers_asset/${id}/${n}`)).blob()];
    arch = [await traer(fp[3]), ...(await Promise.all(st.filas.map((f) => traer(f[0]))))];
    packs = meta.filas.map((f) => ({ id: f[0], nombre: f[1], v: +f[10], stickers: f[0] === id ? st.filas.map((x) => ({ archivo: x[0], emojis: x[1].split(',') })) : [] }));
    wa = { columnas: meta.columnas, fila: fp, una: una.filas.length, colSt: st.columnas, nada: nada.filas.length, mal: (await fetch(`/whatsapp/stickers_asset/${id}/..%2Fpacks.json`)).status };
  } else {
    const d = await new Promise((ok) => { const q = indexedDB.open('stickerazo', 1); q.onsuccess = () => ok(q.result); });
    const leer = (st) => new Promise((ok) => { const t = d.transaction(st), s = t.objectStore(st), ks = s.getAllKeys(), vs = s.getAll(); t.oncomplete = () => ok(ks.result.map((k, i) => [k, vs.result[i]])); });
    packs = (await leer('datos')).find(([k]) => k === 'packs')[1]; arch = await leer('archivos');
  }
  const out = [];
  const hoja = document.createElement('canvas'); hoja.width = 4 * 260; hoja.height = Math.ceil(arch.length / 4) * 260; const g = hoja.getContext('2d'); let i = 0;
  for (const [k, bl] of arch) {
    const bmp = await createImageBitmap(bl), c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const q = c.getContext('2d'); q.drawImage(bmp, 0, 0);
    const px = q.getImageData(0, 0, c.width, c.height).data, esquinas = [0, c.width - 1, (c.height - 1) * c.width, c.height * c.width - 1].map((j) => px[j * 4 + 3]);
    let fuera = 0; if (c.width === 512) for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) if ((x < 12 || x >= 500 || y < 12 || y >= 500) && px[(y * 512 + x) * 4 + 3] > 40) fuera++;
    out.push({ k, tipo: bl.type, kb: +(bl.size / 1024).toFixed(1), w: c.width, h: c.height, esquinas, fuera });
    const x0 = (i % 4) * 260, y0 = Math.floor(i / 4) * 260; for (let y = 0; y < 256; y += 16) for (let x = 0; x < 256; x += 16) { g.fillStyle = ((x + y) / 16) % 2 ? '#c8c8c8' : '#eeeeee'; g.fillRect(x0 + x, y0 + y, 16, 16); }
    g.drawImage(bmp, x0 + (256 - Math.min(256, bmp.width)) / 2, y0 + (256 - Math.min(256, bmp.height)) / 2, Math.min(256, bmp.width), Math.min(256, bmp.height)); i++;
  }
  return { packs, out, wa, hoja: hoja.toDataURL('image/png') };
}, APP);
fs.writeFileSync(path.join(SAL, 'stickers.png'), Buffer.from(r.hoja.split(',')[1], 'base64'));
const pk = r.packs[0]; ok(r.packs.length === 1 && pk.stickers.length === 4, `1 pack con ${pk.stickers.length} stickers («${pk.nombre}», v${pk.v})`);
if (APP) {
  const c = r.wa.columnas, f = r.wa.fila, col = (n) => f[c.indexOf(n)];
  ok(c.length === 13 && c[0] === 'sticker_pack_identifier' && c[10] === 'image_data_version' && r.wa.colSt.join(',') === 'sticker_file_name,sticker_emoji,sticker_accessibility_text', 'WhatsApp: las columnas del contrato (13 del pack, 3 de cada sticker)');
  ok(/^[A-Za-z0-9_.\- ]{1,128}$/.test(col('sticker_pack_identifier')) && col('sticker_pack_name') === pk.nombre && col('sticker_pack_publisher') === 'Stickerazo' && /\.png$/.test(col('sticker_pack_icon')),
    `WhatsApp: id «${col('sticker_pack_identifier')}», nombre «${col('sticker_pack_name')}», autor «${col('sticker_pack_publisher')}», ícono ${col('sticker_pack_icon')}`);
  ok(+col('image_data_version') >= 4 && col('animated_sticker_pack') === 0 && col('whatsapp_will_not_cache_stickers') === 0 && /play\.google\.com/.test(col('android_play_store_link')), `WhatsApp: versión de las imágenes ${col('image_data_version')}, sin animación, con enlace a la tienda`);
  ok(r.wa.una === 1 && r.wa.nada === 0 && r.wa.mal === 404, 'WhatsApp: metadata/<id> da 1 fila; un pack que no está, 0; un nombre con «..», 404');
}
for (const s of pk.stickers) ok(s.emojis.length >= 1 && s.emojis.length <= 3, `${s.archivo}: emojis ${s.emojis.join(' ')}`);
for (const a of r.out) {
  if (/bandeja/.test(a.k)) ok(a.tipo === 'image/png' && a.w === 96 && a.h === 96 && a.kb <= 50, `${a.k}: ${a.tipo} ${a.w}×${a.h} ${a.kb} KB`);
  else ok(a.tipo === 'image/webp' && a.w === 512 && a.h === 512 && a.kb <= 100 && a.esquinas.every((v) => v === 0) && a.fuera < 200, `${a.k}: ${a.tipo} ${a.w}×${a.h} ${a.kb} KB, esquinas transparentes ${a.esquinas.join('/')}, píxeles en el margen ${a.fuera}`);
}
// ---------- inicio con el pack, la hoja de un sticker, atrás ----------
await p.click('#pGrilla .st[data-n="1"]'); await p.waitForSelector('#modal .stGrande img'); await foto('hoja_sticker');
ok((await E(() => window.__szAtras())) === true && !(await E(() => !document.querySelector('#modal').classList.contains('oc'))), 'atrás cierra la hoja');
ok((await E(() => window.__szAtras())) === true && (await E(() => window.__sz.E.vista)) === 'vInicio', 'atrás desde el pack vuelve al inicio');
await p.waitForSelector('.packItem .tira img'); await foto('inicio_pack');
ok((await E(() => window.__szAtras())) === false, 'atrás en el inicio: sale de la app');
console.log('errores de la página:', JSON.stringify(err)); if (err.length) fallas++;
console.log(fallas ? `${fallas} FALLAS` : 'TODO BIEN');
await b.close(); if (srv) srv.close(); if (java) java.kill(); process.exit(fallas ? 1 : 0);
