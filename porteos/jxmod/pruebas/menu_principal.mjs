// El menú principal sin amontonar (captura del usuario en un celular apaisado de ~800×368: «Salir» quedaba debajo de los
// botones de abajo y todo muy junto). Ahora el menú principal es el depósito (juego/deposito.js; antes, la portada de la
// 3.4): las mismas exigencias, medidas sobre sus bloques (arriba: el perfil y los íconos; las cajas con sus rótulos; abajo a
// la izquierda la ayuda de la primera vez; abajo a la derecha el mapa elegido y JUGAR). En 5 pantallas (ese celular, uno
// chico 640×360, uno común 873×393, una tablet 1180×820 y la compu 1366×768):
//  1. ningún bloque se pisa con otro (con 8 px de aire), ningún botón se pisa con otro, todo se ve entero adentro de la
//     pantalla y están las 12 cosas para tocar (antes, la portada, 20 o más);
//  2. las letras del menú miden al menos 14 px (la palabra y el dato de cada caja, JUGAR, el mapa elegido y tu nombre);
//  3. en la compu todo queda del tamaño del diseño, sin ninguno de los pasos para achicar: ninguna palabra cortada, ninguna
//     chapa agrandada ni sin su ícono, y la letra de las seis cajas, una sola (la palabra y el dato, cada uno del mismo
//     tamaño en todas) y de al menos 0,1 de la cara (antes: sin los pasos para achicar de la portada; antes: la lista al
//     ≥ 90 % y sin deslizar);
//  4. sin errores de JS.
// uso: node menu_principal.mjs URL_HTML [CARPETA_FOTOS]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, DIR = '.'] = process.argv, D = DIR + '/';
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 900)); return ok; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const PANT = [['celu_usuario', 800, 368, true], ['celu_chico', 640, 360, true], ['celu', 873, 393, true], ['tablet', 1180, 820, true], ['compu', 1366, 768, false]];
const errJS = [], M = {};
for (const [nom, w, h, movil] of PANT) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: movil, hasTouch: movil, locale: 'es-AR' });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await ctx.newPage(); p.on('pageerror', (e) => errJS.push(nom + ': ' + e.message.slice(0, 200)));
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await p.goto(HTML + '?test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.nombre = 'NijulaX'; idiomaAplicar('es'); guardarPrefs(); inicioMostrar(true); 1`);
  // (la escena armada y las cajas en su lugar)
  await p.waitForFunction(() => window.__ev('DEP.listo && !DEP.anim && PAUSA.on'), null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(800);
  M[nom] = await ev(`(() => {
    const U = DEP.el, r = (e) => { const q = e.getBoundingClientRect(); return { x0: q.left, y0: q.top, x1: q.right, y1: q.bottom }; };
    const vis = (e) => e && e.offsetWidth > 0 && !e.closest('.oc') && getComputedStyle(e).visibility !== 'hidden';
    const une = (L) => L.filter(vis).map(r).reduce((a, q) => ({ x0: Math.min(a.x0, q.x0), y0: Math.min(a.y0, q.y0), x1: Math.max(a.x1, q.x1), y1: Math.max(a.y1, q.y1) }));
    const B = { arriba: une([U.querySelector('.dpPerfil'), U.querySelector('.dpDer')]), cajas: une([...U.querySelectorAll('.dpCaja, .dpGrupo span')]),
      ayuda: une([U.querySelector('.dpAyuda')]), jugar: une([U.querySelector('.dpMapa'), U.querySelector('.dpJugar')]) };
    const pisa = (a, b, m) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;
    const probs = [], K = Object.keys(B);
    for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) if (pisa(B[K[i]], B[K[j]], 8)) probs.push(K[i] + ' × ' + K[j]);
    const bt = [...U.querySelectorAll('button')].filter(vis).map((e) => ({ k: e.dataset.rb, ...r(e) }));
    for (let i = 0; i < bt.length; i++) for (let j = i + 1; j < bt.length; j++) if (pisa(bt[i], bt[j], -1)) probs.push(bt[i].k + ' × ' + bt[j].k);
    for (const e of bt) if (e.x0 < 0 || e.y0 < 0 || e.x1 > innerWidth || e.y1 > innerHeight) probs.push(e.k + ' afuera');
    const letras = [...U.querySelectorAll('.dpChP, .dpChD, .dpJugar b, .dpMapaN, .dpNom')].filter(vis).map((e) => ({ t: (e.textContent || e.value).trim(), f: parseFloat(getComputedStyle(e).fontSize) }));
    const ch = [...U.querySelectorAll('.dpChapa')], cj = ch.filter((c) => !c.closest('.dpC_evento')), px = (c, q) => +parseFloat(c.querySelector(q).style.fontSize).toFixed(2);
    const pasos = ch.filter((c) => { const P = c.querySelector('.dpChP'); return P.classList.contains('dpCorta') || P.classList.contains('dpRompe') || c.classList.contains('dpSinI') || +c.dataset.w > +c.dataset.fw * 0.8 + 0.01; })
      .map((c) => 'achicada: ' + c.textContent.trim());
    const tam = cj.map((c) => px(c, '.dpChP')), dat = cj.map((c) => px(c, '.dpChD')), cara = Math.min(...cj.map((c) => Math.min(+c.dataset.fw, +c.dataset.fh)));
    if (Math.max(...tam) - Math.min(...tam) > 0.05 || Math.max(...dat) - Math.min(...dat) > 0.05) pasos.push('letras distintas: ' + tam.join('/') + ' · ' + dat.join('/'));
    if (Math.min(...tam) < 0.1 * cara) pasos.push('palabra chica: ' + Math.min(...tam) + ' px con la cara de ' + cara.toFixed(0));
    return { W: innerWidth, H: innerHeight, probs, fMin: Math.min(...letras.map((x) => x.f)), chicas: letras.filter((x) => x.f < 14), pasos, n: bt.length, letra: [Math.min(...tam), Math.min(...dat), +cara.toFixed(0)] };
  })()`);
  await p.screenshot({ path: D + 'menu_' + nom + '.png' });
  await ctx.close();
}
const R = Object.entries(M);
caso('1. nada se pisa (los bloques con 8 px de aire), todo se ve entero y están las 12 cosas para tocar, en las 5 pantallas', R.every(([, m]) => !m.probs.length && m.n === 12), R.map(([k, m]) => ({ k, probs: m.probs, n: m.n })));
caso('2. letras del menú de al menos 14 px', R.every(([, m]) => m.fMin >= 14), R.map(([k, m]) => ({ k, fMin: +m.fMin.toFixed(1), chicas: m.chicas })));
caso('3. en la compu, del tamaño del diseño (ninguna chapa cortada, agrandada ni sin ícono; una sola letra, ≥ 0,1 de la cara)', M.compu && !M.compu.pasos.length, M.compu && { pasos: M.compu.pasos, letra: M.compu.letra });
const e2 = errJS.filter((e) => !/WebSocket|net::|Failed to load|Failed to fetch|NetworkError/i.test(e));
caso('4. sin errores de JS', !e2.length, e2.slice(0, 4));
console.log('RESUMEN ' + RES.filter(Boolean).length + '/' + RES.length);
await b.close(); process.exit(RES.every(Boolean) ? 0 : 1);
