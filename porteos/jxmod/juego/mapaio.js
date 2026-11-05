// ---------------- entradas y salidas de los mapas de Source: botones, zonas, sonidos, cosas que giran, relevos ----------------
// En Source las cosas de un mapa se avisan entre sí: el botón del tocadiscos del Liminal Hotel dice «al apretarme, que el
// disco empiece a girar y que en 2 s suene la música» ("rotatedisc,Start,,0,-1" y "drifting,PlaySound,,2,-1").
// gmod_bsp.js deja esas salidas; acá se cumplen las que el juego sabe hacer:
//  - puertas (Open, Close, Toggle) y lo que gira (func_rotating: Start, Stop, Toggle, Reverse, SetSpeed...): puertas.js;
//  - los sonidos del mapa (ambient_generic): PlaySound, StopSound, ToggleSound, Volume, FadeIn, FadeOut, Kill; los que
//    empiezan sonando y se repiten (zumbidos de tubos, ambiente) suenan solos cerca de donde están;
//  - los relevos (logic_relay: Trigger, Enable, Disable, Toggle), lo que pasa al cargar (logic_auto), y botones y zonas
//    que se traban o se apagan (Lock, Unlock, Press, Enable, Disable);
//  - con la demora de cada salida y las «veces» (las que se cumplen una sola vez).
// En una sala, el botón que aprieta uno lo aprietan todos (k: 'mio'); las puertas siguen yendo con su propio aviso.
const MIO = { snd: [], relay: new Map(), pend: [], t: 0, veces: new Map() };
function mioIniciar() {
  for (const s of MIO.snd) if (s.fuente) { try { s.fuente.stop(); } catch (e) {} }
  MIO.snd = []; MIO.relay = new Map(); MIO.pend = []; MIO.t = 0; MIO.veces = new Map();
  const io = ((typeof DATA !== 'undefined' && DATA.aj && DATA.aj[MUNDO.nombre]) || {}).io; if (!io) return;
  (io.snd || []).forEach((s, i) => MIO.snd.push(Object.assign({}, s, { i, pos: v3(s.p[0], s.p[1], s.p[2]), on: s.ini && s.bucle, vol: s.v, nom: null, buscado: false, fuente: null, muerto: false })));
  for (const r of io.relay || []) MIO.relay.set(r.n, { sal: r.sal, on: r.on });
  // (los que se van a usar se decodifican ya: la música del tocadiscos dura minutos y, si no, la primera vez salía muda)
  for (const s of MIO.snd) { const n = mioNom(s); if (n && typeof audioBuf === 'function') audioBuf(n); }
  mioDisparar(io.auto || [], false);
}
// el nombre del sonido en el juego: el archivo del mapa o del contenido montado (o un guion de sonido de Source)
function mioNom(s) {
  if (s.buscado) return s.nom; s.buscado = true;
  try {
    s.nom = typeof gmSonido === 'function' ? gmSonido(s.s) : null;
    if (!s.nom && typeof GMA !== 'undefined' && GMA.guiones) { const sc = GMA.guiones.get(s.s.toLowerCase()); if (sc && sc.w && sc.w.length) s.nom = gmSonido(sc.w[0]); }
  } catch (e) { s.nom = null; }
  return s.nom;
}
// cumplir una lista de salidas ([destino, entrada, valor, demora, veces]); remoto = lo apretó otro jugador
function mioDisparar(L, remoto) {
  for (const o of L || []) {
    if (o[4] > 0) { const n = MIO.veces.get(o) || 0; if (n >= o[4]) continue; MIO.veces.set(o, n + 1); }
    if (o[3] > 0) MIO.pend.push({ t: MIO.t + o[3], o, r: remoto }); else mioEntrada(o[0], o[1], o[2], remoto);
  }
}
function mioEntrada(t, inp, par, remoto) {
  const igual = t.endsWith('*') ? (n) => !!n && n.startsWith(t.slice(0, -1)) : (n) => n === t;
  const P = typeof PUERTAS !== 'undefined' ? PUERTAS : null;
  if (P) for (const D of P.l) {
    if (!igual(String(D.P.nombre || '').toLowerCase())) continue;
    if (D.P.rot) rotEntrada(D, inp, par);
    else if (!remoto) { if (inp === 'toggle') puertaAlternar(D); else if (inp === 'open' && D.meta < 0.5) puertaAlternar(D, true); else if (inp === 'close' && D.meta > 0.5) puertaAlternar(D, false); }
  }
  for (const s of MIO.snd) if (igual(s.n)) sndEntrada(s, inp, par);
  for (const [n, R] of MIO.relay) {
    if (!igual(n)) continue;
    if (inp === 'trigger') { if (R.on) mioDisparar(R.sal, remoto); }
    else if (inp === 'enable') R.on = true; else if (inp === 'disable') R.on = false; else if (inp === 'toggle') R.on = !R.on;
  }
  if (P) {
    for (const z of P.zona) if (igual(z.n)) { if (inp === 'enable') z.off = false; else if (inp === 'disable') z.off = true; else if (inp === 'toggle') z.off = !z.off; }
    for (const b of P.bot) if (igual(b.n)) { if (inp === 'lock') b.bloq = 1; else if (inp === 'unlock') b.bloq = 0; else if (inp === 'press' && !remoto) mioBoton(b, true); }
  }
}
// lo que gira (func_rotating, en puertas.js)
function rotEntrada(D, inp, par) {
  const base = D.P.rev ? -1 : 1;
  if (inp === 'start') D.on = true; else if (inp === 'stop') D.on = false; else if (inp === 'toggle') D.on = !D.on;
  else if (inp === 'reverse') D.dirRot = -D.dirRot;
  else if (inp === 'startforward') { D.on = true; D.dirRot = base; } else if (inp === 'startbackward') { D.on = true; D.dirRot = -base; }
  else if (inp === 'setspeed') { const v = +par; if (isFinite(v)) { D.velK = Math.max(0, Math.min(1, v)); D.on = D.velK > 0; } }
}
// un sonido del mapa
function sndEntrada(s, inp, par) {
  if (s.muerto) return;
  const parar = () => { s.on = false; if (s.fuente) { try { s.fuente.stop(); } catch (e) {} s.fuente = null; } };
  const tocar = () => {
    if (s.bucle) { s.on = true; return; }
    const n = mioNom(s); if (!n || typeof sonar !== 'function') return;
    if (s.fuente) { try { s.fuente.stop(); } catch (e) {} }
    const d = s.todo ? 0 : s.pos.distTo(CAM.pos); if (d > s.r) return;
    s.fuente = sonar(n, s.todo ? null : s.pos, Math.max(0.05, s.vol), s.tono);
  };
  if (inp === 'playsound' || inp === 'fadein') tocar();
  else if (inp === 'stopsound') parar();
  else if (inp === 'fadeout') { const t = Math.max(0, +par || 0); if (t > 0) MIO.pend.push({ t: MIO.t + t, o: [s.n, 'stopsound', '', 0, -1] }); else parar(); }
  else if (inp === 'togglesound') { if (s.bucle) s.on = !s.on; else if (s.fuente) parar(); else tocar(); }
  else if (inp === 'volume') { const v = Math.max(0, Math.min(10, +par || 0)) / 10; s.vol = v; if (v <= 0 && !s.bucle) parar(); }
  else if (inp === 'pitch') { const v = +par; if (v > 0) s.tono = Math.max(0.3, Math.min(2.5, v / 100)); }
  else if (inp === 'kill') { parar(); s.muerto = true; }
}
// un botón del mapa (con E): OnPressed siempre; los de dos posiciones, OnIn y OnOut una vez cada uno
function mioBoton(b, local) {
  if (b.bloq) { mioDisparar(b.sal.l, !local); return; }
  if (local && typeof publicar === 'function' && typeof RED !== 'undefined' && RED.on) publicar('a', { k: 'mio', b: PUERTAS.bot.indexOf(b) });
  mioDisparar(b.sal.p, !local);
  if (b.tog) { b.est = b.est ? 0 : 1; mioDisparar(b.est ? b.sal.i : b.sal.o, !local); }
  else mioDisparar(b.sal.i, !local);
}
function mioRed(d) { const b = typeof PUERTAS !== 'undefined' && PUERTAS.bot[d.b | 0]; if (b) mioBoton(b, false); }
// cada cuadro: lo que tenía demora y los sonidos que se repiten (los 8 más cerca, con lo que llegan)
function mioPaso(dt) {
  MIO.t += dt;
  if (MIO.pend.length) {
    const ya = MIO.pend.filter((p) => p.t <= MIO.t);
    if (ya.length) { MIO.pend = MIO.pend.filter((p) => p.t > MIO.t); for (const p of ya) mioEntrada(p.o[0], p.o[1], p.o[2], p.r); }
  }
  if (!MIO.snd.length || typeof bucle !== 'function' || typeof CAM === 'undefined') return;
  const cerca = [];
  for (const s of MIO.snd) {
    if (!s.on || !s.bucle || s.muerto || s.vol <= 0) continue;
    const d = s.todo ? 0 : s.pos.distTo(CAM.pos); if (d <= s.r) cerca.push([d, s]);
  }
  cerca.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < Math.min(8, cerca.length); i++) {
    const [d, s] = cerca[i], n = mioNom(s); if (!n) continue;
    bucle('mio' + s.i, n, s.todo ? null : s.pos, s.vol * (s.todo ? 1 : Math.max(0, 1 - d / s.r)) * 0.8, s.tono);
  }
}
