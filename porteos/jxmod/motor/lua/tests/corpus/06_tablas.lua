local t = {10, 20, 30, nil, 50}
print(#t, t[4], t[5])
local u = {}
u[1] = "a"; u[2] = "b"; u[4] = "d"
print(#u)
u[3] = "c"
print(#u)
local v = {}
v[3] = 3; v[2] = 2; v[1] = 1
print(#v)
for k, x in pairs(v) do print("v", k, x) end
local h = {z = 1, a = 2, m = 3, [1] = "uno", [2] = "dos", [10] = "diez", [true] = "si", [1.5] = "frac"}
for k, x in pairs(h) do print("h", k, x) end
h.a = nil; h.z = nil; h.nuevo = 4; h.a = 5
for k, x in pairs(h) do print("h2", k, x) end
for i, x in ipairs({1, 2, nil, 4}) do print("ip", i, x) end
local q = {1, 2, 3}
table.insert(q, 4); table.insert(q, 1, 0); table.insert(q, 3, 1.5)
print(table.concat(q, ","), #q)
print(table.remove(q), table.remove(q, 1), table.remove(q, 2), table.concat(q, ","), #q)
print(table.remove({}), select("#", table.remove({})), table.remove(q, 10))
local s = {5, 2, 8, 1, 9, 3, 7}
table.sort(s); print(table.concat(s, " "))
table.sort(s, function(a, b) return a > b end); print(table.concat(s, " "))
local p = {{n = "b", e = 2}, {n = "a", e = 2}, {n = "c", e = 1}, {n = "d", e = 2}, {n = "e", e = 1}}
table.sort(p, function(a, b) return a.e < b.e end)
for _, x in ipairs(p) do print(x.n, x.e) end
local w = {"banana", "apple", "Cherry", "date"}
table.sort(w); print(table.concat(w, " "))
print(pcall(table.sort, {1, "a", 2}))
print(table.getn({1, 2, 3}), table.maxn({1, 2, [10] = 3, [5.5] = 1}), table.maxn({}))
print(unpack({1, 2, 3}), unpack({1, 2, 3}, 2), unpack({1, 2, 3}, 2, 3), select("#", unpack({}, 1, 3)))
local pk = table.pack(1, nil, 3)
print(pk.n, pk[1], pk[2], pk[3])
local cnt = 0
local big = {}
for i = 1, 100 do big[i] = i end
for k in pairs(big) do cnt = cnt + 1 end
print(cnt, #big)
for i = 1, 100 do if i % 2 == 0 then big[i] = nil end end
print(#big)
local n = {}
n[1] = 1; n[2] = 2; n[3] = 3; n[3] = nil
print(#n)
local nested = {a = {b = {c = "deep"}}}
print(nested.a.b.c, nested["a"]["b"]["c"])
local keys = {}
local mix = {"x", "y", k1 = 1, "z", k2 = 2}
for k, x in pairs(mix) do keys[#keys + 1] = tostring(k) .. "=" .. tostring(x) end
print(table.concat(keys, " "))
print(next({}), next({5}), rawlen({1, 2}), rawequal(t, t), rawequal(t, {}))
local r = {}
rawset(r, "a", 1); print(rawget(r, "a"), rawget(r, "b"), select("#", rawget(r, "b")))
print(pcall(rawset, r, nil, 1))
local del = {a = 1, b = 2, c = 3, d = 4}
for k in pairs(del) do del[k] = nil end
print(next(del))
local neg = {[-1] = "m", [0] = "z", [1] = "u"}
print(#neg, neg[-1], neg[0], neg[-0])
local ins = {}
table.insert(ins, "a"); table.insert(ins, 1, "b"); print(table.concat(ins, ","))
print(#{n = 1}, #{1, 2, 3, nil}, #{nil, nil, 3})
