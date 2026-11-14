// (depurar un arma: la instala con lo que pide, la equipa, la usa unos segundos y muestra los errores de Lua con la pila de JS)
// uso: node dbg_arma.mjs URL_HTML URL_GMA id+dep... [clase] [EVAL extra]
import { abrir } from './base.mjs';
const [, , HTML, GMA, LISTA, CLASE, EXTRA] = process.argv;
const ids = LISTA.split('+'), id = ids[0], deps = ids.slice(1);
const { b, p, ev, err } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 90000 });
await ev(`window.esperaJuego = (t) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + t || performance.now() - r0 > 25000 ? ok() : setTimeout(f, 20)); f(); }); 1`);
// (la pila de JS de cada error de Lua que viene de JS)
await ev(`(() => { const R = () => GMA.R; window.__pilas = []; const f0 = gmLlamar; gmLlamar = function (f, ctx, ...a) { const Rr = GMA.R; if (!Rr || typeof f !== 'function') return f0(f, ctx, ...a); const c0 = GMA.ctx; GMA.ctx = ctx; gmaLado(ctx); try { return Rr.c(f, 'callback', ...a); } catch (e) { window.__pilas.push(String(Rr.msgErr(e)).slice(0, 200) + ' || ' + String(e && e.stack).split('\\n').slice(0, 8).join(' | ')); gmaErr(Rr.msgErr(e)); return []; } finally { GMA.ctx = c0; gmaLado(c0); } }; return 1; })()`);
for (const d of [...deps, id]) await ev(`(async () => { const b = new Uint8Array(await (await fetch('${GMA}/${d}/${d}.gma')).arrayBuffer()); const A = await gmInstalar('${d}', { nombre: '${d}', sinDeps: true }, b); await A.listo; return 1; })()`);
await ev(`(() => { window.__nil = []; const s0 = LuaTable.prototype.set; LuaTable.prototype.set = function (k, v) { if (k === undefined || k === null) window.__nil.push({ claves: this.claves().slice(0, 8).map(String), hook: GMA.hookEv || null, ctx: GMA.ctx, v: typeof v }); return s0.call(this, k, v); }; return 1; })()`);
if (process.env.PRE) await ev(process.env.PRE);
const r = await ev(`(async () => { const A = GMOD.addons.get('${id}'); const w = ${JSON.stringify(CLASE || '')} || A.sweps[0]; gmaSpawnMenu('gmswep:' + w); await esperaJuego(2); ENT.disparo = true; await esperaJuego(1); ENT.disparo = false; await esperaJuego(0.5); ${EXTRA || ''}
  return { w, sweps: A.sweps, luaErr: A.luaErr.slice(0, 5), errores: GMA.errores.slice(-8), pilas: window.__pilas.slice(0, 6), faltan: [...(GMA.faltan || [])].slice(-15), nil: window.__nil.slice(0, 5), extra: window.__extra }; })()`);
console.log(JSON.stringify(r, null, 1)); console.log('JS:', err.filter((x) => !/WebSocket|Failed to load/.test(x)).slice(0, 5));
await b.close(); process.exit(0);
