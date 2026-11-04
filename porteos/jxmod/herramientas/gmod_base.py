# El contenido base de Garry's Mod y Half-Life 2 que usan los addons sin traerlo (brazos c_arms, las armas c_/v_/w_ de HL2
# y de CS:S que GMod incluye, las manos de CS:S, munición y objetos, sprites, efectos, partículas, estelas, íconos de la
# interfaz y sonidos): se sacan de los .vpk de una instalación de GMod (archivo por archivo, sin ejecutar nada) y se
# arma una biblioteca para el juego (web/rb/gm_lib.*): un índice y los archivos en trozos; el juego baja sólo los
# que pide cada addon (con pedidos de rango) y los usa como un addon más, el último en prioridad.
# Qué entra: categorías fijas (todo lo de armas e items, los sprites/efectos/partículas/estelas chicos) y además todo lo
# que piden los addons reales de una carpeta de .gma (rutas en su Lua, en sus .vmt y en sus .mdl) y existe en los .vpk.
# Los .mdl llevan sus .vvd/.dx90.vtx/.phy y sus materiales; los .vmt, su $basetexture. Sin mapas de relieve (el juego no
# los usa) y las texturas de más de 512 px se achican quitando el nivel grande (los .vtf traen todos los niveles).
# uso: python3 -I gmod_base.py CARPETA_VPK CARPETA_GMA SALIDA_DIR [--bajar SCRIPT]
#   CARPETA_VPK: los *_dir.vpk (y ahí se bajan de a uno las partes *_NNN.vpk con SCRIPT, y se borran al terminar cada una)
import sys, os, re, json, gzip, struct, hashlib, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import source_mdl as SM

VPKDIR, GMADIR, SAL = sys.argv[1], sys.argv[2], sys.argv[3]
BAJAR = sys.argv[sys.argv.index('--bajar') + 1] if '--bajar' in sys.argv else None
CONJ = {   # nombre → (archivo _dir, ruta de adentro del RAR para bajar las partes)
    'gm': ('garrysmod_dir.vpk', 'GarrysMod/garrysmod/garrysmod_%03d.vpk'),
    'misc': ('hl2_misc_dir.vpk', 'GarrysMod/sourceengine/hl2_misc_%03d.vpk'),
    'tex': ('hl2_textures_dir.vpk', 'GarrysMod/sourceengine/hl2_textures_%03d.vpk'),
    'snd': ('hl2_sound_misc_dir.vpk', 'GarrysMod/sourceengine/hl2_sound_misc_%03d.vpk'),
}
def leer_dir(p):
    b = open(p, 'rb').read(); sig, ver, tree = struct.unpack_from('<III', b, 0); assert sig == 0x55aa1234
    o = 12 if ver == 1 else 28; out = {}
    def cs():
        nonlocal o; e = b.index(b'\0', o); s = b[o:e].decode('latin1'); o = e + 1; return s
    while True:
        ext = cs()
        if not ext: break
        while True:
            d = cs()
            if not d: break
            while True:
                n = cs()
                if not n: break
                crc, pre, ai, off, ln, term = struct.unpack_from('<IHHIIH', b, o); o += 18
                pd = b[o:o + pre]; o += pre
                r = ((d.strip() + '/') if d.strip() else '') + n + '.' + ext
                out[r.lower()] = (ai, off, ln, pd)
    return out
IDX = {k: leer_dir(os.path.join(VPKDIR, v[0])) for k, v in CONJ.items()}
def donde(r):
    for k in ('gm', 'misc', 'tex', 'snd'):
        if r in IDX[k]: return k
    return None

# ---- 1) qué se pide ----
pedidos = set()
PREF_TODO = ('models/weapons/', 'models/items/', 'materials/models/weapons/', 'materials/models/items/')
PREF_CHICO = ('materials/sprites/', 'materials/effects/', 'materials/particle/', 'materials/particles/', 'materials/trails/', 'materials/vgui/', 'materials/gui/', 'materials/decals/')
SON = ('sound/weapons/', 'sound/items/', 'sound/common/', 'sound/buttons/', 'sound/ambient/explosions/', 'sound/garrysmod/')
# (lo que no entra aunque lo pida un addon: modelos de jugador, texturas de pantalla completa y de linterna)
FUERA = re.compile(r'^models/player/|^materials/models/player/|^materials/effects/(flashlight|tp_eyefx|prisonmap|combine_binocoverlay|flicker)|^materials/vgui/(appchooser|chapters|logos|resource|maps)|^materials/console/|^materials/skybox/|^materials/overlays/|\.ani$')
for k in IDX:
    for r, (ai, off, ln, pd) in IDX[k].items():
        if FUERA.search(r): continue
        if r.startswith(PREF_TODO) and not r.endswith(('.sw.vtx', '.xbox.vtx', '.360.vtx', '.dx80.vtx')): pedidos.add(r)
        elif r.startswith(PREF_CHICO) and (r.endswith('.vmt') or (r.endswith('.vtf') and ln + len(pd) <= 400_000)): pedidos.add(r)
        elif r.startswith(SON) and r.endswith(('.wav', '.mp3', '.ogg')) and ln + len(pd) <= 1_500_000: pedidos.add(r)
# lo que piden los addons reales de la carpeta (sus rutas que no traen)
def gma_archivos(p):
    b = open(p, 'rb').read()
    if b[:1] == b']':   # (los del servidor de Steam vienen en LZMA)
        import lzma
        try: b = lzma.LZMADecompressor(format=lzma.FORMAT_ALONE).decompress(b)
        except Exception: return {}
    if b[:4] != b'GMAD': return {}
    o = 21
    while b[o] != 0: o = b.index(b'\0', o) + 1
    o += 1
    def cs():
        nonlocal o; e = b.index(b'\0', o); s = b[o:e].decode('utf-8', 'replace'); o = e + 1; return s
    cs(); cs(); cs(); o += 4; F = []
    while True:
        n = struct.unpack_from('<I', b, o)[0]; o += 4
        if n == 0: break
        f = cs(); sz = struct.unpack_from('<q', b, o)[0]; o += 12; F.append((f.lower(), sz))
    out = {}
    for f, sz in F: out[f] = b[o:o + sz]; o += sz
    return out
RE_STR = re.compile(rb'["\']([A-Za-z0-9_\-\./\\ ]{3,120})["\']')
cuenta = {}
def pedir_ref(s, A):
    s = s.lower().replace('\\', '/').strip().lstrip('/')
    cands = [s, 'materials/' + s, 'materials/' + s + '.vmt', 'materials/' + s + '.vtf', 'sound/' + s, 'models/' + s]
    for c in cands:
        if c in A: return
        if donde(c) and not FUERA.search(c): cuenta[c] = cuenta.get(c, 0) + 1; pedidos.add(c); return
nadd = 0
for f in sorted(os.listdir(GMADIR)):
    if not f.endswith('.gma'): continue
    A = gma_archivos(os.path.join(GMADIR, f)); nadd += 1
    for r, b in A.items():
        if r.endswith(('.lua', '.vmt', '.txt')):
            for m in RE_STR.finditer(b): pedir_ref(m.group(1).decode('latin1'), A)
        elif r.endswith('.mdl'):
            try:
                M = SM.Modelo(b)
                for t in M.texturas:
                    for c in M.carpetas or ['']:
                        rr = 'materials/' + (c.replace('\\', '/').strip('/') + '/' if c.strip('/\\') else '') + t.lower() + '.vmt'
                        rr = rr.lower()
                        if rr not in A and donde(rr) and not FUERA.search(rr): pedidos.add(rr); cuenta[rr] = cuenta.get(rr, 0) + 1
            except Exception: pass
print(nadd, 'addons revisados ·', len(cuenta), 'rutas que piden y están en GMod/HL2 ·', len(pedidos), 'pedidos en total', file=sys.stderr)

# ---- 2) leer de las partes (de a una) y seguir las referencias: .mdl → sus compañeros y materiales; .vmt → su textura ----
datos = {}
def compa(r):
    if r.endswith('.mdl'):
        b = r[:-4]
        for e in ('.vvd', '.phy', '.dx90.vtx'):
            if donde(b + e): pedidos.add(b + e)
        if not donde(b + '.dx90.vtx'):
            for e in ('.vtx', '.dx80.vtx', '.sw.vtx'):
                if donde(b + e): pedidos.add(b + e); break
def seguir(r, b):
    nuevos = set()
    if r.endswith('.mdl'):
        try:
            M = SM.Modelo(b)
            for t in M.texturas:
                for c in M.carpetas or ['']:
                    rr = ('materials/' + (c.replace('\\', '/').strip('/') + '/' if c.strip('/\\') else '') + t + '.vmt').lower()
                    if donde(rr): nuevos.add(rr)
        except Exception: pass
    elif r.endswith('.vmt'):
        s = b.decode('latin1', 'replace')
        for k in ('basetexture', 'basetexture2', 'include'):
            for m in re.finditer(r'"?\$?' + k + r'"?\s+"?([^"\n\r]+?)"?\s*(?:\n|\r|$)', s, re.I):
                v = m.group(1).strip().lower().replace('\\', '/').lstrip('/')
                v = re.sub(r'\.(vtf|vmt)$', '', v)
                for c in ('materials/' + v + '.vtf', 'materials/' + v + '.vmt', v if v.startswith('materials/') else None):
                    if c and donde(c): nuevos.add(c)
    return nuevos
def bajar_parte(k, ai):
    p = os.path.join(VPKDIR, os.path.basename(CONJ[k][1] % ai))
    if os.path.exists(p): return p, False
    if not BAJAR: raise SystemExit('falta ' + p)
    subprocess.run([BAJAR, CONJ[k][1] % ai, p], check=True)
    return p, True
for vuelta in range(4):
    for r in list(pedidos): compa(r)
    falta = [r for r in pedidos if r not in datos]
    if not falta: break
    por = {}
    for r in falta:
        k = donde(r)
        if not k: continue
        ai, off, ln, pd = IDX[k][r]
        if ai == 0x7fff: datos[r] = pd + b''; continue   # (todo en el _dir)
        por.setdefault((k, ai), []).append(r)
    for (k, ai) in sorted(por):
        p, bajado = bajar_parte(k, ai)
        with open(p, 'rb') as fh:
            for r in por[(k, ai)]:
                _, off, ln, pd = IDX[k][r]; fh.seek(off); datos[r] = pd + fh.read(ln)
        print('  parte', k, ai, len(por[(k, ai)]), 'archivos', file=sys.stderr)
        if bajado and k != 'gm': os.remove(p)
    for r in falta:
        if r in datos:
            for n in seguir(r, datos[r]): pedidos.add(n)

# ---- 3) achicar texturas grandes y sacar relieves; armar los paquetes ----
def vtf_tope(b, tope=512):
    try:
        if b[:4] != b'VTF\0': return b
        vmen = struct.unpack_from('<I', b, 8)[0]; hdr = struct.unpack_from('<I', b, 12)[0]
        w, h = struct.unpack_from('<HH', b, 16); fr = max(1, struct.unpack_from('<H', b, 24)[0]); fmt = struct.unpack_from('<i', b, 52)[0]; nmip = b[56]
        lfmt = struct.unpack_from('<i', b, 57)[0]; lw, lh = b[61], b[62]
        flags = struct.unpack_from('<I', b, 20)[0]
        if vmen >= 3 or flags & 0x4000 or max(w, h) <= tope or nmip < 2: return b   # (7.3+ trae recursos; los cubos, tal cual)
        bpp = {0: 4, 1: 4, 2: 3, 3: 3, 4: 2, 5: 1, 6: 2, 7: 1, 8: 1, 9: 3, 10: 3, 11: 4, 12: 4, 16: 4, 17: 2, 18: 2, 19: 2, 21: 2, 22: 2, 23: 4, 24: 8, 25: 8}
        def tam(f, x, y):
            if f in (13, 20): return max(1, (x + 3) // 4) * max(1, (y + 3) // 4) * 8
            if f in (14, 15): return max(1, (x + 3) // 4) * max(1, (y + 3) // 4) * 16
            return x * y * bpp.get(f, 4)
        p = hdr + (tam(lfmt, lw, lh) if lfmt >= 0 else 0)
        quitar = 0
        while max(w >> quitar, h >> quitar) > tope and nmip - quitar > 1: quitar += 1
        if not quitar: return b
        # los niveles van del más chico al más grande: se cortan los últimos "quitar"
        fin = p
        for m in range(nmip - 1, quitar - 1, -1): fin += tam(fmt, max(1, w >> m), max(1, h >> m)) * fr
        nb = bytearray(b[:fin]); struct.pack_into('<HH', nb, 16, max(1, w >> quitar), max(1, h >> quitar)); nb[56] = nmip - quitar
        return bytes(nb)
    except Exception: return b
lib = {}
for r, b in datos.items():
    if re.search(r'_(normal|bump|nrm|n)\.vtf$|_normal\d*\.vtf$|bumpmap|_ssbump', r): continue
    if FUERA.search(r): continue
    if r.endswith('.vtf'): b = vtf_tope(b, 512 if re.search(r'^materials/models/(weapons|items)/|c_arms|v_hands', r) else 256)
    if r.endswith('.vtf') and len(b) > 600_000: continue   # (lo enorme que queda: animaciones de muchos cuadros)
    lib[r] = b
# la biblioteca: los archivos (cada uno con gzip si conviene) en trozos de menos de 40 MB y un índice; el juego pide
# cada archivo con un pedido de rango (Range) cuando un addon lo necesita, sin bajar todo
TOPE = 40_000_000
trozos, idx, act, o = [], {}, bytearray(), 0
for r in sorted(lib):
    b = lib[r]; z = gzip.compress(b, 9, mtime=0); usar_z = len(z) < len(b) * 0.9; d = z if usar_z else b
    if len(act) + len(d) > TOPE and act: trozos.append(bytes(act)); act = bytearray()
    idx[r] = [len(trozos), len(act), len(d), 1 if usar_z else 0, len(b)]; act += d
if act: trozos.append(bytes(act))
h = hashlib.sha1(b''.join(trozos)).hexdigest()[:10]
for f in os.listdir(SAL):
    if re.match(r'^gm_lib\.[0-9a-f]+\.(idx|\d+\.bin)$', f) and not f.startswith('gm_lib.' + h): os.remove(os.path.join(SAL, f))
nombres = []
for k, t in enumerate(trozos): n = 'gm_lib.%s.%d.bin' % (h, k); open(os.path.join(SAL, n), 'wb').write(t); nombres.append(n)
j = json.dumps({'v': 1, 't': nombres, 'f': idx}, separators=(',', ':')).encode()
open(os.path.join(SAL, 'gm_lib.%s.idx' % h), 'wb').write(gzip.compress(j, 9, mtime=0))
tot = sum(len(t) for t in trozos)
print('gm_lib.%s.idx: %d archivos en %d trozos, %.1f MB (%.1f MB sin comprimir), índice %.0f KB' % (h, len(lib), len(trozos), tot / 1e6, sum(len(b) for b in lib.values()) / 1e6, len(gzip.compress(j)) / 1024))
print(json.dumps({'lib': 'gm_lib.%s.idx' % h}))
top = sorted(cuenta.items(), key=lambda x: -x[1])[:40]
print('lo más pedido por los addons:', ', '.join('%s×%d' % (r, n) for r, n in top), file=sys.stderr)
