// El menú principal sin amontonar (captura del usuario en un celular apaisado de ~800×368: «Salir» quedaba debajo de los
// botones de abajo y todo muy junto). Hay dos menús de inicio (Ajustes → Menú de inicio) y se miden los dos, con las mismas
// exigencias de antes (MENU=clasico o MENU=deposito para uno solo). En 5 pantallas (ese celular, uno chico 640×360, uno
// común 873×393, una tablet 1180×820 y la compu 1366×768):
//  · el clásico (juego/clasico.js, el de fábrica: el de la 3.3 mejorado), como en la 3.3:
//    1. ninguna opción se pisa con el logo, con los botones de abajo ni con la versión (con 8 px de aire), ningún botón con
//       otro, todo se ve entero adentro de la pantalla y están las 8 opciones (el tamaño de lo que se toca: menu_clasico.mjs);
//    2. las letras del menú miden al menos 14 px (las opciones, los botones de abajo y la versión);
//    3. en la compu las letras quedan del tamaño del diseño (las de la 3.3: 4,3 % del alto) y sin deslizar;
//  · el depósito (juego/deposito.js, de la 3.5), con los bloques de su diseño (arriba: el perfil y los íconos; las cajas con
//    sus rótulos; abajo a la izquierda la ayuda de la primera vez; abajo a la derecha el mapa elegido y JUGAR):
//    1. ningún bloque se pisa con otro (con 8 px de aire), ningún botón se pisa con otro, todo se ve entero adentro de la
//       pantalla y están las 12 cosas para tocar;
//    2. las letras del menú miden al menos 14 px (la palabra y el dato de cada caja, JUGAR, el mapa elegido y tu nombre);
//    3. en la compu todo queda del tamaño del diseño, sin ninguno de los pasos para achicar: ninguna palabra cortada, ninguna
//       chapa agrandada ni sin su ícono, y la letra de las seis cajas, una sola y de al menos 0,1 de la cara;
//  4. sin errores de JS.
// uso: node menu_principal.mjs URL_HTML [CARPETA_FOTOS]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, DIR = '.'] = process.argv, D = DIR + '/';
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 900)); return ok; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const PANT = [['celu_usuario', 800, 368, true], ['celu_chico', 640, 360, true], ['celu', 873, 393, true], ['tablet', 1180, 820, true], ['compu', 1366, 768, false]];
const MENUS = (process.env.MENU || 'clasico,deposito').split(',');
const errJS = [];
// ---------------- el clásico ----------------
const MEDIR_CL = `(() => {
  const el = CL.el, r = (e) => { const q = e.getBoundingClientRect(); return { x0: q.left, y0: q.top, x1: q.right, y1: q.bottom }; };
  const vis = (e) => e && e.offsetWidth > 1 && !e.closest('.oc');
  const items = [...el.querySelectorAll('.clLista .clIt')].map((e) => ({ t: e.textContent.trim(), ...r(e), f: parseFloat(getComputedStyle(e.querySelector('.clTx')).fontSize) }));
  const logo = r(el.querySelector('.clLogo')), chips = [...el.querySelectorAll('.clAbajo .clChip')].filter(vis).map(r), ver = r(el.querySelector('.clVer')), grieta = r(el.querySelector('.clArriba'));
  const pisa = (a, b, m) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;
  const probs = [];
  for (const it of items) {
    if (pisa(it, logo, 8)) probs.push(it.t + ' × logo');
    for (const c of chips) if (pisa(it, c, 8)) probs.push(it.t + ' × chip');
    if (pisa(it, ver, 8)) probs.push(it.t + ' × versión');
    if (pisa(it, grieta, 8)) probs.push(it.t + ' × La grieta');
    if (it.y0 < 0 || it.y1 > innerHeight || it.x1 > innerWidth || it.x0 < 0) probs.push(it.t + ' afuera');
  }
  for (const c of chips) if (c.x1 > innerWidth + 1 || c.x0 < -1) probs.push('chip afuera');
  for (const c of chips) if (pisa(c, ver, 4)) probs.push('chip × versión');
  const bt = [...el.querySelectorAll('button, input')].filter(vis).filter((e) => !e.parentElement.closest('button')).map((e) => ({ k: e.dataset.rb || e.id, ...r(e) }));
  for (let i = 0; i < bt.length; i++) for (let j = i + 1; j < bt.length; j++) if (pisa(bt[i], bt[j], -1)) probs.push(bt[i].k + ' × ' + bt[j].k);
  const chicos = bt.filter((e) => Math.min(e.x1 - e.x0, e.y1 - e.y0) < 43.5).map((e) => e.k + ' ' + Math.round(e.x1 - e.x0) + '×' + Math.round(e.y1 - e.y0));
  const letras = [...el.querySelectorAll('.clTx, .clChip span, .clChip input, .clVer span, .clVer b, .clVer i, .clEvt span, .clEvt b')].filter(vis).map((e) => ({ t: (e.textContent || e.value).trim(), f: parseFloat(getComputedStyle(e).fontSize) }));
  const desliza = /auto|scroll/.test(getComputedStyle(el.querySelector('.clLista')).overflowY);
  return { W: innerWidth, H: innerHeight, probs, chicos, n: items.length, fMin: Math.min(...letras.map((x) => x.f)), chicas: letras.filter((x) => x.f < 14), fItem: items[0].f, fDiseno: +(VH() * 0.043).toFixed(2), desliza, modo: CL.modo,
    aireArriba: +(items[0].y0 - logo.y1).toFixed(1), aireAbajo: +(Math.min(...chips.map((c) => c.y0)) - items[items.length - 1].y1).toFixed(1) };
})()`;
// ---------------- el depósito ----------------
const MEDIR_DP = `(() => {
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
})()`;
for (const MENU of MENUS) {
  const M = {};
  for (const [nom, w, h, movil] of PANT) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: movil, hasTouch: movil, locale: 'es-AR' });
    await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
    if (MENU === 'deposito') await ctx.addInitScript(() => { try { localStorage.setItem('jx_prefs', JSON.stringify({ menuInicio: 'deposito' })); } catch (e) {} });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errJS.push(MENU + ' ' + nom + ': ' + e.message.slice(0, 200)));
    const ev = (s) => p.evaluate((x) => window.__ev(x), s);
    await p.goto(HTML + '?test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
    await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.nombre = 'NijulaX'; idiomaAplicar('es'); guardarPrefs(); inicioMostrar(true); 1`);
    // (el clásico a la vista y su entrada terminada; el depósito, con la escena armada y las cajas en su lugar)
    if (MENU === 'clasico') await p.waitForFunction(() => window.__ev(`RB.home === 'clasico' && clVisible() && !CL.el.classList.contains('clEntra')`), null, { timeout: 30000 }).catch(() => {});
    else await p.waitForFunction(() => window.__ev('DEP.listo && !DEP.anim && PAUSA.on'), null, { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(800);
    M[nom] = await ev(MENU === 'clasico' ? MEDIR_CL : MEDIR_DP);
    await p.screenshot({ path: D + 'menu_' + (MENU === 'clasico' ? '' : 'deposito_') + nom + '.png' });
    await ctx.close();
  }
  const R = Object.entries(M);
  if (MENU === 'clasico') {
    // (el tamaño de lo que se toca, con lo que se ve y lo que se toca por separado, lo mide menu_clasico.mjs)
    caso('clásico 1. nada se pisa (con 8 px de aire), ningún botón con otro, todo entero adentro y están las 8 opciones, en las 5 pantallas', R.every(([, m]) => !m.probs.length && m.n === 8), R.map(([k, m]) => ({ k, modo: m.modo, probs: m.probs, aireArriba: m.aireArriba, aireAbajo: m.aireAbajo })));
    caso('clásico 2. letras del menú de al menos 14 px', R.every(([, m]) => m.fMin >= 13.95), R.map(([k, m]) => ({ k, fMin: +m.fMin.toFixed(1), chicas: m.chicas })));
    caso('clásico 3. en la compu, la letra del diseño de la 3.3 (4,3 % del alto) y sin deslizar', M.compu && Math.abs(M.compu.fItem - M.compu.fDiseno) < 0.6 && !M.compu.desliza, M.compu && { f: M.compu.fItem, diseno: M.compu.fDiseno, desliza: M.compu.desliza });
  } else {
    caso('depósito 1. nada se pisa (los bloques con 8 px de aire), todo se ve entero y están las 12 cosas para tocar, en las 5 pantallas', R.every(([, m]) => !m.probs.length && m.n === 12), R.map(([k, m]) => ({ k, probs: m.probs, n: m.n })));
    caso('depósito 2. letras del menú de al menos 14 px', R.every(([, m]) => m.fMin >= 14), R.map(([k, m]) => ({ k, fMin: +m.fMin.toFixed(1), chicas: m.chicas })));
    caso('depósito 3. en la compu, del tamaño del diseño (ninguna chapa cortada, agrandada ni sin ícono; una sola letra, ≥ 0,1 de la cara)', M.compu && !M.compu.pasos.length, M.compu && { pasos: M.compu.pasos, letra: M.compu.letra });
  }
}
const e2 = errJS.filter((e) => !/WebSocket|net::|Failed to load|Failed to fetch|NetworkError/i.test(e));
caso('4. sin errores de JS', !e2.length, e2.slice(0, 4));
console.log('RESUMEN ' + RES.filter(Boolean).length + '/' + RES.length);
await b.close(); process.exit(RES.every(Boolean) ? 0 : 1);
