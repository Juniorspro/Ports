// La portada nueva del menú principal (juego/portada.js; pedido del dueño: «hagamos una interfaz nueva así… mejores
// botones con diseño en los botones»). Lo que se mide:
//  1. no se pierde nada: cada cosa que se podía hacer desde el menú principal anterior (la lista, los botones de abajo y lo
//     de sus paneles) se alcanza tocándola en la portada, en las mismas pantallas o menos (la tabla de abajo dice cuántas
//     antes y cuántas ahora), y al volver de cada panel la portada queda como estaba (con tu personaje en el escenario);
//  2. en el celular (873×393, 640×360, 800×368 y parado 393×873, que el juego gira), una tablet (1180×820) y la compu
//     (1280×720 y 1920×1080): todo lo que se toca mide 40 px o más, está entero adentro de la pantalla, nada se pisa (ni
//     con la versión, el cartel ni el escenario), las letras miden 12 px o más, ningún texto se corta y el contraste del
//     texto con lo que tiene atrás (medido en la imagen, con el texto escondido) es ≥ 4,5; con una muesca de 44 px a los
//     costados nada queda debajo de ella;
//  3. en los 14 idiomas (en el celular chico y en el común) lo mismo; en árabe, todo espejado (el perfil a la derecha y
//     JUGAR a la izquierda) y sin espacio entre letras (se cortaría la escritura ligada);
//  4. el teclado (Tab, flechas, Enter) y un mando (cruceta y A) recorren la portada y eligen;
//  5. los botones tienen sus estados: con el mouse encima, apretado y con el foco cada uno se ve distinto al normal;
//  6. rendimiento (con URL_ANTES): en un celular flojo emulado (procesador 4× más lento, Gráficos bajos, 873×393 a 2×) la
//     portada no cuesta más que el menú anterior: cuadros por segundo del juego y de la página, ms de JavaScript por cuadro,
//     tiempo del hilo principal por segundo y cuadros que compone la GPU por segundo (traza de Chrome), alternando corridas;
//     con Gráficos medios (el personaje animado) se informa;
//  7. sin errores de JS.
// uso: node menu_nuevo.mjs URL_HTML [URL_ANTES] [CARPETA_FOTOS]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import { readFileSync, mkdirSync, unlinkSync } from 'fs'; import { tmpdir } from 'os';
const [, , HTML, ANTES = '', DIR = '.'] = process.argv, D = DIR.replace(/\/$/, '') + '/';
try { mkdirSync(D, { recursive: true }); } catch (e) {}
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + (info === undefined ? '' : ' · ' + JSON.stringify(info).slice(0, 1400))); return ok; };
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ARGS });
const errJS = [];
// (SOLO=2,3: sólo esas partes, para revisar más rápido)
const SOLO = (process.env.SOLO || '').split(',').filter(Boolean), corre = (n) => !SOLO.length || SOLO.includes(String(n));
const IDIOMAS = ['es', 'en', 'pt', 'id', 'ms', 'fil', 'ja', 'th', 'tr', 'ar', 'ru', 'uk', 'fr', 'de'];
async function abrir(nom, w, h, movil, o = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: o.dpr || 1, isMobile: movil, hasTouch: movil, locale: 'es-AR' });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: o.google ? '{"google":true,"cliente":"x.apps.googleusercontent.com"}' : '{"google":false}' }));
  if (o.antes) await ctx.addInitScript(o.antes);
  const p = await ctx.newPage(); p.on('pageerror', (e) => errJS.push(nom + ': ' + e.message.slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|WebSocket|mqtt|ERR_NAME/i.test(m.text())) errJS.push(nom + ' consola: ' + m.text().slice(0, 200)); });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await p.goto((o.url || HTML) + '?test' + (o.q || '')); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.nombre = 'NijulaX'; idiomaAplicar('${o.lang || 'es'}'); guardarPrefs(); ${o.url ? '' : 'RB.mapa = "Desert"; RB.mapaCom = null;'} inicioMostrar(true); 1`);
  await p.waitForTimeout(o.espera || 1600);
  return { ctx, p, ev };
}
const esperar = async (p, js, ms = 8000) => { try { await p.waitForFunction((x) => window.__ev(x), js, { timeout: ms }); return true; } catch (e) { return false; } };
// ---------------- las medidas de la portada (en px de la página; con el juego girado, en las del juego) ----------------
const MEDIR = `(() => {
  const U = PTD.ui, rot = typeof PANT !== 'undefined' && PANT.rot, W = VW(), H = VH();
  // (con el juego girado, getBoundingClientRect da la pantalla girada: se mide con offsetLeft/Top, como el juego)
  const rr = (e) => { if (!rot) { const q = e.getBoundingClientRect(); return { x0: q.left, y0: q.top, x1: q.right, y1: q.bottom }; } const r = ptdRect(e); return { x0: r.x, y0: r.y, x1: r.r, y1: r.b }; };
  const vis = (e) => e.offsetWidth > 0 && e.offsetHeight > 0 && !e.closest('.oc') && getComputedStyle(e).visibility !== 'hidden';
  const nom = (e) => (e.dataset.rb || e.className.baseVal || e.className || e.tagName) + (e.title ? '「' + e.title.slice(0, 18) + '」' : '');
  const toc = [...U.querySelectorAll('button, label.ptNomL')].filter(vis).map((e) => ({ k: nom(e), ...rr(e) }));
  toc.push({ k: 'escenario', ...rr(PTD.esc) });
  const fijos = [...U.querySelectorAll('.ptVer, .ptCartel, .ptLogo')].filter(vis).map((e) => ({ k: nom(e), ...rr(e) }));
  const txt = [];
  for (const e of U.querySelectorAll('*')) {
    if (!vis(e)) continue;
    const t = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!t && e.id !== 'rbNombre') continue;
    const c = getComputedStyle(e);
    // (¿se corta? lo de él o lo de la caja que lo recorta)
    let caja = e, corta = false; for (let i = 0; i < 3 && caja && caja !== U; i++, caja = caja.parentElement) { const cc = getComputedStyle(caja);
      if (/hidden|clip/.test(cc.overflowX) && caja.scrollWidth > caja.clientWidth + 1) corta = true;
      if (/hidden|clip/.test(cc.overflowY) && caja.scrollHeight > caja.clientHeight + 3) corta = true; }
    // (y que no se salga del botón donde está: un texto en dos renglones no puede asomar por abajo)
    const bt = e.closest('button, .ptCartel, .ptVer'), R0 = rr(e), RB0 = bt && bt !== e ? rr(bt) : null;
    if (RB0 && (R0.x0 < RB0.x0 - 2 || R0.x1 > RB0.x1 + 2 || R0.y0 < RB0.y0 - 2 || R0.y1 > RB0.y1 + 2)) corta = true;
    txt.push({ k: nom(e), t: (t || e.value).slice(0, 30), f: parseFloat(c.fontSize), corta, ls: c.letterSpacing, ...R0 });
  }
  const izq = rr(U.querySelector('.ptPerfil')), jug = rr(U.querySelector('.ptJugar'));
  return { W, H, rot, rtl: RB.el.dir === 'rtl', toc, fijos, txt, perfil: izq, jugar: jug, esc: rr(PTD.esc), enc: MENU.encuadre ? { px: MENU.encuadre.px, pies: MENU.encuadre.pies } : null, lobby: !!MENU.lobby, caja: MENU.caja === PTD.esc };
})()`;
function revisar(M, nom, inset = { l: 0, r: 0, t: 0, b: 0 }) {
  const probs = [], pisa = (a, b, m = 0) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > m && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > m;
  for (const e of M.toc) {
    if (Math.min(e.x1 - e.x0, e.y1 - e.y0) < 39.5) probs.push(`${e.k} chico ${Math.round(e.x1 - e.x0)}×${Math.round(e.y1 - e.y0)}`);
    if (e.x0 < inset.l - 0.5 || e.y0 < inset.t - 0.5 || e.x1 > M.W - inset.r + 0.5 || e.y1 > M.H - inset.b + 0.5) probs.push(`${e.k} afuera [${[e.x0, e.y0, e.x1, e.y1].map(Math.round)}]`);
  }
  for (let i = 0; i < M.toc.length; i++) for (let j = i + 1; j < M.toc.length; j++) if (pisa(M.toc[i], M.toc[j], 1)) probs.push(`${M.toc[i].k} × ${M.toc[j].k}`);
  for (const f of M.fijos) { for (const e of M.toc) if (pisa(f, e, 1)) probs.push(`${f.k} × ${e.k}`); if (f.x0 < inset.l - 0.5 || f.x1 > M.W - inset.r + 0.5 || f.y1 > M.H + 0.5) probs.push(`${f.k} afuera`); }
  for (const t of M.txt) { if (t.f < 11.95) probs.push(`letra ${t.f}px «${t.t}»`); if (t.corta) probs.push(`cortado «${t.t}» (${t.k})`); }
  if (!M.lobby || !M.caja) probs.push('sin el personaje en el escenario');
  // (el personaje: grande —casi tres cuartos del alto en el celular— y con su hueco para tocarlo y girarlo)
  if (!M.enc || M.enc.px < M.H * 0.45) probs.push('personaje chico ' + (M.enc && M.enc.px));
  return probs;
}
// el contraste medido en la imagen: se esconde el texto, se saca la foto y, debajo de cada texto, el 5 % de los puntos que
// menos contrastan con su color tiene que dar ≥ 4,5
const TEXTOS = `(() => { const U = PTD.ui, out = [];
  for (const e of U.querySelectorAll('*')) { if (!(e.offsetWidth > 0) || e.closest('.oc') || getComputedStyle(e).visibility === 'hidden') continue;
    const t = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(); if (!t && e.id !== 'rbNombre') continue;
    const q = e.getBoundingClientRect(), c = getComputedStyle(e).color.match(/[\\d.]+/g).map(Number);
    out.push({ t: (t || e.value).slice(0, 24), x: q.left, y: q.top, w: q.width, h: q.height, c }); }
  return out; })()`;
async function contraste(p, ev) {
  const T = await ev(TEXTOS);
  await ev(`(() => { const s = document.createElement('style'); s.id = 'sinTexto'; s.textContent = '#rbInicio .ptHome, #rbInicio .ptHome *{color:transparent!important;-webkit-text-fill-color:transparent!important;caret-color:transparent!important}'; document.head.appendChild(s); return 1; })()`);
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
      cs.sort((a, b) => a - b); return { t: t.t, c: +cs[Math.floor(cs.length * 0.05)].toFixed(2) };
    });
  }, [png, T]);
}
// ======================= 1. inventario: todo lo de antes se alcanza =======================
if (corre(1)) {
  const A = await abrir('inventario', 873, 393, true, { antes: () => {
    window.__abierto = []; window.open = (u) => { window.__abierto.push(String(u)); return null; };
    window.JXNativo = { buscarActualizacion() { window.__busco = (window.__busco || 0) + 1; }, salir() { window.__salio = 1; } };
  } });
  const { p, ev } = A;
  // [qué era, cómo se llega ahora (lo que se toca), qué tiene que pasar, pantallas antes, pantallas ahora]
  const INV = [
    ['Empezar partida nueva (mapa, hora y modo)', ['.ptModo'], `RB.panel === 'nueva' && !!document.querySelector('.rbPan_nueva [data-rb=empezar]') && !!document.getElementById('rbHora')`, 1, 1],
    ['Multijugador: la lista de servers', ['.ptMulti'], `RB.panel === 'multi' && !!document.getElementById('mpLista')`, 1, 1],
    ['Multijugador: crear un server', ['.ptMas'], `RB.panel === 'mcrear'`, 2, 1],
    ['Multijugador: red local', ['.ptMulti', '.rbPan [data-rb=lan]'], `RB.panel === 'lan'`, 2, 2],
    ['Social: amigos y solicitudes', ['.ptAmigos'], `RB.panel === 'social' && SOC.tab === 'amigos'`, 2, 1],
    ['Social: chats', ['.ptChats'], `RB.panel === 'social' && SOC.tab === 'chats'`, 1, 1],
    ['Mods y mapas (la tienda)', ['.ptTabs [data-rb=tienda]'], `RB.panel === 'tienda' && !!document.querySelector('.rbPan_tienda .tiTabs')`, 1, 1],
    ['Los mods instalados (el botón «N mods activos»)', ['[data-rb=ptMods]'], `RB.panel === 'tienda' && RB.t.tab === 'mod' && RB.t.vista === 'instalados'`, 2, 1],
    ['Workshop de GMod', ['.ptWs'], `RB.panel === 'tienda' && RB.t.tab === 'gmod' && RB.t.vista === 'explorar'`, 2, 1],
    ['Addons de GMod instalados', ['[data-rb=ptGm]'], `RB.panel === 'tienda' && RB.t.tab === 'gmod' && RB.t.vista === 'instalados'`, 3, 1],
    ['Emotes', ['.ptEmo'], `RB.panel === 'tienda' && RB.t.tab === 'anim'`, 2, 1],
    ['Crear un mapa', ['.ptTabs [data-rb=crear]'], `RB.panel === 'crear'`, 1, 1],
    ['Personajes (la pestaña)', ['.ptTabs [data-rb=personajes]'], `RB.panel === 'personajes' && MENU.caja && MENU.caja.classList.contains('pjEscena')`, 1, 1],
    ['Personajes (tu foto del perfil)', ['.ptAvatar'], `RB.panel === 'personajes'`, 1, 1],
    ['Personajes (tocar tu personaje)', ['.ptEscena'], `RB.panel === 'personajes'`, 1, 1],
    ['Opciones (Ajustes)', ['[data-rb=opciones]'], `!document.getElementById('ajustes').classList.contains('oc')`, 1, 1],
    ['Idioma', ['.ptIdiB'], `RB.panel === 'bienvenida' && !!document.querySelector('.rbIdiomas')`, 1, 1],
    ['Tutorial (antes: Opciones → Controles y audio → Tutorial)', ['[data-rb=ptTut]'], `window.__tut === 1`, 3, 1],
    ['Evento de la grieta (antes: Opciones → Renderizado → interruptor)', ['.ptEvento'], `PREFS.evento === false`, 3, 1],
    ['Discord', ['.ptRed[title=Discord]'], `window.__abierto.some((u) => /discord/.test(u))`, 1, 1],
    ['TikTok', ['.ptRed[title=TikTok]'], `window.__abierto.some((u) => /tiktok/.test(u))`, 1, 1],
    ['Actualizar (en la app: buscar una versión nueva)', ['.ptAct'], `window.__busco === 1`, 0, 1],
    ['Salir', ['.ptSalir'], `window.__salio === 1`, 1, 1],
  ];
  // (el tutorial empieza una partida: acá sólo se mira que se llame)
  await ev(`tutAbrir = () => { window.__tut = 1; }; 1`);
  const tabla = [];
  for (const [que, toques, ok, n0, n1] of INV) {
    await ev(`inicioMostrar(true); if (RB.panel) inicioAccion('volver'); cerrarPaneles(); UI.abierto = null; PREFS.evento = true; ptdEvento(); 1`); await p.waitForTimeout(250);
    let det = '';
    for (const [i, s] of toques.entries()) {
      // (lo primero que se toca, en la portada: tiene que estar a la vista, entero y sin nada encima)
      if (i === 0) det = await ev(`(() => { const e = PTD.ui.querySelector(${JSON.stringify(s)}) || (PTD.esc.matches(${JSON.stringify(s)}) ? PTD.esc : null); if (!e) return 'no está'; const q = e.getBoundingClientRect(), cx = q.left + q.width / 2, cy = q.top + q.height / 2, en = document.elementFromPoint(cx, cy);
        return q.width < 40 || q.height < 40 ? 'chico' : q.left < 0 || q.top < 0 || q.right > innerWidth || q.bottom > innerHeight ? 'afuera' : !(en && (e === en || e.contains(en))) ? 'tapado por ' + (en && en.className) : ''; })()`);
      try { await p.tap(s, { timeout: 4000 }); } catch (e) { det += ' no se pudo tocar ' + s; }
      await p.waitForTimeout(450);
    }
    const llego = await esperar(p, ok, 4000);
    // (y al volver, la portada como estaba: con tu personaje en su escenario)
    await ev(`if (RB.panel) inicioAccion('volver'); cerrarPaneles(); UI.abierto = null; 1`); await p.waitForTimeout(300);
    const vuelve = await ev(`ptdVisible() && MENU.caja === PTD.esc && !!MENU.lobby && !RB.el.classList.contains('rb3d')`);
    tabla.push({ que, antes: n0, ahora: n1, ok: llego && !det && vuelve });
    caso(`inventario: ${que} (${n0 || '—'} → ${n1} ${n1 === 1 ? 'toque' : 'toques'})`, llego && !det && vuelve && n1 <= Math.max(n0, 1), { llego, det, vuelve });
  }
  // tu nombre: se escribe en la portada
  await p.tap('#rbNombre', { timeout: 5000 }); await p.fill('#rbNombre', 'Nuevo Nombre'); await p.waitForTimeout(200);
  caso('inventario: tu nombre se escribe en el perfil y se guarda', await ev(`PREFS.nombre === 'Nuevo Nombre'`), await ev('PREFS.nombre'));
  await ev(`PREFS.nombre = 'NijulaX'; inicioLista(); 1`);
  // la versión, siempre a la vista
  const ver = await ev(`(() => { const v = PTD.ui.querySelector('.ptVer'); return { t: v.textContent, title: v.title, ok: v.textContent.includes(JX_VERSION) && v.title.includes(ARMADO_RB) }; })()`);
  caso('inventario: la versión (y el día del armado en el globito)', ver.ok, ver);
  // Actualizar en la web: si aparece el botón de codigo_web.mjs, va en la columna de la derecha y el suelto se esconde
  await ev(`delete window.JXNativo; ptdActualizarVer(); 1`); await p.waitForTimeout(100);
  const sinAct = await ev(`PTD.ui.querySelector('.ptAct').classList.contains('oc')`);
  await ev(`(() => { const b = document.createElement('button'); b.id = 'jxAct'; b.textContent = 'Actualizar'; b.setAttribute('style', 'position:fixed;z-index:2147483647;right:12px;bottom:12px'); b.onclick = () => { window.__web = 1; }; document.body.appendChild(b); return 1; })()`);
  await p.waitForTimeout(300);
  const web = await ev(`({ ve: !PTD.ui.querySelector('.ptAct').classList.contains('oc'), hay: PTD.ui.querySelector('.ptAct').classList.contains('ptHay'), suelto: getComputedStyle(document.getElementById('jxAct')).display })`);
  await p.tap('.ptAct', { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(200);
  web.clic = await ev('window.__web === 1');
  caso('inventario: Actualizar en la web (sólo si hay versión nueva; el botón suelto de abajo a la derecha no tapa JUGAR)', sinAct && web.ve && web.hay && web.suelto === 'none' && web.clic, { sinAct, ...web });
  await ev(`document.getElementById('jxAct').remove(), 1`);
  // JUGAR: entra directo al mapa elegido (antes: Empezar partida nueva → Empezar)
  await ev(`RB.mapa = 'FlatGrass'; RB.mapaCom = null; ptdMapa(); 1`);
  const mapaTxt = await ev(`PTD.ui.querySelector('.ptModoN').textContent === mapaNom('FlatGrass')`);
  await p.tap('.ptJugar', { timeout: 5000 }).catch(() => {});
  const jugo = await esperar(p, `JUEGO.estado === 'juego' && MUNDO.nombre === 'FlatGrass' && !rbVisible()`, 20000);
  caso('inventario: JUGAR entra al mapa elegido (el de la tarjeta de arriba) en un toque (antes, dos)', mapaTxt && jugo, { mapaTxt, jugo, estado: await ev('JUEGO.estado + " " + MUNDO.nombre') });
  // y al salir de la partida al menú vuelve la portada con el personaje
  await ev(`irMenuPrincipal(); 1`);
  const otra = await esperar(p, `JUEGO.estado === 'principal' && ptdVisible() && MENU.caja === PTD.esc && !!MENU.lobby`, 10000);
  caso('al salir de la partida, la portada vuelve con tu personaje', otra, await ev(`({ e: JUEGO.estado, v: ptdVisible() })`));
  console.log('inventario (pantallas antes → ahora):\n' + tabla.map((t) => `  ${t.ok ? '✓' : '✗'} ${t.que}: ${t.antes || '—'} → ${t.ahora}`).join('\n'));
  await A.ctx.close();
  // la cuenta de Google (cuando la tienda la tiene prendida): el botón está en el perfil
  const G = await abrir('cuenta', 873, 393, true, { google: true });
  await esperar(G.p, `!!PTD.ui.querySelector('.cuChip')`, 8000);
  // (con la cuenta prendida y sin sesión, al abrir aparece solo el cartel para entrar: se cierra y se busca el botón)
  await G.p.waitForTimeout(1500); await G.ev(`cuDialogoCerrar(), 1`); await G.p.waitForTimeout(200);
  const cu = await G.ev(`(() => { const c = PTD.ui.querySelector('.cuChip'); return c ? { en: !!c.closest('.ptPerfil'), q: c.getBoundingClientRect().height } : null; })()`);
  if (cu) { await G.p.tap('.cuChip', { timeout: 5000 }).catch(() => {}); await G.p.waitForTimeout(400); }
  const dlg = await G.ev(`!!document.querySelector('#cuDlg:not(.oc)')`);
  caso('inventario: la cuenta de Google (en el perfil) abre su cartel', !!cu && cu.en && cu.q >= 40 && dlg, { cu, dlg });
  const M = await G.ev(MEDIR); const pr = revisar(M, 'cuenta');
  caso('con la cuenta en el perfil, la portada sigue sin pisarse', !pr.length, pr.slice(0, 8));
  await G.p.screenshot({ path: D + 'despues_cuenta_celu.png' });
  await G.ctx.close();
}
// ======================= 2. pantallas =======================
const PANT = [['celu_873x393', 873, 393, true], ['celu_chico_640x360', 640, 360, true], ['celu_usuario_800x368', 800, 368, true], ['celu_parado_393x873', 393, 873, true],
  ['tablet_1180x820', 1180, 820, true], ['compu_1280x720', 1280, 720, false], ['compu_1920x1080', 1920, 1080, false]];
if (corre(2)) for (const [nom, w, h, movil] of PANT) {
  const A = await abrir(nom, w, h, movil);
  const M = await A.ev(MEDIR), pr = revisar(M, nom);
  caso(`${nom}: todo ≥ 40 px, adentro, sin pisarse, letra ≥ 12, nada cortado, personaje grande (${M.enc && M.enc.px} px de ${M.H})`, !pr.length, pr.slice(0, 10));
  if (!M.rot) {
    const C = await contraste(A.p, A.ev), malos = C.filter((x) => x.c < 4.5);
    caso(`${nom}: contraste ≥ 4,5 en los ${C.length} textos (el peor ${Math.min(...C.map((x) => x.c))})`, !malos.length, malos.slice(0, 6));
  }
  await A.p.screenshot({ path: D + 'despues_' + nom + '.png' });
  if (nom === 'celu_873x393') {
    // la muesca: 44 px a cada costado (como un celular con cámara en la pantalla, acostado)
    const cdp = await A.ctx.newCDPSession(A.p); let emul = true;
    try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: 44, right: 44, top: 0, bottom: 0 } }); } catch (e) { emul = false; await A.ev(`PTD.el.style.setProperty('--sl', '44px'); PTD.el.style.setProperty('--sr', '44px'); 1`); }
    await A.p.waitForTimeout(300); await A.ev('ptdEncajar(), 1'); await A.p.waitForTimeout(200);
    const N = await A.ev(MEDIR), pn = revisar(N, 'muesca', { l: 44, r: 44, t: 0, b: 0 });
    caso(`muesca de 44 px a los costados (${emul ? 'env(safe-area-inset-*) emulado' : 'variables'}): nada debajo de ella`, !pn.length, pn.slice(0, 8));
    await A.p.screenshot({ path: D + 'despues_celu_muesca.png' });
  }
  await A.ctx.close();
}
// ======================= 3. idiomas =======================
if (corre(3)) for (const [nom, w, h] of [['640x360', 640, 360], ['873x393', 873, 393]]) {
  const A = await abrir('idiomas ' + nom, w, h, true);
  for (const l of IDIOMAS) {
    await A.ev(`idiomaAplicar('${l}'); inicioLista(); 1`); await A.p.waitForTimeout(350);
    const M = await A.ev(MEDIR), pr = revisar(M, l);
    if (l === 'ar') {
      if (!M.rtl || !(M.perfil.x0 > M.W / 2) || !(M.jugar.x1 < M.W / 2)) pr.push('árabe sin espejar');
      for (const t of M.txt) if (t.ls !== 'normal' && parseFloat(t.ls) !== 0) { pr.push('espacio entre letras en árabe: ' + t.t); break; }
    }
    caso(`idioma ${l} en ${nom}: nada se sale, se corta ni se pisa`, !pr.length, pr.slice(0, 8));
    if (['de', 'ar', 'ru', 'fil'].includes(l)) await A.p.screenshot({ path: D + `despues_${l}_${nom}.png` });
  }
  await A.ctx.close();
}
// ======================= 4. teclado y mando =======================
if (corre(4)) {
  const A = await abrir('teclado', 1280, 720, false, { antes: () => {
    window.__pad = null; const real = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : () => [];
    navigator.getGamepads = () => (window.__pad ? [window.__pad] : real());
  } });
  const { p, ev } = A, foco = () => ev(`(() => { const a = document.activeElement; return a === PTD.esc ? 'escenario' : a && PTD.ui.contains(a) ? (a.dataset.rb || a.id || a.className) : null; })()`);
  await p.keyboard.press('Tab'); const f1 = await foco();
  await p.keyboard.press('Escape'); await ev(`document.activeElement && document.activeElement.blur(), 1`);
  await p.keyboard.press('ArrowDown'); const f2 = await foco();   // (sin foco: la primera flecha va a JUGAR)
  await p.keyboard.press('ArrowUp'); const f3 = await foco();
  const camino = [f2, f3]; for (let i = 0; i < 6; i++) { await p.keyboard.press('ArrowLeft'); camino.push(await foco()); }
  for (let i = 0; i < 3; i++) { await p.keyboard.press('ArrowUp'); camino.push(await foco()); }
  const llegaIzq = camino.some((k) => /ptWs|ptEmo|multi|ptEvento/.test(k || ''));
  // ir a Multijugador con las flechas y elegirlo con Enter
  await ev(`PTD.ui.querySelector('.ptMulti').focus(), 1`); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  const enter = await ev(`RB.panel === 'multi'`);
  caso('teclado: Tab entra a la portada, las flechas recorren (de JUGAR al mapa y a las tarjetas) y Enter elige', !!f1 && f2 === 'jugar' && f3 === 'nueva' && llegaIzq && enter, { f1, camino, enter });
  await ev(`inicioAccion('volver'), 1`); await p.waitForTimeout(300);
  // el mando: cruceta arriba (del JUGAR al mapa elegido) y A
  const boton = (n) => Array.from({ length: 17 }, (_, i) => ({ pressed: i === n, value: i === n ? 1 : 0 }));
  await ev(`window.__pad = { id: 'prueba', index: 0, connected: true, axes: [0, 0, 0, 0], buttons: ${JSON.stringify(boton(-1))} }; PTD.ui.querySelector('.ptJugar').focus(); dispatchEvent(new Event('gamepadconnected')); 1`);
  await p.waitForTimeout(200);
  // (se aprieta, se espera a que el juego lo lea —el mando se lee en cada cuadro— y se suelta)
  const apretar = async (n, hasta) => { await ev(`window.__pad.buttons = ${JSON.stringify(boton(-1))}.map((x, i) => i === ${n} ? { pressed: true, value: 1 } : x); 1`); const ok = await esperar(p, hasta, 4000); await ev(`window.__pad.buttons = ${JSON.stringify(boton(-1))}; 1`); await p.waitForTimeout(200); return ok; };
  await apretar(12, `document.activeElement === PTD.ui.querySelector('.ptModo')`); const m1 = await foco();
  await apretar(0, `RB.panel === 'nueva'`); const m2 = await ev('RB.panel');
  await apretar(1, `RB.panel === null`); await p.waitForTimeout(200);
  const m3 = await ev(`RB.panel === null && ptdVisible()`);
  caso('mando: la cruceta mueve el foco, A elige y B vuelve a la portada', m1 === 'nueva' && m2 === 'nueva' && m3, { m1, m2, m3 });
  await ev(`window.__pad = null; 1`);
  // ======================= 5. estados de los botones =======================
  await ev(`if (RB.panel) inicioAccion('volver'); cerrarPaneles(); UI.abierto = null; 1`); await p.waitForTimeout(400);
  const ESTADOS = [['jugar', '.ptJugar'], ['tarjeta', '.ptMulti'], ['icono', '[data-rb=opciones]'], ['pestana', '.ptTabs [data-rb=crear]'], ['mapa', '.ptModo']];
  const recorte = async (s) => { const q = await ev(`(() => { const r = PTD.ui.querySelector(${JSON.stringify(s)}).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`); return { x: Math.max(0, q[0] - 10), y: Math.max(0, q[1] - 10), width: q[2] + 20, height: q[3] + 20 }; };
  const dif = (a, bb) => { let n = 0; for (let i = 0; i < Math.min(a.length, bb.length); i++) if (a[i] !== bb[i]) n++; return n / Math.max(a.length, 1); };
  const est = {};
  for (const [k, s] of ESTADOS) {
    await p.mouse.move(2, 360); await ev(`document.activeElement && document.activeElement.blur(), 1`); await p.waitForTimeout(150);
    const clip = await recorte(s), fotos = {};
    fotos.normal = await p.screenshot({ clip, path: D + `estado_${k}_normal.png` });
    const q = await ev(`(() => { const r = PTD.ui.querySelector(${JSON.stringify(s)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    await p.mouse.move(q[0], q[1]); await p.waitForTimeout(150); fotos.encima = await p.screenshot({ clip, path: D + `estado_${k}_encima.png` });
    // (apretado: se suelta afuera para que no haga nada)
    await p.mouse.down(); await p.waitForTimeout(120); fotos.apretado = await p.screenshot({ clip, path: D + `estado_${k}_apretado.png` });
    await p.mouse.move(2, 360); await p.mouse.up(); await p.waitForTimeout(100);
    await p.keyboard.press('Shift'); await ev(`PTD.ui.querySelector(${JSON.stringify(s)}).focus(), 1`); await p.waitForTimeout(150);
    fotos.foco = await p.screenshot({ clip, path: D + `estado_${k}_foco.png` });
    est[k] = { encima: +dif(fotos.normal, fotos.encima).toFixed(3), apretado: +dif(fotos.normal, fotos.apretado).toFixed(3), foco: +dif(fotos.normal, fotos.foco).toFixed(3) };
    if (await ev('!!RB.panel')) await ev(`inicioAccion('volver'), 1`);
  }
  caso('estados: con el mouse encima, apretado y con el foco, cada botón se ve distinto del normal', Object.values(est).every((e) => e.encima > 0.004 && e.apretado > 0.004 && e.foco > 0.004), est);
  await ev(`document.activeElement && document.activeElement.blur(), 1`);
  await A.ctx.close();
}
// ======================= 6. rendimiento =======================
if (ANTES && corre(6)) {
  // una corrida: la portada (o el menú anterior) quieta, con el procesador 4× más lento; 6 s medidos
  async function medir(url, gfx, quien) {
    const bb = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ARGS });
    const ctx = await bb.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
    const p = await ctx.newPage(); p.on('pageerror', (e) => { if (quien === 'después') errJS.push('rendimiento: ' + e.message.slice(0, 200)); });
    const ev = (s) => p.evaluate((x) => window.__ev(x), s);
    await p.goto(url + '?test&gfx=' + gfx); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
    // (__menu30: el tope de 30 cuadros del menú, como en un aparato de verdad; las pruebas no lo tienen)
    await ev(`window.__menu30 = true; PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.nombre = 'NijulaX'; idiomaAplicar('es'); guardarPrefs(); inicioMostrar(true); 1`);
    await p.waitForTimeout(4000);
    const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable'); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.waitForTimeout(2000);
    const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    await p.evaluate(() => { window.__raf = 0; const f = () => { window.__raf++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const traza = `${tmpdir()}/jx_traza_${process.pid}_${gfx}.json`;
    await bb.startTracing(p, { path: traza, categories: ['viz'] });
    const m0 = await met(), r0 = await p.evaluate(() => window.__raf), t0 = Date.now();
    // (los cuadros y los ms de JS por cuadro del juego los cuenta él mismo cada segundo: se toma uno por segundo y se promedia)
    const mu = []; for (let i = 0; i < 6; i++) { await p.waitForTimeout(1000); mu.push(await ev('({ fps: TIEMPO.fps, ms: TIEMPO.msProm })')); }
    const m1 = await met(), r1 = await p.evaluate(() => window.__raf), t1 = Date.now(), j = await ev('({ gfx: GFX.nombre, lento: typeof PTD !== "undefined" && !!PTD.lento })');
    j.fps = mu.reduce((a, x) => a + x.fps, 0) / mu.length; j.ms = mu.reduce((a, x) => a + x.ms, 0) / mu.length;
    await bb.stopTracing();
    const E = JSON.parse(readFileSync(traza, 'utf8')); const L = E.traceEvents || E; try { unlinkSync(traza); } catch (e) {}
    const s = (t1 - t0) / 1000, comp = L.filter((e) => e.name === 'Display::DrawAndSwap' && (e.ph === 'X' || e.ph === 'B')).length;
    await bb.close();
    const hilo = (m1.TaskDuration - m0.TaskDuration) * 1000 / s;
    return { fpsJuego: j.fps, fpsPagina: (r1 - r0) / s, msJS: j.ms, msHiloPorCuadro: hilo / Math.max(1, (r1 - r0) / s), hiloMsPorSeg: hilo, scriptMsPorSeg: (m1.ScriptDuration - m0.ScriptDuration) * 1000 / s, gpuCuadrosPorSeg: comp / (s + 0.5), gfx: j.gfx, lento: j.lento };
  }
  const K = ['fpsJuego', 'fpsPagina', 'msJS', 'msHiloPorCuadro', 'hiloMsPorSeg', 'scriptMsPorSeg', 'gpuCuadrosPorSeg'];
  for (const gfx of ['bajo', 'medio']) {
    const R = { antes: [], después: [] };
    const N = gfx === 'bajo' ? 3 : 2;
    for (let i = 0; i < N; i++) for (const [k, u] of i % 2 ? [['después', HTML], ['antes', ANTES]] : [['antes', ANTES], ['después', HTML]]) R[k].push(await medir(u, gfx, k));
    const prom = (k, c) => R[k].reduce((a, x) => a + x[c], 0) / R[k].length, P = {};
    for (const c of K) P[c] = { antes: +prom('antes', c).toFixed(2), después: +prom('después', c).toFixed(2) };
    console.log(`rendimiento (Gráficos ${gfx}, procesador 4× más lento, 873×393 a 2×, promedio de ${N} corridas alternadas):\n` + K.map((c) => `  ${c.padEnd(17)} antes ${String(P[c].antes).padStart(8)}   después ${String(P[c].después).padStart(8)}`).join('\n'));
    if (gfx === 'bajo') {
      // (los ms de JS del juego por cuadro, con 0,2 ms de margen por el ruido: la máquina de las pruebas es compartida)
      const ok = P.fpsJuego.después >= P.fpsJuego.antes - 1 && P.fpsPagina.después >= P.fpsPagina.antes - 2 && P.msJS.después <= P.msJS.antes * 1.1 + 0.2
        && P.msHiloPorCuadro.después <= P.msHiloPorCuadro.antes * 1.05 && P.hiloMsPorSeg.después <= P.hiloMsPorSeg.antes * 1.05 && P.gpuCuadrosPorSeg.después <= P.gpuCuadrosPorSeg.antes * 1.05;
      caso('rendimiento con Gráficos bajos: la portada no cuesta más que el menú anterior (cuadros, ms de JS, hilo principal y GPU)', ok, P);
    } else console.log('  (con Gráficos medios el personaje se anima: se informa; si el menú no llega a 24 cuadros por segundo, queda quieto solo —PTD.lento—; quedó ' + (R.después.some((x) => x.lento) ? 'quieto' : 'animado') + ')');
  }
}
caso('sin errores de JS', !errJS.length, errJS.slice(0, 6));
await b.close();
const fallas = RES.filter((x) => !x).length;
console.log(fallas ? `${fallas} FALLAS de ${RES.length}` : `todo OK (${RES.length})`);
process.exit(fallas ? 1 : 0);
