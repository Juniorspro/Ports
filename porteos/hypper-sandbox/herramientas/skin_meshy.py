# Agrega (o reemplaza) un skin al paquete del juego desde un GLB riggeado (esqueleto tipo mixamo con pesos), sin
# estirar la malla: la malla se lleva a la pose de enlace del Hero rotando cada hueso con sus propios pesos (de pose T a
# la del Hero, con los largos del personaje), las articulaciones del esqueleto del juego se ponen donde están en esa
# malla (con las mismas orientaciones de enlace del Hero: así anima con todos los clips del juego) y los pesos son los
# del riggeo. La altura se ajusta para que la cadera quede a la del Hero (los pies apoyan igual en todas las animaciones).
# Con --alto K el personaje mide K veces lo que el Hero (Jake, Finn: los bajitos) achicando la raíz, así anima igual y
# los pies apoyan; --ojo F corrige la altura de los ojos de la cámara (respecto de la de un humano de ese alto).
# El retrato sale de la imagen ICONO (la cabeza, arriba al centro; --retrato x0,y0,x1,y1 en fracciones para otro recorte).
# Uso: python3 -I skin_meshy.py GLB NOMBRE ICONO.png|- PAQUETE_ORIGEN PAQUETE_NUEVO [--quitar NOMBRE_VIEJO] [--alto K] [--ojo F] [--retrato x0,y0,x1,y1]
import sys, os, io, json, gzip, shutil, numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glb

args = sys.argv[1:]; quitar = None; ALTO = None; OJO = 1.0
if '--quitar' in args: i = args.index('--quitar'); quitar = args[i + 1]; del args[i:i + 2]
if '--alto' in args: i = args.index('--alto'); ALTO = float(args[i + 1]); del args[i:i + 2]
if '--ojo' in args: i = args.index('--ojo'); OJO = float(args[i + 1]); del args[i:i + 2]
RECORTE = (0.36, 0, 0.64, 0.28)
if '--retrato' in args: i = args.index('--retrato'); RECORTE = tuple(float(x) for x in args[i + 1].split(',')); del args[i:i + 2]
GLB, NOM, ICO, PK0, PK1 = args[:5]
d = json.load(gzip.open(PK0 + '/d.json.gz')); BIN = bytearray(gzip.decompress(open(PK0 + '/m.bin.gz', 'rb').read()))
arb = d['pf']['PhotonPlayer#b2dc44']
CR = next(i for i, n in enumerate(arb) if n['n'] == 'CharactersRoot')
nuevos_t = []   # (índice de textura, imagen) a escribir

# ---------------- quitar un skin agregado al final (Goku de antes, por ejemplo) ----------------
def quitar_skin(nom):
    global BIN
    R = next((i for i, n in enumerate(arb) if n['n'] == nom and n['pa'] == CR), None)
    assert R is not None, 'no está ' + nom
    sub = [R]; k = 0
    while k < len(sub): sub += [i for i, n in enumerate(arb) if n['pa'] == sub[k]]; k += 1
    assert sorted(sub) == list(range(len(arb) - len(sub), len(arb))), nom + ' no está al final del árbol'
    mi = next(arb[i]['m'] for i in sub if 'm' in arb[i] and arb[i].get('bo'))
    assert mi == len(d['ms']) - 1, 'su malla no es la última'
    m = d['ms'][mi]; ma = arb[[i for i in sub if 'm' in arb[i] and arb[i].get('bo')][0]]['mt'][0]
    assert ma == len(d['mt']) - 1, 'su material no es el último'
    ti = d['mt'][ma]['t']; assert ti == len(d['tx']) - 1, 'su textura no es la última'
    fin = max(m['o'] + m['v'] * 14, m['sk'] + m['v'] * 8, m['i'] + sum(s[1] for s in m['sub']) * (4 if m['i32'] else 2))
    otros = [x for j, x in enumerate(d['ms']) if j != mi and x.get('o') is not None]
    lo = min(m['o'], m['sk'], m['i'])
    assert all(x['o'] < lo and x.get('sk', 0) < lo and x.get('i', 0) < lo for x in otros), 'hay datos después de la malla'
    assert fin <= len(BIN)
    del arb[len(arb) - len(sub):]; d['ms'].pop(); d['mt'].pop(); d['tx'].pop(); BIN = BIN[:lo]
    if nom in d['chars']: d['chars'].remove(nom)
    d['ico'].pop(nom.lower(), None); d.get('tam', {}).pop(nom, None)
    print('quitado', nom, 'nodos', len(sub), 'bytes', fin - lo)
    return ti
ti_quitada = quitar_skin(quitar) if quitar else None

# ---------------- el Hero: esqueleto, pose de enlace y nodos ----------------
HERO = next(i for i, n in enumerate(arb) if n['n'] == 'Hero' and n['pa'] == CR)
HM = next(i for i, n in enumerate(arb) if n['pa'] == HERO and 'm' in n)
mh = d['ms'][arb[HM]['m']]; bo = arb[HM]['bo']
nombres = [arb[b]['n'].split(':')[-1] if b >= 0 else '-' for b in bo]; KB = {nm: k for k, nm in enumerate(nombres)}
BP = np.array(mh['bp'], dtype=np.float64).reshape(-1, 4, 4); GH = np.array([np.linalg.inv(b) for b in BP])
JH = {nm: GH[k][:3, 3] for k, nm in enumerate(nombres)}
paN = {nm: (arb[arb[bo[k]]['pa']]['n'].split(':')[-1]) for k, nm in enumerate(nombres)}
hv = mh['v']; raw = np.frombuffer(bytes(BIN[mh['o']:mh['o'] + hv * 14]), np.uint8).reshape(hv, 14)
HP = np.array(mh['mn']) + raw[:, 0:6].copy().view('<u2').astype(np.float64) / 65535 * np.array(mh['sc'])
# la punta de la cabeza del Hero (no deforma: no tiene pose de enlace) desde su nodo
for i, n in enumerate(arb):
    if n['n'].endswith('HeadTop_End') and arb[n['pa']]['n'].endswith(':Head') and i > HERO and i < HERO + 200:
        JH['HeadTop_End'] = (GH[KB['Head']] @ np.array([*np.array(n['p']) / 1.0525, 1]))[:3]; break

# ---------------- el personaje riggeado ----------------
J, B = glb.leer(GLB); sk = J['skins'][0]; IBM = glb.acc(J, B, sk['inverseBindMatrices'])
mjn = [J['nodes'][j]['name'] for j in sk['joints']]; GM = [np.linalg.inv(x) for x in IBM]
PM = {nm: GM[k][:3, 3].copy() for k, nm in enumerate(mjn)}
pr = J['meshes'][0]['primitives'][0]; A = pr['attributes']
V = glb.acc(J, B, A['POSITION']); N = glb.acc(J, B, A['NORMAL']); UV = glb.acc(J, B, A['TEXCOORD_0'])
JT = glb.acc(J, B, A['JOINTS_0']).astype(np.int64); WT = glb.acc(J, B, A['WEIGHTS_0']); IDX = glb.acc(J, B, pr['indices']).astype(np.int64).reshape(-1, 3)
mat = J['materials'][pr.get('material', 0)]; tx = J['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]
img = J['images'][tx['source']]; bv = J['bufferViews'][img['bufferView']]
TEX = Image.open(io.BytesIO(bytes(B[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]))).convert('RGB')
pam = glb.padres(J); jidx = {j: k for k, j in enumerate(sk['joints'])}
mpa = {mjn[k]: (J['nodes'][pam[j]]['name'] if pam.get(j) in jidx else None) for k, j in enumerate(sk['joints'])}
print(NOM, 'vértices', len(V), 'triángulos', len(IDX), 'huesos', len(mjn), 'textura', TEX.size)

# nombres: los del riggeo → los del juego (la columna: de abajo arriba Spine, Spine1, Spine2)
MAP = {'Hips': 'Hips', 'neck': 'Neck', 'Head': 'Head', 'head_end': 'HeadTop_End', 'headfront': 'Head'}
col = sorted([m for m in mjn if m.lower().startswith('spine')], key=lambda m: PM[m][1])
for m, o in zip(col, ['Spine', 'Spine1', 'Spine2']): MAP[m] = o
for lado in ('Left', 'Right'):
    for p in ('Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase'): MAP[lado + p] = lado + p
for m in mjn: assert m in MAP, 'hueso sin equivalente: ' + m
inv = {}
for m, o in MAP.items():
    if m in PM and o not in inv and m != 'headfront': inv[o] = m
HIJO = {'Spine': 'Spine1', 'Spine1': 'Spine2', 'Spine2': 'Neck', 'Neck': 'Head'}
for lado in ('Left', 'Right'):
    HIJO.update({lado + 'Shoulder': lado + 'Arm', lado + 'Arm': lado + 'ForeArm', lado + 'ForeArm': lado + 'Hand', lado + 'UpLeg': lado + 'Leg', lado + 'Leg': lado + 'Foot', lado + 'Foot': lado + 'ToeBase'})

# a las medidas del juego: cadera a la altura de la del Hero, centrado como el Hero, pies en el piso
y0 = V[:, 1].min(); s = (JH['Hips'][1] - 0) / (PM[inv['Hips']][1] - y0)
t = np.array([JH['Hips'][0] - PM[inv['Hips']][0] * s, -y0 * s, JH['Hips'][2] - PM[inv['Hips']][2] * s])
V = V * s + t
for m in PM: PM[m] = PM[m] * s + t
print('escala', round(s, 4), 'alto', round(V[:, 1].max(), 3), '(Hero', round(HP[:, 1].max(), 3), ')')

# ---------------- de pose T a la pose de enlace del Hero, con los pesos del riggeo ----------------
orden = []
def poner(m):
    if m in orden: return
    if mpa[m]: poner(mpa[m])
    orden.append(m)
for m in mjn: poner(m)
QW, PP = {}, {}
for m in orden:
    p = mpa[m]
    if p is None: QW[m] = np.array([0, 0, 0, 1.0]); PP[m] = PM[m].copy()
    else: PP[m] = PP[p] + glb.qrot(QW[p], PM[m] - PM[p]); QW[m] = QW[p].copy()
    o = MAP[m]
    if o in HIJO and HIJO[o] in inv and o in JH and HIJO[o] in JH and m != 'headfront':
        c = inv[HIJO[o]]; cur = glb.qrot(QW[m], PM[c] - PM[m])
        QW[m] = glb.qmul(glb.rot_entre(cur, JH[HIJO[o]] - JH[o]), QW[m])
R = {m: glb.q2m(QW[m]) for m in mjn}
V2 = np.zeros_like(V); N2 = np.zeros_like(N)
for c in range(4):
    for k, m in enumerate(mjn):
        sel = (JT[:, c] == k) & (WT[:, c] > 0)
        if not sel.any(): continue
        w = WT[sel, c][:, None]
        V2[sel] += w * (PP[m] + (V[sel] - PM[m]) @ R[m].T); N2[sel] += w * (N[sel] @ R[m].T)
V2 /= np.maximum(WT.sum(1, keepdims=True), 1e-9); N2 /= np.maximum(np.linalg.norm(N2, axis=1, keepdims=True), 1e-9)

# ---------------- las articulaciones del juego en esa malla ----------------
JN = {}
for o, m in inv.items(): JN[o] = PP[m]
def razon(a, b):
    return np.linalg.norm(JN[b] - JN[a]) / max(np.linalg.norm(JH[b] - JH[a]), 1e-6) if a in JN and b in JN and a in JH and b in JH else 1.0
GRUPO = {}
for k, nm in enumerate(nombres):
    x = nm
    while x not in JN and x in paN: x = paN[x]
    GRUPO[nm] = x
RZ = {'Hand': lambda l: razon(l + 'ForeArm', l + 'Hand'), 'Foot': lambda l: razon(l + 'Foot', l + 'ToeBase'), 'ToeBase': lambda l: razon(l + 'Foot', l + 'ToeBase')}
def razon_de(base):
    for suf, f in RZ.items():
        if base.endswith(suf): return f(base[:-len(suf)])
    if base in ('Head', 'HeadTop_End'): return razon('Neck', 'Head')
    return 1.0
def hondo(nm):
    k = 0
    while nm in paN and paN[nm] in KB: nm = paN[nm]; k += 1
    return k
for nm in sorted(nombres, key=hondo):   # (los padres primero)
    if nm in JN: continue
    p = paN[nm]; r = razon_de(GRUPO[nm])
    JN[nm] = JN[p] + (JH[nm] - JH[p]) * r
# pesos: a los huesos del juego (4 por vértice, en bytes que suman 255)
NB = len(nombres); WD = np.zeros((len(V2), NB))
for c in range(4):
    for k, m in enumerate(mjn): sel = JT[:, c] == k; WD[sel, KB[MAP[m] if MAP[m] in KB else 'Head']] += WT[sel, c]
WD /= np.maximum(WD.sum(1, keepdims=True), 1e-9)
top = np.argsort(-WD, 1)[:, :4]; tw = np.take_along_axis(WD, top, 1); tw /= tw.sum(1, keepdims=True)
wb = np.floor(tw * 255).astype(np.int32); wb[:, 0] += 255 - wb.sum(1)
# pose de enlace nueva: las mismas orientaciones del Hero en las articulaciones nuevas
GN = GH.copy()
for k, nm in enumerate(nombres): GN[k][:3, 3] = JN[nm]
BPN = [np.linalg.inv(g) for g in GN]
for nm in ('LeftArm', 'LeftForeArm', 'LeftHand', 'LeftUpLeg', 'LeftLeg', 'Head', 'Neck'):
    print('  %-12s Hero %s → %s' % (nm, np.round(JH[nm], 3), np.round(JN[nm], 3)))

# ---------------- empaquetar como las mallas del juego ----------------
mn = V2.min(0); sc = V2.max(0) - mn
q = np.round((V2 - mn) / sc * 65535).astype('<u2'); nb = np.clip(np.round(N2 * 127), -127, 127).astype(np.int8)
uv = np.stack([UV[:, 0], 1 - UV[:, 1]], 1).astype('<f2')
vb = np.zeros((len(V2), 14), np.uint8); vb[:, 0:6] = q.view(np.uint8).reshape(-1, 6); vb[:, 6:9] = nb.view(np.uint8).reshape(-1, 3); vb[:, 10:14] = uv.view(np.uint8).reshape(-1, 4)
skb = np.zeros((len(V2), 8), np.uint8); skb[:, :4] = top; skb[:, 4:] = wb
i32 = len(V2) > 65535; ib = IDX.astype('<u4' if i32 else '<u2').tobytes()
def agregar(b):
    while len(BIN) % 4: BIN.append(0)
    o = len(BIN); BIN.extend(b); return o
o_v = agregar(vb.tobytes()); o_s = agregar(skb.tobytes()); o_i = agregar(ib)
mi = len(d['ms'])
d['ms'].append({'n': NOM, 'o': o_v, 'v': len(V2), 'mn': mn.tolist(), 'sc': sc.tolist(), 'i': o_i, 'i32': bool(i32), 'sub': [[0, len(IDX) * 3]], 'sk': o_s,
                'bp': [list(map(float, b.reshape(16))) for b in BPN]})
ti = len(d['tx']); d['tx'].append({'n': NOM, 'a': 0, 'w': 1024, 'h': 1024})
mt = json.loads(json.dumps(d['mt'][arb[HM]['mt'][0]])); mt['n'] = 'DI_' + NOM; mt['t'] = ti; mt['tt']['_MainTex'] = [ti, 1.0, 1.0, 0.0, 0.0]
ma = len(d['mt']); d['mt'].append(mt)
# el sub-árbol del Hero copiado con el nombre nuevo y las articulaciones movidas (los nodos miden 1,0525 la pose de enlace)
sub = [HERO]; k = 0
while k < len(sub): sub += [i for i, n in enumerate(arb) if n['pa'] == sub[k] and not n['n'].startswith('(POLY FEW)')]; k += 1
sub.sort(); base = len(arb); mapa = {o: base + i for i, o in enumerate(sub)}
pos_bo = {b: KB[nombres[k]] for k, b in enumerate(bo)}
rid = 9900100 + len(d['chars'])
# el alto pedido: la raíz se achica (o agranda) entera; todo lo de abajo (huesos, cadera de las animaciones, colisionadores)
# la sigue. Se compara con el Hero en la misma pose de enlace (pies en 0)
fA = ALTO * HP[:, 1].max() / V2[:, 1].max() if ALTO else 1.0
for o in sub:
    n = json.loads(json.dumps(arb[o]))
    n['pa'] = mapa.get(n['pa'], n['pa'])
    if 'bo' in n: n['bo'] = [mapa.get(b, -1) if b >= 0 else -1 for b in n['bo']]
    if o == HERO: n['n'] = NOM; n.pop('lod', None); n['s'] = [x * fA for x in n['s']]
    if o == HM: n['n'] = NOM; n['m'] = mi; n['mt'] = [ma]; n['rid'] = rid
    nm = arb[o]['n'].split(':')[-1]
    if o in pos_bo:
        k = pos_bo[o]; pa = arb[o]['pa']
        if pa in pos_bo:
            Th = np.linalg.inv(GH[pos_bo[pa]]) @ GH[k]; Tn = np.linalg.inv(GN[pos_bo[pa]]) @ GN[k]
            kk = np.linalg.norm(arb[o]['p']) / max(np.linalg.norm(Th[:3, 3]), 1e-9) if np.linalg.norm(Th[:3, 3]) > 1e-6 else 1.0525
            n['p'] = (Tn[:3, 3] * kk).tolist()
        else:
            n['p'] = (np.array(arb[o]['p']) + 1.0525 * (JN[nm] - JH[nm])).tolist()
        # colisionadores del muñeco a la medida del personaje
        if n.get('col'):
            r = razon(nm, HIJO[nm]) if nm in HIJO else razon_de(GRUPO.get(nm, nm))
            for c in n['col']:
                c['c'] = [x * r for x in c['c']]
                if 's' in c: c['s'] = [x * r for x in c['s']]
                if 'r' in c: c['r'] = c['r'] * r
                if 'h' in c: c['h'] = c['h'] * r
    elif arb[o]['pa'] in pos_bo:
        n['p'] = (np.array(arb[o]['p']) * razon_de(GRUPO.get(arb[arb[o]['pa']]['n'].split(':')[-1], nm))).tolist()
    arb.append(n)
d['chars'].append(NOM)
if ALTO: d.setdefault('tam', {})[NOM] = [ALTO, OJO]; print('alto', ALTO, 'del Hero · raíz ×', round(fA, 4), '· ojos ×', OJO)
# ---------------- archivos ----------------
if os.path.exists(PK1): shutil.rmtree(PK1)
os.makedirs(PK1 + '/t'); os.makedirs(PK1 + '/i'); os.makedirs(PK1 + '/a')
for sd in ('t', 'i', 'a', 'fondos', 'carga'):  # (carga: los fondos de la pantalla de carga)
    if not os.path.isdir(PK0 + '/' + sd): continue
    os.makedirs(PK1 + '/' + sd, exist_ok=True)
    for f in os.listdir(PK0 + '/' + sd):
        if sd == 't' and ti_quitada is not None and f == '%d.webp' % ti_quitada: continue
        os.link(PK0 + '/' + sd + '/' + f, PK1 + '/' + sd + '/' + f)
# textura: afuera de las islas de UV se rellena con el color del borde (si no, el fondo se mezcla en los mipmaps)
Wt, Ht = TEX.size; mask = Image.new('L', (Wt, Ht), 0); dr = ImageDraw.Draw(mask)
px = np.stack([UV[:, 0] * Wt, UV[:, 1] * Ht], 1)
for tri in IDX: dr.polygon([tuple(px[tri[0]]), tuple(px[tri[1]]), tuple(px[tri[2]])], fill=255)
ta = np.asarray(TEX).astype(np.float32); mk = (np.asarray(mask) > 0).astype(np.float32)
for _ in range(2):
    e = mk.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)): e = np.minimum(e, np.roll(np.roll(mk, dy, 0), dx, 1))
    mk = e
for _ in range(40):
    sm = np.zeros_like(ta); cn = np.zeros_like(mk)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
        sm += np.roll(np.roll(ta * mk[..., None], dy, 0), dx, 1); cn += np.roll(np.roll(mk, dy, 0), dx, 1)
    fill = (mk == 0) & (cn > 0); ta[fill] = sm[fill] / cn[fill][:, None]; mk = np.maximum(mk, fill.astype(np.float32))
ta[mk == 0] = ta[mk > 0].mean(0)
Image.fromarray(np.clip(ta, 0, 255).astype(np.uint8)).resize((1024, 1024), Image.LANCZOS).save(PK1 + '/t/%d.webp' % ti, 'WEBP', quality=88, method=6)
if ICO != '-':
    r = Image.open(ICO).convert('RGB'); W_, H_ = r.size
    r.crop((int(W_ * RECORTE[0]), int(H_ * RECORTE[1]), int(W_ * RECORTE[2]), int(H_ * RECORTE[3]))).resize((256, 256), Image.LANCZOS).save(PK1 + '/i/%s.webp' % NOM.lower(), 'WEBP', quality=88)
    d['ico'][NOM.lower()] = NOM.lower()
open(PK1 + '/m.bin.gz', 'wb').write(gzip.compress(bytes(BIN), 6))
open(PK1 + '/d.json.gz', 'wb').write(gzip.compress(json.dumps(d, separators=(',', ':')).encode(), 6))
print('listo', NOM, 'malla', mi, 'textura', ti, 'nodos', len(sub), 'bin', len(BIN))
