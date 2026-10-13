import sys, os, UnityPy, warnings
warnings.filterwarnings("ignore")
UnityPy.config.FALLBACK_UNITY_VERSION = "2022.3.62f3"
env = UnityPy.load(sys.argv[1]); sal = sys.argv[2]; os.makedirs(sal, exist_ok=True)
for o in env.objects:
    if o.type.name in ('Texture2D', 'Font'):
        t = o.read()
        if o.type.name == 'Texture2D':
            try:
                im = t.image; im.save(os.path.join(sal, t.m_Name + '.png')); print('T', t.m_Name, im.size, o.assets_file.name)
            except Exception as e: print('ERR', t.m_Name, e)
        else:
            print('F', t.m_Name, len(t.m_FontData or b''))
            if t.m_FontData: open(os.path.join(sal, t.m_Name + '.ttf'), 'wb').write(bytes(t.m_FontData))
