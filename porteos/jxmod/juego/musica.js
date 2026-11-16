// ---------------- JXMod: la música del menú (Ajustes → Música) ----------------
// El dueño: «Agregá música al menú: solamente reproduciendo de fondo música de YouTube en vez de estar descargando música.
// Que en Ajustes → Música haya 10 opciones para elegir... cada opción debe tener 35 canciones en loop... La predeterminada
// es la opción Casual, con canciones como las de Kevin MacLeod». Y después: «que funcione sin internet, guardada y muy
// comprimida», sólo con lo que se puede repartir (Kevin MacLeod: CC BY 4.0), y «Mi música»: tus archivos.
//  · 10 estaciones de 35 canciones (juego/musica_estaciones.txt: artista — título — id de YouTube; las mete armar.py en
//    MUS_DATOS). Suenan por el reproductor de YouTube incrustado —como la radio y la música de los emotes: nada se baja—,
//    escondido (200×113, transparente, detrás de todo) y uno solo: de canción en canción se le pide la siguiente
//    (loadVideoById), no se arma de nuevo.
//  · Casual (la de fábrica): Kevin MacLeod. Sus 35 MP3 de incompetech.com, en Opus, van en un paquete aparte
//    (a_musica.*.rbp, como los de rb/: herramientas/musica/casual.py y remotos.py) que se baja solo, en segundo plano,
//    después de que el menú se puede tocar; queda guardado (cada canción en la caché del navegador) y desde ahí suena con un
//    <audio>, también sin internet. Mientras no está, Casual suena por YouTube.
//  · Mi música: archivos tuyos (se eligen en la pestaña; quedan en el aparato, en IndexedDB; nunca salen de ahí).
//  · Las 35 en bucle y mezcladas: un orden al azar por estación, que no repite hasta pasar por todas, y se recuerda por
//    dónde iba cada una (la canción y el segundo: jx_musica).
//  · Suena en el menú (el clásico y el depósito, también con los paneles y Ajustes abiertos) desde que se puede tocar; al
//    empezar una partida se apaga con un fundido de 1 s y se saca el reproductor (ni memoria ni datos jugando); al volver
//    al menú sigue donde iba. Se calla en segundo plano y mientras suena otra música de YouTube del juego (el editor de la
//    música de los emotes; la radio, la tele y la música de los emotes son de la partida). En la web el navegador no deja
//    sonar sin un toque: empieza con el primero; en la app de Android, sola. El volumen: el general por el de la música.
//  · Sin internet o si YouTube no contesta: silencio, sin avisos. Si un video no se puede poner (100/101/150...), salta
//    a la siguiente y lo anota en el registro.
//  · En el menú, una placa chica con lo que suena (la estación y la canción), que pasa a la siguiente o abre la pestaña.
// Ver pruebas/musica.mjs y la sección «Música en el menú» del LEEME.
const MUS_DATOS = /*MUSICA*/null;
// las estaciones: clave, color, ícono y tres de sus artistas
const MUS_EST = [
  ['casual', '#f2c14e', 'nota', 'Kevin MacLeod'],
  ['westside', '#ff6a3d', 'palmera', 'Ice Cube · Dr. Dre · 2Pac'],
  ['ncs', '#29c5f6', 'onda', 'Alan Walker · Elektronomia · Tobu'],
  ['phonk', '#b07cff', 'calavera', 'Kordhell · DVRST · INTERWORLD'],
  ['lofi', '#8fd19e', 'luna', 'Nujabes · Jinsang · idealism'],
  ['rock', '#ff6b6b', 'guitarra', 'Queen · AC/DC · Linkin Park'],
  ['latino', '#ff7eb6', 'maraca', 'Daddy Yankee · Don Omar · Gilda'],
  ['synthwave', '#ff4fd8', 'sol', 'Kavinsky · The Midnight · FM-84'],
  ['epica', '#7aa7ff', 'escudo', 'Two Steps From Hell · Audiomachine'],
  ['internet', '#6be675', 'mundo', 'Rick Astley · Darude · a-ha'],
];
const MUS_ICO = {
  nota: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  palmera: '<path d="M12 21c.4-4.6.2-8.6-1-12"/><path d="M11 9C9.5 6 6.5 5 3.5 6.5M11 9c-3-.6-5.6.9-6.6 3.6M11 9c.6-3.2 3.2-5 6.5-4.5M11 9c3-.2 5.6 1.6 6.4 4.4"/><path d="M7 21h10"/>',
  onda: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0"/>',
  calavera: '<path d="M12 2.8c-4.6 0-8 3.2-8 7.6 0 2.5 1.1 4.3 3 5.5v2.6c0 .9.7 1.6 1.6 1.6h6.8c.9 0 1.6-.7 1.6-1.6v-2.6c1.9-1.2 3-3 3-5.5 0-4.4-3.4-7.6-8-7.6z"/><circle cx="8.9" cy="11" r="1.9"/><circle cx="15.1" cy="11" r="1.9"/><path d="M12 13.5l-1 2h2zM10 20.1v-2.3M14 20.1v-2.3"/>',
  luna: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/><path d="M16 4v3M14.5 5.5h3"/>',
  guitarra: '<path d="M14.5 9.5 20 4M18 2.5l3.5 3.5"/><path d="M12.2 8.3c-1.6-.7-3.6-.4-4.8.9-.9.9-1 2.2-2.4 2.6-1.6.4-2.8 1.3-3 3-.3 2.5 2.3 5.4 4.9 5.4 1.7 0 2.7-1.3 3-2.9.3-1.4 1.7-1.5 2.6-2.4 1.3-1.2 1.6-3.2.9-4.8"/><circle cx="9.5" cy="14.5" r="1.4"/>',
  maraca: '<ellipse cx="9" cy="8" rx="4.5" ry="5.5" transform="rotate(-35 9 8)"/><path d="M11.8 12.2 17 20.5"/><path d="M15.5 4.5l1.5-1M18 7l1.8-.4M17.5 2l.3-1"/>',
  sol: '<path d="M5 12a7 7 0 0 1 14 0z"/><path d="M3 15h18M5 18h14M8 21h8"/>',
  escudo: '<path d="M12 3l7.5 3v5.5c0 4.7-3.2 8.4-7.5 9.5-4.3-1.1-7.5-4.8-7.5-9.5V6z"/><path d="M12 7v10M8.5 11h7"/>',
  mundo: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 3.6 5.4 3.6 8.5s-1 5.9-3.6 8.5c-2.6-2.6-3.6-5.4-3.6-8.5s1-5.9 3.6-8.5z"/>',
  mia: '<path d="M4 6h10M4 11h10M4 16h6"/><path d="M16 18.5V8l5-1.5v9"/><circle cx="14" cy="18.5" r="2"/><circle cx="19" cy="16" r="2"/>',
  no: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/><path d="M3 3l18 18"/>',
  sig: '<path d="M5 5.5v13L14.5 12z" fill="currentColor"/><path d="M18.5 5.5v13"/>',
  ant: '<path d="M19 5.5v13L9.5 12z" fill="currentColor"/><path d="M5.5 5.5v13"/>',
  borrar: '<path d="M6 6l12 12M18 6 6 18"/>',
};
const musIco = (n, cl) => `<svg class="gli${cl ? ' ' + cl : ''}" viewBox="0 0 24 24" aria-hidden="true">${MUS_ICO[n] || ''}</svg>`;
const MUS_MIA_TOPE = 300 * 1048576;   // (Mi música: hasta 300 MB en el aparato)
const MUS_FUNDIDO = 1000;             // (ms del fundido al empezar una partida)
const MUS = {
  t: 0, iniciado: false, toque: false, nativo: false,
  est: '', clave: '', cancion: null, fu: '',        // la estación cargada, la canción (su clave), de dónde suena: 'yt' o 'ar'
  ifr: null, ytListo: 0, ytEst: -1, ytCargaT: 0, ytCur: 0, ytCurT: 0, ytDur: 0, ytVol: -1, ytPedido: 0, ytPedido0: 0,
  au: null, auUrl: '', auVol: -1,
  fade: 1, fundiendo: null, errSeg: 0, malos: new Set(), esperaHasta: 0, bloqueado: false, sonando: false, guardadoT: 0,
  menuT: 0, armadoT: 0, pos: null, paq: { est: '', n: 0, tot: 0, cache: null, base: '', idx: null, blobs: null, intentoT: 0, intentos: 0 },
  mias: null, chip: null, chipFirma: '', tab: null, cuenta: 0, eventos: [],
};
const musEstDe = (k) => MUS_EST.find((e) => e[0] === k);
const musLista = (k) => { const e = MUS_DATOS && MUS_DATOS.find((x) => x.k === k); return e ? e.c : []; };
// (las canciones de una estación, cada una con su clave: el video de YouTube; en Mi música, el número del archivo)
function musCanciones(k) {
  if (k === 'mia') return (MUS.mias || []).map((m) => ({ clave: 'f' + m.id, mia: m.id, titulo: m.n.replace(/\.[a-z0-9]{2,5}$/i, ''), artista: musTam(m.tam) }));
  return musLista(k).map((c) => ({ clave: c[0], id: c[0], artista: c[1], titulo: c[2], archivo: c[3] || '' }));
}
const musElegida = () => { const e = (typeof PREFS !== 'undefined' && PREFS.musEst) || 'casual'; return e === 'no' || e === 'mia' || musEstDe(e) ? e : 'casual'; };
const musVolumen = () => { const v = typeof PREFS !== 'undefined' ? PREFS.musVol : undefined; return Number.isFinite(+v) && v !== null && v !== '' ? clamp(+v, 0, 100) : 60; };
const musTam = (b) => (b >= 1048576 ? (b / 1048576).toFixed(b >= 10485760 ? 0 : 1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
function musNota(t) { try { console.info('[música] ' + t); } catch (e) {} if (typeof cnAnotar === 'function') cnAnotar('musica', t); MUS.eventos.push(t); if (MUS.eventos.length > 40) MUS.eventos.shift(); }

// ======================= el orden de cada estación (mezclado, sin repetir hasta pasar por todas) =======================
function musPosLeer() { if (!MUS.pos) MUS.pos = leerLS('jx_musica', {}); return MUS.pos; }
function musPosGuardar() { try { localStorage.setItem('jx_musica', JSON.stringify(MUS.pos || {})); } catch (e) {} }
function musMezclar(L, evitar) {
  const a = L.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  // (la primera de la vuelta nueva no es la última de la anterior)
  if (evitar && a.length > 1 && a[0] === evitar) { const j = 1 + Math.floor(Math.random() * (a.length - 1)); [a[0], a[j]] = [a[j], a[0]]; }
  return a;
}
// el orden guardado de la estación (si cambió la lista —una actualización, un archivo nuevo o borrado—, se acomoda: las que
// ya no están se sacan y las nuevas van mezcladas al final de la vuelta)
function musOrden(k) {
  const P = musPosLeer(), claves = musCanciones(k).map((c) => c.clave); let p = P[k];
  if (!p || !Array.isArray(p.o)) p = P[k] = { o: musMezclar(claves), i: 0, t: 0 };
  const hay = new Set(claves), en = new Set(p.o);
  const actual = p.o[p.i];
  p.o = p.o.filter((c) => hay.has(c));
  const nuevas = claves.filter((c) => !en.has(c)); if (nuevas.length) p.o.push(...musMezclar(nuevas));
  const j = actual ? p.o.indexOf(actual) : -1; if (j >= 0) p.i = j; else { p.i = Math.min(p.i | 0, Math.max(0, p.o.length - 1)); p.t = 0; }
  return p;
}
function musActual(k) { const p = musOrden(k), c = p.o[p.i]; return musCanciones(k).find((x) => x.clave === c) || null; }
// pasar a la siguiente (o a la anterior); al terminar la vuelta, otra mezcla
function musMover(k, d) {
  const p = musOrden(k); if (!p.o.length) return;
  p.i += d; p.t = 0;
  if (p.i >= p.o.length) { p.o = musMezclar(p.o, p.o[p.o.length - 1]); p.i = 0; }
  if (p.i < 0) p.i = p.o.length - 1;
  musPosGuardar();
}

// ======================= dónde estamos =======================
// (en el menú, ya se puede tocar —la pantalla de carga se fue—)
const musEnMenu = () => typeof JUEGO !== 'undefined' && JUEGO.estado === 'principal' && typeof INI !== 'undefined' && INI.ok && !(window.__carga && window.__carga.listo === false);
// (otra música de YouTube del juego: el editor de la música de los emotes —también desde el menú—, su reproductor, la radio
// o la tele)
const musOtra = () => (typeof EMU !== 'undefined' && (EMU.ed || EMU.ifr)) || (typeof YT !== 'undefined' && YT.ifr);
const musCallada = () => (typeof FONDO !== 'undefined' && FONDO.oculto) || !!musOtra();
// el volumen de verdad: el general (mientras se mueve en Ajustes, el de la barra) por el de la música
function musVolEfectivo() {
  const aV = document.getElementById('aV'), aj = document.getElementById('ajustes');
  const gen = aV && aj && !aj.classList.contains('oc') ? +aV.value : (typeof PREFS !== 'undefined' ? +PREFS.vol : 80);
  return clamp((Number.isFinite(gen) ? gen : 80) / 100, 0, 1) * musVolumen() / 100 * MUS.fade;
}

// ======================= el reproductor de YouTube (escondido) =======================
function musCaja() {
  let c = document.getElementById('musMini');
  if (!c) { c = document.createElement('div'); c.id = 'musMini'; c.setAttribute('aria-hidden', 'true'); document.body.appendChild(c); }
  return c;
}
function musYTcmd(func, args) { if (!MUS.ifr) return; try { MUS.ifr.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*'); } catch (e) {} }
function musYTcargar(c, t) {
  t = Math.max(0, Math.floor(t || 0));
  // (el «terminó» del video de antes puede llegar dos veces —onStateChange e infoDelivery—: el segundo, ya con el video nuevo
  // pedido, haría saltar otra; por 1,5 s no se le hace caso)
  MUS.ytNo0Hasta = Date.now() + 1500;
  MUS.ytEst = -1; MUS.ytCargaT = Date.now(); MUS.ytCur = t; MUS.ytCurT = Date.now(); MUS.ytDur = 0; MUS.ytVol = -1; MUS.bloqueado = false; MUS.ytPedido = 0; MUS.ytPedido0 = 0;
  if (MUS.ifr && MUS.ytListo) { musYTcmd('loadVideoById', [{ videoId: c.id, startSeconds: t }]); musYTcmd('setVolume', [Math.round(100 * musVolEfectivo())]); return; }
  musYTquitar();
  const f = emuIframe(c.id, t, 0, false); f.tabIndex = -1; f.title = 'YouTube';
  f.onload = () => { if (MUS.ifr !== f) return; try { f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'mus' }), '*'); } catch (x) {} };
  musCaja().appendChild(f); MUS.ifr = f; MUS.ytListo = 0;
}
function musYTquitar() { if (MUS.ifr) { MUS.ifr.remove(); MUS.ifr = null; } MUS.ytListo = 0; MUS.ytEst = -1; MUS.ytVol = -1; }
addEventListener('message', (ev) => {
  if (!MUS.ifr || ev.source !== MUS.ifr.contentWindow || !/youtube/.test(ev.origin)) return;
  let d; try { d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; } catch (x) { return; }
  if (!d || typeof d !== 'object') return;
  if (!MUS.ytListo && (d.event === 'onReady' || d.event === 'initialDelivery' || d.event === 'infoDelivery')) { MUS.ytListo = Date.now(); MUS.ytVol = -1; MUS.esperaHasta = 0; musVolAplicar(true); if (musPuede()) musTocar(); else if (musCallada()) musPausar(); }
  if (d.event === 'onStateChange' && typeof d.info === 'number') musYTestado(d.info);
  if (d.event === 'onAutoplayBlocked') MUS.bloqueado = true;
  if (d.event === 'infoDelivery' && d.info) {
    if (typeof d.info.playerState === 'number') musYTestado(d.info.playerState);
    if (typeof d.info.currentTime === 'number') { MUS.ytCur = d.info.currentTime; MUS.ytCurT = Date.now(); }
    if (typeof d.info.duration === 'number' && d.info.duration > 0) MUS.ytDur = d.info.duration;
  }
  if (d.event === 'onError') musError('YouTube ' + d.info);
});
function musYTestado(e) {
  if (e === MUS.ytEst) return; MUS.ytEst = e;
  if (e === 1) { MUS.sonando = true; MUS.errSeg = 0; MUS.bloqueado = false; musChipPintar(); musTabAhora(); }
  else if (e === 0) { MUS.sonando = false; if (Date.now() >= (MUS.ytNo0Hasta || 0)) musSiguiente(1, true); }
  else if (e === 2) MUS.sonando = false;
}

// ======================= el reproductor de archivos (Casual sin internet y Mi música) =======================
function musAu() {
  if (MUS.au) return MUS.au;
  const a = new Audio(); a.preload = 'auto'; a.setAttribute('playsinline', ''); MUS.au = a;
  a.addEventListener('playing', () => { MUS.sonando = true; MUS.errSeg = 0; MUS.bloqueado = false; musChipPintar(); musTabAhora(); });
  a.addEventListener('pause', () => { MUS.sonando = false; });
  a.addEventListener('ended', () => { MUS.sonando = false; musSiguiente(1, true); });
  a.addEventListener('error', () => { if (a.src && MUS.fu === 'ar') musError('archivo ' + ((a.error && a.error.code) || '?')); });
  return a;
}
function musAuQuitar() {
  const a = MUS.au; if (a) { try { a.pause(); } catch (e) {} a.removeAttribute('src'); try { a.load(); } catch (e) {} }
  if (MUS.auUrl) { URL.revokeObjectURL(MUS.auUrl); MUS.auUrl = ''; } MUS.au = null; MUS.auVol = -1;
}
async function musAuCargar(c, t, blob) {
  const a = musAu(), n = ++MUS.cuenta;
  if (!blob) { musError('sin archivo'); return; }
  if (n !== MUS.cuenta || MUS.cancion !== c.clave) return;
  if (MUS.auUrl) URL.revokeObjectURL(MUS.auUrl);
  MUS.auUrl = URL.createObjectURL(blob); a.src = MUS.auUrl; MUS.auVol = -1;
  if (t > 1) { const salto = () => { a.removeEventListener('loadedmetadata', salto); try { if (t < (a.duration || 0) - 3) a.currentTime = t; } catch (e) {} }; a.addEventListener('loadedmetadata', salto); }
  musVolAplicar(true); musTocar();
}

// ======================= qué suena =======================
// (de dónde sale una canción: Mi música y Casual con el paquete guardado, de un archivo; lo demás, de YouTube)
const musDeArchivo = (c) => !!(c && (c.mia || (c.archivo && MUS.paq.est === 'listo' && MUS.paq.idx && MUS.paq.idx[c.archivo])));
async function musBlob(c) {
  if (c.mia) return musMiaBlob(c.mia);
  return musPaqBlob(c.archivo);
}
// pone la canción actual de la estación elegida (desde el segundo guardado)
function musPoner() {
  const k = musElegida(); if (k === 'no') { musQuitar(); return; }
  const c = musActual(k);
  if (!c) { musQuitar(); MUS.est = k; return; }
  const p = musOrden(k), t = p.t || 0, ar = musDeArchivo(c);
  MUS.est = k; MUS.cancion = c.clave; MUS.sonando = false; MUS.bloqueado = false; MUS.errDe = null;
  if (ar) {
    if (MUS.fu === 'yt') musYTquitar();
    MUS.fu = 'ar'; MUS.cuenta++; const n = MUS.cuenta;
    musBlob(c).then((b) => { if (n === MUS.cuenta && MUS.cancion === c.clave) musAuCargar(c, t, b); }, () => { if (n === MUS.cuenta) musError('sin archivo'); });
  } else {
    if (MUS.fu === 'ar') musAuQuitar();
    // (sin internet, YouTube ni se intenta: silencio hasta que vuelva)
    if (navigator.onLine === false || Date.now() < MUS.esperaHasta) { MUS.fu = ''; musYTquitar(); MUS.cancion = c.clave; musChipPintar(); return; }
    MUS.fu = 'yt'; musYTcargar(c, t);
  }
  musChipPintar(); musTabAhora();
}
function musSiguiente(d, sola) {
  const k = musElegida(); if (k === 'no') return;
  if (MUS.est === k && MUS.cancion) { const p = musOrden(k); if (p.o[p.i] === MUS.cancion) p.t = 0; }
  musMover(k, d);
  if (!sola) MUS.errSeg = 0;
  if (musEnMenu() || MUS.fu) musPoner();
  else { musChipPintar(); musTabAhora(); }
}
// una canción que no se puede poner: se anota y se pasa a la siguiente; muchas seguidas (sin internet, YouTube que no
// contesta), silencio un rato
function musError(por) {
  const k = musElegida(), c = musActual(k);
  if (MUS.errDe && MUS.errDe === MUS.cancion) return; MUS.errDe = MUS.cancion;
  musNota(`no se pudo poner ${c ? c.artista + ' — ' + c.titulo + ' (' + c.clave + ')' : '?'}: ${por}`);
  if (c) MUS.malos.add(c.clave);
  MUS.errSeg++;
  if (MUS.errSeg >= 6) { musNota('muchas seguidas: silencio por 60 s'); MUS.esperaHasta = Date.now() + 60000; MUS.errSeg = 0; musYTquitar(); musAuQuitar(); MUS.fu = ''; MUS.sonando = false; musChipPintar(); return; }
  setTimeout(() => musSiguiente(1, true), 250);
}
// que suene (con el toque ya dado o en la app)
function musTocar() {
  if (!musPuede()) return;
  if (MUS.fu === 'yt' && MUS.ifr) { musYTcmd('playVideo'); MUS.ytPedido = Date.now(); if (!MUS.ytPedido0) MUS.ytPedido0 = MUS.ytPedido; }
  else if (MUS.fu === 'ar' && MUS.au && MUS.au.src && MUS.au.paused) {
    const p = MUS.au.play(); if (p && p.catch) p.catch((e) => { if (e && e.name === 'NotAllowedError') MUS.bloqueado = true; });
  }
}
function musPausar() { if (MUS.fu === 'yt' && MUS.ifr && MUS.ytEst === 1) musYTcmd('pauseVideo'); else if (MUS.fu === 'ar' && MUS.au && !MUS.au.paused) MUS.au.pause(); MUS.sonando = false; }
const musPuede = () => (MUS.toque || MUS.nativo) && musEnMenu() && !musCallada() && musElegida() !== 'no';
function musVolAplicar(forzar) {
  const v = musVolEfectivo();
  if (MUS.fu === 'yt' && MUS.ifr) { const n = Math.round(100 * v); if (forzar || n !== MUS.ytVol) { musYTcmd('setVolume', [n]); MUS.ytVol = n; } }
  if (MUS.fu === 'ar' && MUS.au) { if (forzar || Math.abs(v - MUS.auVol) > 0.004) { try { MUS.au.volume = clamp(v, 0, 1); } catch (e) {} MUS.auVol = v; } }
}
// el segundo en que va (para seguir donde iba)
function musVa() {
  if (MUS.fu === 'ar' && MUS.au) return MUS.au.currentTime || 0;
  if (MUS.fu === 'yt') return MUS.ytCur + (MUS.ytEst === 1 ? (Date.now() - MUS.ytCurT) / 1000 : 0);
  return 0;
}
function musRecordar() {
  const k = MUS.est; if (!k || k === 'no' || !MUS.cancion) return;
  const p = musOrden(k); if (p.o[p.i] === MUS.cancion) { const t = musVa(); if (t > 0) p.t = Math.floor(t); }
  musPosGuardar();
}
// sacar todo (al empezar una partida, con «Sin música»): se recuerda por dónde iba
function musQuitar() {
  musRecordar();
  if (MUS.fundiendo) { clearInterval(MUS.fundiendo); MUS.fundiendo = null; }
  musYTquitar(); musAuQuitar(); MUS.fu = ''; MUS.est = ''; MUS.cancion = null; MUS.sonando = false; MUS.fade = 1;
  musChipPintar();
}
// el fundido de salida (1 s) y después, fuera
function musFundir() {
  if (MUS.fundiendo || !MUS.fu) { if (!MUS.fundiendo) musQuitar(); return; }
  musRecordar();
  const t0 = performance.now(), f0 = MUS.fade;
  MUS.fundiendo = setInterval(() => {
    const k = (performance.now() - t0) / MUS_FUNDIDO;
    MUS.fade = Math.max(0, f0 * (1 - k)); musVolAplicar();
    if (k >= 1) { clearInterval(MUS.fundiendo); MUS.fundiendo = null; MUS.fundidoMs = Math.round(performance.now() - t0); musQuitar(); }
  }, 50);
}

// ======================= el paso (4 por segundo) =======================
function musPaso() {
  const menu = musEnMenu(), k = musElegida();
  if (!menu || k === 'no') { if (MUS.fu || MUS.fundiendo) { if (menu) musQuitar(); else musFundir(); } musChipPintar(); return; }
  if (MUS.fundiendo) { clearInterval(MUS.fundiendo); MUS.fundiendo = null; MUS.fade = 1; }
  // (la placa, desde que el menú se puede tocar; si cambió el idioma —la bienvenida, el globo de abajo—, la placa en el idioma nuevo; si cambió el menú de inicio
  // —Ajustes: clásico o depósito— la placa se va con el menú de antes: se arma en el nuevo)
  const casa = RB.el && RB.el.querySelector(RB.home === 'clasico' ? '.clHome' : '.dpHome');
  if (casa && (!MUS.chip || MUS.chip.parentElement !== casa)) { MUS.chipFirma = ''; musChipPintar(); }
  else if (MUS.chip && MUS.chipLang !== PREFS.lang) musChipPintar();
  // (la primera vez, el reproductor se arma 1,2 s después de que el menú se puede tocar —que la entrada del menú vaya
  // fluida—, o con el primer toque si es antes)
  if (!MUS.menuT) MUS.menuT = performance.now();
  if (!MUS.armadoT && !MUS.toque && performance.now() - MUS.menuT < 1200) return;
  if (!MUS.armadoT) MUS.armadoT = performance.now();
  // (Mi música: la lista de tus archivos se lee del aparato la primera vez que hace falta)
  if (k === 'mia' && !MUS.mias) { if (!MUS.miaLeyendo) { MUS.miaLeyendo = true; musMiaLeer().then(() => { MUS.miaLeyendo = false; }); } return; }
  if (!musCanciones(k).length) { if (MUS.fu) musQuitar(); MUS.est = k; musChipPintar(); return; }
  // (otra estación, o volvió al menú: se pone donde iba; si estaba en silencio por fallas, se reintenta pasado el rato)
  if (MUS.est !== k || (!MUS.fu && Date.now() >= MUS.esperaHasta && navigator.onLine !== false) || (!MUS.fu && musDeArchivo(musActual(k)))) { if (MUS.est !== k && MUS.est) musRecordar(); MUS.fade = 1; musPoner(); }
  if (musCallada()) { musPausar(); return; }
  musVolAplicar();
  if (!(MUS.toque || MUS.nativo)) return;
  const ahora = Date.now();
  if (MUS.fu === 'yt' && MUS.ifr) {
    // (no contesta en 20 s: sin internet o YouTube no carga —silencio un minuto, sin avisos—)
    if (!MUS.ytListo && ahora - MUS.ytCargaT > 20000) { musNota('YouTube no contesta'); MUS.esperaHasta = ahora + 60000; musYTquitar(); MUS.fu = ''; MUS.sonando = false; musChipPintar(); return; }
    // (en pausa —la pausó el navegador, volvió de segundo plano, se cortó—: sigue; cargado y sin arrancar 15 s después del
    // pedido, con el toque ya dado: no se puede, la siguiente)
    if (MUS.ytListo && (MUS.ytEst === 2 || MUS.ytEst === 5 || MUS.ytEst === -1) && ahora - MUS.ytPedido > 1500) musTocar();
    // (cargando —3— cuenta: un celular con poca señal puede tardar; 30 s pedido y sin sonar, la siguiente)
    if (MUS.ytListo && MUS.ytEst !== 1 && !MUS.bloqueado && MUS.ytPedido0 && ahora - Math.max(MUS.ytPedido0, MUS.ytListo) > (MUS.ytEst === 3 ? 30000 : 15000)) { MUS.ytPedido0 = 0; musError('no arranca'); }
  } else if (MUS.fu === 'ar' && MUS.au && MUS.au.src && MUS.au.paused && !MUS.au.ended && !MUS.bloqueado) musTocar();
  // (cada 5 s, por dónde va: si se cierra la página, se sigue de ahí)
  if (ahora - MUS.guardadoT > 5000) { MUS.guardadoT = ahora; musRecordar(); }
  // (dónde va la placa: cada segundo mientras el menú recién aparece —la entrada, las cajas que caen—; después, cada 5 s; al
  // cambiar el tamaño, en el momento)
  if (MUS.chip && ahora - (MUS.chipT || 0) > (ahora - (MUS.chipVisT || 0) < 8000 ? 1000 : 5000)) { MUS.chipT = ahora; musChipEncajar(); }
}
// el primer toque (la web no deja sonar sin uno): suena en el momento, adentro del mismo toque
function musToque() {
  if (MUS.toque) return; MUS.toque = true;
  try { if (musPuede()) { musVolAplicar(true); musTocar(); } } catch (e) {}
}
function musIniciar() {
  if (MUS.iniciado) return; MUS.iniciado = true;
  MUS.nativo = !!(window.JXNativo);
  // (si ya hubo un toque —«Tocá para entrar» de la carga, el código de la web, saltear la intro—, el navegador ya deja sonar)
  try { if (navigator.userActivation && navigator.userActivation.hasBeenActive) MUS.toque = true; } catch (e) {}
  addEventListener('pointerdown', musToque, true); addEventListener('keydown', musToque, true);
  addEventListener('pagehide', () => musRecordar());
  addEventListener('online', () => { MUS.esperaHasta = 0; MUS.errSeg = 0; });
  addEventListener('resize', () => { MUS.chipVisT = Date.now(); setTimeout(() => musChipEncajar(true), 120); });
  // (cuando termina de cargar una letra —la Oswald del menú—, lo que entra cambia)
  try { document.fonts.addEventListener('loadingdone', () => setTimeout(() => musChipEncajar(true), 50)); } catch (e) {}
  setInterval(() => { try { musPaso(); } catch (e) { console.warn('música', e); } }, 250);
  // (al abrirse la pantalla de carga de una partida, el fundido empieza en el momento, sin esperar al paso: la carga
  // después ocupa el procesador y el fundido tiene que estar andando antes)
  try { const cg = document.getElementById('carga'); if (cg) new MutationObserver(() => { if (MUS.fu && !musEnMenu() && !MUS.fundiendo) musFundir(); }).observe(cg, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
  // (el reproductor se arma después de que el menú se puede tocar; el paquete de Casual, cuando el aparato está libre)
  const luego = window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 4000 }) : (f) => setTimeout(f, 1500);
  const esperar = setInterval(() => { if (!musEnMenu()) return; clearInterval(esperar); luego(() => musPaqRevisar()); }, 500);
}
setTimeout(musIniciar, 0);

// ======================= Casual sin internet: el paquete aparte =======================
// El paquete (a_musica.*.rbp: herramientas/musica/casual.py y remotos.py) se baja como los demás de rb/ (rbBajar: al lado
// del juego o de GitHub; en la app de Android, de internet) y cada canción queda en la caché del navegador
// («jx-musica-1»): así suena sin internet y en la memoria está sólo la que suena. Sin caché (http, archivo), las canciones
// quedan en la memoria mientras dura la página.
const musPaqInfo = () => (typeof DATA !== 'undefined' && DATA.rbp && DATA.rbp.a_musica) || null;
async function musPaqCache() { try { if (window.caches && window.isSecureContext) return await caches.open('jx-musica-1'); } catch (e) {} return null; }
async function musPaqRevisar() {
  const P = MUS.paq, info = musPaqInfo(); if (!info || P.est === 'listo' || P.est === 'bajando') return;
  P.tot = info[1]; P.base = new URL('musica/' + info[0] + '/', location.href).href;
  P.cache = await musPaqCache();
  // (ya guardado de antes)
  if (P.cache) { try { const r = await P.cache.match(P.base + 'indice.json'); if (r) { P.idx = await r.json(); P.est = 'listo'; P.n = P.tot; musPaqListo(); return; } } catch (e) {} }
  musPaqBajarSiToca();
}
// (se baja sola si la estación es Casual, hay internet y el aparato no pide ahorrar datos; o si se pide en la pestaña)
function musPaqBajarSiToca(pedido) {
  const P = MUS.paq; if (!musPaqInfo() || P.est === 'listo' || P.est === 'bajando') return;
  if (!pedido && (musElegida() !== 'casual' || navigator.onLine === false || (navigator.connection && navigator.connection.saveData))) return;
  if (!pedido && Date.now() - P.intentoT < Math.min(600000, 30000 * Math.pow(2, P.intentos))) return;
  musPaqBajar();
}
async function musPaqBajar() {
  const P = MUS.paq, info = musPaqInfo(); if (!info || typeof rbBajar !== 'function') return;
  P.est = 'bajando'; P.n = 0; P.intentoT = Date.now(); musTabPaq();
  const t0 = performance.now();
  let u8 = null; try { u8 = await rbBajar(info[0], (n, tot) => { P.n = n; if (tot) P.tot = tot; musTabPaq(); }); } catch (e) { u8 = null; }
  let ok = false;
  try {
    if (u8 && u8.length === info[1] && String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) === 'RBP1') {
      const n = u8[4] | u8[5] << 8 | u8[6] << 16 | u8[7] << 24, idx = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + n))), c = u8.subarray(8 + n), A = idx.a || {};
      const I = {}; P.blobs = P.cache ? null : {};
      for (const k in A) {
        const b = new Blob([c.subarray(A[k][0], A[k][0] + A[k][1])], { type: 'audio/webm' }); I[k] = A[k][1];
        if (P.cache) await P.cache.put(P.base + k, new Response(b, { headers: { 'Content-Type': 'audio/webm' } })); else P.blobs[k] = b;
      }
      if (P.cache) {
        await P.cache.put(P.base + 'indice.json', new Response(JSON.stringify(I), { headers: { 'Content-Type': 'application/json' } }));
        // (el paquete entero ya no hace falta en las otras cachés: cada canción quedó suelta)
        for (const nom of ['rb-paquetes-1', 'jxmod-recursos']) { try { const C = await caches.open(nom); for (const r of await C.keys()) if (r.url.includes('/' + info[0])) await C.delete(r); } catch (e) {} }
        // (que el navegador no la borre si le falta lugar)
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}
      }
      P.idx = I; ok = true;
    }
  } catch (e) { console.warn('música: paquete', e); }
  u8 = null;
  if (!ok) { P.est = 'falla'; P.intentos++; musNota('no se pudo bajar el paquete de Casual'); musTabPaq(); return; }
  P.est = 'listo'; P.n = P.tot; P.ms = Math.round(performance.now() - t0); P.intentos = 0;
  musNota(`paquete de Casual listo: ${(P.tot / 1048576).toFixed(1)} MB en ${(P.ms / 1000).toFixed(1)} s`);
  musPaqListo();
}
function musPaqListo() {
  musTabPaq();
  // (si Casual estaba callada por falta de internet, ya puede sonar; si sonaba por YouTube, sigue hasta que termine esa)
  if (musElegida() === 'casual' && MUS.est === 'casual' && !MUS.fu) MUS.est = '';
}
async function musPaqBlob(k) {
  const P = MUS.paq; if (!k || P.est !== 'listo') return null;
  if (P.blobs) return P.blobs[k] || null;
  if (!P.cache) return null;
  const r = await P.cache.match(P.base + k); if (r) return await r.blob();
  // (el navegador borró algo de lo guardado —le faltó lugar—: Casual vuelve a YouTube y se baja de nuevo cuando se pueda)
  P.est = ''; P.idx = null; try { await P.cache.delete(P.base + 'indice.json'); } catch (e) {}
  musNota('faltaba ' + k + ' en lo guardado: Casual vuelve a YouTube'); musTabPaq();
  return null;
}

// ======================= Mi música: tus archivos, en el aparato =======================
let MUS_DB = null;
function musMiaDB() {
  return MUS_DB || (MUS_DB = new Promise((ok) => {
    try { const r = indexedDB.open('jxmod-musica', 1); r.onupgradeneeded = () => r.result.createObjectStore('c', { keyPath: 'id', autoIncrement: true }); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); }
    catch (e) { ok(null); }
  }));
}
function musMiaTx(modo, f) {
  return musMiaDB().then((db) => new Promise((ok, mal) => {
    if (!db) return mal(new Error('sin IndexedDB'));
    const tx = db.transaction('c', modo), s = tx.objectStore('c'); let res; f(s, (x) => { res = x; });
    tx.oncomplete = () => ok(res); tx.onerror = tx.onabort = () => mal(tx.error || new Error('IndexedDB'));
  }));
}
// la lista (sin los archivos: sólo el nombre, el tamaño y el tipo)
async function musMiaLeer() {
  try {
    MUS.mias = await musMiaTx('readonly', (s, fin) => { const L = []; const r = s.openCursor(); r.onsuccess = () => { const c = r.result; if (!c) { fin(L); return; } const v = c.value; L.push({ id: v.id, n: v.n, tam: v.tam, tipo: v.tipo }); c.continue(); }; });
  } catch (e) { MUS.mias = []; }
  musTabMia(); return MUS.mias;
}
const musMiaTotal = () => (MUS.mias || []).reduce((a, m) => a + (m.tam || 0), 0);
const MUS_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm|weba|mp4)$/i;
async function musMiaAgregar(files) {
  if (!MUS.mias) await musMiaLeer();
  let tot = musMiaTotal(), n = 0, malos = 0, lleno = false;
  for (const f of files) {
    if (!(f && (/^audio\//.test(f.type) || MUS_EXT.test(f.name || '')))) { malos++; continue; }
    if (tot + f.size > MUS_MIA_TOPE) { lleno = true; continue; }
    try {
      const id = await musMiaTx('readwrite', (s, fin) => { const r = s.add({ n: String(f.name || 'audio').slice(0, 120), tam: f.size, tipo: f.type || '', t: Date.now(), b: f }); r.onsuccess = () => fin(r.result); });
      MUS.mias.push({ id, n: String(f.name || 'audio').slice(0, 120), tam: f.size, tipo: f.type || '' }); tot += f.size; n++;
    } catch (e) { lleno = true; musNota('Mi música: no se pudo guardar ' + f.name + ': ' + e); }
  }
  try { if (n && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}
  if (lleno) aviso(T('mus.lleno').replace('{n}', musTam(MUS_MIA_TOPE)), 4);
  else if (malos) aviso(T('mus.noAudio'), 3);
  musTabMia(); musChipPintar();
  // (al agregar, Mi música queda elegida)
  if (n && musElegida() !== 'mia') musElegir('mia');
  else if (n && musElegida() === 'mia' && !MUS.fu) MUS.est = '';
  return n;
}
async function musMiaBorrar(id) {
  try { await musMiaTx('readwrite', (s) => s.delete(id)); } catch (e) {}
  MUS.mias = (MUS.mias || []).filter((m) => m.id !== id);
  if (MUS.cancion === 'f' + id) { MUS.cancion = null; MUS.est = ''; musAuQuitar(); MUS.fu = ''; }
  musTabMia(); musChipPintar();
}
async function musMiaBlob(id) { const v = await musMiaTx('readonly', (s, fin) => { const r = s.get(id); r.onsuccess = () => fin(r.result); }); return v && v.b ? v.b : null; }

// ======================= elegir estación (Ajustes → Música y la placa del menú) =======================
function musElegir(k) {
  if (k !== 'no' && k !== 'mia' && !musEstDe(k)) return;
  if (MUS.est && MUS.est !== k) musRecordar();
  PREFS.musEst = k; guardarPrefs();
  MUS.errSeg = 0; MUS.esperaHasta = 0; MUS.fade = 1;
  if (MUS.fundiendo) { clearInterval(MUS.fundiendo); MUS.fundiendo = null; }
  if (k === 'mia' && !MUS.mias) musMiaLeer().then(() => { if (musElegida() === 'mia') MUS.est = ''; });
  if (k === 'casual') musPaqBajarSiToca();
  // (de una estación a otra, el mismo reproductor: musPoner saca el que no va y a YouTube le pide el video nuevo)
  if (musEnMenu() && k !== 'no') { musPoner(); musTocar(); } else musQuitar();
  musTabPintar(); musChipPintar();
}
function musNombre(k) { return T('mus.e.' + k); }

// ======================= la placa del menú: lo que suena, siguiente y la pestaña =======================
// En el clásico va con las placas de abajo (.clChip: la misma placa negra rasgada), arriba de la versión, del lado de la
// versión; en el depósito, arriba, al lado de tu perfil (o, si no entra, entre la versión y Amigos; si tampoco, abajo a la
// izquierda). Se mide lo que hay en la pantalla (sin tocar clasico.js ni deposito.js) y, si no entra entera, va sólo con los
// íconos. Con «Sin música», no está.
function musChipCrear() {
  const home = typeof RB !== 'undefined' && RB.el && RB.el.querySelector(RB.home === 'clasico' ? '.clHome' : '.dpHome'); if (!home) return null;
  let c = MUS.chip;
  if (c && c.parentElement === home) return c;
  if (c) c.remove();
  c = document.createElement('div'); c.className = 'musChip ' + (RB.home === 'clasico' ? 'musCl' : 'musDp');
  const pl = RB.home === 'clasico' ? 'clChip' : 'musDpPl';
  c.innerHTML = `<button type="button" class="${pl} musChipT" data-musc="abrir"><i class="musChipI"></i><span class="musChipX"><b class="musChipE"></b><span class="musChipC" dir="auto"></span></span></button><button type="button" class="${pl} musChipS" data-musc="sig">${musIco('sig')}</button>`;
  c.addEventListener('click', (e) => { const b = e.target.closest('[data-musc]'); if (!b) return; e.stopPropagation(); MUS.toque = true; if (b.dataset.musc === 'sig') { musSiguiente(1); musTocar(); } else musAbrirTab(); });
  home.appendChild(c); MUS.chip = c; MUS.chipFirma = '';
  // (si algo del menú cambia de lugar —las cajas del depósito que aparecen o caen, la barra de abajo que se rearma—, se vuelve a
  // encajar, 250 ms después del último cambio; lo que cambia adentro de la placa no cuenta)
  if (MUS.chipObs) MUS.chipObs.disconnect();
  try {
    MUS.chipObs = new MutationObserver((L) => { if (L.every((m) => c.contains(m.target))) return; clearTimeout(MUS.chipObsT); MUS.chipObsT = setTimeout(() => { if (MUS.chip === c) musChipEncajar(); }, 250); });
    MUS.chipObs.observe(home, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] });
  } catch (e) {}
  return c;
}
function musChipPintar() {
  if (typeof RB === 'undefined' || !RB.el) return;
  const k = musElegida(), ver = musEnMenu() && k !== 'no';
  if (!ver) { if (MUS.chip) MUS.chip.classList.add('oc'); return; }
  const c = musChipCrear(); if (!c) return;
  if (c.classList.contains('oc') || !c.offsetWidth) MUS.chipVisT = Date.now();
  c.classList.remove('oc');
  const E = musEstDe(k), col = k === 'mia' ? '#ffd166' : E ? E[1] : '#ccc', can = musActual(k);
  const est = k === 'mia' ? T('mus.mia') : musNombre(k);
  const tit = can ? can.titulo + (can.artista && !can.mia ? ' · ' + can.artista : '') : T(k === 'mia' ? 'mus.miaVacia' : 'mus.nada');
  const offline = !MUS.fu && can && !musDeArchivo(can) && (navigator.onLine === false || Date.now() < MUS.esperaHasta);
  const linea = offline ? T('mus.sinRed') : !MUS.sonando && !(MUS.toque || MUS.nativo) ? T('mus.toca') : tit;
  // (lo que dice, de lo más completo a lo más corto: musChipEncajar pone el primero que entra entero, sin cortar nada)
  MUS.chipOps = linea === tit && can && can.artista && !can.mia ? [[est, linea], [est, can.titulo], ['', can.titulo], [est, '']] : [[est, linea], ['', linea], [est, '']];
  const firma = [k, linea, col, PREFS.lang, offline].join('|'); MUS.chipLang = PREFS.lang;
  if (firma === MUS.chipFirma) return; MUS.chipFirma = firma;
  c.style.setProperty('--musC', col);
  c.querySelector('.musChipI').innerHTML = musIco(k === 'mia' ? 'mia' : E ? E[2] : 'nota');
  const t1 = c.querySelector('.musChipT'), t2 = c.querySelector('.musChipS');
  const lbl = `${T('mus.titulo')}: ${est} · ${linea}`; t1.title = lbl; t1.setAttribute('aria-label', lbl);
  t2.title = T('mus.sig'); t2.setAttribute('aria-label', T('mus.sig')); t2.classList.toggle('oc', !can);
  musChipEncajar(true);
}
// dónde va: se miden las cosas del menú y se elige un lugar libre
function musChipEncajar(forzar) {
  const c = MUS.chip; if (!c || c.classList.contains('oc') || !c.isConnected) return;
  const home = c.parentElement, W = home.clientWidth, H = home.clientHeight; if (!W || !H) { c.dataset.f = ''; return; }
  const rtl = RB.el.dir === 'rtl';
  // (en coordenadas del menú, sin la vuelta del celular parado: con offsetLeft/Top, más el corrimiento de su transform —la
  // versión del depósito va centrada con translateX(-50%)—)
  const R = (e) => {
    if (!e || !e.offsetWidth || e.closest('.oc')) return null; let x = 0, y = 0, n = e;
    while (n && n !== home) { x += n.offsetLeft; y += n.offsetTop; const t = getComputedStyle(n).transform; if (t && t !== 'none') { try { const m = new DOMMatrixReadOnly(t); x += m.m41; y += m.m42; } catch (z) {} } n = n.offsetParent; }
    return { x, y, w: e.offsetWidth, h: e.offsetHeight, r: x + e.offsetWidth, b: y + e.offsetHeight };
  };
  const q = (s) => home.querySelector(s);
  // (lo que no se puede pisar: todo lo que se ve y se toca del menú, también las cajas del depósito)
  const OBS = RB.home === 'clasico' ? '.clLogo, .clLista .clIt, .clArriba > *, .clAbajo > *, .clVerG > *:not(.oc)' : '.dpPerfil, .dpVer, .dpDer > *, .dpAyuda:not(.oc), .dpMapa, .dpJugar, .dpCaja, .dpGrupo';
  const obs = [...home.querySelectorAll(OBS)].map(R).filter(Boolean);
  // (también la letra de la placa —el menú la cambia con el tamaño de la pantalla— y si ya cargó la letra del menú)
  const firma = [W, H, rtl, RB.home, PREFS.lang, JSON.stringify(MUS.chipOps || ''), getComputedStyle(c.querySelector('.musChipT')).fontSize, document.fonts ? document.fonts.status : '', ...obs.map((r) => [r.x, r.y, r.w, r.h].map(Math.round).join(','))].join('|');
  if (!forzar && firma === c.dataset.f) return; c.dataset.f = firma;
  c.classList.remove('musCorta');
  const ancho = () => c.offsetWidth;
  // (los lugares posibles: [x inicial, y, ancho libre, alto]; en coordenadas de la página —x desde la izquierda—)
  let L = [];
  if (RB.home === 'clasico') {
    const vg = R(q('.clVerG')), ar = R(q('.clArriba')), li = R(q('.clLista')), ab = R(q('.clAbajo')), h = vg ? vg.h : 40;
    c.style.setProperty('--musH', h + 'px');
    if (vg) {
      // (arriba de la versión, del mismo lado; lo que se toca —44 px— no se pisa con lo que se toca de la versión)
      const ext = Math.max(0, (44 - h) / 2), y = vg.y - h - Math.max(8, ext * 2 + 2), izq = Math.max(li ? li.r : 0, ab && ab.y < y + h ? ab.r : 0) + 16;
      const lado = rtl ? { x0: 8, x1: vg.r } : { x0: izq, x1: vg.r };
      if (rtl) { const der = W - Math.max(li ? W - li.x : 0, 0) - 16; lado.x0 = vg.x; lado.x1 = der; }
      if (!ar || y > ar.b + 8) L.push({ y, lim: [lado.x0, lado.x1], pega: rtl ? 'izq' : 'der', fin: rtl ? vg.x : vg.r });
    }
  } else {
    const pe = R(q('.dpPerfil')), ve = R(q('.dpVer')), de = R(q('.dpDer')), ay = R(q('.dpAyuda')), ma = R(q('.dpMapa')), h = pe ? pe.h : 44;
    c.style.setProperty('--musH', h + 'px');
    if (pe && ve && de) {
      const y = pe.y;
      if (!rtl) { L.push({ y, lim: [pe.r + 8, ve.x - 8], pega: 'izq', fin: pe.r + 8 }); L.push({ y, lim: [ve.r + 8, de.x - 8], pega: 'der', fin: de.x - 8 }); }
      else { L.push({ y, lim: [ve.r + 8, pe.x - 8], pega: 'der', fin: pe.x - 8 }); L.push({ y, lim: [de.r + 8, ve.x - 8], pega: 'izq', fin: de.r + 8 }); }
    }
    if (pe) { const y = (ay ? ay.y : H - 56) - h - 10, x0 = rtl ? (ma ? ma.r + 8 : W / 2) : (pe ? pe.x : 12), x1 = rtl ? (pe ? pe.r : W - 12) : (ma ? ma.x - 8 : W / 2); L.push({ y, lim: [x0, x1], pega: rtl ? 'der' : 'izq', fin: rtl ? x1 : x0 }); }
  }
  // (primero entera; si no entra en ningún lugar sin pisar nada, sólo los íconos; si tampoco, no está)
  const pisa = (x, y, w, h) => obs.some((r) => x - 4 < r.r && r.x < x + w + 4 && y - 4 < r.b && r.y < y + h + 4) || x < 0 || x + w > W || y < 0 || y + h > H;
  const eE = c.querySelector('.musChipE'), eC = c.querySelector('.musChipC'), eX = c.querySelector('.musChipX');
  const poner = (op) => { eE.textContent = op[0]; eC.textContent = op[1]; eE.classList.toggle('oc', !op[0]); eC.classList.toggle('oc', !op[1]); };
  const tope = Math.max(300, 22 * (parseFloat(getComputedStyle(c.querySelector('.musChipT')).fontSize) || 14));
  // (cada texto —del más completo al más corto— en cada lugar; si ninguno entra entero, sólo los dos íconos)
  const probar = (op) => {
    c.classList.toggle('musCorta', !op); if (op) poner(op);
    for (const s of L) {
      const libre = Math.min(s.lim[1] - s.lim[0], tope); if (libre < 88) continue;
      c.style.maxWidth = Math.floor(libre) + 'px';
      if (op && eX.scrollWidth > eX.clientWidth + 0.5) continue;
      const wf = ancho(), h = c.offsetHeight, x = s.pega === 'der' ? s.fin - wf : s.fin;
      if (!pisa(x, s.y, wf, h)) return { s, w: wf };
    }
    return null;
  };
  let p = null; for (const op of (MUS.chipOps || [['', '']]).concat([null])) { p = probar(op); if (p) break; }
  if (!p) { c.style.visibility = 'hidden'; MUS.chipLugar = null; return; }
  c.style.visibility = '';
  const { s, w } = p; c.style.maxWidth = Math.ceil(w) + 'px';
  const wr = ancho(), x = s.pega === 'der' ? s.fin - wr : s.fin;
  c.style.left = Math.round(x) + 'px'; c.style.top = Math.round(s.y) + 'px';
  MUS.chipLugar = { x: Math.round(x), y: Math.round(s.y), w: wr, h: c.offsetHeight, corta: c.classList.contains('musCorta') };
}
function musAbrirTab() {
  if (typeof abrirAjustes !== 'function') return;
  if (document.getElementById('ajustes').classList.contains('oc')) abrirAjustes('principal');
  const b = document.querySelector('#ajustesCaja .ajTabs [data-aj=mu]'); if (!b) return;
  b.click();
  // (la columna de pestañas puede no entrar entera —un celular apaisado—: se corre hasta que la de Música se vea toda)
  musTabVer(b);
}
function musTabVer(b) {
  try { b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { try { b.scrollIntoView(false); } catch (x) {} }
}

// ======================= Ajustes → Música =======================
// (la pestaña se agrega desde acá —abrirAjustes, ui.js, llama a musAjustes—: un botón más en .ajTabs y su sección en
// .ajSecs, con las clases de Ajustes, así toma el estilo de los demás)
function musAjustes(c) {
  const tabs = c.querySelector('.ajTabs'), secs = c.querySelector('.ajSecs'); if (!tabs || !secs) return;
  tabs.insertAdjacentHTML('beforeend', `<button data-aj="mu">${glifo('musica')}<span>${esc(T('mus.titulo'))}</span></button>`);
  const tarj = (k, nom, ej, col, ico) => `<button type="button" class="musTarj" role="radio" data-mus="${k}" style="--musC:${col}"><i class="musTarjI">${musIco(ico)}</i><span class="musTarjX"><b dir="auto">${esc(nom)}</b>${ej ? `<small dir="auto">${esc(ej)}</small>` : ''}</span></button>`;
  secs.insertAdjacentHTML('beforeend', `<section data-ajs="mu" class="oc musSec"><h4>${esc(T('mus.titulo'))}</h4>
    <div class="musAhora" aria-live="polite"><i class="musAhoraI"></i><span class="musAhoraX"><small class="musAhoraE"></small><b class="musAhoraT" dir="auto"></b><span class="musAhoraA" dir="auto"></span></span>
      <button type="button" class="musBot" data-musb="ant" aria-label="${esc(T('mus.ant'))}" title="${esc(T('mus.ant'))}">${musIco('ant')}</button><button type="button" class="musBot" data-musb="sig" aria-label="${esc(T('mus.sig'))}" title="${esc(T('mus.sig'))}">${musIco('sig')}</button></div>
    <div class="ajF musVolF"><span>${esc(T('mus.vol'))}</span><span class="ajR"><input type="range" id="aMusV" min="0" max="100" step="5" aria-label="${esc(T('mus.vol'))}"><b id="aMusVv"></b></span></div>
    <div class="musGrilla" role="radiogroup" aria-label="${esc(T('mus.titulo'))}">${MUS_EST.map(([k, col, ico, ej]) => tarj(k, musNombre(k), ej, col, ico)).join('')}${tarj('mia', T('mus.mia'), T('mus.miaEj'), '#ffd166', 'mia')}${tarj('no', T('mus.no'), '', '#9a9890', 'no')}</div>
    <div class="musMia oc"><div class="musMiaCab"><label class="ajBtn gris musMiaAgr">${glifo('subir')} <span>${esc(T('mus.agregar'))}</span><input type="file" accept="audio/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac,.webm" multiple hidden></label><span class="musMiaUso"></span></div><ul class="musMiaL"></ul><p class="musNota">${esc(T('mus.miaNota'))}</p></div>
    <p class="musPaq"></p>
    <p class="musNota musCred">${esc(T('mus.cred'))}</p></section>`);
  const S = secs.querySelector('[data-ajs=mu]'); MUS.tab = S;
  const bt = tabs.querySelector('[data-aj=mu]'); bt.addEventListener('focus', () => musTabVer(bt));
  S.addEventListener('click', (e) => {
    const t = e.target.closest('[data-mus],[data-musb],[data-musx],[data-musp]'); if (!t) return;
    MUS.toque = true;
    if (t.dataset.mus) { musElegir(t.dataset.mus); }
    else if (t.dataset.musb) { musSiguiente(t.dataset.musb === 'ant' ? -1 : 1); musTocar(); }
    else if (t.dataset.musx) musMiaBorrar(+t.dataset.musx);
    else if (t.dataset.musp) musPaqBajarSiToca(true);
  });
  const inp = S.querySelector('.musMiaAgr input');
  inp.addEventListener('change', () => { const F = [...(inp.files || [])]; inp.value = ''; if (F.length) musMiaAgregar(F); });
  const V = S.querySelector('#aMusV'); V.value = musVolumen();
  const vAct = () => { S.querySelector('#aMusVv').textContent = V.value + '%'; };
  V.oninput = () => { PREFS.musVol = +V.value; vAct(); musVolAplicar(true); };
  V.onchange = () => { PREFS.musVol = +V.value; guardarPrefs(); };
  vAct();
  // (el volumen general: también se oye al moverlo, sin esperar a «Listo»)
  const aV = c.querySelector('#aV'); if (aV) aV.addEventListener('input', () => musVolAplicar(true));
  if (musElegida() === 'mia' || !MUS.mias) musMiaLeer();
  musTabPintar();
  // (mientras la pestaña está a la vista, lo que suena y la bajada del paquete se van actualizando)
  clearInterval(MUS.tabReloj); MUS.tabReloj = setInterval(() => { if (!S.isConnected) { clearInterval(MUS.tabReloj); MUS.tab = null; return; } if (!S.classList.contains('oc')) { musTabAhora(); musTabPaq(); } }, 700);
}
function musTabPintar() {
  const S = MUS.tab; if (!S || !S.isConnected) return;
  const k = musElegida();
  for (const b of S.querySelectorAll('.musTarj')) { const si = b.dataset.mus === k; b.classList.toggle('sel', si); b.setAttribute('aria-checked', si ? 'true' : 'false'); }
  S.querySelector('.musMia').classList.toggle('oc', k !== 'mia');
  musTabAhora(); musTabPaq(); musTabMia();
}
function musTabAhora() {
  const S = MUS.tab; if (!S || !S.isConnected) return;
  const k = musElegida(), c = k === 'no' ? null : musActual(k), E = musEstDe(k);
  const col = k === 'mia' ? '#ffd166' : E ? E[1] : '#9a9890';
  const est = k === 'no' ? T('mus.no') : k === 'mia' ? T('mus.mia') : musNombre(k);
  const fuente = MUS.fu === 'ar' ? (c && c.mia ? T('mus.deAparato') : T('mus.deArchivo')) : MUS.fu === 'yt' ? 'YouTube' : '';
  const estado = k === 'no' ? '' : !musEnMenu() ? '' : MUS.sonando ? T('mus.sonando') : (!MUS.fu && c && !musDeArchivo(c) && (navigator.onLine === false || Date.now() < MUS.esperaHasta)) ? T('mus.sinRed') : !(MUS.toque || MUS.nativo) ? T('mus.toca') : musCallada() ? T('mus.pausa') : T('cargando');
  const A = S.querySelector('.musAhora'); A.style.setProperty('--musC', col);
  const f = [est, estado, fuente].filter(Boolean).join(' · ');
  if (A.dataset.f === f + (c ? c.clave : '')) return; A.dataset.f = f + (c ? c.clave : '');
  S.querySelector('.musAhoraI').innerHTML = musIco(k === 'mia' ? 'mia' : k === 'no' ? 'no' : E ? E[2] : 'nota');
  S.querySelector('.musAhoraE').textContent = f;
  S.querySelector('.musAhoraT').textContent = c ? c.titulo : k === 'no' ? '—' : T(k === 'mia' ? 'mus.miaVacia' : 'mus.nada');
  S.querySelector('.musAhoraA').textContent = c && !c.mia ? c.artista : '';
  for (const b of S.querySelectorAll('.musBot')) b.disabled = !c;
}
function musTabPaq() {
  const S = MUS.tab; if (!S || !S.isConnected) return;
  const p = S.querySelector('.musPaq'), P = MUS.paq, info = musPaqInfo();
  if (!info) { p.classList.add('oc'); return; }
  p.classList.remove('oc');
  const mb = (n) => (n / 1048576).toFixed(1);
  const tx = P.est === 'listo' ? T('mus.paqListo').replace('{mb}', mb(info[1]))
    : P.est === 'bajando' ? T('mus.paqBaja').replace('{p}', Math.floor(100 * P.n / Math.max(1, P.tot || info[1]))).replace('{n}', mb(P.n)).replace('{mb}', mb(P.tot || info[1]))
    : T('mus.paqNo').replace('{mb}', mb(info[1]));
  const f = P.est + tx; if (p.dataset.f === f) return; p.dataset.f = f;
  p.innerHTML = `${musIco('nota')}<span>${esc(tx)}</span>` + (P.est === 'bajando' ? `<i class="musBarra"><i style="width:${(100 * P.n / Math.max(1, P.tot || info[1])).toFixed(1)}%"></i></i>` : P.est !== 'listo' ? `<button type="button" class="ajBtn gris" data-musp="1">${esc(T('mus.paqBajar'))}</button>` : '');
}
function musTabMia() {
  const S = MUS.tab; if (!S || !S.isConnected) return;
  const L = S.querySelector('.musMiaL'), M = MUS.mias || [];
  S.querySelector('.musMiaUso').textContent = T('mus.miaUso').replace('{n}', M.length).replace('{u}', musTam(musMiaTotal())).replace('{t}', musTam(MUS_MIA_TOPE));
  L.innerHTML = M.length ? M.map((m) => `<li class="${MUS.cancion === 'f' + m.id ? 'sel' : ''}"><span dir="auto">${esc(m.n)}</span><small>${esc(musTam(m.tam))}</small><button type="button" class="musBot" data-musx="${m.id}" aria-label="${esc(T('mus.borrar') + ': ' + m.n)}" title="${esc(T('mus.borrar'))}">${musIco('borrar')}</button></li>`).join('')
    : `<li class="musVacia">${esc(T('mus.miaVacia'))}</li>`;
}

// ======================= el estilo (con las variables del menú: si cambia el estilo de Ajustes, sigue) =======================
(() => {
  const st = document.createElement('style'); st.id = 'musEstilo';
  st.textContent = `
#musMini{position:fixed;right:0;bottom:0;width:200px;height:113px;opacity:0;pointer-events:none;z-index:-1;overflow:hidden}#musMini iframe{width:200px;height:113px;border:0;display:block}
#rbInicio .musChip{position:absolute;z-index:3;display:flex;align-items:center;gap:6px;max-width:560px;box-sizing:border-box}
#rbInicio .musChip.oc{display:none}
#rbInicio .musChip .musChipT{flex:1 1 auto;min-width:0;justify-content:flex-start;text-transform:none;letter-spacing:0}
#rbInicio .musChip .musChipS{flex:none;padding:0;width:max(44px,var(--musH,40px))}
#rbInicio .musChip .musChipI{display:flex;flex:none;color:var(--musC)}#rbInicio .musChip .musChipI .gli{width:1.25em;height:1.25em}
#rbInicio .musChip .musChipX{display:flex;align-items:baseline;gap:.45em;min-width:0;overflow:hidden;white-space:nowrap}
#rbInicio .musChip .musChipE{flex:none;white-space:nowrap;color:var(--musC);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
#rbInicio .musChip .musChipC{white-space:nowrap}
#rbInicio .musChip .musChipS .gli{width:1.15em;height:1.15em}
#rbInicio .musChip .musChipE.oc,#rbInicio .musChip .musChipC.oc{display:none}
#rbInicio .musChip.musCorta .musChipX{display:none}#rbInicio .musChip.musCorta .musChipT{flex:none;padding:0;width:max(44px,var(--musH,40px));justify-content:center}
#rbInicio .musCl .clChip{font-size:max(14px,var(--clChF,14px))}
#rbInicio .musCl .clChip::before{top:calc((var(--musH,40px) - 44px)/2);bottom:calc((var(--musH,40px) - 44px)/2)}
#rbInicio .musDp .musDpPl{position:relative;display:flex;align-items:center;gap:calc(8px*var(--u,1));height:var(--musH,44px);min-width:44px;padding:0 calc(12px*var(--u,1));box-sizing:border-box;border:0;border-radius:calc(12px*var(--u,1));
  background:rgba(17,21,27,.94);color:#fff;font:600 max(14px,calc(14px*var(--u,1)))/1.1 Roboto,Arial,sans-serif;cursor:pointer;white-space:nowrap}
#rbInicio .musDp .musDpPl:hover{background:rgba(32,38,48,.96)}#rbInicio .musDp .musDpPl:active{transform:translateY(1px)}
#rbInicio .musDp .musDpPl:focus-visible{box-shadow:0 0 0 2px #fff,0 0 0 5px var(--azul,#3b82f6);outline:0}
#rbInicio .musDp .musChipE{font-weight:800}
#ajustesCaja .musSec .ajR b{font-size:14px;min-width:52px}
#ajustesCaja .musSec .musAhora{display:flex;align-items:center;gap:10px;margin:0 0 10px;padding:8px 8px 8px 10px;background:#0b0c0d;border-inline-start:4px solid var(--musC,#f2b31b)}
#ajustesCaja .musAhoraI{display:flex;flex:none;width:40px;height:40px;align-items:center;justify-content:center;color:var(--musC,#f2b31b)}#ajustesCaja .musAhoraI .gli{width:28px;height:28px}
#ajustesCaja .musAhoraX{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
#ajustesCaja .musAhoraE{font-size:14px;color:var(--jxT2,#aeaca6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ajustesCaja .musAhoraT{font-size:16px;color:var(--jxT,#efede7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ajustesCaja .musAhoraA{font-size:14px;color:var(--jxT2,#aeaca6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ajustesCaja .musBot{flex:none;width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:var(--jxPl2,#26272b);border:1px solid var(--jxLin,rgba(239,237,231,.12));color:var(--jxT,#efede7);cursor:pointer;padding:0}
#ajustesCaja .musBot:hover{background:var(--jxPl3,#313237)}#ajustesCaja .musBot:disabled{opacity:.4;cursor:default}#ajustesCaja .musBot .gli{width:20px;height:20px}
#ajustesCaja .musBot:focus-visible,#ajustesCaja .musTarj:focus-visible{outline:2px solid var(--jxA,#f2b31b);outline-offset:2px}
#ajustesCaja .musVolF{font-size:14px;margin-bottom:8px}
#ajustesCaja .musGrilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:6px}
#ajustesCaja .musTarj{position:relative;display:flex;align-items:center;gap:10px;min-height:60px;padding:8px 10px;box-sizing:border-box;background:#0b0c0d;border:1px solid var(--jxLin,rgba(239,237,231,.12));color:var(--jxT,#efede7);text-align:start;cursor:pointer;font:inherit}
#ajustesCaja .musTarj:hover{background:var(--jxPl2,#26272b)}
#ajustesCaja .musTarj.sel{border-color:var(--musC);box-shadow:inset 0 0 0 1px var(--musC);background:var(--jxPl2,#26272b)}
#ajustesCaja .musTarj.sel::after{content:'';position:absolute;top:6px;inset-inline-end:6px;width:10px;height:10px;border-radius:50%;background:var(--musC)}
#ajustesCaja .musTarjI{display:flex;flex:none;width:36px;height:36px;align-items:center;justify-content:center;border-radius:50%;background:color-mix(in srgb,var(--musC) 18%,transparent);color:var(--musC)}
#ajustesCaja .musTarjI .gli{width:22px;height:22px}
#ajustesCaja .musTarjX{display:flex;flex-direction:column;gap:2px;min-width:0}
#ajustesCaja .musTarjX b{font:600 16px/1.15 var(--jxF,Roboto,Arial,sans-serif);letter-spacing:.02em}
#ajustesCaja .musTarjX small{font-size:14px;line-height:1.2;color:var(--jxT2,#aeaca6);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
#ajustesCaja .musMia{margin-top:10px}#ajustesCaja .musMia.oc{display:none}
#ajustesCaja .musMiaCab{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
#ajustesCaja .musMiaAgr{display:inline-flex;align-items:center;gap:.45em;min-height:44px;margin:0;cursor:pointer}
#ajustesCaja .musMiaUso{font-size:14px;color:var(--jxT2,#aeaca6)}
#ajustesCaja .musMiaL{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:4px}
#ajustesCaja .musMiaL li{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 0 0 10px;background:#0b0c0d;font-size:14px}
#ajustesCaja .musMiaL li.sel{box-shadow:inset 3px 0 0 #ffd166}
#ajustesCaja .musMiaL li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#ajustesCaja .musMiaL li small{color:var(--jxT2,#aeaca6);font-size:14px}
#ajustesCaja .musMiaL li.musVacia{padding:10px;color:var(--jxT2,#aeaca6)}
#ajustesCaja .musPaq{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:10px 0 0;font-size:14px;color:var(--jxT2,#aeaca6)}#ajustesCaja .musPaq.oc{display:none}
#ajustesCaja .musPaq .gli{width:18px;height:18px;color:#f2c14e}#ajustesCaja .musPaq .ajBtn{margin:0;min-height:44px}
#ajustesCaja .musBarra{display:block;flex-basis:100%;height:6px;background:#0b0c0d}#ajustesCaja .musBarra i{display:block;height:100%;background:#f2c14e}
#ajustesCaja .musNota{margin:10px 0 0;font-size:14px;line-height:1.35;color:var(--jxT2,#aeaca6)}
`;
  document.head.appendChild(st);
})();

// ======================= los textos (14 idiomas: es, en, pt, id, ms, fil, ja, th, tr, ar, ru, uk, fr, de) =======================
Object.assign(IDI3, {
  'mus.titulo': ['Música', 'Music', 'Música', 'Musik', 'Muzik', 'Musika', '音楽', 'เพลง', 'Müzik', 'الموسيقى', 'Музыка', 'Музика', 'Musique', 'Musik'],
  'mus.e.casual': ['Casual', 'Casual', 'Casual', 'Santai', 'Santai', 'Casual', 'カジュアル', 'สบาย ๆ', 'Gündelik', 'هادئة', 'Казуал', 'Казуал', 'Détente', 'Casual'],
  'mus.e.westside': ['West Side', 'West Side', 'West Side', 'West Side', 'West Side', 'West Side', 'ウエストサイド', 'เวสต์ไซด์', 'West Side', 'ويست سايد', 'Уэст-Сайд', 'Вест-Сайд', 'West Side', 'West Side'],
  'mus.e.ncs': ['Electrónica NCS', 'NCS Electronic', 'Eletrônica NCS', 'Elektronik NCS', 'Elektronik NCS', 'NCS Electronic', 'NCS エレクトロ', 'อิเล็กทรอนิกส์ NCS', 'NCS Elektronik', 'إلكترونية NCS', 'Электроника NCS', 'Електроніка NCS', 'Électro NCS', 'NCS Elektro'],
  'mus.e.phonk': ['Phonk', 'Phonk', 'Phonk', 'Phonk', 'Phonk', 'Phonk', 'フォンク', 'ฟองก์', 'Phonk', 'فونك', 'Фонк', 'Фонк', 'Phonk', 'Phonk'],
  'mus.e.lofi': ['Lo-fi / Chill', 'Lo-fi / Chill', 'Lo-fi / Chill', 'Lo-fi / Chill', 'Lo-fi / Chill', 'Lo-fi / Chill', 'ローファイ', 'โลไฟ / ชิล', 'Lo-fi / Chill', 'لو-فاي', 'Лоу-фай', 'Лоу-фай', 'Lo-fi / Chill', 'Lo-fi / Chill'],
  'mus.e.rock': ['Rock', 'Rock', 'Rock', 'Rock', 'Rock', 'Rock', 'ロック', 'ร็อก', 'Rock', 'روك', 'Рок', 'Рок', 'Rock', 'Rock'],
  'mus.e.latino': ['Latino', 'Latin', 'Latino', 'Latin', 'Latin', 'Latin', 'ラテン', 'ลาติน', 'Latin', 'لاتيني', 'Латино', 'Латино', 'Latino', 'Latin'],
  'mus.e.synthwave': ['Synthwave / Retro', 'Synthwave / Retro', 'Synthwave / Retrô', 'Synthwave / Retro', 'Synthwave / Retro', 'Synthwave / Retro', 'シンセウェイブ', 'ซินธ์เวฟ / เรโทร', 'Synthwave / Retro', 'سينث ويف', 'Синтвейв', 'Синтвейв', 'Synthwave / Rétro', 'Synthwave / Retro'],
  'mus.e.epica': ['Épica', 'Epic', 'Épica', 'Epik', 'Epik', 'Epic', 'エピック', 'มหากาพย์', 'Epik', 'ملحمية', 'Эпическая', 'Епічна', 'Épique', 'Episch'],
  'mus.e.internet': ['Clásicos de internet', 'Internet classics', 'Clássicos da internet', 'Klasik internet', 'Klasik internet', 'Internet classics', 'ネットの定番', 'เพลงฮิตในเน็ต', 'İnternet klasikleri', 'كلاسيكيات الإنترنت', 'Хиты интернета', 'Хіти інтернету', 'Classiques du web', 'Internet-Klassiker'],
  'mus.mia': ['Mi música', 'My music', 'Minha música', 'Musikku', 'Muzik saya', 'Aking musika', 'マイミュージック', 'เพลงของฉัน', 'Müziğim', 'موسيقاي', 'Моя музыка', 'Моя музика', 'Ma musique', 'Meine Musik'],
  'mus.miaEj': ['Tus archivos', 'Your files', 'Seus arquivos', 'Berkasmu', 'Fail anda', 'Iyong mga file', '自分のファイル', 'ไฟล์ของคุณ', 'Dosyaların', 'ملفاتك', 'Твои файлы', 'Твої файли', 'Tes fichiers', 'Deine Dateien'],
  'mus.no': ['Sin música', 'No music', 'Sem música', 'Tanpa musik', 'Tiada muzik', 'Walang musika', '音楽なし', 'ไม่มีเพลง', 'Müzik yok', 'بدون موسيقى', 'Без музыки', 'Без музики', 'Sans musique', 'Keine Musik'],
  'mus.vol': ['Volumen de la música', 'Music volume', 'Volume da música', 'Volume musik', 'Kelantangan muzik', 'Lakas ng musika', '音楽の音量', 'ระดับเสียงเพลง', 'Müzik sesi', 'مستوى صوت الموسيقى', 'Громкость музыки', 'Гучність музики', 'Volume de la musique', 'Musiklautstärke'],
  'mus.sig': ['Siguiente', 'Next', 'Próxima', 'Berikutnya', 'Seterusnya', 'Susunod', '次へ', 'ถัดไป', 'Sonraki', 'التالي', 'Следующая', 'Наступна', 'Suivante', 'Weiter'],
  'mus.ant': ['Anterior', 'Previous', 'Anterior', 'Sebelumnya', 'Sebelumnya', 'Nakaraan', '前へ', 'ก่อนหน้า', 'Önceki', 'السابق', 'Предыдущая', 'Попередня', 'Précédente', 'Zurück'],
  'mus.sonando': ['Sonando', 'Playing', 'Tocando', 'Diputar', 'Dimainkan', 'Tumutugtog', '再生中', 'กำลังเล่น', 'Çalıyor', 'قيد التشغيل', 'Играет', 'Грає', 'En lecture', 'Läuft'],
  'mus.pausa': ['En pausa', 'Paused', 'Pausada', 'Dijeda', 'Dijeda', 'Naka-pause', '一時停止中', 'หยุดชั่วคราว', 'Duraklatıldı', 'متوقفة مؤقتًا', 'Пауза', 'Пауза', 'En pause', 'Pausiert'],
  'mus.toca': ['Tocá la pantalla para escuchar', 'Tap the screen to listen', 'Toque na tela para ouvir', 'Ketuk layar untuk mendengar', 'Ketik skrin untuk mendengar', 'I-tap ang screen para makinig', '画面をタップして再生', 'แตะหน้าจอเพื่อฟัง', 'Dinlemek için ekrana dokun', 'المس الشاشة للاستماع', 'Коснись экрана, чтобы слушать', 'Торкнися екрана, щоб слухати', "Touche l'écran pour écouter", 'Tippe auf den Bildschirm zum Hören'],
  'mus.sinRed': ['Sin conexión', 'Offline', 'Sem conexão', 'Tidak ada koneksi', 'Tiada sambungan', 'Walang koneksyon', 'オフライン', 'ไม่มีการเชื่อมต่อ', 'Bağlantı yok', 'غير متصل', 'Нет сети', 'Немає мережі', 'Hors ligne', 'Offline'],
  'mus.nada': ['Nada para escuchar', 'Nothing to play', 'Nada para ouvir', 'Tidak ada yang diputar', 'Tiada apa untuk dimainkan', 'Walang mapapatugtog', '再生できる曲がありません', 'ไม่มีเพลงให้เล่น', 'Çalacak bir şey yok', 'لا يوجد ما يُشغَّل', 'Нечего играть', 'Нічого грати', 'Rien à écouter', 'Nichts abzuspielen'],
  'mus.deArchivo': ['guardada en el aparato', 'saved on this device', 'salva no aparelho', 'tersimpan di perangkat', 'disimpan dalam peranti', 'naka-save sa device', '端末に保存済み', 'บันทึกในเครื่อง', 'cihazda kayıtlı', 'محفوظة على الجهاز', 'сохранена на устройстве', 'збережена на пристрої', "enregistrée sur l'appareil", 'auf dem Gerät gespeichert'],
  'mus.deAparato': ['tu archivo', 'your file', 'seu arquivo', 'berkasmu', 'fail anda', 'iyong file', 'あなたのファイル', 'ไฟล์ของคุณ', 'senin dosyan', 'ملفك', 'твой файл', 'твій файл', 'ton fichier', 'deine Datei'],
  'mus.agregar': ['Agregar música', 'Add music', 'Adicionar música', 'Tambah musik', 'Tambah muzik', 'Magdagdag ng musika', '音楽を追加', 'เพิ่มเพลง', 'Müzik ekle', 'إضافة موسيقى', 'Добавить музыку', 'Додати музику', 'Ajouter de la musique', 'Musik hinzufügen'],
  'mus.borrar': ['Sacar', 'Remove', 'Remover', 'Hapus', 'Buang', 'Alisin', '削除', 'ลบ', 'Kaldır', 'إزالة', 'Убрать', 'Прибрати', 'Retirer', 'Entfernen'],
  'mus.miaUso': ['{n} archivos · {u} de {t}', '{n} files · {u} of {t}', '{n} arquivos · {u} de {t}', '{n} berkas · {u} dari {t}', '{n} fail · {u} daripada {t}', '{n} file · {u} sa {t}', '{n} ファイル · {u} / {t}', '{n} ไฟล์ · {u} จาก {t}', '{n} dosya · {u} / {t}', '{n} ملفات · {u} من {t}', 'Файлов: {n} · {u} из {t}', 'Файлів: {n} · {u} з {t}', '{n} fichiers · {u} sur {t}', '{n} Dateien · {u} von {t}'],
  'mus.miaVacia': ['Todavía no agregaste música', "You haven't added music yet", 'Você ainda não adicionou música', 'Kamu belum menambah musik', 'Anda belum menambah muzik', 'Wala ka pang naidagdag na musika', 'まだ音楽を追加していません', 'คุณยังไม่ได้เพิ่มเพลง', 'Henüz müzik eklemedin', 'لم تُضف موسيقى بعد', 'Ты ещё не добавил музыку', 'Ти ще не додав музику', "Tu n'as pas encore ajouté de musique", 'Du hast noch keine Musik hinzugefügt'],
  'mus.miaNota': ['Quedan guardados sólo en este aparato y suenan sin internet. No se suben a ningún lado ni los escuchan los demás.', 'They stay only on this device and play offline. They are never uploaded or heard by other players.', 'Ficam salvos só neste aparelho e tocam sem internet. Não são enviados nem ouvidos por outros.', 'Hanya tersimpan di perangkat ini dan bisa diputar tanpa internet. Tidak diunggah dan tidak didengar pemain lain.', 'Disimpan hanya dalam peranti ini dan dimainkan tanpa internet. Tidak dimuat naik atau didengar pemain lain.', 'Sa device na ito lang naka-save at tumutugtog kahit walang internet. Hindi ina-upload o naririnig ng iba.', 'この端末にだけ保存され、オフラインで再生されます。アップロードされず、他のプレイヤーにも聞こえません。', 'เก็บไว้ในเครื่องนี้เท่านั้นและเล่นได้แบบออฟไลน์ ไม่ถูกอัปโหลดและผู้เล่นอื่นไม่ได้ยิน', 'Yalnızca bu cihazda kalır ve internetsiz çalar. Hiçbir yere yüklenmez, diğer oyuncular duymaz.', 'تبقى على هذا الجهاز فقط وتعمل دون إنترنت. لا تُرفع إلى أي مكان ولا يسمعها الآخرون.', 'Хранятся только на этом устройстве и играют без интернета. Никуда не загружаются, другие их не слышат.', 'Зберігаються лише на цьому пристрої й грають без інтернету. Нікуди не завантажуються, інші їх не чують.', "Ils restent seulement sur cet appareil et jouent hors ligne. Ils ne sont jamais envoyés ni entendus par les autres.", 'Sie bleiben nur auf diesem Gerät und laufen offline. Sie werden nie hochgeladen und andere hören sie nicht.'],
  'mus.lleno': ['No entra: Mi música puede ocupar hasta {n}', "It doesn't fit: My music can use up to {n}", 'Não cabe: Minha música pode ocupar até {n}', 'Tidak muat: Musikku maksimal {n}', 'Tidak muat: Muzik saya maksimum {n}', 'Hindi kasya: hanggang {n} lang ang Aking musika', '容量オーバー:マイミュージックは最大 {n}', 'ไม่พอ: เพลงของฉันใช้ได้ถึง {n}', 'Sığmıyor: Müziğim en fazla {n} olabilir', 'لا مساحة: موسيقاي حتى {n} فقط', 'Не помещается: «Моя музыка» — до {n}', 'Не вміщається: «Моя музика» — до {n}', "Pas assez de place : Ma musique peut aller jusqu'à {n}", 'Passt nicht: Meine Musik darf bis zu {n} belegen'],
  'mus.noAudio': ['Eso no es un archivo de música', "That isn't a music file", 'Isso não é um arquivo de música', 'Itu bukan berkas musik', 'Itu bukan fail muzik', 'Hindi iyan file ng musika', '音楽ファイルではありません', 'นั่นไม่ใช่ไฟล์เพลง', 'Bu bir müzik dosyası değil', 'هذا ليس ملف موسيقى', 'Это не музыкальный файл', 'Це не музичний файл', "Ce n'est pas un fichier de musique", 'Das ist keine Musikdatei'],
  'mus.paqListo': ['Casual sin internet: guardada en el aparato ({mb} MB)', 'Casual offline: saved on this device ({mb} MB)', 'Casual sem internet: salva no aparelho ({mb} MB)', 'Casual tanpa internet: tersimpan di perangkat ({mb} MB)', 'Casual tanpa internet: disimpan dalam peranti ({mb} MB)', 'Casual offline: naka-save sa device ({mb} MB)', 'カジュアルをオフラインで:端末に保存済み({mb} MB)', 'Casual แบบออฟไลน์: บันทึกในเครื่องแล้ว ({mb} MB)', 'İnternetsiz Gündelik: cihazda kayıtlı ({mb} MB)', 'هادئة دون إنترنت: محفوظة على الجهاز ({mb} م.ب)', 'Казуал без интернета: сохранено ({mb} МБ)', 'Казуал без інтернету: збережено ({mb} МБ)', 'Détente hors ligne : enregistrée ({mb} Mo)', 'Casual offline: auf dem Gerät gespeichert ({mb} MB)'],
  'mus.paqBaja': ['Guardando Casual para escucharla sin internet: {p} % ({n} de {mb} MB)', 'Saving Casual to play offline: {p}% ({n} of {mb} MB)', 'Salvando Casual para ouvir sem internet: {p}% ({n} de {mb} MB)', 'Menyimpan Casual untuk didengar tanpa internet: {p}% ({n} dari {mb} MB)', 'Menyimpan Casual untuk didengar tanpa internet: {p}% ({n} daripada {mb} MB)', 'Sine-save ang Casual para sa offline: {p}% ({n} sa {mb} MB)', 'カジュアルをオフライン用に保存中:{p}%({n} / {mb} MB)', 'กำลังบันทึก Casual เพื่อฟังออฟไลน์: {p}% ({n} จาก {mb} MB)', 'Gündelik internetsiz dinlemek için kaydediliyor: %{p} ({n} / {mb} MB)', 'حفظ هادئة للاستماع دون إنترنت: {p}٪ ({n} من {mb} م.ب)', 'Сохраняю «Казуал» для офлайна: {p} % ({n} из {mb} МБ)', 'Зберігаю «Казуал» для офлайну: {p} % ({n} з {mb} МБ)', 'Enregistrement de Détente hors ligne : {p} % ({n} sur {mb} Mo)', 'Casual wird für offline gespeichert: {p} % ({n} von {mb} MB)'],
  'mus.paqNo': ['Casual también puede sonar sin internet ({mb} MB): se guarda sola cuando hay conexión', 'Casual can also play offline ({mb} MB): it saves itself when you are online', 'Casual também pode tocar sem internet ({mb} MB): salva sozinha quando há conexão', 'Casual juga bisa diputar tanpa internet ({mb} MB): tersimpan sendiri saat online', 'Casual juga boleh dimainkan tanpa internet ({mb} MB): disimpan sendiri apabila ada sambungan', 'Puwede ring tumugtog ang Casual nang offline ({mb} MB): kusa itong nase-save kapag may koneksyon', 'カジュアルはオフラインでも再生できます({mb} MB):接続時に自動で保存', 'Casual เล่นแบบออฟไลน์ได้ด้วย ({mb} MB): บันทึกเองเมื่อมีเน็ต', 'Gündelik internetsiz de çalabilir ({mb} MB): bağlantı olunca kendisi kaydedilir', 'يمكن تشغيل هادئة دون إنترنت ({mb} م.ب): تُحفظ تلقائيًا عند الاتصال', '«Казуал» может играть без интернета ({mb} МБ): сохранится сам при подключении', '«Казуал» може грати без інтернету ({mb} МБ): збережеться сам під час підключення', 'Détente peut aussi jouer hors ligne ({mb} Mo) : elle s\'enregistre seule une fois connecté', 'Casual läuft auch offline ({mb} MB): wird bei Verbindung von selbst gespeichert'],
  'mus.paqBajar': ['Guardar ahora', 'Save now', 'Salvar agora', 'Simpan sekarang', 'Simpan sekarang', 'I-save ngayon', '今すぐ保存', 'บันทึกตอนนี้', 'Şimdi kaydet', 'احفظ الآن', 'Сохранить сейчас', 'Зберегти зараз', 'Enregistrer maintenant', 'Jetzt speichern'],
  'mus.cred': ['Casual: Kevin MacLeod (incompetech.com), con licencia Creative Commons Atribución 4.0 (CC BY 4.0). Las demás estaciones suenan desde YouTube, con internet: nada se baja.', 'Casual: Kevin MacLeod (incompetech.com), licensed under Creative Commons Attribution 4.0 (CC BY 4.0). The other stations play from YouTube when online: nothing is downloaded.', 'Casual: Kevin MacLeod (incompetech.com), licença Creative Commons Atribuição 4.0 (CC BY 4.0). As outras estações tocam pelo YouTube, com internet: nada é baixado.', 'Casual: Kevin MacLeod (incompetech.com), lisensi Creative Commons Atribusi 4.0 (CC BY 4.0). Stasiun lain diputar dari YouTube saat online: tidak ada yang diunduh.', 'Casual: Kevin MacLeod (incompetech.com), lesen Creative Commons Atribusi 4.0 (CC BY 4.0). Stesen lain dimainkan dari YouTube dengan internet: tiada yang dimuat turun.', 'Casual: Kevin MacLeod (incompetech.com), lisensyang Creative Commons Attribution 4.0 (CC BY 4.0). Ang ibang istasyon ay mula sa YouTube kapag online: walang dina-download.', 'カジュアル:Kevin MacLeod(incompetech.com)、クリエイティブ・コモンズ 表示 4.0(CC BY 4.0)。他のステーションはオンライン時に YouTube から再生され、何もダウンロードしません。', 'Casual: Kevin MacLeod (incompetech.com) สัญญาอนุญาต Creative Commons แสดงที่มา 4.0 (CC BY 4.0) สถานีอื่นเล่นจาก YouTube เมื่อออนไลน์ ไม่มีการดาวน์โหลด', 'Gündelik: Kevin MacLeod (incompetech.com), Creative Commons Atıf 4.0 (CC BY 4.0) lisanslı. Diğer istasyonlar internetle YouTube\'dan çalar: hiçbir şey indirilmez.', 'هادئة: Kevin MacLeod (incompetech.com) بترخيص المشاع الإبداعي نسب المصنَّف 4.0 (CC BY 4.0). المحطات الأخرى تُشغَّل من يوتيوب عند الاتصال: لا يُنزَّل شيء.', '«Казуал»: Kevin MacLeod (incompetech.com), лицензия Creative Commons «С указанием авторства» 4.0 (CC BY 4.0). Остальные станции играют с YouTube при наличии интернета: ничего не скачивается.', '«Казуал»: Kevin MacLeod (incompetech.com), ліцензія Creative Commons «Зазначення авторства» 4.0 (CC BY 4.0). Інші станції грають з YouTube за наявності інтернету: нічого не завантажується.', 'Détente : Kevin MacLeod (incompetech.com), sous licence Creative Commons Attribution 4.0 (CC BY 4.0). Les autres stations jouent depuis YouTube en ligne : rien n\'est téléchargé.', 'Casual: Kevin MacLeod (incompetech.com), lizenziert unter Creative Commons Namensnennung 4.0 (CC BY 4.0). Die anderen Sender laufen online über YouTube: es wird nichts heruntergeladen.'],
});
