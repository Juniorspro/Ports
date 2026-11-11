# La pizzería de FNAF 1 y sus animatrónicos para la noche de terror (juego/noche.js), sumados a un paquete del juego:
# - el mapa "Freddy Fazbears Pizza (Event)" de Garry's Mod (Workshop 1723579046, fnaf_freddypizzaevents.bsp): las caras
#   del mundo con sus texturas, las brochas que se ven (vidrios, carteles, la puerta del fondo), los props (estáticos y de
#   entidades) con sus modelos y su pose, las calcomanías, las dos puertas de seguridad y los botones de la oficina, las
#   luces, las cámaras de seguridad y la oficina. Pasa de Source (Z arriba, pulgadas) al juego (Y arriba, metros) con
#   (x, y, z) → (y, z, x). Lo de los eventos del mapa (lo que aparece con sus disparadores, la sala de control de arriba,
#   los animatrónicos quietos que el juego reemplaza por los suyos, los de FNAF 2) no va.
# - Freddy, Bonnie, Chica y Foxy del "FNAF Help Wanted NEXTBOT Pack" (cl3nr): mallas con piel (los huesos del .mdl,
#   a lo sumo 56 con peso), texturas y animaciones (quieto, caminar o correr, susto, mirar) muestreadas cuadro a cuadro.
#   Si el paquete de origen ya los trae (de un armado anterior), se usan esos.
# Si el paquete de origen ya tiene una pizzería, se saca entera antes (mallas, materiales y texturas que sólo usaba ella).
# Los props del mapa que están cerca (mismo modelo y material) van juntos en una malla por zona de 8 m: menos de un
# décimo de las llamadas de dibujo, y cada zona se descarta entera cuando no se ve.
# Lo extraído no va al repo: este script lo lee de afuera. Créditos en CREDITOS.md.
# Uso: FN_EXTRA=carpeta1:carpeta2 [FN_LIB=web/rb/gm_lib.X.idx] [FN_CARGA=captura.jpg] python-con-srctools -I pizzeria.py PAQUETE_ORIGEN PAQUETE_NUEVO MAPA.bsp CARPETA_PACK_HW
# (FN_EXTRA: lo bajado de los addons que el mapa pide y no trae: el Model Pack y las Texture Materials #1-3 de los
#  "FNAF MAPs", y los archivos de HL2 que usa; FN_LIB: la biblioteca de GMod/HL2/CS:S del juego, de herramientas/gmod_base.py)
import sys, os, io, re, json, gzip, math, struct, hashlib, collections, numpy as np
from PIL import Image
import srctools.bsp as BSPm, srctools.vtf as VTF
from srctools.keyvalues import Keyvalues
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import source_mdl as SM

PK0, PK1, BSPF, HW = sys.argv[1:5]
DBG = os.environ.get('FN_DBG')   # (carpeta para dejar la grilla de los caminos y la planta, para revisar)
d = json.load(gzip.open(PK0 + '/d.json.gz')); BIN = bytearray(gzip.decompress(open(PK0 + '/m.bin.gz', 'rb').read()))
FN = d.get('fn') or {}

# ---------------- la pizzería anterior, fuera ----------------
# Mallas, materiales y texturas que sólo usaba ella: sus lugares quedan libres (se usan primero para lo nuevo) y el bloque
# de mallas se compacta (los desplazamientos de lo que queda se corren). Los animatrónicos (fn.pf y sus clips) se quedan.
LIBRES = {'ms': [], 'mt': [], 'tx': []}
QUITAR_TX = set()
def nodos_de(x, out):
    """lo que usa mallas o materiales (nodos de escenas y prefabs, y cualquier otra cosa con 'm' o 'mt')"""
    if isinstance(x, dict):
        if isinstance(x.get('m'), int) or isinstance(x.get('mt'), list) or isinstance(x.get('col'), list): out.append(x)
        for v in x.values():
            if isinstance(v, (dict, list)): nodos_de(v, out)
    elif isinstance(x, list):
        for v in x:
            if isinstance(v, (dict, list)): nodos_de(v, out)
    return out
def usa(nodos):
    M, MT = set(), set()
    for n in nodos:
        if isinstance(n.get('m'), int) and n['m'] >= 0: M.add(n['m'])
        for c in n.get('col') or []:
            if isinstance(c, dict) and isinstance(c.get('m'), int) and c['m'] >= 0: M.add(c['m'])
        for mi in n.get('mt') or []:
            if isinstance(mi, int) and mi >= 0: MT.add(mi)
    for m in list(M):
        for l in d['ms'][m].get('lods') or []: M.add(l)
    return M, MT
def tex_de_mat(mt):
    t = set()
    for k in ('t', 't2'):
        if isinstance(mt.get(k), int) and mt[k] >= 0: t.add(mt[k])
    for v in (mt.get('tt') or {}).values():
        if isinstance(v, list) and v and isinstance(v[0], int) and v[0] >= 0: t.add(v[0])
    return t
def quitar_anterior():
    global BIN
    esc = d['esc'].pop('RB_Pizzeria', None)
    if esc is None: return
    um, umt = usa(nodos_de(esc, []))
    resto = dict(d); resto.pop('ms'); resto.pop('mt'); resto.pop('tx')
    om, omt = usa(nodos_de(resto, []))
    qm, qmt = um - om, umt - omt
    qtx = set().union(*[tex_de_mat(d['mt'][i]) for i in qmt]) if qmt else set()
    qtx -= set().union(*[tex_de_mat(m) for i, m in enumerate(d['mt']) if i not in qmt])
    # bloque de mallas: sólo lo que queda (en el mismo orden), alineado a 4
    rangos = {}
    def rango(a, n):
        if a is None or not n: return
        rangos[a] = max(rangos.get(a, 0), n)
    for i, m in enumerate(d['ms']):
        if i in qm or m.get('o') is None: continue
        rango(m['o'], m['v'] * 14)
        if m.get('sk') is not None: rango(m['sk'], m['v'] * 8)
        if m.get('lm') is not None: rango(m['lm'], m['v'] * 4)
        n = max((s[0] + s[1] for s in m.get('sub') or []), default=0) * (4 if m.get('i32') else 2)
        rango(m['i'], n)
    for c in (FN.get('clips') or {}).values(): rango(c['o'], c['nf'] * c['nb'] * 7 * 2)
    nuevo, mapa, fin = bytearray(), {}, -1
    for a in sorted(rangos):
        assert a >= fin or a + rangos[a] <= fin, 'rangos que se pisan'
        if a + rangos[a] <= fin and fin >= 0:   # (adentro de otro: sólo la diferencia)
            base = max(k for k in mapa if k <= a); mapa[a] = mapa[base] + (a - base); continue
        while len(nuevo) % 4: nuevo.append(0)
        mapa[a] = len(nuevo); nuevo += BIN[a:a + rangos[a]]; fin = a + rangos[a]
    for i, m in enumerate(d['ms']):
        if i in qm:
            d['ms'][i] = {'n': '-', 'o': None, 'v': 0, 'mn': [0, 0, 0], 'sc': [1, 1, 1], 'i': 0, 'i32': False, 'sub': []}; LIBRES['ms'].append(i); continue
        if m.get('o') is None: continue
        for k in ('o', 'sk', 'lm', 'i'):
            if m.get(k) is not None: m[k] = mapa[m[k]]
    for c in (FN.get('clips') or {}).values(): c['o'] = mapa[c['o']]
    for i in qmt: d['mt'][i] = {'n': '-', 'sh': 'Mobile/Diffuse', 't': -1, 'c': [1, 1, 1, 1], 'f': {}}; LIBRES['mt'].append(i)
    for i in qtx: d['tx'][i] = {'n': '-', 'a': 0, 'w': 4, 'h': 4}; LIBRES['tx'].append(i); QUITAR_TX.add(i)
    for k in ('cortina', 'salas', 'caminos', 'mapa', 'luces', 'camaras', 'puertas', 'botones', 'oficina', 'cams', 'cueva'): FN.pop(k, None)
    print('pizzería anterior fuera: mallas', len(qm), 'materiales', len(qmt), 'texturas', len(qtx), 'bloque', len(BIN) // 1000, '→', len(nuevo) // 1000, 'KB')
    BIN = nuevo
quitar_anterior()
d['fn'] = FN; FN.setdefault('pf', {}); FN.setdefault('clips', {})

# copia del paquete: lo que no cambia, enlazado (sin las texturas que se fueron). Lo que se escribe nuevo en PK1 se
# desenlaza antes, así el paquete de origen no se toca
os.makedirs(PK1, exist_ok=True)
for sub in ('t', 'i', 'a', 'fondos', 'carga', 'v'):
    os.makedirs(os.path.join(PK1, sub), exist_ok=True)
    if os.path.isdir(os.path.join(PK0, sub)):
        for f in os.listdir(os.path.join(PK0, sub)):
            if sub == 't' and int(f.split('.')[0]) in QUITAR_TX: continue
            dst = os.path.join(PK1, sub, f)
            if not os.path.exists(dst): os.link(os.path.join(PK0, sub, f), dst)
def escribir(ruta):
    if os.path.exists(ruta): os.unlink(ruta)
    return ruta
def agregar(b):
    while len(BIN) % 4: BIN.append(0)
    o = len(BIN); BIN.extend(b); return o
def lugar(k, x):
    if LIBRES[k]: i = LIBRES[k].pop(0); d[k][i] = x; return i
    d[k].append(x); return len(d[k]) - 1

# ---------------- de Source al juego ----------------
S = 0.0254
MS = np.array([[0, 1, 0], [0, 0, 1], [1, 0, 0]], float)   # (x, y, z) → (y, z, x): los dos de mano derecha (si no, el mapa queda espejado)
def P(v, k=1.0): return MS @ np.asarray(v, float) * S * k
def R(m): return MS @ m @ MS.T
def ang_mat(p, y, r):
    """matriz de un QAngle de Source (pitch, yaw, roll en grados): columnas adelante, izquierda, arriba"""
    p, y, r = math.radians(p), math.radians(y), math.radians(r)
    sp, cp, sy, cy, sr, cr = math.sin(p), math.cos(p), math.sin(y), math.cos(y), math.sin(r), math.cos(r)
    return np.array([[cp * cy, sr * sp * cy - cr * sy, cr * sp * cy + sr * sy],
                     [cp * sy, sr * sp * sy + cr * cy, cr * sp * sy - sr * cy],
                     [-sp, sr * cp, cr * cp]])
def vec(s): return [float(x) for x in str(s).split()] if s else [0.0, 0.0, 0.0]
r3 = lambda v: [round(float(x), 3) for x in v]

# ---------------- archivos: el pak del mapa, las carpetas de los addons, el pack HW y la biblioteca ----------------
bsp = BSPm.BSP(BSPF); PAK = bsp.pakfile; PAKN = {n.lower().replace('\\', '/'): n for n in PAK.namelist()}
EXTRA = [x for x in os.environ.get('FN_EXTRA', '').split(os.pathsep) if x]
LIB = os.environ.get('FN_LIB'); LIBI = json.loads(gzip.decompress(open(LIB, 'rb').read())) if LIB else None
_trozos = {}
def leer(ruta):
    r = ruta.lower().replace('\\', '/')
    while '//' in r: r = r.replace('//', '/')
    if r in PAKN: return PAK.read(PAKN[r])
    for base in EXTRA + [HW]:
        f = os.path.join(base, r)
        if os.path.exists(f): return open(f, 'rb').read()
    if LIBI and r in LIBI['f']:
        t, o, n, z = LIBI['f'][r][:4]
        if t not in _trozos: _trozos[t] = open(os.path.join(os.path.dirname(LIB), LIBI['t'][t]), 'rb').read()
        b = _trozos[t][o:o + n]
        return gzip.decompress(b) if z else bytes(b)
    return None

# ---------------- texturas y materiales ----------------
_mats, _txs, _mat_k = {}, {}, {}
def kv_material(ruta):
    """(shader, {clave: valor}) de un .vmt, siguiendo los 'patch'"""
    b = leer(ruta)
    if b is None: return None, {}
    txt = b.decode('utf-8', 'replace')
    for intento in range(3):   # (hay .vmt a los que les falta la llave del final)
        try: kv = Keyvalues.parse(txt, ruta); break
        except Exception: txt += '\n}'
    else:
        m = re.search(r'"?\$basetexture"?\s+"?([^"\s]+)', txt, re.I); return 'lightmappedgeneric', ({'$basetexture': m.group(1)} if m else {})
    raiz = next(iter(kv)); sh = raiz.real_name.lower(); claves = {}
    for x in raiz:
        if not x.has_children(): claves[x.name.lower()] = x.value
    if sh == 'patch':
        inc = claves.get('include', '').lower().replace('\\', '/')
        if not inc.startswith('materials/'): inc = 'materials/' + inc
        if not inc.endswith('.vmt'): inc += '.vmt'
        sh2, base = kv_material(inc)
        for blk in raiz:
            if blk.has_children():
                for x in blk: base[x.name.lower()] = x.value
        return sh2, base
    return sh, claves
def nuevo_tx(entrada, img, alfa, q=80):
    ti = lugar('tx', entrada)
    (img if alfa else img.convert('RGB')).save(escribir(PK1 + '/t/%d.webp' % ti), 'WEBP', quality=q, method=6)
    return ti
def textura(ruta_vtf, nombre, lado, alfa_ok=True):
    k = (ruta_vtf.lower(), lado)
    if k in _txs: return _txs[k]
    b = leer(ruta_vtf)
    if b is None: _txs[k] = None; return None
    try: v = VTF.VTF.read(io.BytesIO(b)); im = v.get().to_PIL().convert('RGBA')
    except Exception as e: print('  textura ilegible', ruta_vtf, e); _txs[k] = None; return None
    a = np.asarray(im)[:, :, 3]; alfa = alfa_ok and a.min() < 250
    w, h = im.size; s = min(1.0, lado / max(w, h)); w2, h2 = max(4, round(w * s)), max(4, round(h * s))
    im = im.resize((w2, h2), Image.LANCZOS)
    huella = hashlib.md5(im.tobytes()).hexdigest()   # (la misma imagen en otra carpeta: una sola vez)
    if huella in _txs: _txs[k] = _txs[huella]; return _txs[k]
    ti = nuevo_tx({'n': 'FN_' + nombre[-40:], 'a': 1 if alfa else 0, 'w': w2, 'h': h2}, im, alfa)
    _txs[k] = _txs[huella] = (ti, alfa); return _txs[k]
def tex_imagen(img, nombre, alfa=False):
    return nuevo_tx({'n': 'FN_' + nombre, 'a': 1 if alfa else 0, 'w': img.size[0], 'h': img.size[1]}, img, alfa, 86)
def mat_nuevo(nombre, ti, modo, color=(1, 1, 1, 1)):
    k = (ti, modo, tuple(round(c, 3) for c in color))   # (el mismo dibujo con el mismo modo: un solo material)
    if k in _mat_k: return _mat_k[k]
    m = {'n': 'FN_' + nombre, 't': ti, 'ts': [1.0, 1.0], 'to': [0.0, 0.0], 'tt': {'_MainTex': [ti, 1.0, 1.0, 0.0, 0.0]}, 'cc': {'_Color': list(color)}, 'c': list(color), 'f': {}}
    if modo == 'cut': m.update(sh='Standard', f={'_Mode': 1.0, '_Glossiness': 0.15, '_Metallic': 0.0})
    elif modo == 'blend': m['sh'] = 'Legacy Shaders/Transparent/Diffuse'
    elif modo == 'unlit': m['sh'] = 'Unlit/Texture'
    else: m['sh'] = 'Mobile/Diffuse'
    _mat_k[k] = lugar('mt', m); return _mat_k[k]
def ruido(n, beta, semilla):
    r = np.random.default_rng(semilla).standard_normal((n, n)); F = np.fft.fft2(r)
    ky, kx = np.fft.fftfreq(n)[:, None], np.fft.fftfreq(n)[None, :]; k = np.sqrt(kx * kx + ky * ky); k[0, 0] = 1
    x = np.real(np.fft.ifft2(F / k ** beta)); return (x - x.min()) / (x.max() - x.min())
def tex_ruido(nombre, rgb, var=26, rayas=False, n=128):
    a = ruido(n, 1.1, sum(nombre.encode()) % 97)
    if rayas: a = 0.5 * a + 0.5 * np.repeat(ruido(n, 1.3, 7).mean(1, keepdims=True), n, 1)
    img = np.stack([rgb[i] + var * (a - 0.5) for i in range(3)], -1)
    return tex_imagen(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), nombre)
_falta = {}
def falta(nombre):
    """texturas que el mapa pide y no vienen en ningún lado (de HL2 o de CS:S): hechas acá, parecidas"""
    if nombre in _falta: return _falta[nombre]
    if 'wood' in nombre: ti = tex_ruido(nombre.split('/')[-1], (112, 78, 50), 30, True, 256)
    elif 'concrete' in nombre: ti = tex_ruido(nombre.split('/')[-1], (118, 116, 110), 28, False, 256)
    elif 'metal' in nombre: ti = tex_ruido(nombre.split('/')[-1], (120, 124, 128), 26, True, 256)
    else: ti = tex_ruido(nombre.split('/')[-1], (70, 70, 74), 24, False, 128)
    _falta[nombre] = ti; return ti
def tex_monitor():
    """la pantalla de la compu de la oficina (en el mapa, la cámara en vivo): gris azulado oscuro con líneas"""
    n = 128; a = ruido(n, 0.4, 11); y = (np.arange(n)[:, None] % 4 < 2) * 1.0
    g = 26 + 18 * a - 8 * y; img = np.stack([g * 0.8, g * 0.95, g * 1.15], -1)
    return tex_imagen(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), 'monitor')
def material_de(vmt, lado=512):
    """índice de material del juego para un .vmt (o None)"""
    k = (vmt.lower(), lado)
    if k in _mats: return _mats[k]
    sh, c = kv_material(vmt)
    nombre = vmt.lower().removeprefix('materials/').removesuffix('.vmt')
    bt = c.get('$basetexture')
    if bt and bt.lower().startswith('_rt_'):   # (las pantallas con la cámara en vivo)
        _mats[k] = mat_nuevo('monitor', tex_monitor(), 'unlit'); return _mats[k]
    tx = textura('materials/' + bt.lower().replace('\\', '/').removesuffix('.vtf') + '.vtf', bt, lado) if bt else None
    if tx is None:
        if sh is None and not any(s in nombre for s in ('wood', 'concrete', 'metal')): _mats[k] = None; return None
        tx = (falta(nombre), False)
    ti, alfa = tx
    trans = c.get('$translucent', '0') not in ('0', ''); corte = c.get('$alphatest', '0') not in ('0', ''); aditivo = c.get('$additive', '0') not in ('0', '')
    brillo = c.get('$selfillum', '0') not in ('0', '') and ('eye' in nombre or sh == 'unlitgeneric')
    modo = 'unlit' if (aditivo or brillo) and not trans else 'blend' if trans or aditivo else 'cut' if corte or (alfa and ('decal' in nombre or sh == 'decalmodulate')) else 'op'
    try: am = float(c.get('$alpha', '1') or 1)
    except ValueError: am = 1.0
    color = (1, 1, 1, max(0.18, min(0.42, am))) if am < 0.99 else (1, 1, 1, 1)
    if am < 0.99: modo = 'blend'
    if 'glass' in nombre and modo == 'blend': color = (1, 1, 1, 0.3)
    _mats[k] = mat_nuevo(nombre.split('/')[-1], ti, modo, color); return _mats[k]
def mat_es_vidrio(mi): return mi is not None and d['mt'][mi].get('sh') == 'Legacy Shaders/Transparent/Diffuse'
_colores = {}
def mat_color(rgb, nombre='color'):
    if rgb not in _colores: _colores[rgb] = mat_nuevo('%s%d_%d_%d' % ((nombre,) + rgb), tex_imagen(Image.new('RGB', (4, 4), rgb), 'color%d_%d_%d' % rgb), 'op')
    return _colores[rgb]

# ---------------- mallas ----------------
def malla_bin(nombre, V, N, U, porMat, piel=None, bp=None):
    V = np.asarray(V, float); mn = V.min(0); sc = np.maximum(V.max(0) - mn, 1e-6)
    q = np.ascontiguousarray(np.round((V - mn) / sc * 65535).astype('<u2')); nb = np.ascontiguousarray(np.clip(np.round(np.asarray(N, float) * 127), -127, 127).astype(np.int8)); uv = np.ascontiguousarray(np.asarray(U, float).astype('<f2'))
    vb = np.zeros((len(V), 14), np.uint8); vb[:, 0:6] = q.view(np.uint8).reshape(-1, 6); vb[:, 6:9] = nb.view(np.uint8).reshape(-1, 3); vb[:, 10:14] = uv.view(np.uint8).reshape(-1, 4)
    mats = list(porMat.keys()); idx = []; sub = []
    for m in mats: sub.append([len(idx), len(porMat[m])]); idx.extend(porMat[m])
    i32 = len(V) > 65535; o_v = agregar(vb.tobytes())
    o_s = agregar(piel.tobytes()) if piel is not None else None
    o_i = agregar(np.array(idx, '<u4' if i32 else '<u2').tobytes())
    x = {'n': nombre, 'o': o_v, 'v': len(V), 'mn': mn.tolist(), 'sc': sc.tolist(), 'i': o_i, 'i32': bool(i32), 'sub': sub}
    if piel is not None: x['sk'] = o_s; x['bp'] = bp
    return lugar('ms', x), mats
def orientar(tri, V, n):
    """el orden de un triángulo para que se vea del lado de la normal n (el juego dibuja la cara con (b-a)×(c-a) hacia uno)"""
    a, b, c = tri
    return (a, b, c) if np.dot(np.cross(V[b] - V[a], V[c] - V[a]), n) >= 0 else (a, c, b)
def nodo(n, p=(0, 0, 0), r=(0, 0, 0, 1), s=(1, 1, 1), pa=-1, **x):
    return dict(n=n, p=[round(float(v), 5) for v in p], r=[round(float(v), 6) for v in r], s=[round(float(v), 5) for v in s], pa=pa, **x)

# ---------------- qué va del mapa ----------------
ents = list(bsp.ents.entities)
Z_MAX = 300   # (arriba de la pizzería está la sala de control de los eventos y la de aparición: no van)
def arriba(o): return o[2] > Z_MAX
def se_ve(e):
    """una entidad que se ve al empezar el mapa (las de los eventos arrancan apagadas, transparentes o sin dibujar)"""
    if (e['StartDisabled'] or '0') == '1': return False
    rm = int(e['rendermode'] or 0); ra = e['renderamt']
    if rm == 10: return False
    if rm != 0 and ra not in (None, '') and float(ra) <= 0: return False
    return True

# ---------------- el mapa: caras ----------------
SALTAR = ('tools/', 'skybox')
# de qué lado se ve cada cara: del que no hay brocha sólida (el plano de la cara no siempre alcanza en los mapas de Source)
_BR = []
for b in bsp.brushes:
    if not (b.contents.value & 1): continue
    Nb = np.array([[x.plane.normal.x, x.plane.normal.y, x.plane.normal.z] for x in b.sides]); Db = np.array([x.plane.dist for x in b.sides])
    lo, hi = np.full(3, -1e9), np.full(3, 1e9)
    for n_, d_ in zip(Nb, Db):
        for ax in range(3):
            if abs(n_[ax]) > 0.9999:
                if n_[ax] > 0: hi[ax] = min(hi[ax], d_ / n_[ax])
                else: lo[ax] = max(lo[ax], d_ / n_[ax])
    _BR.append((Nb, Db, lo, hi))
_BLO, _BHI = np.array([x[2] for x in _BR]), np.array([x[3] for x in _BR])
def solido(p, eps=0.05):
    for k in np.nonzero(np.all((_BLO <= p + eps) & (p - eps <= _BHI), 1))[0]:
        if np.all(_BR[k][0] @ p - _BR[k][1] < -eps): return True
    return False
def lado_visible(vs, n):
    """1: la cara se ve del lado de n; -1: del otro (lo sólido está adelante); 0: no se sabe (se dibuja de los dos lados)"""
    c = vs.mean(0); votos = 0
    for q in [c] + [c + (v - c) * 0.6 for v in vs[:6]]:
        de, dt = solido(q + n * 0.5), solido(q - n * 0.5)
        votos += 1 if dt and not de else -1 if de and not dt else 0
    return int(np.sign(votos))
CARAS_VUELTA = [0, 0, 0]
TRIS, PLANOS = {}, []
def caras_a_malla(caras, origen, nombre, ver_solido=False, rot=None, nav=True):
    """caras del BSP (con su origen de entidad) → malla del juego por material; devuelve (malla, mats) o None"""
    V, N, U, porMat = [], [], [], {}
    for f in caras:
        ti = f.texinfo
        if ti is None: continue
        fl = ti.flags.value
        if fl & (0x4 | 0x2 | 0x80 | 0x200 | 0x100): continue   # cielo, nodraw, skip, hint
        mat = ti.mat.lower()
        if mat.startswith(SALTAR): continue
        vs = [np.array([e.a.x, e.a.y, e.a.z]) + origen for e in f.edges]
        if len(vs) < 3 or min(v[2] for v in vs) > Z_MAX - 20: continue
        mi = material_de('materials/' + mat + '.vmt')
        if mi is None: continue
        nsrc = np.array([f.plane.normal.x, f.plane.normal.y, f.plane.normal.z]) * (-1 if f.same_dir_as_plane else 1)
        lv = lado_visible(np.array(vs), nsrc) if ver_solido else 1
        if mat_es_vidrio(mi): lv = 0   # (vidrios: de los dos lados)
        if lv < 0: nsrc = -nsrc
        CARAS_VUELTA[0 if lv < 0 else 1 if lv == 0 else 2] += 1
        if nombre == 'FN_Pizzeria': PLANOS.append((np.array(vs), nsrc, mat))
        ne = MS @ nsrc; tw, th = ti.tex_size; tw, th = tw or 512, th or 512
        so, to = np.array([ti.s_off.x, ti.s_off.y, ti.s_off.z]), np.array([ti.t_off.x, ti.t_off.y, ti.t_off.z])
        uv = np.array([[(v @ so + ti.s_shift) / tw, -(v @ to + ti.t_shift) / th] for v in vs]); uv -= np.floor(uv.min(0))
        base = len(V)
        for v, t in zip(vs, uv): V.append(P(v)); N.append(ne); U.append(t)
        Vn = np.array(V)
        for k in range(1, len(vs) - 1):
            porMat.setdefault(mi, []).extend(orientar((base, base + k, base + k + 1), Vn, ne))
            if lv == 0: porMat[mi].extend(orientar((base, base + k, base + k + 1), Vn, -ne))
    if not V: return None
    if nav: TRIS[nombre] = np.array(V)[np.array([i for l in porMat.values() for i in l]).reshape(-1, 3)]
    return malla_bin(nombre, V, N, U, porMat)

mundo_ent = next(e for e in bsp.bmodels if e['classname'] == 'worldspawn')
mi_mundo, mats_mundo = caras_a_malla(bsp.bmodels[mundo_ent].faces, np.zeros(3), 'FN_Pizzeria', ver_solido=True)
print('caras del mundo: dadas vuelta', CARAS_VUELTA[0], '· de los dos lados', CARAS_VUELTA[1], '· como venían', CARAS_VUELTA[2], '· materiales', len(mats_mundo))
esc = [[nodo('RB_Pizzeria', m=mi_mundo, mt=mats_mundo, rid=9930000, col=[{'k': 'm', 'm': mi_mundo, 'cv': 0, 'tr': 0}])]]

# ---------------- la oficina (de los botones y las puertas del mapa) ----------------
EN = {}
for e in ents:
    if e['targetname']: EN.setdefault(e['targetname'], []).append(e)
pu_s = {e['targetname']: np.array(vec(e['origin'])) for e in ents if e['classname'] == 'func_door' and e['targetname'] in ('Securitydoor_l', 'Securitydoor_r')}
OF_C = (pu_s['Securitydoor_l'] + pu_s['Securitydoor_r']) / 2   # (centro entre las dos puertas, en Source)
# hacia dónde mira el guardia: al escritorio (los botones de las cámaras), que está de un lado de la línea de las puertas
bcam = np.mean([vec(e['origin']) for e in ents if e['classname'] == 'func_button' and e['targetname'] == 'Cambutton'], 0)
eje = pu_s['Securitydoor_r'] - pu_s['Securitydoor_l']; eje[2] = 0; eje /= np.linalg.norm(eje)
frente = np.array([-eje[1], eje[0], 0.0])
if np.dot(bcam[:2] - OF_C[:2], frente[:2]) < 0: frente = -frente
izq_s = np.cross(np.array([0, 0, 1.0]), frente)   # (en Source, z arriba: la izquierda de quien mira "frente")
LADO_DE = {}
for k, o in pu_s.items(): LADO_DE[k] = 'izq' if np.dot(o - OF_C, izq_s) > 0 else 'der'
print('oficina: centro', np.round(OF_C, 1), 'mira', np.round(frente, 2), 'puertas', LADO_DE)

# ---------------- brochas ----------------
puertas, botones = {}, []
fijas, solidas = [nodo('FN_Brochas')], [nodo('FN_Paredes')]
BISAGRAS = []
for e, bm in bsp.bmodels.items():
    c = e['classname']
    if c == 'worldspawn': continue
    if c.startswith(('trigger_', 'func_tracktrain', 'func_physbox', 'func_rotating', 'func_areaportal', 'func_occluder')): continue
    o = np.array(vec(e['origin']))
    if arriba(o) or (bm.mins.z + o[2] > Z_MAX): continue
    if c == 'func_wall_toggle' and int(e['spawnflags'] or 0) & 1: continue   # (arrancan sin verse)
    if not se_ve(e): continue
    if c == 'func_door' and e['targetname'] in LADO_DE:
        lado = LADO_DE[e['targetname']]; r = caras_a_malla(bm.faces, np.zeros(3), 'FN_Puerta_' + lado, nav=False)
        mn, mx = np.array([bm.mins.x, bm.mins.y, bm.mins.z]), np.array([bm.maxes.x, bm.maxes.y, bm.maxes.z])
        puertas[lado] = {'p': r3(P(o)), 'alto': round(float((mx[2] - mn[2]) * S), 3), 'caja': r3(np.abs(MS @ (mx - mn) * S))}
        esc.append([nodo('FN_Puerta_' + lado, P(o), m=r[0], mt=r[1])]); continue
    if c == 'func_door': continue   # (las demás son de los eventos: chiquitas e invisibles)
    if c == 'func_door_rotating':   # la puerta del fondo: abierta 90° hacia donde no choca
        r = caras_a_malla(bm.faces, np.zeros(3), 'FN_PuertaComun', nav=False)
        if r:
            for sg in (1, -1):
                G = R(ang_mat(0, 90 * sg, 0)); esq = np.array([[x, y, 0] for x in (bm.mins.x, bm.maxes.x) for y in (bm.mins.y, bm.maxes.y)])
                if not any(solido(o + (ang_mat(0, 90 * sg, 0) @ q) * 0.8 + np.array([0, 0, 40])) for q in esq): break
            BISAGRAS.append(P(o)); fijas.append(nodo('PuertaComun', P(o), SM.m2q(G), pa=0, m=r[0], mt=r[1]))
        continue
    if c == 'func_button' and e['targetname'] == 'button_sys': botones.append(r3(P(o)))   # (los de las puertas y las luces: se ven por sus props)
    r = caras_a_malla(bm.faces, np.zeros(3), 'FN_' + c, nav=c in ('func_wall', 'func_brush'))
    if not r: continue
    if c == 'func_button': fijas.append(nodo('Boton', P(o), pa=0, m=r[0], mt=r[1]))
    elif c in ('func_wall', 'func_brush'):   # (los vidrios de las ventanas y de la puerta de entrada, y carteles: chocan)
        solidas.append(nodo(e['targetname'] or c, P(o), pa=0, m=r[0], mt=r[1], col=[{'k': 'm', 'm': r[0], 'cv': 0, 'tr': 0}]))
    else: fijas.append(nodo(e['targetname'] or c, P(o), pa=0, m=r[0], mt=r[1]))
esc.append(fijas); esc.append(solidas)
assert set(puertas) == {'izq', 'der'} and len(botones) == 4, (puertas, botones)

# ---------------- calcomanías (infodecal): un cuadrado sobre la pared más cercana ----------------
calcos = []
def calco(e):
    o = np.array(vec(e['origin'])); tex = e['texture'].lower().replace('\\', '/')
    mi = material_de('materials/' + tex + '.vmt', 256)
    if mi is None: return
    sh, c = kv_material('materials/' + tex + '.vmt'); m = d['mt'][mi]
    if m.get('sh') == 'Mobile/Diffuse': m = None
    best = None
    for vs, n, mat in PLANOS:
        dist = np.dot(o - vs[0], n)
        if abs(dist) > 6: continue
        q = o - n * dist
        sg = [np.dot(np.cross(vs[(i + 1) % len(vs)] - vs[i], q - vs[i]), n) for i in range(len(vs))]   # (adentro del polígono)
        ok = min(sg) > -1 or max(sg) < 1
        if ok and (best is None or abs(dist) < abs(best[0])): best = (dist, n, q)
    if best is None: return
    _, n, q = best
    ti = d['mt'][mi]['t']; w, h = d['tx'][ti]['w'], d['tx'][ti]['h']
    bt = c.get('$basetexture', '').lower().replace('\\', '/')
    b = leer('materials/' + bt.removesuffix('.vtf') + '.vtf')
    if b: v = VTF.VTF.read(io.BytesIO(b)); w, h = v.width, v.height
    k = float(c.get('$decalscale', '1') or 1); w, h = w * k, h * k
    if abs(n[2]) < 0.7: u = np.cross([0, 0, 1.0], n); u /= np.linalg.norm(u); vv = np.array([0, 0, 1.0])   # (u: a la derecha de quien la mira)
    else: u = np.array([1.0, 0, 0]); vv = np.cross(n, u); vv /= np.linalg.norm(vv)
    c0 = q + n * 0.25
    esq = [c0 - u * w / 2 - vv * h / 2, c0 + u * w / 2 - vv * h / 2, c0 + u * w / 2 + vv * h / 2, c0 - u * w / 2 + vv * h / 2]
    V = [P(x) for x in esq]; ne = MS @ n; Va = np.array(V)
    md = mat_nuevo('calco_' + tex.split('/')[-1], ti, 'cut' if d['tx'][ti]['a'] else 'op')
    calcos.append((Va, ne, [(0, 0), (1, 0), (1, 1), (0, 1)], md))   # (v del juego: 0 abajo en la imagen)
for e in ents:
    if e['classname'] == 'infodecal' and not e['targetname'] and not arriba(vec(e['origin'])): calco(e)
if calcos:
    V, N, U, por = [], [], [], {}
    for Va, ne, uv, md in calcos:
        b0 = len(V); V.extend(Va); N.extend([ne] * 4); U.extend(uv); A = np.array(V)
        por.setdefault(md, []).extend(orientar((b0, b0 + 1, b0 + 2), A, ne) + orientar((b0, b0 + 2, b0 + 3), A, ne))
    mi, mats = malla_bin('FN_Calcos', V, N, U, por); esc.append([nodo('FN_Calcos', m=mi, mt=mats)])
print('calcomanías', len(calcos))

# ---------------- props ----------------
_mod, _geo = {}, {}
import pyfqmr
from scipy.spatial import cKDTree
# los props muy detallados se simplifican (en la oscuridad no se nota y pesan diez veces menos): cada modelo, según su
# tamaño (600 triángulos por metro de lado de su cara más grande, entre 80 y 2600) y cuántas veces está (los que se
# repiten más de 8 veces, menos: las 76 sillas, las 48 guirnaldas de estrellas, los 39 arcades)
TRIS_MAX, TRIS_POR_M = 2600, 600
CUENTA = collections.Counter()
def tope_tris(ruta, V):
    t = np.sort(V.max(0) - V.min(0)); lado = float(np.sqrt(t[2] * t[1])); n = max(1, CUENTA[ruta.lower()])
    return int(min(TRIS_MAX, max(80, TRIS_POR_M * lado)) * min(1.0, (8 / n) ** 0.5))
def simplificar(V, N, U, T, meta):
    """baja los triángulos de un grupo (mismo material). Los vértices repetidos en las costuras de la textura se sueldan
    antes (si no, cada pedazo es un borde y no se puede achicar) y, después, cada esquina de cada triángulo toma la normal
    y la UV del vértice original más cercano, eligiendo entre los de la costura los que quedan juntos en la textura"""
    us = np.unique(T); inv = np.full(int(T.max()) + 1, -1); inv[us] = np.arange(len(us)); v0 = V[us]; n0 = N[us]; u0 = U[us]
    _, prim, sold = np.unique(np.round(v0 / 2e-4).astype(np.int64), axis=0, return_index=True, return_inverse=True)
    sold = sold.reshape(-1); tw = sold[inv[T]]; tw = tw[(tw[:, 0] != tw[:, 1]) & (tw[:, 1] != tw[:, 2]) & (tw[:, 0] != tw[:, 2])]
    sp = pyfqmr.Simplify(); sp.setMesh(v0[prim].astype(np.float64), tw.astype(np.int32))
    sp.simplify_mesh(target_count=max(24, meta), aggressiveness=7, preserve_border=False, max_iterations=400, verbose=0)
    v1, t1, _ = sp.getMesh(); t1 = np.asarray(t1)
    if not len(t1): return v0, n0, u0, inv[T]
    # (las mallas con caras dobles o hechas de pedacitos no bajan de ahí: se juntan los vértices por celdas, cada vez más
    # grandes, hasta llegar; los triángulos que quedan sin área o repetidos se van)
    celda = float(np.linalg.norm(v0.max(0) - v0.min(0))) / 90
    while len(t1) > max(24, meta) * 1.25 and celda < 1:
        _, grupo = np.unique(np.floor(v1 / celda).astype(np.int64), axis=0, return_inverse=True); grupo = grupo.reshape(-1)
        cen = np.zeros((grupo.max() + 1, 3)); np.add.at(cen, grupo, v1); cen /= np.bincount(grupo)[:, None]
        t2 = grupo[t1]; t2 = t2[(t2[:, 0] != t2[:, 1]) & (t2[:, 1] != t2[:, 2]) & (t2[:, 0] != t2[:, 2])]
        if len(t2):
            giro = t2.argmin(1); t2 = np.stack([t2[np.arange(len(t2)), (giro + j) % 3] for j in range(3)], 1); t2 = np.unique(t2, axis=0)
        if len(t2) >= 12: v1, t1 = cen, t2
        celda *= 1.3
    k = min(6, len(v0)); dist, cand = cKDTree(v0).query(v1, k=k)
    if k == 1: dist, cand = dist[:, None], cand[:, None]
    ok = dist <= dist[:, :1] + 1.5e-3   # (los de la misma costura)
    ca, cb, cc = cand[t1[:, 0]], cand[t1[:, 1]], cand[t1[:, 2]]; oa, ob, oc = ok[t1[:, 0]], ok[t1[:, 1]], ok[t1[:, 2]]
    ua, ub, uc = u0[ca], u0[cb], u0[cc]   # (nt, k, 2)
    dab = np.abs(ua[:, :, None, None, :] - ub[:, None, :, None, :]).sum(-1); dbc = np.abs(ub[:, None, :, None, :] - uc[:, None, None, :, :]).sum(-1); dac = np.abs(ua[:, :, None, None, :] - uc[:, None, None, :, :]).sum(-1)
    costo = dab + dbc + dac + 1e6 * (~oa[:, :, None, None] | ~ob[:, None, :, None] | ~oc[:, None, None, :])
    m = costo.reshape(len(t1), -1).argmin(1); ia, ib, ic = m // (k * k), (m // k) % k, m % k; r = np.arange(len(t1))
    esq = np.stack([np.stack([t1[:, 0], ca[r, ia]], 1), np.stack([t1[:, 1], cb[r, ib]], 1), np.stack([t1[:, 2], cc[r, ic]], 1)], 1).reshape(-1, 2)
    par, idx = np.unique(esq, axis=0, return_inverse=True)
    return v1[par[:, 0]], n0[par[:, 1]], u0[par[:, 1]], idx.reshape(-1, 3)
def secuencia_pose(M, nombre):
    """posición de cada vértice en el primer cuadro de una secuencia (los props con huesos: cabezas en los estantes,
    el traje desarmado). Sin secuencias, la pose de referencia"""
    sq = {s['n'].lower(): s for s in M.secuencias}
    s = sq.get((nombre or '').lower()) or sq.get('idle') or (M.secuencias[0] if M.secuencias else None)
    Vx = M.vertices; pos = Vx['pos']; nor = Vx['nor']
    # (los compilados como "prop estático" —bit 16 del encabezado— se dibujan tal cual; los demás, con su secuencia: hay
    # modelos de un solo hueso cuya secuencia quieta los gira 90°, como las pizzas pegadas en las paredes. Las normales
    # giran con ellos: si no, la luz les da del otro lado y se ven negras)
    if s is None or struct.unpack_from('<i', M.b, 152)[0] & 16: return pos, nor
    try: P0, Q0, ok = M.pose(s['anim'], 0)
    except Exception: return pos, nor
    W0 = M.mundo(P0, Q0)
    B2M = [np.linalg.inv(np.vstack([h['p2b'], [0, 0, 0, 1]])) for h in M.huesos]
    sk = [W0[k] @ np.linalg.inv(B2M[k]) for k in range(len(M.huesos))]
    w, hb = Vx['w'], Vx['hb']; ph = np.c_[pos, np.ones(len(pos))]; Vq = np.zeros((len(pos), 3)); Nq = np.zeros((len(pos), 3))
    for c in range(3):
        for k in np.unique(hb[:, c]):
            sel = hb[:, c] == k; Vq[sel] += w[sel, c][:, None] * (ph[sel] @ sk[k].T)[:, :3]; Nq[sel] += w[sel, c][:, None] * (nor[sel] @ sk[k][:3, :3].T)
    Nq /= np.maximum(np.linalg.norm(Nq, axis=1, keepdims=True), 1e-9)
    return Vq, Nq
def modelo_estatico(ruta, piel=0, sec=None, lado=256):
    """(geometría, materiales de la piel, caja local mín/máx) de un .mdl (en su espacio, a metros) o None. La geometría
    se arma una vez por modelo (por ranura de material) y se reusa entre pieles y entre modelos iguales"""
    k = (ruta.lower(), piel, sec)
    if k in _mod: return _mod[k]
    base = ruta.lower().removesuffix('.mdl'); mdl = leer(base + '.mdl'); vvd = leer(base + '.vvd')
    vtx = next((x for x in (leer(base + e) for e in ('.dx90.vtx', '.vtx', '.dx80.vtx', '.sw.vtx')) if x), None)
    if not (mdl and vvd and vtx): _mod[k] = None; return None
    try: M = SM.Modelo(mdl, vvd, vtx); Vx = M.vertices
    except Exception as e: print('  modelo ilegible', ruta, e); _mod[k] = None; return None
    pie = M.pieles[piel] if piel < len(M.pieles) else M.pieles[0]
    pos, nor = secuencia_pose(M, sec)
    V = (MS @ pos.T).T * S; N = (MS @ nor.T).T; U = np.stack([Vx['uv'][:, 0], 1 - Vx['uv'][:, 1]], 1)
    grupos = {}
    for m in M.mallas:
        if m['modelo'] != 0 or not len(m['tris']): continue   # (de cada grupo de cuerpos, el primero)
        grupos.setdefault(m['mat'], []).append(m['tris'])
    if not grupos: _mod[k] = None; return None
    ranuras = sorted(grupos)
    clave = hashlib.md5(V.tobytes() + b''.join(np.concatenate(grupos[r]).tobytes() for r in ranuras)).hexdigest()
    if clave not in _geo:
        total = sum(len(np.concatenate(g)) for g in grupos.values()); tope = tope_tris(ruta, V)
        VV, NN, UU, por = [], [], [], {}
        for r in ranuras:
            T = np.concatenate(grupos[r])
            if total > tope * 1.15: v1, n1, u1, t1 = simplificar(V, N, U, T, int(len(T) * tope / total))
            else:
                us = np.unique(T); inv = {int(x): i for i, x in enumerate(us)}; v1, n1, u1, t1 = V[us], N[us], U[us], np.vectorize(inv.get)(T)
            b0 = len(VV); VV.extend(v1); NN.extend(n1); UU.extend(u1); Va = np.array(VV)
            por[r] = [x for t in t1 for x in orientar((b0 + int(t[0]), b0 + int(t[1]), b0 + int(t[2])), Va, NN[b0 + int(t[0])] + NN[b0 + int(t[1])] + NN[b0 + int(t[2])])]
            if M.texturas[M.pieles[0][r] if r < len(M.pieles[0]) else r].lower() in ('on', 'screen'): por[r] = por[r] + [x for i in range(0, len(por[r]), 3) for x in (por[r][i], por[r][i + 2], por[r][i + 1])]
        Va = np.array(VV)
        _geo[clave] = (np.array(VV), np.array(NN), np.array(UU), por, ranuras, (Va.min(0), Va.max(0)))
    VV, NN, UU, por, ranuras, caja = _geo[clave]
    mats = []
    for r in ranuras:
        ti = pie[r] if r < len(pie) else r; tn = M.texturas[ti].lower().replace('\\', '/'); m_ = None
        for cd in M.carpetas:
            m_ = material_de('materials/' + cd.lower().replace('\\', '/').strip('/') + '/' + tn + '.vmt', lado)
            if m_ is not None: break
        if m_ is None: m_ = material_vecino(M.carpetas, tn)
        if m_ is None: SIN_TEX.setdefault(os.path.basename(base), set()).add(tn); m_ = mat_color((110, 110, 110))
        mats.append(m_)
    _mod[k] = (clave, mats, caja); return _mod[k]
SIN_TEX = {}
def material_vecino(carpetas, tn):
    """un material que el modelo pide y no está en su carpeta, buscado cerca: la textura suelta en esa carpeta, el
    mismo .vmt en una carpeta hermana o la textura en la de arriba"""
    for cd in carpetas:
        c = cd.lower().replace('\\', '/').strip('/')
        if not c: continue
        for v in (c + '/' + tn, c + '/' + tn + 'color'):
            tx = textura('materials/' + v + '.vtf', v, 256)
            if tx: return mat_nuevo(tn, tx[0], 'op')
        padre = c.rsplit('/', 1)[0]
        tx = textura('materials/' + padre + '/' + tn + '.vtf', padre + '/' + tn, 256)
        if tx: return mat_nuevo(tn, tx[0], 'op')
    return None
# lo que el juego reemplaza o lo que es de los eventos: los animatrónicos de cuerpo entero (el juego trae los suyos, que
# caminan), los de FNAF 2 que el mapa pone y no trae, y lo de la sala de control
NO_VAN = re.compile(r'i6nis/(freddy/freddy_(far|close|closest|gold)|bonnie/bonnie2?\.mdl|chica/chica\.mdl|foxy/|purplefreddy/purplefreddy\.mdl)|splinks/|ffp/(goldfreddy|shadowfreddy|purple|chessboard|batdolman|deceased)|demon_black')
CHICOS = ('partyhat', 'plush', 'pizza', 'cupcake', 'bottle', 'cup', 'phone', 'doll', 'stars', 'present', 'balloon', 'plate', 'tray', 'cable', 'sign', 'cloud', 'sunthing', 'microphone', 'guitar', 'light', 'extinguisher', 'firealarm', 'clock', 'camera', 'handle', 'box0')
INST = []   # (geometría, materiales, matriz 4x4 al mundo, nombre) de cada prop: después se juntan por zona
cajas_col = []   # (p, R3, centro, medio-largo) de los props que chocan (para la grilla de los caminos)
props_col = [nodo('FN_PropsChoque')]
faltan = collections.Counter()
camaras_prop = []
def poner_prop(ruta, origen, ang, esc_=1.0, piel=0, solido_=True, nombre=None, sec=None):
    ruta = ruta.lower()
    if NO_VAN.search(ruta): return
    r = modelo_estatico(ruta, piel, sec)
    if r is None: faltan[ruta] += 1; return
    clave, mats, (lo, hi) = r
    Rm, pe = R(ang_mat(*ang)), P(origen)
    if 'door_handle' in ruta and BISAGRAS:   # (la manija va con su puerta, que se dibuja abierta)
        b = min(BISAGRAS, key=lambda h: np.hypot(*(h - pe)[[0, 2]]))
        if np.hypot(*(b - pe)[[0, 2]]) < 2.2: G = R(ang_mat(0, 90, 0)); pe = b + G @ (pe - b); Rm = G @ Rm
    W = np.eye(4); W[:3, :3] = Rm * esc_; W[:3, 3] = pe
    INST.append((clave, mats, W, nombre or os.path.basename(ruta)[:-4]))
    t = (hi - lo) * esc_
    if 'securitycamera' in ruta: camaras_prop.append(pe)
    if solido_ and max(t) > 0.25 and t[1] > 0.12 and not any(s in ruta for s in CHICOS):
        cen, med = (lo + hi) / 2 * esc_, t / 2
        props_col.append(nodo(nombre or os.path.basename(ruta)[:-4], pe, SM.m2q(Rm), pa=0, col=[{'k': 'b', 'c': cen.tolist(), 's': t.tolist(), 'tr': 0}]))
        cajas_col.append((pe, Rm, cen, med))
def props_ent():
    for e in ents:
        c = e['classname']
        if not c.startswith('prop_') or not e['model']: continue
        o = vec(e['origin'])
        if arriba(o) or not se_ve(e) or e['parentname']: continue
        yield e, o
for sp in bsp.props:
    if not arriba([sp.origin.x, sp.origin.y, sp.origin.z]) and not NO_VAN.search(sp.model.lower()): CUENTA[sp.model.lower()] += 1
for e, o in props_ent():
    if not NO_VAN.search(e['model'].lower()): CUENTA[e['model'].lower()] += 1
for sp in bsp.props:
    o = [sp.origin.x, sp.origin.y, sp.origin.z]
    if arriba(o): continue
    ee = sp.scaling; ee = float(ee.x) if hasattr(ee, 'x') else float(ee or 1.0)
    poner_prop(sp.model, o, (sp.angles.pitch, sp.angles.yaw, sp.angles.roll), ee or 1.0, sp.skin, int(sp.solidity) != 0)
for e, o in props_ent():
    poner_prop(e['model'], o, vec(e['angles']), float(e['modelscale'] or 1), int(e['skin'] or 0), (e['solid'] or '6') != '0', e['targetname'] or None, e['DefaultAnim'] or None)
# (los vidrios de la puerta de entrada van con su puerta)
print('props', len(INST), 'modelos', len([v for v in _mod.values() if v]), 'geometrías', len(_geo), 'que chocan', len(props_col) - 1)
print('faltan', dict(faltan))
for n_, (p_, R3_, c_, e_) in zip(props_col[1:], cajas_col):
    if DBG and max(e_) > 1.25: print('   caja grande', n_['n'], r3(p_), r3(e_ * 2))
print('texturas de props que no vinieron:', {k: sorted(v) for k, v in SIN_TEX.items()})

# ---------------- los props juntos por zona ----------------
ZONA = 8.0
porZona = collections.defaultdict(lambda: collections.defaultdict(list))
for clave, mats, W, nom in INST:
    VV, NN, UU, por, ranuras, caja = _geo[clave]
    c = W[:3, :3] @ ((caja[0] + caja[1]) / 2) + W[:3, 3]
    z = (int(math.floor(c[0] / ZONA)), int(math.floor(c[2] / ZONA)))
    for r, mi in zip(ranuras, mats): porZona[z][mi].append((clave, r, W))
lotes = [nodo('FN_Props')]; ntri = 0
for z, pm in sorted(porZona.items()):
    V, N, U, por = [], [], [], {}
    for mi, L in pm.items():
        for clave, r, W in L:
            VV, NN, UU, pr, _, _ = _geo[clave]
            idx = np.array(pr[r]).reshape(-1, 3); us = np.unique(idx); inv = np.full(len(VV), -1); inv[us] = np.arange(len(us)) + len(V)
            Rw = W[:3, :3]; Ninv = np.linalg.inv(Rw).T
            vw = (Rw @ VV[us].T).T + W[:3, 3]; nw = (Ninv @ NN[us].T).T; nw /= np.maximum(np.linalg.norm(nw, axis=1, keepdims=True), 1e-9)
            V.extend(vw); N.extend(nw); U.extend(UU[us])
            t = inv[idx]
            if np.linalg.det(Rw) < 0: t = t[:, [0, 2, 1]]
            por.setdefault(mi, []).extend(t.reshape(-1).tolist()); ntri += len(t)
    mi_, mats_ = malla_bin('FN_Lote_%d_%d' % z, V, N, U, por)
    lotes.append(nodo('Lote_%d_%d' % z, pa=0, m=mi_, mt=mats_))
esc.append(lotes); esc.append(props_col)
if DBG:
    cuenta = collections.Counter(); tri_g = {}
    for clave, mats, W, nom in INST: cuenta[(clave, nom)] += 1
    for (clave, nom), n in sorted(cuenta.items(), key=lambda kv: -kv[1] * sum(len(v) for v in _geo[kv[0][0]][3].values()) // 3):
        t = sum(len(v) for v in _geo[clave][3].values()) // 3; c0 = _geo[clave][5]
        print('   %-40s x%3d  %5d tri  = %7d   tam %s' % (nom[:40], n, t, n * t, np.round(c0[1] - c0[0], 2)))
print('zonas', len(lotes) - 1, '· triángulos de props', ntri, '· partes', sum(len(pm) for pm in porZona.values()))

# ---------------- la cortina de Pirate Cove: dos paños que el juego junta a los costados cuando Foxy se asoma ----------------
# (el mapa no tiene: la cueva quedaba abierta y Foxy, a la vista). Va en la boca de la cueva, de pared a pared, colgada
# del techo; cada paño cuelga de su borde de afuera y el juego lo achica hacia ese borde
FOXY_S = np.array(vec(next(e for e in ents if e['targetname'] == 'foxy')['origin']))
TRACK = [np.array(vec(e['origin'])) for nm in ('foxytrack1', 'foxytrack2') for e in EN.get(nm, [])]
salida = TRACK[1] - TRACK[0]; salida[2] = 0; salida /= np.linalg.norm(salida)   # (para dónde sale Foxy de la cueva)
def rayo_pared(o, dirn, tmax=1200, paso=2):
    """distancia hasta la primera brocha sólida en una dirección (en Source)"""
    for t in np.arange(paso, tmax, paso):
        if solido(o + dirn * t): return t
    return tmax
BOCA_S = float(os.environ.get('FN_BOCA', '0') or 0)   # (cuánto más afuera de Foxy está la boca, en unidades de Source; 0: se busca)
ti_c = textura('materials/models/i6nis/foxy/stage_curtains.vtf', 'stage_curtains', 512)
if ti_c:
    lat = np.array([-salida[1], salida[0], 0.0]); alt = 40
    if not BOCA_S:   # (la boca: donde la cueva se abre, yendo hacia la salida)
        ancho0 = rayo_pared(FOXY_S + [0, 0, alt], lat, 400) + rayo_pared(FOXY_S + [0, 0, alt], -lat, 400)
        for t in np.arange(0, 400, 4):
            q = FOXY_S + salida * t + np.array([0, 0, alt])
            if rayo_pared(q, lat, 600) + rayo_pared(q, -lat, 600) > ancho0 + 120: BOCA_S = t - 6; break
    boca = FOXY_S + salida * BOCA_S + np.array([0, 0, alt])
    a1, a2 = rayo_pared(boca, lat, 400), rayo_pared(boca, -lat, 400); techo = rayo_pared(boca, np.array([0, 0, 1.0]), 300)
    cen = boca + lat * (a1 - a2) / 2; ancho = (a1 + a2) * S; alto = (alt + techo - FOXY_S[2] - 1) * S
    mc = mat_nuevo('cortina_pirata', ti_c[0], 'cut')
    yg = np.array([0, 1.0, 0]); zg = MS @ salida; xg = np.cross(yg, zg); Rg = np.stack([xg, yg, zg], 1)
    lg = MS @ lat; sgx = 1 if np.dot(lg, xg) > 0 else -1
    top = P(cen + np.array([0, 0, techo - 1]))
    for lado, sg in (('Izq', 1), ('Der', -1)):
        an = ancho / 2 + 0.1; Va = np.array([[0, 0, 0], [-sg * an, 0, 0], [-sg * an, -alto, 0], [0, -alto, 0]], float)
        # (la textura es un atlas: arriba los dos paños con estrellas, abajo un cuadro negro; cada paño toma el suyo,
        # derecho: v del juego = 1 - v de la imagen; en la imagen, de 0,105 a 0,498 de alto)
        ua, ub = (0.022, 0.438) if lado == 'Izq' else (0.931, 0.527); vt, vb = 1 - 0.108, 1 - 0.495
        U4 = [(ua, vt), (ub, vt), (ub, vb), (ua, vb)]
        n = np.array([0, 0, 1.0]); tri = orientar((0, 1, 2), Va, n) + orientar((0, 2, 3), Va, n)
        mi_c, mats_c = malla_bin('FN_Cortina' + lado, list(Va) * 2, [n] * 4 + [-n] * 4, U4 * 2, {mc: list(tri) + [t + 4 for t in orientar((0, 1, 2), Va, -n) + orientar((0, 2, 3), Va, -n)]})
        esc.append([nodo('FN_Cortina' + lado, top + xg * sg * ancho / 2, SM.m2q(Rg), m=mi_c, mt=mats_c)])
    FN['cortina'] = {'ancho': round(float(ancho), 3)}
    print('cortina de Pirate Cove: boca a', round(BOCA_S * S, 2), 'm de Foxy, ancho', round(ancho, 2), 'alto', round(alto, 2))

# ---------------- por dónde caminan los animatrónicos ----------------
# Grilla de 20 cm sobre el piso: altura del piso en cada celda (de los triángulos que miran para arriba), bloqueada donde
# hay paredes o muebles a la altura del cuerpo (con 35 cm de margen). Entre las salas de FNAF 1 (cada una con el lugar
# donde se para cada animatrónico) los caminos salen con A* y se estiran en línea recta donde se puede.
import heapq
from scipy import ndimage
def nav_grilla(tris, cajas):
    CEL = 0.2
    x0, z0 = tris[:, :, 0].min() - 1, tris[:, :, 2].min() - 1; x1, z1 = tris[:, :, 0].max() + 1, tris[:, :, 2].max() + 1
    nx, nz = int((x1 - x0) / CEL) + 1, int((z1 - z0) / CEL) + 1
    H = np.full((nz, nx), -99.0); B = np.zeros((nz, nx), bool)
    n = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0]); n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
    for t, ny in zip(tris, n[:, 1]):
        if ny > 0.7 and t[:, 1].max() < 1.6:   # piso (no techos ni mesadas altas)
            i0, i1 = int((t[:, 0].min() - x0) / CEL), int((t[:, 0].max() - x0) / CEL) + 1; j0, j1 = int((t[:, 2].min() - z0) / CEL), int((t[:, 2].max() - z0) / CEL) + 1
            xs, zs = np.meshgrid(x0 + (np.arange(i0, i1 + 1) + 0.5) * CEL, z0 + (np.arange(j0, j1 + 1) + 0.5) * CEL)
            a, b, c = t[0][[0, 2]], t[1][[0, 2]], t[2][[0, 2]]; v0, v1 = b - a, c - a; den = v0[0] * v1[1] - v1[0] * v0[1]
            if abs(den) < 1e-12: continue
            px, pz = xs - a[0], zs - a[1]; u = (px * v1[1] - v1[0] * pz) / den; v = (v0[0] * pz - px * v0[1]) / den
            dentro = (u >= -1e-4) & (v >= -1e-4) & (u + v <= 1 + 1e-4); y = t[0][1] + u * (t[1][1] - t[0][1]) + v * (t[2][1] - t[0][1])
            jj, ii = np.nonzero(dentro); jj += j0; ii += i0; ok = (jj < nz) & (ii < nx); jj, ii = jj[ok], ii[ok]
            H[jj, ii] = np.maximum(H[jj, ii], y[dentro][ok])
        elif abs(ny) < 0.7 and t[:, 1].max() > 0.6 and t[:, 1].min() < 2.3:   # pared a la altura del cuerpo
            for s in np.linspace(0, 1, 12):
                for r in np.linspace(0, 1 - s, max(2, int(12 * (1 - s)))):
                    p = t[0] + (t[1] - t[0]) * s + (t[2] - t[0]) * r
                    if 0.6 < p[1] < 2.4: B[min(nz - 1, int((p[2] - z0) / CEL)), min(nx - 1, int((p[0] - x0) / CEL))] = True
            for k in range(3):   # (y los bordes, finos)
                a, b = t[k], t[(k + 1) % 3]
                for s in np.linspace(0, 1, max(2, int(np.linalg.norm(b - a) / 0.08))):
                    p = a + (b - a) * s
                    if 0.6 < p[1] < 2.4: B[min(nz - 1, int((p[2] - z0) / CEL)), min(nx - 1, int((p[0] - x0) / CEL))] = True
    for (p, R3, c, e) in cajas:   # muebles: su planta (los que llegan a la altura de las piernas)
        es = [p + R3 @ (c + e * np.array(s)) for s in ((1, 1, 1), (-1, 1, 1), (1, 1, -1), (-1, 1, -1), (1, -1, 1), (-1, -1, 1), (1, -1, -1), (-1, -1, -1))]
        lo, hi = np.min(es, 0), np.max(es, 0)
        if hi[1] - lo[1] < 0.25: continue
        for xx in np.arange(lo[0], hi[0] + 0.1, 0.1):
            for zz in np.arange(lo[2], hi[2] + 0.1, 0.1):
                l = R3.T @ (np.array([xx, p[1] + (R3 @ c)[1], zz]) - p) - c
                if abs(l[0]) <= e[0] + 0.02 and abs(l[2]) <= e[2] + 0.02: B[min(nz - 1, max(0, int((zz - z0) / CEL))), min(nx - 1, max(0, int((xx - x0) / CEL)))] = True
    yy, xx = np.mgrid[-2:3, -2:3]; B = ndimage.binary_dilation(B, structure=(xx * xx + yy * yy) <= 3)   # (35 cm de margen)
    libre = (H > -50) & ~B
    return dict(x0=x0, z0=z0, cel=CEL, nx=nx, nz=nz, H=H, libre=libre)
def nav_celda(G, x, z):
    i, j = int((x - G['x0']) / G['cel']), int((z - G['z0']) / G['cel'])
    if 0 <= i < G['nx'] and 0 <= j < G['nz'] and G['libre'][j, i]: return j, i
    best = None   # (la libre más cercana)
    for r in range(1, 25):
        for dj in range(-r, r + 1):
            for di in (-r, r) if abs(dj) < r else range(-r, r + 1):
                jj, ii = j + dj, i + di
                if 0 <= jj < G['nz'] and 0 <= ii < G['nx'] and G['libre'][jj, ii]:
                    d2 = dj * dj + di * di
                    if best is None or d2 < best[0]: best = (d2, (jj, ii))
        if best: return best[1]
    return None
def nav_ver(G, a, b):   # ¿línea recta libre entre dos celdas (y sin escalones)?
    (j0, i0), (j1, i1) = a, b; n = max(abs(j1 - j0), abs(i1 - i0)) * 2 + 1; hp = G['H'][j0, i0]
    for s in np.linspace(0, 1, n):
        j, i = int(round(j0 + (j1 - j0) * s)), int(round(i0 + (i1 - i0) * s))
        if not G['libre'][j, i] or abs(G['H'][j, i] - hp) > 0.25: return False
        hp = G['H'][j, i]
    return True
def nav_camino(G, a, b):
    if a == b: return [a]
    abiertos = [(0, a)]; g = {a: 0}; vino = {}
    while abiertos:
        _, c = heapq.heappop(abiertos)
        if c == b: break
        for dj, di in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            nj, ni = c[0] + dj, c[1] + di
            if not (0 <= nj < G['nz'] and 0 <= ni < G['nx']) or not G['libre'][nj, ni]: continue
            if abs(G['H'][nj, ni] - G['H'][c]) > 0.7: continue   # (el escalón del escenario sí; una pared no)
            if dj and di and not (G['libre'][c[0] + dj, c[1]] and G['libre'][c[0], c[1] + di]): continue
            ng = g[c] + (1.4142 if dj and di else 1) + (2 if abs(G['H'][nj, ni] - G['H'][c]) > 0.1 else 0)
            if ng < g.get((nj, ni), 1e18): g[(nj, ni)] = ng; vino[(nj, ni)] = c; heapq.heappush(abiertos, (ng + np.hypot(nj - b[0], ni - b[1]), (nj, ni)))
    if b not in vino: return None
    cs = [b]
    while cs[-1] != a: cs.append(vino[cs[-1]])
    cs.reverse(); out = [cs[0]]; k = 0   # (estirado: de cada punto, al más lejano que se ve derecho)
    while k < len(cs) - 1:
        m = len(cs) - 1
        while m > k + 1 and not nav_ver(G, cs[k], cs[m]): m -= 1
        out.append(cs[m]); k = m
    return out
tris_nav = np.concatenate([TRIS[k] for k in TRIS])
G = nav_grilla(tris_nav, cajas_col)
# las salas de FNAF 1 en este mapa (en Source: x, y, mirando a yaw grados) y dónde se para cada uno (F Freddy, B Bonnie,
# C Chica, X Foxy). Las del mapa (donde sus eventos ponen a cada uno) cuando están en la sala que corresponde
SALAS_S = {
    'escenario': {'F': (-558, 95, 90), 'B': (-440, 76, 100), 'C': (-650, 72, 80)},
    'comedor': {'F': (-912, 728, 60), 'B': (-330, 560, 110), 'C': (-512, 504, 116)},
    'pirata': {'X': (tuple(FOXY_S[:2]) + (math.degrees(math.atan2(salida[1], salida[0])),))},
    'atras': {'B': (210, 690, 200)},
    'oeste': {'B': (-224, 1284, 90), 'X': (-224, 1350, 90)},
    'armario': {'B': (-120, 1660, 142)},
    'este': {'F': (-712, 1450, 90), 'C': (-711, 1360, 90)},
    'cocina': {'F': (-1100, 1350, 300), 'C': (-1000, 1300, 300)},
    'banos': {'F': (-1272, 288, 46), 'C': (-1200, 120, 87)},
}
# las esquinas: afuera de cada puerta, en la luz del pasillo, mirando a la oficina; adentro de la oficina, cerca de su puerta
for lado, nm in (('izq', 'esqO'), ('der', 'esqE')):
    k_s = next(k for k, v in LADO_DE.items() if v == lado); po = pu_s[k_s]; afuera = (po - OF_C); afuera[2] = 0; afuera /= np.linalg.norm(afuera)
    yaw_in = math.degrees(math.atan2(-afuera[1], -afuera[0])); p1 = po + afuera * 40; p2 = po - afuera * 70
    SALAS_S[nm] = {k: (p1[0], p1[1], yaw_in) for k in ('F', 'B', 'C', 'X')}
    SALAS_S.setdefault('oficina', {}).update({k: (p2[0], p2[1], yaw_in) for k in (('B', 'X') if lado == 'izq' else ('F', 'C'))})
salas, caminos, malos = {}, {}, []
for sala, sp in SALAS_S.items():
    salas[sala] = {}
    for k, (x, y, yaw) in sp.items():
        g = P([x, y, 0]); c = nav_celda(G, g[0], g[2]); assert c, (sala, k)
        salas[sala][k] = [round(G['x0'] + (c[1] + 0.5) * G['cel'], 3), round(float(G['H'][c]), 3), round(G['z0'] + (c[0] + 0.5) * G['cel'], 3), round(math.radians(yaw), 4)]
GRAFO = {'F': [('escenario', 'comedor'), ('comedor', 'banos'), ('banos', 'cocina'), ('cocina', 'este'), ('este', 'esqE'), ('esqE', 'oficina'), ('esqE', 'este'), ('este', 'comedor')],
         'B': [('escenario', 'comedor'), ('escenario', 'atras'), ('comedor', 'atras'), ('comedor', 'oeste'), ('atras', 'oeste'), ('oeste', 'armario'), ('oeste', 'esqO'), ('armario', 'esqO'), ('esqO', 'oficina'), ('esqO', 'oeste'), ('esqO', 'comedor')],
         'C': [('escenario', 'comedor'), ('comedor', 'banos'), ('comedor', 'cocina'), ('banos', 'cocina'), ('banos', 'este'), ('cocina', 'este'), ('este', 'esqE'), ('esqE', 'oficina'), ('esqE', 'este'), ('este', 'comedor')],
         'X': [('pirata', 'oeste'), ('oeste', 'esqO'), ('esqO', 'oficina')]}
# (las puertas de la oficina, cerradas o abiertas, no cuentan para los caminos: las celdas del vano quedan libres)
for k, aristas in GRAFO.items():
    for a, b in aristas:
        for u, v in ((a, b), (b, a)):
            ca, cb = nav_celda(G, salas[u][k][0], salas[u][k][2]), nav_celda(G, salas[v][k][0], salas[v][k][2])
            cm = nav_camino(G, ca, cb)
            if not cm: malos.append((k, u, v)); continue
            caminos[k + ':' + u + '>' + v] = [[round(G['x0'] + (j_i[1] + 0.5) * G['cel'], 2), round(float(G['H'][j_i]), 2), round(G['z0'] + (j_i[0] + 0.5) * G['cel'], 2)] for j_i in cm]
if DBG:
    os.makedirs(DBG, exist_ok=True)
    np.save(DBG + '/nav_libre.npy', G['libre']); np.save(DBG + '/nav_H.npy', G['H']); json.dump({k: G[k] for k in ('x0', 'z0', 'cel', 'nx', 'nz')}, open(DBG + '/nav.json', 'w'))
    json.dump(caminos, open(DBG + '/nav_caminos.json', 'w')); json.dump(salas, open(DBG + '/nav_salas.json', 'w'))
assert not malos, ('sin camino', malos)
FN.update(salas=salas, caminos=caminos)
FN['cueva'] = r3((MS @ salida)[[0, 2]] * 0.62)   # (Foxy, más afuera de la cueva en cada etapa)

# ---------------- la oficina para el juego ----------------
def S2G(v): return r3(P(v))
lamp = next(e for e in ents if e['targetname'] == 'light_ceiling' and e['classname'] == 'light_spot')
luz_p = {}
for nm in ('Flashlight_l', 'Flashlight_r'):
    e = next(x for x in ents if x['targetname'] == nm and x['classname'] == 'light_spot'); o = np.array(vec(e['origin']))
    lado = 'izq' if np.dot(o - OF_C, izq_s) > 0 else 'der'
    luz_p[lado] = {'p': S2G(o + np.array([0, 0, 20])), 'd': r3(MS @ (np.array([0, 0, -1.0]) + (o - OF_C) / np.linalg.norm(o - OF_C) * 0.35))}
# la caja de la oficina: entre las puertas (de lado a lado) y de pared a pared hacia adelante y hacia atrás
adelante = rayo_pared(OF_C + np.array([0, 0, 40]), frente, 600); atras_ = rayo_pared(OF_C + np.array([0, 0, 40]), -frente, 600)
esq = [OF_C + frente * adelante, OF_C - frente * atras_, pu_s['Securitydoor_l'], pu_s['Securitydoor_r']]
cg = np.array([P(x) for x in esq]); mrg = 0.12
caja_of = [round(float(cg[:, 0].min() + mrg), 3), round(float(cg[:, 0].max() - mrg), 3), round(float(cg[:, 2].min() + mrg), 3), round(float(cg[:, 2].max() - mrg), 3)]
FN['oficina'] = {'c': S2G(OF_C - np.array([0, 0, OF_C[2]])), 'caja': caja_of, 'yaw': round(math.atan2(frente[1], frente[0]), 4),
                 'lampara': S2G(np.array(vec(lamp['origin'])) - np.array([0, 0, 6])), 'luces': luz_p,
                 'vent': S2G(OF_C + frente * (adelante - 30) + izq_s * 60 + np.array([0, 0, 30 - OF_C[2]]))}
print('oficina para el juego', FN['oficina'])

# ---------------- cámaras ----------------
camaras = []
for e in ents:
    if e['classname'] != 'point_camera' or arriba(vec(e['origin'])) or e['targetname'] in ('am', 'Cam_black'): continue
    a = vec(e['angles']); f = MS @ ang_mat(*a)[:, 0]
    camaras.append({'p': S2G(vec(e['origin'])), 'f': [round(x, 4) for x in f.tolist()], 'n': e['targetname']})
camaras.sort(key=lambda c: int(re.sub(r'\D', '', c['n']) or 0))
# Las cámaras del mapa son las de sus eventos: varias no ven la sala de FNAF que les tocaría (la del armario mira una
# pared, la de atrás del escenario mira otro cuarto). Cada cámara de FNAF se pone acá: arriba, cerca del techo de su
# sala, donde se ven todos los lugares donde se paran los animatrónicos de esa sala (sin paredes ni muebles en el medio),
# a 4-8 m y con pared atrás (en un rincón, como en FNAF). Pirate Cove, desde afuera de la cortina; las esquinas, desde el
# pasillo (no desde adentro de la oficina)
def s_de_g(g): return np.array([g[2], g[0], g[1]]) / S
_CP = np.array([x[0] for x in cajas_col]); _CR = np.array([x[1] for x in cajas_col]); _CC = np.array([x[2] for x in cajas_col]); _CE = np.array([x[3] for x in cajas_col])
_TV = np.concatenate([TRIS[k] for k in TRIS]); _TA = _TV[:, 0]; _TE1 = _TV[:, 1] - _TA; _TE2 = _TV[:, 2] - _TA
_TLO, _THI = _TV.min(1), _TV.max(1)
def se_ve_s(a, b):
    """línea libre entre dos puntos de Source: contra lo que se dibuja (las caras del mapa: hay brochas sólidas que no se
    ven, de los eventos) y las cajas de los muebles"""
    n = max(3, int(np.linalg.norm(b - a) / 4))
    qs = a + (b - a) * np.linspace(0, 1, n)[1:-1, None]
    g = (MS @ qs.T).T * S
    l = np.einsum('mji,nmj->nmi', _CR, g[:, None, :] - _CP[None]) - _CC[None]
    if np.any(np.all(np.abs(l) <= _CE[None], 2)): return False
    o, e = P(a), P(b); dv = e - o
    sel = np.all((_THI >= np.minimum(o, e) - 0.01) & (_TLO <= np.maximum(o, e) + 0.01), 1)
    if not sel.any(): return True
    e1, e2, ta = _TE1[sel], _TE2[sel], _TA[sel]
    pv = np.cross(dv, e2); det = np.einsum('ij,ij->i', e1, pv); ok = np.abs(det) > 1e-9; inv = np.where(ok, 1 / np.where(ok, det, 1), 0)
    tv = o - ta; u = np.einsum('ij,ij->i', tv, pv) * inv; qv = np.cross(tv, e1); v = (qv @ dv) * inv; t = np.einsum('ij,ij->i', e2, qv) * inv
    return not np.any(ok & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 0.02) & (t < 0.98))
def rayo_vis(o, dirn, tmax=1200, paso=None):
    """como rayo_pared, contra lo que se dibuja: distancia (en Source) hasta la primera cara"""
    a, e = P(o), P(o + dirn * tmax); dv = e - a
    sel = np.all((_THI >= np.minimum(a, e) - 0.01) & (_TLO <= np.maximum(a, e) + 0.01), 1)
    if not sel.any(): return tmax
    e1, e2, ta = _TE1[sel], _TE2[sel], _TA[sel]
    pv = np.cross(dv, e2); det = np.einsum('ij,ij->i', e1, pv); ok = np.abs(det) > 1e-9; inv = np.where(ok, 1 / np.where(ok, det, 1), 0)
    tv = a - ta; u = np.einsum('ij,ij->i', tv, pv) * inv; qv = np.cross(tv, e1); v = (qv @ dv) * inv; t = np.einsum('ij,ij->i', e2, qv) * inv
    t = t[ok & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 1e-4)]
    return float(t.min() * tmax) if len(t) else tmax
def en_oficina_g(g): return caja_of[0] - 0.3 < g[0] < caja_of[1] + 0.3 and caja_of[2] - 0.3 < g[2] < caja_of[3] + 0.3
CAM_CASI = {}
def cam_sala(sala, extra=()):
    pts = [s_de_g(v) for v in salas[sala].values()] + [s_de_g(v) for v in extra]
    ob = [p + np.array([0, 0, h]) for p in pts for h in (36, 66)]   # (de las rodillas a la cara)
    for q in (ob if DBG else ()):   # (lo que tapa justo donde se paran: para revisar)
        g = P(q); l = np.einsum('mji,mj->mi', _CR, g[None] - _CP) - _CC
        for k_ in np.nonzero(np.all(np.abs(l) <= _CE, 1))[0]: print('    ', sala, 'tapado por', props_col[k_ + 1]['n'], r3(g))
    cen = np.mean(pts, 0); piso = cen[2]
    techo = min(rayo_vis(p + np.array([0, 0, 40]), np.array([0, 0, 1.0]), 300) + p[2] + 40 for p in pts)
    zc = min(piso + 112, techo - 10)
    mejor = None
    for ang in np.radians(np.arange(0, 360, 7.5)):
        dh = np.array([math.cos(ang), math.sin(ang), 0.0]); o = np.array([cen[0], cen[1], zc])
        tope = rayo_vis(o, dh, 420, 3) - 12
        for r in np.arange(110, tope, 14):
            c = o + dh * r
            if en_oficina_g(P(c)): continue
            if sala == 'pirata' and np.dot(c[:2] - FOXY_S[:2], salida[:2]) < BOCA_S + 30: continue
            dists = [np.linalg.norm((q - c)[:2]) for q in pts]
            if min(dists) < 120: continue   # (ni encima de uno)
            mh = np.mean(pts, 0)[:2] - c[:2]; mh /= np.linalg.norm(mh)
            if min(np.dot((q[:2] - c[:2]) / np.linalg.norm(q[:2] - c[:2]), mh) for q in pts) < math.cos(math.radians(30)): continue   # (todos en el cuadro)
            frente_ = np.mean([np.dot((c - q)[:2] / max(1e-6, np.linalg.norm((c - q)[:2])), [math.cos(v[3] - 0), math.sin(v[3])]) for q, v in zip(pts, list(salas[sala].values()) + [[0, 0, 0, salas[sala][next(iter(salas[sala]))][3]]] * len(extra))])
            if (sala == 'escenario' and frente_ < 0.3) or (sala == 'pirata' and frente_ < 0.7): continue   # (del lado del público; la cortina, de frente)
            # (nada pegado delante: ni un cartel ni el marco de una puerta tapando medio cuadro)
            md = np.mean(pts, 0) + np.array([0, 0, 50]) - c; md /= np.linalg.norm(md); lt = np.array([-md[1], md[0], 0.0]); lt /= max(1e-6, np.linalg.norm(lt)); up = np.cross(lt, md)
            if min(rayo_vis(c, (md + lt * a_ + up * b_) / np.linalg.norm(md + lt * a_ + up * b_), 60) for a_ in (-0.6, 0, 0.6) for b_ in (-0.3, 0.3)) < 50: continue
            vis = sum(se_ve_s(c, q + np.array([0, 0, 66])) or se_ve_s(c, q + np.array([0, 0, 36])) for q in pts) / len(pts)   # (cada uno, de la cara o de las rodillas)
            if vis < 0.99:
                CAM_CASI[sala] = max(CAM_CASI.get(sala, 0), vis); continue
            dist = np.mean(dists)
            atras = rayo_vis(c, -dh, 120, 3)   # (pared atrás: un rincón)
            lado = min(rayo_vis(c, np.array([-dh[1], dh[0], 0]), 120, 3), rayo_vis(c, np.array([dh[1], -dh[0], 0]), 120, 3))
            nota = -abs(dist - 230) / 60 - atras / 40 - lado / 80 + frente_ * 1.2
            if mejor is None or nota > mejor[0]: mejor = (nota, c, dist)
    assert mejor, ('sin lugar para la cámara de', sala, CAM_CASI.get(sala))
    _, c, dist = mejor
    mira = np.mean(ob, 0); f = MS @ ((mira - c) / np.linalg.norm(mira - c))
    camaras.append({'p': S2G(c), 'f': [round(float(x), 4) for x in f], 'n': 'FN_' + sala})
    print('  cámara', sala, 'a', round(dist * S, 1), 'm', S2G(c))
    return len(camaras) - 1
# (Foxy también se ve en las etapas en que se asoma, y cuando corre por el pasillo oeste)
CUEVA_G = [[salas['pirata']['X'][0] + FN['cueva'][0] * k, salas['pirata']['X'][1], salas['pirata']['X'][2] + FN['cueva'][1] * k] for k in (1, 2)]
# las de FNAF 1: [cámara (-1: no hay, sólo audio), número, nombre, sala, a qué sala apunta (las esquinas), cuánto gira]
FN['cams'] = [[cam_sala('escenario'), '1A', 'fn.c1a', 'escenario', None, 0.14], [cam_sala('comedor'), '1B', 'fn.c1b', 'comedor', None, 0.12],
              [cam_sala('pirata', CUEVA_G), '1C', 'fn.c1c', 'pirata', None, 0.1], [cam_sala('oeste'), '2A', 'fn.c2a', 'oeste', None, 0.3],
              [cam_sala('esqO'), '2B', 'fn.c2b', 'esqO', None, 0.12], [cam_sala('armario'), '3', 'fn.c3', 'armario', None, 0.14],
              [cam_sala('este'), '4A', 'fn.c4a', 'este', None, 0.3], [cam_sala('esqE'), '4B', 'fn.c4b', 'esqE', None, 0.12],
              [cam_sala('atras'), '5', 'fn.c5', 'atras', None, 0.14], [-1, '6', 'fn.c6', 'cocina'], [cam_sala('banos'), '7', 'fn.c7', 'banos', None, 0.18]]

# ---------------- plano de las cámaras: el mapa visto de arriba, como en FNAF (el escenario arriba, la oficina abajo) ----------------
# en la pantalla, x = la izquierda del guardia a la izquierda; y = de la oficina (abajo) al escenario (arriba). Los
# bordes van dados vuelta cuando hace falta (x0 > x1): las cuentas del juego son las mismas
ofg = P(OF_C); fg = MS @ frente; izg = MS @ izq_s
pts = np.array([P([x, y, 0]) for x in (-1540, 720) for y in (-60, 2620)])
xs, zs = pts[:, 0], pts[:, 2]
MAPA = {'x1': float(xs.min() if fg[0] < 0 else xs.max()), 'x0': float(xs.max() if fg[0] < 0 else xs.min()),
        'z0': float(zs.max() if izg[2] > 0 else zs.min()), 'z1': float(zs.min() if izg[2] > 0 else zs.max())}
MAPA = {k: round(v, 2) for k, v in MAPA.items()}
def plano(tris, G, W=440, Hh=480, k=3):
    from PIL import ImageDraw
    X = lambda z: (z - MAPA['z0']) / (MAPA['z1'] - MAPA['z0']) * W * k
    Y = lambda x: (MAPA['x1'] - x) / (MAPA['x1'] - MAPA['x0']) * Hh * k
    piso = Image.new('L', (W * k, Hh * k), 0); dp = ImageDraw.Draw(piso)
    for j, i in zip(*np.nonzero(G['H'] > -50)):
        x = G['x0'] + i * G['cel']; z = G['z0'] + j * G['cel']
        dp.polygon([(X(z), Y(x)), (X(z + G['cel']), Y(x)), (X(z + G['cel']), Y(x + G['cel'])), (X(z), Y(x + G['cel']))], fill=255)
    par = Image.new('L', (W * k, Hh * k), 0); dw = ImageDraw.Draw(par); Y0 = 1.3
    for t in tris:
        ys = t[:, 1]
        if ys.min() >= Y0 or ys.max() <= Y0: continue
        pts = [(X(p[2]), Y(p[0])) for p in (t[a] + (t[b] - t[a]) * (Y0 - ys[a]) / (ys[b] - ys[a]) for a, b in ((0, 1), (1, 2), (2, 0)) if (ys[a] - Y0) * (ys[b] - Y0) < 0)]
        if len(pts) == 2: dw.line(pts, fill=255, width=int(1.6 * k))
    f = np.asarray(piso.resize((W, Hh), Image.LANCZOS), float)[..., None] / 255; w = np.asarray(par.resize((W, Hh), Image.LANCZOS), float)[..., None] / 255
    rgb = w * np.array([226, 228, 232]) + (1 - w) * np.array([58, 62, 70]); al = np.maximum(f * 0.55, w)
    return Image.fromarray(np.clip(np.concatenate([rgb, al * 255], 2), 0, 255).astype(np.uint8), 'RGBA')
im_plano = plano(TRIS['FN_Pizzeria'], G); im_plano.save(escribir(PK1 + '/i/fn_mapa.webp'), 'WEBP', quality=88, method=6)
if DBG: im_plano.save(DBG + '/fn_mapa.png')
d['ico']['fn_mapa'] = 'fn_mapa'; FN['mapa'] = MAPA
print('grilla', G['nx'], 'x', G['nz'], 'libres', int(G['libre'].sum()), '· caminos', len(caminos), '· largo medio', round(np.mean([sum(np.hypot(c[i + 1][0] - c[i][0], c[i + 1][2] - c[i][2]) for i in range(len(c) - 1)) for c in caminos.values()]), 1), 'm')

# ---------------- luces y aparición ----------------
luces = []
for e in ents:
    c = e['classname']
    if c not in ('light', 'light_spot'): continue
    o = vec(e['origin'])
    if arriba(o) or int(e['spawnflags'] or 0) & 1 or e['targetname'] in ('Flashs',): continue   # (las que arrancan apagadas, los relámpagos de afuera)
    col = vec(e['_light'])[:4] if e['_light'] else [255, 255, 255, 200]
    if len(col) < 4: col += [200]
    if sum(col[:3]) < 60: continue   # (las de relleno, casi negras)
    k = col[3] / 200
    L = {'p': S2G(o), 'c': [round(col[0] / 255, 3), round(col[1] / 255, 3), round(col[2] / 255, 3)], 'r': round(3.5 + 3 * min(1.5, k), 2), 'n': e['targetname'] or ''}
    if c == 'light_spot':
        a = vec(e['angles']); pitch = -float(e['pitch']) if e['pitch'] else a[0]
        f = ang_mat(pitch, a[1], 0)[:, 0]
        if f[2] > -0.97:   # (las que apuntan para abajo alumbran alrededor: como una de techo)
            L['d'] = [round(x, 4) for x in (MS @ f).tolist()]; L['cono'] = round(math.cos(math.radians(float(e['_cone'] or 45) + 10)), 3)
    luces.append(L)
# (las que están casi en el mismo lugar —el foco y su relleno—: una)
uni = []
for L in luces:
    if any(np.linalg.norm(np.array(L['p']) - np.array(u['p'])) < 0.6 and ('d' in L) == ('d' in u) for u in uni): continue
    uni.append(L)
luces = uni
apar = [nodo('RB_Aparicion')]
# donde aparecen: adentro de la oficina, repartidos detrás del escritorio, mirando adelante
k_ap = 0
for a_ in (-90, -30, 30, 90):
    for b_ in (-40, 10):
        o = OF_C + izq_s * a_ + frente * b_; o[2] = OF_C[2] - 55 + 2
        apar.append(nodo('SpawnPoint%s' % ('' if k_ap == 0 else ' (%d)' % k_ap), P(o), pa=0, yaw=round(math.atan2(frente[1], frente[0]), 4))); k_ap += 1
esc.append(apar)
esc.append([nodo('Directional Light', (0, 3, 0), (0.7071, 0, 0, 0.7071), lz={'t': 1, 'c': [0.55, 0.6, 0.8], 'i': 0.06, 'rg': 10.0, 'sa': 30.0})])
d['esc']['RB_Pizzeria'] = esc
a = json.loads(json.dumps(d['aj']['RB_Luna'])); a.update(fog=1, fm=3, fc=[0.0, 0.0, 0.0], fs=16.0, fe=52.0, fd=0, ai=0.5, grav=1.0, ambRB=[[0.045, 0.045, 0.06], [0.03, 0.03, 0.04]])
a.update(espacio=1, sinSombra=1); d['aj']['RB_Pizzeria'] = a
FN.update(luces=luces, camaras=camaras, puertas=puertas, botones=botones)
print('luces', len(luces), 'cámaras', len(camaras), 'puertas', list(puertas), 'botones', len(botones))

# ---------------- animatrónicos ----------------
if not all(n in FN['pf'] for n in ('Freddy', 'Bonnie', 'Chica', 'Foxy')):
    CL = 'models/cl3nr/hw/'
    ANIMA = [('Freddy', 'freddy/cl3nrbearpill', 2.15, {'quieto': 'idle', 'camina': 'walk', 'susto': 'jumpscare'}),
             ('Bonnie', 'bonnie/cl3nrbonpill', 2.3, {'quieto': 'idle', 'camina': 'walk', 'susto': 'jumpscare', 'mira': 'lookat'}),
             ('Chica', 'chica/cl3nrchickenpill', 2.1, {'quieto': 'idle', 'camina': 'walk', 'susto': 'jumpscare', 'mira': 'lookat'}),
             ('Foxy', 'foxy/cl3nrfoxpill', 2.2, {'quieto': 'idle', 'corre': 'run', 'susto': 'jumpscare'})]
    ANIM_K = 0.5   # (con la mitad de los triángulos: por piezas y sin tocar los bordes)
    def simplificar_piel(V, N, U, piel, porMat, k):
        VV, NN, UU, PP, out = [], [], [], [], {}
        for mi, idx in porMat.items():
            T = np.array(idx).reshape(-1, 3); padre = {}
            def raiz(x):
                while padre.setdefault(x, x) != x: padre[x] = padre[padre[x]]; x = padre[x]
                return x
            for a_, b_, c_ in T:
                ra = raiz(int(a_)); padre[raiz(int(b_))] = ra; padre[raiz(int(c_))] = ra
            comp = np.array([raiz(int(t[0])) for t in T]); lista = []
            for r in np.unique(comp):
                Tc = T[comp == r]; us = np.unique(Tc); inv = {int(x): i for i, x in enumerate(us)}; t0 = np.vectorize(inv.get)(Tc)
                if len(Tc) >= 150:
                    s = pyfqmr.Simplify(); s.setMesh(V[us].astype(np.float64), t0.astype(np.int32))
                    s.simplify_mesh(target_count=max(60, int(len(Tc) * k)), aggressiveness=7, preserve_border=True, max_iterations=200, verbose=0)
                    v1, t1, _ = s.getMesh(); _, cerca = cKDTree(V[us]).query(v1); orig = us[cerca]
                else: v1, t1, orig = V[us], t0, us
                b0 = len(VV); VV.extend(v1); NN.extend(N[orig]); UU.extend(U[orig]); PP.extend(piel[orig])
                lista.extend((np.asarray(t1) + b0).reshape(-1).tolist())
            out[mi] = lista
        return np.array(VV), np.array(NN), np.array(UU), np.array(PP, np.uint8), out
    def T4(m3, t):
        X = np.eye(4); X[:3, :3] = m3; X[:3, 3] = t; return X
    for NOM, ruta, ALTO, CLIPS in ANIMA:
        base = os.path.join(HW, CL + ruta)
        M = SM.Modelo(open(base + '.mdl', 'rb').read(), open(base + '.vvd', 'rb').read(), open(base + '.dx90.vtx', 'rb').read())
        H = M.huesos; nb = len(H); Vx = M.vertices
        sq = {s['n']: s for s in M.secuencias}
        P0, Q0, _ = M.pose(sq['idle']['anim'], 0); W0 = M.mundo(P0, Q0)
        B2M = [np.linalg.inv(np.vstack([h['p2b'], [0, 0, 0, 1]])) for h in H]
        sk = [W0[k] @ np.linalg.inv(B2M[k]) for k in range(nb)]
        w, hb = Vx['w'], Vx['hb']; pos = Vx['pos']; ph = np.c_[pos, np.ones(len(pos))]
        Vq = np.zeros((len(pos), 3))
        for c in range(3):
            for k in np.unique(hb[:, c]): sel = hb[:, c] == k; Vq[sel] += w[sel, c][:, None] * (ph[sel] @ sk[k].T)[:, :3]
        alto = (Vq[:, 2].max() - Vq[:, 2].min()) * S; kk = ALTO / alto; sc = S * kk; piso = Vq[:, 2].min()
        peso = np.zeros(nb)
        for c in range(3): np.add.at(peso, hb[:, c], w[:, c])
        usa_ = {k for k in range(nb) if peso[k] > 1e-4}; dest = list(range(nb))
        orden = sorted(usa_, key=lambda k: (0 if any(s in H[k]['n'] for s in ('B_jnt', 'C_jnt', 'Lid', 'KneePad', 'ToesB', 'Brow', 'Jiggle')) else 1, peso[k]))
        while len(usa_) > 56:
            k = orden.pop(0); p = H[k]['pa']
            while p >= 0 and p not in usa_: p = H[p]['pa']
            usa_.discard(k)
            for j in range(nb):
                if dest[j] == k: dest[j] = p if p >= 0 else 0
        usados = sorted(usa_); col = {k: i for i, k in enumerate(usados)}
        Ce = np.eye(4); Ce[:3, :3] = MS * sc; Ci = np.linalg.inv(Ce)
        arb = [nodo('FN_' + NOM)]
        for k, h in enumerate(H):
            Xe = Ce @ T4(SM.q2m(h['q']), h['pos']) @ Ci
            if h['pa'] < 0: Xe[:3, 3] += np.array([0, -piso * sc, 0])
            arb.append(nodo(h['n'], Xe[:3, 3], SM.m2q(Xe[:3, :3]), pa=h['pa'] + 1 if h['pa'] >= 0 else 0))
        V = (MS @ pos.T).T * sc + np.array([0, -piso * sc, 0]); N = (MS @ Vx['nor'].T).T; U = np.stack([Vx['uv'][:, 0], 1 - Vx['uv'][:, 1]], 1)
        J = np.zeros((len(V), 4), np.int64); Wt = np.zeros((len(V), 4))
        for c in range(3):
            J[:, c] = [col.get(dest[x], 0) for x in hb[:, c]]; Wt[:, c] = w[:, c] * np.array([dest[x] in col for x in hb[:, c]])
        for a_ in range(3):
            for b_ in range(a_ + 1, 3):
                igual = (J[:, a_] == J[:, b_]) & (Wt[:, b_] > 0); Wt[igual, a_] += Wt[igual, b_]; Wt[igual, b_] = 0
        Wt /= np.maximum(Wt.sum(1, keepdims=True), 1e-9)
        wb = np.floor(Wt * 255).astype(np.int32); wb[:, 0] += 255 - wb.sum(1)
        piel = np.zeros((len(V), 8), np.uint8); piel[:, :4] = J; piel[:, 4:] = wb
        Tp = np.eye(4); Tp[:3, 3] = [0, -piso * sc, 0]
        bp = [[float(x) for x in np.linalg.inv(Tp @ Ce @ B2M[k] @ Ci).reshape(16)] for k in usados]
        porMat = {}
        for m in M.mallas:
            if m['modelo'] != 0: continue
            tn = M.texturas[m['mat']].lower(); mi = material_de('materials/' + M.carpetas[0].lower().replace('\\', '/').strip('/') + '/' + tn + '.vmt', 768)
            if mi is None: print('  sin material', tn); continue
            for t in m['tris']: porMat.setdefault(mi, []).extend(orientar(tuple(int(x) for x in t), V, N[t[0]] + N[t[1]] + N[t[2]]))
        nv0 = len(V); V, N, U, piel, porMat = simplificar_piel(V, N, U, piel, porMat, ANIM_K)
        mi, mats = malla_bin('FN_' + NOM, V, N, U, porMat, piel, bp)
        arb.append(nodo('FN_' + NOM + '_Malla', pa=0, m=mi, mt=mats, bo=[k + 1 for k in usados], rid=9931000 + len(FN['pf'])))
        FN['pf'][NOM] = arb
        for clip, seq in CLIPS.items():
            s = sq[seq]; A = M.anims[s['anim']]; nf = A['nf']; data = np.zeros((nf, nb, 7))
            for f in range(nf):
                Pf, Qf, ok = M.pose(s['anim'], f)
                for k, h in enumerate(H):
                    Xe = Ce @ T4(SM.q2m(Qf[k]), Pf[k]) @ Ci
                    if h['pa'] < 0: Xe[:3, 3] += np.array([0, -piso * sc, 0])
                    q = SM.m2q(Xe[:3, :3]); data[f, k, :3] = Xe[:3, 3]; data[f, k, 3:] = q / np.linalg.norm(q)
            for f in range(1, nf):
                neg = (data[f, :, 3:] * data[f - 1, :, 3:]).sum(1) < 0; data[f, neg, 3:] *= -1
            if clip in ('camina', 'corre'):
                for k in (0, 1):
                    tr = data[:, k, [0, 2]]; lin = np.linspace(0, 1, nf)[:, None] * (tr[-1] - tr[0]); data[:, k, [0, 2]] = tr - lin
            o = agregar(data.astype('<f2').tobytes())
            FN['clips'][NOM + ':' + clip] = {'o': o, 'nf': nf, 'nb': nb, 'fps': A['fps'], 'loop': clip in ('quieto', 'camina', 'corre')}
        print(NOM, 'huesos', nb, 'con peso', len(usados), 'verts', nv0, '→', len(V), 'clips', [c for c in CLIPS])
else: print('animatrónicos: los del paquete de origen')

# la imagen de la pantalla de carga (una captura de la pizzería nueva, de afuera del repo: FN_CARGA=imagen.jpg)
if os.environ.get('FN_CARGA'):
    for f_ in os.listdir(PK1 + '/carga'):
        if f_.endswith('_rb_pizzeria.jpg'): open(escribir(PK1 + '/carga/' + f_), 'wb').write(open(os.environ['FN_CARGA'], 'rb').read())
open(escribir(PK1 + '/m.bin.gz'), 'wb').write(gzip.compress(bytes(BIN), 9))
open(escribir(PK1 + '/d.json.gz'), 'wb').write(gzip.compress(json.dumps(d, separators=(',', ':')).encode(), 6))
fnt = [t for t in d['tx'] if t.get('n', '').startswith('FN_')]
print('listo: texturas', len(d['tx']), '(de la pizzería', len(fnt), ',', round(sum(t['w'] * t['h'] for t in fnt) / 1e6, 1), 'Mpx) mallas', len(d['ms']), 'materiales', len(d['mt']), 'bin', len(BIN) // 1000, 'KB')
