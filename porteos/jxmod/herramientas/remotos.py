# Paquetes aparte: lo pesado que no hace falta para arrancar (los personajes que no son el Hero y los mapas grandes, con
# sus mallas y sus texturas) sale del HTML y va a archivos sueltos en web/rb/, al lado del HTML, que el juego baja
# cuando los necesita (datos.js: rbAsegurar). Cada archivo lleva su contenido en el nombre (nombre.hash.rbp): se guarda
# en la caché del navegador para siempre y un HTML viejo sigue encontrando los suyos.
# Formato .rbp: 'RBP1', largo del índice (u32), índice JSON {m: [inicio, largo] (mallas, gzip), t: {N: [inicio, largo]}},
# los bytes. Las mallas del paquete van pegadas y sus desplazamientos (o, sk, i) se cuentan desde el inicio de ese bloque.
import json, gzip, hashlib, struct, collections, math

CORE_ESC = {'FlatGrass', 'Desert', 'DesertV2', 'Mars', 'Space'}   # (mapas chicos: se quedan adentro)
CORE_SKIN = {'Hero'}
# prefabs que van en un paquete propio (prefijo del nombre → grupo): se bajan al ponerlos o al abrir su sección
PF_APARTE = {'NK_': 'p_nuk'}
SON_APARTE = {'NK_': 'p_nuk', 'MM_': 'a_memes', 'fn_': 'm_RB_Pizzeria'}
# los que además van en otro paquete chico (los Pill Packs, juego/pillpacks.js: transformado en un animatrónico suenan el
# grito, la risa, los pasos... sin bajar los 5 MB de la pizzería; la pizzería sigue trayendo los suyos)
SON_TAMBIEN = {'a_pill': ('fn_grito', 'fn_risa', 'fn_paso1', 'fn_paso2', 'fn_paso3', 'fn_cajita', 'fn_estatica', 'fn_ollas', 'fn_foxycorre')}
# los 50 rumbos del casco fino de objetos.js (DIR_FINO y arriba/abajo) y los 14 del común
_DIR_FINO = [(math.cos(i * 2.39996323) * math.sqrt(1 - (1 - (2 * i + 1) / 48) ** 2), 1 - (2 * i + 1) / 48, math.sin(i * 2.39996323) * math.sqrt(1 - (1 - (2 * i + 1) / 48) ** 2)) for i in range(48)] + [(0, 1, 0), (0, -1, 0)]
_DIR_14 = [tuple(c / math.sqrt(abs(x) + abs(y) + abs(z)) for c in (x, y, z)) for x in (-1, 0, 1) for y in (-1, 0, 1) for z in (-1, 0, 1) if (x or y or z) and abs(x) + abs(y) + abs(z) != 2]


def _largo_idx(m):
    return max((s[0] + s[1] for s in m.get('sub') or []), default=0) * (4 if m.get('i32') else 2)


def _rangos(m):
    """los pedazos del bloque de mallas que usa una malla: vértices, piel e índices"""
    if m.get('o') is None: return []
    r = [(m['o'], m['o'] + m['v'] * 14)]
    if m.get('sk') is not None: r.append((m['sk'], m['sk'] + m['v'] * 8))
    n = _largo_idx(m)
    if n: r.append((m['i'], m['i'] + n))
    return r


def _texturas_de_mat(mt):
    t = set()
    for k in ('t', 't2'):
        if isinstance(mt.get(k), int) and mt[k] >= 0: t.add(mt[k])
    for v in (mt.get('tt') or {}).values():
        if isinstance(v, list) and v and isinstance(v[0], int) and v[0] >= 0: t.add(v[0])
    return t


def _casco_puntos(MB, m, fino):
    """los puntos que objetos.js usa para el casco de choque de una malla (los mismos: cada 'paso' vértices, y de ésos los
    extremos en sus rumbos, en el mismo orden: el casco sale idéntico), para armar el cuerpo sin bajar la malla. u16
    respecto de mn/sc, como los vértices"""
    n = m['v']; paso = max(1, n // (4000 if fino else 400))
    f32 = lambda x: struct.unpack('<f', struct.pack('<f', x))[0]
    Q, P = [], []
    for k in range(0, n, paso):
        q = struct.unpack_from('<3H', MB, m['o'] + k * 14); Q.append(q)
        P.append(tuple(f32(m['mn'][a] + q[a] / 65535 * m['sc'][a]) for a in range(3)))
    if len(P) <= 16: return [c for q in Q for c in q]
    S = []
    for d in (_DIR_FINO if fino else _DIR_14):
        bi, bv = 0, -1e9
        for i, p in enumerate(P):
            v = p[0] * d[0] + p[1] * d[1] + p[2] * d[2]
            if v > bv: bv, bi = v, i
        if bi not in S: S.append(bi)
    return [c for i in S for c in Q[i]]


def partir(DJ, MB, texturas, filtrar, audios=None):
    """DJ: datos (se modifica), MB: bloque de mallas crudo, texturas: {N: bytes} (se sacan las que van aparte),
    filtrar(bytearray, mallas) -> bytearray con los índices filtrados. Devuelve (MB_nuevo, paquetes {nombre: bytes})"""
    ms, mts = DJ['ms'], DJ['mt']
    dueños = collections.defaultdict(set)      # malla → grupos que la usan
    mat_d = collections.defaultdict(set)       # material → grupos
    def marcar(nodos, grupo_de):
        for i, n in enumerate(nodos):
            if not isinstance(n, dict): continue
            g = grupo_de(i)
            if isinstance(n.get('m'), int):
                dueños[n['m']].add(g)
                for l in ms[n['m']].get('lods') or []: dueños[l].add(g)
            for mi in n.get('mt') or []:
                if isinstance(mi, int) and mi >= 0: mat_d[mi].add(g)
            for c in n.get('col') or []:
                if isinstance(c, dict) and isinstance(c.get('m'), int): dueños[c['m']].add(g)
    chars = set(DJ['chars'])
    for k, nodos in DJ['pf'].items():
        # en los árboles de personajes, cada nodo es del personaje que lo tiene arriba (hijo de un CharactersRoot)
        grupo = []
        for i, n in enumerate(nodos):
            pa = n.get('pa', -1)
            if pa >= 0 and nodos[pa]['n'] == 'CharactersRoot' and n['n'] in chars: grupo.append('s_' + n['n'])
            elif pa >= 0 and grupo[pa] and grupo[pa].startswith('s_'): grupo.append(grupo[pa])
            else: grupo.append(next((g for pre, g in PF_APARTE.items() if k.startswith(pre)), 'pf'))
        marcar(nodos, lambda i: grupo[i])
    for k, capas in DJ['esc'].items():
        for nodos in capas if isinstance(capas, list) else []:
            if isinstance(nodos, list): marcar(nodos, lambda i, k=k: 'm_' + k)
    # los animatrónicos de la pizzería (noche.js los arma de DATA.fn.pf) van con el mapa
    for nodos in ((DJ.get('fn') or {}).get('pf') or {}).values(): marcar(nodos, lambda i: 'm_RB_Pizzeria')
    # lo demás que usa el código directo (armas de GMod, emotes...) se queda: no tiene grupo
    def aparte(g): return g.startswith('s_') and g[2:] not in CORE_SKIN or g.startswith('m_') and g[2:] not in CORE_ESC or g in PF_APARTE.values()
    grupo_malla = {}
    for i, m in enumerate(ms):
        g = dueños.get(i)
        if g and len(g) == 1 and aparte(next(iter(g))) and m.get('o') is not None: grupo_malla[i] = next(iter(g))
    # una zona del bloque compartida con una malla que se queda, se queda
    queda = set()
    for i, m in enumerate(ms):
        if i not in grupo_malla:
            for r in _rangos(m): queda.add(r)
    for i in list(grupo_malla):
        if any(r in queda for r in _rangos(ms[i])): del grupo_malla[i]
    # los prefabs aparte se arman (cuerpo y choques) sin la malla: llevan los puntos de su casco en los datos
    for k, nodos in DJ['pf'].items():
        if not any(k.startswith(pre) for pre in PF_APARTE): continue
        for n in nodos:
            for c in n.get('col') or []:
                if isinstance(c, dict) and c.get('k') == 'm' and c.get('m') in grupo_malla and 'hp' not in ms[c['m']]:
                    ms[c['m']]['hp'] = _casco_puntos(MB, ms[c['m']], c.get('cv') == 2)
    # texturas: van con el grupo si todos los materiales que las usan son de ese grupo
    tex_g = collections.defaultdict(set)
    for mi, gs in mat_d.items():
        for t in _texturas_de_mat(mts[mi]): tex_g[t] |= gs
    for mi, mt in enumerate(mts):
        if mi not in mat_d:
            for t in _texturas_de_mat(mt): tex_g[t].add('?')
    grupo_tex = {t: next(iter(g)) for t, g in tex_g.items() if len(g) == 1 and aparte(next(iter(g))) and t in texturas}
    # el bloque que se queda: sin los pedazos de las mallas que se van (los demás desplazamientos se corren)
    fuera = sorted({r for i in grupo_malla for r in _rangos(ms[i])})
    corte = []   # [inicio, fin] de lo que se saca, ordenado y sin solapes
    for a, b in fuera:
        if corte and a <= corte[-1][1]: corte[-1][1] = max(corte[-1][1], b)
        else: corte.append([a, b])
    import bisect
    ini = [c[0] for c in corte]; acum = [0]
    for a, b in corte: acum.append(acum[-1] + b - a)
    def nuevo(o):
        k = bisect.bisect_right(ini, o)
        if k and o < corte[k - 1][1]: raise ValueError('desplazamiento adentro de algo que se fue: %d' % o)
        return o - acum[k]
    # paquetes de mallas
    por_g = collections.defaultdict(list)
    for i, g in grupo_malla.items(): por_g[g].append(i)
    paquetes = {}
    for g, lista in sorted(por_g.items()):
        blk = bytearray(); mapa = {}
        for i in sorted(lista, key=lambda i: ms[i]['o']):
            m = ms[i]
            for campo in ('o', 'sk', 'i'):
                if m.get(campo) is None: continue
                largo = m['v'] * 14 if campo == 'o' else m['v'] * 8 if campo == 'sk' else _largo_idx(m)
                if not largo: continue
                a = m[campo]
                if a not in mapa: mapa[a] = len(blk); blk += MB[a:a + largo]
        sub = []
        for i in lista:
            m = dict(ms[i])
            for campo in ('o', 'sk', 'i'):
                if m.get(campo) is not None and (campo != 'i' or _largo_idx(m)): m[campo] = mapa[m[campo]]
            sub.append(m)
        blk = filtrar(blk, sub)
        for i, m in zip(lista, sub):
            for campo in ('o', 'sk', 'i'):
                if m.get(campo) is not None: ms[i][campo] = m[campo]
            ms[i]['k'] = g
        paquetes[g] = {'m': gzip.compress(bytes(blk), 9, mtime=0), 't': {}}
    for t, g in grupo_tex.items():
        paquetes.setdefault(g, {'m': None, 't': {}})['t'][t] = texturas.pop(t)
        DJ['tx'][t]['k'] = g
    # sonidos: los de la pizzería con el mapa, los memes en uno propio (se bajan al abrir el pad), los de las bombas con ellas
    for g2, L in SON_TAMBIEN.items():
        for n in L:
            if n in (audios or {}): paquetes.setdefault(g2, {'m': None, 't': {}}).setdefault('a', {})[n] = audios[n]
    for n in list(audios or {}):
        g = next((g for pre, g in SON_APARTE.items() if n.startswith(pre)), None)
        if g: paquetes.setdefault(g, {'m': None, 't': {}}).setdefault('a', {})[n] = audios.pop(n)
    # el bloque nuevo y los desplazamientos de lo que se quedó (mallas y clips de la pizzería)
    nuevoMB = bytearray(); o = 0
    for a, b in corte: nuevoMB += MB[o:a]; o = b
    nuevoMB += MB[o:]
    for i, m in enumerate(ms):
        if i in grupo_malla or m.get('o') is None: continue
        for campo in ('o', 'sk', 'i'):
            if m.get(campo) is not None and (campo != 'i' or _largo_idx(m)): m[campo] = nuevo(m[campo])
    for c in ((DJ.get('fn') or {}).get('clips') or {}).values():
        if isinstance(c, dict) and isinstance(c.get('o'), int): c['o'] = nuevo(c['o'])
    # los archivos
    salida = {}
    for g, p in sorted(paquetes.items()):
        idx, cuerpo = {'t': {}}, bytearray()
        if p['m']: idx['m'] = [0, len(p['m'])]; cuerpo += p['m']
        for t, b in sorted(p['t'].items()): idx['t'][str(t)] = [len(cuerpo), len(b)]; cuerpo += b
        if p.get('a'):
            idx['a'] = {}
            for n, b in sorted(p['a'].items()): idx['a'][n] = [len(cuerpo), len(b)]; cuerpo += b
        j = json.dumps(idx, separators=(',', ':')).encode()
        datos = b'RBP1' + struct.pack('<I', len(j)) + j + bytes(cuerpo)
        nom = '%s.%s.rbp' % (g, hashlib.sha1(datos).hexdigest()[:10])
        salida[nom] = datos
        DJ.setdefault('rbp', {})[g] = [nom, len(datos)]
    # de qué mapas dependen otros paquetes (la pizzería necesita a los animatrónicos como personajes)
    return nuevoMB, salida
