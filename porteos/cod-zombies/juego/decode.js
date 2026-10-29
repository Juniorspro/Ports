// Decodificador ARMv7-A: Thumb (16 y 32 bits) y ARM. Devuelve una instruccion en forma comun:
//   {k: clase, len: bytes, ...campos}   (cond la pone el que llama: ARM la trae; Thumb sale del bloque IT)
// Clases: dp mem ldm stm mul div b bl blx bx cbz tbb it bits ext movw movt adr svc nop vfp unk ...
'use strict';
const Dec = (() => {
  const D = {};
  const bits = (x, hi, lo) => (x >>> lo) & (hi - lo === 31 ? -1 : ((1 << (hi - lo + 1)) - 1));
  const sx = (x, n) => (x << (32 - n)) >> (32 - n);
  const ror32 = (x, n) => (n === 0 ? x : ((x >>> n) | (x << (32 - n))) | 0);

  // operando 2
  const I = (v, c) => ({ t: 'i', v: v | 0, c: c === undefined ? -1 : c }); // c: acarreo de salida (-1: sin cambio)
  const R = (rm, st, sn) => ({ t: 'r', rm, st, sn });                    // registro con desplazamiento inmediato
  const RS = (rm, st, rs) => ({ t: 's', rm, st, rs });                   // registro desplazado por registro
  const DP = (op, s, rd, rn, o2, len) => ({ k: 'dp', op, s, rd, rn, o2, len });
  const UNK = (len, w) => ({ k: 'unk', len, w });

  // desplazamiento inmediato codificado (type, imm5) -> [tipo, cantidad]
  function immShift(type, imm5) {
    switch (type) {
      case 0: return ['lsl', imm5];
      case 1: return ['lsr', imm5 === 0 ? 32 : imm5];
      case 2: return ['asr', imm5 === 0 ? 32 : imm5];
      default: return imm5 === 0 ? ['rrx', 1] : ['ror', imm5];
    }
  }
  const SHT = ['lsl', 'lsr', 'asr', 'ror'];

  // ---------- ThumbExpandImm ----------
  function thumbImm(imm12) {
    if ((imm12 >> 10) === 0) {
      const b = imm12 & 0xff;
      switch ((imm12 >> 8) & 3) {
        case 0: return I(b);
        case 1: return I((b << 16) | b);
        case 2: return I((b << 24) | (b << 8));
        default: return I((b << 24) | (b << 16) | (b << 8) | b);
      }
    }
    const un = 0x80 | (imm12 & 0x7f), rot = imm12 >> 7;
    const v = ror32(un, rot);
    return I(v, v >>> 31);
  }
  function armImm(imm12) {
    const rot = (imm12 >> 8) * 2, v = ror32(imm12 & 0xff, rot);
    return I(v, rot === 0 ? -1 : v >>> 31);
  }

  // ======================= Thumb 16 bits =======================
  function thumb16(h, pc, inIT) {
    const S = !inIT;
    switch (h >> 12) {
      case 0: case 1: {
        const op = bits(h, 12, 11);
        if (op < 3) { // desplazamiento inmediato
          const [t, n] = immShift(op, bits(h, 10, 6));
          return DP('mov', S, bits(h, 2, 0), 0, R(bits(h, 5, 3), t, n), 2);
        }
        // add/sub
        const rd = bits(h, 2, 0), rn = bits(h, 5, 3), sub = bits(h, 9, 9);
        const o2 = bits(h, 10, 10) ? I(bits(h, 8, 6)) : R(bits(h, 8, 6), 'lsl', 0);
        return DP(sub ? 'sub' : 'add', S, rd, rn, o2, 2);
      }
      case 2: case 3: {
        const rd = bits(h, 10, 8), imm = I(h & 0xff);
        switch (bits(h, 12, 11)) {
          case 0: return DP('mov', S, rd, 0, imm, 2);
          case 1: return DP('cmp', true, 0, rd, imm, 2);
          case 2: return DP('add', S, rd, rd, imm, 2);
          default: return DP('sub', S, rd, rd, imm, 2);
        }
      }
      case 4: {
        if (bits(h, 11, 10) === 0) { // data-processing registros
          const op = bits(h, 9, 6), rm = bits(h, 5, 3), rd = bits(h, 2, 0);
          const rr = R(rm, 'lsl', 0);
          switch (op) {
            case 0: return DP('and', S, rd, rd, rr, 2);
            case 1: return DP('eor', S, rd, rd, rr, 2);
            case 2: return DP('mov', S, rd, 0, RS(rd, 'lsl', rm), 2);
            case 3: return DP('mov', S, rd, 0, RS(rd, 'lsr', rm), 2);
            case 4: return DP('mov', S, rd, 0, RS(rd, 'asr', rm), 2);
            case 5: return DP('adc', S, rd, rd, rr, 2);
            case 6: return DP('sbc', S, rd, rd, rr, 2);
            case 7: return DP('mov', S, rd, 0, RS(rd, 'ror', rm), 2);
            case 8: return DP('tst', true, 0, rd, rr, 2);
            case 9: return DP('rsb', S, rd, rm, I(0), 2);
            case 10: return DP('cmp', true, 0, rd, rr, 2);
            case 11: return DP('cmn', true, 0, rd, rr, 2);
            case 12: return DP('orr', S, rd, rd, rr, 2);
            case 13: return { k: 'mul', op: 'mul', s: S, rd, rn: rm, rm: rd, ra: -1, len: 2 };
            case 14: return DP('bic', S, rd, rd, rr, 2);
            default: return DP('mvn', S, rd, 0, rr, 2);
          }
        }
        if (bits(h, 11, 10) === 1) { // datos especiales / bx
          const op = bits(h, 9, 8), rm = bits(h, 6, 3), rd = bits(h, 7, 7) * 8 + bits(h, 2, 0);
          switch (op) {
            case 0: return DP('add', false, rd, rd, R(rm, 'lsl', 0), 2);
            case 1: return DP('cmp', true, 0, rd, R(rm, 'lsl', 0), 2);
            case 2: return DP('mov', false, rd, 0, R(rm, 'lsl', 0), 2);
            default: return bits(h, 7, 7) ? { k: 'blx', rm, len: 2 } : { k: 'bx', rm, len: 2 };
          }
        }
        // LDR literal
        const rt = bits(h, 10, 8);
        return { k: 'mem', op: 'ldr', sz: 4, sg: false, rt, rn: 15, off: I(bits(h, 7, 0) << 2), add: true, pre: true, wb: false, len: 2 };
      }
      case 5: { // load/store registro
        const op = bits(h, 11, 9), rm = bits(h, 8, 6), rn = bits(h, 5, 3), rt = bits(h, 2, 0);
        const off = R(rm, 'lsl', 0);
        const T = [['str', 4, false], ['str', 2, false], ['str', 1, false], ['ldr', 1, true], ['ldr', 4, false], ['ldr', 2, false], ['ldr', 1, false], ['ldr', 2, true]][op];
        return { k: 'mem', op: T[0], sz: T[1], sg: T[2], rt, rn, off, add: true, pre: true, wb: false, len: 2 };
      }
      case 6: case 7: { // imm5: STR/LDR/STRB/LDRB
        const b = bits(h, 12, 12), l = bits(h, 11, 11), imm = bits(h, 10, 6);
        return { k: 'mem', op: l ? 'ldr' : 'str', sz: b ? 1 : 4, sg: false, rt: bits(h, 2, 0), rn: bits(h, 5, 3), off: I(b ? imm : imm << 2), add: true, pre: true, wb: false, len: 2 };
      }
      case 8: // STRH/LDRH imm5
        return { k: 'mem', op: bits(h, 11, 11) ? 'ldr' : 'str', sz: 2, sg: false, rt: bits(h, 2, 0), rn: bits(h, 5, 3), off: I(bits(h, 10, 6) << 1), add: true, pre: true, wb: false, len: 2 };
      case 9: // SP-relativo
        return { k: 'mem', op: bits(h, 11, 11) ? 'ldr' : 'str', sz: 4, sg: false, rt: bits(h, 10, 8), rn: 13, off: I(bits(h, 7, 0) << 2), add: true, pre: true, wb: false, len: 2 };
      case 10: { // ADR / ADD rd, sp, #imm8*4
        const rd = bits(h, 10, 8), imm = bits(h, 7, 0) << 2;
        if (bits(h, 11, 11) === 0) return { k: 'adr', rd, abs: ((pc + 4) & ~3) + imm, len: 2 };
        return DP('add', false, rd, 13, I(imm), 2);
      }
      case 11: {
        const b = bits(h, 11, 8);
        if (bits(h, 11, 8) === 0) return DP(bits(h, 7, 7) ? 'sub' : 'add', false, 13, 13, I(bits(h, 6, 0) << 2), 2);
        if ((b & 5) === 1) { // CBZ/CBNZ (1011 x0x1)
          const off = (bits(h, 9, 9) << 6) | (bits(h, 7, 3) << 1);
          return { k: 'cbz', nz: bits(h, 11, 11) === 1, rn: bits(h, 2, 0), target: pc + 4 + off, len: 2 };
        }
        if (b === 2) { // SXTH SXTB UXTH UXTB
          const t = bits(h, 7, 6), rm = bits(h, 5, 3), rd = bits(h, 2, 0);
          return { k: 'ext', op: ['sxth', 'sxtb', 'uxth', 'uxtb'][t], rd, rn: 15, rm, rot: 0, len: 2 };
        }
        if ((b & 14) === 4) // PUSH (1011 010x)
          return { k: 'stm', rn: 13, mode: 'db', wb: true, list: bits(h, 7, 0) | (bits(h, 8, 8) << 14), len: 2 };
        if ((b & 14) === 12) // POP (1011 110x)
          return { k: 'ldm', rn: 13, mode: 'ia', wb: true, list: bits(h, 7, 0) | (bits(h, 8, 8) << 15), len: 2 };
        if (b === 10) { // REV REV16 REVSH
          const t = bits(h, 7, 6), rm = bits(h, 5, 3), rd = bits(h, 2, 0);
          if (t === 0) return { k: 'bits', op: 'rev', rd, rm, len: 2 };
          if (t === 1) return { k: 'bits', op: 'rev16', rd, rm, len: 2 };
          if (t === 3) return { k: 'bits', op: 'revsh', rd, rm, len: 2 };
        }
        if (b === 14) return { k: 'bkpt', len: 2 };
        if (b === 15) { // IT y sugerencias
          const mask = bits(h, 3, 0), fc = bits(h, 7, 4);
          if (mask !== 0) return { k: 'it', fc, mask, len: 2 };
          return { k: 'nop', len: 2 };
        }
        if (b === 6) return { k: 'nop', len: 2 }; // CPS
        return UNK(2, h);
      }
      case 12: // STMIA / LDMIA
        return { k: bits(h, 11, 11) ? 'ldm' : 'stm', rn: bits(h, 10, 8), mode: 'ia', wb: bits(h, 11, 11) ? !(bits(h, 7, 0) >> bits(h, 10, 8) & 1) : true, list: bits(h, 7, 0), len: 2 };
      case 13: {
        const c = bits(h, 11, 8);
        if (c === 15) return { k: 'svc', imm: h & 0xff, len: 2 };
        if (c === 14) return UNK(2, h);
        return { k: 'b', cond: c, target: pc + 4 + (sx(h & 0xff, 8) << 1), len: 2 };
      }
      default: // 14: B imm11
        return { k: 'b', cond: -1, target: pc + 4 + (sx(h & 0x7ff, 11) << 1), len: 2 };
    }
  }

  // ======================= Thumb 32 bits =======================
  function thumb32(h1, h2, pc) {
    const w = ((h1 << 16) | h2) >>> 0;
    const op1 = bits(h1, 12, 11), op2 = bits(h1, 10, 4), op = bits(h2, 15, 15);
    if (op1 === 1) {
      if ((op2 & 0x64) === 0) { // carga/almacenamiento multiple (00xx0xx)
        const mode = bits(h1, 8, 7), l = bits(h1, 4, 4), rn = bits(h1, 3, 0), wb = bits(h1, 5, 5) === 1;
        if (mode === 1 || mode === 2) return { k: l ? 'ldm' : 'stm', rn, mode: mode === 1 ? 'ia' : 'db', wb, list: h2, len: 4 };
        return UNK(4, w);
      }
      if ((op2 & 0x64) === 0x04) { // carga/almacenamiento doble o exclusivo; tabla de saltos (00xx1xx)
        const o1 = bits(h1, 8, 7), o2 = bits(h1, 5, 4), rn = bits(h1, 3, 0);
        if (o1 === 0 && o2 === 0) return { k: 'strex', sz: 4, rd: bits(h2, 11, 8), rt: bits(h2, 15, 12), rn, imm: bits(h2, 7, 0) << 2, len: 4 };
        if (o1 === 0 && o2 === 1) return { k: 'ldrex', sz: 4, rt: bits(h2, 15, 12), rn, imm: bits(h2, 7, 0) << 2, len: 4 };
        if (o1 === 1 && o2 === 1) {
          const o3 = bits(h2, 7, 4);
          if (o3 === 0 || o3 === 1) return { k: 'tbb', h: o3 === 1, rn, rm: bits(h2, 3, 0), pc: pc + 4, len: 4 };
          if (o3 === 4 || o3 === 5) return { k: 'ldrex', sz: o3 === 4 ? 1 : 2, rt: bits(h2, 15, 12), rn, imm: 0, len: 4 };
        }
        if (o1 === 1 && o2 === 0) {
          const o3 = bits(h2, 7, 4);
          if (o3 === 4 || o3 === 5) return { k: 'strex', sz: o3 === 4 ? 1 : 2, rd: bits(h2, 3, 0), rt: bits(h2, 15, 12), rn, imm: 0, len: 4 };
        }
        if (bits(h1, 6, 6) === 1 || (o1 & 2) !== 0 || o1 === 1) { // LDRD/STRD
          const p = bits(h1, 8, 8), u = bits(h1, 7, 7), wb = bits(h1, 5, 5), l = bits(h1, 4, 4);
          if (bits(h1, 6, 6) === 1) {
            return { k: 'dual', op: l ? 'ldrd' : 'strd', rt: bits(h2, 15, 12), rt2: bits(h2, 11, 8), rn, imm: bits(h2, 7, 0) << 2, add: u === 1, pre: p === 1, wb: wb === 1, len: 4 };
          }
        }
        return UNK(4, w);
      }
      if ((op2 & 0x60) === 0x20) { // data-processing registro desplazado (01xxxxx)
        const o = bits(h1, 8, 5), s = bits(h1, 4, 4) === 1, rn = bits(h1, 3, 0);
        const rd = bits(h2, 11, 8), rm = bits(h2, 3, 0);
        const type = bits(h2, 5, 4), imm5 = (bits(h2, 14, 12) << 2) | bits(h2, 7, 6);
        const [st, sn] = immShift(type, imm5);
        const o2 = R(rm, st, sn);
        const rdz = rd === 15 && s;
        switch (o) {
          case 0: return rdz ? DP('tst', true, 0, rn, o2, 4) : DP('and', s, rd, rn, o2, 4);
          case 1: return DP('bic', s, rd, rn, o2, 4);
          case 2: return rn === 15 ? DP('mov', s, rd, 0, o2, 4) : DP('orr', s, rd, rn, o2, 4);
          case 3: return rn === 15 ? DP('mvn', s, rd, 0, o2, 4) : DP('orn', s, rd, rn, o2, 4);
          case 4: return rdz ? DP('teq', true, 0, rn, o2, 4) : DP('eor', s, rd, rn, o2, 4);
          case 6: // PKH
            return { k: 'pkh', tb: bits(h2, 5, 5) === 1, rd, rn, rm, sh: imm5, len: 4 };
          case 8: return rdz ? DP('cmn', true, 0, rn, o2, 4) : DP('add', s, rd, rn, o2, 4);
          case 10: return DP('adc', s, rd, rn, o2, 4);
          case 11: return DP('sbc', s, rd, rn, o2, 4);
          case 13: return rdz ? DP('cmp', true, 0, rn, o2, 4) : DP('sub', s, rd, rn, o2, 4);
          case 14: return DP('rsb', s, rd, rn, o2, 4);
          default: return UNK(4, w);
        }
      }
      return { k: 'cop', w, len: 4 }; // coprocesador / VFP / NEON (1xxxxxx)
    }
    if (op1 === 2) {
      if (op === 0) {
        const i = bits(h1, 10, 10), s = bits(h1, 4, 4) === 1, rn = bits(h1, 3, 0);
        const rd = bits(h2, 11, 8), imm3 = bits(h2, 14, 12), imm8 = bits(h2, 7, 0);
        if ((op2 & 0x20) === 0) { // modified immediate
          const o = bits(h1, 8, 5), o2 = thumbImm((i << 11) | (imm3 << 8) | imm8);
          const rdz = rd === 15 && s;
          switch (o) {
            case 0: return rdz ? DP('tst', true, 0, rn, o2, 4) : DP('and', s, rd, rn, o2, 4);
            case 1: return DP('bic', s, rd, rn, o2, 4);
            case 2: return rn === 15 ? DP('mov', s, rd, 0, o2, 4) : DP('orr', s, rd, rn, o2, 4);
            case 3: return rn === 15 ? DP('mvn', s, rd, 0, o2, 4) : DP('orn', s, rd, rn, o2, 4);
            case 4: return rdz ? DP('teq', true, 0, rn, o2, 4) : DP('eor', s, rd, rn, o2, 4);
            case 8: return rdz ? DP('cmn', true, 0, rn, o2, 4) : DP('add', s, rd, rn, o2, 4);
            case 10: return DP('adc', s, rd, rn, o2, 4);
            case 11: return DP('sbc', s, rd, rn, o2, 4);
            case 13: return rdz ? DP('cmp', true, 0, rn, o2, 4) : DP('sub', s, rd, rn, o2, 4);
            case 14: return DP('rsb', s, rd, rn, o2, 4);
            default: return UNK(4, w);
          }
        }
        // plain binary immediate
        const o = bits(h1, 8, 4), imm12 = (i << 11) | (imm3 << 8) | imm8;
        switch (o) {
          case 0: // ADDW / ADR
            if (rn === 15) return { k: 'adr', rd, abs: ((pc + 4) & ~3) + imm12, len: 4 };
            return DP('add', false, rd, rn, I(imm12), 4);
          case 4: return { k: 'movw', rd, imm: (bits(h1, 3, 0) << 12) | imm12, len: 4 };
          case 10:
            if (rn === 15) return { k: 'adr', rd, abs: ((pc + 4) & ~3) - imm12, len: 4 };
            return DP('sub', false, rd, rn, I(imm12), 4);
          case 12: return { k: 'movt', rd, imm: (bits(h1, 3, 0) << 12) | imm12, len: 4 };
          case 16: case 18: case 24: case 26: { // SSAT / USAT
            const sat = bits(h2, 4, 0), sh = (imm3 << 2) | bits(h2, 7, 6);
            return { k: 'sat', uns: o >= 24, rd, rn, sat: o >= 24 ? sat : sat + 1, st: bits(h1, 5, 5) ? 'asr' : 'lsl', sh, len: 4 };
          }
          case 20: case 28: { // SBFX / UBFX
            const lsb = (imm3 << 2) | bits(h2, 7, 6), wm1 = bits(h2, 4, 0);
            return { k: 'bfx', uns: o === 28, rd, rn, lsb, w: wm1 + 1, len: 4 };
          }
          case 22: { // BFI / BFC
            const lsb = (imm3 << 2) | bits(h2, 7, 6), msb = bits(h2, 4, 0);
            return { k: 'bfi', rd, rn, lsb, w: msb - lsb + 1, len: 4 };
          }
          default: return UNK(4, w);
        }
      }
      // saltos y control
      const o1 = bits(h2, 14, 12);
      const s = bits(h1, 10, 10), j1 = bits(h2, 13, 13), j2 = bits(h2, 11, 11);
      if (o1 & 1 && bits(h2, 12, 12) === 1 || (o1 & 4) !== 0) { // B (T4), BL, BLX
        const i1 = (j1 ^ s) ^ 1, i2 = (j2 ^ s) ^ 1;
        let imm = (s << 24) | (i1 << 23) | (i2 << 22) | (bits(h1, 9, 0) << 12) | (bits(h2, 10, 0) << 1);
        imm = sx(imm, 25);
        if (bits(h2, 14, 14) === 0) return { k: 'b', cond: -1, target: pc + 4 + imm, len: 4 };
        if (bits(h2, 12, 12) === 1) return { k: 'bl', target: pc + 4 + imm, len: 4 };
        return { k: 'blx_i', target: ((pc + 4) & ~3) + (imm & ~3 | 0) + (imm & 2 ? 0 : 0), len: 4 };
      }
      if (bits(h2, 14, 14) === 0 && bits(h2, 12, 12) === 0) {
        const c = bits(h1, 9, 6);
        if (c < 14) { // B<c>.W (T3)
          let imm = (s << 20) | (j2 << 19) | (j1 << 18) | (bits(h1, 5, 0) << 12) | (bits(h2, 10, 0) << 1);
          return { k: 'b', cond: c, target: pc + 4 + sx(imm, 21), len: 4 };
        }
        // control varios
        const o = bits(h1, 10, 4);
        if (o === 0x38 || o === 0x39) return { k: 'msr', rn: bits(h1, 3, 0), mask: bits(h2, 11, 8), len: 4 };
        if (o === 0x3a) return { k: 'nop', len: 4 };
        if (o === 0x3b) return { k: 'nop', len: 4 }; // DMB DSB ISB CLREX
        if (o === 0x3e || o === 0x3f) return { k: 'mrs', rd: bits(h2, 11, 8), len: 4 };
        return UNK(4, w);
      }
      return UNK(4, w);
    }
    // op1 === 3
    const rn = bits(h1, 3, 0);
    if ((op2 & 0x71) === 0x00 || (op2 & 0x67) === 0x00 && false) { /* se resuelve abajo */ }
    if ((op2 & 0x71) === 0x00) { // STRB/STRH/STR  (000xxx0)
      const sz = [1, 2, 4][bits(h1, 6, 5)];
      if (bits(h1, 6, 5) === 3) return UNK(4, w);
      const rt = bits(h2, 15, 12);
      if (bits(h1, 7, 7)) return { k: 'mem', op: 'str', sz, sg: false, rt, rn, off: I(bits(h2, 11, 0)), add: true, pre: true, wb: false, len: 4 };
      if (bits(h2, 11, 11)) {
        const p = bits(h2, 10, 10), u = bits(h2, 9, 9), wb = bits(h2, 8, 8);
        return { k: 'mem', op: 'str', sz, sg: false, rt, rn, off: I(bits(h2, 7, 0)), add: u === 1, pre: p === 1, wb: wb === 1, len: 4 };
      }
      return { k: 'mem', op: 'str', sz, sg: false, rt, rn, off: R(bits(h2, 3, 0), 'lsl', bits(h2, 5, 4)), add: true, pre: true, wb: false, len: 4 };
    }
    if ((op2 & 0x67) === 0x01 || (op2 & 0x67) === 0x03 || (op2 & 0x67) === 0x05) { // cargas (00xx001/011/101)
      const sgn = bits(h1, 8, 8) === 1, size = bits(h1, 6, 5);
      if (size === 3) return UNK(4, w);
      const sz = [1, 2, 4][size], rt = bits(h2, 15, 12);
      if (rt === 15 && sz !== 4 && !sgn) return { k: 'nop', len: 4 }; // PLD / PLI
      if (rt === 15 && sgn) return { k: 'nop', len: 4 };
      if (rn === 15) { // literal
        const u = bits(h1, 7, 7), imm = bits(h2, 11, 0);
        return { k: 'mem', op: 'ldr', sz, sg: sgn, rt, rn: 15, off: I(imm), add: u === 1, pre: true, wb: false, len: 4, pc4: (pc + 4) & ~3 };
      }
      if (bits(h1, 7, 7)) return { k: 'mem', op: 'ldr', sz, sg: sgn, rt, rn, off: I(bits(h2, 11, 0)), add: true, pre: true, wb: false, len: 4 };
      if (bits(h2, 11, 11)) {
        const p = bits(h2, 10, 10), u = bits(h2, 9, 9), wb = bits(h2, 8, 8);
        if (bits(h2, 11, 8) === 14) return { k: 'mem', op: 'ldr', sz, sg: sgn, rt, rn, off: I(bits(h2, 7, 0)), add: true, pre: true, wb: false, len: 4 };
        return { k: 'mem', op: 'ldr', sz, sg: sgn, rt, rn, off: I(bits(h2, 7, 0)), add: u === 1, pre: p === 1, wb: wb === 1, len: 4 };
      }
      return { k: 'mem', op: 'ldr', sz, sg: sgn, rt, rn, off: R(bits(h2, 3, 0), 'lsl', bits(h2, 5, 4)), add: true, pre: true, wb: false, len: 4 };
    }
    if ((op2 & 0x70) === 0x20) { // data-processing registro (010xxxx)
      const o1 = bits(h1, 7, 4), o2 = bits(h2, 7, 4), rd = bits(h2, 11, 8), rm = bits(h2, 3, 0);
      if (o2 === 0 && (o1 & 8) === 0) // LSL/LSR/ASR/ROR por registro
        return DP('mov', bits(h1, 4, 4) === 1, rd, 0, RS(rn, SHT[bits(h1, 6, 5)], rm), 4);
      if ((o2 & 8) !== 0 && (o1 & 8) === 0) { // extensiones (con o sin suma)
        const t = bits(h1, 6, 4), rot = bits(h2, 5, 4) * 8;
        const names = ['sxth', 'uxth', 'sxtb16', 'uxtb16', 'sxtb', 'uxtb'];
        const ix = t >> 0;
        const nm = { 0: 'sxth', 1: 'uxth', 2: 'sxtb16', 3: 'uxtb16', 4: 'sxtb', 5: 'uxtb' }[ix];
        if (nm) return { k: 'ext', op: nm, rd, rn: rn === 15 ? 15 : rn, rm, rot, len: 4 };
      }
      if ((o1 & 8) !== 0 && (o2 & 8) === 0) { // aritmetica paralela (suma/resta por carriles)
        const pf = ['s', 'q', 'sh', null, 'u', 'uq', 'uh', null][bits(h2, 6, 4)];
        const op = ['add8', 'add16', 'asx', null, 'sub8', 'sub16', 'sax', null][bits(h1, 6, 4)];
        if (pf && op) return { k: 'par', pf, op, rd, rn, rm, len: 4 };
        return UNK(4, w);
      }
      if ((o1 & 8) !== 0 && (o2 & 12) === 8) { // misc: REV REV16 RBIT REVSH CLZ SEL QADD...
        const a = bits(h1, 5, 4), b = bits(h2, 5, 4);
        if (a === 0) return { k: 'qop', op: ['qadd', 'qdadd', 'qsub', 'qdsub'][b], rd, rn, rm, len: 4 };
        if (a === 2 && b === 0) return { k: 'sel', rd, rn, rm, len: 4 };
        if (a === 1 && b === 0) return { k: 'bits', op: 'rev', rd, rm, len: 4 };
        if (a === 1 && b === 1) return { k: 'bits', op: 'rev16', rd, rm, len: 4 };
        if (a === 1 && b === 2) return { k: 'bits', op: 'rbit', rd, rm, len: 4 };
        if (a === 1 && b === 3) return { k: 'bits', op: 'revsh', rd, rm, len: 4 };
        if (a === 3 && b === 0) return { k: 'bits', op: 'clz', rd, rm, len: 4 };
        return UNK(4, w);
      }
      return UNK(4, w);
    }
    if ((op2 & 0x78) === 0x30) { // multiplicaciones (0110xxx)
      const o1 = bits(h1, 6, 4), o2 = bits(h2, 5, 4), ra = bits(h2, 15, 12), rd = bits(h2, 11, 8), rm = bits(h2, 3, 0);
      if (o1 === 0) {
        if (o2 === 0) return ra === 15 ? { k: 'mul', op: 'mul', s: false, rd, rn, rm, ra: -1, len: 4 } : { k: 'mul', op: 'mla', s: false, rd, rn, rm, ra, len: 4 };
        if (o2 === 1) return { k: 'mul', op: 'mls', s: false, rd, rn, rm, ra, len: 4 };
      }
      if (o1 === 1) return { k: 'mul', op: 'smla' + (bits(h2, 5, 5) ? 't' : 'b') + (bits(h2, 4, 4) ? 't' : 'b'), s: false, rd, rn, rm, ra: ra === 15 ? -1 : ra, len: 4 };
      if (o1 === 3 && o2 < 2) return { k: 'mul', op: 'smlaw' + (o2 ? 't' : 'b'), s: false, rd, rn, rm, ra: ra === 15 ? -1 : ra, len: 4 };
      if (o1 === 5 && o2 < 2) return { k: 'mul', op: o2 ? 'smmulr' : 'smmul', s: false, rd, rn, rm, ra: ra === 15 ? -1 : ra, len: 4 };
      return UNK(4, w);
    }
    if ((op2 & 0x78) === 0x38) { // multiplicacion larga y division (0111xxx)
      const o1 = bits(h1, 6, 4), o2 = bits(h2, 7, 4), rl = bits(h2, 15, 12), rh = bits(h2, 11, 8), rm = bits(h2, 3, 0);
      if (o1 === 0 && o2 === 0) return { k: 'mul', op: 'smull', s: false, rd: rl, rd2: rh, rn, rm, ra: -1, len: 4 };
      if (o1 === 1 && o2 === 15) return { k: 'div', uns: false, rd: rh, rn, rm, len: 4 };
      if (o1 === 2 && o2 === 0) return { k: 'mul', op: 'umull', s: false, rd: rl, rd2: rh, rn, rm, ra: -1, len: 4 };
      if (o1 === 3 && o2 === 15) return { k: 'div', uns: true, rd: rh, rn, rm, len: 4 };
      if (o1 === 4 && o2 === 0) return { k: 'mul', op: 'smlal', s: false, rd: rl, rd2: rh, rn, rm, ra: -1, len: 4 };
      if (o1 === 4 && (o2 & 12) === 8) return { k: 'mul', op: 'smlal' + ((o2 & 2) ? 't' : 'b') + ((o2 & 1) ? 't' : 'b'), s: false, rd: rl, rd2: rh, rn, rm, ra: -1, len: 4 };
      if (o1 === 6 && o2 === 0) return { k: 'mul', op: 'umlal', s: false, rd: rl, rd2: rh, rn, rm, ra: -1, len: 4 };
      if (o1 === 6 && o2 === 6) return { k: 'mul', op: 'umaal', s: false, rd: rl, rd2: rh, rn, rm, ra: -1, len: 4 };
      return UNK(4, w);
    }
    return { k: 'cop', w, len: 4 };
  }

  // ======================= ARM =======================
  function arm(w, pc) {
    const cond = w >>> 28;
    const r = (hi, lo) => bits(w, hi, lo);
    if (cond === 15) { // espacio incondicional
      if (r(27, 25) === 5) { // BLX imm
        const imm = (sx(r(23, 0), 24) << 2) + (r(24, 24) << 1);
        return { k: 'blx_i', target: pc + 8 + imm, cond: -1, len: 4 };
      }
      if (((w & 0xfd70f000) >>> 0) === 0xf550f000 || ((w & 0xff70f000) >>> 0) === 0xf450f000) return { k: 'nop', cond: -1, len: 4 }; // PLD PLI
      if (((w & 0xfff0fff0) >>> 0) === 0xf57ff040 || ((w & 0xfffffff0) >>> 0) === 0xf57ff050 || ((w & 0xfffffff0) >>> 0) === 0xf57ff060 || w === 0xf57ff01f) return { k: 'nop', cond: -1, len: 4 }; // DSB DMB ISB CLREX
      return { k: 'cop', w, cond: -1, len: 4 };
    }
    const out = armCond(w, pc);
    out.cond = cond === 14 ? -1 : cond;
    return out;
  }
  const DPN = ['and', 'eor', 'sub', 'rsb', 'add', 'adc', 'sbc', 'rsc', 'tst', 'teq', 'cmp', 'cmn', 'orr', 'mov', 'bic', 'mvn'];
  function armCond(w, pc) {
    const r = (hi, lo) => bits(w, hi, lo);
    switch (r(27, 25)) {
      case 0: case 1: {
        const imm = r(25, 25) === 1;
        const op = r(24, 21), s = r(20, 20) === 1, rn = r(19, 16), rd = r(15, 12);
        const tstlike = r(24, 23) === 2 && !s; // 10xx0: no es procesamiento de datos
        if (!imm && r(7, 7) === 1 && r(4, 4) === 1) { // multiplicaciones / carga-almacenamiento extra / sincronizacion
          if (r(6, 5) === 0) {
            if (r(24, 24) === 0) {
              const o = r(23, 21), rdh = r(19, 16), rdl = r(15, 12), rs = r(11, 8), rm = r(3, 0);
              switch (o) {
                case 0: return { k: 'mul', op: 'mul', s, rd: rdh, rn: rm, rm: rs, ra: -1, len: 4 };
                case 1: return { k: 'mul', op: 'mla', s, rd: rdh, rn: rm, rm: rs, ra: rdl, len: 4 };
                case 2: return { k: 'mul', op: 'umaal', s: false, rd: rdl, rd2: rdh, rn: rm, rm: rs, ra: -1, len: 4 };
                case 3: return { k: 'mul', op: 'mls', s: false, rd: rdh, rn: rm, rm: rs, ra: rdl, len: 4 };
                default: return { k: 'mul', op: ['umull', 'umlal', 'smull', 'smlal'][o - 4], s, rd: rdl, rd2: rdh, rn: rm, rm: rs, ra: -1, len: 4 };
              }
            }
            const o = r(23, 20), rt = r(15, 12), rnn = r(19, 16), rm = r(3, 0);
            if (o === 0 || o === 4) return { k: 'swp', byte: o === 4, rd: rt, rn: rnn, rm, len: 4 };
            const sz = { 8: 4, 9: 4, 12: 1, 13: 1, 14: 2, 15: 2 }[o];
            if (sz) return o & 1 ? { k: 'ldrex', sz, rt, rn: rnn, imm: 0, len: 4 } : { k: 'strex', sz, rd: rt, rt: rm, rn: rnn, imm: 0, len: 4 };
            return UNK(4, w);
          }
          // media palabra / signo / doble
          const p = r(24, 24), u = r(23, 23), i = r(22, 22), wbit = r(21, 21), l = r(20, 20), sh = r(6, 5);
          const rt = r(15, 12), rnn = r(19, 16);
          const off = i ? I((r(11, 8) << 4) | r(3, 0)) : R(r(3, 0), 'lsl', 0);
          const wb = p === 0 || wbit === 1;
          if (l === 0 && sh >= 2) return { k: 'dual', op: sh === 2 ? 'ldrd' : 'strd', rt, rt2: rt + 1, rn: rnn, off, add: u === 1, pre: p === 1, wb, len: 4 };
          return { k: 'mem', op: l ? 'ldr' : 'str', sz: sh === 1 ? 2 : sh === 2 ? 1 : 2, sg: sh >= 2, rt, rn: rnn, off, add: u === 1, pre: p === 1, wb, len: 4 };
        }
        if (tstlike) {
          if (!imm) { // diversos
            const o = r(22, 21), o2 = r(7, 4);
            if (o2 === 0) return (o === 0 || o === 2) ? { k: 'mrs', rd, len: 4 } : { k: 'msr', rn: r(3, 0), mask: r(19, 16), len: 4 };
            if (o2 === 1) return o === 1 ? { k: 'bx', rm: r(3, 0), len: 4 } : o === 3 ? { k: 'bits', op: 'clz', rd, rm: r(3, 0), len: 4 } : UNK(4, w);
            if (o2 === 2 && o === 1) return { k: 'bx', rm: r(3, 0), len: 4 };
            if (o2 === 3 && o === 1) return { k: 'blx', rm: r(3, 0), len: 4 };
            if (o2 === 5) return { k: 'qop', op: ['qadd', 'qsub', 'qdadd', 'qdsub'][o], rd, rn, rm: r(3, 0), len: 4 };
            if (o2 === 7 && o === 1) return { k: 'bkpt', len: 4 };
            if ((o2 & 9) === 8) { // SMLAxy, SMLAWy, SMULWy, SMLALxy, SMULxy
              const y = r(6, 6) ? 't' : 'b', x = r(5, 5) ? 't' : 'b', rm = r(3, 0), rs = r(11, 8);
              if (o === 0) return { k: 'mul', op: 'smla' + x + y, s: false, rd: rn, rn: rm, rm: rs, ra: rd, len: 4 };
              if (o === 1) return r(5, 5) ? { k: 'mul', op: 'smulw' + y, s: false, rd: rn, rn: rm, rm: rs, ra: -1, len: 4 } : { k: 'mul', op: 'smlaw' + y, s: false, rd: rn, rn: rm, rm: rs, ra: rd, len: 4 };
              if (o === 2) return { k: 'mul', op: 'smlal' + x + y, s: false, rd: rd, rd2: rn, rn: rm, rm: rs, ra: -1, len: 4 };
              return { k: 'mul', op: 'smul' + x + y, s: false, rd: rn, rn: rm, rm: rs, ra: -1, len: 4 };
            }
            return UNK(4, w);
          }
          if (r(24, 20) === 0x10 || r(24, 20) === 0x14) return { k: r(22, 22) ? 'movt' : 'movw', rd, imm: (r(19, 16) << 12) | r(11, 0), len: 4 };
          return { k: 'nop', len: 4 }; // MSR inmediato / sugerencias
        }
        let o2;
        if (imm) o2 = armImm(r(11, 0));
        else if (r(4, 4) === 0) { const [st, sn] = immShift(r(6, 5), r(11, 7)); o2 = R(r(3, 0), st, sn); }
        else o2 = RS(r(3, 0), SHT[r(6, 5)], r(11, 8));
        const nm = DPN[op];
        if (op >= 8 && op <= 11) return DP(nm, true, 0, rn, o2, 4);
        return DP(nm, s, rd, rn, o2, 4);
      }
      case 2: case 3: {
        if (r(25, 25) === 1 && r(4, 4) === 1) return armMedia(w);
        const p = r(24, 24), u = r(23, 23), b = r(22, 22), wbit = r(21, 21), l = r(20, 20), rn = r(19, 16), rt = r(15, 12);
        let off;
        if (r(25, 25) === 0) off = I(r(11, 0));
        else { const [st, sn] = immShift(r(6, 5), r(11, 7)); off = R(r(3, 0), st, sn); }
        return { k: 'mem', op: l ? 'ldr' : 'str', sz: b ? 1 : 4, sg: false, rt, rn, off, add: u === 1, pre: p === 1, wb: p === 0 || wbit === 1, len: 4 };
      }
      case 4: {
        const p = r(24, 24), u = r(23, 23), wbit = r(21, 21), l = r(20, 20), rn = r(19, 16);
        const mode = u ? (p ? 'ib' : 'ia') : (p ? 'db' : 'da');
        return { k: l ? 'ldm' : 'stm', rn, mode, wb: wbit === 1, list: r(15, 0), len: 4 };
      }
      case 5: {
        const imm = sx(r(23, 0), 24) << 2;
        return r(24, 24) ? { k: 'bl', target: pc + 8 + imm, len: 4 } : { k: 'b', target: pc + 8 + imm, len: 4 };
      }
      case 6: return { k: 'cop', w, len: 4 };
      default:
        if (r(24, 24) === 1) return { k: 'svc', imm: r(23, 0), len: 4 };
        return { k: 'cop', w, len: 4 };
    }
  }
  function armMedia(w) {
    const r = (hi, lo) => bits(w, hi, lo);
    const o = r(27, 20), o4 = r(7, 4), rd = r(15, 12), rn = r(19, 16), rm = r(3, 0);
    if (o >= 0x7a) { // campos de bits
      const lsb = r(11, 7);
      if ((o4 & 7) === 5 && (o === 0x7a || o === 0x7b || o === 0x7e || o === 0x7f)) return { k: 'bfx', uns: o >= 0x7e, rd, rn: rm, lsb, w: r(20, 16) + 1, len: 4 };
      if ((o4 & 7) === 1 && (o === 0x7c || o === 0x7d)) return { k: 'bfi', rd, rn: rm, lsb, w: r(20, 16) - lsb + 1, len: 4 };
      return { k: 'par', w, len: 4 };
    }
    if (o >= 0x61 && o <= 0x67 && o !== 0x64) { // aritmetica paralela
      const pf = { 0x61: 's', 0x62: 'q', 0x63: 'sh', 0x65: 'u', 0x66: 'uq', 0x67: 'uh' }[o];
      const op = { 0: 'add16', 1: 'asx', 2: 'sax', 3: 'sub16', 4: 'add8', 7: 'sub8' }[o4 >> 1];
      if (pf && op && (o4 & 1) === 1) return { k: 'par', pf, op, rd, rn, rm, len: 4 };
    }
    if (o === 0x68 && o4 === 0xb) return { k: 'sel', rd, rn, rm, len: 4 };
    if (o === 0x75 && (o4 & 0xd) === 1) return { k: 'mul', op: o4 & 2 ? 'smmulr' : 'smmul', s: false, rd: rn, rn: rm, rm: r(11, 8), ra: rd === 15 ? -1 : rd, len: 4 };
    if (o >= 0x68 && o <= 0x6f) {
      if (o4 === 7) {
        const nm = { 0x68: 'sxtb16', 0x6a: 'sxtb', 0x6b: 'sxth', 0x6c: 'uxtb16', 0x6e: 'uxtb', 0x6f: 'uxth' }[o];
        if (nm) return { k: 'ext', op: nm, rd, rn, rm, rot: r(11, 10) * 8, len: 4 };
      }
      if (o === 0x6b && o4 === 3) return { k: 'bits', op: 'rev', rd, rm, len: 4 };
      if (o === 0x6b && o4 === 0xb) return { k: 'bits', op: 'rev16', rd, rm, len: 4 };
      if (o === 0x6f && o4 === 3) return { k: 'bits', op: 'rbit', rd, rm, len: 4 };
      if (o === 0x6f && o4 === 0xb) return { k: 'bits', op: 'revsh', rd, rm, len: 4 };
      if ((o4 & 3) === 1) {
        if (o === 0x68) return { k: 'pkh', tb: (o4 & 4) !== 0, rd, rn, rm, sh: r(11, 7), len: 4 };
        if ((o >> 1) === 0x35 || (o >> 1) === 0x37) return { k: 'sat', uns: (o >> 1) === 0x37, rd, rn: rm, sat: r(20, 16) + ((o >> 1) === 0x35 ? 1 : 0), st: r(6, 6) ? 'asr' : 'lsl', sh: r(11, 7), len: 4 };
      }
    }
    return { k: 'par', w, len: 4 };
  }

  // lee y decodifica en 'a'. mem: Uint8Array. Devuelve instruccion con len
  D.decode = (u8, a, thumb, inIT) => {
    if (thumb) {
      const h1 = u8[a] | (u8[a + 1] << 8);
      if ((h1 >> 11) >= 0x1d) { // 11101, 11110, 11111
        const h2 = u8[a + 2] | (u8[a + 3] << 8);
        return thumb32(h1, h2, a);
      }
      return thumb16(h1, a, inIT);
    }
    const w = (u8[a] | (u8[a + 1] << 8) | (u8[a + 2] << 16) | (u8[a + 3] << 24)) >>> 0;
    return arm(w, a);
  };
  D.bits = bits; D.sx = sx;
  return D;
})();
if (typeof module !== 'undefined') module.exports = Dec;
