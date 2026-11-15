# Arma el bucle de cada fondo animado con los cuadros de video.mjs, lo mide y lo codifica.
#  · el empalme: video.mjs saca L + fundido segundos; los primeros cuadros del bucle son el final de la vuelta fundido con su
#    principio (el cuadro j de los últimos F mezcla el cuadro j+F con el j+F−N, de a poco): así del último al primero no hay
#    salto aunque las nubes, el agua o el pulso de la grieta —que van con el reloj del juego— no se repitan solos. Lo
#    periódico (la cámara, lo que cae, la gente) ya es igual en los dos y el fundido no se ve;
#  · lo medido: la diferencia media entre cuadros seguidos (en niveles de 0 a 255), la del último al primero, la de la vuelta
#    sin fundir (cuadro N+i contra i: cuánto no se repite solo) y si hay cuadros repetidos;
#  · el video: H.264 (yuv420p con la matriz BT.709, perfil high, sin sonido, +faststart, un cuadro clave por vuelta) en MP4, y
#    la foto: el primer cuadro del video ya decodificado (así la foto que se ve mientras carga es igual al primer cuadro);
#    la calidad (PSNR y SSIM en YUV) contra el bucle sin pérdida.
# uso: python3 -I bucle.py CARPETA nombre [--fundido 1] [--crf 28] [--W 1280] [--preset veryslow] [--solo-medir]
#        [--salida ARCHIVO.mp4] [--maxrate KBPS]
import os, sys, json, subprocess
import numpy as np
from PIL import Image
args = sys.argv[1:]
op = lambda k, d: args[args.index('--' + k) + 1] if '--' + k in args else d
CARP, NOM = args[0], args[1]
D = os.path.join(CARP, NOM)
INFO = json.load(open(os.path.join(CARP, NOM + '.json')))
fps = INFO['arm']['fps']; L = INFO['arm']['L']; N = int(round(L * fps)); F = int(round(float(op('fundido', INFO.get('fundido', 1))) * fps))
cuadros = sorted(f for f in os.listdir(D) if f.startswith('c') and f.endswith('.png'))
assert len(cuadros) >= N + F, 'faltan cuadros: %d de %d' % (len(cuadros), N + F)
leer = lambda i: np.asarray(Image.open(os.path.join(D, 'c%04d.png' % i)).convert('RGB'), dtype=np.float32)
C = [leer(i) for i in range(N + F)]
h, w = C[0].shape[:2]
# el bucle: N cuadros
def cuadro(j):
    if j < N - F: return C[j + F]
    a = (j - (N - F)) / F   # de 0 (el cuadro j+F, todavía la vuelta) a casi 1 (el principio)
    return C[j + F] * (1 - a) + C[j + F - N] * a
B = [np.clip(np.rint(cuadro(j)), 0, 255).astype(np.uint8) for j in range(N)]
dif = lambda a, b: float(np.abs(a.astype(np.int16) - b.astype(np.int16)).mean())
# dónde empieza el bucle (es circular: cualquier cuadro sirve de primero): en el cambio más grande de la vuelta —el fogonazo
# de una explosión—. Ahí va el cuadro clave del video (el único, entero) y su ruido de compresión es otro que el del último
# cuadro, que viene de 299 cuadros predichos: en el MP4 el paso del último al primero daba 2,3 veces el de dos cuadros seguidos
# en un momento quieto; adentro de un fogonazo no se ve. Y la foto (el primer cuadro) es la explosión, como en las de la 3.6
ciclo = [dif(B[j], B[(j + 1) % N]) for j in range(N)]
K = (int(np.argmax(ciclo)) + 1) % N if op('inicio', 'auto') == 'auto' else int(op('inicio', '0')) % N
B = B[K:] + B[:K]
seg = [dif(B[j], B[j + 1]) for j in range(N - 1)]
emp = dif(B[N - 1], B[0])
crudo = [dif(np.rint(C[N + i]).astype(np.uint8), np.rint(C[i]).astype(np.uint8)) for i in range(F)]
# (por zonas: el cielo, arriba del 45 % del alto, y el resto)
z = int(h * 0.45)
crudoZ = {'cielo': float(np.abs(C[N][:z] - C[0][:z]).mean()), 'piso': float(np.abs(C[N][z:] - C[0][z:]).mean())}
med = {'cuadros': N, 'fps': fps, 'L': L, 'fundido': F, 'inicio': K, 'seguidos': {'media': round(float(np.mean(seg)), 3), 'min': round(min(seg), 3), 'max': round(max(seg), 3), 'p95': round(float(np.percentile(seg, 95)), 3)},
       'empalme': round(emp, 3), 'empalme/seguidos': round(emp / max(1e-6, float(np.mean(seg))), 2), 'sin_fundir': {'N+i vs i': [round(x, 2) for x in crudo[:6]], 'zonas': {k: round(v, 2) for k, v in crudoZ.items()}},
       'repetidos': sum(1 for x in seg + [emp] if x < 0.05)}
print(json.dumps(med))
if '--solo-medir' in args: sys.exit(0)
# el video
OUTW = int(op('W', 1280)); OUTH = OUTW * h // w // 2 * 2
crf = op('crf', '28'); preset = op('preset', 'veryslow')
sal = op('salida', os.path.join(CARP, NOM + '.mp4'))
# (de RGB a YUV con la matriz BT.709, la que dice el archivo y la que usa el navegador para volver a RGB: sin decirlo, ffmpeg
# convierte con la BT.601 y los colores salen corridos —en la prueba, la foto contra el primer cuadro daba 39,6 dB—)
vf = ['-vf', 'scale=%d:%d:flags=lanczos:out_color_matrix=bt709:out_range=tv' % (OUTW, OUTH)]
mx = op('maxrate', '')
rc = ['-crf', crf] + (['-maxrate', mx + 'k', '-bufsize', str(int(mx) * 2) + 'k'] if mx else [])
cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (w, h), '-r', str(fps), '-i', '-'] + vf + \
      ['-c:v', 'libx264', '-preset', preset] + rc + ['-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level:v', '4.0', '-g', str(N), '-keyint_min', str(N), '-sc_threshold', '0',
       '-x264-params', 'open-gop=0', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-an', '-movflags', '+faststart', sal]
pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for f in B: pr.stdin.write(f.tobytes())
pr.stdin.close(); pr.wait()
# el bucle sin pérdida (para medir la calidad del video) y la foto: el primer cuadro del video decodificado
Image.fromarray(B[0]).save(os.path.join(CARP, NOM + '_0.png'))
foto = os.path.join(CARP, NOM + '_foto.png')
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', sal, '-frames:v', '1', '-vf', 'scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24', foto], check=True)
# calidad: PSNR y SSIM del video contra el bucle sin pérdida (a la medida del video)
# (la referencia, en YUV 4:2:0 con la misma matriz: así lo medido es lo que pierde el códec, no la conversión de color)
ref = os.path.join(CARP, NOM + '_ref.mkv')
pr = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (w, h), '-r', str(fps), '-i', '-'] + vf +
                      ['-c:v', 'ffv1', '-pix_fmt', 'yuv420p', ref], stdin=subprocess.PIPE)
for f in B: pr.stdin.write(f.tobytes())
pr.stdin.close(); pr.wait()
def filtro(fl):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', sal, '-i', ref, '-lavfi', '[0:v][1:v]' + fl, '-f', 'null', '-'], capture_output=True, text=True)
    return [l for l in r.stderr.splitlines() if 'Parsed_' in l][-1:]
q = {'psnr': filtro('psnr'), 'ssim': filtro('ssim')}
# el empalme sobre el MP4 ya decodificado (en gris, como lo ve el jugador): el paso del último cuadro al primero contra ese mismo
# paso en el bucle sin pérdida (lo que agrega la compresión), y los pasos entre cuadros seguidos
def gris(path):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', 'format=gray', '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(r, np.uint8).reshape(-1, OUTH, OUTW).astype(np.int16)
G, Gr = gris(sal), gris(ref); n = len(G)
pasos = [float(np.abs(G[i + 1] - G[i]).mean()) for i in range(n - 1)]
dec = {'cuadros': n, 'seguidos': {'media': round(float(np.mean(pasos)), 3), 'mediana': round(float(np.median(pasos)), 3), 'max': round(max(pasos), 3)},
       'ultimo_primero': round(float(np.abs(G[0] - G[n - 1]).mean()), 3), 'ese_paso_sin_perdida': round(float(np.abs(Gr[0] - Gr[n - 1]).mean()), 3),
       'repetidos': sum(1 for x in pasos if x < 0.05)}
tam = os.path.getsize(sal)
print(json.dumps({'mp4': sal, 'kB': round(tam / 1024, 1), 'kbps': round(tam * 8 / 1000 / L, 1), 'crf': crf, 'W': OUTW, 'calidad': q, 'decodificado': dec}))
