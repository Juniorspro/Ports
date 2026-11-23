local s = "Hola Mundo"
print(#s, s:len(), string.len(s), s:upper(), s:lower(), s:reverse())
print(s:sub(1, 4), s:sub(6), s:sub(-5), s:sub(-5, -2), s:sub(0), s:sub(3, 2), s:sub(100), s:sub(-100, 3), s:sub(2.7, 4.9))
print(("x"):rep(5), ("ab"):rep(3, ","), ("x"):rep(0), ("x"):rep(-1), ("ab"):rep(1, "-"))
print(s:byte(), s:byte(1, 3), s:byte(-1), s:byte(100), string.char(72, 105, 33), string.char())
print(("abc"):byte(1, -1))
print(string.len(123), string.upper(12.5), string.sub(12345, 2, 3))
print(pcall(string.len), pcall(string.upper, {}))
print(("%d"):format(5), ("test"):upper(), #("abc" .. "def"))
local t = {}
for i = 1, 10 do t[#t + 1] = tostring(i) end
print(table.concat(t), table.concat(t, ", "), table.concat(t, "-", 3, 6), table.concat({}, "x"), table.concat({1, 2.5, "z"}, " "))
print(pcall(table.concat, {1, {}, 3}))
print(string.dump(print) == string.dump(print), string.dump(print) == string.dump(pairs))
print(("a,b,,c"):find(",", 1, true), ("a.b"):find(".", 1, true), ("a+b"):find("+", 1, true))
print(tostring(nil), tostring(true), tostring(12), tostring("x"))
print(string.format("%s %s %s", 1, nil, true), string.format("%5s|%-5s|%.2s", "ab", "cd", "efgh"))
