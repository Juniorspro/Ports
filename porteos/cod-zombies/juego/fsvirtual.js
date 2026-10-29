// Sistema de archivos virtual para el guest: nombres "rom://x", "raw://x" o sin esquema; cada archivo es un respaldo con leer/tamano
//   respaldo: { tam, leer(desde, n, destino, off) -> bytes }   (en el navegador sera un Range HTTP en un Worker; en Node, un buffer)
'use strict';
const FsVirtual = (() => {
  class Archivo {
    constructor(resp, escribible) { this.resp = resp; this.pos = 0; this.tam = resp.tam; this.esc = escribible; }
    leer(u8, dst, n) {
      if (this.pos >= this.tam) return 0;
      if (this.pos + n > this.tam) n = this.tam - this.pos;
      const got = this.resp.leer(this.pos, n, u8, dst);
      this.pos += got; return got;
    }
    seek(off, origen) {
      const base = origen === 0 ? 0 : origen === 1 ? this.pos : this.tam;
      const p = base + off; if (p < 0) return 1; this.pos = p; return 0;
    }
    escribir(u8, src, n) { if (this.resp.escribir) { this.resp.escribir(this.pos, u8, src, n); this.pos += n; this.tam = Math.max(this.tam, this.pos); } }
    cerrar() {}
  }
  class Fs {
    constructor() { this.arch = new Map(); this.log = () => {}; }
    static norm(n) { return n.replace(/^(rom|raw):\/\//i, '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase(); }
    montar(nombre, resp) { this.arch.set(Fs.norm(nombre), resp); }
    existe(n) { return this.arch.has(Fs.norm(n)); }
    abrir(n, modo) {
      const r = this.arch.get(Fs.norm(n));
      if (r) return new Archivo(r, /[wa+]/.test(modo));
      if (/[wa]/.test(modo)) { // archivo nuevo en memoria
        const mem = { tam: 0, datos: new Uint8Array(0), leer(d, k, u8, o) { u8.set(this.datos.subarray(d, d + k), o); return k; }, escribir(p, u8, s, k) { if (p + k > this.datos.length) { const nd = new Uint8Array(Math.max(p + k, this.datos.length * 2)); nd.set(this.datos); this.datos = nd; } this.datos.set(u8.subarray(s, s + k), p); this.tam = Math.max(this.tam, p + k); } };
        this.arch.set(Fs.norm(n), mem); return new Archivo(mem, true);
      }
      return null;
    }
    borrar(n) { return this.arch.delete(Fs.norm(n)) ? 0 : 1; }
  }
  Fs.deBuffer = (buf) => ({ tam: buf.length, leer(d, k, u8, o) { u8.set(buf.subarray(d, d + k), o); return k; } });
  return Fs;
})();
if (typeof module !== 'undefined') module.exports = FsVirtual;
