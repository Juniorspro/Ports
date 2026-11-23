print(2 ^ -2, -2 ^ 2, not nil == true, "a" .. "b" == "ab", 1 + 2 .. "", 2 * 3 ^ 2, -3 ^ 2, (-3) ^ 2)
print(1 < 2 == true, "10" + 1, "3" .. 4, 10 .. 20, #"abc" + 1, -"3", - -2)
print(1 and nil, nil and 1, false or nil, 0 or 1, "" or 1, nil or nil)
print(1 == 1 and "eq" or "ne", nil == false, {} == {}, "1" == 1)
local a = {b = {c = {}}}
function a.b.c.f(x) return x + 1 end
function a.b.c:m(x) return self == a.b.c, x end
print(a.b.c.f(1), a.b.c:m(2))
local s = "x"
s = s .. s .. s
print(s, #s)
local big = {}
for i = 1, 200 do big[#big + 1] = i end
print(#big, big[200], select("#", unpack(big)))
local t = {unpack(big)}
print(#t)
local long = {1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60}
print(#long, long[50], long[51], long[60])
local mixed = {[1] = "a", "b"}
print(mixed[1], #mixed)
local function vf(...) return {n = select("#", ...), ...} end
local r = vf(nil, nil)
print(r.n, #r)
local esc = "\a\b\f\v"
print(#esc, esc:byte(1, -1))
print(("x"):rep(3, ""), ("%s=%s"):format("k", "v"), ("abc"):upper():lower())
local n = 0
for k, v in pairs({10, 20, 30, a = 1}) do n = n + v end
print(n)
print(#"\0\0\0", ("a\0b"):len(), ("a\0b"):byte(2))
local x = 0
x = x + 1; x = x * 10; x = x - 1; x = x / 3
print(x)
print(math.floor(-0.0), 1e308 * 10, -1e308 * 10, 2^1023 * 2)
local q = {}
q[1.0] = "uno"; q[2] = "dos"
print(q[1], #q)
q[2^53] = "grande"
print(q[2^53])
local str_key = {["1"] = "s", [1] = "n"}
print(str_key["1"], str_key[1])
print(select(-2, "a", "b", "c"))
print(string.format("%s", 1e100), 1e100)
print(tostring(1e15), tostring(-1e15), tostring(1e14 + 0.5))
local deep = {}
local cur = deep
for i = 1, 50 do cur.n = {}; cur = cur.n end
print(type(deep.n.n.n))
