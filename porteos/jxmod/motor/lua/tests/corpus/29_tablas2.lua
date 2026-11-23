local t = {}
t[1.0] = "a"; t[2] = "b"; t[-0] = "z"; t[0] = "cero"
print(t[1], t[1.0], t[0], t[-0], #t)
for k, v in pairs(t) do print(k, v, math.type and "" or type(k)) end
t[1.5] = "f"; t[2^31] = "g"; t[-1] = "n"
print(t[1.5], t[2^31], t[-1])
local nk = {}
print(pcall(function() nk[0/0] = 1 end), nk[0/0])
local h = {}
for i = 10, 1, -1 do h[i] = i end
print(#h)
local cnt = 0; for _ in pairs(h) do cnt = cnt + 1 end; print(cnt)
local keys = {}
for k in pairs(h) do keys[#keys + 1] = k end
print(table.concat(keys, ","))
local m = {}
m[3] = 3; m[1] = 1; m[2] = 2; m[5] = 5; m[4] = 4
print(#m); keys = {}; for k in pairs(m) do keys[#keys + 1] = k end; print(table.concat(keys, ","))
local ins = {1, 2, 3}
table.insert(ins, 2, nil); print(#ins, ins[1], ins[2], ins[3], ins[4])
local ins2 = {1, 2, 3}
table.insert(ins2, 4, nil); print(#ins2)
local ins3 = {1, 2, 3}
table.insert(ins3, 10, "x"); print(#ins3, ins3[10])
local ins4 = {}
table.insert(ins4, 0, "c"); print(#ins4, ins4[0])
print(pcall(table.insert, {}, "a", "b"))
local rem = {1, 2, 3, 4, 5}
print(table.remove(rem, 1), table.remove(rem, 2), table.remove(rem), #rem, table.concat(rem, ","))
print(table.remove(rem, 0), table.remove(rem, 5), #rem)
local holes = {1, 2, 3, 4, 5}
holes[2] = nil; holes[4] = nil
print(#holes); keys = {}; for k, v in pairs(holes) do keys[#keys + 1] = k .. "=" .. v end; print(table.concat(keys, " "))
holes[5] = nil; print(#holes)
local mod = {a = 1, b = 2, c = 3, d = 4, e = 5}
for k, v in pairs(mod) do if v % 2 == 0 then mod[k] = nil end end
keys = {}; for k, v in pairs(mod) do keys[#keys + 1] = k end; print(table.concat(keys, ","))
local re = {x = 1, y = 2}
re.x = nil; re.z = 3; re.x = 4
keys = {}; for k in pairs(re) do keys[#keys + 1] = k end; print(table.concat(keys, ","))
local big = {}
for i = 1, 1000 do big["k" .. i] = i end
for i = 1, 1000, 2 do big["k" .. i] = nil end
local suma = 0; for k, v in pairs(big) do suma = suma + v end; print(suma)
for i = 1, 500 do big["n" .. i] = i end
keys = {}; for k in pairs(big) do keys[#keys + 1] = k end; print(#keys, keys[1], keys[500], keys[501], keys[1000])
local mixto = {[1] = "a", [2] = "b", [4] = "d"}
print(#mixto, mixto[4])
mixto[3] = "c"; print(#mixto)
local ctor = {1, 2, nil, 4, [3] = "tres", [10] = 10}
print(#ctor, ctor[3], ctor[10])
local ctor2 = {[1] = "uno", [2] = "dos", "pos1"}
print(ctor2[1], ctor2[2], #ctor2)
local ctor3 = {x = 1, x = 2, ["x"] = 3}
print(ctor3.x)
local ctor4 = {n = nil, [nil == nil] = "bool"}
print(ctor4.n, ctor4[true])
local function three() return 1, 2, 3 end
local ctor5 = {three(), three(), [2] = "k"}
print(#ctor5, ctor5[1], ctor5[2], ctor5[3], ctor5[4])
print(next({}, nil), type(next), rawequal(next, next))
local n2 = {10, 20, x = 1}
local k1, v1 = next(n2); local k2, v2 = next(n2, k1); local k3, v3 = next(n2, k2)
print(k1, v1, k2, v2, k3, v3, next(n2, k3))
local arrkeys = {}
for i = 1, 5 do arrkeys[i] = i end
arrkeys[3] = nil
for k, v in pairs(arrkeys) do io_ = k end
print(#arrkeys)
local sparse = {}
sparse[1e9] = 1; sparse[-1e9] = 2
for k, v in pairs(sparse) do print(k, v) end
