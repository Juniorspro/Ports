# Mapa ruta de Resources -> (archivo, path_id), y path_id de TextAsset -> nombre
import sys, json, UnityPy, warnings
warnings.filterwarnings("ignore")
UnityPy.config.FALLBACK_UNITY_VERSION = "2022.3.62f3"
env = UnityPy.load(sys.argv[1])
rutas, textos = {}, {}
for o in env.objects:
    if o.type.name == 'ResourceManager':
        t = o.read_typetree()
        for k, v in t['m_Container']:
            rutas[k] = [v['m_FileID'], v['m_PathID']]
    elif o.type.name == 'TextAsset':
        textos[o.assets_file.name + ':' + str(o.path_id)] = o.read().m_Name
# los externals de cada archivo para resolver m_FileID
ext = {n: [e.path for e in getattr(f, 'externals', [])] for n, f in env.files.items() if hasattr(f, 'externals')}
json.dump({'rutas': rutas, 'textos': textos, 'externos': ext}, open(sys.argv[2], 'w'), ensure_ascii=False)
print(len(rutas), len(textos), {k: v[:6] for k, v in ext.items()})
