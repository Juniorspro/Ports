# baja de archive.org, archivo por archivo de adentro del RAR de GMod 10 (sin bajar los 2,3 GB), los .mdl/.vvd/.vtx/.phy
# de unos props de HL2 y sus materiales (.vmt y .vtf), a la carpeta donde gmod.py los lee (fuera del repo)
# LISTA: [ruta adentro del RAR, tamaño, dirección] de cada archivo (de la lista de archivos del RAR en archive.org)
# uso: python -I bajar_hl2.py CARPETA_SALIDA LISTA.json RUTA_MDL...   (p. ej. props_junk/watermelon01)
import sys, os, json, re, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import source_mdl as SM
BASE = sys.argv[1].rstrip('/') + '/'
L = json.load(open(sys.argv[2])); IDX = {x[0].lower(): x for x in L}
def bajar(rel):   # rel: 'Garrys_Mod_10/hl2/...' (sin importar mayúsculas)
    x = IDX.get(rel.lower())
    if not x: return None
    dst = BASE + x[0]
    if os.path.exists(dst) and os.path.getsize(dst) == x[1]: return dst
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    url = 'https:' + x[2] if x[2].startswith('//') else x[2]
    for intento in range(4):
        try:
            b = urllib.request.urlopen(url, timeout=120).read()
            if len(b) == x[1]: open(dst, 'wb').write(b); return dst
        except Exception as e: print('  reintento', x[0], e)
    print('  FALLA', x[0]); return None
for m in sys.argv[3:]:
    b = 'Garrys_Mod_10/hl2/models/' + m
    got = {e: bajar(b + e) for e in ('.mdl', '.vvd', '.dx90.vtx', '.dx80.vtx', '.sw.vtx', '.phy')}
    if not (got['.mdl'] and got['.vvd'] and (got['.dx90.vtx'] or got['.dx80.vtx'])): print('falta', m, got); continue
    M = SM.Modelo(open(got['.mdl'], 'rb').read(), open(got['.vvd'], 'rb').read(), open(got['.dx90.vtx'] or got['.dx80.vtx'], 'rb').read())
    texs = set(M.texturas)
    for pie in M.pieles:
        for t in pie: texs.add(M.texturas[t])
    n = 0
    for t in texs:
        for cd in M.carpetas:
            v = bajar('Garrys_Mod_10/hl2/materials/' + cd.replace('\\', '/').strip('/') + '/' + t + '.vmt')
            if not v: continue
            kv = open(v, 'r', errors='ignore').read()
            for k in ('$basetexture', '$basetexture2', '$bumpmap'):
                mm = re.search(r'"?' + re.escape(k) + r'"?\s+"?([^"\s]+)', kv, re.I)
                if mm and k != '$bumpmap': n += bool(bajar('Garrys_Mod_10/hl2/materials/' + mm.group(1).replace('\\', '/') + '.vtf'))
            inc = re.search(r'"?include"?\s+"?([^"\s]+)', kv, re.I)
            if inc: bajar('Garrys_Mod_10/hl2/' + inc.group(1).replace('\\', '/'))
            break
    print('ok', m, 'texturas', sorted(texs), 'vtf', n)
