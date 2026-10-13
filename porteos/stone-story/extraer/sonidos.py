# Junta los clips Opus que usan los Sfx y Music del juego en un solo sonidos.bin + indice dentro.
# La musica (clips largos) se baja a 32 kb/s estereo. Uso: python3 -I sonidos.py DATOS_DIR WAV_DIR SALIDA_DIR
import sys, os, json, gzip, subprocess, struct
dd, wav, sal = sys.argv[1:4]
d = json.loads(gzip.open(os.path.join(dd, 'datos.json.gz')).read())
clips = {}
for v in d['prefabs'].values():
    tipo = next((c['_c'] for c in v['c'] if c['_c'] in ('Sfx', 'Music')), None)
    if not tipo: continue
    for a in v['c']:
        if a['_c'] == 'AudioSource' and a.get('clip'): clips.setdefault(a['clip'], tipo)
tmp = os.path.join(sal, 'opus'); os.makedirs(tmp, exist_ok=True)
idx, partes, pos = {}, [], 0
for n, tipo in sorted(clips.items()):
    o = os.path.join(tmp, n + '.ogg')
    w = os.path.join(wav, n + '.wav')
    if not os.path.exists(o):
        if not os.path.exists(w): continue
        dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', w], capture_output=True, text=True).stdout or 0)
        larga = tipo == 'Music' or dur > 30
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', w, '-ac', '2' if larga else '1', '-c:a', 'libopus', '-b:a', '32k' if larga else '28k', o], check=True)
    b = open(o, 'rb').read()
    idx[n] = [pos, len(b)]; partes.append(b); pos += len(b)
cab = json.dumps(idx, separators=(',', ':')).encode()
open(os.path.join(sal, 'sonidos.bin'), 'wb').write(struct.pack('<I', len(cab)) + cab + b''.join(partes))
print('sonidos', len(idx), 'clips,', (pos + len(cab)) // 1024, 'KB')
