local partes = {}
for i = 1, 20 do partes[#partes + 1] = string.format("%02d", i) end
local s = table.concat(partes, ":")
print(s, #s)
local function split(str, sep) local out = {} for p in (str .. sep):gmatch("(.-)" .. sep:gsub("%p", "%%%0")) do out[#out + 1] = p end return out end
local sp = split("a,b,,c", ",")
print(#sp, table.concat(sp, "|"))
local function trim(x) return (x:gsub("^%s+", ""):gsub("%s+$", "")) end
print("[" .. trim("  hola  ") .. "]")
local cuenta = select(2, ("banana"):gsub("a", "a"))
print(cuenta)
print(("Hola Mundo"):lower():gsub("%s", "_"))
local acc = ""
for i = 1, 50 do acc = acc .. i % 10 end
print(acc)
print(("%5.1f|%-8s|%3d"):format(3.14159, "izq", 7))
print(string.format("%-20s|", "nombre") .. string.format("%8.2f", 1234.5678))
local csv = "nombre,edad,ciudad\nAna,30,Lima\nBeto,25,Quito"
for linea in csv:gmatch("[^\n]+") do local c = {} for campo in linea:gmatch("[^,]+") do c[#c + 1] = campo end print(#c, c[1], c[3]) end
print(("x"):rep(10):len(), ("abc"):rep(2, "-"):upper())
print(("hello world"):find("o w"), ("hello"):sub(2, -2), ("hello"):byte(-1))
print(string.format("%q", "line1\nline2"))
print(("test123abc"):match("^(%a+)(%d+)(%a+)$"))
print(("  a  b  "):gsub("%s+", " "))
print(tostring(12345678901234567890), 12345678901234567890 .. "")
local u = "ünïcödé"
print(#u, u:upper(), u:sub(1, 2) == "\xC3\xBC")
