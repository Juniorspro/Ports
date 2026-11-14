# La referencia de GMod para pruebas/bsmod.mjs: las dos animaciones de cada ejecución de BSMod (c_limbs.mdl para el
# jugador y bsmodimations_human.mdl para la víctima) leídas del .mdl con herramientas/source_mdl.py y puestas como las pone
# BSMod (la víctima en el origen mirando +x; el jugador donde lo pone KMCheck, mirándola). Por cuadro: manos, pie,
# cabeza y cadera del jugador y cabeza y cadera de la víctima en los ejes de la víctima (unidades de Source); y el mínimo de
# mano–cabeza (unidades), de torso–torso (cm) y lo más bajo de los pies (cm).
# uso: python3 -I bsmod_ref.py [RUTA_DEL_GMA] [GMA_DEL_DROPKICK]   (por defecto el del Workshop 2106330193 bajado en
# /tmp/claude-0/gma_armas; con el segundo, también las de [BSMod] Ultimate Dropkick Killmove, Workshop 2561288661, con sus
# .mdl y donde las pone su gancho CustomKillMoves)
import sys, os, struct, json, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'herramientas'))
import source_mdl
GMA = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].endswith('.gma') else '/tmp/claude-0/gma_armas/2106330193/2106330193.gma'
DPK = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2].endswith('.gma') and os.path.exists(sys.argv[2]) else None
def gma(ruta):
    b = open(ruta, 'rb').read(); assert b[:4] == b'GMAD'; o = 5 + 16
    if b[4] > 1:
        while b[o] != 0: o = b.index(b'\0', o) + 1
        o += 1
    for _ in range(3): o = b.index(b'\0', o) + 1
    o += 4; L = []
    while True:
        n, = struct.unpack_from('<I', b, o); o += 4
        if n == 0: break
        e = b.index(b'\0', o); p = b[o:e].decode('utf-8', 'replace'); o = e + 1; sz, = struct.unpack_from('<q', b, o); o += 12; L.append((p, sz))
    F = {}
    for p, sz in L: F[p] = b[o:o + sz]; o += sz
    return F
F = gma(GMA)
PL = source_mdl.Modelo(F['models/weapons/c_limbs.mdl']); VI = source_mdl.Modelo(F['models/bsmodimations_human.mdl'])
# (dónde pone KMCheck al jugador, en los ejes de la víctima, y hacia dónde mira)
POS = {'killmove_front_1': (31.5, 0, 180), 'killmove_front_2': (29, 0, 180), 'killmove_back_1': (-30, 0, 0), 'killmove_left_1': (0, 31.5, -90),
       'killmove_right_1': (10, -95, 90), 'killmove_front_air_1': (39, 0, 180)}
def rz(a, x, y):
    c, s = np.cos(np.radians(a)), np.sin(np.radians(a)); M = np.eye(4); M[:2, :2] = [[c, -s], [s, c]]; M[0, 3] = x; M[1, 3] = y; return M
def huesos(M, sec, f):
    sq = next(q for q in M.secuencias if q['n'] == sec); A = M.anims[sq['anim']]; f = min(f, A['nf'] - 1)
    P, Q, ok = M.pose(sq['anim'], f); return {h['n']: W for h, W in zip(M.huesos, M.mundo(P, Q))}
def seg(a0, a1, b0, b1):
    m = 1e9
    for i in range(11):
        for j in range(11):
            p = a0 + (a1 - a0) * i / 10; q = b0 + (b1 - b0) * j / 10; m = min(m, float(np.linalg.norm(p - q)))
    return m
out = {}
CASOS = [(PL, VI, sec, x, y, yaw) for sec, (x, y, yaw) in POS.items()]
if DPK:
    FD = gma(DPK); PD = source_mdl.Modelo(FD['models/weapons/c_limbs_pix_dropkick.mdl']); VD = source_mdl.Modelo(FD['models/bsmodimations_pix_dropkick.mdl'])
    # (su gancho: de frente, 80 adelante mirando para el mismo lado; de atrás, 80 atrás y dado vuelta; izquierda: 53 a la
    # izquierda y 4 atrás, dado vuelta; derecha: 56 a la derecha)
    for sec, (x, y, yaw) in {'km_dpkick_front': (80, 0, 0), 'km_dpkick_back': (-80, 0, 180), 'km_dpkick_left': (-4, 53, 180), 'km_dpkick_right': (0, -56, 0)}.items():
        CASOS.append((PD, VD, sec, x, y, yaw))
for PL, VI, sec, x, y, yaw in CASOS:
    Wp = rz(yaw, x, y)
    sqp = next(q for q in PL.secuencias if q['n'] == sec); Ap = PL.anims[sqp['anim']]
    sqv = next(q for q in VI.secuencias if q['n'] == sec); Av = VI.anims[sqv['anim']]
    fr = []; cmin = 1e9; tmin = 1e9; pmin = 1e9
    for f in range(0, Ap['nf']):
        t = f / Ap['fps']; fv = int(round(t * Av['fps']))
        Hp = huesos(PL, sec, f); Hv = huesos(VI, sec, fv)
        g = lambda W: W[:3, 3]; w = lambda n: (Wp @ Hp['ValveBiped.Bip01_' + n])[:3, 3]; v = lambda n: Hv['ValveBiped.Bip01_' + n][:3, 3]
        r = {'t': round(t, 4), 'pR': w('R_Hand'), 'pL': w('L_Hand'), 'pRF': w('R_Foot'), 'pHead': w('Head1'), 'pPel': w('Pelvis'), 'vHead': v('Head1'), 'vPel': v('Pelvis')}
        cmin = min(cmin, float(np.linalg.norm(r['pR'] - r['vHead'])), float(np.linalg.norm(r['pL'] - r['vHead'])))
        tmin = min(tmin, seg(w('Pelvis'), w('Spine4'), v('Pelvis'), v('Spine4')) * 2.54)
        pmin = min(pmin, w('R_Foot')[2] * 2.54, w('L_Foot')[2] * 2.54, v('R_Foot')[2] * 2.54, v('L_Foot')[2] * 2.54)
        fr.append({k: (val.round(3).tolist() if hasattr(val, 'tolist') else val) for k, val in r.items()})
    out[sec] = {'durP': (Ap['nf'] - 1) / Ap['fps'], 'durV': (Av['nf'] - 1) / Av['fps'], 'fr': fr, 'contacto': round(cmin, 1), 'torsos': round(tmin, 1), 'pieMin': round(pmin, 1)}
json.dump(out, sys.stdout)
