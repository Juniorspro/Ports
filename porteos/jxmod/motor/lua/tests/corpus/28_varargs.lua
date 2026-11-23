local function f(...) return ... end
print(f(), f(nil), f(1, nil), f(nil, nil, 3))
print(select("#", f()), select("#", f(nil)), select("#", f(1, nil)), select("#", f(nil, nil)))
local function g(...) local t = {...}; return #t, select("#", ...) end
print(g(), g(1), g(nil, 2), g(1, nil), g(nil, nil, nil))
local function h(a, ...) return a, select("#", ...), (...) end
print(h(), h(1), h(1, 2, 3))
local function k(...) local a, b, c = ...; return c, b, a end
print(k(1, 2, 3, 4))
local function m(...) return {n = select("#", ...), ...} end
local r = m(1, nil, 3, nil)
print(r.n, r[1], r[2], r[3], r[4], #r)
local function cnt(...) return select("#", ...) end
print(cnt(f(1, 2, 3)), cnt(f(1, 2, 3), 4), cnt((f(1, 2, 3))), cnt(f(1, 2, 3), f(4, 5)))
local t = {f(1, 2), f(3, 4)}
print(#t, t[1], t[2], t[3])
local u = {f(1, 2), f(3, 4), k = 5}
print(#u, u.k)
print(string.format("%s %s %s", f("a", "b", "c")))
print(math.max(f(3, 9, 2)), math.min(f(3, 9, 2)))
local function rec(n, ...) if n == 0 then return select("#", ...), ... end return rec(n - 1, n, ...) end
print(rec(5))
local function pass(...) return pcall(f, ...) end
print(pass(1, 2, 3))
print(select(2, f(1, 2, 3)))
print(select(-1, f(1, 2, 3)))
print(pcall(select, 0, 1))
local va = function(...) local x = ... return x end
print(va(7, 8))
print((f(1, 2)))
local function nested(...) local function inner(...) return select("#", ...) end return inner(...), inner(..., 1) end
print(nested(1, 2))
local packed = table.pack(f())
print(packed.n)
print(unpack({1, 2, 3}, -1, 1))
print(unpack({1, 2, 3}, 2, 1))
