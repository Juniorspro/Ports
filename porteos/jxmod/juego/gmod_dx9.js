// ---------------- shaders de DirectX 9 de los addons (screenspace_general), traducidos a WebGL ----------------
// Muchos addons de efectos de pantalla (VHS, cámaras, filtros) traen sus propios pixel shaders ya compilados para
// DirectX 9 (shaders/fxc/<nombre>_ps20b.vcs o _ps30.vcs) y los usan con materiales "screenspace_general" ($pixshader).
// Acá se leen esos .vcs (combos comprimidos con LZMA) y el bytecode de DirectX (ps_2_0, ps_2_x/2_b, ps_3_0) se traduce a
// GLSL ES 3.00, instrucción por instrucción: registros, constantes (c#, i#, b#), texturas, bucles (rep, loop), if/else,
// predicados, modificadores (saturate, negar, absoluto...). Lo que no se puede traducir devuelve un error (el material
// queda sin dibujar, como en GMod con un shader que no carga).
// Convención de coordenadas: las coordenadas de textura que ve el shader son las de DirectX (y para abajo); las texturas
// se guardan como en OpenGL, así que cada lectura da vuelta la v.

// ---- el contenedor .vcs (versión 6): combos estáticos → bloques (LZMA) → combos dinámicos con su bytecode ----
function dx9Vcs(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), L = [];
  const ver = dv.getInt32(0, true); if (ver < 5 || ver > 6) throw new Error('vcs versión ' + ver);
  const nSt = dv.getUint32(20, true), recs = [];
  for (let i = 0; i < nSt; i++) recs.push([dv.getUint32(28 + 8 * i, true), dv.getUint32(32 + 8 * i, true)]);
  for (let r = 0; r + 1 < recs.length; r++) {
    let o = recs[r][1];
    const fin = recs[r + 1][1];
    while (o + 4 <= fin) {
      const h = dv.getUint32(o, true); o += 4; if (h === 0xffffffff) break;
      const tam = h & 0x3fffffff; let blk;
      if ((h & 0x40000000) && u8[o] === 0x4c && u8[o + 1] === 0x5a && u8[o + 2] === 0x4d && u8[o + 3] === 0x41) {
        // ('LZMA' + tamaño real + tamaño comprimido + 5 bytes de propiedades + datos → el formato "alone" que lee GMF.lzma)
        const real = dv.getUint32(o + 4, true), comp = dv.getUint32(o + 8, true), src = new Uint8Array(13 + comp);
        src.set(u8.subarray(o + 12, o + 17), 0); src[5] = real & 255; src[6] = (real >>> 8) & 255; src[7] = (real >>> 16) & 255; src[8] = real >>> 24;
        src.set(u8.subarray(o + 17, o + 17 + comp), 13); blk = GMF.lzma(src);
      } else blk = u8.slice(o, o + tam);
      o += tam;
      const bd = new DataView(blk.buffer, blk.byteOffset, blk.byteLength);
      for (let p = 0; p + 8 <= blk.length;) {
        const id = bd.getUint32(p, true), n = bd.getUint32(p + 4, true); p += 8; if (id === 0xffffffff) break;
        const b = blk.slice(p, p + n); p += n;
        L.push({ st: recs[r][0], dyn: id, code: new Uint32Array(b.buffer, b.byteOffset, b.byteLength >> 2) });
      }
    }
  }
  return L;
}

// ---- bytecode de DirectX 9 → GLSL ES 3.00 ----
const DX9_OP = { 0: 'nop', 1: 'mov', 2: 'add', 3: 'sub', 4: 'mad', 5: 'mul', 6: 'rcp', 7: 'rsq', 8: 'dp3', 9: 'dp4', 10: 'min', 11: 'max', 12: 'slt', 13: 'sge', 14: 'exp', 15: 'log', 16: 'lit', 17: 'dst', 18: 'lrp', 19: 'frc', 20: 'm4x4', 21: 'm4x3', 22: 'm3x4', 23: 'm3x3', 24: 'm3x2', 25: 'call', 26: 'callnz', 27: 'loop', 28: 'ret', 29: 'endloop', 30: 'label', 31: 'dcl', 32: 'pow', 33: 'crs', 34: 'sgn', 35: 'abs', 36: 'nrm', 37: 'sincos', 38: 'rep', 39: 'endrep', 40: 'if', 41: 'ifc', 42: 'else', 43: 'endif', 44: 'break', 45: 'breakc', 46: 'mova', 47: 'defb', 48: 'defi', 64: 'texcoord', 65: 'texkill', 66: 'texld', 78: 'expp', 79: 'logp', 80: 'cnd', 81: 'def', 88: 'cmp', 90: 'dp2add', 91: 'dsx', 92: 'dsy', 93: 'texldd', 94: 'setp', 95: 'texldl', 96: 'breakp' };
const DX9_CMP = [null, '>', '==', '>=', '<', '!=', '<='];
function dx9Glsl(code) {
  const ver = code[0], tipo = ver >>> 16, mayor = (ver >> 8) & 255, menor = ver & 255;
  if (tipo !== 0xffff) throw new Error('no es un pixel shader');
  if (mayor < 2) throw new Error('ps_' + mayor + '_' + menor + ' (sólo ps_2 y ps_3)');
  const ps3 = mayor >= 3;
  const temps = new Set(), defs = new Map(), defsI = new Map(), defsB = new Map(), samplers = new Map(), entradas = new Map(), usosC = new Set();
  let usaPos = false, usaFace = false, usaPred = false, usaAL = false, usaA0 = false, maxC = -1;
  const out = []; let sangr = 1, i = 1, profLoop = 0;
  const emit = (s) => out.push('  '.repeat(sangr) + s);
  const f = (x) => { if (!isFinite(x)) return x > 0 ? '3.4e38' : x < 0 ? '-3.4e38' : '0.0'; let s = String(x); if (!/[.eE]/.test(s)) s += '.0'; return s; };
  const SW = 'xyzw';
  // un parámetro (destino o fuente) y su registro
  const reg = (t) => ((t >> 28) & 7) | ((t >> 8) & 0x18), num = (t) => t & 0x7ff;
  const nombreReg = (rt, n, rel) => {
    switch (rt) {
      case 0: temps.add(n); return 'r' + n;
      case 1: if (ps3) { entradas.set(n, entradas.get(n) || { uso: 'texcoord', idx: n }); return 'v' + n; } entradas.set('c' + n, { uso: 'color', idx: n }); return 'vc' + n;
      case 2: case 11: case 12: case 13: { const base = n + (rt === 11 ? 2048 : rt === 12 ? 4096 : rt === 13 ? 6144 : 0); if (rel) return 'C[' + rel + ' + ' + base + ']'; usosC.add(base); if (base > maxC) maxC = base; return defs.has(base) ? 'k' + base : 'C[' + base + ']'; }
      case 3: entradas.set('t' + n, { uso: 'texcoord', idx: n }); return 't' + n;   // (ps_2: coordenadas de textura)
      case 7: return defsI.has(n) ? 'ki' + n : 'I[' + n + ']';
      case 8: return 'oC' + n;
      case 9: return 'oDepth';
      case 10: samplers.set(n, samplers.get(n) || 2); return 's' + n;
      case 14: return defsB.has(n) ? 'kb' + n : 'B[' + n + ']';
      case 15: usaAL = true; return 'aL';
      case 17: if (n === 0) { usaPos = true; return 'vPos'; } usaFace = true; return 'vFace';
      case 19: usaPred = true; return 'p0';
      default: throw new Error('registro de tipo ' + rt);
    }
  };
  // la fuente con su swizzle (como vec4) y su modificador
  const fuente = (k) => {
    const t = code[i + k]; let rel = null, extra = 0;
    if (t & 0x2000) {   // (direccionamiento relativo: c[a0.x + n] o c[aL + n])
      const a = code[i + k + 1]; extra = 1; const ar = reg(a); const comp = SW[(a >> 16) & 3];
      if (ar === 15) { usaAL = true; rel = 'int(aL)'; } else { usaA0 = true; rel = 'int(a0.' + comp + ')'; }
    }
    const rt = reg(t), n = num(t), base = nombreReg(rt, n, rel);
    const s = (t >> 16) & 255, sw = SW[s & 3] + SW[(s >> 2) & 3] + SW[(s >> 4) & 3] + SW[(s >> 6) & 3];
    let e;
    if (rt === 14) e = 'vec4(' + base + ' ? 1.0 : 0.0)';
    else if (rt === 7) e = 'vec4(' + base + ')' + (sw === 'xyzw' ? '' : '.' + sw);
    else if (rt === 15) e = 'vec4(aL)';
    else if (rt === 17 && n === 1) e = 'vec4(vFace)';
    else if (rt === 19) e = 'vec4(p0)' + (sw === 'xyzw' ? '' : '.' + sw);
    else e = base + (sw === 'xyzw' ? '' : '.' + sw);
    switch ((t >> 24) & 15) {
      case 1: e = '(-' + e + ')'; break;
      case 2: e = '(' + e + ' - 0.5)'; break;
      case 3: e = '(-(' + e + ' - 0.5))'; break;
      case 4: e = '(2.0 * ' + e + ' - 1.0)'; break;
      case 5: e = '(-(2.0 * ' + e + ' - 1.0))'; break;
      case 6: e = '(1.0 - ' + e + ')'; break;
      case 7: e = '(2.0 * ' + e + ')'; break;
      case 8: e = '(-2.0 * ' + e + ')'; break;
      case 9: e = '(' + e + ' / ' + e + '.zzzz)'; break;
      case 10: e = '(' + e + ' / ' + e + '.wwww)'; break;
      case 11: e = 'abs(' + e + ')'; break;
      case 12: e = '(-abs(' + e + '))'; break;
      case 13: e = '(1.0 - ' + e + ')'; break;
    }
    return { e, len: 1 + extra, rt, n };
  };
  // el destino: registro, máscara y modificadores (saturate)
  const destino = (k) => {
    const t = code[i + k], rt = reg(t), n = num(t), m = (t >> 16) & 15, mod = (t >> 20) & 15;
    let nom = nombreReg(rt, n); if (rt === 1 || rt === 3) throw new Error('escribe en una entrada');
    const mask = (m & 1 ? 'x' : '') + (m & 2 ? 'y' : '') + (m & 4 ? 'z' : '') + (m & 8 ? 'w' : '');
    return { nom, mask: mask || 'xyzw', sat: !!(mod & 1), rt, n, shift: (t >> 24) & 15 };
  };
  const vecN = (n) => (n === 1 ? 'float' : 'vec' + n);
  const asignar = (d, e4) => {
    // (e4: una expresión vec4; se toma la parte de la máscara)
    let e = d.mask === 'xyzw' ? e4 : '(' + e4 + ').' + d.mask;
    if (d.shift) { const s = d.shift >= 8 ? Math.pow(2, d.shift - 16) : Math.pow(2, d.shift); e = '(' + e + ' * ' + f(s) + ')'; }
    if (d.sat) e = 'clamp(' + e + ', 0.0, 1.0)';
    if (d.rt === 19) { emit('p0.' + d.mask + ' = ' + e + ';'); return; }
    emit(d.nom + (d.mask === 'xyzw' ? '' : '.' + d.mask) + ' = ' + e + ';');
  };
  const esc = (e) => 'vec4((' + e + '))';   // (un escalar repetido en las 4)
  const uvTex = (e, dim) => (dim === 2 ? 'vec2((' + e + ').x, 1.0 - (' + e + ').y)' : '(' + e + ').xyz');
  const sampler = (src) => { const dim = samplers.get(src.n) || 2; return { dim, nom: 's' + src.n }; };
  // primera pasada: def, defi, defb y dcl (para saber tipos antes de traducir)
  for (let j = 1; j < code.length;) {
    const t = code[j]; if (t === 0x0000ffff) break;
    const op = t & 0xffff;
    if (op === 0xfffe) { j += 1 + ((t >> 16) & 0x7fff); continue; }
    const len = ps3 || mayor >= 2 ? (t >> 24) & 15 : 0;
    if (op === 81) { const d = code[j + 1], n = num(d) + (reg(d) === 11 ? 2048 : 0); const fl = new Float32Array(code.buffer.slice(code.byteOffset + (j + 2) * 4, code.byteOffset + (j + 6) * 4)); defs.set(n, [...fl]); }
    else if (op === 48) { const n = num(code[j + 1]); defsI.set(n, [code[j + 2] | 0, code[j + 3] | 0, code[j + 4] | 0, code[j + 5] | 0]); }
    else if (op === 47) { defsB.set(num(code[j + 1]), !!code[j + 2]); }
    else if (op === 31) {
      const dcl = code[j + 1], d = code[j + 2], rt = reg(d), n = num(d);
      if (rt === 10) samplers.set(n, (dcl >> 27) & 15);
      else if (rt === 1 && ps3) entradas.set(n, { uso: ['position', 'blendweight', 'blendindices', 'normal', 'psize', 'texcoord', 'tangent', 'binormal', 'tessfactor', 'positiont', 'color', 'fog', 'depth', 'sample'][dcl & 31] || 'texcoord', idx: (dcl >> 16) & 15 });
    }
    j += 1 + len;
  }
  // segunda pasada: las instrucciones
  const pila = [];
  for (; i < code.length;) {
    const t = code[i]; if (t === 0x0000ffff) break;
    const op = t & 0xffff;
    if (op === 0xfffe) { i += 1 + ((t >> 16) & 0x7fff); continue; }
    const len = (t >> 24) & 15, ctl = (t >> 16) & 255, nom = DX9_OP[op];
    if (t & 0x10000000) throw new Error('instrucción con predicado');
    const S = (k) => fuente(k).e;
    switch (nom) {
      case 'nop': case 'dcl': case 'def': case 'defi': case 'defb': case 'ret': break;
      case 'mov': { const d = destino(1); asignar(d, S(2)); break; }
      case 'add': { const d = destino(1); asignar(d, S(2) + ' + ' + S(3)); break; }
      case 'sub': { const d = destino(1); asignar(d, S(2) + ' - ' + S(3)); break; }
      case 'mul': { const d = destino(1); asignar(d, S(2) + ' * ' + S(3)); break; }
      case 'mad': { const d = destino(1); asignar(d, S(2) + ' * ' + S(3) + ' + ' + S(4)); break; }
      case 'min': { const d = destino(1); asignar(d, 'min(' + S(2) + ', ' + S(3) + ')'); break; }
      case 'max': { const d = destino(1); asignar(d, 'max(' + S(2) + ', ' + S(3) + ')'); break; }
      case 'slt': { const d = destino(1); asignar(d, 'vec4(lessThan(' + S(2) + ', ' + S(3) + '))'); break; }
      case 'sge': { const d = destino(1); asignar(d, 'vec4(greaterThanEqual(' + S(2) + ', ' + S(3) + '))'); break; }
      case 'rcp': { const d = destino(1); asignar(d, esc('dx9Rcp((' + S(2) + ').x)')); break; }
      case 'rsq': { const d = destino(1); asignar(d, esc('dx9Rsq((' + S(2) + ').x)')); break; }
      case 'exp': case 'expp': { const d = destino(1); asignar(d, esc('exp2((' + S(2) + ').x)')); break; }
      case 'log': case 'logp': { const d = destino(1); asignar(d, esc('dx9Log((' + S(2) + ').x)')); break; }
      case 'pow': { const d = destino(1); asignar(d, esc('pow(abs((' + S(2) + ').x), (' + S(3) + ').x)')); break; }
      case 'frc': { const d = destino(1); asignar(d, 'fract(' + S(2) + ')'); break; }
      case 'abs': { const d = destino(1); asignar(d, 'abs(' + S(2) + ')'); break; }
      case 'sgn': { const d = destino(1); asignar(d, 'sign(' + S(2) + ')'); break; }
      case 'dp3': { const d = destino(1); asignar(d, esc('dot((' + S(2) + ').xyz, (' + S(3) + ').xyz)')); break; }
      case 'dp4': { const d = destino(1); asignar(d, esc('dot(' + S(2) + ', ' + S(3) + ')')); break; }
      case 'dp2add': { const d = destino(1); asignar(d, esc('dot((' + S(2) + ').xy, (' + S(3) + ').xy) + (' + S(4) + ').x')); break; }
      case 'lrp': { const d = destino(1); asignar(d, 'mix(' + S(4) + ', ' + S(3) + ', ' + S(2) + ')'); break; }
      case 'cmp': { const d = destino(1); asignar(d, 'mix(' + S(4) + ', ' + S(3) + ', vec4(greaterThanEqual(' + S(2) + ', vec4(0.0))))'); break; }
      case 'cnd': { const d = destino(1); asignar(d, 'mix(' + S(4) + ', ' + S(3) + ', vec4(greaterThan(' + S(2) + ', vec4(0.5))))'); break; }
      case 'nrm': { const d = destino(1); asignar(d, 'vec4(normalize((' + S(2) + ').xyz), 0.0)'); break; }
      case 'crs': { const d = destino(1); asignar(d, 'vec4(cross((' + S(2) + ').xyz, (' + S(3) + ').xyz), 0.0)'); break; }
      case 'sincos': { const d = destino(1); const a = '(' + S(2) + ').x'; asignar(d, 'vec4(cos(' + a + '), sin(' + a + '), 0.0, 0.0)'); break; }
      case 'dsx': { const d = destino(1); asignar(d, 'dFdx(' + S(2) + ')'); break; }
      case 'dsy': { const d = destino(1); asignar(d, '(-dFdy(' + S(2) + '))'); break; }   // (y para abajo en DirectX)
      case 'lit': { const d = destino(1); const s = S(2); asignar(d, 'dx9Lit(' + s + ')'); break; }
      case 'dst': { const d = destino(1); const a = S(2), b = S(3); asignar(d, 'vec4(1.0, (' + a + ').y * (' + b + ').y, (' + a + ').z, (' + b + ').w)'); break; }
      case 'm4x4': case 'm4x3': case 'm3x4': case 'm3x3': case 'm3x2': {
        const d = destino(1), a = fuente(2), mt = code[i + 2 + a.len], n0 = num(mt), filas = +nom[3], cols4 = nom[1] === '4';
        const comps = [];
        for (let k = 0; k < filas; k++) { const c = nombreReg(reg(mt), n0 + k); comps.push(cols4 ? 'dot(' + a.e + ', ' + c + ')' : 'dot((' + a.e + ').xyz, (' + c + ').xyz)'); }
        while (comps.length < 4) comps.push('0.0');
        asignar(d, 'vec4(' + comps.join(', ') + ')'); break;
      }
      case 'texkill': { const d = code[i + 1], n = nombreReg(reg(d), num(d)); emit('if (any(lessThan((' + n + ').xyz, vec3(0.0)))) discard;'); break; }
      case 'texld': case 'texldl': case 'texldd': {
        const d = destino(1); let a, s;
        if (ps3 || mayor >= 2) { a = fuente(2); s = fuente(2 + a.len); } else throw new Error('texld de ps_1');
        const sm = sampler(s), uv = uvTex(a.e, sm.dim), tsw = (s.e.match(/\.(\w{4})$/) || [])[1];
        let e;
        if (nom === 'texldl') e = 'textureLod(' + sm.nom + ', ' + uv + ', (' + a.e + ').w)';
        else if (nom === 'texldd') { const gx = fuente(2 + a.len + s.len), gy = fuente(2 + a.len + s.len + gx.len); e = 'textureGrad(' + sm.nom + ', ' + uv + ', (' + gx.e + ').xy, -(' + gy.e + ').xy)'; }
        else if (ctl & 1) e = sm.dim === 2 ? 'texture(' + sm.nom + ', vec2((' + a.e + ').x / (' + a.e + ').w, 1.0 - (' + a.e + ').y / (' + a.e + ').w))' : 'texture(' + sm.nom + ', (' + a.e + ').xyz / (' + a.e + ').w)';
        else if (ctl & 2) e = 'texture(' + sm.nom + ', ' + uv + ', (' + a.e + ').w)';
        else e = 'texture(' + sm.nom + ', ' + uv + ')';
        e = 'dx9Lee' + s.n + '(' + e + ')';
        if (tsw && tsw !== 'xyzw') e = '(' + e + ').' + tsw;
        asignar(d, e); break;
      }
      case 'texcoord': throw new Error('texcoord de ps_1');
      case 'setp': { const d = destino(1); usaPred = true; const c = { 1: 'greaterThan', 2: 'equal', 3: 'greaterThanEqual', 4: 'lessThan', 5: 'notEqual', 6: 'lessThanEqual' }[ctl]; emit('p0.' + d.mask + ' = (' + c + '(' + S(2) + ', ' + S(3) + ')).' + d.mask + ';'); break; }
      case 'if': { const s = fuente(1); if (s.rt === 19) emit('if (p0.' + ((s.e.match(/\.(\w)/) || [, 'x'])[1]) + ') {'); else emit('if (' + nombreReg(s.rt, s.n) + ') {'); sangr++; pila.push('if'); break; }
      case 'ifc': { emit('if ((' + S(1) + ').x ' + DX9_CMP[ctl] + ' (' + S(2) + ').x) {'); sangr++; pila.push('if'); break; }
      case 'else': sangr--; emit('} else {'); sangr++; break;
      case 'endif': sangr--; emit('}'); pila.pop(); break;
      // (rep i#: el contador entero tal cual; con tope de 255 vueltas, como DirectX)
      case 'rep': { const t1 = code[i + 1], s = nombreReg(reg(t1), num(t1)), k = 'k' + profLoop++; emit('for (int ' + k + ' = 0; ' + k + ' < ' + s + '.x && ' + k + ' < 255; ' + k + '++) {'); sangr++; pila.push('rep'); break; }
      case 'endrep': sangr--; emit('}'); pila.pop(); profLoop--; break;
      case 'loop': { usaAL = true; const t2 = code[i + 2], s = nombreReg(reg(t2), num(t2)), k = 'k' + profLoop++; emit('aL = float(' + s + '.y);'); emit('for (int ' + k + ' = 0; ' + k + ' < ' + s + '.x && ' + k + ' < 255; ' + k + '++, aL += float(' + s + '.z)) {'); sangr++; pila.push('loop'); break; }
      case 'endloop': sangr--; emit('}'); pila.pop(); profLoop--; break;
      case 'break': emit('break;'); break;
      case 'breakc': emit('if ((' + S(1) + ').x ' + DX9_CMP[ctl] + ' (' + S(2) + ').x) break;'); break;
      case 'breakp': { const s = fuente(1); emit('if (' + s.e.replace(/^vec4\(p0\)/, 'p0') + ') break;'); break; }
      case 'mova': { usaA0 = true; const d = destino(1); emit('a0.' + d.mask + ' = (round(' + S(2) + ')).' + d.mask + ';'); break; }
      default: throw new Error('instrucción ' + (nom || op) + ' sin traducir');
    }
    i += 1 + len;
  }
  // el encabezado: entradas, constantes, samplers y ayudas
  const H = ['#version 300 es', 'precision highp float;', 'precision highp int;', 'precision highp sampler2D;', 'precision highp samplerCube;', 'precision highp sampler3D;'];
  const ins = [...entradas.values()];
  H.push('in vec4 vTex[4];');
  for (const [k, e] of entradas) {
    const nomV = typeof k === 'number' ? 'v' + k : k === 'vc0' || /^c/.test(k) ? 'vc' + e.idx : k;
    if (e.uso === 'texcoord') H.push('#define ' + (typeof k === 'number' ? 'v' + k : k) + ' vTex[' + Math.min(3, e.idx) + ']');
    else if (e.uso === 'color') H.push('#define ' + (typeof k === 'number' ? 'v' + k : 'vc' + e.idx) + ' vec4(1.0)');
    else H.push('#define ' + nomV + ' vec4(0.0)');
  }
  H.push('uniform vec4 C[' + Math.max(32, Math.min(224, maxC + 1)) + '];', 'uniform ivec4 I[16];', 'uniform bool B[16];', 'uniform vec2 uTam;', 'uniform vec4 uSrgb;', 'uniform float uSrgbOut;');
  for (const [n, v] of defs) H.push('const vec4 k' + n + ' = vec4(' + v.map(f).join(', ') + ');');
  for (const [n, v] of defsI) H.push('const ivec4 ki' + n + ' = ivec4(' + v.join(', ') + ');');
  for (const [n, v] of defsB) H.push('const bool kb' + n + ' = ' + (v ? 'true' : 'false') + ';');
  for (const [n, dim] of samplers) H.push('uniform ' + (dim === 3 ? 'samplerCube' : dim === 4 ? 'sampler3D' : 'sampler2D') + ' s' + n + ';');
  H.push('out vec4 oC0;');
  const fns = 'vec3 dx9Lin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }\n' +
    'vec3 dx9Srgb(vec3 c) { c = max(c, vec3(0.0)); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }\n' +
    'float dx9Rcp(float x) { return x == 0.0 ? 3.4e38 : 1.0 / x; }\nfloat dx9Rsq(float x) { x = abs(x); return x == 0.0 ? 3.4e38 : inversesqrt(x); }\n' +
    'float dx9Log(float x) { x = abs(x); return x == 0.0 ? -3.4e38 : log2(x); }\n' +
    'vec4 dx9Lit(vec4 s) { float d = max(s.x, 0.0); return vec4(1.0, d, s.x > 0.0 ? pow(max(s.y, 0.0), clamp(s.w, -127.9961, 127.9961)) : 0.0, 1.0); }' +
    // (la lectura sRGB de Source —$linearread_* en 0—: la textura se pasa a lineal al leerla)
    [...samplers.keys()].map((n) => '\nvec4 dx9Lee' + n + '(vec4 c) { return uSrgb[' + Math.min(3, n) + '] > 0.5 ? vec4(dx9Lin(c.rgb), c.a) : c; }').join('');
  // (vPos de DirectX 9: el píxel, con el (0,0) arriba a la izquierda y el centro en el entero)
  const cuerpo = ['void main() {', '  oC0 = vec4(0.0);'];
  for (const n of [...temps].sort((a, b) => a - b)) cuerpo.push('  vec4 r' + n + ' = vec4(0.0);');
  if (usaPos) cuerpo.push('  vec4 vPos = vec4(gl_FragCoord.x - 0.5, uTam.y - gl_FragCoord.y - 0.5, 0.0, 0.0);');
  if (usaFace) cuerpo.push('  float vFace = gl_FrontFacing ? 1.0 : -1.0;');
  if (usaPred) cuerpo.push('  bvec4 p0 = bvec4(false);');
  if (usaAL) cuerpo.push('  float aL = 0.0;');
  if (usaA0) cuerpo.push('  vec4 a0 = vec4(0.0);');
  const fin = ['  if (uSrgbOut > 0.5) oC0.rgb = dx9Srgb(oC0.rgb);', '}'];
  return { fs: H.join('\n') + '\n' + fns + '\n' + cuerpo.join('\n') + '\n' + out.join('\n') + '\n' + fin.join('\n'), samplers: [...samplers.keys()], ps3, ver: mayor + '_' + menor, constMax: maxC };
}
// el vertex shader de las pasadas de pantalla (screenspace_vs20): un cuadrado que cubre el rectángulo pedido y la
// coordenada de textura de DirectX en las 4 entradas
const DX9_VS = '#version 300 es\nin vec2 aP;\nuniform vec4 uRect;\nuniform vec4 uUV;\nout vec4 vTex[4];\nvoid main() { vec2 p = uRect.xy + aP * uRect.zw; gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0); vec2 uv = uUV.zw == vec2(0.0) ? aP : mix(uUV.xy, uUV.zw, aP); vec4 t = vec4(uv, 0.0, 1.0); vTex[0] = t; vTex[1] = t; vTex[2] = t; vTex[3] = t; }';
