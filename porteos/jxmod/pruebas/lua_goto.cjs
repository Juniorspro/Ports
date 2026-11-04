// goto de Lua 5.2 en el traductor (juego/gmod_lua.js): hacia adelante, hacia atrás, «continue», salir de dos bucles,
// desde adentro de un if, con locales de antes, en repeat, en corrutinas (las funciones dobles) y los errores de Lua.
// uso: node lua_goto.cjs
const fs = require('fs'), vm = require('vm'), path = require('path');
const J = path.join(__dirname, '../juego/');
const ctx = { console, Math, JSON, Date, URLSearchParams, URL, Map, Set, WeakMap, Promise, Uint8Array, Float32Array, Float64Array, Int32Array, Uint32Array, Uint16Array, Int16Array, DataView, ArrayBuffer, TextDecoder, TextEncoder, performance: require('perf_hooks').performance, setTimeout: () => 0, clearTimeout() {}, location: { search: '' }, matchMedia: () => ({ matches: false }), document: { getElementById: () => null, createElement: () => ({ style: {}, getContext: () => null }), body: {} }, localStorage: { getItem: () => null, setItem() {} }, navigator: { userAgent: '' } };
ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['nucleo.js', 'gmod_lua.js']) vm.runInContext(fs.readFileSync(J + f, 'utf8'), ctx, { filename: f });
const correr = (src) => vm.runInContext(`(() => { const R = luaCrearRuntime(); const out = []; R.salida = (t) => out.push(t); try { luaCompilar(${JSON.stringify(src)}, 'prueba.lua', R)(); } catch (e) { out.push('ERR ' + (e.message || e)); } return out.join(' '); })()`, ctx);
const CASOS = [
  ['adelante simple', `local x = 1
if x == 1 then goto skip end
print("no")
::skip::
print("si", x)`, 'si\t1'],
  ['continue con goto en for', `for i = 1, 5 do
  if i % 2 == 0 then goto continue end
  print(i)
  ::continue::
end`, '1 3 5'],
  ['goto skip en medio del cuerpo (el de First-Person Body)', `local t = {}
for i = 1, 4 do
  local a = i * 10
  if i == 2 then goto skip end
  t[#t + 1] = a
  ::skip::
end
print(#t, t[1], t[2], t[3])`, '3\t10\t30\t40'],
  ['salir de dos bucles', `for i = 1, 3 do
  for j = 1, 3 do
    if i * j == 4 then goto fuera end
    print(i .. j)
  end
end
::fuera::
print("fin")`, '11 12 13 21 fin'],
  ['hacia atrás (reintentar)', `local n = 0
::otra::
n = n + 1
if n < 4 then goto otra end
print(n)`, '4'],
  ['hacia atrás dentro de un bucle con break', `for i = 1, 3 do
  local k = 0
  ::de_nuevo::
  k = k + 1
  if k < i then goto de_nuevo end
  if i == 3 then break end
  print(i, k)
end
print("ok")`, '1\t1 2\t2 ok'],
  ['while con goto continue y break', `local i = 0
while true do
  i = i + 1
  if i > 6 then break end
  if i % 3 ~= 0 then goto continue end
  print(i)
  ::continue::
end`, '3 6'],
  ['repeat con goto continue', `local i = 0
repeat
  i = i + 1
  if i == 2 then goto continue end
  print(i)
  ::continue::
until i >= 3`, '1 3'],
  ['dos etiquetas cruzadas', `local x = 2
if x == 1 then goto a end
if x == 2 then goto b end
print("ninguna")
::a::
print("a")
::b::
print("b")`, 'b'],
  ['continue de GMod sigue andando', `for i = 1, 4 do if i == 2 then continue end print(i) end`, '1 3 4'],
  ['goto en una función adentro de un bucle', `for i = 1, 2 do
  local f = function(v) if v then goto listo end print("f", v) ::listo:: return v end
  f(i == 1)
end
print("ok")`, 'f\tfalse ok'],
  ['corrutina con goto', `local co = coroutine.create(function()
  for i = 1, 3 do
    if i == 2 then goto sigue end
    coroutine.yield(i)
    ::sigue::
  end
end)
local _, a = coroutine.resume(co) local _, b = coroutine.resume(co)
print(a, b)`, '1\t3'],
  ['etiqueta que no existe', `goto nada`, /^ERR .*no visible label 'nada'/],
];
let ok = 0;
for (const [nom, src, esp] of CASOS) { const r = correr(src); const bien = esp instanceof RegExp ? esp.test(r) : r === esp; if (bien) ok++; console.log((bien ? 'OK   ' : 'FALLA') + ' ' + nom + (bien ? '' : ' · dio «' + r + '» y se esperaba «' + esp + '»')); }
console.log('RESUMEN ' + ok + '/' + CASOS.length);
process.exit(ok === CASOS.length ? 0 : 1);
