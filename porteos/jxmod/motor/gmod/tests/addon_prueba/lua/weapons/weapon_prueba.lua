SWEP.PrintName = "Prueba"
SWEP.Spawnable = true
SWEP.Primary.ClipSize = 6
SWEP.Primary.DefaultClip = 6
SWEP.Primary.Automatic = false
SWEP.Primary.Ammo = "pistol"
SWEP.Secondary.Automatic = true
SWEP.Secondary.ClipSize = -1
SWEP.ViewModel = "models/weapons/c_pistol.mdl"
SWEP.WorldModel = "models/weapons/w_pistol.mdl"
function SWEP:Initialize() self:SetHoldType("pistol") print("arma init", SERVER, self:Clip1()) end
function SWEP:Deploy() print("deploy") return true end
function SWEP:Holster() print("holster") return true end
function SWEP:PrimaryAttack()
	if self:Clip1() <= 0 then self:EmitSound("Weapon_Pistol.Empty") return end
	self:EmitSound("Weapon_Pistol.Single")
	self:FireBullets({ Num = 2, Src = self.Owner:GetShootPos(), Dir = self.Owner:GetAimVector(), Spread = Vector(0.05, 0.05, 0), Damage = 10, Tracer = 1 })
	self:SetClip1(self:Clip1() - 1)
	self:SetNextPrimaryFire(CurTime() + 0.1)
	self.Owner:ViewPunch(Angle(-1, 0, 0))
end
function SWEP:SecondaryAttack()
	local ed = EffectData()
	ed:SetOrigin(self.Owner:GetEyeTrace().HitPos)
	ed:SetNormal(Vector(0, 0, 1))
	util.Effect("Sparks", ed)
	self:SetNextSecondaryFire(CurTime() + 0.25)
end
function SWEP:Reload() local r = self:DefaultReload(ACT_VM_RELOAD) print("recarga", r, self:Clip1()) end
function SWEP:Think() if self.Owner:KeyDown(IN_ATTACK2) and math.floor(CurTime() * 60) % 7 == 0 then print("think 2") end end
function SWEP:DrawHUD() draw.SimpleText("Balas: " .. self:Clip1(), "DermaDefault", 100, 100) end
