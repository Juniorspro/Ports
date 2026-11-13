// Importar personaje: la ventana como la usa un jugador, en la compu o en el celular (873×393). Personajes → Mods →
// «Importar personaje» → elegir el archivo → los puntos (arrastrar uno: el del otro lado lo sigue) → probarlo (la vista
// previa con las animaciones del juego) → «Guardar y usar». Después de recargar sigue puesto. Con «lento» el procesador va
// 6 veces más lento (un celular de gama baja) y se mide cuánto tarda cada paso.
// uso: node importar_personaje.mjs URL_HTML CARPETA_MODELOS CARPETA_FOTOS [compu|celu] [lento] [archivos=mh_a/mh_a.obj,mh_a/mh_a.mtl]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, MODS, D = '.', MODO = 'compu', LENTO = '', ARCH = 'mh_a/mh_a.obj,mh_a/mh_a.mtl'] = process.argv; fs.mkdirSync(D, { recursive: true });
const celu = MODO === 'celu', suf = (celu ? '_celu' : '') + (LENTO === 'lento' ? '_lento' : '');
const { b, p, err, ev } = await abrir(HTML, celu);
if (LENTO === 'lento') { const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 }); }
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.lang = 'es'; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); 1`);
await ev(`RBM.pjTab = 'mod'; inicioPanel('personajes'); 1`); await p.waitForTimeout(1200);
const boton = await p.$('.pjmImp'); ok('el botón «Importar personaje» está en Personajes → Mods', !!boton);
await boton.click(); await p.waitForTimeout(500);
ok('se abre la ventana en el paso 1 (y lo de atrás no se ve)', await ev(`!!document.querySelector('#pjiVen:not(.oc) .pjiZona') && document.body.classList.contains('pjiAbierto')`));
await p.screenshot({ path: `${D}/1_elegir${suf}.jpg`, type: 'jpeg', quality: 82 });
const files = ARCH.split(',').map((f) => ({ name: f.split('/').pop(), mimeType: 'application/octet-stream', buffer: fs.readFileSync(MODS + '/' + f) }));
const t0 = Date.now(); await p.setInputFiles('#pjiVen input[type=file]', files);
await p.waitForFunction(() => window.__ev(`!!(PJI.ui && ((PJI.ui.paso === 2 && !PJI.ui.ocupado) || PJI.ui.error))`), null, { timeout: 300000 });
const tLeer = (Date.now() - t0) / 1000, st2 = await ev(`({ paso: PJI.ui.paso, error: PJI.ui.error, propio: PJI.ses && PJI.ses.usarPropio, pts: !!(PJI.ses && PJI.ses.pts) })`);
ok('lee el archivo, lo para derecho y propone los puntos', st2.paso === 2 && !st2.error, Object.assign(st2, { seg: tLeer }));
await p.waitForTimeout(400); await p.screenshot({ path: `${D}/2_puntos${suf}.jpg`, type: 'jpeg', quality: 85 });
// el lienzo entra en la pantalla y los botones se pueden tocar (≥ 36 px)
const lay = await ev(`(() => { const c = document.querySelector('.pjiLienzo'), r = c && c.getBoundingClientRect(), bs = [...document.querySelectorAll('#pjiVen .pjiBtn, #pjiVen .pjiX')].map((x) => x.getBoundingClientRect()).filter((x) => x.width);
  return { lienzo: r ? [Math.round(r.width), Math.round(r.height)] : null, fuera: bs.filter((x) => x.bottom > innerHeight + 1 || x.right > innerWidth + 1).length, chicos: bs.filter((x) => x.height < 36).length, alto: innerHeight }; })()`);
ok('los puntos y los botones entran en la pantalla y se pueden tocar', lay.lienzo && lay.lienzo[1] >= 120 && !lay.fuera && !lay.chicos, lay);
if (st2.pts) {
  const c = await ev(`(() => { const cv = document.querySelector('.pjiLienzo canvas'), r = cv.getBoundingClientRect(), F = PJI.ui.fondo, k = r.width / cv.width, q = PJI.ses.pts.rodillaD; return { x: r.left + F.sx(q[0]) * k, y: r.top + F.sy(q[1]) * k, antes: PJI.ses.pts.rodillaI.slice() }; })()`);
  if (celu) { await p.touchscreen.tap(c.x, c.y); }
  await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(c.x - 10, c.y + 8, { steps: 4 }); await p.mouse.up();
  const d = await ev(`({ I: PJI.ses.pts.rodillaI, D: PJI.ses.pts.rodillaD, sel: PJI.ui.selP })`);
  ok('arrastrar la rodilla derecha la mueve y la izquierda la sigue (simétrico)', d.sel === 'rodillaD' && Math.abs(d.I[0] + d.D[0]) < 1e-6 && Math.abs(d.I[1] - c.antes[1]) > 0.005, d);
  await p.screenshot({ path: `${D}/2b_arrastre${suf}.jpg`, type: 'jpeg', quality: 85 });
  await ev(`PJI.ses.pts = pjiPuntosAuto(PJI.ses.Nm); pjiDibujarUI(); 1`);
}
const t1 = Date.now(); await p.click('[data-pji="sig"]');
await p.waitForFunction(() => window.__ev(`!!(PJI.ui && PJI.ui.paso === 3 && !PJI.ui.ocupado)`), null, { timeout: 300000 });
const tRig = (Date.now() - t1) / 1000, msRig = await ev(`Math.round(PJI.ses.ms.rig)`);
await p.waitForTimeout(2500);
const st3 = await ev(`({ gmp: !!(MENU.lobby && MENU.lobby.pji && MENU.lobby.gmp && !MENU.lobby.gmp.propio), nb: MENU.lobby && MENU.lobby.gmp && MENU.lobby.gmp.def.nb })`);
ok('paso 3: la vista previa en 3D con el esqueleto armado', st3.gmp, Object.assign(st3, { seg: tRig, rigMs: msRig }));
for (const a of ['caminar', 'correr', 'saludar', 'bailar']) { await p.click(`[data-pji="anim:${a}"]`); await p.waitForTimeout(1300); await p.screenshot({ path: `${D}/3_${a}${suf}.jpg`, type: 'jpeg', quality: 82 }); }
await p.fill('[data-pji="nombre"]', 'Prueba');
const t2 = Date.now(); await p.click('[data-pji="guardar"]');
await p.waitForFunction(() => window.__ev(`!PJI.ui`), null, { timeout: 120000 });
const tGuardar = (Date.now() - t2) / 1000, g = await ev(`({ skin: PREFS.skin, lista: PJI.lista.map((x) => [x.n, x.kb]), id: pjiIdDe(PREFS.skin) })`);
ok('«Guardar y usar»: queda en la lista y puesto, y lo de atrás vuelve a verse', !!g.id && g.lista.some((x) => x[0] === 'Prueba') && !(await ev(`document.body.classList.contains('pjiAbierto')`)), Object.assign(g, { seg: tGuardar }));
await p.waitForTimeout(1200); await p.screenshot({ path: `${D}/4_guardado${suf}.jpg`, type: 'jpeg', quality: 82 });
const enLista = await ev(`!!document.querySelector('[data-pjm="sel:' + PREFS.skin + '"]')`);
ok('aparece en Personajes → Mods, entre los importados', enLista);
await p.reload(); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await p.waitForTimeout(1500);
const r2 = await ev(`(async () => { await pjiCargarLista(); const id = pjiIdDe(PREFS.skin); const d = await pjiArmarGuardado(id); return { id, n: d && d.nombre, nb: d && d.nb }; })()`);
ok('después de recargar sigue puesto y se arma del paquete guardado', r2.id === g.id && r2.n === 'Prueba' && r2.nb > 0, r2);
console.log('TIEMPOS ' + JSON.stringify({ modo: MODO + (LENTO ? '+lento' : ''), leer: tLeer, rig: tRig, rigMs: msRig, guardar: tGuardar }));
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:|aborted/i.test(x)); ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
