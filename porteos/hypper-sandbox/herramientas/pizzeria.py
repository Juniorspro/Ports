# La pizzería de FNAF 1 y sus animatrónicos para la noche de terror (juego/noche.js), sumados a un paquete del juego:
# - el mapa "FNaF 1 Custom map by Fedy!" de Garry's Mod (BSP): las caras del mundo con sus texturas, los props (estáticos
#   y de entidades) con sus modelos, las puertas y los botones de la oficina, las luces, las cámaras de seguridad y los
#   puntos de aparición. Pasa de Source (Z arriba, pulgadas) al juego (Y arriba, metros) con (x, y, z) → (y, z, x).
# - Freddy, Bonnie, Chica y Foxy del "FNAF Help Wanted NEXTBOT Pack" (cl3nr): mallas con piel (los huesos del .mdl,
#   a lo sumo 56 con peso), texturas y animaciones (quieto, caminar o correr, susto, mirar) muestreadas cuadro a cuadro.
# Lo extraído no va al repo: este script lo lee de afuera. Créditos en CREDITOS.md.
# Uso: python-con-srctools -I pizzeria.py PAQUETE_ORIGEN PAQUETE_NUEVO MAPA.bsp CARPETA_PACK_HW
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
def leer(ruta):
    r = ruta.lower().replace('\\', '/')
    if r in PAKN: return PAK.read(PAKN[r])
    f = os.path.join(HW, r)
    return open(f, 'rb').read() if os.path.exists(f) else None

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
def mat_color(nombre):
    c = next((col for k, col in COLORES if k in nombre.lower()), (128, 128, 128))
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
    _mats[k] = mat_nuevo(nombre.split('/')[-1], ti, modo); return _mats[k]

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
def caras_a_malla(caras, origen, nombre, colision=True):
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
        ne = MS @ nsrc; tw, th = ti.tex_size; tw, th = tw or 512, th or 512
        so, to = np.array([ti.s_off.x, ti.s_off.y, ti.s_off.z]), np.array([ti.t_off.x, ti.t_off.y, ti.t_off.z])
        uv = np.array([[(v @ so + ti.s_shift) / tw, -(v @ to + ti.t_shift) / th] for v in vs]); uv -= np.floor(uv.min(0))
        base = len(V)
        for v, t in zip(vs, uv): V.append(P(v)); N.append(ne); U.append(t)
        Vn = np.array(V)
        for k in range(1, len(vs) - 1): porMat.setdefault(mi, []).extend(orientar((base, base + k, base + k + 1), Vn, ne))
    if not V: return None
    return malla_bin(nombre, V, N, U, porMat)

ents = list(bsp.ents.entities)
mundo_ent = next(e for e in bsp.bmodels if e['classname'] == 'worldspawn')
mi_mundo, mats_mundo = caras_a_malla(bsp.bmodels[mundo_ent].faces, np.zeros(3), 'FN_Pizzeria')
esc = []
esc.append([nodo('RB_Pizzeria', m=mi_mundo, mt=mats_mundo, rid=9930000, col=[{'k': 'm', 'm': mi_mundo, 'cv': 0, 'tr': 0}])])
# entidades de brocha: puertas de la oficina, botones, cortinas, puertas comunes (abiertas, sin choque)
puertas, botones, fijas = {}, [], [nodo('FN_Brochas')]
for e, bm in bsp.bmodels.items():
    c = e['classname']
    if c == 'worldspawn': continue
    o = np.array(vec(e['origin']))
    if c == 'func_door_rotating':   # bisagra en el origen: se dibuja abierta 90° (hacia donde no choca con la pared)
        r = caras_a_malla(bm.faces, np.zeros(3), 'FN_PuertaComun')
        if r: fijas.append(nodo('PuertaComun', P(o), SM.m2q(R(ang_mat(0, 90, 0))), pa=0, m=r[0], mt=r[1]))
        continue
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
        Va = np.array(VV); mi, _ = malla_bin('FN_' + os.path.basename(base), Va, NN, UU, por)
        _geo[clave] = (mi, ranuras, (Va.min(0), Va.max(0)))
    mi, ranuras, caja = _geo[clave]
    mats = []
    for r in ranuras:
        ti = pie[r] if r < len(pie) else r; tn = M.texturas[ti].lower().replace('\\', '/'); m_ = None
        for cd in M.carpetas:
            m_ = material_de('materials/' + cd.lower().replace('\\', '/').strip('/') + '/' + tn + '.vmt', 512)
            if m_ is not None: break
        mats.append(m_ if m_ is not None else mat_color(tn + ' ' + base))   # (texturas que no vinieron con el mapa: un color parecido, sin peso)
    _mod[k] = (mi, mats, caja); return _mod[k]
props = [nodo('FN_Props')]; faltan = {}; camaras = []
def poner_prop(ruta, origen, ang, esc_=1.0, piel=0, solido=True, nombre=None):
    r = modelo_estatico(ruta, piel)
    if r is None: faltan[ruta] = faltan.get(ruta, 0) + 1; return
    mi, mats, (lo, hi) = r
    q = SM.m2q(R(ang_mat(*ang))); x = nodo(nombre or os.path.basename(ruta)[:-4], P(origen), q, (esc_, esc_, esc_), pa=0, m=mi, mt=mats)
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
print('props', len(props) - 1, 'modelos', len([v for v in _mod.values() if v]), 'geometrías', len(_geo), 'faltan', faltan)

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
