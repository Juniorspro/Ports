# El atlas de letras de JXMod nativo: ASCII y lo del castellano (á é í ó ú ñ ü ¿ ¡ · × …) en DejaVu Sans Bold (licencia
# libre de DejaVu/Bitstream Vera: CREDITOS.md), blancas sobre transparente, y sus medidas. La app lo dibuja con el motor
# (el contador de fps, los menús, el HUD). Uso: python3 -I herramientas/atlas_letras.py CARPETA  → letras.png, letras.json
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
FUENTE = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
TAM, LADO = 40, 1024
CARS = [chr(c) for c in range(32, 127)] + list('áéíóúñüÁÉÍÓÚÑÜ¿¡·×…→←↑↓°º«»—∞ª−')
def main():
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    f = ImageFont.truetype(FUENTE, TAM)
    asc, desc = f.getmetrics()
    img = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    # (un cuadrado blanco arriba a la izquierda: los rectángulos lisos del HUD usan esa parte)
    d.rectangle([0, 0, 7, 7], fill=(255, 255, 255, 255))
    x, y, fila = 12, 0, asc + desc + 4; met = {}
    for c in CARS:
        b = f.getbbox(c); w = max(1, b[2] - b[0]); h = max(1, b[3] - b[1]); av = f.getlength(c)
        if x + w + 4 > LADO: x = 0; y += fila
        if c != ' ': d.text((x - b[0], y - b[1]), c, font=f, fill=(255, 255, 255, 255))
        met[c] = [x, y, w, h, b[0], b[1], round(av, 2)]
        x += w + 4
    # (un disco y un anillo lisos, con el borde suave: la palanca, los botones redondeados —sus esquinas— y los íconos)
    y += fila; R = 48; formas = {}
    for k, (nombre, grosor) in enumerate((('disco', 0), ('anillo', 7))):
        g = Image.new('L', (R * 8, R * 8), 0); gd = ImageDraw.Draw(g)
        gd.ellipse([4, 4, R * 8 - 5, R * 8 - 5], fill=255)
        if grosor: gd.ellipse([4 + grosor * 4, 4 + grosor * 4, R * 8 - 5 - grosor * 4, R * 8 - 5 - grosor * 4], fill=0)
        g = g.resize((R * 2, R * 2), Image.LANCZOS)
        x0 = k * (R * 2 + 8); blanco = Image.new('RGBA', (R * 2, R * 2), (255, 255, 255, 255)); img.paste(blanco, (x0, y), g)
        formas[nombre] = [x0, y, R * 2, R * 2]
    fila = R * 2 + 4
    # (sólo la altura que se usa, redondeada a potencia de 2)
    alto = 1
    while alto < y + fila: alto *= 2
    img = img.crop((0, 0, LADO, alto)); img.save(os.path.join(out, 'letras.png'))
    json.dump({'tam': TAM, 'alto': asc + desc, 'asc': asc, 'lado': [LADO, alto], 'blanco': [4, 4], 'c': met, **formas}, open(os.path.join(out, 'letras.json'), 'w'), ensure_ascii=False)
    print('letras:', len(met), 'caracteres, alto', asc + desc, 'px, filas hasta', y + fila)
main()
