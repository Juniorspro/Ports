import sys, glob, os
from PIL import Image, ImageDraw
d = sys.argv[1]; cols = int(sys.argv[2]) if len(sys.argv) > 2 else 3; esc = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
fs = sorted(glob.glob(os.path.join(d, 'f_*.jpg')), key=lambda f: float(os.path.basename(f)[2:-4]))
ims = [Image.open(f) for f in fs]
W, H = ims[0].size; W2, H2 = int(W * esc), int(H * esc); rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (W2 * cols, H2 * rows)); dr = ImageDraw.Draw(S)
for i, (f, im) in enumerate(zip(fs, ims)):
    x, y = (i % cols) * W2, (i // cols) * H2; S.paste(im.resize((W2, H2)), (x, y)); dr.text((x + 8, y + 6), os.path.basename(f)[2:-4], fill=(255, 255, 0))
S.save(os.path.join(d, 'hoja.jpg'), quality=85); print(S.size)
