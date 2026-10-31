# Repinta una zona de la textura de un GLB generado proyectando de frente la imagen de la que salió (cuando el modelo 3D
# deja la cara borroneada: Uncle Jeppy tenía manchas negras en vez de los ojos cerrados, la nariz y la sonrisa).
# La imagen se alinea con el modelo por la silueta de esa zona (todo lo que está por encima de la altura Y0, en fracción
# del alto) y se pinta sólo en los triángulos que miran al frente (normal hacia +Z más que MINZ).
# Las manchas que el modelo 3D dejó en relieve (bultos donde estaban) se aplanan contra el plano de la cara.
# (--sin-aplanar: para una cabeza redonda, que no es un disco; sólo se repinta)
# Uso: python3 -I cara_glb.py GLB IMAGEN.png Y0 SALIDA.glb [MINZ=0.35] [--sin-aplanar]   → el GLB con la cara aplanada y repintada
import sys, io, os, numpy as np
APLANAR = '--sin-aplanar' not in sys.argv
if not APLANAR: sys.argv.remove('--sin-aplanar')
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glb
GLB, IMG, Y0, OUT = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
MINZ = float(sys.argv[5]) if len(sys.argv) > 5 else 0.35
J, B = glb.leer(GLB); pr = J['meshes'][0]['primitives'][0]; A = pr['attributes']
V = glb.acc(J, B, A['POSITION']).astype(np.float64); UV = glb.acc(J, B, A['TEXCOORD_0']).astype(np.float64)
I = glb.acc(J, B, pr['indices']).astype(np.int64).reshape(-1, 3)
mat = J['materials'][pr.get('material', 0)]; tx = J['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]
img = J['images'][tx['source']]; bv = J['bufferViews'][img['bufferView']]
TEX = np.asarray(Image.open(io.BytesIO(bytes(B[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]))).convert('RGB')).copy()
th, tw = TEX.shape[:2]
FOTO = np.asarray(Image.open(IMG).convert('RGB')).astype(np.float64); fh, fw = FOTO.shape[:2]
# silueta de la imagen: lo que no es el fondo gris claro parejo
fondo = np.median(np.concatenate([FOTO[:8].reshape(-1, 3), FOTO[-8:].reshape(-1, 3)]), 0)
masc = np.abs(FOTO - fondo).sum(2) > 40
ys, xs = np.nonzero(masc); iy0, iy1, ix0, ix1 = ys.min(), ys.max(), xs.min(), xs.max()
y0m, y1m = V[:, 1].min(), V[:, 1].max(); x0m, x1m = V[:, 0].min(), V[:, 0].max()
# 1) alineación por la silueta entera; 2) se ajusta con la de la zona (por encima de Y0)
def a_imagen(x, y, al):
    sx, ox, sy, oy = al; return ox + x * sx, oy - y * sy
al = ((ix1 - ix0) / (x1m - x0m), ix0 - x0m * (ix1 - ix0) / (x1m - x0m), (iy1 - iy0) / (y1m - y0m), iy1 + y0m * (iy1 - iy0) / (y1m - y0m))
yc = y0m + (y1m - y0m) * Y0
zona = V[:, 1] > yc
for _ in range(3):
    _, fila = a_imagen(0, yc, al); fila = int(round(fila))
    zy, zx = np.nonzero(masc[:max(fila, 1)])
    zx0, zx1, zy0 = zx.min(), zx.max(), zy.min()
    mx0, mx1, my1 = V[zona, 0].min(), V[zona, 0].max(), V[zona, 1].max()
    sx = (zx1 - zx0) / (mx1 - mx0); sy = sx * al[2] / al[0]   # (la misma proporción que la silueta entera)
    ox = zx0 - mx0 * sx; oy = zy0 + my1 * sy
    al = (sx, ox, sy, oy)
# bultos de la cara: los vértices de la zona que salen por delante del plano de la cara (cerca del centro) vuelven a él
NV = glb.acc(J, B, A['NORMAL']).astype(np.float64)
cx = V[zona, 0].mean(); cyz = (V[zona, 1].min() + V[zona, 1].max()) / 2; rad = (V[zona, 0].max() - V[zona, 0].min()) / 2
cerca = zona & (np.hypot(V[:, 0] - cx, V[:, 1] - cyz) < rad * 0.65)
# la cara es un disco inclinado (mira hacia arriba): plano z = a·x + b·y + c ajustado a lo que mira al frente, sin los bultos
sel = cerca & (NV[:, 2] > 0.5)
for _ in range(4):
    M = np.c_[V[sel, 0], V[sel, 1], np.ones(sel.sum())]; coef = np.linalg.lstsq(M, V[sel, 2], rcond=None)[0]
    res = V[:, 2] - (V[:, 0] * coef[0] + V[:, 1] * coef[1] + coef[2])
    sel = cerca & (NV[:, 2] > 0.5) & (np.abs(res) < 0.006)
bulto = cerca & (res > -0.008) & (np.abs(res) > 0.0005) & APLANAR   # (bultos y hoyos de la cara de adelante; la de atrás está más lejos)
V[bulto, 2] -= res[bulto]
nz = np.array([-coef[0], -coef[1], 1.0]); NV[bulto] = nz / np.linalg.norm(nz)
zf = coef[2]
print('cara: plano z', round(zf, 4), '· vértices aplanados', int(bulto.sum()))
print('alineación', np.round(al, 2), 'zona', round(yc, 3), '..', round(my1, 3))
# triángulos de la zona que miran al frente
P = V[I]; n = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
sel = np.nonzero((P[:, :, 1].min(1) > yc) & (n[:, 2] > MINZ))[0]
pint = 0
for t in sel:
    a, b, c = I[t]; U = UV[[a, b, c]] * [tw, th]
    x0, x1 = int(max(0, np.floor(U[:, 0].min()))), int(min(tw - 1, np.ceil(U[:, 0].max()))); y0, y1 = int(max(0, np.floor(U[:, 1].min()))), int(min(th - 1, np.ceil(U[:, 1].max())))
    gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    d = (U[1, 1] - U[2, 1]) * (U[0, 0] - U[2, 0]) + (U[2, 0] - U[1, 0]) * (U[0, 1] - U[2, 1])
    if abs(d) < 1e-12: continue
    l0 = ((U[1, 1] - U[2, 1]) * (gx - U[2, 0]) + (U[2, 0] - U[1, 0]) * (gy - U[2, 1])) / d
    l1 = ((U[2, 1] - U[0, 1]) * (gx - U[2, 0]) + (U[0, 0] - U[2, 0]) * (gy - U[2, 1])) / d; l2 = 1 - l0 - l1
    m = (l0 >= -0.02) & (l1 >= -0.02) & (l2 >= -0.02)
    if not m.any(): continue
    X = l0 * V[a, 0] + l1 * V[b, 0] + l2 * V[c, 0]; Y = l0 * V[a, 1] + l1 * V[b, 1] + l2 * V[c, 1]
    px, py = a_imagen(X, Y, al)
    px = np.clip(px, 0, fw - 1); py = np.clip(py, 0, fh - 1)
    col = FOTO[py.astype(int), px.astype(int)]
    TEX[(gy - 0.5).astype(int)[m], (gx - 0.5).astype(int)[m]] = col[m].astype(np.uint8); pint += int(m.sum())
print('triángulos', len(sel), 'píxeles pintados', pint)
# GLB nuevo: posiciones y normales en su lugar (mismo tamaño) y la textura nueva agregada al final del búfer
import json, struct
Bm = bytearray(B)
def poner(acc_i, arr):
    ac = J['accessors'][acc_i]; bvw = J['bufferViews'][ac['bufferView']]; o = bvw.get('byteOffset', 0) + ac.get('byteOffset', 0)
    st = bvw.get('byteStride', 12); a = arr.astype('<f4')
    for k in range(len(a)): Bm[o + k * st:o + k * st + 12] = a[k].tobytes()
poner(A['POSITION'], V); poner(A['NORMAL'], NV)
ac = J['accessors'][A['POSITION']]; ac['min'] = V.min(0).tolist(); ac['max'] = V.max(0).tolist()
png = io.BytesIO(); Image.fromarray(TEX).save(png, 'PNG'); png = png.getvalue()
while len(Bm) % 4: Bm.append(0)
J['bufferViews'].append({'buffer': 0, 'byteOffset': len(Bm), 'byteLength': len(png)}); Bm += png
while len(Bm) % 4: Bm.append(0)
img['bufferView'] = len(J['bufferViews']) - 1; img['mimeType'] = 'image/png'; J['buffers'][0]['byteLength'] = len(Bm)
js = json.dumps(J, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
with open(OUT, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(Bm)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(Bm), 0x004E4942)); f.write(bytes(Bm))
print('escrito', OUT)
