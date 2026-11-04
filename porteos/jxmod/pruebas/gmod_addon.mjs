// addons de GMod: baja uno real del Workshop (Food and Household items: 16,6 MB, cientos de modelos), lo instala (LZMA en
// otro hilo, montado), aparece la pestaña GMod con sus modelos e íconos, se ponen props: malla convertida, texturas del
// addon (no el damero), casco de choque de su .phy y masa; caen y quedan apoyados en el piso; queda en la caché (otra vez
// sin bajar nada); sin errores.
// uso: node gmod_addon.mjs URL_HTML [CARPETA_FOTOS] [ID_WORKSHOP]
import { abrir } from './base.mjs';
const D = (process.argv[3] || '.') + '/', WID = process.argv[4] || '108024198';
// (PUENTE_LOCAL=1: el puente /api/gmod/* de la tienda corre acá con el código del worker, por si el desplegado o el público no andan)
let antes = null;
if (process.env.PUENTE_LOCAL) {
  const W = (await import('../tienda/worker.js')).default; globalThis.caches = globalThis.caches || { default: { match: async () => null, put: async () => {} } };
  const envW = { DB: { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }), first: async () => null, run: async () => ({}) }), run: async () => ({}) }) } };
  antes = async (pg) => pg.route(/\/api\/gmod\//, async (rt) => { try { const r = await W.fetch(new Request(rt.request().url()), envW, {}); await rt.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) }); } catch (e) { await rt.fulfill({ status: 502, body: String(e) }); } });
}
const { b, p, err, ev } = await abrir(process.argv[2], false, null, antes);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 30000 });
const ins = await ev(`(async () => { const t0 = performance.now(); let pr = 0; try { const A = await gmInstalar('${WID}', null, null, (x) => { pr = x; }); const C = DATA.menu.find((c) => c.n === 'GMod');
  return { ok: true, s: +((performance.now() - t0) / 1000).toFixed(1), nombre: A.nombre, modelos: A.modelos.length, props: A.props.length, lua: A.lua.length, pestaña: !!C, secciones: C ? C.sub.length : 0, items: C ? C.sub[0].it.length : 0 }; } catch (e) { return { ok: false, e: String(e.message || e), err: GMOD.errores.slice(0, 3) }; } })()`);
ok('baja e instala el addon del Workshop (por el puente, LZMA en otro hilo) y aparece la pestaña GMod con sus modelos', ins.ok && ins.pestaña && ins.items > 10, ins);
// poner 8 props distintos adelante
const pon = await ev(`(async () => { const C = DATA.menu.find((c) => c.n === 'GMod'), L = C.sub[0].it.filter((x) => /^gm:/.test(x)); const el = []; for (let k = 0; k < 8; k++) el.push(L[Math.floor(k * L.length / 8)]);
  const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), d = v3(f.z, 0, -f.x), O = [], t0 = performance.now();
  el.forEach((n, k) => { const o = crearObjeto(n, vadd(JUG.pos, vadd(vscale(f, 3 + (k >> 2) * 1.6), vadd(vscale(d, ((k & 3) - 1.5) * 1.2), v3(0, 1.2, 0)))), Quat.axis(0, 1, 0, JUG.yaw + Math.PI), {}); O.push(o); });
  const ms = performance.now() - t0; window.__O = O;
  await new Promise((r) => setTimeout(r, 4000));
  const info = O.map((o, k) => { if (!o) return { n: el[k], falta: true }; const arb = DATA.pf[DATA.pfPorNombre[o.nombre]], nd = arb[0], d = DATA.ms[nd.m];
    const texs = nd.mt.map((mi) => DATA.mt[mi].t), falt = texs.filter((t) => t === GMOD.faltante).length, gl = mallaGL(nd.m);
    const h = raycast(vadd(o.b.pos, v3(0, 0.02, 0)), v3(0, -1, 0), 10, o.b);
    return { n: gmNombre(o.nombre), tris: d.sub.reduce((a, s) => a + s[1], 0) / 3, mats: nd.mt.length, falt, gl: !!gl, piezas: nd.col.length, phy: nd.col[0].m !== nd.m, masa: +nd.rb.m.toFixed(1), forma: o.b.shape.type, quieto: o.b.sleep || o.b.vel.len() < 0.05, tam: d.sc.map((v) => +v.toFixed(2)) }; });
  return { ms: Math.round(ms), info }; })()`);
const I = pon.info;
ok('los 8 props se crean (malla convertida y en la GPU) con sus materiales', I.every((x) => !x.falta && x.gl && x.tris > 0 && x.mats > 0), I.map((x) => [x.n, x.tris, x.mats]));
ok('las texturas salen del addon (ninguna con el damero de "falta")', I.every((x) => x.falt === 0), I.map((x) => [x.n, x.falt]));
ok('choque con las piezas de su .phy y su masa; caen y quedan quietos', I.filter((x) => x.phy).length >= 6 && I.every((x) => x.quieto), I.map((x) => [x.n, x.piezas, x.forma, x.masa, x.quieto]));
// foto
await ev(`(() => { const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); JUG.pitch = 0.32; return 1; })()`);
await p.waitForTimeout(700); await p.screenshot({ path: D + 'gmod_props.png' });
// íconos del menú
const ico = await ev(`(async () => { abrirSpawn(); UI.tab = DATA.menu.findIndex((c) => c.n === 'GMod'); UI.sub = 0; spawnDibujar(); await new Promise((r) => setTimeout(r, 6000));
  const im = [...document.querySelectorAll('#grilla img[data-gm]')]; return { n: im.length, conImg: im.filter((x) => x.src && x.src.startsWith('data:image')).length }; })()`);
await p.screenshot({ path: D + 'gmod_menu.png' });
ok('el menú muestra los modelos con íconos dibujados (≥ 20 en 6 s)', ico.n > 10 && ico.conImg >= 20, ico);
await ev(`cerrarPaneles(); 1`);
// caché: desmontar y volver a instalar sin red
const cache = await ev(`(async () => { gmDesmontar('${WID}'); const f0 = window.fetch; let pedidos = 0; window.fetch = (...a) => { pedidos++; return f0(...a); }; const t0 = performance.now(); await gmInstalar('${WID}'); window.fetch = f0; return { pedidos, s: +((performance.now() - t0) / 1000).toFixed(2), montado: GMOD.addons.has('${WID}') }; })()`);
ok('queda guardado en el navegador: reinstalar no baja nada', cache.montado && cache.pedidos === 0, cache);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404|willReadFrequently/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).slice(0, 5));
console.log('errores de GMOD:', await ev(`JSON.stringify(GMOD.errores.slice(0, 6))`));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
