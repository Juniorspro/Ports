# Vuelca cada GameObject con su jerarquia y sus componentes (MonoBehaviour con campos) a JSON
import sys, os, json, UnityPy, warnings
warnings.filterwarnings("ignore")
UnityPy.config.FALLBACK_UNITY_VERSION = "2022.3.62f3"
import sys; sys.path.insert(0, "/tmp/claude-0/ss/scripts"); from ttfix import generador
g = generador(sys.argv[2])
sal = sys.argv[3]; os.makedirs(sal, exist_ok=True)
def volcar(ruta):
    env = UnityPy.load(ruta); env.typetree_generator = g
    for sf in list(env.files.values()):
        pass
    porarch = {}
    for o in env.objects:
        porarch.setdefault(o.assets_file.name, []).append(o)
    for an, objs in porarch.items():
        if not any(o.type.name == 'GameObject' for o in objs): continue
        idx = {o.path_id: o for o in objs}
        gos, err = {}, 0
        scripts = {}
        for o in env.objects:
            if o.type.name == 'MonoScript':
                try: scripts[o.path_id] = o.read().m_ClassName
                except Exception: pass
        for o in objs:
            if o.type.name != 'GameObject': continue
            try: t = o.read_typetree()
            except Exception: continue
            comps = []
            for c in t.get('m_Component', []):
                pid = c['component']['m_PathID']; co = idx.get(pid)
                if co is None: continue
                if co.type.name == 'MonoBehaviour':
                    try:
                        d = co.read_typetree()
                    except Exception:
                        err += 1
                        try: d = {'_sinleer': 1, 'm_Script': co.parse_monobehaviour_head().m_Script.m_PathID}
                        except Exception: d = {'_sinleer': 1}
                    try: d['_clase'] = co.parse_monobehaviour_head().m_Script.deref_parse_as_object().m_ClassName
                    except Exception: d['_clase'] = '?'
                    for k in ('m_GameObject', 'm_Script', 'm_Enabled', 'm_EditorHideFlags', 'm_EditorClassIdentifier'): d.pop(k, None)
                    d['_id'] = pid
                    comps.append(d)
                elif co.type.name in ('Transform', 'RectTransform'):
                    try:
                        tr = co.read_typetree()
                        comps.append({'_clase': co.type.name, '_id': pid, 'pos': tr['m_LocalPosition'], 'escala': tr['m_LocalScale'],
                                      'padre': tr['m_Father']['m_PathID'], 'hijos': [h['m_PathID'] for h in tr['m_Children']]})
                    except Exception: pass
                else:
                    comps.append({'_clase': co.type.name, '_id': pid})
            gos[o.path_id] = {'nombre': t['m_Name'], 'activo': t.get('m_IsActive'), 'comps': comps}
        nom = os.path.basename(ruta).split('_assets')[0] + '__' + an.replace('/', '_')
        json.dump(gos, open(os.path.join(sal, nom + '.json'), 'w'), default=str, ensure_ascii=False)
        print(nom, len(gos), 'sinleer', err)
for d, _, fs in os.walk(sys.argv[1]):
    for f in sorted(fs):
        if f.endswith('.bundle') or f == 'data.unity3d': volcar(os.path.join(d, f))
