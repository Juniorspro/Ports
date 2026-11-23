// Los addons de verdad en el Lua de la web: compila todos los .lua (sueltos y de adentro de los .gma) y, con --correr,
// corre cada uno con un GMod de mentira escrito en Lua (tests/web/stub_gmod.lua: todo lo que no existe es un objeto
// que acepta cualquier cosa), una línea por archivo, para comparar con `jxlua --correr-stub`.
// Uso: node addons_web.js <carpeta juego/> [--correr stub.lua] archivos...
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
const juego = args.shift();
let stub = null;
if (args[0] === '--correr') { args.shift(); stub = fs.readFileSync(args.shift(), 'latin1'); }
const L = require(path.resolve(juego, 'gmod_lua.js'));
function leerGma(b) {
  if (b.length < 5 || b.toString('latin1', 0, 4) !== 'GMAD') return null;
  let p = 5;
  const cstr = () => { const i = p; while (p < b.length && b[p] !== 0) p++; const s = b.toString('utf8', i, p); p++; return s; };
  p += 16;
  if (b[4] > 1) while (cstr() !== '');
  cstr(); cstr(); cstr(); p += 4;
  const ent = [];
  for (;;) { const n = b.readUInt32LE(p); p += 4; if (n === 0) break; const nombre = cstr(); const tam = Number(b.readBigInt64LE(p)); p += 12; ent.push([nombre, tam]); }
  const out = [];
  for (const [nombre, tam] of ent) { if (p + tam > b.length) break; if (nombre.toLowerCase().endsWith('.lua')) out.push([nombre, b.subarray(p, p + tam)]); p += tam; }
  return out;
}
const todos = [];
const juntar = (r) => {
  let st; try { st = fs.statSync(r); } catch (e) { return; }
  if (st.isDirectory()) { for (const h of fs.readdirSync(r).sort()) juntar(path.join(r, h)); return; }
  if (/\.lua$/i.test(r)) todos.push([r, fs.readFileSync(r)]);
  else if (/\.gma$/i.test(r)) { const v = leerGma(fs.readFileSync(r)); if (v) for (const [k, c] of v) todos.push([r + '!' + k, c]); }
};
for (const a of args) { if (a.startsWith('@')) { for (const l of fs.readFileSync(a.slice(1), 'utf8').split('\n')) if (l) juntar(l); } else juntar(a); }
let ok = 0, bytes = 0;
const t0 = Date.now();
const salida = [];
for (const [n, b] of todos) {
  bytes += b.length;
  let src = b.toString('latin1'); if (src.startsWith('\xEF\xBB\xBF')) src = src.slice(3);
  const R = L.luaCrearRuntime();
  let f;
  try { f = L.luaCompilar(src, n, R); ok++; } catch (e) { salida.push('MAL ' + R.msgErr(e)); continue; }
  if (!stub) continue;
  const out = [];
  R.salida = (s) => out.push(s);
  R.lim = 1e6;
  try { L.luaCompilar(stub, 'stub_gmod.lua', R)(); R.n = 0; R.c(f, n); out.push('ok'); } catch (e) { out.push('ERROR: ' + R.msgErr(e)); }
  salida.push(n + ' => ' + out.join(' | '));
}
process.stdout.write(Buffer.from(salida.join('\n') + '\n', 'latin1'));
process.stderr.write('compilados ' + ok + '/' + todos.length + ' archivos (' + (bytes / 1e6).toFixed(1) + ' MB) en ' + (Date.now() - t0) + ' ms\n');
