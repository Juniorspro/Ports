// Gráficos automáticos (pedido: «que siempre venga el modo automático activado; al inicio busca el mejor intermedio en
// gráficos, o sea 60 fps pegados; si no llega en ninguna, se queda en la que más se acerque por debajo de 60; si en una más
// alta te va a 60 y en otra más baja a 70, que no baje; si en la más alta pasa de 60, queda ésa») y las técnicas de ahorro
// nuevas por calidad.
//  1. la elección (gfxBuscar con cuadros por segundo inventados): todas pasan de 60 → Ultra; Alto a 60 y Medio a 70 → Alto
//     (no baja); arrancando en Alto que da 50 → baja hasta la que llega; ninguna llega → la de más cuadros; empate → la
//     más alta; 59,4 cuenta como 60 (la pantalla de 60 Hz da 59,x); y mide sólo lo necesario
//  2. Automático por defecto: sin nada guardado viene en Automático; el que tenía guardada una calidad fija pasa una vez a
//     Automático y, si después elige otra, se respeta; con ?gfx= en la dirección (las pruebas) manda ésa
//  3. la medición de verdad: al entrar al primer mapa, detrás de la pantalla de carga (abierta todo el rato), mide, elige,
//     la anota en la pantalla de carga y la guarda con la placa; en ≤ 12 s; sin resolución dinámica mientras mide
//  4. lo medido sirve: los cuadros que dio la elegida detrás de la carga y los que da después jugando, a ±35 %
//  5. una vez por sesión: el segundo mapa no vuelve a medir; al volver a abrir el juego arranca por la que salió
//  6. el menú y la pausa a 30 cuadros por segundo (en partida sin tope)
//  7. partículas: las que quedan detrás de la cámara o miden menos de medio punto no se mandan a la placa
//  8. sonidos: tope de sonidos a la vez por calidad (los lejanos no suenan llegado el tope; los cercanos sí) y el sonido
//     3D fino (HRTF) sólo en Alto y Ultra
//  9. marcas de frenada y trazas de balas con tope por calidad
// 10. sin errores de JS
// uso: node gfx_auto.mjs URL_HTML
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(d).slice(0, 1400)); };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const nueva = async (ctx, extra = '') => {
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  await p.goto(HTML + '?test' + extra); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); return p;
};
const contexto = async () => { const c = await b.newContext({ viewport: { width: 960, height: 540 } }); await c.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' })); return c; };
const ev = (p, s) => p.evaluate((x) => window.__ev(x), s);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 1: la elección ----
const c1 = await contexto(); const p1 = await nueva(c1);
const casos = await ev(p1, `(async () => {
  const T = {
    todas: { patata: 200, bajo: 160, medio: 120, alto: 95, ultra: 75 },
    noBaja: { patata: 140, bajo: 110, medio: 70, alto: 60, ultra: 45 },
    baja: { patata: 140, bajo: 90, medio: 62, alto: 50, ultra: 38 },
    ninguna: { patata: 50, bajo: 52, medio: 48, alto: 40, ultra: 30 },
    empate: { patata: 50, bajo: 50.3, medio: 41, alto: 33, ultra: 25 },
    ultra: { patata: 300, bajo: 250, medio: 200, alto: 150, ultra: 61 },
    casi60: { patata: 140, bajo: 100, medio: 59.4, alto: 50, ultra: 30 },
  };
  const ini = { todas: 'medio', noBaja: 'medio', baja: 'alto', ninguna: 'medio', empate: 'medio', ultra: 'ultra', casi60: 'medio' };
  const out = {};
  for (const k in T) { const vistos = []; const r = await gfxBuscar(ini[k], async (q) => { vistos.push(q); return T[k][q]; }); out[k] = { elegida: r.elegida, medidas: vistos }; }
  // (con tope de tiempo: cada medida tarda 5 s de mentira y el tope vence a los 8 s: mide dos y elige entre ésas)
  { const vistos = []; let t = 0; const r = await gfxBuscar('alto', async (q) => { vistos.push(q); t += 5000; return { patata: 50, bajo: 45, medio: 40, alto: 30, ultra: 20 }[q]; }, () => t > 8000); out.tope = { elegida: r.elegida, medidas: vistos }; }
  return out;
})()`);
const fpsCasos = await ev(p1, `(() => { const r = (iv) => { const L = [0]; for (const x of iv) L.push(L[L.length - 1] + x); return +gfxFps(L).toFixed(1); };
  const rep = (a, n) => Array(n).fill(a).flat();
  return { a60: r(rep(16.67, 40)), conTiron: r([...rep(16.67, 20), 400, ...rep(16.67, 20)]), a40: r(rep(25, 30)), a50mezcla: r(rep([16.67, 16.67, 16.67, 16.67, 33.33], 8)), a20: r(rep(50, 30)) }; })()`);
const esp = { todas: 'ultra', noBaja: 'alto', baja: 'medio', ninguna: 'bajo', empate: 'bajo', ultra: 'ultra', casi60: 'medio', tope: 'medio' };
const medidasMax = { todas: 3, noBaja: 3, baja: 2, ninguna: 3, empate: 3, ultra: 1, casi60: 2, tope: 2 };
ok('1. elige la más alta que da 60 (Alto a 60 y Medio a 70 → Alto), si ninguna llega la de más cuadros, y mide sólo lo necesario',
  Object.keys(esp).every((k) => casos[k].elegida === esp[k] && casos[k].medidas.length <= medidasMax[k]) && Math.abs(fpsCasos.a60 - 60) < 0.5 && Math.abs(fpsCasos.conTiron - 60) < 0.5 && Math.abs(fpsCasos.a40 - 40) < 0.5 && Math.abs(fpsCasos.a50mezcla - 50) < 0.5 && Math.abs(fpsCasos.a20 - 20) < 0.5, { ...casos, cuentaCuadros: fpsCasos });

// ---- 2: Automático por defecto ----
const d0 = await ev(p1, `({ gfx: PREFS.gfx, marca: !!PREFS.gfxAuto31, auto: GFX.auto })`);
const c2 = await contexto(); await c2.addInitScript(() => { if (!localStorage.getItem('__ya')) { localStorage.setItem('__ya', 1); localStorage.setItem('jx_prefs', JSON.stringify({ gfx: 'alto', nombre: 'Viejo' })); } });
let p2 = await nueva(c2); const d1 = await ev(p2, `({ gfx: PREFS.gfx, auto: GFX.auto })`);
await ev(p2, `PREFS.gfx = 'medio'; guardarPrefs(); 1`); await p2.close(); p2 = await nueva(c2); const d2 = await ev(p2, `({ gfx: PREFS.gfx })`);
const c3 = await contexto(); const p3 = await nueva(c3, '&gfx=patata'); const d3 = await ev(p3, `({ gfx: PREFS.gfx, nombre: GFX.nombre })`); await c3.close();
ok('2. Automático por defecto; el que tenía una fija pasa una vez a Automático y después se respeta su elección; ?gfx= manda',
  d0.gfx === 'auto' && d0.auto && d1.gfx === 'auto' && d1.auto && d2.gfx === 'medio' && d3.gfx === 'patata' && d3.nombre === 'patata', { nuevo: d0, conAlto: d1, despuesEligeMedio: d2, conGfx: d3 });
await c2.close();

// ---- 3: la medición de verdad detrás de la carga ----
const entrar = (p, mapa) => ev(p, `(() => { window.__muestras = []; const tm = setInterval(() => { const c = document.getElementById('carga'); window.__muestras.push({ t: performance.now(), mid: GFXA.midiendo, vis: !!c && !c.classList.contains('oc'), esc: GFX.escala, max: GFX.escalaMax }); }, 50); window.__tm = tm;
  window.__t0 = performance.now(); entrarConCarga(mapaNom('${mapa}'), '${mapa}', () => empezarPartida('${mapa}')); return 1; })()`);
const listoCarga = (p) => p.waitForFunction(() => window.__carga && window.__carga.listo && document.getElementById('carga').classList.contains('oc'), null, { timeout: 90000 }).then(() => ev(p, `(() => { clearInterval(window.__tm); return performance.now() - window.__t0; })()`));
await ev(p1, `window.__cargaPrueba = true; window.__gfxMedirPrueba = true; window.__ahorroPrueba = true; PREFS.gfx = 'auto'; aplicarGfx(); 1`);
await entrar(p1, 'FlatGrass'); const ms3 = await listoCarga(p1);
const m3 = await ev(p1, `(() => { const M = window.__muestras, mid = M.filter((m) => m.mid);
  return { res: GFXA.res, medido: GFXA.medido, nombre: GFX.nombre, base: GFX.base, guardado: PREFS.gfxMedido, clave: gfxClave(),
    cargaAbiertaMidiendo: mid.length > 0 && mid.every((m) => m.vis), muestrasMidiendo: mid.length, escalaFija: mid.every((m) => Math.abs(m.esc - m.max) < 1e-6),
    consola: (document.getElementById('cargaCons') || {}).textContent || '' }; })()`);
const r3 = m3.res || {};
ok('3. mide detrás de la pantalla de carga (abierta todo el rato), elige, lo anota y lo guarda; ≤ 12 s; sin resolución dinámica mientras mide',
  m3.medido && r3.elegida && m3.nombre === r3.elegida && m3.cargaAbiertaMidiendo && m3.escalaFija && r3.ms <= 12000 && m3.guardado && m3.guardado.base === r3.elegida && m3.guardado.gpu === m3.clave && /fps/.test(m3.consola),
  { elegida: r3.elegida, inicio: r3.inicio, fps: r3.med, ms: r3.ms, entrarMs: Math.round(ms3), muestrasMidiendo: m3.muestrasMidiendo, cargaAbierta: m3.cargaAbiertaMidiendo, escalaFija: m3.escalaFija, consola: m3.consola.slice(-80) });

// ---- 4: lo medido coincide con lo que da jugando ----
await ev(p1, `window.__ahorroPrueba = false; 1`); await espera(1500);
const fpsJuego = await p1.evaluate(() => new Promise((ok) => { const L = []; const f = (a) => { L.push(a); if (a - L[0] < 2000) requestAnimationFrame(f); else ok((L.length - 1) * 1000 / (L[L.length - 1] - L[0])); }; requestAnimationFrame(f); }));
const fMed = (r3.med || {})[r3.elegida] || 0;
ok('4. los cuadros medidos detrás de la carga y los que da jugando en la elegida, a ±35 %', fMed > 0 && Math.abs(fpsJuego - fMed) / Math.max(fMed, fpsJuego) <= 0.35, { medido: +fMed.toFixed(1), jugando: +fpsJuego.toFixed(1) });

// ---- 5: una vez por sesión; la próxima arranca por la que salió ----
await ev(p1, `window.__gfxCuenta = 0; window.__gfxMedirFalso = async (q) => { window.__gfxCuenta++; return 30; }; 1`);
await entrar(p1, 'City'); await listoCarga(p1);
const s5a = await ev(p1, `({ cuenta: window.__gfxCuenta, mismo: GFXA.res && GFXA.res.elegida })`);
await p1.close(); const p1b = await nueva(c1);
await ev(p1b, `window.__cargaPrueba = true; window.__gfxMedirPrueba = true; window.__gfxVistas = []; window.__gfxMedirFalso = async (q) => { window.__gfxVistas.push(q); return { patata: 200, bajo: 150, medio: 90, alto: 58, ultra: 40 }[q]; }; 1`);
await entrar(p1b, 'FlatGrass'); await listoCarga(p1b);
const s5b = await ev(p1b, `({ inicio: GFXA.res && GFXA.res.inicio, vistas: window.__gfxVistas, elegida: GFXA.res && GFXA.res.elegida })`);
ok('5. el segundo mapa no vuelve a medir; al volver a abrir arranca por la que salió la vez anterior', s5a.cuenta === 0 && s5b.inicio === r3.elegida && s5b.vistas[0] === r3.elegida, { segundoMapa: s5a, reabrir: s5b, anterior: r3.elegida });

// ---- 6: menú y pausa a 30 ----
const contar = `(() => { if (!window.__d0) { window.__d0 = dibujar; dibujar = function () { window.__nd = (window.__nd || 0) + 1; return window.__d0.apply(this, arguments); }; } return 1; })()`;
await ev(p1b, contar);
const tasa = async (ms = 2000) => { await ev(p1b, `window.__nd = 0; window.__ndT = performance.now(); 1`); await espera(ms); return ev(p1b, `window.__nd * 1000 / (performance.now() - window.__ndT)`); };
await ev(p1b, `window.__gfxMedirFalso = null; PREFS.gfx = 'patata'; aplicarGfx(); 1`); await espera(800);
const juego30 = await (async () => { await ev(p1b, `window.__menu30 = true; 1`); return tasa(); })();
await ev(p1b, `abrirPausa(); 1`); await espera(500); const pausa30 = await tasa(); await ev(p1b, `cerrarPaneles(); 1`);
await ev(p1b, `window.__menu30 = false; abrirPausa(); 1`); await espera(500); const pausaLibre = await tasa(); await ev(p1b, `cerrarPaneles(); 1`);
await ev(p1b, `window.__menu30 = true; irMenuPrincipal(); 1`); await espera(800); const menu30 = await tasa();
const raf = await p1b.evaluate(() => new Promise((ok) => { const L = []; const f = (a) => { L.push(a); if (a - L[0] < 1500) requestAnimationFrame(f); else ok((L.length - 1) * 1000 / (L[L.length - 1] - L[0])); }; requestAnimationFrame(f); }));
ok('6. el menú y la pausa a 30 cuadros (27–32); en partida sin tope', menu30 >= 27 && menu30 <= 32.5 && pausa30 >= 27 && pausa30 <= 32.5 && juego30 > 40 && pausaLibre > 40,
  { menu: +menu30.toFixed(1), pausa: +pausa30.toFixed(1), pausaSinTope: +pausaLibre.toFixed(1), partida: +juego30.toFixed(1), pantalla: +raf.toFixed(1) });
await ev(p1b, `window.__menu30 = false; 1`);

// ---- 7..9: en partida ----
await ev(p1b, `rbCerrar && rbCerrar(); 1`).catch(() => {});
await ev(p1b, `empezarPartida('FlatGrass'); PREFS.gfx = 'bajo'; aplicarGfx(); 1`); await espera(1500);
const p7 = await ev(p1b, `(() => {
  PART.l.length = 0; const c = CAM.pos, F = CAM.fwd, D = CAM.der, A = CAM.arr, en = (k, i) => v3(c.x + F.x * k + D.x * ((i % 10) - 5) * 0.1 + A.x * (((i / 10) | 0) - 5) * 0.1, c.y + F.y * k + D.y * ((i % 10) - 5) * 0.1 + A.y * (((i / 10) | 0) - 5) * 0.1, c.z + F.z * k + D.z * ((i % 10) - 5) * 0.1 + A.z * (((i / 10) | 0) - 5) * 0.1);
  // (100 detrás de la cámara, 100 adelante a 8 m y 100 chispitas de 1 cm a 300 m —menos de medio punto—)
  let n = [0, 0, 0];
  for (let i = 0; i < 100; i++) { if (particula(en(-6, i), v3(0, 0, 0), 30, 0.3, [1, 1, 1, 1], 'chispa', 0)) n[0]++; if (particula(en(8, i), v3(0, 0, 0), 30, 0.3, [1, 1, 1, 1], 'chispa', 0)) n[1]++; if (particula(en(300, i), v3(0, 0, 0), 30, 0.01, [1, 1, 1, 1], 'chispa', 0)) n[2]++; }
  for (const q of PART.l) q.grav = 0;
  return { atras: n[0], adelante: n[1], lejosChicas: n[2], tope: partTope() }; })()`);
await espera(400);
const p7b = await ev(p1b, `({ vistas: PART.vistas, salt: PART.salt, total: PART.l.length })`);
ok('7. partículas: las de atrás de la cámara y las de menos de medio punto no se mandan a la placa; las de adelante sí', p7.atras === 100 && p7.adelante === 100 && p7.lejosChicas === 100 && p7b.salt >= 195 && p7b.vistas >= 95 && p7b.vistas <= 105, { puestas: p7, ...p7b });
await ev(p1b, `PART.l.length = 0; 1`);
// 8: sonidos
await ev(p1b, `audioIniciar(); AUD.ctx && AUD.ctx.resume(); audioBuf('GrenadeExplode', () => {}); 1`);
await p1b.waitForFunction(() => window.__ev(`!!audioBuf('GrenadeExplode')`), null, { timeout: 20000 }).catch(() => {});
const s8 = {};
for (const q of ['patata', 'medio', 'alto']) {
  await ev(p1b, `PREFS.gfx = '${q}'; aplicarGfx(); AUD.vocesDesc = 0; 1`);
  s8[q] = await ev(p1b, `(() => { const c = CAM.pos, lejos = v3(c.x + 40, c.y, c.z), cerca = v3(c.x + 3, c.y, c.z); let n = 0; for (let i = 0; i < 50; i++) if (sonar('GrenadeExplode', lejos, 0.01)) n++;
    const cercaSuena = !!sonar('GrenadeExplode', cerca, 0.01); const F = fuente3D(cerca, 0); const pm = F.p.panningModel; try { F.g.disconnect(); F.p.disconnect(); } catch (e) {}
    return { lejosSonaron: n, descartados: AUD.vocesDesc, enCurso: AUD.vocesN, cercaSuena, hrtf: pm }; })()`);
  await espera(4500);
}
const finV = await ev(p1b, `AUD.vocesN`);
const topes = { patata: 10, medio: 24, alto: 32 };
ok('8. sonidos: tope por calidad (Patata 10, Medio 24, Alto 32), los cercanos suenan igual, se liberan al terminar; HRTF sólo en Alto',
  ['patata', 'medio', 'alto'].every((q) => s8[q].lejosSonaron <= topes[q] && s8[q].lejosSonaron >= topes[q] - 2 && s8[q].descartados >= 50 - topes[q] && s8[q].cercaSuena) && s8.alto.hrtf === 'HRTF' && s8.medio.hrtf === 'equalpower' && s8.patata.hrtf === 'equalpower' && finV <= 2,
  { ...s8, alTerminar: finV });
// 9: marcas y trazas
const s9 = {};
for (const q of ['patata', 'bajo', 'alto']) {
  await ev(p1b, `PREFS.gfx = '${q}'; aplicarGfx(); 1`);
  s9[q] = await ev(p1b, `(() => { const c = JUG.pos; MARCAS.n = 0; MARCAS.ini = 0; for (let i = 0; i < 1200; i++) marcaTramo(v3(c.x + i * 0.1, c.y, c.z), v3(c.x + i * 0.1 + 0.1, c.y, c.z), v3(0, 1, 0), 0.3, 1);
    TRAZAS.length = 0; for (let i = 0; i < 200; i++) efectoTraza(v3(c.x, c.y + 1, c.z), v3(c.x + 10, c.y + 1, c.z + i)); return { marcas: MARCAS.n, trazas: TRAZAS.length, ultimaTraza: TRAZAS[TRAZAS.length - 1].b.z - c.z }; })()`);
}
ok('9. marcas de frenada (Patata 200, Bajo 400, Alto 900) y trazas (12, 24, 64) con tope; la última siempre queda', s9.patata.marcas === 200 && s9.bajo.marcas === 400 && s9.alto.marcas === 900 && s9.patata.trazas === 12 && s9.bajo.trazas === 24 && s9.alto.trazas === 64 && Math.abs(s9.alto.ultimaTraza - 199) < 0.01, s9);
const e2 = errs.filter((x) => !/broker|mqtt|tienda|CORS|ERR_FAILED|Failed to load|net::|willRead/i.test(x));
ok('10. sin errores de JS', !e2.length, e2.slice(0, 4));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
