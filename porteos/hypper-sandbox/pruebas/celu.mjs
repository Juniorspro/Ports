// teléfono acostado con pantalla táctil: menú principal, juego con controles, menú de spawn
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [,, html, pref] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const c = await b.newContext({ viewport: { width: 800, height: 360 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await c.newPage(); const err = []; p.on('pageerror', (e) => err.push(e.message));
await p.goto('file://' + html + '?test&gpu=' + encodeURIComponent('Adreno (TM) 610'));
await p.waitForFunction(() => window.__listo, null, { timeout: 120000 }); await p.waitForTimeout(2500);
await p.screenshot({ path: pref + '_menu.png' });
await p.tap('#bJugar'); await p.waitForTimeout(3000);
await p.evaluate(() => window.__ev("document.body.classList.add('tactil'); ENT.tactil = true"));
await p.waitForTimeout(500); await p.screenshot({ path: pref + '_juego.png' });
await p.tap('[data-btn="menu"]'); await p.waitForTimeout(800); await p.screenshot({ path: pref + '_spawn.png' });
console.log(await p.evaluate(() => window.__ev('JSON.stringify({ perfil: GFX.base, esc: GFX.escala, lejos: GFX.lejos, cv: [R.cv.width, R.cv.height], fps: Math.round(TIEMPO.fps) })')));
console.log(err.join('\n')); await b.close();
