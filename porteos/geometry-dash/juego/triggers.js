// Triggers (EffectGameObject y GJEffectManager): se activan al pasar el jugador por su x, al
// tocarlos (11) o cuando otro los "spawnea" (62). Las animaciones corren a paso de física.
'use strict';
const TR = GD.TR = {};
const N = () => GD.N;
// trigger de color viejo → canal
const COLOR_FIJO = { 29: 1000, 30: 1001, 104: 1002, 105: 1004, 221: 1, 717: 2, 718: 3, 743: 4, 744: 1003, 900: 1009, 915: 1002 };
TR.def = {};
for (const id in COLOR_FIJO) TR.def[id] = 'color';
Object.assign(TR.def, {
  899: 'color', 901: 'mover', 1616: 'parar', 1006: 'pulso', 1007: 'alpha', 1049: 'toggle', 1268: 'spawn', 1346: 'rotar', 1347: 'seguir',
  1520: 'temblor', 1585: 'animar', 1595: 'tocar', 1611: 'contar', 1811: 'contarYa', 1817: 'recoger', 1814: 'seguirY', 1815: 'colision',
  1812: 'alMorir', 1818: 'fondoOn', 1819: 'fondoOff', 1612: 'ocultarJ', 1613: 'mostrarJ', 32: 'estelaOn', 33: 'estelaOff', 1932: 'controlJ',
  1913: 'camZoom', 1914: 'camEstatica', 1916: 'camOffset', 2015: 'camRotar', 2062: 'camBorde', 2925: 'camModo', 1917: 'reversa', 2900: 'rotarGameplay',
  1934: 'cancion', 3602: 'sfx', 3603: 'sfxEdit', 1935: 'escalaTiempo', 2066: 'gravedad', 3600: 'fin', 2063: 'checkpoint', 3022: 'teleport',
  1912: 'azar', 2068: 'azarAvanzado', 3607: 'secuencia', 1615: 'contador', 3614: 'tiempo', 3615: 'eventoTiempo', 3617: 'controlTiempo', 3619: 'itemEdit',
  3620: 'itemCompare', 3641: 'persistente', 3618: 'reset', 2067: 'escalar', 3006: 'areaMover', 3007: 'areaRotar', 3008: 'areaEscalar', 3009: 'areaFade', 3010: 'areaTinte',
  3011: 'areaMover', 3012: 'areaRotar', 3013: 'areaEscalar', 3014: 'areaFade', 3015: 'areaTinte', 3024: 'areaParar', 3016: 'seguirAvanzado', 3660: 'editarSeguirAv', 3661: 'reobjetivo',
  3032: 'keyframe', 3033: 'animKeyframe', 1913.5: 'nada', 2903: 'gradiente', 2904: 'shader', 2905: 'shaderOnda', 2907: 'shaderGlitch', 2909: 'shaderChroma', 2910: 'shaderChromaGlitch',
  2911: 'shaderPixel', 2912: 'shaderLente', 2913: 'shaderRadial', 2914: 'shaderMotion', 2915: 'shaderBulge', 2916: 'shaderPinch', 2917: 'shaderGris', 2919: 'shaderSepia',
  2920: 'shaderInvertir', 2921: 'shaderHue', 2922: 'shaderEditarColor', 2923: 'shaderDivision', 3021: 'spawnParticula', 3029: 'escena', 3030: 'escena', 3031: 'escena',
  2999: 'mgOn', 3606: 'bgSpeed', 3612: 'mgSpeed', 1931: 'finalLvl', 3604: 'evento', 3605: 'nada', 3608: 'nada', 3609: 'instantColision', 3640: 'colisionEstado',
  3613: 'uiConf', 3662: 'linkVisible', 1915: 'opciones', 2899: 'opciones', 3655: 'objControl', 2901: 'modoJuego',
});
TR.esTrigger = o => !!TR.def[o.id];

// ---------- estado ----------
TR.reiniciar = function (p) {
  p.tr = {
    sig: 0, acciones: [], alpha: {}, apagados: {}, items: {}, tiempos: {}, spawns: [], contadores: [], colisiones: [], alMorir: [], tocar: [],
    seguir: [], seguirY: [], rotaciones: [], temblor: null, persistentes: {}, toggleOn: {}, secuencias: {}, colEstado: {}, timers: {},
    camZoom: { v: 1 }, camOff: { x: 0, y: 0 }, escalaT: 1, eventos: [],
  };
  p.camOff = null; p.zoom = 1; p.camRot = 0;
  for (const o of p.objs) { o.grupoOff = null; if (TR.def[o.id] === 'colision' || TR.def[o.id] === 'contar' || TR.def[o.id] === 'alMorir' || TR.def[o.id] === 'eventoTiempo') { /* se registran al activarse */ } }
  // bloques de colisión (1816) por id
  p.bloquesCol = {}; for (const o of p.objs) if (o.id === 1816 || o.id === 3643) (p.bloquesCol[o.raw[80] | 0] = p.bloquesCol[o.raw[80] | 0] || []).push(o);
};
// los triggers "por posición" que quedaron atrás al empezar: los de color se aplican al instante
TR.saltarHasta = function (p, x) {
  const t = p.tr; const L = p.triggers;
  while (t.sig < L.length && L[t.sig].x < x) {
    const o = L[t.sig++]; if (TR.porPosicion(o)) TR.activar(p, o, null, true);
  }
  // termina al instante lo que haya quedado andando
  for (const a of t.acciones) { a.t = a.dur; a.paso && a.paso(0); }
};
TR.porPosicion = o => !(o.raw[11] == 1) && !(o.raw[62] == 1);
TR.foto = p => JSON.parse(JSON.stringify({ sig: p.tr.sig, alpha: p.tr.alpha, apagados: p.tr.apagados, items: p.tr.items, toggleOn: p.tr.toggleOn, off: p.objs.map(o => [o.dx, o.dy, o.drot, o.op, o.activo]) }));
TR.restaurar = function (p, f) {
  const t = p.tr; t.sig = f.sig; t.alpha = f.alpha; t.apagados = f.apagados; t.items = f.items; t.toggleOn = f.toggleOn;
  p.objs.forEach((o, i) => { const v = f.off[i]; if (v) [o.dx, o.dy, o.drot, o.op, o.activo] = v; });
  p.reseccionar();
};

// ---------- bucle ----------
TR.paso = function (p, h) {
  const t = p.tr, j = p.j, L = p.triggers;
  while (t.sig < L.length && L[t.sig].x <= j.x) {
    const o = L[t.sig++];
    if (TR.porPosicion(o)) TR.activar(p, o, j);
  }
  // animaciones en curso
  h *= t.escalaT;
  for (let i = t.acciones.length - 1; i >= 0; i--) { const a = t.acciones[i]; a.t += h; a.paso(h); if (a.t >= a.dur && !a.siempre) { a.fin && a.fin(); t.acciones.splice(i, 1); } }
  // spawns con demora
  for (let i = t.spawns.length - 1; i >= 0; i--) { const s = t.spawns[i]; s.t -= h; if (s.t <= 0) { t.spawns.splice(i, 1); s.f(); } }
  if (t.seguirY.length) for (const s of t.seguirY) TR.pasoSeguirY(p, s, h);
  TR.pasoColisiones(p);
  for (const k in t.timers) { const tm = t.timers[k]; if (!tm.pausa) { tm.v += h * tm.mod * (tm.atras ? -1 : 1); TR.revisarTiempo(p, +k); } }
};
TR.cuadro = function (p, dt) {
  const t = p.tr;
  if (t.temblor) { t.temblor.t += dt; const k = t.temblor; if (k.t >= k.dur) t.temblor = null; else p.camOffTemblor = [(Math.random() * 2 - 1) * k.f, (Math.random() * 2 - 1) * k.f]; }
  if (!t.temblor) p.camOffTemblor = null;
  const off = p.camOff = p.camOff || { x: 0, y: 0 };
  off.x = t.camOff.x + (p.camOffTemblor ? p.camOffTemblor[0] : 0); off.y = t.camOff.y + (p.camOffTemblor ? p.camOffTemblor[1] : 0);
  p.zoom = t.camZoom.v;
};
// curva de un trigger (30 = tipo, 85 = tasa)
TR.curva = o => GD.E.gd(o.raw[30] | 0, o.raw[85] !== undefined ? +o.raw[85] : 2);
// animación genérica: f(k, dk) con k de 0 a 1
TR.animar = function (p, dur, f, extra) {
  const c = extra && extra.curva || GD.E.lin;
  let prev = 0;
  const a = Object.assign({ t: 0, dur: Math.max(0, dur), paso() { const k = this.dur > 0 ? c(Math.min(1, this.t / this.dur)) : 1; f(k, k - prev); prev = k; } }, extra || {});
  if (a.dur <= 0) { a.paso(); a.fin && a.fin(); return a; }
  p.tr.acciones.push(a); return a;
};
TR.grupo = (p, g) => p.grupos[g] || [];
// centro de un grupo (para rotar o seguir alrededor)
TR.centro = function (p, g) {
  const l = TR.grupo(p, g); if (!l.length) return null;
  let x = 0, y = 0; for (const o of l) { x += o.cx; y += o.cy; } return [x / l.length, y / l.length];
};
TR.moverGrupo = function (p, g, dx, dy) {
  if (!dx && !dy) return;
  for (const o of TR.grupo(p, g)) { o.dx += dx; o.dy += dy; p.moverSeccion(o); }
  // el jugador va arriba de lo que se mueve (plataformas)
  for (const j of [p.j, p.j2]) if (j && j.suelo && j.sobre && j.sobre.grupos && j.sobre.grupos.includes(g)) { j.x += dx; j.y += dy; }
};

// ---------- activación ----------
TR.activar = function (p, o, j, instantaneo) {
  const tipo = TR.def[o.id], r = o.raw, t = p.tr;
  if (o.raw[87] != 1 && o._hecho && !instantaneo && false) return;
  const f = TR.H[tipo]; if (!f) return;
  f(p, o, r, j, instantaneo);
};
TR.tocado = function (p, o, j) { if (o._tocado && o.raw[87] != 1) return; o._tocado = true; TR.activar(p, o, j); };
// spawnear (o "activar") un grupo: los triggers de ese grupo marcados para spawn (o todos, en el aro)
TR.spawnearGrupo = function (p, g, demora = 0, j, ordenado = false) {
  const go = () => {
    const l = TR.grupo(p, g).filter(o => TR.def[o.id]).sort((a, b) => a.x - b.x);
    if (ordenado) { // 2.2: respeta la distancia en x como demora
      const x0 = l.length ? l[0].x : 0;
      for (const o of l) { const dl = (o.x - x0) / GD.O.UPS[p.j.vel]; if (dl > 0) t.spawns.push({ t: dl, f: () => TR.activar(p, o, j) }); else TR.activar(p, o, j); }
    } else for (const o of l) TR.activar(p, o, j);
  };
  const t = p.tr;
  if (demora > 0) t.spawns.push({ t: demora, f: go }); else go();
};
TR.activarGrupos = function (p, o, deAro) {
  const g = o.raw[51] | 0; if (!g) return;
  if (deAro) { // aro custom (toggle orb): prende o apaga el grupo
    if (o.raw[56] == 1) TR.prender(p, g, true); else TR.prender(p, g, false);
    return;
  }
  TR.spawnearGrupo(p, g, 0, p.j);
};
TR.prender = function (p, g, on) {
  p.tr.apagados[g] = !on;
  for (const o of TR.grupo(p, g)) { o.activo = on; o.oculto = !on; }
};

// ---------- manejadores ----------
const H = TR.H = {};
H.color = function (p, o, r) {
  const canal = COLOR_FIJO[o.id] || (r[23] | 0) || 1;
  const dest = { r: +(r[7] ?? 255), g: +(r[8] ?? 255), b: +(r[9] ?? 255), op: r[35] !== undefined ? +r[35] : 1, pc: r[15] == 1 ? 1 : r[16] == 1 ? 2 : -1 };
  if (r[17] !== undefined) dest.add = r[17] == 1;
  if (r[50]) { dest.copia = +r[50]; dest.hsv = r[49]; dest.copiaOp = r[60] == 1; }
  p.cols.cambiar(canal, dest, +(r[10] ?? 0.5));
};
H.mover = function (p, o, r, j) {
  const g = r[51] | 0; if (!g) return;
  let mx = +(r[28] || 0), my = +(r[29] || 0);
  const lx = r[58] == 1, ly = r[59] == 1, dur = +(r[10] ?? 0.5), c = TR.curva(o);
  const modX = r[143] !== undefined ? +r[143] : 1, modY = r[144] !== undefined ? +r[144] : 1;
  // 2.2: mover hacia un objeto (100 = usar objetivo; 71 = grupo destino; 395 = centro)
  if (r[100] == 1 && r[71]) {
    const dst = TR.centro(p, r[71] | 0), org = r[395] ? TR.centro(p, r[395] | 0) : TR.centro(p, g);
    if (!dst || !org) return;
    const modo = r[101] | 0; mx = modo === 2 ? 0 : dst[0] - org[0]; my = modo === 1 ? 0 : dst[1] - org[1];
  }
  let jx = j ? j.x : p.j.x, jy = j ? j.y : p.j.y;
  if (r[393] == 1) { mx *= 1; } // "small step": como el juego, ya en unidades
  const a = TR.animar(p, dur, (k, dk) => {
    let dx = mx * dk, dy = my * dk;
    if (lx || ly) { const jj = p.j; if (lx) { dx = (jj.x - jx) * modX; } if (ly) { dy = (jj.y - jy) * modY; } jx = jj.x; jy = jj.y; }
    TR.moverGrupo(p, g, dx, dy);
  }, { curva: c, grupo: g, tipo: 'mover', id: o.raw[51] });
  void a;
};
H.parar = function (p, o, r) {
  const g = r[51] | 0, t = p.tr; if (!g) return;
  const modo = r[580] | 0; // 0 parar, 1 pausa, 2 seguir
  t.acciones = t.acciones.filter(a => !(a.dueno === g || a.grupoTrigger === g));
  t.spawns = t.spawns.filter(s => s.g !== g);
  void modo;
};
H.pulso = function (p, o, r) {
  const fi = +(r[45] || 0), hold = +(r[46] || 0), fo = +(r[47] || 0);
  const pu = { t: 0, fi, hold, fo, rgb: [+(r[7] ?? 255), +(r[8] ?? 255), +(r[9] ?? 255)] };
  if (r[48] == 1) { pu.hsv = N().hsv(r[49]); const cid = r[50] | 0; if (cid) { const v = p.cols.valor(cid); pu.copiaRGB = [v.r, v.g, v.b]; } }
  const dest = r[51] | 0, aGrupo = r[52] == 1;
  if (aGrupo) {
    pu.soloBase = r[65] == 1; pu.soloDetalle = r[66] == 1;
    for (const ob of TR.grupo(p, dest)) { (ob.pulsos = ob.pulsos || []).push(pu); }
    TR.animar(p, fi + hold + fo, (k) => { pu.t = k * (fi + hold + fo); }, { fin() { for (const ob of TR.grupo(p, dest)) if (ob.pulsos) { const i = ob.pulsos.indexOf(pu); if (i >= 0) ob.pulsos.splice(i, 1); } } });
  } else { pu.canal = dest || 1; p.cols.pulsos.push(pu); }
};
H.alpha = function (p, o, r) {
  const g = r[51] | 0; if (!g) return;
  const dest = r[35] !== undefined ? +r[35] : 1, dur = +(r[10] ?? 0.5), t = p.tr;
  const ini = t.alpha[g] !== undefined ? t.alpha[g] : 1;
  TR.animar(p, dur, k => { const v = ini + (dest - ini) * k; t.alpha[g] = v; for (const ob of TR.grupo(p, g)) ob.op = TR.opGrupos(p, ob); }, { tipo: 'alpha', grupo: g });
};
TR.opGrupos = function (p, ob) { let v = 1; if (ob.grupos) for (const g of ob.grupos) if (p.tr.alpha[g] !== undefined) v *= p.tr.alpha[g]; return v; };
H.toggle = function (p, o, r) { const g = r[51] | 0; if (g) TR.prender(p, g, r[56] == 1); };
H.spawn = function (p, o, r, j) {
  const g = r[51] | 0; if (!g) return;
  const dem = +(r[63] || 0) + (r[556] ? (Math.random() * 2 - 1) * +r[556] : 0);
  TR.spawnearGrupo(p, g, Math.max(0, dem), j, r[441] == 1);
};
H.rotar = function (p, o, r) {
  const g = r[51] | 0; if (!g) return;
  const grados = +(r[68] || 0) + 360 * +(r[69] || 0), cen = r[71] | 0, dur = +(r[10] ?? 0.5), lock = r[70] == 1;
  TR.animar(p, dur, (k, dk) => {
    const da = grados * dk; if (!da) return;
    const c = cen ? TR.centro(p, cen) : null, a = -da * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    for (const ob of TR.grupo(p, g)) {
      if (c && !(ob.grupos && ob.grupos.includes(cen) && TR.grupo(p, cen).length === 1 && TR.grupo(p, cen)[0] === ob)) {
        const x = ob.cx - c[0], y = ob.cy - c[1]; const nx = c[0] + x * cs - y * sn, ny = c[1] + x * sn + y * cs;
        ob.dx += nx - ob.cx; ob.dy += ny - ob.cy; p.moverSeccion(ob);
      }
      if (!lock) ob.drot += da;
    }
  }, { curva: TR.curva(o), grupo: g, tipo: 'rotar' });
};
H.seguir = function (p, o, r) {
  const g = r[51] | 0, sg = r[71] | 0; if (!g || !sg) return;
  const mx = r[72] !== undefined ? +r[72] : 1, my = r[73] !== undefined ? +r[73] : 1, dur = +(r[10] ?? 0.5);
  let c0 = TR.centro(p, sg); if (!c0) return;
  TR.animar(p, dur, () => { const c = TR.centro(p, sg); if (!c) return; TR.moverGrupo(p, g, (c[0] - c0[0]) * mx, (c[1] - c0[1]) * my); c0 = c; }, { tipo: 'seguir', grupo: g });
};
H.seguirY = function (p, o, r) {
  const g = r[51] | 0; if (!g) return;
  p.tr.seguirY.push({ g, vel: +(r[90] ?? 1), dem: +(r[91] || 0), off: +(r[92] || 0), max: +(r[105] || 0), dur: +(r[10] ?? 0), t: 0, y0: null });
};
TR.pasoSeguirY = function (p, s, h) {
  s.t += h; if (s.dur > 0 && s.t > s.dur) return;
  const c = TR.centro(p, s.g); if (!c) return;
  const obj = p.j.y + s.off; let dy = (obj - c[1]) * Math.min(1, s.vel * h * 4);
  if (s.max) dy = GD.clamp(dy, -s.max * h * 60, s.max * h * 60);
  TR.moverGrupo(p, s.g, 0, dy);
};
H.temblor = function (p, o, r) { p.tr.temblor = { f: +(r[75] || 1), t: 0, dur: +(r[10] ?? 0.5), int: +(r[84] || 0) }; };
H.animar = function (p, o, r) { for (const ob of TR.grupo(p, r[51] | 0)) ob.anim = r[76] | 0; };
H.tocar = function (p, o, r) {
  // trigger "touch": prende/apaga o alterna el grupo según toque (81 = mantener, 82 = modo, 89 = dual)
  const g = r[51] | 0; if (!g) return;
  p.tr.tocar.push({ g, mantener: r[81] == 1, modo: r[82] | 0, dual: r[89] == 1, on: r[56] == 1 });
};
H.contar = function (p, o, r) { p.tr.contadores.push({ item: r[80] | 0, n: r[77] | 0, g: r[51] | 0, on: r[56] == 1, multi: r[104] == 1, hecho: false }); TR.revisarContadores(p, r[80] | 0); };
H.contarYa = function (p, o, r) {
  // contador instantáneo: compara ahora mismo (88: 0 igual, 1 mayor, 2 menor)
  const v = p.tr.items[r[80] | 0] || 0, n = r[77] | 0, cmp = r[88] | 0;
  if ((cmp === 0 && v === n) || (cmp === 1 && v > n) || (cmp === 2 && v < n)) TR.efectoContador(p, r);
};
TR.efectoContador = (p, r) => { const g = r[51] | 0; if (r[56] == 1) TR.spawnearGrupo(p, g, 0); else TR.prender(p, g, false); };
TR.revisarContadores = function (p, item) {
  for (const c of p.tr.contadores) if (c.item === item && (!c.hecho || c.multi)) {
    const v = p.tr.items[item] || 0;
    if (v === c.n && !c.hecho) { c.hecho = true; if (c.on) TR.spawnearGrupo(p, c.g, 0); else TR.prender(p, c.g, false); }
    else if (v !== c.n && c.multi) c.hecho = false;
  }
};
H.recoger = function (p, o, r) {
  const item = r[80] | 0, t = p.tr;
  if (r[79] == 1) t.items[item] = (+r[77] || 0) * (r[78] == 1 ? -1 : 1) + 0; // "override": 2.2 pickup con modo
  if (r[449] == 1) { t.items[item] = (t.items[item] || 0) * (+r[479] || 1); }
  else t.items[item] = (t.items[item] || 0) + (r[78] == 1 ? -1 : 1) * (r[77] !== undefined ? +r[77] : 1);
  TR.revisarContadores(p, item);
};
H.colision = function (p, o, r) {
  // bloque A (80) con bloque B (95) o con el jugador (dinámico 94 / jugador 1 y 2)
  p.tr.colisiones.push({ a: r[80] | 0, b: r[95] | 0, jugadorA: r[138] == 1, jugadorB: r[200] == 1, g: r[51] | 0, on: r[56] == 1, salida: r[93] == 1, estado: false });
};
TR.pasoColisiones = function (p) {
  const t = p.tr; if (!t.colisiones.length) return;
  const cajasDe = id => (p.bloquesCol[id] || []).map(o => p.caja(o));
  const jugadorCaja = j => ({ x: j.x, y: j.y, w: j.alto / 2, h: j.alto / 2 });
  for (const c of t.colisiones) {
    let toca = false;
    const A = c.jugadorA ? [jugadorCaja(p.j)] : cajasDe(c.a), B = c.jugadorB || !c.b ? [jugadorCaja(p.j)] : cajasDe(c.b);
    for (const a of A) { for (const b of B) if (Math.abs(a.x - b.x) < a.w + b.w && Math.abs(a.y - b.y) < a.h + b.h) { toca = true; break; } if (toca) break; }
    if (toca !== c.estado) {
      c.estado = toca;
      if (toca !== c.salida) { if (c.on) TR.spawnearGrupo(p, c.g, 0); else TR.prender(p, c.g, false); }
    }
  }
};
H.alMorir = function (p, o, r) { p.tr.alMorir.push({ g: r[51] | 0, on: r[56] == 1 }); };
H.ocultarJ = p => { p.j.vis = false; if (p.j2) p.j2.vis = false; };
H.mostrarJ = p => { p.j.vis = true; if (p.j2) p.j2.vis = true; };
H.estelaOn = p => { p.j.estela = true; }; H.estelaOff = p => { p.j.estela = false; };
H.fondoOn = p => { p.efectosFondo = true; }; H.fondoOff = p => { p.efectosFondo = false; };
// ---- cámara (2.2) ----
H.camZoom = function (p, o, r) {
  const z = r[371] !== undefined ? +r[371] : 1, dur = +(r[10] ?? 0.5), cz = p.tr.camZoom, ini = cz.v;
  TR.animar(p, dur, k => { cz.v = ini + (z - ini) * k; }, { curva: TR.curva(o) });
};
H.camOffset = function (p, o, r) {
  const x = +(r[28] || 0), y = +(r[29] || 0), dur = +(r[10] ?? 0.5), co = p.tr.camOff, ix = co.x, iy = co.y;
  TR.animar(p, dur, k => { co.x = ix + (x - ix) * k; co.y = iy + (y - iy) * k; }, { curva: TR.curva(o) });
};
H.camEstatica = function (p, o, r) {
  const g = r[71] | 0; const dur = +(r[10] ?? 0.5);
  if (r[110] == 1 || !g) { const co = p.tr.camOff, ix = co.x, iy = co.y; TR.animar(p, dur, k => { co.x = ix * (1 - k); co.y = iy * (1 - k); }); return; }
  const c = TR.centro(p, g); if (!c) return; const D = GD.D, co = p.tr.camOff, ix = co.x, iy = co.y;
  const tx = c[0] - D.ancho / 2 - (p.j.x - D.ancho * 0.3), ty = c[1] - D.alto / 2 - p.camYObj;
  TR.animar(p, dur, k => { co.x = ix + ((r[58] == 1 || r[59] != 1 ? tx : 0) - ix) * k; co.y = iy + ((r[59] == 1 || r[58] != 1 ? ty : 0) - iy) * k; }, { curva: TR.curva(o) });
};
H.camRotar = function (p, o, r) { const deg = +(r[68] || 0), dur = +(r[10] ?? 0.5), ini = p.camRot || 0, fin = r[70] == 1 ? ini + deg : deg; TR.animar(p, dur, k => { p.camRot = ini + (fin - ini) * k; }, { curva: TR.curva(o) }); };
H.camBorde = function () { }; H.camModo = function () { };
H.gravedad = function (p, o, r) { const v = r[148] !== undefined ? +r[148] : 1; p.j.gravMod = v; };
H.escalaTiempo = function (p, o, r) { const v = r[120] !== undefined ? +r[120] : 1, dur = +(r[10] ?? 0), t = p.tr, ini = t.escalaT; TR.animar(p, dur, k => { t.escalaT = ini + (v - ini) * k; }); };
H.fin = function (p, o, r) { if (r[460] == 1) return; p.terminar(); };
H.teleport = function (p, o, r) { const g = r[51] | 0, c = TR.centro(p, g); if (!c) return; p.j.x = c[0]; p.j.y = c[1]; };
TR.teleportAro = function (p, j, o) { const g = o.raw[51] | 0, c = TR.centro(p, g); if (c) { j.x = c[0]; j.y = c[1]; } };
H.azar = function (p, o, r) { const k = Math.random() * 100 < +(r[10] ?? 50); TR.spawnearGrupo(p, k ? r[51] | 0 : r[71] | 0, 0); };
H.azarAvanzado = function (p, o, r) {
  const lista = String(r[152] || '').split('.').map(Number); const pares = [];
  for (let i = 0; i + 1 < lista.length; i += 2) pares.push([lista[i], lista[i + 1]]);
  const tot = pares.reduce((s, x) => s + x[1], 0); let v = Math.random() * tot;
  for (const [g, w] of pares) { if ((v -= w) <= 0) { TR.spawnearGrupo(p, g, 0); return; } }
};
H.secuencia = function (p, o, r) {
  const lista = String(r[435] || '').split('.').map(Number), pares = [];
  for (let i = 0; i + 1 < lista.length; i += 2) for (let k = 0; k < lista[i + 1]; k++) pares.push(lista[i]);
  const s = p.tr.secuencias[o.n] = p.tr.secuencias[o.n] || { i: 0 };
  if (!pares.length) return; const g = pares[s.i % pares.length]; s.i++;
  if (s.i >= pares.length && r[436] != 1) s.i = pares.length - 1 + (r[438] == 1 ? 1 - pares.length : 0);
  TR.spawnearGrupo(p, g, 0);
};
H.itemEdit = function (p, o, r) {
  // item edit: dest = op(A, B) * mod (2.2). 80/95 = items A y B, 51 = destino, 480 = operación
  const t = p.tr, a = TR.leerItem(p, r[80] | 0, r[476] | 0), b = TR.leerItem(p, r[95] | 0, r[477] | 0), mod = r[479] !== undefined ? +r[479] : 1;
  let v; const op1 = r[480] | 0, op2 = r[481] | 0;
  const ab = [(x, y) => x + y, (x, y) => x - y, (x, y) => x * y, (x, y) => y ? x / y : 0][op2] || ((x, y) => x + y);
  v = (r[95] || r[477]) ? ab(a, b) : a; v = [x => x * mod, x => x / (mod || 1), x => x + mod, x => x - mod][r[482] | 0] ? [x => x * mod, x => x / (mod || 1)][r[482] | 0](v) : v * mod;
  const dst = r[51] | 0, prev = t.items[dst] || 0;
  t.items[dst] = [v, prev + v, prev - v, prev * v, v ? prev / v : 0][op1] ?? v;
  if (r[485] == 1) t.items[dst] = Math.round(t.items[dst]); TR.revisarContadores(p, dst);
};
TR.leerItem = (p, id, tipo) => tipo === 2 ? (p.tr.timers[id] ? p.tr.timers[id].v : 0) : tipo === 3 ? p.puntos || 0 : tipo === 4 ? p.tiempo : tipo === 5 ? p.intentos : (p.tr.items[id] || 0);
H.itemCompare = function (p, o, r) {
  const a = TR.leerItem(p, r[80] | 0, r[476] | 0) * (r[479] !== undefined ? +r[479] : 1), b = TR.leerItem(p, r[95] | 0, r[477] | 0) * (r[483] !== undefined ? +r[483] : 1);
  const cmp = r[565] | 0; const ok = [a === b, a > b, a >= b, a < b, a <= b, a !== b][cmp];
  TR.spawnearGrupo(p, ok ? r[51] | 0 : r[71] | 0, 0);
};
H.tiempo = function (p, o, r) {
  const id = r[80] | 0, t = p.tr;
  t.timers[id] = { v: r[467] !== undefined ? +r[467] : (t.timers[id] ? t.timers[id].v : 0), mod: r[470] !== undefined ? +r[470] : 1, atras: r[468] == 1, pausa: false, objetivo: +(r[473] || 0), g: r[51] | 0, parar: r[469] == 1 };
};
H.eventoTiempo = function (p, o, r) { p.tr.eventos.push({ id: r[80] | 0, v: +(r[473] || 0), g: r[51] | 0, multi: r[475] == 1, hecho: false }); };
TR.revisarTiempo = function (p, id) {
  const tm = p.tr.timers[id];
  for (const e of p.tr.eventos) if (e.id === id && !e.hecho && (tm.atras ? tm.v <= e.v : tm.v >= e.v)) { e.hecho = !e.multi; TR.spawnearGrupo(p, e.g, 0); }
  if (tm.parar && (tm.atras ? tm.v <= tm.objetivo : tm.v >= tm.objetivo)) { tm.pausa = true; if (tm.g) TR.spawnearGrupo(p, tm.g, 0); }
};
H.controlTiempo = function (p, o, r) { const tm = p.tr.timers[r[80] | 0]; if (tm) tm.pausa = r[472] == 1; };
H.reset = function (p, o, r) { };
H.cancion = function (p, o, r) { };
H.sfx = function (p, o, r) { const id = r[392] | 0; if (id) GD.S.efecto(`datos/sfx/s${id}.ogg`, r[406] !== undefined ? +r[406] : 1, Math.pow(2, (+(r[404] || 0)) / 12) * (r[405] !== undefined ? +r[405] : 1)); };
H.sfxEdit = function () { };
H.escalar = function (p, o, r) {
  const g = r[51] | 0; if (!g) return;
  const sx = r[150] !== undefined ? +r[150] : 1, sy = r[151] !== undefined ? +r[151] : 1, dur = +(r[10] ?? 0.5), cen = r[71] | 0;
  const ls = TR.grupo(p, g), ini = ls.map(ob => [ob.esx || 1, ob.esy || 1, ob.cx, ob.cy]);
  const c = cen ? TR.centro(p, cen) : null;
  TR.animar(p, dur, k => {
    ls.forEach((ob, i) => {
      const [ex, ey, x0, y0] = ini[i]; ob.esx = ex * (1 + (sx - 1) * k); ob.esy = ey * (1 + (sy - 1) * k);
      if (c && r[133] != 1) { const nx = c[0] + (x0 - c[0]) * (1 + (sx - 1) * k), ny = c[1] + (y0 - c[1]) * (1 + (sy - 1) * k); ob.dx += nx - ob.cx; ob.dy += ny - ob.cy; }
    });
  }, { curva: TR.curva(o) });
};
H.nada = () => { };
// los efectos de área, shaders y demás de la 2.2 se agregan en triggers22 (si está)
