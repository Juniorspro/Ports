# Dedos para los skins generados (Goku, Rick, Finn...): sus mallas no tienen pesos en los dedos (la mano entera pesa en el
# hueso de la mano), así que no se pueden cerrar sobre un arma. Esto reparte los vértices de cada mano entre las falanges
# del índice al meñique según dónde están a lo largo de la mano (palma 55 %, después las tres falanges) y a lo ancho (cuatro
# franjas suaves, del lado del índice al del meñique), y pone las articulaciones de esos dedos en el medio de su franja, a
# la altura de los dedos de la malla (las orientaciones de enlace no cambian: animan igual). El pulgar es lo que sobresale
# del borde de la palma del lado del índice: sus huesos van a lo largo de ese pedazo de malla y sus vértices pesan en él.
# Uso: python3 -I dedos_meshy.py PAQUETE_ORIGEN PAQUETE_NUEVO [SKIN ...]   (sin skins: todos los que no tienen pesos en los dedos)
import sys, os, json, gzip, shutil, numpy as np

PK0, PK1 = sys.argv[1], sys.argv[2]; PEDIDOS = sys.argv[3:]
d = json.load(gzip.open(PK0 + '/d.json.gz')); BIN = bytearray(gzip.decompress(open(PK0 + '/m.bin.gz', 'rb').read()))
arb = d['pf']['PhotonPlayer#b2dc44']
CR = next(i for i, n in enumerate(arb) if n['n'] == 'CharactersRoot')
DEDOS = ['Index', 'Middle', 'Ring', 'Pinky']
nombre = lambda i: arb[i]['n'].split(':')[-1]

def sub_arbol(R):
    s = [R]; k = 0
    while k < len(s): s += [i for i, n in enumerate(arb) if n['pa'] == s[k]]; k += 1
    return s

def suave(t, a, b):   # 0 antes de a, 1 después de b, en el medio lineal
    return np.clip((t - a) / max(b - a, 1e-9), 0, 1)

hechos = []
for R in [i for i, n in enumerate(arb) if n['pa'] == CR]:
    skin = arb[R]['n']
    if skin not in d['chars'] or (PEDIDOS and skin not in PEDIDOS): continue
    mallas = [i for i in sub_arbol(R) if arb[i].get('bo') and 'm' in arb[i] and not arb[i]['n'].startswith('(POLY FEW)')]
    if len(mallas) != 1: continue   # (los generados tienen una sola malla con piel)
    MI = mallas[0]; x = arb[MI]; m = d['ms'][x['m']]; bo = x['bo']; nb = len(bo)
    nom = [nombre(b) if b >= 0 else '-' for b in bo]; K = {n: k for k, n in enumerate(nom)}
    if not all(l + 'Hand' + f + '1' in K for l in ('Left', 'Right') for f in DEDOS): continue
    V = np.array(m['mn']) + np.frombuffer(bytes(BIN[m['o']:m['o'] + m['v'] * 14]), np.uint8).reshape(-1, 14)[:, 0:6].copy().view('<u2').astype(np.float64) / 65535 * np.array(m['sc'])
    SK = np.frombuffer(bytes(BIN[m['sk']:m['sk'] + m['v'] * 8]), np.uint8).reshape(-1, 8).copy()
    Wt = np.zeros((m['v'], nb))
    for c in range(4): np.add.at(Wt, (np.arange(m['v']), SK[:, c]), SK[:, 4 + c] / 255.0)
    dedos_idx = [K[l + 'Hand' + f + str(s)] for l in ('Left', 'Right') for f in DEDOS for s in (1, 2, 3) if l + 'Hand' + f + str(s) in K]
    if Wt[:, dedos_idx].sum() > 1.0 and not PEDIDOS: continue   # (ya tiene dedos pesados)
    BP = np.array(m['bp'], dtype=np.float64).reshape(-1, 4, 4); GH = np.array([np.linalg.inv(b) for b in BP]); GN = GH.copy()
    J = lambda n: GH[K[n]][:3, 3]
    inf = []; PUNTAS = {}; puntas_pulgar = {}
    for lado in ('Left', 'Right'):
        h = J(lado + 'Hand'); kn = {f: J(lado + 'Hand' + f + '1') for f in DEDOS}
        ex = np.mean(list(kn.values()), 0) - h; ex /= np.linalg.norm(ex)
        n = np.cross(kn['Pinky'] - h, kn['Index'] - h); n -= ex * (n @ ex); n /= np.linalg.norm(n); ez = np.cross(ex, n)
        hk = K[lado + 'Hand']; sel = np.where(Wt[:, hk] >= 0.5)[0]
        if len(sel) < 30: continue
        Q = V[sel] - h; s = Q @ ex; u = Q @ ez; w = Q @ n
        smax = np.percentile(s, 99); sk = 0.55 * smax; F = smax - sk
        # el pulgar: lo que sobresale del borde de la palma (medida a mitad de la palma) del lado del índice
        sg = 1.0 if (kn['Index'] - kn['Pinky']) @ ez > 0 else -1.0
        mp = (s > 0.2 * smax) & (s < 0.45 * smax)
        borde = np.percentile(sg * u[mp], 90) if mp.sum() > 8 else np.percentile(sg * u, 90)
        ancho = np.percentile(sg * u[mp], 90) - np.percentile(sg * u[mp], 10) if mp.sum() > 8 else 0
        pul = (sg * u > borde + 0.08 * ancho) & (s < 0.8 * smax) & (s > 0.05 * smax)
        if pul.sum() < 8: pul[:] = False
        dedo = sel[(s > sk) & ~pul]; ud = u[(s > sk) & ~pul]
        if len(dedo) < 12: continue
        ulo, uhi = np.percentile(ud, 5), np.percentile(ud, 95); D_ = (uhi - ulo) / 4
        # (el índice del lado donde el esqueleto tiene el índice)
        orden = DEDOS if sg < 0 else DEDOS[::-1]
        cen = {f: ulo + (i + 0.5) * D_ for i, f in enumerate(orden)}
        wbar = {f: float(np.mean(w[(s > sk) & (np.abs(u - cen[f]) < D_)])) if np.any((s > sk) & (np.abs(u - cen[f]) < D_)) else float(np.mean(w)) for f in DEDOS}
        # pesos nuevos de los vértices de la mano: mano → falanges, suave entre franjas y entre falanges
        t = (s - sk) / F
        wm = 1 - suave(t, -0.12, 0.06)            # (lo que sigue en la mano: la palma, con un borde suave)
        lat = np.stack([np.exp(-((u - cen[f]) / (0.6 * D_)) ** 2) for f in DEDOS], 1); lat /= lat.sum(1, keepdims=True)
        f1 = 1 - suave(t, 0.37, 0.53); f3 = suave(t, 0.67, 0.83); f2 = 1 - f1 - f3
        nuevo = np.zeros((len(sel), nb)); nuevo[:, hk] = wm
        for i, f in enumerate(DEDOS):
            for ss, fs in ((1, f1), (2, f2), (3, f3)): nuevo[:, K[lado + 'Hand' + f + str(ss)]] += (1 - wm) * lat[:, i] * fs
        tb = None
        if pul.any() and all(lado + 'HandThumb' + str(k) in K for k in (1, 2, 3)):
            # el pulgar: de su base (lo más cerca de la palma) a la punta (lo más lejos de la base)
            P_ = V[sel[pul]]; cpal = h + 0.3 * smax * ex
            dpal = np.linalg.norm(P_ - cpal, axis=1); base = P_[dpal <= np.percentile(dpal, 15)].mean(0)
            dba = np.linalg.norm(P_ - base, axis=1); punta = P_[dba >= np.percentile(dba, 95)].mean(0)
            ax = punta - base; Lp = np.linalg.norm(ax); ax /= max(Lp, 1e-9)
            tp = ((V[sel] - base) @ ax) / max(Lp, 1e-9)
            nuevo[pul] = 0; t2 = tp[pul]; g3 = suave(t2, 0.4, 0.6)
            nuevo[pul, K[lado + 'HandThumb2']] = 1 - g3; nuevo[pul, K[lado + 'HandThumb3']] = g3
            tb = (h + 0.2 * smax * ex + sg * (borde - 0.25 * ancho) * ez, base, base + 0.5 * Lp * ax, punta)
        # sólo se reparte lo que pesaba la mano (lo del antebrazo, en la muñeca, se conserva)
        hw = Wt[sel, hk].copy(); Wt[sel, hk] = 0; Wt[sel] += nuevo * hw[:, None]
        puntas = {f: h + smax * ex + cen[f] * ez + wbar[f] * n for f in DEDOS}
        # las articulaciones de los dedos, en el medio de su franja
        for f in DEDOS:
            for ss, frac in ((1, 0), (2, 0.45), (3, 0.75), (4, 1.0)):
                bn = lado + 'Hand' + f + str(ss)
                if bn in K: GN[K[bn]][:3, 3] = h + (sk + frac * F) * ex + cen[f] * ez + wbar[f] * n
        if tb is not None:
            for ss, q in zip((1, 2, 3, 4), tb):
                bn = lado + 'HandThumb' + str(ss)
                if bn in K: GN[K[bn]][:3, 3] = q
            puntas_pulgar[lado] = tb[3]
        inf.append('%s: %d vértices (pulgar %d), mano %.1f cm (palma %.1f)' % (lado, len(sel), int(pul.sum()), smax * 100 * arb[R]['s'][0], sk * 100 * arb[R]['s'][0]))
        PUNTAS[lado] = puntas
    if not inf: continue
    # pesos: los 4 mayores, en bytes que suman 255
    top = np.argsort(-Wt, 1)[:, :4]; tw = np.take_along_axis(Wt, top, 1); tw /= np.maximum(tw.sum(1, keepdims=True), 1e-9)
    wb = np.floor(tw * 255).astype(np.int32); wb[:, 0] += 255 - wb.sum(1)
    SK[:, :4] = top; SK[:, 4:] = wb; BIN[m['sk']:m['sk'] + m['v'] * 8] = SK.tobytes()
    m['bp'] = [list(map(float, np.linalg.inv(g).reshape(16))) for g in GN]
    # los nodos de los dedos: su lugar respecto del padre (con la proporción que ya tenían entre nodo y pose de enlace)
    hueso_de = {b: k for k, b in enumerate(bo) if b >= 0}
    for b, k in hueso_de.items():
        if not any(f in nom[k] for f in DEDOS + ['Thumb']) or 'Hand' not in nom[k]: continue
        pa = arb[b]['pa']
        if pa not in hueso_de: continue
        Th = np.linalg.inv(GH[hueso_de[pa]]) @ GH[k]; Tn = np.linalg.inv(GN[hueso_de[pa]]) @ GN[k]
        lh = np.linalg.norm(Th[:3, 3]); kk = np.linalg.norm(arb[b]['p']) / lh if lh > 1e-6 else 1.0
        arb[b]['p'] = (Tn[:3, 3] * kk).tolist()
        # (la punta del dedo, si es un nodo sin piel colgado de la tercera falange: en la punta de la malla)
        if nom[k][-1] == '3' and nom[k][:-1].endswith(tuple(DEDOS)):
            lado = 'Left' if nom[k].startswith('Left') else 'Right'; f = next(x for x in DEDOS if nom[k].endswith(x + '3'))
            for c in [i for i, nn in enumerate(arb) if nn['pa'] == b and nombre(i).endswith(f + '4') and i not in hueso_de]:
                if lado in PUNTAS: lp = np.linalg.inv(GN[k]) @ np.append(PUNTAS[lado][f], 1); arb[c]['p'] = (lp[:3] * kk).tolist()
        if nom[k].endswith('Thumb3'):
            lado = 'Left' if nom[k].startswith('Left') else 'Right'
            for c in [i for i, nn in enumerate(arb) if nn['pa'] == b and nombre(i).endswith('Thumb4') and i not in hueso_de]:
                if lado in puntas_pulgar: lp = np.linalg.inv(GN[k]) @ np.append(puntas_pulgar[lado], 1); arb[c]['p'] = (lp[:3] * kk).tolist()
    hechos.append(skin); print(skin, '·', ' · '.join(inf))
# ---------------- archivos ----------------
if os.path.exists(PK1): shutil.rmtree(PK1)
os.makedirs(PK1)
for sd in os.listdir(PK0):
    if os.path.isdir(PK0 + '/' + sd):
        os.makedirs(PK1 + '/' + sd)
        for f in os.listdir(PK0 + '/' + sd): os.link(PK0 + '/' + sd + '/' + f, PK1 + '/' + sd + '/' + f)
    elif sd not in ('m.bin.gz', 'd.json.gz'): os.link(PK0 + '/' + sd, PK1 + '/' + sd)
open(PK1 + '/m.bin.gz', 'wb').write(gzip.compress(bytes(BIN), 6))
open(PK1 + '/d.json.gz', 'wb').write(gzip.compress(json.dumps(d, separators=(',', ':')).encode(), 6))
print('listo:', len(hechos), 'skins con dedos:', ', '.join(hechos))
