# Vuelve a verificar las 350 canciones de la música del menú (juego/musica_estaciones.txt) y escribe el informe:
#   python3 -I herramientas/musica/verificar.py [--informe herramientas/musica/informe.txt] [--cache]
# Para cada una:
#  · oEmbed (https://www.youtube.com/oembed): 200 = existe y el dueño deja insertarlo (con el título y el canal);
#    401 = no deja insertarlo; 404 = no existe;
#  · el reproductor insertado (youtube-nocookie.com/embed/ID, con página de origen, como el juego): «OK» y que se pueda
#    insertar. Ojo: muchos videos de VEVO dan 200 en oEmbed y acá «UNPLAYABLE» (en el juego, error 150): oEmbed solo no
#    alcanza;
#  · que el título del video tenga el de la canción (sin lo que va entre paréntesis) y, si no aparece el artista en el título
#    ni en el canal, se avisa (no es falla: hay subidas con el nombre en otro idioma);
#  · que no haya repetidas (en toda la lista), que cada estación tenga 35 y que estén las 10.
# Sin --cache pregunta todo de nuevo (es para eso). Las restricciones por país o edad dependen de desde dónde se pregunte:
# el juego, igual, salta solo a la siguiente si YouTube da error (100/101/150) y lo anota en el registro.
# Sale con 1 si algo falla.
import os, sys, re, time, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import yt, estaciones
from buscar import norm, palabras_titulo, tiene

AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.normpath(os.path.join(AQUI, '..', '..'))


def main():
    inf = sys.argv[sys.argv.index('--informe') + 1] if '--informe' in sys.argv else os.path.join(AQUI, 'informe.txt')
    usar = '--cache' in sys.argv
    E = estaciones.leer(os.path.join(RAIZ, 'juego', 'musica_estaciones.txt'))
    fallas, avisos, filas, vistos = [], [], [], {}
    claves = [k for k, L in E]
    if claves != estaciones.ORDEN: fallas.append('las estaciones no son las 10 esperadas, en orden: %s' % claves)
    t0 = time.time()
    for k, L in E:
        if len(L) != estaciones.POR_ESTACION: fallas.append('%s: %d canciones (tienen que ser %d)' % (k, len(L), estaciones.POR_ESTACION))
        for a, t, i in L:
            if i in vistos: fallas.append('repetida: %s (%s y %s)' % (i, vistos[i], k + ' · ' + a + ' — ' + t))
            vistos[i] = k + ' · ' + a + ' — ' + t
            o = yt.oembed(i, usar); e = yt.insertado(i, usar) if o[0] == 200 else ('-', False, '', '', 0)
            pt = palabras_titulo(re.sub(r'\([^)]*\)', ' ', t)); vt = norm(o[1]); vc = norm(o[2])
            hay = sum(1 for w in pt if tiene(vt, w)) / max(1, len(pt))
            a0 = norm(re.split(r'\s*(?:,|&| x |feat\.?|ft\.?)\s*', a)[0])
            art = bool(a0) and (tiene(vt, a0) or tiene(vc, a0) or a0.replace(' ', '') in (vt + vc).replace(' ', ''))
            mal = []
            if o[0] != 200: mal.append('oEmbed %s' % o[0])
            elif e[0] != 'OK' or not e[1]: mal.append('insertado %s %s' % (e[0], e[2]))
            if o[0] == 200 and hay < 0.6: mal.append('el título no coincide')
            if mal: fallas.append('%s · %s — %s (%s): %s' % (k, a, t, i, ', '.join(mal)))
            elif not art: avisos.append('%s · %s — %s (%s): el artista no aparece en «%s» / «%s»' % (k, a, t, i, o[1], o[2]))
            m, s = divmod(int(e[4] or 0), 60)
            filas.append('%-9s %-11s %s %-3s %-26s | %s — %s | YouTube: «%s» · %s · %d:%02d' % (k, i, '✔' if not mal else '✘', o[0], (e[0] if o[0] == 200 else '-')[:26], a, t, o[1], o[2], m, s))
            print(filas[-1], flush=True)
    n = sum(len(L) for k, L in E)
    cab = ['Música del menú: verificación de las canciones (herramientas/musica/verificar.py)',
           'Fecha: %s · %d canciones en %d estaciones · %d distintas · %.0f s' % (datetime.datetime.now(datetime.timezone.utc).strftime('%d/%m/%Y %H:%M UTC'), n, len(E), len(vistos), time.time() - t0),
           'Por estación: ' + ', '.join('%s %d' % (k, len(L)) for k, L in E),
           'oEmbed 200 y reproductor insertado «OK»: %d de %d' % (sum(1 for f in filas if ' ✔ ' in f), n),
           'Fallas: %d' % len(fallas)] + ['  ✘ ' + f for f in fallas] + ['Avisos (no son fallas): %d' % len(avisos)] + ['  · ' + a for a in avisos] + ['', 'Columnas: estación, id, ✔/✘, código de oEmbed, estado del reproductor insertado, la canción, y el título, el canal y el largo en YouTube.', '']
    open(inf, 'w', encoding='utf-8').write('\n'.join(cab + filas) + '\n')
    print('\n'.join(cab[:5 + len(fallas)]))
    print('informe:', inf)
    sys.exit(1 if fallas else 0)


if __name__ == '__main__':
    main()
