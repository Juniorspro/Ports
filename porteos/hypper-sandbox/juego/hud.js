// ---------------- controles en pantalla: dónde va cada botón como en el Hypper original, con íconos propios ----------------
// Las posiciones salen del PlayerCanvas del juego (referencia 1280×720, el CanvasScaler mezcla ancho y alto a la mitad):
// cada botón tiene su ancla (0..1 en x e y, y para arriba), su corrimiento y su tamaño en esa referencia. En el celular:
// pausa y chat arriba a la izquierda, el menú de props a la izquierda al medio, el disparo grande a la derecha, saltar y
// borrar abajo, el arma arriba a la derecha con la cámara y los emotes al lado; con la pistola de física aparecen girar,
// congelar, acercar y alejar; en un auto, pedales (acelerar y frenar), doblar, freno de mano y bajarse. En la compu
// quedan arriba en fila (pausa, props, chat) como en su versión de PC. Los íconos son dibujos propios (SVG).
const HUD_SVG = {
  pausa: '<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="#fff"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="#fff"/>',
  props: '<path d="M12 2.8l8 4.2v9.8l-8 4.4-8-4.4V7z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M4.3 7.2L12 11.4l7.7-4.2M12 11.4v9.4" fill="none" stroke="#fff" stroke-width="1.6" opacity=".8"/>',
  chat: '<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 20 17h-8.5L7 20.5V17H4a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 4 5.5z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="8" cy="11.3" r="1.3" fill="#fff"/><circle cx="12" cy="11.3" r="1.3" fill="#fff"/><circle cx="16" cy="11.3" r="1.3" fill="#fff"/>',
  emote: '<circle cx="12" cy="4.6" r="2.3" fill="#fff"/><path d="M12 7.6v6.6M12 9.4l-5-3.4M12 9.4l4.6 1.4 2.8-4M12 14.2l-3.6 6.4M12 14.2l3.2 6.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  camara: '<path d="M3.5 8.5h3l1.6-2.5h7.8l1.6 2.5h3v10h-17z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13.3" r="3.2" fill="none" stroke="#fff" stroke-width="2"/>',
  disparo: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="#fff" stroke-width="2"/><path d="M12 1.8v5M12 17.2v5M1.8 12h5M17.2 12h5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="1.8" fill="#fff"/>',
  patada: '<path d="M8 3.5l1.2 7.5-3.6 7.2a1.6 1.6 0 0 0 1.5 2.3h3.6l1.1-2.3h-2.3l2.4-4.6 6.6-2.2a1.6 1.6 0 0 0-.9-3l-5.7 1.5-1-6.4z" fill="#fff"/><path d="M18.5 15.5l2.5 1M18 18.5l2.6.2" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
  salto: '<path d="M12 3.5l6.5 7h-4v6h-5v-6h-4z" fill="#fff"/><path d="M5 20.5h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
  agachar: '<path d="M12 16.5l6.5-7h-4v-6h-5v6h-4z" fill="#fff"/><path d="M5 20.5h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
  recargar: '<path d="M19 12a7 7 0 1 1-2.1-5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M19.5 3.5v5h-5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  usar: '<path d="M9.5 12V5a1.6 1.6 0 0 1 3.2 0v5.2l5.6 1.2c1 .2 1.7 1.2 1.5 2.2l-1 5.3a2 2 0 0 1-2 1.6h-5.4a2 2 0 0 1-1.6-.8L5 15.6a1.5 1.5 0 0 1 2.2-2z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>',
  borrar: '<path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 10v6.5M14 10v6.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
  congelar: '<g stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"><path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/><path d="M9.5 3.8L12 6l2.5-2.2M9.5 20.2L12 18l2.5 2.2M3.7 10.4l3-.9-.6-3.2M20.3 13.6l-3 .9.6 3.2M3.7 13.6l3 .9-.6 3.2M20.3 10.4l-3-.9.6-3.2"/></g>',
  rotar: '<path d="M5 12a7 7 0 0 1 12-5l1.5 1.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M19 4v5h-5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 12a7 7 0 0 1-12 5l-1.5-1.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".6"/>',
  mas: '<path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
  menos: '<path d="M5 12h14" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
  gas: '<rect x="6.5" y="3" width="11" height="18" rx="3" fill="none" stroke="#fff" stroke-width="2"/><path d="M9 8l3-2.6L15 8M9 12.5l3-2.6 3 2.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 16.5h6" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/>',
  freno: '<rect x="4.5" y="7" width="15" height="11" rx="3" fill="none" stroke="#fff" stroke-width="2"/><path d="M9 10.5l3 2.6 3-2.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 15h8" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/>',
  izq: '<path d="M15 5l-7 7 7 7" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  der: '<path d="M9 5l7 7-7 7" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  manual: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="#fff" stroke-width="2"/><path d="M10 16.5v-9h2.8a2.6 2.6 0 0 1 0 5.2H10" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  bajar: '<path d="M10 4H5.5v16H10" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 12h9M16 8l3.8 4-3.8 4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  dos: '<circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="2"/><path d="M9.3 9.6a2.8 2.8 0 0 1 5.4 1c0 2-5.3 3.6-5.3 5.4h5.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};
const hudIco = (n) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${HUD_SVG[n] || ''}</svg>`);
// [selector, ancla x, ancla y, x, y, tamaño] en la referencia 1280×720 (y para arriba)
const HUD_TACTIL = [
  ['[data-btn=pausa]', 0, 1, 46, -44.9, 75], ['.modmBt', 0, 1, 151.8, -46.1, 75], ['.smBt', 0, 1, 257.7, -46.2, 75], ['#vozBt', 0, 1, 363.6, -46.2, 75], ['#vocesBt', 0, 1, 469.5, -46.2, 75], ['#verBt', 0, 1, 575.4, -46.2, 75], ['[data-btn=chat]', 0, 1, 46.6, -137.6, 75],
  ['[data-btn=menu]', 0, 0.5, 46, 42.8, 75],
  ['#armaAct', 1, 1, -53, -53, 100], ['[data-btn=camara]', 1, 1, -209, -50, 75], ['[data-btn=emotes]', 1, 1, -332.8, -50, 75],
  ['#bdisparo', 1, 0.5, -207, -62, 124], ['#bdisp2', 1, 0.5, -124, 27.9, 70], ['#brecargar', 1, 0.5, -124, 27.9, 70], ['#brotar', 1, 0.5, -86.5, -62, 70],
  ['#blejos', 1, 1, -43.2, -164.5, 60], ['#bcerca', 1, 1, -43.2, -236.7, 60],
  ['#bsaltar', 0.5, 0, 346, 43, 75], ['#bpatada', 0.5, 0, 346, 140, 66], ['#bagachar', 0.5, 0, 446, 43, 62], ['#bborrar', 0.5, 0, -226.6, 43, 75], ['#busar', 0.5, 0, 0, 163, 71],
  // en un vehículo
  ['#bgas', 1, 0, -122, 153, 110], ['#bfreno', 1, 0, -287.6, 153, 110], ['#bizq', 0, 0, 179, 142, 103], ['#bder', 0, 0, 361, 142, 103], ['#bmanual', 1, 0.5, -107, 0.4, 96.4], ['#bbajar', 0, 0.5, 42, 0, 71],
];
const HUD = { k: 0, w: 0, h: 0, arma: '', veh: null, usar: null, tac: null, n: '', c: 0 };
// cuáles botones hay y se ven (no cuántos: si aparece uno y se va otro a la vez, la cuenta no cambia y el nuevo quedaba
// sin ubicar, en la esquina, encima de pausa)
const hudFirma = () => HUD_TACTIL.map((r) => { const e = document.querySelector(r[0]); return e && e.style.display !== 'none' ? 1 : 0; }).join('');
function hudIniciar() {
  const t = $('tactil'); if (!t) return;
  // botones que agrega esta versión: borrar lo que apuntás y los del auto
  const nuevo = (id, btn, ico, mantener) => { if ($(id)) return; const d = document.createElement('div'); d.className = 'bt-t'; d.id = id; d.dataset.btn = btn; if (mantener) d.dataset.mantener = ''; d.innerHTML = `<img alt="" src="${hudIco(ico)}">`; t.appendChild(d); return d; };
  nuevo('bborrar', 'borrarApuntado', 'borrar'); nuevo('bpatada', 'patada', 'patada'); nuevo('bgas', 'pGas', 'gas', 1); nuevo('bfreno', 'pFreno', 'freno', 1); nuevo('bizq', 'pIzq', 'izq', 1); nuevo('bder', 'pDer', 'der', 1); nuevo('bmanual', 'saltar', 'manual', 1); nuevo('bbajar', 'salir', 'bajar');
  // los íconos propios
  const pon = (id, n) => { const e = $(id); if (e) e.src = hudIco(n); };
  pon('iPausa', 'pausa'); pon('iMenu', 'props'); pon('iChat', 'chat'); pon('iEmote', 'emote'); pon('iCam', 'camara'); pon('iDisp', 'disparo'); pon('iRotar', 'rotar'); pon('iSalto', 'salto'); pon('iUsar', 'usar');
  const ag = $('bagachar'); if (ag) ag.innerHTML = `<img alt="" src="${hudIco('agachar')}">`;
  const rc = $('brecargar'); if (rc) rc.innerHTML = `<img alt="" src="${hudIco('recargar')}">`;
  const le = $('blejos'); if (le) le.innerHTML = `<img alt="" src="${hudIco('mas')}">`;
  const ce = $('bcerca'); if (ce) ce.innerHTML = `<img alt="" src="${hudIco('menos')}">`;
  const d2 = $('bdisp2'); if (d2) d2.innerHTML = `<img alt="" src="${hudIco('dos')}">`;
  for (const b of t.querySelectorAll('[data-btn]')) botonTactil(b);
  addEventListener('resize', () => setTimeout(hudDisponer, 50));
  hudDisponer();
}
// el tamaño de los controles en el celular (Ajustes: 60 a 120 %; de entrada 80 %, el del Hypper quedaba grande)
const hudTam = () => Math.min(1.2, Math.max(0.6, (+PREFS.hud || 80) / 100));
// la ubicación de cada botón (en el celular), escalada como el CanvasScaler del juego y por el tamaño elegido
// (--hk: la misma escala para lo que no se ubica acá, como la barra de armas; 1 = un teléfono de 800×360 al 100 %)
function hudDisponer() {
  const W = VW(), H = VH(), f = hudTam(), kb = Math.sqrt((W / 1280) * (H / 720)), k = kb * f; HUD.k = k; HUD.f = f; HUD.w = W; HUD.h = H;
  document.body.style.setProperty('--hk', (k / 0.559).toFixed(3)); HUD.pal = Math.round(Math.max(84, Math.min(150, 230 * k)));
  const pal = $('palanca'), bola = $('palbola');
  if (pal && bola) { const b = Math.round(HUD.pal * 0.42); pal.style.width = pal.style.height = HUD.pal + 'px'; Object.assign(bola.style, { width: b + 'px', height: b + 'px', left: (HUD.pal - b) / 2 - 2 + 'px', top: (HUD.pal - b) / 2 - 2 + 'px' }); }
  const tactil = document.body.classList.contains('tactil'); HUD.tac = tactil;
  HUD.n = hudFirma();
  for (const [sel, ax, ay, x, y, s] of HUD_TACTIL) {
    const e = document.querySelector(sel); if (!e) continue;
    if (!tactil && !e.classList.contains('bt-t')) { e.style.left = e.style.top = e.style.width = e.style.height = ''; continue; }
    // (más chicos en el mismo lugar: el centro de cada botón no se mueve, así no se pegan a los bordes)
    const t = s * k, cx = ax * W + x * kb, cy = H - (ay * H + y * kb);
    Object.assign(e.style, { left: (cx - t / 2).toFixed(1) + 'px', top: (cy - t / 2).toFixed(1) + 'px', width: t.toFixed(1) + 'px', height: t.toFixed(1) + 'px', right: 'auto', bottom: 'auto' });
  }
}
// cada cuadro (sólo si cambia algo): qué botones se ven según el arma, si hay algo para usar y si vas en un vehículo
// (el modo táctil se prende con el primer toque, y los botones MOD y micrófono aparecen después: cuando cambia algo de eso
// o el tamaño de la pantalla, se vuelven a ubicar; si no, quedaban todos amontonados en la esquina)
function hudPaso() {
  const tactil = document.body.classList.contains('tactil');
  if (tactil !== HUD.tac || HUD.w !== VW() || HUD.h !== VH() || HUD.f !== hudTam() || (++HUD.c % 10 === 0 && hudFirma() !== HUD.n)) hudDisponer();
  if (!tactil) return;
  const arma = ARM.lista[ARM.i] || '', veh = !!JUG.vehiculo, usar = !!($('usarTxt').textContent || (!veh && entidadCerca()));
  if (arma !== HUD.arma || veh !== HUD.veh || usar !== HUD.usar) {
    HUD.arma = arma; HUD.veh = veh; HUD.usar = usar;
    const fis = /^(PhysicsGun|GravityGun)$/.test(arma), sinBala = /^(PhysicsGun|GravityGun|ToolBaton|Hands|Camera)$/.test(arma);
    document.body.classList.toggle('enVeh', veh);
    const ver = (id, si) => { const e = $(id); if (e) e.classList.toggle('oc', !si); };
    ver('brecargar', !veh && !sinBala); ver('bdisp2', !veh && (fis || arma === 'ToolBaton')); ver('busar', usar && !veh); ver('bborrar', !veh);
    const d2 = $('bdisp2'); if (d2) d2.querySelector('img').src = hudIco(fis ? 'congelar' : 'dos');
    for (const id of ['bgas', 'bfreno', 'bizq', 'bder', 'bmanual', 'bbajar']) ver(id, veh);
    for (const id of ['bsaltar', 'bagachar', 'bdisparo', 'bpatada']) ver(id, !veh);
  }
}
// borrar lo que apuntás (si es tuyo); si no apuntás a nada tuyo, deshace lo último que pusiste
function borrarApuntado() {
  const h = raycast(CAM.pos, CAM.fwd, 60, JUG.vehiculo ? JUG.vehiculo.b : null), o = h && h.body && h.body.obj;
  if (o && OBJS.includes(o) && !o.remoto) { borrarObjeto(o); sonar('Click', null, 0.6, 0.8); aviso(T('borrado') + ': ' + propNom(o.nombre), 1); return; }
  const u = DESHACER.pop(); if (u && OBJS.includes(u)) { borrarObjeto(u); aviso(T('borrado') + ': ' + propNom(u.nombre), 1); }
}
