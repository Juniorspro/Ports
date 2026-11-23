local function fib(n) if n < 2 then return n end return fib(n - 1) + fib(n - 2) end
local t0 = os.clock()
local r = fib(27)
print("fib(27) =", r, string.format("%.1f ms", (os.clock() - t0) * 1000))
