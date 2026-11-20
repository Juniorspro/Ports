// ---------------- la cuenta (con Google o con la dirección de Gmail): para jugar en multijugador y guardar el progreso ----
// Con Gmail, sin Google: se escribe la dirección, la tienda manda un código de 6 números a ese correo y con el código se
// entra (cuMail: dos pasos en el mismo cartel). Quien quiere, recibe novedades por correo.
// Iniciar sesión abre la página de la tienda (tienda/cuenta.js) con el botón de Google: en la app, en el navegador del
// celular (Google no deja iniciar sesión dentro de la app); en la web, en una ventanita. Mientras tanto el juego espera:
// pregunta cada segundo y medio con un verificador al azar que sólo tiene este aparato, y al terminar queda la sesión
// (un token que vale 90 días). Si la tienda todavía no tiene configurado Google (config dice google: false) o nunca
// contestó, no se pide nada: el juego anda como antes.
// Con sesión, el progreso (construcciones y sus fotos, noches, datos de los mods y de los addons, memoria de Verity,
// emotes favoritos, tus servers, personaje, nombre y la lista de addons de GMod) se copia a la cuenta y vuelve en otro
// aparato. Cada clave lleva la hora en que cambió y al juntar gana la más nueva.
const CU = { conf: null, token: '', u: null, f: {}, sucio: new Set(), pend: null, espera: null, aplicando: false, ult: 0, lleno: false };
const CU_PROG = [/^jx_save_/, /^rb_foto_/, /^rb_fn$/, /^rb_pdata$/, /^gmdata:/, /^gmcookie:/, /^rbmod_/, /^rb_verity$/, /^rb_emo_fav$/, /^rb_salas_mias$/, /^rb_gmb_fijos$/, /^cu:perfil$/];
const cuEsProg = (k) => CU_PROG.some((r) => r.test(k));
const cuLS = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } } };
const cuRequerida = () => !!(CU.conf && (CU.conf.google || CU.conf.correo));
const cuHayGmail = () => !!(CU.conf && CU.conf.correo);
const cuDentro = () => !!CU.token;
// (sin sesión y con las cuentas encendidas no se guarda el progreso)
function cuentaPuedeGuardar() { return !cuRequerida() || cuDentro(); }
function cuentaFaltaPara() { return cuRequerida() && !cuDentro(); }
const cuApi = (r, o) => {
  o = o || {}; const h = Object.assign({}, o.headers || {}); if (CU.token) h.Authorization = 'Bearer ' + CU.token;
  if (o.body && typeof o.body !== 'string') { h['Content-Type'] = 'application/json'; o.body = JSON.stringify(o.body); }
  const c = typeof AbortController === 'function' ? new AbortController() : null, t = c ? setTimeout(() => c.abort(), o.ms || 15000) : 0;
  return fetch(TIENDA_URL + r, Object.assign({}, o, { headers: h, signal: c ? c.signal : undefined })).finally(() => t && clearTimeout(t));
};

// ---- al arrancar ----
function cuentaIniciar() {
  try { const s = JSON.parse(cuLS.get('jx_cuenta') || 'null'); if (s && /^[a-f0-9]{64}$/.test(s.token)) { CU.token = s.token; CU.u = s.u || null; } } catch (e) {}
  try { CU.f = JSON.parse(cuLS.get('jx_cu_f') || '{}') || {}; } catch (e) { CU.f = {}; }
  try { CU.conf = JSON.parse(cuLS.get('jx_cu_conf') || 'null'); } catch (e) {}
  // (cada escritura de una clave de progreso queda anotada con su hora, para subirla)
  try {
    const P = Storage.prototype, set0 = P.setItem, del0 = P.removeItem;
    P.setItem = function (k, v) { set0.call(this, k, v); if (this === window.localStorage && !CU.aplicando && cuEsProg(String(k))) cuMarcar(String(k)); };
    P.removeItem = function (k) { del0.call(this, k); if (this === window.localStorage && !CU.aplicando && cuEsProg(String(k))) cuMarcar(String(k)); };
    CU.set0 = (k, v) => set0.call(localStorage, k, v); CU.del0 = (k) => del0.call(localStorage, k);
  } catch (e) {}
  cuConfig().then(() => { if (CU.token) { cuSincronizar(true); if (typeof socIniciar === 'function') socIniciar(); } cuentaPintar(); cuPedirAlAbrir(); });
  // (si Android cerró el juego mientras se iniciaba sesión en el navegador, al volver se sigue esperando)
  try { const E = JSON.parse(cuLS.get('jx_cu_espera') || 'null'); if (E && E.v && Date.now() - E.t0 < 600e3 && !CU.token) { CU.espera = E; clearInterval(CU.tPreg); CU.tPreg = setInterval(cuPreguntar, 1500); setTimeout(() => { if (CU.espera) cuDialogo(); }, 1500); } else if (E) CU.del0('jx_cu_espera'); } catch (e) {}
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') cuSubir(true); else if (CU.espera) cuPreguntar(); });
  addEventListener('focus', () => { if (CU.espera) cuPreguntar(); });
  addEventListener('message', (e) => { if (e && e.data && e.data.jxCuenta && CU.espera) cuPreguntar(); });
  setInterval(() => { if (CU.token && CU.sucio.size) cuSubir(); }, 60000);
}
async function cuConfig() {
  try { const r = await cuApi('cuenta/config', { ms: 8000 }); if (r.ok) { CU.conf = await r.json(); try { CU.set0 ? CU.set0('jx_cu_conf', JSON.stringify(CU.conf)) : localStorage.setItem('jx_cu_conf', JSON.stringify(CU.conf)); } catch (e) {} } else if (r.status === 404) CU.conf = { google: false }; }
  catch (e) {}
  return CU.conf;
}
function cuGuardarSesion() { try { const v = CU.token ? JSON.stringify({ token: CU.token, u: CU.u }) : null; if (v) CU.set0('jx_cuenta', v); else CU.del0('jx_cuenta'); } catch (e) {} }
function cuMarcar(k) {
  CU.f[k] = Date.now(); CU.sucio.add(k); try { CU.set0('jx_cu_f', JSON.stringify(CU.f)); } catch (e) {}
  if (CU.token) { clearTimeout(CU.tSub); CU.tSub = setTimeout(() => cuSubir(), 4000); }
}

// ---- entrar ----
const cuB64 = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function cuHex(s) { const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); return [...h].map((b) => b.toString(16).padStart(2, '0')).join(''); }
// (con Gmail encendido, primero se elige cómo: el cartel con los dos botones; si no, directo a Google)
function cuentaEntrar(despues) {
  if (CU.espera || !cuHayGmail()) return cuEntrarGoogle(despues);
  CU.mail = null; cuDialogo(CU.motivo, despues || null);
}
async function cuEntrarGoogle(despues) {
  if (!CU.conf || !CU.conf.google) return;
  if (CU.espera) { cuAbrirPagina(); return; }
  const v = cuB64(crypto.getRandomValues(new Uint8Array(32))), e = await cuHex(v), app = !!(window.JXNativo && JXNativo.abrir);
  CU.espera = { v, e, t0: Date.now(), despues: despues || null, url: TIENDA_URL + 'cuenta/entrar?e=' + e + '&l=' + encodeURIComponent(PREFS.lang || 'en') + (app ? '&app=1' : '') };
  try { CU.set0('jx_cu_espera', JSON.stringify({ v, e, t0: CU.espera.t0, url: CU.espera.url })); } catch (er) {}
  cuAbrirPagina(); cuDialogo(); clearInterval(CU.tPreg); CU.tPreg = setInterval(cuPreguntar, 1500);
}
function cuAbrirPagina() {
  const u = CU.espera && CU.espera.url; if (!u) return;
  try { if (window.JXNativo && JXNativo.abrir) { JXNativo.abrir(u); return; } } catch (e) {}
  const w = window.open(u, 'jxcuenta', 'width=460,height=640'); if (!w) { const a = document.querySelector('#cuDlg .cuLink'); if (a) a.classList.remove('oc'); }
}
async function cuPreguntar() {
  const E = CU.espera; if (!E || CU.preguntando) return;
  if (Date.now() - E.t0 > 600e3) { cuCancelar(); cuAviso(T('cu.vencio')); return; }
  CU.preguntando = true;
  try {
    const r = await cuApi('cuenta/listo', { method: 'POST', body: { v: E.v }, ms: 10000 }), j = await r.json().catch(() => ({}));
    if (CU.espera !== E) return;
    if (j && j.token) {
      CU.espera = null; clearInterval(CU.tPreg); try { CU.del0('jx_cu_espera'); } catch (er) {}
      cuSesionLista(j.token, j.usuario, E.despues);
    } else if (j && j.vencido) { cuCancelar(); cuAviso(T('cu.vencio')); }
  } catch (e) {} finally { CU.preguntando = false; }
}
// la sesión nueva (de Google o del código de Gmail)
function cuSesionLista(token, usuario, despues) {
  CU.token = token; CU.u = usuario || null; CU.mail = null; cuGuardarSesion();
  cuDialogoCerrar(); cuAviso(T('cu.listo').replace('{n}', (CU.u && CU.u.nombre) || '')); cuentaPintar();
  // (lo que se hizo sin sesión en este aparato también va a la cuenta, si en la cuenta no hay algo más nuevo)
  for (const k of cuClavesLocales()) if (!CU.f[k]) { CU.f[k] = 1; CU.sucio.add(k); }
  // (lo que se quería hacer, ya; la copia con la cuenta va atrás: lo recién hecho tiene la hora más nueva y gana)
  if (typeof socIniciar === 'function') socIniciar();
  if (despues) try { despues(); } catch (er) { console.error(er); }
  cuSincronizar(true);
}
// ---- entrar con la dirección de Gmail: pedir el código y entrar con él ----
async function cuMailPedir() {
  const M = CU.mail; if (!M || M.ocupado) return;
  const inp = document.getElementById('cuMail'), chk = document.getElementById('cuNov');
  if (inp) M.dir = inp.value.trim(); if (chk) M.avisos = chk.checked;
  if (!/^[^\s@]+@(gmail|googlemail)\.com$/i.test(M.dir)) { M.err = T('cu.malGmail'); cuDialogo(); return; }
  M.ocupado = true; M.err = ''; cuDialogo();
  try {
    const r = await cuApi('cuenta/correo/pedir', { method: 'POST', body: { correo: M.dir, l: PREFS.lang || 'es' }, ms: 30000 }), j = await r.json().catch(() => ({}));
    if (CU.mail !== M) return;
    if (r.ok && j.ok) { M.paso = 2; M.dir = j.dir || M.dir; M.t = Date.now(); M.err = ''; }
    else M.err = T(j.mal === 'gmail' ? 'cu.malGmail' : j.mal === 'muchos' ? 'cu.muchos' : 'cu.noSalio');
  } catch (e) { if (CU.mail === M) M.err = T('cu.sinRed'); }
  M.ocupado = false; if (CU.mail === M) cuDialogo();
}
async function cuMailEntrar() {
  const M = CU.mail; if (!M || M.ocupado) return;
  const ci = document.getElementById('cuCod'), ni = document.getElementById('cuNom');
  M.cod = (ci ? ci.value : M.cod || '').replace(/\D/g, ''); if (ni) M.nom = ni.value.trim();
  if (M.cod.length !== 6) { M.err = T('cu.codigo'); cuDialogo(); return; }
  M.ocupado = true; M.err = ''; cuDialogo();
  try {
    const r = await cuApi('cuenta/correo/entrar', { method: 'POST', body: { correo: M.dir, codigo: M.cod, nombre: M.nom || PREFS.nombre || '', avisos: !!M.avisos }, ms: 20000 }), j = await r.json().catch(() => ({}));
    if (CU.mail !== M) return;
    if (r.ok && j.token) { M.ocupado = false; cuSesionLista(j.token, j.usuario, CU.siguiente); CU.siguiente = null; return; }
    M.err = j.mal === 'codigo' ? T('cu.malCodigo').replace('{n}', j.quedan) : j.mal === 'vencido' ? T('cu.vencioCodigo') : j.mal === 'muchos' ? T('cu.muchos') : T('cu.noSalio');
    if (j.mal === 'codigo') M.cod = '';
  } catch (e) { if (CU.mail === M) M.err = T('cu.sinRed'); }
  M.ocupado = false; if (CU.mail === M) cuDialogo();
}
// (las novedades por correo, desde el cartel de la cuenta)
async function cuAvisosPoner(si) {
  try { const r = await cuApi('cuenta/avisos', { method: 'POST', body: { si: !!si } }); if (r.ok && CU.u) { CU.u.avisos = !!si; cuGuardarSesion(); } } catch (e) {}
}
function cuCancelar() { CU.espera = null; CU.mail = null; clearInterval(CU.tPreg); cuDialogoCerrar(); try { CU.del0('jx_cu_espera'); } catch (e) {} }
async function cuentaSalir() {
  await cuSubir(true);
  try { await cuApi('cuenta/salir', { method: 'POST', ms: 6000 }); } catch (e) {}
  CU.token = ''; CU.u = null; CU.sucio.clear(); cuGuardarSesion(); cuentaPintar(); cuAviso(T('cu.salio'));
  if (typeof RB !== 'undefined' && RB.panel === 'multi' && typeof inicioPanel === 'function') inicioPanel('multi');
}
// al abrir el juego (también después de actualizar): si hace falta la cuenta y no hay sesión, se pide una vez, ya en el
// menú (después de la intro y la carga), sin esperar a que el jugador entre al multijugador o guarde
function cuPedirAlAbrir() {
  if (!cuentaFaltaPara() || CU.espera || cuPedirAlAbrir.hecho) return;
  const listo = () => typeof JUEGO !== 'undefined' && JUEGO.estado === 'principal' && typeof RB !== 'undefined' && RB.el && !RB.el.classList.contains('oc') && (!window.__carga || window.__carga.listo) && !(window.__intro && !window.__intro.fin);
  const t0 = Date.now(), iv = setInterval(() => {
    if (!cuentaFaltaPara() || Date.now() - t0 > 120e3) { clearInterval(iv); return; }
    if (!listo()) return; clearInterval(iv); cuPedirAlAbrir.hecho = true;
    const D = document.getElementById('cuDlg'); if (D && !D.classList.contains('oc')) return;
    cuDialogo('inicio', () => { if (typeof inicioLista === 'function' && RB.el) inicioLista(); });
  }, 500);
}
// pedir la sesión para algo (motivo: 'multi' o 'guardar'): true si ya se puede (con sesión, o sin cuentas encendidas) y
// quien llama sigue; si no, el cartel para entrar y false (siguiente se llama al terminar de entrar)
function cuentaPedir(motivo, siguiente) {
  if (!cuentaFaltaPara()) return true;
  cuDialogo(motivo, siguiente); return false;
}

// ---- el progreso ----
function cuClavesLocales() { const L = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && cuEsProg(k)) L.push(k); } } catch (e) {} return L; }
// (el perfil: personaje, nombre y la lista de addons de GMod; no los ajustes del aparato como los gráficos)
function cuPerfil() { const g = {}; for (const [id, x] of Object.entries(PREFS.gmod || {})) if (/^\d{3,12}$/.test(id)) g[id] = { n: String(x.n || '').slice(0, 80), img: String(x.img || '').slice(0, 300), mb: x.mb || 0 }; return JSON.stringify({ skin: PREFS.skin, nombre: PREFS.nombre, gmod: g }); }
async function cuSubir(ya) {
  if (!CU.token || CU.subiendo) return;
  const p = cuPerfil(); if (p !== cuLS.get('cu:perfil')) { try { localStorage.setItem('cu:perfil', p); } catch (e) {} }
  if (!CU.sucio.size) return;
  CU.subiendo = true;
  try {
    // (en tandas de hasta ~900 KB; lo que no entra en la cuenta queda sin subir)
    const L = [...CU.sucio]; let tanda = {}, peso = 0;
    const mandar = async () => {
      if (!Object.keys(tanda).length) return true;
      const r = await cuApi('cuenta/progreso', { method: 'POST', body: { datos: tanda }, keepalive: ya && peso < 60000, ms: 30000 });
      if (r.status === 401) { cuSesionVencida(); return false; }
      if (r.status === 413) { if (!CU.lleno) { CU.lleno = true; cuAviso(T('cu.lleno')); } return false; }
      if (!r.ok) return false;
      const j = await r.json().catch(() => ({})); for (const k of Object.keys(tanda)) CU.sucio.delete(k);
      if (j && j.masNuevas && Object.keys(j.masNuevas).length) CU.bajarDespues = true;
      tanda = {}; peso = 0; return true;
    };
    for (const k of L) {
      const v = cuLS.get(k), n = v == null ? 0 : v.length; if (n > 512 * 1024) { CU.sucio.delete(k); continue; }
      if (peso + n > 900 * 1024 && !(await mandar())) return;
      tanda[k] = { v: v == null ? null : v, f: CU.f[k] || Date.now() }; peso += n;
    }
    await mandar();
    if (CU.bajarDespues) { CU.bajarDespues = false; await cuBajar(); }
  } catch (e) {} finally { CU.subiendo = false; }
}
async function cuBajar() {
  const r = await cuApi('cuenta/progreso?desde=0', { ms: 30000 }); if (r.status === 401) { cuSesionVencida(); return; } if (!r.ok) return;
  const j = await r.json(), D = (j && j.datos) || {}; let perfil = null;
  CU.aplicando = true;
  try {
    for (const [k, x] of Object.entries(D)) {
      if (!cuEsProg(k) || !x) continue;
      const fl = CU.f[k] || 0; if (fl >= x.f && cuLS.get(k) !== null) continue;   // (lo de acá es igual o más nuevo)
      if (x.v === null) { try { CU.del0(k); } catch (e) {} } else { try { CU.set0(k, x.v); } catch (e) { continue; } }
      CU.f[k] = x.f; CU.sucio.delete(k); if (k === 'cu:perfil') perfil = x.v;
    }
  } finally { CU.aplicando = false; }
  try { CU.set0('jx_cu_f', JSON.stringify(CU.f)); } catch (e) {}
  CU.ult = Date.now(); if (perfil) cuAplicarPerfil(perfil); cuentaPintar();
}
async function cuSincronizar(todo) { if (!CU.token) return; try { await cuBajar(); await cuSubir(); } catch (e) {} }
function cuSesionVencida() { CU.token = ''; CU.u = null; cuGuardarSesion(); cuentaPintar(); }
// (de otro aparato: el personaje y el nombre; los addons que faltan acá se ofrecen para bajar en segundo plano)
function cuAplicarPerfil(s) {
  let p; try { p = JSON.parse(s); } catch (e) { return; } if (!p || typeof p !== 'object') return;
  if (p.skin && typeof p.skin === 'string') PREFS.skin = p.skin.slice(0, 200);
  if (p.nombre && typeof limpioNombre === 'function') PREFS.nombre = limpioNombre(p.nombre);
  guardarPrefs();
  const faltan = Object.entries(p.gmod || {}).filter(([id]) => /^\d{3,12}$/.test(id) && !(PREFS.gmod && PREFS.gmod[id]) && !(typeof gmcDe === 'function' && gmcDe(id)));
  if (faltan.length && typeof gmcPoner === 'function') cuDialogoMods(faltan);
}

// ---- interfaz: el chip del menú, el cartel para entrar y el de los addons ----
function cuentaPintar() {
  // (en el menú clásico, al lado de tu nombre en la barra de abajo: clasico.js)
  if (typeof clCuentaPintar === 'function' && clCuentaPintar()) return;
  // (en el depósito, adentro de la hoja del perfil; en el botón del perfil, la «G» si hay sesión: deposito.js)
  const A = typeof RB !== 'undefined' && RB.el && RB.el.querySelector('.dpCuenta'); if (!A) return;
  const marca = () => { if (typeof depCuentaMarca === 'function') depCuentaMarca(); };
  let b = A.querySelector('.cuChip'); if (!cuRequerida() && !cuDentro()) { if (b) b.remove(); A.classList.remove('ptCuOn'); marca(); return; }
  if (!b) { b = document.createElement('button'); b.className = 'ptCu cuChip'; b.dataset.rb = 'cuenta'; A.prepend(b); }
  A.classList.add('ptCuOn'); b.title = cuDentro() ? (CU.u && CU.u.nombre) || T('cu.cuenta') : T(cuHayGmail() ? 'cu.iniciar' : 'cu.entrar');
  b.innerHTML = cuDentro() ? `${CU.u && CU.u.foto ? `<img class="cuFoto" src="${esc(CU.u.foto)}" alt="" referrerpolicy="no-referrer">` : glifo('persona')} <span>${esc((CU.u && CU.u.nombre) || T('cu.cuenta'))}</span>` : cuHayGmail() ? `${glifo('persona')} <span>${esc(T('cu.iniciar'))}</span>` : `${CU_G} <span>${esc(T('cu.entrar'))}</span>`;
  marca(); if (typeof depEncajar === 'function') requestAnimationFrame(() => depEncajar());
}
const CU_M = '<svg class="cuG" viewBox="0 0 24 24" width="1.15em" height="1.15em" aria-hidden="true"><rect x="2" y="4.5" width="20" height="15" rx="2.2" fill="#fff" stroke="#d93025" stroke-width="1.6"/><path d="M3 6.2l9 6.6 9-6.6" fill="none" stroke="#d93025" stroke-width="1.9" stroke-linejoin="round"/></svg>';
// (el botón para entrar en los paneles: con Gmail encendido, «Iniciar sesión» y se elige cómo en el cartel)
const cuBotonEntrar = (accion) => (cuHayGmail() ? `<button class="cuGoogle cuGmail" data-rb="${accion}">${glifo('persona')}<span>${esc(T('cu.iniciar'))}</span></button>` : `<button class="cuGoogle" data-rb="${accion}">${CU_G}<span>${esc(T('cu.entrar'))}</span></button>`);
const CU_G = '<svg class="cuG" viewBox="0 0 48 48" width="1.15em" height="1.15em" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
function cuAviso(t) { if (typeof JUEGO !== 'undefined' && JUEGO.estado === 'juego' && typeof aviso === 'function' && !(typeof rbVisible === 'function' && rbVisible())) aviso(t, 3.5); else if (typeof menuAviso === 'function') menuAviso(t); }
function cuCaja() {
  let D = document.getElementById('cuDlg');
  if (!D) {
    D = document.createElement('div'); D.id = 'cuDlg'; D.className = 'oc'; document.body.appendChild(D);
    D.addEventListener('pointerdown', (e) => e.stopPropagation());
    // (escribir la dirección o el código no mueve al jugador ni a los menús; Enter, sigue)
    for (const ev of ['keydown', 'keyup', 'keypress']) D.addEventListener(ev, (e) => {
      e.stopPropagation();
      if (ev === 'keydown' && e.key === 'Enter' && e.target && e.target.tagName === 'INPUT' && CU.mail) { e.preventDefault(); if (CU.mail.paso === 2) cuMailEntrar(); else cuMailPedir(); }
    });
    D.addEventListener('change', (e) => { if (e.target && e.target.id === 'cuNovCta') cuAvisosPoner(e.target.checked); });
    // (el error de antes se va apenas se corrige lo escrito)
    D.addEventListener('input', () => { const x = D.querySelector('.cuErr'); if (x && x.textContent) { x.textContent = ''; if (CU.mail) CU.mail.err = ''; } });
    D.addEventListener('click', (e) => {
      e.stopPropagation(); const b = e.target.closest('[data-cu]'); if (!b) { if (e.target === D && !CU.espera) cuDialogoCerrar(); return; }
      const a = b.dataset.cu;
      if (a === 'entrar') cuEntrarGoogle(CU.siguiente);
      else if (a === 'gmail') { CU.mail = { paso: 1, dir: '', avisos: false, err: '' }; cuDialogo(); setTimeout(() => { const i = document.getElementById('cuMail'); if (i) i.focus(); }, 30); }
      else if (a === 'mandar') cuMailPedir();
      else if (a === 'codigo') cuMailEntrar();
      else if (a === 'reenviar') { if (CU.mail) { CU.mail.paso = 1; cuMailPedir(); } }
      else if (a === 'mailVolver') { if (CU.mail && CU.mail.paso === 2) { CU.mail.paso = 1; CU.mail.err = ''; } else CU.mail = null; cuDialogo(); }
      else if (a === 'reabrir') cuAbrirPagina();
      else if (a === 'no') { cuCancelar(); CU.siguiente = null; }
      else if (a === 'salir') { cuDialogoCerrar(); cuentaSalir(); }
      else if (a === 'bajar') { for (const [id, x] of CU.faltan || []) gmcPoner(id, { nombre: x.n, img: x.img }); CU.faltan = null; cuDialogoCerrar(); }
    });
  }
  return D;
}
// motivo: 'multi' | 'guardar' | undefined (desde el chip); con CU.espera, el cartel de espera
function cuDialogo(motivo, siguiente) {
  const D = cuCaja(); if (motivo !== undefined) { CU.motivo = motivo; CU.siguiente = siguiente || null; }
  if (typeof soltarPuntero === 'function') soltarPuntero();
  let h;
  if (CU.espera) h = `<h3>${CU_G} ${esc(T('cu.entrar'))}</h3><p>${esc(T('cu.esperando'))}</p><div class="cuGira"></div>
      <a class="cuLink oc" href="${esc(CU.espera.url)}" target="_blank" rel="noopener">${esc(T('cu.reabrir'))}</a>
      <div class="cuBotones"><button class="cuBtn gris" data-cu="no">${esc(T('cancelar'))}</button><button class="cuBtn" data-cu="reabrir">${esc(T('cu.reabrir'))}</button></div>`;
  else if (cuDentro()) h = `<h3>${CU.u && CU.u.foto ? `<img class="cuFoto grande" src="${esc(CU.u.foto)}" alt="" referrerpolicy="no-referrer">` : ''} ${esc((CU.u && CU.u.nombre) || T('cu.cuenta'))}</h3>
      ${CU.u && CU.u.correo ? `<p class="cuDir">${CU_M} ${esc(CU.u.correo)}</p><label class="cuChk"><input type="checkbox" id="cuNovCta"${CU.u.avisos ? ' checked' : ''}> ${esc(T('cu.novedades'))}</label>` : ''}
      <p>${esc(T('cu.sinc'))}${CU.ult ? ' · ' + new Date(CU.ult).toLocaleTimeString() : ''}</p>
      <div class="cuBotones"><button class="cuBtn gris" data-cu="no">${esc(T('volver'))}</button><button class="cuBtn rojo" data-cu="salir">${esc(T('cu.salir'))}</button></div>`;
  else if (CU.mail && CU.mail.paso === 2) { const M = CU.mail, puede = Date.now() - (M.t || 0) > 45e3;
    h = `<h3>${CU_M} ${esc(T('cu.gmail'))}</h3><p>${esc(T('cu.mailPaso2').replace('{c}', M.dir))}</p>
      <input class="cuIn cuCod" id="cuCod" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="${esc(T('cu.codigo'))}" value="${esc(M.cod || '')}">
      <input class="cuIn" id="cuNom" maxlength="24" placeholder="${esc(T('cu.tuNombre'))}" value="${esc(M.nom || PREFS.nombre || '')}">
      <p class="cuErr">${esc(M.err || '')}</p>
      <div class="cuBotones"><button class="cuBtn gris" data-cu="mailVolver">${esc(T('volver'))}</button><button class="cuBtn" data-cu="codigo"${M.ocupado ? ' disabled' : ''}>${esc(M.ocupado ? '…' : T('cu.iniciar'))}</button></div>
      <button class="cuLinkBtn" data-cu="reenviar"${puede && !M.ocupado ? '' : ' disabled'}>${esc(T('cu.reenviar'))}</button>`;
    if (!puede) { clearTimeout(CU.tReenv); CU.tReenv = setTimeout(() => { if (CU.mail === M && M.paso === 2) { const b = document.querySelector('#cuDlg [data-cu=reenviar]'); if (b) b.disabled = false; } }, 45e3 - (Date.now() - (M.t || 0))); } }
  else if (CU.mail) { const M = CU.mail;
    h = `<h3>${CU_M} ${esc(T('cu.gmail'))}</h3><p>${esc(T('cu.mailPaso1'))}</p>
      <input class="cuIn" id="cuMail" type="email" inputmode="email" autocomplete="email" maxlength="80" placeholder="tunombre@gmail.com" value="${esc(M.dir || '')}">
      <label class="cuChk"><input type="checkbox" id="cuNov"${M.avisos ? ' checked' : ''}> ${esc(T('cu.novedades'))}</label>
      <p class="cuErr">${esc(M.err || '')}</p>
      <div class="cuBotones"><button class="cuBtn gris" data-cu="mailVolver">${esc(T('volver'))}</button><button class="cuBtn" data-cu="mandar"${M.ocupado ? ' disabled' : ''}>${esc(M.ocupado ? '…' : T('cu.mandar'))}</button></div>`; }
  else h = `<h3>${esc(T('cu.cuenta'))}</h3><p>${esc(T(CU.motivo === 'multi' ? 'cu.paraMulti' : CU.motivo === 'guardar' ? 'cu.paraGuardar' : CU.motivo === 'bugs' ? 'cu.paraBugs' : 'cu.para'))}</p>
      ${CU.conf && CU.conf.google ? `<button class="cuGoogle" data-cu="entrar">${CU_G}<span>${esc(T('cu.entrar'))}</span></button>` : ''}
      ${cuHayGmail() ? `${CU.conf.google ? `<div class="cuO">${esc(T('cu.o'))}</div>` : ''}<button class="cuGoogle cuGmail" data-cu="gmail">${CU_M}<span>${esc(T('cu.gmail'))}</span></button>` : ''}
      <div class="cuBotones"><button class="cuBtn gris" data-cu="no">${esc(T('cu.ahoraNo'))}</button></div>`;
  D.innerHTML = `<div class="cuCaja" dir="${PREFS.lang === 'ar' ? 'rtl' : 'ltr'}">${h}</div>`; D.className = '';
}
function cuDialogoCerrar() { const D = document.getElementById('cuDlg'); if (D) D.className = 'oc'; }
function cuDialogoMods(faltan) {
  CU.faltan = faltan; const D = cuCaja(), mb = Math.round(faltan.reduce((s, [, x]) => s + (+x.mb || 0), 0));
  D.innerHTML = `<div class="cuCaja"><h3>${esc(T('cu.cuenta'))}</h3><p>${esc(T('cu.mods').replace('{n}', faltan.length).replace('{mb}', mb ? mb + ' MB' : '?'))}</p>
    <div class="cuBotones"><button class="cuBtn gris" data-cu="no">${esc(T('cu.ahoraNo'))}</button><button class="cuBtn" data-cu="bajar">${esc(T('cu.bajar'))}</button></div></div>`;
  D.className = '';
}
// (el panel de multijugador sin sesión: el cartel para entrar en vez de la lista)
function cuPanelMulti(P) {
  // (la partida en la red local no pide la cuenta: puede no haber internet —lan.js—)
  P.innerHTML = `<div class="rbPanCab">${glifo('gente')} ${esc(T('m.multi'))}<span class="rbEsp"></span><button class="rbBtnGris rbChico" data-rb="lan">${glifo('wifi')} ${esc(T('lan.boton'))}</button></div>
    <div class="cuPanel"><p>${esc(T('cu.paraMulti'))}</p>${cuBotonEntrar('cuentaEntrar')}</div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">${glifo('atras')} ${esc(T('volver'))}</button></div>`;
}

// ---------------- textos (es, en, pt, id, ms, fil, ja, th, tr, ar, ru, uk, fr, de) ----------------
Object.assign(IDI3, {
  'cu.entrar': ['Iniciar sesión con Google', 'Sign in with Google', 'Entrar com o Google', 'Masuk dengan Google', 'Log masuk dengan Google', 'Mag-sign in gamit ang Google', 'Googleでログイン', 'ลงชื่อเข้าใช้ด้วย Google', 'Google ile giriş yap', 'تسجيل الدخول باستخدام Google', 'Войти через Google', 'Увійти через Google', 'Se connecter avec Google', 'Mit Google anmelden'],
  'cu.cuenta': ['Cuenta', 'Account', 'Conta', 'Akun', 'Akaun', 'Account', 'アカウント', 'บัญชี', 'Hesap', 'الحساب', 'Аккаунт', 'Акаунт', 'Compte', 'Konto'],
  'cu.para': ['Con tu cuenta jugás en multijugador y tu progreso queda guardado.', 'With an account you play multiplayer and your progress is saved.', 'Com uma conta você joga no multijogador e seu progresso fica salvo.', 'Dengan akun kamu bisa main multipemain dan progresmu tersimpan.', 'Dengan akaun anda boleh bermain berbilang pemain dan kemajuan anda disimpan.', 'Sa account, makakapaglaro ka ng multiplayer at naseseyb ang progreso mo.', 'アカウントがあればマルチプレイができ、進行状況が保存されます。', 'มีบัญชีแล้วเล่นผู้เล่นหลายคนได้และบันทึกความคืบหน้าไว้', 'Bir hesapla çok oyunculu oynar, ilerlemeni kaydedersin.', 'بحساب تلعب متعدد اللاعبين ويُحفظ تقدّمك.', 'С аккаунтом можно играть по сети, а прогресс сохраняется.', 'З акаунтом можна грати в мережі, а прогрес зберігається.', 'Avec un compte, tu joues en multijoueur et ta progression est sauvegardée.', 'Mit einem Konto spielst du im Mehrspielermodus und dein Fortschritt wird gespeichert.'],
  'cu.paraMulti': ['Para jugar en multijugador iniciá sesión.', 'Sign in to play multiplayer.', 'Para jogar no multijogador, entre na sua conta.', 'Masuk untuk bermain multipemain.', 'Log masuk untuk bermain berbilang pemain.', 'Mag-sign in para maglaro ng multiplayer.', 'マルチプレイにはログインしてください。', 'เข้าสู่ระบบเพื่อเล่นผู้เล่นหลายคน', 'Çok oyunculu oynamak için giriş yap.', 'سجّل الدخول للعب متعدد اللاعبين.', 'Войдите, чтобы играть по сети.', 'Увійдіть, щоб грати в мережі.', 'Connecte-toi pour jouer en multijoueur.', 'Melde dich an, um im Mehrspielermodus zu spielen.'],
  'cu.paraGuardar': ['Para guardar tu progreso iniciá sesión.', 'Sign in to save your progress.', 'Para salvar seu progresso, entre na sua conta.', 'Masuk untuk menyimpan progresmu.', 'Log masuk untuk menyimpan kemajuan anda.', 'Mag-sign in para maseyb ang progreso mo.', '進行状況を保存するにはログインしてください。', 'เข้าสู่ระบบเพื่อบันทึกความคืบหน้า', 'İlerlemeni kaydetmek için giriş yap.', 'سجّل الدخول لحفظ تقدّمك.', 'Войдите, чтобы сохранить прогресс.', 'Увійдіть, щоб зберегти прогрес.', 'Connecte-toi pour sauvegarder ta progression.', 'Melde dich an, um deinen Fortschritt zu speichern.'],
  'cu.esperando': ['Esperando a Google… Terminá de iniciar sesión en la página que se abrió y volvé al juego.', 'Waiting for Google… Finish signing in on the page that opened and come back to the game.', 'Esperando o Google… Termine de entrar na página que abriu e volte ao jogo.', 'Menunggu Google… Selesaikan masuk di halaman yang terbuka lalu kembali ke game.', 'Menunggu Google… Selesaikan log masuk di halaman yang dibuka dan kembali ke permainan.', 'Hinihintay ang Google… Tapusin ang pag-sign in sa pahinang bumukas at bumalik sa laro.', 'Googleを待っています… 開いたページでログインを終えてゲームに戻ってください。', 'กำลังรอ Google… ลงชื่อเข้าใช้ในหน้าที่เปิดขึ้นให้เสร็จแล้วกลับมาที่เกม', 'Google bekleniyor… Açılan sayfada girişi tamamla ve oyuna dön.', 'بانتظار Google… أكمل تسجيل الدخول في الصفحة التي فُتحت ثم عُد إلى اللعبة.', 'Ждём Google… Завершите вход на открывшейся странице и вернитесь в игру.', 'Чекаємо Google… Завершіть вхід на сторінці, що відкрилася, і поверніться до гри.', 'En attente de Google… Termine la connexion sur la page ouverte puis reviens au jeu.', 'Warte auf Google… Schließ die Anmeldung auf der geöffneten Seite ab und komm zurück ins Spiel.'],
  'cu.reabrir': ['Abrir de nuevo', 'Open again', 'Abrir de novo', 'Buka lagi', 'Buka semula', 'Buksan ulit', 'もう一度開く', 'เปิดอีกครั้ง', 'Tekrar aç', 'افتح مجددًا', 'Открыть снова', 'Відкрити знову', 'Rouvrir', 'Erneut öffnen'],
  'cu.ahoraNo': ['Ahora no', 'Not now', 'Agora não', 'Nanti saja', 'Bukan sekarang', 'Hindi muna', '後で', 'ไว้ทีหลัง', 'Şimdi değil', 'ليس الآن', 'Не сейчас', 'Не зараз', 'Pas maintenant', 'Nicht jetzt'],
  'cu.listo': ['Sesión iniciada: {n}', 'Signed in: {n}', 'Sessão iniciada: {n}', 'Sudah masuk: {n}', 'Telah log masuk: {n}', 'Naka-sign in: {n}', 'ログインしました: {n}', 'ลงชื่อเข้าใช้แล้ว: {n}', 'Giriş yapıldı: {n}', 'تم تسجيل الدخول: {n}', 'Вход выполнен: {n}', 'Вхід виконано: {n}', 'Connecté : {n}', 'Angemeldet: {n}'],
  'cu.salir': ['Cerrar sesión', 'Sign out', 'Sair', 'Keluar', 'Log keluar', 'Mag-sign out', 'ログアウト', 'ออกจากระบบ', 'Çıkış yap', 'تسجيل الخروج', 'Выйти', 'Вийти', 'Se déconnecter', 'Abmelden'],
  'cu.salio': ['Sesión cerrada', 'Signed out', 'Sessão encerrada', 'Sudah keluar', 'Telah log keluar', 'Naka-sign out na', 'ログアウトしました', 'ออกจากระบบแล้ว', 'Çıkış yapıldı', 'تم تسجيل الخروج', 'Вы вышли', 'Ви вийшли', 'Déconnecté', 'Abgemeldet'],
  'cu.sinc': ['Tu progreso se guarda en tu cuenta', 'Your progress is saved to your account', 'Seu progresso é salvo na sua conta', 'Progresmu tersimpan di akunmu', 'Kemajuan anda disimpan dalam akaun anda', 'Naseseyb ang progreso mo sa account mo', '進行状況はアカウントに保存されます', 'ความคืบหน้าถูกบันทึกในบัญชีของคุณ', 'İlerlemen hesabına kaydediliyor', 'يُحفظ تقدّمك في حسابك', 'Прогресс сохраняется в аккаунте', 'Прогрес зберігається в акаунті', 'Ta progression est sauvegardée sur ton compte', 'Dein Fortschritt wird in deinem Konto gespeichert'],
  'cu.vencio': ['Se venció el tiempo: probá de nuevo.', 'Timed out: please try again.', 'O tempo acabou: tente de novo.', 'Waktu habis: coba lagi.', 'Masa tamat: cuba lagi.', 'Nag-time out: subukan ulit.', '時間切れです。もう一度お試しください。', 'หมดเวลา ลองอีกครั้ง', 'Süre doldu: tekrar dene.', 'انتهى الوقت: حاول مجددًا.', 'Время вышло: попробуйте ещё раз.', 'Час вийшов: спробуйте ще раз.', 'Délai dépassé : réessaie.', 'Zeit abgelaufen: Versuch es noch einmal.'],
  'cu.lleno': ['Tu cuenta llegó al tope (4 MB): lo nuevo queda sólo en este aparato.', 'Your account is full (4 MB): new things stay only on this device.', 'Sua conta está cheia (4 MB): o novo fica só neste aparelho.', 'Akunmu penuh (4 MB): yang baru hanya ada di perangkat ini.', 'Akaun anda penuh (4 MB): yang baharu hanya di peranti ini.', 'Puno na ang account mo (4 MB): sa device na ito lang ang bago.', 'アカウントが上限(4 MB)です。新しいものはこの端末だけに残ります。', 'บัญชีเต็มแล้ว (4 MB): ของใหม่อยู่แค่ในเครื่องนี้', 'Hesabın doldu (4 MB): yeniler sadece bu cihazda kalır.', 'حسابك ممتلئ (4 MB): الجديد يبقى على هذا الجهاز فقط.', 'Аккаунт заполнен (4 МБ): новое остаётся только на этом устройстве.', 'Акаунт заповнено (4 МБ): нове лишається лише на цьому пристрої.', 'Ton compte est plein (4 Mo) : le nouveau reste sur cet appareil.', 'Dein Konto ist voll (4 MB): Neues bleibt nur auf diesem Gerät.'],
  'cu.mods': ['Tu cuenta tiene {n} addons que no están en este aparato ({mb}). ¿Bajarlos en segundo plano?', 'Your account has {n} addons that are not on this device ({mb}). Download them in the background?', 'Sua conta tem {n} addons que não estão neste aparelho ({mb}). Baixar em segundo plano?', 'Akunmu punya {n} addon yang tidak ada di perangkat ini ({mb}). Unduh di latar belakang?', 'Akaun anda ada {n} addon yang tiada di peranti ini ({mb}). Muat turun di latar belakang?', 'May {n} addon ang account mo na wala sa device na ito ({mb}). I-download sa background?', 'この端末にないアドオンが{n}個あります({mb})。バックグラウンドでダウンロードしますか？', 'บัญชีมีแอดออน {n} รายการที่ไม่มีในเครื่องนี้ ({mb}) ดาวน์โหลดเบื้องหลังไหม?', 'Hesabında bu cihazda olmayan {n} eklenti var ({mb}). Arka planda indirilsin mi?', 'في حسابك {n} إضافة ليست على هذا الجهاز ({mb}). هل تنزّلها في الخلفية؟', 'В аккаунте {n} аддонов, которых нет на этом устройстве ({mb}). Скачать в фоне?', 'В акаунті {n} аддонів, яких немає на цьому пристрої ({mb}). Завантажити у фоні?', 'Ton compte a {n} addons absents de cet appareil ({mb}). Les télécharger en arrière-plan ?', 'Dein Konto hat {n} Addons, die auf diesem Gerät fehlen ({mb}). Im Hintergrund herunterladen?'],
  'cu.bajar': ['Bajarlos', 'Download', 'Baixar', 'Unduh', 'Muat turun', 'I-download', 'ダウンロード', 'ดาวน์โหลด', 'İndir', 'تنزيل', 'Скачать', 'Завантажити', 'Télécharger', 'Herunterladen'],
  'cu.iniciar': ['Iniciar sesión', 'Sign in', 'Entrar', 'Masuk', 'Log masuk', 'Mag-sign in', 'ログイン', 'เข้าสู่ระบบ', 'Giriş yap', 'تسجيل الدخول', 'Войти', 'Увійти', 'Se connecter', 'Anmelden'],
  'cu.gmail': ['Entrar con tu Gmail', 'Sign in with your Gmail', 'Entrar com seu Gmail', 'Masuk dengan Gmail-mu', 'Log masuk dengan Gmail anda', 'Mag-sign in gamit ang Gmail mo', 'Gmailでログイン', 'เข้าสู่ระบบด้วย Gmail', 'Gmail ile giriş yap', 'الدخول عبر Gmail', 'Войти через Gmail', 'Увійти через Gmail', 'Se connecter avec ton Gmail', 'Mit deiner Gmail anmelden'],
  'cu.o': ['o', 'or', 'ou', 'atau', 'atau', 'o', 'または', 'หรือ', 'veya', 'أو', 'или', 'або', 'ou', 'oder'],
  'cu.mailPaso1': ['Escribí tu dirección de Gmail y te mandamos un código para entrar.', "Type your Gmail address and we'll send you a code to sign in.", 'Digite seu endereço do Gmail e enviaremos um código para entrar.', 'Tulis alamat Gmail-mu dan kami kirim kode untuk masuk.', 'Tulis alamat Gmail anda dan kami hantar kod untuk log masuk.', 'Isulat ang Gmail address mo at magpapadala kami ng code para mag-sign in.', 'Gmailアドレスを入力すると、ログイン用のコードを送ります。', 'พิมพ์ที่อยู่ Gmail แล้วเราจะส่งรหัสสำหรับเข้าสู่ระบบให้', 'Gmail adresini yaz, giriş için bir kod gönderelim.', 'اكتب عنوان Gmail وسنرسل لك رمزًا للدخول.', 'Введите адрес Gmail, и мы пришлём код для входа.', 'Введіть адресу Gmail, і ми надішлемо код для входу.', "Écris ton adresse Gmail et on t'envoie un code pour te connecter.", 'Gib deine Gmail-Adresse ein und wir schicken dir einen Code zum Anmelden.'],
  'cu.mandar': ['Mandarme el código', 'Send me the code', 'Enviar o código', 'Kirim kodenya', 'Hantar kod', 'Ipadala ang code', 'コードを送る', 'ส่งรหัส', 'Kodu gönder', 'أرسل الرمز', 'Прислать код', 'Надіслати код', 'Envoyer le code', 'Code senden'],
  'cu.novedades': ['Quiero recibir novedades y eventos por correo', 'I want news and events by email', 'Quero receber novidades e eventos por e-mail', 'Saya mau terima kabar dan event lewat email', 'Saya mahu terima berita dan acara melalui e-mel', 'Gusto kong makatanggap ng balita at events sa email', 'ニュースやイベントをメールで受け取る', 'ต้องการรับข่าวและกิจกรรมทางอีเมล', 'Haberleri ve etkinlikleri e-postayla almak istiyorum', 'أريد تلقي الأخبار والفعاليات عبر البريد', 'Хочу получать новости и события на почту', 'Хочу отримувати новини та події поштою', 'Je veux recevoir les nouveautés et événements par e-mail', 'Ich möchte Neuigkeiten und Events per E-Mail'],
  'cu.mailPaso2': ['Te mandamos un código a {c}. Si no llega en un minuto, mirá en Spam.', "We sent a code to {c}. If it doesn't arrive within a minute, check Spam.", 'Enviamos um código para {c}. Se não chegar em um minuto, olhe no Spam.', 'Kami kirim kode ke {c}. Kalau belum sampai dalam semenit, cek Spam.', 'Kami hantar kod ke {c}. Jika tiada dalam seminit, semak Spam.', 'Nagpadala kami ng code sa {c}. Kung wala pa sa isang minuto, tingnan ang Spam.', '{c} にコードを送りました。1分たっても届かない場合は迷惑メールを確認してください。', 'เราส่งรหัสไปที่ {c} แล้ว ถ้าไม่ได้รับภายในหนึ่งนาที ให้ดูในสแปม', '{c} adresine bir kod gönderdik. Bir dakika içinde gelmezse Spam klasörüne bak.', 'أرسلنا رمزًا إلى {c}. إن لم يصل خلال دقيقة فتحقق من البريد المزعج.', 'Мы отправили код на {c}. Если не придёт за минуту, проверьте «Спам».', 'Ми надіслали код на {c}. Якщо не прийде за хвилину, перевірте «Спам».', "On a envoyé un code à {c}. S'il n'arrive pas d'ici une minute, regarde dans les spams.", 'Wir haben einen Code an {c} geschickt. Kommt er nicht innerhalb einer Minute, schau im Spam nach.'],
  'cu.codigo': ['Código de 6 números', '6-digit code', 'Código de 6 números', 'Kode 6 angka', 'Kod 6 angka', '6-digit na code', '6桁のコード', 'รหัส 6 หลัก', '6 haneli kod', 'رمز من 6 أرقام', 'Код из 6 цифр', 'Код із 6 цифр', 'Code à 6 chiffres', '6-stelliger Code'],
  'cu.tuNombre': ['Tu nombre en el juego', 'Your name in the game', 'Seu nome no jogo', 'Namamu di game', 'Nama anda dalam permainan', 'Pangalan mo sa laro', 'ゲーム内の名前', 'ชื่อของคุณในเกม', 'Oyundaki adın', 'اسمك في اللعبة', 'Ваше имя в игре', "Ваше ім'я в грі", 'Ton nom dans le jeu', 'Dein Name im Spiel'],
  'cu.reenviar': ['Mandar otro código', 'Send another code', 'Enviar outro código', 'Kirim kode lain', 'Hantar kod lain', 'Magpadala ng ibang code', '別のコードを送る', 'ส่งรหัสใหม่', 'Yeni kod gönder', 'أرسل رمزًا آخر', 'Прислать другой код', 'Надіслати інший код', 'Envoyer un autre code', 'Neuen Code senden'],
  'cu.malGmail': ['Tiene que ser una dirección de Gmail (…@gmail.com).', 'It has to be a Gmail address (…@gmail.com).', 'Precisa ser um endereço do Gmail (…@gmail.com).', 'Harus alamat Gmail (…@gmail.com).', 'Mesti alamat Gmail (…@gmail.com).', 'Kailangang Gmail address (…@gmail.com).', 'Gmailアドレス（…@gmail.com）を入力してください。', 'ต้องเป็นที่อยู่ Gmail (…@gmail.com)', 'Bir Gmail adresi olmalı (…@gmail.com).', 'يجب أن يكون عنوان Gmail (…@gmail.com).', 'Нужен адрес Gmail (…@gmail.com).', 'Потрібна адреса Gmail (…@gmail.com).', 'Il faut une adresse Gmail (…@gmail.com).', 'Es muss eine Gmail-Adresse sein (…@gmail.com).'],
  'cu.malCodigo': ['Ese código no es. Te quedan {n} intentos.', 'That code is wrong. {n} tries left.', 'Esse código está errado. Restam {n} tentativas.', 'Kode salah. Sisa {n} percobaan.', 'Kod salah. Tinggal {n} percubaan.', 'Mali ang code. May {n} subok ka pa.', 'コードが違います。残り{n}回。', 'รหัสไม่ถูกต้อง เหลือ {n} ครั้ง', 'Kod yanlış. {n} deneme hakkın kaldı.', 'الرمز غير صحيح. تبقّى {n} محاولات.', 'Неверный код. Осталось попыток: {n}.', 'Невірний код. Залишилось спроб: {n}.', 'Code incorrect. Il te reste {n} essais.', 'Falscher Code. Noch {n} Versuche.'],
  'cu.vencioCodigo': ['Ese código ya no sirve: pedí otro.', 'That code expired: ask for a new one.', 'Esse código expirou: peça outro.', 'Kode kedaluwarsa: minta yang baru.', 'Kod tamat tempoh: minta yang baharu.', 'Expired na ang code: humingi ng bago.', 'コードの期限が切れました。新しいコードを送ってください。', 'รหัสหมดอายุแล้ว ขอรหัสใหม่', 'Kodun süresi doldu: yenisini iste.', 'انتهت صلاحية الرمز: اطلب رمزًا جديدًا.', 'Код устарел: запросите новый.', 'Код застарів: запросіть новий.', 'Ce code a expiré : demandes-en un autre.', 'Der Code ist abgelaufen: fordere einen neuen an.'],
  'cu.muchos': ['Muchos intentos: esperá unos minutos y probá de nuevo.', 'Too many tries: wait a few minutes and try again.', 'Muitas tentativas: espere alguns minutos e tente de novo.', 'Terlalu banyak percobaan: tunggu beberapa menit lalu coba lagi.', 'Terlalu banyak percubaan: tunggu beberapa minit dan cuba lagi.', 'Sobrang daming subok: maghintay ng ilang minuto at subukan ulit.', '試行回数が多すぎます。数分後にもう一度お試しください。', 'ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่', 'Çok fazla deneme: birkaç dakika bekleyip tekrar dene.', 'محاولات كثيرة: انتظر بضع دقائق ثم حاول مجددًا.', 'Слишком много попыток: подождите несколько минут.', 'Забагато спроб: зачекайте кілька хвилин.', "Trop d'essais : attends quelques minutes et réessaie.", 'Zu viele Versuche: warte ein paar Minuten.'],
  'cu.noSalio': ['No se pudo mandar el correo. Probá de nuevo en un rato.', 'Could not send the email. Try again in a while.', 'Não deu para enviar o e-mail. Tente de novo daqui a pouco.', 'Email gagal dikirim. Coba lagi nanti.', 'E-mel tidak dapat dihantar. Cuba lagi sebentar nanti.', 'Hindi naipadala ang email. Subukan ulit mamaya.', 'メールを送れませんでした。しばらくしてからもう一度お試しください。', 'ส่งอีเมลไม่สำเร็จ ลองใหม่อีกครั้งภายหลัง', 'E-posta gönderilemedi. Biraz sonra tekrar dene.', 'تعذّر إرسال البريد. حاول لاحقًا.', 'Не удалось отправить письмо. Попробуйте позже.', 'Не вдалося надіслати лист. Спробуйте пізніше.', "Impossible d'envoyer l'e-mail. Réessaie dans un moment.", 'Die E-Mail konnte nicht gesendet werden. Versuch es später nochmal.'],
  'cu.sinRed': ['No hay conexión con el servidor.', 'No connection to the server.', 'Sem conexão com o servidor.', 'Tidak ada koneksi ke server.', 'Tiada sambungan ke pelayan.', 'Walang koneksyon sa server.', 'サーバーに接続できません。', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'Sunucuya bağlanılamıyor.', 'لا يوجد اتصال بالخادم.', 'Нет связи с сервером.', "Немає зв'язку з сервером.", 'Pas de connexion au serveur.', 'Keine Verbindung zum Server.']
});

// ---------------- una pregunta de sí o no, con el estilo de los carteles de la cuenta ----------------
function confirmar(texto, okTxt, si) {
  let D = document.getElementById('cfDlg');
  if (!D) { D = document.createElement('div'); D.id = 'cfDlg'; D.className = 'oc'; document.body.appendChild(D); D.addEventListener('pointerdown', (e) => e.stopPropagation()); }
  D.innerHTML = `<div class="cuCaja"><p>${esc(texto)}</p><div class="cuBotones"><button class="cuBtn gris" data-cf="no">${esc(T('cancelar'))}</button><button class="cuBtn" data-cf="si">${esc(okTxt || 'OK')}</button></div></div>`;
  D.onclick = (e) => { e.stopPropagation(); const b = e.target.closest('[data-cf]'); if (!b && e.target !== D) return; D.className = 'oc'; if (b && b.dataset.cf === 'si' && si) si(); };
  D.className = '';
}
Object.assign(IDI3, {
  'ga.tit': ['Personalización del gorro', 'Hat customization', 'Personalização do chapéu', 'Kustomisasi topi', 'Penyesuaian topi', 'Pag-customize ng sombrero', '帽子のカスタマイズ', 'ปรับแต่งหมวก', 'Şapka özelleştirme', 'تخصيص القبعة', 'Настройка шляпы', 'Налаштування капелюха', 'Personnalisation du chapeau', 'Hut anpassen'],
  'ga.tam': ['Tamaño', 'Size', 'Tamanho', 'Ukuran', 'Saiz', 'Laki', 'サイズ', 'ขนาด', 'Boyut', 'الحجم', 'Размер', 'Розмір', 'Taille', 'Größe'],
  'ga.mover': ['Mover posición', 'Move position', 'Mover posição', 'Pindah posisi', 'Alih kedudukan', 'Ilipat ang posisyon', '位置を移動', 'เลื่อนตำแหน่ง', 'Konumu taşı', 'تحريك الموضع', 'Сдвинуть', 'Зсунути', 'Déplacer', 'Position verschieben'],
  'ga.color': ['Color del gorro', 'Hat color', 'Cor do chapéu', 'Warna topi', 'Warna topi', 'Kulay ng sombrero', '帽子の色', 'สีหมวก', 'Şapka rengi', 'لون القبعة', 'Цвет шляпы', 'Колір капелюха', 'Couleur du chapeau', 'Hutfarbe'],
  'ga.original': ['Original', 'Original', 'Original', 'Asli', 'Asal', 'Orihinal', 'オリジナル', 'ต้นฉบับ', 'Orijinal', 'الأصلي', 'Исходный', 'Початковий', 'Original', 'Original'],
  'ga.reset': ['Restablecer', 'Reset', 'Redefinir', 'Atur ulang', 'Set semula', 'I-reset', 'リセット', 'รีเซ็ต', 'Sıfırla', 'إعادة الضبط', 'Сбросить', 'Скинути', 'Réinitialiser', 'Zurücksetzen'],
  'pjm.importar': ['Importar personaje', 'Import character', 'Importar personagem', 'Impor karakter', 'Import watak', 'Mag-import ng karakter', 'キャラを読み込む', 'นำเข้าตัวละคร', 'Karakter içe aktar', 'استيراد شخصية', 'Импорт персонажа', 'Імпорт персонажа', 'Importer un personnage', 'Charakter importieren'],
  'pjm.seguro': ['¿Seguro que querés instalar «{n}»? ({mb})', 'Are you sure you want to install “{n}”? ({mb})', 'Tem certeza de que quer instalar «{n}»? ({mb})', 'Yakin mau memasang “{n}”? ({mb})', 'Pasti mahu memasang “{n}”? ({mb})', 'Sigurado ka bang i-install ang “{n}”? ({mb})', '「{n}」をインストールしますか？({mb})', 'แน่ใจไหมว่าจะติดตั้ง “{n}”? ({mb})', '“{n}” kurulsun mu? ({mb})', 'هل تريد تثبيت «{n}»؟ ({mb})', 'Установить «{n}»? ({mb})', 'Встановити «{n}»? ({mb})', 'Installer « {n} » ? ({mb})', '„{n}“ wirklich installieren? ({mb})']
});
