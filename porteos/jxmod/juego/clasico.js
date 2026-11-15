// ---------------- JXMod: el menú principal clásico (el de la 3.3, mejorado) ----------------
// Después de la portada (3.4) y del depósito (3.5) los jugadores pidieron el de antes («un menú simple pero no complejo de
// entender») y el dueño: «mejorá el viejo nomás, el minimalista negro... agregá detalles, rasgaduras... animaciones». Es el
// de la 3.3 (commit 27f401f) con la misma estructura, el mismo orden y los mismos lugares:
//  · arriba a la izquierda el logo JXM; debajo, la lista de opciones en barras negras, en tres grupos (Empezar partida
//    nueva, Multijugador y Social; Mods y mapas, Crear un mapa, Personajes y Opciones; Salir), la elegida en amarillo;
//  · abajo, la barra con los mods activos, el idioma, tu nombre (con la cuenta de Google, si la hay), Discord y TikTok;
//  · abajo a la derecha la versión (con Actualizar al lado, en la app o si la web avisa de una nueva) y arriba a la
//    derecha La grieta (el evento: qué es y su estado; no se apaga);
//  · de fondo, el mundo vivo de la 3.3: las escenas del juego con la grieta que pasan solas (inicio.js, .rbBg), ahora en
//    video (fondovideo.js: renders del juego en bucle; con poco movimiento o Bajos, las fotos).
// Lo nuevo es el detalle: barras con el borde de la punta roto, raspones y grano (una textura de ruido hecha una sola vez en
// un canvas), una cinta sobre el logo, una línea amarilla gastada, íconos chicos, y animaciones que terminan: la entrada
// (las barras se rasgan de izquierda a derecha, una tras otra), un barrido de luz al pasar o al tomar el foco, un golpe
// corto al tocar, el logo con un glitch cada tanto, y brasas que suben cuando cambia la escena. Con «menos movimiento»
// (prefers-reduced-motion) o Gráficos Patata, nada se mueve; en Bajos, menos. Con la foto de fondo (Bajos, o si el video no
// anda), se agranda despacio (como en la 3.3) pero de a saltos invisibles —6 por segundo, menos de medio píxel cada uno— así la
// placa compone 6 cuadros por segundo en vez de 60; con el video, la capa queda quieta (el video ya tiene su cámara).
// En un celular apaisado no entran el logo, las 8 opciones de 44 px y la barra de abajo uno arriba del otro: ahí va igual que
// en la 3.3, apretado (el logo un poco más chico, lo que se toca más grande que lo que se ve). Ver pruebas/menu_clasico.mjs.
const CL = { el: null, lista: null, abajo: null, arriba: null, verG: null, logo: null, acento: null, brasas: null, ac: null, obs: null, modo: '', sel: null,
  tecla: false, pad: { on: false, ant: {}, rep: 0 }, tGl: 0, tEnc: 0, tBr: 0, firma: '', ins: { l: 0, r: 0, t: 0, b: 0 }, entradas: 0 };
const CL_G = [['nueva', 'multi', 'social'], ['tienda', 'crear', 'personajes', 'opciones'], ['salir']];
const CL_K = CL_G.flat();
const CL_ICO = { nueva: 'jugar', multi: 'mundo', social: 'gente', tienda: 'mods', crear: 'martillo', personajes: 'persona', opciones: 'ajustes', salir: 'salir' };
// (cuánto se mueve: «quieto» sin animaciones —menos movimiento pedido por el aparato, o Gráficos Patata—; «bajo», sólo la
// entrada corta, el barrido y el golpe; «pleno», todo)
const CL_MQ = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null, clReducido = () => !!(CL_MQ && CL_MQ.matches);
const clNivel = () => (clReducido() || (typeof GFX !== 'undefined' && GFX.nombre === 'patata') ? 'quieto' : typeof GFX !== 'undefined' && GFX.nombre === 'bajo' ? 'bajo' : 'pleno');
const clVisible = () => !!(CL.el && !CL.el.classList.contains('oc') && RB.el && !RB.el.classList.contains('oc'));

// ======================= las texturas (una sola vez, en un canvas y en SVG) =======================
// El grano y los raspones de las placas: un cuadrado de 160 px de ruido (puntitos claros y oscuros, casi transparentes) con
// algunas rayas finas en diagonal; cada barra lo usa corrido a otro lugar, así no se nota que se repite. Las rasgaduras: la
// punta de cada barra (los últimos 48 px), con el borde roto y mellas chicas arriba y abajo, en cuatro variantes; también
// la esquina rota del logo, la cinta y la línea amarilla gastada. Con una semilla fija: el mismo dibujo en cada carga.
let CL_TEX = null;
function clAzar(semilla) { let s = semilla >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function clSvg(vb, cuerpo) { return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="none">${cuerpo}</svg>`)}")`; }
function clTexturas() {
  if (CL_TEX) return CL_TEX;
  const T0 = (CL_TEX = { grano: '', rasgas: [], rasgasR: [], chip: '', chipR: '', logo: '', cinta: '', linea: '' });
  const rnd = clAzar(0x4a584d);
  // la punta rota de una barra: 48 unidades de ancho y 100 de alto (se estira al alto de la barra); el borde de la derecha
  // entra hasta 13 unidades, con picos; arriba y abajo, mellas de hasta 3 (1 a 2 px en la barra)
  const punta = (an, hondo, mella, n) => {
    const p = [[0, 0]];
    for (let x = 4; x < an - hondo; x += 4 + rnd() * 7) p.push([x, rnd() < 0.35 ? rnd() * mella : 0]);
    let y = 0; while (y < 100) { p.push([an - hondo * (0.15 + 0.85 * rnd()), y]); y += 5 + rnd() * n; }
    p.push([an - hondo * (0.2 + 0.8 * rnd()), 100]);
    const ab = []; for (let x = an - hondo; x > 4; x -= 4 + rnd() * 7) ab.push([x, rnd() < 0.35 ? 100 - rnd() * mella : 100]);
    p.push(...ab, [0, 100]);
    return p;
  };
  const camino = (p, espejo, an) => 'M' + p.map(([x, y]) => `${(espejo ? an - x : x).toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z';
  for (let i = 0; i < 4; i++) { const p = punta(48, 13, 3, 11); T0.rasgas.push(clSvg('0 0 48 100', `<path d="${camino(p, false, 48)}"/>`)); T0.rasgasR.push(clSvg('0 0 48 100', `<path d="${camino(p, true, 48)}"/>`)); }
  { const p = punta(24, 6, 4, 18); T0.chip = clSvg('0 0 24 100', `<path d="${camino(p, false, 24)}"/>`); T0.chipR = clSvg('0 0 24 100', `<path d="${camino(p, true, 24)}"/>`); }
  // la esquina rota del logo (abajo a la derecha de la placa) y una mella arriba
  {
    const P = [[0, 0], [60.5, 0], [61.4, 11.5], [62.3, 9.4], [63.6, 13.2], [64.8, 0], [100, 0], [100, 58]];
    for (let y = 58; y < 100; y += 3 + rnd() * 5) P.push([100 - (y - 58) * 0.22 - rnd() * 4.5, y]);
    P.push([86, 100], [0, 100]);
    T0.logo = clSvg('0 0 100 100', `<path d="M${P.map(([x, y]) => x.toFixed(1) + ' ' + y.toFixed(1)).join('L')}Z"/>`);
  }
  // la cinta: un rectángulo con las puntas cortadas en zigzag
  { const P = [[0, 8]]; for (let y = 0; y <= 100; y += 12.5) P.push([4 + rnd() * 5, y]); const Q = []; for (let y = 100; y >= 0; y -= 12.5) Q.push([95 - rnd() * 5, y]);
    T0.cinta = clSvg('0 0 100 100', `<path d="M${P.concat(Q).map(([x, y]) => x.toFixed(1) + ' ' + y.toFixed(1)).join('L')}Z"/>`); }
  // la línea amarilla gastada: tramos con huecos chicos y saltados, de opacidad pareja (sólo se ve el desgaste)
  { let x = 0, s = ''; while (x < 100) { const L = 2 + rnd() * 14, a = rnd() < 0.12 ? 0.35 : 1; s += `<rect x="${x.toFixed(1)}" y="${(rnd() * 12).toFixed(1)}" width="${L.toFixed(1)}" height="${(88 - rnd() * 20).toFixed(1)}" fill-opacity="${a}"/>`; x += L + (rnd() < 0.3 ? 0.6 + rnd() * 2.2 : 0); }
    T0.linea = clSvg('0 0 100 100', s); }
  // el grano: en un canvas (después del primer cuadro: no atrasa el primer toque)
  const hacer = () => {
    try {
      const N = 160, c = document.createElement('canvas'); c.width = c.height = N;
      // (un lienzo de memoria —willReadFrequently—: con uno de la placa, ponerle los puntos y pasarlo a PNG tardaba 200 ms en un
      // aparato lento)
      const g = c.getContext('2d', { willReadFrequently: true }), im = g.createImageData(N, N), d = im.data, r2 = clAzar(0x6772616e);
      for (let i = 0; i < N * N; i++) {
        const r = r2(), j = i * 4;
        if (r < 0.085) { d[j] = d[j + 1] = d[j + 2] = 255; d[j + 3] = 10 + r2() * 30; }
        else if (r < 0.19) { d[j] = d[j + 1] = d[j + 2] = 0; d[j + 3] = 16 + r2() * 30; }
      }
      g.putImageData(im, 0, 0);
      // los raspones: rayas finas en diagonal (también del otro lado del borde, así el cuadrado se repite sin corte)
      g.lineCap = 'round';
      for (let k = 0; k < 9; k++) {
        const x = r2() * N, y = r2() * N, L = 24 + r2() * 70, a = -0.5 + r2() * 0.3, cl = k % 3 === 2;
        g.strokeStyle = cl ? `rgba(0,0,0,${0.12 + r2() * 0.1})` : `rgba(255,255,255,${0.05 + r2() * 0.06})`; g.lineWidth = 0.5 + r2() * 0.8;
        for (const [ox, oy] of [[0, 0], [-N, 0], [N, 0], [0, -N], [0, N]]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * L, y + oy + Math.sin(a) * L); g.stroke(); }
      }
      c.toBlob((b) => { if (!b) return; T0.grano = URL.createObjectURL(b); if (CL.el) CL.el.style.setProperty('--clGrano', `url(${T0.grano})`); if (typeof pnGranoPoner === 'function') pnGranoPoner(T0.grano); });
    } catch (e) {}
  };
  // (cuando el aparato está libre, después de que el menú se puede tocar: la placa se ve igual sin el grano un momento)
  const libre = window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 2500 }) : (f) => setTimeout(f, 1200);
  setTimeout(() => libre(hacer), 600);
  return T0;
}
function clTexturasPoner() {
  const T0 = clTexturas(), st = CL.el.style, rtl = RB.el.dir === 'rtl';
  if (T0.grano) st.setProperty('--clGrano', `url(${T0.grano})`);
  (rtl ? T0.rasgasR : T0.rasgas).forEach((u, i) => st.setProperty('--clRasga' + i, u));
  st.setProperty('--clRasgaChip', rtl ? T0.chipR : T0.chip); st.setProperty('--clRasgaLogo', T0.logo); st.setProperty('--clCintaM', T0.cinta); st.setProperty('--clLineaM', T0.linea);
}

// ======================= armar la página =======================
function clCrear(home) {
  CL.el = home; CL.ac = new AbortController(); const sig = { signal: CL.ac.signal }; RB.el.classList.add('clOn');
  home.innerHTML = `<div class="clGrano" aria-hidden="true"></div><div class="clBrasas" aria-hidden="true"></div>
    <div class="clLogo"><img class="rbLogo clLogoI" alt="JXMod" src="${LOGO_RB}" draggable="false"><img class="rbLogo clLogoG clLogoG1" alt="" src="${LOGO_RB}" draggable="false" aria-hidden="true"><img class="rbLogo clLogoG clLogoG2" alt="" src="${LOGO_RB}" draggable="false" aria-hidden="true"><i class="clCinta" aria-hidden="true"></i></div>
    <i class="clAcento" aria-hidden="true"></i>
    <nav class="clLista"></nav><div class="clArriba"></div><div class="clAbajo"></div><div class="clVerG"></div><i class="clSonda" aria-hidden="true"></i>`;
  const q = (s) => home.querySelector(s);
  CL.lista = q('.clLista'); CL.abajo = q('.clAbajo'); CL.arriba = q('.clArriba'); CL.verG = q('.clVerG'); CL.logo = q('.clLogo'); CL.acento = q('.clAcento'); CL.brasas = q('.clBrasas');
  // (el logo nuevo —el tuyo, milogo.js— puede tener otra forma: se vuelve a encajar cuando termina de cargar)
  CL.logo.querySelector('.clLogoI').addEventListener('load', () => clEncajar(true));
  // la elegida: la que tiene el mouse encima o el foco (sin ninguna, «Empezar partida nueva»)
  CL.lista.addEventListener('pointerover', (e) => { const b = e.target.closest('.clIt'); if (b) clElegir(b.dataset.k); });
  CL.lista.addEventListener('pointerleave', () => { const a = document.activeElement; clElegir(a && a.closest && a.closest('.clIt') ? a.dataset.k : null); });
  home.addEventListener('focusin', (e) => { const b = e.target.closest && e.target.closest('.clIt'); clElegir(b ? b.dataset.k : null); });
  home.addEventListener('focusout', () => setTimeout(() => { if (!CL.lista) return; const a = document.activeElement, b = a && a.closest && a.closest('.clIt'); if (!CL.lista.matches(':hover')) clElegir(b ? b.dataset.k : null); }, 0));
  // el golpe al tocar (en la barra o en un botón de abajo)
  home.addEventListener('pointerdown', (e) => { const b = e.target.closest('.clIt, .clChip'); if (b && clNivel() !== 'quieto') { b.classList.remove('clGolpe'); void b.offsetWidth; b.classList.add('clGolpe'); } });
  home.addEventListener('animationend', (e) => { if (e.animationName === 'clGolpe') { const g = e.target.closest('.clGolpe'); if (g) g.classList.remove('clGolpe'); } });
  addEventListener('keydown', clTecla, Object.assign({ capture: true }, sig));
  addEventListener('pointerdown', () => { CL.tecla = false; }, Object.assign({ capture: true }, sig));
  addEventListener('resize', () => { if (clVisible()) { clearTimeout(CL.tEnc); CL.tEnc = setTimeout(() => clEncajar(), 60); } }, sig);
  try { document.fonts.addEventListener('loadingdone', () => { if (clVisible()) clEncajar(true); }, sig); } catch (e) {}
  addEventListener('gamepadconnected', () => { CL.pad.on = true; clMandoPaso(); }, sig);
  // (Actualizar de la web —herramientas/codigo_web.mjs— pone su botón en el body cuando hay una versión nueva)
  try { CL.obs = new MutationObserver(() => { if (CL.el) clActualizarVer(); }); CL.obs.observe(document.body, { childList: true }); } catch (e) {}
  try { if (navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)) { CL.pad.on = true; clMandoPaso(); } } catch (e) {}
  CL.tKen = setInterval(clKenPaso, 166);
}
// (al pasar al depósito: fuera la página, los oyentes, el observador, los relojes y el mando)
function clDestruir() {
  if (!CL.el) return;
  clMostrar(false);
  try { CL.ac.abort(); } catch (e) {} try { if (CL.obs) CL.obs.disconnect(); } catch (e) {}
  clearTimeout(CL.tGl); clearTimeout(CL.tGlF); clearTimeout(CL.tEnc); clearTimeout(CL.tBr); clearTimeout(CL.tEntra); clearInterval(CL.tKen);
  if (typeof fvApagar === 'function') fvApagar();
  for (const b of RB.el.querySelectorAll('.rbBg')) b.style.transform = '';
  CL.ken = ''; CL.kenT0 = null;
  CL.pad.on = false; CL.pad.corre = false; CL.el.remove();
  if (RB.el) RB.el.classList.remove('clOn', 'clQuieto', 'clBajo');
  Object.assign(CL, { el: null, lista: null, abajo: null, arriba: null, verG: null, logo: null, acento: null, brasas: null, ac: null, obs: null, modo: '', sel: null, firma: '' });
}
// lo que dice (se vuelve a armar al cambiar el idioma, el nombre, los mods o al volver de un panel)
function clDibujar() {
  if (!CL.el) return;
  clTexturasPoner();
  let i = 0;
  const lbl = (t) => `title="${esc(t)}" aria-label="${esc(t)}"`;
  // las opciones (como en la 3.3: tres grupos separados por un espacio; «Empezar partida nueva» la principal)
  CL.lista.setAttribute('aria-label', 'JXMod');
  CL.lista.innerHTML = CL_G.map((g) => g.map((k) => `<button class="clIt${k === 'nueva' ? ' clPri' : ''}" data-rb="${k}" data-k="${k}" style="--i:${i};--r:var(--clRasga${i % 4});--gx:${(i * 53) % 160}px;--gy:${(i++ * 97) % 160}px"><span class="clCuerpo">${glifo(CL_ICO[k], 'clIco')}<span class="clTx">${esc(T('m.' + k))}</span><i class="clBrillo" aria-hidden="true"></i></span></button>`).join('')).join('<i class="clSep" aria-hidden="true"></i>');
  // abajo (como en la 3.3, placas del mismo alto): los mods, el idioma (el globo y el código), tu nombre —con la cuenta de
  // Google al lado, si está— y las redes (sólo el ícono)
  const nm = modsTodos().filter((m) => PREFS.mods[m.id]).length, I = IDIOMAS_RB[PREFS.lang] || IDIOMAS_RB.en;
  const modsT = nm ? `${nm} ${T(nm === 1 ? 'modAct1' : 'modsAct')}` : 'Sandbox';
  CL.abajo.innerHTML = `<button class="clChip clMods" data-rb="tienda" ${lbl(modsT)}>${glifo('caja')}<span class="clChL">${esc(modsT)}</span><span class="clChC">${nm || 'S'}</span></button>
    <button class="clChip clIdi" data-rb="idioma" ${lbl(I[0])}>${glifo('mundo')}<span>${esc(I[1])}</span></button>
    <span class="clPerfil"><span class="clCuenta"></span><label class="clChip clNom">${glifo('persona')}<input id="rbNombre" maxlength="16" spellcheck="false" autocomplete="off" dir="auto" aria-label="${esc(T('b.nombre'))}"></label></span>
    ${RED_SOCIAL.map(([n, u, ic]) => `<button class="clChip clRed" data-rb="red" data-url="${u}" ${lbl(n)}>${ic}</button>`).join('')}`;
  const inp = CL.abajo.querySelector('#rbNombre'); inp.value = PREFS.nombre || ''; inp.placeholder = T('b.nombre');
  inp.oninput = () => nombrePoner(inp.value);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
  // arriba a la derecha, La grieta (el evento): abre su panel, con qué es (no se apaga: ya no tiene interruptor)
  CL.arriba.innerHTML = `<button class="clChip clEvt" data-rb="clEvento">${glifo('rayo')}<span class="clEvtN">${esc(T('dp.grieta'))}</span><b class="clEvtE"></b></button>`;
  // la versión (y el día del armado); a su lado, Actualizar
  CL.verG.innerHTML = `<button class="clChip clAct oc" data-rb="clAct">${glifo('bajar')}<span>${esc(T('pt.actualizar'))}</span></button>
    <div class="clVer" title="JXMod ${esc(VERSION_RB)} · ${esc(ARMADO_RB)}" dir="ltr"><span>JXMod</span> <b>${esc(VERSION_RB)}</b> <i>${esc(ARMADO_RB.split(' ')[0])}</i></div>`;
  clEventoPintar(); clActualizarVer(); clGlobos();
  if (typeof cuentaPintar === 'function') cuentaPintar();
  clEncajar(true); clearTimeout(CL.tEnc); CL.tEnc = setTimeout(() => clEncajar(true), 400);
}
function clEventoPintar() {
  const b = CL.arriba && CL.arriba.querySelector('.clEvt'); if (!b) return;
  const on = PREFS.evento !== false, t = `${T('dp.grieta')}: ${T(on ? 'pt.on' : 'pt.off')}`;
  b.classList.toggle('clEvtOn', on); b.querySelector('.clEvtE').textContent = T(on ? 'pt.on' : 'pt.off'); b.title = t; b.setAttribute('aria-label', t);
}
// el globito de Social: las solicitudes de amistad y los mensajes sin leer (social.js)
function clGlobos() {
  const b = CL.lista && CL.lista.querySelector('.clIt[data-k=social] .clCuerpo'); if (!b || typeof SOC === 'undefined') return;
  const n = Math.max(SOC.badge || 0, SOC.sol || 0); let e = b.querySelector('.soBadge');
  if (!n) { if (e) e.remove(); return; }
  if (!e) { e = document.createElement('em'); e.className = 'soBadge'; b.insertBefore(e, b.querySelector('.clBrillo')); } e.textContent = n > 99 ? '99+' : n;
}
// la cuenta de Google, al lado de tu nombre (cuenta.js): sin sesión «Iniciar sesión con Google», con sesión tu foto y tu nombre
// (en un celular, sólo la «G» o la foto: el texto queda para el lector de pantalla)
function clCuentaPintar() {
  const A = CL.abajo && CL.abajo.querySelector('.clCuenta'); if (!A) return false;
  let b = A.querySelector('.cuChip');
  if (!cuRequerida() && !cuDentro()) { if (b) b.remove(); A.parentElement.classList.remove('clConCu'); clEncajar(true); return true; }
  if (!b) { b = document.createElement('button'); b.className = 'clChip cuChip'; b.dataset.rb = 'cuenta'; A.appendChild(b); }
  const t = cuDentro() ? (CU.u && CU.u.nombre) || T('cu.cuenta') : T('cu.entrar');
  b.title = t; b.setAttribute('aria-label', t); A.parentElement.classList.add('clConCu');
  b.innerHTML = cuDentro() ? `${CU.u && CU.u.foto ? `<img class="cuFoto" src="${esc(CU.u.foto)}" alt="" referrerpolicy="no-referrer">` : CU_G}<span class="clCuT">${esc(t)}</span>` : `${CU_G}<span class="clCuT">${esc(t)}</span>`;
  clEncajar(true); return true;
}
function clActualizarVer() {
  const b = CL.verG && CL.verG.querySelector('.clAct'); if (!b) return;
  const web = !!document.getElementById('jxAct'), si = depActNativo() || web;
  if (b.classList.contains('oc') === !si) return;
  b.classList.toggle('oc', !si); b.classList.toggle('clHay', web); clEncajar(true);
}

// ======================= encajar en la pantalla =======================
// Como en la 3.3: arriba a la izquierda el logo, debajo la lista (los mismos tres grupos) y abajo la barra y la versión, con
// las medidas de la 3.3 en % del alto del juego. Lo que se toca: la barra entera más el espacio de arriba y de abajo (las
// barras son contiguas; la placa negra va 0,3 % más adentro, así entre barras se ve el 0,6 % de la 3.3) y, en los bordes de
// los grupos, la mitad del espacio entre grupos (un pseudo-elemento invisible, sin pisar a la vecina).
// En la compu y la tablet entra todo con 44 px o más. En un celular apaisado (360 a 412 px de alto) no entran el logo, las 8
// opciones de 44 px y la barra uno arriba del otro (hacen falta unos 510 px): ahí va igual que en la 3.3 —el pedido de los
// jugadores es «el menú viejo»— con el logo un poco más chico (13 % del alto en vez de 15 %), menos margen, las placas de
// abajo de 32 a 34 px a la vista y 44 px para tocar (se estiran hacia el borde de abajo), y las opciones con todo el alto que
// queda: unos 34 px a la vista y 36 a 38 para tocar en 873×402 (la 3.3: 27 y 30). Ver pruebas/menu_clasico.mjs.
// Respeta la muesca (safe-area) y, en árabe, todo se espeja (la versión queda del otro lado, como en la 3.3).
function clInsets() {
  const s = CL.el && CL.el.querySelector('.clSonda'); if (!s) return;
  const c = getComputedStyle(s), n = (v) => parseFloat(v) || 0;
  CL.ins = { l: n(c.paddingLeft), r: n(c.paddingRight), t: n(c.paddingTop), b: n(c.paddingBottom) };
}
function clEncajar(forzar) {
  if (!clVisible() || !CL.lista.firstChild) return;
  const el = CL.el, W = el.clientWidth || VW(), H = el.clientHeight || VH(), vh = H / 100, rtl = RB.el.dir === 'rtl';
  clInsets();
  const logoI = CL.logo.querySelector('.clLogoI'), asp = logoI.naturalWidth && logoI.naturalHeight ? logoI.naturalWidth / logoI.naturalHeight : 3.21;
  const firma = [W, H, CL.ins.l, CL.ins.r, CL.ins.t, CL.ins.b, PREFS.lang, asp.toFixed(3), CL.abajo.childElementCount, CL.verG.querySelector('.clAct.oc') ? 0 : 1, CL.abajo.querySelector('.cuChip') ? 1 : 0].join('|');
  if (firma === CL.firma && !forzar) return;
  CL.firma = firma;
  const iS = rtl ? CL.ins.r : CL.ins.l, iE = rtl ? CL.ins.l : CL.ins.r;
  const M = Math.max(12, 5 * vh), xS = Math.max(M, iS + 10), xE = Math.max(M, iE + 10), chF = Math.max(14, 2.9 * vh);
  // la lista de la 3.3: letra de 4,3 % del alto, cada barra 1,1 de la letra más 2,1 % de relleno y 0,6 % entre barras; entre
  // grupos, 1,4 %
  const F0 = 4.3 * vh, P0n = F0 * 1.1 + 2.7 * vh, S0 = 1.4 * vh;
  const corto = H <= 440;
  // primero, con las medidas de la 3.3 (la lista con 44 px o más para tocar); si no entra, la versión apretada del celular
  const medidas = (apretado) => {
    const logoTop = Math.max(CL.ins.t + 4, (apretado ? 1.8 : corto ? 3 : 4.2) * vh), logoH = apretado ? Math.max(40, 12.5 * vh) : corto ? 15 * vh : Math.min(150, Math.max(40, 18.5 * vh));
    const chV = apretado ? Math.max(32, Math.min(44, 8 * vh)) : Math.max(44, Math.round(7.4 * vh)), bot = Math.max(CL.ins.b + 4, (apretado ? 2.5 : 3) * vh);
    // (lo que se toca de las placas de abajo: 44 px, estirándose primero hacia el borde de abajo y lo que falte hacia arriba)
    const ext = Math.max(0, 44 - chV), abajoT = Math.min(Math.max(0, bot - 2), ext), arribaT = ext - abajoT;
    // (entre el logo y la lista y entre Salir y la barra de abajo, 8 px de aire o más, como en la 3.3)
    const aire = apretado ? 8 : Math.max(8, 2.5 * vh), S = apretado ? Math.max(4, Math.min(8, S0)) : S0;
    // (medio píxel más de aire abajo: los altos se redondean a décimas y la suma de las 8 barras puede pasarse)
    const ini = logoTop + logoH + aire, fin = H - bot - chV - Math.max(aire, arribaT) - 0.6, lugar = fin - ini;
    return { logoTop, logoH, chV, bot, abajoT, arribaT, aire, S, ini, fin, lugar, P: (lugar - 2 * S) / 8 };
  };
  let m = medidas(false), modo = 'pila', P;
  if (8 * Math.max(44, P0n) + 2 * m.S <= m.lugar) P = Math.max(44, P0n);
  else if (m.P >= 44) P = m.P;
  else { m = medidas(true); modo = 'apretada'; P = Math.max(26, m.P); }
  // (la placa, 0,3 % del alto más adentro arriba y abajo —entre barras se ve el 0,6 % de la 3.3—; apretada, 0,75 px)
  const In = modo === 'apretada' ? 0.75 : Math.max(1, Math.min(4, 0.3 * vh));
  // (la letra de la 3.3; si la barra quedó más baja que la de la 3.3, en proporción, hasta 14 px)
  const F = Math.max(14, Math.min(F0, F0 * (P - 2 * In) / (P0n - 0.6 * vh)));
  const st = el.style, px = (v) => Math.round(v * 10) / 10 + 'px';
  st.setProperty('--clF', px(F)); st.setProperty('--clP', px(P)); st.setProperty('--clS', px(m.S)); st.setProperty('--clIn', px(In));
  st.setProperty('--clChH', px(m.chV)); st.setProperty('--clChF', px(Math.min(chF, m.chV * 0.44))); st.setProperty('--clLh', px(m.logoH)); st.setProperty('--clM', px(M));
  st.setProperty('--clChUp', px(m.arribaT)); st.setProperty('--clChDn', px(m.abajoT));
  el.classList.toggle('clApretada', modo === 'apretada'); CL.modo = modo;
  el.classList.remove('clCompacto', 'clMuyCompacto', 'clEnvuelve', 'clEvtCorto');
  // la lista: en el lugar entre el logo y la barra de abajo (centrada si sobra, como en la 3.3)
  const L = CL.lista;
  L.style.insetInlineStart = px(xS); L.style.maxWidth = px(W - xS - xE); L.style.top = px(m.ini);
  const sobra = m.lugar - L.offsetHeight; if (modo === 'pila' && sobra > m.aire * 2) L.style.top = px(m.ini + Math.min(sobra / 2, 4 * vh));
  // lo que se toca de cada opción: en los bordes de los grupos, la mitad del espacio entre grupos; la primera, el aire de
  // arriba; la última (Salir), hasta lo que se toca de la barra de abajo
  const its = [...L.querySelectorAll('.clIt')], top = parseFloat(L.style.top), finL = top + L.offsetHeight;
  const ini = new Set(), fin = new Set(); let n = 0; for (const g of CL_G) { ini.add(n); n += g.length; fin.add(n - 1); }
  its.forEach((b, i) => {
    const hT = i === 0 ? Math.max(0, m.aire - 1) : ini.has(i) ? m.S / 2 : 0;
    const hB = i === its.length - 1 ? Math.max(0, Math.min(m.S / 2 + 8, (H - m.bot - m.chV - m.arribaT) - finL - 0.5)) : fin.has(i) ? m.S / 2 : 0;
    b.style.setProperty('--hT', px(hT)); b.style.setProperty('--hB', px(hB));
  });
  // el logo (su recuadro de sombra se corre para que la placa quede en la línea de las barras, como en la 3.3)
  const lg = CL.logo, sombra = m.logoH * 0.09;
  lg.style.insetInlineStart = px(xS - sombra); lg.style.top = px(m.logoTop); lg.style.height = px(m.logoH); lg.style.width = px(m.logoH * asp);
  // la línea amarilla gastada, debajo de la placa del logo
  const ac = CL.acento; ac.style.insetInlineStart = px(xS); ac.style.top = px(m.logoTop + m.logoH * 0.93); ac.style.width = px(Math.min(m.logoH * asp * 0.62, L.offsetWidth)); ac.style.height = px(Math.max(2, m.logoH * 0.035));
  // abajo: la barra (en la columna de la lista) y la versión (del otro lado), en la misma línea
  const ab = CL.abajo, vg = CL.verG;
  ab.style.insetInlineStart = px(xS); ab.style.bottom = px(m.bot); ab.style.maxWidth = '';
  vg.style.insetInlineEnd = px(xE); vg.style.bottom = px(m.bot);
  const ancho = () => ab.scrollWidth, sitio = () => W - xE - xS - vg.offsetWidth - 10;
  if (ancho() > sitio()) el.classList.add('clCompacto');
  if (ancho() > sitio()) el.classList.add('clMuyCompacto');
  if (ancho() > sitio()) { el.classList.add('clEnvuelve'); ab.style.maxWidth = px(Math.max(160, sitio())); }
  // arriba a la derecha, La grieta (si no entra al lado del logo, sólo el ícono y una luz con el estado)
  const ar = CL.arriba; ar.style.insetInlineEnd = px(xE); ar.style.top = px(Math.max(CL.ins.t + 4, m.logoTop + (m.logoH - m.chV) * 0.5));
  const choca = () => W - xE - ar.offsetWidth < xS + m.logoH * asp - 2 * sombra + 8;
  if (choca()) el.classList.add('clEvtCorto');
  CL.medida = { W, H, modo, P, F, S: m.S, top, xS, lw: L.offsetWidth, chV: m.chV, logo: [xS - sombra, m.logoTop, m.logoH * asp, m.logoH] };
}

// ======================= mostrar =======================
function clMostrar(on) {
  if (!CL.el) return;
  on = !!on; const antes = clVisible();
  CL.el.classList.toggle('oc', !on);
  const nv = (CL.nivel = clNivel()); RB.el.classList.toggle('clQuieto', nv === 'quieto'); RB.el.classList.toggle('clBajo', nv === 'bajo');
  if (!on) { clearTimeout(CL.tGl); clElegir(null); clPausa(); if (typeof fvActualizar === 'function') fvActualizar(true); return; }
  clElegir(null); clEncajar(true); clActualizarVer(); clEventoPintar();
  // la entrada: las barras se rasgan una tras otra, el logo aparece con un glitch, la barra de abajo sube (sólo al aparecer:
  // al cargar, al volver de una partida o de un panel, al cambiar de menú)
  if (!antes) clEntrada();
  clGlitchLuego(); clPausa(); if (typeof fvActualizar === 'function') fvActualizar(true);
}
function clEntrada() {
  if (!CL.el) return;
  CL.el.classList.remove('clEntra'); void CL.el.offsetWidth;
  if (clNivel() === 'quieto') return;
  CL.el.classList.add('clEntra'); CL.entradas++;
  clearTimeout(CL.tEntra); CL.tEntra = setTimeout(() => { if (CL.el) CL.el.classList.remove('clEntra'); }, 1600);
  if (clNivel() === 'pleno') { clearTimeout(CL.tBr); CL.tBr = setTimeout(() => clBrasas(7), 380); }
}
// el fondo que se agranda despacio, como en la 3.3 (de 1,02 a 1,13 y un poco a la izquierda, ida y vuelta en 26 s), pero de
// a saltos: 6 por segundo —menos de medio píxel cada uno en un celular—, 2 con Gráficos bajos y ninguno sin movimiento. Con
// una animación de CSS el navegador recalculaba el estilo en cada cuadro (60 por segundo) aunque la placa sólo cambiara 6
// veces; así, sólo cuando cambia (la capa va aparte —will-change—: mover no la vuelve a pintar)
// (con el fondo en video —fondovideo.js— la cámara ya se mueve adentro del video: la capa queda quieta en 1,02, como sin
// movimiento; si el video deja de andar, el agrandado vuelve desde 1,02, sin salto)
function clKenPaso() {
  if (!CL.el || !RB.el || RB.el.classList.contains('oc') || CL.nivel === 'quieto') return;
  if (typeof fvActivo === 'function' && fvActivo()) { if (CL.ken !== 'video') { CL.ken = 'video'; CL.kenT0 = null; for (const b of RB.el.querySelectorAll('.rbBg')) b.style.transform = 'scale(1.02)'; } return; }
  if (CL.kenT0 == null) CL.kenT0 = performance.now();
  CL.kenN = (CL.kenN || 0) + 1; if (CL.nivel === 'bajo' && CL.kenN % 3) return;
  const t = ((performance.now() - CL.kenT0) / 1000) % 52, f = t < 26 ? t / 26 : 2 - t / 26, v = `scale(${(1.02 + 0.11 * f).toFixed(4)}) translateX(${(-1.6 * f).toFixed(3)}%)`;
  if (v === CL.ken) return; CL.ken = v; CL.kenPasos = (CL.kenPasos || 0) + 1;
  for (const b of RB.el.querySelectorAll('.rbBg')) b.style.transform = v;
}
// el glitch del logo: de vez en cuando (cada 11 a 19 s), 0,42 s
function clGlitchLuego() {
  clearTimeout(CL.tGl);
  if (clNivel() !== 'pleno') return;
  CL.tGl = setTimeout(() => { if (!clVisible() || RB.panel) return clGlitchLuego(); clGlitch(); clGlitchLuego(); }, 11000 + Math.random() * 8000);
}
function clGlitch() {
  const g = CL.logo; if (!g) return;
  g.classList.remove('clGlitch'); void g.offsetWidth; g.classList.add('clGlitch');
  clearTimeout(CL.tGlF); CL.tGlF = setTimeout(() => { if (CL.logo) CL.logo.classList.remove('clGlitch'); }, 500);
}
// las brasas: al cambiar la escena de fondo (cada 9 s, inicio.js) suben unas pocas chispas y se apagan (2,6 s como mucho)
function clBrasas(n) {
  if (!clVisible() || clNivel() !== 'pleno' || RB.panel || !CL.brasas) return;
  const B = CL.brasas, W = CL.el.clientWidth, H = CL.el.clientHeight, f = document.createDocumentFragment();
  for (let i = 0; i < (n || 9); i++) {
    const e = document.createElement('i'), s = 2 + Math.random() * 3.5, d = 1.5 + Math.random() * 1.1; e.className = 'clBrasa';
    e.style.cssText = `left:${(0.42 + Math.random() * 0.55) * W}px;--s:${s.toFixed(1)}px;--d:${d.toFixed(2)}s;--dl:${(Math.random() * 0.5).toFixed(2)}s;--h:${(0.18 + Math.random() * 0.28) * H}px;--dx:${(-30 + Math.random() * 60).toFixed(0)}px`;
    f.appendChild(e);
  }
  // (cada tanda se borra sola cuando terminó: 2,6 s como mucho; nunca más de 30 a la vez)
  if (B.childElementCount > 30) return;
  const tanda = [...f.childNodes]; B.appendChild(f);
  setTimeout(() => { for (const e of tanda) e.remove(); }, 2800);
}
// la elegida (amarilla): la del mouse o el foco; sin ninguna, «Empezar partida nueva». Al pasar a otra, el barrido de luz
function clElegir(k) {
  if (!CL.lista || CL.sel === k) return;
  CL.sel = k;
  for (const b of CL.lista.querySelectorAll('.clIt')) b.classList.toggle('clSel', b.dataset.k === k);
  CL.lista.classList.toggle('clHay', !!k);
}
// ---------------- la pausa del dibujo ----------------
// El fondo del clásico son las escenas (CSS): el lienzo del juego queda tapado, así que no se dibuja (principal.js). Con un
// panel que muestra tu personaje en 3D (Personajes, el Perfil de Social, Importar personaje) sí.
function clPausa() {
  if (typeof dibujoPausar !== 'function') return;
  // (de paso, si cambió la calidad en Ajustes o el pedido de menos movimiento: cuánto se mueve)
  if (CL.el) { const nv = clNivel(); if (nv !== CL.nivel) { CL.nivel = nv; RB.el.classList.toggle('clQuieto', nv === 'quieto'); RB.el.classList.toggle('clBajo', nv === 'bajo'); if (nv !== 'pleno') clearTimeout(CL.tGl); else if (clVisible()) clGlitchLuego(); } }
  const tres = !!MENU.lobby || (RB.el && RB.el.classList.contains('rb3d')) || (typeof PJI !== 'undefined' && PJI.vista3d);
  dibujoPausar(JUEGO.estado === 'principal' && !!CL.el && rbVisible() && !tres);
  // (el fondo en video: corre sólo si se ve —fondovideo.js—)
  if (typeof fvActualizar === 'function') fvActualizar();
}

// ======================= acciones (las llama inicioAccion primero) =======================
function clAccion(a, v, b) {
  switch (a) {
    case 'clEvento': inicioPanel('evento'); return true;
    case 'clAct': depActualizar(); return true;
  }
  return false;
}

// ======================= teclado y mando =======================
// Las flechas (o la cruceta) van a lo más cercano en esa dirección (arriba y abajo recorren la lista; al pasar del final
// vuelve al principio); Tab y Mayús+Tab, en orden (el juego ya no se queda con el Tab); Enter o A lo elige; Esc o B, en un
// panel, vuelve. Sin foco, la primera flecha va a «Empezar partida nueva».
const CL_ENCIMA = '#ajustes:not(.oc), #cuDlg:not(.oc), #tut:not(.oc), #pjiVen:not(.oc), #ctlEd:not(.oc), #cfDlg:not(.oc), .mpModal.ve, #carga:not(.oc):not(.fin)';
const clActiva = () => clVisible() && typeof JUEGO !== 'undefined' && JUEGO.estado === 'principal' && !document.querySelector(CL_ENCIMA) && !(window.__carga && window.__carga.listo === false);
function clFocos() {
  const vis = (e) => e.offsetWidth > 0 && !e.closest('.oc');
  return [...CL.el.querySelectorAll('.clIt, .clArriba button, .clAbajo button, .clAbajo input, .clVerG button')].filter(vis);
}
function clMover(dir) {
  const L = clFocos(), act = document.activeElement, i = L.indexOf(act);
  if (dir === 'sig' || dir === 'ant') { const j = i < 0 ? 0 : (i + (dir === 'sig' ? 1 : L.length - 1)) % L.length; L[j].focus(); return; }
  if (i < 0) { (CL.lista.querySelector('.clPri') || L[0]).focus(); return; }
  const its = [...CL.lista.querySelectorAll('.clIt')], k = its.indexOf(act);
  const rtl = RB.el.dir === 'rtl', d = { izq: [rtl ? 1 : -1, 0], der: [rtl ? -1 : 1, 0], arriba: [0, -1], abajo: [0, 1] }[dir];
  const c = (e) => { const r = depRect(e); return [r.x + r.w / 2, r.y + r.h / 2]; }, [ax, ay] = c(act);
  let mejor = null, md = Infinity;
  for (const e of L) {
    if (e === act) continue; const [x, y] = c(e), dx = x - ax, dy = y - ay;
    const p = dx * d[0] + dy * d[1], s = Math.abs(dx * d[1]) + Math.abs(dy * d[0]);
    if (p <= 4) continue; const dist = p + s * 2.2; if (dist < md) { md = dist; mejor = e; }
  }
  // (en la lista, arriba y abajo de a una; desde la primera hacia arriba, la última, y al revés)
  if (k >= 0 && (dir === 'arriba' || dir === 'abajo')) { const j = k + (dir === 'abajo' ? 1 : -1); if (j >= 0 && j < its.length) mejor = its[j]; else if (!mejor || dir === 'arriba') mejor = its[(j + its.length) % its.length]; }
  if (mejor) mejor.focus();
}
function clTecla(e) {
  const k = e.key;
  // (en un panel abierto desde el clásico, Esc vuelve: lo mismo que «Volver»)
  if (k === 'Escape' && RB.panel && rbVisible() && clVisible() === false && CL.el && JUEGO.estado === 'principal' && !document.querySelector(CL_ENCIMA)) {
    const v = RB.el.querySelector('.rbPan [data-rb=volver]'); if (v && v.offsetWidth) { e.preventDefault(); e.stopPropagation(); v.click(); } return;
  }
  if (!clActiva()) return;
  const t = e.target, enNom = t && t.id === 'rbNombre';
  CL.tecla = true;
  const dirs = { ArrowLeft: 'izq', ArrowRight: 'der', ArrowUp: 'arriba', ArrowDown: 'abajo' };
  if (enNom) { if (k === 'Tab' || k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); clMover(k === 'Tab' ? (e.shiftKey ? 'ant' : 'sig') : dirs[k]); } else { e.stopPropagation(); if (k === 'Escape') t.blur(); } return; }
  if (k === 'Tab') { e.preventDefault(); e.stopPropagation(); clMover(e.shiftKey ? 'ant' : 'sig'); return; }
  if (dirs[k]) { e.preventDefault(); e.stopPropagation(); clMover(dirs[k]); return; }
  if (k === 'Enter' || k === ' ') {
    const a = document.activeElement; e.stopPropagation();
    if (!a || !CL.el.contains(a)) { e.preventDefault(); clMover('abajo'); }
    return;   // (un botón con el foco lo aprieta el navegador solo)
  }
  if (k === 'Escape' && CL.el.contains(document.activeElement)) { e.stopPropagation(); document.activeElement.blur(); }
}
// (una sola vuelta por cuadro: «gamepadconnected» puede llegar con el lazo ya andando)
function clMandoPaso() { const P = CL.pad; if (P.corre) return; P.corre = true; requestAnimationFrame(clMandoCuadro); }
function clMandoCuadro() {
  const P = CL.pad; if (!P.on || !CL.el) { P.corre = false; return; }
  let pads = []; try { pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean); } catch (e) {}
  if (!pads.length) { P.on = false; P.corre = false; return; }
  requestAnimationFrame(clMandoCuadro);
  const g = pads[0], bt = (i) => !!(g.buttons[i] && g.buttons[i].pressed), ax = (i) => g.axes[i] || 0, ahora = performance.now();
  const est = { arriba: bt(12) || ax(1) < -0.6, abajo: bt(13) || ax(1) > 0.6, izq: bt(14) || ax(0) < -0.6, der: bt(15) || ax(0) > 0.6, a: bt(0), b: bt(1) };
  const nuevo = (k) => est[k] && !P.ant[k];
  if (clActiva()) {
    CL.tecla = true;
    for (const k of ['arriba', 'abajo', 'izq', 'der']) if (nuevo(k) || (est[k] && ahora > P.rep)) { clMover(k); P.rep = ahora + (nuevo(k) ? 420 : 160); break; }
    if (nuevo('a')) { const a = document.activeElement; if (a && CL.el.contains(a) && a.tagName === 'BUTTON') a.click(); else clMover('abajo'); }
    if (nuevo('b') && CL.el.contains(document.activeElement)) document.activeElement.blur();
  } else if (nuevo('b') && RB.el && RB.panel && rbVisible() && JUEGO.estado === 'principal') { const v = RB.el.querySelector('.rbPan [data-rb=volver]'); if (v) v.click(); }
  P.ant = est;
}
