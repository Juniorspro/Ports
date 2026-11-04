// controles a gusto (en un celular horizontal): cambiar la tecla de saltar (la nueva salta y la vieja ya no), mover y
// agrandar un botón en el editor y que quede guardado (también al volver a abrir), publicar los controles en la tienda de
// controles, encontrarlos y usarlos, y los botones que agrega un arma de un mod (apuntar y los que mira su Lua).
// uso: node controles.mjs URL_HTML [WORKER_LOCAL=http://127.0.0.1:8961] [URL_CARPETA_GMA] [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const W = process.argv[3] || 'http://127.0.0.1:8961', GMA = process.argv[4] || '', D = (process.argv[5] || '.') + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const ruta = async (pg) => { await pg.route(/workers\.dev\/api\/controles/, async (rt) => { const q = rt.request(), u = new URL(q.url());
  try { const r = await fetch(W + u.pathname + u.search, { method: q.method(), headers: { 'Content-Type': 'application/json' }, body: q.method() === 'POST' ? q.postData() : undefined }); const h = {}; r.headers.forEach((v, k) => { h[k] = v; }); return rt.fulfill({ status: r.status, headers: h, body: Buffer.from(await r.arrayBuffer()) }); } catch (e) { return rt.abort(); } }); };
let { b, ctx, p, err, ev } = await abrir(process.argv[2], true, null, ruta);
const empezar = async () => { await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await p.waitForTimeout(2500); await ev(`ENT.tactil = true; document.body.classList.add('tactil'); hudDisponer(); 1`); await p.waitForTimeout(300); };
await empezar();
// --- 1. teclas: saltar pasa a la X ---
await ev(`abrirPausa(); ctlAbrir('pausa'); ctlDibujar('teclas'); 1`);
await p.screenshot({ path: D + 'controles_panel.png' });
await p.click('[data-ctl="tecla:saltar"]'); await p.keyboard.press('KeyX');
const t1 = await ev(`({ saltar: PREFS.teclas && PREFS.teclas.saltar, boton: document.querySelector('[data-ctl="tecla:saltar"]').textContent })`);
ok('la tecla de saltar se cambia a la X (se aprieta y queda)', t1.saltar === 'KeyX' && /X/.test(t1.boton), t1);
await ev(`ctlCerrar(); cerrarPaneles(); 1`);
const t2 = await ev(`(async () => { ENT.tactil = false; const ap = (c, d) => dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c }));
  ap('KeyX', true); entradaLeer(); const conX = ENT.saltar; ap('KeyX', false); entradaLeer();
  ap('Space', true); entradaLeer(); const conEsp = ENT.saltar; ap('Space', false); entradaLeer(); ENT.tactil = true; return { conX, conEsp }; })()`);
ok('la X salta y el espacio ya no', t2.conX === true && t2.conEsp === false, t2);
// --- 2. el editor: mover y agrandar el botón de saltar ---
const antes = await ev(`(() => { const e = $('bsaltar'); return { l: parseFloat(e.style.left), t: parseFloat(e.style.top), w: parseFloat(e.style.width) }; })()`);
await ev(`abrirPausa(); ctlAbrir('pausa'); ctlDibujar('tactil'); 1`); await p.click('[data-ctl="editar"]'); await p.waitForTimeout(200);
await p.screenshot({ path: D + 'controles_editor.png' });
const cx = antes.l + antes.w / 2, cy = antes.t + antes.w / 2;
await p.mouse.move(cx, cy); await p.mouse.down(); for (let i = 1; i <= 10; i++) await p.mouse.move(cx - 12 * i, cy - 6 * i); await p.mouse.up();
await ev(`(() => { const s = $('ctlSelTam'); s.value = 150; s.dispatchEvent(new Event('input')); return 1; })()`);
await p.click('#ctlEd [data-ce=guardar]'); await p.waitForTimeout(200); await ev(`ctlCerrar(); cerrarPaneles(); 1`); await p.waitForTimeout(200);
const desp = await ev(`(() => { const e = $('bsaltar'); return { l: parseFloat(e.style.left), t: parseFloat(e.style.top), w: parseFloat(e.style.width), guardado: JSON.stringify((PREFS.hudPos || {})['#bsaltar'] || null) }; })()`);
const dcx = desp.l + desp.w / 2 - cx, dcy = desp.t + desp.w / 2 - cy;
ok('el botón quedó donde se arrastró (120 px a la izquierda y 60 arriba, ±6 px)', Math.abs(dcx + 120) <= 6 && Math.abs(dcy + 60) <= 6, { dcx: +dcx.toFixed(1), dcy: +dcy.toFixed(1) });
ok('y 1,5 veces más grande', Math.abs(desp.w / antes.w - 1.5) < 0.03, { antes: antes.w, despues: desp.w, guardado: desp.guardado });
await p.screenshot({ path: D + 'controles_movido.png' });
// (al volver a abrir el juego sigue igual)
await p.reload(); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await p.waitForTimeout(1500); await empezar();
const vuelta = await ev(`(() => { const e = $('bsaltar'); return { l: parseFloat(e.style.left), t: parseFloat(e.style.top), w: parseFloat(e.style.width), saltar: PREFS.teclas && PREFS.teclas.saltar }; })()`);
ok('al volver a abrir el juego, el botón y la tecla siguen como se dejaron', Math.abs(vuelta.l - desp.l) < 1 && Math.abs(vuelta.w - desp.w) < 1 && vuelta.saltar === 'KeyX', vuelta);
// --- 3. la tienda de controles (necesita el worker de la tienda corriendo en W; si no está, se saltea y se dice) ---
const hayWorker = await fetch(W).then(() => true, () => false);
if (!hayWorker) console.log('SALTA la tienda de controles: no hay worker local en ' + W);
else {
const nom = 'Pulgares ' + Date.now() % 10000;
await ev(`abrirPausa(); ctlAbrir('pausa'); ctlDibujar('tienda'); 1`); await p.waitForTimeout(300);
await p.fill('#ctlNom', nom); await p.click('[data-ctl="publicar"]'); await p.waitForTimeout(1200);
const lista = await ev(`[...document.querySelectorAll('#ctlTiendaL .ctlFila b')].map((x) => x.textContent)`);
ok('publicados aparecen en la tienda de controles', lista.includes(nom), lista.slice(0, 4));
await ev(`PREFS.hudPos = {}; PREFS.teclas = {}; _ctlMapa = null; hudDisponer(); 1`);
const id = await ev(`(() => { const f = [...document.querySelectorAll('#ctlTiendaL .ctlFila')].find((x) => x.querySelector('b').textContent === ${JSON.stringify(nom)}); return f && f.querySelector('[data-ctl^=usar]').dataset.ctl.split(':')[1]; })()`);
await p.click(`[data-ctl="usar:${id}"]`); await p.waitForTimeout(1000);
const usado = await ev(`({ saltar: PREFS.teclas && PREFS.teclas.saltar, pos: JSON.stringify((PREFS.hudPos || {})['#bsaltar'] || null), w: parseFloat($('bsaltar').style.width) })`);
const igual = (a, b) => { a = JSON.parse(a || 'null'); b = JSON.parse(b || 'null'); return !!a && !!b && a.every((x, i) => Math.abs(x - b[i]) < 0.11); };
ok('usar unos de la tienda los pone (tecla y botones)', usado.saltar === 'KeyX' && igual(usado.pos, desp.guardado) && Math.abs(usado.w - desp.w) < 1, usado);
await ev(`ctlCerrar(); cerrarPaneles(); 1`);
}
// --- 4. un arma de un mod agrega sus botones ---
if (GMA) {
  const m = await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(GMA)} + '/128089118.gma')).arrayBuffer()); const A = await gmInstalar('128089118', { nombre: 'M9K', sinDeps: true }, b);
    const w = A.sweps[0]; gmaDarArma(w); await new Promise((r) => setTimeout(r, 400)); HUD.arma = null; hudPaso();
    const vis = (id) => { const e = $(id); return !!e && !e.classList.contains('oc'); };
    const mods = [0, 1, 2, 3].filter((i) => vis('bmod' + i)).map((i) => $('bmod' + i).textContent);
    const e0 = $('bmod0'); e0.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [], changedTouches: [] })); const tecla = [...CTL.teclasMod].join(','), bits = CTL.inMod, uso = !!(gmaTeclas() & 32); e0.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true }));
    return { arma: w, apuntar: vis('bdisp2') && /mira|circle/.test($('bdisp2').innerHTML + $('bdisp2').querySelector('img').src), mods, tecla, bits, uso, sueltaVacia: CTL.teclasMod.size === 0 && CTL.inMod === 0 }; })()`);
  ok('con un arma de M9K aparecen apuntar y sus botones (E y Correr, que mira su Lua)', m.apuntar && m.mods.length >= 1, m);
  ok('apretar el botón E del mod le llega al Lua como USE, y al soltar se suelta', (m.tecla === 'KeyE' && m.uso) || m.bits > 0, m);
  await p.screenshot({ path: D + 'controles_mod.png' });
  ok('al soltarlo no queda apretado', m.sueltaVacia, m.sueltaVacia);
}
const e2 = err.filter((x) => !/favicon|net::ERR|Failed to load resource|WebGL|GPU stall|swiftshader/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await b.close(); process.exit(0);
