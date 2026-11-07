// El menú principal de la 3.0 (pedido: «la próxima debe ser ya la 3.0 y en el juego debe poner la versión que es, con un
// menú nuevo y renovado, menos IA»). En la compu (1366×768), un celular común (873×393), uno chico (640×360) y el celular
// parado (393×873: el juego se gira 90°):
//  1. la versión se ve: «JXMod 3.0» en una placa abajo a la derecha (entera en la pantalla, letras ≥ 12 px), la misma que
//     JX_VERSION, y la caja negra la anota;
//  2. la letra del menú es la nuestra (Oswald, adentro del HTML) y está cargada: el texto mide distinto que con la de
//     reserva del aparato;
//  3. nada de adornos de «hecho con IA»: ni brillos (sombras de texto o de caja con desenfoque), ni degradados de adorno
//     (sólo el sombreado del fondo), ni bordes redondeados en las placas, ni animaciones salvo el fondo;
//  4. todo alineado: las 8 placas del mismo ancho y con el mismo borde (±1 px), el recuadro del logo en ese borde (±3 px),
//     los botones de abajo y la versión del mismo alto (±1 px) y en la misma línea de abajo (±1 px);
//  5. «Empezar partida nueva» es el botón principal (amarillo de acento, letra oscura) y todo se lee bien (contraste ≥ 7);
//  6. en los 14 idiomas, en el celular chico: ningún texto se sale de su placa ni se parte en dos renglones, nada se pisa y
//     el menú deja ver la escena (no pasa del 62 % del ancho); en árabe, todo espejado a la derecha;
//  7. tocar las placas hace lo de siempre (Empezar → elegir mapa; Volver → menú) y sin errores de JS.
// uso: node menu_30.mjs URL_HTML [CARPETA_FOTOS]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, DIR = '.'] = process.argv, D = DIR + '/';
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 1200)); return ok; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const PANT = [['compu', 1366, 768, false], ['celu', 873, 393, true], ['celu_chico', 640, 360, true], ['parado', 393, 873, true]];
const IDIOMAS = ['es', 'en', 'pt', 'id', 'ms', 'fil', 'ja', 'th', 'tr', 'ar', 'ru', 'uk', 'fr', 'de'];
const errJS = [];
// las medidas de todo el menú (en px de la página; con el juego girado, getBoundingClientRect da el rectángulo girado)
const MEDIR = `(() => {
  const el = RB.el, rr = (e) => { const q = e.getBoundingClientRect(); return { x0: q.left, y0: q.top, x1: q.right, y1: q.bottom, w: q.width, h: q.height }; };
  const cs = (e) => getComputedStyle(e);
  const items = [...el.querySelectorAll('.rbLista .rbIt')].map((e) => ({ k: e.dataset.rb, t: e.textContent.trim(), ...rr(e), f: parseFloat(cs(e).fontSize), sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight, fam: cs(e).fontFamily, bg: cs(e).backgroundColor, col: cs(e).color, rad: parseFloat(cs(e).borderTopLeftRadius) || 0 }));
  const chips = [...el.querySelectorAll('.rbAbajo .rbChipG')].map((e) => ({ ...rr(e), rad: parseFloat(cs(e).borderTopLeftRadius) || 0 })), ver = el.querySelector('.rbVer'), logo = el.querySelector('.rbLogo');
  return { W: innerWidth, H: innerHeight, rot: typeof PANT !== 'undefined' && !!PANT.rot, rtl: el.dir === 'rtl', items, chips, ver: { ...rr(ver), t: ver.textContent.trim(), title: ver.title, f: parseFloat(cs(ver).fontSize), rad: parseFloat(cs(ver).borderTopLeftRadius) || 0 },
    logo: { ...rr(logo), nw: logo.naturalWidth, nh: logo.naturalHeight }, lista: rr(el.querySelector('.rbLista')), desliza: el.querySelector('.rbLista').classList.contains('rbDesliza') };
})()`;
// los «adornos de IA»: sombras con desenfoque, degradados, bordes redondeados y animaciones en lo que se ve del inicio
const ADORNOS = `(() => {
  const malos = [];
  for (const e of RB.el.querySelectorAll('*')) {
    if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') continue;
    if (e.closest('.rbPan')) continue;
    const c = getComputedStyle(e), id = (e.className && e.className.baseVal === undefined ? e.className : e.tagName) + '';
    const desenf = (s) => s !== 'none' && (s.match(/(-?\\d+(?:\\.\\d+)?)px/g) || []).length >= 3 && s.split(/,(?![^(]*\\))/).some((p) => { const n = (p.match(/(-?\\d+(?:\\.\\d+)?)px/g) || []).map(parseFloat); return n.length >= 3 && n[2] > 2; });
    if (desenf(c.textShadow)) malos.push(id + ' sombra de texto ' + c.textShadow);
    if (desenf(c.boxShadow)) malos.push(id + ' sombra ' + c.boxShadow);
    if (/gradient/.test(c.backgroundImage) && !e.classList.contains('rbSombra')) malos.push(id + ' degradado');
    if (c.animationName !== 'none' && !e.classList.contains('rbBg')) malos.push(id + ' animación ' + c.animationName);
    if (c.filter !== 'none' && e.tagName !== 'IMG') malos.push(id + ' filtro ' + c.filter);
  }
  return malos;
})()`;
// contraste WCAG entre dos colores css «rgb(a)»; el fondo translúcido se mezcla con negro (peor caso) y con la escena clara
const contraste = (a, b) => { const p = (s) => s.match(/[\d.]+/g).map(Number); const L = (c) => { const [r, g, bb] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bb; };
  const t = p(a), f = p(b), al = f[3] === undefined ? 1 : f[3], sobre = (bg) => f.slice(0, 3).map((v, i) => v * al + bg[i] * (1 - al));
  return Math.min(...[[0, 0, 0], [200, 220, 235]].map((bg) => { const l1 = L(t), l2 = L(sobre(bg)); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); })); };
const M = {};
for (const [nom, w, h, movil] of PANT) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: movil, hasTouch: movil, locale: 'es-AR' });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await ctx.newPage(); p.on('pageerror', (e) => errJS.push(nom + ': ' + e.message.slice(0, 200)));
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await p.goto(HTML + '?test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.nombre = 'NijulaX'; idiomaAplicar('es'); guardarPrefs(); inicioMostrar(true); 1`);
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
  const m = M[nom] = await ev(MEDIR);
  m.adornos = await ev(ADORNOS);
  m.fuente = await ev(`(() => { const c = document.createElement('canvas').getContext('2d'), t = 'EMPEZAR PARTIDA NUEVA'; c.font = "500 40px 'JX Oswald'"; const a = c.measureText(t).width; c.font = '500 40px sans-serif'; const z = c.measureText(t).width; return { cargada: document.fonts.check("500 40px 'JX Oswald'"), a: +a.toFixed(1), z: +z.toFixed(1) }; })()`);
  if (nom === 'compu') m.caja = await ev(`(() => { try { cnGuardar(true); } catch (e) {} try { const o = JSON.parse(localStorage.getItem(CN_K) || 'null'); return { v: JX_VERSION, caja: o && o.v }; } catch (e) { return { v: JX_VERSION, err: e.message }; } })()`);
  await p.screenshot({ path: D + 'menu30_' + nom + '.png' });
  // 6: los 14 idiomas (en el celular chico y en el común)
  if (nom === 'celu_chico' || nom === 'celu') {
    m.idiomas = {};
    for (const L of IDIOMAS) { await ev(`idiomaAplicar(${JSON.stringify(L)}); PREFS.lang = ${JSON.stringify(L)}; inicioLista(); 1`); await p.waitForTimeout(250); m.idiomas[L] = await ev(MEDIR); if (nom === 'celu_chico' && ['ar', 'ru', 'ja', 'th', 'id'].includes(L)) await p.screenshot({ path: D + 'menu30_' + nom + '_' + L + '.png' }); }
    await ev(`idiomaAplicar('es'); PREFS.lang = 'es'; inicioLista(); 1`);
  }
  // 7: tocar las placas
  if (nom === 'celu') {
    const box = (sel) => ev(`(() => { const q = RB.el.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; })()`);
    let c = await box('.rbIt[data-rb=nueva]'); await p.mouse.click(c.x, c.y); await p.waitForTimeout(400);
    const a1 = await ev(`RB.panel`);
    c = await box('.rbPan [data-rb=volver]'); await p.mouse.click(c.x, c.y); await p.waitForTimeout(400);
    const a2 = await ev(`({ panel: RB.panel, lista: !RB.el.querySelector('.rbLista').classList.contains('oc') })`);
    m.toques = { empezar: a1, volver: a2 };
  }
  await ctx.close();
}
// --- 1: la versión
const vers = Object.entries(M).map(([k, m]) => ({ k, t: m.ver.t, f: m.ver.f, dentro: m.ver.x0 >= -1 && m.ver.y0 >= -1 && m.ver.x1 <= m.W + 1 && m.ver.y1 <= m.H + 1 }));
caso('1. la versión se ve: «JXMod 3.0» entera y legible en las 4 pantallas, igual a JX_VERSION y en la caja negra', vers.every((v) => /^JXMod 3\.0 \d\d\/\d\d\/\d{4}$/i.test(v.t.replace(/\s+/g, ' ')) && v.dentro && v.f >= 12) && M.compu.caja && M.compu.caja.v === '3.0' && /^3\.0 · /.test(M.compu.caja.caja || ''), { vers, caja: M.compu.caja });
// --- 2: la letra
const fu = Object.entries(M).map(([k, m]) => ({ k, ...m.fuente, fam: m.items[0].fam.split(',')[0] }));
caso('2. la letra del menú es la nuestra y está cargada (mide distinto que la de reserva)', fu.every((f) => f.cargada && /JX Oswald/.test(f.fam) && Math.abs(f.a - f.z) > 20), fu);
// --- 3: adornos
const ad = Object.entries(M).map(([k, m]) => ({ k, adornos: m.adornos.slice(0, 4), radios: [...m.items, ...m.chips, m.ver].filter((x) => x.rad > 2).length }));
caso('3. sin brillos, degradados de adorno, bordes redondeados ni animaciones (salvo el fondo)', ad.every((a) => !a.adornos.length && !a.radios), ad);
// --- 4: alineación
const ali = Object.entries(M).map(([k, m]) => {
  const it = m.items, ch = m.chips, rot = m.rot;
  // (con el juego girado, el «ancho» del juego es la altura en la página y el borde izquierdo del juego es el de arriba)
  const izq = (r) => (rot ? r.y0 : m.rtl ? -r.x1 : r.x0), ancho = (r) => (rot ? r.h : r.w), alto = (r) => (rot ? r.w : r.h), abajo = (r) => (rot ? m.W - r.x0 : r.y1);
  const anchos = it.map(ancho), bordes = it.map(izq);
  const lg = m.logo, esc = Math.min(ancho(lg) / lg.nw, alto(lg) / lg.nh), cajaIzq = [izq(lg) + 28 * esc, izq(lg) + 46 * esc];
  const altos = [...ch.map(alto), alto(m.ver)], bajos = [...ch.map(abajo), abajo(m.ver)];
  return { k, dAncho: +(Math.max(...anchos) - Math.min(...anchos)).toFixed(2), dBorde: +(Math.max(...bordes) - Math.min(...bordes)).toFixed(2), logo: [+(cajaIzq[0] - bordes[0]).toFixed(1), +(cajaIzq[1] - bordes[0]).toFixed(1)],
    dAlto: +(Math.max(...altos) - Math.min(...altos)).toFixed(2), dBajo: +(Math.max(...bajos) - Math.min(...bajos)).toFixed(2) };
});
caso('4. placas del mismo ancho y borde (±1 px), logo en el borde (±3 px), botones de abajo y versión del mismo alto y en la misma línea (±1 px)', ali.every((a) => a.dAncho <= 1 && a.dBorde <= 1 && a.logo[0] <= 3 && a.logo[1] >= -3 && a.dAlto <= 1 && a.dBajo <= 1), ali);
// --- 5: el principal y el contraste
const con = Object.entries(M).map(([k, m]) => { const pri = m.items.find((i) => i.k === 'nueva'), otros = m.items.filter((i) => i.k !== 'nueva');
  return { k, pri: pri.bg, cPri: +contraste(pri.col, pri.bg).toFixed(1), cMin: +Math.min(...otros.map((i) => contraste(i.col, i.bg))).toFixed(1) }; });
caso('5. «Empezar partida nueva» en el amarillo de acento con letra oscura; todo con contraste ≥ 7', con.every((c) => c.pri === 'rgb(242, 179, 27)' && c.cPri >= 7 && c.cMin >= 7), con);
// --- 6: idiomas
const idi = [];
for (const nom of ['celu_chico', 'celu']) for (const [L, m] of Object.entries(M[nom].idiomas)) {
  const probs = [], it = m.items, pisa = (a, c, g) => a.x0 < c.x1 + g && c.x0 < a.x1 + g && a.y0 < c.y1 + g && c.y0 < a.y1 + g;
  for (const i of it) { if (i.sw > i.cw + 1) probs.push(i.k + ' se sale'); if (i.sh > i.ch + 1) probs.push(i.k + ' corta'); }
  const hs = it.map((i) => i.h); if (Math.max(...hs) - Math.min(...hs) > 1) probs.push('dos renglones ' + JSON.stringify(it.filter((i) => i.h > Math.min(...hs) + 1).map((i) => i.k)));
  for (const i of it) { if (pisa(i, m.logo, 4)) probs.push(i.k + '×logo'); if (pisa(i, m.ver, 4)) probs.push(i.k + '×versión'); for (const c of m.chips) if (pisa(i, c, 4)) probs.push(i.k + '×chip'); }
  for (const c of m.chips) { if (pisa(c, m.ver, 2)) probs.push('chip×versión'); if (c.x0 < -1 || c.x1 > m.W + 1) probs.push('chip afuera'); }
  const usa = (m.rtl ? m.W - m.lista.x0 : m.lista.x1) / m.W; if (usa > 0.62) probs.push('menú ' + Math.round(usa * 100) + ' % del ancho');
  if (L === 'ar' && !(m.rtl && m.lista.x1 > m.W * 0.9 && m.ver.x0 < m.W * 0.1)) probs.push('árabe sin espejar');
  if (m.desliza) probs.push('se desliza');
  if (probs.length) idi.push({ nom, L, probs });
}
caso('6. los 14 idiomas en el celular chico y en el común: sin textos que se salgan ni partidos, nada se pisa, la escena se ve; árabe espejado', !idi.length, idi.slice(0, 8));
// --- 7: toques y errores
const e2 = errJS.filter((e) => !/WebSocket|net::|Failed to load|Failed to fetch|NetworkError/i.test(e));
caso('7. las placas responden (Empezar → mapas, Volver → menú) y sin errores de JS', M.celu.toques && M.celu.toques.empezar === 'nueva' && M.celu.toques.volver.panel === null && M.celu.toques.volver.lista && !e2.length, { toques: M.celu.toques, err: e2.slice(0, 4) });
console.log('RESUMEN ' + RES.filter(Boolean).length + '/' + RES.length);
await b.close(); process.exit(RES.every(Boolean) ? 0 : 1);
