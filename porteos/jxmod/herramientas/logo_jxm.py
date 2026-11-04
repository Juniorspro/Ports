# Logo JXM tal cual (letras, siluetas y su fondo gastado), recortado alrededor de las letras y con el borde que se funde
# a transparente: se ve igual que el original sobre cualquier fondo, sin recortes a mano de las siluetas.
import sys, numpy as np
from PIL import Image, ImageFilter
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB'); A = np.asarray(im).astype(np.float32); lum = A.mean(axis=2)
ys, xs = np.nonzero(lum > 150); bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
PX, PY = 46, 40
x0, x1, y0, y1 = max(0, bx0 - PX), min(A.shape[1], bx1 + PX), max(0, by0 - PY), min(A.shape[0], by1 + PY)
C = A[y0:y1, x0:x1]; H, W = C.shape[:2]
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
# distancia (en px) desde el rectángulo de las letras hacia afuera: 0 adentro; el borde se funde en ~PX px
dx = np.maximum(0, np.maximum((bx0 - x0) - xx, xx - (bx1 - x0 - 1))); dy = np.maximum(0, np.maximum((by0 - y0) - yy, yy - (by1 - y0 - 1)))
d = np.sqrt(dx * dx + dy * dy)
fade = np.clip(1 - d / (min(PX, PY) * 0.95), 0, 1); fade = fade * fade * (3 - 2 * fade)
alfa = np.maximum(fade * 0.94, np.clip((lum[y0:y1, x0:x1] - 60) / 60, 0, 1))
rgba = np.dstack([C, alfa * 255]).astype(np.uint8)
I = Image.fromarray(rgba, 'RGBA'); I.save(out)
print('ok', out, I.size)
