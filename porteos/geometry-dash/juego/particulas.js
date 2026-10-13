// Sistema de partículas de cocos2d (los .plist de efectos del juego: arrastre, explosión, portales…).
'use strict';
class Particulas extends GD.Nodo {
  constructor(def, extra) {
    super();
    const d = this.d = Object.assign({}, typeof def === 'string' ? GD.datos.otros[def] : def, extra || {});
    this.max = d.maxParticles | 0; this.p = []; this.emitiendo = true; this.acum = 0; this.tVida = 0;
    this.dur = d.duration; this.tasa = this.max / Math.max(0.0001, d.particleLifespan);
    if (d.emissionRate) this.tasa = d.emissionRate;
    const tex = (d.textureFileName || 'square.png').replace(/\.png$/, '');
    this.f = GD.T.m(tex + '.png') || GD.T.m('square_02_001.png');
    this.add = d.blendFuncDestination === 1;
    this.local = false; // como el juego: las partículas quedan donde nacieron (en el padre)
    this.autoQuitar = d.duration > 0;
    this.ax = this.ay = 0;
  }
  parar() { this.emitiendo = false; }
  seguir() { this.emitiendo = true; }
  reiniciar() { this.p.length = 0; this.tVida = 0; this.emitiendo = true; }
  _emitir() {
    const d = this.d, V = v => (Math.random() * 2 - 1) * (v || 0);
    const vida = Math.max(0.0001, d.particleLifespan + V(d.particleLifespanVariance));
    const [ox, oy] = this.local ? [0, 0] : [this.x, this.y];
    const p = {
      x: ox + (d.sourcePositionVariancex ? V(d.sourcePositionVariancex) : 0), y: oy + (d.sourcePositionVariancey ? V(d.sourcePositionVariancey) : 0),
      vida, t: 0,
      c0: [d.startColorRed + V(d.startColorVarianceRed), d.startColorGreen + V(d.startColorVarianceGreen), d.startColorBlue + V(d.startColorVarianceBlue), d.startColorAlpha + V(d.startColorVarianceAlpha)],
      c1: [d.finishColorRed + V(d.finishColorVarianceRed), d.finishColorGreen + V(d.finishColorVarianceGreen), d.finishColorBlue + V(d.finishColorVarianceBlue), d.finishColorAlpha + V(d.finishColorVarianceAlpha)],
      s0: Math.max(0, d.startParticleSize + V(d.startParticleSizeVariance)) / 2,
      r0: d.rotationStart + V(d.rotationStartVariance), r1: d.rotationEnd + V(d.rotationEndVariance),
    };
    p.s1 = d.finishParticleSize === -1 ? p.s0 : Math.max(0, d.finishParticleSize + V(d.finishParticleSizeVariance)) / 2;
    const ang = (d.angle + V(d.angleVariance) + (this.giroEmisor || 0)) * Math.PI / 180;
    if (d.emitterType === 1) { // radial
      p.rad = d.maxRadius + V(d.maxRadiusVariance); p.ang = ang;
      p.drad = ((d.minRadius || 0) - p.rad) / vida; p.dang = (d.rotatePerSecond + V(d.rotatePerSecondVariance)) * Math.PI / 180;
      p.cx = p.x; p.cy = p.y;
    } else {
      const v = d.speed + V(d.speedVariance);
      p.vx = Math.cos(ang) * v / 2; p.vy = Math.sin(ang) * v / 2;
      p.ra = (d.radialAcceleration + V(d.radialAccelVariance)) / 2; p.ta = (d.tangentialAcceleration + V(d.tangentialAccelVariance)) / 2;
      p.ox = ox; p.oy = oy;
    }
    this.p.push(p);
  }
  alActualizar(dt) {
    const d = this.d;
    if (this.emitiendo) {
      this.acum += dt * this.tasa;
      while (this.acum >= 1 && this.p.length < this.max) { this._emitir(); this.acum--; }
      if (this.p.length >= this.max) this.acum = 0;
      this.tVida += dt;
      if (this.dur > 0 && this.tVida >= this.dur) this.emitiendo = false;
    }
    const gx = (d.gravityx || 0) / 2, gy = (d.gravityy || 0) / 2;
    for (let i = this.p.length - 1; i >= 0; i--) {
      const p = this.p[i]; p.t += dt;
      if (p.t >= p.vida) { this.p.splice(i, 1); continue; }
      if (p.rad !== undefined) { p.ang += p.dang * dt; p.rad += p.drad * dt; p.x = p.cx - Math.cos(p.ang) * p.rad / 2; p.y = p.cy - Math.sin(p.ang) * p.rad / 2; }
      else {
        let rx = p.x - p.ox, ry = p.y - p.oy; const l = Math.hypot(rx, ry) || 1; rx /= l; ry /= l;
        p.vx += (rx * p.ra - ry * p.ta + gx) * dt; p.vy += (ry * p.ra + rx * p.ta + gy) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    }
    if (this.autoQuitar && !this.emitiendo && !this.p.length) this.sacar();
  }
  // sin la matriz propia: las partículas viven en el espacio del padre
  dibujar(pm, op, cr, cg, cb) {
    if (!this.vis || !this.f) return;
    const f = this.f, tw = f.tx.w, th = f.tx.h, xs = new Float32Array(8), uv = new Float32Array(8);
    const u0 = f.x / tw, v0 = f.y / th, u1 = (f.x + (f.rot ? f.h : f.w)) / tw, v1 = (f.y + (f.rot ? f.w : f.h)) / th;
    if (!f.rot) uv.set([u0, v0, u1, v0, u0, v1, u1, v1]); else uv.set([u1, v0, u1, v1, u0, v0, u0, v1]);
    const tint = this.tinte;
    for (const p of this.p) {
      const k = p.t / p.vida, s = p.s0 + (p.s1 - p.s0) * k, rot = -(p.r0 + (p.r1 - p.r0) * k) * Math.PI / 180;
      let r = p.c0[0] + (p.c1[0] - p.c0[0]) * k, g = p.c0[1] + (p.c1[1] - p.c0[1]) * k, b = p.c0[2] + (p.c1[2] - p.c0[2]) * k, a = p.c0[3] + (p.c1[3] - p.c0[3]) * k;
      if (tint) { r = tint[0] / 255; g = tint[1] / 255; b = tint[2] / 255; }
      const h = s / 2, c = Math.cos(rot) * h, sn = Math.sin(rot) * h;
      const pts = [[-c - -sn, -sn + -c], [c - -sn, sn + -c]];
      const P = (i, lx, ly) => { const X = p.x + lx * Math.cos(rot) - ly * Math.sin(rot), Y = p.y + lx * Math.sin(rot) + ly * Math.cos(rot); xs[i] = pm[0] * X + pm[2] * Y + pm[4]; xs[i + 1] = pm[1] * X + pm[3] * Y + pm[5]; };
      P(0, -h, h); P(2, h, h); P(4, -h, -h); P(6, h, -h);
      const o = GD.clamp(a, 0, 1) * op;
      GD.R.quad(f.tx, this.add, 0, xs, uv, GD.col(GD.clamp(r, 0, 1) * cr, GD.clamp(g, 0, 1) * cg, GD.clamp(b, 0, 1) * cb, o));
      void pts;
    }
  }
}
GD.Particulas = Particulas;

// onda circular (CCCircleWave del juego: anillos de portales, monedas, muerte)
class Onda extends GD.Nodo {
  constructor(dur, r0, r1, rgb, relleno = false, grosor = 2) { super(); this.dur = dur; this.r0 = r0; this.r1 = r1; this.t = 0; this.color(rgb); this.relleno = relleno; this.grosor = grosor; this.ax = this.ay = 0; this.curva = GD.E.out(2); }
  alActualizar(dt) { this.t += dt; if (this.t >= this.dur) this.sacar(); }
  pintar(w, o, r, g, b) {
    const k = this.curva(Math.min(1, this.t / this.dur)), rad = this.r0 + (this.r1 - this.r0) * k, a = o * (1 - k);
    const n = 32, xs = new Float32Array(8), uv = new Float32Array(8).fill(0.5), col = GD.col(r, g, b, a);
    const P = (i, x, y) => { xs[i] = w[0] * x + w[2] * y + w[4]; xs[i + 1] = w[1] * x + w[3] * y + w[5]; };
    const ri = this.relleno ? 0 : Math.max(0, rad - this.grosor);
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      P(0, Math.cos(a0) * rad, Math.sin(a0) * rad); P(2, Math.cos(a1) * rad, Math.sin(a1) * rad);
      P(4, Math.cos(a0) * ri, Math.sin(a0) * ri); P(6, Math.cos(a1) * ri, Math.sin(a1) * ri);
      GD.R.quad(GD.R.blanco, true, 0, xs, uv, col);
    }
  }
}
GD.Onda = Onda;

// estela del jugador (CCMotionStreak del juego): una cinta que sigue al jugador y se desvanece;
// la de la onda es una línea sólida que no se borra mientras dura el modo
class Estela {
  constructor(vida = 0.3, ancho = 10, solida = false) { this.p = []; this.vida = vida; this.ancho = ancho; this.solida = solida; this.activa = false; this.f = GD.T.m(`streak_${String(GD.perfil.estela || 1).padStart(2, '0')}_001.png`) || GD.T.m('streak_01_001.png'); }
  agregar(x, y, t) {
    const u = this.p[this.p.length - 1];
    if (u && Math.hypot(u[0] - x, u[1] - y) < 2) { if (this.solida) { u[0] = x; u[1] = y; } return; }
    this.p.push([x, y, t]);
  }
  cortar() { this.p.length = 0; }
  dibujar(w, t, rgb, alfa = 1) {
    if (!this.solida) while (this.p.length && t - this.p[0][2] > this.vida) this.p.shift();
    if (this.p.length > 2000) this.p.splice(0, this.p.length - 2000);
    const n = this.p.length; if (n < 2) return;
    const xs = new Float32Array(8), uv = new Float32Array(8), f = this.f, R = GD.R;
    const tex = this.solida || !f ? R.blanco : f.tx;
    const u0 = f ? f.x / f.tx.w : 0.5, u1 = f ? (f.x + (f.rot ? f.h : f.w)) / f.tx.w : 0.5, v0 = f ? f.y / f.tx.h : 0.5, v1 = f ? (f.y + (f.rot ? f.w : f.h)) / f.tx.h : 0.5;
    for (let i = 1; i < n; i++) {
      const a = this.p[i - 1], b = this.p[i];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const ka = this.solida ? 1 : Math.max(0, 1 - (t - a[2]) / this.vida), kb = this.solida ? 1 : Math.max(0, 1 - (t - b[2]) / this.vida);
      const wa = this.ancho / 2 * (this.solida ? 1 : ka), wb = this.ancho / 2 * (this.solida ? 1 : kb);
      const P = (k, x, y) => { xs[k] = w[0] * x + w[2] * y + w[4]; xs[k + 1] = w[1] * x + w[3] * y + w[5]; };
      P(0, a[0] - dy * wa, a[1] + dx * wa); P(2, b[0] - dy * wb, b[1] + dx * wb); P(4, a[0] + dy * wa, a[1] - dx * wa); P(6, b[0] + dy * wb, b[1] - dx * wb);
      if (tex === R.blanco) uv.fill(0.5); else uv.set([u0, v0, u0, v0, u1, v1, u1, v1]);
      const al = 255 * alfa * (this.solida ? 1 : (ka + kb) / 2);
      R.quad(tex, true, 0, xs, uv, GD.col(rgb[0], rgb[1], rgb[2], al));
    }
  }
}
GD.Estela = Estela;
