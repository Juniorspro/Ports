# Mezcla del analog horror de Pepe: voces, sonidos reales bajados (MyInstants), la música del instructivo (Kevin
# MacLeod, «Local Forecast - Elevator») con temblor de cinta, los sonidos del propio Viewfinder (viento, zoom) y un
# siseo de cinta de fondo. Dos pasadas de loudnorm con mucho rango (los sustos tienen que pegar).
# uso: python3 -I sonido.py SALIDA.wav
import sys, math, subprocess, json, re
S = '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad/ah'
V, M, G, F = S + '/voz2/', S + '/mi/s/', '/tmp/claude-0/pk39/a/', S + '/vfx/sound/ffcam/'
OUT = sys.argv[1]; DUR = 150.0
L = []   # (archivo, en el video, desde, duración, volumen, filtros extra, loop)
def s(f, t, v=1.0, ss=0.0, d=None, fx='', loop=False): L.append((f, t, ss, d, v, fx, loop))

CINTA = 'highpass=f=110,lowpass=f=5200,vibrato=f=0.55:d=0.06,vibrato=f=6.2:d=0.012'
CF = S + '/carefree.bin'; RV = S + '/musica_reves2.wav'
# ---- intro: la casetera, la evidencia que se tipea ----
s(M + 'vcr-loading.mp3', 0.0, 0.8); s(M + 'vhs-startup-glitch-sound.mp3', 0.4, 0.45)
s(M + 'keyboard-typing-sound-effect.mp3', 2.4, 0.35, 0, 3.9, 'afade=t=out:st=3.5:d=0.4')
# ---- «Lección 6» (Carefree, con temblor de cinta; al final se arrastra) ----
s(CF, 7.0, 0.3, 0.0, 24.3, CINTA)
s(CF, 31.3, 0.28, 24.3, 1.0, 'asetrate=33075,aresample=44100,' + CINTA + ',afade=t=out:st=0.5:d=0.5')
s(M + 'tape-stop.mp3', 31.85, 0.7)
for k, t in (('s1', 7.6), ('s2', 10.8), ('s3', 15.0), ('s4', 19.6), ('s5', 26.4)): s(V + f'p_{k}.wav', t, 1.0)
s(V + 'p_v6.wav', 28.3, 1.15); s(M + 'evil-whispers.mp3', 28.2, 1.3, 0, 2.8, 'afade=t=out:st=2.3:d=0.5')
# S1 · la cara en rojo
s(M + 'jump-scare-scream_r1WluB0.mp3', 32.35, 1.0, 0.0, 0.62); s(M + 'horror-stinger.mp3', 32.33, 0.75, 0, 0.65)
# ---- el corte ----
s(M + 'televison-static.mp3', 33.0, 0.8); s(M + 'glitch-sound-scary-mp3.mp3', 33.2, 0.9)
s(M + 'horror-sting-3.mp3', 33.8, 0.8); s(M + 'horror-game-stinger-boom.mp3', 34.65, 0.7, 0, 1.4)
s(RV, 33.0, 0.42, 3.0, 3.0, 'afade=t=in:d=0.3,afade=t=out:st=2.6:d=0.4')
s(V + 'p_r2.wav', 34.9, 1.0); s(M + 'scary-whisper.mp3', 35.5, 1.4, 0, 0.6)
s(M + 'keyboard-typing-sound-effect.mp3', 36.0, 0.3, 4.0, 1.0); s(V + 'r_j7.wav', 36.6, 1.0)
# ---- la grabación de nico ----
s(M + 'beep-camera-sound-effect.mp3', 38.05, 0.5)
s(F + 'wind.wav', 38.0, 0.22, 0, 14.0, 'afade=t=out:st=13.4:d=0.6', loop=True)
s(M + 'male-heavy-breathing.mp3', 38.2, 0.28, 0, 35.0, 'atempo=0.92', loop=True)
s(M + 'footsteps-on-grass.mp3', 38.5, 0.4, 1.0, 6.3)
for k, t in (('n1', 39.0), ('n2', 42.3), ('n3', 47.0)): s(V + f'p_{k}.wav', t, 1.2)
s(M + 'red-eyed-barry-ambience.mp3', 52.0, 0.16, 0, 70.0, 'afade=t=in:d=2', loop=True)
for k in range(6): s(M + 'concrete-footstep.mp3', 52.3 + k * 0.55, 0.5)
s(V + 'r_j8.wav', 55.6, 0.95); s(V + 'p_n4.wav', 57.4, 1.2, fx='aecho=0.8:0.8:260|520:0.4|0.25')
s(M + 'stinger-horror.mp3', 59.5, 0.4, 0, 2.0, 'afade=t=out:st=1.5:d=0.5')
s(F + 'zoom.wav', 60.6, 0.5, 0, 2.6); s(F + 'zoom.wav', 64.6, 0.5, 0, 1.4)
for k in range(8): s(M + 'concrete-footstep.mp3', 67.4 + k * 0.75, 0.38)
s(V + 'p_n6.wav', 68.6, 1.2)
s(M + 'horror-heartbeats.mp3', 73.0, 0.45, 0, 28.0, 'afade=t=in:d=2', loop=True)
# el búho: tres crujidos, el cuello que se estira, el grito, el latigazo de cámara
s(M + 'loud-bone-crack.mp3', 75.0, 1.0); s(M + 'bone-crack.mp3', 75.7, 0.9); s(M + 'loud-bone-crack.mp3', 76.35, 1.0)
s(M + 'metal-door-creak-high-quality.mp3', 76.7, 0.55, 0, 1.28, 'asetrate=30870,aresample=44100')
s(M + 'horror-scream-high-quality.mp3', 78.35, 1.0); s(M + 'fast-whoosh.mp3', 78.8, 0.5)
# la huida: corre de verdad (6,2 m/s). Los pasos de nico salen de la cadencia de la cámara (1,6 + 0,3·v pasos por
# segundo): baldosa hasta que sale al pasto (~83,2 s), después pasto; frena en el campo (87,0–88,6)
def _pasos(t0, t1, vel):
    t, f, L = t0, 0.0, []
    while t < t1:
        f += (1.6 + 0.3 * vel(t)) / FPS_A; t += 1 / FPS_A
        if f >= 1: f -= 1; L.append(t)
    return L
FPS_A = 300
_v = lambda t: 6.2 * (1 - math.exp(-max(0, t - 79.9) / 0.45)) if t < 87.0 else 6.2 * max(0, 1 - (t - 87.0) / 1.6)
for i, tp in enumerate(_pasos(79.95, 88.6, _v)):
    if _v(tp) < 0.8: continue
    if tp < 83.2: s(M + 'concrete-footstep.mp3', tp, 0.5 if i % 2 else 0.42, fx='atempo=1.3')
    else: s(M + 'gorilla-tag-footstep-concrete.mp3', tp, (0.34 if i % 2 else 0.28) * min(1, _v(tp) / 3), fx='lowpass=f=1500,highpass=f=90')
s(M + 'footsteps-on-grass.mp3', 83.2, 0.3, 0.5, 5.4, 'atempo=1.8,afade=t=in:d=0.2,afade=t=out:st=4.6:d=0.8')
s(M + 'man-heavily-breathing.mp3', 79.0, 0.5, 0, 22.0, 'atempo=1.35', loop=True)
# afuera: el viento del campo (el del propio Viewfinder)
s(F + 'wind.wav', 81.3, 0.2, 0, 46.7, 'afade=t=in:d=0.8,afade=t=out:st=45.9:d=0.8', loop=True)
s(M + 'horror-sting-3.mp3', 83.0, 0.5)
# el campo: atrás no hay nadie; adelante, Pepe; «No. No, no, no»; retrocede; Lucas atrás; Pepe más cerca
s(M + 'horror-stinger.mp3', 89.55, 0.45, 0, 1.6, 'afade=t=out:st=1.2:d=0.4')
s(V + 'p_n7.wav', 90.0, 1.2)
for tp in (90.35, 91.05, 91.75): s(M + 'gorilla-tag-footstep-concrete.mp3', tp, 0.22, fx='lowpass=f=1300,highpass=f=90')
s(M + 'horror-sting-3.mp3', 92.25, 0.6); s(M + 'scary-whisper.mp3', 92.3, 1.2, 0, 0.6)
s(M + 'horror-game-stinger-boom.mp3', 92.8, 0.5, 0, 1.2)
# Pepe camina hacia él (0,45 m/s: un paso cada 0,575 s), pesado, en el pasto
for k in range(8): s(M + 'gorilla-tag-footstep-concrete.mp3', 94.45 + k * 0.575, 0.5, fx='asetrate=30870,aresample=44100,lowpass=f=1600')
s(V + 'p_n8.wav', 98.5, 1.2)
s(M + 'five-nights-at-freddys-full-scream-sound_2.mp3', 98.95, 1.0, 0.0, 0.33)
s(M + 'bone-crack.mp3', 99.3, 1.0); s(M + 'cinematic-thud.mp3', 99.3, 0.9); s(M + '395325__ihitokage__body-falling-on-the-ground-2_01.mp3', 99.65, 0.8)
s(M + 'ear-ringing.mp3', 99.4, 1.3, 0, 4.0, 'afade=t=out:st=2.5:d=1.5')
# la cámara levantada: pasos, la mano en la cámara (foley del Viewfinder), «te toca»
for tp in (102.1, 102.7): s(M + 'gorilla-tag-footstep-concrete.mp3', tp, 0.5, fx='asetrate=30870,aresample=44100,lowpass=f=1600')
s(F + 'foley1.wav', 103.4, 0.8); s(F + 'foleylong2.wav', 103.8, 0.7)
s(V + 'p_j9.wav', 106.3, 1.2)
for a in (105.9, 107.2): s(M + 'horror-sting-3.mp3', a, 0.45, 0, 0.4)
for k in range(8): s(M + 'gorilla-tag-footstep-concrete.mp3', 108.55 + k * 0.57, 0.4, fx='asetrate=30870,aresample=44100,lowpass=f=1600')
s(M + 'fnaf-1-music-box.mp3', 110.5, 0.25, 0, 4.5, 'areverse,asetrate=37485,aresample=44100,aecho=0.8:0.6:150:0.4')
# los apagones: el clic de la luz y el parpadeo
for c in (116.3, 117.7, 119.1, 120.5):
    s(M + 'flashlight-click.mp3', c, 0.7); s(M + 'flashlight-click.mp3', c + 0.35, 0.7); s(M + 'light-flicker.mp3', c + 0.35, 0.35, 0, 0.7)
s(M + 'scary-whisper.mp3', 117.7, 1.4, 0, 0.5)
s(M + 'jumpscare-sound-fnaf-4.mp3', 120.9, 1.0, 0.0, 0.42)
s(M + 'power-off-1.mp3', 125.25, 0.8); s(M + 'tv-static-noise.mp3', 126.8, 0.5, 0, 1.1)
# ---- «Lección 7»: la música otra vez (más grave), el auto, «APROBADO» ----
s(V + 'p_s10.wav', 128.6, 1.0)
s(CF, 130.4, 0.3, 30.0, 8.0, 'asetrate=40572,aresample=44100,' + CINTA)
s(V + 'p_s11.wav', 131.2, 1.0)
s(M + 'car-crash_OwBDipR.mp3', 137.9, 0.95); s(M + 'body-fall-sound-effect.mp3', 138.5, 0.6); s(M + 'ding-sound-effect_1.mp3', 139.0, 0.35, 0, 1.6, CINTA)
s(V + 'p_s12.wav', 139.6, 1.0, fx='asetrate=41895,aresample=44100')
s(RV, 141.0, 0.35, 10.0, 5.9, 'afade=t=in:d=0.5')
s(M + 'ghostly-sound.mp3', 144.55, 0.7); s(M + 'glitch-sound-effect_FugN82U.mp3', 145.2, 0.35, 0, 0.25)
s(M + 'tape-stop.mp3', 146.85, 0.8)
# «TE TOCA» en morse, con el pitido real (dit 0,055 s; raya: el mismo, estirado ×3)
u, t0 = 0.055, 147.05; tt = t0
for letra in ('-', '.', ' ', '-', '---', '-.-.', '.-'):
    if letra == ' ': tt += 4 * u; continue
    for c in letra:
        if c == '.': s(M + 'morse-code-dit.mp3', tt, 0.3, 0.0, u)
        else: s(M + 'morse-code-dit.mp3', tt, 0.3, 0.0, u, 'atempo=0.5,atempo=0.67')
        tt += (u if c == '.' else 3 * u) + u
    tt += 2 * u
s(M + 'scary-whisper.mp3', 149.45, 1.5, 0, 0.3); s(M + 'jumpscare-sound-fnaf-4.mp3', 149.62, 1.0, 0.0, 0.35)
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
