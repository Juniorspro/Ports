# Reemplaza _StringLiteral_N por su texto en los .c decompilados (copia en c2/)
import sys, os, re, json
d = json.load(open(sys.argv[1], encoding='utf-8'))
lit = {i + 1: s['Value'] for i, s in enumerate(d['ScriptString'])}
ent, sal = sys.argv[2], sys.argv[3]; os.makedirs(sal, exist_ok=True)
rx = re.compile(r'&?_?StringLiteral_(\d+)')
for f in os.listdir(ent):
    if not f.endswith('.c'): continue
    q = os.path.join(sal, f)
    if os.path.exists(q) and os.path.getmtime(q) >= os.path.getmtime(os.path.join(ent, f)): continue
    t = open(os.path.join(ent, f), encoding='utf-8').read()
    t = rx.sub(lambda m: json.dumps(lit.get(int(m.group(1)), '?'), ensure_ascii=False), t)
    # quitar ruido: inicializacion de metadatos y chequeos de cctor
    t = re.sub(r'  if \(\(bRam[0-9a-f]+ & 1\) == 0\) \{\n(    func_0x[0-9a-f]+\([^;]*\);\n)*    bRam[0-9a-f]+ = 1;\n  \}\n', '', t)
    t = re.sub(r'\n *if \(\([A-Za-z0-9_]+_TypeInfo->_2\)\.cctor_finished == 0\) \{\n *func_0x[0-9a-f]+\([^;]*\);\n *\}', '', t)
    t = re.sub(r'/\* WARNING: [^*]*\*/\n', '', t)
    open(q, 'w', encoding='utf-8').write(t)
