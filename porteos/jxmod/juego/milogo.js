// ---------------- tu propio logo (idea de Discord: «poner nuestro propio logo») ----------------
// En Ajustes → «Tu logo»: elegís una imagen del aparato y pasa a ser el logo del juego (el de la pantalla de carga, el del
// menú y el de la bienvenida; la pantalla de carga lo pone antes que nada, ver template.html; la intro es la de JXStudios). En la app,
// «Acceso directo» pone en la pantalla de inicio un ícono con tu logo y el nombre que quieras (Android 8 o más nuevo
// pregunta dónde; Android 7, va solo). Queda guardado en el aparato; «Volver al de JXMod» lo saca.
const MILOGO = { k: 'jx_logo', ki: 'jx_logo_ic', kn: 'jx_logo_nom' };
const milogoValido = (u) => typeof u === 'string' && u.length < 3e6 && /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(u);
const milogoOrig = () => (typeof window.__logoOrig === 'string' && window.__logoOrig) || LOGO_RB;
function milogoDe(k) { try { const u = localStorage.getItem(k || MILOGO.k); return milogoValido(u) ? u : null; } catch (e) { return null; } }
// (cambia el logo en todos lados: lo que ya está dibujado y lo que se arme después)
function milogoAplicar(u) {
  const src = milogoValido(u) ? u : milogoOrig(); LOGO_RB = src;
  for (const im of document.querySelectorAll('#carga .dLogo img, .rbLogo, .rbBienvLogo')) if (im.src !== src) im.src = src;
}
// la imagen elegida: el logo, hasta 1024×320 sin agrandarlo; el ícono, 192×192 con la imagen entera al medio
async function milogoLeer(file) {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
    const w0 = im.naturalWidth, h0 = im.naturalHeight; if (!w0 || !h0) return null;
    const k = Math.min(1, 1024 / w0, 320 / h0), w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0, w, h);
    let logo = c.toDataURL('image/webp', 0.92); if (!/^data:image\/webp/.test(logo)) logo = c.toDataURL('image/png');
    const q = document.createElement('canvas'); q.width = q.height = 192; const g = q.getContext('2d'), s = Math.min(176 / w0, 176 / h0);
    g.drawImage(im, (192 - w0 * s) / 2, (192 - h0 * s) / 2, w0 * s, h0 * s);
    return { logo, ic: q.toDataURL('image/png'), w, h };
  } catch (e) { return null; } finally { URL.revokeObjectURL(url); }
}
function milogoGuardar(r) {
  try { localStorage.setItem(MILOGO.k, r.logo); localStorage.setItem(MILOGO.ki, r.ic); return true; }
  catch (e) { try { localStorage.removeItem(MILOGO.k); localStorage.removeItem(MILOGO.ki); } catch (e2) {} return false; }
}
function milogoQuitar() { try { localStorage.removeItem(MILOGO.k); localStorage.removeItem(MILOGO.ki); } catch (e) {} milogoAplicar(null); }
const milogoApp = () => !!(window.JXNativo && JXNativo.accesoDirecto);
// el acceso directo (sólo en la app): el nombre y el ícono van a Android; contesta "ok", "no" (el lanzador no deja) o "mal"
function milogoAcceso(nombre) {
  const ic = milogoDe(MILOGO.ki); if (!ic || !milogoApp()) return 'mal';
  const n = String(nombre || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24) || 'JXMod';
  try { localStorage.setItem(MILOGO.kn, n); } catch (e) {}
  try { return String(JXNativo.accesoDirecto(n, ic.slice(ic.indexOf(',') + 1)) || 'mal'); } catch (e) { return 'mal'; }
}
// la parte de Ajustes (la arma ui.js en su pestaña «Tu logo»)
function milogoSeccion() {
  const u = milogoDe(), n = (() => { try { return localStorage.getItem(MILOGO.kn) || 'JXMod'; } catch (e) { return 'JXMod'; } })();
  return `<h4>${esc(T('lg.titulo'))}</h4><p class="lgAyuda">${esc(T('lg.ayuda'))}</p>
    <div class="lgVista"><img id="lgImg" alt="" src="${u || milogoOrig()}"></div>
    <input type="file" id="lgArch" accept="image/png,image/jpeg,image/webp,image/gif" class="oc">
    <div class="lgBot"><button class="ajBtn" id="lgElegir">${esc(T('lg.elegir'))}</button><button class="ajBtn gris" id="lgQuitar"${u ? '' : ' disabled'}>${esc(T('lg.quitar'))}</button></div>
    ${milogoApp() ? `<div class="lgAcc"><span>${esc(T('lg.acceso'))}</span><input id="lgNom" maxlength="24" value="${esc(n)}"><button class="ajBtn gris" id="lgAccBtn"${u ? '' : ' disabled'}>${esc(T('lg.crear'))}</button></div>` : `<p class="lgAyuda">${esc(T('lg.soloApp'))}</p>`}
    <p class="lgEst" id="lgEst"></p>`;
}
function milogoConectar() {
  const est = (t) => { const e = $('lgEst'); if (e) e.textContent = t; };
  const pintar = () => { const u = milogoDe(), i = $('lgImg'); if (i) i.src = u || milogoOrig(); const q = $('lgQuitar'); if (q) q.disabled = !u; const a = $('lgAccBtn'); if (a) a.disabled = !u; };
  if ($('lgElegir')) $('lgElegir').onclick = () => $('lgArch').click();
  if ($('lgArch')) $('lgArch').onchange = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 25e6) { est(T('lg.grande')); return; }
    est(T('lg.leyendo')); const r = await milogoLeer(f);
    if (!r) { est(T('lg.mal')); return; }
    if (!milogoGuardar(r)) { est(T('lg.sinLugar')); return; }
    milogoAplicar(r.logo); pintar(); est(T('lg.listo'));
  };
  if ($('lgQuitar')) $('lgQuitar').onclick = () => { milogoQuitar(); pintar(); est(T('lg.vuelto')); };
  if ($('lgAccBtn')) $('lgAccBtn').onclick = () => { const r = milogoAcceso($('lgNom').value); est(T(r === 'ok' ? 'lg.accOk' : r === 'no' ? 'lg.accNo' : 'lg.mal')); };
}
// al abrir el juego: el logo guardado también en el menú y la bienvenida (la pantalla de carga ya lo puso)
{ const u = milogoDe(); if (u) milogoAplicar(u); }
