# Arma un .glb de prueba con más de 255 huesos con peso: al VRM de muestra le agrega N huesos hijos (cadenas de a 4 bajo
# huesos del pelo/pollera y de la cabeza), con la misma matriz inversa de su padre (la malla no cambia), y pasa a cada uno
# los vértices de su padre de a turnos (pesos reales). uso: python3 -I muchos_huesos.py ENTRADA.vrm SALIDA.glb [N=220]
import json, struct, sys
ent, sal = sys.argv[1], sys.argv[2]; N = int(sys.argv[3]) if len(sys.argv) > 3 else 220
b = open(ent, 'rb').read(); o = 12; J = None; BIN = None
while o < len(b):
    l, t = struct.unpack('<II', b[o:o + 8]); c = b[o + 8:o + 8 + l]
    if t == 0x4E4F534A: J = json.loads(c)
    elif t == 0x004E4942: BIN = bytearray(c)
    o += 8 + l
for k in ('extensionsUsed', 'extensionsRequired'): J[k] = [e for e in J.get(k, []) if not e.startswith('VRM')]
J.pop('extensions', None)
for n in J['nodes']: n.pop('extensions', None)
for m in J.get('materials', []): m.pop('extensions', None)
J['extensionsUsed'] = [e for e in J['extensionsUsed'] if e not in ('VRMC_materials_mtoon', 'KHR_materials_unlit', 'VRMC_node_constraint', 'VRMC_springBone')]
S = J['skins'][0]; joints = S['joints']; A = J['accessors']; BV = J['bufferViews']
def acc_bytes(i):
    a = A[i]; v = BV[a['bufferView']]; return (v.get('byteOffset', 0) + a.get('byteOffset', 0), v.get('byteStride', 0))
# matrices inversas: nuevas al final del buffer
ia = A[S['inverseBindMatrices']]; ioff, _ = acc_bytes(S['inverseBindMatrices'])
ibm = [BIN[ioff + k * 64: ioff + (k + 1) * 64] for k in range(ia['count'])]
padres = [j for j in joints if any(w in (J['nodes'][j].get('name') or '').lower() for w in ('hair', 'skirt', 'bust', 'head'))] or joints
nuevos = []
for k in range(N):
    pj = padres[k % len(padres)] if k % 4 == 0 else nuevos[-1]
    ni = len(J['nodes']); J['nodes'].append({'name': 'extra_%03d' % k, 'translation': [0, 0.002, 0]})
    J['nodes'][pj].setdefault('children', []).append(ni)
    nuevos.append(ni); ibm.append(ibm[joints.index(pj)] if pj in joints else ibm[0]); joints.append(ni)
# (la traslación mínima cambia un poco la pose: se deja la misma inversa del padre, la malla se mueve 2 mm, no importa)
datos = b''.join(bytes(x) for x in ibm)
while len(BIN) % 4: BIN.append(0)
off = len(BIN); BIN += datos
BV.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(datos)}); A.append({'bufferView': len(BV) - 1, 'componentType': 5126, 'count': len(ibm), 'type': 'MAT4'})
for s2 in J['skins']:
    if s2 is S: continue
S['inverseBindMatrices'] = len(A) - 1
# los pesos: en cada primitiva con piel 0, cada 3.º vértice cuyo hueso principal es un padre pasa a un hijo nuevo suyo
hijo = {}
for k, ni in enumerate(nuevos): hijo.setdefault(joints.index(J['nodes'].index(J['nodes'][ni]) if False else ni), None)
porPadre = {}
for k, ni in enumerate(nuevos):
    pj = padres[k % len(padres)] if k % 4 == 0 else nuevos[k - 1]
    porPadre.setdefault(joints.index(pj), []).append(joints.index(ni))
cambiados = 0; vistos = set()
for ni_, nd in enumerate(J['nodes']):
    if nd.get('skin') != 0 or 'mesh' not in nd: continue
    for pr in J['meshes'][nd['mesh']]['primitives']:
        ja = pr['attributes'].get('JOINTS_0')
        if ja is None or ja in vistos: continue
        vistos.add(ja); a = A[ja]; boff, st = acc_bytes(ja); ct = a['componentType']; es = 2 if ct == 5123 else 1
        if es == 1: continue
        st = st or 8
        for v in range(a['count']):
            p = boff + v * st; j0 = struct.unpack_from('<H', BIN, p)[0]
            if j0 in porPadre and v % 3 == 0:
                L = porPadre[j0]; struct.pack_into('<H', BIN, p, L[v % len(L)]); cambiados += 1
BIN = bytes(BIN); J['buffers'][0]['byteLength'] = len(BIN)
js = json.dumps(J, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
tot = 12 + 8 + len(js) + 8 + len(BIN)
open(sal, 'wb').write(struct.pack('<III', 0x46546C67, 2, tot) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(BIN), 0x004E4942) + BIN)
print('huesos', len(joints), 'vertices cambiados', cambiados)
