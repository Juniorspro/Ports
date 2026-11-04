// ---------------- controles en pantalla: dónde va cada botón como en el original, con íconos propios ----------------
// Las posiciones salen del PlayerCanvas del juego (referencia 1280×720, el CanvasScaler mezcla ancho y alto a la mitad):
// cada botón tiene su ancla (0..1 en x e y, y para arriba), su corrimiento y su tamaño en esa referencia. En el celular:
// pausa y chat arriba a la izquierda, el menú de props a la izquierda al medio, el disparo grande a la derecha, saltar y
// borrar abajo, el arma arriba a la derecha con la cámara y los emotes al lado; con la pistola de física aparecen girar,
// congelar, acercar y alejar; en un auto, pedales (acelerar y frenar), doblar, freno de mano y bajarse. En la compu
// quedan arriba en fila (pausa, props, chat) como en su versión de PC. Los íconos son dibujos propios (SVG).
const HUD_SVG = {
  linterna: '<path d="M4 9.2h7.5l3.6-2.7h1.4v11h-1.4l-3.6-2.7H4z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M18.6 8.4l2.4-1.4M18.6 12h2.8M18.6 15.6l2.4 1.4" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
  pausa: '<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="#fff"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="#fff"/>',
  props: '<path d="M12 2.8l8 4.2v9.8l-8 4.4-8-4.4V7z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M4.3 7.2L12 11.4l7.7-4.2M12 11.4v9.4" fill="none" stroke="#fff" stroke-width="1.6" opacity=".8"/>',
  chat: '<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 20 17h-8.5L7 20.5V17H4a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 4 5.5z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="8" cy="11.3" r="1.3" fill="#fff"/><circle cx="12" cy="11.3" r="1.3" fill="#fff"/><circle cx="16" cy="11.3" r="1.3" fill="#fff"/>',
  emote: '<circle cx="12" cy="4.6" r="2.3" fill="#fff"/><path d="M12 7.6v6.6M12 9.4l-5-3.4M12 9.4l4.6 1.4 2.8-4M12 14.2l-3.6 6.4M12 14.2l3.2 6.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  camlibre: '<path d="M12 3l2.2 4.5L19 8l-3.5 3.4.8 4.8L12 14l-4.3 2.2.8-4.8L5 8l4.8-.5z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 20h16" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
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
  bocina: '<path d="M4 9.5h3.2L13 5.5v13l-5.8-4H4z" fill="#fff"/><path d="M16 8.6a5 5 0 0 1 0 6.8M18.6 6.2a8.5 8.5 0 0 1 0 11.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
  turbo: '<path d="M12 2.5c3 2.5 4.5 5.6 4.5 9.2V16h-9v-4.3c0-3.6 1.5-6.7 4.5-9.2z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="1.7" fill="#fff"/><path d="M9.5 18.5l-1 3M12 18.5v3.5M14.5 18.5l1 3" stroke="#ffb347" stroke-width="2" stroke-linecap="round"/>',
  gas: '<rect x="6.5" y="3" width="11" height="18" rx="3" fill="none" stroke="#fff" stroke-width="2"/><path d="M9 8l3-2.6L15 8M9 12.5l3-2.6 3 2.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 16.5h6" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/>',
  freno: '<rect x="4.5" y="7" width="15" height="11" rx="3" fill="none" stroke="#fff" stroke-width="2"/><path d="M9 10.5l3 2.6 3-2.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 15h8" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/>',
  izq: '<path d="M15 5l-7 7 7 7" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  der: '<path d="M9 5l7 7-7 7" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  manual: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="#fff" stroke-width="2"/><path d="M10 16.5v-9h2.8a2.6 2.6 0 0 1 0 5.2H10" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  bajar: '<path d="M10 4H5.5v16H10" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 12h9M16 8l3.8 4-3.8 4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  meme: '<rect x="3" y="3" width="18" height="18" rx="3.5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="8.6" cy="8.6" r="2.4" fill="#fff"/><circle cx="15.4" cy="8.6" r="2.4" fill="#fff"/><circle cx="8.6" cy="15.4" r="2.4" fill="#fff"/><circle cx="15.4" cy="15.4" r="2.4" fill="#fff" opacity=".55"/>',
  celular: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.4" fill="none" stroke="#fff" stroke-width="2"/><path d="M10 5.2h4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="18.2" r="1.1" fill="#fff"/><path d="M9.4 9.2h2v2h-2zM12.6 9.2h2v2h-2zM9.4 12.4h2v2h-2zM12.6 12.4h2v2h-2z" fill="#fff"/>',
  volver: '<path d="M4.5 9.5A8 8 0 1 1 6 16" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M3.5 4.5v5h5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12.5" cy="12" r="2.3" fill="#fff"/>',
  dos: '<circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="2"/><path d="M9.3 9.6a2.8 2.8 0 0 1 5.4 1c0 2-5.3 3.6-5.3 5.4h5.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};
const hudIco = (n) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${HUD_SVG[n] || ''}</svg>`);
// [selector, ancla x, ancla y, x, y, tamaño, mínimo en px] en la referencia 1280×720 (y para arriba). Como en los shooters
// del celular: el pulgar derecho tiene el disparo grande y alrededor saltar (abajo a la derecha), agacharse (abajo),
// recargar (arriba a la izquierda del disparo), apuntar (a la derecha) y, en arco arriba del disparo, las teclas que pide
// el arma de un mod; el pulgar izquierdo tiene la palanca y abajo a la izquierda no hay botones; lo del sistema (pausa,
// MOD, chat, celular, GMod, props y las habilidades fijadas de los addons) va arriba a la izquierda. Los de uso frecuente
// nunca miden menos de 44 px (la guía de Apple: 44 pt; la de Android: 48 dp) y los demás no menos de 32.
const HUD_TACTIL = [
  ['[data-btn=pausa]', 0, 1, 46, -46, 80, 32], ['.modmBt', 0, 1, 151.8, -46, 80, 32], ['.smBt', 0, 1, 257.7, -46, 80, 32], ['#vozBt', 0, 1, 363.6, -46, 80, 32], ['#vocesBt', 0, 1, 469.5, -46, 80, 32], ['#verBt', 0, 1, 575.4, -46, 80, 32],
  ['[data-btn=chat]', 0, 1, 46.6, -140, 80, 32], ['[data-btn=celular]', 0, 1, 151.8, -140, 80, 32], ['.gmbBt', 0, 1, 257.7, -140, 80, 32],
  ['[data-btn=menu]', 0, 1, 46, -234, 80, 32],
  ['#armaAct', 1, 1, -53, -53, 100, 40], ['[data-btn=camara]', 1, 1, -209, -50, 75], ['[data-btn=camLibre]', 1, 1, -209, -140, 75], ['[data-btn=camLibL]', 1, 1, -256, -228, 62], ['[data-btn=camLibR]', 1, 1, -162, -228, 62], ['[data-btn=emotes]', 1, 1, -332.8, -50, 75], ['#blinterna', 1, 1, -332.8, -140, 75],
  ['#bdisparo', 1, 0, -215, 225, 150, 58], ['#bdisp2', 1, 0, -72, 268, 104, 44], ['#brecargar', 1, 0, -362, 262, 100, 44], ['#brotar', 1, 0, -362, 262, 100, 44], ['#bvolver', 1, 0, -482, 190, 86, 36],
  ['#blejos', 1, 0, -215, 412, 88, 38], ['#bcerca', 1, 0, -335, 390, 88, 38],
  ['#bsaltar', 1, 0, -78, 98, 115, 46], ['#bpatada', 1, 0, -352, 112, 88, 36], ['#bagachar', 1, 0, -222, 62, 100, 44], ['#bborrar', 1, 1, -62, -190, 86, 34], ['#busar', 0.5, 0, 40, 175, 95, 38],
  // en un vehículo (auto y moto: doblar con las flechas a la izquierda y los pedales a la derecha; helicóptero y avión:
  // la palanca para inclinar y girar, y subir y bajar con saltar y agacharse)
  ['#bgas', 1, 0, -112, 150, 140, 56], ['#bfreno', 1, 0, -292, 128, 124, 52], ['#bizq', 0, 0, 150, 140, 125, 52], ['#bder', 0, 0, 345, 140, 125, 52], ['#bmanual', 1, 0, -112, 335, 100, 42], ['#bbajar', 1, 1, -62, -190, 90, 36], ['#bbocina', 1, 0, -292, 318, 90, 38], ['#bturbo', 1, 0, -440, 232, 95, 40],
];
const HUD = { k: 0, w: 0, h: 0, arma: '', veh: null, usar: null, tac: null, n: '', c: 0 };
// cuáles botones hay y se ven (no cuántos: si aparece uno y se va otro a la vez, la cuenta no cambia y el nuevo quedaba
// sin ubicar, en la esquina, encima de pausa)
const hudFirma = () => HUD_TACTIL.map((r) => { const e = document.querySelector(r[0]); return e && e.style.display !== 'none' ? 1 : 0; }).join('');
function hudIniciar() {
  const t = $('tactil'); if (!t) return;
  // botones que agrega esta versión: borrar lo que apuntás y los del auto
  const nuevo = (id, btn, ico, mantener) => { if ($(id)) return; const d = document.createElement('div'); d.className = 'bt-t'; d.id = id; d.dataset.btn = btn; if (mantener) d.dataset.mantener = ''; d.innerHTML = `<img alt="" src="${hudIco(ico)}">`; t.appendChild(d); return d; };
  nuevo('bborrar', 'borrarApuntado', 'borrar'); nuevo('blinterna', 'linterna', 'linterna'); nuevo('bpatada', 'patada', 'patada'); nuevo('bvolver', 'volver', 'volver'); nuevo('bbocina', 'bocina', 'bocina', 1); nuevo('bturbo', 'turbo', 'turbo', 1); nuevo('bgas', 'pGas', 'gas', 1); nuevo('bfreno', 'pFreno', 'freno', 1); nuevo('bizq', 'pIzq', 'izq', 1); nuevo('bder', 'pDer', 'der', 1); nuevo('bmanual', 'saltar', 'manual', 1); nuevo('bbajar', 'salir', 'bajar');
  // los íconos propios
  const pon = (id, n) => { const e = $(id); if (e) e.src = hudIco(n); };
  pon('iPausa', 'pausa'); pon('iMenu', 'props'); pon('iChat', 'chat'); pon('iMeme', 'celular'); pon('iEmote', 'emote'); pon('iCam', 'camara'); pon('iCamLib', 'camlibre'); pon('iDisp', 'disparo'); pon('iRotar', 'rotar'); pon('iSalto', 'salto'); pon('iUsar', 'usar');
  const ag = $('bagachar'); if (ag) ag.innerHTML = `<img alt="" src="${hudIco('agachar')}">`;
  const rc = $('brecargar'); if (rc) rc.innerHTML = `<img alt="" src="${hudIco('recargar')}">`;
  const le = $('blejos'); if (le) le.innerHTML = `<img alt="" src="${hudIco('mas')}">`;
  const ce = $('bcerca'); if (ce) ce.innerHTML = `<img alt="" src="${hudIco('menos')}">`;
  const d2 = $('bdisp2'); if (d2) d2.innerHTML = `<img alt="" src="${hudIco('dos')}">`;
  if (typeof ctlIniciar === 'function') ctlIniciar();
  for (const b of t.querySelectorAll('[data-btn]')) botonTactil(b);
  addEventListener('resize', () => setTimeout(hudDisponer, 50));
  hudDisponer();
}
// el tamaño de los controles en el celular (Ajustes: 60 a 120 %; de entrada 80 %, el del JXMod quedaba grande)
const hudTam = () => Math.min(1.2, Math.max(0.6, (+PREFS.hud || 80) / 100));
// la ubicación de cada botón (en el celular), escalada como el CanvasScaler del juego y por el tamaño elegido
// (--hk: la misma escala para lo que no se ubica acá, como la barra de armas; 1 = un teléfono de 800×360 al 100 %)
function hudDisponer() {
  const W = VW(), H = VH(), f = hudTam(), kb = Math.sqrt((W / 1280) * (H / 720)), k = kb * f; HUD.k = k; HUD.f = f; HUD.w = W; HUD.h = H;
  document.body.style.setProperty('--hk', (k / 0.559).toFixed(3)); HUD.pal = Math.round(Math.max(70, Math.min(240, 230 * k * (+PREFS.palTam || 1))));
  const pal = $('palanca'), bola = $('palbola');
  if (pal && bola) { const b = Math.round(HUD.pal * 0.42); pal.style.width = pal.style.height = HUD.pal + 'px'; Object.assign(bola.style, { width: b + 'px', height: b + 'px', left: (HUD.pal - b) / 2 - 2 + 'px', top: (HUD.pal - b) / 2 - 2 + 'px' }); }
  const tactil = document.body.classList.contains('tactil'); HUD.tac = tactil;
  HUD.n = hudFirma();
  const pos = typeof ctlPosiciones === 'function' ? ctlPosiciones() : {};
  // (el rectángulo de los botones de arriba a la izquierda: lo que el Lua de un modo de juego escriba ahí se corre abajo)
  const ri = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }, sumar = (a, b, c, d) => { ri.x0 = Math.min(ri.x0, a); ri.y0 = Math.min(ri.y0, b); ri.x1 = Math.max(ri.x1, c); ri.y1 = Math.max(ri.y1, d); };
  if (!tactil) { const ai = $('arribaIz'); if (ai) { const r = ai.getBoundingClientRect(); if (r.width > 0) sumar(r.left, r.top, r.right, r.bottom + 12); } }
  for (const [sel, ax, ay, x0, y0, s0, mn] of HUD_TACTIL) {
    const e = document.querySelector(sel); if (!e) continue;
    const o = pos[sel], propio = !!(o && o.length === 3 && o.every(Number.isFinite)), [x, y, s] = propio ? o : [x0, y0, s0];   // (los que movió el jugador en Controles)
    if (!tactil && !e.classList.contains('bt-t')) { e.style.left = e.style.top = e.style.width = e.style.height = ''; continue; }
    // (más chicos en el mismo lugar: el centro de cada botón no se mueve, así no se pegan a los bordes; en un celular chico
    // no bajan del mínimo, que sigue al tamaño elegido en Ajustes)
    const t = propio ? s * k : Math.max(s * k, (mn || 0) * f / 0.8), cx = ax * W + x * kb, cy = H - (ay * H + y * kb);
    Object.assign(e.style, { left: (cx - t / 2).toFixed(1) + 'px', top: (cy - t / 2).toFixed(1) + 'px', width: t.toFixed(1) + 'px', height: t.toFixed(1) + 'px', right: 'auto', bottom: 'auto' });
    if (tactil && ax === 0 && ay === 1 && cy < H * 0.45) sumar(cx - t / 2, cy - t / 2, cx + t / 2, cy + t / 2 + 14);   // (en la compu los táctiles no se ven: no ocupan lugar)
  }
  HUD.resIz = ri.x1 > ri.x0 ? ri : null;
}
// cada cuadro (sólo si cambia algo): qué botones se ven según el arma, si hay algo para usar y si vas en un vehículo
// (el modo táctil se prende con el primer toque, y los botones MOD y micrófono aparecen después: cuando cambia algo de eso
// o el tamaño de la pantalla, se vuelven a ubicar; si no, quedaban todos amontonados en la esquina)
function hudPaso() {
  const tactil = document.body.classList.contains('tactil');
  if (tactil !== HUD.tac || HUD.w !== VW() || HUD.h !== VH() || HUD.f !== hudTam() || (++HUD.c % 10 === 0 && hudFirma() !== HUD.n)) hudDisponer();
  if (!tactil || (typeof CTL !== 'undefined' && CTL.edit)) return;
  const arma = ARM.lista[ARM.i] || '', veh = !!JUG.vehiculo, usar = !!($('usarTxt').textContent || (!veh && entidadCerca()));
  const vt = veh ? (JUG.vehiculo.veh && JUG.vehiculo.veh.tipo) || '' : '', aire = vt === 'heli' || vt === 'avion', tierra = veh && !aire && vt !== 'asiento';
  if (arma !== HUD.arma || veh !== HUD.veh || usar !== HUD.usar || vt !== HUD.vt) {
    HUD.arma = arma; HUD.veh = veh; HUD.usar = usar; HUD.vt = vt;
    const fis = /^(PhysicsGun|GravityGun)$/.test(arma), sinBala = /^(PhysicsGun|GravityGun|ToolBaton|Hands|Camera)$/.test(arma);
    // (en un auto, una moto o un asiento no hay palanca de caminar: se dobla con las flechas; en el aire sí, para inclinar)
    document.body.classList.toggle('enVeh', veh); document.body.classList.toggle('vehAire', aire);
    const ver = (id, si) => { const e = $(id); if (e) e.classList.toggle('oc', !si); };
    ver('brecargar', !veh && !sinBala); ver('bdisp2', !veh && (fis || arma === 'ToolBaton')); ver('busar', usar && !veh); ver('bborrar', !veh);
    // (un arma de un mod: apuntar con el secundario, y los botones que pide su Lua)
    const gmw = !veh && typeof DEF_ARMAS !== 'undefined' && DEF_ARMAS[arma] && DEF_ARMAS[arma].tipo === 'gmswep'; if (gmw) ver('bdisp2', true);
    // (las de fuego del juego también: apuntar; el francotirador, su mira)
    const fuego = !veh && typeof DEF_ARMAS !== 'undefined' && DEF_ARMAS[arma] && (armaDeFuego(DEF_ARMAS[arma]) || DEF_ARMAS[arma].mira); if (fuego) ver('bdisp2', true);
    const d2 = $('bdisp2'); if (d2) d2.querySelector('img').src = hudIco(fis ? 'congelar' : gmw || fuego ? 'mira' : 'dos');
    if (typeof ctlPasoMod === 'function') ctlPasoMod(veh ? '' : arma);
    const cond = veh && JUG.asiento === 0;   // (de acompañante sólo bajarse)
    for (const id of ['bgas', 'bfreno', 'bizq', 'bder', 'bmanual']) ver(id, tierra && cond); ver('bbajar', veh);
    const V = veh && JUG.vehiculo.veh; ver('bbocina', !!(V && cond && bocTipo(V))); ver('bturbo', !!(V && cond && JUG.vehiculo.art === 'bici'));
    for (const id of ['bsaltar', 'bagachar']) ver(id, !veh || (aire && cond));
    for (const id of ['bdisparo', 'bpatada']) ver(id, !veh);
  }
  const sost = !!(ARM.agarre || ARM.grav);
  if (sost !== HUD.sost) { HUD.sost = sost; const e = $('bvolver'); if (e) e.classList.toggle('oc', !sost); }
  const ro = !!ENT.rotar; if (ro !== HUD.ro) { HUD.ro = ro; const e = $('brotar'); if (e) e.classList.toggle('on', ro); }
}
// borrar lo que apuntás (si es tuyo: un objeto, o una tele, radio o piano que pusiste); si no apuntás a nada tuyo,
// deshace lo último que pusiste
function borrarApuntado() {
  const h = raycast(CAM.pos, CAM.fwd, 60, JUG.vehiculo ? JUG.vehiculo.b : null), o = h && h.body && h.body.obj;
  const e = entidadApuntada(h ? h.t : 60);
  if (e) { entidadQuitar(e); entidadRed('entb', e); sonar('Click', null, 0.6, 0.8); aviso(T('borrado') + ': ' + (T('ent.' + e.t) !== 'ent.' + e.t ? T('ent.' + e.t) : e.t), 1); return; }
  if (h && h.body && h.body.npc && typeof npcQuitar === 'function') { npcQuitar(h.body.npc); sonar('Click', null, 0.6, 0.8); aviso(T('borrado') + ': NPC', 1); return; }
  // (un NPC tirado o un muñeco de trapo: el rayo pega en una pieza de su cuerpo)
  { const P = h && h.body && h.body.persona; if (P && P.npc && !P.npcRem && P !== JUG.cuerpo && typeof npcQuitar === 'function') { npcQuitar(P); sonar('Click', null, 0.6, 0.8); aviso(T('borrado') + ': ' + (P.muneco ? T('gm.muneco') : 'NPC'), 1); return; } }
  if (o && OBJS.includes(o) && !o.remoto) { borrarObjeto(o); sonar('Click', null, 0.6, 0.8); aviso(T('borrado') + ': ' + propNom(o.nombre), 1); return; }
  const u = DESHACER.pop(); if (u && OBJS.includes(u)) { borrarObjeto(u); aviso(T('borrado') + ': ' + propNom(u.nombre), 1); }
}

// la tele, la radio o el piano propios que están en la mira (antes de lo que pegó el rayo)
function entidadApuntada(hasta) {
  const RAD = { pantalla: 0, radio: 0.45, piano: 1.3 }; let mejor = null, bt = Math.min(hasta + 0.5, 20);
  for (const e of ENTS.lista) {
    if (e.dueno !== 'yo' || RAD[e.t] === undefined) continue;
    const w = (e.prm && e.prm.w) || 2, c = vadd(entPos(e), v3(0, e.t === 'pantalla' ? w * 0.5 : e.t === 'piano' ? 0.8 : 0.2, 0)), r = RAD[e.t] || w * 0.6;
    const d = vsub(c, CAM.pos), t = vdot(d, CAM.fwd); if (t < 0 || t > bt) continue;
    if (vsub(d, vscale(CAM.fwd, t)).len() < r) { bt = t; mejor = e; }
  }
  return mejor;
}
