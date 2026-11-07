# placa final (37,5–40,0 s, 60 cuadros, 1440×1080): en el golpe de la canción (37,5) entran de golpe el logo JXM y
# «BETA LANZADA» (tipografía del juego, Oswald) con destello cian, falla de señal y separación de color; quedan con un
# resplandor que respira, un brillo que cruza las letras y un acercamiento lento; en 39,6 se rompen en tiras a negro.
# Uso: python3 placa_final.py [ancho alto]   → vid2/p10_placa.mp4
import numpy as np, subprocess, os, sys
from PIL import Image, ImageFilter
AQUI = os.path.dirname(os.path.abspath(__file__))
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (1440, 1080)
FPS, NF = 24, 60
KX = W / 1920
def cargar_alfa(ruta, umbral=None):
    im = Image.open(ruta).convert('RGBA'); L = np.asarray(im).astype(np.float32) / 255
    if umbral is None: a = L[..., 3]
    else:
        lum = L[..., :3] @ np.array([0.3, 0.59, 0.11], np.float32); a = np.clip((lum - umbral) / 0.22, 0, 1) * L[..., 3]
        a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32) / 255
    bb = Image.fromarray((a * 255).astype(np.uint8)).getbbox(); a = a[bb[1]:bb[3], bb[0]:bb[2]]
    return a
logo = cargar_alfa(os.path.join(AQUI, '..', '..', 'juego', 'logo_jxm.webp'), 0.38)
beta = cargar_alfa(os.path.join(AQUI, 'placa', 'beta.png'))
sub = cargar_alfa(os.path.join(AQUI, 'placa', 'sub.png'))
def a_ancho(a, w):
    h = max(1, int(round(a.shape[0] * w / a.shape[1])))
    return np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((int(w), h), Image.LANCZOS)).astype(np.float32) / 255
# el diseño en reposo (escala 1): logo arriba, BETA LANZADA grande, JXMOD 3.0 chico abajo
lienzo = np.zeros((H, W), np.float32); capas = []
def poner(a, cx, cy, tono):
    h, w = a.shape; y0, x0 = int(cy - h / 2), int(cx - w / 2)
    capas.append((a, x0, y0, tono))
poner(a_ancho(logo, W * 0.40), W / 2, H * 0.36, 'logo')
poner(a_ancho(beta, W * 0.66), W / 2, H * 0.60, 'beta')
poner(a_ancho(sub, W * 0.20), W / 2, H * 0.72, 'sub')
def base_img():
    A = np.zeros((H, W), np.float32); C = np.zeros((H, W, 3), np.float32)
    for a, x0, y0, tono in capas:
        h, w = a.shape; yy = np.linspace(0, 1, h, dtype=np.float32)[:, None]
        if tono == 'logo': col = np.stack([0.80 - 0.10 * yy, 0.84 - 0.06 * yy, 0.90 + 0 * yy], -1)
        elif tono == 'beta': col = np.stack([0.95 - 0.12 * yy, 0.97 - 0.08 * yy, 1.0 + 0 * yy], -1)
        else: col = np.stack([0.55 + 0 * yy, 0.75 + 0 * yy, 0.95 + 0 * yy], -1) * 0.85
        col = np.broadcast_to(col, (h, w, 3))
        A[y0:y0 + h, x0:x0 + w] = np.maximum(A[y0:y0 + h, x0:x0 + w], a)
        C[y0:y0 + h, x0:x0 + w] = C[y0:y0 + h, x0:x0 + w] * (1 - a[..., None]) + col * a[..., None]
    return A, C
A0, C0 = base_img()
def desenfocar(a, r): return np.asarray(Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255
HALO1, HALO2 = desenfocar(A0, 14), desenfocar(A0, 52)
def escalar(img, k):
    # acercamiento centrado (k ≥ 1): recorta el centro y lo agranda
    if abs(k - 1) < 1e-4: return img
    h, w = img.shape[:2]; ch, cw = int(h / k), int(w / k); y0, x0 = (h - ch) // 2, (w - cw) // 2
    sub_ = img[y0:y0 + ch, x0:x0 + cw]
    if sub_.ndim == 2: return np.asarray(Image.fromarray((np.clip(sub_, 0, 1) * 65535).astype(np.uint16)).resize((w, h), Image.BICUBIC)).astype(np.float32) / 65535
    return np.stack([escalar(sub_[..., c], 1) if False else np.asarray(Image.fromarray((np.clip(sub_[..., c], 0, 1) * 65535).astype(np.uint16)).resize((w, h), Image.BICUBIC)).astype(np.float32) / 65535 for c in range(3)], -1)
rng = np.random.default_rng(7)
def golpe(t, t0, d): x = (t - t0) / d; return 0.0 if x < 0 else float(np.exp(-x))
def cuadro(i):
    t = i / FPS
    # entrada con golpe: de 1,10 a 1,0 en 0,25 s (frena), después el acercamiento lento
    k = 1.0 + 0.10 * (1 - min(1, t / 0.25)) ** 3 + 0.028 * min(1, t / 2.4)
    A, Cc = escalar(A0, k), escalar(C0, k)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # brillo que cruza las letras (0,55–1,45 s)
    u = (t - 0.55) / 0.9
    if 0 <= u <= 1.25:
        pos = -0.15 * W + u * 1.3 * W; d = (xx + 0.4 * (yy - H / 2)) - pos
        Cc = Cc + (np.exp(-d * d / (2 * (0.03 * W) ** 2)) * 0.85)[..., None] * np.array([0.7, 0.9, 1.0], np.float32) * A[..., None]
    img = Cc * A[..., None]
    # resplandor cian que respira, más fuerte en los golpes (37,5 y 38,0)
    g = 0.42 + 1.8 * golpe(t, 0.0, 0.16) + 0.55 * golpe(t, 0.5, 0.14) + 0.06 * np.sin(t * 9.0)
    halo = (escalar(HALO1, k) * 0.9 + escalar(HALO2, k) * 0.75)[..., None] * np.array([0.22, 0.6, 1.0], np.float32) * g
    img = img + halo * (1 - A[..., None] * 0.6)
    # un velo azul muy suave de fondo (no negro plano) y el destello del golpe
    img += np.array([0.010, 0.016, 0.030], np.float32) * (1 - np.clip(((xx - W / 2) ** 2 + (yy - H / 2) ** 2) / (0.6 * W) ** 2, 0, 1))[..., None]
    img += np.array([0.55, 0.78, 1.0], np.float32) * 1.0 * golpe(t, 0.0, 0.06)
    # fallas: en el golpe, en 38,0 y al romperse (2,1–2,5)
    fal = max(golpe(t, 0.0, 0.10), 0.6 * golpe(t, 0.5, 0.06), np.clip((t - 2.1) / 0.3, 0, 1))
    if fal > 0.04:
        out = img.copy(); n = int(5 + 34 * fal)
        for _ in range(n):
            yA = rng.integers(0, H - 8); hh = int(rng.integers(3, 30 + int(90 * fal))); dx = int(rng.normal(0, (70 * fal + 4) * KX))
            out[yA:yA + hh] = np.roll(img[yA:yA + hh], dx, axis=1)
        s = int((3 + 26 * fal) * KX)
        out[..., 0] = np.roll(out[..., 0], s, axis=1); out[..., 2] = np.roll(out[..., 2], -s, axis=1)
        img = out
    if t > 2.1: img *= (1 - np.clip((t - 2.1) / 0.36, 0, 1)) ** 1.6
    img *= 0.97 + 0.03 * np.sin(t * 57)
    img += rng.normal(0, 0.011, (H, W, 1)).astype(np.float32)
    return np.clip(img, 0, 1)
os.makedirs(os.path.join(AQUI, 'vid2'), exist_ok=True); os.makedirs(os.path.join(AQUI, 'prev'), exist_ok=True)
out = os.path.join(AQUI, 'vid2', 'p10_placa.mp4')
f = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv444p', out], stdin=subprocess.PIPE)
for i in range(NF):
    fr = (cuadro(i) * 255 + 0.5).astype(np.uint8); f.stdin.write(fr.tobytes())
    if i in (0, 2, 6, 18, 40, 55): Image.fromarray(fr).resize((W // 2, H // 2)).save(os.path.join(AQUI, 'prev', f'placa_{i:02d}.jpg'), quality=88)
f.stdin.close(); f.wait(); print('placa lista', out)
