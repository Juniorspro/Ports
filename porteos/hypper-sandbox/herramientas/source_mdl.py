# Lector de modelos de Source (Garry's Mod / SFM): .mdl (huesos, texturas, cuerpos, secuencias y animaciones),
# .vvd (vértices con pesos) y .vtx (triángulos). Devuelve todo en el espacio de Source (Z arriba, pulgadas).
# Las animaciones se decodifican como el motor: cuaterniones crudos (48/64 bits), ángulos y posiciones comprimidos
# con RLE por hueso y por cuadro, en secciones; lo que no está animado queda en la pose de referencia.
import struct, numpy as np

def _cstr(b, o):
    e = b.index(b'\0', o)
    return b[o:e].decode('latin-1')
def _f16(u):
    return float(np.frombuffer(struct.pack('<H', u), np.float16)[0])
def angle_quat(x, y, z):
    """RadianEuler (x roll, y pitch, z yaw) → cuaternión (x, y, z, w), como AngleQuaternion de Source"""
    sr, cr = np.sin(x * 0.5), np.cos(x * 0.5); sp, cp = np.sin(y * 0.5), np.cos(y * 0.5); sy, cy = np.sin(z * 0.5), np.cos(z * 0.5)
    srcp, crsp = sr * cp, cr * sp; crcp, srsp = cr * cp, sr * sp
    return np.array([srcp * cy - crsp * sy, crsp * cy + srcp * sy, crcp * sy - srsp * cy, crcp * cy + srsp * sy])
def q2m(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
def m2q(m):
    t = m[0, 0] + m[1, 1] + m[2, 2]
    if t > 0:
        s = np.sqrt(t + 1) * 2; return np.array([(m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s, 0.25 * s])
    if m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = np.sqrt(1 + m[0, 0] - m[1, 1] - m[2, 2]) * 2; return np.array([0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s, (m[2, 1] - m[1, 2]) / s])
    if m[1, 1] > m[2, 2]:
        s = np.sqrt(1 + m[1, 1] - m[0, 0] - m[2, 2]) * 2; return np.array([(m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s, (m[0, 2] - m[2, 0]) / s])
    s = np.sqrt(1 + m[2, 2] - m[0, 0] - m[1, 1]) * 2; return np.array([(m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s, (m[1, 0] - m[0, 1]) / s])

class Modelo:
    def __init__(self, mdl, vvd=None, vtx=None):
        self.b = b = mdl
        assert b[:4] == b'IDST', 'no es un .mdl'
        self.version = struct.unpack_from('<i', b, 4)[0]
        self.nombre = b[12:76].split(b'\0')[0].decode('latin-1')
        self.hull = (np.array(struct.unpack_from('<3f', b, 104)), np.array(struct.unpack_from('<3f', b, 116)))
        nb, bi = struct.unpack_from('<2i', b, 156)
        nan, ani, nseq, sqi = struct.unpack_from('<4i', b, 180)
        ntex, txi, ncd, cdi, nsr, nsf, ski, nbp, bpi = struct.unpack_from('<9i', b, 204)
        # huesos
        self.huesos = []
        for k in range(nb):
            o = bi + k * 216
            nom = _cstr(b, o + struct.unpack_from('<i', b, o)[0]); pa = struct.unpack_from('<i', b, o + 4)[0]
            pos = np.array(struct.unpack_from('<3f', b, o + 32)); q = np.array(struct.unpack_from('<4f', b, o + 44))
            rot = np.array(struct.unpack_from('<3f', b, o + 60)); ps = np.array(struct.unpack_from('<3f', b, o + 72)); rs = np.array(struct.unpack_from('<3f', b, o + 84))
            p2b = np.array(struct.unpack_from('<12f', b, o + 96)).reshape(3, 4)
            self.huesos.append(dict(n=nom, pa=pa, pos=pos, q=q, rot=rot, ps=ps, rs=rs, p2b=p2b))
        # texturas, carpetas y pieles
        self.texturas = [_cstr(b, txi + k * 64 + struct.unpack_from('<i', b, txi + k * 64)[0]) for k in range(ntex)]
        self.carpetas = [_cstr(b, struct.unpack_from('<i', b, cdi + k * 4)[0]) for k in range(ncd)]
        self.pieles = [list(struct.unpack_from('<%dh' % nsr, b, ski + f * nsr * 2)) for f in range(nsf)] if nsr else [[]]
        # puntos de enganche (la boca del arma, la mano...): nombre, hueso y su matriz 3×4 respecto del hueso
        nat, ati = struct.unpack_from('<2i', b, 240); self.adjuntos = []
        for k in range(nat):
            o = ati + k * 92
            self.adjuntos.append(dict(n=_cstr(b, o + struct.unpack_from('<i', b, o)[0]), hueso=struct.unpack_from('<i', b, o + 8)[0],
                                      m=np.array(struct.unpack_from('<12f', b, o + 12)).reshape(3, 4)))
        # cuerpos → modelos → mallas
        self.cuerpos = []
        for k in range(nbp):
            o = bpi + k * 16; nn, nm, base, mi = struct.unpack_from('<4i', b, o)
            mods = []
            for j in range(nm):
                mo = o + mi + j * 148
                nme, nmi, nv, vi = struct.unpack_from('<4i', b, mo + 72)
                mallas = []
                for t in range(nme):
                    me = mo + nmi + t * 116
                    mat, _, mnv, voff = struct.unpack_from('<4i', b, me)
                    mallas.append(dict(mat=mat, nv=mnv, voff=voff))
                mods.append(dict(n=b[mo:mo + 64].split(b'\0')[0].decode('latin-1'), nv=nv, vi=vi // 48, mallas=mallas))
            self.cuerpos.append(dict(n=_cstr(b, o + nn), modelos=mods))
        # animaciones y secuencias
        self.anims = []
        for k in range(nan):
            o = ani + k * 100
            nom = _cstr(b, o + struct.unpack_from('<i', b, o + 4)[0]); fps, fl, nf = struct.unpack_from('<fii', b, o + 8)
            ablk, aidx = struct.unpack_from('<2i', b, o + 52); sidx, sfr = struct.unpack_from('<2i', b, o + 80)
            self.anims.append(dict(n=nom, o=o, fps=fps, flags=fl, nf=nf, bloque=ablk, idx=aidx, sidx=sidx, sfr=sfr))
        self.secuencias = []
        for k in range(nseq):
            o = sqi + k * 212
            lab = _cstr(b, o + struct.unpack_from('<i', b, o + 4)[0]); act = _cstr(b, o + struct.unpack_from('<i', b, o + 8)[0])
            fl = struct.unpack_from('<i', b, o + 12)[0]; aii = struct.unpack_from('<i', b, o + 60)[0]; gs = struct.unpack_from('<2i', b, o + 68)
            anim = struct.unpack_from('<h', b, o + aii)[0]
            self.secuencias.append(dict(n=lab, act=act, flags=fl, anim=anim, grupos=gs, loop=bool(fl & 1)))
        self.vertices = self.mallas = None
        if vvd is not None and vtx is not None: self._geometria(vvd, vtx)

    # ---------------- geometría ----------------
    def _geometria(self, vvd, vtx):
        assert vvd[:4] == b'IDSV'
        nl = struct.unpack_from('<i', vvd, 12)[0]; nlv = struct.unpack_from('<8i', vvd, 16); nfx, fxs, vds, tgs = struct.unpack_from('<4i', vvd, 48)
        n0 = nlv[0]
        V = np.frombuffer(vvd, np.uint8, count=n0 * 48, offset=vds).reshape(-1, 48)
        if nfx:   # (con la tabla de arreglos el orden del LOD 0 sale de ahí)
            idx = []
            for k in range(nfx):
                lod, src, num = struct.unpack_from('<3i', vvd, fxs + k * 12)
                if lod >= 0: idx.extend(range(src, src + num))
            V = V[np.array(idx)]
        V = V[:n0]
        w = V[:, 0:12].copy().view('<f4').reshape(-1, 3); bn = V[:, 12:15].copy(); nbn = V[:, 15].copy()
        pos = V[:, 16:28].copy().view('<f4').reshape(-1, 3); nor = V[:, 28:40].copy().view('<f4').reshape(-1, 3); uv = V[:, 40:48].copy().view('<f4').reshape(-1, 2)
        for c in range(3): w[nbn <= c, c] = 0
        self.vertices = dict(pos=pos.astype(np.float64), nor=nor.astype(np.float64), uv=uv.astype(np.float64), w=w.astype(np.float64), hb=bn.astype(np.int64))
        # vtx: cuerpos → modelos → lod 0 → mallas → grupos de tiras (los índices de cada grupo, como lista de triángulos)
        ver, = struct.unpack_from('<i', vtx, 0); nbp, bpo = struct.unpack_from('<2i', vtx, 28)
        self.mallas = []
        for tam in (25, 33):   # (los compilados para v49 traen 8 bytes más por grupo)
            try: self.mallas = self._vtx(vtx, nbp, bpo, tam); break
            except (AssertionError, ValueError, IndexError, struct.error): self.mallas = []
        assert self.mallas, 'vtx ilegible'
    def _vtx(self, vtx, nbp, bpo, tam):
        out = []
        for k in range(nbp):
            o = bpo + k * 8; nm, mo = struct.unpack_from('<2i', vtx, o)
            for j in range(nm):
                om = o + mo + j * 8; nlod, lo = struct.unpack_from('<2i', vtx, om)
                ol = om + lo; nme, meo = struct.unpack_from('<2i', vtx, ol)
                mod = self.cuerpos[k]['modelos'][j]
                for t in range(nme):
                    ome = ol + meo + t * 9; nsg, sgo = struct.unpack_from('<2i', vtx, ome)
                    mm = mod['mallas'][t]; tris = []
                    for g in range(nsg):
                        og = ome + sgo + g * tam; nv, vo, ni, io = struct.unpack_from('<4i', vtx, og)
                        vv = np.frombuffer(vtx, np.uint8, count=nv * 9, offset=og + vo).reshape(-1, 9)
                        orig = vv[:, 4:6].copy().view('<u2').reshape(-1).astype(np.int64)
                        ii = np.frombuffer(vtx, '<u2', count=ni, offset=og + io).astype(np.int64)
                        assert ni % 3 == 0 and (ii.max(initial=0) < nv if ni else True), 'grupo raro'
                        base = mod['vi'] + mm['voff']
                        tris.append((orig[ii] + base).reshape(-1, 3))
                    T = np.concatenate(tris) if tris else np.zeros((0, 3), np.int64)
                    assert T.size == 0 or T.max() < len(self.vertices['pos']), 'índice fuera'
                    out.append(dict(cuerpo=k, modelo=j, mat=mm['mat'], tris=T))
        return out

    # ---------------- animación ----------------
    def _valor(self, o, frame, escala):
        b = self.b; k = frame
        while True:
            valid, total = b[o], b[o + 1]
            if total == 0: return 0.0
            if total > k: break
            k -= total; o += (valid + 1) * 2
        if valid > k: return struct.unpack_from('<h', b, o + (k + 1) * 2)[0] * escala
        return struct.unpack_from('<h', b, o + valid * 2)[0] * escala
    def pose(self, ia, frame):
        """(pos, quat) locales de cada hueso en el cuadro entero `frame` de la animación ia"""
        A = self.anims[ia]; b = self.b; H = self.huesos
        P = [h['pos'].copy() for h in H]; Q = [h['q'].copy() for h in H]
        if A['bloque'] != 0: return P, Q, False   # (en un .ani aparte)
        delta = bool(A['flags'] & 4)
        if delta: P = [np.zeros(3) for h in H]; Q = [np.array([0, 0, 0, 1.0]) for h in H]
        f = frame
        if A['sfr']:
            s = f // A['sfr']
            ablk, aidx = struct.unpack_from('<2i', b, A['o'] + A['sidx'] + s * 8); f = f - s * A['sfr']
            o = A['o'] + aidx
        else: o = A['o'] + A['idx']
        while True:
            hb, fl, nxt = struct.unpack_from('<BBh', b, o); h = H[hb]; d = o + 4
            if fl & 0x02:   # RAWROT: cuaternión de 48 bits
                x, y, zw = struct.unpack_from('<3H', b, d); z = zw & 0x7fff; wn = zw >> 15
                qx, qy, qz = (x - 32768) / 32768.0, (y - 32768) / 32768.0, (z - 16384) / 16384.0
                qw = np.sqrt(max(0.0, 1 - qx * qx - qy * qy - qz * qz)) * (-1 if wn else 1); Q[hb] = np.array([qx, qy, qz, qw]); d += 6
            elif fl & 0x20:   # RAWROT2: de 64 bits
                v, = struct.unpack_from('<Q', b, d)
                qx = ((v & 0x1fffff) - 1048576) / 1048576.5; qy = (((v >> 21) & 0x1fffff) - 1048576) / 1048576.5; qz = (((v >> 42) & 0x1fffff) - 1048576) / 1048576.5
                qw = np.sqrt(max(0.0, 1 - qx * qx - qy * qy - qz * qz)) * (-1 if v >> 63 else 1); Q[hb] = np.array([qx, qy, qz, qw]); d += 8
            elif fl & 0x08:   # ANIMROT: ángulos comprimidos
                offs = struct.unpack_from('<3h', b, d)
                ang = np.array([self._valor(d + offs[i], f, h['rs'][i]) if offs[i] else 0.0 for i in range(3)])
                if not delta: ang = ang + h['rot']
                Q[hb] = angle_quat(*ang); d += 6
            if fl & 0x01:   # RAWPOS
                P[hb] = np.array([_f16(x) for x in struct.unpack_from('<3H', b, d)])
            elif fl & 0x04:   # ANIMPOS
                offs = struct.unpack_from('<3h', b, d)
                pp = np.array([self._valor(d + offs[i], f, h['ps'][i]) if offs[i] else 0.0 for i in range(3)])
                P[hb] = pp if delta else pp + h['pos']
            if nxt == 0: break
            o += nxt
        return P, Q, True
    def mundo(self, P, Q):
        """matrices 4x4 del mundo (del modelo) de cada hueso"""
        W = []
        for k, h in enumerate(self.huesos):
            M = np.eye(4); M[:3, :3] = q2m(Q[k]); M[:3, 3] = P[k]
            W.append(W[h['pa']] @ M if h['pa'] >= 0 else M)
        return W
