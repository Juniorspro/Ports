// en el celu (horizontal y parado/girado): mantener el disparo y mover la palanca al mismo tiempo (los dos dedos se
// mueven en el mismo evento) no tiene que girar la cámara; mirar arrastrando desde el disparo sí, lo que se arrastró.
// Mide el salto más grande del giro (yaw) cuadro a cuadro. En la compu: disparar caminando con el mouse quieto.
// uso: node disparo_mover.mjs HTML
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const HTML = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
for (const [nom, vp] of [['horizontal', { width: 873, height: 393 }], ['parado (girado)', { width: 393, height: 873 }]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', (e) => err.push(e.message.slice(0, 160)));
  await p.goto('file://' + HTML + '?test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); elegirArma(ARM.lista.indexOf('Pistol')); 1`);
  await p.waitForTimeout(2500);
  const cdp = await ctx.newCDPSession(p);
  // dónde están (en coordenadas de la pantalla del aparato) el botón de disparo y un punto de la palanca
  const geo = await ev(`(() => { const r = $('bdisparo').getBoundingClientRect(); return { bd: [r.left + r.width / 2, r.top + r.height / 2], rot: PANT.rot, iw: innerWidth, ih: innerHeight }; })()`);
  // la palanca: a la izquierda de la pantalla del juego (girada: arriba de la pantalla del aparato... el juego mide tX = clientY)
  const pal = geo.rot ? [geo.iw * 0.5, geo.ih * 0.2] : [geo.iw * 0.18, geo.ih * 0.6];
  const toques = (pts) => pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 }));
  const yaw0 = await ev(`JUG.yaw`);
  await ev(`window.__saltos = []; window.__ya = JUG.yaw; window.__mira = setInterval(() => { const d = Math.abs(((JUG.yaw - window.__ya + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI); window.__saltos.push(d); window.__ya = JUG.yaw; }, 16); 1`);
  // 1) apoyar la palanca, después el disparo; mover los dos a la vez (el disparo apenas tiembla) 40 veces
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: toques([pal]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: toques([pal, geo.bd]) });
  for (let i = 1; i <= 40; i++) {
    const a = i * 0.25, pp = [pal[0] + Math.sin(a) * 30, pal[1] - 25 - Math.cos(a) * 10], bb = [geo.bd[0] + (i % 2 ? 0.6 : -0.6), geo.bd[1] + (i % 3 ? 0.4 : -0.4)];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: toques([pp, bb]) });
    await p.waitForTimeout(20);
  }
  const disp = await ev(`ENT.disparo`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(200);
  const s1 = await ev(`(() => { const s = window.__saltos; window.__saltos = []; return { max: +(Math.max(0, ...s) * 180 / Math.PI).toFixed(1), total: 0 }; })()`);
  const yaw1 = await ev(`JUG.yaw`);
  ok(`${nom}: disparar y moverte no gira la cámara`, s1.max < 3, { 'salto máx (°)': s1.max, 'giro total (°)': +((yaw1 - yaw0) * 180 / Math.PI).toFixed(1), disparaba: disp });
  // 2) mirar arrastrando desde el disparo (sin palanca): gira lo arrastrado, sin saltos
  const y2 = await ev(`JUG.yaw`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: toques([geo.bd]) });
  const paso = geo.rot ? [0, 6] : [6, 0];   // (girado: arrastrar a la derecha del juego es bajar en la pantalla del aparato)
  for (let i = 1; i <= 20; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: toques([[geo.bd[0] + paso[0] * i, geo.bd[1] + paso[1] * i]]) }); await p.waitForTimeout(20); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(200);
  const s2 = await ev(`(() => { const s = window.__saltos; window.__saltos = []; return +(Math.max(0, ...s) * 180 / Math.PI).toFixed(1); })()`);
  const g2 = +((await ev(`JUG.yaw`) - y2) * 180 / Math.PI).toFixed(1), esperado = +(-120 * 0.006 * 180 / Math.PI).toFixed(1);
  ok(`${nom}: arrastrar desde el disparo mira lo arrastrado`, Math.abs(g2 - esperado) < 3 && s2 < 6, { 'giro (°)': g2, esperado, 'salto máx (°)': s2 });
  // 3) una segunda vez (que no quede guardada la posición del dedo anterior): apoyar en otro lugar del botón y mover poquito
  const y3 = await ev(`JUG.yaw`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: toques([[geo.bd[0] - 8, geo.bd[1] + 8]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: toques([[geo.bd[0] - 8, geo.bd[1] + 9]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await p.waitForTimeout(100);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: toques([[geo.bd[0] + 10, geo.bd[1] - 10]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: toques([[geo.bd[0] + 10, geo.bd[1] - 9]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(150);
  const g3 = Math.abs((await ev(`JUG.yaw`) - y3) * 180 / Math.PI);
  ok(`${nom}: después de un toque cancelado no salta`, g3 < 1.5, { 'giro (°)': +g3.toFixed(2) });
  ok(`${nom}: sin errores`, !err.length, err.slice(0, 3));
  await ctx.close();
}
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
