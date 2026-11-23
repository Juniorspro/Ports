// estilo GMod
local ENT = {}
ENT.Type = "anim"
ENT.Base = "base_gmodentity"
ENT.PrintName = "Mi entidad"
ENT.Spawnable = true
function ENT:Initialize()
  self.vida = 100
  self.nombre = "ent"
end
function ENT:Danio(n)
  if n <= 0 || !self.vida then return false end
  self.vida = self.vida - n
  return self.vida > 0 && "vivo" || "muerto"
end
local e = setmetatable({}, {__index = ENT})
e:Initialize()
print(e:Danio(30), e:Danio(80), e.vida, e:Danio(0))
/* bloque
   de varias líneas */
local hooks = {}
local hook = {
  Add = function(ev, id, f) hooks[ev] = hooks[ev] or {}; hooks[ev][id] = f end,
  Run = function(ev, ...) local r; for id, f in pairs(hooks[ev] or {}) do r = f(...) if r != nil then return r end end end,
}
hook.Add("Think", "a", function(x) if x != 1 then return x * 2 end end)
print(hook.Run("Think", 1), hook.Run("Think", 5), hook.Run("Nada"))
local lista = {"a", "b", "c", "d"}
for i, v in ipairs(lista) do
  if v == "b" then continue end
  if !(v != "d") then break end
  print(i, v)
end
local cuenta = 0
while cuenta < 10 do
  cuenta = cuenta + 1
  if cuenta % 3 != 0 then continue end
  print("múltiplo", cuenta)
end
local x = 5 // comentario
local y = x/2 // 2 no es división entera: es comentario
print(x, y)
print(!true, !!1, !nil && 1)
local t = {1, 2, 3}
print(#t != 3 && "no" || "sí")
local SWEP = {Primary = {}, Secondary = {}}
SWEP.Primary.ClipSize = 30
SWEP.Primary.Automatic = true
function SWEP:PrimaryAttack() return self.Primary.ClipSize end
print(SWEP:PrimaryAttack(), SWEP.Primary.Automatic)
local Color = function(r, g, b, a) return {r = r, g = g, b = b, a = a or 255} end
local c = Color(255, 128, 0)
print(c.r, c.g, c.b, c.a)
local function Format(...) return string.format(...) end
print(Format("%s tiene %d", "jugador", 3))
