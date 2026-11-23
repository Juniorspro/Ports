# compara los huesos de la web (ref.js) con los del port (examples/comparar.rs): la peor diferencia y por tramo
# Uso: python3 comparar.py web.json rust.json [secuencia.json]
import json, sys, math
a = json.load(open(sys.argv[1])); b = json.load(open(sys.argv[2]))
print('tobillo js', a['tobillo'], 'rust', b['tobillo'])
ca, cb = a['cuadros'], b['cuadros']
print('cuadros', len(ca), len(cb))
peor = (0, None, None); por_tramo = {}
tramos = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else None
lim = []
if tramos:
    k = 0
    for i, t in enumerate(tramos): lim.append((k, k + t['n'], i)); k += t['n']
for i, (x, y) in enumerate(zip(ca, cb)):
    for n in x:
        if n not in y: continue
        d = math.dist(x[n], y[n])
        if d > peor[0]: peor = (d, i, n)
        tr = next((t for a0, a1, t in lim if a0 <= i < a1), -1)
        por_tramo[tr] = max(por_tramo.get(tr, 0), d)
print('peor diferencia: %.5f m en el cuadro %s (%s)' % peor)
print('por tramo (m):', {k: round(v, 5) for k, v in por_tramo.items()})
i = peor[1]
if i is not None:
    for n in ca[i]: print('  ', n, [round(v, 4) for v in ca[i][n]], [round(v, 4) for v in cb[i].get(n, [0,0,0])])
