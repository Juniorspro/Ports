// El jugador (PlayerObject): física de los 8 modos a 240 pasos por segundo con las constantes del
// juego, y su dibujo con los íconos elegidos en el garaje.
'use strict';
const ICONOS = GD.ICONOS = { tipos: { cubo: 'player', nave: 'ship', bola: 'player_ball', ovni: 'bird', onda: 'dart', robot: 'robot', arana: 'spider', columpio: 'swing', jetpack: 'jetpack' } };
ICONOS.nombre = (tipo, n) => `${ICONOS.tipos[tipo]}_${String(n).padStart(2, '0')}`;
ICONOS.cargar = async function (tipo, n) {
  const nom = ICONOS.nombre(tipo, n);
  if (GD.T.tex['ico/' + nom]) return nom;
  const fr = GD.datos.iconos[nom]; if (!fr) return null;
  const tx = await GD.T.textura(nom, 'ico'); GD.T.tex['ico/' + nom] = tx;
  GD.T.registrar(nom, tx, fr);
  return nom;
};
ICONOS.cuantos = tipo => { let n = 0; while (GD.datos.iconos[ICONOS.nombre(tipo, n + 1)]) n++; return n; };

// muñeco de ícono con sus capas: color 2 abajo, color 1, extra (blanco) y brillo
class Icono extends GD.Nodo {
  constructor(tipo, n, c1, c2, brillo, cGlow) {
    super(); this.tipo = tipo; this.n = n; this.c1 = c1; this.c2 = c2; this.brillo = brillo; this.cGlow = cGlow || c2;
    this.listo = ICONOS.cargar(tipo, n).then(nom => { if (nom) this._armar(nom); });
  }
  _armar(nom) {
    this.vaciar(); const T = GD.T, add = (f, z, c) => { if (!T.m(f)) return null; const s = new GD.Sprite(f); s.color(c); this.agregar(s, z); return s; };
    if (this.tipo === 'robot' || this.tipo === 'arana') { this.partes = new GD.ICONOS.Animado(this.tipo, nom, this); this.agregar(this.partes); return; }
    this.glow = add(nom + '_glow_001.png', -2, this.cGlow); if (this.glow) this.glow.vis = !!this.brillo;
    this.s2 = add(nom + '_2_001.png', -1, this.c2);
    this.s1 = add(nom + '_001.png', 0, this.c1);
    this.s3 = add(nom + '_3_001.png', -3, [255, 255, 255]); // cúpula del ovni
    this.ex = add(nom + '_extra_001.png', 1, [255, 255, 255]);
    this.w = this.s1 ? this.s1.w : 30; this.h = this.s1 ? this.s1.h : 30;
    for (const h of this.hijos) h.pos(this.w / 2, this.h / 2);
  }
  colores(c1, c2, glow) { this.c1 = c1; this.c2 = c2; if (this.s1) this.s1.color(c1); if (this.s2) this.s2.color(c2); if (glow && this.glow) this.glow.color(glow); if (this.partes) this.partes.colores(c1, c2); }
}
GD.Icono = Icono;

// robot y araña: muñecos por partes con las animaciones de *_AnimDesc.plist
class Animado extends GD.Nodo {
  constructor(tipo, nom, ic) {
    super(); this.tipo = tipo; this.nom = nom; this.ic = ic;
    const base = tipo === 'robot' ? 'Robot' : 'Spider';
    this.desc = GD.datos.otros[base + '_AnimDesc'].animationContainer;
    this.def = GD.datos.otros.objectDefinitions[base];
    this.sprites = {}; this.anim = null; this.t = 0; this.velAnim = 1;
    this.poner(this.def.defaultAnimation);
  }
  colores(c1, c2) { this.ic.c1 = c1; this.ic.c2 = c2; for (const k in this.sprites) { const s = this.sprites[k]; s.s1 && s.s1.color(c1); s.s2 && s.s2.color(c2); } }
  poner(nombre, reiniciar) {
    if (this.anim === nombre && !reiniciar) return;
    const a = this.def.animations[nombre]; if (!a) return;
    this.anim = nombre; this.t = 0; this.a = a;
    this.marcos = a.singleFrame ? [a.singleFrame] : Array.from({ length: +a.frames }, (_, i) => `${this.def.animDesc.startsWith('Robot') ? 'Robot' : 'Spider'}_${nombre}_${String(i + 1).padStart(3, '0')}.png`);
    this._marco(0);
  }
  _marco(i) {
    const m = this.desc[this.marcos[i]]; if (!m) return;
    const num = s => String(s).match(/-?[\d.]+/g).map(Number);
    for (const k in m) {
      const p = m[k]; let s = this.sprites[k];
      const parte = p.texture.match(/_(\d\d)_001\.png$/)[1];
      if (!s) {
        s = this.sprites[k] = new GD.Nodo(); const n = this.nom + '_' + parte;
        const add = (f, z, c) => { if (!GD.T.m(f)) return null; const q = new GD.Sprite(f); q.color(c); s.agregar(q, z); return q; };
        s.glow = add(n + '_glow_001.png', -2, this.ic.cGlow); if (s.glow) s.glow.vis = !!this.ic.brillo;
        s.s2 = add(n + '_2_001.png', -1, this.ic.c2); s.s1 = add(n + '_001.png', 0, this.ic.c1); s.ex = add(n + '_extra_001.png', 1, [255, 255, 255]);
        this.agregar(s, +p.zValue);
      }
      const [x, y] = num(p.position), [sx, sy] = num(p.scale), [fx, fy] = num(p.flipped);
      s.x = x; s.y = y; s.sx = sx * (fx ? -1 : 1); s.sy = sy * (fy ? -1 : 1); s.rot = +p.rotation; s.z = +p.zValue; this._sucio = true;
    }
  }
  alActualizar(dt) {
    const a = this.a; if (!a || a.singleFrame) return;
    this.t += dt * this.velAnim; const n = this.marcos.length, dur = +a.delay;
    let i = Math.floor(this.t / dur);
    if (a.looped === '1') i %= n; else if (i >= n) { i = n - 1; if (this.alTerminar) { const f = this.alTerminar; this.alTerminar = null; f(); } }
    this._marco(i);
  }
}
GD.ICONOS.Animado = Animado;

// ---------------- física ----------------
const GRAV = 0.958199, SALTO = 11.180032;
class Jugador {
  constructor(capa, p2 = false) {
    this.capa = capa; this.p2 = p2;
    this.x = 0; this.y = 105; this.yv = 0; this.modo = 'cubo'; this.mini = false; this.grav = 1; this.espejo = false;
    this.suelo = false; this.sost = false; this.buffer = false; this.vel = 1; this.rot = 0; this.muerto = false;
    this.subiendo = false; this.tocados = new Set(); this.ultimoSuelo = 0; this.portalY = 0; this.dir = 1;
    this.vis = true; this.estela = true; this.tamano = 1; this.vx = 0; this.mira = 1; this.plataforma = false;
  }
  get alto() { return this.mini ? 18 : 30; }
  get ups() { return GD.O.UPS[this.vel]; }
  esVuelo() { return this.modo !== 'cubo' && this.modo !== 'robot'; }
  // datos de los "límites" de los modos que vuelan (nave, bola, ovni, onda, araña, columpio)
  static altoCorredor(modo) { return modo === 'bola' || modo === 'arana' ? 240 : modo === 'cubo' || modo === 'robot' ? 0 : 300; }

  presionar() { this.sost = true; this.buffer = true; this.recienSost = true; if (this.modo === 'columpio' || (this.modo === 'ovni')) this.pulsoAire = true; }
  soltar() { this.sost = false; this.buffer = false; }

  // un paso de física; d = dt en 60avos de segundo
  paso(dt) {
    // la gravedad puede venir cambiada por el trigger de gravedad (2066)
    const d = dt * 60, ds = d * 0.9, g = this.grav, tam = this.mini ? 0.8 : 1, GR = GRAV * (this.gravMod || 1);
    this.prevY = this.y; this.prevX = this.x; this.enPendienteAntes = this.enPendiente; this.enPendiente = false;
    const m = this.modo;
    if (this.dash) { // aro de dash: va en línea recta mientras se mantiene el toque
      const vel = this.ups * dt, a = GD.clamp(this.dash.ang, -70, 70) * Math.PI / 180;
      this.x += vel * this.dir; this.y += Math.tan(a) * vel; this.yv = 0; this.suelo = false;
      if (!this.sost) { this.dash = null; this.yv = Math.tan(a) * 5.77 * (this.grav > 0 ? 1 : -1) * 0; GD.TR.evento && GD.TR.evento(this.capa, 24); }
      this.rot += (this.modo === 'cubo' ? 600 : 0) * dt;
      return;
    }
    if (m === 'onda') {
      const k = (this.mini ? 2 : 1) * this.ups * dt * (this.pendienteOnda || 1);
      this.yv = (this.sost ? 1 : -1) * g; this.y += this.yv * k; this.suelo = false;
    } else if (m === 'nave' || m === 'ovni' || m === 'columpio' || m === 'jetpack') {
      const ps = this.mini ? 0.85 : 1;
      if (m === 'nave' || m === 'jetpack') {
        let acel = this.sost ? -1 : (this.cayendo() ? 0.8 : 1.2);
        const extra = this.sost && this.cayendo() ? 0.5 : 0.4;
        this.yv -= GR * ds * g * acel * extra / ps;
      } else if (m === 'ovni') {
        if (this.pulsoAire) {
          this.pulsoAire = false; this.buffer = false;
          const nv = g * (this.mini ? 8 : 7) * ps;
          if ((g > 0 && this.yv < nv) || (g < 0 && this.yv > nv)) this.yv = nv;
          this.suelo = false; this.capa.alSaltar && this.capa.alSaltar(this);
        }
        const gm = this.cayendo() ? 0.8 : 1.2;
        this.yv -= GR * ds * g * gm * 0.5 / ps;
      } else { // columpio (2.2): cada toque cambia la gravedad; cae como la nave suelta
        if (this.pulsoAire) { this.pulsoAire = false; this.buffer = false; this.cambiarGravedad(-this.grav, false); this.capa.alSaltar && this.capa.alSaltar(this); }
        const gm = this.cayendo() ? 0.8 : 1.2;
        this.yv -= GR * ds * this.grav * gm * 0.4 / ps;
      }
      let sup = 8 / ps, inf = -6.4 / ps;
      if (m === 'ovni') { sup = 8 / ps; inf = -6.4 / ps; }
      if (m === 'columpio') { sup = 6.4 / ps; inf = -6.4 / ps; }
      if (g > 0) { if (this.yv < inf) this.yv = inf; if (this.yv > sup) this.yv = sup; }
      else { if (this.yv > -inf) this.yv = -inf; if (this.yv < -sup) this.yv = -sup; }
      this.y += this.yv * ds;
    } else { // cubo, bola, robot, araña
      const gm = m === 'bola' ? 0.6 : 1;
      if (this.sost && this.suelo && (m !== 'bola' && m !== 'arana' ? true : this.buffer)) this.saltar();
      else if (m === 'robot' && this.sost && this.robotT !== undefined && this.robotT < 0.25 * 60 && this.subiendo) {
        // el robot sigue subiendo mientras se mantiene el toque
        this.robotT += d; this.yv = g * Math.max(Math.abs(this.yv), 0) ;
        this.yv = g * SALTO * 0.5 * tam * 1.0;
      } else {
        if (m === 'robot' && !this.sost) this.robotT = 1e9;
        this.yv -= GR * ds * g * gm;
        if (g > 0) this.yv = Math.max(this.yv, -15); else this.yv = Math.min(this.yv, 15);
        if (this.subiendo && this.cayendo()) this.subiendo = false;
        if ((g > 0 && this.yv < -GRAV * 2) || (g < 0 && this.yv > GRAV * 2)) this.suelo = false;
      }
      this.y += this.yv * ds;
    }
    if (this.plataforma) { // modo plataformas: acelera y frena en vez de avanzar solo
      const obj = this.dir * this.ups * (this.velPlat || 1);
      this.vx += (obj - this.vx) * Math.min(1, dt * (this.dir ? 12 : 18));
      if (Math.abs(this.vx) < 0.5 && !this.dir) this.vx = 0;
      this.x += this.vx * dt;
      if (this.dir) this.mira = this.dir;
    } else this.x += this.ups * dt * this.dir;
    // giro del dibujo
    this.girar(dt);
    this.recienSost = false;
  }
  cayendo() { return this.grav > 0 ? this.yv < GRAV : this.yv > -GRAV; }
  saltar() {
    const m = this.modo, g = this.grav, tam = this.mini ? 0.8 : 1;
    this.suelo = false; this.subiendo = true; this.buffer = false;
    if (m === 'cubo') { this.yv = g * SALTO * tam; this.giroSalto = true; }
    else if (m === 'robot') { this.yv = g * SALTO * 0.5 * tam; this.robotT = 0; }
    else if (m === 'bola') { this.yv = g * SALTO * tam; this.cambiarGravedad(-g, false); this.yv *= 0.6; this.sost = this.sost; this.buffer = false; }
    else if (m === 'arana') { this.capa.teleportArana(this); return; }
    this.capa.alSaltar && this.capa.alSaltar(this);
  }
  cambiarGravedad(ng, mitad = true) {
    if (ng === this.grav) return;
    this.grav = ng; if (mitad) this.yv /= 2;
    if (GD.TR.evento && this.capa.tr) GD.TR.evento(this.capa, ng < 0 ? 10 : 11);
    this.suelo = false;
  }
  // empujón de pad: fuerza 1 amarillo, 0.65 rosa, 1.25 rojo, 0.8 azul
  impulso(f) {
    this.subiendo = true; this.suelo = false;
    this.yv = this.grav * 16 * f * (this.mini ? 0.8 : 1);
    if (this.modo === 'bola' || this.modo === 'arana') this.yv *= 0.6;
    if (this.modo === 'nave' || this.modo === 'ovni' || this.modo === 'columpio' || this.modo === 'jetpack') this.yv *= 0.4;
    if (this.modo === 'robot') this.robotT = 1e9;
    this.giroSalto = true; this.estelaHasta = this.capa.tiempo + 0.4;
  }
  // aro (orb): tipo según el objeto
  aro(o) {
    const TY = GD.O.TIPO, m = this.modo, tam = this.mini ? 0.8 : 1; let v = SALTO, g = this.grav;
    this.subiendo = true; this.suelo = false; this.buffer = false;
    switch (o.ty) {
      case TY.ARO_CAIDA: v = m === 'ovni' ? -11.2 : m === 'nave' || m === 'onda' ? -14 : m === 'arana' ? -16.5 : -15; this.yv = v * g; return;
      case TY.ARO_ROJO: v *= m === 'nave' ? (this.mini ? 1.4 : 1) : m === 'ovni' ? (this.mini ? 1.36 : 1.02) : m === 'arana' || m === 'bola' ? 1.34 : m === 'robot' ? 1.28 : 1.38; break;
      case TY.ARO_ROSA: v *= m === 'nave' ? 0.37 : m === 'ovni' ? 0.42 : m === 'bola' ? 0.77 : 0.72; break;
      case TY.ARO_GRAVEDAD: v *= 0.8; break;
      case TY.ARO_VERDE: if (m === 'nave') v *= 0.7; this.cambiarGravedad(-this.grav, false); g = this.grav; break;
      default: if (m === 'robot') v *= 0.9; if (m === 'nave') v *= 0.4 * 1.75; if (m === 'onda') { this.cambiarGravedad(this.grav, false); return; }
    }
    this.yv = v * g * tam;
    if (m === 'bola' || m === 'arana') this.yv *= 0.7;
    if (o.ty === TY.ARO_GRAVEDAD) this.cambiarGravedad(-this.grav, false);
    if (m === 'robot') this.robotT = 1e9;
    this.giroSalto = true; this.estelaHasta = this.capa.tiempo + 0.4;
  }
  tocarSuelo(yTope, techo) {
    // queda apoyado en una superficie: abajo (o arriba con la gravedad invertida)
    this.y = techo ? yTope - this.alto / 2 : yTope + this.alto / 2;
    const vLlega = this.yv;
    if (this.grav > 0 ? this.yv < 0 : this.yv > 0) this.yv = 0;
    const antes = this.suelo;
    this.suelo = true; this.subiendo = false; this.robotT = undefined;
    if (!antes && this.capa.alAterrizar) this.capa.alAterrizar(this, vLlega, techo);
  }
  girar(dt) {
    const m = this.modo, g = this.grav;
    if (m === 'cubo' || m === 'robot' && false) {
      if (!this.suelo) this.rot += 420 * dt * g * (this.mini ? 1.2 : 1) * (this.plataforma ? this.mira : this.dir);
      else { const obj = Math.round(this.rot / 90) * 90; this.rot += (obj - this.rot) * Math.min(1, dt * 25); }
    } else if (m === 'bola') this.rot += 600 * dt * g * this.dir * (this.mini ? 1.25 : 1);
    else if (m === 'nave' || m === 'ovni' || m === 'jetpack') {
      if (m === 'ovni') { this.rot += (0 - this.rot) * Math.min(1, dt * 10); return; }
      const dx = this.x - this.prevX, dy = this.y - this.prevY;
      if (Math.hypot(dx, dy) > 0.05) { const a = -Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI * (this.mini ? 1.2 : 1); this.rot += (a - this.rot) * Math.min(1, dt * 9); }
    } else if (m === 'onda') { const a = this.suelo ? 0 : (this.sost ? -1 : 1) * g * (this.mini ? 63.4 : 45); this.rot += (a - this.rot) * Math.min(1, dt * 30); }
    else if (m === 'columpio') { const a = -this.yv * 4 * (this.mini ? 1.2 : 1); this.rot += (GD.clamp(a, -40, 40) - this.rot) * Math.min(1, dt * 9); }
    else this.rot = 0;
  }
}
GD.Jugador = Jugador;
