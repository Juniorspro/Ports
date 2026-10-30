# Freddy, Bonnie, Chica y Foxy (los de la pizzería, de pizzeria.py) también como personajes para jugar. Usan la misma
# malla y las mismas texturas que en el mapa (sólo se agregan los pesos de los huesos nuevos): como en skin_meshy.py, cada
# hueso del Hero va a la articulación que le corresponde del animatrónico (con las orientaciones de enlace del Hero, así
# anima con todos los clips del juego) y brazos, manos, dedos y piernas se giran de su pose T a la del Hero; acá ese giro va
# dentro de la pose de enlace de cada hueso en vez de mover los vértices. La columna (un solo hueso en los animatrónicos)
# se reparte en las tres del juego según la altura. La altura se ajusta para que la cadera quede a la del Hero.
# Uso: python3 -I skin_fnaf.py PAQUETE_ORIGEN PAQUETE_NUEVO [CARPETA_RETRATOS]
# (retratos: freddy.png, bonnie.png, chica.png, foxy.png, capturas de la cabeza en el visor de Personajes, para la tienda)
import sys, os, json, gzip, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glb

PK0, PK1 = sys.argv[1:3]; RET = sys.argv[3] if len(sys.argv) > 3 else None
d = json.load(gzip.open(PK0 + '/d.json.gz')); BIN = bytearray(gzip.decompress(open(PK0 + '/m.bin.gz', 'rb').read()))
arb = d['pf']['PhotonPlayer#b2dc44']
CR = next(i for i, n in enumerate(arb) if n['n'] == 'CharactersRoot')
NOMS = ['Freddy', 'Bonnie', 'Chica', 'Foxy']
for nom in NOMS: assert nom not in d['chars'], 'el paquete ya tiene a ' + nom

# ---------------- el Hero: esqueleto y pose de enlace ----------------
HERO = next(i for i, n in enumerate(arb) if n['n'] == 'Hero' and n['pa'] == CR)
HM = next(i for i, n in enumerate(arb) if n['pa'] == HERO and 'm' in n)
mh = d['ms'][arb[HM]['m']]; bo = arb[HM]['bo']
nombres = [arb[b]['n'].split(':')[-1] for b in bo]; KB = {nm: k for k, nm in enumerate(nombres)}
GH = np.array([np.linalg.inv(np.array(b, float).reshape(4, 4)) for b in mh['bp']])
JH = {nm: GH[k][:3, 3] for k, nm in enumerate(nombres)}
paN = {nm: arb[arb[bo[k]]['pa']]['n'].split(':')[-1] for k, nm in enumerate(nombres)}
def hondo(nm):
    k = 0
    while nm in paN and paN[nm] in KB: nm = paN[nm]; k += 1
    return k
ORDEN = sorted(nombres, key=hondo)   # (los padres primero)

# ---------------- huesos del animatrónico → huesos del juego ----------------
MAPEO = {'Hips_jnt': 'Hips', 'Spine_jnt': 'Spine', 'Neck_jnt': 'Neck', 'Head_jnt': 'Head'}
for L, lado in (('L', 'Left'), ('R', 'Right')):
    MAPEO.update({L + '_Shoulder_jnt': lado + 'Arm', L + '_Elbow_jnt': lado + 'ForeArm', L + '_Wrist_jnt': lado + 'Hand', L + '_UpperLeg_jnt': lado + 'UpLeg',
                  L + '_Knee_jnt': lado + 'Leg', L + '_Ankle_jnt': lado + 'Foot', L + '_Toes_jnt': lado + 'ToeBase', L + '_ToesA_jnt': lado + 'ToeBase'})
    for dedo in ('Thumb', 'Index', 'Middle', 'Pinky'):
        for a, k in (('A', 1), ('B', 2), ('C', 3)): MAPEO['%s_%s%s_jnt' % (L, dedo, a)] = '%sHand%s%d' % (lado, dedo, k)
# brazos, manos, dedos y piernas: cada uno apuntando a su hijo como en el Hero (la columna, el cuello y la cabeza quedan
# como los hicieron: así el cuerpo no se inclina; y los pies, planos en el piso como el Hero)
ALINEAR = {}
for lado in ('Left', 'Right'):
    ALINEAR.update({lado + 'Arm': lado + 'ForeArm', lado + 'ForeArm': lado + 'Hand', lado + 'Hand': lado + 'HandMiddle1', lado + 'UpLeg': lado + 'Leg', lado + 'Leg': lado + 'Foot'})
    for dedo in ('Thumb', 'Index', 'Middle', 'Pinky'): ALINEAR.update({'%sHand%s1' % (lado, dedo): '%sHand%s2' % (lado, dedo), '%sHand%s2' % (lado, dedo): '%sHand%s3' % (lado, dedo)})
def A4(R3, t):
    X = np.eye(4); X[:3, :3] = R3; X[:3, 3] = t; return X
def leer_malla(m):
    q = np.frombuffer(bytes(BIN[m['o']:m['o'] + m['v'] * 14]), np.uint8).reshape(-1, 14)
    V = np.array(m['mn']) + q[:, 0:6].copy().view('<u2').astype(np.float64) / 65535 * np.array(m['sc'])
    s = np.frombuffer(bytes(BIN[m['sk']:m['sk'] + m['v'] * 8]), np.uint8).reshape(-1, 8)
    return V, s[:, :4].astype(np.int64), s[:, 4:].astype(np.float64) / 255
def agregar(b):
    while len(BIN) % 4: BIN.append(0)
    o = len(BIN); BIN.extend(b); return o

for ni, NOM in enumerate(NOMS):
    fa = d['fn']['pf'][NOM]; fmi = next(i for i, n in enumerate(fa) if 'bo' in n); fn = fa[fmi]; fm = d['ms'][fn['m']]
    V, FJ, FW = leer_malla(fm)
    # pose de enlace de cada hueso del animatrónico (encadenando los nodos; los que tienen peso, de su pose de enlace)
    Wn = []
    for n in fa: L4 = glb.trs(n['p'], n['r'], n['s']); Wn.append(L4 if n['pa'] < 0 else Wn[n['pa']] @ L4)
    for k, b in enumerate(fn['bo']):
        Gb = np.linalg.inv(np.array(fm['bp'][k], float).reshape(4, 4)); err = np.abs(Gb[:3, 3] - Wn[b][:3, 3]).max()
        assert err < 2e-3, (NOM, fa[b]['n'], err)
        Wn[b] = Gb
    fnom = [n['n'] for n in fa]
    def juego(i):   # el hueso del juego que mueve al hueso i del animatrónico (el suyo o el de su padre más cercano)
        while i > 0 and not (fnom[i] in MAPEO and MAPEO[fnom[i]] in KB): i = fa[i]['pa']
        return MAPEO.get(fnom[i], 'Hips')
    PM = {}
    for i in range(1, len(fa)):
        g = MAPEO.get(fnom[i])
        if g in KB and g not in PM: PM[g] = Wn[i][:3, 3].copy()
    for g in ('Hips', 'Spine', 'Neck', 'Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'LeftHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot'): assert g in PM, (NOM, g)
    # mirando hacia +z (como el Hero) y a la medida: la cadera a la altura de la del Hero, los pies en el piso
    izq = PM['LeftArm'] - PM['RightArm']; izq[1] = 0; f = np.cross(izq / np.linalg.norm(izq), [0, 1, 0]); f /= np.linalg.norm(f)
    a = np.arctan2(f[0], f[2]); R0 = glb.q2m(np.array([0, np.sin(-a / 2), 0, np.cos(-a / 2)]))
    assert np.allclose(R0 @ f, [0, 0, 1], atol=1e-6)
    Vr = V @ R0.T; y0 = Vr[:, 1].min(); h0 = (R0 @ PM['Hips'])[1] - y0
    s = JH['Hips'][1] / h0; hr = R0 @ PM['Hips'] * s
    t = np.array([JH['Hips'][0] - hr[0], -y0 * s, JH['Hips'][2] - hr[2]])
    S4 = A4(R0 * s, t)
    PS = {g: S4[:3, :3] @ p + t for g, p in PM.items()}; VS = V @ S4[:3, :3].T + t
    # de pose T a la del Hero: giro (QW) y lugar nuevo (PP) de cada articulación con hueso propio
    QW, PP = {}, {}
    def padreMap(g):
        p = paN.get(g)
        while p is not None and p not in PS: p = paN.get(p)
        return p
    for g in ORDEN:
        if g not in PS: continue
        p = padreMap(g)
        if p is None: QW[g] = np.eye(3); PP[g] = PS[g].copy()
        else: PP[g] = PP[p] + QW[p] @ (PS[g] - PS[p]); QW[g] = np.eye(3) if g.endswith('Foot') else QW[p].copy()
        c = ALINEAR.get(g)
        if c in PS:
            cur = QW[g] @ (PS[c] - PS[g]); QW[g] = glb.q2m(glb.rot_entre(cur, JH[c] - JH[g])) @ QW[g]
    # ---------------- articulaciones del juego en esa malla ----------------
    JN = dict(PP)
    largo = lambda a, b, J: np.linalg.norm(J[b] - J[a])
    # columna: Spine1 y Spine2 entre Spine y Neck, en las mismas proporciones que el Hero
    lh = [largo('Spine', 'Spine1', JH), largo('Spine1', 'Spine2', JH), largo('Spine2', 'Neck', JH)]; f1, f2 = lh[0] / sum(lh), (lh[0] + lh[1]) / sum(lh)
    JN['Spine1'] = PP['Spine'] + (PP['Neck'] - PP['Spine']) * f1; JN['Spine2'] = PP['Spine'] + (PP['Neck'] - PP['Spine']) * f2
    ancho = largo('LeftArm', 'RightArm', JN) / largo('LeftArm', 'RightArm', JH)
    for lado in ('Left', 'Right'): JN[lado + 'Shoulder'] = JN[lado + 'Arm'] + (JH[lado + 'Shoulder'] - JH[lado + 'Arm']) * ancho
    # la punta del pie (los que no tienen dedos): sobre el piso, hacia adelante del tobillo, por lo que mide el pie
    dom = np.zeros(len(V), np.int64); wmax = np.zeros(len(V))
    for c in range(4):
        gi = np.array([KB[juego(fn['bo'][j])] if FW[v, c] > 0 else -1 for v, j in enumerate(FJ[:, c])])
        mejor = FW[:, c] > wmax; dom[mejor] = gi[mejor]; wmax[mejor] = FW[mejor, c]
    for lado in ('Left', 'Right'):
        if lado + 'ToeBase' in JN: continue
        pie = VS[dom == KB[lado + 'Foot']]; tob = PS[lado + 'Foot']
        frente = np.percentile(pie[:, 2], 98); JN[lado + 'ToeBase'] = PP[lado + 'Foot'] + QW[lado + 'Foot'] @ (np.array([tob[0], pie[:, 1].min() + 0.03, tob[2] + 0.6 * (frente - tob[2])]) - tob)
    # lo demás (dedos que no tiene, el anular): como en el Hero, a la escala de la mano
    for g in ORDEN:
        if g in JN: continue
        p = paN[g]; base = p
        while base not in PS and base in paN: base = paN[base]
        r = largo('LeftForeArm', 'LeftHand', JN) / largo('LeftForeArm', 'LeftHand', JH) if 'Hand' in base else 1.0
        JN[g] = JN[p] + (JH[g] - JH[p]) * r
    GN = GH.copy()
    for k, nm in enumerate(nombres): GN[k][:3, 3] = JN[nm]
    # ---------------- pesos: a los huesos del juego (la columna repartida por altura) ----------------
    NB = len(nombres); WD = np.zeros((len(V), NB))
    sp, nk = PS['Spine'], PS['Neck']; u = (nk - sp) / np.linalg.norm(nk - sp); tcol = (VS - sp) @ u / np.linalg.norm(nk - sp)
    w_sp = np.clip(1 - tcol / f1, 0, 1); w_s2 = np.clip((tcol - f1) / (f2 - f1), 0, 1); w_s1 = 1 - w_sp - w_s2
    for c in range(4):
        for j in np.unique(FJ[:, c]):
            sel = (FJ[:, c] == j) & (FW[:, c] > 0)
            if not sel.any(): continue
            g = juego(fn['bo'][j]); w = FW[sel, c]
            if g == 'Spine':
                WD[sel, KB['Spine']] += w * w_sp[sel]; WD[sel, KB['Spine1']] += w * w_s1[sel]; WD[sel, KB['Spine2']] += w * w_s2[sel]
            else: WD[sel, KB[g]] += w
    WD /= np.maximum(WD.sum(1, keepdims=True), 1e-9)
    top = np.argsort(-WD, 1)[:, :4]; tw = np.take_along_axis(WD, top, 1); tw /= tw.sum(1, keepdims=True)
    wb = np.floor(tw * 255).astype(np.int32); wb[:, 0] += 255 - wb.sum(1)
    skb = np.zeros((len(V), 8), np.uint8); skb[:, :4] = top; skb[:, 4:] = wb
    # pose de enlace de cada hueso del juego, con el giro de su parte adentro (la malla queda la del mapa)
    def dueno(g):
        if g in ('Spine1', 'Spine2'): return 'Spine'
        while g not in PS and g in paN: g = paN[g]
        return g
    BPN = []
    for k, nm in enumerate(nombres):
        m = dueno(nm); T = A4(QW[m], PP[m] - QW[m] @ PS[m]) @ S4
        BPN.append(np.linalg.inv(GN[k]) @ T)
    # control: la malla en la pose de enlace del Hero (cada vértice con sus 4 huesos) y cuánto se separa la piel de los huesos
    Vh = np.zeros_like(V); Vh1 = np.c_[V, np.ones(len(V))]
    for c in range(4):
        for k in np.unique(top[:, c]):
            sel = top[:, c] == k; Vh[sel] += (wb[sel, c] / 255)[:, None] * (Vh1[sel] @ (GN[k] @ BPN[k]).T)[:, :3]
    mano = Vh[dom == KB['LeftHand']]
    print(NOM, 'escala', round(s, 3), 'alto', round(Vh[:, 1].max() - Vh[:, 1].min(), 2), 'm (Hero 1,8) · pies', round(Vh[:, 1].min(), 3),
          '· mano izq.', np.round(mano.mean(0), 2), '(Hero', np.round(JH['LeftHand'], 2), ') · cadera', np.round(JN['Hips'], 3))
    # ---------------- al paquete: la misma malla con piel nueva, y el Hero copiado con las articulaciones movidas ----------------
    o_s = agregar(skb.tobytes())
    mi = len(d['ms']); x = json.loads(json.dumps(fm)); x.update(n='Skin_' + NOM, sk=o_s, bp=[[float(v) for v in B.reshape(16)] for B in BPN]); d['ms'].append(x)
    sub = [HERO]; k = 0
    while k < len(sub): sub += [i for i, n in enumerate(arb) if n['pa'] == sub[k] and not n['n'].startswith('(POLY FEW)')]; k += 1
    sub.sort(); base = len(arb); mapa = {o: base + i for i, o in enumerate(sub)}
    pos_bo = {b: KB[nombres[k]] for k, b in enumerate(bo)}
    for o in sub:
        n = json.loads(json.dumps(arb[o]))
        n['pa'] = mapa.get(n['pa'], n['pa'])
        if 'bo' in n: n['bo'] = [mapa.get(b, -1) if b >= 0 else -1 for b in n['bo']]
        if o == HERO: n['n'] = NOM; n.pop('lod', None)
        if o == HM: n['n'] = NOM; n['m'] = mi; n['mt'] = list(fn['mt']); n['rid'] = 9931100 + ni
        nm = arb[o]['n'].split(':')[-1]
        if o in pos_bo:
            k = pos_bo[o]; pa = arb[o]['pa']
            if pa in pos_bo:
                Th = np.linalg.inv(GH[pos_bo[pa]]) @ GH[k]; Tn = np.linalg.inv(GN[pos_bo[pa]]) @ GN[k]
                kk = np.linalg.norm(arb[o]['p']) / np.linalg.norm(Th[:3, 3]) if np.linalg.norm(Th[:3, 3]) > 1e-6 else 1.0525
                n['p'] = (Tn[:3, 3] * kk).tolist()
            else: n['p'] = (np.array(arb[o]['p']) + 1.0525 * (JN[nm] - JH[nm])).tolist()
            # colisionadores del muñeco a la medida del animatrónico
            if n.get('col'):
                hijos = [c for c in nombres if paN.get(c) == nm]; r = np.mean([largo(nm, c, JN) / max(largo(nm, c, JH), 1e-6) for c in hijos]) if hijos else 1.0
                for c in n['col']:
                    c['c'] = [v * r for v in c['c']]
                    if 's' in c: c['s'] = [v * r for v in c['s']]
                    if 'r' in c: c['r'] = c['r'] * r
                    if 'h' in c: c['h'] = c['h'] * r
        elif nm == 'HeadTop_End':   # (la coronilla: lo más alto de la cabeza)
            cab = Vh[dom == KB['Head']]; tope = np.array([JN['Head'][0], cab[:, 1].max(), JN['Head'][2]])
            n['p'] = (GH[KB['Head']][:3, :3].T @ (tope - JN['Head']) * 1.0525).tolist()
        elif arb[o]['pa'] in pos_bo:   # (las puntas de los dedos y del pie: a la medida de su hueso)
            pn = nombres[pos_bo[arb[o]['pa']]]; pp = paN.get(pn)
            r = largo(pp, pn, JN) / max(largo(pp, pn, JH), 1e-6) if pp in JN else 1.0
            n['p'] = (np.array(arb[o]['p']) * r).tolist()
        arb.append(n)
    d['chars'].append(NOM)

# ---------------- archivos ----------------
os.makedirs(PK1, exist_ok=True)
for sd in os.listdir(PK0):
    if not os.path.isdir(os.path.join(PK0, sd)): continue
    os.makedirs(os.path.join(PK1, sd), exist_ok=True)
    for f in os.listdir(os.path.join(PK0, sd)):
        dst = os.path.join(PK1, sd, f)
        if not os.path.exists(dst): os.link(os.path.join(PK0, sd, f), dst)
if RET:
    from PIL import Image
    for nom in NOMS:
        f = os.path.join(RET, nom.lower() + '.png')
        if not os.path.exists(f): print('sin retrato', nom); continue
        Image.open(f).convert('RGB').resize((256, 256), Image.LANCZOS).save(PK1 + '/i/%s.webp' % nom.lower(), 'WEBP', quality=88); d['ico'][nom.lower()] = nom.lower()
open(PK1 + '/m.bin.gz', 'wb').write(gzip.compress(bytes(BIN), 9))
open(PK1 + '/d.json.gz', 'wb').write(gzip.compress(json.dumps(d, separators=(',', ':')).encode(), 6))
print('listo: personajes', d['chars'][-6:], 'bin', len(BIN) // 1000, 'KB')
