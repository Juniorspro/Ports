-- muchos números (un generador fijo, igual en los dos lados) por tostring y string.format
local s = 12345
local function azar() s = (s * 1103515245 + 12345) % 2147483648; return s end
local fmts = {"%.0f", "%.1f", "%.2f", "%.3f", "%.6f", "%.10f", "%e", "%.3e", "%.0e", "%g", "%.3g", "%.10g", "%.14g", "%.17g", "%d", "%x", "%5.1f", "%-10.4g", "%+.2e", "%o"}
local lineas = {}
for i = 1, 1500 do
  local a, b, c = azar(), azar(), azar()
  local x
  local tipo = i % 10
  if tipo == 0 then x = a / b
  elseif tipo == 1 then x = (a - 1073741824) * 1000 / (b + 1)
  elseif tipo == 2 then x = a / 2 ^ (c % 60)
  elseif tipo == 3 then x = (a % 1000) / 8
  elseif tipo == 4 then x = a * 2 ^ (c % 40)
  elseif tipo == 5 then x = (a % 100000) / 100
  elseif tipo == 6 then x = 1 / (a + 1)
  elseif tipo == 7 then x = a / 3 * 10 ^ ((c % 40) - 20)
  elseif tipo == 8 then x = (a % 64) / 16 + (b % 4)
  else x = -a / (b + 0.5) end
  local f = fmts[(c % #fmts) + 1]
  lineas[#lineas + 1] = tostring(x) .. " " .. f .. "=" .. string.format(f, x)
  if #lineas == 50 then print(table.concat(lineas, " | ")); lineas = {} end
end
print(table.concat(lineas, " | "))
for e = -30, 30 do print(e, 10 ^ e, 2 ^ e, 3 ^ e, 7.5 * 10 ^ e) end
for i = 1, 40 do print(i / 8, i / 16 + 0.5, string.format("%.1f %.2f %.0f", i / 8, i / 16, i / 2 + 0.5)) end
