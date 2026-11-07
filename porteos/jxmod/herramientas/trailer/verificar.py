# verificación del tráiler armado: duración, cuadros, tamaño, cuadros congelados o negros fuera de lugar, barras de
# cine, destellos donde van y sonido (picos, recorte) — python3 verificar.py <video.mp4>
import subprocess, sys, json
import numpy as np
f = sys.argv[1]
pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_entries',
    'format=duration,size:stream=codec_type,codec_name,width,height,nb_read_frames,r_frame_rate,sample_rate,channels',
    '-of', 'json', f], capture_output=True, text=True).stdout)
v = [s for s in pr['streams'] if s['codec_type'] == 'video'][0]
a = [s for s in pr['streams'] if s['codec_type'] == 'audio'][0]
W, H, N = int(v['width']), int(v['height']), int(v['nb_read_frames'])
print(f"{f}: {W}×{H} {v['r_frame_rate']} {N} cuadros, {float(pr['format']['duration']):.3f} s, "
      f"{int(pr['format']['size']) / 1e6:.2f} MB, audio {a['codec_name']} {a['sample_rate']} Hz {a['channels']} canales")
# luminancia por cuadro (en chico) y de las barras (a tamaño real, sólo la franja de arriba y la de abajo)
w, h = 192, 108
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-vf', f'scale={w}:{h}:flags=area,format=gray', '-f', 'rawvideo', '-'],
                     capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
bar = round(138 * H / 1080)
cen = fr[:, int(h * 0.15):int(h * 0.85)]
media = cen.mean(axis=(1, 2))
dif = np.abs(np.diff(cen, axis=0)).mean(axis=(1, 2))
t = np.arange(len(media)) / 24
# barras: a tamaño real, el promedio de las filas de arriba y de abajo (sin el borde con la imagen)
if W / H > 1.6:   # (sólo el panorámico con barras de cine; el 4:3 va a cuadro completo)
    rawb = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-vf', f'crop={W}:{bar - 4}:0:0,scale=64:8,format=gray', '-f', 'rawvideo', '-'],
                          capture_output=True).stdout
    barras = np.frombuffer(rawb, np.uint8).reshape(-1, 8, 64).astype(np.float32).max(axis=(1, 2))
    print(f"barras de arriba (cuadros 49+): máx {barras[49:].max():.1f} de 255 (tienen que ser negras)")
else:
    print(f'formato {W}×{H} ({W / H:.3f}:1), sin barras')
# negros: cuadros con media < 6 fuera de los esperados (fin del logo ~1,9–2,04, comienzo de P1, negro 13,04–13,50)
neg = [i for i in range(len(media)) if media[i] < 6]
# (v2, 40 s: fin del logo, el negro antes del golpe, el corte a negro antes de la placa y el final de la placa)
esperado = lambda i: (44 <= i <= 52) or (313 <= i <= 323) or i < 3 or (885 <= i <= 900) or i >= 950
print('cuadros negros:', len(neg), '— fuera de lugar:', [i for i in neg if not esperado(i)])
# congelados: diferencia casi nula entre cuadros seguidos (fuera del negro)
cong = [i + 1 for i in range(len(dif)) if dif[i] < 0.08 and not esperado(i + 1)]
print('cuadros repetidos (dif < 0,08):', cong[:40], '…' if len(cong) > 40 else '')
# destellos: subidas de brillo
for nombre, ts in [('grieta 6,40', 6.40), ('golpe 13,50', 13.50), ('barril 18,63', 18.63), ('nuclear 19,04', 19.04), ('meteoro 31,45', 31.45), ('placa 37,50', 37.50)]:
    i = int(round(ts * 24)); ven = media[max(0, i - 6):i + 7]; k = int(np.argmax(ven)) + max(0, i - 6)
    print(f"destello {nombre}: pico de luz en {k / 24:.3f} s (cuadro {k}, {media[k]:.0f} vs {media[max(0, i - 8)]:.0f} antes)")
# cortes: los cuadros con más cambio
top = np.argsort(dif)[::-1][:14]
print('cambios más grandes (cortes):', sorted(f"{(i + 1) / 24:.3f}" for i in top))
# sonido
rawa = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-f', 'f32le', '-ac', '2', '-ar', '48000', '-'], capture_output=True).stdout
au = np.frombuffer(rawa, np.float32).reshape(-1, 2)
print(f"sonido: {len(au) / 48000:.3f} s, pico {20 * np.log10(np.abs(au).max() + 1e-9):.2f} dBFS, "
      f"muestras ≥ 0,999: {(np.abs(au) >= 0.999).sum()}")
env = np.sqrt((au ** 2).mean(axis=1))
for nombre, ts in [('grieta 6,40', 6.40), ('golpe 13,50', 13.50), ('barril 18,63', 18.63), ('nuclear 19,75', 19.75), ('onda 20,92', 20.92), ('meteoro 31,45', 31.45), ('placa 37,50', 37.50)]:
    i0, i1 = int((ts - 0.25) * 48000), int((ts + 0.35) * 48000)
    blk = env[i0:i1].reshape(-1, 480).mean(axis=1); k = int(np.argmax(np.diff(blk)))
    print(f"golpe de sonido {nombre}: subida más fuerte en {(i0 + k * 480) / 48000:.3f} s")
sec = [(0, 2.04, 'logo'), (2.04, 6.4, 'manos'), (6.4, 9.17, 'grieta'), (9.17, 12.33, 'grieta 2'), (12.33, 13.04, 'salen'),
       (13.04, 13.5, 'negro'), (13.5, 19.04, 'lluvia+barril'), (19.04, 23.38, 'nuclear'), (23.38, 26.63, 'corre'),
       (26.63, 30.88, 'playa'), (30.88, 34.0, 'meteoro'), (34.0, 36.92, 'la agarra'), (36.92, 37.5, 'negro 2'), (37.5, 40.0, 'placa')]
print('volumen por parte (dB RMS):', ', '.join(f"{n} {20 * np.log10(np.sqrt((au[int(a0 * 48000):int(a1 * 48000)] ** 2).mean()) + 1e-9):.1f}" for a0, a1, n in sec))
