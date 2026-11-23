local i = 1
::arriba::
if i <= 3 then print("goto", i); i = i + 1; goto arriba end
for a = 1, 3 do
  for b = 1, 3 do
    if b == 2 then goto continue end
    if a == 3 then goto salir end
    print(a, b)
    ::continue::
  end
end
::salir::
print("salió")
local n = 0
while true do
  n = n + 1
  if n < 3 then goto continue end
  break
  ::continue::
end
print("n", n)
local r = 0
repeat
  r = r + 1
  if r == 2 then goto continue end
  print("r", r)
  ::continue::
until r >= 3
do
  goto fin
  print("nunca")
  ::fin::
end
print("después de do")
local function f(x)
  if x then goto si end
  do return "no" end
  ::si::
  return "sí"
end
print(f(true), f(false))
for i = 1, 3 do
  local j = 0
  ::otra::
  j = j + 1
  if j < i then goto otra end
  print("i", i, "j", j)
end
