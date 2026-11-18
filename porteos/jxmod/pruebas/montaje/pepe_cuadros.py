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
    """la cara de Pepe deformada y congelada en rojo: se acerca a la cara, los ojos se agrandan y quedan negros, la boca
    se estira hacia abajo, abierta y negra; todo en rojo con mucho contraste"""
    (ex1, ey1), (ex2, ey2) = ojos_; mx, my = boca
    cx, cy = (ex1 + ex2) / 2, (ey1 + ey2) / 2 + alto * 0.12
    # recorte alrededor de la cara (la cara ocupa ~70 % del alto), con un pulso de zoom
    esc = (alto * 1.55) / H * (1 - 0.05 * math.sin(u * 23))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    sx = cx + (xx - W / 2) * esc + r.normal(0, 1.2); sy = cy + (yy - H / 2) * esc + r.normal(0, 1.2)
    # ojos más grandes (lo de cerca del centro del ojo sale de más cerca: se agranda)
    re = alto * 0.16
    for ex, ey in ((ex1, ey1), (ex2, ey2)):
        dx, dy = sx - ex, sy - ey; d = np.sqrt(dx * dx + dy * dy) + 1e-3
        f = np.where(d < re, (d / re) ** 0.55, 1.0)
        sx = ex + dx * f; sy = ey + dy * f
    # la boca y la mandíbula estiradas hacia abajo (×2,3), con caída suave a los costados
    mw = alto * 0.34
    gx = np.exp(-((sx - mx) / mw) ** 2)
    abajo = np.clip((sy - my) / (alto * 1.2), 0, 1)
    sy = np.where(sy > my - alto * 0.05, sy - (sy - my) * 0.56 * gx * (1 - abajo * 0.5), sy)
    xi = np.clip(sx, 0, W - 1).astype(np.int32); yi = np.clip(sy, 0, H - 1).astype(np.int32)
    o = a[yi, xi]
    # pintar: los ojos negros (con un puntito blanco) y la boca abierta y negra, en el espacio de la salida
    im = Image.fromarray(np.clip(o, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(im)
    def aSal(px, py):
        return ((px - cx) / esc + W / 2, (py - cy) / esc + H / 2)
    def manchon(X, Y, ax, ay, jit, col, sesgo=0.0):
        # (una elipse con el borde irregular: rasgada, no de dibujo animado; ay hacia abajo puede ser más largo)
        pts = []
        for k in range(40):
            th = 2 * math.pi * k / 40; j = 1 + jit * math.sin(k * 2.7 + 1.3) * math.cos(k * 1.9) + jit * 0.5 * float(r.normal(0, 0.35))
            yy_ = math.sin(th); pts.append((X + ax * math.cos(th) * j, Y + ay * yy_ * j * (1 + sesgo * max(0, yy_))))
        d.polygon(pts, fill=col)
    for ex, ey in ((ex1, ey1), (ex2, ey2)):
        X, Y = aSal(ex, ey); rr = re / esc * 0.62
        manchon(X, Y + rr * 0.1, rr * 1.15, rr * 1.0, 0.12, (0, 0, 0), 0.5)
        d.ellipse([X - rr * 0.13 + 2, Y - rr * 0.13, X + rr * 0.13 + 2, Y + rr * 0.13], fill=(255, 255, 255))
    X, Y = aSal(mx, my); bw, bh = alto * 0.15 / esc, alto * 0.62 / esc
    cy_ = Y + bh * 0.4
    manchon(X, cy_, bw + 6, bh * 0.62 + 6, 0.1, (225, 205, 195), 0.25)   # (el borde pálido: labios y dientes)
    manchon(X, cy_, bw, bh * 0.6, 0.14, (0, 0, 0), 0.25)
    im = im.filter(ImageFilter.GaussianBlur(0.8))
    o = np.asarray(im, dtype=np.float32)
    # rojo con contraste, viñeta, líneas y ruido
    L = lum(o) / 255.0; L = L / max(0.25, float(np.percentile(L, 97))); L = np.clip((L ** 0.85 - 0.45) * 1.9 + 0.45, 0, 1)   # (normalizado: la cara oscura del atardecer también se ve)
    v = 1 - 0.55 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    R = 255 * L * np.clip(v, 0.15, 1) * 1.22
    o = np.stack([R, R * 0.09, R * 0.07], -1)
    o[::2] *= 0.82
    o += r.normal(0, 16, o.shape).astype(np.float32)
    return o

# ---------------- las caras (medidas en los cuadros: ojos izq./der., boca, alto de la cabeza) ----------------
CARA_T = dict(n=1121, ojos=((297, 229), (343, 229)), boca=(318, 289), alto=124)    # el zoom del instructivo
CARA_P = dict(n=3044, ojos=((60, 181), (125, 184)), boca=(90, 270), alto=178)      # pegado al lente
CARA_G = dict(n=3590, ojos=((248, 228), (285, 228)), boca=(267, 279), alto=110)    # antes del golpe
_cache = {}
def susto(c, u):
    if c['n'] not in _cache: _cache[c['n']] = carga(c['n'])
    return deformar(_cache[c['n']], c['ojos'], c['boca'], c['alto'], rng, u)

# ---------------- el plan cuadro por cuadro ----------------
PLAN = {}   # n -> función(n) -> imagen
def pon(a, b, f):
    for n in range(a, b + 1): PLAN[n] = f

T = lambda t: int(round(t * FPS))
# (cuadros blancos: Pepe todavía materializándose al empezar una escena)
for a, b, src in ((945, 948, 949), (4230, 4236, 4237)):
    pon(a, b, lambda n, s=src: carga(s))
# cortes de cinta en la grabación y al empezar/terminar las partes: desgarro que sube y baja
CORTES = [6.0, 41.4, 54.4, 57.5, 59.5, 61.4, 63.8, 66.4, 72.0, 78.0, 83.4, 90.4, 97.4, 104.4, 111.4, 118.4, 124.4, 132.0, 147.5]
for c in CORTES:
    n0 = T(c)
    for i, k in zip(range(n0 - 2, n0 + 4), (0.35, 0.8, 1.0, 0.9, 0.6, 0.3)):
        src = n0 + 3 if i < n0 + 3 and i >= n0 else i   # (los primeros cuadros de una toma: tapados con el siguiente)
        PLAN[i] = (lambda n, s=src, k=k: desgarro(carga(s), k, rng))
# S1 · el zoom a la cara en el instructivo: congelado en rojo y deformado (37,35–38,0), dos cuadros invertidos
pon(T(37.35), T(37.98), lambda n: susto(CARA_T, (n - T(37.35)) / FPS))
for n in (T(37.62), T(37.65)): PLAN[n] = lambda n: 255 - susto(CARA_T, 0.3)
# el corte: estática y desgarros con la cara metida, PEPE RECUERDA TODO con la cara atrás, la lista, negro
def g_ini(n):
    u = (n - T(38.0)) / FPS
    if n in (T(38.2), T(38.23), T(38.5), T(38.53)): return arcoiris(susto(CARA_T, u), 0.7, rng)
    return estatica(rng, 0.8) if (n // 2) % 3 else desgarro(carga(n), 1.0, rng)
pon(T(38.0), T(38.78), g_ini)
pon(T(38.8), T(39.18), lambda n: desgarro(np.maximum(carga(n), susto(CARA_T, 0.1) * 0.35), 0.3, rng))
pon(T(39.2), T(39.58), lambda n: negro(rng))
pon(T(39.6), T(39.78), lambda n: desgarro(carga(n), 0.25, rng))
def g_negro(n):
    o = negro(rng); y = int(((n - T(39.8)) * 7) % (H + 80)) - 40
    o[max(0, y):max(0, y + 26)] += 38   # (la franja clara que rueda)
    return desgarro(o, 0.15, rng) if n % 11 == 0 else o
pon(T(39.8), T(41.38), g_negro)
# la alerta: tres cuadros de negro con ojos en «Pepe está contando»; la cara en el «1.047»; estática al final
pon(T(67.5), T(67.57), lambda n: ojos(rng, n))
pon(T(68.9), T(69.02), lambda n: arcoiris(susto(CARA_G, 0.2), 0.5, rng))
pon(T(70.9), T(71.93), lambda n: estatica(rng) if n % 4 else desgarro(carga(n), 1.0, rng))
# S5 · pegado al lente: rojo y deformado seis cuadros, después la cinta se rompe
pon(T(101.07), T(101.24), lambda n: susto(CARA_P, (n - T(101.07)) / FPS))
pon(T(101.27), T(101.33), lambda n: desgarro(carga(n), 0.85, rng))
# S6 · el golpe: su cara en rojo deformada, el flash, la cámara al piso con la cinta destrozada
pon(T(120.27), T(120.47), lambda n: susto(CARA_G, (n - T(120.27)) / FPS))
pon(T(120.57), T(120.9), lambda n: desgarro(carga(n), 0.9 - (n - T(120.57)) / FPS, rng))
# la batería se muere: la imagen se rompe y se apaga
pon(T(130.45), T(130.68), lambda n: desgarro(carga(n), 0.6 + (n - T(130.45)) / FPS * 1.6, rng))
pon(T(131.6), T(131.98), lambda n: estatica(rng, 0.7))
# S7 · el final: negro con ojos, TE TOCA, la cara en rojo y corte en seco
pon(T(149.5), T(149.72), lambda n: ojos(rng, n))
pon(T(149.87), T(149.97), lambda n: desgarro(susto(CARA_T, 0.5), 0.5, rng))

hechos = 0
for n in range(N):
    if n in PLAN:
        guarda(n, PLAN[n](n)); hechos += 1
    else:
        shutil.copyfile(f'{ENT}/{n:05d}.jpg', f'{SAL}/{n:05d}.jpg')
print('cuadros', N, 'con efecto', hechos)
