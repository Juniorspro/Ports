// El menú principal de la 3.0 (pedido: «la próxima debe ser ya la 3.0 y en el juego debe poner la versión que es, con un
// menú nuevo y renovado, menos IA») y la portada que lo reemplaza (juego/portada.js; pedido del dueño:
// «una interfaz nueva así… mejores botones con diseño en los botones»). En la compu (1366×768), un celular común
// (873×393), uno chico (640×360) y el celular parado (393×873: el juego se gira 90°):
//  1. la versión se ve: «JXMod X.Y» con el día del armado, abajo a la izquierda (entera en la pantalla, letras ≥ 12 px), la
//     misma que JX_VERSION, y la caja negra la anota;
//  2. la letra del menú es la nuestra (Oswald, adentro del HTML) y está cargada: el texto mide distinto que con la de
//     reserva del aparato;
//  3. los adornos, sólo donde son diseño y baratos (la 3.0 no quería ninguno; la portada pide botones con forma, degradados,
//     borde con brillo y sombras): ningún filtro ni desenfoque de fondo (caros en un celular flojo), ninguna animación
//     que no pare, ninguna sombra borrosa en las letras (se leen peor) y los degradados sólo en las capas de los botones,
//     de las tarjetas y del escenario —no en los textos—;
//  4. todo alineado: lo de la izquierda (perfil, tarjetas, pestañas y versión) al mismo borde (±1 px), lo de la derecha
//     (los íconos, los accesos y JUGAR) al otro (±1 px), las tres tarjetas del mismo ancho (±1 px) y los íconos de arriba
//     del mismo alto y en la misma línea (±1 px);
//  5. JUGAR es el botón principal (el amarillo de acento, letra oscura) y los textos principales (los títulos de las
//     tarjetas, las pestañas, JUGAR y el mapa) tienen contraste ≥ 7 con su fondo (en el peor caso: lo de atrás blanco);
//  6. en los 14 idiomas, en el celular chico y en el común: ningún texto se sale de su botón ni se parte en dos renglones,
//     nada se pisa y el escenario se ve (el hueco del personaje, ≥ 15 % del ancho, y las tarjetas no pasan del 40 %); en
//     árabe, todo espejado (el perfil a la derecha y JUGAR a la izquierda);
//  7. tocar responde (el mapa elegido → Empezar partida nueva; Volver → la portada) y sin errores de JS.
// uso: node menu_30.mjs URL_HTML [CARPETA_FOTOS]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, DIR = '.'] = process.argv, D = DIR + '/';
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 1200)); return ok; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const PANT = [['compu', 1366, 768, false], ['celu', 873, 393, true], ['celu_chico', 640, 360, true], ['parado', 393, 873, true]];
const IDIOMAS = ['es', 'en', 'pt', 'id', 'ms', 'fil', 'ja', 'th', 'tr', 'ar', 'ru', 'uk', 'fr', 'de'];
const errJS = [];
// las medidas de la portada (en px del juego: con el juego girado se suman los offsetLeft/Top, como hace el juego)
const MEDIR = `(() => {
  const U = PTD.ui, cs = (e) => getComputedStyle(e), r = (e) => { const q = ptdRect(e); return { x0: q.x, y0: q.y, x1: q.r, y1: q.b, w: q.w, h: q.h }; };
  const vis = (e) => e && e.offsetWidth > 0 && !e.closest('.oc') && cs(e).visibility !== 'hidden';
  const ver = U.querySelector('.ptVer'), W = VW(), H = VH();
  const lab = [...U.querySelectorAll('.ptCT, .ptCS, .ptTabT, .ptJugarT, .ptModoN, .ptModoS, .ptPj, .ptCartel, .ptTag, .ptSw b')].filter(vis).map((e) => ({ k: e.className, t: e.textContent.trim(), ...r(e), sw: e.scrollWidth, cw: e.clientWidth,
    lh: parseFloat(cs(e).lineHeight) || parseFloat(cs(e).fontSize) * 1.2, fam: cs(e).fontFamily, btn: (() => { const p = e.closest('button'); return p ? r(p) : null; })() }));
  const bt = [...U.querySelectorAll('button')].filter(vis).map((e) => ({ k: e.dataset.rb, ...r(e) }));
  const izq = ['.ptPerfil', '.ptDoble', '.ptMultiC', '.ptEvento', '.ptTabs', '.ptVer'].map((s) => U.querySelector(s)).filter(vis).map(r);
  const der = [U.querySelector('.ptDer > :last-child'), ...U.querySelectorAll('.ptCol .ptMini:not(.oc)'), U.querySelector('.ptPartida')].filter(vis).map(r);
  const cartas = ['.ptDoble', '.ptMultiC', '.ptEvento'].map((s) => r(U.querySelector(s)));
  const iconos = [...U.querySelectorAll('.ptDer button')].filter(vis).map(r);
  return { W, H, rtl: RB.el.dir === 'rtl', rot: !!(typeof PANT !== 'undefined' && PANT.rot), ver: { ...r(ver), t: ver.textContent.trim(), f: parseFloat(cs(ver).fontSize) }, lab, bt, izq, der, cartas, iconos,
    esc: r(PTD.esc), izqCol: r(U.querySelector('.ptIzq')), perfil: r(U.querySelector('.ptPerfil')), jugar: r(U.querySelector('.ptJugar')), pasos2: ['ptTabsC2', 'ptMultiW'].filter((c) => U.classList.contains(c)) };
})()`;
// los adornos: filtros, animaciones, sombras borrosas en las letras y degradados fuera de las capas de diseño
const ADORNOS = `(() => {
  const malos = [], CAPAS = /\\bpt(IcoF|Marco|Relleno|Txt|Rayas|JugarF|JugarR|ModoF|Tabs|Tab|Cont|Perfil|Avatar|Anillo|Cartel|Led|Sw|Cu|Fondo)\\b|^pt(Led|Refl|Piso|Torre|Truss|Haz|Luz|Base)/;
  const todos = [...RB.el.querySelectorAll('.ptHome *'), ...document.querySelectorAll('#ptFondo, #ptFondo *')];
  for (const e of todos) {
    if (!(e.offsetWidth > 0) || e.closest('.oc')) continue;
    const id = String(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className || e.id || e.tagName);
    for (const ps of ['', '::before', '::after']) {
      const c = getComputedStyle(e, ps || null); if (ps && (c.content === 'none' || c.content === 'normal')) continue;
      if (c.filter !== 'none') malos.push(id + ps + ' filtro ' + c.filter);
      if (c.backdropFilter && c.backdropFilter !== 'none') malos.push(id + ps + ' desenfoque de fondo');
      if (c.animationName !== 'none' && c.animationIterationCount === 'infinite') malos.push(id + ps + ' animación sin fin ' + c.animationName);
      if (c.textShadow !== 'none' && (c.textShadow.match(/(-?[\\d.]+)px/g) || []).map(parseFloat)[2] > 0) malos.push(id + ps + ' sombra borrosa en la letra');
      if (/gradient/.test(c.backgroundImage) && !CAPAS.test(id) && !(e.id === 'ptFondo')) malos.push(id + ps + ' degradado fuera de las capas');
    }
  }
  return malos;
})()`;
// contraste WCAG entre dos colores; el fondo translúcido se mezcla con negro y con blanco (el peor caso)
const L = (c) => { const [r, g, bb] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bb; };
const contraste = (t, f) => { const al = f[3] === undefined ? 1 : f[3], sobre = (bg) => f.slice(0, 3).map((v, i) => v * al + bg[i] * (1 - al));
  return Math.min(...[[0, 0, 0], [255, 255, 255]].map((bg) => { const l1 = L(t), l2 = L(sobre(bg)); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); })); };
// el color de la letra y el de su fondo: el primer fondo de verdad para arriba (el color o el primer color del degradado) o,
// en los botones que lo tienen en una capa aparte (JUGAR, el mapa), el de esa capa
const COLORES = `(() => { const num = (s) => (s.match(/[\\d.]+/g) || []).map(Number), out = [];
  const fondo = (e) => { for (let a = e; a && a !== RB.el; a = a.parentElement) {
      // (en las tarjetas, lo de atrás es la capa que oscurece la foto: .ptRelleno::after)
      if (a.matches('.ptCarta')) { const g = getComputedStyle(a.querySelector('.ptRelleno'), '::after').backgroundImage.match(/rgba?\([^)]*\)/); if (g) return num(g[0]); }
      const capa = a.matches('button') && a.querySelector(':scope > .ptJugarF, :scope > .ptModoF'); const c = getComputedStyle(capa || a);
      if (num(c.backgroundColor)[3] !== 0 && c.backgroundColor !== 'rgba(0, 0, 0, 0)') return num(c.backgroundColor);
      const g = c.backgroundImage.match(/rgba?\\([^)]*\\)/); if (g) return num(g[0]); }
    return [5, 6, 9]; };
  for (const e of PTD.ui.querySelectorAll('.ptCT, .ptTabT, .ptJugarT, .ptModoN')) if (e.offsetWidth && !e.closest('.oc')) out.push({ t: e.textContent.trim(), c: num(getComputedStyle(e).color), f: fondo(e) });
  const j = getComputedStyle(PTD.ui.querySelector('.ptJugarF')).backgroundImage;
  return { out, jugarAmarillo: /rgb\\(242, 179, 27\\)/.test(j) };
})()`;
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
  m.adornos = await ev(ADORNOS); m.colores = await ev(COLORES);
  m.fuente = await ev(`(() => { const c = document.createElement('canvas').getContext('2d'), t = 'MULTIJUGADOR JUGAR'; c.font = "500 40px 'JX Oswald'"; const a = c.measureText(t).width; c.font = '500 40px sans-serif'; const z = c.measureText(t).width; return { cargada: document.fonts.check("500 40px 'JX Oswald'"), a: +a.toFixed(1), z: +z.toFixed(1) }; })()`);
  if (nom === 'compu') m.caja = await ev(`(() => { try { cnGuardar(true); } catch (e) {} try { const o = JSON.parse(localStorage.getItem(CN_K) || 'null'); return { v: JX_VERSION, caja: o && o.v }; } catch (e) { return { v: JX_VERSION, err: e.message }; } })()`);
  m.version = await ev('JX_VERSION');
  await p.screenshot({ path: D + 'menu30_' + nom + '.png' });
  // 6: los 14 idiomas (en el celular chico y en el común)
  if (nom === 'celu_chico' || nom === 'celu') {
    m.idiomas = {};
    for (const I of IDIOMAS) { await ev(`idiomaAplicar(${JSON.stringify(I)}); inicioLista(); 1`); await p.waitForTimeout(300); m.idiomas[I] = await ev(MEDIR); if (nom === 'celu_chico' && ['ar', 'ru', 'ja', 'th', 'id'].includes(I)) await p.screenshot({ path: D + 'menu30_' + nom + '_' + I + '.png' }); }
    await ev(`idiomaAplicar('es'); inicioLista(); 1`); await p.waitForTimeout(300);
  }
  // 7: tocar
  if (nom === 'celu') {
    const box = (sel) => ev(`(() => { const q = RB.el.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; })()`);
    let c = await box('.ptModo'); await p.mouse.click(c.x, c.y); await p.waitForTimeout(400);
    const a1 = await ev(`RB.panel`);
    c = await box('.rbPan [data-rb=volver]'); await p.mouse.click(c.x, c.y); await p.waitForTimeout(400);
    const a2 = await ev(`({ panel: RB.panel, portada: ptdVisible() && MENU.caja === PTD.esc })`);
    m.toques = { empezar: a1, volver: a2 };
  }
  await ctx.close();
}
// --- 1: la versión
const vers = Object.entries(M).map(([k, m]) => ({ k, t: m.ver.t, f: m.ver.f, dentro: m.ver.x0 >= -1 && m.ver.y0 >= -1 && m.ver.x1 <= m.W + 1 && m.ver.y1 <= m.H + 1, v: m.version }));
const reV = (v) => new RegExp('^JXMod ' + v.replace(/\./g, '\\.') + ' \\d\\d/\\d\\d/\\d{4}$', 'i');
caso('1. la versión se ve: «JXMod X.Y» con el día, entera y legible en las 4 pantallas, igual a JX_VERSION y en la caja negra',
  vers.every((v) => reV(v.v).test(v.t.replace(/\s+/g, ' ')) && v.dentro && v.f >= 12) && M.compu.caja && M.compu.caja.v === M.compu.version && new RegExp('^' + M.compu.version.replace(/\./g, '\\.') + ' · ').test(M.compu.caja.caja || ''), { vers, caja: M.compu.caja });
// --- 2: la letra
const fu = Object.entries(M).map(([k, m]) => ({ k, ...m.fuente, fam: m.lab.find((x) => /ptCT/.test(x.k)).fam.split(',')[0] }));
caso('2. la letra del menú es la nuestra y está cargada (mide distinto que la de reserva)', fu.every((f) => f.cargada && /JX Oswald/.test(f.fam) && Math.abs(f.a - f.z) > 20), fu);
// --- 3: adornos
const ad = Object.entries(M).map(([k, m]) => ({ k, adornos: m.adornos.slice(0, 5) }));
caso('3. adornos sólo donde son diseño: sin filtros ni desenfoques, sin animaciones sin fin, sin sombras borrosas en la letra, degradados sólo en las capas', ad.every((a) => !a.adornos.length), ad);
// --- 4: alineación
const ali = Object.entries(M).map(([k, m]) => {
  const ini = (q) => (m.rtl ? -q.x1 : q.x0), fin = (q) => (m.rtl ? -q.x0 : q.x1), rng = (L) => +(Math.max(...L) - Math.min(...L)).toFixed(2);
  // (JUGAR va inclinado: su caja derecha es la del bloque —.ptPartida—, que es la que se alinea)
  return { k, izq: rng(m.izq.map(ini)), der: rng(m.der.map(fin)), cartas: rng(m.cartas.map((q) => q.w)), iconosAlto: rng(m.iconos.map((q) => q.h)), iconosLinea: rng(m.iconos.map((q) => q.y0 + q.h / 2)) };
});
caso('4. lo de la izquierda a un borde y lo de la derecha al otro (±1 px), las tarjetas del mismo ancho y los íconos de arriba del mismo alto y en línea (±1 px)', ali.every((a) => a.izq <= 1 && a.der <= 1 && a.cartas <= 1 && a.iconosAlto <= 1 && a.iconosLinea <= 1), ali);
// --- 5: JUGAR y el contraste
const con = Object.entries(M).map(([k, m]) => ({ k, amarillo: m.colores.jugarAmarillo, cMin: +Math.min(...m.colores.out.map((x) => contraste(x.c, x.f))).toFixed(1), peor: m.colores.out.map((x) => ({ t: x.t, c: +contraste(x.c, x.f).toFixed(1) })).sort((a, z) => a.c - z.c)[0] }));
caso('5. JUGAR en el amarillo de acento con letra oscura; los textos principales con contraste ≥ 7', con.every((c) => c.amarillo && c.cMin >= 7), con);
// --- 6: idiomas
const idi = [];
for (const nom of ['celu_chico', 'celu']) for (const [I, m] of Object.entries(M[nom].idiomas)) {
  const probs = [], pisa = (a, c, g) => a.x0 < c.x1 + g && c.x0 < a.x1 + g && a.y0 < c.y1 + g && c.y0 < a.y1 + g;
  for (const x of m.lab) {
    if (x.sw > x.cw + 1) probs.push(x.t + ' se sale');
    if (x.h > x.lh * 1.6) probs.push(x.t + ' en dos renglones');
    if (x.btn && (x.x0 < x.btn.x0 - 2 || x.x1 > x.btn.x1 + 2 || x.y0 < x.btn.y0 - 2 || x.y1 > x.btn.y1 + 2)) probs.push(x.t + ' sale del botón');
  }
  if (m.pasos2.length) probs.push('en dos renglones: ' + m.pasos2.join(','));
  for (let i = 0; i < m.bt.length; i++) for (let j = i + 1; j < m.bt.length; j++) if (pisa(m.bt[i], m.bt[j], -1)) probs.push(m.bt[i].k + '×' + m.bt[j].k);
  for (const x of m.bt) if (x.x0 < -1 || x.y0 < -1 || x.x1 > m.W + 1 || x.y1 > m.H + 1) probs.push(x.k + ' afuera');
  if (m.esc.w < m.W * 0.15) probs.push('escenario ' + Math.round(m.esc.w / m.W * 100) + ' % del ancho');
  if (m.izqCol.w > m.W * 0.4) probs.push('tarjetas ' + Math.round(m.izqCol.w / m.W * 100) + ' % del ancho');
  if (I === 'ar' && !(m.rtl && m.perfil.x0 > m.W / 2 && m.jugar.x1 < m.W / 2)) probs.push('árabe sin espejar');
  if (probs.length) idi.push({ nom, I, probs: probs.slice(0, 6) });
}
caso('6. los 14 idiomas en el celular chico y en el común: sin textos que se salgan ni partidos, nada se pisa, el escenario se ve; árabe espejado', !idi.length, idi.slice(0, 8));
// --- 7: toques y errores
const e2 = errJS.filter((e) => !/WebSocket|net::|Failed to load|Failed to fetch|NetworkError/i.test(e));
caso('7. tocar responde (el mapa elegido → Empezar partida nueva, Volver → la portada) y sin errores de JS', M.celu.toques && M.celu.toques.empezar === 'nueva' && M.celu.toques.volver.panel === null && M.celu.toques.volver.portada && !e2.length, { toques: M.celu.toques, err: e2.slice(0, 4) });
console.log('RESUMEN ' + RES.filter(Boolean).length + '/' + RES.length);
await b.close(); process.exit(RES.every(Boolean) ? 0 : 1);
