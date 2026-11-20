# El mapa del mundo de «¿De dónde sos?»: una grilla de puntos sobre los continentes (Natural Earth, dominio público,
# naturalearthdata.com) y el lugar de cada país (su punto de etiqueta). Sale web/mapa.js (unos KB); la app lo dibuja.
# uso: python3 -I herramientas/mapa.py CARPETA_CON(ne_110m_land.geojson, ne_110m_admin_0_countries.geojson)
import base64, json, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASO, NORTE, SUR = 1.5, 80.0, -56.0     # (grados entre puntos; sin la Antártida)
# (código, bandera, nombre) — los de habla hispana, Brasil y Estados Unidos; «otro» va aparte
PAISES = [('ar', '🇦🇷', 'Argentina'), ('mx', '🇲🇽', 'México'), ('es', '🇪🇸', 'España'), ('co', '🇨🇴', 'Colombia'), ('cl', '🇨🇱', 'Chile'),
          ('pe', '🇵🇪', 'Perú'), ('ve', '🇻🇪', 'Venezuela'), ('uy', '🇺🇾', 'Uruguay'), ('py', '🇵🇾', 'Paraguay'), ('bo', '🇧🇴', 'Bolivia'),
          ('ec', '🇪🇨', 'Ecuador'), ('cu', '🇨🇺', 'Cuba'), ('do', '🇩🇴', 'Rep. Dominicana'), ('pr', '🇵🇷', 'Puerto Rico'), ('gt', '🇬🇹', 'Guatemala'),
          ('hn', '🇭🇳', 'Honduras'), ('sv', '🇸🇻', 'El Salvador'), ('ni', '🇳🇮', 'Nicaragua'), ('cr', '🇨🇷', 'Costa Rica'), ('pa', '🇵🇦', 'Panamá'),
          ('us', '🇺🇸', 'Estados Unidos'), ('br', '🇧🇷', 'Brasil'), ('gq', '🇬🇶', 'Guinea Ecuatorial')]


def dentro(x, y, anillo):
    c = False; n = len(anillo)
    for i in range(n):
        x1, y1 = anillo[i]; x2, y2 = anillo[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c


def main(d):
    tierra = json.load(open(os.path.join(d, 'ne_110m_land.geojson')))
    polis = []
    for f in tierra['features']:
        g = f['geometry']; ps = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
        for p in ps:
            xs = [q[0] for q in p[0]]; ys = [q[1] for q in p[0]]
            polis.append((min(xs), max(xs), min(ys), max(ys), p))
    W = int(360 / PASO); H = int((NORTE - SUR) / PASO)
    bits = bytearray((W * H + 7) // 8); n = 0
    for fila in range(H):
        lat = NORTE - (fila + 0.5) * PASO
        for col in range(W):
            lon = -180 + (col + 0.5) * PASO
            for (x0, x1, y0, y1, p) in polis:
                if x0 <= lon <= x1 and y0 <= lat <= y1 and dentro(lon, lat, p[0]) and not any(dentro(lon, lat, h) for h in p[1:]):
                    k = fila * W + col; bits[k >> 3] |= 1 << (k & 7); n += 1; break
    paises = json.load(open(os.path.join(d, 'ne_110m_admin_0_countries.geojson')))
    lugar = {}
    for f in paises['features']:
        pr = f['properties']; iso = (pr.get('ISO_A2_EH') or pr.get('ISO_A2') or '').lower()
        if pr.get('LABEL_X') is not None: lugar[iso] = (round(pr['LABEL_X'], 2), round(pr['LABEL_Y'], 2))
    lugar.setdefault('pr', (-66.5, 18.2))   # (Puerto Rico no está en la de 110 m)
    salida = [{'k': k, 'f': f, 'n': nom, 'lon': lugar[k][0], 'lat': lugar[k][1]} for k, f, nom in PAISES if k in lugar]
    faltan = [k for k, _, _ in PAISES if k not in lugar]
    with open(os.path.join(RAIZ, 'web', 'mapa.js'), 'w', encoding='utf-8') as o:
        o.write('// generado por herramientas/mapa.py con Natural Earth (dominio público): los continentes en puntos y los países\n')
        o.write('export const MAPA = %s;\n' % json.dumps({'w': W, 'h': H, 'paso': PASO, 'norte': NORTE, 'bits': base64.b64encode(bytes(bits)).decode()}))
        o.write('export const PAISES = %s;\n' % json.dumps(salida, ensure_ascii=False))
    print('mapa: %d×%d, %d puntos de tierra, %d países%s, %.1f KB' % (W, H, n, len(salida), (' (faltan ' + ' '.join(faltan) + ')') if faltan else '', os.path.getsize(os.path.join(RAIZ, 'web', 'mapa.js')) / 1024))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/sz_mapa')
