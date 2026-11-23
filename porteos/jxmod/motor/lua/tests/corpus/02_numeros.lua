local L = {1, -1, 0, -0, 0.1, 0.2, 0.1 + 0.2, 1/3, 2/3, 10/3, 123456.789, 1e14, 1e15, 1e16, 123456789012345, 1234567890123456,
  2^53, 2^60, 2^63, 2^64, 1e21, 1e22, 1e100, 1e300, 1.5e300, 1e-1, 1e-4, 1e-5, 1e-6, 1e-7, 1e-10, 1e-300, 5e-324,
  3.14159265358979, 2.718281828459045, 100.5, 99.99, 0.5, 1.5, 2.5, -2.5, 1/0, -1/0, 0/0, 255/256, 1e15 + 0.5,
  2^-21, 2^-30, 12345.6789e10, 9007199254740993, 0.000123456789, 123.456e-10, 1.23456789012345e-5, 4.35, 0.07, 1.005,
  -123.456, -0.001, 1e15 - 1, 999999999999999, 99999999999999.9, 1234567.1234567}
for i = 1, #L do print(i, L[i], tostring(L[i]), L[i] .. "") end
print(tonumber("10"), tonumber("  10  "), tonumber("0x1F"), tonumber("1e2"), tonumber("1.5"), tonumber(".5"), tonumber("5."))
print(tonumber("abc"), tonumber(""), tonumber("1 2"), tonumber("inf"), tonumber("nan"), tonumber(nil))
print(tonumber("ff", 16), tonumber("777", 8), tonumber("zz", 36), tonumber("102", 2), tonumber("-ff", 16), tonumber(" 11 ", 2))
print(tonumber(10), tonumber("10", 10), tonumber("0x10", 10), tonumber(true))
print("10" + 5, "3" * "4", "0x10" + 0, "1e2" / 2, -"2", " 5 " + 1)
print(pcall(function() return "abc" + 1 end))
print(10 == "10", 0.1 + 0.2 == 0.3, math.floor(-0.5), math.ceil(-0.5), -0 == 0)
print(string.format("%.14g", 0.1), string.format("%.17g", 0.1), string.format("%.20f", 0.1))
