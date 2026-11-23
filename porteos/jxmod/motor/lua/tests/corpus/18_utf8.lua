local s = "a\xC3\xB1o \xE2\x82\xAC \xF0\x9F\x98\x80"
print(#s, utf8.len(s), utf8.char(72, 241, 8364, 128512) == "H\xC3\xB1\xE2\x82\xAC\xF0\x9F\x98\x80")
print(utf8.codepoint(s, 1, -1))
print(utf8.offset(s, 3), utf8.offset(s, -1), utf8.offset(s, 0, 3))
for p, c in utf8.codes("h\xC3\xA9") do print(p, c) end
print(utf8.len("\xFF"), utf8.force("a\xFFb") == "a\xEF\xBF\xBDb", utf8.GetChar(s, 2) == "\xC3\xB1", utf8.sub(s, 2, 3) == "\xC3\xB1o")
print(utf8.charpattern == "[\0-\x7F\xC2-\xF4][\x80-\xBF]*", utf8.len(""), utf8.len("abc", 2), utf8.len("abc", -1))
