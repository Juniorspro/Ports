# Arma Hypper.html: plantilla + módulos JS en orden + el paquete del juego (base64) adentro.
# Uso: python3 -I armar.py PAQUETE SALIDA.html
import re, os, sys, json, base64, gzip
AQUI = os.path.dirname(os.path.abspath(__file__))
PK, OUT = sys.argv[1], sys.argv[2]
ORDEN = ['nucleo', 'gl', 'sombras', 'post', 'datos', 'modelo', 'fisica', 'mundo', 'jugador', 'objetos', 'vista', 'audio', 'efectos', 'armas',
         'vehiculos', 'herramientas', 'personas', 'humano', 'emotes', 'red', 'dia', 'anfitrion', 'marcas', 'entrada', 'ui', 'hud', 'menu', 'idiomas', 'formato', 'idiomas3', 'iconos', 'modapi', 'voz', 'geo', 'entidades', 'pantalla', 'nativos', 'ciclope', 'verity', 'veritycrea', 'animedit', 'creador', 'smods', 'modmenu', 'inicio', 'rbmenus', 'principal']
# el formato de mods y mapas es el mismo archivo que usa el servidor de la tienda (sin los "export")
FORMATO = re.sub(r'(?m)^export ', '', open(os.path.join(AQUI, 'tienda', 'formato.js'), encoding='utf-8').read())
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
