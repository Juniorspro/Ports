// coroutine.yield adentro de pcall y xpcall (juego/gmod_lua.js), como en LuaJIT —el Lua de GMod—. Panel (v57q8yag):
// ROUTINE Type 05 (Workshop 3826521085) corre cada paso de su comportamiento con xpcall y espera con coroutine.yield
// adentro; cortaba con «attempt to yield across a C-call boundary» y el robot volvía a empezar una y otra vez.
// uso: node lua_pcall_yield.cjs
const fs = require('fs'), vm = require('vm'), path = require('path');
const J = path.join(__dirname, '../juego/');
const ctx = { console, Math, JSON, Date, URLSearchParams, URL, Map, Set, WeakMap, Promise, Uint8Array, Float32Array, Float64Array, Int32Array, Uint32Array, Uint16Array, Int16Array, DataView, ArrayBuffer, TextDecoder, TextEncoder, performance: require('perf_hooks').performance, setTimeout: () => 0, clearTimeout() {}, location: { search: '' }, matchMedia: () => ({ matches: false }), document: { getElementById: () => null, createElement: () => ({ style: {}, getContext: () => null }), body: {} }, localStorage: { getItem: () => null, setItem() {} }, navigator: { userAgent: '' } };
ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['nucleo.js', 'gmod_lua.js']) vm.runInContext(fs.readFileSync(J + f, 'utf8'), ctx, { filename: f });
const correr = (src) => vm.runInContext(`(() => { const R = luaCrearRuntime(); const out = []; R.salida = (t) => out.push(t); try { luaCompilar(${JSON.stringify(src)}, 'prueba.lua', R)(); } catch (e) { out.push('ERR ' + (e.message || e)); } return out.join(' '); })()`, ctx);
const CASOS = [
  ['yield adentro de pcall', `local co = coroutine.create(function()
  local ok, v = pcall(function() local x = coroutine.yield(1) return x * 2 end)
  coroutine.yield(ok and v or -1)
end)
local _, a = coroutine.resume(co) local _, b = coroutine.resume(co, 21)
print(a, b)`, '1\t42'],
  ['yield adentro de xpcall con un método (como ROUTINE)', `local E = {} function E:Paso() local n = 0 for i = 1, 3 do n = n + i coroutine.yield(i) end return n end
local co = coroutine.create(function(self) local ok, r = xpcall(self.Paso, debug and debug.traceback or print, self) coroutine.yield(ok, r) end)
local out = {} for i = 1, 4 do local _, a, b = coroutine.resume(co, E) out[#out + 1] = tostring(a) .. (b ~= nil and ('/' .. tostring(b)) or '') end
print(table.concat(out, ' '))`, '1 2 3 true/6'],
  ['un error adentro de pcall en una corrutina sigue dando false y el mensaje', `local co = coroutine.create(function()
  local ok, e = pcall(function() coroutine.yield(1) error("mal") end)
  coroutine.yield(ok, (tostring(e):gsub("^.-: ", "")))
end)
coroutine.resume(co) local _, a, b = coroutine.resume(co)
print(a, b)`, 'false\tmal'],
  ['pcall afuera de una corrutina, como siempre', `print(pcall(function() return 5 end))
print((select(2, pcall(function() coroutine.yield() end)):gsub("^.-: ", "")))`, 'true\t5 attempt to yield from outside a coroutine'],
];
let ok = 0;
for (const [nom, src, esp] of CASOS) { const r = correr(src); const bien = esp instanceof RegExp ? esp.test(r) : r === esp; if (bien) ok++; console.log((bien ? 'OK   ' : 'FALLA') + ' ' + nom + (bien ? '' : ' · dio «' + r + '» y se esperaba «' + esp + '»')); }
console.log('RESUMEN ' + ok + '/' + CASOS.length);
process.exit(ok === CASOS.length ? 0 : 1);
