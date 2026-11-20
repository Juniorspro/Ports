// Las imágenes de la ficha de Google Play, sacadas de la app de verdad (la página, el servidor de la comunidad sobre
// SQLite y cinco cuentas de ejemplo que publican packs listos: nada de fotos de nadie):
//   capturas/1…6.png  1080×1920, la pantalla en un celular con un título arriba
//   grafico.png       1024×500, el «gráfico de funciones» (arriba de todo en la ficha)
//   icono.png         512×512 con canal alfa (el ícono de la tienda)
// uso: node herramientas/capturas_play.mjs [SALIDA=marca/play]
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
const RAIZ = new URL('..', import.meta.url).pathname, WEB = RAIZ + 'web/', SAL = path.resolve(process.argv[2] || RAIZ + 'marca/play');
const CRUDAS = '/tmp/claude-0/sz_play_crudas';
for (const d of [SAL, SAL + '/capturas', CRUDAS]) fs.mkdirSync(d, { recursive: true });
const PW = 8997, PC = 8998, API = `http://127.0.0.1:${PC}`, W = `http://127.0.0.1:${PW}`;
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.png': 'image/png', '.webp': 'image/webp' };
const web = http.createServer((q, r) => { const f = path.join(WEB, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' }); fs.createReadStream(f).pipe(r); }).listen(PW);
const { arrancar } = await import(RAIZ + 'pruebas/servidor_local.mjs'); const { srv } = await arrancar(PC);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const errores = [];

async function celular(nombre, cuenta) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), p = await ctx.newPage();
  await p.addInitScript((u) => { window.SZ_API = u; try { localStorage.setItem('sz_bienvenida', '1'); localStorage.setItem('sz_pais', 'ar'); } catch (e) { /* nada */ } }, API);
  p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/^INFO:/.test(m.text())) errores.push(nombre + ' consola: ' + m.text().slice(0, 200)); });
  await p.goto(`${W}/index.html`); await p.waitForFunction(() => window.__sz && document.fonts.status === 'loaded');
  const E = (f, a) => p.evaluate(f, a);
  if (cuenta) {
    await p.click('#tabs [data-t="Perfil"]'); await p.waitForSelector('#regNombre'); await p.fill('#regNombre', cuenta); await p.click('#regEntrar');
    await p.waitForSelector('#tabPerfil .arroba');
  }
  const cruda = async (n) => { await espera(500); const f = `${CRUDAS}/${n}.png`; await p.screenshot({ path: f }); return f; };
  return { p, ctx, E, cruda };
}
async function agregarListo(c, id) {
  await c.p.click('#tabs [data-t="Listos"]'); await c.p.click(`#listos .listo[data-l="${id}"]`); await c.p.click('#modal [data-x="1"]');
  await c.p.waitForFunction(() => window.__sz.E.vista === 'vPack' && document.querySelector('#modal').classList.contains('oc'), null, { timeout: 90000 });
}

// ---- la comunidad de ejemplo: cinco cuentas publican un pack listo cada una y se dan me gusta entre ellas ----
const SEMILLA = [['juancito', 'respuestas'], ['la.flaca', 'mate'], ['tano.gol', 'futbol'], ['mili.sol', 'chamuyo'], ['nachito', 'filete']];
const gente = [];
for (const [nombre, listo] of SEMILLA) {
  const c = await celular(nombre, nombre);
  await agregarListo(c, listo);
  await c.p.click('#pPublicar'); await c.p.waitForSelector('#pbT'); await c.p.click('#modal [data-x="1"]'); await c.p.waitForSelector('#modal .grandote', { timeout: 60000 });
  const id = await c.E(() => { const E = window.__sz.E; return E.packs.find((x) => x.id === E.packId).publicado.id; });
  gente.push({ nombre, id, token: await c.E(() => JSON.parse(localStorage.sz_cuenta).token) });
  await c.ctx.close(); await espera(150);
}
// (más me gusta a los primeros: así «Para vos» arranca con las respuestas)
for (const [i, g] of gente.entries()) for (const otro of gente.slice(0, gente.length - i)) if (otro !== g)
  await fetch(`${API}/api/packs/${otro.id}/like`, { method: 'POST', headers: { Authorization: 'Bearer ' + g.token } });
console.log('comunidad de ejemplo:', gente.map((g) => '@' + g.nombre).join(' '));

// ---- las pantallas ----
const crudas = {};
const V = await celular('V');   // (sin cuenta: el servidor deja 5 cuentas por día por conexión)
await V.p.click('#tabs [data-t="Feed"]'); await V.p.waitForSelector('#feedLista .tf:not(.esq) .tfGrilla img');
await V.p.waitForFunction(() => [...document.querySelectorAll('#feedLista .tf:not(.esq) img')].slice(0, 12).every((i) => i.complete && i.naturalWidth > 0));
crudas.feed = await V.cruda('feed');
await V.p.click('#tabs [data-t="Crear"]'); await V.p.waitForFunction(() => [...document.querySelectorAll('#portada img, #carrusel img')].every((i) => i.complete && i.naturalWidth > 0));
crudas.crear = await V.cruda('crear');
// un sticker de sólo texto, con filete
await V.p.click('#bTexto'); await V.p.waitForSelector('#tTx'); await V.p.fill('#tTx', '¡QUÉ\nGENIO!');
await V.p.click('#tE [data-v="filete"]'); await V.p.click('#modal [data-x="1"]'); await V.p.waitForFunction(() => window.__sz.E.vista === 'vEditor');
const sinAviso = (c) => c.p.waitForFunction(() => document.querySelector('#aviso').classList.contains('oc'), null, { timeout: 15000 });
await sinAviso(V); crudas.editor = await V.cruda('editor');
await V.p.click('#vEditor [data-e="animar"]'); await V.p.click('#aL [data-v="latido"]'); crudas.animar = await V.cruda('animar');
await V.ctx.close();
// los packs listos y uno agregado, listo para WhatsApp
const L = await celular('L');
await L.p.click('#tabs [data-t="Listos"]'); await L.p.waitForFunction(() => [...document.querySelectorAll('#listos img')].slice(0, 15).every((i) => i.complete && i.naturalWidth > 0));
await L.E(() => document.querySelector('#tabListos').scrollTo(0, 0)); crudas.listos = await L.cruda('listos');
await agregarListo(L, 'respuestas'); await sinAviso(L);
crudas.pack = await L.cruda('pack');
// figuritas para el gráfico de 1024×500 (los stickers listos, en PNG con transparencia)
const figus = await L.E(async () => {
  const { LISTOS, armarListo } = await import('/listos.js');
  const elegir = [['respuestas', 0], ['mate', 0], ['futbol', 0], ['chamuyo', 0], ['filete', 0], ['respuestas', 1]];
  return elegir.map(([id, i]) => {
    // (recortado a lo que tiene dibujo: el sticker de 512 tiene mucho aire)
    const d = LISTOS.find((x) => x.id === id), c = armarListo(d.stickers[i], i).componer(0), a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (a[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext('2d').drawImage(c, -x0, -y0);
    return o.toDataURL('image/png');
  });
});
await L.ctx.close();

// ---- el armado: la pantalla en un celular, con su título ----
const TEXTOS = [
  ['crear', 'Stickers<br><em>al toque</em>', 'Con una foto, un texto o la cámara. Sin vueltas.'],
  ['editor', 'Letras con<br><em>mucha onda</em>', 'Filete, globitos, emojis y 5 tipografías para decir lo que quieras.'],
  ['animar', 'Que se<br><em>muevan</em>', '10 animaciones de un toque: latido, temblor, rebote…'],
  ['feed', 'La comunidad<br><em>más argenta</em>', 'Seguí, dale me gusta y bajate los mejores packs.'],
  ['pack', 'Del celu<br><em>al grupo</em>', 'Armás el pack y con un toque lo sumás a WhatsApp.'],
  ['listos', 'Packs<br><em>listos</em>', 'Mate, fútbol, asado, laburo… para usar o cambiar.'],
];
const FONDO = `background:#000;background-image:radial-gradient(60% 38% at 12% 8%,rgba(255,62,138,.55),transparent 70%),radial-gradient(50% 32% at 95% 18%,rgba(255,210,63,.32),transparent 70%),radial-gradient(75% 45% at 50% 105%,rgba(124,77,255,.5),transparent 70%)`;
const FUENTE = `@font-face{font-family:L;src:url(${W}/fuentes/LuckiestGuy.ttf)}`;
const arm = await (await b.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })).newPage();
const dataUrl = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
for (const [i, [clave, titulo, sub]] of TEXTOS.entries()) {
  await arm.setContent(`<!doctype html><html><head><style>${FUENTE}
    body{margin:0;width:1080px;height:1920px;overflow:hidden;${FONDO};font-family:system-ui,'DejaVu Sans',sans-serif}
    h1{position:absolute;top:96px;left:40px;right:40px;margin:0;text-align:center;font:400 112px/1.02 L;color:#fff;transform:rotate(-3deg);text-shadow:0 10px 34px rgba(255,62,138,.55)}
    h1 em{font-style:normal;color:#ffd23f}
    p{position:absolute;top:372px;left:90px;right:90px;margin:0;text-align:center;font-size:40px;line-height:1.25;font-weight:600;color:#ece6fb;text-wrap:balance}
    .tel{position:absolute;left:50%;top:500px;transform:translateX(-50%);width:${Math.round(1360 * 393 / 852) + 28}px;height:1388px;box-sizing:border-box;padding:14px;border-radius:66px;background:linear-gradient(150deg,#4a4462,#15131d 40%,#2a2638);box-shadow:0 40px 90px rgba(255,62,138,.33),0 0 0 2px rgba(255,255,255,.12) inset}
    .tel img{width:100%;height:100%;display:block;border-radius:54px}
  </style></head><body><h1>${titulo}</h1><p>${sub}</p><div class="tel"><img src="${dataUrl(crudas[clave])}"></div></body></html>`);
  await arm.evaluate(() => document.fonts.ready); await espera(150);
  await arm.screenshot({ path: `${SAL}/capturas/${i + 1}_${clave}.png` });
}
// el gráfico de funciones: el logo como en la app a la izquierda y seis stickers listos en dos filas a la derecha
await arm.setViewportSize({ width: 1024, height: 500 });
const anillo = (r, c) => Array.from({ length: 16 }, (_, k) => `${(r * Math.cos(k * Math.PI / 8)).toFixed(1)}px ${(r * Math.sin(k * Math.PI / 8)).toFixed(1)}px 0 ${c}`).join(',');
await arm.setContent(`<!doctype html><html><head><style>${FUENTE}
  body{margin:0;width:1024px;height:500px;overflow:hidden;${FONDO};font-family:system-ui,'DejaVu Sans',sans-serif;position:relative}
  .izq{position:absolute;left:0;top:0;width:470px;height:500px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px}
  .logo{font:400 84px/1 L;white-space:nowrap;transform:rotate(-5deg);text-shadow:${anillo(6, '#fff')},0 14px 26px rgba(255,62,138,.55)}
  .logo span{color:#ff3e8a}.logo b{font-weight:400;color:#f5a800}
  .lema{font-size:34px;font-weight:800;color:#fff;transform:rotate(-3deg);text-shadow:0 4px 14px #000}
  .der{position:absolute;left:478px;top:28px;width:520px;height:444px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:1fr 1fr;gap:10px}
  .der div{display:flex;align-items:center;justify-content:center}
  .der img{max-width:150px;max-height:170px;filter:drop-shadow(0 10px 14px rgba(0,0,0,.6))}
</style></head><body><div class="izq"><div class="logo"><span>Sticker</span><b>azo</b></div><div class="lema">Tus stickers, al toque 🔥</div></div>
<div class="der">${figus.map((s, k) => `<div style="transform:translateY(${[0, 18, -6, 10, -14, 6][k]}px) rotate(${[-8, 6, -4, 7, -6, 9][k]}deg)"><img src="${s}"></div>`).join('')}</div></body></html>`);
await arm.evaluate(() => document.fonts.ready); await espera(150);
const fuera = await arm.evaluate(() => [...document.querySelectorAll('.logo,.lema,.der img')].filter((e) => { const r = e.getBoundingClientRect(); return r.left < 8 || r.top < 8 || r.right > 1016 || r.bottom > 492; }).length);
if (fuera) { console.log('gráfico: hay', fuera, 'cosas pegadas al borde'); process.exitCode = 1; }
await arm.screenshot({ path: `${SAL}/grafico.png` });
// el ícono, con canal alfa (Play pide PNG de 32 bits)
await arm.setViewportSize({ width: 512, height: 512 });
await arm.setContent(`<html><body style="margin:0;background:transparent"><img src="${dataUrl(RAIZ + 'marca/icono_512.png')}" style="display:block;width:512px;height:512px"></body></html>`);
await arm.screenshot({ path: `${SAL}/icono.png`, omitBackground: true });

await b.close(); web.close(); srv.close();
if (errores.length) { console.log('errores:', errores); process.exitCode = 1; }
for (const f of [...fs.readdirSync(SAL + '/capturas').map((x) => 'capturas/' + x), 'grafico.png', 'icono.png']) console.log(f, Math.round(fs.statSync(`${SAL}/${f}`).size / 1024) + ' KB');
