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
// Salas oficiales (una por mapa, siempre listadas) y las que crean los jugadores (nombre, mapa, modo, clave y reglas:
// PvP, RPG, Nextbot, tope de props y de vehículos), todas sin límite de jugadores (0/∞). Quién juega dónde sale de la
// "presencia": cada jugador deja un mensaje retenido en NS/l/ID con la sala donde está (y un testamento que lo borra
// si se corta), por una conexión aparte y liviana que también se usa en el menú. Los servers creados se guardan en la
// tienda (/api/salas): siguen en la lista aunque estén vacíos, se borran solos a los 10 minutos sin nadie y sólo su
// dueño (con la clave que guardó este navegador) los puede borrar.
let SALA = null;
const LISTA = { cli: null, on: false, pres: new Map(), ultP: 0 };
const SALAS_OF = [...MAPAS, ...MAPAS_RB].map((m) => ({ id: 'f_' + m + '_1', n: 'RezoBox ' + m.replace(/^RB_/, ''), m, mo: 'Free', of: 1, pvp: 1, rpg: 1, nb: 1, mp: 1000, mv: 40 }));
const SALAS_REG = { l: [], t: -1e9, dif: 0, vacia: 600e3, cargando: false, ok: false };
const salasMias = () => { try { return JSON.parse(localStorage.getItem('rb_salas_mias') || '{}') || {}; } catch (e) { return {}; } };
const salasMiasGuardar = (o) => { try { localStorage.setItem('rb_salas_mias', JSON.stringify(o)); } catch (e) {} };
function hashTxt(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function topicoSala(S) { return NS + (S.of ? S.id : 'r_' + S.id + (S.clave ? '_' + hashTxt('k' + S.id + S.clave) : '')); }
function salaLimpia(x) {
  if (!x || typeof x.id !== 'string' || !/^[a-zA-Z0-9_]{3,40}$/.test(x.id)) return null;
  const S = { id: x.id, n: limpio(x.n, 24) || 'Server', m: mapaValido(x.m) ? x.m : 'Desert', mo: x.mo === 'PvP' ? 'PvP' : 'Free', of: x.of ? 1 : 0, rg: x.rg ? 1 : 0,
    pvp: x.pvp ? 1 : 0, rpg: x.rpg ? 1 : 0, nb: x.nb ? 1 : 0, mp: num(x.mp, 0, 5000, 1000) | 0, mv: num(x.mv, 0, 200, 40) | 0, pw: x.pw ? 1 : 0, ph: typeof x.ph === 'string' ? x.ph.slice(0, 12) : '',
    du: typeof x.du === 'string' && /^[a-z0-9]{3,20}$/.test(x.du) ? x.du : '', dn: limpio(x.dn, 16) };
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
// los servers creados (de la tienda); se vuelven a pedir cada 30 s mientras se mira la lista
async function salasCargar() {
  if (SALAS_REG.cargando || typeof TIENDA_URL === 'undefined') return; SALAS_REG.cargando = true; SALAS_REG.t = Date.now();
  try {
    const d = await (await fetch(TIENDA_URL + 'salas')).json();
    SALAS_REG.dif = (+d.ahora || Date.now()) - Date.now(); SALAS_REG.vacia = +d.vacia || 600e3; SALAS_REG.ok = true;
    SALAS_REG.l = (d.salas || []).map((x) => { const S = salaLimpia(x); if (S) { S.rg = 1; S.vivo = +x.vivo || 0; } return S; }).filter(Boolean);
    // (los míos que ya no están se olvidan)
    const M = salasMias(); let cambio = false; for (const id of Object.keys(M)) if (!SALAS_REG.l.some((S) => S.id === id) && Date.now() - (M[id].t || 0) > 60e3) { delete M[id]; cambio = true; } if (cambio) salasMiasGuardar(M);
  } catch (e) { SALAS_REG.ok = false; }
  SALAS_REG.cargando = false; listaPronto();
}
// minutos que le quedan a un server vacío antes de borrarse solo
const salaQueda = (S) => Math.max(0, Math.ceil(((S.vivo || 0) + SALAS_REG.vacia - (Date.now() + SALAS_REG.dif)) / 60e3));
function listaSalas() {
  const ahora = Date.now() / 1000, M = new Map();
  for (const S of SALAS_OF) M.set(S.id, { S, j: [] });
  for (const S of SALAS_REG.l) if (S.vivo + SALAS_REG.vacia > Date.now() + SALAS_REG.dif) M.set(S.id, { S, j: [] });
  for (const [id, p] of LISTA.pres) {
    if (p.t && ahora - p.t > 900) continue;
    let e = M.get(p.s.id); if (!e) { e = { S: p.s, j: [] }; M.set(p.s.id, e); }
    e.j.push(p.j || '?');
  }
  return [...M.values()].sort((a, b) => b.j.length - a.j.length || a.S.of - b.S.of || a.S.n.localeCompare(b.S.n));
}
// la lista se dibuja en el inicio: en el panel de multijugador y en la tarjeta de quién juega ahora (rbmenus.js)
function listaContadores() {} // (las cuentas van en el título del panel Multijugador: mpDibujar)
function listaDibujar() {
  listaContadores();
  if (typeof RB === 'undefined' || RB.panel !== 'multi') return;
  if (Date.now() - SALAS_REG.t > 30e3) salasCargar();
  mpDibujar(listaSalas(), salasMias());
}
function entrarSala(S, clave, n) {
  if (celMeEcharon(S.id)) { aviso(T('cel.teEcharon'), 3); return; }   // (me echó el dueño hace menos de 30 minutos)
  // (sin límite de jugadores; el dueño entra a su server con clave sin escribirla)
  const mia = salasMias()[S.id]; if (S.pw && clave === undefined && mia && mia.pw) clave = mia.pw;
  if (S.pw && clave === undefined) { mpPedirClave(S); return; }
  SALA = Object.assign({}, S, { clave: clave || '' });
  PREFS.mapa = S.m; guardarPrefs();
  entrarConCarga(S.n, S.m, () => { inicioMostrar(false); empezarPartida(S.m); }, true);
}
function comprobarClave(v) {
  const S = RBM.clave; if (!S) return;
  if (hashTxt('c' + S.id + (v || '')) !== S.ph) { rbAviso(T('mp.claveMal')); return; }
  mpClaveNo(); entrarSala(S, v || '');
}
// crear un server con lo que se eligió en el panel (C: { n, pw, m, mo, pvp, rpg, nb, mp, mv })
async function crearServidor(C) {
  if (RBM.creando) return; C = C || RB.srv;
  const nom = limpio(C.n, 24) || (PREFS.nombre + "'s server"), clave = limpio(C.pw, 16), mapa = mapaValido(C.m) ? C.m : (PREFS.mapa || 'FlatGrass');
  RED.ID = RED.ID || idRed(); PREFS.mapa = mapa; guardarPrefs();
  const S = { n: nom, m: mapa, mo: C.mo === 'PvP' ? 'PvP' : 'Free', of: 0, pvp: C.pvp ? 1 : 0, rpg: C.rpg ? 1 : 0, nb: C.nb ? 1 : 0,
    mp: num(+C.mp, 0, 5000, 1000) | 0, mv: num(+C.mv, 0, 200, 40) | 0, pw: clave ? 1 : 0, du: RED.ID, dn: limpio(PREFS.nombre, 16) };
  if (S.mo === 'PvP') S.pvp = 1;
  const nuevoId = () => (Math.random().toString(36).slice(2) + '00000000').slice(0, 8);
  // se guarda en la tienda (así sigue en la lista vacío y lo podés borrar); sin conexión queda como antes, mientras haya alguien
  let rg = 0; S.id = nuevoId(); RBM.creando = true; rbAviso(T('srv.creando'));
  for (let intento = 0; intento < 2 && !rg; intento++) {
    S.ph = clave ? hashTxt('c' + S.id + clave) : '';
    try {
      const r = await (await fetch(TIENDA_URL + 'salas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(S) })).json();
      if (r && r.id === S.id && r.clave) { rg = 1; const M = salasMias(); M[S.id] = { clave: r.clave, pw: clave, t: Date.now() }; salasMiasGuardar(M); }
      else if (r && r.error === 'id usado') S.id = nuevoId();
      else { rbAviso(r && r.error ? r.error : T('srv.temporal')); break; }
    } catch (e) { rbAviso(T('srv.temporal')); break; }
  }
  RBM.creando = false;
  SALA = Object.assign(S, { rg, clave, vivo: Date.now() });
  if (rg) { SALAS_REG.l = SALAS_REG.l.filter((x) => x.id !== S.id); const c = Object.assign({}, S); delete c.clave; SALAS_REG.l.push(c); }
  entrarConCarga(S.n, S.m, () => { inicioMostrar(false); empezarPartida(S.m); }, true);
}
// borrar un server mío: se saca de la tienda y los que están adentro vuelven al menú
async function borrarServidor(S) {
  const M = salasMias(), mia = M[S.id]; if (!mia) return false;
  if (!confirm(T('srv.borrarQ').replace('%', S.n))) return false;
  let ok = false; try { ok = !!(await (await fetch(TIENDA_URL + 'salas/' + S.id + '/borrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clave: mia.clave }) })).json()).ok; } catch (e) {}
  if (!ok) { menuAviso(T('errRed')); salasCargar(); return false; }
  delete M[S.id]; salasMiasGuardar(M); SALAS_REG.l = SALAS_REG.l.filter((x) => x.id !== S.id);
  // aviso a los que juegan ahí (ellos revisan en la tienda que de verdad se borró antes de salir)
  try { if (LISTA.on) LISTA.cli.publish(topicoSala(Object.assign({}, S, { clave: mia.pw || '' })) + '/a', JSON.stringify({ k: 'cerrada', i: RED.ID || 'dueno' }), { qos: 0 }); } catch (e) {}
  menuAviso(T('srv.borrado')); listaDibujar(); return true;
}
// alguien avisó que el server se cerró: si en la tienda ya no está, se vuelve al menú
async function salaCerradaRevisar() {
  if (!SALA || !SALA.rg) return;
  try {
    const d = await (await fetch(TIENDA_URL + 'salas')).json();
    if (SALA && !(d.salas || []).some((x) => x.id === SALA.id)) { const n = SALA.n; irMenuPrincipal(); setTimeout(() => menuAviso(T('srv.cerrado').replace('%', n)), 300); }
  } catch (e) {}
}
// el server creado sigue vivo mientras alguien juega: avisa el de id más chico de la sala, una vez por minuto (y al salir)
function salaVivo(id) { if (typeof TIENDA_URL !== 'undefined') fetch(TIENDA_URL + 'salas/' + id + '/vivo', { method: 'POST' }).catch(() => {}); }
function salaVivoPaso(dt) {
  if (!SALA || !SALA.rg || !RED.on) return;
  RED.tVivo = (RED.tVivo === undefined ? 0 : RED.tVivo) - dt; if (RED.tVivo > 0) return; RED.tVivo = 60;
  const ids = [RED.ID, ...RED.remotos.keys()].sort(); if (ids[0] === RED.ID) salaVivo(SALA.id);
}
// botón Multiplayer: conecta la lista y abre el panel (como "Connect" del juego)
function conectarMultijugador() {
  listaConectar(); if (!SRV.mods.size) srvModsCargar(); // los servers ya tienen todos los mods de la tienda
  inicioMostrar(true); inicioPanel('multi');
}
function redEntrar(mapa) {
  redSalir();
  if (!SALA || typeof mqtt === 'undefined') { redEstadoUI(); return; }
  listaConectar();
  RED.ID = RED.ID || idRed(); RED.ROOM = topicoSala(SALA);
  RED.tVivo = 0; if (SALA.rg) salaVivo(SALA.id);
  let cli;
  try {
    cli = mqtt.connect(BROKER, { clientId: NS + RED.ID + '_' + Math.random().toString(36).slice(2, 6), clean: true, reconnectPeriod: 3000, connectTimeout: 9000, keepalive: 30,
      will: { topic: RED.ROOM + '/w/' + RED.ID, payload: '', retain: true, qos: 0 } });
  } catch (e) { return; }
  RED.cli = cli;
  // cada conexión sólo toca el estado si sigue siendo la actual (al cambiar de sala, el cierre de la vieja
  // llega después de abrir la nueva y no tiene que apagarla)
  cli.on('connect', () => { if (RED.cli !== cli) return; RED.on = true; cli.subscribe(RED.ROOM + '/#'); RED.wSucio = true; redEstadoUI(); presencia(); chatMostrar('RezoBox', Lc('Connected', 'Connected') + ': ' + SALA.n); if (soyAnfitrion()) hostPublicar(); });
  cli.on('close', () => { if (RED.cli !== cli) return; RED.on = false; redEstadoUI(); });
  cli.on('message', (t, m) => { if (RED.cli !== cli) return; try { redMensaje(t, m); } catch (e) {} });
  redEstadoUI();
  vozBotonPoner(true); smBotonPoner(true);
}
function redSalir() {
  vozApagar(); vozBotonPoner(false); smBotonPoner(false); smCerrar();
  if (!RED.cli) return;
  if (SALA && SALA.rg) salaVivo(SALA.id); // (desde ahora cuentan los 10 minutos si no queda nadie)
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
  e.textContent = !SALA ? Lc('Singleplayer', 'Singleplayer') : RED.on ? `${SALA.n} · ${RED.remotos.size + 1}/∞` : Lc('Connecting', 'Connecting') + '…';
}
const r3 = (v) => Math.round(v * 1000) / 1000, r4 = (v) => Math.round(v * 10000) / 10000;
// ---------------- lo que mando ----------------
function redPaso(dt) {
  if (!RED.on) return;
  const t = TIEMPO.t;
  for (const R2 of RED.remotos.values()) remotoPaso(R2, dt);
  for (const o of RED.objs.values()) objRemotoPaso(o, dt);
  redCedidosPaso(dt); salaVivoPaso(dt);
  if (t - LISTA.ultP > 120) presencia();
  if (t - RED.ultE > 0.1) {
    const J = JUG, f = (J.suelo ? 1 : 0) | (ENT.agachar ? 2 : 0) | (J.vivo ? 4 : 0) | (J.vehiculo ? 8 : 0) | natBits() | nocheBits();
    const e = { n: PREFS.nombre, k: J.skinRol || J.skinMod || PREFS.skin, h: PREFS.gorro, u: NAT.scp ? [r3(NAT.up.x), r3(NAT.up.y), r3(NAT.up.z)] : 0, c: J.colorRol || 0, p: [r3(J.pos.x), r3(J.pos.y), r3(J.pos.z)], y: r3(J.yaw), t: r3(J.pitch), v: [r3(J.vel.x), r3(J.vel.y), r3(J.vel.z)], f, a: ARM.lista[ARM.i],
      e: JUG.cuerpo && JUG.cuerpo.emote || 0, w: J.vehiculo ? [claveObj(J.vehiculo), J.asiento] : 0, vr: verRedEstado() };
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
    const o = OBJS.filter((x) => !x.remoto).slice(-300).map((x) => [x.id, x.nombre, r3(x.b.pos.x), r3(x.b.pos.y), r3(x.b.pos.z), r4(x.b.q.x), r4(x.b.q.y), r4(x.b.q.z), r4(x.b.q.w), x.b.frozen ? 1 : 0, maqAlMundo(x)]);   // (el último: el juego de la maquinita)
    publicar('w/' + RED.ID, { o, e: entidadesMias(), md: [...SMOD.ids] }, true);
  }
  redEstadoUI();
}
const claveObj = (o) => (o.remoto ? o.key : RED.ID + ':' + o.id);
function redObjeto() { RED.wSucio = true; }
function redRecarga() { publicar('a', { k: 'rec' }); }
function redDisparo(arma) { publicar('a', { k: 'tiro', a: arma, p: [r3(CAM.pos.x), r3(CAM.pos.y), r3(CAM.pos.z)], d: [r3(CAM.fwd.x), r3(CAM.fwd.y), r3(CAM.fwd.z)] }); }
function redExplosion(p, r, d) { publicar('a', { k: 'exp', p: [r3(p.x), r3(p.y), r3(p.z)], r: r3(r || 6), d: Math.round(d || 100) }); }
function redDano(P, dan, d) { publicar('a', { k: 'dano', to: P.remoto, d: Math.round(dan), v: [r3(d.x), r3(d.y), r3(d.z)] }); }
function redChat(t, id) { publicar('c', { n: PREFS.nombre, t: t.slice(0, 120), ...(id ? { id } : {}) }); }
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
  else if (sub === 'c' && typeof d.t === 'string') { chatMostrar(censurar(limpio(d.n)), censurar(limpio(d.t, 120)), typeof d.id === 'string' ? d.id.slice(0, 12) : null, d.i); }   // (la censura también acá: por si el otro tiene una versión vieja)
}
function recibirEstado(d) {
  // (uno que eché de mi server: no se dibuja y se lo vuelve a echar)
  if (CEL.echados.has(d.i) && soyAnfitrion()) { if (TIEMPO.t - (CEL.reEch || 0) > 2) { CEL.reEch = TIEMPO.t; publicar('a', { k: 'echar', to: d.i }); } return; }
  let R2 = RED.remotos.get(d.i);
  // (su personaje, si viene en un paquete aparte que todavía no llegó: mientras tanto el Hero)
  const real = DATA.chars.includes(d.k) ? d.k : 'Hero', skin = rbListo(rbDeSkin(real)) ? real : (rbPedir(rbDeSkin(real)), 'Hero'), gorro = DATA.hats.includes(d.h) ? d.h : 'HatEmpty';
  if (R2) R2.skinReal = real;
  if (R2 && (R2.skin !== skin || R2.gorro !== gorro)) {
    // cambió de personaje (o de gorro): sólo se rehace el cuerpo; sus objetos y entidades siguen
    borrarPersona(R2.P); const P = crearPersona(skin, gorro, { nombre: censurar(limpio(d.n)) }); P.remoto = d.i; R2.P = P; R2.b.persona = P; R2.skin = skin; R2.gorro = gorro;
  }
  if (!R2) {
    const P = crearPersona(skin, gorro, { nombre: censurar(limpio(d.n)) }); P.remoto = d.i;
    const b = new Body(capsuleShape(0.4, 0.5), 80); b.frozen = true; b.persona = P; b.noJug = false; b.noGrab = true; addBody(b);
    const tag = document.createElement('div'); tag.className = 'etiqueta'; $('hud').appendChild(tag);
    R2 = { id: d.i, skin, skinReal: real, gorro, P, b, tag, pos: v3(), meta: v3(), yaw: 0, yawM: 0, vel: v3(), t: TIEMPO.t, f: 0, nombre: '' };
    RED.remotos.set(d.i, R2); chatMostrar('RezoBox', censurar(limpio(d.n)) + ' entró');
    if (RED.mdDe && RED.mdDe.has(d.i)) smDeOtro(R2, RED.mdDe.get(d.i));
  }
  if (Array.isArray(d.p)) { R2.meta.set(num(d.p[0], -1e4, 1e4, 0), num(d.p[1], -1e4, 1e4, 0), num(d.p[2], -1e4, 1e4, 0)); if (TIEMPO.t - R2.t > 2) R2.pos.copy(R2.meta); }
  if (Array.isArray(d.v)) R2.vel.set(num(d.v[0], -80, 80, 0), num(d.v[1], -80, 80, 0), num(d.v[2], -80, 80, 0));
  R2.yawM = num(d.y, -1e3, 1e3, 0); R2.P.mira = num(d.t, -2, 2, 0); R2.f = d.f | 0; R2.t = TIEMPO.t;
  R2.nombre = censurar(limpio(d.n)); etiquetaRemota(R2);
  R2.P.arma = DEF_ARMAS[d.a] ? d.a : null;
  const em = emoValido(d.e) ? d.e : typeof d.e === 'string' && EMO_ID.test(d.e) ? (emoPedir(d.e, d.i), d.e) : null; // (uno hecho por la gente: se pide)
  if (em && R2.P.emote !== em && !(em === 'Patada' && TIEMPO.t - (R2.patT || -9) < 0.9)) { R2.P.emote = em; R2.P.emoteT = 0; sonEmote(R2.P, em); if (em === 'Patada') { R2.patT = TIEMPO.t; sonar('CB_Swing', R2.P.pos, 0.5, 0.9); } } else if (!em) R2.P.emote = null;
  R2.veh = Array.isArray(d.w) ? { k: String(d.w[0]), a: d.w[1] | 0 } : null;
  R2.up = Array.isArray(d.u) ? v3(num(d.u[0], -1, 1, 0), num(d.u[1], -1, 1, 1), num(d.u[2], -1, 1, 0)).norm() : null;
  R2.tag.style.color = typeof d.c === 'string' && /^#[0-9a-fA-F]{6}$/.test(d.c) ? d.c : '';
  verRemoto(R2, d.vr); // (su Verity, si la tiene)
}
// nombre arriba del jugador con los íconos de los mods que usa (se rehace sólo si cambió)
function etiquetaRemota(R2) {
  const icos = R2.icos || [], k = R2.nombre + '|' + icos.map((v) => v.length + v.slice(-12)).join(','); if (R2.tagK === k) return; R2.tagK = k;
  R2.tag.innerHTML = `<span dir="auto">${esc(R2.nombre)}</span>${icos.map((v) => icoHTML(v, 'tagIco')).join('')}`;
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
  const vivo = !!(R2.f & 4), rag = !vivo || !!(R2.f & 32);
  if (rag && !P.rag) { P.vel.copy(R2.vel); P.cuad = null; P.inclin = null; ragdoll(P, null); } else if (!rag && P.rag) ragdollFin(P);
  natRemoto(R2, dt);
  // espectador (en la noche de la pizzería): no se ve, no choca y no tiene nombre arriba
  const esp = !!(R2.f & 256); P.visible = !esp;
  // la cápsula a la medida del personaje (1,8 m en el de siempre; los pies quedan en el mismo lugar)
  const tk = P.tam || 1; if (R2.b.capK !== tk) { const r = Math.min(0.4, 0.9 * tk); R2.b.shape = capsuleShape(r, Math.max(0.01, 0.9 * tk - r)); R2.b.capK = tk; }
  R2.b.pos.set(P.pos.x, P.pos.y - 0.9 + 0.9 * tk, P.pos.z); R2.b.updateWorld(); R2.b.noRay = rag || esp; R2.b.noPhys = rag || esp; R2.b.noJug = rag || esp; // tirado: sólo el muñeco choca (y se puede agarrar)
  // etiqueta con el nombre sobre la cabeza
  const cp = vadd(P.pos, v3(0, -0.65 + 1.9 * tk, 0)), cl = clipDe(cp);
  if (cl && !esp && cp.distTo(CAM.pos) < 60) { R2.tag.style.display = ''; R2.tag.style.transform = `translate(${cl.x}px,${cl.y}px) translate(-50%,-100%)`; } else R2.tag.style.display = 'none';
}
function clipDe(p) {
  const m = R.vpMundo || R.vp, x = m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12], y = m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13], w = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15];
  if (w <= 0.1) return null; return { x: (x / w * 0.5 + 0.5) * VW(), y: (0.5 - y / w * 0.5) * VH() };
}
function quitarRemoto(R2) { vozCerrar(R2.id); entidadesDe(R2.id); borrarPersona(R2.P); removeBody(R2.b); R2.tag.remove(); for (const o of [...RED.objs.values()]) if (o.dueno === R2.id) { borrarObjeto(o, true); RED.objs.delete(o.key); } chatMostrar('RezoBox', (R2.nombre || 'Alguien') + ' salió'); }
function buscarObjeto(k) {
  if (RED.objs.has(k)) return RED.objs.get(k);
  if (k.startsWith(RED.ID + ':')) { const id = +k.slice(RED.ID.length + 1); return OBJS.find((o) => o.id === id && !o.remoto); }
  return null;
}
function recibirMundo(id, d) {
  const vivos = new Set();
  if (d && 'e' in d) entidadesRecibir(id, d.e);
  if (d && Array.isArray(d.md)) { RED.mdDe = RED.mdDe || new Map(); RED.mdDe.set(id, d.md); const R2 = RED.remotos.get(id); if (R2) smDeOtro(R2, d.md); }
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
    if (x[10]) maqDeMundo(o, x[10]);
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
// ¿un rayo de otro jugador (un golpe) me toca? Las esferas de mi cuerpo; la distancia por el rayo y el punto, o null
function rayoJugador(o, dir, L) {
  if (!JUG.vivo || JUG.vehiculo) return null; let mejor = null;
  for (const [dy] of JUG.esf) {
    const c = v3(JUG.pos.x, JUG.pos.y + dy, JUG.pos.z), t = clamp(vdot(vsub(c, o), dir), 0, L), q = vadd(o, vscale(dir, t));
    if (q.distTo(c) < JUG.radio && (!mejor || t < mejor.t)) mejor = { t, p: q };
  }
  return mejor;
}
function recibirHecho(d) {
  const R2 = RED.remotos.get(d.i);
  if (d.k === 'chau' && R2) { quitarRemoto(R2); RED.remotos.delete(d.i); return; }
  if (d.k === 'tiro' && Array.isArray(d.p) && Array.isArray(d.d)) {
    const o = v3(num(d.p[0], -1e4, 1e4, 0), num(d.p[1], -1e4, 1e4, 0), num(d.p[2], -1e4, 1e4, 0)), dir = v3(num(d.d[0], -1, 1, 0), num(d.d[1], -1, 1, 0), num(d.d[2], -1, 1, 1)).norm();
    const D = DEF_ARMAS[d.a];
    if (R2) humAccion(R2.P, 'tiro');
    if (D && D.tipo === 'golpe') {   // (un golpe: el silbido al aire o el ruido de lo que pegó, sin traza)
      const h = raycast(o, dir, D.alcance || 2, R2 ? R2.b : null), yo = rayoJugador(o, dir, D.alcance || 2);
      if (yo && (!h || yo.t < h.t)) {   // (me pegó a mí: mi cuerpo no es un cuerpo de la física, el rayo no lo ve)
        const c = D.sCarne || ['Melee1']; sonar(c[(Math.random() * c.length) | 0], yo.p, 0.8); efectoImpacto(yo.p, vscale(dir, -1), 'golpe'); return;
      }
      const imp = h && D.sImp && (h.body && h.body.persona ? D.sCarne : D.sImp);
      if (imp) sonar(imp[(Math.random() * imp.length) | 0], h.p, 0.8); else if (h) sonar('Melee1', h.p, 0.8); else if (D.sF) sonar(azarDe(D.sF), o, 0.7);
      if (h) efectoImpacto(h.p, h.n, 'golpe');
    } else {
      if (D && D.sF) sonar(azarDe(D.sF), o, 0.8);
      const h = raycast(o, dir, 300, R2 ? R2.b : null); efectoTraza(vadd(o, vscale(dir, 0.6)), h ? h.p : vadd(o, vscale(dir, 300)));
      if (h) efectoImpacto(h.p, h.n, 'mundo');
    }
  } else if (d.k === 'rec' && R2) { humAccion(R2.P, 'recarga');
  } else if (d.k === 'exp' && Array.isArray(d.p)) {
    const p = v3(num(d.p[0], -1e4, 1e4, 0), num(d.p[1], -1e4, 1e4, 0), num(d.p[2], -1e4, 1e4, 0));
    explosion.remota = true; explosion(p, num(d.r, 0.5, 600, 6), num(d.d, 0, 1e5, 100)); explosion.remota = false; // del tamaño que tuvo en su juego (con sus mods)
  } else if (d.k === 'cerrada') { salaCerradaRevisar();
  } else if (d.k === 'rtc' && d.to === RED.ID) { vozSenal(d);
  } else if (d.k === 'ent' || d.k === 'entb' || d.k === 'radio' || d.k === 'entp') { entidadHecho(d);
  } else if (d.k === 'jalar') { natRed(d);
  } else if (d.k === 'cic') { cicRed(d);
  } else if (typeof d.k === 'string' && /^ver[dqgawc]$/.test(d.k)) { verRed(d); // (Verity: lo que dice, preguntas, agarre, animación, llamada, crear)
  } else if (d.k === 'maq' || d.k === 'maqp' || d.k === 'maqd') { maqRed(d);
  } else if (d.k === 'meme' || d.k === 'memed') { memeRed(d);
  } else if (d.k === 'chatcorr' && typeof d.id === 'string' && typeof d.t === 'string') { chatCambiar(d.id.slice(0, 12), censurar(limpio(d.t, 120)), d.i);
  } else if (d.k === 'bocina') { bocinaRed(d);
  } else if (d.k === 'turbo') { turboRed(d);
  } else if (d.k === 'echar') { celEchadoRed(d);
  } else if (typeof d.k === 'string' && d.k.startsWith('npc')) { npcRecibir(d);
  } else if (d.k === 'catap' || d.k === 'omega' || d.k === 'omegab') { artRed(d);
  } else if (d.k === 'animq' || d.k === 'anim') { emoRed(d);
  } else if (d.k === 'fnn' || d.k === 'fnb' || d.k === 'fnx' || d.k === 'fne' || d.k === 'fnv') { nocheRed(d); // (la noche en la pizzería)
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

// llegó el paquete del personaje de otro jugador: se le rehace el cuerpo (aunque esté quieto y no mande nada nuevo)
RBP.alListo.push((k) => {
  if (!k.startsWith('s_')) return; const s = k.slice(2);
  for (const R2 of RED.remotos.values()) if (R2.skinReal === s && R2.skin !== s) {
    const P0 = R2.P, P = crearPersona(s, R2.gorro, { nombre: R2.nombre }); P.remoto = R2.id; P.pos.copy(P0.pos); P.yaw = P0.yaw; borrarPersona(P0); R2.P = P; R2.b.persona = P; R2.skin = s;
  }
});
