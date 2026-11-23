-- Un GMod de mentira para correr addons sin el juego (lo usan addons_web.js y `jxlua --correr-stub`): todo lo que no
-- existe es un mismo objeto que acepta cualquier cosa (se puede indexar, llamar, sumar, concatenar...). Así los dos
-- Lua corren el mismo código de verdad de los addons y se compara lo que pasa.
local stub
local function igual() return stub end
local mt = {
  __index = function(t, k) return stub end,
  __newindex = function(t, k, v) end,
  __call = function(...) return stub end,
  __add = igual, __sub = igual, __mul = igual, __div = igual, __mod = igual, __pow = igual, __unm = igual,
  __concat = function(a, b) return "stub" end,
  __lt = function() return false end, __le = function() return false end,
  __tostring = function() return "stub" end,
}
stub = setmetatable({}, mt)
SERVER = true
CLIENT = false
ENT = {}
SWEP = {Primary = {}, Secondary = {}}
EFFECT = {}
TOOL = {}
GM = {}
GAMEMODE = GM
setmetatable(_G, {__index = function(t, k) return stub end})
