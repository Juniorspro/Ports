# Íconos del APK de JXMod sacados del logo original (letras JXM blancas con siluetas negras, fondo gris gastado).
# Uso: python3 -I herramientas/iconos_apk.py [LOGO.jpg] [CARPETA_RES] [HOJA.png]
#   mipmap-*/ic_launcher.png (cuadrado redondeado) e ic_launcher_round.png (círculo): letras al 80 % del ancho,
#     sobre el fondo gastado del original (lo que falta en los bordes se completa espejando el fondo)
#   mipmap-*/ic_launcher_foreground.png y ic_launcher_monochrome.png (ícono adaptable, lienzo de 108 dp): letras al
#     59 % del ancho y todas dentro del círculo seguro de 66 dp (se mide; si no entran, se achican)
#   drawable-nodpi/logo_inicio.png: el logo para el fondo de la ventana de arranque
#   HOJA.png (opcional): hoja para mirarlos todos juntos, con las máscaras de los lanzadores
import os, sys
import numpy as np
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
LOGO = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, '..', 'apk', 'logo_jxm_original.jpg')
RES = sys.argv[2] if len(sys.argv) > 2 else os.path.join(AQUI, '..', 'apk', 'res')
HOJA = sys.argv[3] if len(sys.argv) > 3 else None
DENS = [('mdpi', 1), ('hdpi', 1.5), ('xhdpi', 2), ('xxhdpi', 3), ('xxxhdpi', 4)]
BORDE = 16          # el original tiene una franja más oscura arriba (14 px): el borde no se usa como fondo
LEGADO = 0.80       # ancho de las letras / ancho del ícono viejo
ADAPT = 0.59        # ancho de las letras / 108 dp
SEGURO = 33.0       # radio del círculo seguro (dp)
INICIO = 560        # ancho de las letras en logo_inicio.png (px, sin escalar)

A = np.asarray(Image.open(LOGO).convert('RGB')).astype(np.float32)
H, W = A.shape[:2]
L = A.mean(axis=2)
ys, xs = np.nonzero(L > 150)
bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
anchoL = bx1 - bx0
cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
FONDO = np.median(A[L < 100], axis=0)
print('letras x %d..%d y %d..%d (%dx%d), fondo #%02X%02X%02X' % (bx0, bx1, by0, by1, anchoL, by1 - by0, *FONDO.astype(int)))


def achicar(rgba, n):
    """RGBA float (0..255) → n×n con Lanczos sobre alfa premultiplicado (sin halos)."""
    im = Image.fromarray(np.clip(rgba, 0, 255).round().astype(np.uint8), 'RGBA').convert('RGBa')
    return im.resize((n, n), Image.LANCZOS).convert('RGBA')


def fondo_cuadrado(lado):
    """Cuadrado del original de lado px centrado en las letras; afuera se completa espejando el fondo."""
    I = A[BORDE:H - BORDE, BORDE:W - BORDE]
    n = int(round(lado))
    x0, y0 = int(round(cx - n / 2)) - BORDE, int(round(cy - n / 2)) - BORDE
    pl, pt = max(0, -x0), max(0, -y0)
    pr, pb = max(0, x0 + n - I.shape[1]), max(0, y0 + n - I.shape[0])
    P = np.pad(I, ((pt, pb), (pl, pr), (0, 0)), mode='symmetric')
    return P[y0 + pt:y0 + pt + n, x0 + pl:x0 + pl + n]


def logo_suelto():
    """Las letras con su fondo gastado alrededor que se funde a transparente (como logo_jxm.py). → RGBA, x0, y0."""
    PX, PY = 46, 40
    x0, x1, y0, y1 = max(0, bx0 - PX), min(W, bx1 + PX), max(0, by0 - PY), min(H, by1 + PY)
    C = A[y0:y1, x0:x1]
    h, w = C.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dx = np.maximum(0, np.maximum((bx0 - x0) - xx, xx - (bx1 - x0 - 1)))
    dy = np.maximum(0, np.maximum((by0 - y0) - yy, yy - (by1 - y0 - 1)))
    f = np.clip(1 - np.sqrt(dx * dx + dy * dy) / (min(PX, PY) * 0.95), 0, 1)
    f = f * f * (3 - 2 * f)
    alfa = np.maximum(f * 0.94, np.clip((L[y0:y1, x0:x1] - 60) / 60, 0, 1))
    return np.dstack([C, alfa * 255]), x0, y0


def en_lienzo(rgba, x0, y0, lado):
    """Pone rgba (coordenadas del original desde x0, y0) en un lienzo transparente de lado px centrado en las letras."""
    n = int(round(lado))
    ox, oy = int(round(cx - n / 2)), int(round(cy - n / 2))
    out = np.zeros((n, n, 4), np.float32)
    h, w = rgba.shape[:2]
    ax, ay = x0 - ox, y0 - oy
    sx0, sy0 = max(0, -ax), max(0, -ay)
    sx1, sy1 = min(w, n - ax), min(h, n - ay)
    out[ay + sy0:ay + sy1, ax + sx0:ax + sx1] = rgba[sy0:sy1, sx0:sx1]
    return out


def mascara(n, circulo, s=4):
    M = Image.new('L', (n * s, n * s), 0)
    d = ImageDraw.Draw(M)
    if circulo: d.ellipse((0, 0, n * s - 1, n * s - 1), fill=255)
    else: d.rounded_rectangle((0, 0, n * s - 1, n * s - 1), radius=int(n * s * 0.18), fill=255)
    return M.resize((n, n), Image.LANCZOS)


def radio_letras(img_letras, n):
    """Distancia máxima al centro (en fracción del lado) de los píxeles de letra visibles."""
    al = np.asarray(img_letras)[..., 3]
    yy, xx = np.nonzero(al > 25)            # radio: cualquier tinta, aunque sea el borde suavizado
    _, xm = np.nonzero(al > 127)            # ancho: medio cubierto
    return np.sqrt((xx + 0.5 - n / 2) ** 2 + (yy + 0.5 - n / 2) ** 2).max() / n, (xm.max() + 1 - xm.min()) / n


def guardar(img, *ruta):
    p = os.path.join(RES, *ruta)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    img.save(p, optimize=True)
    return img


LOGO_RGBA, LX0, LY0 = logo_suelto()
# sólo lo blanco de las letras (para medir y para el ícono monocromo de Android 13)
BLANCO = np.zeros_like(LOGO_RGBA)
BLANCO[..., :3] = 255
BLANCO[..., 3] = np.clip((L[LY0:LY0 + LOGO_RGBA.shape[0], LX0:LX0 + LOGO_RGBA.shape[1]] - 90) / 80, 0, 1) * 255

hechos = {}
for nombre, k in DENS:
    n = int(round(48 * k))
    lado = anchoL / LEGADO
    fondo = Image.fromarray(np.clip(fondo_cuadrado(lado), 0, 255).round().astype(np.uint8), 'RGB').resize((n, n), Image.LANCZOS)
    for archivo, circ in (('ic_launcher.png', False), ('ic_launcher_round.png', True)):
        im = fondo.convert('RGBA')
        im.putalpha(mascara(n, circ))
        hechos[(nombre, archivo)] = guardar(im, 'mipmap-' + nombre, archivo)
    letras = achicar(en_lienzo(BLANCO, LX0, LY0, lado), n)
    r, ancho = radio_letras(letras, n)
    assert abs(ancho - LEGADO) < 0.01 + 1.5 / n, ancho
    assert r < 0.5 - 1.0 / n, ('las letras tocan el borde del círculo', r)
    print('%-8s %3d px  viejo: letras %.1f %% del ancho, radio %.3f del lado (círculo 0.5)' % (nombre, n, ancho * 100, r))

    # adaptable: 108 dp; si la letra más lejana pasa el círculo seguro, se achica hasta que entre
    n = int(round(108 * k))
    prop = ADAPT
    while True:
        lado = anchoL / prop
        letras = achicar(en_lienzo(BLANCO, LX0, LY0, lado), n)
        r, ancho = radio_letras(letras, n)
        if r * 108 <= SEGURO - 0.25 or prop < 0.5: break
        prop -= 0.005
    assert r * 108 <= SEGURO, r * 108
    hechos[(nombre, 'fg')] = guardar(achicar(en_lienzo(LOGO_RGBA, LX0, LY0, lado), n), 'mipmap-' + nombre, 'ic_launcher_foreground.png')
    hechos[(nombre, 'mono')] = guardar(letras, 'mipmap-' + nombre, 'ic_launcher_monochrome.png')
    print('%-8s %3d px  adaptable: letras %.1f %% de 108 dp, la más lejana a %.2f dp del centro (seguro: %.0f)'
          % (nombre, n, ancho * 100, r * 108, SEGURO))

f = INICIO / anchoL
ini = Image.fromarray(np.clip(LOGO_RGBA, 0, 255).round().astype(np.uint8), 'RGBA').convert('RGBa')
ini = ini.resize((int(round(LOGO_RGBA.shape[1] * f)), int(round(LOGO_RGBA.shape[0] * f))), Image.LANCZOS).convert('RGBA')
guardar(ini, 'drawable-nodpi', 'logo_inicio.png')
print('logo_inicio.png %dx%d' % ini.size)

if HOJA:
    # hoja para mirar: viejos a tamaño real y ×4, adaptables con máscara de círculo y de cuadrado redondeado
    # (72 dp visibles de 108) y el círculo seguro marcado, monocromo teñido, inicio sobre el fondo
    bg = tuple(int(v) for v in FONDO)
    S = Image.new('RGB', (1500, 900), (90, 96, 104))
    x = 20
    for nombre, k in DENS:
        im = hechos[(nombre, 'ic_launcher.png')]
        S.paste(im, (x, 20), im)
        im2 = hechos[(nombre, 'ic_launcher_round.png')]
        S.paste(im2, (x, 230), im2)
        x += im.size[0] + 20
    chico = hechos[('mdpi', 'ic_launcher.png')].resize((192, 192), Image.NEAREST)
    S.paste(chico, (x, 20), chico)
    x = 20
    for circ in (True, False):
        fg = hechos[('xxxhdpi', 'fg')]
        lien = Image.new('RGBA', fg.size, bg + (255,))
        lien.alpha_composite(fg)
        v = lien.crop((72, 72, 360, 360))   # lo visible: 72 dp de 108
        m = mascara(288, circ)
        out = Image.new('RGBA', (288, 288), (0, 0, 0, 0))
        out.paste(v, (0, 0), m)
        d = ImageDraw.Draw(out)
        rs = SEGURO / 108 * 432
        d.ellipse((144 - rs, 144 - rs, 144 + rs, 144 + rs), outline=(255, 60, 60, 255), width=1)
        S.paste(out, (x, 450), out)
        x += 310
    mono = hechos[('xxxhdpi', 'mono')]
    teñido = Image.new('RGBA', mono.size, (210, 230, 255, 255))
    teñido.putalpha(mono.getchannel('A'))
    caja = Image.new('RGBA', mono.size, (40, 60, 90, 255))
    caja.alpha_composite(teñido)
    S.paste(caja.crop((72, 72, 360, 360)), (x, 450))
    x += 310
    ini_bg = Image.new('RGBA', (ini.size[0] + 40, ini.size[1] + 40), bg + (255,))
    ini_bg.alpha_composite(ini, (20, 20))
    S.paste(ini_bg.resize((ini_bg.size[0] // 2, ini_bg.size[1] // 2), Image.LANCZOS), (x, 450))
    S.save(HOJA)
    print('hoja', HOJA)
