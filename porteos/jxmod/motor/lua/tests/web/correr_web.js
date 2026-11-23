// Corre archivos .lua con el Lua de la versión web (juego/gmod_lua.js) en node y escribe lo que imprimen, para comparar
// con jxlua. Uso: node correr_web.js <carpeta juego/> [--esperado] [--tiempo] archivo.lua...
//  - sin --esperado: imprime la salida de cada archivo;
//  - con --esperado: la guarda al lado, en archivo.esperado (es lo que compara tests/corpus.rs).
// Los fuentes se leen como latin1 (un caracter por byte) y la salida se escribe igual: así los textos son de bytes, como
// en jxlua y en GMod. Un error que no agarra nadie sale como «ERROR: mensaje», como en tests/corpus.rs.
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
const juego = args.shift();
let esperado = false, tiempo = false;
while (args[0] && args[0].startsWith('--')) { const a = args.shift(); if (a === '--esperado') esperado = true; if (a === '--tiempo') tiempo = true; }
const L = require(path.resolve(juego, 'gmod_lua.js'));
// (la biblioteca utf8 la pone la capa de GMod: gmaUtf8 de gmod_api.js, que se saca de ahí tal cual)
const api = fs.readFileSync(path.resolve(juego, 'gmod_api.js'), 'utf8');
const iU = api.indexOf('function gmaUtf8('), fU = api.indexOf('\n}\n', iU);
const gmaUtf8 = new Function(api.slice(iU, fU + 2) + '; return gmaUtf8;')();
for (const archivo of args) {
  const R = L.luaCrearRuntime();
  const out = [];
  R.salida = (s) => out.push(s);
  { const U = new L.LuaTable(); R.G.set('utf8', U); gmaUtf8(U, (t, n, f) => t.set(n, f), R); }
  const src = fs.readFileSync(archivo, 'latin1');
  const nombre = path.basename(archivo);
  const t0 = process.hrtime.bigint();
  try { const f = L.luaCompilar(src, nombre, R); R.n = 0; R.c(f, nombre); } catch (e) { out.push('ERROR: ' + R.msgErr(e)); }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const txt = Buffer.from(out.join('\n') + '\n', 'latin1');
  if (esperado) fs.writeFileSync(archivo.replace(/\.lua$/, '.esperado'), txt); else process.stdout.write(txt);
  if (tiempo) process.stderr.write(archivo + ': ' + ms.toFixed(1) + ' ms\n');
}
