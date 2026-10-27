// ---------------------------------------------------------------------------------------------------------
// multijugador sin servidor propio: broker MQTT público como relevo (igual que en nuestros otros porteos).
// Salas como el juego: lista de servidores (oficiales por mapa y creados por jugadores, con clave) y un jugador.
// Temas: ROOM/e (estado de cada jugador), ROOM/w/ID (sus cosas, retenido: el que entra las recibe y se borra
// solo cuando se va), ROOM/m (cosas que se mueven, 10 por segundo), ROOM/a (hechos: tiros, explosiones,
// daño, reclamos) y ROOM/c (chat). Cada uno simula lo suyo; si agarrás algo de otro, lo reclamás.
// ---------------------------------------------------------------------------------------------------------
const NS = 'hypper_jx7_v1_';
const BROKER = Q.get('broker') || 'wss://broker.emqx.io:8084/mqtt';
const RED = { cli: null, on: false, ROOM: '', ID: '', remotos: new Map(), objs: new Map(), ultE: 0, ultM: 0, ultW: 0, wSucio: false, eAnt: '', n: 0 };
const num = (v, a, b, d) => (typeof v === 'number' && isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
const limpio = (s, n) => String(s || '').replace(/[\u0000-\u001f<>&"'`\\]/g, '').trim().slice(0, n || 16);
function idRed() {
  try { let id = sessionStorage.getItem('hyp.id'); if (!id) { id = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); sessionStorage.setItem('hyp.id', id); } return id; }
  catch (e) { return Math.random().toString(36).slice(2, 11); }
}
// ---------------- salas y lista de servidores ----------------
// Salas oficiales (una por mapa, siempre listadas) y las que crean los jugadores (nombre, mapa, modo, clave,
// máximo y reglas: PvP, RPG, Nextbot, tope de props y de vehículos). La lista sale de la "presencia": cada
// jugador deja un mensaje retenido en NS/l/ID con la sala donde está (y un testamento que lo borra si se
// corta), por una conexión aparte y liviana que también se usa en el menú para ver quién juega dónde.
let SALA = null;
const LISTA = { cli: null, on: false, pres: new Map(), ultP: 0 };
const SALAS_OF = MAPAS.map((m) => ({ id: 'f_' + m + '_1', n: 'Hypper ' + m, m, mo: 'Free', mx: 20, of: 1, pvp: 1, rpg: 1, nb: 1, mp: 1000, mv: 40 }));
function hashTxt(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function topicoSala(S) { return NS + (S.of ? S.id : 'r_' + S.id + (S.clave ? '_' + hashTxt('k' + S.id + S.clave) : '')); }
function salaLimpia(x) {
  if (!x || typeof x.id !== 'string' || !/^[a-zA-Z0-9_]{3,40}$/.test(x.id)) return null;
  const S = { id: x.id, n: limpio(x.n, 24) || 'Server', m: MAPAS.includes(x.m) ? x.m : 'Desert', mo: x.mo === 'PvP' ? 'PvP' : 'Free', mx: num(x.mx, 2, 32, 16) | 0, of: x.of ? 1 : 0,
    pvp: x.pvp ? 1 : 0, rpg: x.rpg ? 1 : 0, nb: x.nb ? 1 : 0, mp: num(x.mp, 0, 5000, 1000) | 0, mv: num(x.mv, 0, 200, 40) | 0, pw: x.pw ? 1 : 0, ph: typeof x.ph === 'string' ? x.ph.slice(0, 12) : '',
    du: typeof x.du === 'string' && /^[a-z0-9]{3,20}$/.test(x.du) ? x.du : '' };
  if (S.of) { const o = SALAS_OF.find((y) => y.id === S.id); if (!o) return null; return o; }
  return S;
}
function listaConectar() {
  if (LISTA.cli || typeof mqtt === 'undefined' || Q.get('sinred')) return;
  RED.ID = RED.ID || idRed();
  let cli;
  try {
    cli = mqtt.connect(BROKER, { clientId: NS + 'l_' + RED.ID + '_' + Math.random().toString(36).slice(2, 6), clean: true, reconnectPeriod: 4000, connectTimeout: 9000, keepalive: 40,
      will: { topic: NS + 'l/' + RED.ID, payload: '', retain: true, qos: 0 } });
  } catch (e) { return; }
  LISTA.cli = cli;
  cli.on('connect', () => { LISTA.on = true; cli.subscribe(NS + 'l/+'); presencia(); listaDibujar(); });
  cli.on('close', () => { LISTA.on = false; });
  cli.on('message', (t, m) => {
    try {
      const id = t.slice((NS + 'l/').length); if (!/^[a-z0-9]{3,20}$/.test(id)) return;
      const s = m.toString(); if (!s) { LISTA.pres.delete(id); listaPronto(); return; }
      const d = JSON.parse(s), S = salaLimpia(d && d.s);
      if (!S) { LISTA.pres.delete(id); listaPronto(); return; }
      LISTA.pres.set(id, { s: S, j: limpio(d.j), t: num(d.t, 0, 1e11, 0) }); listaPronto();
    } catch (e) {}
  });
}
// mi presencia: en qué sala estoy (o nada)
function presencia() {
  if (!LISTA.on) return;
  LISTA.ultP = TIEMPO.t;
  const S = SALA && RED.cli ? Object.assign({}, SALA) : null; if (S) delete S.clave;
  try { LISTA.cli.publish(NS + 'l/' + RED.ID, S ? JSON.stringify({ s: S, j: PREFS.nombre, t: Math.round(Date.now() / 1000) }) : '', { retain: true, qos: 0 }); } catch (e) {}
}
let _listaT = 0;
function listaPronto() { if (_listaT) return; _listaT = setTimeout(() => { _listaT = 0; listaDibujar(); }, 250); }
function listaPedir() {
  // vuelve a leer los retenidos (re-suscribirse los manda de nuevo)
  if (LISTA.on) { LISTA.pres.clear(); try { LISTA.cli.unsubscribe(NS + 'l/+'); LISTA.cli.subscribe(NS + 'l/+'); } catch (e) {} }
  else listaConectar();
  listaDibujar();
}
function listaSalas() {
  const ahora = Date.now() / 1000, M = new Map();
  for (const S of SALAS_OF) M.set(S.id, { S, j: [] });
  for (const [id, p] of LISTA.pres) {
    if (p.t && ahora - p.t > 900) continue;
    let e = M.get(p.s.id); if (!e) { e = { S: p.s, j: [] }; M.set(p.s.id, e); }
    e.j.push(p.j || '?');
  }
  return [...M.values()].sort((a, b) => b.j.length - a.j.length || a.S.of - b.S.of || a.S.n.localeCompare(b.S.n));
}
function listaContadores() {
  if (typeof nodo !== 'function' || !MENU.el) return;
  const L = listaSalas(), jug = L.reduce((a, e) => a + e.j.length, 0), act = L.filter((e) => e.j.length).length;
  uiTextoPoner(nodo('Main/Multiplayer/ServerList/UpPanel/Players'), `${Lc('Players', 'Players')}: ${jug}`);
  uiTextoPoner(nodo('Main/Multiplayer/ServerList/UpPanel/Servers'), `${Lc('Servers', 'Servers')}: ${L.length}`);
  uiTextoPoner(nodo('Main/Multiplayer/Main/Server List/Players/PlayerCount'), String(jug));
  uiTextoPoner(nodo('Main/Multiplayer/Main/Server List/Rooms/RoomCount'), String(act));
}
function listaDibujar() {
  listaContadores();
  const cont = typeof nodo === 'function' && nodo('Main/Multiplayer/ServerList/ServerList/RoomList/ScrollRect');
  if (!cont || MENU.mp !== 'ServerList') return;
  const f = (MENU.ent.FindServerInputField && MENU.ent.FindServerInputField.value || '').trim().toLowerCase();
  const L = listaSalas().filter((e) => !f || e.S.n.toLowerCase().includes(f) || e.S.m.toLowerCase().includes(f));
  cont.el.innerHTML = '';
  const est = document.createElement('div'); est.className = 'salaEst';
  est.textContent = LISTA.on ? '' : Lc('Connecting', 'Connecting') + '…'; cont.el.appendChild(est);
  for (const e of L) {
    const S = e.S, d = document.createElement('div'); d.className = 'sala';
    d.innerHTML = `<i class="salaMapa" style="background-image:url(${icono(MAPA_ICONO[S.m])})"></i><b class="salaN"></b><span class="salaD"></span>` +
      `<span class="salaJ"><i style="-webkit-mask-image:url(${icono('TechnologyIcon_5')});mask-image:url(${icono('TechnologyIcon_5')})"></i>${e.j.length}/${S.mx}</span>` +
      (S.pw ? `<i class="salaPw" style="background-image:url(${icono('IconHide')})"></i>` : '') + `<button class="salaB">${Lc('Join', 'Join')}</button>`;
    d.querySelector('.salaN').textContent = S.n;
    d.querySelector('.salaD').textContent = `${S.m} · ${S.mo}${S.pvp ? '' : ' · ' + Lc('NoPvP', 'No PvP')}${e.j.length ? ' · ' + e.j.slice(0, 4).join(', ') : ''}`;
    d.querySelector('.salaB').onclick = () => entrarSala(S, undefined, e.j.length);
    cont.el.appendChild(d);
  }
}
function entrarSala(S, clave, n) {
  if (n === undefined) { const e = listaSalas().find((x) => x.S.id === S.id); n = e ? e.j.length : 0; }
  if (n >= S.mx) { menuAviso(Lc('ServerFull', 'Server is full')); return; }
  if (S.pw && clave === undefined) { MENU.salaPw = S; if (MENU.ent.Password && nodo('Main/PasswordPanel/Password/Password')) nodo('Main/PasswordPanel/Password/Password').inp.value = ''; overlay('PasswordPanel', true); return; }
  SALA = Object.assign({}, S, { clave: clave || '' });
  PREFS.mapa = S.m; guardarPrefs();
  empezarPartida(S.m);
}
function comprobarClave() {
  const S = MENU.salaPw, c = nodo('Main/PasswordPanel/Password/Password'), v = c && c.inp ? c.inp.value.trim() : '';
  if (!S) return;
  if (hashTxt('c' + S.id + v) !== S.ph) { menuAviso('Contraseña incorrecta'); return; }
  overlay('PasswordPanel', false); entrarSala(S, v);
}
function crearServidor() {
  const E = MENU.ent, nom = limpio(E.ServerNameFieldNew && E.ServerNameFieldNew.value, 24) || (PREFS.nombre + "'s server"), clave = limpio(E.Password && E.Password.value, 16);
  const id = Math.random().toString(36).slice(2, 10);
  const S = { id, n: nom, m: PREFS.mapa, mo: MENU.sel.GameModeDropdown || 'Free', mx: +(MENU.sel.PlayersDropdown || 6), of: 0,
    pvp: MENU.tg.PvPToogle ? 1 : 0, rpg: MENU.tg.RPGToogle ? 1 : 0, nb: MENU.tg.NextbotToogle ? 1 : 0,
    mp: num(+(E.MaxPropInputField && E.MaxPropInputField.value), 0, 5000, 1000) | 0, mv: num(+(E.MaxVechiclesInputField && E.MaxVechiclesInputField.value), 0, 200, 40) | 0,
    pw: clave ? 1 : 0, ph: clave ? hashTxt('c' + id + clave) : '', du: (RED.ID = RED.ID || idRed()) };
  if (S.mo === 'PvP') S.pvp = 1;
  SALA = Object.assign(S, { clave });
  empezarPartida(S.m);
}
// botón Multiplayer: conecta la lista y abre el panel (como "Connect" del juego)
function conectarMultijugador() {
  listaConectar();
  if (LISTA.on || typeof mqtt === 'undefined') { seccion('Multiplayer'); subMp('Main'); return; }
  verNodo(nodo('Connecting'), true);
  const t0 = performance.now(), mirar = () => {
    if (LISTA.on || performance.now() - t0 > 6000) { verNodo(nodo('Connecting'), false); seccion('Multiplayer'); subMp('Main'); if (!LISTA.on) menuAviso('Sin conexión con los servidores'); return; }
    setTimeout(mirar, 150);
  };
  mirar();
}
function redEntrar(mapa) {
  redSalir();
  if (!SALA || typeof mqtt === 'undefined') { redEstadoUI(); return; }
  listaConectar();
  RED.ID = RED.ID || idRed(); RED.ROOM = topicoSala(SALA);
  let cli;
  try {
    cli = mqtt.connect(BROKER, { clientId: NS + RED.ID + '_' + Math.random().toString(36).slice(2, 6), clean: true, reconnectPeriod: 3000, connectTimeout: 9000, keepalive: 30,
      will: { topic: RED.ROOM + '/w/' + RED.ID, payload: '', retain: true, qos: 0 } });
  } catch (e) { return; }
  RED.cli = cli;
  // cada conexión sólo toca el estado si sigue siendo la actual (al cambiar de sala, el cierre de la vieja
  // llega después de abrir la nueva y no tiene que apagarla)
  cli.on('connect', () => { if (RED.cli !== cli) return; RED.on = true; cli.subscribe(RED.ROOM + '/#'); RED.wSucio = true; redEstadoUI(); presencia(); chatMostrar('★', Lc('Connected', 'Connected') + ': ' + SALA.n); if (soyAnfitrion()) hostPublicar(); });
  cli.on('close', () => { if (RED.cli !== cli) return; RED.on = false; redEstadoUI(); });
  cli.on('message', (t, m) => { if (RED.cli !== cli) return; try { redMensaje(t, m); } catch (e) {} });
  redEstadoUI();
}
function redSalir() {
  if (!RED.cli) return;
  try { RED.cli.publish(RED.ROOM + '/w/' + RED.ID, '', { retain: true }); publicar('a', { k: 'chau' }); const c = RED.cli; setTimeout(() => { try { c.end(false); } catch (e) {} }, 50); } catch (e) {}
  RED.cli = null; RED.on = false; presencia();
  for (const R2 of RED.remotos.values()) quitarRemoto(R2);
  RED.remotos.clear(); for (const o of RED.objs.values()) borrarObjeto(o, true); RED.objs.clear();
  redEstadoUI();
}
function publicar(c, obj, ret) {
  if (!RED.on) return;
  obj.i = RED.ID;
  try { RED.cli.publish(RED.ROOM + '/' + c, JSON.stringify(obj), { qos: 0, retain: !!ret }); } catch (e) {}
}
function redEstadoUI() {
  const e = $('redEst'); if (!e) return;
  e.textContent = !SALA ? Lc('Singleplayer', 'Singleplayer') : RED.on ? `${SALA.n} · ${RED.remotos.size + 1}/${SALA.mx}` : Lc('Connecting', 'Connecting') + '…';
}
const r3 = (v) => Math.round(v * 1000) / 1000, r4 = (v) => Math.round(v * 10000) / 10000;
// ---------------- lo que mando ----------------
function redPaso(dt) {
  if (!RED.on) return;
  const t = TIEMPO.t;
  for (const R2 of RED.remotos.values()) remotoPaso(R2, dt);
  for (const o of RED.objs.values()) objRemotoPaso(o, dt);
  redCedidosPaso(dt);
  if (t - LISTA.ultP > 120) presencia();
  if (t - RED.ultE > 0.1) {
    const J = JUG, f = (J.suelo ? 1 : 0) | (ENT.agachar ? 2 : 0) | (J.vivo ? 4 : 0) | (J.vehiculo ? 8 : 0);
    const e = { n: PREFS.nombre, k: PREFS.skin, h: PREFS.gorro, p: [r3(J.pos.x), r3(J.pos.y), r3(J.pos.z)], y: r3(J.yaw), t: r3(J.pitch), v: [r3(J.vel.x), r3(J.vel.y), r3(J.vel.z)], f, a: ARM.lista[ARM.i],
      e: JUG.cuerpo && JUG.cuerpo.emote || 0, w: J.vehiculo ? [claveObj(J.vehiculo), J.asiento] : 0 };
    const s = JSON.stringify(e);
    if (s !== RED.eAnt || t - RED.ultE > 1) { publicar('e', e); RED.eAnt = s; RED.ultE = t; }
  }
  if (t - RED.ultM > 0.1) {
    RED.ultM = t; const l = [];
    for (const o of OBJS) if (!o.remoto && (!o.auth || o.auth === RED.ID) && !o.b.sleep && !o.b.frozen && l.length < 40) l.push([o.id, r3(o.b.pos.x), r3(o.b.pos.y), r3(o.b.pos.z), r4(o.b.q.x), r4(o.b.q.y), r4(o.b.q.z), r4(o.b.q.w)]);
    // los de otros que ahora simulo yo
    for (const o of RED.objs.values()) if (o.auth === RED.ID && !o.b.sleep && l.length < 50) l.push([o.key, r3(o.b.pos.x), r3(o.b.pos.y), r3(o.b.pos.z), r4(o.b.q.x), r4(o.b.q.y), r4(o.b.q.z), r4(o.b.q.w)]);
    if (l.length) publicar('m', { l });
  }
  if (RED.wSucio || t - RED.ultW > 8) {
    RED.wSucio = false; RED.ultW = t;
    const o = OBJS.filter((x) => !x.remoto).slice(-300).map((x) => [x.id, x.nombre, r3(x.b.pos.x), r3(x.b.pos.y), r3(x.b.pos.z), r4(x.b.q.x), r4(x.b.q.y), r4(x.b.q.z), r4(x.b.q.w), x.b.frozen ? 1 : 0]);
    publicar('w/' + RED.ID, { o }, true);
  }
  redEstadoUI();
}
const claveObj = (o) => (o.remoto ? o.key : RED.ID + ':' + o.id);
function redObjeto() { RED.wSucio = true; }
function redRecarga() { publicar('a', { k: 'rec' }); }
function redDisparo(arma) { publicar('a', { k: 'tiro', a: arma, p: [r3(CAM.pos.x), r3(CAM.pos.y), r3(CAM.pos.z)], d: [r3(CAM.fwd.x), r3(CAM.fwd.y), r3(CAM.fwd.z)] }); }
function redExplosion(p) { publicar('a', { k: 'exp', p: [r3(p.x), r3(p.y), r3(p.z)] }); }
function redDano(P, dan, d) { publicar('a', { k: 'dano', to: P.remoto, d: Math.round(dan), v: [r3(d.x), r3(d.y), r3(d.z)] }); }
function redChat(t) { publicar('c', { n: PREFS.nombre, t: t.slice(0, 120) }); }
function redEmote() {}
function redSubir() { RED.ultE = 0; }
function redReclamar(o) {
  if (!RED.on || !o.auth || o.auth === RED.ID) return;
  o.auth = RED.ID; o.b.frozen = !!o.congReal; o.b.wake(); if (RED.cedidos) RED.cedidos.delete(o);
  publicar('a', { k: 'claim', o: claveObj(o) });
}
function redBorrar(o) { RED.wSucio = true; if (o.remoto) publicar('a', { k: 'borra', o: o.key }); }
// ---------------- lo que llega ----------------
function redMensaje(topic, m) {
  const sub = topic.slice(RED.ROOM.length + 1), s = m.toString();
  if (sub.startsWith('w/')) { const id = sub.slice(2); if (id === RED.ID) return; recibirMundo(id, s ? JSON.parse(s) : null); return; }
  if (!s) return;
  const d = JSON.parse(s); if (!d || typeof d.i !== 'string' || d.i === RED.ID || d.i.length > 20) return;
  if (sub === 'e') recibirEstado(d);
  else if (sub === 'm') recibirMov(d);
  else if (sub === 'a') { if (!hostHecho(d)) recibirHecho(d); }
  else if (sub === 'cfg') recibirCfg(d);
  else if (sub === 'c' && typeof d.t === 'string') { chatMostrar(limpio(d.n), limpio(d.t, 120)); }
}
function recibirEstado(d) {
  let R2 = RED.remotos.get(d.i);
  const skin = DATA.chars.includes(d.k) ? d.k : 'Hero', gorro = DATA.hats.includes(d.h) ? d.h : 'HatEmpty';
  if (!R2 || R2.skin !== skin || R2.gorro !== gorro) {
    if (R2) quitarRemoto(R2);
    const P = crearPersona(skin, gorro, { nombre: limpio(d.n) }); P.remoto = d.i;
    const b = new Body(capsuleShape(0.4, 0.5), 80); b.frozen = true; b.persona = P; b.noJug = false; b.noGrab = true; addBody(b);
    const tag = document.createElement('div'); tag.className = 'etiqueta'; $('hud').appendChild(tag);
    R2 = { id: d.i, skin, gorro, P, b, tag, pos: v3(), meta: v3(), yaw: 0, yawM: 0, vel: v3(), t: TIEMPO.t, f: 0, nombre: '' };
    RED.remotos.set(d.i, R2); chatMostrar('★', limpio(d.n) + ' entró');
  }
  if (Array.isArray(d.p)) { R2.meta.set(num(d.p[0], -1e4, 1e4, 0), num(d.p[1], -1e4, 1e4, 0), num(d.p[2], -1e4, 1e4, 0)); if (TIEMPO.t - R2.t > 2) R2.pos.copy(R2.meta); }
  if (Array.isArray(d.v)) R2.vel.set(num(d.v[0], -80, 80, 0), num(d.v[1], -80, 80, 0), num(d.v[2], -80, 80, 0));
  R2.yawM = num(d.y, -1e3, 1e3, 0); R2.P.mira = num(d.t, -2, 2, 0); R2.f = d.f | 0; R2.t = TIEMPO.t;
  R2.nombre = limpio(d.n); R2.tag.textContent = R2.nombre;
  R2.P.arma = DEF_ARMAS[d.a] ? d.a : null;
  const em = typeof d.e === 'string' && DATA.emotes.includes(d.e) ? d.e : null;
  if (em && R2.P.emote !== em) { R2.P.emote = em; R2.P.emoteT = 0; } else if (!em) R2.P.emote = null;
  R2.veh = Array.isArray(d.w) ? { k: String(d.w[0]), a: d.w[1] | 0 } : null;
}
function remotoPaso(R2, dt) {
  if (TIEMPO.t - R2.t > 10) { quitarRemoto(R2); RED.remotos.delete(R2.id); return; }
  const P = R2.P, k = 1 - Math.exp(-dt * 12);
  R2.meta.addS(R2.vel, dt * 0.5);
  R2.pos.lerpTo(R2.meta, k);
  let dy = R2.yawM - R2.yaw; dy = ((dy + Math.PI) % TAU + TAU) % TAU - Math.PI; R2.yaw += dy * k;
  P.pos.copy(R2.pos); P.yaw = R2.yaw; P.vel.copy(R2.vel); P.suelo = !!(R2.f & 1); P.agachado = !!(R2.f & 2); P.sentado = !!(R2.f & 8);
  // si va en un vehículo, el cuerpo sigue al asiento
  if (R2.veh) { const o = buscarObjeto(R2.veh.k); if (o && o.veh) { const a = o.veh.asientos[R2.veh.a] || v3(); P.pos.copy(vadd(o.b.pos, o.b.q.rot(vadd(a, v3(0, 0.25, 0))))); const f = o.b.q.rot(v3(0, 0, 1)); P.yaw = Math.atan2(f.x, f.z); P.manejando = R2.veh.a === 0; P.qVeh = o.b.q; } } else P.qVeh = null;
  const vivo = !!(R2.f & 4);
  if (!vivo && !P.rag) { P.vel.copy(R2.vel); ragdoll(P, null); } else if (vivo && P.rag) ragdollFin(P);
  R2.b.pos.copy(P.pos); R2.b.updateWorld(); R2.b.noRay = !vivo;
  // etiqueta con el nombre sobre la cabeza
  const cp = vadd(P.pos, v3(0, 1.25, 0)), cl = clipDe(cp);
  if (cl && cp.distTo(CAM.pos) < 60) { R2.tag.style.display = ''; R2.tag.style.transform = `translate(${cl.x}px,${cl.y}px) translate(-50%,-100%)`; } else R2.tag.style.display = 'none';
}
function clipDe(p) {
  const m = R.vpMundo || R.vp, x = m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12], y = m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13], w = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15];
  if (w <= 0.1) return null; return { x: (x / w * 0.5 + 0.5) * VW(), y: (0.5 - y / w * 0.5) * VH() };
}
function quitarRemoto(R2) { borrarPersona(R2.P); removeBody(R2.b); R2.tag.remove(); for (const o of [...RED.objs.values()]) if (o.dueno === R2.id) { borrarObjeto(o, true); RED.objs.delete(o.key); } chatMostrar('★', (R2.nombre || 'Alguien') + ' salió'); }
function buscarObjeto(k) {
  if (RED.objs.has(k)) return RED.objs.get(k);
  if (k.startsWith(RED.ID + ':')) { const id = +k.slice(RED.ID.length + 1); return OBJS.find((o) => o.id === id && !o.remoto); }
  return null;
}
function recibirMundo(id, d) {
  const vivos = new Set();
  if (d && Array.isArray(d.o)) for (const x of d.o.slice(0, 300)) {
    if (!Array.isArray(x) || typeof x[1] !== 'string' || !DATA.pfPorNombre[x[1]]) continue;
    const key = id + ':' + (x[0] | 0); vivos.add(key);
    let o = RED.objs.get(key);
    const p = v3(num(x[2], -1e4, 1e4, 0), num(x[3], -1e4, 1e4, 0), num(x[4], -1e4, 1e4, 0)), q = new Quat(num(x[5], -1, 1, 0), num(x[6], -1, 1, 0), num(x[7], -1, 1, 0), num(x[8], -1, 1, 1)).norm();
    if (!o) {
      o = crearObjeto(x[1], p, q, { dueno: id, congelado: true }); if (!o) continue;
      o.remoto = true; o.key = key; o.auth = id; o.congReal = !!x[9]; o.b.pos.copy(p); o.b.q.copy(q); o.b.updateWorld(); o.meta = { p: p.clone(), q: q.clone() };
      RED.objs.set(key, o);
    } else if (o.auth !== RED.ID) { o.meta.p.copy(p); o.meta.q.copy(q); o.congReal = !!x[9]; }
  }
  for (const [k, o] of [...RED.objs]) if (o.dueno === id && !vivos.has(k)) { borrarObjeto(o, true); RED.objs.delete(k); }
}
function recibirMov(d) {
  if (!Array.isArray(d.l)) return;
  for (const x of d.l.slice(0, 60)) {
    if (!Array.isArray(x)) continue;
    const key = typeof x[0] === 'string' ? x[0] : d.i + ':' + (x[0] | 0);
    const o = buscarObjeto(key); if (!o) continue;
    if (!o.remoto) { // alguien simula algo mío (lo reclamó)
      if (o.auth !== d.i) continue;
    } else if (o.auth !== d.i && !(o.auth === o.dueno && d.i === o.dueno)) continue;
    const p = v3(num(x[1], -1e4, 1e4, 0), num(x[2], -1e4, 1e4, 0), num(x[3], -1e4, 1e4, 0)), q = new Quat(num(x[4], -1, 1, 0), num(x[5], -1, 1, 0), num(x[6], -1, 1, 0), num(x[7], -1, 1, 1)).norm();
    o.meta = o.meta || { p: p.clone(), q: q.clone() }; o.meta.p.copy(p); o.meta.q.copy(q); o.metaT = TIEMPO.t;
  }
}
function objRemotoPaso(o, dt) {
  if (o.auth === RED.ID || !o.meta) return;
  const b = o.b, k = 1 - Math.exp(-dt * 14);
  b.frozen = true; b.vel.set(0, 0, 0); b.ang.set(0, 0, 0);
  if (b.pos.distTo(o.meta.p) > 0.0005 || Math.abs(vdot4(b.q, o.meta.q)) < 0.99999) { b.pos.lerpTo(o.meta.p, k); b.q.slerpTo(o.meta.q, k); b.updateWorld(); o.md.sucio = true; o.dibujado = false; }
}
const vdot4 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
function recibirHecho(d) {
  const R2 = RED.remotos.get(d.i);
  if (d.k === 'chau' && R2) { quitarRemoto(R2); RED.remotos.delete(d.i); return; }
  if (d.k === 'tiro' && Array.isArray(d.p) && Array.isArray(d.d)) {
    const o = v3(num(d.p[0], -1e4, 1e4, 0), num(d.p[1], -1e4, 1e4, 0), num(d.p[2], -1e4, 1e4, 0)), dir = v3(num(d.d[0], -1, 1, 0), num(d.d[1], -1, 1, 0), num(d.d[2], -1, 1, 1)).norm();
    const D = DEF_ARMAS[d.a]; if (D && D.sF) sonar(D.sF, o, 0.8);
    if (R2) humAccion(R2.P, 'tiro');
    const h = raycast(o, dir, 300, R2 ? R2.b : null); efectoTraza(vadd(o, vscale(dir, 0.6)), h ? h.p : vadd(o, vscale(dir, 300)));
    if (h) efectoImpacto(h.p, h.n, 'mundo');
  } else if (d.k === 'rec' && R2) { humAccion(R2.P, 'recarga');
  } else if (d.k === 'exp' && Array.isArray(d.p)) {
    const p = v3(num(d.p[0], -1e4, 1e4, 0), num(d.p[1], -1e4, 1e4, 0), num(d.p[2], -1e4, 1e4, 0));
    explosion.remota = true; explosion(p, 6, 100); explosion.remota = false;
  } else if (d.k === 'dano' && d.to === RED.ID) {
    if (SALA && !SALA.pvp) return;
    danarJugador(num(d.d, 0, 500, 0), null);
    if (Array.isArray(d.v)) JUG.vel.addS(v3(num(d.v[0], -1, 1, 0), num(d.v[1], -1, 1, 0), num(d.v[2], -1, 1, 0)), Math.min(6, num(d.d, 0, 500, 0) * 0.05));
  } else if (d.k === 'claim' && typeof d.o === 'string') {
    const o = buscarObjeto(d.o); if (!o) return;
    o.auth = d.i; if (!o.remoto) { o.congReal = o.b.frozen; o.b.frozen = true; o.meta = { p: o.b.pos.clone(), q: o.b.q.clone() }; RED.cedidos = RED.cedidos || new Set(); RED.cedidos.add(o); }
  } else if (d.k === 'borra' && typeof d.o === 'string') {
    const o = buscarObjeto(d.o); if (o && !o.remoto) { borrarObjeto(o, true); RED.wSucio = true; }
  }
}
// los míos que simula otro: se mueven con lo que manda
function redCedidosPaso(dt) {
  if (!RED.cedidos) return;
  for (const o of RED.cedidos) {
    if (!OBJS.includes(o)) { RED.cedidos.delete(o); continue; }
    if (o.auth === RED.ID || !o.meta) { RED.cedidos.delete(o); continue; }
    const b = o.b, k = 1 - Math.exp(-dt * 14); b.pos.lerpTo(o.meta.p, k); b.q.slerpTo(o.meta.q, k); b.updateWorld(); o.md.sucio = true; o.dibujado = false;
  }
}
