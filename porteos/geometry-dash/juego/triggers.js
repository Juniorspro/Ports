// Triggers (EffectGameObject y GJEffectManager): se activan al pasar el jugador por su x, al
// tocarlos (11) o cuando otro los "spawnea" (62). Las animaciones son datos (no funciones): así el
// estado entero se guarda y se restaura, como hace el juego con los checkpoints de práctica.
'use strict';
const TR = GD.TR = {};
// trigger de color viejo → canal
const COLOR_FIJO = { 29: 1000, 30: 1001, 104: 1002, 105: 1004, 221: 1, 717: 2, 718: 3, 743: 4, 744: 1003, 900: 1009, 915: 1002 };
TR.def = {};
for (const id in COLOR_FIJO) TR.def[id] = 'color';
Object.assign(TR.def, {
  22: 'entrada', 23: 'entrada', 24: 'entrada', 25: 'entrada', 26: 'entrada', 27: 'entrada', 28: 'entrada', 55: 'entrada', 56: 'entrada', 57: 'entrada', 58: 'entrada', 59: 'entrada',
  899: 'color', 901: 'mover', 1616: 'parar', 1006: 'pulso', 1007: 'alpha', 1049: 'toggle', 1268: 'spawn', 1346: 'rotar', 1347: 'seguir',
  1520: 'temblor', 1585: 'animar', 1595: 'tocar', 1611: 'contar', 1811: 'contarYa', 1817: 'recoger', 1814: 'seguirY', 1815: 'colision',
  1812: 'alMorir', 1818: 'fondoOn', 1819: 'fondoOff', 1612: 'ocultarJ', 1613: 'mostrarJ', 32: 'estelaOn', 33: 'estelaOff', 1932: 'controlJ',
  1913: 'camZoom', 1914: 'camEstatica', 1916: 'camOffset', 2015: 'camRotar', 2062: 'camBorde', 2925: 'camModo', 1917: 'reversa', 2900: 'rotarGameplay',
  1934: 'cancion', 3602: 'sfx', 3603: 'sfxEdit', 1935: 'escalaTiempo', 2066: 'gravedad', 3600: 'fin', 2063: 'checkpoint', 3022: 'teleport',
  1912: 'azar', 2068: 'azarAvanzado', 3607: 'secuencia', 3614: 'tiempo', 3615: 'eventoTiempo', 3617: 'controlTiempo', 3619: 'itemEdit',
  3620: 'itemCompare', 3641: 'persistente', 3618: 'reset', 2067: 'escalar', 3006: 'nada', 3007: 'nada', 3008: 'nada', 3009: 'nada', 3010: 'nada',
  3011: 'nada', 3012: 'nada', 3013: 'nada', 3014: 'nada', 3015: 'nada', 3024: 'nada', 3016: 'nada', 3660: 'nada', 3661: 'nada',
  3032: 'nada', 3033: 'keyframes', 2903: 'nada', 2904: 'nada', 2905: 'nada', 2907: 'nada', 2909: 'nada', 2910: 'nada',
  2911: 'nada', 2912: 'nada', 2913: 'nada', 2914: 'nada', 2915: 'nada', 2916: 'nada', 2917: 'nada', 2919: 'nada',
  2920: 'nada', 2921: 'nada', 2922: 'nada', 2923: 'nada', 3021: 'nada', 3029: 'nada', 3030: 'nada', 3031: 'nada',
  2999: 'nada', 3606: 'nada', 3612: 'nada', 1931: 'fin', 3604: 'nada', 3605: 'nada', 3608: 'spawnParticula', 3609: 'nada', 3640: 'nada',
  3613: 'nada', 3662: 'nada', 1915: 'nada', 2899: 'nada', 3655: 'nada', 2901: 'nada',
});
TR.esTrigger = o => !!TR.def[o.id];
TR.porPosicion = o => !(o.raw[11] == 1) && !(o.raw[62] == 1);

// ---------- estado (todo datos) ----------
TR.reiniciar = function (p) {
  p.tr = {
    sig: 0, acciones: [], alpha: {}, apagados: {}, items: {}, spawns: [], contadores: [], colisiones: [], alMorir: [], tocar: [],
    seguirY: [], temblor: null, timers: {}, eventos: [], secuencias: {}, camZoom: 1, camOff: { x: 0, y: 0 }, camRot: 0, escalaT: 1, hechos: {},
    escuchas: [], opc: {}, puntos: 0, medioY: 0,
  };
  if (TR.pararSonidos) TR.pararSonidos();
  p.camOff = null; p.zoom = 1; p.camRot = 0;
  p.bloquesCol = {}; for (const o of p.objs) if (o.id === 1816) (p.bloquesCol[o.raw[80] | 0] = p.bloquesCol[o.raw[80] | 0] || []).push(o);
  // bloques que miran al jugador: estado (3640) y toque (3643)
  p.bloquesJ = p.objs.filter(o => o.id === 3640 || o.id === 3643); for (const o of p.bloquesJ) o.dentro = false;
};
// lo que quedó atrás al empezar desde un punto: se aplica al instante
TR.saltarHasta = function (p, x) {
  const t = p.tr, L = p.triggers;
  while (t.sig < L.length && L[t.sig].x < x) { const o = L[t.sig++]; if (TR.porPosicion(o)) TR.activar(p, o, null); }
  for (const a of t.acciones) { a.t = a.dur; TR.pasoAccion(p, a); }
  t.acciones = t.acciones.filter(a => a.siempre);
};

// ---------- bucle ----------
TR.paso = function (p, h) {
  const t = p.tr, j = p.j, L = p.triggers;
  while (t.sig < L.length && L[t.sig].x <= j.x) { const o = L[t.sig++]; if (TR.porPosicion(o)) TR.activar(p, o, j); }
  h *= t.escalaT;
  for (let i = 0; i < t.acciones.length; i++) {
    const a = t.acciones[i]; a.t += h; TR.pasoAccion(p, a, h);
    if (a.t >= a.dur && !a.siempre) { TR.finAccion(p, a); t.acciones.splice(i--, 1); }
  }
  // los spawns que aparecen mientras se procesan esperan al paso siguiente (si no, un bucle no termina)
  if (t.spawns.length) { const ahora = t.spawns; t.spawns = []; const listos = []; for (const s of ahora) { s.t -= h; if (s.t <= 0) listos.push(s); else t.spawns.push(s); } for (const s of listos) TR.spawnear(p, s); }
  for (const s of t.seguirY) TR.pasoSeguirY(p, s, h);
  if (t.colisiones.length) TR.pasoColisiones(p);
  if (TR.pasoBloquesJugador) TR.pasoBloquesJugador(p);
  for (const k in t.timers) { const tm = t.timers[k]; if (!tm.pausa) { tm.v += h * tm.mod * (tm.atras ? -1 : 1); TR.revisarTiempo(p, +k); } }
};
TR.cuadro = function (p, dt) {
  const t = p.tr;
  let tx = 0, ty = 0;
  if (t.temblor) { t.temblor.t += dt; if (t.temblor.t >= t.temblor.dur) t.temblor = null; else { tx = (Math.random() * 2 - 1) * t.temblor.f; ty = (Math.random() * 2 - 1) * t.temblor.f; } }
  p.camOff = { x: t.camOff.x + tx, y: t.camOff.y + ty };
  p.zoom = t.camZoom; p.camRot = t.camRot;
  if (GD.Shaders) GD.Shaders.cuadro(p, dt);
  if (TR.pasoSonidos) TR.pasoSonidos(p);
  if (TR.pasoAreas && ((t.areas && t.areas.length) || (t.entradas && t.entradas.length) || p._areaTocados && p._areaTocados.size)) TR.pasoAreas(p);
};
const curvas = {};
TR.curva = (tipo, tasa) => { const k = tipo + ',' + tasa; return curvas[k] || (curvas[k] = GD.E.gd(tipo, tasa)); };
TR.k = a => a.dur > 0 ? TR.curva(a.e, a.r)(Math.min(1, a.t / a.dur)) : 1;
// una acción nueva (animación de un trigger); dur 0: se aplica ya
TR.accion = function (p, a) {
  a.t = 0; a.prev = 0; if (a.e === undefined) a.e = 0; if (a.r === undefined) a.r = 2;
  if (!(a.dur > 0)) { a.dur = 0; TR.pasoAccion(p, a, 0); TR.finAccion(p, a); return; }
  p.tr.acciones.push(a);
};
TR.grupo = (p, g) => p.grupos[g] || [];
TR.centro = function (p, g) { const l = TR.grupo(p, g); if (!l.length) return null; let x = 0, y = 0; for (const o of l) { x += o.cx; y += o.cy; } return [x / l.length, y / l.length]; };
TR.moverGrupo = function (p, g, dx, dy) {
  if (!dx && !dy) return;
  for (const o of TR.grupo(p, g)) { o.dx += dx; o.dy += dy; p.moverSeccion(o); }
  // el jugador apoyado en algo que se mueve se va con eso (plataformas)
  for (const j of [p.j, p.j2]) if (j && j.suelo && j.sobre && j.sobre.grupos && j.sobre.grupos.includes(g)) { j.x += dx; j.y += dy; }
};
TR.opGrupos = function (p, o) { let v = 1; if (o.grupos) for (const g of o.grupos) { const a = p.tr.alpha[g]; if (a !== undefined) v *= a; } return v; };

// paso de cada tipo de acción (sin funciones guardadas: todo está en "a")
TR.pasoAccion = function (p, a) {
  const k = TR.k(a), dk = k - a.prev; a.prev = k;
  switch (a.k) {
    case 'mover': {
      let dx = a.mx * dk, dy = a.my * dk;
      if (a.lx || a.ly) { const j = p.j; if (a.lx) dx = (j.x - a.jx) * a.modX; if (a.ly) dy = (j.y - a.jy) * a.modY; a.jx = j.x; a.jy = j.y; }
      TR.moverGrupo(p, a.g, dx, dy); break;
    }
    case 'rotar': {
      const da = a.grados * dk; if (!da) break;
      const c = a.cen ? TR.centro(p, a.cen) : null, ang = -da * Math.PI / 180, cs = Math.cos(ang), sn = Math.sin(ang);
      for (const o of TR.grupo(p, a.g)) {
        if (c && !(a.cen && o.grupos && o.grupos.includes(a.cen))) { const x = o.cx - c[0], y = o.cy - c[1]; o.dx += c[0] + x * cs - y * sn - o.cx; o.dy += c[1] + x * sn + y * cs - o.cy; p.moverSeccion(o); }
        if (!a.fija) o.drot += da;
      }
      break;
    }
    case 'alpha': { const v = a.ini + (a.fin - a.ini) * k; p.tr.alpha[a.g] = v; for (const o of TR.grupo(p, a.g)) o.op = TR.opGrupos(p, o); break; }
    case 'seguir': { const c = TR.centro(p, a.sg); if (!c) break; if (a.c0) TR.moverGrupo(p, a.g, (c[0] - a.c0[0]) * a.mx, (c[1] - a.c0[1]) * a.my); a.c0 = c; break; }
    case 'pulsoG': { a.pu.t = a.t; break; }
    case 'zoom': { p.tr.camZoom = a.ini + (a.fin - a.ini) * k; break; }
    case 'camOff': { p.tr.camOff.x = a.ix + (a.fx - a.ix) * k; p.tr.camOff.y = a.iy + (a.fy - a.iy) * k; break; }
    case 'camRot': { p.tr.camRot = a.ini + (a.fin - a.ini) * k; break; }
    case 'tiempoEsc': { p.tr.escalaT = a.ini + (a.fin - a.ini) * k; break; }
    case 'kf': TR.pasoKeyframes(p, a); break;
    case 'medio': p.tr.medioY = a.ini + (a.fin - a.ini) * k; break;
    case 'areaEd': TR.pasoAreaEd(p, a, k); break;
    case 'sh': GD.Shaders.paso(p, a, k); break;
    case 'escalar': {
      const l = TR.grupo(p, a.g), c = a.cen ? TR.centro(p, a.cen) : null;
      const f = 1 + (a.sx - 1) * k, g = 1 + (a.sy - 1) * k, fp = 1 + (a.sx - 1) * a.prevK, gp = 1 + (a.sy - 1) * a.prevK; a.prevK = k;
      for (const o of l) {
        o.esx = (o.esx || 1) * f / fp; o.esy = (o.esy || 1) * g / gp;
        if (c && !a.soloMover) { const x = o.cx - c[0], y = o.cy - c[1]; o.dx += x * (f / fp - 1); o.dy += y * (g / gp - 1); p.moverSeccion(o); }
      }
      break;
    }
  }
};
TR.finAccion = function (p, a) {
  if (a.k === 'pulsoG') { for (const o of TR.grupo(p, a.g)) if (o.pulsos) { o.pulsos = o.pulsos.filter(x => x !== a.pu); if (!o.pulsos.length) o.pulsos = null; } }
};

// ---------- activación ----------
TR.activar = function (p, o, j) {
  const f = TR.H[TR.def[o.id]]; if (!f) return;
  f(p, o, o.raw, j || p.j);
};
// tocado por el jugador (triggers con "touch triggered")
TR.tocado = function (p, o, j) { if (p.tr.hechos[o.i] && o.raw[87] != 1) return; p.tr.hechos[o.i] = 1; TR.activar(p, o, j); };
// spawn de un grupo: activa los triggers del grupo (los que esperan spawn; con multi, aunque ya se hayan usado)
TR.spawnearGrupo = function (p, g, demora = 0, ordenado = false) {
  if (!g) return;
  if (demora > 0) { p.tr.spawns.push({ t: demora, g, ordenado }); return; }
  TR.spawnear(p, { g, ordenado });
};
// un grupo que se vuelve a spawnear dentro de su propia cadena (bucles de spawn con demora 0) pasa al
// paso siguiente, como hace el juego, en vez de colgarse
const _enCurso = new Set();
TR.spawnear = function (p, s) {
  if (_enCurso.has(s.g)) { p.tr.spawns.push({ t: 0, g: s.g, ordenado: s.ordenado }); return; }
  _enCurso.add(s.g);
  try { TR._spawnear(p, s); } finally { _enCurso.delete(s.g); }
};
TR._spawnear = function (p, s) {
  // un spawn sólo activa los triggers marcados "spawn triggered" (62); sin "multi" (87), una vez
  const l = TR.grupo(p, s.g).filter(o => TR.def[o.id] && o.raw[62] == 1).sort((a, b) => a.x - b.x);
  const x0 = l.length ? l[0].x : 0;
  for (const o of l) {
    if (p.tr.hechos[o.i] && o.raw[87] != 1) continue;
    p.tr.hechos[o.i] = 1;
    // 2.2 "spawn ordered": la distancia en x entre triggers se vuelve demora
    if (s.ordenado && o.x > x0) { p.tr.spawns.push({ t: (o.x - x0) / GD.O.UPS[p.j.vel], uno: o.i }); continue; }
    TR.activar(p, o, p.j);
  }
  if (s.uno !== undefined) { const o = p.objs[s.uno]; if (o) TR.activar(p, o, p.j); }
};
TR.prender = function (p, g, on) { p.tr.apagados[g] = !on; for (const o of TR.grupo(p, g)) { o.activo = on; o.oculto = !on; } };
TR.activarGrupos = function (p, o, deAro) {
  const g = o.raw[51] | 0; if (!g) return;
  if (deAro) { TR.prender(p, g, o.raw[56] == 1); return; }
  TR.spawnearGrupo(p, g, 0);
};

// ---------- manejadores ----------
const H = TR.H = {};
const n = (v, d = 0) => v === undefined || v === '' ? d : +v;
H.nada = () => { };
// efectos de entrada de la 1.9: cómo aparecen los objetos por los bordes de la pantalla
H.entrada = function (p, o) { p.efEntrada = o.id; };
H.color = function (p, o, r) {
  const canal = COLOR_FIJO[o.id] || (r[23] | 0) || 1;
  const dest = { r: n(r[7], 255), g: n(r[8], 255), b: n(r[9], 255), op: n(r[35], 1), pc: r[15] == 1 ? 1 : r[16] == 1 ? 2 : -1 };
  if (r[17] !== undefined) dest.add = r[17] == 1;
  if (r[50]) { dest.copia = +r[50]; dest.hsv = r[49]; dest.copiaOp = r[60] == 1; }
  p.cols.cambiar(canal, dest, n(r[10], 0.5));
};
H.mover = function (p, o, r, j) {
  const g = r[51] | 0; if (!g) return;
  let mx = n(r[28]), my = n(r[29]);
  if (r[100] == 1 && r[71]) { // 2.2: mover hacia un grupo
    const dst = TR.centro(p, r[71] | 0), org = r[395] ? TR.centro(p, r[395] | 0) : TR.centro(p, g); if (!dst || !org) return;
    const modo = r[101] | 0; mx = modo === 2 ? 0 : dst[0] - org[0]; my = modo === 1 ? 0 : dst[1] - org[1];
  }
  TR.accion(p, { k: 'mover', g, mx, my, dur: n(r[10], 0.5), e: r[30] | 0, r: n(r[85], 2), lx: r[58] == 1, ly: r[59] == 1, modX: n(r[143], 1), modY: n(r[144], 1), jx: j.x, jy: j.y, de: g });
};
H.parar = function (p, o, r) {
  const g = r[51] | 0, t = p.tr; if (!g) return;
  // para lo que movía ese grupo y lo que esté por spawnear de él
  t.acciones = t.acciones.filter(a => a.de !== g && a.g !== g);
  t.spawns = t.spawns.filter(s => s.g !== g);
};
H.pulso = function (p, o, r) {
  const fi = n(r[45]), hold = n(r[46]), fo = n(r[47]);
  const pu = { t: 0, fi, hold, fo, rgb: [n(r[7], 255), n(r[8], 255), n(r[9], 255)] };
  if (r[48] == 1) { pu.hsv = GD.N.hsv(r[49]); const cid = r[50] | 0; if (cid) { const v = p.cols.valor(cid); pu.copiaRGB = [v.r, v.g, v.b]; } }
  const dest = r[51] | 0;
  if (r[52] == 1) {
    pu.soloBase = r[65] == 1; pu.soloDetalle = r[66] == 1;
    for (const ob of TR.grupo(p, dest)) { if (r[86] == 1) ob.pulsos = []; (ob.pulsos = ob.pulsos || []).push(pu); }
    TR.accion(p, { k: 'pulsoG', g: dest, pu, dur: fi + hold + fo });
  } else { pu.canal = dest || 1; if (r[86] == 1) p.cols.pulsos = p.cols.pulsos.filter(x => x.canal !== pu.canal); p.cols.pulsos.push(pu); }
};
H.alpha = function (p, o, r) {
  const g = r[51] | 0; if (!g) return;
  const ini = p.tr.alpha[g] !== undefined ? p.tr.alpha[g] : 1;
  p.tr.acciones = p.tr.acciones.filter(a => !(a.k === 'alpha' && a.g === g));
  TR.accion(p, { k: 'alpha', g, ini, fin: n(r[35], 1), dur: n(r[10], 0.5), de: g });
};
H.toggle = function (p, o, r) { const g = r[51] | 0; if (g) TR.prender(p, g, r[56] == 1); };
H.spawn = function (p, o, r) {
  const g = r[51] | 0; if (!g) return;
  const dem = n(r[63]) + (r[556] ? (Math.random() * 2 - 1) * +r[556] : 0);
  TR.spawnearGrupo(p, g, Math.max(0, dem), r[441] == 1);
};
H.rotar = function (p, o, r) {
  const g = r[51] | 0; if (!g) return;
  TR.accion(p, { k: 'rotar', g, cen: r[71] | 0, grados: n(r[68]) + 360 * n(r[69]), fija: r[70] == 1, dur: n(r[10], 0.5), e: r[30] | 0, r: n(r[85], 2), de: g });
};
H.seguir = function (p, o, r) {
  const g = r[51] | 0, sg = r[71] | 0; if (!g || !sg) return;
  TR.accion(p, { k: 'seguir', g, sg, mx: n(r[72], 1), my: n(r[73], 1), dur: n(r[10], 0.5), c0: TR.centro(p, sg), de: g });
};
H.seguirY = function (p, o, r) { const g = r[51] | 0; if (g) p.tr.seguirY.push({ g, vel: n(r[90], 1), dem: n(r[91]), off: n(r[92]), max: n(r[105]), dur: n(r[10]), t: 0 }); };
TR.pasoSeguirY = function (p, s, h) {
  s.t += h; if (s.dur > 0 && s.t > s.dur) return;
  const c = TR.centro(p, s.g); if (!c) return;
  let dy = (p.j.y + s.off - c[1]) * Math.min(1, s.vel * h * 4);
  if (s.max) dy = GD.clamp(dy, -s.max * h * 60, s.max * h * 60);
  TR.moverGrupo(p, s.g, 0, dy);
};
H.temblor = function (p, o, r) { p.tr.temblor = { f: n(r[75], 1), t: 0, dur: n(r[10], 0.5) }; };
H.animar = function (p, o, r) { for (const ob of TR.grupo(p, r[51] | 0)) { ob.anim = r[76] | 0; if (ob.pdef) { ob.animado = true; if (ob.emisor) ob.emisor.reiniciar(); } } };
// ---------- keyframes (3032 los puntos, 3033 el trigger que los recorre) ----------
// los puntos de una animación son los objetos 3032 del grupo 76 (por su orden, 374); cada uno guarda
// posición, giro y escala, cuánto tarda hasta el siguiente (10), con qué curva (30/85) y qué grupo
// spawnear al llegar (71, con demora 557). El grupo 51 se mueve, gira y escala como el recorrido,
// alrededor del grupo padre 71 del trigger.
H.keyframes = function (p, o, r) {
  const g = r[51] | 0, ag = r[76] | 0; if (!g || !ag) return;
  const kfs = TR.grupo(p, ag).filter(x => x.id === 3032).sort((a, b) => (+a.raw[374] || 0) - (+b.raw[374] || 0));
  if (kfs.length < 2) return;
  const lazo = kfs.some(k => k.raw[376] == 1), tm = n(r[520], 1) || 1;
  const durs = kfs.map(k => Math.max(0, n(k.raw[10], 0)) * tm);
  const total = (lazo ? durs : durs.slice(0, -1)).reduce((a, b) => a + b, 0);
  if (!(total > 0) && !lazo) return;
  TR.accion(p, { k: 'kf', g, cen: r[71] | 0, kfs: kfs.map(k => k.i), durs, lazo, total, dur: lazo ? Infinity : total, siempre: lazo,
    mx: n(r[521], 1), my: n(r[545], 1), mr: n(r[522], 1), msx: n(r[523], 1), msy: n(r[546], 1), seg: -1, px: 0, py: 0, pr: 0, psx: 1, psy: 1, de: g });
};
// estado del recorrido en el tiempo t: posición, giro y escala relativos al primer punto
TR.estadoKf = function (p, a, t) {
  const K = a.kfs.map(i => p.objs[i]), n0 = K.length, segs = a.lazo ? n0 : n0 - 1;
  if (a.lazo && a.total > 0) t = t % a.total; else t = Math.min(t, a.total);
  let i = 0; while (i < segs - 1 && t >= a.durs[i]) { t -= a.durs[i]; i++; }
  const A = K[i], B = K[(i + 1) % n0], d = a.durs[i];
  let k = d > 0 ? Math.min(1, t / d) : 1; k = TR.curva(A.raw[30] | 0, n(A.raw[85], 2))(k);
  // giro: el más corto salvo que el punto pida horario/antihorario (536) y vueltas extra (537)
  let r0 = A.rot, r1 = B.rot, dr = r1 - r0;
  const sentido = B.raw[536] | 0, vueltas = (B.raw[537] | 0) * 360;
  if (sentido === 1) { while (dr < 0) dr += 360; dr += vueltas; } else if (sentido === 2) { while (dr > 0) dr -= 360; dr -= vueltas; }
  const s0 = K[0], esc = x => (x.raw[32] !== undefined ? +x.raw[32] : 1);
  const sxA = esc(A) * (A.raw[128] !== undefined ? +A.raw[128] : 1), syA = esc(A) * (A.raw[129] !== undefined ? +A.raw[129] : 1);
  const sxB = esc(B) * (B.raw[128] !== undefined ? +B.raw[128] : 1), syB = esc(B) * (B.raw[129] !== undefined ? +B.raw[129] : 1);
  const sx0 = esc(s0) * (s0.raw[128] !== undefined ? +s0.raw[128] : 1) || 1, sy0 = esc(s0) * (s0.raw[129] !== undefined ? +s0.raw[129] : 1) || 1;
  return { seg: i, x: (A.x + (B.x - A.x) * k - s0.x) * a.mx, y: (A.y + (B.y - A.y) * k - s0.y) * a.my, r: (r0 + dr * k - s0.rot) * a.mr,
    sx: 1 + ((sxA + (sxB - sxA) * k) / sx0 - 1) * a.msx, sy: 1 + ((syA + (syB - syA) * k) / sy0 - 1) * a.msy };
};
TR.pasoKeyframes = function (p, a) {
  if (!isFinite(a.t)) return; // al saltar hasta un punto, un lazo sigue desde donde esté
  const e = TR.estadoKf(p, a, a.t);
  // al pasar por un punto se spawnea su grupo
  if (e.seg !== a.seg) {
    const K = a.kfs.map(i => p.objs[i]);
    if (a.seg >= 0) { const llego = K[(a.seg + 1) % K.length]; if (llego.raw[71]) TR.spawnearGrupo(p, llego.raw[71] | 0, n(llego.raw[557])); }
    else if (K[0].raw[71]) TR.spawnearGrupo(p, K[0].raw[71] | 0, n(K[0].raw[557]));
    a.seg = e.seg;
  }
  const dx = e.x - a.px, dy = e.y - a.py, dr = e.r - a.pr, fx = e.sx / a.psx, fy = e.sy / a.psy;
  a.px = e.x; a.py = e.y; a.pr = e.r; a.psx = e.sx; a.psy = e.sy;
  TR.moverGrupo(p, a.g, dx, dy);
  if (dr || fx !== 1 || fy !== 1) {
    const c = TR.centro(p, a.cen || a.g); if (!c) return;
    const ang = -dr * Math.PI / 180, cs = Math.cos(ang), sn = Math.sin(ang);
    for (const o of TR.grupo(p, a.g)) {
      if (a.cen && o.grupos && o.grupos.includes(a.cen)) { o.drot += dr; o.esx = (o.esx || 1) * fx; o.esy = (o.esy || 1) * fy; continue; }
      const x = (o.cx - c[0]) * fx, y = (o.cy - c[1]) * fy;
      o.dx += c[0] + x * cs - y * sn - o.cx; o.dy += c[1] + x * sn + y * cs - o.cy; o.drot += dr; o.esx = (o.esx || 1) * fx; o.esy = (o.esy || 1) * fy; p.moverSeccion(o);
    }
  }
  if (!a.lazo && a.t >= a.total) { const K = a.kfs.map(i => p.objs[i]), u = K[K.length - 1]; if (u.raw[71] && a.seg !== -2) { TR.spawnearGrupo(p, u.raw[71] | 0, n(u.raw[557])); a.seg = -2; } }
};
// spawn particle (3608): una tanda de las partículas del grupo 51 en el centro del grupo 71
H.spawnParticula = function (p, o, r) {
  const fuente = TR.grupo(p, r[51] | 0).filter(x => x.pdef); if (!fuente.length) return;
  const c = r[71] ? TR.centro(p, r[71] | 0) : [o.cx, o.cy]; if (!c) return;
  const az = v => (Math.random() * 2 - 1) * (+v || 0);
  for (const f of fuente) {
    const e = new GD.EmisorGD(f.pdef);
    e.x = c[0] + n(r[547]) + az(r[549]); e.y = c[1] + n(r[548]) + az(r[550]);
    e.rot = n(r[552]) + az(r[553]) + (r[551] == 1 ? f.rot + f.drot : 0); e.esc = Math.max(0.01, n(r[554], 1) + az(r[555]));
    // una copia que no termina nunca sólo larga una tanda
    if (!(f.pdef.dur > 0)) { e.rafaga = false; e.d = Object.assign({}, f.pdef, { dur: 0 }); }
    p.particulas.push({ e, tinte: f.raw[146] == 1 ? GD.O.colorParte(f, { ct: 'b' }, p.cols).slice(0, 3) : null });
  }
};
H.tocar = function (p, o, r) { const g = r[51] | 0; if (g) p.tr.tocar.push({ g, mantener: r[81] == 1, modo: r[82] | 0, dual: r[89] == 1 }); };
TR.alToque = function (p, abajo, segundo) { // lo llama la partida con cada toque
  for (const t of p.tr.tocar) {
    if (t.dual && segundo === false) continue;
    if (abajo) { if (t.modo === 2) TR.prender(p, t.g, false); else if (t.modo === 1) TR.spawnearGrupo(p, t.g); else TR.prender(p, t.g, p.tr.apagados[t.g] !== false ? true : false); }
    else if (t.mantener) TR.prender(p, t.g, t.modo === 2);
  }
};
H.contar = function (p, o, r) { p.tr.contadores.push({ item: r[80] | 0, n: r[77] | 0, g: r[51] | 0, on: r[56] == 1, multi: r[104] == 1, hecho: false }); TR.revisarContadores(p, r[80] | 0); };
H.contarYa = function (p, o, r) {
  const v = p.tr.items[r[80] | 0] || 0, m = r[77] | 0, cmp = r[88] | 0;
  if ((cmp === 0 && v === m) || (cmp === 1 && v > m) || (cmp === 2 && v < m)) { if (r[56] == 1) TR.spawnearGrupo(p, r[51] | 0); else TR.prender(p, r[51] | 0, false); }
};
TR.revisarContadores = function (p, item) {
  for (const c of p.tr.contadores) if (c.item === item) {
    const v = p.tr.items[item] || 0;
    if (v === c.n && !c.hecho) { c.hecho = true; if (c.on) TR.spawnearGrupo(p, c.g); else TR.prender(p, c.g, false); }
    else if (v !== c.n && c.multi) c.hecho = false;
  }
};
H.recoger = function (p, o, r) {
  const item = r[80] | 0, t = p.tr;
  if (r[449] == 1) t.items[item] = (t.items[item] || 0) * n(r[479], 1);
  else if (r[79] == 1) t.items[item] = n(r[77], 1);
  else t.items[item] = (t.items[item] || 0) + (r[78] == 1 ? -1 : 1) * n(r[77], 1);
  TR.revisarContadores(p, item);
};
// coleccionables que suman a un item (1614 y los de 2.2)
TR.tomarItem = function (p, o) { const item = o.raw[80] | 0; if (!item) return; p.tr.items[item] = (p.tr.items[item] || 0) + (o.raw[78] == 1 ? -1 : 1); TR.revisarContadores(p, item); if (o.raw[51]) TR.prender(p, o.raw[51] | 0, o.raw[56] == 1); };
H.colision = function (p, o, r) { p.tr.colisiones.push({ a: r[80] | 0, b: r[95] | 0, jugadorA: r[138] == 1, jugadorB: r[200] == 1, g: r[51] | 0, on: r[56] == 1, salida: r[93] == 1, estado: false }); };
TR.pasoColisiones = function (p) {
  const cajasDe = id => (p.bloquesCol[id] || []).filter(o => o.activo).map(o => p.caja(o));
  const jc = j => ({ x: j.x, y: j.y, w: j.alto / 2, h: j.alto / 2 });
  for (const c of p.tr.colisiones) {
    let toca = false;
    const A = c.jugadorA ? [jc(p.j)] : cajasDe(c.a), B = c.jugadorB || !c.b ? [jc(p.j)] : cajasDe(c.b);
    for (const a of A) { for (const b of B) if (!b.circ && !a.circ && Math.abs(a.x - b.x) < a.w + b.w && Math.abs(a.y - b.y) < a.h + b.h) { toca = true; break; } if (toca) break; }
    if (toca !== c.estado) { c.estado = toca; if (toca !== c.salida) { if (c.on) TR.spawnearGrupo(p, c.g); else TR.prender(p, c.g, false); } }
  }
};
H.alMorir = function (p, o, r) { p.tr.alMorir.push({ g: r[51] | 0, on: r[56] == 1 }); };
TR.alMorirJugador = function (p) { for (const m of p.tr.alMorir) { if (m.on) TR.spawnearGrupo(p, m.g); else TR.prender(p, m.g, false); } };
H.ocultarJ = p => { p.j.vis = false; if (p.j2) p.j2.vis = false; };
H.mostrarJ = p => { p.j.vis = true; if (p.j2) p.j2.vis = true; };
H.estelaOn = p => { p.j.estela = true; }; H.estelaOff = p => { p.j.estela = false; };
H.fondoOn = p => { p.efectosFondo = true; }; H.fondoOff = p => { p.efectosFondo = false; };
H.controlJ = () => { };
// ---- cámara (2.2) ----
H.camZoom = function (p, o, r) { TR.accion(p, { k: 'zoom', ini: p.tr.camZoom, fin: n(r[371], 1), dur: n(r[10], 0.5), e: r[30] | 0, r: n(r[85], 2) }); };
H.camOffset = function (p, o, r) { const c = p.tr.camOff; TR.accion(p, { k: 'camOff', ix: c.x, iy: c.y, fx: n(r[28]), fy: n(r[29]), dur: n(r[10], 0.5), e: r[30] | 0, r: n(r[85], 2) }); };
H.camEstatica = function (p, o, r) {
  const g = r[71] | 0, c = p.tr.camOff;
  if (r[110] == 1 || !g) { TR.accion(p, { k: 'camOff', ix: c.x, iy: c.y, fx: 0, fy: 0, dur: n(r[10], 0.5) }); return; }
  const cen = TR.centro(p, g); if (!cen) return;
  const D = GD.D, tx = cen[0] - D.ancho / 2 - (p.j.x - D.ancho * 0.3), ty = cen[1] - D.alto / 2 - p.camYObj;
  TR.accion(p, { k: 'camOff', ix: c.x, iy: c.y, fx: r[59] == 1 && r[58] != 1 ? 0 : tx, fy: r[58] == 1 && r[59] != 1 ? 0 : ty, dur: n(r[10], 0.5), e: r[30] | 0, r: n(r[85], 2) });
};
H.camRotar = function (p, o, r) { const ini = p.tr.camRot; TR.accion(p, { k: 'camRot', ini, fin: r[70] == 1 ? ini + n(r[68]) : n(r[68]), dur: n(r[10], 0.5), e: r[30] | 0, r: n(r[85], 2) }); };
H.camBorde = () => { }; H.camModo = () => { }; H.reversa = () => { }; H.rotarGameplay = () => { }; H.checkpoint = () => { };
H.gravedad = function (p, o, r) { p.j.gravMod = n(r[148], 1); };
H.escalaTiempo = function (p, o, r) { TR.accion(p, { k: 'tiempoEsc', ini: p.tr.escalaT, fin: n(r[120], 1), dur: n(r[10]) }); };
H.fin = function (p, o, r) { if (r[460] == 1 && false) return; p.terminar(); };
H.teleport = function (p, o, r) { const c = TR.centro(p, r[51] | 0); if (c) { p.j.x = c[0]; p.j.y = c[1]; } };
TR.teleportAro = function (p, j, o) { const c = TR.centro(p, o.raw[51] | 0); if (c) { j.x = c[0]; j.y = c[1]; } };
H.azar = function (p, o, r) { TR.spawnearGrupo(p, Math.random() * 100 < n(r[10], 50) ? r[51] | 0 : r[71] | 0); };
H.azarAvanzado = function (p, o, r) {
  const l = String(r[152] || '').split('.').map(Number), pares = []; for (let i = 0; i + 1 < l.length; i += 2) pares.push([l[i], l[i + 1]]);
  let v = Math.random() * pares.reduce((s, x) => s + x[1], 0); for (const [g, w] of pares) if ((v -= w) <= 0) { TR.spawnearGrupo(p, g); return; }
};
H.secuencia = function (p, o, r) {
  const l = String(r[435] || '').split('.').map(Number), seq = []; for (let i = 0; i + 1 < l.length; i += 2) for (let k = 0; k < l[i + 1]; k++) seq.push(l[i]);
  if (!seq.length) return; const s = p.tr.secuencias[o.i] = p.tr.secuencias[o.i] || { i: 0 };
  TR.spawnearGrupo(p, seq[Math.min(s.i, seq.length - 1)]); s.i++; if (s.i >= seq.length && r[436] == 1) s.i = 0;
};
TR.leerItem = (p, id, tipo) => tipo === 2 ? (p.tr.timers[id] ? p.tr.timers[id].v : 0) : tipo === 4 ? p.tiempo : tipo === 5 ? p.intentos : (p.tr.items[id] || 0);
H.itemEdit = function (p, o, r) {
  const a = TR.leerItem(p, r[80] | 0, r[476] | 0), b = TR.leerItem(p, r[95] | 0, r[477] | 0), mod = n(r[479], 1);
  const op = [(x, y) => x + y, (x, y) => x - y, (x, y) => x * y, (x, y) => y ? x / y : 0][r[481] | 0] || ((x, y) => x + y);
  let v = (r[95] || r[477]) ? op(a, b) : a; v *= mod;
  const dst = r[51] | 0, prev = p.tr.items[dst] || 0;
  p.tr.items[dst] = [v, prev + v, prev - v, prev * v, v ? prev / v : 0][r[480] | 0] ?? v;
  if (r[485] == 1) p.tr.items[dst] = Math.round(p.tr.items[dst]); TR.revisarContadores(p, dst);
};
H.itemCompare = function (p, o, r) {
  const a = TR.leerItem(p, r[80] | 0, r[476] | 0) * n(r[479], 1), b = TR.leerItem(p, r[95] | 0, r[477] | 0) * n(r[483], 1);
  const ok = [a === b, a > b, a >= b, a < b, a <= b, a !== b][r[565] | 0];
  TR.spawnearGrupo(p, ok ? r[51] | 0 : r[71] | 0);
};
H.tiempo = function (p, o, r) { const id = r[80] | 0, t = p.tr; t.timers[id] = { v: r[467] !== undefined ? +r[467] : (t.timers[id] ? t.timers[id].v : 0), mod: n(r[470], 1), atras: r[468] == 1, pausa: false, objetivo: n(r[473]), g: r[51] | 0, parar: r[469] == 1 }; };
H.eventoTiempo = function (p, o, r) { p.tr.eventos.push({ id: r[80] | 0, v: n(r[473]), g: r[51] | 0, multi: r[475] == 1, hecho: false }); };
TR.revisarTiempo = function (p, id) {
  const tm = p.tr.timers[id];
  for (const e of p.tr.eventos) if (e.id === id && !e.hecho && (tm.atras ? tm.v <= e.v : tm.v >= e.v)) { e.hecho = !e.multi; TR.spawnearGrupo(p, e.g); }
  if (tm.parar && (tm.atras ? tm.v <= tm.objetivo : tm.v >= tm.objetivo)) { tm.pausa = true; if (tm.g) TR.spawnearGrupo(p, tm.g); }
};
H.controlTiempo = function (p, o, r) { const tm = p.tr.timers[r[80] | 0]; if (tm) tm.pausa = r[472] == 1; };
H.persistente = () => { }; H.reset = () => { }; H.cancion = () => { }; H.sfxEdit = () => { };
H.sfx = function (p, o, r) { const id = r[392] | 0; if (id) GD.S.efecto(`datos/sfx/s${id}.ogg`, n(r[406], 1), Math.pow(2, n(r[404]) / 12) * n(r[405], 1)); };
H.escalar = function (p, o, r) {
  const g = r[51] | 0; if (!g) return;
  TR.accion(p, { k: 'escalar', g, cen: r[71] | 0, sx: n(r[150], 1), sy: n(r[151], 1), soloMover: r[133] == 1, prevK: 0, dur: n(r[10], 0.5), e: r[30] | 0, r: n(r[85], 2), de: g });
};
