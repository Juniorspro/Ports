# hoja de contacto de las fotos de pruebas/bsmod.mjs (uso: SALIDA.jpg ANCHO_CELDA COLUMNAS foto1 foto2 ...)
import sys, os
from PIL import Image, ImageDraw
# uso: hoja.py SALIDA.jpg ancho_celda columnas img1 img2 ...
out, w, cols = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); fs = sys.argv[4:]
ims = [Image.open(f).convert('RGB') for f in fs]
h = int(w * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
H = Image.new('RGB', (cols * w, rows * (h + 18)), (20, 20, 20))
d = ImageDraw.Draw(H)
for i, (f, im) in enumerate(zip(fs, ims)):
    x, y = (i % cols) * w, (i // cols) * (h + 18)
    H.paste(im.resize((w, h)), (x, y + 18))
    d.text((x + 4, y + 3), os.path.basename(f)[:60], fill=(255, 255, 0))
H.save(out, quality=85)
print(out, H.size)
