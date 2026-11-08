# Vértices de las caras de un BSP cuya UV (calculada como gmod_bsp.js, con el gbspUVcorr nuevo) queda mal guardada en
# medio float por gmF2H: el viejo (acarreo con "o") y el nuevo (acarreo sumado). Mal = error > 0,01 UV.
import sys, struct, math
import uv_medir as M
def f32bits(v): return struct.unpack('<I', struct.pack('<f', v))[0]
def f2h(v, nuevo):
    x = f32bits(v); s = (x >> 16) & 0x8000; e = ((x >> 23) & 0xff) - 112; m = x & 0x7fffff
    if e <= 0: return s
    if e >= 31: return s | (0x7bff if nuevo else 0x7c00)
    if nuevo: h = (e << 10) + ((m + 0x1000) >> 13); return s | min(h, 0x7bff)
    return s | (e << 10) | ((m + 0x1000) >> 13)
def dec(h):
    sg = -1 if h & 0x8000 else 1; e = (h >> 10) & 0x1f; m = h & 0x3ff
    if e == 31: return float('inf')
    return sg * (m * 2 ** -24 if e == 0 else (1 + m / 1024) * 2 ** (e - 15))
ruta = sys.argv[1]; b = open(ruta, 'rb').read(); L = M.lumps(b)
V = [struct.unpack_from('<fff', L[3], i * 12) for i in range(len(L[3]) // 12)]
TI = [struct.unpack_from('<8f8fii', L[6], i * 72) for i in range(len(L[6]) // 72)]
TD = [struct.unpack_from('<3fiiiii', L[2], i * 32) for i in range(len(L[2]) // 32)]
E = [struct.unpack_from('<HH', L[12], i * 4) for i in range(len(L[12]) // 4)]
SE = [struct.unpack_from('<i', L[13], i * 4)[0] for i in range(len(L[13]) // 4)]
res = {False: [0, 0, 0.0], True: [0, 0, 0.0]}; nv = 0
for f in range(len(L[7]) // 56):
    fe, ne, tix = struct.unpack_from('<ihh', L[7], f * 56 + 4)
    if tix < 0 or tix >= len(TI): continue
    t = TI[tix]
    if t[16] & (0x4 | 0x80 | 0x40 | 0x100 | 0x200): continue
    tdi = t[17]; tw, th = (TD[tdi][4] or 512, TD[tdi][5] or 512) if 0 <= tdi < len(TD) else (512, 512)
    pts = []
    for k in range(ne): e = SE[fe + k]; ed = E[abs(e)]; pts.append(V[ed[0] if e >= 0 else ed[1]])
    if len(pts) < 3: continue
    s, tt = t[0:4], t[4:8]
    uvs = [((s[0]*p[0]+s[1]*p[1]+s[2]*p[2]+s[3]) / tw, (tt[0]*p[0]+tt[1]*p[1]+tt[2]*p[2]+tt[3]) / th) for p in pts]
    mnu = min(u for u, v in uvs); mxu = max(u for u, v in uvs); mnv = min(v for u, v in uvs); mxv = max(v for u, v in uvs)
    ancha = mxu - mnu > 2 or mxv - mnv > 2
    du = math.floor((mnu + mxu) / 2 if ancha else mnu); dv = math.floor((mnv + mxv) / 2 if ancha else mnv)
    uvs = [(u - du, 1 - (v - dv)) for u, v in uvs]; nv += len(uvs)
    for nuevo in (False, True):
        malos = 0; peor = 0.0
        for u, v in uvs:
            for x in (u, v):
                fx = struct.unpack('<f', struct.pack('<f', x))[0]; err = abs(dec(f2h(x, nuevo)) - fx)
                if err > 0.01: malos += 1; peor = max(peor, err)
        if malos: r = res[nuevo]; r[0] += malos; r[1] += 1; r[2] = max(r[2], peor)
print('%-22s vértices=%6d  VIEJO: valores mal %4d en %4d caras (peor %.4g UV)  |  NUEVO: %d en %d caras' % (ruta.split('/')[-1][:22], nv, res[False][0], res[False][1], res[False][2], res[True][0], res[True][1]))
