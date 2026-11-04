// instala un solo addon (de una carpeta de .gma servida por HTTP) y avisa si la página se cae o se cuelga: tiempos,
// memoria de JS, errores de Lua y los últimos mensajes de la consola. Para encontrar el que tira abajo una tanda.
// (si el .gma no está en la carpeta, se baja como en el juego)
// uso: node gmod_un_addon.mjs URL_HTML URL_CARPETA_GMA ID   (DEPS=1: también lo que pide; WORKER_LOCAL=URL)
import { abrir } from './base.mjs';
const [, , HTML, CARP, ID] = process.argv;
const WL = process.env.WORKER_LOCAL;
const { b, p, err, ev } = await abrir(HTML, false, null, WL ? async (pg) => { await pg.route(/workers\.dev\/api\/gmod\//, async (rt) => { const u = new URL(rt.request().url()); try { const r = await fetch(WL + u.pathname + u.search); const h = {}; r.headers.forEach((v, k) => { h[k] = v; }); return rt.fulfill({ status: r.status, headers: h, body: Buffer.from(await r.arrayBuffer()) }); } catch (e) { return rt.abort(); } }); } : undefined);
let cayo = null; const t00 = Date.now(); if (process.env.TODO_CONSOLA) p.on('console', (m) => console.log('[consola ' + ((Date.now() - t00) / 1000).toFixed(1) + ' s]', m.type(), m.text().slice(0, 160))); p.on('crash', () => { cayo = 'crash'; }); p.on('close', () => { cayo = cayo || 'close'; });
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
const t0 = Date.now();
const vigia = setInterval(async () => { try { const m = await p.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1)); console.log('t', ((Date.now() - t0) / 1000).toFixed(0), 's heap', m, 'MB'); } catch (e) { console.log('t', ((Date.now() - t0) / 1000).toFixed(0), 's sin respuesta:', String(e.message).slice(0, 80)); } }, 5000);
try {
  const r = await Promise.race([ev(`(async () => { const r0 = await fetch(${JSON.stringify(CARP)} + '/${ID}.gma'), b = r0.ok ? new Uint8Array(await r0.arrayBuffer()) : undefined; const A = await gmInstalar('${ID}', { nombre: '${ID}', sinDeps: ${process.env.DEPS ? 'false' : 'true'} }, b); return { lua: A.lua.length, corridos: A.luaCorridos, err: (A.luaErr || []).slice(0, 5), ms: A.luaMs, faltan: [...GMA.faltan.entries()].slice(0, 10), deps: A.deps, grandes: A.depsGrandes }; })()`), new Promise((_, no) => setTimeout(() => no(new Error('más de 180 s')), 180000))]);
  console.log('INSTALADO', JSON.stringify(r).slice(0, 1500));
  await p.waitForTimeout(5000); console.log('5 s después, sigue viva:', !cayo);
} catch (e) { console.log('FALLA', String(e.message).slice(0, 300), 'cayo:', cayo); }
clearInterval(vigia); console.log('consola:', JSON.stringify(err.slice(-6)).slice(0, 1200));
await b.close().catch(() => {}); process.exit(0);
