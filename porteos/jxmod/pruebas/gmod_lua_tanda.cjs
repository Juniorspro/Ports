// Corre de verdad (en un contexto aislado de Node, con el motor del juego de mentira) el Lua de addons reales de GMod:
// carga, pone cada entidad, da cada arma y la dispara, corre 3 s de cuadros (timers, Think, HUD) y cuenta los errores.
// uso: node gmod_lua_tanda.cjs <ids separados por coma | archivo con un id por línea> [maxMB] [salida.json]
// (los .gma bajados quedan en GMA_CACHE, por defecto /tmp/gmod_gma; nunca en el repo)
const fs = require('fs'), vm = require('vm'), path = require('path');
const J = path.join(__dirname, '../juego/');
const [, , sel = '', maxMB = '40', SALIDA = 'gmod_lua_tanda.json'] = process.argv;
const ids0 = fs.existsSync(sel) ? fs.readFileSync(sel, 'utf8').split(/\s+/).filter((x) => /^\d+$/.test(x)) : sel.split(',').filter((x) => /^\d+$/.test(x));
const det = new Map(), an = [];
const CACHE = process.env.GMA_CACHE || '/tmp/gmod_gma'; fs.mkdirSync(CACHE, { recursive: true });

// ---- el contexto: lo justo del navegador y del motor ----
const g2d = new Proxy({}, { get: (t, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 7 }) : k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
const elem = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, getContext: () => g2d, width: 0, height: 0, querySelectorAll: () => [], toDataURL: () => 'data:,' });
const ctx = {
  console, Math, JSON, Date, Map, Set, WeakMap, Promise, Uint8Array, Uint16Array, Int16Array, Int32Array, Uint32Array, Float32Array, Float64Array, DataView, ArrayBuffer, TextDecoder, TextEncoder, URLSearchParams, Proxy, Reflect, Symbol, Error, RegExp, Array, Object, String, Number, Boolean, BigInt, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, escape, unescape, btoa, atob,
  performance: require('perf_hooks').performance, setTimeout: () => 0, clearTimeout() {}, location: { search: '' }, matchMedia: () => ({ matches: false }), innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  document: { getElementById: () => elem(), createElement: elem, body: elem(), querySelectorAll: () => [], hasFocus: () => true }, localStorage: { _: {}, getItem(k) { return k in this._ ? this._[k] : null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } },
  createImageBitmap: () => Promise.reject(new Error('sin imagen')), Blob: class {}, URL: { createObjectURL: () => 'blob:x' }, ImageData: class {},
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const correr = (src, n) => vm.runInContext(src, ctx, { filename: n });
correr(fs.readFileSync(J + 'nucleo.js', 'utf8'), 'nucleo.js');
// el motor de mentira (lo que usan gmod*.js)
correr(`
var GFX = { nombre: 'medio', part: 1, texMax: 0 }, VW = () => 1280, VH = () => 720, TIEMPO = { t: 0, dt: 1 / 60 }, CAM = { pos: v3(0, 1.7, 0), fwd: v3(0, 0, 1), der: v3(1, 0, 0), arr: v3(0, 1, 0), q: new Quat(), fov: 75 }, OBJS = [], JUG = { pos: v3(0, 1.7, 0), vivo: true, yaw: 0, medio: 0.9, vel: v3() }, PREFS = { nombre: 'Prueba' };
var DATA = { pf: [], pfPorNombre: { Crate: 0 }, menu: [], tx: [] }, JUEGO = { estado: 'juego' }, UI = { abierto: null }, ENT = { teclas: new Set(), disparo: false, disparo2: false, x: 0, y: 0 };
var ARM = { lista: [], i: 0, sway: { x: 0, y: 0, z: 0 } }, DEF_ARMAS = {}, PH = { hits: [] }, R = { gl: null }, MUNDO = { nombre: 'gm_flatgrass' }, MODS = {};
var CUENTA = { objetos: 0, sonidos: 0, balas: 0, part: 0, avisos: 0, explos: 0 };
function crearObjeto(n, pos, q) { const b = { pos: pos.clone(), q: q ? q.clone() : new Quat(), vel: v3(), ang: v3(), frozen: false, mass: 20, invMass: 0.05, wake() {} }; const o = { nombre: n, b }; b.obj = o; OBJS.push(o); CUENTA.objetos++; return o; }
function borrarObjeto(o) { const i = OBJS.indexOf(o); if (i >= 0) OBJS.splice(i, 1); o.borrado = true; }
function raycast(o, d, max) { if (d.y < -0.01) { const t = (o.y) / -d.y; if (t <= max) return { t, n: v3(0, 1, 0), body: null, p: vadd(o, vscale(d, t)) }; } return null; }
function efectoTraza() {}
function sonar() { CUENTA.sonidos++; } function particula() { CUENTA.part++; } function aviso() { CUENTA.avisos++; } function impactoBala() { CUENTA.balas++; }
function explosion() { CUENTA.explos++; } function efectoExplosion() {} function efectoImpacto() {} function danarJugador(d) { JUG.vida = (JUG.vida || 100) - d; } function danarObjeto() {}
function darArma(n) { if (!ARM.lista.includes(n)) ARM.lista.push(n); ARM.i = ARM.lista.indexOf(n); } function elegirArma(i) { ARM.i = i; } function redObjeto() {} function chatMostrar() {}
function T(k) { return k; } function spawnTabs() {} function gmTexDelJuego() { return null; }
class Modelo { constructor() { this.p = [[0, 0, 0]]; this.raiz = new Float32Array(16); } encolar() {} }
function m4trs() {}
`, 'motor.js');
for (const f of ['gmod_formatos', 'gmod', 'gmod_lib', 'gmod_lua', 'gmod_prelude', 'gmod_api', 'gmod_cargar', 'gmod_render', 'gmod_dx9', 'gmod_rt', 'gmod_vista']) correr(fs.readFileSync(J + f + '.js', 'utf8'), f + '.js');
// (los modelos: sin convertir mallas, el prop es una caja con el nombre del modelo)
correr(`gmPrefab = function (n) { return n; }; gmIcono = function () { return 'x'; }; gmSonido = function (s) { return s; };`, 'parches.js');
if (process.env.PILA) correr(`{ const f0 = gmLlamar; gmLlamar = function (f, ctx, ...a) { const R = GMA.R; if (!R || typeof f !== 'function') return E0; const c0 = GMA.ctx; GMA.ctx = ctx; try { return R.c(f, 'callback', ...a); } catch (e) { if (!(e instanceof LuaError)) console.log('PILA', String(e && e.stack).split('\\n').slice(0, 6).join(' | ')); gmaErr(R.msgErr(e)); return E0; } finally { GMA.ctx = c0; } }; }`, 'pila.js');
const C = (s) => vm.runInContext(s, ctx);

async function detalles(ids) {
  for (let i = 0; i < ids.length; i += 100) {
    const ch = ids.slice(i, i + 100), body = 'itemcount=' + ch.length + ch.map((x, k) => `&publishedfileids[${k}]=${x}`).join('');
    const d = await (await fetch('https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })).json();
    for (const x of (d.response && d.response.publishedfiledetails) || []) if (x.result === 1) { det.set(String(x.publishedfileid), x); an.push({ id: String(x.publishedfileid), t: x.title, MB: (+x.file_size || 0) / 1e6, ext: { '.lua': 1 } }); }
  }
}
async function bajar(id) {
  const f = path.join(CACHE, id + '.gma'); if (fs.existsSync(f)) return new Uint8Array(fs.readFileSync(f));
  const d = det.get(id); if (!d || !d.file_url) return null;
  const r = await fetch(d.file_url); if (!r.ok) return null; let b = new Uint8Array(await r.arrayBuffer());
  if (!(b[0] === 0x47 && b[1] === 0x4d && b[2] === 0x41 && b[3] === 0x44)) { ctx.__b = b; b = C('GMF.lzma(__b)'); }
  fs.writeFileSync(f, b); return b;
}

(async () => {
  await detalles(ids0);
  const lista = an.filter((x) => x.MB <= +maxMB && (det.get(x.id).file_url || fs.existsSync(path.join(CACHE, x.id + '.gma')))).map((x) => x.id);   // (los de SteamPipe, si ya están en la caché)
  const res = [];
  for (const id of lista) {
    const meta = an.find((x) => x.id === id) || {};
    let b; try { b = await bajar(id); } catch (e) { b = null; }
    if (!b) { res.push({ id, t: meta.t, sinArchivo: true }); continue; }
    ctx.__b = b; ctx.__id = id;
    C('gmaReiniciar(); GMOD.addons.clear(); GMOD.arch.clear(); GMA.errCuenta = new Map(); GMA.errores = []; OBJS.length = 0; ARM.lista = []; ARM.i = 0; GMA.consola = [];');
    const t0 = Date.now();
    let A; try { A = C('gmMontar(__id, GMF.gma(__b), { nombre: __id })'); await A.listo; } catch (e) { res.push({ id, t: meta.t, roto: String(e).slice(0, 120) }); continue; }   // (el Lua corre cuando llega lo que pide del contenido base)
    const r = { id, t: meta.t, cat: meta.cat, lua: A.lua.length, corridos: A.luaCorridos || 0, errCarga: (A.luaErr || []).length, ms: A.luaMs, sents: (A.sents || []).length, sweps: (A.sweps || []).length, efectos: (A.efectos || []).length, herr: (A.herramientas || []).length, ejCarga: (A.luaErr || []).slice(0, 4) };
    // jugar: poner las entidades, dar las armas y disparar, 3 s de cuadros
    const e0 = C('GMA.errores.length'); C('Object.assign(CUENTA, { objetos: 0, sonidos: 0, balas: 0, part: 0, avisos: 0, explos: 0 })');
    try {
      C(`for (const c of (GMOD.addons.get(__id).sents || []).slice(0, 12)) gmaSpawnMenu('gment:' + c);`);
      r.entsVivas = C(`[...GMA.ents.values()].filter((e) => e.tipo === 'ent' && e.vivo && e.creado).length`);
      const sweps = C('(GMOD.addons.get(__id).sweps || []).slice(0, 12)');
      for (let i = 0; i < 180; i++) {
        if (i % 15 === 0 && sweps.length) C(`gmaSpawnMenu('gmswep:' + ${JSON.stringify(sweps[Math.floor(i / 15) % sweps.length])}); ARM.i = ARM.lista.length - 1;`);
        C(`TIEMPO.t += 1 / 60; ENT.disparo = ${i % 4 < 2}; ENT.disparo2 = ${i % 30 === 7}; gmLuaPaso(1 / 60); gmaHUDPaso();`);
      }
    } catch (e) { r.excepcion = String(e.stack || e).slice(0, 300); }
    r.errJuego = C('GMA.errores.length') - e0; r.ejJuego = C(`GMA.errores.slice(${e0}, ${e0} + 4)`);
    r.faltan = C('JSON.stringify([...(GMA.faltan || new Map())])'); C('GMA.faltan && GMA.faltan.clear()');
    r.cuenta = C('JSON.parse(JSON.stringify(CUENTA))'); r.msCuadro = +C('GMA.ms || 0').toFixed(3); r.seg = (Date.now() - t0) / 1000;
    res.push(r);
    process.stdout.write(`${id} ${String(meta.t).slice(0, 28).padEnd(28)} lua ${r.lua} carga-err ${r.errCarga} juego-err ${r.errJuego} ents ${r.sents}/${r.entsVivas} sweps ${r.sweps} ${r.excepcion ? 'EXC' : ''}\n`);
  }
  fs.writeFileSync(SALIDA, JSON.stringify(res, null, 1));
  const ok = res.filter((r) => r.lua && !r.errCarga && !r.errJuego && !r.excepcion), conLua = res.filter((r) => r.lua);
  console.log(`\naddons con Lua ${conLua.length}; sin ningún error ${ok.length} (${((100 * ok.length) / Math.max(1, conLua.length)).toFixed(0)}%); con errores de carga ${conLua.filter((r) => r.errCarga).length}; con errores jugando ${conLua.filter((r) => r.errJuego).length}`);
  const cnt = new Map(); for (const r of conLua) for (const m of [...(r.ejCarga || []), ...(r.ejJuego || [])]) { const k = String(m).replace(/^[^:]*:\d+: /, '').replace(/'[^']*'/g, "'X'").slice(0, 90); cnt.set(k, (cnt.get(k) || 0) + 1); }
  for (const [k, n] of [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(n, k);
  const fal = new Map(); for (const r of conLua) for (const [k] of JSON.parse(r.faltan || '[]')) fal.set(k, (fal.get(k) || 0) + 1);
  console.log('\nmétodos/funciones del motor que faltan (en cuántos addons):'); console.log([...fal].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, n]) => n + ' ' + k).join(' | '));
})();
