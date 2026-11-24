# El atlas de letras de los menús de JXMod nativo (nativo/src/pincel.rs): la letra condensada del menú de la web (Oswald, la
# misma juego/fuentes/oswald_jx.woff2 —OFL, juego/fuentes/OFL_Oswald.txt— en peso 500 y 600, como --jxF) y la de los textos
# (la web pide Roboto; acá Inter —OFL— o, si no está, DejaVu Sans), blancas sobre transparente, con sus medidas: por letra,
# dónde está en el atlas, su caja respecto de la línea de base y el avance; por cara, el alto de arriba y de abajo que usa el
# navegador para el renglón (hhea, o las tipográficas si la fuente lo pide) y el de las mayúsculas.
# Uso: python3 -I herramientas/atlas_menus.py CARPETA  → menus.png, menus.json
import io, json, os, sys
from PIL import Image, ImageDraw, ImageFont, features
AQUI = os.path.dirname(os.path.abspath(__file__))
OSWALD = os.path.join(AQUI, '..', 'juego', 'fuentes', 'oswald_jx.woff2')
SANS = [('/usr/share/fonts/opentype/inter/Inter-Regular.otf', '/usr/share/fonts/opentype/inter/Inter-Bold.otf'),
        ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')]
LADO = 2048
CARS = [chr(c) for c in range(32, 127)] + list('¡¢£°±²³´·¸¹º»«¿ÀÁÂÄÇÈÉÊËÌÍÎÏÑÒÓÔÖ×ÙÚÛÜàáâäçèéêëìíîïñòóôö÷ùúûü…–—‘’“”•€™−→←↑↓∞')

def metricas(tt):
    """(alto arriba, alto abajo, mayúsculas) en unidades de la fuente, como el renglón del navegador"""
    os2, hh = tt['OS/2'], tt['hhea']
    if os2.fsSelection & (1 << 7): a, d = os2.sTypoAscender, -os2.sTypoDescender
    else: a, d = hh.ascent, -hh.descent
    cap = getattr(os2, 'sCapHeight', 0) or int(a * 0.7)
    return a, d, cap, tt['head'].unitsPerEm

def cara(datos, tam, peso=None):
    f = ImageFont.truetype(io.BytesIO(datos), tam)
    if peso is not None:
        try: f.set_variation_by_axes([peso])
        except Exception as e: print('sin variación de peso:', e)
    return f

def main():
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    from fontTools.ttLib import TTFont
    tt = TTFont(OSWALD); bio = io.BytesIO(); tt.flavor = None; tt.save(bio); osw = bio.getvalue()
    caras = [('o5', osw, 52, 500, TTFont(io.BytesIO(osw))), ('o6', osw, 52, 600, TTFont(io.BytesIO(osw)))]
    sans = next((s for s in SANS if os.path.isfile(s[0]) and os.path.isfile(s[1])), None)
    if not sans: sys.exit('no hay una letra para los textos (Inter o DejaVu Sans)')
    for k, r in (('s4', sans[0]), ('s7', sans[1])):
        d = open(r, 'rb').read(); caras.append((k, d, 40, None, TTFont(io.BytesIO(d))))
    img = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0)); dib = ImageDraw.Draw(img)
    # (un cuadrado blanco arriba a la izquierda: lo liso —placas, rayas, polígonos— usa esa parte)
    dib.rectangle([0, 0, 15, 15], fill=(255, 255, 255, 255))
    x, y, fila, sal = 20, 0, 0, {}
    for k, datos, tam, peso, t in caras:
        f = cara(datos, tam, peso); a, d, cap, em = metricas(t); s = tam / em
        cmap = t.getBestCmap(); c = {}
        alto = int((a + d) * s) + 6
        for ch in CARS:
            if ord(ch) not in cmap and ch != ' ': continue
            b = f.getbbox(ch, anchor='ls'); w = max(1, b[2] - b[0]); h = max(1, b[3] - b[1]); av = f.getlength(ch)
            if x + w + 4 > LADO: x = 0; y += fila + 4; fila = 0
            if ch != ' ': dib.text((x - b[0], y - b[1]), ch, font=f, fill=(255, 255, 255, 255), anchor='ls')
            c[ch] = [x, y, w, h, b[0], b[1], round(av, 2)]
            x += w + 4; fila = max(fila, h, alto if False else 0)
        # (los pares con interletra —kerning, como el navegador—: medidos con el armado de texto de la fuente)
        kern = {}
        if features.check_feature('raqm'):
            fr = ImageFont.truetype(io.BytesIO(datos), tam, layout_engine=ImageFont.Layout.RAQM)
            if peso is not None: fr.set_variation_by_axes([peso])
            base = [ch for ch in c if ch.isalnum() or ch in '.,-:/\'"()']
            for p1 in base:
                for p2 in base:
                    dk = fr.getlength(p1 + p2) - fr.getlength(p1) - fr.getlength(p2)
                    if abs(dk) >= 0.05 * tam / 52: kern[p1 + p2] = round(dk, 2)
        sal[k] = {'tam': tam, 'asc': round(a * s, 2), 'desc': round(d * s, 2), 'cap': round(cap * s, 2), 'c': c, 'k': kern}
        x = 0; y += fila + 6; fila = 0
    # (un disco y un anillo lisos con el borde suave, como los de letras.png)
    R = 48; formas = {}
    for i, (nombre, grosor) in enumerate((('disco', 0), ('anillo', 7))):
        g = Image.new('L', (R * 8, R * 8), 0); gd = ImageDraw.Draw(g)
        gd.ellipse([4, 4, R * 8 - 5, R * 8 - 5], fill=255)
        if grosor: gd.ellipse([4 + grosor * 4, 4 + grosor * 4, R * 8 - 5 - grosor * 4, R * 8 - 5 - grosor * 4], fill=0)
        g = g.resize((R * 2, R * 2), Image.LANCZOS)
        x0 = i * (R * 2 + 8); img.paste(Image.new('RGBA', (R * 2, R * 2), (255, 255, 255, 255)), (x0, y), g)
        formas[nombre] = [x0, y, R * 2, R * 2]
    y += R * 2 + 4
    alto = 1
    while alto < y: alto *= 2
    img = img.crop((0, 0, LADO, alto)); img.save(os.path.join(out, 'menus.png'), optimize=True)
    json.dump({'lado': [LADO, alto], 'blanco': [8, 8], 'caras': sal, **formas}, open(os.path.join(out, 'menus.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('menús:', ', '.join('%s %d letras, %d pares' % (k, len(v['c']), len(v['k'])) for k, v in sal.items()), '· alto', alto, '· textos con', os.path.basename(sans[0]))
main()
