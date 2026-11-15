# La estación Casual sin internet: los temas de Kevin MacLeod de juego/musica_estaciones.txt, bajados de su sitio
# (incompetech.com: MP3 de 320 kbps; licencia Creative Commons Atribución 4.0) y pasados a Opus, para el paquete aparte
# a_musica (remotos.py: los sonidos «mu_*» van ahí; juego/musica.js los baja después de que el menú se puede tocar).
#   python3 -I herramientas/musica/casual.py PAQUETE [--kbps 32] [--mp3 CARPETA]
# Escribe PAQUETE/a/mu_<nombre>.bin (Opus en WebM, estéreo, 48 kHz, VBR acotado: el peso queda cerca de lo pedido) y no
# toca nada más del paquete; los MP3 quedan en --mp3 (por defecto ~/.cache/jxmod_musica_mp3, fuera del repo) para no
# bajarlos de nuevo. Nada sale de YouTube. Sólo Kevin MacLeod: es lo que se puede repartir dentro del juego (CC BY 4.0,
# con el crédito en la pestaña Música y en CREDITOS.md); las demás estaciones suenan por YouTube.
import os, sys, json, subprocess, urllib.request, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import estaciones
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.normpath(os.path.join(AQUI, '..', '..'))
INCOMPETECH = 'https://incompetech.com/music/royalty-free/'


def argumento(n, d):
    return sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d


def main():
    PK = sys.argv[1]; kbps = int(argumento('--kbps', '32'))
    MP3 = argumento('--mp3', os.path.join(os.path.expanduser('~'), '.cache', 'jxmod_musica_mp3')); os.makedirs(MP3, exist_ok=True)
    L = dict(estaciones.leer(os.path.join(RAIZ, 'juego', 'musica_estaciones.txt')))['casual']
    assert all(a == 'Kevin MacLeod' for a, t, i in L), 'Casual tiene que ser sólo de Kevin MacLeod (lo que se puede repartir)'
    # (el catálogo de incompetech: el nombre de cada archivo; «Cipher» es Cipher2.mp3, «Scheming Weasel (faster version)»,
    # Scheming Weasel faster.mp3...)
    cat = os.path.join(MP3, 'pieces.json')
    if not os.path.exists(cat): open(cat, 'wb').write(urllib.request.urlopen(INCOMPETECH + 'pieces.json', timeout=60).read())
    P = {x['title']: x for x in json.load(open(cat, encoding='utf-8'))}
    tot = 0; dur = 0
    for a, t, i in L:
        if t not in P: sys.exit('no está en incompetech: ' + t)
        f = P[t]['filename']; m = os.path.join(MP3, f)
        if not os.path.exists(m) or os.path.getsize(m) < 100000:
            open(m, 'wb').write(urllib.request.urlopen(INCOMPETECH + 'mp3-royaltyfree/' + urllib.parse.quote(f), timeout=180).read())
        s = os.path.join(PK, 'a', 'mu_' + estaciones.slug(t) + '.bin')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', m, '-map_metadata', '-1', '-vn', '-c:a', 'libopus', '-b:a', '%dk' % kbps, '-vbr', 'constrained',
                        '-compression_level', '10', '-application', 'audio', '-ac', '2', '-ar', '48000', '-f', 'webm', s], check=True)
        d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', s], capture_output=True, text=True).stdout or 0)
        tot += os.path.getsize(s); dur += d
        print('%-34s %5.1f s %7.1f KB' % (t, d, os.path.getsize(s) / 1024))
    print('Casual: %d temas, %.1f min, %.2f MB (%.1f kbps de promedio)' % (len(L), dur / 60, tot / 1e6, tot * 8 / max(1, dur) / 1000))


if __name__ == '__main__':
    main()
