// Triggers de la 2.2 que faltaban y los que leían mal sus claves (según el esquema público de las
// propiedades de los objetos): items, tiempos, recolección, colisiones, eventos del jugador,
// opciones, fondos, sonido y canciones, remapeo de grupos en los spawns, bloques de estado y de
// toque, contadores en pantalla, gravedad, control del jugador, teletransporte y bordes de cámara.
'use strict';
(() => {
const TR = GD.TR, H = TR.H;
const n = (v, d = 0) => v === undefined || v === '' ? d : +v;
Object.assign(TR.def, {
  3604: 'evento', 3609: 'colisionYa', 3618: 'reset', 2899: 'opciones', 3029: 'cambiarFondo', 3030: 'cambiarPiso', 3031: 'cambiarMedio',
  3606: 'velFondo', 3612: 'velMedio', 2999: 'medioEdit', 1934: 'cancion', 3605: 'editarCancion', 3602: 'sfx', 3603: 'sfxEdit', 2062: 'camBorde',
  1917: 'reversa', 3600: 'fin', 1931: 'fin', 1932: 'controlJ', 3022: 'teleport', 2066: 'gravedad', 3613: 'nada', 3662: 'nada', 3642: 'nada', 2016: 'nada',
});

// ---------- remapeo de grupos (spawn 2.2, clave 442: pares desde.hasta) ----------
// los triggers que activa un spawn con remapeo leen sus grupos cambiados; se hereda hacia abajo
// salvo que el spawn pida reiniciarlo (581)
const CLAVES_GRUPO = [51, 71, 395, 401, 516, 517, 518, 519, 203, 204, 205, 206, 457, 76, 80, 95];
TR.remapear = function (raw, mapa) {
  if (!mapa) return raw;
  const r = Object.assign({}, raw);
  for (const k of CLAVES_GRUPO) { const v = raw[k]; if (v !== undefined && mapa[v] !== undefined) r[k] = String(mapa[v]); }
  return r;
};
const leerMapa = (r, previo) => {
  const l = String(r[442] || '').split('.').filter(x => x !== '').map(Number);
  const m = r[581] == 1 || !previo ? {} : Object.assign({}, previo);
  for (let i = 0; i + 1 < l.length; i += 2) m[l[i]] = l[i + 1];
  return Object.keys(m).length ? m : null;
};
TR.activar = function (p, o, j, mapa) {
  const f = H[TR.def[o.id]]; if (!f) return;
  TR._mapa = mapa || null;
  try { f(p, o, TR.remapear(o.raw, mapa), j || p.j); } finally { TR._mapa = null; }
};
const spawnViejo = TR._spawnear;
TR._spawnear = function (p, s) {
  if (!s.mapa) { spawnViejo(p, s); return; }
  const l = TR.grupo(p, s.g).filter(o => TR.def[o.id] && o.raw[62] == 1).sort((a, b) => a.x - b.x);
  const x0 = l.length ? l[0].x : 0;
  for (const o of l) {
    if (p.tr.hechos[o.i] && o.raw[87] != 1) continue;
    p.tr.hechos[o.i] = 1;
    if (s.ordenado && o.x > x0) { p.tr.spawns.push({ t: (o.x - x0) / GD.O.UPS[p.j.vel], uno: o.i, mapa: s.mapa }); continue; }
    TR.activar(p, o, p.j, s.mapa);
  }
  if (s.uno !== undefined) { const o = p.objs[s.uno]; if (o) TR.activar(p, o, p.j, s.mapa); }
};
H.spawn = function (p, o, r) {
  const g = r[51] | 0; if (!g) return;
  const dem = n(r[63]) + (r[556] ? (Math.random() * 2 - 1) * +r[556] : 0), mapa = leerMapa(r, TR._mapa);
  if (dem > 0) { p.tr.spawns.push({ t: dem, g, ordenado: r[441] == 1, mapa }); return; }
  TR.spawnear(p, { g, ordenado: r[441] == 1, mapa });
};

// ---------- items, tiempos y recolección ----------
// tipos: 1 item, 2 timer, 3 puntos, 4 tiempo del nivel, 5 intentos
TR.leerItem = (p, id, tipo) => tipo === 2 ? (p.tr.timers[id] ? p.tr.timers[id].v : 0) : tipo === 3 ? (p.tr.puntos || 0) : tipo === 4 ? p.tiempo : tipo === 5 ? p.intentos : (p.tr.items[id] || 0);
TR.ponerItem = function (p, id, tipo, v) {
  if (tipo === 2) { const t = p.tr.timers[id] || (p.tr.timers[id] = { v: 0, mod: 1, pausa: true, parar: null, g: 0 }); t.v = v; TR.revisarTiempo(p, id); return; }
  if (tipo === 3) { p.tr.puntos = v; return; }
  p.tr.items[id] = v; TR.revisarContadores(p, id);
};
const OPS = [null, (a, b) => a + b, (a, b) => a - b, (a, b) => a * b, (a, b) => b ? a / b : 0];
const absNeg = (v, m) => m === 1 ? Math.abs(v) : m === 2 ? -Math.abs(v) : v;
const redondeo = (v, m) => m === 1 ? Math.round(v) : m === 2 ? Math.floor(v) : m === 3 ? Math.ceil(v) : v;
H.itemEdit = function (p, o, r) {
  const t1 = r[476] | 0, t2 = r[477] | 0, mod = n(r[479], 1);
  let x;
  if (t1) { x = TR.leerItem(p, r[80] | 0, t1); if (t2 && OPS[r[481] | 0]) x = OPS[r[481] | 0](x, TR.leerItem(p, r[95] | 0, t2)); }
  else x = t2 ? TR.leerItem(p, r[95] | 0, t2) : 0;
  x = redondeo(absNeg(x, r[578] | 0), r[485] | 0);
  x = (t1 || t2) ? (OPS[r[482] | 0] || OPS[3])(x, mod) : mod;
  x = redondeo(absNeg(x, r[579] | 0), r[486] | 0);
  const dt = r[478] | 0 || 1, dst = r[51] | 0, prev = TR.leerItem(p, dst, dt), asig = r[480] | 0;
  TR.ponerItem(p, dst, dt, asig ? OPS[asig](prev, x) : x);
};
H.itemCompare = function (p, o, r) {
  const lado = (id, tipo, op, mod, an, rd) => { let v = tipo ? TR.leerItem(p, id, tipo) : 0; if (OPS[op]) v = OPS[op](v, mod); return redondeo(absNeg(v, an), rd); };
  const a = lado(r[80] | 0, r[476] | 0, r[480] === undefined ? 3 : r[480] | 0, n(r[479], 1), r[578] | 0, r[485] | 0);
  const b = lado(r[95] | 0, r[477] | 0, r[481] === undefined ? 3 : r[481] | 0, n(r[483], 1), r[579] | 0, r[486] | 0);
  const tol = Math.abs(n(r[484])), cmp = r[482] | 0;
  const ok = cmp === 0 ? Math.abs(a - b) <= tol : cmp === 1 ? a > b - tol : cmp === 2 ? a >= b - tol : cmp === 3 ? a < b + tol : a <= b + tol;
  const g = ok ? r[51] | 0 : r[71] | 0; if (g) TR.spawnear(p, { g, mapa: TR._mapa });
};
// pickup: suma (o pisa con 139, o multiplica/divide con 88 y 449) el item
H.recoger = function (p, o, r) {
  const it = r[80] | 0, modo = r[88] | 0; let v = p.tr.items[it] || 0;
  if (modo === 1) v *= n(r[449], 1); else if (modo === 2) { const m = n(r[449], 1); v = m ? v / m : 0; }
  else if (r[139] == 1) v = n(r[77]); else v += n(r[77], 1);
  p.tr.items[it] = v; TR.revisarContadores(p, it);
};
// timer: empieza en 467 (salvo "no pisar" 468 si ya existe), avanza con 470 (negativo cuenta para
// atrás) y, si 474, se para en 473 y spawnea 51
H.tiempo = function (p, o, r) {
  const id = r[80] | 0, t = p.tr, viejo = t.timers[id];
  t.timers[id] = { v: r[468] == 1 && viejo ? viejo.v : n(r[467]), mod: n(r[470], 1), pausa: r[471] == 1, parar: r[474] == 1 ? n(r[473]) : null, g: r[51] | 0, sinTW: r[469] == 1 };
};
H.eventoTiempo = function (p, o, r) { p.tr.eventos.push({ id: r[80] | 0, v: n(r[473]), g: r[51] | 0, multi: r[475] == 1, hecho: false }); };
TR.revisarTiempo = function (p, id) {
  const tm = p.tr.timers[id]; if (!tm) return;
  const sube = tm.mod >= 0;
  for (const e of p.tr.eventos) if (e.id === id && !e.hecho && (sube ? tm.v >= e.v : tm.v <= e.v)) { e.hecho = !e.multi ? true : 'esperar'; TR.spawnearGrupo(p, e.g); }
  for (const e of p.tr.eventos) if (e.id === id && e.hecho === 'esperar' && (sube ? tm.v < e.v : tm.v > e.v)) e.hecho = false;
  if (tm.parar !== null && tm.parar !== undefined && (sube ? tm.v >= tm.parar : tm.v <= tm.parar)) { tm.v = tm.parar; tm.pausa = true; tm.parar = null; if (tm.g) TR.spawnearGrupo(p, tm.g); }
};
H.controlTiempo = function (p, o, r) { const tm = p.tr.timers[r[80] | 0]; if (tm) tm.pausa = r[472] == 1; };
H.persistente = function (p, o, r) { /* items que sobreviven a la muerte: se guardan en la partida */ const k = (r[494] == 1 ? 't' : 'i') + (r[80] | 0); (p.persistentes = p.persistentes || {})[k] = r[491] == 1; };

// ---------- colisiones ----------
// 1815: bloque A (80) contra bloque B (95); con P1/P2 (138/200) el A es el jugador; con PP, los dos jugadores
const cajaJ = j => ({ x: j.x, y: j.y, w: j.alto / 2, h: j.alto / 2 });
const lados = (p, r) => {
  const blq = id => (p.bloquesCol[id] || []).filter(o => o.activo).map(o => p.caja(o));
  let A, B;
  if (r[201] == 1) { A = [cajaJ(p.j)]; B = p.j2 ? [cajaJ(p.j2)] : []; }
  else { A = r[138] == 1 ? [cajaJ(p.j)] : r[200] == 1 ? (p.j2 ? [cajaJ(p.j2)] : []) : blq(r[80] | 0); B = blq(r[95] | 0); }
  return [A, B];
};
const chocan = (A, B) => { for (const a of A) for (const b of B) if (!a.circ && !b.circ && Math.abs(a.x - b.x) < a.w + b.w && Math.abs(a.y - b.y) < a.h + b.h) return true; return false; };
H.colision = function (p, o, r) { p.tr.colisiones.push({ r: { 80: r[80], 95: r[95], 138: r[138], 200: r[200], 201: r[201] }, g: r[51] | 0, on: r[56] == 1, salida: r[93] == 1, estado: false }); };
TR.pasoColisiones = function (p) {
  for (const c of p.tr.colisiones) {
    const [A, B] = lados(p, c.r), toca = chocan(A, B);
    if (toca !== c.estado) { c.estado = toca; if (toca !== c.salida) { if (c.on) TR.spawnearGrupo(p, c.g); else TR.prender(p, c.g, false); } }
  }
};
H.colisionYa = function (p, o, r) { const [A, B] = lados(p, r), g = chocan(A, B) ? r[51] | 0 : r[71] | 0; if (g) TR.spawnear(p, { g, mapa: TR._mapa }); };
// bloques de estado (3640: 51 al entrar, 71 al salir) y de toque (3643: prende/apaga o spawnea 51)
TR.pasoBloquesJugador = function (p) {
  const L = p.bloquesJ; if (!L || !L.length) return;
  const j = p.j, hs = j.alto / 2;
  for (const o of L) {
    if (!o.activo) continue;
    if (Math.abs(o.cx - j.x) > 200) { if (o.dentro) o.dentro = false; continue; }
    const c = p.caja(o), toca = p.toca(c, j.x, j.y, hs, hs);
    if (toca === !!o.dentro) continue;
    o.dentro = toca;
    if (o.id === 3640) { const g = toca ? o.raw[51] | 0 : o.raw[71] | 0; if (g) TR.spawnearGrupo(p, g); }
    else if (toca) { const g = o.raw[51] | 0; if (!g) continue; if (o.raw[504] == 1) TR.spawnearGrupo(p, g); else TR.prender(p, g, o.raw[56] == 1); }
  }
};
H.reset = function (p, o, r) { for (const x of TR.grupo(p, r[51] | 0)) { delete p.tr.hechos[x.i]; delete p.tr.secuencias[x.i]; } };

// ---------- eventos del jugador (3604): escucha y spawnea su grupo cuando pasan ----------
TR.EV = { aterrizajeMin: 1, pluma: 2, suave: 3, normal: 4, duro: 5, cabeza: 6, aroToque: 7, aroUso: 8, pad: 9, gravInv: 10, gravNormal: 11, salto: 12, roboIni: 13, roboFin: 14,
  ovni: 15, naveIni: 16, naveFin: 17, arana: 18, bola: 19, columpio: 20, ondaSube: 21, ondaBaja: 22, dashIni: 23, dashFin: 24, teleport: 25,
  presiona: 69, suelta: 70, izqPresiona: 71, izqSuelta: 72, derPresiona: 73, derSuelta: 74, reversa: 75 };
// los aros, pads y portales tienen su número propio (34-59)
TR.EV_OBJ = { 36: 34, 141: 35, 1333: 36, 84: 37, 1022: 38, 1330: 39, 1594: 40, 1704: 41, 1751: 42, 3004: 43, 3027: 44, 35: 45, 140: 46, 1332: 47, 67: 48, 3005: 49,
  12: 26, 13: 27, 47: 28, 111: 29, 660: 30, 745: 31, 1331: 32, 1933: 33, 10: 50, 11: 52, 2926: 50, 45: 53, 46: 54, 99: 55, 101: 56, 286: 57, 287: 58, 747: 59 };
H.evento = function (p, o, r) {
  const ids = String(r[430] || '').split('.').filter(x => x !== '').map(Number);
  (p.tr.escuchas = p.tr.escuchas || []).push({ g: r[51] | 0, ids, extra: n(r[447]), extra2: n(r[525]) });
};
TR.evento = function (p, id, extra) {
  const L = p.tr && p.tr.escuchas; if (!L || !L.length) return;
  for (const e of L.slice()) if (e.ids.includes(id) && (!e.extra || extra === undefined || e.extra === extra)) TR.spawnearGrupo(p, e.g);
};
TR.eventoObjeto = function (p, o) {
  const id = TR.EV_OBJ[o.id]; if (!id) return;
  if (id >= 34 && id <= 44) { TR.evento(p, TR.EV.aroToque); TR.evento(p, TR.EV.aroUso); } else if (id >= 45 && id <= 49) TR.evento(p, TR.EV.pad);
  TR.evento(p, id);
};
TR.aterrizaje = function (p, v) { const a = Math.abs(v); TR.evento(p, a >= 15 ? 5 : a >= 9 ? 4 : a >= 5 ? 3 : a >= 2 ? 2 : 1); };

// ---------- opciones (2899): cada una prende (1), apaga (-1) o deja (0) ----------
H.opciones = function (p, o, r) {
  const op = p.tr.opc = p.tr.opc || {};
  const set = (k, clave) => { const v = r[clave] | 0; if (v) op[k] = v === 1; };
  set('estelaAditiva', 159); set('sinPiso', 161); set('sinMedio', 195); set('ocultarJ1', 162); set('ocultarJ2', 163); set('sinControlJ1', 165); set('sinControlJ2', 199);
  set('gravDualSuelta', 160); set('sinIntentos', 532); set('audioAlMorir', 575); set('sinSonidoMuerte', 576); set('deslizar', 593);
  if ((r[573] | 0) === 1) op.respawn = n(r[574], 1); else if ((r[573] | 0) === -1) delete op.respawn;
  if (op.ocultarJ1 !== undefined) p.j.vis = !op.ocultarJ1;
  if (op.ocultarJ2 !== undefined && p.j2) p.j2.vis = !op.ocultarJ2;
  if (p.lblIntento && op.sinIntentos) p.lblIntento.vis = false;
};

// ---------- fondo, piso y medio ----------
H.cambiarFondo = (p, o, r) => { const v = r[533] | 0; if (v) p.cambiarFondo && p.cambiarFondo('fondo', v); };
H.cambiarPiso = (p, o, r) => { const v = r[533] | 0; if (v) p.cambiarFondo && p.cambiarFondo('piso', v); };
H.cambiarMedio = (p, o, r) => { p.cambiarFondo && p.cambiarFondo('medio', r[533] | 0); };
H.velFondo = (p, o, r) => { p.tr.velFondo = [n(r[143], 1), n(r[144], 1)]; };
H.velMedio = (p, o, r) => { p.tr.velMedio = [n(r[143], 1), n(r[144], 1)]; };
H.medioEdit = (p, o, r) => { TR.accion(p, { k: 'medio', ini: p.tr.medioY || 0, fin: n(r[29]), dur: n(r[10], 0), e: r[30] | 0, r: n(r[85], 2) }); };

// ---------- jugador ----------
H.gravedad = function (p, o, r) {
  const g = n(r[148], 1), uno = r[138] == 1, dos = r[200] == 1;
  if (uno || !dos) p.j.gravMod = g; if ((dos || !uno) && p.j2) p.j2.gravMod = g;
};
H.controlJ = function (p, o, r) {
  const js = []; if (r[138] == 1 || r[200] != 1) js.push(p.j); if (r[200] == 1 && p.j2) js.push(p.j2);
  for (const j of js) {
    if (r[540] == 1 && (j.grav > 0 ? j.yv > 0 : j.yv < 0)) { j.yv = 0; j.subiendo = false; j.robotT = 1e9; }
    if (r[541] == 1) j.vx = 0;
    if (r[542] == 1) j.rot = Math.round(j.rot / 90) * 90;
    if (r[543] == 1) j.vx = 0;
  }
};
H.reversa = function (p) { for (const j of [p.j, p.j2]) if (j) j.dir = -j.dir; TR.evento(p, TR.EV.reversa); };
// teletransporte al centro del grupo 51 (ignorando x/y si se pide, con la gravedad de salida 354)
H.teleport = function (p, o, r) {
  const c = TR.centro(p, r[51] | 0); if (!c) return;
  for (const j of [p.j, p.j2]) {
    if (!j) continue;
    if (r[352] != 1) j.x = c[0]; if (r[353] != 1) j.y = c[1];
    const gs = r[354] | 0; if (gs === 1) j.cambiarGravedad(1, false); else if (gs === 2) j.cambiarGravedad(-1, false); else if (gs === 3) j.cambiarGravedad(-j.grav, false);
    if (r[345] == 1) j.yv = (r[443] == 1 ? j.yv : 0) + n(r[346]) * j.grav;
    j.prevX = j.x; j.prevY = j.y;
  }
  if (p.j.esVuelo() && !p.limites) p.ponerLimites(p.j, p.j.y, true);
  TR.evento(p, TR.EV.teleport);
};
TR.teleportAro = function (p, j, o) { H.teleport(p, o, o.raw); };
// fin (3600): spawnea su grupo y termina el nivel (en plataformas es la única forma de terminar)
H.fin = function (p, o, r) { if (r[51]) TR.spawnearGrupo(p, r[51] | 0); p.terminar(); };
// borde de cámara: la cámara no pasa del grupo en ese lado (1 izq, 2 der, 3 arriba, 4 abajo)
H.camBorde = function (p, o, r) { const lado = r[164] | 0; if (!lado) return; const b = p.tr.bordes = p.tr.bordes || {}; if (r[51]) b[lado] = r[51] | 0; else delete b[lado]; };
TR.aplicarBordes = function (p) {
  const b = p.tr && p.tr.bordes; if (!b) return;
  const D = GD.D, z = p.zoom || 1, W = D.ancho / z, Hh = D.alto / z;
  for (const lado in b) {
    const c = TR.centro(p, b[lado]); if (!c) continue;
    if (lado == 1 && p.camX < c[0]) p.camX = c[0];
    if (lado == 2 && p.camX + W > c[0]) p.camX = c[0] - W;
    if (lado == 3 && p.camY + Hh > c[1]) p.camY = c[1] - Hh;
    if (lado == 4 && p.camY < c[1]) p.camY = c[1];
  }
};

// ---------- sonido: SFX (3602/3603) y canciones (1934/3605) ----------
// cada sonido puede tener un id único (416) o grupo (455) para editarlo o pararlo después; el
// volumen puede depender de la distancia entre el jugador (o la cámara) y un grupo
const sonidos = []; // {fuente, gan, uid, grupo, prox}
TR.sonidos = sonidos;
const volProx = function (p, s) {
  const q = s.prox; if (!q) return 1;
  const c = TR.centro(p, q.g); if (!c) return 1;
  const j = p.j, d = Math.hypot(c[0] - j.x, c[1] - j.y);
  if (d <= q.d1) return q.v1; if (d <= q.d2) return q.v1 + (q.v2 - q.v1) * (d - q.d1) / Math.max(1, q.d2 - q.d1);
  if (d <= q.d3) return q.v2 + (q.v3 - q.v2) * (d - q.d2) / Math.max(1, q.d3 - q.d2); return q.v3;
};
TR.pasoSonidos = function (p) { for (const s of sonidos) if (s.prox && s.gan) s.gan.gain.value = s.vol * volProx(p, s) * GD.S.vSfx; };
TR.pararSonidos = function () { for (const s of sonidos.splice(0)) { try { s.fuente.stop(); } catch (e) { } } };
const reproducir = async function (p, ruta, r, esCancion) {
  const S = GD.S; if (!S.ctx || p.opc.silencio) return;
  const buf = await S.cargar(ruta); if (!buf || p.muerto || p.terminada) return;
  const az = v => (Math.random() * 2 - 1) * (+v || 0);
  const uid = r[416] | 0, grupo = r[455] | 0;
  if (r[415] == 1 && uid && sonidos.some(s => s.uid === uid)) { if (r[420] == 1) for (const s of sonidos.filter(s => s.uid === uid)) { try { s.fuente.stop(); } catch (e) { } } else return; }
  const f = S.ctx.createBufferSource(); f.buffer = buf; f.loop = r[413] == 1;
  const vel = n(r[404]) + az(r[596]), tono = n(r[405]) + az(r[597]);
  f.playbackRate.value = Math.pow(2, vel / 12); if (tono) f.detune.value = tono * 100;
  const g = S.ctx.createGain(), vol = Math.max(0, n(r[406], 1) + az(r[598]));
  const ini = n(r[408]) / 1000, fin = n(r[410]) / 1000, fi = n(r[409]) / 1000, fo = n(r[411]) / 1000, ahora = S.ctx.currentTime;
  const s = { fuente: f, gan: g, uid, grupo, vol, cancion: esCancion ? (r[432] | 0) : null };
  if (r[51] && (r[138] == 1 || r[200] == 1 || r[428] == 1 || true) && (r[421] !== undefined || r[422] !== undefined))
    s.prox = { g: r[51] | 0, v1: n(r[421], 1), v2: n(r[422], 0.5), v3: n(r[423], 0), d1: n(r[424], 30), d2: n(r[425], 150), d3: n(r[426], 300) };
  g.gain.value = vol * volProx(p, s) * (esCancion ? S.vMus : S.vSfx);
  if (fi > 0) { g.gain.setValueAtTime(0, ahora); g.gain.linearRampToValueAtTime(g.gain.value || vol, ahora + fi); }
  f.connect(g); g.connect(esCancion ? S.gm : S.gs);
  const largo = fin > ini ? fin - ini : undefined;
  if (f.loop) { f.loopStart = ini; if (fin > ini) f.loopEnd = fin; f.start(0, ini); }
  else f.start(0, ini, largo);
  if (fo > 0 && largo) { g.gain.setValueAtTime(g.gain.value, ahora + Math.max(0, largo / f.playbackRate.value - fo)); g.gain.linearRampToValueAtTime(0, ahora + largo / f.playbackRate.value); }
  sonidos.push(s); f.onended = () => { const i = sonidos.indexOf(s); if (i >= 0) sonidos.splice(i, 1); };
};
H.sfx = function (p, o, r) { const id = r[392] | 0; if (id) reproducir(p, `datos/sfx/s${id}.ogg`, r, false); };
H.sfxEdit = function (p, o, r) {
  const uid = r[416] | 0, grupo = r[455] | 0;
  for (const s of sonidos.slice()) {
    if (s.cancion !== null) continue;
    if (!((uid && s.uid === uid) || (grupo && s.grupo === grupo))) continue;
    if (r[417] == 1) { try { s.fuente.stop(); } catch (e) { } continue; }
    if (r[414] == 1) s.fuente.loop = false;
    if (r[419] == 1) s.fuente.playbackRate.value = Math.pow(2, n(r[404]) / 12);
    if (r[418] == 1) { s.vol = n(r[406], 1); s.gan.gain.linearRampToValueAtTime(s.vol * GD.S.vSfx, GD.S.ctx.currentTime + Math.max(0.01, n(r[10]))); }
  }
};
H.cancion = function (p, o, r) {
  const id = r[392] | 0; if (!id || r[399] == 1) return; // "preparar": sólo carga
  const ruta = GD.Online && GD.Online.rutaCancion ? GD.Online.rutaCancion(id) : `datos/mus/${id}.ogg`;
  const canal = r[432] | 0;
  for (const s of sonidos.filter(s => s.cancion === canal)) { try { s.fuente.stop(); } catch (e) { } }
  if (canal === 0 && r[595] != 1) GD.S.pararMusica();
  reproducir(p, ruta, r, true);
};
H.editarCancion = function (p, o, r) {
  const canal = r[432] | 0, t = Math.max(0.01, n(r[10]));
  const lista = sonidos.filter(s => s.cancion === canal);
  if (canal === 0 && GD.S.mGan && !lista.length) lista.push({ fuente: GD.S.mNodo, gan: GD.S.mGan, cancion: 0 });
  for (const s of lista) {
    if (!s.fuente) continue;
    if (r[417] == 1) { try { s.fuente.stop(); } catch (e) { } continue; }
    if (r[414] == 1) s.fuente.loop = false;
    if (r[419] == 1) s.fuente.playbackRate.linearRampToValueAtTime(Math.pow(2, n(r[404]) / 12), GD.S.ctx.currentTime + t);
    if (r[418] == 1) s.gan.gain.linearRampToValueAtTime(n(r[406], 1) * GD.S.vMus, GD.S.ctx.currentTime + t);
  }
};

// ---------- contador en pantalla (1615): muestra un item, un timer o los puntos/intentos/tiempo ----------
GD.O.textoContador = function (p, o) {
  const r = o.raw, esp = r[390] | 0, id = r[80] | 0;
  let v;
  if (esp === -1) v = p.tiempo; else if (esp === -2) v = p.tr.puntos || 0; else if (esp === -3) v = p.intentos;
  else if (r[466] == 1) v = p.tr.timers[id] ? p.tr.timers[id].v : 0; else v = p.tr.items[id] || 0;
  if (r[466] == 1 || esp === -1) {
    if (r[389] == 1) return String(Math.floor(v));
    const m = Math.floor(v / 60), s = v - m * 60; return (m ? m + ':' + (s < 10 ? '0' : '') : '') + s.toFixed(2);
  }
  return String(Math.round(v * 1000) / 1000);
};
})();
