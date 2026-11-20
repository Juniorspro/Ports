# Memes con fotos de verdad pero libres para uso comercial: sólo CC0 o dominio público (Openverse: Flickr, Wikimedia…),
# sin personas (animales, comida, cosas). Se bajan, se eligen a mano mirando las hojas de contacto, se encuadran (rembg,
# sólo como herramienta acá: no va en la app), se «arruinan» a propósito (estilo xD) y el texto lo pone la app.
# Cada foto queda anotada (título, autor, licencia, enlace) en web/memes/FUENTES.txt.
# uso:
#   python3 -I herramientas/memes_libres.py buscar          → /tmp/claude-0/sz_libres/candidatos.json
#   python3 -I herramientas/memes_libres.py vistas          → miniaturas (9 por búsqueda) y hojas de contacto numeradas
#   /tmp/claude-0/vrem/bin/python -I herramientas/memes_libres.py armar   → web/memes/*.webp, web/memes.js y FUENTES.txt
import json, os, re, sys, time, urllib.parse, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = '/tmp/claude-0/sz_libres'
UA = 'Stickerazo-memes/0.1 (busqueda de fotos de dominio publico)'
LICENCIAS_OK = {'cc0', 'pdm'}
PERSONAS = re.compile(r'\b(man|men|woman|women|girl|boy|people|person|child|children|kid|kids|baby|portrait|selfie|face of|wedding|bride|model|crowd|hombre|mujer|niñ|gente|persona|retrato)\b', re.I)
BUSQUEDAS = [
    # bichos de acá y de Latinoamérica
    'capybara', 'capybara funny', 'rufous hornero', 'greater rhea', 'guanaco', 'magellanic penguin', 'jaguar cub', 'puma',
    'llama funny', 'alpaca', 'vicuna', 'armadillo', 'monk parakeet', 'southern lapwing', 'andean condor', 'toucan',
    'howler monkey', 'caiman', 'axolotl', 'hummingbird', 'macaw', 'sloth', 'giant anteater', 'coati', 'guinea pig',
    'spectacled bear', 'pudu', 'flamingo', 'iguana', 'tapir',
    # los clásicos de los memes
    'cat funny', 'cat yawning', 'kitten', 'grumpy cat', 'cat surprised', 'dog funny', 'dog tongue', 'puppy', 'pug',
    'chihuahua', 'dog sleeping', 'goat', 'sheep', 'cow', 'donkey', 'horse funny', 'owl', 'duck', 'chicken', 'rooster',
    'pigeon', 'seagull', 'hamster', 'rabbit', 'frog', 'seal', 'monkey', 'raccoon', 'hedgehog', 'squirrel', 'parrot',
    # el morfi
    'empanada', 'asado barbecue', 'mate yerba', 'croissant', 'pizza slice', 'taco', 'arepa', 'hot dog', 'ice cream cone',
]


def api(q, pagina=1):
    url = 'https://api.openverse.org/v1/images/?' + urllib.parse.urlencode({'q': q, 'license': 'cc0,pdm', 'category': 'photograph', 'page_size': 20, 'page': pagina, 'mature': 'false'})
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30) as r: return json.load(r)


def buscar():
    os.makedirs(TMP, exist_ok=True)
    f = os.path.join(TMP, 'candidatos.json')
    todos = json.load(open(f)) if os.path.isfile(f) else {}
    for q in BUSQUEDAS:
        if any(c.get('q') == q for c in todos.values()): continue
        try: d = api(q)
        except Exception as e: print('falló', q, e); time.sleep(5); continue
        n = 0
        for r in d.get('results', []):
            texto = ' '.join([r.get('title') or ''] + [t.get('name', '') for t in (r.get('tags') or [])])
            if r.get('license') not in LICENCIAS_OK or PERSONAS.search(texto): continue
            if (r.get('width') or 0) and min(r['width'], r['height'] or 0) < 500: continue
            if r['id'] in todos: continue
            todos[r['id']] = {'q': q, 'titulo': r.get('title'), 'autor': r.get('creator'), 'licencia': r.get('license'), 'fuente': r.get('source'),
                              'url': r.get('url'), 'pagina': r.get('foreign_landing_url'), 'w': r.get('width'), 'h': r.get('height')}
            n += 1
        print('%-22s %d nuevas (%d en total)' % (q, n, len(todos)))
        json.dump(todos, open(f, 'w'), ensure_ascii=False, indent=1)
        time.sleep(1.2)


def traer(url, f, lado):
    from PIL import Image
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r: datos = r.read()
    tmp = f + '.part'; open(tmp, 'wb').write(datos)
    try: im = Image.open(tmp).convert('RGB'); im.thumbnail((lado, lado)); im.save(f, quality=90)
    finally: os.remove(tmp)


def vistas():
    from PIL import Image
    T0 = time.time()
    todos = json.load(open(os.path.join(TMP, 'candidatos.json')))
    os.makedirs(os.path.join(TMP, 'vistas'), exist_ok=True)
    ok, por_q = [], {}
    for k, c in todos.items():
        por_q[c['q']] = por_q.get(c['q'], 0) + 1
        if por_q[c['q']] > (16 if re.search(r'cat|kitten|dog|pug|puppy|chihuahua|owl|goat|hamster|monkey|frog|seal|raccoon|parrot|duck|sloth|llama|alpaca', c['q']) else 9): continue
        f = os.path.join(TMP, 'vistas', k + '.jpg')
        if not os.path.isfile(f):
            if time.time() - T0 > 520: break   # (de a tandas: se vuelve a correr y sigue)
            try: traer('https://api.openverse.org/v1/images/%s/thumb/' % k, f, 400); time.sleep(0.2)
            except Exception as e: print('no bajó', k, c['q'], str(e)[:80]); continue
        ok.append(k)
    # las hojas de contacto: 30 por hoja, con su número
    from PIL import ImageDraw
    orden = sorted(ok, key=lambda k: (BUSQUEDAS.index(todos[k]['q']) if todos[k]['q'] in BUSQUEDAS else 999, k))
    json.dump(orden, open(os.path.join(TMP, 'orden.json'), 'w'))
    for h in range(0, len(orden), 30):
        W = Image.new('RGB', (6 * 220, 5 * 240), 'white'); d = ImageDraw.Draw(W)
        for j, k in enumerate(orden[h:h + 30]):
            im = Image.open(os.path.join(TMP, 'vistas', k + '.jpg')); im.thumbnail((214, 214))
            x, y = (j % 6) * 220, (j // 6) * 240
            W.paste(im, (x + 3, y + 3)); d.text((x + 4, y + 220), '%d %s' % (h + j, todos[k]['q'][:22]), fill='black')
        W.save(os.path.join(TMP, 'hoja_%02d.jpg' % (h // 30)), quality=80)
    print('miniaturas:', len(ok), '· hojas:', (len(orden) + 29) // 30)


# (centro x, centro y, lado como fracción del lado corto) de las que no se encuadran solas
RECORTES = {'morfi_01': (0.43, 0.42, 0.78)}
TIRA = 120   # (alto de la franja blanca de los memes «tira», en los 512 de la imagen)


# ---- los efectos «xD» (sobre la foto de 512×512) ----
def ojo_de_pez(im, cx=.5, cy=.5, r=.55, k=.45):
    """agranda lo del medio (como un celu pegado a la cara): adentro del radio toma de más cerca del centro"""
    import numpy as np
    from PIL import Image
    from scipy.ndimage import map_coordinates
    a = np.asarray(im).astype(np.float32); h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32); dx, dy = xx - cx * w, yy - cy * h
    d = np.sqrt(dx * dx + dy * dy); R0 = r * min(w, h); t = np.clip(d / R0, 0, 1)
    f = np.where(d < R0, np.power(t + 1e-6, 1 - k), 1.0)
    out = np.stack([map_coordinates(a[..., c], [cy * h + dy * f, cx * w + dx * f], order=1, mode='reflect') for c in range(3)], -1)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def deformar(im, fx, fy):
    """más ancha (fx > 1) o más alta (fy > 1), y otra vez al cuadrado del medio (lo que falta, con la misma foto borrosa)"""
    from PIL import Image, ImageFilter
    w, h = int(512 * fx), int(512 * fy); im2 = im.resize((w, h), Image.LANCZOS)
    if w < 512 or h < 512:
        fondo = im.filter(ImageFilter.GaussianBlur(18)); fondo.paste(im2, ((512 - w) // 2, (512 - h) // 2)); return fondo
    return im2.crop(((w - 512) // 2, (h - 512) // 2, (w - 512) // 2 + 512, (h - 512) // 2 + 512))


def quemar(im, fuerte=1.0):
    import io
    from PIL import Image, ImageEnhance
    im = ImageEnhance.Sharpness(ImageEnhance.Contrast(ImageEnhance.Color(im).enhance(1 + 1.3 * fuerte)).enhance(1 + .45 * fuerte)).enhance(1 + 2.5 * fuerte)
    for q in (16, 12):
        b = io.BytesIO(); im.resize((300, 300)).save(b, 'JPEG', quality=q); im = Image.open(b).convert('RGB').resize((512, 512), Image.BICUBIC)
    return im


def trucha(im, lado=120):
    """calidad de foto reenviada mil veces"""
    import io
    from PIL import Image
    b = io.BytesIO(); im.resize((lado, lado), Image.BILINEAR).save(b, 'JPEG', quality=24); return Image.open(b).convert('RGB').resize((512, 512), Image.BILINEAR)


def espejo(im):
    from PIL import Image
    a = im.copy(); a.paste(a.crop((0, 0, 256, 512)).transpose(Image.FLIP_LEFT_RIGHT), (256, 0)); return a


def lentes(im, x, y, ancho):
    """anteojos negros pixelados (dibujados acá, los de siempre de los memes)"""
    from PIL import ImageDraw
    d = ImageDraw.Draw(im); p = ancho / 14
    negros = [(i, 0) for i in range(14)] + [(i, 1) for i in (1, 2, 3, 4, 5, 8, 9, 10, 11, 12)] + [(i, 2) for i in (2, 3, 4, 9, 10, 11)]
    for i, j in negros: d.rectangle((x + i * p, y + j * p, x + (i + 1) * p - 1, y + (j + 1) * p - 1), fill='black')
    for i, j in ((2, 1), (9, 1)): d.rectangle((x + i * p, y + j * p, x + (i + 1) * p - 1, y + (j + 1) * p - 1), fill='white')
    return im


def aplicar(im, efecto, cara):
    """cara: (cx, cy, r) en fracciones, dónde está la cara (para el ojo de pez)"""
    for e in efecto.split('+'):
        if e == 'ojo': im = ojo_de_pez(im, *cara, k=.42)
        elif e == 'ojoq': im = quemar(ojo_de_pez(im, *cara, k=.42), .7)
        elif e == 'aplastar': im = deformar(im, 1.45, 1.0)
        elif e == 'ancho': im = deformar(im, 1.6, .85)
        elif e == 'estirar': im = deformar(im, .85, 1.55)
        elif e == 'quemar': im = quemar(im, 1.0)
        elif e == 'trucha': im = trucha(im)
        elif e == 'espejo': im = espejo(im)
        elif e.startswith('lentes:'): im = lentes(im, *[float(v) for v in e[7:].split(',')])
        elif e != 'nada': raise ValueError('efecto desconocido: ' + e)
    return im


def armar():
    """baja en grande las elegidas (memes_lista.py), las encuadra en el bicho (con la máscara de rembg), les aplica su
    efecto «xD» y las deja en web/memes/<pack>_<n>.webp (512, puntas redondeadas, borde blanco; las «tira» con la franja
    blanca arriba); escribe web/memes.js y web/memes/FUENTES.txt. Se puede cortar y volver a correr: sigue donde quedó."""
    from PIL import Image, ImageDraw, ImageEnhance
    from rembg import remove, new_session
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from memes_lista import PACKS
    todos = json.load(open(os.path.join(TMP, 'candidatos.json')))
    dest = os.path.join(RAIZ, 'web', 'memes'); os.makedirs(dest, exist_ok=True); os.makedirs(os.path.join(TMP, 'fotos'), exist_ok=True)
    ses, T0, faltan = None, time.time(), 0
    redondo = Image.new('L', (512, 512), 0); ImageDraw.Draw(redondo).rounded_rectangle((8, 8, 503, 503), radius=46, fill=255)
    borde = Image.new('L', (512, 512), 0); ImageDraw.Draw(borde).rounded_rectangle((0, 0, 511, 511), radius=54, fill=255)
    packs, fuentes, total = [], [], 0
    for pid, nom, desc, pais, tags, ms in PACKS:
        sts = []
        for j, (k, texto, em, efecto, estilo) in enumerate(ms):
            nombre = '%s_%02d' % (pid, j + 1); o = os.path.join(dest, nombre + '.webp'); c = todos[k]
            if not os.path.isfile(o):
                if time.time() - T0 > 540: faltan += 1; continue
                f = os.path.join(TMP, 'fotos', k + '.jpg')
                if not os.path.isfile(f):
                    try: traer(c['url'], f, 1024)
                    except Exception as e: print('no bajó', nombre, str(e)[:80]); faltan += 1; continue
                im = Image.open(f).convert('RGB'); W, H = im.size
                if nombre in RECORTES:   # (a mano: para dejar afuera un logo en la esquina)
                    fx, fy, fl = RECORTES[nombre]; lado = int(min(W, H) * fl); x = int(min(max(0, fx * W - lado / 2), W - lado)); y = int(min(max(0, fy * H - lado / 2), H - lado))
                    im = im.crop((x, y, x + lado, y + lado)); W, H = im.size
                # dónde está el bicho: la máscara en chico; el cuadrado lo contiene (un poco más arriba: la cara)
                ses = ses or new_session('isnet-general-use')
                ch = im.copy(); ch.thumbnail((448, 448)); esc = W / ch.width
                caja = remove(ch, session=ses, only_mask=True).point(lambda a: 255 if a > 100 else 0).getbbox()
                lado = min(W, H)
                if caja:
                    x0, y0, x1, y1 = [v * esc for v in caja]
                    lado = int(min(min(W, H), max(0.5 * min(W, H), 1.12 * max(x1 - x0, y1 - y0))))
                    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 - 0.06 * (y1 - y0)
                else: x0, y0, x1, y1 = 0, 0, W, H; cx, cy = W / 2, H / 2
                x = int(min(max(0, cx - lado / 2), W - lado)); y = int(min(max(0, cy - lado / 2), H - lado))
                im = im.crop((x, y, x + lado, y + lado)).resize((512, 512), Image.LANCZOS)
                # la cara, en fracciones del cuadrado: arriba del bicho (un tercio de su alto), centrada
                bw, bh = (x1 - x0) / lado, (y1 - y0) / lado
                cara = (min(.8, max(.2, ((x0 + x1) / 2 - x) / lado)), min(.75, max(.25, (y0 - y) / lado + .34 * bh)), min(.62, max(.34, .5 * max(bw, bh))))
                im = ImageEnhance.Sharpness(ImageEnhance.Color(im).enhance(1.15)).enhance(1.2)
                im = aplicar(im, efecto, cara)
                if estilo == 'tira':   # (la franja blanca arriba; la letra la pone la app)
                    nuevo = Image.new('RGB', (512, 512), 'white'); nuevo.paste(im.resize((512, 512 - TIRA), Image.LANCZOS), (0, TIRA)); im = nuevo
                st = Image.new('RGBA', (512, 512), (0, 0, 0, 0)); st.paste((255, 255, 255, 255), (0, 0), borde); st.paste(im, (0, 0), redondo)
                for q in (80, 72, 64, 56):
                    st.save(o, 'WEBP', quality=q, method=6)
                    if os.path.getsize(o) <= 80 * 1024: break
            total += os.path.getsize(o)
            sts.append({'img': 'memes/%s.webp' % nombre, 'texto': texto, 'emoji': em, 'estilo': estilo})
            fuentes.append('%s.webp — «%s» de %s (%s, vía %s) %s' % (nombre, (c['titulo'] or 'sin título').strip(), c['autor'] or 'autor desconocido', c['licencia'].upper(), c['fuente'], c['pagina']))
        if len(sts) >= 3: packs.append({'id': 'm_' + pid, 'nombre': nom, 'desc': desc, 'pais': pais, 'tags': tags, 'meme': True, 'stickers': sts})
    with open(os.path.join(dest, 'FUENTES.txt'), 'w', encoding='utf-8') as f:
        f.write('Fotos de los memes de Stickerazo: todas CC0 o de dominio público (encontradas con Openverse), recortadas,\n'
                'retocadas («xD»: ojo de pez, aplastadas, quemadas…) y con texto agregado por nosotros.\n'
                'Archivo — «título» de autor (licencia, vía sitio) página original.\n\n')
        f.write('\n'.join(fuentes) + '\n')
    with open(os.path.join(RAIZ, 'web', 'memes.js'), 'w', encoding='utf-8') as f:
        f.write('// generado por herramientas/memes_libres.py: los packs de memes (fotos libres; el texto lo pone la app)\n')
        f.write('export const TIRA = %d;   // (alto de la franja blanca de los memes «tira», de 512)\n' % TIRA)
        f.write('export const MEMES = ' + json.dumps(packs, ensure_ascii=False, separators=(',', ':')) + ';\n')
    n = sum(len(p['stickers']) for p in packs)
    print('memes: %d en %d packs (%.1f MB)%s' % (n, len(packs), total / 1048576, (' · faltan %d: volver a correr' % faltan) if faltan else ''))


if __name__ == '__main__':
    {'buscar': buscar, 'vistas': vistas, 'armar': armar}.get(sys.argv[1] if len(sys.argv) > 1 else '', lambda: print('uso: buscar | vistas | armar'))()
