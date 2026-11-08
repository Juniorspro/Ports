// lo social de punta a punta, con el worker de la tienda de verdad (tienda/worker.js + cuenta.js + social.js) corriendo
// acá con una base D1 en memoria y sesiones de Google simuladas (el ID token lo firma esta prueba). Dos aparatos: Ana en la
// compu y Beto en el celu (Caro sólo por la API). Se prueba: el perfil con su ID de 8 números, cambiar el nombre y el
// estado; buscar por ID (y uno que no existe), las búsquedas recientes; pedir amistad → el globito del otro → aceptar;
// amigos en línea/desconectados; el chat privado (mandar, recibir, «escribiendo…», ✓✓ leído, la censura); un grupo con
// tres; la invitación a partida con «Entrar»; bloquear (ya no se escriben ni se encuentran) y desbloquear; y que cada
// pestaña entre en la pantalla de la compu y del celu sin desbordarse.
// uso: node social.mjs URL_HTML
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import { DatabaseSync } from 'node:sqlite'; import { readFileSync } from 'fs';
const [, , HTML] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const ROOT = new URL('../tienda/', import.meta.url).pathname, HOST = 'https://rezobox-tienda.holasoyjuniors365.workers.dev';
// ---- D1 en memoria ----
const db = new DatabaseSync(':memory:'); db.exec(readFileSync(ROOT + 'schema.sql', 'utf8'));
const st = (sql, a = []) => ({ bind: (...x) => st(sql, x), first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => ({ meta: { changes: db.prepare(sql).run(...a).changes } }), x() { const q = db.prepare(sql); return /^\s*select/i.test(sql) ? { results: q.all(...a) } : { meta: { changes: q.run(...a).changes } }; } });
const DB = { prepare: (s) => st(s), batch: async (L) => L.map((s) => s.x()) };
const CLIENTE = 'jx-prueba.apps.googleusercontent.com', env = { DB, GOOGLE_CLIENT_ID: CLIENTE, SAL: 'x' };
// ---- Google de mentira ----
const par = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const pub = await crypto.subtle.exportKey('jwk', par.publicKey); Object.assign(pub, { kid: 'k1', alg: 'RS256', use: 'sig' });
const b64u = (b) => Buffer.from(b).toString('base64url');
async function token(o) { const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' })), ahora = Math.floor(Date.now() / 1000);
  const p = b64u(JSON.stringify(Object.assign({ iss: 'https://accounts.google.com', aud: CLIENTE, iat: ahora, exp: ahora + 3600 }, o)));
  const s = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', par.privateKey, new TextEncoder().encode(h + '.' + p)); return h + '.' + p + '.' + b64u(new Uint8Array(s)); }
const fetch0 = globalThis.fetch;
globalThis.fetch = async (u, o) => (String(u).startsWith('https://www.googleapis.com/oauth2/v3/certs') ? new Response(JSON.stringify({ keys: [pub] }), { headers: { 'Content-Type': 'application/json' } }) : fetch0(u, o));
const W = (await import(ROOT + 'worker.js')).default;
const llamar = async (ruta, o = {}, e = env) => { const r = await W.fetch(new Request(HOST + ruta, o), e, { waitUntil() {} }); let j = null; try { j = await r.clone().json(); } catch (er) {} return { st: r.status, j }; };
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
// (una sesión entera sin navegador: el mismo camino que la página de entrada)
async function sesion(sub, nombre) {
  const v = b64u(crypto.getRandomValues(new Uint8Array(32))), e = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  const g = await llamar('/api/cuenta/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: await token({ sub, name: nombre, nonce: e }), e }) });
  const l = await llamar('/api/cuenta/listo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v }) });
  if (g.st !== 200 || !l.j || !l.j.token) throw new Error('sesión ' + nombre + ': ' + JSON.stringify([g, l]));
  return { token: l.j.token, u: l.j.usuario };
}
const api = (S, ruta, body) => llamar('/api/social/' + ruta, body === undefined ? { headers: { Authorization: 'Bearer ' + S.token } } : { method: 'POST', headers: { Authorization: 'Bearer ' + S.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const SA = await sesion('2001', 'Ana'), SB = await sesion('2002', 'Beto'), SC = await sesion('2003', 'Caro');
const pidDe = async (S) => (await api(S, 'yo')).j.perfil.pid;
const PA = await pidDe(SA), PB = await pidDe(SB), PC = await pidDe(SC);
ok('cada cuenta tiene un ID de 8 números distinto', [PA, PB, PC].every((x) => /^\d{8}$/.test(x)) && new Set([PA, PB, PC]).size === 3, [PA, PB, PC]);

let LENTO = 0, LENTO_P = 0; const LOG = [];
async function ruteo(ctx) {
  await ctx.route(HOST + '/**', async (route) => {
    const q = route.request(), h = await q.allHeaders(); delete h['content-length'];
    if (LENTO && q.url().includes('/api/social/yo')) await new Promise((r) => setTimeout(r, LENTO));   // (internet lento)
    if (LENTO_P && q.url().includes('/api/social/perfil')) await new Promise((r) => setTimeout(r, LENTO_P));
    const r = await W.fetch(new Request(q.url(), { method: q.method(), headers: h, body: ['GET', 'HEAD'].includes(q.method()) ? undefined : q.postDataBuffer() }), env, { waitUntil() {} });
    const cu = Buffer.from(await r.arrayBuffer()); if (/\/api\/social\/amigo/.test(q.url())) LOG.push([q.postData(), r.status, cu.toString().slice(0, 120)]);
    await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: cu });
  });
}
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
async function aparato(S, celu) {
  const ctx = await b.newContext(celu ? { viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } }); await ruteo(ctx);
  await ctx.addInitScript((s) => { try { if (!localStorage.getItem('jx_cuenta')) localStorage.setItem('jx_cuenta', JSON.stringify(s)); } catch (e) {} }, S);
  const p = await ctx.newPage(), err = []; p.on('pageerror', (e) => err.push(e.message.slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|net::|ERR_|404|favicon/.test(m.text())) err.push('consola: ' + m.text().slice(0, 200)); });
  await p.goto(HTML); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await p.waitForFunction(() => window.__ev('JUEGO.estado === "principal" && !!RB.el && !!CU.conf && !!CU.token'), null, { timeout: 60000 });
  await ev(`PREFS.bienvenida = true; inicioPanel(null); 1`); await p.waitForTimeout(300);
  return { ctx, p, ev, err, celu };
}
const esperar = (p, s, ms = 15000) => p.waitForFunction((x) => window.__ev(x), s, { timeout: ms }).then(() => true, () => false);
const clic = (A, sel) => A.ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
const tab = async (A, t) => { await clic(A, `.rbPan_social [data-rb="soc:tab|${t}"]`); await A.p.waitForTimeout(500); };
// (nada se sale del panel ni de su columna, sin barra horizontal)
const desborde = (A) => A.ev(`(() => { const P = document.querySelector('.rbPan_social'); if (!P) return ['sin panel']; const pr = P.getBoundingClientRect(), mal = [];
  if (P.scrollWidth > P.clientWidth + 1) mal.push('panel ' + P.scrollWidth + '>' + P.clientWidth);
  for (const c of P.querySelectorAll('.soIzq, .soDer, .soConv, .soMsgs, .soLista')) if (c.scrollWidth > c.clientWidth + 1) mal.push(c.className + ' ' + c.scrollWidth + '>' + c.clientWidth);
  for (const e of P.querySelectorAll('button, input, .soIt, .soCard, .soBur, .soVista')) { const r = e.getBoundingClientRect(); if (r.width && (r.right > pr.right + 1 || r.left < pr.left - 1)) mal.push((e.className || e.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); }
  const cab = P.querySelector('.rbPanCab').getBoundingClientRect(); if (cab.height > innerHeight * 0.3) mal.push('cabecera alta ' + Math.round(cab.height));
  return mal.slice(0, 6); })()`);

const A = await aparato(SA, false), B = await aparato(SB, true);
// ---- el menú: Social y su globito ----
const menu = await A.ev(`(() => { const it = RB.el.querySelector('.rbIt[data-rb=social]'); return { hay: !!it, txt: it && it.textContent.trim(), dlg: !!document.querySelector('#cuDlg:not(.oc)') }; })()`);
ok('el menú principal tiene «Social» y con sesión no pide entrar', menu.hay && /Social/.test(menu.txt) && !menu.dlg, menu);
// ---- perfil ----
await A.ev(`inicioAccion('social'); 1`); await A.p.waitForTimeout(600); await tab(A, 'perfil');
await esperar(A.p, `!!document.querySelector('.soId b') && /\\d{8}/.test(document.querySelector('.soId b').textContent)`);
const perf = await A.ev(`({ id: document.querySelector('.soId b').textContent, nom: document.querySelector('.soNomIn').value, est: document.querySelector('.soEst').textContent, d3: RB.el.classList.contains('rb3d') && !!MENU.lobby, fondo: !!document.querySelector('[data-rb="soc:fondo"]') })`);
ok('Perfil: el ID de 8 números de la cuenta, el nombre, «En línea» y el personaje en 3D', perf.id === PA && perf.nom === 'Ana' && /l[ií]nea|online/i.test(perf.est) && perf.d3 && perf.fondo, perf);
await A.ev(`(() => { const n = document.querySelector('.soNomIn'); n.value = 'Ana Gamer'; n.dispatchEvent(new Event('change')); return 1; })()`); await A.p.waitForTimeout(600);
const f0 = await A.ev(`LOBBY_LUZ.fondo.join(',')`); await clic(A, '[data-rb="soc:fondo"]'); const f1 = await A.ev(`LOBBY_LUZ.fondo.join(',')`);
ok('cambiar el nombre llega a la tienda (y al jugador); «Cambiar fondo» cambia el fondo', (await api(SB, 'buscar?pid=' + PA)).j.perfil.nombre === 'Ana Gamer' && f0 !== f1, { f0, f1 });
await A.p.screenshot({ path: 'social_perfil_pc.png' });
ok('Perfil (compu): nada desbordado', !(await desborde(A)).length, await desborde(A));
// ---- buscar ----
await tab(A, 'buscar');
await A.ev(`(() => { const i = document.querySelector('.soBusIn'); i.value = '12x34'; i.dispatchEvent(new Event('input')); return 1; })()`); await clic(A, '[data-rb="soc:buscar"]'); await A.p.waitForTimeout(500);
const mal = await A.ev(`({ q: SOC.q, vacio: !!document.querySelector('.soIzq .soVacio') })`);
const noHay = PA === '99999999' || PB === '99999999' || PC === '99999999' ? '99999998' : '99999999';
await A.ev(`SOC.q = '${noHay}'; socAccion('buscar')`); await A.p.waitForTimeout(500);
const nada = await A.ev(`!!document.querySelector('.soIzq .soVacio')`);
ok('Buscar: sólo números; un ID que no existe dice «no existe»', mal.q === '1234' && nada, mal);
await A.ev(`SOC.q = '${PB}'; socAccion('buscar')`); await esperar(A.p, `!!document.querySelector('.soRes')`);
const res = await A.ev(`({ nom: document.querySelector('.soResI b').textContent, agregar: !!document.querySelector('.soRes [data-rb="soc:amigo|pedir|${PB}"]'), tarjeta: (document.querySelector('.soDer h3') || {}).textContent, rec: [...document.querySelectorAll('.soLista .soIt b')].map((x) => x.textContent) })`);
ok('Buscar por ID: la tarjeta de Beto con «Agregar» y queda en «Búsquedas recientes»', res.nom === 'Beto' && res.agregar && res.tarjeta === 'Beto' && res.rec.includes('Beto'), res);
await clic(A, `.soRes [data-rb="soc:amigo|pedir|${PB}"]`); await A.p.waitForTimeout(600);
const pedido = await A.ev(`({ ok: !!document.querySelector('.soRes .soOk'), rel: SOC.busc && SOC.busc.rel })`);
ok('«Agregar» manda la solicitud (queda «Solicitud enviada»)', pedido.ok && pedido.rel && pedido.rel.pedi, pedido);
await A.p.screenshot({ path: 'social_buscar_pc.png' });
ok('Buscar (compu): nada desbordado', !(await desborde(A)).length, await desborde(A));
// ---- Beto: globito y aceptar ----
await B.ev(`SOC.latir(); 1`); await esperar(B.p, `SOC.badge >= 1`);
const glo = await B.ev(`(() => { const e = RB.el.querySelector('.rbIt[data-rb=social] .soBadge'); return e ? e.textContent : null; })()`);
ok('a Beto le aparece el globito en «Social» con la solicitud', glo === '1', glo);
await B.ev(`inicioAccion('social'); 1`); await B.p.waitForTimeout(600); await tab(B, 'amigos');
await esperar(B.p, `!!document.querySelector('[data-rb="soc:sub|sol"]')`); await clic(B, '[data-rb="soc:sub|sol"]'); await esperar(B.p, `!!document.querySelector('[data-rb="soc:amigo|aceptar|${PA}"]')`);
await B.p.screenshot({ path: 'social_solicitudes_celu.png' });
const hayAc = await B.ev(`document.querySelectorAll('[data-rb="soc:amigo|aceptar|${PA}"]').length`); const cl = await clic(B, `[data-rb="soc:amigo|aceptar|${PA}"]`); await B.p.waitForTimeout(700); const tras = await B.ev(`({ sub: SOC.sub, txt: (document.querySelector('.soIzq') || {}).innerText })`);
await clic(B, '[data-rb="soc:sub|amigos"]'); await B.p.waitForTimeout(500);
await esperar(B.p, `[...document.querySelectorAll('.soIzq .soIt b')].some((x) => x.textContent === 'Ana Gamer')`);
const am = await B.ev(`({ txt: (document.querySelector('.soIzq') || {}).innerText, sub: SOC.sub, tab: SOC.tab, A: SOC.amigos && { a: SOC.amigos.amigos.length, r: SOC.amigos.recibidas.length }, filas: [...document.querySelectorAll('.soIzq .soIt b')].map((x) => x.textContent), on: [...document.querySelectorAll('.soIzq .soIt small.on')].length, tarjeta: (document.querySelector('.soDer h3') || {}).textContent, msg: !!document.querySelector('.soDer [data-rb="soc:dm|${PA}"]') })`);
ok('Beto acepta: Ana queda en Amigos, en línea, con su tarjeta (Invitar, Mensaje)', am.filas.includes('Ana Gamer') && am.on >= 1 && am.tarjeta === 'Ana Gamer' && am.msg, { ...am, hayAc, cl, tras, err: B.err.slice(0, 3), log: LOG.filter((x) => x[0]).slice(-3) });
await B.p.screenshot({ path: 'social_amigos_celu.png' });
ok('Amigos (celu): nada desbordado', !(await desborde(B)).length, await desborde(B));
// ---- chat privado ----
await tab(A, 'amigos'); await esperar(A.p, `!!document.querySelector('.soDer [data-rb="soc:dm|${PB}"]')`);
await clic(A, `.soDer [data-rb="soc:dm|${PB}"]`); await esperar(A.p, `!!document.querySelector('.soMsgIn')`);
await A.ev(`(() => { const i = document.querySelector('.soMsgIn'); i.value = 'hola Beto, ¿jugamos?'; return 1; })()`); await clic(A, '[data-rb="soc:enviar"]');
await esperar(A.p, `[...document.querySelectorAll('.soMsg.mio .soBur')].some((x) => x.textContent.includes('jugamos'))`);
await B.ev(`SOC.latir(); 1`); await B.p.waitForTimeout(400); await tab(B, 'chats');
await esperar(B.p, `!!document.querySelector('.soChatIt .soBadge')`);
const lista = await B.ev(`({ nom: (document.querySelector('.soChatIt b') || {}).textContent, ult: (document.querySelector('.soChatIt small') || {}).textContent, nl: (document.querySelector('.soChatIt .soBadge') || {}).textContent })`);
ok('Beto: el chat de Ana en la lista con el último mensaje y 1 sin leer', lista.nom === 'Ana Gamer' && /jugamos/.test(lista.ult) && lista.nl === '1', lista);
await clic(B, '.soChatIt'); await esperar(B.p, `[...document.querySelectorAll('.soMsg:not(.mio) .soBur')].some((x) => x.textContent.includes('jugamos'))`);
// (Beto escribe: a Ana le sale «Beto está escribiendo…»)
await B.ev(`(() => { const i = document.querySelector('.soMsgIn'); i.value = 'da'; i.dispatchEvent(new Event('input')); return 1; })()`);
const escr = await esperar(A.p, `/Beto/.test((document.querySelector('.soEsc') || {}).textContent || '')`, 8000);
ok('mientras Beto escribe, a Ana le sale «Beto está escribiendo…»', escr, await A.ev(`(document.querySelector('.soEsc') || {}).textContent`));
const leido = await esperar(A.p, `!!document.querySelector('.soMsg.mio i.leido')`, 8000);
ok('el mensaje de Ana pasa a ✓✓ leído cuando Beto lo abre', leido);
await B.ev(`(() => { const i = document.querySelector('.soMsgIn'); i.value = 'dale, puta madre que lag'; return 1; })()`); await clic(B, '[data-rb="soc:enviar"]');
const llego = await esperar(A.p, `[...document.querySelectorAll('.soMsg:not(.mio) .soBur')].some((x) => x.textContent.includes('dale'))`, 8000);
const txtB = await A.ev(`[...document.querySelectorAll('.soMsg:not(.mio) .soBur')].map((x) => x.textContent).find((t) => t.includes('dale'))`);
ok('la respuesta de Beto le llega sola a Ana (sin tocar nada) y censurada', llego && !/puta/i.test(txtB || ''), txtB);
const sinEsc = await esperar(A.p, `!(document.querySelector('.soEsc') || {}).textContent`, 12000);
ok('«escribiendo…» se va solo', sinEsc);
await A.p.screenshot({ path: 'social_chat_pc.png' }); await B.p.screenshot({ path: 'social_chat_celu.png' });
ok('Chat (compu y celu): nada desbordado', !(await desborde(A)).length && !(await desborde(B)).length, [await desborde(A), await desborde(B)]);
// ---- invitar a partida ----
await clic(A, '.soConvCab [data-rb="soc:invitarChat"]'); await A.p.waitForTimeout(300);
const sinServer = await A.ev(`SOC.msgs.filter((m) => m.tipo === 'inv').length`);
ok('fuera de un server «Invitar» no manda nada (avisa que entres a uno)', sinServer === 0);
await A.ev(`socApi('chat/' + SOC.chat + '/enviar', { method: 'POST', body: { inv: { id: 'abcd1234', n: 'Server de Ana', m: 'FlatGrass', mods: 3 } } })`);
await esperar(B.p, `!!document.querySelector('.soInv [data-rb^="soc:unirse"]')`, 8000);
const inv = await B.ev(`(() => { const c = document.querySelector('.soInv'); return { txt: c.textContent, entrar: !!c.querySelector('button') }; })()`);
ok('a Beto le llega la tarjeta «Invitación a partida» (mapa, mods, server) con «Entrar»', /Server de Ana/.test(inv.txt) && /3 mods/.test(inv.txt) && inv.entrar, inv);
await B.ev(`window.__entro = null; listaSalas = () => [{ S: { id: 'abcd1234', n: 'Server de Ana', m: 'FlatGrass' }, j: [1] }]; entrarSala = (S) => { window.__entro = S.id; }; 1`);
await clic(B, '.soInv [data-rb^="soc:unirse"]'); await B.p.waitForTimeout(300);
const entro = await B.ev(`window.__entro`);
ok('«Entrar» lo mete al server de la invitación', entro === 'abcd1234', entro);
await B.p.screenshot({ path: 'social_invitacion_celu.png' });
// ---- grupo de tres ----
await api(SC, 'amigo', { pid: PA, accion: 'pedir' }); await api(SA, 'amigo', { pid: PC, accion: 'aceptar' });
await api(SC, 'amigo', { pid: PB, accion: 'pedir' }); await api(SB, 'amigo', { pid: PC, accion: 'aceptar' });
await api(SC, 'latido', { sala: null, skin: 'Hero' });
await A.ev(`SOC.amigos = null; 1`); await clic(A, '[data-rb="soc:grupoNuevo"]'); await esperar(A.p, `!!document.querySelector('#cfDlg:not(.oc) .soElegir')`);
await A.p.screenshot({ path: 'social_grupo_elegir_pc.png' });
await A.ev(`(() => { const D = document.getElementById('cfDlg'); D.querySelector('.soGN').value = 'Los pibes'; D.querySelectorAll('input[type=checkbox]').forEach((c) => { c.checked = true; }); D.querySelector('[data-cf=si]').click(); return 1; })()`);
await esperar(A.p, `!!document.querySelector('.soConvCab') && /Los pibes/.test(document.querySelector('.soConvCab').textContent)`, 8000);
// (el aviso de «creó el grupo» llega con el mensaje del servidor, después de la cabecera)
await esperar(A.p, `!!document.querySelector('.soSis')`, 8000).catch(() => {});
const gA = await A.ev(`({ cab: document.querySelector('.soConvCab').textContent.replace(/\\s+/g, ' ').trim(), sis: [...document.querySelectorAll('.soSis')].map((x) => x.textContent) })`);
ok('Ana crea el grupo «Los pibes» con Beto y Caro (cabecera con 3 miembros) y el aviso en el idioma del jugador', /Los pibes/.test(gA.cab) && /3/.test(gA.cab) && gA.sis.includes('Ana Gamer created the group'), gA);
await A.ev(`(() => { const i = document.querySelector('.soMsgIn'); i.value = 'bienvenidos al grupo'; return 1; })()`); await clic(A, '[data-rb="soc:enviar"]'); await A.p.waitForTimeout(500);
const chC = (await api(SC, 'chats')).j.chats.find((c) => c.nombre === 'Los pibes');
const msC = chC && (await api(SC, 'chat/' + chC.id + '?desde=0')).j.mensajes;
ok('a Caro le aparece el grupo con el mensaje de Ana', !!chC && chC.tipo === 'grupo' && msC.some((m) => m.texto === 'bienvenidos al grupo' && m.de.nombre === 'Ana Gamer'), chC);
await api(SC, 'chat/' + chC.id + '/enviar', { texto: 'buenas!' });
await B.ev(`SOC.chats = null; SOC.chat = null; inicioPanel('social'); 1`); await esperar(B.p, `[...document.querySelectorAll('.soChatIt b')].some((x) => x.textContent === 'Los pibes')`);
await B.ev(`(() => { const it = [...document.querySelectorAll('.soChatIt')].find((x) => /Los pibes/.test(x.textContent)); it.click(); return 1; })()`);
await esperar(B.p, `[...document.querySelectorAll('.soMsg .soBur')].some((x) => x.textContent.includes('buenas!'))`, 8000);
const gB = await B.ev(`({ de: [...document.querySelectorAll('.soMsg:not(.mio) .soDe')].map((x) => x.textContent) })`);
ok('Beto ve el grupo con quién dijo cada cosa (Ana Gamer, Caro)', gB.de.includes('Ana Gamer') && gB.de.includes('Caro'), gB);
await B.p.screenshot({ path: 'social_grupo_celu.png' });
await clic(B, '[data-rb="soc:miembros"]'); await esperar(B.p, `!!document.querySelector('#cfDlg:not(.oc) .soLista')`);
const miem = await B.ev(`[...document.querySelectorAll('#cfDlg .soLista b')].map((x) => x.textContent)`);
ok('«Miembros» muestra a los tres', miem.length === 3 && miem.includes('Caro'), miem);
await B.ev(`document.querySelector('#cfDlg [data-cf=no]').click(); 1`);
ok('Grupo (celu): nada desbordado', !(await desborde(B)).length, await desborde(B));
// ---- estado: desconectado ----
await tab(A, 'perfil'); await esperar(A.p, `!!document.querySelector('[data-rb="soc:estado|off"]')`);
await clic(A, '[data-rb="soc:estado|off"]'); await A.p.waitForTimeout(600);
const offB = (await api(SB, 'amigos')).j.amigos.find((x) => x.pid === PA);
ok('Ana se pone «Desconectado»: Beto la ve desconectada', offB && !offB.online, offB);
await clic(A, '[data-rb="soc:estado|on"]'); await A.p.waitForTimeout(600);
ok('y al volver a «En línea» la ve en línea', (await api(SB, 'amigos')).j.amigos.find((x) => x.pid === PA).online);
// ---- bloquear ----
await tab(B, 'amigos'); await B.ev(`socAccion('sel|${PA}')`); await B.p.waitForTimeout(400);
await clic(B, `.soDer [data-rb="soc:amigo|bloquear|${PA}"]`); await esperar(B.p, `!!document.querySelector('#cfDlg:not(.oc) [data-cf=si]')`);
const preg = await B.ev(`document.querySelector('#cfDlg p').textContent`);
await B.ev(`document.querySelector('#cfDlg [data-cf=si]').click(); 1`); await B.p.waitForTimeout(700);
await clic(B, '[data-rb="soc:sub|bloq"]'); await B.p.waitForTimeout(400);
const bq = await B.ev(`[...document.querySelectorAll('.soIzq .soIt b')].map((x) => x.textContent)`);
ok('bloquear pide confirmación y Ana pasa a «Bloqueados»', preg.length > 5 && bq.includes('Ana Gamer'), { preg, bq });
const dmA = (await api(SA, 'chats')).j.chats.find((c) => c.tipo === 'dm');
const env1 = await api(SA, 'chat/' + dmA.id + '/enviar', { texto: 'hola?' }), bus = await api(SA, 'buscar?pid=' + PB), am2 = (await api(SA, 'amigos')).j.amigos.map((x) => x.pid);
ok('bloqueada, Ana ya no le puede escribir, no lo encuentra y no lo tiene de amigo', env1.st === 403 && bus.st === 404 && !am2.includes(PB), { env: env1.st, bus: bus.st });
await clic(B, `[data-rb="soc:amigo|desbloquear|${PA}"]`); await B.p.waitForTimeout(600);
ok('desbloquear la saca de «Bloqueados» (y vuelve a aparecer al buscar)', !(await B.ev(`[...document.querySelectorAll('.soIzq .soIt b')].some((x) => x.textContent === 'Ana Gamer')`)) && (await api(SA, 'buscar?pid=' + PB)).st === 200);
// ---- con internet lento: entrar al Perfil y volver antes de que llegue: el menú no queda con el personaje en 3D ----
await A.ev(`inicioPanel(null); 1`); await A.p.waitForTimeout(300); LENTO = 1800;
await A.ev(`SOC.tab = 'perfil'; SOC.yo = null; inicioPanel('social'); 1`); await A.p.waitForTimeout(250);
await clic(A, '.rbPan_social [data-rb=volver]'); await A.p.waitForTimeout(2600); LENTO = 0;
const lento = await A.ev(`({ rb3d: RB.el.classList.contains('rb3d'), lobby: !!MENU.lobby, panel: RB.panel || null, lista: !RB.el.querySelector('.rbLista').classList.contains('oc') })`);
ok('con internet lento, entrar al Perfil y volver enseguida deja el menú como estaba (sin el personaje en 3D ni el fondo crema)', !lento.rb3d && !lento.lobby && !lento.panel && lento.lista, lento);
await A.p.screenshot({ path: 'social_volver_lento.png' });
// ---- sin sesión / sin configurar ----
const sin = await llamar('/api/social/yo'), sinConf = await llamar('/api/social/yo', { headers: { Authorization: 'Bearer ' + SA.token } }, { DB });
ok('la tienda no deja usar lo social sin sesión (401) ni sin Google configurado', sin.st === 401 && sinConf.st >= 400, [sin.st, sinConf.st]);
// ---- cada pestaña en el celu ----
const malCelu = {};
for (const t of ['chats', 'amigos', 'buscar', 'perfil']) { await tab(B, t); await B.p.waitForTimeout(400); const d = await desborde(B); if (d.length) malCelu[t] = d; await B.p.screenshot({ path: 'social_' + t + '_celu.png' }); }
ok('las cuatro pestañas en el celu sin desbordes', !Object.keys(malCelu).length, malCelu);
// ---- en la partida (celu): el Perfil en la pausa con tu personaje en 3D y sin la HUD encima ----
await api(SB, 'amigo', { pid: PC, accion: 'borrar' });
await B.ev(`inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await esperar(B.p, `JUEGO.estado === 'juego' && !!JUG.cuerpo`, 90000); await B.p.waitForTimeout(1500);
await B.ev(`window.__nMenu = 0; { const f0 = dibujarMenu; dibujarMenu = function () { window.__nMenu++; return f0(); }; } inicioMostrar(true); SOC.tab = 'perfil'; inicioPanel('social'); 1`);
await esperar(B.p, `!!document.querySelector('.rbPan_social .soYo')`); await B.p.waitForTimeout(1500);
const pausa = await B.ev(`({ tactil: getComputedStyle(document.getElementById('tactil')).visibility, hud: getComputedStyle(document.getElementById('hud')).visibility, lobby: !!MENU.lobby, cuadros: window.__nMenu })`);
await B.p.screenshot({ path: 'social_pausa_celu.png' });
ok('en la pausa, el Perfil muestra tu personaje en 3D (no el juego de atrás) y los botones táctiles no se asoman', pausa.tactil === 'hidden' && pausa.hud === 'hidden' && pausa.lobby && pausa.cuadros > 5, pausa);
// ---- el estado En línea / Desconectado cambia al toque aunque la tienda tarde ----
LENTO_P = 2500; const t0 = Date.now(); await clic(B, '.rbPan_social [data-rb="soc:estado|off"]');
const inst = await B.ev(`({ sel: !!document.querySelector('.rbPan_social [data-rb="soc:estado|off"].sel'), txt: document.querySelector('.soYo .soEst').textContent })`); const ms = Date.now() - t0;
ok('el botón de estado cambia al toque (aunque la tienda tarde 2,5 s)', inst.sel && ms < 800, { ...inst, ms });
await B.p.waitForTimeout(3500); LENTO_P = 0; const estG = (await api(SB, 'yo')).j.estado;
ok('y queda guardado en la tienda', estG === 'off', estG);
await clic(B, '.rbPan_social [data-rb="soc:estado|on"]'); await B.p.waitForTimeout(800);
// ---- agregar de amigo a alguien de tu sala sin escribir su ID ----
await B.ev(`recibirEstado({ i: 'caro', n: 'Caro', k: 'Hero', h: 'HatEmpty', p: [JUG.pos.x + 3, JUG.pos.y, JUG.pos.z], v: [0, 0, 0], y: 0, t: 0, f: 5, a: null, e: 0, sp: '${PC}' }); 1`);
await tab(B, 'amigos'); await esperar(B.p, `!!document.querySelector('[data-rb="soc:sub|amigos"]')`); await clic(B, '[data-rb="soc:sub|amigos"]');
await esperar(B.p, `!!document.querySelector('.rbPan_social [data-rb="soc:sala|${PC}"]')`, 6000);
const sala = await B.ev(`({ boton: !!document.querySelector('.rbPan_social [data-rb="soc:sala|${PC}"]'), sec: [...document.querySelectorAll('.rbPan_social .soSec')].map((x) => x.textContent) })`);
await B.p.screenshot({ path: 'social_sala_celu.png' });
ok('en Amigos aparece «En esta sala» con Caro y su botón Agregar', sala.boton && sala.sec.some((x) => /sala|room/i.test(x)), sala);
await clic(B, `.rbPan_social [data-rb="soc:sala|${PC}"]`); await B.p.waitForTimeout(1500);
const rc = (await api(SC, 'amigos')).j.recibidas.map((x) => x.pid);
ok('al tocar Agregar, a Caro le llega la solicitud (sin escribir el ID)', rc.includes(PB), rc);
await B.ev(`inicioMostrar(false); celAbrir('gente'); 1`); await B.p.waitForTimeout(800);
const cel = await B.ev(`(() => { const f = [...document.querySelectorAll('#celular .celPers')].find((x) => /Caro/.test(x.textContent)); return f ? f.textContent : null; })()`);
await B.p.screenshot({ path: 'social_cel_gente.png' });
ok('en el celular (Gente) Caro figura con la solicitud enviada', !!cel && /enviada|sent/i.test(cel), cel);
await api(SC, 'amigo', { pid: PB, accion: 'rechazar' }); await B.ev(`SOC.sala = {}; celDibujar(); 1`); await B.p.waitForTimeout(1500);
await clic(B, `#celular [data-cel="amigo|${PC}"]`); await B.p.waitForTimeout(1500);
const rc2 = (await api(SC, 'amigos')).j.recibidas.map((x) => x.pid);
ok('desde el celular también se agrega (Gente → Agregar)', rc2.includes(PB), rc2);
const errs = [...A.err, ...B.err];
ok('sin errores de JS en los dos aparatos', !errs.length, errs);
await b.close();
const n = R.filter(Boolean).length; console.log(`RESUMEN ${n}/${R.length}`); process.exit(n === R.length ? 0 : 1);
