# Animaciones genéricas (brazos y armas): curvas de Unity -> pistas muestreadas a 30 cuadros/s
import UnityPy,sys,json,struct,math,zlib
env=UnityPy.load(sys.argv[1]); OUT=sys.argv[2]
FPS=30
def euler_q(e):
    # Unity: grados, orden Z, X, Y (q = qy*qx*qz)
    x,y,z=[math.radians(v)/2 for v in e]
    cx,sx,cy,sy,cz,sz=math.cos(x),math.sin(x),math.cos(y),math.sin(y),math.cos(z),math.sin(z)
    def mul(a,b):
        ax,ay,az,aw=a; bx,by,bz,bw=b
        return (aw*bx+ax*bw+ay*bz-az*by, aw*by-ax*bz+ay*bw+az*bx, aw*bz+ax*by-ay*bx+az*bw, aw*bw-ax*bx-ay*by-az*bz)
    return mul(mul((0,sy,0,cy),(sx,0,0,cx)),(0,0,sz,cz))
def streamed(data,ncurves):
    u=struct.pack('<%dI'%len(data),*data)
    keys={}  # curva -> lista (t, a,b,c,d)
    i=0
    while i+8<=len(u):
        t=struct.unpack_from('<f',u,i)[0]; n=struct.unpack_from('<i',u,i+4)[0]; i+=8
        for _ in range(n):
            idx=struct.unpack_from('<i',u,i)[0]; a,b,c,d=struct.unpack_from('<4f',u,i+4); i+=20
            keys.setdefault(idx,[]).append((t,a,b,c,d))
    return keys
def eval_st(ks,t):
    k=ks[0]
    for x in ks:
        if x[0]<=t: k=x
        else: break
    dt=t-k[0]
    return ((k[1]*dt+k[2])*dt+k[3])*dt+k[4]
clips={}
for o in env.objects:
    if o.type.name!='AnimationClip': continue
    a=o.read(); mc=a.m_MuscleClip; c=mc.m_Clip.data; b=a.m_ClipBindingConstant
    gb=b.genericBindings
    if not gb or any(g.customType==8 for g in gb): continue   # humanoides afuera
    dur=max(1e-3,mc.m_StopTime-mc.m_StartTime); t0=mc.m_StartTime
    sc=c.m_StreamedClip; dc=c.m_DenseClip; cc=c.m_ConstantClip
    nS=sc.curveCount; nD=dc.m_CurveCount
    sk=streamed(sc.data,nS) if nS else {}
    nf=max(2,int(round(dur*FPS))+1)
    def val(ci,t):
        if ci<nS: return eval_st(sk[ci],t) if ci in sk else 0.0
        ci2=ci-nS
        if ci2<nD:
            f=(t-dc.m_BeginTime)*dc.m_SampleRate; f=max(0,min(dc.m_FrameCount-1,f)); i0=int(f); i1=min(dc.m_FrameCount-1,i0+1); w=f-i0
            A=dc.m_SampleArray
            return A[i0*nD+ci2]*(1-w)+A[i1*nD+ci2]*w
        return cc.data[ci2-nD]
    pistas=[]; ci=0
    for g in gb:
        if g.typeID==4 and g.customType==0:
            n={1:3,2:4,3:3,4:3}.get(g.attribute,1)
        else: n=1
        if g.typeID==4 and g.attribute in(1,2,3,4):
            fr=[]
            for k in range(nf):
                t=t0+min(dur,k/FPS)
                v=[val(ci+j,t) for j in range(n)]
                if g.attribute==4: v=list(euler_q(v)); 
                if g.attribute in(2,4):
                    l=math.sqrt(sum(x*x for x in v)) or 1; v=[x/l for x in v]; v=[v[0],-v[1],-v[2],v[3]]
                elif g.attribute==1: v=[-v[0],v[1],v[2]]
                fr.append([round(x,5) for x in v])
            # pista constante -> un cuadro
            if all(f==fr[0] for f in fr): fr=[fr[0]]
            pistas.append(dict(h=g.path,k='p' if g.attribute==1 else 's' if g.attribute==3 else 'r',f=fr))
        elif g.typeID==1:
            fr=[round(val(ci,t0+min(dur,k/FPS)),3) for k in range(nf)]
            pistas.append(dict(h=g.path,k='a',f=fr if any(x!=fr[0] for x in fr) else [fr[0]]))
        ci+=n
    clips.setdefault(a.m_Name,[]).append(dict(d=round(dur,4),loop=int(a.m_MuscleClip.m_LoopTime) if hasattr(a.m_MuscleClip,'m_LoopTime') else 0,p=pistas,pid=o.path_id))
# controladores -> clips
ctl={}
for o in env.objects:
    if o.type.name!='AnimatorController': continue
    a=o.read()
    try: ctl[a.m_Name]=[x.read().m_Name for x in a.m_AnimationClips if x.path_id]
    except Exception as e: ctl[a.m_Name]=['?'+str(e)[:40]]
json.dump(dict(fps=FPS,clips=clips,ctl=ctl),open(OUT,'w'),separators=(',',':'))
print(len(clips),'clips genéricos'); print(json.dumps(ctl)[:1500])
