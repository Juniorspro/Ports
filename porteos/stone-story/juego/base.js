// Datos del juego (datos.json.gz), SlimJson (el JSON sin comillas de los .txt del juego) y utilidades.
'use strict';
const TICS = 30; // el juego avanza a 30 pasos por segundo (como el "frame" de Stonescript)

const Datos = {
  async cargar(b) {
    const s = new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'));
    const d = JSON.parse(await new Response(s).text());
    Object.assign(Datos, d);
    Datos.porNombre = {};
    for (const [id, [n]] of Object.entries(d.textos)) if (!(n in Datos.porNombre)) Datos.porNombre[n] = id;
  },
  texto(ref) { // '@s123' | 's123' | nombre
    if (!ref) return null;
    if (ref[0] === '@') ref = ref.slice(1);
    const t = Datos.textos[ref] || Datos.textos[Datos.porNombre[ref]];
    return t ? t[1] : null;
  },
  nombreTexto(ref) { if (ref && ref[0] === '@') ref = ref.slice(1); const t = Datos.textos[ref]; return t ? t[0] : ref; },
  prefab(ruta) { return Datos.rutas[ruta.toLowerCase()]; },
};

// SlimJson: claves y textos sin comillas, comas de sobra, comentarios //
function slim(txt) {
  let i = 0;
  const n = txt.length;
  const blanco = () => {
    for (;;) {
      while (i < n && /\s/.test(txt[i])) i++;
      if (txt[i] === '/' && txt[i + 1] === '/') { while (i < n && txt[i] !== '\n') i++; continue; }
      break;
    }
  };
  const valor = () => {
    blanco();
    const c = txt[i];
    if (c === '{') {
      i++; const o = {};
      for (;;) {
        blanco();
        if (txt[i] === ',') { i++; continue; }
        if (txt[i] === '}' || i >= n) { i++; return o; }
        let k = '';
        if (txt[i] === '"') { k = cadena(); } else { while (i < n && txt[i] !== ':' && txt[i] !== '}' && txt[i] !== ',') k += txt[i++]; k = k.trim(); }
        blanco();
        if (txt[i] === ':') { i++; o[k] = valor(); } else o[k] = true;
      }
    }
    if (c === '[') {
      i++; const a = [];
      for (;;) {
        blanco();
        if (txt[i] === ',') { i++; continue; }
        if (txt[i] === ']' || i >= n) { i++; return a; }
        a.push(valor());
      }
    }
    if (c === '"') return cadena();
    let s = '';
    while (i < n && !',}]\n\r'.includes(txt[i])) s += txt[i++];
    s = s.trim();
    if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null') return null;
    return s;
  };
  const cadena = () => {
    i++; let s = '';
    while (i < n && txt[i] !== '"') {
      if (txt[i] === '\\' && i + 1 < n) { const e = txt[++i]; s += e === 'n' ? '\n' : e === 't' ? '\t' : e; i++; continue; }
      s += txt[i++];
    }
    i++; return s;
  };
  return valor();
}

// azar con semilla (como System.Random no hace falta: alcanza con uno estable)
function Azar(semilla) {
  let s = (semilla >>> 0) || 1;
  const f = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  f.entre = (a, b) => a + Math.floor(f() * (b - a)); // [a, b)
  return f;
}
const azar = Azar(Date.now());

function color01(c, def) { return c ? [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)] : def; }
function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
