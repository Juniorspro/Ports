# Emotes nuevos desde GLB riggeados con una animación (esqueleto tipo mixamo): cada hueso del juego copia la dirección
# animada de su equivalente (con la diferencia entre la pose T del riggeo y la pose de enlace del Hero), en rotaciones
# locales listas para poner (20 cuadros por segundo) más el movimiento de la cadera. Se guardan en el paquete
# (d.json → "emo"): { id: { n: nombre, fps, nf, b: [huesos], r: int16 base64 (cuadro × hueso × xyzw), h: int16 base64
# (cuadro × xyz, en mm), loop } }.
# Uso: python3 -I emote_meshy.py PAQUETE id:Nombre:loop|uno[/categoría]:ARCHIVO.glb [...]
import sys, os, json, gzip, base64, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glb
PK = sys.argv[1]; FPS = 20
d = json.load(gzip.open(PK + '/d.json.gz')); BIN = gzip.decompress(open(PK + '/m.bin.gz', 'rb').read())
arb = d['pf']['PhotonPlayer#b2dc44']
CR = next(i for i, n in enumerate(arb) if n['n'] == 'CharactersRoot')
HERO = next(i for i, n in enumerate(arb) if n['n'] == 'Hero' and n['pa'] == CR)
HM = next(i for i, n in enumerate(arb) if n['pa'] == HERO and 'm' in n)
mh = d['ms'][arb[HM]['m']]; bo = arb[HM]['bo']
nombres = [arb[b]['n'].split(':')[-1] for b in bo]; KB = {nm: k for k, nm in enumerate(nombres)}
GH = np.array([np.linalg.inv(np.array(b).reshape(4, 4)) for b in mh['bp']])
JH = {nm: GH[k][:3, 3] for k, nm in enumerate(nombres)}; RH = {nm: glb.m2q(GH[k][:3, :3]) for k, nm in enumerate(nombres)}
paN = {nm: arb[arb[bo[k]]['pa']]['n'].split(':')[-1] for k, nm in enumerate(nombres)}
hips_nodo = arb[bo[KB['Hips']]]; RROOT = np.array(arb[HERO]['r'])
# (comprobación: la cadera del Hero en reposo es la de la pose de enlace llevada al marco de la raíz)
print('cadera Hero: nodo r', np.round(hips_nodo['r'], 3), 'enlace (en la raíz)', np.round(glb.qmul(glb.qconj(RROOT), RH['Hips']), 3), 'p', np.round(hips_nodo['p'], 3), 'J', np.round(JH['Hips'], 3))
HIJO = {'Spine': 'Spine1', 'Spine1': 'Spine2', 'Spine2': 'Neck', 'Neck': 'Head'}
for lado in ('Left', 'Right'):
    HIJO.update({lado + 'Shoulder': lado + 'Arm', lado + 'Arm': lado + 'ForeArm', lado + 'ForeArm': lado + 'Hand', lado + 'UpLeg': lado + 'Leg', lado + 'Leg': lado + 'Foot', lado + 'Foot': lado + 'ToeBase'})

def slerp(a, b, t):
    c = np.dot(a, b)
    if c < 0: b = -b; c = -c
    if c > 0.9995: q = a + (b - a) * t
    else: o = np.arccos(c); q = (np.sin((1 - t) * o) * a + np.sin(t * o) * b) / np.sin(o)
    return q / np.linalg.norm(q)
def muestrear(J, B, samp, t):
    ti = glb.acc(J, B, samp['input'])[:, 0]; v = glb.acc(J, B, samp['output'])
    if t <= ti[0]: return v[0]
    if t >= ti[-1]: return v[-1]
    k = np.searchsorted(ti, t) - 1; a = (t - ti[k]) / max(ti[k + 1] - ti[k], 1e-9)
    return slerp(v[k], v[k + 1], a) if v.shape[1] == 4 else v[k] + (v[k + 1] - v[k]) * a

def convertir(ruta):
    J, B = glb.leer(ruta); sk = J['skins'][0]; IBM = glb.acc(J, B, sk['inverseBindMatrices'])
    jn = sk['joints']; mjn = [J['nodes'][j]['name'] for j in jn]; GM = [np.linalg.inv(x) for x in IBM]
    PM = {m: GM[k][:3, 3] for k, m in enumerate(mjn)}; S0 = {m: glb.m2q(GM[k][:3, :3]) for k, m in enumerate(mjn)}
    pam = glb.padres(J); jidx = {j: k for k, j in enumerate(jn)}
    mpa = {mjn[k]: (J['nodes'][pam[j]]['name'] if pam.get(j) in jidx else None) for k, j in enumerate(jn)}
    MAP = {'Hips': 'Hips', 'neck': 'Neck', 'Head': 'Head'}
    col = sorted([m for m in mjn if m.lower().startswith('spine')], key=lambda m: PM[m][1])
    for m, o in zip(col, ['Spine', 'Spine1', 'Spine2']): MAP[m] = o
    for lado in ('Left', 'Right'):
        for p in ('Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase'): MAP[lado + p] = lado + p
    inv = {o: m for m, o in MAP.items() if m in PM}
    # la misma alineación que los skins: de la pose T del riggeo a la pose de enlace del Hero
    orden = []
    def poner(m):
        if m in orden: return
        if mpa[m]: poner(mpa[m])
        orden.append(m)
    for m in mjn: poner(m)
    QW = {}
    for m in orden:
        p = mpa[m]; QW[m] = QW[p].copy() if p else np.array([0, 0, 0, 1.0])
        o = MAP.get(m)
        if o in HIJO and HIJO[o] in inv:
            c = inv[HIJO[o]]; cur = glb.qrot(QW[m], PM[c] - PM[m]); QW[m] = glb.qmul(glb.rot_entre(cur, JH[HIJO[o]] - JH[o]), QW[m])
    K = {m: glb.qmul(glb.qconj(glb.qmul(QW[m], S0[m])), RH[MAP[m]]) for m in MAP if m in PM}
    # la animación: cinemática directa en el espacio de la piel (la malla), cuadro por cuadro
    an = J['animations'][0]; canales = {}
    for ch in an['channels']: canales.setdefault(ch['target']['node'], {})[ch['target']['path']] = an['samplers'][ch['sampler']]
    dur = max(glb.acc(J, B, s['input'])[:, 0].max() for s in an['samplers'])
    mi = next(i for i, n in enumerate(J['nodes']) if 'mesh' in n and 'skin' in n)
    W0 = glb.mundo(J); Mm = np.linalg.inv(W0[jn[0]] @ IBM[0])   # (el marco de la piel: hueso en reposo × su inversa de enlace)
    nf = max(2, int(round(dur * FPS)) + 1); hu = [o for o in nombres if o in inv and o != 'HeadTop_End']
    escala = JH['Hips'][1] / PM[inv['Hips']][1]    # (la cadera a la altura de la del Hero, como los skins)
    R = np.zeros((nf, len(hu), 4)); Hp = np.zeros((nf, 3))
    for f in range(nf):
        t = min(dur, f / FPS); loc = {}
        for ni, ch in canales.items():
            n = J['nodes'][ni]
            tr = muestrear(J, B, ch['translation'], t) if 'translation' in ch else n.get('translation', [0, 0, 0])
            ro = muestrear(J, B, ch['rotation'], t) if 'rotation' in ch else n.get('rotation', [0, 0, 0, 1])
            sc = muestrear(J, B, ch['scale'], t) if 'scale' in ch else n.get('scale', [1, 1, 1])
            loc[ni] = glb.trs(tr, ro, sc)
        W = glb.mundo(J, loc); OUR = {}
        for o in hu:
            m = inv[o]; Wm = Mm @ W[jn[mjn.index(m)]]
            OUR[o] = glb.qmul(glb.m2q(Wm[:3, :3]), K[m])
            if o == 'Hips': Hp[f] = (Wm[:3, 3] - PM[m]) * escala
        for k, o in enumerate(hu):
            if o == 'Hips': q = glb.qmul(glb.qconj(RROOT), OUR[o])
            else: q = glb.qmul(glb.qconj(OUR[paN[o]]), OUR[o])
            if f and np.dot(q, R[f - 1, k]) < 0: q = -q
            R[f, k] = q / np.linalg.norm(q)
    # en el lugar: sin la deriva horizontal (la tendencia lineal y la media en x y z); el rebote vertical se queda
    tt = np.arange(nf) / max(nf - 1, 1)
    for a in (0, 2): Hp[:, a] -= np.polyval(np.polyfit(tt, Hp[:, a], 1), tt)
    # la cadera en el marco de la raíz, en las unidades de los nodos (1,0525 la pose de enlace)
    Hn = np.array([glb.qrot(glb.qconj(RROOT), h) * 1.0525 for h in Hp])
    return hu, R, Hn, nf, dur

for arg in sys.argv[2:]:
    eid, nom, modo, ruta = arg.split(':', 3)
    modo, cat = (modo.split('/') + [''])[:2]
    hu, R, Hn, nf, dur = convertir(ruta)
    ri = np.clip(np.round(R * 32767), -32767, 32767).astype('<i2'); hi = np.clip(np.round(Hn * 1000), -32767, 32767).astype('<i2')
    d.setdefault('emo', {})[eid] = {'n': nom, 'fps': FPS, 'nf': nf, 'b': hu, 'r': base64.b64encode(ri.tobytes()).decode(), 'h': base64.b64encode(hi.tobytes()).decode(), 'loop': modo == 'loop', 'cat': cat or ('baile' if modo == 'loop' else 'gesto')}
    print(eid, nom, 'cuadros', nf, 'duración', round(dur, 2), 's', 'huesos', len(hu), 'cadera (m) min', np.round(Hn.min(0) / 1.0525, 2), 'max', np.round(Hn.max(0) / 1.0525, 2))
open(PK + '/d.json.gz', 'wb').write(gzip.compress(json.dumps(d, separators=(',', ':')).encode(), 6))
print('emotes en el paquete:', len(d.get('emo', {})))
