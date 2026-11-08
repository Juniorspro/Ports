# La tabla de guiones de sonido de GMod que usa juego/gmod_sonidos.js (GMSN_GUIONES).
# GMod trae los guiones de sonido de HL2, CS:S, DoD:S, TF2 y L4D (garrysmod/scripts/sounds/*.txt, cargados en el orden de
# su game_sounds_manifest.txt: si un nombre se repite, gana el primero). Los addons usan esos nombres en EmitSound
# ("Weapon_Minigun.Fire", "Weapon_Pistol.Single") y traen sólo los .wav. De cada guion queda el nombre, sus .wav, el
# volumen, el tono y el canal: «nombre=wave1,wave2[@volumen][%tono][!canal]», con "~" por "weapons/", sin ".wav" y
# a{1-3} por a1,a2,a3.
# uso: python3 gmod_guiones.py CARPETA_CON_LOS_TXT [juego/gmod_sonidos.js]
#   (los .txt: https://github.com/Facepunch/garrysmod/tree/master/garrysmod/scripts/sounds)
import os, re, sys

ORDEN = ['hl2_game_sounds.txt', 'hl2_game_sounds_items.txt', 'hl2_game_sounds_player.txt', 'hl2_game_sounds_weapons.txt',
         'game_sounds_weapons_episodic.txt', 'game_sounds_weapons_ep2.txt', 'cs_game_sounds_weapons.txt',
         'dod_game_sounds_weapons.txt', 'tf2_game_sounds_weapons.txt', 'l4d_game_sounds_weapons.txt']
CANAL = {'chan_weapon': 1, 'chan_voice': 2, 'chan_item': 3, 'chan_body': 4}


def fichas(s):
    i, n = 0, len(s)
    while i < n:
        c = s[i]
        if c in ' \t\r\n': i += 1; continue
        if s.startswith('//', i):
            j = s.find('\n', i); i = n if j < 0 else j; continue
        if c in '{}': yield c; i += 1; continue
        if c == '"':
            j = s.find('"', i + 1); j = n if j < 0 else j; yield ('s', s[i + 1:j]); i = j + 1; continue
        if c == '[':   # (condicionales: [$WIN32])
            j = s.find(']', i); j = n - 1 if j < 0 else j; yield ('c', s[i:j + 1]); i = j + 1; continue
        j = i
        while j < n and s[j] not in ' \t\r\n{}"': j += 1
        yield ('s', s[i:j]); i = j


def leer_kv(s):
    T = list(fichas(s)); p = 0

    def bloque():
        nonlocal p
        out = []
        while p < len(T):
            t = T[p]
            if t == '}': p += 1; return out
            if t == '{': p += 1; out.append((None, bloque())); continue
            if t[0] == 'c': p += 1; continue
            k = t[1]; p += 1
            while p < len(T) and T[p] not in ('{', '}') and T[p][0] == 'c': p += 1
            if p < len(T) and T[p] == '{': p += 1; out.append((k, bloque())); continue
            if p < len(T) and T[p] != '}' and T[p][0] == 's':
                v = T[p][1]; p += 1
                while p < len(T) and T[p] not in ('{', '}') and T[p][0] == 'c': p += 1
                out.append((k, v))
        return out
    return bloque()


def guiones(ruta):
    R = {}
    for k, v in leer_kv(open(ruta, encoding='latin1').read()):
        if k is None or not isinstance(v, list): continue
        e = {'w': []}
        for kk, vv in v:
            kl = (kk or '').lower()
            if kl == 'wave' and isinstance(vv, str): e['w'].append(vv)
            elif kl == 'rndwave' and isinstance(vv, list): e['w'] += [x for kx, x in vv if (kx or '').lower() == 'wave' and isinstance(x, str)]
            elif kl in ('volume', 'pitch', 'channel') and isinstance(vv, str): e[kl] = vv
        R.setdefault(k.lower(), e)
    return R


def numero(x, d):
    if x is None: return d
    x = x.strip().lower()
    if x == 'vol_norm': return 1.0
    if x == 'pitch_norm': return 100
    if x == 'pitch_low': return 95
    if x == 'pitch_high': return 120
    v = [float(y) for y in re.findall(r'[-+]?\d*\.?\d+', x)][:2]
    return sum(v) / len(v) if v else d


def rangos(ws):   # a1,a2,a3 → a{1-3}
    out, i = [], 0
    while i < len(ws):
        m = re.match(r'^(.*?)([1-9]\d*)$', ws[i]); j = i + 1
        if m:
            while j < len(ws):
                m2 = re.match(r'^(.*?)([1-9]\d*)$', ws[j])
                if not m2 or m2.group(1) != m.group(1) or int(m2.group(2)) != int(m.group(2)) + (j - i): break
                j += 1
            if j - i >= 3: out.append('%s{%d-%d}' % (m.group(1), int(m.group(2)), int(m.group(2)) + j - i - 1)); i = j; continue
        out.append(ws[i]); i += 1
    return out


def tabla(carpeta):
    T = {}
    for f in ORDEN:
        r = os.path.join(carpeta, f)
        if not os.path.exists(r): print('falta', f, file=sys.stderr); continue
        for k, e in guiones(r).items():
            if k not in T and e['w']: T[k] = e
    L = []
    for k in sorted(T):
        e = T[k]
        ws = [re.sub(r'^[)^#*@!<>?~&]+', '', w.replace('\\', '/').lower()) for w in e['w']]
        ws = [w[:-4] if w.endswith('.wav') else w for w in ws]
        ws = ['~' + w[8:] if w.startswith('weapons/') else w for w in ws]
        vol, ton, can = numero(e.get('volume'), 1.0), numero(e.get('pitch'), 100), CANAL.get((e.get('channel') or '').strip().lower(), 0)
        x = ('@%g' % round(vol, 2) if abs(vol - 1) > 0.01 else '') + ('%%%g' % round(ton) if abs(ton - 100) > 0.5 else '') + ('!%d' % can if can else '')
        L.append(k + '=' + ','.join(rangos(ws)) + x)
    return '\n'.join(L)


if __name__ == '__main__':
    s = tabla(sys.argv[1])
    if re.search(r'[`$\\]', s): sys.exit('caracteres raros en la tabla')
    js = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'juego', 'gmod_sonidos.js')
    t = open(js, encoding='utf-8').read()
    t2 = re.sub(r'(const GMSN_GUIONES = `)[^`]*(`;)', lambda m: m.group(1) + s + m.group(2), t, count=1)
    if t2 == t and s not in t: sys.exit('no encontré GMSN_GUIONES en ' + js)
    open(js, 'w', encoding='utf-8').write(t2)
    print(len(s.splitlines()), 'guiones,', len(s), 'bytes →', js)
