// Componentes de la interfaz como los del juego: botones que crecen al apretarlos
// (CCMenuItemSpriteExtra), ButtonSprite, cuadros de 9 partes, popups (FLAlertLayer), casillas,
// deslizadores, campos de texto, listas con desplazamiento y la capa base de cada pantalla.
'use strict';
const U = GD.U = {};
const { Nodo, Sprite, Texto, A, E, D } = GD;

// ---------- cuadro de 9 partes (CCScale9Sprite con las texturas GJ_square0X) ----------
class Cuadro extends Nodo {
  constructor(tex, w, h, borde) {
    super(); this.f = GD.T.m(tex); this.w = w; this.h = h; this.ax = this.ay = 0; this.b = borde || (this.f ? Math.min(this.f.sw, this.f.sh) / 3 : 10);
  }
  pintar(w, o, r, g, b) {
    const f = this.f; if (!f || o <= 0) return;
    const col = GD.col(r, g, b, o), tw = f.tx.w, th = f.tx.h, B = this.b, bp = B * 2; // borde en puntos y en píxeles
    const xs = Cuadro._xs, ys = Cuadro._ys, us = Cuadro._us, vs = Cuadro._vs;
    xs[0] = 0; xs[1] = B; xs[2] = this.w - B; xs[3] = this.w; ys[0] = 0; ys[1] = B; ys[2] = this.h - B; ys[3] = this.h;
    us[0] = f.x; us[1] = f.x + bp; us[2] = f.x + f.w - bp; us[3] = f.x + f.w; vs[0] = f.y + f.h; vs[1] = f.y + f.h - bp; vs[2] = f.y + bp; vs[3] = f.y;
    const X = Cuadro._X, UV = Cuadro._UV, R = GD.R;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const x0 = xs[i], x1 = xs[i + 1], y0 = ys[j], y1 = ys[j + 1];
      if (x1 <= x0 || y1 <= y0) continue;
      R.esquinas(X, w, x0, y0, x1, y1);
      R.uvRect(UV, us[i] / tw, vs[j + 1] / th, us[i + 1] / tw, vs[j] / th);
      R.quad(f.tx, false, 0, X, UV, col);
    }
  }
}
Cuadro._X = new Float32Array(8); Cuadro._UV = new Float32Array(8);
Cuadro._xs = new Float64Array(4); Cuadro._ys = new Float64Array(4); Cuadro._us = new Float64Array(4); Cuadro._vs = new Float64Array(4);
U.Cuadro = Cuadro;
// cuadro negro translúcido cuyo contenido no se oscurece (las cajas de niveles y listas)
U.cajaOscura = function (w, h, op = 125, tex = 'square02_001.png', borde = 15) { const c = new Cuadro(tex, w, h, borde); c.color(0, 0, 0); c.op = op; c.cascada = false; c.cascadaOp = false; return c; };

// ---------- botón ----------
class Boton extends Nodo {
  // contenido: nombre de marco o nodo; f: callback
  constructor(contenido, f, escalaToque = 1.26) {
    super(); this.f = f; this.escalaToque = escalaToque; this.activo = true;
    this.cont = typeof contenido === 'string' ? new Sprite(contenido) : contenido;
    this.w = this.cont.w * this.cont.sx; this.h = this.cont.h * this.cont.sy;
    this.cont.ax = this.cont.ay = 0.5; this.cont.pos(this.w / 2, this.h / 2);
    this.agregar(this.cont); this.base = 1;
  }
  apretar() { this.pararEtq(9); this.correr(A.escala(0.3, this.base * this.escalaToque).e(E.bounceOut).tag(9)); }
  soltar() { this.pararEtq(9); this.correr(A.escala(0.4, this.base).e(E.bounceOut).tag(9)); }
  activar() { if (this.f) this.f(this); }
  set escalaBase(s) { this.base = s; this.escala = s; }
}
U.Boton = Boton;
// menú: reparte toques a sus botones (hijos de cualquier nivel)
U.botones = function (raiz) { const r = []; const rec = n => { if (!n.vis) return; if (n instanceof Boton && n.activo) r.push(n); for (const h of n.hijos) rec(h); }; rec(raiz); return r; };
// texto en botón con fondo (ButtonSprite)
U.botonTexto = function (txt, ancho = 0, fuente = 'goldFont', tex = 'GJ_button_01.png', alto = 30, escala = 0.8) {
  const t = new Texto(txt, fuente); t.escala = escala;
  const w = Math.max(ancho || 0, t.w * t.sx + 20), c = new Cuadro(tex, w, alto, 8);
  t.ax = t.ay = 0.5; t.pos(w / 2, alto / 2 + (fuente === 'goldFont' ? 2 : 1)); c.agregar(t); c.lbl = t;
  if (ancho && t.w * t.sx > ancho - 14) t.escala = escala * (ancho - 14) / (t.w * t.sx);
  return c;
};

// ---------- capa base: fondo, toques a botones, botón atrás ----------
class Capa extends Nodo {
  constructor() { super(); this.w = D.ancho; this.h = D.alto; this.ax = this.ay = 0; }
  alTocar(x, y, id) {
    if (this._pres) return true;
    const bs = U.botones(this).reverse();
    for (const b of bs) if (b.toca(x, y)) { this._pres = b; this._pid = id; b.apretar(); return true; }
    if (this.alTocarFondo) return this.alTocarFondo(x, y, id);
    return true;
  }
  alMover(x, y, id) {
    if (this._pres && id === this._pid) { const den = this._pres.toca(x, y); if (!den && this._pres._den !== false) { this._pres.soltar(); this._pres._den = false; } else if (den && this._pres._den === false) { this._pres.apretar(); this._pres._den = true; } return; }
    if (this.alMoverFondo) this.alMoverFondo(x, y, id);
  }
  alSoltar(x, y, id) {
    const b = this._pres;
    if (b && id === this._pid) { this._pres = null; b.soltar(); const den = b._den !== false; b._den = true; if (den && b.toca(x, y)) b.activar(); return; }
    if (this.alSoltarFondo) this.alSoltarFondo(x, y, id);
  }
  alTecla(c, abajo) { if (abajo && c === 'Escape' && this.atras) this.atras(); }
  fondoDegradado(rgb = [0, 102, 255]) {
    const f = new Sprite('GJ_gradientBG.png'); f.anc(0, 0); f.sx = D.ancho / f.w; f.sy = D.alto / f.h; f.color(rgb); this.agregar(f, -10); return f;
  }
  esquinas() {
    for (const [x, y, fx, fy] of [[0, 0, false, false], [D.ancho, 0, true, false]]) {
      const s = new Sprite('GJ_sideArt_001.png'); s.anc(0, 0); s.fx = fx; s.fy = fy; if (fx) s.anc(1, 0); s.pos(x, y); this.agregar(s, -1);
    }
  }
  botonAtras(f) {
    const b = new Boton('GJ_arrow_01_001.png', f || (() => this.atras && this.atras())); b.pos(25 - b.w / 2, D.alto - 25 - b.h / 2); this.agregar(b, 10);
    return b;
  }
}
U.Capa = Capa;
// botón ubicado por su centro
U.boton = function (padre, contenido, x, y, f, z = 0, esc = 1) {
  const b = new Boton(contenido, f); b.escalaBase = esc; b.ax = b.ay = 0.5; b.pos(x, y); padre.agregar(b, z); return b;
};
U.texto = function (padre, t, x, y, fuente = 'bigFont', esc = 1, z = 0, ancho = 0, alin = 1) {
  const l = new Texto(t, fuente, ancho, alin); l.escala = esc; l.pos(x, y); padre.agregar(l, z); return l;
};
U.sprite = function (padre, f, x, y, esc = 1, z = 0) { const s = new Sprite(f); s.escala = esc; s.pos(x, y); padre.agregar(s, z); return s; };

// ---------- popup (FLAlertLayer) ----------
class Popup extends Capa {
  constructor(w = 360, h = 240, tex = 'GJ_square01.png') {
    super(); this.pw = w; this.ph = h;
    this.velo = new GD.Rect(D.ancho, D.alto, 0, 0, 0, 0); this.agregar(this.velo, -5);
    this.caja = new Nodo(); this.caja.pos(D.ancho / 2, D.alto / 2); this.caja.w = w; this.caja.h = h; this.caja.ax = this.caja.ay = 0;
    this.agregar(this.caja);
    this.fondo = new Cuadro(tex, w, h, 20); this.fondo.pos(-w / 2, -h / 2); this.caja.agregar(this.fondo, -1);
  }
  mostrar(escena = D.escena) {
    this.escena = escena; escena.agregar(this, 1000); D.empujar(this);
    this.velo.correr(A.op(0.14, 150)); this.caja.escala = 0.1;
    this.caja.correr(A.escala(0.5, 1).e(E.elasticOut(0.6)));
    return this;
  }
  cerrar() { D.soltarPila(this); this.sacar(); this.alCerrar && this.alCerrar(); }
  titulo(t, fuente = 'goldFont', esc = 0.9) { return U.texto(this.caja, t, 0, this.ph / 2 - 24, fuente, esc); }
  cerrarBtn(f) { return U.boton(this.caja, 'GJ_closeBtn_001.png', -this.pw / 2 + 8, this.ph / 2 - 8, f || (() => this.cerrar()), 5, 0.8); }
  alTecla(c, abajo) { if (abajo && c === 'Escape') this.cerrar(); }
}
U.Popup = Popup;
// alerta simple: título, texto y uno o dos botones
U.alerta = function (titulo, texto, b1 = 'OK', b2 = null, f1, f2, ancho = 360) {
  const lineas = new Texto(texto, 'chatFont', ancho - 50); const alto = Math.max(140, lineas.h * 0.9 + 110);
  const p = new Popup(ancho, alto);
  p.titulo(titulo);
  lineas.escala = 0.9; lineas.ax = lineas.ay = 0.5; lineas.pos(0, 5); p.caja.agregar(lineas);
  const mk = (t, f, x) => U.boton(p.caja, U.botonTexto(t, 0, 'goldFont', 'GJ_button_01.png', 30, 0.8), x, -alto / 2 + 30, () => { p.cerrar(); f && f(); });
  if (b2) { mk(b1, f1, -60); mk(b2, f2, 60); } else mk(b1, f1, 0);
  return p.mostrar();
};

// ---------- casilla (toggle) ----------
U.casilla = function (padre, x, y, on, f, esc = 0.8) {
  const s = new Sprite(on ? 'GJ_checkOn_001.png' : 'GJ_checkOff_001.png');
  const b = U.boton(padre, s, x, y, () => { b.on = !b.on; s.marco(b.on ? 'GJ_checkOn_001.png' : 'GJ_checkOff_001.png'); f && f(b.on); }, 0, esc);
  b.on = on; b.poner = v => { b.on = v; s.marco(v ? 'GJ_checkOn_001.png' : 'GJ_checkOff_001.png'); };
  return b;
};

// ---------- deslizador ----------
class Deslizador extends Nodo {
  constructor(v, f, ancho = 210) {
    super(); this.v = v; this.f = f;
    this.riel = new Sprite('slidergroove.png'); this.agregar(this.riel, 1);
    this.lleno = new Sprite('sliderBar.png'); this.lleno.anc(0, 0.5); this.agregar(this.lleno, 0);
    this.perilla = new Sprite('sliderthumb.png'); this.agregar(this.perilla, 2);
    this.ancho = this.riel.w - 8; this.w = this.riel.w; this.h = 20; this.ax = this.ay = 0.5; this.riel.pos(this.w / 2, 10);
    this.lleno.pos(4, 10); this.poner(v);
  }
  poner(v) { this.v = GD.clamp(v, 0, 1); this.perilla.pos(4 + this.ancho * this.v, 10); this.lleno.anc(0, 0); this.lleno.pos(4, 10 - this.lleno.h / 2); this.lleno.repX = this.ancho; this.lleno.recorte = this.v; }
  tocar(x, y) { const [lx] = this.aLocal(x, y); this.poner((lx - 4) / this.ancho); this.f && this.f(this.v); }
}
U.Deslizador = Deslizador;

// ---------- campo de texto (CCTextInputNode): un <input> invisible para el teclado del teléfono ----------
class Campo extends Nodo {
  constructor(ph, ancho, alto = 30, fuente = 'bigFont', max = 20, permitidos = null) {
    super(); this.ph = ph; this.valor = ''; this.ancho = ancho; this.max = max; this.permitidos = permitidos;
    this.w = ancho; this.h = alto; this.ax = this.ay = 0.5;
    this.fondo = new Cuadro('square02_small.png', ancho, alto, 5); this.fondo.op = 100; this.agregar(this.fondo, -1);
    this.lbl = new Texto(ph, fuente); this.lbl.ax = this.lbl.ay = 0.5; this.lbl.pos(ancho / 2, alto / 2); this.agregar(this.lbl);
    this.escTexto = 0.6; this.actualizar2();
  }
  set texto(v) { this.valor = String(v); this.actualizar2(); } get texto() { return this.valor; }
  actualizar2() { const vacio = !this.valor; this.lbl.texto(vacio ? this.ph : this.valor + (this.foco && Math.floor(D.tiempo * 2) % 2 ? '|' : '')); this.lbl.color(vacio ? [120, 120, 120] : [255, 255, 255]); this.lbl.escala = this.escTexto; this.lbl.limitar(this.ancho - 10, this.escTexto); }
  enfocar() {
    let inp = document.getElementById('entrada');
    if (!inp) { inp = document.createElement('input'); inp.id = 'entrada'; inp.autocomplete = 'off'; inp.style.cssText = 'position:fixed;left:0;top:0;opacity:0;width:1px;height:1px;font-size:16px'; document.body.appendChild(inp); }
    inp.value = this.valor; inp.maxLength = this.max; this.foco = true; Campo.activo = this;
    inp.oninput = () => { let v = inp.value; if (this.permitidos) v = [...v].filter(c => this.permitidos.includes(c)).join(''); this.valor = v.slice(0, this.max); if (inp.value !== this.valor) inp.value = this.valor; this.actualizar2(); this.alCambiar && this.alCambiar(this.valor); };
    inp.onkeydown = e => { if (e.key === 'Enter') { inp.blur(); } };
    inp.onblur = () => { this.foco = false; this.actualizar2(); if (Campo.activo === this) Campo.activo = null; this.alListo && this.alListo(this.valor); };
    inp.focus();
  }
  alActualizar() { if (this.foco) this.actualizar2(); }
}
U.Campo = Campo;
U.soltarFoco = () => { const i = document.getElementById('entrada'); if (i) i.blur(); };

// ---------- lista con desplazamiento vertical (CustomListView) ----------
class Lista extends Nodo {
  constructor(ancho, alto, altoFila = 90) {
    super(); this.w = ancho; this.h = alto; this.ax = this.ay = 0; this.altoFila = altoFila; this.filas = []; this.off = 0; this.vel = 0;
    this.cont = new Nodo(); this.agregar(this.cont);
  }
  poner(filas) { this.cont.vaciar(); this.filas = filas; let y = 0; for (const f of filas) { f.ax = f.ay = 0; this.cont.agregar(f); f._y = y; y += f.h || this.altoFila; } this.total = y; this.off = 0; this.ubicar(); }
  ubicar() {
    const max = Math.max(0, this.total - this.h); this.off = GD.clamp(this.off, 0, max);
    for (const f of this.filas) { f.y = this.h - (f._y - this.off) - (f.h || this.altoFila); f.vis = f.y < this.h && f.y + (f.h || this.altoFila) > 0; }
  }
  dibujar(pm, op, r, g, b) {
    // recorte del área visible (scissor) para que las filas no se salgan del marco
    const gl = GD.R.gl; GD.R.flush();
    const [x0, y0] = this.aMundo(0, 0), [x1, y1] = this.aMundo(this.w, this.h), k = GD.D.k;
    gl.enable(gl.SCISSOR_TEST); gl.scissor(Math.round(Math.min(x0, x1) * k), Math.round(Math.min(y0, y1) * k), Math.round(Math.abs(x1 - x0) * k), Math.round(Math.abs(y1 - y0) * k));
    super.dibujar(pm, op, r, g, b); GD.R.flush(); gl.disable(gl.SCISSOR_TEST);
  }
  alActualizar(dt) { if (!this.arr && Math.abs(this.vel) > 1) { this.off += this.vel * dt; this.vel *= Math.pow(0.05, dt); this.ubicar(); } }
  empezar(y) { this.arr = { y, off: this.off, t: D.tiempo, mov: 0 }; this.vel = 0; }
  mover(y) { if (!this.arr) return; const dy = y - this.arr.y; this.arr.mov = Math.max(this.arr.mov, Math.abs(dy)); const nuevo = this.arr.off + dy; this.vel = (nuevo - this.off) / Math.max(0.016, D.dt); this.off = nuevo; this.ubicar(); }
  terminar() { const m = this.arr ? this.arr.mov : 0; this.arr = null; return m < 6; }
}
U.Lista = Lista;
// tabla marrón con marco verde (GJListLayer): fondo, costados, barra de arriba con el título y la de abajo
// fondo de una fila de tabla: marrón alternado y una línea oscura abajo (como las celdas del juego)
U.filaTabla = function (f, i) { f.agregar(new GD.Rect(f.w, f.h, ...(i % 2 ? [161, 88, 44] : [194, 114, 62])), -2); f.agregar(new GD.Rect(f.w, 1, 0, 0, 0, 80), -1); };
U.tabla = function (padre, titulo, w = 356, h = 220, x = D.ancho / 2 - w / 2, y = D.alto / 2 - h / 2 - 6) {
  const t = new Nodo(); t.w = w; t.h = h; t.ax = t.ay = 0; t.pos(x, y);
  t.agregar(new GD.Rect(w, h, 191, 114, 62), -3);
  for (const der of [false, true]) { const s = new Sprite('GJ_table_side_001.png'); s.sy = (h + 8) / s.h; s.fx = der; s.pos(der ? w + 5 : -5, h / 2); t.agregar(s, 2); }
  const arr = new Sprite('GJ_table_top_001.png'); arr.pos(w / 2, h + 15); t.agregar(arr, 3);
  const aba = new Sprite('GJ_table_bottom_001.png'); aba.pos(w / 2, -12); t.agregar(aba, 3);
  t.lblTitulo = U.texto(t, titulo, w / 2, h + 19, 'bigFont', 0.8, 4); t.lblTitulo.limitar(w - 90, 0.8);
  padre.agregar(t, 1); return t;
};
// capa con botones dentro de una lista: el toque se decide entre arrastrar o apretar
U.manejarLista = function (capa, lista) {
  const orig = { t: capa.alTocar.bind(capa), m: capa.alMover.bind(capa), s: capa.alSoltar.bind(capa) };
  capa.alTocar = (x, y, id) => {
    if (lista.vis && lista.toca(x, y)) {
      lista.empezar(y); capa._listaId = id; capa._ini = [x, y];
      const bs = U.botones(lista).reverse(); for (const b of bs) if (b.toca(x, y)) { capa._lb = b; b.apretar(); break; }
      return true;
    }
    return orig.t(x, y, id);
  };
  capa.alMover = (x, y, id) => { if (id === capa._listaId) { lista.mover(y); if (capa._lb && Math.abs(y - capa._ini[1]) > 6) { capa._lb.soltar(); capa._lb = null; } return; } orig.m(x, y, id); };
  capa.alSoltar = (x, y, id) => { if (id === capa._listaId) { capa._listaId = null; const click = lista.terminar(); if (capa._lb) { const b = capa._lb; capa._lb = null; b.soltar(); if (click && b.toca(x, y)) b.activar(); } return; } orig.s(x, y, id); };
  capa.alRueda = (dy, x, y) => { if (lista.toca(x, y)) { lista.off += dy * 0.5; lista.ubicar(); } };
};

// ---------- cartel que sube y se va (como los avisos del juego) ----------
U.aviso = function (txt, rgb = [255, 255, 255]) {
  const l = new Texto(txt, 'goldFont'); l.escala = 0.7; l.color(rgb); l.pos(D.ancho / 2, D.alto / 2); D.escena.agregar(l, 5000);
  l.correr(A.sec(A.esperar(0.8), A.junto(A.moverPor(0.6, 0, 30), A.op(0.6, 0)), A.quitar()));
};
// número con separador como el juego
U.num = n => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
