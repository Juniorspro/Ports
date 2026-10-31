// ---------------------------------------------------------------------------------------------------------
// controles: teclado y mouse (con el puntero trabado) o pantalla táctil (palanca, zona para mirar y botones)
// ---------------------------------------------------------------------------------------------------------
const ENT = { x: 0, y: 0, saltar: false, agachar: false, correr: false, disparo: false, disparo2: false, usar: false,
  dx: 0, dy: 0, teclas: new Set(), sens: 0.0022, sensT: 0.006, rueda: 0, tactil: COARSE, bloqueado: false, pulsos: [] };
const pulso = (k) => ENT.pulsos.push(k);
function entradaIniciar() {
  const cv = R.cv;
  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) { if (e.code === 'Escape' || e.code === 'Enter') { pulso(e.code === 'Enter' ? 'enviar' : 'cerrar'); } return; }
    if (e.repeat) return;
    ENT.teclas.add(e.code);
    const m = { Tab: 'menu', KeyQ: 'menu', KeyE: 'usar', KeyF: 'salir', KeyR: 'recargar', KeyT: 'chat', KeyP: 'pausa', Escape: 'pausa', KeyV: 'camara', KeyB: 'emotes', KeyZ: 'deshacer', KeyN: 'noclip', KeyC: 'camara', KeyM: 'servmods', KeyU: 'modmenu', KeyG: 'fncam', KeyL: 'linterna' };
    if (m[e.code]) { pulso(m[e.code]); e.preventDefault(); }
    if (/^Digit[1-9]$/.test(e.code)) pulso('arma' + e.code.slice(5));
  });
  addEventListener('keyup', (e) => ENT.teclas.delete(e.code));
  addEventListener('blur', () => ENT.teclas.clear());
  cv.addEventListener('mousedown', (e) => {
    if (ENT.tactil) return;
    if (!ENT.bloqueado && JUEGO.estado === 'juego' && !UI.abierto) { cv.requestPointerLock && cv.requestPointerLock(); return; }
    if (e.button === 0) ENT.disparo = true; if (e.button === 2) ENT.disparo2 = true;
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) ENT.disparo = false; if (e.button === 2) ENT.disparo2 = false; });
  addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { ENT.bloqueado = document.pointerLockElement === cv; if (!ENT.bloqueado) { ENT.disparo = ENT.disparo2 = false; } });
  addEventListener('mousemove', (e) => { if (ENT.bloqueado) { ENT.dx += e.movementX; ENT.dy += e.movementY; } });
  addEventListener('wheel', (e) => { if (JUEGO.estado === 'juego' && !UI.abierto) ENT.rueda += Math.sign(e.deltaY); }, { passive: true });
  tactilIniciar();
}
// ---------------- pantalla horizontal ----------------
// El juego es horizontal como el original. En un celular parado: al tocar se pide pantalla completa y trabar
// la orientación; si el navegador no deja (iPhone, o sin pantalla completa) se gira todo 90° con CSS y los
// toques se pasan a las coordenadas giradas.
const PANT = { rot: false, pedido: false, enIntro: !TEST };
const VW = () => (PANT.rot ? innerHeight : innerWidth), VH = () => (PANT.rot ? innerWidth : innerHeight);
const tX = (t) => (PANT.rot ? t.clientY : t.clientX), tY = (t) => (PANT.rot ? innerWidth - t.clientX : t.clientY);
function pantallaRevisar() {
  // también durante la intro (el lienzo de la intro se dibuja derecho dentro de la página girada)
  const rot = COARSE && innerHeight > innerWidth * 1.05 && !Q.get('sinGiro');
  PANT.rot = rot; document.documentElement.classList.toggle('rot', rot);
  const b = document.body.style;
  if (rot) { b.width = innerHeight + 'px'; b.height = innerWidth + 'px'; } else { b.width = ''; b.height = ''; }
  const r = document.documentElement.style; r.setProperty('--vw', VW() / 100 + 'px'); r.setProperty('--vh', VH() / 100 + 'px');
  if (R.cv) redimensionar();
  if (typeof menuEscala === 'function') menuEscala();
}
function pantallaIniciar() {
  pantallaRevisar();
  addEventListener('resize', pantallaRevisar);
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', () => setTimeout(pantallaRevisar, 60));
  const pedir = () => {
    if (!COARSE || PANT.pedido || document.fullscreenElement) return;
    PANT.pedido = true;
    const trabar = () => { try { screen.orientation.lock('landscape').then(() => setTimeout(pantallaRevisar, 120)).catch(() => {}); } catch (e) {} };
    const d = document.documentElement;
    if (d.requestFullscreen) d.requestFullscreen({ navigationUI: 'hide' }).then(trabar).catch(trabar); else trabar();
  };
  addEventListener('touchend', pedir); addEventListener('click', pedir);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) PANT.pedido = false; setTimeout(pantallaRevisar, 120); });
}
// ---------------- táctil ----------------
const TOQ = { palanca: null, mira: null };
function tactilIniciar() {
  const zona = $('toque'), pal = $('palanca'), bola = $('palbola');
  // en un teléfono o tablet (sólo táctil) los controles de la pantalla ya desde el principio, sin esperar el primer toque
  // (si no, primero se veía la fila de la compu con las teclas)
  if (COARSE && !matchMedia('(pointer: fine)').matches) { ENT.tactil = true; document.body.classList.add('tactil'); }
  const fin = (id) => {
    if (TOQ.palanca && TOQ.palanca.id === id) { TOQ.palanca = null; ENT.x = ENT.y = 0; bola.style.transform = ''; pal.classList.remove('activa'); }
    if (TOQ.mira && TOQ.mira.id === id) TOQ.mira = null;
  };
  // (changedTouches trae los dedos que cambiaron en toda la pantalla, no sólo los de este elemento: cada uno atiende
  // sólo los suyos; si no, mover la palanca mientras se mantiene el disparo daba vuelta la cámara)
  zona.addEventListener('touchstart', (e) => {
    ENT.tactil = true; document.body.classList.add('tactil');
    for (const t of e.changedTouches) {
      if (t.target !== zona) continue;
      if (tX(t) < VW() * 0.4 && !TOQ.palanca) {
        TOQ.palanca = { id: t.identifier, x: tX(t), y: tY(t) };
        const m = (HUD.pal || 120) / 2; pal.style.left = tX(t) - m + 'px'; pal.style.top = tY(t) - m + 'px'; pal.classList.add('activa');
      } else if (!TOQ.mira) TOQ.mira = { id: t.identifier, x: tX(t), y: tY(t) };
    }
    e.preventDefault();
  }, { passive: false });
  zona.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (TOQ.palanca && t.identifier === TOQ.palanca.id) {
        // (el radio y el recorrido de la bolita siguen el tamaño de la palanca: 50 y 45 con la de 120)
        const P = HUD.pal || 120; let dx = (tX(t) - TOQ.palanca.x) / (P * 0.42), dy = (tY(t) - TOQ.palanca.y) / (P * 0.42); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        ENT.x = dx; ENT.y = -dy; ENT.correr = l > 1.6; bola.style.transform = `translate(${dx * P * 0.375}px,${dy * P * 0.375}px)`;
      } else if (TOQ.mira && t.identifier === TOQ.mira.id) {
        ENT.dx += (tX(t) - TOQ.mira.x) * (ENT.sensT / ENT.sens); ENT.dy += (tY(t) - TOQ.mira.y) * (ENT.sensT / ENT.sens);
        TOQ.mira.x = tX(t); TOQ.mira.y = tY(t);
      }
    }
    e.preventDefault();
  }, { passive: false });
  zona.addEventListener('touchend', (e) => { for (const t of e.changedTouches) fin(t.identifier); });
  zona.addEventListener('touchcancel', (e) => { for (const t of e.changedTouches) fin(t.identifier); });
  // botones: los que se mantienen (disparo, salto) y los de un toque
  for (const b of document.querySelectorAll('[data-btn]')) botonTactil(b);
  // el disparo táctil también deja mirar mientras se mantiene (sólo con el dedo que lo apretó)
  const bd = $('bdisparo');
  if (bd) {
    bd.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) if (bd.contains(t.target)) bd._u = { id: t.identifier, x: tX(t), y: tY(t) }; }, { passive: false });
    bd.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (!bd._u || t.identifier !== bd._u.id) continue;
        ENT.dx += (tX(t) - bd._u.x) * (ENT.sensT / ENT.sens); ENT.dy += (tY(t) - bd._u.y) * (ENT.sensT / ENT.sens); bd._u.x = tX(t); bd._u.y = tY(t);
      }
      e.preventDefault();
    }, { passive: false });
    const suelta = (e) => { for (const t of e.changedTouches) if (bd._u && t.identifier === bd._u.id) bd._u = null; };
    bd.addEventListener('touchend', suelta); bd.addEventListener('touchcancel', suelta);
  }
}
// un botón: los que se mantienen (disparo, salto, pedales) y los de un toque
function botonTactil(b) {
  if (b._bt) return; b._bt = 1;
  const k = b.dataset.btn, mantener = b.dataset.mantener !== undefined;
  b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); ENT.tactil = true; b.classList.add('ap'); if (mantener) ENT[k] = true; else pulso(k); }, { passive: false });
  const sol = (e) => { e.preventDefault(); b.classList.remove('ap'); if (mantener) ENT[k] = false; };
  b.addEventListener('touchend', sol, { passive: false }); b.addEventListener('touchcancel', sol, { passive: false });
  b.addEventListener('click', (e) => { if (!ENT.tactil && !mantener) pulso(k); });
}
function entradaLeer() {
  const T = ENT.teclas;
  if (!ENT.tactil || T.size) {
    ENT.x = (T.has('KeyD') ? 1 : 0) - (T.has('KeyA') ? 1 : 0);
    ENT.y = (T.has('KeyW') ? 1 : 0) - (T.has('KeyS') ? 1 : 0);
    ENT.saltar = T.has('Space'); ENT.agachar = T.has('ControlLeft') || T.has('KeyC') && false; ENT.correr = T.has('ShiftLeft') || T.has('ShiftRight');
    if (T.has('ControlLeft')) ENT.agachar = true;
  }
  // en un vehículo con los pedales y las flechas de la pantalla (si no se usa la palanca)
  if (ENT.tactil && JUG.vehiculo && !TOQ.palanca && !T.size) { ENT.y = (ENT.pGas ? 1 : 0) - (ENT.pFreno ? 1 : 0); ENT.x = (ENT.pDer ? 1 : 0) - (ENT.pIzq ? 1 : 0); }
}
