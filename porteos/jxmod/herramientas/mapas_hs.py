# Los 8 mapas que venían de Hyper Sandbox (Desert, DesertV2, FlatGrass, City, Base, BaseV2, Mars y Space), hechos de nuevo
# acá: mismo nombre (las partidas guardadas, las salas, los mods y los menús siguen andando), terreno jugable y todo propio
# (el terreno, las texturas, los edificios, la base, la estación espacial). Pedido del dueño: «hay que modificar entero los
# mapas de Hyper Sandbox: el juego ahora sí debe ser único». El piso donde se aparece queda a la altura de antes (0,53 m)
# y la aparición principal en el centro, así lo que estaba puesto en una partida guardada sigue cayendo en su lugar.
# Usa los ayudantes de mapas_rb.py (materiales, mallas, terreno, escena) y sus texturas propias, que ya están en el paquete.
# Uso: python3 -I mapas_hs.py PAQUETE_ORIGEN PAQUETE_NUEVO
import sys, os, json, gzip, math, numpy as np
from PIL import Image, ImageDraw
PK0, PK1 = sys.argv[1:3]
os.makedirs(PK1, exist_ok=True)
for sub in ('t', 'i', 'a', 'fondos'):
    os.makedirs(os.path.join(PK1, sub), exist_ok=True)
    if not os.path.isdir(os.path.join(PK0, sub)): continue
    for f in os.listdir(os.path.join(PK0, sub)):
        dst = os.path.join(PK1, sub, f)
        if not os.path.exists(dst): os.link(os.path.join(PK0, sub, f), dst)
for f in os.listdir(PK0):   # (lo demás del paquete, tal cual)
    s, dst = os.path.join(PK0, f), os.path.join(PK1, f)
    if os.path.isfile(s) and f not in ('d.json.gz', 'm.bin.gz') and not os.path.exists(dst): os.link(s, dst)
d = json.load(gzip.open(PK0 + '/d.json.gz')); BIN = bytearray(gzip.decompress(open(PK0 + '/m.bin.gz', 'rb').read()))
def agregar(b):
    while len(BIN) % 4: BIN.append(0)
    o = len(BIN); BIN.extend(b); return o
# los ayudantes de mapas_rb.py (de «materiales» hasta antes de los mapas): material, cielo, Malla, terreno, nodo, poner, ...
_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mapas_rb.py'), encoding='utf-8').read()
exec(_src[_src.index('# ---------------- materiales ----------------'):_src.index('rng = np.random.default_rng(42)')], globals())
rng = np.random.default_rng(39)
HS = ['Desert', 'DesertV2', 'FlatGrass', 'City', 'Base', 'BaseV2', 'Mars', 'Space']
VIEJOS = {k: d['esc'][k] for k in HS}; CIELOS_VIEJOS = {d['aj'][k].get('sky') for k in HS if d['aj'].get(k)}
TX = {t['n']: i for i, t in enumerate(d['tx'])}
assert 'RB_pasto' in TX, 'el paquete no tiene las texturas de mapas_rb.py'

# ---------------- texturas nuevas ----------------
N = 512
def textura(nom, img, lado=512):
    ti = len(d['tx']); d['tx'].append({'n': 'HS_' + nom, 'a': 0, 'w': lado, 'h': lado})
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((lado, lado), Image.LANCZOS).save(PK1 + '/t/%d.webp' % ti, 'WEBP', quality=88, method=6)
    return ti
def ruido(n, beta, semilla):
    r = np.random.default_rng(semilla).standard_normal((n, n)); F = np.fft.fft2(r)
    ky, kx = np.fft.fftfreq(n)[:, None], np.fft.fftfreq(n)[None, :]; k = np.sqrt(kx * kx + ky * ky); k[0, 0] = 1
    x = np.real(np.fft.ifft2(F / k ** beta)); return (x - x.min()) / (x.max() - x.min())
def col(v, c0, c1): v = np.clip(v, 0, 1)[..., None]; return np.array(c0, float) * (1 - v) + np.array(c1, float) * v
yy, xx = np.mgrid[0:N, 0:N] / N
def tex_hormigon():   # (losas de 4 m: la textura es una losa, con la junta en el borde)
    a, b = ruido(N, 1.6, 101), ruido(N, 0.4, 102)
    img = col(0.5 + (a - 0.5) * 0.5, (128, 128, 124), (166, 165, 158)) * (0.9 + 0.2 * b[..., None])
    junta = (np.minimum(np.minimum(xx, 1 - xx), np.minimum(yy, 1 - yy)) < 0.006)
    img[junta] *= 0.55; return img
def tex_chapa():   # (chapa de piso de una estación: paneles de 2 m con remaches y un dibujo antideslizante)
    a = ruido(N, 1.2, 111); u, v = (xx * 2) % 1, (yy * 2) % 1
    img = col(a, (88, 96, 108), (118, 126, 138))
    rombo = ((np.abs(((xx * 32) % 1) - 0.5) + np.abs(((yy * 32 + (np.floor(xx * 32) % 2) * 0.5) % 1) - 0.5)) < 0.18)
    img[rombo] *= 1.18
    borde = (np.minimum(np.minimum(u, 1 - u), np.minimum(v, 1 - v)) < 0.012); img[borde] *= 0.45
    for cx in (0.04, 0.96):
        for cy in (0.04, 0.96):
            rem = (((u - cx) ** 2 + (v - cy) ** 2) < 0.012 ** 2); img[rem] = (170, 176, 186)
    return img
def tex_franja():   # (franja de peligro amarilla y negra: el amarillo de JXMod)
    t = ((xx + yy) * 6) % 1; img = np.where((t < 0.5)[..., None], np.array((242, 179, 27), float), np.array((24, 24, 26), float))
    return img * (0.88 + 0.24 * ruido(N, 0.6, 121)[..., None])
def tex_helipuerto():   # (no se repite: un cuadrado de hormigón con el círculo y la H)
    img = tex_hormigon(); im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)); g = ImageDraw.Draw(im)
    g.ellipse((56, 56, 456, 456), outline=(242, 179, 27), width=22)
    for r in ((176, 140, 216, 372), (296, 140, 336, 372), (176, 236, 336, 276)): g.rectangle(r, fill=(236, 236, 230))
    return np.asarray(im).astype(float)
def tex_marte():
    a, b, c = ruido(N, 1.9, 131), ruido(N, 0.9, 132), ruido(N, 0.25, 133)
    return col(0.5 + (a - 0.5) * 0.6 + (b - 0.5) * 0.5, (128, 58, 32), (196, 104, 58)) * (0.86 + 0.28 * c[..., None])
def tex_marte_roca():
    a, b = ruido(N, 1.4, 141), ruido(N, 0.5, 142); vetas = (np.sin((yy * 18 + a * 4) * np.pi) * 0.5 + 0.5) ** 3
    return col(0.35 + a * 0.4 + vetas * 0.25, (84, 40, 26), (158, 82, 50)) * (0.85 + 0.3 * b[..., None])
def tex_contenedor(color):   # (chapa acanalada de contenedor)
    a = ruido(N, 0.8, 151); onda = 0.82 + 0.18 * np.sin(xx * 2 * np.pi * 24) ** 2
    img = np.array(color, float) * onda[..., None] * (0.9 + 0.2 * a[..., None])
    img[(yy < 0.03) | (yy > 0.97)] *= 0.6; return img
def tex_vidrio_cupula():
    u, v = (xx * 8) % 1, (yy * 8) % 1; img = col(ruido(N, 1.0, 161), (90, 140, 170), (140, 190, 210))
    img[(np.minimum(u, 1 - u) < 0.03) | (np.minimum(v, 1 - v) < 0.03)] = (200, 206, 214); return img
T = {k: TX['RB_' + k] for k in ('pasto', 'arena', 'roca', 'tierra', 'luna', 'asfalto', 'calle', 'vereda', 'agua', 'techo')}
for k in range(4): T['fach%d' % k] = TX['RB_fachada%d' % k]
for nom, f in [('hormigon', tex_hormigon), ('chapa', tex_chapa), ('franja', tex_franja), ('helipuerto', tex_helipuerto), ('marte', tex_marte), ('marte_roca', tex_marte_roca),
               ('cont_rojo', lambda: tex_contenedor((150, 46, 36))), ('cont_azul', lambda: tex_contenedor((40, 82, 138))), ('cont_verde', lambda: tex_contenedor((46, 112, 64))),
               ('cupula', tex_vidrio_cupula)]:
    T[nom] = textura(nom, f(), 512 if nom not in ('cont_rojo', 'cont_azul', 'cont_verde') else 256)

# ---------------- ayudantes nuevos ----------------
def mat(nom, tex, rep, pbr=None, tinte=None):
    """un material; con tinte, el color que multiplica a la textura (los «Mobile/» no lo usan: va como Legacy)"""
    mi = material('HS_' + nom, tex, rep, pbr)
    if tinte: d['mt'][mi]['sh'] = 'Legacy Shaders/Diffuse'; d['mt'][mi]['c'] = list(tinte) + [1.0]; d['mt'][mi]['cc']['_Color'] = list(tinte) + [1.0]
    return mi
def caja(m, mat_l, mat_t, c, t, metro=4.0):
    """una caja de lados mat_l y tapa mat_t (UV en metros / metro: el dibujo mide lo mismo en todas); c: centro de la base"""
    x0, x1, y0, y1, z0, z1 = c[0] - t[0] / 2, c[0] + t[0] / 2, c[1], c[1] + t[1], c[2] - t[2] / 2, c[2] + t[2] / 2
    U = lambda L: L / metro
    for a, b, cc, e, L in [((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1), t[0]), ((x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0), t[0]),
                           ((x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1), t[2]), ((x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0), t[2])]:
        m.quad(mat_l, a, b, cc, e, [(0, 0), (U(L), 0), (U(L), U(t[1])), (0, U(t[1]))])
    m.quad(mat_t, (x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0), [(0, 0), (U(t[0]), 0), (U(t[0]), U(t[2])), (0, U(t[2]))])
    m.quad(mat_t, (x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1), [(0, 0), (U(t[0]), 0), (U(t[0]), U(t[2])), (0, U(t[2]))])
    return {'k': 'b', 'c': [c[0], c[1] + t[1] / 2, c[2]], 's': list(t), 'tr': 0}
def cupula(m, mm, c, r, seg=24, anillos=8):
    """media esfera (vidrio con marco) apoyada en c"""
    P = lambda i, j: (c[0] + r * math.cos(j / anillos * math.pi / 2) * math.cos(i / seg * 2 * math.pi), c[1] + r * math.sin(j / anillos * math.pi / 2), c[2] + r * math.cos(j / anillos * math.pi / 2) * math.sin(i / seg * 2 * math.pi))
    for i in range(seg):
        for j in range(anillos):
            a, b, cc, e = P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)
            nn = np.array([(a[0] + cc[0]) / 2 - c[0], (a[1] + cc[1]) / 2 - c[1], (a[2] + cc[2]) / 2 - c[2]]); nn /= np.linalg.norm(nn)
            m.quad(mm, a, e, cc, b, [(i / 3, j / 3), (i / 3, (j + 1) / 3), ((i + 1) / 3, (j + 1) / 3), ((i + 1) / 3, j / 3)], n=nn)
def doble(m, mm, a, b, c, e, uv):
    """una cara que se ve de los dos lados (las dos vueltas)"""
    m.quad(mm, a, b, c, e, uv); m.quad(mm, e, c, b, a, [uv[3], uv[2], uv[1], uv[0]])
def choques(nombre, cols): return [nodo(nombre)] + [nodo('C%d' % k, pa=0, col=[c]) for k, c in enumerate(cols)]
def suelo_col(mi): return [{'k': 'm', 'm': mi, 'cv': 0, 'tr': 0}]
PISO = 0.53   # (la altura del piso donde se aparece, la de siempre)
def plano(L, centro_r, borde_alto, semilla, amp=0.0, suave=1.0):
    """altura: plano en PISO hasta centro_r, después ruido de amplitud amp, y sube en el borde (de lejos, no se ve el final)"""
    nz = ruido(129, 2.3, semilla)
    def h(X, Z):
        i = np.clip(((X + L / 2) / L * 128).round().astype(int), 0, 128); j = np.clip(((Z + L / 2) / L * 128).round().astype(int), 0, 128)
        r = np.sqrt(X * X + Z * Z); k = np.clip((r - centro_r) / (centro_r * suave + 1), 0, 1) ** 2
        rr = np.maximum(np.abs(X), np.abs(Z)); return PISO + (nz[j, i] - 0.5) * 2 * amp * k + np.clip((rr - L * 0.4) / (L * 0.1), 0, 1) ** 2 * borde_alto
    return h
def altura(H, g, x, z):
    i = int(np.clip(np.searchsorted(g, x), 1, len(g) - 1)); j = int(np.clip(np.searchsorted(g, z), 1, len(g) - 1)); return float(H[j, i])
def amb(nombre, sky, niebla, **x): ambiente(nombre, sky, niebla, **x)
listos = []
def mapa(nombre, esc): d['esc'][nombre] = esc; listos.append(nombre)

# ================= FlatGrass: pasto parejo de 1,5 km, lomas suaves en el borde =================
L = 1500; mP = mat('FG_Pasto', T['pasto'], L / 6); mR = mat('FG_Roca', T['roca'], L / 12)
mi, mats, H, g = terreno('HS_FlatGrass_Suelo', L, 128, plano(L, 520, 70, 201, amp=3, suave=0.6), lambda hm, ny: mP if ny > 0.8 else mR)
mapa('FlatGrass', [luz((-0.45, -0.75, 0.48), (1.0, 0.96, 0.88), 1.05), fijo('Suelo', mi, mats, col=suelo_col(mi)), bordes(L),
                   aparicion([(0, 1.395, 0), (4, 1.395, 0), (-4, 1.395, 0), (0, 1.395, 4)])])
amb('FlatGrass', cielo('HS_FlatGrass', [0.22, 0.52, 0.96], [0.84, 0.91, 0.98], [0.56, 0.62, 0.7], [1.0, 0.9, 0.74]), ((0.86, 0.91, 0.97), 280, 700))

# ================= Desert: médanos, una ruta que cruza, una estación de servicio y rocas grandes =================
L = 1200; mA = mat('DS_Arena', T['arena'], L / 8); mRo = mat('DS_Roca', T['roca'], L / 14); mAs = mat('DS_Asfalto', T['calle'], 1)
nD = ruido(129, 2.4, 211)
def h_desert(X, Z):
    i = np.clip(((X + L / 2) / L * 128).round().astype(int), 0, 128); j = np.clip(((Z + L / 2) / L * 128).round().astype(int), 0, 128)
    med = (np.sin(X * 0.035 + Z * 0.011 + nD[j, i] * 6) * 0.5 + 0.5) * 16 * (0.3 + nD[j, i])
    ruta = np.clip((np.abs(Z + 40) - 9) / 30, 0, 1); centro = np.clip((np.sqrt(X * X + Z * Z) - 45) / 60, 0, 1)
    rr = np.maximum(np.abs(X), np.abs(Z)); return PISO + med * ruta * centro + np.clip((rr - L * 0.4) / (L * 0.1), 0, 1) ** 2 * 60
mi, mats, H, g = terreno('HS_Desert_Suelo', L, 128, h_desert, lambda hm, ny: mRo if ny < 0.8 else mA)
ruta = Malla()
for k in range(24):   # (la ruta: tramos de 50 m sobre el plano, recta de punta a punta)
    x0 = -L / 2 + 30 + k * 47.5; ruta.quad(mAs, (x0, PISO + 0.03, -31), (x0 + 47.5, PISO + 0.03, -31), (x0 + 47.5, PISO + 0.03, -49), (x0, PISO + 0.03, -49), [(0, 0), (4, 0), (4, 1), (0, 1)], n=np.array([0, 1.0, 0]))
mr, mmr = ruta.guardar('HS_Desert_Ruta')
est = Malla(); cs = []
mF = mat('DS_Fachada', T['fach3'], 1); mTe = mat('DS_Techo', T['techo'], 1); mFr = mat('DS_Franja', T['franja'], 1); mHo = mat('DS_Hormigon', T['hormigon'], 1)
cs.append(caja(est, mHo, mHo, (40, PISO - 0.2, -14), (44, 0.24, 26)))               # (la playa de la estación)
cs.append(caja(est, mF, mTe, (52, PISO, -6), (16, 4.2, 10)))                          # (la tienda)
for x in (26, 36): cs.append(caja(est, mFr, mFr, (x, PISO, -16), (1.2, 1.1, 3.2)))    # (los surtidores)
cs.append(caja(est, mTe, mTe, (31, PISO + 5.0, -16), (20, 0.5, 9)))                   # (el techo de los surtidores, en el aire)
for x in (22.5, 39.5): cs.append(caja(est, mF, mF, (x, PISO, -16), (0.6, 5.0, 0.6)))
me, mme = est.guardar('HS_Desert_Estacion')
esc = [luz((-0.3, -0.85, 0.42), (1.0, 0.92, 0.78), 1.18), fijo('Suelo', mi, mats, col=suelo_col(mi)), fijo('Ruta', mr, mmr), fijo('Estacion', me, mme), choques('HS_Choques', cs), bordes(L)]
for k in range(22):
    a = rng.uniform(0, 6.28); r = rng.uniform(140, 470); x, z = math.cos(a) * r, math.sin(a) * r
    if abs(z + 40) < 30: continue
    esc.append(poner('Roca', (x, altura(H, g, x, z) - 2.5, z), rng.uniform(0, 6), rng.uniform(7, 16)))
for k in range(10): x = rng.uniform(-80, 80); z = rng.uniform(15, 60); esc.append(poner('Roca', (x, PISO - 0.2, z), rng.uniform(0, 6), rng.uniform(0.8, 2.2)))
esc.append(aparicion([(0, 1.395, 0), (4, 1.395, 0), (-4, 1.395, 0), (0, 1.395, 4)]))
mapa('Desert', esc)
amb('Desert', cielo('HS_Desert', [0.28, 0.52, 0.88], [0.96, 0.88, 0.74], [0.82, 0.7, 0.54], [1.0, 0.84, 0.62]), ((0.94, 0.86, 0.72), 300, 650))

# ================= DesertV2: un cañón entre mesetas de roca, con el cauce seco =================
L = 1100; mA2 = mat('D2_Arena', T['arena'], L / 8, tinte=(1.0, 0.86, 0.74)); mR2 = mat('D2_Roca', T['roca'], L / 10, tinte=(1.0, 0.72, 0.56)); mT2 = mat('D2_Tierra', T['tierra'], L / 10, tinte=(1.0, 0.8, 0.66))
nC = ruido(129, 2.1, 221)
def h_canion(X, Z):
    i = np.clip(((X + L / 2) / L * 128).round().astype(int), 0, 128); j = np.clip(((Z + L / 2) / L * 128).round().astype(int), 0, 128)
    cauce = 40 * np.sin(X / 150) + 25 * np.sin(X / 47 + 1)   # (el centro del cañón va serpenteando)
    ancho = 55 + 25 * nC[j, i]; dz = np.abs(Z - cauce) - ancho
    meseta = 34 + (nC[j, i] - 0.5) * 18; k = np.clip(dz / 12, 0, 1); k = k * k * (3 - 2 * k)
    escalon = np.clip((dz - 60) / 8, 0, 1) * 10   # (un segundo escalón más atrás)
    cerca = np.clip((np.sqrt(X * X + (Z - cauce) * (Z - cauce)) - 40) / 30, 0, 1)
    h = PISO + (k * meseta + escalon * k) * np.where(np.abs(X) < 40, cerca, 1)
    rr = np.maximum(np.abs(X), np.abs(Z)); return h + np.clip((rr - L * 0.42) / (L * 0.08), 0, 1) ** 2 * 50
mi, mats, H, g = terreno('HS_DesertV2_Suelo', L, 128, h_canion, lambda hm, ny: mR2 if ny < 0.72 else (mT2 if hm > 8 or ny < 0.93 else mA2))
esc = [luz((-0.55, -0.62, 0.55), (1.0, 0.86, 0.68), 1.15), fijo('Suelo', mi, mats, col=suelo_col(mi)), bordes(L)]
for k in range(30):
    x = rng.uniform(-420, 420); cz = 40 * math.sin(x / 150) + 25 * math.sin(x / 47 + 1); z = cz + rng.uniform(-35, 35)
    esc.append(poner('Roca', (x, altura(H, g, x, z) - 0.6, z), rng.uniform(0, 6), rng.uniform(1.2, 4.5)))
esc.append(aparicion([(0, 1.395, 25.8), (4, 1.395, 25.8), (-4, 1.395, 25.8)]))
mapa('DesertV2', esc)
amb('DesertV2', cielo('HS_DesertV2', [0.32, 0.5, 0.82], [0.98, 0.84, 0.68], [0.86, 0.66, 0.5], [1.0, 0.8, 0.58]), ((0.96, 0.84, 0.7), 260, 600))

# ================= City: grilla de 6 × 6 manzanas, rascacielos en el centro y una plaza =================
mC = mat('CT_Calle', T['calle'], 1); mV = mat('CT_Vereda', T['vereda'], 1); mAsf = mat('CT_Asfalto', T['asfalto'], 1)
mFa = [mat('CT_Fachada%d' % k, T['fach%d' % k], 1) for k in range(4)]; mTe = mat('CT_Techo', T['techo'], 1); mPa = mat('CT_Pasto', T['pasto'], 1)
B, CALLE, NB = 80, 16, 6; LC = NB * B + (NB + 1) * CALLE; x0 = -LC / 2
ciudad = Malla(); cs = []
a_m = lambda i: x0 + CALLE + i * (B + CALLE)
for i in range(NB + 1):   # (las calles: tramos de 16 × 16 con la textura de la calle, en las dos direcciones)
    for k in range(int(LC / 16)):
        c = x0 + i * (B + CALLE); t0 = x0 + k * 16
        ciudad.quad(mC, (c, PISO, t0), (c + CALLE, PISO, t0), (c + CALLE, PISO, t0 + 16), (c, PISO, t0 + 16), [(0, 0), (1, 0), (1, 1), (0, 1)], n=np.array([0, 1.0, 0]))
        if not (any(c2 <= t0 < c2 + CALLE for c2 in [x0 + q * (B + CALLE) for q in range(NB + 1)])):
            ciudad.quad(mC, (t0, PISO, c + CALLE), (t0 + 16, PISO, c + CALLE), (t0 + 16, PISO, c), (t0, PISO, c), [(0, 0), (1, 0), (1, 1), (0, 1)], n=np.array([0, 1.0, 0]))
plaza = (NB // 2 - 1, NB // 2 - 1)   # (la manzana de la plaza, junto al centro)
for i in range(NB):
    for j in range(NB):
        ax, az = a_m(i), a_m(j)
        cs.append(caja(ciudad, mV, mV, (ax + B / 2, PISO, az + B / 2), (B, 0.18, B), metro=2))   # (la vereda: toda la manzana un escalón arriba)
        if (i, j) == plaza:
            ciudad.quad(mPa, (ax + 8, PISO + 0.2, az + B - 8), (ax + B - 8, PISO + 0.2, az + B - 8), (ax + B - 8, PISO + 0.2, az + 8), (ax + 8, PISO + 0.2, az + 8), [(0, 0), (16, 0), (16, 16), (0, 16)], n=np.array([0, 1.0, 0]))
            continue
        dc = math.hypot(ax + B / 2, az + B / 2) / (LC / 2)   # (más altos en el centro)
        for (u, v, w, p) in [(0, 0, 0.5, 0.5), (0.5, 0, 0.5, 0.5), (0, 0.5, 0.5, 0.5), (0.5, 0.5, 0.5, 0.5)]:
            if rng.random() < 0.18: continue   # (algún terreno baldío)
            bx, bz = ax + 4 + u * (B - 8), az + 4 + v * (B - 8); bw, bd = w * (B - 8) - 4, p * (B - 8) - 4
            alto = float(np.clip(rng.gamma(2.0, 9) * (1.7 - dc) + 7, 7, 95)); alto = round(alto / 3.5) * 3.5
            cs.append(caja(ciudad, mFa[int(rng.integers(4))], mTe, (bx + bw / 2 + 2, PISO + 0.18, bz + bd / 2 + 2), (bw, alto, bd)))
mi, mats = ciudad.guardar('HS_City')
esc = [luz((-0.42, -0.72, 0.55), (1.0, 0.95, 0.85), 1.05), bordes(LC + 60)]
pl = Malla(); pl.quad(mAsf, (-LC / 2 - 30, PISO - 0.01, LC / 2 + 30), (LC / 2 + 30, PISO - 0.01, LC / 2 + 30), (LC / 2 + 30, PISO - 0.01, -LC / 2 - 30), (-LC / 2 - 30, PISO - 0.01, -LC / 2 - 30), [(0, 0), (40, 0), (40, 40), (0, 40)], n=np.array([0, 1.0, 0]))
mp_, mmp = pl.guardar('HS_City_Piso')
esc += [fijo('Piso', mp_, mmp, col=suelo_col(mp_)), fijo('Ciudad', mi, mats), choques('HS_Choques', cs)]
px, pz = a_m(plaza[0]) + B / 2, a_m(plaza[1]) + B / 2
for k in range(10): a = k / 10 * 2 * math.pi; esc.append(poner('Palmera', (px + math.cos(a) * 26, PISO + 0.2, pz + math.sin(a) * 26), a, 1.2))
for k in range(8): a = (k + 0.5) / 8 * 2 * math.pi; esc.append(poner('Banco', (px + math.cos(a) * 15, PISO + 0.2, pz + math.sin(a) * 15), -a + math.pi / 2))
for i in range(NB):
    for k in range(4): esc.append(poner('Farol', (a_m(i) + 10 + k * 20, PISO + 0.18, x0 + CALLE + 1.5 + (NB // 2) * (B + CALLE) - CALLE - 3), 0))
for i in range(1, NB):
    for j in range(1, NB): esc.append(poner('Semaforo', (x0 + i * (B + CALLE) - 1.5, PISO + 0.18, x0 + j * (B + CALLE) - 1.5), 0.0))
esc.append(aparicion([(0, 1.395, 0), (px, 1.6, pz - 6), (px + 4, 1.6, pz - 6), (px - 4, 1.6, pz - 6), (px, 1.6, pz + 6), (px + 6, 1.6, pz), (px - 6, 1.6, pz), (4, 1.395, 0)]))
mapa('City', esc)
amb('City', cielo('HS_City', [0.3, 0.56, 0.94], [0.86, 0.9, 0.95], [0.6, 0.64, 0.7], [1.0, 0.88, 0.72]), ((0.82, 0.86, 0.92), 320, 720))

# ================= Base: una base con muro, torres, hangares, torre de control, helipuerto y pista =================
def base_militar(nombre, semilla, grande):
    L = 1100; mPs = mat(nombre + '_Pasto', T['pasto'], L / 6, tinte=(0.92, 0.94, 0.8)); mTi = mat(nombre + '_Tierra', T['tierra'], L / 10)
    h0 = plano(L, 330 if grande else 260, 60, semilla, amp=6, suave=0.8)
    R = 230 if grande else 170   # (medio lado del muro)
    # (debajo de la base el terreno baja 35 cm: el piso de hormigón va arriba con su choque, sin titilar contra el pasto; la
    # grande además tiene una bahía al este, para el puerto)
    h = lambda X, Z: h0(X, Z) - 0.35 * (np.maximum(np.abs(X), np.abs(Z)) < R + 6) - (np.clip((X - 292) / 14, 0, 1) * 6 if grande else 0)
    mi, mats, H, g = terreno('HS_%s_Suelo' % nombre, L, 128, h, lambda hm, ny: mPs if ny > 0.86 else (mTi if hm > PISO - 1 else mTi))
    m = Malla(); cs = []; mHo = mat(nombre + '_Hormigon', T['hormigon'], 1); mFr = mat(nombre + '_Franja', T['franja'], 1); mMe = mat(nombre + '_Hangar', T['cont_verde'], 1, tinte=(0.78, 0.8, 0.74))
    mCh = mat(nombre + '_Chapa', T['chapa'], 1); mHe = mat(nombre + '_Helipuerto', T['helipuerto'], 1); mPi = mat(nombre + '_Pista', T['calle'], 1); mTe = mat(nombre + '_Techo', T['techo'], 1)
    mFh = mat(nombre + '_Fach', T['fach1'], 1)
    cs.append({'k': 'b', 'c': [0, PISO - 0.25, 0], 's': [2 * R + 10, 0.5, 2 * R + 10], 'tr': 0})   # (el piso de la base)
    m.quad(mHo, (-R - 5, PISO, R + 5), (R + 5, PISO, R + 5), (R + 5, PISO, -R - 5), (-R - 5, PISO, -R - 5), [(0, 0), (2 * R / 4, 0), (2 * R / 4, 2 * R / 4), (0, 2 * R / 4)], n=np.array([0, 1.0, 0]))
    # el muro con franja arriba y un portón al sur; torres en las esquinas
    for lado in range(4):
        for k in range(int(2 * R / 20)):
            t0 = -R + k * 20
            if lado == 0 and -20 <= t0 < 20: continue   # (el portón)
            c = [(t0 + 10, PISO, -R), (t0 + 10, PISO, R), (-R, PISO, t0 + 10), (R, PISO, t0 + 10)][lado]; t = (20, 3.4, 1.2) if lado < 2 else (1.2, 3.4, 20)
            cs.append(caja(m, mHo, mFr, c, t, metro=3.4))
    for sx in (-1, 1):
        for sz in (-1, 1):
            cs.append(caja(m, mHo, mHo, (sx * R, PISO, sz * R), (6, 9, 6)))
            cs.append(caja(m, mFr, mTe, (sx * R, PISO + 9, sz * R), (7.5, 2.2, 7.5)))
    # hangares (cajas grandes de chapa), la torre de control, galpones, la pista y el helipuerto
    nh = 5 if grande else 3
    for k in range(nh): cs.append(caja(m, mMe, mTe, (-R + 40 + k * 46, PISO, R - 50), (38, 13, 34), metro=13))   # (chapa acanalada: una vuelta de la textura por alto)
    cs.append(caja(m, mFh, mTe, (R - 40, PISO, R - 40), (12, 26, 12)))
    cs.append(caja(m, mCh, mFr, (R - 40, PISO + 26, R - 40), (16, 5, 16), metro=2.5))
    for k in range(4 if grande else 2): cs.append(caja(m, mFh, mTe, (-R + 30, PISO, -R + 40 + k * 32), (24, 7, 18)))
    for k in range(int(2 * R / 40) - 1):
        x = -R + 40 + k * 40; m.quad(mPi, (x, PISO + 0.04, -R + 100), (x + 40, PISO + 0.04, -R + 100), (x + 40, PISO + 0.04, -R + 70), (x, PISO + 0.04, -R + 70), [(0, 0), (2.5, 0), (2.5, 1), (0, 1)], n=np.array([0, 1.0, 0]))
    for (hx, hz) in ([(60, 40), (100, 40)] if grande else [(60, 40)]):
        m.quad(mHe, (hx - 12, PISO + 0.06, hz + 12), (hx + 12, PISO + 0.06, hz + 12), (hx + 12, PISO + 0.06, hz - 12), (hx - 12, PISO + 0.06, hz - 12), [(0, 0), (1, 0), (1, 1), (0, 1)], n=np.array([0, 1.0, 0]))
    mb, mmb = m.guardar('HS_%s_Base' % nombre)
    esc = [luz((-0.5, -0.72, 0.48), (1.0, 0.95, 0.86), 1.08), fijo('Suelo', mi, mats, col=suelo_col(mi)), fijo('Base', mb, mmb), choques('HS_Choques', cs), bordes(L)]
    # contenedores, barriles y cajas fijos
    for k in range(10 if grande else 6):
        x, z = -R + 40 + (k % 5) * 14, -R + 140 + (k // 5) * 8; esc.append(poner('Contenedor', (x, PISO, z), 0.0 if k % 2 else math.pi, 1.0))
    for k in range(12): x, z = rng.uniform(-60, 60), rng.uniform(80, 140); esc.append(poner('Barrel', (x, PISO, z), rng.uniform(0, 6)))
    sp = [(0, 1.395, 0), (4, 1.395, 0), (-4, 1.395, 0), (0, 1.395, 4), (8, 1.395, 0), (-8, 1.395, 0), (0, 1.395, -4), (4, 1.395, 4)]
    esc.append(aparicion(sp))
    return esc
mapa('Base', base_militar('Base', 231, False))
amb('Base', cielo('HS_Base', [0.24, 0.5, 0.9], [0.82, 0.88, 0.94], [0.56, 0.6, 0.66], [1.0, 0.9, 0.76]), ((0.8, 0.85, 0.9), 280, 650))
# ================= BaseV2: la base grande, con un puerto de contenedores y agua =================
esc = base_militar('BaseV2', 241, True)
mAg = mat('B2_Agua', T['agua'], 1); mCo = [mat('B2_Cont%d' % k, T[n], 1) for k, n in enumerate(('cont_rojo', 'cont_azul', 'cont_verde'))]; mHo2 = mat('B2_Muelle', T['hormigon'], 1)
pto = Malla(); cs = []
pto.quad(mAg, (300, PISO - 1.6, 520), (560, PISO - 1.6, 520), (560, PISO - 1.6, -520), (300, PISO - 1.6, -520), [(0, 0), (26, 0), (26, 104), (0, 104)], n=np.array([0, 1.0, 0]))
cs.append(caja(pto, mHo2, mHo2, (280, PISO - 3, 0), (40, 3, 300)))   # (el muelle)
for k in range(48):   # (pilas de contenedores de 12 × 2,5 × 2,6)
    fx, fz, nivel = k % 4, (k // 4) % 6, k // 24
    if nivel and rng.random() < 0.35: continue
    cs.append(caja(pto, mCo[int(rng.integers(3))], mCo[0], (268 + fx * 2.8, PISO + nivel * 2.6, -80 + fz * 13), (2.5, 2.6, 12), metro=2.6))
mpt, mmpt = pto.guardar('HS_BaseV2_Puerto')
esc += [fijo('Puerto', mpt, mmpt), choques('HS_Choques2', cs)]
mapa('BaseV2', esc)
amb('BaseV2', cielo('HS_BaseV2', [0.26, 0.5, 0.86], [0.84, 0.88, 0.92], [0.58, 0.62, 0.66], [1.0, 0.88, 0.74]), ((0.8, 0.84, 0.88), 300, 680))

# ================= Mars: suelo rojo con cráteres, rocas y una base con cúpulas =================
L = 1100; mMa = mat('MA_Suelo', T['marte'], L / 7); mMr = mat('MA_Roca', T['marte_roca'], L / 12)
crs = [(rng.uniform(-420, 420), rng.uniform(-420, 420), rng.uniform(14, 80)) for _ in range(40)]
nM = ruido(129, 2.2, 251)
def h_marte(X, Z):
    i = np.clip(((X + L / 2) / L * 128).round().astype(int), 0, 128); j = np.clip(((Z + L / 2) / L * 128).round().astype(int), 0, 128)
    h = (nM[j, i] - 0.5) * 18
    for cx, cz, r in crs:
        dd = np.sqrt((X - cx) ** 2 + (Z - cz) ** 2) / r
        h += np.where(dd < 1, -(1 - dd ** 2) * r * 0.14, 0) + np.exp(-((dd - 1) / 0.16) ** 2) * r * 0.05
    cen = np.clip((np.sqrt(X * X + Z * Z) - 50) / 70, 0, 1); rr = np.maximum(np.abs(X), np.abs(Z))
    return PISO + h * cen + np.clip((rr - L * 0.4) / (L * 0.1), 0, 1) ** 2 * 70
mi, mats, H, g = terreno('HS_Mars_Suelo', L, 128, h_marte, lambda hm, ny: mMr if ny < 0.82 else mMa)
mb_ = Malla(); cs = []; mCu = mat('MA_Cupula', T['cupula'], 1); mMo = mat('MA_Modulo', T['fach2'], 1, tinte=(0.92, 0.92, 0.95)); mCh = mat('MA_Chapa', T['chapa'], 1); mFr = mat('MA_Franja', T['franja'], 1)
cs.append(caja(mb_, mCh, mCh, (22, PISO - 0.3, 18), (40, 0.5, 34), metro=2))
for (cx, cz, r) in ((14, 14, 7), (32, 22, 5.5)): cupula(mb_, mCu, (cx, PISO + 0.2, cz), r); cs.append({'k': 'b', 'c': [cx, PISO + 0.2 + r * 0.35, cz], 's': [r * 1.4, r * 0.7, r * 1.4], 'tr': 0})
for (cx, cz, t) in ((24, 8, (6, 3.2, 10)), (34, 10, (10, 3.2, 5))): cs.append(caja(mb_, mMo, mFr, (cx, PISO + 0.2, cz), t, metro=3.2))
cs.append(caja(mb_, mMo, mFr, (6, PISO + 0.2, 30), (1.2, 18, 1.2)))   # (la antena)
mbm, mmbm = mb_.guardar('HS_Mars_Base')
esc = [luz((-0.5, -0.7, 0.5), (1.0, 0.86, 0.74), 1.12), fijo('Suelo', mi, mats, col=suelo_col(mi)), fijo('Base', mbm, mmbm), choques('HS_Choques', cs), bordes(L)]
for k in range(36):
    x, z = rng.uniform(-380, 380, 2)
    if x * x + z * z < 70 * 70: continue
    esc.append(poner('Roca', (x, altura(H, g, x, z) - 0.4, z), rng.uniform(0, 6), rng.uniform(0.8, 5)))
esc.append(aparicion([(0, 1.395, 0), (4, 1.395, 0), (-4, 1.395, 0), (0, 1.395, -4)]))
mapa('Mars', esc)
amb('Mars', cielo('HS_Mars', [0.62, 0.44, 0.34], [0.92, 0.7, 0.52], [0.78, 0.52, 0.38], [1.0, 0.86, 0.7]), ((0.88, 0.66, 0.5), 220, 560))

# ================= Space: una estación propia — cubierta octogonal, puentes, plataformas, un anillo y asteroides =================
mCh = mat('SP_Chapa', T['chapa'], 1); mFr = mat('SP_Franja', T['franja'], 1); mMe = mat('SP_Metal', T['fach2'], 1, tinte=(0.82, 0.86, 0.95)); mTe = mat('SP_Techo', T['techo'], 1)
est = Malla(); cs = []
def octogono(m, mm, c, r, alto, metro=2.0):
    """una cubierta octogonal (arriba en c[1]) con su canto"""
    P = [(c[0] + r * math.cos((k + 0.5) / 8 * 2 * math.pi), c[2] + r * math.sin((k + 0.5) / 8 * 2 * math.pi)) for k in range(8)]
    for k in range(8):
        a, b = P[k], P[(k + 1) % 8]
        m.quad(mm, (c[0], c[1], c[2]), (b[0], c[1], b[1]), (b[0], c[1], b[1]), (a[0], c[1], a[1]), [(c[0] / metro, c[2] / metro), (b[0] / metro, b[1] / metro), (b[0] / metro, b[1] / metro), (a[0] / metro, a[1] / metro)], n=np.array([0, 1.0, 0]))
        m.quad(mFr, (a[0], c[1], a[1]), (b[0], c[1], b[1]), (b[0], c[1] - alto, b[1]), (a[0], c[1] - alto, a[1]), [(0, 0), (math.dist(a, b) / 2, 0), (math.dist(a, b) / 2, 0.5), (0, 0.5)])
    return {'k': 'b', 'c': [c[0], c[1] - alto / 2, c[2]], 's': [r * 1.85, alto, r * 1.85], 'tr': 0}
cs.append(octogono(est, mCh, (0, PISO, 0), 46, 3))
for k in range(4):   # (cuatro puentes a cuatro plataformas)
    a = k * math.pi / 2; cx, cz = math.cos(a) * 110, math.sin(a) * 110
    cs.append(octogono(est, mCh, (cx, PISO, cz), 20, 2.5))
    mx, mz = math.cos(a) * 67, math.sin(a) * 67; t = (48, 0.8, 7) if k % 2 == 0 else (7, 0.8, 48)
    cs.append(caja(est, mFr, mCh, (mx, PISO - 0.8, mz), t, metro=2))
    for s in (-1, 1):   # (barandas)
        bx, bz = (mx, mz + s * 3.6) if k % 2 == 0 else (mx + s * 3.6, mz); bt = (48, 1.1, 0.25) if k % 2 == 0 else (0.25, 1.1, 48)
        cs.append(caja(est, mMe, mFr, (bx, PISO, bz), bt, metro=1.1))
cs.append(caja(est, mMe, mTe, (0, PISO, 0), (10, 24, 10)))            # (la torre del medio)
cs.append(caja(est, mCh, mFr, (0, PISO + 24, 0), (18, 4, 18), metro=2))
for k in range(28):   # (el anillo: una puerta de 60 m de diámetro, parada, del lado de +z)
    a0, a1 = k / 28 * 2 * math.pi, (k + 1) / 28 * 2 * math.pi; rr, cy = 30, PISO + 34
    p0 = (math.cos(a0) * rr, cy + math.sin(a0) * rr); p1 = (math.cos(a1) * rr, cy + math.sin(a1) * rr); mxm = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
    for zz in (-2.5, 2.5): doble(est, mMe, (p0[0], p0[1], 150 + zz), (p1[0], p1[1], 150 + zz), (p1[0] * 1.12, cy + (p1[1] - cy) * 1.12, 150 + zz), (p0[0] * 1.12, cy + (p0[1] - cy) * 1.12, 150 + zz), [(0, 0), (2, 0), (2, 1), (0, 1)])
    doble(est, mFr, (p0[0], p0[1], 152.5), (p0[0], p0[1], 147.5), (p1[0], p1[1], 147.5), (p1[0], p1[1], 152.5), [(0, 0), (1, 0), (1, 1), (0, 1)])
    doble(est, mMe, (p0[0] * 1.12, cy + (p0[1] - cy) * 1.12, 147.5), (p0[0] * 1.12, cy + (p0[1] - cy) * 1.12, 152.5), (p1[0] * 1.12, cy + (p1[1] - cy) * 1.12, 152.5), (p1[0] * 1.12, cy + (p1[1] - cy) * 1.12, 147.5), [(0, 0), (1, 0), (1, 1), (0, 1)])
cs.append({'k': 'b', 'c': [0, PISO + 1, 150], 's': [8, 2, 6], 'tr': 0})
mst, mmst = est.guardar('HS_Space_Estacion')
esc = [luz((-0.4, -0.6, 0.65), (1.0, 1.0, 0.97), 1.2), fijo('Estacion', mst, mmst), choques('HS_Choques', cs), bordes(1400, 900)]
for k in range(40):   # (asteroides alrededor, fijos)
    a, el, r = rng.uniform(0, 6.28), rng.uniform(-0.5, 0.6), rng.uniform(170, 520)
    esc.append(poner('Roca', (math.cos(a) * r * math.cos(el), PISO + r * math.sin(el) * 0.6, math.sin(a) * r * math.cos(el)), rng.uniform(0, 6), rng.uniform(4, 22)))
esc.append(aparicion([(0, 1.395, 14), (4, 1.395, 14), (-4, 1.395, 14), (0, 1.395, 18)]))   # (afuera de la torre del medio)
mapa('Space', esc)
amb('Space', cielo('HS_Space', [0.0, 0.0, 0.01], [0.01, 0.01, 0.02], [0.02, 0.02, 0.03], [0.95, 0.95, 0.95]), None, ai=1.25, espacio=1, ambRB=[[0.3, 0.3, 0.34], [0.2, 0.2, 0.24]])

# ---------------- las fotos de los mapas (el menú): sacadas del juego con los mapas nuevos (herramientas/fotos_mapas_hs, con
# pruebas/fotos_mapas_hs.mjs); van con el mismo nombre que las de antes, así el menú no cambia ----------------
FOTOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fotos_mapas_hs')
ICONO = {'Desert': 'Desert', 'DesertV2': 'desert 1', 'FlatGrass': 'flatgrass', 'City': 'city', 'Base': 'base', 'BaseV2': 'basev2', 'Mars': 'Mars', 'Space': 'Space'}
for k, ic in ICONO.items():
    f = os.path.join(FOTOS, k + '.webp'); st = d['ico'].get(ic)
    if not os.path.exists(f) or st is None: continue
    dst = os.path.join(PK1, 'i', st + '.webp')
    if os.path.exists(dst): os.remove(dst)   # (es un vínculo al paquete de origen: no se escribe encima)
    open(dst, 'wb').write(open(f, 'rb').read())
# ---------------- sacar lo de Hyper Sandbox que ya no usa nadie ----------------
# (las mallas y las texturas que sólo usaban los mapas viejos: las mallas se vacían —sus bytes a cero, que comprimidos no
# pesan— y las texturas quedan de 4 × 4. Los cielos viejos se dejan: los mapas de GMod copian el del FlatGrass)
def refs(o, M, MT):
    if isinstance(o, dict):
        if isinstance(o.get('m'), int): M.add(o['m'])
        for x in o.get('mt') or []:
            if isinstance(x, int): MT.add(x)
        for v in o.values():
            if isinstance(v, (list, dict)): refs(v, M, MT)
    elif isinstance(o, list):
        for v in o: refs(v, M, MT)
MV, MTV = set(), set(); refs(VIEJOS, MV, MTV)
MU, MTU = set(), set()
for k, v in d.items():
    if k not in ('ms', 'mt', 'tx'): refs(v, MU, MTU)
MTU |= {x for x in CIELOS_VIEJOS if isinstance(x, int)}
for a in list(MU):
    for l in d['ms'][a].get('lods') or []: MU.add(l)
for a in list(MV):
    for l in d['ms'][a].get('lods') or []: MV.add(l)
quitar_m = sorted(MV - MU); bytes_q = 0
for i in quitar_m:
    m = d['ms'][i]
    if m.get('o') is None: continue
    n_i = max([s0 + sn for s0, sn in m.get('sub') or []] + [s0 + sn for l in (m.get('lod') or []) for s0, sn in l.get('sub', [])] + [0])   # (como mallaGL: hasta el último índice)
    w = 4 if m.get('i32') else 2
    for a, b in ((m['o'], m['o'] + m['v'] * 14), (m['i'], m['i'] + n_i * w)):
        BIN[a:b] = bytes(b - a); bytes_q += b - a
    d['ms'][i] = {'n': m['n'] + ' (quitada)', 'o': None, 'v': 0, 'mn': [0, 0, 0], 'sc': [1, 1, 1], 'i': 0, 'i32': False, 'sub': []}
def tex_de(mt):
    out = set()
    if isinstance(mt.get('t'), int): out.add(mt['t'])
    for v in (mt.get('tt') or {}).values():
        if isinstance(v, list) and v and isinstance(v[0], int): out.add(v[0])
    return out
TU = set()
for i, mt in enumerate(d['mt']):
    if i not in (MTV - MTU): TU |= tex_de(mt)
quitar_t = sorted({t for i in (MTV - MTU) for t in tex_de(d['mt'][i])} - TU)
for t in quitar_t:
    f = PK1 + '/t/%d.webp' % t
    if os.path.exists(f): os.remove(f)
    Image.new('RGB', (4, 4), (128, 128, 128)).save(f, 'WEBP', quality=50); d['tx'][t]['w'] = d['tx'][t]['h'] = 4
print('quitado de Hyper Sandbox:', len(quitar_m), 'mallas (%.1f MB)' % (bytes_q / 1e6), len(quitar_t), 'texturas')
open(PK1 + '/m.bin.gz', 'wb').write(gzip.compress(bytes(BIN), 6))
open(PK1 + '/d.json.gz', 'wb').write(gzip.compress(json.dumps(d, separators=(',', ':')).encode(), 6))
print('mapas:', listos, 'texturas', len(d['tx']), 'mallas', len(d['ms']), 'bin', len(BIN))
