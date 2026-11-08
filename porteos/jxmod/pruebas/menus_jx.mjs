// Los menús de la 3.0 con identidad propia (pedido: «cambiar esos menús de mapas, de juego y de pausa a algo más
// original… no hay que darle identidad de hyper sandbox»): Nueva partida (elegir mapa), el menú de spawn y la pausa,
// en 7 pantallas (compu 1920×1080 y 1366×768, tablet 1180×820, celulares apaisados 873×393, 800×368 y 640×360 y el
// celular parado 393×873, donde el juego se gira 90°):
//  1. todo adentro de la pantalla y nada se pisa (título, pestañas, cuerpo y pie; los botones del pie entre sí y en un
//     renglón, aun con el selector de modos de GMod; la X con las pestañas, y ninguna pestaña cortada por el borde sin
//     antes juntarlas); la pausa entra entera sin tener que deslizarla;
//  2. objetivos táctiles de 40 px o más (botones, pestañas, tarjetas, selectores; las categorías del spawn, 36 en la
//     compu) y letras de al menos 11 px;
//  3. ningún texto cortado (los nombres de los mapas del juego, los títulos y las líneas de las tarjetas de la pausa, las
//     pestañas) — en los 14 idiomas para la pausa, las pestañas de Nueva partida y las del spawn (en el celular chico y en
//     el parado);
//  4. se lee bien: contraste ≥ 4,5 en todo texto y ≥ 7 en los títulos y botones principales (el fondo translúcido, con
//     negro y con una escena clara detrás: el peor);
//  5. la identidad 3.0: la letra del menú (Oswald) en títulos y botones, el amarillo de acento en lo principal (Empezar
//     partida, Seguir, la pestaña elegida) y nada de bordes redondeados, sombras con desenfoque ni degradados;
//  6. todo sigue andando: elegir un mapa más abajo cambia el elegido grande y la grilla no salta arriba; los grupos; Volver;
//     Empezar partida entra al mapa; las pestañas y la X del spawn; Seguir, la X y «Borrar todo» (pide otra vez) en la
//     pausa; sin errores de JS.
// uso: node menus_jx.mjs URL_HTML [CARPETA_FOTOS]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, DIR = '.'] = process.argv, D = DIR + '/';
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 1500)); return ok; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const PANT = [['pc1080', 1920, 1080, false], ['pc', 1366, 768, false], ['tablet', 1180, 820, true], ['celu', 873, 393, true], ['celu_u', 800, 368, true], ['celu_ch', 640, 360, true], ['parado', 393, 873, true]];
const IDIOMAS = ['es', 'en', 'pt', 'id', 'ms', 'fil', 'ja', 'th', 'tr', 'ar', 'ru', 'uk', 'fr', 'de'];
const errJS = [];
// las medidas, en la página: rectángulos en el marco del juego (con el juego girado, getBoundingClientRect da el
// rectángulo girado: se vuelve al del juego), textos cortados, tamaños, contraste, letra y adornos
const AYUDAS = `(() => {
  const rot = document.documentElement.classList.contains('rot'), PW = innerWidth;
  window.__J = {
    rot, W: rot ? innerHeight : innerWidth, H: rot ? innerWidth : innerHeight,
    r(e) { const q = e.getBoundingClientRect(); const o = rot ? { x0: q.top, x1: q.bottom, y0: PW - q.right, y1: PW - q.left } : { x0: q.left, x1: q.right, y0: q.top, y1: q.bottom }; o.w = o.x1 - o.x0; o.h = o.y1 - o.y0; return o; },
    pisa(a, c, g = 0) { return a.x0 < c.x1 - g && c.x0 < a.x1 - g && a.y0 < c.y1 - g && c.y0 < a.y1 - g; },
    dentro(a, c, g = 1) { return a.x0 >= c.x0 - g && a.y0 >= c.y0 - g && a.x1 <= c.x1 + g && a.y1 <= c.y1 + g; },
    corta(e) { return e.scrollWidth > e.clientWidth + 1; },   // (cortado a lo ancho: con puntos suspensivos o tapado)
    rgba(s) { const n = (s.match(/[\\d.]+/g) || [0, 0, 0, 0]).map(Number); return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1]; },
    // el fondo de verdad: se suben los padres sumando los translúcidos hasta uno opaco (si no hay, la escena: negra o clara)
    fondo(e, escena) { const capas = []; for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const c = this.rgba(getComputedStyle(x).backgroundColor); if (c[3] > 0) { capas.push(c); if (c[3] >= 1) break; } }
      let f = escena; for (let i = capas.length - 1; i >= 0; i--) { const c = capas[i]; f = f.map((v, k) => c[k] * c[3] + v * (1 - c[3])); } return f; },
    lum(c) { const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; },
    contraste(e) { const t = this.rgba(getComputedStyle(e).color); return Math.min(...[[0, 0, 0], [200, 220, 235]].map((esc) => { const f = this.fondo(e, esc), tt = t.slice(0, 3).map((v, k) => v * t[3] + f[k] * (1 - t[3])), a = this.lum(tt), c = this.lum(f); return (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05); })); },
    adornos(raiz) { const malos = []; for (const e of [raiz, ...raiz.querySelectorAll('*')]) { if (!e.getClientRects().length) continue; const c = getComputedStyle(e), id = e.id || (typeof e.className === 'string' ? e.className : e.tagName);
      if (e.tagName === 'IMG' || e.tagName === 'INPUT' && e.type === 'range') continue;
      if (parseFloat(c.borderTopLeftRadius) > 1 || parseFloat(c.borderBottomRightRadius) > 1) malos.push(id + ' redondeado');
      for (const s of [c.boxShadow, c.textShadow]) if (s !== 'none' && s.split(/,(?![^(]*\\))/).some((p) => { const n = (p.match(/-?[\\d.]+px/g) || []).map(parseFloat); return n.length >= 3 && n[2] > 0.5; })) malos.push(id + ' sombra');
      if (/gradient/.test(c.backgroundImage)) malos.push(id + ' degradado'); }
      return [...new Set(malos)]; },
    oswald(e) { return /JX Oswald/.test(getComputedStyle(e).fontFamily); },
    letra(e) { return parseFloat(getComputedStyle(e).fontSize); },
    toque(e) { const q = this.r(e); return Math.min(q.w, q.h); },
  };
  return 1;
})()`;
const M = {};
for (const [nom, w, h, movil] of PANT) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: movil, hasTouch: movil, locale: 'es-AR' });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await ctx.newPage(); p.on('pageerror', (e) => errJS.push(nom + ': ' + e.message.slice(0, 200)));
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await p.goto(HTML + '?test&sinred=1'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.nombre = 'NijulaX'; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); idiomaAplicar('es'); PREFS.lang = 'es'; guardarPrefs(); inicioMostrar(true); 1`);
  await p.evaluate(() => document.fonts.ready); await ev(AYUDAS);
  const m = M[nom] = {};
  // ---------- Nueva partida ----------
  const NUEVA = `(() => { const J = __J, P = RB.el.querySelector('.rbPan'), q = (s) => P.querySelector(s), qs = (s) => [...P.querySelectorAll(s)];
    const pan = J.r(P), cab = J.r(q('.rbPanCab')), cats = J.r(q('.rbCats')), cuerpo = J.r(q('.rbPanCuerpo')), pie = J.r(q('.rbPanPie')), hero = J.r(q('.nvHero')), grid = J.r(q('.rbGrid'));
    const pieH = qs('.rbPanPie > *').filter((e) => e.getClientRects().length && !e.classList.contains('rbEsp')), probs = [];
    if (!J.dentro(pan, { x0: 0, y0: 0, x1: J.W, y1: J.H })) probs.push('panel afuera');
    for (const [a, n1, c, n2] of [[cab, 'título', cats, 'pestañas'], [cats, 'pestañas', cuerpo, 'cuerpo'], [cuerpo, 'cuerpo', pie, 'pie'], [hero, 'elegido', grid, 'grilla']]) if (J.pisa(a, c, 1)) probs.push(n1 + '×' + n2);
    for (const e of [cab, cats, cuerpo, pie]) if (!J.dentro(e, pan)) probs.push('se sale del panel');
    pieH.forEach((e, i) => { const a = J.r(e); if (!J.dentro(a, pie)) probs.push('pie: ' + (e.dataset.rb || e.className) + ' afuera'); pieH.slice(i + 1).forEach((o) => { if (J.pisa(a, J.r(o), 1)) probs.push('pie: se pisan'); }); });
    // (renglones: los que se tocan a lo alto van en el mismo)
    const filas = pieH.map((e) => J.r(e)).sort((a, c) => a.y0 - c.y0).reduce((f, a) => { const u = f[f.length - 1]; if (u && a.y0 < u.y1 - 2) u.y1 = Math.max(u.y1, a.y1); else f.push({ y1: a.y1 }); return f; }, []).length;
    const toques = [...qs('.rbPanPie button, .rbPanPie select, .rbCat, .rbMapaG')].filter((e) => e.getClientRects().length).map((e) => ({ k: e.dataset.rb || e.tagName, t: J.toque(e) })).filter((x) => x.t < 40);
    const cortados = [...qs('.rbMapaG[data-rb^="mapa:"] > b, .rbCat, .rbPanPie button, .nvInfo b, .nvInfo small')].filter((e) => J.corta(e)).map((e) => e.textContent.trim())
      .concat([...qs('.rbMapaG[data-rb^="mapa:"] > b, .nvInfo b')].filter((e) => { const c = getComputedStyle(e); return (e.scrollHeight - parseFloat(c.paddingTop) - parseFloat(c.paddingBottom)) / parseFloat(c.lineHeight) > 2.4; }).map((e) => e.textContent.trim() + ' (más de 2 renglones)'));   // (los nombres, hasta en dos renglones)
    const chicas = [...qs('.rbMapaG > b, .rbCat, .rbPanPie button, .rbPanPie select, .nvInfo span')].filter((e) => J.letra(e) < 11).length;
    const con = [...qs('.rbPanCab, .rbCat, .rbMapaG > b, .rbPanPie button, .rbPanPie select, .rbCampo, .nvInfo b, .nvInfo small, .nvInfo span')].filter((e) => e.getClientRects().length).map((e) => ({ k: e.className || e.tagName, c: +J.contraste(e).toFixed(1), pri: e.matches('.rbPanCab, .rbBtnG, .nvInfo b, .rbMapaG > b') }));
    const emp = q('[data-rb=empezar]'), selC = q('.rbCat.sel');
    return { probs, filas, pieAlto: +(pie.h / pan.h).toFixed(2), toques, cortados, chicas, conMin: Math.min(...con.map((x) => x.c)), conPriMin: Math.min(...con.filter((x) => x.pri).map((x) => x.c)), conMal: con.filter((x) => x.c < (x.pri ? 7 : 4.5)).slice(0, 4),
      oswald: [q('.rbPanCab'), emp, selC, q('.rbMapaG > b')].every((e) => J.oswald(e)), amarillo: getComputedStyle(emp).backgroundColor, adornos: J.adornos(P).slice(0, 6) };
  })()`;
  // (con dos modos de juego de GMod instalados —un selector más en el pie—: el peor caso para que el pie entre en un renglón)
  await ev(`GMM.lista.set('pruebaPH', { n: 'pruebaPH', titulo: 'Prop Hunt', menu: true }); GMM.lista.set('pruebaTTT', { n: 'pruebaTTT', titulo: 'Trouble in Terrorist Town', menu: true }); 1`);
  await ev(`RB.cat = 'todos'; RB.mapa = 'FlatGrass'; RB.mapaCom = null; inicioPanel('nueva'); 1`); await p.waitForTimeout(500);
  m.nueva = await ev(NUEVA); await p.screenshot({ path: D + 'menus_' + nom + '_nueva.png' });
  // los grupos en los 14 idiomas (celular chico y parado): pestañas sin cortar y el pie en un renglón
  if (nom === 'celu_ch' || nom === 'parado' || nom === 'pc') {
    m.nuevaIdi = {};
    for (const L of IDIOMAS) { await ev(`idiomaAplicar(${JSON.stringify(L)}); PREFS.lang = ${JSON.stringify(L)}; inicioPanel('nueva'); 1`); await p.waitForTimeout(120); const r = await ev(NUEVA); m.nuevaIdi[L] = { probs: r.probs, filas: r.filas, cortados: r.cortados }; }
    await ev(`idiomaAplicar('es'); PREFS.lang = 'es'; inicioPanel('nueva'); 1`);
  }
  await ev(`GMM.lista.delete('pruebaPH'); GMM.lista.delete('pruebaTTT'); GMM.elegido = 'auto'; inicioPanel('nueva'); 1`);
  // 6: elegir un mapa de más abajo, la grilla queda donde estaba; un grupo; Volver
  if (nom === 'celu') {
    const box = (sel) => ev(`(() => { const q = RB.el.querySelector(${JSON.stringify(sel)}); q.scrollIntoView({ block: 'nearest' }); const r = q.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await ev(`RB.el.querySelector('.rbGrid').scrollTop = 9999; 1`); await p.waitForTimeout(150);
    const antes = await ev(`RB.el.querySelector('.rbGrid').scrollTop`);
    let c = await box('.rbMapaG[data-rb="mapa:RB_Luna"]'); const antes2 = await ev(`RB.el.querySelector('.rbGrid').scrollTop`);
    await p.touchscreen.tap(c.x, c.y); await p.waitForTimeout(300);
    const des = await ev(`({ mapa: RB.mapa, desliz: RB.el.querySelector('.rbGrid').scrollTop, hero: RB.el.querySelector('.nvInfo b').textContent, sel: (RB.el.querySelector('.rbMapaG.sel') || {}).dataset.rb })`);
    c = await box('.rbCat[data-rb="cat:espacio"]'); await p.touchscreen.tap(c.x, c.y); await p.waitForTimeout(300);
    const grupo = await ev(`({ cat: RB.cat, n: RB.el.querySelectorAll('.rbMapaG').length, desliz: RB.el.querySelector('.rbGrid').scrollTop })`);
    c = await box('.rbPan [data-rb=volver]'); await p.touchscreen.tap(c.x, c.y); await p.waitForTimeout(300);
    const volver = await ev(`RB.panel`);
    m.toquesNueva = { antes, antes2, des, grupo, volver };
    // Empezar partida: entra al mapa elegido
    await ev(`RB.cat = 'todos'; RB.mapa = 'FlatGrass'; RB.mapaCom = null; inicioPanel('nueva'); 1`); await p.waitForTimeout(300);
    c = await box('.rbPan [data-rb=empezar]'); await p.touchscreen.tap(c.x, c.y);
    await p.waitForFunction(() => window.__ev('JUEGO.estado') === 'juego', null, { timeout: 60000 }).catch(() => {});
    m.toquesNueva.empezar = await ev(`({ estado: JUEGO.estado, mapa: MUNDO.nombre })`);
  }
  // ---------- en la partida: spawn y pausa ----------
  if (await ev(`JUEGO.estado`) !== 'juego') { await ev(`inicioPanel(null); inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await p.waitForFunction(() => window.__ev('JUEGO.estado') === 'juego', null, { timeout: 60000 }); }
  await p.waitForTimeout(2000); await ev(AYUDAS);
  const SPAWN = `(() => { const J = __J, S = $('spawn'), q = (s) => S.querySelector(s), qs = (s) => [...S.querySelectorAll(s)].filter((e) => e.getClientRects().length);
    const sp = J.r(S), tabs = J.r(q('.tabs')), cuerpo = J.r(q('.cuerpo')), pie = J.r(q('.pie')), x = q('.xCerrar'), probs = [];
    if (!J.dentro(sp, { x0: 0, y0: 0, x1: J.W, y1: J.H })) probs.push('spawn afuera');
    if (J.pisa(tabs, cuerpo, 1) || J.pisa(cuerpo, pie, 1)) probs.push('partes se pisan');
    // (lo que se ve de cada pestaña: la fila se desliza y lo que queda afuera no está debajo de la X)
    const tabsR = qs('.tab').map((e) => J.r(e)).filter((t) => t.x1 > tabs.x0 + 1 && t.x0 < tabs.x1 - 1).map((t) => ({ ...t, x0: Math.max(t.x0, tabs.x0), x1: Math.min(t.x1, tabs.x1) }));
    if (x) { const xr = J.r(x); if (tabsR.some((t) => J.pisa(t, xr, 1))) probs.push('X×pestaña'); }
    // (una pestaña cortada por el borde de la fila sólo si ni con las otras en ícono entran: entonces se desliza)
    const tb = q('.tabs'), recort = qs('.tab').map((e) => J.r(e)).filter((t) => t.x0 < tabs.x0 - 1 || t.x1 > tabs.x1 + 1).length;
    if (recort && !tb.classList.contains('apretadas')) probs.push(recort + ' pestañas cortadas por el borde sin achicar las otras');
    const coarse = matchMedia('(pointer: coarse)').matches;
    const toques = [...qs('.tab'), ...qs('.it'), ...qs('.pie label'), ...(x ? [x] : [])].map((e) => ({ k: e.className || e.tagName, t: J.toque(e) })).filter((o) => o.t < 40)
      .concat(qs('.cat').map((e) => ({ k: 'cat', t: J.toque(e) })).filter((o) => o.t < (coarse ? 40 : 36)));
    const cortadas = qs('.tab span').filter((e) => J.corta(e)).map((e) => e.textContent);
    const chicas = [...qs('.it span'), ...qs('.cat'), ...qs('.tab'), ...qs('.pie label')].filter((e) => J.letra(e) < 11).length;
    const con = [...qs('.tab'), ...qs('.cat'), ...qs('.it span'), ...qs('.pie label'), ...qs('.spBus input')].map((e) => ({ k: e.className || e.tagName, c: +J.contraste(e).toFixed(1), pri: e.matches('.tab.sel, .cat.sel') }));
    return { probs, toques: toques.slice(0, 6), cortadas, apretadas: q('.tabs').classList.contains('apretadas'), chicas, conMin: Math.min(...con.map((o) => o.c)), conPriMin: Math.min(...con.filter((o) => o.pri).map((o) => o.c)), conMal: con.filter((o) => o.c < (o.pri ? 7 : 4.5)).slice(0, 4),
      oswald: [q('.tab.sel'), q('.cat'), q('.pie label')].every((e) => J.oswald(e)), amarillo: getComputedStyle(q('.tab.sel')).backgroundColor, adornos: J.adornos(S).filter((a) => !/^it\\b|ico/.test(a)).slice(0, 6), items: qs('.it').length };
  })()`;
  await ev(`cerrarPaneles(); UI.tab = DATA.menu.findIndex((c) => c.n === 'Props'); UI.sub = 1; UI.q = ''; abrirSpawn(); 1`); await p.waitForTimeout(900);
  m.spawn = await ev(SPAWN); await p.screenshot({ path: D + 'menus_' + nom + '_spawn.png' });
  if (nom === 'celu_ch' || nom === 'parado') {
    m.spawnIdi = {};
    for (const L of IDIOMAS) { await ev(`cerrarPaneles(); idiomaAplicar(${JSON.stringify(L)}); PREFS.lang = ${JSON.stringify(L)}; abrirSpawn(); 1`); await p.waitForTimeout(120); const r = await ev(SPAWN); m.spawnIdi[L] = { probs: r.probs, cortadas: r.cortadas, toques: r.toques }; }
    await ev(`cerrarPaneles(); idiomaAplicar('es'); PREFS.lang = 'es'; 1`);
  }
  if (nom === 'celu') {
    const box = (sel) => ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await ev(`cerrarPaneles(); UI.tab = 0; abrirSpawn(); 1`); await p.waitForTimeout(400);
    const iv = await ev(`DATA.menu.findIndex((c) => c.n === 'Vehicles')`);
    let c = await box(`#tabs .tab:nth-child(${iv + 1})`); await p.touchscreen.tap(c.x, c.y); await p.waitForTimeout(300);
    const tab = await ev(`({ tab: UI.tab, sel: [...$('tabs').children].findIndex((t) => t.classList.contains('sel')) })`);
    c = await ev(`(() => { const r = document.querySelectorAll('#cats .cat')[2].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`); await p.touchscreen.tap(c.x, c.y); await p.waitForTimeout(300);
    const cat = await ev(`UI.sub`);
    c = await box('#spawn .xCerrar'); await p.touchscreen.tap(c.x, c.y); await p.waitForTimeout(300);
    m.toquesSpawn = { iv, tab, cat, x: await ev(`({ abierto: UI.abierto, oculto: $('spawn').classList.contains('oc') })`) };
  }
  // ---------- pausa ----------
  const PAUSA = `(() => { const J = __J, P = $('pausa'), C = P.querySelector('.pzCaja'), q = (s) => C.querySelector(s), qs = (s) => [...C.querySelectorAll(s)].filter((e) => e.getClientRects().length);
    const caja = J.r(C), probs = [];
    if (!J.dentro(caja, { x0: 0, y0: 0, x1: J.W, y1: J.H })) probs.push('caja afuera');
    if (C.scrollHeight > C.clientHeight + 1) probs.push('hay que deslizar ' + (C.scrollHeight - C.clientHeight) + ' px');
    const partes = [q('.pzCab'), q('.pzSeguir'), q('.pzGrid'), q('.pzPie')].map((e) => J.r(e));
    partes.forEach((a, i) => partes.slice(i + 1).forEach((c) => { if (J.pisa(a, c, 1)) probs.push('partes se pisan'); }));
    const cab = qs('.pzCab > *').map((e) => J.r(e)); cab.forEach((a, i) => cab.slice(i + 1).forEach((c) => { if (J.pisa(a, c, 1)) probs.push('título se pisa'); }));
    const pie = qs('.pzPie > *').map((e) => J.r(e)); pie.forEach((a, i) => pie.slice(i + 1).forEach((c) => { if (J.pisa(a, c, 1)) probs.push('pie se pisa'); }));
    const toques = qs('button').map((e) => ({ k: e.id, t: J.toque(e) })).filter((o) => o.t < 40);
    const cortados = [...qs('.pzTar b'), ...qs('.pzTar small'), ...qs('.pzSeguir span'), ...qs('.pzSalir span'), ...qs('.pzChico span'), q('#tPausa')].filter((e) => e && J.corta(e)).map((e) => e.textContent);
    const chicas = qs('b, small, span').filter((e) => e.textContent.trim() && J.letra(e) < 11).length;
    const con = [q('#tPausa'), q('.pzModo'), q('.pzSeguir span'), ...qs('.pzTar b'), ...qs('.pzTar small'), ...qs('.pzPie button span'), q('.pzFps')].filter(Boolean).map((e) => ({ k: e.id || e.className || e.tagName, c: +J.contraste(e).toFixed(1), pri: e.matches('#tPausa, .pzSeguir span, .pzTar b') }));
    return { probs, toques, cortados, chicas, conMin: Math.min(...con.map((o) => o.c)), conPriMin: Math.min(...con.filter((o) => o.pri).map((o) => o.c)), conMal: con.filter((o) => o.c < (o.pri ? 7 : 4.5)).slice(0, 4),
      oswald: [q('#tPausa'), q('.pzSeguir'), q('.pzTar b'), q('.pzSalir')].every((e) => J.oswald(e)), amarillo: getComputedStyle(q('.pzSeguir')).backgroundColor, adornos: J.adornos(C).slice(0, 6) };
  })()`;
  await ev(`cerrarPaneles(); abrirPausa(); 1`); await p.waitForTimeout(400);
  m.pausa = await ev(PAUSA); await p.screenshot({ path: D + 'menus_' + nom + '_pausa.png' });
  if (nom === 'celu_ch' || nom === 'parado' || nom === 'pc') {
    m.pausaIdi = {};
    for (const L of IDIOMAS) { await ev(`cerrarPaneles(); idiomaAplicar(${JSON.stringify(L)}); PREFS.lang = ${JSON.stringify(L)}; abrirPausa(); 1`); await p.waitForTimeout(100); const r = await ev(PAUSA); m.pausaIdi[L] = { probs: r.probs, cortados: r.cortados }; if (nom === 'celu_ch' && ['de', 'ru', 'th', 'ar'].includes(L)) await p.screenshot({ path: D + 'menus_' + nom + '_pausa_' + L + '.png' }); }
    await ev(`cerrarPaneles(); idiomaAplicar('es'); PREFS.lang = 'es'; 1`);
  }
  if (nom === 'celu') {
    const box = (sel) => ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await ev(`cerrarPaneles(); abrirPausa(); 1`); await p.waitForTimeout(300);
    let c = await box('#bLimpiar'); await p.touchscreen.tap(c.x, c.y); await p.waitForTimeout(200);
    const borrar = await ev(`({ conf: !!$('bLimpiar').dataset.conf, txt: $('bLimpiar').querySelector('b').textContent, abierto: UI.abierto })`);
    c = await box('#bSeguir'); await p.touchscreen.tap(c.x, c.y); await p.waitForTimeout(250);
    const seguir = await ev(`UI.abierto`);
    await ev(`abrirPausa(); 1`); await p.waitForTimeout(250); c = await box('#pzX'); await p.touchscreen.tap(c.x, c.y); await p.waitForTimeout(250);
    m.toquesPausa = { borrar, seguir, x: await ev(`UI.abierto`) };
  }
  await ctx.close();
}
const P = Object.entries(M);
// --- 1
const c1 = P.map(([k, m]) => ({ k, nueva: m.nueva.probs, filasPie: m.nueva.filas, spawn: m.spawn.probs, pausa: m.pausa.probs })).filter((x) => x.nueva.length || x.spawn.length || x.pausa.length || x.filasPie > 1);
caso('1. todo adentro y nada se pisa en las 7 pantallas (el pie de Nueva partida en un renglón; la pausa sin deslizar)', !c1.length, c1.length ? c1 : P.map(([k, m]) => k + ': pie ' + Math.round(m.nueva.pieAlto * 100) + ' % del alto'));
// --- 2
const c2 = P.map(([k, m]) => ({ k, nueva: m.nueva.toques, spawn: m.spawn.toques, pausa: m.pausa.toques, chicas: m.nueva.chicas + m.spawn.chicas + m.pausa.chicas })).filter((x) => x.nueva.length || x.spawn.length || x.pausa.length || x.chicas);
caso('2. objetivos táctiles ≥ 40 px (categorías del spawn ≥ 36 en la compu) y letras ≥ 11 px', !c2.length, c2);
// --- 3
const c3 = [];
for (const [k, m] of P) {
  if (m.nueva.cortados.length) c3.push({ k, nueva: m.nueva.cortados }); if (m.spawn.cortadas.length) c3.push({ k, spawn: m.spawn.cortadas }); if (m.pausa.cortados.length) c3.push({ k, pausa: m.pausa.cortados });
  for (const [L, r] of Object.entries(m.pausaIdi || {})) if (r.cortados.length || r.probs.length) c3.push({ k, L, pausa: r.cortados.concat(r.probs) });
  for (const [L, r] of Object.entries(m.nuevaIdi || {})) if (r.cortados.length || r.probs.length || r.filas > 1) c3.push({ k, L, nueva: r.cortados.concat(r.probs), filas: r.filas });
  for (const [L, r] of Object.entries(m.spawnIdi || {})) if (r.cortadas.length || r.probs.length || r.toques.length) c3.push({ k, L, spawn: r.cortadas.concat(r.probs), toques: r.toques });
}
caso('3. ningún texto cortado (y en los 14 idiomas: pausa, grupos de Nueva partida y pestañas del spawn)', !c3.length, c3.slice(0, 8));
// --- 4
const c4 = P.map(([k, m]) => ({ k, nueva: [m.nueva.conMin, m.nueva.conPriMin], spawn: [m.spawn.conMin, m.spawn.conPriMin], pausa: [m.pausa.conMin, m.pausa.conPriMin], mal: [...m.nueva.conMal, ...m.spawn.conMal, ...m.pausa.conMal] }));
caso('4. contraste ≥ 4,5 en todo texto y ≥ 7 en títulos y botones principales', c4.every((x) => !x.mal.length), c4.filter((x) => x.mal.length).concat(c4.slice(0, 1)).slice(0, 6));
// --- 5
const AMA = 'rgb(242, 179, 27)';
const c5 = P.map(([k, m]) => ({ k, oswald: m.nueva.oswald && m.spawn.oswald && m.pausa.oswald, amarillo: [m.nueva.amarillo, m.spawn.amarillo, m.pausa.amarillo].every((c) => c === AMA), adornos: [...m.nueva.adornos, ...m.spawn.adornos, ...m.pausa.adornos] }));
caso('5. identidad 3.0: Oswald en títulos y botones, amarillo en lo principal, sin redondeos, sombras con desenfoque ni degradados', c5.every((x) => x.oswald && x.amarillo && !x.adornos.length), c5.filter((x) => !x.oswald || !x.amarillo || x.adornos.length).slice(0, 4));
// --- 6
const t = M.celu, tn = t.toquesNueva, ts = t.toquesSpawn, tp = t.toquesPausa;
const e2 = errJS.filter((e) => !/WebSocket|net::|Failed to (load|fetch)|NetworkError/i.test(e));
const ok6 = tn.des.mapa === 'RB_Luna' && /luna/i.test(tn.des.hero) && tn.des.sel === 'mapa:RB_Luna' && Math.abs(tn.des.desliz - tn.antes2) <= 2 && tn.antes2 > 40 && tn.grupo.cat === 'espacio' && tn.grupo.n === 3 && tn.volver === null && tn.empezar.estado === 'juego' && tn.empezar.mapa === 'FlatGrass'
  && ts.tab.tab === ts.iv && ts.tab.sel === ts.iv && ts.cat === 2 && ts.x.abierto === null && ts.x.oculto
  && tp.borrar.conf && tp.borrar.abierto === 'pausa' && tp.seguir === null && tp.x === null && !e2.length;
caso('6. todo anda: mapa de abajo (grilla en su lugar), grupos, Volver, Empezar; pestañas y X del spawn; Borrar todo, Seguir y X de la pausa; sin errores', ok6, { nueva: tn, spawn: ts, pausa: tp, err: e2.slice(0, 3) });
console.log('RESUMEN ' + RES.filter(Boolean).length + '/' + RES.length);
await b.close(); process.exit(RES.every(Boolean) ? 0 : 1);
