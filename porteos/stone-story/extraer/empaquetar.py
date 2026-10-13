# Arma datos.json.gz para el juego, de data.unity3d y de los paquetes de Addressables:
# prefabs (GameObjects con sus componentes), rutas (Resources y direcciones de Addressables),
# textos (dibujos ASCII y datos), y las tablas de letras/espejos.
# Uso: python3 -I empaquetar.py APK_EXTRAIDO DLLS_CPP2IL TABLAS.json SALIDA_DIR
import sys, os, json, gzip, warnings, UnityPy
warnings.filterwarnings("ignore")
UnityPy.config.FALLBACK_UNITY_VERSION = "2022.3.62f3"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ttfix import generador
apk, dlls, ftablas, sal = sys.argv[1:5]
os.makedirs(sal, exist_ok=True)
gen = generador(dlls)

archivos = [os.path.join(apk, 'assets/bin/Data/data.unity3d')]
for d, _, fs in os.walk(os.path.join(apk, 'assets/aa')):
    archivos += [os.path.join(d, f) for f in sorted(fs) if f.endswith('.bundle')]
envs = []
for a in archivos:
    e = UnityPy.load(a); e.typetree_generator = gen; envs.append(e)

# codigo corto por archivo serializado
COD = {'resources.assets': 'r', 'sharedassets0.assets': 's', 'level0': 'l', 'globalgamemanagers.assets': 'g'}
ext = {}
for e in envs:
    for bf in e.files.values():
        for n, sf in getattr(bf, 'files', {}).items():
            if not hasattr(sf, 'externals'): continue
            if n not in COD: COD[n] = 'b%d:' % len([k for k in COD if COD[k].startswith('b')])
            ext[n] = [os.path.basename(x.path) for x in sf.externals]
def ref(arch, fid, pid):
    if pid == 0: return None
    if fid == 0: return '@' + COD.get(arch, '?') + str(pid)
    x = ext.get(arch, [])
    destino = x[fid - 1] if fid - 1 < len(x) else '?'
    return '@' + COD.get(destino, '?') + str(pid)

def limpiar(v, arch):
    if isinstance(v, dict):
        if set(v) == {'m_FileID', 'm_PathID'}: return ref(arch, v['m_FileID'], v['m_PathID'])
        if set(v) == {'r', 'g', 'b', 'a'}: return [round(v[k], 4) for k in 'rgba']
        if set(v) >= {'x', 'y'} and set(v) <= {'x', 'y', 'z', 'w'} and all(isinstance(x, (int, float)) for x in v.values()):
            return [round(v[k], 4) for k in 'xyzw' if k in v]
        r = {}
        for k, x in v.items():
            x = limpiar(x, arch)
            if x in (None, '', [], {}, 0, 0.0): continue
            r[k] = x
        return r
    if isinstance(v, list): return [limpiar(x, arch) for x in v]
    if isinstance(v, float): return round(v, 5)
    return v

textos, rutas, prefabs = {}, {}, {}
tr2go = {}
for e in envs:
    por = {}
    for o in e.objects: por.setdefault(o.assets_file.name, []).append(o)
    for arch, objs in por.items():
        c = COD.get(arch)
        if not c or c == 'g': continue
        idx = {o.path_id: o for o in objs}
        clips = {o.path_id: o.read().m_Name for o in objs if o.type.name == 'AudioClip'}
        for o in objs:
            t = o.type.name
            if t == 'TextAsset':
                x = o.read(); s = x.m_Script
                s = bytes(s).decode('utf-8', 'replace') if not isinstance(s, str) else s.encode('utf-8', 'surrogateescape').decode('utf-8', 'replace')
                textos[c + str(o.path_id)] = [x.m_Name, s]
            elif t == 'ResourceManager':
                pass
            elif t == 'AssetBundle':
                for k, v in o.read_typetree()['m_Container']:
                    a = v['asset']
                    dire = k.replace('Assets/Content/', '').rsplit('.', 1)[0].lower()
                    r = ref(arch, a['m_FileID'], a['m_PathID'])
                    if r and dire not in rutas: rutas[dire] = r[1:]
            elif t in ('Transform', 'RectTransform'):
                try: tr2go[c + str(o.path_id)] = c + str(o.read_typetree()['m_GameObject']['m_PathID'])
                except Exception: pass
        for o in objs:
            if o.type.name != 'GameObject': continue
            g = o.read_typetree()
            comps, ent = [], {'n': g['m_Name'], 'c': None}
            for cc in g.get('m_Component', []):
                co = idx.get(cc['component']['m_PathID'])
                if co is None: continue
                cid = c + str(co.path_id)
                if co.type.name in ('Transform', 'RectTransform'):
                    tr = co.read_typetree(); p = tr['m_LocalPosition']
                    pos = [round(p['x'], 3), round(p['y'], 3), round(p['z'], 3)]
                    if pos != [0, 0, 0]: ent['p'] = pos
                    h = [c + str(x['m_PathID']) for x in tr['m_Children']]
                    if h: ent['h'] = h
                    continue
                if co.type.name == 'AudioSource':
                    try:
                        a = co.read_typetree(); cl = a['m_audioClip']
                        comps.append({'_c': 'AudioSource', '_i': cid, 'clip': clips.get(cl['m_PathID'], ref(arch, cl['m_FileID'], cl['m_PathID'])),
                                      'vol': round(a.get('m_Volume', 1), 3), 'loop': a.get('Loop', 0)})
                    except Exception:
                        comps.append({'_c': 'AudioSource', '_i': cid})
                    continue
                if co.type.name != 'MonoBehaviour':
                    comps.append({'_c': co.type.name, '_i': cid}); continue
                try:
                    d = co.read_typetree()
                    cl = co.parse_monobehaviour_head().m_Script.deref_parse_as_object().m_ClassName
                except Exception:
                    continue
                for k in ('m_GameObject', 'm_Script', 'm_Enabled', 'm_EditorHideFlags', 'm_EditorClassIdentifier', 'm_Name'): d.pop(k, None)
                d = limpiar(d, arch); d['_c'] = cl; d['_i'] = cid
                comps.append(d)
            ent['c'] = comps
            if not g.get('m_IsActive', 1): ent['off'] = 1
            prefabs[c + str(o.path_id)] = ent
    # Resources (data.unity3d): ruta -> GameObject
    for o in e.objects:
        if o.type.name == 'ResourceManager':
            for k, v in o.read_typetree()['m_Container']:
                r = ref('globalgamemanagers', v['m_FileID'], v['m_PathID']) if 'globalgamemanagers' in ext else None
                if r: rutas[k] = r[1:]
for p in prefabs.values():
    if 'h' in p: p['h'] = [tr2go[h] for h in p['h'] if h in tr2go]

datos = {'textos': textos, 'rutas': rutas, 'prefabs': prefabs, 'tablas': json.load(open(ftablas))}
b = json.dumps(datos, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
open(os.path.join(sal, 'datos.json.gz'), 'wb').write(gzip.compress(b, 9))
print('datos', len(b) // 1024, 'KB ->', os.path.getsize(os.path.join(sal, 'datos.json.gz')) // 1024, 'KB;',
      len(textos), 'textos', len(prefabs), 'prefabs', len(rutas), 'rutas', {v: k for k, v in COD.items() if v.startswith('b')})
