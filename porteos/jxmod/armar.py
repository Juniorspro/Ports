# Arma JXMod.html: plantilla + módulos JS en orden + el paquete del juego (base64) adentro.
# Uso: python3 -I armar.py PAQUETE SALIDA.html
import re, os, sys, json, base64, gzip
AQUI = os.path.dirname(os.path.abspath(__file__))
PK, OUT = sys.argv[1], sys.argv[2]
ORDEN = ['nucleo', 'ios', 'cajanegra', 'tiendared', 'gl', 'sombras', 'post', 'datos', 'modelo', 'fisica', 'mundo', 'jugador', 'objetos', 'vista', 'audio', 'efectos', 'agua', 'sonidos', 'armas', 'patadas',
         'vehiculos', 'herramientas', 'personas', 'humano', 'emotes', 'red', 'dia', 'anfitrion', 'marcas', 'entrada', 'ui', 'armaaj', 'hud', 'menu', 'idiomas', 'formato', 'idiomas3', 'ruleta', 'iconos', 'acciones', 'modapi', 'voz', 'geo', 'entidades', 'maquinitas', 'memes', 'celular', 'celumano', 'artefactos', 'nucleares', 'nuclear_vol', 'gmod_formatos', 'gmod', 'gmod_pipe', 'gmod_lib', 'gmod_steam', 'gmod_bsp', 'puertas', 'mapaio', 'portales', 'cielo3d', 'gmod_modos', 'gmod_lua', 'gmod_prelude', 'gmod_api', 'gmod_sonidos', 'gmod_cargar', 'gmod_render', 'gmod_dx9', 'gmod_rt', 'gmod_vista', 'gmod_pm', 'gmod_autorig', 'gmod_spawn', 'gmod_nextbot', 'gmod_tienda', 'gmod_cola', 'gmod_panel', 'gmod_server', 'celulares', 'npc', 'censura', 'cuenta', 'social', 'gorros', 'juntos', 'pantalla', 'nativos', 'ciclope', 'verity', 'veritycrea', 'animedit', 'creador', 'smods', 'modmenu', 'noche', 'linterna', 'tutorial', 'inicio', 'milogo', 'iconosapp', 'iconoapp', 'emomusica', 'rbmenus', 'lan', 'camlibre', 'controles', 'hudorden', 'banco', 'evento', 'principal']
# el formato de mods y mapas es el mismo archivo que usa el servidor de la tienda (sin los "export")
FORMATO = re.sub(r'(?m)^export ', '', open(os.path.join(AQUI, 'tienda', 'formato.js'), encoding='utf-8').read())
leer = lambda n: FORMATO if n == 'formato' else open(os.path.join(AQUI, 'juego', n + '.js'), encoding='utf-8').read()
# la guía de diseño (diseno/guia_diseno.json): lo que se le dice a la IA que ordena los botones
def _guia():
    try:
        g = json.load(open(os.path.join(AQUI, 'diseno', 'guia_diseno.json'), encoding='utf-8'))
        return 'const GUIA_DISENO = ' + json.dumps({'para_ia': g.get('para_ia', ''), 'fuentes': len(g.get('fuentes', []))}, ensure_ascii=False) + ';'
    except Exception:
        return 'const GUIA_DISENO = null;'
_leer0 = leer
leer = lambda n: _leer0(n).replace('const GUIA_DISENO = null;', _guia(), 1) if n == 'hudorden' else _leer0(n)
js = '(() => {\n"use strict";\n' + '\n'.join(leer(n) for n in ORDEN) + '\n})();'
# la fecha del armado (se ve en el inicio: así se sabe qué versión abrió el navegador)
import datetime
js = js.replace('__ARMADO__', datetime.datetime.now(datetime.timezone.utc).strftime('%d/%m/%Y %H:%M UTC'))
# el catálogo de los emotes de captura de movimiento (los archivos van al lado del HTML, en web/emotes/cmu)
CMUC = os.path.join(AQUI, '..', '..', 'web', 'emotes', 'cmu', 'catalogo.json')
if os.path.exists(CMUC):
    # (con las miniaturas: la silueta de cada una, hecha por pruebas/emotes_minis.mjs, va como sexto dato de cada uno)
    _cat = json.load(open(CMUC, encoding='utf-8')); _mp = os.path.join(os.path.dirname(CMUC), 'minis.json')
    if os.path.exists(_mp):
        _m = json.load(open(_mp, encoding='utf-8'))
        for _it in _cat['items']:
            if _it[0] in _m: _it[5:] = [_m[_it[0]]]
    js = js.replace('/*CMUCAT*/null', json.dumps(_cat, ensure_ascii=False, separators=(',', ':')))
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
    RBD = os.environ.get('RB_DIR') or os.path.join(os.path.dirname(os.path.abspath(OUT)), 'rb'); os.makedirs(RBD, exist_ok=True)
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
MQTT_TXT = open(MQTT, encoding='utf-8').read() if MQTT else ''
# (mqtt-packet arma, la primera vez que manda algo, un búfer de 2 bytes para cada número de 16 bits: 65 536 búferes, ~7 MB
# de memoria de JavaScript, aunque se juegue solo —el juego se conecta para la lista de servers y los amigos—. Se arma
# sólo el número que se usa, cuando se usa: en un celular de 512 MB eso importa)
def _mqtt_numeros(t):
    m = re.search(r'function (\w+)\(\)\{for\(let t=0;t<(\w+);t\+\+\)(\w+)\[t\]=(\w+)\(t\)\}', t)
    if not m: return t
    fn, n, cache, gen = m.groups()
    d = re.search(r'([,\s])' + re.escape(cache) + r'=\{\}', t)
    if not d: return t
    t = t[:m.start()] + 'function ' + fn + '(){}' + t[m.end():]
    return t.replace(d.group(0), d.group(1) + cache + '=new Proxy({},{get:(o,k)=>typeof k!=="string"||o[k]?o[k]:(o[k]=' + gen + '(+k))})', 1)
if MQTT_TXT: MQTT_TXT = _mqtt_numeros(MQTT_TXT)
# (con el código comprimido, la biblioteca de la sala va adentro del mismo gzip, justo antes del juego: 369 KB → ~110)
if os.environ.get('JS_PLANO'): html = html.replace('/*MQTT*/', MQTT_TXT.replace('</script', '<\\/script'))
else: html = html.replace('<script>/*MQTT*/</script>\n', '')
J = lambda n: base64.b64encode(open(os.path.join(AQUI, 'juego', n), 'rb').read()).decode()
# la versión del juego (JX_VERSION de nucleo.js) también en la pantalla de carga, que se ve antes de que corra el juego
VERSION = re.search(r"const JX_VERSION = '([^']+)'", leer('nucleo')).group(1)
html = html.replace('/*VERSION*/', VERSION)
html = html.replace('/*LOGORB*/', J('logo_jxm.webp'))
html = html.replace('/*LOGODR*/', J('logo_jxm.webp'))  # el logo de JXMod (apk/logo_jxm_original.jpg → herramientas/logo_jxm.py)
html = html.replace('/*FUENTEOSWALD*/', J('fuentes/oswald_jx.woff2'))  # la letra del menú (Oswald, OFL: juego/fuentes/OFL_Oswald.txt)
# fondos de la pantalla de carga (capturas del juego, fuera del repo): PAQUETE/carga/N_nombre.jpg → [nombre, dataURI]
CD = os.path.join(PK, 'carga')
# (las fotos de fondo van en WebP calidad 82: un 32 % menos que los JPEG y sin diferencia a la vista, PSNR ≥ 37,8 dB)
def img64(ruta):
    try:
        from PIL import Image
        import io
        bio = io.BytesIO(); Image.open(ruta).convert('RGB').save(bio, 'WEBP', quality=82, method=6)
        return 'data:image/webp;base64,' + base64.b64encode(bio.getvalue()).decode()
    except ImportError:
        return 'data:image/jpeg;base64,' + base64.b64encode(open(ruta, 'rb').read()).decode()
html = html.replace('/*FONDOSCARGA*/', ','.join("['" + f.split('_', 1)[1][:-4] + "','" + img64(os.path.join(CD, f)) + "']" for f in (sorted(os.listdir(CD)) if os.path.isdir(CD) else [])))
# fondos del inicio (escenas del juego, fuera del repo): PAQUETE/fondos/*.jpg
FD = os.path.join(PK, 'fondos')
fondos = sorted(os.listdir(FD)) if os.path.isdir(FD) else []
# íconos dibujados para el juego (juego/iconos/*.svg, de herramientas/iconos.py)
ICD = os.path.join(AQUI, 'juego', 'iconos')
js = js.replace('/*ICONOSRB*/', ','.join(f"{f[:-4]}:'data:image/svg+xml;base64," + base64.b64encode(open(os.path.join(ICD, f), 'rb').read()).decode() + "'" for f in sorted(os.listdir(ICD)) if f.endswith('.svg')))
js = js.replace('/*FONDOSRB*/', ','.join("'" + img64(os.path.join(FD, f)) + "'" for f in fondos))
# PK_BIN=1 (la app de Android): el paquete va como archivo binario aparte (pk.bin, al lado del HTML) en vez de base64
# dentro del HTML: ~28 MB menos de texto que el teléfono tiene que leer y guardar al arrancar
PK_BIN = bool(os.environ.get('PK_BIN'))
if PK_BIN:
    open(os.path.join(os.path.dirname(os.path.abspath(OUT)), 'pk.bin'), 'wb').write(bytes(blob)); pk64 = ''
    html = html.replace('/*PKLEN*/0', str(len(blob)))
else:
    pk64 = base64.b64encode(bytes(blob)).decode()
    html = html.replace('/*PKLEN*/0', str(len(pk64)))  # para que la pantalla de carga muestre cuánto se bajó
# el paquete va en pedazos de 1 MB (múltiplo de 4: cada uno se decodifica solo): mientras el HTML baja, la pantalla de
# carga cuenta los pedazos que llegaron (el texto de un solo bloque gigante recién aparece al final)
CH = 1 << 20
pks = '<script id="pkbin" type="text/plain" data-src="pk.bin"></script>\n' if PK_BIN else \
    ''.join('<script class="pk" type="text/plain">' + pk64[i:i + CH] + '</script>\n' for i in range(0, len(pk64), CH))
# el código del juego va comprimido (gzip en base64: ~1 MB menos de HTML) y lo descomprime y ejecuta un arranque chico que
# va sin comprimir, con el gzip en JS (inflar.js) para los navegadores sin DecompressionStream. JS_PLANO=1: como antes
INFLAR = open(os.path.join(AQUI, 'juego', 'inflar.js'), encoding='utf-8').read()
if os.environ.get('JS_PLANO'):
    bloque = '<script>\n' + INFLAR + '\n' + js + '\n</script>'
else:
    # (la biblioteca de la sala va separada por una marca: el arranque la evalúa aparte y, si un navegador viejo no la
    # entiende, el juego igual arranca sin el modo en línea; antes un error de sintaxis ahí tiraba abajo todo el juego)
    jsgz = base64.b64encode(gzip.compress(((MQTT_TXT + '\n/*@@JUEGO@@*/\n' if MQTT_TXT else '') + js).encode('utf-8'), 9, mtime=0)).decode()
    bloque = ('<script id="jsgz" type="text/plain">' + jsgz + '</script>\n<script>\n' + INFLAR + '''
// arranque: el código del juego (arriba, en gzip) se descomprime en segundo plano con el descompresor del navegador (la
// intro sigue fluida) y se ejecuta; el paquete se sigue leyendo mientras baja. Sin descompresor, con el gzip en JS
(async () => {
  const el = document.getElementById('jsgz'); let u = null;
  // (la página con código: el juego viene cifrado en juego.bin y lo abre el código que pone el jugador; ver
  // herramientas/codigo_web.mjs. Hasta que no hay un código bueno, el juego no arranca)
  if (typeof jxCodigoJuego === 'function') u = await jxCodigoJuego();
  const s = u ? '' : el.textContent;
  if (!u && typeof Uint8Array.fromBase64 === 'function') { try { u = Uint8Array.fromBase64(s); } catch (e) { u = null; } }
  if (!u) { const n = s.length, a = new Uint8Array(Math.floor(n * 3 / 4)); let o = 0; for (let i = 0; i < n; i += 65536) { const b = atob(s.slice(i, i + 65536)); for (let j = 0; j < b.length; j++) a[o++] = b.charCodeAt(j); } u = a.subarray(0, o); }
  let c = null;
  if (typeof DecompressionStream === 'function' && Blob.prototype.stream) { try { c = new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()); } catch (e) { c = null; } }
  if (!c) c = gunzipJS(u);
  el.textContent = '';
  const t = new TextDecoder().decode(c), SEP = '\\n/*@@JUEGO@@*/\\n', k = t.indexOf(SEP);
  // (la sala en línea con eval indirecto; su error, si lo hay, se ataja acá y no frena el arranque. mqtt.min.js empieza con
  // "use strict" y así su var mqtt queda adentro del eval, no global: sin esta línea el juego nunca veía la librería y
  // el multijugador decía «Sin conexión con los servers» aunque hubiera internet)
  if (k >= 0) { try { (0, eval)(t.slice(0, k) + '\\n;if (typeof mqtt !== "undefined") globalThis.mqtt = mqtt;\\n//# sourceURL=sala.js'); } catch (e) { try { console.warn('sin modo en línea: ' + e); } catch (x) {} } }
  const sc = document.createElement('script'); sc.textContent = (k >= 0 ? t.slice(k + SEP.length) : t) + '\\n//# sourceURL=rezobox.js'; document.body.appendChild(sc);
  // (con la página con código, el juego ya abierto no queda a la vista en la página)
  if (typeof jxCodigoJuego === 'function') { sc.remove(); sc.textContent = ''; }
})();
</script>''')
# APP_WEB=1 (la app web instalable, para iPhone/iPad y cualquier navegador: web/index.html, de herramientas/web_app.py):
# manifiesto, íconos de inicio de iOS y el service worker que la deja andar sin internet
if os.environ.get('APP_WEB'):
    cab = ('<link rel="manifest" href="manifest.webmanifest">\n<meta name="apple-mobile-web-app-capable" content="yes">\n'
           '<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
           '<meta name="apple-mobile-web-app-title" content="JXMod">\n<link rel="apple-touch-icon" href="app/icono-180.png">\n'
           '<link rel="icon" type="image/png" sizes="192x192" href="app/icono-192.png">\n'
           "<script>window.JX_APPWEB = 1; if ('serviceWorker' in navigator && window.isSecureContext) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>")
    assert '<title>JXMod</title>' in html
    html = html.replace('<title>JXMod</title>', '<title>JXMod</title>\n' + cab, 1)
html = html.replace('/*PKIDX*/', json.dumps(idx, separators=(',', ':'))).replace('<!--PK-->', pks)
assert '<script>\n/*JS*/\n</script>' in html
html = html.replace('<script>\n/*JS*/\n</script>', bloque)
open(OUT, 'w', encoding='utf-8').write(html)
print('ok', OUT, round(os.path.getsize(OUT) / 1e6, 2), 'MB', 'js', len(js) // 1024, 'KB', 'partes', len(partes))
