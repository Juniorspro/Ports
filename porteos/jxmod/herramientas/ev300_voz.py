# Las voces del evento de los 300 miembros (juego/ev300*.js): Pepe hablando como en los videos de «La venganza de Pepe»,
# la voz «jorge» de athanshock (la del Loquendo de los videos) pasada por el filtro de robot de siempre (la fase en cero:
# el zumbido metálico) mezclado con la voz limpia para que se entienda, un poco más grave. Cada línea queda en MP3 mono
# chico y va adentro del juego (juego/ev300_son.js, en base64): así anda sin internet y la actualización por partes sigue
# siendo sólo el index.html.
# Uso: python3 -I herramientas/ev300_voz.py CARPETA_TRABAJO   (escribe juego/ev300_son.js)
import base64, json, os, subprocess, sys, time

AQUI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = 'https://athanshock.com/tts/api/'
LINEAS = {
    # la intro: Pepe cuenta lo que le hicieron (las muertes de los videos)
    'i1': '¿Me escuchás? Soy yo. Pepe.',
    'i2': 'Mil cuarenta y siete. Esas son las veces que me mataste.',
    'i3': 'Me atropellaste con el auto. Me tiraste del piso trece.',
    'i4': 'Me encerraste en la heladera. Me volaste con un barril.',
    'i5': 'Y cada vez... te reías.',
    'i6': 'Mirá las cámaras. Trescientos te están mirando.',
    'i7': 'Ahora te toca a vos.',
    # la radio en 104.7
    'r1': 'Ciento cuatro punto siete. Sabía que me ibas a buscar.',
    # al abrir cada sello (en voz baja)
    's1': 'Uno menos.', 's2': 'Seguí buscando.', 's3': 'Te estoy mirando.', 's4': 'Ya casi.', 's5': 'Abrí la puerta.',
    # el final y el epílogo
    'f1': '¿Perdón?',
    'e1': 'Pepe siempre vuelve.',
    # el interrogatorio (en la cinta, a veces): las preguntas y lo que contesta según lo que elegiste
    'p1': '¿Te acordás cuántas veces me mataste?',
    'p2': '¿Sabés dónde estás?',
    'p3': '¿Te divertías?',
    'p4': '¿Cuál te gustó más?',
    'p5': '¿Me vas a pedir perdón?',
    'rExacto': 'Exacto. Cada una.',
    'rMeAcuerdo': 'Yo sí me acuerdo. De todas.',
    'rMentiroso': 'Mentiroso.',
    'rSincero': 'Por lo menos sos sincero.',
    'rCinta': 'Estás adentro de la cinta. Igual que yo.',
    'rTodavia': 'Todavía no. Primero vas a jugar.',
    'rYaLoVas': 'Ya lo vas a hacer.',
    'rTodas': 'A mí me dolieron todas.',
    'rSilencio': '¿No me vas a contestar?',
}
# (cuánto más grave y cuánto robot: los susurros de los sellos, más bajos y más robot)
GRAVE = {'f1': 0.82, 'e1': 0.86}


def curl(*args):
    # (un corte de la conexión —pasa con la cola del sitio— se reintenta)
    for i in range(5):
        r = subprocess.run(['curl', '-s', '-m', '40', '--fail', *args], capture_output=True)
        if r.returncode == 0: return r.stdout
        time.sleep(2 + 2 * i)
    raise SystemExit('curl falló: ' + ' '.join(args[-1:]))


def pedir(texto):
    # (con curl, como se pidieron siempre las voces de los videos)
    j = json.loads(curl('-X', 'POST', API + 'generar', '-H', 'Content-Type: application/json', '--data-binary', json.dumps({'texto': texto, 'voz': 'jorge'})))
    jid = j['job_id']
    for _ in range(90):
        e = json.loads(curl(API + 'estado/' + jid))
        if e.get('estado') == 'listo': break
        if e.get('error'): raise SystemExit('error: ' + str(e['error']))
        time.sleep(1.5)
    return curl(API + 'audio/' + jid)


def main():
    W = sys.argv[1]; os.makedirs(W, exist_ok=True)
    salida, durs = {}, {}
    for k, texto in LINEAS.items():
        crudo = os.path.join(W, k + '.m4a')
        if not os.path.isfile(crudo):
            dato = pedir(texto)   # (se escribe recién cuando llegó: si se corta, no queda un archivo vacío)
            with open(crudo + '.tmp', 'wb') as f: f.write(dato)
            os.replace(crudo + '.tmp', crudo)
        g = GRAVE.get(k, 0.9 if k[0] != 's' else 0.88)
        robot = 1.0 if k[0] != 's' else 1.25
        # (grave: asetrate más bajo y aresample de vuelta; robot: la fase en cero; mezcla 0.45 limpia + robot; un poco de
        # eco corto de pieza chica; normalizado)
        filtro = (f"[0:a]aresample=44100,asetrate={int(44100 * g)},aresample=44100,highpass=f=70,asplit=2[a][b];"
                  f"[b]afftfilt=real='hypot(re,im)':imag='0':win_size=2048:overlap=0.78,volume={robot}[r];"
                  f"[a]volume=0.45[l];[l][r]amix=inputs=2:normalize=0,aecho=0.6:0.5:38:0.18,"
                  f"silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                  f"loudnorm=I=-16:TP=-1.5,aresample=24000[o]")
        mp3 = os.path.join(W, k + '.mp3')
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', crudo, '-filter_complex', filtro, '-map', '[o]', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '40k', mp3], check=True)
        d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3], capture_output=True, text=True, check=True).stdout.strip())
        with open(mp3, 'rb') as f: salida[k] = base64.b64encode(f.read()).decode()
        durs[k] = round(d, 2)
        print(k, durs[k], 's', len(salida[k]) // 1024, 'kB', flush=True)
    js = ('// las voces del evento de los 300 (Pepe, voz «jorge» de athanshock con el filtro de robot): herramientas/ev300_voz.py\n'
          '// (generado: no se edita a mano)\n'
          'const EV3_VOZ = ' + json.dumps({'dur': durs, 'mp3': salida}, separators=(',', ':')) + ';\n')
    with open(os.path.join(AQUI, 'juego', 'ev300_son.js'), 'w', encoding='utf-8') as f: f.write(js)
    print('juego/ev300_son.js', round(len(js) / 1024), 'kB', '· total', round(sum(durs.values()), 1), 's')


if __name__ == '__main__':
    main()
