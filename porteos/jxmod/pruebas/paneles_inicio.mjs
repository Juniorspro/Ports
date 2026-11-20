// Los paneles del inicio con el lenguaje del menú clásico (3.7: juego/paneles.js y juego/paneles.css). El dueño, con capturas
// de su celular (873×402): «aún siguen blancas estas partes, y en otras muy pero muy junto y simple, sin decoración o
// animaciones. Me gustaría animaciones de verdad en los botones». Se mide, en cada panel que se abre desde el menú (Empezar
// partida nueva; Multijugador, Crear server y LAN; Social —Chats con una charla abierta, Amigos, Buscar con un resultado,
// Perfil y sin sesión—; Mods y mapas —Mods, la ficha, Mapas, Emotes, GMod, Crear un mod, Publicar—; Crear un mapa;
// Personajes —los tres—; Ajustes —sus pestañas, y con 6 y 7: una o dos de prueba, como la de Música que agrega otro
// módulo—; la bienvenida; La grieta; y los carteles: la clave de un server, la cuenta de Google con y sin sesión y
// preguntar):
//  1. pantallas (873×402 y 915×412 con 40 px de muesca, 800×368, 640×360, el celular parado —el juego lo gira—, tablet
//     1180×820, compu 1280×720 y 1920×1080): nada blanco (el fondo de cada placa con texto, oscuro); lo que se toca, 44 px o
//     más (salvo lo anotado: el botón de las tarjetas de Mods y mapas, 40); la letra, 14 px o más; nada cortado (los textos
//     de la interfaz enteros; lo que escribe la gente —nombres, mensajes— puede terminar en «…»); nada encimado; todo adentro
//     de la pantalla y fuera de la muesca; el contraste medido en la imagen (con el texto escondido, el 5 % de los puntos que
//     menos contrastan) ≥ 4,5;
//  2. los 14 idiomas en 873×402 (con muesca) y 640×360: lo mismo menos el contraste; el árabe, espejado;
//  3. animaciones: a los 1,2 s de abrir cada panel no corre nada (las animaciones de la página dentro de los paneles: CORREN,
//     como en menu_clasico.mjs; los esqueletos de una lista que carga, aparte: paran a los 4,5 s); hubo entrada (el rasgón,
//     la cascada) y se borró sola; al tocar, el golpe y la tinta; la marca de la pestaña se desliza y termina; los números
//     suben y queda el texto de verdad; con «menos movimiento» y con Gráficos Patata nada se mueve; con Bajos, sin rasgón,
//     cascada ni tinta;
//  4. rendimiento (con URL_36): los cuadros que compone la placa por segundo con el panel quieto (3 s después de abrirlo)
//     ≈ los de la 3.6; abrir cada panel (de la llamada al cuadro dibujado, con el procesador 4× más lento, corridas
//     alternadas) a lo sumo un 10 % más lento que en la 3.6; el heap no crece al abrir y cerrar cada panel 5 veces;
//  5. los dos menús de inicio: desde «Tu depósito» se abren los mismos paneles, con su entrada y la misma placa;
//  6. sin errores de JS.
// uso: node paneles_inicio.mjs URL_HTML [URL_36] [CARPETA_FOTOS]   (SOLO=1,2…: sólo esas partes; CORRIDAS=3)
import './cf_sockets.mjs';
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import { DatabaseSync } from 'node:sqlite'; import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'; import { tmpdir } from 'os';
const [, , HTML, U36 = '', DIR = ''] = process.argv, D = DIR ? DIR.replace(/\/$/, '') + '/' : '';
if (D) try { mkdirSync(D, { recursive: true }); } catch (e) {}
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + (info === undefined ? '' : ' · ' + JSON.stringify(info).slice(0, 2400))); return ok; };
const SOLO = (process.env.SOLO || '').split(',').filter(Boolean), corre = (n) => !SOLO.length || SOLO.includes(String(n));
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'];
const CHROME = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const FUERA = /Failed to load resource|net::ERR|WebSocket|mqtt|ERR_NAME|favicon/i;
const IDIOMAS = ['es', 'en', 'pt', 'id', 'ms', 'fil', 'ja', 'th', 'tr', 'ar', 'ru', 'uk', 'fr', 'de'];
const errJS = [];

// ---------------- la tienda de verdad (tienda/worker.js) con una base en memoria y sesiones de Google de mentira ----------------
const ROOT = new URL('../tienda/', import.meta.url).pathname, HOST = 'https://rezobox-tienda.holasoyjuniors365.workers.dev';
const db = new DatabaseSync(':memory:'); db.exec(readFileSync(ROOT + 'schema.sql', 'utf8'));
const st = (sql, a = []) => ({ bind: (...x) => st(sql, x), first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => ({ meta: { changes: db.prepare(sql).run(...a).changes } }), x() { const q = db.prepare(sql); return /^\s*select/i.test(sql) ? { results: q.all(...a) } : { meta: { changes: q.run(...a).changes } }; } });
const DB = { prepare: (s) => st(s), batch: async (L) => L.map((s) => s.x()) };
const CLIENTE = 'jx-prueba.apps.googleusercontent.com', env = { DB, GOOGLE_CLIENT_ID: CLIENTE, SAL: 'x' };
const par = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const pub = await crypto.subtle.exportKey('jwk', par.publicKey); Object.assign(pub, { kid: 'k1', alg: 'RS256', use: 'sig' });
const b64u = (b) => Buffer.from(b).toString('base64url');
async function token(o) { const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' })), ahora = Math.floor(Date.now() / 1000);
  const p = b64u(JSON.stringify(Object.assign({ iss: 'https://accounts.google.com', aud: CLIENTE, iat: ahora, exp: ahora + 3600 }, o)));
  const s = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', par.privateKey, new TextEncoder().encode(h + '.' + p)); return h + '.' + p + '.' + b64u(new Uint8Array(s)); }
const fetch0 = globalThis.fetch;
globalThis.fetch = async (u, o) => (String(u).startsWith('https://www.googleapis.com/oauth2/v3/certs') ? new Response(JSON.stringify({ keys: [pub] }), { headers: { 'Content-Type': 'application/json' } }) : fetch0(u, o));
const W = (await import(ROOT + 'worker.js')).default;
const llamar = async (ruta, o = {}) => { const r = await W.fetch(new Request(HOST + ruta, o), env, { waitUntil() {} }); let j = null; try { j = await r.clone().json(); } catch (er) {} return { st: r.status, j }; };
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function sesion(sub, nombre) {
  const v = b64u(crypto.getRandomValues(new Uint8Array(32))), e = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  await llamar('/api/cuenta/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: await token({ sub, name: nombre, nonce: e }), e }) });
  const l = await llamar('/api/cuenta/listo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v }) });
  return { token: l.j.token, u: l.j.usuario };
}
const api = (S, ruta, body) => llamar('/api/social/' + ruta, body === undefined ? { headers: { Authorization: 'Bearer ' + S.token } } : { method: 'POST', headers: { Authorization: 'Bearer ' + S.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const SA = await sesion('3001', 'NijulaX'), SB = await sesion('3002', 'Juancruz'), SC = await sesion('3003', 'Scaneger'), SD = await sesion('3004', 'Kris');
const pidDe = async (S) => (await api(S, 'yo')).j.perfil.pid;
const PA = await pidDe(SA), PB = await pidDe(SB), PC = await pidDe(SC), PD = await pidDe(SD);
await api(SA, 'amigo', { pid: PB, accion: 'pedir' }); await api(SB, 'amigo', { pid: PA, accion: 'aceptar' });
await api(SA, 'amigo', { pid: PC, accion: 'pedir' }); await api(SC, 'amigo', { pid: PA, accion: 'aceptar' });
await api(SD, 'amigo', { pid: PA, accion: 'pedir' });
{ const dm = (await api(SA, 'chat', { pid: PB })).j.id; for (const [S, t] of [[SB, 'che, ¿jugamos en Pradera?'], [SA, 'dale, armo un server'], [SB, 'traé los nextbots jaja'], [SA, 'listo, entrá que ya está']]) await api(S, 'chat/' + dm + '/enviar', { texto: t }); }
{ const gr = (await api(SA, 'grupo', { nombre: 'Los del Discord', pids: [PB, PC] })).j.id; await api(SC, 'chat/' + gr + '/enviar', { texto: 'mañana a las 6 todos' }); }

// ---------------- abrir el juego ----------------
const b = await chromium.launch({ executablePath: CHROME, args: ARGS });
const PREFS0 = (lang, extra) => Object.assign({ bienvenida: true, tutVisto: true, nombre: 'NijulaX', nombreOk: true, lang: lang || 'es', mapa: 'FlatGrass', dpVisto: { emotes: 999, pj: 999, mods: 999, ws: 9 }, dpAyuda: 1 }, extra || {});
async function rutear(ctx) {
  await ctx.route(HOST + '/**', async (route) => {
    const q = route.request(), hd = await q.allHeaders(); delete hd['content-length'];
    const r = await W.fetch(new Request(q.url(), { method: q.method(), headers: hd, body: ['GET', 'HEAD'].includes(q.method()) ? undefined : q.postDataBuffer() }), env, { waitUntil() {} });
    await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) });
  });
}
// o: { lang, ins (muesca a la izquierda), url, prefs, reducido, gfx, dpr, sinSesion, bb (otro navegador) }
async function abrir(nom, w, h, movil, o = {}) {
  const ctx = await (o.bb || b).newContext({ viewport: { width: w, height: h }, deviceScaleFactor: o.dpr || 1, isMobile: movil, hasTouch: movil, locale: 'es-AR', reducedMotion: o.reducido ? 'reduce' : 'no-preference' });
  await rutear(ctx);
  await ctx.addInitScript(([P, S]) => { try { if (!localStorage.getItem('jx_prefs')) localStorage.setItem('jx_prefs', JSON.stringify(P)); if (S && !localStorage.getItem('jx_cuenta')) localStorage.setItem('jx_cuenta', JSON.stringify(S)); } catch (e) {} }, [PREFS0(o.lang, o.prefs), o.sinSesion ? null : SA]);
  const p = await ctx.newPage(); const mios = [];
  p.on('pageerror', (e) => { const t = nom + ': ' + e.message.slice(0, 200); errJS.push(t); mios.push(t); });
  p.on('console', (m) => { if (m.type() === 'error' && !FUERA.test(m.text())) { const t = nom + ' consola: ' + m.text().slice(0, 200); errJS.push(t); mios.push(t); } });
  if (o.ins) { const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: o.ins, right: 0, top: 0, bottom: 0 } }); }
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await p.goto((o.url || HTML) + '?test' + (o.gfx ? '&gfx=' + o.gfx : '')); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
  await p.waitForFunction(() => window.__ev('JUEGO.estado === "principal" && !!RB.el && !!CU.conf'), null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(o.espera || 2000);
  // el fondo quieto en una escena (la misma en todas las fotos y mediciones)
  await ev(`(() => { clearInterval(RB.reloj); RB.reloj = 1; if (typeof CL !== 'undefined' && CL.tKen) clearInterval(CL.tKen); const c = RB.el.querySelectorAll('.rbBg'); if (FONDOS_RB.length) c[0].style.backgroundImage = 'url(' + FONDOS_RB[Math.min(2, FONDOS_RB.length - 1)] + ')'; c[0].classList.add('on'); c[1].classList.remove('on'); for (const x of c) { x.style.transition = 'none'; x.style.animation = 'none'; x.style.transform = 'scale(1.02)'; } return 1; })()`);
  return { ctx, p, ev, mios };
}
const esperar = async (p, js, ms = 8000) => { try { await p.waitForFunction((x) => window.__ev(x), js, { timeout: ms }); return true; } catch (e) { return false; } };

// ---------------- los paneles: cómo se abre cada uno y qué se mide (la raíz) ----------------
// (servers con gente, de mentira: la lista de presencia que llega por la red)
const GENTE = `(() => { const t = Date.now() / 1000, S1 = { id: 'u_scan1', n: 'Scaneger.s server', m: 'FlatGrass', mo: 'Free', pw: 'x', pvp: 0, mp: 1000, mv: 40 }, S2 = { id: 'u_kris', n: 'Kris PvP 24/7', m: 'City', mo: 'PvP', pvp: 1, mp: 1000, mv: 40 };
  for (const [k, s, j] of [['a', S1, 'Juancruz'], ['b', S1, 'Scaneger.'], ['c', S2, 'Kris'], ['d', S2, 'Gumball'], ['e', S2, 'ninten']]) LISTA.pres.set(k, { s, j, t }); return 1; })()`;
const CERRAR = `(() => { for (const id of ['ajustes', 'cuDlg', 'cfDlg']) { const e = document.getElementById(id); if (e) e.classList.add('oc'); } if (typeof mpClaveNo === 'function') mpClaveNo(); return 1; })()`;
// (una o dos pestañas más en Ajustes, como las agrega otro módulo —la de Música—: un botón [data-aj] en .ajTabs y su sección)
const AJ_MAS = `((n) => { const t = document.querySelector('#ajustesCaja .ajTabs'), s = document.querySelector('#ajustesCaja .ajSecs'); for (const [k, x] of [['mu', 'Música'], ['px', 'Prueba']].slice(0, n)) { const b = document.createElement('button'); b.dataset.aj = k; b.innerHTML = glifo('musica') + '<span>' + x + '</span>'; t.appendChild(b); const c = document.createElement('section'); c.dataset.ajs = k; c.className = 'oc'; c.innerHTML = '<h4>' + x + '</h4>'; s.appendChild(c); } return 1; })`;
const PANELES = [
  ['nueva', `inicioAccion('nueva')`, '.rbPan'],
  ['multi', `(${GENTE}, inicioPanel('multi'))`, '.rbPan'],
  ['crear_server', `inicioPanel('mcrear')`, '.rbPan'],
  ['lan', `inicioPanel('lan')`, '.rbPan'],
  ['social_chats', `(SOC.tab = 'chats', SOC.chat = null, inicioPanel('social'))`, '.rbPan', `(() => { const e = document.querySelector('.soChatIt'); if (e) e.click(); return 1; })()`],
  ['social_amigos', `(SOC.tab = 'amigos', SOC.sub = 'amigos', inicioPanel('social'))`, '.rbPan'],
  ['social_buscar', `(SOC.tab = 'buscar', SOC.q = '${PD}', inicioPanel('social'), socAccion('buscar'))`, '.rbPan'],
  ['social_perfil', `(SOC.tab = 'perfil', inicioPanel('social'))`, '.rbPan'],
  ['social_sin_sesion', `(window.__tk = CU.token, CU.token = '', inicioPanel('social'))`, '.rbPan', `(CU.token = window.__tk, 1)`],
  ['mods', `(RB.t.tab = 'mod', RB.t.vista = 'explorar', RB.t.ficha = null, RB.t.etq = '', inicioPanel('tienda'))`, '.rbPan'],
  ['mods_ficha', `(RB.t.tab = 'mod', RB.t.ficha = null, inicioPanel('tienda'), inicioAccion('ver:goku'))`, '.rbPan'],
  ['mapas', `(RB.t.tab = 'mapa', RB.t.ficha = null, inicioPanel('tienda'))`, '.rbPan'],
  ['emotes', `(RB.t.tab = 'anim', RB.t.ficha = null, inicioPanel('tienda'))`, '.rbPan'],
  ['gmod', `(RB.t.tab = 'gmod', RB.t.ficha = null, inicioPanel('tienda'))`, '.rbPan'],
  ['crear_mod', `inicioPanel('pubmod')`, '.rbPan'],
  ['publicar_mapa', `inicioPanel('pubmapa')`, '.rbPan'],
  ['crear_mapa', `(RB.creaVuelve = false, inicioPanel('crear'))`, '.rbPan'],
  ['personajes', `(RBM.pjTab = 'skin', inicioPanel('personajes'))`, '.rbPan'],
  ['personajes_mods', `(RBM.pjTab = 'mod', inicioPanel('personajes'))`, '.rbPan'],
  ['personajes_gorros', `(RBM.pjTab = 'hat', inicioPanel('personajes'))`, '.rbPan'],
  ['ajustes', `(inicioPanel(null), inicioAccion('opciones'))`, '#ajustesCaja'],
  ['ajustes_render', `(inicioPanel(null), inicioAccion('opciones'), document.querySelector('[data-aj=r]').click())`, '#ajustesCaja'],
  ['ajustes_controles', `(inicioPanel(null), inicioAccion('opciones'), document.querySelector('[data-aj=c]').click())`, '#ajustesCaja'],
  ['ajustes_carpeta', `(inicioPanel(null), inicioAccion('opciones'), (document.querySelector('[data-aj=m]') || document.body).click())`, '#ajustesCaja'],
  // (otro módulo agrega la pestaña de Música —con las mismas clases— y puede haber una más: con 6 y con 7 todas tienen que
  // verse enteras —pnAjEncajar—; se agregan como lo haría ese módulo, después de armarse Ajustes)
  ['ajustes_6', `(inicioPanel(null), inicioAccion('opciones'), ${AJ_MAS}(1))`, '#ajustesCaja'],
  ['ajustes_7', `(inicioPanel(null), inicioAccion('opciones'), ${AJ_MAS}(2), document.querySelector('[data-aj=px]').click())`, '#ajustesCaja'],
  ['bienvenida', `inicioPanel('bienvenida')`, '.rbPan'],
  ['grieta', `inicioPanel('evento')`, '.rbPan'],
  ['clave', `(${GENTE}, inicioPanel('multi'), mpPedirClave({ id: 'u_scan1', n: 'Scaneger.s server' }))`, '.mpModalC'],
  ['cuenta', `(inicioPanel(null), cuDialogo())`, '#cuDlg .cuCaja'],
  ['cuenta_entrar', `(inicioPanel(null), window.__tk = CU.token, CU.token = '', cuDialogo('multi'), CU.token = window.__tk)`, '#cuDlg .cuCaja'],
  ['confirmar', `(inicioAccion('nueva'), confirmar('¿Borrar «Scaneger.s server»? No se puede deshacer.', 'Borrar', null))`, '#cfDlg .cuCaja'],
];
// (lo que escribe la gente —nombres, mensajes, descripciones— puede terminar en «…»; la interfaz, no)
const DE_LA_GENTE = '.mpInfo b, .mpInfo small, .mpGente, .soIt b, .soIt small, .soConvCab b, .soConvCab small, .soResI b, .soResI small, .tiCard > b, .tiMeta > i:not(.tiChip), .tiMeta > i:not(.tiChip) *, .pjCard > b, .pjCard > small, .nvInfo span, .pjEscInfo b, .pjEscInfo small, .gmkFilaT b, .gmkFilaT small, .soVista h3, .soBur, .gmTileD, .rbFichaInfo small, .soNomIn, .ajCelu, .lanMapa, .rbMapaG > small, .soPie, .soHora';
// (lo tocable que puede medir menos de 44 en el celular, con el motivo: el botón de cada tarjeta de Mods y mapas —toda la
// tarjeta se toca también— y lo del pie de Personajes —el escenario—)
const MENOS = [['.tiBtn', 39.5, 'el botón de la tarjeta (la tarjeta entera también se toca)'], ['.gaCol button', 30, 'los colores del gorro (12 en una fila)'], ['.pjAcc', 34, 'parte de la tarjeta'],
  ['.rbPan_tienda *', 39.5, 'Mods y mapas, sus formularios y Personajes: el compromiso de la 3.1, 40 px (tienda_panel.mjs)'], ['#ajustesCaja *', 39.5, 'Ajustes: 40 px, los de la 3.0 (en la 3.6, 34)']];
// ---- las medidas, en la página (con el juego girado, en las medidas del juego) ----
async function medir(p, raiz) {
  return p.evaluate(([raiz, DE_LA_GENTE, MENOS]) => {
    const R0 = document.querySelector(raiz); if (!R0 || !R0.getClientRects().length) return { falta: raiz };
    const rot = document.documentElement.classList.contains('rot'), PW = innerWidth, W = rot ? innerHeight : innerWidth, H = rot ? innerWidth : innerHeight;
    const rr = (e) => { const q = e.getBoundingClientRect(); return rot ? { x0: q.top, x1: q.bottom, y0: PW - q.right, y1: PW - q.left } : { x0: q.left, x1: q.right, y0: q.top, y1: q.bottom }; };
    const son = document.createElement('i'); son.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)'; document.body.appendChild(son);
    const cs0 = getComputedStyle(son), ins = rot ? { l: 0, r: 0, t: 0, b: 0 } : { l: parseFloat(cs0.paddingLeft), r: parseFloat(cs0.paddingRight), t: parseFloat(cs0.paddingTop), b: parseFloat(cs0.paddingBottom) }; son.remove();
    const deco = '.pnFx, .pnRasgon, .pnMarca, .pnEsq, [aria-hidden=true]';
    const vis = (e) => e.getClientRects().length && e.offsetWidth > 1 && e.offsetHeight > 1 && !e.closest('.oc, [hidden]') && !e.closest(deco) && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.05;
    // la parte que se ve (recortada por los que recortan) y si el recorte es de algo que se desliza
    const recorte = (e) => { let r = rr(e), desl = false, fijo = false; for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a); if (c.overflowX !== 'visible' || c.overflowY !== 'visible') { const q = rr(a), n = { x0: Math.max(r.x0, q.x0), y0: Math.max(r.y0, q.y0), x1: Math.min(r.x1, q.x1), y1: Math.min(r.y1, q.y1) }; if (n.x0 > r.x0 + 1 || n.y0 > r.y0 + 1 || n.x1 < r.x1 - 1 || n.y1 < r.y1 - 1) { if ((/auto|scroll/.test(c.overflowY) && a.scrollHeight > a.clientHeight + 1) || (/auto|scroll/.test(c.overflowX) && a.scrollWidth > a.clientWidth + 1)) desl = true; else fijo = true; } r = n; } } return { r, desl, fijo }; };
    const area = (r) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
    const nom = (e) => (e.dataset.rb || e.id || (typeof e.className === 'string' ? e.className.split(' ').filter((c) => !/^pn/.test(c)).slice(0, 2).join('.') : '') || e.tagName).slice(0, 40);
    const pr = rr(R0), pr2 = recorte(R0).r, probs = [];
    // la placa: adentro de la pantalla y fuera de la muesca
    if (pr.x0 < ins.l - 0.5 || pr.y0 < ins.t - 0.5 || pr.x1 > W - ins.r + 0.5 || pr.y1 > H - ins.b + 0.5) probs.push(`la placa afuera [${[pr.x0, pr.y0, pr.x1, pr.y1].map(Math.round)}] de ${W}×${H} (muesca ${ins.l})`);
    // lo tocable
    const TOCA = 'button, [data-rb]:not(select), input:not([type=range]):not([type=checkbox]):not([type=file]), select, textarea, label.rbBtnGris, label.ajSw, .tiCard, [data-cu], [data-cf], [data-aj], [data-mi], .soIt[data-rb], .pjCard';
    const toc = [...R0.querySelectorAll(TOCA)].filter(vis).filter((e) => !(e.parentElement && e.parentElement.closest('button') && e.tagName !== 'INPUT'));
    const tq = [];
    for (const e of toc) {
      const { r, desl, fijo } = recorte(e), q = rr(e), fr = area(r) / Math.max(1, area(q)); if (fr < 0.6 && desl) continue;
      // (un campo adentro de su etiqueta —el buscador con la lupa—: tocar la etiqueta lo elige; se mide la etiqueta)
      const lb = e.tagName === 'INPUT' && e.closest('label'), q2 = lb ? rr(lb) : q;
      const w = q2.x1 - q2.x0, h = q2.y1 - q2.y0, mn = MENOS.find(([s]) => e.matches(s)), min = mn ? mn[1] : 43.5;
      if (Math.min(w, h) < min) probs.push(`chico ${nom(e)} ${Math.round(w)}×${Math.round(h)}`);
      if (fijo && fr < 0.98) probs.push(`tapado ${nom(e)} (se ve el ${Math.round(fr * 100)} %)`);
      if (q.x0 < Math.max(ins.l, pr2.x0) - 0.5 && !desl) probs.push(`${nom(e)} sale por la izquierda`);
      tq.push({ e, r, k: nom(e) });
    }
    for (let i = 0; i < tq.length; i++) for (let j = i + 1; j < tq.length; j++) { const a = tq[i], c = tq[j]; if (a.e.contains(c.e) || c.e.contains(a.e)) continue; if (Math.min(a.r.x1, c.r.x1) - Math.max(a.r.x0, c.r.x0) > 1 && Math.min(a.r.y1, c.r.y1) - Math.max(a.r.y0, c.r.y0) > 1) probs.push(`encimados ${a.k} × ${c.k}`); }
    // los textos: la letra, cortados, encimados y su color (para el contraste); el fondo de su placa (nada blanco)
    const txt = [], blanco = [], letras = [];
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const rgba = (s) => { const n = (s.match(/[\d.]+/g) || [0, 0, 0, 0]).map(Number); return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1]; };
    for (const e of [R0, ...R0.querySelectorAll('*')]) {
      if (!vis(e)) continue;
      const cs = getComputedStyle(e), bg = rgba(cs.backgroundColor), sat = (c) => (Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2])) / Math.max(1, Math.max(c[0], c[1], c[2]));
      // (claro: luminoso y sin color —el blanco y los grises claros—; el amarillo de lo principal no cuenta)
      if (bg[3] > 0.5 && lum(bg) > 0.45 && sat(bg) < 0.3 && e.offsetWidth * e.offsetHeight > 900 && !e.matches('img, .rbFoto, .mpFoto, .nvFoto, .pjFoto, .dpEvFoto, .rbTileIco, .rbFichaIco, .soAv, .soAv *, .gaCol button, .rbBienvLogo, [style*=background]')) blanco.push(nom(e) + ' ' + cs.backgroundColor);
      const nodos = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
      const tx = nodos.map((n) => n.textContent).join('').trim() || (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' ? e.value || e.placeholder : '') || (e.tagName === 'SELECT' ? (e.selectedOptions[0] || {}).text || '' : '');
      if (!tx || e.matches('option, input[type=range], input[type=checkbox], input[type=radio], input[type=color], input[type=file]')) continue;
      const f = parseFloat(cs.fontSize); if (f < 1) continue;   // (el texto escondido a propósito: el botón queda con el ícono y su nombre para el lector)
      const { r, desl, fijo } = recorte(e), q = rr(e), fr = area(r) / Math.max(1, area(q)); if (fr < 0.5 && desl) continue;
      if (f < 13.95) probs.push(`letra ${f}px «${tx.slice(0, 24)}» (${nom(e)})`);
      const gente = e.matches(DE_LA_GENTE) || !!e.closest('.soBur, .soMsgs, .gmkFilaT, .rbFichaInfo p');
      // el rectángulo del texto mismo (sin los íconos ni lo que tenga al lado)
      let tr = null; if (nodos.length) { const rg = document.createRange(); for (const n of nodos) { rg.selectNodeContents(n); for (const qq of rg.getClientRects()) { const o = rot ? { x0: qq.top, x1: qq.bottom, y0: PW - qq.right, y1: PW - qq.left } : { x0: qq.left, x1: qq.right, y0: qq.top, y1: qq.bottom }; if (o.x1 - o.x0 < 0.5) continue; tr = tr ? { x0: Math.min(tr.x0, o.x0), y0: Math.min(tr.y0, o.y0), x1: Math.max(tr.x1, o.x1), y1: Math.max(tr.y1, o.y1), pg: [...tr.pg, qq] } : { ...o, pg: [qq] }; } } }
      // cortado: el texto se sale de lo que se ve (recortado por algo que no se desliza) o queda en «…» o con renglones de menos
      let corta = false;
      if (!gente) {
        if (/hidden|clip/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1 && cs.display !== 'inline') corta = 'ancho ' + e.scrollWidth + '>' + e.clientWidth;
        if (/hidden|clip/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2 && !/auto|scroll/.test(cs.overflowY)) corta = 'alto ' + e.scrollHeight + '>' + e.clientHeight;
        // (a lo ancho: el rectángulo de las letras contra lo que recortan los de afuera; a lo alto, la caja de las letras de
        // Oswald es más alta que el renglón y no cuenta: lo de dos renglones de más lo ve scrollHeight)
        if (tr && !desl) { let c0 = { x0: -1e9, x1: 1e9 }; for (let a = /hidden|clip/.test(cs.overflowX) ? e : e.parentElement; a && a !== document.documentElement; a = a.parentElement) { const ca = getComputedStyle(a); if (ca.overflowX !== 'visible') { const qa = rr(a); c0 = { x0: Math.max(c0.x0, qa.x0), x1: Math.min(c0.x1, qa.x1) }; } } if (tr.x0 < c0.x0 - 1 || tr.x1 > c0.x1 + 1) corta = `letras ${Math.round(tr.x0)}..${Math.round(tr.x1)} de ${Math.round(c0.x0)}..${Math.round(c0.x1)}`; }
        if ((e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') && e.scrollWidth > e.clientWidth + 1) corta = 'campo ' + e.scrollWidth + '>' + e.clientWidth;
        // (el texto de ayuda de un campo vacío: que entre entero)
        if (e.tagName === 'INPUT' && !e.value && e.placeholder) { const cv = (window.__cvM = window.__cvM || document.createElement('canvas')).getContext('2d'); const pc = getComputedStyle(e, '::placeholder'); cv.font = `${pc.fontStyle} ${pc.fontWeight} ${pc.fontSize} ${pc.fontFamily}`; const an = cv.measureText(e.placeholder).width + (parseFloat(pc.letterSpacing) || 0) * e.placeholder.length, lugar = e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); if (an > lugar + 1 && !(W < 700 && cs.textOverflow === 'ellipsis' && lugar > 60)) corta = `ayuda ${Math.round(an)}>${Math.round(lugar)}`; }
      }
      if (corta) probs.push(`cortado «${tx.slice(0, 28)}» (${nom(e)}: ${corta})`);
      if (tr && fr > 0.3) letras.push({ e, k: `«${tx.slice(0, 20)}»`, r: { x0: Math.max(tr.x0, r.x0), y0: Math.max(tr.y0, r.y0), x1: Math.min(tr.x1, r.x1), y1: Math.min(tr.y1, r.y1) } });
      if (fijo && fr < 0.9 && !gente) probs.push(`tapado «${tx.slice(0, 24)}» (${nom(e)}, se ve el ${Math.round(fr * 100)} %)`);
      const ph = (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') && !e.value;
      const col = rgba(getComputedStyle(e, ph ? '::placeholder' : null).color);
      if (fr > 0.9) {
        // (en coordenadas de la página, recortado por lo que recorta: un nombre largo que termina en «…» no se mide afuera de su caja)
        let cp = { l: -1e9, t: -1e9, r: 1e9, b: 1e9 }; for (let a = /hidden|clip/.test(cs.overflowX) ? e : e.parentElement; a && a !== document.documentElement; a = a.parentElement) { const ca = getComputedStyle(a); if (ca.overflowX !== 'visible' || ca.overflowY !== 'visible') { const qa = a.getBoundingClientRect(); cp = { l: Math.max(cp.l, qa.left), t: Math.max(cp.t, qa.top), r: Math.min(cp.r, qa.right), b: Math.min(cp.b, qa.bottom) }; } }
        if (tr) for (const qq of tr.pg) { const l = Math.max(qq.left, cp.l), t = Math.max(qq.top, cp.t), w = Math.min(qq.right, cp.r) - l, h = Math.min(qq.bottom, cp.b) - t; if (w > 2 && h > 2) txt.push({ t: tx.slice(0, 24), k: nom(e), x: l, y: t, w, h, c: col, f, rot }); }
        else { const q0 = e.getBoundingClientRect(), pl = parseFloat(cs.paddingLeft), anc = Math.min(q0.width - pl, tx.length * f * 0.55 + 4); txt.push({ t: tx.slice(0, 24), k: nom(e), x: q0.left + (rot ? 0 : pl), y: q0.top + (rot ? pl : 0), w: rot ? q0.width : anc, h: rot ? Math.min(q0.height, anc) : q0.height, c: col, f, rot }); }
      }
    }
    if (blanco.length) probs.push('placas claras: ' + [...new Set(blanco)].slice(0, 6).join(', '));
    // (Ajustes: todas sus pestañas a la vista, enteras —la columna no tiene que deslizarse—, también con las que agregan otros
    // módulos; lo de arriba no lo ve: lo que está casi todo adentro de algo que se desliza se saltea)
    const AT = R0.querySelector('.ajTabs');
    if (AT) { const c = rr(AT); for (const b of AT.querySelectorAll('button')) { const q = rr(b); if (q.y0 < c.y0 - 1 || q.y1 > c.y1 + 1 || q.x0 < c.x0 - 1 || q.x1 > c.x1 + 1) probs.push(`pestaña de Ajustes fuera de la vista «${b.textContent.trim().slice(0, 20)}»`); } }
    // las decoraciones (las rayas, la cinta, las marcas de esquina, la esquina cortada de las tarjetas): ninguna tapa letras ni
    // lo que se toca (salvo la tarjeta o el botón al que pertenece). Su caja: la del dueño más lo que dice su estilo (con su
    // giro), recortada por lo que recorta al dueño
    const DECO = [['.rbPan, #ajustesCaja, .cuCaja, .mpModalC', '::before'], ['.rbPan, .cuCaja, .mpModalC', '::after'], ['.rbPanCab, .ajCab', '::after'], ['.rbPanPie', '::before'], ['.soVista', '::before'], ['.rbMapaG, .tiCard, .pjCard', '::after'], ['.rbFoto, .mpFoto, .nvFoto, .pjFoto, .dpEvFoto', '::before']];
    const caja = (h, ps) => {
      const c = getComputedStyle(h, ps); if (c.content === 'none' || c.display === 'none' || c.position !== 'absolute' || +c.opacity < 0.05) return null;
      const H0 = rr(h), bl = parseFloat(getComputedStyle(h).borderLeftWidth) || 0, bt = parseFloat(getComputedStyle(h).borderTopWidth) || 0, hw = h.clientWidth, hh = h.clientHeight, px = (v) => parseFloat(v);
      let x0 = c.left !== 'auto' ? px(c.left) : hw - px(c.right) - px(c.width), y0 = c.top !== 'auto' ? px(c.top) : hh - px(c.bottom) - px(c.height), w = px(c.width), hgt = px(c.height);
      if (!(w > 0) || !(hgt > 0)) return null;
      const m = c.transform && c.transform !== 'none' ? c.transform.match(/matrix\(([^)]+)\)/) : null, o = c.transformOrigin.split(' ').map(px);
      let pts = [[0, 0], [w, 0], [0, hgt], [w, hgt]];
      if (m) { const [a, b2, cc, d, e2, f] = m[1].split(',').map(Number); pts = pts.map(([x, y]) => [a * (x - o[0]) + cc * (y - o[1]) + e2 + o[0], b2 * (x - o[0]) + d * (y - o[1]) + f + o[1]]); }
      const xs = pts.map((p2) => p2[0] + x0 + bl), ys = pts.map((p2) => p2[1] + y0 + bt);
      let r2 = { x0: H0.x0 + Math.min(...xs), x1: H0.x0 + Math.max(...xs), y0: H0.y0 + Math.min(...ys), y1: H0.y0 + Math.max(...ys) };
      // (recortada por el dueño si recorta, y por los que recortan al dueño)
      const R2 = recorte(h).r, cl = /hidden|clip/.test(getComputedStyle(h).overflowX) ? { x0: Math.max(R2.x0, H0.x0), y0: Math.max(R2.y0, H0.y0), x1: Math.min(R2.x1, H0.x1), y1: Math.min(R2.y1, H0.y1) } : (() => { let q = { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 }; for (let a = h.parentElement; a && a !== document.documentElement; a = a.parentElement) { const ca = getComputedStyle(a); if (ca.overflowX !== 'visible' || ca.overflowY !== 'visible') { const qa = rr(a); q = { x0: Math.max(q.x0, qa.x0), y0: Math.max(q.y0, qa.y0), x1: Math.min(q.x1, qa.x1), y1: Math.min(q.y1, qa.y1) }; } } return q; })();
      r2 = { x0: Math.max(r2.x0, cl.x0), y0: Math.max(r2.y0, cl.y0), x1: Math.min(r2.x1, cl.x1), y1: Math.min(r2.y1, cl.y1) };
      return r2.x1 - r2.x0 > 0.5 && r2.y1 - r2.y0 > 0.5 ? r2 : null;
    };
    const pisan = (a, c) => Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0) > 0.75 && Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0) > 0.75;
    for (const [sel, ps] of DECO) for (const h of [R0, ...R0.querySelectorAll(sel)]) {
      if (!h.matches(sel) || !vis(h)) continue;
      // (las marcas de esquina del panel van en un ::after del tamaño del panel: lo que se pinta son las dos esquinas de abajo)
      const ds = ps === '::after' && h.matches('.rbPan') ? (getComputedStyle(h, ps).display === 'none' ? [] : [rr(h)].map((H0) => [{ x0: H0.x0, y0: H0.y1 - 3, x1: H0.x0 + 19, y1: H0.y1 }, { x0: H0.x0, y0: H0.y1 - 19, x1: H0.x0 + 3, y1: H0.y1 }, { x0: H0.x1 - 19, y0: H0.y1 - 3, x1: H0.x1, y1: H0.y1 }, { x0: H0.x1 - 3, y0: H0.y1 - 19, x1: H0.x1, y1: H0.y1 }, { x0: H0.x1 - 3, y0: H0.y0, x1: H0.x1, y1: H0.y0 + 19 }])[0]) : [caja(h, ps)].filter(Boolean);
      for (const d of ds) {
        for (const l of letras) if (pisan(d, l.r)) probs.push(`decoración ${nom(h)}${ps} tapa ${l.k}`);
        for (const t of tq) if (t.e !== h && !t.e.contains(h) && pisan(d, t.r)) probs.push(`decoración ${nom(h)}${ps} tapa ${t.k}`);
      }
    }
    return { W, H, rot, ins, probs: [...new Set(probs)], txt, panel: [pr.x0, pr.y0, pr.x1, pr.y1].map(Math.round) };
  }, [raiz, DE_LA_GENTE, MENOS]);
}
// el contraste medido en la imagen: se esconde el texto (y los íconos), se saca la foto y, debajo de cada texto, el 5 % de los
// puntos que menos contrastan con su color tiene que dar ≥ 4,5
const SIN_TEXTO = `#rbInicio .rbPan *,#rbInicio .rbPan,#ajustesCaja *,.cuCaja *,.mpModalC *,#rbInicio .rbAviso{color:transparent!important;-webkit-text-fill-color:transparent!important;caret-color:transparent!important;text-shadow:none!important}
  #rbInicio .rbPan ::placeholder,#ajustesCaja ::placeholder,.mpModalC ::placeholder{color:transparent!important}#rbInicio .rbPan svg,#ajustesCaja svg,.cuCaja svg,.mpModalC svg,#rbInicio .rbPan img.ico,#rbInicio .rbPan .pnFx,#rbInicio .rbPan .pnCuenta::after{visibility:hidden!important}`;
async function contraste(p, T) {
  if (!T.length) return [];
  await p.evaluate((css) => { const s = document.createElement('style'); s.id = '__sinTexto'; s.textContent = css; document.head.appendChild(s); }, SIN_TEXTO);
  await p.waitForTimeout(120);
  const png = (await p.screenshot()).toString('base64');
  await p.evaluate(() => document.getElementById('__sinTexto').remove());
  return p.evaluate(async ([png, T]) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + png; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const k = im.width / innerWidth, L = (r, gg, bb) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(bb); };
    return T.map((t0) => {
      // (la franja de las letras: el alto de la caja de Oswald —y de cualquier letra— pasa el de las letras; se mira el 72 % del
      // tamaño de la letra, en el medio)
      const t = Object.assign({}, t0); if (t.rot) { const a = Math.min(t.w, t.f * 0.72); t.x += (t.w - a) / 2; t.w = a; } else { const a = Math.min(t.h, t.f * 0.72); t.y += (t.h - a) / 2; t.h = a; }
      const x = Math.round((t.x + 1) * k), y = Math.round(t.y * k), w = Math.max(1, Math.round((t.w - 2) * k)), h = Math.max(1, Math.round(t.h * k));
      if (x < 0 || y < 0 || x + w > c.width || y + h > c.height) return { t: t.t, k: t.k, c: 99 };
      const d = g.getImageData(x, y, w, h).data, cs = [];
      for (let i = 0; i < d.length; i += 4) { const tt = [0, 1, 2].map((j) => t.c[j] * t.c[3] + d[i + j] * (1 - t.c[3])), lt = L(...tt), lb = L(d[i], d[i + 1], d[i + 2]); cs.push((Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05)); }
      cs.sort((a, b2) => a - b2); return { t: t.t, k: t.k, c: +cs[Math.floor(cs.length * 0.05)].toFixed(2) };
    });
  }, [png, T]);
}
// abrir un panel y dejarlo quieto (todo lo animado terminado: la foto y las medidas son del estado quieto)
async function abrirPanel(A, pn, quieto = true) {
  const [, js, , js2] = pn;
  await A.ev(CERRAR).catch(() => {}); await A.ev(js); await A.p.waitForTimeout(700);
  if (js2) { await A.ev(js2); await A.p.waitForTimeout(600); }
  if (pn[0].startsWith('social')) await esperar(A.p, `!document.querySelector('.soIzq .pnEsq')`, 5000);
  if (pn[0] === 'gmod') await esperar(A.p, `!RB.t.cargando`, 15000);
  if (quieto) { await A.p.waitForTimeout(500); await A.ev(`(() => { for (const a of document.getAnimations()) { try { if (a.effect && a.effect.getTiming().iterations !== Infinity) a.finish(); } catch (e) {} } return 1; })()`).catch(() => {}); await A.p.mouse.move(1, 1).catch(() => {}); await A.p.waitForTimeout(150); }
}
const PANT = [['celu_dueño_873x402', 873, 402, true, 40, 2], ['celu_915x412', 915, 412, true, 40, 1], ['celu_800x368', 800, 368, true, 0, 1], ['celu_chico_640x360', 640, 360, true, 0, 1],
  ['celu_parado_402x873', 402, 873, true, 0, 1], ['tablet_1180x820', 1180, 820, true, 0, 1], ['compu_1280x720', 1280, 720, false, 0, 1], ['compu_1920x1080', 1920, 1080, false, 0, 1]]
  .filter((x) => !process.env.PANTALLAS || process.env.PANTALLAS.split(',').some((k) => x[0].includes(k)));
// (PANELES=nueva,multi… para medir sólo esos; IDIOMAS_SOLO=ar,de para esos idiomas)
if (process.env.PANELES) for (let i = PANELES.length - 1; i >= 0; i--) if (!process.env.PANELES.split(',').includes(PANELES[i][0])) PANELES.splice(i, 1);
if (process.env.IDIOMAS_SOLO) IDIOMAS.splice(0, IDIOMAS.length, ...process.env.IDIOMAS_SOLO.split(','));

// ======================= 1. pantallas =======================
if (corre(1)) {
  const mal = [], peor = {};
  for (const [nom, w, h, movil, ins, dpr] of PANT) {
    const A = await abrir('pantalla ' + nom, w, h, movil, { ins, dpr });
    for (const pn of PANELES) {
      await abrirPanel(A, pn);
      const M = await medir(A.p, pn[2]);
      if (M.falta) { mal.push(`${nom} ${pn[0]}: no se ve ${M.falta}`); continue; }
      // (otra vez, con todo lo que se desliza llevado hasta abajo: nada tapa lo último de una lista)
      await A.p.evaluate((raiz) => { window.__desl = []; for (const e of document.querySelector(raiz).querySelectorAll('*')) if (e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY)) { window.__desl.push([e, e.scrollTop]); e.scrollTop = e.scrollHeight; } }, pn[2]);
      await A.p.waitForTimeout(120); const M2 = await medir(A.p, pn[2]);
      for (const x of M2.probs || []) if (!M.probs.includes(x)) M.probs.push('(abajo) ' + x);
      await A.p.evaluate(() => { for (const [e, t] of window.__desl || []) e.scrollTop = t; window.__desl = null; }); await A.p.waitForTimeout(80);
      const C = await contraste(A.p, M.txt), bajos = C.filter((x) => x.c < 4.5);
      const pe = C.reduce((m, x) => Math.min(m, x.c), 99); peor[pn[0]] = Math.min(peor[pn[0]] || 99, pe);
      const pr = [...M.probs, ...bajos.map((x) => `contraste ${x.c} «${x.t}» (${x.k})`)];
      if (pr.length) mal.push(`${nom} ${pn[0]}: ` + pr.slice(0, 6).join(' | '));
      if (D && (nom.startsWith('celu_dueño') || nom === 'compu_1280x720' || process.env.TODAS_FOTOS)) await A.p.screenshot({ path: `${D}${nom}_${pn[0]}.png` });
    }
    await A.ctx.close();
  }
  if (D) writeFileSync(D + 'problemas_1.txt', mal.join('\n') + '\n');
  caso(`1. ${PANELES.length} paneles en ${PANT.length} pantallas: nada blanco, lo tocable ≥ 44 px, letra ≥ 14 px, nada cortado ni encimado, adentro de la pantalla y fuera de la muesca, contraste ≥ 4,5 (el peor por panel: ${JSON.stringify(peor)})`, !mal.length, mal.slice(0, 40));
}
// ======================= 2. idiomas =======================
if (corre(2)) {
  const mal = [];
  for (const lang of IDIOMAS) for (const [w, h, ins] of [[873, 402, 40], [640, 360, 0]]) {
    const A = await abrir(`idioma ${lang} ${w}`, w, h, true, { ins, lang });
    const rtl = await A.ev(`RB.el.dir`);
    if ((lang === 'ar') !== (rtl === 'rtl')) mal.push(`${lang}: dir ${rtl}`);
    for (const pn of PANELES) {
      await abrirPanel(A, pn);
      const M = await medir(A.p, pn[2]);
      if (M.falta) { mal.push(`${lang} ${w} ${pn[0]}: no se ve`); continue; }
      if (M.probs.length) mal.push(`${lang} ${w} ${pn[0]}: ` + M.probs.slice(0, 4).join(' | '));
      if (D && (process.env.TODAS_FOTOS || w === 873 && ['ar', 'de', 'ru', 'ja'].includes(lang) && ['nueva', 'multi', 'social_amigos', 'mods', 'ajustes'].includes(pn[0]))) await A.p.screenshot({ path: `${D}idioma_${lang}${w === 873 ? '' : '_' + w}_${pn[0]}.png` });
    }
    await A.ctx.close();
  }
  if (D) writeFileSync(D + 'problemas_2.txt', mal.join('\n') + '\n');
  caso(`2. los 14 idiomas en 873×402 (con muesca) y 640×360, ${PANELES.length} paneles: nada se sale, se corta, se encima ni queda chico; el árabe, espejado`, !mal.length, mal.slice(0, 40));
}

// ======================= 3. animaciones =======================
// (lo que corre adentro de los paneles y los carteles: animaciones de CSS, transiciones y las de paneles.js)
const CORREN = `(() => { const R = '#rbInicio .rbPan, #ajustes, #cuDlg, #cfDlg, #rbInicio .mpModal, #rbInicio .rbAviso', A = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest(R));
  const nom = (a) => (a.animationName || a.transitionProperty || (a.effect.pseudoElement ? 'waapi' + a.effect.pseudoElement : 'waapi')) + '@' + String((a.effect.target.className && a.effect.target.className.baseVal !== undefined ? a.effect.target.className.baseVal : a.effect.target.className) || a.effect.target.tagName).slice(0, 30);
  return { todas: A.map(nom), sinEsq: A.filter((a) => !a.effect.target.closest('.pnEsq')).map(nom), rasgon: document.querySelectorAll('.pnRasgon').length, fx: document.querySelectorAll('.pnFx').length, entra: document.querySelectorAll('.pnEntra').length, sube: document.querySelectorAll('.pnSube').length }; })()`;
if (corre(3)) {
  // a. cada panel: a los 1,2 s no corre nada; hubo entrada (rasgón o la cascada) y ya no queda nada
  {
    const A = await abrir('animaciones', 873, 402, true, { ins: 40, dpr: 1 });
    const mal = [], vistos = {};
    for (const pn of PANELES) {
      await A.ev(CERRAR).catch(() => {}); await A.ev(`inicioPanel(null); 1`); await A.p.waitForTimeout(250);
      const e0 = await A.ev('PN.entradas');
      await A.ev(pn[1]);
      // (el reloj de las animaciones del primer cuadro dibujado después de abrir: con la máquina muy cargada el navegador deja
      // de dibujar cuadros por ratos —se vio hasta 0,9 s— y las animaciones no avanzan; «a los 1,2 s» es 1,2 s de ese reloj
      // y, también, del reloj de la pared)
      const tlA = await A.p.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(document.timeline.currentTime))));
      await A.p.waitForTimeout(60);
      const c0 = await A.ev(CORREN);
      if (pn[3]) await A.ev(pn[3]);
      await A.p.waitForTimeout(1050); await A.p.waitForFunction((t) => document.timeline.currentTime - t >= 1150, tlA, { timeout: 20000 }).catch(() => {});
      const c1 = await A.ev(CORREN), e1 = await A.ev('PN.entradas');
      vistos[pn[0]] = { al: c0.todas.length, rasgon: c0.rasgon, entradas: e1 - e0 };
      const esPanel = pn[2] === '.rbPan';
      if (c1.sinEsq.length || c1.rasgon || c1.entra || c1.sube) mal.push(`${pn[0]}: a los 1,2 s ${JSON.stringify(c1)}`);
      if (!c0.todas.length) mal.push(`${pn[0]}: sin animación de entrada`);
      if (esPanel && pn[0] !== 'social_sin_sesion' && !pn[0].startsWith('personajes') && pn[0] !== 'social_perfil' && e1 - e0 < 1 && !/^(mods_ficha|mapas|emotes|gmod|social_amigos|social_buscar|social_perfil)$/.test(pn[0])) mal.push(`${pn[0]}: no hubo entrada`);
      if (c1.todas.length) { await A.p.waitForTimeout(3600); const c2 = await A.ev(CORREN); if (c2.todas.length) mal.push(`${pn[0]}: los esqueletos siguen a los 5 s ${JSON.stringify(c2.todas.slice(0, 4))}`); }
    }
    caso(`3a. al abrir cada panel hay animación de entrada y a los 1,2 s ya no corre nada (ni quedan el rasgón, la tinta ni la cascada)`, !mal.length, { mal: mal.slice(0, 20), vistos });
    // b. tocar: el golpe y la tinta; la marca de la pestaña se desliza; los números suben y queda el texto de verdad
    await A.ev(CERRAR); await A.ev(`inicioPanel(null); 1`); await A.p.waitForTimeout(200);
    await A.ev(`(RB.t.tab = 'mod', RB.t.vista = 'explorar', RB.t.ficha = null, RB.t.etq = '', inicioPanel('tienda'))`);
    // (el número de la primera sección de Mods —el mismo que se mira después—, apenas aparece)
    await A.p.waitForFunction(() => document.querySelector('.rbPan_tienda .rbSecc em'), null, { timeout: 8000 }).catch(() => {});
    const cuenta = await A.ev(`(() => { const e = document.querySelector('.rbPan_tienda .rbSecc em'); return e ? { real: e.textContent, ve: e.dataset.pn || '', clase: e.classList.contains('pnCuenta') } : null; })()`);
    await A.p.waitForTimeout(1200);
    const cuenta2 = await A.ev(`(() => { const e = document.querySelector('.rbPan .rbSecc em'); return { real: e.textContent, clase: e.classList.contains('pnCuenta'), ve: e.dataset.pn || null }; })()`);
    const bt = await A.p.$('.rbPan [data-rb="tab:mapa"]'), q = await bt.boundingBox();
    await A.p.touchscreen.tap(q.x + q.width / 2, q.y + q.height / 2); await A.p.waitForTimeout(60);
    const tras = await A.ev(`(() => { const m = document.querySelector('.rbPan .rbTabs .pnMarca'), A = document.getAnimations().filter((a) => a.playState === 'running'); return { marca: !!m, desliza: A.some((a) => a.effect && a.effect.target === m), tinta: document.querySelectorAll('.pnFx.pnTinta').length, panel: RB.t.tab, golpe: A.some((a) => a.effect && a.effect.target && a.effect.target.matches && a.effect.target.matches('.rbTab')) }; })()`);
    await A.p.waitForTimeout(900); const tras2 = await A.ev(CORREN);
    caso('3b. Mods y mapas: los números suben (se ve la copia y el texto de verdad queda) y terminan; tocar una pestaña: el golpe, la tinta y la marca que se desliza, y todo termina', cuenta && cuenta.clase && /\d/.test(cuenta.real) && cuenta2.real === cuenta.real && !cuenta2.clase && tras.marca && tras.desliza && tras.tinta >= 0 && tras.panel === 'mapa' && !tras2.todas.length && !tras2.fx,
      { cuenta, cuenta2, tras, tras2 });
    await A.ctx.close();
  }
  // c. con «menos movimiento» y con Gráficos Patata: nada se mueve; con Bajos, sin rasgón, cascada ni tinta (el golpe sí)
  for (const [nom, o] of [['menos movimiento', { reducido: true }], ['Gráficos Patata', { gfx: 'patata' }], ['Gráficos bajos', { gfx: 'bajo' }]]) {
    const B = await abrir('quieto ' + nom, 873, 402, true, o);
    const mal = []; let nivel = await B.ev(`pnNivel()`);
    for (const pn of PANELES.filter((x) => ['nueva', 'multi', 'social_amigos', 'mods', 'personajes', 'ajustes', 'cuenta'].includes(x[0]))) {
      await B.ev(CERRAR).catch(() => {}); await B.ev(`inicioPanel(null); 1`); await B.p.waitForTimeout(200);
      await B.ev(pn[1]); await B.p.waitForTimeout(40); const c0 = await B.ev(CORREN);
      const sel = pn[0] === 'ajustes' ? '#ajustes [data-aj=r]' : '.rbPan [data-rb]:not(select)'; const bt = await B.p.$(sel);
      if (bt) { const q = await bt.boundingBox(); if (q) await B.p.touchscreen.tap(q.x + q.width / 2, q.y + q.height / 2); }
      await B.p.waitForTimeout(30); const c1 = await B.ev(CORREN);
      const mueve = [...c0.todas, ...c1.todas].filter((n) => !/^opacity@|^waapi@pnMarca/.test(n) || nom !== 'Gráficos bajos');
      if (nom !== 'Gráficos bajos') { if (mueve.length || c0.rasgon || c1.fx) mal.push(`${pn[0]}: ${JSON.stringify({ c0, c1 })}`); }
      else if (c0.rasgon || c1.fx || c0.sube) mal.push(`${pn[0]}: ${JSON.stringify({ c0, c1 })}`);
      await B.p.waitForTimeout(800);
    }
    caso(`3c. ${nom} (nivel ${nivel}): ${nom === 'Gráficos bajos' ? 'sin el rasgón, la cascada ni la tinta' : 'nada se mueve al abrir ni al tocar'}`, !mal.length && nivel === (nom === 'Gráficos bajos' ? 'bajo' : 'quieto'), mal.slice(0, 8));
    await B.ctx.close();
  }
}

// ======================= 4. rendimiento =======================
const PERF = ['nueva', 'multi', 'social_amigos', 'mods', 'crear_mapa', 'personajes', 'ajustes'];
async function cuadrosGPU(url, quien, pn) {
  const bb = await chromium.launch({ executablePath: CHROME, args: ARGS });
  const A = await abrir('cuadros ' + quien, 873, 402, true, { url, dpr: 2, bb });
  await A.ev(pn[1]); await A.p.waitForTimeout(800); if (pn[3]) await A.ev(pn[3]);
  await A.p.waitForTimeout(3000);
  const traza = `${tmpdir()}/jx_pn_${process.pid}_${Date.now()}.json`;
  await bb.startTracing(A.p, { path: traza, categories: ['viz'] });
  const t0 = Date.now(); await A.p.waitForTimeout(6000); const s = (Date.now() - t0) / 1000;
  await bb.stopTracing();
  const E = JSON.parse(readFileSync(traza, 'utf8')); const L = E.traceEvents || E; try { unlinkSync(traza); } catch (e) {}
  const comp = L.filter((e) => e.name === 'Display::DrawAndSwap' && (e.ph === 'X' || e.ph === 'B')).length;
  await bb.close();
  return +(comp / s).toFixed(2);
}
// abrir un panel: de la llamada al cuadro dibujado (dos requestAnimationFrame), con el procesador 4× más lento
async function tiempoAbrir(url, quien, nombres, n) {
  const bb = await chromium.launch({ executablePath: CHROME, args: ARGS });
  const A = await abrir('abrir ' + quien, 873, 402, true, { url, dpr: 2, bb });
  const cdp = await A.ctx.newCDPSession(A.p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const R = {};
  for (let i = 0; i < n; i++) for (const k of nombres) {
    const pn = PANELES.find((x) => x[0] === k);
    await A.ev(CERRAR).catch(() => {}); await A.ev(`inicioPanel(null); 1`); await A.p.waitForTimeout(500);
    const t = await A.ev(`new Promise((ok) => { const t0 = performance.now(); ${pn[1]}; requestAnimationFrame(() => requestAnimationFrame(() => ok(performance.now() - t0))); })`);
    (R[k] = R[k] || []).push(t); await A.p.waitForTimeout(1300);
  }
  await bb.close();
  return R;
}
async function heapVueltas(url) {
  const A = await abrir('heap', 873, 402, true, { dpr: 1, url });
  const cdp = await A.ctx.newCDPSession(A.p); await cdp.send('HeapProfiler.enable');
  const heap = async () => { for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize / 1048576; };
  const R = {};
  for (const pn of PANELES.filter((x) => x[2] === '.rbPan' || x[0] === 'ajustes')) {
    // (una vuelta antes, para que lo que se carga una sola vez —íconos, la lista de la tienda— ya esté)
    await A.ev(pn[1]); await A.p.waitForTimeout(900); await A.ev(CERRAR); await A.ev(`inicioPanel(null); 1`); await A.p.waitForTimeout(400);
    const h0 = await heap();
    for (let i = 0; i < 5; i++) { await A.ev(pn[1]); await A.p.waitForTimeout(700); if (pn[3]) { await A.ev(pn[3]); await A.p.waitForTimeout(300); } await A.ev(CERRAR); await A.ev(`inicioPanel(null); 1`); await A.p.waitForTimeout(400); }
    await A.p.waitForTimeout(1200); R[pn[0]] = +((await heap()) - h0).toFixed(2);
  }
  await A.ctx.close(); return R;
}
if (corre(4)) {
  const N = +(process.env.CORRIDAS || 3);
  // a. cuadros con el panel quieto
  if (U36) {
    const R = {};
    for (const k of PERF) { const pn = PANELES.find((x) => x[0] === k); R[k] = { ahora: [], v36: [] }; for (let i = 0; i < 2; i++) for (const [q, u] of i % 2 ? [['v36', U36], ['ahora', HTML]] : [['ahora', HTML], ['v36', U36]]) R[k][q].push(await cuadrosGPU(u, q, pn)); }
    const pr = (L) => +(L.reduce((a, x) => a + x, 0) / L.length).toFixed(2), tab = Object.fromEntries(Object.entries(R).map(([k, v]) => [k, [pr(v.ahora), pr(v.v36)]]));
    const malos = Object.entries(tab).filter(([, [a, v]]) => a > v * 1.1 + 1);
    caso(`4a. cuadros que compone la placa por segundo con el panel quieto (873×402 a 2×, 6 s, 3 s después de abrir, promedio de 2; [ahora, 3.6]): ${JSON.stringify(tab)}`, !malos.length, { malos });
  }
  // b. abrir cada panel: no más de un 10 % más lento que la 3.6 (corridas alternadas; la mediana)
  if (U36) {
    const A = { ahora: {}, v36: {} };
    for (let i = 0; i < N; i++) for (const [q, u] of i % 2 ? [['v36', U36], ['ahora', HTML]] : [['ahora', HTML], ['v36', U36]]) { const r = await tiempoAbrir(u, q, PERF, 2); for (const k in r) (A[q][k] = A[q][k] || []).push(...r[k]); }
    const med = (L) => { const s = [...L].sort((a, c) => a - c); return +s[Math.floor(s.length / 2)].toFixed(1); };
    const tab = Object.fromEntries(PERF.map((k) => [k, [med(A.ahora[k]), med(A.v36[k]), +(100 * (med(A.ahora[k]) / med(A.v36[k]) - 1)).toFixed(1)]]));
    console.log('abrir (ms, procesador 4× más lento, mediana de ' + 2 * N + '; [ahora, 3.6, %]):\n' + Object.entries(tab).map(([k, v]) => `  ${k.padEnd(14)} ${v.join('  ')}`).join('\n'));
    const malos = Object.entries(tab).filter(([, v]) => v[2] > 10);
    caso(`4b. abrir cada panel, a lo sumo un 10 % más lento que la 3.6: ${JSON.stringify(tab)}`, !malos.length, { malos });
  }
  // c. el heap: abrir y cerrar cada panel 5 veces
  {
    const R = await heapVueltas(HTML), malos = Object.entries(R).filter(([, v]) => v > 0.6);
    caso(`4c. el heap no crece al abrir y cerrar cada panel 5 veces (MB): ${JSON.stringify(R)}`, !malos.length, { malos });
  }
}

// ======================= 5. los dos menús de inicio =======================
if (corre(5)) {
  const A = await abrir('depósito', 873, 402, true, { ins: 40, prefs: { menuInicio: 'deposito' } });
  await esperar(A.p, `typeof DEP !== 'undefined' && DEP.listo`, 90000);
  const mal = [], home = await A.ev('RB.home');
  for (const pn of PANELES.filter((x) => ['nueva', 'multi', 'social_amigos', 'mods', 'crear_mapa', 'personajes', 'ajustes', 'grieta'].includes(x[0]))) {
    await A.ev(CERRAR).catch(() => {}); await A.ev(`inicioPanel(null); 1`); await A.p.waitForTimeout(300);
    const e0 = await A.ev('PN.entradas'); await A.ev(pn[1]); await A.p.waitForTimeout(60); const c0 = await A.ev(CORREN);
    await A.p.waitForTimeout(1200); await A.ev(`(() => { for (const a of document.getAnimations()) { try { a.finish(); } catch (e) {} } return 1; })()`).catch(() => {});
    const M = await medir(A.p, pn[2]), e1 = await A.ev('PN.entradas');
    if (M.falta) { mal.push(pn[0] + ': no se ve'); continue; }
    if (M.probs.length) mal.push(`${pn[0]}: ` + M.probs.slice(0, 4).join(' | '));
    if (!c0.todas.length) mal.push(`${pn[0]}: sin entrada`);
    if (pn[2] === '.rbPan' && pn[0] !== 'personajes' && e1 - e0 < 1) mal.push(`${pn[0]}: no hubo rasgón`);
    if (D) await A.p.screenshot({ path: `${D}deposito_${pn[0]}.png` });
  }
  caso(`5. desde «Tu depósito» (${home}) los mismos paneles, con su entrada y la misma placa`, home === 'deposito' && !mal.length, mal.slice(0, 12));
  await A.ctx.close();
}

caso('6. sin errores de JS', !errJS.length, errJS.slice(0, 8));
await b.close();
const fallas = RES.filter((x) => !x).length;
console.log(fallas ? `${fallas} FALLAS de ${RES.length}` : `todo OK (${RES.length})`);
process.exit(fallas ? 1 : 0);
