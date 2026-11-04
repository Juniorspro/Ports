// ---------------- el arma en la mano, a gusto (idea de Discord: «personalizar cómo querés agarrar el arma») ----------------
// En la pausa, «Arma en la mano»: con el arma que tenés en primera persona, cuatro barras —adelante/atrás, a los costados,
// arriba/abajo y el giro— que la mueven al momento y quedan guardadas para esa arma (PREFS.armaAj). Apuntando no cuentan:
// ahí el arma va a la mira (vistaAds).
const ARMAJ_LIM = { z: 0.12, x: 0.1, y: 0.1, g: 25 };   // (metros en el espacio de la cámara; el giro, en grados)
function armaAjDe(n) { const a = n && PREFS.armaAj && PREFS.armaAj[n]; return a && typeof a === 'object' && (a.x || a.y || a.z || a.g) ? a : null; }
// el corrimiento del arma de primera persona (en vistaUbicar), apagándose al apuntar
const _aaQ = new Quat(), _aaM = new Float32Array(16), _aaN = new Float32Array(16);
function armaAjAplicar(M, k) {
  const n = typeof ARM !== 'undefined' ? ARM.lista[ARM.i] : null, a = armaAjDe(n); if (!a) return;
  const f = 1 - (k || 0); if (f <= 0.001) return;
  // (en el espacio de la cámara la derecha de la pantalla es -x: Costado y Giro positivos van a la derecha)
  const g = -clamp(+a.g || 0, -ARMAJ_LIM.g, ARMAJ_LIM.g) * Math.PI / 180 * f; _aaQ.set(0, Math.sin(g / 2), 0, Math.cos(g / 2));
  m4trs([-clamp(+a.x || 0, -ARMAJ_LIM.x, ARMAJ_LIM.x) * f, clamp(+a.y || 0, -ARMAJ_LIM.y, ARMAJ_LIM.y) * f, clamp(+a.z || 0, -ARMAJ_LIM.z, ARMAJ_LIM.z) * f], [_aaQ.x, _aaQ.y, _aaQ.z, _aaQ.w], [1, 1, 1], _aaM);
  m4mul(M, _aaM, _aaN); M.set(_aaN);
}
function armaAjPanel() {
  let p = document.getElementById('armaAjPan'); if (p) return p;
  p = document.createElement('div'); p.id = 'armaAjPan'; p.className = 'oc';
  const fila = (k) => `<label class="aaFila"><span data-aat="${k}"></span><input type="range" data-aa="${k}" min="-1" max="1" step="0.02" value="0"><b data-aav="${k}"></b></label>`;
  p.innerHTML = `<div class="aaCab"><b class="aaTit"></b><button class="emuX" data-aab="listo" aria-label="x">×</button></div>${['z', 'x', 'y', 'g'].map(fila).join('')}
    <div class="aaBot"><button class="boton" data-aab="cero"></button><button class="boton azul" data-aab="listo"></button></div>`;
  document.body.appendChild(p);
  p.addEventListener('pointerdown', (ev) => ev.stopPropagation()); p.addEventListener('touchstart', (ev) => ev.stopPropagation(), { passive: true });
  p.oninput = (ev) => {
    const i = ev.target.closest('[data-aa]'); if (!i) return; const n = ARM.lista[ARM.i]; if (!n) return;
    PREFS.armaAj = PREFS.armaAj || {}; const a = PREFS.armaAj[n] || (PREFS.armaAj[n] = { x: 0, y: 0, z: 0, g: 0 });
    a[i.dataset.aa] = +(+i.value * ARMAJ_LIM[i.dataset.aa]).toFixed(i.dataset.aa === 'g' ? 1 : 3); armaAjPintar();
  };
  p.onclick = (ev) => {
    const b = ev.target.closest('[data-aab]'); if (!b) return;
    if (b.dataset.aab === 'cero') { const n = ARM.lista[ARM.i]; if (PREFS.armaAj) delete PREFS.armaAj[n]; armaAjPintar(); }
    else armaAjCerrar();
  };
  return p;
}
function armaAjPintar() {
  const p = document.getElementById('armaAjPan'); if (!p) return; const n = ARM.lista[ARM.i], a = (PREFS.armaAj && PREFS.armaAj[n]) || {};
  p.querySelector('.aaTit').textContent = T('aa.titulo') + ' · ' + (typeof nombreArma === 'function' ? nombreArma(n) : n);
  for (const k of ['z', 'x', 'y', 'g']) {
    const v = +a[k] || 0; p.querySelector(`[data-aa="${k}"]`).value = String(v / ARMAJ_LIM[k]);
    p.querySelector(`[data-aat="${k}"]`).textContent = T('aa.' + k);
    p.querySelector(`[data-aav="${k}"]`).textContent = k === 'g' ? Math.round(v) + '°' : (v >= 0 ? '+' : '') + Math.round(v * 100) + ' cm';
  }
  p.querySelector('[data-aab="cero"]').textContent = T('aa.cero'); p.querySelectorAll('[data-aab="listo"]')[1].textContent = T('aa.listo');
}
function armaAjAbrir() {
  const n = ARM.lista[ARM.i];
  if (!ARM.v || JUG.tercera || !n) { aviso(T('aa.sinArma'), 2.5); return; }
  if (typeof cerrarPaneles === 'function') cerrarPaneles();
  armaAjPanel().classList.remove('oc'); armaAjPintar(); UI.abierto = 'armaAj'; document.body.classList.add('armaAjOn');
  if (typeof soltarPuntero === 'function') soltarPuntero();
}
function armaAjCerrar() {
  const p = document.getElementById('armaAjPan'); if (p) p.classList.add('oc'); document.body.classList.remove('armaAjOn');
  if (UI.abierto === 'armaAj') UI.abierto = null; guardarPrefs();
}
