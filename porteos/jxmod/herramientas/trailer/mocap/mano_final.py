# lee lo que midió mano_final.mjs y resume: giro de la mano entre subcuadros, giro alrededor del antebrazo, salto del codo,
# el codo alrededor del eje hombro→mano y los dedos contra la cola del arma
import json, sys, numpy as np
D = json.load(open(sys.argv[1])); F = D['F']
def qang(a, b):
    d = abs(float(np.dot(a, b))); return np.degrees(2 * np.arccos(min(1.0, d)))
q = np.array([f['q'] for f in F]); t = np.array([f['t'] for f in F])
dq = np.array([0] + [qang(q[i], q[i - 1]) for i in range(1, len(q))])
codo = np.array([f['codo'] for f in F]); mano = np.array([f['mano'] for f in F]); m1 = np.array([f['m1'] for f in F])
pul = np.array([f['pul'] for f in F])
dcodo = np.r_[0, np.linalg.norm(np.diff(codo, axis=0), axis=1)] * 100
# giro alrededor del antebrazo: el lado de la mano (muñeca → pulgar) proyectado en el plano perpendicular al antebrazo
fa = mano - codo; fa /= np.linalg.norm(fa, axis=1)[:, None]
lado = pul - mano; lado -= fa * np.sum(lado * fa, axis=1)[:, None]; lado /= np.linalg.norm(lado, axis=1)[:, None]
tw = [0.0]
for i in range(1, len(F)):
    a, b2, ax = lado[i - 1], lado[i], fa[i]
    tw.append(np.degrees(np.arctan2(np.dot(np.cross(a, b2), ax), np.dot(a, b2))))
tw = np.array(tw)
hom = np.array([f['hom'] for f in F]); ej = mano - hom; ej /= np.linalg.norm(ej, axis=1)[:, None]
pc = codo - hom; pc -= ej * np.sum(pc * ej, axis=1)[:, None]; pcn = pc / np.maximum(np.linalg.norm(pc, axis=1)[:, None], 1e-9)
gp = [0.0] + [np.degrees(np.arctan2(np.dot(np.cross(pcn[i-1], pcn[i]), ej[i]), np.dot(pcn[i-1], pcn[i]))) for i in range(1, len(F))]
gp = np.array(gp); salida_codo = np.linalg.norm(pc, axis=1) * 100
print(f'codo alrededor del eje hombro→mano: máx {np.abs(gp).max():.2f}° entre subcuadros en t={t[np.abs(gp).argmax()]:.3f}; total {np.abs(gp).sum():.0f}°; separación del eje mín {salida_codo.min():.1f} cm')
print('p9', D['p9'])
print('subcuadros', len(F), f"t {t[0]:.3f}–{t[-1]:.3f}")
v = dq * 96   # grados por segundo (96 subcuadros por segundo)
print(f'giro de la mano: máx {dq.max():.2f}° entre subcuadros ({v.max():.0f}°/s) en t={t[dq.argmax()]:.3f}; >3°: {int((dq > 3).sum())} subcuadros')
print(f'giro alrededor del antebrazo: máx {np.abs(tw).max():.2f}° entre subcuadros en t={t[np.abs(tw).argmax()]:.3f}; total acumulado {np.abs(tw).sum():.0f}° (neto {tw.sum():.0f}°)')
print(f'codo: salto máx {dcodo.max():.2f} cm en t={t[dcodo.argmax()]:.3f}')
tt = D['p9']['tToca']
# por cuadro (cada 4 subcuadros): el giro acumulado de la mano y alrededor del antebrazo en ese cuadro
print('cuadro  t       giro°  antebrazo°  codo cm')
for c in range(0, len(F), 4):
    s = slice(c, c + 4); i = F[c]['i']
    if i % 2 == 0 or dq[s].sum() > 6: print(f'{75 + i:4d}  {t[c]:.3f}  {dq[s].sum():6.1f}  {tw[s].sum():9.1f}  {dcodo[s].sum():7.2f}')

if 'apoyo' in F[0]:
    ap = np.array([f['apoyo'] for f in F]); i2 = np.array([f['i2'] for f in F]); i4 = np.array([f['i4'] for f in F])
    d2 = np.linalg.norm(i2 - ap, axis=1) * 100; k = t >= tt
    print(f'medio de los dedos (Index2) al apoyo: en el toque {d2[np.argmin(abs(t - tt))]:.1f} cm, después máx {d2[k].max():.1f} cm')
    print(f'punta de los dedos (Index4) respecto de la superficie de arriba de la cola: {((i4[k][:, 1] - (ap[k][:, 1] - 0.012)) * 100).min():.1f} a {((i4[k][:, 1] - (ap[k][:, 1] - 0.012)) * 100).max():.1f} cm (negativo = más abajo que la superficie)')

    m4 = np.r_[0, np.linalg.norm(np.diff(i4, axis=0), axis=1)] * 100
    print(f'punta de los dedos: movimiento máx entre subcuadros {m4.max():.2f} cm (en t={t[m4.argmax()]:.3f}); desde el toque máx {m4[k].max():.2f} cm')
