// Los fondos animados del menú clásico (pedido del dueño: «que los fondos ahora sean animados de verdad: renders que se
// reproducen detrás del juego, pero de manera fluida, tirando a video quizás, pero a la vez render para no gastar tanto»):
//  1. los videos: uno por escena (las 6 de FONDOS_RB), MP4 con H.264 (perfil high), todos juntos ≤ 5 MB;
//  2. corre: en el celular del dueño (873×402 a 2×) y en la compu (1920×1080) el video de la escena a la vista corre, y al
//     mostrarse estaba parado en su primer cuadro (≤ 1/30 s), que es la foto: PSNR ≥ 35 dB entre los dos (sin salto);
//  3. fluido: (a) cuadro por cuadro en el navegador, pasando el empalme del bucle: ninguno repetido, y cuánto cambia del último
//     al primero (en el fogonazo de una explosión, a propósito: bucle.py); (b) en vivo, con
//     requestVideoFrameCallback, ≥ 27 cuadros por segundo a la vista, ninguno repetido ni salteado (con SwiftShader el video
//     se decodifica y compone por software y depende de cuánto procesador sobra: se anota, no cuenta);
//  4. un solo video decodificando: fuera del cambio de escena, uno con fuente; en el fundido, dos; a los 2,2 s, uno, y el
//     nuevo arrancó desde su primer cuadro; y la escena pasa sola cuando su video llega a los 8 s (el fundido de 1,8 s termina
//     antes de los 10 del bucle: el video nunca vuelve a empezar a la vista);
//  5. con un panel encima: en pausa y sin cuadros nuevos en 2 s (no decodifica); al cerrarlo, sigue desde ahí;
//  6. en segundo plano (la pestaña oculta): en pausa; al volver, sigue;
//  7. en la partida: ningún video con fuente (soltado: ni decodificador ni memoria); al volver al menú, vuelve a correr;
//  8. con Gráficos Patata, «menos movimiento» y Gráficos Bajos: las fotos, sin bajar ningún video (0 pedidos a fondos/);
//  9. si el video no está (404, sin internet la primera vez) queda la foto; si no es un video (no se puede decodificar),
//     la foto y vuelve el agrandado lento; sin errores en los dos;
// 10. sin errores de JS;
// 11. (WEB_CODIGO=URL y CODIGOS=archivo) en la web con código: los videos van cifrados (no son MP4), el juego los descifra y
//     corre; sin internet, después de la primera vez (el service worker los guardó), también (SIN_SUBTLE=1: sin
//     crypto.subtle, con el AES en JS).
// COSTO=URL_36 (opcional): contra la 3.6 en las mismas condiciones (procesador 4× más lento, 873×402 a 2×, el menú quieto, 3
// corridas alternadas —CORRIDAS—): JS y hilo principal en ms por segundo, cuadros que compone la placa por segundo, heap y el
// tiempo hasta poder tocar el menú (pide ≤ +10 %). BAJOS=1: además, el de ahora con Gráficos Bajos (las fotos), sólo informa.
// uso: node fondos_video.mjs URL_HTML [CARPETA_FOTOS]   (SOLO=1,2…: sólo esas partes)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import { readFileSync, unlinkSync, mkdirSync } from 'fs'; import { tmpdir } from 'os';
const [, , HTML, DIR = ''] = process.argv, D = DIR ? DIR.replace(/\/$/, '') + '/' : '';
if (D) try { mkdirSync(D, { recursive: true }); } catch (e) {}
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + (info === undefined ? '' : ' · ' + JSON.stringify(info).slice(0, 1600))); return ok; };
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'];
const CHROME = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const SOLO = (process.env.SOLO || '').split(',').filter(Boolean), corre = (n) => !SOLO.length || SOLO.includes(String(n));
const PRESUPUESTO = 5e6;   // (5 MB de los de 1000)
const FUERA = /Failed to load resource|net::ERR|WebSocket|mqtt|ERR_NAME/i;
const errJS = [];
const PREFS0 = (extra) => Object.assign({ bienvenida: true, tutVisto: true, nombre: 'NijulaX', nombreOk: true, lang: 'es', mapa: 'Desert' }, extra || {});
const b = await chromium.launch({ executablePath: CHROME, args: ARGS });
// abrir el juego. o: { w, h, dpr, movil, q, reducido, ruta (cambiar las respuestas de fondos/) }
async function abrir(nom, o = {}) {
  const ctx = await b.newContext({ viewport: { width: o.w || 873, height: o.h || 402 }, deviceScaleFactor: o.dpr || 2, isMobile: o.movil !== false, hasTouch: o.movil !== false, locale: 'es-AR', reducedMotion: o.reducido ? 'reduce' : 'no-preference' });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  if (o.ruta) await ctx.route('**/fondos/**', o.ruta);
  await ctx.addInitScript((P) => { try { if (!localStorage.getItem('jx_prefs')) localStorage.setItem('jx_prefs', JSON.stringify(P)); } catch (e) {} }, PREFS0());
  // (cada vez que un video del fondo se muestra: en qué instante estaba y si estaba parado)
  await ctx.addInitScript(() => {
    window.__ve = [];
    new MutationObserver((L) => { for (const m of L) { const v = m.target; if (v.tagName === 'VIDEO' && v.classList.contains('ve') && !(m.oldValue || '').includes('ve')) window.__ve.push({ t: v.currentTime, parado: v.paused, k: v.dataset.k, cuando: performance.now() }); } })
      .observe(document, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  });
  const p = await ctx.newPage(); const pedidos = [];
  p.on('request', (r) => { if (/\/fondos\/[^/]+\.mp4/.test(r.url())) pedidos.push(r.url().replace(/^.*\/fondos\//, '')); });
  p.on('pageerror', (e) => errJS.push(nom + ': ' + e.message.slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error' && !FUERA.test(m.text())) errJS.push(nom + ' consola: ' + m.text().slice(0, 200)); });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await p.goto(HTML + '?test' + (o.q || '')); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
  try { await p.waitForFunction(() => window.__ev(`RB.home === 'clasico' && clVisible() && !CL.el.classList.contains('clEntra')`), null, { timeout: 30000 }); } catch (e) {}
  return { ctx, p, ev, pedidos };
}
const esperar = async (p, js, ms = 15000) => { try { await p.waitForFunction((x) => window.__ev(x), js, { timeout: ms }); return true; } catch (e) { return false; } };
// el video que se ve (la capa del fondo a la vista)
const VID = `RB.el.querySelector('.rbBg.on video.ve')`;
const CORRE = `(() => { const v = ${VID}; return !!v && !v.paused && v.currentTime > 0; })()`;
const CON_FUENTE = `RB.el.querySelectorAll('.rbBg video[src]').length`;
// cuadros a la vista en ms milisegundos (requestVideoFrameCallback): cuántos y cómo avanza el tiempo del video entre uno y otro
const CUADROS = (ms) => `new Promise((ok) => { const v = ${VID}; if (!v || !v.requestVideoFrameCallback) return ok(null); const L = [], t0 = performance.now();
  const f = (now, md) => { L.push([now, md.mediaTime, md.presentedFrames]); if (performance.now() - t0 < ${ms}) v.requestVideoFrameCallback(f); }; v.requestVideoFrameCallback(f);
  setTimeout(() => { const d = []; for (let i = 1; i < L.length; i++) { let x = L[i][1] - L[i - 1][1]; if (x < -1) x += v.duration; d.push(x); }
    const fr = 1 / 30; ok({ n: L.length, porSeg: L.length / (${ms} / 1000), repetidos: d.filter((x) => x < fr * 0.5).length, salteados: d.filter((x) => x > fr * 1.5).length, dMax: d.length ? +(Math.max(...d) * 30).toFixed(2) : 0, dur: v.duration }); }, ${ms} + 120); })`;

// ======================= 1. los videos =======================
if (corre(1)) {
  const A = await abrir('videos');
  const L = await A.ev(`(async () => { const r = []; for (const e of FONDOS_VIDEO) { if (!e) { r.push(null); continue; } const x = await fetch(e[0]); let u = new Uint8Array(await x.arrayBuffer()); const cif = !!FV_DESC; if (FV_DESC) u = await FV_DESC(u);
    const txt = new TextDecoder('latin1').decode(u.subarray(0, Math.min(u.length, 400000))); r.push({ f: e[0], bytes: u.length, ftyp: txt.slice(4, 8), avc1: txt.includes('avc1'), avcC: txt.includes('avcC'), alto: u[txt.indexOf('avcC') + 5] === 100, cif }); } return { fotos: FONDOS_RB.length, r }; })()`);
  const tot = L.r.reduce((a, x) => a + (x ? x.bytes : 0), 0);
  caso(`1. los videos: ${L.r.filter(Boolean).length} de ${L.fotos} escenas, MP4 con H.264 perfil high; en total ${(tot / 1e6).toFixed(2)} MB (pide ≤ 5)`, L.r.length === L.fotos && L.fotos === 6 && L.r.every((x) => x && x.ftyp === 'ftyp' && x.avc1 && x.alto) && tot <= PRESUPUESTO, L.r.map((x) => x && [x.f, x.bytes, x.ftyp, x.avc1, x.alto, x.cif]));
  await A.ctx.close();
}

// ======================= 2 y 3. corre, sin salto y fluido =======================
for (const [nom, o] of [['celular 873×402', {}], ['compu 1920×1080', { w: 1920, h: 1080, dpr: 1, movil: false }]]) {
  if (!corre(2) && !corre(3)) break;
  const A = await abrir(nom, o);
  const va = await esperar(A.p, CORRE, 20000);
  const ve = await A.ev(`window.__ve.slice()`);
  // (el primer cuadro del video contra la foto de su escena: los dos dibujados a 1280×720 en un lienzo)
  const psnr = await A.ev(`(async () => { const v0 = ${VID}, k = +v0.dataset.k, u = FV.url[k]; const W = 1280, H = 720;
    const lienzo = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c.getContext('2d', { willReadFrequently: true }); };
    const v = document.createElement('video'); v.muted = true; v.src = u; await new Promise((r) => { v.onloadeddata = r; v.load(); }); v.currentTime = 0; await new Promise((r) => { v.onseeked = r; setTimeout(r, 1500); });
    const a = lienzo(); a.drawImage(v, 0, 0, W, H); const im = new Image(); im.src = FONDOS_RB[k]; await im.decode(); const f = lienzo(); f.drawImage(im, 0, 0, W, H);
    const x = a.getImageData(0, 0, W, H).data, y = f.getImageData(0, 0, W, H).data; let s = 0, n = 0; for (let i = 0; i < x.length; i += 4) for (let j = 0; j < 3; j++) { const d = x[i + j] - y[i + j]; s += d * d; n++; }
    const mse = s / n; return { k, psnr: +(10 * Math.log10(255 * 255 / Math.max(mse, 1e-9))).toFixed(2), medio: +Math.sqrt(mse).toFixed(2) }; })()`);
  // (se muestra parado en el cuadro 0 y en el mismo momento arranca: el observador lo ve un instante después, ya corriendo,
  // con el tiempo todavía en el primer cuadro)
  const sinSalto = ve.length > 0 && ve.every((x) => x.t <= 1 / 30 + 1e-3);
  if (corre(2)) caso(`2. ${nom}: el video de la escena corre; al mostrarse estaba parado en su primer cuadro (${ve.map((x) => x.t.toFixed(3) + ' s').join(', ')}), igual a la foto: PSNR ${psnr.psnr} dB (pide ≥ 35)`, va && sinSalto && psnr.psnr >= 35, { ve, psnr });
  if (D) await A.p.screenshot({ path: D + 'menu_' + nom.replace(/[^a-z0-9]+/gi, '_') + '.png' });
  if (corre(3)) {
    // (sin el cambio de escena mientras se mide: pasaría a los 8 s del video)
    await A.ev(`(clearInterval(RB.reloj), RB.reloj = 1, clearTimeout(FV.tPasar), 1)`);
    // a. el contenido, cuadro por cuadro en el navegador (el video parado, llevado a cada cuadro: el Chromium de prueba
    // decodifica y compone sin placa y en vivo se saltea cuadros), los 15 últimos y los 15 primeros: cada uno es otro cuadro
    // (ninguno repetido) y el paso del último al primero —a propósito en el fogonazo de una explosión, bucle.py— comparado
    // con la mediana entre dos seguidos (a 320×180; lo que agrega la compresión ahí lo mide bucle.py sobre el archivo)
    const cap = await A.ev(`(async () => { const v = ${VID}; v.pause(); const N = Math.round(v.duration * 30), c = document.createElement('canvas'); c.width = 320; c.height = 180;
      const g = c.getContext('2d', { willReadFrequently: true }), L = []; let ant = null;
      for (let k = -15; k < 15; k++) { const i = (k + N) % N;
        await new Promise((ok) => { const t = setTimeout(ok, 4000); v.addEventListener('seeked', () => { v.requestVideoFrameCallback ? v.requestVideoFrameCallback(() => { clearTimeout(t); ok(); }) : (clearTimeout(t), ok()); }, { once: true }); v.currentTime = (i + 0.5) / 30; });
        g.drawImage(v, 0, 0, 320, 180); const d = g.getImageData(0, 0, 320, 180).data; let s = 0;
        if (ant) { for (let j = 0; j < d.length; j += 4) s += Math.abs(d[j] - ant[j]) + Math.abs(d[j + 1] - ant[j + 1]) + Math.abs(d[j + 2] - ant[j + 2]); s /= d.length * 0.75; }
        ant = d; L.push([i, +s.toFixed(3)]); }
      v.play(); return L; })()`);
    const difs = cap.slice(1).map((x) => x[1]), emp = cap[15][1], otros = difs.filter((x, i) => i !== 14), med = [...otros].sort((a, b2) => a - b2)[otros.length >> 1];
    caso(`3a. ${nom}: cuadro por cuadro en el navegador, 30 seguidos pasando el empalme: ${difs.filter((x) => x < 0.05).length} repetidos; del último al primero ${emp.toFixed(2)} contra ${med.toFixed(2)} de mediana entre dos seguidos (×${(emp / med).toFixed(2)}: en el fogonazo de una explosión, a propósito)`,
      !difs.some((x) => x < 0.05), { cap });
    // b. en vivo, a velocidad normal (requestVideoFrameCallback): cuántos cuadros por segundo llegan a la pantalla. En la
    // prueba el video se decodifica y se compone por software (SwiftShader, sin placa): no es lo que pasa en un celular
    await A.p.waitForTimeout(300);
    const c = await A.ev(CUADROS(4000)), q = await A.ev(`(() => { const x = ${VID}.getVideoPlaybackQuality(); return { total: x.totalVideoFrames, perdidos: x.droppedVideoFrames }; })()`);
    // (con SwiftShader —sin placa— el número depende de cuánto procesador sobra: se anota y no cuenta; con una placa de
    // verdad, cuenta)
    const sw = await A.ev(`(() => { try { const d = R.gl.getExtension('WEBGL_debug_renderer_info'); return /swiftshader/i.test(R.gl.getParameter(d.UNMASKED_RENDERER_WEBGL)); } catch (e) { return false; } })()`);
    const t3b = `3b. ${nom}: en vivo ${c.porSeg.toFixed(1)} cuadros por segundo a la vista (pide ≥ 27), ${c.repetidos} repetidos y ${c.salteados} salteados (el mayor paso, ${c.dMax} cuadros); perdidos por el navegador ${q.perdidos} de ${q.total}`;
    if (sw) console.log('INFO  ' + t3b + ' — con SwiftShader (decodifica y compone por software): no cuenta · ' + JSON.stringify({ c, q }));
    else caso(t3b, c.porSeg >= 27 && !c.repetidos && !c.salteados, { c, q });
  }
  await A.ctx.close();
}

// ======================= 4. el cambio de escena =======================
if (corre(4)) {
  const A = await abrir('cambio de escena');
  await esperar(A.p, CORRE, 20000);
  const antes = await A.ev(CON_FUENTE), k0 = await A.ev(`+${VID}.dataset.k`);
  await A.ev(`window.__ve.length = 0; clearInterval(RB.reloj); RB.reloj = 1; inicioFondoPasar(), 1`);
  await A.p.waitForTimeout(900); const enFundido = await A.ev(`({ n: ${CON_FUENTE}, corren: [...RB.el.querySelectorAll('.rbBg video[src]')].filter((v) => !v.paused).length })`);
  await A.p.waitForTimeout(1500); const despues = await A.ev(`({ n: ${CON_FUENTE}, k: ${VID} ? +${VID}.dataset.k : -1, corre: ${CORRE} })`); const ve = await A.ev(`window.__ve.slice()`);
  caso(`4a. un solo video decodificando: antes ${antes}; en el fundido ${enFundido.n} (${enFundido.corren} corriendo); a los 2,4 s ${despues.n}, la escena ${k0} → ${despues.k}, que arrancó parada en ${ve.map((x) => x.t.toFixed(3)).join(', ')} s`, antes === 1 && enFundido.n <= 2 && despues.n === 1 && despues.k === (k0 + 1) % 6 && despues.corre && ve.length && ve[0].t <= 1 / 30 + 1e-3, { antes, enFundido, despues, ve });
  // (y solo, con el reloj: la escena pasa cuando el video llega a los 8 s —el fundido termina antes de los 10 del bucle, así
  // nunca vuelve a empezar a la vista—)
  await A.ev(`(() => { const o = inicioFondoPasar; window.__pasoT = null; inicioFondoPasar = function () { const v = RB.el.querySelector('.rbBg.on video.ve'); window.__pasoT = v ? v.currentTime : -1; inicioFondoPasar = o; return o.apply(this, arguments); }; RB.reloj = setInterval(inicioFondoReloj, 1000); return 1; })()`);
  const pasoSolo = await esperar(A.p, `window.__pasoT !== null`, 20000), tPaso = await A.ev(`window.__pasoT`);
  caso(`4b. la escena pasa sola cuando el video llega a los 8 s (pasó a los ${tPaso === null ? '?' : tPaso.toFixed(2)} s): el fundido termina antes del final del bucle`, pasoSolo && tPaso >= 7.9 && tPaso <= 8.25, { tPaso });
  await A.ctx.close();
}

// ======================= 5, 6 y 7. en pausa cuando no se ve =======================
if (corre(5) || corre(6) || corre(7)) {
  const A = await abrir('pausa');
  await esperar(A.p, CORRE, 20000);
  if (corre(5)) {
    await A.ev(`inicioPanel('nueva'), 1`); await A.p.waitForTimeout(400);
    const t0 = await A.ev(`RB.el.querySelector('.rbBg.on video').currentTime`);
    const c = await A.ev(`new Promise((ok) => { const v = RB.el.querySelector('.rbBg.on video'); let n = 0; const f = () => { n++; v.requestVideoFrameCallback(f); }; v.requestVideoFrameCallback(f); setTimeout(() => ok({ n, parado: v.paused, t: v.currentTime }), 2000); })`);
    await A.ev(`inicioPanel(null), 1`); const sigue = await esperar(A.p, CORRE, 5000); const t1 = await A.ev(`${VID} ? ${VID}.currentTime : -1`);
    caso(`5. con un panel encima: en pausa, ${c.n} cuadros nuevos en 2 s (el tiempo del video quieto: ${t0.toFixed(3)} → ${c.t.toFixed(3)}); al cerrarlo sigue`, c.parado && c.n === 0 && Math.abs(c.t - t0) < 1e-3 && sigue, { t0, c, t1 });
  }
  if (corre(6)) {
    await A.ev(`(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); return 1; })()`);
    await A.p.waitForTimeout(300); const oculto = await A.ev(`RB.el.querySelector('.rbBg.on video').paused`);
    await A.ev(`(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); return 1; })()`);
    const sigue = await esperar(A.p, CORRE, 5000);
    caso('6. en segundo plano (la pestaña oculta): en pausa; al volver, sigue', oculto && sigue, { oculto, sigue });
  }
  if (corre(7)) {
    await A.ev(`(() => { inicioMostrar(false); empezarPartida('FlatGrass'); return 1; })()`);
    const juega = await esperar(A.p, `JUEGO.estado === 'juego' && MUNDO.nombre === 'FlatGrass'`, 120000); await A.p.waitForTimeout(1500);
    const enPartida = await A.ev(`({ fuente: ${CON_FUENTE}, hay: FV.hay, blobs: Object.keys(FV.url).length })`);
    await A.ev(`irMenuPrincipal(), 1`); const vuelve = await esperar(A.p, CORRE, 25000);
    caso(`7. en la partida: ${enPartida.fuente} videos con fuente y ${enPartida.blobs} guardados (soltados); al volver al menú, corre de nuevo`, juega && enPartida.fuente === 0 && !enPartida.hay && enPartida.blobs === 0 && vuelve, { juega, enPartida, vuelve });
  }
  await A.ctx.close();
}

// ======================= 8. sin movimiento: las fotos =======================
if (corre(8)) {
  for (const [nom, o] of [['Gráficos Patata', { q: '&gfx=patata' }], ['menos movimiento', { reducido: true }], ['Gráficos Bajos', { q: '&gfx=bajo' }]]) {
    const A = await abrir(nom, o); await A.p.waitForTimeout(6000);
    const r = await A.ev(`({ fuente: ${CON_FUENTE}, hay: FV.hay, activo: fvActivo(), nivel: clNivel(), foto: !!RB.el.querySelector('.rbBg.on').style.backgroundImage })`);
    caso(`8. ${nom}: las fotos, sin video (${r.fuente} con fuente) y ${A.pedidos.length} pedidos a fondos/`, !r.fuente && !r.hay && !r.activo && r.foto && !A.pedidos.length, { r, pedidos: A.pedidos });
    await A.ctx.close();
  }
}

// ======================= 9. sin el video o roto =======================
if (corre(9)) {
  const e0 = errJS.length;
  const A = await abrir('sin video', { ruta: (r) => r.fulfill({ status: 404, body: '' }) }); await A.p.waitForTimeout(6000);
  const a = await A.ev(`({ ve: RB.el.querySelectorAll('.rbBg video.ve').length, falla: Object.keys(FV.falla).length, foto: !!RB.el.querySelector('.rbBg.on').style.backgroundImage, roto: FV.roto })`);
  await A.ctx.close();
  const basura = Buffer.alloc(200000); for (let i = 0; i < basura.length; i++) basura[i] = (i * 2654435761) >>> 24;
  const B = await abrir('video roto', { ruta: (r) => r.fulfill({ status: 200, contentType: 'video/mp4', body: basura }) }); await B.p.waitForTimeout(6000);
  const k0 = await B.ev('CL.kenPasos || 0'); await B.p.waitForTimeout(2000); const k1 = await B.ev('CL.kenPasos || 0');
  const c = await B.ev(`({ ve: RB.el.querySelectorAll('.rbBg video.ve').length, roto: FV.roto, activo: fvActivo(), foto: !!RB.el.querySelector('.rbBg.on').style.backgroundImage })`);
  await B.ctx.close();
  caso(`9. sin el video (404): la foto (${a.falla} escena anotada para volver a probar en 30 s); roto: la foto y el agrandado vuelve (${((k1 - k0) / 2).toFixed(1)} saltos por segundo); sin errores`, !a.ve && a.falla >= 1 && a.foto && !a.roto && !c.ve && c.roto && !c.activo && c.foto && k1 - k0 >= 6 && errJS.length === e0, { a, c, ken: [k0, k1], err: errJS.slice(e0) });
}

// ======================= costo contra la 3.6 =======================
const U36 = process.env.COSTO || '';
if (U36 && corre('costo')) {
  const VERS = [['ahora', HTML], ['3.6', U36]];
  async function abrirMedir(url, o = {}) {
    const bb = await chromium.launch({ executablePath: CHROME, args: ARGS });
    const ctx = await bb.newContext({ viewport: { width: 873, height: 402 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
    await ctx.addInitScript((P) => { try { localStorage.setItem('jx_prefs', JSON.stringify(P)); } catch (e) {} }, PREFS0({ gfx: o.gfx || 'medio' }));
    if (o.toc) await ctx.addInitScript(() => {
      window.__toc = null;
      const mira = () => { const j = document.querySelector('#rbInicio .clIt.clPri'), c = document.getElementById('carga'), ri = document.getElementById('rbInicio');
        if (j && j.offsetWidth > 0 && ri && !ri.classList.contains('oc') && (!c || c.classList.contains('oc') || c.classList.contains('salir'))) { setTimeout(() => { window.__toc = performance.now(); }, 0); return; } requestAnimationFrame(mira); };
      requestAnimationFrame(mira);
    });
    const p = await ctx.newPage(); return { bb, ctx, p, ev: (s) => p.evaluate((x) => window.__ev(x), s) };
  }
  async function medir(url, gfx = 'medio') {
    const { bb, ctx, p, ev } = await abrirMedir(url, { gfx });
    await p.goto(url + '?test&gfx=' + gfx); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
    await esperar(p, `RB.home === 'clasico' && clVisible() && !CL.el.classList.contains('clEntra')`, 60000); await p.waitForTimeout(3000);
    // (con el video: se mide con el video ya corriendo —el de la 3.6 no tiene—)
    await esperar(p, `typeof FV === 'undefined' || !fvActivo() || FV.corre`, 60000);
    const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable'); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage'); await p.waitForTimeout(2000);
    const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    const traza = `${tmpdir()}/jx_fv_${process.pid}_${Date.now()}.json`;
    await bb.startTracing(p, { path: traza, categories: ['viz'] });
    const m0 = await met(), t0 = Date.now(); await p.waitForTimeout(8000); const m1 = await met(), t1 = Date.now();
    await bb.stopTracing();
    const E = JSON.parse(readFileSync(traza, 'utf8')); const L = E.traceEvents || E; try { unlinkSync(traza); } catch (e) {}
    await cdp.send('HeapProfiler.collectGarbage'); const m2 = await met(); const video = await ev(`typeof FV !== 'undefined' && FV.corre`);
    await bb.close(); const s = (t1 - t0) / 1000;
    return { js: (m1.ScriptDuration - m0.ScriptDuration) * 1000 / s, hilo: (m1.TaskDuration - m0.TaskDuration) * 1000 / s, placa: L.filter((e) => e.name === 'Display::DrawAndSwap' && (e.ph === 'X' || e.ph === 'B')).length / s, heap: m2.JSHeapUsedSize / 1048576, video };
  }
  async function tocable(url) {
    const { bb, ctx, p } = await abrirMedir(url, { toc: true }); const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.goto(url + '?test&perezoso&gfx=medio'); await p.waitForFunction(() => window.__toc, null, { timeout: 300000 });
    const r = await p.evaluate(() => window.__toc); await bb.close(); return r;
  }
  const N = +(process.env.CORRIDAS || 3), R = { ahora: [], '3.6': [] }, T0 = { ahora: [], '3.6': [] };
  // (BAJOS=1: además, el menú de ahora con Gráficos Bajos —las fotos con su agrandado—, para comparar con el video: abajo)
  const RB_ = [];
  for (let i = 0; i < N; i++) { for (const [k, u] of i % 2 ? VERS.slice().reverse() : VERS) { R[k].push(await medir(u)); T0[k].push(await tocable(u)); } if (process.env.BAJOS) RB_.push(await medir(HTML, 'bajo')); }
  const pr = (k, c) => R[k].reduce((a, x) => a + x[c], 0) / N, P = {};
  for (const c of ['js', 'hilo', 'placa', 'heap']) P[c] = { ahora: +pr('ahora', c).toFixed(2), '3.6': +pr('3.6', c).toFixed(2), corridas: { ahora: R.ahora.map((x) => +x[c].toFixed(1)), '3.6': R['3.6'].map((x) => +x[c].toFixed(1)) } };
  P.video = { ahora: R.ahora.map((x) => x.video) };
  P.tocable = { ahora: Math.round(T0.ahora.reduce((a, x) => a + x, 0) / N), '3.6': Math.round(T0['3.6'].reduce((a, x) => a + x, 0) / N), corridas: T0 };
  console.log(`costo (Gráficos medios, procesador 4× más lento, 873×402 a 2×, el menú quieto, ${N} corridas alternadas):\n` + Object.entries(P).filter(([c]) => c !== 'video').map(([c, x]) => `  ${c.padEnd(8)} ahora ${String(x.ahora).padStart(8)}   3.6 ${String(x['3.6']).padStart(8)}   (${c === 'tocable' ? (100 * (x.ahora / x['3.6'] - 1)).toFixed(1) + ' %' : ''})`).join('\n'));
  if (RB_.length) console.log(`  Bajos (ahora, las fotos): ` + ['js', 'hilo', 'placa', 'heap'].map((c) => `${c} ${(RB_.reduce((a, x) => a + x[c], 0) / RB_.length).toFixed(2)} (${RB_.map((x) => x[c].toFixed(1)).join(' ')})`).join('   ') + `; video: ${RB_.map((x) => x.video).join(' ')}`);
  caso(`costo: el tiempo hasta poder tocar el menú ${P.tocable.ahora} ms contra ${P.tocable['3.6']} de la 3.6 (${(100 * (P.tocable.ahora / P.tocable['3.6'] - 1)).toFixed(1)} %, pide ≤ +10 %); con el video corriendo en todas las corridas`, P.tocable.ahora <= P.tocable['3.6'] * 1.1 && R.ahora.every((x) => x.video), P);
}

// ======================= 11. en la web con código =======================
// (WEB_CODIGO=URL de su index.html y CODIGOS=el archivo de los códigos —fuera del repo; no se muestran—)
if (process.env.WEB_CODIGO && process.env.CODIGOS && corre(11)) {
  const COD = readFileSync(process.env.CODIGOS, 'utf8').split('\n').find((l) => l.trim() && !l.startsWith('#')).trim().split(/\s+/)[0];
  const ctx = await b.newContext({ viewport: { width: 873, height: 402 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-AR' });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  await ctx.addInitScript((P) => { try { if (!localStorage.getItem('jx_prefs')) localStorage.setItem('jx_prefs', JSON.stringify(P)); } catch (e) {} }, PREFS0());
  // (SIN_SUBTLE=1: sin crypto.subtle —una página sin https, un navegador viejo—: los fondos se descifran con el AES en JS)
  if (process.env.SIN_SUBTLE) await ctx.addInitScript(() => { window.__jxSinSubtle = true; });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errJS.push('web con código: ' + e.message.slice(0, 200)));
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await p.goto(process.env.WEB_CODIGO); await p.waitForSelector('#jxPuerta input', { timeout: 90000 });
  await p.fill('#jxPuerta input', COD); await p.click('#jxPuerta button');
  await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
  const corre1 = await esperar(p, CORRE, 40000);
  // (los archivos tal como están en la página: no son MP4 —van cifrados— y el juego tiene con qué descifrarlos)
  const cl = await ev(`(async () => { const r = []; for (const e of FONDOS_VIDEO) { const u = new Uint8Array(await (await fetch(e[0], { cache: 'no-store' })).arrayBuffer()); r.push(String.fromCharCode(u[4], u[5], u[6], u[7])); } return { cabeceras: r, desc: !!FV_DESC, global: typeof window.jxCodigoFondo }; })()`);
  // sin internet, después de la primera vez (el service worker ya los guardó): entra solo y el video corre
  const guardo = await p.evaluate(async () => { try { await navigator.serviceWorker.ready; for (let i = 0; i < 60; i++) { const ks = await caches.keys(); for (const k of ks) { const c = await caches.open(k); const L = await c.keys(); if (L.filter((q) => /\/fondos\//.test(q.url)).length >= 6) return true; } await new Promise((r) => setTimeout(r, 1000)); } } catch (e) {} return false; });
  await ctx.setOffline(true); await p.reload();
  const listo2 = await p.waitForFunction(() => window.__listo, null, { timeout: 240000 }).then(() => true, () => false);
  const corre2 = listo2 && await esperar(p, CORRE, 40000);
  caso(`11. en la web con código${process.env.SIN_SUBTLE ? ' (sin crypto.subtle)' : ''}: los videos van cifrados (${cl.cabeceras.join(' ')}), el juego los descifra y el de la escena corre; sin internet, después de la primera vez, también`, corre1 && cl.cabeceras.every((x) => x !== 'ftyp') && cl.desc && cl.global !== 'function' && guardo && corre2, { corre1, cl, guardo, listo2, corre2 });
  await ctx.close();
}

// ======================= vivo: lo que costaría dibujar la escena en 3D en vivo =======================
// (VIVO=1: para comparar —sólo informa—: el juego dibujando Pradera con la grieta y lo que cae, como el fondo pero en vivo, con
// las mismas condiciones: procesador 4× más lento, 873×402 a 2×, Gráficos medios; contra el menú con el video)
if (process.env.VIVO && corre('vivo')) {
  const med = async (nom, prep) => {
    const bb = await chromium.launch({ executablePath: CHROME, args: ARGS });
    const ctx = await bb.newContext({ viewport: { width: 873, height: 402 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
    await ctx.addInitScript((P) => { try { localStorage.setItem('jx_prefs', JSON.stringify(P)); } catch (e) {} }, PREFS0({ gfx: 'medio' }));
    const p = await ctx.newPage(), ev = (s) => p.evaluate((x) => window.__ev(x), s);
    await p.goto(HTML + '?test&gfx=medio'); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
    await prep(p, ev); await p.waitForTimeout(3000);
    const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable'); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await p.waitForTimeout(2000);
    const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    const traza = `${tmpdir()}/jx_fv_vivo_${process.pid}_${Date.now()}.json`;
    await bb.startTracing(p, { path: traza, categories: ['viz'] });
    const m0 = await met(), t0 = Date.now(); await p.waitForTimeout(6000); const m1 = await met(), s = (Date.now() - t0) / 1000;
    await bb.stopTracing(); const E = JSON.parse(readFileSync(traza, 'utf8')); const L = E.traceEvents || E; try { unlinkSync(traza); } catch (e) {}
    await bb.close();
    return { nom, js: +((m1.ScriptDuration - m0.ScriptDuration) * 1000 / s).toFixed(1), hilo: +((m1.TaskDuration - m0.TaskDuration) * 1000 / s).toFixed(1), placa: +(L.filter((e) => e.name === 'Display::DrawAndSwap' && (e.ph === 'X' || e.ph === 'B')).length / s).toFixed(1) };
  };
  const video = await med('el menú con el video', (p) => esperar(p, CORRE, 60000));
  const vivo = await med('la escena en 3D en vivo', async (p, ev) => {
    await ev(`(() => { inicioMostrar(false); empezarPartida('FlatGrass'); return 1; })()`); await esperar(p, `JUEGO.estado === 'juego' && MUNDO.nombre === 'FlatGrass' && !!JUG.suelo`, 120000);
    await ev(`(() => { if (typeof eventoForzar === 'function') eventoForzar(4); return 1; })()`);
  });
  console.log('vivo (procesador 4× más lento, 873×402 a 2×, Gráficos medios):', JSON.stringify([video, vivo]));
}

const js = errJS.filter((x) => !FUERA.test(x));
caso('10. sin errores de JS', !js.length, js.slice(0, 6));
await b.close();
console.log('RESUMEN ' + RES.filter(Boolean).length + '/' + RES.length);
process.exit(RES.every(Boolean) ? 0 : 1);
