# Arma el juego: SALIDA/sitio (index.html + datos.json.gz + atlas.png) y SALIDA/StoneStory.html (todo en uno).
# Uso: python3 -I armar.py DATOS_DIR(con datos.json.gz) ATLAS.png SALIDA
import sys, os, base64, shutil
aqui = os.path.dirname(os.path.abspath(__file__))
datos, atlas, sal = sys.argv[1:4]
MODULOS = ['base.js', 'pantalla.js', 'ascii.js', 'objetos.js', 'fondo.js', 'escenas.js', 'principal.js']
js = '\n'.join(open(os.path.join(aqui, 'juego', m), encoding='utf-8').read() for m in MODULOS)
html = open(os.path.join(aqui, 'juego', 'index.html'), encoding='utf-8').read()
sitio = os.path.join(sal, 'sitio'); os.makedirs(sitio, exist_ok=True)
open(os.path.join(sitio, 'index.html'), 'w', encoding='utf-8').write(html.replace('<!--JS-->', '<script>\n' + js + '\n</script>'))
shutil.copy(os.path.join(datos, 'datos.json.gz'), os.path.join(sitio, 'datos.json.gz'))
shutil.copy(atlas, os.path.join(sitio, 'atlas.png'))
# todo en uno: los binarios en base64 (texto ASCII de punta a punta)
b64 = lambda p: base64.b64encode(open(p, 'rb').read()).decode()
pre = ('<script>window.DATOS_URL="data:application/gzip;base64,%s";window.ATLAS_URL="data:image/png;base64,%s";</script>'
       % (b64(os.path.join(datos, 'datos.json.gz')), b64(atlas)))
uno = html.replace('<!--JS-->', pre + '\n<script>\n' + js + '\n</script>')
uno = uno.encode('ascii', 'xmlcharrefreplace').decode() if False else uno
open(os.path.join(sal, 'StoneStory.html'), 'w', encoding='utf-8').write(uno)
print('listo', os.path.getsize(os.path.join(sal, 'StoneStory.html')) // 1024, 'KB')
