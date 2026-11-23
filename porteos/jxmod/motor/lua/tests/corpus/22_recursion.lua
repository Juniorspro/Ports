local function r(n) return r(n + 1) + 1 end
local ok, e = pcall(r, 1)
print(ok, e)
local function sumar(n) if n == 0 then return 0 end return n + sumar(n - 1) end
print(sumar(1000))
local t = setmetatable({}, {})
getmetatable(t).__index = function(tt, k) return tt[k .. "x"] end
print(pcall(function() return t.a end))
