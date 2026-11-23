for i = 1, 3 do print("a", i) end
for i = 3, 1, -1 do print("b", i) end
for i = 0, 1, 0.25 do print("c", i) end
for i = 1, 0 do print("nunca") end
for i = 1, 3 do local i = i * 10; print("d", i) end
for i = 10, 1, -3 do print("e", i) end
for i = 1.5, 3 do print("f", i) end
for i = "1", "2" do print("g", i, type(i)) end
local n = 0
while true do n = n + 1; if n > 5 then break end end
print("while", n)
local r = 0
repeat local z = r; r = r + 1 until z >= 3
print("repeat", r)
for i = 1, 10 do
  if i % 2 == 0 then continue end
  if i > 7 then break end
  print("cont", i)
end
local w = 0
while w < 6 do
  w = w + 1
  if w == 3 then continue end
  print("wcont", w)
end
local rr = 0
repeat
  rr = rr + 1
  if rr == 2 then continue end
  print("rcont", rr)
until rr >= 4
for i = 1, 3 do
  for j = 1, 3 do
    if j == 2 then goto siguiente end
    print("goto", i, j)
    ::siguiente::
  end
end
for i = 1, 4 do
  if i % 2 == 1 then goto continue end
  print("par", i)
  ::continue::
end
for i = 1, 3 do
  if i == 2 then goto continue end
  print("sin etiqueta", i)
end
do
  local k = 0
  ::otra::
  k = k + 1
  if k < 3 then goto otra end
  print("atrás", k)
end
for i = 1, 3 do
  for j = 1, 3 do
    if i * j == 4 then goto fuera end
    print("anidado", i, j)
  end
end
::fuera::
print("fuera")
local function it(t, i) i = i + 1; if t[i] then return i, t[i] end end
for i, v in it, {"x", "y"}, 0 do print("it", i, v) end
local function rango(n) local i = 0; return function() i = i + 1; if i <= n then return i end end end
for v in rango(3) do print("rango", v) end
for k, v in next, {"p", "q"} do print("next", k, v) end
if nil then print("no") elseif false then print("no") elseif 0 then print("cero es verdad") else print("no") end
if 1 != 2 && !(3 == 4) || false then print("gmod ops") end
// comentario de gmod
/* comentario
   de bloque */ print("después de /* */")
local x = 5 // comentario al final
print(x)
local s = 0
for i = 1, 100 do s = s + i end
print(s)
for _, v in ipairs({"a", "b"}) do for _, w2 in ipairs({1, 2}) do print(v .. w2) end end
local i = 1
while i <= 3 do local j = i; i = i + 1; print("blk", j) end
for i = 1, 3 do i = i * 2; print("mod", i) end
local t = {}
for i = 1, 5 do t[i] = function() return i end end
print(t[1](), t[5]())
