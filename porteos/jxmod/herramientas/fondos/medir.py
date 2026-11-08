# Revisa lo medido en cada foto (<nombre>.json de fondos.mjs): dónde quedó la grieta y cuántas cosas que caen se ven,
# en la parte de la pantalla que no tapa el menú o la pantalla de carga. uso: python3 -I medir.py CARPETA
import json, os, sys
D = sys.argv[1]
falla = 0
print('%-20s %-14s %6s %6s %6s %s' % ('foto', 'grieta', 'vuelan', 'pegaron', 'gente', 'ok'))
for f in sorted(os.listdir(D)):
    if not f.endswith('.json'): continue
    m = json.load(open(os.path.join(D, f)))['med']; n = f[:-5]; menu = n.startswith('m')
    # (zona útil: el menú tapa el 35 % de la izquierda; en el celular se recorta ~10 % arriba y abajo; la pantalla de carga
    # tiene el consejo arriba a la derecha y la consola abajo)
    def util(s):
        if not s: return False
        x, y = s
        if menu: return 0.36 <= x <= 0.99 and 0.08 <= y <= 0.92
        # (pantalla de carga: el logo y el título arriba a la izquierda, el consejo arriba a la derecha, la consola abajo a la
        # izquierda y la barra abajo de todo)
        if x < 0.30 and y < 0.27: return False
        if x > 0.70 and y < 0.16: return False
        return 0.02 <= x <= 0.98 and 0.04 <= y <= (0.90 if x > 0.55 else 0.80)
    g = m.get('grieta'); gmod = n in ('c7_rb_construct', 'c8_rb_gmflatgrass')
    vuelan = [c for c in m['caidas'] if c['est'] == 1 and util(c['s']) and c['px'] >= 8]
    pegaron = [c for c in m['caidas'] if c['est'] >= 2 and util(c['s'])]
    gente = [p for p in m['gente'] if util(p['s'])]
    if gmod: ok = g is None
    # (y la grieta entre el 17 y el 32 % del alto: en un celular de 20:9 se ve del 9 al 85 % de la foto de carga, y más arriba
    # le cortaría los rayos; más abajo se come el cielo por donde cruzan las cosas que caen)
    else: ok = bool(g) and util(g) and 0.17 <= g[1] <= 0.32 and len(vuelan) >= 2 and len(pegaron) >= 1
    if not ok: falla += 1
    print('%-20s %-14s %6d %6d %6d %s' % (n, g and '%.2f,%.2f' % tuple(g), len(vuelan), len(pegaron), len(gente), 'OK' if ok else 'FALLA'))
print('RESUMEN', 'todas bien' if not falla else '%d con algo para revisar' % falla)
