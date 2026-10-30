# El cuerpo de Verity desde un GLB generado (imagen de referencia → modelo 3D): la malla centrada y llevada a radio 1,
# girada para que la cara mire a +Z (se busca dónde están los rasgos oscuros de la textura), y la textura sin la cara
# (los ojos y la boca se tapan con el amarillo de alrededor: la cara animada la dibuja el juego encima, en un casquete
# apenas más grande que el radio de adelante, que se guarda en la malla como "rf"). Se agrega al paquete como la malla
# "Verity" con su textura y el material "RB_Verity" (sin prefab: sólo la usa verity.js).
# Uso: python3 -I verity_glb.py PAQUETE modelo.glb [vista_previa.png]
import sys, os, io, json, gzip, numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glb
PK, RUTA = sys.argv[1], sys.argv[2]
d = json.load(gzip.open(PK + '/d.json.gz')); BIN = bytearray(gzip.decompress(open(PK + '/m.bin.gz', 'rb').read()))
if any(m.get('n') == 'Verity' for m in d['ms']): sys.exit('el paquete ya tiene a Verity')
def agregar(b):
    while len(BIN) % 4: BIN.append(0)
    o = len(BIN); BIN.extend(b); return o
J, B = glb.leer(RUTA); W = glb.mundo(J)
mi_n = next(i for i, n in enumerate(J['nodes']) if 'mesh' in n); M = W[mi_n]
pr = J['meshes'][J['nodes'][mi_n]['mesh']]['primitives'][0]; A = pr['attributes']
V = glb.acc(J, B, A['POSITION']).astype(np.float64); N = glb.acc(J, B, A['NORMAL']).astype(np.float64); UV = glb.acc(J, B, A['TEXCOORD_0']).astype(np.float64)
IDX = glb.acc(J, B, pr['indices']).astype(np.int64).reshape(-1, 3)
V = V @ M[:3, :3].T + M[:3, 3]; N = N @ M[:3, :3].T
mat = J['materials'][pr.get('material', 0)]; tx = J['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]
bv = J['bufferViews'][J['images'][tx['source']]['bufferView']]
TEX = Image.open(io.BytesIO(bytes(B[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]))).convert('RGB')
T = np.asarray(TEX).astype(np.float32) / 255; Ht, Wt = T.shape[:2]
# centro y radio (la mediana: un bulto no cambia la escala)
c = (V.max(0) + V.min(0)) / 2; V -= c; r = np.median(np.linalg.norm(V, axis=1)); V /= r
# dónde está la cara: el promedio de las direcciones de los vértices con color oscuro
px = np.clip((UV[:, 0] * Wt).astype(int), 0, Wt - 1); py = np.clip((UV[:, 1] * Ht).astype(int), 0, Ht - 1)
lum = T[py, px] @ np.array([0.3, 0.59, 0.11])
osc = lum < 0.25
f = V[osc].mean(0) if osc.sum() > 10 else np.array([0, 0, 1.0]); f[1] = 0; f /= np.linalg.norm(f) + 1e-9
a = np.arctan2(f[0], f[2]); ca, sa = np.cos(-a), np.sin(-a); Ry = np.array([[ca, 0, sa], [0, 1, 0], [-sa, 0, ca]])
V = V @ Ry.T; N = N @ Ry.T; N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
rad = np.linalg.norm(V, axis=1); adelante = V[:, 2] > 0.35
print('vértices', len(V), 'triángulos', len(IDX), 'radio min/max %.3f/%.3f' % (rad.min(), rad.max()), 'adelante max %.3f' % rad[adelante].max(), 'giro %.1f°' % np.degrees(a), 'oscuros', int(osc.sum()))
# el modelo trae la cara también tallada en la malla (ojos y sonrisa hundidos): se lleva cada vértice a la esfera (la
# original es una pelota perfecta) y la normal queda radial; así la cara animada no tiene un fantasma debajo
V = V / np.maximum(rad[:, None], 1e-9); N = V.copy(); rad = np.ones(len(V))
# la textura sin la cara: lo que se aleja del amarillo de base (los rasgos oscuros y los bordes claros que les deja el
# render) se rellena desde afuera hacia adentro con el amarillo de alrededor
med = np.median(T.reshape(-1, 3), 0); dif = np.abs(T - med).max(2)
mask = Image.fromarray(((dif > 0.11) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))
print('amarillo de base', np.round(med * 255).astype(int).tolist(), 'tapado %.1f%%' % (100 * (np.asarray(mask) > 0).mean()))
mk = 1 - (np.asarray(mask) > 0).astype(np.float32); ta = T.copy()
for _ in range(400):
    falta = mk == 0
    if not falta.any(): break
    sm = np.zeros_like(ta); cn = np.zeros_like(mk)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sm += np.roll(np.roll(ta * mk[..., None], dy, 0), dx, 1); cn += np.roll(np.roll(mk, dy, 0), dx, 1)
    fill = falta & (cn > 0); ta[fill] = sm[fill] / cn[fill][:, None]; mk = np.maximum(mk, fill.astype(np.float32))
limpia = Image.fromarray(np.clip(ta * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))
lado = 512
limpia.resize((lado, lado), Image.LANCZOS).save(PK + '/t/%d.webp' % len(d['tx']), 'WEBP', quality=88, method=6)
if len(sys.argv) > 3: limpia.save(sys.argv[3])
# la malla en el formato del juego (posición en 16 bits, normal en 8, UV en medio float)
mn = V.min(0); sc = np.maximum(V.max(0) - mn, 1e-6)
q = np.round((V - mn) / sc * 65535).astype('<u2'); nb = np.clip(np.round(N * 127), -127, 127).astype(np.int8)
uv = np.stack([UV[:, 0], 1 - UV[:, 1]], 1).astype('<f2')
vb = np.zeros((len(V), 14), np.uint8); vb[:, 0:6] = q.view(np.uint8).reshape(-1, 6); vb[:, 6:9] = nb.view(np.uint8).reshape(-1, 3); vb[:, 10:14] = uv.view(np.uint8).reshape(-1, 4)
i32 = len(V) > 65535
o_v = agregar(vb.tobytes()); o_i = agregar(IDX.astype('<u4' if i32 else '<u2').tobytes())
d['ms'].append({'n': 'Verity', 'o': o_v, 'v': len(V), 'mn': mn.tolist(), 'sc': sc.tolist(), 'i': o_i, 'i32': bool(i32), 'sub': [[0, len(IDX) * 3]], 'rf': round(float(rad[adelante].max()), 4)})
ti = len(d['tx']); d['tx'].append({'n': 'Verity', 'a': 0, 'w': lado, 'h': lado})
cone = d['pf'][next(k for k in d['pf'] if k.split('#')[0] == 'Cone')][0]
mt = json.loads(json.dumps(d['mt'][cone['mt'][0]] if 'mt' in cone else d['mt'][0])); mt['n'] = 'RB_Verity'; mt['t'] = ti; mt['c'] = [1, 1, 1, 1]
if 'tt' in mt: mt['tt']['_MainTex'] = [ti, 1.0, 1.0, 0.0, 0.0]
d['mt'].append(mt)
open(PK + '/m.bin.gz', 'wb').write(gzip.compress(bytes(BIN), 6))
open(PK + '/d.json.gz', 'wb').write(gzip.compress(json.dumps(d, separators=(',', ':')).encode(), 6))
print('Verity en el paquete: malla', len(d['ms']) - 1, 'textura', ti, 'material', len(d['mt']) - 1)
