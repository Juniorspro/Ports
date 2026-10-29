#!/usr/bin/env python3
# Lee un .s3e de Marmalade (LZMA "alone" + contenedor XE3U), aplica las relocaciones como el cargador
# original (libs3e_android.so) y deja: imagen lista para cargar en memoria + tabla de importaciones.
#
# Contenedor (offsets en el archivo ya descomprimido, u32 little endian):
#   0x00 'XE3U'  0x04 version  0x0c off. bloque de relocs  0x10 tam. bloque  0x14 off. imagen
#   0x18 tam. imagen en archivo  0x1c tam. total en memoria (imagen + bss)  0x2c off. config  0x30 tam. config
#   0x34 base de enlace (0x4a000000)  0x44 inicio de la region de datos (0x3dc000)
# Bloque de relocs = sucesion de trozos {tipo u32, tam u32, ...}:
#   0 nombres de importaciones (u16 cuenta @8, cadenas NUL desde @10)
#   1 rebase: cuenta u32 @8, luego offsets u32 de palabras que llevan direcciones absolutas
#   2 llamadas ARM (B/BL) a importaciones     [u16 hi, u16 lo, u16 simbolo] x cuenta @8, desde @12
#   3 llamadas Thumb (par BL) a importaciones  (mismo formato)
#   4 palabras de datos = direccion de la importacion (GOT, tablas)
import sys, struct, lzma, json, os

LINK_BASE = 0x4A000000

def abrir(ruta):
    raw = open(ruta, 'rb').read()
    return lzma.LZMADecompressor(format=lzma.FORMAT_ALONE).decompress(raw)

def vincular(b, base_img, base_stubs, paso_stub=8):
    assert b[:4] == b'XE3U'
    h = struct.unpack('<19I', b[:76])
    off_reloc, tam_reloc, off_img, tam_img, tam_mem = h[3], h[4], h[5], h[6], h[7]
    assert h[13] == LINK_BASE
    mem = bytearray(tam_mem)
    mem[:tam_img] = b[off_img:off_img + tam_img]
    delta = base_img - LINK_BASE
    nombres, pend, reb = [], [], []
    p, fin = off_reloc, off_reloc + tam_reloc
    while p < fin:
        tipo, tam = struct.unpack_from('<II', b, p)
        if tipo == 0:
            n = struct.unpack_from('<H', b, p + 8)[0]
            q = p + 10
            for _ in range(n):
                e = b.index(b'\0', q); nombres.append(b[q:e].decode()); q = e + 1
        elif tipo == 1:
            n = struct.unpack_from('<I', b, p + 8)[0]
            for o in struct.unpack_from('<%dI' % n, b, p + 12):
                reb.append(o)
                v = struct.unpack_from('<I', mem, o)[0]
                struct.pack_into('<I', mem, o, (v + delta) & 0xFFFFFFFF)
        elif tipo in (2, 3, 4):
            n = struct.unpack_from('<I', b, p + 8)[0]
            for i in range(n):
                hi, lo, sym = struct.unpack_from('<HHH', b, p + 12 + 6 * i)
                pend.append((tipo, (hi << 16) | lo, sym))
        else:
            raise ValueError('trozo desconocido %d' % tipo)
        p += tam
    stats = {2: 0, 3: 0, 4: 0}
    for tipo, o, sym in pend:
        stub = base_stubs + paso_stub * sym
        dir_ = base_img + o
        if tipo == 4:
            struct.pack_into('<I', mem, o, stub)
        elif tipo == 2:
            w = struct.unpack_from('<I', mem, o)[0]
            assert (w >> 25) & 7 == 5, 'no es B/BL en %x: %08x' % (o, w)
            imm = ((stub - (dir_ + 8)) >> 2) & 0xFFFFFF
            struct.pack_into('<I', mem, o, (w & 0xFF000000) | imm)
        else:  # par BL de Thumb -> BLX (los stubs son ARM)
            h1, h2 = struct.unpack_from('<HH', mem, o)
            assert (h1 & 0xF800) == 0xF000, 'no es prefijo BL en %x: %04x' % (o, h1)
            off = stub - (dir_ + 4)
            f = (off >> 1) & 0x3FFFFF
            lo = f & 0x7FF
            if lo & 1: lo += 1
            hi = (f >> 11) & 0x7FF
            if lo > 0x7FF: lo = 0; hi = (hi + 1) & 0x7FF
            struct.pack_into('<HH', mem, o, 0xF000 | hi, 0xE800 | lo)
        stats[tipo] += 1
    cfg = b[h[11]:h[11] + h[12]].decode('latin1')
    return dict(mem=bytes(mem), rebase=reb, nombres=nombres, tam_img=tam_img, tam_mem=tam_mem, data_off=h[17], cfg=cfg, stats=stats)

if __name__ == '__main__':
    s3e, base_img, base_stubs, sal = sys.argv[1], int(sys.argv[2], 0), int(sys.argv[3], 0), sys.argv[4]
    r = vincular(abrir(s3e), base_img, base_stubs)
    os.makedirs(sal, exist_ok=True)
    open(os.path.join(sal, 'imagen.bin'), 'wb').write(r['mem'][:r['tam_img']])
    open(os.path.join(sal, 'config.txt'), 'w', encoding='latin1').write(r['cfg'])
    json.dump(r['rebase'], open(os.path.join(sal, 'rebase.json'), 'w'))
    json.dump(dict(nombres=r['nombres'], tam_img=r['tam_img'], tam_mem=r['tam_mem'], data_off=r['data_off'],
                   base_img=base_img, base_stubs=base_stubs), open(os.path.join(sal, 'imagen.json'), 'w'))
    print('imagen', hex(r['tam_img']), 'mem', hex(r['tam_mem']), 'imports', len(r['nombres']), 'relocs', r['stats'])
