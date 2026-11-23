x = 10
print(x, _G.x, _G["x"])
_G.y = 20
print(y)
rawset(_G, "z", 30)
print(z, rawget(_G, "z"))
print(_VERSION, type(_G), _G._G == _G, getfenv() == _G, setfenv(print) == print)
local t1, t2 = {}, {}
print(tostring(t1), tostring(t2), tostring(t1))
print(t1, print, tostring(print) == tostring(print))
local f = function() end
print(f, tostring(f):sub(1, 9))
print(type(collectgarbage("count")), collectgarbage())
local co = coroutine.create(function() end)
print(co, type(co))
print(tostring(setmetatable({}, {})))
local cnt = 0
for k, v in pairs(_G) do if type(v) == "table" and k ~= "_G" then cnt = cnt + 1 end end
print(cnt > 5)
print(string ~= nil, table ~= nil, math ~= nil, os ~= nil, bit ~= nil, coroutine ~= nil, debug ~= nil, utf8 ~= nil, package ~= nil)
print(io, require, dofile, module, loadfile)
print(debug.traceback("tb"), debug.traceback(), debug.getinfo(1).currentline, debug.getinfo(1).short_src)
print(debug.getmetatable("x") == getmetatable("x"), debug.getlocal(), debug.sethook())
local mt = {}
local dt = debug.setmetatable({}, mt)
print(getmetatable(dt) == mt)
function globalfn() return "gf" end
print(globalfn(), _G.globalfn())
local G2 = _G
G2.nueva = "n"
print(nueva)
setmetatable(_G, {__index = function(t, k) return "falta:" .. k end})
print(nodefinida, x)
setmetatable(_G, nil)
print(nodefinida)
