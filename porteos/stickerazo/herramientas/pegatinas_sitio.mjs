// Los dibujitos de la página web (sitio/a/pg/*.webp): pegatinas propias (web/pegatinas.js) con su borde blanco y
// sombra, y unas «pegatinas ícono» (un ícono de la app, en blanco sobre una mancha de color, con el mismo borde),
// así la página no usa emojis como íconos. uso: node herramientas/pegatinas_sitio.mjs [--muestra SALIDA.png]
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
const RAIZ = new URL('../', import.meta.url).pathname, WEB = RAIZ + 'web/', SAL = RAIZ + 'sitio/a/pg/';
// pegatinas que van tal cual
const PEGAS = ['mate', 'risa', 'pelota', 'fuego', 'g_naa', 'empanada', 'notas', 'cool', 'chispas', 'luna', 'rayo', 'corazon'];
// pegatinas ícono: [nombre, ícono de la app, color de arriba, color de abajo]
const ICONOS = [['i_camara', 'camara', '#ff3e8a', '#ff8a1a'], ['i_candado', 'candado', '#7c4dff', '#3ec7ff'], ['i_limpio', 'bloquear', '#ff4d4d', '#ff9a3e'],
  ['i_mundo', 'mundo', '#1fbf75', '#3ec7ff'], ['i_globo', 'globo', '#1fbf75', '#7ee36b'], ['i_celular', 'celular', '#3ec7ff', '#7c4dff'], ['i_llave', 'llave', '#ffb21a', '#ff7a1a'],
  ['i_tacho', 'tacho', '#ff3e8a', '#7c4dff'], ['i_pincel', 'pincel', '#ff8a1a', '#ffd23f'], ['i_mano', 'mano', '#1fbf75', '#ffd23f'], ['i_bandera', 'bandera', '#ff4d4d', '#ff3e8a']];
const LADO = 192;
const muestra = process.argv.includes('--muestra') ? process.argv[process.argv.indexOf('--muestra') + 1] : null;
// (los íconos de la app: el objeto ICONOS de app.js y los de iconos.js, leídos como texto)
const appTxt = fs.readFileSync(WEB + 'app.js', 'utf8'), i0 = appTxt.indexOf('const ICONOS = {'), i1 = appTxt.indexOf('\n};', i0);
const RI = (d) => `<path class="r" d="${d}"/>`;
const ICO = { ...new Function('RI', 'return ' + appTxt.slice(i0 + 'const ICONOS = '.length, i1 + 2))(RI) };
const masTxt = fs.readFileSync(WEB + 'iconos.js', 'utf8'), m0 = masTxt.indexOf('{', masTxt.indexOf('ICONOS_MAS')), m1 = masTxt.lastIndexOf('};');
Object.assign(ICO, new Function('RI', 'return ' + masTxt.slice(m0, m1 + 1))(RI));
// (los que no están en la app)
ICO.llave = RI('M7.5 11.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8z') + '<circle cx="7.5" cy="15.5" r="4"/><path d="M10.4 12.6L20 3M15.6 7.4l2.6 2.6M13.4 9.6l2 2"/>';
const svgDe = (n) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${(ICO[n] || '').replace(/<path class="r"[^>]*\/>/g, '')}</svg>`;
const srv = http.createServer((q, r) => { const u = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (u === '/h.html') { r.writeHead(200, { 'Content-Type': 'text/html' }); return r.end('<!doctype html><body></body>'); } const f = path.join(WEB, u); if (!f.startsWith(WEB) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'font/ttf' }); fs.createReadStream(f).pipe(r); }).listen(8978);
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://127.0.0.1:8978/h.html');
const out = await p.evaluate(async ({ PEGAS, ICONOS, LADO, svgs }) => {
  for (const f of ['LuckiestGuy']) { const ff = new FontFace(f, `url(/fuentes/${f}.ttf)`); await ff.load(); document.fonts.add(ff); }
  const { PEGA, dibujarPega } = await import('/pegatinas.js');
  const carga = (src) => new Promise((ok, mal) => { const im = new Image(); im.onload = () => ok(im); im.onerror = mal; im.src = src; });
  // (lo de adentro, más chico, para que entren el borde blanco y la sombra)
  const T = Math.round(LADO * 0.8), res = {};
  const pegar = (dibujo) => {
    const o = Math.max(4, T * 0.07), x0 = (LADO - T) / 2, y0 = (LADO - T) / 2 - T * 0.02;
    const borde = document.createElement('canvas'); borde.width = borde.height = LADO; const gb = borde.getContext('2d');
    for (const f of [1, 0.55]) for (let j = 0; j < 24; j++) gb.drawImage(dibujo, x0 + o * f * Math.cos((j * Math.PI) / 12), y0 + o * f * Math.sin((j * Math.PI) / 12));
    gb.globalCompositeOperation = 'source-in'; gb.fillStyle = '#fff'; gb.fillRect(0, 0, LADO, LADO);
    const c = document.createElement('canvas'); c.width = c.height = LADO; const g = c.getContext('2d');
    g.filter = `drop-shadow(0 ${Math.round(T * 0.04)}px ${Math.round(T * 0.045)}px rgba(0,0,0,0.35))`; g.drawImage(borde, 0, 0); g.filter = 'none';
    g.drawImage(dibujo, x0, y0); return c.toDataURL('image/webp', 0.9);
  };
  for (const id of PEGAS) { const t = document.createElement('canvas'); t.width = t.height = T; dibujarPega(t.getContext('2d'), PEGA[id], T); res[id] = pegar(t); }
  for (const [nom, , de, a] of ICONOS) {
    const t = document.createElement('canvas'); t.width = t.height = T; const g = t.getContext('2d'), r = T * 0.3, m = T * 0.06;
    const gr = g.createLinearGradient(0, 0, T, T); gr.addColorStop(0, de); gr.addColorStop(1, a); g.fillStyle = gr;
    g.beginPath(); g.roundRect(m, m, T - 2 * m, T - 2 * m, r); g.fill();
    const br = g.createLinearGradient(0, m, 0, T * 0.55); br.addColorStop(0, 'rgba(255,255,255,0.35)'); br.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = br;
    g.beginPath(); g.roundRect(m * 1.6, m * 1.6, T - 3.2 * m, T * 0.42, [r * 0.8, r * 0.8, r * 0.3, r * 0.3]); g.fill();
    const im = await carga('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgs[nom])), s = T * 0.62;
    g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowOffsetY = T * 0.02; g.drawImage(im, (T - s) / 2, (T - s) / 2, s, s);
    res[nom] = pegar(t);
  }
  return res;
}, { PEGAS, ICONOS, LADO, svgs: Object.fromEntries(ICONOS.map(([n, i]) => [n, svgDe(i)])) });
// los íconos de línea de las páginas (<i data-i="..."></i>): el SVG va adentro, así se ven sin JavaScript
const linea = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>`;
if (!muestra) for (const f of fs.readdirSync(RAIZ + 'sitio').filter((x) => x.endsWith('.html'))) {
  const ruta = RAIZ + 'sitio/' + f, viejo = fs.readFileSync(ruta, 'utf8');
  const nuevo = viejo.replace(/<i data-i="([A-Za-z0-9]+)">(?:<svg[\s\S]*?<\/svg>)?<\/i>/g, (t, n) => { if (!ICO[n]) throw new Error('falta el ícono ' + n + ' (' + f + ')'); return `<i data-i="${n}">${linea(n)}</i>`; });
  if (nuevo !== viejo) { fs.writeFileSync(ruta, nuevo); console.log('íconos en', f); }
}
fs.mkdirSync(SAL, { recursive: true }); let total = 0;
for (const [k, u] of Object.entries(out)) { const buf = Buffer.from(u.split(',')[1], 'base64'); total += buf.length; if (!muestra) fs.writeFileSync(SAL + k + '.webp', buf); }
console.log(Object.keys(out).length, 'dibujitos,', (total / 1024).toFixed(1), 'KB en total');
if (muestra) {
  const q = await b.newPage({ viewport: { width: 1000, height: 460 } });
  await q.setContent(`<body style="margin:0;background:#120f1a;display:flex;flex-wrap:wrap;gap:6px;padding:10px">${Object.entries(out).map(([k, u]) => `<div style="text-align:center;color:#fff;font:11px system-ui"><img src="${u}" width="96"><br>${k}</div>`).join('')}</body>`);
  await q.screenshot({ path: muestra });
}
await b.close(); srv.close();
