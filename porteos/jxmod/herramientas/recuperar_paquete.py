# Paso 2 de la recuperación (el 1 es herramientas/recuperar_web.mjs). Probado: el pk.bin y los 61 paquetes de rb salen idénticos.
# Rearma la carpeta del paquete (d.json.gz, m.bin.gz, t/, a/, i/, v/, carga/, fondos/) desde lo publicado:
# pk.bin descifrado + idx.json + juego.js (de descifrar.mjs), web/rb/*.rbp y el index.html publicado.
# Deshace lo que hacen armar.py (filtrar_indices) y herramientas/remotos.py (partir): las mallas de cada paquete aparte
# vuelven al bloque (al final), sin las marcas 'k' ni 'rbp'. Uso: python3 -I reconstruir.py PLANO WEB SALIDA
import sys, os, json, gzip, struct, re, base64, io
import numpy as np
PL, WEB, OUT = sys.argv[1:4]
pk = open(os.path.join(PL, 'pk.bin'), 'rb').read(); ix = json.load(open(os.path.join(PL, 'idx.json')))
parte = lambda k: pk[ix[k][0]:ix[k][0] + ix[k][1]]
DJ = json.loads(gzip.decompress(parte('d'))); MBl = bytearray(gzip.decompress(parte('m')))
ms = DJ['ms']
def largo_idx(m):
    s = m.get('sub'); return (max(a + b for a, b in s) * (4 if m.get('i32') else 2)) if s and m.get('i') is not None else 0
def desfiltrar(mb, lista):
    hechos = set()
    for m in lista:
        if m.get('o') is None or not m.get('sub') or m['i'] in hechos: continue
        hechos.add(m['i']); n = max(s[0] + s[1] for s in m['sub']); w = 4 if m['i32'] else 2
        z = np.frombuffer(bytes(mb[m['i']:m['i'] + n * w]), np.uint8).reshape(w, n).T.copy().view(np.uint32 if w == 4 else np.uint16).reshape(-1).astype(np.int64)
        sg = np.where(z & 1, -((z + 1) >> 1), z >> 1); md = 1 << (8 * w)
        a = np.cumsum(sg) % md
        mb[m['i']:m['i'] + n * w] = a.astype(np.uint32 if w == 4 else np.uint16).tobytes()
    return mb
# 1) el bloque que quedó en el paquete: sus índices sin filtrar (sólo las mallas que no se fueron)
assert ix['m'][2] == 1
MB = desfiltrar(MBl, [m for m in ms if not m.get('k')])
# 2) cada paquete aparte: su bloque (sin filtrar) va al final; sus mallas apuntan ahí
TX = {int(k[1:]): parte(k) for k in ix if re.fullmatch(r't\d+', k)}
AU = {k[2:]: parte(k) for k in ix if k.startswith('a:')}
for g, (nom, tam) in sorted((DJ.get('rbp') or {}).items()):
    b = open(os.path.join(WEB, 'rb', nom), 'rb').read(); assert b[:4] == b'RBP1' and len(b) == tam, nom
    n = struct.unpack('<I', b[4:8])[0]; idx = json.loads(b[8:8 + n]); cu = b[8 + n:]
    if idx.get('m'):
        sub = [m for m in ms if m.get('k') == g]
        blk = desfiltrar(bytearray(gzip.decompress(cu[idx['m'][0]:idx['m'][0] + idx['m'][1]])), sub)
        base = len(MB); MB += blk
        for m in sub:
            for c in ('o', 'sk', 'i'):
                if m.get(c) is not None and (c != 'i' or largo_idx(m)): m[c] += base
    for t, (o, l) in idx.get('t', {}).items(): TX[int(t)] = cu[o:o + l]
    for a, (o, l) in idx.get('a', {}).items(): AU.setdefault(a, cu[o:o + l])
for m in ms: m.pop('k', None)
for t in DJ.get('tx') or []:
    if isinstance(t, dict): t.pop('k', None)
DJ.pop('rbp', None)
os.makedirs(OUT, exist_ok=True)
for d in ('t', 'a', 'i', 'v', 'carga', 'fondos'): os.makedirs(os.path.join(OUT, d), exist_ok=True)
with gzip.open(os.path.join(OUT, 'd.json.gz'), 'wt', encoding='utf-8') as f: json.dump(DJ, f, separators=(',', ':'), ensure_ascii=False)
open(os.path.join(OUT, 'm.bin.gz'), 'wb').write(gzip.compress(bytes(MB), 6))
for t, b in TX.items(): open(os.path.join(OUT, 't', '%d.bin' % t), 'wb').write(b)
for a, b in AU.items(): open(os.path.join(OUT, 'a', a + '.bin'), 'wb').write(b)
for k in ix:
    if k.startswith('i:'): open(os.path.join(OUT, 'i', k[2:] + '.webp'), 'wb').write(parte(k))
    if k.startswith('v:'): open(os.path.join(OUT, 'v', k[2:] + '.mp4'), 'wb').write(parte(k))
# 3) las fotos de fondo: las de la pantalla de carga (en el HTML) y las del inicio (en el JS)
from PIL import Image
html = open(os.path.join(WEB, 'index.html'), encoding='utf-8').read()
m = re.search(r"var FON = \[(.*?)\], capas", html, re.S)
for n, (nom, uri) in enumerate(re.findall(r"\['([^']*)','(data:image/[a-z]+;base64,[^']+)'\]", m.group(1) if m else '')):
    Image.open(io.BytesIO(base64.b64decode(uri.split(',', 1)[1]))).save(os.path.join(OUT, 'carga', '%02d_%s.png' % (n, nom)))
js = open(os.path.join(PL, 'juego.js'), encoding='utf-8').read(); SEP = '\n/*@@JUEGO@@*/\n'; k = js.index(SEP)
open(os.path.join(OUT, 'mqtt.min.js'), 'w', encoding='utf-8').write(js[:k])
m = re.search(r"const FONDOS_RB = \[(.*?)\];", js[k:], re.S)
for n, uri in enumerate(re.findall(r"'(data:image/[a-z]+;base64,[^']+)'", m.group(1) if m else '')):
    Image.open(io.BytesIO(base64.b64decode(uri.split(',', 1)[1]))).save(os.path.join(OUT, 'fondos', '%02d.png' % n))
print('ok mallas', len(ms), 'bloque', round(len(MB) / 1e6, 1), 'MB · texturas', len(TX), '· sonidos', len(AU), '· carga', len(os.listdir(os.path.join(OUT, 'carga'))), '· fondos', len(os.listdir(os.path.join(OUT, 'fondos'))))
