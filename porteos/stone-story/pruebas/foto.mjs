// Abre el juego como telefono acostado, espera, saca fotos y cuenta errores. Uso: node foto.mjs URL PREFIJO [segundos] [js]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [url, pre, seg = '3', codigo = ''] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
await p.goto(url);
await p.waitForFunction(() => window.prueba && window.prueba.listo, null, { timeout: 60000 });
if (codigo) console.log('eval:', JSON.stringify(await p.evaluate(codigo)));
for (let i = 0; i < 2; i++) { await p.waitForTimeout(+seg * 500); await p.screenshot({ path: `${pre}${i}.png` }); }
console.log('estado:', JSON.stringify(await p.evaluate(() => ({ cols: Pantalla.cols, filas: Pantalla.filas, t: Juego.t }))));
console.log('errores de la página:', errores.length, errores.slice(0, 5).join(' | '));
await b.close();
