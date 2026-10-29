// VFPv3 (simple y doble precision) para Cpu: genera el codigo JS de las instrucciones de coprocesador 10/11 y los mrc/mcr de cp15.
// Los registros viven en cpu.D / cpu.S / cpu.SI (D0..D31 = S0..S63 compartidos); FP[0] = FPSCR (banderas en 31..28).
'use strict';
Cpu.prototype.genCop = function (ir, c) {
  const w = ir.w >>> 0;
  const b = (hi, lo) => (w >>> lo) & (hi - lo === 31 ? -1 : (1 << (hi - lo + 1)) - 1);
  const { B, T, reg, setr, pc4 } = c;
  const cp = b(11, 8), top = b(27, 24), dbl = cp === 11;
  const fail = (m) => { throw new Error((m || 'cop no soportado') + ' en ' + c.a.toString(16) + ' w=' + w.toString(16)); };
  const D_ = b(22, 22), N_ = b(7, 7), M_ = b(5, 5), Vd = b(15, 12), Vn = b(19, 16), Vm = b(3, 0);
  const idx = (v, x, dd) => (dd ? (x << 4) | v : (v << 1) | x);
  const rd = idx(Vd, D_, dbl), rn = idx(Vn, N_, dbl), rm = idx(Vm, M_, dbl);
  const A = dbl ? 'D' : 'S';
  const X = (e) => (dbl ? e : `Math.fround(${e})`);
  const NANFIX = (d) => (dbl ? `if(SI[${2 * d + 1}]===-524288)SI[${2 * d + 1}]=2146959360;` : `if(SI[${d}]===-4194304)SI[${d}]=2143289344;`);

  if (cp === 15 && top === 14 && b(4, 4) === 1) { // mrc / mcr de cp15
    const l = b(20, 20), crn = b(19, 16), crm = b(3, 0), op1 = b(23, 21), op2 = b(7, 5), rt = b(15, 12);
    if (l === 1 && crn === 13 && crm === 0 && op2 === 3 && op1 === 0) { if (rt !== 15) B(setr(rt, String(c.tls !== undefined ? c.tls : this.tls | 0))); return; }
    if (l === 0 && crn === 7) return; // mantenimiento de cache
    if (l === 0 && crn === 13) return;
    fail('mrc/mcr p15 no soportado');
  }
  if (cp !== 10 && cp !== 11) fail('coprocesador ' + cp);
  if (ir.cond === -1 && !(top === 14 || top === 12 || top === 13)) fail('NEON');
  if (top === 15) fail('NEON');

  if (top === 14 && b(4, 4) === 0) { // procesamiento de datos
    const p = b(23, 23), q = b(21, 21), r = b(20, 20), s = b(6, 6);
    if (!(p && q && r)) {
      const m = `${A}[${rn}]*${A}[${rm}]`;
      if (!p && !q && !r) B(`${A}[${rd}]=${A}[${rd}]${s ? '-' : '+'}${X(m)};`);                    // VMLA / VMLS
      else if (!p && !q && r) B(`${A}[${rd}]=-${A}[${rd}]${s ? '-' : '+'}${X(m)};`);                // VNMLA (s=1) / VNMLS (s=0)
      else if (!p && q && !r) B(`${A}[${rd}]=${s ? '-' : ''}(${m});`);                              // VMUL / VNMUL
      else if (!p && q && r) B(`${A}[${rd}]=${A}[${rn}]${s ? '-' : '+'}${A}[${rm}];`);             // VADD / VSUB
      else if (p && !q && !r && !s) B(`${A}[${rd}]=${A}[${rn}]/${A}[${rm}];`);                      // VDIV
      else fail('VFP fusionado');
      B(NANFIX(rd));
      return;
    }
    const opc2 = b(19, 16), opc3 = b(7, 6);
    if ((opc3 & 1) === 0) { // VMOV inmediato
      const i8 = (b(19, 16) << 4) | b(3, 0), sg = i8 >> 7, e6 = (i8 >> 6) & 1, e54 = (i8 >> 4) & 3, f = i8 & 15;
      if (dbl) { const hi = (sg << 31) | ((e6 ^ 1) << 30) | ((e6 ? 0xff : 0) << 22) | (e54 << 20) | (f << 16); B(`SI[${2 * rd}]=0;SI[${2 * rd + 1}]=${hi | 0};`); }
      else { const v = (sg << 31) | ((e6 ^ 1) << 30) | ((e6 ? 0x1f : 0) << 25) | (e54 << 23) | (f << 19); B(`SI[${rd}]=${v | 0};`); }
      return;
    }
    const e = opc3 >> 1; // bit 7: E en VCMP; 'op' en VCVT
    switch (opc2) {
      case 0:
        if (!e) { if (dbl) B(`SI[${2 * rd}]=SI[${2 * rm}];SI[${2 * rd + 1}]=SI[${2 * rm + 1}];`); else B(`SI[${rd}]=SI[${rm}];`); }               // VMOV reg
        else { if (dbl) B(`SI[${2 * rd}]=SI[${2 * rm}];SI[${2 * rd + 1}]=SI[${2 * rm + 1}]&2147483647;`); else B(`SI[${rd}]=SI[${rm}]&2147483647;`); } // VABS
        return;
      case 1:
        if (!e) { if (dbl) B(`SI[${2 * rd}]=SI[${2 * rm}];SI[${2 * rd + 1}]=SI[${2 * rm + 1}]^-2147483648;`); else B(`SI[${rd}]=SI[${rm}]^-2147483648;`); } // VNEG
        else { B(`${A}[${rd}]=Math.sqrt(${A}[${rm}]);`); B(NANFIX(rd)); }                                                                                    // VSQRT
        return;
      case 4: case 5: { // VCMP / VCMPE
        const t1 = T(), t2 = T();
        B(`const ${t1}=${A}[${rd}],${t2}=${opc2 === 5 ? '0' : `${A}[${rm}]`};`);
        B(`FP[0]=(FP[0]&268435455)|((${t1}!==${t1}||${t2}!==${t2})?805306368:${t1}===${t2}?1610612736:${t1}<${t2}?-2147483648:536870912);`);
        return;
      }
      case 7: // VCVT entre doble y simple (sz indica la precision de origen)
        if (dbl) B(`S[${idx(Vd, D_, false)}]=D[${rm}];`); else B(`D[${idx(Vd, D_, true)}]=S[${rm}];`);
        return;
      case 8: { // entero -> flotante (el entero esta en un registro simple Sm); op (bit 7) = 1: con signo
        const sm = idx(Vm, M_, false);
        B(`${A}[${rd}]=${e ? `SI[${sm}]` : `U[${sm}]`};`);
        return;
      }
      case 12: case 13: { // flotante -> entero (en registro simple Sd)
        const sd = idx(Vd, D_, false), uns = (opc2 & 1) === 0;
        const src = `${A}[${rm}]`;
        const v = e ? src : `H.rte(${src})`; // VCVT (hacia cero) / VCVTR (redondeo del FPSCR)
        B(`SI[${sd}]=H.${uns ? 'f2u' : 'f2i'}(${v});`);
        return;
      }
      case 10: case 11: case 14: case 15: { // VCVT entre coma flotante y punto fijo (en el mismo registro)
        const sz = b(7, 7) ? 32 : 16, fb = sz - ((b(3, 0) << 1) | b(5, 5)), uns = (opc2 & 1) === 1, toFixed = (opc2 & 4) !== 0;
        const sc = 2 ** fb;
        const reg = dbl ? `D[${rd}]` : `S[${rd}]`, wi = dbl ? 2 * rd : rd;
        if (!toFixed) { // punto fijo -> flotante
          const xi = sz === 32 ? `SI[${wi}]` : `(SI[${wi}]<<16>>16)`, xu = sz === 32 ? `U[${wi}]` : `(U[${wi}]&65535)`;
          B(`${reg}=${uns ? xu : xi}/${sc};`);
        } else { // flotante -> punto fijo (hacia cero, saturando)
          const t = T();
          B(`const ${t}=${reg}*${sc};`);
          if (sz === 32) B(`SI[${wi}]=H.${uns ? 'f2u' : 'f2i'}(${t});`);
          else B(`SI[${wi}]=${uns ? `Math.max(0,Math.min(65535,H.f2i(${t})))` : `Math.max(-32768,Math.min(32767,H.f2i(${t})))`};`);
        }
        return;
      }
      default: fail('VFP vcvt/otros opc2=' + opc2);
    }
    return;
  }

  if (top === 14 && b(4, 4) === 1) { // transferencias de registros
    const rt = b(15, 12), l = b(20, 20);
    if (b(23, 21) === 0 && !dbl) { // VMOV Rt, Sn
      const sn = idx(Vn, N_, false);
      if (l) B(setr(rt, `SI[${sn}]`)); else B(`SI[${sn}]=${reg(rt, c.pcv)};`);
      return;
    }
    if (b(23, 21) === 7 && !dbl) { // VMRS / VMSR
      if (Vn === 1) {
        if (l) {
          if (rt === 15) { const t = T(); B(`const ${t}=FP[0];`); return { flags: { k: 'expl', n: `(${t}>>>31)`, z: `((${t}>>>30)&1)`, c: `((${t}>>>29)&1)`, v: `((${t}>>>28)&1)` } }; }
          B(setr(rt, 'FP[0]'));
        } else B(`FP[0]=${reg(rt, c.pcv)};`);
        return;
      }
      if (l) B(setr(rt, Vn === 8 ? '1073741824' : '0')); // FPEXC.EN / otros
      return;
    }
    if (dbl && b(22, 21) < 2 && b(6, 5) === 0 && b(23, 23) === 0) { // VMOV.32 Dd[x], Rt  /  VMOV.32 Rt, Dn[x]
      const x = b(21, 21);
      if (l) B(setr(rt, `SI[${2 * idx(Vn, N_, true) + x}]`)); else B(`SI[${2 * idx(Vn, N_, true) + x}]=${reg(rt, c.pcv)};`);
      return;
    }
    fail('VFP transferencia');
  }

  // carga / almacenamiento (coprocesador, top = 110x)
  if (b(27, 21) === 0x62) { // VMOV Rt, Rt2, Dm / Sm, Sm+1
    const rt = b(15, 12), rt2 = b(19, 16), l = b(20, 20);
    const lo = dbl ? 2 * idx(Vm, M_, true) : idx(Vm, M_, false);
    if (l) { B(setr(rt, `SI[${lo}]`)); B(setr(rt2, `SI[${lo + 1}]`)); } else B(`SI[${lo}]=${reg(rt, c.pcv)};SI[${lo + 1}]=${reg(rt2, c.pcv)};`);
    return;
  }
  const P = b(24, 24), U = b(23, 23), W = b(21, 21), L = b(20, 20), rnr = b(19, 16), imm8 = b(7, 0);
  const base = rnr === 15 ? String(pc4 | 0) : reg(rnr, c.pcv);
  const wi0 = dbl ? 2 * rd : rd; // indice de palabra
  if (P && !W) { // VLDR / VSTR
    const t = T();
    B(`const ${t}=(${base}${U ? '+' : '-'}${imm8 * 4})|0;`);
    if (L) B(`SI[${wi0}]=dv.getInt32(${t},true);` + (dbl ? `SI[${wi0 + 1}]=dv.getInt32(${t}+4,true);` : ''));
    else B(`dv.setInt32(${t},SI[${wi0}],true);` + (dbl ? `dv.setInt32(${t}+4,SI[${wi0 + 1}],true);` : ''));
    return;
  }
  if ((!P && U) || (P && !U && W)) { // VLDM / VSTM (IA o DB), VPUSH / VPOP
    const nw = imm8;
    if (wi0 + nw > 64) fail('VLDM fuera de rango');
    const t = T();
    B(`const ${t}=${P ? `(${base}-${nw * 4})|0` : base};`);
    for (let i = 0; i < nw; i++) {
      if (L) B(`SI[${wi0 + i}]=dv.getInt32(${t}+${4 * i},true);`); else B(`dv.setInt32(${t}+${4 * i},SI[${wi0 + i}],true);`);
    }
    if (W) B(setr(rnr, P ? t : `(${t}+${nw * 4})|0`));
    return;
  }
  fail('VFP ldc/stc');
};
