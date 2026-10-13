import sys, os, UnityPy, warnings
warnings.filterwarnings("ignore")
UnityPy.config.FALLBACK_UNITY_VERSION = "2022.3.62f3"
raiz, sal = sys.argv[1], sys.argv[2]
os.makedirs(sal, exist_ok=True)
n = 0
for d, _, fs in os.walk(raiz):
    for f in fs:
        if not (f.endswith('.bundle') or f == 'data.unity3d'): continue
        env = UnityPy.load(os.path.join(d, f))
        pre = f.split('_assets')[0].replace('.unity3d', '')
        for o in env.objects:
            if o.type.name != 'TextAsset': continue
            t = o.read()
            nom = (t.m_Name or str(o.path_id)).replace('/', '_')
            b = t.m_Script.encode('utf-8', 'surrogateescape') if isinstance(t.m_Script, str) else bytes(t.m_Script)
            p = os.path.join(sal, pre, nom + '.txt')
            os.makedirs(os.path.dirname(p), exist_ok=True)
            if os.path.exists(p): p = p[:-4] + '_%d.txt' % o.path_id
            open(p, 'wb').write(b); n += 1
print(n)
