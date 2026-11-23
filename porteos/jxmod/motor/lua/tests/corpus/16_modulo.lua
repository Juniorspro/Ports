module("mimod", package.seeall)
valor = 5
function doble(n) return n * 2 end
print(valor, doble(21), _NAME, _PACKAGE, _M == mimod, mimod.valor, type(print))
print(package.loaded.mimod == mimod, string.format("%d", 3))
