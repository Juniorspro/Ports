# Las librerías de Android de los anuncios (AdMob + el aviso de consentimiento), sin Gradle: las baja de Google Maven y
# Maven Central (con su huella, de herramientas/libs_anuncios.json), las desarma (classes.jar, res/, manifiesto, recursos
# de Java como META-INF/services) y fusiona sus manifiestos con el de la app como lo haría Gradle (tools:node="remove" y
# "replace", ${applicationId}, sin repetir permisos ni componentes). Lo usa armar_apk.py.
import hashlib, json, os, re, shutil, urllib.request, zipfile
import xml.etree.ElementTree as ET

AQUI = os.path.dirname(os.path.abspath(__file__))
LISTA = os.path.join(AQUI, 'libs_anuncios.json')
A = '{http://schemas.android.com/apk/res/android}'
T = '{http://schemas.android.com/tools}'
ET.register_namespace('android', A[1:-1])
ET.register_namespace('tools', T[1:-1])


def _bajar(url):
    with urllib.request.urlopen(url, timeout=90) as r: return r.read()


def preparar(cache):
    """baja (si hace falta) y desarma las librerías; devuelve jars, recursos, manifiestos y paquetes"""
    libs = json.load(open(LISTA, encoding='utf-8'))['libs']
    os.makedirs(cache, exist_ok=True)
    out = {'jars': [], 'res': [], 'manifiestos': [], 'paquetes': [], 'assets': [], 'n': len(libs)}
    for l in libs:
        nombre = '%s__%s-%s.%s' % (l['g'], l['a'], l['v'], l['ext'])
        f = os.path.join(cache, nombre)
        if not (os.path.isfile(f) and hashlib.sha256(open(f, 'rb').read()).hexdigest() == l['sha256']):
            datos = _bajar('%s%s/%s/%s/%s-%s.%s' % (l['repo'], l['g'].replace('.', '/'), l['a'], l['v'], l['a'], l['v'], l['ext']))
            if hashlib.sha256(datos).hexdigest() != l['sha256']: raise SystemExit('ERROR: la huella de %s no coincide (¿la cambiaron?)' % nombre)
            with open(f, 'wb') as o: o.write(datos)
        if l['ext'] == 'jar':
            out['jars'].append(f); continue
        d = os.path.join(cache, 'desarmadas', nombre[:-4])
        if not os.path.isdir(d):
            tmp = d + '.tmp'; shutil.rmtree(tmp, ignore_errors=True)
            with zipfile.ZipFile(f) as z: z.extractall(tmp)
            os.replace(tmp, d)
        if os.path.isfile(os.path.join(d, 'classes.jar')): out['jars'].append(os.path.join(d, 'classes.jar'))
        for j in sorted(os.listdir(os.path.join(d, 'libs'))) if os.path.isdir(os.path.join(d, 'libs')) else []:
            if j.endswith('.jar'): out['jars'].append(os.path.join(d, 'libs', j))
        if os.path.isdir(os.path.join(d, 'jni')): raise SystemExit('ERROR: %s trae código nativo' % nombre)
        man = os.path.join(d, 'AndroidManifest.xml'); out['manifiestos'].append(man)
        pkg = re.search(r'package="([^"]+)"', open(man, encoding='utf-8').read()).group(1)
        res = os.path.join(d, 'res')
        if os.path.isdir(res) and any(fs for _, _, fs in os.walk(res)): out['res'].append((pkg, res))
        out['paquetes'].append((pkg, d))
        if os.path.isdir(os.path.join(d, 'assets')): out['assets'].append(os.path.join(d, 'assets'))
    return out


def paquetes_con_r(libs):
    """los paquetes cuyo código usa su clase R (para generar sólo esas)"""
    usados = set()
    textos = []
    for j in libs['jars']:
        with zipfile.ZipFile(j) as z:
            for n in z.namelist():
                if n.endswith('.class'): textos.append(z.read(n))
    blob = b'\0'.join(textos)
    for pkg, _ in libs['paquetes']:
        if (pkg.replace('.', '/') + '/R$').encode() in blob or (pkg.replace('.', '/') + '/R;').encode() in blob: usados.add(pkg)
    return sorted(usados)


def recursos_java(libs):
    """lo que no es .class adentro de los jars y la app necesita en tiempo de ejecución (sobre todo META-INF/services)"""
    out = {}
    for j in libs['jars']:
        with zipfile.ZipFile(j) as z:
            for n in z.namelist():
                if n.endswith('/') or n.endswith('.class') or n == 'module-info.class': continue
                if n.startswith('META-INF/'):
                    if not n.startswith('META-INF/services/'): continue
                elif n.endswith(('.kotlin_builtins', '.kotlin_module', '.version', '.pro', '.txt', '.properties')): continue
                if n in out and n.startswith('META-INF/services/'): out[n] = out[n].rstrip(b'\n') + b'\n' + z.read(n)
                else: out.setdefault(n, z.read(n))
    return out


def _clave(e):
    return (e.tag, e.get(A + 'name'))


def _sin_tools(e):
    for x in e.iter():
        for k in [k for k in x.attrib if k.startswith(T)]: del x.attrib[k]


def fusionar(base_xml, manifiestos, paquete, meta_extra=()):
    """el manifiesto de la app + los de las librerías (como el «manifest merger» de Gradle, para lo que usan estas)"""
    app = ET.fromstring(base_xml)
    aplic = app.find('application')
    quitar = set()

    def sumar_hijo(padre, e):
        nodo = e.get(T + 'node')
        k = _clave(e)
        if nodo == 'remove': quitar.add((id(padre), k)); return
        ya = next((x for x in padre if _clave(x) == k), None) if k[1] else None
        if ya is None:
            if k[1] is None and any(ET.tostring(x) == ET.tostring(e) for x in padre): return
            padre.append(e); return
        if nodo == 'replace': padre.remove(ya); padre.append(e); return
        # (merge: los atributos que falten y los hijos que no estén)
        for at, v in e.attrib.items():
            if at not in ya.attrib: ya.set(at, v)
        for h in list(e): sumar_hijo(ya, h)

    for f in manifiestos:
        texto = open(f, encoding='utf-8').read().replace('${applicationId}', paquete)
        lib = ET.fromstring(texto)
        for e in lib:
            if e.tag in ('uses-permission', 'uses-permission-sdk-23', 'uses-feature', 'permission'):
                if e.get(T + 'node') == 'remove': quitar.add((id(app), _clave(e))); continue
                if not any(_clave(x) == _clave(e) for x in app): app.insert(0, e)
            elif e.tag == 'queries':
                q = app.find('queries')
                if q is None: q = ET.SubElement(app, 'queries')
                for h in e:
                    if not any(ET.tostring(x) == ET.tostring(h) for x in q): q.append(h)
            elif e.tag == 'application':
                for h in e: sumar_hijo(aplic, h)
    # lo que alguna librería pidió quitar
    for padre in [app, aplic] + list(aplic):
        for x in list(padre):
            if (id(padre), _clave(x)) in quitar or ((id(app), _clave(x)) in quitar and padre is app): padre.remove(x)
    for nombre, valor in meta_extra:
        for x in [x for x in aplic if x.tag == 'meta-data' and x.get(A + 'name') == nombre]: aplic.remove(x)
        m = ET.SubElement(aplic, 'meta-data'); m.set(A + 'name', nombre); m.set(A + 'value', valor)
    _sin_tools(app)
    return '<?xml version="1.0" encoding="utf-8"?>\n' + ET.tostring(app, encoding='unicode')
