# Paquete nativo de mapas (web/rb/gm_mapas.*): gm_construct y gm_flatgrass de Garry's Mod 10 con todo lo que piden
# para verse completos: los .vmt de las caras (la tabla de texturas del BSP, lumps 43/44) y los que incluyen los "patch"
# del pakfile, el cielo (materials/skybox/<cielo>{bk,dn,ft,lf,rt,up}), las calcomanías (infodecal), el sol y el pasto
# (detail sprites), el agua con su normal/dudv y su material de abajo, y los props (los estáticos del lump sprp y los
# prop_* puestos como entidades, menos los vehículos) con su .vvd/.vtx/.phy y sus materiales. De cada .vmt se sigue
# $basetexture/$basetexture2 como lo lee el juego (juego/gmod_formatos.js: sin relieves, máscaras ni cubemaps, y lo de
# los bloques de DX8 sólo si arriba no está). Lo que ya está en el pakfile del mapa o en gm_lib no se repite.
# Mismo formato que gm_lib (así lo lee el mismo lector): un índice gzip JSON {"v":1,"t":[trozos],"f":{ruta:[trozo,
# desde,largo,gz,largo_original]}} y los archivos en trozos de menos de 40 MB (cada uno con gzip si ahorra 10 % o más).
# gm_construct: si está el de GMod 13 (SCRATCH/src/gm_construct_13.bsp) y todo lo que pide existe en GMod 10 (o en el
# pakfile, o en gm_lib), va ése; si no, va el de GMod 10 como maps/gm_construct.bsp y el de 13 como gm_construct_13.bsp.
# Origen: el RAR de Garry's Mod 10 en archive.org, archivo por archivo (archive.org los sirve sueltos desde el RAR);
# lo bajado es sólo datos: no se ejecuta nada, se lee con este script (correrlo con python3 -I).
# uso: python3 -I paquete_mapas.py SCRATCH SALIDA [--bajar]
#   SCRATCH: rar_lista.json (el listado del RAR: [[ruta, tamaño, url], ...]), dl/ (lo bajado, con las rutas del RAR sin
#            "Garrys_Mod_10/") y, si está, src/gm_construct_13.bsp
#   SALIDA:  web/rb (se lee gm_lib.*.idx y sus trozos para no repetir; se escriben gm_mapas.<hash>.idx y .N.bin y se
#            borran los gm_mapas.* viejos)
#   --bajar: baja a SCRATCH/dl lo que falte (≤ 6 a la vez, con reintentos) y verifica los tamaños contra el listado
import sys, os, re, io, json, gzip, struct, hashlib, zipfile, time, urllib.request, concurrent.futures as CF

SCR, SAL = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
BAJAR = '--bajar' in sys.argv
DL = os.path.join(SCR, 'dl')
C13 = os.path.join(SCR, 'src', 'gm_construct_13.bsp')
ORIGEN = '//archive.org/download/garrys-mod-10/Garrys_Mod_10.rar/'
MAPAS10 = ['gm_construct', 'gm_flatgrass']
TOPE = 40_000_000

def norm(r): return re.sub(r'/+', '/', r.replace('\\', '/').lower()).lstrip('/')

# ---- el listado del RAR: ruta del juego → (ruta en el RAR, tamaño, url). Rutas de búsqueda de GMod 10 (su gameinfo.txt):
# garrysmod10 y después hl2; los addons de garrysmod10/addons/* al final (GMod 10 también los monta)
RAR = {}
def _prio(rel):
    if rel.startswith('garrysmod10/addons/'):
        p = rel.split('/', 3); return (2, p[3]) if len(p) == 4 else None
    for k, raiz in enumerate(('garrysmod10/', 'hl2/')):
        if rel.startswith(raiz): return (k, rel[len(raiz):])
    return None
for ruta, tam, url in json.load(open(os.path.join(SCR, 'rar_lista.json'))):
    if not ruta.startswith('Garrys_Mod_10/') or not url.startswith(ORIGEN): continue
    rel = ruta[len('Garrys_Mod_10/'):]
    if any(p in ('', '.', '..') for p in rel.split('/')): continue
    x = _prio(rel)
    if not x: continue
    k = norm(x[1])
    if k not in RAR or RAR[k][0] > x[0]: RAR[k] = (x[0], rel, tam, 'https:' + url)

def local(r):
    x = RAR[r]; p = os.path.join(DL, x[1])
    return p if os.path.isfile(p) and os.path.getsize(p) == x[2] else None

# ---- la biblioteca base (gm_lib): lo que ya está no se repite (y se lee para seguir sus materiales y texturas)
LIBI = sorted((f for f in os.listdir(SAL) if re.match(r'^gm_lib\.[0-9a-f]+\.idx$', f)), key=lambda f: os.path.getmtime(os.path.join(SAL, f)))
LIB = json.loads(gzip.decompress(open(os.path.join(SAL, LIBI[-1]), 'rb').read())) if LIBI else {'t': [], 'f': {}}
def lib_leer(r):
    x = LIB['f'][r]
    with open(os.path.join(SAL, LIB['t'][x[0]]), 'rb') as fh: fh.seek(x[1]); d = fh.read(x[2])
    return gzip.decompress(d) if x[3] else d

# ---- BSP: entidades, tabla de texturas (43/44), props estáticos (sprp del lump 35), pakfile (40)
class BSP:
    def __init__(self, b):
        assert b[:4] == b'VBSP', 'no es un BSP'
        self.b = b; self.version = struct.unpack_from('<i', b, 4)[0]
        self.L = [struct.unpack_from('<iiii', b, 8 + 16 * i) for i in range(64)]
    def lump(self, i):
        o, n, _, _ = self.L[i]; d = self.b[o:o + n]
        if d[:4] == b'LZMA': raise ValueError('lump %d comprimido (LZMA)' % i)
        return d
    def entidades(self):
        out = []
        for m in re.finditer(r'\{([^{}]*)\}', self.lump(0).decode('latin-1')):
            e = {}
            for k, v in re.findall(r'"([^"]*)"\s+"([^"]*)"', m.group(1)): e.setdefault(k.lower(), v)
            out.append(e)
        return out
    def texturas(self):
        d, t = self.lump(43), self.lump(44); out = []
        for i in range(len(t) // 4):
            o = struct.unpack_from('<i', t, 4 * i)[0]; out.append(d[o:d.index(b'\0', o)].decode('latin-1'))
        return out
    def props(self):
        d = self.lump(35); out = []
        for i in range(struct.unpack_from('<i', d, 0)[0]):
            gid, _, _, fo, fl = struct.unpack_from('<iHHii', d, 4 + 16 * i)
            if gid != 0x73707270: continue   # 'sprp'
            g = self.b[fo:fo + fl]
            if g[:4] == b'LZMA': raise ValueError('sprp comprimido (LZMA)')
            n = struct.unpack_from('<i', g, 0)[0]
            out += [g[4 + 128 * k:132 + 128 * k].split(b'\0')[0].decode('latin-1') for k in range(n)]
        return out
    def pak(self):
        z = zipfile.ZipFile(io.BytesIO(self.lump(40)))
        return {norm(n): z.read(n) for n in z.namelist() if not n.endswith('/')}

# ---- .vmt (KeyValues): el shader y cada clave con los bloques donde está
def vmt_leer(b):
    T = []   # (0 texto / 1 llave / 2 condición sin comillas como [$X360]); "" cuenta como valor; los comentarios // no
    for m in re.finditer(r'"([^"]*)"|([{}])|//[^\n]*|([^\s{}"]+)', b.decode('latin-1')):
        if m.group(2): T.append((1, m.group(2)))
        elif m.group(1) is not None: T.append((0, m.group(1)))
        elif m.group(3) is not None: T.append((2 if re.match(r'^\[.*\]$', m.group(3)) else 0, m.group(3)))
    if len(T) < 2 or T[0][0] or T[1] != (1, '{'): return '', []
    cond = lambda t: t[0] == 2
    shader, kv, pila, i = T[0][1].lower(), [], [], 2
    while i < len(T):
        if T[i][0] == 1:
            if T[i][1] == '}':
                if not pila: break
                pila.pop()
            i += 1; continue
        if cond(T[i]): i += 1; continue
        j = i + 1
        while j < len(T) and cond(T[j]): j += 1
        if j < len(T) and T[j] == (1, '{'): pila.append(T[i][1].lower()); i = j + 1
        elif j < len(T) and T[j][0] == 0: kv.append((tuple(pila), T[i][1].lower(), T[j][1])); i = j + 1
        else: i = j
    return shader, kv
def vmt_valores(kv, claves):
    """los valores de esas claves como los toma el juego (juego/gmod_formatos.js): los de arriba (y los insert/replace de
    un patch); de los bloques condicionales o de otro shader ("LightmappedGeneric_DX8", ">=DX90"...) sólo si arriba no está"""
    raiz, cond = {}, {}
    for blq, k, v in kv:
        b = [x for x in blq if x not in ('insert', 'replace')]
        if not b: raiz.setdefault(k, []).append(v)
        elif b[0] != 'proxies': cond.setdefault(k, []).append(v)
    return [(k, v) for k in claves for v in (raiz.get(k) or cond.get(k, []))]
def tex_ruta(v):
    v = norm(v.strip())
    if v.startswith('materials/'): v = v[10:]
    v = re.sub(r'\.vtf$', '', v)
    return None if not v or v.startswith('_rt_') or v == 'env_cubemap' else 'materials/' + v + '.vtf'
def mat_ruta(v):
    v = norm(v.strip())
    if not v.startswith('materials/'): v = 'materials/' + v
    return re.sub(r'\.vmt$', '', v) + '.vmt'

# ---- .mdl: texturas, carpetas de materiales (cdmaterials)
def mdl_texturas(b):
    assert b[:4] == b'IDST', 'no es un .mdl'
    ntex, txi, ncd, cdi = struct.unpack_from('<4i', b, 204)
    cs = lambda o: b[o:b.index(b'\0', o)].decode('latin-1')
    tex = [cs(txi + k * 64 + struct.unpack_from('<i', b, txi + k * 64)[0]) for k in range(ntex)]
    cds = [cs(struct.unpack_from('<i', b, cdi + k * 4)[0]) for k in range(ncd)]
    return tex, cds
COMPA_VTX = ('.dx90.vtx', '.vtx', '.dx80.vtx', '.sw.vtx')

# ---- resolver lo que pide un mapa: cada ruta sale del pakfile, de gm_lib, del RAR (a bajar) o falta
class Resolutor:
    def __init__(self, pak):
        self.pak = pak; self.de = {}; self.faltan = {}; self.pend = set(); self.rar = set()
        self.cuenta = {'vmt': set(), 'vtf': set(), 'mdl': set()}
    def donde(self, r):
        return 'pak' if r in self.pak else 'lib' if r in LIB['f'] else 'rar' if r in RAR else None
    def tomar(self, r, quien, leer=True):
        """marca la ruta; devuelve su contenido si hace falta seguirla (o None)"""
        d = self.donde(r)
        if not d: self.faltan.setdefault(r, quien); return None
        self.de[r] = d
        if d == 'rar':
            self.rar.add(r); p = local(r)
            if not p: self.pend.add(r); return None
        if not leer: return None
        return self.pak[r] if d == 'pak' else lib_leer(r) if d == 'lib' else open(local(r), 'rb').read()
    def shader(self, r, prof=0):
        b = self.pak.get(r) if r in self.pak else lib_leer(r) if r in LIB['f'] else open(local(r), 'rb').read() if r in RAR and local(r) else None
        if b is None or prof > 6: return ''
        sh, kv = vmt_leer(b)
        if sh != 'patch': return sh
        inc = vmt_valores(kv, ('include',))
        return self.shader(mat_ruta(inc[0][1]), prof + 1) if inc else ''
    def vtf(self, r, quien):
        if r in self.de or r in self.faltan: return
        self.cuenta['vtf'].add(r); self.tomar(r, quien, leer=False)
    def vmt(self, r, quien):
        if r in self.de or r in self.faltan: return
        self.cuenta['vmt'].add(r)
        b = self.tomar(r, quien)
        if b is None: return
        sh, kv = vmt_leer(b)
        agua = self.shader(r).startswith('water')   # (el agua: también su normal/dudv y el material de abajo)
        for k, v in vmt_valores(kv, ('$basetexture', '$basetexture2', '$texture2') + (('$normalmap', '$dudvmap', '$bumpmap') if agua else ())):
            t = tex_ruta(v)
            if t: self.vtf(t, r)
        for k, v in vmt_valores(kv, ('include',) + (('$bottommaterial', '$underwateroverlay') if agua else ())):
            self.vmt(mat_ruta(v), r)
    def mdl(self, m, quien):
        m = norm(m)
        if m in self.de or m in self.faltan: return
        self.cuenta['mdl'].add(m)
        b = self.tomar(m, quien)
        d = self.de.get(m)
        base, F = m[:-4], (RAR if d == 'rar' else LIB['f'] if d == 'lib' else self.pak if d == 'pak' else None)
        if F is not None:   # sus compañeros, del mismo lugar que el .mdl (no se mezclan versiones)
            vtx = next((base + e for e in COMPA_VTX if base + e in F), None)
            for c in [base + '.vvd', base + '.phy', vtx]:
                if not c or c not in F: continue
                self.de[c] = d
                if d == 'rar':
                    self.rar.add(c)
                    if not local(c): self.pend.add(c)
            for c in ([] if vtx else [base + '.dx90.vtx']) + ([] if base + '.vvd' in F else [base + '.vvd']): self.faltan.setdefault(c, m)
        if b is None: return
        try: tex, cds = mdl_texturas(b)
        except Exception as ex: self.faltan.setdefault(m + ' (ilegible: %s)' % ex, quien); return
        for t in tex:
            cands = [mat_ruta('materials/' + (norm(c).strip('/') + '/' if norm(c).strip('/') else '') + norm(t)) for c in (cds or [''])]
            ok = next((c for c in cands if self.donde(c)), None)
            if ok: self.vmt(ok, m)
            else: self.faltan.setdefault(cands[0], m)

def resolver(nombre, b):
    bsp = BSP(b); pak = bsp.pak(); R = Resolutor(pak); E = bsp.entidades(); ws = E[0] if E else {}
    for t in bsp.texturas(): R.vmt(mat_ruta(t), nombre)
    sky = ws.get('skyname', '').strip()
    if sky:
        for lado in ('bk', 'dn', 'ft', 'lf', 'rt', 'up'): R.vmt(mat_ruta('skybox/' + sky + lado), nombre + ' (cielo)')
    if ws.get('detailmaterial'): R.vmt(mat_ruta(ws['detailmaterial']), nombre + ' (pasto)')
    for e in E:
        c = e.get('classname', '')
        for k in ('texture',) if c == 'infodecal' else ('material', 'overlaymaterial') if c == 'env_sun' else ('ropematerial',) if c in ('move_rope', 'keyframe_rope') else ():
            if e.get(k): R.vmt(mat_ruta(e[k]), nombre + ' (' + c + ')')
        if c in ('env_sprite', 'env_glow') and e.get('model', '').lower().endswith('.vmt'): R.vmt(mat_ruta(e['model']), nombre + ' (' + c + ')')
    for m in sorted(set(norm(p) for p in bsp.props())): R.mdl(m, nombre + ' (sprp)')
    for e in E:   # (los modelos de los prop_* puestos como entidades, menos los vehículos)
        c = e.get('classname', '')
        if c.startswith('prop_') and not c.startswith('prop_vehicle') and e.get('model', '').lower().endswith('.mdl'): R.mdl(e['model'], nombre + ' (' + c + ')')
    return R

def bajar(rutas):
    def uno(r):
        if local(r): return True
        _, rel, tam, url = RAR[r]; dst = os.path.join(DL, rel); err = ''
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        for k in range(6):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'jxmod-paquete-mapas/1'})
                with urllib.request.urlopen(req, timeout=600) as fh: d = fh.read()
                if len(d) == tam:
                    open(dst + '.part', 'wb').write(d); os.replace(dst + '.part', dst); return True
                err = 'tamaño %d en vez de %d' % (len(d), tam)
            except Exception as ex: err = str(ex)
            time.sleep(min(90, 5 * 2 ** k))
        print('  no se pudo bajar', rel, '·', err, file=sys.stderr); return False
    rutas = sorted(rutas); t0 = time.time()
    with CF.ThreadPoolExecutor(6) as ex: ok = sum(ex.map(uno, rutas))
    print('  bajados %d de %d (%.1f MB) en %.0f s' % (ok, len(rutas), sum(RAR[r][2] for r in rutas) / 1e6, time.time() - t0), file=sys.stderr)
    return ok

# ---- 1) los mapas y todo lo que piden (en vueltas: bajar lo pendiente y volver a resolver hasta que no quede nada)
def leer_mapa(r):
    if r not in RAR: raise SystemExit('no está en el listado: ' + r)
    if not local(r):
        if not BAJAR: raise SystemExit('falta bajar ' + RAR[r][1] + ' (usar --bajar)')
        bajar([r])
    return open(local(r), 'rb').read()
for vuelta in range(12):
    MAPAS = {'maps/%s.bsp' % m: ('rar', leer_mapa('maps/%s.bsp' % m)) for m in MAPAS10}
    if os.path.isfile(C13): MAPAS['maps/gm_construct_13.bsp'] = ('src', open(C13, 'rb').read())
    RES = {r: resolver(r, b) for r, (_, b) in MAPAS.items()}
    pend = set().union(*(R.pend for R in RES.values()))
    print('vuelta %d: %d por bajar (%.1f MB)' % (vuelta, len(pend), sum(RAR[r][2] for r in pend) / 1e6), file=sys.stderr)
    if not pend: break
    if not BAJAR: raise SystemExit('faltan bajar %d archivos (usar --bajar)' % len(pend))
    if not bajar(pend): raise SystemExit('no se pudo bajar nada de lo que falta')
else: raise SystemExit('no termina de resolver')

# ---- 2) qué gm_construct va: el de 13 si no le falta nada; si no, el de 10 (y el de 13 aparte, con lo que haya)
falta13 = RES['maps/gm_construct_13.bsp'].faltan if 'maps/gm_construct_13.bsp' in RES else None
if falta13 is not None and not falta13:
    ELEGIDOS = {'maps/gm_construct.bsp': 'maps/gm_construct_13.bsp', 'maps/gm_flatgrass.bsp': 'maps/gm_flatgrass.bsp'}
else:
    ELEGIDOS = {'maps/gm_construct.bsp': 'maps/gm_construct.bsp', 'maps/gm_flatgrass.bsp': 'maps/gm_flatgrass.bsp'}
    if falta13 is not None: ELEGIDOS['maps/gm_construct_13.bsp'] = 'maps/gm_construct_13.bsp'
for dst, src in sorted(ELEGIDOS.items()):
    R = RES[src]
    print('%s ← %s: vmt %d, vtf %d, modelos %d · del RAR %d, de gm_lib %d, del pakfile %d · faltan %d' % (
        dst, 'GMod 13' if src.endswith('_13.bsp') else 'GMod 10', len(R.cuenta['vmt']), len(R.cuenta['vtf']), len(R.cuenta['mdl']),
        sum(1 for d in R.de.values() if d == 'rar'), sum(1 for d in R.de.values() if d == 'lib'), sum(1 for d in R.de.values() if d == 'pak'), len(R.faltan)), file=sys.stderr)
    for r, q in sorted(R.faltan.items()): print('   falta %s  (lo pide %s)' % (r, q), file=sys.stderr)

# ---- 3) el paquete: los mapas elegidos y lo del RAR que piden (sin lo que ya está en gm_lib)
datos = {}
for dst, src in ELEGIDOS.items():
    datos[dst] = MAPAS[src][1]
    for r in RES[src].rar: datos[r] = open(local(r), 'rb').read()
trozos, idx, act = [], {}, bytearray()
for r in sorted(datos):
    b = datos[r]; usar_z = False
    if r.endswith(('.bsp', '.vtf', '.mdl', '.vmt')):
        z = gzip.compress(b, 9, mtime=0); usar_z = len(z) <= len(b) * 0.9
    d = z if usar_z else b
    if len(act) + len(d) > TOPE and act: trozos.append(bytes(act)); act = bytearray()
    idx[r] = [len(trozos), len(act), len(d), 1 if usar_z else 0, len(b)]; act += d
if act: trozos.append(bytes(act))
h = hashlib.sha1(b''.join(trozos)).hexdigest()[:10]
for f in os.listdir(SAL):
    if re.match(r'^gm_mapas\.[0-9a-f]+\.(idx|\d+\.bin)$', f) and not f.startswith('gm_mapas.' + h + '.'): os.remove(os.path.join(SAL, f))
nombres = []
for k, t in enumerate(trozos): n = 'gm_mapas.%s.%d.bin' % (h, k); open(os.path.join(SAL, n), 'wb').write(t); nombres.append(n)
j = json.dumps({'v': 1, 't': nombres, 'f': idx}, separators=(',', ':')).encode()
open(os.path.join(SAL, 'gm_mapas.%s.idx' % h), 'wb').write(gzip.compress(j, 9, mtime=0))
cuenta = lambda ext: sum(1 for r in datos if r.endswith(ext))
print('gm_mapas.%s.idx: %d archivos (%d mapas, %d vmt, %d vtf, %d mdl) en %d trozos, %.1f MB (%.1f MB sin comprimir)' % (
    h, len(datos), cuenta('.bsp'), cuenta('.vmt'), cuenta('.vtf'), cuenta('.mdl'), len(trozos), sum(len(t) for t in trozos) / 1e6, sum(len(b) for b in datos.values()) / 1e6))
print(json.dumps({'mapas': 'gm_mapas.%s.idx' % h, 'gm_construct': 'GMod 13' if ELEGIDOS['maps/gm_construct.bsp'].endswith('_13.bsp') else 'GMod 10'}))
