# La pizzería de FNAF 1 y sus animatrónicos para la noche de terror (juego/noche.js), sumados a un paquete del juego:
# - el mapa "FNaF 1 Custom map by Fedy!" de Garry's Mod (BSP): las caras del mundo con sus texturas, los props (estáticos
#   y de entidades) con sus modelos, las puertas y los botones de la oficina, las luces, las cámaras de seguridad y los
#   puntos de aparición. Pasa de Source (Z arriba, pulgadas) al juego (Y arriba, metros) con (x, y, z) → (y, z, x).
# - Freddy, Bonnie, Chica y Foxy del "FNAF Help Wanted NEXTBOT Pack" (cl3nr): mallas con piel (los huesos del .mdl,
#   a lo sumo 56 con peso), texturas y animaciones (quieto, caminar o correr, susto, mirar) muestreadas cuadro a cuadro.
# Lo extraído no va al repo: este script lo lee de afuera. Créditos en CREDITOS.md.
# Uso: [FN_EXTRA=carpeta1:carpeta2] python-con-srctools -I pizzeria.py PAQUETE_ORIGEN PAQUETE_NUEVO MAPA.bsp CARPETA_PACK_HW
# (FN_EXTRA: lo bajado de otros addons con las texturas y modelos de props que el mapa no trae: las mesas, el escritorio...)
import sys, os, io, json, gzip, math, zipfile, hashlib, numpy as np
from PIL import Image
import srctools.bsp as BSPm, srctools.vtf as VTF
from srctools.keyvalues import Keyvalues
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import source_mdl as SM

PK0, PK1, BSPF, HW = sys.argv[1:5]
os.makedirs(PK1, exist_ok=True)
for sub in ('t', 'i', 'a', 'fondos', 'carga', 'v'):
    os.makedirs(os.path.join(PK1, sub), exist_ok=True)
    if os.path.isdir(os.path.join(PK0, sub)):
        for f in os.listdir(os.path.join(PK0, sub)):
            dst = os.path.join(PK1, sub, f)
            if not os.path.exists(dst): os.link(os.path.join(PK0, sub, f), dst)
d = json.load(gzip.open(PK0 + '/d.json.gz')); BIN = bytearray(gzip.decompress(open(PK0 + '/m.bin.gz', 'rb').read()))
assert 'RB_Pizzeria' not in d['esc'], 'el paquete de origen ya tiene la pizzería'
def agregar(b):
    while len(BIN) % 4: BIN.append(0)
    o = len(BIN); BIN.extend(b); return o
FN = d['fn'] = {'pf': {}, 'clips': {}}

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

# ---------------- archivos: el pak del mapa y la carpeta del pack ----------------
bsp = BSPm.BSP(BSPF); PAK = bsp.pakfile; PAKN = {n.lower().replace('\\', '/'): n for n in PAK.namelist()}
# texturas y modelos de otros addons de GMod que el mapa usa y no trae (carpetas con lo bajado, en minúsculas)
EXTRA = [x for x in os.environ.get('FN_EXTRA', '').split(os.pathsep) if x]
def leer(ruta):
    r = ruta.lower().replace('\\', '/')
    if r in PAKN: return PAK.read(PAKN[r])
    for base in [HW] + EXTRA:
        f = os.path.join(base, r)
        if os.path.exists(f): return open(f, 'rb').read()
    if r.startswith('materials/models/keithy/'): return leer('materials/' + r[len('materials/models/'):])   # (los props de Keithy las piden en models/keithy/props)
    return None

# ---------------- texturas y materiales ----------------
_mats, _txs = {}, {}
def kv_material(ruta):
    """(shader, {clave: valor}) de un .vmt, siguiendo los 'patch'"""
    b = leer(ruta)
    if b is None: return None, {}
    txt = b.decode('utf-8', 'replace')
    for intento in range(3):   # (hay .vmt a los que les falta la llave del final)
        try: kv = Keyvalues.parse(txt, ruta); break
        except Exception: txt += '\n}'
    else:
        import re
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
def textura(ruta_vtf, nombre, lado, alfa_ok=True):
    k = (ruta_vtf.lower(), lado)
    if k in _txs: return _txs[k]
    b = leer(ruta_vtf)
    if b is None: _txs[k] = None; return None
    v = VTF.VTF.read(io.BytesIO(b)); im = v.get().to_PIL().convert('RGBA')
    a = np.asarray(im)[:, :, 3]; alfa = alfa_ok and a.min() < 250
    w, h = im.size; s = min(1.0, lado / max(w, h)); w2, h2 = max(4, round(w * s)), max(4, round(h * s))
    im = im.resize((w2, h2), Image.LANCZOS)
    huella = hashlib.md5(im.tobytes()).hexdigest()   # (la misma imagen en otra carpeta: una sola vez)
    if huella in _txs: _txs[k] = _txs[huella]; return _txs[k]
    ti = len(d['tx']); d['tx'].append({'n': 'FN_' + nombre[-40:], 'a': 1 if alfa else 0, 'w': w2, 'h': h2})
    (im if alfa else im.convert('RGB')).save(PK1 + '/t/%d.webp' % ti, 'WEBP', quality=80, method=6)
    _txs[k] = _txs[huella] = (ti, alfa); return _txs[k]
def tex_imagen(img, nombre):
    ti = len(d['tx']); d['tx'].append({'n': 'FN_' + nombre, 'a': 0, 'w': img.size[0], 'h': img.size[1]})
    img.convert('RGB').save(PK1 + '/t/%d.webp' % ti, 'WEBP', quality=86, method=6); return ti
def mat_nuevo(nombre, ti, modo, color=(1, 1, 1, 1)):
    mi = len(d['mt'])
    m = {'n': 'FN_' + nombre, 't': ti, 'ts': [1.0, 1.0], 'to': [0.0, 0.0], 'tt': {'_MainTex': [ti, 1.0, 1.0, 0.0, 0.0]}, 'cc': {'_Color': list(color)}, 'c': list(color), 'f': {}}
    if modo == 'cut': m.update(sh='Standard', f={'_Mode': 1.0, '_Glossiness': 0.15, '_Metallic': 0.0})
    elif modo == 'blend': m['sh'] = 'Legacy Shaders/Transparent/Diffuse'
    elif modo == 'unlit': m['sh'] = 'Unlit/Texture'
    else: m['sh'] = 'Mobile/Diffuse'
    d['mt'].append(m); return mi
# texturas que el mapa pide y no trae (son del Counter-Strike o del HL2): hechas acá
def ruido(n, beta, semilla):
    r = np.random.default_rng(semilla).standard_normal((n, n)); F = np.fft.fft2(r)
    ky, kx = np.fft.fftfreq(n)[:, None], np.fft.fftfreq(n)[None, :]; k = np.sqrt(kx * kx + ky * ky); k[0, 0] = 1
    x = np.real(np.fft.ifft2(F / k ** beta)); return (x - x.min()) / (x.max() - x.min())
def falta(nombre):
    n = 256
    if 'metal' in nombre:   # acero inoxidable cepillado
        a = ruido(n, 0.6, 1); rayas = np.repeat(ruido(n, 1.2, 2).mean(1, keepdims=True), n, 1)
        g = 150 + 40 * (a - 0.5) + 50 * (rayas - 0.5); img = np.stack([g, g * 1.01, g * 1.03], -1)
    elif 'freddywall' in nombre or 'employees' in nombre:
        a = ruido(n, 1.3, 3); g = 70 + 40 * a; img = np.stack([g * 0.9, g * 0.95, g], -1)
    else:   # (texturas de prueba del editor): revoque gris oscuro
        a = ruido(n, 1.2, 4); g = 62 + 30 * a; img = np.stack([g, g, g * 1.04], -1)
    return tex_imagen(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), nombre.split('/')[-1])
COLORES = [('hat_blue', (40, 90, 200)), ('hat_red', (200, 40, 40)), ('hat_green', (50, 170, 70)), ('purple', (130, 60, 170)), ('prple', (130, 60, 170)),
           ('lemonlime', (190, 210, 60)), ('cherry', (220, 80, 120)), ('strap', (230, 230, 230)), ('table', (225, 222, 214)), ('cupcake', (235, 120, 170)),
           ('pizza', (215, 150, 70)), ('monitor', (40, 42, 46)), ('arcade', (34, 30, 52)), ('red', (190, 30, 30)), ('button', (120, 120, 120)),
           ('fan', (70, 74, 80)), ('camera', (60, 62, 66)), ('uv', (60, 62, 66)), ('lamp', (90, 90, 80)), ('shelf', (110, 80, 50)), ('sign', (200, 200, 200))]
_colores = {}
# los arcades (sin texturas en el mapa ni en ningún addon): carteles con el nombre, laterales con estrellas y pantallas
ARCADE = {'freddy': ((70, 42, 26), (240, 190, 60), 'FREDDY'), 'bonnie': ((60, 40, 120), (235, 235, 255), 'BONNIE'), 'foxy': ((150, 40, 30), (250, 210, 70), 'FOXY'), 'chica': ((200, 170, 30), (255, 250, 230), 'CHICA')}
def tex_arcade(tn):
    from PIL import ImageDraw, ImageFont
    quien = next((k for k in ARCADE if k in tn), None)
    if 'screen' in tn:   # pantalla de tubo: azul oscuro con líneas y un muñequito de píxeles
        im = Image.new('RGB', (128, 128), (22, 44, 96)); dr = ImageDraw.Draw(im)
        for y in range(0, 128, 4): dr.line([(0, y), (128, y)], fill=(12, 26, 62))
        for (x, y, c) in ((56, 40, (230, 190, 60)), (52, 48, (230, 190, 60)), (60, 48, (230, 190, 60)), (56, 56, (120, 80, 40)), (48, 64, (90, 200, 255)), (64, 64, (90, 200, 255))): dr.rectangle([x, y, x + 15, y + 7], fill=c)
        dr.rectangle([8, 100, 120, 104], fill=(60, 160, 90)); return im, 'unlit'
    if not quien or not any(x in tn for x in ('banner', 'sides', 'borders')): return None, None
    fondo, letra, nom = ARCADE[quien]; im = Image.new('RGB', (256, 256), fondo); dr = ImageDraw.Draw(im)
    rng = np.random.default_rng(sum(tn.encode()))
    for _ in range(18):   # estrellas
        x, y, r = rng.integers(0, 256), rng.integers(0, 256), rng.integers(4, 12)
        dr.polygon([(x + r * math.cos(a) * (1 if i % 2 == 0 else 0.45), y + r * math.sin(a) * (1 if i % 2 == 0 else 0.45)) for i, a in enumerate(np.linspace(-math.pi / 2, 1.5 * math.pi, 11)[:-1])], fill=tuple(min(255, c + 60) for c in fondo))
    if 'banner' in tn and 'bottom' not in tn:
        f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 64 if len(nom) > 4 else 80)
        w = dr.textlength(nom, font=f); dr.text(((256 - w) / 2 + 3, 92), nom, font=f, fill=(20, 12, 8)); dr.text(((256 - w) / 2, 88), nom, font=f, fill=letra)
    return im, 'op'
COLORES_EXACTOS = {'black': (26, 26, 28), 'oldblack': (34, 31, 29), 'white': (222, 222, 216), 'blue': (40, 72, 175), 'green': (50, 150, 60), 'red': (185, 32, 32), 'orange': (215, 115, 40),
                   'greenborders': (40, 140, 60), 'orangeborders': (225, 120, 30), 'lampblack': (58, 62, 56), 'on': (255, 240, 200)}
def mat_color(nombre):
    tn = nombre.split(' ')[0].lower()
    im, modo = tex_arcade(tn) if 'arcade' in nombre.lower() else (None, None)
    if im is not None:
        if tn not in _colores: _colores[tn] = mat_nuevo('arcade_' + tn, tex_imagen(im, 'arcade_' + tn), modo)
        return _colores[tn]
    if tn == 'on':   # (la lamparita de la lámpara de la oficina, prendida)
        if 'on' not in _colores: _colores['on'] = mat_nuevo('lamparita', tex_imagen(Image.new('RGB', (4, 4), (255, 238, 196)), 'lamparita'), 'unlit')
        return _colores['on']
    c = COLORES_EXACTOS.get(tn) or next((col for k, col in COLORES if k in tn), None) or next((col for k, col in COLORES if k in nombre.lower()), (128, 128, 128))
    if c not in _colores:
        _colores[c] = mat_nuevo('color%d_%d_%d' % c, tex_imagen(Image.new('RGB', (4, 4), c), 'color%d_%d_%d' % c), 'op')
    return _colores[c]
def material_de(vmt, lado=512):
    """índice de material del juego para un .vmt (o None)"""
    k = (vmt.lower(), lado)
    if k in _mats: return _mats[k]
    sh, c = kv_material(vmt)
    bt = c.get('$basetexture')
    tx = textura('materials/' + bt.lower().replace('\\', '/').removesuffix('.vtf') + '.vtf', bt, lado) if bt else None
    nombre = vmt.lower().removeprefix('materials/').removesuffix('.vmt')
    if tx is None:
        if sh is None and not any(s in nombre for s in ('metal', 'dev', 'freddywall', 'employees')): _mats[k] = None; return None
        tx = (falta(nombre), False)
    ti, alfa = tx
    trans = c.get('$translucent', '0') not in ('0', ''); corte = c.get('$alphatest', '0') not in ('0', ''); aditivo = c.get('$additive', '0') not in ('0', '')
    brillo = c.get('$selfillum', '0') not in ('0', '') and 'eye' in nombre
    modo = 'unlit' if (aditivo or brillo) and not trans else 'blend' if trans or aditivo else 'cut' if corte or (alfa and 'decal' in nombre) else 'op'
    # vidrios con $alpha (las ventanas de la oficina): transparentes de verdad, no grises
    try: am = float(c.get('$alpha', '1') or 1)
    except ValueError: am = 1.0
    color = (1, 1, 1, max(0.18, min(0.42, am))) if am < 0.99 else (1, 1, 1, 1)
    if am < 0.99: modo = 'blend'
    _mats[k] = mat_nuevo(nombre.split('/')[-1], ti, modo, color); return _mats[k]
def mat_es_vidrio(mi): return mi is not None and d['mt'][mi].get('sh') == 'Legacy Shaders/Transparent/Diffuse'

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
    mi = len(d['ms']); d['ms'].append(x); return mi, mats
def orientar(tri, V, n):
    """el orden de un triángulo para que se vea del lado de la normal n (el juego dibuja la cara con (b-a)×(c-a) hacia uno)"""
    a, b, c = tri
    return (a, b, c) if np.dot(np.cross(V[b] - V[a], V[c] - V[a]), n) >= 0 else (a, c, b)
def nodo(n, p=(0, 0, 0), r=(0, 0, 0, 1), s=(1, 1, 1), pa=-1, **x):
    return dict(n=n, p=[round(float(v), 5) for v in p], r=[round(float(v), 6) for v in r], s=[round(float(v), 5) for v in s], pa=pa, **x)

# ---------------- el mapa: caras ----------------
SALTAR = ('tools/', 'skybox')
# de qué lado se ve cada cara: del que no hay brocha sólida. En este BSP el plano y el "side" de la cara no alcanzan (pisos y
# techos vienen anotados igual: medido, la mitad de techos y paredes quedaban mirando para afuera y el juego no las dibujaba)
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
    _BR.append((Nb, Db))
    _BR[-1] += (lo, hi)
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
CARAS_VUELTA = [0, 0, 0]   # (dadas vuelta, de los dos lados, como venían)
def caras_a_malla(caras, origen, nombre, colision=True, ver_solido=False):
    """caras del BSP (con su origen de entidad) → malla del juego por material; devuelve (malla, mats) o None"""
    V, N, U, porMat = [], [], [], {}
    for f in caras:
        ti = f.texinfo
        if ti is None: continue
        fl = ti.flags.value
        if fl & (0x4 | 0x2 | 0x80 | 0x200 | 0x100): continue   # cielo, nodraw, skip, hint
        mat = ti.mat.lower()
        if mat.startswith(SALTAR): continue
        mi = material_de('materials/' + mat + '.vmt')
        if mi is None: continue
        vs = [np.array([e.a.x, e.a.y, e.a.z]) + origen for e in f.edges]
        if len(vs) < 3: continue
        nsrc = np.array([f.plane.normal.x, f.plane.normal.y, f.plane.normal.z]) * (-1 if f.same_dir_as_plane else 1)
        lv = lado_visible(np.array(vs), nsrc) if ver_solido else 1
        if mat_es_vidrio(mi): lv = 0   # (vidrios y cortinas: de los dos lados)
        if lv < 0: nsrc = -nsrc
        CARAS_VUELTA[0 if lv < 0 else 1 if lv == 0 else 2] += 1
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
    TRIS[nombre] = np.array(V)[np.array([i for l in porMat.values() for i in l]).reshape(-1, 3)]   # (para la grilla por donde caminan)
    return malla_bin(nombre, V, N, U, porMat)
TRIS = {}

ents = list(bsp.ents.entities)
mundo_ent = next(e for e in bsp.bmodels if e['classname'] == 'worldspawn')
mi_mundo, mats_mundo = caras_a_malla(bsp.bmodels[mundo_ent].faces, np.zeros(3), 'FN_Pizzeria', ver_solido=True)
print('caras del mundo: dadas vuelta', CARAS_VUELTA[0], '· de los dos lados', CARAS_VUELTA[1], '· como venían', CARAS_VUELTA[2])
esc = []
esc.append([nodo('RB_Pizzeria', m=mi_mundo, mt=mats_mundo, rid=9930000, col=[{'k': 'm', 'm': mi_mundo, 'cv': 0, 'tr': 0}])])
# entidades de brocha: puertas de la oficina, botones, cortinas, puertas comunes (abiertas, sin choque)
puertas, botones, fijas = {}, [], [nodo('FN_Brochas')]; BISAGRAS = []; CORTINA = []
for e, bm in bsp.bmodels.items():
    c = e['classname']
    if c == 'worldspawn': continue
    o = np.array(vec(e['origin']))
    if c == 'func_door_rotating':   # bisagra en el origen: se dibuja abierta 90° (hacia donde no choca con la pared)
        BISAGRAS.append(P(o))
        r = caras_a_malla(bm.faces, np.zeros(3), 'FN_PuertaComun')
        if r: fijas.append(nodo('PuertaComun', P(o), SM.m2q(R(ang_mat(0, 90, 0))), pa=0, m=r[0], mt=r[1]))
        continue
    if c == 'func_brush' and e['targetname'] == 'FoxyCurtain' and P(o)[2] < -5: CORTINA.append((bm, o)); continue   # (la de Pirate Cove se hace aparte)
    r = caras_a_malla(bm.faces, np.zeros(3), 'FN_' + c)
    if not r: continue
    if c == 'func_door' and e['targetname'] in ('DoorLeft', 'DoorRight'):
        lado = 'izq' if e['targetname'] == 'DoorLeft' else 'der'
        mn, mx = np.array([bm.mins.x, bm.mins.y, bm.mins.z]), np.array([bm.maxes.x, bm.maxes.y, bm.maxes.z])
        puertas[lado] = {'p': P(o).tolist(), 'alto': float((mx[2] - mn[2]) * S), 'caja': np.abs(MS @ (mx - mn) * S).tolist()}
        esc.append([nodo('FN_Puerta_' + lado, P(o), m=r[0], mt=r[1])])
    elif c == 'func_button':
        botones.append(P(o).tolist()); fijas.append(nodo('Boton', P(o), pa=0, m=r[0], mt=r[1]))
    else: fijas.append(nodo(e['targetname'] or c, P(o), pa=0, m=r[0], mt=r[1]))
esc.append(fijas)
# la cortina de Pirate Cove: la del mapa estiraba el dibujo de la tela y se veía una tira al costado (Foxy, a la vista). Acá,
# dos paños con la tela entera (con su borde de abajo recortado) que el juego junta a los costados cuando Foxy se asoma
if CORTINA:
    bm, o = CORTINA[0]
    esq = np.array([P(np.array(o) + np.array([x, y, z])) for x in (bm.mins.x, bm.maxes.x) for y in (bm.mins.y, bm.maxes.y) for z in (bm.mins.z, bm.maxes.z)])
    lo, hi = esq.min(0), esq.max(0); xc = (lo[0] + hi[0]) / 2; zf = hi[2] - 0.03
    ti_c = textura('materials/fedy/fnaf1map/curtains.vtf', 'fedy/fnaf1map/curtains', 512)[0]; mc = mat_nuevo('cortina_pirata', ti_c, 'cut')
    for lado, x0, sg in (('Izq', lo[0], 1), ('Der', hi[0], -1)):
        an = abs(xc - x0) + 0.15; V = [(0, lo[1], 0), (sg * an, lo[1], 0), (sg * an, hi[1], 0), (0, hi[1], 0)]
        U = [(0.30, 0.08), (0.80, 0.08), (0.80, 1.0), (0.30, 1.0)] if sg > 0 else [(0.80, 0.08), (0.30, 0.08), (0.30, 1.0), (0.80, 1.0)]
        Va = np.array(V, float); n = np.array([0, 0, 1.0]); tri = orientar((0, 1, 2), Va, n) + orientar((0, 2, 3), Va, n)
        mi_c, mats_c = malla_bin('FN_Cortina' + lado, list(Va) * 2, [n] * 4 + [-n] * 4, U * 2, {mc: list(tri) + [t + 4 for t in orientar((0, 1, 2), Va, -n) + orientar((0, 2, 3), Va, -n)]})
        esc.append([nodo('FN_Cortina' + lado, (x0, 0, zf), m=mi_c, mt=mats_c)])
    FN['cortina'] = {'x': [round(float(lo[0]), 3), round(float(hi[0]), 3)], 'z': round(float(zf), 3)}
    print('cortina de Pirate Cove: x', np.round([lo[0], hi[0]], 2), 'y', np.round([lo[1], hi[1]], 2), 'z', round(zf, 2))

# ---------------- props ----------------
_mod, _geo = {}, {}
import hashlib, pyfqmr
from scipy.spatial import cKDTree
TRIS_MAX = 4000   # (los props muy detallados se simplifican: en la oscuridad no se nota y pesan diez veces menos)
def simplificar(V, N, U, T, meta):
    """baja los triángulos de un grupo (mismo material) y pasa normales y UV del vértice original más cercano"""
    usados = np.unique(T); inv = {int(k): i for i, k in enumerate(usados)}
    v0 = V[usados]; t0 = np.vectorize(inv.get)(T)
    s = pyfqmr.Simplify(); s.setMesh(v0.astype(np.float64), t0.astype(np.int32))
    s.simplify_mesh(target_count=max(40, meta), aggressiveness=7, preserve_border=False, max_iterations=400, verbose=0)
    v1, t1, _ = s.getMesh()
    _, cerca = cKDTree(v0).query(v1)
    n1 = N[usados][cerca]; u1 = U[usados][cerca]
    return v1, n1, u1, t1
def modelo_estatico(ruta, piel=0):
    """(malla, materiales de la piel, caja local mín/máx) de un .mdl (en su espacio, a metros) o None. La geometría se
    arma una vez por modelo (submallas por ranura de material) y se reusa entre pieles y entre modelos iguales"""
    k = (ruta.lower(), piel)
    if k in _mod: return _mod[k]
    base = ruta.lower().removesuffix('.mdl'); mdl = leer(base + '.mdl'); vvd = leer(base + '.vvd')
    vtx = next((x for x in (leer(base + e) for e in ('.dx90.vtx', '.vtx', '.dx80.vtx', '.sw.vtx')) if x), None)
    if not (mdl and vvd and vtx): _mod[k] = None; return None
    try: M = SM.Modelo(mdl, vvd, vtx); Vx = M.vertices
    except Exception as e: print('  modelo ilegible', ruta, e); _mod[k] = None; return None
    pie = M.pieles[piel] if piel < len(M.pieles) else M.pieles[0]
    V = (MS @ Vx['pos'].T).T * S; N = (MS @ Vx['nor'].T).T; U = np.stack([Vx['uv'][:, 0], 1 - Vx['uv'][:, 1]], 1)
    grupos = {}
    for m in M.mallas:
        if m['modelo'] != 0 or not len(m['tris']): continue   # (de cada grupo de cuerpos, el primero)
        grupos.setdefault(m['mat'], []).append(m['tris'])
    if not grupos: _mod[k] = None; return None
    ranuras = sorted(grupos)
    clave = hashlib.md5(V.tobytes() + b''.join(np.concatenate(grupos[r]).tobytes() for r in ranuras)).hexdigest()
    if clave not in _geo:
        total = sum(len(np.concatenate(g)) for g in grupos.values())
        VV, NN, UU, por = [], [], [], {}
        for r in ranuras:
            T = np.concatenate(grupos[r])
            if total > TRIS_MAX: v1, n1, u1, t1 = simplificar(V, N, U, T, int(len(T) * TRIS_MAX / total))
            else:
                us = np.unique(T); inv = {int(x): i for i, x in enumerate(us)}; v1, n1, u1, t1 = V[us], N[us], U[us], np.vectorize(inv.get)(T)
            b0 = len(VV); VV.extend(v1); NN.extend(n1); UU.extend(u1); Va = np.array(VV)
            por[r] = [x for t in t1 for x in orientar((b0 + int(t[0]), b0 + int(t[1]), b0 + int(t[2])), Va, NN[b0 + int(t[0])] + NN[b0 + int(t[1])] + NN[b0 + int(t[2])])]
            # (lo que brilla, como la lamparita de la oficina y las pantallas: de los dos lados; algunas venían con las normales para adentro)
            if M.texturas[M.pieles[0][r] if r < len(M.pieles[0]) else r].lower() in ('on', 'screen'): por[r] = por[r] + [x for i in range(0, len(por[r]), 3) for x in (por[r][i], por[r][i + 2], por[r][i + 1])]
        Va = np.array(VV); mi, _ = malla_bin('FN_' + os.path.basename(base), Va, NN, UU, por)
        _geo[clave] = (mi, ranuras, (Va.min(0), Va.max(0)))
    mi, ranuras, caja = _geo[clave]
    mats = []
    for r in ranuras:
        ti = pie[r] if r < len(pie) else r; tn = M.texturas[ti].lower().replace('\\', '/'); m_ = None
        for cd in M.carpetas:
            m_ = material_de('materials/' + cd.lower().replace('\\', '/').strip('/') + '/' + tn + '.vmt', 512)
            if m_ is not None: break
        if m_ is None: m_ = material_vecino(M.carpetas, tn)
        if m_ is None: SIN_TEX.setdefault(os.path.basename(base), set()).add(tn + ' en ' + ','.join(M.carpetas))
        mats.append(m_ if m_ is not None else mat_color(tn + ' ' + base))   # (texturas que no vinieron con el mapa: un color parecido, sin peso)
    _mod[k] = (mi, mats, caja); return _mod[k]
props = [nodo('FN_Props')]; faltan = {}; camaras = []; SIN_TEX = {}
def material_vecino(carpetas, tn):
    """un material que el modelo pide y no está en su carpeta, buscado cerca en el pak (como lo dejó el mapa): la textura
    suelta en esa carpeta (tal cual o con 'color' al final), el mismo .vmt en una carpeta hermana o la textura en la de
    arriba (las cabezas del cuarto de atrás venían blancas por esto)"""
    for cd in carpetas:
        c = cd.lower().replace('\\', '/').strip('/')
        if not c: continue
        for v in (c + '/' + tn, c + '/' + tn + 'color'):
            tx = textura('materials/' + v + '.vtf', v, 512)
            if tx: return mat_nuevo(tn, tx[0], 'op')
        padre = c.rsplit('/', 1)[0]
        for n in sorted(PAKN):
            if n.startswith('materials/' + padre + '/') and n.endswith('/' + tn + '.vmt'):
                m_ = material_de(n, 512)
                if m_ is not None: return m_
        tx = textura('materials/' + padre + '/' + tn + '.vtf', padre + '/' + tn, 512)
        if tx: return mat_nuevo(tn, tx[0], 'op')
    return None
# ---------------- muebles de Half-Life 2 que el mapa usa y GMod trae (acá no están): hechos con cajas ----------------
# Sin ellos lo que tenían arriba flotaba (la compu y el teléfono del cuarto de atrás, el microondas de la cocina). Cada uno
# se para en el piso que tiene abajo y mide lo que pide lo que va encima (la mesada, 1 m; el escritorio, 0,77 m).
# Ejes de la pieza (como los modelos ya pasados al juego): x de costado, y para arriba, z para adelante; el origen en el piso.
def piso_bajo(p, arriba=0.7):
    T = TRIS['FN_Pizzeria']; a, b, c = T[:, 0], T[:, 1], T[:, 2]
    v0, v1 = (b - a)[:, [0, 2]], (c - a)[:, [0, 2]]; den = v0[:, 0] * v1[:, 1] - v1[:, 0] * v0[:, 1]; ok = np.abs(den) > 1e-12; den = np.where(ok, den, 1)
    px, pz = p[0] - a[:, 0], p[2] - a[:, 2]; u = (px * v1[:, 1] - v1[:, 0] * pz) / den; v = (v0[:, 0] * pz - px * v0[:, 1]) / den
    y = a[:, 1] + u * (b - a)[:, 1] + v * (c - a)[:, 1]; dentro = ok & (u >= -1e-4) & (v >= -1e-4) & (u + v <= 1 + 1e-4) & (y < p[1] + arriba)
    return float(y[dentro].max()) if dentro.any() else float(p[1])
def tex_ruido(nombre, rgb, var=26, rayas=False):
    n = 128; a = ruido(n, 1.1, sum(nombre.encode()) % 97)
    if rayas: a = 0.5 * a + 0.5 * np.repeat(ruido(n, 1.3, 7).mean(1, keepdims=True), n, 1)
    img = np.stack([rgb[i] + var * (a - 0.5) for i in range(3)], -1)
    return tex_imagen(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), nombre)
_mueble_mat = {}
def mat_mueble(k):
    if k not in _mueble_mat:
        rgb, var, ray = {'acero': ((168, 172, 176), 34, True), 'negro': ((30, 31, 34), 10, False), 'madera': ((92, 62, 40), 22, True), 'porcelana': ((196, 198, 196), 10, False),
                         'oscuro': ((52, 54, 58), 12, False), 'luz': ((255, 236, 190), 6, False)}[k]
        _mueble_mat[k] = mat_nuevo('mueble_' + k, tex_ruido('mueble_' + k, rgb, var, ray), 'unlit' if k == 'luz' else 'op')
    return _mueble_mat[k]
def malla_cajas(nombre, cajas):
    """cajas: (material, (x0, y0, z0), (x1, y1, z1)) → malla con caras por material (UV en metros)"""
    V, N, U, por = [], [], [], {}
    for k, lo, hi in cajas:
        mi = mat_mueble(k); lo, hi = np.array(lo, float), np.array(hi, float)
        for ax in range(3):
            for sg in (-1, 1):
                n = np.zeros(3); n[ax] = sg; u_, v_ = [i for i in range(3) if i != ax]
                c = [None] * 4
                for j, (a_, b_) in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
                    q = np.where(n > 0, hi, lo).copy(); q[u_] = (lo, hi)[a_][u_]; q[v_] = (lo, hi)[b_][v_]; c[j] = q
                base = len(V)
                for q in c: V.append(q); N.append(n); U.append((q[u_], q[v_]))
                Va = np.array(V); por.setdefault(mi, []).extend(orientar((base, base + 1, base + 2), Va, n) + orientar((base, base + 2, base + 3), Va, n))
    mi, mats = malla_bin('FN_mueble_' + nombre, V, N, U, por)
    Va = np.array(V); return mi, mats, (Va.min(0), Va.max(0))
def _cuerpo(an, al, pr, k='acero'): return [(k, (-an / 2, 0, -pr / 2), (an / 2, al, pr / 2))]
MUEBLES = {
    'props_wasteland/kitchen_counter001d': lambda: _cuerpo(3.0, 0.93, 0.76) + [('acero', (-1.5, 0.93, -0.4), (1.5, 1.0, 0.4))],
    'props_wasteland/kitchen_stove001a': lambda: _cuerpo(1.2, 0.9, 0.76) + [('negro', (-0.6, 0.9, -0.38), (0.6, 0.95, 0.38)), ('acero', (-0.45, 0.72, 0.38), (0.45, 0.75, 0.42)), ('negro', (-0.5, 0.15, 0.38), (0.5, 0.62, 0.385))],
    'props_wasteland/kitchen_stove002a': lambda: _cuerpo(0.9, 0.9, 0.76) + [('negro', (-0.45, 0.9, -0.38), (0.45, 0.95, 0.38)), ('acero', (-0.3, 0.72, 0.38), (0.3, 0.75, 0.42))],
    'props_wasteland/kitchen_fridge001a': lambda: _cuerpo(1.25, 2.0, 0.76) + [('oscuro', (-0.006, 0.05, 0.38), (0.006, 1.95, 0.385)), ('acero', (-0.12, 0.9, 0.38), (-0.09, 1.5, 0.43)), ('acero', (0.09, 0.9, 0.38), (0.12, 1.5, 0.43))],
    'props_wasteland/kitchen_shelf001a': lambda: [('acero', (sx * 0.75 - 0.015, 0, sz * 0.25 - 0.015), (sx * 0.75 + 0.015, 1.9, sz * 0.25 + 0.015)) for sx in (-1, 1) for sz in (-1, 1)] + [('acero', (-0.75, y, -0.25), (0.75, y + 0.02, 0.25)) for y in (0.15, 0.7, 1.25, 1.8)],
    'props_wasteland/prison_toilet01': lambda: [('acero', (-0.19, 0, -0.22), (0.19, 0.4, 0.22)), ('acero', (-0.22, 0.3, -0.32), (0.22, 0.75, -0.2)), ('negro', (-0.15, 0.4, -0.15), (0.15, 0.405, 0.18))],
    'props_combine/breendesk': lambda: [('madera', (-1.15, 0.73, -0.6), (1.15, 0.77, 0.6)), ('madera', (-1.15, 0, -0.58), (-1.1, 0.73, 0.58)), ('madera', (1.1, 0, -0.58), (1.15, 0.73, 0.58)), ('madera', (-1.1, 0.2, 0.52), (1.1, 0.73, 0.56))],
    'nova/chair_office01': lambda: [('negro', (-0.25, 0.45, -0.25), (0.25, 0.52, 0.25)), ('negro', (-0.23, 0.55, -0.29), (0.23, 1.05, -0.23)), ('oscuro', (-0.03, 0.08, -0.03), (0.03, 0.45, 0.03)), ('oscuro', (-0.3, 0.02, -0.3), (0.3, 0.08, 0.3))],
    # luces (colgadas o en la pared: van donde las puso el mapa, con su giro; el origen es el del modelo)
    'props_wasteland/light_spotlight01_lamp': lambda: [('oscuro', (-0.13, -0.13, -0.2), (0.13, 0.13, 0.16)), ('luz', (-0.1, -0.1, 0.16), (0.1, 0.1, 0.17))],
    'props_wasteland/light_spotlight01_base': lambda: [('oscuro', (-0.04, -0.2, -0.04), (0.04, 0.05, 0.04)), ('oscuro', (-0.16, -0.24, -0.04), (0.16, -0.2, 0.04))],
    'props_lab/walllight001a': lambda: [('oscuro', (-0.16, -0.06, -0.02), (0.16, 0.06, 0.08)), ('luz', (-0.13, -0.04, 0.08), (0.13, 0.04, 0.09))],
    'props_c17/light_domelight02_off': lambda: [('porcelana', (-0.2, -0.12, -0.2), (0.2, 0.0, 0.2)), ('oscuro', (-0.23, 0.0, -0.23), (0.23, 0.02, 0.23))],
}
COLGADOS = ('light_spotlight01', 'walllight', 'domelight')
_muebles = {}
def poner_mueble(clave, origen, ang, nombre):
    if clave not in _muebles: _muebles[clave] = malla_cajas(clave.split('/')[-1], MUEBLES[clave]())
    mi, mats, (lo, hi) = _muebles[clave]; pe = P(origen); colgado = any(c in clave for c in COLGADOS)
    if not colgado: pe[1] = piso_bajo(pe)
    x = nodo(nombre or clave.split('/')[-1], pe, SM.m2q(R(ang_mat(*ang) if colgado else ang_mat(0, ang[1], 0))), pa=0, m=mi, mt=mats)
    if 'chair' not in clave and not colgado: x['col'] = [{'k': 'b', 'c': ((lo + hi) / 2).tolist(), 's': (hi - lo).tolist(), 'tr': 0}]
    props.append(x)
def poner_prop(ruta, origen, ang, esc_=1.0, piel=0, solido=True, nombre=None):
    clave = ruta.lower().removeprefix('models/').removesuffix('.mdl')
    if clave in MUEBLES and leer(ruta) is None: poner_mueble(clave, origen, ang, nombre); return
    r = modelo_estatico(ruta, piel)
    if r is None: faltan[ruta] = faltan.get(ruta, 0) + 1; return
    mi, mats, (lo, hi) = r
    Rm, pe = R(ang_mat(*ang)), P(origen)
    if 'doorhandle' in ruta and BISAGRAS:   # (la manija va con su puerta, que se dibuja abierta)
        b = min(BISAGRAS, key=lambda h: np.hypot(*(h - pe)[[0, 2]]))
        if np.hypot(*(b - pe)[[0, 2]]) < 2.2: G = R(ang_mat(0, 90, 0)); pe = b + G @ (pe - b); Rm = G @ Rm
    if 'arcade' in ruta:   # (los arcades del comedor venían 20 cm en el aire)
        esq = np.array([[a, b_, c] for a in (lo[0], hi[0]) for b_ in (lo[1], hi[1]) for c in (lo[2], hi[2])]) * esc_
        Wq = (Rm @ esq.T).T + pe; fondo = Wq[:, 1].min(); cen = Wq.mean(0); gap = fondo - piso_bajo(np.array([cen[0], fondo, cen[2]]), 0.05)
        if 0.03 < gap < 0.35: pe = pe - np.array([0, gap, 0])
    q = SM.m2q(Rm); x = nodo(nombre or os.path.basename(ruta)[:-4], pe, q, (esc_, esc_, esc_), pa=0, m=mi, mt=mats)
    t = hi - lo
    if solido and max(t) > 0.25 and t[1] > 0.12: x['col'] = [{'k': 'b', 'c': ((lo + hi) / 2).tolist(), 's': t.tolist(), 'tr': 0}]
    props.append(x)
for sp in bsp.props:
    m = sp.model.lower(); ang = (sp.angles.pitch, sp.angles.yaw, sp.angles.roll)
    if 'keithy/props/camera' in m:   # (la cámara mira para adelante de su modelo, un poco para abajo)
        f = MS @ ang_mat(*ang)[:, 0]; camaras.append({'p': [round(x, 3) for x in (P([sp.origin.x, sp.origin.y, sp.origin.z]) + f * 0.25 + np.array([0, -0.12, 0])).tolist()], 'f': [round(x, 4) for x in f.tolist()]})
    ee = sp.scaling; ee = float(ee.x) if hasattr(ee, 'x') else float(ee or 1.0)
    poner_prop(m, [sp.origin.x, sp.origin.y, sp.origin.z], ang, ee or 1.0, sp.skin, int(sp.solidity) != 0)
NO_VAN = ('office tv',)   # (la tele de la oficina de FNAF 2: no está en la de FNAF 1)
CHICOS = ('partyhat', 'plush', 'pizza', 'cupcake', 'bottle', 'restroom_cup', 'cactus', 'phone', 'doll')
for e in ents:
    c = e['classname']
    if not c.startswith('prop_'): continue
    m = e['model'].lower(); a = vec(e['angles'])
    if any(x in m for x in NO_VAN): continue
    poner_prop(m, vec(e['origin']), a, float(e['modelscale'] or 1), int(e['skin'] or 0), not any(s in m for s in CHICOS), e['targetname'] or None)
esc.append(props)

# ---------------- por dónde caminan los animatrónicos ----------------
# Grilla de 20 cm sobre el piso del mapa: altura del piso en cada celda (de los triángulos que miran para arriba),
# bloqueada donde hay paredes o muebles a la altura del cuerpo (con 35 cm de margen). Entre las salas de FNAF 1 (cada
# una con el lugar donde se para cada animatrónico) los caminos salen con A* y se estiran en línea recta donde se puede.
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
        elif abs(ny) < 0.7 and t[:, 1].max() > 1.2 and t[:, 1].min() < 2.3:   # pared a la altura del cuerpo (lo más bajo, como el borde del escenario, es un escalón)
            for s in np.linspace(0, 1, 12):
                for r in np.linspace(0, 1 - s, max(2, int(12 * (1 - s)))):
                    p = t[0] + (t[1] - t[0]) * s + (t[2] - t[0]) * r
                    if 0.6 < p[1] < 2.4: B[min(nz - 1, int((p[2] - z0) / CEL)), min(nx - 1, int((p[0] - x0) / CEL))] = True
            for k in range(3):   # (y los bordes, finos)
                a, b = t[k], t[(k + 1) % 3]
                for s in np.linspace(0, 1, max(2, int(np.linalg.norm(b - a) / 0.08))):
                    p = a + (b - a) * s
                    if 0.6 < p[1] < 2.4: B[min(nz - 1, int((p[2] - z0) / CEL)), min(nx - 1, int((p[0] - x0) / CEL))] = True
    for (p, R3, c, e) in cajas:   # muebles: su planta
        es = [p + R3 @ (c + e * np.array(s)) for s in ((1, 1, 1), (-1, 1, 1), (1, 1, -1), (-1, 1, -1))]
        lo, hi = np.min(es, 0), np.max(es, 0)
        for xx in np.arange(lo[0], hi[0] + 0.1, 0.1):
            for zz in np.arange(lo[2], hi[2] + 0.1, 0.1):
                l = R3.T @ (np.array([xx, p[1] + (R3 @ c)[1], zz]) - p) - c
                if abs(l[0]) <= e[0] and abs(l[2]) <= e[2]: B[min(nz - 1, max(0, int((zz - z0) / CEL))), min(nx - 1, max(0, int((xx - x0) / CEL)))] = True
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
cajas = []
for x in props[1:]:
    if 'col' in x and x['col'][0]['k'] == 'b':
        c = x['col'][0]; s = np.array(x['s']); cajas.append((np.array(x['p']), SM.q2m(np.array(x['r'])), np.array(c['c']) * s, np.array(c['s']) * s / 2))
G = nav_grilla(TRIS['FN_Pizzeria'], cajas)
# las salas de FNAF 1 (con su cámara) y dónde se para cada uno (F Freddy, B Bonnie, C Chica, X Foxy)
SALAS = {'escenario': {'F': (9.6, 0.2), 'B': (9.4, -1.8), 'C': (9.4, 2.2)}, 'comedor': {'F': (-3.2, 1.0), 'B': (1.75, -5.0), 'C': (1.75, 6.6)},
         'pirata': {'X': (-0.3, -11.2)}, 'atras': {'B': (6.2, -13.0)}, 'oeste': {'B': (-12.0, -3.1), 'X': (-12.0, -3.4)}, 'armario': {'B': (-11.4, -7.6)},
         'esqO': {'B': (-22.4, -3.3), 'X': (-22.0, -3.3)}, 'este': {'F': (-11.0, 3.4), 'C': (-13.0, 3.4)}, 'esqE': {'F': (-21.8, 3.5), 'C': (-22.6, 3.4)},
         'cocina': {'F': (-11.0, 11.5), 'C': (-9.8, 14.5)}, 'banos': {'F': (0.8, 12.0), 'C': (3.0, 11.8)},
         'oficina': {'F': (-22.6, 0.9), 'B': (-22.6, -1.0), 'C': (-22.6, 0.9), 'X': (-22.6, -1.0)}}
GRAFO = {'F': [('escenario', 'comedor'), ('comedor', 'banos'), ('banos', 'cocina'), ('cocina', 'este'), ('este', 'esqE'), ('esqE', 'oficina'), ('esqE', 'este'), ('este', 'comedor')],
         'B': [('escenario', 'comedor'), ('escenario', 'atras'), ('comedor', 'atras'), ('comedor', 'oeste'), ('atras', 'oeste'), ('oeste', 'armario'), ('oeste', 'esqO'), ('armario', 'esqO'), ('esqO', 'oficina'), ('esqO', 'oeste'), ('esqO', 'comedor')],
         'C': [('escenario', 'comedor'), ('comedor', 'banos'), ('comedor', 'cocina'), ('banos', 'cocina'), ('banos', 'este'), ('cocina', 'este'), ('este', 'esqE'), ('esqE', 'oficina'), ('esqE', 'este'), ('este', 'comedor')],
         'X': [('pirata', 'oeste'), ('oeste', 'esqO'), ('esqO', 'oficina')]}
salas, caminos, malos = {}, {}, []
for sala, sp in SALAS.items():
    salas[sala] = {}
    for k, (x, z) in sp.items():
        c = nav_celda(G, x, z); assert c, (sala, k)
        salas[sala][k] = [round(G['x0'] + (c[1] + 0.5) * G['cel'], 3), round(float(G['H'][c]), 3), round(G['z0'] + (c[0] + 0.5) * G['cel'], 3)]
for k, aristas in GRAFO.items():
    for a, b in aristas:
        for u, v in ((a, b), (b, a)):
            ca, cb = nav_celda(G, salas[u][k][0], salas[u][k][2]), nav_celda(G, salas[v][k][0], salas[v][k][2])
            cm = nav_camino(G, ca, cb)
            if not cm: malos.append((k, u, v)); continue
            caminos[k + ':' + u + '>' + v] = [[round(G['x0'] + (j_i[1] + 0.5) * G['cel'], 2), round(float(G['H'][j_i]), 2), round(G['z0'] + (j_i[0] + 0.5) * G['cel'], 2)] for j_i in cm]
np.save('/tmp/claude-0/pz/nav_libre.npy', G['libre']); np.save('/tmp/claude-0/pz/nav_H.npy', G['H']); json.dump({k: G[k] for k in ('x0', 'z0', 'cel', 'nx', 'nz')}, open('/tmp/claude-0/pz/nav.json', 'w')); json.dump(caminos, open('/tmp/claude-0/pz/nav_caminos.json', 'w'))
assert not malos, ('sin camino', malos)
FN.update(salas=salas, caminos=caminos)

# ---------------- plano de las cámaras: el mapa visto de arriba, como en FNAF (el escenario arriba, la oficina abajo) ----------------
# en la pantalla x = z del juego (la puerta izquierda a la izquierda) e y = -x; el piso en gris y las paredes cortadas a 1,3 m
MAPA = {'x0': -28.0, 'x1': 16.7, 'z0': -19.5, 'z1': 21.5}   # (lo de FNAF; las alas que agregó el mapa quedan afuera)
def plano(tris, G, W=440, Hh=480, k=3):
    from PIL import ImageDraw
    X = lambda z: (z - MAPA['z0']) / (MAPA['z1'] - MAPA['z0']) * W * k
    Y = lambda x: (MAPA['x1'] - x) / (MAPA['x1'] - MAPA['x0']) * Hh * k
    piso = Image.new('L', (W * k, Hh * k), 0); dp = ImageDraw.Draw(piso)
    for j, i in zip(*np.nonzero(G['H'] > -50)):
        x = G['x0'] + i * G['cel']; z = G['z0'] + j * G['cel']
        dp.rectangle([X(z), Y(x + G['cel']), X(z + G['cel']), Y(x)], fill=255)
    par = Image.new('L', (W * k, Hh * k), 0); dw = ImageDraw.Draw(par); Y0 = 1.3
    for t in tris:
        ys = t[:, 1]
        if ys.min() >= Y0 or ys.max() <= Y0: continue
        pts = [(X(p[2]), Y(p[0])) for p in (t[a] + (t[b] - t[a]) * (Y0 - ys[a]) / (ys[b] - ys[a]) for a, b in ((0, 1), (1, 2), (2, 0)) if (ys[a] - Y0) * (ys[b] - Y0) < 0)]
        if len(pts) == 2: dw.line(pts, fill=255, width=int(1.6 * k))
    f = np.asarray(piso.resize((W, Hh), Image.LANCZOS), float)[..., None] / 255; w = np.asarray(par.resize((W, Hh), Image.LANCZOS), float)[..., None] / 255
    rgb = w * np.array([226, 228, 232]) + (1 - w) * np.array([58, 62, 70]); al = np.maximum(f * 0.55, w)
    return Image.fromarray(np.clip(np.concatenate([rgb, al * 255], 2), 0, 255).astype(np.uint8), 'RGBA')
plano(TRIS['FN_Pizzeria'], G).save(PK1 + '/i/fn_mapa.webp', 'WEBP', quality=88, method=6)
d['ico']['fn_mapa'] = 'fn_mapa'; FN['mapa'] = MAPA
print('grilla', G['nx'], 'x', G['nz'], 'libres', int(G['libre'].sum()), '· caminos', len(caminos), '· largo medio', round(np.mean([sum(np.hypot(c[i + 1][0] - c[i][0], c[i + 1][2] - c[i][2]) for i in range(len(c) - 1)) for c in caminos.values()]), 1), 'm')
np.save('/tmp/claude-0/pz/nav_libre.npy', G['libre']); np.save('/tmp/claude-0/pz/nav_H.npy', G['H']); json.dump({k: G[k] for k in ('x0', 'z0', 'cel', 'nx', 'nz')}, open('/tmp/claude-0/pz/nav.json', 'w'))
print('props', len(props) - 1, 'modelos', len([v for v in _mod.values() if v]), 'geometrías', len(_geo), 'faltan', faltan)
print('texturas de props que no vinieron:', {k: sorted(v) for k, v in SIN_TEX.items()})

# ---------------- luces, cámaras, aparición ----------------
luces = []
for e in ents:
    c = e['classname']
    if c not in ('light', 'light_spot', 'point_spotlight'): continue
    o = P(vec(e['origin'])); col = vec(e['_light'])[:4] if e['_light'] else [255, 255, 255, 200]
    if c == 'point_spotlight': col = vec(e['rendercolor']) + [400] if e['rendercolor'] else [255, 255, 255, 400]
    k = (col[3] if len(col) > 3 else 200) / 200
    L = {'p': [round(x, 3) for x in o.tolist()], 'c': [round(col[0] / 255, 3), round(col[1] / 255, 3), round(col[2] / 255, 3)], 'r': round(3.5 + 4 * min(1.5, k), 2), 'n': e['targetname'] or ''}
    if c != 'light':
        a = vec(e['angles']); pitch = -float(e['pitch']) if e['pitch'] else a[0]
        f = ang_mat(pitch, a[1], 0)[:, 0]; L['d'] = [round(x, 4) for x in (MS @ f).tolist()]
        L['cono'] = round(math.cos(math.radians(float(e['_cone'] or e['spotlightwidth'] or 45) * (1 if c == 'light_spot' else 0.5) + 10)), 3)
    luces.append(L)
apar = [nodo('RB_Aparicion')]
for k, e in enumerate(x for x in ents if x['classname'] in ('info_player_start', 'info_player_terrorist')):
    apar.append(nodo('SpawnPoint%s' % ('' if k == 0 else ' (%d)' % k), P(vec(e['origin'])) + np.array([0, 0.05, 0]), pa=0))
esc.append(apar)
# una luz del "sol" casi apagada (adentro es de noche) y bordes
esc.append([nodo('Directional Light', (0, 3, 0), (0.7071, 0, 0, 0.7071), lz={'t': 1, 'c': [0.55, 0.6, 0.8], 'i': 0.06, 'rg': 10.0, 'sa': 30.0})])
d['esc']['RB_Pizzeria'] = esc
a = json.loads(json.dumps(d['aj']['RB_Luna'])); a.update(fog=1, fm=3, fc=[0.0, 0.0, 0.0], fs=14.0, fe=46.0, fd=0, ai=0.5, grav=1.0, ambRB=[[0.045, 0.045, 0.06], [0.03, 0.03, 0.04]])
a.update(espacio=1, sinSombra=1); d['aj']['RB_Pizzeria'] = a   # (adentro: cielo negro, sin nubes ni ciclo del día ni sombras del sol)
FN.update(luces=luces, camaras=camaras, puertas=puertas, botones=botones)
print('luces', len(luces), 'cámaras', len(camaras), 'puertas', list(puertas), 'botones', len(botones))

# ---------------- animatrónicos ----------------
CL = 'models/cl3nr/hw/'
ANIMA = [('Freddy', 'freddy/cl3nrbearpill', 2.15, {'quieto': 'idle', 'camina': 'walk', 'susto': 'jumpscare'}),
         ('Bonnie', 'bonnie/cl3nrbonpill', 2.3, {'quieto': 'idle', 'camina': 'walk', 'susto': 'jumpscare', 'mira': 'lookat'}),
         ('Chica', 'chica/cl3nrchickenpill', 2.1, {'quieto': 'idle', 'camina': 'walk', 'susto': 'jumpscare', 'mira': 'lookat'}),
         ('Foxy', 'foxy/cl3nrfoxpill', 2.2, {'quieto': 'idle', 'corre': 'run', 'susto': 'jumpscare'})]
ANIM_K = 0.5   # (los animatrónicos con la mitad de los triángulos: por piezas y sin tocar los bordes, así las costuras de la textura quedan iguales)
def simplificar_piel(V, N, U, piel, porMat, k):
    VV, NN, UU, PP, out = [], [], [], [], {}
    for mi, idx in porMat.items():
        T = np.array(idx).reshape(-1, 3); padre = {}
        def raiz(x):
            while padre.setdefault(x, x) != x: padre[x] = padre[padre[x]]; x = padre[x]
            return x
        for a, b, c in T:
            ra = raiz(int(a)); padre[raiz(int(b))] = ra; padre[raiz(int(c))] = ra
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
    # pose "quieto" (cuadro 0) para medir el alto de verdad
    sq = {s['n']: s for s in M.secuencias}
    P0, Q0, _ = M.pose(sq['idle']['anim'], 0); W0 = M.mundo(P0, Q0)
    B2M = [np.linalg.inv(np.vstack([h['p2b'], [0, 0, 0, 1]])) for h in H]
    sk = [W0[k] @ np.linalg.inv(B2M[k]) for k in range(nb)]
    w, hb = Vx['w'], Vx['hb']; pos = Vx['pos']; ph = np.c_[pos, np.ones(len(pos))]
    Vq = np.zeros((len(pos), 3))
    for c in range(3):
        for k in np.unique(hb[:, c]): sel = hb[:, c] == k; Vq[sel] += w[sel, c][:, None] * (ph[sel] @ sk[k].T)[:, :3]
    alto = (Vq[:, 2].max() - Vq[:, 2].min()) * S; kk = ALTO / alto; sc = S * kk; piso = Vq[:, 2].min()
    # huesos con peso: a lo sumo 56 (los de los dedos, párpados y rodilleras se juntan con su padre si hace falta)
    peso = np.zeros(nb)
    for c in range(3): np.add.at(peso, hb[:, c], w[:, c])
    usa = {k for k in range(nb) if peso[k] > 1e-4}; dest = list(range(nb))
    orden = sorted(usa, key=lambda k: (0 if any(s in H[k]['n'] for s in ('B_jnt', 'C_jnt', 'Lid', 'KneePad', 'ToesB', 'Brow', 'Jiggle')) else 1, peso[k]))
    while len(usa) > 56:
        k = orden.pop(0); p = H[k]['pa']
        while p >= 0 and p not in usa: p = H[p]['pa']
        usa.discard(k)
        for j in range(nb):
            if dest[j] == k: dest[j] = p if p >= 0 else 0
    usados = sorted(usa); col = {k: i for i, k in enumerate(usados)}
    # nodos: raíz + huesos (todos, para animar) + la malla
    C = np.diag([sc, sc, sc]); Ce = np.eye(4); Ce[:3, :3] = MS * sc; Ci = np.linalg.inv(Ce)
    arb = [nodo('FN_' + NOM)]
    for k, h in enumerate(H):
        Xe = Ce @ T4(SM.q2m(h['q']), h['pos']) @ Ci
        if h['pa'] < 0: Xe[:3, 3] += np.array([0, -piso * sc, 0])   # (los pies en el piso)
        arb.append(nodo(h['n'], Xe[:3, 3], SM.m2q(Xe[:3, :3]), pa=h['pa'] + 1 if h['pa'] >= 0 else 0))
    # malla con piel en el espacio del modelo (a metros, pies en 0)
    V = (MS @ pos.T).T * sc + np.array([0, -piso * sc, 0]); N = (MS @ Vx['nor'].T).T; U = np.stack([Vx['uv'][:, 0], 1 - Vx['uv'][:, 1]], 1)
    J = np.zeros((len(V), 4), np.int64); Wt = np.zeros((len(V), 4))
    for c in range(3):
        J[:, c] = [col.get(dest[x], 0) for x in hb[:, c]]; Wt[:, c] = w[:, c] * np.array([dest[x] in col for x in hb[:, c]])
    # (dos influencias del mismo hueso después de juntar: se suman)
    for a_ in range(3):
        for b_ in range(a_ + 1, 3):
            igual = (J[:, a_] == J[:, b_]) & (Wt[:, b_] > 0); Wt[igual, a_] += Wt[igual, b_]; Wt[igual, b_] = 0
    Wt /= np.maximum(Wt.sum(1, keepdims=True), 1e-9)
    wb = np.floor(Wt * 255).astype(np.int32); wb[:, 0] += 255 - wb.sum(1)
    piel = np.zeros((len(V), 8), np.uint8); piel[:, :4] = J; piel[:, 4:] = wb
    Tp = np.eye(4); Tp[:3, 3] = [0, -piso * sc, 0]
    bp = []
    for k in usados:
        Be = Tp @ Ce @ B2M[k] @ Ci   # dónde está el hueso en la pose de enlace (en el juego)
        bp.append([float(x) for x in np.linalg.inv(Be).reshape(16)])
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
    # animaciones: cada cuadro, pos y giro locales de cada hueso (en float16), con la raíz sin avance (el juego la mueve)
    for clip, seq in CLIPS.items():
        s = sq[seq]; A = M.anims[s['anim']]; nf = A['nf']; data = np.zeros((nf, nb, 7))
        for f in range(nf):
            Pf, Qf, ok = M.pose(s['anim'], f)
            for k, h in enumerate(H):
                Xe = Ce @ T4(SM.q2m(Qf[k]), Pf[k]) @ Ci
                if h['pa'] < 0: Xe[:3, 3] += np.array([0, -piso * sc, 0])
                q = SM.m2q(Xe[:3, :3]); data[f, k, :3] = Xe[:3, 3]; data[f, k, 3:] = q / np.linalg.norm(q)
        # (cuaterniones del mismo lado de un cuadro al otro)
        for f in range(1, nf):
            neg = (data[f, :, 3:] * data[f - 1, :, 3:]).sum(1) < 0; data[f, neg, 3:] *= -1
        if clip in ('camina', 'corre'):   # sin avance de la raíz ni de la cadera (en el plano)
            for k in (0, 1):
                tr = data[:, k, [0, 2]]; lin = np.linspace(0, 1, nf)[:, None] * (tr[-1] - tr[0]); data[:, k, [0, 2]] = tr - lin
        o = agregar(data.astype('<f2').tobytes())
        FN['clips'][NOM + ':' + clip] = {'o': o, 'nf': nf, 'nb': nb, 'fps': A['fps'], 'loop': clip in ('quieto', 'camina', 'corre')}
    print(NOM, 'huesos', nb, 'con peso', len(usados), 'verts', nv0, '→', len(V), 'alto', round(ALTO, 2), 'escala', round(kk, 4), 'clips', [c for c in CLIPS])

open(PK1 + '/m.bin.gz', 'wb').write(gzip.compress(bytes(BIN), 9))
open(PK1 + '/d.json.gz', 'wb').write(gzip.compress(json.dumps(d, separators=(',', ':')).encode(), 6))
print('listo: texturas', len(d['tx']), 'mallas', len(d['ms']), 'materiales', len(d['mt']), 'bin', len(BIN) // 1000, 'KB')
