// Lector del ICF de Marmalade (la configuracion embebida en el .s3e): secciones, ambitos condicionales y expresiones simples.
//   [GRUPO] / nombre = valor / {OS=ANDROID} {ID=ANDROID "Nexus S", "..."} {[GAME] clave == valor} {} (limpia) / # comentarios
// Gana la ultima asignacion que este vigente. Los nombres no distinguen mayusculas.
'use strict';
const Icf = (() => {
  class Icf {
    constructor(texto, ambiente) {
      this.v = new Map();           // "grupo\0nombre" -> cadena
      this.amb = ambiente || {};    // { OS:'ANDROID', ID:'ANDROID Nexus S', CLASS:'ANDROID' }
      this.parse(texto);
    }
    static k(g, n) { return g.toLowerCase() + '\0' + n.toLowerCase(); }
    get(g, n) { const x = this.v.get(Icf.k(g, n)); return x === undefined ? null : x; }
    getInt(g, n) {
      const s = this.get(g, n); if (s === null) return null;
      const m = /^\s*(-?(?:0x[0-9a-f]+|\d+))/i.exec(s); return m ? Number(m[1]) | 0 : null;
    }
    // evalua una condicion {...}
    cond(c) {
      c = c.trim();
      if (c === '') return true;
      let m;
      if ((m = /^OS\s*=\s*(\S+)$/i.exec(c))) return m[1].toUpperCase() === 'ANY' || m[1].toUpperCase() === String(this.amb.OS || '').toUpperCase();
      if ((m = /^CLASS\s*=\s*(\S+)$/i.exec(c))) return m[1].toUpperCase() === 'ANY' || m[1].toUpperCase() === String(this.amb.CLASS || '').toUpperCase();
      if ((m = /^ID\s*=\s*(\S+)\s*(.*)$/i.exec(c))) {
        if (m[1].toUpperCase() === 'ANY') return true;
        if (m[1].toUpperCase() !== String(this.amb.OS || '').toUpperCase()) return false;
        const nombres = [...m[2].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
        return nombres.length === 0 || nombres.some((n) => n === this.amb.MODEL);
      }
      if ((m = /^\[(\w+)\]\s*(\w+)\s*(==|!=)\s*(.*)$/.exec(c))) {
        const actual = this.get(m[1], m[2]);
        const esperado = m[4].trim().replace(/^"(.*)"$/, '$1');
        const igual = actual !== null && String(actual).toLowerCase() === esperado.toLowerCase();
        return m[3] === '==' ? igual : !igual;
      }
      return false;
    }
    valor(s) {
      s = s.trim();
      // comentarios al final (# o //) fuera de comillas
      let q = false, out = '';
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '"') q = !q;
        if (!q && (ch === '#' || (ch === '/' && s[i + 1] === '/'))) break;
        out += ch;
      }
      s = out.trim();
      if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') return s.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      // expresion con referencias [G] nombre y + - : se evalua si todo son numeros
      if (/\[\w+\]/.test(s) || /^[-+\d\s.x]+$/i.test(s) && /[+\-]/.test(s.replace(/^\s*-/, ''))) {
        const e = s.replace(/\[(\w+)\]\s*(\w+)/g, (_, g, n) => { const r = this.get(g, n); return r === null ? '0' : r; });
        if (/^[-+\d\s.xa-fA-F]+$/.test(e)) { try { return String(Function('"use strict";return (' + e + ')')()); } catch (_) { /* queda tal cual */ } }
      }
      return s;
    }
    parse(texto) {
      let grupo = '', vigente = true;
      for (let linea of texto.split(/\r?\n/)) {
        const t = linea.trim();
        if (t === '' || t[0] === '#' || t.startsWith('//')) continue;
        let m;
        if (t[0] === '{') { // ambito condicional; puede traer un comentario despues de la llave
          m = /^\{([^}]*)\}/.exec(t);
          if (m) { vigente = this.cond(m[1]); continue; }
        }
        if (t[0] === '[' && (m = /^\[(\w+)\]\s*(?:#.*)?$/.exec(t))) { grupo = m[1]; continue; }
        if (!vigente) continue;
        const i = t.indexOf('=');
        if (i < 0) continue;
        const nombre = t.slice(0, i).trim();
        if (!nombre) continue;
        this.v.set(Icf.k(grupo, nombre), this.valor(t.slice(i + 1)));
      }
    }
  }
  return Icf;
})();
if (typeof module !== 'undefined') module.exports = Icf;
