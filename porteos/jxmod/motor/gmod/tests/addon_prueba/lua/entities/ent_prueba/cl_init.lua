include("shared.lua")
function ENT:Draw() self:DrawModel() end
function ENT:Think() if self:GetCuenta() == 5 then print("cliente ve", self:GetCuenta(), self:GetNombre(), self:GetPos()) end end
