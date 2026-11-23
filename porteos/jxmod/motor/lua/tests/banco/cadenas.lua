-- textos: concatenar, gsub, format, find, partir
local t0 = os.clock()
local partes = {}
for i = 1, 20000 do partes[#partes + 1] = "item" .. i .. "=" .. (i * 1.5) end
local s = table.concat(partes, ";")
local n1 = select(2, s:gsub("item", "obj"))
local n2 = 0
for k, v in s:gmatch("(%w+)=([%d%.]+)") do n2 = n2 + 1 end
local acc = ""
for i = 1, 3000 do acc = acc .. string.format("%d:%.2f,", i, i / 7) end
local up = 0
for i = 1, 20000 do local x = ("Linea numero " .. i):upper(); if x:find("NUMERO 1") then up = up + 1 end end
local trim = 0
for i = 1, 20000 do local x = ("   hola " .. i .. "   "):match("^%s*(.-)%s*$"); trim = trim + #x end
print("cadenas", #s, n1, n2, #acc, up, trim, string.format("%.1f ms", (os.clock() - t0) * 1000))
