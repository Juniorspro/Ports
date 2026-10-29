// Emulador ARMv7 (ARM + Thumb-2 + VFP) por traduccion dinamica de bloques a JavaScript.
// - memoria guest = un ArrayBuffer (direccion guest = indice)
// - cada bloque se compila a una funcion: carga los registros en variables locales, los usa y los devuelve a R[]
// - banderas perezosas: F[0]=tipo (0 explicitas, 1 CMP(a,b), 2 CMN(a,b), 3 logica(res,acarreo)); F[4..7]=N,Z,C,V
// - las importaciones de Marmalade son "stubs": una direccion en [stubLo, stubHi) llama a hle[i](cpu)
'use strict';
const Cpu = (() => {
  const MAGIC = -16; // retorno de call(): 0xFFFFFFF0 como entero con signo (con bit0 = Thumb)

  class Cpu {
    constructor(o) {
      this.buf = o.buf;
      this.u8 = new Uint8Array(this.buf);
      this.dv = new DataView(this.buf);
      this.R = new Int32Array(16);
      this.F = new Int32Array(8);
      this.codeLo = o.codeLo; this.codeHi = o.codeHi;
      this.stubLo = o.stubLo; this.stubHi = o.stubHi; this.stubStep = o.stubStep || 8;
      this.hle = o.hle || [];
      this.roLo = o.roLo === undefined ? o.codeLo : o.roLo; this.roHi = o.roHi === undefined ? o.codeHi : o.roHi; // zona de solo lectura: se pliegan literales
      // bloques compilados: tablas de indices (Int32Array) hacia la lista de funciones
      this.idxA = new Int32Array(((this.codeHi - this.codeLo) >>> 2) + 2);
      this.idxT = new Int32Array(((this.codeHi - this.codeLo) >>> 1) + 2);
      this.bloques = [null];
      this.stop = false;
      this.trace = o.trace || null;
      this.pilaSombra = false; this.cs = [];   // depuracion: pila de llamadas (direcciones de retorno)
      this.traza = null;   // depuracion: funcion(pc) llamada en cada bloque ejecutado
      this.pc = 0;
      this.nblocks = 0;
      this.tls = o.tls || 0;
      // VFP: 32 registros de 64 bits; vistas f64 / f32 / u32 / i32 sobre el mismo bufer
      this.vb = new ArrayBuffer(32 * 8);
      this.D = new Float64Array(this.vb); this.S = new Float32Array(this.vb); this.U = new Uint32Array(this.vb); this.SI = new Int32Array(this.vb);
      this.FP = new Int32Array(4); // FP[0] = FPSCR
      this.makeHelpers();
    }

    // ---------- ayudas compartidas por los bloques ----------
    makeHelpers() {
      const F = this.F, self = this;
      const H = {};
      H.fN = () => { switch (F[0]) { case 0: return F[4]; case 1: return ((F[1] - F[2]) | 0) >>> 31; case 2: return ((F[1] + F[2]) | 0) >>> 31; default: return F[1] >>> 31; } };
      H.fZ = () => { switch (F[0]) { case 0: return F[5]; case 1: return F[1] === F[2] ? 1 : 0; case 2: return ((F[1] + F[2]) | 0) === 0 ? 1 : 0; default: return F[1] === 0 ? 1 : 0; } };
      H.fC = () => { switch (F[0]) { case 0: return F[6]; case 1: return (F[1] >>> 0) >= (F[2] >>> 0) ? 1 : 0; case 2: return ((F[1] >>> 0) + (F[2] >>> 0)) > 4294967295 ? 1 : 0; default: return F[2]; } };
      H.fV = () => {
        switch (F[0]) {
          case 1: { const a = F[1], b = F[2], r = (a - b) | 0; return ((a ^ b) & (a ^ r)) >>> 31; }
          case 2: { const a = F[1], b = F[2], r = (a + b) | 0; return ((a ^ r) & (b ^ r)) >>> 31; }
          default: return F[7];
        }
      };
      H.fcond = (c) => {
        const n = H.fN(), z = H.fZ(), cc = H.fC(), v = H.fV();
        switch (c) {
          case 0: return z === 1; case 1: return z === 0; case 2: return cc === 1; case 3: return cc === 0;
          case 4: return n === 1; case 5: return n === 0; case 6: return v === 1; case 7: return v === 0;
          case 8: return cc === 1 && z === 0; case 9: return cc === 0 || z === 1;
          case 10: return n === v; case 11: return n !== v; case 12: return z === 0 && n === v; default: return z === 1 || n !== v;
        }
      };
      // desplazamientos por registro: devuelven resultado; acarreo de salida en H.sc
      H.sc = 0;
      H.lsl = (v, n, cin) => { n &= 255; if (n === 0) { H.sc = cin; return v; } if (n < 32) { H.sc = (v >>> (32 - n)) & 1; return v << n; } H.sc = n === 32 ? v & 1 : 0; return 0; };
      H.lsr = (v, n, cin) => { n &= 255; if (n === 0) { H.sc = cin; return v; } if (n < 32) { H.sc = (v >>> (n - 1)) & 1; return v >>> n; } H.sc = n === 32 ? v >>> 31 : 0; return 0; };
      H.asr = (v, n, cin) => { n &= 255; if (n === 0) { H.sc = cin; return v; } if (n < 32) { H.sc = (v >> (n - 1)) & 1; return v >> n; } H.sc = v >>> 31; return v >> 31; };
      H.ror = (v, n, cin) => { n &= 255; if (n === 0) { H.sc = cin; return v; } n &= 31; if (n === 0) { H.sc = v >>> 31; return v; } H.sc = (v >>> (n - 1)) & 1; return (v >>> n) | (v << (32 - n)); };
      H.rorv = (v, n) => { n &= 31; return n === 0 ? v : (v >>> n) | (v << (32 - n)); };
      H.mlo = 0; H.mhi = 0;
      H.umull = (a, b) => { a >>>= 0; b >>>= 0; const a0 = a & 0xffff, a1 = a >>> 16, b0 = b & 0xffff, b1 = b >>> 16; const p0 = a0 * b0, p1 = a1 * b0, p2 = a0 * b1, p3 = a1 * b1; const mid = p1 + p2 + (p0 >>> 16); H.mlo = ((mid << 16) | (p0 & 0xffff)) | 0; H.mhi = (p3 + Math.floor(mid / 65536)) | 0; };
      H.smull = (a, b) => { H.umull(a, b); let hi = H.mhi; if (a < 0) hi = (hi - b) | 0; if (b < 0) hi = (hi - a) | 0; H.mhi = hi; };
      H.addlong = (lo, hi, alo, ahi) => { const l = (lo >>> 0) + (alo >>> 0); H.mlo = l | 0; H.mhi = (hi + ahi + (l > 4294967295 ? 1 : 0)) | 0; };
      H.sdiv = (a, b) => (b === 0 ? 0 : (a === -2147483648 && b === -1 ? a : (a / b) | 0));
      H.udiv = (a, b) => (b === 0 ? 0 : ((a >>> 0) / (b >>> 0)) | 0);
      H.rbit = (x) => { x = ((x >>> 1) & 0x55555555) | ((x & 0x55555555) << 1); x = ((x >>> 2) & 0x33333333) | ((x & 0x33333333) << 2); x = ((x >>> 4) & 0x0f0f0f0f) | ((x & 0x0f0f0f0f) << 4); x = ((x >>> 8) & 0x00ff00ff) | ((x & 0x00ff00ff) << 8); return ((x >>> 16) | (x << 16)) | 0; };
      H.rev = (x) => (((x & 0xff) << 24) | ((x & 0xff00) << 8) | ((x >>> 8) & 0xff00) | (x >>> 24)) | 0;
      H.rev16 = (x) => (((x & 0x00ff00ff) << 8) | ((x >>> 8) & 0x00ff00ff)) | 0;
      H.revsh = (x) => (((x & 0xff) << 8) | ((x >>> 8) & 0xff)) << 16 >> 16;
      // saturaciones: H.q = 1 si saturo
      H.q = 0;
      H.ssat = (v, n) => { const mx = n >= 32 ? 2147483647 : (1 << (n - 1)) - 1, mn = -mx - 1; return v > mx ? (H.q = 1, mx) : v < mn ? (H.q = 1, mn) : v; };
      H.usat = (v, n) => { const mx = n >= 32 ? 4294967295 : (2 ** n) - 1; return v < 0 ? (H.q = 1, 0) : v > mx ? (H.q = 1, mx | 0) : v | 0; };
      H.qadd = (a, b) => { const s = a + b; return s > 2147483647 ? (H.q = 1, 2147483647) : s < -2147483648 ? (H.q = 1, -2147483648) : s; };
      H.qsub = (a, b) => { const s = a - b; return s > 2147483647 ? (H.q = 1, 2147483647) : s < -2147483648 ? (H.q = 1, -2147483648) : s; };
      // aritmetica paralela: pf s|q|sh|u|uq|uh ; op add8|add16|asx|sub8|sub16|sax ; fija GE en F[3] (solo s y u)
      H.par = (pf, op, a, b) => {
        const uns = pf.charCodeAt(0) === 117, w8 = op.endsWith('8'), wd = w8 ? 8 : 16, n = w8 ? 4 : 2, mask = (1 << wd) - 1;
        const sat = pf === 'q' || pf === 'uq', half = pf === 'sh' || pf === 'uh';
        let res = 0, ge = 0;
        for (let i = 0; i < n; i++) {
          const lane = (v, k) => { const x = (v >>> (k * wd)) & mask; return uns ? x : (x << (32 - wd)) >> (32 - wd); };
          const add = op === 'add8' || op === 'add16' ? true : op === 'sub8' || op === 'sub16' ? false : op === 'asx' ? i === 1 : i === 0;
          const x = lane(a, i), y = (op === 'asx' || op === 'sax') ? lane(b, 1 - i) : lane(b, i);
          let v = add ? x + y : x - y;
          if (!sat && !half) ge |= (uns ? (add ? v > mask : v >= 0) : v >= 0) ? 1 << (wd === 8 ? i : 2 * i) | (wd === 16 ? 1 << (2 * i + 1) : 0) : 0;
          if (sat) { const mx = uns ? mask : (1 << (wd - 1)) - 1, mn = uns ? 0 : -mx - 1; v = v > mx ? mx : v < mn ? mn : v; }
          if (half) v >>= 1;
          res |= (v & mask) << (i * wd);
        }
        if (!sat && !half) F[3] = ge;
        return res | 0;
      };
      H.cpu = self;
      H.svc = (imm) => { throw new Error('svc ' + imm + ' pc=' + self.pc.toString(16)); };
      H.fround = Math.fround;
      // conversiones float -> entero (saturan; NaN -> 0)
      H.f2i = (x) => (x !== x ? 0 : x >= 2147483647 ? 2147483647 : x <= -2147483648 ? -2147483648 : x < 0 ? Math.ceil(x) : Math.floor(x));
      H.f2u = (x) => (x !== x ? 0 : x >= 4294967295 ? -1 : x <= 0 ? 0 : Math.floor(x) | 0);
      H.rte = (x) => { const r = Math.floor(x + 0.5); return (r - x === 0.5 && (r % 2) !== 0) ? r - 1 : r; };
      this.H = H;
    }

    // ---------- ejecucion ----------
    // Corre desde pc (con bit0 = modo Thumb) hasta que termine (stop) o llegue a MAGIC
    run(pc) {
      const R = this.R;
      const lo = this.codeLo, stubLo = this.stubLo, stubHi = this.stubHi, hle = this.hle, step = this.stubStep;
      this.stop = false;
      for (;;) {
        if (this.traza !== null) this.traza(pc);
        if (pc >= stubLo && pc < stubHi) {
          this.pc = pc;
          hle[((pc - stubLo) / step) | 0](this);
          if (this.stop) { this.pc = R[14]; return pc; }
          pc = R[14];
          continue;
        }
        if (pc === MAGIC || pc === MAGIC + 1) { this.pc = pc; return pc; }
        let b;
        if (pc & 1) {
          const ix = (pc - 1 - lo) >>> 1;
          const k = this.idxT[ix];
          if (k !== 0) b = this.bloques[k]; else { b = this.compile(pc - 1, true); this.idxT[ix] = this.bloques.push(b) - 1; }
        } else {
          const ix = (pc - lo) >>> 2;
          const k = this.idxA[ix];
          if (k !== 0) b = this.bloques[k]; else { b = this.compile(pc, false); this.idxA[ix] = this.bloques.push(b) - 1; }
        }
        this.pc = pc;
        pc = b();
      }
    }

    csRet(dest) { const cs = this.cs; for (let i = cs.length - 1; i >= 0 && i >= cs.length - 4; i--) if (cs[i] === dest) { cs.length = i; return; } }
    // llama a una funcion guest y vuelve cuando retorna. args: enteros (r0..r3 y el resto a la pila)
    call(fn, args) {
      const R = this.R, saved = R.slice(), sf = this.F.slice();
      args = args || [];
      const sp = (R[13] - 64) & ~7;
      for (let i = 4; i < args.length; i++) this.dv.setInt32(sp + (i - 4) * 4, args[i], true);
      for (let i = 0; i < Math.min(4, args.length); i++) R[i] = args[i];
      R[13] = sp; R[14] = MAGIC | (fn & 1);
      const fa = this.stop;
      this.run(fn);
      const ret = R[0];
      this.lastR1 = R[1];
      R.set(saved); this.F.set(sf); this.stop = fa;
      return ret;
    }

    // ---------- traduccion ----------
    compile(pc, thumb, limit) {
      this.nblocks++;
      const src = this.translate(pc, thumb, limit);
      if (this.trace) this.trace(pc, thumb, src);
      const H = this.H;
      const f = new Function('R', 'F', 'dv', 'H', 'cpu', 'fN', 'fZ', 'fC', 'fV', 'fcond', 'lsl', 'lsr', 'asr', 'ror', 'rorv', 'umull', 'smull', 'addlong', 'sdiv', 'udiv', 'rbit', 'rev', 'rev16', 'revsh', 'ssat', 'usat', 'qadd', 'qsub', 'D', 'S', 'U', 'SI', 'FP',
        '"use strict";return function(){' + src + '}');
      return f(this.R, this.F, this.dv, H, this, H.fN, H.fZ, H.fC, H.fV, H.fcond, H.lsl, H.lsr, H.asr, H.ror, H.rorv, H.umull, H.smull, H.addlong, H.sdiv, H.udiv, H.rbit, H.rev, H.rev16, H.revsh, H.ssat, H.usat, H.qadd, H.qsub, this.D, this.S, this.U, this.SI, this.FP);
    }

    translate(pc, thumb, limit) {
      const self = this, dv = this.dv;
      const used = new Set(), mod = new Set();
      let tmp = 0;
      const lines = [];
      const E = (s) => lines.push(s);
      const T = () => 't' + (tmp++);
      let fl = null; // estado estatico de banderas dentro del bloque (null: en F[])
      const reg = (n, pcv) => { if (n === 15) return String(pcv | 0); used.add(n); return 'r' + n; };
      const setr = (n, expr) => { used.add(n); mod.add(n); return 'r' + n + '=' + expr + ';'; };

      // expresiones booleanas de banderas
      const fx = (f) => {
        if (!f) return null;
        switch (f.k) {
          case 'sub': return { N: `(((${f.a}-${f.b})|0)<0)`, Z: `(${f.a}===${f.b})`, C: `((${f.a}>>>0)>=(${f.b}>>>0))`, V: `((((${f.a}^${f.b})&(${f.a}^((${f.a}-${f.b})|0)))<0))` };
          case 'add': { const r = `((${f.a}+${f.b})|0)`; return { N: `(${r}<0)`, Z: `(${r}===0)`, C: `(((${f.a}>>>0)+(${f.b}>>>0))>4294967295)`, V: `((((${f.a}^${r})&(${f.b}^${r}))<0))` }; }
          case 'logic': return { N: `(${f.res}<0)`, Z: `(${f.res}===0)`, C: `(${f.c}!==0)`, V: `(F[7]!==0)` };
          default: return { N: `(${f.n}!==0)`, Z: `(${f.z}!==0)`, C: `(${f.c}!==0)`, V: `(${f.v}!==0)` };
        }
      };
      const flag = (nm) => { const x = fx(fl); if (x) return x[nm]; return { N: '(fN()!==0)', Z: '(fZ()!==0)', C: '(fC()!==0)', V: '(fV()!==0)' }[nm]; };
      const cexpr = () => `(${flag('C')}?1:0)`;
      const condExpr = (c) => {
        if (fl && fl.k === 'sub') {
          const a = fl.a, b = fl.b;
          switch (c) {
            case 0: return `(${a}===${b})`; case 1: return `(${a}!==${b})`;
            case 2: return `((${a}>>>0)>=(${b}>>>0))`; case 3: return `((${a}>>>0)<(${b}>>>0))`;
            case 8: return `((${a}>>>0)>(${b}>>>0))`; case 9: return `((${a}>>>0)<=(${b}>>>0))`;
            case 10: return `(${a}>=${b})`; case 11: return `(${a}<${b})`; case 12: return `(${a}>${b})`; case 13: return `(${a}<=${b})`;
          }
        }
        if (!fl) return `fcond(${c})`;
        const N = flag('N'), Z = flag('Z'), C = flag('C'), V = flag('V');
        switch (c) {
          case 0: return Z; case 1: return `!${Z}`; case 2: return C; case 3: return `!${C}`; case 4: return N; case 5: return `!${N}`;
          case 6: return V; case 7: return `!${V}`; case 8: return `(${C}&&!${Z})`; case 9: return `(!${C}||${Z})`;
          case 10: return `(${N}===${V})`; case 11: return `(${N}!==${V})`; case 12: return `(!${Z}&&${N}===${V})`; default: return `(${Z}||${N}!==${V})`;
        }
      };
      const flushOf = (f) => {
        if (!f) return '';
        switch (f.k) {
          case 'sub': return `F[0]=1;F[1]=${f.a};F[2]=${f.b};`;
          case 'add': return `F[0]=2;F[1]=${f.a};F[2]=${f.b};`;
          case 'logic': return `F[0]=3;F[1]=${f.res};F[2]=${f.c};`;
          default: return `F[0]=0;F[4]=${f.n};F[5]=${f.z};F[6]=${f.c};F[7]=${f.v};`;
        }
      };
      // exportar el V actual a F[7] (antes de pasar a tipo logica, que lo conserva)
      const materializeV = () => { const x = fx(fl); return x ? `F[7]=${x.V}?1:0;` : 'F[7]=fV();'; };
      const exitTo = (f, target) => `${flushOf(f)}/*WB*/return ${target};`;

      const LD = (sz, sg, a) => sz === 4 ? `dv.getInt32(${a},true)` : sz === 2 ? (sg ? `dv.getInt16(${a},true)` : `dv.getUint16(${a},true)`) : (sg ? `dv.getInt8(${a})` : `dv.getUint8(${a})`);
      const ST = (sz, a, v) => sz === 4 ? `dv.setInt32(${a},${v},true);` : sz === 2 ? `dv.setInt16(${a},${v},true);` : `dv.setInt8(${a},${v});`;

      let a = pc, itstate = 0, count = 0, ended = false;
      const ip = thumb ? 4 : 8;
      const u8 = this.u8;
      while (!ended && (limit ? count < limit : (count < 120 || itstate !== 0))) {
        const ir = Dec.decode(u8, a, thumb, itstate !== 0);
        count++;
        let cnd = -1;
        if (thumb) {
          if (ir.k === 'b' && ir.cond >= 0) cnd = -1; // el salto condicional trae su propia condicion
          else if (itstate) { cnd = (itstate >> 4) & 15; if (cnd === 14) cnd = -1; }
        } else cnd = ir.cond === undefined ? -1 : ir.cond;
        const next = a + ir.len;
        const pcv = a + ip;
        const body = [];
        const B = (s) => body.push(s);
        let terminator = false;   // la instruccion siempre termina el bloque (si es incondicional)
        const savedFl = fl;
        let flAfter = fl;         // estado de banderas tras la instruccion (si se ejecuta)
        const pc4 = thumb ? (a + 4) & ~3 : a + 8; // Align(PC,4) para literales

        switch (ir.k) {
          case 'nop': case 'bkpt': case 'it': break;
          case 'dp': {
            const { op, s, rd, rn, o2 } = ir;
            let bexp, carry = null; // carry: expresion 0/1 del acarreo del desplazador (null: sin cambio)
            const needCarry = s && (op === 'and' || op === 'eor' || op === 'orr' || op === 'bic' || op === 'orn' || op === 'mov' || op === 'mvn' || op === 'tst' || op === 'teq');
            const ra = (op === 'mov' || op === 'mvn') ? null : reg(rn, pcv);
            const tA = T();
            if (ra !== null) B(`const ${tA}=${ra};`);
            if (o2.t === 'i') { bexp = String(o2.v | 0); if (o2.c >= 0 && needCarry) carry = String(o2.c); }
            else if (o2.t === 'r') {
              const tv = T(); B(`const ${tv}=${reg(o2.rm, pcv)};`);
              const n = o2.sn;
              switch (o2.st) {
                case 'lsl': bexp = n === 0 ? tv : `(${tv}<<${n})`; if (n && needCarry) carry = `((${tv}>>>${32 - n})&1)`; break;
                case 'lsr': bexp = n === 32 ? '0' : `(${tv}>>>${n})`; if (needCarry) carry = n === 32 ? `(${tv}>>>31)` : `((${tv}>>>${n - 1})&1)`; break;
                case 'asr': bexp = n === 32 ? `(${tv}>>31)` : `(${tv}>>${n})`; if (needCarry) carry = n === 32 ? `(${tv}>>>31)` : `((${tv}>>${n - 1})&1)`; break;
                case 'ror': bexp = `((${tv}>>>${n})|(${tv}<<${32 - n}))`; if (needCarry) carry = `((${tv}>>>${n - 1})&1)`; break;
                default: { // rrx
                  const tc0 = T(); B(`const ${tc0}=${cexpr()};`);
                  bexp = `((${tv}>>>1)|(${tc0}<<31))`; if (needCarry) carry = `(${tv}&1)`;
                }
              }
            } else { // desplazado por registro
              const tv = T(), tr = T(), tcin = T();
              B(`const ${tv}=${reg(o2.rm, pcv)},${tr}=${reg(o2.rs, pcv)},${tcin}=${needCarry ? cexpr() : '0'};`);
              const tb = T(); B(`const ${tb}=${o2.st}(${tv},${tr},${tcin});`);
              bexp = tb;
              if (needCarry) { const tcc = T(); B(`const ${tcc}=H.sc;`); carry = tcc; }
            }
            const tB = T(); B(`const ${tB}=${bexp};`);
            const A = ra === null ? null : tA;
            let res, write = true;
            const needCin = (op === 'adc' || op === 'sbc' || op === 'rsc');
            let tc = null; if (needCin) { tc = T(); B(`const ${tc}=${cexpr()};`); }
            switch (op) {
              case 'and': res = `${A}&${tB}`; break; case 'tst': res = `${A}&${tB}`; write = false; break;
              case 'eor': res = `${A}^${tB}`; break; case 'teq': res = `${A}^${tB}`; write = false; break;
              case 'orr': res = `${A}|${tB}`; break; case 'bic': res = `${A}&~${tB}`; break; case 'orn': res = `${A}|~${tB}`; break;
              case 'mov': res = tB; break; case 'mvn': res = `~${tB}`; break;
              case 'add': res = `(${A}+${tB})|0`; break; case 'cmn': res = `(${A}+${tB})|0`; write = false; break;
              case 'sub': res = `(${A}-${tB})|0`; break; case 'cmp': res = `(${A}-${tB})|0`; write = false; break;
              case 'rsb': res = `(${tB}-${A})|0`; break;
              case 'adc': res = `(${A}+${tB}+${tc})|0`; break;
              case 'sbc': res = `(${A}-${tB}-1+${tc})|0`; break;
              case 'rsc': res = `(${tB}-${A}-1+${tc})|0`; break;
              default: throw new Error('dp ' + op);
            }
            const tR = T(); B(`const ${tR}=${res};`);
            if (s) {
              if (needCarry) {
                B(materializeV());
                const tcar = T(); B(`const ${tcar}=${carry === null ? cexpr() : carry};`);
                flAfter = { k: 'logic', res: tR, c: tcar };
              } else if (op === 'add' || op === 'cmn') flAfter = { k: 'add', a: A, b: tB };
              else if (op === 'sub' || op === 'cmp') flAfter = { k: 'sub', a: A, b: tB };
              else if (op === 'rsb') flAfter = { k: 'sub', a: tB, b: A };
              else { // adc sbc rsc: banderas explicitas
                const tn = T(), tz = T(), tcf = T(), tv = T();
                let C, V;
                if (op === 'adc') { C = `(((${A}>>>0)+(${tB}>>>0)+${tc})>4294967295?1:0)`; V = `(((${A}^${tR})&(${tB}^${tR}))>>>31)`; }
                else if (op === 'sbc') { C = `(((${A}>>>0)+((~${tB})>>>0)+${tc})>4294967295?1:0)`; V = `(((${A}^${tB})&(${A}^${tR}))>>>31)`; }
                else { C = `(((${tB}>>>0)+((~${A})>>>0)+${tc})>4294967295?1:0)`; V = `(((${tB}^${A})&(${tB}^${tR}))>>>31)`; }
                B(`const ${tn}=${tR}>>>31,${tz}=${tR}===0?1:0,${tcf}=${C},${tv}=${V};`);
                flAfter = { k: 'expl', n: tn, z: tz, c: tcf, v: tv };
              }
            }
            if (write) {
              if (rd === 15) { // escritura a pc: salto (en ARM con cambio de modo por bit0; en Thumb no)
                B(exitTo(flAfter, thumb ? `${tR}|1` : tR)); terminator = true;
              } else B(setr(rd, tR));
            }
            break;
          }
          case 'movw': B(setr(ir.rd, String(ir.imm))); break;
          case 'movt': { const r = reg(ir.rd, pcv); B(setr(ir.rd, `(${r}&65535)|${(ir.imm << 16) | 0}`)); break; }
          case 'adr': B(setr(ir.rd, String(ir.abs | 0))); break;
          case 'mem': {
            const { op, sz, sg, rt, rn, off, add, pre, wb } = ir;
            const basev = rn === 15 ? (ir.pc4 !== undefined ? ir.pc4 : pc4) : -1;
            const tb = T(); B(`const ${tb}=${rn === 15 ? String(basev | 0) : reg(rn, pcv)};`);
            let o;
            if (off.t === 'i') o = String(off.v | 0);
            else {
              const v = reg(off.rm, pcv);
              if (off.sn === 0) o = v;
              else if (off.st === 'lsl') o = `(${v}<<${off.sn})`;
              else if (off.st === 'lsr') o = off.sn === 32 ? '0' : `(${v}>>>${off.sn})`;
              else if (off.st === 'asr') o = `(${v}>>${off.sn === 32 ? 31 : off.sn})`;
              else if (off.st === 'ror') o = `((${v}>>>${off.sn})|(${v}<<${32 - off.sn}))`;
              else o = `((${v}>>>1)|(${cexpr()}<<31))`;
            }
            const to = T(); B(`const ${to}=${o};`);
            const nb = add ? `(${tb}+${to})|0` : `(${tb}-${to})|0`;
            const ta = T();
            B(`const ${ta}=${pre ? nb : tb};`);
            const tn = T(); // nuevo valor del registro base
            if (pre) B(`const ${tn}=${ta};`); else B(`const ${tn}=${nb};`);
            if (op === 'ldr') {
              let valExp = LD(sz, sg, ta);
              if (rn === 15 && off.t === 'i' && pre) { // literal: se pliega si cae en la zona de solo lectura
                const abs = ((add ? 1 : -1) * off.v + basev) | 0;
                if (abs >= self.roLo && abs + sz <= self.roHi) {
                  const v = sz === 4 ? dv.getInt32(abs, true) : sz === 2 ? (sg ? dv.getInt16(abs, true) : dv.getUint16(abs, true)) : (sg ? dv.getInt8(abs) : dv.getUint8(abs));
                  valExp = String(v | 0);
                }
              }
              const tv = T(); B(`const ${tv}=${valExp};`);
              if ((wb || !pre) && rn !== rt && rn !== 15) B(setr(rn, tn));
              if (rt === 15) { if (self.pilaSombra) B(`cpu.csRet(${tv});`); B(exitTo(flAfter, tv)); terminator = true; } else B(setr(rt, tv));
            } else {
              const v = rt === 15 ? String(pcv | 0) : reg(rt, pcv);
              B(ST(sz, ta, v));
              if ((wb || !pre) && rn !== 15) B(setr(rn, tn));
            }
            break;
          }
          case 'dual': {
            const { op, rt, rt2, rn, add, pre, wb } = ir;
            const tb = T(); B(`const ${tb}=${rn === 15 ? String(pc4 | 0) : reg(rn, pcv)};`);
            let o;
            if (ir.off) o = ir.off.t === 'i' ? String(ir.off.v | 0) : reg(ir.off.rm, pcv); else o = String(ir.imm | 0);
            const to = T(); B(`const ${to}=${o};`);
            const nb = add ? `(${tb}+${to})|0` : `(${tb}-${to})|0`;
            const ta = T(); B(`const ${ta}=${pre ? nb : tb};`);
            const tn = T(); B(`const ${tn}=${pre ? ta : nb};`);
            if (op === 'ldrd') { B(setr(rt, `dv.getInt32(${ta},true)`)); B(setr(rt2, `dv.getInt32(${ta}+4,true)`)); }
            else B(`dv.setInt32(${ta},${reg(rt, pcv)},true);dv.setInt32(${ta}+4,${reg(rt2, pcv)},true);`);
            if ((wb || !pre) && rn !== 15 && !(op === 'ldrd' && (rn === rt || rn === rt2))) B(setr(rn, tn));
            break;
          }
          case 'ldm': case 'stm': {
            const { rn, mode, wb, list } = ir;
            const regs = []; for (let i = 0; i < 16; i++) if (list & (1 << i)) regs.push(i);
            const n = regs.length;
            const tb = T(); B(`const ${tb}=${reg(rn, pcv)};`);
            let start;
            switch (mode) { case 'ia': start = tb; break; case 'ib': start = `(${tb}+4)|0`; break; case 'da': start = `(${tb}-${4 * n - 4})|0`; break; default: start = `(${tb}-${4 * n})|0`; }
            const ts = T(); B(`const ${ts}=${start};`);
            const newb = (mode === 'ia' || mode === 'ib') ? `(${tb}+${4 * n})|0` : `(${tb}-${4 * n})|0`;
            let jump = null;
            regs.forEach((r, i) => {
              if (ir.k === 'ldm') {
                const ex = `dv.getInt32(${ts}+${4 * i},true)`;
                if (r === 15) { const tv = T(); B(`const ${tv}=${ex};`); jump = tv; } else B(setr(r, ex));
              } else B(`dv.setInt32(${ts}+${4 * i},${r === 15 ? String(pcv | 0) : reg(r, pcv)},true);`);
            });
            if (wb && !(ir.k === 'ldm' && ((list >> rn) & 1))) B(setr(rn, newb));
            if (jump) { if (self.pilaSombra) B(`cpu.csRet(${jump});`); B(exitTo(flAfter, jump)); terminator = true; }
            break;
          }
          case 'mul': {
            const { op, s, rd, rn, rm, ra } = ir;
            const tx = T(), ty = T(); B(`const ${tx}=${reg(rn, pcv)},${ty}=${reg(rm, pcv)};`);
            const half = (v, h) => h === 't' ? `(${v}>>16)` : `(${v}<<16>>16)`;
            if (op === 'mul' || op === 'mla' || op === 'mls') {
              let res = `Math.imul(${tx},${ty})`;
              if (op === 'mla') res = `(${res}+${reg(ra, pcv)})|0`;
              if (op === 'mls') res = `(${reg(ra, pcv)}-${res})|0`;
              const tr = T(); B(`const ${tr}=${res};`);
              B(setr(rd, tr));
              if (s) { B(materializeV()); const tcar = T(); B(`const ${tcar}=${cexpr()};`); flAfter = { k: 'logic', res: tr, c: tcar }; }
            } else if (/^smla[bt][bt]$/.test(op) || /^smul[bt][bt]$/.test(op)) {
              B(setr(rd, `(Math.imul(${half(tx, op[4])},${half(ty, op[5])})${ra >= 0 ? '+' + reg(ra, pcv) : ''})|0`));
            } else if (/^smlaw[bt]$/.test(op) || /^smulw[bt]$/.test(op)) {
              B(`H.smull(${tx},${half(ty, op[5])});`);
              const hi = `((H.mhi<<16)|(H.mlo>>>16))`;
              B(setr(rd, `(${hi}${ra >= 0 ? '+' + reg(ra, pcv) : ''})|0`));
            } else if (op === 'smmul' || op === 'smmulr') {
              B(`H.smull(${tx},${ty});`);
              if (ra >= 0) B(`H.addlong(0,${reg(ra, pcv)},H.mlo,H.mhi);`);
              if (op === 'smmulr') B(`H.addlong(H.mlo,H.mhi,-2147483648,0);`);
              B(setr(rd, 'H.mhi'));
            } else { // largos
              const lo = ir.rd, hi = ir.rd2;
              if (op === 'umull') B(`umull(${tx},${ty});`);
              else if (op === 'smull') B(`smull(${tx},${ty});`);
              else if (op === 'umlal') B(`umull(${tx},${ty});addlong(H.mlo,H.mhi,${reg(lo, pcv)},${reg(hi, pcv)});`);
              else if (op === 'smlal') B(`smull(${tx},${ty});addlong(H.mlo,H.mhi,${reg(lo, pcv)},${reg(hi, pcv)});`);
              else if (op === 'umaal') B(`umull(${tx},${ty});addlong(H.mlo,H.mhi,${reg(lo, pcv)},0);addlong(H.mlo,H.mhi,${reg(hi, pcv)},0);`);
              else if (/^smlal[bt][bt]$/.test(op)) { // 16x16 + 64
                B(`H.mlo=Math.imul(${half(tx, op[5])},${half(ty, op[6])});H.mhi=H.mlo>>31;addlong(H.mlo,H.mhi,${reg(lo, pcv)},${reg(hi, pcv)});`);
              } else throw new Error('mul ' + op);
              const tl = T(), th = T(); B(`const ${tl}=H.mlo,${th}=H.mhi;`);
              B(setr(lo, tl)); B(setr(hi, th));
              if (s) { B(materializeV()); const tcar = T(); B(`const ${tcar}=${cexpr()};`); flAfter = { k: 'expl', n: `(${th}>>>31)`, z: `((${tl}|${th})===0?1:0)`, c: tcar, v: 'F[7]' }; }
            }
            break;
          }
          case 'div': B(setr(ir.rd, `${ir.uns ? 'udiv' : 'sdiv'}(${reg(ir.rn, pcv)},${reg(ir.rm, pcv)})`)); break;
          case 'bits': {
            const v = reg(ir.rm, pcv);
            const ex = { clz: `Math.clz32(${v})`, rbit: `rbit(${v})`, rev: `rev(${v})`, rev16: `rev16(${v})`, revsh: `revsh(${v})` }[ir.op];
            B(setr(ir.rd, ex));
            break;
          }
          case 'qop': {
            const x = reg(ir.rm, pcv), y = reg(ir.rn, pcv);
            const ex = { qadd: `qadd(${x},${y})`, qsub: `qsub(${x},${y})`, qdadd: `qadd(${x},qadd(${y},${y}))`, qdsub: `qsub(${x},qadd(${y},${y}))` }[ir.op];
            B(setr(ir.rd, ex));
            break;
          }
          case 'ext': {
            let v = reg(ir.rm, pcv);
            if (ir.rot) v = `rorv(${v},${ir.rot})`;
            const tv = T(); B(`const ${tv}=${v};`);
            if (ir.op === 'sxtb16' || ir.op === 'uxtb16') {
              let ex = ir.op === 'sxtb16' ? `((${tv}<<24>>24)&65535)|((${tv}>>8<<24>>8)&-65536)` : `(${tv}&255)|((${tv}&16711680))`;
              if (ir.rn !== 15) ex = `((((${reg(ir.rn, pcv)}&65535)+(${ex}&65535))&65535)|(((${reg(ir.rn, pcv)}>>>16)+((${ex})>>>16))<<16))`;
              B(setr(ir.rd, ex));
              break;
            }
            let ex = { sxth: `(${tv}<<16>>16)`, sxtb: `(${tv}<<24>>24)`, uxth: `(${tv}&65535)`, uxtb: `(${tv}&255)` }[ir.op];
            if (!ex) throw new Error('ext ' + ir.op);
            if (ir.rn !== 15) ex = `(${reg(ir.rn, pcv)}+${ex})|0`;
            B(setr(ir.rd, ex));
            break;
          }
          case 'bfx': {
            const v = reg(ir.rn, pcv);
            if (ir.uns) B(setr(ir.rd, ir.w === 32 ? v : `((${v}>>>${ir.lsb})&${(1 << ir.w) - 1})`));
            else B(setr(ir.rd, ir.w === 32 ? v : `(${v}<<${32 - ir.lsb - ir.w}>>${32 - ir.w})`));
            break;
          }
          case 'bfi': {
            const mask = ir.w >= 32 ? -1 : (((1 << ir.w) - 1) << ir.lsb) | 0;
            const src = ir.rn === 15 ? '0' : reg(ir.rn, pcv);
            B(setr(ir.rd, `(${reg(ir.rd, pcv)}&${~mask | 0})|((${src}<<${ir.lsb})&${mask | 0})`));
            break;
          }
          case 'sat': {
            let v = reg(ir.rn, pcv);
            if (ir.st === 'asr') v = ir.sh === 0 ? `(${v}>>31)` : `(${v}>>${ir.sh})`; else if (ir.sh) v = `(${v}<<${ir.sh})`;
            B(setr(ir.rd, `${ir.uns ? 'usat' : 'ssat'}(${v},${ir.sat})`));
            break;
          }
          case 'pkh': {
            const n = reg(ir.rn, pcv), m = reg(ir.rm, pcv);
            if (!ir.tb) B(setr(ir.rd, `(${n}&65535)|((${m}<<${ir.sh})&-65536)`));
            else B(setr(ir.rd, `(${n}&-65536)|(((${m}>>${ir.sh === 0 ? 31 : ir.sh}))&65535)`));
            break;
          }
          case 'ldrex': { const tb = T(); B(`const ${tb}=(${reg(ir.rn, pcv)}+${ir.imm})|0;`); B(setr(ir.rt, LD(ir.sz, false, tb))); break; }
          case 'strex': { const tb = T(); B(`const ${tb}=(${reg(ir.rn, pcv)}+${ir.imm})|0;`); B(ST(ir.sz, tb, reg(ir.rt, pcv))); B(setr(ir.rd, '0')); break; }
          case 'swp': { const tb = T(), tv = T(); B(`const ${tb}=${reg(ir.rn, pcv)},${tv}=${LD(ir.byte ? 1 : 4, false, tb)};`); B(ST(ir.byte ? 1 : 4, tb, reg(ir.rm, pcv))); B(setr(ir.rd, tv)); break; }
          case 'mrs': B(setr(ir.rd, `((${flag('N')}?1:0)<<31)|((${flag('Z')}?1:0)<<30)|((${flag('C')}?1:0)<<29)|((${flag('V')}?1:0)<<28)|${thumb ? 32 : 0}`)); break;
          case 'msr': {
            const tv = T(); B(`const ${tv}=${reg(ir.rn, pcv)};`);
            if (ir.mask & 8) flAfter = { k: 'expl', n: `(${tv}>>>31)`, z: `((${tv}>>>30)&1)`, c: `((${tv}>>>29)&1)`, v: `((${tv}>>>28)&1)` };
            break;
          }
          case 'svc': B(`H.svc(${ir.imm});`); break;
          case 'b': {
            const tgt = ir.target | (thumb ? 1 : 0);
            if (thumb && ir.cond >= 0) { // salto condicional de Thumb: sale por un lado o por el otro
              B(`if(${condExpr(ir.cond)}){${exitTo(flAfter, tgt)}}`);
              B(exitTo(flAfter, next | 1));
              terminator = true;
            } else { B(exitTo(flAfter, tgt)); terminator = true; }
            break;
          }
          case 'bl': if (self.pilaSombra) B(`cpu.cs.push(${thumb ? (next | 1) : next});`); B(setr(14, String(thumb ? (next | 1) : next))); B(exitTo(flAfter, ir.target | (thumb ? 1 : 0))); terminator = true; break;
          case 'blx_i': if (self.pilaSombra) B(`cpu.cs.push(${thumb ? (next | 1) : next});`); B(setr(14, String(thumb ? (next | 1) : next))); B(exitTo(flAfter, thumb ? ir.target : (ir.target | 1))); terminator = true; break;
          case 'bx': if (self.pilaSombra && ir.rm === 14) B(`cpu.csRet(r14);`); B(exitTo(flAfter, reg(ir.rm, pcv))); terminator = true; break;
          case 'blx': { const tv = T(); B(`const ${tv}=${reg(ir.rm, pcv)};`); if (self.pilaSombra) B(`cpu.cs.push(${thumb ? (next | 1) : next});`); B(setr(14, String(thumb ? (next | 1) : next))); B(exitTo(flAfter, tv)); terminator = true; break; }
          case 'cbz': B(`if(${reg(ir.rn, pcv)}${ir.nz ? '!==' : '==='}0){${exitTo(flAfter, ir.target | 1)}}`); break;
          case 'tbb': {
            const tb = T(); B(`const ${tb}=(${reg(ir.rn, pcv)}+${ir.h ? `(${reg(ir.rm, pcv)}<<1)` : reg(ir.rm, pcv)})|0;`);
            B(exitTo(flAfter, `((${ir.pc}+2*${ir.h ? `dv.getUint16(${tb},true)` : `dv.getUint8(${tb})`})|1)`));
            terminator = true; break;
          }
          case 'cop': {
            if (!self.genCop) throw new Error('VFP/NEON no implementado: ' + a.toString(16) + ' ' + (ir.w >>> 0).toString(16));
            const r = self.genCop(ir, { B, T, reg, setr, pcv, a, pc4, thumb, cexpr, flag, next });
            if (r && r.flags) flAfter = r.flags;
            break;
          }
          case 'par': B(setr(ir.rd, `H.par('${ir.pf}','${ir.op}',${reg(ir.rn, pcv)},${reg(ir.rm, pcv)})`)); break;
          case 'sel': { const x = reg(ir.rn, pcv), y = reg(ir.rm, pcv); B(setr(ir.rd, `((F[3]&1?${x}:${y})&255)|((F[3]&2?${x}:${y})&65280)|((F[3]&4?${x}:${y})&16711680)|((F[3]&8?${x}:${y})&-16777216)`)); break; }
          case 'unk': throw new Error('instruccion no soportada ' + ir.k + ' en ' + a.toString(16) + ' w=' + (ir.w >>> 0).toString(16));
          default: throw new Error('clase ' + ir.k);
        }

        // ---- ensamblado de la instruccion con su condicion ----
        if (cnd >= 0 && ir.k !== 'it') {
          const changes = flAfter !== savedFl;
          if (changes && savedFl) E(flushOf(savedFl)); // el estado vigente queda en F[] para evaluar y para la rama no ejecutada
          const ce = changes && savedFl ? 'fcond(' + cnd + ')' : condExpr(cnd);
          E(`if(${ce}){`);
          for (const s of body) E(s);
          if (changes) E(flushOf(flAfter));
          E('}');
          fl = changes ? null : savedFl;
          terminator = false; // un terminador condicional no cierra el bloque (la rama no tomada sigue)
        } else {
          for (const s of body) E(s);
          fl = flAfter;
        }
        if (ir.k === 'it') itstate = (ir.fc << 4) | ir.mask;
        else if (thumb && itstate) itstate = (itstate & 7) === 0 ? 0 : ((itstate & 0xe0) | ((itstate << 1) & 0x1f));
        a = next;
        if (terminator) ended = true;
      }
      if (!ended) E(exitTo(fl, thumb ? (a | 1) : a));
      let head = '';
      for (const r of used) head += `let r${r}=R[${r}];`;
      let wbs = '';
      for (const r of mod) wbs += `R[${r}]=r${r};`;
      return (head + lines.join('\n')).split('/*WB*/').join(wbs);
    }
  }
  Cpu.MAGIC = MAGIC;
  return Cpu;
})();
if (typeof module !== 'undefined') module.exports = Cpu;
