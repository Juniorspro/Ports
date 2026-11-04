# Tabla de idiomas del juego (TextAsset "Localization", XML en UTF-16) → JSON {clave: {EN, RU, PO, ID, UA, SP}}.
# Uso: python -I idiomas.py DATOS SALIDA.json
import UnityPy, sys, json
import xml.etree.ElementTree as ET
env = UnityPy.load(sys.argv[1])
for o in env.objects:
    if o.type.name != 'TextAsset': continue
    t = o.read()
    if t.m_Name != 'Localization': continue
    b = t.m_Script.encode('utf-8', 'surrogateescape') if isinstance(t.m_Script, str) else bytes(t.m_Script)
    x = b.decode('utf-16').replace('encoding="utf-16"', '')
    loc = {k.get('name'): {c.tag: (c.text or '').strip() for c in k} for k in ET.fromstring(x).iter('TextKey')}
    json.dump(loc, open(sys.argv[2], 'w'), ensure_ascii=False, separators=(',', ':'))
    print('claves', len(loc)); break
