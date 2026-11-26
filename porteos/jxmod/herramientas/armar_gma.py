# arma un .gma (el formato de addons de GMod que lee la nativa: gmod/src/cargar.rs leer_gma) con una carpeta de addon
# uso: python3 -I armar_gma.py CARPETA SALIDA.gma TITULO
import sys, os, struct, zlib, time
car, sal, titulo = sys.argv[1], sys.argv[2], sys.argv[3]
arch = []
for r, _, fs in os.walk(car):
    for f in sorted(fs):
        p = os.path.join(r, f); rel = os.path.relpath(p, car).replace(os.sep, '/').lower()
        arch.append((rel, p))
arch.sort()
with open(sal, 'wb') as o:
    o.write(b'GMAD' + bytes([3]) + struct.pack('<QQ', 0, int(time.time())) + b'\0')
    for s in (titulo, 'uso personal (contenido de Half-Life 2, Valve)', 'JXMod'): o.write(s.encode('utf-8') + b'\0')
    o.write(struct.pack('<i', 1))
    for i, (rel, p) in enumerate(arch, 1):
        d = open(p, 'rb').read(); o.write(struct.pack('<I', i) + rel.encode('utf-8') + b'\0' + struct.pack('<qI', len(d), zlib.crc32(d)))
    o.write(struct.pack('<I', 0))
    for rel, p in arch: o.write(open(p, 'rb').read())
    o.write(struct.pack('<I', 0))
print(len(arch), 'archivos,', round(os.path.getsize(sal) / 1048576, 1), 'MB')
