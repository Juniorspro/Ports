# Riggea un personaje sin brazos ni piernas con manos flotantes (The Boiled One: una columna negra con la cabeza arriba y
# dos manos sueltas a los costados) para que skin_meshy.py lo pase al esqueleto del juego. El modelo 3D viene sin
# riggear; esto le arma el esqueleto de los generados (Hips, tres vértebras, neck, Head, brazos y piernas con sus nombres)
# y los pesos:
# - el cuerpo pesa en la columna (cadera, vértebras, cuello, cabeza) según la altura, mezclando entre vecinas; lo de arriba
#   de los hombros (cabeza, pelos, púas de la cabeza) va a la cabeza;
# - cada mano es una pieza suelta (lo que está lejos del cuerpo a los costados) y pesa entera en su hueso de la mano;
# - los brazos van del hombro a la muñeca de cada mano (invisibles: no pesa nada en ellos) y las piernas quedan adentro de
#   la base (tampoco pesan): con las animaciones del juego las manos se mueven solas y la columna se dobla apenas.
# --pelo-negro: lo gris claro de la textura (el fondo de la imagen que se coló en los pelos finitos) pasa a negro.
# Uso: python3 -I rig_flotante.py GLB_SIN_RIG SALIDA.glb [--pelo-negro]
import sys, os, io, json, struct, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glb
PELO = '--pelo-negro' in sys.argv
ENT, OUT = [a for a in sys.argv[1:] if not a.startswith('--')][:2]
J, B = glb.leer(ENT); pr = J['meshes'][0]['primitives'][0]; A = pr['attributes']
V = glb.acc(J, B, A['POSITION']).astype(np.float64); I = glb.acc(J, B, pr['indices']).astype(np.int64).reshape(-1, 3)
y0, y1 = V[:, 1].min(), V[:, 1].max(); H = y1 - y0
# piezas: vértices unidos por triángulos (soldando los repetidos en las costuras de UV por posición)
cl = np.unique(np.round(V / 1e-4).astype(np.int64), axis=0, return_inverse=True)[1].reshape(-1)
pa = np.arange(cl.max() + 1)
def raiz(a):
    while pa[a] != a: pa[a] = pa[pa[a]]; a = pa[a]
    return a
for a, b, c in cl[I]:
    ra, rb, rc = raiz(a), raiz(b), raiz(c)
    pa[rb] = ra; pa[raiz(rc)] = ra
pieza = np.array([raiz(x) for x in cl])
# el cuerpo: lo que está cerca del eje (la columna mide de ancho lo que su mitad de abajo, sin las púas)
abajo = V[:, 1] < y0 + 0.5 * H
anchoC = np.percentile(np.abs(V[abajo, 0]), 90); cx = np.median(V[abajo, 0]); cz = np.median(V[abajo, 2])
print('alto', round(H, 3), 'radio de la columna', round(anchoC, 3))
manos = {}
for p in np.unique(pieza):
    s = pieza == p; c = V[s].mean(0)
    if s.sum() > 150 and abs(c[0] - cx) > anchoC * 2.5 and c[1] > y0 + 0.6 * H:
        lado = 'Left' if c[0] > cx else 'Right'   # (los generados miran a +Z: su izquierda es +X)
        manos[lado] = manos.get(lado, np.zeros(len(V), bool)) | s
assert set(manos) == {'Left', 'Right'}, 'no encontré las dos manos: ' + str(list(manos))
for l, s in manos.items(): print(l, 'mano', int(s.sum()), 'vértices, x', np.round([V[s, 0].min(), V[s, 0].max()], 3), 'y', round(V[s, 1].mean(), 3))
# esqueleto (en fracciones del alto, como los generados): la cadera a 0,40, la cabeza empieza a 0,88
f = lambda k: y0 + k * H
manoY = np.mean([V[s, 1].mean() for s in manos.values()])
# la columna se curva (arriba va hacia adelante): cada articulación en el centro del cuerpo a su altura
cuerpo = ~(manos['Left'] | manos['Right'])
def centro(y):
    s = cuerpo & (np.abs(V[:, 1] - y) < 0.03 * H)
    return [float(np.median(V[s, 0])), float(y), float(np.median(V[s, 2]))]
JT = {'Hips': centro(f(0.40)), 'Spine02': centro(f(0.52)), 'Spine01': centro(f(0.63)), 'Spine': centro(f(0.73)),
      'neck': centro(f(0.84)), 'Head': centro(f(0.88)), 'head_end': centro(y1 - 0.02 * H)}
cx, cz = JT['Spine'][0], JT['Spine'][2]   # (los hombros salen de ahí)
for l, sg in (('Left', 1), ('Right', -1)):
    s = manos[l]; xin = V[s, 0].min() if sg > 0 else V[s, 0].max()   # (la muñeca: la punta de la mano del lado del cuerpo)
    cerca = s & (np.abs(V[:, 0] - xin) < 0.02)
    mu = np.array([xin, V[cerca, 1].mean(), V[cerca, 2].mean()])
    hom = np.array([cx + sg * anchoC * 0.5, manoY, cz]); brazo = np.array([cx + sg * anchoC * 1.2, manoY, cz])
    JT[l + 'Shoulder'] = hom.tolist(); JT[l + 'Arm'] = brazo.tolist(); JT[l + 'ForeArm'] = ((brazo + mu) / 2).tolist(); JT[l + 'Hand'] = mu.tolist()
    bx, _, bz = centro(f(0.2)); px = bx + sg * anchoC * 0.45
    JT[l + 'UpLeg'] = [px, f(0.37), bz]; JT[l + 'Leg'] = [px, f(0.2), bz]; JT[l + 'Foot'] = [px, f(0.035), bz]; JT[l + 'ToeBase'] = [px, f(0.01), bz + anchoC * 0.6]
PADRE = {'Hips': None, 'Spine02': 'Hips', 'Spine01': 'Spine02', 'Spine': 'Spine01', 'neck': 'Spine', 'Head': 'neck', 'head_end': 'Head'}
for l in ('Left', 'Right'):
    PADRE.update({l + 'Shoulder': 'Spine', l + 'Arm': l + 'Shoulder', l + 'ForeArm': l + 'Arm', l + 'Hand': l + 'ForeArm',
                  l + 'UpLeg': 'Hips', l + 'Leg': l + 'UpLeg', l + 'Foot': l + 'Leg', l + 'ToeBase': l + 'Foot'})
NOMS = list(PADRE); K = {n: k for k, n in enumerate(NOMS)}
# pesos del cuerpo: a lo largo de la columna, entre las dos articulaciones vecinas según la altura
CAD = ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head']; hy = np.array([JT[n][1] for n in CAD])
W = np.zeros((len(V), 4)); JI = np.zeros((len(V), 4), np.int64)
y = V[:, 1]; j = np.clip(np.searchsorted(hy, y) - 1, 0, len(CAD) - 2)
t = np.clip((y - hy[j]) / (hy[j + 1] - hy[j]), 0, 1); t = t * t * (3 - 2 * t)
JI[:, 0] = [K[CAD[k]] for k in j]; JI[:, 1] = [K[CAD[k + 1]] for k in j]; W[:, 0] = 1 - t; W[:, 1] = t
arriba = y >= hy[-1]; JI[arriba, 0] = K['Head']; W[arriba] = [1, 0, 0, 0]
# (los pelos y las púas que cuelgan de la cabeza por debajo de ella, lejos de la columna, van con la cabeza)
colg = (y > manoY - 0.02 * H) & (np.abs(V[:, 0] - cx) > anchoC * 1.15) & (y < hy[-1])
JI[colg, 0] = K['Head']; W[colg] = [1, 0, 0, 0]
for l, s in manos.items(): JI[s, 0] = K[l + 'Hand']; JI[s, 1:] = 0; W[s] = [1, 0, 0, 0]
print('pesos: cabeza', int(((JI[:, 0] == K['Head']) & (W[:, 0] == 1)).sum()), '· colgando', int(colg.sum()))
# ---------------- GLB con piel ----------------
Bm = bytearray(B)
if PELO:
    from PIL import Image
    mat = J['materials'][pr.get('material', 0)]; tx = J['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]
    img = J['images'][tx['source']]; bv = J['bufferViews'][img['bufferView']]
    T = np.asarray(Image.open(io.BytesIO(bytes(B[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]))).convert('RGB')).astype(np.float32)
    mx, mn = T.max(2), T.min(2); gris = (mx > 95) & ((mx - mn) < 0.18 * mx)
    T[gris] = T[gris] * 0.12 + 6   # (casi negro, con un poco del brillo que tenía)
    print('textura: grises a negro', int(gris.sum()), 'de', gris.size)
    png = io.BytesIO(); Image.fromarray(T.clip(0, 255).astype(np.uint8)).save(png, 'PNG'); png = png.getvalue()
    while len(Bm) % 4: Bm.append(0)
    J['bufferViews'].append({'buffer': 0, 'byteOffset': len(Bm), 'byteLength': len(png)}); Bm += png
    img['bufferView'] = len(J['bufferViews']) - 1; img['mimeType'] = 'image/png'
def bloque(arr):
    while len(Bm) % 4: Bm.append(0)
    o = len(Bm); Bm.extend(arr.tobytes()); J['bufferViews'].append({'buffer': 0, 'byteOffset': o, 'byteLength': arr.nbytes}); return len(J['bufferViews']) - 1
def accesor(arr, ct, tipo):
    J['accessors'].append({'bufferView': bloque(arr), 'componentType': ct, 'count': len(arr), 'type': tipo}); return len(J['accessors']) - 1
A['JOINTS_0'] = accesor(JI.astype('<u2'), 5123, 'VEC4'); A['WEIGHTS_0'] = accesor(W.astype('<f4'), 5126, 'VEC4')
base = len(J['nodes']); malla = next(i for i, n in enumerate(J['nodes']) if 'mesh' in n)
for n in NOMS:
    p = PADRE[n]; t = np.array(JT[n]) - (np.array(JT[p]) if p else 0)
    J['nodes'].append({'name': n, 'translation': t.tolist(), 'children': [base + K[c] for c in NOMS if PADRE[c] == n]})
ibm = np.stack([np.linalg.inv(np.block([[np.eye(3), np.array(JT[n])[:, None]], [np.zeros((1, 3)), np.ones((1, 1))]])).T for n in NOMS]).astype('<f4')
J['skins'] = [{'joints': [base + k for k in range(len(NOMS))], 'inverseBindMatrices': accesor(ibm.reshape(-1, 16), 5126, 'MAT4'), 'skeleton': base}]
J['nodes'][malla]['skin'] = 0
J['nodes'].append({'name': 'Armature', 'children': [malla, base]})
for n in J['nodes'][:base]:   # (la malla pasa a colgar del Armature)
    if 'children' in n: n['children'] = [c for c in n['children'] if c != malla]
J['scenes'] = [{'nodes': [len(J['nodes']) - 1]}]; J['scene'] = 0
while len(Bm) % 4: Bm.append(0)
J['buffers'][0]['byteLength'] = len(Bm)
js = json.dumps(J, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
with open(OUT, 'wb') as fo:
    fo.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(Bm)))
    fo.write(struct.pack('<II', len(js), 0x4E4F534A)); fo.write(js)
    fo.write(struct.pack('<II', len(Bm), 0x004E4942)); fo.write(bytes(Bm))
print('escrito', OUT, 'huesos', len(NOMS))
