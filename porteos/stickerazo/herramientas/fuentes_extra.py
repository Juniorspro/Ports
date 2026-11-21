# Las «más letras» del editor: familias de Google Fonts con licencia libre para apps comerciales (SIL OFL 1.1 o
# Apache-2.0), bajadas de github.com/google/fonts, en el grosor que mejor queda en un sticker (lo más cerca de 700 que
# tenga), recortadas a los caracteres latinos (con ñ, tildes, ¡¿, comillas, €) y en WOFF2: unos 20-40 KB cada una.
# Ojo con la OFL: si la fuente tiene «nombre reservado» (Reserved Font Name), una versión modificada —recortada— no
# puede llamarse igual. Esas van TAL CUAL (el .ttf original, sin tocar un byte) si son estáticas y no muy pesadas; las
# variables con nombre reservado quedan afuera. Así ninguna se presenta con un nombre que no puede usar.
# Salen a fuentes/ (fuera de web/: no van en el APK ni en las actualizaciones; la app las baja del servidor —/sz/fuentes/—
# recién cuando alguien elige una) con fuentes/LICENCIAS.txt, y la lista a web/fuentes_extra.json.
# uso: python3 -I herramientas/fuentes_extra.py   (y después node herramientas/muestras_fuentes.mjs)
import io, json, os, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib import instancer

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAL, LISTA = os.path.join(RAIZ, 'fuentes'), os.path.join(RAIZ, 'web', 'fuentes_extra.json')
GF = 'https://raw.githubusercontent.com/google/fonts/main/'
# (las que ya vienen en la app no se repiten; las de color —COLR/SVG— no sirven para el contorno del sticker)
YA = {'Luckiest Guy', 'Bangers', 'Anton', 'Permanent Marker', 'Pacifico', 'Comic Neue'}
CATEGORIAS = {
    'divertidas': 'Sour Gummy|DynaPuff|Darumadrop One|Cherry Bomb One|Rubik Lines|Rubik Maze|Rubik Distressed|Rubik Iso|Rubik Burned|Rubik Dirt|'
                  'Rubik Gemstones|Rubik Marker Hatch|Rubik Storm|Rubik 80s Fade|Rubik Broken Fax|Rubik Scribble|Rubik Pixels|Rubik Doodle Triangles|'
                  'Agbalumo|Bakbak One|Barrio|Bigshot One|Blaka|Gasoek One|Madimi One|Matemasie|Protest Guerrilla|Protest Revolution|Protest Riot|'
                  'Protest Strike|Moirai One|Gajraj One|Lumanosimo|Lugrasimo|Belanosima|Borel|Bungee Tint|Jaro|Chokokutai|Kavivanar|Akaya Kanadaka|'
                  'Atma|Baloo Bhai 2|Bubbler One|Caprasimo|Chicle|Comic Relief|Fuzzy Bubbles|Gorditas|Gloria Hallelujah|Grandiflora One|Jomhuria|'
                  'Joti One|Kirang Haerang|Lacquer|Luckiest Guy|Modak|Mogra|Mountains of Christmas|Nova Mono|Peralta|Purple Purse|Rubik Wet Paint|'
                  'Sedan SC|Slackside One|Sofadi One|Unkempt|Uncial Antiqua|Wendy One|Zen Tokyo Zoo|Bungee Spice|Honk|Nabla|'
                  'Lobster|Bungee|Bungee Shade|Bungee Inline|Fredoka|Baloo 2|Chewy|Titan One|Bowlby One|Lilita One|Sniglet|Shrikhand|Righteous|Monoton|Creepster|'
                  'Rubik Mono One|Rubik Bubbles|Rubik Glitch|Rubik Wet Paint|Rubik Puddles|Rubik Beastly|Rubik Moonrocks|Rubik Microbe|Rubik Spray Paint|Rubik Vinyl|'
                  'Rubik Doodle Shadow|Rampart One|Rammetto One|Ranchers|Paytone One|Passion One|Chango|Fascinate|Fascinate Inline|Faster One|Frijole|Fugaz One|'
                  'Henny Penny|Irish Grover|Jolly Lodger|Kavoon|Knewave|Lemon|Londrina Solid|Londrina Shadow|Londrina Sketch|Mouse Memoirs|Nosifer|Oi|Original Surfer|'
                  'Piedra|Poller One|Ribeye|Ribeye Marrow|Risque|Sancreek|Sigmar One|Slackey|Smokum|Spicy Rice|Spirax|Squada One|Supermercado One|Trade Winds|'
                  'Boogaloo|Bubblegum Sans|Cherry Cream Soda|Chicle|Concert One|Coiny|Dela Gothic One|Erica One|Emblema One|Freckle Face|Gluten|Grandstander|'
                  'Love Ya Like A Sister|Mochiy Pop One|Potta One|Rowdies|Shojumaru|Sonsie One|Train One|Bagel Fat One|Climate Crisis|Kablammo|Tilt Warp|Tilt Prism|'
                  'Bubblegum Sans|Gochi Hand|Flavors|Hanalei Fill|Butcherman|Eater|Margarine|Mystery Quest|Snowburst One|Galindo',
    'gruesas': 'Anton SC|Big Shoulders Stencil Display|Unbounded|Tektur|Bricolage Grotesque|Gabarito|League Gothic|League Spartan|Saira Condensed|'
               'Six Caps|Fjalla One|Pathway Gothic One|Antonio|Smooch Sans|Sofia Sans Extra Condensed|Chakra Petch|Bayon|Archivo Narrow|Tilt Warp|'
               'Encode Sans Expanded|Mohave|Alumni Sans|Asap Condensed|Khand|Rajdhani|Saira Extra Condensed|Sofia Sans Condensed|Squada One|'
               'Bebas Neue|Black Ops One|Racing Sans One|Russo One|Staatliches|Teko|Oswald|Archivo Black|Alfa Slab One|Bevan|Ultra|Wallpoet|Stick No Bills|'
               'Bowlby One SC|Big Shoulders Display|Passion One|Saira Stencil One|Graduate|Holtwood One SC|Kanit|Changa One|Days One|Patua One|Bungee Hairline',
    'manuscritas': 'Edu SA Beginner|Edu TAS Beginner|Edu VIC WA NT Beginner|Edu NSW ACT Foundation|Edu QLD Beginner|Grechen Fuemen|Gwendolyn|'
                   'Hurricane|Licorice|Love Light|Moon Dance|Ole|Ephesis|Estonia|Explora|Fuggles|Grey Qo|Imperial Script|Kings|Lavishly Yours|Meow Script|'
                   'Mea Culpa|My Soul|Puppies Play|Qwitcher Grypen|Send Flowers|Splash|Tapestry|The Nautigal|Twinkle Star|Updock|Vujahday Script|'
                   'Waterfall|WindSong|Whisper|Comforter|Corinthia|Ballet|Birthstone|Babylonica|Caramel|Charm|Cherish|Festive|Fleur De Leah|Inspiration|'
                   'Island Moments|Kolker Brush|Lovers Quarrel|Luxurious Script|Oooh Baby|Passions Conflict|Praise|Delicious Handrawn|Annie Use Your Telescope|'
                   'Just Me Again Down Here|Beth Ellen|Bonheur Royale|Cookie|Dawning of a New Day|Square Peg|Ingrid Darling|Lumanosimo|'
                   'Caveat|Caveat Brush|Dancing Script|Satisfy|Kaushan Script|Great Vibes|Sacramento|Yellowtail|Shadows Into Light|Shadows Into Light Two|'
                   'Indie Flower|Amatic SC|Gloria Hallelujah|Rock Salt|Covered By Your Grace|Architects Daughter|Patrick Hand|Just Another Hand|Reenie Beanie|'
                   'Homemade Apple|Itim|Mali|Handlee|Kalam|Courgette|Cookie|Damion|Allura|Alex Brush|Parisienne|Pinyon Script|Tangerine|Marck Script|Mr Dafoe|'
                   'Nothing You Could Do|Over the Rainbow|Rancho|Sedgwick Ave|Sedgwick Ave Display|Schoolbell|Sue Ellen Francisco|Waiting for the Sunrise|'
                   'Walter Turncoat|Zeyada|Cedarville Cursive|La Belle Aurore|Loved by the King|Neucha|Delius|Coming Soon|Short Stack|Swanky and Moo Moo|'
                   'Fuzzy Bubbles|Grape Nuts|Comforter Brush|Ms Madi|Birthstone Bounce|Water Brush|Bad Script|Pangolin|Mansalva|Nerko One|Gaegu|Playpen Sans',
    'retro': 'Jersey 10|Jersey 15|Jersey 20|Jersey 25|Micro 5|Tiny5|Workbench|Sixtyfour|Doto|Bytesized|Handjet|Jacquard 12|Jacquard 24|'
             'Jacquarda Bastarda 9|Pirata One|Grenze Gotisch|UnifrakturMaguntia|New Rocker|Metal Mania|Nova Square|Kode Mono|Share Tech Mono|Space Mono|'
             'Syne Mono|Tourney|Big Shoulders Inline Display|Kalnia|Danfo|Limelight|Federo|Poiret One|Bungee Shade|Lexend Zetta|Michroma|Oxanium|'
             'Quantico|Aldrich|Gruppo|Lekton|Syncopate|Libre Barcode 39 Text|Smokum|'
             'Press Start 2P|VT323|Silkscreen|Pixelify Sans|Audiowide|Orbitron|Major Mono Display|Monofett|Codystar|Megrim|Vampiro One|Tilt Neon|Bungee Outline|'
             'Rye|Vast Shadow|Diplomata|Diplomata SC|Ewert|Monoton|Turret Road|Zen Dots|Goldman|Iceland',
    'elegantes': 'EB Garamond|Fraunces|Instrument Serif|Libre Caslon Display|Young Serif|Gloock|Noto Serif Display|Cormorant Garamond|Marcellus|'
                 'Italiana|Forum|Gilda Display|Rufina|Spectral|Crimson Pro|Bitter|Roboto Slab|Zilla Slab|Arvo|Domine|Alice|Aboreto|Bellefair|'
                 'Castoro Titling|Bodoni Moda SC|Playfair Display SC|Newsreader|Literata|Source Serif 4|Petrona|Vollkorn|Corben|Sedan|'
                 'Playfair Display|Lora|Merriweather|Cinzel|Cinzel Decorative|Abril Fatface|DM Serif Display|Yeseva One|Rozha One|Cormorant|Bodoni Moda|'
                 'Prata|Gravitas One|Old Standard TT|Libre Baskerville',
    'modernas': 'Inter|DM Sans|Figtree|Plus Jakarta Sans|Red Hat Display|Roboto|Jost|Nunito Sans|Archivo|Barlow|Chivo|Instrument Sans|Onest|'
                'Geologica|Golos Text|Hanken Grotesk|Schibsted Grotesk|Familjen Grotesk|Rethink Sans|Wix Madefor Display|Afacad|Albert Sans|'
                'Be Vietnam Pro|Epilogue|Inclusive Sans|Kumbh Sans|Mona Sans|Hubot Sans|Noto Sans|Public Sans|Questrial|Readex Pro|Reddit Sans|Sen|'
                'Syne|Tomorrow|Ubuntu Sans|Ysabeau|Encode Sans|Fira Sans|Karla|Mukta|Oxygen|Prompt|Titillium Web|Heebo|Cabin|'
                'Poppins|Montserrat|Raleway|Nunito|Quicksand|Comfortaa|Josefin Sans|Rubik|Exo 2|Lexend|Outfit|Urbanist|Sora|Space Grotesk|Work Sans|'
                'Barlow Condensed|Manrope|Lato|Open Sans|Mulish|Varela Round|Signika|Righteous',
}
MAX_ORIGINAL = 400 * 1024
LATINO = list(range(0x20, 0x7f)) + list(range(0xa0, 0x180)) + [0x218, 0x219, 0x21a, 0x21b, 0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d,
                                                                0x201e, 0x2022, 0x2026, 0x20ac, 0x2122]


def bajar(url):
    try:
        with urllib.request.urlopen(url, timeout=60) as r: return r.read()
    except Exception: return None


def carpeta(familia): return re.sub(r'[^a-z0-9]', '', familia.lower())


def una(familia, cat):
    d = carpeta(familia)
    for lic in ('ofl', 'apache'):
        meta = bajar(f'{GF}{lic}/{d}/METADATA.pb')
        if meta: break
    else: return None, f'{familia}: no está en google/fonts'
    meta = meta.decode('utf-8', 'replace')
    licencia = bajar(f'{GF}{lic}/{d}/{"OFL.txt" if lic == "ofl" else "LICENSE.txt"}') or b''
    texto_lic = licencia.decode('utf-8', 'replace')
    cab = texto_lic.split('This Font Software is licensed')[0]
    reservado = lic == 'ofl' and bool(re.search(r'Reserved\s+Font\s+Names?', cab, re.I))
    if re.search(r'^\s*(primary_script|category):\s*"(COLOR|EMOJI)"', meta, re.M): return None, f'{familia}: de color'
    fuentes = [dict(re.findall(r'(\w+):\s*"?([^"\n]*)"?', b)) for b in re.findall(r'fonts\s*\{(.*?)\}', meta, re.S)]
    normales = [f for f in fuentes if f.get('style') == 'normal' and f.get('filename')] or fuentes
    if not normales: return None, f'{familia}: sin archivos'
    var = [f for f in normales if '[' in f['filename']]
    if reservado:
        # (con nombre reservado: el archivo original tal cual, o nada)
        estaticas = [f for f in normales if '[' not in f['filename']]
        if not estaticas: return None, f'{familia}: variable y con nombre reservado'
        elegida = min(estaticas, key=lambda f: abs(int(f.get('weight', 400) or 400) - 700))
        datos = bajar(f'{GF}{lic}/{d}/{elegida["filename"]}')
        if not datos: return None, f'{familia}: no se pudo bajar'
        if len(datos) > MAX_ORIGINAL: return None, f'{familia}: con nombre reservado y muy pesada para ir sin recortar ({len(datos) // 1024} KB)'
        f = TTFont(io.BytesIO(datos))
        if 'COLR' in f or 'SVG ' in f or 'CBDT' in f or 'sbix' in f: return None, f'{familia}: de color'
        cmap = f.getBestCmap() or {}
        if not all(ord(c) in cmap for c in 'AaÑñáéíóú¡¿'): return None, f'{familia}: le faltan letras del castellano'
        ident = 'x' + re.sub(r'[^A-Za-z0-9]', '', familia)
        return {'id': ident, 'nombre': familia, 'cat': cat, 'archivo': ident + '.ttf', 'n': len(datos), 'licencia': 'OFL-1.1', 'original': True,
                'datos': datos, 'texto_licencia': texto_lic}, None
    elegida = var[0] if var else min(normales, key=lambda f: abs(int(f.get('weight', 400) or 400) - 700))
    datos = bajar(f'{GF}{lic}/{d}/{elegida["filename"]}')
    if not datos: return None, f'{familia}: no se pudo bajar'
    f = TTFont(io.BytesIO(datos))
    if 'COLR' in f or 'SVG ' in f or 'CBDT' in f or 'sbix' in f: return None, f'{familia}: de color'
    if 'fvar' in f:
        ejes = {a.axisTag: (a.minValue, a.defaultValue, a.maxValue) for a in f['fvar'].axes}
        fijar = {}
        for tag, (lo, df, hi) in ejes.items():
            fijar[tag] = max(lo, min(hi, 700)) if tag == 'wght' else df
        f = instancer.instantiateVariableFont(f, fijar)
    opc = subset.Options(); opc.flavor = 'woff2'; opc.layout_features = ['*']; opc.name_IDs = ['*']; opc.notdef_outline = True
    sub = subset.Subsetter(opc); sub.populate(unicodes=LATINO); sub.subset(f)
    cmap = f.getBestCmap() or {}
    if not all(ord(c) in cmap for c in 'AaÑñáéíóú¡¿'): return None, f'{familia}: le faltan letras del castellano'
    out = io.BytesIO(); f.flavor = 'woff2'; f.save(out)
    ident = 'x' + re.sub(r'[^A-Za-z0-9]', '', familia)
    return {'id': ident, 'nombre': familia, 'cat': cat, 'archivo': ident + '.woff2', 'n': len(out.getvalue()), 'licencia': 'OFL-1.1' if lic == 'ofl' else 'Apache-2.0',
            'datos': out.getvalue(), 'texto_licencia': texto_lic}, None


def main():
    os.makedirs(SAL, exist_ok=True)
    pedidos, vistos = [], set()
    for cat, nombres in CATEGORIAS.items():
        for n in nombres.split('|'):
            n = n.strip()
            if n and n not in YA and n not in vistos: vistos.add(n); pedidos.append((n, cat))
    with ThreadPoolExecutor(8) as ex: res = list(ex.map(lambda p: una(*p), pedidos))
    lista, avisos, licencias = [], [], []
    for (r, aviso) in res:
        if aviso: avisos.append(aviso); continue
        with open(os.path.join(SAL, r['archivo']), 'wb') as o: o.write(r['datos'])
        lista.append({k: r[k] for k in ('id', 'nombre', 'cat', 'archivo', 'n', 'licencia', 'original') if k in r})
        como = 'archivo original, sin modificar' if r.get('original') else 'recortada a caracteres latinos, en WOFF2'
        licencias.append('=' * 78 + '\n' + r['nombre'] + ' (' + r['licencia'] + '; ' + como + ')\n' + '=' * 78 + '\n' + r['texto_licencia'].strip() + '\n')
    for f in os.listdir(SAL):
        if f.endswith(('.woff2', '.ttf')) and f not in {x['archivo'] for x in lista}: os.remove(os.path.join(SAL, f))
    with open(os.path.join(SAL, 'LICENCIAS.txt'), 'w', encoding='utf-8') as o:
        o.write('Las fuentes de esta carpeta son de Google Fonts (github.com/google/fonts), cada una con su licencia (SIL Open Font License 1.1\n'
                'o Apache-2.0), que permite usarlas, incluirlas y distribuirlas con la app, también comercialmente.\n'
                'Cambios: las que NO tienen nombre reservado están recortadas a los caracteres latinos y pasadas a WOFF2 (en las variables,\n'
                'fijado el grosor más cercano a 700): es una «versión modificada», que la OFL y la Apache-2.0 permiten. Las que tienen nombre\n'
                'reservado (Reserved Font Name) van tal cual, el .ttf original sin modificar, y por eso conservan su nombre.\n'
                'Ninguna se vende sola: se usan para escribir en los stickers.\n\n' + '\n'.join(licencias))
    lista.sort(key=lambda x: (list(CATEGORIAS).index(x['cat']), x['nombre']))
    with open(LISTA, 'w', encoding='utf-8') as o: json.dump({'fuentes': lista}, o, ensure_ascii=False, separators=(',', ':'))
    print('fuentes: %d (%.1f MB)  |  por categoría: %s' % (len(lista), sum(x['n'] for x in lista) / 1048576, ', '.join('%s %d' % (c, sum(1 for x in lista if x['cat'] == c)) for c in CATEGORIAS)))
    if avisos: print('afuera (%d): %s' % (len(avisos), '; '.join(avisos)))
    print('ahora las muestras del selector: node herramientas/muestras_fuentes.mjs')


if __name__ == '__main__':
    main()
