// los "Required items" del Workshop se instalan solos: un pack de autos de TDMCars trae su Base Pack (sin archivo directo,
// por SteamPipe) y los autos salen con su pintura y texturas de verdad (sin la gris de "falta textura").
// uso: node gmod_requeridos.mjs URL_HTML [WORKER_LOCAL=http://127.0.0.1:8961] [CARPETA_FOTOS]   (ID=pack de autos)
import { abrir } from './base.mjs';
const W = process.argv[3] || 'http://127.0.0.1:8961', D = (process.argv[4] || '.') + '/', ID = process.env.ID || '113118541';
const { b, p, err, ev } = await abrir(process.argv[2], false, null, async (pg) => {
  await pg.route(/workers\.dev\/api\/gmod\//, async (rt) => {
    const u = new URL(rt.request().url());
    try { const r = await fetch(W + u.pathname + u.search); const h = {}; r.headers.forEach((v, k) => { h[k] = v; }); return rt.fulfill({ status: r.status, headers: h, body: Buffer.from(await r.arrayBuffer()) }); }
    catch (e) { return rt.abort(); }
  });
});
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(4000);
const ins = await ev(`(async () => { const t0 = performance.now(); try { const A = await gmInstalar('${ID}', { nombre: 'pack' }); return { ok: true, n: A.nombre, deps: A.deps || [], conBase: [...GMOD.addons.keys()], seg: +((performance.now() - t0) / 1000).toFixed(1), vehs: [...((A.listas && A.listas.Vehicles) || new Map()).keys()].slice(0, 40) }; } catch (e) { return { ok: false, e: String(e.message || e) }; } })()`);
ok('el pack se instala y trae solo lo que pide su página (la Base Pack)', ins.ok && ins.conBase.includes('112606459'), { n: ins.n, deps: ins.deps, seg: ins.seg, e: ins.e });
const vehs = (ins.vehs || []).slice(0, 4), res = [];
for (const k of vehs) {
  const x = await ev(`(async () => { const k = ${JSON.stringify(k)}; JUG.pitch = 0.25; JUG.tercera = false; const n0 = OBJS.length; spawnElegir('GMod', 'gmveh:' + k); await new Promise((r) => setTimeout(r, 1500)); const o = OBJS.length > n0 ? OBJS[OBJS.length - 1] : null; if (!o) return { k, puesto: false };
    const mts = DATA.pf[DATA.pfPorNombre[o.nombre]].filter((n) => n.mt).flatMap((n) => n.mt), falt = mts.filter((i) => DATA.mt[i] && DATA.mt[i].t === GMOD.faltante).length;
    return { k, puesto: true, materiales: mts.length, faltan: falt }; })()`);
  await p.screenshot({ path: D + 'req_' + k.replace(/\W+/g, '_') + '.png' });
  await ev(`(() => { const o = OBJS[OBJS.length - 1]; if (o && o.veh) borrarObjeto(o); return 1; })()`);
  res.push(x);
}
ok('los autos aparecen', res.length && res.every((x) => x.puesto), res.map((x) => x.k));
ok('sin texturas que falten (pintura y vidrios de la Base Pack)', res.length && res.every((x) => x.faltan === 0), res);
const e2 = err.filter((x) => !/favicon|net::ERR|Failed to load resource|WebGL|GPU stall|swiftshader/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await b.close(); process.exit(0);
