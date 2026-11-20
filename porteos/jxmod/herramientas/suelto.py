#!/usr/bin/env python3
# La clave del HTML suelto que se actualiza solo (juego/suelto.js; armar.py con SUELTO=1 la mete en el HTML):
# codigo_web.mjs --suelto deja en web/suelto.json la clave de cada versión de la web cifrada con ésta, y con eso el HTML
# suelto abre el juego nuevo que baja. Sale del secreto de la firma del APK (cifrar_apk.secreto_ota, fuera del repo), como
# la de los eventos en vivo: dura lo mismo que la firma y no se guarda en ningún lado. Nunca se muestra.
# Para las pruebas, JX_SUELTO_PRUEBA=1: una clave fija de prueba (la misma en armar.py y en codigo_web.mjs).
# uso: desde armar.py (import suelto; suelto.clave()) y desde codigo_web.mjs (python3 -I suelto.py --para-codigo-web, que
# la escribe sólo para ese programa: no correrlo a mano).
import hashlib, hmac, importlib.util, os, sys
AQUI = os.path.dirname(os.path.abspath(__file__))


def clave():
    if os.environ.get('JX_SUELTO_PRUEBA'): return hashlib.sha256(b'JXSUELTO1 prueba').digest()
    sys.path.insert(0, AQUI); import cifrar_apk
    sp = importlib.util.spec_from_file_location('armar_apk', os.path.join(os.path.dirname(AQUI), 'apk', 'armar_apk.py'))
    m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m)
    ks, cl = m.firma()
    return hmac.new(cifrar_apk.secreto_ota(ks, cl), b'JXSUELTO1 clave del HTML suelto', hashlib.sha256).digest()


if __name__ == '__main__':
    if sys.argv[1:] != ['--para-codigo-web'] or sys.stdout.isatty(): sys.exit('esto lo usa codigo_web.mjs (la clave no se muestra)')
    sys.stdout.write(clave().hex())
