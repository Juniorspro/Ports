// Sistema de archivos virtual para el guest: nombres "rom://x", "raw://x" o sin esquema; cada archivo es un respaldo con leer/tamano
//   respaldo: { tam, leer(desde, n, destino, off) -> bytes }   (en el navegador sera un Range HTTP en un Worker; en Node, un buffer)
'use strict';
const FsVirtual = (() => {
  class Archivo {
    constructor(resp, escribible, fs, nombre) { this.resp = resp; this.pos = 0; this.tam = resp.tam; this.esc = escribible; this.fs = fs; this.nom = nombre; this.mod = false; }
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
    escribir(u8, src, n) { if (this.resp.escribir) { this.resp.escribir(this.pos, u8, src, n); this.pos += n; this.tam = Math.max(this.tam, this.pos); this.mod = true; } }
    // al cerrar un archivo escrito por el juego se avisa (para guardarlo en el navegador)
    cerrar() { if (this.mod && this.fs && this.fs.alGuardar) this.fs.alGuardar(this.nom, this.resp.datos.slice(0, this.resp.tam)); this.mod = false; }
  }
  class Fs {
    constructor() { this.arch = new Map(); this.log = () => {}; }
    static norm(n) { return n.replace(/^(rom|raw):\/\//i, '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase(); }
    montar(nombre, resp) { this.arch.set(Fs.norm(nombre), resp); }
    existe(n) { return this.arch.has(Fs.norm(n)); }
    abrir(n, modo) {
      const k = Fs.norm(n), r = this.arch.get(k);
      if (r && !(/w/.test(modo) && r.escribir)) {
        const a = new Archivo(r, /[wa+]/.test(modo), this, k);
        if (/a/.test(modo)) a.pos = a.tam;
        return a;
      }
      if (/[wa]/.test(modo)) { // archivo nuevo (o "w": se trunca) en memoria
        const mem = Fs.enMemoria(new Uint8Array(0));
        this.arch.set(k, mem); const a = new Archivo(mem, true, this, k); a.mod = true; return a;
      }
      return null;
    }
    borrar(n) { const k = Fs.norm(n); if (!this.arch.delete(k)) return 1; if (this.alBorrar) this.alBorrar(k); return 0; }
  }
  // archivo escribible en memoria (partidas guardadas); datos iniciales opcionales
  Fs.enMemoria = (ini) => ({
    tam: ini.length, datos: ini,
    leer(d, k, u8, o) { u8.set(this.datos.subarray(d, d + k), o); return k; },
    escribir(p, u8, s, k) { if (p + k > this.datos.length) { const nd = new Uint8Array(Math.max(p + k, this.datos.length * 2, 256)); nd.set(this.datos); this.datos = nd; } this.datos.set(u8.subarray(s, s + k), p); this.tam = Math.max(this.tam, p + k); },
  });
  Fs.deBuffer = (buf) => ({ tam: buf.length, leer(d, k, u8, o) { u8.set(buf.subarray(d, d + k), o); return k; } });
  return Fs;
})();
if (typeof module !== 'undefined') module.exports = FsVirtual;
