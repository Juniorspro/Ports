# compara los NPC de la web (npc_ref.js) con los del port (examples/npc_comparar.rs) en la misma escena: dónde está cada
# NPC (la peor diferencia y al final), cuándo llega a un lugar, y lo que pasó (golpes, tiros, lo que dice) con sus tiempos
# Uso: python3 npc_comparar.py web.json rust.json [NOMBRE]
import json, sys, math
a = json.load(open(sys.argv[1])); b = json.load(open(sys.argv[2])); nom = sys.argv[3] if len(sys.argv) > 3 else ''
ca, cb = a['cuadros'], b['cuadros']
n = min(len(ca), len(cb)); nn = len(ca[0])
peor = [0.0] * nn; donde = [0] * nn
for i in range(n):
    for k in range(nn):
        x, y = ca[i][k], cb[i][k]
        if x is None or y is None: continue
        d = math.dist(x[:3], y[:3])
        if d > peor[k]: peor[k] = d; donde[k] = i
fin = []
for k in range(nn):
    x, y = ca[n - 1][k], cb[n - 1][k]
    fin.append('NPC%d final js (%.3f %.3f %.3f) rs (%.3f %.3f %.3f) dif %.3f m, peor %.3f m en t=%.2f s, vida js %s rs %s' % (k + 1, *x[:3], *y[:3], math.dist(x[:3], y[:3]), peor[k], (donde[k] + 1) / 60, round(x[4], 2), round(y[4], 2)) if x and y else 'NPC%d: %s / %s' % (k + 1, x, y))
# lo que pasó: por tipo, cuántos y los tiempos
def por_tipo(ev):
    r = {}
    for e in ev: r.setdefault(e[1] + ('' if e[1] != 'son' else ':' + e[2]), []).append(e)
    return r
ea, eb = por_tipo(a['ev']), por_tipo(b['ev'])
print('==', nom, '==')
for l in fin: print('  ' + l)
for k in sorted(set(ea) | set(eb)):
    ta, tb = [e[0] for e in ea.get(k, [])], [e[0] for e in eb.get(k, [])]
    dt = [abs(x - y) for x, y in zip(ta, tb)]
    extra = ''
    if k in ('danJ', 'danN'): extra = ' daño js %.2f rs %.2f' % (sum(e[-1] for e in ea.get(k, [])), sum(e[-1] for e in eb.get(k, [])))
    print('  %-16s js %3d rs %3d  primer js %s rs %s  dif. de tiempo máx %s%s' % (k, len(ta), len(tb), ta[0] if ta else '-', tb[0] if tb else '-', ('%.3f s' % max(dt)) if dt else '-', extra))
