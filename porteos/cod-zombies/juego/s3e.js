// "Sistema operativo" de Marmalade (s3e) para el emulador: cada import del juego es una funcion de este objeto.
// La memoria, los archivos, los graficos y el sonido se conectan desde afuera (opt.fs, opt.gl, opt.audio, opt.entrada).
'use strict';
const S3e = (() => {
  const OK = 0, ERR = 1;

  // ---- reserva de memoria del guest: primer hueco libre, con union de vecinos ----
  class Monton {
    constructor(lo, hi) { this.lo = lo; this.hi = hi; this.tope = lo; this.libres = []; this.tam = new Map(); this.usado = 0; this.pico = 0; }
    reservar(n) {
      n = n < 16 ? 16 : (n + 15) & ~15;
      const L = this.libres;
      let mejor = -1;
      for (let i = 0; i < L.length; i++) { if (L[i][1] >= n && (mejor < 0 || L[i][1] < L[mejor][1])) { mejor = i; if (L[i][1] === n) break; } }
      let p;
      if (mejor >= 0) {
        p = L[mejor][0];
        if (L[mejor][1] === n) L.splice(mejor, 1); else { L[mejor][0] += n; L[mejor][1] -= n; }
      } else {
        if (this.tope + n > this.hi) return 0;
        p = this.tope; this.tope += n;
      }
      this.tam.set(p, n); this.usado += n; if (this.usado > this.pico) this.pico = this.usado;
      return p;
    }
    liberar(p) {
      const n = this.tam.get(p); if (n === undefined) return;
      this.tam.delete(p); this.usado -= n;
      if (p + n === this.tope) { this.tope = p; // junta con huecos al final
        const L = this.libres; while (L.length && L[L.length - 1][0] + L[L.length - 1][1] === this.tope) { this.tope = L[L.length - 1][0]; L.pop(); }
        return; }
      const L = this.libres;
      let lo = 0, hi = L.length; // posicion ordenada por direccion
      while (lo < hi) { const m = (lo + hi) >> 1; if (L[m][0] < p) lo = m + 1; else hi = m; }
      L.splice(lo, 0, [p, n]);
      if (lo + 1 < L.length && L[lo][0] + L[lo][1] === L[lo + 1][0]) { L[lo][1] += L[lo + 1][1]; L.splice(lo + 1, 1); }
      if (lo > 0 && L[lo - 1][0] + L[lo - 1][1] === L[lo][0]) { L[lo - 1][1] += L[lo][1]; L.splice(lo, 1); }
    }
    tamano(p) { return this.tam.get(p) || 0; }
  }

  class S3e {
    constructor(cpu, nombres, opt) {
      this.cpu = cpu; this.dv = cpu.dv; this.u8 = cpu.u8; this.R = cpu.R;
      this.opt = opt || {};
      this.log = this.opt.log || (() => {});
      this.nombres = nombres;
      this.mont = new Monton(this.opt.heapLo || 0x01000000, this.opt.heapHi || 0x0A000000);
      this.heapActual = 0;
      this.cfg = this.opt.cfg;            // instancia de Icf
      this.t0 = Date.now();
      this.llamadas = {};                 // contador por funcion
      this.cb = {};                       // callbacks registrados: clave -> [{fn, user}]
      this.yieldPedido = false;
      this.quit = false;
      this.fs = this.opt.fs;
      this.errorArchivo = 0;
      this.trazar = this.opt.trazar || {};
      this.noImpl = new Set();
      this.build();
    }

    // ---- ayudas ----
    arg(i) { return i < 4 ? this.R[i] : this.dv.getInt32(this.R[13] + (i - 4) * 4, true); }
    cstr(p, max) { if (!p) return ''; const u8 = this.u8; let e = p; const lim = max ? p + max : u8.length; while (e < lim && u8[e]) e++; return Buffer_latin1(u8, p, e); }
    escribirCadena(p, s, max) { const u8 = this.u8; let n = Math.min(s.length, max - 1); for (let i = 0; i < n; i++) u8[p + i] = s.charCodeAt(i) & 255; u8[p + n] = 0; return n; }
    ret(v) { this.R[0] = v | 0; }
    ret64(lo, hi) { this.R[0] = lo | 0; this.R[1] = hi | 0; }
    ms() { return Date.now() - this.t0; }

    // ---- registros de callbacks ----
    registrar(tipoApi, tipo, fn, user) { const k = tipoApi + ':' + tipo; (this.cb[k] = this.cb[k] || []).push({ fn, user }); }
    quitar(tipoApi, tipo, fn) { const k = tipoApi + ':' + tipo; if (this.cb[k]) this.cb[k] = this.cb[k].filter((c) => c.fn !== fn); }
    disparar(tipoApi, tipo, datos) { const l = this.cb[tipoApi + ':' + tipo]; if (!l) return; for (const c of l.slice()) this.cpu.call(c.fn, [datos, c.user]); }

    build() {
      const self = this, cpu = this.cpu, R = this.R, dv = this.dv, u8 = this.u8;
      const A = (i) => self.arg(i);
      const F = {};
      this.F = F;
      const def = (n, f) => { F[n] = f; };

      // ===== memoria =====
      def('s3eMallocBase', () => { const p = self.mont.reservar(A(0) >>> 0); if (!p) self.log('SIN MEMORIA pidiendo ' + (A(0) >>> 0)); self.ret(p); });
      def('s3eReallocBase', () => {
        const p = A(0), n = A(1) >>> 0;
        if (!p) { self.ret(self.mont.reservar(n)); return; }
        const viejo = self.mont.tamano(p);
        if (n <= viejo) { self.ret(p); return; }
        const q = self.mont.reservar(n);
        if (!q) { self.ret(0); return; }
        u8.copyWithin(q, p, p + viejo);
        self.mont.liberar(p); self.ret(q);
      });
      def('s3eFreeBase', () => { self.mont.liberar(A(0)); });
      def('s3eMemoryGetInt', () => {
        const p = A(0);
        switch (p) {
          case 0: self.ret(self.heapActual); break;
          case 1: self.ret(self.mont.hi - self.mont.lo); break;
          case 2: self.ret(self.mont.usado); break;
          case 3: self.ret(self.mont.hi - self.mont.lo - self.mont.usado); break;
          case 4: self.ret(self.mont.hi - self.mont.tope); break;
          default: self.ret(0);
        }
      });
      def('s3eMemorySetInt', () => { if (A(0) === 0) self.heapActual = A(1); self.ret(OK); });
      def('s3eMemorySetUserMemMgr', () => { self.ret(OK); });
      def('s3eMemoryHeapCreate', () => { self.ret(0); });

      // ===== depuracion =====
      const trace = (s) => { self.log('[JUEGO] ' + s); };
      def('s3eDebugTraceLine', () => { trace(self.cstr(A(0))); self.ret(0); });
      def('s3eDebugOutputString', () => { trace(self.cstr(A(0))); self.ret(0); });
      def('s3eDebugPrint', () => { trace('print ' + self.cstr(A(2))); self.ret(0); });
      def('s3eDebugErrorShow', () => { trace('ERROR ' + A(0) + ' ' + self.cstr(A(1))); self.ret(0); });
      def('s3eDebugAssertShow', () => { trace('ASSERT ' + self.cstr(A(1)) + ' ' + self.cstr(A(2))); self.ret(0); });
      def('s3eDebugIsDebuggerPresent', () => self.ret(0));
      def('s3eDebugGetInt', () => self.ret(0));
      def('s3eExtGetHash', () => self.ret(1));
      def('s3eEdkRegister', () => self.ret(0));

      // ===== configuracion =====
      def('s3eConfigGetString', () => {
        const g = self.cstr(A(0)), n = self.cstr(A(1)), out = A(2);
        const v = self.cfg.get(g, n);
        if (v === null) { if (self.trazar.config) self.log('config ' + g + '.' + n + ' -> (no hay)'); self.ret(ERR); return; }
        if (self.trazar.config) self.log('config ' + g + '.' + n + ' -> ' + v);
        self.escribirCadena(out, v, 1024); self.ret(OK);
      });
      def('s3eConfigGetInt', () => {
        const g = self.cstr(A(0)), n = self.cstr(A(1)), out = A(2);
        const v = self.cfg.getInt(g, n);
        if (v === null) { if (self.trazar.config) self.log('config ' + g + '.' + n + ' -> (no hay)'); self.ret(ERR); return; }
        if (self.trazar.config) self.log('config ' + g + '.' + n + ' -> ' + v);
        dv.setInt32(out, v, true); self.ret(OK);
      });

      // ===== dispositivo =====
      const prop = this.opt.propiedades || {};
      def('s3eDeviceGetInt', () => {
        const p = A(0);
        if (prop.int && prop.int[p] !== undefined) { self.ret(prop.int[p]); return; }
        switch (p) {
          case 0: self.ret(0x1b); break;                 // S3E_OS_ID_ANDROID
          case 8: self.ret(0xc); break;                  // ARMv7-A
          case 9: self.ret(0x42800); break;
          case 0x13: self.ret(0x80001); break;
          case 6: self.ret(128 << 20); break;            // RAM libre
          case 7: self.ret(512 << 20); break;            // RAM total
          default: self.log('DeviceGetInt ' + p + ' -> 0'); self.ret(0);
        }
      });
      def('s3eDeviceGetString', () => {
        const p = A(0);
        let s = prop.str && prop.str[p];
        if (s === undefined) {
          switch (p) {
            case 0: s = 'ANDROID'; break;
            case 8: s = 'ARMv7-A'; break;
            case 9: s = '4.40.0'; break;
            case 0x13: s = '8.0.1 [459423q]'; break;
            default: self.log('DeviceGetString ' + p + ' -> ""'); s = '';
          }
        }
        self.ret(self.cadenaPersistente(s));
      });
      def('s3eDeviceSetInt', () => self.ret(OK));
      def('s3eDeviceRegister', () => { self.registrar('dev', A(0), A(1), A(2)); self.ret(OK); });
      def('s3eDeviceUnRegister', () => { self.quitar('dev', A(0), A(1)); self.ret(OK); });
      def('s3eDeviceYield', () => { self.ret(OK); self.pedirYield(A(0)); });
      def('s3eDeviceYieldUntilEvent', () => { self.ret(OK); self.pedirYield(10); });
      def('s3eDeviceCheckQuitRequest', () => self.ret(self.quit ? 1 : 0));
      def('s3eDeviceRequestQuit', () => { self.quit = true; self.ret(OK); });
      def('s3eDeviceExit', () => { self.log('s3eDeviceExit ' + A(0)); self.quit = true; self.salida = A(0); cpu.stop = true; });
      def('s3eDeviceAbort', () => { self.log('s3eDeviceAbort'); self.quit = true; self.salida = -1; cpu.stop = true; });
      def('s3eDeviceBacklightOn', () => self.ret(OK));

      // ===== temporizadores =====
      def('s3eTimerGetMs', () => self.ret(self.ms()));
      def('s3eTimerGetUST', () => { const us = self.ms() * 1000; self.ret64(us % 4294967296, Math.floor(us / 4294967296)); });
      def('s3eTimerGetUTC', () => { const t = Date.now(); self.ret64(t % 4294967296, Math.floor(t / 4294967296)); });
      def('s3eTimerGetLocaltimeOffset', () => self.ret(0));
      def('s3eTimerGetInt', () => self.ret(0));
      def('s3eTimerSetTimer', () => { (self.timers = self.timers || []).push({ cuando: self.ms() + A(0), fn: A(1), user: A(2) }); self.ret(OK); });
      def('s3eTimerCancelTimer', () => { if (self.timers) self.timers = self.timers.filter((t) => !(t.fn === A(0) && t.user === A(1))); self.ret(OK); });

      // ===== archivos =====
      // El juego registra su propio sistema (derbh, para los .dz) con s3eFileAddUserFileSys: 9 callbacks que se llaman con cpu.call.
      //   open(nombre, modo) -> manejador | read(buf, 1, n, m) -> bytes | eof(m) | seek(m, off, origen) -> 0 | tell(m) | close(m) | listOpen(dir) | listNext(l, buf, n) | listClose(l)
      this.userFs = [];
      this.archivos = new Map(); let sigArchivo = 0x7000;
      const envolver = (u, hd) => ({
        pos: 0, tam: -1,
        leer(u8_, dst, n) { const got = cpu.call(u.read, [dst, 1, n, hd]) >>> 0; this.pos += got; return got; },
        seek(off, origen) { const r = cpu.call(u.seek, [hd, off, origen]); this.pos = cpu.call(u.tell, [hd]); return r ? 1 : 0; },
        tell() { return cpu.call(u.tell, [hd]); },
        get tamano() { const p = cpu.call(u.tell, [hd]); cpu.call(u.seek, [hd, 0, 2]); const t = cpu.call(u.tell, [hd]); cpu.call(u.seek, [hd, p, 0]); return t; },
        cerrar() { cpu.call(u.close, [hd]); },
      });
      def('s3eFileAddUserFileSys', () => {
        const p = A(0), g = (i) => dv.getUint32(p + 4 * i, true);
        self.userFs.push({ open: g(0), read: g(1), eof: g(2), seek: g(3), tell: g(4), close: g(5), listOpen: g(6), listNext: g(7), listClose: g(8), write: g(9) });
        if (self.trazar.archivos) self.log('s3eFileAddUserFileSys #' + self.userFs.length);
        self.ret(OK);
      });
      // el cargador normaliza la ruta antes de dar el archivo a los sistemas del usuario: "a//b" -> "a/b"
      const normalizar = (np) => { const n = self.cstr(np); const m = n.replace(/\/{2,}/g, '/').replace(/^\.\//, ''); return m === n ? np : self.cadenaPersistente(m); };
      const abrirUsuario = (np, mp) => { np = normalizar(np); for (const u of self.userFs) { const hd = cpu.call(u.open, [np, mp]); if (hd) return envolver(u, hd); } return null; };
      def('s3eFileOpen', () => {
        const nombre = self.cstr(A(0)), modo = self.cstr(A(1));
        let h = self.fs.abrir(nombre, modo);
        if (!h) h = abrirUsuario(A(0), A(1));
        if (self.trazar.archivos) self.log('FileOpen ' + nombre + ' ' + modo + ' -> ' + (h ? 'ok' : 'NO') + ' lr=' + (R[14] >>> 0).toString(16) + self.pila(8));
        if (!h) { self.errorArchivo = 1; self.ret(0); return; }
        h.nombre = nombre;
        const id = sigArchivo += 16; self.archivos.set(id, h); self.ret(id);
      });
      def('s3eFileOpenFromMemory', () => { self.ret(0); });
      def('s3eFileClose', () => { const h = self.archivos.get(A(0)); if (h) { h.cerrar && h.cerrar(); self.archivos.delete(A(0)); } self.ret(OK); });
      def('s3eFileRead', () => {
        const h = self.archivos.get(A(3)); if (!h) { self.ret(0); return; }
        const buf = A(0), tam = A(1) >>> 0, n = A(2) >>> 0;
        const quiero = tam * n; if (!quiero) { self.ret(0); return; }
        const pos0 = h.pos, got = h.leer(u8, buf, quiero);
        if (self.trazar.lecturas) self.log('FileRead ' + (h.nombre || '?') + ' pos=' + pos0 + ' quiero=' + quiero + ' got=' + got + (quiero <= 16 ? ' datos=' + Array.from(u8.subarray(buf, buf + got)).map((x) => x.toString(16)).join(' ') : ''));
        self.ret(tam ? Math.floor(got / tam) : 0);
      });
      def('s3eFileWrite', () => {
        const h = self.archivos.get(A(3)); if (!h || !h.escribir) { self.ret(0); return; }
        const tam = A(1) >>> 0, n = A(2) >>> 0; h.escribir(u8, A(0), tam * n); self.ret(n);
      });
      def('s3eFileSeek', () => { const h = self.archivos.get(A(0)); if (!h) { self.ret(ERR); return; } self.ret(h.seek(A(1), A(2)) ? ERR : OK); });
      def('s3eFileTell', () => { const h = self.archivos.get(A(0)); self.ret(h ? (h.tell ? h.tell() : h.pos) : -1); });
      def('s3eFileGetSize', () => { const h = self.archivos.get(A(0)); self.ret(h ? (h.tamano !== undefined ? h.tamano : h.tam) : -1); });
      def('s3eFileFlush', () => self.ret(OK));
      def('s3eFileGetChar', () => { const h = self.archivos.get(A(0)); if (!h) { self.ret(-1); return; } const b = self.u8; const tmp = 0x00001000; self.ret(h.leer(b, tmp, 1) ? b[tmp] : -1); });
      def('s3eFilePutChar', () => self.ret(OK));
      def('s3eFileGetFileInt', () => { const h = self.archivos.get(A(0)); self.ret(0); });
      def('s3eFileCheckExists', () => {
        const n = self.cstr(A(0));
        let e = self.fs.existe(n);
        if (!e && self.userFs.length) { const h = abrirUsuario(A(0), self.cadenaPersistente('rb')); if (h) { h.cerrar(); e = true; } }
        if (n === 'blackops_dxt.dz' && self.disparo) self.disparo();
        if (self.alConsultar) self.alConsultar(n);
        if (self.trazar.archivos) self.log('FileCheckExists ' + JSON.stringify(n) + ' -> ' + e + ' lr=' + (R[14] >>> 0).toString(16) + self.pila(6));
        self.ret(e ? 1 : 0);
      });
      def('s3eFileGetError', () => self.ret(self.errorArchivo));
      def('s3eFileGetErrorString', () => self.ret(self.cadenaPersistente('file error')));
      def('s3eFileDelete', () => { const n = self.cstr(A(0)); if (self.trazar.archivos) self.log('FileDelete ' + n); self.ret(self.fs.borrar ? self.fs.borrar(n) : ERR); });
      def('s3eFileRename', () => self.ret(ERR));
      def('s3eFileMakeDirectory', () => self.ret(OK));
      def('s3eFileListDirectory', () => { self.ret(0); });
      def('s3eFileListClose', () => self.ret(OK));

      // ===== superficie y GL =====
      def('s3eSurfaceRegister', () => { self.registrar('surf', A(0), A(1), A(2)); self.ret(OK); });
      def('s3eSurfaceUnRegister', () => { self.quitar('surf', A(0), A(1)); self.ret(OK); });
      def('s3eSurfaceGetInt', () => {
        const p = A(0), w = self.opt.ancho || 800, h = self.opt.alto || 480;
        switch (p) {
          case 0: case 4: case 0x10: self.ret(w); break;
          case 1: case 5: case 0x11: self.ret(h); break;
          case 2: self.ret(w * 2); break;
          case 3: self.ret(0x4000); break;                // S3E_SURFACE_PIXEL_TYPE_RGB565 / A. Se afinara
          case 8: self.ret(0); break;
          case 0xb: self.ret(0); break;
          case 0xe: self.ret(0); break;
          case 0xf: self.ret(1); break;
          default: self.ret(0);
        }
      });
      def('s3eSurfacePtr', () => self.ret(0));
      def('s3eSurfaceSetup', () => self.ret(OK));
      def('s3eSurfaceShow', () => { self.ret(OK); if (self.opt.alMostrar) self.opt.alMostrar(); self.pedirYield(0); });
      def('s3eGLRegister', () => { self.registrar('gl', A(0), A(1), A(2)); self.ret(OK); });
      def('s3eGLUnRegister', () => { self.quitar('gl', A(0), A(1)); self.ret(OK); });
      def('s3eGLGetInt', () => { const p = A(0); self.ret(p === 0 ? 0x200 : 0); }); // 0 = version de GLES: (mayor << 8) | menor
      def('s3eGLGetNativeWindow', () => self.ret(0));

      // ===== punteros, teclado, acelerometro =====
      def('s3ePointerRegister', () => { self.registrar('ptr', A(0), A(1), A(2)); self.ret(OK); });
      def('s3ePointerUnRegister', () => { self.quitar('ptr', A(0), A(1)); self.ret(OK); });
      def('s3ePointerUpdate', () => self.ret(OK));
      def('s3ePointerGetInt', () => { const p = A(0); self.ret(p === 0 ? 1 : p === 1 ? 1 : p === 2 ? 1 : p === 3 ? 1 : 0); });
      def('s3ePointerSetInt', () => self.ret(OK));
      def('s3ePointerGetX', () => self.ret(self.puntero ? self.puntero.x : 0));
      def('s3ePointerGetY', () => self.ret(self.puntero ? self.puntero.y : 0));
      def('s3ePointerGetState', () => self.ret(0));
      def('s3eKeyboardRegister', () => { self.registrar('kbd', A(0), A(1), A(2)); self.ret(OK); });
      def('s3eKeyboardUnRegister', () => { self.quitar('kbd', A(0), A(1)); self.ret(OK); });
      def('s3eKeyboardUpdate', () => self.ret(OK));
      def('s3eKeyboardGetState', () => self.ret(0));
      def('s3eKeyboardAnyKey', () => self.ret(0));
      def('s3eKeyboardClearState', () => self.ret(OK));
      def('s3eKeyboardGetInt', () => self.ret(0));
      def('s3eKeyboardSetInt', () => self.ret(OK));
      def('s3eKeyboardGetDisplayName', () => self.ret(self.cadenaPersistente('')));
      def('s3eAccelerometerStart', () => self.ret(OK));
      def('s3eAccelerometerStop', () => self.ret(OK));
      def('s3eAccelerometerGetInt', () => self.ret(0));
      def('s3eAccelerometerGetX', () => self.ret(0));
      def('s3eAccelerometerGetY', () => self.ret(0));
      def('s3eAccelerometerGetZ', () => self.ret(0));

      // ===== compresion (inflate) =====
      // s3eCompressionDecompInit / DecompRead / DecompFinal / Decomp: se completan cuando el juego los use
      for (const n of Object.keys(this.opt.extra || {})) def(n, this.opt.extra[n]);

      // ---- tabla de saltos para el emulador ----
      this.tabla = this.nombres.map((n, i) => {
        const f = F[n];
        const gl = !f && this.opt.gl && this.opt.gl.fn(n);
        const h = f || gl;
        const cont = this.llamadas;
        if (h) return (c) => { cont[n] = (cont[n] || 0) + 1; if (self.trazar.todo) self.log('> ' + n + ' ' + [A(0), A(1), A(2), A(3)].map((x) => (x >>> 0).toString(16)).join(',')); h(c, self); };
        return (c) => { cont[n] = (cont[n] || 0) + 1; if (!self.noImpl.has(n)) { self.noImpl.add(n); self.log('SIN IMPLEMENTAR ' + n + ' ' + [A(0), A(1), A(2), A(3)].map((x) => (x >>> 0).toString(16)).join(',') + ' lr=' + (R[14] >>> 0).toString(16)); } R[0] = 0; };
      });
    }

    // cadenas devueltas al guest que deben seguir vivas (no se liberan)
    cadenaPersistente(s) {
      this.cad = this.cad || new Map();
      let p = this.cad.get(s);
      if (!p) { p = this.mont.reservar(s.length + 1); this.escribirCadena(p, s, s.length + 1); this.cad.set(s, p); }
      return p;
    }
    // direcciones de codigo en lo alto de la pila (para ver quien llamo)
    pila(n) {
      if (this.cpu.pilaSombra) return ' pila=' + this.cpu.cs.slice(-(n || 8)).reverse().map((x) => (x >>> 0).toString(16)).join(',');
      const cpu = this.cpu, sp = this.R[13], out = [];
      for (let i = 0; i < 64 && out.length < (n || 8); i++) { const v = this.dv.getUint32(sp + 4 * i, true); if (v >= cpu.codeLo && v < cpu.codeHi && (v & 1)) out.push((v >>> 0).toString(16)); }
      return ' pila=' + out.join(',');
    }
    pedirYield(ms) { this.yieldPedido = true; this.cpu.stop = true; }
  }

  function Buffer_latin1(u8, a, b) { let s = ''; for (let i = a; i < b; i++) s += String.fromCharCode(u8[i]); return s; }
  return S3e;
})();
if (typeof module !== 'undefined') module.exports = S3e;
