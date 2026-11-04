// ---------------- Lua de Garry's Mod, hecho acá ----------------
// Un Lua 5.1 (el de GMod, LuaJIT) con la sintaxis que agrega GMod: != && || ! // /* */ continue. El código de cada
// archivo se traduce a JavaScript (rápido) y corre aislado: sólo ve lo que le damos (las tablas de Lua y la API de GMod),
// no la página ni el juego; un tope de pasos por llamada corta los bucles infinitos. Valores: nil = undefined, números,
// textos y booleanos de JS, tablas = LuaTable, funciones = funciones de JS que devuelven un arreglo (los valores de
// retorno), "userdata" = objetos de JS con __mt (su metatabla: Vector, Angle, Entity...).

class LuaTable {
  constructor() { this.h = new Map(); this.a = []; this.mt = null; }
  get(k) {
    if (typeof k === 'number') { if (k >= 1 && k <= this.a.length && (k | 0) === k) return this.a[k - 1]; if (k === 0) k = 0; }
    return this.h.get(k);
  }
  set(k, v) {
    if (typeof k === 'number') {
      if (k !== k) throw new LuaError('table index is NaN');
      const a = this.a;
      if ((k | 0) === k && k >= 1) {
        if (k <= a.length) { a[k - 1] = v; if (v === undefined && k === a.length) { while (a.length && a[a.length - 1] === undefined) a.pop(); } return; }
        if (k === a.length + 1) {
          if (v === undefined) { this.h.delete(k); return; }
          a.push(v); this.h.delete(k);
          // (lo que estaba en la parte de hash a continuación pasa al arreglo)
          if (this.h.size) { let n = a.length + 1, x; while ((x = this.h.get(n)) !== undefined) { a.push(x); this.h.delete(n); n++; } }
          return;
        }
      }
      if (k === 0) k = 0;
    } else if (k === undefined) throw new LuaError('table index is nil');
    if (v === undefined) this.h.delete(k); else this.h.set(k, v);
  }
  len() { return this.a.length; }
  // las claves en orden (primero el arreglo)
  claves() { const L = []; for (let i = 0; i < this.a.length; i++) if (this.a[i] !== undefined) L.push(i + 1); for (const k of this.h.keys()) L.push(k); return L; }
}
class LuaError extends Error { constructor(v, nivel) { super(typeof v === 'string' ? v : 'error'); this.v = v; this.nivel = nivel; } }
const E0 = Object.freeze([]);

// ---------------- léxico ----------------
const LUA_PAL = new Set(['and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while', 'continue']);
function luaLexico(src, archivo) {
  const T = []; let i = 0, ln = 1; const n = src.length;
  const err = (m) => { throw new LuaError(archivo + ':' + ln + ': ' + m); };
  const largo = (j) => { // [[ ]] o [==[ ]==]; j apunta al '['
    let k = j + 1, eq = 0; while (src[k] === '=') { eq++; k++; } if (src[k] !== '[') return null;
    const cierre = ']' + '='.repeat(eq) + ']'; let s = k + 1; if (src[s] === '\r') s++; if (src[s] === '\n') s++;
    const e = src.indexOf(cierre, s); if (e < 0) err('cadena larga sin cerrar');
    for (let q = j; q < e; q++) if (src[q] === '\n') ln++;
    return { v: src.slice(s, e), fin: e + cierre.length };
  };
  const at = (k) => (k < n ? src[k] : '');   // (fuera del texto: '' y no undefined, que /[uUlLi]/ lee como "undefined")
  while (i < n) {
    const c = src[i];
    if (c === '\n') { ln++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v' || c === '﻿') { i++; continue; }
    if (c === '-' && src[i + 1] === '-') {
      if (src[i + 2] === '[') { const L = largo(i + 2); if (L) { i = L.fin; continue; } }
      while (i < n && src[i] !== '\n') i++; continue;
    }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const f = e < 0 ? n : e + 2; for (let q = i; q < f; q++) if (src[q] === '\n') ln++; i = f; continue; }
    if (i === 0 && c === '#' && src[1] === '!') { while (i < n && src[i] !== '\n') i++; continue; }
    const l0 = ln;
    if (/[A-Za-z_]/.test(c) || c.charCodeAt(0) > 127) {
      let j = i + 1; while (j < n && (/[A-Za-z0-9_]/.test(at(j)) || src.charCodeAt(j) > 127)) j++;
      const w = src.slice(i, j); T.push(LUA_PAL.has(w) ? { t: w, ln: l0 } : { t: 'nom', v: w, ln: l0 }); i = j; continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(at(i + 1)))) {
      let j = i, v;
      if (c === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X')) { j = i + 2; while (j < n && /[0-9a-fA-F.]/.test(at(j))) j++; const s = src.slice(i + 2, j); const [ip, fp] = s.split('.'); v = parseInt(ip || '0', 16); if (fp) v += parseInt(fp, 16) / 16 ** fp.length; if (/[pP]/.test(at(j))) { j++; let e = j; if (/[+-]/.test(at(e))) e++; while (/[0-9]/.test(at(e))) e++; v *= 2 ** +src.slice(j, e); j = e; } }
      else { while (j < n && /[0-9.]/.test(at(j))) j++; if (/[eE]/.test(at(j))) { j++; if (/[+-]/.test(at(j))) j++; while (/[0-9]/.test(at(j))) j++; } v = Number(src.slice(i, j)); if (!Number.isFinite(v) && src.slice(i, j) !== 'inf') err('número malo ' + src.slice(i, j)); }
      while (/[uUlLi]/.test(at(j))) j++;   // (LuaJIT: 1LL, 1ULL, 1i)
      T.push({ t: 'num', v, ln: l0 }); i = j; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, s = '';
      while (j < n && src[j] !== c) {
        let ch = src[j];
        if (ch === '\n') err('cadena sin cerrar');
        if (ch === '\\') {
          j++; ch = src[j];
          const m = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', f: '\f', v: '\v', '\\': '\\', '"': '"', "'": "'", '\n': '\n', '[': '[', ']': ']' }[ch];
          if (m !== undefined) { if (ch === '\n') ln++; s += m; j++; continue; }
          if (ch === 'x') { s += String.fromCharCode(parseInt(src.substr(j + 1, 2), 16)); j += 3; continue; }
          if (ch === 'z') { j++; while (j < n && /\s/.test(at(j))) { if (src[j] === '\n') ln++; j++; } continue; }
          if (ch === 'u' && src[j + 1] === '{') { const e = src.indexOf('}', j); s += String.fromCodePoint(parseInt(src.slice(j + 2, e), 16)); j = e + 1; continue; }
          if (/[0-9]/.test(ch)) { let k = j; while (k < j + 3 && /[0-9]/.test(at(k))) k++; s += String.fromCharCode(+src.slice(j, k) & 255); j = k; continue; }
          s += ch; j++; continue;
        }
        s += ch; j++;
      }
      if (j >= n) err('cadena sin cerrar');
      T.push({ t: 'str', v: s, ln: l0 }); i = j + 1; continue;
    }
    if (c === '[' && (src[i + 1] === '[' || src[i + 1] === '=')) { const L = largo(i); if (L) { T.push({ t: 'str', v: L.v, ln: l0 }); i = L.fin; continue; } }
    const tres = src.substr(i, 3), dos = src.substr(i, 2);
    if (tres === '...') { T.push({ t: '...', ln: l0 }); i += 3; continue; }
    if (['==', '~=', '<=', '>=', '..', '::', '!=', '&&', '||'].includes(dos)) { T.push({ t: dos === '!=' ? '~=' : dos === '&&' ? 'and' : dos === '||' ? 'or' : dos, ln: l0 }); i += 2; continue; }
    if ('+-*/%^#<>=(){}[];:,.'.includes(c)) { T.push({ t: c, ln: l0 }); i++; continue; }
    if (c === '!') { T.push({ t: 'not', ln: l0 }); i++; continue; }
    if (c === '&' || c === '|' || c === '~') err('operador ' + c + ' no existe en Lua 5.1');
    err('caracter raro ' + JSON.stringify(c));
  }
  T.push({ t: 'eof', ln });
  return T;
}

// ---------------- sintaxis → árbol ----------------
const LUA_PRI = { or: [1, 1], and: [2, 2], '<': [3, 3], '>': [3, 3], '<=': [3, 3], '>=': [3, 3], '~=': [3, 3], '==': [3, 3], '..': [5, 4], '+': [6, 6], '-': [6, 6], '*': [7, 7], '/': [7, 7], '%': [7, 7], '^': [10, 9] };
function luaParsear(T, archivo) {
  let p = 0;
  const ver = () => T[p], tipo = () => T[p].t, sig = () => T[p++];
  const err = (m) => { throw new LuaError(archivo + ':' + T[p].ln + ': ' + m + ' cerca de ' + (T[p].v !== undefined ? JSON.stringify(T[p].v) : "'" + T[p].t + "'")); };
  const esp = (t) => { if (T[p].t !== t) err("se esperaba '" + t + "'"); return T[p++]; };
  const opt = (t) => { if (T[p].t === t) { p++; return true; } return false; };
  const fin = () => ['else', 'elseif', 'end', 'until', 'eof'].includes(tipo());
  function bloque() {
    const L = [];
    while (!fin()) {
      if (tipo() === 'return') { const ln = sig().ln; const ex = fin() || tipo() === ';' ? [] : explist(); opt(';'); L.push({ k: 'return', ex, ln }); break; }
      const s = sentencia(); if (s) L.push(s);
    }
    return L;
  }
  function sentencia() {
    const ln = ver().ln;
    switch (tipo()) {
      case ';': p++; return null;
      case 'if': {
        p++; const ramas = []; let c = expr(); esp('then'); ramas.push({ c, b: bloque() });
        while (tipo() === 'elseif') { p++; c = expr(); esp('then'); ramas.push({ c, b: bloque() }); }
        let otro = null; if (opt('else')) otro = bloque(); esp('end'); return { k: 'if', ramas, otro, ln };
      }
      case 'while': { p++; const c = expr(); esp('do'); const b = bloque(); esp('end'); return { k: 'while', c, b, ln }; }
      case 'do': { p++; const b = bloque(); esp('end'); return { k: 'do', b, ln }; }
      case 'for': {
        p++; const n1 = esp('nom').v;
        if (opt('=')) { const a = expr(); esp(','); const b = expr(); const c = opt(',') ? expr() : null; esp('do'); const cu = bloque(); esp('end'); return { k: 'fornum', v: n1, a, b, c, cu, ln }; }
        const ns = [n1]; while (opt(',')) ns.push(esp('nom').v); esp('in'); const ex = explist(); esp('do'); const cu = bloque(); esp('end'); return { k: 'forin', ns, ex, cu, ln };
      }
      case 'repeat': { p++; const b = bloque(); esp('until'); const c = expr(); return { k: 'repeat', b, c, ln }; }
      case 'function': {
        p++; let n = { k: 'var', n: esp('nom').v }, met = false;
        while (tipo() === '.' || tipo() === ':') { const d = sig().t; const k = esp('nom').v; n = { k: 'idx', o: n, i: { k: 'str', v: k } }; if (d === ':') { met = true; break; } }
        const f = cuerpo(met, ln); return { k: 'asig', izq: [n], der: [f], ln };
      }
      case 'local': {
        p++;
        if (opt('function')) { const nm = esp('nom').v; const f = cuerpo(false, ln); return { k: 'localf', n: nm, f, ln }; }
        const ns = [esp('nom').v]; while (opt(',')) ns.push(esp('nom').v);
        // (atributos de 5.4 como <const>: se ignoran)
        const ex = opt('=') ? explist() : []; return { k: 'local', ns, ex, ln };
      }
      case 'return': err('return en medio del bloque'); break;
      case 'break': p++; return { k: 'break', ln };
      case 'continue': p++; return { k: 'continue', ln };
      case 'goto': { p++; const l = tipo() === 'continue' ? (p++, 'continue') : esp('nom').v; return { k: 'goto', l, ln }; }
      case '::': { p++; const l = tipo() === 'continue' ? (p++, 'continue') : esp('nom').v; esp('::'); return { k: 'label', l, ln }; }
    }
    // asignación o llamada
    const e = sufijo();
    if (tipo() === '=' || tipo() === ',') {
      const izq = [e]; while (opt(',')) izq.push(sufijo());
      esp('='); const der = explist();
      for (const x of izq) if (x.k !== 'var' && x.k !== 'idx') err('no se puede asignar');
      return { k: 'asig', izq, der, ln };
    }
    if (e.k !== 'call' && e.k !== 'mcall') err('sentencia rara');
    return { k: 'expr', e, ln };
  }
  function cuerpo(met, ln) {
    esp('('); const ps = met ? ['self'] : []; let va = false;
    if (tipo() !== ')') { do { if (tipo() === '...') { p++; va = true; break; } ps.push(esp('nom').v); } while (opt(',')); }
    esp(')'); const b = bloque(); esp('end'); return { k: 'func', ps, va, b, ln };
  }
  function explist() { const L = [expr()]; while (opt(',')) L.push(expr()); return L; }
  function primario() {
    if (tipo() === 'nom') return { k: 'var', n: sig().v };
    if (opt('(')) { const e = expr(); esp(')'); return { k: 'paren', e }; }
    err('expresión rara');
  }
  function sufijo() {
    let e = primario();
    for (;;) {
      const t = tipo();
      if (t === '.') { p++; e = { k: 'idx', o: e, i: { k: 'str', v: esp('nom').v } }; }
      else if (t === '[') { p++; const i = expr(); esp(']'); e = { k: 'idx', o: e, i }; }
      else if (t === ':') { p++; const m = esp('nom').v; const a = args(); e = { k: 'mcall', o: e, m, a, ln: T[p - 1].ln }; }
      else if (t === '(' || t === 'str' || t === '{') { e = { k: 'call', f: e, a: args(), ln: T[p].ln }; }
      else return e;
    }
  }
  function args() {
    if (tipo() === 'str') return [{ k: 'str', v: sig().v }];
    if (tipo() === '{') return [tabla()];
    esp('('); if (opt(')')) return []; const L = explist(); esp(')'); return L;
  }
  function tabla() {
    esp('{'); const items = [];
    while (tipo() !== '}') {
      if (tipo() === '[') { p++; const k = expr(); esp(']'); esp('='); items.push({ k, v: expr() }); }
      else if (tipo() === 'nom' && T[p + 1].t === '=') { const k = { k: 'str', v: sig().v }; p++; items.push({ k, v: expr() }); }
      else items.push({ v: expr() });
      if (!opt(',') && !opt(';')) break;
    }
    esp('}'); return { k: 'tabla', items };
  }
  function simple() {
    const t = tipo();
    if (t === 'num') return { k: 'num', v: sig().v };
    if (t === 'str') return { k: 'str', v: sig().v };
    if (t === 'nil') { p++; return { k: 'nil' }; }
    if (t === 'true') { p++; return { k: 'true' }; }
    if (t === 'false') { p++; return { k: 'false' }; }
    if (t === '...') { p++; return { k: 'va' }; }
    if (t === '{') return tabla();
    if (t === 'function') { const ln = sig().ln; return cuerpo(false, ln); }
    return sufijo();
  }
  function expr(lim = 0) {
    let e;
    if (tipo() === 'not' || tipo() === '-' || tipo() === '#') { const op = sig().t; e = { k: 'un', op, e: expr(8) }; }
    else e = simple();
    for (;;) {
      const op = tipo(), pr = LUA_PRI[op];
      if (!pr || pr[0] <= lim) return e;
      p++; const d = expr(pr[1]); e = { k: 'bin', op, a: e, b: d };
    }
  }
  const b = bloque(); if (tipo() !== 'eof') err("se esperaba fin del archivo");
  return b;
}

// ---------------- árbol → JavaScript ----------------
const JS_RES = new Set('abstract arguments await boolean break byte case catch char class const continue debugger default delete do double else enum eval export extends false final finally float for function goto if implements import in instanceof int interface let long native new null package private protected public return short static super switch synchronized this throw throws transient true try typeof var void volatile while with yield undefined NaN Infinity R G'.split(' '));
function luaGenerar(arbol, archivo, fid, dual) {
  let uid = 0; const sc = [];
  // corrutinas: las funciones del archivo (y las que se pasan a coroutine.create/wrap) se escriben dos veces, normal y
  // generadora (function*): en la generadora cada llamada es yield* para que coroutine.yield pueda parar en el medio de
  // llamadas anidadas, como en Lua. Las funciones de adentro de ésas son sólo normales.
  let gen = false, prof = 0, forzar = false;   // ámbitos: Map nombre de Lua → nombre de JS
  const nuevo = (n) => { const j = (/^[A-Za-z_$][\w$]*$/.test(n) && !JS_RES.has(n) ? n : 'v') + '$' + (++uid); sc[sc.length - 1].set(n, j); return j; };
  const busca = (n) => { for (let i = sc.length - 1; i >= 0; i--) if (sc[i].has(n)) return sc[i].get(n); return null; };
  const S = JSON.stringify;
  let fn = null;   // la función que se está generando: { va }
  const lazos = [];   // los bucles abiertos: { lbl: su etiqueta de JS (para break/continue), rep, cl: la de continue del repeat }
  const gotos = [];   // las etiquetas (::nombre::) visibles: Map nombre → { js, modo: 'f' adelante | 'b' atrás }, por bloque
  // module("x", package.seeall) de Lua 5.1 arriba de todo: desde ahí las globales del archivo son las de la tabla x
  // ($M, que ven también las funciones del archivo; con package.seeall lo que no está se busca en _G)
  const esModulo = (s) => s && s.k === 'expr' && s.e && s.e.k === 'call' && s.e.f && s.e.f.k === 'var' && s.e.f.n === 'module';
  const conMod = Array.isArray(arbol) && arbol.some(esModulo);
  function exp(e) {   // una expresión → un valor
    switch (e.k) {
      case 'nil': return 'undefined';
      case 'true': return 'true';
      case 'false': return 'false';
      case 'num': return Number.isFinite(e.v) ? (e.v < 0 || Object.is(e.v, -0) ? '(' + e.v + ')' : String(e.v)) : e.v > 0 ? 'Infinity' : e.v < 0 ? '(-Infinity)' : 'NaN';
      case 'str': return S(e.v);
      case 'va': if (!fn || !fn.va) throw new LuaError(archivo + ": no se puede usar '...' fuera de una función con '...'"); return 'va[0]';
      case 'func': return funcion(e);
      case 'var': { const j = busca(e.n); return j || (conMod ? 'R.mg($M,' + S(e.n) + ')' : 'R.gg(' + S(e.n) + ')'); }
      case 'idx': return 'R.ix(' + exp(e.o) + ',' + exp(e.i) + ')';
      case 'call': case 'mcall': return llamada(e) + '[0]';
      case 'paren': return exp(e.e);
      case 'tabla': return tabla(e);
      case 'un': { const a = exp(e.e); return e.op === 'not' ? '!R.T(' + a + ')' : e.op === '-' ? 'R.neg(' + a + ')' : 'R.len(' + a + ')'; }
      case 'bin': {
        const a = exp(e.a), b = exp(e.b);
        switch (e.op) {
          case 'and': return '(R.T($t=' + a + ')?' + b + ':$t)';
          case 'or': return '(R.T($t=' + a + ')?$t:' + b + ')';
          case '+': return 'R.add(' + a + ',' + b + ')'; case '-': return 'R.sub(' + a + ',' + b + ')'; case '*': return 'R.mul(' + a + ',' + b + ')';
          case '/': return 'R.div(' + a + ',' + b + ')'; case '%': return 'R.mod(' + a + ',' + b + ')'; case '^': return 'R.pow(' + a + ',' + b + ')';
          case '..': return 'R.cat(' + a + ',' + b + ')';
          case '==': return 'R.eq(' + a + ',' + b + ')'; case '~=': return '!R.eq(' + a + ',' + b + ')';
          case '<': return 'R.lt(' + a + ',' + b + ')'; case '<=': return 'R.le(' + a + ',' + b + ')';
          case '>': return 'R.lt(' + b + ',' + a + ')'; case '>=': return 'R.le(' + b + ',' + a + ')';
        }
      }
    }
    throw new LuaError(archivo + ': expresión desconocida ' + e.k);
  }
  // varias expresiones → un arreglo de JS (la última, si es llamada o ..., se expande)
  function lista(L) {
    if (!L.length) return 'E0';
    const u = L[L.length - 1], ini = L.slice(0, -1).map(exp);
    if (u.k === 'call' || u.k === 'mcall') return ini.length ? '[' + ini.join(',') + ',...' + llamada(u) + ']' : llamada(u);
    if (u.k === 'va') { if (!fn || !fn.va) throw new LuaError(archivo + ": '...' fuera de lugar"); return ini.length ? '[' + ini.join(',') + ',...va]' : 'va'; }
    return '[' + ini.concat(exp(u)).join(',') + ']';
  }
  // argumentos de una llamada: lista para expandir con ...
  function args(L) {
    if (!L.length) return '';
    const u = L[L.length - 1], ini = L.slice(0, -1).map(exp);
    if (u.k === 'call' || u.k === 'mcall') return ini.concat('...' + llamada(u)).join(',');
    if (u.k === 'va') return ini.concat('...va').join(',');
    return ini.concat(exp(u)).join(',');
  }
  const nomDe = (e) => (e.k === 'var' ? e.n : e.k === 'idx' && e.i.k === 'str' ? e.i.v : e.k === 'mcall' ? e.m : '?');
  function llamada(e) {
    const esCo = e.k === 'call' && e.f.k === 'idx' && e.f.o.k === 'var' && e.f.o.n === 'coroutine' && e.f.i.k === 'str' && (e.f.i.v === 'create' || e.f.i.v === 'wrap');
    const f0 = forzar; if (esCo && dual) forzar = true;
    let out;
    if (e.k === 'mcall') out = (gen ? '(yield* R.mcy(' : 'R.mc(') + exp(e.o) + ',' + S(e.m) + (e.a.length ? ',' + args(e.a) : '') + (gen ? '))' : ')');
    else out = (gen ? '(yield* R.cy(' : 'R.c(') + exp(e.f) + ',' + S(nomDe(e.f)) + (e.a.length ? ',' + args(e.a) : '') + (gen ? '))' : ')');
    forzar = f0; return out;
  }
  function tabla(e) {
    if (!e.items.length) return 'new LuaTable()';
    const pos = [], kv = [];
    e.items.forEach((it, i) => {
      if (it.k) kv.push('[' + exp(it.k) + ',' + exp(it.v) + ']');
      else if (i === e.items.length - 1 && (it.v.k === 'call' || it.v.k === 'mcall' || it.v.k === 'va')) pos.push('...' + (it.v.k === 'va' ? 'va' : llamada(it.v)));
      else pos.push(exp(it.v));
    });
    return 'R.tab([' + pos.join(',') + ']' + (kv.length ? ',[' + kv.join(',') + ']' : '') + ')';
  }
  function funcion(f) {
    const doble = dual && (prof === 0 || forzar), gen0 = gen, f0 = forzar; forzar = false; prof++;
    const una = (g) => {
      const fn0 = fn; fn = { va: f.va }; sc.push(new Map()); gen = g;
      const ps = f.ps.map(nuevo);
      const lz0 = lazos.splice(0), go0 = gotos.splice(0);   // (ni los bucles ni las etiquetas cruzan una función)
      const cuerpo = bloque(f.b, false);
      lazos.push(...lz0); gotos.push(...go0);
      sc.pop(); fn = fn0;
      return '(function' + (g ? '*' : '') + '(' + ps.concat(f.va ? ['...va'] : []).join(',') + '){let $t;if(++R.n>R.lim)R.largo();' + cuerpo + 'return E0;})';
    };
    const normal = una(false), out = doble ? 'R.fn(' + normal + ',' + una(true) + ')' : normal;
    prof--; gen = gen0; forzar = f0; return out;
  }
  function bloque(L, abre = true) {
    if (abre) sc.push(new Map());
    let out = '';
    if (L.some((x) => x.k === 'label')) out = conEtiquetas(L);
    else for (const s of L) out += sent(s);
    if (abre) sc.pop();
    return out;
  }
  // goto de Lua 5.2 (el de LuaJIT, que usan muchos addons: «goto continue», «goto skip», salir de dos bucles, volver a
  // empezar). JavaScript no tiene goto, pero sí bloques y bucles con etiqueta: un goto hacia adelante es «break» de un
  // bloque que va desde el primer goto hasta la etiqueta; uno hacia atrás, «continue» de un for(;;) que va desde la
  // etiqueta hasta el final del bloque. Como en Lua, sirve desde bloques de adentro (un if, otro bucle), no desde otra
  // función. (Las variables locales de antes del primer goto quedan afuera del bloque: se siguen viendo después)
  const subBloques = (s) => s.k === 'do' || s.k === 'while' || s.k === 'repeat' ? [s.b] : s.k === 'fornum' || s.k === 'forin' ? [s.cu] : s.k === 'if' ? s.ramas.map((r) => r.b).concat(s.otro ? [s.otro] : []) : [];
  const tieneGoto = (s, n) => (s.k === 'goto' && s.l === n) || subBloques(s).some((B) => B.some((x) => tieneGoto(x, n)));
  function conEtiquetas(L) {
    const ctx = new Map(), ade = [], atr = [];
    L.forEach((s, i) => {
      if (s.k !== 'label') return;
      const n = s.l, js = '$G' + (++uid); let g = -1;
      for (let k = 0; k < i; k++) if (tieneGoto(L[k], n)) { g = k; break; }
      const c = { js, modo: g >= 0 ? 'f' : null, i, atr: L.slice(i + 1).some((x) => tieneGoto(x, n)) };
      ctx.set(n, c); if (g >= 0) ade.push({ g, i, js }); if (c.atr) atr.push(i);
    });
    // (los bloques de los saltos hacia adelante no se pueden cruzar: si se cruzan, el de más afuera empieza antes)
    ade.sort((a, b) => a.i - b.i);
    for (let cambio = true; cambio;) { cambio = false; for (const a of ade) for (const b of ade) if (b.i < a.i && b.i > a.g && b.g < a.g) { a.g = b.g; cambio = true; } }
    for (const i of atr) if (ade.some((a) => a.g < i && a.i > i)) throw new LuaError(archivo + ':' + L[i].ln + ': goto: esta combinación de saltos hacia atrás y adelante no se puede traducir');
    gotos.push(ctx);
    let out = '', cierres = 0;
    for (let k = 0; k < L.length; k++) {
      for (const a of ade.filter((x) => x.g === k).sort((x, y) => y.i - x.i)) out += a.js + 'f:{';
      const s = L[k];
      if (s.k === 'label') {
        const c = ctx.get(s.l);
        if (c.modo === 'f') out += '}';
        c.modo = c.atr ? 'b' : null;
        if (c.atr) { out += c.js + 'b:for(;;){if(++R.n>R.lim)R.largo();'; cierres++; }
        continue;
      }
      out += sent(s);
    }
    for (let k = 0; k < cierres; k++) out += 'break;}';
    gotos.pop();
    return out;
  }
  function sent(s) {
    const pos = 'R.p=' + (fid * 65536 + Math.min(65535, s.ln || 0)) + ';';
    switch (s.k) {
      case 'local': {
        const v = s.ex.length === s.ns.length && !s.ex.some((x) => x.k === 'call' || x.k === 'mcall' || x.k === 'va') ? s.ex.map(exp) : null;
        if (v) { const js = v.map((x) => x); const ns = s.ns.map(nuevo); return pos + 'let ' + ns.map((n, i) => n + '=' + js[i]).join(',') + ';'; }
        if (!s.ex.length) { const ns = s.ns.map(nuevo); return 'let ' + ns.join(',') + ';'; }
        const t = '$l' + (++uid), l = lista(s.ex); const ns = s.ns.map(nuevo);
        return pos + 'const ' + t + '=' + l + ';let ' + ns.map((n, i) => n + '=' + t + '[' + i + ']').join(',') + ';';
      }
      case 'localf': { const n = nuevo(s.n); return pos + 'let ' + n + ';' + n + '=' + funcion(s.f) + ';'; }
      case 'asig': {
        const destino = (x, v) => { if (x.k === 'var') { const j = busca(x.n); return j ? j + '=' + v + ';' : conMod ? 'R.ms($M,' + S(x.n) + ',' + v + ');' : 'R.gs(' + S(x.n) + ',' + v + ');'; } return 'R.sx(' + exp(x.o) + ',' + exp(x.i) + ',' + v + ');'; };
        if (s.izq.length === 1 && s.der.length === 1) { const d = s.der[0]; return pos + destino(s.izq[0], d.k === 'call' || d.k === 'mcall' ? llamada(d) + '[0]' : exp(d)); }
        // (varias: primero se evalúa todo lo de la derecha)
        const t = '$a' + (++uid); let out = pos + 'const ' + t + '=' + lista(s.der) + ';';
        s.izq.forEach((x, i) => { out += destino(x, t + '[' + i + ']'); });
        return out;
      }
      case 'expr': if (conMod && esModulo(s) && !busca('module') && sc.length === 1) return pos + '$M=R.modulo(...' + lista(s.e.a || []) + ');'; return pos + llamada(s.e) + ';';
      case 'do': return '{' + bloque(s.b) + '}';
      case 'if': {
        let out = pos;
        s.ramas.forEach((r, i) => { out += (i ? 'else if' : 'if') + '(R.T(' + exp(r.c) + ')){' + bloque(r.b) + '}'; });
        if (s.otro) out += 'else{' + bloque(s.otro) + '}';
        return out;
      }
      case 'while': { const lz = { lbl: '$L' + (++uid) }; lazos.push(lz); const b = bloque(s.b); lazos.pop(); return pos + lz.lbl + ':while(R.T(' + exp(s.c) + ')){if(++R.n>R.lim)R.largo();' + b + '}'; }
      case 'repeat': {
        const lz = { rep: true, lbl: '$L' + (++uid), cl: 'rep' + uid }; lazos.push(lz);
        sc.push(new Map()); const b = bloque(s.b, false); const c = exp(s.c); sc.pop(); lazos.pop();
        return pos + lz.lbl + ':for(;;){if(++R.n>R.lim)R.largo();' + (lz.usado ? lz.cl + ':{' + b + '}' : b) + 'if(R.T(' + c + '))break;}';
      }
      case 'fornum': {
        const a = '$i' + (++uid), b = '$f' + uid, st = '$s' + uid;
        const ini = 'let ' + a + '=R.num(' + exp(s.a) + ',"for"),' + b + '=R.num(' + exp(s.b) + ',"for"),' + st + '=' + (s.c ? 'R.num(' + exp(s.c) + ',"for")' : '1') + ';';
        sc.push(new Map()); const v = nuevo(s.v); const lz = { lbl: '$L' + (++uid) }; lazos.push(lz); const cu = bloque(s.cu); lazos.pop(); sc.pop();
        return pos + '{' + ini + lz.lbl + ':for(;' + st + '>0?' + a + '<=' + b + ':' + a + '>=' + b + ';' + a + '+=' + st + '){if(++R.n>R.lim)R.largo();let ' + v + '=' + a + ';' + cu + '}}';
      }
      case 'forin': {
        const f = '$g' + (++uid), e = '$e' + uid, c = '$c' + uid, r = '$r' + uid;
        const lz = { lbl: '$L' + (++uid) };
        let out = pos + '{let [' + f + ',' + e + ',' + c + ']=R.iter(' + lista(s.ex) + ');' + lz.lbl + ':for(;;){if(++R.n>R.lim)R.largo();const ' + r + '=R.c(' + f + ',"for iterator",' + e + ',' + c + ');';
        sc.push(new Map()); const ns = s.ns.map(nuevo);
        out += 'let ' + ns.map((n, i) => n + '=' + r + '[' + i + ']').join(',') + ';if(' + ns[0] + '===undefined)break;' + c + '=' + ns[0] + ';';
        lazos.push(lz); out += bloque(s.cu); lazos.pop(); sc.pop();
        return out + '}}';
      }
      case 'return': {
        if (s.ex.length === 1 && (s.ex[0].k === 'call' || s.ex[0].k === 'mcall')) return pos + 'return ' + llamada(s.ex[0]) + ';';
        return pos + 'return ' + lista(s.ex) + ';';
      }
      // (break y continue con la etiqueta del bucle: entre medio puede haber un for(;;) de un goto hacia atrás)
      case 'break': if (!lazos.length) throw new LuaError(archivo + ':' + s.ln + ": 'break' fuera de un bucle"); return 'break ' + lazos[lazos.length - 1].lbl + ';';
      case 'continue': case 'goto': {
        if (s.k === 'goto') {
          for (let q = gotos.length - 1; q >= 0; q--) { const c = gotos[q].get(s.l); if (c && c.modo === 'f') return 'break ' + c.js + 'f;'; if (c && c.modo === 'b') return 'continue ' + c.js + 'b;'; if (c) break; }
          if (!/^continue$|^cont/i.test(s.l)) throw new LuaError(archivo + ':' + s.ln + ": no visible label '" + s.l + "' for goto");
        }
        // (el continue de GMod, y «goto continue» sin la etiqueta: el siguiente paso del bucle)
        const lz = lazos[lazos.length - 1]; if (!lz) throw new LuaError(archivo + ':' + s.ln + ': continue fuera de un bucle');
        if (lz.rep) { lz.usado = true; return 'break ' + lz.cl + ';'; }
        return 'continue ' + lz.lbl + ';';
      }
      case 'label': return '';
    }
    throw new LuaError(archivo + ': sentencia desconocida ' + s.k);
  }
  fn = { va: true }; sc.push(new Map());
  const cuerpo = bloque(arbol, false);
  return '"use strict";return function(...va){let $t' + (conMod ? ',$M=null' : '') + ';' + cuerpo + 'return E0;}';
}

// ---------------- el entorno de ejecución ----------------
const LUA = { archivos: [''], cache: new Map() };
function luaCrearRuntime() {
  const R = { n: 0, lim: 2e7, p: 0, G: new LuaTable(), strMT: null, largo() { const e = new LuaError(R.donde() + ': el script tardó demasiado (¿bucle infinito?)'); e.duro = true; throw e; } };
  const G = R.G;
  const tipo = (v) => (v === undefined || v === null ? 'nil' : typeof v === 'boolean' ? 'boolean' : typeof v === 'number' ? 'number' : typeof v === 'string' ? 'string' : typeof v === 'function' ? 'function' : v instanceof LuaTable ? 'table' : v && v.__co ? 'thread' : 'userdata');
  R.tipo = tipo;
  const mtDe = (v) => (v instanceof LuaTable ? v.mt : typeof v === 'string' ? R.strMT : v && typeof v === 'object' ? v.__mt || null : null);
  R.mtDe = mtDe;
  const meta = (v, ev) => { const m = mtDe(v); return m ? m.get(ev) : undefined; };
  R.T = (x) => x !== undefined && x !== false && x !== null;
  R.donde = () => { const f = R.p >>> 16, l = R.p & 65535; return (LUA.archivos[f] || '?') + ':' + l; };
  const err = (m) => { throw new LuaError(R.donde() + ': ' + m); };
  R.err = err;
  // números y textos
  const fmtNum = (n) => {
    if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
    if (n !== n) return 'nan'; if (n === Infinity) return 'inf'; if (n === -Infinity) return '-inf';
    let s = n.toPrecision(14); if (s.includes('e')) { let [m, e] = s.split('e'); if (m.includes('.')) m = m.replace(/0+$/, '').replace(/\.$/, ''); const ex = +e; return m + 'e' + (ex < 0 ? '-' : '+') + String(Math.abs(ex)).padStart(2, '0'); }
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s;
  };
  R.fmtNum = fmtNum;
  const aNum = (v) => { if (typeof v === 'number') return v; if (typeof v === 'string') { const t = v.trim(); if (/^[-+]?0[xX][0-9a-fA-F]+$/.test(t)) return parseInt(t, 16); if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return +t; if (/^[-+]?(inf|nan)$/i.test(t)) return undefined; } return undefined; };
  R.aNum = aNum;
  R.num = (v, que) => { const x = aNum(v); if (x === undefined) err("'" + que + "' necesita un número"); return x; };
  const arit = (ev, a, b, f, sim) => {
    const x = aNum(a), y = aNum(b); if (x !== undefined && y !== undefined) return f(x, y);
    const h = meta(a, ev) || meta(b, ev); if (h) return R.c(h, ev, a, b)[0];
    err('attempt to perform arithmetic on a ' + tipo(x === undefined ? a : b) + ' value');
  };
  R.add = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a + b : arit('__add', a, b, (x, y) => x + y));
  R.sub = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : arit('__sub', a, b, (x, y) => x - y));
  R.mul = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a * b : arit('__mul', a, b, (x, y) => x * y));
  R.div = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a / b : arit('__div', a, b, (x, y) => x / y));
  const md = (x, y) => (y === 0 ? NaN : x - Math.floor(x / y) * y);
  R.mod = (a, b) => (typeof a === 'number' && typeof b === 'number' ? md(a, b) : arit('__mod', a, b, md));
  R.pow = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.pow(a, b) : arit('__pow', a, b, Math.pow));
  R.neg = (a) => { if (typeof a === 'number') return -a; const x = aNum(a); if (x !== undefined) return -x; const h = meta(a, '__unm'); if (h) return R.c(h, '__unm', a, a)[0]; err('attempt to perform arithmetic on a ' + tipo(a) + ' value'); };
  R.len = (a) => { if (typeof a === 'string') return a.length; if (a instanceof LuaTable) return a.len(); const h = meta(a, '__len'); if (h) return R.c(h, '__len', a)[0]; err('attempt to get length of a ' + tipo(a) + ' value'); };   // (en 5.1 __len no vale para tablas)
  R.cat = (a, b) => {
    const ta = typeof a, tb = typeof b;
    if ((ta === 'string' || ta === 'number') && (tb === 'string' || tb === 'number')) return (ta === 'number' ? fmtNum(a) : a) + (tb === 'number' ? fmtNum(b) : b);
    const h = meta(a, '__concat') || meta(b, '__concat'); if (h) return R.c(h, '__concat', a, b)[0];
    err('attempt to concatenate a ' + tipo(ta === 'string' || ta === 'number' ? b : a) + ' value');
  };
  R.eq = (a, b) => {
    if (a === b) return true;
    const ta = tipo(a); if (ta !== tipo(b) || (ta !== 'table' && ta !== 'userdata')) return false;
    const h = meta(a, '__eq'); if (h && h === meta(b, '__eq')) return R.T(R.c(h, '__eq', a, b)[0]);
    return false;
  };
  R.lt = (a, b) => { if (typeof a === 'number' && typeof b === 'number') return a < b; if (typeof a === 'string' && typeof b === 'string') return a < b; const h = meta(a, '__lt') || meta(b, '__lt'); if (h) return R.T(R.c(h, '__lt', a, b)[0]); err('attempt to compare ' + tipo(a) + ' with ' + tipo(b)); };
  R.le = (a, b) => { if (typeof a === 'number' && typeof b === 'number') return a <= b; if (typeof a === 'string' && typeof b === 'string') return a <= b; let h = meta(a, '__le') || meta(b, '__le'); if (h) return R.T(R.c(h, '__le', a, b)[0]); h = meta(a, '__lt') || meta(b, '__lt'); if (h) return !R.T(R.c(h, '__lt', b, a)[0]); err('attempt to compare ' + tipo(a) + ' with ' + tipo(b)); };
  // índices
  R.ix = (o, k) => {
    for (let n = 0; n < 100; n++) {
      let h;
      if (o instanceof LuaTable) { const v = o.get(k); if (v !== undefined || !o.mt) return v; h = o.mt.get('__index'); if (h === undefined) return undefined; }
      else { h = meta(o, '__index'); if (h === undefined) { if (o === undefined || o === null) err("attempt to index a nil value" + (typeof k === 'string' ? " (field '" + k + "')" : '')); err('attempt to index a ' + tipo(o) + ' value' + (typeof k === 'string' ? " (field '" + k + "')" : '')); } }
      // (un __index que es función, como el de Vector, Angle y Entity: se llama directo, sin armar arreglos)
      if (typeof h === 'function') { const r = h(o, k); return Array.isArray(r) ? r[0] : r; }
      o = h;
    }
    err("bucle en '__index'");
  };
  R.sx = (o, k, v) => {
    for (let n = 0; n < 100; n++) {
      let h;
      if (o instanceof LuaTable) { if (!o.mt || (h = o.mt.get('__newindex')) === undefined || o.get(k) !== undefined) { o.set(k, v); return; } }
      else { h = meta(o, '__newindex'); if (h === undefined) err('attempt to index a ' + tipo(o) + ' value'); }
      if (typeof h === 'function') { R.c(h, '__newindex', o, k, v); return; }
      o = h;
    }
    err("bucle en '__newindex'");
  };
  // las globales de cada lado: en GMod el server y el cliente son dos Lua aparte; acá hay uno solo, así que lo que un
  // archivo asigna como global nuevo va a la capa del lado que corre (R.ov: R.ovS o R.ovC) y lo de la base (librerías,
  // prelude, lo que pone el juego) es de los dos. Sin capa (mientras corre el prelude), todo a la base.
  R.ov = null;
  R.gg = (n) => { const O = R.ov; if (O) { const x = O.h.get(n); if (x !== undefined) return x; } const v = G.get(n); return v !== undefined || !G.mt ? v : R.ix(G, n); };
  R.gs = (n, v) => { const O = R.ov; if (O && (O.h.has(n) || G.get(n) === undefined)) { O.set(n, v); return; } if (G.mt) R.sx(G, n, v); else G.set(n, v); };
  // los módulos de Lua 5.1 (module + package.seeall): la tabla x (o a.b.c), con _NAME/_M/_PACKAGE, en package.loaded
  R.mg = (M, n) => { if (!M) return R.gg(n); const v = M.get(n); return v !== undefined || !M.mt ? v : R.ix(M, n); };
  R.ms = (M, n, v) => { if (!M) R.gs(n, v); else M.set(n, v); };
  R.modulo = (...a) => {
    const nom = String(a[0]); let t = G; for (const p of nom.split('.')) { let x = t.get(p); if (!(x instanceof LuaTable)) { x = new LuaTable(); t.set(p, x); } t = x; }
    t.set('_NAME', nom); t.set('_M', t); t.set('_PACKAGE', nom.includes('.') ? nom.replace(/[^.]*$/, '') : '');
    const pk = G.get('package'); if (pk instanceof LuaTable && pk.get('loaded') instanceof LuaTable) pk.get('loaded').set(nom, t);
    for (const f of a.slice(1)) if (typeof f === 'function') f(t); else if (f instanceof LuaTable && f.mt) {}
    return t;
  };
  // llamadas: devuelven siempre un arreglo
  const res = (r) => (r === undefined ? E0 : Array.isArray(r) ? r : [r]);
  R.c = (f, nombre, ...a) => {
    if (typeof f === 'function') return res(f(...a));
    const h = meta(f, '__call'); if (h !== undefined) return R.c(h, nombre, f, ...a);
    err("attempt to call " + (nombre && nombre !== '?' ? "'" + nombre + "' " : '') + '(a ' + tipo(f) + ' value)');
  };
  R.mc = (o, m, ...a) => { const f = R.ix(o, m); if (typeof f === 'function') return res(f(o, ...a)); if (f === undefined && R.metodoFalta && o && typeof o === 'object' && !(o instanceof LuaTable)) { const r = R.metodoFalta(o, m, a); if (r) return r; } return R.c(f, m, o, ...a); };
  R.fn = (p, g) => { p.g = g; return p; };
  // (en una corrutina: si la función tiene versión generadora se entra con yield*; coroutine.yield para acá)
  R.cy = function* (f, nombre, ...a) {
    if (typeof f === 'function') { if (f === R.coYield) { const r = yield a; return r || E0; } if (f.g) return res(yield* f.g(...a)); return res(f(...a)); }
    return R.c(f, nombre, ...a);
  };
  R.mcy = function* (o, m, ...a) {
    const f = R.ix(o, m);
    if (typeof f === 'function') { if (f === R.coYield) { const r = yield a; return r || E0; } if (f.g) return res(yield* f.g(o, ...a)); return res(f(o, ...a)); }
    return R.mc(o, m, ...a);
  };
  R.tab = (pos, kv) => { const t = new LuaTable(); for (let i = 0; i < pos.length; i++) t.a.push(pos[i]); while (t.a.length && t.a[t.a.length - 1] === undefined) t.a.pop(); if (kv) for (const [k, v] of kv) if (k !== undefined && v !== undefined) t.set(k, v); return t; };
  R.iter = (L) => [L[0], L[1], L[2]];
  // ---------------- biblioteca base ----------------
  const def = (t, n, f) => t.set(n, f);
  const tostr = (v) => {
    const h = meta(v, '__tostring'); if (h) return String(R.c(h, '__tostring', v)[0]);
    switch (tipo(v)) { case 'nil': return 'nil'; case 'boolean': return v ? 'true' : 'false'; case 'number': return fmtNum(v); case 'string': return v; }
    if (v && v.__nombre) return v.__nombre(); return tipo(v) + ': 0x' + R.idDe(v).toString(16).padStart(8, '0');
  };
  R.tostr = tostr;
  const ids = new WeakMap(); let nid = 0x10000000; R.idDe = (o) => { if (typeof o !== 'object' && typeof o !== 'function') return 0; let i = ids.get(o); if (!i) { i = nid += 0x28; ids.set(o, i); } return i; };
  R.salida = (s) => console.log('[Lua] ' + s);
  def(G, 'print', (...a) => { R.salida(a.map(tostr).join('\t')); });
  def(G, 'type', (v) => tipo(v));
  def(G, 'tostring', (v) => tostr(v));
  def(G, 'tonumber', (v, b) => {
    if (b === undefined || b === 10) return aNum(v);
    const s = String(v).trim().toLowerCase(); if (!s) return undefined; const n = parseInt(s, b); return Number.isNaN(n) || !new RegExp('^-?[' + '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, b) + ']+$').test(s) ? undefined : n;
  });
  def(G, 'rawget', (t, k) => (t instanceof LuaTable ? t.get(k) : undefined));
  def(G, 'rawset', (t, k, v) => { t.set(k, v); return t; });
  def(G, 'rawequal', (a, b) => a === b);
  def(G, 'rawlen', (t) => (t instanceof LuaTable ? t.len() : String(t).length));
  def(G, 'setmetatable', (t, m) => { if (!(t instanceof LuaTable)) err('bad argument #1 to setmetatable (table expected)'); t.mt = m instanceof LuaTable ? m : null; return t; });
  def(G, 'getmetatable', (v) => { const m = mtDe(v); if (m) { const p = m.get('__metatable'); return p !== undefined ? p : m; } return undefined; });
  def(G, 'assert', (v, m, ...r) => { if (!R.T(v)) throw new LuaError(m !== undefined ? m : 'assertion failed!'); return [v, m, ...r]; });
  def(G, 'error', (m, nivel) => { throw new LuaError(typeof m === 'string' && nivel !== 0 ? R.donde() + ': ' + m : m, nivel); });
  const msgErr = (e) => (e instanceof LuaError ? e.v : e instanceof RangeError ? 'stack overflow' : String((e && e.message) || e));
  R.msgErr = msgErr;
  def(G, 'pcall', (f, ...a) => { try { return [true, ...R.c(f, 'pcall', ...a)]; } catch (e) { if (e && e.duro) throw e; return [false, msgErr(e)]; } });
  def(G, 'xpcall', (f, h, ...a) => { try { return [true, ...R.c(f, 'xpcall', ...a)]; } catch (e) { if (e && e.duro) throw e; return [false, ...R.c(h, 'xpcall', msgErr(e))]; } });
  def(G, 'select', (n, ...a) => { if (n === '#') return a.length; n = R.num(n, 'select'); if (n < 0) n = a.length + n; else n--; return a.slice(Math.max(0, n)); });
  const pnext = (t, k) => {
    if (!(t instanceof LuaTable)) err('bad argument #1 to next (table expected)');
    // (la siguiente clave: con una lista de claves guardada en la tabla mientras se recorre)
    if (k === undefined) { t._nk = t.claves(); t._ni = new Map(); t._nk.forEach((x, i) => t._ni.set(x, i)); var i = 0; }
    else { if (!t._ni || !t._ni.has(k)) { t._nk = t.claves(); t._ni = new Map(); t._nk.forEach((x, j) => t._ni.set(x, j)); } i = t._ni.get(k) + 1; }
    for (; i < t._nk.length; i++) { const kk = t._nk[i], v = t.get(kk); if (v !== undefined) return [kk, v]; }
    t._nk = t._ni = null; return undefined;
  };
  def(G, 'next', pnext);
  def(G, 'pairs', (t) => {
    const h = meta(t, '__pairs'); if (h) return R.c(h, '__pairs', t).slice(0, 3);
    if (!(t instanceof LuaTable)) err('bad argument #1 to pairs (table expected, got ' + tipo(t) + ')');
    const L = t.claves(); let i = 0;
    return [() => { for (; i < L.length; i++) { const k = L[i], v = t.get(k); if (v !== undefined) { i++; return [k, v]; } } return undefined; }, t, undefined];
  });
  def(G, 'ipairs', (t) => {
    if (t === undefined) err('bad argument #1 to ipairs (table expected, got nil)');
    let i = 0;
    return [() => { i++; const v = t instanceof LuaTable && !t.mt ? t.get(i) : R.ix(t, i); return v === undefined ? undefined : [i, v]; }, t, 0];
  });
  def(G, 'unpack', (t, i, j) => { i = i === undefined ? 1 : i; j = j === undefined ? R.len(t) : j; const o = []; for (let k = i; k <= j; k++) o.push(R.ix(t, k)); return o; });
  def(G, 'collectgarbage', (op) => (op === 'count' ? [1024, 0] : 0));
  def(G, 'setfenv', (f) => f); def(G, 'getfenv', () => G);
  { const pk = G.get('package') instanceof LuaTable ? G.get('package') : new LuaTable(); if (!(pk.get('loaded') instanceof LuaTable)) pk.set('loaded', new LuaTable()); pk.set('seeall', (m) => { if (m instanceof LuaTable) { const mt = m.mt || new LuaTable(); mt.set('__index', G); m.mt = mt; } }); G.set('package', pk); }
  R.cargar = (src, nombre, entorno) => luaCompilar(src, nombre || '=(load)', R);
  def(G, 'loadstring', (src, nombre) => { try { return R.cargar(String(src), nombre ? String(nombre) : 'loadstring'); } catch (e) { return [undefined, msgErr(e)]; } });
  def(G, 'load', (src, nombre) => { if (typeof src === 'function') { let s = '', x; while ((x = R.c(src, 'load')[0]) !== undefined && x !== '') s += x; src = s; } try { return R.cargar(String(src), nombre ? String(nombre) : 'load'); } catch (e) { return [undefined, msgErr(e)]; } });
  def(G, '_G', G); def(G, '_VERSION', 'Lua 5.1');
  // ---------------- string (con los patrones de Lua) ----------------
  const str = new LuaTable(); def(G, 'string', str);
  R.strMT = new LuaTable(); R.strMT.set('__index', str);
  const sArg = (s, que) => { if (typeof s === 'string') return s; if (typeof s === 'number') return fmtNum(s); err("bad argument #1 to '" + que + "' (string expected, got " + tipo(s) + ')'); };
  const posI = (i, n) => (i >= 0 ? i : Math.max(0, n + i + 1));
  def(str, 'len', (s) => sArg(s, 'len').length);
  def(str, 'sub', (s, i, j) => { s = sArg(s, 'sub'); const n = s.length; i = i === undefined ? 1 : Math.trunc(R.num(i, 'sub')); j = j === undefined ? -1 : Math.trunc(R.num(j, 'sub')); i = posI(i, n); j = posI(j, n); if (i < 1) i = 1; if (j > n) j = n; return i > j ? '' : s.slice(i - 1, j); });
  def(str, 'upper', (s) => sArg(s, 'upper').toUpperCase());
  def(str, 'lower', (s) => sArg(s, 'lower').toLowerCase());
  def(str, 'rep', (s, n, sep) => { s = sArg(s, 'rep'); n = Math.trunc(R.num(n, 'rep')); if (n <= 0) return ''; if (s.length * n > 5e7) err('resultado demasiado grande'); return sep ? Array(n).fill(s).join(sep) : s.repeat(n); });
  def(str, 'reverse', (s) => sArg(s, 'reverse').split('').reverse().join(''));
  def(str, 'byte', (s, i, j) => { s = sArg(s, 'byte'); i = i === undefined ? 1 : posI(Math.trunc(i), s.length); j = j === undefined ? i : posI(Math.trunc(j), s.length); const o = []; for (let k = Math.max(1, i); k <= Math.min(j, s.length); k++) o.push(s.charCodeAt(k - 1) & 255); return o; });
  def(str, 'char', (...a) => String.fromCharCode(...a.map((x) => R.num(x, 'char') & 255)));
  def(str, 'format', (f, ...a) => luaFormat(R, sArg(f, 'format'), a));
  // patrones
  const P = luaPatrones(R);
  def(str, 'find', (s, pat, ini, plano) => {
    s = sArg(s, 'find'); pat = sArg(pat, 'find'); ini = posI(ini === undefined ? 1 : Math.trunc(ini), s.length); if (ini < 1) ini = 1; if (ini > s.length + 1) return undefined;
    if (R.T(plano) || !/[\^$*+?.()[\]%-]/.test(pat)) { const k = s.indexOf(pat, ini - 1); return k < 0 ? undefined : [k + 1, k + pat.length]; }
    const m = P.buscar(s, pat, ini - 1); return m ? [m.ini + 1, m.fin, ...m.caps] : undefined;
  });
  def(str, 'match', (s, pat, ini) => { s = sArg(s, 'match'); pat = sArg(pat, 'match'); ini = posI(ini === undefined ? 1 : Math.trunc(ini), s.length); if (ini < 1) ini = 1; const m = P.buscar(s, pat, ini - 1); return m ? (m.caps.length ? m.caps : [s.slice(m.ini, m.fin)]) : undefined; });
  def(str, 'gmatch', (s, pat) => {
    s = sArg(s, 'gmatch'); pat = sArg(pat, 'gmatch'); let pos = 0;
    return () => {
      while (pos <= s.length) {
        const m = P.unaVez(s, pat, pos);
        if (m) { pos = m.fin > pos ? m.fin : pos + 1; return m.caps.length ? m.caps : [s.slice(m.ini, m.fin)]; }
        pos++;
      }
      return undefined;
    };
  });
  def(str, 'gsub', (s, pat, rep, max) => {
    s = sArg(s, 'gsub'); pat = sArg(pat, 'gsub'); max = max === undefined ? Infinity : max;
    let out = '', pos = 0, n = 0; const anc = pat[0] === '^';
    while (n < max) {
      const m = P.unaVez(s, pat, pos);
      if (m) {
        n++; const todo = s.slice(m.ini, m.fin), c0 = m.caps.length ? m.caps[0] : todo; let r;
        if (typeof rep === 'string' || typeof rep === 'number') { r = String(typeof rep === 'number' ? fmtNum(rep) : rep).replace(/%([0-9%])/g, (_, d) => (d === '%' ? '%' : d === '0' ? todo : (() => { const c = m.caps[+d - 1]; if (c === undefined && +d !== 1) err('invalid capture index'); return c === undefined ? todo : typeof c === 'number' ? String(c) : c; })())); }
        else if (rep instanceof LuaTable) r = rep.get(c0);
        else r = R.c(rep, 'gsub', ...(m.caps.length ? m.caps : [todo]))[0];
        out += r === undefined || r === false ? todo : typeof r === 'number' ? fmtNum(r) : typeof r === 'string' ? r : err('invalid replacement value (a ' + tipo(r) + ')');
        if (m.fin > m.ini) pos = m.fin; else { if (pos < s.length) out += s[pos]; pos++; }
      } else { if (pos < s.length) out += s[pos]; pos++; }
      if (pos > s.length || anc) break;
    }
    if (pos < s.length) out += s.slice(pos);
    return [out, n];
  });
  // ---------------- table ----------------
  const tab = new LuaTable(); def(G, 'table', tab);
  const tArg = (t, f) => { if (!(t instanceof LuaTable)) err("bad argument #1 to '" + f + "' (table expected, got " + tipo(t) + ')'); return t; };
  def(tab, 'insert', (...x) => {
    const t = tArg(x[0], 'insert'), n = t.len(), a = x[1], b = x[2];
    if (x.length < 3) { if (a === undefined) return; t.set(n + 1, a); return; }
    let pos = Math.trunc(R.num(a, 'insert')); if (pos < 1 || pos > n + 1) { t.set(pos, b); return; }
    if (b === undefined) { t.a.splice(pos - 1, 0, undefined); return; }
    if (pos <= t.a.length + 1 && t.a.length === n) { t.a.splice(pos - 1, 0, b); } else { for (let i = n; i >= pos; i--) t.set(i + 1, t.get(i)); t.set(pos, b); }
  });
  def(tab, 'remove', (t, pos) => {
    tArg(t, 'remove'); const n = t.len(); if (n === 0) return undefined; pos = pos === undefined ? n : Math.trunc(pos);
    if (pos === n) { const v = t.get(n); t.set(n, undefined); return v; }
    if (pos < 1 || pos > n) return undefined;
    const v = t.a.splice(pos - 1, 1)[0]; while (t.a.length && t.a[t.a.length - 1] === undefined) t.a.pop(); return v;
  });
  def(tab, 'concat', (t, sep, i, j) => { tArg(t, 'concat'); sep = sep === undefined ? '' : sArg(sep, 'concat'); i = i === undefined ? 1 : i; j = j === undefined ? t.len() : j; const o = []; for (let k = i; k <= j; k++) { const v = t.get(k); if (typeof v === 'string') o.push(v); else if (typeof v === 'number') o.push(fmtNum(v)); else err("invalid value (at index " + k + ") in table for 'concat'"); } return o.join(sep); });
  def(tab, 'sort', (t, f) => {
    tArg(t, 'sort'); const n = t.len(), a = t.a.slice(0, n);
    const cmp = f !== undefined ? (x, y) => (R.T(R.c(f, 'sort', x, y)[0]) ? -1 : R.T(R.c(f, 'sort', y, x)[0]) ? 1 : 0) : (x, y) => (R.lt(x, y) ? -1 : R.lt(y, x) ? 1 : 0);
    a.sort(cmp); for (let k = 0; k < n; k++) t.a[k] = a[k];
  });
  def(tab, 'getn', (t) => tArg(t, 'getn').len());
  def(tab, 'maxn', (t) => { let m = 0; for (const k of tArg(t, 'maxn').claves()) if (typeof k === 'number' && k > m) m = k; return m; });
  def(tab, 'unpack', G.get('unpack'));
  def(tab, 'pack', (...a) => { const t = R.tab(a); t.set('n', a.length); return t; });
  // ---------------- math ----------------
  const mat = new LuaTable(); def(G, 'math', mat);
  for (const k of ['abs', 'acos', 'asin', 'atan', 'ceil', 'cos', 'exp', 'floor', 'sin', 'sqrt', 'tan', 'log10', 'sinh', 'cosh', 'tanh']) def(mat, k, (x) => Math[k](R.num(x, k)));
  def(mat, 'log', (x, b) => (b === undefined ? Math.log(R.num(x, 'log')) : Math.log(x) / Math.log(b)));
  def(mat, 'atan2', (y, x) => Math.atan2(R.num(y, 'atan2'), R.num(x, 'atan2')));
  def(mat, 'atan', (y, x) => (x === undefined ? Math.atan(R.num(y, 'atan')) : Math.atan2(y, x)));
  def(mat, 'pow', (a, b) => Math.pow(a, b)); def(mat, 'fmod', (a, b) => a % b); def(mat, 'mod', (a, b) => a % b);
  def(mat, 'modf', (x) => { const i = x >= 0 ? Math.floor(x) : Math.ceil(x); return [i, x - i]; });
  def(mat, 'frexp', (x) => { if (x === 0) return [0, 0]; const e = Math.floor(Math.log2(Math.abs(x))) + 1; return [x / 2 ** e, e]; });
  def(mat, 'ldexp', (m, e) => m * 2 ** e);
  def(mat, 'deg', (x) => x * 180 / Math.PI); def(mat, 'rad', (x) => x * Math.PI / 180);
  def(mat, 'min', (...a) => { if (!a.length) err("bad argument #1 to 'min'"); return Math.min(...a.map((x) => R.num(x, 'min'))); });
  def(mat, 'max', (...a) => { if (!a.length) err("bad argument #1 to 'max'"); return Math.max(...a.map((x) => R.num(x, 'max'))); });
  def(mat, 'huge', Infinity); def(mat, 'pi', Math.PI);
  def(mat, 'random', (a, b) => { const r = Math.random(); if (a === undefined) return r; if (b === undefined) return 1 + Math.floor(r * Math.floor(a)); return Math.floor(a) + Math.floor(r * (Math.floor(b) - Math.floor(a) + 1)); });
  def(mat, 'randomseed', () => {});
  // ---------------- os, bit, coroutine (lo que se puede) ----------------
  const os = new LuaTable(); def(G, 'os', os);
  def(os, 'time', (t) => (t instanceof LuaTable ? Math.floor(new Date(t.get('year'), (t.get('month') || 1) - 1, t.get('day') || 1, t.get('hour') || 12, t.get('min') || 0, t.get('sec') || 0).getTime() / 1000) : Math.floor(Date.now() / 1000)));
  def(os, 'clock', () => performance.now() / 1000);
  def(os, 'difftime', (a, b) => a - (b || 0));
  def(os, 'date', (f, t) => {
    const d = t === undefined ? new Date() : new Date(t * 1000); f = f === undefined ? '%c' : String(f); const utc = f[0] === '!'; if (utc) f = f.slice(1);
    const g = (k) => (utc ? d['getUTC' + k]() : d['get' + k]());
    if (f.startsWith('*t')) { const x = new LuaTable(); x.set('year', g('FullYear')); x.set('month', g('Month') + 1); x.set('day', g('Date')); x.set('hour', g('Hours')); x.set('min', g('Minutes')); x.set('sec', g('Seconds')); x.set('wday', g('Day') + 1); x.set('yday', 1); x.set('isdst', false); return x; }
    const p2 = (n) => String(n).padStart(2, '0');
    return f.replace(/%(.)/g, (_, c) => ({ Y: g('FullYear'), y: p2(g('FullYear') % 100), m: p2(g('Month') + 1), d: p2(g('Date')), H: p2(g('Hours')), M: p2(g('Minutes')), S: p2(g('Seconds')), p: g('Hours') < 12 ? 'AM' : 'PM', c: d.toLocaleString(), x: d.toLocaleDateString(), X: d.toLocaleTimeString(), '%': '%' }[c] ?? ''));
  });
  def(os, 'getenv', () => undefined);
  const bit = new LuaTable(); def(G, 'bit', bit);
  const b32 = (x) => R.num(x, 'bit') | 0;
  def(bit, 'band', (...a) => a.reduce((x, y) => x & b32(y), -1)); def(bit, 'bor', (...a) => a.reduce((x, y) => x | b32(y), 0)); def(bit, 'bxor', (...a) => a.reduce((x, y) => x ^ b32(y), 0));
  def(bit, 'bnot', (x) => ~b32(x)); def(bit, 'lshift', (x, n) => b32(x) << (n & 31)); def(bit, 'rshift', (x, n) => b32(x) >>> (n & 31)); def(bit, 'arshift', (x, n) => b32(x) >> (n & 31));
  def(bit, 'tobit', (x) => b32(x)); def(bit, 'tohex', (x, n) => { n = n === undefined ? 8 : n; let s = (b32(x) >>> 0).toString(16); s = s.padStart(8, '0').slice(-Math.abs(n)); return n < 0 ? s.toUpperCase() : s; });
  def(bit, 'rol', (x, n) => { x = b32(x); n &= 31; return (x << n) | (x >>> (32 - n)); }); def(bit, 'ror', (x, n) => { x = b32(x); n &= 31; return (x >>> n) | (x << (32 - n)); });
  def(bit, 'bswap', (x) => { x = b32(x); return ((x & 255) << 24) | ((x & 0xff00) << 8) | ((x >>> 8) & 0xff00) | (x >>> 24); });
  const co = new LuaTable(); def(G, 'coroutine', co);
  // (corrutinas de verdad: la función con versión generadora corre hasta un coroutine.yield, aunque esté adentro de otras
  // llamadas, y sigue desde ahí en el próximo resume; una sin versión generadora corre entera de una vez)
  const coPila = [];
  def(co, 'create', (f) => { if (typeof f !== 'function') err("bad argument #1 to 'create' (function expected)"); return { __co: true, f, st: 'suspended', it: null }; });
  def(co, 'resume', (c, ...a) => {
    if (!c || !c.__co) err("bad argument #1 to 'resume' (coroutine expected)");
    if (c.st === 'dead') return [false, 'cannot resume dead coroutine']; if (c.st === 'running') return [false, 'cannot resume non-suspended coroutine'];
    c.st = 'running'; coPila.push(c); const n0 = R.n;
    try {
      let r; if (!c.it) { c.it = c.f.g ? c.f.g(...a) : (function* () { return R.c(c.f, 'coroutine', ...a); })(); r = c.it.next(); } else r = c.it.next(a);
      if (r.done) { c.st = 'dead'; return [true, ...res(r.value)]; }
      c.st = 'suspended'; return [true, ...r.value];
    } catch (e) { c.st = 'dead'; if (e && e.duro) throw e; return [false, msgErr(e)]; }
    finally { coPila.pop(); R.n = n0; }
  });
  def(co, 'wrap', (f) => { const c = co.get('create')(f); return (...a) => { const r = co.get('resume')(c, ...a); if (!r[0]) throw new LuaError(r[1]); return r.slice(1); }; });
  R.coYield = () => err(coPila.length ? 'attempt to yield across a C-call boundary' : 'attempt to yield from outside a coroutine');
  def(co, 'yield', R.coYield);
  def(co, 'status', (c) => (c && c.__co ? c.st : undefined)); def(co, 'running', () => coPila[coPila.length - 1]); def(co, 'isyieldable', () => coPila.length > 0);
  const dbg = new LuaTable(); def(G, 'debug', dbg);
  def(dbg, 'traceback', (m) => (m === undefined ? 'stack traceback:' : tostr(m)));
  def(dbg, 'getinfo', () => { const t = new LuaTable(); t.set('short_src', R.donde().split(':')[0]); t.set('source', '@' + R.donde().split(':')[0]); t.set('currentline', R.p & 65535); return t; });
  def(dbg, 'getmetatable', (v) => mtDe(v)); def(dbg, 'setmetatable', (v, m) => { if (v instanceof LuaTable) v.mt = m; return v; });
  def(dbg, 'sethook', () => {}); def(dbg, 'getlocal', () => undefined); def(dbg, 'getupvalue', () => undefined);
  return R;
}
// compilar un archivo: devuelve la función principal (o tira LuaError con el archivo y la línea)
function luaCompilar(src, archivo, R) {
  let h = 2166136261; for (let i = 0; i < src.length; i++) h = Math.imul(h ^ src.charCodeAt(i), 16777619);
  const k = archivo + '\u0000' + src.length + '\u0000' + (h >>> 0);
  let gen = LUA.cache.get(k);
  if (!gen) {
    let fid = LUA.archivos.indexOf(archivo); if (fid < 0) { fid = LUA.archivos.length; LUA.archivos.push(archivo); }
    const dual = /coroutine\.|RunBehaviour|MoveToPos|PlaySequenceAndWait|BehaveThread/.test(src);
    const js = luaGenerar(luaParsear(luaLexico(src, archivo), archivo), archivo, fid, dual);
    try { gen = new Function('R', 'LuaTable', 'E0', js); } catch (e) { throw new LuaError(archivo + ': no se pudo traducir (' + e.message + ')'); }
    LUA.cache.set(k, gen); if (LUA.cache.size > 4000) LUA.cache.delete(LUA.cache.keys().next().value);
  }
  return gen(R, LuaTable, E0);
}

// ---------------- string.format ----------------
function luaFormat(R, f, a) {
  let k = 0, out = '';
  for (let i = 0; i < f.length; i++) {
    const c = f[i]; if (c !== '%') { out += c; continue; }
    i++; if (f[i] === '%') { out += '%'; continue; }
    let flags = ''; while ('-+ #0'.includes(f[i])) flags += f[i++];
    let w = ''; while (/[0-9]/.test(f[i])) w += f[i++];
    let pr = null; if (f[i] === '.') { i++; pr = ''; while (/[0-9]/.test(f[i])) pr += f[i++]; pr = +pr || 0; }
    const t = f[i], v = a[k++]; let s;
    const num = () => { const x = R.aNum(v); if (x === undefined) R.err("bad argument #" + (k + 1) + " to 'format' (number expected, got " + R.tipo(v) + ')'); return x; };
    switch (t) {
      case 'd': case 'i': { const x = Math.trunc(num()); s = String(Math.abs(x)); if (pr !== null) s = s.padStart(pr, '0'); s = (x < 0 ? '-' : flags.includes('+') ? '+' : flags.includes(' ') ? ' ' : '') + s; break; }
      case 'u': s = String(Math.trunc(num()) >>> 0); break;
      case 'c': s = String.fromCharCode(num()); break;
      case 'x': case 'X': { let x = Math.trunc(num()); s = (x < 0 ? (x >>> 0) : x).toString(16); if (t === 'X') s = s.toUpperCase(); if (flags.includes('#') && x) s = (t === 'X' ? '0X' : '0x') + s; break; }
      case 'o': s = Math.trunc(num()).toString(8); break;
      case 'e': case 'E': { const x = num(); s = x.toExponential(pr === null ? 6 : pr).replace(/e([+-])(\d)$/, 'e$10$2'); if (t === 'E') s = s.toUpperCase(); if (x >= 0 && flags.includes('+')) s = '+' + s; break; }
      case 'f': case 'F': { const x = num(); s = Number.isFinite(x) ? x.toFixed(pr === null ? 6 : pr) : x !== x ? 'nan' : x > 0 ? 'inf' : '-inf'; if (x >= 0 && flags.includes('+')) s = '+' + s; else if (x >= 0 && flags.includes(' ')) s = ' ' + s; break; }
      case 'g': case 'G': { const x = num(); const p = pr === null ? 6 : pr || 1; s = x.toPrecision(p); if (!flags.includes('#')) s = s.includes('e') ? s.replace(/\.?0+e/, 'e') : s.includes('.') ? s.replace(/\.?0+$/, '') : s; s = s.replace(/e([+-])(\d)$/, 'e$10$2'); if (t === 'G') s = s.toUpperCase(); break; }
      case 'q': s = '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\0/g, '\\0') + '"'; break;
      case 's': s = R.tostr(v); if (pr !== null) s = s.slice(0, pr); break;
      default: R.err("invalid option '%" + (t || '') + "' to 'format'");
    }
    if (w && s.length < +w) s = flags.includes('-') ? s.padEnd(+w) : flags.includes('0') && /[dixXeEfgG]/.test(t) ? (s[0] === '-' || s[0] === '+' ? s[0] + s.slice(1).padStart(+w - 1, '0') : s.padStart(+w, '0')) : s.padStart(+w);
    out += s;
  }
  return out;
}

// ---------------- patrones de Lua (como lstrlib.c) ----------------
function luaPatrones(R) {
  const clase = (c, cl) => {
    const lo = cl.toLowerCase(); let r;
    const x = c.charCodeAt(0);
    switch (lo) {
      case 'a': r = /[A-Za-z]/.test(c); break; case 'd': r = x >= 48 && x <= 57; break; case 'l': r = x >= 97 && x <= 122; break;
      case 's': r = c === ' ' || (x >= 9 && x <= 13); break; case 'u': r = x >= 65 && x <= 90; break; case 'w': r = /[A-Za-z0-9]/.test(c); break;
      case 'x': r = /[0-9A-Fa-f]/.test(c); break; case 'p': r = /[!-/:-@[-`{-~]/.test(c); break; case 'c': r = x < 32 || x === 127; break;
      case 'g': r = x > 32 && x < 127; break; default: return cl === c;
    }
    return cl === lo ? r : !r;
  };
  function finClase(p, i) {
    const c = p[i++]; if (c === undefined) R.err('malformed pattern');
    if (c === '%') { if (i >= p.length) R.err("malformed pattern (ends with '%')"); return i + 1; }
    if (c === '[') { if (p[i] === '^') i++; do { if (i >= p.length) R.err("malformed pattern (missing ']')"); const cc = p[i++]; if (cc === '%') i++; } while (p[i] !== ']'); return i + 1; }
    return i;
  }
  function enSet(c, p, i, fin) {   // p[i] = '[', fin = posición del ']'
    let neg = false; i++; if (p[i] === '^') { neg = true; i++; }
    while (i < fin) {
      if (p[i] === '%') { i++; if (clase(c, p[i])) return !neg; i++; }
      else if (p[i + 1] === '-' && i + 2 < fin) { if (p[i] <= c && c <= p[i + 2]) return !neg; i += 3; }
      else { if (p[i] === c) return !neg; i++; }
    }
    return neg;
  }
  function uno(s, si, p, pi, ep) {
    if (si >= s.length) return false;
    const c = s[si];
    switch (p[pi]) { case '.': return true; case '%': return clase(c, p[pi + 1]); case '[': return enSet(c, p, pi, ep - 1); default: return p[pi] === c; }
  }
  function match(M, si, pi) {
    const s = M.s, p = M.p;
    if (++M.pasos > 2e6) R.err('patrón demasiado complejo');
    for (;;) {
      if (pi >= p.length) return si;
      switch (p[pi]) {
        case '(': {
          if (p[pi + 1] === ')') { M.caps.push({ i: si, l: -2 }); const r = match(M, si, pi + 2); if (r === -1) M.caps.pop(); return r; }
          M.caps.push({ i: si, l: -1 }); const r = match(M, si, pi + 1); if (r === -1) M.caps.pop(); return r;
        }
        case ')': {
          let k = M.caps.length - 1; while (k >= 0 && M.caps[k].l !== -1) k--; if (k < 0) R.err('invalid pattern capture');
          M.caps[k].l = si - M.caps[k].i; const r = match(M, si, pi + 1); if (r === -1) M.caps[k].l = -1; return r;
        }
        case '$': if (pi + 1 === p.length) return si === s.length ? si : -1; break;
        case '%': {
          const n = p[pi + 1];
          if (n === 'b') {
            if (pi + 3 >= p.length + 1) R.err('missing arguments to %b');
            const a = p[pi + 2], b = p[pi + 3]; if (s[si] !== a) return -1;
            let cont = 1, k = si + 1; while (k < s.length) { const ch = s[k]; if (ch === b) { if (--cont === 0) break; } else if (ch === a) cont++; k++; }
            if (k >= s.length) return -1; si = k + 1; pi += 4; continue;
          }
          if (n === 'f') {
            pi += 2; if (p[pi] !== '[') R.err("missing '[' after '%f' in pattern");
            const ep = finClase(p, pi), prev = si === 0 ? '\0' : s[si - 1], cur = si < s.length ? s[si] : '\0';
            if (!enSet(prev, p, pi, ep - 1) && enSet(cur, p, pi, ep - 1)) { pi = ep; continue; }
            return -1;
          }
          if (/[0-9]/.test(n)) {
            const c = M.caps[+n - 1]; if (!c || c.l < 0) R.err('invalid capture index');
            const t = s.substr(c.i, c.l); if (s.startsWith(t, si)) { si += t.length; pi += 2; continue; } return -1;
          }
          break;
        }
      }
      const ep = finClase(p, pi), q = p[ep];
      if (q === '?') { if (uno(s, si, p, pi, ep)) { const r = match(M, si + 1, ep + 1); if (r !== -1) return r; } pi = ep + 1; continue; }
      if (q === '+') { if (!uno(s, si, p, pi, ep)) return -1; return maxExp(M, si + 1, pi, ep); }
      if (q === '*') return maxExp(M, si, pi, ep);
      if (q === '-') { for (;;) { const r = match(M, si, ep + 1); if (r !== -1) return r; if (uno(s, si, p, pi, ep)) si++; else return -1; } }
      if (!uno(s, si, p, pi, ep)) return -1;
      si++; pi = ep;
    }
  }
  function maxExp(M, si, pi, ep) {
    let i = 0; while (uno(M.s, si + i, M.p, pi, ep)) i++;
    while (i >= 0) { const r = match(M, si + i, ep + 1); if (r !== -1) return r; i--; }
    return -1;
  }
  const caps = (M, ini, fin) => M.caps.map((c) => (c.l === -2 ? c.i + 1 : M.s.substr(c.i, c.l)));
  return {
    unaVez(s, p, si) { const anc = p[0] === '^'; const M = { s, p, caps: [], pasos: 0 }; const fin = match(M, si, anc ? 1 : 0); return fin === -1 ? null : { ini: si, fin, caps: caps(M) }; },
    buscar(s, p, si) {
      const anc = p[0] === '^';
      for (let i = si; i <= s.length; i++) { const M = { s, p, caps: [], pasos: 0 }; const fin = match(M, i, anc ? 1 : 0); if (fin !== -1) return { ini: i, fin, caps: caps(M) }; if (anc) break; }
      return null;
    },
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { LuaTable, LuaError, luaCrearRuntime, luaCompilar, luaLexico, luaParsear, luaGenerar, E0 };
