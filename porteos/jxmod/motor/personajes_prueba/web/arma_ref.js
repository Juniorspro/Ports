// la referencia de la web para el arma en la mano y sentado en un vehículo: personas.js, humano.js, vehiculos.js (la
// cabina y asientoPose), nativos.js (girarMundo e ik2) y armasHL2 de armas.js corridos en Node, con las escenas de
// armas_escenas.json; escribe cada nodo del esqueleto en el mundo y la matriz del arma en la mano (lo mismo que escribe
// examples/arma_comparar.rs) para compararlos con arma_comparar.py. Los vehículos van donde dice la salida del port
// (su centro y dónde está su cuerpo: hay que correr antes examples/arma_comparar.rs).
// Uso: node arma_ref.js ESCENAS.json SALIDA_RUST.json SALIDA.json   (JXM_WWW: el paquete)
// Con JXM_ENTRA=1, en los vehículos la persona entra parada (como en el juego: P.faldon se mide en el primer cuadro en el
// auto, que todavía tiene la pose de parado)
const fs = require('fs'), vm = require('vm'), zlib = require('zlib'), path = require('path');
const J = path.join(__dirname, '../../../juego/');
const W = (process.env.JXM_WWW || '/tmp/claude-0/jxm/www_todo') + '/';
const idx = JSON.parse(fs.readFileSync(W + 'pk.idx.json')), pk = fs.readFileSync(W + 'pk.bin');
const parte = (k) => pk.subarray(idx[k][0], idx[k][0] + idx[k][1]);
const DATA = JSON.parse(zlib.gunzipSync(parte('d')));
const BIN = new Uint8Array(zlib.gunzipSync(parte('m')));
DATA.pfPorNombre = {}; for (const k of Object.keys(DATA.pf)) { const n = k.split('#')[0]; if (!(n in DATA.pfPorNombre)) DATA.pfPorNombre[n] = k; }
const esc = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), rs = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const nada = () => {};
const ctx = { console, Math, JSON, Float32Array, Float64Array, Uint8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, Map, Set, Object, Array, Number, String, DataView, TextEncoder, Date, isFinite,
  window: {}, document: { getElementById: () => null, createElement: () => ({ getContext: () => null, style: {} }), addEventListener: nada }, location: { search: '', href: 'file:///x', protocol: 'file:' },
  matchMedia: () => ({ matches: false }), navigator: {}, performance: { now: () => 0 }, localStorage: { getItem: () => null, setItem: nada }, addEventListener: nada, setTimeout: nada, URLSearchParams };
ctx.RBP = { alListo: [] }; vm.createContext(ctx);
const cargar = (f) => { try { vm.runInContext(fs.readFileSync(J + f, 'utf8'), ctx, { filename: f }); } catch (e) { console.error('ERR', f, e.message); } };
for (const f of ['nucleo.js', 'gl.js', 'modelo.js', 'vista.js', 'personas.js', 'humano.js', 'emotes.js', 'vehiculos.js', 'nativos.js']) cargar(f);
// (lo que hace falta de datos.js y de armas.js)
const sacar = (src, re) => { const L = src.split('\n'), i = L.findIndex((l) => re.test(l)); let j = i + 1; while (!/^\};?\s*$/.test(L[j])) j++; return L.slice(i, j + 1).join('\n'); };
const datos = fs.readFileSync(J + 'datos.js', 'utf8'), armas = fs.readFileSync(J + 'armas.js', 'utf8');
vm.runInContext(sacar(datos, /^function desfiltrarIndices\(/) + '\n' + datos.split('\n').find((l) => /^const _mallaCPU =/.test(l)) + '\n' + sacar(datos, /^function mallaCPU\(/) + '\n' +
  sacar(armas, /^const DEF_ARMAS = \{/) + '\n' + sacar(armas, /^function armasHL2\(/), ctx);
ctx.DATA = DATA; ctx.BIN = BIN; ctx.RB_BINS = {};
// (las mallas: los índices vienen filtrados; los personajes de un paquete aparte, de rb/)
if (idx.m[2] === 1) vm.runInContext('desfiltrarIndices(BIN, DATA.ms.filter((m) => !m.k))', ctx);
for (const e of esc.escenas) {
  const k = 's_' + e.skin; if (!DATA.rbp || !DATA.rbp[k] || ctx.RB_BINS[k]) continue;
  const u = fs.readFileSync(W + 'rb/' + DATA.rbp[k][0]), n = u.readUInt32LE(4), ix = JSON.parse(u.subarray(8, 8 + n).toString()), d = u.subarray(8 + n);
  if (!ix.m) continue;
  ctx.RB_BINS[k] = new Uint8Array(zlib.gunzipSync(d.subarray(ix.m[0], ix.m[0] + ix.m[1])));
  ctx.RB_K = k; vm.runInContext('desfiltrarIndices(RB_BINS[RB_K], DATA.ms.filter((m) => m.k === RB_K))', ctx);
}
vm.runInContext(`
var binDe = (d) => (d && d.k ? RB_BINS[d.k] || null : BIN);
var GFX = { lod: 0 }; var TIEMPO = { t: 0, dt: 1 / 60 }; var JUG = { cuerpo: null, medio: 0.5, radio: 0.45 };
var rbListo = () => true, rbDeSkin = (s) => 's_' + s, rbPedir = () => {}; var aguaNadaPersona = () => null; var emoPose = () => {}, cicPose = () => {};
var PERS_N = 0;
// (la malla en la placa: sólo lo que usa asientoFaldon para la piel en la CPU)
var mallaGL = (i) => ({ d: DATA.ms[i], idx: i });
Modelo.prototype.encolar = function () {};
armasHL2();
`, ctx);
ctx.ESC = esc; ctx.RS = rs; ctx.ENTRA = !!process.env.JXM_ENTRA;
const out = vm.runInContext(`(() => {
  const R = { escenas: [] };
  ESC.escenas.forEach((E, ie) => {
    const P = crearPersona(E.skin, 'HatEmpty', { nombre: '' }); JUG.cuerpo = P;
    const md = P.md, D = P.D;
    // (la postura del torso de cada arma se guarda por skin: la primera vez rehace las matrices; el port la guarda por
    // persona, así que acá cada escena empieza sin ella)
    D.torsoRef = {};
    P.pos.set(0, 1, 0); P.yaw = 0; P.suelo = true;
    // el vehículo: donde lo puso el port
    let o = null, a = 0, jp = null;
    const vi = RS.escenas[ie] && RS.escenas[ie].veh;
    if (E.veh && vi) {
      const arb = DATA.pf[DATA.pfPorNombre[E.veh.nombre]];
      o = { md: new Modelo(arb), c: v3(vi.c[0], vi.c[1], vi.c[2]), b: { pos: v3(vi.pos[0], vi.pos[1], vi.pos[2]), q: new Quat(vi.q[0], vi.q[1], vi.q[2], vi.q[3]) }, nombre: E.veh.nombre };
      o.md.p[0] = [0, 0, 0]; o.md.sucio = true;
      vehiculoNuevo(o);
      const M = m4trs([o.b.pos.x, o.b.pos.y, o.b.pos.z], [o.b.q.x, o.b.q.y, o.b.q.z, o.b.q.w], [1, 1, 1], new Float32Array(16)), T = m4trs([-o.c.x, -o.c.y, -o.c.z], [0, 0, 0, 1], [1, 1, 1], new Float32Array(16));
      m4mul(M, T, o.md.raiz); o.md.sucio = true; o.md.actualizar();
      a = E.veh.a || 0; const s = o.veh.asientos[a], pS = vadd(o.b.pos, o.b.q.rot(vadd(s, v3(0, 0.75, 0)))); jp = vadd(pS, v3(0, -0.5, 0));
    }
    const cuadros = []; let yaw = 0, mira = 0, cab = null;
    for (const t of E.tramos) {
      if ('arma' in t) P.arma = t.arma;
      if ('yaw' in t) yaw = t.yaw; if ('mira' in t) mira = t.mira;
      for (let i = 0; i < t.n; i++) {
        const dt = E.dt || 1 / 60; TIEMPO.dt = dt; TIEMPO.t += dt;
        if (i === 0 && t.accion) humAccion(P, t.accion);
        const v = t.v || [0, 0, 0]; P.vel.set(v[0], v[1], v[2]); P.suelo = t.suelo !== false; P.agachado = !!t.ag; P.mira = mira; P.yaw = yaw;
        P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
        // (en el auto, como personasPaso y vehiculoCamara; JXM_ENTRA: el primer cuadro todavía parado)
        const sentado = !!o && !(ENTRA && cuadros.length === 0);
        if (sentado) { P.pos.copy(jp); P.vel.set(0, 0, 0); P.suelo = true; P.sentado = true; P.manejando = a === 0 && o.veh.tipo !== 'asiento'; P.qVeh = o.b.q; P.vehO = o; P.vehA = a; P.arma = null; }
        animarPersona(P, dt); ubicarPersona(P);
        if (P.sentado && P.vehO) asientoPose(P); else { aterrizarPies(P); piesIK(P, dt); }
        md.sucio = true; md.actualizar();
        const r = {};
        D.sub.forEach((x, k) => { if (/^mixamorig/.test(x.n)) { const w = md.W[k]; r[x.n] = [w[12], w[13], w[14]]; } });
        // el arma en la mano (dibujarPersona): la de GMod (armaGmDibujar) o la del juego (arma3p)
        if (P.arma && !P.sentado && !P.emote) {
          if (armaGmDibujar(P)) r['@arma'] = Array.from(P.armasGm[P.arma].raiz);
          else { const A = arma3p(P, P.arma), hi = D.h.RightHand; if (A && hi !== undefined) { md.actualizar(); r['@arma'] = Array.from(m4mul(md.W[hi], A.W, new Float32Array(16))); } }
        }
        cuadros.push(r);
      }
    }
    if (o && o.veh.cab) cab = o.veh.cab[a];
    R.escenas.push({ n: E.n, cab, faldon: P.faldon, nalga: P.nalga, cuadros });
  });
  return R; })()`, ctx);
fs.writeFileSync(process.argv[4], JSON.stringify(out));
for (const e of out.escenas) console.log(e.n, 'cuadros', e.cuadros.length, e.cab ? 'cabina ' + JSON.stringify(e.cab) + ' faldón ' + e.faldon + ' nalga ' + e.nalga : '');
