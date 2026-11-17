// los botones de las teclas de los mods (3.9, pedido del dueño: «es feo tener en azul arriba y abajo vacío, hay muchos botones
// que no andan»): en un celular apaisado, con la Lightsaber y M9K, las teclas fijadas van abajo a la derecha (no arriba),
// con el estilo de los botones de siempre (no azules), sin pisarse con ningún otro botón; las que el mod no escucha no se ven;
// la que hace lo mismo que un botón de fábrica no se repite (ese botón la aprieta). Sin errores.
// uso: node pruebas/botones_mods.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, CARP, DIR = '.'] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const err = []; p.on('pageerror', (e) => err.push(e.message.slice(0, 200)));
await p.goto(HTML); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await p.waitForTimeout(1500);
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); ENT.tactil = true; document.body.classList.add('tactil'); 1`);
await ev(`(async () => { for (const id of ['111412589', '128089118']) { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/' + id + '.gma')).arrayBuffer()); const A = await gmInstalar(id, { nombre: id, sinDeps: true }, b); await A.listo; } return 1; })()`);
await ev(`(() => { inicioMostrar(false); empezarPartida('FlatGrass'); return 1; })()`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
await p.waitForTimeout(2500);
// fijar todas las habilidades de la Lightsaber (hasta 6)
const hab = await ev(`(() => { cerrarPaneles(); localStorage.removeItem('rb_gmb_fijos'); GMB.fijos = []; const A = GMOD.addons.get('111412589'); const L = gmbHabilidades(A).slice(0, 6); for (const h of L) gmbFijar(h.k); return L.map((h) => [h.k, h.acc && h.acc.id]); })()`);
await p.waitForTimeout(2500);
const r = await ev(`(() => { if (typeof hudDisponer === 'function') hudDisponer(); const W = innerWidth, H = innerHeight, out = [];
  for (let i = 0; i < 6; i++) { const d = document.getElementById('bgmb' + i); if (!d || !d._f) continue; const rc = d.getBoundingClientRect(), cs = getComputedStyle(d);
    out.push({ k: d._f.k, ve: !d.classList.contains('oc'), vivo: gmbVivo(d._f.k), fab: d._fab || null, x: Math.round(rc.left + rc.width / 2), y: Math.round(rc.top + rc.height / 2), w: Math.round(rc.width), fondo: cs.backgroundColor }); }
  const otros = [...document.querySelectorAll('#tactil .bt-t, #tactil [data-btn]')].filter((e) => !/^bgmb/.test(e.id) && !e.classList.contains('oc') && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden').map((e) => { const q = e.getBoundingClientRect(); return { id: e.id || e.dataset.btn, l: q.left, t: q.top, r: q.right, b: q.bottom }; }).filter((q) => q.r > q.l);
  const pisa = []; for (const o of out.filter((x) => x.ve)) { const d = document.getElementById('bgmb' + [...Array(6).keys()].find((i) => { const e = document.getElementById('bgmb' + i); return e && e._f && e._f.k === o.k; })).getBoundingClientRect();
    for (const q of otros) if (d.left < q.r - 2 && d.right > q.l + 2 && d.top < q.b - 2 && d.bottom > q.t + 2) pisa.push([o.k, q.id]); }
  return { W, H, out, pisa, enlaces: GMB.enlaces || [] }; })()`);
console.log('habilidades', JSON.stringify(hab));
const vis = r.out.filter((x) => x.ve);
ok('las teclas fijadas que se ven están abajo a la derecha (no arriba a la izquierda)', vis.length > 0 && vis.every((x) => x.x > r.W * 0.5 && x.y > r.H * 0.4), vis.map((x) => [x.k, x.x, x.y]));
ok('no son azules (el estilo de los botones de siempre)', vis.every((x) => !/rgba?\(27, 143, 220/.test(x.fondo)), vis.map((x) => x.fondo));
ok('no se pisan con ningún otro botón', r.pisa.length === 0, r.pisa);
ok('las que se ven son las que el mod escucha; las que no, no se ven', r.out.every((x) => x.ve === (x.vivo && !x.fab)), r.out.map((x) => [x.k, x.ve, x.vivo, x.fab]));
await p.screenshot({ path: DIR + '/botones_mods.png' });
// la que hace lo mismo que un botón de fábrica: una tecla de linterna inventada → el botón de la linterna la aprieta
const f = await ev(`(() => { GMB.fijos = [{ k: 'key:KeyF', t: 'F' }]; const a0 = gmbAccDe; gmbAccDe = (k) => (k === 'key:KeyF' ? { id: 'linterna', prio: 7 } : a0(k)); gmbFijosDibujar(); gmbAccDe = a0;
  const d = document.getElementById('bgmb0'), bl = document.getElementById('blinterna'); if (!bl) return { sinLinterna: true };
  TOQ.botones.add(bl); const s = gmaBotones(); TOQ.botones.delete(bl); return { oculto: d.classList.contains('oc'), fab: d._fab, aprieta: s.has(GMA_JSKEY.get('KeyF')) }; })()`);
ok('una tecla del mod que hace lo mismo que la linterna no tiene botón aparte: el de la linterna la aprieta', f.sinLinterna || (f.oculto && f.fab === 'blinterna' && f.aprieta), f);
ok('sin errores de JS', err.length === 0, err.slice(0, 3));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close();
