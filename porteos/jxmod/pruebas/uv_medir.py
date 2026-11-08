# Mide la pérdida de precisión de las UV de las caras de un BSP de Source, calculadas como juego/gmod_bsp.js
# (u = (s·p + s.w) / ancho de texdata; cada cara corrida por el entero del mínimo: gbspUVcorr).
# Para cada cara: paso de cuantización del número (16 bits = mediump en GPU de celu; 32 bits = highp) en el
# |u| y |v| más grande de la cara, pasado a téxeles de la textura (con el tope de tamaño del celu).
#   q >= 1   → cada escalón salta 1 téxel o más: franjas estiradas (lo que se ve en la captura)
#   q >= .25 → titileo / bordes serruchados
# Resultado ponderado por área (cuánto del piso/paredes del mapa se ve mal).
# uso: python3 medir_uv.py mapa.bsp [tope_px=1024] [--mc]   (--mc: como un mapa tipo Minecraft: 16 px, bloque de 64 u)
import struct, sys, math, lzma
MCPX = 16; MCPX_PIX = 1.0; CENTRO = '--centro' in sys.argv

def lumps(b):
    assert b[:4] == b'VBSP', 'no es VBSP'
    L = []
    for i in range(64):
        ofs, ln, ver, cc = struct.unpack_from('<iiii', b, 8 + i * 16)
        d = b[ofs:ofs + ln]
        if d[:4] == b'LZMA':   # lump comprimido de Source: 'LZMA', tamaño real, tamaño lzma, 5 bytes de propiedades
            real, zl = struct.unpack_from('<II', d, 4); pr = d[12:17]
            lc = pr[0] % 9; r = pr[0] // 9; lp = r % 5; pb = r // 5; ds = struct.unpack_from('<I', pr, 1)[0]
            dec = lzma.LZMADecompressor(format=lzma.FORMAT_RAW, filters=[{'id': lzma.FILTER_LZMA1, 'dict_size': ds, 'lc': lc, 'lp': lp, 'pb': pb}])
            d = dec.decompress(d[17:17 + zl], max_length=real)
        L.append(d)
    return L

def paso(x, mant):   # distancia entre dos números representables cerca de |x| (mant = bits de mantisa: 10 en 16 bits, 23 en 32)
    x = abs(x)
    if x < 2 ** -14: return 2 ** (-14 - mant)
    return 2 ** (math.floor(math.log2(x)) - mant)

def medir(ruta, tope=1024, mc=False):
    b = open(ruta, 'rb').read(); L = lumps(b)
    V = [struct.unpack_from('<fff', L[3], i * 12) for i in range(len(L[3]) // 12)]
    TI = [struct.unpack_from('<8f8fii', L[6], i * 72) for i in range(len(L[6]) // 72)]
    TD = [struct.unpack_from('<3fiiiii', L[2], i * 32) for i in range(len(L[2]) // 32)]
    ST = [struct.unpack_from('<i', L[44], i * 4)[0] for i in range(len(L[44]) // 4)]
    SD = L[43]
    nom = lambda sid: SD[ST[sid]:SD.index(b'\0', ST[sid])].decode('latin1').lower() if 0 <= sid < len(ST) else ''
    E = [struct.unpack_from('<HH', L[12], i * 4) for i in range(len(L[12]) // 4)]
    SE = [struct.unpack_from('<i', L[13], i * 4)[0] for i in range(len(L[13]) // 4)]
    tot = 0.0; malo16 = 0.0; tit16 = 0.0; malo32 = 0.0; vert16 = 0.0; n = 0; maxu = 0.0
    for f in range(len(L[7]) // 56):
        fe, ne, tix = struct.unpack_from('<ihh', L[7], f * 56 + 4)
        if tix < 0 or tix >= len(TI): continue
        t = TI[tix]; fl, tdi = t[16], t[17]
        if fl & (0x4 | 0x80 | 0x40 | 0x100 | 0x200): continue          # cielo, nodraw, trigger, hint, skip
        nm = nom(TD[tdi][3]) if 0 <= tdi < len(TD) else ''
        if nm.startswith('tools/'): continue
        tw, th = (TD[tdi][4] or 512, TD[tdi][5] or 512) if 0 <= tdi < len(TD) else (512, 512)
        pts = []
        for k in range(ne):
            e = SE[fe + k]; ed = E[abs(e)]; pts.append(V[ed[0] if e >= 0 else ed[1]])
        if len(pts) < 3: continue
        # área (para ponderar)
        ax = ay = az = 0.0
        for k in range(1, len(pts) - 1):
            a, c, d = pts[0], pts[k], pts[k + 1]
            u1 = (c[0] - a[0], c[1] - a[1], c[2] - a[2]); u2 = (d[0] - a[0], d[1] - a[1], d[2] - a[2])
            ax += u1[1] * u2[2] - u1[2] * u2[1]; ay += u1[2] * u2[0] - u1[0] * u2[2]; az += u1[0] * u2[1] - u1[1] * u2[0]
        area = 0.5 * math.sqrt(ax * ax + ay * ay + az * az)
        if area <= 0: continue
        s, tt = t[0:4], t[4:8]
        if mc:   # tipo Minecraft: misma dirección de la textura, pero 16 px y 1 repetición cada 64 unidades
            ls = math.sqrt(s[0] ** 2 + s[1] ** 2 + s[2] ** 2) or 1; lt = math.sqrt(tt[0] ** 2 + tt[1] ** 2 + tt[2] ** 2) or 1
            uvs = [((s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) / ls / 64, (tt[0] * p[0] + tt[1] * p[1] + tt[2] * p[2]) / lt / 64) for p in pts]
            tw = th = MCPX
        else:
            uvs = [((s[0] * p[0] + s[1] * p[1] + s[2] * p[2] + s[3]) / tw, (tt[0] * p[0] + tt[1] * p[1] + tt[2] * p[2] + tt[3]) / th) for p in pts]
        mnu = min(u for u, v in uvs); mxu = max(u for u, v in uvs); mnv = min(v for u, v in uvs); mxv = max(v for u, v in uvs)
        if CENTRO and (mxu - mnu > 2 or mxv - mnv > 2): du = math.floor((mnu + mxu) / 2); dv = math.floor((mnv + mxv) / 2)   # gbspUVcorr nuevo
        else: du = math.floor(mnu); dv = math.floor(mnv)   # gbspUVcorr de antes
        uvs = [(u - du, 1 - (v - dv)) for u, v in uvs]
        mu = max(abs(u) for u, v in uvs); mv = max(abs(v) for u, v in uvs); maxu = max(maxu, mu, mv)
        ew, eh = min(tw, tope), min(th, tope)   # téxeles reales en el celu (la textura se achica al tope)
        q16 = max(paso(mu, 10) * ew, paso(mv, 10) * eh)
        q32 = max(paso(mu, 23) * ew, paso(mv, 23) * eh)
        tot += area; n += 1
        if q16 >= 2: malo16 += area
        if q16 >= 0.5: tit16 += area
        if q32 >= 0.25: malo32 += area
        if q16 / 2 >= MCPX_PIX: vert16 += area   # vértice en medio float: corrimiento de medio paso >= 1 'píxel' de la textura
    pc = lambda x: 100.0 * x / tot if tot else 0.0
    return dict(caras=n, estirado16=pc(malo16), titileo16=pc(tit16), mal32=pc(malo32), vertice16=pc(vert16), umax=maxu)

if __name__ == '__main__':
    ruta = sys.argv[1]; tope = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 1024; mc = '--mc' in sys.argv
    if '--mcpx' in sys.argv: MCPX = int(sys.argv[sys.argv.index('--mcpx') + 1])
    globals()['MCPX'] = MCPX; globals()['MCPX_PIX'] = (MCPX / 16.0) if mc else 1.0
    r = medir(ruta, tope, mc)
    print('%-26s %s caras=%5d  |u|max=%7.1f  ANTES(16b): franjas %5.1f%%  degradado %5.1f%%  |  DESPUES(32b): mal %4.2f%%  |  resto vértice>=1px %5.1f%%'
          % (ruta.split('/')[-1][:26], 'MC ' if mc else '   ', r['caras'], r['umax'], r['estirado16'], r['titileo16'], r['mal32'], r['vertice16']))
