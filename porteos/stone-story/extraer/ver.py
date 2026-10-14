# Arbol compacto de un prefab de datos.json.gz. Uso: ver.py ruta [largo]
import sys, gzip, json, pickle, os
c = '/tmp/claude-0/ss/datos.pkl'
if os.path.exists(c) and os.path.getmtime(c) > os.path.getmtime('/tmp/claude-0/ss/salida/datos.json.gz'): d = pickle.load(open(c, 'rb'))
else: d = json.loads(gzip.open('/tmp/claude-0/ss/salida/datos.json.gz').read()); pickle.dump(d, open(c, 'wb'))
P, R, T = d['prefabs'], d['rutas'], d['textos']
L = int(sys.argv[2]) if len(sys.argv) > 2 else 200
SALTAR = {'AsciiSprite', 'AsciiAnimation', 'ColorAnimation', 'SpriteFrameSfx', 'AnimationTimeSfx', 'MultilayerSprite', 'MultilayerAnimation'}
def nom(v):
    if isinstance(v, str) and v.startswith('@'):
        t = T.get(v[1:]); 
        if t: return 'T:' + t[0]
        p = P.get(v[1:])
        if p: return 'GO:' + p['n']
    return v
def rec(i, n=0):
    e = P[i]
    print('  ' * n + '■ ' + e['n'] + (' (off)' if e.get('off') else '') + (' p=%s' % e['p'] if 'p' in e else ''))
    for c in e['c']:
        s = {k: (nom(v) if not isinstance(v, list) else [nom(x) for x in v]) for k, v in c.items() if k not in ('_c', '_i')}
        if c['_c'] in SALTAR: s = {k: v for k, v in s.items() if k in ('source', 'pivotX', 'pivotY', 'duration', 'looping', 'pageLoadStartIndex', 'pageLoadCount')}
        print('  ' * n + '   ' + c['_c'] + ' ' + json.dumps(s, ensure_ascii=False)[:L])
    for h in e.get('h', []): rec(h, n + 1)
k = sys.argv[1]
rec(R.get(k.lower(), k))
