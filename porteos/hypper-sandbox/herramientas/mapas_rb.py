# Mapas propios de RezoBox (reemplazan a los del juego en la lista): Llanura, Colinas, Isla, Ciudad, Desierto y Luna.
# Todo hecho acá: las texturas (ruido fractal que se repite sin cortes, ondas de arena, ventanas, líneas de la calle),
# el terreno (una grilla con relieve; cada triángulo toma pasto, arena, tierra o roca según su altura y su pendiente), el
# agua, las calles con veredas, los edificios (cajas con fachada por piso, en una sola malla por material y con cajas de
# choque), y los props nuevos del paquete puestos en el mapa (palmeras, rocas, faroles, semáforos, bancos, camas
# elásticas, aros...). Cada mapa lleva su cielo, su niebla, su luz, su gravedad y sus puntos de aparición.
# Las texturas base pueden venir de imágenes generadas (carpeta TEXTURAS: pasto.png, arena.png, ...): se vuelven sin costura
# (se repiten sin que se note el corte), se llevan al color de cada mapa y encima se dibujan exactas las líneas de la
# calle, las juntas de la vereda y las ventanas. Las que falten se hacen con ruido.
# Uso: python3 -I mapas_rb.py PAQUETE_ORIGEN PAQUETE_NUEVO [TEXTURAS]
import sys, os, json, gzip, math, numpy as np
from PIL import Image
PK0, PK1 = sys.argv[1:3]; TEXIA = sys.argv[3] if len(sys.argv) > 3 else None
os.makedirs(PK1, exist_ok=True)
for sub in ('t', 'i', 'a', 'fondos'):
    os.makedirs(os.path.join(PK1, sub), exist_ok=True)
    for f in os.listdir(os.path.join(PK0, sub)):
        dst = os.path.join(PK1, sub, f)
        if not os.path.exists(dst): os.link(os.path.join(PK0, sub, f), dst)
d = json.load(gzip.open(PK0 + '/d.json.gz')); BIN = bytearray(gzip.decompress(open(PK0 + '/m.bin.gz', 'rb').read()))
def agregar(b):
    while len(BIN) % 4: BIN.append(0)
    o = len(BIN); BIN.extend(b); return o

# ---------------- texturas ----------------
def ruido(n, beta, semilla):
    """ruido fractal que se repite (filtrado en frecuencia), de 0 a 1"""
    r = np.random.default_rng(semilla).standard_normal((n, n)); F = np.fft.fft2(r)
    ky, kx = np.fft.fftfreq(n)[:, None], np.fft.fftfreq(n)[None, :]; k = np.sqrt(kx * kx + ky * ky); k[0, 0] = 1
    x = np.real(np.fft.ifft2(F / k ** beta)); return (x - x.min()) / (x.max() - x.min())
def mezcla(v, c0, c1): v = np.clip(v, 0, 1)[..., None]; return np.array(c0, float) * (1 - v) + np.array(c1, float) * v
def textura(nom, img, lado=512):
    ti = len(d['tx']); d['tx'].append({'n': 'RB_' + nom, 'a': 0, 'w': lado, 'h': lado})
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((lado, lado), Image.LANCZOS).save(PK1 + '/t/%d.webp' % ti, 'WEBP', quality=88, method=6)
    return ti
N = 512
yy, xx = np.mgrid[0:N, 0:N] / N
def sin_costura(a):
    """mezcla la imagen con ella misma corrida media vuelta: en los bordes queda la del medio (que no corta); se conserva el
    contraste en la zona mezclada"""
    n = a.shape[0]; b = np.roll(np.roll(a, n // 2, 0), n // 2, 1)
    w1 = np.sin(np.pi * np.arange(n) / n) ** 2; w = np.outer(w1, w1)[..., None]; m = a.reshape(-1, 3).mean(0)
    return ((a - m) * w + (b - m) * (1 - w)) / np.sqrt(w * w + (1 - w) ** 2) + m
def ia(nombre, color=None, lado=N):
    """la textura generada (sin costura, del tamaño pedido y llevada al color medio pedido) o None"""
    f = TEXIA and os.path.join(TEXIA, nombre + '.png')
    if not f or not os.path.exists(f): return None
    im = Image.open(f).convert('RGB'); c = min(im.size); im = im.crop(((im.width - c) // 2, (im.height - c) // 2, (im.width + c) // 2, (im.height + c) // 2)).resize((lado, lado), Image.LANCZOS)
    a = sin_costura(np.asarray(im).astype(float))
    if color is not None: a = a * (np.array(color, float) / np.maximum(a.reshape(-1, 3).mean(0), 1))
    return np.clip(a, 0, 255)
def tex_pasto():
    g = ia('pasto', (78, 120, 50))
    if g is not None: return g
    # (poca variación grande: de lejos la repetición no se nota como cuadros; el detalle va en lo chico)
    a, b, c = ruido(N, 1.7, 1), ruido(N, 1.0, 2), ruido(N, 0.2, 3)
    img = mezcla(0.5 + (a - 0.5) * 0.35 + (b - 0.5) * 0.45, (64, 112, 40), (98, 146, 54)) * (0.84 + 0.32 * c[..., None])
    return img
def tex_arena():
    g = ia('arena', (196, 160, 108))
    if g is not None: return g
    a, b, c = ruido(N, 1.6, 4), ruido(N, 1.2, 5), ruido(N, 0.1, 6)
    ondas = 0.5 + 0.5 * np.sin((xx * 22 + b * 2.2) * 2 * np.pi)
    return mezcla(0.5 + (a - 0.5) * 0.4 + (ondas - 0.5) * 0.35 + (c - 0.5) * 0.4, (168, 128, 80), (206, 168, 112))
def tex_roca():
    g = ia('roca', (128, 120, 110))
    if g is not None: return g
    a, b, c = ruido(N, 1.8, 7), ruido(N, 1.1, 8), ruido(N, 0.3, 9)
    grietas = 1 - np.clip(np.abs(b - 0.5) * 9, 0, 1)
    return mezcla(a * 0.7 + c * 0.3, (92, 86, 80), (156, 148, 136)) * (1 - 0.35 * grietas[..., None])
def tex_tierra():
    g = ia('tierra', (124, 96, 66))
    if g is not None: return g
    a, c = ruido(N, 1.7, 10), ruido(N, 0.2, 11)
    return mezcla(a * 0.75 + c * 0.25, (102, 76, 50), (150, 116, 80))
def tex_luna():
    g = ia('luna', (112, 112, 110))
    if g is not None: return g
    a, c = ruido(N, 1.9, 12), ruido(N, 0.2, 13)
    img = mezcla(a * 0.7 + c * 0.3, (96, 96, 98), (168, 167, 162))
    rng = np.random.default_rng(14)
    for _ in range(26):  # cráteres chicos (con su borde claro), repetidos en los bordes
        cx, cy, r = rng.random(), rng.random(), rng.uniform(0.015, 0.07)
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                dd = np.sqrt((xx - cx - ox) ** 2 + (yy - cy - oy) ** 2) / r
                img *= (1 - 0.22 * np.clip(1 - dd, 0, 1) + 0.16 * np.exp(-((dd - 1) / 0.18) ** 2))[..., None]
    return img
def tex_asfalto():
    g = ia('asfalto', (62, 64, 68))
    if g is not None: return g
    a, c = ruido(N, 1.2, 15), ruido(N, 0.05, 16)
    return mezcla(a * 0.5 + c * 0.5, (44, 46, 50), (74, 76, 80))
def tex_calle():
    img = tex_asfalto(); u, v = xx, yy  # (u: de vereda a vereda; v: a lo largo, una baldosa = 12 m)
    for e in (0.07, 0.93): img[np.abs(u - e) < 0.012] = (232, 232, 226)
    raya = (np.abs(u - 0.5) < 0.011) & ((v * 3) % 1 < 0.55)
    img[raya] = (236, 190, 40)
    return img
def tex_vereda():
    a, c = ruido(N, 1.0, 17), ruido(N, 0.1, 18)
    g = ia('hormigon', (172, 170, 164)); img = g.copy() if g is not None else mezcla(a * 0.4 + c * 0.6, (150, 148, 142), (190, 188, 182))
    junta = (np.minimum(xx * 4 % 1, 1 - xx * 4 % 1) < 0.012) | (np.minimum(yy * 4 % 1, 1 - yy * 4 % 1) < 0.012)
    img[junta] *= 0.62
    return img
def tex_agua():
    g = ia('agua', (34, 104, 130))
    if g is not None: return g
    a, b = ruido(N, 1.9, 19), ruido(N, 0.9, 20)
    return mezcla(a * 0.6 + b * 0.4, (18, 70, 104), (46, 124, 152))
def tex_fachada(pared, vidrio, marco, semilla, base=None):
    """una ventana por baldosa (un tramo de un piso), con su marco y un reflejo; la pared, generada si hay"""
    n = 256; y, x = np.mgrid[0:n, 0:n] / n; a = ruido(n, 1.3, semilla)
    g = (np.tile(ia(base, pared, n // 2), (2, 2, 1)) if base == 'ladrillo' and ia(base) is not None else ia(base, pared, n)) if base else None  # (ladrillos de tamaño real)
    img = g.copy() if g is not None else mezcla(a, np.array(pared) * 0.88, np.array(pared) * 1.08)
    v = (x > 0.16) & (x < 0.84) & (y > 0.22) & (y < 0.86)
    m = (x > 0.12) & (x < 0.88) & (y > 0.18) & (y < 0.9) & ~v
    img[m] = marco
    refl = mezcla(np.clip((x + (1 - y)) * 0.7 - 0.3, 0, 1), vidrio, np.array(vidrio) * 0.45 + 140)
    img[v] = refl[v]
    return img
def tex_techo():
    g = ia('techo', (92, 92, 94))
    if g is not None: return g
    a, c = ruido(N, 1.4, 21), ruido(N, 0.05, 22)
    return mezcla(a * 0.5 + c * 0.5, (70, 70, 72), (104, 102, 100))

TEX = {}
for nom, f in [('pasto', tex_pasto), ('arena', tex_arena), ('roca', tex_roca), ('tierra', tex_tierra), ('luna', tex_luna), ('asfalto', tex_asfalto),
               ('calle', tex_calle), ('vereda', tex_vereda), ('agua', tex_agua), ('techo', tex_techo)]:
    TEX[nom] = textura(nom, f())
for k, (p, vd, mc, s, b) in enumerate([((168, 98, 76), (60, 98, 140), (230, 226, 216), 31, 'ladrillo'), ((168, 168, 170), (54, 84, 118), (70, 72, 78), 32, 'hormigon_pared'),
                                       ((96, 130, 170), (40, 70, 110), (200, 210, 220), 33, 'metal'), ((222, 206, 168), (70, 110, 130), (120, 90, 60), 34, 'revoque')]):
    TEX['fach%d' % k] = textura('fachada%d' % k, tex_fachada(p, vd, mc, s, b), 256)

# ---------------- materiales ----------------
def material(nom, tex, rep, pbr_nombre=None):
    mi = len(d['mt'])
    d['mt'].append({'n': pbr_nombre or ('RB_' + nom), 'sh': 'Mobile/Diffuse', 't': tex, 'ts': [rep, rep], 'to': [0.0, 0.0], 'tt': {'_MainTex': [tex, rep, rep, 0.0, 0.0]},
                    'cc': {'_Color': [1.0, 1.0, 1.0, 1.0]}, 'c': [1.0, 1.0, 1.0, 1.0], 'f': {}})
    return mi
def cielo(nom, top, mid, bot, sol):
    base = json.loads(json.dumps(d['mt'][d['aj']['FlatGrass']['sky']])); base['n'] = 'RB_Cielo_' + nom
    cc = base.setdefault('cc', {}); cc['_TopColor'] = top + [1.0]; cc['_MiddleColor'] = mid + [1.0]; cc['_BottomColor'] = bot + [1.0]; cc['_SunTint'] = sol + [1.0]
    d['mt'].append(base); return len(d['mt']) - 1

# ---------------- mallas ----------------
class Malla:
    def __init__(self): self.V, self.Nn, self.U, self.I = [], [], [], {}
    def quad(self, mat, a, b, c, e, uv, n=None):
        """cuatro esquinas (en orden alrededor) con sus UV; la normal sale de la cara"""
        P = [np.array(x, float) for x in (a, b, c, e)]
        if n is None: n = np.cross(P[1] - P[0], P[3] - P[0]); n = n / (np.linalg.norm(n) or 1)
        base = len(self.V)
        for k in range(4): self.V.append(P[k]); self.Nn.append(n); self.U.append(uv[k])
        self.I.setdefault(mat, []).extend([base, base + 1, base + 2, base, base + 2, base + 3])
    def caja(self, mat_lados, mat_techo, c, t, bay=4.0, piso=3.5):
        """un edificio: cuatro fachadas con ventanas por piso y el techo"""
        x0, x1, y0, y1, z0, z1 = c[0] - t[0] / 2, c[0] + t[0] / 2, c[1], c[1] + t[1], c[2] - t[2] / 2, c[2] + t[2] / 2
        fu, fv = lambda L: max(1, round(L / bay)), max(1, round(t[1] / piso))
        lados = [((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1), t[0]), ((x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0), t[0]),
                 ((x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1), t[2]), ((x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0), t[2])]
        for a, b, cc, e, L in lados:
            u = fu(L); self.quad(mat_lados, a, b, cc, e, [(0, 0), (u, 0), (u, fv), (0, fv)])
        self.quad(mat_techo, (x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0), [(0, 0), (t[0] / 3, 0), (t[0] / 3, t[2] / 3), (0, t[2] / 3)])
    def guardar(self, nombre):
        V = np.array(self.V, float); Nn = np.array(self.Nn, float); U = np.array(self.U, float)
        return malla_bin(nombre, V, Nn, U, self.I)
def malla_bin(nombre, V, Nn, U, porMat):
    mn = V.min(0); sc = np.maximum(V.max(0) - mn, 1e-6)
    q = np.round((V - mn) / sc * 65535).astype('<u2'); nb = np.clip(np.round(Nn * 127), -127, 127).astype(np.int8); uv = U.astype('<f2')
    vb = np.zeros((len(V), 14), np.uint8); vb[:, 0:6] = q.view(np.uint8).reshape(-1, 6); vb[:, 6:9] = nb.view(np.uint8).reshape(-1, 3); vb[:, 10:14] = uv.view(np.uint8).reshape(-1, 4)
    mats = list(porMat.keys()); idx = []; sub = []
    for m in mats: sub.append([len(idx), len(porMat[m])]); idx.extend(porMat[m])
    i32 = len(V) > 65535; o_v = agregar(vb.tobytes()); o_i = agregar(np.array(idx, '<u4' if i32 else '<u2').tobytes())
    mi = len(d['ms']); d['ms'].append({'n': nombre, 'o': o_v, 'v': len(V), 'mn': mn.tolist(), 'sc': sc.tolist(), 'i': o_i, 'i32': bool(i32), 'sub': sub})
    return mi, mats
# terreno: grilla de (n+1)² con la altura h(x, z); cada triángulo elige material con elegir(altura, pendiente)
def terreno(nombre, L, n, h, elegir, rep=None):
    g = np.linspace(-L / 2, L / 2, n + 1); X, Z = np.meshgrid(g, g); H = h(X, Z)
    dx = (np.roll(H, -1, 1) - np.roll(H, 1, 1)) / (2 * L / n); dz = (np.roll(H, -1, 0) - np.roll(H, 1, 0)) / (2 * L / n)
    dx[:, 0] = dx[:, 1]; dx[:, -1] = dx[:, -2]; dz[0] = dz[1]; dz[-1] = dz[-2]
    Nn = np.stack([-dx, np.ones_like(H), -dz], -1); Nn /= np.linalg.norm(Nn, axis=-1, keepdims=True)
    V = np.stack([X, H, Z], -1).reshape(-1, 3); Nn = Nn.reshape(-1, 3)
    j, i = np.mgrid[0:n + 1, 0:n + 1]; U = np.stack([i / n, j / n], -1).reshape(-1, 2)  # (exactas en medio flotante: n es potencia de 2)
    porMat = {}
    for zz in range(n):
        for xx_ in range(n):
            a = zz * (n + 1) + xx_; b = a + 1; c = a + n + 1; e = c + 1
            for tri in ((a, c, b), (b, c, e)):
                hm = (V[tri[0], 1] + V[tri[1], 1] + V[tri[2], 1]) / 3; ny = (Nn[tri[0], 1] + Nn[tri[1], 1] + Nn[tri[2], 1]) / 3
                porMat.setdefault(elegir(hm, ny), []).extend(tri)
    mi, mats = malla_bin(nombre, V, Nn, U, porMat)
    return mi, mats, H, g

# ---------------- escena ----------------
PF = {k.split('#')[0]: v for k, v in d['pf'].items()}
def nodo(n, p=(0, 0, 0), r=(0, 0, 0, 1), s=(1, 1, 1), pa=-1, **x): return dict(n=n, p=[round(float(v), 4) for v in p], r=[round(float(v), 6) for v in r], s=[round(float(v), 4) for v in s], pa=pa, **x)
def yaw_q(a): return (0, math.sin(a / 2), 0, math.cos(a / 2))
def poner(nombre, p, yaw=0.0, esc=1.0):
    """un prop del paquete como parte fija del mapa (sus mallas y sus colliders, sin física)"""
    arb = PF[nombre]; out = []
    for i, x in enumerate(arb):
        y = {k: v for k, v in x.items() if k not in ('rb', 'mb', 'tg')}
        if i == 0: y.update(p=[round(float(v), 4) for v in p], r=[round(v, 6) for v in yaw_q(yaw)], s=[esc, esc, esc], pa=-1)
        out.append(y)
    return out
def luz(direccion, color, inten):
    f = np.array(direccion, float); f /= np.linalg.norm(f)  # (hacia donde va la luz)
    # rotación que lleva +Z a f
    z = np.array([0, 0, 1.0]); ax = np.cross(z, f); s = np.linalg.norm(ax); c = float(np.dot(z, f))
    q = (0, 0, 0, 1) if s < 1e-6 else tuple(list(ax / s * math.sin(math.atan2(s, c) / 2)) + [math.cos(math.atan2(s, c) / 2)])
    return [nodo('Directional Light', (0, 3, 0), q, lz={'t': 1, 'c': list(color), 'i': inten, 'rg': 10.0, 'sa': 30.0})]
def bordes(L, alto=400):
    """paredes invisibles alrededor"""
    r = [nodo('RB_Bordes')]
    for k, (cx, cz, sx, sz) in enumerate([(L / 2 + 5, 0, 10, L + 20), (-L / 2 - 5, 0, 10, L + 20), (0, L / 2 + 5, L + 20, 10), (0, -L / 2 - 5, L + 20, 10)]):
        r.append(nodo('Borde%d' % k, (cx, alto / 2 - 50, cz), pa=0, col=[{'k': 'b', 'c': [0, 0, 0], 's': [sx, alto, sz], 'tr': 0}]))
    return r
def aparicion(puntos):
    return [nodo('RB_Aparicion')] + [nodo('SpawnPoint%s' % ('' if k == 0 else ' (%d)' % k), (x, y, z), pa=0) for k, (x, y, z) in enumerate(puntos)]
def fijo(nombre, mi, mats, p=(0, 0, 0), col=None):
    x = nodo(nombre, p, m=mi, mt=mats, rid=9920000 + mi)
    if col: x['col'] = col
    return [x]
def ambiente(nombre, sky, niebla, ai=1.1, **extra):
    a = json.loads(json.dumps(d['aj']['FlatGrass'])); a['sky'] = sky; a['ai'] = ai
    if niebla: a.update(fog=1, fm=3, fc=list(niebla[0]), fs=niebla[1], fe=niebla[2], fd=0)
    else: a['fog'] = 0
    a.update(extra); d['aj'][nombre] = a
rng = np.random.default_rng(42)
MAPAS = {}

# ---------- Llanura: pasto parejo de 1 km, con lomas suaves en el borde ----------
# materiales del terreno con la repetición justa para su tamaño (L metros): cada baldosa mide lo que mide en la realidad
def mats_terreno(L, sufijo):
    return (material('Pasto' + sufijo, TEX['pasto'], L / 3.2), material('Tierra' + sufijo, TEX['tierra'], L / 4), material('Roca' + sufijo, TEX['roca'], L / 7),
            material('Arena' + sufijo, TEX['arena'], L / 4.5), material('AguaGlass' + sufijo, TEX['agua'], L / 14))
mP, mT, mR, mA, mAg = mats_terreno(1000, 'Llanura')
def h_llanura(X, Z):
    r = np.maximum(np.abs(X), np.abs(Z)); borde = np.clip((r - 380) / 120, 0, 1)
    return 0.53 + borde ** 2 * (30 + 18 * np.sin(X * 0.02) * np.cos(Z * 0.017))
mi, mats, H, g = terreno('RB_Llanura_Suelo', 1000, 128, h_llanura, lambda hm, ny: mP if ny > 0.82 else mR)
esc = [luz((-0.45, -0.75, 0.48), (1.0, 0.96, 0.86), 1.05), fijo('Suelo', mi, mats, col=[{'k': 'm', 'm': mi, 'cv': 0, 'tr': 0}]), bordes(1000), aparicion([(0, 1.6, 0), (4, 1.6, 0), (-4, 1.6, 0), (0, 1.6, 4)])]
# un anillo de palmeras y una placita al lado de donde se aparece (el resto, libre para construir)
for k in range(16): a = k / 16 * 2 * math.pi; esc.append(poner('Palmera', (math.cos(a) * 140, 0.53, math.sin(a) * 140), a, 1.1 + 0.3 * rng.random()))
for k, (x, z, yaw) in enumerate([(-10, 14, 0), (-4, 14, 0), (4, 14, 0), (10, 14, 0)]): esc.append(poner('Banco', (x, 0.53, z + 2), math.pi))
for x in (-13, -1, 7, 13): esc.append(poner('Farol', (x, 0.53, 18), math.pi))
esc.append(poner('CamaElastica', (-14, 0.53, 30), 0)); esc.append(poner('CamaElastica', (-6, 0.53, 34), 0))
esc.append(poner('AroBasquet', (12, 0.53, 40), math.pi)); esc.append(poner('Arcade', (20, 0.53, 26), -math.pi / 2)); esc.append(poner('Arcade', (20, 0.53, 28.2), -math.pi / 2))
esc.append(poner('Semaforo', (-20, 0.53, 20), 0.6))
ambiente('RB_Llanura', cielo('Llanura', [0.24, 0.56, 0.98], [0.86, 0.92, 0.98], [0.56, 0.62, 0.7], [1.0, 0.86, 0.68]), ((0.86, 0.91, 0.97), 260, 520))
d['esc']['RB_Llanura'] = esc

# ---------- Colinas: lomas, un lago con playa, palmeras y rocas ----------
mP, mT, mR, mA, mAg = mats_terreno(800, 'Colinas')
nH = ruido(129, 2.2, 50)[:129, :129]
def h_colinas(X, Z):
    i = np.clip(((X + 400) / 800 * 128).round().astype(int), 0, 128); j = np.clip(((Z + 400) / 800 * 128).round().astype(int), 0, 128)
    base = (nH[j, i] - 0.5) * 70; lago = np.exp(-(((X - 90) / 85) ** 2 + ((Z + 60) / 70) ** 2)) * 26
    centro = np.exp(-((X / 70) ** 2 + (Z / 70) ** 2))
    h = base * (1 - centro * 0.9) + 6 - lago
    r = np.maximum(np.abs(X), np.abs(Z)); return h + np.clip((r - 330) / 70, 0, 1) ** 2 * 40
mi, mats, H, g = terreno('RB_Colinas_Suelo', 800, 128, h_colinas, lambda hm, ny: mA if hm < 1.6 else (mR if ny < 0.82 else (mT if ny < 0.9 else mP)))
def altura(H, g, x, z):
    # (la del triángulo de la grilla donde cae, como la malla: así nada flota ni se hunde)
    n = len(g) - 1; fx = np.clip((x - g[0]) / (g[1] - g[0]), 0, n - 1e-6); fz = np.clip((z - g[0]) / (g[1] - g[0]), 0, n - 1e-6)
    i, j = int(fx), int(fz); u, v = fx - i, fz - j
    a, b, c, e = H[j, i], H[j, i + 1], H[j + 1, i], H[j + 1, i + 1]
    return float(a + (b - a) * u + (c - a) * v if u + v <= 1 else e + (c - e) * (1 - u) + (b - e) * (1 - v))
agua = Malla(); agua.quad(mAg, (-400, 0.3, 400), (400, 0.3, 400), (400, 0.3, -400), (-400, 0.3, -400), [(0, 0), (1, 0), (1, 1), (0, 1)], n=np.array([0, 1.0, 0])); ma, mma = agua.guardar('RB_Colinas_Agua')
esc = [luz((-0.5, -0.7, 0.5), (1.0, 0.95, 0.84), 1.05), fijo('Suelo', mi, mats, col=[{'k': 'm', 'm': mi, 'cv': 0, 'tr': 0}]), fijo('Lago', ma, mma), bordes(800)]
y0 = altura(H, g, 0, 0); esc.append(aparicion([(0, y0 + 1.2, 0), (5, y0 + 1.2, 2), (-5, y0 + 1.2, 2)]))
puestos = 0
while puestos < 70:
    x, z = rng.uniform(-320, 320, 2); y = altura(H, g, x, z)
    if y < 2 or abs(x) < 20 and abs(z) < 20: continue
    esc.append(poner('Palmera' if rng.random() < 0.55 else 'Roca', (x, y - 0.1, z), rng.uniform(0, 6.28), rng.uniform(0.8, 1.6) if rng.random() < 0.6 else rng.uniform(2, 4))); puestos += 1
for k in range(4): esc.append(poner('Banco', (8 + k * 2.5, altura(H, g, 8 + k * 2.5, 8) - 0.05, 8), math.pi))
ambiente('RB_Colinas', cielo('Colinas', [0.2, 0.5, 0.95], [0.8, 0.88, 0.96], [0.5, 0.58, 0.68], [1.0, 0.84, 0.66]), ((0.8, 0.87, 0.95), 220, 480))
d['esc']['RB_Colinas'] = esc

# ---------- Isla: una isla en el mar, con playa, palmeras y un muelle de cajas ----------
mP, mT, mR, mA, mAg = mats_terreno(900, 'Isla')
def h_isla(X, Z):
    r = np.sqrt(X ** 2 + Z ** 2) / 170; i = np.clip(((X + 450) / 900 * 128).round().astype(int), 0, 128); j = np.clip(((Z + 450) / 900 * 128).round().astype(int), 0, 128)
    return 18 * np.clip(1 - r ** 2, -1.5, 1) + (nH[j, i] - 0.5) * 10 * np.clip(1 - r, 0, 1) + 1.5
mi, mats, H, g = terreno('RB_Isla_Suelo', 900, 128, h_isla, lambda hm, ny: mA if hm < 3.2 else (mR if ny < 0.84 else mP))
agua = Malla(); agua.quad(mAg, (-450, 0.4, 450), (450, 0.4, 450), (450, 0.4, -450), (-450, 0.4, -450), [(0, 0), (1, 0), (1, 1), (0, 1)], n=np.array([0, 1.0, 0])); ma, mma = agua.guardar('RB_Isla_Agua')
esc = [luz((-0.35, -0.8, 0.45), (1.0, 0.95, 0.82), 1.1), fijo('Suelo', mi, mats, col=[{'k': 'm', 'm': mi, 'cv': 0, 'tr': 0}]), fijo('Mar', ma, mma), bordes(900)]
y0 = altura(H, g, 0, 60); esc.append(aparicion([(0, y0 + 1.2, 60), (4, y0 + 1.2, 62), (-4, y0 + 1.2, 62)]))
for k in range(60):
    a = rng.uniform(0, 6.28); r = rng.uniform(60, 160); x, z = math.cos(a) * r, math.sin(a) * r; y = altura(H, g, x, z)
    if y < 1.2: continue
    esc.append(poner('Palmera', (x, y - 0.1, z), rng.uniform(0, 6.28), rng.uniform(0.9, 1.5)))
for k in range(8): esc.append(poner('Roca', (rng.uniform(-120, 120), 0.2, rng.uniform(-120, 120)), rng.uniform(0, 6), rng.uniform(1.5, 3)))
esc.append(poner('CamaElastica', (10, altura(H, g, 10, 70), 70), 0)); esc.append(poner('Pelota', (6, altura(H, g, 6, 70) + 0.5, 70), 0))
ambiente('RB_Isla', cielo('Isla', [0.16, 0.5, 0.98], [0.78, 0.9, 0.98], [0.42, 0.6, 0.74], [1.0, 0.88, 0.7]), ((0.78, 0.88, 0.96), 240, 520))
d['esc']['RB_Isla'] = esc

# ---------- Ciudad: manzanas de 100 m, calles de 12 m con veredas, edificios, plaza y parque ----------
mCalle, mAsf, mVer, mTecho = material('Calle', TEX['calle'], 1), material('Asfalto', TEX['asfalto'], 1), material('Vereda', TEX['vereda'], 1), material('Techo', TEX['techo'], 1)
mFach = [material('Fachada%d' % k, TEX['fach%d' % k], 1) for k in range(4)]
mPasto2 = material('Pasto2', TEX['pasto'], 1)
B, CALLE, VER = 100.0, 12.0, 4.0  # manzana, calle y vereda
NB = 5; L = NB * B + (NB + 1) * CALLE
ciudad = Malla(); cols = []
x0 = -L / 2
def a_m(i): return x0 + CALLE + i * (B + CALLE)  # comienzo de la manzana i
# calles (tramos por manzana para que las UV queden chicas) y cruces
for i in range(NB + 1):
    c = x0 + CALLE / 2 + i * (B + CALLE)
    for j in range(NB):
        s0, s1 = a_m(j), a_m(j) + B
        ciudad.quad(mCalle, (c + CALLE / 2, 0.55, s0), (c - CALLE / 2, 0.55, s0), (c - CALLE / 2, 0.55, s1), (c + CALLE / 2, 0.55, s1), [(1, 0), (0, 0), (0, B / CALLE), (1, B / CALLE)], n=np.array([0, 1.0, 0]))
        ciudad.quad(mCalle, (s0, 0.55, c - CALLE / 2), (s0, 0.55, c + CALLE / 2), (s1, 0.55, c + CALLE / 2), (s1, 0.55, c - CALLE / 2), [(1, 0), (0, 0), (0, B / CALLE), (1, B / CALLE)], n=np.array([0, 1.0, 0]))
    for j in range(NB + 1):
        c2 = x0 + CALLE / 2 + j * (B + CALLE)
        ciudad.quad(mAsf, (c - CALLE / 2, 0.55, c2 + CALLE / 2), (c + CALLE / 2, 0.55, c2 + CALLE / 2), (c + CALLE / 2, 0.55, c2 - CALLE / 2), (c - CALLE / 2, 0.55, c2 - CALLE / 2), [(0, 0), (1, 0), (1, 1), (0, 1)], n=np.array([0, 1.0, 0]))
esc = [luz((-0.42, -0.72, 0.55), (1.0, 0.95, 0.85), 1.05), bordes(L + 40)]
# el piso de abajo (por si algo se cae entre medio) y un colchón de choque para todo el suelo
suelo = Malla(); suelo.quad(mAsf, (-L / 2 - 20, 0.5, L / 2 + 20), (L / 2 + 20, 0.5, L / 2 + 20), (L / 2 + 20, 0.5, -L / 2 - 20), (-L / 2 - 20, 0.5, -L / 2 - 20), [(0, 0), (40, 0), (40, 40), (0, 40)], n=np.array([0, 1.0, 0]))
ms_, mms_ = suelo.guardar('RB_Ciudad_Piso'); esc.append(fijo('Piso', ms_, mms_, col=[{'k': 'b', 'c': [0, -1.95, 0], 's': [L + 40, 5, L + 40], 'tr': 0}]))
plaza, parque = (2, 2), (1, 3)
for i in range(NB):
    for j in range(NB):
        bx, bz = a_m(i), a_m(j); cx, cz = bx + B / 2, bz + B / 2
        # vereda: un escalón de 15 cm alrededor (y el centro de la manzana a la misma altura)
        ciudad.caja(mVer, mVer, (cx, 0.4, cz), (B, 0.3, B), bay=2, piso=1)
        cols.append({'k': 'b', 'c': [cx, 0.55, cz], 's': [B, 0.3, B], 'tr': 0})
        if (i, j) == plaza or (i, j) == parque:
            ciudad.quad(mPasto2, (bx + VER, 0.72, bz + B - VER), (bx + B - VER, 0.72, bz + B - VER), (bx + B - VER, 0.72, bz + VER), (bx + VER, 0.72, bz + VER), [(0, 0), (28, 0), (28, 28), (0, 28)], n=np.array([0, 1.0, 0]))
            continue
        # edificios: de 2 a 4 por lado, alturas que suben hacia el centro
        lejos = math.hypot(cx, cz) / (L / 2); nx, nz = rng.integers(2, 4), rng.integers(2, 4); w, dd = (B - 2 * VER) / nx, (B - 2 * VER) / nz
        for a in range(nx):
            for b in range(nz):
                if 0 < a < nx - 1 and 0 < b < nz - 1: continue
                alto = float(np.clip(rng.normal(60 - 45 * lejos, 14), 10, 110)); alto = round(alto / 3.5) * 3.5
                ex, ez = bx + VER + (a + 0.5) * w, bz + VER + (b + 0.5) * dd; tw, td = w - 1.5, dd - 1.5
                ciudad.caja(mFach[int(rng.integers(0, 4))], mTecho, (ex, 0.7, ez), (tw, alto, td))
                cols.append({'k': 'b', 'c': [ex, 0.7 + alto / 2, ez], 's': [tw, alto, td], 'tr': 0})
mi, mats = ciudad.guardar('RB_Ciudad')
esc.append(fijo('Ciudad', mi, mats)); esc.append([nodo('RB_Choques')] + [nodo('C%d' % k, pa=0, col=[c]) for k, c in enumerate(cols)])
# faroles cada 25 m por las veredas, semáforos en los cruces, bancos y palmeras en la plaza, juegos en el parque
for i in range(NB):
    for j in range(NB):
        bx, bz = a_m(i), a_m(j)
        for t in range(1, 4):
            esc.append(poner('Farol', (bx + 1.2, 0.7, bz + t * 25), math.pi / 2)); esc.append(poner('Farol', (bx + B - 1.2, 0.7, bz + t * 25), -math.pi / 2))
for i in range(1, NB):
    for j in range(1, NB):
        c, c2 = x0 + CALLE / 2 + i * (B + CALLE), x0 + CALLE / 2 + j * (B + CALLE)
        esc.append(poner('Semaforo', (c + CALLE / 2 + 1.0, 0.7, c2 + CALLE / 2 + 1.0), math.pi * 1.25))
px, pz = a_m(plaza[0]) + B / 2, a_m(plaza[1]) + B / 2
for k in range(10): a = k / 10 * 2 * math.pi; esc.append(poner('Palmera', (px + math.cos(a) * 30, 0.72, pz + math.sin(a) * 30), a, 1.2))
for k in range(8): a = (k + 0.5) / 8 * 2 * math.pi; esc.append(poner('Banco', (px + math.cos(a) * 18, 0.72, pz + math.sin(a) * 18), -a + math.pi / 2))
qx, qz = a_m(parque[0]) + B / 2, a_m(parque[1]) + B / 2
for k, (dx, dz) in enumerate([(-20, -20), (20, -20), (-20, 20), (20, 20)]): esc.append(poner('CamaElastica', (qx + dx, 0.72, qz + dz), 0))
esc.append(poner('AroBasquet', (qx, 0.72, qz - 36), 0)); esc.append(poner('AroBasquet', (qx, 0.72, qz + 36), math.pi)); esc.append(poner('Arcade', (qx - 40, 0.72, qz), math.pi / 2))
esc.append(aparicion([(px, 2.0, pz - 8), (px + 4, 2.0, pz - 8), (px - 4, 2.0, pz - 8), (px, 2.0, pz + 8)]))
ambiente('RB_Ciudad', cielo('Ciudad', [0.3, 0.58, 0.95], [0.86, 0.9, 0.95], [0.6, 0.64, 0.7], [1.0, 0.88, 0.72]), ((0.82, 0.86, 0.92), 300, 640))
d['esc']['RB_Ciudad'] = esc

# ---------- Desierto: médanos, mesetas de roca y un oasis ----------
mP, mT, mR, mA, mAg = mats_terreno(900, 'Desierto')
nD = ruido(129, 2.4, 60)
def h_desierto(X, Z):
    i = np.clip(((X + 450) / 900 * 128).round().astype(int), 0, 128); j = np.clip(((Z + 450) / 900 * 128).round().astype(int), 0, 128)
    medanos = (np.sin(X * 0.05 + Z * 0.012 + nD[j, i] * 5) * 0.5 + 0.5) * 14 * (0.35 + nD[j, i])
    oasis = np.exp(-(((X + 120) / 50) ** 2 + ((Z - 80) / 45) ** 2)) * 9
    centro = np.exp(-((X / 60) ** 2 + (Z / 60) ** 2))
    r = np.maximum(np.abs(X), np.abs(Z)); return 3 + medanos * (1 - centro) - oasis + np.clip((r - 370) / 80, 0, 1) ** 2 * 50
mi, mats, H, g = terreno('RB_Desierto_Suelo', 900, 128, h_desierto, lambda hm, ny: mR if ny < 0.8 else mA)
agua = Malla(); agua.quad(mAg, (-170, -1.5, 30), (-70, -1.5, 30), (-70, -1.5, 130), (-170, -1.5, 130), [(0, 0), (0.1, 0), (0.1, 0.1), (0, 0.1)], n=np.array([0, 1.0, 0])); ma, mma = agua.guardar('RB_Desierto_Oasis')
esc = [luz((-0.3, -0.85, 0.42), (1.0, 0.92, 0.78), 1.18), fijo('Suelo', mi, mats, col=[{'k': 'm', 'm': mi, 'cv': 0, 'tr': 0}]), fijo('Oasis', ma, mma), bordes(900)]
y0 = altura(H, g, 0, 0); esc.append(aparicion([(0, y0 + 1.2, 0), (4, y0 + 1.2, 0), (-4, y0 + 1.2, 0)]))
for k in range(18):
    a = rng.uniform(0, 6.28); r = rng.uniform(120, 330); x, z = math.cos(a) * r, math.sin(a) * r
    esc.append(poner('Roca', (x, altura(H, g, x, z) - 2, z), rng.uniform(0, 6), rng.uniform(6, 14)))  # (mesetas: rocas enormes)
for k in range(14):
    a = rng.uniform(0, 6.28); r = rng.uniform(52, 70); x, z = -120 + math.cos(a) * r, 80 + math.sin(a) * r * 0.9
    esc.append(poner('Palmera', (x, altura(H, g, x, z) - 0.1, z), rng.uniform(0, 6), rng.uniform(1.0, 1.5)))
ambiente('RB_Desierto', cielo('Desierto', [0.3, 0.55, 0.9], [0.96, 0.88, 0.74], [0.8, 0.68, 0.52], [1.0, 0.82, 0.6]), ((0.94, 0.86, 0.72), 260, 560))
d['esc']['RB_Desierto'] = esc

# ---------- Luna: cráteres, polvo gris, gravedad baja, cielo negro ----------
mL = material('Luna', TEX['luna'], 900 / 5)
crs = [(rng.uniform(-350, 350), rng.uniform(-350, 350), rng.uniform(12, 70)) for _ in range(46)]
def h_luna(X, Z):
    h = np.zeros_like(X) + 2
    for cx, cz, r in crs:
        dd = np.sqrt((X - cx) ** 2 + (Z - cz) ** 2) / r
        h += np.where(dd < 1, -(1 - dd ** 2) * r * 0.12, 0) + np.exp(-((dd - 1) / 0.16) ** 2) * r * 0.04
    centro = np.exp(-((X / 40) ** 2 + (Z / 40) ** 2)); h = h * (1 - centro) + 2 * centro
    r = np.maximum(np.abs(X), np.abs(Z)); return h + np.clip((r - 380) / 70, 0, 1) ** 2 * 40
mi, mats, H, g = terreno('RB_Luna_Suelo', 900, 128, h_luna, lambda hm, ny: mL)
base = Malla(); cols = []
for k, (x, z, t) in enumerate([(14, 6, (8, 4, 8)), (24, 6, (10, 3, 6)), (14, 16, (6, 3, 10))]):  # una base lunar de módulos
    y = altura(H, g, x, z); base.caja(mFach[1], mTecho, (x, y - 0.3, z), t, bay=4, piso=3.5); cols.append({'k': 'b', 'c': [x, y - 0.3 + t[1] / 2, z], 's': list(t), 'tr': 0})
mb, mmb = base.guardar('RB_Luna_Base')
esc = [luz((-0.4, -0.8, 0.45), (1.0, 1.0, 0.98), 1.2), fijo('Suelo', mi, mats, col=[{'k': 'm', 'm': mi, 'cv': 0, 'tr': 0}]), fijo('Base', mb, mmb), [nodo('RB_Choques')] + [nodo('C%d' % k, pa=0, col=[c]) for k, c in enumerate(cols)], bordes(900)]
esc.append(aparicion([(0, 3.2, 0), (4, 3.2, 0), (-4, 3.2, 0)]))
for k in range(30):
    x, z = rng.uniform(-300, 300, 2); esc.append(poner('Roca', (x, altura(H, g, x, z) - 0.3, z), rng.uniform(0, 6), rng.uniform(0.6, 2.5)))
ambiente('RB_Luna', cielo('Luna', [0.0, 0.0, 0.01], [0.02, 0.02, 0.03], [0.03, 0.03, 0.035], [0.9, 0.9, 0.9]), None, ai=1.25, grav=0.165, espacio=1, ambRB=[[0.2, 0.2, 0.22], [0.15, 0.15, 0.16]])
d['esc']['RB_Luna'] = esc

open(PK1 + '/m.bin.gz', 'wb').write(gzip.compress(bytes(BIN), 6))
open(PK1 + '/d.json.gz', 'wb').write(gzip.compress(json.dumps(d, separators=(',', ':')).encode(), 6))
print('mapas:', [k for k in d['esc'] if k.startswith('RB_')], 'texturas', len(d['tx']), 'mallas', len(d['ms']), 'bin', len(BIN))
