// ---------------------------------------------------------------------------------------------------------
// El juego y el panel (tienda/panel.js; la app admin en web/panel; Claude con herramientas/panel.py):
//  · Cada 25 s (en el menú o jugando, con la página a la vista) el juego dice «acá estoy»: un id de aparato al azar, el
//    nombre que puso, la versión, si es la app o la web, en qué mapa y server está. Manda también sus errores de JS (sin
//    repetir) y se lleva las órdenes nuevas.
//  · Las órdenes las firma el dueño (con la llave de su celular, aprobada por Claude) o Claude (la de los eventos en vivo):
//    el juego comprueba la firma con VIVO_PUB (vivo.js) y no hace nada sin firma buena. Cada una se hace una sola vez por
//    aparato (aunque se cierre y se abra el juego mientras dura) y se va sola cuando vence:
//      aviso   un cartel arriba (título, texto y una imagen opcional), en el menú o jugando
//      cielo   una pantalla gigante en el cielo con texto, imagen o video (jugando; en el menú, al entrar a un mapa)
//      cine    una cinemática a pantalla completa: el video se baja apenas llega la orden y empieza a la hora que dice,
//              en todos a la vez
//      ir      todos a un mapa (y juntos al server oficial de ese mapa, si dice), sin preguntar; con lugar opcional
//      guion   un guion como los de los eventos en vivo (vivo.js), con todo el juego a mano
//      quitar  saca una orden que sigue puesta
//  · Bugs y sugerencias (el menú): la gente publica con texto, imágenes y videos; se ven todos, se votan y se denuncian;
//    el dueño y Claude contestan y les ponen estado.
//  · Avisos (las notificaciones que manda el dueño o Claude desde el panel): llegan con «hola», salen en un cartel arriba
//    y quedan en la lista de Avisos del menú (con un globito con las que no se vieron). Con el juego en otra pestaña y
//    el permiso del navegador, también una notificación del sistema; en la web instalable, «Avisarme en este aparato»
//    anota el navegador para el push y le llegan con el juego cerrado (el service worker: herramientas/web_app.py).
// En las pruebas automáticas no se conecta, salvo con ?panel=URL_DEL_PANEL (y ?panelCada=segundos).
// ---------------------------------------------------------------------------------------------------------
const ORD = { on: false, d: '', u: 0, hechas: [], activas: new Map(), err: [], errVistos: new Set(), claves: new Map(), cielo: null, cine: null, irPos: null, guiones: new Map(), cola: [], reloj: 0 };
const ordPuede = () => !!(window.crypto && crypto.subtle) && typeof VIVO_PUB !== 'undefined' && (!(TEST || navigator.webdriver) || Q.has('panel'));
const ordBase = () => ((TEST || navigator.webdriver) && Q.get('panel')) || (typeof TIENDA_URL !== 'undefined' ? TIENDA_URL + 'panel/' : '');
// (de dónde puede venir un video o una imagen de una orden: el repo, el panel, y en las pruebas el servidor local)
const ordUrlBien = (u) => typeof u === 'string' && (/^https:\/\/(raw\.githubusercontent\.com|raw\.githack\.com|rawcdn\.githack\.com)\/Juniorspro\/Ports\//.test(u) || u.startsWith(ordBase() + 'media/') || ((TEST || navigator.webdriver) && /^http:\/\/localhost:\d+\//.test(u)));
// ---------------- arrancar y avisar que estamos ----------------
function ordArranque() {
  notCargar();
  if (ORD.on || !ordPuede()) return; ORD.on = true;
  try { ORD.d = localStorage.getItem('jx_aparato') || ''; } catch (e) {}
  if (!/^[a-z0-9]{16}$/.test(ORD.d)) { ORD.d = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join(''); try { localStorage.setItem('jx_aparato', ORD.d); } catch (e) {} }
  try { ORD.hechas = JSON.parse(localStorage.getItem('jx_ord_hechas') || '[]') || []; } catch (e) { ORD.hechas = []; }
  // los errores de JS (los mismos que van a la caja negra): sin repetir, como mucho 20 por vez que se abre el juego
  addEventListener('error', (e) => ordErr((e.message || 'error') + (e.error && e.error.stack ? ' | ' + String(e.error.stack).split('\n').slice(1, 4).join(' ') : '')));
  addEventListener('unhandledrejection', (e) => { const r = e.reason; ordErr('promesa: ' + (r && (r.message || r)) + (r && r.stack ? ' | ' + String(r.stack).split('\n').slice(1, 3).join(' ') : '')); });
  ordHola();
  const cada = Math.max(1, +(((TEST || navigator.webdriver) && Q.get('panelCada')) || 25)) * 1000;
  setInterval(() => { if (!document.hidden) ordHola(); }, cada);
  // (con el juego en otra pestaña y permiso para avisar: cada 2 minutos se fijan los avisos nuevos, sin decir «acá estoy»)
  setInterval(() => { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') notTraer(); }, Math.max(cada, 120000));
  setInterval(ordReloj, 1000);
}
function ordErr(msg) {
  msg = String(msg).replace(/\s+/g, ' ').slice(0, 600); if (ORD.errVistos.has(msg) || ORD.errVistos.size >= 20) return;
  ORD.errVistos.add(msg); ORD.err.push(msg);
}
async function ordHola() {
  if (ORD.hablando) return; ORD.hablando = true;
  try {
    const mapa = JUEGO.estado === 'juego' && typeof MUNDO !== 'undefined' ? MUNDO.nombre : 'menú';
    const b = { d: ORD.d, n: PREFS.nombre || '', v: typeof JX_VERSION !== 'undefined' ? JX_VERSION : '', pl: (window.JXNativo ? 'app' : 'web') + (typeof COARSE !== 'undefined' && COARSE ? ' celu' : ' pc'), m: mapa, s: typeof SALA !== 'undefined' && SALA ? String(SALA.id || '') : '', u: ORD.u, e: ORD.err.splice(0, 3) };
    b.nd = NOT.nd;
    const r = await fetch(ordBase() + 'hola', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    if (!r.ok) return; const d = await r.json();
    for (const o of d.ordenes || []) { ORD.u = Math.max(ORD.u, +o.id || 0); if (await ordFirmaBien(o)) ordCorrer(o); else console.warn('panel: orden con firma mala'); }
    notNuevas(d.notis);
  } catch (e) { /* sin internet: la próxima */ } finally { ORD.hablando = false; }
}
// ---------------- las firmas ----------------
async function ordVerif(pub, firma, txt) {
  try {
    let k = ORD.claves.get(pub); if (!k) { k = await crypto.subtle.importKey('spki', vivoB64(pub), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); ORD.claves.set(pub, k); }
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, vivoB64(firma), new TextEncoder().encode(txt));
  } catch (e) { return false; }
}
// (del dueño: su certificado lo firmó Claude con la llave de los eventos en vivo; de Claude: con esa misma llave)
async function ordFirmaBien(o) {
  if (!o || typeof o.a !== 'string' || typeof o.f !== 'string') return false;
  let pub = VIVO_PUB;
  if (o.c) {
    let c; try { c = JSON.parse(o.c); } catch (e) { return false; }
    if (!c || !(await ordVerif(VIVO_PUB, String(c.firma), `JXADMIN1\n${c.pub}\n${c.nombre}\n${c.desde}`))) return false;
    pub = c.pub;
  }
  return ordVerif(pub, o.f, 'JXORDEN1\n' + o.a);
}
// ---------------- hacer lo que dice ----------------
function ordCorrer(o) {
  let A; try { A = JSON.parse(o.a); } catch (e) { return; }
  if (!A || typeof A.uid !== 'string' || !(A.hasta > Date.now())) return;
  if (A.tipo === 'quitar') { ordQuitar(A.datos && A.datos.uid); return; }
  if (ORD.hechas.includes(A.uid)) return;
  ORD.hechas.push(A.uid); if (ORD.hechas.length > 200) ORD.hechas.splice(0, ORD.hechas.length - 200);
  try { localStorage.setItem('jx_ord_hechas', JSON.stringify(ORD.hechas)); } catch (e) {}
  const d = A.datos || {};
  try {
    if (A.tipo === 'aviso') ordAviso(A.uid, d, A.hasta);
    else if (A.tipo === 'cielo') ordCielo(A.uid, d, A.hasta);
    else if (A.tipo === 'cine') ordCine(A.uid, d, A.hasta);
    else if (A.tipo === 'ir') ordIr(A.uid, d, A.hasta);
    else if (A.tipo === 'guion') ordGuion(A.uid, d, A.hasta);
  } catch (e) { console.warn('panel', e); if (typeof cnAnotar === 'function') cnAnotar('panel', A.tipo + ': ' + String(e && e.message || e).slice(0, 200)); }
}
function ordQuitar(uid) { const x = ORD.activas.get(uid); if (x) { ORD.activas.delete(uid); try { x.fin(); } catch (e) {} } }
// (cada segundo: lo que venció se va; y lo que espera a estar jugando)
function ordReloj() {
  const ahora = Date.now();
  for (const [uid, x] of [...ORD.activas]) if (ahora > x.hasta) ordQuitar(uid);
  if (ORD.cielo && ORD.cielo.espera && JUEGO.estado === 'juego') ordCieloPoner();
}
// ---------------- el aviso de arriba ----------------
function ordAviso(uid, d, hasta) {
  let caja = document.getElementById('ordAvisos'); if (!caja) { caja = document.createElement('div'); caja.id = 'ordAvisos'; document.body.appendChild(caja); }
  const el = document.createElement('div'); el.className = 'ordAviso';
  const ti = document.createElement('b'); ti.textContent = String(d.titulo || 'JXMod').slice(0, 80);
  const tx = document.createElement('p'); tx.textContent = String(d.texto || '').slice(0, 600);
  const x = document.createElement('button'); x.className = 'ordX'; x.textContent = '×'; x.onclick = (e) => { e.stopPropagation(); ordQuitar(uid); };
  el.append(ti, tx, x);
  if (d.img && ordUrlBien(d.img)) { const im = document.createElement('img'); im.src = d.img; im.alt = ''; el.insertBefore(im, ti); }
  caja.appendChild(el); requestAnimationFrame(() => el.classList.add('sale'));
  ordSonido();
  // (dura lo que dice la orden, pero un cartel no más de 20 s en la pantalla: después se va)
  const fin = () => { el.classList.remove('sale'); setTimeout(() => el.remove(), 400); };
  ORD.activas.set(uid, { tipo: 'aviso', hasta: Math.min(hasta, Date.now() + (+d.seg > 0 ? +d.seg * 1000 : 20000)), fin });
}
function ordSonido() {
  try { const c = AUD.ctx; if (!c) return; const t = c.currentTime; for (const [f, a] of [[660, 0], [880, 0.12]]) { const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + a); g.gain.exponentialRampToValueAtTime(0.18 * (PREFS.vol / 100), t + a + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + a + 0.35); o.connect(g); g.connect(c.destination); o.start(t + a); o.stop(t + a + 0.4); } } catch (e) {}
}
// ---------------- los avisos (notificaciones del panel) ----------------
const NOT = { L: [], nd: 0 };
function notCargar() { try { const o = JSON.parse(localStorage.getItem('jx_notis') || 'null'); if (o) { NOT.L = Array.isArray(o.L) ? o.L : []; NOT.nd = +o.nd || 0; } } catch (e) {} notGlobo(); }
function notGuardar() { try { localStorage.setItem('jx_notis', JSON.stringify({ L: NOT.L.slice(0, 30), nd: NOT.nd })); } catch (e) {} }
// (el globito de los botones de Avisos: lo dibuja el CSS con la cuenta de acá, así sale también en los botones que se arman después)
function notGlobo() { const n = NOT.L.filter((x) => !x.v).length, r = document.documentElement; r.style.setProperty('--avN', '"' + (n > 9 ? '9+' : n) + '"'); r.classList.toggle('avHay', n > 0); }
function notNuevas(lista) {
  const nuevas = (Array.isArray(lista) ? lista : []).filter((n) => n && typeof n.id === 'string' && !NOT.L.some((x) => x.id === n.id));
  for (const n of nuevas) { NOT.L.push({ id: n.id, t: String(n.titulo || '').slice(0, 80), x: String(n.texto || '').slice(0, 1000), l: /^https:\/\//.test(n.link || '') ? String(n.link) : '', c: +n.creado || Date.now(), v: 0 }); NOT.nd = Math.max(NOT.nd, +n.creado || 0); }
  if (!nuevas.length) return;
  NOT.L.sort((a, b) => b.c - a.c); NOT.L = NOT.L.slice(0, 30); notGuardar(); notGlobo();
  if (notApp() && typeof JXNativo.avisosVisto === 'function') { try { JXNativo.avisosVisto(String(NOT.nd)); } catch (e) {} }   // (la app no repite lo que ya salió acá)
  // (el cartel, de la más nueva si llegaron varias juntas: la primera vez que se abre el juego, por ejemplo)
  const n = nuevas.reduce((a, b) => ((+b.creado || 0) > (+a.creado || 0) ? b : a));
  ordAviso('noti:' + n.id, { titulo: n.titulo, texto: n.texto, seg: 12 }, Date.now() + 12000);
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') { try { new Notification(String(n.titulo || 'JXMod'), { body: String(n.texto || ''), tag: 'jx-' + n.id }); } catch (e) {} }
  if (typeof RB !== 'undefined' && RB.panel === 'avisos' && typeof inicioPanel === 'function') inicioPanel('avisos');
}
async function notTraer() { try { const r = await fetch(ordBase() + 'notis?desde=' + NOT.nd); if (r.ok) notNuevas((await r.json()).notis); } catch (e) {} }
// qué se puede hacer para que avise: push (la web instalable, con service worker), con el juego abierto (Notification), nada (la app)
const notPushPuede = () => !!(window.JX_APPWEB && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window);
// (la app de Android desde la 3.9.9 avisa con la app cerrada —Avisos.java—; las anteriores no tienen cómo)
const notApp = () => !!(window.JXNativo && typeof JXNativo.avisosEstado === 'function');
function notEstado() {
  if (notApp()) { let e = 'pedir'; try { e = JXNativo.avisosEstado(); } catch (x) {} return e === 'activo' ? 'push' : e === 'bloq' ? 'bloq' : 'pedir'; }
  if (!('Notification' in window)) return 'no';
  if (Notification.permission === 'denied') return 'bloq';
  if (Notification.permission === 'granted') return notPushPuede() ? (localStorage.getItem('jx_push') ? 'push' : 'pedir') : 'abierto';
  return 'pedir';
}
const notB64 = (s) => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
async function notActivar() {
  if (notApp()) {   // (la app: programa la tarea de Android y pide el permiso de notificaciones; contesta con __jxAvisos)
    window.__jxAvisos = () => { if (typeof RB !== 'undefined' && RB.panel === 'avisos') inicioPanel('avisos'); };
    try { JXNativo.avisosActivar(String(NOT.nd || 0)); } catch (e) {}
    setTimeout(() => window.__jxAvisos(), 600); return;
  }
  try { if ((await Notification.requestPermission()) !== 'granted') return inicioPanel('avisos'); } catch (e) { return; }
  if (notPushPuede()) {
    try {
      const reg = await navigator.serviceWorker.ready, k = await (await fetch(ordBase() + 'push/clave')).json();
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: notB64(k.clave) }));
      const r = await fetch(ordBase() + 'push/alta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      if (r.ok) localStorage.setItem('jx_push', sub.endpoint);
      // (el service worker trae el texto del aviso de este panel)
      try { const c = await caches.open('jx-conf'); await c.put('panel', new Response(ordBase())); } catch (e) {}
    } catch (e) { console.warn('avisos: no se pudo anotar el push: ' + (e && e.message)); }
  }
  inicioPanel('avisos');
}
function panelAvisos(P) {
  const L = NOT.L, nuevos = new Set(L.filter((x) => !x.v).map((x) => x.id)), est = notEstado();
  for (const x of L) x.v = 1; notGuardar(); notGlobo();
  const fecha = (c) => { const d = new Date(c); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
  const cuerpo = `<div class="rbPanCuerpo avLista">${L.length ? L.map((x, i) => `<div class="avItem${nuevos.has(x.id) ? ' nuevo' : ''}"><div class="avCab"><b>${esc(x.t)}</b><small>${esc(fecha(x.c))}</small></div>${x.x ? `<p>${esc(x.x)}</p>` : ''}${x.l ? `<button class="rbBtnGris rbChico" data-rb="av:abrir|${i}">${glifo('adelante')} ${esc(T('av.abrir'))}</button>` : ''}</div>`).join('') : `<p class="rbAyudaC">${esc(T('av.vacio'))}</p>`}
    ${est === 'push' ? `<p class="rbAyudaC avEst">${esc(T('av.activoPush'))}</p>` : est === 'abierto' ? `<p class="rbAyudaC avEst">${esc(T('av.activoAbierto'))}</p>` : est === 'bloq' ? `<p class="rbAyudaC avEst">${esc(T('av.bloqueadas'))}</p>` : ''}</div>`;
  P.innerHTML = `<div class="rbPanCab">${glifo('campana')} ${esc(T('av.titulo'))}</div>` + cuerpo +
    `<div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">${glifo('atras')} ${esc(T('volver'))}</button><span class="rbEsp"></span>${est === 'pedir' ? `<button class="rbBtnG" data-rb="av:activar">${glifo('campana')} ${esc(T('av.activar'))}</button>` : ''}</div>`;
}
function avisosAccion(v) {
  const [a, x] = String(v || '').split('|');
  if (a === 'activar') return notActivar();
  if (a === 'abrir') { const n = NOT.L[+x]; if (!n || !n.l) return; try { if (window.JXNativo && JXNativo.abrir) { JXNativo.abrir(n.l); return; } } catch (e) {} window.open(n.l, '_blank', 'noopener'); }
}
// ---------------- la pantalla del cielo ----------------
function ordCielo(uid, d, hasta) {
  if (ORD.cielo) ordCieloFin();
  const C = ORD.cielo = { uid, d, hasta, espera: true, img: null, vid: null, L: null, c: null, M: new Float32Array(16), t: 0 };
  if (d.img && ordUrlBien(d.img)) { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { C.img = im; if (C.L) C.L.pintar(); }; im.src = d.img; }
  if (d.video && ordUrlBien(d.video)) { const v = document.createElement('video'); v.crossOrigin = 'anonymous'; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.src = d.video; C.vid = v; }
  ORD.activas.set(uid, { tipo: 'cielo', hasta, fin: ordCieloFin });
  if (JUEGO.estado === 'juego') ordCieloPoner(); else ordAviso(uid + '_m', { titulo: d.titulo, texto: d.texto }, hasta);
}
function ordCieloPoner() {
  const C = ORD.cielo; if (!C) return; C.espera = false;
  // (adelante tuyo y arriba, a 60 m: cada uno la ve de frente al aparecer; queda quieta en el mundo)
  const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); C.c = v3(JUG.pos.x + f.x * 60, JUG.pos.y + 24, JUG.pos.z + f.z * 60);
  if (!C.L) C.L = ev3Lienzo(1024, 576, (g, w, h) => ordCieloPintar(C, g, w, h), null, true);
  else C.L.pintar();
  if (C.vid) C.vid.play().catch(() => {});
  ordSonido();
}
function ordCieloPintar(C, g, w, h) {
  g.fillStyle = '#05070c'; g.fillRect(0, 0, w, h);
  const src = C.vid && C.vid.readyState >= 2 ? C.vid : C.img;
  if (src) { const sw = src.videoWidth || src.naturalWidth, sh = src.videoHeight || src.naturalHeight, k = Math.min(w / sw, h / sh); g.drawImage(src, (w - sw * k) / 2, (h - sh * k) / 2, sw * k, sh * k); }
  const d = C.d, tit = String(d.titulo || ''), tx = String(d.texto || '');
  if (tit || tx) {
    const y0 = src ? h - 150 : h / 2 - 70; if (src) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, y0 - 20, w, 170); }
    g.textAlign = 'center'; g.fillStyle = '#ffd34d'; g.font = 'bold 64px system-ui, sans-serif'; if (tit) g.fillText(tit.slice(0, 32), w / 2, y0 + 50);
    g.fillStyle = '#fff'; g.font = '38px system-ui, sans-serif';
    const pal = tx.split(/\s+/), lin = []; let l = ''; for (const p of pal) { if (g.measureText(l + ' ' + p).width > w - 80 && l) { lin.push(l); l = p; } else l = l ? l + ' ' + p : p; } if (l) lin.push(l);
    lin.slice(0, src ? 2 : 5).forEach((s, i) => g.fillText(s, w / 2, y0 + (tit ? 110 : 40) + i * 46));
  }
  g.strokeStyle = '#ffd34d'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
}
function ordCieloFin() { const C = ORD.cielo; ORD.cielo = null; if (C && C.vid) { try { C.vid.pause(); C.vid.removeAttribute('src'); C.vid.load(); } catch (e) {} } }
// (dibujar: principal.js, con lo del evento; siempre de frente a la cámara)
function ordDibujar() {
  const C = ORD.cielo; if (!C || C.espera || !C.L || !C.c) return;
  if (C.vid && C.vid.readyState >= 2 && !C.vid.paused) { C.t += TIEMPO.dt; if (C.t > 1 / 15) { C.t = 0; C.L.pintar(); } }   // (el video: 15 cuadros por segundo alcanzan allá arriba)
  const d = vsub(CAM.pos, C.c), L = d.len() || 1, q = Quat.euler(Math.atan2(d.x, d.z), -Math.asin(clamp(d.y / L, -1, 1)));   // (de frente a la cámara, también para arriba)
  m4trs([C.c.x, C.c.y, C.c.z], [q.x, q.y, q.z, q.w], [42, 23.6, 1], C.M); encolar(ev3Quad(), 0, C.L.mat, C.M, null, null);
}
// ---------------- la cinemática ----------------
function ordCine(uid, d, hasta) {
  if (!ordUrlBien(d.url)) return;
  if (ORD.cine) ordCineFin();
  const C = ORD.cine = { uid, d, hasta, url: null, listo: false, empezo: false, el: null };
  ORD.activas.set(uid, { tipo: 'cine', hasta, fin: ordCineFin });
  // (se baja ya, en segundo plano: cuando sea la hora, está entero)
  fetch(d.url).then((r) => (r.ok ? r.blob() : null)).then((b) => { if (ORD.cine !== C || !b) return; C.url = URL.createObjectURL(b); C.listo = true; ordCineVer(); }).catch(() => { if (ORD.cine === C) { C.url = d.url; C.listo = true; ordCineVer(); } });
  const espera = Math.max(0, (+d.cuando || 0) - Date.now()); C.tEmpieza = setTimeout(() => { C.hora = true; ordCineVer(); }, espera);
}
function ordCineVer() {
  const C = ORD.cine; if (!C || !C.listo || !C.hora || C.empezo) return; C.empezo = true;
  const el = C.el = document.createElement('div'); el.id = 'ordCine';
  const v = document.createElement('video'); v.src = C.url; v.playsInline = true; v.autoplay = true;
  const toca = document.createElement('button'); toca.className = 'ordToca oc'; toca.textContent = '▶';
  const x = document.createElement('button'); x.className = 'ordX oc'; x.textContent = '×'; x.onclick = () => ordQuitar(C.uid);
  el.append(v, toca, x); document.body.appendChild(el);
  if (typeof soltarPuntero === 'function') soltarPuntero();
  // (el juego bajito mientras tanto)
  try { if (AUD.master) { C.vol = AUD.master.gain.value; AUD.master.gain.value = C.vol * 0.15; } } catch (e) {}
  // (si llegó tarde —abrió el juego en el medio—, desde donde va)
  const d = C.d; if (+d.cuando > 0) v.addEventListener('loadedmetadata', () => { const ya = (Date.now() - d.cuando) / 1000; if (ya > 1 && ya < v.duration - 1) v.currentTime = ya; }, { once: true });
  v.play().catch(() => { toca.classList.remove('oc'); toca.onclick = () => { toca.classList.add('oc'); v.play().catch(() => {}); }; });
  v.onended = () => { x.classList.remove('oc'); setTimeout(() => ordQuitar(C.uid), 1500); };
  setTimeout(() => x.classList.remove('oc'), 8000);   // (y si alguien no quiere verla entera, a los 8 s puede cerrarla)
}
function ordCineFin() {
  const C = ORD.cine; ORD.cine = null; if (!C) return; clearTimeout(C.tEmpieza);
  if (C.el) { const v = C.el.querySelector('video'); try { v.pause(); } catch (e) {} C.el.remove(); }
  if (C.url && C.url.startsWith('blob:')) URL.revokeObjectURL(C.url);
  try { if (C.vol !== undefined && AUD.master) AUD.master.gain.value = C.vol; } catch (e) {}
}
// ---------------- todos a un mapa ----------------
function ordIr(uid, d, hasta) {
  const mapa = String(d.mapa || ''); if (!(typeof mapaValido === 'function' && mapaValido(mapa))) return;
  const S = d.juntos && typeof SALAS_OF !== 'undefined' ? SALAS_OF.find((s) => s.m === mapa) || null : null;
  const nom = typeof mapaNom === 'function' ? mapaNom(mapa) : mapa;
  ordAviso(uid + '_v', { titulo: T('ord.teLlevan').replace('%s', nom), texto: String(d.texto || ''), seg: 6 }, hasta);
  ORD.activas.set(uid, { tipo: 'ir', hasta, fin: () => {} });
  setTimeout(() => {
    if (typeof EV3 !== 'undefined' && EV3.fase) return;
    ORD.irPos = Array.isArray(d.pos) && d.pos.length === 3 && d.pos.every(isFinite) ? { mapa, p: v3(+d.pos[0], +d.pos[1], +d.pos[2]) } : null;
    const ya = JUEGO.estado === 'juego' && MUNDO.nombre === mapa && (!S || (SALA && SALA.id === S.id));
    if (ya) { ordIrPos(mapa); return; }
    if (typeof cerrarPaneles === 'function') try { cerrarPaneles(); } catch (e) {}
    SALA = S ? Object.assign({}, S, { clave: '' }) : null;
    if (typeof RB !== 'undefined') { RB.horaPartida = 'normal'; RB.mapaPartida = null; RB.mapaCom = null; }
    if (typeof inicioMostrar === 'function') inicioMostrar(false);
    empezarPartida(mapa);
  }, 2500);
}
function ordIrPos(mapa) {
  const I = ORD.irPos; if (!I || I.mapa !== mapa) return; ORD.irPos = null;
  // (cerca del lugar, no todos en el mismo punto)
  const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 3; JUG.pos.set(I.p.x + Math.cos(a) * r, I.p.y, I.p.z + Math.sin(a) * r); JUG.vel.set(0, 0, 0);
}
// ---------------- un guion (como los de los eventos en vivo) ----------------
function ordGuion(uid, d, hasta) {
  const js = String(d.js || ''); if (!js.trim()) return;
  let ev; try { const f = eval('(function () {\n"use strict";\n' + js + '\n})'); ev = f() || {}; } catch (e) { console.warn('panel guion', e); if (typeof cnAnotar === 'function') cnAnotar('panel', 'guion: ' + String(e && e.message || e).slice(0, 200)); return; }
  ORD.guiones.set(uid, ev);
  const fin = () => { const g = ORD.guiones.get(uid); ORD.guiones.delete(uid); if (g && typeof g.fin === 'function') try { g.fin(); } catch (e) {} };
  ORD.activas.set(uid, { tipo: 'guion', hasta, fin });
  ordGancho(uid, 'empezar'); if (JUEGO.estado === 'juego' && typeof MUNDO !== 'undefined') ordGancho(uid, 'alEntrar', MUNDO.nombre);
}
function ordGancho(uid, n, ...a) { const g = ORD.guiones.get(uid); if (!g || typeof g[n] !== 'function') return; try { g[n](...a); } catch (e) { console.warn('panel guion', n, e); if (typeof cnAnotar === 'function') cnAnotar('panel', 'guion ' + n + ': ' + String(e && e.message || e).slice(0, 200)); ordQuitar(uid); } }
// ---------------- los enganches (principal.js) ----------------
function ordEnPartida(mapa) {
  ordIrPos(mapa);
  if (ORD.cielo) { ORD.cielo.espera = true; ordCieloPoner(); }
  for (const uid of [...ORD.guiones.keys()]) ordGancho(uid, 'alEntrar', mapa);
  if (ORD.on) setTimeout(ordHola, 1500);
}
function ordPaso(dt) { for (const uid of [...ORD.guiones.keys()]) ordGancho(uid, 'paso', dt); }

// =====================================================================================================
// Bugs y sugerencias (el menú del juego)
// =====================================================================================================
const BUG = { tipo: 'bug', orden: 'nuevo', posts: [], p: 0, cargando: false, mas: true, ver: null, form: null, subiendo: '', votos: {}, error: '' };
const bugApi = (r, o) => ((TEST || navigator.webdriver) && Q.get('panel') ? fetch(Q.get('panel') + r, o) : typeof cuApi === 'function' ? cuApi('panel/' + r, o) : fetch(TIENDA_URL + 'panel/' + r, o));
const bugMedia = (id) => ordBase() + 'media/' + id;
// (un pedazo del texto, cortado en una palabra entera y con «…»)
const bugCorto = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); if (t.length <= n) return t; const c = t.slice(0, n), i = c.lastIndexOf(' '); return (i > n * 0.6 ? c.slice(0, i) : c).replace(/[\s,.;:]+$/, '') + '…'; };
// (para que no se sature: el servidor deja una cada 3 minutos; acá se avisa antes de subir las fotos)
const BUG_ESPERA = 3 * 60e3;
// cuánto falta para poder publicar otra (lo que dijo el servidor la última vez —una cada 3 min, 4 por hora, 10 por día—
// queda en jx_bug_ult), y el texto del aviso: «Esperá 2:41 para volver a publicar un bug / una idea»
function bugEsperaMs() { let ult = 0; try { ult = +localStorage.getItem('jx_bug_ult') || 0; } catch (e) { /* sin lugar */ } return Math.max(0, BUG_ESPERA - (Date.now() - ult)); }
function bugEsperaTexto(tipo) {
  const s = Math.ceil(bugEsperaMs() / 1000), t = s >= 3600 ? Math.floor(s / 3600) + ':' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ' h' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  return T(tipo === 'sug' ? 'bg.esperaSug' : 'bg.esperaBug').replace('%s', t);
}
// (mientras el formulario está abierto y hay que esperar: el número baja cada segundo, y al llegar a cero se prende Publicar)
let BUG_RELOJ = 0;
function bugEsperaReloj() {
  clearInterval(BUG_RELOJ); BUG_RELOJ = 0;
  if (!BUG.form || bugEsperaMs() <= 0) return;
  BUG_RELOJ = setInterval(() => {
    const e = RB.panel === 'bugs' && RB.el && RB.el.querySelector('.bgEsperaTxt');
    if (!BUG.form || RB.panel !== 'bugs' || !e) { clearInterval(BUG_RELOJ); BUG_RELOJ = 0; return; }
    if (bugEsperaMs() <= 0) { clearInterval(BUG_RELOJ); BUG_RELOJ = 0; inicioPanel('bugs'); return; }
    e.textContent = bugEsperaTexto(BUG.form.tipo);
  }, 1000);
}
const BUG_EST = { nuevo: '#9aa3b2', visto: '#5fa8ff', en_curso: '#ffb84d', hecho: '#5fd36a', no: '#ff6b6b' };
function panelBugs(P) {
  const tabs = [['bug', 'bg.bugs', 'bicho'], ['sug', 'bg.sugs', 'foco'], ['nov', 'bg.novedades', 'estrella']];
  const cab = `<div class="rbPanCab">${glifo('bicho')} ${esc(T('m.bugs'))}<span class="rbTabs">${tabs.map(([k, t, g]) => `<button class="rbTab${BUG.tipo === k && !BUG.form ? ' sel' : ''}" data-rb="bg:tab|${k}">${glifo(g)} ${esc(T(t))}</button>`).join('')}</span></div>`;
  let cuerpo = '', pie = '';
  if (BUG.form) {
    const F = BUG.form;
    cuerpo = `<div class="rbPanCuerpo bgForm">
      <div class="bgTipos"><button class="bgTipo${F.tipo === 'bug' ? ' sel' : ''}" data-rb="bg:ftipo|bug">${glifo('bicho')} ${esc(T('bg.unBug'))}</button><button class="bgTipo${F.tipo === 'sug' ? ' sel' : ''}" data-rb="bg:ftipo|sug">${glifo('foco')} ${esc(T('bg.unaSug'))}</button></div>
      <input class="bgTit" maxlength="90" placeholder="${esc(T(F.tipo === 'bug' ? 'bg.titBug' : 'bg.titSug'))}" value="${esc(F.titulo)}">
      <textarea class="bgTexto" maxlength="4000" rows="5" placeholder="${esc(T(F.tipo === 'bug' ? 'bg.txtBug' : 'bg.txtSug'))}">${esc(F.texto)}</textarea>
      <div class="bgAdj">${F.archivos.map((a, i) => `<div class="bgMini">${a.url ? (a.vid ? `<video src="${a.url}" muted></video>` : `<img src="${a.url}" alt="">`) : ''}<button data-rb="bg:sacar|${i}">×</button></div>`).join('')}
        ${F.archivos.length < 4 ? `<label class="bgSumar">${glifo('camara')}<span>${esc(T('bg.adjuntar'))}</span><input type="file" accept="image/*,video/*" multiple class="bgArch"></label>` : ''}</div>
      <p class="rbAyudaC">${esc(T('bg.ayuda'))}</p>${BUG.error ? `<p class="bgErr">${esc(BUG.error)}</p>` : ''}${BUG.subiendo ? `<p class="bgSube">${esc(BUG.subiendo)}</p>` : ''}</div>`;
    // (si todavía no se puede publicar otra: arriba de todo, cuánto falta, bajando solo; Publicar queda apagado hasta entonces)
    if (bugEsperaMs() > 0) cuerpo = cuerpo.replace('<div class="rbPanCuerpo bgForm">', `<div class="rbPanCuerpo bgForm"><p class="bgEspera">${glifo('reloj')} <span class="bgEsperaTxt">${esc(bugEsperaTexto(F.tipo))}</span></p>`);
    pie = `<div class="rbPanPie"><button class="rbBtnGris" data-rb="bg:cancelar">${glifo('atras')} ${esc(T('cancelar'))}</button><span class="rbEsp"></span><button class="rbBtnG"${BUG.subiendo || bugEsperaMs() > 0 ? ' disabled' : ''} data-rb="bg:publicar">${glifo('subir')} ${esc(T('bg.publicar'))}</button></div>`;
  } else if (BUG.ver) {
    const p = BUG.ver;
    cuerpo = `<div class="rbPanCuerpo bgVer"><div class="bgCab"><span class="bgEst" style="--c:${BUG_EST[p.estado] || '#999'}">${esc(T('bg.e.' + p.estado))}</span><h3>${esc(p.titulo)}</h3>
      <small>${esc(p.nombre || T('bg.anonimo'))} · ${esc(new Date(p.creado).toLocaleDateString())}${p.version ? ' · ' + esc(p.version) : ''}${p.lugar ? ' · ' + esc(p.lugar) : ''}</small></div>
      <p class="bgTxt">${esc(p.texto)}</p>
      <div class="bgGal">${p.media.map((m) => (m.mime.startsWith('video/') ? `<video src="${esc(bugMedia(m.id))}" controls playsinline preload="metadata"></video>` : `<img src="${esc(bugMedia(m.id))}" alt="" loading="lazy">`)).join('')}</div>
      ${p.respuesta ? `<div class="bgResp"><b>${glifo('chat')} ${esc(T('bg.respDe').replace('%s', p.resp_de || 'JXMod'))}</b><p>${esc(p.respuesta)}</p></div>` : ''}</div>`;
    pie = `<div class="rbPanPie"><button class="rbBtnGris" data-rb="bg:lista">${glifo('atras')} ${esc(T('volver'))}</button><span class="rbEsp"></span>
      <button class="rbBtnGris${BUG.votos[p.id + 'l'] ? ' sel' : ''}" data-rb="bg:like|${p.id}">${glifo('corazon')} ${p.likes + (BUG.votos[p.id + 'l'] ? 1 : 0)}</button><button class="rbBtnGris" data-rb="bg:denunciar|${p.id}">${glifo('prohibido')}</button></div>`;
  } else if (BUG.tipo === 'nov') {
    // (el registro de actualizaciones: cada versión con lo que trajo, la más nueva arriba —juego/novedades.js—)
    const L = typeof NOVEDADES !== 'undefined' ? NOVEDADES : [], en = PREFS.lang !== 'es' && PREFS.lang !== 'pt';
    cuerpo = `<div class="rbPanCuerpo bgNov">${L.length ? L.map((n, i) => `<div class="bgNovItem${i ? '' : ' nueva'}"><div class="bgNovCab"><b>JXMod ${esc(n.v)}</b>${i ? '' : `<i>${esc(T('bg.tuVersion'))}</i>`}<small>${esc(n.f)}</small></div><p>${esc(en ? n.en : n.es)}</p></div>`).join('') : `<p class="rbAyudaC">${esc(T('bg.sinNovedades'))}</p>`}</div>`;
    pie = `<div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">${glifo('atras')} ${esc(T('volver'))}</button><span class="rbEsp"></span></div>`;
  } else {
    const L = BUG.posts;
    cuerpo = `<div class="rbPanCuerpo bgLista"><div class="bgOrden"><button class="${BUG.orden === 'nuevo' ? 'sel' : ''}" data-rb="bg:orden|nuevo">${esc(T('bg.nuevos'))}</button><button class="${BUG.orden === 'pop' ? 'sel' : ''}" data-rb="bg:orden|pop">${esc(T('bg.populares'))}</button></div>
      ${L.length ? L.map((p) => { const m = p.media[0]; return `<div class="bgItem" data-rb="bg:ver|${p.id}">${m ? (m.mime.startsWith('video/') ? `<div class="bgMin bgVid">${glifo('video')}</div>` : `<img class="bgMin" src="${esc(bugMedia(m.id))}" alt="" loading="lazy">`) : `<div class="bgMin">${glifo(p.tipo === 'bug' ? 'bicho' : 'foco')}</div>`}
        <div class="bgDatos"><b>${esc(p.titulo)}</b><small>${esc(bugCorto(p.texto, 140))}</small><span><i class="bgEst" style="--c:${BUG_EST[p.estado] || '#999'}">${esc(T('bg.e.' + p.estado))}</i> ♥ ${p.likes}${p.media.length ? ' · ' + glifo('camara') + ' ' + p.media.length : ''}${p.respuesta ? ' · ' + glifo('chat') + ' ' + esc(p.resp_de || '') : ''}</span></div></div>`; }).join('')
        : `<p class="rbAyudaC">${esc(BUG.cargando ? T('cargando') : BUG.error || T(BUG.tipo === 'bug' ? 'bg.vacioBug' : 'bg.vacioSug'))}</p>`}
      ${L.length && BUG.mas ? `<button class="rbBtnGris bgMas" data-rb="bg:mas">${esc(T('bg.mas'))}</button>` : ''}</div>`;
    pie = `<div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">${glifo('atras')} ${esc(T('volver'))}</button><span class="rbEsp"></span><button class="rbBtnG" data-rb="bg:nuevo">${glifo('mas')} ${esc(T(BUG.tipo === 'bug' ? 'bg.contarBug' : 'bg.contarSug'))}</button></div>`;
  }
  P.innerHTML = cab + cuerpo + pie;
  if (BUG.form) {
    const ti = P.querySelector('.bgTit'), tx = P.querySelector('.bgTexto'), ar = P.querySelector('.bgArch');
    ti.oninput = () => { BUG.form.titulo = ti.value; }; tx.oninput = () => { BUG.form.texto = tx.value; };
    for (const e of [ti, tx]) e.addEventListener('keydown', (ev) => ev.stopPropagation());
    if (ar) ar.onchange = () => { for (const f of [...ar.files].slice(0, 4 - BUG.form.archivos.length)) bugSumar(f); inicioPanel('bugs'); };
  }
  if (!BUG.form && !BUG.ver && !BUG.listo && !BUG.cargando && BUG.tipo !== 'nov') bugCargar(true);
  bugEsperaReloj();   // (una vez por pestaña y orden: vacía también es cargada)
}
async function bugCargar(nuevo) {
  if (BUG.cargando) return; BUG.cargando = true; BUG.listo = true; BUG.error = ''; if (nuevo) { BUG.p = 0; BUG.posts = []; BUG.mas = true; }
  try {
    const r = await bugApi(`posts?tipo=${BUG.tipo}&orden=${BUG.orden}&p=${BUG.p}`); const d = await r.json();
    const L = d.posts || []; BUG.posts.push(...L); BUG.mas = L.length === 20; BUG.p++;
  } catch (e) { BUG.error = T('bg.sinRed'); }
  BUG.cargando = false; if (RB.panel === 'bugs') inicioPanel('bugs');
}
// (un archivo: las imágenes se achican a 1600 px en JPEG; los videos van como están, hasta 24 MB)
function bugSumar(f) {
  const F = BUG.form; if (!F) return; BUG.error = '';
  const vid = /^video\//.test(f.type), img = /^image\//.test(f.type);
  if (!vid && !img) { BUG.error = T('bg.soloImgVid'); return; }
  if (vid && f.size > 24 * 1048576) { BUG.error = T('bg.muyGrande'); return; }
  F.archivos.push({ f, vid, url: URL.createObjectURL(f) });
}
async function bugAchicar(f) {
  try {
    const bm = await createImageBitmap(f), k = Math.min(1, 1600 / Math.max(bm.width, bm.height)), cv = document.createElement('canvas');
    cv.width = Math.round(bm.width * k); cv.height = Math.round(bm.height * k); cv.getContext('2d').drawImage(bm, 0, 0, cv.width, cv.height);
    const b = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.82)); return { b, mime: 'image/jpeg', w: cv.width, h: cv.height };
  } catch (e) { return f.size < 6e6 ? { b: f, mime: f.type, w: 0, h: 0 } : null; }
}
async function bugSubir(a, n, de) {
  let b = a.f, mime = a.f.type, w = 0, h = 0, dur = 0;
  if (!a.vid) { const x = await bugAchicar(a.f); if (!x) throw new Error(T('bg.muyGrande')); ({ b, mime, w, h } = x); }
  else { mime = /^video\/(mp4|webm|quicktime)$/.test(mime) ? mime : 'video/mp4'; dur = await new Promise((ok) => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => ok(v.duration || 0); v.onerror = () => ok(0); v.src = a.url; }); }
  const buf = new Uint8Array(await b.arrayBuffer()), PARTE = 1572864, partes = Math.max(1, Math.ceil(buf.length / PARTE)); let id = '';
  for (let i = 0; i < partes; i++) {
    BUG.subiendo = T('bg.subiendo').replace('%n', n).replace('%d', de) + ' ' + Math.round((i / partes) * 100) + '%'; if (RB.panel === 'bugs') { const s = RB.el.querySelector('.bgSube'); if (s) s.textContent = BUG.subiendo; else inicioPanel('bugs'); }
    const h0 = { 'Content-Type': 'application/octet-stream' }; if (typeof CU !== 'undefined' && CU.token) h0.Authorization = 'Bearer ' + CU.token;
    const url = (((TEST || navigator.webdriver) && Q.get('panel')) || TIENDA_URL + 'panel/') + `media?parte=${i}&partes=${partes}&mime=${encodeURIComponent(mime)}&tam=${buf.length}` + (id ? '&id=' + id : '');
    const r = await fetch(url, { method: 'POST', headers: h0, body: buf.subarray(i * PARTE, (i + 1) * PARTE) }), d = await r.json().catch(() => ({}));
    if (!r.ok || !d.id) throw new Error(d.error || ('error ' + r.status)); id = d.id;
  }
  return { id, w, h, dur };
}
async function bugPublicar() {
  const F = BUG.form; if (!F || BUG.subiendo) return;
  if (String(F.titulo).trim().length < 3) { BUG.error = T('bg.faltaTit'); inicioPanel('bugs'); return; }
  if (typeof cuentaPedir === 'function' && !cuentaPedir('bugs', () => bugPublicar())) return;
  if (bugEsperaMs() > 0) { inicioPanel('bugs'); return; }
  BUG.error = '';
  try {
    const media = [];
    for (let i = 0; i < F.archivos.length; i++) media.push(await bugSubir(F.archivos[i], i + 1, F.archivos.length));
    BUG.subiendo = T('bg.publicando'); inicioPanel('bugs');
    const lugar = (JUEGO.estado === 'juego' && typeof MUNDO !== 'undefined' ? MUNDO.nombre : (PREFS.mapa || '')) + ' · ' + (window.JXNativo ? 'app' : 'web') + (typeof COARSE !== 'undefined' && COARSE ? ' celu' : ' pc') + ' · ' + (typeof GFX !== 'undefined' ? GFX.nombre : '');
    const r = await bugApi('post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: F.tipo, titulo: F.titulo, texto: F.texto, media, version: typeof JX_VERSION !== 'undefined' ? JX_VERSION : '', lugar, nombre: PREFS.nombre || '' }) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && d.cuenta && typeof cuDialogo === 'function') { BUG.subiendo = ''; cuDialogo('bugs', () => bugPublicar()); inicioPanel('bugs'); return; }
    if (r.status === 429 && d.espera) { try { localStorage.setItem('jx_bug_ult', String(Date.now() - BUG_ESPERA + d.espera * 1000)); } catch (e) { /* sin lugar */ } BUG.subiendo = ''; inicioPanel('bugs'); return; }
    if (!r.ok || !d.id) throw new Error(d.error || ('error ' + r.status));
    for (const a of F.archivos) URL.revokeObjectURL(a.url);
    try { localStorage.setItem('jx_bug_ult', String(Date.now())); } catch (e) { /* sin lugar */ }
    BUG.tipo = F.tipo; BUG.form = null; BUG.subiendo = ''; BUG.posts = []; BUG.orden = 'nuevo'; BUG.listo = false;
    if (typeof menuAviso === 'function') menuAviso(T('bg.gracias')); bugCargar(true);
  } catch (e) { BUG.subiendo = ''; BUG.error = String(e && e.message || e); inicioPanel('bugs'); }
}
async function bugsAccion(v, b) {
  const [a, x] = String(v || '').split('|');
  switch (a) {
    case 'tab': BUG.tipo = x === 'sug' || x === 'nov' ? x : 'bug'; BUG.ver = null; BUG.form = null; BUG.posts = []; BUG.error = ''; BUG.listo = false; return inicioPanel('bugs');
    case 'orden': BUG.orden = x === 'pop' ? 'pop' : 'nuevo'; BUG.posts = []; BUG.error = ''; BUG.listo = false; return inicioPanel('bugs');
    case 'mas': return bugCargar(false);
    case 'nuevo': BUG.form = { tipo: BUG.tipo === 'sug' ? 'sug' : 'bug', titulo: '', texto: '', archivos: [] }; BUG.error = ''; return inicioPanel('bugs');
    case 'ftipo': BUG.form.tipo = x === 'sug' ? 'sug' : 'bug'; return inicioPanel('bugs');
    case 'sacar': { const r = BUG.form.archivos.splice(+x, 1)[0]; if (r) URL.revokeObjectURL(r.url); return inicioPanel('bugs'); }
    case 'cancelar': if (BUG.form) for (const r of BUG.form.archivos) URL.revokeObjectURL(r.url); BUG.form = null; BUG.error = ''; return inicioPanel('bugs');
    case 'publicar': return bugPublicar();
    case 'ver': BUG.ver = BUG.posts.find((p) => p.id === x) || null; if (BUG.ver) bugApi('post/' + x).then((r) => r.json()).then((d) => { if (d.post && BUG.ver && BUG.ver.id === x) { BUG.ver = d.post; inicioPanel('bugs'); } }).catch(() => {}); return inicioPanel('bugs');
    case 'lista': BUG.ver = null; return inicioPanel('bugs');
    case 'like': case 'denunciar': {
      const k = a === 'like' ? 'l' : 'd'; if (BUG.votos[x + k]) return; if (k === 'd' && !confirm(T('denunciar') + '?')) return;
      BUG.votos[x + k] = 1; bugApi('voto/' + x, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: k === 'l' ? 'like' : 'denuncia' }) }).catch(() => {});
      if (k === 'd') { BUG.ver = null; BUG.posts = BUG.posts.filter((p) => p.id !== x); if (typeof menuAviso === 'function') menuAviso(T('bg.denunciado')); }
      return inicioPanel('bugs');
    }
  }
}
Object.assign(IDI3, {
  'av.titulo': ['Avisos', 'News', 'Avisos', 'Pemberitahuan', 'Notis', 'Mga abiso', 'お知らせ', 'ประกาศ', 'Duyurular', 'الإشعارات', 'Новости', 'Новини', 'Annonces', 'Neuigkeiten'],
  'av.vacio': ['No hay avisos por ahora.', 'No news for now.', 'Nenhum aviso por enquanto.', 'Belum ada pemberitahuan.', 'Tiada notis buat masa ini.', 'Wala pang abiso.', 'お知らせはまだありません。', 'ยังไม่มีประกาศ', 'Şimdilik duyuru yok.', 'لا توجد إشعارات حاليًا.', 'Пока новостей нет.', 'Поки що новин немає.', 'Aucune annonce pour le moment.', 'Noch keine Neuigkeiten.'],
  'av.abrir': ['Abrir', 'Open', 'Abrir', 'Buka', 'Buka', 'Buksan', '開く', 'เปิด', 'Aç', 'فتح', 'Открыть', 'Відкрити', 'Ouvrir', 'Öffnen'],
  'av.activar': ['Avisarme en este aparato', 'Notify me on this device', 'Me avisar neste aparelho', 'Beri tahu saya di perangkat ini', 'Maklumkan saya di peranti ini', 'Abisuhan ako sa device na ito', 'この端末で通知を受け取る', 'แจ้งเตือนฉันบนอุปกรณ์นี้', 'Bu cihazda bana bildir', 'نبّهني على هذا الجهاز', 'Уведомлять на этом устройстве', 'Сповіщати на цьому пристрої', "M'avertir sur cet appareil", 'Auf diesem Gerät benachrichtigen'],
  'av.activoPush': ['Te avisamos en este aparato aunque el juego esté cerrado.', 'We notify you on this device even when the game is closed.', 'Avisamos neste aparelho mesmo com o jogo fechado.', 'Kami beri tahu di perangkat ini meski game ditutup.', 'Kami maklumkan di peranti ini walaupun permainan ditutup.', 'Aabisuhan ka namin sa device na ito kahit sarado ang laro.', 'ゲームを閉じていてもこの端末に通知します。', 'เราจะแจ้งเตือนบนอุปกรณ์นี้แม้ปิดเกมอยู่', 'Oyun kapalıyken bile bu cihazda bildiririz.', 'سننبّهك على هذا الجهاز حتى لو كانت اللعبة مغلقة.', 'Мы уведомим на этом устройстве, даже если игра закрыта.', 'Ми сповістимо на цьому пристрої, навіть якщо гра закрита.', 'On te prévient sur cet appareil même quand le jeu est fermé.', 'Wir benachrichtigen dich auf diesem Gerät, auch wenn das Spiel geschlossen ist.'],
  'av.activoAbierto': ['Te avisamos con el juego abierto, aunque estés en otra pestaña.', 'We notify you while the game is open, even in another tab.', 'Avisamos com o jogo aberto, mesmo em outra aba.', 'Kami beri tahu selama game terbuka, meski di tab lain.', 'Kami maklumkan semasa permainan dibuka, walaupun di tab lain.', 'Aabisuhan ka namin habang bukas ang laro, kahit nasa ibang tab ka.', 'ゲームを開いている間は、別のタブにいても通知します。', 'เราจะแจ้งเตือนขณะเปิดเกม แม้อยู่ในแท็บอื่น', 'Oyun açıkken, başka sekmede olsan bile bildiririz.', 'سننبّهك ما دامت اللعبة مفتوحة، حتى في تبويب آخر.', 'Уведомим, пока игра открыта, даже в другой вкладке.', 'Сповістимо, поки гра відкрита, навіть в іншій вкладці.', 'On te prévient tant que le jeu est ouvert, même dans un autre onglet.', 'Wir benachrichtigen dich, solange das Spiel offen ist, auch in einem anderen Tab.'],
  'av.bloqueadas': ['Las notificaciones están bloqueadas: activalas en los ajustes del navegador para este sitio.', 'Notifications are blocked: allow them in the browser settings for this site.', 'As notificações estão bloqueadas: ative-as nas configurações do navegador para este site.', 'Notifikasi diblokir: izinkan di pengaturan browser untuk situs ini.', 'Pemberitahuan disekat: benarkan dalam tetapan pelayar untuk laman ini.', 'Naka-block ang notifications: payagan sa settings ng browser para sa site na ito.', '通知がブロックされています。ブラウザのサイト設定で許可してください。', 'การแจ้งเตือนถูกบล็อก เปิดได้ในการตั้งค่าเบราว์เซอร์ของเว็บนี้', 'Bildirimler engelli: tarayıcı ayarlarından bu site için izin ver.', 'الإشعارات محظورة: فعّلها من إعدادات المتصفح لهذا الموقع.', 'Уведомления заблокированы: разрешите их в настройках браузера для этого сайта.', 'Сповіщення заблоковано: дозвольте їх у налаштуваннях браузера для цього сайту.', 'Les notifications sont bloquées : autorise-les dans les réglages du navigateur pour ce site.', 'Benachrichtigungen sind blockiert: erlaube sie in den Browser-Einstellungen für diese Seite.'],
  'm.bugs': ['Bugs y sugerencias', 'Bugs & ideas', 'Bugs e sugestões'],
  'bg.bugs': ['Bugs', 'Bugs', 'Bugs'], 'bg.sugs': ['Sugerencias', 'Suggestions', 'Sugestões'], 'bg.novedades': ['Novedades', 'Updates', 'Novidades'],
  'bg.tuVersion': ['la última', 'latest', 'a última'], 'bg.sinNovedades': ['Todavía no hay novedades.', 'No updates yet.', 'Ainda não há novidades.'],
  'bg.esperaBug': ['Esperá %s para volver a publicar un bug', 'Wait %s to post another bug', 'Espere %s para publicar outro bug'],
  'bg.esperaSug': ['Esperá %s para volver a publicar una idea', 'Wait %s to post another idea', 'Espere %s para publicar outra ideia'],
  'bg.unBug': ['Un bug', 'A bug', 'Um bug'], 'bg.unaSug': ['Una sugerencia', 'A suggestion', 'Uma sugestão'],
  'bg.titBug': ['¿Qué pasa? (corto)', "What's wrong? (short)", 'O que acontece? (curto)'], 'bg.titSug': ['Tu idea (corto)', 'Your idea (short)', 'Sua ideia (curto)'],
  'bg.txtBug': ['Contá qué hiciste, qué pasó y qué esperabas que pase', 'Say what you did, what happened and what you expected', 'Conte o que você fez, o que aconteceu e o que esperava'],
  'bg.txtSug': ['Contala con detalle', 'Tell us in detail', 'Conte com detalhes'],
  'bg.adjuntar': ['Fotos o videos', 'Photos or videos', 'Fotos ou vídeos'],
  'bg.ayuda': ['Hasta 4 imágenes o videos (los videos, hasta 24 MB). La versión, el mapa y el aparato van solos.', 'Up to 4 images or videos (videos up to 24 MB). Version, map and device are added automatically.', 'Até 4 imagens ou vídeos (vídeos até 24 MB). Versão, mapa e aparelho vão sozinhos.'],
  'bg.publicar': ['Publicar', 'Post', 'Publicar'], 'bg.publicando': ['Publicando…', 'Posting…', 'Publicando…'],
  'bg.subiendo': ['Subiendo %n de %d…', 'Uploading %n of %d…', 'Enviando %n de %d…'],
  'bg.contarBug': ['Contar un bug', 'Report a bug', 'Relatar um bug'], 'bg.contarSug': ['Dar una idea', 'Suggest something', 'Dar uma ideia'],
  'bg.nuevos': ['Nuevos', 'New', 'Novos'], 'bg.populares': ['Más votados', 'Top voted', 'Mais votados'], 'bg.mas': ['Ver más', 'Load more', 'Ver mais'],
  'bg.vacioBug': ['Todavía no hay bugs publicados. ¿Encontraste uno? Contalo.', 'No bugs yet. Found one? Report it.', 'Ainda não há bugs. Achou um? Conte.'],
  'bg.vacioSug': ['Todavía no hay sugerencias. ¡Dejá la primera!', 'No suggestions yet. Leave the first one!', 'Ainda não há sugestões. Deixe a primeira!'],
  'bg.sinRed': ['No se pudo cargar (¿sin internet?)', "Couldn't load (offline?)", 'Não carregou (sem internet?)'],
  'bg.faltaTit': ['Poné un título', 'Add a title', 'Coloque um título'], 'bg.soloImgVid': ['Sólo imágenes o videos', 'Images or videos only', 'Só imagens ou vídeos'],
  'bg.muyGrande': ['Muy grande (los videos, hasta 24 MB)', 'Too big (videos up to 24 MB)', 'Muito grande (vídeos até 24 MB)'],
  'bg.gracias': ['¡Publicado! Gracias', 'Posted! Thanks', 'Publicado! Obrigado'], 'bg.espera': ['Esperá %s min para publicar otra (así no se satura). Mientras, dale ♥ a las que ya están.', 'Wait %s min before posting again. Meanwhile, ♥ the ones already there.', 'Espere %s min para publicar outra. Enquanto isso, dê ♥ nas que já estão.'], 'bg.denunciado': ['Denunciado', 'Reported', 'Denunciado'],
  'bg.anonimo': ['Anónimo', 'Anonymous', 'Anônimo'], 'bg.respDe': ['Respuesta de %s', 'Reply from %s', 'Resposta de %s'],
  'bg.e.nuevo': ['Nuevo', 'New', 'Novo'], 'bg.e.visto': ['Visto', 'Seen', 'Visto'], 'bg.e.en_curso': ['Arreglándose', 'In progress', 'Em andamento'], 'bg.e.hecho': ['Hecho', 'Done', 'Feito'], 'bg.e.no': ['No va', "Won't do", 'Não vai'],
  'ord.teLlevan': ['Te llevan a %s', 'Taking you to %s', 'Levando você para %s'],
  'cu.paraBugs': ['Para publicar bugs y sugerencias, iniciá sesión.', 'Sign in to post bugs and suggestions.', 'Entre na sua conta para publicar bugs e sugestões.'],
});
