// El panel «Mods y mapas» con el concepto que mandó GOLDEN al Discord («Mejor interfaz en el apartado de mods»): panel
// oscuro con el amarillo de acento, pestañas (la elegida, amarilla), las categorías a la izquierda, el buscador, el orden y
// Explorar/Instalados arriba de la grilla, tarjetas con el botón a lo ancho (amarillo: lo que se puede hacer; verde con
// contorno: ya está), títulos de sección con su número, la tarjeta punteada «Nuevo mapa», la ficha con el mismo estilo y
// el pie con Volver, Deshabilitar todo (contorno rojo), Habilitar todo, el total, «…» y «Empezar partida nueva».
// Con una tienda de mentira (las mismas rutas que la de verdad), en la compu (1280×720) y en el celular acostado:
//  1. las cuatro pestañas: panel oscuro, la pestaña elegida en amarillo, «Categorías» a la izquierda con «Todas» elegida,
//     buscador + orden + Explorar/Instalados, tarjetas con imagen, nombre y botón a lo ancho, secciones con su número;
//  2. Mods: «Instalar» en la tarjeta lo instala y queda «Activado» (verde con contorno); uno deshabilitado dice «Activar»
//     y al tocarlo se habilita; el pie tiene Deshabilitar todo (contorno rojo) y Habilitar todo;
//  3. Mapas: «Mis mapas» con los tuyos (Jugar) y la tarjeta punteada «Nuevo mapa · Crear desde cero», que abre Crear un
//     mapa (y de ahí Volver vuelve a la tienda); uno de la gente: Instalar y después Jugar;
//  4. Emotes: «Equipar» lo pone en la ruleta de emotes y queda «Equipado»; con la ruleta llena entra primero y sale el
//     último (equipando dos seguidos quedan los dos); en la ficha, «Sacar de la ruleta» lo saca;
//  5. GMod: las categorías del Workshop y el interruptor «Sólo descarga directa» siempre a la vista; el aviso de los
//     personajes con su botón y cuántos addons hay; tarjetas con los suscriptos y «Directa» o «.gma»; el instalado dice
//     «Instalado», el deshabilitado «Habilitar» y el que está bajando muestra la barra con el porcentaje;
//  6. la ficha (mod, mapa, emote y GMod): se abre tocando la tarjeta, sin las categorías ni el buscador, oscura, con la
//     imagen, el nombre y los botones; al volver, la grilla queda donde estaba (no arriba de todo);
//  7. buscar filtra, las categorías filtran (y la lista de categorías queda donde estaba), «…» trae más y «Empezar
//     partida nueva» abre Nueva partida;
//  8. cómo entra: en 1280×720, 873×393, 640×360 y con el celular parado (393×873, el juego girado), en cada pestaña y en
//     la ficha, arriba y el pie quedan en un renglón, nada se sale del panel ni se pisa, sin deslizar la página; en el
//     celular todo lo que se toca mide 40 px o más (los botones de las tarjetas, 36); la letra, 12 px o más;
//  9. contraste de los textos ≥ 4,5 (pestañas, categorías, botones, nombres, datos);
// 10. los textos nuevos están en los 14 idiomas (no se ve ninguna clave cruda) y entran igual en alemán y en ruso;
// 11. sin errores de JS.
// uso: node tienda_panel.mjs URL_HTML [CARPETA_FOTOS]   (URL_HTML con http://; un python3 -m http.server en su carpeta)
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = ''] = process.argv; if (D) fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };

// ---- la tienda de mentira ----
const svg = (c, t) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${c}"/><text x="32" y="40" font-size="20" text-anchor="middle" fill="#fff" font-family="Arial">${t}</text></svg>`;
const MODS = [...Array(6)].map((_, i) => ({ id: 'tm' + i, tipo: 'mod', nombre: 'Mod de prueba ' + i, autor: 'Autor' + i, descripcion: 'Lo que hace el mod de prueba número ' + i, etiquetas: i % 2 ? ['armas'] : ['diversion'], icono: 'ico:cohete', descargas: 90 - i, likes: i, codigo: 0 }));
const MAPAS = [...Array(3)].map((_, i) => ({ id: 'tp' + i, tipo: 'mapa', nombre: 'Mapa de prueba ' + i, autor: 'Autor' + i, descripcion: 'Un mapa de la gente', etiquetas: ['construccion'], icono: '', base: 'FlatGrass', descargas: 30 - i, likes: i, codigo: 0 }));
const ANIMS = [...Array(4)].map((_, i) => ({ id: 'ta' + i, tipo: 'anim', nombre: 'Baile de prueba ' + i, autor: 'Autor' + i, descripcion: '', etiquetas: [], icono: '', base: 'baile', descargas: 12 - i, likes: 0, codigo: 0 }));
const GMOD = [...Array(60)].map((_, i) => ({ id: String(900000 + i), t: i === 0 ? 'Un addon con un nombre bien largo para ver cómo se corta en la tarjeta' : 'Addon de prueba ' + i, img: `https://images.steamusercontent.com/ugc/${i}/x/`, mb: 1.5 + i, subs: 6000000 - i * 90000, fav: 9000 - i,
  d: 'Descripción del addon de prueba ' + i + '. '.repeat(3), tags: ['Addon', i % 2 ? 'Weapon' : 'Vehicle'], dir: i % 3 !== 0, act: 1700000000, autor: '7656119805593' + (1000 + i) }));
const ITEM = (id) => (/^tp/.test(id) ? { formato: 'rezobox-mapa', nombre: 'Mapa de prueba ' + id.slice(2), autor: 'Autor', descripcion: 'Un mapa de la gente', etiquetas: ['construccion'], base: 'FlatGrass', gravedad: 1, objetos: [] }
  : { formato: 'rezobox-mod', nombre: 'Mod de prueba ' + id.slice(2), autor: 'Autor', descripcion: 'Lo que hace', icono: 'ico:cohete', etiquetas: ['diversion'], efectos: { salto: 2 } });
const pedidos = [];
async function tienda(ctx) {
  const json = (r, o) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });
  await ctx.route(/\/api\/lista\?/, (r) => { const u = new URL(r.request().url()), q = (u.searchParams.get('q') || '').toLowerCase(), etq = u.searchParams.get('etq') || '', pg = +u.searchParams.get('p') || 0; pedidos.push(u.search);
    const L = ({ mod: MODS, mapa: MAPAS, anim: ANIMS })[u.searchParams.get('tipo')].filter((x) => (!q || x.nombre.toLowerCase().includes(q)) && (!etq || x.etiquetas.includes(etq)));
    return json(r, { items: pg ? [] : L, total: L.length }); });
  await ctx.route(/\/api\/item\//, (r) => json(r, ITEM(r.request().url().split('/').pop())));
  await ctx.route(/\/api\/gmod\/detalles/, (r) => json(r, { items: [] }));
  await ctx.route(/\/api\/gmod\/buscar/, (r) => { const u = new URL(r.request().url()), q = (u.searchParams.get('q') || '').toLowerCase(), tag = u.searchParams.get('tag') || '', pg = +u.searchParams.get('p') || 1; pedidos.push(u.search);
    const L = GMOD.filter((x) => (!q || x.t.toLowerCase().includes(q)) && (!tag || x.tags.includes(tag)));
    return json(r, { items: L.slice((pg - 1) * 30, pg * 30), total: q || tag ? L.length : 502727, p: pg }); });
  await ctx.route(/images\.steamusercontent\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg('#' + ((r.request().url().length * 2654435761) >>> 8 & 0xffffff).toString(16).padStart(6, '0'), 'GM') }));
  await ctx.route(/r\.jina\.ai|steamcommunity\.com|\/api\/(like|denunciar)/, (r) => r.fulfill({ status: 503, body: '' }));
}

// ---- medidas (adentro de la página) ----
// lo que se ve y se toca arriba, en la barra y en el pie; lo que se sale del panel; lo que se pisa; lo chico; la letra
const MEDIR = `(() => { const P = RB.el.querySelector('.rbPan_tienda'), pr = P.getBoundingClientRect(), rot = document.documentElement.classList.contains('rot');
  const alto = (r) => (rot ? r.width : r.height), ancho = (r) => (rot ? r.height : r.width);
  const vis = (e) => e.offsetParent && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
  const fijos = [...P.querySelectorAll('.tiCab button, .tiCab label, .tiCab .tiTit, .rbBarra > *, .rbPanPie button, .rbPanPie .rbTotal, .rbPanPie .gmSelInfo, .tiLado > .tiLadoTit, .tiLado > button')].filter(vis).map((e) => [e, e.getBoundingClientRect()]).filter(([, r]) => r.width > 0);
  const fuera = [], pisan = [], chicos = [];
  for (const [e, r] of fijos) if (r.left < pr.left - 0.5 || r.right > pr.right + 0.5 || r.top < pr.top - 0.5 || r.bottom > pr.bottom + 0.5) fuera.push(e.className || e.tagName);
  for (let i = 0; i < fijos.length; i++) for (let j = i + 1; j < fijos.length; j++) { const [ea, a] = fijos[i], [eb, c] = fijos[j]; if (ea.contains(eb) || eb.contains(ea)) continue; if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) pisan.push((ea.className || ea.tagName) + ' x ' + (eb.className || eb.tagName)); }
  // (lo que se toca: lo de arriba, la barra, las categorías, el pie y los botones de la ficha, 40 px; el de las tarjetas, 36)
  const toca = [...P.querySelectorAll('.tiCab button, .tiCab label, .rbBarra .tiBus, .rbBarra select, .rbBarra .rbSeg button, .tiLado button, .rbPanPie button, .rbFicha button, .rbFicha a, .rbFicha label, .tiNuevo')].filter(vis);
  for (const e of toca) { const r = e.getBoundingClientRect(); if (alto(r) < 39.5 || ancho(r) < 39.5) chicos.push((e.className || e.tagName) + ' ' + Math.round(ancho(r)) + 'x' + Math.round(alto(r))); }
  for (const e of [...P.querySelectorAll('.tiBtn')].filter(vis)) { const r = e.getBoundingClientRect(); if (alto(r) < 35.5) chicos.push('tiBtn ' + Math.round(alto(r))); }
  let letra = 99, cual = ''; for (const e of P.querySelectorAll('button, label, b, small, i, span, p, h3, em, select, input, div')) { if (!vis(e) || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue; const f = parseFloat(getComputedStyle(e).fontSize); if (f < letra) { letra = f; cual = e.className || e.tagName; } }
  const cab = P.querySelector('.tiCab'), pie = P.querySelector('.rbPanPie'), reng = (el) => new Set([...el.children].filter((e) => vis(e) && !e.classList.contains('rbEsp')).map((e) => Math.round((rot ? e.getBoundingClientRect().left + e.getBoundingClientRect().width / 2 : e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2) / 6))).size;
  return { fuera, pisan, chicos: [...new Set(chicos)], letra: +letra.toFixed(1), cual, cabReng: reng(cab), pieReng: reng(pie), cabSobra: cab.scrollWidth - cab.clientWidth, pieSobra: pie.scrollWidth - pie.clientWidth, pasos: (cab.className + ' ' + pie.className).match(/ti[CP]\\d/g) || [],
    scroll: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1, panel: [Math.round(pr.width), Math.round(pr.height)] }; })()`;
// el contraste de un texto contra lo que tiene detrás (el primer fondo opaco hacia arriba; el del panel es casi opaco)
const CONTRASTE = `(() => { const P = RB.el.querySelector('.rbPan_tienda');
  const rgb = (s) => { const m = /rgba?\\(([^)]+)\\)/.exec(s); if (!m) return null; const a = m[1].split(',').map(Number); return [a[0], a[1], a[2], a.length > 3 ? a[3] : 1]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const fondo = (e) => { let c = [16, 17, 19]; const pila = []; for (let x = e; x && x !== P.parentElement; x = x.parentElement) { const b = rgb(getComputedStyle(x).backgroundColor); if (b && b[3] > 0) pila.push(b); if (b && b[3] >= 0.97) break; }
    for (const b of pila.reverse()) c = [0, 1, 2].map((i) => b[i] * b[3] + c[i] * (1 - b[3])); return c; };
  const R = []; for (const [n, sel] of [['pestaña', '.rbTab:not(.sel)'], ['pestaña elegida', '.rbTab.sel'], ['categoría', '.tiCat:not(.sel)'], ['categoría elegida', '.tiCat.sel'], ['título de categorías', '.tiLadoTit'], ['sección', '.rbSecc'], ['número de sección', '.rbSecc em'], ['nombre', '.tiCard > b'], ['datos', '.tiMeta'], ['etiqueta', '.tiChip'],
    ['botón amarillo', '.tiBtn_si'], ['botón verde', '.tiBtn_ok'], ['pie', '.rbPanPie .rbBtnGris:not([disabled])'], ['total', '.rbTotal'], ['empezar', '.tiNueva'], ['subir, lo chico', '.tiSubir small'], ['buscador', '#rbBuscar'], ['orden', '#rbOrden'], ['explorar', '.rbSeg button.sel'], ['instalados', '.rbSeg button:not(.sel)'], ['nota', '.gmPMnota'], ['cuántos', '.tiCuantos'], ['enlace', '.tiLink'],
    ['ficha título', '.rbFicha h3'], ['ficha datos', '.rbFichaInfo small'], ['ficha texto', '.rbFichaInfo p'], ['ficha botón', '.rbFicha .rbBtnGris'], ['ficha principal', '.rbFicha .rbBtnG'], ['nuevo mapa', '.tiNuevo small']]) {
    const e = [...P.querySelectorAll(sel)].find((x) => x.offsetParent && (x.textContent.trim() || x.placeholder)); if (!e) continue;
    const st = getComputedStyle(e, sel === '#rbBuscar' && !e.value ? '::placeholder' : null), c = rgb(st.color), f = fondo(e), a = lum(c), b = lum(f); R.push([n, +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2)]); }
  return R; })()`;

const errores = [];
async function correr(celu, tam, lang) {
  const { b, p, ev, err } = await abrir(HTML + '?test', celu, null, async (pg) => { await tienda(pg.context()); });
  if (tam) await p.setViewportSize({ width: tam[0], height: tam[1] });
  const esp = (ms) => p.waitForTimeout(ms), pre = (celu ? 'celu' : 'compu') + (tam ? `_${tam[0]}x${tam[1]}` : '') + (lang ? '_' + lang : '');
  const foto = async (n) => { if (D) await p.screenshot({ path: `${D}/${pre}_${n}.png` }); };
  await ev(`(() => { idiomaAplicar('${lang || 'es'}'); PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.nombre = 'Probador'; INST.of = {}; for (const k in PREFS.mods) delete PREFS.mods[k]; for (const k in INST.mods) delete INST.mods[k]; for (const k in INST.mapas) delete INST.mapas[k]; for (const k in INST.anims) delete INST.anims[k];
    for (const id of ['goku', 'radio', 'ragdoll']) INST.of[id] = true; PREFS.mods.goku = true;
    for (const [id, n, base] of [['local-pista1', 'Pista de autos', 'Desert'], ['local-casa2', 'Mi casa en la ciudad', 'City']]) { const v = validarRB({ formato: 'rezobox-mapa', nombre: n, autor: 'Probador', descripcion: 'Hecho con el creador', etiquetas: ['construccion'], base, gravedad: 1, objetos: [] }); v.id = id; v.creado = true; INST.mapas[id] = v; }
    PREFS.gmod = {}; PREFS.gmod['900000'] = { n: ${JSON.stringify(GMOD[0].t)}, t: Date.now(), img: ${JSON.stringify(GMOD[0].img)}, tags: ['Vehicle'], subs: 6000000, mb: 1.5 }; PREFS.gmod['900002'] = { n: 'Addon de prueba 2', t: Date.now(), img: '', tags: ['Vehicle'], subs: 5820000, mb: 3.5, off: 1 };
    PREFS.ruleta = null; guardarPrefs(); guardarLS('rb_instalados', INST); inicioMostrar(true); return 1; })()`);
  const abrirT = async (tab, vista = 'explorar', antes = '') => { await ev(`(() => { ${antes} RB.t.tab = '${tab}'; RB.t.vista = '${vista}'; RB.t.ficha = null; RB.t.sel = null; RB.t.q = ''; RB.t.etq = ''; inicioPanel('tienda'); return 1; })()`); await esp(700); };
  // (un clic de verdad en el medio de lo que se elige; con el celular parado el juego está girado y Playwright lo resuelve igual)
  const clic = async (sel) => { await p.click(sel); await esp(250); };
  const medir = () => ev(MEDIR);
  const caja = [], anota = async (n) => { const m = await medir(); m.n = n; caja.push(m); return m; };
  const soloEntra = !!tam || !!lang;   // (las otras pantallas y los otros idiomas: sólo cómo entra)

  // ---- 1. las cuatro pestañas ----
  const estr = {};
  for (const tab of ['mod', 'mapa', 'anim', 'gmod']) {
    await abrirT(tab); await foto('lista_' + tab); await anota('lista ' + tab);
    estr[tab] = await ev(`(() => { const P = RB.el.querySelector('.rbPan_tienda'), cs = (e) => getComputedStyle(e), T0 = [...P.querySelectorAll('.tiCard')].slice(0, 12);
      return { fondo: cs(P).backgroundColor, tabs: P.querySelectorAll('.rbTab').length, sel: [...P.querySelectorAll('.rbTab.sel')].map((e) => [e.dataset.rb, cs(e).backgroundColor]), cats: P.querySelectorAll('.tiCat').length, catSel: [...P.querySelectorAll('.tiCat.sel')].map((e) => [e.dataset.rb, cs(e).backgroundColor]),
        titCats: (P.querySelector('.tiLadoTit') || {}).textContent, buscar: !!P.querySelector('#rbBuscar'), orden: P.querySelectorAll('#rbOrden option').length, seg: [...P.querySelectorAll('.rbSeg button')].map((e) => e.dataset.rb + (e.classList.contains('sel') ? '*' : '')),
        n: P.querySelectorAll('.tiCard').length, conImg: T0.every((t) => t.querySelector('.rbTileIco img')), conNombre: T0.every((t) => t.querySelector(':scope > b').textContent.trim()), conBoton: T0.every((t) => { const bt = t.querySelector('.tiBtn'); return bt && bt.offsetWidth >= 0.97 * (t.clientWidth - 2 * parseFloat(cs(t).paddingLeft)); }),
        secc: [...P.querySelectorAll('.rbSecc')].map((e) => [e.firstChild.textContent, +e.querySelector('em').textContent]), porFila: T0.filter((t) => Math.abs(t.getBoundingClientRect().top - T0[0].getBoundingClientRect().top) < 2).length,
        pie: [...P.querySelectorAll('.rbPanPie button')].filter((e) => e.offsetParent).map((e) => e.dataset.rb), nueva: cs(P.querySelector('.tiNueva')).backgroundColor, radio: cs(P).borderRadius }; })()`);
  }
  const AM = 'rgb(242, 179, 27)', oscuro = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c).slice(1)[0].split(',').map(Number); return m[0] < 40 && m[1] < 40 && m[2] < 40 && (m[3] === undefined || m[3] > 0.9); };
  if (!soloEntra) ok(`1 (${pre}). las cuatro pestañas: panel oscuro, la elegida y «Todas» en amarillo, buscador + orden + Explorar/Instalados, tarjetas con imagen, nombre y botón a lo ancho, secciones con número`,
    ['mod', 'mapa', 'anim', 'gmod'].every((t) => { const e = estr[t]; return oscuro(e.fondo) && e.tabs === 4 && e.sel.length === 1 && e.sel[0][0] === 'tab:' + t && e.sel[0][1] === AM && e.cats >= 4 && e.catSel.length === 1 && e.catSel[0][0] === 'etq:' && e.catSel[0][1] === AM && /categor/i.test(e.titCats) && e.buscar && e.orden >= 3 && e.seg.join() === 'vista:explorar*,vista:instalados' && e.n >= 4 && e.conImg && e.conNombre && e.conBoton && e.nueva === AM && e.pie.includes('volver') && e.pie.includes('nueva') && (t === 'mapa' || e.porFila >= (celu ? 3 : 4)); })
      && estr.mod.secc.length === 3 && estr.mod.secc[0][1] === 13 && estr.mod.secc[2][1] === 6 && estr.mapa.secc.length === 2 && estr.mapa.secc[0][1] === 2 && estr.anim.secc.length >= 3 && estr.gmod.secc.length === 0,
    { mod: estr.mod, mapa: { secc: estr.mapa.secc, n: estr.mapa.n }, anim: { secc: estr.anim.secc, n: estr.anim.n }, gmod: { n: estr.gmod.n, cats: estr.gmod.cats, porFila: estr.gmod.porFila } });

  if (!soloEntra) {
    // ---- 2. Mods ----
    const boton = (id) => ev(`(() => { const t = RB.el.querySelector('.tiCard[data-rb="ver:${id}"]'), bt = t && t.querySelector('.tiBtn'); if (!bt) return null; const cs = getComputedStyle(bt); return { a: bt.dataset.rb, t: bt.textContent.trim(), clase: bt.className.replace('tiBtn ', ''), fondo: cs.backgroundColor, borde: cs.borderTopColor, color: cs.color, off: t.classList.contains('off') }; })()`);
    await abrirT('mod');
    const m0 = await boton('salto'), r0 = await boton('ragdoll'), g0 = await boton('goku'), a0 = await boton('radio');
    await clic('.tiCard[data-rb="ver:salto"] .tiBtn'); const m1 = await boton('salto'), inst = await ev(`({ of: !!INST.of.salto, on: !!PREFS.mods.salto, ficha: RB.t.ficha })`);
    await clic('.tiCard[data-rb="ver:ragdoll"] .tiBtn'); const r1 = await boton('ragdoll'), rOn = await ev(`!!PREFS.mods.ragdoll`);
    const pieM = await ev(`[...RB.el.querySelectorAll('.rbPanPie .rbHab button')].map((e) => ({ a: e.dataset.rb, gris: e.disabled, borde: getComputedStyle(e).borderTopColor }))`);
    const verde = (b) => b && b.clase === 'tiBtn_ok' && /^rgba?\(\s*\d+,\s*(1[6-9]\d|2\d\d),/.test(b.color) && !/rgb\(242, 179, 27\)/.test(b.fondo) && /^ver:/.test(b.a), amar = (b) => b && b.clase === 'tiBtn_si' && b.fondo === AM;
    const rojo = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c)[1].split(',').map(Number); return m[0] > 200 && m[1] < 140 && m[2] < 140; };
    ok(`2 (${pre}). Mods: «Instalar» en la tarjeta lo instala y queda «Activado» (verde con contorno); el deshabilitado dice «Activar» y se habilita; el pie con Deshabilitar todo (contorno rojo) y Habilitar todo`,
      amar(m0) && m0.a === 'instalar:salto' && /instalar/i.test(m0.t) && verde(m1) && /activado/i.test(m1.t) && inst.of && inst.on && !inst.ficha && amar(r0) && r0.a === 'habMod:ragdoll' && /activar/i.test(r0.t) && r0.off && verde(r1) && rOn && verde(g0) && verde(a0) && /instalado/i.test(a0.t)
        && pieM.length === 2 && pieM[0].a === 'desTodoMod' && !pieM[0].gris && rojo(pieM[0].borde) && pieM[1].a === 'habTodoMod',
      { m0, m1, inst, r0, r1, rOn, a0, pieM });

    // ---- 3. Mapas ----
    await abrirT('mapa');
    const mp = await ev(`(() => { const P = RB.el.querySelector('.rbPan_tienda'), S = [...P.querySelectorAll('.rbTiendaG > *')], i0 = S.findIndex((e) => e.classList.contains('rbSecc')), i1 = S.findIndex((e, i) => i > i0 && e.classList.contains('rbSecc')), mios = S.slice(i0 + 1, i1), nv = P.querySelector('.tiNuevo'), cs = getComputedStyle(nv);
      return { tit: S[i0].firstChild.textContent, mios: mios.filter((e) => e.classList.contains('tiCard')).map((e) => [e.dataset.rb, e.querySelector('.tiBtn').dataset.rb]), nuevoEnMios: mios[mios.length - 1] === nv, nuevo: nv.textContent, borde: cs.borderTopStyle, otros: [...P.querySelectorAll('.tiCard')].filter((e) => /^ver:tp/.test(e.dataset.rb)).map((e) => e.querySelector('.tiBtn').dataset.rb) }; })()`);
    await clic('.tiNuevo'); const crear = await ev(`({ panel: RB.panel, volver: (RB.el.querySelector('.rbPan_crear .rbPanPie [data-rb]') || {}).dataset.rb })`);
    await clic('.rbPan_crear .rbPanPie [data-rb^="tienda"]'); await esp(500); const vuelve = await ev(`({ panel: RB.panel, tab: RB.t.tab })`);
    await clic('.tiCard[data-rb="ver:tp0"] .tiBtn'); await esp(500); const tp = await ev(`({ inst: !!INST.mapas.tp0, btn: RB.el.querySelector('.tiCard[data-rb="ver:tp0"] .tiBtn').dataset.rb })`);
    ok(`3 (${pre}). Mapas: «Mis mapas» con los tuyos (Jugar) y la tarjeta punteada «Nuevo mapa · Crear desde cero», que abre Crear un mapa (Volver vuelve a la tienda); uno de la gente: Instalar y después Jugar`,
      /mis mapas/i.test(mp.tit) && mp.mios.length === 2 && mp.mios.every((x) => /^jugarcom:local-/.test(x[1])) && mp.nuevoEnMios && /nuevo mapa/i.test(mp.nuevo) && /desde cero/i.test(mp.nuevo) && mp.borde === 'dashed' && mp.otros.length === 3 && mp.otros.every((x) => /^instalar:/.test(x))
        && crear.panel === 'crear' && crear.volver === 'tienda:mapa' && vuelve.panel === 'tienda' && vuelve.tab === 'mapa' && tp.inst && tp.btn === 'jugarcom:tp0', { mp, crear, vuelve, tp });

    // ---- 4. Emotes ----
    await abrirT('anim');
    const ids = await ev(`RB.t.items.filter((x) => x.oficial).slice(0, 8).map((x) => x.id)`), rul0 = await ev(`rulSlots()`);
    const libres = ids.filter((i) => !rul0.includes(i));
    const e0 = await boton(libres[0]); await clic(`.tiCard[data-rb="ver:${libres[0]}"] .tiBtn`); const e1 = await boton(libres[0]), rul1 = await ev(`PREFS.ruleta`);
    await clic(`.tiCard[data-rb="ver:${libres[1]}"] .tiBtn`); const rul2 = await ev(`PREFS.ruleta`), aviso = await ev(`(document.querySelector('.rbAvisoG, .menuAviso, #rbAviso') || {}).textContent || ''`);
    await clic(`.tiCard[data-rb="ver:${libres[0]}"] .tiBtn`); const fe = await ev(`(() => { const F = RB.el.querySelector('.rbFicha'); return F && { tit: F.querySelector('h3').textContent, acc: [...F.querySelectorAll('.rbFichaAcc [data-rb]')].map((e) => e.dataset.rb.split(':')[0]), eq: !!F.querySelector('.rbFichaIncl') }; })()`);
    await clic('.rbFicha [data-rb^="desequipar:"]'); const rul3 = await ev(`PREFS.ruleta`), fe2 = await ev(`[...RB.el.querySelectorAll('.rbFichaAcc [data-rb]')].map((e) => e.dataset.rb.split(':')[0])`);
    await clic('.rbFicha [data-rb="fichaNo"]'); const e2 = await boton(libres[0]);
    ok(`4 (${pre}). Emotes: «Equipar» lo pone en la ruleta y queda «Equipado»; llena, entra primero y sale el último (dos seguidos quedan los dos); en la ficha, «Sacar de la ruleta»`,
      rul0.length === 5 && rul0.every(Boolean) && amar(e0) && e0.a === 'equipar:' + libres[0] && /equipar/i.test(e0.t) && verde(e1) && /equipado/i.test(e1.t) && rul1[0] === libres[0] && rul1.length === 5 && rul1.slice(1).join() === rul0.slice(0, 4).join()
        && rul2[0] === libres[1] && rul2[1] === libres[0] && rul2.length === 5 && fe && fe.eq && fe.acc.join() === 'desequipar' && !rul3.includes(libres[0]) && rul3.includes(libres[1]) && fe2.join() === 'equipar' && amar(e2), { rul0, e0, e1, rul1, rul2, aviso, fe, rul3, fe2, e2 });

    // ---- 5. GMod ----
    await abrirT('gmod', 'explorar', `GMC.l.push({ id: '900004', n: 'Addon de prueba 4', estado: 'bajando', fase: 'bajando', p: 0.42 });`);
    const gm = await ev(`(() => { const P = RB.el.querySelector('.rbPan_tienda'), L = P.querySelector('.tiLado'), I = P.querySelector('.tiInter'), lr = L.getBoundingClientRect(), ir = I.getBoundingClientRect(), N = P.querySelector('.gmPMnota'), c = (id) => P.querySelector('.tiCard[data-rb="ver:' + id + '"]'), b = (id) => { const x = c(id).querySelector('.tiBtn'); return [x.dataset.rb, x.className.replace('tiBtn ', ''), x.textContent.trim()]; };
      return { cats: [...P.querySelectorAll('.tiCat')].map((e) => e.dataset.rb.slice(4)), inter: { texto: I.textContent.trim(), on: I.classList.contains('on'), aLaVista: ir.bottom <= lr.bottom + 0.5 && ir.top >= lr.top, alto: Math.round(ir.height) }, nota: N.textContent.trim().slice(0, 80), enlace: (N.querySelector('[data-rb=pjMods]') || {}).textContent, cuantos: N.querySelector('.tiCuantos').textContent,
        meta: ['900001', '900003'].map((id) => c(id).querySelector('.tiMeta').textContent.replace(/\\s+/g, ' ').trim()), inst: b('900000'), off: b('900002'), offGris: c('900002').classList.contains('off'), baja: b('900004'), barra: (c('900004').querySelector('.rbTileBaja') || { style: {} }).style.width, libre: b('900001'), total: P.querySelector('.rbTotal').textContent, mas: P.querySelector('[data-rb=mas]').style.display }; })()`);
    await clic('.tiInter'); await esp(500); const dir = await ev(`({ gmDir: RB.t.gmDir, on: RB.el.querySelector('.tiInter').classList.contains('on'), solo: RB.t.items.every((x) => x.dir === true), n: RB.t.items.length })`);
    await clic('.tiInter'); await esp(400); await ev(`(() => { GMC.l.length = 0; return 1; })()`);
    ok(`5 (${pre}). GMod: categorías del Workshop, «Sólo descarga directa» siempre a la vista, el aviso de los personajes con su botón y cuántos addons, «Directa» / «.gma», Instalado / Habilitar / la barra de lo que baja`,
      gm.cats.length === 14 && gm.cats.slice(0, 7).join() === ',Weapon,Vehicle,NPC,Tool,Model,Fun' && /directa/i.test(gm.inter.texto) && !gm.inter.on && gm.inter.aLaVista && gm.inter.alto >= 40 && /personajes/i.test(gm.nota) && /Mods/.test(gm.enlace) && /502\.7k/.test(gm.cuantos)
        && /5\.9M.*Directa/.test(gm.meta[0]) && /\.gma/.test(gm.meta[1]) && gm.inst[1] === 'tiBtn_ok' && /^ver:/.test(gm.inst[0]) && gm.off[0] === 'habGm:900002' && gm.offGris && gm.baja[1] === 'tiBtn_va' && /42%/.test(gm.baja[2]) && gm.barra === '42%' && gm.libre[0] === 'instalar:900001' && /502\.7k/.test(gm.total) && gm.mas !== 'none'
        && dir.gmDir && dir.on && dir.solo && dir.n >= 12, { gm, dir });
  }

  // ---- 6 y 8. las fichas (abiertas tocando la tarjeta) y cómo entran ----
  const fichas = {};
  for (const [tab, id] of [['mod', 'goku'], ['mod', 'tm0'], ['mapa', 'local-pista1'], ['anim', null], ['gmod', '900025'], ['gmod', '900002']]) {
    await abrirT(tab, tab === 'gmod' && id === '900002' ? 'instalados' : 'explorar');
    const cual = id || await ev(`RB.t.items[2].id`);
    // (deslizada hasta ahí, y un clic de verdad en el nombre de la tarjeta, no en su botón)
    const y0 = await ev(`(() => { const t = RB.el.querySelector('.tiCard[data-rb="ver:${cual}"]'); t.scrollIntoView({ block: 'center' }); return RB.el.querySelector('.tiDesliza').scrollTop; })()`);
    await clic(`.tiCard[data-rb="ver:${cual}"] > b`);
    const f = await ev(`(() => { const P = RB.el.querySelector('.rbPan_tienda'), F = P.querySelector('.rbFicha'), D = P.querySelector('.tiDesliza'); if (!F) return null; const fr = F.getBoundingClientRect(), dr = D.getBoundingClientRect(), A = F.querySelector('.rbFichaAcc').getBoundingClientRect(), I = F.querySelector('.rbFichaIco img');
      return { tit: F.querySelector('h3').textContent.trim(), img: !!I && I.getBoundingClientRect().width > 40, acc: [...F.querySelectorAll('.rbFichaAcc [data-rb], .rbFichaAcc a, .rbFichaAcc label')].map((e) => (e.dataset.rb || e.tagName).split(':')[0]), lado: !!P.querySelector('.tiLado').offsetParent, barra: !!P.querySelector('.rbBarra').offsetParent, nota: !!(P.querySelector('.gmPMnota') || {}).offsetParent,
        fondo: getComputedStyle(F).backgroundColor, accALaVista: A.bottom <= dr.bottom + 0.5 && A.right <= dr.right + 0.5, dentro: fr.left >= dr.left - 0.5 && fr.right <= dr.right + 0.5, arriba: D.scrollTop, hab: [...P.querySelectorAll('.rbPanPie .rbHab button')].map((e) => e.dataset.rb.split(':')[0]) }; })()`);
    await foto(`ficha_${tab}_${cual.replace(/\W/g, '')}`); const m = await anota(`ficha ${tab} ${cual}`);
    await clic('.rbFicha [data-rb="fichaNo"]');
    const v = await ev(`({ grilla: RB.el.querySelectorAll('.tiCard').length, y: RB.el.querySelector('.tiDesliza').scrollTop, lado: !!RB.el.querySelector('.tiLado').offsetParent, barra: !!RB.el.querySelector('.rbBarra').offsetParent })`);
    fichas[tab + ':' + cual] = { f, y0, v, chicos: m.chicos };
  }
  if (!soloEntra) {
    const F = Object.values(fichas), acc = (k) => fichas[k].f.acc.join();
    ok(`6 (${pre}). la ficha (mod, mapa, emote, GMod): se abre tocando la tarjeta, sin categorías ni buscador, oscura, con imagen, nombre y botones a la vista; al volver, la grilla queda donde estaba`,
      F.every((x) => x.f && x.f.tit && x.f.img && x.f.acc.length >= 1 && !x.f.lado && !x.f.barra && !x.f.nota && oscuro(x.f.fondo) && x.f.accALaVista && x.f.dentro && x.f.arriba === 0 && x.v.grilla >= 2 && x.v.lado && x.v.barra && Math.abs(x.v.y - x.y0) <= 2)
        && acc('mod:goku') === 'quitar' && fichas['mod:goku'].f.hab.join() === 'desMod' && acc('mod:tm0') === 'instalar,like,denunciar' && acc('mapa:local-pista1') === 'jugarcom,creaEditar,exportar,quitar' && /^instalar,A$/.test(acc('gmod:900025')) && fichas['gmod:900002'].f.hab.join() === 'habGm' && /quitar/.test(acc('gmod:900002'))
        && F.some((x) => x.y0 > 20),
      Object.fromEntries(Object.entries(fichas).map(([k, x]) => [k, { acc: x.f && x.f.acc.join(), hab: x.f && x.f.hab.join(), y0: x.y0, y: x.v.y, vista: x.f && x.f.accALaVista }])));

    // ---- 7. buscar, categorías, más y Empezar ----
    await abrirT('gmod');
    await p.fill('#rbBuscar', 'prueba 1'); await esp(900); const bus = await ev(`({ n: RB.t.items.length, todos: RB.t.items.every((x) => /prueba 1/.test(x.t)), q: RB.t.q, tarjetas: RB.el.querySelectorAll('.tiCard').length })`);
    await p.fill('#rbBuscar', ''); await esp(900);
    // (la lista de categorías deslizada: al elegir una queda donde estaba)
    const c0 = await ev(`(() => { const C = RB.el.querySelector('.tiCats'); C.scrollTop = 9999; return { y: C.scrollTop, alto: C.clientHeight, todo: C.scrollHeight }; })()`);
    await clic('.tiCat[data-rb="etq:Scenic"]'); await esp(500);
    const cat = await ev(`({ etq: RB.t.etq, sel: [...RB.el.querySelectorAll('.tiCat.sel')].map((e) => e.dataset.rb), y: RB.el.querySelector('.tiCats').scrollTop, n: RB.t.items.length })`);
    await clic('.tiCat[data-rb="etq:Weapon"]'); await esp(500); const arm = await ev(`({ n: RB.t.items.length, todos: RB.t.items.every((x) => x.tags.includes('Weapon')) })`);
    await clic('.tiCat[data-rb="etq:"]'); await esp(500); const antes = await ev(`RB.t.items.length`);
    await clic('.rbPanPie [data-rb=mas]'); await esp(700); const mas = await ev(`({ n: RB.t.items.length, total: RB.el.querySelector('.rbTotal').textContent })`);
    await clic('.rbPanPie [data-rb=nueva]'); await esp(400); const nueva = await ev(`RB.panel`);
    ok(`7 (${pre}). buscar filtra, las categorías filtran (y su lista queda donde estaba), «…» trae más y «Empezar partida nueva» abre Nueva partida`,
      bus.n >= 5 && bus.todos && bus.tarjetas === bus.n && cat.etq === 'Scenic' && cat.sel.join() === 'etq:Scenic' && (c0.todo <= c0.alto + 1 || Math.abs(cat.y - c0.y) <= 2) && arm.n >= 10 && arm.todos && mas.n > antes && nueva === 'nueva', { bus, c0, cat, arm, antes, mas, nueva });
  }

  // ---- 8. cómo entra (también Instalados, con «Borrar varios») ----
  await abrirT('mod', 'instalados'); await anota('instalados mod'); await foto('instalados_mod');
  await abrirT('gmod', 'instalados'); await anota('instalados gmod'); await foto('instalados_gmod');
  await ev(`(() => { inicioAccion('selGm', document.body); return 1; })()`); await esp(300); await ev(`(() => { gmSelTocar('900000'); return 1; })()`); await esp(200); await anota('borrar varios'); await foto('borrar_varios');
  await ev(`(() => { inicioAccion('selNo', document.body); return 1; })()`);
  const mal = caja.filter((c) => c.fuera.length || c.pisan.length || c.cabReng !== 1 || c.pieReng !== 1 || c.cabSobra > 1 || c.pieSobra > 1 || c.scroll || c.letra < 12 || (celu && c.chicos.length));
  ok(`8 (${pre}). en cada pestaña, en Instalados y en la ficha: arriba y el pie en un renglón, nada fuera del panel ni encimado, sin deslizar la página, letra ≥ 12 px${celu ? '; lo que se toca ≥ 40 px (tarjetas 36)' : ''}`, caja.length >= 13 && !mal.length,
    mal.length ? mal.slice(0, 4) : { vistas: caja.length, panel: caja[0].panel, letraMin: Math.min(...caja.map((c) => c.letra)), pasos: [...new Set(caja.flatMap((c) => c.pasos))].sort().join(' ') });

  if (!soloEntra) {
    // ---- 9. contraste ----
    const con = [];
    for (const [tab, extra] of [['mod', ''], ['mapa', ''], ['gmod', ''], ['gmod', `RB.t.ficha = '900001'; gmTiendaDibujar();`]]) { await abrirT(tab); if (extra) { await ev(`(() => { ${extra} return 1; })()`); await esp(300); } con.push(...await ev(CONTRASTE)); }
    const bajos = con.filter((c) => c[1] < 4.5);
    ok(`9 (${pre}). contraste de los textos ≥ 4,5`, con.length >= 30 && !bajos.length, bajos.length ? bajos : { medidos: con.length, minimo: con.reduce((a, c) => (c[1] < a[1] ? c : a)) });
  }
  errores.push(...err.filter((x) => !/WebSocket|mqtt|net::|favicon|Failed to load resource|shader simplificado|willReadFrequently/i.test(x)).map((x) => pre + ': ' + x));
  await b.close();
}
await correr(false);
await correr(true);
// (otras pantallas: un celular chico y el celular parado —el juego girado—; y dos idiomas largos en el celular)
await correr(true, [640, 360]);
await correr(true, [393, 873]);
await correr(true, null, 'de');
await correr(true, null, 'ru');

// ---- 10. los textos nuevos en los 14 idiomas ----
{
  const { b, ev, err } = await abrir(HTML + '?test', false, null, async (pg) => { await tienda(pg.context()); });
  const t = await ev(`(() => { const K = Object.keys(IDI3).filter((k) => /^ti\\./.test(k)), mal = []; for (const k of K) { const v = IDI3[k]; if (!Array.isArray(v) || v.length !== IDI3_L.length || v.some((x) => typeof x !== 'string' || !x.trim())) mal.push(k); }
    const crudas = []; PREFS.bienvenida = true; inicioMostrar(true);
    for (const l of IDI3_L) { idiomaAplicar(l); for (const tab of ['mod', 'mapa', 'anim', 'gmod']) { RB.t.tab = tab; RB.t.vista = 'instalados'; RB.t.ficha = null; inicioPanel('tienda'); const tx = RB.el.querySelector('.rbPan_tienda').textContent; const m = tx.match(/\\b(ti|gm|hab|sel|emo|mm|pjm|e|o|v|t|p|m|c)\\.[A-Za-z]{2,}\\b/g); if (m) crudas.push(l + ':' + m.join(',')); } }
    idiomaAplicar('es'); return { claves: K.length, mal, crudas, es: [T('ti.cats'), T('ti.activar'), T('ti.equipar'), T('ti.nuevoMapa'), T('ti.desdeCero')], en: [T3('ti.cats', 'en'), T3('ti.activar', 'en'), T3('ti.equipar', 'en'), T3('ti.nuevoMapa', 'en'), T3('ti.desdeCero', 'en')] }; })()`);
  ok('10. los textos nuevos están en los 14 idiomas y no se ve ninguna clave cruda', t.claves >= 12 && !t.mal.length && !t.crudas.length && t.es[0] === 'Categorías' && t.en[0] === 'Categories', t);
  errores.push(...err.filter((x) => !/WebSocket|mqtt|net::|favicon|Failed to load resource|shader simplificado|willReadFrequently/i.test(x)));
  await b.close();
}
ok('11. sin errores de JS', !errores.length, errores.slice(0, 5));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
process.exit(R.every(Boolean) ? 0 : 1);
