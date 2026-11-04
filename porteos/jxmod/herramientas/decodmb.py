# Lee a ojo los datos crudos de un MonoBehaviour: cadenas, enteros y punteros que resuelven
import UnityPy,sys,struct,re
from UnityPy.classes import PPtr
env=UnityPy.load(sys.argv[1]); archivo=sys.argv[2]; pid=int(sys.argv[3])
o=[x for x in env.objects if x.assets_file.name==archivo and x.path_id==pid][0]
raw=o.get_raw_data(); af=o.assets_file
def resol(fid,p):
    if fid<0 or fid>len(af.externals) or p==0: return None
    try:
        pp=PPtr(m_FileID=fid,m_PathID=p); pp.assetsfile=af; ob=pp.deref()
        try: n=ob.read().m_Name
        except Exception: n=''
        if ob.type.name=='MonoBehaviour': n=(n or '(mb)')+'@'+ob.assets_file.name+':'+str(ob.path_id)
        return ob.type.name+':'+n
    except Exception: return None
i=28; out=[]
# nombre
L=struct.unpack_from('<i',raw,i)[0]; out.append('NAME '+raw[i+4:i+4+L].decode('utf8','replace')); i+=4+L; i=(i+3)&~3
while i+4<=len(raw):
    v=struct.unpack_from('<i',raw,i)[0]
    if i+12<=len(raw):
        p=struct.unpack_from('<q',raw,i+4)[0]
        r=resol(v,p)
        if r: out.append('PTR '+r); i+=12; continue
    if 0<v<200 and i+4+v<=len(raw):
        s=raw[i+4:i+4+v]
        if all(32<=c<127 or c>=0xC0 or 0x80<=c<0xC0 for c in s) and re.search(rb'[A-Za-z]',s):
            out.append('STR '+s.decode('utf8','replace')); i+=4+v; i=(i+3)&~3; continue
    f=struct.unpack_from('<f',raw,i)[0]
    out.append('I %d'%v if abs(v)<100000 else 'F %.3f'%f); i+=4
print('\n'.join(out))
