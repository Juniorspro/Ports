// Pantallas del juego: menú principal (con el fondo que juega solo), selección de niveles y la
// Torre, pausa, final de nivel, garaje y colores, opciones, estadísticas y la sección de creador.
'use strict';
const M = GD.Menus = {};
const { U, D, A, E, Sprite, Texto, Nodo } = GD;
const P = GD.perfil;
const nn = n => String(n).padStart(2, '0');

// ---------------- fondo que juega solo (MenuGameLayer) ----------------
class FondoMenu extends Nodo {
  constructor() {
    super(); this.t = 0; this.camX = 0; this.hue = 200; this.corredores = []; this.prox = 0.5;
    GD.cargarHoja('game_bg_01_001').then(t => { GD.R.repetir(t); this.txF = t; });
    GD.cargarHoja('groundSquare_01_001').then(t => { GD.R.repetir(t); this.txP = t; });
  }
  color() { return GD.O.hsvARgb(this.hue, 1, 1).map(v => v); }
  alActualizar(dt) {
    this.t += dt; this.camX += 311.58 * dt; this.hue = (this.hue + dt * 8) % 360;
    this.prox -= dt;
    if (this.prox <= 0) { this.prox = GD.azar(2.5, 5); this.nuevo(); }
    for (const c of this.corredores.slice()) {
      c.x += c.v * dt;
      if (c.modo === 'cubo') {
        c.vy -= 0.958199 * 60 * 54 * dt / 1; c.y += c.vy * dt;
        if (c.y <= 15) { c.y = 15; c.vy = 0; c.n.rot = Math.round(c.n.rot / 90) * 90; if (Math.random() < dt * 2.5) c.vy = 11.18 * 54; } else c.n.rot += 420 * dt;
      } else if (c.modo === 'nave' || c.modo === 'ovni') { c.fase += dt; c.y = 120 + Math.sin(c.fase * 1.7) * 60; c.n.rot = -Math.cos(c.fase * 1.7) * 30 * (c.modo === 'nave' ? 1 : 0); }
      else if (c.modo === 'bola') { c.n.rot += 500 * dt; }
      else if (c.modo === 'onda') { c.fase += dt; const k = Math.floor(c.fase * 1.5) % 2; c.y += (k ? 1 : -1) * 311 * dt; c.n.rot = k ? -45 : 45; c.y = GD.clamp(c.y, 20, 250); }
      c.n.x = c.x; c.n.y = 90 + c.y;
      if (c.x > D.ancho + 60) { c.n.sacar(); this.corredores.splice(this.corredores.indexOf(c), 1); }
    }
  }
  nuevo() {
    const modos = ['cubo', 'cubo', 'cubo', 'nave', 'bola', 'ovni', 'onda', 'robot', 'arana'], modo = modos[Math.floor(Math.random() * modos.length)];
    const n = Math.floor(GD.azar(1, Math.max(2, GD.ICONOS.cuantos(modo === 'cubo' ? 'cubo' : modo))));
    const c1 = GD.COLORES[Math.floor(Math.random() * 20)], c2 = GD.COLORES[Math.floor(Math.random() * 20)];
    const nodo = new Nodo();
    if (modo === 'nave' || modo === 'ovni') {
      const cu = new GD.Icono('cubo', Math.floor(GD.azar(1, 60)), c1, c2); cu.escala = 0.55; cu.pos(0, 5); cu.ax = cu.ay = 0.5; nodo.agregar(cu, modo === 'ovni' ? 0 : 1);
      const v = new GD.Icono(modo, n, c1, c2); v.ax = v.ay = 0.5; v.pos(0, -5); nodo.agregar(v, modo === 'ovni' ? 1 : 2);
    } else { const v = new GD.Icono(modo, n, c1, c2); v.ax = v.ay = 0.5; nodo.agregar(v); if (modo === 'onda') v.escala = 0.6; }
    this.agregar(nodo, 5);
    this.corredores.push({ n: nodo, modo, x: -40, y: modo === 'cubo' || modo === 'bola' || modo === 'robot' || modo === 'arana' ? 15 : 120, vy: 0, v: GD.azar(250, 400), fase: Math.random() * 6 });
  }
  dibujar(pm, op) {
    const c = this.color(), R = GD.R;
    if (this.txF) { // fondo
      const tx = this.txF, tam = tx.h / 2, ox = -((this.camX * 0.1) % tam + tam) % tam;
      const xs = _xs, uv = _uv; xs.set([ox, D.alto, ox + D.ancho + tam, D.alto, ox, D.alto - tam, ox + D.ancho + tam, D.alto - tam]);
      const n = (D.ancho + tam) / (tx.w / 2); R.uvRect(uv, 0, 0, n, 1);
      R.quad(tx, false, 0, xs, uv, GD.col(c[0], c[1], c[2], 255));
    }
    super.dibujar(pm, op, 255, 255, 255);
    if (this.txP) M.piso(this, this.txP, this.camX, 90, c, pm, op);
  }
}
M.FondoMenu = FondoMenu;
const _xs = new Float32Array(8), _uv = new Float32Array(8);
// piso del juego (cuadros repetidos + la línea de arriba), con su color un poco más oscuro que el fondo
M.piso = function (nodo, tx, camX, y1, c, pm, op) {
  const R = GD.R, lado = tx.h / 2, ox = -((camX % lado) + lado) % lado, y0 = y1 - lado, n = (D.ancho + lado * 2) / lado;
  _xs.set([ox, y1, ox + D.ancho + lado * 2, y1, ox, y0, ox + D.ancho + lado * 2, y0]); R.uvRect(_uv, 0, 0, n, 1);
  R.quad(tx, false, 0, _xs, _uv, GD.col(c[0] * 0.8, c[1] * 0.8, c[2] * 0.8, 255));
  const f = GD.T.m('floorLine_01_001.png'); if (f) { const s = nodo._l || (nodo._l = new Sprite(f)); s.add = true; s.pos(D.ancho / 2, y1); s.sx = D.ancho / f.sw; s.dibujar(pm, op, 255, 255, 255); }
};

// ---------------- menú principal (MenuLayer) ----------------
M.menu = function () {
  const c = new U.Capa(), W = D.ancho, H = D.alto;
  c.alCrear = () => {
    c.agregar(new FondoMenu(), -5);
    U.sprite(c, 'GJ_logo_001.png', W / 2, H - 50);
    const mid = H / 2 + 10;
    U.boton(c, 'GJ_garageBtn_001.png', W / 2 - 110, mid, () => D.cambiar(M.garaje()));
    const play = U.boton(c, 'GJ_playBtn_001.png', W / 2, mid, () => { GD.S.efecto('playSound_01.ogg'); D.cambiar(M.seleccion()); });
    play.cont.correr(A.siempre(A.sec(A.escala(0.6, 1.05).e(E.inOut(2)), A.escala(0.6, 1).e(E.inOut(2)))));
    U.boton(c, 'GJ_creatorBtn_001.png', W / 2 + 110, mid, () => D.cambiar(M.creador()));
    const abajo = [['GJ_achBtn_001.png', () => M.logros()], ['GJ_optionsBtn_001.png', () => M.opciones()], ['GJ_statsBtn_001.png', () => GD.Extras.estadisticas()], ['GJ_ngBtn_001.png', () => M.musicaNG()]];
    abajo.forEach(([f, cb], i) => U.boton(c, f, W / 2 + (i - 1.5) * 57, 45, cb));
    U.boton(c, 'GJ_moreGamesBtn_001.png', W - 45, 45, () => GD.Extras.abrir('robtop'));
    U.boton(c, 'GJ_dailyRewardBtn_001.png', W - 40, H / 2 - 20, () => M.cofres());
    const perfil = U.boton(c, 'GJ_profileButton_001.png', 45, 105, () => M.perfilJugador()); perfil.escalaBase = 0.9;
    U.texto(c, P.nombre, 45, 135, 'goldFont', 0.6);
    U.boton(c, 'robtoplogo_small.png', 50, 22, () => GD.Extras.abrir('robtop'), 0, 0.8);
    [['gj_fbIcon_001.png', 'fb'], ['gj_twIcon_001.png', 'tw'], ['gj_ytIcon_001.png', 'yt'], ['gj_twitchIcon_001.png', 'twitch'], ['gj_discordIcon_001.png', 'discord']].forEach(([f, k], i) => U.boton(c, f, 105 + i * 22, 22, () => GD.Extras.abrir(k), 0, 0.75));
    GD.S.musica('datos/mus/menuLoop.ogg', 0, true);
  };
  c.alEntrar = () => GD.S.musica('datos/mus/menuLoop.ogg', 0, true);
  c.atras = () => U.alerta('Quit Game', 'Are you sure you want to quit?', 'Cancel', 'Yes');
  return c;
};

// ---------------- selección de niveles (LevelSelectLayer) ----------------
const COL_PAGINA = [[0, 125, 255], [255, 0, 255], [0, 200, 100], [255, 125, 0], [125, 0, 255], [255, 0, 0], [0, 255, 255], [255, 255, 0], [0, 255, 125], [255, 0, 125], [0, 0, 255]];
const CARA = { easy: 1, normal: 2, hard: 3, harder: 4, insane: 5, demon: 6, auto: 'auto', na: 0 };
M.diffIcon = d => `diffIcon_${CARA[d] === 'auto' ? 'auto' : nn(CARA[d] || 0)}_btn_001.png`;
M.barraProgreso = function (padre, x, y, pct, rgb, ancho = 210, etiqueta) {
  const g = new Sprite('GJ_progressBar_001.png'); g.color(0, 0, 0); g.op = 125; g.pos(x, y); g.sx = ancho / g.w; padre.agregar(g);
  const f = new Sprite('GJ_progressBar_001.png'); f.color(rgb); f.anc(0, 0.5); f.pos(x - ancho / 2 + 2, y); f.sx = (ancho - 4) / f.w; f.sy = 0.8; f.recorte = Math.max(0.0001, pct / 100); padre.agregar(f);
  U.texto(padre, Math.floor(pct) + '%', x, y, 'bigFont', 0.5);
  if (etiqueta) U.texto(padre, etiqueta, x, y + 17, 'bigFont', 0.5);
};
M.seleccion = function (pagina = 0) {
  const c = new U.Capa(), W = D.ancho, H = D.alto;
  const ids = [...Array(22)].map((_, i) => i + 1);
  const paginas = ids.length + 2; // + la Torre y "próximamente"
  c.alCrear = () => {
    c.fondo = c.fondoDegradado(COL_PAGINA[0]);
    c.cont = new Nodo(); c.agregar(c.cont);
    c.pag = []; for (let i = 0; i < paginas; i++) { const n = c.armarPagina(i); n.x = i * W; c.cont.agregar(n); c.pag.push(n); }
    const izq = U.boton(c, 'navArrowBtn_001.png', 25, H / 2, () => c.ir(c.actual - 1), 5); izq.cont.fx = true;
    U.boton(c, 'navArrowBtn_001.png', W - 25, H / 2, () => c.ir(c.actual + 1), 5);
    c.puntos = []; for (let i = 0; i < paginas; i++) { const s = U.sprite(c, 'uiDot_001.png', W / 2 + (i - (paginas - 1) / 2) * 12, 18, 0.8, 5); c.puntos.push(s); }
    U.sprite(c, 'GJ_topBar_001.png', W / 2, H - 2, 1, 3).anc(0.5, 1);
    c.botonAtras(() => D.cambiar(M.menu()));
    // piso de abajo
    c.piso = new Nodo(); c.agregar(c.piso, 1);
    c.piso.pintar = (w, o) => { if (c.txP) { const k = c.fondo; M.piso(c.piso, c.txP, -c.cont.x * 0.5, 56, [k.r, k.g, k.b], w, o); } };
    GD.cargarHoja('groundSquare_01_001').then(t => { GD.R.repetir(t); c.txP = t; });
    c.actual = pagina; c.cont.x = -pagina * W; c.marcar();
  };
  c.armarPagina = function (i) {
    const n = new Nodo();
    if (i < ids.length) {
      const info = GD.oficial(ids[i]), prog = P.nivel(ids[i]);
      const caja = U.cajaOscura(340, 95);
      const b = U.boton(n, caja, W / 2, H / 2 + 40, () => M.jugarOficial(ids[i]));
      b.escalaToque = 1.1;
      U.sprite(caja, M.diffIcon(info.dif), 45, 47, 1.1);
      const nom = U.texto(caja, info.nombre, 195, 55, 'bigFont', 0.9); nom.limitar(220, 0.9);
      U.sprite(caja, 'GJ_starsIcon_001.png', 300, 25, 0.8); U.texto(caja, String(info.estrellas), 280, 25, 'bigFont', 0.55).anc(1, 0.5);
      for (let k = 0; k < 3; k++) U.sprite(caja, prog.monedas.includes(k) ? 'secretCoinUI_001.png' : 'secretCoinUI2_001.png', 160 + k * 28, 22, 0.75);
      M.barraProgreso(n, W / 2, H / 2 - 40, prog.normal, [0, 255, 0], 270, 'Normal Mode');
      M.barraProgreso(n, W / 2, H / 2 - 82, prog.practica, [0, 255, 255], 270, 'Practice Mode');
    } else if (i === ids.length) {
      // la Torre: el dibujo de la torre flotando, se toca para entrar
      GD.cargarHoja('TowerSheet').then(() => {
        const t = new Sprite('theTower_01_001.png'); t.escala = 0.62;
        const b = U.boton(n, t, W / 2, H / 2 + 10, () => D.cambiar(GD.Extras.torre())); b.escalaToque = 1.08;
        b.correr(A.siempre(A.sec(A.moverPor(2.2, 0, 6).e(E.sineInOut), A.moverPor(2.2, 0, -6).e(E.sineInOut))));
      });
      U.texto(n, 'The Tower', W / 2, 50, 'bigFont', 0.8);
    } else {
      U.texto(n, 'Coming Soon!', W / 2, H / 2 + 20, 'bigFont', 1);
    }
    return n;
  };
  c.ir = function (i) { i = (i + paginas) % paginas; c.actual = i; c.cont.pararEtq(1); c.cont.correr(A.mover(0.3, -i * W, 0).e(E.out(2)).tag(1)); c.marcar(); };
  c.marcar = function () {
    c.puntos.forEach((s, k) => { s.op = k === c.actual ? 255 : 100; });
    c.fondo.pararEtq(2); const col = COL_PAGINA[c.actual % COL_PAGINA.length]; c.fondo.correr(A.tinte(0.3, ...col).tag(2));
  };
  // deslizar con el dedo
  c.alTocarFondo = (x, y, id) => { c._arr = { x, cx: c.cont.x, id }; c.cont.pararEtq(1); return true; };
  c.alMoverFondo = (x) => { if (c._arr) c.cont.x = c._arr.cx + (x - c._arr.x); };
  c.alSoltarFondo = (x) => { if (!c._arr) return; const dx = x - c._arr.x; c._arr = null; c.ir(c.actual + (dx < -50 ? 1 : dx > 50 ? -1 : 0)); };
  const origToc = c.alTocar.bind(c);
  c.alTocar = (x, y, id) => { const r = origToc(x, y, id); if (c._pres) { c._arr = { x, cx: c.cont.x, id }; } return r; };
  const origMov = c.alMover.bind(c);
  c.alMover = (x, y, id) => { if (c._arr && c._pres && Math.abs(x - c._arr.x) > 10) { c._pres.soltar(); c._pres = null; } if (!c._pres && c._arr) { c.cont.x = c._arr.cx + (x - c._arr.x); return; } origMov(x, y, id); };
  const origSol = c.alSoltar.bind(c);
  c.alSoltar = (x, y, id) => { if (c._pres) { c._arr = null; return origSol(x, y, id); } c.alSoltarFondo(x); };
  c.dibujar = function (pm, op) {
    U.Capa.prototype.dibujar.call(this, pm, op, 255, 255, 255);
  };
  c.alTecla = (k, ab) => { if (!ab) return; if (k === 'ArrowLeft') c.ir(c.actual - 1); if (k === 'ArrowRight') c.ir(c.actual + 1); if (k === 'Escape') D.cambiar(M.menu()); if (k === 'Enter' || k === 'Space') { if (c.actual < ids.length) M.jugarOficial(ids[c.actual]); } };
  c.alEntrar = () => GD.S.musica('datos/mus/menuLoop.ogg', 0, true);
  return c;
};
// la Torre (2.2): por fuera y por dentro, en extras.js
M.torre = () => GD.Extras.torre();
// ---------------- jugar ----------------
// op: texto, info, alSalir (a dónde volver), editor (nivel del editor), id para el progreso
M.jugar = async function (texto, info, extra = {}) {
  const idProg = extra.idProg || (info.oficial ? info.id : 'o' + (info.id || info.nombre));
  const prog = P.nivel(idProg);
  const p = new GD.Partida(Object.assign({ texto, info }, extra, {
    alMorir: (pct, practica) => {
      prog.intentos++; P.sumar('intentos', 1);
      if (practica) { if (pct > prog.practica) prog.practica = pct; }
      else if (pct > prog.normal) { const antes = prog.normal; prog.normal = pct; M.darOrbes(info, antes, pct); if (!extra.editor && pct > antes && antes > 0) M.nuevoRecord(p, pct); }
      P.guardar();
    },
    alGanar: (practica, monedas) => {
      if (practica) { prog.practica = 100; P.guardar(); return; }
      const primera = !prog.hecho;
      if (!extra.editor) M.darOrbes(info, prog.normal, 100);
      prog.normal = 100; prog.hecho = true; prog.intentos++;
      const ms = p.objs.filter(o => o.ty === GD.O.TIPO.MONEDA_SECRETA || o.ty === GD.O.TIPO.MONEDA_USUARIO).sort((a, b) => a.x - b.x);
      ms.forEach((o, k) => {
        if (!monedas[o.i] || prog.monedas.includes(k)) return;
        prog.monedas.push(k); if (extra.editor) return;
        P.sumar('monedasGanadas', 1); if (o.ty === GD.O.TIPO.MONEDA_USUARIO) P.sumar('monedasUsuario', 1);
      });
      if (primera && info.estrellas) { if (info.plataforma) P.lunas += info.estrellas; else P.estrellas += info.estrellas; }
      if (primera && !extra.editor) { P.sumar(info.oficial ? 'oficialesHechos' : 'onlineHechos', 1); if (info.dif === 'demon') P.sumar('demonios', 1); }
      p.primera = primera; P.guardar();
    },
    alFinPantalla: pp => M.finNivel(pp, info, prog),
    alPausar: pp => M.pausa(pp, info, prog),
  }));
  p.volver = extra.volver || (() => M.seleccion(Math.max(0, (info.id | 0) - 1)));
  return p;
};
// orbes de los niveles con estrellas: se ganan a medida que se mejora el récord, hasta el total
// que da la dificultad al llegar al 100%
M.ORBES = { 2: 50, 3: 75, 4: 125, 5: 175, 6: 225, 7: 275, 8: 350, 9: 425, 10: 500 };
M.darOrbes = function (info, antes, ahora) {
  const tot = M.ORBES[info.estrellas | 0] || 0; if (!tot || info.plataforma) return;
  const n = Math.floor(tot * ahora / 100) - Math.floor(tot * antes / 100);
  if (n > 0) { P.orbes += n; P.sumar('orbesGanados', n); }
};
M.jugarOficial = async function (id) {
  GD.S.efecto('playSound_01.ogg'); GD.S.pararMusica();
  const info = GD.oficial(id), txt = await GD.N.descomprimir(GD.datos.niveles[id]);
  const volver = id >= 5001 ? () => GD.Extras.torreAdentro() : () => M.seleccion(Math.max(0, id - 1));
  D.cambiar(await M.jugar(txt, info, { volver }));
};
M.partidaOficial = async function (id, op = {}) {
  const info = GD.oficial(id), txt = await GD.N.descomprimir(GD.datos.niveles[id]);
  return M.jugar(txt, info, op);
};
M.nuevoRecord = function (p, pct) {
  const s = new Sprite('GJ_newBest_001.png'); s.pos(D.ancho / 2, D.alto / 2 + 40); s.escala = 0.1; p.hud.agregar(s);
  const l = new Texto(pct + '%', 'bigFont'); l.pos(D.ancho / 2, D.alto / 2); l.escala = 0.1; p.hud.agregar(l);
  for (const n of [s, l]) n.correr(A.sec(A.escala(0.4, 1).e(E.elasticOut(0.6)), A.esperar(0.5), A.op(0.3, 0), A.quitar()));
  GD.S.efecto('highscoreGet02.ogg', 0.6);
};

// ---------------- pausa (PauseLayer) ----------------
M.pausa = function (p, info, prog) {
  const pop = new U.Popup(440, 290, 'GJ_square01.png'), k = pop.caja;
  U.texto(k, info.nombre, 0, 115, 'bigFont', 0.8).limitar(380, 0.8);
  M.barraProgreso(k, 0, 70, prog.normal, [0, 255, 0], 300, 'Normal Mode');
  M.barraProgreso(k, 0, 25, prog.practica, [0, 255, 255], 300, 'Practice Mode');
  const salir = () => { pop.cerrar(); GD.S.seguir(); GD.S.pararMusica(); D.cambiar(p.volver ? p.volver() : M.menu()); };
  const fila = [];
  if (p.opc.editor) fila.push(['GJ_editBtn_001.png', () => { pop.cerrar(); GD.S.seguir(); GD.S.pararMusica(); D.cambiar(GD.Editor.abrir(p.opc.editor)); }]);
  fila.push([p.practica ? 'GJ_normalBtn_001.png' : 'GJ_practiceBtn_001.png', () => { pop.cerrar(); GD.S.seguir(); M.cambiarPractica(p); }]);
  fila.push(['GJ_playBtn2_001.png', () => { pop.cerrar(); p.seguir(); }]);
  fila.push(['GJ_replayBtn_001.png', () => { pop.cerrar(); p.seguir(); p.checkpoints.length = 0; p.cpPlat = null; p.reiniciar(); }]);
  fila.push(['GJ_menuBtn_001.png', salir]);
  fila.forEach(([f, cb], i) => U.boton(k, f, (i - (fila.length - 1) / 2) * 75, -40, cb, 0, f === 'GJ_playBtn2_001.png' ? 1 : 0.85));
  // volumen
  U.sprite(k, 'GJ_musicOnBtn_001.png', -185, -100, 0.5);
  const d1 = new U.Deslizador(P.vMus, v => { P.vMus = v; GD.S.volMusica(v); P.guardar(); }); d1.pos(-90, -100); d1.escala = 0.75; k.agregar(d1);
  U.sprite(k, 'GJ_fxOnBtn_001.png', 25, -100, 0.5);
  const d2 = new U.Deslizador(P.vSfx, v => { P.vSfx = v; GD.S.vSfx = v; P.guardar(); }); d2.pos(120, -100); d2.escala = 0.75; k.agregar(d2);
  pop.alTocarFondo = (x, y) => { for (const d of [d1, d2]) if (d.toca(x, y)) { pop._des = d; d.tocar(x, y); } return true; };
  pop.alMoverFondo = (x, y) => { if (pop._des) pop._des.tocar(x, y); };
  pop.alSoltarFondo = () => { pop._des = null; };
  pop.alTecla = (c, ab) => { if (ab && (c === 'Escape' || c === 'Space')) { pop.cerrar(); p.seguir(); } };
  pop.mostrar(p);
};
M.cambiarPractica = function (p) {
  p.practica = !p.practica; p.checkpoints.length = 0;
  if (p.btnCheck) { p.btnCheck.sacar(); p.btnBorrar.sacar(); p.btnCheck = p.btnBorrar = null; }
  if (p.practica) p.armarPractica(); else GD.S.pararMusica();
  p.seguir(); p.reiniciar();
};

// ---------------- final del nivel (EndLevelLayer) ----------------
M.finNivel = function (p, info, prog) {
  const W = D.ancho, H = D.alto, capa = new U.Capa(), cuadro = new Nodo();
  capa.velo = new GD.Rect(W, H, 0, 0, 0, 0); capa.agregar(capa.velo, -1); capa.velo.correr(A.op(0.5, 100));
  cuadro.pos(W / 2, H + 200); capa.agregar(cuadro);
  // cadenas y tablero
  for (const sx of [-130, 130]) { const ch = new Sprite('chain_01_001.png'); ch.anc(0.5, 0); ch.pos(sx, 100); ch.sy = 4; cuadro.agregar(ch, -2); }
  const tab = new U.Cuadro('GJ_square01.png', 380, 220, 20); tab.pos(-190, -110); cuadro.agregar(tab, -1);
  U.sprite(cuadro, p.practica ? 'GJ_practiceComplete_001.png' : 'GJ_levelComplete_001.png', 0, 75, 0.8);
  const t = Math.floor(p.tiempo), hh = Math.floor(t / 3600), mm = Math.floor(t / 60) % 60, ss = t % 60;
  U.texto(cuadro, `Attempts: ${p.intentos}`, 0, 30, 'goldFont', 0.75);
  U.texto(cuadro, `Jumps: ${p.saltos || 0}`, 0, 5, 'goldFont', 0.75);
  U.texto(cuadro, `Time: ${nn(hh)}:${nn(mm)}:${nn(ss)}`, 0, -20, 'goldFont', 0.75);
  if (p.primera && info.estrellas) {
    const st = U.sprite(cuadro, 'GJ_bigStar_001.png', 150, 30, 0.1); st.correr(A.sec(A.esperar(0.8), A.escala(0.4, 0.8).e(E.elasticOut(0.6))));
    U.texto(cuadro, '+' + info.estrellas, 150, -10, 'bigFont', 0.6);
    GD.S.efecto('highscoreGet02.ogg');
  }
  const ms = p.objs.filter(o => o.ty === GD.O.TIPO.MONEDA_SECRETA || o.ty === GD.O.TIPO.MONEDA_USUARIO).sort((a, b) => a.x - b.x);
  ms.forEach((o, k) => U.sprite(cuadro, p.monedas[o.i] ? 'secretCoinUI_001.png' : 'secretCoinUI2_001.png', (k - (ms.length - 1) / 2) * 32, -50, 0.8));
  const salir = () => { GD.S.pararMusica(); D.cambiar(p.volver ? p.volver() : M.menu()); };
  U.boton(cuadro, 'GJ_replayBtn_001.png', -60, -85, () => { capa.sacar(); D.soltarPila(capa); p.pantallaFin = false; p.finSonido = false; p.checkpoints.length = 0; p.cpPlat = null; p.reiniciar(); }, 0, 0.9);
  U.boton(cuadro, 'GJ_menuBtn_001.png', 60, -85, salir, 0, 0.9);
  if (p.opc.editor) U.boton(cuadro, 'GJ_editBtn_001.png', 160, -85, () => { D.soltarPila(capa); D.cambiar(GD.Editor.abrir(p.opc.editor)); }, 0, 0.8);
  cuadro.correr(A.mover(1, W / 2, H / 2 + 10).e(E.bounceOut));
  p.agregar(capa, 2000); D.empujar(capa);
  GD.S.musica('datos/mus/StayInsideMe.ogg', 0, true, 1);
};

// ---------------- garaje (GJGarageLayer) ----------------
const TABS = [['cubo', 'gj_iconBtn'], ['nave', 'gj_shipBtn'], ['bola', 'gj_ballBtn'], ['ovni', 'gj_birdBtn'], ['onda', 'gj_dartBtn'], ['robot', 'gj_robotBtn'], ['arana', 'gj_spiderBtn'], ['columpio', 'gj_swingBtn'], ['jetpack', 'gj_jetpackBtn'], ['estela', 'gj_streakBtn'], ['muerte', 'gj_explosionBtn']];
// estelas y efectos de muerte no son íconos de jugador: tienen su propia lista de dibujos
const ESPECIALES = { estela: { total: 7, f: n => `player_special_${nn(n)}_001.png` }, muerte: { total: 20, f: n => `explosionIcon_${nn(n)}_001.png` } };
M.garaje = function () {
  const c = new U.Capa(), W = D.ancho, H = D.alto;
  let tab = 'cubo', pag = 0;
  c.alCrear = () => {
    c.fondoDegradado([0, 102, 255]); c.esquinas();
    U.sprite(c, 'GJ_topBar_001.png', W / 2, H, 1, 1).anc(0.5, 1);
    const nombre = new U.Campo('Player', 160, 30, 'bigFont', 15); nombre.texto = P.nombre; nombre.pos(W / 2, H - 22); c.agregar(nombre, 2);
    nombre.alListo = v => { P.nombre = v || 'Player'; P.guardar(); };
    c.campoNombre = nombre;
    c.vista = new Nodo(); c.vista.pos(W / 2, H - 82); c.agregar(c.vista, 2); c.verIcono();
    // piso debajo del muñeco
    const linea = new Sprite('floorLine_01_001.png'); linea.pos(W / 2, H - 112); linea.sx = 0.6; linea.add = true; c.agregar(linea);
    c.marco = new U.Cuadro('GJ_square02.png', 400, 150, 20); c.marco.op = 0; c.agregar(c.marco);
    const fondoGrilla = U.cajaOscura(440, 135, 75, 'square02_001.png', 12); fondoGrilla.pos(W / 2 - 220, 22); c.agregar(fondoGrilla);
    c.grilla = new Nodo(); c.agregar(c.grilla, 3);
    c.tabs = TABS.map(([t, f], i) => { const b = U.boton(c, f + '_off_001.png', W / 2 + (i - (TABS.length - 1) / 2) * 38, 175, () => { tab = t; pag = 0; c.armarGrilla(); }, 4, 0.8); b.tipo = t; b.f0 = f; return b; });
    const izq = U.boton(c, 'GJ_arrow_01_001.png', W / 2 - 245, 90, () => { pag--; c.armarGrilla(); }, 4, 0.6);
    const der = U.boton(c, 'GJ_arrow_01_001.png', W / 2 + 245, 90, () => { pag++; c.armarGrilla(); }, 4, 0.6); der.cont.fx = true;
    U.boton(c, 'GJ_paintBtn_001.png', W / 2 + 120, H - 82, () => M.colores(c), 4, 0.9);
    c.botonAtras(() => { U.soltarFoco(); P.guardar(); D.cambiar(M.menu()); });
    c.armarGrilla();
  };
  c.verIcono = () => {
    c.vista.vaciar(); const m = P.modoIcono;
    const ic = new GD.Icono(m, P[m], P.c1rgb(), P.c2rgb(), P.brillo, P.cGlowrgb()); ic.ax = ic.ay = 0.5; ic.escala = 1.6;
    if (m === 'nave' || m === 'ovni' || m === 'jetpack') { const cu = new GD.Icono('cubo', P.cubo, P.c1rgb(), P.c2rgb(), P.brillo); cu.ax = cu.ay = 0.5; cu.escala = 0.9; cu.pos(0, 8); c.vista.agregar(cu, m === 'ovni' ? 0 : 1); ic.pos(0, -8); c.vista.agregar(ic, m === 'ovni' ? 1 : 2); }
    else c.vista.agregar(ic);
  };
  c.armarGrilla = () => {
    c.grilla.vaciar();
    const esp = ESPECIALES[tab], total = esp ? esp.total : GD.ICONOS.cuantos(tab), porPag = 36, pags = Math.ceil(total / porPag);
    pag = (pag + pags) % pags;
    for (const b of c.tabs) b.cont.marco(b.f0 + (b.tipo === tab ? '_on_001.png' : '_off_001.png'));
    for (let k = 0; k < porPag; k++) {
      const n = pag * porPag + k + 1; if (n > total) break;
      const fila = Math.floor(k / 12), col = k % 12;
      const ic = esp ? new Sprite(esp.f(n)) : new GD.Icono(tab, n, [175, 175, 175], [255, 255, 255]); ic.ax = ic.ay = 0.5; if (esp) ic.listo = Promise.resolve();
      const cont = new Nodo(); cont.w = cont.h = 30; ic.pos(15, 15); cont.agregar(ic); ic.escala = tab === 'onda' ? 0.6 : 0.75;
      ic.listo.then(() => { const k2 = 26 / Math.max(ic.w || 26, ic.h || 26); ic.escala = Math.min(ic.escala, k2 * (tab === 'onda' ? 1 : 1)); });
      const b = U.boton(c.grilla, cont, W / 2 - 192 + col * 35, 132 - fila * 40, () => { P[tab] = n; if (!esp) P.modoIcono = tab; P.guardar(); c.verIcono(); c.armarGrilla(); GD.S.efecto('playSound_01.ogg', 0.3); });
      if (P[tab] === n) { const sel = new Sprite('GJ_select_001.png'); sel.pos(15, 15); sel.escala = 0.85; cont.agregar(sel, 2); }
      void b;
    }
    U.texto(c.grilla, `${pag + 1}/${pags}`, W / 2 + 200, 8, 'goldFont', 0.45);
  };
  c.atras = () => { P.guardar(); D.cambiar(M.menu()); };
  return c;
};
// colores del jugador (GJGarageLayer → selector de colores)
M.colores = function (garaje) {
  const pop = new U.Popup(470, 290, 'GJ_square01.png'), k = pop.caja; let cual = 'c1';
  pop.titulo('Colors');
  const sel = U.texto(k, 'Col 1', -170, 105, 'goldFont', 0.6);
  const bts = [['c1', 'Col 1'], ['c2', 'Col 2'], ['cGlow', 'Glow']].map(([kk, t], i) => U.boton(k, U.botonTexto(t, 70, 'goldFont', 'GJ_button_01.png', 26, 0.6), -150 + i * 85, 92, () => { cual = kk; sel.texto(t); armar(); }));
  void bts; sel.vis = false;
  const brillo = U.casilla(k, 180, 95, P.brillo, v => { P.brillo = v; P.guardar(); garaje.verIcono(); }, 0.6); void brillo;
  U.texto(k, 'Glow', 180, 77, 'goldFont', 0.4);
  const grilla = new Nodo(); k.agregar(grilla);
  const armar = () => {
    grilla.vaciar();
    GD.COLORES.forEach((rgb, i) => {
      const col = i % 14, fila = Math.floor(i / 14);
      const s = new Sprite('GJ_colorBtn_001.png'); s.color(rgb); s.escala = 0.7;
      U.boton(grilla, s, -205 + col * 31.5, 55 - fila * 31, () => { P[cual] = i; P.guardar(); garaje.verIcono(); armar(); });
      if (P[cual] === i) U.sprite(grilla, 'GJ_select_001.png', -205 + col * 31.5, 55 - fila * 31, 0.7, 2);
    });
  };
  armar();
  U.boton(k, U.botonTexto('OK', 70), 0, -125, () => pop.cerrar());
  pop.mostrar();
};

// ---------------- opciones, estadísticas, logros ----------------
M.opciones = function () {
  const pop = new U.Popup(400, 280, 'GJ_square01.png'), k = pop.caja; pop.titulo('Settings');
  U.texto(k, 'Music', -100, 75, 'goldFont', 0.6); U.texto(k, 'SFX', 100, 75, 'goldFont', 0.6);
  const d1 = new U.Deslizador(P.vMus, v => { P.vMus = v; GD.S.volMusica(v); P.guardar(); }); d1.pos(-100, 50); d1.escala = 0.75; k.agregar(d1);
  const d2 = new U.Deslizador(P.vSfx, v => { P.vSfx = v; GD.S.vSfx = v; P.guardar(); }); d2.pos(100, 50); d2.escala = 0.75; k.agregar(d2);
  pop.alTocarFondo = (x, y) => { for (const d of [d1, d2]) if (d.toca(x, y)) { pop._des = d; d.tocar(x, y); } return true; };
  pop.alMoverFondo = (x, y) => { if (pop._des) pop._des.tocar(x, y); };
  pop.alSoltarFondo = () => { pop._des = null; };
  const bs = [['Options', () => M.masOpciones()], ['How To Play', () => GD.Extras.comoJugar()],
    ['Rate', () => { try { window.open('https://play.google.com/store/apps/details?id=com.robtopx.geometryjump', '_blank', 'noopener'); } catch (e) { } }], ['Help', () => U.alerta('Help', 'Geometry Dash 2.2 ported to HTML5. Your progress is saved in this browser.')]];
  bs.forEach(([t, f], i) => U.boton(k, U.botonTexto(t, 150, 'goldFont', 'GJ_button_01.png', 30, 0.7), (i % 2 ? 85 : -85), -5 - Math.floor(i / 2) * 40, f));
  U.boton(k, U.botonTexto('Account', 150, 'goldFont', 'GJ_button_02.png', 30, 0.7), 0, -95, () => GD.Online && GD.Online.cuenta());
  pop.cerrarBtn();
  pop.mostrar();
};
M.OPCIONES = [['auto-retry', 'Auto-Retry', true], ['auto-checkpoints', 'Auto-Checkpoints', true], ['progress-bar', 'Show Progress Bar', true], ['show-percent', 'Show Percentage', true],
  ['flip-2p', 'Flip 2-Player Controls', false], ['dual-split', 'Split Dual Controls', false], ['no-death-effect', 'Disable Death Effect', false], ['high-detail', 'Low Detail Mode', false],
  ['show-hitboxes', 'Show Hitboxes (practice)', false], ['fast-reset', 'Fast Practice Reset', false], ['hide-attempts', 'Hide Attempts', false], ['no-orb-buffer', 'Disable Orb Buffer', false]];
M.masOpciones = function () {
  const pop = new U.Popup(440, 290, 'GJ_square01.png'), k = pop.caja; pop.titulo('Options');
  M.OPCIONES.forEach(([id, t, def], i) => {
    const col = i % 2, fila = Math.floor(i / 2), x = -190 + col * 210, y = 80 - fila * 33;
    U.casilla(k, x, y, P.opcion(id, def), v => { P.opciones[id] = v; if (id === 'dual-split') P.dualDividido = v; P.guardar(); }, 0.6);
    U.texto(k, t, x + 18, y, 'bigFont', 0.38).anc(0, 0.5);
  });
  pop.cerrarBtn(); pop.mostrar();
};
M.logros = function () {
  const pop = new U.Popup(380, 260, 'GJ_square01.png'), k = pop.caja; pop.titulo('Achievements');
  const hechos = Object.entries(P.progreso).filter(([id, p]) => p.hecho && +id < 30).map(([id]) => GD.oficial(id) && GD.oficial(id).nombre).filter(Boolean);
  U.texto(k, hechos.length ? 'Completed:\n' + hechos.slice(0, 8).join('\n') : 'Complete levels to earn achievements!', 0, 0, 'chatFont', 0.8, 0, 320);
  pop.cerrarBtn(); pop.mostrar();
};
M.musicaNG = () => U.alerta('Newgrounds', 'Music for online levels comes from Newgrounds and the Geometry Dash music library. It downloads automatically when you play a level.');
M.cofres = () => GD.Extras.cofres();
M.perfilJugador = function () {
  const pop = new U.Popup(380, 220, 'GJ_square01.png'), k = pop.caja; pop.titulo(P.nombre);
  const ic = new GD.Icono('cubo', P.cubo, P.c1rgb(), P.c2rgb(), P.brillo); ic.ax = ic.ay = 0.5; ic.pos(0, 40); ic.escala = 1.3; k.agregar(ic);
  [['GJ_starsIcon_001.png', P.estrellas], ['GJ_moonsIcon_001.png', P.lunas], ['GJ_diamondsIcon_001.png', P.diamantes]].forEach(([f, v], i) => { U.sprite(k, f, -90 + i * 90, -20, 0.8); U.texto(k, U.num(v), -90 + i * 90, -45, 'bigFont', 0.5); });
  pop.cerrarBtn(); pop.mostrar();
};

// ---------------- sección de creador (CreatorLayer) ----------------
M.creador = function () {
  const c = new U.Capa(), W = D.ancho, H = D.alto;
  c.alCrear = () => {
    c.fondoDegradado([0, 102, 255]); c.esquinas();
    const O = () => GD.Online;
    const bs = [['GJ_createBtn_001.png', () => D.cambiar(GD.Editor.misNiveles())], ['GJ_savedBtn_001.png', () => O().lista({ tipo: 'guardados' })], ['GJ_highscoreBtn_001.png', () => O().puntajes()],
      ['GJ_challengeBtn_001.png', () => GD.Extras.misiones()], ['GJ_versusBtn_001.png', () => U.alerta('Versus', 'Coming soon!')], ['GJ_mapBtn_001.png', () => U.alerta('The Map', 'Coming soon!')],
      ['GJ_dailyBtn_001.png', () => O().diario(false)], ['GJ_weeklyBtn_001.png', () => O().diario(true)], ['GJ_eventBtn_001.png', () => O().diario('evento')],
      ['GJ_gauntletsBtn_001.png', () => O().gauntlets()], ['GJ_featuredBtn_001.png', () => O().lista({ tipo: 6 })], ['GJ_listsBtn_001.png', () => O().listas()],
      ['GJ_pathsBtn_001.png', () => U.alerta('Paths', 'Coming soon!')], ['GJ_mapPacksBtn_001.png', () => O().mapPacks()], ['GJ_searchBtn_001.png', () => D.cambiar(O().buscar())]];
    bs.forEach(([f, cb], i) => { const col = i % 5, fila = Math.floor(i / 5); U.boton(c, f, W / 2 + (col - 2) * 92, H - 75 - fila * 85, cb, 0, 0.82); });
    c.botonAtras(() => D.cambiar(M.menu()));
  };
  c.atras = () => D.cambiar(M.menu());
  return c;
};
