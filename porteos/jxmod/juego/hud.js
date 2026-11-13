// ---------------- controles en pantalla: dónde va cada botón como en el original, con íconos propios ----------------
// Las posiciones salen del PlayerCanvas del juego (referencia 1280×720, el CanvasScaler mezcla ancho y alto a la mitad):
// cada botón tiene su ancla (0..1 en x e y, y para arriba), su corrimiento y su tamaño en esa referencia. En el celular:
// pausa y chat arriba a la izquierda, el menú de props a la izquierda al medio, el disparo grande a la derecha, saltar y
// borrar abajo, el arma arriba a la derecha con la cámara y los emotes al lado; con la pistola de física aparecen girar,
// congelar, acercar y alejar; en un auto, pedales (acelerar y frenar), doblar, freno de mano y bajarse. En la compu
// quedan arriba en fila (pausa, props, chat) como en su versión de PC. Los íconos son dibujos propios (SVG).
// (Discord, «Mejores botones» de GOLDEN) la mira del disparo va en amarillo, congelar en celeste, y la linterna (parecía
// un parlante), la cámara libre (una cámara con las cuatro flechas) y la patada (una bota) están redibujadas. Dónde va
// cada botón en la disposición nueva: HUD_V2, más abajo; HUD_TACTIL queda como la de antes.
const HUD_SVG = {
  linterna: '<g transform="rotate(-40 12 12)"><rect x="2" y="9.7" width="9.6" height="4.6" rx="1.3" fill="none" stroke="#fff" stroke-width="1.9"/><path d="M11.6 9.5l2.9-2.1h1.4v9.2h-1.4l-2.9-2.1z" fill="#fff"/><circle cx="6.8" cy="12" r="1" fill="#fff"/></g><path d="M17.8 8.9l3.3-.6M17.2 7.6l2.6-2.2M16.1 6.9l1.2-3" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>',
  pausa: '<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="#fff"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="#fff"/>',
  props: '<path d="M12 2.8l8 4.2v9.8l-8 4.4-8-4.4V7z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M4.3 7.2L12 11.4l7.7-4.2M12 11.4v9.4" fill="none" stroke="#fff" stroke-width="1.6" opacity=".8"/>',
  chat: '<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 20 17h-8.5L7 20.5V17H4a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 4 5.5z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="8" cy="11.3" r="1.3" fill="#fff"/><circle cx="12" cy="11.3" r="1.3" fill="#fff"/><circle cx="16" cy="11.3" r="1.3" fill="#fff"/>',
  emote: '<circle cx="12" cy="4.6" r="2.3" fill="#fff"/><path d="M12 7.6v6.6M12 9.4l-5-3.4M12 9.4l4.6 1.4 2.8-4M12 14.2l-3.6 6.4M12 14.2l3.2 6.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  camlibre: '<rect x="7.6" y="8.9" width="8.8" height="6.2" rx="1.4" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="1.6" fill="#fff"/><path d="M12 2.5v3.6M12 17.9v3.6M2.5 12h3.6M17.9 12h3.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><path d="M10.2 4.3L12 2.5l1.8 1.8M10.2 19.7l1.8 1.8 1.8-1.8M4.3 10.2L2.5 12l1.8 1.8M19.7 10.2l1.8 1.8-1.8 1.8" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  camara: '<path d="M3.5 8.5h3l1.6-2.5h7.8l1.6 2.5h3v10h-17z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13.3" r="3.2" fill="none" stroke="#fff" stroke-width="2"/>',
  disparo: '<circle cx="12" cy="12" r="7" fill="none" stroke="#f2b31b" stroke-width="2.1"/><path d="M12 1.8v5.2M12 17v5.2M1.8 12H7M17 12h5.2" stroke="#f2b31b" stroke-width="2.3" stroke-linecap="round"/><circle cx="12" cy="12" r="1.7" fill="#f2b31b"/>',
  patada: '<path d="M8.6 3.2h4.8v8.3l5.7 2.1a2.6 2.6 0 0 1 1.7 2.4v2.4H8.6z" fill="#fff"/><path d="M8.2 20.3h12.4" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M2.6 9.4h3.6M2 13.2h4.2M2.8 17h3.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".75"/>',
  salto: '<path d="M12 3.5l6.5 7h-4v6h-5v-6h-4z" fill="#fff"/><path d="M5 20.5h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
  agachar: '<path d="M12 16.5l6.5-7h-4v-6h-5v6h-4z" fill="#fff"/><path d="M5 20.5h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
  recargar: '<path d="M19 12a7 7 0 1 1-2.1-5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M19.5 3.5v5h-5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  usar: '<path d="M9.5 12V5a1.6 1.6 0 0 1 3.2 0v5.2l5.6 1.2c1 .2 1.7 1.2 1.5 2.2l-1 5.3a2 2 0 0 1-2 1.6h-5.4a2 2 0 0 1-1.6-.8L5 15.6a1.5 1.5 0 0 1 2.2-2z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>',
  borrar: '<path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 10v6.5M14 10v6.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
  congelar: '<g stroke="#9fe3ff" stroke-width="2" stroke-linecap="round" fill="none"><path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/><path d="M9.5 3.8L12 6l2.5-2.2M9.5 20.2L12 18l2.5 2.2M3.7 10.4l3-.9-.6-3.2M20.3 13.6l-3 .9.6 3.2M3.7 13.6l3 .9-.6 3.2M20.3 10.4l-3-.9.6-3.2"/></g>',
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
// MOD, chat, celular, GMod, props y las habilidades fijadas de los addons) va arriba a la izquierda, en tres filas (hudorden.js). Los de uso frecuente
// nunca miden menos de 44 px (la guía de Apple: 44 pt; la de Android: 48 dp) y los demás no menos de 32.
const HUD_TACTIL = [
  ['[data-btn=pausa]', 0, 1, 46, -46, 80, 32], ['.modmBt', 0, 1, 151.8, -46, 80, 32], ['.smBt', 0, 1, 257.7, -46, 80, 32], ['#vozBt', 0, 1, 363.6, -46, 80, 32], ['#vocesBt', 0, 1, 469.5, -46, 80, 32], ['#verBt', 0, 1, 575.4, -46, 80, 32],
  ['[data-btn=chat]', 0, 1, 46.6, -140, 80, 32], ['[data-btn=celular]', 0, 1, 151.8, -140, 80, 32], ['.gmbBt', 0, 1, 257.7, -140, 80, 32],
  ['[data-btn=menu]', 0, 1, 46, -234, 80, 32],
  ['#armaAct', 1, 1, -53, -53, 100, 40], ['[data-btn=camara]', 1, 1, -209, -50, 75, 34], ['[data-btn=camLibre]', 1, 1, -209, -140, 75, 34], ['[data-btn=camLibL]', 1, 1, -256, -228, 62, 30], ['[data-btn=camLibR]', 1, 1, -162, -228, 62, 30], ['[data-btn=emotes]', 1, 1, -332.8, -50, 75, 34], ['#blinterna', 1, 1, -332.8, -140, 75, 34],
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
// (y los escondidos con «oc»: las filas de arriba a la izquierda van sin huecos)
const hudFirma = () => HUD_TACTIL.map((r) => { const e = document.querySelector(r[0]); return e && e.style.display !== 'none' && !e.classList.contains('oc') ? 1 : 0; }).join('');
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
// el área segura del aparato (la isla o el agujero de la cámara, las puntas redondeadas, la barra de gestos): lo que pide
// el sistema con env(safe-area-inset-*); con la pantalla girada por el juego no se usa (sería de otro lado)
function hudSegura() {
  let e = $('hudSA'); if (!e) { e = document.createElement('div'); e.id = 'hudSA'; e.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)'; document.body.appendChild(e); }
  const c = getComputedStyle(e), n = (x) => Math.min(80, parseFloat(x) || 0);
  return { l: n(c.paddingLeft), r: n(c.paddingRight), t: n(c.paddingTop), b: n(c.paddingBottom) };
}
// ---------------- (Discord) la disposición nueva por defecto: «Mejores botones», el concepto de GOLDEN, mejorado ----------------
// Como en el concepto: arriba a la izquierda los botones en columnas (la primera, la del sistema: pausa, chat, celular,
// micrófono, voces; la segunda, la de crear: props, MOD, GMod, spawn, Verity; después, con su placa y su nombre, las teclas
// de los mods fijadas), arriba a la derecha el arma en la esquina con la cámara y los emotes al lado, abajo la linterna,
// la cámara libre (con L y R debajo) y borrar; abajo a la derecha el disparo grande con la mira amarilla, al lado el
// secundario, saltar en la esquina, agacharse y la patada a su izquierda, recargar arriba a la izquierda del disparo y, en
// arco arriba, lo de la pistola de física (+ y −) o las teclas del arma de un mod. Mejor que la foto:
//  · cada grupo se escala entero —los botones y la distancia entre ellos con la misma escala—, así nunca se pisan, en
//    ninguna pantalla ni con ningún tamaño de los controles (antes, al agrandarlos al 120 % el disparo pisaba al secundario);
//  · la escala de cada grupo no baja de la que deja cada botón en su mínimo para el dedo (con los controles al 80 %: 64 px
//    el disparo, 54 saltar, 48 agacharse y el secundario, 44 recargar y los de arriba a la izquierda, 38-42 los demás y
//    34 L y R), y todos se tocan en un área de al menos 44 px (--hit) aunque se vean más chicos;
//  · si en un celular bajo la columna de la derecha no entra entera, los dos grupos de la derecha se achican lo justo;
//  · las columnas de arriba a la izquierda tienen 3 filas si entran arriba de la zona de la palanca (el 45 % del alto) y 2
//    si no (con los controles muy grandes en un celular chico); si con todo a la vista —micrófono, voces, SM, 6 teclas de
//    mods— no entran a lo ancho antes de los de arriba a la derecha, se achican lo justo.
// Unidades: las de la referencia de 1280×720 (como HUD_TACTIL); cada grupo las pasa a px con su escala.
const HUD_V2 = {
  zona: { S: 96, mn: 44, Sh: 88, mnh: 40, m: 20, g: 18, gg: 10, lab: 37 },
  // arriba a la derecha: [x desde el borde derecho (negativo), y desde arriba, tamaño, mínimo en px]
  ad: { '#armaAct': [-66, 66, 100, 48], '[data-btn=camara]': [-176, 66, 84, 40], '[data-btn=emotes]': [-278, 66, 84, 40],
    '#bborrar': [-66, 180, 88, 42], '#bbajar': [-66, 180, 88, 42], '[data-btn=camLibre]': [-176, 180, 84, 40], '#blinterna': [-278, 180, 84, 40],
    '[data-btn=camLibL]': [-226, 266, 70, 34], '[data-btn=camLibR]': [-126, 266, 70, 34] },
  // abajo a la derecha: [x desde el borde derecho (negativo), y desde abajo, tamaño, mínimo en px]
  ab: { '#bsaltar': [-90, 90, 136, 54], '#bagachar': [-228, 74, 104, 48], '#bdisparo': [-235, 262, 176, 64], '#bdisp2': [-74, 300, 104, 48],
    '#bpatada': [-344, 100, 92, 42], '#brecargar': [-410, 282, 96, 44], '#brotar': [-410, 282, 96, 44], '#bvolver': [-452, 170, 86, 38],
    '#blejos': [-170, 402, 84, 38], '#bcerca': [-302, 404, 84, 38], '#bmod0': [-170, 404, 90, 40], '#bmod1': [-300, 404, 90, 40], '#bmod2': [-450, 400, 90, 40], '#bmod3': [-540, 290, 90, 40] },
};
// qué disposición usa el jugador: la 2 (la nueva) salvo que haya guardado botones movidos o agrandados antes de que existiera ésta
// (PREFS.hudPos sin «_v: 2» y con posiciones propias): esos quedan exactamente como estaban, con los de fábrica de antes
// alrededor (la 1). «Volver a los de fábrica» y «Probar la nueva» (Ajustes → Controles) pasan a la 2
function hudVer(pos) {
  const o = pos === undefined ? PREFS.hudPos : pos; if (!o || typeof o !== 'object') return 2; if (o._v === 2) return 2;
  for (const k in o) if (k !== '_orden' && k !== '_v' && Array.isArray(o[k])) return 1;
  return 2;
}
// los lugares de la disposición nueva, en px: { sel: [cx, cy, tamaño] } (ver(sel): si se ve; orden: el de «Ordenar»)
function hudV2Pos(W, H, k, f, sa, ver, orden) {
  const out = {}, fz = f / 0.8, Z = HUD_V2.zona;
  // ---- la columna de la derecha: arriba y abajo, cada uno con su escala; si no entran los dos, se achican lo justo ----
  const esc = (T) => { let q = k; for (const sel in T) q = Math.max(q, T[sel][3] * fz / T[sel][2]); return q; };
  const tope = (T) => Math.max(...Object.values(T).map((v) => v[1] + v[2] / 2));
  let kd = esc(HUD_V2.ad), kab = esc(HUD_V2.ab);
  const q = Math.min(1, (H - sa.t - sa.b - 6) / (tope(HUD_V2.ad) * kd + tope(HUD_V2.ab) * kab)); kd *= q; kab *= q;
  for (const sel in HUD_V2.ad) { const [dx, dy, S] = HUD_V2.ad[sel]; out[sel] = [W - sa.r + dx * kd, sa.t + dy * kd, S * kd]; }
  for (const sel in HUD_V2.ab) { const [dx, dy, S] = HUD_V2.ab[sel]; out[sel] = [W - sa.r + dx * kab, H - sa.b - dy * kab, S * kab]; }
  // ---- arriba a la izquierda: columnas por grupo (en unidades; después se pasan a px con la escala ka) ----
  const L = typeof hudZonasListas === 'function' ? hudZonasListas(orden) : { sis: [], crear: [], hab: [] };
  const armar = (R) => { const o = {}; let x = Z.m, der = 0;
    for (const z of ['sis', 'crear', 'hab']) {
      // (los que no se ven también tienen lugar, después de los que se ven: cuando aparece uno —el micrófono al entrar a una
      // sala, la primera tecla fijada— ya está donde va, sin esperar a que se vuelvan a ubicar todos)
      const vis = (L[z] || []).filter(ver), resto = (L[z] || []).filter((q) => !ver(q));
      const h = z === 'hab', S = h ? Z.Sh : Z.S, Rz = h ? 2 : R, py = S + Z.g + (h ? Z.lab : 0), x0 = x + (h ? 6 : 0);
      [...vis, ...resto].forEach((sel, i) => { const c = Math.floor(i / Rz), r = i % Rz, cx = x0 + c * (S + Z.g) + S / 2; o[sel] = [cx, Z.m + r * py + S / 2, S]; if (i < vis.length) der = Math.max(der, cx + S / 2); });
      if (vis.length) x = x0 + Math.ceil(vis.length / Rz) * (S + Z.g) + Z.gg;
    }
    return { o, der };
  };
  // (la escala: la que piden el tamaño elegido y los mínimos para el dedo, sin bajar a la zona de la palanca —el 45 % del
  // alto— ni llegar a los de arriba a la derecha; con 3 filas o con 2, la que deje los botones más grandes)
  const ka0 = Math.max(k, Z.mn * fz / Z.S, Z.mnh * fz / Z.Sh), libre = H * 0.45 - sa.t - 4, ancho = W - sa.r - 320 * kd - 10 - sa.l;
  // (las teclas de los mods van en 2 filas con su nombre abajo: con 2 filas en el resto, ellas pueden ser lo más alto)
  const hayHab = (L.hab || []).some(ver), alto = (R) => Math.max(Z.m + R * Z.S + (R - 1) * Z.g, hayHab ? Z.m + 2 * Z.Sh + Z.g + 2 * Z.lab : 0);
  let mejor = null;
  for (const R of [3, 2]) { const A = armar(R), ka = Math.min(ka0, libre / alto(R), A.der > 0 ? ancho / A.der : ka0); if (!mejor || ka > mejor.ka * 1.001) mejor = { R, ka, A }; }
  const ka = mejor.ka;
  for (const sel in mejor.A.o) { const [cx, cy, S] = mejor.A.o[sel]; out[sel] = [sa.l + cx * ka, sa.t + cy * ka, S * ka]; }
  return { pos: out, ka, kd, kab, R: mejor.R, q };
}
// la ubicación de cada botón (en el celular), escalada como el CanvasScaler del juego y por el tamaño elegido
// (--hk: la misma escala para lo que no se ubica acá, como la barra de armas; 1 = un teléfono de 800×360 al 100 %)
function hudDisponer() {
  const W = VW(), H = VH(), f = hudTam(), kb = Math.sqrt((W / 1280) * (H / 720)), k = kb * f; HUD.k = k; HUD.f = f; HUD.w = W; HUD.h = H;
  document.body.style.setProperty('--hk', (k / 0.559).toFixed(3)); HUD.pal = Math.round(Math.max(70, Math.min(240, 230 * k * (+PREFS.palTam || 1))));
  const pal = $('palanca'), bola = $('palbola');
  if (pal && bola) { const b = Math.round(HUD.pal * 0.42); pal.style.width = pal.style.height = HUD.pal + 'px'; Object.assign(bola.style, { width: b + 'px', height: b + 'px', left: (HUD.pal - b) / 2 - 2 + 'px', top: (HUD.pal - b) / 2 - 2 + 'px' }); }
  const tactil = document.body.classList.contains('tactil'); HUD.tac = tactil;
  HUD.n = hudFirma();
  const pos = typeof ctlPosiciones === 'function' ? ctlPosiciones() : {}, v2 = hudVer(pos) === 2; HUD.ver = v2 ? 2 : 1;
  document.body.classList.toggle('hudV2', v2);
  // (el rectángulo de los botones de arriba a la izquierda: lo que el Lua de un modo de juego escriba ahí se corre abajo)
  const ri = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }, sumar = (a, b, c, d) => { ri.x0 = Math.min(ri.x0, a); ri.y0 = Math.min(ri.y0, b); ri.x1 = Math.max(ri.x1, c); ri.y1 = Math.max(ri.y1, d); };
  if (!tactil) { const ai = $('arribaIz'); if (ai) { const r = ai.getBoundingClientRect(); if (r.width > 0) sumar(r.left, r.top, r.right, r.bottom + 12); } }
  // (las filas de arriba a la izquierda —sistema, crear, teclas de los mods—: los que se ven, en fila y sin huecos; en el
  // editor se ven todos)
  const edit = typeof CTL !== 'undefined' && CTL.edit, seVe = (q) => { const e = document.querySelector(q); return !!e && (edit || (e.style.display !== 'none' && !e.classList.contains('oc'))); };
  const propioDe = (sel) => { const o = pos[sel]; return !!(o && o.length === 3 && o.every(Number.isFinite)); };
  const zp = !v2 && typeof hudZonasPos === 'function' ? hudZonasPos(seVe, pos._orden) : {};
  const hab = [], sa = typeof PANT !== 'undefined' && PANT.rot ? { l: 0, r: 0, t: 0, b: 0 } : hudSegura(); HUD.sa = sa;
  // (la nueva: los que el jugador movió no ocupan lugar en las columnas, que siguen sin huecos)
  const V2 = v2 ? hudV2Pos(W, H, k, f, sa, (q) => seVe(q) && !propioDe(q), pos._orden) : null; HUD.v2 = V2;
  // (en un celular apaisado y bajo —800×360, 915×412— las tres filas se juntan un poco para que la última, la de las teclas
  // de los mods, no baje a la zona de la palanca, que empieza al 45 % del alto; nunca a menos de 6 px entre fila y fila)
  const tB = Math.max(76 * k, 32 * f / 0.8), vf = typeof HUD_ZONAS === 'undefined' ? 1 : Math.min(1, Math.max((tB + 6) / (HUD_ZPASO * kb), (H * 0.45 - 6 - tB / 2 - sa.t) / (-HUD_ZONAS.hab.y * kb)));
  HUD.ef = {};
  for (const [sel, ax, ay, x0, y0, s0, mn] of HUD_TACTIL) {
    const e = document.querySelector(sel); if (!e) continue;
    const o = pos[sel], propio = propioDe(sel), z = !propio && zp[sel], [x, y, s] = propio ? o : z ? [z[0], z[1] * vf, s0] : [x0, y0, s0];   // (los que movió el jugador en Controles)
    if (!tactil && !e.classList.contains('bt-t')) { e.style.left = e.style.top = e.style.width = e.style.height = ''; continue; }
    // (más chicos en el mismo lugar: el centro de cada botón no se mueve, así no se pegan a los bordes; en un celular chico
    // no bajan del mínimo, que sigue al tamaño elegido en Ajustes)
    const sx = ax === 0 ? sa.l : ax === 1 ? -sa.r : 0, sy = ay === 1 ? sa.t : ay === 0 ? -sa.b : 0, n2 = !propio && V2 && V2.pos[sel];
    let t = propio ? s * k : Math.max(s * k, (mn || 0) * f / 0.8), cx = ax * W + x * kb + sx, cy = H - (ay * H + y * kb) + sy;
    if (n2) [cx, cy, t] = n2;
    // (dónde quedó, en las unidades del editor: al arrastrarlo arranca de ahí y no salta)
    HUD.ef[sel] = [Math.round((cx - ax * W - sx) / kb * 10) / 10, Math.round((H - ay * H + sy - cy) / kb * 10) / 10, Math.round(t / k * 10) / 10];
    Object.assign(e.style, { left: (cx - t / 2).toFixed(1) + 'px', top: (cy - t / 2).toFixed(1) + 'px', width: t.toFixed(1) + 'px', height: t.toFixed(1) + 'px', right: 'auto', bottom: 'auto' });
    if (tactil && /^#bgmb/.test(sel) && (edit || !e.classList.contains('oc'))) hab.push([cx, cy, t]);
    if (tactil && ax === 0 && ay === 1 && cy < H * 0.45) sumar(cx - t / 2, cy - t / 2, cx + t / 2, cy + t / 2 + 14);   // (en la compu los táctiles no se ven: no ocupan lugar)
  }
  HUD.resIz = ri.x1 > ri.x0 ? ri : null;
  // (el área para el dedo de cada botón: hasta 44 px aunque se vea más chico, pero sin meterse en la de otro que se ve —a lo
  // sumo hasta la mitad del hueco entre los dos—: con los controles al 60 % los botones quedan cerca y el dedo no tiene que
  // caer en el de al lado)
  { const L = []; for (const [sel] of HUD_TACTIL) { const e = document.querySelector(sel); if (!e || !e.style.width) continue; const t = parseFloat(e.style.width);
      L.push({ e, t, cx: parseFloat(e.style.left) + t / 2, cy: parseFloat(e.style.top) + t / 2, ve: edit ? e.classList.contains('ctlVer') : e.style.display !== 'none' && !e.closest('.oc') }); }
    for (const a of L) { let h = Math.max(0, (44 - a.t) / 2); if (h > 0) for (const c of L) if (c !== a && c.ve) h = Math.min(h, Math.max(0, (Math.hypot(a.cx - c.cx, a.cy - c.cy) - a.t / 2 - c.t / 2) / 2));
      a.e.style.setProperty('--hit', h.toFixed(1) + 'px'); } }
  // (la nueva: las balas, dentro del recuadro del arma, abajo, en vez de su nombre)
  const mu = $('muni'), aa = $('armaAct');
  if (mu) {
    if (v2 && tactil && aa && aa.style.left) { const l = parseFloat(aa.style.left), tp = parseFloat(aa.style.top), w = parseFloat(aa.style.width), h = parseFloat(aa.style.height); Object.assign(mu.style, { left: (l + w / 2).toFixed(1) + 'px', top: (tp + h - 3).toFixed(1) + 'px', right: 'auto' }); }
    else mu.style.left = mu.style.top = mu.style.right = '';
  }
  if (typeof vozHudUbicar === 'function') vozHudUbicar();   // (el panel de quién habla, en el hueco que queda: voz.js)
  // (la placa detrás de las teclas de los mods: se ven como un grupo aparte del sistema; con su nombre abajo)
  let pl = $('hudHab'); if (!pl && hab.length) { pl = document.createElement('div'); pl.id = 'hudHab'; const tc = $('tactil'); if (tc) tc.insertBefore(pl, tc.firstChild); }
  if (pl) { if (!hab.length) pl.style.display = 'none'; else { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [cx, cy, t] of hab) { x0 = Math.min(x0, cx - t / 2); x1 = Math.max(x1, cx + t / 2); y0 = Math.min(y0, cy - t / 2); y1 = Math.max(y1, cy + t / 2 + t * 0.42); } const m = 6 * Math.max(0.6, k / 0.559); Object.assign(pl.style, { display: '', left: (x0 - m).toFixed(1) + 'px', top: (y0 - m).toFixed(1) + 'px', width: (x1 - x0 + 2 * m).toFixed(1) + 'px', height: (y1 - y0 + 2 * m).toFixed(1) + 'px' }); } }
}
// cada cuadro (sólo si cambia algo): qué botones se ven según el arma, si hay algo para usar y si vas en un vehículo
// (el modo táctil se prende con el primer toque, y los botones MOD y micrófono aparecen después: cuando cambia algo de eso
// o el tamaño de la pantalla, se vuelven a ubicar; si no, quedaban todos amontonados en la esquina)
function hudPaso() {
  const tactil = document.body.classList.contains('tactil');
  if (tactil !== HUD.tac || HUD.w !== VW() || HUD.h !== VH() || HUD.f !== hudTam() || (++HUD.c % 3 === 0 && hudFirma() !== HUD.n)) hudDisponer();   // (cada 3 cuadros: antes 10, y un botón que aparecía se veía un rato fuera de lugar)
  if (!tactil || (typeof CTL !== 'undefined' && CTL.edit)) return;
  const arma = ARM.lista[ARM.i] || '', veh = !!JUG.vehiculo, usar = !!($('usarTxt').textContent || (!veh && entidadCerca()));
  const vt = veh ? (JUG.vehiculo.veh && JUG.vehiculo.veh.tipo) || '' : '', aire = vt === 'heli' || vt === 'avion', tierra = veh && !aire && vt !== 'asiento';
  if (arma !== HUD.arma || veh !== HUD.veh || usar !== HUD.usar || vt !== HUD.vt) {
    HUD.arma = arma; HUD.veh = veh; HUD.usar = usar; HUD.vt = vt;
    // (sin cargador no hay nada que recargar: el celular, las de golpe y las pistolas del sandbox; las de los mods de GMod
    // sí lo muestran, porque su Lua usa la R. Con el celular en la mano el botón quedaba pegado al borde del celular)
    const Da = typeof DEF_ARMAS !== 'undefined' ? DEF_ARMAS[arma] : null;
    const fis = /^(PhysicsGun|GravityGun)$/.test(arma), sinBala = /^(PhysicsGun|GravityGun|ToolBaton|Hands|Camera|Celular)$/.test(arma) || !!(Da && Da.tipo !== 'gmswep' && !(Da.car > 0));
    // (en un auto, una moto o un asiento no hay palanca de caminar: se dobla con las flechas; en el aire sí, para inclinar)
    document.body.classList.toggle('enVeh', veh); document.body.classList.toggle('vehAire', aire);
    const ver = (id, si) => { const e = $(id); if (e) e.classList.toggle('oc', !si); };
    ver('brecargar', !veh && !sinBala); ver('bdisp2', !veh && (fis || arma === 'ToolBaton')); ver('busar', usar && !veh); ver('bborrar', !veh && !(typeof NOC !== 'undefined' && NOC.on));   // (de noche en la pizzería no hay props: el botón taparía la energía)
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
  // (la nueva: con balas, el número va dentro del recuadro del arma en vez del nombre)
  { const mu = $('muni'), cm = !!(mu && mu.textContent); if (cm !== HUD.cm) { HUD.cm = cm; document.body.classList.toggle('conMuni', cm); } }
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
