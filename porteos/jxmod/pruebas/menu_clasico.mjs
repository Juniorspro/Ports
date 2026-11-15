// El menú principal clásico (juego/clasico.js): el de la 3.3 (27f401f), que vuelve como menú de fábrica, mejorado (rasgaduras,
// grano, cinta, la línea amarilla gastada, íconos chicos y animaciones que terminan), y el selector «Menú de inicio» para
// elegir el clásico o el depósito (3.5). Lo que se mide:
//  1. fidelidad (con URL_33): las 8 opciones, su orden, sus tres grupos y su columna son los de la 3.3 (el borde de cada
//     barra a ±8 px del de la 3.3, en la misma pantalla y sin muesca), en 8 pantallas;
//  2. pantallas (873×402 y 915×412 con 40 px de muesca a la izquierda, 640×360, 800×368, el celular parado —el juego lo
//     gira—, tablet 1180×820, compu 1280×720 y 1920×1080): lo que se toca de 44 px o más, adentro de la pantalla (y de la
//     muesca) y sin pisarse; nada cortado; el texto de 14 px o más; el contraste medido en la imagen (con el texto
//     escondido) sobre las 6 escenas del fondo —las explosiones de la grieta, sus momentos más claros— ≥ 4,5;
//  3. los 14 idiomas en 873×402 (con muesca) y 640×360: nada se sale, se corta ni se pisa; el árabe, espejado;
//  4. animaciones: la entrada termina (nada corriendo en el menú a los 3 s); el fondo es el video de la escena (corre al
//     tiempo del reloj y la capa no se agranda: el video ya tiene su cámara; fondovideo.js y pruebas/fondos_video.mjs); los
//     cuadros que compone la placa por segundo con el menú quieto (3 s después de la entrada) no pasan los de la 3.3 (con
//     URL_33); con «menos movimiento» y con Gráficos Patata, ninguna animación (ni la entrada, ni el barrido, ni el glitch, ni
//     el fondo); con Bajos, sin el glitch ni las brasas, y la foto que se agranda de a 2 saltos por segundo;
//  5. rendimiento (con URL_33 y URL_35): con el procesador 4× más lento, en Gráficos bajos, medios y altos, corridas
//     alternadas: ms de JS y del hilo principal por segundo, el heap y el tiempo hasta poder tocar; el clásico, a lo sumo un
//     10 % arriba de la 3.3 en cada uno;
//  6. el selector (Ajustes → Gráficos → Menú de inicio): del clásico al depósito y de vuelta 3 veces, tocando de verdad: sin
//     errores, sin restos en la página (los mismos elementos, los mismos oyentes de la ventana, sin cajas, personajes ni mapa
//     del depósito, el dibujo en pausa como corresponde), el heap no crece más de 5 MB, cada menú se ve igual que recién
//     arrancado y la elección queda al recargar;
//  7. teclado y mando: flechas, Tab (el juego no se queda con él), Enter y Esc; la cruceta, A y B;
//  8. lo de la 3.4 y la 3.5 que sigue: la cuenta de Google al lado de tu nombre, Actualizar (en la app y en la web) y La
//     grieta con su interruptor;
//  9. sin errores de JS.
// uso: node menu_clasico.mjs URL_HTML [URL_33] [URL_35] [CARPETA_FOTOS]   (SOLO=1,2: sólo esas partes; CORRIDAS=2)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import { readFileSync, mkdirSync, unlinkSync } from 'fs'; import { tmpdir } from 'os';
const [, , HTML, U33 = '', U35 = '', DIR = '.'] = process.argv, D = DIR.replace(/\/$/, '') + '/';
try { mkdirSync(D, { recursive: true }); } catch (e) {}
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + (info === undefined ? '' : ' · ' + JSON.stringify(info).slice(0, 1800))); return ok; };
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'];
const CHROME = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const b = await chromium.launch({ executablePath: CHROME, args: ARGS });
const errJS = [];
const SOLO = (process.env.SOLO || '').split(',').filter(Boolean), corre = (n) => !SOLO.length || SOLO.includes(String(n));
const IDIOMAS = ['es', 'en', 'pt', 'id', 'ms', 'fil', 'ja', 'th', 'tr', 'ar', 'ru', 'uk', 'fr', 'de'];
const PREFS0 = (lang, extra) => Object.assign({ bienvenida: true, tutVisto: true, nombre: 'NijulaX', nombreOk: true, lang: lang || 'es', mapa: 'Desert' }, extra || {});
const FUERA = /Failed to load resource|net::ERR|WebSocket|mqtt|ERR_NAME/i;
// abrir el juego en una pantalla. o: { lang, ins (muesca a la izquierda), antes (otro script), url, prefs, google, movil, red (sin reducir), quieto }
async function abrir(nom, w, h, movil, o = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: o.dpr || 1, isMobile: movil, hasTouch: movil, locale: 'es-AR', reducedMotion: o.reducido ? 'reduce' : 'no-preference' });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: o.google ? '{"google":true,"cliente":"x.apps.googleusercontent.com"}' : '{"google":false}' }));
  await ctx.addInitScript((P) => { try { if (!localStorage.getItem('jx_prefs')) localStorage.setItem('jx_prefs', JSON.stringify(P)); } catch (e) {} }, PREFS0(o.lang, o.prefs));
  if (o.antes) await ctx.addInitScript(o.antes);
  const p = await ctx.newPage(); const mios = [];
  p.on('pageerror', (e) => { const t = nom + ': ' + e.message.slice(0, 200); errJS.push(t); mios.push(t); });
  p.on('console', (m) => { if (m.type() === 'error' && !FUERA.test(m.text())) { const t = nom + ' consola: ' + m.text().slice(0, 200); errJS.push(t); mios.push(t); } });
  if (o.ins) { const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: o.ins, right: 0, top: 0, bottom: 0 } }); }
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await p.goto((o.url || HTML) + '?test' + (o.q || '')); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
  await p.waitForTimeout(o.espera || 2400);
  return { ctx, p, ev, mios };
}
const esperar = async (p, js, ms = 8000) => { try { await p.waitForFunction((x) => window.__ev(x), js, { timeout: ms }); return true; } catch (e) { return false; } };
// (el clásico a la vista, la entrada terminada)
const clListo = (p, ms = 20000) => esperar(p, `RB.home === 'clasico' && clVisible() && !CL.el.classList.contains('clEntra')`, ms);
// el fondo quieto en una escena (sin el cambio cada 9 s ni el agrandado): para comparar fotos y medir el contraste
// (y sin el agrandado que da clKenPaso, ni el video de la escena encima de la foto —fondovideo.js—: la foto es su primer cuadro)
const FONDO = (i) => `(() => { clearInterval(RB.reloj); RB.reloj = 1; if (typeof CL !== 'undefined' && CL.tKen) clearInterval(CL.tKen); if (typeof FV !== 'undefined') { FV.roto = true; fvApagar(); } const c = RB.el.querySelectorAll('.rbBg'); c[0].style.backgroundImage = 'url(' + FONDOS_RB[${i}] + ')'; c[0].classList.add('on'); c[1].classList.remove('on');
  for (const x of c) { x.style.transition = 'none'; x.style.animation = 'none'; x.style.transform = 'scale(1.02)'; } return FONDOS_RB.length; })()`;
// ---------------- las medidas (en px del juego: con el juego girado, en las de la página girada) ----------------
const MEDIR = `(() => {
  const H0 = CL.el, rot = typeof PANT !== 'undefined' && PANT.rot, W = VW(), H = VH();
  const rr = (e) => { if (!rot) { const q = e.getBoundingClientRect(); return { x0: q.left, y0: q.top, x1: q.right, y1: q.bottom }; } const r = depRect(e); return { x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }; };
  // (lo que queda sólo para el lector de pantalla —1 px, recortado— no cuenta: en el celular, el texto de la cuenta y el idioma)
  const vis = (e) => e.offsetWidth > 1 && e.offsetHeight > 1 && !e.closest('.oc') && getComputedStyle(e).visibility !== 'hidden';
  const nom = (e) => (e.dataset.rb || e.id || (e.className.baseVal === undefined ? e.className : e.className.baseVal) || e.tagName);
  // (lo que se toca: el botón y, si tiene, su pseudo-elemento invisible —::before— que se estira hacia los huecos; lo que se
  // ve: la placa —en las opciones, .clCuerpo—. En una pantalla sin girar, además, se prueba tocando: elementFromPoint a 1,5 px
  // de los bordes de lo que se toca —el navegador redondea el punto y los bordes— tiene que dar el mismo botón)
  const ext = (e) => { const c = getComputedStyle(e, '::before'); if (c.content === 'none' || c.position !== 'absolute') return [0, 0]; return [Math.max(0, -parseFloat(c.top) || 0), Math.max(0, -parseFloat(c.bottom) || 0)]; };
  const toc = [...H0.querySelectorAll('button, input')].filter(vis).filter((e) => !e.parentElement.closest('button')).map((e) => {
    const r = rr(e), duen = e.tagName === 'INPUT' ? e.closest('.clChip') : e, [a, z] = ext(duen), dr = rr(duen), v = e.classList.contains('clIt') ? rr(e.querySelector('.clCuerpo')) : r;
    let toca = null;
    if (!rot) { const q = e.getBoundingClientRect(), x = q.left + Math.min(q.width / 2, 30), y0 = dr.y0 - a + 1.5, y1 = dr.y1 + z - 1.5, de = (y) => { const h = document.elementFromPoint(x, y); return !!h && (h === e || h === duen || duen.contains(h)); }; toca = de(y0) && de(y1) && de((y0 + y1) / 2); }
    return { k: nom(e), ...r, t0: Math.min(r.y0, dr.y0 - a), t1: Math.max(r.y1, dr.y1 + z), vh: v.y1 - v.y0, toca, op: e.classList.contains('clIt') };
  });
  const txt = [];
  for (const e of H0.querySelectorAll('*')) {
    if (!vis(e)) continue;
    const t = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() || (e.tagName === 'INPUT' ? e.value : ''); if (!t) continue;
    let corta = false; for (let c = e, i = 0; i < 3 && c && c !== H0; i++, c = c.parentElement) { const cc = getComputedStyle(c);
      if (/hidden|clip/.test(cc.overflowX) && c.scrollWidth > c.clientWidth + 1) corta = true; if (/hidden|clip/.test(cc.overflowY) && c.scrollHeight > c.clientHeight + 2) corta = true; }
    const bt = e.closest('button, .clChip, .clVer'), R0 = rr(e), RB0 = bt && bt !== e ? rr(bt) : null;
    if (RB0 && (R0.x0 < RB0.x0 - 1.5 || R0.x1 > RB0.x1 + 1.5 || R0.y0 < RB0.y0 - 1.5 || R0.y1 > RB0.y1 + 1.5)) corta = true;
    if (e.tagName === 'INPUT' && e.scrollWidth > e.clientWidth + 1) corta = true;
    txt.push({ k: nom(e), t: t.slice(0, 30), f: parseFloat(getComputedStyle(e).fontSize), corta, ...R0 });
  }
  // (el logo, sin su borde de sombra transparente —9 % arriba y abajo, 2,5 % a los costados—: lo que se ve)
  const lgr = rr(CL.logo), lgh = lgr.y1 - lgr.y0, lgw = lgr.x1 - lgr.x0;
  const bloques = { logo: { x0: lgr.x0 + lgw * 0.025, y0: lgr.y0 + lgh * 0.09, x1: lgr.x1 - lgw * 0.025, y1: lgr.y1 - lgh * 0.09 }, lista: rr(CL.lista), abajo: rr(CL.abajo), ver: rr(CL.verG), grieta: rr(CL.arriba) };
  const its = [...CL.lista.querySelectorAll('.clIt')].map((e) => ({ k: e.dataset.k, ...rr(e) }));
  return { W, H, rot, rtl: RB.el.dir === 'rtl', ins: CL.ins, modo: CL.modo, toc, txt, bloques, its };
})()`;
// (o: { op: alto mínimo para tocar las opciones —44, o lo del compromiso en el celular apaisado—, vis: alto mínimo visible })
function revisar(M, ins = 0, o = {}) {
  const pr = [], pisa = (a, b2, m = 0) => Math.min(a.x1, b2.x1) - Math.max(a.x0, b2.x0) > 0.5 - m && Math.min(a.y1, b2.y1) - Math.max(a.y0, b2.y0) > 0.5 - m;
  const tq = (e) => ({ x0: e.x0, x1: e.x1, y0: e.t0, y1: e.t1 });
  for (const e of M.toc) {
    const w = e.x1 - e.x0, h = e.t1 - e.t0, min = e.op ? (o.op || 43.5) : 43.5;
    if (Math.min(w, h) < min) pr.push(`${e.k} chico ${Math.round(w)}×${Math.round(h)} (se ve ${Math.round(e.vh)})`);
    if (e.op && o.vis && e.vh < o.vis) pr.push(`${e.k}: se ve de ${e.vh.toFixed(1)} px`);
    if (e.toca === false) pr.push(`${e.k}: tocando en el borde de lo que se toca no lo toma`);
    if (e.x0 < ins - 0.5 || e.t0 < -0.5 || e.x1 > M.W + 0.5 || e.t1 > M.H + 0.5) pr.push(`${e.k} afuera [${[e.x0, e.t0, e.x1, e.t1].map(Math.round)}]`);
  }
  // (lo que se toca de dos vecinas se junta justo en el medio del hueco: con el juego girado las medidas son de px enteros, 1 px de tolerancia)
  for (let i = 0; i < M.toc.length; i++) for (let j = i + 1; j < M.toc.length; j++) if (pisa(tq(M.toc[i]), tq(M.toc[j]), M.rot ? -1 : 0)) pr.push(`${M.toc[i].k} × ${M.toc[j].k}`);
  // (los bloques —el logo, la lista, la barra de abajo, la versión y La grieta— no se pisan, con 6 px de aire)
  const K = Object.keys(M.bloques); for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) if (pisa(M.bloques[K[i]], M.bloques[K[j]], 6)) pr.push(`bloque ${K[i]} × ${K[j]}`);
  for (const k of K) { const q = M.bloques[k]; if (q.x0 < ins - 0.5 || q.y0 < -0.5 || q.x1 > M.W + 0.5 || q.y1 > M.H + 0.5) pr.push(`bloque ${k} afuera`); }
  for (const t of M.txt) { if (t.f < 13.95) pr.push(`letra ${t.f}px «${t.t}»`); if (t.corta) pr.push(`cortado «${t.t}» (${t.k})`); }
  if (M.its.length !== 8) pr.push(`${M.its.length} opciones`);
  return pr;
}
// el contraste medido en la imagen: se esconde el texto, se saca la foto y, debajo de cada texto, el 5 % de los puntos que
// menos contrastan con su color tiene que dar ≥ 4,5
const TEXTOS = `(() => { const out = [];
  for (const e of CL.el.querySelectorAll('*')) { if (!(e.offsetWidth > 1 && e.offsetHeight > 1) || e.closest('.oc') || getComputedStyle(e).visibility === 'hidden') continue;
    const t = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() || (e.tagName === 'INPUT' ? e.value : ''); if (!t) continue;
    const q = e.getBoundingClientRect(), c = getComputedStyle(e).color.match(/[\\d.]+/g).map(Number);
    out.push({ t: t.slice(0, 24), x: q.left, y: q.top, w: e.tagName === 'INPUT' ? Math.min(q.width, t.length * parseFloat(getComputedStyle(e).fontSize) * 0.5) : q.width, h: q.height, c }); }
  return out; })()`;
async function contraste(p, ev) {
  const T = await ev(TEXTOS);
  await ev(`(() => { const s = document.createElement('style'); s.id = 'sinTexto'; s.textContent = '#rbInicio .clHome, #rbInicio .clHome *{color:transparent!important;-webkit-text-fill-color:transparent!important;caret-color:transparent!important}#rbInicio .clHome .gli, #rbInicio .clHome svg{visibility:hidden!important}'; document.head.appendChild(s); return 1; })()`);
  await p.waitForTimeout(150);
  const png = (await p.screenshot()).toString('base64');
  await ev(`document.getElementById('sinTexto').remove(), 1`);
  return p.evaluate(async ([png, T]) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + png; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const k = im.width / innerWidth, L = (r, gg, bb) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(bb); };
    return T.map((t) => {
      const x = Math.round((t.x + 1) * k), y = Math.round((t.y + 1) * k), w = Math.max(1, Math.round((t.w - 2) * k)), h = Math.max(1, Math.round((t.h - 2) * k));
      const d = g.getImageData(x, y, w, h).data, lt = L(t.c[0], t.c[1], t.c[2]), cs = [];
      for (let i = 0; i < d.length; i += 4) { const lb = L(d[i], d[i + 1], d[i + 2]); cs.push((Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05)); }
      cs.sort((a, b2) => a - b2); return { t: t.t, c: +cs[Math.floor(cs.length * 0.05)].toFixed(2) };
    });
  }, [png, T]);
}
const PANT = [['celu_dueño_873x402', 873, 402, true, 40], ['celu_915x412', 915, 412, true, 40], ['celu_chico_640x360', 640, 360, true, 0], ['celu_800x368', 800, 368, true, 0],
  ['celu_parado_402x873', 402, 873, true, 0], ['tablet_1180x820', 1180, 820, true, 0], ['compu_1280x720', 1280, 720, false, 0], ['compu_1920x1080', 1920, 1080, false, 0]];

// ======================= 1. fidelidad con la 3.3 =======================
if (U33 && corre(1)) {
  // (en cada pantalla, sin muesca —la 3.3 no la tenía en cuenta—: las opciones de la 3.3 y las de ahora, en px del juego)
  const OP33 = `(() => { const rot = typeof PANT !== 'undefined' && PANT.rot, root = RB.el;
    const rr = (e) => { if (!rot) { const q = e.getBoundingClientRect(); return [q.left, q.top, q.width, q.height]; } let x = 0, y = 0, n = e; while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return [x, y, e.offsetWidth, e.offsetHeight]; };
    return [...RB.el.querySelectorAll('.rbLista .rbIt')].map((e) => [e.dataset.rb, ...rr(e)]); })()`;
  // (de las de ahora, la placa que se ve —.clCuerpo—: lo que se toca es la barra entera, con el espacio de arriba y de abajo)
  const OPN = `(() => { const rot = typeof PANT !== 'undefined' && PANT.rot; return [...CL.lista.querySelectorAll('.clIt')].map((b) => { const e = b.querySelector('.clCuerpo'); if (!rot) { const q = e.getBoundingClientRect(); return [b.dataset.k, q.left, q.top, q.width, q.height]; } const r = depRect(e); return [b.dataset.k, r.x, r.y, r.w, r.h]; }); })()`;
  const grupos = (L) => { const g = [[L[0][0]]]; for (let i = 1; i < L.length; i++) { const d = L[i][2] - (L[i - 1][2] + L[i - 1][4]), d0 = L[1][2] - (L[0][2] + L[0][4]); if (d > d0 + 2) g.push([]); g[g.length - 1].push(L[i][0]); } return g.map((x) => x.join(',')).join(' | '); };
  const filas = [];
  for (const [nom, w, h, movil] of PANT) {
    const A = await abrir('fid33 ' + nom, w, h, movil, { url: U33, espera: 1800 }); const a = await A.ev(OP33); await A.ctx.close();
    const B = await abrir('fid ' + nom, w, h, movil); await clListo(B.p); const n = await B.ev(OPN); const modo = await B.ev('CL.modo');
    if (nom === 'celu_dueño_873x402') { await B.ev(FONDO(0)); await B.p.waitForTimeout(300); await B.p.screenshot({ path: D + 'fidelidad_ahora_873x402.png' }); }
    await B.ctx.close();
    const orden = a.map((x) => x[0]).join(',') === n.map((x) => x[0]).join(','), dx = Math.max(...n.map((x, i) => Math.abs(x[1] - a[i][1]))), g33 = grupos(a), gn = grupos(n);
    filas.push({ nom, modo, orden, grupos: g33 === gn, dxMax: +dx.toFixed(1), col33: +a[0][1].toFixed(1), col: +n[0][1].toFixed(1), y33: a.map((x) => Math.round(x[2])), y: n.map((x) => Math.round(x[2])), alto33: +a[0][4].toFixed(1), alto: +n[0][4].toFixed(1) });
  }
  for (const f of filas) console.log('   ', f.nom, f.modo, 'columna', f.col33, '→', f.col, '(±' + f.dxMax + ')', 'alto de cada opción', f.alto33, '→', f.alto, 'y', f.y33.join('/'), '→', f.y.join('/'));
  caso('1. fidelidad: las 8 opciones en el orden y los grupos de la 3.3, en su misma columna (±8 px), en las 8 pantallas', filas.every((f) => f.orden && f.grupos && f.dxMax <= 8), filas.map((f) => ({ nom: f.nom, orden: f.orden, grupos: f.grupos, dx: f.dxMax })));
}

// ======================= 2. pantallas =======================
const TAMANOS = {}, COMPROMISO = { op: 30, vis: 28 };
if (corre(2)) {
  for (const [nom, w, h, movil, ins] of PANT) {
    const A = await abrir(nom, w, h, movil, { ins }); await clListo(A.p);
    await A.ev(FONDO(0)); await A.p.waitForTimeout(250);
    // (en el celular apaisado, «apretada», el compromiso pedido para que el logo quede arriba de la lista como en la 3.3: las
    // opciones no llegan a 44 px; se piden 30 para tocar y 28 a la vista —más que la 3.3, de 24,6 a 28,1 px en estas pantallas,
    // donde lo que se veía era lo que se tocaba— y los números quedan anotados; lo demás, 44)
    const M = await A.ev(MEDIR), comp = M.modo === 'apretada', pr = revisar(M, ins, comp ? COMPROMISO : {});
    const ops = M.toc.filter((e) => e.op), chips = M.toc.filter((e) => !e.op), tam = { opVisible: +Math.min(...ops.map((e) => e.vh)).toFixed(1), opTocable: +Math.min(...ops.map((e) => e.t1 - e.t0)).toFixed(1), opTocableMax: +Math.max(...ops.map((e) => e.t1 - e.t0)).toFixed(1), resto: +Math.min(...chips.map((e) => Math.min(e.x1 - e.x0, e.t1 - e.t0))).toFixed(1) };
    TAMANOS[nom] = tam;
    await A.p.screenshot({ path: D + 'pantalla_' + nom + '.png' });
    // (el contraste sobre las 6 escenas: lo peor de cada texto)
    const peor = {}; let nF = await A.ev('FONDOS_RB.length') || 1;
    for (let i = 0; i < nF; i++) { await A.ev(FONDO(i)); await A.p.waitForTimeout(220); for (const c of await contraste(A.p, A.ev)) if (!(c.t in peor) || c.c < peor[c.t]) peor[c.t] = c.c; }
    const malos = Object.entries(peor).filter(([, c]) => c < 4.5), min = Math.min(...Object.values(peor));
    caso(`2. ${nom} (${M.modo}): ${M.toc.length} tocables ${comp ? `—las opciones ${tam.opVisible} px a la vista y ${tam.opTocable}–${tam.opTocableMax} para tocar (compromiso, < 44), lo demás ≥ 44—` : '≥ 44 px'}, adentro${ins ? ' (y de la muesca)' : ''}, sin pisarse; nada cortado; letra ≥ 14 px; contraste ≥ 4,5 sobre las ${nF} escenas (el peor ${min.toFixed(2)})`,
      !pr.length && !malos.length, { pr: pr.slice(0, 10), malos, tam });
    await A.ctx.close();
  }
  // (el pedido «lo que se toca, 44 px o más»: dónde se cumple y dónde quedó el compromiso, con los números)
  const no44 = Object.entries(TAMANOS).filter(([, t]) => t.opTocable < 43.5);
  console.log('    44 px para tocar las opciones: ' + (no44.length ? 'no en ' + no44.map(([k, t]) => `${k} (${t.opVisible} a la vista, ${t.opTocable}–${t.opTocableMax} para tocar)`).join(', ') : 'en todas') + '; las placas de abajo: ' + Object.entries(TAMANOS).map(([k, t]) => `${k} ${t.resto}`).join(', '));
}

// ======================= 3. idiomas =======================
if (corre(3)) {
  const mal = [];
  for (const [w, h, ins] of [[873, 402, 40], [640, 360, 0]]) for (const lang of IDIOMAS) {
    const A = await abrir(`${lang} ${w}x${h}`, w, h, true, { lang, ins, espera: 1600 }); await clListo(A.p);
    const M = await A.ev(MEDIR), pr = revisar(M, ins, M.modo === 'apretada' ? COMPROMISO : {});
    if (lang === 'ar') {
      // (espejado: la lista contra el borde derecho, la versión del lado izquierdo, el logo a la derecha de la pantalla en la pila)
      const L = M.bloques.lista, V = M.bloques.ver;
      if (!M.rtl || L.x1 < M.W * 0.6 || L.x0 < M.W * 0.25 || V.x0 > M.W * 0.6) pr.push(`árabe sin espejar (lista ${Math.round(L.x0)}-${Math.round(L.x1)}, versión ${Math.round(V.x0)})`);
    }
    if (pr.length) mal.push({ lang, w, pr: pr.slice(0, 6) });
    if ((lang === 'de' || lang === 'ru' || lang === 'ar') && w === 873) await A.p.screenshot({ path: D + `idioma_${lang}_${w}x${h}.png` });
    await A.ctx.close();
  }
  caso('3. los 14 idiomas en 873×402 (con muesca) y 640×360: nada se sale, se corta ni se pisa, lo tocable ≥ 44 px; el árabe, espejado', !mal.length, mal.slice(0, 8));
}

// ======================= 4. animaciones =======================
// (lo que corre adentro del menú: animaciones de CSS y transiciones; aparte, el fondo de la 3.3 —.rbBg—)
const CORREN = `(() => { const A = document.getAnimations().filter((a) => a.playState === 'running'), en = (a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#rbInicio');
  const nom = (a) => (a.animationName || a.transitionProperty || '?') + '@' + String((a.effect.target.className && a.effect.target.className.baseVal !== undefined ? a.effect.target.className.baseVal : a.effect.target.className) || a.effect.target.tagName).slice(0, 24);
  return { menu: A.filter((a) => en(a) && a.effect.target.closest('.clHome')).map(nom), fondo: A.filter((a) => en(a) && a.effect.target.classList.contains('rbBg')).map(nom), timing: A.filter((a) => en(a) && a.effect.target.classList.contains('rbBg')).map((a) => getComputedStyle(a.effect.target).animationTimingFunction) }; })()`;
async function cuadrosGPU(url, quien, o = {}) {
  const bb = await chromium.launch({ executablePath: CHROME, args: ARGS });
  const ctx = await bb.newContext({ viewport: { width: 873, height: 402 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: o.reducido ? 'reduce' : 'no-preference' });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  await ctx.addInitScript((P) => { try { localStorage.setItem('jx_prefs', JSON.stringify(P)); } catch (e) {} }, PREFS0('es', o.prefs));
  const p = await ctx.newPage(); p.on('pageerror', (e) => { if (quien === 'ahora') errJS.push('cuadros: ' + e.message.slice(0, 200)); });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await p.goto(url + '?test' + (o.q || '')); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
  await ev(`window.__menu30 = true; 1`);
  if (quien === 'ahora') await clListo(p);
  await p.waitForTimeout(3000);   // (3 s después de la entrada)
  const traza = `${tmpdir()}/jx_cl_${process.pid}_${Date.now()}.json`;
  await bb.startTracing(p, { path: traza, categories: ['viz'] });
  const t0 = Date.now(); await p.waitForTimeout(o.ms || 9000); const s = (Date.now() - t0) / 1000;
  await bb.stopTracing();
  const E = JSON.parse(readFileSync(traza, 'utf8')); const L = E.traceEvents || E; try { unlinkSync(traza); } catch (e) {}
  const comp = L.filter((e) => e.name === 'Display::DrawAndSwap' && (e.ph === 'X' || e.ph === 'B')).length;
  const corren = quien === 'ahora' ? await ev(CORREN) : null;
  await bb.close();
  return { porSeg: +(comp / s).toFixed(2), corren };
}
if (corre(4)) {
  // a. la entrada termina: nada corre en el menú a los 3 s de la entrada; el fondo es el video de la escena (antes, la foto que
  // se agrandaba de a saltos: con el video la capa queda quieta y lo que se mueve es el video)
  const A = await abrir('animaciones', 873, 402, true, { ins: 40 }); await clListo(A.p); await A.p.waitForTimeout(3000);
  const c = await A.ev(CORREN), entradas = await A.ev('CL.entradas');
  // (en 3 s: los saltos del agrandado —ninguno— y cuánto avanzó el video; sin que cambie la escena mientras se mide)
  const K = '[CL.kenPasos || 0, RB.el.querySelector(".rbBg.on").style.transform, (RB.el.querySelector(".rbBg.on video.ve") || { currentTime: -9 }).currentTime]';
  await A.ev('(clearInterval(RB.reloj), RB.reloj = 1, typeof FV !== "undefined" && clearTimeout(FV.tPasar), 1)'); const k0 = await A.ev(K); await A.p.waitForTimeout(3000); const k1 = await A.ev(K);
  const saltos = (k1[0] - k0[0]) / 3, avanzo = k1[2] - k0[2] + (k1[2] < k0[2] ? 10 : 0);
  caso(`4a. la entrada termina: a los 3 s nada corre en el menú (${c.menu.length}) ni en el fondo; el fondo es el video (avanzó ${avanzo.toFixed(2)} s en 3 s) y la capa no se agranda (${saltos.toFixed(1)} saltos por segundo)`, entradas >= 1 && !c.menu.length && !c.fondo.length && saltos === 0 && k0[1] === k1[1] && k0[2] >= 0 && avanzo >= 2.5 && avanzo <= 3.5, { c, saltos, avanzo, k0, k1 });
  // el barrido y el golpe terminan (el fondo quieto: sin el cambio de escena, que también trae brasas)
  // (sin el glitch solo del logo —cada 11 a 19 s—: si cae en la ventana de 0,9 s se mezcla con el barrido; el glitch se prueba a mano)
  await A.ev(FONDO(0)); await A.ev('clearTimeout(CL.tGl); 1'); await A.p.waitForTimeout(3000);
  await A.ev(`clElegir('crear'); CL.lista.querySelector('[data-k=crear]').classList.add('clGolpe'); 1`); await A.p.waitForTimeout(100);
  const c1 = await A.ev(CORREN); await A.p.waitForTimeout(900); const c2 = await A.ev(CORREN);
  await A.ev(`clGlitch(); 1`); await A.p.waitForTimeout(80); const g1 = await A.ev(CORREN); await A.p.waitForTimeout(700); const g2 = await A.ev(CORREN);
  await A.ev(`clBrasas(9); 1`); await A.p.waitForTimeout(200); const b1 = await A.ev(`CL.brasas.childElementCount`); await A.p.waitForTimeout(3000); const b2 = await A.ev(`CL.brasas.childElementCount`);
  // (las brasas aparte: también suben solas cuando cambia la escena de fondo, cada 9 s)
  const sinBr = (x) => x.menu.filter((n) => !/clBrasa/.test(n));
  caso('4b. el barrido, el golpe, el glitch y las brasas terminan solos (y las brasas se borran de la página)', c1.menu.some((x) => /clBarre/.test(x)) && c1.menu.some((x) => /clGolpe/.test(x)) && !sinBr(c2).length && g1.menu.some((x) => /clGl/.test(x)) && !sinBr(g2).length && b1 > 0 && b2 === 0,
    { barrido: c1.menu, despues: c2.menu, glitch: g1.menu, despuesGlitch: g2.menu, brasas: [b1, b2] });
  await A.ctx.close();
  // c. con «menos movimiento» y con Gráficos Patata: nada se mueve; con Bajos, sin el glitch ni las brasas
  for (const [nom, o] of [['menos movimiento', { reducido: true }], ['Gráficos Patata', { q: '&gfx=patata' }], ['Gráficos bajos', { q: '&gfx=bajo' }]]) {
    const B = await abrir('quieto ' + nom, 873, 402, true, o); await clListo(B.p, 20000);
    const q0 = await B.ev(CORREN), nivel = await B.ev('CL.nivel'); await B.ev(`clElegir('crear'); clBrasas(9); 1`); await B.p.waitForTimeout(80); const q1 = await B.ev(CORREN);
    const glitch = await B.ev('!!CL.tGl'), brasas = await B.ev('CL.brasas.childElementCount');
    const mueve = (x) => [...x.menu, ...x.fondo].filter((n) => !/^opacity@/.test(n));
    const kq = await B.ev('CL.kenPasos || 0'); await B.p.waitForTimeout(1500); const kenPorSeg = ((await B.ev('CL.kenPasos || 0')) - kq) / 1.5;
    const ok = nom === 'Gráficos bajos' ? nivel === 'bajo' && !brasas && !glitch && kenPorSeg > 1 && kenPorSeg <= 2.5 : nivel === 'quieto' && !mueve(q0).length && !mueve(q1).length && !brasas && !glitch && kenPorSeg === 0 && (await B.ev('CL.entradas')) === 0;
    caso(`4c. ${nom}: ${nom === 'Gráficos bajos' ? 'sin el glitch del logo ni las brasas, el fondo a 2 saltos por segundo' : 'nada se mueve (ni la entrada, ni el barrido, ni el glitch, ni las brasas, ni el fondo)'}`, ok, { nivel, alAbrir: q0, alElegir: q1, glitch, brasas, kenPorSeg });
    await B.ctx.close();
  }
  // d. los cuadros que compone la placa por segundo con el menú quieto (3 s después de la entrada), contra la 3.3
  if (U33) {
    const n = +(process.env.CORRIDAS || 2), R = { ahora: [], '3.3': [] };
    for (let i = 0; i < n; i++) for (const [k, u] of i % 2 ? [['3.3', U33], ['ahora', HTML]] : [['ahora', HTML], ['3.3', U33]]) R[k].push(await cuadrosGPU(u, k));
    const pr = (k) => +(R[k].reduce((a, x) => a + x.porSeg, 0) / R[k].length).toFixed(2);
    const red = await cuadrosGPU(HTML, 'ahora', { reducido: true });
    caso(`4d. cuadros que compone la placa por segundo, el menú quieto (873×402 a 2×, 9 s, promedio de ${n}): ${pr('ahora')} contra ${pr('3.3')} de la 3.3; con «menos movimiento», ${red.porSeg}`, pr('ahora') <= pr('3.3'), { ahora: R.ahora.map((x) => x.porSeg), v33: R['3.3'].map((x) => x.porSeg), reducido: red.porSeg });
  }
}

// ======================= 5. rendimiento =======================
if ((U33 || U35) && corre(5)) {
  const VERS = [['ahora', HTML], ['3.3', U33], ['3.5', U35]].filter((v) => v[1]);
  async function medir(url, gfx, quien) {
    const bb = await chromium.launch({ executablePath: CHROME, args: ARGS });
    const ctx = await bb.newContext({ viewport: { width: 873, height: 402 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
    await ctx.addInitScript((P) => { try { localStorage.setItem('jx_prefs', JSON.stringify(P)); } catch (e) {} }, PREFS0('es', { dpVisto: { emotes: 999, pj: 999, mods: 999, ws: 9 }, dpAyuda: 1 }));
    const p = await ctx.newPage(); p.on('pageerror', (e) => { if (quien === 'ahora') errJS.push('rendimiento: ' + e.message.slice(0, 200)); });
    const ev = (s) => p.evaluate((x) => window.__ev(x), s);
    await p.goto(url + '?test&gfx=' + gfx); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
    await ev(`window.__menu30 = true; 1`);
    if (quien === 'ahora') await clListo(p, 60000);
    if (quien === '3.5') await esperar(p, `typeof DEP !== 'undefined' && DEP.listo && !DEP.anim && PAUSA.on`, 60000);
    await p.waitForTimeout(3000);
    const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable'); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage');
    await p.waitForTimeout(2000);
    const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    const m0 = await met(), t0 = Date.now();
    await p.waitForTimeout(6000);
    const m1 = await met(), t1 = Date.now();
    await cdp.send('HeapProfiler.collectGarbage'); const m2 = await met();
    await bb.close();
    const s = (t1 - t0) / 1000;
    return { jsMsPorSeg: (m1.ScriptDuration - m0.ScriptDuration) * 1000 / s, hiloMsPorSeg: (m1.TaskDuration - m0.TaskDuration) * 1000 / s, heapMB: m2.JSHeapUsedSize / 1048576 };
  }
  async function tocable(url, gfx) {
    const bb = await chromium.launch({ executablePath: CHROME, args: ARGS });
    const ctx = await bb.newContext({ viewport: { width: 873, height: 402 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
    await ctx.addInitScript((P) => { try { localStorage.setItem('jx_prefs', JSON.stringify(P)); } catch (e) {} }, PREFS0('es', { dpVisto: { emotes: 999, pj: 999, mods: 999, ws: 9 }, dpAyuda: 1 }));
    await ctx.addInitScript(() => {
      window.__toc = null;
      const mira = () => {
        const j = document.querySelector('#rbInicio .clIt.clPri, #rbInicio .dpJugar, #rbInicio .rbIt.rbPri'), c = document.getElementById('carga'), ri = document.getElementById('rbInicio');
        if (j && j.offsetWidth > 0 && ri && !ri.classList.contains('oc') && (!c || c.classList.contains('oc') || c.classList.contains('salir'))) { setTimeout(() => { window.__toc = performance.now(); }, 0); return; }
        requestAnimationFrame(mira);
      };
      requestAnimationFrame(mira);
    });
    const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.goto(url + '?test&perezoso&gfx=' + gfx);
    await p.waitForFunction(() => window.__toc, null, { timeout: 300000 });
    const r = await p.evaluate(() => window.__toc); await bb.close(); return r;
  }
  const K = ['jsMsPorSeg', 'hiloMsPorSeg', 'heapMB'], N = +(process.env.CORRIDAS || 2);
  for (const gfx of ['bajo', 'medio', 'alto']) {
    const R = {}, T0 = {}; for (const [k] of VERS) { R[k] = []; T0[k] = []; }
    for (let i = 0; i < N; i++) { const orden = i % 2 ? VERS.slice().reverse() : VERS; for (const [k, u] of orden) { R[k].push(await medir(u, gfx, k)); T0[k].push(await tocable(u, gfx)); } }
    const P = {}; for (const c of K) { P[c] = {}; for (const [k] of VERS) P[c][k] = +(R[k].reduce((a, x) => a + x[c], 0) / N).toFixed(2); }
    P.tocableMs = {}; for (const [k] of VERS) P.tocableMs[k] = Math.round(T0[k].reduce((a, x) => a + x, 0) / N);
    console.log(`rendimiento (Gráficos ${gfx}, procesador 4× más lento, 873×402 a 2×, el menú quieto, promedio de ${N} corridas alternadas):\n` + [...K, 'tocableMs'].map((c) => `  ${c.padEnd(13)} ` + VERS.map(([k]) => `${k} ${String(P[c][k]).padStart(8)}`).join('   ')).join('\n'));
    if (U33) {
      const malos = [...K, 'tocableMs'].filter((c) => P[c].ahora > P[c]['3.3'] * 1.1 && !(c === 'heapMB' && P[c].ahora - P[c]['3.3'] < 0.5));
      caso(`5. rendimiento con Gráficos ${gfx}: el clásico a lo sumo un 10 % arriba de la 3.3 en JS, hilo principal, heap y tiempo hasta poder tocar`, !malos.length, { malos, ...P });
    }
  }
}

// ======================= 6. el selector =======================
// (los oyentes de la ventana, por tipo, desde las herramientas del navegador)
async function oyentes(ctx, p) {
  const cdp = await ctx.newCDPSession(p); await cdp.send('DOMDebugger.enable').catch(() => {});
  const { result } = await cdp.send('Runtime.evaluate', { expression: 'window' }), r = {};
  for (const l of (await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId })).listeners) r[l.type] = (r[l.type] || 0) + 1;
  const d = await cdp.send('Runtime.evaluate', { expression: 'document' }); for (const l of (await cdp.send('DOMDebugger.getEventListeners', { objectId: d.result.objectId })).listeners) r['doc:' + l.type] = (r['doc:' + l.type] || 0) + 1;
  await cdp.detach(); return Object.fromEntries(Object.entries(r).sort());
}
async function heap(ctx, p) { const cdp = await ctx.newCDPSession(p); await cdp.send('HeapProfiler.enable'); for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage'); const { usedSize } = await cdp.send('Runtime.getHeapUsage'); await cdp.detach(); return usedSize / 1048576; }
const ESTADO = `({ home: RB.home, cl: document.querySelectorAll('.clHome, .clIt, .clChip').length, dp: document.querySelectorAll('.dpHome, .dpCaja, .dpHoja, .dpChapa').length, rb: RB.el.querySelectorAll('*:not(.clBrasas *):not(.rbVid)').length, brasas: document.querySelectorAll('.clBrasas *').length,
  objs: OBJS.length, pers: PERS.length, mundo: MUNDO.nombre, enMenu: !!EVT.enMenu, pausa: PAUSA.on, clases: RB.el.className, depListo: !!DEP.listo, rbp: RBP.alListo.length, lobby: !!MENU.lobby })`;
// la foto de un menú para comparar: el fondo quieto y lo animado terminado
async function foto(A, cual) {
  // (en el depósito, la capa de la página —las chapas, los botones—: la escena 3D se compara por el lugar de cada caja y la
  // cámara; el cielo, las nubes y la grieta se mueven con el reloj y una foto de ahora nunca es igual a una de antes)
  if (cual === 'deposito') { await A.ev(`R.cv.style.visibility = 'hidden', 1`); await A.p.mouse.move(2, 2); await A.p.waitForTimeout(400); const f = (await A.p.screenshot()).toString('base64'); await A.ev(`R.cv.style.visibility = '', 1`); return f; }
  if (cual === 'clasico') { await A.ev(FONDO(0)); await A.ev(`(() => { for (const a of document.getAnimations()) { const e = a.effect && a.effect.target; if (e && e.closest && e.closest('.clHome')) a.finish(); } clElegir(null); if (document.activeElement) document.activeElement.blur(); return 1; })()`); }
  await A.p.mouse.move(2, 2); await A.p.waitForTimeout(400);
  return (await A.p.screenshot()).toString('base64');
}
async function diferencia(p, a, b2) {
  return p.evaluate(async ([a, b2]) => {
    const leer = async (s) => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    const A1 = await leer(a), A2 = await leer(b2); let n = 0, suma = 0; for (let i = 0; i < A1.length; i += 4) { const d = Math.max(Math.abs(A1[i] - A2[i]), Math.abs(A1[i + 1] - A2[i + 1]), Math.abs(A1[i + 2] - A2[i + 2])); suma += d; if (d > 24) n++; }
    return { distintos: +(100 * n / (A1.length / 4)).toFixed(3), medio: +(suma / (A1.length / 4)).toFixed(3) };
  }, [a, b2]);
}
const POS_DP = `JSON.stringify(Object.assign(Object.fromEntries(DP_K.map((k) => { const e = DEP.el.querySelector('.dpC_' + k), q = e.getBoundingClientRect(); return [k, [q.left, q.top, q.width, q.height].map((v) => +v.toFixed(1))]; })), { cam: [DEP.cam.pos.x - DEP.O.x, DEP.cam.pos.y, DEP.cam.pos.z - DEP.O.z, DEP.cam.fov].map((v) => +v.toFixed(3)), cajas3d: DP_K.map((k) => [DEP.cajas[k].o.b.pos.x - DEP.O.x, DEP.cajas[k].o.b.pos.y, DEP.cajas[k].o.b.pos.z - DEP.O.z].map((v) => +v.toFixed(3))) }))`;
if (corre(6)) {
  const dpListo = (p) => esperar(p, `typeof DEP !== 'undefined' && DEP.listo && !DEP.anim && !DEP.tenida && PAUSA.on`, 90000);
  // el depósito recién arrancado (con su elección guardada), para comparar
  const F = await abrir('depósito de cero', 873, 402, true, { prefs: { menuInicio: 'deposito', dpVisto: { emotes: 999, pj: 999, mods: 999, ws: 9 }, dpAyuda: 1 } });
  await dpListo(F.p); await F.ev(`DEP.franjaPrueba = 'tarde'; depHora(); dibujoDespertar(); 1`); await F.p.waitForTimeout(900);
  const dpPos0 = await F.ev(POS_DP), dpFoto0 = await foto(F, 'deposito'), dpHome0 = await F.ev(`RB.home`); await F.ctx.close();
  // el clásico recién arrancado, y 3 vueltas tocando de verdad: Opciones → Menú de inicio: Depósito → Listo; en el depósito,
  // Ajustes → Menú clásico
  const A = await abrir('selector', 873, 402, true, { prefs: { dpVisto: { emotes: 999, pj: 999, mods: 999, ws: 9 }, dpAyuda: 1 } }); await clListo(A.p);
  await A.ev(`DEP.franjaPrueba = 'tarde'; 1`);
  const e0 = await A.ev(ESTADO), o0 = await oyentes(A.ctx, A.p), h0 = await heap(A.ctx, A.p), f0 = await foto(A, 'clasico');
  const vueltas = [], err0 = A.mios.length;
  for (let i = 0; i < 3; i++) {
    await A.p.tap('.clIt[data-k=opciones]'); await A.p.waitForTimeout(500);
    const hay = await A.ev(`!!document.querySelector('#ajustes:not(.oc) [data-mi=deposito]')`);
    await A.p.tap('[data-mi=deposito]'); await A.p.waitForTimeout(300); await A.p.tap('#aOk'); const listoD = await dpListo(A.p);
    await A.ev(`DEP.franjaPrueba = 'tarde'; depHora(); dibujoDespertar(); 1`); await A.p.waitForTimeout(900);
    const eD = await A.ev(ESTADO), posD = await A.ev(POS_DP), fD = await foto(A, 'deposito'), dD = await diferencia(A.p, dpFoto0, fD);
    await A.p.tap('.dpAj'); await A.p.waitForTimeout(300); await A.p.tap('.dpHojaAj [data-rb="menuIni:clasico"]'); const listoC = await clListo(A.p);
    await A.p.waitForTimeout(600);
    const eC = await A.ev(ESTADO), oC = await oyentes(A.ctx, A.p), fC = await foto(A, 'clasico'), dC = await diferencia(A.p, f0, fC);
    vueltas.push({ hay, listoD, listoC, eD, eC, posIgual: posD === dpPos0, dD, dC, oyentesIguales: JSON.stringify(oC) === JSON.stringify(o0), oC });
  }
  const h3 = await heap(A.ctx, A.p);
  if (D) await A.p.screenshot({ path: D + 'selector_vuelta3.png' });
  const malV = vueltas.map((v, i) => {
    const m = [];
    if (!v.hay) m.push('sin el selector en Ajustes'); if (!v.listoD) m.push('el depósito no quedó listo'); if (!v.listoC) m.push('el clásico no volvió');
    if (v.eD.home !== 'deposito' || v.eD.cl || !v.eD.depListo || v.eD.objs !== 8 || v.eD.pers !== 1 || v.eD.mundo !== 'FlatGrass' || !v.eD.pausa) m.push('depósito: ' + JSON.stringify(v.eD));
    if (v.eC.home !== 'clasico' || v.eC.dp || v.eC.objs || v.eC.pers || v.eC.mundo || v.eC.enMenu || !v.eC.pausa || v.eC.rb !== e0.rb || v.eC.cl !== e0.cl || v.eC.rbp !== e0.rbp || v.eC.clases !== e0.clases || v.eC.lobby) m.push('clásico: ' + JSON.stringify(v.eC) + ' (de cero ' + JSON.stringify(e0) + ')');
    if (!v.posIgual) m.push('las cajas en otro lugar'); if (v.dD.distintos > 1) m.push('el depósito se ve distinto ' + JSON.stringify(v.dD)); if (v.dC.distintos > 0.5) m.push('el clásico se ve distinto ' + JSON.stringify(v.dC));
    if (!v.oyentesIguales) m.push('oyentes ' + JSON.stringify(v.oC) + ' contra ' + JSON.stringify(o0));
    return m.length ? `vuelta ${i + 1}: ` + m.join('; ') : '';
  }).filter(Boolean);
  const errSel = A.mios.slice(err0);
  caso(`6a. el selector: clásico → depósito → clásico 3 veces tocando de verdad: sin errores, sin restos (${e0.rb} elementos en el menú, los mismos oyentes, sin cajas ni mapa), cada menú igual que recién arrancado`, !malV.length && !errSel.length && dpHome0 === 'deposito',
    { malV, errSel, diferencias: vueltas.map((v) => [v.dD.distintos, v.dC.distintos]) });
  caso(`6b. el heap no crece más de 5 MB en las 3 vueltas (${h0.toFixed(1)} → ${h3.toFixed(1)} MB)`, h3 - h0 <= 5, { h0, h3 });
  // la elección queda al recargar
  await A.p.reload(); await A.p.waitForFunction(() => window.__listo, null, { timeout: 240000 }); await A.p.waitForTimeout(1500);
  const r1 = await A.ev(`RB.home + ' ' + menuInicio()`);
  await A.ev(`menuInicioPoner('deposito'); 1`); await A.p.reload(); await A.p.waitForFunction(() => window.__listo, null, { timeout: 240000 }); await A.p.waitForTimeout(1500);
  const r2 = await A.ev(`RB.home + ' ' + menuInicio() + ' ' + !!document.querySelector('.dpHome') + ' ' + !document.querySelector('.clHome')`);
  caso('6c. la elección queda al recargar (el clásico; después el depósito)', r1 === 'clasico clasico' && r2 === 'deposito deposito true true', { r1, r2 });
  await A.ctx.close();
}

// ======================= 7. teclado y mando =======================
if (corre(7)) {
  const pad = `(() => { const P = { id: 'prueba', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }; window.__pad = P;
    navigator.getGamepads = () => [P]; window.__padApretar = (i, si) => { P.buttons[i] = { pressed: si, value: si ? 1 : 0 }; }; })()`;
  const A = await abrir('teclado', 1280, 720, false, { antes: pad }); await clListo(A.p);
  const foco = () => A.ev(`(document.activeElement && (document.activeElement.dataset.k || document.activeElement.dataset.rb || document.activeElement.id)) || null`);
  const pasos = [];
  await A.p.mouse.move(1100, 300);
  await A.p.keyboard.press('ArrowDown'); pasos.push(['↓', await foco()]);
  await A.p.keyboard.press('ArrowDown'); pasos.push(['↓', await foco()]);
  await A.p.keyboard.press('ArrowUp'); await A.p.keyboard.press('ArrowUp'); pasos.push(['↑↑', await foco()]);
  const amarilla = await A.ev(`CL.sel`);
  await A.p.keyboard.press('Tab'); pasos.push(['Tab', await foco()]);
  const tabJuego = await A.ev(`({ ui: UI.abierto || null, estado: JUEGO.estado, en: CL.el.contains(document.activeElement) })`);
  await A.p.keyboard.press('Shift+Tab'); pasos.push(['⇧Tab', await foco()]);
  await A.p.keyboard.press('ArrowDown'); pasos.push(['↓ (a la barra de abajo)', await foco(), await A.ev(`!!document.activeElement.closest('.clAbajo')`)]);
  await A.p.keyboard.press('ArrowUp'); for (let i = 0; i < 5; i++) await A.p.keyboard.press('ArrowUp'); pasos.push(['↑×6', await foco()]);
  await A.p.keyboard.press('Enter'); await A.p.waitForTimeout(600); const panel = await A.ev('RB.panel');
  await A.p.keyboard.press('Escape'); await A.p.waitForTimeout(600); const tras = await A.ev(`({ panel: RB.panel, ve: clVisible() })`);
  // el mando: la cruceta abajo (13), A (0) abre, B (1) vuelve
  await A.ev(`window.dispatchEvent(new Event('gamepadconnected')); document.activeElement && document.activeElement.blur(); 1`); await A.p.waitForTimeout(200);
  // (apretar y soltar, esperando que el lazo del mando vea cada cosa: con la máquina cargada un cuadro puede tardar)
  const ap = async (i) => { const k = { 13: 'abajo', 0: 'a', 1: 'b' }[i]; await A.ev(`__padApretar(${i}, true), 1`); await esperar(A.p, `CL.pad.ant.${k} === true`, 3000); await A.p.waitForTimeout(60); await A.ev(`__padApretar(${i}, false), 1`); await esperar(A.p, `CL.pad.ant.${k} === false`, 3000); await A.p.waitForTimeout(60); };
  await ap(13); const m1 = await foco(); await ap(13); const m2 = await foco(); await ap(0); await A.p.waitForTimeout(500); const mp = await A.ev('RB.panel'); await ap(1); await A.p.waitForTimeout(600); const mv = await A.ev(`({ panel: RB.panel, ve: clVisible() })`);
  const ok = pasos[0][1] === 'nueva' && pasos[1][1] === 'multi' && pasos[2][1] === 'salir' && amarilla === 'salir' && pasos[3][1] && !tabJuego.ui && tabJuego.en && pasos[4][1] === 'salir' && pasos[5][2] && pasos[6][1] === 'social'
    && panel === 'social' && !tras.panel && tras.ve && m1 === 'nueva' && m2 === 'multi' && mp === 'multi' && !mv.panel && mv.ve;
  caso('7. teclado y mando: ↓ a Empezar y a Multijugador, ↑ da la vuelta a Salir (amarilla), Tab y ⇧Tab quedan en el menú (el juego no lo toma), Enter abre y Esc vuelve; la cruceta, A abre y B vuelve', ok, { pasos, amarilla, tabJuego, panel, tras, mando: [m1, m2, mp, mv] });
  await A.ctx.close();
}

// ======================= 8. lo de la 3.4 y la 3.5 =======================
if (corre(8)) {
  // la cuenta de Google, al lado de tu nombre
  const G = await abrir('cuenta', 873, 402, true, { google: true, ins: 40 }); await clListo(G.p);
  await G.ev(`typeof cuCancelar === 'function' && cuCancelar(); 1`); await G.p.waitForTimeout(300);
  // (lo que se toca, con su ::before que se estira hacia el borde de abajo; probado tocando arriba y abajo)
  const cu = await G.ev(`(() => { const c = CL.abajo.querySelector('.clCuenta .cuChip'), n = CL.abajo.querySelector('.clNom'); if (!c) return null; const a = c.getBoundingClientRect(), b = n.getBoundingClientRect(), pb = getComputedStyle(c, '::before');
    const t0 = a.top + Math.min(0, parseFloat(pb.top) || 0), t1 = a.bottom - Math.min(0, parseFloat(pb.bottom) || 0), x = a.left + a.width / 2, de = (y) => { const h = document.elementFromPoint(x, y); return !!h && (h === c || c.contains(h)); };
    return { txt: c.textContent.trim(), w: a.width, h: +(t1 - t0).toFixed(1), seVe: +a.height.toFixed(1), toca: de(t0 + 1.5) && de(t1 - 1.5), junto: Math.abs(b.left - a.right) < 2 && Math.abs(a.top - b.top) < 2 }; })()`);
  await G.p.tap('.clCuenta .cuChip').catch(() => {}); await G.p.waitForTimeout(400); const dlg = await G.ev(`!!document.querySelector('#cuDlg:not(.oc)')`);
  await G.p.screenshot({ path: D + 'cuenta_clasico.png' });
  caso('8a. la cuenta de Google al lado de tu nombre («Iniciar sesión con Google»), de 44 px o más para tocar, y abre su cartel', !!cu && /Google/.test(cu.txt) && Math.min(cu.w, cu.h) >= 43.5 && cu.toca && cu.junto && dlg, { cu, dlg });
  await G.ctx.close();
  // Actualizar: en la app (JXNativo.buscarActualizacion) siempre; en la web, sólo si apareció el botón de codigo_web.mjs
  const N = await abrir('actualizar app', 873, 402, true, { antes: `window.JXNativo = { buscarActualizacion() { window.__busco = (window.__busco || 0) + 1; }, abrir() {}, salir() {} };` }); await clListo(N.p);
  const vNat = await N.ev(`!CL.verG.querySelector('.clAct').classList.contains('oc')`); await N.p.tap('.clAct').catch(() => {}); await N.p.waitForTimeout(300); const busco = await N.ev('window.__busco || 0');
  await N.ctx.close();
  const Wb = await abrir('actualizar web', 873, 402, true); await clListo(Wb.p);
  const antes = await Wb.ev(`!CL.verG.querySelector('.clAct').classList.contains('oc')`);
  await Wb.ev(`(() => { const b = document.createElement('button'); b.id = 'jxAct'; b.textContent = 'Actualizar'; b.onclick = () => { window.__web = 1; }; document.body.appendChild(b); return 1; })()`); await Wb.p.waitForTimeout(300);
  const despues = await Wb.ev(`({ ve: !CL.verG.querySelector('.clAct').classList.contains('oc'), globo: CL.verG.querySelector('.clAct').classList.contains('clHay'), webOculto: getComputedStyle(document.getElementById('jxAct')).display === 'none' })`);
  await Wb.p.tap('.clAct').catch(() => {}); await Wb.p.waitForTimeout(300); const web = await Wb.ev('window.__web || 0');
  await Wb.p.screenshot({ path: D + 'actualizar_web.png' });
  caso('8b. Actualizar: en la app a la vista y busca (JXNativo.buscarActualizacion); en la web sólo con versión nueva, con su marca, y toca el botón de la web', vNat && busco === 1 && !antes && despues.ve && despues.globo && despues.webOculto && web === 1, { vNat, busco, antes, despues, web });
  // La grieta: su panel con el interruptor, y el estado en el menú
  const e0 = await Wb.ev(`CL.arriba.querySelector('.clEvtE').textContent`);
  await Wb.p.tap('.clEvt'); await Wb.p.waitForTimeout(400); const pan = await Wb.ev(`RB.panel === 'evento' && !!document.querySelector('.rbPan_evento .dpEvSw')`);
  await Wb.p.tap('.rbPan_evento .dpEvSw'); await Wb.p.waitForTimeout(200); const pref = await Wb.ev('PREFS.evento');
  await Wb.p.tap('.rbPan_evento [data-rb=volver]'); await Wb.p.waitForTimeout(500); const e1 = await Wb.ev(`({ t: CL.arriba.querySelector('.clEvtE').textContent, on: CL.arriba.querySelector('.clEvt').classList.contains('clEvtOn'), ve: clVisible() })`);
  caso('8c. La grieta: abre su panel con el interruptor; apagarla se guarda y el menú lo muestra', pan && pref === false && e1.ve && !e1.on && e1.t !== e0, { e0, pan, pref, e1 });
  await Wb.ctx.close();
}

caso('9. sin errores de JS', !errJS.length, errJS.slice(0, 8));
await b.close();
const fallas = RES.filter((x) => !x).length;
console.log(fallas ? `${fallas} FALLAS de ${RES.length}` : `todo OK (${RES.length})`);
process.exit(fallas ? 1 : 0);
