# Las letras de los otros idiomas para los atlas de JXMod nativo (atlas_menus.py, atlas_letras.py): todas las que usan los
# textos traducidos (motor/juego/src/idiomas_web.json.gz, que sale de la web con idiomas_nativo.mjs, y los de la nativa,
# motor/juego/src/idiomas_nativo.tsv) más las formas del árabe ya unidas (FE70–FEFC: la nativa une las letras, idiomas.rs),
# y la fuente libre de respaldo de cada una: DejaVu Sans (latinas, cirílico, árabe), Loma de TLWG (tailandés) e IPA P Gothic
# (japonés). Las licencias, en CREDITOS.md.
import gzip, json, os
AQUI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(AQUI, '..', 'motor', 'juego', 'src')
DEJAVU = ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
LOMA = ('/usr/share/fonts/opentype/tlwg/Loma.otf', '/usr/share/fonts/opentype/tlwg/Loma-Bold.otf')
IPA = ('/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf', '/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf')
# (las latinas de más y el cirílico: van también en las letras de cada cara, si las tiene)
LATINAS = ''.join(chr(c) for c in list(range(0xA0, 0x180)) + list(range(0x400, 0x460)) + [0x490, 0x491]) + '„‚‹›▶◀'

def textos():
    """todos los textos traducidos (los de la web y los de la nativa)"""
    v = []
    p = os.path.join(SRC, 'idiomas_web.json.gz')
    if os.path.isfile(p):
        d = json.loads(gzip.decompress(open(p, 'rb').read())); v += [t for f in d['f'] for t in f] + d['n']
    p = os.path.join(SRC, 'idiomas_nativo.tsv')
    if os.path.isfile(p):
        for r in open(p, encoding='utf-8').read().split('\n'):
            if r and not r.startswith('#'): v += r.split('\t')
    return v

def extra(base):
    """las letras que faltan en `base` (sin las de control ni las invisibles), en orden"""
    cs = set(''.join(textos())) | set(chr(c) for c in range(0xFE70, 0xFEFD)) | set(LATINAS)
    return sorted(c for c in cs if c not in base and ord(c) >= 0x20 and c not in '​‌‍‎‏­﻿' and not (0x600 <= ord(c) <= 0x6FF and c not in '،؛؟ًٌٍَُِّْ٠١٢٣٤٥٦٧٨٩'))

_cmaps = {}
def fuente(ch, negrita):
    """(archivo, falsa negrita) de la primera fuente de respaldo que tiene la letra, o None"""
    from fontTools.ttLib import TTFont
    for par in (DEJAVU, LOMA, IPA):
        r = par[1 if negrita else 0]
        if r not in _cmaps:
            _cmaps[r] = set(TTFont(r, fontNumber=0).getBestCmap()) if os.path.isfile(r) else set()
        if ord(ch) in _cmaps[r]: return r, negrita and par is IPA
    return None
