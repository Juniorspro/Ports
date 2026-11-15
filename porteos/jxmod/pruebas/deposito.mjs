// El menú principal «Tu depósito» (juego/deposito.js): el concepto que eligió el dueño (tu terreno + cajas fijas con chapa +
// un solo JUGAR verde), que reemplaza la portada de la 3.4. Lo que se mide:
//  1. pantallas (873×402 y 915×412 con 40 px de muesca a la izquierda, como el celular del dueño; 640×360; 800×368; el
//     celular parado, que el juego gira; tablet 1180×820; compu 1280×720 y 1920×1080), en cada una: las 7 cajas con su texto
//     a la vista de 14 px o más; cada caja y su chapa en el mismo lugar en 5 cargas (0 px), con la caja exacta en el 3D; la
//     chapa del 55 al 70 % de la cara (la del barril, del 35 al 50 %); JUGAR con 2 veces o más el área de la caja más grande y nadie más con su verde; 12
//     cosas para tocar o menos, de 44 px o más, adentro de la pantalla (y de la muesca) y sin pisarse; el contraste del
//     texto medido en la imagen (con el texto escondido) ≥ 4,5, de día y de noche;
//  2. los 14 idiomas en 873×402 y 640×360: nada se sale ni se corta; el árabe, espejado (y la escena también);
//  3. toques: cada cosa del menú 3.4 se alcanza tocando de verdad, contados (1 toque: JUGAR, el mapa, las 7 cajas, el perfil,
//     Amigos y Ajustes; 2: crear server, Chats, Idioma, Tutorial, Lista, Discord, TikTok, Actualizar y Salir);
//  4. el teclado (flechas, Tab, Enter, Esc) y un mando (cruceta, A y B): recorren las cajas y la Lista;
//  5. la entrada (caen con la física y terminan en su lugar; JUGAR se puede tocar mientras; con un cambio de tamaño en el
//     medio, ninguna salta), el agarre (el haz, la caja hacia la cámara, su panel y de vuelta a su lugar) y la ayuda de la
//     primera vez;
//  6. el motor: el dibujo congelado (sin cuadros quieto; un cuadro al cambiar el foco, el tamaño o la hora; sin pausa con el
//     panel de Personajes, que tapa el mundo), la grieta sin borde (la diferencia con y sin la grieta en el borde de su
//     cuadrado) y el barril violeta (el tinte);
//  7. rendimiento (con URL_34 y URL_33): con el procesador 4× más lento, en Gráficos bajos, medios y altos, corridas
//     alternadas: ms de JS y del hilo principal por cuadro y por segundo, cuadros que compone la GPU con el 3D quieto, el heap
//     y el tiempo hasta que el menú se puede tocar;
//  8. sin errores de JS.
// uso: node deposito.mjs URL_HTML [URL_34] [URL_33] [CARPETA_FOTOS]   (SOLO=1,3: sólo esas partes; CARGAS=5)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import { readFileSync, mkdirSync, unlinkSync } from 'fs'; import { tmpdir } from 'os';
const [, , HTML, U34 = '', U33 = '', DIR = '.'] = process.argv, D = DIR.replace(/\/$/, '') + '/';
try { mkdirSync(D, { recursive: true }); } catch (e) {}
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + (info === undefined ? '' : ' · ' + JSON.stringify(info).slice(0, 1600))); return ok; };
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'];
const CHROME = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const b = await chromium.launch({ executablePath: CHROME, args: ARGS });
const errJS = [];
const SOLO = (process.env.SOLO || '').split(',').filter(Boolean), corre = (n) => !SOLO.length || SOLO.includes(String(n));
const IDIOMAS = ['es', 'en', 'pt', 'id', 'ms', 'fil', 'ja', 'th', 'tr', 'ar', 'ru', 'uk', 'fr', 'de'];
const VERDE = 'rgb(34, 197, 94)';
const PREFS0 = (lang) => ({ bienvenida: true, tutVisto: true, nombre: 'NijulaX', nombreOk: true, lang: lang || 'es', mapa: 'Desert' });
// abrir el juego en una pantalla. o: { lang, ins (muesca a la izquierda), antes (otro script), q, franja, dpr, google, url }
async function abrir(nom, w, h, movil, o = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: o.dpr || 1, isMobile: movil, hasTouch: movil, locale: 'es-AR' });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: o.google ? '{"google":true,"cliente":"x.apps.googleusercontent.com"}' : '{"google":false}' }));
  await ctx.addInitScript((P) => { try { if (!localStorage.getItem('jx_prefs')) localStorage.setItem('jx_prefs', JSON.stringify(P)); } catch (e) {} }, PREFS0(o.lang));
  if (o.antes) await ctx.addInitScript(o.antes);
  const p = await ctx.newPage(); p.on('pageerror', (e) => errJS.push(nom + ': ' + e.message.slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|WebSocket|mqtt|ERR_NAME/i.test(m.text())) errJS.push(nom + ' consola: ' + m.text().slice(0, 200)); });
  if (o.ins) { const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: o.ins, right: 0, top: 0, bottom: 0 } }); }
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await p.goto((o.url || HTML) + '?test' + (o.q || '')); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
  if (o.franja !== null) await ev(`DEP.franjaPrueba = '${o.franja || 'tarde'}'; 1`);
  // (quieto: la escena armada, las cajas en su lugar y el dibujo en pausa; en una pantalla grande con la máquina cargada, la
  // entrada puede tardar: hasta 2 min, y si no, se anota)
  const quieto = await listo(p, 120000);
  if (o.franja !== null) await ev(`depHora(); dibujoDespertar(); 1`);
  await p.waitForTimeout(o.espera || 700);
  return { ctx, p, ev, quieto };
}
const esperar = async (p, js, ms = 8000) => { try { await p.waitForFunction((x) => window.__ev(x), js, { timeout: ms }); return true; } catch (e) { return false; } };
// (la escena armada, la entrada terminada y el dibujo en pausa)
const listo = (p, ms = 60000) => esperar(p, `typeof DEP !== 'undefined' && DEP.listo && !DEP.anim && !DEP.tenida && PAUSA.on`, ms);
// ---------------- las medidas (en px de la página; con el juego girado, en las del juego) ----------------
const MEDIR = `(() => {
  const H0 = DEP.el, rot = typeof PANT !== 'undefined' && PANT.rot, W = VW(), H = VH();
  const rr = (e) => { if (!rot) { const q = e.getBoundingClientRect(); return { x0: q.left, y0: q.top, x1: q.right, y1: q.bottom }; } const r = depRect(e); return { x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }; };
  const vis = (e) => e.offsetWidth > 0 && e.offsetHeight > 0 && !e.closest('.oc') && getComputedStyle(e).visibility !== 'hidden';
  const nom = (e) => (e.dataset.rb || e.id || e.className.baseVal || e.className || e.tagName);
  const toc = [...H0.querySelectorAll('button, input, [data-rb]')].filter(vis).filter((e) => !e.parentElement.closest('button')).map((e) => ({ k: nom(e), ...rr(e) }));
  const cajas = DP_K.map((k) => { const e = H0.querySelector('.dpC_' + k), c = e.querySelector('.dpChapa'); return { k, ...rr(e), ch: rr(c), cara: DEP.cara[k], sale: c.classList.contains('dpSale'),
    fP: parseFloat(getComputedStyle(c.querySelector('.dpChP')).fontSize), fD: parseFloat(getComputedStyle(c.querySelector('.dpChD')).fontSize),
    t: c.querySelector('.dpChP').textContent.replace(/[\\u00ad\\u200b]/g, '') + ' / ' + c.querySelector('.dpChD').textContent, d3: DEP.cajas[k].o.b.pos.distTo(DEP.cajas[k].L.p) + (1 - Math.abs(DEP.cajas[k].o.b.q.x * DEP.cajas[k].L.q.x + DEP.cajas[k].o.b.q.y * DEP.cajas[k].L.q.y + DEP.cajas[k].o.b.q.z * DEP.cajas[k].L.q.z + DEP.cajas[k].o.b.q.w * DEP.cajas[k].L.q.w)) }; });
  const txt = [];
  for (const e of H0.querySelectorAll('*')) {
    if (!vis(e)) continue;
    const t = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(); if (!t) continue;
    let corta = false; for (let c = e, i = 0; i < 3 && c && c !== H0; i++, c = c.parentElement) { const cc = getComputedStyle(c);
      if (/hidden|clip/.test(cc.overflowX) && c.scrollWidth > c.clientWidth + 1) corta = true; if (/hidden|clip/.test(cc.overflowY) && c.scrollHeight > c.clientHeight + 2) corta = true; }
    const bt = e.closest('button, .dpChapa, .dpAyuda, .dpGrupo span'), R0 = rr(e), RB0 = bt && bt !== e ? rr(bt) : null;
    if (RB0 && (R0.x0 < RB0.x0 - 1.5 || R0.x1 > RB0.x1 + 1.5 || R0.y0 < RB0.y0 - 1.5 || R0.y1 > RB0.y1 + 1.5)) corta = true;
    txt.push({ k: nom(e), t: t.replace(/[\\u00ad\\u200b]/g, '').slice(0, 30), f: parseFloat(getComputedStyle(e).fontSize), ls: getComputedStyle(e).letterSpacing, corta, opcion: !!e.closest('.dpChapa'), ...R0 });
  }
  const J = H0.querySelector('.dpJugar'), verde = getComputedStyle(J).backgroundColor, otros = [];
  for (const e of H0.querySelectorAll('*')) { if (!vis(e) || J.contains(e)) continue; const c = getComputedStyle(e); if ([c.backgroundColor, c.color, c.borderTopColor, c.fill].includes(verde)) otros.push(nom(e)); }
  return { W, H, rot, rtl: RB.el.dir === 'rtl', ins: DEP.ins, toc, cajas, txt, jugar: rr(J), verde, otros, perfil: rr(H0.querySelector('.dpPerfil')), sx: DEP.sx, pj: DEP.pj.pos.x, pila: DEP.cajas.pj.L.p.x, multi: DEP.cajas.multi.L.p.x };
})()`;
function revisar(M, ins = 0) {
  const pr = [], pisa = (a, b2) => Math.min(a.x1, b2.x1) - Math.max(a.x0, b2.x0) > 0.5 && Math.min(a.y1, b2.y1) - Math.max(a.y0, b2.y0) > 0.5;
  if (M.toc.length > 12) pr.push(`${M.toc.length} cosas para tocar (más de 12)`);
  for (const e of M.toc) {
    if (Math.min(e.x1 - e.x0, e.y1 - e.y0) < 43.5) pr.push(`${e.k} chico ${Math.round(e.x1 - e.x0)}×${Math.round(e.y1 - e.y0)}`);
    // (la muesca es de la pantalla, a la izquierda, en cualquier idioma)
    if (e.x0 < ins - 0.5 || e.y0 < -0.5 || e.x1 > M.W + 0.5 || e.y1 > M.H + 0.5) pr.push(`${e.k} afuera [${[e.x0, e.y0, e.x1, e.y1].map(Math.round)}]`);
  }
  for (let i = 0; i < M.toc.length; i++) for (let j = i + 1; j < M.toc.length; j++) if (pisa(M.toc[i], M.toc[j])) pr.push(`${M.toc[i].k} × ${M.toc[j].k}`);
  for (const c of M.cajas) {
    if (c.fP < 13.95 || c.fD < 13.95) pr.push(`${c.k}: letra ${c.fP}/${c.fD}px`);
    if (c.sale) pr.push(`${c.k}: el texto no entra en la chapa`);
    // (las cajas, del 55 al 70 % de la cara; el barril, que no es una caja, del 35 al 50 %: se ven la tapa y los aros)
    const fa = (c.cara.x1 - c.cara.x0) * (c.cara.y1 - c.cara.y0), pa = (c.ch.x1 - c.ch.x0) * (c.ch.y1 - c.ch.y0), pct = pa / fa, [p0, p1] = c.k === 'evento' ? [0.345, 0.505] : [0.545, 0.705];
    if (pct < p0 || pct > p1) pr.push(`${c.k}: la chapa ocupa ${Math.round(pct * 100)} % de la cara`);
    if (c.ch.x0 < c.cara.x0 + 1 || c.ch.x1 > c.cara.x1 - 1 || c.ch.y0 < c.cara.y0 + 1 || c.ch.y1 > c.cara.y1 - 1) pr.push(`${c.k}: la chapa no deja ver la madera`);
    if (c.d3 > 1e-6) pr.push(`${c.k}: la caja no está en su lugar (${c.d3.toFixed(4)} m)`);
  }
  for (const t of M.txt) { if (t.f < (t.opcion ? 13.95 : 11.95)) pr.push(`letra ${t.f}px «${t.t}»`); if (t.corta) pr.push(`cortado «${t.t}» (${t.k})`); }
  const maxA = Math.max(...M.cajas.map((c) => (c.x1 - c.x0) * (c.y1 - c.y0))), jA = (M.jugar.x1 - M.jugar.x0) * (M.jugar.y1 - M.jugar.y0);
  if (jA < 2 * maxA) pr.push(`JUGAR ${Math.round(jA)} px² < 2 × ${Math.round(maxA)}`);
  if (M.otros.length) pr.push('con el verde de JUGAR: ' + M.otros.slice(0, 4).join(', '));
  return { pr, razon: +(jA / maxA).toFixed(2) };
}
// el contraste medido en la imagen: se esconde el texto, se saca la foto y, debajo de cada texto, el 5 % de los puntos que
// menos contrastan con su color tiene que dar ≥ 4,5
const TEXTOS = `(() => { const out = [];
  for (const e of DEP.el.querySelectorAll('*')) { if (!(e.offsetWidth > 0) || e.closest('.oc') || getComputedStyle(e).visibility === 'hidden') continue;
    const t = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(); if (!t) continue;
    const q = e.getBoundingClientRect(), c = getComputedStyle(e).color.match(/[\\d.]+/g).map(Number);
    out.push({ t: t.replace(/[\\u00ad\\u200b]/g, '').slice(0, 24), x: q.left, y: q.top, w: q.width, h: q.height, c }); }
  return out; })()`;
async function contraste(p, ev) {
  const T = await ev(TEXTOS);
  await ev(`(() => { const s = document.createElement('style'); s.id = 'sinTexto'; s.textContent = '#rbInicio .dpHome, #rbInicio .dpHome *{color:transparent!important;-webkit-text-fill-color:transparent!important;caret-color:transparent!important}'; document.head.appendChild(s); return 1; })()`);
  await p.waitForTimeout(200);
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
const POS = `JSON.stringify(Object.fromEntries(DP_K.map((k) => { const e = DEP.el.querySelector('.dpC_' + k), c = e.querySelector('.dpChapa'), r = (x) => { const q = x.getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map((v) => +v.toFixed(2)); }; return [k, r(e).concat(r(c))]; })))`;
// ======================= 1. pantallas =======================
const PANT = [['celu_dueño_873x402', 873, 402, true, 40], ['celu_915x412', 915, 412, true, 40], ['celu_chico_640x360', 640, 360, true, 0], ['celu_800x368', 800, 368, true, 0],
  ['celu_parado_402x873', 402, 873, true, 0], ['tablet_1180x820', 1180, 820, true, 0], ['compu_1280x720', 1280, 720, false, 0], ['compu_1920x1080', 1920, 1080, false, 0]];
const CARGAS = +(process.env.CARGAS || 5);
if (corre(1)) for (const [nom, w, h, movil, ins] of PANT) {
  const pos = []; let det = null, razon = 0;
  for (let i = 0; i < CARGAS; i++) {
    // (cada carga, de cero: sin nada guardado —las cajas caen— salvo el idioma y el nombre)
    const A = await abrir(nom, w, h, movil, { ins });
    pos.push(JSON.parse(await A.ev(POS)));
    if (i === 0) {
      const M = await A.ev(MEDIR), r = revisar(M, ins); razon = r.razon; if (!A.quieto) r.pr.push('no quedó quieto en 2 min');
      det = { probs: r.pr, toc: M.toc.length };
      caso(`${nom}: 7 cajas con texto ≥ 14 px, chapa 55-70 %, en su lugar en el 3D; JUGAR ${r.razon}× la caja más grande y el único verde; ${M.toc.length} tocables ≥ 44 px, adentro${ins ? ' (y de la muesca)' : ''}, sin pisarse`, !r.pr.length, r.pr.slice(0, 10));
      for (const fr of ['tarde', 'noche']) {
        if (fr === 'noche') { await A.ev(`DEP.franjaPrueba = 'noche'; depHora(); dibujoDespertar(); 1`); await A.p.waitForTimeout(900); }
        const C = await contraste(A.p, A.ev), malos = C.filter((x) => x.c < 4.5);
        caso(`${nom}: contraste ≥ 4,5 de ${fr === 'tarde' ? 'día' : 'noche'} en los ${C.length} textos (el peor ${Math.min(...C.map((x) => x.c))})`, !malos.length, malos.slice(0, 6));
        await A.p.screenshot({ path: D + `dep_${nom}_${fr}.png` });
      }
    }
    await A.ctx.close();
  }
  let dif = 0; for (const k in pos[0]) for (let i = 1; i < pos.length; i++) for (let j = 0; j < 8; j++) dif = Math.max(dif, Math.abs(pos[0][k][j] - pos[i][k][j]));
  caso(`${nom}: cada caja y su chapa en el mismo lugar en ${pos.length} cargas (diferencia ${dif} px)`, dif === 0, { dif });
}
// ======================= 2. idiomas =======================
if (corre(2)) for (const [nom, w, h, ins] of [['873x402', 873, 402, 40], ['640x360', 640, 360, 0]]) {
  const A = await abrir('idiomas ' + nom, w, h, true, { ins });
  for (const l of IDIOMAS) {
    await A.ev(`idiomaAplicar('${l}'); inicioLista(); 1`); await A.p.waitForTimeout(500); await listo(A.p, 20000); await A.p.waitForTimeout(300);
    const M = await A.ev(MEDIR), r = revisar(M, ins), pr = r.pr;
    if (l === 'ar') {
      // (espejado: el perfil a la derecha, JUGAR a la izquierda y la escena al revés —tu personaje a la derecha de la pila «VOS»—)
      if (!M.rtl || !(M.perfil.x0 > M.W / 2) || !(M.jugar.x1 < M.W / 2) || !(M.sx < 0) || !(M.pj < M.pila) || !(M.multi > M.pila)) pr.push('árabe sin espejar');
      for (const t of M.txt) if (t.ls !== 'normal' && parseFloat(t.ls) !== 0) { pr.push('espacio entre letras en árabe: ' + t.t); break; }
    }
    caso(`idioma ${l} en ${nom}: nada se sale, se corta ni se pisa`, !pr.length, pr.slice(0, 8));
    if (['de', 'ar', 'ru', 'ja', 'th', 'fil'].includes(l)) await A.p.screenshot({ path: D + `dep_idioma_${l}_${nom}.png` });
  }
  await A.ctx.close();
}
// ======================= 3. toques =======================
if (corre(3)) {
  const A = await abrir('toques', 873, 402, true, { ins: 40, antes: () => {
    window.__abierto = []; window.open = (u) => { window.__abierto.push(String(u)); return null; };
    window.JXNativo = { buscarActualizacion() { window.__busco = (window.__busco || 0) + 1; }, salir() { window.__salio = 1; } };
  } });
  const { p, ev } = A;
  await ev(`tutAbrir = () => { window.__tut = 1; }; 1`);
  // [qué es, lo que se toca (en orden), qué tiene que pasar, toques en el menú 3.3, en la portada 3.4]
  const INV = [
    ['JUGAR (el mapa elegido)', ['.dpJugar'], `JUEGO.estado === 'juego'`, 2, 1],
    ['Mapa y modo (Empezar partida nueva)', ['.dpMapa'], `RB.panel === 'nueva' && !!document.getElementById('rbHora')`, 1, 1],
    ['Emotes', ['.dpC_emotes'], `RB.panel === 'tienda' && RB.t.tab === 'anim'`, 2, 1],
    ['Personajes', ['.dpC_pj'], `RB.panel === 'personajes'`, 1, 1],
    ['Crear mapa', ['.dpC_crear'], `RB.panel === 'crear'`, 1, 1],
    ['Workshop (addons de GMod)', ['.dpC_ws'], `RB.panel === 'tienda' && RB.t.tab === 'gmod'`, 2, 1],
    ['Mods y mapas (la tienda)', ['.dpC_mods'], `RB.panel === 'tienda' && RB.t.tab === 'mod'`, 1, 1],
    ['Multijugador', ['.dpC_multi'], `RB.panel === 'multi'`, 1, 1],
    ['La grieta (el evento, con su interruptor)', ['.dpC_evento'], `RB.panel === 'evento' && !!document.querySelector('.rbPan_evento .dpEvSw')`, 3, 1],
    ['Perfil (nombre, personaje y cuenta)', ['.dpPerfil'], `!!DEP.hoja && DEP.hoja.classList.contains('dpHojaPerfil') && !!document.getElementById('rbNombre')`, 1, 1],
    ['Amigos (y solicitudes)', ['.dpAmigos'], `RB.panel === 'social'`, 2, 1],
    ['Ajustes', ['.dpAj'], `!!DEP.hoja && DEP.hoja.classList.contains('dpHojaAj')`, 1, 1],
    ['Crear server', ['.dpC_multi', '.rbPan [data-rb=mcrear]'], `RB.panel === 'mcrear'`, 2, 1],
    ['Chats', ['.dpAmigos', '.rbPan [data-rb="soc:tab|chats"]'], `RB.panel === 'social' && SOC.tab === 'chats'`, 1, 1],
    ['Idioma', ['.dpAj', '.dpHojaAj [data-rb=idioma]'], `RB.panel === 'bienvenida' && !!document.querySelector('.rbIdiomas')`, 1, 1],
    ['Tutorial', ['.dpAj', '.dpHojaAj [data-rb=dpTut]'], `window.__tut === 1`, 3, 1],
    ['Lista (teclado y mando)', ['.dpAj', '.dpHojaAj [data-rb=dpLista]'], `DEP.lista && !!document.activeElement.closest('.dpLista')`, 0, 0],
    ['Discord', ['.dpAj', '.dpHojaAj .dpRed[title=Discord]'], `window.__abierto.some((u) => /discord/.test(u))`, 1, 1],
    ['TikTok', ['.dpAj', '.dpHojaAj .dpRed[title=TikTok]'], `window.__abierto.some((u) => /tiktok/.test(u))`, 1, 1],
    ['Actualizar (en la app)', ['.dpAj', '.dpHojaAj [data-rb=dpAct]'], `window.__busco === 1`, 0, 1],
    ['Salir', ['.dpAj', '.dpHojaAj [data-rb=salir]'], `window.__salio === 1`, 1, 1],
    ['Gráficos', ['.dpAj', '.dpHojaAj [data-rb="dpAj:g"]'], `!document.getElementById('ajustes').classList.contains('oc')`, 1, 1],
  ];
  const volver = async () => {
    await ev(`(() => { if (JUEGO.estado === 'juego') { irMenuPrincipal(); return 1; } if (RB.panel) inicioAccion('volver'); cerrarPaneles(); UI.abierto = null; if (DEP.hoja) depHoja(null); if (DEP.lista) depListaCerrar(); return 1; })()`);
    await listo(p, 60000);
  };
  const tabla = [];
  for (const [que, toques, ok, n33, n34] of INV) {
    await volver(); await p.waitForTimeout(200);
    let det = '';
    for (const [i, s] of toques.entries()) {
      // (lo que se toca tiene que estar a la vista, entero y sin nada encima; en el menú, de 44 px o más —lo de adentro de los
      // paneles de siempre, como «Crear server» en Multijugador, es como en la 3.4—)
      const ver = await ev(`(() => { const e = document.querySelector(${JSON.stringify(s)}); if (!e) return 'no está'; const q = e.getBoundingClientRect(), cx = q.left + q.width / 2, cy = q.top + q.height / 2, en = document.elementFromPoint(cx, cy), menu = !!e.closest('.dpHome');
        return menu && (q.width < 44 || q.height < 44) ? 'chico' : q.left < 0 || q.top < 0 || q.right > innerWidth || q.bottom > innerHeight ? 'afuera' : !(en && (e === en || e.contains(en))) ? 'tapado por ' + (en && (en.className.baseVal || en.className)) : ''; })()`);
      if (ver) det += ` [${s}: ${ver}]`;
      try { await p.tap(s, { timeout: 5000 }); } catch (e) { det += ' no se pudo tocar ' + s; }
      // (después de tocar una caja, el haz la trae: se espera a que se abra su panel)
      if (i < toques.length - 1) { await esperar(p, `!!document.querySelector(${JSON.stringify(toques[i + 1])})`, 8000); await p.waitForTimeout(300); }
    }
    const llego = await esperar(p, ok, 12000);
    const n = toques.length;
    tabla.push({ que, n33, n34, n, ok: llego && !det });
    caso(`toques: ${que} (${n33 || '—'} en la 3.3, ${n34 || '—'} en la 3.4 → ${n})`, llego && !det && n <= (que.includes('Lista') ? 2 : ['Crear server', 'Chats', 'Idioma', 'Tutorial', 'Discord', 'TikTok', 'Actualizar (en la app)', 'Salir', 'Gráficos'].includes(que) ? 2 : 1), { llego, det });
  }
  await volver();
  // Actualizar en la web: sin la app, sólo si apareció el botón de codigo_web.mjs (y el engranaje lleva el globito)
  await ev(`delete window.JXNativo; depActualizarVer(); 1`);
  const sinAct = await ev(`DEP.ui.querySelector('.dpAct').classList.contains('oc') && !DEP.ui.querySelector('.dpAj .soBadge')`);
  await ev(`(() => { const b = document.createElement('button'); b.id = 'jxAct'; b.textContent = 'Actualizar'; b.setAttribute('style', 'position:fixed;z-index:2147483647;right:12px;bottom:12px'); b.onclick = () => { window.__web = 1; }; document.body.appendChild(b); return 1; })()`);
  await p.waitForTimeout(300);
  const globo = await ev(`!!DEP.ui.querySelector('.dpAj .soBadge') && getComputedStyle(document.getElementById('jxAct')).display === 'none'`);
  await p.tap('.dpAj'); await p.waitForTimeout(250); await p.tap('.dpHojaAj [data-rb=dpAct]').catch(() => {}); await p.waitForTimeout(250);
  caso('Actualizar en la web: aparece sólo con versión nueva (con el globito en el engranaje; el botón suelto no tapa JUGAR) y lo aprieta', sinAct && globo && (await ev('window.__web === 1')), { sinAct, globo });
  await ev(`document.getElementById('jxAct').remove(), 1`); await volver();
  // tu nombre se escribe en la hoja del perfil
  await p.tap('.dpPerfil'); await p.waitForTimeout(250); await p.fill('#rbNombre', 'Nuevo Nombre'); await p.waitForTimeout(200);
  caso('el nombre se escribe en la hoja del perfil y se guarda (y se ve en el botón)', await ev(`PREFS.nombre === 'Nuevo Nombre' && DEP.ui.querySelector('.dpNom').textContent === 'Nuevo Nombre'`));
  await ev(`PREFS.nombre = 'NijulaX'; depHoja(null); inicioLista(); 1`);
  console.log('toques (3.3 → 3.4 → ahora):\n' + tabla.map((t) => `  ${t.ok ? '✓' : '✗'} ${t.que}: ${t.n33 || '—'} → ${t.n34 || '—'} → ${t.n}`).join('\n'));
  // al salir de una partida, vuelve el depósito con las cajas en su lugar
  await volver();
  await p.tap('.dpJugar'); const jugo = await esperar(p, `JUEGO.estado === 'juego'`, 30000); await ev(`irMenuPrincipal(); 1`);
  const otra = await listo(p, 60000), st = await ev(`({ listo: DEP.listo, anim: DEP.anim && DEP.anim.tipo, tenida: DEP.tenida, pausa: PAUSA.on, mapa: MUNDO.nombre, viva: depEscenaViva(), panel: RB.panel, giro: depPjGiro() })`);
  caso('al salir de la partida, el depósito se vuelve a armar (las cajas en su lugar, el dibujo en pausa)', jugo && otra && (await ev(`DP_K.every((k) => DEP.cajas[k].o.b.pos.distTo(DEP.cajas[k].L.p) === 0)`)), { jugo, ...st });
  await A.ctx.close();
}
if (corre(3)) {
  const G = await abrir('cuenta', 873, 402, true, { google: true });
  await esperar(G.p, `!!DEP.ui.querySelector('.cuChip')`, 8000);
  // (con la cuenta prendida y sin sesión, al abrir aparece solo el cartel para entrar: se cierra y se busca el botón)
  await G.p.waitForTimeout(1500); await G.ev(`cuDialogoCerrar(), 1`); await G.p.waitForTimeout(200);
  await G.p.tap('.dpPerfil'); await G.p.waitForTimeout(300);
  const cu = await G.ev(`(() => { const c = DEP.ui.querySelector('.cuChip'); return c ? { enHoja: !!c.closest('.dpHojaPerfil'), q: c.getBoundingClientRect().height, sinG: !DEP.ui.querySelector('.dpG').classList.contains('dpGsi') } : null; })()`);
  if (cu) { await G.p.tap('.cuChip', { timeout: 5000 }).catch(() => {}); await G.p.waitForTimeout(400); }
  const dlg = await G.ev(`!!document.querySelector('#cuDlg:not(.oc)')`);
  caso('la cuenta de Google: en la hoja del perfil (sin sesión, sin la «G» en el botón) y abre su cartel', !!cu && cu.enHoja && cu.q >= 44 && cu.sinG && dlg, { cu, dlg });
  await G.ctx.close();
}
// ======================= 4. teclado y mando =======================
if (corre(4)) {
  const A = await abrir('teclado', 1280, 720, false, { antes: () => {
    window.__pad = null; const real = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : () => [];
    navigator.getGamepads = () => (window.__pad ? [window.__pad] : real());
  } });
  const { p, ev } = A, foco = () => ev(`(() => { const a = document.activeElement; return a && DEP.el.contains(a) ? (a.dataset.k || a.dataset.rb || a.id || a.className) : null; })()`);
  await p.keyboard.press('Tab'); const f1 = await foco();
  await ev(`document.activeElement && document.activeElement.blur(), 1`);
  await p.keyboard.press('ArrowDown'); const f2 = await foco();   // (sin foco: la primera flecha va a JUGAR)
  const camino = [f2]; for (let i = 0; i < 3; i++) { await p.keyboard.press('ArrowUp'); camino.push(await foco()); }
  for (let i = 0; i < 6; i++) { await p.keyboard.press('ArrowLeft'); camino.push(await foco()); }
  const cajas = new Set(camino.filter((k) => ['emotes', 'pj', 'crear', 'ws', 'mods', 'multi', 'evento'].includes(k)));
  // (Enter en una caja: el haz la trae y se abre su panel)
  await ev(`DEP.cajasEl.querySelector('.dpC_crear').focus(), 1`); await p.keyboard.press('Enter');
  const enter = await esperar(p, `RB.panel === 'crear'`, 10000);
  caso('teclado: Tab entra, las flechas recorren las cajas directamente (de JUGAR hacia arriba y a la izquierda) y Enter abre la caja', !!f1 && f2 === 'jugar' && cajas.size >= 4 && enter, { f1, camino, enter });
  await ev(`inicioAccion('volver'), 1`); await listo(p);
  // la hoja de Ajustes con el teclado: Esc la cierra y el foco vuelve al engranaje
  await ev(`DEP.ui.querySelector('.dpAj').focus(), 1`); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  const hoja = await ev(`!!DEP.hoja && DEP.hoja.contains(document.activeElement)`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  const esc = await ev(`!DEP.hoja && document.activeElement === DEP.ui.querySelector('.dpAj')`);
  // la Lista: con foco a la vista, las flechas la recorren y Enter elige (Workshop)
  await ev(`depListaAbrir(), 1`); await p.waitForTimeout(200);
  const l0 = await ev(`document.activeElement.dataset.rb`); await p.keyboard.press('ArrowRight'); const l1 = await ev(`document.activeElement.dataset.rb`);
  const visto = await ev(`(() => { const a = document.activeElement, c = getComputedStyle(a); return c.boxShadow !== 'none' || c.outlineStyle !== 'none'; })()`);
  await p.keyboard.press('Enter'); const lista = await esperar(p, `RB.panel === 'tienda' && RB.t.tab === 'gmod'`, 10000);
  caso('teclado: la hoja de Ajustes toma el foco y Esc la cierra; la Lista se recorre con las flechas, con el foco a la vista, y Enter abre', hoja && esc && l0 === 'dpL:jugar' && l1 === 'dpL:ws' && visto && lista, { hoja, esc, l0, l1, visto, lista });
  await ev(`inicioAccion('volver'), 1`); await listo(p);
  // el mando: la cruceta recorre las cajas, A abre y B vuelve
  const boton = (n) => Array.from({ length: 17 }, (_, i) => ({ pressed: i === n, value: i === n ? 1 : 0 }));
  await ev(`window.__pad = { id: 'prueba', index: 0, connected: true, axes: [0, 0, 0, 0], buttons: ${JSON.stringify(boton(-1))} }; DEP.ui.querySelector('.dpJugar').focus(); dispatchEvent(new Event('gamepadconnected')); 1`);
  await p.waitForTimeout(200);
  const apretar = async (n, hasta) => { await ev(`window.__pad.buttons = ${JSON.stringify(boton(-1))}.map((x, i) => i === ${n} ? { pressed: true, value: 1 } : x); 1`); const ok = await esperar(p, hasta, 20000); await ev(`window.__pad.buttons = ${JSON.stringify(boton(-1))}; 1`); await p.waitForTimeout(220); return ok; };
  await apretar(12, `document.activeElement && !!document.activeElement.dataset.k`); const m1 = await foco();
  await apretar(14, `document.activeElement && document.activeElement.dataset.k !== '${m1}'`); const m2 = await foco();
  await apretar(0, `!!RB.panel`); const m3 = await ev('RB.panel');
  await apretar(1, `RB.panel === null`); const m4 = await listo(p);
  caso('mando: la cruceta va a las cajas y entre ellas, A abre la caja y B vuelve', !!m1 && !!m2 && m1 !== m2 && !!m3 && m4, { m1, m2, m3, m4 });
  await ev(`window.__pad = null; 1`);
  // los estados de lo que se toca (lo que medía menu_nuevo en la portada): con el mouse encima, apretado y con el foco, cada
  // uno se ve distinto del normal
  await ev(`if (RB.panel) inicioAccion('volver'); 1`); await listo(p);
  const ESTADOS = [['jugar', '.dpJugar'], ['caja', '.dpC_mods'], ['icono', '.dpAj'], ['mapa', '.dpMapa'], ['perfil', '.dpPerfil']];
  const recorte = async (s2) => { const q = await ev(`(() => { const r = document.querySelector(${JSON.stringify(s2)}).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`); return { x: Math.max(0, q[0] - 8), y: Math.max(0, q[1] - 8), width: q[2] + 16, height: q[3] + 16 }; };
  const dif = (a2, b2) => { let n2 = 0; for (let i = 0; i < Math.min(a2.length, b2.length); i++) if (a2[i] !== b2[i]) n2++; return n2 / Math.max(a2.length, 1); };
  const est = {};
  for (const [k, s2] of ESTADOS) {
    await p.mouse.move(2, 700); await ev(`document.activeElement && document.activeElement.blur(), 1`); await p.waitForTimeout(200);
    const clip = await recorte(s2), f = {};
    f.normal = await p.screenshot({ clip });
    const q = await ev(`(() => { const r = document.querySelector(${JSON.stringify(s2)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    await p.mouse.move(q[0], q[1]); await p.waitForTimeout(250); f.encima = await p.screenshot({ clip });
    await p.mouse.down(); await p.waitForTimeout(150); f.apretado = await p.screenshot({ clip });
    await p.mouse.move(2, 700); await p.mouse.up(); await p.waitForTimeout(150);
    await p.keyboard.press('Shift'); await ev(`document.querySelector(${JSON.stringify(s2)}).focus(), 1`); await p.waitForTimeout(250); f.foco = await p.screenshot({ clip });
    est[k] = { encima: +dif(f.normal, f.encima).toFixed(3), apretado: +dif(f.normal, f.apretado).toFixed(3), foco: +dif(f.normal, f.foco).toFixed(3) };
    await ev(`document.activeElement && document.activeElement.blur(), 1`); await listo(p, 20000);
  }
  caso('estados: con el mouse encima, apretado y con el foco, JUGAR, una caja, un ícono, el mapa y el perfil se ven distintos del normal', Object.values(est).every((e) => e.encima > 0.004 && e.apretado > 0.004 && e.foco > 0.004), est);
  await A.ctx.close();
}
// ======================= 5. la entrada, el agarre y la ayuda =======================
if (corre(5)) {
  const A = await abrir('entrada', 873, 402, true, { ins: 40, franja: null, espera: 0 });
  const { p, ev } = A;
  // (de cero: sin haber visto el depósito; se mira en el medio de la entrada)
  await ev(`DEP.franjaPrueba = 'tarde'; delete PREFS.dpVisto; delete PREFS.dpAyuda; DEP.ayuda = true; DEP.listo = false; depArmar(); 1`);
  const cae = await esperar(p, `DEP.anim && DEP.anim.tipo === 'entrada' && DP_K.some((k) => DEP.cajas[k].o.b.pos.y > DEP.cajas[k].L.p.y + 0.3) && DP_K.some((k) => !DEP.cajas[k].o.b.frozen)`, 15000);
  const jugarYa = await ev(`(() => { const e = DEP.ui.querySelector('.dpJugar'), q = e.getBoundingClientRect(), en = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return !!DEP.anim && (e === en || e.contains(en)); })()`);
  await listo(p, 60000);
  const lugar = await ev(`DP_K.every((k) => DEP.cajas[k].o.b.pos.distTo(DEP.cajas[k].L.p) === 0 && DEP.cajas[k].o.b.frozen)`);
  caso('entrada: las cajas caen con la física del juego y terminan exactamente en su lugar; JUGAR se puede tocar mientras', cae && jugarYa && lugar, { cae, jugarYa, lugar });
  // girar el celular mientras caen (el tamaño cambia en el medio de la entrada y las pilas se vuelven a poner de frente a la
  // cámara): ninguna caja salta —lo más que se mueve en un cuadro es lo que cae— y todas terminan en su lugar (antes del
  // arreglo, una saltaba 4,75 m)
  await ev(`(() => { window.__salto = { max: 0, k: null }; const prev = {};
    const f = () => { const A2 = DEP.anim; for (const k of DP_K) { const X = A2 && A2.cajas && A2.cajas[k], q = DEP.cajas[k].o.b.pos;
        if (!X || X.fase < 1) { prev[k] = null; continue; }
        if (prev[k]) { const d = q.distTo(prev[k]); if (d > __salto.max) { __salto.max = d; __salto.k = k; } } prev[k] = q.clone(); }
      if (DEP.anim) requestAnimationFrame(f); else __salto.fin = true; };
    depEntrada(DP_K); requestAnimationFrame(f); return 1; })()`);
  await p.waitForTimeout(500); await p.setViewportSize({ width: 800, height: 368 });
  await esperar(p, `!!(window.__salto && __salto.fin)`, 60000);
  const salto = await ev(`({ max: +__salto.max.toFixed(3), k: __salto.k, lugar: DP_K.every((k) => DEP.cajas[k].o.b.pos.distTo(DEP.cajas[k].L.p) === 0 && DEP.cajas[k].o.b.frozen) })`);
  await p.setViewportSize({ width: 873, height: 402 }); await listo(p, 60000);
  caso('entrada con un cambio de tamaño en el medio: ninguna caja salta (lo más que se mueve en un cuadro, cayendo, < 1 m) y terminan en su lugar', salto.max < 1 && salto.lugar, salto);
  const ay0 = await ev(`!DEP.ui.querySelector('.dpAyuda').classList.contains('oc')`);
  // el agarre: el haz agarra la caja de Workshop, la trae hacia la cámara y se abre su panel
  await ev(`DEP.hazN = 0; 1`);
  await p.tap('.dpC_ws');
  const viaja = await esperar(p, `DEP.tenida === 'ws' && DEP.cajas.ws.o.b.pos.distTo(DEP.cajas.ws.L.p) > 0.4 && DEP.cajas.ws.o.b.pos.distTo(DEP.cam.pos) < DEP.cajas.ws.L.p.distTo(DEP.cam.pos) - 0.4`, 8000);
  const panel = await esperar(p, `RB.panel === 'tienda' && RB.t.tab === 'gmod'`, 10000);
  const haz = await ev('DEP.hazN');
  await ev(`inicioAccion('volver'), 1`); const vuelve = await listo(p, 20000);
  const exacta = await ev(`DEP.cajas.ws.o.b.pos.distTo(DEP.cajas.ws.L.p) === 0`);
  caso('agarre: el haz de la pistola de física agarra la caja, la trae hacia la cámara, se abre su panel y al volver queda en su lugar', viaja && panel && haz > 0 && vuelve && exacta, { viaja, panel, haz, vuelve, exacta });
  const ay1 = await ev(`DEP.ui.querySelector('.dpAyuda').classList.contains('oc') && PREFS.dpAyuda === 1`);
  await ev(`inicioMostrar(true); 1`); await p.waitForTimeout(300);
  const ay2 = await ev(`DEP.ui.querySelector('.dpAyuda').classList.contains('oc')`);
  caso('la ayuda de la primera vez («Tocá una caja para abrirla») se ve hasta el primer toque y no vuelve', ay0 && ay1 && ay2, { ay0, ay1, ay2 });
  await A.ctx.close();
}
// ======================= 6. el motor: el dibujo congelado, la grieta y el tinte =======================
if (corre(6)) {
  const A = await abrir('motor', 873, 402, true, {});
  const { p, ev } = A;
  const n = () => ev('PAUSA.dibujados'), cuadro = () => ev('R.cuadro');
  await p.waitForTimeout(1500);
  const c0 = await cuadro(); await p.waitForTimeout(3000); const c1 = await cuadro();
  await ev(`DEP.cajasEl.querySelector('.dpC_mods').focus(), 1`); await p.waitForTimeout(800); const c2 = await cuadro();
  await p.setViewportSize({ width: 860, height: 400 }); await p.waitForTimeout(1200); const c3 = await cuadro();
  await ev(`DEP.franjaPrueba = 'noche'; depHora(); dibujoDespertar(); 1`); await p.waitForTimeout(800); const c4 = await cuadro();
  await p.waitForTimeout(2000); const c5 = await cuadro();
  caso('dibujo congelado: quieto no dibuja (3 s), y dibuja al cambiar el foco, el tamaño de la pantalla y la hora', c1 === c0 && c2 > c1 && c3 > c2 && c4 > c3 && c5 === c4, { quieto: c1 - c0, foco: c2 - c1, tam: c3 - c2, hora: c4 - c3, despues: c5 - c4 });
  // un panel que tapa el mundo abierto por otro camino que las cajas (Personajes, con su escenario y tu personaje girando):
  // sin pausa mientras está abierto; con «Volver», quieto otra vez
  await ev(`inicioPanel('personajes'), 1`); await p.waitForTimeout(400); const c6 = await cuadro(); await p.waitForTimeout(1000); const c7 = await cuadro(), pz1 = await ev('PAUSA.on');
  await ev(`RB.el.querySelector('.rbPan [data-rb=volver]').click(), 1`); await p.waitForTimeout(2500); const c8 = await cuadro(); await p.waitForTimeout(1500); const c9 = await cuadro(), pz2 = await ev('PAUSA.on');
  caso('sin pausa con el panel de Personajes (abierto sin la caja) y en pausa otra vez al volver', !pz1 && c7 - c6 >= 5 && pz2 && c9 === c8, { cuadrosConPanel: c7 - c6, pausaConPanel: pz1, pausaAlVolver: pz2, cuadrosAlVolver: c9 - c8 });
  await p.setViewportSize({ width: 873, height: 402 }); await listo(p);
  // la grieta: la foto con la grieta menos la foto sin ella; en el borde de su cuadrado (y afuera) la diferencia tiene que
  // ser 0 —antes, de noche y sin HDR, un salto de ~14/255 en el azul—
  for (const fr of ['tarde', 'noche']) {
    await ev(`DEP.franjaPrueba = '${fr}'; depHora(); PREFS.evento = true; dibujoDespertar(); 1`); await p.waitForTimeout(900);
    const con = (await p.screenshot()).toString('base64');
    await ev(`PREFS.evento = false; dibujoDespertar(); 1`); await p.waitForTimeout(900);
    const sin = (await p.screenshot()).toString('base64');
    await ev(`PREFS.evento = true; dibujoDespertar(); 1`); await p.waitForTimeout(500);
    const bordes = await ev(`(() => { const S = EVT_S * EVT.tam, out = []; const P = (u, v) => { const d = vadd(EVT.dir, vadd(vscale(EVT.e1, u * S), vscale(EVT.e2, v * S))); return depProy(vadd(DEP.cam.pos, vscale(d, 1000))); };
      for (let i = 0; i <= 20; i++) { const t = -1 + i / 10; for (const [u, v] of [[t, 1], [t, -1], [1, t], [-1, t]]) { const a = P(u * 0.995, v * 0.995), b2 = P(u * 1.03, v * 1.03); if (a && b2) out.push([a, b2]); } }
      const c = P(0, 0); return { pts: out, centro: c }; })()`);
    const r = await p.evaluate(async ([a, b2, B]) => {
      const leer = async (s) => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height); };
      const A1 = await leer(a), A2 = await leer(b2), W = A1.width, H = A1.height;
      const dif = (x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return -1; const i = (y * W + x) * 4; return Math.max(Math.abs(A1.data[i] - A2.data[i]), Math.abs(A1.data[i + 1] - A2.data[i + 1]), Math.abs(A1.data[i + 2] - A2.data[i + 2])); };
      let borde = 0, n0 = 0; for (const [p1, p2] of B.pts) { for (const q of [p1, p2]) { const d = dif(q[0], q[1]); if (d >= 0) { borde = Math.max(borde, d); n0++; } } }
      return { borde, puntos: n0, centro: dif(B.centro[0], B.centro[1]) };
    }, [con, sin, bordes]);
    caso(`la grieta del cielo sin borde (${fr === 'tarde' ? 'de día' : 'de noche'}): con y sin la grieta, en el borde de su cuadrado la diferencia es ${r.borde}/255 en ${r.puntos} puntos (en el centro, ${r.centro})`, r.puntos > 20 && r.borde <= 2 && r.centro > 20, r);
  }
  // el barril violeta: el tinte por entidad (en la foto, el color del barril)
  await ev(`DEP.franjaPrueba = 'tarde'; depHora(); dibujoDespertar(); 1`); await p.waitForTimeout(900);
  const R0 = await ev(`(() => { const C = DEP.cajas.evento, b2 = C.o.b.pos, a = depProy(vadd(b2, v3(DEP.sx * C.L.ancho * 0.34, -C.L.alto * 0.36, -C.L.ancho * 0.5))); return a; })()`);
  const png = (await p.screenshot()).toString('base64');
  const hsv = await p.evaluate(async ([s, q]) => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(Math.round(q[0]) - 3, Math.round(q[1]) - 3, 6, 6).data; let r = 0, gg = 0, bb = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; } const n2 = d.length / 4; r /= n2; gg /= n2; bb /= n2;
    const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb), h = mx === mn ? 0 : mx === r ? 60 * (((gg - bb) / (mx - mn)) % 6) : mx === gg ? 60 * ((bb - r) / (mx - mn) + 2) : 60 * ((r - gg) / (mx - mn) + 4);
    return { rgb: [r, gg, bb].map(Math.round), tono: Math.round((h + 360) % 360), sat: +((mx - mn) / Math.max(1, mx)).toFixed(2) }; }, [png, R0]);
  caso(`el barril de la grieta, violeta con el tinte por entidad (tono ${hsv.tono}°, saturación ${hsv.sat})`, hsv.tono >= 245 && hsv.tono <= 300 && hsv.sat > 0.3, hsv);
  await A.ctx.close();
}
// ======================= 7. rendimiento =======================
if ((U34 || U33) && corre(7)) {
  // una corrida: el menú quieto, con el procesador 4× más lento; 6 s medidos
  const VERS = [['ahora', HTML], ['3.4', U34], ['3.3', U33]].filter((v) => v[1]);
  async function medir(url, gfx, quien) {
    const bb = await chromium.launch({ executablePath: CHROME, args: ARGS });
    const ctx = await bb.newContext({ viewport: { width: 873, height: 402 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
    await ctx.addInitScript((P) => { try { localStorage.setItem('jx_prefs', JSON.stringify(P)); } catch (e) {} }, Object.assign(PREFS0('es'), { dpVisto: { emotes: 999, pj: 999, mods: 999, ws: 9 }, dpAyuda: 1 }));
    const p = await ctx.newPage(); p.on('pageerror', (e) => { if (quien === 'ahora') errJS.push('rendimiento: ' + e.message.slice(0, 200)); });
    const ev = (s) => p.evaluate((x) => window.__ev(x), s);
    await p.goto(url + '?test&gfx=' + gfx); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
    await ev(`window.__menu30 = true; 1`);
    if (quien === 'ahora' || quien === 'npc') await listo(p, 60000);
    // (¿un NPC que baila lejos? obliga a dibujar todo el tiempo: se mide qué costaría, con el dibujo sin pausa)
    if (quien === 'npc') await ev(`(async () => { await rbAsegurar(rbDeSkin('Robot')); const x = DEP.O.x + 4.5, z = DEP.O.z + 9; npcCrear('Robot', v3(x, pisoBajo(v3(x, 30, z), 0), z), Math.PI + 0.4, { modo: 'bailar', emote: 'rb:Shuffle' }); depPausa = () => dibujoPausar(false); dibujoPausar(false); return 1; })()`);
    await p.waitForTimeout(3000);
    const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable'); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.waitForTimeout(2000);
    const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    await p.evaluate(() => { window.__raf = 0; const f = () => { window.__raf++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const traza = `${tmpdir()}/jx_dep_${process.pid}_${gfx}.json`;
    await bb.startTracing(p, { path: traza, categories: ['viz'] });
    const m0 = await met(), r0 = await p.evaluate(() => window.__raf), j0 = await ev('R.cuadro || 0'), t0 = Date.now();
    await p.waitForTimeout(6000);
    const m1 = await met(), r1 = await p.evaluate(() => window.__raf), j1 = await ev('R.cuadro || 0'), t1 = Date.now();
    await bb.stopTracing();
    const E = JSON.parse(readFileSync(traza, 'utf8')); const L = E.traceEvents || E; try { unlinkSync(traza); } catch (e) {}
    const s = (t1 - t0) / 1000, comp = L.filter((e) => e.name === 'Display::DrawAndSwap' && (e.ph === 'X' || e.ph === 'B')).length;
    await bb.close();
    const hilo = (m1.TaskDuration - m0.TaskDuration) * 1000 / s, js = (m1.ScriptDuration - m0.ScriptDuration) * 1000 / s, cuad = (r1 - r0) / s;
    return { jsMsPorSeg: js, hiloMsPorSeg: hilo, jsMsPorCuadro: js / Math.max(1, cuad), hiloMsPorCuadro: hilo / Math.max(1, cuad), cuadrosPagina: cuad, dibujos3D: (j1 - j0) / s, gpuCuadrosPorSeg: comp / (s + 0.5), heapMB: m1.JSHeapUsedSize / 1048576 };
  }
  // el tiempo hasta que el menú se puede tocar: desde que arranca la página hasta que el botón principal está a la vista, la
  // pantalla de carga se fue y el hilo principal contesta (un setTimeout 0); también la tarea más larga de los 4 s siguientes
  async function tocable(url, gfx, quien) {
    const bb = await chromium.launch({ executablePath: CHROME, args: ARGS });
    const ctx = await bb.newContext({ viewport: { width: 873, height: 402 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
    await ctx.addInitScript((P) => { try { localStorage.setItem('jx_prefs', JSON.stringify(P)); } catch (e) {} }, Object.assign(PREFS0('es'), { dpVisto: { emotes: 999, pj: 999, mods: 999, ws: 9 }, dpAyuda: 1 }));
    await ctx.addInitScript(() => {
      window.__toc = null; window.__largas = [];
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__largas.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
      const mira = () => {
        const j = document.querySelector('#rbInicio .dpJugar, #rbInicio .ptJugar, #rbInicio .rbIt.rbPri'), c = document.getElementById('carga'), ri = document.getElementById('rbInicio');
        if (j && j.offsetWidth > 0 && ri && !ri.classList.contains('oc') && (!c || c.classList.contains('oc') || c.classList.contains('salir'))) { setTimeout(() => { window.__toc = performance.now(); }, 0); return; }
        requestAnimationFrame(mira);
      };
      requestAnimationFrame(mira);
    });
    const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.goto(url + '?test&perezoso&gfx=' + gfx);
    await p.waitForFunction(() => window.__toc, null, { timeout: 300000 });
    await p.waitForTimeout(4000);
    const r = await p.evaluate(() => ({ toc: window.__toc, larga: Math.max(0, ...window.__largas.filter((x) => x[0] >= window.__toc - 1).map((x) => x[1])) }));
    await bb.close(); return r;
  }
  const K = ['jsMsPorCuadro', 'hiloMsPorCuadro', 'jsMsPorSeg', 'hiloMsPorSeg', 'cuadrosPagina', 'dibujos3D', 'gpuCuadrosPorSeg', 'heapMB'];
  // (con Gráficos medios, además: el depósito con un NPC bailando a lo lejos, para saber si vale la pena)
  const NPC = await medir(HTML, 'medio', 'npc');
  console.log('depósito con un NPC bailando (Gráficos medios, sin la pausa del dibujo): ' + K.map((c) => `${c} ${NPC[c].toFixed(2)}`).join(' · '));
  const N = +(process.env.CORRIDAS || 2);
  const TT = {};
  for (const gfx of ['bajo', 'medio', 'alto']) {
    const R = {}; for (const [k] of VERS) R[k] = [];
    for (let i = 0; i < N; i++) { const orden = i % 2 ? VERS.slice().reverse() : VERS; for (const [k, u] of orden) R[k].push(await medir(u, gfx, k)); }
    const prom = (k, c) => R[k].reduce((a, x) => a + x[c], 0) / R[k].length, P = {};
    for (const c of K) { P[c] = {}; for (const [k] of VERS) P[c][k] = +prom(k, c).toFixed(2); }
    console.log(`rendimiento (Gráficos ${gfx}, procesador 4× más lento, 873×402 a 2×, el menú quieto, promedio de ${N} corridas alternadas):\n` + K.map((c) => `  ${c.padEnd(17)} ` + VERS.map(([k]) => `${k} ${String(P[c][k]).padStart(8)}`).join('   ')).join('\n'));
    if (U34) {
      const ok = P.jsMsPorSeg.ahora < P.jsMsPorSeg['3.4'] && P.hiloMsPorSeg.ahora < P.hiloMsPorSeg['3.4'] && P.gpuCuadrosPorSeg.ahora <= P.gpuCuadrosPorSeg['3.4'] + 0.05 && P.hiloMsPorCuadro.ahora < P.hiloMsPorCuadro['3.4'];
      caso(`rendimiento con Gráficos ${gfx}: con el 3D congelado cuesta menos que la portada 3.4 (JS y hilo principal por segundo y por cuadro, cuadros de la GPU)`, ok, P);
    }
    // el tiempo hasta poder tocar (alternado)
    const T0 = {}; for (const [k] of VERS) T0[k] = [];
    for (let i = 0; i < N; i++) { const orden = i % 2 ? VERS.slice().reverse() : VERS; for (const [k, u] of orden) T0[k].push(await tocable(u, gfx, k)); }
    const pt = (k, c) => T0[k].reduce((a, x) => a + x[c], 0) / T0[k].length; TT[gfx] = {};
    for (const [k] of VERS) TT[gfx][k] = { tocable: Math.round(pt(k, 'toc')), tareaLarga: Math.round(pt(k, 'larga')) };
    console.log(`  hasta poder tocar (ms desde que arranca la página) y la tarea más larga después: ` + VERS.map(([k]) => `${k} ${TT[gfx][k].tocable} (${TT[gfx][k].tareaLarga})`).join('   '));
    if (U34) caso(`tiempo hasta poder tocar con Gráficos ${gfx}: no empeora más de un 10 % contra la 3.4 (${TT[gfx].ahora.tocable} contra ${TT[gfx]['3.4'].tocable} ms)`, TT[gfx].ahora.tocable <= TT[gfx]['3.4'].tocable * 1.1, TT[gfx]);
  }
}
caso('sin errores de JS', !errJS.length, errJS.slice(0, 6));
await b.close();
const fallas = RES.filter((x) => !x).length;
console.log(fallas ? `${fallas} FALLAS de ${RES.length}` : `todo OK (${RES.length})`);
process.exit(fallas ? 1 : 0);
