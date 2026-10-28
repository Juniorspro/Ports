// arranque como lo abre la gente, con escenarios de falla simulados (PRE = script que corre antes de la página)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium, devices } = require('playwright');
const [,, html, modo, pref] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext(modo === 'celu' ? { ...devices['Pixel 5'] } : { viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage(); const err = [];
p.on('pageerror', (e) => err.push('pageerror: ' + e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') err.push(m.type() + ': ' + m.text().slice(0, 160)); });
if (process.env.PRE) await p.addInitScript(process.env.PRE);
const t0 = Date.now(); await p.goto('file://' + html);
const fotos = [];
for (const ms of [700, 2500]) { await p.waitForTimeout(ms - (Date.now() - t0) > 0 ? ms - (Date.now() - t0) : 0); if (pref) { const f = pref + '_' + ms + '.png'; await p.screenshot({ path: f }); fotos.push(f); } }
let listo = false; try { await p.waitForFunction(() => window.__listo, null, { timeout: 90000 }); listo = true; } catch (e) {}
const tListo = (Date.now() - t0) / 1000;
await p.waitForTimeout(6000);
const est = await p.evaluate(() => { const c = document.getElementById('carga'); const v = document.getElementById('introV');
  return { cls: c.className, err: document.getElementById('cargaErr').innerText.slice(0, 200), video: v && { t: +v.currentTime.toFixed(2), src: v.currentSrc.slice(0, 16), terminado: v.ended },
    motor: window.__ev ? window.__ev('R.gl1 ? "webgl1" : "webgl2"') : null, fallos: localStorage.getItem('hypper_fallos'), ultimo: localStorage.getItem('hypper_ultimoError'), estado: window.__ev ? window.__ev('JUEGO.estado') : null }; });
if (pref) await p.screenshot({ path: pref + '_fin.png' });
console.log(JSON.stringify({ modo, listo, tListo, est, err: err.slice(0, 6) }));
await b.close();
