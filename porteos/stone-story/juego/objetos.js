// Prefabs del juego hechos objetos: arbol de GameObjects con sus componentes de dibujo y animacion.
'use strict';
const Obj = (() => {
  const O = {};
  const porComp = new Map(); // id de componente -> [objeto, comp]

  O.crear = (id, padre) => {
    const e = Datos.prefabs[id];
    if (!e) return null;
    const o = { id, n: e.n, activo: !e.off, p: e.p ? e.p.slice() : [0, 0, 0], padre: padre || null, hijos: [], comps: [] };
    for (const c of e.c) {
      const k = Object.assign({}, c);
      o.comps.push(k);
      porComp.set(c._i, [o, k]);
    }
    for (const h of e.h || []) { const x = O.crear(h, o); if (x) o.hijos.push(x); }
    return o;
  };
  O.desdeRuta = (ruta, padre) => { const id = Datos.prefab(ruta); return id ? O.crear(id, padre) : null; };
  O.comp = (o, clase) => o.comps.find((c) => c._c === clase);
  O.compDe = (o, ...clases) => o.comps.find((c) => clases.includes(c._c));
  O.ref = (r) => (r ? porComp.get(r.slice(1)) : null); // '@r123' de componente -> [obj, comp]
  O.buscar = (o, nombre) => {
    if (o.n === nombre) return o;
    for (const h of o.hijos) { const r = O.buscar(h, nombre); if (r) return r; }
    return null;
  };
  O.recorrer = (o, f) => { f(o); for (const h of o.hijos) O.recorrer(h, f); };
  O.mundo = (o) => { let x = 0, y = 0, z = 0; for (let q = o; q; q = q.padre) { x += q.p[0]; y += q.p[1]; z += q.p[2]; } return [x, y, z]; };

  // ---- sprites ----
  const SPRITES = ['AsciiSprite', 'SeasonalSprite', 'MultilayerSprite', 'TilingAsciiSprite', 'CloudSprite', 'AsciiSpriteChain',
    'AsciiSpritePPShiny', 'AsciiSpritePPRainbow', 'BulletSpriteRenderer', 'AuraCircleSprite'];
  O.sprite = (o) => o.comps.find((c) => SPRITES.includes(c._c) || (c.source !== undefined && c.pivotX !== undefined));
  O.datos = (s) => {
    if (!s._d) s._d = s.source ? Ascii.datos(s.source, s.pageLoadStartIndex || 0, s.pageLoadCount === undefined ? 0 : s.pageLoadCount, s.stringReplacements) : { paginas: [], cuadros: [] };
    return s._d;
  };
  O.colorDe = (s) => {
    const c = s._color || s.colorOverride;
    const blanco = !c || (c[0] >= 0.999 && c[1] >= 0.999 && c[2] >= 0.999);
    if (blanco) {
      const m = s.colorMode === 1 ? Ascii.GRIS : s.colorMode === 2 ? Ascii.GRIS_OSC : null;
      return { color: m, mult: m ? [m[0] / 255, m[1] / 255, m[2] / 255] : null };
    }
    return { color: color01(c), forzar: true };
  };

  // dibuja el sprite s en la celda (x, y) de pantalla (el punto de pivote)
  O.dibujarSprite = (s, x, y, extra) => {
    const d = O.datos(s);
    if (!d.paginas.length) return;
    const k = Math.min(s._cuadro || 0, d.paginas.length - 1);
    const p = d.paginas[k];
    const fx = !!(s._flipX ^ (extra && extra.fx)), fy = !!s._flipY;
    const px = s.pivotX || 0, py = s.pivotY || 0;
    const ox = fx ? x + px : x - px, oy = fy ? y + py : y - py;
    const col = O.colorDe(s);
    const op = { fx, fy, color: col.color, forzar: col.forzar, mult: col.mult, negro: !!s.blackBackground };
    if (extra && extra.color) { op.color = extra.color; op.forzar = true; }
    if (s._c === 'TilingAsciiSprite' || s._c === 'CloudSprite') {
      const W = s.copyRendererWidth ? Pantalla.cols : (s.width || p.w);
      const sx = (((s._scrollX || 0) % p.w) + p.w) % p.w;
      for (let t = -sx; t < W; t += p.w) Ascii.dibujar(p, ox + t, oy, op);
    } else Ascii.dibujar(p, ox, oy, op);
  };

  // ---- animaciones (AsciiAnimation / ColorAnimation / chains), avanzan por pasos ----
  O.iniciarAnim = (o) => {
    O.recorrer(o, (q) => {
      for (const c of q.comps) {
        if (c._c === 'AsciiAnimation' || c._c === 'MultilayerAnimation' || c._c === 'AsciiAnimationChain') {
          c._t = c.randomStartTime ? azar() * (c.duration || 1) : 0;
          c._play = !!c.playOnStart;
        }
        if (c._c === 'ColorAnimation') c._t = 0;
      }
    });
  };
  O.playAnim = (o, desde0 = true) => {
    const a = o.comps.find((c) => c._c === 'AsciiAnimation' || c._c === 'MultilayerAnimation');
    if (a) { a._play = true; if (desde0) a._t = 0; a._fin = false; }
    return a;
  };
  function curva(c, t) {
    const k = c && c.m_Curve;
    if (!k || !k.length) return t;
    if (t <= k[0].time) return k[0].value;
    for (let i = 1; i < k.length; i++) {
      if (t <= k[i].time) {
        const a = k[i - 1], b = k[i], u = (t - a.time) / Math.max(1e-6, b.time - a.time);
        const dt = b.time - a.time, u2 = u * u, u3 = u2 * u;
        return (2 * u3 - 3 * u2 + 1) * a.value + (u3 - 2 * u2 + u) * (a.outSlope || 0) * dt + (-2 * u3 + 3 * u2) * b.value + (u3 - u2) * (b.inSlope || 0) * dt;
      }
    }
    return k[k.length - 1].value;
  }
  O.paso = (o, dt) => {
    if (!o.activo) return;
    for (const c of o.comps) {
      if ((c._c === 'AsciiAnimation' || c._c === 'MultilayerAnimation') && c._play) {
        const s = c.Sprite ? (O.ref(c.Sprite) || [])[1] : O.sprite(o);
        if (!s) continue;
        const d = O.datos(s);
        const n = d.cuadros.length;
        if (!n) continue;
        const dur = c.framesPerSecond > 0 ? n / c.framesPerSecond : (c.duration || 1);
        c._t += dt;
        if (c._t >= dur) {
          if (c.looping) c._t %= dur; else { c._t = dur - 1e-6; c._play = false; c._fin = true; }
        }
        s._cuadro = d.cuadros[Math.min(n - 1, Math.floor(c._t / dur * n))];
      } else if (c._c === 'ColorAnimation') {
        const dur = c.duration || 1;
        c._t = (c._t + dt) % dur;
        const u = Math.max(0, Math.min(1, curva(c.curve, c._t / dur)));
        const a = c.startColor || [1, 1, 1, 1], b = c.endColor || [1, 1, 1, 1];
        const s = O.sprite(o);
        if (s) s._color = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, 1];
      } else if (c._c === 'AsciiAnimationChain' && c._play) {
        // va pasando por las animaciones hijas, una despues de otra
        const lista = (c.animations || []).map((r) => O.ref(r)).filter(Boolean);
        if (!lista.length) continue;
        if (c._k === undefined) { c._k = 0; for (const [q] of lista) q.activo = false; }
        const [q, an] = lista[c._k];
        q.activo = true;
        if (!an._play && !an._fin) { an._play = true; an._t = 0; }
        if (an._fin) { an._fin = false; q.activo = false; c._k = (c._k + 1) % lista.length; if (!c.looping && c._k === 0) c._play = false; }
      } else if (c._c === 'CloudSprite') {
        c._fx = (c._fx || 0) + (c.speedX || 0) * dt;
      }
    }
    for (const h of o.hijos) O.paso(h, dt);
  };
  return O;
})();
