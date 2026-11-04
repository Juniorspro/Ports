// la tienda GMod baja addons SIN archivo directo (SteamPipe por la tienda): la ficha ofrece Instalar (no "importá desde la
// compu"), baja, descifra y descomprime los pedazos en otro hilo, instala y el contenido queda en el menú; mide el tiempo,
// la barra de progreso y los saltos de cuadro mientras baja; después, desde la caché, sin pedirle nada a Steam.
// uso: node gmod_pipe.mjs URL_HTML [WORKER_LOCAL=http://127.0.0.1:8961] [CARPETA_FOTOS]   (IDS=id,id,... para elegir)
// (WORKER_LOCAL: el worker de la tienda corriendo en local; las rutas /api/gmod/* de la tienda se mandan ahí)
import { abrir } from './base.mjs';
const W = process.argv[3] || 'http://127.0.0.1:8961', D = (process.argv[4] || '.') + '/';
const IDS = (process.env.IDS || '111412589,1560118657,112606459').split(',');
const ped = { pipe: 0, cdn: 0, otros: 0 };
const { b, p, err, ev } = await abrir(process.argv[2], false, null, async (pg) => {
  await pg.route(/workers\.dev\/api\/gmod\//, async (rt) => {
    const u = new URL(rt.request().url()); if (/\/gmod\/pipe\//.test(u.pathname)) ped.pipe++; else if (/\/gmod\/cdn\//.test(u.pathname)) ped.cdn++; else ped.otros++;
    try { const r = await fetch(W + u.pathname + u.search); const h = {}; r.headers.forEach((v, k) => { h[k] = v; }); return rt.fulfill({ status: r.status, headers: h, body: Buffer.from(await r.arrayBuffer()) }); }
    catch (e) { return rt.abort(); }
  });
});
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; inicioMostrar(true); RB.t.tab = 'gmod'; RB.t.vista = 'explorar'; RB.t.q = ''; RB.t.etq = ''; inicioPanel('tienda'); 1`);
await p.waitForTimeout(1500);
for (const id of IDS) {
  const det = await ev(`(async () => { const [x] = await gmDetallesCompactos(['${id}']); if (!x) return null; if (!RB.t.items.find((y) => y.id === x.id)) RB.t.items.push(x); inicioAccion('ver:' + x.id, document.body); await new Promise((r) => setTimeout(r, 300));
    const f = RB.el.querySelector('.rbFicha'); return { t: x.t, mb: x.mb, dir: x.dir, instalar: !!(f && f.querySelector('[data-rb="instalar:${id}"]')), importar: !!(f && f.querySelector('.gmImpFicha')), aviso: !!(f && f.querySelector('.gmAviso')) }; })()`);
  ok(`${id}: la ficha ofrece Instalar aunque no tenga archivo directo`, det && det.instalar && !det.importar, det);
  if (det && det.dir) console.log('     (ojo: este tiene archivo directo)');
  const r = await ev(`(async () => {
    const id = '${id}', t0 = performance.now(), progs = []; let bajando = true, sBaja = 0, sMonta = 0, ult = performance.now(), sigue = true, tBaja = 0, porPipe = false;
    const orig = gpBajar; gpBajar = async (w, prog, base) => { porPipe = true; try { return await orig(w, (p, f) => { progs.push(Math.round(p * 100)); if (prog) prog(p, f); }, base); } finally { bajando = false; tBaja = performance.now(); } };
    const raf = () => { const t = performance.now(), d = t - ult; if (bajando) sBaja = Math.max(sBaja, d); else sMonta = Math.max(sMonta, d); ult = t; if (sigue) requestAnimationFrame(raf); }; requestAnimationFrame(raf);
    inicioAccion('instalar:' + id, document.body);
    for (let i = 0; i < 1200 && (!GMOD.addons.has(id) || RB.t.gmProg); i++) { if (i > 4 && !RB.t.gmProg && !GMOD.addons.has(id)) break; await new Promise((r) => setTimeout(r, 100)); }
    sigue = false; gpBajar = orig; const A = GMOD.addons.get(id), sube = progs.every((v, k) => !k || v >= progs[k - 1]);
    return { ok: !!A, porPipe, seg: +((performance.now() - t0) / 1000).toFixed(1), bajaSeg: tBaja ? +((tBaja - t0) / 1000).toFixed(1) : null, progMax: Math.max(0, ...progs), progSube: sube, nProgs: progs.length, saltoMaxBajando: Math.round(sBaja), saltoMaxMontando: Math.round(sMonta),
      props: A ? A.props.length : 0, sweps: A && A.sweps ? A.sweps.length : 0, sents: A && A.sents ? A.sents.length : 0, lua: A ? A.lua.length : 0 };
  })()`);
  ok(`${id} (${det && det.t}) se instala por SteamPipe`, r.ok && r.porPipe, r);
  ok(`${id}: la barra de progreso avanza y no retrocede`, r.progMax >= 95 && r.progSube && r.nProgs >= 2, { max: r.progMax, sube: r.progSube, n: r.nProgs });
  ok(`${id}: el juego no se traba mientras baja (salto de cuadro ≤ 250 ms)`, r.saltoMaxBajando <= 250, r.saltoMaxBajando);
}
await p.screenshot({ path: D + 'gmod_pipe.png' });
// desde la caché (IndexedDB): sin volver a pedirle nada a Steam
const antes = { ...ped };
const c = await ev(`(async () => { const id = '${IDS[0]}'; gmDesmontar(id); await new Promise((r) => setTimeout(r, 300)); const t0 = performance.now(); const b = await gmBajar(id); return { gma: gmEsGMA(b), mb: +(b.length / 1e6).toFixed(1), ms: Math.round(performance.now() - t0) }; })()`).catch((e) => ({ error: String(e.message || e).slice(0, 120) }));
ok('la segunda vez sale de la caché (sin pedir a Steam)', c.gma && ped.pipe === antes.pipe && ped.cdn === antes.cdn, { ...c, pedidosNuevos: ped.pipe - antes.pipe + ped.cdn - antes.cdn });
console.log('pedidos', ped);
const e2 = err.filter((x) => !/favicon|net::ERR|Failed to load resource|WebGL|GPU stall|swiftshader/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await b.close(); process.exit(0);
