// después de la intro, la pantalla de carga mientras sigue bajando (celular parado y acostado): ¿está girada y entra?
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import http from 'http'; import fs from 'fs';
const [,, html, dir] = process.argv; fs.mkdirSync(dir, { recursive: true });
const datos = fs.readFileSync(html), VEL = 2e6;
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': datos.length }); let i = 0; const paso = () => { if (i >= datos.length) { r.end(); return; } const n = Math.min(datos.length - i, VEL / 20); r.write(datos.subarray(i, i + n)); i += n; setTimeout(paso, 50); }; paso(); });
await new Promise((ok) => srv.listen(8933, '127.0.0.1', ok));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [nom, opts] of [['parado', { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true }], ['acostado', { viewport: { width: 800, height: 360 }, isMobile: true, hasTouch: true }]]) {
  const c = await b.newContext(opts), p = await c.newPage();
  p.goto('http://127.0.0.1:8933/j.html?sinred=1').catch(() => {});
  await p.waitForFunction(() => window.__intro && window.__intro.fin, null, { timeout: 120000, polling: 200 });
  await p.waitForTimeout(700); await p.screenshot({ path: dir + '/' + nom + '_carga.png' });
  console.log(nom, JSON.stringify(await p.evaluate(() => ({ rot: document.documentElement.classList.contains('rot'), carga: document.getElementById('carga').className, listo: !!window.__listo, vw: getComputedStyle(document.documentElement).getPropertyValue('--vw') }))));
  await c.close();
}
await b.close(); srv.close();
