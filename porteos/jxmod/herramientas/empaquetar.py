# Arma el paquete del juego para el HTML: datos.json + mallas + texturas webp + sonidos mp3 + íconos.
# Uso: python -I empaquetar.py SALIDA_EXPORT CRUDOS SALIDA_PAQUETE
import json, sys, os, gzip, subprocess, re, io
from PIL import Image
EXP, CRU, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
d = json.load(open(EXP + '/datos.json'))
NOMBRES = {'level4': 'Mars', 'level5': 'Base', 'level6': 'Desert', 'level7': 'FlatGrass', 'level8': 'Space',
           'level9': 'City', 'level10': 'BaseV2', 'level11': 'DesertV2'}

# ---------- menú de spawn ----------
def leer_menu(p):
    L = [l.rstrip('\n') for l in open(p)]
    cats = []; i = 1
    cur = None; sub = None
    while i < len(L):
        l = L[i]
        if l.startswith('STR ') and i + 1 < len(L) and L[i + 1].startswith('PTR Sprite:'):
            cur = dict(n=l[4:], ic=L[i + 1][11:], sub=[]); cats.append(cur); i += 2; continue
        if cur is not None and l.startswith('STR ') and i + 1 < len(L) and L[i + 1].startswith('I '):
            sub = dict(n=l[4:], it=[]); cur['sub'].append(sub); i += 2; continue
        if sub is not None and l.startswith('PTR GameObject:'): sub['it'].append(l[15:])
        if sub is not None and l.startswith('PTR Texture2D:'): sub['it'].append(l[14:])
        i += 1
    return cats
menu = leer_menu(CRU + '/menu_raw.txt')
herr = []
for l in open(CRU + '/tools_raw.txt'):
    t = l.strip().split('|')
    nm = t[0][5:]
    params = []
    for j, x in enumerate(t):
        if x.startswith('STR System.'):
            pn = t[j - 1][4:]; ty = x[11:]
            ops = []
            if ty == 'String[]':
                k = j + 1
                while k < len(t) and not t[k].startswith('STR'): k += 1
                while k < len(t) and t[k].startswith('STR ') and not (k + 1 < len(t) and t[k + 1].startswith('STR System.')):
                    ops.append(t[k][4:]); k += 1
            params.append(dict(n=pn, t=ty, o=ops))
    herr.append(dict(n=nm, p=params))
def lista_nombres(p):
    return [l[4:].strip() for l in open(p) if l.startswith('STR ')]
chars = lista_nombres(CRU + '/chars_raw.txt')
hats = lista_nombres(CRU + '/hats_raw.txt')
emotes = lista_nombres(CRU + '/emotes_raw.txt')

# ---------- texturas ----------
os.makedirs(OUT + '/t', exist_ok=True)
tex = []
for i, t in enumerate(d['texs']):
    im = Image.open(EXP + '/tex_orig/' + t['f'])
    alfa = im.mode == 'RGBA' and im.getextrema()[3][0] < 250
    if 'Splatmap' in t['n'] or 'Control' in t['n']: alfa = False
    im = im.convert('RGBA' if alfa else 'RGB')
    w, h = im.size
    m = 512 if max(w, h) >= 1024 else 256
    if max(w, h) > m:
        k = m / max(w, h); im = im.resize((max(4, int(w * k)), max(4, int(h * k))), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=72, method=6, exact=True); open(OUT + '/t/%d.webp' % i, 'wb').write(b.getvalue())
    tex.append(dict(n=t['n'], a=int(alfa), w=im.size[0], h=im.size[1]))

# ---------- sonidos ----------
os.makedirs(OUT + '/a', exist_ok=True)
sons = []
for f in sorted(os.listdir(EXP + '/audio_orig')):
    n = os.path.splitext(f)[0]
    dst = OUT + '/a/' + n + '.mp3'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', EXP + '/audio_orig/' + f, '-ac', '1', '-ar', '32000', '-b:a', '56k', dst], check=True)
    sons.append(n)

# ---------- íconos ----------
os.makedirs(OUT + '/i', exist_ok=True)
idx = json.load(open(EXP + '/sprites/_indice.json'))
ico = {}
for k, fn, sz in idx:
    im = Image.open(EXP + '/sprites/' + fn).convert('RGBA')
    lim = 512 if k == 'c' else 256 if k in ('Desert', 'desert 1', 'flatgrass', 'city', 'city3', 'base', 'basev2', 'Mars', 'Space', 'AIM2') else 128
    im.thumbnail((lim, lim), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=80, method=6)
    nm = re.sub(r'[^A-Za-z0-9_.-]', '_', k)
    open(OUT + '/i/' + nm + '.webp', 'wb').write(b.getvalue()); ico[k] = nm

# ---------- datos ----------
esc = {NOMBRES[k]: v for k, v in d['escenas'].items() if k in NOMBRES}
aj = {NOMBRES[k]: v for k, v in d.get('ajustes', {}).items() if k in NOMBRES}
an = json.load(open(EXP + '/anims.json'))
hu = json.load(open(EXP + '/humano.json')) if os.path.exists(EXP + '/humano.json') else None
# menú real (LobbyCanvas) sin paneles de compras/anuncios/pruebas, y la tabla de idiomas del juego
QUITAR = {'MapListTest', 'QuickConnectTest', 'ClearPlayerPrefsTest', 'GetAvatarTest', 'BonusPanel', 'Purchases', 'StarterPack', 'Ad', 'Bonus', 'GooglePlayGames',
          'NewVersionAvailable', 'Later', 'UpdateYN', 'UpdateRoot', 'StarterPackOld', 'BonusItemsPanel', 'Dicrord', 'SantaHat', 'PoliciButton', 'Create Map', 'NeedUpdate', 'StarterPackButton'}
def podar(n):
    n['ch'] = [podar(c) for c in n.get('ch', []) if c['n'] not in QUITAR]
    if not n['ch']: del n['ch']
    return n
mui = json.load(open(EXP + '/menu_ui.json')); mui['ui'] = podar(mui['ui'])
loc = json.load(open(EXP + '/loc.json'))
salida = dict(ui=mui, loc=loc, hu=hu, esc=esc, aj=aj, pf=d['prefabs'], mt=d['mats'], tx=tex, ms=d['mallas'], menu=menu, herr=herr,
              chars=chars, hats=hats, emotes=emotes, an=an, son=sons, ico=ico)
js = json.dumps(salida, separators=(',', ':')).encode()
open(OUT + '/d.json.gz', 'wb').write(gzip.compress(js, 9))
open(OUT + '/m.bin.gz', 'wb').write(gzip.compress(open(EXP + '/mallas.bin', 'rb').read(), 9))
def tam(p): return sum(os.path.getsize(os.path.join(p, f)) for f in os.listdir(p))
print('json', len(js) // 1024, 'KB gz', os.path.getsize(OUT + '/d.json.gz') // 1024, 'KB; mallas gz', os.path.getsize(OUT + '/m.bin.gz') // 1024,
      'KB; tex', tam(OUT + '/t') // 1024, 'KB; audio', tam(OUT + '/a') // 1024, 'KB; iconos', tam(OUT + '/i') // 1024, 'KB')
print('menu', [(c['n'], [(s['n'], len(s['it'])) for s in c['sub']]) for c in menu])
print('herr', [h['n'] for h in herr]); print(chars, hats, emotes)
