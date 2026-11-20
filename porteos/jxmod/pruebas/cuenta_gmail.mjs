// La cuenta con la dirección de Gmail, sin Google, de punta a punta: el worker de la tienda de verdad (tienda/worker.js +
// cuenta.js + correo.js) corriendo acá con una base D1 en memoria y los correos en una lista (CORREO_PRUEBA: no salen).
// Se prueba, en un celular:
//  1. con sólo Gmail encendido: al abrir pide la cuenta con «Entrar con tu Gmail» (sin Google) y el chip dice «Iniciar sesión»;
//  2. una dirección que no es de Gmail no se acepta; con la de Gmail llega un correo con el código de 6 números (y lo
//     escrito con el teclado va al campo, no a los menús);
//  3. un código equivocado dice cuántos intentos quedan; el bueno entra: sesión, nombre, la dirección y las novedades;
//  4. el cartel de la cuenta muestra la dirección y deja apagar las novedades (también en el servidor);
//  5. la misma cuenta desde otro aparato escribiendo la dirección con puntos o +algo;
//  6. topes: 5 intentos por código, el código vence, 4 pedidos por hora a una dirección;
//  7. el enlace de baja de las novedades (con su firma; uno tocado no sirve);
//  8. con Google y Gmail encendidos: los dos botones con «o» en el medio, y el multijugador ofrece «Iniciar sesión»;
//  9. sin errores de JS.
// uso: node cuenta_gmail.mjs URL_HTML [CARPETA_FOTOS]
import './cf_sockets.mjs';
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import { DatabaseSync } from 'node:sqlite'; import { readFileSync, mkdirSync } from 'fs';
const [, , HTML, FOT = '/tmp/claude-0/cuenta_gmail'] = process.argv; mkdirSync(FOT, { recursive: true });
let ok = 0, mal = 0; const chk = (c, m, x) => { if (c) ok++; else mal++; console.log((c ? 'OK    ' : 'FALLA ') + m + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 360) : '')); };
const ROOT = new URL('../tienda/', import.meta.url).pathname, HOST = 'https://rezobox-tienda.holasoyjuniors365.workers.dev';
const db = new DatabaseSync(':memory:'); db.exec(readFileSync(ROOT + 'schema.sql', 'utf8'));
const st = (sql, a = []) => ({ bind: (...x) => st(sql, x.map((v) => (v === undefined ? null : typeof v === 'boolean' ? +v : v))), first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; }, x: () => db.prepare(sql).run(...a) });
const DB = { prepare: (s) => st(s), batch: async (L) => L.map((s) => s.x()) };
const W = (await import(ROOT + 'worker.js')).default;
const { CORREOS_PRUEBA } = await import(ROOT + 'correo.js');
const { bajaEnlace } = await import(ROOT + 'cuenta.js');
let env = { DB, CORREO_PRUEBA: '1', GMAIL_USUARIO: 'juego.jxmod@gmail.com', SAL: 'x' };
const llamar = async (ruta, o = {}) => { const r = await W.fetch(new Request(HOST + ruta, o), env, { waitUntil() {} }); let j = null; try { j = await r.clone().json(); } catch (e) {} return { st: r.status, j }; };
const codigoDe = (dir) => { const m = [...CORREOS_PRUEBA].reverse().find((x) => x.para === dir); const c = m && /(\d{6})/.exec(m.asunto); return c ? c[1] : null; };
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const err = [];
async function aparato() {
  const ctx = await b.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-AR' });
  await ctx.route(HOST + '/**', async (route) => {
    const q = route.request(), h = await q.allHeaders(); delete h['content-length'];
    const r = await W.fetch(new Request(q.url(), { method: q.method(), headers: h, body: ['GET', 'HEAD'].includes(q.method()) ? undefined : q.postDataBuffer() }), env, { waitUntil() {} });
    await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) });
  });
  const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message.slice(0, 200)));
  await p.goto((/^(https?|file):/.test(HTML) ? HTML : 'file://' + HTML) + (HTML.includes('?') ? '&' : '?') + 'test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; 1`);
  await p.waitForFunction(() => window.__ev('JUEGO.estado === "principal" && !!RB.el && !!CU.conf'), null, { timeout: 60000 });
  return { ctx, p, ev };
}
const esperar = (p, s, ms = 15000) => p.waitForFunction((x) => window.__ev(x), s, { timeout: ms }).then(() => true, () => false);
const dlg = (A) => A.ev(`(() => { const D = document.getElementById('cuDlg'); return D && !D.classList.contains('oc') ? { h: (D.querySelector('h3') || {}).textContent, p: [...D.querySelectorAll('p')].map((x) => x.textContent.trim()).filter(Boolean), botones: [...D.querySelectorAll('button')].map((x) => x.textContent.trim()), err: (D.querySelector('.cuErr') || {}).textContent || '' } : null; })()`);
const tocar = (A, sel) => A.p.locator('#cuDlg ' + sel).click();

// ---- 1) sólo Gmail ----
const A = await aparato();
const conf = await A.ev(`CU.conf`);
const pide = await esperar(A.p, `!!document.querySelector('#cuDlg:not(.oc) [data-cu=gmail]')`, 30000);
const d1 = await dlg(A), chip = await A.ev(`(() => { const c = document.querySelector('.cuChip'); return c ? c.textContent.trim() : null; })()`);
chk(conf.correo === true && conf.google === false && pide && !d1.botones.some((x) => /Google/.test(x)) && d1.botones.includes('Entrar con tu Gmail') && /Iniciar sesión/.test(chip || ''), '1. sólo Gmail: al abrir pide la cuenta con «Entrar con tu Gmail» (sin Google); el chip dice «Iniciar sesión»', { conf, botones: d1.botones, chip });
await A.p.screenshot({ path: FOT + '/1_elegir.png' });
// ---- 2) la dirección ----
await tocar(A, '[data-cu=gmail]'); await A.p.waitForTimeout(150);
await A.p.locator('#cuMail').click(); await A.p.keyboard.type('ana.perez@hotmail.com', { delay: 5 });
await tocar(A, '[data-cu=mandar]'); await A.p.waitForTimeout(200);
const d2 = await dlg(A);
chk(/Gmail/.test(d2.err) && CORREOS_PRUEBA.length === 0, '2. una dirección que no es de Gmail no se acepta (y no sale correo)', d2.err);
await A.p.locator('#cuMail').fill(''); await A.p.locator('#cuMail').click(); await A.p.keyboard.type('Ana.Perez@gmail.com', { delay: 5 });
const tipeado = await A.ev(`document.getElementById('cuMail').value`);
await A.p.locator('#cuNov').check(); await A.p.screenshot({ path: FOT + '/2_direccion.png' });
await A.p.keyboard.press('Enter');
await esperar(A.p, `!!document.getElementById('cuCod')`, 10000);
const d3 = await dlg(A), cod = codigoDe('ana.perez@gmail.com'), correo = CORREOS_PRUEBA[0];
chk(tipeado === 'Ana.Perez@gmail.com' && cod && correo && /Tu código de JXMod: \d{6}/.test(correo.asunto) && correo.texto.includes(cod) && d3.p.some((x) => x.includes('ana.perez@gmail.com')), '2. con la de Gmail (escrita con el teclado, Enter) llega el correo con el código y pasa al paso del código', { tipeado, asunto: correo && correo.asunto, p: d3.p });
await A.p.screenshot({ path: FOT + '/3_codigo.png' });
// ---- 3) el código ----
await A.p.locator('#cuCod').fill(cod === '000000' ? '111111' : '000000'); await tocar(A, '[data-cu=codigo]');
await esperar(A.p, `/intentos/.test((document.querySelector('#cuDlg .cuErr') || {}).textContent || '')`, 8000);
const d4 = await dlg(A);
chk(/Te quedan 4 intentos/.test(d4.err), '3. un código equivocado dice cuántos intentos quedan', d4.err);
await A.p.locator('#cuCod').fill(cod); await A.p.locator('#cuNom').fill('Ana'); await tocar(A, '[data-cu=codigo]');
const entro = await esperar(A.p, `!!CU.token`, 10000);
const u = await A.ev(`({ u: CU.u, dlg: !document.getElementById('cuDlg').classList.contains('oc'), chip: (document.querySelector('.cuChip') || {}).textContent })`);
const yo = await A.p.evaluate(async (H) => { const t = JSON.parse(localStorage.getItem('jx_cuenta')).token; const r = await fetch(H + '/api/cuenta/yo', { headers: { Authorization: 'Bearer ' + t } }); return r.json(); }, HOST);
chk(entro && u.u.nombre === 'Ana' && u.u.correo === 'ana.perez@gmail.com' && u.u.avisos === true && !u.dlg && /Ana/.test(u.chip || '') && yo.usuario && yo.usuario.avisos === true, '3. el código bueno entra: sesión, nombre, dirección y novedades (también en el servidor)', { u: u.u, chip: u.chip, yo: yo.usuario });
// ---- 4) el cartel de la cuenta ----
await A.ev(`cuDialogo(); 1`); await A.p.waitForTimeout(150);
const d5 = await dlg(A); await A.p.screenshot({ path: FOT + '/4_cuenta.png' });
await A.p.locator('#cuNovCta').uncheck(); await A.p.waitForTimeout(600);
const yo2 = await A.p.evaluate(async (H) => { const t = JSON.parse(localStorage.getItem('jx_cuenta')).token; const r = await fetch(H + '/api/cuenta/yo', { headers: { Authorization: 'Bearer ' + t } }); return r.json(); }, HOST);
chk(d5.p.some((x) => x.includes('ana.perez@gmail.com')) && yo2.usuario.avisos === false, '4. el cartel de la cuenta muestra la dirección y apaga las novedades', { p: d5.p, avisos: yo2.usuario.avisos });
await A.ev(`cuDialogoCerrar(); 1`);
const idAna = u.u.id;
// ---- 5) otro aparato, con puntos y +algo ----
const r1 = await llamar('/api/cuenta/correo/pedir', { method: 'POST', body: JSON.stringify({ correo: 'anaperez+celu@gmail.com' }) });
const r2 = await llamar('/api/cuenta/correo/entrar', { method: 'POST', body: JSON.stringify({ correo: 'anaperez+celu@gmail.com', codigo: codigoDe('anaperez+celu@gmail.com') }) });
chk(r1.j.ok && r2.j && r2.j.token && r2.j.usuario.id === idAna && r2.j.nueva === false, '5. la misma cuenta desde otro aparato con la dirección escrita distinto (sin puntos, +algo)', { pedir: r1.j, entrar: r2.j && { id: r2.j.usuario && r2.j.usuario.id, nueva: r2.j.nueva } });
// ---- 6) topes ----
await llamar('/api/cuenta/correo/pedir', { method: 'POST', body: JSON.stringify({ correo: 'betogomez@gmail.com' }) });
const malos = []; for (let i = 0; i < 6; i++) { const r = await llamar('/api/cuenta/correo/entrar', { method: 'POST', body: JSON.stringify({ correo: 'betogomez@gmail.com', codigo: '99999' + i }) }); malos.push(r.st + (r.j.quedan !== undefined ? ':' + r.j.quedan : '')); }
const conBueno = await llamar('/api/cuenta/correo/entrar', { method: 'POST', body: JSON.stringify({ correo: 'betogomez@gmail.com', codigo: codigoDe('betogomez@gmail.com') }) });
await llamar('/api/cuenta/correo/pedir', { method: 'POST', body: JSON.stringify({ correo: 'caroluna@gmail.com' }) });
db.prepare("UPDATE correo_codigos SET vence = 1 WHERE canon = 'caroluna@gmail.com'").run();
const vencido = await llamar('/api/cuenta/correo/entrar', { method: 'POST', body: JSON.stringify({ correo: 'caroluna@gmail.com', codigo: codigoDe('caroluna@gmail.com') }) });
const pedidos = []; for (let i = 0; i < 5; i++) pedidos.push((await llamar('/api/cuenta/correo/pedir', { method: 'POST', body: JSON.stringify({ correo: 'dani.sosa@gmail.com' }) })).st);
chk(malos.join(',') === '401:4,401:3,401:2,401:1,401:0,429' && conBueno.st === 429 && vencido.st === 410 && pedidos.join(',') === '200,200,200,200,429', '6. topes: 5 intentos por código (después ni el bueno), vence, 4 pedidos por hora', { malos, bueno: conBueno.st, vencido: vencido.st, pedidos });
// ---- 7) la baja de las novedades ----
db.prepare('UPDATE usuarios SET avisos = 1 WHERE id = ?').run(idAna);
const enl = await bajaEnlace(env, HOST + '/api/', idAna), u0 = new URL(enl);
const malo = await W.fetch(new Request(enl.slice(0, -1) + (enl.slice(-1) === '0' ? '1' : '0')), env, { waitUntil() {} });
const avisosMalo = db.prepare('SELECT avisos FROM usuarios WHERE id = ?').get(idAna).avisos;
const bien = await W.fetch(new Request(enl), env, { waitUntil() {} });
const avisosBien = db.prepare('SELECT avisos FROM usuarios WHERE id = ?').get(idAna).avisos;
chk(malo.status === 400 && avisosMalo === 1 && bien.status === 200 && avisosBien === 0 && /no te mandamos más/.test(await bien.text()), '7. el enlace de baja apaga las novedades; uno tocado no sirve', { malo: malo.status, bien: bien.status, k: u0.searchParams.get('k').length });
await A.ctx.close();
// ---- 8) Google y Gmail ----
env = { ...env, GOOGLE_CLIENT_ID: 'jx-prueba.apps.googleusercontent.com' };
const B = await aparato();
await esperar(B.p, `!!document.querySelector('#cuDlg:not(.oc) [data-cu=gmail]')`, 30000);
const d8 = await dlg(B); await B.p.screenshot({ path: FOT + '/5_google_y_gmail.png' });
await B.ev(`cuCancelar(); inicioAccion('multi'); 1`); await B.p.waitForTimeout(400);
const mp = await B.ev(`(() => { const x = RB.el.querySelector('.cuPanel button'); return x ? x.textContent.trim() : null; })()`);
await B.ev(`RB.el.querySelector('.cuPanel button').click(); 1`); await B.p.waitForTimeout(250);
const d9 = await dlg(B);
chk(d8 && d8.botones.includes('Iniciar sesión con Google') && d8.botones.includes('Entrar con tu Gmail') && mp === 'Iniciar sesión' && d9 && d9.botones.includes('Iniciar sesión con Google') && d9.botones.includes('Entrar con tu Gmail') && (await B.ev(`(document.querySelector('#cuDlg .cuO') || {}).textContent`)) === 'o', '8. con Google y Gmail: al abrir y desde el multijugador («Iniciar sesión»), los dos botones con «o»', { alAbrir: d8 && d8.botones, mp, botones: d9 && d9.botones });
await B.ctx.close();
chk(!err.length, '9. sin errores de JS', err.slice(0, 4));
console.log(`\n${ok}/${ok + mal}`);
await b.close(); process.exit(mal ? 1 : 0);
