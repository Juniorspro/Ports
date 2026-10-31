# Nivel de detalle (LOD) para las mallas con piel de los personajes: una versión simplificada de cada una (20 %
# de los triángulos) que el juego usa cuando el personaje ocupa menos del 20 % del alto de la pantalla (unos 7 m con la
# cámara de siempre; uno solo: dos pesaban 4,5 MB más en el HTML). Con 24 jugadores en pantalla
# los triángulos bajan mucho.
# - La malla se suelda por posición (las costuras de UV vienen con los vértices repetidos, y los personajes generados
#   tienen miles de islas chicas) y se simplifica entera (pyfqmr, quadric error).
# - Cada triángulo nuevo toma la isla de UV del triángulo original más cercano, y cada vértice suyo se proyecta sobre el
#   triángulo original más cercano de esa isla: UV y normal interpolados ahí, pesos del vértice más cercano de ese
#   triángulo. Un vértice que queda en dos islas se repite (como las costuras del original): la textura no se corre.
# - Mismos huesos y misma pose de enlace (bp) que la original: se anima igual.
# Guarda en d.json: ms[original].lods = [índice del LOD].
# Uso (con pyfqmr instalado): python lod_skins.py PAQUETE_ORIGEN PAQUETE_NUEVO
import sys, os, json, gzip, shutil, numpy as np
import pyfqmr
PK0, PK1 = sys.argv[1], sys.argv[2]
NIVELES = [0.2]; MIN_TRI = 2500; MIN_ISLA = 40
d = json.load(gzip.open(PK0 + '/d.json.gz')); BIN = bytearray(gzip.decompress(open(PK0 + '/m.bin.gz', 'rb').read()))
arb = d['pf']['PhotonPlayer#b2dc44']
CR = next(i for i, n in enumerate(arb) if n['n'] == 'CharactersRoot')
def sub_arbol(R):
    s = [R]; k = 0
    while k < len(s): s += [i for i, n in enumerate(arb) if n['pa'] == s[k]]; k += 1
    return s
mallas = []
for R in [i for i, n in enumerate(arb) if n['pa'] == CR and n['n'] in d['chars']]:
    for i in sub_arbol(R):
        n = arb[i]
        if n.get('bo') and 'm' in n and n['m'] >= 0 and n['m'] not in mallas: mallas.append(n['m'])
def leer(mi):
    m = d['ms'][mi]; v = m['v']; nt = sum(s[1] for s in m['sub']) // 3
    raw = np.frombuffer(bytes(BIN[m['o']:m['o'] + v * 14]), np.uint8).reshape(v, 14)
    P = np.array(m['mn']) + raw[:, :6].copy().view('<u2').astype(np.float64) / 65535 * np.array(m['sc'])
    sk = np.frombuffer(bytes(BIN[m['sk']:m['sk'] + v * 8]), np.uint8).reshape(v, 8)
    n_ = max(s[0] + s[1] for s in m['sub']); I = np.frombuffer(bytes(BIN[m['i']:m['i'] + n_ * (4 if m['i32'] else 2)]), '<u4' if m['i32'] else '<u2').astype(np.int64)
    return m, P, raw, sk, I
def islas(T, nv):
    pa = np.arange(nv)
    def r(a):
        while pa[a] != a: pa[a] = pa[pa[a]]; a = pa[a]
        return a
    for a, b, c in T:
        ra, rb, rc = r(a), r(b), r(c)
        if rb != ra: pa[rb] = ra
        rc = r(c)
        if rc != ra: pa[rc] = ra
    return np.array([r(x) for x in range(nv)])
def cercano(Q, P, cand):   # índice (en cand) del vértice más cercano a cada punto de Q
    out = np.empty(len(Q), np.int64); C = P[cand]
    for k in range(0, len(Q), 512):
        q = Q[k:k + 512]; dd = ((q[:, None, :] - C[None, :, :]) ** 2).sum(2); out[k:k + 512] = cand[dd.argmin(1)]
    return out
def agregar(b):
    while len(BIN) % 4: BIN.append(0)
    o = len(BIN); BIN.extend(b); return o
hechos = 0
for mi in mallas:
    m = d['ms'][mi]
    if len(m['sub']) != 1: continue   # (las de varias partes con varios materiales se dejan)
    m, P, raw, sk, I = leer(mi); T = I.reshape(-1, 3); nt = len(T)
    if nt < MIN_TRI or m.get('lods'): continue
    isl = islas(T, len(P)); ti = isl[T[:, 0]]
    # soldada por posición
    _, wid = np.unique(np.round(P / 1e-5).astype(np.int64), axis=0, return_inverse=True); wid = wid.reshape(-1)
    PW = np.zeros((wid.max() + 1, 3)); PW[wid] = P; TW = wid[T]; TW = TW[(TW[:, 0] != TW[:, 1]) & (TW[:, 1] != TW[:, 2]) & (TW[:, 0] != TW[:, 2])]
    UV = raw[:, 10:14].copy().view('<f2').astype(np.float64); NR = raw[:, 6:9].astype(np.int8).astype(np.float64) / 127
    A0, B0, C0 = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]; CEN = (A0 + B0 + C0) / 3
    porIsla = {}
    for k, g in enumerate(ti): porIsla.setdefault(g, []).append(k)
    porIsla = {g: np.array(v) for g, v in porIsla.items()}
    lods = []
    for f in NIVELES:
        sm = pyfqmr.Simplify(); sm.setMesh(PW, TW.astype(np.int32))
        sm.simplify_mesh(target_count=max(200, int(nt * f)), aggressiveness=7, preserve_border=True, verbose=False)
        V2, T2, _ = sm.getMesh(); T2 = T2.astype(np.int64)
        # la isla de cada triángulo nuevo: la del original más cercano (por los centros)
        c2 = V2[T2].mean(1); cerca = cercano(c2, CEN, np.arange(len(CEN))); g2 = ti[cerca]
        clave = {}; Vs, Us, Ns, Ss, To = [], [], [], [], np.zeros_like(T2)
        for j in range(len(T2)):
            g = g2[j]
            for c in range(3):
                v = T2[j, c]; kk = (v, g)
                if kk not in clave:
                    fs = porIsla[g]; q = V2[v]
                    fo = fs[((CEN[fs] - q) ** 2).sum(1).argmin()]
                    a, b, cc = T[fo]; pa, pb, pc = P[a], P[b], P[cc]
                    # baricéntricas del punto proyectado en el triángulo (recortadas adentro)
                    v0, v1, v2_ = pb - pa, pc - pa, q - pa; d00, d01, d11 = v0 @ v0, v0 @ v1, v1 @ v1; d20, d21 = v2_ @ v0, v2_ @ v1
                    den = d00 * d11 - d01 * d01
                    if abs(den) < 1e-18: wb = wc = 1 / 3
                    else: wb = (d11 * d20 - d01 * d21) / den; wc = (d00 * d21 - d01 * d20) / den
                    w = np.clip(np.array([1 - wb - wc, wb, wc]), 0, None); w = w / max(w.sum(), 1e-9)
                    tri = (a, b, cc)
                    uv = w[0] * UV[a] + w[1] * UV[b] + w[2] * UV[cc]; nr = w[0] * NR[a] + w[1] * NR[b] + w[2] * NR[cc]
                    clave[kk] = len(Vs); Vs.append(q); Us.append(uv); Ns.append(nr / max(np.linalg.norm(nr), 1e-9)); Ss.append(sk[tri[int(w.argmax())]])
                To[j, c] = clave[kk]
        V2 = np.array(Vs); n_ = len(V2)
        q = np.clip(np.round((V2 - np.array(m['mn'])) / np.maximum(np.array(m['sc']), 1e-12) * 65535), 0, 65535).astype('<u2')
        vb = np.zeros((n_, 14), np.uint8); vb[:, 0:6] = q.view(np.uint8).reshape(-1, 6)
        vb[:, 6:9] = np.clip(np.round(np.array(Ns) * 127), -127, 127).astype(np.int8).view(np.uint8).reshape(-1, 3)
        vb[:, 9] = raw[0, 9]; vb[:, 10:14] = np.array(Us).astype('<f2').view(np.uint8).reshape(-1, 4)
        i32 = n_ > 65535; ib = To.astype('<u4' if i32 else '<u2').tobytes()
        o_v = agregar(vb.tobytes()); o_s = agregar(np.array(Ss, np.uint8).tobytes()); o_i = agregar(ib)
        e = {k: v for k, v in m.items() if k not in ('o', 'v', 'i', 'i32', 'sub', 'sk', 'lods')}
        e.update({'n': m['n'] + '_LOD%d' % (len(lods) + 1), 'o': o_v, 'v': n_, 'i': o_i, 'i32': bool(i32), 'sub': [[0, len(To) * 3]], 'sk': o_s})
        d['ms'].append(e); lods.append(len(d['ms']) - 1)
    m['lods'] = lods; hechos += 1
    print(m['n'][:28].ljust(28), 'tri', nt, 'vért', m['v'], '→', [(sum(s[1] for s in d['ms'][l]['sub']) // 3, d['ms'][l]['v']) for l in lods], 'islas', len(np.unique(ti)))
# ---------------- archivos ----------------
if os.path.exists(PK1): shutil.rmtree(PK1)
shutil.copytree(PK0, PK1, copy_function=os.link, ignore=shutil.ignore_patterns('d.json.gz', 'm.bin.gz'))
open(PK1 + '/d.json.gz', 'wb').write(gzip.compress(json.dumps(d, separators=(',', ':')).encode(), 6))
open(PK1 + '/m.bin.gz', 'wb').write(gzip.compress(bytes(BIN), 9))
print('listo', hechos, 'mallas con LOD · bin', len(BIN))
