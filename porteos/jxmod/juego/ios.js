// ---------------- iPhone y iPad (Safari, y la app web instalada con «Agregar a inicio») ----------------
// En iOS no hay APK: el juego se instala como app web (web/index.html con su manifiesto y su service worker, que la deja
// andar sin internet). Acá va lo que Safari necesita distinto:
//  - el gesto de pellizcar no hace zoom en la página (Safari no respeta user-scalable=no en el navegador);
//  - el sonido suena aunque el iPhone esté en silencio (el audio de los juegos va como «reproducción», no como timbre);
//  - lo guardado (mods, mapas, partidas) se pide como permanente para que el sistema no lo borre;
//  - en Safari sin instalar, un aviso de cómo instalarla (Compartir → «Agregar a inicio»), una vez.
const IOS = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const IOS_IPAD = IOS && !/iPhone|iPod/.test(navigator.userAgent || '');
const IOS_INSTALADA = typeof navigator !== 'undefined' && (!!window.JX_IOS_APP || navigator.standalone === true || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches));
function iosIniciar() {
  if (!IOS) return;
  document.documentElement.classList.add('ios');
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  // (el doble toque ya no hace zoom: touch-action:none en toda la página, plantilla)
  const primero = () => {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}
    removeEventListener('pointerdown', primero, true);
  };
  addEventListener('pointerdown', primero, true);
  if (typeof JX_APPWEB !== 'undefined' && !IOS_INSTALADA) setTimeout(iosAvisoInstalar, 4000);
}
function iosAvisoInstalar() {
  try { const v = +localStorage.getItem('jx_ios_aviso') || 0; if (Date.now() - v < 3 * 864e5) return; } catch (e) {}
  const d = document.createElement('div'); d.id = 'iosInst';
  d.style.cssText = 'position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);transform:translateX(-50%);z-index:100001;width:min(92vw,440px);background:rgba(22,24,30,.96);color:#fff;border:1px solid rgba(255,206,110,.45);border-radius:14px;padding:12px 14px;font:14px system-ui,-apple-system,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.5);display:flex;gap:10px;align-items:center';
  const compartir = '<svg width="18" height="22" viewBox="0 0 18 22" style="vertical-align:-4px"><path d="M9 1v13M4.5 5.5 9 1l4.5 4.5M3 9H1.5v11.5h15V9H15" fill="none" stroke="#4aa3ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  d.innerHTML = '<div style="flex:1;line-height:1.35"><b>' + esc(Lc('Install JXMod', 'Instalá JXMod')) + '</b><br>' + Lc('Tap', 'Tocá') + ' ' + compartir + ' ' + esc(Lc('Share and then «Add to Home Screen». It opens full screen and works offline.', 'Compartir y después «Agregar a inicio». Se abre a pantalla completa y anda sin internet.')) + '</div>'
    + '<button style="border:0;background:#333a46;color:#fff;border-radius:8px;padding:8px 11px;font-weight:600">' + esc(Lc('OK', 'Listo')) + '</button>';
  d.querySelector('button').onclick = () => { d.remove(); try { localStorage.setItem('jx_ios_aviso', String(Date.now())); } catch (e) {} };
  document.body.appendChild(d);
}
// (la calidad de entrada: Safari no dice cuánta memoria tiene el aparato; un iPhone arranca en Medio —la resolución
// dinámica sube o baja según cómo ande— y un iPad, en Alto)
function iosPerfil() { return IOS_IPAD ? 'alto' : 'medio'; }
