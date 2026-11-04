// La partida (PlayLayer / GJBaseGameLayer): carga del nivel, cámara, fondo y piso, dibujo por
// capas, física con choques, portales, pads, aros, monedas, muerte, práctica y final del nivel.
'use strict';
const TYP = GD.O.TIPO;
const SEC = 100; // ancho de sección (como el juego) para buscar objetos cerca

const porRango = (a, b) => a.rango - b.rango;
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
    this.plataformas = N.ajuste(nv, 'kA22', 0) == 1; this.alturaDinamica = N.ajuste(nv, 'kA37', 0) == 1;
    this.offsetCancion = N.ajuste(nv, 'kA13', 0);
    this.fundidoIn = N.ajuste(nv, 'kA15', 0) == 1; this.fundidoOut = N.ajuste(nv, 'kA16', 0) == 1;
  }
  armarObjetos() {
    const objs = this.objs = [];
    for (const raw of this.nv.objs) {
      const o = new GD.O.Obj(raw); o.i = objs.length; objs.push(o);
    }
    // techo de muerte (GJBaseGameLayer::updateMaxGameplayY): 2790 en el juego, que en nuestras
    // coordenadas (piso en 0, no en 90) es 2700; en plataformas o con "altura dinámica" (kA37) sube
    // con el objeto más alto, con 1200 de mínimo y 390 de margen
    let maxY = 1200 - 90;
    if (this.plataformas || this.alturaDinamica) for (const o of objs) if (o.y > maxY) maxY = o.y;
    this.techoMuerte = this.plataformas || this.alturaDinamica ? maxY + 390 : 2700;
    // orden de dibujo fijo: capa, orden Z y orden en el nivel
    const capa = o => GD.O.ORDEN_CAPA[o.capa] ?? 6;
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
    this.secs = []; this._din = null;
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
    // fuente de los textos del nivel (kA18: 0 = bigFont, n = gjFontNN)
    const fu = GD.N.ajuste(this.nv, 'kA18', 0);
    GD.O.fuente = fu > 0 ? 'gjFont' + String(fu).padStart(2, '0') : 'bigFont';
    if (fu > 0 && !GD.fuentes[GD.O.fuente]) await GD.cargarFuente(GD.O.fuente).catch(() => { });
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
    const PF = GD.perfil; this.barra.vis = this.barra.vis && PF.opcion('progress-bar', true); this.pct.vis = PF.opcion('show-percent', true);
    if (!this.barra.vis) this.pct.pos(D.ancho / 2, D.alto - 8), this.pct.anc(0.5, 0.5);
    // botón de pausa
    this.btnPausa = new GD.Sprite('GJ_pauseBtn_001.png'); this.btnPausa.escala = 0.6; this.btnPausa.op = 75; this.btnPausa.pos(D.ancho - 15, D.alto - 15); h.agregar(this.btnPausa);
    if (this.practica) this.armarPractica();
    if (this.plataformas) {
      const W = D.ancho, mk = (f, x, y, fx) => { const sp = new GD.Sprite(f); sp.pos(x, y); sp.op = 120; sp.fx = !!fx; h.agregar(sp); return sp; };
      // izquierda y derecha: el mismo botón de flecha, el de la derecha espejado
      if (GD.T.m('PBtn_Move_001.png')) { mk('PBtn_Move_001.png', W * 0.1, 45); mk('PBtn_Move_001.png', W * 0.3, 45, true); }
      if (GD.T.m('PBtn_Jump_001.png')) mk('PBtn_Jump_001.png', W * 0.85, 45);
      this.barra.vis = false; this.pct.vis = false;
    }
  }
  armarPractica() {
    const D = GD.D;
    this.btnCheck = new GD.Sprite('GJ_checkpointBtn_001.png'); this.btnCheck.pos(D.ancho / 2 - 30, 30); this.btnCheck.escala = 0.8; this.btnCheck.op = 150; this.hud.agregar(this.btnCheck);
    this.btnBorrar = new GD.Sprite('GJ_removeCheckBtn_001.png'); this.btnBorrar.pos(D.ancho / 2 + 30, 30); this.btnBorrar.escala = 0.8; this.btnBorrar.op = 150; this.hud.agregar(this.btnBorrar);
  }

  // ---------- reinicio ----------
  reiniciar(primera) {
    const cp = this.practica && this.checkpoints.length ? this.checkpoints[this.checkpoints.length - 1] : (!primera && this.cpPlat) || null;
    this.cols = new GD.O.Colores(this.nv, GD.perfil.c1rgb(), GD.perfil.c2rgb());
    for (const o of this.objs) { o.dx = 0; o.dy = 0; o.drot = 0; o.op = 1; o.activo = true; o.usado = false; o.pulsos = null; o.esx = 1; o.esy = 1; o.oculto = false; o.tomado = false; o.muerto = false; o.usadoPor = null; o.anim = 0; o.emisor = null; o.animado = false; o.aPrev = null; o.opArea = 1; o.tinteArea = null; if (o.sec === undefined) this.ponerEnSeccion(o); }
    this.particulas = []; this._areaTocados = null;
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
    this.limites = null; this.espejo = espejo; this.espejoK = 0; this.efEntrada = 0;
    this.objsTocados = new Set();
    if (this.opc.desdeX && !cp) { j.x = this.opc.desdeX; j.y = this.opc.desdeY || 15; }
    if (cp) this.cargarCheckpoint(cp);
    else if (j.esVuelo()) this.ponerLimites(j, j.y, true);
    // pasar los triggers anteriores a la posición inicial (como el juego al empezar en un punto)
    if (GD.TR) GD.TR.saltarHasta(this, j.x);
    if (dual && !cp) this.activarDual(true);
    this.armarJugadorVisual();
    this.empezarMusica(cp ? cp.tiempoMusica : this.tiempoParaX(j.x));
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
    // en práctica suena la canción de práctica, sin cortarse entre intentos (como el juego)
    if (this.practica && !this.enEditor) { GD.S.musica('datos/mus/StayInsideMe.ogg', 0, true); return; }
    const ruta = info.musica; if (!ruta) return;
    GD.S.musica(ruta, t + this.offsetCancion, false, this.fundidoIn && t < 0.1 ? 2 : 0);
  }
  mostrarIntento() {
    if (this.lblIntento) this.lblIntento.sacar();
    if (GD.perfil.opcion('hide-attempts')) { this.lblIntento = null; return; }
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
      // en plataformas la nave es la mochila a chorro (jetpack), como la 2.2
      const veh = m === 'ovni' ? 'ovni' : (m === 'jetpack' || this.plataformas) ? 'jetpack' : 'nave';
      v.cuerpo = v.agregar(ic(veh, veh === 'nave' ? P.nave : veh === 'ovni' ? P.ovni : P.jetpack), m === 'ovni' ? 0 : 2);
      v.cubo.pos(0, m === 'ovni' ? 5 : 5); v.cuerpo.pos(0, m === 'ovni' ? -5 : -5);
      if (m === 'ovni') { v.cubo.z = 0; v.cuerpo.z = 1; v._sucio = true; }
    } else v.cuerpo = v.agregar(ic(m === 'bola' ? 'bola' : m === 'onda' ? 'onda' : m === 'robot' ? 'robot' : m === 'arana' ? 'arana' : 'columpio', P[m === 'bola' ? 'bola' : m === 'onda' ? 'onda' : m === 'robot' ? 'robot' : m === 'arana' ? 'arana' : 'columpio']));
    for (const h of v.hijos) { h.ax = h.ay = 0.5; }
    v.escala = j.mini ? 0.6 : 1;
    if (m === 'onda') v.escala *= 0.6;
  }

  // ---------- entrada ----------
  // cada dedo tiene un papel: salto (jugador 1 o 2) o, en plataformas, izquierda/derecha
  alTocar(x, y, id) {
    if (!this.listo) return;
    if (this.btnPausa.toca(x, y) && !this.terminada) { this.pausar(); return; }
    if (this.practica && this.btnCheck && this.btnCheck.toca(x, y)) { this.ponerCheckpoint(); return; }
    if (this.practica && this.btnBorrar && this.btnBorrar.toca(x, y)) { this.quitarCheckpoint(); return; }
    const W = GD.D.ancho; let rol = 'salto';
    if (this.plataformas && x < W * 0.45) rol = x < W * 0.2 ? 'izq' : 'der';
    else if (this.j2 && GD.perfil.dualDividido && x > W / 2) rol = 'salto2';
    (this.roles = this.roles || {})[id] = rol;
    this.aplicarRoles(rol, true);
  }
  alMover(x, y, id) {
    if (!this.plataformas || !this.roles || !this.roles[id] || this.roles[id].startsWith('salto')) return;
    const W = GD.D.ancho, nuevo = x < W * 0.2 ? 'izq' : x < W * 0.45 ? 'der' : this.roles[id];
    if (nuevo !== this.roles[id]) { this.roles[id] = nuevo; this.aplicarRoles(); }
  }
  alSoltar(x, y, id) {
    if (!this.roles || !this.roles[id]) return;
    const rol = this.roles[id]; delete this.roles[id];
    this.aplicarRoles(rol, false);
  }
  cuenta(rol) { let n = 0; for (const k in this.roles || {}) if (this.roles[k] === rol) n++; return n + ((this.teclas || {})[rol] ? 1 : 0); }
  aplicarRoles(rol, abajo) {
    if (rol === 'salto') { if (abajo) this.presionar(); else if (!this.cuenta('salto')) this.soltar(); }
    else if (rol === 'salto2') { if (abajo) this.j2 && this.j2.presionar(); else if (!this.cuenta('salto2')) this.j2 && this.j2.soltar(); }
    const izq = this.cuenta('izq') > 0, der = this.cuenta('der') > 0;
    if (GD.TR && this.tr) { if (izq !== !!this.izq) GD.TR.evento(this, izq ? 71 : 72); if (der !== !!this.der) GD.TR.evento(this, der ? 73 : 74); }
    this.izq = izq; this.der = der;
  }
  alTecla(c, abajo, e) {
    const t = this.teclas = this.teclas || {};
    const rol = { Space: 'salto', ArrowUp: 'salto', KeyW: 'salto', ArrowLeft: 'izq', KeyA: 'izq', ArrowRight: 'der', KeyD: 'der' }[c];
    if (rol) { if (t[rol] === abajo) return; t[rol] = abajo; this.aplicarRoles(rol, abajo); e && e.preventDefault && e.preventDefault(); return; }
    if (c === 'Escape' && abajo) this.pausar();
    else if (c === 'KeyZ' && abajo && this.practica) this.ponerCheckpoint();
    else if (c === 'KeyX' && abajo && this.practica) this.quitarCheckpoint();
  }
  presionar() {
    if (!this.j || this.muerto || this.terminada) return;
    const op = (this.tr && this.tr.opc) || {};
    if (GD.TR && this.tr) { GD.TR.alToque(this, true); GD.TR.evento(this, 69); if (this.j.modo === 'nave') GD.TR.evento(this, 16); if (this.j.modo === 'onda') GD.TR.evento(this, 21); }
    if (!op.sinControlJ1) this.j.presionar(); if (this.j2 && !GD.perfil.dualDividido && !op.sinControlJ2) this.j2.presionar(); this.pulsoNuevo = true;
  }
  soltar() {
    if (!this.j) return;
    if (GD.TR && this.tr) { GD.TR.alToque(this, false); GD.TR.evento(this, 70); if (this.j.modo === 'nave') GD.TR.evento(this, 17); if (this.j.modo === 'onda') GD.TR.evento(this, 22); }
    this.j.soltar(); if (this.j2 && !GD.perfil.dualDividido) this.j2.soltar();
  }
  dirPlat() { return (this.der ? 1 : 0) - (this.izq ? 1 : 0); }

  // ---------- bucle ----------
  alActualizar(dt) {
    if (!this.listo || this.pausada) return;
    if (this.muerto) { this.muerteT += dt; const rt = this.tr && this.tr.opc && this.tr.opc.respawn !== undefined ? this.tr.opc.respawn : (this.practica && GD.perfil.opcion('fast-reset') ? 0.5 : 1); if (this.muerteT > rt) this.reiniciar(); this.actualizarCamara(dt); return; }
    if (this.terminada) { this.alFinal(dt); return; }
    // pasos de física de 1/240 s
    const pasos = Math.max(1, Math.ceil(dt * 240 - 0.01)), h = dt / pasos;
    for (let i = 0; i < pasos && !this.muerto && !this.terminada; i++) {
      this.tiempo += h;
      this.pasoJugador(this.j, h);
      if (this.j2) this.pasoJugador(this.j2, h);
      if (GD.TR) GD.TR.paso(this, h);
    }
    this.cols.paso(dt); GD.O.reloj = this.tiempo; GD.O.latido = GD.S.medir();
    // práctica: checkpoints solos cada tanto, cuando el jugador está quieto en algo (como la 2.2)
    if (this.practica && GD.perfil.opcion('auto-checkpoints', true) && !this.muerto && (this.j.suelo || this.j.esVuelo()) && this.tiempo - (this.ultAuto || 0) > 2.5) { this.ultAuto = this.tiempo; const u = this.checkpoints[this.checkpoints.length - 1]; if (!u || this.j.x - u.j.x > 150) this.ponerCheckpoint(); }
    if (GD.TR) GD.TR.cuadro(this, dt);
    this.actualizarCamara(dt);
    this.actualizarHUD();
    if (!this.plataformas && this.j.x >= this.largo && !this.terminada) this.terminar();
  }
  pasoJugador(j, h) {
    if (j.muerto) return;
    if (this.plataformas) { j.plataforma = true; j.dir = this.dirPlat(j); }
    j.paso(h);
    this.choques(j);
    // pasar el techo mata, pero recién si sigue arriba en el paso siguiente (como checkCollisions)
    const arriba = !j.muerto && j.y > this.techoMuerte + (j.mini ? 6 : 0);
    if (arriba && j.sobreTecho) { this.causa = ['techo', 0, j.x, j.y]; this.morir(j); }
    j.sobreTecho = arriba;
  }
  // objetos cerca del jugador
  cerca(j, margen = 60, r = []) { // r: arreglo propio de quien llama (se reusa: sin basura)
    r.length = 0;
    const s0 = Math.max(0, Math.floor((j.x - margen) / SEC)), s1 = Math.floor((j.x + margen) / SEC);
    for (let s = s0; s <= s1; s++) { const a = this.secs[s]; if (a) for (const o of a) r.push(o); }
    return r;
  }
  // caja (centro y medias medidas) de un objeto, rotada con él si hace falta
  caja(o) {
    const hb = o.d.hb; let w, h, ox = 0, oy = 0;
    const C = o._cj || (o._cj = { circ: false, x: 0, y: 0, w: 0, h: 0, r: 0, ang: 0 }); // reusada: sin basura por paso
    if (hb) { w = hb[1]; h = hb[2]; ox = hb[3]; oy = hb[4]; if (hb[0] === 'C') { C.circ = true; C.x = o.cx; C.y = o.cy; C.r = hb[1] * Math.abs(o.sx); C.w = C.h = C.ang = 0; return C; } }
    else { const f = o.partes.length ? o.partes[o.partes.length - 1].f : null; w = f ? f.sw : 30; h = f ? f.sh : 30; }
    w *= Math.abs(o.sx); h *= Math.abs(o.sy); ox *= o.sx * (o.fx ? -1 : 1); oy *= o.sy * (o.fy ? -1 : 1);
    const r = ((o.rot + o.drot) % 360 + 360) % 360;
    if (r % 90 === 0) {
      if (r === 90 || r === 270) { [w, h] = [h, w]; [ox, oy] = r === 90 ? [oy, -ox] : [-oy, ox]; }
      else if (r === 180) { ox = -ox; oy = -oy; }
      C.circ = false; C.x = o.cx + ox; C.y = o.cy + oy; C.w = w / 2; C.h = h / 2; C.ang = 0; return C;
    }
    const a = -r * Math.PI / 180;
    C.circ = false; C.x = o.cx + ox * Math.cos(a) - oy * Math.sin(a); C.y = o.cy + ox * Math.sin(a) + oy * Math.cos(a); C.w = w / 2; C.h = h / 2; C.ang = a; return C;
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
    const cerca = this.cerca(j, 60, j._cerca || (j._cerca = []));
    const dy = j.y - j.prevY;
    for (const o of cerca) {
      if (!o.activo || o.oculto || o.muerto) continue;
      const ty = o.ty;
      if (o.raw[11] == 1 && GD.TR && GD.TR.def[o.id]) { if (Math.abs(o.cx - j.x) < 15 + hs && Math.abs(o.cy - j.y) < 15 + hs) GD.TR.tocado(this, o, j); continue; }
      // los triggers y los bloques que miran al jugador por su cuenta (3640/3643) no chocan
      if ((GD.TR && GD.TR.def[o.id]) || o.id === 3643 || o.id === 3640) continue;
      if (ty === TYP.DECO && !o.d.hb) continue;
      if (ty === TYP.SOLIDO || ty === TYP.PENDIENTE || ty === TYP.ROMPIBLE) {
        if (o.noTocar) continue;
        const c = this.caja(o); if (c.circ) continue;
        if (!this.toca(c, j.x, j.y, hs, hs)) continue;
        if (ty === TYP.PENDIENTE) { const r = this.pendiente(j, o, c, hs, hi); if (r === 'muerte') { this.causa = ['pendiente', o.id, o.x, o.y]; this.morir(j); return; } if (r === 'apoyo') apoyado = true; continue; }
        const top = c.y + c.h, bot = c.y - c.h, mod = m === 'nave' ? 6 : 10;
        const abajo = j.grav > 0;
        const puedeTecho = j.esVuelo() || !abajo; // la nave, la bola, el ovni... se apoyan arriba y abajo
        // aterrizar desde arriba (con la gravedad normal) o desde abajo (invertida)
        if ((abajo || j.esVuelo()) && j.yv <= 0.0001 * (abajo ? 1 : 1) && (j.prevY - hs + mod >= top || j.y - hs + mod >= top) && (abajo || j.esVuelo())) {
          if (!this.tocaAdentro(j, c, hi, true)) { j.tocarSuelo(top, false); j.sobre = o; apoyado = true; continue; }
        }
        if ((!abajo || j.esVuelo()) && j.yv >= -0.0001 && (j.prevY + hs - mod <= bot || j.y + hs - mod <= bot)) {
          if (!this.tocaAdentro(j, c, hi, true)) { j.tocarSuelo(bot, true); j.sobre = o; apoyado = true; continue; }
        }
        if (this.toca(c, j.x, j.y, hi, hi)) {
          // los bloques rompibles se rompen en vez de matar (se apoya arriba como en uno común)
          if (ty === TYP.ROMPIBLE) { this.romper(o); continue; }
          this.causa = ['bloque', o.id, o.x, o.y]; this.morir(j); return;
        }
        continue;
      }
      if (ty === TYP.PELIGRO || ty === TYP.PELIGRO_ANIMADO) {
        if (o.noTocar) continue;
        const c = this.caja(o);
        if (this.toca(c, j.x, j.y, hp, hp)) { this.causa = ['pinche', o.id, o.x, o.y]; this.morir(j); return; }
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
  // pendientes (triángulos): el ángulo recto está abajo a la derecha sin voltear ni girar; la
  // superficie es la hipotenusa. Se sube y se baja pegado a ella, al terminar de subir sale con la
  // velocidad de la subida (el "salto" de las pendientes) y el lado vertical mata como una pared.
  pendiente(j, o, c, hs, hi) {
    let cx = o.fx ? -1 : 1, cy = o.fy ? 1 : -1;
    const giros = ((Math.round((o.rot + o.drot) / 90) % 4) + 4) % 4;
    for (let k = 0; k < giros; k++) [cx, cy] = [cy, -cx];
    const L = c.x - c.w, Rr = c.x + c.w, B = c.y - c.h, T = c.y + c.h;
    const ax = c.x - cx * c.w, ay = c.y + cy * c.h, bx = c.x + cx * c.w, by = c.y - cy * c.h;
    const m = (by - ay) / (bx - ax), yl = x => ay + (x - ax) * m;
    const vel = j.ups * (j.plataforma ? Math.sign(j.vx || 0) : j.dir);
    const piso = cy < 0; // ángulo recto abajo: se apoya arriba
    const abajoGrav = j.grav > 0;
    if (piso) {
      const xq = GD.clamp(j.x + (m > 0 ? hs : -hs), L, Rr), ys = yl(xq), fondo = j.y - hs;
      const margen = 6 + Math.abs(m) * Math.abs(j.x - j.prevX) + Math.max(0, -(j.y - j.prevY));
      if ((abajoGrav || j.esVuelo()) && fondo <= ys + 0.5 && fondo >= ys - margen && (j.yv <= 0.01 * (abajoGrav ? 1 : -1) || j.enPendiente || fondo >= ys - 3)) {
        j.tocarSuelo(ys, false); j.sobre = o; j.enPendiente = true;
        // la velocidad vertical de la subida (por cuadro de 60, como yv)
        const vy = m * vel / 60 / 0.9; if (abajoGrav) j.yv = vy; else j.yv = Math.min(j.yv, vy);
        return 'apoyo';
      }
    } else {
      const xq = GD.clamp(j.x + (m > 0 ? -hs : hs), L, Rr), ys = yl(xq), techo = j.y + hs;
      const margen = 6 + Math.abs(m) * Math.abs(j.x - j.prevX) + Math.max(0, j.y - j.prevY);
      if ((!abajoGrav || j.esVuelo()) && techo >= ys - 0.5 && techo <= ys + margen) {
        j.tocarSuelo(ys, true); j.sobre = o; j.enPendiente = true;
        const vy = m * vel / 60 / 0.9; if (!abajoGrav) j.yv = vy; else j.yv = Math.max(j.yv, vy);
        return 'apoyo';
      }
    }
    // la caja chica dentro del triángulo: muerte
    if (this.cajaEnTriangulo(j.x, j.y, hi, [ax, ay], [bx, by], [c.x + cx * c.w, c.y + cy * c.h])) return 'muerte';
    return 'nada';
  }
  cajaEnTriangulo(px, py, h, A, Bp, C) {
    // separación de ejes entre la caja y el triángulo (ejes x, y y la normal de la hipotenusa)
    const xs = [A[0], Bp[0], C[0]], ys = [A[1], Bp[1], C[1]];
    if (Math.max(...xs) <= px - h || Math.min(...xs) >= px + h || Math.max(...ys) <= py - h || Math.min(...ys) >= py + h) return false;
    const nx = -(Bp[1] - A[1]), ny = Bp[0] - A[0];
    const pr = (x, y) => x * nx + y * ny;
    const tri = [pr(...A), pr(...Bp), pr(...C)], caja = [pr(px - h, py - h), pr(px + h, py - h), pr(px - h, py + h), pr(px + h, py + h)];
    return !(Math.max(...caja) <= Math.min(...tri) || Math.min(...caja) >= Math.max(...tri));
  }
  tocarEspecial(j, o, c) {
    const ty = o.ty;
    if (o.id === 2063) { this.checkpointPlataforma(o); return; }
    const portal = () => { o.usado = true; this.efectoPortal(o); if (GD.TR) GD.TR.eventoObjeto(this, o); };
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
        this.efectoPad(o); if (GD.TR) GD.TR.eventoObjeto(this, o); return;
      case TYP.ARO_AMARILLO: case TYP.ARO_ROSA: case TYP.ARO_ROJO: case TYP.ARO_GRAVEDAD: case TYP.ARO_VERDE: case TYP.ARO_CAIDA: case TYP.ARO_DASH: case TYP.ARO_DASH_GRAV: case TYP.ARO_ARANA: case TYP.ARO_TELEPORT: case TYP.ARO_CUSTOM:
        if (!j.buffer || (o.usadoPor && o.usadoPor.has(j) && !(o.raw[99] == 1))) return;
        if (GD.perfil.opcion('no-orb-buffer') && !j.recienSost) return;
        (o.usadoPor = o.usadoPor || new Set()).add(j);
        j.buffer = false; o.usado = true;
        if (ty === TYP.ARO_ARANA) { this.teleportArana(j, true); }
        else if (ty === TYP.ARO_CUSTOM) { if (GD.TR) GD.TR.activarGrupos(this, o, true); }
        else if (ty === TYP.ARO_DASH || ty === TYP.ARO_DASH_GRAV) { if (ty === TYP.ARO_DASH_GRAV) j.cambiarGravedad(-j.grav); this.dash(j, o); }
        else if (ty === TYP.ARO_TELEPORT) { if (GD.TR) GD.TR.teleportAro(this, j, o); }
        else j.aro(o);
        this.efectoAro(o, j);
        if (GD.TR && o.raw[51]) GD.TR.activarGrupos(this, o, false);
        if (GD.TR) GD.TR.eventoObjeto(this, o);
        return;
      case TYP.MONEDA_SECRETA: case TYP.MONEDA_USUARIO: case TYP.COLECCIONABLE:
        if (o.tomado) return; o.tomado = true; this.tomarMoneda(o); return;
      case TYP.ROMPIBLE: return;
    }
  }
  romper(o) {
    o.muerto = true; o.activo = false; o.op = 0;
    const pe = this.efecto(new GD.Particulas('explodeEffect', { maxParticles: 12, duration: 0.1 })); pe.x = o.cx; pe.y = o.cy; pe.tinte = [200, 200, 200];
  }
  dash(j, o) { j.dash = { ang: -(o.rot || 0) * (o.fx ? -1 : 1), t: 0 }; j.yv = 0; if (GD.TR) GD.TR.evento(this, 23); }
  cambiarModo(j, modo, o) {
    const antes = j.modo;
    j.modo = modo;
    if (modo !== antes) { if (modo === 'nave' || modo === 'ovni' || modo === 'columpio') j.yv /= 2; if (modo === 'onda') j.yv = 0; j.suelo = false; j.rot = 0; }
    if (this.j2) { /* el corredor del dual queda */ }
    else if (j.esVuelo()) this.ponerLimites(j, o ? o.cy : j.y);
    else this.limites = null;
  }
  ponerLimites(j, y, inst) {
    // en dual el corredor es el del portal dual (300 de alto aunque sean cubos) y los portales de modo no lo cambian
    let alto = GD.Jugador.altoCorredor(j.modo);
    if (this.j2) { if (this.limites && !inst) return; if (!alto) alto = 300; }
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
      Object.assign(j2, { x: j.x, y: j.y, modo: j.modo, vel: j.vel, mini: j.mini, grav: -j.grav, yv: 0, suelo: false, dir: j.dir, plataforma: j.plataforma });
      this.vis2 = new GD.Nodo(); this.actualizarIcono(j2, this.vis2);
      this.limites = null; this.ponerLimites(j, o ? o.cy : j.y, true);
    } else if (!si && this.j2) { this.j2 = null; this.vis2 = null; this.limites = null; if (this.j.esVuelo()) this.ponerLimites(this.j, o ? o.cy : this.j.y); }
  }
  teleportArana(j, pad) {
    // la araña "cae" de golpe hasta la superficie de enfrente y se da vuelta
    const dir = -j.grav, hs = j.alto / 2; let mejor = dir > 0 ? (this.limites ? this.limites.arriba : 1e6) : (this.limites ? this.limites.abajo : 0);
    const cerca = this.cerca(j, 30, j._cerca30 || (j._cerca30 = []));
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
    const opT = (this.tr && this.tr.opc) || {};
    if (!opT.audioAlMorir) GD.S.pararMusica(); if (!opT.sinSonidoMuerte) GD.S.efecto('explode_11.ogg', 0.7);
    this.efectoMuerte(j); if (GD.TR) GD.TR.alMorirJugador(this);
    const pct = Math.min(100, Math.floor(j.x / this.largo * 100));
    if (this.opc.alMorir) this.opc.alMorir(pct, this.practica);
    GD.perfil.sumar('muertes', 1);
  }
  // foto del estado entero (jugadores, objetos, triggers, colores, cámara): checkpoints de práctica
  // exactos, como el juego, y lo que usa el bot de pruebas
  foto() {
    const fj = jj => jj && Object.assign({}, jj, { capa: null, tocados: [...jj.tocados].map(o => o.i), sobre: jj.sobre ? jj.sobre.i : -1 });
    const pulsos = this.dinamicos().map(o => o.pulsos || null);
    const din = structuredClone({ tr: this.tr, pulsos, cols: { act: this.cols.act, trans: this.cols.trans, pulsos: this.cols.pulsos } });
    return {
      j: fj(this.j), j2: fj(this.j2), din, tiempo: this.tiempo, limites: this.limites && Object.assign({}, this.limites), espejo: this.espejo, espejoK: this.espejoK,
      camX: this.camX, camY: this.camY, camYObj: this.camYObj, saltos: this.saltos, monedas: Object.assign({}, this.monedas),
      objs: this.dinamicos().map(o => [o.dx, o.dy, o.drot, o.op, o.activo, o.oculto, o.usado, o.tomado, o.muerto, o.esx, o.esy, o.anim, o.usadoPor ? [...o.usadoPor].map(x => x === this.j ? 1 : 2) : null, o.aPrev ? Object.assign({}, o.aPrev) : null]),
    };
  }
  // sólo cambian los objetos con grupos (los mueven los triggers) y los que se usan al tocarlos
  dinamicos() {
    if (!this._din) { const T = GD.O.TIPO, usa = new Set([T.MONEDA_SECRETA, T.MONEDA_USUARIO, T.COLECCIONABLE, T.ROMPIBLE]); this._din = this.objs.filter(o => o.grupos || usa.has(o.ty) || (o.ty >= 3 && o.ty !== 7 && o.ty !== 25)); }
    return this._din;
  }
  restaurar(f) {
    const rj = (d, j) => { if (!d) return null; j = j || new GD.Jugador(this, true); Object.assign(j, d, { capa: this, tocados: new Set(d.tocados.map(i => this.objs[i])), sobre: d.sobre >= 0 ? this.objs[d.sobre] : null }); return j; };
    rj(f.j, this.j); this.j2 = f.j2 ? rj(f.j2, this.j2) : null;
    if (this.j2 && !this.vis2) this.vis2 = new GD.Nodo();
    const din = structuredClone(f.din);
    this.tr = din.tr; this.cols.act = din.cols.act; this.cols.trans = din.cols.trans; this.cols.pulsos = din.cols.pulsos; this.cols.calc = {};
    Object.assign(this, { tiempo: f.tiempo, limites: f.limites && Object.assign({}, f.limites), espejo: f.espejo, espejoK: f.espejoK, camX: f.camX, camY: f.camY, camYObj: f.camYObj, saltos: f.saltos, monedas: Object.assign({}, f.monedas) });
    this.dinamicos().forEach((o, i) => {
      const v = f.objs[i]; [o.dx, o.dy, o.drot, o.op, o.activo, o.oculto, o.usado, o.tomado, o.muerto, o.esx, o.esy, o.anim] = v;
      o.usadoPor = v[12] ? new Set(v[12].map(k => k === 1 ? this.j : this.j2)) : null; o.pulsos = din.pulsos[i]; o.aPrev = v[13] ? Object.assign({}, v[13]) : null;
      this.moverSeccion(o);
    });
    this._areaTocados = new Set(this.dinamicos().filter(o => o.aPrev));
    this.muerto = false; this.terminada = false;
  }
  ponerCheckpoint() {
    if (this.muerto || !this.practica || this.terminada) return;
    const cp = this.foto(); cp.tiempoMusica = this.tiempoParaX(this.j.x);
    this.checkpoints.push(cp);
    const s = new GD.Sprite('checkpoint_01_001.png'); s.pos(this.j.x, this.j.y); s.mundo = true; cp.sprite = s;
  }
  quitarCheckpoint() { this.checkpoints.pop(); }
  cargarCheckpoint(cp) { this.restaurar(cp); }
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
    if (o.ty === TYP.COLECCIONABLE && GD.TR) GD.TR.tomarItem(this, o);
    this.monedas[o.i] = true; GD.S.efecto(o.ty === TYP.COLECCIONABLE ? 'reward01.ogg' : 'gold02.ogg'); this.coleccion.push(o);
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
    if (this.plataformas) { const obj = j.x - D.ancho / 2; this.camX += (obj - this.camX) * Math.min(1, dt * 8); if (!this.camXIni) { this.camX = obj; this.camXIni = true; } }
    else { const objX = j.x - D.ancho * 0.3; if (!this.terminada || this.finT < 0.3) this.camX = objX; }
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
    if (GD.TR && GD.TR.aplicarBordes) GD.TR.aplicarBordes(this);
  }
  actualizarHUD() {
    const k = GD.clamp(this.j.x / this.largo, 0, 1);
    this.barraLlena.recorte = k; this.pct.texto(Math.floor(k * 100) + '%');
  }

  // ---------- dibujo ----------
  dibujar(pm) {
    if (!this.listo) return;
    const D = GD.D, R = GD.R, zoom = this.zoom || 1;
    // efectos de pantalla (shaders de la 2.2): el mundo va a una textura y después a la pantalla
    const conShader = !this.enEditor && GD.Shaders && !GD.Shaders.roto && this.tr && GD.Shaders.empezar(this);
    this.dibujarFondo();
    this.dibujarMedio();
    // vista del mundo: unidades del nivel → pantalla (con espejo y zoom de cámara)
    const k = this.espejoAnim();
    const vx = this.camX, vy = this.camY;
    let w = new Float32Array([zoom, 0, 0, zoom, -vx * zoom, -vy * zoom]);
    if (k) { w[0] = zoom * (1 - 2 * k); w[4] = (-vx * zoom) * (1 - 2 * k) + D.ancho * k; }
    if (this.camRot) { const a = -this.camRot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), cx = D.ancho / 2, cy = D.alto / 2; const m = [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy]; w = new Float32Array([m[0] * w[0] + m[2] * w[1], m[1] * w[0] + m[3] * w[1], m[0] * w[2] + m[2] * w[3], m[1] * w[2] + m[3] * w[3], m[0] * w[4] + m[2] * w[5] + m[4], m[1] * w[4] + m[3] * w[5] + m[5]]); }
    this.vista = w;
    const x0 = vx - 100, x1 = vx + D.ancho / zoom + 100;
    const vis = this._visA || (this._visA = []); vis.length = 0; // arreglos reusados cuadro a cuadro
    for (let s = Math.max(0, Math.floor(x0 / SEC)), s1 = Math.floor(x1 / SEC); s <= s1; s++) { const a = this.secs[s]; if (a) for (let i = 0; i < a.length; i++) vis.push(a[i]); }
    vis.sort(porRango);
    const editor = !!this.enEditor;
    let vis2 = vis;
    if (!editor) { vis2 = this._visB || (this._visB = []); vis2.length = 0; for (let i = 0; i < vis.length; i++) { const o = vis[i]; if (o.vis && !o.oculto && (!GD.O.esTrigger(o.id) || o.id === 1615) && o.op > 0.001) vis2.push(o); } }
    GD.O.partida = this; this._visibles = vis2;
    if (!editor) this.efectosBorde(vis2, x0 + 100, x1 - 100);
    const emisores = this._emis || (this._emis = []); emisores.length = 0;
    for (let i = 0; i < vis.length; i++) { const o = vis[i]; if (o.pdef && (editor || (o.vis && !o.oculto))) emisores.push(o); }
    GD.O.dibujarObjetos(vis2, w, this.cols, { capaJugador: GD.O.CAPA_JUGADOR, jugadores: () => this.dibujarJugadores(w), opacidad: this.fundidoBorde ? o => this.fundidoBorde(o) : null,
      emisores: emisores.length ? emisores : null, dibujarEmisor: o => this.dibujarEmisor(o, w) });

    this.dibujarEfectos(w);
    if (this.practica && GD.perfil.opcion('show-hitboxes')) this.dibujarCajas(w);
    this.dibujarPiso();
    if (conShader) GD.Shaders.terminar(this);
    // HUD y lo que no es del mundo
    super.dibujar(pm, 255, 255, 255, 255);
  }
  // objeto de partículas (2065): emite mientras se ve; con "animar al activar" (123) espera a un
  // trigger Animate; con "inicio rápido" (211) ya aparece lleno
  dibujarEmisor(o, w) {
    let e = o.emisor;
    const pon = () => { e.x = o.cx + (o.vx || 0); e.y = o.cy + (o.vy || 0); e.rot = o.rot + o.drot; e.esc = Math.abs(o.sx) * (o.esx || 1); };
    if (!e) {
      e = o.emisor = new GD.EmisorGD(o.pdef); pon();
      if (o.raw[123] == 1 && !o.animado) e.emitiendo = false;
      else if (o.raw[211] == 1) for (let t = 0; t < Math.min(3, o.pdef.vida + o.pdef.vidaV); t += 0.05) e.paso(0.05);
    }
    pon();
    if (!this.pausada) e.paso(Math.min(0.05, GD.D.dt || 0));
    const tinte = o.raw[146] == 1 ? GD.O.colorParte(o, { ct: 'b' }, this.cols).slice(0, 3) : null;
    e.dibujar(w, tinte, o.op * (o.fb === undefined ? 1 : o.fb));
  }
  dibujarCajas(w) {
    const R = GD.R, uv = new Float32Array(8).fill(0.5), xs = new Float32Array(8);
    const linea = (ax, ay, bx, by, col) => { const X0 = w[0] * ax + w[2] * ay + w[4], Y0 = w[1] * ax + w[3] * ay + w[5], X1 = w[0] * bx + w[2] * by + w[4], Y1 = w[1] * bx + w[3] * by + w[5]; let dx = X1 - X0, dy = Y1 - Y0; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; xs.set([X0 - dy * 0.6, Y0 + dx * 0.6, X1 - dy * 0.6, Y1 + dx * 0.6, X0 + dy * 0.6, Y0 - dx * 0.6, X1 + dy * 0.6, Y1 - dx * 0.6]); R.quad(R.blanco, false, 0, xs, uv, col); };
    const caja = (c, col) => {
      if (c.circ) { const n = 16; for (let i = 0; i < n; i++) { const a0 = i / n * 6.283, a1 = (i + 1) / n * 6.283; linea(c.x + Math.cos(a0) * c.r, c.y + Math.sin(a0) * c.r, c.x + Math.cos(a1) * c.r, c.y + Math.sin(a1) * c.r, col); } return; }
      const a = c.ang || 0, cs = Math.cos(a), sn = Math.sin(a), P = (x, y) => [c.x + x * cs - y * sn, c.y + x * sn + y * cs];
      const q = [P(-c.w, -c.h), P(c.w, -c.h), P(c.w, c.h), P(-c.w, c.h)]; for (let i = 0; i < 4; i++) linea(...q[i], ...q[(i + 1) % 4], col);
    };
    for (const o of this.cerca(this.j, 400)) { if (!o.activo || o.oculto) continue; const t = o.ty; const col = t === TYP.PELIGRO || t === TYP.PELIGRO_ANIMADO ? GD.col(255, 0, 0, 255) : t === TYP.SOLIDO || t === TYP.PENDIENTE ? GD.col(0, 0, 255, 255) : o.d.hb ? GD.col(0, 255, 0, 255) : 0; if (col) caja(this.caja(o), col); }
    for (const j of [this.j, this.j2]) if (j) { caja({ x: j.x, y: j.y, w: j.alto / 2, h: j.alto / 2 }, GD.col(255, 0, 0, 255)); caja({ x: j.x, y: j.y, w: 4.5 * (j.mini ? 0.6 : 1), h: 4.5 * (j.mini ? 0.6 : 1) }, GD.col(0, 0, 255, 255)); }
  }
  // los objetos se desvanecen al entrar y salir por los costados (salvo "Don't Fade" 64), y con un
  // efecto de entrada (triggers 22-28, 55-59) además se mueven o se agrandan
  efectosBorde(vis, xi, xd) {
    const M = 75, ef = this.efEntrada || 0;
    for (const o of vis) {
      o.vx = o.vy = 0; o.ve = 1; o.fb = 1;
      if (o.raw[64] == 1 || o.raw[67] == 1) continue;
      const x = o.cx, kd = (xd - x) / M, ki = (x - xi) / M;
      let k = Math.min(kd, ki); if (k >= 1) continue; k = GD.clamp(k, 0, 1);
      o.fb = k;
      if (!ef || ef === 22) continue;
      const q = 1 - k, lado = kd < ki ? 1 : -1, d = q * 90;
      switch (ef) {
        case 23: o.vy = -d; break; case 24: o.vy = d; break;
        case 25: o.vx = -d * lado; break; case 26: o.vx = d * lado; break;
        case 27: o.ve = k; break; case 28: o.ve = 1 + q; break;
        case 55: o.vx = -d; break; case 56: o.vx = d; break; case 57: o.vy = d; break; case 58: o.vy = -d; break; case 59: o.ve = k; o.vy = d * 0.5; break;
      }
    }
  }
  fundidoBorde(o) { return (o.fb === undefined ? 1 : o.fb) * (o.opArea === undefined ? 1 : o.opArea); }
  espejoAnim() { const obj = this.espejo ? 1 : 0; this.espejoK += (obj - this.espejoK) * Math.min(1, (GD.D.dt || 0.016) * 4); return this.espejoK < 0.001 ? 0 : this.espejoK; }
  // estela, partículas del piso y fuego de la nave
  efectosJugador(j, v, w) {
    const P = GD.perfil, m = j.modo, t = this.tiempo;
    v.estela = v.estela || new GD.Estela(0.35, 10); v.onda = v.onda || new GD.Estela(1, j.mini ? 5 : 8, true);
    if (m === 'onda') { v.onda.ancho = j.mini ? 5 : 8; if (!this.muerto) v.onda.agregar(j.x, j.y, t); v.onda.dibujar(w, t, P.c2rgb()); }
    else if (v.onda.p.length) v.onda.cortar();
    const conEstela = (m === 'nave' || m === 'ovni' || m === 'columpio' || m === 'jetpack' || (j.estelaHasta && t < j.estelaHasta)) && j.estela !== false;
    // la parte de atrás de la nave, girada con ella (de ahí salen la estela y el fuego)
    const k = j.mini ? 0.6 : 1, atras = (lx, ly) => { const a = -j.rot * Math.PI / 180, y = ly * (j.grav > 0 ? 1 : -1); return [j.x + (lx * Math.cos(a) - y * Math.sin(a)) * k, j.y + (lx * Math.sin(a) + y * Math.cos(a)) * k]; };
    const [ex, ey] = m === 'nave' || m === 'jetpack' ? atras(-12, -3) : [j.x, j.y];
    if (conEstela && !this.muerto) v.estela.agregar(ex, ey, t);
    v.estela.dibujar(w, t, P.c2rgb());
    // partículas: arrastre en el piso (cubo, robot, bola) y fuego de la nave
    if (!v.polvo) { v.polvo = new GD.Particulas('dragEffect'); v.fuego = new GD.Particulas('shipDragEffect'); }
    const enPiso = j.suelo && (m === 'cubo' || m === 'robot' || m === 'bola' || m === 'arana') && !this.muerto;
    v.polvo.emitiendo = enPiso; v.polvo.x = j.x - 10; v.polvo.y = j.y - (j.alto / 2) * (j.grav > 0 ? 1 : -1); v.polvo.tinte = P.c1rgb();
    const [fx, fy] = atras(-20, -5);
    v.fuego.emitiendo = (m === 'nave' || m === 'jetpack') && !this.muerto; v.fuego.x = fx; v.fuego.y = fy; v.fuego.giroEmisor = (j.grav > 0 ? 0 : 180) - j.rot;
    for (const q of [v.polvo, v.fuego]) { q.alActualizar(GD.D.dt || 0); q.dibujar(w, 255, 255, 255, 255); }
  }
  dibujarJugadores(w) {
    const dib = (j, v) => {
      if (v && !(j.muerto && this.muerto)) this.efectosJugador(j, v, w);
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
  // fondo del medio (2.2, fg_NN): entre el fondo y los objetos, con los canales 1013/1014
  dibujarMedio() {
    const D = GD.D, tx = this.txMedio; if (!tx || (this.tr && this.tr.opc && this.tr.opc.sinMedio)) return;
    const zoom = this.zoom || 1, vm = (this.tr && this.tr.velMedio) || [1, 1];
    const ancho = tx.w / 2, alto = tx.h / 2, ox = -(((this.camX * 0.5 * vm[0] * zoom) % ancho) + ancho) % ancho;
    const y0 = (-this.camY * zoom) * vm[1] + ((this.tr && this.tr.medioY) || 0) * zoom - 0, y1 = y0 + alto;
    const n = (D.ancho + ancho * 2) / ancho, xs = new Float32Array([ox, y1, ox + ancho * n, y1, ox, y0, ox + ancho * n, y0]), uv = new Float32Array([0, 0, n, 0, 0, 1, n, 1]);
    for (const [t, canal] of [[tx, 1013], [this.txMedio2, 1014]]) { if (!t) continue; const c = this.cols.valor(canal); GD.R.quad(t, false, 0, xs, uv, GD.col(c.r, c.g, c.b, 255 * (c.op === undefined ? 1 : c.op))); }
  }
  // triggers que cambian el fondo, el piso o el medio (3029/3030/3031)
  async cambiarFondo(tipo, n) {
    const nn = v => String(v).padStart(2, '0');
    const carga = async nombre => { if (!GD.datos.hojas.hasOwnProperty(nombre)) return null; const t = await GD.T.textura(nombre); GD.R.repetir(t); return t; };
    if (tipo === 'fondo') { const t = await carga(`game_bg_${nn(n)}_001`); if (t) { this.txFondo = t; this.fondo = n; } }
    else if (tipo === 'piso') { const [a, b] = await Promise.all([carga(`groundSquare_${nn(n)}_001`), carga(`groundSquare_${nn(n)}_2_001`)]); if (a) { this.txPiso = a; this.txPiso2 = b; this.piso = n; } }
    else if (!n) { this.txMedio = this.txMedio2 = null; }
    else { const [a, b] = await Promise.all([carga(`fg_${nn(n)}_001`), carga(`fg_${nn(n)}_2_001`)]); if (a) { this.txMedio = a; this.txMedio2 = b; this.medio = n; } }
  }
  // checkpoint de los niveles de plataformas (2063): al morir se vuelve a él
  checkpointPlataforma(o) {
    if (o.usado || this.muerto) return; o.usado = true;
    this.cpPlat = this.foto(); this.cpPlat.tiempoMusica = this.tiempoParaX(this.j.x);
    GD.S.efecto('crystal01.ogg', 0.6); const w = this.efecto(new GD.Onda(0.4, 10, 50, [0, 255, 0])); w.x = o.cx; w.y = o.cy;
    if (GD.TR) GD.TR.evento(this, 60);
  }
  dibujarPiso() {
    const D = GD.D, tx = this.txPiso; if (!tx || (this.tr && this.tr.opc && this.tr.opc.sinPiso)) return;
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
    if (this.particulas && this.particulas.length) {
      for (const q of this.particulas) { if (!this.pausada) q.e.paso(Math.min(0.05, GD.D.dt || 0)); q.e.dibujar(w, q.tinte, 1); }
      this.particulas = this.particulas.filter(q => !q.e.fin);
    }
    this.efectos = this.efectos || [];
    for (const e of this.efectos.slice()) { e.actualizar(GD.D.dt || 0); if (!e.padre && e._quitado) continue; e.dibujar(w, 255, 255, 255, 255); }
    this.efectos = this.efectos.filter(e => !e._fin);
  }
  // ---------- efectos ----------
  efecto(n) { n.mundo = true; n.sacar = () => { n._fin = true; }; (this.efectos = this.efectos || []).push(n); return n; }
  efectoMuerte(j) {
    const P = GD.perfil;
    if (P.opcion('no-death-effect')) return;
    const pe = this.efecto(new GD.Particulas('explodeEffect')); pe.x = j.x; pe.y = j.y; pe.tinte = P.c1rgb();
    const o = this.efecto(new GD.Onda(0.5, 10, 90, P.c1rgb(), true)); o.x = j.x; o.y = j.y;
    // efectos de muerte del garaje: la animación de su hoja (PlayerExplosion_XX)
    const n = P.muerte | 0;
    if (n > 1) {
      const hoja = 'PlayerExplosion_' + String(n - 1).padStart(2, '0'), base = 'playerExplosion_' + String(n - 1).padStart(2, '0');
      GD.cargarHoja(hoja).then(() => {
        const fr = []; for (let k = 1; GD.T.m(`${base}_${String(k).padStart(3, '0')}.png`); k++) fr.push(`${base}_${String(k).padStart(3, '0')}.png`);
        if (!fr.length) return;
        const s = this.efecto(new GD.Sprite(fr[0])); s.x = j.x; s.y = j.y; s.color(P.c1rgb()); s.escala = 1.2;
        s.correr(GD.A.sec(GD.A.marcos(fr, 0.05, false), GD.A.fn(q => q._fin = true)));
      });
    }
  }
  efectoPortal(o) { const w = this.efecto(new GD.Onda(0.4, 10, 50, [255, 255, 255])); w.x = o.cx; w.y = o.cy; }
  efectoPad(o) { const w = this.efecto(new GD.Onda(0.3, 5, 30, [255, 255, 0])); w.x = o.cx; w.y = o.cy; }
  efectoAro(o) { const w = this.efecto(new GD.Onda(0.3, 30, 5, [255, 255, 255])); w.x = o.cx; w.y = o.cy; }
  efectoAranaRayo(x, y0, y1) { const r = this.efecto(new GD.Rect(6, Math.abs(y1 - y0), 255, 255, 255, 200)); r.x = x - 3; r.y = Math.min(y0, y1); r.add = true; r.correr(GD.A.sec(GD.A.op(0.25, 0), GD.A.fn(n => n._fin = true))); }
  efectoFinal() { GD.S.efecto('achievement_01.ogg', 0.5); for (let i = 0; i < 3; i++) { const w = this.efecto(new GD.Onda(0.6 + i * 0.2, 10, 200, [255, 255, 255], i === 0)); w.x = this.j.x; w.y = this.j.y; } }
  alSaltar(j) {
    this.saltos = (this.saltos || 0) + 1; if (!GD.TR || !this.tr) return;
    const m = j && j.modo; GD.TR.evento(this, m === 'ovni' ? 15 : m === 'bola' ? 19 : m === 'columpio' ? 20 : 12);
  }
  alAterrizar(j, v, techo) { if (GD.TR && this.tr) { GD.TR.aterrizaje(this, v); if (techo && j && j.grav > 0) GD.TR.evento(this, 6); } }
}
const kStartPosActive = -1;
GD.Partida = Partida;
