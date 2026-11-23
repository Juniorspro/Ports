-- funciones: cierres, varargs, llamadas a nativas, pcall
local t0 = os.clock()
local function hacer(n) local c = 0; return function(d) c = c + (d or 1); return c end end
local total = 0
for i = 1, 20000 do local f = hacer(i); f(); f(2); total = total + f() end
local function suma(...) local s = 0; for i = 1, select("#", ...) do s = s + (select(i, ...)) end return s end
local vs = 0
for i = 1, 50000 do vs = vs + suma(1, 2, 3, 4) end
local m = 0
for i = 1, 200000 do m = m + math.floor(math.sqrt(i)) + math.max(i % 7, 3) end
local ok = 0
for i = 1, 50000 do if pcall(function(x) return x * 2 end, i) then ok = ok + 1 end end
local tipos = 0
for i = 1, 200000 do if type(i) == "number" then tipos = tipos + 1 end end
print("cierres", total, vs, m, ok, tipos, string.format("%.1f ms", (os.clock() - t0) * 1000))
