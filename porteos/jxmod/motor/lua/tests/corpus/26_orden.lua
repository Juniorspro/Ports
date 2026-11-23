-- table.sort con muchos tamaños y comparaciones raras (el TimSort de V8, como la web)
local s = 777
local function azar(n) s = (s * 1103515245 + 12345) % 2147483648; return s % n end
for _, n in ipairs({2, 3, 5, 10, 31, 32, 63, 64, 65, 100, 130, 257, 600, 1500}) do
  local t = {}
  for i = 1, n do t[i] = azar(math.floor(n / 3) + 1) end
  local u = {}
  for i = 1, n do u[i] = {k = t[i], i = i} end
  table.sort(u, function(a, b) return a.k < b.k end)
  local r = {}
  for i = 1, n do r[i] = u[i].i end
  print(n, "estable", table.concat(r, ","))
  local v = {}
  for i = 1, n do v[i] = {k = t[i], i = i} end
  table.sort(v, function(a, b) return a.k <= b.k end)
  r = {}
  for i = 1, n do r[i] = v[i].i end
  print(n, "<=", table.concat(r, ","))
  local w = {}
  for i = 1, n do w[i] = t[i] end
  table.sort(w, function(a, b) return a > b end)
  print(n, ">", table.concat(w, ","))
  local llamadas = 0
  local z = {}
  for i = 1, n do z[i] = azar(1000) end
  table.sort(z, function(a, b) llamadas = llamadas + 1; return a < b end)
  print(n, "llamadas", llamadas, z[1], z[n])
  local raro = {}
  for i = 1, n do raro[i] = i end
  table.sort(raro, function(a, b) return (a * 7 + b * 3) % 5 < 2 end)
  print(n, "raro", table.concat(raro, ","))
end
local asc = {}
for i = 1, 300 do asc[i] = i end
table.sort(asc, function(a, b) return a > b end)
print(asc[1], asc[300])
local conhuecos = {5, nil, 3, nil, 1}
table.sort(conhuecos)
print(conhuecos[1], conhuecos[2], conhuecos[3], conhuecos[4], conhuecos[5])
local strs = {}
for i = 1, 100 do strs[i] = string.char(97 + azar(26), 97 + azar(26)) end
table.sort(strs)
print(table.concat(strs, " "))
