# Lo de YouTube que usan buscar.py y verificar.py (sólo la biblioteca de Python, sin claves ni cuentas):
#  · buscar(q): la página de resultados (https://www.youtube.com/results?search_query=…) y, de su ytInitialData, cada
#    video con su id, título, canal, la insignia del canal (artista oficial o verificado), las vistas y el largo;
#  · oembed(id): https://www.youtube.com/oembed — 200 = existe y se puede insertar en otra página (con el título y el
#    canal), 401 = el dueño no deja insertarlo, 404 = no existe;
#  · insertado(id): la página del reproductor insertado (youtube-nocookie.com/embed/ID, con una página de origen como hace
#    el juego —sin ella YouTube contesta «Error 153»—): si se puede reproducir ahí («OK») o por qué no (LOGIN_REQUIRED =
#    con límite de edad, UNPLAYABLE, ERROR), con el título y el largo. Las restricciones por país dependen de desde dónde
#    se pregunte: el juego, igual, salta solo a la siguiente si YouTube da error (100/101/150) y lo anota.
# Todo se guarda en una caché (CACHE, un JSON) para no volver a preguntar lo mismo; con YT_SIN_CACHE=1 se pregunta todo.
import json, os, re, time, urllib.request, urllib.parse, urllib.error

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
CACHE = os.environ.get('YT_CACHE') or os.path.join(os.path.expanduser('~'), '.cache', 'jxmod_yt.json')   # (fuera del repo)
_C = None
PAUSA = float(os.environ.get('YT_PAUSA', '0.35'))   # (entre pregunta y pregunta: que YouTube no corte)


def _cache():
    global _C
    if _C is None:
        try: _C = json.load(open(CACHE, encoding='utf-8'))
        except Exception: _C = {}
    return _C


def _guardar():
    if _C is not None:
        os.makedirs(os.path.dirname(CACHE), exist_ok=True); tmp = CACHE + '.tmp'; json.dump(_C, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False); os.replace(tmp, CACHE)


def _get(url, ref=None, intentos=3):
    h = {'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9'}
    if ref: h['Referer'] = ref
    for k in range(intentos):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=30)
            return r.status, r.read().decode('utf-8', 'replace')
        except urllib.error.HTTPError as e:
            if e.code in (401, 403, 404): return e.code, ''
            if k == intentos - 1: return e.code, ''
        except Exception:
            if k == intentos - 1: return 0, ''
        time.sleep(2 + 3 * k)
    return 0, ''


def _texto(o):
    if not isinstance(o, dict): return ''
    if 'simpleText' in o: return o['simpleText']
    return ''.join(r.get('text', '') for r in o.get('runs', []))


def _seg(s):
    try:
        n = 0
        for p in s.split(':'): n = n * 60 + int(p)
        return n
    except Exception:
        return 0


def buscar(q, usar_cache=True):
    """los videos de la primera página de resultados: [{id, t, c, ins, vistas, seg}]"""
    C = _cache(); k = 'b:' + q
    if usar_cache and not os.environ.get('YT_SIN_CACHE') and k in C: return C[k]
    st, h = _get('https://www.youtube.com/results?search_query=' + urllib.parse.quote_plus(q))
    time.sleep(PAUSA)
    m = re.search(r'var ytInitialData = (\{.*?\});</script>', h)
    if st != 200 or not m: return []
    d = json.loads(m.group(1)); L = []

    def recorrer(o):
        if isinstance(o, dict):
            v = o.get('videoRenderer')
            if v and v.get('videoId'):
                ins = [b.get('metadataBadgeRenderer', {}).get('style', '') for b in v.get('ownerBadges', [])]
                vis = re.sub(r'[^0-9]', '', _texto(v.get('viewCountText', {})))
                L.append({'id': v['videoId'], 't': _texto(v.get('title', {})), 'c': _texto(v.get('ownerText', {})),
                          'ins': 'artista' if 'BADGE_STYLE_TYPE_VERIFIED_ARTIST' in ins else 'verificado' if 'BADGE_STYLE_TYPE_VERIFIED' in ins else '',
                          'vistas': int(vis) if vis else 0, 'seg': _seg(_texto(v.get('lengthText', {})))})
            for x in o.values(): recorrer(x)
        elif isinstance(o, list):
            for x in o: recorrer(x)
    recorrer(d)
    if L: C[k] = L; _guardar()   # (una página sin resultados —un aviso de YouTube, un corte— no se guarda)
    return L


def oembed(v, usar_cache=True):
    """(código, título, canal)"""
    C = _cache(); k = 'o:' + v
    if usar_cache and not os.environ.get('YT_SIN_CACHE') and k in C: return tuple(C[k])
    st, h = _get('https://www.youtube.com/oembed?format=json&url=' + urllib.parse.quote('https://www.youtube.com/watch?v=' + v, safe=''))
    time.sleep(PAUSA)
    r = (st, '', '')
    if st == 200:
        try: d = json.loads(h); r = (200, d.get('title', ''), d.get('author_name', ''))
        except Exception: r = (0, '', '')
    if st in (200, 401, 404): C[k] = list(r); _guardar()
    return r


def insertado(v, usar_cache=True):
    """(estado, se puede insertar, motivo, título, segundos) según la página del reproductor insertado"""
    C = _cache(); k = 'e:' + v
    if usar_cache and not os.environ.get('YT_SIN_CACHE') and k in C: return tuple(C[k])
    st, h = _get('https://www.youtube-nocookie.com/embed/' + v, ref='https://jxmod.example/')
    time.sleep(PAUSA)
    m = re.search(r'"embedded_player_response":"((?:[^"\\]|\\.)*)"', h)
    if st != 200 or not m: return ('SIN_RESPUESTA', False, 'http %s' % st, '', 0)
    try: p = json.loads(json.loads('"' + m.group(1) + '"'))
    except Exception: return ('SIN_RESPUESTA', False, 'json', '', 0)
    ps = p.get('previewPlayabilityStatus', {}) or {}
    tp = (p.get('embedPreview', {}) or {}).get('thumbnailPreviewRenderer', {}) or {}
    t = _texto(tp.get('title', {})); s = int(tp.get('videoDurationSeconds') or 0)
    r = (ps.get('status', '?'), bool(ps.get('playableInEmbed')), ps.get('reason', '') or '', t, s)
    C[k] = list(r); _guardar()
    return r
