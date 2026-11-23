local V = {}
V.__index = V
function V.new(x, y) return setmetatable({x = x, y = y}, V) end
V.__add = function(a, b) return V.new(a.x + b.x, a.y + b.y) end
V.__sub = function(a, b) return V.new(a.x - b.x, a.y - b.y) end
V.__mul = function(a, b) if type(a) == "number" then return V.new(a * b.x, a * b.y) end if type(b) == "number" then return V.new(a.x * b, a.y * b) end return a.x * b.x + a.y * b.y end
V.__div = function(a, b) return V.new(a.x / b, a.y / b) end
V.__mod = function(a, b) return "mod" end
V.__pow = function(a, b) return "pow" end
V.__unm = function(a) return V.new(-a.x, -a.y) end
V.__eq = function(a, b) return a.x == b.x and a.y == b.y end
V.__lt = function(a, b) return a.x < b.x end
V.__le = function(a, b) return a.x <= b.x end
V.__concat = function(a, b) return tostring(a) .. "&" .. tostring(b) end
V.__tostring = function(v) return "(" .. v.x .. "," .. v.y .. ")" end
V.__call = function(self, k) return self.x * k end
V.__len = function() return 99 end
function V:largo() return math.sqrt(self.x ^ 2 + self.y ^ 2) end
local a, b = V.new(1, 2), V.new(3, 4)
print(tostring(a + b), tostring(a - b), tostring(a * 2), tostring(2 * a), a * b, tostring(b / 2), a % b, a ^ b, tostring(-a))
print(a == b, a == V.new(1, 2), a ~= V.new(1, 2), a < b, a <= b, a > b, a >= b, b:largo())
print(a .. b, a .. "s", "s" .. a, a(10), #a)
print(rawequal(a, V.new(1, 2)), getmetatable(a) == V)
local defaults = setmetatable({}, {__index = {color = "red", size = 1}})
defaults.size = 5
print(defaults.color, defaults.size, rawget(defaults, "color"))
local log = {}
local proxy = setmetatable({}, {__index = function(t, k) return k .. "?" end, __newindex = function(t, k, v) rawset(t, k, v * 2); log[#log + 1] = k end})
proxy.a = 1; proxy.a = 5
print(proxy.a, proxy.b, #log)
local ro = setmetatable({}, {__newindex = function() error("solo lectura", 2) end})
print(pcall(function() ro.x = 1 end))
local chain = setmetatable({}, {__index = setmetatable({lvl2 = "dos"}, {__index = {lvl3 = "tres"}})})
print(chain.lvl2, chain.lvl3, chain.nada)
local prot = setmetatable({}, {__metatable = "protegida"})
print(getmetatable(prot), getmetatable("x").__index == string, getmetatable(1))
local cnt = setmetatable({}, {__index = function(t, k) local v = k * 2; rawset(t, k, v); return v end})
print(cnt[5], rawget(cnt, 5), cnt[6])
local Base = {} Base.__index = Base
function Base.new() return setmetatable({}, Base) end
function Base:hola() return "base " .. self:nombre() end
function Base:nombre() return "B" end
local Hija = setmetatable({}, {__index = Base}) Hija.__index = Hija
function Hija.new() return setmetatable({}, Hija) end
function Hija:nombre() return "H" end
print(Base.new():hola(), Hija.new():hola())
local mtl = setmetatable({}, {__lt = function(a, b) return true end})
print(mtl < mtl, mtl <= mtl, mtl > mtl)
local e1 = setmetatable({}, {__eq = function() return true end})
local e2 = setmetatable({}, {__eq = function() return true end})
print(e1 == e2, e1 == e1, e1 == {})
print(pcall(function() return {} < {} end), pcall(function() return {} + 1 end), pcall(function() return 1 < "2" end))
print(pcall(function() return #nil end), pcall(function() return -{} end), pcall(function() return {} .. "" end))
local called = setmetatable({}, {__call = function(self, a, b) return a + b, self end})
print(called(2, 3) )
local idx = setmetatable({}, {__index = "abc"})
print(pcall(function() return idx.len end))
local nr = setmetatable({}, {__newindex = {}})
nr.x = 1; print(rawget(nr, "x"), getmetatable(nr).__newindex.x)
local cc = setmetatable({}, {__concat = function(a, b) return "C" end})
print(cc .. cc, 1 .. cc, cc .. 1)
local ts = setmetatable({}, {__tostring = function() return 42 end})
print(tostring(ts), ts)
