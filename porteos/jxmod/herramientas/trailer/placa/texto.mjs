// el texto de la placa final con la tipografía del juego (Oswald), blanco sobre transparente, a PNG
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const AQ = path.dirname(new URL(import.meta.url).pathname);
const fuente = fs.readFileSync(path.join(AQ, '..', '..', '..', 'juego', 'fuentes', 'oswald_jx.woff2')).toString('base64');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 400 }, deviceScaleFactor: 1 });
const html = (txt, px, peso, esp) => `<html><head><style>
@font-face { font-family: O; src: url(data:font/woff2;base64,${fuente}) format('woff2'); font-weight: 200 700; }
html, body { margin: 0; background: transparent; }
#t { display: inline-block; font-family: O; font-weight: ${peso}; font-size: ${px}px; letter-spacing: ${esp}em; color: #fff; line-height: 1; padding: 20px 40px 20px ${40 + px * esp}px; white-space: nowrap; }
</style></head><body><span id="t">${txt}</span></body></html>`;
for (const [nombre, txt, px, peso, esp] of [['beta', 'BETA LANZADA', 190, 700, 0.12], ['sub', 'JXMOD 3.0', 64, 500, 0.42]]) {
  await p.setContent(html(txt, px, peso, esp)); await p.evaluate(() => document.fonts.ready);
  const el = await p.$('#t'); await el.screenshot({ path: path.join(AQ, nombre + '.png'), omitBackground: true });
  console.log(nombre, await el.boundingBox());
}
await b.close();
