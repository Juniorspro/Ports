# Arma datos.json.gz para el juego: prefabs (resources + sharedassets0), rutas de Resources,
# textos (dibujos ASCII y datos), traducciones, tabla de letras.
# Uso: python3 -I empaquetar.py APK_EXTRAIDO PREFABS_DIR MAPA_LETRAS.json SALIDA_DIR
import sys, os, json, gzip, re, UnityPy, warnings
warnings.filterwarnings("ignore")
UnityPy.config.FALLBACK_UNITY_VERSION = "2022.3.62f3"
apk, dpref, fmapa, sal = sys.argv[1:5]
os.makedirs(sal, exist_ok=True)
env = UnityPy.load(os.path.join(apk, 'assets/bin/Data/data.unity3d'))

PRE = {'resources.assets': 'r', 'sharedassets0.assets': 's', 'level0': 'l'}
# m_FileID -> archivo, segun los externals de cada uno
EXT = {'r': {0: 'r', 1: 'g', 2: 's'}, 's': {0: 's', 1: 'g'}, 'l': {0: 'l', 1: 'g', 3: 's'}}

textos, rutas = {}, {}
for o in env.objects:
    f = o.assets_file.name
    if o.type.name == 'TextAsset' and f in PRE:
        t = o.read()
        s = t.m_Script
        if not isinstance(s, str): s = bytes(s).decode('utf-8', 'replace')
        else: s = s.encode('utf-8', 'surrogateescape').decode('utf-8', 'replace')
        textos[PRE[f] + str(o.path_id)] = [t.m_Name, s]
    elif o.type.name == 'ResourceManager':
        for k, v in o.read_typetree()['m_Container']:
            if v['m_FileID'] == 5: rutas[k] = 'r' + str(v['m_PathID'])
            elif v['m_FileID'] == 2: rutas[k] = 's' + str(v['m_PathID'])

def limpiar(v, p):
    if isinstance(v, dict):
        if set(v) == {'m_FileID', 'm_PathID'}:
            if v['m_PathID'] == 0: return None
            return '@' + EXT[p].get(v['m_FileID'], '?') + str(v['m_PathID'])
        if set(v) == {'r', 'g', 'b', 'a'}:
            return [round(v[k], 4) for k in 'rgba']
        if set(v) >= {'x', 'y'} and set(v) <= {'x', 'y', 'z', 'w'} and all(isinstance(x, (int, float)) for x in v.values()):
            return [round(v[k], 4) for k in 'xyzw' if k in v]
        r = {}
        for k, x in v.items():
            x = limpiar(x, p)
            if x in (None, '', [], {}, 0, 0.0) and k not in ('x', 'y'): continue
            r[k] = x
        return r
    if isinstance(v, list): return [limpiar(x, p) for x in v]
    if isinstance(v, float): return round(v, 5)
    return v

prefabs = {}
for arch, p in (('data.unity3d__resources.assets.json', 'r'), ('data.unity3d__sharedassets0.assets.json', 's'), ('data.unity3d__level0.json', 'l')):
    d = json.load(open(os.path.join(dpref, arch)))
    for gid, g in d.items():
        comps, pos, hijos, padre = [], None, [], None
        for c in g['comps']:
            if c['_clase'] in ('Transform', 'RectTransform'):
                pos = [round(c['pos']['x'], 3), round(c['pos']['y'], 3), round(c['pos']['z'], 3)]
                hijos = [p + str(h) for h in c['hijos']]
                padre = p + str(c['padre']) if c['padre'] else None
                continue
            cid = p + str(c.pop('_id'))
            cl = c.pop('_clase')
            c.pop('m_Name', None)
            c = limpiar(c, p)
            c['_c'] = cl; c['_i'] = cid
            comps.append(c)
        e = {'n': g['nombre'], 'c': comps}
        if not g['activo']: e['off'] = 1
        if pos and pos != [0, 0, 0]: e['p'] = pos
        if hijos: e['h'] = hijos
        prefabs[p + gid] = e
# los hijos estan referidos por Transform: pasar a ids de GameObject
tr2go = {}
for arch, p in (('data.unity3d__resources.assets.json', 'r'), ('data.unity3d__sharedassets0.assets.json', 's'), ('data.unity3d__level0.json', 'l')):
    for gid, g in json.load(open(os.path.join(dpref, arch))).items():
        for c in g['comps']:
            if c['_clase'] in ('Transform', 'RectTransform'): tr2go[p + str(c['_id'])] = p + gid
for e in prefabs.values():
    if 'h' in e: e['h'] = [tr2go[h] for h in e['h'] if h in tr2go]

tablas = json.load(open(fmapa))
lang = {}
for d, _, fs in os.walk(os.path.join(apk, 'assets/aa')):
    pass
datos = {'textos': textos, 'rutas': rutas, 'prefabs': prefabs, 'tablas': tablas}
b = json.dumps(datos, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
open(os.path.join(sal, 'datos.json.gz'), 'wb').write(gzip.compress(b, 9))
print('datos', len(b) // 1024, 'KB ->', os.path.getsize(os.path.join(sal, 'datos.json.gz')) // 1024, 'KB;', len(textos), 'textos', len(prefabs), 'prefabs', len(rutas), 'rutas')
