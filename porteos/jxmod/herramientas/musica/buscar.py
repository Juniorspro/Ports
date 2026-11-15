# Arma (o completa) la lista de las estaciones de música del menú a partir de una lista de canciones pedidas:
#   python3 -I herramientas/musica/buscar.py PEDIDAS.txt SALIDA.txt [TABLA.tsv]
# PEDIDAS.txt: «== clave» para empezar cada estación y una canción por renglón, «Artista — Título» (con «— id» al final
# para fijar un video a mano; «# …» es un comentario). Para cada una busca en YouTube y elige el video:
#  · que sea la canción (las palabras del título en el título del video) y no otra cosa (ni una hora seguida, ni lenta con
#    eco, ni en vivo, ni un cover, ni un remix, salvo que se pida);
#  · de las subidas oficiales: el canal «Artista - Topic» de YouTube («Provided to YouTube», sólo el audio: menos datos y
#    sin los cortes de los videoclips), el canal del artista (con su insignia), VEVO, NoCopyrightSounds; y entre ésas, la
#    más vista;
#  · que se pueda insertar (oEmbed 200) y reproducir en el reproductor insertado (yt.insertado: «OK»; si no, la siguiente).
# Escribe SALIDA.txt con el formato de juego/musica_estaciones.txt (artista — título — id) y, si se pide, una tabla para
# revisar a mano qué video quedó en cada una (título y canal de YouTube, vistas, largo). Hay que revisarla: el puntaje
# acierta casi siempre, pero «casi» no alcanza.
import os, re, sys, math, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import yt

MALAS = ['hour', 'hours', 'hora', 'horas', 'slowed', 'reverb', 'sped up', 'speed up', 'nightcore', 'cover', 'remix', 'live', 'en vivo', 'karaoke',
         'piano', 'tutorial', 'reaction', 'react', '8d', 'bass boosted', 'instrumental', 'extended', 'loop', 'mashup', 'edit', 'tiktok',
         'lesson', 'guitar', 'drum', 'bass cover', 'lyric', 'lyrics', 'letra', 'shorts', 'remastered 2011', 'acoustic', 'acustico', 'version', 'mix',
         'concert', 'performance', 'medley', 'parody', 'fan made', 'fanmade', 'trailer', 'behind the scenes', 'making of', 'clean', 'radio edit',
         'chipmunk', 'ai cover', 'rehearsal', 'demo', 'full album', 'album', 'playlist', 'compilation', 'remake', 'orchestral', 'epic version',
         'subtitulada', 'subtitulado', 'legendado', 'legendada', 'traducida', 'traduccion', 'sub espanol', 'subtitles', 'dance', 'choreography', 'coreografia', 'visualizer', 'vinyl', 'unofficial']
# (las que no son el video sino otra cosa: siempre afuera; las demás bajan el puntaje)
NUNCA = ['hour', 'hours', 'hora', 'horas', 'slowed', 'reverb', 'sped up', 'speed up', 'nightcore', 'karaoke', 'tutorial', 'reaction', 'react', '8d',
         'bass boosted', 'lesson', 'full album', 'playlist', 'compilation', 'chipmunk', 'ai cover', 'parody']


def norm(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().lower()
    s = s.replace('&', ' and ').replace("'", '').replace('’', '')
    return ' '.join(re.sub(r'[^a-z0-9]+', ' ', s).split())


def tiene(texto, frase):
    return (' ' + frase + ' ') in (' ' + texto + ' ')


def palabras_titulo(t):
    t = re.sub(r'\((?:feat|ft|with)\.?[^)]*\)', ' ', t, flags=re.I)
    t = re.sub(r'\[[^\]]*\]', ' ', t)
    return [w for w in norm(t).split() if w not in ('the', 'a', 'of', 'de', 'la', 'el', 'and', 'feat', 'ft')] or norm(t).split()


def puntaje(cand, artista, titulo, estacion):
    vt, vc = norm(cand['t']), norm(cand['c']); q = norm(artista + ' ' + titulo)
    pt = palabras_titulo(titulo)
    hay = sum(1 for w in pt if tiene(vt, w)) / max(1, len(pt))
    if hay < 0.75: return None, 'no es el título'
    for m in NUNCA:
        if tiene(vt, m) and not tiene(q, m): return None, 'es «' + m + '»'
    s = 0.0; por = []
    for m in MALAS:
        if tiene(vt, m) and not tiene(q, m): s -= 4; por.append('-' + m)
    a0 = norm(re.split(r'\s*(?:,|&| x |feat\.?|ft\.?)\s*', artista)[0])
    del_artista = bool(a0) and (tiene(vc, a0) or a0.replace(' ', '') in vc.replace(' ', ''))
    if vc.endswith(' topic'): s += 5 if del_artista else 3; por.append('topic')   # («Provided to YouTube»: oficial, sólo el audio)
    elif cand['ins'] == 'artista' and del_artista: s += 4; por.append('artista')
    elif cand['ins'] == 'artista': s -= 2; por.append('-otro artista')   # (el canal oficial de otro: un cover, un remix, un baile)
    if 'vevo' in vc: s += 3; por.append('vevo')
    if estacion == 'ncs' and vc == 'nocopyrightsounds': s += 8; por.append('ncs')
    if vc == 'kevin macleod archive': s += 2; por.append('archivo')   # (el archivo de Kevin MacLeod: todos sus temas, con el mismo nombre)
    if del_artista: s += 2; por.append('canal=artista')
    if not tiene(vt, a0) and not tiene(vc, a0) and a0.replace(' ', '') not in (vt + vc).replace(' ', ''): s -= 3; por.append('-artista')
    if re.search(r'official (?:audio|video|music video)', vt): s += 1; por.append('oficial')
    seg = cand['seg']
    if seg and (seg < 60 or seg > 600): s -= 6; por.append('-largo')
    s += 0.6 * math.log10(1 + cand['vistas'])
    return s, ' '.join(por)


def leer_pedidas(ruta):
    E = []; est = None
    for ln in open(ruta, encoding='utf-8'):
        ln = ln.strip()
        if not ln or ln.startswith('#'): continue
        if ln.startswith('=='): est = ln[2:].strip().split()[0]; E.append((est, [])); continue
        p = [x.strip() for x in ln.split(' — ')]
        E[-1][1].append((p[0], p[1], p[2] if len(p) > 2 else ''))
    return E


def elegir(est, artista, titulo, fijo=''):
    if fijo:
        o = yt.oembed(fijo); e = yt.insertado(fijo)
        return {'id': fijo, 't': o[1], 'c': o[2], 'ins': '', 'vistas': 0, 'seg': e[4]}, o, e, 'a mano', 0
    q = artista + ' ' + re.sub(r'\[NCS Release\]', 'NCS', titulo) + ('' if est == 'ncs' else ' official audio' if est not in ('casual', 'epica') else '')
    L = yt.buscar(q)
    if est not in ('casual', 'epica', 'ncs'): L = L + [x for x in yt.buscar(artista + ' ' + titulo) if x['id'] not in {y['id'] for y in L}]
    P = []
    for c in L:
        s, por = puntaje(c, artista, titulo, est)
        if s is not None: P.append((s, por, c))
    P.sort(key=lambda x: -x[0])
    buenas = []
    for s, por, c in P[:8]:
        o = yt.oembed(c['id'])
        if o[0] != 200: continue
        e = yt.insertado(c['id'])
        if e[0] != 'OK' or not e[1]: continue
        buenas.append((c, o, e, por, s))
        if len(buenas) >= 4: break
    elegir.alternativas = buenas[1:]
    if buenas: return buenas[0]
    return None, None, None, 'nada', 0


def main():
    E = leer_pedidas(sys.argv[1]); sal = open(sys.argv[2], 'w', encoding='utf-8')
    tab = open(sys.argv[3], 'w', encoding='utf-8') if len(sys.argv) > 3 else None
    vistos = set()
    for est, L in E:
        sal.write('\n== ' + est + '\n')
        for artista, titulo, fijo in L:
            c, o, e, por, s = elegir(est, artista, titulo, fijo)
            if not c:
                print('NADA', est, artista, '—', titulo); sal.write('# NADA: ' + artista + ' — ' + titulo + '\n'); continue
            rep = c['id'] in vistos; vistos.add(c['id'])
            sal.write(('# REPETIDA: ' if rep else '') + artista + ' — ' + titulo + ' — ' + c['id'] + '\n')
            fila = [est, artista, titulo, c['id'], o[1], o[2], c.get('ins', ''), str(c.get('vistas', 0)), str(e[4]), e[0], por, '%.1f' % s]
            if tab:
                tab.write('\t'.join(fila) + '\n')
                for c2, o2, e2, por2, s2 in getattr(elegir, 'alternativas', []) if not fijo else []: tab.write('\t'.join(['  alt', '', '', c2['id'], o2[1], o2[2], c2.get('ins', ''), str(c2.get('vistas', 0)), str(e2[4]), e2[0], por2, '%.1f' % s2]) + '\n')
            print(' | '.join(fila[:1] + fila[3:]))
    sal.close()
    if tab: tab.close()


if __name__ == '__main__':
    main()
