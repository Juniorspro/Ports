local Animal = {}
Animal.__index = Animal
function Animal.new(nombre, sonido)
  local self = setmetatable({}, Animal)
  self.nombre = nombre
  self.sonido = sonido
  return self
end
function Animal:hablar() return self.nombre .. " dice " .. self.sonido end
local Perro = setmetatable({}, {__index = Animal})
Perro.__index = Perro
function Perro.new(nombre)
  local self = Animal.new(nombre, "guau")
  return setmetatable(self, Perro)
end
function Perro:buscar() return self.nombre .. " busca la pelota" end
local p = Perro.new("Rex")
print(p:hablar(), p:buscar(), getmetatable(p) == Perro)
local Pila = {}
Pila.__index = Pila
function Pila.new() return setmetatable({items = {}, n = 0}, Pila) end
function Pila:push(v) self.n = self.n + 1; self.items[self.n] = v end
function Pila:pop() local v = self.items[self.n]; self.items[self.n] = nil; self.n = self.n - 1; return v end
local s = Pila.new()
for i = 1, 5 do s:push(i * i) end
print(s:pop(), s:pop(), s.n, #s.items)
local Set = {}
Set.__index = Set
Set.__add = function(a, b) local r = Set.new(); for k in pairs(a.e) do r.e[k] = true end for k in pairs(b.e) do r.e[k] = true end return r end
Set.__tostring = function(s) local l = {}; for k in pairs(s.e) do l[#l + 1] = tostring(k) end table.sort(l); return "{" .. table.concat(l, ",") .. "}" end
function Set.new(t) local s = setmetatable({e = {}}, Set); for _, v in ipairs(t or {}) do s.e[v] = true end return s end
print(tostring(Set.new({1, 2}) + Set.new({2, 3})))
local memo = setmetatable({}, {__mode = "k"})
local function fibm(n) if n < 2 then return n end if memo[n] then return memo[n] end local v = fibm(n - 1) + fibm(n - 2); memo[n] = v; return v end
print(fibm(80))
local Cola = {primero = 1, ultimo = 0, items = {}}
function Cola.meter(v) Cola.ultimo = Cola.ultimo + 1; Cola.items[Cola.ultimo] = v end
function Cola.sacar() local v = Cola.items[Cola.primero]; Cola.items[Cola.primero] = nil; Cola.primero = Cola.primero + 1; return v end
Cola.meter("a"); Cola.meter("b"); Cola.meter("c")
print(Cola.sacar(), Cola.sacar(), #Cola.items)
for k, v in pairs(Cola.items) do print("cola", k, v) end
local Contador = setmetatable({}, {__call = function(cls, ini) return setmetatable({v = ini or 0}, cls) end})
Contador.__index = Contador
function Contador:mas() self.v = self.v + 1; return self end
print(Contador(5):mas():mas().v)
