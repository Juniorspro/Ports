#!/usr/bin/env python3
"""Comprime un archivo grande por bloques independientes (LZMA2 crudo) para leerlo salteado desde la app.

    bloques.py ENTRADA SALIDA [TAM_BLOQUE]

Formato: b"BOZB", u32 versión (1), u64 tamaño original, u32 tamaño de bloque, u32 n,
u64 desplazamientos[n + 1] (relativos al comienzo de los datos), datos.
"""
import lzma, os, struct, sys
from multiprocessing import Pool


def comprimir(args):
    ruta, ini, n, bloque = args
    with open(ruta, 'rb') as f:
        f.seek(ini)
        d = f.read(n)
    filtros = [{'id': lzma.FILTER_LZMA2, 'preset': 9 | lzma.PRESET_EXTREME, 'dict_size': max(bloque, 1 << 16)}]
    return lzma.compress(d, format=lzma.FORMAT_RAW, filters=filtros)


def main():
    ent, sal = sys.argv[1], sys.argv[2]
    bloque = int(sys.argv[3]) if len(sys.argv) > 3 else 1 << 20
    tam = os.path.getsize(ent)
    tareas = [(ent, i, min(bloque, tam - i), bloque) for i in range(0, tam, bloque)]
    with Pool(os.cpu_count()) as p:
        partes = p.map(comprimir, tareas, chunksize=4)
    desp = [0]
    for c in partes:
        desp.append(desp[-1] + len(c))
    with open(sal, 'wb') as f:
        f.write(b'BOZB' + struct.pack('<IQII', 1, tam, bloque, len(partes)))
        f.write(struct.pack('<%dQ' % len(desp), *desp))
        for c in partes:
            f.write(c)
    print('%s: %d -> %d bytes (%.1f%%), %d bloques' % (sal, tam, os.path.getsize(sal), 100 * os.path.getsize(sal) / tam, len(partes)))


if __name__ == '__main__':
    main()
