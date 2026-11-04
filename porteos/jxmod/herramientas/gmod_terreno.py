# El terreno de los mapas de GMod (los desplazamientos de Source: una grilla con alturas sobre una cara del mapa).
# Lo del terreno que queda adentro de un pincel sólido no se ve en Source (el piso lo tapa) y acá se saca: si no, se pisaba
# con el piso (parpadeo) y el jugador chocaba con los dos. Antes se tiraba el triángulo entero si su centro quedaba
# adentro, y los triángulos del pasto miden hasta 5 m: junto a las veredas de gm_construct quedaba una franja de hasta
# 0,9 m sin piso por la que se veía el cielo. Ahora cada triángulo se recorta contra los pinceles y queda lo de afuera.
# Lo usa gmod.py al convertir el mapa; solo, rehace el terreno de un mapa ya convertido dentro del paquete:
#   python-con-srctools -I gmod_terreno.py PAQUETE_ORIGEN PAQUETE_NUEVO archivo.bsp NOMBRE [x_cielo3d]
#   (PAQUETE_NUEVO: d.json.gz y m.bin.gz nuevos; lo demás se enlaza del de origen. x_cielo3d: las caras con x de Source
#   menor a eso son del cielo 3D, como en gmod.py: -6000 en gm_construct)
import sys, os, struct, math, numpy as np

S = 0.0254
MS = np.array([[0, 1, 0], [0, 0, 1], [1, 0, 0]], float)   # (x, y, z) de Source → (y, z, x) del juego, en metros
ARRIBA = np.array([0, 0, 1.0])
EPS = 0.05


class Solidos:
    """los pinceles sólidos del mapa (planos hacia afuera: adentro es N·x − D < 0 en todos) con su caja"""
    def __init__(self, bsp):
        self.B = []
        for br in bsp.brushes:
            if not (br.contents.value & 1): continue
            Nb = np.array([[x.plane.normal.x, x.plane.normal.y, x.plane.normal.z] for x in br.sides]); Db = np.array([x.plane.dist for x in br.sides])
            lo, hi = np.full(3, -1e9), np.full(3, 1e9)
            for n_, d_ in zip(Nb, Db):
                for ax in range(3):
                    if abs(n_[ax]) > 0.9999:
                        if n_[ax] > 0: hi[ax] = min(hi[ax], d_ / n_[ax])
                        else: lo[ax] = max(lo[ax], d_ / n_[ax])
            self.B.append((Nb, Db, lo, hi))
        self.lo, self.hi = np.array([x[2] for x in self.B]), np.array([x[3] for x in self.B])
    def adentro(self, p, eps=EPS):
        for k in np.nonzero(np.all((self.lo <= p + eps) & (p - eps <= self.hi), 1))[0]:
            if np.all(self.B[k][0] @ p - self.B[k][1] < -eps): return True
        return False
    def cerca(self, lo, hi, eps=EPS):
        return np.nonzero(np.all((self.lo <= hi + eps) & (lo - eps <= self.hi), 1))[0]


def _partir(poli, n, t):
    """un polígono convexo (puntos con sus coordenadas baricéntricas) en lo de adelante (n·x ≥ t) y lo de atrás"""
    ad, at = [], []
    m = len(poli)
    for k in range(m):
        (p, b), (q, c) = poli[k], poli[(k + 1) % m]
        sp, sq = p @ n - t, q @ n - t
        (ad if sp >= 0 else at).append((p, b))
        if (sp >= 0) != (sq >= 0):
            u = sp / (sp - sq); x = (p + (q - p) * u, b + (c - b) * u); ad.append(x); at.append(x)
    return (ad if len(ad) >= 3 else None), (at if len(at) >= 3 else None)


def recortar(tri, sol):
    """lo de un triángulo (3 puntos de Source) que queda fuera de los sólidos, probado una unidad más arriba como antes:
    polígonos convexos de (punto, baricéntricas)"""
    piezas = [[(tri[k], np.eye(3)[k]) for k in range(3)]]
    lo, hi = tri.min(0) + ARRIBA, tri.max(0) + ARRIBA
    for k in sol.cerca(lo, hi):
        Nb, Db = sol.B[k][0], sol.B[k][1]
        nuevas = []
        for pz in piezas:
            resto = pz
            for n, dd in zip(Nb, Db):
                # (adentro es n·(x + arriba) − D < −EPS: lo de afuera de este plano, n·x ≥ D − n·arriba − EPS, se queda)
                ad, resto = _partir(resto, n, dd - n @ ARRIBA - EPS)
                if ad: nuevas.append(ad)
                if not resto: break
            # (lo que queda en "resto" está adentro del pincel: fuera)
        piezas = nuevas
        if not piezas: break
    return piezas


def orientar(tri, V, n):
    a, b, c = tri
    return (a, b, c) if np.dot(np.cross(V[b] - V[a], V[c] - V[a]), n) >= 0 else (a, c, b)


def desplazamiento(f, k, DI, DV, vs):
    """la grilla de un desplazamiento: puntos con altura (G), sobre el plano (Gp, para las UV) y la mezcla (al)"""
    sx, sy, sz, vstart, _, pw = struct.unpack_from('<3f3i', DI, k * 176)
    n = (1 << pw) + 1; i0 = int(np.argmin(np.linalg.norm(vs - np.array([sx, sy, sz]), axis=1))); p = [vs[(i0 + j) % 4] for j in range(4)]
    dv = DV[vstart:vstart + n * n]; G = np.zeros((n, n, 3)); Gp = np.zeros((n, n, 3))
    for i in range(n):
        e0 = p[0] + (p[1] - p[0]) * i / (n - 1); e1 = p[3] + (p[2] - p[3]) * i / (n - 1)
        for j in range(n):
            plano = e0 + (e1 - e0) * j / (n - 1); Gp[i, j] = plano; G[i, j] = plano + dv[i * n + j, :3] * dv[i * n + j, 3]
    return n, G.reshape(-1, 3), Gp.reshape(-1, 3), dv[:, 4] / 255.0


def armar(lista, sol, stats=None):
    """el terreno: lista de desplazamientos (mi, n, G, Gp, al, uvf, n_src) → {mi: (V, N, U, A, T)} en coordenadas del juego.
    Normales suaves (soldadas entre parches por posición), UV corridas a enteros por bloques de 4×4 celdas."""
    stats = stats if stats is not None else {}
    grillas = []
    for (mi, n, G, Gp, al, uvf, nsrc) in lista:
        T, partes = [], []
        for i in range(n - 1):
            for j in range(n - 1):
                a_, b_, c_, e_ = i * n + j, (i + 1) * n + j, (i + 1) * n + j + 1, i * n + j + 1
                for t in ([(a_, b_, c_), (a_, c_, e_)] if (i + j) % 2 == 0 else [(a_, b_, e_), (b_, c_, e_)]):
                    if not sol.adentro(G[list(t)].mean(0) + ARRIBA): T.append(t); continue
                    # (tapado por un sólido: se recorta y queda lo de afuera)
                    stats['tapados'] = stats.get('tapados', 0) + 1
                    for pz in ([] if os.environ.get('SIN_RECORTE') else recortar(G[list(t)], sol)):
                        partes.append((t, [b for _, b in pz])); stats['piezas'] = stats.get('piezas', 0) + 1
        grillas.append((T, partes))
    # normales: de todos los triángulos de la grilla (también los tapados: si no, un vértice que sólo tocaba triángulos
    # tapados quedaba sin normal), sumadas entre parches por posición
    clave_de = lambda v: tuple(np.round(v, 1)); acum = {}
    for (mi, n, G, Gp, al, uvf, nsrc) in lista:
        for i in range(n - 1):
            for j in range(n - 1):
                a_, b_, c_, e_ = i * n + j, (i + 1) * n + j, (i + 1) * n + j + 1, i * n + j + 1
                for t in ([(a_, b_, c_), (a_, c_, e_)] if (i + j) % 2 == 0 else [(a_, b_, e_), (b_, c_, e_)]):
                    cr = np.cross(G[t[1]] - G[t[0]], G[t[2]] - G[t[0]])
                    if cr @ nsrc < 0: cr = -cr
                    for x in t: kk = clave_de(G[x]); acum[kk] = acum.get(kk, 0) + cr
    out = {}
    for (mi, n, G, Gp, al, uvf, nsrc), (T, partes) in zip(lista, grillas):
        V0, N0, U0, A0, T0 = out.setdefault(mi, ([], [], [], [], []))
        Nn = np.array([acum[clave_de(v)] for v in G]); Nn /= np.maximum(np.linalg.norm(Nn, axis=1, keepdims=True), 1e-9)
        Ug = uvf(Gp); ng = MS @ nsrc
        bloque = lambda t: (min(x // n for x in t) // 4, min(x % n for x in t) // 4)
        porB = {}
        for t in T: porB.setdefault(bloque(t), ([], []))[0].append(t)
        for t, piezas in partes: porB.setdefault(bloque(t), ([], []))[1].append((t, piezas))
        for (bi, bj), (Tb, Pb) in sorted(porB.items()):
            bi *= 4; bj *= 4
            ids = [i * n + j for i in range(bi, min(bi + 5, n)) for j in range(bj, min(bj + 5, n))]; loc = {g: l for l, g in enumerate(ids)}
            V = [G[g] for g in ids]; Nv = [Nn[g] for g in ids]; U = [Ug[g] for g in ids]; A = [al[g] for g in ids]; Tl = []
            for t in Tb: Tl.append((loc[t[0]], loc[t[1]], loc[t[2]]))
            for t, pz in Pb:
                base = len(V)
                for b in pz:
                    V.append(b @ G[list(t)]); nv = b @ Nn[list(t)]; Nv.append(nv / max(np.linalg.norm(nv), 1e-9))
                    U.append(uvf((b @ Gp[list(t)])[None])[0]); A.append(float(b @ al[list(t)]))
                for k in range(1, len(pz) - 1): Tl.append((base, base + k, base + k + 1))
            V = np.array(V); U = np.array(U); U = U - np.floor(U.min(0))
            Vg = (MS @ (V * S).T).T; Ng = (MS @ np.array(Nv).T).T
            # (sin triángulos sin área: los recortes dejan astillas)
            Tl = [orientar(t, Vg, ng) for t in Tl if np.linalg.norm(np.cross(Vg[t[1]] - Vg[t[0]], Vg[t[2]] - Vg[t[0]])) > 1e-7]
            o = len(V0); V0.extend(Vg); N0.extend(Ng); U0.extend(U); A0.extend(A); T0.extend([(a + o, b + o, c + o) for a, b, c in Tl])
    return out


def caras_desplazamiento(bsp, en_cielo3d=lambda c: False):
    """las caras del mundo con desplazamiento: (cara, índice de su dispinfo, vértices, normal de Source)"""
    from srctools.bsp import BSP_LUMPS as LUMP
    raw = bsp.lumps[LUMP.FACES].data; disp_de = [struct.unpack_from('<h', raw, i * 56 + 12)[0] for i in range(len(raw) // 56)]
    idx_cara = {id(f): i for i, f in enumerate(bsp.faces)}
    mundo = next(bm for e, bm in bsp.bmodels.items() if e['classname'] == 'worldspawn')
    for f in mundo.faces:
        ti = f.texinfo
        if ti is None: continue
        vs = np.array([[e.a.x, e.a.y, e.a.z] for e in f.edges])
        if len(vs) < 3 or en_cielo3d(vs.mean(0)): continue
        k = disp_de[idx_cara[id(f)]]
        if k < 0: continue
        yield f, k, vs, np.array([f.plane.normal.x, f.plane.normal.y, f.plane.normal.z])


def uv_de(ti):
    tw, th = ti.tex_size; tw, th = tw or 512, th or 512
    so, to = np.array([ti.s_off.x, ti.s_off.y, ti.s_off.z]), np.array([ti.t_off.x, ti.t_off.y, ti.t_off.z])
    return lambda pts: np.stack([(pts @ so + ti.s_shift) / tw, -(pts @ to + ti.t_shift) / th], 1)


if __name__ == '__main__':
    import json, gzip
    import srctools.bsp as BSPm
    from srctools.bsp import BSP_LUMPS as LUMP
    PK0, PK1, ARCH, NOM = sys.argv[1:5]; XC = float(sys.argv[5]) if len(sys.argv) > 5 else None
    d = json.load(gzip.open(PK0 + '/d.json.gz')); BIN = bytearray(gzip.decompress(open(PK0 + '/m.bin.gz', 'rb').read()))
    nodo = next(x for arb in d['esc'][NOM] for x in arb if x['n'] == NOM + '_Terreno')
    mats = {d['mt'][i]['n']: i for i in nodo['mt']}
    bsp = BSPm.BSP(ARCH); sol = Solidos(bsp)
    DI = bsp.lumps[LUMP.DISPINFO].data; DV = np.frombuffer(bsp.lumps[LUMP.DISP_VERTS].data, '<f4').reshape(-1, 5)
    lista, sin = [], set()
    for f, k, vs, nsrc in caras_desplazamiento(bsp, (lambda c: c[0] < XC) if XC is not None else (lambda c: False)):
        nom = 'GM_' + f.texinfo.mat.lower().split('/')[-1]
        mi = mats.get(nom)
        if mi is None: sin.add(nom); continue
        n, G, Gp, al = desplazamiento(f, k, DI, DV, vs)
        if not d['mt'][mi].get('t2'): al = np.zeros_like(al)
        lista.append((mi, n, G, Gp, al, uv_de(f.texinfo), nsrc))
    st = {}; T = armar(lista, sol, st)
    # la malla nueva (mismo formato que malla_bin de gmod.py), en el lugar de la vieja
    V = np.concatenate([np.array(T[mi][0]) for mi in nodo['mt'] if mi in T]); mn = V.min(0); sc = np.maximum(V.max(0) - mn, 1e-6)
    Vs, Ns, Us, As, idx, sub = [], [], [], [], [], []
    for mi in nodo['mt']:
        if mi not in T: sub.append([len(idx), 0]); continue
        V_, N_, U_, A_, T_ = T[mi]; o = len(Vs)
        Vs += V_; Ns += N_; Us += list(U_); As += A_; sub.append([len(idx), len(T_) * 3]); idx += [x + o for t in T_ for x in t]
    Vs = np.array(Vs); q = np.ascontiguousarray(np.round((Vs - mn) / sc * 65535).astype('<u2'))
    nb = np.ascontiguousarray(np.clip(np.round(np.array(Ns) * 127), -127, 127).astype(np.int8)); uv = np.ascontiguousarray(np.array(Us).astype('<f2'))
    vb = np.zeros((len(Vs), 14), np.uint8); vb[:, 0:6] = q.view(np.uint8).reshape(-1, 6); vb[:, 6:9] = nb.view(np.uint8).reshape(-1, 3); vb[:, 10:14] = uv.view(np.uint8).reshape(-1, 4)
    vb[:, 9] = np.clip(np.round(np.array(As) * 127), 0, 127).astype(np.uint8)
    def agregar(b):
        while len(BIN) % 4: BIN.append(0)
        o = len(BIN); BIN.extend(b); return o
    i32 = len(Vs) > 65535
    m = d['ms'][nodo['m']]; viejo = (m['v'], sum(s[1] for s in m['sub']) // 3)
    # (lo viejo, en ceros: no ocupa lugar en el paquete comprimido)
    BIN[m['o']:m['o'] + m['v'] * 14] = bytes(m['v'] * 14); ni = max(s[0] + s[1] for s in m['sub']) * (4 if m.get('i32') else 2); BIN[m['i']:m['i'] + ni] = bytes(ni)
    m.update({'o': agregar(vb.tobytes()), 'v': len(Vs), 'mn': mn.tolist(), 'sc': sc.tolist(), 'i': agregar(np.array(idx, '<u4' if i32 else '<u2').tobytes()), 'i32': bool(i32), 'sub': sub})
    os.makedirs(PK1, exist_ok=True)
    for f in os.listdir(PK0):
        src, dst = os.path.join(PK0, f), os.path.join(PK1, f)
        if f in ('d.json.gz', 'm.bin.gz') or os.path.exists(dst): continue
        if os.path.isdir(src):
            os.makedirs(dst, exist_ok=True)
            for g in os.listdir(src): os.link(os.path.join(src, g), os.path.join(dst, g))
        else: os.link(src, dst)
    json.dump(d, gzip.open(PK1 + '/d.json.gz', 'wt'), separators=(',', ':'))
    open(PK1 + '/m.bin.gz', 'wb').write(gzip.compress(bytes(BIN), 6))
    print(NOM, 'terreno: antes', viejo[0], 'vértices', viejo[1], 'triángulos; ahora', len(Vs), 'y', len(idx) // 3,
          '· tapados', st.get('tapados', 0), '→ piezas que quedan afuera', st.get('piezas', 0), '· sin material', sorted(sin))
