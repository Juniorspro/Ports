# Exporta escenas y prefabs del juego (datos, no código) a un formato propio.
# Uso: python -I exportar.py DATOS SALIDA
import UnityPy, sys, os, json, struct, math, traceback
from UnityPy.helpers.MeshHelper import MeshHandler
from UnityPy.classes import PPtr
env=UnityPy.load(sys.argv[1]); OUT=sys.argv[2]
os.makedirs(OUT+'/tex_orig',exist_ok=True)
por_id={}
for o in env.objects: por_id[(o.assets_file.name,o.path_id)]=o
def deref(pp):
    if pp is None or pp.path_id==0: return None
    try: return pp.deref()
    except Exception: return None
# ---------- mallas ----------
mallas=[]; malla_idx={}; blob=bytearray()
def f16(x):
    return struct.pack('<e',max(-65000.0,min(65000.0,x)))
def exp_malla(ob):
    k=(ob.assets_file.name,ob.path_id)
    if k in malla_idx: return malla_idx[k]
    m=ob.read()
    try:
        h=MeshHandler(m); h.process()
    except Exception as e:
        print('malla falla',m.m_Name,e); malla_idx[k]=-1; return -1
    V=h.m_Vertices or []; N=h.m_Normals or []; U=h.m_UV0 or []; nv=len(V)
    if nv==0: malla_idx[k]=-1; return -1
    tris=h.get_triangles()
    xs=[-v[0] for v in V]; ys=[v[1] for v in V]; zs=[v[2] for v in V]
    mn=[min(xs),min(ys),min(zs)]; mx=[max(xs),max(ys),max(zs)]
    sc=[(mx[i]-mn[i]) or 1e-6 for i in range(3)]
    off=len(blob)
    for i in range(nv):
        p=(xs[i],ys[i],zs[i])
        blob.extend(struct.pack('<HHH',*[int(round((p[j]-mn[j])/sc[j]*65535)) for j in range(3)]))
        n=N[i] if i<len(N) else (0,1,0)
        blob.extend(struct.pack('<bbbb',int(round(-n[0]*127)),int(round(n[1]*127)),int(round(n[2]*127)),0))
        u=U[i] if i<len(U) else (0,0)
        blob.extend(f16(u[0])+f16(u[1]))
    # pesos de huesos
    skin=None
    if h.m_BoneIndices and m.m_BindPose:
        skin=len(blob)
        for i in range(nv):
            bi=h.m_BoneIndices[i]; bw=h.m_BoneWeights[i]
            bi=list(bi)+[0]*(4-len(bi)); bw=list(bw)+[0]*(4-len(bw))
            s=sum(bw) or 1
            w=[int(round(x/s*255)) for x in bw]; w[0]+=255-sum(w)
            blob.extend(bytes([min(255,int(x)) for x in bi[:4]])+bytes(w[:4]))
    idx_off=len(blob); subs=[]; big=nv>65535; c=0
    for sm in tris:
        st=c
        for t in sm:
            a,b,cc=t
            blob.extend(struct.pack('<III' if big else '<HHH',a,cc,b)); c+=3
        subs.append([st,c-st])
    while len(blob)%4: blob.append(0)
    d=dict(n=m.m_Name,o=off,v=nv,mn=mn,sc=sc,i=idx_off,i32=big,sub=subs)
    if skin is not None:
        d['sk']=skin
        bp=[]
        for M in m.m_BindPose:
            e=[M.e00,M.e01,M.e02,M.e03,M.e10,M.e11,M.e12,M.e13,M.e20,M.e21,M.e22,M.e23,M.e30,M.e31,M.e32,M.e33]
            # S*M*S con S=diag(-1,1,1,1): niega fila 0 y columna 0 (menos el cruce)
            for r in range(4):
                for cc in range(4):
                    if (r==0)!=(cc==0): e[r*4+cc]=-e[r*4+cc]
            bp.append([round(x,6) for x in e])
        d['bp']=bp
    malla_idx[k]=len(mallas); mallas.append(d); return malla_idx[k]
# ---------- texturas ----------
texs=[]; tex_idx={}
def exp_tex(ob):
    k=(ob.assets_file.name,ob.path_id)
    if k in tex_idx: return tex_idx[k]
    t=ob.read(); i=len(texs)
    try:
        img=t.image
        fn='%04d.png'%i; img.save(OUT+'/tex_orig/'+fn)
        texs.append(dict(n=t.m_Name,w=t.m_Width,h=t.m_Height,f=fn,a=img.mode=='RGBA' and img.getextrema()[3][0]<250))
    except Exception as e:
        print('tex falla',t.m_Name,e); tex_idx[k]=-1; return -1
    tex_idx[k]=i; return i
# ---------- materiales ----------
mats=[]; mat_idx={}
def exp_mat(ob):
    k=(ob.assets_file.name,ob.path_id)
    if k in mat_idx: return mat_idx[k]
    m=ob.read(); d=dict(n=m.m_Name)
    try:
        sh=deref(m.m_Shader)
        if sh: 
            s=sh.read(); d['sh']=s.m_ParsedForm.m_Name if hasattr(s,'m_ParsedForm') else s.m_Name
    except Exception: pass
    sp=m.m_SavedProperties
    for nm,te in sp.m_TexEnvs:
        if nm in('_MainTex','_BaseMap','_BaseColorMap','_Albedo') and te.m_Texture.path_id:
            o=deref(te.m_Texture)
            if o and o.type.name=='Texture2D':
                d['t']=exp_tex(o); d['ts']=[te.m_Scale.x,te.m_Scale.y]; d['to']=[te.m_Offset.x,te.m_Offset.y]
        if nm in('_EmissionMap',) and te.m_Texture.path_id:
            o=deref(te.m_Texture)
            if o and o.type.name=='Texture2D': d['te']=exp_tex(o)
    tt={}
    for nm,te in sp.m_TexEnvs:
        if te.m_Texture.path_id:
            o=deref(te.m_Texture)
            if o and o.type.name=='Texture2D': tt[nm]=[exp_tex(o),round(te.m_Scale.x,4),round(te.m_Scale.y,4),round(te.m_Offset.x,4),round(te.m_Offset.y,4)]
    if tt: d['tt']=tt
    cc={}
    for nm,c in sp.m_Colors: cc[nm]=[round(c.r,3),round(c.g,3),round(c.b,3),round(c.a,3)]
    if cc: d['cc']=cc
    for nm,c in sp.m_Colors:
        if nm in('_Color','_BaseColor'): d['c']=[round(c.r,3),round(c.g,3),round(c.b,3),round(c.a,3)]
        if nm=='_EmissionColor' and (c.r+c.g+c.b)>0.01: d['e']=[round(c.r,3),round(c.g,3),round(c.b,3)]
    fl={}
    for nm,v in sp.m_Floats:
        fl[nm]=round(v,3)
    if fl: d['f']=fl
    d['q']=m.m_CustomRenderQueue
    kw=getattr(m,'m_ValidKeywords',None) or getattr(m,'m_ShaderKeywords',None)
    if kw: d['kw']=kw if isinstance(kw,list) else str(kw).split()
    mat_idx[k]=len(mats); mats.append(d); return mat_idx[k]
# ---------- componentes ----------
def v3(v,neg=True): return [round(-v.x if neg else v.x,4),round(v.y,4),round(v.z,4)]
def script_de(o):
    raw=o.get_raw_data()
    try:
        fid,pid=struct.unpack_from('<iq',raw,16)
        pp=PPtr(m_FileID=fid,m_PathID=pid); pp.assetsfile=o.assets_file
        s=pp.deref().read(); return s.m_ClassName
    except Exception: return '?'
def nodos(t_ob, lista, padre, nodo_de):
    t=t_ob.read(); go=t.m_GameObject.read()
    q=t.m_LocalRotation; p=t.m_LocalPosition; s=t.m_LocalScale
    n=dict(n=go.m_Name,p=v3(p),r=[round(q.x,5),round(-q.y,5),round(-q.z,5),round(q.w,5)],s=v3(s,False),pa=padre)
    if not go.m_IsActive: n['off']=1
    if go.m_Layer: n['ly']=go.m_Layer
    if go.m_Tag: n['tg']=go.m_Tag
    me=len(lista); lista.append(n); nodo_de[t_ob.path_id]=me
    pend=[]
    for c in go.m_Component:
        pp=c.component if hasattr(c,'component') else c
        o=deref(pp)
        if o is None: continue
        tn=o.type.name
        try:
            if tn=='MeshFilter':
                mo=deref(o.read().m_Mesh)
                if mo: n['m']=exp_malla(mo)
            elif tn=='MeshRenderer':
                r=o.read(); n['mt']=[exp_mat(x) if x else -1 for x in (deref(mm) for mm in r.m_Materials)]
                n['rid']=o.path_id
                if not r.m_Enabled: n['mroff']=1
                sbi=getattr(r,'m_StaticBatchInfo',None)
                if sbi and sbi.subMeshCount: n['sb']=[sbi.firstSubMesh,sbi.subMeshCount]
            elif tn=='SkinnedMeshRenderer':
                r=o.read(); mo=deref(r.m_Mesh)
                if mo: n['m']=exp_malla(mo)
                n['rid']=o.path_id
                if not r.m_Enabled: n['mroff']=1
                n['mt']=[exp_mat(x) if x else -1 for x in (deref(mm) for mm in r.m_Materials)]
                pend.append(('bones',[b.path_id for b in r.m_Bones]))
            elif tn=='BoxCollider':
                r=o.read(); n.setdefault('col',[]).append(dict(k='b',c=v3(r.m_Center),s=v3(r.m_Size,False),tr=int(r.m_IsTrigger)))
            elif tn=='SphereCollider':
                r=o.read(); n.setdefault('col',[]).append(dict(k='s',c=v3(r.m_Center),r=round(r.m_Radius,4),tr=int(r.m_IsTrigger)))
            elif tn=='CapsuleCollider':
                r=o.read(); n.setdefault('col',[]).append(dict(k='c',c=v3(r.m_Center),r=round(r.m_Radius,4),h=round(r.m_Height,4),d=r.m_Direction,tr=int(r.m_IsTrigger)))
            elif tn=='MeshCollider':
                r=o.read(); mo=deref(r.m_Mesh)
                n.setdefault('col',[]).append(dict(k='m',m=exp_malla(mo) if mo else -1,cv=int(r.m_Convex),tr=int(r.m_IsTrigger)))
            elif tn=='WheelCollider':
                r=o.read(); n['wc']=dict(c=v3(r.m_Center),r=round(r.m_Radius,4),sd=round(r.m_SuspensionDistance,4),m=round(r.m_Mass,2),
                    sp=round(r.m_SuspensionSpring.spring,1),da=round(r.m_SuspensionSpring.damper,1))
            elif tn=='Rigidbody':
                r=o.read(); n['rb']=dict(m=round(r.m_Mass,3),d=round(r.m_Drag if hasattr(r,'m_Drag') else r.m_LinearDamping,3),k=int(r.m_IsKinematic),g=int(r.m_UseGravity))
            elif tn=='CharacterJoint':
                r=o.read(); pend.append(('joint',dict(cb=r.m_ConnectedBody.path_id,a=v3(r.m_Anchor),ax=v3(r.m_Axis),sw=v3(r.m_SwingAxis),
                    lo=round(r.m_LowTwistLimit.limit,1),hi=round(r.m_HighTwistLimit.limit,1),s1=round(r.m_Swing1Limit.limit,1),s2=round(r.m_Swing2Limit.limit,1))))
            elif tn=='Light':
                r=o.read(); n['lz']=dict(t=r.m_Type,c=[round(r.m_Color.r,3),round(r.m_Color.g,3),round(r.m_Color.b,3)],i=round(r.m_Intensity,3),rg=round(r.m_Range,2),sa=round(r.m_SpotAngle,1))
            elif tn=='AudioSource':
                r=o.read(); cl=deref(r.m_audioClip)
                n.setdefault('au',[]).append(cl.read().m_Name if cl else '')
            elif tn=='Animator':
                r=o.read(); ct=deref(r.m_Controller); av=deref(r.m_Avatar)
                n['an']=dict(ct=ct.read().m_Name if ct else '',av=av.read().m_Name if av else '')
            elif tn=='LODGroup':
                r=o.read(); n['lod']=[[round(l.screenRelativeHeight,4),[x.renderer.path_id for x in l.renderers]] for l in r.m_LODs]
            elif tn=='MonoBehaviour':
                n.setdefault('mb',[]).append(script_de(o))
            elif tn=='ParticleSystem': n['ps']=1
            elif tn in('Camera',): n['cam']=1
        except Exception as e:
            n.setdefault('err',[]).append(tn+':'+str(e)[:60])
    for ch in t.m_Children:
        co=deref(ch)
        if co: nodos(co,lista,me,nodo_de)
    if pend: n['_pend']=pend
    return me
def arbol_raiz(t_ob):
    lista=[]; nodo_de={}
    nodos(t_ob,lista,-1,nodo_de)
    # resolver referencias por transform/rigidbody
    rb_de={}
    for n in lista:
        pass
    for i,n in enumerate(lista):
        for k,v in n.pop('_pend',[]):
            if k=='bones': n['bo']=[nodo_de.get(b,-1) for b in v]
            if k=='joint':
                # el connected body es un Rigidbody: buscar el nodo dueño
                o=por_id.get((None,None))
                n['jt']=v
    # LOD: renderers por path id -> nodo (renderer path ids no son transforms; se resuelve por GameObject)
    return lista
salida=dict(escenas={},prefabs={})
for o in env.objects:
    if o.type.name!='Transform': continue
    fn=o.assets_file.name
    t=o.read()
    if t.m_Father.path_id!=0: continue
    es_escena=fn.startswith('level')
    if not es_escena and fn.startswith(('sharedassets','globalgame','resources','unity')): continue
    try:
        arb=arbol_raiz(o)
    except Exception as e:
        traceback.print_exc(limit=2); continue
    if es_escena: salida['escenas'].setdefault(fn,[]).append(arb)
    else: salida['prefabs'][arb[0]['n']+'#'+fn[:6]]=arb
# ajustes de cada escena (cielo, niebla, luz ambiente)
for o in env.objects:
    if o.type.name=='RenderSettings' and o.assets_file.name.startswith('level'):
        r=o.read()
        d=dict(fog=int(r.m_Fog),fc=[r.m_FogColor.r,r.m_FogColor.g,r.m_FogColor.b],fm=r.m_FogMode,fs=r.m_LinearFogStart,fe=r.m_LinearFogEnd,fd=r.m_FogDensity,
               amb=[r.m_AmbientSkyColor.r,r.m_AmbientSkyColor.g,r.m_AmbientSkyColor.b],ae=[r.m_AmbientEquatorColor.r,r.m_AmbientEquatorColor.g,r.m_AmbientEquatorColor.b],
               ag=[r.m_AmbientGroundColor.r,r.m_AmbientGroundColor.g,r.m_AmbientGroundColor.b],am=r.m_AmbientMode,ai=r.m_AmbientIntensity)
        sk=deref(r.m_SkyboxMaterial)
        if sk: d['sky']=exp_mat(sk)
        salida.setdefault('ajustes',{})[o.assets_file.name]=d
salida['mallas']=mallas; salida['mats']=mats; salida['texs']=texs
json.dump(salida,open(OUT+'/datos.json','w'),separators=(',',':'))
open(OUT+'/mallas.bin','wb').write(blob)
print('escenas',len(salida['escenas']),'prefabs',len(salida['prefabs']),'mallas',len(mallas),'mats',len(mats),'texs',len(texs),'bin',len(blob)//1024,'KB')
