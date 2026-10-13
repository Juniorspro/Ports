// Formato de los niveles del juego: base64 (url) de un gzip con "cabecera;obj;obj;..." donde cada
// objeto es "clave,valor,clave,valor" y la cabecera trae los colores (kS38 en 2.x, kS29..kS37 en
// los niveles de 1.9) y los ajustes (kA*). Se guarda tal cual lo que no se entiende, así el editor
// no pierde nada al volver a guardar.
'use strict';
const N = GD.N = {};

N.descomprimir = async function (s) {
  s = s.trim();
  if (s.startsWith('kS') || s.startsWith('kA') || s.includes(';1,')) return s;
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '') + '='.repeat((4 - s.length % 4) % 4));
  const u = Uint8Array.from(b, c => c.charCodeAt(0));
  const fmt = u[0] === 0x1f && u[1] === 0x8b ? 'gzip' : 'deflate';
  const ds = new DecompressionStream(fmt);
  const txt = await new Response(new Blob([u]).stream().pipeThrough(ds)).text().catch(async () => {
    // algunos niveles vienen en zlib crudo
    const d2 = new DecompressionStream('deflate-raw'); return new Response(new Blob([u.slice(10)]).stream().pipeThrough(d2)).text();
  });
  return txt;
};
N.comprimir = async function (txt) {
  const cs = new CompressionStream('gzip');
  const u = new Uint8Array(await new Response(new Blob([txt]).stream().pipeThrough(cs)).arrayBuffer());
  let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_');
};

// claves de objeto que son números (las demás quedan como texto: grupos, HSV, textos, etc.)
const TEXTO = new Set([31, 43, 44, 49, 57, 274, 442, 435]);
N.objeto = function (s) {
  const p = s.split(','), o = { _k: [] };
  for (let i = 0; i + 1 < p.length; i += 2) {
    const k = +p[i], v = p[i + 1];
    o[k] = TEXTO.has(k) ? v : (v === '' ? 0 : +v);
    if (Number.isNaN(o[k])) o[k] = v;
    o._k.push(k);
  }
  return o;
};
N.objetoATexto = function (o) {
  const ks = o._k ? o._k.slice() : [];
  for (const k in o) if (k !== '_k' && !ks.includes(+k) && !isNaN(+k)) ks.push(+k);
  const out = [];
  for (const k of ks) { const v = o[k]; if (v === undefined || v === null) continue; out.push(k, typeof v === 'number' ? +v.toFixed(4) : v); }
  return out.join(',');
};

// colores de la cabecera → {canal: {r,g,b,op,add,pc(player color 1/2), copia, hsv, ...}}
N.color = function (s) {
  const p = s.split('_'), c = { r: 255, g: 255, b: 255, op: 1, add: false, pc: -1 };
  for (let i = 0; i + 1 < p.length; i += 2) {
    const k = +p[i], v = p[i + 1];
    switch (k) {
      case 1: c.r = +v; break; case 2: c.g = +v; break; case 3: c.b = +v; break;
      case 4: c.pc = +v; break; case 5: c.add = v === '1'; break; case 6: c.id = +v; break;
      case 7: c.op = +v; break; case 9: c.copia = +v; break; case 10: c.hsv = v; break;
      case 17: c.copiaOp = v === '1'; break; case 18: c.mezcla = +v; break;
    }
  }
  return c;
};
N.colorATexto = function (id, c) {
  const p = [1, c.r, 2, c.g, 3, c.b, 11, 255, 12, 255, 13, 255, 4, c.pc, 6, id, 7, +(+c.op).toFixed(3), 15, 1, 18, 0, 8, 1];
  if (c.add) p.push(5, 1);
  if (c.copia) p.push(9, c.copia, 10, c.hsv || '0a1a1a0a0', 17, c.copiaOp ? 1 : 0);
  return p.join('_');
};
// los niveles viejos (1.9) traen un color por canal en kS29..kS37
const VIEJOS = { kS29: 1000, kS30: 1001, kS31: 1002, kS32: 1004, kS33: 1, kS34: 2, kS35: 3, kS36: 4, kS37: 1003 };
// y los más viejos todavía, componentes sueltos
const MUY_VIEJOS = { kS1: [1000, 'r'], kS2: [1000, 'g'], kS3: [1000, 'b'], kS4: [1001, 'r'], kS5: [1001, 'g'], kS6: [1001, 'b'], kS7: [1002, 'r'], kS8: [1002, 'g'], kS9: [1002, 'b'], kS10: [1004, 'r'], kS11: [1004, 'g'], kS12: [1004, 'b'], kS13: [1, 'r'], kS14: [1, 'g'], kS15: [1, 'b'] };

N.leer = function (txt) {
  const partes = txt.split(';');
  const cab = partes[0].split(','), ajustes = {}, colores = {};
  for (let i = 0; i + 1 < cab.length; i += 2) {
    const k = cab[i], v = cab[i + 1];
    if (k === 'kS38') { for (const cs of v.split('|')) if (cs) { const c = N.color(cs); if (c.id !== undefined) colores[c.id] = c; } }
    else if (VIEJOS[k]) colores[VIEJOS[k]] = N.color(v);
    else if (MUY_VIEJOS[k]) { const [id, comp] = MUY_VIEJOS[k]; (colores[id] = colores[id] || { r: 255, g: 255, b: 255, op: 1, pc: -1 })[comp] = +v; }
    else ajustes[k] = v;
  }
  const objs = [];
  for (let i = 1; i < partes.length; i++) if (partes[i]) { const o = N.objeto(partes[i]); if (o[1]) objs.push(o); }
  return { ajustes, colores, objs };
};
N.escribir = function (nv) {
  const cs = Object.keys(nv.colores).map(id => N.colorATexto(id, nv.colores[id])).join('|');
  const cab = ['kS38', cs + '|'];
  for (const k in nv.ajustes) if (k !== 'kS38') cab.push(k, nv.ajustes[k]);
  return cab.join(',') + ';' + nv.objs.map(N.objetoATexto).join(';') + ';';
};
// ajustes del nivel con sus valores por omisión
N.ajuste = (nv, k, def = 0) => { const v = nv.ajustes[k]; return v === undefined || v === '' ? def : +v; };
N.grupos = o => { const g = o[57]; if (g === undefined || g === '') return null; return String(g).split('.').filter(x => x).map(Number); };
N.hsv = s => { if (!s) return null; const p = String(s).split('a'); return { h: +p[0] || 0, s: +p[1] || 1, v: +p[2] || 1, sa: p[3] === '1', va: p[4] === '1' }; };
N.texto64 = s => { try { return decodeURIComponent(escape(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')))); } catch (e) { return ''; } };
N.a64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_');
