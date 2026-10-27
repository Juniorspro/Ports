import UnityPy,sys,struct
from UnityPy.classes import PPtr
env=UnityPy.load(sys.argv[1]); want=sys.argv[2].split(',')
def script_de(o):
    raw=o.get_raw_data()
    fid,pid=struct.unpack_from('<iq',raw,16)
    pp=PPtr(m_FileID=fid,m_PathID=pid); pp.assetsfile=o.assets_file
    return pp.deref().read().m_ClassName
for o in env.objects:
    if o.type.name!='MonoBehaviour': continue
    try: cn=script_de(o)
    except Exception: continue
    if cn in want:
        raw=o.get_raw_data()
        print('==',cn,o.assets_file.name,o.path_id,len(raw))
        open('mb_%s_%d.bin'%(cn,o.path_id),'wb').write(raw)
