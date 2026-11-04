// ---------------- pad de memes: tocás uno, suena para los que están cerca (sale de tu personaje) y aparece en el chat ----------------
// Los incluidos (en el paquete como MM_<id>) se decodifican recién al tocarlos: tenerlos todos decodificados ocupa ~15 MB y
// en un celular de 2 GB no conviene. "Mis memes": cualquier audio corto del aparato (hasta 8 s y 400 KB), guardado en el
// navegador; en la sala viaja de a pedazos la primera vez que suena y los demás lo guardan mientras dure la partida. Los de
// los demás se pueden silenciar (siguen apareciendo en el chat). Uno cada 0,8 s por jugador.
const MEME = { tab: 'rb', bus: '', t: -9, dec: new Map(), sala: new Map(), partes: new Map(), enviados: new Set(), esperan: new Map(), ult: new Map(), db: null, memoria: [], dib: 0 };
const MEME_MAX = 400 * 1024, MEME_SEG = 8, MEME_ESPERA = 0.8;
const MEME_ID = /^(rb:[a-z0-9]{1,16}|u:[a-z0-9]{6,16})$/;
const memeNom = (m) => (m.e && PREFS.lang !== 'es' ? m.e : m.n);
const memeIncluidos = () => (DATA.memes || []).map(([id, n, e, c]) => ({ id: 'rb:' + id, n, e, c }));
// ---------------- los míos (IndexedDB; sin ella, hasta recargar) ----------------
function memeDB() {
  if (MEME.db) return MEME.db;
  return (MEME.db = new Promise((ok) => {
    try { const r = indexedDB.open('rezobox-memes', 1); r.onupgradeneeded = () => r.result.createObjectStore('m', { keyPath: 'id' }); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); } catch (e) { ok(null); }
  }));
}
async function memeMios() {
  const db = await memeDB(); if (!db) return MEME.memoria.slice();
  return new Promise((ok) => { try { const r = db.transaction('m').objectStore('m').getAll(); r.onsuccess = () => ok((r.result || []).sort((a, b) => (a.fecha || 0) - (b.fecha || 0))); r.onerror = () => ok([]); } catch (e) { ok([]); } });
}
async function memeGuardar(m) {
  const db = await memeDB(); if (!db) { MEME.memoria = MEME.memoria.filter((x) => x.id !== m.id).concat([m]); return; }
  return new Promise((ok) => { try { const t = db.transaction('m', 'readwrite'); t.objectStore('m').put(m); t.oncomplete = t.onerror = () => ok(); } catch (e) { ok(); } });
}
async function memeBorrar(id) {
  const db = await memeDB(); if (!db) { MEME.memoria = MEME.memoria.filter((x) => x.id !== id); return; }
  return new Promise((ok) => { try { const t = db.transaction('m', 'readwrite'); t.objectStore('m').delete(id); t.oncomplete = t.onerror = () => ok(); } catch (e) { ok(); } });
}
// un audio del aparato: se prueba que se pueda decodificar y que sea corto; el id sale del contenido (el mismo audio en
// dos aparatos es el mismo meme)
async function memeImportar(nombre, bytes) {
  if (!bytes || bytes.byteLength > MEME_MAX) return { error: 'mm.largo' };
  audioIniciar(); if (!AUD.ctx) return { error: 'mm.noaudio' };
  let b; try { b = await AUD.ctx.decodeAudioData(bytes.slice(0)); } catch (e) { return { error: 'mm.noaudio' }; }
  if (!b || b.duration > MEME_SEG + 0.05) return { error: 'mm.largo' };
  const h = new Uint8Array(await crypto.subtle.digest('SHA-1', bytes)), id = 'u:' + [...h.slice(0, 6)].map((x) => x.toString(16).padStart(2, '0')).join('');
  const m = { id, n: String(nombre || 'Meme').replace(/\.[a-z0-9]{2,4}$/i, '').slice(0, 24) || 'Meme', c: MEME_COLORES[h[7] % MEME_COLORES.length], a: bytes, fecha: Date.now() };
  await memeGuardar(m); MEME.dec.set(id, Promise.resolve(b)); return m;
}
const MEME_COLORES = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#8e24aa', '#d81b60', '#6d4c41', '#546e7a'];
// el audio de un meme ya decodificado (una sola vez; los incluidos del paquete, los míos de IndexedDB, los de la sala de lo
// que llegó por la red)
function memeAudio(id) {
  if (MEME.dec.has(id)) return MEME.dec.get(id);
  audioIniciar(); if (!AUD.ctx) return Promise.resolve(null);
  let p;
  if (id.startsWith('rb:')) p = (async () => {   // (los incluidos vienen en un paquete aparte: se baja la primera vez)
    if (!PK.parte('a:MM_' + id.slice(3))) await rbAsegurar('a_memes');
    const x = PK.parte('a:MM_' + id.slice(3)); return x ? AUD.ctx.decodeAudioData(x.slice().buffer).catch(() => null) : null; })();
  else {
    const s = MEME.sala.get(id);
    p = (s ? Promise.resolve(s.a) : memeMios().then((L) => { const m = L.find((x) => x.id === id); return m && m.a; })).then((a) => (a ? AUD.ctx.decodeAudioData(a.slice(0)).catch(() => null) : null));
  }
  p = p.then((b) => { if (!b) MEME.dec.delete(id); return b; });
  MEME.dec.set(id, p); return p;
}
// suena: de mi personaje (plano, para mí) o del de quien lo tocó (en el lugar, con oclusión y eco como todo)
async function memeSonar(id, P) {
  const b = await memeAudio(id); if (!b || !AUD.ctx || !PREFS.vol) return null;
  const s = AUD.ctx.createBufferSource(); s.buffer = b;
  if (P && P !== JUG.cuerpo) {
    const pos = v3(P.pos.x, P.pos.y + 0.5, P.pos.z); if (pos.distTo(CAM.pos) > 160) return null;
    const F = fuente3D(pos, 1.6); s.connect(F.g);
  } else { const g = AUD.ctx.createGain(); g.gain.value = 0.85; s.connect(g); g.connect(AUD.master); }
  s.start(); return s;
}
// el renglón del chat: el botoncito del color del meme, quién y cuál
function memeChat(quien, m) {
  if (typeof censurar === 'function') quien = censurar(quien);
  const t = `${quien}: ${memeNom(m)}`;
  CHAT.push({ t, v: 12, h: `<span class="chMm"><i style="background:${/^#[0-9a-f]{6}$/i.test(m.c) ? m.c : '#888'}"></i>${esc(quien)}: <b>${esc(memeNom(m))}</b></span>` });
  if (CHAT.length > 8) CHAT.shift();
}
// ---------------- tocar uno ----------------
async function memeTocar(id) {
  const ahora = performance.now() / 1000; if (ahora - MEME.t < MEME_ESPERA) return false;
  const m = memeIncluidos().find((x) => x.id === id) || (await memeMios()).find((x) => x.id === id); if (!m) return false;
  MEME.t = ahora;
  memeSonar(id, JUG.cuerpo); memeChat(PREFS.nombre, m); memeBrillo(id);
  if (RED.on) {
    publicar('a', { k: 'meme', m: id, q: PREFS.nombre, n: m.id.startsWith('u:') ? m.n : undefined, c: m.c });
    if (m.a && !MEME.enviados.has(id)) { MEME.enviados.add(id); memeMandar(m); }
  }
  return true;
}
// mi audio, de a pedazos (24 mil letras por mensaje, 8 por segundo, como los juegos de las maquinitas)
async function memeMandar(m) {
  const b = new Uint8Array(m.a); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  const d = btoa(s), P = []; for (let i = 0; i < d.length; i += 24000) P.push(d.slice(i, i + 24000));
  for (let x = 0; x < P.length; x++) { publicar('a', { k: 'memed', g: m.id, x, n: P.length, d: P[x] }); await new Promise((ok) => setTimeout(ok, 125)); }
}
// ---------------- lo que llega ----------------
function memeRed(d) {
  if (typeof d.m === 'string' && d.k === 'meme') {
    if (!MEME_ID.test(d.m)) return;
    const t = performance.now() / 1000; if (t - (MEME.ult.get(d.i) || -9) < MEME_ESPERA * 0.75) return; MEME.ult.set(d.i, t);   // (uno a la vez por jugador)
    const R2 = RED.remotos.get(d.i), quien = (R2 && R2.nombre) || limpio(typeof d.q === 'string' ? d.q : '?');
    const inc = d.m.startsWith('rb:') ? memeIncluidos().find((x) => x.id === d.m) : null; if (d.m.startsWith('rb:') && !inc) return;
    const m = inc || { id: d.m, n: String(d.n || 'Meme').slice(0, 24), c: typeof d.c === 'string' ? d.c : '#888' };
    memeChat(quien, m);
    if (PREFS.memesOtros === false) return;
    if (d.m.startsWith('u:') && !MEME.sala.has(d.m) && !MEME.dec.has(d.m)) { MEME.esperan.set(d.m, { P: R2 && R2.P, t }); return; }   // (su audio viene en camino)
    memeSonar(d.m, R2 && R2.P);
    return;
  }
  if (d.k === 'memed' && typeof d.g === 'string' && typeof d.d === 'string' && /^u:/.test(d.g) && MEME_ID.test(d.g)) {
    const n = d.n | 0, i = d.x | 0; if (n < 1 || n > 30 || i < 0 || i >= n || MEME.sala.has(d.g)) return;
    let e = MEME.partes.get(d.g); if (!e || e.n !== n) { e = { n, p: new Array(n), llegaron: 0 }; MEME.partes.set(d.g, e); }
    if (e.p[i] === undefined) { e.p[i] = d.d; e.llegaron++; }
    if (e.llegaron < n) return;
    MEME.partes.delete(d.g);
    try {
      const s = atob(e.p.join('')); if (s.length > MEME_MAX) return;
      const b = new Uint8Array(s.length); for (let k = 0; k < s.length; k++) b[k] = s.charCodeAt(k);
      MEME.sala.set(d.g, { a: b.buffer });
    } catch (x) { return; }
    // (si sonó mientras llegaba y no pasaron más de 8 s, ahora)
    const w = MEME.esperan.get(d.g); MEME.esperan.delete(d.g);
    if (w && performance.now() / 1000 - w.t < 8 && PREFS.memesOtros !== false) memeSonar(d.g, w.P);
  }
}
// ---------------- el pad ----------------
function memePan() {
  let p = $('memePan'); if (p) return p;
  p = document.createElement('div'); p.id = 'memePan'; p.className = 'panel oc';
  p.innerHTML = `<div class="caja memeCaja"><h3><span class="mmTit"></span><input class="mmBus" maxlength="30"><button class="boton gris mmX" data-mm="cerrar">×</button></h3>
    <div class="mqTabs mmTabs"></div><div class="mmGrid"></div>
    <div class="mmPie"><label><input type="checkbox" class="mmOtros"> <span class="mmTOtros"></span></label><span class="mmAviso"></span><button class="boton mmAgregar" data-mm="agregar"></button><input type="file" class="mmArch" accept="audio/*,.mp3,.ogg,.wav,.m4a" hidden></div></div>`;
  document.body.appendChild(p);
  p.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-mm]'); if (!b) { if (e.target === p) memePanCerrar(); return; }
    const [a, x] = b.dataset.mm.split('|');
    if (a === 'cerrar') memePanCerrar();
    else if (a === 'tab') { MEME.tab = x; memePanDibujar(); }
    else if (a === 'tocar') memeTocar(x);
    else if (a === 'borrar') { e.stopPropagation(); await memeBorrar(x); MEME.dec.delete(x); memePanDibujar(); }
    else if (a === 'agregar') p.querySelector('.mmArch').click();
  });
  p.querySelector('.mmBus').addEventListener('input', (e) => { MEME.bus = e.target.value.trim().toLowerCase(); memePanDibujar(); });
  p.querySelector('.mmOtros').addEventListener('change', (e) => { PREFS.memesOtros = e.target.checked; guardarPrefs(); });
  p.querySelector('.mmArch').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    const r = f.size > MEME_MAX ? { error: 'mm.largo' } : await memeImportar(f.name, await f.arrayBuffer());
    p.querySelector('.mmAviso').textContent = r.error ? T(r.error) : '';
    if (!r.error) { MEME.tab = 'mios'; memePanDibujar(); }
  });
  return p;
}
function memePanAbrir() { rbPedir('a_memes'); const p = memePan(); p.classList.remove('oc'); UI.abierto = 'memes'; soltarPuntero(); p.querySelector('.mmAviso').textContent = ''; memePanDibujar(); }
function memePanCerrar() { const p = $('memePan'); if (p) p.classList.add('oc'); if (UI.abierto === 'memes') UI.abierto = null; }
async function memePanDibujar() {
  const p = memePan(), n = ++MEME.dib;
  p.querySelector('.mmTit').textContent = T('mm.tit'); p.querySelector('.mmBus').placeholder = T('mm.buscar');
  p.querySelector('.mmTOtros').textContent = T('mm.otros'); p.querySelector('.mmOtros').checked = PREFS.memesOtros !== false;
  p.querySelector('.mmAgregar').textContent = T('mm.agregar');
  p.querySelector('.mmTabs').innerHTML = ['rb', 'mios'].map((k) => `<button class="${MEME.tab === k ? 'sel' : ''}" data-mm="tab|${k}">${esc(T('mm.t_' + k))}</button>`).join('');
  let L = MEME.tab === 'mios' ? await memeMios() : memeIncluidos(); if (n !== MEME.dib) return;
  if (MEME.bus) L = L.filter((m) => (m.n + ' ' + (m.e || '')).toLowerCase().includes(MEME.bus));
  p.querySelector('.mmGrid').innerHTML = L.length ? L.map((m) => `<div class="mmB" data-mm="tocar|${m.id}" data-id="${m.id}"><span class="mmBot" style="--c:${/^#[0-9a-f]{6}$/i.test(m.c) ? m.c : '#888'}"></span><span class="mmN">${esc(memeNom(m))}</span>${m.id.startsWith('u:') ? `<button class="mmDel" data-mm="borrar|${m.id}">×</button>` : ''}</div>`).join('')
    : `<div class="mmVacio">${esc(T(MEME.tab === 'mios' ? 'mm.vacio' : 'mm.nada'))}</div>`;
}
// el botón tocado se ilumina mientras suena (como los botones de verdad)
function memeBrillo(id) {
  const e = document.querySelector(`#memePan .mmB[data-id="${id}"]`); if (!e) return;
  e.classList.remove('suena'); void e.offsetWidth; e.classList.add('suena');
  memeAudio(id).then((b) => setTimeout(() => e.classList.remove('suena'), b ? b.duration * 1000 : 500));
}
