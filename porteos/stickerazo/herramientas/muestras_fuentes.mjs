// Las muestras del selector de letras: el nombre de cada una de las «más letras», escrito con esa letra (blanco sobre
// transparente; la app lo usa de máscara, así sirve en el tema claro y en el oscuro). Una imagen por tipo (divertidas,
// a mano…): el selector baja sólo las que se van viendo, en vez de 400 y pico de archivos. Las dibuja Chromium (como
// la app) con los archivos de fuentes/, y Pillow las pasa a WebP con el alfa comprimido (la mitad de peso).
// uso (después de herramientas/fuentes_extra.py): node herramientas/muestras_fuentes.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..'), LISTA = join(RAIZ, 'web', 'fuentes_extra.json'), SAL = join(RAIZ, 'fuentes');
const COLS = 4, W = 280, H = 40, K = 2;   // (celdas de 280×40, el doble de definición)
const datos = JSON.parse(readFileSync(LISTA, 'utf8')), fuentes = datos.fuentes, cats = [...new Set(fuentes.map((f) => f.cat))];
const b = await chromium.launch(), p = await b.newPage(), tmp = mkdtempSync(join(tmpdir(), 'muestras-'));
const muestras = {}, nuevos = new Set();
for (const cat of cats) {
  const grupo = fuentes.filter((f) => f.cat === cat);
  grupo.forEach((f, i) => { f.m = i; });
  const lote = grupo.map((f) => ({ id: f.id, nombre: f.nombre, b64: readFileSync(join(SAL, f.archivo)).toString('base64') }));
  const url = await p.evaluate(async ({ lote, COLS, W, H, K }) => {
    for (const f of lote) { const ff = new FontFace(f.id, Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0))); await ff.load(); document.fonts.add(ff); }
    const filas = Math.ceil(lote.length / COLS), c = document.createElement('canvas'); c.width = COLS * W * K; c.height = filas * H * K;
    const g = c.getContext('2d'); g.scale(K, K); g.fillStyle = '#fff';
    lote.forEach((f, i) => {
      const x = (i % COLS) * W, y = Math.floor(i / COLS) * H; let t = 25;
      g.font = `${t}px "${f.id}"`; const m = g.measureText(f.nombre), alto = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      // (que entre en la celda: ni muy ancha ni muy alta)
      // (por el ancho de verdad de lo dibujado: hay letras a mano que se salen de su propio lugar)
      const ancho = Math.max(m.width, m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
      t = Math.min(t, (t * (W - 14)) / ancho, (t * (H - 8)) / Math.max(1, alto)); g.font = `${t}px "${f.id}"`;
      const m2 = g.measureText(f.nombre), medio = (m2.actualBoundingBoxAscent - m2.actualBoundingBoxDescent) / 2;
      g.save(); g.beginPath(); g.rect(x, y, W, H); g.clip(); g.textBaseline = 'alphabetic'; g.fillText(f.nombre, x + 4 + Math.max(0, m2.actualBoundingBoxLeft), y + H / 2 + medio); g.restore();
    });
    return c.toDataURL('image/png');
  }, { lote, COLS, W, H, K });
  const png = join(tmp, cat + '.png'), webp = join(tmp, cat + '.webp');
  writeFileSync(png, Buffer.from(url.split(',')[1], 'base64'));
  execFileSync('python3', ['-I', '-c', 'import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).save(sys.argv[2], "WEBP", quality=80, alpha_quality=60, method=6)', png, webp]);
  const buf = readFileSync(webp), nombre = `muestras-${cat}-${createHash('sha256').update(buf).digest('hex').slice(0, 10)}.webp`;
  writeFileSync(join(SAL, nombre), buf); nuevos.add(nombre);
  muestras[cat] = { archivo: nombre, n: buf.length };
  console.log(`  ${cat}: ${grupo.length} letras → ${nombre} (${(buf.length / 1024).toFixed(0)} KB)`);
}
await b.close(); rmSync(tmp, { recursive: true, force: true });
for (const f of readdirSync(SAL)) if (/^muestras-.*\.webp$/.test(f) && !nuevos.has(f)) unlinkSync(join(SAL, f));
writeFileSync(LISTA, JSON.stringify({ cols: COLS, w: W, h: H, muestras, fuentes }));
console.log(`muestras: ${fuentes.length} letras, ${(Object.values(muestras).reduce((s, x) => s + x.n, 0) / 1024).toFixed(0)} KB en total`);
