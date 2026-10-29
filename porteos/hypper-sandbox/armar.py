# Arma Hypper.html: plantilla + módulos JS en orden + el paquete del juego (base64) adentro.
# Uso: python3 -I armar.py PAQUETE SALIDA.html
import os, sys, json, base64, gzip
AQUI = os.path.dirname(os.path.abspath(__file__))
PK, OUT = sys.argv[1], sys.argv[2]
ORDEN = ['nucleo', 'gl', 'sombras', 'post', 'datos', 'modelo', 'fisica', 'mundo', 'jugador', 'objetos', 'vista', 'audio', 'efectos', 'armas',
         'vehiculos', 'herramientas', 'personas', 'humano', 'red', 'dia', 'anfitrion', 'marcas', 'entrada', 'ui', 'menu', 'idiomas', 'formato', 'iconos', 'modapi', 'voz', 'geo', 'entidades', 'nativos', 'creador', 'smods', 'modmenu', 'inicio', 'principal']
# el formato de mods y mapas es el mismo archivo que usa el servidor de la tienda (sin los "export")
FORMATO = open(os.path.join(AQUI, 'tienda', 'formato.js'), encoding='utf-8').read().replace('export const ', 'const ').replace('export function ', 'function ')
leer = lambda n: FORMATO if n == 'formato' else open(os.path.join(AQUI, 'juego', n + '.js'), encoding='utf-8').read()
js = '(() => {\n"use strict";\n' + '\n'.join(leer(n) for n in ORDEN) + '\n})();'
# paquete: un solo bloque con índice
partes = [('d', open(os.path.join(PK, 'd.json.gz'), 'rb').read()), ('m', open(os.path.join(PK, 'm.bin.gz'), 'rb').read())]
for f in sorted(os.listdir(os.path.join(PK, 't')), key=lambda x: int(x.split('.')[0])):
    partes.append(('t' + f.split('.')[0], open(os.path.join(PK, 't', f), 'rb').read()))
for f in sorted(os.listdir(os.path.join(PK, 'a'))):
    partes.append(('a:' + f[:-4], open(os.path.join(PK, 'a', f), 'rb').read()))
for f in sorted(os.listdir(os.path.join(PK, 'i'))):
    partes.append(('i:' + f[:-5], open(os.path.join(PK, 'i', f), 'rb').read()))
idx, blob, o = {}, bytearray(), 0
for k, b in partes:
    idx[k] = [o, len(b)]; blob += b; o += len(b)
html = open(os.path.join(AQUI, 'juego', 'template.html'), encoding='utf-8').read()
MQTT = os.environ.get('MQTT_JS', '')  # mqtt.min.js 5.x bajado aparte (no va al repo)
html = html.replace('/*MQTT*/', open(MQTT, encoding='utf-8').read().replace('</script', '<\\/script') if MQTT else '')
J = lambda n: base64.b64encode(open(os.path.join(AQUI, 'juego', n), 'rb').read()).decode()
html = html.replace('/*LOGORB*/', J('logo_rezobox.webp'))
# fondos del inicio (escenas del juego, fuera del repo): PAQUETE/fondos/*.jpg
FD = os.path.join(PK, 'fondos')
fondos = sorted(os.listdir(FD)) if os.path.isdir(FD) else []
# íconos dibujados para el juego (juego/iconos/*.svg, de herramientas/iconos.py)
ICD = os.path.join(AQUI, 'juego', 'iconos')
js = js.replace('/*ICONOSRB*/', ','.join(f"{f[:-4]}:'data:image/svg+xml;base64," + base64.b64encode(open(os.path.join(ICD, f), 'rb').read()).decode() + "'" for f in sorted(os.listdir(ICD)) if f.endswith('.svg')))
js = js.replace('/*FONDOSRB*/', ','.join("'data:image/jpeg;base64," + base64.b64encode(open(os.path.join(FD, f), 'rb').read()).decode() + "'" for f in fondos))
html = html.replace('/*PKIDX*/', json.dumps(idx, separators=(',', ':'))).replace('/*PK*/', base64.b64encode(bytes(blob)).decode()).replace('/*JS*/', js)
open(OUT, 'w', encoding='utf-8').write(html)
print('ok', OUT, round(os.path.getsize(OUT) / 1e6, 2), 'MB', 'js', len(js) // 1024, 'KB', 'partes', len(partes))
