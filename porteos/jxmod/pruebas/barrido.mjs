// todos los mapas en cada calidad: errores de la consola, dibujos por cuadro y una foto chica de cada uno
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [,, html, pref] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const res = {};
for (const g of ['patata', 'bajo', 'medio', 'alto', 'ultra']) {
  const p = await b.newPage({ viewport: { width: 480, height: 270 } }); const err = [];
  p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /GL_|WebGL/.test(m.text()))) err.push(m.text().slice(0, 160)); });
  await p.goto('file://' + html + '?test&gfx=' + g + '&sinred=1'); await p.waitForFunction(() => window.__listo, null, { timeout: 120000 });
  res[g] = {};
  for (const m of ['Desert', 'DesertV2', 'FlatGrass', 'City', 'Base', 'BaseV2', 'Mars', 'Space']) {
    await p.evaluate((m) => window.__ev(`empezarPartida('${m}'); JUG.yaw=0.7; crearObjeto('Sedan', vadd(JUG.pos, v3(2,-1,6)), new Quat()); 1`), m);
    await p.waitForTimeout(1800);
    const d = await p.evaluate(() => window.__ev('JSON.stringify({dib: R.dibujadas, salida: R.salida, sombras: R.sombraOn ? SM.n : 0})'));
    res[g][m] = JSON.parse(d); await p.screenshot({ path: `${pref}_${g}_${m}.png` });
  }
  res[g].errores = err.slice(0, 5); await p.close();
}
console.log(JSON.stringify(res, null, 0));
await b.close();
