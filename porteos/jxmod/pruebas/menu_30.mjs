// El menú principal de la 3.0 (pedido: «la próxima debe ser ya la 3.0 y en el juego debe poner la versión que es, con un
// menú nuevo y renovado, menos IA»). Hay dos menús de inicio (Ajustes → Menú de inicio) y se miden los dos (MENU=clasico o
// MENU=deposito para uno solo). En la compu (1366×768), un celular común (873×393), uno chico (640×360) y el celular parado
// (393×873: el juego se gira 90°):
//  · el clásico (juego/clasico.js: el de la 3.3, el de fábrica otra vez, mejorado), con lo que se pedía en la 3.3:
//    1. la versión se ve: «JXMod X.Y» con el día del armado (entera en la pantalla, letras ≥ 14 px), la misma que
//       JX_VERSION, y la caja negra la anota;
//    2. la letra del menú es la nuestra (Oswald, adentro del HTML) y está cargada;
//    3. los adornos, sólo de diseño (antes, en la 3.3: ni degradados ni animaciones; el dueño ahora pidió rasgaduras, detalle
//       y animaciones): sin filtros ni desenfoques quietos, sin animaciones sin fin, sin sombras borrosas, placas sin bordes
//       redondeados y los degradados sólo en las capas de diseño (el grano, la cinta, el barrido de luz y las brasas);
//    4. todo alineado: las 8 placas del mismo ancho y con el mismo borde (±1 px), la placa del logo en ese borde (±3 px), los
//       botones de abajo y la versión del mismo alto y en la misma línea de abajo (±1 px);
//    5. «Empezar partida nueva» es el botón principal (amarillo de acento, letra oscura) y todo se lee bien (contraste ≥ 7);
//    6. en los 14 idiomas, en el celular chico y en el común: ningún texto se sale de su placa ni se parte en dos renglones,
//       nada se pisa y el menú deja ver la escena (no pasa del 62 % del ancho); en árabe, todo espejado;
//    7. tocar las placas hace lo de siempre (Empezar → elegir mapa; Volver → menú);
//  · el depósito (juego/deposito.js, de la 3.5), con lo que se pedía en la 3.5:
//    1. la versión se ve: «JXMod X.Y» con el día del armado (arriba al medio, entera, letras ≥ 12 px), la misma que
//       JX_VERSION, y la caja negra la anota;
//    2. la letra del menú es la nuestra (Oswald) y está cargada;
//    3. los adornos, sólo donde son diseño y baratos: ningún filtro ni desenfoque de fondo, ninguna animación que no pare,
//       ninguna sombra borrosa en las letras y los degradados sólo en las capas de diseño (los tornillos de las chapas);
//    4. lo de la izquierda (el perfil y la ayuda) al mismo borde (±1 px), lo de la derecha (los íconos y JUGAR) al otro
//       (±1 px), las chapas de cada fila de cajas a la misma altura (±2 px) y los íconos de arriba del mismo alto y en la
//       misma línea (±1 px);
//    5. JUGAR es el botón principal (el verde, sólo él, con letra oscura) y los textos principales tienen contraste ≥ 7;
//    6. en los 14 idiomas, en el celular chico y en el común: ningún texto se sale de su chapa o su botón, ninguna palabra
//       se parte salvo por su guion blando, nada se pisa y la escena se ve (el hueco de tu personaje ≥ 15 % del ancho; las
//       cajas ≤ 60 % del alto); en árabe, todo espejado;
//    7. tocar responde (el mapa elegido → Empezar partida nueva; Volver → el depósito);
//  8. sin errores de JS.
// uso: node menu_30.mjs URL_HTML [CARPETA_FOTOS]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, DIR = '.'] = process.argv, D = DIR + '/';
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 1200)); return ok; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const PANT = [['compu', 1366, 768, false], ['celu', 873, 393, true], ['celu_chico', 640, 360, true], ['parado', 393, 873, true]];
const IDIOMAS = ['es', 'en', 'pt', 'id', 'ms', 'fil', 'ja', 'th', 'tr', 'ar', 'ru', 'uk', 'fr', 'de'];
const errJS = [];
// las medidas del depósito (en px del juego: con el juego girado se suman los offsetLeft/Top, como hace el juego)
const MEDIR_DP = `(() => {
  const U = DEP.el, cs = (e) => getComputedStyle(e), r = (e) => { const q = depRect(e); return { x0: q.x, y0: q.y, x1: q.x + q.w, y1: q.y + q.h, w: q.w, h: q.h }; };
  const vis = (e) => e && e.offsetWidth > 0 && !e.closest('.oc') && cs(e).visibility !== 'hidden';
  const ver = U.querySelector('.dpVer'), W = VW(), H = VH();
  const lab = [...U.querySelectorAll('.dpChP, .dpChD, .dpJugar b, .dpMapaN, .dpMapaS, .dpNom, .dpAyuda span, .dpGrupo span')].filter(vis).map((e) => ({ k: e.className, t: e.textContent.replace(/[\\u00ad\\u200b]/g, '').trim(), ...r(e), sw: e.scrollWidth, cw: e.clientWidth,
    lh: parseFloat(cs(e).lineHeight) || parseFloat(cs(e).fontSize) * 1.2, fam: cs(e).fontFamily, rompe: e.classList.contains('dpRompe'), dato: e.classList.contains('dpChD'), ayuda: !!e.closest('.dpAyuda'), btn: (() => { const p = e.closest('button, .dpChapa'); return p ? r(p) : null; })() }));
  const bt = [...U.querySelectorAll('button')].filter(vis).map((e) => ({ k: e.dataset.rb, ...r(e) }));
  const izq = ['.dpPerfil', '.dpAyuda'].map((s) => U.querySelector(s)).filter(vis).map(r);
  const der = [U.querySelector('.dpDer > :last-child'), U.querySelector('.dpJugar')].filter(vis).map(r);
  const fila = (ks) => ks.map((k) => { const c = U.querySelector('.dpC_' + k + ' .dpChapa'), q = r(c); return q.y0 + q.h / 2; });
  const filas = [fila(['pj', 'ws', 'mods', 'multi']), fila(['emotes', 'crear'])];
  const iconos = [...U.querySelectorAll('.dpDer button')].filter(vis).map(r);
  const cajas = [...U.querySelectorAll('.dpCaja')].map(r).reduce((a, q) => ({ x0: Math.min(a.x0, q.x0), y0: Math.min(a.y0, q.y0), x1: Math.max(a.x1, q.x1), y1: Math.max(a.y1, q.y1) }));
  return { W, H, rtl: RB.el.dir === 'rtl', rot: !!(typeof PANT !== 'undefined' && PANT.rot), ver: { ...r(ver), t: ver.textContent.trim(), f: parseFloat(cs(ver).fontSize) }, lab, bt, izq, der, filas, iconos,
    cajas, perfil: r(U.querySelector('.dpPerfil')), jugar: r(U.querySelector('.dpJugar')) };
})()`;
// los adornos: filtros, animaciones, sombras borrosas en las letras y degradados fuera de las capas de diseño
const ADORNOS_DP = `(() => {
  const malos = [], CAPAS = /\\bdpChapa\\b/;
  const todos = [...RB.el.querySelectorAll('.dpHome *')];
  for (const e of todos) {
    if (!(e.offsetWidth > 0) || e.closest('.oc')) continue;
    const id = String(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className || e.id || e.tagName);
    for (const ps of ['', '::before', '::after']) {
      const c = getComputedStyle(e, ps || null); if (ps && (c.content === 'none' || c.content === 'normal')) continue;
      if (c.filter !== 'none') malos.push(id + ps + ' filtro ' + c.filter);
      if (c.backdropFilter && c.backdropFilter !== 'none') malos.push(id + ps + ' desenfoque de fondo');
      if (c.animationName !== 'none' && c.animationIterationCount === 'infinite') malos.push(id + ps + ' animación sin fin ' + c.animationName);
      if (c.textShadow !== 'none' && (c.textShadow.match(/(-?[\\d.]+)px/g) || []).map(parseFloat)[2] > 0) malos.push(id + ps + ' sombra borrosa en la letra');
      if (/gradient/.test(c.backgroundImage) && !CAPAS.test(id)) malos.push(id + ps + ' degradado fuera de las capas');
    }
  }
  return malos;
})()`;
// contraste WCAG entre dos colores; el fondo translúcido se mezcla con negro y con blanco (el peor caso)
const L = (c) => { const [r, g, bb] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bb; };
const contraste = (t, f) => { const al = f[3] === undefined ? 1 : f[3], sobre = (bg) => f.slice(0, 3).map((v, i) => v * al + bg[i] * (1 - al));
  return Math.min(...[[0, 0, 0], [255, 255, 255]].map((bg) => { const l1 = L(t), l2 = L(sobre(bg)); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); })); };
// el color de la letra y el de su fondo: el primer fondo de verdad para arriba (las chapas, JUGAR, el mapa)
const COLORES_DP = `(() => { const num = (s) => (s.match(/[\\d.]+/g) || []).map(Number), out = [];
  const fondo = (e) => { for (let a = e; a && a !== RB.el; a = a.parentElement) { const c = getComputedStyle(a); if (num(c.backgroundColor)[3] !== 0 && c.backgroundColor !== 'rgba(0, 0, 0, 0)') return num(c.backgroundColor); } return [5, 6, 9]; };
  for (const e of DEP.el.querySelectorAll('.dpChP, .dpJugar b, .dpMapaN')) if (e.offsetWidth && !e.closest('.oc')) out.push({ t: e.textContent.replace(/[\\u00ad\\u200b]/g, '').trim(), c: num(getComputedStyle(e).color), f: fondo(e) });
  const J = DEP.el.querySelector('.dpJugar'), v = getComputedStyle(J).backgroundColor, otros = [...DEP.el.querySelectorAll('*')].filter((e) => e.offsetWidth && !J.contains(e) && !e.closest('.oc') && getComputedStyle(e).backgroundColor === v).length;
  return { out, jugarVerde: v === 'rgb(34, 197, 94)' && !otros };
})()`;
// ======================= el clásico (juego/clasico.js: el de la 3.3, mejorado) =======================
// las medidas del clásico (en px del juego: con el juego girado se suman los offsetLeft/Top, como hace el juego)
const MEDIR_CL = `(() => {
  const el = CL.el, cs = (e) => getComputedStyle(e), r = (e) => { const q = depRect(e); return { x0: q.x, y0: q.y, x1: q.x + q.w, y1: q.y + q.h, w: q.w, h: q.h }; };
  const vis = (e) => e && e.offsetWidth > 1 && !e.closest('.oc') && cs(e).visibility !== 'hidden';
  const items = [...el.querySelectorAll('.clLista .clIt')].map((e) => { const c = e.querySelector('.clCuerpo'), t = e.querySelector('.clTx');
    return { k: e.dataset.k, t: t.textContent.trim(), ...r(c), f: parseFloat(cs(t).fontSize), sw: c.scrollWidth, cw: c.clientWidth, tw: t.scrollWidth, tcw: t.clientWidth, th: t.offsetHeight, lh: parseFloat(cs(t).lineHeight) || parseFloat(cs(t).fontSize) * 1.2,
      fam: cs(t).fontFamily, bg: cs(c).backgroundColor, col: cs(c).color, rad: parseFloat(cs(c).borderTopLeftRadius) || 0 }; });
  const chips = [...el.querySelectorAll('.clAbajo .clChip')].filter(vis).map((e) => ({ ...r(e), rad: parseFloat(cs(e).borderTopLeftRadius) || 0, sw: e.scrollWidth, cw: e.clientWidth }));
  const ver = el.querySelector('.clVer'), logo = el.querySelector('.clLogoI'), arriba = el.querySelector('.clVerArriba');
  return { W: VW(), H: VH(), rot: typeof PANT !== 'undefined' && !!PANT.rot, rtl: RB.el.dir === 'rtl', modo: CL.modo, verArriba: !!arriba, items, chips,
    ver: { ...r(ver), t: ver.textContent.trim(), title: ver.title, f: Math.min(...[...ver.querySelectorAll('*')].map((x) => parseFloat(cs(x).fontSize))), rad: parseFloat(cs(ver).borderTopLeftRadius) || 0 },
    logo: { ...r(el.querySelector('.clLogo')), nw: logo.naturalWidth, nh: logo.naturalHeight }, lista: r(el.querySelector('.clLista')), grieta: r(el.querySelector('.clArriba')),
    desliza: /auto|scroll/.test(getComputedStyle(el.querySelector('.clLista')).overflowY) };
})()`;
// los adornos: sólo donde son diseño y terminan. Sin filtros ni desenfoques quietos, sin animaciones sin fin, sin sombras
// borrosas (en la letra ni en las placas), sin bordes redondeados en las placas, y los degradados sólo en las capas de
// diseño (el grano y la viñeta del fondo, la cinta, el barrido de luz y las brasas) —nunca en un texto ni en una placa—.
// (En la 3.3 eran «ni degradados ni animaciones salvo el fondo»: el dueño ahora pidió detalle y animaciones; lo que pide
// esta prueba es que sean de diseño y que terminen)
const ADORNOS_CL = `(() => {
  const malos = [], CAPAS = /\\b(clGrano|clCinta|clBrillo|clBrasas|clBrasa)\\b/;
  for (const e of CL.el.querySelectorAll('*')) {
    if (!(e.offsetWidth > 0) || e.closest('.oc')) continue;
    const id = String(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className || e.id || e.tagName);
    for (const ps of ['', '::before', '::after']) {
      const c = getComputedStyle(e, ps || null); if (ps && (c.content === 'none' || c.content === 'normal')) continue;
      if (c.filter !== 'none' && e.tagName !== 'IMG') malos.push(id + ps + ' filtro ' + c.filter);
      if (c.backdropFilter && c.backdropFilter !== 'none') malos.push(id + ps + ' desenfoque de fondo');
      if (c.animationName !== 'none' && c.animationIterationCount === 'infinite') malos.push(id + ps + ' animación sin fin ' + c.animationName);
      const borrosa = (s) => s !== 'none' && s.split(/,(?![^(]*\\))/).some((p) => { const n = (p.match(/(-?[\\d.]+)px/g) || []).map(parseFloat); return n.length >= 3 && n[2] > 2; });
      if (borrosa(c.textShadow)) malos.push(id + ps + ' sombra borrosa en la letra');
      if (borrosa(c.boxShadow)) malos.push(id + ps + ' sombra borrosa');
      if (/gradient/.test(c.backgroundImage) && !CAPAS.test(id)) malos.push(id + ps + ' degradado fuera de las capas');
    }
  }
  return malos;
})()`;
function revisarClasico(M) {
  // --- 1: la versión
  const vers = Object.entries(M).map(([k, m]) => ({ k, t: m.ver.t, f: m.ver.f, dentro: m.ver.x0 >= -1 && m.ver.y0 >= -1 && m.ver.x1 <= m.W + 1 && m.ver.y1 <= m.H + 1, v: m.version }));
  const reV = (v) => new RegExp('^JXMod ' + v.replace(/\./g, '\\.') + ' \\d\\d/\\d\\d/\\d{4}$', 'i');
  caso('clásico 1. la versión se ve: «JXMod X.Y» con el día, entera y legible (≥ 14 px) en las 4 pantallas, igual a JX_VERSION y en la caja negra',
    vers.every((v) => reV(v.v).test(v.t.replace(/\s+/g, ' ')) && v.dentro && v.f >= 13.95) && M.compu.caja && M.compu.caja.v === M.compu.version && new RegExp('^' + M.compu.version.replace(/\./g, '\\.') + ' · ').test(M.compu.caja.caja || ''), { vers, caja: M.compu.caja });
  // --- 2: la letra
  const fu = Object.entries(M).map(([k, m]) => ({ k, ...m.fuente, fam: m.items[0].fam.split(',')[0] }));
  caso('clásico 2. la letra del menú es la nuestra y está cargada (mide distinto que la de reserva)', fu.every((f) => f.cargada && /JX Oswald/.test(f.fam) && Math.abs(f.a - f.z) > 20), fu);
  // --- 3: adornos
  const ad = Object.entries(M).map(([k, m]) => ({ k, adornos: m.adornos.slice(0, 5), radios: [...m.items, ...m.chips, m.ver].filter((x) => x.rad > 2).length }));
  caso('clásico 3. adornos sólo de diseño: sin filtros, desenfoques, sombras borrosas ni animaciones sin fin; placas sin bordes redondeados; degradados sólo en las capas (grano, cinta, barrido, brasas)', ad.every((a) => !a.adornos.length && !a.radios), ad);
  // --- 4: alineación
  const ali = Object.entries(M).map(([k, m]) => {
    const it = m.items, ch = m.chips, ini = (r) => (m.rtl ? -r.x1 : r.x0), rng = (L) => +(Math.max(...L) - Math.min(...L)).toFixed(2);
    const lg = m.logo, esc = lg.h / lg.nh, cajaIzq = m.rtl ? [-(lg.x1 - 46 * esc), -(lg.x1 - 28 * esc)] : [lg.x0 + 28 * esc, lg.x0 + 46 * esc];
    // (la placa del logo en el borde de las barras, como en la 3.3)
    const borde = ini(it[0]);
    const fila = [...ch, ...(m.verArriba ? [] : [m.ver])];
    return { k, modo: m.modo, dAncho: rng(it.map((x) => x.w)), dBorde: rng(it.map(ini)), logo: [+(cajaIzq[0] - borde).toFixed(1), +(cajaIzq[1] - borde).toFixed(1)], dAlto: rng(fila.map((x) => x.h)), dBajo: rng(fila.map((x) => x.y1)) };
  });
  caso('clásico 4. placas del mismo ancho y borde (±1 px), la placa del logo en el borde (±3 px), los botones de abajo y la versión del mismo alto y en la misma línea (±1 px)', ali.every((a) => a.dAncho <= 1 && a.dBorde <= 1 && a.logo[0] <= 3 && a.logo[1] >= -3 && a.dAlto <= 1 && a.dBajo <= 1), ali);
  // --- 5: el principal y el contraste
  const con = Object.entries(M).map(([k, m]) => { const pri = m.items.find((i) => i.k === 'nueva'), otros = m.items.filter((i) => i.k !== 'nueva'), num = (s) => s.match(/[\d.]+/g).map(Number);
    return { k, pri: pri.bg, cPri: +contraste(num(pri.col), num(pri.bg)).toFixed(1), cMin: +Math.min(...otros.map((i) => contraste(num(i.col), num(i.bg)))).toFixed(1) }; });
  caso('clásico 5. «Empezar partida nueva» en el amarillo de acento con letra oscura; todo con contraste ≥ 7', con.every((c) => c.pri === 'rgb(242, 179, 27)' && c.cPri >= 7 && c.cMin >= 7), con);
  // --- 6: idiomas
  const idi = [];
  for (const nom of ['celu_chico', 'celu']) for (const [L, m] of Object.entries(M[nom].idiomas)) {
    const probs = [], it = m.items, pisa = (a, c, g) => a.x0 < c.x1 + g && c.x0 < a.x1 + g && a.y0 < c.y1 + g && c.y0 < a.y1 + g;
    for (const i of it) { if (i.sw > i.cw + 1 || i.tw > i.tcw + 1) probs.push(i.k + ' se sale'); if (i.th > i.lh * 1.5) probs.push(i.k + ' en dos renglones'); }
    const hs = it.map((i) => i.h); if (Math.max(...hs) - Math.min(...hs) > 1) probs.push('barras de distinto alto');
    for (const i of it) { if (pisa(i, m.logo, 4)) probs.push(i.k + '×logo'); if (pisa(i, m.ver, 4)) probs.push(i.k + '×versión'); if (pisa(i, m.grieta, 4)) probs.push(i.k + '×La grieta'); for (const c of m.chips) if (pisa(i, c, 4)) probs.push(i.k + '×chip'); }
    for (const c of m.chips) { if (pisa(c, m.ver, 2)) probs.push('chip×versión'); if (c.x0 < -1 || c.x1 > m.W + 1) probs.push('chip afuera'); if (c.sw > c.cw + 1) probs.push('chip se sale'); }
    const usa = (m.rtl ? m.W - m.lista.x0 : m.lista.x1) / m.W; if (usa > 0.62) probs.push('menú ' + Math.round(usa * 100) + ' % del ancho');
    if (L === 'ar' && !(m.rtl && m.lista.x1 > m.W * 0.9 && m.ver.x0 < m.W * 0.1)) probs.push('árabe sin espejar');
    if (m.desliza) probs.push('se desliza');
    if (probs.length) idi.push({ nom, L, probs });
  }
  caso('clásico 6. los 14 idiomas en el celular chico y en el común: sin textos que se salgan ni partidos, nada se pisa, la escena se ve; árabe espejado', !idi.length, idi.slice(0, 8));
  // --- 7: toques
  caso('clásico 7. las placas responden (Empezar → mapas, Volver → menú)', M.celu.toques && M.celu.toques.empezar === 'nueva' && M.celu.toques.volver.panel === null && M.celu.toques.volver.lista, { toques: M.celu.toques });
}

async function medirMenu(MENU) {
const M = {};
for (const [nom, w, h, movil] of PANT) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: movil, hasTouch: movil, locale: 'es-AR' });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  if (MENU === 'deposito') await ctx.addInitScript(() => { try { localStorage.setItem('jx_prefs', JSON.stringify({ menuInicio: 'deposito' })); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errJS.push(MENU + ' ' + nom + ': ' + e.message.slice(0, 200)));
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await p.goto(HTML + '?test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.nombre = 'NijulaX'; idiomaAplicar('es'); guardarPrefs(); inicioMostrar(true); 1`);
  const listo = () => (MENU === 'clasico' ? p.waitForFunction(() => window.__ev(`RB.home === 'clasico' && clVisible() && !CL.el.classList.contains('clEntra')`), null, { timeout: 30000 }) : p.waitForFunction(() => window.__ev('DEP.listo && !DEP.anim && PAUSA.on'), null, { timeout: 60000 })).catch(() => {});
  await p.evaluate(() => document.fonts.ready); await listo(); await p.waitForTimeout(800);
  const MEDIR = MENU === 'clasico' ? MEDIR_CL : MEDIR_DP;
  const m = M[nom] = await ev(MEDIR);
  m.adornos = await ev(MENU === 'clasico' ? ADORNOS_CL : ADORNOS_DP); if (MENU !== 'clasico') m.colores = await ev(COLORES_DP);
  m.fuente = await ev(`(() => { const c = document.createElement('canvas').getContext('2d'), t = '${MENU === 'clasico' ? 'EMPEZAR PARTIDA NUEVA' : 'MULTIJUGADOR JUGAR'}'; c.font = "500 40px 'JX Oswald'"; const a = c.measureText(t).width; c.font = '500 40px sans-serif'; const z = c.measureText(t).width; return { cargada: document.fonts.check("500 40px 'JX Oswald'"), a: +a.toFixed(1), z: +z.toFixed(1) }; })()`);
  if (nom === 'compu') m.caja = await ev(`(() => { try { cnGuardar(true); } catch (e) {} try { const o = JSON.parse(localStorage.getItem(CN_K) || 'null'); return { v: JX_VERSION, caja: o && o.v }; } catch (e) { return { v: JX_VERSION, err: e.message }; } })()`);
  m.version = await ev('JX_VERSION');
  await p.screenshot({ path: D + 'menu30_' + (MENU === 'clasico' ? '' : 'deposito_') + nom + '.png' });
  // 6: los 14 idiomas (en el celular chico y en el común)
  if (nom === 'celu_chico' || nom === 'celu') {
    m.idiomas = {};
    for (const I of IDIOMAS) { await ev(`idiomaAplicar(${JSON.stringify(I)}); inicioLista(); 1`); await p.waitForTimeout(300); await listo(); m.idiomas[I] = await ev(MEDIR); if (nom === 'celu_chico' && ['ar', 'ru', 'ja', 'th', 'id'].includes(I)) await p.screenshot({ path: D + 'menu30_' + (MENU === 'clasico' ? '' : 'deposito_') + nom + '_' + I + '.png' }); }
    await ev(`idiomaAplicar('es'); inicioLista(); 1`); await p.waitForTimeout(300);
  }
  // 7: tocar
  if (nom === 'celu') {
    const box = (sel) => ev(`(() => { const q = RB.el.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; })()`);
    let c = await box(MENU === 'clasico' ? '.clIt[data-rb=nueva]' : '.dpMapa'); await p.mouse.click(c.x, c.y); await p.waitForTimeout(400);
    const a1 = await ev(`RB.panel`);
    c = await box('.rbPan [data-rb=volver]'); await p.mouse.click(c.x, c.y); await p.waitForTimeout(400);
    const a2 = await ev(MENU === 'clasico' ? `({ panel: RB.panel, lista: clVisible() && !!CL.lista.querySelector('.clIt') })` : `({ panel: RB.panel, portada: depVisible() && !RB.el.classList.contains('oc') })`);
    m.toques = { empezar: a1, volver: a2 };
  }
  await ctx.close();
}
return M;
}
function revisarDeposito(M) {
// --- 1: la versión
const vers = Object.entries(M).map(([k, m]) => ({ k, t: m.ver.t, f: m.ver.f, dentro: m.ver.x0 >= -1 && m.ver.y0 >= -1 && m.ver.x1 <= m.W + 1 && m.ver.y1 <= m.H + 1, v: m.version }));
const reV = (v) => new RegExp('^JXMod ' + v.replace(/\./g, '\\.') + ' \\d\\d/\\d\\d/\\d{4}$', 'i');
caso('depósito 1. la versión se ve: «JXMod X.Y» con el día, entera y legible en las 4 pantallas, igual a JX_VERSION y en la caja negra',
  vers.every((v) => reV(v.v).test(v.t.replace(/\s+/g, ' ')) && v.dentro && v.f >= 12) && M.compu.caja && M.compu.caja.v === M.compu.version && new RegExp('^' + M.compu.version.replace(/\./g, '\\.') + ' · ').test(M.compu.caja.caja || ''), { vers, caja: M.compu.caja });
// --- 2: la letra
const fu = Object.entries(M).map(([k, m]) => ({ k, ...m.fuente, fam: m.lab.find((x) => /dpChP/.test(x.k)).fam.split(',')[0] }));
caso('depósito 2. la letra del menú es la nuestra y está cargada (mide distinto que la de reserva)', fu.every((f) => f.cargada && /JX Oswald/.test(f.fam) && Math.abs(f.a - f.z) > 20), fu);
// --- 3: adornos
const ad = Object.entries(M).map(([k, m]) => ({ k, adornos: m.adornos.slice(0, 5) }));
caso('depósito 3. adornos sólo donde son diseño: sin filtros ni desenfoques, sin animaciones sin fin, sin sombras borrosas en la letra, degradados sólo en las capas', ad.every((a) => !a.adornos.length), ad);
// --- 4: alineación
const ali = Object.entries(M).map(([k, m]) => {
  const ini = (q) => (m.rtl ? -q.x1 : q.x0), fin = (q) => (m.rtl ? -q.x0 : q.x1), rng = (L) => +(Math.max(...L) - Math.min(...L)).toFixed(2);
  return { k, izq: rng(m.izq.map(ini)), der: rng(m.der.map(fin)), filas: Math.max(...m.filas.map(rng)), iconosAlto: rng(m.iconos.map((q) => q.h)), iconosLinea: rng(m.iconos.map((q) => q.y0 + q.h / 2)) };
});
caso('depósito 4. lo de la izquierda a un borde y lo de la derecha al otro (±1 px), las chapas de cada fila a la misma altura (±2 px) y los íconos de arriba del mismo alto y en línea (±1 px)', ali.every((a) => a.izq <= 1 && a.der <= 1 && a.filas <= 2 && a.iconosAlto <= 1 && a.iconosLinea <= 1), ali);
// --- 5: JUGAR y el contraste
const con = Object.entries(M).map(([k, m]) => ({ k, verde: m.colores.jugarVerde, cMin: +Math.min(...m.colores.out.map((x) => contraste(x.c, x.f))).toFixed(1), peor: m.colores.out.map((x) => ({ t: x.t, c: +contraste(x.c, x.f).toFixed(1) })).sort((a, b2) => a.c - b2.c).slice(0, 2) }));
caso('depósito 5. JUGAR en el verde (sólo él) con letra oscura; los textos principales con contraste ≥ 7', con.every((c) => c.verde && c.cMin >= 7), con);
// --- 6: idiomas
const idi = [];
for (const nom of ['celu_chico', 'celu']) for (const [I, m] of Object.entries(M[nom].idiomas)) {
  const probs = [], pisa = (a, c, g) => a.x0 < c.x1 + g && c.x0 < a.x1 + g && a.y0 < c.y1 + g && c.y0 < a.y1 + g;
  for (const x of m.lab) {
    if (x.sw > x.cw + 1) probs.push(x.t + ' se sale');
    if (x.rompe) probs.push(x.t + ' partida en cualquier lado');
    if ((x.dato || !/dpChP/.test(x.k)) && !x.ayuda && x.h > x.lh * 1.6) probs.push(x.t + ' en dos renglones');
    if (x.btn && (x.x0 < x.btn.x0 - 2 || x.x1 > x.btn.x1 + 2 || x.y0 < x.btn.y0 - 2 || x.y1 > x.btn.y1 + 2)) probs.push(x.t + ' sale de su chapa o botón');
  }
  for (let i = 0; i < m.bt.length; i++) for (let j = i + 1; j < m.bt.length; j++) if (pisa(m.bt[i], m.bt[j], -1)) probs.push(m.bt[i].k + '×' + m.bt[j].k);
  for (const x of m.bt) if (x.x0 < -1 || x.y0 < -1 || x.x1 > m.W + 1 || x.y1 > m.H + 1) probs.push(x.k + ' afuera');
  const hueco = m.rtl ? m.W - m.cajas.x1 : m.cajas.x0;
  if (hueco < m.W * 0.15) probs.push('el hueco de tu personaje: ' + Math.round(hueco / m.W * 100) + ' % del ancho');
  if (m.cajas.y1 - m.cajas.y0 > m.H * 0.6) probs.push('las cajas tapan la escena: ' + Math.round((m.cajas.y1 - m.cajas.y0) / m.H * 100) + ' % del alto');
  if (I === 'ar' && !(m.rtl && m.perfil.x0 > m.W / 2 && m.jugar.x1 < m.W / 2)) probs.push('árabe sin espejar');
  if (probs.length) idi.push({ nom, I, probs: probs.slice(0, 6) });
}
caso('depósito 6. los 14 idiomas en el celular chico y en el común: sin textos que se salgan ni palabras partidas (salvo por su guion), nada se pisa, la escena se ve; árabe espejado', !idi.length, idi.slice(0, 8));
  caso('depósito 7. tocar responde (el mapa elegido → Empezar partida nueva, Volver → el depósito)', M.celu.toques && M.celu.toques.empezar === 'nueva' && M.celu.toques.volver.panel === null && M.celu.toques.volver.portada, { toques: M.celu.toques });
}
const MENUS = (process.env.MENU || 'clasico,deposito').split(',');
for (const MENU of MENUS) { const M = await medirMenu(MENU); if (MENU === 'clasico') revisarClasico(M); else revisarDeposito(M); }
// --- 8: errores
const e2 = errJS.filter((e) => !/WebSocket|net::|Failed to load|Failed to fetch|NetworkError/i.test(e));
caso('8. sin errores de JS', !e2.length, { err: e2.slice(0, 4) });
console.log('RESUMEN ' + RES.filter(Boolean).length + '/' + RES.length);
await b.close(); process.exit(RES.every(Boolean) ? 0 : 1);
