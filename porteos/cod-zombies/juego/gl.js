// GLES2 -> WebGL para el emulador, mas un EGL de mentira.
// Sin contexto (Node) las consultas devuelven valores razonables y lo demas se anota; con contexto cada llamada va a WebGL.
// Los objetos GL del guest son enteros propios (ids); aca se guardan los objetos de WebGL.
'use strict';
const GlHle = (() => {
  const f32 = new Float32Array(1), i32 = new Int32Array(f32.buffer);
  const bitsAFloat = (b) => { i32[0] = b; return f32[0]; };

  class GlHle {
    // opt: { gl: WebGLRenderingContext|null, ancho, alto, log, extensiones: [...], alMostrar() }
    constructor(opt) {
      this.o = opt || {};
      this.gl = this.o.gl || null;
      this.log = this.o.log || (() => {});
      this.ancho = this.o.ancho || 800; this.alto = this.o.alto || 480;
      this.ids = { tex: [null], buf: [null], fb: [null], rb: [null], sh: [null], pr: [null] };
      this.locs = [null];                  // ids de ubicaciones de uniformes
      this.locPorProg = new Map();
      this.atr = [];                       // estado de atributos de vertice (punteros del cliente)
      for (let i = 0; i < 16; i++) this.atr.push({ on: false, vbo: 0, tam: 4, tipo: 0x1406, norm: false, paso: 0, ptr: 0 });
      this.vboAct = 0; this.iboAct = 0; this.progAct = 0;
      this.errores = new Set();
      this.noImpl = new Set();
      this.dibujos = 0;
      this.ext = this.o.extensiones || ['GL_OES_depth_texture', 'GL_OES_packed_depth_stencil', 'GL_OES_rgb8_rgba8', 'GL_OES_standard_derivatives', 'GL_EXT_texture_compression_s3tc', 'GL_OES_element_index_uint', 'GL_OES_texture_float'];
    }

    // ---- lectura desde el guest ----
    floats(mem, ptr, n) { // Float32Array con n elementos (copia si el puntero no esta alineado)
      if ((ptr & 3) === 0) return new Float32Array(mem.u8.buffer, ptr, n);
      const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = mem.dv.getFloat32(ptr + 4 * i, true); return a;
    }
    ints(mem, ptr, n) { if ((ptr & 3) === 0) return new Int32Array(mem.u8.buffer, ptr, n); const a = new Int32Array(n); for (let i = 0; i < n; i++) a[i] = mem.dv.getInt32(ptr + 4 * i, true); return a; }

    obj(tipo, id) { return this.ids[tipo][id] || null; }
    nuevo(tipo, objeto) { const L = this.ids[tipo]; L.push(objeto); return L.length - 1; }

    // fn(nombre): devuelve (cpu, s3e) => void, o null si no se implementa
    fn(nombre) {
      const G = this.tabla || (this.tabla = this.crear());
      return G[nombre] || null;
    }

    crear() {
      const self = this, G = {};
      const gl = () => self.gl;
      const def = (n, f) => { G[n] = f; };
      let s3e, A, F, ret;
      // cada funcion recibe (cpu, s3e); estas ayudas se refrescan en cada llamada
      const envolver = (f) => (cpu, s) => { s3e = s; A = (i) => s.arg(i); F = (i) => bitsAFloat(s.arg(i)); ret = (v) => { s.R[0] = v | 0; }; return f(cpu, s); };
      const mem = () => s3e;                                  // s3e tiene u8 y dv
      const d = (n, f) => def(n, envolver(f));
      const C = (nombre, v) => { /* constante */ };

      // ---------- generar / borrar ----------
      const generar = (tipo, crear) => (cpu) => {
        const n = A(0), p = A(1);
        for (let i = 0; i < n; i++) { const id = self.nuevo(tipo, gl() ? crear() : { falso: true }); s3e.dv.setInt32(p + 4 * i, id, true); }
      };
      d('glGenTextures', generar('tex', () => gl().createTexture()));
      d('glGenBuffers', generar('buf', () => gl().createBuffer()));
      d('glGenFramebuffers', generar('fb', () => gl().createFramebuffer()));
      d('glGenRenderbuffers', generar('rb', () => gl().createRenderbuffer()));
      const borrar = (tipo, fnb) => () => { const n = A(0), p = A(1); for (let i = 0; i < n; i++) { const id = s3e.dv.getInt32(p + 4 * i, true); const o = self.ids[tipo][id]; if (o && gl() && !o.falso) fnb(o); self.ids[tipo][id] = null; } };
      d('glDeleteTextures', borrar('tex', (o) => gl().deleteTexture(o)));
      d('glDeleteBuffers', borrar('buf', (o) => gl().deleteBuffer(o)));
      d('glDeleteFramebuffers', borrar('fb', (o) => gl().deleteFramebuffer(o)));
      d('glDeleteRenderbuffers', borrar('rb', (o) => gl().deleteRenderbuffer(o)));

      // ---------- enlaces ----------
      d('glBindTexture', () => { if (gl()) gl().bindTexture(A(0), self.obj('tex', A(1))); });
      d('glActiveTexture', () => { if (gl()) gl().activeTexture(A(0)); });
      d('glBindBuffer', () => { const t = A(0), id = A(1); if (t === 0x8892) self.vboAct = id; else if (t === 0x8893) self.iboAct = id; if (gl()) gl().bindBuffer(t, self.obj('buf', id)); });
      d('glBindFramebuffer', () => { if (gl()) gl().bindFramebuffer(A(0), self.obj('fb', A(1))); });
      d('glBindRenderbuffer', () => { if (gl()) gl().bindRenderbuffer(A(0), self.obj('rb', A(1))); });
      d('glBufferData', () => { const t = A(0), n = A(1) >>> 0, p = A(2); if (gl()) { if (p) gl().bufferData(t, new Uint8Array(s3e.u8.buffer, p, n), A(3)); else gl().bufferData(t, n, A(3)); } });
      d('glFramebufferTexture2D', () => { if (gl()) gl().framebufferTexture2D(A(0), A(1), A(2), self.obj('tex', A(3)), A(4)); });
      d('glFramebufferRenderbuffer', () => { if (gl()) gl().framebufferRenderbuffer(A(0), A(1), A(2), self.obj('rb', A(3))); });
      d('glRenderbufferStorage', () => { if (gl()) gl().renderbufferStorage(A(0), A(1), A(2), A(3)); });
      d('glCheckFramebufferStatus', () => ret(gl() ? gl().checkFramebufferStatus(A(0)) : 0x8cd5));
      d('glIsFramebuffer', () => ret(self.obj('fb', A(0)) ? 1 : 0));
      d('glIsRenderbuffer', () => ret(self.obj('rb', A(0)) ? 1 : 0));
      d('glGenerateMipmap', () => { if (gl()) gl().generateMipmap(A(0)); });

      // ---------- estado ----------
      d('glEnable', () => { if (gl()) gl().enable(A(0)); });
      d('glDisable', () => { if (gl()) gl().disable(A(0)); });
      d('glBlendFunc', () => { if (gl()) gl().blendFunc(A(0), A(1)); });
      d('glBlendFuncSeparate', () => { if (gl()) gl().blendFuncSeparate(A(0), A(1), A(2), A(3)); });
      d('glBlendEquationSeparate', () => { if (gl()) gl().blendEquationSeparate(A(0), A(1)); });
      d('glBlendColor', () => { if (gl()) gl().blendColor(F(0), F(1), F(2), F(3)); });
      d('glDepthFunc', () => { if (gl()) gl().depthFunc(A(0)); });
      d('glDepthMask', () => { if (gl()) gl().depthMask(!!(A(0) & 255)); });
      d('glDepthRangef', () => { if (gl()) gl().depthRange(F(0), F(1)); });
      d('glClearDepthf', () => { if (gl()) gl().clearDepth(F(0)); });
      d('glClearColor', () => { if (gl()) gl().clearColor(F(0), F(1), F(2), F(3)); });
      d('glClearStencil', () => { if (gl()) gl().clearStencil(A(0)); });
      d('glClear', () => { if (gl()) gl().clear(A(0)); });
      d('glColorMask', () => { if (gl()) gl().colorMask(!!(A(0) & 255), !!(A(1) & 255), !!(A(2) & 255), !!(A(3) & 255)); });
      d('glCullFace', () => { if (gl()) gl().cullFace(A(0)); });
      d('glFrontFace', () => { if (gl()) gl().frontFace(A(0)); });
      d('glScissor', () => { if (gl()) gl().scissor(A(0), A(1), A(2), A(3)); });
      d('glViewport', () => { if (gl()) gl().viewport(A(0), A(1), A(2), A(3)); });
      d('glStencilFunc', () => { if (gl()) gl().stencilFunc(A(0), A(1), A(2)); });
      d('glStencilFuncSeparate', () => { if (gl()) gl().stencilFuncSeparate(A(0), A(1), A(2), A(3)); });
      d('glStencilMask', () => { if (gl()) gl().stencilMask(A(0)); });
      d('glStencilMaskSeparate', () => { if (gl()) gl().stencilMaskSeparate(A(0), A(1)); });
      d('glStencilOp', () => { if (gl()) gl().stencilOp(A(0), A(1), A(2)); });
      d('glStencilOpSeparate', () => { if (gl()) gl().stencilOpSeparate(A(0), A(1), A(2), A(3)); });
      d('glPolygonOffset', () => { if (gl()) gl().polygonOffset(F(0), F(1)); });
      d('glLineWidth', () => { if (gl()) gl().lineWidth(F(0)); });
      d('glHint', () => { if (gl()) gl().hint(A(0), A(1)); });
      d('glFinish', () => {});
      d('glPixelStorei', () => { if (gl()) { const p = A(0); if (p === 0x0cf5 || p === 0x0d05) gl().pixelStorei(p, A(1)); } });
      d('glGetError', () => ret(0));
      d('glFlush', () => {});

      // ---------- texturas ----------
      const bytesPorPixel = (fmt, tipo) => {
        if (tipo === 0x8363 || tipo === 0x8033 || tipo === 0x8034 || tipo === 0x1403) return 2;
        const n = { 0x1908: 4, 0x1907: 3, 0x190a: 2, 0x1909: 1, 0x1906: 1 }[fmt] || 4;
        return tipo === 0x1406 ? 4 * n : n;
      };
      const vistaPixeles = (p, w, h, fmt, tipo) => {
        if (!p) return null;
        const bpp = bytesPorPixel(fmt, tipo), alin = self.alinDesempaque || 4;
        const fila = ((w * bpp + alin - 1) & ~(alin - 1)), n = fila * h;
        if (tipo === 0x1401) return new Uint8Array(s3e.u8.buffer, p, n);
        if (tipo === 0x1406) return new Float32Array(s3e.u8.buffer.slice(p, p + n));
        return new Uint16Array(s3e.u8.buffer.slice(p, p + n)); // 565 / 4444 / 5551 / ushort
      };
      d('glPixelStorei', () => { const p = A(0); if (p === 0x0cf5) self.alinDesempaque = A(1); if (gl() && (p === 0x0cf5 || p === 0x9240 || p === 0x9241 || p === 0x9243)) gl().pixelStorei(p, A(1)); });
      d('glTexImage2D', () => {
        const [t, lv, ifmt, w, h, , fmt, tipo] = [A(0), A(1), A(2), A(3), A(4), A(5), A(6), A(7)];
        const p = A(8);
        if (gl()) gl().texImage2D(t, lv, ifmt, w, h, 0, fmt, tipo, vistaPixeles(p, w, h, fmt, tipo));
        self.texInfo = { w, h };
      });
      d('glTexSubImage2D', () => {
        const [t, lv, x, y, w, h, fmt, tipo] = [A(0), A(1), A(2), A(3), A(4), A(5), A(6), A(7)];
        if (gl()) gl().texSubImage2D(t, lv, x, y, w, h, fmt, tipo, vistaPixeles(A(8), w, h, fmt, tipo));
      });
      d('glCompressedTexImage2D', () => {
        const [t, lv, ifmt, w, h, , n, p] = [A(0), A(1), A(2), A(3), A(4), A(5), A(6), A(7)];
        if (self.comprimida) self.comprimida(gl(), t, lv, ifmt, w, h, new Uint8Array(s3e.u8.buffer, p, n >>> 0));
        else if (gl()) gl().compressedTexImage2D(t, lv, ifmt, w, h, 0, new Uint8Array(s3e.u8.buffer, p, n >>> 0));
      });
      d('glCompressedTexSubImage2D', () => { /* poco usado; se completa si hace falta */ if (gl()) gl().compressedTexSubImage2D(A(0), A(1), A(2), A(3), A(4), A(5), A(6), new Uint8Array(s3e.u8.buffer, A(8), A(7) >>> 0)); });
      d('glCopyTexImage2D', () => { if (gl()) gl().copyTexImage2D(A(0), A(1), A(2), A(3), A(4), A(5), A(6), A(7)); });
      d('glCopyTexSubImage2D', () => { if (gl()) gl().copyTexSubImage2D(A(0), A(1), A(2), A(3), A(4), A(5), A(6), A(7)); });
      d('glTexParameteri', () => { if (gl()) gl().texParameteri(A(0), A(1), A(2)); });
      d('glTexParameteriv', () => { if (gl()) gl().texParameteri(A(0), A(1), s3e.dv.getInt32(A(2), true)); });
      d('glTexParameterfv', () => { if (gl()) gl().texParameterf(A(0), A(1), s3e.dv.getFloat32(A(2), true)); });

      // ---------- shaders y programas ----------
      d('glCreateShader', () => ret(self.nuevo('sh', gl() ? gl().createShader(A(0)) : { falso: true, tipo: A(0) })));
      d('glShaderSource', () => {
        const sh = self.obj('sh', A(0)), n = A(1), pp = A(2), pl = A(3);
        let src = '';
        for (let i = 0; i < n; i++) {
          const p = s3e.dv.getUint32(pp + 4 * i, true), len = pl ? s3e.dv.getInt32(pl + 4 * i, true) : -1;
          src += s3e.cstr(p, len >= 0 ? len : 0);
        }
        if (self.o.verShaders) self.log('SHADER ' + src.length + ' bytes');
        if (sh) { sh.fuente = src; if (gl() && !sh.falso) gl().shaderSource(sh, self.adaptarShader ? self.adaptarShader(src, sh) : src); }
      });
      d('glCompileShader', () => { const sh = self.obj('sh', A(0)); if (gl() && sh && !sh.falso) gl().compileShader(sh); });
      d('glGetShaderiv', () => {
        const sh = self.obj('sh', A(0)), pn = A(1), p = A(2); let v = 1;
        if (gl() && sh && !sh.falso) { v = gl().getShaderParameter(sh, pn); if (typeof v === 'boolean') v = v ? 1 : 0; if (pn === 0x8b84) v = (gl().getShaderInfoLog(sh) || '').length + 1; if (pn === 0x8b88) v = ((sh.fuente || '').length + 1); }
        else if (pn === 0x8b84 || pn === 0x8b88) v = 0;
        s3e.dv.setInt32(p, v | 0, true);
      });
      const infoLog = (txt, bufsz, plen, pbuf) => { const n = Math.min(txt.length, Math.max(0, bufsz - 1)); for (let i = 0; i < n; i++) s3e.u8[pbuf + i] = txt.charCodeAt(i) & 255; if (bufsz > 0) s3e.u8[pbuf + n] = 0; if (plen) s3e.dv.setInt32(plen, n, true); };
      d('glGetShaderInfoLog', () => { const sh = self.obj('sh', A(0)); infoLog(gl() && sh && !sh.falso ? (gl().getShaderInfoLog(sh) || '') : '', A(1), A(2), A(3)); });
      d('glDeleteShader', () => { const sh = self.obj('sh', A(0)); if (gl() && sh && !sh.falso) gl().deleteShader(sh); self.ids.sh[A(0)] = null; });
      d('glCreateProgram', () => ret(self.nuevo('pr', gl() ? gl().createProgram() : { falso: true })));
      d('glAttachShader', () => { const p = self.obj('pr', A(0)), sh = self.obj('sh', A(1)); if (gl() && p && sh && !p.falso) gl().attachShader(p, sh); });
      d('glDetachShader', () => { const p = self.obj('pr', A(0)), sh = self.obj('sh', A(1)); if (gl() && p && sh && !p.falso) gl().detachShader(p, sh); });
      d('glBindAttribLocation', () => { const p = self.obj('pr', A(0)); if (gl() && p && !p.falso) gl().bindAttribLocation(p, A(1), s3e.cstr(A(2))); });
      d('glLinkProgram', () => { const p = self.obj('pr', A(0)); if (gl() && p && !p.falso) { gl().linkProgram(p); if (!gl().getProgramParameter(p, 0x8b82)) self.log('ENLACE FALLO: ' + gl().getProgramInfoLog(p)); } });
      d('glGetProgramiv', () => {
        const p = self.obj('pr', A(0)), pn = A(1), q = A(2); let v = 1;
        if (gl() && p && !p.falso) { v = gl().getProgramParameter(p, pn); if (typeof v === 'boolean') v = v ? 1 : 0; if (pn === 0x8b84) v = (gl().getProgramInfoLog(p) || '').length + 1; }
        else if (pn === 0x8b84) v = 0;
        s3e.dv.setInt32(q, v | 0, true);
      });
      d('glGetProgramInfoLog', () => { const p = self.obj('pr', A(0)); infoLog(gl() && p && !p.falso ? (gl().getProgramInfoLog(p) || '') : '', A(1), A(2), A(3)); });
      d('glDeleteProgram', () => { const p = self.obj('pr', A(0)); if (gl() && p && !p.falso) gl().deleteProgram(p); self.ids.pr[A(0)] = null; });
      d('glUseProgram', () => { self.progAct = A(0); if (gl()) gl().useProgram(self.obj('pr', A(0))); });
      d('glGetAttribLocation', () => { const p = self.obj('pr', A(0)); ret(gl() && p && !p.falso ? gl().getAttribLocation(p, s3e.cstr(A(1))) : 0); });
      d('glGetUniformLocation', () => {
        const idp = A(0), p = self.obj('pr', idp), nombre = s3e.cstr(A(1));
        if (!(gl() && p && !p.falso)) { ret(0); return; }
        let m = self.locPorProg.get(idp); if (!m) self.locPorProg.set(idp, m = new Map());
        if (m.has(nombre)) { ret(m.get(nombre)); return; }
        const l = gl().getUniformLocation(p, nombre);
        if (l === null) { m.set(nombre, -1); ret(-1); return; }
        self.locs.push(l); const id = self.locs.length - 1; m.set(nombre, id); ret(id);
      });
      d('glGetActiveUniform', () => {
        const p = self.obj('pr', A(0)), ix = A(1), bufsz = A(2), plen = A(3), psize = A(4), ptipo = A(5), pnom = A(6);
        if (!(gl() && p && !p.falso)) return;
        const u = gl().getActiveUniform(p, ix); if (!u) return;
        infoLog(u.name, bufsz, plen, pnom); s3e.dv.setInt32(psize, u.size, true); s3e.dv.setInt32(ptipo, u.type, true);
      });
      const loc = (i) => self.locs[i] || null;
      d('glUniform1f', () => { if (gl() && A(0) >= 0) gl().uniform1f(loc(A(0)), F(1)); });
      d('glUniform1i', () => { if (gl() && A(0) >= 0) gl().uniform1i(loc(A(0)), A(1)); });
      d('glUniform4f', () => { if (gl() && A(0) >= 0) gl().uniform4f(loc(A(0)), F(1), F(2), F(3), F(4)); });
      const uf = (n, nombre) => d(nombre, () => { if (gl() && A(0) >= 0) gl()['uniform' + n + 'fv'](loc(A(0)), self.floats(s3e, A(2), n * A(1))); });
      uf(1, 'glUniform1fv'); uf(2, 'glUniform2fv'); uf(3, 'glUniform3fv'); uf(4, 'glUniform4fv');
      const ui = (n, nombre) => d(nombre, () => { if (gl() && A(0) >= 0) gl()['uniform' + n + 'iv'](loc(A(0)), self.ints(s3e, A(2), n * A(1))); });
      ui(1, 'glUniform1iv'); ui(2, 'glUniform2iv'); ui(3, 'glUniform3iv'); ui(4, 'glUniform4iv');
      const um = (n, nombre) => d(nombre, () => {
        if (!(gl() && A(0) >= 0)) return;
        let v = self.floats(s3e, A(3), n * n * A(1));
        if (A(2) & 255) { // WebGL1 no admite transpuesta: se transpone aca
          const w = new Float32Array(v.length);
          for (let m = 0; m < A(1); m++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) w[m * n * n + i * n + j] = v[m * n * n + j * n + i];
          v = w;
        }
        gl()['uniformMatrix' + n + 'fv'](loc(A(0)), false, v);
      });
      um(2, 'glUniformMatrix2fv'); um(3, 'glUniformMatrix3fv'); um(4, 'glUniformMatrix4fv');

      // ---------- atributos de vertice y dibujo ----------
      d('glEnableVertexAttribArray', () => { const i = A(0); self.atr[i].on = true; if (gl()) gl().enableVertexAttribArray(i); });
      d('glDisableVertexAttribArray', () => { const i = A(0); self.atr[i].on = false; if (gl()) gl().disableVertexAttribArray(i); });
      d('glVertexAttribPointer', () => {
        const i = A(0), a = self.atr[i];
        a.tam = A(1); a.tipo = A(2); a.norm = !!(A(3) & 255); a.paso = A(4); a.ptr = A(5); a.vbo = self.vboAct;
        if (gl() && a.vbo) gl().vertexAttribPointer(i, a.tam, a.tipo, a.norm, a.paso, a.ptr);
      });
      const tamTipo = (t) => ({ 0x1400: 1, 0x1401: 1, 0x1402: 2, 0x1403: 2, 0x1404: 4, 0x1405: 4, 0x1406: 4 }[t] || 4);
      // sube a un buffer temporal las matrices de vertices que viven en memoria del cliente
      const subirAtributos = (primero, cuenta, absoluto) => {
        const g = gl(); if (!g) return;
        if (!self.tmp) { self.tmp = g.createBuffer(); self.tmpIdx = g.createBuffer(); }
        const usados = [];
        for (let i = 0; i < 16; i++) { const a = self.atr[i]; if (a.on && !a.vbo) usados.push(i); }
        if (!usados.length) return;
        g.bindBuffer(0x8892, self.tmp);
        let total = 0; const regiones = [];
        for (const i of usados) {
          const a = self.atr[i], paso = a.paso || a.tam * tamTipo(a.tipo);
          const desde = absoluto ? primero : 0, hasta = primero + cuenta; // absoluto: la region empieza en el vertice 0 (indices sin tocar)
          regiones.push({ i, a, paso, ini: primero, n: cuenta, base: total, bytes: (absoluto ? hasta : cuenta) * paso }); total += (regiones[regiones.length - 1].bytes + 3) & ~3;
        }
        g.bufferData(0x8892, total, 0x88e0);
        for (const r of regiones) {
          const off = absoluto ? r.ini * r.paso : 0;
          g.bufferSubData(0x8892, r.base + off, s3e.u8.subarray(r.a.ptr + r.ini * r.paso, r.a.ptr + (r.ini + r.n) * r.paso));
          g.vertexAttribPointer(r.i, r.a.tam, r.a.tipo, r.a.norm, r.a.paso, r.base);
        }
      };
      const restaurarAtributos = () => { // vuelve a enlazar el VBO de la app
        if (gl()) gl().bindBuffer(0x8892, self.obj('buf', self.vboAct));
      };
      d('glDrawArrays', () => {
        self.dibujos++;
        if (!gl()) return;
        subirAtributos(A(1), A(2), false);
        gl().drawArrays(A(0), 0, A(2));
        restaurarAtributos();
      });
      d('glDrawElements', () => {
        self.dibujos++;
        const g = gl(); if (!g) return;
        const modo = A(0), n = A(1), tipo = A(2), ind = A(3);
        if (self.iboAct) { // indices en un buffer: ind es un desplazamiento
          // los atributos del cliente necesitan el rango de indices: se lee del buffer guardado
          if (self.atr.some((a) => a.on && !a.vbo)) { self.log('AVISO: atributos del cliente con indices en buffer'); }
          g.drawElements(modo, n, tipo, ind);
          return;
        }
        const tb = tamTipo(tipo);
        const vista = tb === 1 ? new Uint8Array(s3e.u8.buffer, ind, n) : tb === 2 ? new Uint16Array(s3e.u8.buffer.slice(ind, ind + 2 * n)) : new Uint32Array(s3e.u8.buffer.slice(ind, ind + 4 * n));
        let mn = 0x7fffffff, mx = 0;
        for (let i = 0; i < n; i++) { const v = vista[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
        if (mn > mx) return;
        subirAtributos(mn, mx - mn + 1, true);
        g.bindBuffer(0x8893, self.tmpIdx);
        g.bufferData(0x8893, vista, 0x88e0);
        g.drawElements(modo, n, tipo, 0);
        g.bindBuffer(0x8893, self.obj('buf', self.iboAct));
        restaurarAtributos();
      });

      // ---------- consultas ----------
      const tablaInt = { 0x0d33: 4096, 0x8869: 16, 0x8872: 16, 0x8b4c: 16, 0x8b4d: 32, 0x8dfb: 224, 0x8dfd: 30, 0x8dfc: 15, 0x84e8: 4096, 0x851c: 4096, 0x0d3a: 0, 0x80a9: 0, 0x80a8: 0, 0x0d50: 8, 0x0d52: 8, 0x0d53: 8, 0x0d54: 8, 0x0d55: 8, 0x0d56: 8, 0x0d57: 0, 0x86a2: 0, 0x8b9a: 0x1908, 0x8b9b: 0x1401 };
      d('glGetIntegerv', () => {
        const pn = A(0), p = A(1);
        if (pn === 0x86a2) { // NUM_COMPRESSED_TEXTURE_FORMATS
          const f = self.formatosComprimidos(); s3e.dv.setInt32(p, f.length, true); return; }
        if (pn === 0x86a3) { const f = self.formatosComprimidos(); f.forEach((x, i) => s3e.dv.setInt32(p + 4 * i, x, true)); return; }
        if (pn === 0x0ba2 || pn === 0x0c10) { // VIEWPORT / SCISSOR_BOX
          const v = gl() ? gl().getParameter(pn) : [0, 0, self.ancho, self.alto]; for (let i = 0; i < 4; i++) s3e.dv.setInt32(p + 4 * i, v[i], true); return; }
        if (pn === 0x0d3a) { s3e.dv.setInt32(p, self.ancho, true); s3e.dv.setInt32(p + 4, self.alto, true); return; }
        let v;
        if (gl()) { const r = gl().getParameter(pn); v = typeof r === 'number' ? r : typeof r === 'boolean' ? (r ? 1 : 0) : r && r.length !== undefined ? null : 0; if (v === null) { for (let i = 0; i < r.length; i++) s3e.dv.setInt32(p + 4 * i, r[i], true); return; } if (r && typeof r === 'object' && !r.length) v = 0; }
        else v = tablaInt[pn] !== undefined ? tablaInt[pn] : 0;
        if (pn === 0x8b4d && gl()) v = Math.min(v, 32);
        s3e.dv.setInt32(p, v | 0, true);
      });
      d('glGetBooleanv', () => { s3e.u8[A(1)] = 0; });
      d('glGetFloatv', () => { const pn = A(0), p = A(1); if (gl()) { const r = gl().getParameter(pn); if (typeof r === 'number') s3e.dv.setFloat32(p, r, true); else if (r && r.length) for (let i = 0; i < r.length; i++) s3e.dv.setFloat32(p + 4 * i, r[i], true); } else s3e.dv.setFloat32(p, pn === 0x846e ? 1 : 0, true); });
      d('glGetString', () => {
        const n = A(0); let s = '';
        switch (n) {
          case 0x1f00: s = self.o.vendor || 'WebGL'; break;
          case 0x1f01: s = self.o.renderer || 'WebGL'; break;
          case 0x1f02: s = 'OpenGL ES 2.0'; break;
          case 0x8b8c: s = 'OpenGL ES GLSL ES 1.00'; break;
          case 0x1f03: s = self.ext.join(' '); break;
        }
        ret(s3e.cadenaPersistente(s));
      });
      d('glGetFramebufferAttachmentParameteriv', () => { s3e.dv.setInt32(A(3), 0, true); });
      d('glGetRenderbufferParameteriv', () => { if (gl()) { const v = gl().getRenderbufferParameter(A(0), A(1)); s3e.dv.setInt32(A(2), v | 0, true); } else s3e.dv.setInt32(A(2), 0, true); });
      d('glReadPixels', () => {
        const [x, y, w, h, fmt, tipo, p] = [A(0), A(1), A(2), A(3), A(4), A(5), A(6)];
        if (gl()) gl().readPixels(x, y, w, h, fmt, tipo, new Uint8Array(s3e.u8.buffer, p, w * h * 4));
      });

      // ---------- EGL ----------
      d('eglGetError', () => ret(0x3000));
      d('eglGetDisplay', () => ret(1));
      d('eglInitialize', () => { if (A(1)) s3e.dv.setInt32(A(1), 1, true); if (A(2)) s3e.dv.setInt32(A(2), 4, true); ret(1); });
      d('eglTerminate', () => ret(1));
      d('eglBindAPI', () => ret(1));
      d('eglQueryString', () => { const n = A(1); ret(s3e.cadenaPersistente(n === 0x3055 ? 'EGL_KHR_image_base' : n === 0x3053 ? 'WebGL' : n === 0x3054 ? '1.4' : '')); });
      d('eglGetConfigs', () => { if (A(1)) s3e.dv.setInt32(A(1), 1, true); if (A(3)) s3e.dv.setInt32(A(3), 1, true); ret(1); });
      d('eglGetConfigAttrib', () => {
        const at = A(2), v = { 0x3020: 1, 0x3024: 8, 0x3023: 8, 0x3022: 8, 0x3021: 8, 0x3025: 16, 0x3026: 8, 0x3027: 0x3038, 0x3033: 5, 0x3040: 4, 0x302c: 1, 0x302d: 1 }[at];
        s3e.dv.setInt32(A(3), v === undefined ? 0 : v, true); ret(1);
      });
      d('eglCreateWindowSurface', () => ret(2));
      d('eglCreatePbufferSurface', () => ret(3));
      d('eglCreateContext', () => ret(4));
      d('eglMakeCurrent', () => ret(1));
      d('eglDestroySurface', () => ret(1));
      d('eglDestroyContext', () => ret(1));
      d('eglGetCurrentContext', () => ret(4));
      d('eglGetCurrentSurface', () => ret(2));
      d('eglGetCurrentDisplay', () => ret(1));
      d('eglQueryContext', () => { s3e.dv.setInt32(A(3), 2, true); ret(1); });
      d('eglQuerySurface', () => { const at = A(2); s3e.dv.setInt32(A(3), at === 0x3057 ? self.ancho : at === 0x3056 ? self.alto : 0, true); ret(1); });
      d('eglSwapBuffers', () => { ret(1); if (self.o.alMostrar) self.o.alMostrar(); s3e.pedirYield(0); });
      d('eglGetProcAddress', () => ret(0));
      d('eglBindTexImage', () => ret(1));
      d('eglReleaseTexImage', () => ret(1));
      return G;
    }

    formatosComprimidos() {
      // formatos que se anuncian: S3TC (DXT1/DXT3/DXT5)
      return [0x83f0, 0x83f1, 0x83f2, 0x83f3];
    }
  }
  return GlHle;
})();
if (typeof module !== 'undefined') module.exports = GlHle;
