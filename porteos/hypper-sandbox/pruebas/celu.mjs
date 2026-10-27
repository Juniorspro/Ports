// teléfono con pantalla táctil (acostado o parado: parado se gira 90°): menú real, un jugador, palanca, menú de spawn
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [,, html, pref, orient] = process.argv;
const parado = orient === 'parado', W = parado ? 360 : 800, H = parado ? 800 : 360;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const c = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await c.newPage(); const err = []; p.on('pageerror', (e) => err.push(e.message));
await p.goto('file://' + html + '?test&sinred=1&gpu=' + encodeURIComponent('Adreno (TM) 610'));
await p.waitForFunction(() => window.__listo, null, { timeout: 120000 }); await p.waitForTimeout(2000);
const ev = (s) => p.evaluate((s) => window.__ev(s), s);
await p.screenshot({ path: pref + '_menu.png' });
await p.tap('[data-r="Main/NicknamePanel/Panel/OK"]'); await p.waitForTimeout(300);
await p.tap('[data-r="Main/MainMenu/Singleplayer"]'); await p.waitForTimeout(400);
await p.screenshot({ path: pref + '_solo.png' });
await p.tap('[data-r="Main/SinglePlayer/CreateServerButton"]'); await p.waitForTimeout(3500);
console.log('estado', await ev('JSON.stringify({e: JUEGO.estado, rot: PANT.rot, vw: VW(), vh: VH(), cv: [R.cv.width, R.cv.height], mapa: MUNDO.nombre})'));
await p.screenshot({ path: pref + '_juego.png' });
// palanca: arrastrar "hacia arriba" en la pantalla del juego (coordenadas del juego → de la pantalla)
const cs = await p.evaluate(() => window.__ev('PANT.rot'));
const aPant = (x, y) => (cs ? { x: W - y, y: x } : { x, y });
const cdp = await c.newCDPSession(p);
const t0 = aPant(120, (cs ? W : H) - 110), t1 = aPant(120, (cs ? W : H) - 170);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: t0.x, y: t0.y, id: 1 }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: t1.x, y: t1.y, id: 1 }] });
await p.waitForTimeout(100);
const ent = await ev('JSON.stringify({x: +ENT.x.toFixed(2), y: +ENT.y.toFixed(2)})');
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
console.log('palanca (arriba = y positivo)', ent);
// mirar: arrastrar a la derecha en la mitad derecha
const yaw0 = await ev('JUG.yaw');
const m0 = aPant(600 * (cs ? 1 : 1), 150), m1 = aPant(660, 150);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: m0.x, y: m0.y, id: 2 }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: m1.x, y: m1.y, id: 2 }] });
await p.waitForTimeout(100);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
console.log('mirar a la derecha baja el yaw', yaw0, await ev('JUG.yaw'));
await p.tap('[data-btn="menu"]'); await p.waitForTimeout(800); await p.screenshot({ path: pref + '_spawn.png' });
console.log(await ev('JSON.stringify({ perfil: GFX.base, esc: GFX.escala, fps: Math.round(TIEMPO.fps) })'));
console.log(err.join('\n')); await b.close();
