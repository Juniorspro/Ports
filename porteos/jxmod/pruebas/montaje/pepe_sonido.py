# Mezcla del analog horror de Pepe: voces, sonidos reales bajados (MyInstants), la música del instructivo (Kevin
# MacLeod, «Local Forecast - Elevator») con temblor de cinta, los sonidos del propio Viewfinder (viento, zoom) y un
# siseo de cinta de fondo. Dos pasadas de loudnorm con mucho rango (los sustos tienen que pegar).
# uso: python3 -I sonido.py SALIDA.wav
# (las rutas de los sonidos y las voces son las de la carpeta de trabajo del video)
import sys, subprocess, json, re
S = '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad/ah'
V, M, G, F = S + '/voz/', S + '/mi/s/', '/tmp/claude-0/pk39/a/', S + '/vfx/sound/ffcam/'
OUT = sys.argv[1]; DUR = 150.0
L = []   # (archivo, en el video, desde, duración, volumen, filtros extra, loop)
def s(f, t, v=1.0, ss=0.0, d=None, fx='', loop=False): L.append((f, t, ss, d, v, fx, loop))

CINTA = 'highpass=f=110,lowpass=f=5200,vibrato=f=0.55:d=0.06,vibrato=f=6.2:d=0.012'
# ---- intro: la casetera carga la cinta ----
s(M + 'vcr-loading.mp3', 0.0, 0.8)
s(M + 'vhs-startup-glitch-sound.mp3', 0.45, 0.45)
# ---- el instructivo (música con temblor de cinta; al final se arrastra y se frena) ----
s(G + 'mu_local_forecast_elevator.bin', 6.0, 0.32, 0.0, 30.4, CINTA)
s(G + 'mu_local_forecast_elevator.bin', 36.4, 0.30, 30.4, 0.95, 'asetrate=34398,aresample=44100,' + CINTA + ',afade=t=out:st=0.5:d=0.45')
s(M + 'tape-stop.mp3', 36.85, 0.7)
for k, t in (('t1', 6.6), ('t2', 12.2), ('t3', 16.8), ('t4', 21.8), ('t5', 26.8), ('t6', 32.0), ('t7', 34.4)): s(V + f'p_{k}.wav', t, 1.0)
# («siempre vuelve… siempre vuelve… siem—»: la cinta se traba)
s(V + 'p_t7.wav', 36.2, 0.95, 0.42, 0.62, 'asetrate=41454,aresample=44100,acrusher=bits=8:mix=0.4')
s(V + 'p_t7.wav', 36.8, 0.95, 0.42, 0.5, 'asetrate=37044,aresample=44100,acrusher=bits=6:mix=0.6')
s(V + 'p_t7.wav', 37.18, 0.9, 0.42, 0.17, 'asetrate=31752,aresample=44100,acrusher=bits=5:mix=0.7')
# el auto, la heladera, la explosión; el «APROBADO»
s(M + 'car-crash_OwBDipR.mp3', 18.62, 0.95); s(M + 'body-fall-sound-effect.mp3', 19.1, 0.6); s(M + 'ding-sound-effect_1.mp3', 19.5, 0.35, 0, 1.6, CINTA)
s(M + 'crash-metal-shatter.mp3', 24.25, 1.2); s(M + '395325__ihitokage__body-falling-on-the-ground-2_01.mp3', 24.32, 0.6); s(M + 'ding-sound-effect_1.mp3', 24.6, 0.35, 0, 1.6, CINTA)
s(M + 'capcut-explosion-sound.mp3', 28.75, 1.0); s(M + 'ding-sound-effect_1.mp3', 29.8, 0.35, 0, 1.6, CINTA)
# ---- S1: la cara en rojo ----
s(M + 'jump-scare-scream_r1WluB0.mp3', 37.35, 1.0, 0.0, 0.65)
s(M + 'horror-stinger.mp3', 37.33, 0.75, 0, 0.67)
# ---- el corte: estática, glitches, PEPE RECUERDA TODO, el mensaje al revés ----
s(M + 'televison-static.mp3', 38.0, 0.8)
s(M + 'glitch-sound-scary-mp3.mp3', 38.12, 0.9)
s(M + 'bug-glitch.mp3', 38.45, 0.55, 0, 0.35)
s(M + 'horror-sting-3.mp3', 38.8, 0.85)
s(M + 'glitch-sound-effect_FugN82U.mp3', 39.6, 0.5, 0, 0.2)
s(M + 'evil-whispers.mp3', 39.6, 1.6, 0, 1.8, 'afade=t=out:st=1.3:d=0.5')
s(V + 'p_r1.wav', 39.85, 1.0)
s(M + 'creepy-and-unsettling-soundd.mp3', 39.9, 0.45, 0, 1.5, 'afade=t=out:st=1.1:d=0.4')
# ---- la alerta: dos ráfagas y el tono de atención del EAS real; la voz; las ráfagas de cierre ----
s(M + 'u-s-eas-system-full.mp3', 41.4, 0.42, 0.73, 2.6)
s(M + 'u-s-eas-system-full.mp3', 44.1, 0.42, 6.1, 0.9, 'afade=t=out:st=0.75:d=0.15')
# (la voz de la alerta, robot: la fase en cero —un zumbido parejo de ~98 Hz— mezclada con la voz limpia, que se entienda)
for k, t in (('e1', 45.1), ('e2', 50.4), ('e3', 54.55), ('e4', 57.7), ('e5', 59.6), ('e6', 61.6), ('e7', 64.3), ('e8', 66.6), ('e9', 69.1)): s(V + f'r_{k}.wav', t, 1.0)
s(M + 'red-eyed-barry-ambience.mp3', 45.0, 0.22, 0, 25.9, 'afade=t=in:d=1.5', loop=True)
s(M + 'scary-whisper.mp3', 67.42, 1.5)
s(M + 'horror-game-stinger-boom.mp3', 68.78, 0.85, 0, 2.0)
s(M + 'tv-static-noise.mp3', 70.9, 0.55, 0, 1.1)
s(M + 'u-s-eas-system-full.mp3', 70.9, 0.4, 16.5, 1.1)
# ---- la grabación ----
s(M + 'beep-camera-sound-effect.mp3', 72.05, 0.5)
s(F + 'wind.wav', 72.0, 0.22, 0, 58.6, 'afade=t=out:st=58.2:d=0.4', loop=True)
s(M + 'male-heavy-breathing.mp3', 72.2, 0.32, 0, 28.0, 'atempo=0.92', loop=True)
s(M + 'man-heavily-breathing.mp3', 103.5, 0.5, 0, 17.0, 'atempo=1.35', loop=True)
s(M + 'horror-heartbeats.mp3', 104.4, 0.45, 0, 16.0, 'afade=t=in:d=2', loop=True)
for t, d, tempo, v in ((78.0, 4.5, 1.0, 0.45), (83.4, 2.6, 1.0, 0.45), (101.6, 1.8, 0.9, 0.4), (110.0, 9.5, 1.55, 0.5)):
    s(M + 'footsteps-on-grass.mp3', t, v, 1.0, d * tempo, f'atempo={tempo}')
for k, t in (('o1', 74.0), ('o2', 79.6), ('o3', 85.0), ('o4', 95.8), ('o5', 104.7)): s(V + f'p_{k}.wav', t, 1.2)
for c in (78.0, 83.4, 90.4, 97.4, 104.4, 111.4, 118.4, 124.4):
    s(M + 'glitch-sound-effect_FugN82U.mp3', c - 0.05, 0.45, 0, 0.22); s(M + 'tv-static-01.mp3', c - 0.05, 0.35, 0, 0.2)
s(F + 'zoom.wav', 94.0, 0.5, 0, 2.9); s(F + 'zoom.wav', 98.1, 0.5, 0, 1.9)
# S5 · pegado al lente
s(M + 'horror-scream-high-quality.mp3', 101.05, 1.0); s(M + 'horror-stinger.mp3', 101.03, 0.6, 0, 1.0); s(M + 'televison-static.mp3', 101.26, 0.6, 0, 0.12)
s(M + 'stinger-horror.mp3', 105.8, 0.45, 0, 2.0, 'afade=t=out:st=1.5:d=0.5'); s(M + 'horror-sting-3.mp3', 107.6, 0.4)
# S6 · el golpe
s(M + 'five-nights-at-freddys-full-scream-sound_2.mp3', 120.27, 1.0, 0.0, 0.3)
s(M + 'bone-crack.mp3', 120.5, 1.0); s(M + 'cinematic-thud.mp3', 120.5, 0.9)
s(M + '395325__ihitokage__body-falling-on-the-ground-2_01.mp3', 120.85, 0.8)
s(M + 'ear-ringing.mp3', 120.6, 1.3, 0, 4.0, 'afade=t=out:st=2.5:d=1.5')
s(M + 'footsteps-on-grass.mp3', 126.9, 0.35, 3.0, 2.6, 'afade=t=out:st=1.6:d=1.0')
s(M + 'ghostly-sound.mp3', 126.3, 0.6)
s(M + 'power-off-1.mp3', 130.6, 0.8); s(M + 'tv-static-01.mp3', 131.6, 0.45, 0, 0.4)
# ---- el instructivo otra vez (la música más grave y más gastada) y la heladera ----
s(M + 'vhs-tape.mp3', 131.95, 0.45, 0, 1.2)
s(G + 'mu_local_forecast_elevator.bin', 132.0, 0.28, 40.0, 13.4, 'asetrate=38808,aresample=44100,' + CINTA + ',vibrato=f=0.3:d=0.12')
for k, t in (('f1', 132.7), ('f2', 137.6), ('f3', 143.8)): s(V + f'p_{k}.wav', t, 1.0, fx=('asetrate=41895,aresample=44100' if k == 'f3' else ''))
s(M + 'crash-metal-shatter.mp3', 143.0, 1.2); s(M + '395325__ihitokage__body-falling-on-the-ground-2_01.mp3', 143.15, 0.6); s(M + 'cinematic-thud.mp3', 143.08, 0.6)
s(M + 'glitch-sound-effect_FugN82U.mp3', 145.4, 0.35, 0, 0.25)
s(M + 'ghostly-sound.mp3', 146.25, 0.7)
s(M + 'tape-stop.mp3', 147.25, 0.8)
s(M + 'scary-whisper.mp3', 149.45, 1.5, 0, 0.35)
s(M + 'jumpscare-sound-fnaf-4.mp3', 149.75, 1.0, 0.0, 0.25)
# la música al revés, más lenta y gastada (musica_reves.wav): en el corte, bajo «Pepe está contando», lejos en la
# grabación cuando aparecen los Pepes, cuando el instructivo del final se da vuelta y antes de «TE TOCA»
RV = S + '/musica_reves.wav'
s(RV, 38.0, 0.5, 5.0, 3.4, 'afade=t=in:d=0.4,afade=t=out:st=3.0:d=0.4')
s(RV, 66.4, 0.3, 20.0, 2.6, 'afade=t=in:d=1.5')
s(RV, 104.4, 0.22, 30.0, 7.0, 'lowpass=f=1500,aecho=0.8:0.7:180:0.4,afade=t=in:d=2')
s(RV, 145.4, 0.42, 40.0, 1.85)
s(RV, 149.4, 0.5, 50.0, 0.35, 'afade=t=in:d=0.3')
# el siseo de la cinta, todo el video
s(M + 'vhs-noise.mp3', 0.0, 3.0, 0, DUR, loop=True)

# (los efectos bajados traen silencio al principio: se recorta para que el golpe caiga en el cuadro; el comienzo es la
# primera muestra que pasa el 12 % del máximo)
import numpy as _np
_ons = {}
def comienzo(f):
    if f not in _ons:
        r = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', '22050', '-f', 'f32le', '-'], capture_output=True)
        x = _np.abs(_np.frombuffer(r.stdout, _np.float32)); k = int(_np.argmax(x > 0.12 * x.max())) if len(x) else 0
        _ons[f] = max(0.0, k / 22050 - 0.01)
    return _ons[f]
L[:] = [(f, t, comienzo(f) if (f.startswith(M) and ss == 0 and not loop) else ss, d, v, fx, loop) for (f, t, ss, d, v, fx, loop) in L]
print('recortes', {k.split('/')[-1][:24]: round(v, 2) for k, v in _ons.items() if v > 0.04})

def graba(salida, normaliza):
    args = ['ffmpeg', '-v', 'error', '-y']
    for f, t, ss, d, v, fx, loop in L:
        if loop: args += ['-stream_loop', '-1']
        if ss and ss > 0.0005: args += ['-ss', f'{ss:.3f}']
        if d: args += ['-t', f'{d:.3f}']
        args += ['-i', f]
        if d is None and loop: args[-3:-3] = []
    fc = []
    for i, (f, t, ss, d, v, fx, loop) in enumerate(L):
        ms = int(round(t * 1000))
        cad = f'[{i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo' + (',' + fx if fx else '')
        if loop and d: cad += f',atrim=0:{d}'
        cad += f',asoftclip=type=hard,volume={v},adelay={ms}|{ms}[a{i}]'
        fc.append(cad)
    fc.append(''.join(f'[a{i}]' for i in range(len(L))) + f'amix=inputs={len(L)}:normalize=0:dropout_transition=0,atrim=0:{DUR},highpass=f=28[m]')
    if normaliza: fc.append('[m]' + normaliza + '[o]'); sal = '[o]'
    else: sal = '[m]'
    args += ['-filter_complex', ';'.join(fc), '-map', sal, '-ar', '44100', '-ac', '2']
    return args
# pasada 1: medir
a = graba(None, 'loudnorm=I=-15:LRA=20:TP=-1.0:print_format=json') + ['-f', 'null', '-']
a[2] = 'info'
r = subprocess.run(a, capture_output=True, text=True)
if not re.search(r'"input_i"', r.stderr): print(r.stderr[-2500:]); sys.exit(1)
m = json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', r.stderr).group(0))
print('medido', {k: m[k] for k in ('input_i', 'input_lra', 'input_tp')})
ln = f"loudnorm=I=-15:LRA=20:TP=-1.0:measured_I={m['input_i']}:measured_LRA={m['input_lra']}:measured_TP={m['input_tp']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
a = graba(None, ln + ',alimiter=limit=0.94:attack=2:release=60') + [OUT]
r = subprocess.run(a, capture_output=True, text=True)
if r.returncode: print(r.stderr[-1500:]); sys.exit(1)
print('listo', OUT, len(L), 'sonidos')
