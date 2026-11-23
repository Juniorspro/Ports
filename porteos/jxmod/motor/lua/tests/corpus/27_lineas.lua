local function f()
  local t = {}
  return t.a.b
end
print(pcall(f))
print(pcall(function()
  local x = {
    a = 1,
    b = nil + 1,
  }
end))
local obj = {}
print(pcall(function() obj:metodo() end))
print(pcall(function() local m = obj.metodo; m() end))
print(pcall(function() for k, v in 5 do end end))
print(pcall(function() for k, v in {} do end end))
print(pcall(function() return tostring(setmetatable({}, {__tostring = function() error("en tostring") end})) end))
print(pcall(function() local a = setmetatable({}, {__index = function(t, k) error("idx " .. k) end}); return a.campo end))
print(pcall(function() local a = setmetatable({}, {__add = 5}); return a + 1 end))
print(pcall(function() local a = setmetatable({}, {__call = 5}); return a() end))
print(pcall(function() string.rep() end))
print(pcall(function() ("x"):rep() end))
print(pcall(function() local s = string.format("%d", {}) end))
print(pcall(function()
  local a = 1
  local b = a
    + nil
end))
print(pcall(error, "msg", 1))
local function lvl() error("nivel 2", 2) end
print(pcall(function() lvl() end))
print(pcall(function() error() end))
print(pcall(function() error(nil, 2) end))
print(pcall(next, {}, "nada"))
print(pcall(function() return 1 .. {} end))
print(pcall(function() local t = setmetatable({}, {__newindex = function() error("ni") end}); t.x = 1 end))
print(pcall(function() return #setmetatable({}, {__len = function() return 5 end}) end))
print(pcall(function() return math.floor({}) end))
print(pcall(function() return ("abc"):sub({}) end))
print(pcall(function() return table.concat({1, 2}, nil, 1, 3) end))
print(pcall(function() return tonumber({}) end))
print(pcall(function() return string.char(256, 65) end))
print(pcall(function() return ("x"):bad() end))
print(pcall(function() return nil < 1 end))
print(pcall(function() return "a" < 1 end))
print(pcall(function() return {} <= {} end))
