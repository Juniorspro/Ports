# Animaciones humanoides del juego (músculos de Unity) + los datos de cada Avatar para convertirlas en el motor.
# Uso: python -I humanoide.py DATOS SALIDA.json
import UnityPy, sys, math, json, struct
env = UnityPy.load(sys.argv[1]); OUT = sys.argv[2]
def d(x): return x.data if hasattr(x, 'data') else x
def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return (aw*bx+ax*bw+ay*bz-az*by, aw*by-ax*bz+ay*bw+az*bx, aw*bz+ax*by-ay*bx+az*bw, aw*bw-ax*bx-ay*by-az*bz)
def qconj(q): return (-q[0], -q[1], -q[2], q[3])
def qrot(q, v):
    x, y, z, w = q; vx, vy, vz = v
    tx = 2*(y*vz-z*vy); ty = 2*(z*vx-x*vz); tz = 2*(x*vy-y*vx)
    return (vx+w*tx+y*tz-z*ty, vy+w*ty+z*tx-x*tz, vz+w*tz+x*ty-y*tx)
V4 = lambda v: [v.x, v.y, v.z, v.w]; V3 = lambda v: [v.x, v.y, v.z]
R = lambda l, n=5: [round(x, n) for x in l]
# ---- avatares ----
avs = {}
for o in env.objects:
    if o.type.name != 'Avatar': continue
    a = o.read(); A = a.m_Avatar; H = d(A.m_Human); SK = d(H.m_Skeleton); SP = d(H.m_SkeletonPose)
    tos = dict(a.m_TOS); nodes = SK.m_Node; ids = SK.m_ID
    nom = lambda i: tos.get(ids[i], '').split('/')[-1]
    G = {}
    for i in range(len(nodes)):
        x = SP.m_X[i]; p = nodes[i].m_ParentId
        if p < 0: G[i] = (tuple(V3(x.t)), tuple(V4(x.q)))
        else: pt, pq = G[p]; G[i] = (tuple(pt[k]+qrot(pq, V3(x.t))[k] for k in range(3)), qmul(pq, V4(x.q)))
    hb = list(H.m_HumanBoneIndex); huesos = []
    if not hb or hb[0] < 0: continue
    for b, ni in enumerate(hb):
        if ni < 0 or nodes[ni].m_AxesId < 0: continue
        ax = SK.m_AxesArray[nodes[ni].m_AxesId]
        huesos.append([b, nom(ni), R(V4(ax.m_PreQ)), R(V4(ax.m_PostQ)), V3(ax.m_Sgn), R(V3(ax.m_Limit.m_Min)), R(V3(ax.m_Limit.m_Max))])
    # del "cuerpo" (centro de masa) a la cadera en la pose por defecto. El giro del cuerpo de los clips es
    # relativo a la pose T: cadera = cuerpo · caderaT (medido: así los pies quedan bajo el cuerpo al estar quieto)
    rx = d(H.m_RootX); rq = tuple(V4(rx.q)); rt = V3(rx.t)
    hp, hq = G[hb[0]]
    dt = [hp[k]-rt[k] for k in range(3)]; dq = hq
    avs[a.m_Name] = dict(h=huesos, cadera=nom(hb[0]), esc=round(H.m_Scale, 5), dt=R(list(dt)), dq=R(list(dq)), rt=R(rt))
# ---- clips por estado del controlador de personajes ----
def streamed(data):
    u = struct.pack('<%dI' % len(data), *data); keys = {}; i = 0
    while i + 8 <= len(u):
        t = struct.unpack_from('<f', u, i)[0]; n = struct.unpack_from('<i', u, i+4)[0]; i += 8
        for _ in range(n):
            idx = struct.unpack_from('<i', u, i)[0]; a, b, c, dd = struct.unpack_from('<4f', u, i+4); i += 20
            keys.setdefault(idx, []).append((t, a, b, c, dd))
    return keys
def evst(ks, t):
    k = ks[0]
    for x in ks:
        if x[0] <= t: k = x
        else: break
    dt = t - k[0]; return ((k[1]*dt+k[2])*dt+k[3])*dt+k[4]
FPS = 20
def exportar(clip):
    mc = clip.m_MuscleClip; c = mc.m_Clip.data; sc = c.m_StreamedClip; dc = c.m_DenseClip; cc = c.m_ConstantClip
    nS = sc.curveCount; nD = dc.m_CurveCount; sk = streamed(sc.data) if nS else {}
    dur = max(0.05, mc.m_StopTime - mc.m_StartTime); nf = max(2, int(round(dur*FPS))+1)
    def val(ci, t):
        if ci < nS: return evst(sk[ci], t) if ci in sk else 0.0
        ci2 = ci - nS
        if ci2 < nD:
            f = max(0, min(dc.m_FrameCount-1, (t-dc.m_BeginTime)*dc.m_SampleRate)); i0 = int(f); i1 = min(dc.m_FrameCount-1, i0+1); w = f-i0; A = dc.m_SampleArray
            return A[i0*nD+ci2]*(1-w)+A[i1*nD+ci2]*w
        return cc.data[ci2-nD]
    curvas = {}; ci = -1; sig = 0
    for g in clip.m_ClipBindingConstant.genericBindings:
        ci = sig; sig += ({1: 3, 2: 4, 3: 3, 4: 3}.get(g.attribute, 1) if (g.typeID == 4 and g.customType == 0) else 1)
        if g.customType != 8: continue
        a = g.attribute
        if not (7 <= a <= 13 or 42 <= a <= 96): continue
        fr = [round(val(ci, mc.m_StartTime + min(dur, k/FPS)), 4) for k in range(nf)]
        curvas[a] = fr if any(abs(x-fr[0]) > 1e-4 for x in fr) else [fr[0]]
    # el giro del cuerpo se toma respecto de cómo empieza el clip (los clips vienen mirando para cualquier lado)
    qs = [curvas.get(a, [0.0 if a < 13 else 1.0]) for a in (10, 11, 12, 13)]
    if any(len(x) > 1 for x in qs) or qs[1][0] or qs[0][0] or qs[2][0]:
        n = max(len(x) for x in qs); g = lambda x, k: x[k] if len(x) > 1 else x[0]
        q0 = qs[0][0], qs[1][0], qs[2][0], qs[3][0]
        f = qrot(q0, (0, 0, 1)); yaw = math.atan2(f[0], f[2]); r = (0, math.sin(-yaw / 2), 0, math.cos(-yaw / 2))
        nq = [qmul(r, (g(qs[0], k), g(qs[1], k), g(qs[2], k), g(qs[3], k))) for k in range(n)]
        for j, a in enumerate((10, 11, 12, 13)): curvas[a] = [round(q[j], 4) for q in nq]
    return dict(d=round(dur, 4), nf=nf, c=curvas, loop=int(getattr(mc, 'm_LoopTime', 0)))
estados = {}
for o in env.objects:
    if o.type.name != 'AnimatorController' or o.read().m_Name != 'CharacterAnimator': continue
    a = o.read(); tos = dict(a.m_TOS); clips = [x.read() if x.path_id else None for x in a.m_AnimationClips]
    for sm in d(a.m_Controller).m_StateMachineArray:
        for st in d(sm).m_StateConstantArray:
            st = d(st); nm = tos.get(st.m_NameID, str(st.m_NameID)); L = []
            for bt in st.m_BlendTreeConstantArray:
                for nd in d(bt).m_NodeArray:
                    nd = d(nd)
                    if nd.m_ClipID < len(clips) and clips[nd.m_ClipID] is not None:
                        L.append(clips[nd.m_ClipID])
            if L and nm not in estados: estados[nm] = L
out = dict(fps=FPS, av=avs, est={})
hechos = {}
for nm, L in estados.items():
    lst = []
    for c in L:
        k = c.m_Name + '#' + str(id(c))
        if c.m_Name not in hechos or c.m_Name == 'mixamo.com': hechos[c.m_Name + str(len(hechos))] = 1
        lst.append(dict(n=c.m_Name, **exportar(c)))
    out['est'][nm] = lst
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
import os
print('avatares', len(avs), 'estados', len(out['est']), round(os.path.getsize(OUT)/1e6, 2), 'MB')
