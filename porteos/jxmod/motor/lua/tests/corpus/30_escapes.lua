print("\65\066\0677", "\x41\x42\x43", #"\0\00\000", "a\0b" == "a\0b", "a\0b" < "a\0c", "\255" > "\1")
print(#"\z
       x", "tab\there", "\\", "\"", '\'', "\
nueva")
print(("x\0y"):byte(1, -1))
print(string.format("%q", "\0\1\2\255"))
print(("%d"):rep(2), ("a\nb"):gsub("\n", "\\n"))
print([[
]] == "", [[a
b]] == "a\nb", #[==[
]==])
local s = "con \"comillas\" y 'simples'"
print(s, #s)
print("\u{7F}" == "\127", "\u{48}\u{49}")
print(("abc"):upper():byte(-1), string.char(0):len(), ("\0"):rep(3):len())
print(tostring("\0"):len(), ("\0abc"):find("abc"), ("a\0b"):find("\0", 1, true))
print(("%z"):len(), ("100%"):gsub("%%", " por ciento"))
