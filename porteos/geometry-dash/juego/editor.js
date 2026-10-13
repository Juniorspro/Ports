// Editor de niveles (LevelEditorLayer + EditorUI): construir, editar y borrar con las pestañas de
// objetos, transformaciones, deshacer, capas, copiar y pegar, zoom, probar el nivel y guardar.
'use strict';
const ED = GD.Editor = {};
const { U, D, A, E, Sprite, Texto, Nodo } = GD;
const TYO = GD.O.TIPO;
const NIVEL_NUEVO = 'kS38,1_40_2_125_3_255_11_255_12_255_13_255_4_-1_6_1000_7_1_15_1_18_0_8_1|1_0_2_102_3_255_11_255_12_255_13_255_4_-1_6_1001_7_1_15_1_18_0_8_1|1_255_2_255_3_255_11_255_12_255_13_255_4_-1_6_1002_5_1_7_1_15_1_18_0_8_1|1_255_2_255_3_255_11_255_12_255_13_255_4_-1_6_1004_7_1_15_1_18_0_8_1|1_0_2_102_3_255_11_255_12_255_13_255_4_-1_6_1009_7_1_15_1_18_0_8_1|,kA13,0,kA15,0,kA16,0,kA14,,kA6,0,kA7,0,kA25,0,kA17,0,kA18,0,kS39,0,kA2,0,kA3,0,kA8,0,kA4,0,kA9,0,kA10,0,kA22,0,kA23,0,kA24,0,kA27,1,kA40,1,kA41,1,kA42,1,kA28,0,kA29,0,kA31,1,kA32,1,kA36,0,kA43,0,kA44,0,kA45,1,kA33,1,kA34,1,kA35,0,kA37,1,kA38,1,kA39,1,kA19,0,kA26,0,kA20,0,kA21,0,kA11,0;';

// ---------------- guardado de "mis niveles" ----------------
ED.todos = async () => (await GD.G.idbTodo('niveles')).sort((a, b) => (b.mod || 0) - (a.mod || 0));
ED.guardar = n => { n.mod = Date.now(); return GD.G.idbPoner('niveles', n.id, n); };
ED.borrar = n => GD.G.idbBorrar('niveles', n.id);
ED.nuevo = async function () {
  const todos = await ED.todos(); let k = todos.length;
  let nombre; do nombre = 'Unnamed ' + k++; while (todos.some(t => t.nombre === nombre));
  const n = { id: 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), nombre, desc: '', texto: NIVEL_NUEVO, cancion: { oficial: 0 }, verificado: false, version: 1, creado: Date.now() };
  await ED.guardar(n); return n;
};
ED.CANCIONES = ['StereoMadness', 'BackOnTrack', 'Polargeist', 'DryOut', 'BaseAfterBase', 'CantLetGo', 'Jumper', 'TimeMachine', 'Cycles', 'xStep', 'Clutterfunk', 'TheoryOfEverything', 'Electroman', 'Clubstep', 'Electrodynamix', 'HexagonForce', 'BlastProcessing', 'TheoryOfEverything2', 'GeometricalDominator', 'Deadlocked', 'Fingerdash', 'Dash'];
ED.NOMBRES_CANCION = ['Stereo Madness', 'Back On Track', 'Polargeist', 'Dry Out', 'Base After Base', "Can't Let Go", 'Jumper', 'Time Machine', 'Cycles', 'xStep', 'Clutterfunk', 'Theory of Everything', 'Electroman Adventures', 'Clubstep', 'Electrodynamix', 'Hexagon Force', 'Blast Processing', 'Theory of Everything 2', 'Geometrical Dominator', 'Deadlocked', 'Fingerdash', 'Dash'];
// ruta de la canción de un nivel local u online
ED.rutaCancion = function (c) {
  if (!c) return 'datos/mus/StereoMadness.ogg';
  if (c.ng) return GD.Online ? GD.Online.rutaCancion(c.ng) : null;
  return `datos/mus/${ED.CANCIONES[c.oficial | 0] || 'StereoMadness'}.ogg`;
};

// ---------------- pestañas de objetos ----------------
ED.pestanas = function () {
  if (ED._pest) return ED._pest;
  const T = GD.O.tabla, ids = Object.keys(T).map(Number).filter(id => T[id].t && T[id].t !== 'emptyFrame.png' && GD.T.m(T[id].t)).sort((a, b) => a - b);
  const es = (id, re) => re.test(T[id].t);
  const juego = new Set([10, 11, 12, 13, 47, 111, 660, 745, 1331, 1933, 45, 46, 99, 101, 286, 287, 747, 749, 2926, 200, 201, 202, 203, 1334, 35, 140, 67, 1332, 3005, 36, 141, 84, 1022, 1330, 1333, 1594, 1704, 1751, 3004, 3027, 142, 1329, 31, 1275, 1587, 1589, 1598, 1614, 3601, 1755]);
  const tabs = [
    { n: 'Blocks', icono: 'square_01_001.png', ids: [] }, { n: 'Outline', icono: 'blockOutline_01_001.png', ids: [] }, { n: 'Slopes', icono: 'triangle_a_02_001.png', ids: [] },
    { n: 'Hazards', icono: 'spike_01_001.png', ids: [] }, { n: '3D', icono: 'blockPiece_001_001.png', ids: [] }, { n: 'Portals', icono: 'portal_01_front_001.png', ids: [] },
    { n: 'Deco', icono: 'd_spikes_01_001.png', ids: [] }, { n: 'Pulse', icono: 'd_ball_01_001.png', ids: [] }, { n: 'Animated', icono: 'd_cogwheel_01_001.png', ids: [] },
    { n: 'Pixel', icono: 'pixelart_001_001.png', ids: [] }, { n: 'Triggers', icono: 'edit_eMoveComBtn_001.png', ids: [] }, { n: 'Custom', icono: 'GJ_plusBtn_001.png', ids: [], custom: true },
  ];
  const [bl, ou, sl, hz, d3, po, de, pu, an, px, tr] = tabs;
  for (const id of ids) {
    const d = T[id];
    if (GD.TR.def[id] || es(id, /^edit_e/)) tr.ids.push(id);
    else if (juego.has(id) || (d.ty >= 3 && d.ty <= 46 && d.ty !== 7 && d.ty !== 25 && d.ty !== 20 && d.ty !== 21 && d.ty !== 39 && d.ty !== 40) || [TYO.MODIFICADOR, TYO.ROMPIBLE, TYO.COLISION].includes(d.ty)) po.ids.push(id);
    else if (d.ty === TYO.PENDIENTE) sl.ids.push(id);
    else if (d.ty === TYO.PELIGRO || d.ty === TYO.PELIGRO_ANIMADO) hz.ids.push(id);
    else if (d.ty === TYO.SOLIDO) { if (es(id, /[oO]utline|Line|plank_0\d_0[2-9]/)) ou.ids.push(id); else bl.ids.push(id); }
    else if (es(id, /^pixel/)) px.ids.push(id);
    else if (es(id, /blockPiece|3d|Piece|_b_0|lightsquare/)) d3.ids.push(id);
    else if (es(id, /pulse|d_ball|d_heart|d_circle|d_ring|d_star|d_square|d_arrow|d_diamond|d_link|d_art/)) pu.ids.push(id);
    else if (es(id, /cogwheel|sawblade|blade|fire|anim|torch|d_spikewheel|d_wheel/)) an.ids.push(id);
    else de.ids.push(id);
  }
  return (ED._pest = tabs.filter(t => t.ids.length || t.custom));
};

// ---------------- el editor ----------------
class Editor extends GD.Partida {
  constructor(n) { super({ texto: n.texto, info: { nombre: n.nombre, musica: ED.rutaCancion(n.cancion) }, editor: n }); this.n = n; this.enEditor = true; }
  async alCrear() {
    this.nv = GD.N.leer(this.opc.texto);
    this.cargarAjustes(); this.armarObjetos(); await this.cargarFondo();
    this.cols = new GD.O.Colores(this.nv, GD.perfil.c1rgb(), GD.perfil.c2rgb());
    this.modo = 'construir'; this.sel = new Set(); this.pest = 0; this.pag = 0; this.objSel = 1; this.capaEd = -1;
    this.deshacer = []; this.rehacer = []; this.swipe = false; this.libre = false; this.snap = true; this.rotLibre = false;
    const ult = this.n.camara; this.camX = ult ? ult[0] : -60; this.camY = ult ? ult[1] : -60; this.zoom = ult ? ult[2] : 1;
    this.ui = new Nodo(); this.ui.z = 100; this.agregar(this.ui);
    this.armarUI();
    this.listo = true;
    GD.S.pararMusica();
  }
  // nivel → texto (lo que se guarda)
  texto() {
    this.nv.objs = this.objs.map(o => o.raw);
    this.nv.colores = {}; for (const id in this.cols.base) if (+id < 1010 || +id > 1011) this.nv.colores[id] = this.cols.base[id];
    return GD.N.escribir(this.nv);
  }
  async guardarNivel(silencio) {
    this.n.texto = this.texto(); this.n.camara = [this.camX, this.camY, this.zoom]; this.n.objetos = this.objs.length;
    await ED.guardar(this.n); if (!silencio) U.aviso('Saved');
  }
  // ---------- objetos ----------
  orden() { // vuelve a ordenar para dibujar cuando cambió algo
    const capa = o => GD.O.ORDEN_CAPA[o.capa] ?? 5;
    this.objs.forEach((o, i) => o.i = i);
    this.ordenados = this.objs.slice().sort((a, b) => capa(a) - capa(b) || a.orden - b.orden || a.i - b.i);
    this.ordenados.forEach((o, k) => o.rango = k);
    this.grupos = {}; for (const o of this.objs) if (o.grupos) for (const g of o.grupos) (this.grupos[g] = this.grupos[g] || []).push(o);
  }
  crearObjeto(id, x, y, extra) {
    const raw = { 1: id, 2: +x.toFixed(2), 3: +y.toFixed(2), _k: [1, 2, 3] };
    if (extra) for (const k in extra) { raw[k] = extra[k]; raw._k.push(+k); }
    if (this.capaEd >= 0) { raw[20] = this.capaEd; raw._k.push(20); }
    const d = GD.O.def(id);
    if (GD.TR.def[id] && raw[10] === undefined && ['color', 'mover', 'alpha', 'rotar', 'seguir'].includes(GD.TR.def[id])) { raw[10] = 0.5; raw._k.push(10); }
    if (GD.TR.def[id] === 'color' && id === 899) { raw[23] = 1; raw._k.push(23); }
    void d;
    const o = new GD.O.Obj(raw); this.objs.push(o); this.ponerEnSeccion(o);
    return o;
  }
  refrescar(o) { // volver a leer el objeto de su raw (después de editarlo)
    const viejo = o.sec, nuevo = new GD.O.Obj(o.raw);
    for (const k of ['d', 'x', 'y', 'rot', 'sx', 'sy', 'fx', 'fy', 'warpX', 'warpY', 'capa', 'orden', 'c1', 'c2', 'h1', 'h2', 'grupos', 'ty', 'vis', 'noGlow', 'noTocar', 'partes', 'id']) o[k] = nuevo[k];
    o.dx = o.dy = o.drot = 0; o.sec = viejo; this.moverSeccion(o);
  }
  quitarObjeto(o) {
    const i = this.objs.indexOf(o); if (i >= 0) this.objs.splice(i, 1);
    const a = this.secs[o.sec]; if (a) { const k = a.indexOf(o); if (k >= 0) a.splice(k, 1); }
    this.sel.delete(o);
  }
  // ---------- deshacer ----------
  registrar(tipo, objs, antes) { this.deshacer.push({ tipo, objs, antes }); if (this.deshacer.length > 200) this.deshacer.shift(); this.rehacer.length = 0; this.cambios = true; }
  copiaRaw = o => { const r = Object.assign({}, o.raw); r._k = o.raw._k.slice(); return r; };
  aplicar(acc, inverso) {
    const quitar = os => { for (const o of os) this.quitarObjeto(o); }, poner = os => { for (const o of os) { this.objs.push(o); this.ponerEnSeccion(o); } };
    if (acc.tipo === 'poner') inverso ? quitar(acc.objs) : poner(acc.objs);
    else if (acc.tipo === 'quitar') inverso ? poner(acc.objs) : quitar(acc.objs);
    else if (acc.tipo === 'mod') {
      const ahora = acc.objs.map(this.copiaRaw);
      acc.objs.forEach((o, i) => { o.raw = acc.antes[i]; this.refrescar(o); });
      acc.antes = ahora;
    }
    this.orden();
  }
  deshacerUno() { const a = this.deshacer.pop(); if (!a) return; this.aplicar(a, true); this.rehacer.push(a); this.selecciones(); }
  rehacerUno() { const a = this.rehacer.pop(); if (!a) return; this.aplicar(a, false); this.deshacer.push(a); this.selecciones(); }
  // modificar los seleccionados con f(raw, o) y anotar para deshacer
  modificar(f, objs = [...this.sel]) {
    if (!objs.length) return;
    const antes = objs.map(this.copiaRaw);
    for (const o of objs) { f(o.raw, o); for (const k in o.raw) if (k !== '_k' && !o.raw._k.includes(+k)) o.raw._k.push(+k); this.refrescar(o); }
    this.registrar('mod', objs, antes); this.orden();
  }
  // ---------- selección ----------
  seleccionar(objs, sumar = false) {
    if (!sumar) for (const o of this.sel) o.selec = false;
    if (!sumar) this.sel.clear();
    for (const o of objs) { this.sel.add(o); o.selec = true; }
    this.selecciones();
  }
  selecciones() { for (const o of this.objs) o.selec = this.sel.has(o); this.actualizarBotones && this.actualizarBotones(); }
  objetosEn(x, y) { // los que tocan el punto (en unidades del nivel), arriba primero
    const r = [], s0 = Math.max(0, Math.floor((x - 120) / 100)), s1 = Math.floor((x + 120) / 100);
    for (let s = s0; s <= s1; s++) for (const o of this.secs[s] || []) {
      if (this.capaEd >= 0 && (o.raw[20] | 0) !== this.capaEd && (o.raw[61] | 0) !== this.capaEd) continue;
      const c = this.cajaEditor(o);
      if (Math.abs(x - c.x) <= c.w && Math.abs(y - c.y) <= c.h) r.push(o);
    }
    return r.sort((a, b) => b.rango - a.rango);
  }
  cajaEditor(o) { // caja para elegir con el dedo: la del sprite (como mínimo 10)
    const f = o.partes.length ? o.partes[o.partes.length - 1].f : null;
    let w = Math.max(10, (f ? f.cw : 30) * Math.abs(o.sx)) / 2, h = Math.max(10, (f ? f.ch : 30) * Math.abs(o.sy)) / 2;
    const r = ((o.rot % 180) + 180) % 180; if (r > 45 && r < 135) [w, h] = [h, w];
    return { x: o.cx, y: o.cy, w, h };
  }
  // ---------- transformaciones ----------
  mover(dx, dy) { this.modificar(r => { r[2] = +((+r[2] || 0) + dx).toFixed(3); r[3] = +((+r[3] || 0) + dy).toFixed(3); }); }
  girar(g) {
    const l = [...this.sel]; if (!l.length) return;
    let cx = 0, cy = 0; for (const o of l) { cx += o.x; cy += o.y; } cx /= l.length; cy /= l.length;
    const a = -g * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    this.modificar(r => {
      if (l.length > 1) { const x = r[2] - cx, y = r[3] - cy; r[2] = +(cx + x * c - y * s).toFixed(3); r[3] = +(cy + x * s + y * c).toFixed(3); }
      r[6] = (((+r[6] || 0) + g) % 360 + 360) % 360; if (r[6] > 180) r[6] -= 360;
    });
  }
  voltear(eje) {
    const l = [...this.sel]; if (!l.length) return;
    let cx = 0, cy = 0; for (const o of l) { cx += o.x; cy += o.y; } cx /= l.length; cy /= l.length;
    this.modificar(r => {
      if (eje === 'x') { r[4] = r[4] == 1 ? 0 : 1; r[2] = +(2 * cx - r[2]).toFixed(3); r[6] = -(+r[6] || 0); }
      else { r[5] = r[5] == 1 ? 0 : 1; r[3] = +(2 * cy - r[3]).toFixed(3); r[6] = -(+r[6] || 0); }
    });
  }
  escalar(k) { this.modificar(r => { const s = (r[32] !== undefined ? +r[32] : 1) * k; r[32] = +GD.clamp(s, 0.05, 16).toFixed(3); }); }
  alinear(eje) { const l = [...this.sel]; if (l.length < 2) return; const k = eje === 'x' ? 2 : 3; const m = l.reduce((a, o) => a + (+o.raw[k] || 0), 0) / l.length; this.modificar(r => { r[k] = +m.toFixed(3); }); }
  // estado: lo que no es posición (rotación, escala, capas, grupos, colores…), como "copy state" del juego
  copiarEstado() { const o = [...this.sel][0]; if (!o) return; ED.estado = {}; for (const k of o.raw._k) if (![1, 2, 3].includes(k)) ED.estado[k] = o.raw[k]; U.aviso('State copied'); }
  pegarEstado() { if (!ED.estado || !this.sel.size) return; this.modificar(r => { for (const k in ED.estado) r[k] = ED.estado[k]; }); }
  copiarColor() { const o = [...this.sel][0]; if (!o) return; ED.colorCopiado = {}; for (const k of [21, 22, 41, 42, 43, 44]) if (o.raw[k] !== undefined) ED.colorCopiado[k] = o.raw[k]; U.aviso('Color copied'); }
  pegarColor() { if (!ED.colorCopiado || !this.sel.size) return; this.modificar(r => { for (const k of [21, 22, 41, 42, 43, 44]) delete r[k]; Object.assign(r, ED.colorCopiado); }); }
  copiar() { if (!this.sel.size) return; ED.portapapeles = [...this.sel].map(o => this.copiaRaw(o)); U.aviso('Copied'); }
  pegar() {
    const pp = ED.portapapeles; if (!pp || !pp.length) return;
    const nuevos = pp.map(r => { const c = Object.assign({}, r); c._k = r._k.slice(); const o = new GD.O.Obj(c); this.objs.push(o); this.ponerEnSeccion(o); return o; });
    this.registrar('poner', nuevos); this.orden(); this.seleccionar(nuevos);
  }
  duplicar() { this.copiar(); this.pegar(); }
  borrarSeleccion() { const l = [...this.sel]; if (!l.length) return; for (const o of l) this.quitarObjeto(o); this.registrar('quitar', l); this.orden(); this.selecciones(); }

  // ---------- coordenadas ----------
  aMundo(x, y) { return [x / this.zoom + this.camX, y / this.zoom + this.camY]; }
  enGrilla(v) { return Math.floor(v / 30) * 30 + 15; }

  // ---------- entrada ----------
  alTocar(x, y, id) {
    if (!this.listo) return;
    if (this.probando) { if (this.btnStop && this.btnStop.toca(x, y)) { this.pararPrueba(); return; } return super.alTocar(x, y, id); }
    this.toques = this.toques || {};
    // primero los botones de la interfaz
    const bs = U.botones(this.ui).reverse();
    for (const b of bs) if (b.toca(x, y)) { this._pres = b; this._pid = id; b.apretar(); return; }
    if (y < this.altoBarra) return;
    this.toques[id] = { x, y, x0: x, y0: y, t: D.tiempo, mov: 0 };
    const ids = Object.keys(this.toques);
    if (ids.length === 2) { const [a, b] = ids.map(k => this.toques[k]); this.pinza = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; }
    if (ids.length === 1) {
      const [wx, wy] = this.aMundo(x, y);
      if (this.modo === 'editar' && this.libre) { const en = this.objetosEn(wx, wy); if (en.length && this.sel.has(en[0])) { this.arrastre = { wx, wy, antes: [...this.sel].map(this.copiaRaw), objs: [...this.sel], dx: 0, dy: 0 }; } }
      if (this.swipe && this.modo === 'editar' && !this.arrastre) this.cajaSel = { x0: wx, y0: wy, x1: wx, y1: wy };
      if (this.swipe && this.modo === 'construir') this.pintadas = new Set();
    }
  }
  alMover(x, y, id) {
    if (this.probando) return;
    if (this._pres && id === this._pid) return;
    const t = this.toques && this.toques[id]; if (!t) return;
    const dx = x - t.x, dy = y - t.y; t.x = x; t.y = y; t.mov += Math.abs(dx) + Math.abs(dy);
    const ids = Object.keys(this.toques);
    if (ids.length >= 2 && this.pinza) {
      const [a, b] = ids.slice(0, 2).map(k => this.toques[k]); const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const [wx, wy] = this.aMundo(cx, cy);
      this.zoom = GD.clamp(this.pinza.z * d / Math.max(1, this.pinza.d), 0.1, 4);
      this.camX = wx - cx / this.zoom; this.camY = wy - cy / this.zoom;
      return;
    }
    const [wx, wy] = this.aMundo(x, y);
    if (this.arrastre) {
      const a = this.arrastre; let mx = wx - a.wx, my = wy - a.wy;
      if (this.snap) { mx = Math.round(mx / 30) * 30; my = Math.round(my / 30) * 30; }
      const ddx = mx - a.dx, ddy = my - a.dy; a.dx = mx; a.dy = my;
      if (ddx || ddy) for (const o of a.objs) { o.raw[2] = +(+o.raw[2] + ddx).toFixed(3); o.raw[3] = +(+o.raw[3] + ddy).toFixed(3); this.refrescar(o); }
      return;
    }
    if (this.cajaSel) { this.cajaSel.x1 = wx; this.cajaSel.y1 = wy; return; }
    if (this.pintadas && this.modo === 'construir') { this.ponerEn(wx, wy, true); return; }
    if (this.swipe && this.modo === 'borrar') { const en = this.objetosEn(wx, wy); if (en.length) { this.quitarObjeto(en[0]); this.registrar('quitar', [en[0]]); this.orden(); } return; }
    this.camX -= dx / this.zoom; this.camY -= dy / this.zoom;
  }
  alSoltar(x, y, id) {
    if (this.probando) return super.alSoltar(x, y, id);
    if (this._pres && id === this._pid) { const b = this._pres; this._pres = null; b.soltar(); if (b.toca(x, y)) b.activar(); return; }
    const t = this.toques && this.toques[id]; if (!t) return;
    delete this.toques[id]; this.pinza = null;
    if (this.arrastre) { const a = this.arrastre; this.arrastre = null; if (a.dx || a.dy) { this.registrar('mod', a.objs, a.antes); this.orden(); } return; }
    if (this.cajaSel) { const c = this.cajaSel; this.cajaSel = null; if (Math.abs(c.x1 - c.x0) > 4 || Math.abs(c.y1 - c.y0) > 4) { this.seleccionarCaja(c); return; } }
    if (this.pintadas) { const p = this.pintadas; this.pintadas = null; if (p.size) return; }
    if (t.mov > 8) return; // fue un arrastre de cámara
    const [wx, wy] = this.aMundo(x, y);
    if (this.modo === 'construir') this.ponerEn(wx, wy);
    else if (this.modo === 'editar') {
      const en = this.objetosEn(wx, wy);
      if (!en.length) { this.seleccionar([]); return; }
      // tocar varias veces el mismo lugar va pasando por los objetos de abajo
      let k = 0; if (this._ultToque && Math.hypot(this._ultToque[0] - wx, this._ultToque[1] - wy) < 3) k = (this._ultToque[2] + 1) % en.length;
      this._ultToque = [wx, wy, k];
      this.seleccionar([en[k]], this.multi);
    } else if (this.modo === 'borrar') {
      const en = this.objetosEn(wx, wy); if (en.length) { const o = en[0]; this.quitarObjeto(o); this.registrar('quitar', [o]); this.orden(); }
    }
  }
  seleccionarCaja(c) {
    const x0 = Math.min(c.x0, c.x1), x1 = Math.max(c.x0, c.x1), y0 = Math.min(c.y0, c.y1), y1 = Math.max(c.y0, c.y1), r = [];
    for (let s = Math.max(0, Math.floor(x0 / 100) - 1); s <= Math.floor(x1 / 100) + 1; s++) for (const o of this.secs[s] || []) if (o.cx >= x0 && o.cx <= x1 && o.cy >= y0 && o.cy <= y1) r.push(o);
    this.seleccionar(r, true);
  }
  ponerEn(wx, wy, pintando) {
    const id = this.objSel; if (!id) return;
    let x = wx, y = wy;
    if (this.snap || !pintando) { x = this.enGrilla(wx); y = this.enGrilla(wy); }
    if (pintando) { const k = x + ',' + y; if (this.pintadas.has(k)) return; if (this.objetosEn(x, y).some(o => o.id === id && Math.abs(o.x - x) < 1 && Math.abs(o.y - y) < 1)) return; this.pintadas.add(k); }
    const o = this.crearObjeto(id, x, y);
    this.registrar('poner', [o]); this.orden(); this.seleccionar([o]);
  }
  alRueda(dy, x, y) { const [wx, wy] = this.aMundo(x, y); this.zoom = GD.clamp(this.zoom * (dy > 0 ? 0.9 : 1.1), 0.1, 4); this.camX = wx - x / this.zoom; this.camY = wy - y / this.zoom; }
  alTecla(c, abajo, e) {
    if (this.probando) return super.alTecla(c, abajo, e);
    if (!abajo) { if (c === 'ShiftLeft' || c === 'ShiftRight') this.multi = false; return; }
    const paso = e && e.shiftKey ? 2 : 30;
    if (c === 'ShiftLeft' || c === 'ShiftRight') this.multi = true;
    else if (c === 'KeyW') this.mover(0, paso); else if (c === 'KeyS') this.mover(0, -paso);
    else if (c === 'KeyA') this.mover(-paso, 0); else if (c === 'KeyD') this.mover(paso, 0);
    else if (c === 'KeyQ') this.girar(-90); else if (c === 'KeyE') this.girar(90);
    else if (c === 'Delete' || c === 'Backspace') this.borrarSeleccion();
    else if (c === 'KeyZ' && e.ctrlKey) this.deshacerUno(); else if (c === 'KeyY' && e.ctrlKey) this.rehacerUno();
    else if (c === 'KeyC' && e.ctrlKey) this.copiar(); else if (c === 'KeyV' && e.ctrlKey) this.pegar(); else if (c === 'KeyD' && e.ctrlKey) this.duplicar();
    else if (c === 'Digit1') this.ponerModo('construir'); else if (c === 'Digit2') this.ponerModo('editar'); else if (c === 'Digit3') this.ponerModo('borrar');
    else if (c === 'Enter') this.probar(); else if (c === 'Escape') ED.pausa(this);
  }

  // ---------- probar el nivel (playtest) ----------
  probar() {
    if (this.probando) return;
    this.probando = true; this.antesCam = [this.camX, this.camY, this.zoom];
    this.n.texto = this.texto();
    this.cargarAjustes(); this.armarObjetosPrueba();
    this.opc.noclip = false; this.practica = false; this.checkpoints = [];
    this.btnPausa = this.btnPausa || new Sprite('GJ_pauseBtn_001.png');
    this.opc.alMorir = () => { }; this.opc.alGanar = () => { }; this.opc.alFinPantalla = () => this.pararPrueba(); this.opc.alPausar = pp => { pp.seguir(); this.pararPrueba(); };
    this.lblIntento = null; this.intentos = 0;
    this.ui.vis = false;
    this.btnStop = new Sprite('GJ_stopEditorBtn_001.png'); this.btnStop.pos(25, D.alto - 70); this.agregar(this.btnStop, 200);
    this.opc.info.musica = ED.rutaCancion(this.n.cancion);
    this.inicio = this.objs.filter(o => o.id === 31).sort((a, b) => b.x - a.x)[0];
    this.reiniciar(true); this.zoom = 1;
    this.recorrido = [];
  }
  armarObjetosPrueba() { for (const o of this.objs) { o.selec = false; o.dx = o.dy = o.drot = 0; } this.orden(); this.triggers = this.objs.filter(o => GD.TR.esTrigger(o)).sort((a, b) => a.x - b.x); this.inicios = this.objs.filter(o => o.id === 31); let fin = 0; for (const o of this.objs) if (!GD.O.esTrigger(o.id)) fin = Math.max(fin, o.x); this.largo = Math.max(fin + 340, 600); }
  pararPrueba() {
    if (!this.probando) return;
    this.probando = false; GD.S.pararMusica(); this.muerto = false; this.terminada = false; this.pantallaFin = false;
    if (this.btnStop) { this.btnStop.sacar(); this.btnStop = null; }
    this.ui.vis = true; [this.camX, this.camY, this.zoom] = this.antesCam;
    for (const o of this.objs) { o.dx = o.dy = o.drot = 0; o.op = 1; o.activo = true; o.oculto = false; o.tomado = false; o.muerto = false; o.pulsos = null; o.esx = o.esy = 1; }
    this.reseccionar(); this.cols = new GD.O.Colores(this.nv, GD.perfil.c1rgb(), GD.perfil.c2rgb()); this.limites = null; this.espejo = false; this.espejoK = 0; this.camRot = 0;
    this.selecciones();
  }
  reiniciar(primera) {
    if (!this.probando) return;
    if (this.inicio) { this.opc.inicio = this.inicio; }
    super.reiniciar(primera);
    if (this.inicio) { const r = this.inicio.raw; this.j.x = this.inicio.x; this.j.y = this.inicio.y; this.j.modo = GD.O.MODOS[+r.kA2 || 0] || 'cubo'; }
    if (this.lblIntento) this.lblIntento.vis = false;
  }
  alActualizar(dt) {
    if (!this.listo) return;
    if (this.probando) { super.alActualizar(dt); if (this.j && this.recorrido) { const r = this.recorrido; if (!r.length || Math.abs(r[r.length - 1][0] - this.j.x) > 4) r.push([this.j.x, this.j.y]); } return; }
    for (const h of this.hijos.slice()) h.actualizar(dt);
    GD.O.reloj += dt;
    if (this.musicaEd) this.lineaMusica = this.xMusica0 + this.velMusica(GD.S.tiempo());
  }
  actualizarHUD() { } // probando en el editor no hay barra de progreso (como el juego)
  velMusica(t) { // x de la línea de la música según el tiempo (sin portales de velocidad: como el juego al tocar música en el editor)
    return t * GD.O.UPS[this.velIni];
  }
  // ---------- dibujo ----------
  dibujar(pm) {
    if (!this.listo) return;
    if (this.probando) { super.dibujar(pm); return; }
    this.dibujarFondo();
    const w = new Float32Array([this.zoom, 0, 0, this.zoom, -this.camX * this.zoom, -this.camY * this.zoom]);
    this.dibujarGrilla(w);
    // los objetos con el dibujo de la partida (los triggers y lo invisible se ven)
    const vis = [], x0 = this.camX - 100, x1 = this.camX + D.ancho / this.zoom + 100, y0 = this.camY - 100, y1 = this.camY + D.alto / this.zoom + 100;
    for (let s = Math.max(0, Math.floor(x0 / 100)); s <= Math.floor(x1 / 100); s++) for (const o of this.secs[s] || []) if (o.cy > y0 && o.cy < y1) vis.push(o);
    vis.sort((a, b) => a.rango - b.rango);
    const capaEd = this.capaEd;
    GD.O.dibujarObjetos(vis, w, this.cols, { editor: true, capaJugador: 99, alfaEditor: (o, al) => {
      const otraCapa = capaEd >= 0 && (o.raw[20] | 0) !== capaEd && (o.raw[61] | 0) !== capaEd;
      const invisible = !o.vis && !GD.TR.def[o.id];
      return Math.max(al, 0.3) * (otraCapa ? 0.3 : 1) * (invisible ? 0.5 : 1);
    } });
    this.dibujarPiso();
    if (this.recorrido && this.recorrido.length) this.dibujarRecorrido(w);
    if (this.cajaSel) this.dibujarCaja(w);
    if (this.lineaMusica !== undefined && this.musicaEd) this.dibujarLineaV(w, this.lineaMusica, [0, 255, 0]);
    GD.Nodo.prototype.dibujar.call(this, pm, 255, 255, 255, 255);
  }
  dibujarGrilla(w) {
    const z = this.zoom, x0 = Math.floor(this.camX / 30) * 30, x1 = this.camX + D.ancho / z, y0 = Math.max(-30, Math.floor(this.camY / 30) * 30), y1 = this.camY + D.alto / z;
    const xs = new Float32Array(8), uv = new Float32Array(8).fill(0.5), col = GD.col(0, 0, 0, 60), R = GD.R;
    const L = (ax, ay, bx, by, grosor, c) => {
      const X0 = w[0] * ax + w[4], Y0 = w[3] * ay + w[5], X1 = w[0] * bx + w[4], Y1 = w[3] * by + w[5];
      if (ax === bx) xs.set([X0 - grosor, Y1, X0 + grosor, Y1, X0 - grosor, Y0, X0 + grosor, Y0]); else xs.set([X0, Y0 + grosor, X1, Y0 + grosor, X0, Y0 - grosor, X1, Y0 - grosor]);
      R.quad(R.blanco, false, 0, xs, uv, c || col);
    };
    if (z > 0.25) {
      for (let x = x0; x <= x1; x += 30) L(x, Math.max(0, y0), x, y1, 0.5);
      for (let y = Math.max(0, y0); y <= y1; y += 30) L(Math.max(x0, 0), y, x1, y, 0.5);
    }
    L(0, 0, 0, y1, 1, GD.col(255, 255, 255, 120)); // línea de inicio
  }
  dibujarLineaV(w, x, rgb) { const X = w[0] * x + w[4]; GD.R.quad(GD.R.blanco, true, 0, new Float32Array([X - 1, D.alto, X + 1, D.alto, X - 1, 0, X + 1, 0]), new Float32Array(8).fill(0.5), GD.col(rgb[0], rgb[1], rgb[2], 200)); }
  dibujarCaja(w) {
    const c = this.cajaSel, x0 = w[0] * Math.min(c.x0, c.x1) + w[4], x1 = w[0] * Math.max(c.x0, c.x1) + w[4], y0 = w[3] * Math.min(c.y0, c.y1) + w[5], y1 = w[3] * Math.max(c.y0, c.y1) + w[5];
    GD.R.quad(GD.R.blanco, false, 0, new Float32Array([x0, y1, x1, y1, x0, y0, x1, y0]), new Float32Array(8).fill(0.5), GD.col(0, 255, 0, 50));
  }
  dibujarRecorrido(w) {
    const r = this.recorrido, xs = new Float32Array(8), uv = new Float32Array(8).fill(0.5);
    for (let i = 1; i < r.length; i++) {
      const ax = w[0] * r[i - 1][0] + w[4], ay = w[3] * r[i - 1][1] + w[5], bx = w[0] * r[i][0] + w[4], by = w[3] * r[i][1] + w[5];
      xs.set([ax, ay + 1, bx, by + 1, ax, ay - 1, bx, by - 1]); GD.R.quad(GD.R.blanco, false, 0, xs, uv, GD.col(0, 255, 0, 180));
    }
  }
}
GD.Editor.Editor = Editor;
ED.abrir = n => new Editor(n);
