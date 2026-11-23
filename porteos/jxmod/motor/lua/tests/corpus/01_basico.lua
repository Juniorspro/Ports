-- literales, aritmética, precedencia
print(1 + 2 * 3, (1 + 2) * 3, 2 ^ 3 ^ 2, -2 ^ 2, 2 ^ -1, 10 / 4, 7 % 3, -7 % 3, 7 % -3, 5.5 % 2)
print(1 == 1.0, "1" == 1, 0 == -0, 1 < 2, "a" < "b", "abc" < "abd", "Z" < "a", "" < "a")
print(not nil, not 0, not "", nil and 1, false or "x", 1 and 2, nil or false, false and nil)
print(1 .. 2, "a" .. "b" .. "c", 1.5 .. "", -0.0 .. "", 10 // 3)
print("tab\tnl\\n", 'q"uote', "a\065\x42\67", "\z
      junto", "\u{48}\u{49}", "\'\"", #"hola", #"")
print([[larga
línea]], [==[con ]] adentro]==], [[
primera vacía]])
--[[ comentario
largo ]] print("después del comentario largo")
--[==[ otro
]==] print("y otro")
local a, b, c = 1, 2
print(a, b, c)
local x, y = 1, 2, 3
print(x, y)
a, b = b, a
print(a, b)
local t = {}
t.x, t.y = 10, 20
print(t.x, t.y)
print(0x10, 0xff, 0XA, 1e3, 1E-2, .5, 5., 3.0, 0x1p4, 1e309)
print(2^53, 2^53 + 1, -2^63, 2^63)
print(math.huge, -math.huge, math.pi)
print(8 % 3.5, -8 % 3.5, 2^0.5, 100 / 3)
;;; print("puntos y coma");
