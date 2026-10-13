// La partida (PlayLayer / GJBaseGameLayer): carga del nivel, cámara, fondo y piso, dibujo por
// capas, física con choques, portales, pads, aros, monedas, muerte, práctica y final del nivel.
'use strict';
const TYP = GD.O.TIPO;
const SEC = 100; // ancho de sección (como el juego) para buscar objetos cerca

class Partida extends GD.Nodo {
  // op: {texto (nivel ya descomprimido), info:{nombre, id, oficial, cancion, ...}, practica, editor (prueba desde el editor), desde (x inicial)}
  constructor(op) {
    super(); this.opc = op; this.w = GD.D.ancho; this.h = GD.D.alto; this.ax = this.ay = 0;
    this.intentos = 1; this.tiempo = 0; this.pausada = false; this.terminada = false; this.practica = !!op.practica;
    this.checkpoints = [];
  }
  async alCrear() {
    const nv = this.nv = GD.N.leer(this.opc.texto);
    this.cargarAjustes();
    this.armarObjetos();
    await this.cargarFondo();
    this.hud = new GD.Nodo(); this.hud.z = 100; this.agregar(this.hud);
    this.armarHUD();
    this.reiniciar(true);
    this.listo = true;
  }
  cargarAjustes() {
    const N = GD.N, nv = this.nv;
    this.fondo = Math.max(1, N.ajuste(nv, 'kA6', 1)); this.piso = Math.max(1, N.ajuste(nv, 'kA7', 1));
    this.lineaPiso = N.ajuste(nv, 'kA17', 1); this.medio = N.ajuste(nv, 'kA25', 0);
    this.modoIni = N.ajuste(nv, 'kA2', 0); this.miniIni = N.ajuste(nv, 'kA3', 0) == 1; this.dualIni = N.ajuste(nv, 'kA8', 0) == 1;
    this.velIni = [1, 0, 2, 3, 4][N.ajuste(nv, 'kA4', 0)] ?? 1; this.gravIni = N.ajuste(nv, 'kA11', 0) == 1 ? -1 : 1;
    this.plataformas = N.ajuste(nv, 'kA22', 0) == 1;
    this.offsetCancion = N.ajuste(nv, 'kA13', 0);
    this.fundidoIn = N.ajuste(nv, 'kA15', 0) == 1; this.fundidoOut = N.ajuste(nv, 'kA16', 0) == 1;
  }
  armarObjetos() {
    const objs = this.objs = [];
    for (const raw of this.nv.objs) {
      const o = new GD.O.Obj(raw); o.i = objs.length; objs.push(o);
    }
    // orden de dibujo fijo: capa, orden Z y orden en el nivel
    const capa = o => GD.O.ORDEN_CAPA[o.capa] ?? 5;
    this.ordenados = objs.slice().sort((a, b) => capa(a) - capa(b) || a.orden - b.orden || a.i - b.i);
    this.ordenados.forEach((o, k) => o.rango = k);
    this.grupos = {};
    for (const o of objs) if (o.grupos) for (const g of o.grupos) (this.grupos[g] = this.grupos[g] || []).push(o);
    this.reseccionar();
    let fin = 0; for (const o of objs) if (!GD.O.esTrigger(o.id)) fin = Math.max(fin, o.x);
    this.largo = Math.max(fin + 340, 600);
    this.triggers = objs.filter(o => GD.TR && GD.TR.esTrigger(o)).sort((a, b) => a.x - b.x);
    this.inicios = objs.filter(o => o.id === 31).sort((a, b) => a.x - b.x);
  }
  reseccionar() {
    this.secs = [];
    for (const o of this.objs) this.ponerEnSeccion(o);
  }
  ponerEnSeccion(o) {
    const s = Math.max(0, Math.floor(o.cx / SEC)); o.sec = s;
    (this.secs[s] = this.secs[s] || []).push(o);
  }
  moverSeccion(o) {
    const s = Math.max(0, Math.floor(o.cx / SEC)); if (s === o.sec) return;
    const a = this.secs[o.sec]; if (a) { const i = a.indexOf(o); if (i >= 0) a.splice(i, 1); }
    o.sec = s; (this.secs[s] = this.secs[s] || []).push(o);
  }
  async cargarFondo() {
    const T = GD.T, nn = n => String(n).padStart(2, '0');
    const bg = `game_bg_${nn(this.fondo)}_001`, gs = `groundSquare_${nn(this.piso)}_001`, gs2 = `groundSquare_${nn(this.piso)}_2_001`;
    const carga = async n => { if (!GD.datos.hojas.hasOwnProperty(n)) return null; const t = await T.textura(n); GD.R.repetir(t); return t; };
    [this.txFondo, this.txPiso, this.txPiso2] = await Promise.all([carga(bg), carga(gs), carga(gs2)]);
    if (this.medio) { const n = `fg_${nn(this.medio)}`; [this.txMedio, this.txMedio2] = await Promise.all([carga(n + '_001'), carga(n + '_2_001')]); }
  }
  armarHUD() {
    const D = GD.D, h = this.hud;
    this.barra = new GD.Sprite('slidergroove2.png'); this.barra.pos(D.ancho / 2, D.alto - 8);
    this.barraLlena = new GD.Sprite('sliderBar2.png'); this.barraLlena.anc(0, 0).pos(2, 4); this.barraLlena.repX = this.barra.w - 4; this.barraLlena.color(0, 255, 0);
    this.barra.agregar(this.barraLlena, -1);
    if (!GD.T.m('slidergroove2.png')) this.barra.vis = false;
    h.agregar(this.barra);
    this.pct = new GD.Texto('0%', 'bigFont'); this.pct.escala = 0.5; this.pct.anc(0, 0.5).pos(D.ancho / 2 + 110, D.alto - 8); h.agregar(this.pct);
    // botón de pausa
    this.btnPausa = new GD.Sprite('GJ_pauseBtn_001.png'); this.btnPausa.escala = 0.6; this.btnPausa.op = 75; this.btnPausa.pos(D.ancho - 15, D.alto - 15); h.agregar(this.btnPausa);
    if (this.practica) this.armarPractica();
  }
  armarPractica() {
    const D = GD.D;
    this.btnCheck = new GD.Sprite('GJ_checkpointBtn_001.png'); this.btnCheck.pos(D.ancho / 2 - 30, 30); this.btnCheck.escala = 0.8; this.btnCheck.op = 150; this.hud.agregar(this.btnCheck);
    this.btnBorrar = new GD.Sprite('GJ_removeCheckBtn_001.png'); this.btnBorrar.pos(D.ancho / 2 + 30, 30); this.btnBorrar.escala = 0.8; this.btnBorrar.op = 150; this.hud.agregar(this.btnBorrar);
  }

  // ---------- reinicio ----------
  reiniciar(primera) {
    const cp = this.practica && this.checkpoints.length ? this.checkpoints[this.checkpoints.length - 1] : null;
    this.cols = new GD.O.Colores(this.nv, GD.perfil.c1rgb(), GD.perfil.c2rgb());
    for (const o of this.objs) { o.dx = 0; o.dy = 0; o.drot = 0; o.op = 1; o.activo = true; o.usado = false; o.pulsos = null; o.esx = 1; o.esy = 1; o.oculto = false; o.tomado = false; o.muerto = false; if (o.sec === undefined) this.ponerEnSeccion(o); }
    this.reseccionar();
    if (GD.TR) GD.TR.reiniciar(this);
    const j = this.j = new GD.Jugador(this);
    this.j2 = null;
    let x0 = 0, y0 = 15, modo = this.modoIni, vel = this.velIni, mini = this.miniIni, grav = this.gravIni, dual = this.dualIni, espejo = false;
    const ini = this.opc.desdeInicio !== false ? (this.opc.inicio || this.inicios.find(o => o.raw[kStartPosActive] == 1 || true) && this.opc.inicio) : null;
    if (ini) { x0 = ini.x; y0 = ini.y; modo = +ini.raw.kA2 || 0; }
    j.x = x0; j.y = y0; j.modo = GD.O.MODOS[modo] || 'cubo'; j.vel = vel; j.mini = mini; j.grav = grav; j.suelo = true; j.yv = 0; j.rot = 0;
    j.portalY = y0;
    this.sigTrigger = 0; this.tiempo = 0; this.muerteT = 0; this.terminada = false; this.muerto = false; this.fin = null;
    this.monedas = {}; this.coleccion = [];
    this.camX = x0 - GD.D.ancho * 0.25; this.camY = -90; this.camYObj = -90;
    this.limites = null; this.espejo = espejo; this.espejoK = 0;
    this.objsTocados = new Set();
    if (this.opc.desdeX && !cp) { j.x = this.opc.desdeX; j.y = 15; }
    if (cp) this.cargarCheckpoint(cp);
    else if (j.esVuelo()) this.ponerLimites(j, j.y, true);
    // pasar los triggers anteriores a la posición inicial (como el juego al empezar en un punto)
    if (GD.TR) GD.TR.saltarHasta(this, j.x);
    if (dual && !cp) this.activarDual(true);
    this.armarJugadorVisual();
    this.empezarMusica(cp ? cp.tiempo : this.tiempoParaX(j.x));
    if (!primera) this.intentos++;
    this.mostrarIntento();
  }
  tiempoParaX(x) { // segundos hasta llegar a x según los portales de velocidad (como timeForXPos)
    const ps = this.objs.filter(o => o.id in GD.O.VELOCIDAD && o.x < x).sort((a, b) => a.x - b.x);
    let t = 0, px = 0, v = this.velIni;
    for (const p of ps) { t += (p.x - px) / GD.O.UPS[v]; px = p.x; v = GD.O.VELOCIDAD[p.id]; }
    return t + (x - px) / GD.O.UPS[v];
  }
  empezarMusica(t) {
    const info = this.opc.info || {};
    if (this.opc.silencio) return;
    const ruta = info.musica; if (!ruta) return;
    GD.S.musica(ruta, t + this.offsetCancion, false, this.fundidoIn && t < 0.1 ? 2 : 0);
  }
  mostrarIntento() {
    if (this.lblIntento) this.lblIntento.sacar();
    const l = this.lblIntento = new GD.Texto('Attempt ' + this.intentos, 'bigFont');
    l.escala = 0.8; l.pos(this.j.x + 100, this.j.y + 120); l.mundo = true;
  }
  armarJugadorVisual() {
    const P = GD.perfil;
    const mk = () => {
      const n = new GD.Nodo(); n.ic = {};
      return n;
    };
    this.vis1 = this.vis1 || mk();
    this.actualizarIcono(this.j, this.vis1);
  }
  actualizarIcono(j, v) {
    const P = GD.perfil, m = j.modo;
    if (v.modo === m && v.mini === j.mini) return;
    v.modo = m; v.mini = j.mini; v.vaciar();
    const c1 = P.c1rgb(), c2 = P.c2rgb(), gl = P.brillo;
    const ic = (tipo, n) => new GD.Icono(tipo, n, c1, c2, gl, P.cGlowrgb());
    if (m === 'cubo') { v.cuerpo = v.agregar(ic('cubo', P.cubo)); }
    else if (m === 'nave' || m === 'ovni' || m === 'jetpack') {
      v.cubo = v.agregar(ic('cubo', P.cubo), 1); v.cubo.escala = 0.55;
      v.cuerpo = v.agregar(ic(m === 'nave' ? 'nave' : m === 'ovni' ? 'ovni' : 'jetpack', m === 'nave' ? P.nave : m === 'ovni' ? P.ovni : P.jetpack), m === 'ovni' ? 0 : 2);
      v.cubo.pos(0, m === 'ovni' ? 5 : 5); v.cuerpo.pos(0, m === 'ovni' ? -5 : -5);
      if (m === 'ovni') { v.cubo.z = 0; v.cuerpo.z = 1; v._sucio = true; }
    } else v.cuerpo = v.agregar(ic(m === 'bola' ? 'bola' : m === 'onda' ? 'onda' : m === 'robot' ? 'robot' : m === 'arana' ? 'arana' : 'columpio', P[m === 'bola' ? 'bola' : m === 'onda' ? 'onda' : m === 'robot' ? 'robot' : m === 'arana' ? 'arana' : 'columpio']));
    for (const h of v.hijos) { h.ax = h.ay = 0.5; }
    v.escala = j.mini ? 0.6 : 1;
    if (m === 'onda') v.escala *= 0.6;
  }

  // ---------- entrada ----------
  alTocar(x, y, id) {
    if (!this.listo) return;
    if (this.btnPausa.toca(x, y) && !this.terminada) { this.pausar(); return; }
    if (this.practica && this.btnCheck && this.btnCheck.toca(x, y)) { this.ponerCheckpoint(); return; }
    if (this.practica && this.btnBorrar && this.btnBorrar.toca(x, y)) { this.quitarCheckpoint(); return; }
    // en dual con dos dedos: cada mitad de la pantalla maneja un jugador (como en el teléfono)
    if (this.j2 && GD.perfil.dualDividido && x > GD.D.ancho / 2) { this.toques2 = (this.toques2 || 0) + 1; this.j2.presionar(); return; }
    this.toques = (this.toques || 0) + 1; this._idT = this._idT || {}; this._idT[id] = x > GD.D.ancho / 2 && this.j2 && GD.perfil.dualDividido ? 2 : 1;
    this.presionar();
  }
  alSoltar(x, y, id) {
    if (this._idT && this._idT[id] === 2) { this.toques2--; if (this.toques2 <= 0) { this.toques2 = 0; this.j2 && this.j2.soltar(); } delete this._idT[id]; return; }
    this.toques = Math.max(0, (this.toques || 1) - 1); if (this.toques === 0) this.soltar();
    if (this._idT) delete this._idT[id];
  }
  alTecla(c, abajo, e) {
    if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') { abajo ? this.presionar() : this.soltar(); e.preventDefault(); }
    else if (c === 'Escape' && abajo) this.pausar();
    else if (c === 'KeyZ' && abajo && this.practica) this.ponerCheckpoint();
    else if (c === 'KeyX' && abajo && this.practica) this.quitarCheckpoint();
  }
  presionar() { if (this.muerto || this.terminada) return; this.j.presionar(); if (this.j2 && !GD.perfil.dualDividido) this.j2.presionar(); this.pulsoNuevo = true; }
  soltar() { this.j.soltar(); if (this.j2 && !GD.perfil.dualDividido) this.j2.soltar(); }

  // ---------- bucle ----------
  alActualizar(dt) {
    if (!this.listo || this.pausada) return;
    if (this.muerto) { this.muerteT += dt; if (this.muerteT > 1) this.reiniciar(); this.actualizarCamara(dt); return; }
    if (this.terminada) { this.alFinal(dt); return; }
    // pasos de física de 1/240 s
    const pasos = Math.max(1, Math.ceil(dt * 240 - 0.01)), h = dt / pasos;
    for (let i = 0; i < pasos && !this.muerto && !this.terminada; i++) {
      this.tiempo += h;
      this.pasoJugador(this.j, h);
      if (this.j2) this.pasoJugador(this.j2, h);
      if (GD.TR) GD.TR.paso(this, h);
    }
    this.cols.paso(dt);
    if (GD.TR) GD.TR.cuadro(this, dt);
    this.actualizarCamara(dt);
    this.actualizarHUD();
    if (this.j.x >= this.largo && !this.terminada) this.terminar();
  }
  pasoJugador(j, h) {
    if (j.muerto) return;
    if (this.plataformas) j.dir = this.dirPlat(j);
    j.paso(h);
    this.choques(j);
    if (j.y > 3000 * 30) this.morir(j);
  }
  dirPlat() { return 0; }
  // objetos cerca del jugador
  cerca(j, margen = 60) {
    const s0 = Math.max(0, Math.floor((j.x - margen) / SEC)), s1 = Math.floor((j.x + margen) / SEC), r = [];
    for (let s = s0; s <= s1; s++) { const a = this.secs[s]; if (a) for (const o of a) r.push(o); }
    return r;
  }
  // caja (centro y medias medidas) de un objeto, rotada con él si hace falta
  caja(o) {
    const hb = o.d.hb; let w, h, ox = 0, oy = 0;
    if (hb) { w = hb[1]; h = hb[2]; ox = hb[3]; oy = hb[4]; if (hb[0] === 'C') { return { circ: true, x: o.cx, y: o.cy, r: hb[1] * Math.abs(o.sx) }; } }
    else { const f = o.partes.length ? o.partes[o.partes.length - 1].f : null; w = f ? f.sw : 30; h = f ? f.sh : 30; }
    w *= Math.abs(o.sx); h *= Math.abs(o.sy); ox *= o.sx * (o.fx ? -1 : 1); oy *= o.sy * (o.fy ? -1 : 1);
    const r = ((o.rot + o.drot) % 360 + 360) % 360;
    if (r % 90 === 0) {
      if (r === 90 || r === 270) { [w, h] = [h, w]; [ox, oy] = r === 90 ? [oy, -ox] : [-oy, ox]; }
      else if (r === 180) { ox = -ox; oy = -oy; }
      return { x: o.cx + ox, y: o.cy + oy, w: w / 2, h: h / 2 };
    }
    const a = -r * Math.PI / 180;
    return { x: o.cx + ox * Math.cos(a) - oy * Math.sin(a), y: o.cy + ox * Math.sin(a) + oy * Math.cos(a), w: w / 2, h: h / 2, ang: a };
  }
  // ¿el rectángulo del jugador (centro px,py; media s) toca la caja?
  toca(c, px, py, sx, sy) {
    if (c.circ) { const dx = Math.max(Math.abs(px - c.x) - sx, 0), dy = Math.max(Math.abs(py - c.y) - sy, 0); return dx * dx + dy * dy < c.r * c.r; }
    if (!c.ang) return Math.abs(px - c.x) < sx + c.w && Math.abs(py - c.y) < sy + c.h;
    // caja girada: separación de ejes (2 ejes del objeto + 2 del jugador)
    const ca = Math.cos(c.ang), sa = Math.sin(c.ang), dx = px - c.x, dy = py - c.y;
    const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
    const ex = sx * Math.abs(ca) + sy * Math.abs(sa), ey = sx * Math.abs(sa) + sy * Math.abs(ca);
    if (Math.abs(lx) > c.w + ex || Math.abs(ly) > c.h + ey) return false;
    const bx = c.w * Math.abs(ca) + c.h * Math.abs(sa), by = c.w * Math.abs(sa) + c.h * Math.abs(ca);
    return Math.abs(dx) < sx + bx && Math.abs(dy) < sy + by;
  }
  choques(j) {
    const m = j.modo, hs = j.alto / 2, s = j.mini ? 0.6 : 1;
    // caja chica (la "de adentro") que mata al tocar un bloque
    const hi = 9 / 2 * s * (m === 'onda' ? 0.6 : 1);
    const hp = m === 'onda' ? (j.mini ? 3 : 5) : hs; // la onda tiene una caja más chica para los pinches
    let apoyado = false;
    const lim = this.limites;
    // piso y techo del nivel / del corredor
    const piso = lim ? lim.abajo : 0, techo = lim ? lim.arriba : null;
    if (j.grav > 0 || j.esVuelo()) {
      if (j.y - hs <= piso) { if (m === 'onda' && !lim) {} j.tocarSuelo(piso, false); if (j.grav < 0 && !j.esVuelo()) {} apoyado = true; }
    }
    if (techo !== null && j.y + hs >= techo) { j.tocarSuelo(techo, true); apoyado = true; }
    if (j.grav < 0 && !lim && j.y - hs <= piso) { j.y = piso + hs; if (j.yv < 0) j.yv = 0; }
    const cerca = this.cerca(j);
    const dy = j.y - j.prevY;
    for (const o of cerca) {
      if (!o.activo || o.oculto || o.muerto) continue;
      const ty = o.ty;
      if (ty === TYP.DECO && !o.d.hb) continue;
      if (ty === TYP.SOLIDO || ty === TYP.PENDIENTE) {
        if (o.noTocar) continue;
        const c = this.caja(o); if (c.circ) continue;
        if (!this.toca(c, j.x, j.y, hs, hs)) continue;
        if (ty === TYP.PENDIENTE && this.pendiente(j, o, c)) { apoyado = true; continue; }
        const top = c.y + c.h, bot = c.y - c.h, mod = m === 'nave' ? 6 : 10;
        const abajo = j.grav > 0;
        const puedeTecho = j.esVuelo() || !abajo; // la nave, la bola, el ovni... se apoyan arriba y abajo
        // aterrizar desde arriba (con la gravedad normal) o desde abajo (invertida)
        if ((abajo || j.esVuelo()) && j.yv <= 0.0001 * (abajo ? 1 : 1) && (j.prevY - hs + mod >= top || j.y - hs + mod >= top) && (abajo || j.esVuelo())) {
          if (!this.tocaAdentro(j, c, hi, true)) { j.tocarSuelo(top, false); apoyado = true; continue; }
        }
        if ((!abajo || j.esVuelo()) && j.yv >= -0.0001 && (j.prevY + hs - mod <= bot || j.y + hs - mod <= bot)) {
          if (!this.tocaAdentro(j, c, hi, true)) { j.tocarSuelo(bot, true); apoyado = true; continue; }
        }
        if (this.toca(c, j.x, j.y, hi, hi)) { this.morir(j); return; }
        continue;
      }
      if (ty === TYP.PELIGRO || ty === TYP.PELIGRO_ANIMADO) {
        if (o.noTocar) continue;
        const c = this.caja(o);
        if (this.toca(c, j.x, j.y, hp, hp)) { this.morir(j); return; }
        continue;
      }
      if (o.usado && ty !== TYP.ARO_AMARILLO && ty !== TYP.ARO_ROSA && ty !== TYP.ARO_ROJO && ty !== TYP.ARO_GRAVEDAD && ty !== TYP.ARO_VERDE && ty !== TYP.ARO_CAIDA && ty !== TYP.ARO_DASH && ty !== TYP.ARO_DASH_GRAV && ty !== TYP.ARO_ARANA && ty !== TYP.ARO_TELEPORT && ty !== TYP.ARO_CUSTOM) continue;
      const c = this.caja(o);
      if (!this.toca(c, j.x, j.y, hs, hs)) continue;
      this.tocarEspecial(j, o, c);
      if (this.muerto) return;
    }
    if (!apoyado && j.suelo && !j.esVuelo()) {
      // se cayó del borde: deja de estar en el suelo (lo hace la gravedad en el próximo paso)
    }
    if (!apoyado && j.esVuelo()) j.suelo = false;
    if (apoyado && j.modo === 'onda') j.suelo = true;
  }
  tocaAdentro(j, c, hi) { return this.toca(c, j.x, j.y, hi, hi); }
  // pendientes: el jugador camina sobre la diagonal
  pendiente(j, o, c) {
    const sube = (o.fx ? -1 : 1) * (o.fy ? -1 : 1) > 0; // de abajo-izq a arriba-der
    const x0 = c.x - c.w, x1 = c.x + c.w, y0 = c.y - c.h, y1 = c.y + c.h;
    const t = GD.clamp((j.x - x0) / (x1 - x0), 0, 1);
    const invertido = o.fy;
    let ySup = invertido ? y1 : (sube ? y0 + (y1 - y0) * t : y1 - (y1 - y0) * t);
    const hs = j.alto / 2;
    if (!invertido && j.grav > 0 && j.yv <= 0 && j.y - hs <= ySup + 4 && j.prevY - hs >= ySup - 12) {
      j.tocarSuelo(ySup, false); if (!sube && j.modo === 'cubo') j.rot = j.rot; return true;
    }
    if (invertido) {
      const yInf = sube ? y1 - (y1 - y0) * t : y0 + (y1 - y0) * t;
      if ((j.grav < 0 || j.esVuelo()) && j.yv >= 0 && j.y + hs >= yInf - 4 && j.prevY + hs <= yInf + 12) { j.tocarSuelo(yInf, true); return true; }
    }
    return false;
  }
  tocarEspecial(j, o, c) {
    const ty = o.ty;
    const portal = () => { o.usado = true; this.efectoPortal(o); };
    switch (ty) {
      case TYP.PORTAL_NAVE: case TYP.PORTAL_CUBO: case TYP.PORTAL_BOLA: case TYP.PORTAL_OVNI: case TYP.PORTAL_ONDA: case TYP.PORTAL_ROBOT: case TYP.PORTAL_ARANA: case TYP.PORTAL_COLUMPIO:
        if (j.tocados.has(o)) return; j.tocados.add(o); portal();
        this.cambiarModo(j, GD.O.MODOS[GD.O.MODO[o.id]], o); return;
      case TYP.PORTAL_ARRIBA: if (j.tocados.has(o)) return; j.tocados.add(o); portal(); j.cambiarGravedad(-1); return;
      case TYP.PORTAL_ABAJO: if (j.tocados.has(o)) return; j.tocados.add(o); portal(); j.cambiarGravedad(1); return;
      case TYP.PORTAL_GRAV_TOGGLE: if (j.tocados.has(o)) return; j.tocados.add(o); portal(); j.cambiarGravedad(-j.grav); return;
      case TYP.PORTAL_MINI: if (j.tocados.has(o)) return; j.tocados.add(o); portal(); this.ponerMini(j, true); return;
      case TYP.PORTAL_GRANDE: if (j.tocados.has(o)) return; j.tocados.add(o); portal(); this.ponerMini(j, false); return;
      case TYP.PORTAL_ESPEJO: if (j.tocados.has(o)) return; j.tocados.add(o); portal(); this.espejo = true; return;
      case TYP.PORTAL_NOESPEJO: if (j.tocados.has(o)) return; j.tocados.add(o); portal(); this.espejo = false; return;
      case TYP.PORTAL_DUAL: if (j.tocados.has(o)) return; j.tocados.add(o); portal(); this.activarDual(true, o); return;
      case TYP.PORTAL_SOLO: if (j.tocados.has(o)) return; j.tocados.add(o); portal(); this.activarDual(false, o); return;
      case TYP.TELEPORT: {
        if (j.tocados.has(o)) return; j.tocados.add(o);
        const sal = this.objs.find(p => p.id === 749 && p.raw[GD.TR ? 0 : 0] === undefined && p.x > o.x - 1 && Math.abs(p.x - o.x) < 1e9 && p.n === o.n + 1) ;
        const dyT = o.raw[54] !== undefined ? +o.raw[54] : 100; j.y = o.cy + dyT; return;
      }
      case TYP.MODIFICADOR:
        if (o.id in GD.O.VELOCIDAD) { if (j.tocados.has(o)) return; j.tocados.add(o); j.vel = GD.O.VELOCIDAD[o.id]; o.usado = true; }
        return;
      case TYP.PAD_AMARILLO: case TYP.PAD_ROSA: case TYP.PAD_ROJO: case TYP.PAD_GRAVEDAD: case TYP.PAD_ARANA:
        if (j.tocados.has(o)) return; j.tocados.add(o); o.usado = true;
        if (ty === TYP.PAD_ARANA) { this.teleportArana(j, true); return; }
        if (ty === TYP.PAD_GRAVEDAD) { j.impulso(0.8); j.cambiarGravedad(-j.grav); }
        else j.impulso(ty === TYP.PAD_AMARILLO ? 1 : ty === TYP.PAD_ROSA ? 0.65 : 1.25);
        this.efectoPad(o); return;
      case TYP.ARO_AMARILLO: case TYP.ARO_ROSA: case TYP.ARO_ROJO: case TYP.ARO_GRAVEDAD: case TYP.ARO_VERDE: case TYP.ARO_CAIDA: case TYP.ARO_DASH: case TYP.ARO_DASH_GRAV: case TYP.ARO_ARANA: case TYP.ARO_TELEPORT: case TYP.ARO_CUSTOM:
        if (!j.buffer || (o.usadoPor && o.usadoPor.has(j) && !(o.raw[99] == 1))) return;
        (o.usadoPor = o.usadoPor || new Set()).add(j);
        j.buffer = false; o.usado = true;
        if (ty === TYP.ARO_ARANA) { this.teleportArana(j, true); }
        else if (ty === TYP.ARO_CUSTOM) { if (GD.TR) GD.TR.activarGrupos(this, o, true); }
        else if (ty === TYP.ARO_DASH || ty === TYP.ARO_DASH_GRAV) { if (ty === TYP.ARO_DASH_GRAV) j.cambiarGravedad(-j.grav); this.dash(j, o); }
        else if (ty === TYP.ARO_TELEPORT) { if (GD.TR) GD.TR.teleportAro(this, j, o); }
        else j.aro(o);
        this.efectoAro(o, j);
        if (GD.TR && o.raw[51]) GD.TR.activarGrupos(this, o, false);
        return;
      case TYP.MONEDA_SECRETA: case TYP.MONEDA_USUARIO: case TYP.COLECCIONABLE:
        if (o.tomado) return; o.tomado = true; this.tomarMoneda(o); return;
      case TYP.ROMPIBLE: return;
    }
    if (GD.TR && GD.TR.def[o.id] && o.raw[11] == 1) GD.TR.tocado(this, o, j);
  }
  dash(j, o) { j.dash = { ang: (o.rot || 0), t: 0 }; j.yv = 0; }
  cambiarModo(j, modo, o) {
    const antes = j.modo;
    j.modo = modo;
    if (modo !== antes) { if (modo === 'nave' || modo === 'ovni' || modo === 'columpio') j.yv /= 2; if (modo === 'onda') j.yv = 0; j.suelo = false; j.rot = 0; }
    if (j.esVuelo()) this.ponerLimites(j, o ? o.cy : j.y);
    else if (!this.j2) this.limites = null;
  }
  ponerLimites(j, y, inst) {
    const alto = GD.Jugador.altoCorredor(j.modo);
    if (!alto) { this.limites = null; return; }
    let abajo = Math.floor(y / 30) * 30 - alto / 2;
    abajo = Math.max(0, abajo);
    if (abajo % 30) abajo = Math.round(abajo / 30) * 30;
    this.limites = { abajo, arriba: abajo + alto };
    this.camYObj = abajo + alto / 2 - 160 - (alto === 240 ? 0 : 0);
  }
  ponerMini(j, mini) { if (j.mini === mini) return; j.mini = mini; }
  activarDual(si, o) {
    if (si && !this.j2) {
      const j2 = this.j2 = new GD.Jugador(this, true); const j = this.j;
      Object.assign(j2, { x: j.x, y: j.y, modo: j.modo, vel: j.vel, mini: j.mini, grav: -j.grav, yv: 0, suelo: false });
      this.vis2 = new GD.Nodo(); this.actualizarIcono(j2, this.vis2);
      if (!j.esVuelo()) this.ponerLimites(j, o ? o.cy : j.y);
    } else if (!si && this.j2) { this.j2 = null; this.vis2 = null; if (!this.j.esVuelo()) this.limites = null; }
  }
  teleportArana(j, pad) {
    // la araña "cae" de golpe hasta la superficie de enfrente y se da vuelta
    const dir = -j.grav, hs = j.alto / 2; let mejor = dir > 0 ? (this.limites ? this.limites.arriba : 1e6) : (this.limites ? this.limites.abajo : 0);
    const cerca = this.cerca(j, 30);
    for (const o of cerca) {
      if (o.ty !== TYP.SOLIDO || !o.activo || o.noTocar) continue;
      const c = this.caja(o); if (c.circ || Math.abs(c.x - j.x) > c.w + hs * 0.8) continue;
      if (dir > 0) { const b = c.y - c.h; if (b >= j.y && b < mejor) mejor = b; }
      else { const t = c.y + c.h; if (t <= j.y && t > mejor) mejor = t; }
    }
    if (dir > 0 && mejor > 1e5) { j.cambiarGravedad(-j.grav, false); j.yv = 0; j.suelo = false; return; }
    const y0 = j.y; j.y = dir > 0 ? mejor - hs : mejor + hs; j.cambiarGravedad(-j.grav, false); j.yv = 0; j.suelo = true; j.buffer = false;
    this.efectoAranaRayo(j.x, y0, j.y);
  }

  // ---------- muerte, práctica, final ----------
  morir(j) {
    if (this.muerto || this.opc.noclip) return;
    this.muerto = true; j.muerto = true; this.muerteT = 0;
    GD.S.pararMusica(); GD.S.efecto('explode_11.ogg', 0.7);
    this.efectoMuerte(j);
    const pct = Math.min(100, Math.floor(j.x / this.largo * 100));
    if (this.opc.alMorir) this.opc.alMorir(pct, this.practica);
    GD.perfil.sumar('muertes', 1);
  }
  ponerCheckpoint() {
    if (this.muerto || !this.practica) return;
    const j = this.j;
    const cp = { x: j.x, y: j.y, yv: j.yv, modo: j.modo, mini: j.mini, grav: j.grav, vel: j.vel, rot: j.rot, tiempo: this.tiempo + this.tiempoParaX(0), lim: this.limites && Object.assign({}, this.limites),
      camY: this.camY, espejo: this.espejo, dual: !!this.j2, j2: this.j2 && { y: this.j2.y, yv: this.j2.yv, grav: this.j2.grav, modo: this.j2.modo },
      tocados: new Set(j.tocados), trig: GD.TR ? GD.TR.foto(this) : null, colores: JSON.parse(JSON.stringify(this.cols.act)) };
    cp.tiempo = this.tiempoParaX(j.x);
    this.checkpoints.push(cp);
    const s = new GD.Sprite('checkpoint_01_001.png'); s.pos(j.x, j.y); s.mundo = true; cp.sprite = s;
  }
  quitarCheckpoint() { this.checkpoints.pop(); }
  cargarCheckpoint(cp) {
    const j = this.j; Object.assign(j, { x: cp.x, y: cp.y, yv: cp.yv, modo: cp.modo, mini: cp.mini, grav: cp.grav, vel: cp.vel, rot: cp.rot });
    j.tocados = new Set(cp.tocados); this.limites = cp.lim; this.camY = this.camYObj = cp.camY; this.espejo = cp.espejo;
    for (const id in cp.colores) this.cols.act[id] = Object.assign({}, cp.colores[id]);
    if (cp.dual) { this.activarDual(true); Object.assign(this.j2, cp.j2); }
    if (GD.TR && cp.trig) GD.TR.restaurar(this, cp.trig);
    this.sigTriggerX = cp.x;
  }
  terminar() {
    this.terminada = true; this.finT = 0;
    GD.S.efecto('endStart_02.ogg');
    const pctMax = 100;
    if (this.opc.alGanar) this.opc.alGanar(this.practica, this.monedas, this.intentos, this.tiempo);
  }
  alFinal(dt) {
    this.finT += dt; const j = this.j;
    // el jugador vuela hacia el portal del final
    j.x += j.ups * dt * Math.max(0, 1 - this.finT * 0.8); j.rot += 300 * dt;
    if (!this.finSonido && this.finT > 0.4) { this.finSonido = true; this.efectoFinal(); }
    if (this.finT > 1.4 && !this.pantallaFin) { this.pantallaFin = true; GD.S.pararMusica(); if (this.opc.alFinPantalla) this.opc.alFinPantalla(this); else GD.Menus && GD.Menus.finNivel(this); }
    this.actualizarCamara(dt);
  }
  tomarMoneda(o) {
    this.monedas[o.i] = true; GD.S.efecto('gold02.ogg'); this.coleccion.push(o);
    o.op = 0; o.muerto = true;
    const s = new GD.Sprite(o.d.t); s.pos(o.cx, o.cy); s.mundo = true; this.efectos.push(s);
    s.correr(GD.A.sec(GD.A.junto(GD.A.moverPor(0.4, 0, 60).e(GD.E.out(2)), GD.A.op(0.4, 0)), GD.A.quitar()));
  }
  pausar() {
    if (this.pausada || this.muerto) return;
    this.pausada = true; GD.S.pausar();
    if (this.opc.alPausar) this.opc.alPausar(this); else GD.Menus && GD.Menus.pausa(this);
  }
  seguir() { this.pausada = false; GD.S.seguir(); }

  // ---------- cámara ----------
  actualizarCamara(dt) {
    const j = this.j, D = GD.D;
    const objX = j.x - D.ancho * 0.3 + (this.terminada ? 0 : 0);
    if (!this.terminada || this.finT < 0.3) this.camX = objX;
    if (this.limites && j.esVuelo() || this.limites && this.j2) this.camYObj = (this.limites.abajo + this.limites.arriba) / 2 - D.alto / 2;
    else {
      // el cubo y el robot: la cámara sigue al jugador cuando se acerca a los bordes
      const sy = j.y - this.camYObj;
      if (sy > D.alto - 110) this.camYObj = j.y - (D.alto - 110);
      if (sy < 130) this.camYObj = Math.max(-90, j.y - 130);
      if (this.camYObj < -90) this.camYObj = -90;
    }
    this.camY += (this.camYObj - this.camY) * Math.min(1, dt * 6);
    if (GD.TR && this.camOff) { this.camX += this.camOff.x; this.camY += this.camOff.y; }
  }
  actualizarHUD() {
    const k = GD.clamp(this.j.x / this.largo, 0, 1);
    this.barraLlena.recorte = k; this.pct.texto(Math.floor(k * 100) + '%');
  }

  // ---------- dibujo ----------
  dibujar(pm) {
    if (!this.listo) return;
    const D = GD.D, R = GD.R, zoom = this.zoom || 1;
    this.dibujarFondo();
    // vista del mundo: unidades del nivel → pantalla (con espejo y zoom de cámara)
    const k = this.espejoAnim();
    const vx = this.camX, vy = this.camY;
    let w = new Float32Array([zoom, 0, 0, zoom, -vx * zoom, -vy * zoom]);
    if (k) { w[0] = zoom * (1 - 2 * k); w[4] = (-vx * zoom) * (1 - 2 * k) + D.ancho * k; }
    if (this.camRot) { const a = -this.camRot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), cx = D.ancho / 2, cy = D.alto / 2; const m = [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy]; w = new Float32Array([m[0] * w[0] + m[2] * w[1], m[1] * w[0] + m[3] * w[1], m[0] * w[2] + m[2] * w[3], m[1] * w[2] + m[3] * w[3], m[0] * w[4] + m[2] * w[5] + m[4], m[1] * w[4] + m[3] * w[5] + m[5]]); }
    this.vista = w;
    const x0 = vx - 100, x1 = vx + D.ancho / zoom + 100;
    const vis = [];
    for (let s = Math.max(0, Math.floor(x0 / SEC)), s1 = Math.floor(x1 / SEC); s <= s1; s++) { const a = this.secs[s]; if (a) for (const o of a) vis.push(o); }
    vis.sort((a, b) => a.rango - b.rango);
    const mo = new Float32Array(6), wo = new Float32Array(6);
    let jugadorDibujado = false;
    const editor = !!this.enEditor;
    for (const o of vis) {
      if (!jugadorDibujado && (GD.O.ORDEN_CAPA[o.capa] ?? 5) >= 5) { this.dibujarJugadores(w); jugadorDibujado = true; }
      if (!o.vis && !editor || o.oculto) continue;
      if (GD.O.esTrigger(o.id) && !editor) continue;
      if (o.op <= 0.001 && !editor) continue;
      GD.O.matriz(o, mo);
      wo[0] = w[0] * mo[0] + w[2] * mo[1]; wo[1] = w[1] * mo[0] + w[3] * mo[1]; wo[2] = w[0] * mo[2] + w[2] * mo[3]; wo[3] = w[1] * mo[2] + w[3] * mo[3];
      wo[4] = w[0] * mo[4] + w[2] * mo[5] + w[4]; wo[5] = w[1] * mo[4] + w[3] * mo[5] + w[5];
      const fade = this.fundidoBorde ? this.fundidoBorde(o) : 1;
      for (const p of o.partes) {
        const [r, g, b, a, add] = GD.O.colorParte(o, p, this.cols);
        const al = a * o.op * p.op * fade * (p.ct === 'glow' ? 1 : 1) * (editor && o.selec ? 1 : 1);
        if (al <= 0.003) continue;
        const col = o.selec ? GD.col(0, 255, 0, 255 * al) : GD.col(r, g, b, 255 * al);
        GD.O.pintarParte(wo, p, col, add);
      }
    }
    if (!jugadorDibujado) this.dibujarJugadores(w);
    this.dibujarEfectos(w);
    this.dibujarPiso();
    // HUD y lo que no es del mundo
    super.dibujar(pm, 255, 255, 255, 255);
  }
  espejoAnim() { const obj = this.espejo ? 1 : 0; this.espejoK += (obj - this.espejoK) * Math.min(1, (GD.D.dt || 0.016) * 4); return this.espejoK < 0.001 ? 0 : this.espejoK; }
  dibujarJugadores(w) {
    const dib = (j, v) => {
      if (!v || !j.vis || (j.muerto && this.muerto)) return;
      this.actualizarIcono(j, v);
      v.x = j.x; v.y = j.y; v.rot = j.rot; v.sy = Math.abs(v.sy) * (j.grav < 0 ? -1 : 1);
      if (j.modo === 'robot' || j.modo === 'arana') this.animarCuerpo(j, v);
      v.actualizar(GD.D.dt || 0);
      v.dibujar(w, 255, 255, 255, 255);
    };
    for (const c of this.checkpoints) if (c.sprite) c.sprite.dibujar(w, 255, 255, 255, 255);
    dib(this.j, this.vis1); if (this.j2) dib(this.j2, this.vis2);
    if (this.lblIntento) this.lblIntento.dibujar(w, 255, 255, 255, 255);
  }
  animarCuerpo(j, v) {
    const a = v.cuerpo && v.cuerpo.partes; if (!a) return;
    if (j.modo === 'robot') a.poner(j.suelo ? 'run' : j.subiendo ? 'jump_loop' : 'fall_loop');
    else a.poner(j.suelo ? 'run' : 'jump_loop');
    a.velAnim = j.vel >= 2 ? 1.3 : 1;
  }
  dibujarFondo() {
    const D = GD.D, tx = this.txFondo; if (!tx) return;
    const c = this.cols.valor(1000), col = GD.col(c.r, c.g, c.b, 255);
    // el fondo es una textura de 1024 px (512 puntos) que se repite y se mueve lento
    const tam = tx.h / 2 * (D.alto / 320) * 1.0, k = tam / (tx.h / 2);
    const ox = -((this.camX * 0.1) % tam + tam) % tam, oy = -Math.max(0, this.camY + 90) * 0.1 - 0;
    const u0 = 0, u1 = (D.ancho + tam) / tam;
    const xs = new Float32Array([ox, D.alto + oy + tam - D.alto, ox + D.ancho + tam, D.alto + oy + tam - D.alto, ox, oy, ox + D.ancho + tam, oy]);
    const tw = tx.w / 2 * k;
    const uv = new Float32Array([0, 0, (D.ancho + tam) / tw, 0, 0, 1, (D.ancho + tam) / tw, 1]);
    xs[1] = xs[3] = oy + tam; xs[5] = xs[7] = oy;
    GD.R.quad(tx, false, 0, xs, uv, col);
  }
  dibujarPiso() {
    const D = GD.D, tx = this.txPiso; if (!tx) return;
    const zoom = this.zoom || 1;
    const lado = tx.h / 2; // 128 puntos
    const dib = (yPant, arriba, txx, canal) => {
      if (!txx) return;
      const c = this.cols.valor(canal), col = GD.col(c.r, c.g, c.b, 255);
      const ox = -(((this.camX * zoom) % lado) + lado) % lado - lado;
      const y0 = arriba ? yPant : yPant - lado, y1 = arriba ? yPant + lado : yPant;
      const xs = new Float32Array([ox, y1, ox + D.ancho + lado * 2, y1, ox, y0, ox + D.ancho + lado * 2, y0]);
      const n = (D.ancho + lado * 2) / lado;
      const uv = arriba ? new Float32Array([0, 1, n, 1, 0, 0, n, 0]) : new Float32Array([0, 0, n, 0, 0, 1, n, 1]);
      GD.R.quad(txx, false, 0, xs, uv, col);
    };
    const lim = this.limites, abajo = lim ? lim.abajo : 0;
    const yAb = (abajo - this.camY) * zoom;
    if (yAb > -130) { dib(yAb, false, this.txPiso, 1001); dib(yAb, false, this.txPiso2, 1009); this.linea(yAb); }
    if (lim) { const yAr = (lim.arriba - this.camY) * zoom; if (yAr < D.alto + 130) { dib(yAr, true, this.txPiso, 1001); dib(yAr, true, this.txPiso2, 1009); this.linea(yAr); } }
  }
  linea(y) {
    const f = GD.T.m(this.lineaPiso == 2 ? 'floorLine_02_001.png' : 'floorLine_01_001.png'); if (!f) return;
    const s = this._linea || (this._linea = new GD.Sprite(f));
    const c = this.cols.valor(1002); s.color(c.r, c.g, c.b); s.add = true; s.pos(GD.D.ancho / 2, y); s.sx = GD.D.ancho / f.sw * 1.1;
    s.dibujar(new Float32Array([1, 0, 0, 1, 0, 0]), 255, 255, 255, 255);
  }
  dibujarEfectos(w) {
    this.efectos = this.efectos || [];
    for (const e of this.efectos.slice()) { e.actualizar(GD.D.dt || 0); if (!e.padre && e._quitado) continue; e.dibujar(w, 255, 255, 255, 255); }
    this.efectos = this.efectos.filter(e => !e._fin);
  }
  // ---------- efectos ----------
  efecto(n) { n.mundo = true; n.sacar = () => { n._fin = true; }; (this.efectos = this.efectos || []).push(n); return n; }
  efectoMuerte(j) {
    const P = GD.perfil;
    const pe = this.efecto(new GD.Particulas('explodeEffect')); pe.x = j.x; pe.y = j.y; pe.tinte = P.c1rgb();
    const o = this.efecto(new GD.Onda(0.5, 10, 90, P.c1rgb(), true)); o.x = j.x; o.y = j.y;
  }
  efectoPortal(o) { const w = this.efecto(new GD.Onda(0.4, 10, 50, [255, 255, 255])); w.x = o.cx; w.y = o.cy; }
  efectoPad(o) { const w = this.efecto(new GD.Onda(0.3, 5, 30, [255, 255, 0])); w.x = o.cx; w.y = o.cy; }
  efectoAro(o) { const w = this.efecto(new GD.Onda(0.3, 30, 5, [255, 255, 255])); w.x = o.cx; w.y = o.cy; }
  efectoAranaRayo(x, y0, y1) { const r = this.efecto(new GD.Rect(6, Math.abs(y1 - y0), 255, 255, 255, 200)); r.x = x - 3; r.y = Math.min(y0, y1); r.add = true; r.correr(GD.A.sec(GD.A.op(0.25, 0), GD.A.fn(n => n._fin = true))); }
  efectoFinal() { GD.S.efecto('achievement_01.ogg', 0.5); for (let i = 0; i < 3; i++) { const w = this.efecto(new GD.Onda(0.6 + i * 0.2, 10, 200, [255, 255, 255], i === 0)); w.x = this.j.x; w.y = this.j.y; } }
  alSaltar() { this.saltos = (this.saltos || 0) + 1; }
  alAterrizar() { }
}
const kStartPosActive = -1;
GD.Partida = Partida;
