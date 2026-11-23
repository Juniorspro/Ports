// la referencia de la web: el cuerpo de un skin con personas.js, humano.js, modelo.js y emotes.js (el nado) corridos en
// Node, cuadro a cuadro con una secuencia fija; escribe los huesos en el espacio del personaje (lo mismo que escribe
// examples/comparar.rs) para compararlos con comparar.py.
// Uso: node ref.js "$(cat secuencia.json)" salida.json [SKIN]   (JXM_WWW: el paquete; JXM_CMU: las capturas de nado)
const fs = require('fs'), vm = require('vm'), zlib = require('zlib'), path = require('path');
const J = path.join(__dirname, '../../../juego/');
const W = (process.env.JXM_WWW || '/tmp/claude-0/jxp_apk/activos/www') + '/';
const CMU = process.env.JXM_CMU || '/home/user/Ports/web/emotes/cmu';
const idx = JSON.parse(fs.readFileSync(W + 'pk.idx.json')), pk = fs.readFileSync(W + 'pk.bin');
const parte = (k) => pk.subarray(idx[k][0], idx[k][0] + idx[k][1]);
const DATA = JSON.parse(zlib.gunzipSync(parte('d')));
const BIN = new Uint8Array(zlib.gunzipSync(parte('m')));
DATA.pfPorNombre = {}; for (const k of Object.keys(DATA.pf)) { const n = k.split('#')[0]; if (!(n in DATA.pfPorNombre)) DATA.pfPorNombre[n] = k; }
const nada = () => {};
const ctx = { console, Math, JSON, Float32Array, Uint8Array, Int16Array, Uint32Array, Map, Set, Object, Array, Number, String, DataView, TextEncoder, Date, isFinite,
  window: {}, document: { getElementById: () => null, createElement: () => ({ getContext: () => null, style: {} }), addEventListener: nada }, location: { search: '', href: 'file:///x', protocol: 'file:' },
  matchMedia: () => ({ matches: false }), navigator: {}, performance: { now: () => 0 }, localStorage: { getItem: () => null, setItem: nada }, addEventListener: nada, setTimeout: nada, URLSearchParams };
ctx.RBP = { alListo: [] }; vm.createContext(ctx);
const cargar = (f) => { try { vm.runInContext(fs.readFileSync(J + f, 'utf8'), ctx, { filename: f }); } catch (e) { console.error('ERR', f, e.message); } };
for (const f of ['nucleo.js', 'gl.js', 'modelo.js', 'vista.js', 'personas.js', 'humano.js', 'emotes.js']) cargar(f);
ctx.DATA = DATA; ctx.BIN = BIN;
vm.runInContext(`
var binDe = (d) => (d && d.k ? null : BIN);
var GFX = { lod: 0 }; var TIEMPO = { t: 0, dt: 1 / 60 }; var JUG = { cuerpo: null, medio: 0.5, radio: 0.45 };
var rbListo = () => true, rbDeSkin = () => ''; var AGUA_Y = null; var aguaNadaPersona = () => (AGUA_Y === null ? null : { y1: AGUA_Y }); var emoPose = () => {}, cicPose = () => {};
var PERS_N = 0;
`, ctx);
const sec = JSON.parse(process.argv[2] || '[]');
ctx.CMU_RAW = { '126_04': new Uint8Array(fs.readFileSync(CMU + '/126_04.bin')), '79_02': new Uint8Array(fs.readFileSync(CMU + '/79_02.bin')) };
vm.runInContext(`(() => {
  const H = HUESOS;
  const bin = (k, u0) => { const u = zl(u0); const nf = u[4] | u[5] << 8, fps = u[6], nb = u[8], b = []; for (let i = 0; i < nb; i++) b.push(H[u[9 + i]]);
    const n = nf * nb * 4, m = nf * 3, o = 9 + nb, F = nb * 4, r = new Int16Array(n), h = new Int16Array(m), acc = new Int16Array(F);
    for (let i = 0; i < n; i++) { const d = (u[o + i] | u[o + n + i] << 8) << 16 >> 16, j = i % F; acc[j] += d; r[i] = acc[j] * 4; }
    const o2 = o + 2 * n; let a0 = 0, a1 = 0, a2 = 0;
    for (let i = 0; i < m; i++) { const d = (u[o2 + i] | u[o2 + m + i] << 8) << 16 >> 16, c = i % 3; h[i] = c === 0 ? (a0 = (a0 + d) << 16 >> 16) : c === 1 ? (a1 = (a1 + d) << 16 >> 16) : (a2 = (a2 + d) << 16 >> 16); }
    return emoLimpiar({ id: 'c:' + k, n: k, fps, nf, b, r, h, loop: !!u[7], d: (nf - 1) / fps }); };
  for (const k of ['126_04', '79_02']) EMO.clips['c:' + k] = bin(k, CMU_RAW[k]);
})()`, Object.assign(ctx, { zl: (u) => { try { return new Uint8Array(zlib.gunzipSync(u)); } catch (e) { return u; } } }));
const out = vm.runInContext(`(() => {
  const P = crearPersona(${JSON.stringify(process.argv[4] || 'Hero')}, 'HatEmpty', { nombre: '' }); JUG.cuerpo = P;
  const D = P.D, md = P.md, ix = {}; D.sub.forEach((n, i) => { const m = /^mixamorig\\d*:(.*)$/.exec(n.n); if (m && ix[m[1]] === undefined) ix[m[1]] = i; });
  const nom = HUESOS.concat(['LeftToeBase', 'RightToeBase', 'HeadTop_End', 'LeftHandMiddle4']);
  P.pos.set(0, 1, 0); P.yaw = 0; P.suelo = true;
  const S = ${JSON.stringify(sec)}, R = { tobillo: D.tobillo, pies: D.pies, cuadros: [] };
  for (const s of S) {
    for (let i = 0; i < s.n; i++) {
      const dt = 1 / 60; TIEMPO.dt = dt; TIEMPO.t += dt;
      P.vel.set(s.v[0], s.v[1], s.v[2]); P.suelo = s.suelo; AGUA_Y = s.agua === undefined ? null : s.agua; P.agachado = !!s.ag; P.mira = s.mira || 0; P.yaw = s.yaw || 0;
      P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
      animarPersona(P, dt); ubicarPersona(P); if (P.nadoK > 0.01 && P.nadoVol) nadoAltura(P); else { aterrizarPies(P); piesIK(P, dt); } md.sucio = true; md.actualizar();
      const c = Math.cos(P.yaw), sn = Math.sin(P.yaw), r = {};
      for (const n of nom) { const w = md.W[ix[n]]; if (!w) continue; const dx = w[12] - P.pos.x, dy = w[13] - (P.pos.y - 1), dz = w[14] - P.pos.z; r[n] = [dx * c - dz * sn, dy, dx * sn + dz * c]; }
      R.cuadros.push(r);
    }
  }
  return R; })()`, ctx);
fs.writeFileSync(process.argv[3] || 'ref.json', JSON.stringify(out));
console.log('cuadros', out.cuadros.length, 'tobillo', out.tobillo, JSON.stringify(out.pies));
