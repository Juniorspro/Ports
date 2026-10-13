# Muestra la jerarquia de un prefab (por ruta de Resources) con sus componentes y campos cortos
import sys, json
d = json.load(open('/tmp/claude-0/ss/prefabs/data.unity3d__resources.assets.json'))
r = json.load(open('/tmp/claude-0/ss/rutas.json'))
tx = r['textos']
tr = {}
for k, g in d.items():
    for co in g['comps']:
        if co['_clase'] == 'Transform': tr[co['_id']] = k
def corto(co):
    s = {}
    for k, v in co.items():
        if k in ('_clase', '_id', 'm_Name', 'hijos', 'padre'): continue
        if isinstance(v, dict) and 'm_PathID' in v:
            if v['m_PathID'] == 0: continue
            v = tx.get(('sharedassets0.assets' if v['m_FileID'] == 2 else 'resources.assets') + ':' + str(v['m_PathID']), 'ref%d:%d' % (v['m_FileID'], v['m_PathID']))
        if v in (0, 0.0, '', [], None, False): continue
        s[k] = v
    return json.dumps(s, ensure_ascii=False)[:int(sys.argv[2]) if len(sys.argv) > 2 else 300]
def arbol(k, n=0):
    g = d[k]
    print('  ' * n + '■ ' + g['nombre'] + ('' if g['activo'] else ' (inactivo)'))
    for co in g['comps']:
        if co['_clase'] == 'Transform':
            if co['pos'] != {'x': 0.0, 'y': 0.0, 'z': 0.0}: print('  ' * n + '   pos', co['pos'])
            continue
        print('  ' * n + '   ' + str(co['_clase']) + ' ' + corto(co))
    t = [co for co in g['comps'] if co['_clase'] == 'Transform']
    for h in (t[0]['hijos'] if t else []):
        if h in tr: arbol(tr[h], n + 1)
arbol(str(r['rutas'][sys.argv[1]][1]))
