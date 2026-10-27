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
    const m = { Tab: 'menu', KeyQ: 'menu', KeyE: 'usar', KeyF: 'salir', KeyR: 'recargar', KeyT: 'chat', KeyP: 'pausa', Escape: 'pausa', KeyV: 'camara', KeyB: 'emotes', KeyZ: 'deshacer', KeyN: 'noclip', KeyC: 'camara' };
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
// ---------------- táctil ----------------
const TOQ = { palanca: null, mira: null };
function tactilIniciar() {
  const zona = $('toque'), pal = $('palanca'), bola = $('palbola');
  const fin = (id) => {
    if (TOQ.palanca && TOQ.palanca.id === id) { TOQ.palanca = null; ENT.x = ENT.y = 0; bola.style.transform = ''; pal.classList.remove('activa'); }
    if (TOQ.mira && TOQ.mira.id === id) TOQ.mira = null;
  };
  zona.addEventListener('touchstart', (e) => {
    ENT.tactil = true; document.body.classList.add('tactil');
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.4 && !TOQ.palanca) {
        TOQ.palanca = { id: t.identifier, x: t.clientX, y: t.clientY };
        pal.style.left = t.clientX - 60 + 'px'; pal.style.top = t.clientY - 60 + 'px'; pal.classList.add('activa');
      } else if (!TOQ.mira) TOQ.mira = { id: t.identifier, x: t.clientX, y: t.clientY };
    }
    e.preventDefault();
  }, { passive: false });
  zona.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (TOQ.palanca && t.identifier === TOQ.palanca.id) {
        let dx = (t.clientX - TOQ.palanca.x) / 50, dy = (t.clientY - TOQ.palanca.y) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        ENT.x = dx; ENT.y = -dy; ENT.correr = l > 1.6; bola.style.transform = `translate(${dx * 45}px,${dy * 45}px)`;
      } else if (TOQ.mira && t.identifier === TOQ.mira.id) {
        ENT.dx += (t.clientX - TOQ.mira.x) * (ENT.sensT / ENT.sens); ENT.dy += (t.clientY - TOQ.mira.y) * (ENT.sensT / ENT.sens);
        TOQ.mira.x = t.clientX; TOQ.mira.y = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  zona.addEventListener('touchend', (e) => { for (const t of e.changedTouches) fin(t.identifier); });
  zona.addEventListener('touchcancel', (e) => { for (const t of e.changedTouches) fin(t.identifier); });
  // botones: los que se mantienen (disparo, salto) y los de un toque
  for (const b of document.querySelectorAll('[data-btn]')) {
    const k = b.dataset.btn, mantener = b.dataset.mantener !== undefined;
    b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); ENT.tactil = true; b.classList.add('ap'); if (mantener) ENT[k] = true; else pulso(k); }, { passive: false });
    const sol = (e) => { e.preventDefault(); b.classList.remove('ap'); if (mantener) ENT[k] = false; };
    b.addEventListener('touchend', sol, { passive: false }); b.addEventListener('touchcancel', sol, { passive: false });
    b.addEventListener('click', (e) => { if (!ENT.tactil && !mantener) pulso(k); });
  }
  // el disparo táctil también deja mirar mientras se mantiene
  const bd = $('bdisparo');
  if (bd) bd.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) { if (bd._u) { ENT.dx += (t.clientX - bd._u.x) * (ENT.sensT / ENT.sens); ENT.dy += (t.clientY - bd._u.y) * (ENT.sensT / ENT.sens); } bd._u = { x: t.clientX, y: t.clientY }; } e.preventDefault(); }, { passive: false });
  if (bd) bd.addEventListener('touchend', () => (bd._u = null));
}
function entradaLeer() {
  const T = ENT.teclas;
  if (!ENT.tactil || T.size) {
    ENT.x = (T.has('KeyD') ? 1 : 0) - (T.has('KeyA') ? 1 : 0);
    ENT.y = (T.has('KeyW') ? 1 : 0) - (T.has('KeyS') ? 1 : 0);
    ENT.saltar = T.has('Space'); ENT.agachar = T.has('ControlLeft') || T.has('KeyC') && false; ENT.correr = T.has('ShiftLeft') || T.has('ShiftRight');
    if (T.has('ControlLeft')) ENT.agachar = true;
  }
}
