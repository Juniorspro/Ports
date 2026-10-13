# Decompila los metodos de las clases pedidas, un .c por clase
import os, json, codecs
from ghidra.app.decompiler import DecompInterface, DecompileOptions
from ghidra.util.task import ConsoleTaskMonitor
data = json.loads(open(os.environ["SCRIPT_JSON"], 'rb').read().decode('utf-8'))
clases = set(l.strip() for l in open(os.environ["CLASES"]))
sal = os.environ["SALIDA"]
base = currentProgram.getImageBase()
por = {}
for m in data["ScriptMethod"]:
    n = m["Name"]
    c = n.split("$$")[0]
    raiz = c.split(".")[0]
    if raiz in clases:
        por.setdefault(c, []).append(m)
d = DecompInterface()
o = DecompileOptions(); d.setOptions(o)
d.openProgram(currentProgram)
mon = ConsoleTaskMonitor()
fm = currentProgram.getFunctionManager()
hechas = 0
orden = [l.strip() for l in open(os.environ["CLASES"])]
for c in [x for x in sorted(por, key=lambda k: (orden.index(k.split(".")[0]) if k.split(".")[0] in orden else 9999, k))]:
    p = os.path.join(sal, c.replace("/", "_").replace("<", "(").replace(">", ")") + ".c")
    if os.path.exists(p): continue
    out = codecs.open(p + ".tmp", "w", "utf-8")
    for m in sorted(por[c], key=lambda x: x["Address"]):
        a = base.add(m["Address"])
        f = fm.getFunctionAt(a)
        if f is None:
            try: f = createFunction(a, None)
            except: f = None
        if f is None:
            out.write("// %s: sin funcion\n" % m["Name"]); continue
        r = d.decompileFunction(f, 20, mon)
        txt = r.getDecompiledFunction().getC() if r and r.getDecompiledFunction() else "// fallo\n"
        out.write("// 0x%x %s\n%s\n" % (m["Address"], m["Name"], txt))
        hechas += 1
    out.close(); os.rename(p + ".tmp", p)
print("decompiladas %d" % hechas)
