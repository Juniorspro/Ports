// El recorte con fotos de verdad (en el navegador, como en la app): para cada foto, el recorte automático (personas) o
// tocando el medio (lo demás), y una hoja con los resultados sobre un damero para mirarlos. Mide cuánto tarda y cuánto de
// la foto quedó adentro.
// uso: node recorte.mjs CARPETA_FOTOS [SALIDA=/tmp/claude-0/sz_recorte]   (con la carpeta web/ servida en :8981)
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
const [, , FOTOS, SAL = '/tmp/claude-0/sz_recorte'] = process.argv; fs.mkdirSync(SAL, { recursive: true });
const WEB = new URL('../web/', import.meta.url).pathname, TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.tflite': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(new URL(q.url, 'http://x').pathname); const f = u.startsWith('/fotos/') ? path.join(FOTOS, u.slice(7)) : path.join(WEB, u); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8981);
fs.writeFileSync(path.join(WEB, '_prueba.html'), '<!doctype html><meta charset="utf-8"><body><script type="module">import * as R from "./recorte.js"; window.R = R; window.listo = true;</script>');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage(); const err = []; p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || /rror|fail/i.test(m.text())) console.log('consola:', m.text().slice(0, 300)); });
await p.goto('http://localhost:8981/_prueba.html'); await p.waitForFunction(() => window.listo, null, { timeout: 30000 });
const t0 = Date.now(); await p.evaluate(() => window.R.preparar()); console.log('modelos cargados en', Date.now() - t0, 'ms');
const L = fs.readdirSync(FOTOS).filter((f) => /\.jpe?g$/i.test(f) && !/mask/.test(f)).sort();
const res = [];
for (const f of L) {
  const r = await p.evaluate(async (f) => {
    const img = new Image(); img.src = '/fotos/' + f; await img.decode();
    const t0 = performance.now(), m = await window.R.recortarSolo(img), ms = Math.round(performance.now() - t0);
    // la foto, el recorte de personas y el de tocar el medio, sobre un damero (y el que eligió el automático, marcado)
    const P = await window.R.recortarPersona(img), Tq = await window.R.recortarTocando(img, 0.5, 0.5);
    const W = 300, H = Math.round(W * img.height / img.width), c = document.createElement('canvas'); c.width = W * 3; c.height = H; const g = c.getContext('2d');
    g.drawImage(img, 0, 0, W, H);
    const pintar = (mm, x0, elegido) => {
      for (let y = 0; y < H; y += 12) for (let x = 0; x < W; x += 12) { g.fillStyle = ((x + y) / 12) % 2 ? '#cfcfcf' : '#f4f4f4'; g.fillRect(x0 + x, y, 12, 12); }
      const k = document.createElement('canvas'); k.width = mm.w; k.height = mm.h; const kg = k.getContext('2d'); kg.drawImage(img, 0, 0, mm.w, mm.h);
      const d = kg.getImageData(0, 0, mm.w, mm.h); for (let i = 0; i < mm.mascara.length; i++) d.data[i * 4 + 3] = mm.mascara[i]; kg.putImageData(d, 0, 0);
      g.drawImage(k, x0, 0, W, H); if (elegido) { g.strokeStyle = '#18c964'; g.lineWidth = 6; g.strokeRect(x0 + 3, 3, W - 6, H - 6); }
    };
    pintar(P, W, m.como === 'persona'); pintar(Tq, W * 2, m.como !== 'persona');
    const r3 = (x) => +x.toFixed(3);
    return { f, como: m.como, ms, persona: { cuanto: r3(P.cuanto), pelo: r3(P.pelo), piel: r3(P.piel), cara: r3(P.cara), ropa: r3(P.ropa) }, png: c.toDataURL('image/png') };
  }, f);
  fs.writeFileSync(path.join(SAL, f.replace(/\.jpe?g$/i, '.png')), Buffer.from(r.png.split(',')[1], 'base64')); delete r.png; res.push(r); console.log(JSON.stringify(r));
}
console.log('errores', JSON.stringify(err));
fs.unlinkSync(path.join(WEB, '_prueba.html')); await b.close(); srv.close();
