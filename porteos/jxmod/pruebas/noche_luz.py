# mide las fotos de noche_luz.mjs: luminancia (0-255) del centro (un círculo de 18 % del alto) y de toda la imagen sin bordes
import sys, glob, os, numpy as np
from PIL import Image
D = sys.argv[1]
def lum(f):
    a = np.asarray(Image.open(f).convert('RGB'), float); h, w = a.shape[:2]
    y = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    yy, xx = np.mgrid[:h, :w]; c = (yy - h / 2) ** 2 + (xx - w / 2) ** 2 < (0.18 * h) ** 2
    m = y[int(h * 0.12):int(h * 0.88), int(w * 0.1):int(w * 0.9)]
    return y[c].mean(), m.mean()
filas = {}
for f in sorted(glob.glob(os.path.join(D, 'luz_*_no.png'))):
    cal, lugar = os.path.basename(f)[4:-7].split('_')
    c0, t0 = lum(f); c1, t1 = lum(f[:-6] + 'si.png')
    print('%-7s %-8s sin linterna: centro %5.1f todo %5.1f · con linterna: centro %5.1f todo %5.1f · centro x%.1f' % (cal, lugar, c0, t0, c1, t1, c1 / max(c0, 0.5)))
