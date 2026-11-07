#!/bin/bash
# ver.sh salida "id:dur[:girar] id:dur ..." : fotos de cada clip (6 por clip) y una hoja con una fila por clip
T=$(cd "$(dirname "$0")/.." && pwd)
SAL=$1; shift; LISTA="$*"
VER_JS=$T/mocap/ver_clips.js python3 - "$SAL" $LISTA <<'PY'
import sys, json, os
sal, items = sys.argv[1], sys.argv[2:]
L = []; ts = []
for i, it in enumerate(items):
    p = it.split(':'); d = float(p[1]); g = float(p[2]) if len(p) > 2 else 0
    L.append([p[0], d, g])
    for k in range(6): ts.append(round(100 + 10 * i + 0.15 + (d - 0.3) * k / 5, 2))
open(sal + '.js', 'w').write('window.__VER = ' + json.dumps(L) + ';\n' + open(os.environ['VER_JS']).read().replace("(() => {", "// clips: " + ' '.join("'c:%s'" % x[0] for x in L) + "\n(() => {", 1))
open(sal + '.ts', 'w').write(','.join('%.2f' % t for t in ts))
PY
node $T/correr.mjs $SAL.js $SAL --W 480 --H 540 --n 1 --fotos $(cat $SAL.ts) --html ${JX_URL:-http://127.0.0.1:8979/JX.html} 2>&1 | grep -v "agent-proxy\|mtalk\|emqx\|For details\|^foto"
python3 - "$SAL" $LISTA <<'PY'
import sys, glob, os
from PIL import Image, ImageDraw
sal, items = sys.argv[1], sys.argv[2:]
fs = sorted(glob.glob(os.path.join(sal, 'f_*.jpg')), key=lambda f: float(os.path.basename(f)[2:-4]))
w, h = 240, 270; S = Image.new('RGB', (w * 6, h * len(items))); dr = ImageDraw.Draw(S)
for f in fs:
    t = float(os.path.basename(f)[2:-4]); i = int((t - 100) // 10); k = sum(1 for g in fs if int((float(os.path.basename(g)[2:-4]) - 100) // 10) == i and float(os.path.basename(g)[2:-4]) < t)
    S.paste(Image.open(f).resize((w, h)), (k * w, i * h)); dr.text((k * w + 4, i * h + 4), '%s %.1f' % (items[i].split(':')[0], t - 100 - 10 * i), fill=(255, 255, 0))
S.save(sal + '_hoja.jpg', quality=85); print(S.size)
PY
