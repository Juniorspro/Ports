# Lector mínimo de GLB (glTF binario): JSON, accesores, matrices de los nodos (y su cinemática directa) y animaciones.
import json, struct, numpy as np
TIPOS = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
COMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def leer(ruta):
    b = open(ruta, 'rb').read()
    assert b[:4] == b'glTF', 'no es GLB'
    L = struct.unpack_from('<I', b, 12)[0]; J = json.loads(b[20:20 + L])
    o = 20 + L; L2 = struct.unpack_from('<I', b, o)[0]; B = b[o + 8:o + 8 + L2]
    return J, B
def acc(J, B, i):
    a = J['accessors'][i]; bv = J['bufferViews'][a['bufferView']]; t = TIPOS[a['componentType']]; n = COMP[a['type']]
    o = bv.get('byteOffset', 0) + a.get('byteOffset', 0); paso = bv.get('byteStride'); isz = np.dtype(t).itemsize
    if paso and paso != n * isz:
        x = np.stack([np.frombuffer(B, t, n, o + k * paso) for k in range(a['count'])])
    else:
        x = np.frombuffer(B, t, a['count'] * n, o).reshape(a['count'], n)
    x = x.astype(np.float64)
    if a.get('normalized'):
        x = x / {np.uint8: 255, np.uint16: 65535, np.int8: 127, np.int16: 32767}.get(t, 1)
    return x if n != 16 else x.reshape(-1, 4, 4).transpose(0, 2, 1)   # MAT4: columnas → filas
def q2m(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
def m2q(m):
    m = m / np.linalg.norm(m, axis=0)
    t = m[0, 0] + m[1, 1] + m[2, 2]
    if t > 0: s = np.sqrt(t + 1) * 2; return np.array([(m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s, 0.25 * s])
    if m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]: s = np.sqrt(1 + m[0, 0] - m[1, 1] - m[2, 2]) * 2; return np.array([0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s, (m[2, 1] - m[1, 2]) / s])
    if m[1, 1] > m[2, 2]: s = np.sqrt(1 + m[1, 1] - m[0, 0] - m[2, 2]) * 2; return np.array([(m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s, (m[0, 2] - m[2, 0]) / s])
    s = np.sqrt(1 + m[2, 2] - m[0, 0] - m[1, 1]) * 2; return np.array([(m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s, (m[1, 0] - m[0, 1]) / s])
def trs(t, r, s):
    M = np.eye(4); M[:3, :3] = q2m(r) * np.array(s); M[:3, 3] = t; return M
def local(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4, 4).T
    return trs(n.get('translation', [0, 0, 0]), n.get('rotation', [0, 0, 0, 1]), n.get('scale', [1, 1, 1]))
def padres(J):
    pa = {}
    for i, n in enumerate(J['nodes']):
        for c in n.get('children', []): pa[c] = i
    return pa
def mundo(J, locales=None):
    # matrices del mundo de todos los nodos (locales: {nodo: matriz local} para reemplazar las de reposo)
    pa = padres(J); W = {}
    def w(i):
        if i in W: return W[i]
        L = locales[i] if locales and i in locales else local(J['nodes'][i])
        W[i] = (w(pa[i]) @ L) if i in pa else L; return W[i]
    for i in range(len(J['nodes'])): w(i)
    return W
def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return np.array([aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz])
def qconj(q): return np.array([-q[0], -q[1], -q[2], q[3]])
def rot_entre(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b); c = np.cross(a, b); s = np.linalg.norm(c); d = np.dot(a, b)
    if s < 1e-9: return np.array([0, 0, 0, 1.0]) if d > 0 else np.array([1.0, 0, 0, 0])
    ang = np.arctan2(s, d); c = c / s; return np.array([*(c * np.sin(ang / 2)), np.cos(ang / 2)])
def qrot(q, v): return q2m(q) @ v
