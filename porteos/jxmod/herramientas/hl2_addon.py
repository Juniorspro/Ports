# arma un addon local (uso personal, fuera del repo) con un mapa de la copia de GMod 10 de archive.org y todo lo de HL2 que
# usa: las texturas del mundo (.vmt y sus .vtf), los props estáticos (.mdl/.vvd/.vtx/.phy y sus materiales)
# uso: python3 -I hl2_addon.py LISTA.json SALIDA RUTA_BSP_EN_EL_RAR
import sys, os, json, re, struct, urllib.request
L = json.load(open(sys.argv[1])); SAL = sys.argv[2].rstrip('/'); BSP = sys.argv[3]
IDX = {x[0].lower(): x for x in L}
def bajar(rel, dst=None):
    x = IDX.get(rel.lower())
    # (lo de HL2 Deathmatch está en hl2mp/: si no está en hl2/, ahí)
    if not x and '/hl2/' in rel: x = IDX.get(rel.lower().replace('/hl2/', '/hl2mp/', 1))
    if not x: return None
    dst = dst or os.path.join(SAL, re.split(r'/hl2(?:mp)?/', x[0], 1)[1].lower() if re.search(r'/hl2(?:mp)?/', x[0]) else os.path.basename(x[0]))
    if os.path.exists(dst) and os.path.getsize(dst) == x[1]: return dst
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    url = 'https:' + x[2] if x[2].startswith('//') else x[2]
    for _ in range(4):
        try:
            b = urllib.request.urlopen(url, timeout=120).read()
            if len(b) == x[1]: open(dst, 'wb').write(b); return dst
        except Exception as e: print('  reintento', x[0], str(e)[:80])
    return None
nombre = os.path.basename(BSP)
bsp = bajar(BSP, os.path.join(SAL, 'maps', nombre)); assert bsp, 'no se bajó el mapa'
d = open(bsp, 'rb').read(); assert d[:4] == b'VBSP'
lump = lambda i: struct.unpack_from('<iiii', d, 8 + i * 16)
o43, n43, _, _ = lump(43); o44, n44, _, _ = lump(44)
tab = struct.unpack_from('<%di' % (n44 // 4), d, o44)
texs = sorted({d[o43 + t:d.index(b'\0', o43 + t)].decode('latin1').lower().replace('\\', '/') for t in tab})
# (los materiales del pak del mapa con cubemaps: maps/<mapa>/x_y_z → el original)
texs = sorted({re.sub(r'^maps/[^/]+/', '', re.sub(r'_-?\d+_-?\d+_-?\d+$', '', t)) for t in texs})
# los props estáticos (el lump de juego, 'sprp')
o35, n35, _, _ = lump(35); modelos = []
ng = struct.unpack_from('<i', d, o35)[0]
for g in range(ng):
    gid, flags, ver, fo, fl = struct.unpack_from('<4sHHii', d, o35 + 4 + g * 16)
    if gid[::-1] == b'sprp' or gid == b'prps':
        nd = struct.unpack_from('<i', d, fo)[0]
        modelos = [d[fo + 4 + i * 128: fo + 4 + i * 128 + 128].split(b'\0')[0].decode('latin1').lower().replace('\\', '/') for i in range(nd)]
# (y los de las entidades: prop_physics, prop_dynamic, los que se rompen…)
o0, n0, _, _ = lump(0)
modelos = sorted(set(modelos) | {m.lower().replace('\\', '/') for m in re.findall(r'"model"\s+"(models/[^"]+\.mdl)"', d[o0:o0 + n0].decode('latin1'), re.I)})
print(nombre, len(texs), 'texturas', len(modelos), 'props')
vistos = set(); falta = []
def material(m):
    m = m.lower().replace('\\', '/').removeprefix('materials/').removesuffix('.vmt')
    if m in vistos: return
    vistos.add(m)
    v = bajar('Garrys_Mod_10/hl2/materials/' + m + '.vmt')
    if not v: falta.append(m); return
    kv = open(v, 'r', errors='ignore').read()
    for k, t in re.findall(r'"?\$(basetexture2?|bumpmap|bumpmap2|envmapmask|detail|blendmodulatetexture|normalmap|dudvmap|refracttexture|reflecttexture|texture2)"?\s+"?([^"\s]+)"?', kv, re.I):
        if t.startswith('_rt_') or t.lower() == 'env_cubemap': continue
        bajar('Garrys_Mod_10/hl2/materials/' + t.lower().replace('\\', '/').removesuffix('.vtf') + '.vtf')
    for inc in re.findall(r'include\s+"([^"]+)"', kv, re.I): material(inc)
    for fb in re.findall(r'"?\$(?:bottommaterial|underwateroverlay)"?\s+"?([^"\s]+)"?', kv, re.I): material(fb)
for t in texs: material(t)
for mdl in modelos:
    b = 'Garrys_Mod_10/hl2/' + mdl.removesuffix('.mdl')
    got = [bajar(b + e) for e in ('.mdl', '.vvd', '.dx90.vtx', '.dx80.vtx', '.phy')]
    if not got[0]: falta.append(mdl); continue
    # (los materiales del modelo: las carpetas y los nombres de texturas del .mdl —texturas: offset 204, carpetas: 212—)
    m = open(got[0], 'rb').read()
    nt, ot, nc, oc = struct.unpack_from('<iiii', m, 204)
    nombres = [m[struct.unpack_from('<i', m, ot + i * 64)[0] + ot + i * 64:].split(b'\0')[0].decode('latin1') for i in range(nt)]
    carpetas = [m[struct.unpack_from('<i', m, oc + i * 4)[0]:].split(b'\0')[0].decode('latin1') for i in range(nc)]
    for n in nombres:
        for c in carpetas:
            r = (c.replace('\\', '/').strip('/') + '/' + n).lower()
            if IDX.get(('Garrys_Mod_10/hl2/materials/' + r + '.vmt').lower()) or IDX.get(('Garrys_Mod_10/hl2mp/materials/' + r + '.vmt').lower()): material(r); break
tam = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(SAL) for f in fs)
print('listo:', len(vistos), 'materiales,', len(modelos), 'props,', round(tam / 1048576, 1), 'MB; faltan', len(falta), falta[:12])
