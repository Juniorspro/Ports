# decodifica los clips de captura de movimiento del juego (formato RBE2 de emotes.js: emoBin) y mide la cadera
import gzip, json, sys, os, numpy as np
CMU = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', '..', 'web', 'emotes', 'cmu') + '/'
CAT = json.load(open(CMU + 'catalogo.json', encoding='utf-8'))
def leer(k):
    u = open(CMU + k + '.bin', 'rb').read()
    try: u = gzip.decompress(u)
    except Exception: pass
    u = np.frombuffer(u, np.uint8)
    assert bytes(u[:4]) == b'RBE2', bytes(u[:4])
    nf = int(u[4]) | int(u[5]) << 8; fps = int(u[6]); loop = int(u[7]); nb = int(u[8])
    b = [CAT['huesos'][int(u[9 + i])] for i in range(nb)]
    n = nf * nb * 4; m = nf * 3; o = 9 + nb; F = nb * 4
    lo = u[o:o + n].astype(np.int32); hi = u[o + n:o + 2 * n].astype(np.int32)
    d = ((lo | (hi << 8)) << 16 >> 16).astype(np.int64)
    d = d.reshape(nf, F)
    acc = np.cumsum(d, axis=0); acc = ((acc + 32768) % 65536) - 32768   # (int16 que se envuelve)
    r = (acc * 4).astype(np.float64)
    r = ((r + 32768) % 65536) - 32768
    o2 = o + 2 * n
    lo2 = u[o2:o2 + m].astype(np.int32); hi2 = u[o2 + m:o2 + 2 * m].astype(np.int32)
    d2 = ((lo2 | (hi2 << 8)) << 16 >> 16).astype(np.int64).reshape(nf, 3)
    h = np.cumsum(d2, axis=0); h = ((h + 32768) % 65536) - 32768
    return dict(nf=nf, fps=fps, loop=loop, b=b, r=r.reshape(nf, nb, 4) / 32767.0, h=h.astype(np.float64) / 1000.0)
def yaw_hips(c):
    i = c['b'].index('Hips'); q = c['r'][:, i, :]; x, y, z, w = q[:, 0], q[:, 1], q[:, 2], q[:, 3]
    # dirección de adelante (eje z local) proyectada al piso
    fx = 2 * (x * z + w * y); fz = 1 - 2 * (x * x + y * y)
    return np.degrees(np.arctan2(fx, fz))
if __name__ == '__main__':
    for k in sys.argv[1:]:
        c = leer(k); h = c['h']; dur = (c['nf'] - 1) / c['fps']
        d = h[-1] - h[0]; viaje = np.hypot(d[0], d[2]); camino = np.sum(np.hypot(np.diff(h[:, 0]), np.diff(h[:, 2])))
        v = np.hypot(np.diff(h[:, 0]), np.diff(h[:, 2])) * c['fps']
        yw = yaw_hips(c)
        nombre = [x[1] for x in CAT['items'] if x[0] == k][0]
        print(f"{k:7s} {nombre[:28]:28s} {dur:5.2f}s fps{c['fps']} viaje {viaje:5.2f} m camino {camino:5.2f} m vel {np.median(v):4.2f} m/s (p10 {np.percentile(v,10):4.2f} p90 {np.percentile(v,90):4.2f}) rumbo {np.degrees(np.arctan2(d[0], d[2])):6.1f}° giro cadera {yw.min():6.1f}..{yw.max():6.1f} alto cadera {h[:,1].mean():.2f}")
