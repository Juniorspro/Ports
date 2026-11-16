// consolitas 3.8: subir varios a la vez (un .html suelto, un .zip de varios archivos, uno pesado de 30 MB, una carpeta,
// un .zip roto y uno sin HTML), con la pestaña «Subiendo» y su avance; el juego de varios archivos corre entero (script,
// estilos con url() y @import, imagen del HTML, fetch, XHR y una imagen que arma su código); los pesados se guardan
// aparte (la lista no los carga); la foto de tapa (lista, gabinete y la que va a la comunidad); el límite de la
// comunidad avisa claro; la pantalla grande toma la forma del juego; una biblioteca vieja (versión 1) se sigue viendo.
// uso: node maq_subir.mjs HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs'; import zlib from 'zlib';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/', TMP = D + 'subir/';
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP + 'carpeta/img', { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };

// --- los archivos de prueba ---
function png(w, h, rgb) {   // (un PNG de un color, hecho a mano)
  const crc = (b) => zlib.crc32(b), ch = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td) >>> 0); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(rgb, y * (w * 3 + 1) + 1 + x * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', zlib.deflateSync(raw)), ch('IEND', Buffer.alloc(0))]);
}
function zip(A) {   // (deflate en todos menos en los .png, que van tal cual: así se prueban los dos métodos)
  const loc = [], cen = []; let o = 0;
  for (const [n, d0] of Object.entries(A)) {
    const d = Buffer.from(d0), guarda = n.endsWith('.png'), c = guarda ? d : zlib.deflateRawSync(d), nb = Buffer.from(n), h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(guarda ? 0 : 8, 8); h.writeUInt32LE(zlib.crc32(d) >>> 0, 14); h.writeUInt32LE(c.length, 18); h.writeUInt32LE(d.length, 22); h.writeUInt16LE(nb.length, 26);
    const ce = Buffer.alloc(46); ce.writeUInt32LE(0x02014b50, 0); ce.writeUInt16LE(20, 4); ce.writeUInt16LE(20, 6); ce.writeUInt16LE(guarda ? 0 : 8, 10); ce.writeUInt32LE(zlib.crc32(d) >>> 0, 16); ce.writeUInt32LE(c.length, 20); ce.writeUInt32LE(d.length, 24); ce.writeUInt16LE(nb.length, 28); ce.writeUInt32LE(o, 42);
    loc.push(h, nb, c); cen.push(ce, nb); o += 30 + nb.length + c.length;
  }
  const cb = Buffer.concat(cen), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(cen.length / 2, 8); e.writeUInt16LE(cen.length / 2, 10); e.writeUInt32LE(cb.length, 12); e.writeUInt32LE(o, 16);
  return Buffer.concat([...loc, cb, e]);
}
// el juego de varios archivos: cuenta todo lo que pudo cargar y dibuja algo que se mueve (para la pantalla del gabinete)
const INDEX = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="css/estilo.css"><script src="js/juego.js"></script></head>
<body><canvas id="c" width="640" height="360"></canvas><img id="logo" src="./img/logo.png"><script>
addEventListener('load', async function () {
  var r = { js: window.JUEGO_OK === 42, css: getComputedStyle(document.body).backgroundImage.slice(0, 15), color: getComputedStyle(document.body).color,
    importado: getComputedStyle(document.getElementById('c')).borderTopColor, logo: document.getElementById('logo').naturalWidth };
  try { r.json = (await (await fetch('datos/nivel.json')).json()).nivel; } catch (e) { r.json = 'falla'; }
  var im = new Image(); im.onload = function () { r.dinamica = im.naturalWidth; xhr(); }; im.onerror = function () { r.dinamica = 'falla'; xhr(); }; im.src = 'img/sprite.png?v=2';
  function xhr() { var x = new XMLHttpRequest(); x.open('GET', '/datos/texto.txt'); x.onload = function () { r.xhr = x.responseText; parent.postMessage({ rbPruebaZip: r }, '*'); }; x.onerror = function () { r.xhr = 'falla'; parent.postMessage({ rbPruebaZip: r }, '*'); }; x.send(); }
  var g = document.getElementById('c').getContext('2d'), t = 0; (function f() { t++; g.fillStyle = 'hsl(' + (t * 3 % 360) + ',80%,50%)'; g.fillRect(0, 0, 640, 360); g.fillStyle = '#fff'; g.fillRect(40 + (t * 4) % 560, 150, 60, 60); requestAnimationFrame(f); })();
});
</script></body></html>`;
const ARCH = {
  'MiJuego/index.html': INDEX,
  'MiJuego/otra/pagina.html': '<!doctype html><p>no soy el principal</p>',
  'MiJuego/js/juego.js': 'window.JUEGO_OK = 42;',
  'MiJuego/css/estilo.css': '@import "extra.css";\nbody{background-image:url(../img/fondo.png);color:rgb(1, 2, 3)}',
  'MiJuego/css/extra.css': 'canvas{border:3px solid rgb(4, 5, 6)}',
  'MiJuego/img/logo.png': png(16, 8, [255, 0, 0]), 'MiJuego/img/fondo.png': png(4, 4, [0, 0, 255]), 'MiJuego/img/sprite.png': png(24, 24, [0, 255, 0]),
  'MiJuego/datos/nivel.json': '{"nivel":7}', 'MiJuego/datos/texto.txt': 'hola xhr',
};
fs.writeFileSync(TMP + 'MiJuego.zip', zip(ARCH));
fs.writeFileSync(TMP + 'SinHtml.zip', zip({ 'cosas/leeme.txt': 'nada' }));
fs.writeFileSync(TMP + 'Roto.zip', Buffer.from('esto no es un zip'.repeat(20)));
fs.writeFileSync(TMP + 'Suelto.html', '<!doctype html><html><body style="margin:0;background:#123"><canvas width="400" height="400"></canvas><script>var g=document.querySelector("canvas").getContext("2d"),t=0;(function f(){t++;g.fillStyle="#123";g.fillRect(0,0,400,400);g.fillStyle="#ff0";g.fillRect(t%360,180,40,40);requestAnimationFrame(f)})()</script></body></html>');
// el pesado: 30 MB (datos adentro del script) y un lienzo que se mueve
const relleno = Buffer.alloc(30e6, 'a');
fs.writeFileSync(TMP + 'Pesado.html', Buffer.concat([Buffer.from('<!doctype html><html><body style="margin:0"><canvas width="320" height="240"></canvas><script>var DATOS="'), relleno,
  Buffer.from('";var g=document.querySelector("canvas").getContext("2d"),t=0;(function f(){t++;g.fillStyle="#400";g.fillRect(0,0,320,240);g.fillStyle="#0f0";g.fillRect(t%300,100,20,20);requestAnimationFrame(f)})();parent.postMessage({rbPruebaPesado:DATOS.length},"*")</script></body></html>')]));
// la carpeta: un juego de dos archivos
fs.writeFileSync(TMP + 'carpeta/index.html', '<!doctype html><html><head><script src="js.js"></script></head><body><img src="img/a.png"><script>addEventListener("load",function(){parent.postMessage({rbPruebaCarpeta:[window.CARPETA_OK,document.images[0].naturalWidth]},"*")})</script></body></html>');
fs.writeFileSync(TMP + 'carpeta/js.js', 'window.CARPETA_OK = "si";'); fs.writeFileSync(TMP + 'carpeta/img/a.png', png(12, 12, [9, 9, 9]));
fs.writeFileSync(TMP + 'foto.png', png(640, 360, [230, 120, 20]));

const { b, p, err, ev } = await abrir(HTML, false);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); DIA.hora = 12; DIA.aplicada = -1; 1`);
await p.waitForTimeout(2500);
// una biblioteca vieja (versión 1 de la base, con el HTML adentro) antes de que el juego la abra
const vieja = await ev(`(async () => { MAQ.db = null; await new Promise((ok) => { const r = indexedDB.open('rezobox-juegos', 1); r.onupgradeneeded = () => r.result.createObjectStore('j', { keyPath: 'id' });
  r.onsuccess = () => { const t = r.result.transaction('j', 'readwrite'); t.objectStore('j').put({ id: 'u:viejo000001', nombre: 'Viejo', autor: 'yo', ctrl: 'flechas', html: '<!doctype html><p>viejo</p>', fecha: 1 }); t.oncomplete = () => { r.result.close(); ok(); }; }; });
  const L = await maqMios(), db = await maqDB(); return { n: L.length, viejo: !!L.find((x) => x.id === 'u:viejo000001' && x.html), v: db.version, h: db.objectStoreNames.contains('h') }; })()`);
ok('una biblioteca vieja (versión 1) pasa a la 2 sin perder nada', vieja.viejo && vieja.v === 2 && vieja.h, vieja);
// un gabinete adelante y su biblioteca
await ev(`(() => { const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), piso = pisoBajo(v3(JUG.pos.x, JUG.pos.y + 2, JUG.pos.z), 10);
  window.__a = crearObjeto('Arcade', v3(JUG.pos.x + f.x * 1.6, piso, JUG.pos.z + f.z * 1.6), Quat.axis(0, 1, 0, JUG.yaw + Math.PI)); for (let i = 0; i < 60; i++) physStep(1 / 60);
  JUG.pitch = 0.3; MAQ.obj = window.__a; MAQ.tab = 'mios'; maqPanelAbrir(); return 1; })()`);
await p.waitForTimeout(500);
await p.screenshot({ path: D + 'maq38_biblioteca.png' });
const bot = await ev(`(() => { const a = document.querySelector('#maqPan .mqArch'), c = document.querySelector('#maqPan .mqCarp'); return { multi: a.multiple, acepta: a.accept, carpeta: c.webkitdirectory, carpVis: getComputedStyle(document.querySelector('#maqPan .mqCarpL')).display !== 'none',
  txt: [...document.querySelectorAll('#maqPan .mqImp .boton span')].map((x) => x.textContent) }; })()`);
ok('subir acepta varios (.html y .zip) y, en la compu, una carpeta entera', bot.multi && /\.zip/.test(bot.acepta) && bot.carpeta && bot.carpVis, bot);

// --- subir 5 a la vez ---
const t0 = Date.now();
await p.setInputFiles('#maqPan .mqArch', [TMP + 'Suelto.html', TMP + 'MiJuego.zip', TMP + 'Pesado.html', TMP + 'Roto.zip', TMP + 'SinHtml.zip']);
await p.waitForTimeout(150);
const durante = await ev(`({ tab: MAQ.tab, filas: document.querySelectorAll('#maqPan .mqSub').length, est: MAQ.subs.map((x) => x.estado), badge: (document.querySelector('#maqPan .mqTabs .mqN') || {}).textContent || '' })`);
ok('al elegir 5 archivos se abre «Subiendo» con una fila por archivo y el contador en la pestaña', durante.tab === 'sub' && durante.filas === 5 && +durante.badge >= 1, durante);
// (una foto con el pesado a mitad de camino)
let mitad = null;
for (let i = 0; i < 200 && !mitad; i++) { const x = await ev(`(() => { const J = MAQ.subs.find((x) => x.nombre === 'Pesado.html'); return J && (J.estado === 'lee' || J.estado === 'arma' || J.estado === 'guarda') ? { est: J.estado, pct: (document.querySelector('[data-sub="' + J.id + '"] u') || {}).style.width, txt: document.querySelector('[data-sub="' + J.id + '"] small').textContent } : null; })()`); if (x) { mitad = x; await p.screenshot({ path: D + 'maq38_subiendo.png' }); } else await p.waitForTimeout(25); }
ok('el pesado muestra su avance mientras sube', !!mitad, mitad);
await p.waitForFunction(() => window.MAQ_LISTO = (window.__ev('MAQ.subs.every((x) => x.estado === "listo" || x.estado === "mal")')), null, { timeout: 120000 }).catch(() => {});
const seg = (Date.now() - t0) / 1000;
await p.waitForTimeout(300);
await p.screenshot({ path: D + 'maq38_subido.png' });
const fin = await ev(`MAQ.subs.map((J) => ({ n: J.nombre, e: J.estado, det: J.det, cls: document.querySelector('[data-sub="' + J.id + '"]').className, txt: document.querySelector('[data-sub="' + J.id + '"] small').textContent, pct: document.querySelector('[data-sub="' + J.id + '"] u').style.width }))`);
const por = Object.fromEntries(fin.map((x) => [x.n, x]));
ok('los 3 buenos quedan «Listo» (con su tamaño; el .zip dice cuántos archivos tenía)', ['Suelto.html', 'MiJuego.zip', 'Pesado.html'].every((n) => por[n].e === 'listo' && por[n].cls.includes('ok') && por[n].pct === '100%') && /10 /.test(por['MiJuego.zip'].det), fin.map((x) => [x.n, x.e, x.txt]));
ok('el .zip roto y el que no tiene HTML fallan con un motivo claro (y no traban a los demás)', por['Roto.zip'].e === 'mal' && por['Roto.zip'].txt === (await ev(`T('maq.noZip')`)) && por['SinHtml.zip'].e === 'mal' && por['SinHtml.zip'].txt === (await ev(`T('maq.sinHtml')`)), [por['Roto.zip'].txt, por['SinHtml.zip'].txt]);
ok('los 5 (con 30 MB) en menos de 20 s', seg < 20, +seg.toFixed(1));
// la lista no carga los pesados
const lig = await ev(`(async () => { const L = await maqMios(); const P = L.find((x) => x.nombre === 'Pesado'); const C = await maqMio(P.id, true); return { n: L.length, conHtml: L.filter((x) => x.html && x.html.length > 262144).length, hg: P.hg, completo: C && C.html.length }; })()`);
ok('el pesado se guarda aparte: la lista lo lee sin su HTML (y completo tiene sus 30 MB)', lig.conHtml === 0 && lig.hg > 30e6 && lig.completo === lig.hg, lig);
await ev(`MAQ.tab = 'mios'; maqPanelDibujar(); 1`); await p.waitForTimeout(400);
const mios = await ev(`[...document.querySelectorAll('#maqPan .mqIt')].map((x) => [x.querySelector('b').textContent, (x.querySelector('em') || {}).textContent, x.querySelectorAll('.boton').length])`);
ok('en «Mis juegos» están los 4 (3 nuevos y el viejo), con su tamaño y el botón de foto', mios.length === 4 && mios.some((x) => x[0] === 'Pesado' && x[1] === '29 MB') && mios.some((x) => x[0] === 'Viejo' && x[1] === '1 KB') && mios.every((x) => x[2] === 4), mios);
await p.screenshot({ path: D + 'maq38_mios.png' });

// --- el juego de varios archivos corre entero ---
const idZ = await ev(`(async () => (await maqMios()).find((x) => x.nombre === 'MiJuego').id)()`);
await ev(`window.__m = {}; addEventListener('message', (e) => { if (e.data && (e.data.rbPruebaZip || e.data.rbPruebaPesado || e.data.rbPruebaCarpeta)) Object.assign(window.__m, e.data); }); document.querySelector('#maqPan [data-mq="jugar:${idZ}"]').click(); 1`);
await p.waitForFunction(() => window.__ev('!!window.__m.rbPruebaZip'), null, { timeout: 15000 }).catch(() => {});
const z = await ev(`window.__m.rbPruebaZip || null`);
ok('el .zip corre entero: script, estilos (url y @import), imagen, fetch, imagen armada por código y XHR', z && z.js && /^url\("data:image/.test(z.css) && z.color === 'rgb(1, 2, 3)' && z.importado === 'rgb(4, 5, 6)' && z.logo === 16 && z.json === 7 && z.dinamica === 24 && z.xhr === 'hola xhr', z);
await p.waitForTimeout(1500);
const vista = await ev(`(() => { const f = document.querySelector('#maqVista iframe'), r = f.getBoundingClientRect(); return { ar: +(r.width / r.height).toFixed(3), mqAr: getComputedStyle($('maqVista')).getPropertyValue('--mqAr').trim(), area: +(r.width * r.height / (innerWidth * innerHeight)).toFixed(2) }; })()`);
ok('la pantalla grande toma la forma del juego (16:9)', Math.abs(vista.ar - 16 / 9) < 0.03, vista);
await p.screenshot({ path: D + 'maq38_jugando_zip.png' });
// ajustar: el lienzo fijo (640 × 360) agrandado al centro; se recuerda para ese juego
const marco = () => p.frames().filter((f) => f !== p.mainFrame() && (f.url() === '' || /srcdoc/.test(f.url()))).pop() || null;
const medir = async () => { const f = marco(); return f ? f.evaluate(() => { const c = document.querySelector('canvas'), r = c.getBoundingClientRect(); return { w: +(r.width / innerWidth).toFixed(2), h: +(r.height / innerHeight).toFixed(2), cx: +((r.left + r.width / 2) / innerWidth).toFixed(2) }; }) : null; };
const antes = await medir();
await p.click('#maqVista .mqAj'); await p.waitForTimeout(400);
const desp = await medir(), recordado = await ev(`!!(PREFS.maqAj && PREFS.maqAj['${idZ}']) && $('maqVista').querySelector('.mqAj').classList.contains('sel')`);
await p.screenshot({ path: D + 'maq38_ajustado.png' });
// el costo de cada cuadro de la pantalla en vivo (para 60 por segundo: 16,7 ms en total por cuadro): copiar el lienzo del
// juego a 320 de ancho y leerlo (adentro), y ponerlo en la pantalla del gabinete (afuera)
const cAdentro = await marco().evaluate(() => { const b = document.querySelector('canvas'), W = 320, H = Math.round(320 * b.height / b.width), v = document.createElement('canvas'); v.width = W; v.height = H; const g = v.getContext('2d', { willReadFrequently: true });
  for (let i = 0; i < 20; i++) { g.drawImage(b, 0, 0, W, H); g.getImageData(0, 0, W, H); }
  const t = performance.now(); for (let i = 0; i < 200; i++) { g.drawImage(b, 0, 0, W, H); g.getImageData(0, 0, W, H); } return +((performance.now() - t) / 200).toFixed(3); });
const cAfuera = await ev(`(() => { const im = new ImageData(320, 180); for (let i = 0; i < im.data.length; i += 4) { im.data[i] = i % 255; im.data[i + 3] = 255; } for (let i = 0; i < 20; i++) maqVivoPoner('prueba', im, RED.ID, 16 / 9);
  const t = performance.now(); for (let i = 0; i < 200; i++) maqVivoPoner('prueba', im, RED.ID, 16 / 9); MAQV.lienzo.delete('prueba'); return +((performance.now() - t) / 200).toFixed(3); })()`);
// (y cuántos manda: solo, 4 por segundo; con alguien cerca, hasta 15, espaciados si la copia sale cara: nunca más de ~10 % del juego)
const ritmo = async (cerca) => ev(`(async () => { MAQV.siempre = ${cerca}; await new Promise((r) => setTimeout(r, 2500)); const n0 = MAQV.cuadros || 0, t0 = performance.now(); await new Promise((r) => setTimeout(r, 4000)); const n = (MAQV.cuadros || 0) - n0; MAQV.siempre = false;
  return { cps: +(n / ((performance.now() - t0) / 1000)).toFixed(2), copiaMs: +MAQV.copiaMs.toFixed(2), cada: Math.round(MAQV.copiaCada) }; })()`);
const solo = await ritmo(false), conAlguien = await ritmo(true);
// (la regla: cada = el mayor entre lo pedido —1000 ms solo, 66 con alguien— y 10 veces lo que tarda la copia —tope 2 s—; el
// costo para el juego = lo que tarda / cada ≤ 10 %)
const regla = (r, pide) => Math.abs(r.cada - Math.max(pide, Math.min(2000, r.copiaMs * 10))) <= Math.max(2, r.copiaMs * 3) && r.copiaMs / r.cada <= 0.105;
ok('la copia de cuadros se adapta: solo, 1 por segundo; con alguien cerca, hasta 15 (66 ms) pero nunca más del 10 % del juego', regla(solo, 1000) && regla(conAlguien, 66) && solo.cps <= 1.2 && conAlguien.cps <= 16, { adentroMs: cAdentro, afueraMs: cAfuera, solo, conAlguien, cargaSolo: +(solo.copiaMs / solo.cada).toFixed(3), cargaCon: +(conAlguien.copiaMs / conAlguien.cada).toFixed(3) });
ok('«Ajustar» agranda el lienzo fijo hasta llenar la pantalla del juego (centrado) y se recuerda', antes && antes.w < 0.6 && desp && Math.max(desp.w, desp.h) > 0.97 && Math.abs(desp.cx - 0.5) < 0.01 && recordado, { antes, desp, recordado });

// --- el pesado corre ---
await ev(`maqVistaCerrar(); MAQ.obj = window.__a; MAQ.tab = 'mios'; maqPanelAbrir(); 1`); await p.waitForTimeout(400);
const idP = await ev(`(async () => (await maqMios()).find((x) => x.nombre === 'Pesado').id)()`);
const tp = Date.now();
await ev(`document.querySelector('#maqPan [data-mq="jugar:${idP}"]').click(); 1`);
await p.waitForFunction(() => window.__ev('!!window.__m.rbPruebaPesado'), null, { timeout: 30000 }).catch(() => {});
const pes = await ev(`window.__m.rbPruebaPesado || 0`);
ok('el de 30 MB abre y corre', pes === 30e6, { datos: pes, s: +((Date.now() - tp) / 1000).toFixed(1) });
await p.waitForTimeout(1200);
// la pantalla en vivo del gabinete (el cuadro que llega del juego)
const vivo = await ev(`(() => { const L = MAQV.lienzo; const k = [...L.keys()][0]; return { lienzos: L.size, n: MAQV.n }; })()`);
ok('la pantalla del gabinete recibe los cuadros del juego', vivo.lienzos >= 1, vivo);
// la publicación de un pesado: aviso claro sin intentar mandarlo
await ev(`(async () => { maqVistaCerrar(); $('aviso').textContent = ''; await maqPublicar(await maqMio('${idP}', true)); return 1; })()`); await p.waitForTimeout(200);
const av = await ev(`$('aviso').textContent`);
ok('publicar el pesado avisa que la comunidad acepta hasta 1,8 MB (y que igual se juega)', av === (await ev(`T('maq.pesadoTienda')`)).replace('{n}', '29 MB'), av);

// --- la foto de tapa ---
await ev(`MAQ.obj = window.__a; MAQ.tab = 'mios'; maqPanelAbrir(); 1`); await p.waitForTimeout(400);
await ev(`document.querySelector('#maqPan [data-mq="foto:${idZ}"]').click(); 1`).catch(() => {});
await p.setInputFiles('#maqPan .mqFoto', TMP + 'foto.png');
await p.waitForTimeout(800);
const foto = await ev(`(async () => { const j = await maqMio('${idZ}'); const im = document.querySelector('#maqPan .mqIt[data-id="${idZ}"] img'); return { foto: !!j.foto, largo: j.foto && j.foto.length, jpeg: /^data:image\\/jpeg/.test(j.foto || ''), lista: im && im.src === j.foto, tam: im && [im.naturalWidth, im.naturalHeight] }; })()`);
ok('la foto queda en el juego (320 × 240, JPEG, < 120 000 para la comunidad) y se ve en la lista', foto.foto && foto.jpeg && foto.largo < 120000 && foto.lista && foto.tam[0] === 320 && foto.tam[1] === 240, foto);
await p.screenshot({ path: D + 'maq38_foto.png' });
// (en la pantalla del gabinete: la tapa toma la foto)
await ev(`cerrarPaneles(); window.__a.maq = { g: '${idZ}', n: 'MiJuego', c: 'flechas', de: '' }; 1`); await p.waitForTimeout(800);
const tapa = await ev(`(async () => { const j = await maqMio('${idZ}'); maqTapaCanvas(j); await new Promise((ok) => setTimeout(ok, 300)); const t = MAQ.tapas.get('${idZ}');
  const d = maqTapaCanvas(j).getContext('2d').getImageData(128, 96, 1, 1).data; return { rgb: [...d].slice(0, 3), texRehecha: !!(t && R.tex[t.k]) }; })()`);
ok('la tapa del gabinete usa la foto (naranja) y su textura se rehace', tapa.rgb[0] > 200 && tapa.rgb[1] > 90 && tapa.rgb[1] < 150 && tapa.rgb[2] < 60 && tapa.texRehecha, tapa);
await ev(`JUG.pitch = 0.15; 1`); await p.waitForTimeout(500); await p.screenshot({ path: D + 'maq38_gabinete_foto.png' });
const pub = await ev(`(async () => { let cuerpo = null; const f0 = window.fetch; window.fetch = async (u, o) => { cuerpo = JSON.parse(o.body); return { json: async () => ({ id: 'x' }) }; }; await maqPublicar(await maqMio('${idZ}', true)); window.fetch = f0; return { foto: cuerpo && cuerpo.foto === (await maqMio('${idZ}')).foto, html: cuerpo && cuerpo.html.length }; })()`);
ok('publicar manda la foto puesta', pub.foto && pub.html > 1000, pub);
// volver a subir el mismo juego no le borra la foto
await ev(`MAQ.obj = window.__a; MAQ.tab = 'mios'; maqPanelAbrir(); 1`); await p.waitForTimeout(300);
await p.setInputFiles('#maqPan .mqArch', [TMP + 'MiJuego.zip']);
await p.waitForFunction(() => window.__ev('MAQ.subs.every((x) => x.estado === "listo" || x.estado === "mal")'), null, { timeout: 20000 }).catch(() => {});
ok('volver a subir el mismo juego le deja su foto', await ev(`(async () => !!(await maqMio('${idZ}')).foto)()`));

// --- una carpeta entera ---
let carp = null;
try {
  await p.setInputFiles('#maqPan .mqCarp', TMP + 'carpeta');
  await p.waitForFunction(() => window.__ev('MAQ.subs.every((x) => x.estado === "listo" || x.estado === "mal")'), null, { timeout: 20000 }).catch(() => {});
  const J = await ev(`MAQ.subs[MAQ.subs.length - 1]`);
  await ev(`(async () => { maqPanelCerrar(); maqVistaAbrir(await maqMio(${JSON.stringify(J.jid)}, true)); return 1; })()`);
  await p.waitForFunction(() => window.__ev('!!window.__m.rbPruebaCarpeta'), null, { timeout: 10000 }).catch(() => {});
  carp = { nombre: J.nombre, estado: J.estado, det: J.det, corre: await ev(`window.__m.rbPruebaCarpeta || null`) };
} catch (e) { carp = { error: String(e.message).slice(0, 160) }; }
ok('una carpeta entera se sube y corre (script e imagen de al lado)', carp && carp.estado === 'listo' && carp.corre && carp.corre[0] === 'si' && carp.corre[1] === 12, carp);
await ev(`maqVistaCerrar(); cerrarPaneles(); 1`);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|tienda/i.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|tienda/i.test(e)).slice(0, 5));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
fs.rmSync(TMP, { recursive: true, force: true });
