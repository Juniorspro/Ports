# Props nuevos desde GLB con textura: la malla a su altura real (apoyada en el piso y centrada), su textura, un
# collider convexo hecho con la misma malla, su masa y su ícono; se agregan al paquete como un prefab más (se crean y
# viajan por la red como los del juego) y a una categoría del menú de props.
# Uso: python3 -I prop_glb.py PAQUETE Nombre:altura:masa:categoría:modelo.glb:foto.png[:opción...] [...]
# Opciones: col=esfera (pelotas), col=tronco (árboles: cajas en el tronco, se pasa entre las hojas), col=mesa (tabla y
# patas, se puede meter cosas abajo), col=pila (cajas apiladas por altura: postes con base plana), col=aro (base, palo y tablero, la pelota pasa por el aro); rs=0.8 (rebote);
# sal (cama elástica: el que la pisa rebota).
import sys, os, io, json, gzip, hashlib, numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glb
PK = sys.argv[1]
d = json.load(gzip.open(PK + '/d.json.gz')); BIN = bytearray(gzip.decompress(open(PK + '/m.bin.gz', 'rb').read()))
cone = d['pf'][next(k for k in d['pf'] if k.split('#')[0] == 'Cone')][0]
def agregar(b):
    while len(BIN) % 4: BIN.append(0)
    o = len(BIN); BIN.extend(b); return o
def textura(TEX, UV, IDX, lado):
    Wt, Ht = TEX.size; mask = Image.new('L', (Wt, Ht), 0); dr = ImageDraw.Draw(mask)
    px = np.stack([UV[:, 0] * Wt, UV[:, 1] * Ht], 1)
    for t in IDX: dr.polygon([tuple(px[t[0]]), tuple(px[t[1]]), tuple(px[t[2]])], fill=255)
    ta = np.asarray(TEX).astype(np.float32); mk = (np.asarray(mask) > 0).astype(np.float32)
    for _ in range(30):
        sm = np.zeros_like(ta); cn = np.zeros_like(mk)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            sm += np.roll(np.roll(ta * mk[..., None], dy, 0), dx, 1); cn += np.roll(np.roll(mk, dy, 0), dx, 1)
        fill = (mk == 0) & (cn > 0); ta[fill] = sm[fill] / cn[fill][:, None]; mk = np.maximum(mk, fill.astype(np.float32))
    ta[mk == 0] = ta[mk > 0].mean(0)
    return Image.fromarray(np.clip(ta, 0, 255).astype(np.uint8)).resize((lado, lado), Image.LANCZOS)
# colliders a medida (cajas y esferas del juego) para lo que con un solo casco convexo queda mal
def caja(S, ext=0.0):
    lo, hi = S.min(0) - ext, S.max(0) + ext
    return {'k': 'b', 's': [round(float(x), 4) for x in hi - lo], 'c': [round(float(x), 4) for x in (hi + lo) / 2], 'tr': 0}
def colliders(V, tipo, H):
    y = V[:, 1]
    if tipo == 'esfera':
        r = float((V.max(0) - V.min(0)).max() / 2); return [{'k': 's', 'r': round(r, 4), 'c': [0, round(r, 4), 0], 'tr': 0}]
    if tipo == 'tronco':
        # el tronco hasta donde empiezan las hojas (donde la planta se ensancha de golpe), en tres tramos
        anchos = []; paso = H / 24
        for k in range(24):
            S = V[(y >= k * paso) & (y < (k + 1) * paso)]
            anchos.append((S[:, [0, 2]].max(0) - S[:, [0, 2]].min(0)).max() if len(S) else 0)
        base = max(anchos[2:6]); fin = next((k for k in range(6, 24) if anchos[k] > 2.5 * base), 18) * paso
        return [caja(V[(y >= fin * a / 3) & (y < fin * (a + 1) / 3)]) for a in range(3)]
    if tipo == 'pila':
        # cuatro cajas por altura: la de abajo con la base plana (un poste no se tambalea)
        return [caja(V[(y >= H * a / 4) & (y <= H * (a + 1) / 4)]) for a in range(4)]
    if tipo == 'mesa':
        # la tabla (desde donde hay muchos puntos arriba) y una caja recta por pata (la huella de cada pata en el piso,
        # hasta la tabla): abajo queda libre aunque tenga travesaños
        cnt = np.histogram(y, bins=24, range=(0, H))[0]; k = next(i for i in range(23, -1, -1) if cnt[i] < cnt[23] * 0.25) + 1
        ty = k * H / 24; out = [caja(V[y >= ty])]; pie = V[y < 0.04 * H]
        for sx in (-1, 1):
            for sz in (-1, 1):
                Q = pie[(np.sign(pie[:, 0]) == sx) & (np.sign(pie[:, 2]) == sz)]
                if len(Q) < 4: continue
                lo, hi = Q.min(0), Q.max(0)
                out.append({'k': 'b', 's': [round(float(hi[0] - lo[0]) + 0.01, 4), round(ty, 4), round(float(hi[2] - lo[2]) + 0.01, 4)], 'c': [round(float(hi[0] + lo[0]) / 2, 4), round(ty / 2, 4), round(float(hi[2] + lo[2]) / 2, 4)], 'tr': 0})
        return out
    if tipo == 'aro':
        # base, palo (recto, por su huella a media altura) y tablero (el plano de lo más alto); el aro sin collider
        out = [caja(V[y < 0.16 * H])]
        m = V[(y > 0.3 * H) & (y < 0.6 * H)]; lo, hi = m.min(0), m.max(0)
        out.append({'k': 'b', 's': [round(float(hi[0] - lo[0]), 4), round(0.55 * H, 4), round(float(hi[2] - lo[2]), 4)], 'c': [round(float(hi[0] + lo[0]) / 2, 4), round(0.16 * H + 0.275 * H, 4), round(float(hi[2] + lo[2]) / 2, 4)], 'tr': 0})
        zt = float(np.median(V[y > 0.92 * H][:, 2])); out.append(caja(V[(y > 0.7 * H) & (np.abs(V[:, 2] - zt) < 0.1)]))
        return out
    return None
cats = {}
for arg in sys.argv[2:]:
    nom, alto, masa, cat, ruta, foto, *extra = arg.split(':')
    op = dict((e.split('=') + [1])[:2] for e in extra)
    J, B = glb.leer(ruta); W = glb.mundo(J)
    mi_n = next(i for i, n in enumerate(J['nodes']) if 'mesh' in n); M = W[mi_n]
    pr = J['meshes'][J['nodes'][mi_n]['mesh']]['primitives'][0]; A = pr['attributes']
    V = glb.acc(J, B, A['POSITION']); N = glb.acc(J, B, A['NORMAL']); UV = glb.acc(J, B, A['TEXCOORD_0']); IDX = glb.acc(J, B, pr['indices']).astype(np.int64).reshape(-1, 3)
    V = V @ M[:3, :3].T + M[:3, 3]; N = N @ M[:3, :3].T; N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    s = float(alto) / (V[:, 1].max() - V[:, 1].min()); c = (V.max(0) + V.min(0)) / 2
    V = (V - np.array([c[0], V[:, 1].min(), c[2]])) * s
    mat = J['materials'][pr.get('material', 0)]; tx = J['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]
    bv = J['bufferViews'][J['images'][tx['source']]['bufferView']]
    TEX = Image.open(io.BytesIO(bytes(B[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]))).convert('RGB')
    mn = V.min(0); sc = np.maximum(V.max(0) - mn, 1e-6)
    q = np.round((V - mn) / sc * 65535).astype('<u2'); nb = np.clip(np.round(N * 127), -127, 127).astype(np.int8)
    uv = np.stack([UV[:, 0], 1 - UV[:, 1]], 1).astype('<f2')
    vb = np.zeros((len(V), 14), np.uint8); vb[:, 0:6] = q.view(np.uint8).reshape(-1, 6); vb[:, 6:9] = nb.view(np.uint8).reshape(-1, 3); vb[:, 10:14] = uv.view(np.uint8).reshape(-1, 4)
    i32 = len(V) > 65535
    o_v = agregar(vb.tobytes()); o_i = agregar(IDX.astype('<u4' if i32 else '<u2').tobytes())
    mi = len(d['ms']); d['ms'].append({'n': nom, 'o': o_v, 'v': len(V), 'mn': mn.tolist(), 'sc': sc.tolist(), 'i': o_i, 'i32': bool(i32), 'sub': [[0, len(IDX) * 3]]})
    ti = len(d['tx']); d['tx'].append({'n': nom, 'a': 0, 'w': 512, 'h': 512})
    textura(TEX, UV, IDX, 512).save(PK + '/t/%d.webp' % ti, 'WEBP', quality=86, method=6)
    mt = json.loads(json.dumps(d['mt'][cone['mt'][0]] if 'mt' in cone else d['mt'][0])); mt['n'] = 'RB_' + nom; mt['t'] = ti
    if 'tt' in mt: mt['tt']['_MainTex'] = [ti, 1.0, 1.0, 0.0, 0.0]
    mt['c'] = [1, 1, 1, 1]; ma = len(d['mt']); d['mt'].append(mt)
    key = nom + '#rb' + hashlib.md5(nom.encode()).hexdigest()[:4]
    col = colliders(V, op.get('col'), float(alto)) or [{'k': 'm', 'm': mi, 'cv': 1, 'tr': 0}]
    rb = {'m': float(masa), 'd': 0.0, 'k': 0, 'g': 1}
    if 'rs' in op: rb['rs'] = float(op['rs'])
    if 'sal' in op: rb['sal'] = 1
    d['pf'][key] = [{'n': nom, 'p': [0, 0, 0], 'r': [0, 0, 0, 1], 's': [1, 1, 1], 'pa': -1, 'tg': 20000, 'mb': ['PhotonView', 'Prop', 'PhotonTransformViewClassic'], 'rb': rb},
                    {'n': nom + '_m', 'p': [0, 0, 0], 'r': [0, 0, 0, 1], 's': [1, 1, 1], 'pa': 0, 'tg': 20000, 'm': mi, 'mt': [ma], 'rid': 9910000 + mi, 'col': col}]
    # ícono: la foto recortada al objeto, cuadrada
    f = Image.open(foto).convert('RGB'); a = np.asarray(f).astype(np.int32); fondo = a[2, 2]
    dif = np.abs(a - fondo).sum(2) > 40; ys, xs = np.where(dif)
    if len(xs): x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max(); m = max(x1 - x0, y1 - y0) * 0.56; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; f = f.crop((int(cx - m), int(cy - m), int(cx + m), int(cy + m)))
    f.resize((160, 160), Image.LANCZOS).save(PK + '/i/%s.webp' % nom, 'WEBP', quality=86); d['ico'][nom] = nom
    cats.setdefault(cat, []).append(nom)
    print(nom, 'vértices', len(V), 'triángulos', len(IDX), 'medidas', np.round(sc, 2), 'masa', masa)
# en el menú de props: categorías propias primero
props = next(c for c in d['menu'] if c['n'] == 'Props')
for k, (cat, its) in enumerate(cats.items()):
    s = next((x for x in props['sub'] if x['n'] == cat), None)
    if s is None: s = {'n': cat, 'it': [], 'rb': 1}; props['sub'].insert(k, s)
    for it in its:
        if it not in s['it']: s['it'].append(it)
open(PK + '/m.bin.gz', 'wb').write(gzip.compress(bytes(BIN), 6))
open(PK + '/d.json.gz', 'wb').write(gzip.compress(json.dumps(d, separators=(',', ':')).encode(), 6))
print('props listos:', sum(len(v) for v in cats.values()))
