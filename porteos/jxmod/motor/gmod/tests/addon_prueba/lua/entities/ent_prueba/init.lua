AddCSLuaFile("cl_init.lua")
AddCSLuaFile("shared.lua")
include("shared.lua")
function ENT:SpawnFunction(ply, tr, cls)
	if not tr.Hit then return end
	local e = ents.Create(cls)
	e:SetPos(tr.HitPos + tr.HitNormal * 16)
	e:Spawn()
	e:Activate()
	return e
end
function ENT:Initialize()
	self:SetModel("models/props_junk/wood_crate001a.mdl")
	self:PhysicsInit(SOLID_VPHYSICS)
	self:SetMoveType(MOVETYPE_VPHYSICS)
	self:SetSolid(SOLID_VPHYSICS)
	local ph = self:GetPhysicsObject()
	if IsValid(ph) then ph:Wake() ph:SetMass(50) end
	self:SetCuenta(0)
	self:SetNombre("caja")
end
function ENT:Think()
	self:SetCuenta(self:GetCuenta() + 1)
	if self:GetCuenta() == 3 then
		self:EmitSound("physics/wood/wood_box_impact_hard1.wav")
		local ph = self:GetPhysicsObject()
		if IsValid(ph) then ph:ApplyForceCenter(Vector(0, 0, 500)) end
		self:TakeDamage(5, Entity(1), Entity(1))
	end
	if self:GetCuenta() == 8 then self:Remove() end
	self:NextThink(CurTime() + 0.1)
	return true
end
function ENT:OnTakeDamage(d) print("daño", d:GetDamage(), d:GetAttacker()) end
function ENT:OnRemove() print("remove", self:GetClass()) end
