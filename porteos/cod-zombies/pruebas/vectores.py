# Pruebas diferenciales del emulador JS contra Unicorn (Cortex-A8).
#   python3 -I vectores.py gen  DIR BLOQUES.pkl|-  N_POR_BLOQUE SEMILLA [MAX_BLOQUES]
#   node difftest.js run DIR/in.bin DIR/out.bin IMAGEN.bin BASE
#   python3 -I vectores.py check DIR IMAGEN.bin BASE
import sys, os, json, struct, random, pickle, collections
from unicorn import *
from unicorn.arm_const import *
from capstone import *

SCR, SCRSZ = 0x02000000, 0x10000
CODEA = 0x02800000
MEMLO, MEMSZ = 0x00100000, 0x02F00000
VFPREGS = [getattr(__import__('unicorn.arm_const', fromlist=['x']), 'UC_ARM_REG_D%d' % i) for i in range(32)]

def rnd_reg(rng, ptr_p=0.5):
    x = rng.random()
    if x < ptr_p: return SCR + 0x1000 + (rng.randrange(0, 0xD000) & ~3)
    if x < ptr_p + 0.20: return rng.randrange(-8, 300) & 0xFFFFFFFF
    if x < ptr_p + 0.35: return rng.choice([0, 1, 0xFFFFFFFF, 0x7FFFFFFF, 0x80000000, 0xFFFF, 0x10000, 0x80000001, 0xFFFFFF00, 31, 32, 33, 255, 256])
    return rng.getrandbits(32)

def rnd_float(rng):
    k = rng.random()
    if k < 0.1: return 0.0
    if k < 0.2: return float(rng.randrange(-20, 20))
    return rng.uniform(-1000, 1000) * (10 ** rng.randrange(-3, 3))

def rnd_vfp(rng):
    w = []
    for i in range(32):
        if rng.random() < 0.5:
            b = struct.pack('<d', rnd_float(rng))
        else:
            b = struct.pack('<ff', rnd_float(rng), rnd_float(rng))
        lo, hi = struct.unpack('<II', b)
        w += [lo, hi]
    return w

def gen(d, pkl, npb, semilla, maxb):
    os.makedirs(d, exist_ok=True)
    rng = random.Random(int(semilla))
    if pkl == '-':
        bl = []
    else:
        bl = sorted(pickle.load(open(pkl, 'rb')).keys())
    if maxb and len(bl) > maxb: bl = rng.sample(bl, maxb)
    scratch = bytes(rng.getrandbits(8) for _ in range(SCRSZ))
    open(d + '/out.bin.scratch', 'wb').write(scratch)
    tests = []; blob = bytearray()
    for (a, t) in bl:
        for _ in range(npb):
            regs = [rnd_reg(rng) for _ in range(16)]
            regs[13] = SCR + 0x2000 + (rng.randrange(0, 0xB000) & ~7) if rng.random() < 0.9 else rnd_reg(rng)
            regs[15] = 0
            nzcv = rng.getrandbits(4) << 28
            vfp = rnd_vfp(rng); fpscr = (rng.getrandbits(4) << 28)
            blob += struct.pack('<II', a | t, 0) + bytes(32)
            blob += struct.pack('<16I', *regs)
            blob += struct.pack('<I', nzcv)
            blob += struct.pack('<64I', *vfp)
            blob += struct.pack('<I', fpscr)
            tests.append(a | t)
    open(d + '/in.bin', 'wb').write(struct.pack('<I', len(tests)) + bytes(blob))
    print('pruebas', len(tests))

def gen_insn(d, codigo, K, semilla):
    os.makedirs(d, exist_ok=True)
    rng = random.Random(int(semilla))
    base = 0x104000
    img = open(os.environ['IMG'], 'rb').read()
    ins = json.load(open(codigo))['insns']
    mdT = Cs(CS_ARCH_ARM, CS_MODE_THUMB); mdA = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    uniq = {}
    for a, t, sz in ins:
        b = img[a - base:a - base + sz]
        uniq[(t, b)] = a
    grupos = collections.defaultdict(list)
    for (t, b), a in uniq.items():
        i = next(iter((mdT if t else mdA).disasm(b, a, 1)), None)
        if i: grupos[(t, i.mnemonic)].append((t, b))
    scratch = bytes(rng.getrandbits(8) for _ in range(SCRSZ))
    open(d + '/out.bin.scratch', 'wb').write(scratch)
    blob = bytearray(); n = 0
    for k, lst in sorted(grupos.items()):
        if len(lst) > K: lst = rng.sample(lst, K)
        for (t, b) in lst:
            for _ in range(2):
                ca = CODEA + (rng.choice([0, 2]) if t else 0)
                sent = struct.pack('<H', 0xE7FE) if t else struct.pack('<I', 0xEAFFFFFE)
                code = (b + sent + bytes(rng.getrandbits(8) for _ in range(32)))[:32]
                regs = [rnd_reg(rng) for _ in range(16)]
                regs[13] = SCR + 0x2000 + (rng.randrange(0, 0xB000) & ~7) if rng.random() < 0.9 else rnd_reg(rng)
                regs[15] = 0
                blob += struct.pack('<II', ca | t, 1 if False else 0) + code
                blob += struct.pack('<16I', *regs) + struct.pack('<I', rng.getrandbits(4) << 28)
                blob += struct.pack('<64I', *rnd_vfp(rng)) + struct.pack('<I', rng.getrandbits(4) << 28)
                n += 1
    open(d + '/in.bin', 'wb').write(struct.pack('<I', n) + bytes(blob))
    print('mnemonicos', len(grupos), 'pruebas', n)

def mk_uc(img, base):
    mu = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    mu.ctl_set_cpu_model(UC_CPU_ARM_CORTEX_A8)
    mu.mem_map(MEMLO, MEMSZ, UC_PROT_ALL)
    mu.mem_write(base, img)
    mu.wr = (base + 0x3dc000, img[0x3dc000:] + bytes(0x4a8000 - 0x3dc000 - len(img[0x3dc000:])))
    for k in range(512): mu.mem_write(0x100000 + 8 * k, struct.pack('<II', 0xe12fff1e, 0))
    mu.reg_write(UC_ARM_REG_C1_C0_2, 0xF00000)
    mu.reg_write(UC_ARM_REG_FPEXC, 0x40000000)
    mu.until = [0, True]
    def cb(uc, addr, size, ud):
        if uc.until[1]: uc.until[1] = False; return
        if addr == uc.until[0]: uc.emu_stop()
    mu.hook_add(UC_HOOK_CODE, cb)
    return mu

def check(d, fimg, sbase):
    base = int(sbase, 0)
    img = open(fimg, 'rb').read()
    inp = open(d + '/in.bin', 'rb').read(); out = open(d + '/out.bin', 'rb').read()
    scratch = open(d + '/out.bin.scratch', 'rb').read()
    n = struct.unpack_from('<I', inp, 0)[0]; assert struct.unpack_from('<I', out, 0)[0] == n
    mu = mk_uc(img, base)
    mdT = Cs(CS_ARCH_ARM, CS_MODE_THUMB); mdA = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    io = 4; oo = 4
    ok = skip = bad = jserr = 0
    cub = collections.Counter(); todos = set(); skipc = collections.Counter()
    malos = collections.defaultdict(list)
    REGS = [getattr(__import__('unicorn.arm_const', fromlist=['x']), 'UC_ARM_REG_R%d' % i) for i in range(15)]
    def nanish(x): # palabra float32 con exponente todo 1 y mantisa no cero
        return (x & 0x7F800000) == 0x7F800000 and (x & 0x7FFFFF) != 0
    for t in range(n):
        pcT, lim = struct.unpack_from('<II', inp, io); io += 8
        code = inp[io:io + 32]; io += 32
        regs = struct.unpack_from('<16I', inp, io); io += 64
        nzcv = struct.unpack_from('<I', inp, io)[0]; io += 4
        vfp = struct.unpack_from('<64I', inp, io); io += 256
        fpscr = struct.unpack_from('<I', inp, io)[0]; io += 4
        st, pcout = struct.unpack_from('<II', out, oo); oo += 8
        jr = struct.unpack_from('<16I', out, oo); oo += 64
        jn = struct.unpack_from('<I', out, oo)[0]; oo += 4
        jv = struct.unpack_from('<64I', out, oo); oo += 256
        jf = struct.unpack_from('<I', out, oo)[0]; oo += 4
        nw = struct.unpack_from('<I', out, oo)[0]; oo += 4
        jw = struct.unpack_from('<%dI' % (2 * nw), out, oo); oo += 8 * nw
        jwd = {jw[2 * i]: jw[2 * i + 1] for i in range(nw)}
        a = pcT & ~1; thumb = pcT & 1; todos.add(pcT)
        md = mdT if thumb else mdA
        try: ins = list(md.disasm(code if a >= CODEA else img[a - base:a - base + 16], a))[:1]
        except Exception: ins = []
        txt = '%x %s' % (a, ('%s %s' % (ins[0].mnemonic, ins[0].op_str)) if ins else '?')
        if a >= CODEA: txt += ' [%s]' % code[:4].hex()
        if st:
            jserr += 1; continue
        # Unicorn
        mu.mem_write(SCR, scratch); mu.mem_write(mu.wr[0], mu.wr[1])
        if pcT >= CODEA: mu.mem_write(CODEA, code); mu.ctl_remove_cache(CODEA, CODEA + 64)
        mu.reg_write(UC_ARM_REG_CPSR, (nzcv | (0x20 if thumb else 0) | 0x10))
        for i in range(15): mu.reg_write(REGS[i], regs[i])
        for i in range(32): mu.reg_write(VFPREGS[i], vfp[2 * i] | (vfp[2 * i + 1] << 32))
        mu.reg_write(UC_ARM_REG_FPSCR, fpscr)
        until = pcout & ~1
        if not lim and a < CODEA and a < until < a + 512: skip += 1; continue # bucle interno: Unicorn pararia en la primera llegada
        try:
            mu.until[0] = until; mu.until[1] = True
            if lim: mu.until[0] = 0xFFFFFFF1
            mu.emu_start(pcT, 0xFFFFFFF0, 0, lim if lim else 400)
        except UcError as e:
            if not (e.errno == UC_ERR_FETCH_UNMAPPED and (mu.reg_read(UC_ARM_REG_PC) & ~1) == until):
                skip += 1; skipc[str(e)] += 1; continue
        pc2 = mu.reg_read(UC_ARM_REG_PC)
        diffs = []
        if not lim and (pc2 & ~1) != (until & ~1): diffs.append('pc u=%x js=%x' % (pc2, pcout))
        for i in range(15):
            u = mu.reg_read(REGS[i])
            if u != jr[i]: diffs.append('r%d u=%x js=%x' % (i, u, jr[i]))
        cp = mu.reg_read(UC_ARM_REG_CPSR) & 0xF0000000
        if cp != jn: diffs.append('nzcv u=%x js=%x' % (cp >> 28, jn >> 28))
        for i in range(32):
            u = mu.reg_read(VFPREGS[i]); lo, hi = u & 0xFFFFFFFF, u >> 32
            for k, (x, y) in enumerate(((lo, jv[2 * i]), (hi, jv[2 * i + 1]))):
                if x != y and not (nanish(x) and nanish(y)):
                    # NaN doble
                    if k == 1 and (x & 0x7FF00000) == 0x7FF00000 and (y & 0x7FF00000) == 0x7FF00000: continue
                    diffs.append('d%d.%d u=%x js=%x' % (i, k, x, y))
        fu = mu.reg_read(UC_ARM_REG_FPSCR) & 0xF0000000
        if fu != (jf & 0xF0000000): diffs.append('fpscr u=%x js=%x' % (fu >> 28, jf >> 28))
        cur = bytes(mu.mem_read(SCR, SCRSZ))
        ud = {}
        if cur != scratch:
            for c0 in range(0, SCRSZ, 256):
                if cur[c0:c0 + 256] != scratch[c0:c0 + 256]:
                    for i in range(c0, c0 + 256):
                        if cur[i] != scratch[i]: ud[i] = cur[i]
        if ud != jwd:
            ks = sorted(set(ud) ^ set(jwd) | {k for k in ud if k in jwd and ud[k] != jwd[k]})[:4]
            diffs.append('mem ' + ' '.join('%x:u=%s/js=%s' % (k, ud.get(k), jwd.get(k)) for k in ks))
        if diffs:
            bad += 1
            malos[(pcT, lim, bad)].append((txt, diffs[:4]))
        else: ok += 1; cub[pcT] += 1
    print('ok', ok, 'mal', bad, 'omitidas(unicorn fallo)', skip, 'error JS', jserr)
    print('fallos Unicorn:', skipc.most_common(4))
    pm = collections.defaultdict(list)
    for (pcT, lim, _b), lst in malos.items():
        for txt, df in lst:
            sp = txt.split()
            pm[sp[1] if len(sp) > 1 else '?'].append((txt, df))
    print('mnemonicos con fallos:', sorted([(k, len(x)) for k, x in pm.items()], key=lambda z: -z[1])[:60])
    for k, x in sorted(pm.items(), key=lambda z: -len(z[1]))[:int(os.environ.get('MOSTRAR', '25'))]:
        for txt, df in x[:int(os.environ.get('EJ', '2'))]:
            print(' ', txt, '|', '; '.join(df))

def bisect(d, pcT, idx, L):
    # repite el estado de la prueba idx-esima de ese pc con limites 1..L
    inp = open(d + '/in.bin', 'rb').read()
    n = struct.unpack_from('<I', inp, 0)[0]; sz = 8 + 32 + 64 + 4 + 256 + 4
    k = 0; hit = None
    for t in range(n):
        p = struct.unpack_from('<I', inp, 4 + t * sz)[0]
        if p == pcT:
            if k == idx: hit = t; break
            k += 1
    rec = inp[4 + hit * sz:4 + (hit + 1) * sz]
    blob = bytearray()
    for l in range(1, L + 1):
        blob += rec[:4] + struct.pack('<I', l) + rec[8:]
    os.makedirs(d + '/bis', exist_ok=True)
    open(d + '/bis/in.bin', 'wb').write(struct.pack('<I', L) + bytes(blob))
    import shutil; shutil.copy(d + '/out.bin.scratch', d + '/bis/out.bin.scratch')

if __name__ == '__main__':
    if sys.argv[1] == 'insn': gen_insn(sys.argv[2], sys.argv[3], int(sys.argv[4]), sys.argv[5]); sys.exit()
    if sys.argv[1] == 'bisect': bisect(sys.argv[2], int(sys.argv[3], 0), int(sys.argv[4]), int(sys.argv[5])); sys.exit()
    if sys.argv[1] == 'gen': gen(sys.argv[2], sys.argv[3], int(sys.argv[4]), sys.argv[5], int(sys.argv[6]) if len(sys.argv) > 6 else 0)
    else: check(sys.argv[2], sys.argv[3], sys.argv[4])
