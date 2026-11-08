// ---------------- la cuenta de Google: para jugar en multijugador y guardar el progreso ----------------
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
const cuRequerida = () => !!(CU.conf && CU.conf.google);
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
async function cuentaEntrar(despues) {
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
      CU.token = j.token; CU.u = j.usuario || null; CU.espera = null; clearInterval(CU.tPreg); cuGuardarSesion(); try { CU.del0('jx_cu_espera'); } catch (er) {}
      cuDialogoCerrar(); cuAviso(T('cu.listo').replace('{n}', (CU.u && CU.u.nombre) || '')); cuentaPintar();
      // (lo que se hizo sin sesión en este aparato también va a la cuenta, si en la cuenta no hay algo más nuevo)
      for (const k of cuClavesLocales()) if (!CU.f[k]) { CU.f[k] = 1; CU.sucio.add(k); }
      // (lo que se quería hacer, ya; la copia con la cuenta va atrás: lo recién hecho tiene la hora más nueva y gana)
      if (typeof socIniciar === 'function') socIniciar();
      if (E.despues) try { E.despues(); } catch (er) { console.error(er); }
      cuSincronizar(true);
    } else if (j && j.vencido) { cuCancelar(); cuAviso(T('cu.vencio')); }
  } catch (e) {} finally { CU.preguntando = false; }
}
function cuCancelar() { CU.espera = null; clearInterval(CU.tPreg); cuDialogoCerrar(); try { CU.del0('jx_cu_espera'); } catch (e) {} }
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
  const A = typeof RB !== 'undefined' && RB.el && RB.el.querySelector('.rbAbajo'); if (!A) return;
  let b = A.querySelector('.cuChip'); if (!cuRequerida() && !cuDentro()) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement('button'); b.className = 'rbChipG cuChip'; b.dataset.rb = 'cuenta'; A.prepend(b); }
  b.innerHTML = cuDentro() ? `${CU.u && CU.u.foto ? `<img class="cuFoto" src="${esc(CU.u.foto)}" alt="" referrerpolicy="no-referrer">` : glifo('persona')} ${esc((CU.u && CU.u.nombre) || T('cu.cuenta'))}` : `${CU_G} ${esc(T('cu.entrar'))}`;
}
const CU_G = '<svg class="cuG" viewBox="0 0 48 48" width="1.15em" height="1.15em" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
function cuAviso(t) { if (typeof JUEGO !== 'undefined' && JUEGO.estado === 'juego' && typeof aviso === 'function' && !(typeof rbVisible === 'function' && rbVisible())) aviso(t, 3.5); else if (typeof menuAviso === 'function') menuAviso(t); }
function cuCaja() {
  let D = document.getElementById('cuDlg');
  if (!D) {
    D = document.createElement('div'); D.id = 'cuDlg'; D.className = 'oc'; document.body.appendChild(D);
    D.addEventListener('pointerdown', (e) => e.stopPropagation());
    D.addEventListener('click', (e) => {
      e.stopPropagation(); const b = e.target.closest('[data-cu]'); if (!b) { if (e.target === D && !CU.espera) cuDialogoCerrar(); return; }
      const a = b.dataset.cu;
      if (a === 'entrar') cuentaEntrar(CU.siguiente);
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
      <p>${esc(T('cu.sinc'))}${CU.ult ? ' · ' + new Date(CU.ult).toLocaleTimeString() : ''}</p>
      <div class="cuBotones"><button class="cuBtn gris" data-cu="no">${esc(T('volver'))}</button><button class="cuBtn rojo" data-cu="salir">${esc(T('cu.salir'))}</button></div>`;
  else h = `<h3>${esc(T('cu.cuenta'))}</h3><p>${esc(T(CU.motivo === 'multi' ? 'cu.paraMulti' : CU.motivo === 'guardar' ? 'cu.paraGuardar' : 'cu.para'))}</p>
      <button class="cuGoogle" data-cu="entrar">${CU_G}<span>${esc(T('cu.entrar'))}</span></button>
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
    <div class="cuPanel"><p>${esc(T('cu.paraMulti'))}</p><button class="cuGoogle" data-rb="cuentaEntrar">${CU_G}<span>${esc(T('cu.entrar'))}</span></button></div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">${glifo('atras')} ${esc(T('volver'))}</button></div>`;
}

// ---------------- textos (es, en, pt, id, ms, fil, ja, th, tr, ar, ru, uk, fr, de) ----------------
Object.assign(IDI3, {
  'cu.entrar': ['Iniciar sesión con Google', 'Sign in with Google', 'Entrar com o Google', 'Masuk dengan Google', 'Log masuk dengan Google', 'Mag-sign in gamit ang Google', 'Googleでログイン', 'ลงชื่อเข้าใช้ด้วย Google', 'Google ile giriş yap', 'تسجيل الدخول باستخدام Google', 'Войти через Google', 'Увійти через Google', 'Se connecter avec Google', 'Mit Google anmelden'],
  'cu.cuenta': ['Cuenta', 'Account', 'Conta', 'Akun', 'Akaun', 'Account', 'アカウント', 'บัญชี', 'Hesap', 'الحساب', 'Аккаунт', 'Акаунт', 'Compte', 'Konto'],
  'cu.para': ['Con tu cuenta de Google jugás en multijugador y tu progreso queda guardado.', 'With your Google account you play multiplayer and your progress is saved.', 'Com sua conta Google você joga no multijogador e seu progresso fica salvo.', 'Dengan akun Google kamu bisa main multipemain dan progresmu tersimpan.', 'Dengan akaun Google anda bermain berbilang pemain dan kemajuan anda disimpan.', 'Sa Google account mo, makakapaglaro ka ng multiplayer at naseseyb ang progreso mo.', 'Googleアカウントでマルチプレイができ、進行状況が保存されます。', 'ใช้บัญชี Google เพื่อเล่นผู้เล่นหลายคนและบันทึกความคืบหน้า', 'Google hesabınla çok oyunculu oynar, ilerlemeni kaydedersin.', 'بحساب Google تلعب متعدد اللاعبين ويُحفظ تقدّمك.', 'С аккаунтом Google можно играть по сети, а прогресс сохраняется.', 'З акаунтом Google можна грати в мережі, а прогрес зберігається.', 'Avec ton compte Google, tu joues en multijoueur et ta progression est sauvegardée.', 'Mit deinem Google-Konto spielst du im Mehrspielermodus und dein Fortschritt wird gespeichert.'],
  'cu.paraMulti': ['Para jugar en multijugador iniciá sesión con tu cuenta de Google.', 'Sign in with your Google account to play multiplayer.', 'Para jogar no multijogador, entre com sua conta Google.', 'Masuk dengan akun Google untuk bermain multipemain.', 'Log masuk dengan akaun Google untuk bermain berbilang pemain.', 'Mag-sign in gamit ang Google account mo para makapaglaro ng multiplayer.', 'マルチプレイするにはGoogleアカウントでログインしてください。', 'ลงชื่อเข้าใช้ด้วยบัญชี Google เพื่อเล่นผู้เล่นหลายคน', 'Çok oyunculu oynamak için Google hesabınla giriş yap.', 'سجّل الدخول بحساب Google لتلعب متعدد اللاعبين.', 'Чтобы играть по сети, войдите через аккаунт Google.', 'Щоб грати в мережі, увійдіть через акаунт Google.', 'Connecte-toi avec ton compte Google pour jouer en multijoueur.', 'Melde dich mit deinem Google-Konto an, um im Mehrspielermodus zu spielen.'],
  'cu.paraGuardar': ['Para guardar tu progreso iniciá sesión con tu cuenta de Google.', 'Sign in with your Google account to save your progress.', 'Para salvar seu progresso, entre com sua conta Google.', 'Masuk dengan akun Google untuk menyimpan progresmu.', 'Log masuk dengan akaun Google untuk menyimpan kemajuan anda.', 'Mag-sign in gamit ang Google account mo para maseyb ang progreso mo.', '進行状況を保存するにはGoogleアカウントでログインしてください。', 'ลงชื่อเข้าใช้ด้วยบัญชี Google เพื่อบันทึกความคืบหน้า', 'İlerlemeni kaydetmek için Google hesabınla giriş yap.', 'سجّل الدخول بحساب Google لحفظ تقدّمك.', 'Чтобы сохранить прогресс, войдите через аккаунт Google.', 'Щоб зберегти прогрес, увійдіть через акаунт Google.', 'Connecte-toi avec ton compte Google pour sauvegarder ta progression.', 'Melde dich mit deinem Google-Konto an, um deinen Fortschritt zu speichern.'],
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
  'cu.bajar': ['Bajarlos', 'Download', 'Baixar', 'Unduh', 'Muat turun', 'I-download', 'ダウンロード', 'ดาวน์โหลด', 'İndir', 'تنزيل', 'Скачать', 'Завантажити', 'Télécharger', 'Herunterladen']
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
