-- todo lo que trae el Lua: las globales y lo de adentro de cada biblioteca, con su tipo
local function claves(t)
  local l = {}
  for k, v in pairs(t) do l[#l + 1] = tostring(k) .. ":" .. type(v) end
  table.sort(l)
  return table.concat(l, " ")
end
print(claves(_G))
for _, n in ipairs({"string", "table", "math", "os", "bit", "coroutine", "debug", "package", "utf8"}) do
  print(n, claves(_G[n]))
end
print(claves(getmetatable("")), getmetatable("").__index == string)
