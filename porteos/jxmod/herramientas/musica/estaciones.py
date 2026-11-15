# La lista de las estaciones de la música del menú (juego/musica_estaciones.txt), para armar.py, verificar.py y casual.py.
# Formato: «# …» comentario; «== clave» empieza una estación; cada canción en un renglón: «Artista — Título — id de YouTube».
import re, unicodedata

ORDEN = ['casual', 'westside', 'ncs', 'phonk', 'lofi', 'rock', 'latino', 'synthwave', 'epica', 'internet']
POR_ESTACION = 35


def leer(ruta):
    """[(clave, [(artista, título, id), ...]), ...] en el orden del archivo"""
    E = []
    for n, ln in enumerate(open(ruta, encoding='utf-8'), 1):
        ln = ln.strip()
        if not ln or ln.startswith('#'): continue
        if ln.startswith('=='): E.append((ln[2:].strip(), [])); continue
        p = [x.strip() for x in ln.split(' — ')]
        if len(p) != 3 or not E or not re.fullmatch(r'[\w-]{11}', p[2]): raise ValueError('%s:%d: no es «artista — título — id»: %s' % (ruta, n, ln))
        E[-1][1].append(tuple(p))
    return E


def slug(t):
    """el nombre del archivo de una canción de Casual en el paquete aparte (sin la «mu_» de adelante)"""
    t = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '_', t).strip('_')


def para_juego(ruta):
    """lo que va en MUS_DATOS (juego/musica.js): [{k, c: [[id, artista, título, archivo], ...]}]"""
    return [{'k': k, 'c': [[i, a, t, 'mu_' + slug(t) if k == 'casual' else ''] for a, t, i in L]} for k, L in leer(ruta)]
