print("antes")
print(pcall(function() local i = 0; while true do i = i + 1 end end))
print("nunca llega")
