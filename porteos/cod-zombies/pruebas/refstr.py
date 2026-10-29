# Busca en la imagen (Thumb y ARM) los accesos PC-relativos (ldr rX,[pc,#n] + add rX,pc) a ciertas direcciones.
#   python3 -I refstr.py IMAGEN.bin BASE dir1 [dir2 ...]
import sys, struct
b = open(sys.argv[1], 'rb').read(); BASE = int(sys.argv[2], 0)
objs = {int(x, 0) for x in sys.argv[3:]}
LIM = min(len(b), 0x3dc000)
# Thumb
for o in range(0, LIM - 40, 2):
    h = struct.unpack_from('<H', b, o)[0]
    if (h & 0xf800) != 0x4800: continue
    rt = (h >> 8) & 7; a = BASE + o
    pool = ((a + 4) & ~3) + ((h & 0xff) << 2)
    if pool - BASE + 4 > len(b): continue
    w = struct.unpack_from('<I', b, pool - BASE)[0]
    for k in range(1, 24):
        h2 = struct.unpack_from('<H', b, o + 2 * k)[0]
        if h2 == (0x4478 | rt):
            tgt = (w + a + 2 * k + 4) & 0xffffffff
            if tgt in objs: print('thumb %x: ldr+add -> %x' % (a, tgt))
            break
# ARM
for o in range(0, LIM - 100, 4):
    w0 = struct.unpack_from('<I', b, o)[0]
    if (w0 & 0x0f7f0000) != 0x051f0000: continue
    rt = (w0 >> 12) & 15; a = BASE + o
    off = w0 & 0xfff; pool = a + 8 + (off if (w0 >> 23) & 1 else -off)
    if pool - BASE + 4 > len(b) or pool < BASE: continue
    w = struct.unpack_from('<I', b, pool - BASE)[0]
    for k in range(1, 24):
        w2 = struct.unpack_from('<I', b, o + 4 * k)[0]
        if (w2 & 0x0fff0ff0) == 0x008f0000 and (w2 & 15) == rt:   # add rd, pc, rt
            tgt = (w + a + 4 * k + 8) & 0xffffffff
            if tgt in objs: print('arm %x: ldr+add -> %x' % (a, tgt))
            break
