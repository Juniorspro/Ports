# Lo de Garry's Mod 10 para RezoBox, desde los archivos originales y el contenido de Half-Life 2 que trae GMod 10
# (bajado de archive.org): los mapas gm_construct (el principal de GMod) y gm_flatgrass, y la palanca (crowbar).
# Pasa de Source (Z arriba, pulgadas) al juego (Y arriba, metros) con (x, y, z) → (y, z, x).
# - Las caras del mundo con sus texturas (los materiales "parche" de los cubemaps se juntan con su textura base), los
#   terrenos (desplazamientos de Source: la grilla con sus alturas y la mezcla de dos texturas por vértice), el agua,
#   los props estáticos y las luces del mapa.
# - Choques: las caras que se ven, más las del cielo (las paredes y el techo del mapa) y los pinceles invisibles.
# - El cielo 3D de Source (la ciudad de fondo: una caja aparte del mapa, a escala 1/16) va agrandado 16 veces donde se
#   ve, como geometría de verdad (los edificios están a 90-760 m: con paralaje al caminar); el cielo 2D (sky_day02_*),
#   pasado a las seis caras de un cubo que el juego pone de fondo.
# - La palanca: en primera persona el brazo con el guante del traje HEV y la palanca (v_crowbar) con sus huesos y sus
#   animaciones de HL2; en tercera persona y como prop suelto, la del mundo (w_crowbar); su ícono y sus sonidos.
# Lo extraído no va al repo: se lee de afuera. Créditos en CREDITOS.md.
# Uso: python-con-srctools -I gmod.py PAQUETE_ORIGEN PAQUETE_NUEVO CARPETA_GMOD10 [POSTURAS_HORNEADAS.json] [FOTOS]
# (FOTOS: capturas de los mapas convertidos, fuera del repo: construct_carga.jpg, construct_icono.jpg, flatgrass_carga.jpg y
# flatgrass_icono.jpg, a 1280×720: fondos de la pantalla de carga e íconos de la lista de mapas)
#      (las posturas se hornean aparte: deja PAQUETE_NUEVO/gm_objetivos.json para gmod_posturas.mjs)
#      (CARPETA_GMOD10: con garrysmod10/ y hl2/ adentro, como en el juego; los .bsp en garrysmod10/maps)
import sys, os, io, json, gzip, math, struct, hashlib, numpy as np
from PIL import Image
import srctools.bsp as BSPm, srctools.vtf as VTF
from srctools.bsp import BSP_LUMPS as LUMP
from srctools.keyvalues import Keyvalues
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import source_mdl as SM

PK0, PK1, GM = sys.argv[1:4]
os.makedirs(PK1, exist_ok=True)
for sub in ('t', 'i', 'a', 'fondos', 'carga', 'v'):
    os.makedirs(os.path.join(PK1, sub), exist_ok=True)
    if os.path.isdir(os.path.join(PK0, sub)):
        for f in os.listdir(os.path.join(PK0, sub)):
            dst = os.path.join(PK1, sub, f)
            if not os.path.exists(dst): os.link(os.path.join(PK0, sub, f), dst)
d = json.load(gzip.open(PK0 + '/d.json.gz')); BIN = bytearray(gzip.decompress(open(PK0 + '/m.bin.gz', 'rb').read()))
def agregar(b):
    while len(BIN) % 4: BIN.append(0)
    o = len(BIN); BIN.extend(b); return o
# el contenido de GMod 10 (lo de garrysmod10 antes que lo de hl2), con los nombres en minúsculas como los busca Source
IDX = {}
for base in ('garrysmod10', 'hl2'):
    for raiz, _, fs in os.walk(os.path.join(GM, base)):
        for f in fs:
            IDX.setdefault(os.path.relpath(os.path.join(raiz, f), os.path.join(GM, base)).lower().replace('\\', '/'), os.path.join(raiz, f))

# ---------------- de Source al juego ----------------
S = 0.0254
MS = np.array([[0, 1, 0], [0, 0, 1], [1, 0, 0]], float)   # (x, y, z) → (y, z, x): los dos de mano derecha
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

# ---------------- archivos: el pak del mapa y el contenido ----------------
PAK, PAKN = None, {}
def leer(ruta):
    r = ruta.lower().replace('\\', '/')
    if r in PAKN: return PAK.read(PAKN[r])
    f = IDX.get(r)
    return open(f, 'rb').read() if f else None

# ---------------- texturas y materiales ----------------
_mats, _txs, _img = {}, {}, {}
DOBLE = set()   # (materiales de los dos lados: $nocull, como las tarjetas de los árboles)
def kv_material(ruta):
    """(shader, {clave: valor}) de un .vmt, siguiendo los 'patch' (los de los cubemaps del mapa)"""
    b = leer(ruta)
    if b is None: return None, {}
    txt = b.decode('utf-8', 'replace')
    for intento in range(3):
        try: kv = Keyvalues.parse(txt, ruta); break
        except Exception: txt += '\n}'
    else: return None, {}
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
def vtf_imagen(ruta_vtf):
    """la imagen RGBA de un .vtf (o None)"""
    k = ruta_vtf.lower()
    if k in _img: return _img[k]
    b = leer(ruta_vtf)
    im = VTF.VTF.read(io.BytesIO(b)).get().to_PIL().convert('RGBA') if b else None
    _img[k] = im; return im
def textura(ruta_vtf, nombre, lado, alfa_ok=True):
    k = (ruta_vtf.lower(), lado)
    if k in _txs: return _txs[k]
    im = vtf_imagen(ruta_vtf)
    if im is None: _txs[k] = None; return None
    a = np.asarray(im)[:, :, 3]; alfa = alfa_ok and a.min() < 250
    w, h = im.size; s = min(1.0, lado / max(w, h)); w2, h2 = max(4, round(w * s)), max(4, round(h * s))
    im = im.resize((w2, h2), Image.LANCZOS)
    huella = hashlib.md5(im.tobytes()).hexdigest()   # (la misma imagen con otro nombre: una sola vez)
    if huella in _txs: _txs[k] = _txs[huella]; return _txs[k]
    ti = len(d['tx']); d['tx'].append({'n': 'GM_' + nombre[-40:], 'a': 1 if alfa else 0, 'w': w2, 'h': h2})
    (im if alfa else im.convert('RGB')).save(PK1 + '/t/%d.webp' % ti, 'WEBP', quality=82, method=6)
    _txs[k] = _txs[huella] = (ti, alfa); return _txs[k]
def tex_imagen(img, nombre, q=86):
    ti = len(d['tx']); alfa = img.mode == 'RGBA'
    d['tx'].append({'n': 'GM_' + nombre, 'a': 1 if alfa else 0, 'w': img.size[0], 'h': img.size[1]})
    (img if alfa else img.convert('RGB')).save(PK1 + '/t/%d.webp' % ti, 'WEBP', quality=q, method=6); return ti
_mat_igual = {}
def mat_nuevo(nombre, ti, modo, color=(1, 1, 1, 1), **x):
    k = (ti, modo, tuple(color), json.dumps(x, sort_keys=True))   # (los parches de cubemap de la misma textura: un material)
    if k in _mat_igual: return _mat_igual[k]
    mi = len(d['mt'])
    m = {'n': 'GM_' + nombre, 't': ti, 'ts': [1.0, 1.0], 'to': [0.0, 0.0], 'tt': {'_MainTex': [ti, 1.0, 1.0, 0.0, 0.0]}, 'cc': {'_Color': list(color)}, 'c': list(color), 'f': {}}
    if modo == 'cut': m.update(sh='Standard', f={'_Mode': 1.0, '_Glossiness': 0.15, '_Metallic': 0.0})
    elif modo == 'blend': m['sh'] = 'Legacy Shaders/Transparent/Diffuse'
    elif modo == 'unlit': m['sh'] = 'Unlit/Texture'
    else: m['sh'] = 'Mobile/Diffuse'
    m.update(x); d['mt'].append(m); _mat_igual[k] = mi; return mi
def ruido(n, beta, semilla):
    r = np.random.default_rng(semilla).standard_normal((n, n)); F = np.fft.fft2(r)
    ky, kx = np.fft.fftfreq(n)[:, None], np.fft.fftfreq(n)[None, :]; k = np.sqrt(kx * kx + ky * ky); k[0, 0] = 1
    x = np.real(np.fft.ifft2(F / k ** beta)); return (x - x.min()) / (x.max() - x.min())
_agua = {}
def mat_agua(c):
    """agua: el color de su niebla ($fogcolor) con ondas suaves, transparente (el agua de verdad, con física, aparte)"""
    k = tuple(c)
    if k not in _agua:
        n = 256; a = ruido(n, 1.6, 11) * 0.6 + ruido(n, 1.0, 12) * 0.4
        base = np.array(c, float); luz = np.array([150, 190, 200], float)
        img = base[None, None, :] * 0.55 + luz[None, None, :] * 0.25 + (a[:, :, None] - 0.5) * 70
        _agua[k] = mat_nuevo('agua', tex_imagen(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), 'agua'), 'blend', (1, 1, 1, 0.62))
    return _agua[k]
def material_de(vmt, lado=512):
    """índice de material del juego para un .vmt (o None). Devuelve también si es agua"""
    k = (vmt.lower(), lado)
    if k in _mats: return _mats[k]
    sh, c = kv_material(vmt)
    nombre = vmt.lower().removeprefix('materials/').removesuffix('.vmt')
    if sh == 'water':
        fc = [int(round(float(x))) for x in c.get('$fogcolor', '{20 42 39}').strip('{}[] ').split()[:3]]
        _mats[k] = (mat_agua(fc), 'agua'); return _mats[k]
    bt = c.get('$basetexture')
    tx = textura('materials/' + bt.lower().replace('\\', '/').removesuffix('.vtf') + '.vtf', bt, lado) if bt else None
    if tx is None: _mats[k] = (None, None); return _mats[k]
    ti, alfa = tx
    trans = c.get('$translucent', '0') not in ('0', ''); corte = c.get('$alphatest', '0') not in ('0', ''); aditivo = c.get('$additive', '0') not in ('0', '')
    brillo = sh == 'unlitgeneric' or c.get('$selfillum', '0') not in ('0', '')
    modo = 'unlit' if (aditivo or brillo) and not trans else 'blend' if trans or aditivo else 'cut' if corte else 'op'
    if trans and alfa and nombre.startswith('models/'): modo = 'cut'   # (el follaje de los modelos: recortado, con luz y sombra, sin problemas de orden)
    try: am = float(c.get('$alpha', '1') or 1)
    except ValueError: am = 1.0
    color = (1, 1, 1, max(0.18, min(0.42, am))) if am < 0.99 else (1, 1, 1, 1)
    if am < 0.99: modo = 'blend'
    extra = {}
    bt2 = c.get('$basetexture2') if sh == 'worldvertextransition' else None
    if bt2:   # mezcla por vértice de dos texturas (los terrenos): la segunda va en 't2' y el peso en cada vértice
        tx2 = textura('materials/' + bt2.lower().replace('\\', '/').removesuffix('.vtf') + '.vtf', bt2, lado)
        if tx2: extra['t2'] = tx2[0]
    mi = mat_nuevo(nombre.split('/')[-1], ti, modo, color, **extra)
    if c.get('$nocull', '0') not in ('0', ''): DOBLE.add(mi)
    _mats[k] = (mi, 'mezcla' if 't2' in extra else modo); return _mats[k]

# ---------------- mallas ----------------
def malla_bin(nombre, V, N, U, porMat, mezcla=None, piel=None, bp=None):
    """malla del juego: 14 bytes por vértice (posición en 16 bits sobre la caja, normal en 8 bits, UV en medio float);
    el byte que sobra (el 4.º de la normal) lleva el peso de la segunda textura en los materiales con mezcla"""
    V = np.asarray(V, float); mn = V.min(0); sc = np.maximum(V.max(0) - mn, 1e-6)
    q = np.ascontiguousarray(np.round((V - mn) / sc * 65535).astype('<u2')); nb = np.ascontiguousarray(np.clip(np.round(np.asarray(N, float) * 127), -127, 127).astype(np.int8)); uv = np.ascontiguousarray(np.asarray(U, float).astype('<f2'))
    vb = np.zeros((len(V), 14), np.uint8); vb[:, 0:6] = q.view(np.uint8).reshape(-1, 6); vb[:, 6:9] = nb.view(np.uint8).reshape(-1, 3); vb[:, 10:14] = uv.view(np.uint8).reshape(-1, 4)
    if mezcla is not None: vb[:, 9] = np.clip(np.round(np.asarray(mezcla, float) * 127), 0, 127).astype(np.uint8)
    mats = list(porMat.keys()); idx = []; sub = []
    for m in mats: sub.append([len(idx), len(porMat[m])]); idx.extend(porMat[m])
    i32 = len(V) > 65535; o_v = agregar(vb.tobytes())
    o_s = agregar(piel.tobytes()) if piel is not None else None
    o_i = agregar(np.array(idx, '<u4' if i32 else '<u2').tobytes())
    x = {'n': nombre, 'o': o_v, 'v': len(V), 'mn': mn.tolist(), 'sc': sc.tolist(), 'i': o_i, 'i32': bool(i32), 'sub': sub}
    if piel is not None: x['sk'] = o_s; x['bp'] = bp   # (con piel: huesos y pesos por vértice, y las poses de enlace)
    mi = len(d['ms']); d['ms'].append(x)
    return mi, mats
def orientar(tri, V, n):
    """el orden de un triángulo para que se vea del lado de la normal n (el juego dibuja la cara con (b-a)×(c-a) hacia uno)"""
    a, b, c = tri
    return (a, b, c) if np.dot(np.cross(V[b] - V[a], V[c] - V[a]), n) >= 0 else (a, c, b)
def nodo(n, p=(0, 0, 0), r=(0, 0, 0, 1), s=(1, 1, 1), pa=-1, **x):
    return dict(n=n, p=[round(float(v), 5) for v in p], r=[round(float(v), 6) for v in r], s=[round(float(v), 5) for v in s], pa=pa, **x)
class Junta:
    """caras acumuladas por material → una malla (con UV corridas a enteros por cara: el medio float no pierde precisión)"""
    def __init__(self): self.V, self.N, self.U, self.A, self.por = [], [], [], [], {}
    def poligono(self, mi, vs, n, uv, alfa=None, dos_lados=False):
        # (los polígonos de Source traen vértices alineados sobre las aristas: fuera, si no quedan triángulos sin área)
        k = 0; vs, uv = list(vs), list(uv); alfa = None if alfa is None else list(alfa)
        while len(vs) > 3 and k < len(vs):
            a_, b_, c_ = np.asarray(vs[k - 1]), np.asarray(vs[k]), np.asarray(vs[(k + 1) % len(vs)])
            if np.linalg.norm(np.cross(b_ - a_, c_ - a_)) < 5e-4 * max(1e-9, np.linalg.norm(c_ - a_)):   # (a menos de medio mm de la recta)
                del vs[k], uv[k]
                if alfa is not None: del alfa[k]
            else: k += 1
        base = len(self.V)
        for k in range(len(vs)): self.V.append(vs[k]); self.N.append(n); self.U.append(uv[k]); self.A.append(0.0 if alfa is None else alfa[k])
        Vn = np.array(vs)
        for k in range(1, len(vs) - 1):
            t = orientar((0, k, k + 1), Vn, n); self.por.setdefault(mi, []).extend([base + t[0], base + t[1], base + t[2]])
            if dos_lados: self.por[mi].extend([base + t[0], base + t[2], base + t[1]])
    def tris(self, mi, V, N, U, T, alfa=None):
        base = len(self.V); self.V.extend(V); self.N.extend(N); self.U.extend(U); self.A.extend([0.0] * len(V) if alfa is None else alfa)
        self.por.setdefault(mi, []).extend((np.asarray(T).reshape(-1) + base).tolist())
    def vacia(self): return not self.V
    def guardar(self, nombre):
        return malla_bin(nombre, np.array(self.V), np.array(self.N), np.array(self.U), self.por, np.array(self.A) if any(self.A) else None)
    def triangulos(self):
        V = np.array(self.V); return V[np.array([i for l in self.por.values() for i in l]).reshape(-1, 3)]

# ---------------- props (modelos de Source) ----------------
_mod, _geo = {}, {}
import pyfqmr
from scipy.spatial import cKDTree
TRIS_MAX = 6000
def simplificar(V, N, U, T, meta):
    usados = np.unique(T); inv = {int(k): i for i, k in enumerate(usados)}
    v0 = V[usados]; t0 = np.vectorize(inv.get)(T)
    s = pyfqmr.Simplify(); s.setMesh(v0.astype(np.float64), t0.astype(np.int32))
    s.simplify_mesh(target_count=max(40, meta), aggressiveness=7, preserve_border=True, max_iterations=400, verbose=0)
    v1, t1, _ = s.getMesh(); _, cerca = cKDTree(v0).query(v1)
    return v1, N[usados][cerca], U[usados][cerca], t1
def modelo_datos(ruta):
    """(Modelo, V, N, U en metros y ejes del juego, grupos de triángulos por ranura de material) o None"""
    base = ruta.lower().removesuffix('.mdl'); mdl = leer(base + '.mdl'); vvd = leer(base + '.vvd')
    vtx = next((x for x in (leer(base + e) for e in ('.dx90.vtx', '.vtx', '.dx80.vtx', '.sw.vtx')) if x), None)
    if not (mdl and vvd and vtx): return None
    try: M = SM.Modelo(mdl, vvd, vtx); Vx = M.vertices
    except Exception as e: print('  modelo ilegible', ruta, e); return None
    V = (MS @ Vx['pos'].T).T * S; N = (MS @ Vx['nor'].T).T; U = np.stack([Vx['uv'][:, 0], 1 - Vx['uv'][:, 1]], 1)
    grupos = {}
    for m in M.mallas:
        if m['modelo'] != 0 or not len(m['tris']): continue
        grupos.setdefault(m['mat'], []).append(m['tris'])
    return (M, V, N, U, {r: np.concatenate(g) for r, g in grupos.items()}) if grupos else None
def mat_de_modelo(M, ranura, piel):
    pie = M.pieles[piel] if piel < len(M.pieles) else M.pieles[0]
    ti = pie[ranura] if ranura < len(pie) else ranura; tn = M.texturas[ti].lower().replace('\\', '/')
    for cd in M.carpetas:
        m_, _ = material_de('materials/' + cd.lower().replace('\\', '/').strip('/') + '/' + tn + '.vmt', 512)
        if m_ is not None: return m_, 'materials/' + cd.lower().replace('\\', '/').strip('/') + '/' + tn + '.vmt'
    return None, None
def modelo_estatico(ruta, piel=0):
    """(malla, materiales, caja local mín/máx) de un .mdl (en su espacio, a metros) o None"""
    k = (ruta.lower(), piel)
    if k in _mod: return _mod[k]
    x = modelo_datos(ruta)
    if x is None: _mod[k] = None; return None
    M, V, N, U, grupos = x; ranuras = sorted(grupos)
    mats = []
    for r in ranuras:
        m_, _ = mat_de_modelo(M, r, piel)
        if m_ is None: print('  sin material', ruta, M.texturas[r] if r < len(M.texturas) else r, M.carpetas)
        mats.append(m_ if m_ is not None else 0)
    dobles = [m_ in DOBLE for m_ in mats]
    clave = hashlib.md5(V.tobytes() + b''.join(grupos[r].tobytes() for r in ranuras) + bytes(dobles)).hexdigest()
    if clave not in _geo:
        total = sum(len(g) for g in grupos.values()); J = Junta()
        for r in ranuras:
            T = grupos[r]
            if total > TRIS_MAX: v1, n1, u1, t1 = simplificar(V, N, U, T, int(len(T) * TRIS_MAX / total))
            else:
                us = np.unique(T); inv = {int(x_): i for i, x_ in enumerate(us)}; v1, n1, u1, t1 = V[us], N[us], U[us], np.vectorize(inv.get)(T)
            v1 = np.asarray(v1); n1 = np.asarray(n1)
            t1 = np.array([orientar(tuple(int(i) for i in t), v1, n1[t[0]] + n1[t[1]] + n1[t[2]]) for t in t1])
            J.tris(('r', r), list(v1), list(n1), list(u1), t1)
            if dobles[ranuras.index(r)]: J.tris(('r', r), list(v1), list(-n1), list(u1), t1[:, ::-1])   # (la otra cara, con la normal dada vuelta)
        Va = np.array(J.V); mi, _ = J.guardar('GM_' + os.path.basename(ruta.lower().removesuffix('.mdl')))
        _geo[clave] = (mi, ranuras, (Va.min(0), Va.max(0)))
    mi, ranuras, caja = _geo[clave]
    _mod[k] = (mi, mats, caja); return _mod[k]

# ---------------- el cielo: 2D (seis caras de Source) + 3D (la caja de fondo) dibujados en un cubo ----------------
# Caras del cielo 2D de Source: rt +X, lf -X, bk +Y, ft -Y, up +Z, dn -Z, cada una con (s, t) en [-1, 1] y la imagen
# con la fila 0 arriba (medido: así no quedan costuras entre las caras; la de abajo casi nunca coincide en ningún cielo)
def cielo2d_muestra(nombre, D):
    """color (N×3, 0-1) del cielo 2D en las direcciones D (N×3, ejes de Source)"""
    caras = {}
    for suf in ('rt', 'bk', 'lf', 'ft', 'up', 'dn'):
        _, c = kv_material('materials/skybox/%s%s.vmt' % (nombre, suf))
        im = vtf_imagen('materials/' + c.get('$basetexture', 'skybox/%s%s' % (nombre, suf)).lower() + '.vtf')
        caras[suf] = np.asarray(im.convert('RGB'), float) / 255 if im is not None else None
    x, y, z = D[:, 0], D[:, 1], D[:, 2]; ax, ay, az = np.abs(x), np.abs(y), np.abs(z)
    out = np.zeros((len(D), 3))
    with np.errstate(divide='ignore', invalid='ignore'):
        eleg = [('rt', (ax >= ay) & (ax >= az) & (x > 0), -y / ax, z / ax), ('lf', (ax >= ay) & (ax >= az) & (x <= 0), y / ax, z / ax),
                ('bk', (ay > ax) & (ay >= az) & (y > 0), x / ay, z / ay), ('ft', (ay > ax) & (ay >= az) & (y <= 0), -x / ay, z / ay),
                ('up', (az > ax) & (az > ay) & (z > 0), -y / az, -x / az), ('dn', (az > ax) & (az > ay) & (z <= 0), -x / az, y / az)]
    for suf, sel, s, t in eleg:
        im = caras[suf]
        if im is None or not sel.any(): continue
        h, w = im.shape[:2]; s, t = s[sel], t[sel]
        # (las caras de los costados de HL2 vienen a veces sólo con la mitad de arriba)
        if suf not in ('up', 'dn') and h * 2 == w: fil = (1 - t) * h - 0.5
        else: fil = (1 - t) / 2 * h - 0.5
        col = (s + 1) / 2 * w - 0.5
        out[sel] = bilineal(im, col, fil)
    return out
def bilineal(im, x, y):
    h, w = im.shape[:2]
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int); fx = (x - x0)[:, None]; fy = (y - y0)[:, None]
    x0, y0 = np.clip(x0, 0, w - 1), np.clip(y0, 0, h - 1); x1, y1 = np.clip(x0 + 1, 0, w - 1), np.clip(y0 + 1, 0, h - 1)
    return (im[y0, x0] * (1 - fx) * (1 - fy) + im[y0, x1] * fx * (1 - fy) + im[y1, x0] * (1 - fx) * fy + im[y1, x1] * fx * fy)
# caras del cubo como las pide WebGL (TEXTURE_CUBE_MAP_POSITIVE_X...): (adelante, derecha de la imagen, abajo de la imagen)
CUBO = [((1, 0, 0), (0, 0, -1), (0, -1, 0)), ((-1, 0, 0), (0, 0, 1), (0, -1, 0)), ((0, 1, 0), (1, 0, 0), (0, 0, 1)),
        ((0, -1, 0), (1, 0, 0), (0, 0, -1)), ((0, 0, 1), (1, 0, 0), (0, -1, 0)), ((0, 0, -1), (-1, 0, 0), (0, -1, 0))]
def hornear_cielo(nombre_cielo, lado=512, ss=2):
    """las seis imágenes (lado×lado) del cielo 2D de Source pasadas a las caras de un cubo de WebGL"""
    L = lado * ss; caras = []
    j, i = np.mgrid[0:L, 0:L]; px = (i + 0.5) / L * 2 - 1; py = (j + 0.5) / L * 2 - 1
    for f, r, a in CUBO:
        f, r, a = np.array(f, float), np.array(r, float), np.array(a, float)
        D = f[None, :] + px.reshape(-1, 1) * r[None, :] + py.reshape(-1, 1) * a[None, :]; D /= np.linalg.norm(D, axis=1, keepdims=True)
        Dsrc = np.stack([D[:, 2], D[:, 0], D[:, 1]], 1)   # (del juego a Source)
        img = cielo2d_muestra(nombre_cielo, Dsrc).reshape(L, L, 3)
        caras.append(Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8)).resize((lado, lado), Image.LANCZOS))
    return caras

# ---------------- un mapa ----------------
def brocha_poligonos(br):
    """las caras de un pincel convexo (polígonos con su normal), de sus planos"""
    planos = [(np.array([s.plane.normal.x, s.plane.normal.y, s.plane.normal.z]), s.plane.dist) for s in br.sides]
    pts = []
    for a in range(len(planos)):
        for b in range(a + 1, len(planos)):
            for c in range(b + 1, len(planos)):
                A = np.array([planos[a][0], planos[b][0], planos[c][0]])
                if abs(np.linalg.det(A)) < 1e-6: continue
                x = np.linalg.solve(A, [planos[a][1], planos[b][1], planos[c][1]])
                if all(n @ x - dd <= 0.01 for n, dd in planos): pts.append(x)
    if len(pts) < 4: return []
    pts = np.unique(np.round(np.array(pts), 3), axis=0); out = []
    for n, dd in planos:
        en = pts[np.abs(pts @ n - dd) < 0.02]
        if len(en) < 3: continue
        c = en.mean(0); e1 = en[0] - c; e1 /= np.linalg.norm(e1) or 1; e2 = np.cross(n, e1)
        ang = np.arctan2((en - c) @ e2, (en - c) @ e1); out.append((en[np.argsort(ang)], n))
    return out
class Solidos:
    """¿un punto está adentro de un pincel sólido del mapa? (cajas para descartar rápido y después los planos)"""
    def __init__(self, bsp):
        self.B = []
        for br in bsp.brushes:
            if not (br.contents.value & 1): continue
            Nb = np.array([[x.plane.normal.x, x.plane.normal.y, x.plane.normal.z] for x in br.sides]); Db = np.array([x.plane.dist for x in br.sides])
            lo, hi = np.full(3, -1e9), np.full(3, 1e9)
            for n_, d_ in zip(Nb, Db):
                for ax in range(3):
                    if abs(n_[ax]) > 0.9999:
                        if n_[ax] > 0: hi[ax] = min(hi[ax], d_ / n_[ax])
                        else: lo[ax] = max(lo[ax], d_ / n_[ax])
            self.B.append((Nb, Db, lo, hi))
        self.lo, self.hi = np.array([x[2] for x in self.B]), np.array([x[3] for x in self.B])
    def adentro(self, p, eps=0.05):
        for k in np.nonzero(np.all((self.lo <= p + eps) & (p - eps <= self.hi), 1))[0]:
            if np.all(self.B[k][0] @ p - self.B[k][1] < -eps): return True
        return False
def convertir(NOM, archivo, cfg):
    global PAK, PAKN
    bsp = BSPm.BSP(os.path.join(GM, 'garrysmod10', 'maps', archivo + '.bsp')); PAK = bsp.pakfile; PAKN = {n.lower().replace('\\', '/'): n for n in PAK.namelist()}
    ents = list(bsp.ents.entities); spawn_w = bsp.ents.spawn
    # caras con desplazamiento: el índice de su dispinfo está en la cara cruda (el lector no lo trae)
    raw = bsp.lumps[LUMP.FACES].data; disp_de = [struct.unpack_from('<h', raw, i * 56 + 12)[0] for i in range(len(raw) // 56)]
    idx_cara = {id(f): i for i, f in enumerate(bsp.faces)}
    DI = bsp.lumps[LUMP.DISPINFO].data; DV = np.frombuffer(bsp.lumps[LUMP.DISP_VERTS].data, '<f4').reshape(-1, 5) if bsp.lumps[LUMP.DISP_VERTS].data else None
    camaras = [e for e in ents if e['classname'] == 'sky_camera']
    en_cielo3d = cfg.get('cielo3d') or (lambda c: False)
    cam3d = next((e for e in camaras if en_cielo3d(np.array(vec(e['origin'])))), None)
    mundo = next(bm for e, bm in bsp.bmodels.items() if e['classname'] == 'worldspawn')
    SOL = Solidos(bsp)
    J, Jc, Jag = Junta(), Junta(), Junta()   # lo que se ve, lo que sólo choca (cielo e invisibles), el agua
    tris3d = []; stats = {'caras': 0, 'cielo': 0, 'agua': 0, 'disp': 0, 'sin_material': set()}
    disp_v, disp_n, disp_u, disp_a, disp_t, disp_mats = [], [], [], [], [], {}
    for f in mundo.faces:
        ti = f.texinfo
        if ti is None: continue
        fl = ti.flags.value; mat = ti.mat.lower()
        vs = np.array([[e.a.x, e.a.y, e.a.z] for e in f.edges])
        if len(vs) < 3: continue
        c = vs.mean(0); n_src = np.array([f.plane.normal.x, f.plane.normal.y, f.plane.normal.z])   # (medido: el plano ya mira hacia donde se ve)
        if en_cielo3d(c):
            if fl & (0x4 | 0x2 | 0x80 | 0x200 | 0x100) or mat.startswith('tools/'): continue
            tris3d.append(('cara', f, vs, n_src)); continue
        if fl & 0x4 or mat == 'tools/toolsskybox':   # cielo: no se ve, pero son las paredes y el techo del mapa
            Jc.poligono(0, [P(v) for v in vs], MS @ n_src, [(0, 0)] * len(vs)); stats['cielo'] += 1; continue
        if fl & (0x80 | 0x200 | 0x100) or mat.startswith('tools/'): continue
        k = disp_de[idx_cara[id(f)]]
        mi, modo = material_de('materials/' + mat + '.vmt')
        if mi is None: stats['sin_material'].add(mat); continue
        tw, th = ti.tex_size; tw, th = tw or 512, th or 512
        so, to = np.array([ti.s_off.x, ti.s_off.y, ti.s_off.z]), np.array([ti.t_off.x, ti.t_off.y, ti.t_off.z])
        uvf = lambda pts: np.stack([(pts @ so + ti.s_shift) / tw, -(pts @ to + ti.t_shift) / th], 1)
        if k >= 0:   # ---- desplazamiento: grilla de (2^n+1)² sobre la cara con las alturas de cada punto
            sx, sy, sz, vstart, _, pw = struct.unpack_from('<3f3i', DI, k * 176)
            n = (1 << pw) + 1; i0 = int(np.argmin(np.linalg.norm(vs - np.array([sx, sy, sz]), axis=1))); p = [vs[(i0 + j) % 4] for j in range(4)]
            dv = DV[vstart:vstart + n * n]; G = np.zeros((n, n, 3)); Gp = np.zeros((n, n, 3))
            for i in range(n):
                e0 = p[0] + (p[1] - p[0]) * i / (n - 1); e1 = p[3] + (p[2] - p[3]) * i / (n - 1)
                for j in range(n):
                    plano = e0 + (e1 - e0) * j / (n - 1); Gp[i, j] = plano; G[i, j] = plano + dv[i * n + j, :3] * dv[i * n + j, 3]
            al = (dv[:, 4] / 255.0).reshape(n, n) if modo == 'mezcla' else np.zeros((n, n))
            disp_v.append(G.reshape(-1, 3)); disp_u.append(uvf(Gp.reshape(-1, 3))); disp_a.append(al.reshape(-1)); disp_mats.setdefault(mi, []).append(len(disp_v) - 1)
            T = []
            for i in range(n - 1):
                for j in range(n - 1):
                    a_, b_, c_, e_ = i * n + j, (i + 1) * n + j, (i + 1) * n + j + 1, i * n + j + 1
                    T += [(a_, b_, c_), (a_, c_, e_)] if (i + j) % 2 == 0 else [(a_, b_, e_), (b_, c_, e_)]
            # (lo del terreno que queda adentro de un pincel sólido no se ve en Source: el piso lo tapa. Acá se saca: si no, se
            # pisaba con el piso (parpadeo) y el jugador chocaba con los dos y se caía por la rendija)
            Gv = G.reshape(-1, 3); arriba = np.array([0, 0, 1.0])   # (el centro del triángulo, una unidad más arriba)
            T = [t for t in T if not SOL.adentro(Gv[list(t)].mean(0) + arriba)]
            stats['tapados'] = stats.get('tapados', 0) + (n - 1) * (n - 1) * 2 - len(T)
            disp_t.append((np.array(T), n_src)); stats['disp'] += 1; continue
        uv = uvf(vs); uv -= np.floor(uv.min(0))
        Vg = [P(v) for v in vs]; ng = MS @ n_src
        if modo == 'agua':
            if n_src[2] > 0.5: Jag.poligono(mi, Vg, ng, uv); stats['agua'] += 1
            continue
        J.poligono(mi, Vg, ng, uv, dos_lados=modo == 'blend'); stats['caras'] += 1
    # ---- terrenos: normales suaves (soldadas entre parches por posición), UV corridas a enteros por bloques de 4×4
    terreno = None
    if disp_v:
        todas = np.concatenate(disp_v); clave = [tuple(np.round(v, 1)) for v in todas]; acum = {}
        normales = []
        for (T, nsrc), V in zip(disp_t, disp_v):
            nv = np.zeros_like(V)
            for t in T:
                a_, b_, c_ = V[t[0]], V[t[1]], V[t[2]]; cr = np.cross(b_ - a_, c_ - a_)
                if cr @ nsrc < 0: cr = -cr
                nv[t] += cr
            normales.append(nv)
        o = 0
        for nv in normales:
            for k_ in range(len(nv)): acum[clave[o + k_]] = acum.get(clave[o + k_], 0) + nv[k_]
            o += len(nv)
        Jt = Junta(); o = 0
        for qi, ((T, nsrc), V, U, A) in enumerate(zip(disp_t, disp_v, disp_u, disp_a)):
            mi = next(m for m, l in disp_mats.items() if qi in l)
            N = np.array([acum[clave[o + k_]] for k_ in range(len(V))]); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9); o += len(V)
            Vg = (MS @ (V * S).T).T; Ng = (MS @ N.T).T; n = int(round(math.sqrt(len(V))))
            for bi in range(0, n - 1, 4):
                for bj in range(0, n - 1, 4):
                    ids = [i * n + j for i in range(bi, min(bi + 5, n)) for j in range(bj, min(bj + 5, n))]; loc = {g: l for l, g in enumerate(ids)}
                    Tb = [t for t in T if all(x in loc for x in t) and min(x // n for x in t) >= bi and min(x % n for x in t) >= bj]
                    Ub = U[ids] - np.floor(U[ids].min(0))
                    Tl = np.array([orientar((loc[t[0]], loc[t[1]], loc[t[2]]), Vg[ids], MS @ nsrc) for t in Tb])
                    Jt.tris(mi, list(Vg[ids]), list(Ng[ids]), list(Ub), Tl, list(A[ids]))
        terreno = Jt.guardar(NOM + '_Terreno')
    # ---- pinceles invisibles (paredes que no se ven): choque
    for br in bsp.brushes:
        mats = {s.texinfo.mat.lower() for s in br.sides if s.texinfo}
        if not (br.contents.value & 0x10000 or mats & {'tools/toolsinvisible', 'tools/toolsplayerclip'}): continue
        for poli, n_ in brocha_poligonos(br):
            if en_cielo3d(poli.mean(0)): continue
            Jc.poligono(0, [P(v) for v in poli], MS @ n_, [(0, 0)] * len(poli))
    # ---- el agua: volúmenes (para nadar y flotar) de los pinceles de agua
    aguas = []
    for br in bsp.brushes:
        if not br.contents.value & 0x20: continue
        pol = brocha_poligonos(br)
        if not pol: continue
        pts = np.concatenate([np.array([P(v) for v in p_]) for p_, _ in pol])
        if en_cielo3d(np.concatenate([p_ for p_, _ in pol]).mean(0)): continue
        aguas.append({'lo': [round(x, 3) for x in pts.min(0).tolist()], 'hi': [round(x, 3) for x in pts.max(0).tolist()]})
    print(NOM, 'caras', stats['caras'], 'cielo (choque)', stats['cielo'], 'agua', stats['agua'], 'terrenos', stats['disp'], '(triángulos tapados por el piso, fuera:', stats.get('tapados', 0), ') sin material', sorted(stats['sin_material']))
    esc = []
    mi_m, mats_m = J.guardar(NOM)
    col = [{'k': 'm', 'm': mi_m, 'cv': 0, 'tr': 0}]
    raiz = nodo(NOM, m=mi_m, mt=mats_m, rid=9940000 + mi_m)
    if not Jc.vacia():
        mi_c, _ = Jc.guardar(NOM + '_Choque'); col.append({'k': 'm', 'm': mi_c, 'cv': 0, 'tr': 0})
    raiz['col'] = col; esc.append([raiz])
    if terreno: esc.append([nodo(NOM + '_Terreno', m=terreno[0], mt=terreno[1], rid=9940000 + terreno[0], col=[{'k': 'm', 'm': terreno[0], 'cv': 0, 'tr': 0}])])
    if not Jag.vacia():
        mi_a, mats_a = Jag.guardar(NOM + '_Agua'); esc.append([nodo(NOM + '_Agua', m=mi_a, mt=mats_a, rid=9940000 + mi_a)])
    # ---- props estáticos (los del cielo 3D, a dibujar en el fondo)
    props = [nodo(NOM + '_Props')]; faltan = {}
    for sp in bsp.props:
        o_src = np.array([sp.origin.x, sp.origin.y, sp.origin.z]); ang = (sp.angles.pitch, sp.angles.yaw, sp.angles.roll)
        if en_cielo3d(o_src): tris3d.append(('prop', sp.model, o_src, ang, sp.skin)); continue
        r = modelo_estatico(sp.model, sp.skin)
        if r is None: faltan[sp.model] = faltan.get(sp.model, 0) + 1; continue
        mi, mats, (lo, hi) = r; x = nodo(os.path.basename(sp.model)[:-4], P(o_src), SM.m2q(R(ang_mat(*ang))), pa=0, m=mi, mt=mats)
        t = hi - lo
        if int(sp.solidity) != 0 and max(t) > 0.3: x['col'] = [{'k': 'b', 'c': ((lo + hi) / 2).tolist(), 's': t.tolist(), 'tr': 0}]
        props.append(x)
    if len(props) > 1: esc.append(props)
    print('  props', len(props) - 1, 'faltan', faltan)
    # ---- luces del mapa (las prende el juego donde hay luces puntuales)
    luces = [nodo(NOM + '_Luces')]
    for e in ents:
        c = e['classname']
        if c not in ('light', 'light_spot') or en_cielo3d(np.array(vec(e['origin']))): continue
        col_ = vec(e['_light'])[:4] if e['_light'] else [255, 255, 255, 200]; br_ = (col_[3] if len(col_) > 3 else 200)
        lz = {'t': 2, 'c': [round(col_[0] / 255, 3), round(col_[1] / 255, 3), round(col_[2] / 255, 3)], 'i': round(min(3.0, 0.6 + br_ / 500), 2), 'r': round(min(16.0, 4 + 5 * math.sqrt(br_ / 300)), 2)}
        if c == 'light_spot':
            a = vec(e['angles']); pitch = -float(e['pitch']) if e['pitch'] else a[0]
            f = MS @ ang_mat(pitch, a[1], 0)[:, 0]; lz.update(t=0, d=[round(x, 4) for x in f.tolist()], k=round(math.cos(math.radians(float(e['_cone'] or 45) + 10)), 3))
        luces.append(nodo('Luz', P(vec(e['origin'])), pa=0, lz=lz))
    if len(luces) > 1: esc.append(luces)
    # ---- aparición
    apar = [nodo('RB_Aparicion')]
    for k, e in enumerate(x for x in ents if x['classname'] == 'info_player_start'):
        apar.append(nodo('SpawnPoint%s' % ('' if k == 0 else ' (%d)' % k), P(vec(e['origin'])) + np.array([0, 0.05, 0]), pa=0))
    esc.append(apar)
    # ---- sol (light_environment fuera del cielo 3D): pitch de la luz y yaw de los ángulos
    le = [e for e in ents if e['classname'] == 'light_environment']
    lm = next((e for e in le if not en_cielo3d(np.array(vec(e['origin'])))), le[0])
    a = vec(lm['angles']); f = MS @ ang_mat(-float(lm['pitch'] or a[0]), a[1], 0)[:, 0]   # (hacia donde va la luz)
    z = np.array([0, 0, 1.0]); ax = np.cross(z, f); sn = np.linalg.norm(ax); cs = float(z @ f)
    q = (0, 0, 0, 1) if sn < 1e-6 else tuple(list(ax / sn * math.sin(math.atan2(sn, cs) / 2)) + [math.cos(math.atan2(sn, cs) / 2)])
    esc.append([nodo('Directional Light', (0, 3, 0), q, lz={'t': 1, 'c': [1.0, 0.97, 0.9], 'i': cfg.get('sol', 1.1), 'rg': 10.0, 'sa': 30.0})])
    d['esc'][NOM] = esc
    # ---- cielo: el 3D (de verdad, de fondo) y el 2D (en un cubo)
    cielo_nom = spawn_w['skyname'] or 'sky_day01_01'
    Vw = J.triangulos().reshape(-1, 3)
    lejos = 0
    if cam3d is not None and tris3d:
        # el cielo 3D: lo que está en la caja de fondo, agrandado 16 veces alrededor de la sky_camera (que es el origen
        # del mapa). Va como geometría de verdad (con su paralaje al caminar) y sin choques; el juego alarga la vista
        o3 = np.array(vec(cam3d['origin'])); esc3 = float(cam3d['scale'] or 16)
        aW = lambda v: MS @ ((np.asarray(v) - o3) * esc3) * S
        J3 = Junta(); fondo = [nodo(NOM + '_Cielo3D')]; lejos3 = []
        for x in tris3d:
            if x[0] == 'cara':
                _, f, vs, n_src = x; ti = f.texinfo; mi, modo = material_de('materials/' + ti.mat.lower() + '.vmt')
                if mi is None: continue
                tw, th = ti.tex_size; tw, th = tw or 512, th or 512
                so, to = np.array([ti.s_off.x, ti.s_off.y, ti.s_off.z]), np.array([ti.t_off.x, ti.t_off.y, ti.t_off.z])
                uv = np.stack([(vs @ so + ti.s_shift) / tw, -(vs @ to + ti.t_shift) / th], 1); uv -= np.floor(uv.min(0))
                J3.poligono(mi, [aW(v) for v in vs], MS @ n_src, uv); lejos3.extend(np.linalg.norm([aW(v) for v in vs], axis=1))
            else:
                _, ruta, o_src, ang, piel = x; r = modelo_estatico(ruta, piel)
                if r is None: faltan[ruta] = faltan.get(ruta, 0) + 1; continue
                mi, mats, (lo, hi) = r; pw = aW(o_src)
                fondo.append(nodo(os.path.basename(ruta)[:-4], pw, SM.m2q(R(ang_mat(*ang))), (esc3, esc3, esc3), pa=0, m=mi, mt=mats))
                lejos3.append(np.linalg.norm(pw[[0, 2]]) + np.linalg.norm((hi - lo)[[0, 2]]) * esc3 / 2)
        if not J3.vacia():
            mi3, mats3 = J3.guardar(NOM + '_Cielo3D'); fondo.append(nodo(NOM + '_Cielo3D_Mundo', pa=0, m=mi3, mt=mats3))
        if len(fondo) > 1: esc.append(fondo)
        # hasta dónde tiene que llegar la vista: del punto más lejano del mapa al más lejano del fondo
        mapa = np.linalg.norm(np.array([Vw[:, 0].max() - Vw[:, 0].min(), Vw[:, 2].max() - Vw[:, 2].min()])) / 2
        lejos = int(math.ceil((max(lejos3) + mapa) / 50) * 50) if lejos3 else 0
        print('  cielo 3D:', len(fondo) - 1, 'piezas, escala', esc3, '· la vista hasta', lejos, 'm')
    caras = hornear_cielo(cielo_nom, cfg.get('lado_cielo', 512))
    cubo = []
    for k, im in enumerate(caras):
        cubo.append(tex_imagen(im, NOM + '_cielo%d' % k, 88))
    # los colores del cielo para la luz ambiente y los reflejos: promedios de arriba, del horizonte y de abajo
    arr = [np.asarray(im, float) / 255 for im in caras]
    top = arr[2].reshape(-1, 3).mean(0); lados = np.concatenate([a[:a.shape[0] // 2].reshape(-1, 3) for a in (arr[0], arr[1], arr[4], arr[5])])
    mid = lados[np.argsort(lados.sum(1))[len(lados) // 4:]].mean(0); bot = np.concatenate([a[a.shape[0] // 2:].reshape(-1, 3) for a in (arr[0], arr[1], arr[4], arr[5])]).mean(0)
    base = json.loads(json.dumps(d['mt'][d['aj']['FlatGrass']['sky']])); base['n'] = 'GM_Cielo_' + NOM
    cc = base.setdefault('cc', {}); cc['_TopColor'] = top.tolist() + [1.0]; cc['_MiddleColor'] = mid.tolist() + [1.0]; cc['_BottomColor'] = bot.tolist() + [1.0]; cc['_SunTint'] = [1.0, 0.95, 0.85, 1.0]
    d['mt'].append(base)
    a = json.loads(json.dumps(d['aj']['FlatGrass'])); a['sky'] = len(d['mt']) - 1; a['ai'] = cfg.get('ai', 1.0); a['cubo'] = cubo
    fog = next((e for e in ents if e['classname'] == 'env_fog_controller'), None)
    if fog is not None and fog['fogenable'] == '1':
        a.update(fog=1, fm=1, fc=[round(x / 255, 3) for x in vec(fog['fogcolor'])], fs=round(float(fog['fogstart']) * S, 2), fe=round(float(fog['fogend']) * S, 2), fd=0)
    else: a['fog'] = 0
    if aguas: a['agua'] = aguas
    if lejos: a['lejos'] = lejos
    a.update(cfg.get('aj', {})); d['aj'][NOM] = a
    print('  cielo', cielo_nom, 'colores', np.round(top, 2), np.round(mid, 2), np.round(bot, 2), 'agua', aguas)
# ---------------- la palanca (crowbar) ----------------
import zlib, subprocess, tempfile
from PIL import ImageDraw
def T4(m3, t):
    X = np.eye(4); X[:3, :3] = m3; X[:3, 3] = t; return X
def modelo(ruta):
    b = ruta.lower().removesuffix('.mdl')
    return SM.Modelo(leer(b + '.mdl'), leer(b + '.vvd'), next(x for x in (leer(b + e) for e in ('.dx90.vtx', '.dx80.vtx', '.sw.vtx')) if x))
def icono_modelo(V, N, U, grupos, mats_vmt, lado=128, k=4):
    """el ícono del arma: el modelo de costado, en diagonal, con su textura y luz (como los íconos de las otras armas)"""
    a = math.radians(-50); Rz = np.array([[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1]])
    P2 = (Rz @ V.T).T; N2 = (Rz @ N.T).T; lo, hi = P2.min(0), P2.max(0); L = lado * k; esc = L * 0.9 / max(hi[0] - lo[0], hi[1] - lo[1])
    cen = (lo + hi) / 2; img = Image.new('RGBA', (L, L), (0, 0, 0, 0)); dr = ImageDraw.Draw(img)
    luz = np.array([0.3, 0.6, 0.75]); luz /= np.linalg.norm(luz); tris = []
    for r, T in grupos.items():
        im = vtf_imagen(mats_vmt[r]) if mats_vmt.get(r) else None; arr = np.asarray(im.convert('RGB'), float) / 255 if im else None
        for t in T:
            z = P2[t, 2].mean(); n = N2[t].mean(0); n /= np.linalg.norm(n) or 1
            if arr is not None:
                uv = U[t].mean(0); h, w = arr.shape[:2]; c = arr[int((uv[1] % 1) * (h - 1)), int((uv[0] % 1) * (w - 1))]
            else: c = np.array([0.5, 0.5, 0.5])
            c = c * (0.45 + 0.75 * max(0.0, float(n @ luz)))
            tris.append((z, [((P2[i, 0] - cen[0]) * esc + L / 2, L / 2 - (P2[i, 1] - cen[1]) * esc) for i in t], tuple(int(x) for x in np.clip(c * 255, 0, 255)) + (255,)))
    for z, pts, c in sorted(tris, key=lambda x: x[0]): dr.polygon(pts, fill=c)
    return img.resize((lado, lado), Image.LANCZOS)
def sonido(origen, nombre):
    """un .wav de HL2 a .mp3 en el paquete (como los otros sonidos)"""
    b = leer(origen)
    with tempfile.TemporaryDirectory() as t:
        open(t + '/x.wav', 'wb').write(b)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', t + '/x.wav', '-ac', '1', '-b:a', '64k', PK1 + '/a/' + nombre + '.mp3'], check=True)
    if nombre not in d['son']: d['son'].append(nombre)
# ---------------- las posturas de los jugadores de GMod (models/player/male_anims.mdl) ----------------
# idle_*, range_* y reload_* de cada tipo de arma, con los dedos: objetivos para hornear los clips humanoides (lo de arriba
# del cuerpo, con herramientas/gmod_posturas.mjs: los músculos de Unity sirven para todos los personajes), los dedos de cada
# tipo en el marco de la mano (el juego cierra la mano de cualquier personaje sobre el arma) y la mano de Source en ese
# marco (las armas del mundo van pegadas al hueso ValveBiped.Bip01_R_Hand, como en GMod)
def posturas():
    M = SM.Modelo(open(os.path.join(GM, 'garrysmod10', 'models', 'player', 'male_anims.mdl'), 'rb').read())
    H = M.huesos; idx = {h['n']: k for k, h in enumerate(H)}; sq = {s['n']: s for s in M.secuencias}
    VB = 'ValveBiped.Bip01_'
    MAPA = {'Hips': 'Pelvis', 'Spine': 'Spine', 'Spine1': 'Spine2', 'Spine2': 'Spine4', 'Neck': 'Neck1', 'Head': 'Head1'}
    for lado, l in (('Right', 'R'), ('Left', 'L')):
        MAPA.update({lado + 'Shoulder': l + '_Clavicle', lado + 'Arm': l + '_UpperArm', lado + 'ForeArm': l + '_Forearm', lado + 'Hand': l + '_Hand'})
        for dedo, k in (('Thumb', 0), ('Index', 1), ('Middle', 2), ('Ring', 3), ('Pinky', 4)):
            for seg, suf in ((1, ''), (2, '1'), (3, '2')): MAPA['%sHand%s%d' % (lado, dedo, seg)] = '%s_Finger%d%s' % (l, k, suf)
    def qmul(a, b):
        ax, ay, az, aw = a; bx, by, bz, bw = b
        return np.array([aw*bx+ax*bw+ay*bz-az*by, aw*by-ax*bz+ay*bw+az*bx, aw*bz+ax*by-ay*bx+az*bw, aw*bw-ax*bx-ay*by-az*bz])
    def slerp(a, b, t):
        c = float(np.dot(a, b))
        if c < 0: b = -b; c = -c
        if c > 0.9995: q = a + (b - a) * t
        else: o = math.acos(c); q = (math.sin((1 - t) * o) * a + math.sin(t * o) * b) / math.sin(o)
        return q / np.linalg.norm(q)
    def local(nombre, f):
        """posiciones y giros locales de un cuadro (fraccionario: se interpola); los gestos delta, sobre la postura quieta"""
        s = sq[nombre]; A = M.anims[s['anim']]; nf = A['nf']; f = min(max(f, 0), nf - 1); i0 = int(math.floor(f)); i1 = min(nf - 1, i0 + 1); t = f - i0
        P0, Q0, _ = M.pose(s['anim'], i0); P1, Q1, _ = M.pose(s['anim'], i1)
        P = [P0[k] + (P1[k] - P0[k]) * t for k in range(len(H))]; Q = [slerp(np.asarray(Q0[k], float), np.asarray(Q1[k], float), t) for k in range(len(H))]
        if s['flags'] & 4:   # delta (range_*, reload_*): sobre idle_<tipo>
            base = 'idle_' + nombre.split('_', 1)[1]
            Pb, Qb, _ = M.pose(sq[base]['anim'], 0)
            Q = [qmul(Qb[k], Q[k]) if s['flags'] & 0x10 else qmul(Q[k], Qb[k]) for k in range(len(H))]; P = [Pb[k] + P[k] for k in range(len(H))]
        return P, Q
    def mundo_juego(P, Q):
        W = M.mundo(P, Q); return {k: W[idx[VB + v]] for k, v in MAPA.items() if VB + v in idx}
    def pos_juego(W): return {k: (MS @ w[:3, 3] * S).round(5).tolist() for k, w in W.items()}
    def marco(Wp, lado):
        """marco de la mano (juego): origen en la muñeca, x hacia el nudillo del medio, y normal de la palma, z la otra"""
        h, i, m, p = (np.array(Wp[lado + 'Hand' + x]) for x in ('', 'Index1', 'Middle1', 'Pinky1'))
        x = m - h; L = np.linalg.norm(x); x /= L; n = np.cross(p - h, i - h); n -= x * (n @ x); n /= np.linalg.norm(n); z = np.cross(x, n)
        F = np.eye(4); F[:3, 0], F[:3, 1], F[:3, 2], F[:3, 3] = x, n, z, h; return F, L
    TIPOS = ['melee', 'pistol', 'smg1', 'ar2', 'shotgun', 'crossbow', 'rpg', 'gravgun']
    out = {'fps': 20, 'clips': {}, 'dedos': {}}
    for tipo in TIPOS:
        for pref, est in (('idle_', 'Pose'), ('range_', 'Shooting'), ('reload_', 'Reload')):
            nom = pref + tipo
            if nom not in sq: continue
            A = M.anims[sq[nom]['anim']]; fps = A['fps'] or 30; dur = (A['nf'] - 1) / fps
            n = 1 if est == 'Pose' else max(2, int(round(dur * 20)) + 1)
            frames = [pos_juego(mundo_juego(*local(nom, i / 20 * fps))) for i in range(n)]
            out['clips']['gm_' + nom] = {'est': est, 'd': round((n - 1) / 20, 4) if n > 1 else 1.0, 'loop': est == 'Pose', 'frames': frames}
        # los dedos de la postura quieta: dirección de cada falange en el marco de su mano (la última sigue la curva)
        Wp = pos_juego(mundo_juego(*local('idle_' + tipo, 0))); D = {}
        for lado in ('Right', 'Left'):
            F, L = marco(Wp, lado); Fi = np.linalg.inv(F); D[lado] = {}
            for dedo in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky'):
                J = [np.array(Wp['%sHand%s%d' % (lado, dedo, s)]) for s in (1, 2, 3)]
                d1, d2 = J[1] - J[0], J[2] - J[1]; d1 /= np.linalg.norm(d1); d2 /= np.linalg.norm(d2)
                # (la punta: el mismo giro que hay de la primera falange a la segunda, aplicado otra vez)
                ax = np.cross(d1, d2); s_ = np.linalg.norm(ax); c_ = float(d1 @ d2)
                if s_ > 1e-6:
                    ax /= s_; ang = math.atan2(s_, c_) * 0.8; K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
                    d3 = (np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K) @ d2
                else: d3 = d2
                D[lado][dedo] = [(Fi[:3, :3] @ d).round(5).tolist() for d in (d1, d2, d3)]
                # (y dónde quedan las articulaciones y la punta en ese marco, en largos de mano: a esos lugares se cierra
                # la mano de cada personaje, que tiene el arma en el mismo lugar del marco)
                pts = J + [J[2] + d3 * np.linalg.norm(J[2] - J[1]) * 0.8]
                D[lado].setdefault('pos', {})[dedo] = [((Fi @ np.append(q, 1))[:3] / L).round(5).tolist() for q in pts]
        out['dedos'][tipo] = D
        # (en el espacio de Source: la mano derecha y las articulaciones de sus dedos, para medir cuánto rodean el mango)
        Ws = M.mundo(*local('idle_' + tipo, 0))
        out.setdefault('fuente', {})[tipo] = {'RH': Ws[idx[VB + 'R_Hand']], 'dedos': {dedo: [Ws[idx['%sR_Finger%d%s' % (VB, k, sf)]][:3, 3] for sf in ('', '1', '2')]
            for dedo, k in (('Thumb', 0), ('Index', 1), ('Middle', 2), ('Ring', 3), ('Pinky', 4))}}
    # la mano de Source en su marco (para las armas del mundo, pegadas al hueso de la mano) y su largo
    P, Q = local('idle_melee', 0); W = M.mundo(P, Q); Wp = pos_juego(mundo_juego(P, Q))
    for lado, l in (('Right', 'R'), ('Left', 'L')):
        F, L = marco(Wp, lado); Hm = W[idx[VB + l + '_Hand']]
        He = np.eye(4); He[:3, :3] = MS @ Hm[:3, :3] @ MS.T; He[:3, 3] = MS @ Hm[:3, 3] * S
        out['mano' + l] = {'C': (np.linalg.inv(F) @ He).round(6).tolist(), 'L': round(float(L), 5)}
    return out
def muestras_aristas(V, T, paso):
    """puntos sobre las aristas de los triángulos, cada 'paso' (las barras largas tienen vértices sólo en las puntas)"""
    E = set()
    for t in T:
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])): E.add((min(a, b), max(a, b)))
    out = []
    for a, b in E:
        pa, pb = V[a], V[b]; n = max(1, int(math.ceil(np.linalg.norm(pb - pa) / paso)))
        out.extend(pa + (pb - pa) * (k / n) for k in range(n + 1))
    return np.array(out)
def envoltura_gmod(Vs, T, Bw, tipo):
    """cuánto rodea (grados) cada dedo de la mano de GMod el mango del arma: los vértices del arma (pulgadas, espacio del
    modelo) con su hueso R_Hand sobre el de la mano; el mango es lo que queda cerca de la palma (6,4 cm), su eje el principal
    de esos vértices; el ángulo, el barrido alrededor del eje del nudillo a la punta (la punta como en posturas())"""
    Fz = GMP['fuente'][tipo]; RH = np.array(Fz['RH']); Mt = RH @ np.linalg.inv(Bw); Vw = muestras_aristas((Mt[:3, :3] @ Vs.T).T + Mt[:3, 3], T, 0.4)
    D = {k: [np.array(p) for p in v] for k, v in Fz['dedos'].items()}
    pal = (RH[:3, 3] + D['Middle'][0]) / 2; cerca = Vw[np.linalg.norm(Vw - pal, axis=1) < 2.5]
    if len(cerca) < 6: return {}
    c = cerca.mean(0); ax = np.linalg.svd(cerca - c, full_matrices=False)[2][0]
    def perp(q): v = q - c; return v - ax * (v @ ax)
    env = {}
    for dedo in ('Index', 'Middle', 'Ring', 'Pinky'):
        J = list(D[dedo]); d1, d2 = J[1] - J[0], J[2] - J[1]; L2 = np.linalg.norm(d2); d1n, d2n = d1 / np.linalg.norm(d1), d2 / L2
        a = np.cross(d1n, d2n); sn = np.linalg.norm(a)
        if sn > 1e-6:
            a /= sn; ang = math.atan2(sn, float(d1n @ d2n)) * 0.8; K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
            d3 = (np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K) @ d2n
        else: d3 = d2n
        J.append(J[2] + d3 * L2 * 0.8)
        ref = perp(J[0]); ref /= np.linalg.norm(ref); e2 = np.cross(ax, ref); tot = 0; prev = None
        for q in J:
            u = perp(q); ang = math.atan2(u @ e2, u @ ref)
            if prev is not None:
                da = ang - prev
                while da > math.pi: da -= 2 * math.pi
                while da < -math.pi: da += 2 * math.pi
                tot += da
            prev = ang
        env[dedo] = round(abs(math.degrees(tot)))
    return env
def arma_mano(nombre, W, tipo, piel=0):
    """el arma del mundo (w_*.mdl) para la mano en tercera persona: su malla en el espacio del modelo y G, la matriz que la
    lleva del marco de la mano (muñeca, nudillo del medio, palma) adonde la pone GMod: el hueso de la mano de su modelo
    pegado al de la mano del jugador (G = C · Bw⁻¹, con C la mano de Source en su marco y Bw el hueso en el modelo)"""
    Vx = W.vertices; V = (MS @ Vx['pos'].T).T * S; N = (MS @ Vx['nor'].T).T; U = np.stack([Vx['uv'][:, 0], 1 - Vx['uv'][:, 1]], 1)
    hb = next((k for k, h in enumerate(W.huesos) if h['n'].endswith('R_Hand')), 0)
    Bw = np.linalg.inv(np.vstack([W.huesos[hb]['p2b'], [0, 0, 0, 1]])); Be = np.eye(4); Be[:3, :3] = MS @ Bw[:3, :3] @ MS.T; Be[:3, 3] = MS @ Bw[:3, 3] * S
    G = np.array(GMP['manoR']['C']) @ np.linalg.inv(Be)
    env = envoltura_gmod(Vx['pos'], np.concatenate([m['tris'] for m in W.mallas if m['modelo'] == 0 and len(m['tris'])]), Bw, tipo)
    J = Junta()
    for m in W.mallas:
        if m['modelo'] != 0 or not len(m['tris']): continue
        mi_, _ = mat_de_modelo(W, m['mat'], piel)
        J.tris(mi_ if mi_ is not None else 0, list(V), list(N), list(U), np.array([orientar(tuple(int(x) for x in t), V, N[t].sum(0)) for t in m['tris']]))
    mi, mats = J.guardar('GM3P_' + nombre)
    d['gm']['armas'][nombre] = {'m': mi, 'mt': mats, 'G': [round(float(x), 6) for x in G.T.reshape(-1)], 'tipo': tipo, 'env': env}
    print('  %s en la mano: los dedos de GMod rodean el mango' % nombre, env)
def vista_source(raiz, ruta, pref, secuencias):
    """un arma de primera persona de Source (v_*.mdl) debajo del WalkSway: sus huesos (en los ejes de la cámara del juego),
    la malla con piel, la boca (el enganche "muzzle": de ahí salen rayos y fogonazos) y sus animaciones remuestreadas a 30
    cuadros por segundo (pistas por el CRC32 del camino de cada hueso, como las del juego). secuencias: [(clip, secuencia de
    Source, en bucle)]. Devuelve los nombres de los clips"""
    pfk = next(k for k in d['pf'] if k.split('#')[0] == 'PhotonPlayer'); arb = d['pf'][pfk]
    # (la vista de Source tiene el origen en el ojo con x adelante, y a la izquierda, z arriba: lo mismo que la cámara del
    # juego con (x, y, z) → (y, z, x); el WalkSway está a 0,3 de la cámara)
    M = modelo(ruta); H = M.huesos; nb = len(H); Vx = M.vertices
    ws = next(i for i, n in enumerate(arb) if n['n'] == 'WalkSway')
    sc = S / 0.3; Ce = np.eye(4); Ce[:3, :3] = MS * sc; Ci = np.linalg.inv(Ce)
    # (HL2 dibuja el arma con su propio campo visual, 54° de ancho a 4:3 = 41,8° de alto; el juego, con el de la cámara
    # (70°): el arma se agranda a lo ancho y a lo alto lo que hace falta para verse en la pantalla igual que en GMod)
    kf = math.tan(math.radians(70 / 2)) / math.tan(math.atan(math.tan(math.radians(54 / 2)) * 0.75))
    i0 = len(arb); arb.append(nodo(raiz, s=(kf, kf, 1.0), pa=ws))
    for h in H:
        Xe = Ce @ T4(SM.q2m(h['q']), h['pos']) @ Ci
        arb.append(nodo(h['n'], Xe[:3, 3], SM.m2q(Xe[:3, :3]), pa=i0 + 1 + h['pa'] if h['pa'] >= 0 else i0))
    B2M = [np.linalg.inv(np.vstack([h['p2b'], [0, 0, 0, 1]])) for h in H]
    w, hb = Vx['w'], Vx['hb']; peso = np.zeros(nb)
    for c in range(3): np.add.at(peso, hb[:, c], w[:, c])
    usados = [k for k in range(nb) if peso[k] > 1e-4]; col = {k: i for i, k in enumerate(usados)}
    V = (MS @ Vx['pos'].T).T * sc; N = (MS @ Vx['nor'].T).T; U = np.stack([Vx['uv'][:, 0], 1 - Vx['uv'][:, 1]], 1)
    J = np.zeros((len(V), 4), np.int64); Wt = np.zeros((len(V), 4))
    for c in range(3): J[:, c] = [col.get(x, 0) for x in hb[:, c]]; Wt[:, c] = w[:, c] * np.array([x in col for x in hb[:, c]])
    for a_ in range(3):
        for b_ in range(a_ + 1, 3):
            igual = (J[:, a_] == J[:, b_]) & (Wt[:, b_] > 0); Wt[igual, a_] += Wt[igual, b_]; Wt[igual, b_] = 0
    Wt /= np.maximum(Wt.sum(1, keepdims=True), 1e-9); wb = np.floor(Wt * 255).astype(np.int32); wb[:, 0] += 255 - wb.sum(1)
    piel = np.zeros((len(V), 8), np.uint8); piel[:, :4] = J; piel[:, 4:] = wb
    bp = [[float(x) for x in np.linalg.inv(Ce @ B2M[k] @ Ci).reshape(16)] for k in usados]
    por = {}
    for m in M.mallas:
        if m['modelo'] != 0: continue
        mi, _ = mat_de_modelo(M, m['mat'], 0)
        for t in m['tris']: por.setdefault(mi, []).extend(orientar(tuple(int(x) for x in t), V, N[t[0]] + N[t[1]] + N[t[2]]))
    mi, mats = malla_bin(pref + '_Vista', V, N, U, por, piel=piel, bp=bp)
    arb.append(nodo(pref + '_Malla', pa=i0, m=mi, mt=mats, bo=[i0 + 1 + k for k in usados]))
    a = next((x for x in M.adjuntos if x['n'].lower() == 'muzzle' and 0 <= x['hueso'] < nb), None)
    if a is not None:
        Xe = Ce @ np.vstack([a['m'], [0, 0, 0, 1]]) @ Ci
        arb.append(nodo('Muzzle', Xe[:3, 3], SM.m2q(Xe[:3, :3]), pa=i0 + 1 + a['hueso']))
    def ruta_h(k):
        r = []
        while k >= 0: r.append(H[k]['n']); k = H[k]['pa']
        return '/'.join(reversed(r))
    sq = {x['n']: x for x in M.secuencias}; clips = d['an']['clips']; nombres = []
    for nom, seq, loop in secuencias:
        if seq not in sq: print('  falta la secuencia', seq, 'en', ruta); continue
        sx = sq[seq]; A = M.anims[sx['anim']]; nf = A['nf']; fps = A['fps'] or 30; dur = (nf - 1) / fps
        n30 = max(2, int(round(dur * 30)) + 1); poses = [M.pose(sx['anim'], f) for f in range(nf)]
        Pk = [[] for _ in range(nb)]; Rk = [[] for _ in range(nb)]
        for i in range(n30):
            fr = min(nf - 1, i / 30 * fps); f0 = int(math.floor(fr)); f1 = min(nf - 1, f0 + 1); t = fr - f0
            P0, Q0, _ = poses[f0]; P1, Q1, _ = poses[f1]
            for k in range(nb):
                q0 = np.asarray(Q0[k], float); q1 = np.asarray(Q1[k], float)
                if np.dot(q0, q1) < 0: q1 = -q1
                qi = q0 * (1 - t) + q1 * t; qi /= np.linalg.norm(qi)
                Xe = Ce @ T4(SM.q2m(qi), np.asarray(P0[k]) * (1 - t) + np.asarray(P1[k]) * t) @ Ci; q = SM.m2q(Xe[:3, :3]); q = q / np.linalg.norm(q)
                if Rk[k] and np.dot(q, Rk[k][-1]) < 0: q = -q
                Pk[k].append([round(float(x), 5) for x in Xe[:3, 3]]); Rk[k].append(q)
        pistas = []
        for k in range(nb):
            hcrc = zlib.crc32(ruta_h(k).encode('utf-8'))
            pistas.append({'h': hcrc, 'k': 'p', 'f': Pk[k]}); pistas.append({'h': hcrc, 'k': 'r', 'f': [[round(float(x), 5) for x in q] for q in Rk[k]]})
        clips[nom] = [{'d': round((n30 - 1) / 30, 4), 'loop': loop, 'p': pistas}]; nombres.append(nom)
    d['an']['ctl'][raiz] = nombres
    return M, len(V), len(usados), nombres
def palanca():
    global PAK, PAKN
    PAK, PAKN = None, {}
    pfk = next(k for k in d['pf'] if k.split('#')[0] == 'PhotonPlayer'); arb = d['pf'][pfk]
    # ---- primera persona: v_crowbar, debajo del WalkSway
    M, nv, nu, clips_cb = vista_source('Crowbar', 'models/weapons/v_crowbar.mdl', 'CB', (('CB_idle', 'idle01', 1), ('CB_draw', 'draw', 0),
        ('CB_miss1', 'misscenter1', 0), ('CB_miss2', 'misscenter2', 0), ('CB_hit1', 'hitcenter1', 0), ('CB_hit2', 'hitcenter2', 0), ('CB_hit3', 'hitcenter3', 0), ('CB_holster', 'holster', 0)))
    nb = len(M.huesos); clips = d['an']['clips']
    # ---- la del mundo (w_crowbar): en la mano en tercera persona (donde va el bate) y suelta como prop. Va parada como el
    # bate (a lo largo de +y, la mano cerca de la punta recta y el gancho arriba)
    W = modelo('models/weapons/w_crowbar.mdl'); Vw = W.vertices; Pw = Vw['pos'] * S; Nw = Vw['nor']; Uw = np.stack([Vw['uv'][:, 0], 1 - Vw['uv'][:, 1]], 1)
    grupos = {}; vmts = {}
    for m in W.mallas:
        if m['modelo'] == 0 and len(m['tris']): grupos.setdefault(m['mat'], []).append(m['tris'])
    grupos = {r: np.concatenate(g) for r, g in grupos.items()}
    cabeza = next(r for r in grupos if W.texturas[r].lower() == 'head_uvw')
    yc = Pw[np.unique(grupos[cabeza]), 1].mean(); sg = 1.0 if yc > Pw[:, 1].mean() else -1.0
    Ra = np.diag([sg, sg, 1.0])   # (gira 180° alrededor de z si el gancho quedaba abajo)
    Pa = (Ra @ Pw.T).T; Na = (Ra @ Nw.T).T; y0 = Pa[:, 1].min() + 0.13; Pa[:, 1] -= y0
    Jw = Junta()
    for r, T in grupos.items():
        mi_, vmt = mat_de_modelo(W, r, 0); vmts[r] = vmt and 'materials/' + kv_material(vmt)[1].get('$basetexture', '').lower().replace('\\', '/') + '.vtf'
        Jw.tris(mi_, list(Pa), list(Na), list(Uw), np.array([orientar(tuple(int(x) for x in t), Pa, Na[t].sum(0)) for t in T]))
    mi_w, mats_w = Jw.guardar('CB_Mundo'); lo, hi = Pa.min(0), Pa.max(0)
    bat = d['pf'][next(k for k in d['pf'] if k.split('#')[0] == 'Bat')][0]
    pr = {k: v for k, v in bat.items() if k not in ('n', 'm', 'mt', 'col', 'rid', 'p')}
    d['pf']['Crowbar#990001'] = [dict(pr, n='Crowbar', p=[0.0, 0.0, 0.0], m=mi_w, mt=mats_w, rid=990001, col=[{'k': 'b', 'c': ((lo + hi) / 2).tolist(), 's': (hi - lo).tolist(), 'tr': 0}])]
    for c in d['menu']:
        if c['n'] == 'Weapons' and 'Crowbar' not in c['sub'][0]['it']: c['sub'][0]['it'].insert(0, 'Crowbar')
    ico = icono_modelo(Pa, Na, Uw, grupos, vmts); ico.save(PK1 + '/i/W_Crowbar.webp', 'WEBP', quality=90); d['ico']['W_Crowbar'] = 'W_Crowbar'
    arma_mano('Crowbar', W, 'melee')   # (en tercera persona: pegada a la mano como en GMod)
    # ---- sonidos: el golpe al aire, contra el mundo y contra la carne
    sonido('sound/weapons/iceaxe/iceaxe_swing1.wav', 'CB_Swing')
    for i in (1, 2): sonido('sound/weapons/crowbar/crowbar_impact%d.wav' % i, 'CB_Impact%d' % i)
    for i in range(1, 6): sonido('sound/physics/flesh/flesh_impact_bullet%d.wav' % i, 'CB_Flesh%d' % i)
    print('palanca: huesos', nb, 'con peso', nu, 'verts', nv, 'clips', clips_cb, 'mundo', len(Pa), 'verts, largo', round(float(hi[1] - lo[1]), 2), 'm')

def icono_arma(ruta, nombre, piel=0):
    """el ícono de un arma (w_*.mdl) para la barra y el menú, como el de la palanca"""
    W = modelo(ruta); Vw = W.vertices; Pw = Vw['pos'] * S; Nw = Vw['nor']; Uw = np.stack([Vw['uv'][:, 0], 1 - Vw['uv'][:, 1]], 1)
    grupos = {}
    for m in W.mallas:
        if m['modelo'] == 0 and len(m['tris']): grupos.setdefault(m['mat'], []).append(m['tris'])
    grupos = {r: np.concatenate(g) for r, g in grupos.items()}; vmts = {}
    for r in grupos:
        _, vmt = mat_de_modelo(W, r, piel); vmts[r] = vmt and 'materials/' + kv_material(vmt)[1].get('$basetexture', '').lower().replace('\\', '/') + '.vtf'
    ico = icono_modelo(Pw, Nw, Uw, grupos, vmts); ico.save(PK1 + '/i/' + nombre + '.webp', 'WEBP', quality=90); d['ico'][nombre] = nombre
    return W
def armas_gmod():
    """la Tool Gun y la Physics Gun de GMod y la Gravity Gun de HL2 en lugar de la taser, la láser y la de gravedad: la vista
    con sus animaciones, el modelo del mundo en la mano en tercera persona (como en GMod 10: la Tool Gun y la Physics Gun
    con la postura de pistola, la Gravity Gun con la suya), íconos y sonidos"""
    for raiz, ruta, pref, sec in (
            ('GM_ToolGun', 'models/weapons/v_toolgun.mdl', 'TG', (('TG_idle', 'idle01', 1), ('TG_draw', 'draw', 0), ('TG_fire', 'fire', 0), ('TG_holster', 'holster', 0))),
            ('GM_PhysGun', 'models/weapons/v_superphyscannon.mdl', 'PG', (('PG_idle', 'idle', 1), ('PG_hold', 'hold_idle', 1), ('PG_draw', 'draw', 0), ('PG_fire', 'fire', 0), ('PG_holster', 'holster', 0))),
            ('GM_GravGun', 'models/weapons/v_physcannon.mdl', 'GG', (('GG_idle', 'idle', 1), ('GG_hold', 'hold_idle', 1), ('GG_draw', 'draw', 0), ('GG_fire', 'fire', 0), ('GG_altfire', 'altfire', 0), ('GG_holster', 'holster', 0)))):
        M, nv, nu, cl = vista_source(raiz, ruta, pref, sec); print('  %s: huesos %d, con peso %d, verts %d, clips %s' % (raiz, len(M.huesos), nu, nv, cl))
    Wt = icono_arma('models/weapons/w_toolgun.mdl', 'W_ToolGun'); arma_mano('ToolBaton', Wt, 'pistol')
    Wp = icono_arma('models/weapons/w_physics.mdl', 'W_PhysGun', 1); arma_mano('PhysicsGun', Wp, 'pistol', 1)
    Wg = icono_arma('models/weapons/w_physics.mdl', 'W_GravGun', 0); arma_mano('GravityGun', Wg, 'gravgun', 0)
    for i in (1, 2): sonido('sound/weapons/airboat/airboat_gun_lastshot%d.wav' % i, 'TG_Fire%d' % i)
    for i in range(1, 5): sonido('sound/weapons/physcannon/superphys_launch%d.wav' % i, 'GG_Launch%d' % i)
    for f, n in (('physcannon_pickup', 'GG_Pickup'), ('physcannon_drop', 'GG_Drop'), ('hold_loop', 'GG_Hold'), ('physcannon_dryfire', 'GG_Dry'),
                 ('physcannon_claws_open', 'GG_Open'), ('physcannon_claws_close', 'GG_Close'), ('superphys_hold_loop', 'PG_Hold')):
        sonido('sound/weapons/physcannon/%s.wav' % f, n)
    sonido('sound/weapons/physgun_off.wav', 'PG_Off')
convertir('RB_Construct', 'gm_construct', {'cielo3d': lambda c: c[0] < -6000, 'sol': 1.15})
convertir('RB_Flatgrass', 'gm_flatgrass', {'sol': 1.15})
GMP = posturas()
d['gm'] = {'dedos': GMP['dedos'], 'manoR': GMP['manoR'], 'manoL': GMP['manoL'], 'armas': {}}
json.dump({'fps': GMP['fps'], 'clips': GMP['clips']}, open(PK1 + '/gm_objetivos.json', 'w'), separators=(',', ':'))
palanca()
armas_gmod()
if len(sys.argv) > 4 and os.path.exists(sys.argv[4]):   # (los clips ya horneados con gmod_posturas.mjs)
    for c in json.load(open(sys.argv[4]))['clips'].values():
        est = d['hu']['est'].setdefault(c['est'], []); est[:] = [x for x in est if x['n'] != c['n']]
        est.append({'n': c['n'], 'd': c['d'], 'nf': c['nf'], 'loop': c['loop'], 'c': c['c']})
    print('posturas de GMod horneadas:', len(json.load(open(sys.argv[4]))['clips']))
if len(sys.argv) > 5 and os.path.isdir(sys.argv[5]):   # (fondos de carga e íconos de los mapas)
    F = sys.argv[5]; os.makedirs(PK1 + '/carga', exist_ok=True); os.makedirs(PK1 + '/i', exist_ok=True)
    for f in os.listdir(PK1 + '/carga'):   # (las de una corrida anterior)
        if f.endswith(('_rb_construct.jpg', '_rb_gmflatgrass.jpg')): os.remove(PK1 + '/carga/' + f)
    n0 = len([f for f in os.listdir(PK1 + '/carga') if f.endswith('.jpg')])
    for k, (foto, mapa, fondo) in enumerate((('construct', 'RB_Construct', 'rb_construct'), ('flatgrass', 'RB_Flatgrass', 'rb_gmflatgrass'))):
        im = Image.open(os.path.join(F, foto + '_carga.jpg')).convert('RGB').resize((1280, 720), Image.LANCZOS)
        dst = PK1 + '/carga/%d_%s.jpg' % (n0 + k, fondo)
        if os.path.exists(dst): os.remove(dst)
        im.save(dst, 'JPEG', quality=84, optimize=True)
        ic = Image.open(os.path.join(F, foto + '_icono.jpg')).convert('RGB').resize((400, 225), Image.LANCZOS)
        dst = PK1 + '/i/mapa_' + mapa + '.webp'
        if os.path.exists(dst): os.remove(dst)
        ic.save(dst, 'WEBP', quality=86); d['ico']['mapa_' + mapa] = 'mapa_' + mapa
    print('fondos de carga e íconos de los mapas de GMod')
open(PK1 + '/m.bin.gz', 'wb').write(gzip.compress(bytes(BIN), 9))
open(PK1 + '/d.json.gz', 'wb').write(gzip.compress(json.dumps(d, separators=(',', ':')).encode(), 6))
print('listo: texturas', len(d['tx']), 'mallas', len(d['ms']), 'materiales', len(d['mt']), 'bin', len(BIN) // 1000, 'KB')
