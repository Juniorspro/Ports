# Saca una funcion decompilada y le quita el ruido del runtime de il2cpp. Uso: fn.py Clase Metodo
import sys, re
cl, me = sys.argv[1], sys.argv[2]
t = open('/tmp/claude-0/ss/gh/c2/%s.c' % cl, encoding='utf-8').read()
partes = re.split(r'(?m)^// 0x[0-9a-f]+ ', t)
for p in partes:
    if not p.startswith('%s$$%s\n' % (cl, me)): continue
    ls = p.split('\n')
    out = []
    for l in ls:
        s = l.strip()
        if not s: continue
        if re.match(r'^(undefined\d*|uint|int|long|ulong|bool|char|float|double|code|byte|short|ushort|int32_t|uint16_t|uint8_t|int64_t|uint32_t|MethodInfo|Il2CppObject|System_[A-Za-z_]*|[A-Z][A-Za-z_0-9]*_[oc]|[A-Za-z_0-9]+_array)\s*\**\s*\**[a-zA-Z_0-9]+(\s*\[\d+\])?;$', s): continue
        if re.search(r'func_0x012b1184|ExclusiveMonitor|0x3041730|cVar\d+ = .\\x01.|while \(cVar\d+ != .\\0.\)|bRam[0-9a-f]+|cRam[0-9a-f]+|func_0x012b11d8|func_0x012b130c|\(MethodInfo \*\)0x0', s) and not re.search(r'__[A-Z]', s):
            continue
        s2 = re.sub(r',\s*\(MethodInfo \*\)0x0', '', l)
        s2 = re.sub(r'\(MethodInfo \*\)0x0', '', s2)
        s2 = s2.replace('(__this->fields).', 'this.').replace('->fields).', '.').replace('(__this->fields)', 'this')
        s2 = re.sub(r'\((\w+)\.', r'\1.', s2) if False else s2
        out.append(s2.rstrip())
    print('\n'.join(out))
