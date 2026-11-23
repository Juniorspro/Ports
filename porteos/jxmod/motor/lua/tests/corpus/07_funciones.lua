local function contador()
  local n = 0
  return function() n = n + 1; return n end, function() return n end
end
local inc, ver = contador()
inc(); inc()
print(ver(), inc(), ver())
local fs = {}
for i = 1, 3 do fs[i] = function() return i end end
print(fs[1](), fs[2](), fs[3]())
local gs = {}
local j = 0
while j < 3 do j = j + 1; local k = j; gs[j] = function() return k end end
print(gs[1](), gs[2](), gs[3]())
local function va(...)
  local a, b = ...
  return select("#", ...), a, b, {...}, ...
end
local n, a, b, t, x, y, z = va(1, nil, 3)
print(n, a, b, #t, x, y, z)
print(select("#", va()), select(-1, 1, 2, 3), select(2, "a", "b", "c"))
print((va(1, 2)))
local function multi() return 1, 2, 3 end
print(multi(), multi())
print(({multi(), multi()})[4], #{multi(), multi()}, #{multi(), (multi())})
local p, q = (multi())
print(p, q)
local function suma(...)
  local s = 0
  for _, v in ipairs({...}) do s = s + v end
  return s
end
print(suma(1, 2, 3, 4), suma(), suma(multi()))
local obj = {v = 10}
function obj:get() return self.v end
function obj.set(self, v) self.v = v end
obj:set(42); print(obj:get(), obj.get(obj))
local M = {sub = {}}
function M.sub.f(a) return a * 2 end
function M.sub:g(a) return self == M.sub, a end
print(M.sub.f(21), M.sub:g(5))
local function fact(n) if n <= 1 then return 1 end return n * fact(n - 1) end
print(fact(10), fact(20))
local fib
fib = function(n) if n < 2 then return n end return fib(n - 1) + fib(n - 2) end
print(fib(15))
local function outer()
  local x = 1
  local function mid()
    local function inner() x = x + 1; return x end
    return inner
  end
  local f = mid()
  f(); f()
  return x
end
print(outer())
local function tail(n, acc) if n == 0 then return acc end return tail(n - 1, acc + n) end
print(tail(1000, 0))
local shared
do
  local v = 0
  shared = {get = function() return v end, set = function(x) v = x end}
end
shared.set(99); print(shared.get())
print(type(print), type(nil), type({}), type("s"), type(2), type(true), type(coroutine.create(print)))
local function noret() end
print(noret(), select("#", noret()), (noret()))
local function retnil() return nil end
print(select("#", retnil()))
print(pcall(function(...) return ... end, 1, 2, 3))
local up = 1
local function cambia() up = up + 10 end
cambia(); print(up)
for i = 1, 2 do
  local c = 0
  local f = function() c = c + 1; return c end
  print(f(), f())
end
