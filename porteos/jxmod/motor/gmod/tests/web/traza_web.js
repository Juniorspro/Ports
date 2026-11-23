// Traza de lo que un addon le pide al juego, corriendo la capa GMod de la web (gmod_lua.js, gmod_api.js, gmod_prelude.js,
// gmod_cargar.js) con un juego de mentira. Lo mismo hace el binario jxgmod_traza con el anfitrión de prueba de jxgmod:
// las dos trazas tienen que salir iguales.
//   node traza_web.js <addon.gma | carpeta> [--ticks 120] [--descubrir]
// La salida: una línea por pedido al juego («<cuadro> <operación> <args>»), los cambios del jugador, la cámara, las armas
// y los objetos al final de cada cuadro, lo que imprime el Lua y sus errores.
'use strict';
const fs = require('fs'), path = require('path');
const JUEGO_DIR = path.resolve(__dirname, '../../../../juego');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TICKS = +opt('--ticks', 120), DESCUBRIR = args.includes('--descubrir');
const fuente = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--descubrir'));

// ---------------- leer el addon ----------------
function leerGma(b) {
  if (b.toString('latin1', 0, 4) !== 'GMAD') return null;
  let p = 4; const ver = b[p++]; p += 16;
  const cad = () => { const i = b.indexOf(0, p); const s = b.toString('latin1', p, i); p = i + 1; return s; };
  if (ver > 1) while (cad() !== '') {}
  cad(); cad(); cad(); p += 4;
  const ents = [];
  for (;;) { const n = b.readUInt32LE(p); p += 4; if (n === 0) break; const nom = cad(); const tam = Number(b.readBigInt64LE(p)); p += 8; p += 4; ents.push([nom, tam]); }
  const out = new Map();
  for (const [nom, tam] of ents) { out.set(nom.toLowerCase().replace(/\\/g, '/'), b.subarray(p, p + tam)); p += tam; }
  return out;
}
function leerCarpeta(d) {
  const out = new Map();
  const rec = (x, rel) => { for (const n of fs.readdirSync(x)) { const f = path.join(x, n), st = fs.statSync(f); const r = rel ? rel + '/' + n : n; if (st.isDirectory()) rec(f, r); else out.set(r.toLowerCase(), fs.readFileSync(f)); } };
  rec(d, '');
  // (los nombres aplanados: lua__autorun__x.lua → lua/autorun/x.lua; una carpeta con lua/ adentro más abajo)
  const res = new Map();
  for (const [r, b] of out) {
    let q = r; const base = q.replace(/^.*\//, '');
    if (/^(lua|materials|models|sound)__/.test(base)) q = base.replace(/__/g, '/');
    else { const i = q.indexOf('lua/'); if (i > 0 && q[i - 1] === '/') q = q.slice(i); }
    res.set(q, b);
  }
  return res;
}
const st = fs.statSync(fuente);
const archivos = st.isDirectory() ? leerCarpeta(fuente) : leerGma(fs.readFileSync(fuente));
if (!archivos) { console.error('no es un addon: ' + fuente); process.exit(2); }

// ---------------- canónico ----------------
const fmtN = (x) => { if (Number.isNaN(x)) return 'nan'; if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf'; if (Number.isInteger(x)) return String(x === 0 ? 0 : x); return String(+x.toPrecision(6)); };
const fmtS = (s) => { let o = '"'; for (const ch of String(s)) { const c = ch.codePointAt(0); if (ch === '"' || ch === '\\') o += '\\' + ch; else if (c < 32 || c > 126) o += '\\u' + c.toString(16).padStart(4, '0'); else o += ch; } return o + '"'; };
let F;
F = (x) => {
  if (x === undefined || x === null) return 'nil';
  if (typeof x === 'number') return fmtN(x);
  if (typeof x === 'boolean') return x ? 'true' : 'false';
  if (typeof x === 'string') return fmtS(x);
  if (Array.isArray(x)) return '[' + x.map(F).join(',') + ']';
  if (x instanceof V3) return 'v(' + fmtN(x.x) + ',' + fmtN(x.y) + ',' + fmtN(x.z) + ')';
  if (x instanceof Quat) return 'q(' + fmtN(x.x) + ',' + fmtN(x.y) + ',' + fmtN(x.z) + ',' + fmtN(x.w) + ')';
  if (x && x.__obj) return 'o#' + x.__obj;
  if (x && x.__persona) return 'p#' + x.__persona;
  if (x instanceof Set) return '{' + [...x].sort().map(F).join(',') + '}';
  return typeof x;
};
let CUADRO = 'm';
const SAL = [];
const SIN_TRAZA = args.includes('--tiempo');
const L = (op, ...a) => { if (SIN_TRAZA) return; SAL.push(CUADRO + ' ' + op + (a.length ? ' ' + a.map(F).join(' ') : '')); };

// ---------------- matemática del juego (nucleo.js) ----------------
const nucleo = fs.readFileSync(path.join(JUEGO_DIR, 'nucleo.js'), 'utf8').split('\n');
const iV3 = nucleo.findIndex((l) => l.startsWith('const hypot ')), iM4 = nucleo.findIndex((l) => l.startsWith('const M4 = {'));
const MAT = nucleo.slice(iV3, iM4).join('\n');
const { V3, Quat, v3, vsub, vadd, vscale, vcross, vdot } = new Function(MAT + '\nreturn { V3, Quat, v3, vsub, vadd, vscale, vcross, vdot };')();
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// ---------------- el azar: el mismo xorshift64* de jxlua (bib/mates.rs) ----------------
const M64 = (1n << 64n) - 1n;
let AZ = 0x2545f4914f6cdd1dn ^ 0x5eedn;
Math.random = () => { let x = AZ; x ^= x >> 12n; x = (x ^ (x << 25n)) & M64; x ^= x >> 27n; AZ = x; const r = (x * 0x2545f4914f6cdd1dn) & M64; return Number(r >> 11n) / 9007199254740992; };

// ---------------- el juego de mentira ----------------
const TIEMPO = { t: 0, dt: 1 / 60 };
const JUG = { pos: v3(0, 0.95, 0), vel: v3(), vivo: true, vida: 100, yaw: 0, pitch: 0, medio: 0.5, radio: 0.45, ojoAlto: 1.7, suelo: true, agachado: false, noclip: false, vehiculo: null, tercera: false, ojoPos: null, congelado: false, bloqueado: false, vel_max: 6, salto: 1.1, cuerpo: null, fpVeh: false, reloj: 0, tiempoSuelo: 0, saltoT: 0 };
const CAM = { pos: v3(0, 1.6, 0), fwd: v3(0, 0, 1), der: v3(-1, 0, 0), arr: v3(0, 1, 0), q: new Quat(), fov: 75, temblor: 0 };
const ENT = { disparo: false, disparo2: false, teclas: new Set(), correr: false, saltar: false, agachar: false, x: 0, y: 0 };
const ARM = { lista: ['Hands', 'Pistol'], i: 0, v: null, calla: false, sway: null, agarre: null };
const DEF_ARMAS = { Hands: { nodo: 'h', ic: 'W_Hands', fuego: 'hf', recarga: 'hr', sacar: 'hs', quieto: 'hq' }, Pistol: { nodo: 'p', ic: 'W_Pistol', fuego: 'pf', recarga: 'pr', sacar: 'ps', quieto: 'pq' }, Crowbar: { nodo: 'c', ic: 'W_Crowbar', fuego: 'cf', recarga: null, sacar: 'cs', quieto: 'cq' } };
const JUEGO = { estado: 'juego', dios: false };
const PREFS = { nombre: 'Jugador', lang: 'es' };
const UI = { abierto: false };
const CTL = { raton: false, teclasMod: new Set(), inMod: false };
const MUNDO = { spawns: [v3(0, 0, 0)], nombre: 'gm_prueba' };
const PH = { hits: [] };
const GFX = { nombre: 'alto' };
const DATA = { pf: { Crate: [{ m: 'crate' }] }, pfPorNombre: { Crate: 'Crate' }, ms: { crate: { mn: [-0.4, -0.4, -0.4], sc: [0.8, 0.8, 0.8] } } };
const GMOD = { addons: new Map(), arch: new Map(), iconos: new Map(), pf: new Map() };
const LINT = { on: false, permitida: true };
const NPC = { lista: [] };
// (GMF.kv de gmod_formatos.js: KeyValues de verdad, como la web)
const GMF = {};
{ const f = fs.readFileSync(path.join(JUEGO_DIR, 'gmod_formatos.js'), 'utf8'); const i = f.indexOf('GMF.kv = function'), j = f.indexOf('\n};\n', i); new Function('GMF', f.slice(i, j + 3))(GMF); }
const HUD = { resIz: null };
const OBJS = [];
const GMNB = { ambito: 0 }, GMPZ = { idx: new Map() }, GML = { datos: new Map() }, R = {};
const gmVtfYa = () => null, gmlTiene = () => false, gmnbRemLista = () => [], createImageBitmap = () => new Promise(() => {});
class FDate extends Date { constructor(...a) { if (a.length) super(...a); else super(1.7e12 + TIEMPO.t * 1000); } static now() { return 1.7e12 + TIEMPO.t * 1000; } }
const gmvRutaMdl = (m) => String(m).toLowerCase().replace(/\\/g, '/'), gmvPmNombre = () => 'kleiner', GMV_PM_BASE = new Map();
const gmvManosDeNombre = () => ({ model: 'models/weapons/c_arms_citizen.mdl', skin: 0, body: '0000000', matchBodySkin: false });
const gmsnParche = (s, on, fade) => L('parche_sonido', s.e && s.e.id, s.s, on, s.vol, s.tono, fade);
let nObj = 0;
const objetos = new Map();
const crearObjeto = (pf, pos, q, op) => { const o = { __obj: ++nObj, nombre: pf, b: { pos: pos.clone(), q: (q || new Quat()).clone(), vel: v3(), ang: v3(), mass: 10, invMass: 0.1, frozen: false, sleep: false, aabb: { x0: pos.x - 0.25, y0: pos.y - 0.25, z0: pos.z - 0.25, x1: pos.x + 0.25, y1: pos.y + 0.25, z1: pos.z + 0.25 }, wake() {}, updateWorld() {}, setMasa(m) { this.mass = m; this.invMass = 1 / m; } }, borrado: false }; L('crear_objeto', pf, pos, q || new Quat()); objetos.set(o.__obj, o); OBJS.push(o); return o; };
const borrarObjeto = (o) => { if (!o || o.borrado) return; o.borrado = true; L('borrar_objeto', o); objetos.delete(o.__obj); const i = OBJS.indexOf(o); if (i >= 0) OBJS.splice(i, 1); };
const raycast = (o, d, max) => { if (!(d.y < -1e-9)) return null; const t = -o.y / d.y; if (t < 0 || t > max) return null; return { t, n: v3(0, 1, 0), p: vadd(o, vscale(d, t)), body: null }; };
const mundoRayo = raycast;
const sonar = (n, pos, vol, tono) => L('sonido', n, pos, vol, tono);
const gmSonido = (s) => (s ? String(s).toLowerCase().replace(/\\/g, '/') : null);
const gmsnGuion = () => null;
const gmsnEmitir = (e, s, nivel, tono, vol, canal) => L('emitir_sonido', e && e.id, s, nivel, tono, vol, canal);
const gmsnParar = (e, s) => L('parar_sonido', e && e.id, s);
const gmsnPaso = () => {};
const danarJugador = (d) => L('danar_jugador', d);
const danarPersona = (P, d, p, dir) => L('danar_persona', P, d, p, dir);
const danarObjeto = (o, d, p, dir) => L('danar_objeto', o, d, p, dir);
const efectoImpacto = (p, n, tipo) => L('efecto_impacto', p, n, tipo);
const efectoExplosion = (p) => L('efecto_explosion', p);
const efectoTraza = (a, b) => L('efecto_traza', a, b);
const efectoFogonazo = () => L('efecto_fogonazo');
const particula = (p, v, vida, tam, col, tipo, crece) => L('particula', p, v, vida, tam, col, tipo, crece);
const explosion = (p, r, m) => L('explosion', p, r, m, !!explosion.sinFx);
const sacudir = (a) => L('sacudir', a);
const chatMostrar = (q, s) => L('chat', s);
const aviso = (s, d) => L('aviso', s, d);
const morirJugador = () => { L('matar_jugador'); JUG.vivo = false; };
const darArma = (n) => { L('dar_arma', n); if (!ARM.lista.includes(n)) ARM.lista.push(n); ARM.i = ARM.lista.indexOf(n); };
const elegirArma = (i) => { L('elegir_arma', i); ARM.i = i; };
const elegirArmaCallado = (n) => { L('elegir_arma_n', n); const i = ARM.lista.indexOf(n); if (i >= 0) ARM.i = i; };
const linternaAlternar = (on) => { L('linterna', on); LINT.on = on; };
const gmArchivo = (r) => GMOD.arch.get(String(r).toLowerCase()) || null;
const gmArchivo0 = gmArchivo;
const gmExiste = (r) => GMOD.arch.has(String(r).toLowerCase());
const gmPrefab = () => true;
const VW = () => 1280, VH = () => 720;
const devicePixelRatio = 1;
const gmvModeloJugador = () => 'models/player/kleiner.mdl';
const gmrDrawModel = (e) => L('dibujar_modelo', e.id);
const gmrMetodo = () => undefined;
const gmrEfecto = (cls, n) => L('efecto_lua', n);
const T = (k) => k;
const subirVehiculo = (o) => L('subir_vehiculo', o);
const puertaAlternar = () => {};
const GM_ICO = '';
const performance = { now: () => TIEMPO.t * 1000 };
const localStorage = { _d: new Map(), getItem(k) { return this._d.has(k) ? this._d.get(k) : null; }, setItem(k, v) { this._d.set(k, String(v)); }, removeItem(k) { this._d.delete(k); } };
// el lienzo de la HUD: anota lo que se dibuja
const lienzo = () => {
  const g = { _fill: '#000', _stroke: '#000', font: '10px sans-serif', textBaseline: 'alphabetic', lineWidth: 1, globalAlpha: 1, textAlign: 'start' };
  const D = (op, ...a) => L('d2', op, ...a);
  Object.defineProperty(g, 'fillStyle', { get() { return this._fill; }, set(v) { this._fill = v; } });
  Object.defineProperty(g, 'strokeStyle', { get() { return this._stroke; }, set(v) { this._stroke = v; } });
  Object.assign(g, {
    setTransform() {}, clearRect() {}, save() { D('save'); }, restore() { D('restore'); }, translate(x, y) { D('translate', x, y); }, rotate(r) { D('rotate', r); },
    fillRect(x, y, w, h) { D('rect', x, y, w, h, g._fill, g.globalAlpha); }, strokeRect(x, y, w, h) { D('srect', x, y, w, h, g._stroke, g.lineWidth); },
    fillText(s, x, y) { D('texto', s, x, y, g.font, g._fill, g.textBaseline); }, strokeText(s, x, y) { D('stexto', s, x, y, g.font, g._stroke, g.lineWidth); },
    beginPath() { D('path'); }, moveTo(x, y) { D('mover', x, y); }, lineTo(x, y) { D('linea', x, y); }, quadraticCurveTo(a, b, c, d) { D('curva', a, b, c, d); }, arc(x, y, r) { D('arco', x, y, r); }, closePath() { D('cerrar'); },
    fill() { D('llenar', g._fill); }, stroke() { D('trazar', g._stroke, g.lineWidth); }, drawImage(img) { D('imagen', img && img.n); }, measureText(s) { return { width: anchoTexto(g.font, s) }; },
  });
  return g;
};
// (ancho de un texto: el mismo cálculo que el anfitrión de prueba de jxgmod)
const anchoTexto = (css, s) => { const m = /([\d.]+)px/.exec(css); const px = m ? +m[1] : 13; return String(s).length * px * 0.5; };
const document = { createElement: () => ({ style: {}, getContext: () => lienzo(), width: 0, height: 0 }), body: { appendChild() {} }, getElementById: () => null };

const STUB = { TIEMPO, JUG, CAM, ENT, ARM, DEF_ARMAS, JUEGO, PREFS, UI, CTL, MUNDO, PH, GFX, DATA, GMOD, LINT, NPC, HUD, OBJS, crearObjeto, borrarObjeto, raycast, mundoRayo, sonar, gmSonido, gmsnGuion, gmsnEmitir, gmsnParar, gmsnPaso,
  danarJugador, danarPersona, danarObjeto, efectoImpacto, efectoExplosion, efectoTraza, efectoFogonazo, particula, explosion, sacudir, chatMostrar, aviso, morirJugador, darArma, elegirArma, elegirArmaCallado, linternaAlternar,
  gmArchivo, gmArchivo0, gmExiste, gmPrefab, VW, VH, devicePixelRatio, gmvModeloJugador, gmrDrawModel, gmrMetodo, gmrEfecto, T, subirVehiculo, puertaAlternar, GM_ICO, performance, localStorage, document,
  Date: FDate, GMF, gmvRutaMdl, gmvPmNombre, GMV_PM_BASE, gmvManosDeNombre, GMNB, GMPZ, GML, R, gmVtfYa, gmlTiene, gmnbRemLista, createImageBitmap, gmsnParche, V3, Quat, v3, vsub, vadd, vscale, vcross, vdot, clamp, console: { log() {}, warn() {}, error() {} } };
const faltan = new Map();
const proxy = new Proxy(STUB, {
  has(t, k) { return typeof k === 'string' && !(k in globalThis && !(k in t)); },
  get(t, k) { if (k === Symbol.unscopables) return undefined; if (k in t) return t[k]; if (DESCUBRIR) faltan.set(k, (faltan.get(k) || 0) + 1); return undefined; },
  set(t, k, v) { t[k] = v; return true; },
});

// ---------------- la capa GMod de la web ----------------
const src = ['gmod_lua.js', 'gmod_api.js', 'gmod_prelude.js', 'gmod_cargar.js'].map((f) => fs.readFileSync(path.join(JUEGO_DIR, f), 'utf8').replace(/^if \(typeof module[^\n]*$/gm, '')).join('\n;\n');
const W = new Function('__stub', 'with (__stub) {\n' + src + '\n;return { GMA, gmLuaMontar, gmLuaPaso, gmaHUDPaso, gmaSpawnMenu, gmaIniciar, LuaTable, LEnt, NULL_ENT };\n}')(proxy);
const { GMA } = W;
// (lo que imprime el Lua y sus errores, a la traza)
const anotar = (op) => { const a = []; a.push = function (...x) { for (const s of x) L(op, s); return Array.prototype.push.apply(this, x); }; return a; };
if (process.env.JXGMOD_ENTS) GMA.ents.set = function (k, v) { console.error('ent ' + k + ' ' + v.clase); return Map.prototype.set.call(this, k, v); };
GMA.consola = anotar('consola'); GMA.errores = anotar('error');
// (las entidades en la traza: e#id)
const F0 = F; F = (x) => (x instanceof W.LEnt ? 'e#' + x.id : F0(x));

// ---------------- --api: cada llamada del Lua a la API nativa (nombre y argumentos) ----------------
const API = args.includes('--api');
if (API) {
  W.gmaIniciar();
  const R0 = GMA.R, G = R0.G, LT = W.LuaTable;
  const esLua = (f) => String(f).includes('R.largo()');
  const Fa = (x) => { if (x instanceof LT) return 'table'; if (typeof x === 'function') return 'function'; if (typeof x === 'string') return F(x.length > 60 ? x.slice(0, 60) : x); if (x && typeof x === 'object' && x.x !== undefined && x.__mt === GMA.mtVec) return 'v(' + fmtN(x.x) + ',' + fmtN(x.y) + ',' + fmtN(x.z) + ')'; if (x && typeof x === 'object' && x.p !== undefined && x.__mt === GMA.mtAng) return 'a(' + fmtN(x.p) + ',' + fmtN(x.y) + ',' + fmtN(x.r) + ')'; if (x instanceof W.LEnt) return 'e#' + x.id; if (x && typeof x === 'object') return 'userdata'; return F(x); };
  const vistas = new Set();
  const envolver = (t, pre) => {
    if (!(t instanceof LT) || vistas.has(t)) return; vistas.add(t);
    const ks = t.claves().filter((k) => typeof k === 'string').sort();
    for (const k of ks) { const f = t.get(k); if (typeof f !== 'function' || esLua(f) || f.__lados || f.g || k.startsWith('__')) continue;
      const n = pre + k; t.set(k, function (...a) { SAL.push(CUADRO + ' api ' + F(n) + (a.length ? ' ' + a.map(Fa).join(' ') : '')); return f.apply(this, a); }); }
  };
  const STD = new Set(['string', 'table', 'math', 'os', 'coroutine', 'debug', 'bit', 'utf8', 'io', '_G', 'package', 'jit']);
  for (const n of ['Entity', 'Player', 'Weapon', 'NPC', 'Vehicle', 'PhysObj', 'Vector', 'Angle']) envolver(GMA.metas[n], n + ':');
  for (const [n, m] of [['Color', GMA.mtCol], ['ConVar', GMA.mtCvar], ['CTakeDamageInfo', GMA.mtDmg && GMA.mtDmg.get('__index')], ['CEffectData', GMA.mtEfecto && GMA.mtEfecto.get('__index')], ['CSoundPatch', GMA.mtSnd && GMA.mtSnd.get('__index')]]) envolver(m, n + ':');
  const ks = G.claves().filter((k) => typeof k === 'string').sort();
  for (const k of ks) { const v = G.get(k); if (v instanceof LT && !STD.has(k)) envolver(v, k + '.'); }
  { const t = new LT(); for (const k of ks) { const v = G.get(k); if (typeof v === 'function' && /^[A-Z]/.test(k)) t.set(k, v); } vistas.delete(G); envolver(t, ''); for (const k of t.claves()) G.set(k, t.get(k)); }
}

// ---------------- montar y correr ----------------
for (const [r, b] of archivos) GMOD.arch.set(r, b);
const A = { id: 'addon', nombre: path.basename(fuente), lua: [...archivos.keys()].filter((r) => r.endsWith('.lua')), G: { archivos } };
GMOD.addons.set(A.id, A);
W.gmLuaMontar(A);
L('montado', A.luaCorridos || 0, A.sweps, A.sents);
// (lo que se mira al final de cada cuadro: el jugador, la cámara, las armas y los objetos)
const foto = () => {
  const f = new Map();
  for (const k of ['pos', 'vel', 'vida', 'vivo', 'yaw', 'pitch', 'congelado', 'bloqueado', 'vel_max', 'salto', 'fpVeh', 'suelo']) f.set('jug.' + k, F(JUG[k]));
  f.set('cam.temblor', F(CAM.temblor)); f.set('arm.lista', F(ARM.lista)); f.set('arm.i', F(ARM.i));
  for (const o of objetos.values()) { const b = o.b; f.set(F(o), [F(b.pos), F(b.q), F(b.vel), F(b.ang), F(b.mass), F(b.frozen), F(!!o.gmOculto)].join(' ')); }
  return f;
};
let ant = foto();
const cambios = () => { const f = foto(); for (const [k, v] of f) if (ant.get(k) !== v) L('cambio', k + ' ' + v); for (const k of ant.keys()) if (!f.has(k)) L('cambio', k + ' -'); ant = f; };
cambios();
// el guion del jugador: aparece, saca cada arma del addon (ataque primario, secundario, recarga) y pone sus entidades
const sweps = (A.sweps || []).slice(), sents = (A.sents || []).slice(0, 6);
const V = Math.max(10, Math.floor((TICKS - 10) / Math.max(1, sweps.length)));
const TIEMPOS = [];
for (let k = 1; k <= TICKS; k++) {
  CUADRO = String(k); TIEMPO.t = k / 60; TIEMPO.dt = 1 / 60;
  ENT.disparo = false; ENT.disparo2 = false; ENT.teclas.clear();
  if (k >= 2 && k - 2 < sents.length) W.gmaSpawnMenu('gment:' + sents[k - 2]);
  const j = Math.floor((k - 10) / V), r = (k - 10) % V;
  if (k >= 10 && j < sweps.length) {
    if (r === 0) W.gmaSpawnMenu('gmswep:' + sweps[j]);
    else if (r >= 2 && r < 2 + Math.floor(V / 3)) ENT.disparo = true;
    else if (r >= 2 + Math.floor(V / 3) && r < 2 + Math.floor((2 * V) / 3)) ENT.disparo2 = true;
    else if (r === V - 2) ENT.teclas.add('KeyR');
  }
  const t0 = process.hrtime.bigint();
  W.gmLuaPaso(1 / 60);
  W.gmaHUDPaso();
  TIEMPOS.push(Number(process.hrtime.bigint() - t0) / 1e6);
  if (!SIN_TRAZA) cambios();
  if (args.includes('--nid')) L('nid', GMA.nid);
}
if (SIN_TRAZA) { const u = TIEMPOS.slice(-60); console.log('web: cuadro promedio ' + (TIEMPOS.reduce((a, b) => a + b, 0) / TIEMPOS.length).toFixed(3) + ' ms; últimos 60: ' + (u.reduce((a, b) => a + b, 0) / u.length).toFixed(3) + ' ms'); process.exit(0); }
process.stdout.write(SAL.join('\n') + '\n');
if (DESCUBRIR) console.error('faltan: ' + [...faltan].sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ':' + n).join(' '));
