# Los íconos de la app que se pueden elegir (como en Discord: Ajustes → Ícono de la app). Salen del logo de siempre
# (apk/res/mipmap-xxxhdpi/ic_launcher_foreground.png: letras blancas con los dibujos negros adentro) con otros colores y
# fondos. Escribe:
#  - Android: mipmap-<densidad>/ic_v_<id>{,_round,_fg,_bg}.png y mipmap-anydpi-v26/ic_v_<id>{,_round}.xml (íconos
#    adaptables: fondo + logo + el monocromo de siempre para los íconos temáticos de Android 13);
#  - iPhone/iPad: web/app/icono-<id>-180.png (el de «Agregar a inicio» de Safari);
#  - el juego: juego/iconosapp.js (las miniaturas para elegir, en base64).
# Uso: python3 -I herramientas/iconos_app.py
import os, io, base64, json, math, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops

AQUI = os.path.dirname(os.path.abspath(__file__)); JX = os.path.dirname(AQUI); RES = os.path.join(JX, 'apk', 'res')
WEB = os.path.join(os.path.dirname(os.path.dirname(JX)), 'web')
FG = Image.open(os.path.join(RES, 'mipmap-xxxhdpi', 'ic_launcher_foreground.png')).convert('RGBA')   # 432×432
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

def hexa(c): c = c.lstrip('#'); return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))

# (las letras como un esténcil: lo claro del logo es la letra, del color pedido; la placa oscura de atrás y los dibujos de
# adentro de las letras —el símbolo nuclear, el misil, la bomba— quedan calados y se ve el fondo de la variante. Con la
# placa, cada variante mostraba un rectángulo oscuro detrás del logo. El borde, suave: alfa según el brillo)
def recolor(fg, letra, tinta=None):
    r, g, b, a = fg.split(); lum = Image.merge('RGB', (r, g, b)).convert('L')
    m = lum.point(lambda v: 0 if v < 95 else 255 if v > 150 else round((v - 95) * 255 / 55))
    out = Image.new('RGBA', fg.size, letra + (255,)); out.putalpha(ImageChops.multiply(m, a)); return out

def degradado(n, c0, c1, radial=False):
    im = Image.new('RGB', (n, n)); px = im.load(); a, b = hexa(c0), hexa(c1)
    for y in range(n):
        for x in range(n):
            t = min(1, math.hypot(x - n / 2, y - n / 2) / (n * 0.62)) if radial else y / (n - 1)
            px[x, y] = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return im.convert('RGBA')

def lineas(im, cada, alfa):
    d = ImageDraw.Draw(im, 'RGBA')
    for y in range(0, im.size[1], cada): d.line([(0, y), (im.size[0], y)], fill=(0, 0, 0, alfa))
    return im

def ruido(im, cant, semilla):
    rnd = random.Random(semilla); d = ImageDraw.Draw(im, 'RGBA'); n = im.size[0]
    for _ in range(cant): x, y = rnd.randrange(n), rnd.randrange(n); v = rnd.randrange(255); d.point((x, y), fill=(v, v, v, 28))
    return im

def brillo(capa, color, radio):
    a = capa.split()[3].filter(ImageFilter.GaussianBlur(radio)); g = Image.new('RGBA', capa.size, color + (0,)); g.putalpha(a.point(lambda v: min(255, v * 2)))
    return g

# las variantes: (id, fondo 432×432, logo 432×432)
def variante(id_):
    n = FG.size[0]
    if id_ == 'noche': return Image.new('RGBA', (n, n), (0, 0, 0, 255)), recolor(FG, (255, 255, 255), (0, 0, 0))
    if id_ == 'dorado':
        bg = degradado(n, '#ffe7a3', '#a8701e', radial=True); lg = recolor(FG, (28, 20, 8), (232, 186, 96))
        sombra = brillo(lg, (255, 240, 200), 6); bg.alpha_composite(sombra); return bg, lg
    if id_ == 'neon':
        bg = degradado(n, '#141a4a', '#05061a', radial=True); d = ImageDraw.Draw(bg, 'RGBA')
        for i in range(0, n, 36): d.line([(i, 0), (i, n)], fill=(80, 60, 200, 40)); d.line([(0, i), (n, i)], fill=(80, 60, 200, 40))
        lg = recolor(FG, (60, 245, 255), (10, 12, 40)); bg.alpha_composite(brillo(lg, (255, 60, 220), 10)); bg.alpha_composite(brillo(lg, (60, 245, 255), 4)); return bg, lg
    if id_ == 'rojo': return degradado(n, '#ef4b3f', '#6d0a0a'), recolor(FG, (255, 255, 255), (110, 10, 10))
    if id_ == 'blanco': return degradado(n, '#ffffff', '#dcdcdc'), recolor(FG, (22, 22, 22), (240, 240, 240))
    if id_ == 'azul': return degradado(n, '#6b77ff', '#3a3fb8'), recolor(FG, (255, 255, 255), (60, 66, 190))
    if id_ == 'vhs':
        bg = ruido(lineas(degradado(n, '#1c1c22', '#060608'), 6, 70), 2500, 7)
        lg = recolor(FG, (240, 240, 240), (12, 12, 14)); a = lg.split()[3]
        rojo = Image.new('RGBA', (n, n), (255, 40, 60, 0)); rojo.putalpha(ImageChops.offset(a, -7, 0).point(lambda v: v * 0.8))
        cian = Image.new('RGBA', (n, n), (40, 230, 255, 0)); cian.putalpha(ImageChops.offset(a, 7, 0).point(lambda v: v * 0.8))
        bg.alpha_composite(rojo); bg.alpha_composite(cian); lg = lineas(lg, 6, 60); return bg, lg
    raise ValueError(id_)

VARIANTES = [('clasico', 'Clásico'), ('noche', 'Noche'), ('dorado', 'Dorado'), ('neon', 'Neón'), ('rojo', 'Rojo'), ('blanco', 'Blanco'), ('azul', 'Azul'), ('vhs', 'VHS')]

def clasico():
    n = FG.size[0]; return Image.new('RGBA', (n, n), (32, 32, 32, 255)), FG.copy()

# el ícono armado (fondo + logo), recortado como lo muestra cada sistema
def armado(bg, lg, lado, forma):
    im = bg.copy(); im.alpha_composite(lg)
    # (el logo adaptable ocupa el 66 % del medio: para el ícono plano se recorta ese 72 % y se agranda)
    m = round(im.size[0] * 0.14); im = im.crop((m, m, im.size[0] - m, im.size[1] - m)).resize((lado, lado), Image.LANCZOS)
    if forma == 'plano': return im.convert('RGB')
    mask = Image.new('L', (lado * 4, lado * 4), 0); d = ImageDraw.Draw(mask)
    if forma == 'redondo': d.ellipse((0, 0, lado * 4 - 1, lado * 4 - 1), fill=255)
    else: d.rounded_rectangle((0, 0, lado * 4 - 1, lado * 4 - 1), radius=round(lado * 4 * 0.2), fill=255)
    mask = mask.resize((lado, lado), Image.LANCZOS); out = Image.new('RGBA', (lado, lado), (0, 0, 0, 0)); out.paste(im, (0, 0), mask); return out

def png(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return b.getvalue()

ADAPT = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_v_%s_bg" />
    <foreground android:drawable="@mipmap/ic_v_%s_fg" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
'''

datos = []
os.makedirs(os.path.join(WEB, 'app'), exist_ok=True)
for id_, nombre in VARIANTES:
    bg, lg = clasico() if id_ == 'clasico' else variante(id_)
    if id_ != 'clasico':
        for d, k in DENS.items():
            carp = os.path.join(RES, 'mipmap-' + d); a = round(108 * k); l = round(48 * k)
            bg.resize((a, a), Image.LANCZOS).save(os.path.join(carp, 'ic_v_%s_bg.png' % id_), optimize=True)
            lg.resize((a, a), Image.LANCZOS).save(os.path.join(carp, 'ic_v_%s_fg.png' % id_), optimize=True)
            armado(bg, lg, l, 'cuadrado').save(os.path.join(carp, 'ic_v_%s.png' % id_), optimize=True)
            armado(bg, lg, l, 'redondo').save(os.path.join(carp, 'ic_v_%s_round.png' % id_), optimize=True)
        for suf in ('', '_round'): open(os.path.join(RES, 'mipmap-anydpi-v26', 'ic_v_%s%s.xml' % (id_, suf)), 'w').write(ADAPT % (id_, id_))
    # iPhone/iPad: el de «Agregar a inicio» (opaco: iOS redondea solo)
    armado(bg, lg, 180, 'plano').save(os.path.join(WEB, 'app', 'icono-%s-180.png' % id_), optimize=True)
    datos.append({'id': id_, 'n': nombre, 'png': 'data:image/png;base64,' + base64.b64encode(png(armado(bg, lg, 96, 'cuadrado'))).decode()})

open(os.path.join(JX, 'juego', 'iconosapp.js'), 'w', encoding='utf-8').write(
    '// los íconos de la app para elegir (los arma herramientas/iconos_app.py: no editar a mano)\nconst ICONOS_APP = ' + json.dumps(datos, ensure_ascii=False) + ';\n')
print('ok', len(datos), 'variantes;', sum(len(d['png']) for d in datos) // 1024, 'KB de miniaturas')
