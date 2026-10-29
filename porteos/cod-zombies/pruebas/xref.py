# Referencias a funciones por saltos directos (bl/blx/b) sobre el codigo descubierto (ver descenso.py).
#   python3 -I xref.py IMAGEN.bin BASE CODIGO.json CACHE.pkl dir1 [dir2 ...]
import sys, json, pickle, os, collections
from capstone import *
from capstone.arm import *
img = open(sys.argv[1], 'rb').read(); BASE = int(sys.argv[2], 0)
cache = sys.argv[4]
if not os.path.exists(cache):
    ins = json.load(open(sys.argv[3]))['insns']
    mdT = Cs(CS_ARCH_ARM, CS_MODE_THUMB); mdA = Cs(CS_ARCH_ARM, CS_MODE_ARM); mdT.detail = mdA.detail = True
    X = collections.defaultdict(list)
    for a, t, sz in ins:
        i = next(iter((mdT if t else mdA).disasm(img[a - BASE:a - BASE + sz], a, 1)), None)
        if not i or i.id not in (ARM_INS_B, ARM_INS_BL, ARM_INS_BLX, ARM_INS_CBZ, ARM_INS_CBNZ): continue
        if not i.operands or i.operands[-1].type != ARM_OP_IMM: continue
        X[i.operands[-1].imm].append((a, t, i.mnemonic))
    pickle.dump(dict(X), open(cache, 'wb'))
X = pickle.load(open(cache, 'rb'))
for x in sys.argv[5:]:
    t = int(x, 0)
    print('%x <-' % t, ['%x%s %s' % (a, 'T' if th else 'A', m) for a, th, m in X.get(t, [])][:30])
