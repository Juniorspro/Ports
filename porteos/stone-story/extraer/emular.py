# Ejecuta una funcion pura de libil2cpp.so (ARM64) con unicorn, para cada valor de entrada
import sys, json
from unicorn import *
from unicorn.arm64_const import *
from elftools.elf.elffile import ELFFile
so, dir_fn = sys.argv[1], int(sys.argv[2], 16)
mu = Uc(UC_ARCH_ARM64, UC_MODE_ARM)
f = open(so, 'rb'); elf = ELFFile(f)
for s in elf.iter_segments():
    if s['p_type'] != 'PT_LOAD': continue
    a = s['p_vaddr'] & ~0xfff; fin = (s['p_vaddr'] + s['p_memsz'] + 0xfff) & ~0xfff
    mu.mem_map(a, fin - a)
    mu.mem_write(s['p_vaddr'], s.data())
PILA = 0x7f000000; mu.mem_map(PILA - 0x100000, 0x200000)
RET = 0x7e000000; mu.mem_map(RET, 0x1000)
res = {}
for c in range(int(sys.argv[3]), int(sys.argv[4])):
    mu.reg_write(UC_ARM64_REG_X0, c); mu.reg_write(UC_ARM64_REG_X1, 0)
    mu.reg_write(UC_ARM64_REG_SP, PILA); mu.reg_write(UC_ARM64_REG_X30, RET)
    try:
        mu.emu_start(dir_fn, RET, count=5000)
        v = mu.reg_read(UC_ARM64_REG_X0) & 0xffffffff
        if v >= 0x80000000: v -= 1 << 32
        res[c] = v
    except UcError as e:
        res[c] = 'ERR'
print(json.dumps({k: v for k, v in res.items() if v != -1}))
