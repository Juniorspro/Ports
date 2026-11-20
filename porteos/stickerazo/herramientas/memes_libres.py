# Memes con fotos de verdad pero libres para uso comercial: sólo CC0 o dominio público (Openverse: Flickr, Wikimedia…),
# sin personas (animales, comida, cosas). Se bajan, se eligen a mano mirando las hojas de contacto, se recortan (rembg,
# sólo como herramienta acá: no va en la app) y el texto del meme lo pone la app (se puede cambiar en el editor).
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


def armar():
    """baja en grande las elegidas (memes_lista.py), las encuadra en el bicho (con la máscara de rembg), les da color de
    meme y las deja en web/memes/<pack>_<n>.webp (512, puntas redondeadas, borde blanco); escribe web/memes.js y
    web/memes/FUENTES.txt. Se puede cortar y volver a correr: sigue donde quedó."""
    import io
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
        for j, (k, ar, ab, em, xd) in enumerate(ms):
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
                else: cx, cy = W / 2, H / 2
                x = int(min(max(0, cx - lado / 2), W - lado)); y = int(min(max(0, cy - lado / 2), H - lado))
                im = im.crop((x, y, x + lado, y + lado)).resize((512, 512), Image.LANCZOS)
                im = ImageEnhance.Contrast(ImageEnhance.Color(im).enhance(1.7 if xd else 1.18)).enhance(1.25 if xd else 1.05)
                if xd:   # (la calidad trucha a propósito)
                    im = ImageEnhance.Sharpness(im).enhance(2.2); b = io.BytesIO(); im.resize((256, 256)).save(b, 'JPEG', quality=18)
                    im = Image.open(b).convert('RGB').resize((512, 512), Image.NEAREST)
                else: im = ImageEnhance.Sharpness(im).enhance(1.25)
                st = Image.new('RGBA', (512, 512), (0, 0, 0, 0)); st.paste((255, 255, 255, 255), (0, 0), borde); st.paste(im, (0, 0), redondo)
                for q in (80, 72, 64, 56):
                    st.save(o, 'WEBP', quality=q, method=6)
                    if os.path.getsize(o) <= 80 * 1024: break
            total += os.path.getsize(o)
            sts.append({'img': 'memes/%s.webp' % nombre, 'arriba': ar, 'abajo': ab, 'emoji': em})
            fuentes.append('%s.webp — «%s» de %s (%s, vía %s) %s' % (nombre, (c['titulo'] or 'sin título').strip(), c['autor'] or 'autor desconocido', c['licencia'].upper(), c['fuente'], c['pagina']))
        if len(sts) >= 3: packs.append({'id': 'm_' + pid, 'nombre': nom, 'desc': desc, 'pais': pais, 'tags': tags, 'meme': True, 'stickers': sts})
    with open(os.path.join(dest, 'FUENTES.txt'), 'w', encoding='utf-8') as f:
        f.write('Fotos de los memes de Stickerazo: todas CC0 o de dominio público (encontradas con Openverse), recortadas,\n'
                'retocadas y con texto agregado por nosotros. Archivo — «título» de autor (licencia, vía sitio) página original.\n\n')
        f.write('\n'.join(fuentes) + '\n')
    with open(os.path.join(RAIZ, 'web', 'memes.js'), 'w', encoding='utf-8') as f:
        f.write('// generado por herramientas/memes_libres.py: los packs de memes (fotos libres; el texto lo pone la app)\n')
        f.write('export const MEMES = ' + json.dumps(packs, ensure_ascii=False, separators=(',', ':')) + ';\n')
    n = sum(len(p['stickers']) for p in packs)
    print('memes: %d en %d packs (%.1f MB)%s' % (n, len(packs), total / 1048576, (' · faltan %d: volver a correr' % faltan) if faltan else ''))


if __name__ == '__main__':
    {'buscar': buscar, 'vistas': vistas, 'armar': armar}.get(sys.argv[1] if len(sys.argv) > 1 else '', lambda: print('uso: buscar | vistas | armar'))()
