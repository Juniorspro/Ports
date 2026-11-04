# Emotes desde la base de captura de movimiento de CMU (BVH, conversión "Poser-friendly" de B. Hahne, dominio público):
# cada hueso del juego copia la orientación animada de su equivalente (con la diferencia entre la pose T del BVH y la
# pose de enlace del Hero, como emote_meshy.py), en rotaciones locales a 15 cuadros por segundo más el movimiento de la
# cadera, en el lugar. El esqueleto de CMU tiene 19 articulaciones: abdomen → Spine, chest → Spine2 (Spine1 va a mitad
# de camino), sin dedos ni puntas de pie (esos siguen la animación de quieto).
# Salida (fuera del HTML, se bajan a pedido): CARPETA/NN_MM.bin (gzip) con
#   'RBE2', nf (u16), fps (u8), loop (u8), nb (u8), huesos (índices en BONES), las rotaciones (xyzw por hueso, ×8191) y la
#   cadera (xyz en mm), todo int16 como diferencias con el cuadro anterior y con los bytes en planos (bajos y después
#   altos): así el gzip las achica a la mitad. Hasta 20 s; los que no tienen descripción ("Unknown") no van
# y CARPETA/catalogo.json: [[id, nombre, categoría, duración, loop], ...] (va en el HTML)
# Uso: python3 -I emote_bvh.py PAQUETE CARPETA_CMU SALIDA [MAX_SEG=20]
import sys, os, re, json, gzip, struct, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glb
PK, CMU, OUT = sys.argv[1:4]; MAXS = float(sys.argv[4]) if len(sys.argv) > 4 else 20.0; FPS = 15
BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
         'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot']
MAP = {'hip': 'Hips', 'abdomen': 'Spine', 'chest': 'Spine2', 'neck': 'Neck', 'head': 'Head',
       'lCollar': 'LeftShoulder', 'lShldr': 'LeftArm', 'lForeArm': 'LeftForeArm', 'lHand': 'LeftHand',
       'rCollar': 'RightShoulder', 'rShldr': 'RightArm', 'rForeArm': 'RightForeArm', 'rHand': 'RightHand',
       'lThigh': 'LeftUpLeg', 'lShin': 'LeftLeg', 'lFoot': 'LeftFoot', 'rThigh': 'RightUpLeg', 'rShin': 'RightLeg', 'rFoot': 'RightFoot'}
# el hueso que marca la dirección de cada uno (para alinear la pose T con la de enlace del Hero)
HIJO = {'Spine': 'Spine2', 'Spine2': 'Neck', 'Neck': 'Head'}
for l in ('Left', 'Right'):
    HIJO.update({l + 'Shoulder': l + 'Arm', l + 'Arm': l + 'ForeArm', l + 'ForeArm': l + 'Hand', l + 'UpLeg': l + 'Leg', l + 'Leg': l + 'Foot', l + 'Foot': l + 'ToeBase'})
# ---------------- el Hero ----------------
d = json.load(gzip.open(PK + '/d.json.gz'))
arb = d['pf']['PhotonPlayer#b2dc44']
CR = next(i for i, n in enumerate(arb) if n['n'] == 'CharactersRoot')
HERO = next(i for i, n in enumerate(arb) if n['n'] == 'Hero' and n['pa'] == CR)
HM = next(i for i, n in enumerate(arb) if n['pa'] == HERO and 'm' in n)
mh = d['ms'][arb[HM]['m']]; bo = arb[HM]['bo']
nombres = [arb[b]['n'].split(':')[-1] for b in bo]; KB = {nm: k for k, nm in enumerate(nombres)}
GH = np.array([np.linalg.inv(np.array(b).reshape(4, 4)) for b in mh['bp']])
JH = {nm: GH[k][:3, 3] for k, nm in enumerate(nombres)}; RH = {nm: glb.m2q(GH[k][:3, :3]) for k, nm in enumerate(nombres)}
paN = {nm: arb[arb[bo[k]]['pa']]['n'].split(':')[-1] for k, nm in enumerate(nombres)}
RROOT = np.array(arb[HERO]['r'])
# ---------------- BVH ----------------
def leer_bvh(ruta):
    tx = open(ruta, encoding='latin-1').read(); h, m = tx.split('MOTION')
    tok = h.split(); i = 0; J = []; pila = []; ult = None
    while i < len(tok):
        t = tok[i]
        if t in ('ROOT', 'JOINT'): J.append({'n': tok[i + 1], 'pa': pila[-1] if pila else -1, 'off': None, 'ch': [], 'fin': None}); ult = len(J) - 1; i += 2
        elif t == 'End': ult = ('fin', pila[-1]); i += 2
        elif t == '{': pila.append(ult if not isinstance(ult, tuple) else -2); i += 1
        elif t == '}': pila.pop(); i += 1
        elif t == 'OFFSET':
            v = np.array([float(x) for x in tok[i + 1:i + 4]])
            if isinstance(ult, tuple): J[ult[1]]['fin'] = v
            else: J[ult]['off'] = v
            i += 4
        elif t == 'CHANNELS': n = int(tok[i + 1]); J[ult]['ch'] = tok[i + 2:i + 2 + n]; i += 2 + n
        else: i += 1
    ln = m.strip().split('\n'); nf = int(ln[0].split(':')[1]); dt = float(ln[1].split(':')[1])
    M = np.array([[float(x) for x in l.split()] for l in ln[2:2 + nf] if l.strip()])
    return J, M, dt
def eje(c, a):
    c_, s_ = np.cos(a), np.sin(a); n = len(a); R = np.zeros((n, 3, 3)); R[:, 0, 0] = R[:, 1, 1] = R[:, 2, 2] = 1
    i, j = {'X': (1, 2), 'Y': (2, 0), 'Z': (0, 1)}[c]
    R[:, i, i] = c_; R[:, j, j] = c_; R[:, i, j] = -s_; R[:, j, i] = s_
    return R
def m2q_v(M):   # matrices → cuaterniones [x, y, z, w] (vectorizado)
    m = M; t = m[:, 0, 0] + m[:, 1, 1] + m[:, 2, 2]; q = np.zeros((len(m), 4))
    a = t > 0; s = np.sqrt(np.maximum(t[a] + 1, 1e-12)) * 2
    q[a] = np.stack([(m[a, 2, 1] - m[a, 1, 2]) / s, (m[a, 0, 2] - m[a, 2, 0]) / s, (m[a, 1, 0] - m[a, 0, 1]) / s, 0.25 * s], 1)
    b = ~a & (m[:, 0, 0] > m[:, 1, 1]) & (m[:, 0, 0] > m[:, 2, 2]); s = np.sqrt(np.maximum(1 + m[b, 0, 0] - m[b, 1, 1] - m[b, 2, 2], 1e-12)) * 2
    q[b] = np.stack([0.25 * s, (m[b, 0, 1] + m[b, 1, 0]) / s, (m[b, 0, 2] + m[b, 2, 0]) / s, (m[b, 2, 1] - m[b, 1, 2]) / s], 1)
    c = ~a & ~b & (m[:, 1, 1] > m[:, 2, 2]); s = np.sqrt(np.maximum(1 + m[c, 1, 1] - m[c, 0, 0] - m[c, 2, 2], 1e-12)) * 2
    q[c] = np.stack([(m[c, 0, 1] + m[c, 1, 0]) / s, 0.25 * s, (m[c, 1, 2] + m[c, 2, 1]) / s, (m[c, 0, 2] - m[c, 2, 0]) / s], 1)
    e = ~a & ~b & ~c; s = np.sqrt(np.maximum(1 + m[e, 2, 2] - m[e, 0, 0] - m[e, 1, 1], 1e-12)) * 2
    q[e] = np.stack([(m[e, 0, 2] + m[e, 2, 0]) / s, (m[e, 1, 2] + m[e, 2, 1]) / s, 0.25 * s, (m[e, 1, 0] - m[e, 0, 1]) / s], 1)
    return q / np.linalg.norm(q, axis=1, keepdims=True)
def qmul_v(a, b):   # producto de cuaterniones [x, y, z, w] fila a fila (b puede ser uno solo)
    b = np.broadcast_to(b, a.shape) if b.ndim == 1 else b; a = np.broadcast_to(a, b.shape) if a.ndim == 1 else a
    ax, ay, az, aw = a.T; bx, by, bz, bw = b.T
    return np.stack([aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz], 1)
def qconj_v(a): return a * np.array([-1, -1, -1, 1.0])
def convertir(ruta):
    J, M, dt = leer_bvh(ruta); nf0 = len(M)
    # cinemática directa de todos los cuadros
    col = 0; Wr = {}; Wp = {}; PM = {}
    for k, j in enumerate(J):
        n = len(j['ch']); ch = M[:, col:col + n]; col += n
        R = np.tile(np.eye(3), (nf0, 1, 1)); p = np.tile(j['off'], (nf0, 1))
        for c, nm in enumerate(j['ch']):
            if nm.endswith('rotation'): R = R @ eje(nm[0], np.radians(ch[:, c]))
            else: p[:, 'XYZ'.index(nm[0])] = ch[:, c] + (0 if j['pa'] < 0 else j['off']['XYZ'.index(nm[0])])
        if j['pa'] < 0: Wr[k] = R; Wp[k] = p; PM[k] = j['off'].copy()
        else: P = j['pa']; Wr[k] = Wr[P] @ R; Wp[k] = Wp[P] + np.einsum('nij,j->ni', Wr[P], j['off']); PM[k] = PM[P] + j['off']
    idx = {j['n']: k for k, j in enumerate(J)}
    pm = {MAP[n]: PM[k] for n, k in idx.items() if n in MAP}
    for l, n in (('Left', 'lFoot'), ('Right', 'rFoot')): pm[l + 'ToeBase'] = PM[idx[n]] + J[idx[n]]['fin']
    piso = min(pm['LeftToeBase'][1], pm['RightToeBase'][1]); altoC = pm['Hips'][1] - piso
    # alineación: de la pose T del BVH a la de enlace del Hero (por la dirección hacia el hijo)
    QW = {}
    for j in J:
        o = MAP.get(j['n'])
        if o is None: continue
        pa = J[j['pa']]['n'] if j['pa'] >= 0 else None; QW[o] = QW[MAP[pa]].copy() if pa else np.array([0, 0, 0, 1.0])
        if o in HIJO and HIJO[o] in pm:
            cur = glb.qrot(QW[o], pm[HIJO[o]] - pm[o]); QW[o] = glb.qmul(glb.rot_entre(cur, JH[HIJO[o]] - JH[o]), QW[o])
    K = {o: glb.qmul(glb.qconj(QW[o]), RH[o]) for o in QW}
    # a 20 cuadros por segundo, hasta MAXS segundos
    dur = min((nf0 - 1) * dt, MAXS); nf = max(2, int(dur * FPS) + 1); tf = np.arange(nf) / FPS / dt
    i0 = np.clip(np.floor(tf).astype(int), 0, nf0 - 1); i1 = np.clip(i0 + 1, 0, nf0 - 1); a = (tf - i0)[:, None]
    OUR = {}
    for n, k in idx.items():
        if n not in MAP: continue
        q0 = m2q_v(Wr[k][i0]); q1 = m2q_v(Wr[k][i1]); s = np.sign(np.sum(q0 * q1, 1))[:, None]; q = q0 * (1 - a) + q1 * s * a
        q /= np.linalg.norm(q, axis=1, keepdims=True)
        OUR[MAP[n]] = qmul_v(q, K[MAP[n]])
    # Spine1 a mitad de camino entre Spine y Spine2
    s1 = OUR['Spine'] + OUR['Spine2'] * np.sign(np.sum(OUR['Spine'] * OUR['Spine2'], 1))[:, None]; OUR['Spine1'] = s1 / np.linalg.norm(s1, axis=1, keepdims=True)
    R = np.zeros((nf, len(BONES), 4))
    for b, o in enumerate(BONES):
        q = qmul_v(glb.qconj(RROOT), OUR[o]) if o == 'Hips' else qmul_v(qconj_v(OUR[paN[o]]), OUR[o])
        q /= np.linalg.norm(q, axis=1, keepdims=True)
        sg = np.sign(np.sum(q[1:] * q[:-1], 1)); sg[sg == 0] = 1; sg = np.concatenate([[1], np.cumprod(sg)])   # (sin saltos de signo)
        R[:, b] = q * sg[:, None]
    hp = Wp[idx['hip']]; hp = hp[i0] * (1 - a) + hp[i1] * a
    esc = JH['Hips'][1] / altoC
    # el piso de la captura: lo más bajo del cuerpo en cada cuadro (las puntas de los pies tal cual; las demás articulaciones
    # menos el grueso del cuerpo, ~8 cm: acostado o rodando apoya la espalda, no los pies): el 20 % más bajo (casi siempre
    # algo apoya). Si hay cuadros más de 15 cm por debajo de ese piso (el 2 % más bajo: marcadores que saltan en la
    # captura) el clip no va
    pies = [Wp[idx[n]] + np.einsum('nij,j->ni', Wr[idx[n]], J[idx[n]]['fin']) for n in ('lFoot', 'rFoot')]
    grueso = 0.08 * altoC / JH['Hips'][1]
    bajo = np.minimum(np.minimum(pies[0][:, 1], pies[1][:, 1]), np.min(np.stack([Wp[k][:, 1] for k in Wp if J[k]['n'] not in ('lFoot', 'rFoot')], 1), 1) - grueso)
    pisoC = np.percentile(bajo, 20)
    if pisoC - np.percentile(bajo, 2) > 0.15 * altoC / JH['Hips'][1]: raise ValueError('piso disparejo')
    Hp = np.stack([hp[:, 0], hp[:, 1] - pisoC - altoC, hp[:, 2]], 1) * esc
    # acostado o en cuatro patas sobre algo (una cama: la captura 111 rueda en una): con el torso echado (más de 50° de la
    # vertical) y el cuerpo en el aire, se baja hasta apoyar en el piso (suave, sin hundirse). Los saltos no: ahí el torso
    # va derecho
    bj = bajo[i0] * (1 - a[:, 0]) + bajo[i1] * a[:, 0]; elev = np.maximum(bj - pisoC, 0)
    tor = Wp[idx['neck']] - Wp[idx['hip']]; tor = tor[i0] * (1 - a) + tor[i1] * a
    echado = np.abs(tor[:, 1]) / np.maximum(np.linalg.norm(tor, axis=1), 1e-9) < np.cos(np.radians(50))
    corr = np.where(echado, elev, 0.0)
    k = np.ones(7) / 7; corr = np.minimum(np.convolve(np.pad(corr, 3, mode='edge'), k, mode='valid'), elev)
    Hp[:, 1] -= corr * esc
    tt = np.arange(nf) / max(nf - 1, 1)
    for c in (0, 2): Hp[:, c] -= np.polyval(np.polyfit(tt, Hp[:, c], 1), tt)   # en el lugar (sin ir para ningún lado)
    Hn = np.array([glb.qrot(glb.qconj(RROOT), h) * 1.0525 for h in Hp])
    return R, Hn, nf, dur, esc
# ---------------- descripciones y categorías ----------------
DESC = {}
for l in open(os.path.join(CMU, 'cmu-mocap-index-text.txt'), encoding='latin-1'):
    m = re.match(r'^(\d+_\d+)\s+(.*)$', l.strip())
    if m: DESC[m.group(1)] = m.group(2).strip()
CATS = [('baile', r'danc|salsa|charleston|breakdanc|lambada|swing danc|lindy|waltz|tango|hiphop|hip hop|ballet|jive|disco|twist|moonwalk'),
        ('pelea', r'box|punch|kick|fight|karate|martial|kung fu|taekwondo|sword|block|jab|uppercut|wrestl|attack'),
        ('deporte', r'basketball|soccer|football|golf|baseball|tennis|bowling|frisbee|volley|ball|swim|ski|skate|throw|catch|pitch|sport|stretch|exercise|yoga|jumping jack|push up|sit up|squat'),
        ('acrobacia', r'cartwheel|flip|somersault|handstand|acrobat|roll|gymnast|backflip|spin|twirl'),
        ('animal', r'animal|monkey|chicken|bird|elephant|bear|dog|cat |cats|frog|penguin|dinosaur|snake|horse|crab|zombie|mummy'),
        ('gesto', r'wave|gesture|point|clap|cheer|bow|salute|nod|shrug|laugh|cry|angry|sad|happy|express|scream|celebrat|beckon|shush|thumb|signal|direct traffic|conduct'),
        ('accion', r'jump|hop|leap|climb|crawl|duck|dodge|fall|get up|kneel|lie|pick up|carry|push|pull|reach|lift|open|drink|eat|sit|stand|sweep|wash|wipe|mop|paint|play|instrument|piano|guitar|violin|drum|steer|drive|shoot|aim|tired|drunk|sneak|tiptoe|hide|look'),
        ('caminar', r'walk|run|jog|march|stride|stroll|limp|sprint|navigate|turn|stairs|step')]
def categoria(s):
    s = s.lower()
    for c, rx in CATS:
        if re.search(rx, s): return c
    return 'otro'
BUC = re.compile(r'danc|walk|run|jog|march|salsa|swing|waltz|tango|charleston|jumping jack|idle|stand|wait|wave|clap|cheer|breath', re.I)
# los que necesitan muebles u objetos que en el juego no están (camas, sillas, escaleras, juegos de plaza...): no van
MUEBLES = re.compile(r'\b(bed|table|chair|sofa|couch|bench|stool|ladder|stairs?|playground|climb(s|ing)?|box(es)?|ledge|platform|curb|on top of|onto|obstacles?|swing(s|ing)? (on|from)|monkey bars|rope|car|bike|bicycle|horse|treadmill|desk|seat|cabinet|shelf|door|window|wall)\b', re.I)
# ---------------- todo ----------------
os.makedirs(OUT, exist_ok=True); cat = []
fs = sorted(f for f in (os.path.join(r, x) for r, _, xs in os.walk(CMU) for x in xs) if f.endswith('.bvh'))
for k, f in enumerate(fs):
    eid = os.path.basename(f)[:-4]
    try: R, Hn, nf, dur, esc = convertir(f)
    except Exception as e: print('mal', eid, e); continue
    if nf < 10 or not np.isfinite(R).all() or np.abs(Hn).max() > 30: print('descarto', eid, nf); continue
    desc = DESC.get(eid, 'Unknown')
    if desc.strip().lower() in ('unknown', '') or MUEBLES.search(desc): continue
    c = categoria(desc); loop = bool(BUC.search(desc)) and c in ('baile', 'caminar', 'gesto')
    ri = np.clip(np.round(R * 8191), -8191, 8191).astype(np.int32); hi = np.clip(np.round(Hn * 1000), -32767, 32767).astype(np.int32)
    dr = np.diff(ri, axis=0, prepend=0).astype('<i2'); dh = np.diff(hi, axis=0, prepend=0).astype('<i2')   # (diferencias, envueltas a 16 bits)
    planos = lambda a: a.reshape(-1).view(np.uint8).reshape(-1, 2).T.tobytes()
    cab = b'RBE2' + struct.pack('<HBBB', nf, FPS, 1 if loop else 0, len(BONES)) + bytes(range(len(BONES)))
    datos = cab + planos(dr) + planos(dh)
    open(os.path.join(OUT, eid + '.bin'), 'wb').write(gzip.compress(datos, 9, mtime=0))
    cat.append([eid, desc, c, round(dur, 1), 1 if loop else 0])
    if k % 200 == 0: print(k, '/', len(fs), eid, desc[:50], c, nf, 'escala', round(esc, 4))
json.dump({'huesos': BONES, 'items': cat}, open(os.path.join(OUT, 'catalogo.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter
print('listo', len(cat), 'emotes', dict(Counter(x[2] for x in cat)), 'bytes', sum(os.path.getsize(os.path.join(OUT, x[0] + '.bin')) for x in cat))
