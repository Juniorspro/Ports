# Menú real del juego: el LobbyCanvas de la escena del menú (RectTransform, Image, Text, botones, campos) a JSON.
# Uso: python -I menuexp.py DATOS level1 SALIDA.json   (los MonoBehaviour no traen tipos: se leen los bytes crudos)
import UnityPy, sys, struct, json
from UnityPy.classes import PPtr
env=UnityPy.load(sys.argv[1]); archivo=sys.argv[2]; salida=sys.argv[3]
objs=[x for x in env.objects if x.assets_file.name==archivo]
def deref(o,off,raw):
    fid,pid=struct.unpack_from('<iq',raw,off)
    if pid==0: return None
    pp=PPtr(m_FileID=fid,m_PathID=pid); pp.assetsfile=o.assets_file
    try: return pp.deref()
    except Exception: return None
def cname(o,raw):
    d=deref(o,16,raw)
    try: return d.read().m_ClassName
    except Exception: return '?'
def base(raw):
    n=struct.unpack_from('<i',raw,28)[0]; return 32+((n+3)//4)*4
def rstr(raw,off):
    n=struct.unpack_from('<i',raw,off)[0]
    if n<0 or n>5000: return '',off+4
    return raw[off+4:off+4+n].decode('utf8','replace'), off+4+((n+3)//4)*4
info={}
def strs(raw):
    out=[]; i=0
    while i+4<=len(raw):
        n=struct.unpack_from('<i',raw,i)[0]
        if 1<=n<=400 and i+4+n<=len(raw):
            t=raw[i+4:i+4+n]
            try:
                t=t.decode('utf8')
                if all(c.isprintable() for c in t) and any(c.isalnum() for c in t):
                    out.append(t); i+=4+((n+3)//4)*4; continue
            except Exception: pass
        i+=4
    return out
def nodo(t):
    go=t.m_GameObject.read()
    d={'n':go.m_Name}
    if not go.m_IsActive: d['off']=1
    if hasattr(t,'m_AnchorMin'):
        d['a']=[round(t.m_AnchorMin.x,3),round(t.m_AnchorMin.y,3),round(t.m_AnchorMax.x,3),round(t.m_AnchorMax.y,3)]
        d['p']=[round(t.m_AnchoredPosition.x,1),round(t.m_AnchoredPosition.y,1)]
        d['s']=[round(t.m_SizeDelta.x,1),round(t.m_SizeDelta.y,1)]
        d['pv']=[round(t.m_Pivot.x,3),round(t.m_Pivot.y,3)]
        sc=t.m_LocalScale
        if abs(sc.x-1)>0.01 or abs(sc.y-1)>0.01: d['sc']=[round(sc.x,3),round(sc.y,3)]
        q=t.m_LocalRotation
        if abs(q.z)>0.01: d['rz']=round(q.z,3); d['rw']=round(q.w,3)
    for c in go.m_Component:
        p=c.component if hasattr(c,'component') else c
        try: o=p.deref()
        except Exception: continue
        if o.type.name!='MonoBehaviour': continue
        raw=o.get_raw_data(); cn=cname(o,raw); b=base(raw)
        try:
            if cn in('Image','RawImage','Text'):
                col=[round(x,3) for x in struct.unpack_from('<4f',raw,b+12)]
                en=raw[12]
                g=b+12+16+4+16+4
                nc=struct.unpack_from('<i',raw,g)[0]; g+=4
                if nc: d.setdefault('warn',[]).append('calls%d'%nc); continue
                if cn=='Image':
                    sp=deref(o,g,raw); ty=struct.unpack_from('<i',raw,g+12)[0]
                    im={'c':col,'t':ty}
                    if not en: im['off']=1
                    if sp is not None:
                        try:
                            s=sp.read(); im['sp']=s.m_Name
                            bd=s.m_Border; 
                            if bd.x or bd.y or bd.z or bd.w: im['bd']=[round(bd.x),round(bd.y),round(bd.z),round(bd.w)]
                            im['ppu']=round(s.m_PixelsPerUnit,2)
                        except Exception: pass
                    if ty==3:
                        im['fm']=struct.unpack_from('<i',raw,g+20)[0]; im['fa']=round(struct.unpack_from('<f',raw,g+24)[0],3)
                    d['img']=im
                elif cn=='RawImage':
                    tx=deref(o,g,raw); im={'c':col,'raw':1}
                    if tx is not None:
                        try: im['tx']=tx.read().m_Name
                        except Exception: pass
                    d['img']=im
                else:
                    fo=deref(o,g,raw); fs,fst=struct.unpack_from('<ii',raw,g+12); bf=raw[g+20]
                    mn,mx,al=struct.unpack_from('<iii',raw,g+24)
                    ho,vo,ls=struct.unpack_from('<iif',raw,g+44)
                    txt,_=rstr(raw,g+56)
                    tt={'t':txt,'c':col,'fs':fs,'st':fst,'al':al}
                    if bf: tt['bf']=[mn,mx]
                    if ho==1: tt['ho']=1
                    if fo is not None:
                        try: tt['f']=fo.read().m_Name
                        except Exception: pass
                    if not en: tt['off']=1
                    d['txt']=tt
            elif cn in('Shadow','Outline'):
                col=[round(x,3) for x in struct.unpack_from('<4f',raw,b)]
                dist=struct.unpack_from('<2f',raw,b+16)
                d['sh' if cn=='Shadow' else 'ol']=[col,[round(dist[0],1),round(dist[1],1)]]
            elif cn in('Button','Toggle','InputField','Slider','Scrollbar','Dropdown','ScrollRect','Mask','RectMask2D','LocalizationText','InputField'):
                d.setdefault('k',[]).append(cn)
                if cn=='LocalizationText':
                    ss=strs(raw[b:])
                    if ss: d['lk']=ss[0]
                if cn in('Button','Toggle','InputField'):
                    ss=strs(raw[b:])
                    if 'Disabled' in ss: ss=ss[ss.index('Disabled')+1:]
                    ss=[x for x in ss if ', ' not in x and x not in('Normal','Highlighted','Pressed','Selected')]
                    if ss: d['on']=ss
            elif cn=='CanvasScaler':
                m,ppu,sf,rx,ry,sm,mw=struct.unpack_from('<iffffif',raw,b)
                info['scaler']=[m,rx,ry,sm,mw]
            else:
                d.setdefault('k',[]).append(cn)
        except Exception as e:
            d.setdefault('warn',[]).append(cn+':'+str(e)[:40])
    ch=[nodo(x.read()) for x in t.m_Children]
    if ch: d['ch']=ch
    return d
raiz=None
for o in objs:
    if o.type.name in('Transform','RectTransform'):
        t=o.read()
        if t.m_Father.path_id==0 and t.m_GameObject.read().m_Name=='LobbyCanvas': raiz=nodo(t)
info['ui']=raiz
json.dump(info,open(salida,'w'),separators=(',',':'),ensure_ascii=False)
print('ok',info.get('scaler'))
