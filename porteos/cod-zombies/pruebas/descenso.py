# Descubre codigo del juego por descenso recursivo desde los punteros reubicados (vtables, tablas) y los saltos directos.
# Salida: DIR/codigo.json  = {"inicios": [[dir, thumb], ...], "insns": N}
#   python3 -I descenso.py IMAGEN.bin BASE REBASE.json SALIDA.json
import sys, json, struct, collections
from capstone import *
from capstone.arm import *

img = open(sys.argv[1], 'rb').read(); BASE = int(sys.argv[2], 0)
reb = json.load(open(sys.argv[3]))
CODE_END = BASE + 0x3dc000            # fin de la zona de codigo/rodata segun la cabecera
mdT = Cs(CS_ARCH_ARM, CS_MODE_THUMB); mdA = Cs(CS_ARCH_ARM, CS_MODE_ARM)
mdT.detail = True; mdA.detail = True

work = collections.deque(); vistos = set(); inicios = set(); insns = {}
def push(a, t):
    if BASE <= a < CODE_END and (a, t) not in vistos:
        vistos.add((a, t)); work.append((a, t))
# semillas: punteros reubicados que apuntan a codigo
for o in reb:
    v = struct.unpack_from('<I', img, o)[0]
    if BASE <= (v & ~1) < CODE_END: push(v & ~1, v & 1)
nsem = len(work)
RET_OPS = {ARM_INS_BX, ARM_INS_POP, ARM_INS_LDM}
def termina(i):
    # fin de flujo: salto incondicional, retorno
    if i.id == ARM_INS_B and i.cc == ARM_CC_AL: return True
    if i.id == ARM_INS_BX and i.cc == ARM_CC_AL: return True
    if i.id in (ARM_INS_POP, ARM_INS_LDM, ARM_INS_LDR, ARM_INS_MOV, ARM_INS_ADD, ARM_INS_TBB, ARM_INS_TBH) and i.cc == ARM_CC_AL:
        for op in i.operands:
            if op.type == ARM_OP_REG and op.reg == ARM_REG_PC and (op.access & CS_AC_WRITE or i.id in (ARM_INS_POP, ARM_INS_LDM)): return True
        if i.id in (ARM_INS_TBB, ARM_INS_TBH): return True
    return False
n = 0
malos = set()
while work:
    a, t = work.popleft()
    md = mdT if t else mdA
    inicios.add((a, t)); a0 = a; fin = 'rango'
    while BASE <= a < CODE_END:
        if (a, t) in insns: fin = 'visto'; break
        chunk = img[a - BASE:a - BASE + 4]
        got = list(md.disasm(chunk, a, 1))
        if not got: fin = 'invalido'; break
        i = got[0]; insns[(a, t)] = i.size; n += 1
        # destinos directos
        if i.id in (ARM_INS_B, ARM_INS_BL, ARM_INS_BLX, ARM_INS_CBZ, ARM_INS_CBNZ) and i.operands and i.operands[-1].type == ARM_OP_IMM:
            tgt = i.operands[-1].imm
            if i.id == ARM_INS_BLX: push(tgt & ~1, 0 if t else 1)   # blx imm cambia de modo
            else: push(tgt, t)
        # tablas de saltos tbb/tbh: leer entradas mientras sigan apuntando por delante de la tabla
        if i.id in (ARM_INS_TBB, ARM_INS_TBH):
            tb = a + 4; k = 0; mn = 1 << 30; w = 1 if i.id == ARM_INS_TBB else 2
            while k < 256:
                e = img[tb - BASE + k * w] if w == 1 else struct.unpack_from('<H', img, tb - BASE + k * w)[0]
                if 2 * e < (k + 1) * w or 2 * e >= 0x20000: break
                push(tb + 2 * e, 1); k += 1
        if termina(i): fin = 'term'; break
        a += i.size
    if fin == 'invalido': malos.add((a0, t))
    if n % 50000 == 0 and n: print('...', n, file=sys.stderr)
print('semillas', nsem, 'inicios', len(inicios), 'instrucciones', len(insns), 'thumb', sum(1 for k in insns if k[1]), 'arm', sum(1 for k in insns if not k[1]))
# inicios de bloque para pruebas: cada inicio de funcion/destino y la instruccion posterior a un salto/llamada
bl = set(inicios)
for (a, t), sz in insns.items():
    pass
print('inicios con flujo invalido', len(malos))
json.dump(dict(inicios=sorted([list(x) for x in inicios]), buenos=sorted([list(x) for x in inicios - malos]), insns=[[a, t, s] for (a, t), s in sorted(insns.items())]), open(sys.argv[4], 'w'))
