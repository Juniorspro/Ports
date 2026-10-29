# Busca por fuerza bruta cualquier BL/BLX/B (Thumb-2 y ARM) cuyo destino sea uno de los dados (sin depender del descenso).
#   python3 -I bl_scan.py IMAGEN.bin BASE dir1 [dir2 ...]
import sys, struct
b = open(sys.argv[1], 'rb').read(); BASE = int(sys.argv[2], 0)
objs = {int(x, 0) & ~1 for x in sys.argv[3:]}
LIM = min(len(b), 0x3dc000)
res = {t: [] for t in objs}
for o in range(0, LIM - 4, 2):
    h1, h2 = struct.unpack_from('<HH', b, o)
    if (h1 & 0xf800) == 0xf000 and (h2 & 0xc000) == 0xc000 or ((h1 & 0xf800) == 0xf000 and (h2 & 0xd000) == 0x9000):
        s = (h1 >> 10) & 1; j1 = (h2 >> 13) & 1; j2 = (h2 >> 11) & 1
        i1 = (j1 ^ s) ^ 1; i2 = (j2 ^ s) ^ 1
        imm = (s << 24) | (i1 << 23) | (i2 << 22) | ((h1 & 0x3ff) << 12) | ((h2 & 0x7ff) << 1)
        if imm & (1 << 24): imm -= 1 << 25
        a = BASE + o
        if (h2 & 0x1000) == 0: t = (((a + 4) & ~3) + imm) & ~3        # blx
        else: t = a + 4 + imm
        if t in objs: res[t].append('T%x' % a)
    if o % 4 == 0:
        w = struct.unpack_from('<I', b, o)[0]
        if (w & 0x0e000000) == 0x0a000000:
            imm = w & 0xffffff
            if imm & 0x800000: imm -= 0x1000000
            t = BASE + o + 8 + imm * 4
            if (w >> 28) == 15: t += ((w >> 24) & 1) * 2
            if t in objs: res[t].append('A%x' % (BASE + o))
for t, l in res.items(): print('%x <- %d: %s' % (t, len(l), ' '.join(l[:40])))
