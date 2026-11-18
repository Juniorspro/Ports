# Montaje de imagen del analog horror de Pepe: copia los cuadros del grabador y les aplica los screamers (cara de Pepe
# deformada, congelada en rojo), los desgarros de cinta en los cortes, el negro con ojos y la estática.
# uso: python3 -I cuadros.py ENTRADA SALIDA
import sys, os, shutil, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ENT, SAL = sys.argv[1], sys.argv[2]
os.makedirs(SAL, exist_ok=True)
W, H, FPS, N = 720, 540, 30, 4500
rng = np.random.default_rng(1047)

def carga(n):
    return np.asarray(Image.open(f'{ENT}/{n:05d}.jpg').convert('RGB'), dtype=np.float32)

def guarda(n, a):
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(f'{SAL}/{n:05d}.jpg', quality=93)

def lum(a):
    return a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11

# ---------------- efectos ----------------
def desgarro(a, k, r):
    """la cinta que se rompe: franjas corridas, colores separados, ruido, rayas blancas y la imagen que rueda"""
    o = a.copy()
    for _ in range(int(3 + k * 16)):
        y0 = int(r.integers(0, H)); h = int(r.integers(2, int(8 + k * 46))); dx = int(r.normal(0, k * 95))
        o[y0:y0 + h] = np.roll(o[y0:y0 + h], dx, axis=1)
    s = int(round(k * 14))
    if s:
        o[..., 0] = np.roll(o[..., 0], s, axis=1); o[..., 2] = np.roll(o[..., 2], -s, axis=1)
    o += r.normal(0, k * 50, o.shape).astype(np.float32)
    for _ in range(int(k * 7)):
        y = int(r.integers(0, H)); o[y:y + int(r.integers(1, 3))] = 255 * r.uniform(0.6, 1.0)
    if k > 0.6 and r.random() < 0.5:
        o = np.roll(o, int(r.uniform(-0.35, 0.35) * H), axis=0)
    return o

def arcoiris(a, k, r):
    """quemado y arcoíris: la imagen sobreexpuesta con los canales corridos y franjas estiradas"""
    o = a * (1 + 1.6 * k) + 50 * k
    s = int(k * 34)
    o[..., 0] = np.roll(o[..., 0], s, axis=1); o[..., 2] = np.roll(o[..., 2], -s, axis=1); o[..., 1] = np.roll(o[..., 1], s // 3, axis=0)
    for _ in range(int(4 + 10 * k)):
        y0 = int(r.integers(0, H - 10)); h = int(r.integers(3, 24)); x0 = int(r.integers(0, W - 40))
        o[y0:y0 + h, x0:] = o[y0:y0 + h, x0:x0 + 1]   # (la línea estirada hacia la derecha: el borrón del VHS)
    return desgarro(o, 0.35 * k, r)

def estatica(r, k=1.0):
    """la nieve: ruido gris con grano horizontal, bandas oscuras"""
    g = r.normal(128, 70, (H, W // 2)).astype(np.float32)
    g = np.repeat(g, 2, axis=1)
    for _ in range(3):
        y0 = int(r.integers(0, H)); g[y0:y0 + int(r.integers(10, 60))] *= r.uniform(0.3, 0.7)
    o = np.stack([g, g, g], -1) * k
    return o

def negro(r, k=0.25):
    o = np.zeros((H, W, 3), np.float32) + r.normal(10, 9 * k * 4, (H, W, 1)).astype(np.float32)
    return o

def ojos(r, fase=0.0):
    """negro con ojos: dos ojos blancos que brillan en la oscuridad, con pupilas chiquitas"""
    im = Image.new('RGB', (W, H), (4, 4, 4)); d = ImageDraw.Draw(im)
    cx, cy, sep = 360 + int(r.normal(0, 2)), 262, 64
    for i, sx in enumerate((-1, 1)):
        x = cx + sx * sep; y = cy + (3 if i else 0)
        d.ellipse([x - 25, y - 11, x + 25, y + 11], fill=(235, 235, 225))
    gl = im.filter(ImageFilter.GaussianBlur(14))
    im = Image.blend(im, gl, 0.45); d = ImageDraw.Draw(im)
    for i, sx in enumerate((-1, 1)):
        x = cx + sx * sep + 4; y = cy + (3 if i else 0)
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(0, 0, 0))
    o = np.asarray(im, dtype=np.float32) * (0.9 + 0.1 * math.sin(fase * 9))
    return desgarro(o, 0.12, r)

def deformar(a, ojos_, boca, alto, r, u):
    """la cara de Pepe deformada con sus propios píxeles (nada dibujado encima): se acerca a la cara, los ojos se agrandan y
    se derriten hacia abajo, la abertura de los labios se estira hasta ser una boca larga, la cara se tuerce; lo que se
    estira se oscurece (queda hueco) y todo pasa a rojo con mucho contraste. u: el tiempo del susto (la deformación late)"""
    (ex1, ey1), (ex2, ey2) = ojos_; mx, my = boca
    cx, cy = (ex1 + ex2) / 2, (ey1 + ey2) / 2 + alto * 0.18
    late = 0.85 + 0.15 * math.sin(u * 19)
    esc = (alto * 1.5) / H * (1 - 0.05 * math.sin(u * 23))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    sx = cx + (xx - W / 2) * esc + float(r.normal(0, 1.0)); sy = cy + (yy - H / 2) * esc + float(r.normal(0, 1.0))
    est = np.zeros((H, W), np.float32)   # (cuánto se estiró cada punto: para ahuecarlo)
    # la cara apenas retorcida alrededor de la nariz
    dx, dy = sx - cx, sy - cy; d = np.sqrt(dx * dx + dy * dy); R = alto * 0.9
    th = 0.32 * late * np.clip(1 - d / R, 0, 1) ** 2
    c_, s_ = np.cos(th), np.sin(th); sx, sy = cx + dx * c_ - dy * s_, cy + dx * s_ + dy * c_
    re = alto * 0.11
    for ex, ey in ((ex1, ey1), (ex2, ey2)):
        # los ojos más grandes (lo de cerca del centro sale de más cerca)
        dx, dy = sx - ex, sy - ey; d = np.sqrt(dx * dx + dy * dy) + 1e-3
        f = np.where(d < re * 1.6, (d / (re * 1.6)) ** (0.55 / late), 1.0); est += (1 - f) * 0.9
        sx = ex + dx * f; sy = ey + dy * f
        # y derretidos hacia abajo: debajo del ojo se repite el ojo, cada vez más estirado
        gx = np.exp(-((sx - ex) / (re * 1.1)) ** 2); baja = np.clip((sy - ey) / (alto * 0.45), 0, 1)
        k = gx * np.where(sy > ey, 1 - baja * 0.35, 0) * 0.62 * late
        sy = sy - (sy - ey) * k; est += k * 0.8
    # la boca: la abertura de los labios estirada hacia abajo y a lo ancho (la línea oscura se vuelve una boca abierta)
    mw = alto * 0.2; gx = np.exp(-((sx - mx) / mw) ** 2)
    # (sin bordes: entra y sale suave arriba y abajo de la boca)
    ss = lambda a_, b_, v: np.clip((v - a_) / (b_ - a_), 0, 1) ** 2 * (3 - 2 * np.clip((v - a_) / (b_ - a_), 0, 1))
    dy_ = sy - my
    k = gx * ss(-alto * 0.06, alto * 0.04, dy_) * (1 - ss(alto * 0.45, alto * 1.0, dy_)) * 0.7 * late
    sy = sy - dy_ * k; sx = sx - (sx - mx) * k * 0.35; est += k * 1.1
    xi = np.clip(sx, 0, W - 1).astype(np.int32); yi = np.clip(sy, 0, H - 1).astype(np.int32)
    o = a[yi, xi]
    # rojo con contraste (lo estirado, más oscuro: hueco), viñeta, líneas y ruido
    L = lum(o) / 255.0; L = L / max(0.25, float(np.percentile(L, 97)))
    L = L * np.clip(1 - 0.55 * est, 0.05, 1)
    L = np.clip((L ** 0.9 - 0.42) * 2.1 + 0.42, 0, 1)
    v = 1 - 0.55 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    Rr = 255 * L * np.clip(v, 0.15, 1) * 1.22
    o = np.stack([Rr, Rr * 0.09, Rr * 0.07], -1)
    o[::2] *= 0.82
    o += r.normal(0, 16, o.shape).astype(np.float32)
    return o

# ---------------- las caras de la parte 2 (ojos izq./der., boca, alto de la cabeza) ----------------
CARA_F = dict(n=3150, ojos=((240, 150), (300, 190)), boca=(285, 285), alto=230)   # Pepe mirando la cámara que levantó (f10)
CARA_L = dict(n=2304, ojos=((308, 236), (338, 234)), boca=(322, 272), alto=100)   # Lucas, el búho (f6)
CARA_9 = dict(n=2964, ojos=((255, 80), (290, 85)), boca=(270, 130), alto=120)     # Pepe antes del golpe (f9)
CARA_12 = dict(n=3630, ojos=((300, 105), (330, 105)), boca=(315, 150), alto=120)  # el último apagón (f12)
CARA_N10 = dict(n=3162, ojos=((300, 197), (372, 235)), boca=(312, 398), alto=240)  # Pepe en el pasto, mirando la cámara (f10 nueva)
# (las tomas de la huida se grabaron de nuevo afuera: las caras de los sustos que ya estaban marcadas salen de los cuadros
# viejos, guardados en caras/viejo_NNNNN.jpg)
CARAS = os.environ.get('CARAS') or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'caras')
_cache = {}
def susto(c, u):
    if c['n'] not in _cache:
        v = os.path.join(CARAS, f"viejo_{c['n']:05d}.jpg")
        _cache[c['n']] = np.asarray(Image.open(v).convert('RGB'), dtype=np.float32) if c is not CARA_N10 and os.path.exists(v) else carga(c['n'])
    return deformar(_cache[c['n']], c['ojos'], c['boca'], c['alto'], rng, u)

PLAN = {}
def pon(a, b, f):
    for n in range(a, b + 1): PLAN[n] = f
T = lambda t: int(round(t * FPS))
# los cortes de cinta (los primeros cuadros de cada toma, tapados: ahí los NPC todavía se materializan)
CORTES = [7.0, 33.0, 38.0, 45.0, 52.0, 59.0, 64.0, 66.0, 73.0, 80.0, 87.0, 94.0, 101.0, 108.0, 115.0, 122.0, 128.0, 147.0]
SUAVES = [13.0, 19.0, 26.0, 134.0, 141.0]
for c in CORTES:
    n0 = T(c)
    for i, k in zip(range(n0 - 2, n0 + 6), (0.35, 0.8, 1.0, 0.9, 0.75, 0.6, 0.45, 0.25)):
        src_ = n0 + 6 if n0 <= i < n0 + 6 else i
        PLAN[i] = (lambda n, s=src_, k=k: desgarro(carga(s), k, rng))
for c in SUAVES:
    n0 = T(c)
    for i, k in zip(range(n0, n0 + 6), (0.3, 0.25, 0.2, 0.15, 0.1, 0.05)):
        PLAN[i] = (lambda n, s=n0 + 6, k=k: desgarro(carga(s), k, rng))
# S1 · el final del instructivo: la cara de Pepe (la que va a mirar la cámara) congelada en rojo
pon(T(32.35), T(32.98), lambda n: susto(CARA_F, (n - T(32.35)) / FPS))
for n in (T(32.62), T(32.65)): PLAN[n] = lambda n: 255 - susto(CARA_F, 0.3)
# el corte: estática, la cara de Lucas metida, negro con ojos
def g_ini(n):
    u = (n - T(33.0)) / FPS
    if n in (T(33.3), T(33.33), T(35.4), T(35.43)): return arcoiris(susto(CARA_L, u), 0.7, rng)
    if T(35.55) <= n <= T(35.62): return ojos(rng, n)
    if T(33.8) <= n < T(34.3) or T(34.7) <= n < T(35.2): return desgarro(np.maximum(carga(n), susto(CARA_F, 0.1) * 0.3), 0.3, rng)
    if n >= T(36.0): return carga(n)
    return estatica(rng, 0.8) if (n // 2) % 3 else desgarro(carga(n), 1.0, rng)
pon(T(33.0) + 6, T(37.98), g_ini)
# f4 · Pepe desaparece del fondo del pasillo (el corte de las 64.0 ya está en CORTES)
# S3 · Lucas, el búho: su cara en rojo
pon(T(78.35), T(78.62), lambda n: susto(CARA_L, (n - T(78.35)) / FPS))
pon(T(78.65), T(78.75), lambda n: desgarro(carga(n), 0.9, rng))
# f7 · cuando mira atrás: un cuadro de la cara de Lucas en arcoíris
pon(T(83.0), T(83.05), lambda n: arcoiris(susto(CARA_L, 0.2), 0.6, rng))
# S4 · Pepe pegado: rojo y deformado; el golpe
pon(T(98.95), T(99.27), lambda n: susto(CARA_9, (n - T(98.95)) / FPS))
pon(T(99.4), T(99.9), lambda n: desgarro(carga(n), 0.9 - (n - T(99.4)) / FPS, rng))
# f10 · la mirada: dos parpadeos de la cara deformada en rojo
for a in (105.9, 107.2): pon(T(a), T(a) + 2, lambda n: susto(CARA_N10, 0.4))
# f12 · en un apagón, los ojos; al final, la cara en rojo
pon(T(117.75), T(117.85), lambda n: ojos(rng, n))
pon(T(120.9), T(121.3), lambda n: susto(CARA_12, (n - T(120.9)) / FPS))
# la batería: la imagen se rompe; «SIN SEÑAL» con estática
pon(T(124.6), T(125.25), lambda n: desgarro(carga(n), 0.6 + (n - T(124.6)) * 0.03, rng))
pon(T(126.8), T(127.9), lambda n: estatica(rng, 0.7) if n % 3 else negro(rng))
# el final: «CINTA 4» con la cara y corte en seco
pon(T(149.45), T(149.48), lambda n: ojos(rng, n))
pon(T(149.62), T(149.97), lambda n: desgarro(susto(CARA_F, 0.5), 0.5, rng))

hechos = 0
for n in range(N):
    if n in PLAN:
        guarda(n, PLAN[n](n)); hechos += 1
    else:
        shutil.copyfile(f'{ENT}/{n:05d}.jpg', f'{SAL}/{n:05d}.jpg')
print('cuadros', N, 'con efecto', hechos)
