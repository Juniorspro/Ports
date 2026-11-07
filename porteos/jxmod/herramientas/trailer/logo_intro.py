# intro del logo (0–2,04 s, 49 cuadros, 1920×1080): el logo JXM recortado (sólo las letras, sin la placa oscura)
# aparece en el golpe de 0,09 s con un destello cian y una falla de señal, lo cruza un brillo, tiembla en 1,66 s y se
# rompe en tiras hasta el negro
import numpy as np, subprocess, os, sys
from PIL import Image, ImageFilter
AQUI = os.path.dirname(os.path.abspath(__file__))
W, H, FPS, NF = 1920, 1080, 24, 49
src = Image.open(os.path.join(AQUI, '..', '..', 'juego', 'logo_jxm.webp')).convert('RGBA')
L = np.asarray(src).astype(np.float32) / 255
lum = L[..., :3] @ np.array([0.3, 0.59, 0.11], np.float32)
alfa = np.clip((lum - 0.38) / 0.22, 0, 1) * L[..., 3]          # (las letras: lo claro; la placa y las siluetas, fuera)
alfa = np.asarray(Image.fromarray((alfa * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32) / 255
ancho = int(W * 0.56); alto = int(ancho * src.height / src.width)
def escalar(a, k):
    w, h = int(ancho * k), int(alto * k)
    return np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)).astype(np.float32) / 255
rng = np.random.default_rng(3)
def golpe(t, t0, d): x = (t - t0) / d; return 0.0 if x < 0 else float(np.exp(-x))
def cuadro(i):
    t = i / FPS
    img = np.zeros((H, W, 3), np.float32)
    if t < 0.085: return img
    k = 1.0 + 0.045 * min(1, (t - 0.09) / 1.9)
    a = escalar(alfa, k); h, w = a.shape
    y0, x0 = (H - h) // 2, (W - w) // 2
    # cuerpo de las letras: gris claro con un degradé frío, y un brillo que las cruza (0,45–1,25 s)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    base = np.stack([0.80 - 0.10 * yy / h, 0.84 - 0.06 * yy / h, 0.90 + 0.0 * yy], -1)
    u = (t - 0.45) / 0.8
    if 0 <= u <= 1.2:
        pos = -0.2 * w + u * 1.4 * w; d = (xx + 0.45 * (yy - h / 2)) - pos
        base = base + (np.exp(-d * d / (2 * (0.035 * w) ** 2)) * 0.9)[..., None] * np.array([0.7, 0.9, 1.0], np.float32)
    capa = base * a[..., None]
    # resplandor cian detrás (más fuerte en los golpes)
    g = 0.35 + 1.6 * golpe(t, 0.09, 0.18) + 0.9 * golpe(t, 1.66, 0.12) + 0.08 * np.sin(t * 37)
    halo = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(18))).astype(np.float32) / 255
    halo2 = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(60))).astype(np.float32) / 255
    glow = (halo * 0.9 + halo2 * 0.7)[..., None] * np.array([0.25, 0.65, 1.0], np.float32) * g
    img[y0:y0 + h, x0:x0 + w] += capa + glow * (1 - a[..., None] * 0.6)
    # destello del golpe (todo el cuadro un instante)
    img += np.array([0.5, 0.75, 1.0], np.float32) * 0.85 * golpe(t, 0.09, 0.05)
    # fallas de señal: en el golpe, en 1,66 y al romperse (1,86–2,04)
    fal = max(golpe(t, 0.09, 0.12), golpe(t, 1.66, 0.09), np.clip((t - 1.86) / 0.18, 0, 1))
    if fal > 0.05:
        out = img.copy(); n = int(6 + 30 * fal)
        for _ in range(n):
            yA = rng.integers(0, H - 8); hh = int(rng.integers(4, 40 + int(80 * fal))); dx = int(rng.normal(0, 60 * fal + 5))
            out[yA:yA + hh] = np.roll(img[yA:yA + hh], dx, axis=1)
        # separación de color
        s = int(4 + 22 * fal)
        out[..., 0] = np.roll(out[..., 0], s, axis=1); out[..., 2] = np.roll(out[..., 2], -s, axis=1)
        img = out
        if t > 1.86: img *= (1 - np.clip((t - 1.86) / 0.17, 0, 1)) ** 1.5
    # parpadeo leve y grano
    img *= 0.96 + 0.04 * np.sin(t * 61) * (t < 1.86)
    img += rng.normal(0, 0.012, (H, W, 1)).astype(np.float32)
    return np.clip(img, 0, 1)
os.makedirs(os.path.join(AQUI, 'vid'), exist_ok=True); out = os.path.join(AQUI, 'vid', 'p0_logo.mp4')
f = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv444p', out], stdin=subprocess.PIPE)
for i in range(NF):
    fr = (cuadro(i) * 255 + 0.5).astype(np.uint8); f.stdin.write(fr.tobytes())
    if i in (3, 20, 41): os.makedirs(os.path.join(AQUI, 'prev'), exist_ok=True); Image.fromarray(fr).resize((960, 540)).save(os.path.join(AQUI, 'prev', f'logo_{i}.jpg'), quality=88)
f.stdin.close(); f.wait(); print('logo listo', out)
