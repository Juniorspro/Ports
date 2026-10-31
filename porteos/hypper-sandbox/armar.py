# Arma Hypper.html: plantilla + módulos JS en orden + el paquete del juego (base64) adentro.
# Uso: python3 -I armar.py PAQUETE SALIDA.html
import re, os, sys, json, base64, gzip
AQUI = os.path.dirname(os.path.abspath(__file__))
PK, OUT = sys.argv[1], sys.argv[2]
ORDEN = ['nucleo', 'gl', 'sombras', 'post', 'datos', 'modelo', 'fisica', 'mundo', 'jugador', 'objetos', 'vista', 'audio', 'efectos', 'agua', 'sonidos', 'armas', 'patadas',
         'vehiculos', 'herramientas', 'personas', 'humano', 'emotes', 'red', 'dia', 'anfitrion', 'marcas', 'entrada', 'ui', 'hud', 'menu', 'idiomas', 'formato', 'idiomas3', 'iconos', 'modapi', 'voz', 'geo', 'entidades', 'maquinitas', 'memes', 'pantalla', 'nativos', 'ciclope', 'verity', 'veritycrea', 'animedit', 'creador', 'smods', 'modmenu', 'noche', 'inicio', 'rbmenus', 'principal']
# el formato de mods y mapas es el mismo archivo que usa el servidor de la tienda (sin los "export")
FORMATO = re.sub(r'(?m)^export ', '', open(os.path.join(AQUI, 'tienda', 'formato.js'), encoding='utf-8').read())
leer = lambda n: FORMATO if n == 'formato' else open(os.path.join(AQUI, 'juego', n + '.js'), encoding='utf-8').read()
js = '(() => {\n"use strict";\n' + '\n'.join(leer(n) for n in ORDEN) + '\n})();'
# la fecha del armado (se ve en el inicio: así se sabe qué versión abrió el navegador)
import datetime
js = js.replace('__ARMADO__', datetime.datetime.now(datetime.timezone.utc).strftime('%d/%m/%Y %H:%M UTC'))
# el catálogo de los emotes de captura de movimiento (los archivos van al lado del HTML, en hypper/emotes/cmu)
CMUC = os.path.join(AQUI, '..', '..', 'hypper', 'emotes', 'cmu', 'catalogo.json')
if os.path.exists(CMUC): js = js.replace('/*CMUCAT*/null', open(CMUC, encoding='utf-8').read().strip())
# las mallas: los índices de los triángulos van como diferencias (módulo 2^16 o 2^32, en zigzag) con los bytes en planos
# (todos los bajos, después los altos), en el mismo lugar y con el mismo largo: así el gzip los achica casi a la mitad
# (las mallas bajan de ~20 a ~17 MB). El juego los vuelve a armar al cargar (desfiltrarIndices en datos.js)
def filtrar_indices(mb, ms):
    import numpy as np
    hechos = set()
    for m in ms:
        if m.get('o') is None or not m.get('sub') or m['i'] in hechos: continue
        hechos.add(m['i']); n = max(s[0] + s[1] for s in m['sub']); w = 4 if m['i32'] else 2
        a = np.frombuffer(bytes(mb[m['i']:m['i'] + n * w]), np.uint32 if w == 4 else np.uint16).astype(np.int64)
        md = 1 << (8 * w); dl = np.diff(a, prepend=0) % md; sg = np.where(dl >= md // 2, dl - md, dl)
        z = np.where(sg >= 0, sg * 2, -sg * 2 - 1).astype(np.uint32 if w == 4 else np.uint16)
        mb[m['i']:m['i'] + n * w] = z.view(np.uint8).reshape(-1, w).T.reshape(-1).tobytes()
    return mb
DJ = json.load(gzip.open(os.path.join(PK, 'd.json.gz')))
MB = bytearray(gzip.decompress(open(os.path.join(PK, 'm.bin.gz'), 'rb').read()))
TX = {int(f.split('.')[0]): open(os.path.join(PK, 't', f), 'rb').read() for f in os.listdir(os.path.join(PK, 't'))}
# lo pesado que no hace falta para arrancar (personajes y mapas grandes) va en paquetes aparte, en rb/ al lado del HTML
# (herramientas/remotos.py; RB_ENTERO=1 para meter todo adentro, como antes)
if not os.environ.get('RB_ENTERO'):
    sys.path.insert(0, os.path.join(AQUI, 'herramientas')); import remotos
    AU = {f[:-4]: open(os.path.join(PK, 'a', f), 'rb').read() for f in os.listdir(os.path.join(PK, 'a'))}
    MB, RBPS = remotos.partir(DJ, MB, TX, filtrar_indices, AU)
    RBD = os.path.join(os.path.dirname(os.path.abspath(OUT)), 'rb'); os.makedirs(RBD, exist_ok=True)
    for nom, b in RBPS.items():
        if not os.path.exists(os.path.join(RBD, nom)): open(os.path.join(RBD, nom), 'wb').write(b)
    print('paquetes aparte', len(RBPS), round(sum(len(b) for b in RBPS.values()) / 1e6, 1), 'MB en', RBD)
MB = filtrar_indices(MB, [m for m in DJ['ms'] if not m.get('k')])
# paquete: un solo bloque con índice
partes = [('d', gzip.compress(json.dumps(DJ, separators=(',', ':')).encode(), 9, mtime=0)), ('m', gzip.compress(bytes(MB), 9, mtime=0))]
for t in sorted(TX):
    partes.append(('t' + str(t), TX[t]))
for f in sorted(os.listdir(os.path.join(PK, 'a'))):
    if os.environ.get('RB_ENTERO') or f[:-4] in AU: partes.append(('a:' + f[:-4], open(os.path.join(PK, 'a', f), 'rb').read()))
for f in sorted(os.listdir(os.path.join(PK, 'i'))):
    partes.append(('i:' + f[:-5], open(os.path.join(PK, 'i', f), 'rb').read()))
# videos cortos (los sustos de la pizzería): mp4
VD = os.path.join(PK, 'v')
for f in sorted(os.listdir(VD)) if os.path.isdir(VD) else []:
    partes.append(('v:' + f[:-4], open(os.path.join(VD, f), 'rb').read()))
idx, blob, o = {}, bytearray(), 0
for k, b in partes:
    idx[k] = [o, len(b)]; blob += b; o += len(b)
idx['m'].append(1)   # (índices filtrados)
html = open(os.path.join(AQUI, 'juego', 'template.html'), encoding='utf-8').read()
MQTT = os.environ.get('MQTT_JS', '')  # mqtt.min.js 5.x bajado aparte (no va al repo)
html = html.replace('/*MQTT*/', open(MQTT, encoding='utf-8').read().replace('</script', '<\\/script') if MQTT else '')
J = lambda n: base64.b64encode(open(os.path.join(AQUI, 'juego', n), 'rb').read()).decode()
html = html.replace('/*LOGORB*/', J('logo_rezobox.webp'))
html = html.replace('/*LOGODR*/', J('logo_dr.webp'))  # la R de Rezona + definitive rezobox
# fondos de la pantalla de carga (capturas del juego, fuera del repo): PAQUETE/carga/N_nombre.jpg → [nombre, dataURI]
CD = os.path.join(PK, 'carga')
html = html.replace('/*FONDOSCARGA*/', ','.join("['" + f.split('_', 1)[1][:-4] + "','data:image/jpeg;base64," + base64.b64encode(open(os.path.join(CD, f), 'rb').read()).decode() + "']" for f in (sorted(os.listdir(CD)) if os.path.isdir(CD) else [])))
# fondos del inicio (escenas del juego, fuera del repo): PAQUETE/fondos/*.jpg
FD = os.path.join(PK, 'fondos')
fondos = sorted(os.listdir(FD)) if os.path.isdir(FD) else []
# íconos dibujados para el juego (juego/iconos/*.svg, de herramientas/iconos.py)
ICD = os.path.join(AQUI, 'juego', 'iconos')
js = js.replace('/*ICONOSRB*/', ','.join(f"{f[:-4]}:'data:image/svg+xml;base64," + base64.b64encode(open(os.path.join(ICD, f), 'rb').read()).decode() + "'" for f in sorted(os.listdir(ICD)) if f.endswith('.svg')))
js = js.replace('/*FONDOSRB*/', ','.join("'data:image/jpeg;base64," + base64.b64encode(open(os.path.join(FD, f), 'rb').read()).decode() + "'" for f in fondos))
pk64 = base64.b64encode(bytes(blob)).decode()
html = html.replace('/*PKLEN*/0', str(len(pk64)))  # para que la pantalla de carga muestre cuánto se bajó
# el paquete va en pedazos de 1 MB (múltiplo de 4: cada uno se decodifica solo): mientras el HTML baja, la pantalla de
# carga cuenta los pedazos que llegaron (el texto de un solo bloque gigante recién aparece al final)
CH = 1 << 20
pks = ''.join('<script class="pk" type="text/plain">' + pk64[i:i + CH] + '</script>\n' for i in range(0, len(pk64), CH))
html = html.replace('/*PKIDX*/', json.dumps(idx, separators=(',', ':'))).replace('<!--PK-->', pks).replace('/*JS*/', js)
open(OUT, 'w', encoding='utf-8').write(html)
print('ok', OUT, round(os.path.getsize(OUT) / 1e6, 2), 'MB', 'js', len(js) // 1024, 'KB', 'partes', len(partes))
