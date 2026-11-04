// el contenido base desde Steam (gmod_steam.js): los modelos de HL2, sus episodios y CS:S que un addon da por hechos y no
// trae (Kleiner, los ciudadanos, la bengala, la C4, los pinos, la máquina de Tides...) se bajan del depósito del servidor
// dedicado de GMod, sólo los pedazos que hacen falta. Se compara cuántos faltan sin Steam y con Steam, y uno de los que
// faltaban se pone y se mira que tenga malla y texturas (sin el gris de "falta").
// uso: node gmod_base_steam.mjs URL_HTML URL_CARPETA_GMA [WORKER_LOCAL=http://127.0.0.1:8961] [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const GMA = process.argv[3], W = process.argv[4] || 'http://127.0.0.1:8961', D = (process.argv[5] || '.') + '/';
const IDS = (process.env.IDS || '118824086,143190159,277013349,447829341,1316354055,106565409,106404821,336509414').split(',');
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
async function correr(conSteam, ctxAnt) {
  const pedidos = { base: 0, cdn: 0, bytes: 0 };
  const s = ctxAnt ? await (async () => { const p = await ctxAnt.newPage(); const err = []; p.on('pageerror', (e) => err.push(e.message.slice(0, 200)));
    await p.route(/workers\.dev\/api\/gmod\//, async (rt) => { const u = new URL(rt.request().url()); if (/\/gmod\/base$/.test(u.pathname)) pedidos.base++; if (/\/gmod\/cdn\//.test(u.pathname)) pedidos.cdn++;
      try { const r = await fetch(W + u.pathname + u.search); const b = Buffer.from(await r.arrayBuffer()); pedidos.bytes += b.length; const h = {}; r.headers.forEach((v, k) => { h[k] = v; }); return rt.fulfill({ status: r.status, headers: h, body: b }); } catch (e) { return rt.abort(); } });
    await p.goto(process.argv[2]); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await p.waitForTimeout(1500); return { b: null, ctx: ctxAnt, p, err, ev: (x) => p.evaluate((y) => window.__ev(y), x) }; })() : await abrir(process.argv[2], false, null, async (pg) => {
    await pg.route(/workers\.dev\/api\/gmod\//, async (rt) => { const u = new URL(rt.request().url());
      if (/\/gmod\/base$/.test(u.pathname)) { pedidos.base++; if (!conSteam) return rt.fulfill({ status: 404, body: '{}' }); }
      if (/\/gmod\/cdn\//.test(u.pathname)) pedidos.cdn++;
      try { const r = await fetch(W + u.pathname + u.search); const b = Buffer.from(await r.arrayBuffer()); pedidos.bytes += b.length; const h = {}; r.headers.forEach((v, k) => { h[k] = v; }); return rt.fulfill({ status: r.status, headers: h, body: b }); } catch (e) { return rt.abort(); } });
  });
  await s.ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await s.p.waitForTimeout(2500);
  const out = {};
  for (const id of IDS) {
    out[id] = await s.ev(`(async () => { const t0 = performance.now(); const b = new Uint8Array(await (await fetch(${JSON.stringify(GMA)} + '/${id}.gma')).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, b);
      return { n: A.nombre, faltan: (A.faltanModelos || []).slice(), seg: +((performance.now() - t0) / 1000).toFixed(1) }; })()`);
  }
  // uno de los que faltaban sin Steam: puesto como prop (o como modelo de jugador), con malla y texturas
  let puesto = null;
  if (conSteam) puesto = await s.ev(`(async () => { const out = [];
    for (const m of ['models/props_junk/flare.mdl', 'models/props/de_tides/vending_turtle.mdl', 'models/player/kleiner.mdl']) {
      const t0 = performance.now(); if (!gmlTiene(m)) { out.push({ m, hay: false }); continue; }
      gmlPedir(m); await gmlPedirAhora(); const seg = +((performance.now() - t0) / 1000).toFixed(1);   // (se baja al usarse, con sus materiales y texturas)
      JUG.pitch = 0.3; const o = spawnDelante('gm:' + m, {}); await new Promise((r) => setTimeout(r, 1500));
      if (!o) { out.push({ m, hay: true, puesto: false }); continue; }
      const nodos = DATA.pf[DATA.pfPorNombre[o.nombre]].filter((n) => n.mt), mts = nodos.flatMap((n) => n.mt), falt = mts.filter((i) => DATA.mt[i] && DATA.mt[i].t === GMOD.faltante).length;
      out.push({ m, hay: true, puesto: true, seg, tris: nodos.reduce((a, n) => a + DATA.ms[n.m].sub.reduce((x, q) => x + q[1], 0) / 3, 0), materiales: mts.length, faltan: falt });
    }
    return { out, bajados: GBS.n, indice: GBS.idx ? GBS.idx.size : 0, memMB: +(GBS.bytes / 1e6).toFixed(1) }; })()`);
  if (conSteam) await s.p.screenshot({ path: D + 'base_steam.png' });
  const e2 = s.err.filter((x) => !/favicon|net::ERR|Failed to load resource|WebGL|GPU stall|swiftshader/i.test(x));
  if (conSteam === 'guardar') return { out, puesto, pedidos, errores: e2, s };
  if (s.b) await s.b.close(); else await s.p.close();
  return { out, puesto, pedidos, errores: e2 };
}
const sin = await correr(false), con = await correr('guardar');
// (otra vez en el mismo navegador, como volver a abrir el juego: lo de Steam ya está guardado)
await con.s.p.close(); const otra = await correr(true, con.s.ctx); await con.s.b.close();
const nSin = Object.values(sin.out).reduce((a, x) => a + x.faltan.length, 0), nCon = Object.values(con.out).reduce((a, x) => a + x.faltan.length, 0);
const quedan = [...new Set(Object.values(con.out).flatMap((x) => x.faltan))];
console.log('faltaban sin Steam:', nSin, '· con Steam:', nCon, '· siguen faltando:', quedan.slice(0, 20));
ok('con el contenido de Steam faltan muchos menos modelos (al menos la mitad menos)', nCon <= nSin / 2, { sin: nSin, con: nCon });
ok('Kleiner, los ciudadanos, la bengala, la C4 y la máquina de Tides ya no faltan', !quedan.some((m) => /kleiner|group01\/male_0|props_junk\/flare|v_c4|vending_turtle/.test(m)), quedan.filter((m) => /kleiner|group01|flare|v_c4|vending/.test(m)));
const P = (con.puesto && con.puesto.out) || [];
ok('los que faltaban se ponen con su malla y sus texturas (ninguna gris de "falta")', P.length >= 2 && P.every((x) => x.hay && x.puesto && x.tris > 50 && x.faltan === 0), con.puesto);
ok('se baja poco: de entrada sólo lo de las armas y lo demás al usarse (menos de 8 MB por addon en promedio)', con.pedidos.bytes - sin.pedidos.bytes < 8e6 * IDS.length, { MB: +(con.pedidos.bytes / 1e6).toFixed(1), pedidos: con.pedidos.cdn, sinSteamMB: +(sin.pedidos.bytes / 1e6).toFixed(1) });
ok('la segunda vez sale de lo guardado: casi nada de Steam (menos de 2 MB)', otra.pedidos.bytes < 2e6, { MB: +(otra.pedidos.bytes / 1e6).toFixed(2), pedidos: otra.pedidos.cdn, faltan: Object.values(otra.out).reduce((a, x) => a + x.faltan.length, 0) });
ok('sin errores de JS', !con.errores.length && !sin.errores.length && !otra.errores.length, [...con.errores, ...sin.errores].slice(0, 4));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
process.exit(0);
