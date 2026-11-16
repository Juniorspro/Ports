// ---------------- JXMod: los paneles del inicio con el lenguaje del clásico (3.7) ----------------
// El dueño, con capturas de su celular: «aún siguen blancas estas partes, y en otras muy pero muy junto y simple, sin
// decoración o animaciones. Me gustaría animaciones de verdad en los botones etc.». Todo lo que se abre desde el menú
// (Empezar partida nueva, Multijugador —con Crear server y LAN—, Social, Mods y mapas —con GMod, Crear un mod y los
// formularios—, Crear un mapa, Personajes, Ajustes, La grieta, la bienvenida y los carteles chicos) va con el lenguaje del
// menú clásico (clasico.js): placas negras con grano, rasgaduras, cinta, rayas de peligro finas, sombras duras, el amarillo
// para lo principal y la letra condensada. Un solo sistema: las variables (--pn…) y las piezas de juego/paneles.css (armar.py
// lo pone al final del <style>); este módulo pone las texturas y las animaciones:
//  · la entrada de cada panel: un rasgón oscuro con el filo amarillo lo cruza de un lado al otro y deja ver el contenido,
//    el sello con el número de la sección (el del menú: 01 Empezar partida… 06 Personajes, con su cinta de papel) golpea, las
//    rayas de peligro se estiran y el contenido baja en cascada (las tarjetas, las filas, las pestañas y el pie, una tras otra);
//  · al tocar: el golpe (el botón se hunde), una mancha de tinta desde el dedo; el principal «dispara» su flecha y el
//    «Entrar» de un server abre una brecha con rayas de peligro a lo largo de la fila;
//  · con el mouse o el foco (teclado o mando): un barrido de luz cruza lo que se elige, una vez;
//  · la marca de la pestaña elegida: una barra amarilla que se desliza de la que estaba a la nueva (y la nueva da un golpe);
//    elegir un mapa o un personaje: un sello sobre la tarjeta;
//  · los números (cuántos mapas, mods, servers, personajes) suben desde cero; mientras carga una lista, esqueletos con un
//    brillo que pasa unas pocas veces y para.
// Todas terminan solas (en menos de 1 s; los esqueletos, a los 4 s quedan quietos) y sólo mueven transform y opacity (la
// tinta y el rasgón llevan una máscara que se mueve con ellos). Con «menos movimiento» o Gráficos Patata nada se mueve; con
// Bajos, lo mínimo (el golpe, la marca de la pestaña y los interruptores). Nunca se demora un toque: el botón hace lo suyo
// en el momento y la animación acompaña. Ver pruebas/paneles_inicio.mjs.
const PN = { ok: false, p: null, clave: '', serie: 0, armado: 0, vistos: null, contados: null, marcas: {}, sels: {}, nivel: 'pleno', obs: null, obsAj: null, tEntra: 0, sobre: null, entradas: 0, cuentas: 0, ro: null, tAy: 0, cv: null };
// lo que se toca (con golpe y tinta) y dónde
const PN_RAIZ = '#rbInicio .rbPan, #ajustes, #cuDlg, #cfDlg, #rbInicio .mpModal, #ctlPanel, #armaAjPan, #ctlEd .ctlBarra';
const PN_TOCA = 'button, [data-rb]:not(select):not(input), .tiCard, label.rbBtnGris, label.rbBtnG, label.ajSw, .rbMapaG, .soIt';
// las listas que bajan en cascada al abrir: las del contenido (otra vez al cambiar de pestaña, categoría o vista) y las del
// marco —las pestañas, las categorías, el pie—, que bajan sólo al abrir el panel (al cambiar de pestaña quedan quietas)
const PN_CONTENIDO = '.rbGrid, .rbTiendaG, .mpLista, .soLista, .soIzq, .soAcc, .pjGrid, .lanCuerpo, .rbIdiomas, .gmkLista, .rbFichaAcc, .rbBienv';
const PN_LISTAS = PN_CONTENIDO + ', .rbForm > .rbCol, .rbCats, .rbPanCab .rbTabs, .tiCats, .rbPanPie';
// las pestañas con la marca que se desliza: [contenedor, 'h' (barra abajo) o 'v' (barra al costado)]
const PN_MARCAS = [['.rbPanCab .rbTabs', 'h'], ['.rbCats', 'h'], ['.rbSeg', 'h'], ['.tiCats', 'v'], ['.ajTabs', 'v'], ['.ajSeg', 'h']];
// las tarjetas que se eligen (al elegir otra, el sello)
const PN_ELIGE = '.rbGrid > .rbMapaG.sel, .pjGrid > .pjCard.sel, .soIzq .soIt.sel, .rbIdiomas > .sel, .rbIconos > .sel';
const pnNivel = () => (typeof clNivel === 'function' ? clNivel() : 'pleno');
const pnRot = () => document.documentElement.classList.contains('rot');

// ======================= las texturas (una vez, con semilla fija) =======================
// Las rasgaduras del clásico (clTexturas, clasico.js: la punta rota de las barras y de las placas chicas) y el grano, más
// lo propio de los paneles: el filo del rasgón de la entrada (alto, con dientes finos para que estirado al alto de un panel
// siga viéndose roto), la mancha de tinta (un borrón con salpicaduras) y la cinta. Van en el :root, así las usan también
// Ajustes y los carteles (fuera del inicio).
function pnTexturas() {
  const st = document.documentElement.style, T0 = typeof clTexturas === 'function' ? clTexturas() : null, rnd = typeof clAzar === 'function' ? clAzar(0x706e6c) : Math.random;
  const svg = (vb, c) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="none">${c}</svg>`)}")`;
  if (T0) {
    st.setProperty('--pnRasga', T0.chip); st.setProperty('--pnRasgaR', T0.chipR);
    st.setProperty('--pnRasgaG', T0.rasgas[1]); st.setProperty('--pnRasgaGR', T0.rasgasR[1]);
    st.setProperty('--pnCintaM', T0.cinta); st.setProperty('--pnLineaM', T0.linea);
    if (T0.grano) pnGranoPoner(T0.grano);
  }
  // la cinta de papel pegada sobre el sello del número: un pedazo con las puntas en zigzag, torcido (va de fondo del sello: nunca
  // tapa una letra ni algo que se toca)
  { const L = [], Rr = []; for (let i = 0; i <= 6; i++) { L.push([4 + (i % 2 ? 1.6 : 0) + rnd() * 0.8, 5 + i * (10 / 6)]); Rr.push([36 - (i % 2 ? 1.6 : 0) - rnd() * 0.8, 15 - i * (10 / 6)]); }
    const d = 'M' + [...L, ...Rr].map(([x, y]) => x.toFixed(2) + ' ' + y.toFixed(2)).join('L') + 'Z';
    st.setProperty('--pnCintaImg', svg('0 0 40 20', `<g transform="rotate(-13 20 10)"><path d="${d}" fill="#e7dcb8" fill-opacity=".93"/><path d="M6 8.2H34" stroke="#fff" stroke-opacity=".25" stroke-width=".8"/><path d="M6 12.6H34" stroke="#8a7a50" stroke-opacity=".18" stroke-width=".7"/></g>`)); }
  // el filo del rasgón: 60 de ancho y 1000 de alto; la parte llena a la derecha, el borde roto a la izquierda
  { const P = [[60, 0]]; let y = 0; while (y < 1000) { P.push([4 + rnd() * 22 + (rnd() < 0.18 ? 14 : 0), y]); y += 6 + rnd() * 22; } P.push([10 + rnd() * 12, 1000], [60, 1000]);
    const d = 'M' + P.map(([x, y2]) => x.toFixed(1) + ' ' + y2.toFixed(1)).join('L') + 'Z';
    st.setProperty('--pnRasgonM', svg('0 0 60 1000', `<path d="${d}"/>`));
    st.setProperty('--pnRasgonMR', svg('0 0 60 1000', `<path transform="matrix(-1 0 0 1 60 0)" d="${d}"/>`)); }
  // la mancha de tinta: un borrón redondo con el borde irregular y unas gotas alrededor
  { let d = ''; const n = 22; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, r = 34 + rnd() * 9 + (i % 5 === 0 ? 5 : 0); d += (i ? 'L' : 'M') + (50 + Math.cos(a) * r).toFixed(1) + ' ' + (50 + Math.sin(a) * r).toFixed(1); }
    let g = ''; for (let i = 0; i < 7; i++) { const a = rnd() * Math.PI * 2, r = 42 + rnd() * 6; g += `<circle cx="${(50 + Math.cos(a) * r).toFixed(1)}" cy="${(50 + Math.sin(a) * r).toFixed(1)}" r="${(1.5 + rnd() * 3).toFixed(1)}"/>`; }
    st.setProperty('--pnManchaM', svg('0 0 100 100', `<path d="${d}Z"/>${g}`)); }
}
// (el grano lo hace clasico.js en un rato libre: cuando está, también para los paneles)
function pnGranoPoner(u) { if (u) document.documentElement.style.setProperty('--pnGrano', `url(${u})`); }

// ======================= arrancar (la primera vez que se abre o se cierra un panel) =======================
function pnIniciar() {
  if (PN.ok) return; PN.ok = true;
  try { pnTexturas(); } catch (e) {}
  // (la pantalla baja —el celular acostado, 360 a 412 px de alto— por el alto del juego: con el celular parado el juego está
  // girado y las @media de la página ven el aparato)
  const baja = () => { const h = typeof VH === 'function' ? VH() : innerHeight; document.documentElement.classList.toggle('pnBaja', h <= 520); };
  baja(); addEventListener('resize', () => setTimeout(() => { baja(); pnAyudasPedir(); pnAjEncajarPedir(); }, 30));
  addEventListener('pointerdown', pnToque, { capture: true, passive: true });
  addEventListener('pointerover', pnSobre, { capture: true, passive: true });
  addEventListener('focusin', pnFoco, true);
  const P = RB.el && RB.el.querySelector('.rbPan');
  if (P && typeof MutationObserver === 'function') { PN.obs = new MutationObserver((L) => pnCambios(L, P)); PN.obs.observe(P, { childList: true, subtree: true }); }
  // (Ajustes: se arma de nuevo al abrirlo y las pestañas se eligen cambiando la clase)
  const A = document.getElementById('ajustesCaja');
  if (A && typeof MutationObserver === 'function') { PN.obsAj = new MutationObserver((L) => pnCambiosAj(L, A)); PN.obsAj.observe(A, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); }
}
// cuánto se mueve (lo de clasico.js: «menos movimiento» o Patata, nada; Bajos, lo mínimo), en el html: lo usan las reglas
function pnNivelPoner() {
  const nv = (PN.nivel = pnNivel()), h = document.documentElement.classList;
  if (h.contains('pnQuieto') !== (nv === 'quieto')) h.toggle('pnQuieto', nv === 'quieto');
  if (h.contains('pnBajo') !== (nv === 'bajo')) h.toggle('pnBajo', nv === 'bajo');
  return nv;
}
// lo que identifica lo que muestra el panel: si cambia (otra pestaña, categoría, vista o búsqueda) la lista vuelve a bajar
function pnClave(p) {
  const t = RB.t || {};
  if (p === 'tienda') return [t.tab, t.etq, t.vista, t.ficha || '', t.carpeta ? 1 : 0].join('|');
  if (p === 'nueva') return RB.cat || '';
  if (p === 'social' && typeof SOC !== 'undefined') return SOC.tab + '|' + (SOC.tab === 'amigos' ? SOC.sub : '');
  if (p === 'personajes' && typeof RBM !== 'undefined') return RBM.pjTab;
  return '';
}

// ======================= el panel: lo llama inicioPanel antes de dibujarlo =======================
function pnPanel(p, P) {
  pnIniciar(); const nv = pnNivelPoner();
  const antes = PN.p, clave = p ? pnClave(p) : ''; PN.p = p || null;
  if (!p) { PN.clave = ''; pnLimpiar(P); return; }
  const nuevo = p !== antes, otra = nuevo || clave !== PN.clave; PN.clave = clave;
  // (un panel que se abre de nuevo arranca con la marca y el sello en su lugar: no se deslizan desde lo de la vez anterior)
  if (nuevo) { for (const k in PN.marcas) if (!k.startsWith('aj')) delete PN.marcas[k]; PN.sels = {}; }
  // (si el panel se vuelve a dibujar en el medio de su entrada —tocaste un mapa enseguida—, lo nuevo aparece entero)
  if (!nuevo) P.classList.remove('pnEntra');
  if (nv === 'quieto') return;
  // (lo que llega dentro de los 0,6 s baja en cascada —y termina antes de 1,2 s—; lo que tarda más, una lista que viene de la
  // red, aparece de una: así a los 1,2 s de abrir no corre nada)
  if (otra) { PN.serie++; PN.armado = performance.now() + 600; if (nuevo || !PN.vistos) { PN.vistos = new Set(); PN.contados = new Set(); } PN.pend = nuevo ? 'entra' : 'lista'; }
  else PN.pend = '';
}
function pnLimpiar(P) {
  clearTimeout(PN.tEntra); if (!P) return;
  P.classList.remove('pnEntra'); for (const e of P.querySelectorAll('.pnRasgon')) e.remove();
}
// lo que cambió adentro del panel (después de dibujarse, antes de que se vea): la entrada, la cascada, las marcas, los sellos
function pnCambios(L, P) {
  if (!PN.p || P.classList.contains('oc')) return;
  pnAyudasPedir();
  const nv = PN.nivel; if (nv === 'quieto') return;
  let propio = true; for (const r of L) { for (const n of r.addedNodes) if (n.nodeType === 1 && !/(^| )pn[A-Z]/.test(n.className)) { propio = false; break; } if (!propio) break; }
  if (propio) return;   // (sólo lo que agrego yo: la tinta, la marca, el rasgón)
  if (PN.pend === 'entra') { PN.pend = ''; pnEntrada(P); }
  else if (PN.pend === 'lista') PN.pend = '';
  if (nv === 'pleno' && performance.now() < PN.armado) pnCascada(L);
  pnMarcas(P); pnElegidos(P);
  if (nv === 'pleno') pnContar(P);
}

// ---- la entrada: el rasgón, el sello y lo de arriba y abajo (las reglas: .pnEntra en paneles.css) ----
function pnEntrada(P) {
  clearTimeout(PN.tEntra); PN.entradas++;
  for (const e of P.querySelectorAll('.pnRasgon')) e.remove();
  if (P.classList.contains('pnEntra')) { P.classList.remove('pnEntra'); void P.offsetWidth; }   // (para que vuelva a empezar)
  P.classList.add('pnEntra');
  if (PN.nivel === 'pleno' && !P.classList.contains('pjV2') && !P.classList.contains('soP3d')) {
    const r = document.createElement('i'); r.className = 'pnRasgon'; r.setAttribute('aria-hidden', 'true'); P.appendChild(r);
    r.addEventListener('animationend', () => r.remove(), { once: true });
  }
  PN.tEntra = setTimeout(() => { P.classList.remove('pnEntra'); for (const e of P.querySelectorAll('.pnRasgon')) e.remove(); }, 1150);
}
// ---- la cascada: lo que aparece por primera vez desde que se abrió (o cambió de pestaña) baja, uno tras otro ----
function pnCascada(L) {
  const nuevos = new Map(), V = PN.vistos || (PN.vistos = new Set());
  // (lo del contenido, por lo que muestra el panel —PN.clave—: vuelve a bajar al cambiar de pestaña; lo del marco, una vez)
  const clave = (c, e) => (c.matches(PN_CONTENIDO) ? PN.clave + '|' : '') + String(c.getAttribute('class') || '').replace(/ ?pn\w+/g, '') + '>' + (e.dataset.rb || e.dataset.id || e.dataset.k || String(e.getAttribute('class') || '').replace(/ ?pn\w+/g, '') + ':' + (e.textContent || '').slice(0, 24));
  const sumar = (c, e) => {
    if (e.nodeType !== 1 || /(^| )pn[A-Z]/.test(e.className) || e.classList.contains('rbEsp') || !e.matches || e.matches(PN_LISTAS)) return;
    const k = clave(c, e); if (V.has(k)) return; V.add(k);
    let l = nuevos.get(c); if (!l) nuevos.set(c, (l = [])); l.push(e);
  };
  for (const r of L) {
    if (r.type !== 'childList' || !r.addedNodes.length) continue;
    const t = r.target, esLista = t.nodeType === 1 && t.matches(PN_LISTAS);
    for (const n of r.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (esLista) sumar(t, n);
      if (n.matches(PN_LISTAS)) for (const h of n.children) sumar(n, h);
      for (const c of n.querySelectorAll(PN_LISTAS)) for (const h of c.children) sumar(c, h);
    }
  }
  if (!nuevos.size) return;
  const todos = [];
  for (const [, l] of nuevos) l.forEach((e, i) => { e.style.setProperty('--pnK', Math.min(i, 10)); e.classList.add('pnSube'); todos.push(e); });
  setTimeout(() => { for (const e of todos) { e.classList.remove('pnSube'); e.style.removeProperty('--pnK'); } }, 650);
}
// ---- la marca de la pestaña elegida: se desliza de la que estaba a la nueva; la nueva da un golpe ----
// (pnMarca sólo anota cuál es la elegida —sin medir nada: medir acá, en medio del armado del panel, obligaba a armar la
// página dos veces y abrir Personajes tardaba un 48 % más que en la 3.6—; dónde está se lee en un ResizeObserver, que el
// navegador llama después de armar el cuadro y antes de dibujarlo: leer ahí no cuesta y la marca sale ya en su lugar. El
// observador se vuelve a armar con cada cambio del panel —así avisa una vez— y también avisa si la fila cambia después
// —pjEncajar o tiEncajar dejan la elegida con su nombre y las otras sólo con el ícono, la letra que termina de cargar,
// girar el celular—: ahí la marca va al lugar nuevo, sin deslizarse)
function pnMarcas(raiz) {
  for (const [sel, eje] of PN_MARCAS) for (const c of raiz.querySelectorAll(sel)) pnMarca(c, eje, sel);
  pnMarcasMirar();
}
function pnMarca(c, eje, sel) {
  const s = [...c.children].find((e) => e.classList.contains('sel') && !e.classList.contains('pnMarca'));
  let m = c.querySelector(':scope > .pnMarca');
  if (!s) { if (m) m.style.opacity = '0'; return; }
  if (!m) { m = document.createElement('i'); m.className = 'pnMarca pnMarca' + eje.toUpperCase(); m.setAttribute('aria-hidden', 'true'); m.style.opacity = '0'; c.appendChild(m); }
  m.dataset.k = (PN.p || 'aj') + sel; m.dataset.id = (s.dataset.rb || s.dataset.aj || s.dataset.mi || s.textContent).slice(0, 40);
}
function pnMarcasMirar() {
  if (typeof ResizeObserver !== 'function') { pnMarcasAjustar(); return; }
  if (!PN.ro) PN.ro = new ResizeObserver(() => { try { pnMarcasAjustar(); } catch (e) {} });
  PN.ro.disconnect();
  for (const m of document.querySelectorAll('.pnMarca')) { const c = m.parentElement; if (!c) continue; PN.ro.observe(c); for (const e of c.children) if (e !== m) PN.ro.observe(e); }
}
function pnMarcasAjustar() {
  // (primero se lee todo y después se escribe: así no se arma la página de nuevo entre una marca y otra)
  const L = [];
  for (const m of document.querySelectorAll('.pnMarca')) {
    const c = m.parentElement, h = !m.classList.contains('pnMarcaV');
    const s = c && [...c.children].find((e) => e !== m && e.classList.contains('sel'));
    if (!s || !s.offsetWidth) { L.push({ m }); continue; }
    const g = h ? { a: s.offsetLeft, b: s.offsetWidth } : { a: s.offsetTop, b: s.offsetHeight };
    // (hasta dónde llegan las pestañas: el punto de partida del deslizamiento no se sale de la fila ni la hace deslizable)
    const lim = Math.max(h ? c.clientWidth : c.clientHeight, ...[...c.children].filter((e) => e !== m).map((e) => (h ? e.offsetLeft + e.offsetWidth : e.offsetTop + e.offsetHeight)));
    L.push({ m, s, g, h, lim });
  }
  for (const { m, s, g, h, lim } of L) {
    if (!s) { if (m.style.opacity !== '0') m.style.opacity = '0'; continue; }
    const k = m.dataset.k, id = m.dataset.id, ant = k ? PN.marcas[k] : null;
    if (ant && ant.id === id && Math.abs(g.a - (+m.dataset.a || 0)) < 0.5 && Math.abs(g.b - (+m.dataset.b || 0)) < 0.5 && m.style.opacity !== '0') continue;
    const tr = (x) => (h ? `translateX(${x}px)` : `translateY(${x}px)`), esc2 = (f) => (h ? `scaleX(${f})` : `scaleY(${f})`);
    for (const an of m.getAnimations()) an.cancel();
    m.style.opacity = ''; m.style[h ? 'width' : 'height'] = g.b + 'px'; m.style.transform = tr(g.a);
    m.dataset.a = g.a; m.dataset.b = g.b;
    if (k) PN.marcas[k] = { id, a: g.a, b: g.b };
    // (otra pestaña: se desliza de lo que medía la de antes a lo que mide la nueva, y la nueva da un golpe; si sólo cambió el
    // tamaño, o la fila es nueva —un panel que se abre—, va a su lugar)
    if (!ant || ant.id === id || PN.nivel === 'quieto') continue;
    const a0 = Math.min(Math.max(0, ant.a), Math.max(0, lim - 1)), b0 = Math.max(1, Math.min(ant.b, lim - a0));
    try {
      m.animate([{ transform: `${tr(a0)} ${esc2(b0 / Math.max(1, g.b))}` }, { transform: `${tr(g.a)} ${esc2(1)}` }], { duration: 300, easing: 'cubic-bezier(.3,.7,.2,1)' });
      s.animate([{ transform: 'scale(.93)' }, { transform: 'scale(1.025)', offset: 0.55 }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
    } catch (e) {}
  }
}
// ---- el sello al elegir una tarjeta (otro mapa, otro personaje, otro idioma) ----
function pnElegidos(P) {
  for (const s of P.querySelectorAll(PN_ELIGE)) {
    const c = s.parentElement, k = (PN.p || '') + '|' + (c.className || ''), id = s.dataset.rb || s.dataset.skin || s.textContent.slice(0, 30), ant = PN.sels[k];
    PN.sels[k] = id;
    if (ant === undefined || ant === id || PN.nivel !== 'pleno') continue;
    try {
      s.animate([{ transform: 'scale(1.07) rotate(-1.2deg)' }, { transform: 'scale(.98)', offset: 0.5 }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.3,.7,.3,1)' });
      pnFx(s, 'pnSello', 380, [{ opacity: 1, transform: 'scale(1.12)' }, { opacity: 0, transform: 'scale(1)' }]);
    } catch (e) {}
  }
}
// ---- los números que suben (cuántos mapas, mods, servers…): el texto de verdad queda en la página (lo leen el lector de
// pantalla y las pruebas); lo que se ve mientras sube es una copia encima (::after, attr(data-pn)) ----
const PN_NUMEROS = '.rbCat em, .rbSecc em, .rbTotal, .mpCuenta, .pjCuenta, .tiCuantos, .soSubs button';
function pnContar(P) {
  if (!(performance.now() < PN.armado)) return;
  for (const e of P.querySelectorAll(PN_NUMEROS)) {
    if (e.dataset.pnC === String(PN.serie)) continue;
    const t = e.textContent; if (!/\d/.test(t) || t.length > 40) continue;
    // (cada número sube una vez desde que se abrió el panel: si se vuelve a dibujar —elegiste un mapa—, queda quieto)
    e.dataset.pnC = String(PN.serie); const k = (e.className || '').replace(/ ?pn\w+/g, '') + '|' + t; if (!PN.contados) PN.contados = new Set(); if (PN.contados.has(k)) continue; PN.contados.add(k); pnSubir(e, t);
  }
}
function pnSubir(e, t) {
  const nums = t.match(/\d+/g).map(Number); if (!nums.some((n) => n > 1)) return;
  const t0 = performance.now(), D = 460;
  e.classList.add('pnCuenta'); PN.cuentas++;
  const paso = () => {
    if (!e.isConnected || e.textContent !== t) { e.classList.remove('pnCuenta'); return; }
    const k = Math.min(1, (performance.now() - t0) / D), f = 1 - (1 - k) * (1 - k) * (1 - k);
    let i = 0; e.dataset.pn = t.replace(/\d+/g, () => String(Math.round(nums[i++] * f)));
    if (k < 1) setTimeout(paso, 45); else { e.classList.remove('pnCuenta'); delete e.dataset.pn; }
  };
  paso();
}

// ======================= al tocar, al pasar y con el foco =======================
function pnDuenio(e) {
  const t = e && e.closest && e.closest(PN_TOCA); if (!t || t.disabled || t.matches('select, input, textarea')) return null;
  return t.closest(PN_RAIZ) ? t : null;
}
// un efecto que va adentro de lo tocado (recortado a su forma) y se borra solo
function pnFx(t, cls, ms, kf, x, y) {
  const fx = document.createElement('span'); fx.className = 'pnFx ' + cls; fx.setAttribute('aria-hidden', 'true');
  const i = document.createElement('i'); fx.appendChild(i);
  if (getComputedStyle(t).position === 'static') t.style.position = 'relative';
  t.appendChild(fx);
  if (x !== undefined) { const D = Math.max(t.offsetWidth, t.offsetHeight) * 2.3; Object.assign(i.style, { left: x - D / 2 + 'px', top: y - D / 2 + 'px', width: D + 'px', height: D + 'px' }); }
  let a = null; try { a = i.animate(kf, { duration: ms, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }); } catch (er) {}
  const fin = () => fx.remove(); if (a) a.onfinish = fin; setTimeout(fin, ms + 120);
  return fx;
}
function pnToque(e) {
  if (!PN.ok || PN.nivel === 'quieto') return;
  const t = pnDuenio(e.target); if (!t) return;
  // el golpe: se hunde unos 4 px, sea chico o ancho (una fila de Ajustes no se achica como un botón)
  const k = Math.max(0.955, 1 - 9 / Math.max(60, t.offsetWidth));
  try { t.animate([{ transform: 'none' }, { transform: `translateY(1px) scale(${k.toFixed(3)})`, offset: 0.32 }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.3,.7,.4,1)' }); } catch (er) {}
  if (PN.nivel !== 'pleno') return;
  // la tinta, desde el dedo (con el juego girado, el punto se pasa a lo que se ve)
  const r = t.getBoundingClientRect(); let x, y;
  if (pnRot()) { x = e.clientY - r.top; y = r.right - e.clientX; } else { x = e.clientX - r.left; y = e.clientY - r.top; }
  pnFx(t, 'pnTinta', 480, [{ transform: 'scale(.12) rotate(0deg)', opacity: 0.95 }, { transform: 'scale(1) rotate(28deg)', opacity: 0 }], x, y);
  // el «Entrar» de un server: la brecha con rayas a lo largo de la fila; los principales disparan su flecha
  if (t.matches('[data-rb^="mpEntrar:"], [data-rb^="lanEntrar:"], [data-rb="lanIp"]')) { const f = t.closest('.mpSala') || t; pnFx(f, 'pnBrecha', 520, [{ transform: 'scaleX(0)', opacity: 0.7 }, { transform: 'scaleX(1)', opacity: 0.6, offset: 0.5 }, { transform: 'scaleX(1)', opacity: 0 }]); }
  const g = t.matches('.rbBtnG, .tiNueva, .cuBtn:not(.gris), .ajBtn:not(.gris)') && t.querySelector(':scope > .gli');
  if (g) try { const rtl = !!t.closest('[dir=rtl]'), s = rtl ? -1 : 1; g.animate([{ transform: 'none', opacity: 1 }, { transform: `translateX(${0.9 * s}em)`, opacity: 0, offset: 0.45 }, { transform: `translateX(${-0.7 * s}em)`, opacity: 0, offset: 0.46 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'ease-out' }); } catch (er) {}
}
// el barrido de luz: una vez al entrar el mouse o el foco (no más de una vez cada 0,7 s en lo mismo)
function pnBarrer(t) {
  if (PN.nivel !== 'pleno' || !t.offsetWidth) return;
  const ahora = performance.now(); if (t.__pnB && ahora - t.__pnB < 700) return; t.__pnB = ahora;
  const rtl = !!t.closest('[dir=rtl]');
  pnFx(t, 'pnLuz', 560, rtl ? [{ transform: 'translateX(120%) skewX(18deg)', opacity: 1 }, { transform: 'translateX(-330%) skewX(18deg)', opacity: 1 }] : [{ transform: 'translateX(-120%) skewX(-18deg)', opacity: 1 }, { transform: 'translateX(330%) skewX(-18deg)', opacity: 1 }]);
}
function pnSobre(e) {
  if (!PN.ok || e.pointerType !== 'mouse') return;
  const t = pnDuenio(e.target); if (t === PN.sobre) return; PN.sobre = t; if (t) pnBarrer(t);
}
function pnFoco(e) {
  if (!PN.ok) return; const t = pnDuenio(e.target); if (!t) return;
  try { if (t.matches(':focus-visible')) pnBarrer(t); } catch (er) {}
}

// ======================= Ajustes (fuera del inicio: se abre también desde la pausa) =======================
// (al abrirse —se arma de nuevo— y al cambiar de pestaña: la marca; las filas de la sección que aparece bajan en cascada;
// desde el menú lleva el número de Opciones, 07)
function pnCambiosAj(L, A) {
  const caja = document.getElementById('ajustes'); if (!caja) return;
  const nuevo = L.some((r) => r.type === 'childList' && r.target === A && r.addedNodes.length);
  // (las pestañas: al armarse y si otro módulo agrega una —la de Música—; no por las clases que pone pnAjEncajar)
  if (nuevo || L.some((r) => r.type === 'childList' && r.target.matches && r.target.matches('.ajTabs'))) pnAjEncajarPedir();
  if (nuevo) { PN.marcas = Object.fromEntries(Object.entries(PN.marcas).filter(([k]) => !/^aj/.test(k))); caja.classList.toggle('pnMenu', typeof JUEGO !== 'undefined' && JUEGO.estado === 'principal'); }
  if (nuevo) pnAyudasPedir();
  const nv = pnNivelPoner(); if (nv === 'quieto') return;
  const secs = nuevo ? [...A.querySelectorAll('.ajSecs > section:not(.oc)')] : L.filter((r) => r.type === 'attributes' && r.target.matches && r.target.matches('.ajSecs > section') && !r.target.classList.contains('oc')).map((r) => r.target);
  if (L.some((r) => r.type === 'attributes' || (r.type === 'childList' && [...r.addedNodes].some((n) => n.nodeType === 1 && !/(^| )pn[A-Z]/.test(n.className))))) {
    const pp = PN.p; PN.p = null; pnMarcas(A); PN.p = pp;
  }
  if (nv === 'pleno' && secs.length) {
    const todos = []; for (const s of secs) [...s.children].forEach((e, i) => { e.style.setProperty('--pnK', Math.min(i, 10)); e.classList.add('pnSube'); todos.push(e); });
    setTimeout(() => { for (const e of todos) { e.classList.remove('pnSube'); e.style.removeProperty('--pnK'); } }, 800);
  }
}

// ---- Ajustes: que entren todas las pestañas a la vista ----
// (en la 3.6 eran 5 y la columna del celular ya estaba llena; otro módulo agrega la de Música —con las mismas clases:
// .ajTabs button[data-aj], section[data-ajs]— y puede haber una más. Por pasos, como pjEncajar: si no entran, ajT1 —filas
// de 40 px, el compromiso de Ajustes—; si tampoco, ajT2 —dos columnas con el ícono arriba y el nombre abajo, filas de 56 px
// o más: 7 entran en 640×360—. Más que eso, la columna se desliza)
function pnAjEncajarPedir() { requestAnimationFrame(() => { try { pnAjEncajar(); } catch (e) {} }); }
function pnAjEncajar() {
  const t = document.querySelector('#ajustesCaja .ajTabs'); if (!t || !t.offsetHeight) return;
  t.classList.remove('ajT1', 'ajT2'); t.style.removeProperty('width');
  const sobra = () => t.scrollHeight > t.clientHeight + 1, ancho = t.offsetWidth;
  if (sobra()) t.classList.add('ajT1');
  // (en dos columnas la columna queda del mismo ancho: los nombres pasan a dos renglones y lo de la derecha no se angosta)
  if (sobra()) { t.classList.remove('ajT1'); t.classList.add('ajT2'); t.style.width = ancho + 'px'; }
}

// ======================= los esqueletos: lo que se ve mientras carga una lista =======================
// (tarjetas grises con un brillo que pasa 4 veces y para; el texto «Cargando…» queda para leer)
// ---- el texto de ayuda de los campos (placeholder): si no entra entero, el corto ----
// (el corto: data-pn-corto, el mismo sin el ejemplo entre paréntesis o, en una búsqueda, «Buscar…»: el más largo que entre. El
// largo queda para el lector de pantalla —aria-label— y al pasar el mouse —title—. Se mide con la letra de verdad y con el panel
// ya armado; si el juego cambia el texto, ése es el largo nuevo)
function pnAyudasPedir() {
  if (PN.tAy) return;
  PN.tAy = requestAnimationFrame(() => { PN.tAy = requestAnimationFrame(() => { PN.tAy = 0; try { pnAyudas(); } catch (e) {} }); });
}
function pnAyudas() {
  const cv = PN.cv || (PN.cv = document.createElement('canvas').getContext('2d')); if (!cv) return;
  for (const e of document.querySelectorAll('#rbInicio .rbPan input[placeholder], #ajustes input[placeholder], #rbInicio .mpModalC input[placeholder]')) {
    if (e.dataset.pnPuesto !== e.placeholder) e.dataset.pnLargo = e.placeholder;
    const largo = e.dataset.pnLargo; if (!largo || !e.offsetWidth) continue;
    const cs = getComputedStyle(e), pc = getComputedStyle(e, '::placeholder'), ls = parseFloat(pc.letterSpacing) || 0;
    cv.font = `${pc.fontStyle} ${pc.fontWeight} ${pc.fontSize} ${pc.fontFamily}`;
    const lugar = e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), ancho = (t) => cv.measureText(t).width + ls * t.length;
    let ph = largo;
    if (ancho(largo) > lugar) {
      const c = [e.dataset.pnCorto, largo.replace(/\s*[(（].*$/, ''), e.type === 'search' ? T('buscar') : ''].filter((t) => t && t !== largo).sort((a, b) => ancho(b) - ancho(a));
      ph = c.find((t) => ancho(t) <= lugar) || c[c.length - 1] || largo;
    }
    if (e.placeholder !== ph) e.placeholder = ph;
    e.dataset.pnPuesto = ph;
    if (ph !== largo) { e.title = largo; if (!e.hasAttribute('aria-label')) e.setAttribute('aria-label', largo); }
    else if (e.title === largo) e.removeAttribute('title');
  }
}
function pnEsqueletos(txt, n) {
  return `<div class="rbVacio pnEsqT" role="status">${esc(txt)}</div>` + '<div class="pnEsq" aria-hidden="true"><i></i><b></b><s></s></div>'.repeat(n || 4);
}
// ---- las barras (input range con la clase pnR, paneles.css): el relleno amarillo hasta el valor —desde el cero si la
// barra va de menos a más, como las del arma en la mano— ----
function pnRango(r) {
  const mn = +r.min || 0, mx = r.max === '' ? 100 : +r.max, k = (x) => Math.max(0, Math.min(100, (x - mn) / ((mx - mn) || 1) * 100));
  const z = mn < 0 && mx > 0 ? k(0) : 0, v = k(+r.value);
  r.style.setProperty('--a', Math.min(z, v).toFixed(2) + '%'); r.style.setProperty('--b', Math.max(z, v).toFixed(2) + '%');
}
addEventListener('input', (e) => { const r = e.target; if (r && r.classList && r.classList.contains('pnR')) pnRango(r); }, true);
