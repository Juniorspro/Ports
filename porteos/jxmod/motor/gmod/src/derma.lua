-- Derma y VGUI: los paneles de GMod de verdad (antes «aceptaban todo» y no se veían). Hecho según la wiki: el árbol de
-- paneles con su lugar y tamaño, el Dock y PerformLayout, el Paint de cada uno con su recorte, los toques del celular
-- (apretar, arrastrar, soltar: DoClick, arrastrar para desplazar), el foco y el teclado, las animaciones y los controles
-- D* con un aspecto como el de GMod (dibujado acá: grises, barra de título, botones con degradé). Lo que un addon pide y
-- no está sigue sin cortar: los Get devuelven 0, los Is/Has falso y lo demás devuelve el panel.
vgui = vgui or {}
derma = derma or {}
local PM = {}
local registro = {}
local raices = {}           -- los paneles de primer nivel, en orden de dibujo
local foco, encima, apretado, arrastre
local cursor_x, cursor_y = 0, 0
local pantalla_clic = false
local SUPERIOR = { Panel = true }
local function rg(p, k) return rawget(p, k) end
local function rs(p, k, v) rawset(p, k, v) end
NODOCK, FILL, LEFT, RIGHT, TOP, BOTTOM = 0, 1, 2, 3, 4, 5
MOUSE_LEFT, MOUSE_RIGHT, MOUSE_MIDDLE, MOUSE_WHEEL_UP, MOUSE_WHEEL_DOWN = MOUSE_LEFT or 107, MOUSE_RIGHT or 108, MOUSE_MIDDLE or 109, MOUSE_WHEEL_UP or 112, MOUSE_WHEEL_DOWN or 113

-- ---------- las clases (vgui.Register): cada una hereda de su Base; BaseClass lee la base al usarse ----------
local function clase_de(n) return registro[n] end
local function nueva_clase(t, base)
  t.Base = base or t.Base or "Panel"
  local mt = getmetatable(t) or {}
  mt.__index = function(_, k) local b = registro[rawget(t, "Base")] if b and b ~= t then return b[k] end end
  setmetatable(t, mt)
  rawset(t, "BaseClass", setmetatable({}, { __index = function(_, k) local b = registro[rawget(t, "Base")] if b and b ~= t then return b[k] end end }))
  return t
end
function vgui.Register(n, t, base) t = t or {} nueva_clase(t, base) t.ThisClass = n registro[n] = t if baseclass and baseclass.Set then baseclass.Set(n, t) end return t end
function vgui.RegisterTable(t, base) return nueva_clase(t or {}, base) end
function vgui.RegisterFile() end
function vgui.GetControlTable(n) return registro[n] end
function vgui.Exists(n) return registro[n] ~= nil end
registro.Panel = setmetatable({ ThisClass = "Panel" }, { __index = PM }) if baseclass and baseclass.Set then baseclass.Set("Panel", registro.Panel) end

-- ---------- el objeto panel ----------
local panelMeta = { MetaName = "Panel", __tostring = function(p) return "Panel: [" .. tostring(rg(p, "__nombre")) .. "]" end }
panelMeta.__index = function(p, k)
  local c = rg(p, "__clase")
  if c then local v = c[k] if v ~= nil then return v end end
  local v = PM[k] if v ~= nil then return v end
  if type(k) == "string" then
    local a, b = string.sub(k, 1, 2), string.sub(k, 1, 3)
    if a == "Is" or b == "Has" then return function() return false end end
    if b == "Get" then return function() return 0 end end
    if string.sub(k, 1, 2) == "On" or b == "Set" or string.sub(k, 1, 2) == "Do" then return function(s) return s end end
  end
  return nil
end
RegisterMetaTable("Panel", PM)
PM.MetaName = "Panel"
local function hijos(p) local h = rg(p, "__hijos") if not h then h = {} rs(p, "__hijos", h) end return h end
local function quitar_de(l, x) for i = #l, 1, -1 do if l[i] == x then table.remove(l, i) end end end
local function crudo(nombre)
  local p = setmetatable({ __nombre = nombre, __x = 0, __y = 0, __w = 64, __h = 24, __vis = true, __mouse = true, __teclado = false, __dock = NODOCK,
    __margen = { 0, 0, 0, 0 }, __relleno = { 0, 0, 0, 0 }, __sucio = true, __alfa = 255, __z = 0, __hab = true }, panelMeta)
  return p
end
local mundo = crudo("WorldPanel")
rs(mundo, "__mouse", false)
function vgui.GetWorldPanel() return mundo end
function vgui.GetHoveredPanel() return encima end
function vgui.GetKeyboardFocus() return foco end
function vgui.FocusedHasParent(p) local f = foco while f do if f == p then return true end f = rg(f, "__padre") end return false end
function vgui.IsHoveringWorld() return encima == nil end
function vgui.CursorVisible() return pantalla_clic or __VGUI_Modal() end
function vgui.GetAll() local l = {} local function r(p) for _, c in ipairs(hijos(p)) do l[#l + 1] = c r(c) end end r(mundo) return l end
local function ancho_pantalla() return ScrW() end
local function alto_pantalla() return ScrH() end
function PM:IsValid() return rg(self, "__quitado") ~= true end
function PM:SetParent(padre)
  padre = padre or mundo
  local ant = rg(self, "__padre")
  if ant then quitar_de(hijos(ant), self) if ant.OnChildRemoved then pcall(ant.OnChildRemoved, ant, self) end end
  rs(self, "__padre", padre)
  local h = hijos(padre) h[#h + 1] = self
  table.sort(h, function(a, b) return (rg(a, "__z") or 0) < (rg(b, "__z") or 0) end)
  rs(padre, "__sucio", true)
  if padre.OnChildAdded then pcall(padre.OnChildAdded, padre, self) end
end
function PM:GetParent() local p = rg(self, "__padre") if p == mundo then return mundo end return p end
function PM:HasParent(p) local x = rg(self, "__padre") while x do if x == p then return true end x = rg(x, "__padre") end return false end
function PM:IsOurChild(c) return c ~= nil and c.HasParent and c:HasParent(self) end
function PM:GetChildren() local l = {} for i, c in ipairs(hijos(self)) do l[i] = c end return l end
function PM:ChildCount() return #hijos(self) end
function PM:GetChild(i) return hijos(self)[i + 1] end
function PM:Add(c) if type(c) == "string" then return vgui.Create(c, self) end if c then c:SetParent(self) end return c end
function PM:Clear() for _, c in ipairs(self:GetChildren()) do c:Remove() end end
function PM:Remove()
  if rg(self, "__quitado") then return end
  rs(self, "__quitado", true)
  for _, c in ipairs(self:GetChildren()) do c:Remove() end
  if self.OnRemove then pcall(self.OnRemove, self) end
  local p = rg(self, "__padre") if p then quitar_de(hijos(p), self) end
  quitar_de(raices, self)
  if foco == self then foco = nil end if encima == self then encima = nil end if apretado == self then apretado = nil end
end
function PM:Valid() return self:IsValid() end
-- (lugar y tamaño)
function PM:SetPos(x, y) rs(self, "__x", math.floor(tonumber(x) or 0)) rs(self, "__y", math.floor(tonumber(y) or 0)) end
function PM:GetPos() return rg(self, "__x"), rg(self, "__y") end
function PM:SetX(x) rs(self, "__x", math.floor(x)) end function PM:SetY(y) rs(self, "__y", math.floor(y)) end
function PM:GetX() return rg(self, "__x") end function PM:GetY() return rg(self, "__y") end
function PM:SetSize(w, h)
  w, h = math.max(0, math.floor(tonumber(w) or 0)), math.max(0, math.floor(tonumber(h) or 0))
  if w ~= rg(self, "__w") or h ~= rg(self, "__h") then rs(self, "__w", w) rs(self, "__h", h) rs(self, "__sucio", true) if self.OnSizeChanged then pcall(self.OnSizeChanged, self, w, h) end end
end
function PM:GetSize() return rg(self, "__w"), rg(self, "__h") end
function PM:SetWide(w) self:SetSize(w, rg(self, "__h")) end function PM:SetTall(h) self:SetSize(rg(self, "__w"), h) end
function PM:SetWidth(w) self:SetWide(w) end function PM:SetHeight(h) self:SetTall(h) end
function PM:GetWide() return rg(self, "__w") end function PM:GetTall() return rg(self, "__h") end
function PM:SetBounds(x, y, w, h) self:SetPos(x, y) self:SetSize(w, h) end
function PM:GetBounds() return rg(self, "__x"), rg(self, "__y"), rg(self, "__w"), rg(self, "__h") end
local function tam_padre(p) local pa = rg(p, "__padre") if pa and pa ~= mundo then return rg(pa, "__w"), rg(pa, "__h") end return ancho_pantalla(), alto_pantalla() end
function PM:Center() local w, h = tam_padre(self) self:SetPos((w - rg(self, "__w")) / 2, (h - rg(self, "__h")) / 2) end
function PM:CenterHorizontal(f) local w = tam_padre(self) self:SetX(w * (f or 0.5) - rg(self, "__w") / 2) end
function PM:CenterVertical(f) local _, h = tam_padre(self) self:SetY(h * (f or 0.5) - rg(self, "__h") / 2) end
function PM:AlignLeft(o) self:SetX(o or 0) end function PM:AlignTop(o) self:SetY(o or 0) end
function PM:AlignRight(o) local w = tam_padre(self) self:SetX(w - rg(self, "__w") - (o or 0)) end
function PM:AlignBottom(o) local _, h = tam_padre(self) self:SetY(h - rg(self, "__h") - (o or 0)) end
function PM:MoveBelow(o, d) self:SetY(rg(o, "__y") + rg(o, "__h") + (d or 0)) end
function PM:MoveAbove(o, d) self:SetY(rg(o, "__y") - rg(self, "__h") - (d or 0)) end
function PM:MoveRightOf(o, d) self:SetX(rg(o, "__x") + rg(o, "__w") + (d or 0)) end
function PM:MoveLeftOf(o, d) self:SetX(rg(o, "__x") - rg(self, "__w") - (d or 0)) end
function PM:StretchToParent(l, t, r, b) local w, h = tam_padre(self) self:SetPos(l or 0, t or 0) self:SetSize(w - (l or 0) - (r or 0), h - (t or 0) - (b or 0)) end
function PM:StretchRightTo(o, m) self:SetWide(rg(o, "__x") - rg(self, "__x") - (m or 0)) end
function PM:StretchBottomTo(o, m) self:SetTall(rg(o, "__y") - rg(self, "__y") - (m or 0)) end
function PM:CopyPos(o) self:SetPos(o:GetPos()) end function PM:CopySize(o) self:SetSize(o:GetSize()) end function PM:CopyBounds(o) self:SetBounds(o:GetBounds()) end
function PM:CopyWidth(o) self:SetWide(o:GetWide()) end function PM:CopyHeight(o) self:SetTall(o:GetTall()) end
function PM:SizeToChildren(ancho, alto)
  local mw, mh = 0, 0
  for _, c in ipairs(hijos(self)) do if rg(c, "__vis") then local m = rg(c, "__margen") mw = math.max(mw, rg(c, "__x") + rg(c, "__w") + m[3]) mh = math.max(mh, rg(c, "__y") + rg(c, "__h") + m[4]) end end
  local r = rg(self, "__relleno")
  if ancho ~= false then self:SetWide(mw + r[3]) end if alto ~= false then self:SetTall(mh + r[4]) end
end
function PM:SizeToContents() if self.GetContentSize then local w, h = self:GetContentSize() if w then self:SetSize(w, h) end end end
function PM:SizeToContentsX(e) local w = self:GetContentSize() self:SetWide(w + (e or 0)) end
function PM:SizeToContentsY(e) local _, h = self:GetContentSize() self:SetTall(h + (e or 0)) end
function PM:GetContentSize() return rg(self, "__w"), rg(self, "__h") end
function PM:ChildrenSize() local w, h = 0, 0 for _, c in ipairs(hijos(self)) do w = math.max(w, rg(c, "__x") + rg(c, "__w")) h = math.max(h, rg(c, "__y") + rg(c, "__h")) end return w, h end
function PM:LocalToScreen(x, y) local p = self while p and p ~= mundo do x = x + rg(p, "__x") y = y + rg(p, "__y") p = rg(p, "__padre") end return x, y end
function PM:ScreenToLocal(x, y) local ax, ay = self:LocalToScreen(0, 0) return x - ax, y - ay end
function PM:CursorPos() return self:ScreenToLocal(cursor_x, cursor_y) end
function PM:GetScreenPos() return self:LocalToScreen(0, 0) end
-- (Dock y layout)
function PM:Dock(d) rs(self, "__dock", d or NODOCK) local p = rg(self, "__padre") if p then rs(p, "__sucio", true) end end
function PM:GetDock() return rg(self, "__dock") end
function PM:DockMargin(l, t, r, b) rs(self, "__margen", { l or 0, t or 0, r or 0, b or 0 }) local p = rg(self, "__padre") if p then rs(p, "__sucio", true) end end
function PM:DockPadding(l, t, r, b) rs(self, "__relleno", { l or 0, t or 0, r or 0, b or 0 }) rs(self, "__sucio", true) end
function PM:GetDockMargin() local m = rg(self, "__margen") return m[1], m[2], m[3], m[4] end
function PM:GetDockPadding() local m = rg(self, "__relleno") return m[1], m[2], m[3], m[4] end
function PM:InvalidateLayout(ya) rs(self, "__sucio", true) if ya then __VGUI_Layout(self) end end
function PM:InvalidateParent(ya) local p = rg(self, "__padre") if p then p:InvalidateLayout(ya) end end
function PM:InvalidateChildren(rec) for _, c in ipairs(hijos(self)) do c:InvalidateLayout() if rec then c:InvalidateChildren(true) end end end
function PM:SetAutoDelete() end function PM:SetMinimumSize(w, h) rs(self, "__minw", w) rs(self, "__minh", h) end
function __VGUI_Layout(p)
  rs(p, "__sucio", false)
  local w, h = rg(p, "__w"), rg(p, "__h")
  local r = rg(p, "__relleno")
  local x0, y0, x1, y1 = r[1], r[2], w - r[3], h - r[4]
  local llenar = {}
  for _, c in ipairs(hijos(p)) do
    local d = rg(c, "__dock")
    if rg(c, "__vis") and d and d ~= NODOCK then
      local m = rg(c, "__margen")
      if d == TOP then c:SetPos(x0 + m[1], y0 + m[2]) c:SetWide(x1 - x0 - m[1] - m[3]) y0 = y0 + rg(c, "__h") + m[2] + m[4]
      elseif d == BOTTOM then c:SetWide(x1 - x0 - m[1] - m[3]) c:SetPos(x0 + m[1], y1 - rg(c, "__h") - m[4]) y1 = y1 - rg(c, "__h") - m[2] - m[4]
      elseif d == LEFT then c:SetPos(x0 + m[1], y0 + m[2]) c:SetTall(y1 - y0 - m[2] - m[4]) x0 = x0 + rg(c, "__w") + m[1] + m[3]
      elseif d == RIGHT then c:SetTall(y1 - y0 - m[2] - m[4]) c:SetPos(x1 - rg(c, "__w") - m[3], y0 + m[2]) x1 = x1 - rg(c, "__w") - m[1] - m[3]
      elseif d == FILL then llenar[#llenar + 1] = c end
    end
  end
  for _, c in ipairs(llenar) do local m = rg(c, "__margen") c:SetPos(x0 + m[1], y0 + m[2]) c:SetSize(math.max(0, x1 - x0 - m[1] - m[3]), math.max(0, y1 - y0 - m[2] - m[4])) end
  if p.PerformLayout then local ok, e = pcall(p.PerformLayout, p, w, h) if not ok then ErrorNoHalt("vgui PerformLayout: " .. tostring(e) .. "\n") end end
  rs(p, "__sucio", false)
end
-- (verse, z, foco, entrada)
function PM:SetVisible(v) rs(self, "__vis", v ~= false) local p = rg(self, "__padre") if p then rs(p, "__sucio", true) end end
function PM:IsVisible() if not rg(self, "__vis") then return false end local p = rg(self, "__padre") if p and p ~= mundo then return p:IsVisible() end return true end
function PM:Show() self:SetVisible(true) end function PM:Hide() self:SetVisible(false) end function PM:ToggleVisible() self:SetVisible(not rg(self, "__vis")) end
function PM:SetZPos(z) rs(self, "__z", z or 0) local p = rg(self, "__padre") if p then table.sort(hijos(p), function(a, b) return (rg(a, "__z") or 0) < (rg(b, "__z") or 0) end) end end
function PM:GetZPos() return rg(self, "__z") end
function PM:MoveToFront() local p = rg(self, "__padre") or mundo local h = hijos(p) quitar_de(h, self) h[#h + 1] = self quitar_de(raices, self) if rg(self, "__popup") then raices[#raices + 1] = self end end
function PM:MoveToBack() local p = rg(self, "__padre") or mundo local h = hijos(p) quitar_de(h, self) table.insert(h, 1, self) end
function PM:MoveToAfter(o) self:MoveToFront() end function PM:MoveToBefore(o) self:MoveToBack() end
function PM:MakePopup() rs(self, "__popup", true) rs(self, "__mouse", true) rs(self, "__teclado", true) quitar_de(raices, self) raices[#raices + 1] = self self:MoveToFront() end
function PM:IsModal() return rg(self, "__modal") == true end function PM:DoModal() rs(self, "__modal", true) self:MakePopup() end function PM:EndModal() rs(self, "__modal", false) end
function PM:SetMouseInputEnabled(b) rs(self, "__mouse", b ~= false) end function PM:IsMouseInputEnabled() return rg(self, "__mouse") end
function PM:SetKeyboardInputEnabled(b) rs(self, "__teclado", b ~= false) end function PM:IsKeyboardInputEnabled() return rg(self, "__teclado") end
function PM:RequestFocus() local a = foco foco = self if a ~= self then if a and a.OnLoseFocus then pcall(a.OnLoseFocus, a) end if self.OnGetFocus then pcall(self.OnGetFocus, self) end end end
function PM:HasFocus() return foco == self end function PM:HasHierarchicalFocus() return vgui.FocusedHasParent(self) end
function PM:KillFocus() if foco == self then foco = nil if self.OnLoseFocus then pcall(self.OnLoseFocus, self) end end end
function PM:IsHovered() return encima == self end
function PM:IsChildHovered(rec) local e = encima while e do if e == self then return encima ~= self end e = rg(e, "__padre") end return false end
function PM:IsDown() return apretado == self and rg(self, "__abajo") == true end
function PM:SetEnabled(b) rs(self, "__hab", b ~= false) end function PM:IsEnabled() return rg(self, "__hab") ~= false end
function PM:SetDisabled(b) self:SetEnabled(not b) end function PM:GetDisabled() return not self:IsEnabled() end
function PM:SetAlpha(a) rs(self, "__alfa", a) end function PM:GetAlpha() return rg(self, "__alfa") end
function PM:SetCursor(c) rs(self, "__cursor", c) end function PM:GetCursor() return rg(self, "__cursor") or "arrow" end
function PM:SetTooltip(t) rs(self, "__tooltip", t) end function PM:GetTooltip() return rg(self, "__tooltip") end function PM:SetTooltipPanel(p) rs(self, "__tooltipp", p) end
function PM:SetName(n) rs(self, "__nombre", n) end function PM:GetName() return rg(self, "__nombre") or "" end
function PM:GetClassName() return rg(self, "__clasenombre") or "Panel" end
function PM:GetTable() return self end
function PM:GetSkin() return derma.GetDefaultSkin() end function PM:SetSkin() end
function PM:SetPaintBackground(b) rs(self, "__fondo", b ~= false) end function PM:GetPaintBackground() return rg(self, "__fondo") ~= false end
function PM:SetDrawBackground(b) self:SetPaintBackground(b) end function PM:GetDrawBackground() return self:GetPaintBackground() end
function PM:SetPaintBackgroundEnabled(b) self:SetPaintBackground(b) end function PM:SetPaintBorderEnabled(b) rs(self, "__borde", b) end
function PM:SetBGColor(r, g, b, a) rs(self, "__colfondo", IsColor and IsColor(r) and r or Color(r or 0, g or 0, b or 0, a or 255)) end function PM:SetBGColorEx(...) self:SetBGColor(...) end
function PM:SetFGColor(r, g, b, a) rs(self, "__colfrente", IsColor and IsColor(r) and r or Color(r or 0, g or 0, b or 0, a or 255)) end function PM:SetFGColorEx(...) self:SetFGColor(...) end
function PM:SetCookieName(n) rs(self, "__galleta", n) end function PM:GetCookie(k, d) return d end function PM:SetCookie() end function PM:GetCookieNumber(k, d) return d end
function PM:SetSelectable() end function PM:IsSelectable() return false end function PM:SetSelected(b) rs(self, "__sel", b) end function PM:IsSelected() return rg(self, "__sel") == true end
function PM:PaintManual() end function PM:SetPaintedManually(b) rs(self, "__manual", b) end function PM:IsPaintedManually() return rg(self, "__manual") == true end
function PM:NoClipping(b) rs(self, "__sinrecorte", b) end function PM:SetDropTarget() end function PM:Receiver() end function PM:Droppable() end
function PM:SetWorldClicker(b) rs(self, "__clicmundo", b) end function PM:SetFocusTopLevel() end function PM:SetVerticalScrollbarEnabled() end
function PM:SetSteamAuthTicket() end function PM:SetConVar(c) rs(self, "__convar", c) end function PM:GetConVar() return rg(self, "__convar") end
function PM:ConVarChanged(v) local c = rg(self, "__convar") if c and c ~= "" then RunConsoleCommand(c, tostring(v)) end end
function PM:Command(c) end function PM:SetCommand(c) rs(self, "__comando", c) end function PM:SetSpawnIcon(i) rs(self, "__icono", i) end
function PM:SetEnabledEx(b) self:SetEnabled(b) end function PM:SetTerm() end function PM:Exec() end function PM:IsMarkedForDeletion() return rg(self, "__quitado") == true end
function PM:SetExpensiveShadow(d, c) rs(self, "__sombra", { d, c }) end function PM:SetUnderlineFont() end function PM:SetToFullHeight() local _, h = tam_padre(self) self:SetTall(h) end
function PM:ParentToHUD() self:SetParent(mundo) end function PM:SetRenderInScreenshots() end function PM:SetAllowNonAsciiCharacters() end
-- (animaciones: MoveTo, SizeTo, AlphaTo, ColorTo, LerpPositions, NewAnimation)
function PM:NewAnimation(largo, demora, ease, fin)
  local a = { StartTime = SysTime() + (demora or 0), EndTime = SysTime() + (demora or 0) + (largo or 0), Ease = ease, OnEnd = fin }
  local l = rg(self, "__anims") if not l then l = {} rs(self, "__anims", l) end l[#l + 1] = a return a
end
local function anim(p, largo, demora, ease, fin, f) local a = p:NewAnimation(largo, demora, ease, fin) a.Think = f return a end
function PM:MoveTo(x, y, largo, demora, ease, fin) local x0, y0 = self:GetPos() anim(self, largo, demora, ease, fin, function(a, p, t) p:SetPos(Lerp(t, x0, x), Lerp(t, y0, y)) end) end
function PM:SizeTo(w, h, largo, demora, ease, fin) local w0, h0 = self:GetSize() if w == -1 then w = w0 end if h == -1 then h = h0 end anim(self, largo, demora, ease, fin, function(a, p, t) p:SetSize(Lerp(t, w0, w), Lerp(t, h0, h)) end) end
function PM:AlphaTo(al, largo, demora, fin) local a0 = self:GetAlpha() anim(self, largo, demora, nil, fin, function(a, p, t) p:SetAlpha(Lerp(t, a0, al)) end) end
function PM:ColorTo(c, largo, demora, fin) anim(self, largo, demora, nil, fin, function(a, p, t) if t >= 1 and p.SetColor then p:SetColor(c) end end) end
function PM:LerpPositions(v, b) end function PM:Stop() rs(self, "__anims", {}) end function PM:AnimationThinkInternal() end
function PM:SetAnimationEnabled(b) end function PM:IsWorldClicker() return rg(self, "__clicmundo") == true end
local function animar(p)
  local l = rg(p, "__anims") if not l or #l == 0 then return end
  local ahora = SysTime()
  for i = #l, 1, -1 do
    local a = l[i]
    if ahora >= a.StartTime then
      local t = math.Clamp((ahora - a.StartTime) / math.max(a.EndTime - a.StartTime, 1e-4), 0, 1)
      local e = t if a.Ease and a.Ease > 0 then e = t ^ a.Ease elseif a.Ease and a.Ease < 0 then e = t ^ (1 / -a.Ease) end
      if a.Think then pcall(a.Think, a, p, e) end
      if t >= 1 then table.remove(l, i) if a.OnEnd then pcall(a.OnEnd, a, p) end end
    end
  end
end

-- ---------- crear: la cadena de bases, cada Init en orden (como GMod) ----------
local function crear(cls, padre, nombre)
  local c = registro[cls]
  local p = crudo(nombre or cls)
  rs(p, "__clasenombre", cls)
  local cadena, x, vistos = {}, c, {}
  while x and not vistos[x] do vistos[x] = true table.insert(cadena, 1, x) x = registro[rawget(x, "Base")] end
  p:SetParent(padre or mundo)
  for _, k in ipairs(cadena) do
    rs(p, "__clase", k)
    local f = rawget(k, "Init")
    if f then local ok, e = pcall(f, p) if not ok then ErrorNoHalt("vgui " .. tostring(cls) .. ": " .. tostring(e) .. "\n") end end
  end
  rs(p, "__clase", c)
  if (padre or mundo) == mundo then raices[#raices + 1] = p end
  return p
end
function vgui.Create(cls, padre, nombre) return crear(cls, padre, nombre) end
function vgui.CreateFromTable(t, padre, nombre) if not t then return nil end local n = "__tabla" .. tostring(t) registro[n] = nueva_clase(t, t.Base) return crear(n, padre, nombre) end
function vgui.CreateX(cls, padre, nombre) return crear(cls, padre, nombre) end

-- ---------- cada cuadro: animaciones, Think y layout ----------
local function pensar(p)
  if rg(p, "__quitado") or not rg(p, "__vis") then return end
  animar(p)
  if p.Think then local ok, e = pcall(p.Think, p) if not ok then ErrorNoHalt("vgui Think: " .. tostring(e) .. "\n") end end
  if p.AnimationThink then pcall(p.AnimationThink, p) end
  if rg(p, "__sucio") then __VGUI_Layout(p) end
  for _, c in ipairs(p:GetChildren()) do pensar(c) end
end
function __VGUI_Pensar() for _, c in ipairs(mundo:GetChildren()) do pensar(c) end end
function __VGUI_Hay() return #hijos(mundo) > 0 end
function __VGUI_Modal()
  if pantalla_clic then return true end
  for _, p in ipairs(raices) do if not rg(p, "__quitado") and rg(p, "__popup") and p:IsVisible() then return true end end
  return false
end

-- ---------- dibujar: cada panel en su lugar, recortado al de su padre ----------
local function pintar(p, ax, ay, cx0, cy0, cx1, cy1)
  if rg(p, "__quitado") or not rg(p, "__vis") or rg(p, "__manual") then return end
  local w, h = rg(p, "__w"), rg(p, "__h")
  ax, ay = ax + rg(p, "__x"), ay + rg(p, "__y")
  if not rg(p, "__sinrecorte") then cx0, cy0, cx1, cy1 = math.max(cx0, ax), math.max(cy0, ay), math.min(cx1, ax + w), math.min(cy1, ay + h) end
  if cx1 <= cx0 or cy1 <= cy0 then return end
  __vgui_poner(ax, ay, cx0, cy0, cx1 - cx0, cy1 - cy0, (rg(p, "__alfa") or 255) / 255)
  local tapa
  if p.Paint then local ok, e = pcall(p.Paint, p, w, h) if not ok then ErrorNoHalt("vgui Paint " .. tostring(rg(p, "__clasenombre")) .. ": " .. tostring(e) .. "\n") else tapa = e end end
  -- (el texto de los Label —DLabel, DButton, las pestañas—, como lo pone el motor de GMod: después del Paint)
  if p.__es_label and tapa ~= true and __VGUI_Texto_Label then pcall(__VGUI_Texto_Label, p, w, h) end
  __vgui_sacar()
  for _, c in ipairs(hijos(p)) do pintar(c, ax, ay, cx0, cy0, cx1, cy1) end
  if p.PaintOver then __vgui_poner(ax, ay, cx0, cy0, cx1 - cx0, cy1 - cy0, (rg(p, "__alfa") or 255) / 255) pcall(p.PaintOver, p, w, h) __vgui_sacar() end
end
function __VGUI_Pintar()
  local W, H = ancho_pantalla(), alto_pantalla()
  local l = {} for _, c in ipairs(hijos(mundo)) do if not rg(c, "__popup") then l[#l + 1] = c end end
  for _, c in ipairs(raices) do if rg(c, "__popup") and rg(c, "__padre") == mundo then l[#l + 1] = c end end
  for _, c in ipairs(l) do pintar(c, 0, 0, 0, 0, W, H) end
  -- (el globo de ayuda del que está debajo del dedo)
  local t = encima and rg(encima, "__tooltip")
  if t and t ~= "" and apretado == encima then
    surface.SetFont("DermaDefault") local tw, th = surface.GetTextSize(tostring(t))
    local x, y = math.min(cursor_x + 12, W - tw - 12), math.max(cursor_y - th - 18, 4)
    draw.RoundedBox(4, x, y, tw + 10, th + 6, Color(255, 245, 200, 245)) draw.SimpleText(tostring(t), "DermaDefault", x + 5, y + 3, Color(40, 40, 40))
  end
end

-- ---------- los toques: el panel de más arriba con entrada debajo del dedo ----------
local function bajo(p, x, y, ax, ay)
  if rg(p, "__quitado") or not rg(p, "__vis") then return nil end
  ax, ay = ax + rg(p, "__x"), ay + rg(p, "__y")
  local dentro = x >= ax and y >= ay and x < ax + rg(p, "__w") and y < ay + rg(p, "__h")
  if not dentro and not rg(p, "__sinrecorte") then return nil end
  local h = hijos(p)
  for i = #h, 1, -1 do local r = bajo(h[i], x, y, ax, ay) if r then return r end end
  if dentro and rg(p, "__mouse") then return p end
  return nil
end
local function panel_en(x, y)
  for i = #raices, 1, -1 do local p = raices[i] if rg(p, "__popup") and rg(p, "__padre") == mundo then local r = bajo(p, x, y, 0, 0) if r then return r end end end
  local h = hijos(mundo)
  for i = #h, 1, -1 do local r = bajo(h[i], x, y, 0, 0) if r then return r end end
  return nil
end
local function desplazable(p) while p and p ~= mundo do if rg(p, "__desplaza") then return p end p = rg(p, "__padre") end return nil end
function gui.MouseX() return cursor_x end function gui.MouseY() return cursor_y end function gui.MousePos() return cursor_x, cursor_y end
function input.GetCursorPos() return cursor_x, cursor_y end
function gui.EnableScreenClicker(b) pantalla_clic = b == true end function gui.ScreenToVector(x, y) return EyeAngles():Forward() end
function gui.IsConsoleVisible() return false end
-- estado: 1 apretar, 2 mover, 3 soltar. Devuelve si el toque es de la interfaz (el juego no lo usa)
function __VGUI_Toque(x, y, estado)
  cursor_x, cursor_y = x, y
  local hay = __VGUI_Modal()
  local p = panel_en(x, y)
  if estado == 2 then
    if apretado and arrastre then
      local dx, dy = x - arrastre.x, y - arrastre.y
      if not arrastre.mov and (dx * dx + dy * dy) > 100 then arrastre.mov = true end
      if arrastre.mov and arrastre.scroll then local s = arrastre.scroll if s.ArrastrarScroll then s:ArrastrarScroll(-(y - arrastre.ly)) end end
      arrastre.ly = y
      if apretado.OnCursorMoved then local lx, ly = apretado:ScreenToLocal(x, y) pcall(apretado.OnCursorMoved, apretado, lx, ly) end
    end
    if p ~= encima then if encima and encima.OnCursorExited then pcall(encima.OnCursorExited, encima) end encima = p if p and p.OnCursorEntered then pcall(p.OnCursorEntered, p) end end
    return hay or apretado ~= nil
  elseif estado == 1 then
    if not p then
      -- (un toque fuera de todo: cierra los menús desplegables)
      if CloseDermaMenus then CloseDermaMenus() end
      return false
    end
    if p ~= encima then if encima and encima.OnCursorExited then pcall(encima.OnCursorExited, encima) end encima = p if p.OnCursorEntered then pcall(p.OnCursorEntered, p) end end
    apretado = p rs(p, "__abajo", true)
    arrastre = { x = x, y = y, ly = y, mov = false, scroll = desplazable(p) }
    if rg(p, "__teclado") or p.AllowInput then p:RequestFocus() end
    local raiz = p while rg(raiz, "__padre") and rg(raiz, "__padre") ~= mundo do raiz = rg(raiz, "__padre") end
    if rg(raiz, "__popup") then raiz:MoveToFront() end
    if p.OnMousePressed then local ok, e = pcall(p.OnMousePressed, p, MOUSE_LEFT) if not ok then ErrorNoHalt("vgui OnMousePressed: " .. tostring(e) .. "\n") end end
    return true
  else
    local a = apretado apretado = nil
    if not a then return hay end
    rs(a, "__abajo", false)
    local movido = arrastre and arrastre.mov and arrastre.scroll
    arrastre = nil
    if a.OnMouseReleased then local ok, e = pcall(a.OnMouseReleased, a, MOUSE_LEFT, movido) if not ok then ErrorNoHalt("vgui OnMouseReleased: " .. tostring(e) .. "\n") end end
    -- (con el dedo no hay «pasar por encima»: al soltar no queda nada resaltado)
    if encima and encima.OnCursorExited then pcall(encima.OnCursorExited, encima) end encima = nil
    return true
  end
end
-- el texto que se escribe (el teclado del sistema) en el que tiene el foco
function __VGUI_Foco_Texto() if foco and rg(foco, "__esentrada") and foco:IsVisible() then return foco:GetValue() or "" end return nil end
function __VGUI_Texto(s, enter) if foco and rg(foco, "__esentrada") then foco:SetValue(s) if foco.OnChange then pcall(foco.OnChange, foco) end if foco.OnValueChange then pcall(foco.OnValueChange, foco, s) end if enter and foco.OnEnter then pcall(foco.OnEnter, foco, s) end end end

-- ---------- el skin: como el de GMod (dibujado acá, sin su textura) ----------
local SKIN = { PrintName = "Default", Author = "JXMod", DermaVersion = 1 }
SKIN.Colours = {
  Window = { TitleActive = Color(255, 255, 255), TitleInactive = Color(220, 220, 220) },
  Button = { Normal = Color(60, 60, 60), Hover = Color(20, 20, 20), Down = Color(255, 255, 255), Disabled = Color(130, 130, 130) },
  Tab = { Active = { Normal = Color(60, 60, 60) }, Inactive = { Normal = Color(220, 220, 220) } },
  Label = { Default = Color(60, 60, 60), Bright = Color(255, 255, 255), Dark = Color(40, 40, 40), Highlight = Color(255, 160, 40) },
  Tree = { Lines = Color(160, 160, 160), Normal = Color(40, 40, 40), Hover = Color(0, 90, 190), Selected = Color(255, 255, 255) },
  Properties = { Line_Selected = Color(40, 110, 220), Line_Hover = Color(220, 220, 220), Title = Color(30, 30, 30), Column_Normal = Color(245, 245, 245), Label_Normal = Color(40, 40, 40) },
  Category = { Header = Color(255, 255, 255), Header_Closed = Color(220, 220, 220), Line = { Text = Color(40, 40, 40), Text_Hover = Color(0, 90, 190), Button = Color(240, 240, 240), Button_Hover = Color(210, 225, 245) } },
  TooltipText = Color(40, 40, 40),
}
SKIN.colTextEntryText = Color(20, 20, 20) SKIN.colTextEntryTextHighlight = Color(20, 120, 255) SKIN.colTextEntryTextCursor = Color(0, 0, 100)
SKIN.colTextEntryTextPlaceholder = Color(128, 128, 128)
SKIN.text_dark = Color(40, 40, 40) SKIN.text_bright = Color(255, 255, 255) SKIN.text_normal = Color(60, 60, 60) SKIN.control_color = Color(120, 120, 120)
SKIN.fontFrame = "DermaDefault" SKIN.fontButton = "DermaDefault" SKIN.fontTab = "DermaDefault" SKIN.fontCategoryHeader = "TabLarge"
local function caja(x, y, w, h, c) surface.SetDrawColor(c) surface.DrawRect(x, y, w, h) end
local function borde(x, y, w, h, c) surface.SetDrawColor(c) surface.DrawOutlinedRect(x, y, w, h) end
local function degrade(x, y, w, h, a, b)
  local n = math.max(1, math.min(8, math.floor(h / 3)))
  for i = 0, n - 1 do local t = i / math.max(n - 1, 1) surface.SetDrawColor(Lerp(t, a.r, b.r), Lerp(t, a.g, b.g), Lerp(t, a.b, b.b), Lerp(t, a.a or 255, b.a or 255)) surface.DrawRect(x, y + math.floor(i * h / n), w, math.ceil(h / n) + 1) end
end
function SKIN:PaintFrame(p, w, h)
  draw.RoundedBox(4, 0, 0, w, h, Color(0, 0, 0, 90))
  draw.RoundedBox(4, 1, 1, w - 2, h - 2, Color(98, 102, 107, 250))
  draw.RoundedBoxEx(4, 1, 1, w - 2, 23, Color(62, 66, 72, 255), true, true, false, false)
  caja(1, 24, w - 2, 1, Color(40, 42, 46, 255))
end
function SKIN:PaintPanel(p, w, h) if not p:GetPaintBackground() then return end draw.RoundedBox(4, 0, 0, w, h, rg(p, "__colfondo") or Color(232, 232, 232, 255)) end
function SKIN:PaintShadow() end
function SKIN:PaintButton(p, w, h)
  if not p:GetPaintBackground() then return end
  local abajo, enc, dis = p:IsDown() or (p.GetToggle and p:GetToggle()) or rg(p, "__deprimido"), p:IsHovered(), not p:IsEnabled()
  draw.RoundedBox(4, 0, 0, w, h, dis and Color(150, 150, 150) or (enc and Color(70, 130, 210) or Color(120, 120, 120)))
  if abajo then degrade(1, 1, w - 2, h - 2, Color(180, 180, 180), Color(215, 215, 215))
  elseif dis then degrade(1, 1, w - 2, h - 2, Color(215, 215, 215), Color(200, 200, 200))
  elseif enc then degrade(1, 1, w - 2, h - 2, Color(255, 255, 255), Color(222, 234, 250))
  else degrade(1, 1, w - 2, h - 2, Color(252, 252, 252), Color(214, 214, 214)) end
end
function SKIN:PaintWindowCloseButton(p, w, h)
  draw.RoundedBox(4, 0, 2, w, h - 4, p:IsHovered() and Color(230, 80, 70) or Color(200, 60, 55))
  local cx, cy = w / 2, h / 2 surface.SetDrawColor(255, 255, 255) for d = -1, 1 do surface.DrawLine(cx - 5 + d, cy - 5, cx + 5 + d, cy + 5) surface.DrawLine(cx - 5 + d, cy + 5, cx + 5 + d, cy - 5) end
end
function SKIN:PaintCheckBox(p, w, h)
  draw.RoundedBox(2, 0, 0, w, h, Color(110, 110, 110)) caja(1, 1, w - 2, h - 2, p:IsEnabled() and Color(255, 255, 255) or Color(220, 220, 220))
  if p:GetChecked() then surface.SetDrawColor(30, 120, 220) surface.DrawLine(3, h / 2, w / 2 - 1, h - 4) surface.DrawLine(w / 2 - 1, h - 4, w - 3, 3) surface.DrawLine(3, h / 2 + 1, w / 2 - 1, h - 3) surface.DrawLine(w / 2 - 1, h - 3, w - 3, 4) end
end
function SKIN:PaintTextEntry(p, w, h)
  draw.RoundedBox(4, 0, 0, w, h, p:HasFocus() and Color(60, 120, 210) or Color(130, 130, 130))
  caja(1, 1, w - 2, h - 2, p:IsEnabled() and Color(255, 255, 255) or Color(225, 225, 225))
  local t = p:GetValue() or ""
  local f = p:GetFont() or "DermaDefault"
  if t == "" and p.GetPlaceholderText and p:GetPlaceholderText() ~= "" then draw.SimpleText(p:GetPlaceholderText(), f, 4, h / 2, SKIN.colTextEntryTextPlaceholder, TEXT_ALIGN_LEFT, TEXT_ALIGN_CENTER)
  else draw.SimpleText(tostring(t), f, 4, h / 2, p:GetTextColor() or SKIN.colTextEntryText, TEXT_ALIGN_LEFT, TEXT_ALIGN_CENTER) end
  if p:HasFocus() and math.floor(SysTime() * 2) % 2 == 0 then surface.SetFont(f) local tw = surface.GetTextSize(tostring(t)) caja(5 + tw, 4, 1, h - 8, SKIN.colTextEntryTextCursor) end
end
function SKIN:PaintPropertySheet(p, w, h) local o = p.GetActiveTab and p:GetActiveTab() local th = o and o:GetTall() or 20 draw.RoundedBox(4, 0, th - 1, w, h - th + 1, Color(232, 232, 232)) end
function SKIN:PaintTab(p, w, h) local act = p.IsActive and p:IsActive() draw.RoundedBoxEx(4, 0, 0, w, h + 4, act and Color(232, 232, 232) or Color(150, 154, 160), true, true, false, false) end
function SKIN:PaintScrollBarGrip(p, w, h) draw.RoundedBox(4, 2, 0, w - 4, h, p:IsHovered() and Color(110, 110, 110, 230) or Color(140, 140, 140, 200)) end
function SKIN:PaintVScrollBar(p, w, h) draw.RoundedBox(4, 2, 0, w - 4, h, Color(0, 0, 0, 40)) end
function SKIN:PaintMenu(p, w, h) draw.RoundedBox(2, 0, 0, w, h, Color(120, 120, 120)) caja(1, 1, w - 2, h - 2, Color(250, 250, 250)) end
function SKIN:PaintMenuOption(p, w, h) if p:IsHovered() then caja(0, 0, w, h, Color(60, 130, 230)) end end
function SKIN:PaintMenuSpacer(p, w, h) caja(4, 1, w - 8, 1, Color(200, 200, 200)) end
function SKIN:PaintComboBox(p, w, h) SKIN:PaintButton(p, w, h) surface.SetDrawColor(70, 70, 70) for i = 0, 4 do surface.DrawLine(w - 14 + i, h / 2 - 2 + i, w - 5 - i, h / 2 - 2 + i) end end
function SKIN:PaintCategoryList(p, w, h) draw.RoundedBox(4, 0, 0, w, h, Color(232, 232, 232)) end
function SKIN:PaintCollapsibleCategory(p, w, h) draw.RoundedBox(4, 0, 0, w, h, Color(238, 238, 238)) draw.RoundedBoxEx(4, 0, 0, w, 20, p:GetExpanded() and Color(70, 110, 170) or Color(120, 125, 132), true, true, not p:GetExpanded(), not p:GetExpanded()) end
function SKIN:PaintListView(p, w, h) caja(0, 0, w, h, Color(255, 255, 255)) borde(0, 0, w, h, Color(150, 150, 150)) end
function SKIN:PaintListViewLine(p, w, h) if p:IsSelected() then caja(0, 0, w, h, Color(60, 130, 230)) elseif p:IsHovered() then caja(0, 0, w, h, Color(225, 235, 250)) elseif p:GetAltLine() then caja(0, 0, w, h, Color(245, 245, 245)) end end
function SKIN:PaintNumSlider(p, w, h) local m = h / 2 caja(8, m - 1, w - 16, 3, Color(130, 130, 130)) end
function SKIN:PaintSliderKnob(p, w, h) draw.RoundedBox(4, 0, 0, w, h, Color(90, 90, 90)) draw.RoundedBox(4, 1, 1, w - 2, h - 2, p:IsHovered() and Color(255, 255, 255) or Color(230, 230, 230)) end
function SKIN:PaintTooltip(p, w, h) draw.RoundedBox(4, 0, 0, w, h, Color(255, 245, 200)) end
function SKIN:PaintTree(p, w, h) if p:GetPaintBackground() then caja(0, 0, w, h, Color(255, 255, 255)) end end
function SKIN:PaintTreeNodeButton(p, w, h) if p:IsSelected() then caja(0, 0, w, h, Color(60, 130, 230)) elseif p:IsHovered() then caja(0, 0, w, h, Color(225, 235, 250)) end end
function SKIN:PaintSelection(p, w, h) borde(0, 0, w, h, Color(60, 130, 230)) end
function SKIN:PaintProgress(p, w, h) draw.RoundedBox(4, 0, 0, w, h, Color(200, 200, 200)) draw.RoundedBox(4, 0, 0, w * math.Clamp(p:GetFraction() or 0, 0, 1), h, Color(70, 160, 70)) end
function SKIN:PaintExpandButton(p, w, h) draw.SimpleText(p:GetExpanded() and "-" or "+", "DermaDefault", w / 2, h / 2, Color(40, 40, 40), TEXT_ALIGN_CENTER, TEXT_ALIGN_CENTER) end
function SKIN:PaintMenuBar(p, w, h) caja(0, 0, w, h, Color(240, 240, 240)) end
function SKIN:PaintSelectionBox() end function SKIN:PaintTreeNode() end
local skins = { Default = SKIN }
function derma.GetDefaultSkin() return SKIN end
function derma.GetNamedSkin(n) return skins[n] or SKIN end
function derma.DefineSkin(n, d, t) t.Colours = t.Colours or SKIN.Colours setmetatable(t, { __index = SKIN }) skins[n] = t end
function derma.SkinHook(tipo, nombre, p, w, h) local f = SKIN[tipo .. nombre] if f then return f(SKIN, p, w, h) end end
function derma.SkinTexture(n, p, d) return d end
function derma.Color(n, p, d) local c = SKIN.Colours[n] return (IsColor and IsColor(c) and c) or d or Color(255, 255, 255) end
function derma.RefreshSkins() end function derma.SkinChangeIndex() return 1 end
derma.Controls = derma.Controls or {}
function derma.GetControlList() return derma.Controls end
function derma.DefineControl(n, d, t, b) t.Derma = { ClassName = n, Description = d, BaseClass = b } derma.Controls[#derma.Controls + 1] = t.Derma local r = vgui.Register(n, t, b) _G[n] = t return r end
local function skin(tipo) return function(p, w, h) return derma.SkinHook("Paint", tipo, p, w, h) end end

-- ---------- los controles ----------
-- (Panel, EditablePanel y Label: lo que en GMod está en el motor)
vgui.Register("EditablePanel", {}, "Panel")
local LABEL = { }
function LABEL:Init() rs(self, "__texto", "") rs(self, "__fuente", "DermaDefault") rs(self, "__alin", 4) rs(self, "__mouse", false) rs(self, "__inset", { 0, 0 }) end
function LABEL:SetText(t) rs(self, "__texto", t == nil and "" or tostring(t)) if rg(self, "__estirar") then self:SizeToContentsY() end end
function LABEL:GetText() return rg(self, "__texto") or "" end
function LABEL:SetFont(f) rs(self, "__fuente", f) end function LABEL:GetFont() return rg(self, "__fuente") or "DermaDefault" end
function LABEL:SetTextColor(c) rs(self, "__coltexto", c) end function LABEL:GetTextColor() return rg(self, "__coltexto") end
function LABEL:SetColor(c) self:SetTextColor(c) end function LABEL:GetColor() return rg(self, "__coltexto") or SKIN.Colours.Label.Default end
function LABEL:SetFGColor(...) local a = { ... } self:SetTextColor(IsColor and IsColor(a[1]) and a[1] or Color(a[1] or 0, a[2] or 0, a[3] or 0, a[4] or 255)) end
function LABEL:SetContentAlignment(a) rs(self, "__alin", a) end function LABEL:GetContentAlignment() return rg(self, "__alin") end
function LABEL:SetTextInset(x, y) rs(self, "__inset", { x or 0, y or 0 }) end function LABEL:GetTextInset() local i = rg(self, "__inset") return i[1], i[2] end
function LABEL:SetWrap(b) rs(self, "__envolver", b) end function LABEL:GetWrap() return rg(self, "__envolver") == true end
function LABEL:SetAutoStretchVertical(b) rs(self, "__estirar", b) end
function LABEL:SetDark(b) if b then self:SetTextColor(SKIN.Colours.Label.Dark) end end function LABEL:SetBright(b) if b then self:SetTextColor(SKIN.Colours.Label.Bright) end end
function LABEL:SetHighlight(b) if b then self:SetTextColor(SKIN.Colours.Label.Highlight) end end function LABEL:SetTextStyleColor(c) self:SetTextColor(c) end
function LABEL:GetTextSize() surface.SetFont(self:GetFont()) return surface.GetTextSize(self:GetText()) end
function LABEL:GetContentSize() local w, h = self:GetTextSize() local i = rg(self, "__inset") return w + i[1] * 2, h + i[2] * 2 end
local function renglones(t, f, ancho)
  surface.SetFont(f) local out = {}
  for linea in string.gmatch(t .. "\n", "([^\n]*)\n") do
    local act = ""
    for pal in string.gmatch(linea, "%S+") do
      local prueba = act == "" and pal or (act .. " " .. pal)
      if act ~= "" and surface.GetTextSize(prueba) > ancho then out[#out + 1] = act act = pal else act = prueba end
    end
    out[#out + 1] = act
  end
  return out
end
function __VGUI_Texto_Label(self, w, h)
  local t = self:GetText() if t == "" then return end
  if string.sub(t, 1, 1) == "#" and language and language.GetPhrase then t = language.GetPhrase(string.sub(t, 2)) end
  local f, c = self:GetFont(), self:GetColor()
  if not self:IsEnabled() then c = Color(c.r, c.g, c.b, 120) end
  local a, i = rg(self, "__alin") or 4, rg(self, "__inset")
  local ax = (a == 7 or a == 4 or a == 1) and TEXT_ALIGN_LEFT or ((a == 9 or a == 6 or a == 3) and TEXT_ALIGN_RIGHT or TEXT_ALIGN_CENTER)
  local ay = (a >= 7) and TEXT_ALIGN_TOP or ((a <= 3) and TEXT_ALIGN_BOTTOM or TEXT_ALIGN_CENTER)
  local x = ax == TEXT_ALIGN_LEFT and i[1] or (ax == TEXT_ALIGN_RIGHT and w - i[1] or w / 2)
  if rg(self, "__envolver") then
    surface.SetFont(f) local _, lh = surface.GetTextSize("W") local y = i[2]
    for _, l in ipairs(renglones(t, f, w - i[1] * 2)) do draw.SimpleText(l, f, x, y, c, ax, TEXT_ALIGN_TOP) y = y + lh end
    if rg(self, "__estirar") and math.abs(y + i[2] - h) > 1 then self:SetTall(y + i[2]) end
    return
  end
  local y = ay == TEXT_ALIGN_TOP and i[2] or (ay == TEXT_ALIGN_BOTTOM and h - i[2] or h / 2)
  draw.SimpleText(t, f, x, y, c, ax, ay)
end
LABEL.__es_label = true
vgui.Register("Label", LABEL, "Panel")
local DLABEL = {}
function DLABEL:Init() self:SetTextColor(SKIN.Colours.Label.Default) end
function DLABEL:OnMouseReleased(c, movido) if movido then return end if self.DoClick and rg(self, "__mouse") and self:IsHovered() then self:DoClick() end end
function DLABEL:SetIsToggle(b) rs(self, "__esalternar", b) end function DLABEL:GetIsToggle() return rg(self, "__esalternar") == true end
function DLABEL:SetToggle(b) rs(self, "__alternado", b) if self.OnToggled then self:OnToggled(b) end end function DLABEL:GetToggle() return rg(self, "__alternado") == true end
function DLABEL:Toggle() self:SetToggle(not self:GetToggle()) end
function DLABEL:SetDoubleClickingEnabled() end
derma.DefineControl("DLabel", "", DLABEL, "Label")
-- DPanel
local DPANEL = { Paint = skin("Panel") }
function DPANEL:SetBackgroundColor(c) rs(self, "__colfondo", c) end function DPANEL:GetBackgroundColor() return rg(self, "__colfondo") end
function DPANEL:SetDisabled(b) self:SetEnabled(not b) end
derma.DefineControl("DPanel", "", DPANEL, "Panel")
-- DButton
local DBUTTON = { Paint = skin("Button") }
function DBUTTON:Init() rs(self, "__mouse", true) self:SetContentAlignment(5) self:SetTextColor(SKIN.Colours.Button.Normal) self:SetSize(80, 22) self:SetCursor("hand") end
function DBUTTON:OnMouseReleased(c, movido)
  if movido or not self:IsEnabled() then return end
  if self:IsHovered() or panel_en(cursor_x, cursor_y) == self then
    if rg(self, "__esalternar") then self:Toggle() end
    surface.PlaySound("ui/buttonclickrelease.wav")
    if self.DoClick then local ok, e = pcall(self.DoClick, self) if not ok then ErrorNoHalt("DoClick: " .. tostring(e) .. "\n") end end
    local cmd = rg(self, "__consola") if cmd then RunConsoleCommand(cmd[1], cmd[2]) end
  end
end
function DBUTTON:SetConsoleCommand(c, a) rs(self, "__consola", { c, a }) end
function DBUTTON:SetImage(img) if not img then return end local i = rg(self, "__img") if not IsValid(i) then i = vgui.Create("DImage", self) rs(i, "__mouse", false) rs(self, "__img", i) end i:SetImage(img) i:SetSize(16, 16) self:InvalidateLayout() end
DBUTTON.SetIcon = DBUTTON.SetImage
function DBUTTON:PerformLayout(w, h) local i = rg(self, "__img") if IsValid(i) then i:SetPos(4, (h - i:GetTall()) / 2) self:SetTextInset(i:GetWide() + 8, 0) end end
function DBUTTON:SetDepressed(b) rs(self, "__deprimido", b) end
function DBUTTON:SetDrawBorder(b) end function DBUTTON:IsDown() return apretado == self end
derma.DefineControl("DButton", "", DBUTTON, "DLabel")
vgui.Register("Button", DBUTTON, "DLabel")
-- DImage y DImageButton
local DIMAGE = {}
function DIMAGE:Init() rs(self, "__mouse", false) rs(self, "__colimg", Color(255, 255, 255)) end
function DIMAGE:SetImage(r, alt) rs(self, "__ruta", r) rs(self, "__mat", Material(r)) end function DIMAGE:GetImage() return rg(self, "__ruta") end
function DIMAGE:SetMaterial(m) rs(self, "__mat", type(m) == "string" and Material(m) or m) end function DIMAGE:GetMaterial() return rg(self, "__mat") end
function DIMAGE:SetImageColor(c) rs(self, "__colimg", c) end function DIMAGE:GetImageColor() return rg(self, "__colimg") end
function DIMAGE:SetKeepAspect(b) rs(self, "__aspecto", b) end function DIMAGE:SizeToContents() self:SetSize(32, 32) end
function DIMAGE:Paint(w, h) local m = rg(self, "__mat") if not m then return end surface.SetMaterial(m) surface.SetDrawColor(rg(self, "__colimg") or Color(255, 255, 255)) surface.DrawTexturedRect(0, 0, w, h) end
function DIMAGE:SetOnViewMaterial(m) self:SetImage(m) end
derma.DefineControl("DImage", "", DIMAGE, "DPanel")
local DIMGB = {}
function DIMGB:Init() rs(self, "__mouse", true) local i = vgui.Create("DImage", self) i:Dock(FILL) rs(self, "__img", i) self:SetText("") self:SetPaintBackground(false) end
function DIMGB:SetImage(r) rg(self, "__img"):SetImage(r) end DIMGB.SetIcon = DIMGB.SetImage function DIMGB:GetImage() return rg(self, "__img"):GetImage() end
function DIMGB:SetMaterial(m) rg(self, "__img"):SetMaterial(m) end function DIMGB:SetColor(c) rg(self, "__img"):SetImageColor(c) end function DIMGB:SetStretchToFit() end
function DIMGB:SetKeepAspect(b) end function DIMGB:PerformLayout() end
derma.DefineControl("DImageButton", "", DIMGB, "DButton")
-- DFrame: barra de título, cerrar, arrastrar
local DFRAME = { Paint = skin("Frame") }
function DFRAME:Init()
  rs(self, "__mouse", true) self:DockPadding(5, 29, 5, 5) self:SetSize(300, 200)
  local t = vgui.Create("DLabel", self) t:SetTextColor(SKIN.Colours.Window.TitleActive) t:SetFont("DermaDefaultBold") rs(self, "__titulo", t)
  local c = vgui.Create("DButton", self) c:SetText("") c.Paint = skin("WindowCloseButton") c.DoClick = function() self:Close() end c:SetSize(31, 24) rs(self, "__cerrar", c)
  rs(self, "__arrastrable", true) rs(self, "__borrar", true)
end
function DFRAME:SetTitle(t) rg(self, "__titulo"):SetText(t) end function DFRAME:GetTitle() return rg(self, "__titulo"):GetText() end
function DFRAME:ShowCloseButton(b) rg(self, "__cerrar"):SetVisible(b) end function DFRAME:GetShowCloseButton() return rg(self, "__cerrar"):IsVisible() end
function DFRAME:SetDraggable(b) rs(self, "__arrastrable", b) end function DFRAME:GetDraggable() return rg(self, "__arrastrable") end
function DFRAME:SetSizable(b) rs(self, "__redim", b) end function DFRAME:GetSizable() return rg(self, "__redim") end
function DFRAME:SetDeleteOnClose(b) rs(self, "__borrar", b) end function DFRAME:GetDeleteOnClose() return rg(self, "__borrar") end
function DFRAME:SetScreenLock(b) rs(self, "__bloqueo", b) end function DFRAME:SetBackgroundBlur(b) end function DFRAME:SetIcon(i) end function DFRAME:SetPaintShadow() end
function DFRAME:IsActive() return true end function DFRAME:SetMinWidth(w) rs(self, "__minw", w) end function DFRAME:SetMinHeight(h) rs(self, "__minh", h) end
function DFRAME:Close() self:SetVisible(false) if self.OnClose then pcall(self.OnClose, self) end if rg(self, "__borrar") then self:Remove() end end
function DFRAME:PerformLayout(w, h)
  local t, c = rg(self, "__titulo"), rg(self, "__cerrar")
  t:SetPos(8, 2) t:SetSize(w - 50, 22) c:SetPos(w - 35, 0)
end
function DFRAME:OnMousePressed() local x, y = self:CursorPos() if rg(self, "__arrastrable") and y < 24 then rs(self, "__agarre", { x, y }) end end
function DFRAME:OnMouseReleased() rs(self, "__agarre", nil) end
function DFRAME:OnCursorMoved(x, y) local a = rg(self, "__agarre") if a then local px, py = self:GetPos() self:SetPos(math.Clamp(px + x - a[1], 0, ScrW() - self:GetWide()), math.Clamp(py + y - a[2], 0, ScrH() - 24)) end end
derma.DefineControl("DFrame", "", DFRAME, "EditablePanel")
-- DScrollPanel y su barra: desplazar arrastrando el dedo
local DVSB = { Paint = skin("VScrollBar") }
function DVSB:Init() rs(self, "__scroll", 0) rs(self, "__tam", 1) rs(self, "__lienzo", 1) self:SetWide(12) local g = vgui.Create("DPanel", self) g.Paint = skin("ScrollBarGrip") rs(self, "__agarre", g) rs(g, "__mouse", false) end
function DVSB:SetUp(tam, lienzo) rs(self, "__tam", tam) rs(self, "__lienzo", lienzo) self:SetScroll(self:GetScroll()) self:SetVisible(lienzo > tam) self:InvalidateLayout() end
function DVSB:GetScroll() return rg(self, "__scroll") end
function DVSB:SetScroll(s) local mx = math.max(0, rg(self, "__lienzo") - rg(self, "__tam")) s = math.Clamp(s or 0, 0, mx) if s ~= rg(self, "__scroll") then rs(self, "__scroll", s) local p = rg(self, "__padre") if p and p.OnVScroll then p:OnVScroll(-s) end end self:InvalidateLayout() end
function DVSB:AddScroll(d) self:SetScroll(self:GetScroll() + d * 25) return true end
function DVSB:AnimateTo(s) self:SetScroll(s) end function DVSB:GetOffset() return -self:GetScroll() end function DVSB:SetHideButtons() end
function DVSB:PerformLayout(w, h) local t, l = rg(self, "__tam"), math.max(rg(self, "__lienzo"), 1) local gh = math.max(20, h * t / l) local mx = math.max(l - t, 1) rg(self, "__agarre"):SetSize(w, gh) rg(self, "__agarre"):SetPos(0, (h - gh) * rg(self, "__scroll") / mx) end
derma.DefineControl("DVScrollBar", "", DVSB, "Panel")
local DSCROLL = {}
function DSCROLL:Init()
  local c = vgui.Create("Panel", self) rs(c, "__mouse", false) rs(self, "__lienzo", c)
  c.OnChildAdded = function(cv, h) cv:InvalidateLayout() self:InvalidateLayout() end
  local b = vgui.Create("DVScrollBar", self) b:Dock(RIGHT) rs(self, "__barra", b) rs(self, "__desplaza", true) self:SetPaintBackground(false)
end
function DSCROLL:OnChildAdded(h) local c, b = rg(self, "__lienzo"), rg(self, "__barra") if c and b and h ~= c and h ~= b then h:SetParent(c) end end
function DSCROLL:GetCanvas() return rg(self, "__lienzo") end function DSCROLL:GetVBar() return rg(self, "__barra") end
function DSCROLL:AddItem(p) p:SetParent(rg(self, "__lienzo")) self:InvalidateLayout() end
function DSCROLL:Clear() rg(self, "__lienzo"):Clear() end
function DSCROLL:OnVScroll(o) rg(self, "__lienzo"):SetY(o) end
function DSCROLL:ArrastrarScroll(d) local b = rg(self, "__barra") b:SetScroll(b:GetScroll() + d) end
function DSCROLL:OnMouseWheeled(d) rg(self, "__barra"):AddScroll(-d) return true end
function DSCROLL:ScrollToChild(p) local _, y = p:GetPos() rg(self, "__barra"):SetScroll(y) end
function DSCROLL:GetPadding() return 0 end function DSCROLL:SetPadding() end
function DSCROLL:PerformLayout(w, h)
  local c, b = rg(self, "__lienzo"), rg(self, "__barra")
  local bw = b:IsVisible() and b:GetWide() or 0
  c:SetWide(w - bw) __VGUI_Layout(c)
  local _, ch = c:ChildrenSize() local r = rg(c, "__relleno") ch = ch + r[4]
  c:SetTall(math.max(ch, h)) b:SetUp(h, ch) b:SetTall(h) b:SetPos(w - b:GetWide(), 0)
  c:SetPos(0, -b:GetScroll())
end
derma.DefineControl("DScrollPanel", "", DSCROLL, "DPanel")
-- DCheckBox y DCheckBoxLabel
local DCHECK = { Paint = skin("CheckBox") }
function DCHECK:Init() rs(self, "__mouse", true) self:SetSize(15, 15) rs(self, "__marcado", false) end
function DCHECK:GetChecked() return rg(self, "__marcado") == true end
function DCHECK:SetChecked(b) b = b == true or b == 1 or b == "1" if b ~= rg(self, "__marcado") then rs(self, "__marcado", b) self:ConVarChanged(b and "1" or "0") if self.OnChange then pcall(self.OnChange, self, b) end end end
function DCHECK:SetValue(v) self:SetChecked(v) end function DCHECK:GetValue() return self:GetChecked() end function DCHECK:Toggle() self:SetChecked(not self:GetChecked()) end
function DCHECK:OnMouseReleased(c, movido) if not movido and self:IsEnabled() then self:Toggle() if self.DoClick then pcall(self.DoClick, self) end end end
function DCHECK:Think() local c = rg(self, "__convar") if c and c ~= "" and not self:IsDown() then local v = GetConVarString(c) if v ~= "" then rs(self, "__marcado", v ~= "0") end end end
derma.DefineControl("DCheckBox", "", DCHECK, "DButton")
local DCHKL = {}
function DCHKL:Init() self:SetTall(16) local b = vgui.Create("DCheckBox", self) b.OnChange = function(_, v) if self.OnChange then self:OnChange(v) end end rs(self, "__caja", b) local l = vgui.Create("DLabel", self) l:SetMouseInputEnabled(true) l.DoClick = function() b:Toggle() end rs(self, "__etiq", l) rs(self, "__mouse", true) end
function DCHKL:SetText(t) rg(self, "__etiq"):SetText(t) end function DCHKL:GetText() return rg(self, "__etiq"):GetText() end
function DCHKL:SetValue(v) rg(self, "__caja"):SetValue(v) end function DCHKL:GetChecked() return rg(self, "__caja"):GetChecked() end function DCHKL:SetChecked(v) rg(self, "__caja"):SetChecked(v) end
function DCHKL:Toggle() rg(self, "__caja"):Toggle() end function DCHKL:SetConVar(c) rg(self, "__caja"):SetConVar(c) end function DCHKL:SetTextColor(c) rg(self, "__etiq"):SetTextColor(c) end
function DCHKL:SetDark(b) rg(self, "__etiq"):SetDark(b) end function DCHKL:SetBright(b) rg(self, "__etiq"):SetBright(b) end function DCHKL:SetFont(f) rg(self, "__etiq"):SetFont(f) end
function DCHKL:SetIndent(i) rs(self, "__sangria", i) end function DCHKL:SizeToContents() local w = rg(self, "__etiq"):GetTextSize() self:SetSize(w + 24 + (rg(self, "__sangria") or 0), 16) end
function DCHKL:PerformLayout(w, h) local i = rg(self, "__sangria") or 0 rg(self, "__caja"):SetPos(i, (h - 15) / 2) rg(self, "__etiq"):SetPos(i + 20, 0) rg(self, "__etiq"):SetSize(w - i - 20, h) end
derma.DefineControl("DCheckBoxLabel", "", DCHKL, "DPanel") DCHKL.Paint = nil
-- DNumSlider: etiqueta, barra que se arrastra con el dedo y el número
local DSLIDER = { }
function DSLIDER:Init() rs(self, "__mouse", true) rs(self, "__frac", 0) end
function DSLIDER:Paint(w, h) local f = rg(self, "__frac") or 0 surface.SetDrawColor(130, 130, 130) surface.DrawRect(6, h / 2 - 1, w - 12, 3) surface.SetDrawColor(60, 130, 230) surface.DrawRect(6, h / 2 - 1, (w - 12) * f, 3) end
function DSLIDER:PaintOver(w, h) local f = rg(self, "__frac") or 0 local x = 6 + (w - 12) * f - 5 draw.RoundedBox(4, x, h / 2 - 7, 10, 14, Color(90, 90, 90)) draw.RoundedBox(4, x + 1, h / 2 - 6, 8, 12, Color(240, 240, 240)) end
local function deslizar(s) local x = s:CursorPos() local f = math.Clamp((x - 6) / math.max(s:GetWide() - 12, 1), 0, 1) rs(s, "__frac", f) if s.TranslateValues then s:TranslateValues(f, 0) end if s.OnValueChanged then s:OnValueChanged(f) end end
function DSLIDER:OnMousePressed() deslizar(self) end function DSLIDER:OnCursorMoved() if self:IsDown() then deslizar(self) end end
function DSLIDER:SetSlideX(f) rs(self, "__frac", f) end function DSLIDER:GetSlideX() return rg(self, "__frac") end function DSLIDER:SetLockY() end function DSLIDER:SetNotches() end function DSLIDER:SetTrapInside() end
derma.DefineControl("DSlider", "", DSLIDER, "Panel")
local DNUM = {}
function DNUM:Init()
  self:SetTall(32) rs(self, "__min", 0) rs(self, "__max", 1) rs(self, "__dec", 2) rs(self, "__valor", 0)
  local l = vgui.Create("DLabel", self) l:SetDark(true) rs(self, "__etiq", l)
  local s = vgui.Create("DSlider", self) s.OnValueChanged = function(_, f) self:SetValue(rg(self, "__min") + f * (rg(self, "__max") - rg(self, "__min"))) end rs(self, "__barra", s)
  local n = vgui.Create("DLabel", self) n:SetContentAlignment(6) n:SetDark(true) rs(self, "__num", n)
end
function DNUM:SetText(t) rg(self, "__etiq"):SetText(t) end function DNUM:GetText() return rg(self, "__etiq"):GetText() end
function DNUM:SetMin(v) rs(self, "__min", tonumber(v) or 0) end function DNUM:SetMax(v) rs(self, "__max", tonumber(v) or 1) end function DNUM:SetMinMax(a, b) self:SetMin(a) self:SetMax(b) end
function DNUM:GetMin() return rg(self, "__min") end function DNUM:GetMax() return rg(self, "__max") end function DNUM:GetRange() return rg(self, "__max") - rg(self, "__min") end
function DNUM:SetDecimals(d) rs(self, "__dec", d) end function DNUM:GetDecimals() return rg(self, "__dec") end function DNUM:SetDefaultValue(v) rs(self, "__defecto", v) end function DNUM:GetDefaultValue() return rg(self, "__defecto") end
function DNUM:GetValue() return rg(self, "__valor") end
function DNUM:SetValue(v)
  v = math.Clamp(tonumber(v) or 0, rg(self, "__min"), rg(self, "__max")) v = math.Round(v, rg(self, "__dec") or 0)
  local cambio = v ~= rg(self, "__valor") rs(self, "__valor", v)
  rs(rg(self, "__barra"), "__frac", (v - rg(self, "__min")) / math.max(rg(self, "__max") - rg(self, "__min"), 1e-9))
  rg(self, "__num"):SetText(tostring(v))
  if cambio then self:ConVarChanged(v) if self.OnValueChanged then pcall(self.OnValueChanged, self, v) end end
end
function DNUM:Think() local c = rg(self, "__convar") if c and c ~= "" and not rg(self, "__barra"):IsDown() then local v = tonumber(GetConVarString(c)) if v and v ~= rg(self, "__valor") then rs(self, "__valor", v) rs(rg(self, "__barra"), "__frac", (v - rg(self, "__min")) / math.max(rg(self, "__max") - rg(self, "__min"), 1e-9)) rg(self, "__num"):SetText(tostring(v)) end end end
function DNUM:SetDark(b) rg(self, "__etiq"):SetDark(b) rg(self, "__num"):SetDark(b) end function DNUM:GetTextArea() return rg(self, "__num") end function DNUM:IsEditing() return rg(self, "__barra"):IsDown() end
function DNUM:PerformLayout(w, h) local lw = math.floor(w * 0.38) rg(self, "__etiq"):SetPos(0, 0) rg(self, "__etiq"):SetSize(lw, h) rg(self, "__barra"):SetPos(lw, 0) rg(self, "__barra"):SetSize(w - lw - 44, h) rg(self, "__num"):SetPos(w - 42, 0) rg(self, "__num"):SetSize(40, h) end
derma.DefineControl("DNumSlider", "", DNUM, "Panel")
-- DTextEntry: el teclado del celular escribe en el que tiene el foco
local DTEXT = { Paint = skin("TextEntry") }
function DTEXT:Init() rs(self, "__esentrada", true) rs(self, "__mouse", true) rs(self, "__teclado", true) rs(self, "__valor", "") rs(self, "__fuente", "DermaDefault") self:SetSize(120, 22) end
function DTEXT:SetValue(v) v = v == nil and "" or tostring(v) if rg(self, "__numerico") then v = string.gsub(v, "[^%d%.%-]", "") end rs(self, "__valor", v) self:ConVarChanged(v) end
function DTEXT:GetValue() return rg(self, "__valor") end function DTEXT:SetText(t) self:SetValue(t) end function DTEXT:GetText() return rg(self, "__valor") end
function DTEXT:GetFloat() return tonumber(rg(self, "__valor")) end function DTEXT:GetInt() local n = tonumber(rg(self, "__valor")) return n and math.floor(n) end
function DTEXT:SetPlaceholderText(t) rs(self, "__hint", t) end function DTEXT:GetPlaceholderText() return rg(self, "__hint") or "" end function DTEXT:SetPlaceholderColor() end
function DTEXT:SetNumeric(b) rs(self, "__numerico", b) end function DTEXT:GetNumeric() return rg(self, "__numerico") == true end
function DTEXT:SetFont(f) rs(self, "__fuente", f) end function DTEXT:GetFont() return rg(self, "__fuente") end
function DTEXT:SetTextColor(c) rs(self, "__coltexto", c) end function DTEXT:GetTextColor() return rg(self, "__coltexto") end
function DTEXT:SetEditable(b) rs(self, "__hab", b ~= false) end function DTEXT:SetMultiline(b) rs(self, "__multi", b) end function DTEXT:IsMultiline() return rg(self, "__multi") == true end
function DTEXT:SetUpdateOnType() end function DTEXT:SetEnterAllowed() end function DTEXT:SetDrawLanguageID() end function DTEXT:SetCaretPos() end function DTEXT:GetCaretPos() return #rg(self, "__valor") end
function DTEXT:SetHistoryEnabled() end function DTEXT:AddHistory() end function DTEXT:SelectAllText() end function DTEXT:SelectAllOnFocus() end function DTEXT:SetTabbingDisabled() end
function DTEXT:IsEditing() return self:HasFocus() end function DTEXT:AllowInput() return false end function DTEXT:SetHighlightColor() end function DTEXT:SetCursorColor() end function DTEXT:SetDrawBorder() end
function DTEXT:OnMousePressed() self:RequestFocus() end
function DTEXT:Think() local c = rg(self, "__convar") if c and c ~= "" and not self:HasFocus() then local v = GetConVarString(c) if v ~= rg(self, "__valor") then rs(self, "__valor", v) end end end
derma.DefineControl("DTextEntry", "", DTEXT, "Panel") vgui.Register("TextEntry", DTEXT, "Panel")
-- DNumberWang: un número con − y +
local DWANG = {}
function DWANG:SetMin(v) rs(self, "__min", v) end function DWANG:SetMax(v) rs(self, "__max", v) end function DWANG:SetMinMax(a, b) self:SetMin(a) self:SetMax(b) end
function DWANG:SetDecimals(d) rs(self, "__dec", d) end function DWANG:SetInterval(i) rs(self, "__paso", i) end function DWANG:GetMin() return rg(self, "__min") end function DWANG:GetMax() return rg(self, "__max") end
function DWANG:GetValue() return tonumber(rg(self, "__valor")) or 0 end
function DWANG:SetValue(v) v = math.Clamp(tonumber(v) or 0, rg(self, "__min") or -math.huge, rg(self, "__max") or math.huge) rs(self, "__valor", tostring(math.Round(v, rg(self, "__dec") or 0))) self:ConVarChanged(v) if self.OnValueChanged then pcall(self.OnValueChanged, self, v) end end
local function flecha_wang(p, w, h, arriba)
  if p:IsDown() then surface.SetDrawColor(200, 215, 235) surface.DrawRect(0, 0, w, h) end
  surface.SetDrawColor(70, 70, 70) local cx, cy = math.floor(w / 2), math.floor(h / 2)
  for i = 0, 3 do local yy = arriba and (cy - 1 + i) or (cy + 1 - i) surface.DrawLine(cx - i, yy, cx + i + 1, yy) end
end
function DWANG:Init()
  local function boton(arriba) local b = vgui.Create("DButton", self) b:SetText("") b:SetPaintBackground(false) b.Paint = function(p, w, h) flecha_wang(p, w, h, arriba) end
    b.DoClick = function() local d = rg(self, "__paso") or 1 self:SetValue(self:GetValue() + (arriba and d or -d)) end return b end
  self.Up, self.Down = boton(true), boton(false)
  self:SetSize(60, 22) rs(self, "__min", 0) rs(self, "__max", 100) rs(self, "__dec", 0) self:SetNumeric(true) self:SetValue(0)
end
function DWANG:PerformLayout(w, h) local bw = math.min(18, math.floor(w / 3)) self.Up:SetPos(w - bw, 0) self.Up:SetSize(bw, math.floor(h / 2)) self.Down:SetPos(w - bw, math.floor(h / 2)) self.Down:SetSize(bw, h - math.floor(h / 2)) end
function DWANG:OnMousePressed() self:RequestFocus() end
function DWANG:GetFraction() local a, b = rg(self, "__min") or 0, rg(self, "__max") or 1 return (self:GetValue() - a) / math.max(b - a, 1e-9) end
function DWANG:SetFraction(f) local a, b = rg(self, "__min") or 0, rg(self, "__max") or 1 self:SetValue(a + (b - a) * f) end
derma.DefineControl("DNumberWang", "", DWANG, "DTextEntry")
-- DMenu y sus opciones
local DMENU = { Paint = skin("Menu") }
function DMENU:Init() rs(self, "__ops", {}) self:SetSize(120, 4) rs(self, "__minw", 100) if RegisterDermaMenuForClose then RegisterDermaMenuForClose(self) end end
function DMENU:AddOption(t, f) local o = vgui.Create("DMenuOption", self) o:SetText(t) o.DoClick = function() if f then pcall(f, o) end CloseDermaMenus() end local l = rg(self, "__ops") l[#l + 1] = o self:InvalidateLayout() return o end
function DMENU:AddCVar(t, cv, on, off, f) local o = self:AddOption(t, function() RunConsoleCommand(cv, GetConVarString(cv) == on and off or on) if f then f() end end) o:SetChecked(GetConVarString(cv) == on) return o end
function DMENU:AddSpacer() local o = vgui.Create("DPanel", self) o.Paint = skin("MenuSpacer") o:SetTall(4) local l = rg(self, "__ops") l[#l + 1] = o self:InvalidateLayout() return o end
function DMENU:AddSubMenu(t, f) local o = self:AddOption(t, f) local s = vgui.Create("DMenu") s:SetVisible(false) o.DoClick = function() local x, y = o:LocalToScreen(o:GetWide(), 0) s:Open(x, y) end rs(o, "__sub", s) return s, o end
function DMENU:Open(x, y) self:SetParent(mundo) self:MakePopup() self:SetVisible(true) self:InvalidateLayout(true) x, y = x or cursor_x, y or cursor_y self:SetPos(math.Clamp(x, 0, ScrW() - self:GetWide()), math.Clamp(y, 0, ScrH() - self:GetTall())) end
function DMENU:Hide() self:SetVisible(false) end function DMENU:SetMinimumWidth(w) rs(self, "__minw", w) end function DMENU:GetChildren() return rg(self, "__ops") end
function DMENU:ChildCount() return #rg(self, "__ops") end function DMENU:GetChild(i) return rg(self, "__ops")[i] end function DMENU:SetDeleteSelf() end function DMENU:SetDrawColumn() end
function DMENU:PerformLayout(w, h)
  local y, mw = 2, rg(self, "__minw") or 100
  for _, o in ipairs(rg(self, "__ops")) do if o.GetTextSize then local tw = o:GetTextSize() mw = math.max(mw, tw + 40) end end
  for _, o in ipairs(rg(self, "__ops")) do o:SetPos(2, y) o:SetWide(mw - 4) if o:GetTall() < 4 then o:SetTall(4) end y = y + o:GetTall() end
  -- (las opciones van en el lienzo; si no entran en la pantalla, se desplaza con el dedo)
  local alto = math.min(y + 2, rg(self, "__maxh") or (ScrH() - 8))
  if y + 2 > alto then mw = mw + rg(self, "__barra"):GetWide() end
  rs(self, "__w", mw) rs(self, "__h", alto)
  _G.DScrollPanel.PerformLayout(self, mw, alto)
end
function DMENU:SetMaxHeight(h) rs(self, "__maxh", h) end function DMENU:GetMaxHeight() return rg(self, "__maxh") end
derma.DefineControl("DMenu", "", DMENU, "DScrollPanel")
local DMOP = { Paint = function(s, w, h) SKIN:PaintMenuOption(s, w, h) end }
function DMOP:Init() self:SetTall(24) self:SetTextInset(24, 0) self:SetContentAlignment(4) self:SetPaintBackground(false) end
function DMOP:SetChecked(b) rs(self, "__chk", b) end function DMOP:GetChecked() return rg(self, "__chk") == true end function DMOP:SetIsCheckable(b) end
function DMOP:SetIcon(i) self:SetImage(i) end function DMOP:AddSubMenu() local s = vgui.Create("DMenu") s:SetVisible(false) return s end
function DMOP:PaintOver(w, h) if rg(self, "__chk") then surface.SetDrawColor(40, 40, 40) surface.DrawLine(7, h / 2, 11, h / 2 + 4) surface.DrawLine(11, h / 2 + 4, 17, h / 2 - 4) end if rg(self, "__sub") then surface.SetDrawColor(40, 40, 40) for i = 0, 4 do surface.DrawLine(w - 12 + i, h / 2 - 4 + i, w - 12 + i, h / 2 + 4 - i) end end end
derma.DefineControl("DMenuOption", "", DMOP, "DButton")
function DermaMenu(sub, padre) local m = vgui.Create("DMenu", padre) return m end
-- DComboBox
local DCOMBO = { Paint = skin("ComboBox") }
function DCOMBO:Init() rs(self, "__ops", {}) rs(self, "__datos", {}) self:SetContentAlignment(4) self:SetTextInset(8, 0) self:SetSize(120, 22) end
function DCOMBO:AddChoice(t, d, sel, icono) local l = rg(self, "__ops") l[#l + 1] = t rg(self, "__datos")[#l] = d if sel then self:ChooseOptionID(#l) end return #l end
function DCOMBO:Clear() rs(self, "__ops", {}) rs(self, "__datos", {}) rs(self, "__elegido", nil) self:SetText("") end
function DCOMBO:ChooseOption(t, i) rs(self, "__elegido", i) self:SetText(t) local d = rg(self, "__datos")[i] self:ConVarChanged(d ~= nil and d or t) if self.OnSelect then pcall(self.OnSelect, self, i, t, d) end end
function DCOMBO:ChooseOptionID(i) local t = rg(self, "__ops")[i] if t then self:ChooseOption(t, i) end end
function DCOMBO:GetSelectedID() return rg(self, "__elegido") end function DCOMBO:GetSelected() local i = rg(self, "__elegido") if i then return rg(self, "__ops")[i], rg(self, "__datos")[i] end end
function DCOMBO:GetOptionText(i) return rg(self, "__ops")[i] end function DCOMBO:GetOptionData(i) return rg(self, "__datos")[i] end function DCOMBO:GetOptionTextByData(d) for i, x in pairs(rg(self, "__datos")) do if x == d then return rg(self, "__ops")[i] end end end
function DCOMBO:SetValue(v) self:SetText(v) end function DCOMBO:GetValue() return self:GetText() end function DCOMBO:SetSortItems() end function DCOMBO:IsMenuOpen() return IsValid(rg(self, "__menu")) and rg(self, "__menu"):IsVisible() end
function DCOMBO:CloseMenu() local m = rg(self, "__menu") if IsValid(m) then m:Remove() end end
function DCOMBO:OpenMenu() self:CloseMenu() local m = DermaMenu() for i, t in ipairs(rg(self, "__ops")) do m:AddOption(t, function() self:ChooseOption(t, i) end) end local x, y = self:LocalToScreen(0, self:GetTall()) m:SetMinimumWidth(self:GetWide()) m:Open(x, y) rs(self, "__menu", m) end
function DCOMBO:DoClick() self:OpenMenu() end
derma.DefineControl("DComboBox", "", DCOMBO, "DButton")
-- DPropertySheet: pestañas arriba
local DSHEET = { Paint = skin("PropertySheet") }
function DSHEET:Init() rs(self, "__hojas", {}) self:SetPaintBackground(true) end
function DSHEET:AddSheet(nombre, panel, icono, sinx, siny, ayuda)
  local t = vgui.Create("DButton", self) t:SetText(nombre) t.Paint = skin("Tab") t.IsActive = function() return rg(self, "__activa") == t end t:SetTall(22) t:SetTextColor(SKIN.Colours.Tab.Active.Normal) if icono then t:SetImage(icono) end
  local h = { Name = nombre, Tab = t, Panel = panel }
  t.DoClick = function() self:SetActiveTab(t) end t.GetPanel = function() return panel end
  panel:SetParent(self) panel:SetVisible(false)
  local l = rg(self, "__hojas") l[#l + 1] = h
  if #l == 1 then self:SetActiveTab(t) end
  self:InvalidateLayout() return h
end
function DSHEET:SetActiveTab(t) for _, h in ipairs(rg(self, "__hojas")) do h.Panel:SetVisible(h.Tab == t) end local a = rg(self, "__activa") rs(self, "__activa", t) if self.OnActiveTabChanged and a ~= t then pcall(self.OnActiveTabChanged, self, a, t) end self:InvalidateLayout() end
function DSHEET:GetActiveTab() return rg(self, "__activa") end function DSHEET:GetItems() return rg(self, "__hojas") end function DSHEET:SetFadeTime() end function DSHEET:SetShowIcons() end function DSHEET:SetPadding() end
function DSHEET:SwitchToName(n) for _, h in ipairs(rg(self, "__hojas")) do if h.Name == n then self:SetActiveTab(h.Tab) return true end end return false end
function DSHEET:CloseTab(t, quitar) local l = rg(self, "__hojas") for i, h in ipairs(l) do if h.Tab == t then table.remove(l, i) t:Remove() if quitar then h.Panel:Remove() end break end end if l[1] then self:SetActiveTab(l[1].Tab) end end
function DSHEET:PerformLayout(w, h)
  local x = 4
  for _, s in ipairs(rg(self, "__hojas")) do surface.SetFont("DermaDefault") local tw = surface.GetTextSize(s.Name) s.Tab:SetSize(tw + 24 + (rg(s.Tab, "__img") and 20 or 0), 22) s.Tab:SetPos(x, 0) x = x + s.Tab:GetWide() + 2
    s.Panel:SetPos(6, 26) s.Panel:SetSize(w - 12, h - 32) end
end
derma.DefineControl("DPropertySheet", "", DSHEET, "Panel")
-- DCollapsibleCategory y DCategoryList
local DCAT = { Paint = skin("CollapsibleCategory") }
function DCAT:Init()
  rs(self, "__abierta", true)
  local b = vgui.Create("DButton", self) b:SetText("") b:SetPaintBackground(false) b:SetTextColor(Color(255, 255, 255)) b:SetContentAlignment(4) b:SetTextInset(8, 0) b:SetTall(20) b:Dock(TOP) b.DoClick = function() self:Toggle() end rs(self, "__cab", b)
  self:SetTall(20)
end
function DCAT:SetLabel(t) rg(self, "__cab"):SetText(t) end function DCAT:GetLabel() return rg(self, "__cab"):GetText() end function DCAT:SetHeaderHeight(h) rg(self, "__cab"):SetTall(h) end
function DCAT:SetContents(p) p:SetParent(self) p:Dock(TOP) rs(self, "__cont", p) self:InvalidateLayout() end function DCAT:GetContents() return rg(self, "__cont") end
function DCAT:SetExpanded(b) rs(self, "__abierta", b ~= false) local c = rg(self, "__cont") if c then c:SetVisible(b ~= false) end self:InvalidateLayout() local p = rg(self, "__padre") if p then p:InvalidateLayout() end if self.OnToggle then pcall(self.OnToggle, self, b) end end
function DCAT:GetExpanded() return rg(self, "__abierta") ~= false end function DCAT:Toggle() self:SetExpanded(not self:GetExpanded()) end function DCAT:DoExpansion(b) self:SetExpanded(b) end
function DCAT:SetPadding() end function DCAT:SetAnimTime() end
function DCAT:Add(t) local b = vgui.Create("DButton", self) b:SetText(t) b:Dock(TOP) b:SetTall(20) b:SetContentAlignment(4) b:SetTextInset(10, 0) b:SetPaintBackground(false) self:InvalidateLayout() return b end
function DCAT:PerformLayout(w, h) local alto = rg(self, "__cab"):GetTall() if self:GetExpanded() then for _, c in ipairs(hijos(self)) do if c ~= rg(self, "__cab") and rg(c, "__vis") then alto = math.max(alto, rg(c, "__y") + rg(c, "__h")) end end end if alto ~= h then self:SetTall(alto) end end
derma.DefineControl("DCollapsibleCategory", "", DCAT, "Panel")
local DCATL = { Paint = skin("CategoryList") }
function DCATL:Add(t) local c = vgui.Create("DCollapsibleCategory", self) c:SetLabel(t) c:Dock(TOP) c:DockMargin(2, 2, 2, 0) return c end
function DCATL:AddItem(p) p:SetParent(self) p:Dock(TOP) end function DCATL:UnselectAll() end
derma.DefineControl("DCategoryList", "", DCATL, "DScrollPanel")
-- DListLayout, DIconLayout, DTileLayout, DGrid, DPanelList, DForm
local DLL = {}
function DLL:PerformLayout(w, h) local y = 0 for _, c in ipairs(hijos(self)) do if rg(c, "__vis") then c:SetPos(0, y) c:SetWide(w) y = y + c:GetTall() end end if y ~= h then self:SetTall(y) end end
derma.DefineControl("DListLayout", "", DLL, "DPanel") DLL.Paint = nil
local DICON = {}
function DICON:Init() rs(self, "__ex", 0) rs(self, "__ey", 0) end
function DICON:SetSpaceX(x) rs(self, "__ex", x) end function DICON:SetSpaceY(y) rs(self, "__ey", y) end function DICON:SetBorder(b) rs(self, "__borde_i", b) end
function DICON:SetStretchWidth() end function DICON:SetStretchHeight() end function DICON:SetLayoutDir() end function DICON:SetUseLiveDrag() end function DICON:Layout() self:InvalidateLayout() end
function DICON:PerformLayout(w, h)
  local b = rg(self, "__borde_i") or 0 local x, y, fila = b, b, 0
  for _, c in ipairs(hijos(self)) do if rg(c, "__vis") then if x + c:GetWide() > w - b and x > b then x = b y = y + fila + rg(self, "__ey") fila = 0 end c:SetPos(x, y) x = x + c:GetWide() + rg(self, "__ex") fila = math.max(fila, c:GetTall()) end end
  local alto = y + fila + b if alto ~= h then self:SetTall(alto) end
end
derma.DefineControl("DIconLayout", "", DICON, "DPanel") DICON.Paint = nil derma.DefineControl("DTileLayout", "", DICON, "DPanel")
local DGRID = {}
function DGRID:Init() rs(self, "__cols", 4) rs(self, "__colw", 32) rs(self, "__filah", 32) rs(self, "__items", {}) end
function DGRID:SetCols(n) rs(self, "__cols", n) end function DGRID:SetColWide(w) rs(self, "__colw", w) end function DGRID:SetRowHeight(h) rs(self, "__filah", h) end
function DGRID:AddItem(p) p:SetParent(self) local l = rg(self, "__items") l[#l + 1] = p self:InvalidateLayout() end function DGRID:GetItems() return rg(self, "__items") end
function DGRID:RemoveItem(p) quitar_de(rg(self, "__items"), p) p:Remove() end function DGRID:SortByMember() end
function DGRID:PerformLayout(w, h) local n = rg(self, "__cols") for i, p in ipairs(rg(self, "__items")) do p:SetPos(((i - 1) % n) * rg(self, "__colw"), math.floor((i - 1) / n) * rg(self, "__filah")) end self:SetTall(math.ceil(#rg(self, "__items") / n) * rg(self, "__filah")) end
derma.DefineControl("DGrid", "", DGRID, "Panel")
local DFORM = {}
function DFORM:Init() self:SetLabel("") self:SetTall(20) rs(self, "__items_f", {}) end
function DFORM:SetName(n) self:SetLabel(n) end
function DFORM:AddItem(a, b) local fila = vgui.Create("DPanel", self) fila:SetPaintBackground(false) fila:Dock(TOP) fila:DockMargin(8, 4, 8, 0) fila:SetTall(math.max(a and a:GetTall() or 20, b and b:GetTall() or 20))
  if a and b then a:SetParent(fila) b:SetParent(fila) a:Dock(LEFT) a:SetWide(110) b:Dock(FILL) elseif a then a:SetParent(fila) a:Dock(FILL) end self:InvalidateLayout() return fila end
function DFORM:Button(t, cmd, ...) local b = vgui.Create("DButton", self) b:SetText(t) if cmd then b:SetConsoleCommand(cmd, ...) end self:AddItem(b) return b end
function DFORM:CheckBox(t, cv) local c = vgui.Create("DCheckBoxLabel", self) c:SetText(t) c:SetDark(true) if cv then c:SetConVar(cv) end self:AddItem(c) return c end
function DFORM:NumSlider(t, cv, mn, mx, dec) local s = vgui.Create("DNumSlider", self) s:SetText(t) s:SetMinMax(mn, mx) s:SetDecimals(dec or 2) if cv then s:SetConVar(cv) local v = tonumber(GetConVarString(cv)) if v then s:SetValue(v) end end s:SetDark(true) self:AddItem(s) return s end
function DFORM:NumberWang(t, cv, mn, mx, dec) local l = vgui.Create("DLabel", self) l:SetText(t) l:SetDark(true) local n = vgui.Create("DNumberWang", self) n:SetMinMax(mn, mx) n:SetDecimals(dec or 0) if cv then n:SetConVar(cv) end self:AddItem(l, n) return n, l end
function DFORM:TextEntry(t, cv) local l = vgui.Create("DLabel", self) l:SetText(t) l:SetDark(true) local e = vgui.Create("DTextEntry", self) if cv then e:SetConVar(cv) e:SetValue(GetConVarString(cv)) end self:AddItem(l, e) return e, l end
function DFORM:ComboBox(t, cv) local l = vgui.Create("DLabel", self) l:SetText(t) l:SetDark(true) local c = vgui.Create("DComboBox", self) if cv then c:SetConVar(cv) end self:AddItem(l, c) return c, l end
function DFORM:ListBox(t) local l = vgui.Create("DListView", self) l:AddColumn(t or "") l:SetTall(100) self:AddItem(l) return l end
function DFORM:Help(t) local l = vgui.Create("DLabel", self) l:SetText(t) l:SetDark(true) l:SetWrap(true) l:SetAutoStretchVertical(true) self:AddItem(l) return l end
function DFORM:ControlHelp(t) local l = self:Help(t) l:SetTextColor(Color(80, 80, 140)) return l end
function DFORM:PanelSelect() local p = vgui.Create("DPanel", self) self:AddItem(p) return p end function DFORM:PropSelect(t) return self:Help(t or "") end function DFORM:MatSelect() return self:PanelSelect() end
function DFORM:KeyBinder(t) return self:Help(t or "") end function DFORM:ColorPicker(t) return self:Help(t or "") end function DFORM:SetSpacing() end function DFORM:SetAutoSize() end
function DFORM:ClearControls() for _, c in ipairs(self:GetChildren()) do if c ~= rg(self, "__cab") then c:Remove() end end end function DFORM:AddControl(t, d) return self:Help(tostring(d and (d.Label or d.label or d.Text) or t)) end
function DFORM:SetHeight() end function DFORM:FillViaParent() end
derma.DefineControl("DForm", "", DFORM, "DCollapsibleCategory")
vgui.Register("ControlPanel", {}, "DForm")
local DPL = { Paint = skin("Panel") }
function DPL:Init() rs(self, "__items", {}) rs(self, "__esp", 0) rs(self, "__pad", 0) rs(self, "__horiz", false) self:SetPaintBackground(true) end
function DPL:AddItem(p) if not IsValid(p) then return end p:SetParent(self:GetCanvas()) local l = rg(self, "__items") l[#l + 1] = p self:InvalidateLayout() end
function DPL:InsertAtTop(p) if not IsValid(p) then return end p:SetParent(self:GetCanvas()) table.insert(rg(self, "__items"), 1, p) self:InvalidateLayout() end
function DPL:GetItems() return rg(self, "__items") end
function DPL:RemoveItem(p, guardar) quitar_de(rg(self, "__items"), p) if not guardar and IsValid(p) then p:Remove() end self:InvalidateLayout() end
function DPL:Clear(guardar) for _, p in ipairs(rg(self, "__items")) do if not guardar and IsValid(p) then p:Remove() end end rs(self, "__items", {}) self:InvalidateLayout() end
function DPL:CleanList() self:Clear() end
function DPL:EnableHorizontal(b) rs(self, "__horiz", b == true) self:InvalidateLayout() end function DPL:EnableVerticalScrollbar() end
function DPL:SetSpacing(e) rs(self, "__esp", tonumber(e) or 0) end function DPL:GetSpacing() return rg(self, "__esp") end
function DPL:SetPadding(e) rs(self, "__pad", tonumber(e) or 0) end function DPL:GetPadding() return rg(self, "__pad") end
function DPL:SetAutoSize(b) rs(self, "__auto", b == true) end function DPL:SetNoSizing() end function DPL:SortByMember() end
function DPL:PerformLayout(w, h)
  local b = rg(self, "__barra") local cw = w - (b:IsVisible() and b:GetWide() or 0)
  local pad, esp, horiz = rg(self, "__pad"), rg(self, "__esp"), rg(self, "__horiz")
  local x, y, fila = pad, pad, 0
  for _, p in ipairs(rg(self, "__items")) do
    if IsValid(p) and rg(p, "__vis") then
      if horiz then
        if x + p:GetWide() > cw - pad and x > pad then x = pad y = y + fila + esp fila = 0 end
        p:SetPos(x, y) x = x + p:GetWide() + esp fila = math.max(fila, p:GetTall())
      else p:SetPos(pad, y) p:SetWide(cw - pad * 2) y = y + p:GetTall() + esp end
    end
  end
  local total = (horiz and y + fila or y - esp) + pad
  if rg(self, "__auto") then rs(self, "__h", math.max(total, 0)) h = math.max(total, 0) end
  _G.DScrollPanel.PerformLayout(self, w, h)
end
derma.DefineControl("DPanelList", "", DPL, "DScrollPanel")
-- DListView
local DLV = { Paint = skin("ListView") }
function DLV:Init() rs(self, "__cols", {}) rs(self, "__lineas", {}) rs(self, "__multi", true) local c = vgui.Create("DScrollPanel", self) rs(self, "__cuerpo", c) end
function DLV:AddColumn(t, pos) local b = vgui.Create("DButton", self) b:SetText(t) b:SetTall(17) b.DoClick = function() end local l = rg(self, "__cols") l[#l + 1] = b b.SetFixedWidth = function(s, w) rs(s, "__fijo", w) end b.SetMinWidth = function() end b.SetMaxWidth = function() end b.SetWidth = function(s, w) rs(s, "__fijo", w) end self:InvalidateLayout() return b end
function DLV:AddLine(...)
  local vals = { ... } local ln = vgui.Create("DButton", rg(self, "__cuerpo")) ln:SetText("") ln:SetTall(17) ln.Paint = function(s, w, h) SKIN:PaintListViewLine(s, w, h) end
  ln.GetAltLine = function() return rg(ln, "__alt") end ln.GetColumnText = function(s, i) return tostring(vals[i] or "") end ln.GetValue = function(s, i) return vals[i] end ln.SetValue = function(s, i, v) vals[i] = v end
  ln.SetColumnText = function(s, i, v) vals[i] = v end ln.SetSortValue = function() end ln.GetID = function() return rg(ln, "__id") end ln.SetSelected = function(s, b) rs(s, "__sel", b) end
  ln.PaintOver = function(s, w, h) local x = 0 for i, c in ipairs(rg(self, "__cols")) do draw.SimpleText(tostring(vals[i] == nil and "" or vals[i]), "DermaDefault", x + 4, h / 2, s:IsSelected() and Color(255, 255, 255) or Color(30, 30, 30), TEXT_ALIGN_LEFT, TEXT_ALIGN_CENTER) x = x + c:GetWide() end end
  ln.DoClick = function() if not rg(self, "__multi") then for _, o in ipairs(rg(self, "__lineas")) do rs(o, "__sel", false) end end rs(ln, "__sel", true) if self.OnRowSelected then pcall(self.OnRowSelected, self, rg(ln, "__id"), ln) end if self.OnClickLine then pcall(self.OnClickLine, self, ln, true) end end
  ln.DoDoubleClick = function() if self.DoDoubleClick then self:DoDoubleClick(rg(ln, "__id"), ln) end end
  local l = rg(self, "__lineas") l[#l + 1] = ln rs(ln, "__id", #l) rs(ln, "__alt", #l % 2 == 0) self:InvalidateLayout() return ln
end
function DLV:GetLines() return rg(self, "__lineas") end function DLV:GetLine(i) return rg(self, "__lineas")[i] end
function DLV:GetSelected() local r = {} for _, l in ipairs(rg(self, "__lineas")) do if rg(l, "__sel") then r[#r + 1] = l end end return r end function DLV:GetSelectedLine() for i, l in ipairs(rg(self, "__lineas")) do if rg(l, "__sel") then return i, l end end end
function DLV:Clear() for _, l in ipairs(rg(self, "__lineas")) do l:Remove() end rs(self, "__lineas", {}) end function DLV:ClearSelection() for _, l in ipairs(rg(self, "__lineas")) do rs(l, "__sel", false) end end
function DLV:RemoveLine(i) local l = rg(self, "__lineas")[i] if l then l:Remove() table.remove(rg(self, "__lineas"), i) end end function DLV:SelectItem(l) rs(l, "__sel", true) end function DLV:SelectFirstItem() local l = rg(self, "__lineas")[1] if l then rs(l, "__sel", true) end end
function DLV:SetMultiSelect(b) rs(self, "__multi", b) end function DLV:SortByColumn() end function DLV:SetHideHeaders(b) rs(self, "__sincab", b) end function DLV:SetDataHeight() end function DLV:SetHeaderHeight() end function DLV:SetSortable() end
function DLV:PerformLayout(w, h)
  local cols = rg(self, "__cols") local libre, nl = w, 0 for _, c in ipairs(cols) do if rg(c, "__fijo") then libre = libre - rg(c, "__fijo") else nl = nl + 1 end end
  local x = 0 for _, c in ipairs(cols) do c:SetPos(x, 0) c:SetWide(rg(c, "__fijo") or math.floor(libre / math.max(nl, 1))) c:SetVisible(not rg(self, "__sincab")) x = x + c:GetWide() end
  local cab = rg(self, "__sincab") and 0 or 17 local cu = rg(self, "__cuerpo") cu:SetPos(0, cab) cu:SetSize(w, h - cab)
  for _, l in ipairs(rg(self, "__lineas")) do l:Dock(TOP) end
end
derma.DefineControl("DListView", "", DLV, "DPanel")
-- DTree y sus nodos
local DTREE = { Paint = skin("Tree") }
function DTREE:Init() self:SetPaintBackground(true) end
function DTREE:AddNode(t, icono) local n = vgui.Create("DTree_Node", self) n:SetText(t) if icono then n:SetIcon(icono) end n:Dock(TOP) rs(n, "__arbol", self) return n end
function DTREE:GetSelectedItem() return rg(self, "__elegido") end function DTREE:SetSelectedItem(n) local a = rg(self, "__elegido") if IsValid(a) then rs(a, "__sel", false) end rs(self, "__elegido", n) rs(n, "__sel", true) if self.OnNodeSelected then pcall(self.OnNodeSelected, self, n) end end
function DTREE:Root() return self end function DTREE:SetShowIcons() end function DTREE:SetClickOnDragHover() end function DTREE:ShowIcons() return true end function DTREE:Clear() for _, c in ipairs(self:GetCanvas():GetChildren()) do c:Remove() end end
derma.DefineControl("DTree", "", DTREE, "DScrollPanel")
local DNODE = {}
function DNODE:Init() rs(self, "__abierto", false) local b = vgui.Create("DButton", self) b:SetPaintBackground(false) b.Paint = function(s, w, h) SKIN:PaintTreeNodeButton(self, w, h) end b:Dock(TOP) b:SetTall(18) b:SetContentAlignment(4) b:SetTextInset(22, 0) b.DoClick = function() self:SetExpanded(not self:GetExpanded()) local t = rg(self, "__arbol") if t then t:SetSelectedItem(self) end if self.DoClick then pcall(self.DoClick, self) end end rs(self, "__boton", b) self:SetTall(18) end
function DNODE:SetText(t) rg(self, "__boton"):SetText(t) end function DNODE:GetText() return rg(self, "__boton"):GetText() end function DNODE:SetIcon(i) rg(self, "__boton"):SetImage(i) end
function DNODE:AddNode(t, icono) local n = vgui.Create("DTree_Node", self) n:SetText(t) if icono then n:SetIcon(icono) end n:Dock(TOP) n:DockMargin(16, 0, 0, 0) n:SetVisible(self:GetExpanded()) rs(n, "__arbol", rg(self, "__arbol")) self:InvalidateLayout() return n end
function DNODE:SetExpanded(b) rs(self, "__abierto", b) for _, c in ipairs(hijos(self)) do if c ~= rg(self, "__boton") then c:SetVisible(b) end end self:InvalidateLayout() local p = rg(self, "__padre") if p then p:InvalidateLayout() end end
function DNODE:GetExpanded() return rg(self, "__abierto") == true end function DNODE:ExpandRecurse(b) self:SetExpanded(b) end function DNODE:IsSelected() return rg(self, "__sel") == true end
function DNODE:SetForceShowExpander() end function DNODE:SetDrawLines() end function DNODE:GetRoot() return rg(self, "__arbol") end function DNODE:AddFolder(t) return self:AddNode(t) end function DNODE:MakeFolder() end
function DNODE:PerformLayout(w, h) local alto = 18 for _, c in ipairs(hijos(self)) do if rg(c, "__vis") then alto = math.max(alto, rg(c, "__y") + rg(c, "__h")) end end if alto ~= h then self:SetTall(alto) end end
derma.DefineControl("DTree_Node", "", DNODE, "Panel")
-- divisores, modelos, íconos, colores, HTML, progreso y los demás
local DHDIV = {}
function DHDIV:SetLeft(p) p:SetParent(self) rs(self, "__izq", p) self:InvalidateLayout() end function DHDIV:SetRight(p) p:SetParent(self) rs(self, "__der", p) self:InvalidateLayout() end
function DHDIV:SetLeftWidth(w) rs(self, "__ancho", w) end function DHDIV:GetLeftWidth() return rg(self, "__ancho") or 100 end function DHDIV:SetDividerWidth() end function DHDIV:SetLeftMin() end function DHDIV:SetRightMin() end
function DHDIV:PerformLayout(w, h) local a = rg(self, "__ancho") or w / 2 local i, d = rg(self, "__izq"), rg(self, "__der") if i then i:SetPos(0, 0) i:SetSize(a, h) end if d then d:SetPos(a + 4, 0) d:SetSize(w - a - 4, h) end end
derma.DefineControl("DHorizontalDivider", "", DHDIV, "DPanel") DHDIV.Paint = nil
local DVDIV = {}
function DVDIV:SetTop(p) p:SetParent(self) rs(self, "__arr", p) self:InvalidateLayout() end function DVDIV:SetBottom(p) p:SetParent(self) rs(self, "__aba", p) self:InvalidateLayout() end
function DVDIV:SetTopHeight(h) rs(self, "__alto", h) end function DVDIV:GetTopHeight() return rg(self, "__alto") or 100 end function DVDIV:SetDividerHeight() end function DVDIV:SetTopMin() end function DVDIV:SetBottomMin() end function DVDIV:SetTopMax() end
function DVDIV:PerformLayout(w, h) local a = rg(self, "__alto") or h / 2 local t, b = rg(self, "__arr"), rg(self, "__aba") if t then t:SetPos(0, 0) t:SetSize(w, a) end if b then b:SetPos(0, a + 4) b:SetSize(w, h - a - 4) end end
derma.DefineControl("DVerticalDivider", "", DVDIV, "DPanel") DVDIV.Paint = nil
local DMODEL = {}
function DMODEL:Init() rs(self, "__camara", Vector(50, 50, 50)) rs(self, "__mira", Vector(0, 0, 40)) rs(self, "__fov", 70) end
function DMODEL:SetModel(m) rs(self, "__modelo", m) local e = ClientsideModel and ClientsideModel(m) if e and e.SetNoDraw then e:SetNoDraw(true) end rs(self, "__ent", e) end
function DMODEL:GetModel() return rg(self, "__modelo") end function DMODEL:GetEntity() return rg(self, "__ent") end function DMODEL:SetEntity(e) rs(self, "__ent", e) end
function DMODEL:SetCamPos(v) rs(self, "__camara", v) end function DMODEL:GetCamPos() return rg(self, "__camara") end function DMODEL:SetLookAt(v) rs(self, "__mira", v) end function DMODEL:GetLookAt() return rg(self, "__mira") end
function DMODEL:SetLookAng(a) rs(self, "__mang", a) end function DMODEL:GetLookAng() return rg(self, "__mang") or Angle() end function DMODEL:SetFOV(f) rs(self, "__fov", f) end function DMODEL:GetFOV() return rg(self, "__fov") end
function DMODEL:SetAmbientLight() end function DMODEL:SetDirectionalLight() end function DMODEL:SetColor(c) rs(self, "__col", c) end function DMODEL:GetColor() return rg(self, "__col") or Color(255, 255, 255) end
function DMODEL:SetAnimated() end function DMODEL:SetAnimSpeed() end function DMODEL:RunAnimation() end function DMODEL:StartScene() end function DMODEL:LayoutEntity() end function DMODEL:DrawModel() end function DMODEL:PreDrawModel() return true end function DMODEL:PostDrawModel() end
function DMODEL:Paint(w, h)
  draw.RoundedBox(4, 0, 0, w, h, Color(70, 74, 80, 200))
  local m = tostring(rg(self, "__modelo") or "") local ic = "spawnicons/" .. string.gsub(m, "%.mdl$", "") .. ".png"
  local mat = Material(ic) if mat and not mat:IsError() then surface.SetMaterial(mat) surface.SetDrawColor(255, 255, 255) surface.DrawTexturedRect(0, 0, w, h) return end
  draw.SimpleText(string.GetFileFromFilename and string.GetFileFromFilename(m) or m, "DermaDefault", w / 2, h / 2, Color(230, 230, 230), TEXT_ALIGN_CENTER, TEXT_ALIGN_CENTER)
end
derma.DefineControl("DModelPanel", "", DMODEL, "DButton") derma.DefineControl("DAdjustableModelPanel", "", {}, "DModelPanel")
local SPAWNICON = {}
function SPAWNICON:Init() self:SetSize(64, 64) self:SetText("") end function SPAWNICON:SetSkinID(i) rs(self, "__skin", i) end function SPAWNICON:SetBodyGroup() end function SPAWNICON:RebuildSpawnIcon() end function SPAWNICON:RebuildSpawnIconEx() end
function SPAWNICON:GetModelName() return rg(self, "__modelo") end function SPAWNICON:SetModelName(m) rs(self, "__modelo", m) end function SPAWNICON:SetModel(m, skin) rs(self, "__modelo", m) end
derma.DefineControl("SpawnIcon", "", SPAWNICON, "DModelPanel") vgui.Register("ContentIcon", {}, "SpawnIcon")
local DCOLM = {}
function DCOLM:Init() rs(self, "__color", Color(255, 255, 255)) self:SetSize(256, 180) local pal = { "ff0000", "ff8000", "ffff00", "80ff00", "00ff00", "00ff80", "00ffff", "0080ff", "0000ff", "8000ff", "ff00ff", "ff0080", "ffffff", "c0c0c0", "808080", "404040", "000000", "804000" }
  for i, hx in ipairs(pal) do local b = vgui.Create("DButton", self) b:SetText("") local c = HexToColor(hx) b.Paint = function(s, w, h) draw.RoundedBox(3, 0, 0, w, h, c) end b.DoClick = function() self:SetColor(c) self:ValueChanged(c) end b:SetSize(24, 24) b:SetPos(((i - 1) % 9) * 28 + 2, math.floor((i - 1) / 9) * 28 + 2) end end
function DCOLM:SetColor(c) rs(self, "__color", Color(c.r, c.g, c.b, c.a or 255)) self:UpdateConVars(c) end function DCOLM:GetColor() local c = rg(self, "__color") return Color(c.r, c.g, c.b, c.a) end
function DCOLM:GetVector() local c = rg(self, "__color") return Vector(c.r / 255, c.g / 255, c.b / 255) end function DCOLM:SetVector(v) self:SetColor(Color(v.x * 255, v.y * 255, v.z * 255)) end
function DCOLM:SetConVarR(c) rs(self, "__cvr", c) end function DCOLM:SetConVarG(c) rs(self, "__cvg", c) end function DCOLM:SetConVarB(c) rs(self, "__cvb", c) end function DCOLM:SetConVarA(c) rs(self, "__cva", c) end
function DCOLM:UpdateConVars(c) for k, f in pairs({ __cvr = "r", __cvg = "g", __cvb = "b", __cva = "a" }) do local cv = rg(self, k) if cv then RunConsoleCommand(cv, tostring(c[f] or 255)) end end end
function DCOLM:ValueChanged(c) end function DCOLM:SetPalette() end function DCOLM:SetAlphaBar() end function DCOLM:SetWangs() end function DCOLM:SetLabel() end function DCOLM:SetBaseColor() end
derma.DefineControl("DColorMixer", "", DCOLM, "DPanel")
local DHTML = {}
function DHTML:Init() rs(self, "__html", "") end function DHTML:OpenURL(u) rs(self, "__url", u) end function DHTML:SetHTML(h) rs(self, "__html", h) end function DHTML:AddFunction() end function DHTML:RunJavascript() end function DHTML:QueueJavascript() end
function DHTML:SetAllowLua() end function DHTML:SetScrollbars() end function DHTML:IsLoading() return false end function DHTML:Call() end function DHTML:ConsoleMessage() end function DHTML:NewObject() end function DHTML:NewObjectCallback() end
function DHTML:Paint(w, h) draw.RoundedBox(4, 0, 0, w, h, Color(250, 250, 250)) local t = rg(self, "__url") or string.gsub(rg(self, "__html") or "", "<[^>]+>", " ") draw.DrawText(string.sub(t, 1, 300), "DermaDefault", 6, 6, Color(40, 40, 40)) end
derma.DefineControl("DHTML", "", DHTML, "Panel") vgui.Register("HTML", DHTML, "Panel") vgui.Register("Awesomium", DHTML, "Panel")
local RICH = {}
function RICH:Init() rs(self, "__lineas_r", { "" }) rs(self, "__col_r", Color(255, 255, 255)) end
function RICH:AppendText(t) local l = rg(self, "__lineas_r") for i, x in ipairs(string.Explode("\n", tostring(t))) do if i > 1 then l[#l + 1] = "" end l[#l] = l[#l] .. x end end
function RICH:InsertColorChange(r, g, b, a) rs(self, "__col_r", Color(r, g, b, a)) end function RICH:SetVerticalScrollbarEnabled() end function RICH:GotoTextEnd() end function RICH:SetFontInternal(f) rs(self, "__fuente_r", f) end
function RICH:InsertClickableTextStart() end function RICH:InsertClickableTextEnd() end function RICH:InsertFade() end function RICH:ResetAllFades() end function RICH:SetUnderlineFont() end function RICH:GetNumLines() return #rg(self, "__lineas_r") end
function RICH:SetText(t) rs(self, "__lineas_r", { "" }) self:AppendText(t) end function RICH:GetText() return table.concat(rg(self, "__lineas_r"), "\n") end
function RICH:Paint(w, h) local f = rg(self, "__fuente_r") or "DermaDefault" surface.SetFont(f) local _, lh = surface.GetTextSize("W") local l = rg(self, "__lineas_r") local y = h - #l * lh for _, x in ipairs(l) do if y > -lh then draw.SimpleText(x, f, 2, y, rg(self, "__col_r")) end y = y + lh end end
vgui.Register("RichText", RICH, "Panel")
local DPROG = { Paint = skin("Progress") }
function DPROG:SetFraction(f) rs(self, "__frac", f) end function DPROG:GetFraction() return rg(self, "__frac") or 0 end
derma.DefineControl("DProgress", "", DPROG, "Panel")
-- (los que no se dibujan distinto: un panel con lo que piden)
for _, n in ipairs({ "DBinder", "DColorButton", "DColorPalette", "DAlphaBar", "DRGBPicker", "DColorCube", "DColorCombo", "DExpandButton", "DKillIcon", "DNotify", "DSizeToContents", "DTooltip",
  "DDrawer", "DBubbleContainer", "DFileBrowser", "DHScrollBar", "DHorizontalScroller", "DLabelEditable", "DLabelURL", "DListBox", "DListBoxItem", "DMenuBar", "DMenuOptionCVar", "DNumberScratch",
  "DShape", "DSprite", "DTab", "DCategoryHeader", "DCheckBoxLabel2", "DEntityProperties", "DProperties", "DProperty_Generic", "DProperty_Combo", "DProperty_Boolean", "DProperty_Float",
  "DProperty_Int", "DProperty_VectorColor", "DListView_Column", "DListView_Line", "DListView_ColumnPlain", "DListViewLine", "DListViewHeaderLabel", "DListViewLabel", "DTree_Node_Button",
  "DTextEntry_Multiline", "IconEditor", "MatSelect", "PropSelect", "ControlPresets", "CtrlNumPad", "CtrlListBox", "CtrlColor", "PresetEditor", "SpawnmenuContentPanel", "ContentSidebar",
  "ContentHeader", "ContentContainer", "UGCPublishWindow", "DPanelOverlay", "DPanelSelect", "DModelSelect", "DModelSelectMulti", "DSlider2", "Material", "ImageCheckBox", "DImageCheckBox",
  "RadioButton", "DRadio", "TGAImage", "ModelImage", "Frame", "PropertySheet", "DTileLayout", "DComboBox2", "DMenuBar2" }) do
  if not registro[n] then vgui.Register(n, {}, "DPanel") end
end
function Derma_Message(t, titulo, boton) local f = vgui.Create("DFrame") f:SetTitle(titulo or "") f:SetSize(320, 130) f:Center() f:MakePopup() local l = vgui.Create("DLabel", f) l:SetText(t) l:Dock(FILL) l:SetWrap(true) local b = vgui.Create("DButton", f) b:SetText(boton or "OK") b:Dock(BOTTOM) b.DoClick = function() f:Close() end return f end
function Derma_Query(t, titulo, ...) local a = { ... } local f = vgui.Create("DFrame") f:SetTitle(titulo or "") f:SetSize(360, 140) f:Center() f:MakePopup() local l = vgui.Create("DLabel", f) l:SetText(t) l:Dock(FILL) l:SetWrap(true) local fila = vgui.Create("DPanel", f) fila:Dock(BOTTOM) fila:SetTall(24) fila:SetPaintBackground(false)
  for i = 1, #a, 2 do local b = vgui.Create("DButton", fila) b:SetText(a[i]) b:Dock(LEFT) b:SetWide(100) b:DockMargin(0, 0, 4, 0) local fn = a[i + 1] b.DoClick = function() f:Close() if fn then fn() end end end return f end
function Derma_StringRequest(titulo, t, def, ok, cancel, okt, cant) local f = vgui.Create("DFrame") f:SetTitle(titulo or "") f:SetSize(360, 140) f:Center() f:MakePopup() local l = vgui.Create("DLabel", f) l:SetText(t) l:Dock(TOP) local e = vgui.Create("DTextEntry", f) e:Dock(TOP) e:SetValue(def or "") e:RequestFocus()
  local b = vgui.Create("DButton", f) b:SetText(okt or "OK") b:Dock(BOTTOM) b.DoClick = function() f:Close() if ok then ok(e:GetValue()) end end e.OnEnter = b.DoClick local c = vgui.Create("DButton", f) c:SetText(cant or "Cancelar") c:Dock(BOTTOM) c.DoClick = function() f:Close() if cancel then cancel(e:GetValue()) end end return f end
function Derma_DrawBackgroundBlur(p, t) surface.SetDrawColor(0, 0, 0, 160) surface.DrawRect(0, 0, ScrW(), ScrH()) end
function Derma_Install_Convar_Functions(t) t.SetConVar = PM.SetConVar t.ConVarChanged = PM.ConVarChanged end
