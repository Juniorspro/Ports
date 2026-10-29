# portada: achica a 960x540, funde el final con el principio (bucle sin salto) y pone el logo con sombra
import sys, os
from PIL import Image, ImageFilter, ImageChops
src, dst, logo_p, N, F = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
W, H = 960, 540
os.makedirs(dst, exist_ok=True)
logo = Image.open(logo_p).convert('RGBA'); lw = 560; logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
lx, ly = (W - lw) // 2, 26
sombra = Image.new('RGBA', (W, H), (0, 0, 0, 0)); a = logo.split()[3]
s = Image.new('RGBA', logo.size, (8, 12, 30, 255)); s.putalpha(a.point(lambda v: int(v * 0.75)))
sombra.alpha_composite(s, (lx + 3, ly + 5)); sombra = sombra.filter(ImageFilter.GaussianBlur(7))
# un velo arriba para que el logo se lea sobre el cielo claro
velo = Image.new('RGBA', (W, H), (0, 0, 0, 0)); vp = velo.load()
for y in range(170):
    al = int(110 * (1 - y / 170) ** 1.6)
    for x in range(W): vp[x, y] = (10, 14, 32, al)
def cuadro(i): return Image.open(os.path.join(src, 'f%04d.jpg' % i)).convert('RGB').resize((W, H), Image.LANCZOS)
for i in range(N):
    im = cuadro(i)
    if i < F:  # el principio se funde con lo que sigue al final (mismo lugar de la cámara)
        im = Image.blend(cuadro(N + i), im, (i + 0.5) / F)
    im = im.convert('RGBA'); im.alpha_composite(velo); im.alpha_composite(sombra); im.alpha_composite(logo, (lx, ly))
    im.convert('RGB').save(os.path.join(dst, 'g%04d.png' % i))
print('listo', N)
