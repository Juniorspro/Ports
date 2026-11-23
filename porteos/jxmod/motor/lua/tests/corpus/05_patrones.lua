local s = "hello world from Lua 5.1"
print(s:find("o"), s:find("o", 6), s:find("xyz"), s:find("l+"), s:find("(o)(r)"), s:find("^hello"), s:find("^world"))
print(s:find("%d"), s:find("%d+%.%d"), s:find("Lua%s+(%d)"), s:find("", 3), s:find("", 100), s:find("o", -5))
print(s:match("%a+"), s:match("(%a+) (%a+)"), s:match("%d+"), s:match("(%d)%.(%d)"), s:match("()o()"), s:match("xyz"))
print(("key=value"):match("(%w+)=(%w+)"), ("  trim  "):match("^%s*(.-)%s*$"), ("[test]"):match("%[(.*)%]"))
print(("f(a(b)c)d"):match("%b()"), ("THE (quick) fox"):find("%f[%a]%a+%f[%A]"), ("hello"):match(".-l"), ("hello"):match(".*l"))
print(("abcabc"):match("(a)(b)(c)%1%2%3"), ("aaa"):match("a-"), ("aaa"):match("a-$"), ("xay"):match("x(a?)y"), ("xy"):match("x(a?)y"))
print(("2024-01-15"):match("(%d+)-(%d+)-(%d+)"))
for k, v in string.gmatch("a=1, b=2, c=3", "(%w+)=(%w+)") do print(k, v) end
for w in ("one two  three"):gmatch("%S+") do print(w) end
for x in ("abc"):gmatch("") do print("[" .. x .. "]") end
for a, b in ("xyz"):gmatch("()(.)") do print(a, b) end
print(("hello world"):gsub("o", "0"), ("hello world"):gsub("o", "0", 1), ("hello"):gsub("", "-"))
print(("hello world"):gsub("(%w+)", "<%1>"), ("hello world"):gsub("%w+", "%0 %0"), ("abc"):gsub("%w", "%%"))
print(("hello world"):gsub("(%w+) (%w+)", "%2 %1"), ("abc"):gsub(".", {a = "1", b = true, c = false}))
print(("$name is $age"):gsub("%$(%w+)", {name = "Ana", age = 30}), ("a b c"):gsub("%w", function(c) return c:upper() .. "!" end))
print(("abc"):gsub("b", function() return nil end), ("abc"):gsub("", "x"), ("  x  "):gsub("^%s+", ""), ("aaa"):gsub("^a", "b"))
print(("x = 1"):gsub("%s*=%s*", "="), ("one;two;;three"):gsub(";;", ";"), ("CamelCaseString"):gsub("(%u)", " %1"))
print(("%d"):gsub("%%", "pct"), ("a.b.c"):gsub("%.", "/"), ("a1b2c3"):gsub("%d", ""), ("a1b2c3"):gsub("%a", "", 2))
print(pcall(string.gsub, "abc", "(", "x"), pcall(string.find, "abc", "[a"), pcall(string.gsub, "abc", "%", "x"))
print(pcall(string.gsub, "abc", "b", "%2"), pcall(string.match, "abc", "%1"))
print(("[%a]"):find("[%a]"), ("a-b"):match("[a-c]+"), ("A-z"):match("[%u-]+"), ("]x"):match("[]x]+"), ("^x"):match("[%^x]+"))
print(("hello"):find("l", 1, true), ("a.b.c"):find(".", 2, true), ("hello"):find("lo$"), ("hel$lo"):find("$l"))
print(("tab\there"):match("%c"), ("x9_"):match("%w+"), ("a_b"):match("[%w_]+"), ("!?."):match("%p+"), ("0xFF"):match("%x+$"))
print(string.rep("ab", 3):gsub("ab", "%0-"), ("abc"):match("^(a)(b)(c)$"), ("path/to/file.txt"):match("([^/]+)%.(%w+)$"))
print(("  padded  "):match("^%s*(.-)%s*$") .. "|", ("CSV,data,,here"):gsub(",", "\t"))
print(("hello"):gsub("l+", function(m) return #m end), ("abc"):gsub("%w", "%1"))
