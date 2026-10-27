// pasos guionados: cada paso = código para evaluar en la página + espera + foto opcional
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const fs = require('fs');
const [,, archivo, guion, pref, w, h, extra] = process.argv;
const pasos = JSON.parse(fs.readFileSync(guion, 'utf8'));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w || 960, height: +h || 540 } });
const err = []; p.on('pageerror', (e) => err.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n')[1])); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text()); else if (m.text().startsWith('LOG')) console.log(m.text()); });
await p.goto('file://' + archivo + '?test' + (extra || ''));
await p.waitForFunction(() => window.__listo, null, { timeout: 120000 });
let i = 0;
for (const s of pasos) {
  if (s.js) { const r = await p.evaluate((c) => { try { return window.__ev(c); } catch (e) { return 'ERR ' + e.message; } }, s.js); if (r !== undefined && r !== null) console.log('->', typeof r === 'string' ? r : JSON.stringify(r)); }
  if (s.espera) await p.waitForTimeout(s.espera);
  if (s.foto) { await p.screenshot({ path: pref + '_' + s.foto + '.png' }); }
  i++;
}
console.log(err.slice(0, 15).join('\n'));
await b.close();
