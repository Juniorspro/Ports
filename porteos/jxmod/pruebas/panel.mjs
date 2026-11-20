// El panel entero, en la compu (servidor local con las mismas rutas: panel_servidor.mjs):
//  1. la app admin: pide entrar, Claude la aprueba (panel.py aprobar) y entra; ve quién juega
//  2. el juego avisa que está jugando (mapa y versión) y manda sus errores de JS
//  3. Bugs y sugerencias en el menú del juego: publicar un bug con una foto y un video; se ve en la lista y en el detalle
//  4. la app lo ve, le pone estado y responde; el juego muestra la respuesta; Claude lo baja con sus archivos
//  5. una idea con foto desde la app: Claude la ve
//  6. las órdenes desde la app: aviso arriba, pantalla en el cielo (con imagen), cinemática (se baja antes y arranca a la
//     hora), todos a un mapa (sin preguntar), quitar
//  7. una orden con firma falsa no hace nada; un celular dado de baja ya no puede
// uso: node panel.mjs URL_BASE (p. ej. http://localhost:8396/: ahí la página del juego, panel/ y prueba/)
import { abrir } from './base.mjs';
import { execFileSync } from 'child_process';
import fs from 'fs';
const [, , BASE, D = '/tmp/claude-0/panel_prueba'] = process.argv; fs.mkdirSync(D, { recursive: true });
const API = BASE + 'api/', HERR = new URL('../herramientas/panel.py', import.meta.url).pathname;
let ok = 0, mal = 0; const chk = (c, m, x) => { if (c) ok++; else mal++; console.log((c ? 'OK    ' : 'FALLA ') + m + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 400) : '')); };
const py = (...a) => execFileSync('python3', ['-I', HERR, '--api', API, ...a], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
const espera = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 30000, polling: 200 });
const evJ = (p, s) => p.evaluate((x) => window.__ev(x), s);
// el juego: jugando en FlatGrass, con el panel cada 2 s
const { b, p: g, err } = await abrir(BASE + 'index.html?panel=' + encodeURIComponent(API + 'panel/') + '&panelCada=2', true);
await evJ(g, `idiomaAplicar('es'); PREFS.nombre = 'Jugador1'; inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await g.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
// ================= 1. la app admin =================
const ctxA = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const a = await ctxA.newPage(); const errA = []; a.on('pageerror', (e) => errA.push(e.message));
await a.goto(BASE + 'panel/index.html?api=' + encodeURIComponent(API));
await a.waitForSelector('#pedir'); await a.screenshot({ path: D + '/admin_entrar.jpg', quality: 80 });
await a.fill('#nom', 'Celular del dueño'); await a.click('#pedir'); await a.waitForSelector('#esp:not(.oc)');
const cod = (await a.textContent('.codigo')).trim();
const pend = py('admins'); const pub = (pend.split('\n').find((l, i, L) => L[i - 1] && L[i - 1].includes('código ' + cod)) || '').trim();
chk(/^[A-Za-z0-9+/=]{80,}$/.test(pub), '1. la app pide entrar y Claude ve el pedido con su código', cod);
py('aprobar', pub, '--nombre', 'Celular del dueño');
await a.waitForSelector('#nav:not(.oc)', { timeout: 20000 }); await a.waitForSelector('.nums', { timeout: 20000 });
// ================= 2. el juego avisa que juega; sus errores =================
await evJ(g, `setTimeout(() => { throw new Error('prueba de error del panel'); }, 10); 1`);
await new Promise((r) => setTimeout(r, 5000));
const est = await a.evaluate(() => adm('estado'));
const yo = est.jugando.find((j) => j.nombre === 'Jugador1');
chk(yo && yo.mapa === 'FlatGrass' && /^3\.9/.test(yo.version) && /web/.test(yo.plat), '1-2. la app (aprobada) ve quién juega: nombre, mapa, versión y aparato', yo);
await a.evaluate(() => pintarInicio()); await a.waitForTimeout(400); await a.screenshot({ path: D + '/admin_todo.jpg', quality: 80 });
const errs = py('errores');
chk(/prueba de error del panel/.test(errs), '2. los errores de JS del juego llegan al panel', errs.split('\n')[0]);
// ================= 3. Bugs y sugerencias en el menú del juego =================
const { b: b2, p: m, err: err2 } = await abrir(BASE + 'index.html?panel=' + encodeURIComponent(API + 'panel/') + '&panelCada=2', true);
await evJ(m, `idiomaAplicar('es'); PREFS.nombre = 'Jugador2'; inicioPanel('bugs'); 1`);
await m.waitForSelector('.rbPan_bugs .bgLista'); await m.waitForTimeout(800);
await m.click('[data-rb="bg:nuevo"]'); await m.waitForSelector('.bgForm');
await m.fill('.bgTit', 'El auto se queda trabado en la pared'); await m.fill('.bgTexto', 'Choqué contra la pared del City y el auto quedó adentro.\nPasa siempre.');
await m.setInputFiles('.bgArch', [ '/tmp/claude-0/t394/www/prueba/foto.jpg' ]); await m.waitForSelector('.bgMini img');
await m.setInputFiles('.bgArch', [ '/tmp/claude-0/t394/www/prueba/clip.mp4' ]); await m.waitForSelector('.bgMini video');
await m.screenshot({ path: D + '/juego_bug_form.jpg', quality: 80 });
await m.click('[data-rb="bg:publicar"]');
await m.waitForFunction(() => window.__ev(`!BUG.form && BUG.posts.some((p) => p.titulo.startsWith('El auto se queda'))`), null, { timeout: 60000 });
await m.waitForTimeout(800); await m.screenshot({ path: D + '/juego_bugs_lista.jpg', quality: 80 });
const post = await evJ(m, `BUG.posts.find((p) => p.titulo.startsWith('El auto se queda'))`);
chk(post && post.media.length === 2 && post.media[0].mime === 'image/jpeg' && post.media[1].mime === 'video/mp4' && post.nombre === 'Jugador2' && /web/.test(post.lugar), '3. desde el menú se publica un bug con foto y video (con versión, mapa y aparato)', post && { media: post.media.map((x) => [x.mime, x.tam]), lugar: post.lugar });
await m.click(`[data-rb="bg:ver|${post.id}"]`); await m.waitForSelector('.bgVer video');
await m.waitForFunction(() => { const v = document.querySelector('.bgVer video'), i = document.querySelector('.bgVer img'); return v && v.readyState >= 1 && i && i.naturalWidth > 0; }, null, { timeout: 20000 });
const vd = await m.evaluate(() => { const v = document.querySelector('.bgVer video'); return { dur: +v.duration.toFixed(1), w: v.videoWidth, img: document.querySelector('.bgVer img').naturalWidth }; });
chk(vd.dur > 3 && vd.w === 640 && vd.img > 1000, '3. el detalle muestra la foto y el video (se reproducen)', vd);
// ================= 4. la app responde; el juego lo muestra; Claude lo baja =================
await a.click('nav [data-tab="posts"]'); await a.waitForSelector('.post'); await a.screenshot({ path: D + '/admin_bugs.jpg', quality: 80 });
await a.click(`.post[data-id="${post.id}"]`); await a.waitForSelector('#guardar');
await a.click('#segEst [data-e="en_curso"]'); await a.fill('#resp', 'Gracias, ya lo estamos arreglando.'); await a.click('#guardar');
await a.waitForSelector('.resp'); await a.screenshot({ path: D + '/admin_bug_detalle.jpg', quality: 80, fullPage: true });
await evJ(m, `bugsAccion('ver|${post.id}'); 1`); await m.waitForSelector('.bgResp', { timeout: 15000 });
const r4 = await m.evaluate(() => ({ resp: document.querySelector('.bgResp p').textContent, est: document.querySelector('.bgVer .bgEst').textContent }));
chk(r4.resp === 'Gracias, ya lo estamos arreglando.' && r4.est === 'Arreglándose', '4. la app le pone estado y responde; el juego lo muestra', r4);
await m.screenshot({ path: D + '/juego_bug_detalle.jpg', quality: 80 });
const bajado = py('bajar', post.id, '--dir', D + '/bajado').split('\n');
const tam = (f) => fs.statSync(D + '/bajado/' + f).size, fs0 = fs.readdirSync(D + '/bajado');
chk(fs0.some((f) => f.endsWith('.mp4') && tam(f) === fs.statSync('/tmp/claude-0/t394/www/prueba/clip.mp4').size) && fs0.some((f) => f.endsWith('.jpg') && tam(f) > 5000), '4. Claude lo baja con la foto y el video', fs0);
// ================= 5. una idea con foto desde la app =================
await a.click('nav [data-tab="ideas"]'); await a.waitForSelector('#iPub');
await a.click('#segI [data-t="idea"]'); await a.fill('#iTit', 'Evento: todos a la Luna'); await a.fill('#iTx', 'Un evento donde todos aparecen en la Luna y un NPC los guía');
await a.setInputFiles('#iArch', ['/tmp/claude-0/t394/www/prueba/foto.jpg']); await a.waitForSelector('#adj .mini img');
await a.click('#iPub'); await a.waitForFunction(() => [...document.querySelectorAll('#ilista .post b')].some((x) => x.textContent === 'Evento: todos a la Luna'), null, { timeout: 30000 });
await a.screenshot({ path: D + '/admin_ideas.jpg', quality: 80 });
const ideas = py('posts', '--tipo', 'idea');
chk(/Evento: todos a la Luna · 1 medios/.test(ideas), '5. una idea con foto desde la app: Claude la ve', ideas.trim().split('\n')[0]);
// ================= 6. las órdenes =================
await a.click('nav [data-tab="llamados"]'); await a.waitForSelector('#oMandar');
await a.fill('#oTit', '¡Evento en 5 minutos!'); await a.fill('#oTx', 'Vayan a la Luna'); await a.click('#oMandar'); await a.waitForSelector('#olista .fila');
await espera(g, () => window.__ev(`!!document.querySelector('.ordAviso.sale')`), null, 15000);
const av = await g.evaluate(() => [...document.querySelectorAll('.ordAviso')].map((x) => x.querySelector('b').textContent));
chk(av.includes('¡Evento en 5 minutos!'), '6. aviso: le llega al que juega', av);
await g.waitForTimeout(300); await g.screenshot({ path: D + '/juego_aviso.jpg', quality: 80 });
// (pantalla en el cielo con imagen)
await a.click('#segO [data-t="cielo"]'); await a.fill('#oTit', 'JXMod'); await a.fill('#oTx', 'Gracias por jugar');
await a.setInputFiles('#oAdj input', '/tmp/claude-0/t394/www/prueba/foto.jpg'); await a.click('#oMandar'); await a.waitForSelector('#olista .fila');
await espera(g, () => window.__ev(`!!(ORD.cielo && !ORD.cielo.espera && ORD.cielo.L && ORD.cielo.img)`), null, 15000);
await evJ(g, `(() => { const C = ORD.cielo.c, d = vsub(C, JUG.pos); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.atan2(d.y - 0.6, Math.hypot(d.x, d.z)); return 1; })()`);
await g.waitForTimeout(900); await g.screenshot({ path: D + '/juego_cielo.jpg', quality: 80 });
chk(true, '6. pantalla en el cielo con la imagen subida desde la app');
// (cinemática: el video sube desde la app, se baja antes y arranca a la hora en todos)
await a.click('#segO [data-t="cine"]'); await a.setInputFiles('#oAdj input', '/tmp/claude-0/t394/www/prueba/clip.mp4'); await a.selectOption('#oEn', '30');
await a.evaluate(() => { document.querySelector('#oEn').innerHTML += '<option value="6">6 s</option>'; document.querySelector('#oEn').value = '6'; });
await a.click('#oMandar'); await a.waitForSelector('#olista .fila');
await espera(g, () => window.__ev(`!!(ORD.cine && ORD.cine.listo)`), null, 15000);
const antes = await evJ(g, `({ listo: ORD.cine.listo, empezo: ORD.cine.empezo, blob: String(ORD.cine.url).startsWith('blob:') })`);
await espera(g, () => !!document.querySelector('#ordCine video'), null, 15000); await g.waitForTimeout(1200);
const cine = await g.evaluate(() => { const v = document.querySelector('#ordCine video'); return { t: +v.currentTime.toFixed(1), toca: !document.querySelector('.ordToca').classList.contains('oc') }; });
chk(antes.listo && !antes.empezo && antes.blob && (cine.t > 0 || cine.toca), '6. cinemática: bajada antes de la hora y a pantalla completa a la hora', { antes, cine });
await g.screenshot({ path: D + '/juego_cine.jpg', quality: 80 });
// (quitar desde la app)
await a.click('nav [data-tab="inicio"]'); await a.waitForSelector('[data-quitar]');
for (let i = 0; i < 6 && (await a.locator('[data-quitar]').count()); i++) { await a.locator('[data-quitar]').first().click(); await a.waitForTimeout(900); }
await espera(g, () => window.__ev(`!document.querySelector('#ordCine') && !ORD.cielo`), null, 15000);
chk(true, '6. quitar desde la app: se van la cinemática y la pantalla del cielo');
// (todos a un mapa, juntos, sin preguntar)
await a.click('nav [data-tab="llamados"]'); await a.click('#segO [data-t="ir"]'); await a.selectOption('#oMapa', 'RB_Construct'); await a.fill('#oTx', 'Arranca el evento');
a.once('dialog', (d) => d.accept()); await a.click('#oMandar'); await a.waitForSelector('#olista .fila');
await espera(g, () => window.__ev(`JUEGO.estado === 'juego' && MUNDO.nombre === 'RB_Construct' && !!JUG.suelo`), null, 90000);
const ir = await evJ(g, `({ mapa: MUNDO.nombre, sala: SALA && SALA.id })`);
chk(ir.mapa === 'RB_Construct' && ir.sala === 'f_RB_Construct_1', '6. todos a un mapa: se va solo, juntos al server oficial', ir);
await g.waitForTimeout(800); await g.screenshot({ path: D + '/juego_ir.jpg', quality: 80 });
// ================= 7. firma falsa; celular dado de baja =================
const falsa = await m.evaluate(async () => {
  const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']), a0 = JSON.stringify({ uid: 'falsa000001', tipo: 'aviso', datos: { titulo: 'FALSO', texto: 'no' }, t: Date.now(), hasta: Date.now() + 60000 });
  const f = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k.privateKey, new TextEncoder().encode('JXORDEN1\n' + a0)))));
  return window.__ev(`(async () => { const o = { id: 99999, a: ${JSON.stringify(a0)}, f: ${JSON.stringify(f)} }; const bien = await ordFirmaBien(o); if (bien) ordCorrer(o); return { bien, aviso: [...document.querySelectorAll('.ordAviso b')].some((x) => x.textContent === 'FALSO') }; })()`);
});
chk(!falsa.bien && !falsa.aviso, '7. una orden con firma falsa no hace nada', falsa);
py('baja', pub);
const baja = await a.evaluate(() => adm('estado').then(() => 'pudo', (e) => e.message));
chk(baja === 'sin permiso', '7. un celular dado de baja ya no puede', baja);
const sinFirma = await (await fetch(API + 'panel/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: JSON.stringify({ op: 'posts', t: Date.now() }), firma: 'AAAA' }) })).json();
chk(sinFirma.error === 'sin permiso', '7. sin firma, nada', sinFirma);
const eJ = [...err, ...err2].filter((x) => !/WebSocket connection|broker\.|prueba de error del panel|orden con firma mala/.test(x));
chk(!eJ.length && !errA.length, 'sin errores de JS (juego y app)', [...eJ, ...errA].slice(0, 4));
await b.close(); await b2.close();
console.log('RESUMEN panel ' + ok + '/' + (ok + mal));
