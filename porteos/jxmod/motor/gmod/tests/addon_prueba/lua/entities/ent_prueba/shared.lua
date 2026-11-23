ENT.Type = "anim"
ENT.Base = "base_anim"
ENT.PrintName = "Caja de prueba"
ENT.Spawnable = true
function ENT:SetupDataTables()
	self:NetworkVar("Int", 0, "Cuenta")
	self:NetworkVar("String", 1, "Nombre")
end
