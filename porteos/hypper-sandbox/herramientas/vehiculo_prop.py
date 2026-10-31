# Un prop hecho con prop_glb.py → vehículo de dos ruedas (como la moto del juego): le agrega el controlador, el asiento,
# los puntos de las ruedas (de donde sale el rayo de la suspensión), la tobera del cohete y un choque de caja en el
# cuadro (por arriba de las ruedas: lo sostiene la suspensión, no la caja). Los lugares van como fracciones de la caja
# del modelo: z de atrás (0) a adelante (1), y del piso (0) al techo (1).
# Uso: python3 -I vehiculo_prop.py PAQUETE Nombre masa asiento=z,y ruedas=zAtras,zAdelante tobera=z,y [art=nombre] [menu=Cat/Sección]
import sys, json, gzip
PK, nom, masa = sys.argv[1], sys.argv[2], float(sys.argv[3])
op = dict(a.split('=', 1) for a in sys.argv[4:])
d = json.load(gzip.open(PK + '/d.json.gz'))
key = next(k for k in d['pf'] if k.split('#')[0] == nom); N = d['pf'][key]
mi = next(n['m'] for n in N if 'm' in n); ms = d['ms'][mi]; mn, sc = ms['mn'], ms['sc']
Z = lambda f: mn[2] + sc[2] * f; Y = lambda f: mn[1] + sc[1] * f
raiz = N[0]; raiz['mb'] = ['PhotonView', 'RB_Controller', 'Vehicle', 'PhotonTransformViewClassic']; raiz['rb']['m'] = masa
if 'art' in op: raiz['rb']['art'] = op['art']
del N[2:]   # (por si se corre dos veces)
def nodo(n, p): N.append({'n': n, 'p': [round(x, 4) for x in p], 'r': [0, 0, 0, 1], 's': [1, 1, 1], 'pa': 0, 'tg': 20000})
az, ay = map(float, op['asiento'].split(',')); nodo('SitPoint', [0, Y(ay), Z(az)])
# la suspensión de la moto: el rayo sale 0,38 m arriba del punto y mide 0,63; quieto, con esta masa, comprime
# m·g/(2·15000): el punto va a 0,25 m menos eso sobre el piso (la base de las ruedas) para que apoyen justo
h = 0.25 - masa * 9.81 / 30000
zr, zf = map(float, op['ruedas'].split(',')); nodo('RearRayPos', [0, h, Z(zr)]); nodo('FrontRayPos', [0, h, Z(zf)])
tz, ty = map(float, op['tobera'].split(',')); nodo('CoheteTobera', [0, Y(ty), Z(tz) - 0.05])
# el choque: una caja en el cuadro, del 30 al 90 % de la altura
N[1]['col'] = [{'k': 'b', 's': [round(sc[0] * 0.55, 3), round(sc[1] * 0.6, 3), round(sc[2] * 0.92, 3)], 'c': [0, round(Y(0.6), 3), round(Z(0.5), 3)], 'tr': 0}]
# en el menú: Vehículos → la sección pedida (menu=Vehicles/Motorcycle)
if 'menu' in op:
    cn, sn = op['menu'].split('/'); c = next(x for x in d['menu'] if x['n'] == cn); sb = next((x for x in c['sub'] if x['n'] == sn), None)
    if sb is None: sb = {'n': sn, 'it': []}; c['sub'].append(sb)
    if nom not in sb['it']: sb['it'].append(nom)
open(PK + '/d.json.gz', 'wb').write(gzip.compress(json.dumps(d, separators=(',', ':')).encode(), 6))
print(nom, 'vehículo: masa', masa, 'nodos', [n['n'] for n in N], 'caja', N[1]['col'])
