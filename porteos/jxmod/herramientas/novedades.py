# El registro de actualizaciones del juego (juego/novedades.js, la pestaña «Novedades» de «Bugs y sugerencias»): las
# notas de cada versión publicada, sacadas del historial de git de web/version.json (más la de ahora, aunque no esté
# guardada todavía), sin las instrucciones de cómo instalarla. Se corre antes de armar una versión nueva.
# uso: python3 -I herramientas/novedades.py
import json, os, re, subprocess, sys
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..', '..'))
VJ = 'web/version.json'
git = lambda *a: subprocess.run(['git', '-C', RAIZ, *a], capture_output=True, text=True).stdout
# (las oraciones que hablan de cómo instalarla no van: en el registro importa qué trae)
INSTALAR = re.compile(r'se actualiza sola|se instala encima|desinstal|IMPORTANTE|Tocá Descargar|cambió la firma|instalá|'
                      r'updates itself|installs on top|uninstall|Tap Download|signature changed|IMPORTANT', re.I)
def limpiar(t):
    t = re.sub(r'^\s*JXMod\s+[\d.]+\s*[—–-]\s*', '', str(t or '')).strip()
    partes = re.split(r'(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ«¡¿])', t)
    t = ' '.join(p for p in partes if not INSTALAR.search(p)).strip()
    return t[:1].upper() + t[1:]
vers = {}
for linea in reversed(git('log', '--format=%h %ad', '--date=short', '--', VJ).split('\n')):
    if not linea.strip(): continue
    h, f = linea.split()
    try: d = json.loads(git('show', f'{h}:{VJ}'))
    except Exception: continue
    v = str(d.get('version') or '')
    if v: vers[v] = {'v': v, 'f': f, 'es': limpiar(d.get('notas_es')), 'en': limpiar(d.get('notas_en') or d.get('notas_es'))}
# (la del archivo de ahora: la versión que se está por publicar)
try:
    d = json.load(open(os.path.join(RAIZ, VJ), encoding='utf-8')); v = str(d.get('version') or '')
    if v: vers[v] = {'v': v, 'f': vers.get(v, {}).get('f') or git('log', '-1', '--format=%ad', '--date=short').strip(), 'es': limpiar(d.get('notas_es')), 'en': limpiar(d.get('notas_en') or d.get('notas_es'))}
except Exception as e: print('no se pudo leer', VJ, e, file=sys.stderr)
clave = lambda x: [int(n) for n in re.findall(r'\d+', x['v'])]
L = sorted(vers.values(), key=clave, reverse=True)
L = [x for x in L if x['es']]
salida = os.path.join(AQUI, '..', 'juego', 'novedades.js')
with open(salida, 'w', encoding='utf-8') as f:
    f.write('// El registro de actualizaciones (la pestaña «Novedades» de «Bugs y sugerencias»). Lo arma\n'
            '// herramientas/novedades.py con las notas de cada versión publicada: no se edita a mano.\n')
    f.write('const NOVEDADES = ' + json.dumps(L, ensure_ascii=False, indent=0).replace('\n', ' ').replace('{ ', '{').replace(' }', '}') + ';\n')
print(len(L), 'versiones en juego/novedades.js; la última:', L[0]['v'] if L else '-')
for x in L[:4]: print(' ', x['v'], x['f'], '|', x['es'][:110])
