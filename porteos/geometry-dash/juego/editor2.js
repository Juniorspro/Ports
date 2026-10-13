// Interfaz del editor: barra de abajo con pestañas de objetos, menú de edición, botones de los
// costados, ventanas de propiedades (objetos y triggers), grupos, colores, ajustes del nivel,
// canción, pausa del editor, "mis niveles" y la ficha de cada nivel.
'use strict';
(() => {
const ED = GD.Editor, Ed = ED.Editor.prototype;
const { U, D, A, E, Sprite, Texto, Nodo } = GD;
const P = GD.perfil;

// botón cuadrado con un ícono encima (como los ButtonSprite del editor)
ED.botonIcono = function (padre, icono, x, y, f, tam = 38, fondo = 'GJ_button_04.png', escIcono) {
  const c = new U.Cuadro(fondo, tam, tam, 8);
  if (icono) {
    const s = typeof icono === 'string' ? new Sprite(icono) : icono;
    const k = escIcono || Math.min(1, (tam - 8) / Math.max(1, s.w), (tam - 8) / Math.max(1, s.h));
    s.escala = k * (s.sx || 1); s.ax = s.ay = 0.5; s.pos(tam / 2, tam / 2); c.agregar(s); c.icono = s;
  }
  const b = U.boton(padre, c, x, y, f); b.fondoCuadro = c; return b;
};
// muestra de un objeto para la paleta (con sus colores por omisión)
ED.muestra = function (id) {
  const o = new GD.O.Obj({ 1: id, 2: 0, 3: 0, _k: [1, 2, 3] }), n = new Nodo();
  const f = o.partes.length ? o.partes[o.partes.length - 1].f : null; if (!f) return n;
  n.w = f.sw; n.h = f.sh;
  const cols = ED._colsMuestra || (ED._colsMuestra = new GD.O.Colores({ colores: {} }));
  n.pintar = (w) => {
    const m = new Float32Array([w[0], w[1], w[2], w[3], w[0] * n.w / 2 + w[2] * n.h / 2 + w[4], w[1] * n.w / 2 + w[3] * n.h / 2 + w[5]]);
    for (const p of o.partes) { if (p.ct === 'glow') continue; const [r, g, b, a] = GD.O.colorParte(o, p, cols); GD.O.pintarParte(m, p, GD.col(r, g, b, 255 * Math.max(0.6, a)), false); }
  };
  return n;
};

Ed.armarUI = function () {
  const W = D.ancho, H = D.alto, ui = this.ui; ui.vaciar();
  this.altoBarra = 92;
  const barra = new Sprite('edit_barBG_001.png'); barra.anc(0, 0); barra.sx = W / barra.w; barra.sy = this.altoBarra / barra.h; ui.agregar(barra, -1);
  // modos
  this.btnModos = {};
  const modos = [['construir', 'edit_buildBtn_001.png', 'edit_buildSBtn_001.png'], ['editar', 'GJ_editModeBtn_001.png', 'GJ_editModeBtn_001.png'], ['borrar', 'edit_deleteBtn_001.png', 'edit_deleteSBtn_001.png']];
  modos.forEach(([m, f, fs], i) => {
    const s = new Sprite(f); const b = U.boton(ui, s, 42, 76 - i * 30, () => this.ponerModo(m), 2);
    b.escalaBase = Math.min(1, 74 / s.w, 26 / s.h); b.f0 = f; b.f1 = fs; this.btnModos[m] = b;
  });
  this.panel = new Nodo(); ui.agregar(this.panel, 1);
  // arriba a la izquierda
  U.boton(ui, 'GJ_pauseEditorBtn_001.png', 22, H - 22, () => ED.pausa(this), 3, 0.8);
  U.boton(ui, 'GJ_undoBtn_001.png', 62, H - 22, () => this.deshacerUno(), 3, 0.75);
  U.boton(ui, 'GJ_redoBtn_001.png', 100, H - 22, () => this.rehacerUno(), 3, 0.75);
  this.btnTacho = U.boton(ui, 'GJ_trashBtn_001.png', 140, H - 22, () => this.borrarSeleccion(), 3, 0.75);
  // arriba a la derecha
  U.boton(ui, 'GJ_zoomInBtn_001.png', W - 60, H - 22, () => this.zoomCentro(1.25), 3, 0.75);
  U.boton(ui, 'GJ_zoomOutBtn_001.png', W - 22, H - 22, () => this.zoomCentro(0.8), 3, 0.75);
  U.boton(ui, 'GJ_optionsBtn02_001.png', W - 100, H - 22, () => ED.ajustesNivel(this), 3, 0.75);
  // capas del editor
  const izq = U.boton(ui, 'GJ_arrow_02_001.png', W / 2 - 40, H - 20, () => { this.capaEd = Math.max(-1, this.capaEd - 1); this.lblCapa.texto(this.capaEd < 0 ? 'All' : String(this.capaEd)); }, 3, 0.45);
  const der = U.boton(ui, 'GJ_arrow_02_001.png', W / 2 + 40, H - 20, () => { this.capaEd++; this.lblCapa.texto(String(this.capaEd)); }, 3, 0.45); der.cont.fx = true; void izq;
  this.lblCapa = U.texto(ui, 'All', W / 2, H - 20, 'bigFont', 0.55, 3);
  // izquierda: música y probar
  this.btnMusica = U.boton(ui, 'GJ_playMusicBtn_001.png', 25, H / 2 + 50, () => this.musica(), 3, 0.75);
  U.boton(ui, 'GJ_playEditorBtn_001.png', 25, H / 2, () => this.probar(), 3, 0.75);
  // derecha: acciones sobre la selección
  const acc = [['GJ_copyBtn_001.png', () => this.copiar()], ['GJ_pasteBtn_001.png', () => this.pegar()], ['GJ_duplicateBtn_001.png', () => this.duplicar()],
    ['GJ_editObjBtn3_001.png', () => ED.editarObjeto(this)], ['GJ_editObjBtn4_001.png', () => ED.editarEspecial(this)], ['GJ_groupIDBtn_001.png', () => ED.grupos(this)],
    ['GJ_hsvBtn_001.png', () => ED.colorObjeto(this)], ['GJ_deSelBtn_001.png', () => this.seleccionar([])]];
  this.btnAcc = acc.map(([f, cb], i) => { const col = i % 2, fila = Math.floor(i / 2); return U.boton(ui, f, W - 58 + col * 36, H - 70 - fila * 40, cb, 3, 0.55); });
  // interruptores: deslizar, mover libre, girar libre, imán
  this.tgl = {};
  [['swipe', 'edit_swipeBtn_001.png'], ['libre', 'edit_freeMoveBtn_001.png'], ['rotLibre', 'edit_freeRotateBtn_001.png'], ['snap', 'edit_snapBtn_001.png']].forEach(([k, f], i) => {
    const s = new Sprite(f); const b = U.boton(ui, s, W - 38, 78 - i * 21, () => { this[k] = !this[k]; s.color(this[k] ? [255, 255, 255] : [130, 130, 130]); }, 3);
    b.escalaBase = Math.min(1, 60 / s.w, 18 / s.h); s.color(this[k] ? [255, 255, 255] : [130, 130, 130]); this.tgl[k] = b;
  });
  this.ponerModo(this.modo);
};
Ed.zoomCentro = function (k) { const cx = D.ancho / 2, cy = (D.alto + this.altoBarra) / 2; const [wx, wy] = this.aMundo(cx, cy); this.zoom = GD.clamp(this.zoom * k, 0.1, 4); this.camX = wx - cx / this.zoom; this.camY = wy - cy / this.zoom; };
Ed.musica = function () {
  if (this.musicaEd) { this.musicaEd = false; GD.S.pararMusica(); this.btnMusica.cont.marco('GJ_playMusicBtn_001.png'); return; }
  const ruta = ED.rutaCancion(this.n.cancion); if (!ruta) return;
  const x0 = Math.max(0, this.camX + 60); this.xMusica0 = x0; this.musicaEd = true; this.btnMusica.cont.marco('GJ_stopMusicBtn_001.png');
  GD.S.musica(ruta, x0 / GD.O.UPS[this.velIni] + this.offsetCancion, false);
};
Ed.ponerModo = function (m) {
  this.modo = m;
  for (const k in this.btnModos) { const b = this.btnModos[k]; b.cont.marco(k === m ? b.f1 : b.f0); b.cont.color(k === m ? [255, 255, 255] : [160, 160, 160]); }
  this.panel.vaciar();
  if (m === 'construir') this.armarPaleta(); else if (m === 'editar') this.armarEdicion(); else this.armarBorrar();
};
// ---------- pestañas y paleta ----------
Ed.armarPaleta = function () {
  const W = D.ancho, tabs = ED.pestanas(), pn = this.panel;
  const x0 = 95, x1 = W - 80, cols = Math.max(4, Math.floor((x1 - x0) / 40)), porPag = cols * 2;
  const tab = tabs[this.pest] || tabs[0];
  const ids = tab.custom ? (P.objCustom || []).map((_, i) => 'c' + i) : tab.ids;
  const pags = Math.max(1, Math.ceil(ids.length / porPag)); this.pag = GD.clamp(this.pag, 0, pags - 1);
  // pestañas arriba de la barra
  const anchoTab = Math.min(34, (W - 200) / tabs.length);
  tabs.forEach((t, i) => {
    const s = new Sprite(i === this.pest ? 'GJ_tabOn_001.png' : 'GJ_tabOff_001.png'); s.sx = anchoTab / s.w; s.sy = 0.6;
    const n = new Nodo(); n.w = anchoTab; n.h = s.h * 0.6; s.ax = s.ay = 0.5; s.pos(n.w / 2, n.h / 2); n.agregar(s);
    const ic = new Sprite(t.icono); const k = Math.min(16 / Math.max(1, ic.w), 12 / Math.max(1, ic.h)); ic.escala = k; ic.pos(n.w / 2, n.h / 2); n.agregar(ic);
    const b = U.boton(pn, n, W / 2 + (i - (tabs.length - 1) / 2) * anchoTab, this.altoBarra + n.h / 2 - 1, () => { this.pest = i; this.pag = 0; this.armarPaleta2(); }, 0); b.escalaToque = 1.1;
  });
  for (let k = 0; k < porPag; k++) {
    const id = ids[this.pag * porPag + k]; if (id === undefined) break;
    const col = k % cols, fila = Math.floor(k / cols), x = x0 + 20 + col * 40 + ((x1 - x0) - cols * 40) / 2, y = 64 - fila * 40;
    if (typeof id === 'string') { ED.botonCustom(this, pn, +id.slice(1), x, y); continue; }
    const mu = ED.muestra(id);
    const b = ED.botonIcono(pn, mu, x, y, () => { this.objSel = id; this.armarPaleta2(); }, 38, id === this.objSel ? 'GJ_button_02.png' : 'GJ_button_04.png');
    void b;
  }
  if (pags > 1) {
    const izq = U.boton(pn, 'GJ_arrow_01_001.png', x0 - 6, 45, () => { this.pag = (this.pag - 1 + pags) % pags; this.armarPaleta2(); }, 0, 0.45);
    const der = U.boton(pn, 'GJ_arrow_01_001.png', x1 + 6, 45, () => { this.pag = (this.pag + 1) % pags; this.armarPaleta2(); }, 0, 0.45); der.cont.fx = true; void izq;
  }
  if (tab.custom) U.boton(pn, U.botonTexto('+ Save', 60, 'goldFont', 'GJ_button_01.png', 24, 0.5), x1 - 30, 8, () => ED.guardarCustom(this));
};
Ed.armarPaleta2 = function () { this.panel.vaciar(); this.armarPaleta(); };
ED.botonCustom = function (ed, pn, i, x, y) {
  const c = (P.objCustom || [])[i]; if (!c) return;
  const raws = c.map(s => GD.N.objeto(s)); const mu = raws.length ? ED.muestra(raws[0][1]) : new Nodo();
  ED.botonIcono(pn, mu, x, y, () => {
    const cx = ed.enGrilla(ed.camX + D.ancho / 2 / ed.zoom), cy = ed.enGrilla(ed.camY + (D.alto + ed.altoBarra) / 2 / ed.zoom);
    const x0 = raws[0][2], y0 = raws[0][3];
    const nuevos = raws.map(r => { const q = Object.assign({}, r); q._k = r._k.slice(); q[2] = cx + (r[2] - x0); q[3] = cy + (r[3] - y0); const o = new GD.O.Obj(q); ed.objs.push(o); ed.ponerEnSeccion(o); return o; });
    ed.registrar('poner', nuevos); ed.orden(); ed.seleccionar(nuevos);
  }, 38, 'GJ_button_05.png');
};
ED.guardarCustom = function (ed) {
  if (!ed.sel.size) { U.aviso('Select objects first'); return; }
  P.objCustom = P.objCustom || []; P.objCustom.push([...ed.sel].map(o => GD.N.objetoATexto(o.raw))); P.guardar(); ed.armarPaleta2();
};
// ---------- menú de edición ----------
Ed.armarEdicion = function () {
  const pn = this.panel, W = D.ancho;
  const b = (f, x, y, cb, esc) => ED.botonIcono(pn, f, x, y, cb, 36, 'GJ_button_04.png', esc);
  const x0 = 120, paso = 40;
  const fila1 = [['edit_upBtn_001.png', () => this.mover(0, 30)], ['edit_downBtn_001.png', () => this.mover(0, -30)], ['edit_leftBtn_001.png', () => this.mover(-30, 0)], ['edit_rightBtn_001.png', () => this.mover(30, 0)],
    ['edit_upBtn2_001.png', () => this.mover(0, 2)], ['edit_downBtn2_001.png', () => this.mover(0, -2)], ['edit_leftBtn2_001.png', () => this.mover(-2, 0)], ['edit_rightBtn2_001.png', () => this.mover(2, 0)],
    ['edit_upBtn5_001.png', () => this.mover(0, 150)], ['edit_downBtn5_001.png', () => this.mover(0, -150)], ['edit_leftBtn5_001.png', () => this.mover(-150, 0)], ['edit_rightBtn5_001.png', () => this.mover(150, 0)]];
  const fila2 = [['edit_flipXBtn_001.png', () => this.voltear('x')], ['edit_flipYBtn_001.png', () => this.voltear('y')], ['edit_cwBtn_001.png', () => this.girar(90)], ['edit_ccwBtn_001.png', () => this.girar(-90)],
    ['edit_rotate45rBtn_001.png', () => this.girar(45)], ['edit_rotate45lBtn_001.png', () => this.girar(-45)], ['edit_upBtn3_001.png', () => this.mover(0, 15)], ['edit_downBtn3_001.png', () => this.mover(0, -15)],
    ['edit_leftBtn3_001.png', () => this.mover(-15, 0)], ['edit_rightBtn3_001.png', () => this.mover(15, 0)], ['edit_scaleBtn_001.png', () => ED.escalaPopup(this)], ['edit_rotateSnapBtn_001.png', () => ED.giroPopup(this)]];
  const cols = Math.max(6, Math.floor((W - 200) / paso)), tot = fila1.concat(fila2);
  this.pagEd = this.pagEd || 0; const porPag = cols * 2, pags = Math.ceil(tot.length / porPag); this.pagEd %= pags;
  tot.slice(this.pagEd * porPag, this.pagEd * porPag + porPag).forEach(([f, cb], k) => b(f, x0 + (k % cols) * paso, 64 - Math.floor(k / cols) * 40, cb));
  if (pags > 1) { const der = U.boton(pn, 'GJ_arrow_01_001.png', W - 80, 45, () => { this.pagEd++; this.ponerModo('editar'); }, 0, 0.45); der.cont.fx = true; }
};
Ed.armarBorrar = function () {
  const pn = this.panel, W = D.ancho;
  U.texto(pn, 'Tap objects to delete them', W / 2, 62, 'goldFont', 0.6);
  U.boton(pn, U.botonTexto('Delete Selected', 140, 'goldFont', 'GJ_button_06.png', 28, 0.6), W / 2 - 80, 25, () => this.borrarSeleccion());
  U.boton(pn, U.botonTexto('Delete All Of Type', 160, 'goldFont', 'GJ_button_06.png', 28, 0.6), W / 2 + 90, 25, () => {
    const ids = new Set([...this.sel].map(o => o.id)); if (!ids.size) { U.aviso('Select an object first'); return; }
    const l = this.objs.filter(o => ids.has(o.id)); for (const o of l) this.quitarObjeto(o); this.registrar('quitar', l); this.orden();
  });
};
Ed.actualizarBotones = function () { if (this.btnTacho) this.btnTacho.cont.op = this.sel.size ? 255 : 120; };
ED.escalaPopup = function (ed) {
  if (!ed.sel.size) return;
  const pop = new U.Popup(320, 170), k = pop.caja; pop.titulo('Scale');
  const o = [...ed.sel][0]; let v = o.raw[32] !== undefined ? +o.raw[32] : 1;
  const lbl = U.texto(k, v.toFixed(2), 0, 30, 'bigFont', 0.7);
  const d = new U.Deslizador((v - 0.5) / 1.5, x => { v = Math.round((0.5 + x * 1.5) * 20) / 20; lbl.texto(v.toFixed(2)); }); d.pos(0, 0); k.agregar(d);
  pop.alTocarFondo = (x, y) => { if (d.toca(x, y)) { pop._des = d; d.tocar(x, y); } return true; }; pop.alMoverFondo = (x, y) => { if (pop._des) pop._des.tocar(x, y); }; pop.alSoltarFondo = () => { pop._des = null; };
  U.boton(k, U.botonTexto('OK', 60), 0, -55, () => { pop.cerrar(); ed.modificar(r => { r[32] = v; }); });
  pop.mostrar();
};
ED.giroPopup = function (ed) {
  if (!ed.sel.size) return;
  const pop = new U.Popup(320, 170), k = pop.caja; pop.titulo('Rotate');
  let v = 0; const lbl = U.texto(k, '0°', 0, 30, 'bigFont', 0.7);
  const d = new U.Deslizador(0.5, x => { v = Math.round((x - 0.5) * 360); lbl.texto(v + '°'); }); d.pos(0, 0); k.agregar(d);
  pop.alTocarFondo = (x, y) => { if (d.toca(x, y)) { pop._des = d; d.tocar(x, y); } return true; }; pop.alMoverFondo = (x, y) => { if (pop._des) pop._des.tocar(x, y); }; pop.alSoltarFondo = () => { pop._des = null; };
  U.boton(k, U.botonTexto('OK', 60), 0, -55, () => { pop.cerrar(); ed.girar(v); });
  pop.mostrar();
};

// ---------- formulario genérico de propiedades ----------
// campos: [clave, etiqueta, tipo, extra]; tipos: n (número), i (entero), b (casilla), e (easing), c (color), t (texto), s (selector de lista)
ED.EASINGS = ['None', 'Ease In Out', 'Ease In', 'Ease Out', 'Elastic In Out', 'Elastic In', 'Elastic Out', 'Bounce In Out', 'Bounce In', 'Bounce Out', 'Exponential In Out', 'Exponential In', 'Exponential Out', 'Sine In Out', 'Sine In', 'Sine Out', 'Back In Out', 'Back In', 'Back Out'];
ED.formulario = function (ed, titulo, campos, objs, despues) {
  const porPag = 8; let pag = 0;
  const raw = objs[0].raw, vals = {};
  for (const [k, , t, ex] of campos) { const v = raw[k]; vals[k] = v === undefined ? (ex && ex.def !== undefined ? ex.def : t === 'b' ? 0 : t === 't' ? '' : 0) : v; }
  const pop = new U.Popup(Math.min(D.ancho - 20, 460), 290), k = pop.caja; pop.titulo(titulo, 'goldFont', 0.75);
  const cuerpo = new Nodo(); k.agregar(cuerpo);
  const armar = () => {
    cuerpo.vaciar(); U.soltarFoco();
    const lista = campos.slice(pag * porPag, pag * porPag + porPag);
    lista.forEach(([key, et, t, ex], i) => {
      const col = i % 2, fila = Math.floor(i / 2), x = col ? 105 : -105, y = 75 - fila * 48;
      U.texto(cuerpo, et, x, y + 14, 'goldFont', 0.45).limitar(190, 0.45);
      if (t === 'b') { U.casilla(cuerpo, x, y - 6, vals[key] == 1, v => { vals[key] = v ? 1 : 0; }, 0.6); return; }
      if (t === 'e') { const btn = U.boton(cuerpo, U.botonTexto(ED.EASINGS[vals[key] | 0], 150, 'goldFont', 'GJ_button_04.png', 24, 0.45), x, y - 6, () => { vals[key] = ((vals[key] | 0) + 1) % ED.EASINGS.length; btn.cont.lbl.texto(ED.EASINGS[vals[key]]); }); return; }
      if (t === 's') { const ops = ex.ops; const btn = U.boton(cuerpo, U.botonTexto(ops[vals[key] | 0] || String(vals[key]), 150, 'goldFont', 'GJ_button_04.png', 24, 0.45), x, y - 6, () => { vals[key] = ((vals[key] | 0) + 1) % ops.length; btn.cont.lbl.texto(ops[vals[key]]); }); return; }
      if (t === 'c') { const muestra = new Sprite('GJ_colorBtn_001.png'); muestra.escala = 0.55; const rgbK = ex.claves; muestra.color(+(vals[rgbK[0]] ?? 255), +(vals[rgbK[1]] ?? 255), +(vals[rgbK[2]] ?? 255)); U.boton(cuerpo, muestra, x, y - 6, () => ED.selectorColor([+(vals[rgbK[0]] ?? 255), +(vals[rgbK[1]] ?? 255), +(vals[rgbK[2]] ?? 255)], rgb => { [vals[rgbK[0]], vals[rgbK[1]], vals[rgbK[2]]] = rgb.map(Math.round); muestra.color(rgb); })); return; }
      const campo = new U.Campo('0', 110, 26, 'bigFont', t === 't' ? 200 : 10, t === 't' ? null : '0123456789.-'); campo.escTexto = 0.5;
      campo.texto = t === 't' ? GD.N.texto64(vals[key]) : String(vals[key]); campo.pos(x, y - 6); cuerpo.agregar(campo);
      campo.alCambiar = v => { vals[key] = t === 't' ? GD.N.a64(v) : (t === 'i' ? parseInt(v || '0', 10) : parseFloat(v || '0')) || 0; };
      const b = U.boton(cuerpo, new Nodo(), x, y - 6, () => campo.enfocar()); b.w = 110; b.h = 26; b.cont.w = 110; b.cont.h = 26;
      // flechitas para sumar/restar sin teclado
      if (t !== 't') {
        const paso = ex && ex.paso || (t === 'i' ? 1 : 0.1);
        const menos = U.boton(cuerpo, 'GJ_arrow_03_001.png', x - 68, y - 6, () => { vals[key] = +(+vals[key] - paso).toFixed(3); if (ex && ex.min !== undefined) vals[key] = Math.max(ex.min, vals[key]); campo.texto = String(vals[key]); }, 1, 0.35);
        const mas = U.boton(cuerpo, 'GJ_arrow_03_001.png', x + 68, y - 6, () => { vals[key] = +(+vals[key] + paso).toFixed(3); if (ex && ex.max !== undefined) vals[key] = Math.min(ex.max, vals[key]); campo.texto = String(vals[key]); }, 1, 0.35);
        mas.cont.fx = true; void menos;
      }
    });
    const pags = Math.ceil(campos.length / porPag);
    if (pags > 1) {
      U.texto(cuerpo, `${pag + 1}/${pags}`, 0, -110, 'goldFont', 0.45);
      const der = U.boton(cuerpo, 'GJ_arrow_01_001.png', k.w / 2 - 20, -20, () => { pag = (pag + 1) % pags; armar(); }, 2, 0.5); der.cont.fx = true;
      U.boton(cuerpo, 'GJ_arrow_01_001.png', -k.w / 2 + 20, -20, () => { pag = (pag - 1 + pags) % pags; armar(); }, 2, 0.5);
    }
  };
  k.w = pop.pw; armar();
  U.boton(k, U.botonTexto('OK', 60), 0, -125, () => {
    U.soltarFoco(); pop.cerrar();
    ed.modificar(r => { for (const [key] of campos) { const v = vals[key]; if (v === '' || v === undefined) delete r[key]; else r[key] = v; } }, objs);
    despues && despues();
  });
  pop.mostrar();
};

// ---------- ventanas de triggers ----------
const C = { // campos comunes
  grupo: [51, 'Target Group ID', 'i', { min: 0, max: 9999 }], dur: [10, 'Duration', 'n', { def: 0.5, min: 0, paso: 0.1 }],
  easing: [30, 'Easing', 'e'], tasa: [85, 'Easing Rate', 'n', { def: 2, paso: 0.1 }], toque: [11, 'Touch Triggered', 'b'], spawn: [62, 'Spawn Triggered', 'b'], multi: [87, 'Multi Trigger', 'b'],
  activar: [56, 'Activate Group', 'b'], item: [80, 'Item ID', 'i'], grupo2: [71, 'Center/Target Group', 'i'],
};
const FIN = [C.toque, C.spawn, C.multi];
ED.CAMPOS = {
  color: [[7, 'Color', 'c', { claves: [7, 8, 9] }], [35, 'Opacity', 'n', { def: 1, min: 0, max: 1, paso: 0.05 }], C.dur, [17, 'Blending', 'b'], [15, 'Player Color 1', 'b'], [16, 'Player Color 2', 'b'], [23, 'Target Color ID', 'i', { def: 1, min: 1, max: 1101 }], [50, 'Copy Color ID', 'i'], [49, 'Copy HSV (h a s a v a s v)', 't'], [60, 'Copy Opacity', 'b'], ...FIN],
  mover: [C.grupo, [28, 'Move X', 'n', { paso: 10 }], [29, 'Move Y', 'n', { paso: 10 }], C.dur, C.easing, C.tasa, [58, 'Lock To Player X', 'b'], [59, 'Lock To Player Y', 'b'], [100, 'Target Mode', 'b'], C.grupo2, [101, 'Target Axis (0 XY/1 X/2 Y)', 'i'], [393, 'Small Step', 'b'], ...FIN],
  parar: [C.grupo, ...FIN],
  pulso: [[7, 'Color', 'c', { claves: [7, 8, 9] }], [45, 'Fade In', 'n', { paso: 0.1 }], [46, 'Hold', 'n', { paso: 0.1 }], [47, 'Fade Out', 'n', { paso: 0.1 }], [51, 'Target ID', 'i'], [52, 'Target Is Group', 'b'], [48, 'Use HSV', 'b'], [49, 'HSV', 't'], [50, 'Copy Color ID', 'i'], [65, 'Main Only', 'b'], [66, 'Detail Only', 'b'], [86, 'Exclusive', 'b'], ...FIN],
  alpha: [C.grupo, [35, 'Opacity', 'n', { def: 1, min: 0, max: 1, paso: 0.05 }], C.dur, ...FIN],
  toggle: [C.grupo, C.activar, ...FIN],
  spawn: [C.grupo, [63, 'Delay', 'n', { paso: 0.1 }], [556, 'Delay Variance', 'n', { paso: 0.1 }], [441, 'Spawn Ordered', 'b'], ...FIN],
  rotar: [C.grupo, C.grupo2, [68, 'Degrees', 'n', { paso: 15 }], [69, 'Times 360', 'i'], C.dur, C.easing, C.tasa, [70, 'Lock Object Rotation', 'b'], ...FIN],
  seguir: [C.grupo, [71, 'Follow Group ID', 'i'], [72, 'X Mod', 'n', { def: 1, paso: 0.1 }], [73, 'Y Mod', 'n', { def: 1, paso: 0.1 }], C.dur, ...FIN],
  temblor: [[75, 'Strength', 'n', { def: 1 }], [84, 'Interval', 'n', { paso: 0.01 }], C.dur, ...FIN],
  animar: [C.grupo, [76, 'Animation ID', 'i'], ...FIN],
  tocar: [C.grupo, [81, 'Hold Mode', 'b'], [82, 'Toggle Mode (0/1 on/2 off)', 'i'], [89, 'Dual Mode', 'b'], ...FIN],
  contar: [C.item, [77, 'Target Count', 'i'], C.grupo, C.activar, [104, 'Multi Activate', 'b'], ...FIN],
  contarYa: [C.item, [77, 'Target Count', 'i'], C.grupo, C.activar, [88, 'Compare (0 = / 1 > / 2 <)', 'i'], ...FIN],
  recoger: [C.item, [77, 'Count', 'i', { def: 1 }], [78, 'Subtract', 'b'], [79, 'Override', 'b'], ...FIN],
  seguirY: [C.grupo, [90, 'Speed', 'n', { def: 1, paso: 0.1 }], [91, 'Delay', 'n', { paso: 0.1 }], [92, 'Offset', 'n', { paso: 5 }], [105, 'Max Speed', 'n'], C.dur, ...FIN],
  colision: [[80, 'Block A ID', 'i'], [95, 'Block B ID', 'i'], [138, 'Player 1', 'b'], [200, 'Player 2', 'b'], C.grupo, C.activar, [93, 'Trigger On Exit', 'b'], ...FIN],
  alMorir: [C.grupo, C.activar, ...FIN],
  camZoom: [[371, 'Zoom', 'n', { def: 1, paso: 0.1, min: 0.4, max: 3 }], C.dur, C.easing, ...FIN],
  camOffset: [[28, 'Offset X', 'n', { paso: 10 }], [29, 'Offset Y', 'n', { paso: 10 }], C.dur, C.easing, ...FIN],
  camEstatica: [[71, 'Target Group ID', 'i'], C.dur, C.easing, [110, 'Exit Static', 'b'], [58, 'Only X', 'b'], [59, 'Only Y', 'b'], ...FIN],
  camRotar: [[68, 'Degrees', 'n', { paso: 15 }], C.dur, C.easing, [70, 'Add', 'b'], ...FIN],
  sfx: [[392, 'SFX ID', 'i'], [406, 'Volume', 'n', { def: 1, paso: 0.1 }], [404, 'Pitch', 'n', { paso: 1 }], [405, 'Speed', 'n', { def: 1, paso: 0.1 }], ...FIN],
  gravedad: [[148, 'Gravity', 'n', { def: 1, paso: 0.1 }], ...FIN],
  escalaTiempo: [[120, 'Time Mod', 'n', { def: 1, paso: 0.1 }], C.dur, ...FIN],
  teleport: [C.grupo, ...FIN], fin: [[460, 'No Effects', 'b'], ...FIN],
  azar: [[51, 'Group ID 1', 'i'], [71, 'Group ID 2', 'i'], [10, 'Chance %', 'n', { def: 50 }], ...FIN],
  azarAvanzado: [[152, 'Groups (id.weight.id.weight)', 't'], ...FIN],
  secuencia: [[435, 'Sequence (id.count...)', 't'], [436, 'Loop', 'b'], ...FIN],
  itemEdit: [[80, 'Item A', 'i'], [95, 'Item B', 'i'], [51, 'Target Item', 'i'], [479, 'Mod', 'n', { def: 1 }], [480, 'Assign (0 = 1 += 2 -= 3 *= 4 /=)', 'i'], [481, 'Op (0 + 1 - 2 * 3 /)', 'i'], [485, 'Round', 'b'], ...FIN],
  itemCompare: [[80, 'Item A', 'i'], [95, 'Item B', 'i'], [479, 'Mod A', 'n', { def: 1 }], [483, 'Mod B', 'n', { def: 1 }], [565, 'Compare (0 = 1 > 2 >= 3 < 4 <= 5 !=)', 'i'], [51, 'True Group', 'i'], [71, 'False Group', 'i'], ...FIN],
  tiempo: [C.item, [467, 'Start Time', 'n'], [470, 'Time Mod', 'n', { def: 1 }], [468, 'Count Down', 'b'], [473, 'Target Time', 'n'], [469, 'Stop At Target', 'b'], C.grupo, ...FIN],
  eventoTiempo: [C.item, [473, 'Target Time', 'n'], C.grupo, [475, 'Multi Activate', 'b'], ...FIN],
  controlTiempo: [C.item, [472, 'Stop', 'b'], ...FIN],
  escalar: [C.grupo, C.grupo2, [150, 'Scale X', 'n', { def: 1, paso: 0.1 }], [151, 'Scale Y', 'n', { def: 1, paso: 0.1 }], C.dur, C.easing, [133, 'Only Move', 'b'], ...FIN],
};
ED.editarEspecial = function (ed) {
  if (!ed.sel.size) return;
  const objs = [...ed.sel], o = objs[0], tipo = GD.TR.def[o.id];
  if (o.id === 31) return ED.formulario(ed, 'Start Pos', [['kA2', 'Mode (0 cube … 7 swing)', 'i'], ['kA4', 'Speed (0 1x/1 0.5x/2 2x/3 3x/4 4x)', 'i'], ['kA3', 'Mini', 'b'], ['kA8', 'Dual', 'b'], ['kA11', 'Flip Gravity', 'b'], ['kA28', 'Mirror', 'b']], objs);
  if (o.id === 1816 || o.id === 3643) return ED.formulario(ed, 'Collision Block', [[80, 'Block ID', 'i'], [94, 'Dynamic', 'b']], objs);
  if (o.ty === GD.O.TIPO.COLECCIONABLE) return ED.formulario(ed, 'Pickup Item', [[80, 'Item ID', 'i'], [381, 'Pickup Mode', 'b'], [51, 'Toggle Group', 'i']], objs);
  if (o.ty === GD.O.TIPO.ARO_CUSTOM || o.ty === GD.O.TIPO.TELEPORT || o.ty === GD.O.TIPO.ARO_TELEPORT) return ED.formulario(ed, 'Orb', [C.grupo, C.activar, [54, 'Teleport Y Offset', 'n'], [99, 'Multi Activate', 'b']], objs);
  if (/^(ring|bump|gravring|gravbump)/.test(o.d.t)) return ED.formulario(ed, 'Orb / Pad', [[51, 'Activate Group (2.2)', 'i'], [99, 'Multi Activate', 'b']], objs);
  if (tipo && ED.CAMPOS[tipo]) return ED.formulario(ed, (o.d.t || 'Trigger').replace(/^edit_e|Btn_001\.png$|Btn\.png/g, '') + ' Trigger', ED.CAMPOS[tipo], objs);
  if (o.id === 914) return ED.formulario(ed, 'Text', [[31, 'Text', 't']], objs);
  if (tipo) return ED.formulario(ed, 'Trigger', FIN.concat([C.grupo]), objs);
  U.aviso('No special settings');
};
// ---------- editar objeto: colores, capas, opciones ----------
ED.CAPAS_Z = ['B5', 'B4', 'B3', 'B2', 'B1', 'Default', 'T1', 'T2', 'T3', 'T4'];
ED.VAL_Z = [-5, -3, -1, 1, 3, 0, 5, 7, 9, 11];
ED.editarObjeto = function (ed) {
  if (!ed.sel.size) return;
  const objs = [...ed.sel], o = objs[0];
  if (GD.TR.def[o.id] || o.id === 31) return ED.editarEspecial(ed);
  const zi = ED.VAL_Z.indexOf(o.raw[24] !== undefined ? +o.raw[24] : 0);
  const campos = [[21, 'Main Color ID', 'i', { def: o.c1 > 0 ? o.c1 : 0 }], [22, 'Detail Color ID', 'i', { def: o.c2 > 0 ? o.c2 : 0 }], ['_z', 'Z Layer', 's', { ops: ED.CAPAS_Z, def: zi < 0 ? 5 : zi }], [25, 'Z Order', 'i', { def: o.orden }],
    [20, 'Editor Layer 1', 'i'], [61, 'Editor Layer 2', 'i'], [64, "Don't Fade", 'b'], [67, "Don't Enter", 'b'], [96, 'No Glow', 'b'], [121, 'No Touch', 'b'], [135, 'Hide', 'b'], [103, 'High Detail', 'b'],
    [116, 'No Effects', 'b'], [34, 'Group Parent', 'b'], [496, 'Area Parent', 'b'], [507, 'Passable', 'b']];
  ED.formulario(ed, 'Edit Object', campos, objs, () => {
    ed.modificar(r => { if (r._z !== undefined) { r[24] = ED.VAL_Z[r._z | 0]; delete r._z; if (!r[24]) delete r[24]; } }, objs);
  });
};
ED.colorObjeto = function (ed) {
  if (!ed.sel.size) return;
  const objs = [...ed.sel];
  ED.formulario(ed, 'HSV', [[41, 'Main HSV On', 'b'], [43, 'Main HSV (h a s a v a s v)', 't'], [42, 'Detail HSV On', 'b'], [44, 'Detail HSV', 't']], objs);
};
// grupos (SetGroupIDLayer)
ED.grupos = function (ed) {
  if (!ed.sel.size) return;
  const objs = [...ed.sel];
  const pop = new U.Popup(380, 250), k = pop.caja; pop.titulo('Groups');
  const comunes = () => { let s = null; for (const o of objs) { const g = new Set(GD.N.grupos(o.raw) || []); s = s ? new Set([...s].filter(x => g.has(x))) : g; } return [...(s || [])].sort((a, b) => a - b); };
  const campo = new U.Campo('Group ID', 100, 30, 'bigFont', 4, '0123456789'); campo.pos(-40, 60); k.agregar(campo);
  const libre = () => { const usados = new Set(); for (const o of ed.objs) for (const g of GD.N.grupos(o.raw) || []) usados.add(g); let g = 1; while (usados.has(g)) g++; return g; };
  U.boton(k, new Nodo(), -40, 60, () => campo.enfocar()).w = 100;
  U.boton(k, U.botonTexto('Add', 55, 'goldFont', 'GJ_button_01.png', 28, 0.6), 55, 60, () => { const g = parseInt(campo.texto || '0', 10); if (g > 0) { cambiar(g, true); campo.texto = ''; } });
  U.boton(k, U.botonTexto('Next Free', 90, 'goldFont', 'GJ_button_02.png', 28, 0.55), 135, 60, () => { campo.texto = String(libre()); });
  const lista = new Nodo(); k.agregar(lista);
  const cambiar = (g, poner) => {
    ed.modificar(r => { const gs = new Set(GD.N.grupos(r) || []); if (poner) { if (gs.size < 10) gs.add(g); } else gs.delete(g); if (gs.size) r[57] = [...gs].join('.'); else delete r[57]; }, objs);
    armar();
  };
  const armar = () => { lista.vaciar(); comunes().forEach((g, i) => { U.boton(lista, U.botonTexto(String(g), 50, 'goldFont', 'GJ_button_04.png', 26, 0.55), -125 + (i % 5) * 62, 15 - Math.floor(i / 5) * 32, () => cambiar(g, false)); }); };
  armar();
  U.texto(k, 'Tap a group to remove it', 0, -60, 'chatFont', 0.6);
  U.boton(k, U.botonTexto('OK', 60), 0, -95, () => { U.soltarFoco(); pop.cerrar(); });
  pop.mostrar();
};

// ---------- selector de color (CCControlColourPicker) ----------
ED.selectorColor = function (rgb, f) {
  const pop = new U.Popup(360, 260), k = pop.caja; pop.titulo('Select Color');
  let [h, s, v] = GD.O.rgbAHsv(...rgb);
  const cuadro = new Nodo(); cuadro.w = 150; cuadro.h = 150; cuadro.ax = cuadro.ay = 0; cuadro.pos(-150, -75); k.agregar(cuadro);
  const barra = new Nodo(); barra.w = 24; barra.h = 150; barra.ax = barra.ay = 0; barra.pos(15, -75); k.agregar(barra);
  const muestra = new GD.Rect(70, 50, 0, 0, 0, 255); muestra.pos(60, 30); k.agregar(muestra);
  const lbl = U.texto(k, '', 95, -10, 'chatFont', 0.6);
  const uv = new Float32Array(8).fill(0.5);
  cuadro.pintar = (w) => {
    const P = (x, y) => [w[0] * x + w[2] * y + w[4], w[1] * x + w[3] * y + w[5]];
    const hue = GD.O.hsvARgb(h, 1, 1);
    const xs = new Float32Array([...P(0, 150), ...P(150, 150), ...P(0, 0), ...P(150, 0)]);
    GD.R.quad4(GD.R.blanco, false, xs, uv, [GD.col(255, 255, 255, 255), GD.col(hue[0], hue[1], hue[2], 255), GD.col(0, 0, 0, 255), GD.col(0, 0, 0, 255)]);
    const cx = s * 150, cy = v * 150, m = P(cx - 3, cy + 3), n = P(cx + 3, cy - 3);
    GD.R.quad(GD.R.blanco, false, 0, new Float32Array([m[0], m[1], n[0], m[1], m[0], n[1], n[0], n[1]]), uv, GD.col(255, 255, 255, 255));
  };
  barra.pintar = (w) => {
    const P = (x, y) => [w[0] * x + w[2] * y + w[4], w[1] * x + w[3] * y + w[5]];
    for (let i = 0; i < 6; i++) {
      const a = GD.O.hsvARgb(i * 60, 1, 1), b = GD.O.hsvARgb((i + 1) * 60, 1, 1), y0 = i * 25, y1 = y0 + 25;
      const xs = new Float32Array([...P(0, y1), ...P(24, y1), ...P(0, y0), ...P(24, y0)]);
      GD.R.quad4(GD.R.blanco, false, xs, uv, [GD.col(...b, 255), GD.col(...b, 255), GD.col(...a, 255), GD.col(...a, 255)]);
    }
    const y = h / 360 * 150, m = P(-3, y + 2), n = P(27, y - 2);
    GD.R.quad(GD.R.blanco, false, 0, new Float32Array([m[0], m[1], n[0], m[1], m[0], n[1], n[0], n[1]]), uv, GD.col(255, 255, 255, 255));
  };
  const act = () => { const c = GD.O.hsvARgb(h, s, v); muestra.color(c); lbl.texto(c.map(Math.round).join(', ')); return c; };
  act();
  const tocar = (x, y) => {
    if (cuadro.toca(x, y) || pop._en === 'c') { const [lx, ly] = cuadro.aLocal(x, y); s = GD.clamp(lx / 150, 0, 1); v = GD.clamp(ly / 150, 0, 1); pop._en = 'c'; }
    else if (barra.toca(x, y) || pop._en === 'b') { const [, ly] = barra.aLocal(x, y); h = GD.clamp(ly / 150, 0, 0.9999) * 360; pop._en = 'b'; }
    act();
  };
  pop.alTocarFondo = (x, y) => { pop._en = null; tocar(x, y); return true; }; pop.alMoverFondo = tocar; pop.alSoltarFondo = () => { pop._en = null; };
  // colores rápidos del jugador
  GD.COLORES.slice(0, 12).forEach((c, i) => { const q = new Sprite('GJ_colorBtn_001.png'); q.color(c); q.escala = 0.35; U.boton(k, q, 60 + (i % 6) * 22, -50 - Math.floor(i / 6) * 22, () => { [h, s, v] = GD.O.rgbAHsv(...c); act(); }); });
  U.boton(k, U.botonTexto('OK', 60), 0, -110, () => { pop.cerrar(); f(act()); });
  pop.mostrar();
};

// ---------- ajustes del nivel (LevelSettingsLayer) ----------
ED.ajustesNivel = function (ed) {
  const pop = new U.Popup(Math.min(D.ancho - 20, 470), 300), k = pop.caja; pop.titulo('Level Settings', 'goldFont', 0.8);
  const aj = ed.nv.ajustes, set = (kk, v) => { aj[kk] = String(v); ed.cambios = true; };
  const get = (kk, def = 0) => aj[kk] === undefined || aj[kk] === '' ? def : +aj[kk];
  const fila = (y, etiqueta, cb) => { U.texto(k, etiqueta, -170, y, 'goldFont', 0.5).anc(0, 0.5); cb(y); };
  const ciclo = (x, y, ops, kk, def = 0, despues) => {
    const b = U.boton(k, U.botonTexto(ops[get(kk, def)] || ops[0], 110, 'goldFont', 'GJ_button_04.png', 24, 0.45), x, y, () => { const v = (get(kk, def) + 1) % ops.length; set(kk, v); b.cont.lbl.texto(ops[v]); despues && despues(); });
    return b;
  };
  fila(100, 'Mode', y => ciclo(-20, y, ['Cube', 'Ship', 'Ball', 'UFO', 'Wave', 'Robot', 'Spider', 'Swing'], 'kA2'));
  fila(100, '', y => ciclo(110, y, ['Normal 1x', 'Slow 0.5x', 'Fast 2x', 'Faster 3x', 'Fastest 4x'], 'kA4'));
  fila(70, 'Mini', y => U.casilla(k, -60, y, get('kA3') == 1, v => set('kA3', v ? 1 : 0), 0.5));
  U.texto(k, 'Dual', -10, 70, 'goldFont', 0.5); U.casilla(k, 25, 70, get('kA8') == 1, v => set('kA8', v ? 1 : 0), 0.5);
  U.texto(k, 'Flip Grav', 85, 70, 'goldFont', 0.5); U.casilla(k, 135, 70, get('kA11') == 1, v => set('kA11', v ? 1 : 0), 0.5);
  fila(40, 'Platformer', y => U.casilla(k, -40, y, get('kA22') == 1, v => set('kA22', v ? 1 : 0), 0.5));
  U.texto(k, '2-Player', 50, 40, 'goldFont', 0.5); U.casilla(k, 100, 40, get('kA10') == 1, v => set('kA10', v ? 1 : 0), 0.5);
  const nn = n => String(n).padStart(2, '0');
  const elegir = (titulo, prefijo, total, kk, alElegir) => {
    const p2 = new U.Popup(Math.min(D.ancho - 20, 460), 260), k2 = p2.caja; p2.titulo(titulo);
    let pg = 0; const g = new Nodo(); k2.agregar(g);
    const arm = () => { g.vaciar(); for (let i = 0; i < 12; i++) { const n = pg * 12 + i + 1; if (n > total) break; const f = `${prefijo}_${nn(n)}_001.png`; if (!GD.T.m(f)) continue; U.boton(g, f, -150 + (i % 6) * 60, 50 - Math.floor(i / 6) * 70, () => { set(kk, n); p2.cerrar(); alElegir && alElegir(); }, 0, 0.8); if (get(kk, 1) == n) U.sprite(g, 'GJ_select_001.png', -150 + (i % 6) * 60, 50 - Math.floor(i / 6) * 70, 0.8, 2); } };
    arm();
    if (total > 12) { const d = U.boton(k2, 'GJ_arrow_01_001.png', 205, 0, () => { pg = (pg + 1) % Math.ceil(total / 12); arm(); }, 1, 0.5); d.cont.fx = true; U.boton(k2, 'GJ_arrow_01_001.png', -205, 0, () => { pg = (pg - 1 + Math.ceil(total / 12)) % Math.ceil(total / 12); arm(); }, 1, 0.5); }
    p2.cerrarBtn(); p2.mostrar();
  };
  const recargar = async () => { ed.cargarAjustes(); await ed.cargarFondo(); };
  fila(5, 'Background', y => U.boton(k, `bgIcon_${nn(Math.max(1, get('kA6', 1)))}_001.png`, -40, y, () => elegir('Background', 'bgIcon', 59, 'kA6', recargar), 0, 0.5));
  U.texto(k, 'Ground', 30, 5, 'goldFont', 0.5); U.boton(k, `gIcon_${nn(Math.max(1, get('kA7', 1)))}_001.png`, 90, 5, () => elegir('Ground', 'gIcon', 22, 'kA7', recargar), 0, 0.5);
  U.texto(k, 'MG', 140, 5, 'goldFont', 0.5); ciclo(185, 5, ['None', 'MG 1', 'MG 2', 'MG 3'], 'kA25', 0, recargar).escalaBase = 0.7;
  fila(-30, 'Line', y => ciclo(-20, y, ['Line 1', 'Line 1', 'Line 2'], 'kA17', 1));
  U.texto(k, 'Font', 60, -30, 'goldFont', 0.5); ciclo(130, -30, [...Array(60)].map((_, i) => 'Font ' + (i + 1)), 'kA18');
  fila(-65, 'Song', y => {
    const c = ed.n.cancion || { oficial: 0 };
    const nombre = () => c.ng ? `NG ${c.ng}` : ED.NOMBRES_CANCION[c.oficial | 0];
    const b = U.boton(k, U.botonTexto(nombre(), 200, 'goldFont', 'GJ_button_04.png', 26, 0.5), 20, y, () => ED.elegirCancion(ed, () => b.cont.lbl.texto(nombre())));
  });
  U.boton(k, U.botonTexto('Colors', 90, 'goldFont', 'GJ_button_02.png', 28, 0.6), -60, -105, () => ED.colores(ed));
  U.boton(k, U.botonTexto('OK', 60), 60, -105, () => { pop.cerrar(); ed.cargarAjustes(); });
  pop.mostrar();
};
ED.elegirCancion = function (ed, despues) {
  const pop = new U.Popup(Math.min(D.ancho - 20, 440), 260), k = pop.caja; pop.titulo('Select Song');
  const c = ed.n.cancion = ed.n.cancion || { oficial: 0 };
  let i = c.oficial | 0;
  const lbl = U.texto(k, ED.NOMBRES_CANCION[i], 0, 70, 'bigFont', 0.7);
  const izq = U.boton(k, 'GJ_arrow_01_001.png', -170, 70, () => { i = (i - 1 + ED.CANCIONES.length) % ED.CANCIONES.length; lbl.texto(ED.NOMBRES_CANCION[i]); lbl.limitar(300, 0.7); }, 0, 0.5);
  const der = U.boton(k, 'GJ_arrow_01_001.png', 170, 70, () => { i = (i + 1) % ED.CANCIONES.length; lbl.texto(ED.NOMBRES_CANCION[i]); lbl.limitar(300, 0.7); }, 0, 0.5); der.cont.fx = true; void izq;
  U.boton(k, U.botonTexto('Use Official', 130, 'goldFont', 'GJ_button_01.png', 28, 0.55), 0, 30, () => { ed.n.cancion = { oficial: i }; pop.cerrar(); despues && despues(); });
  U.texto(k, 'Newgrounds / Library song ID:', 0, -15, 'goldFont', 0.5);
  const campo = new U.Campo('Song ID', 140, 30, 'bigFont', 10, '0123456789'); campo.pos(-40, -45); k.agregar(campo); if (c.ng) campo.texto = String(c.ng);
  U.boton(k, new Nodo(), -40, -45, () => campo.enfocar()).w = 140;
  U.boton(k, U.botonTexto('Use', 60, 'goldFont', 'GJ_button_02.png', 28, 0.6), 80, -45, () => { const id = parseInt(campo.texto || '0', 10); if (id > 0) { ed.n.cancion = { ng: id }; U.soltarFoco(); pop.cerrar(); despues && despues(); if (GD.Online) GD.Online.prepararCancion(id); } });
  U.boton(k, 'GJ_playMusicBtn_001.png', 0, -95, () => { const r = ED.rutaCancion({ oficial: i }); GD.S.musica(r, 0, false); }, 0, 0.6);
  pop.alCerrar = () => GD.S.pararMusica();
  pop.cerrarBtn(); pop.mostrar();
};
// colores iniciales del nivel (canales)
ED.colores = function (ed) {
  const pop = new U.Popup(Math.min(D.ancho - 20, 460), 280), k = pop.caja; pop.titulo('Colors');
  const fijos = [[1000, 'BG'], [1001, 'G1'], [1009, 'G2'], [1002, 'Line'], [1013, 'MG'], [1014, 'MG2'], [1004, 'Obj'], [1003, '3DL']];
  let pg = 0; const g = new Nodo(); k.agregar(g);
  const canal = id => ed.cols.base[id] || (ed.cols.base[id] = { r: 255, g: 255, b: 255, op: 1, add: false, pc: -1 });
  const arm = () => {
    g.vaciar();
    const lista = pg === 0 ? fijos.concat([1, 2, 3, 4, 5, 6, 7, 8].map(n => [n, String(n)])) : [...Array(16)].map((_, i) => [pg * 16 - 7 + i, String(pg * 16 - 7 + i)]);
    lista.forEach(([id, et], i) => {
      const c = canal(id), x = -175 + (i % 8) * 50, y = 60 - Math.floor(i / 8) * 75;
      const s = new Sprite('GJ_colorBtn_001.png'); s.escala = 0.65; s.color(c.pc === 1 ? GD.perfil.c1rgb() : c.pc === 2 ? GD.perfil.c2rgb() : [c.r, c.g, c.b]);
      U.boton(g, s, x, y, () => ED.editarCanal(ed, id, arm));
      U.texto(g, et, x, y - 28, 'bigFont', 0.4);
    });
    U.texto(g, `Page ${pg + 1}/63`, 0, -70, 'goldFont', 0.45);
  };
  arm();
  const d = U.boton(k, 'GJ_arrow_01_001.png', 205, 0, () => { pg = (pg + 1) % 63; arm(); }, 1, 0.5); d.cont.fx = true;
  U.boton(k, 'GJ_arrow_01_001.png', -205, 0, () => { pg = (pg + 62) % 63; arm(); }, 1, 0.5);
  U.boton(k, U.botonTexto('OK', 60), 0, -110, () => pop.cerrar());
  pop.mostrar();
};
ED.editarCanal = function (ed, id, despues) {
  const c = ed.cols.base[id];
  const pop = new U.Popup(360, 240), k = pop.caja; pop.titulo('Color ' + id);
  const s = new Sprite('GJ_colorBtn_001.png'); s.color(c.r, c.g, c.b);
  U.boton(k, s, -100, 40, () => ED.selectorColor([c.r, c.g, c.b], rgb => { [c.r, c.g, c.b] = rgb.map(Math.round); s.color(rgb); }));
  U.texto(k, 'Blending', 30, 60, 'goldFont', 0.5); U.casilla(k, 90, 60, !!c.add, v => { c.add = v; }, 0.55);
  U.texto(k, 'P-Col 1', 30, 25, 'goldFont', 0.5); const p1 = U.casilla(k, 90, 25, c.pc === 1, v => { c.pc = v ? 1 : -1; if (v) p2.poner(false); }, 0.55);
  U.texto(k, 'P-Col 2', 30, -10, 'goldFont', 0.5); const p2 = U.casilla(k, 90, -10, c.pc === 2, v => { c.pc = v ? 2 : -1; if (v) p1.poner(false); }, 0.55);
  U.texto(k, 'Opacity', -100, -10, 'goldFont', 0.5);
  const lbl = U.texto(k, (+c.op).toFixed(2), -100, -60, 'bigFont', 0.5);
  const d = new U.Deslizador(+c.op, v => { c.op = Math.round(v * 100) / 100; lbl.texto(c.op.toFixed(2)); }); d.pos(-100, -35); d.escala = 0.55; k.agregar(d);
  pop.alTocarFondo = (x, y) => { if (d.toca(x, y)) { pop._des = d; d.tocar(x, y); } return true; }; pop.alMoverFondo = (x, y) => { if (pop._des) pop._des.tocar(x, y); }; pop.alSoltarFondo = () => { pop._des = null; };
  U.boton(k, U.botonTexto('OK', 60), 0, -95, () => { pop.cerrar(); ed.cols = new GD.O.Colores({ colores: Object.assign({}, ed.cols.base) }, GD.perfil.c1rgb(), GD.perfil.c2rgb()); ed.cambios = true; despues && despues(); });
  pop.mostrar();
};

// ---------- pausa del editor (EditorPauseLayer) ----------
ED.pausa = function (ed) {
  const pop = new U.Popup(380, 280), k = pop.caja; pop.titulo(ed.n.nombre, 'bigFont', 0.7);
  const ops = [['Resume', () => pop.cerrar()], ['Save and Play', async () => { pop.cerrar(); await ed.guardarNivel(true); D.cambiar(await ED.jugarLocal(ed.n)); }],
    ['Save and Exit', async () => { pop.cerrar(); await ed.guardarNivel(true); GD.S.pararMusica(); D.cambiar(ED.ficha(ed.n)); }], ['Save', async () => { await ed.guardarNivel(); }],
    ['Exit', () => U.alerta('Exit', 'Exit without saving? All unsaved changes will be lost!', 'Cancel', 'Exit', null, () => { pop.cerrar(); GD.S.pararMusica(); D.cambiar(ED.ficha(ed.n)); })]];
  ops.forEach(([t, f], i) => U.boton(k, U.botonTexto(t, 180, 'goldFont', i === 4 ? 'GJ_button_06.png' : 'GJ_button_01.png', 30, 0.7), 0, 75 - i * 38, f));
  U.texto(k, `Objects: ${ed.objs.length}`, 0, -118, 'goldFont', 0.45);
  pop.mostrar();
};
ED.jugarLocal = async function (n) {
  const info = { nombre: n.nombre, musica: ED.rutaCancion(n.cancion), id: n.id };
  return GD.Menus.jugar(n.texto, info, { idProg: 'l' + n.id, editor: n, volver: () => ED.ficha(n) });
};

// ---------- mis niveles y la ficha del nivel ----------
ED.misNiveles = function () {
  const c = new U.Capa(), W = D.ancho, H = D.alto;
  c.alCrear = async () => {
    c.fondoDegradado([0, 102, 255]); c.esquinas();
    U.sprite(c, 'GJ_myLevelsTxt_001.png', W / 2, H - 22, 0.8, 2);
    const marco = U.cajaOscura(W - 150, 220, 90); marco.pos(75, 40); c.agregar(marco);
    const lista = c.lista = new U.Lista(W - 160, 210, 50); lista.pos(80, 45); c.agregar(lista, 1);
    U.manejarLista(c, lista);
    const niveles = await ED.todos();
    const filas = niveles.map(n => {
      const f = new Nodo(); f.w = W - 160; f.h = 50;
      const fondo = U.cajaOscura(W - 170, 44, 60, 'square02_small.png', 6); fondo.pos(5, 3); f.agregar(fondo);
      U.texto(f, n.nombre, 15, 32, 'bigFont', 0.55).anc(0, 0.5).limitar(W - 330, 0.55);
      U.texto(f, `${n.objetos || 0} objects${n.verificado ? '  ✓' : ''}`, 15, 13, 'goldFont', 0.4).anc(0, 0.5);
      U.boton(f, U.botonTexto('View', 70, 'bigFont', 'GJ_button_01.png', 30, 0.55), f.w - 50, 25, () => D.cambiar(ED.ficha(n)));
      return f;
    });
    lista.poner(filas);
    if (!niveles.length) U.texto(c, 'No levels yet. Tap "New" to create one!', W / 2, H / 2, 'goldFont', 0.6, 2);
    U.boton(c, 'GJ_newBtn_001.png', W - 38, 50, async () => { const n = await ED.nuevo(); D.cambiar(ED.ficha(n)); }, 3, 0.9);
    U.boton(c, U.botonTexto('Import', 70, 'goldFont', 'GJ_button_02.png', 26, 0.5), W - 38, 100, () => ED.importar(), 3);
    c.botonAtras(() => D.cambiar(GD.Menus.creador()));
  };
  c.atras = () => D.cambiar(GD.Menus.creador());
  return c;
};
// importar un nivel pegado como texto (.gmd o el string del nivel)
ED.importar = function () {
  const area = document.createElement('textarea'); area.style.cssText = 'position:fixed;left:5%;top:10%;width:90%;height:50%;z-index:9;font-size:14px';
  area.placeholder = 'Pega aquí el texto del nivel (o un .gmd) y tocá fuera para importar';
  document.body.appendChild(area); area.focus();
  area.onblur = async () => {
    let t = area.value.trim(); area.remove(); if (!t) return;
    const m = t.match(/<k>k4<\/k><s>([^<]+)<\/s>/); const nom = (t.match(/<k>k2<\/k><s>([^<]+)<\/s>/) || [])[1];
    if (m) t = m[1];
    try { const txt = await GD.N.descomprimir(t); GD.N.leer(txt); const n = await ED.nuevo(); n.texto = txt; if (nom) n.nombre = nom; await ED.guardar(n); D.cambiar(ED.ficha(n)); }
    catch (e) { U.alerta('Error', 'Could not import that level.'); }
  };
};
ED.ficha = function (n) {
  const c = new U.Capa(), W = D.ancho, H = D.alto;
  c.alCrear = () => {
    c.fondoDegradado([0, 102, 255]); c.esquinas();
    const nombre = new U.Campo('Level Name', 260, 34, 'bigFont', 20); nombre.texto = n.nombre; nombre.pos(W / 2, H - 35); c.agregar(nombre, 2);
    nombre.alListo = v => { n.nombre = v || n.nombre; ED.guardar(n); };
    U.boton(c, new Nodo(), W / 2, H - 35, () => nombre.enfocar()).w = 260;
    const desc = new U.Campo('Description [Optional]', 300, 60, 'chatFont', 140); desc.texto = n.desc || ''; desc.escTexto = 0.7; desc.pos(W / 2, H - 95); c.agregar(desc, 2);
    desc.alListo = v => { n.desc = v; ED.guardar(n); };
    U.boton(c, new Nodo(), W / 2, H - 95, () => desc.enfocar()).w = 300;
    U.boton(c, 'GJ_editBtn_001.png', W / 2 - 100, H / 2 - 40, () => { U.soltarFoco(); D.cambiar(ED.abrir(n)); });
    U.boton(c, 'GJ_playBtn2_001.png', W / 2, H / 2 - 40, async () => { U.soltarFoco(); D.cambiar(await ED.jugarLocal(n)); });
    U.boton(c, 'GJ_shareBtn_001.png', W / 2 + 100, H / 2 - 40, () => GD.Online ? GD.Online.subir(n) : null);
    U.boton(c, 'GJ_trashBtn_001.png', W - 35, 35, () => U.alerta('Delete Level', `Are you sure you want to delete "${n.nombre}"?`, 'Cancel', 'Delete', null, async () => { await ED.borrar(n); D.cambiar(ED.misNiveles()); }), 2, 0.8);
    U.boton(c, 'GJ_duplicateBtn_001.png', W - 35, 80, async () => { const m = await ED.nuevo(); Object.assign(m, JSON.parse(JSON.stringify(n)), { id: m.id, nombre: n.nombre + ' copy' }); await ED.guardar(m); U.aviso('Copied'); }, 2, 0.6);
    U.boton(c, U.botonTexto('Export', 70, 'goldFont', 'GJ_button_02.png', 26, 0.5), 45, 35, async () => { const t = await GD.N.comprimir(n.texto); try { await navigator.clipboard.writeText(t); U.aviso('Level copied to clipboard'); } catch (e) { U.alerta('Export', t.slice(0, 200) + '…'); } });
    const pr = P.nivel('l' + n.id);
    U.texto(c, `Objects: ${n.objetos || 0}   Best: ${Math.floor(pr.normal)}%   ${n.cancion && n.cancion.ng ? 'Song: NG ' + n.cancion.ng : 'Song: ' + ED.NOMBRES_CANCION[(n.cancion && n.cancion.oficial) | 0]}`, W / 2, 40, 'goldFont', 0.5);
    c.botonAtras(() => { U.soltarFoco(); D.cambiar(ED.misNiveles()); });
  };
  c.atras = () => D.cambiar(ED.misNiveles());
  return c;
};
})();
