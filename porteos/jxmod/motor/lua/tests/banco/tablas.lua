-- tablas: arreglos, campos, objetos con métodos (como las entidades de un addon)
local t0 = os.clock()
local Ent = {}
Ent.__index = Ent
function Ent.new(i) return setmetatable({id = i, pos = {x = i, y = i * 2, z = 0}, vida = 100}, Ent) end
function Ent:Think(dt) self.pos.x = self.pos.x + dt; self.vida = self.vida - 1; return self.vida > 0 end
local ents = {}
for i = 1, 2000 do ents[i] = Ent.new(i) end
local vivos = 0
for paso = 1, 100 do
  for i = 1, #ents do if ents[i]:Think(0.1) then vivos = vivos + 1 end end
end
local m = {}
for i = 1, 200000 do m[i] = i * 2 end
local s = 0
for i = 1, #m do s = s + m[i] end
local h = {}
for i = 1, 100000 do h["k" .. (i % 1000)] = i end
local c = 0
for k, v in pairs(h) do c = c + v end
local arr = {}
for i = 1, 50000 do table.insert(arr, i) end
for i = 1, 25000 do table.remove(arr) end
print("tablas", vivos, s, c, #arr, string.format("%.1f ms", (os.clock() - t0) * 1000))
