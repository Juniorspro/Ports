# Achica las texturas de un .glb (las pasa a JPEG de 1024 px como mucho) sin tocar la malla. Para el termo del evento.
# uso: python3 -I herramientas/achicar_glb.py ENTRADA.glb SALIDA.glb [LADO=1024]
import io, json, struct, sys
from PIL import Image

def main(ent, sal, lado=1024):
    b = open(ent, 'rb').read()
    jl, _ = struct.unpack('<II', b[12:20]); j = json.loads(b[20:20 + jl]); off = 20 + jl
    bl, _ = struct.unpack('<II', b[off:off + 8]); binario = b[off + 8:off + 8 + bl]
    vistas = j['bufferViews']; imagenes = {i['bufferView']: k for k, i in enumerate(j.get('images', [])) if 'bufferView' in i}
    nuevo, nuevas = bytearray(), []
    for k, v in enumerate(vistas):
        datos = binario[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
        if k in imagenes:
            im = Image.open(io.BytesIO(datos)).convert('RGB'); im.thumbnail((lado, lado), Image.LANCZOS)
            o = io.BytesIO(); im.save(o, 'JPEG', quality=86, optimize=True); datos = o.getvalue(); j['images'][imagenes[k]]['mimeType'] = 'image/jpeg'
        while len(nuevo) % 4: nuevo.append(0)
        v2 = dict(v); v2['byteOffset'] = len(nuevo); v2['byteLength'] = len(datos); nuevo += datos; nuevas.append(v2)
    while len(nuevo) % 4: nuevo.append(0)
    j['bufferViews'] = nuevas; j['buffers'][0]['byteLength'] = len(nuevo)
    js = json.dumps(j, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    total = 12 + 8 + len(js) + 8 + len(nuevo)
    with open(sal, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total)); f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js); f.write(struct.pack('<II', len(nuevo), 0x004E4942)); f.write(nuevo)
    print('%s: %.2f MB → %.2f MB' % (sal, len(b) / 1048576, total / 1048576))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 1024)
