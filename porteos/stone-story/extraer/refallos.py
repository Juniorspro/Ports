# Vuelve a decompilar las funciones que fallaron ("// fallo") con mas tiempo
import os, re, codecs
from ghidra.app.decompiler import DecompInterface, DecompileOptions
from ghidra.util.task import ConsoleTaskMonitor
sal = os.environ["SALIDA"]
clases = [l.strip() for l in open(os.environ["CLASES"]) if l.strip()]
import json
BUENAS = json.load(open("/tmp/claude-0/ss/gh/dir_cpp2il.json"))
d = DecompInterface(); d.setOptions(DecompileOptions()); d.openProgram(currentProgram)
mon = ConsoleTaskMonitor(); base = currentProgram.getImageBase(); fm = currentProgram.getFunctionManager()
for c in clases:
    p = os.path.join(sal, c + ".c")
    if not os.path.exists(p): continue
    t = codecs.open(p, "r", "utf-8").read()
    def rehacer(m):
        a = int(m.group(1), 16)
        alt = [x for x in BUENAS.get(m.group(2), []) if x != a]
        if alt: a = alt[0]
        ad = base.add(a)
        f = fm.getFunctionAt(ad)
        if f is not None and f.getBody().getNumAddresses() < 8:
            removeFunction(f); f = None
        if f is None:
            disassemble(ad)
            f = createFunction(ad, None)
        if f is None: return m.group(0)
        r = d.decompileFunction(f, 60, mon)
        if r and r.getDecompiledFunction():
            return "// 0x%x %s\n%s\n" % (a, m.group(2), r.getDecompiledFunction().getC())
        d.dispose(); d.openProgram(currentProgram)
        return m.group(0)
    while True:
        m = re.search(r"// 0x([0-9a-f]+) (\S+)\n// fallo\n", t)
        if not m: break
        nuevo = rehacer(m)
        if nuevo == m.group(0): nuevo = nuevo.replace("// fallo", "// fallo2")
        t = t[:m.start()] + nuevo + t[m.end():]
        codecs.open(p, "w", "utf-8").write(t)
        print("hecha %s" % m.group(2))
    t2 = t
    print("%s: %d fallos quedan" % (c, t2.count("// fallo")))
