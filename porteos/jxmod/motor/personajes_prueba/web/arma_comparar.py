# compara el arma en la mano y sentado de la web (arma_ref.js) con los del port (examples/arma_comparar.rs): por escena,
# la peor diferencia y el promedio de los huesos del cuerpo, de los dedos y de la matriz del arma (puntos del arma a 0 y
# a 30 cm sobre cada eje de su modelo), en mm; y la cabina de cada asiento
# Uso: python3 arma_comparar.py web.json rust.json
import json, sys, math
a = json.load(open(sys.argv[1])); b = json.load(open(sys.argv[2]))
def pts(m):
    return [[m[12] + m[c * 4] * k, m[13] + m[c * 4 + 1] * k, m[14] + m[c * 4 + 2] * k] for c, k in [(0, 0), (0, 0.3), (1, 0.3), (2, 0.3)]]
tot = {}
print('%-16s %6s | %-15s | %-15s | %-15s | %s' % ('escena', 'cuadros', 'cuerpo máx/prom', 'dedos máx/prom', 'arma máx/prom', 'peor'))
for ea, eb in zip(a['escenas'], b['escenas']):
    ca, cb = ea['cuadros'], eb['cuadros']
    cu, de, ar = [], [], []; peor = (0, None, None); sin = 0
    for i, (x, y) in enumerate(zip(ca, cb)):
        for n in x:
            if n == '@arma' or n not in y: continue
            d = math.dist(x[n], y[n]) * 1000
            (de if 'Hand' in n and n[-1].isdigit() else cu).append(d)
            if d > peor[0]: peor = (d, i, n)
        if ('@arma' in x) != ('@arma' in y): sin += 1
        elif '@arma' in x:
            d = max(math.dist(p, q) for p, q in zip(pts(x['@arma']), pts(y['@arma']))) * 1000; ar.append(d)
            if d > peor[0]: peor = (d, i, '@arma')
    f = lambda l: '%6.2f / %5.2f' % (max(l), sum(l) / len(l)) if l else '      -        '
    print('%-16s %6d | %s | %s | %s | %.2f mm cuadro %s %s%s' % (ea['n'], len(ca), f(cu), f(de), f(ar), peor[0], peor[1], peor[2], ('  (arma en uno solo: %d cuadros)' % sin) if sin else ''))
    if len(ca) != len(cb): print('   cuadros distintos: web %d port %d' % (len(ca), len(cb)))
    if ea.get('cab') or (eb.get('veh') or {}).get('cab'):
        print('   cabina web %s faldón %s nalga %s | port %s' % (ea.get('cab'), ea.get('faldon'), ea.get('nalga'), (eb.get('veh') or {}).get('cab')))
