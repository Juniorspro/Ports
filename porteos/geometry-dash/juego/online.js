// Lo online: el servidor del juego a través del intermediario del sitio (__gd/, en el worker de
// Cloudflare: el navegador no puede hablarle directo), búsqueda con filtros, destacados, diarios,
// gauntlets, map packs, listas, ficha del nivel (LevelInfoLayer), descarga, canciones y cuenta.
'use strict';
(() => {
const OL = GD.Online = {};
const { U, D, A, E, Sprite, Texto, Nodo } = GD;
const P = GD.perfil;
const SECRETO = 'Wmfd2893gb7';
OL.base = () => GD.ruta(GD.baseGD || '__gd/');
OL.canciones = GD.G.leer('canciones', {});

OL.pedir = async function (ep, params = {}) {
  const cuerpo = new URLSearchParams(Object.assign({ gameVersion: 22, binaryVersion: 42, secret: SECRETO }, params));
  const r = await fetch(OL.base() + ep + '.php', { method: 'POST', body: cuerpo, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!r.ok) throw new Error('red ' + r.status);
  const t = await r.text();
  if (t === '-1' || t === '') throw new Error('-1');
  return t;
};
// "1:a:2:b" → {1:'a', 2:'b'}
OL.claves = (s, sep = ':') => { const p = s.split(sep), o = {}; for (let i = 0; i + 1 < p.length; i += 2) o[p[i]] = p[i + 1]; return o; };
OL.desc = s => { try { return GD.N.texto64(s || ''); } catch (e) { return ''; } };
OL.leerCanciones = function (bloque) {
  for (const s of (bloque || '').split('~:~')) {
    if (!s) continue; const o = OL.claves(s, '~|~');
    if (o[1]) OL.canciones[o[1]] = { id: +o[1], nombre: o[2], artista: o[4], tam: o[5], url: decodeURIComponent(o[10] || '') };
  }
  GD.G.escribir('canciones', OL.canciones);
};
// respuesta de getGJLevels21: niveles#creadores#canciones#página
OL.leerNiveles = function (t) {
  const [nv, cr, ca, pg] = t.split('#');
  const creadores = {}; for (const c of (cr || '').split('|')) { const [pid, nom, acc] = c.split(':'); creadores[pid] = { nombre: nom, cuenta: acc }; }
  OL.leerCanciones(ca);
  const niveles = (nv || '').split('|').filter(x => x).map(s => OL.nivel(OL.claves(s), creadores));
  const [total, desde, cuantos] = (pg || '0:0:10').split(':').map(Number);
  return { niveles, total, desde, cuantos };
};
OL.DIF = { 0: 'na', 10: 'easy', 20: 'normal', 30: 'hard', 40: 'harder', 50: 'insane' };
OL.nivel = function (o, creadores = {}) {
  const demon = o[17] == 1, auto = o[25] == 1;
  const num = +o[9] || 0;
  let dif = auto ? 'auto' : demon ? 'demon' : OL.DIF[num] || 'na';
  const demonDif = { 3: 7, 4: 8, 0: 6, 5: 9, 6: 10 }[+o[43]] || 6;
  return {
    id: +o[1], nombre: o[2] || '', desc: OL.desc(o[3]), version: +o[5], pid: o[6], creador: (creadores[o[6]] || {}).nombre || '-', descargas: +o[10] || 0,
    cancionOf: +o[12] || 0, likes: +o[14] || 0, largo: +o[15] || 0, estrellas: +o[18] || 0, destacado: +o[19] > 0, epico: +o[42] || 0,
    cancion: +o[35] || 0, monedas: +o[37] || 0, monedasV: o[38] == 1, objetos: +o[45] || 0, dif, demonDif, dosJ: o[31] == 1, texto: o[4], plataforma: +o[15] === 5,
  };
};
OL.caraNivel = function (lv) {
  if (lv.dif === 'demon') return `diffIcon_${String(lv.demonDif).padStart(2, '0')}_btn_001.png`;
  return GD.Menus.diffIcon(lv.dif);
};
OL.LARGOS = ['Tiny', 'Short', 'Medium', 'Long', 'XL', 'Plat.'];
// canción de un nivel online: las que trae el juego, si no del intermediario
OL.rutaCancion = function (id) {
  if (GD.datos && GD.datos.hojas && OL.enDatos(id)) return `datos/mus/${id}.ogg`;
  const c = OL.canciones[id];
  if (+id >= 10000000) return OL.base() + 'audio?u=' + encodeURIComponent(`https://geometrydashfiles.b-cdn.net/music/${id}.ogg`);
  if (c && /^https?:/.test(c.url || '')) return OL.base() + 'audio?u=' + encodeURIComponent(c.url);
  // sin dirección (el servidor da "-"): la descarga de Newgrounds redirige al mp3
  return OL.base() + 'audio?u=' + encodeURIComponent('https://www.newgrounds.com/audio/download/' + id);
};
OL.enDatos = id => (GD.CANCIONES_LOCALES || []).includes(+id);
OL.prepararCancion = async function (id) {
  if (OL.canciones[id] || +id >= 10000000) return OL.canciones[id];
  try { const t = await OL.pedir('getGJSongInfo', { songID: id }); OL.leerCanciones(t); } catch (e) { }
  return OL.canciones[id];
};

// ---------------- búsqueda (LevelSearchLayer) ----------------
OL.filtros = GD.G.leer('filtros', { dif: [], largo: [], noCompletados: false, completados: false, destacado: false, original: false, dosJ: false, monedas: false, epico: false, estrella: false, sinEstrella: false, cancion: 0 });
OL.buscar = function () {
  const c = new U.Capa(), W = D.ancho, H = D.alto;
  c.alCrear = () => {
    c.fondoDegradado([0, 102, 255]); c.esquinas();
    const marco = U.cajaOscura(Math.min(W - 100, 420), 50, 100); marco.pos(W / 2 - marco.w / 2, H - 70); c.agregar(marco);
    const campo = c.campo = new U.Campo('Enter a level, user or id', Math.min(W - 230, 300), 34, 'bigFont', 30); campo.pos(W / 2 - 50, H - 45); c.agregar(campo, 2);
    campo.texto = GD.G.leer('ultimaBusqueda', '');
    U.boton(c, new Nodo(), W / 2 - 50, H - 45, () => campo.enfocar()).w = 300;
    campo.alListo = v => GD.G.escribir('ultimaBusqueda', v);
    U.boton(c, U.botonTexto('Search', 70, 'bigFont', 'GJ_button_02.png', 30, 0.5), W / 2 + 140, H - 45, () => { U.soltarFoco(); OL.lista({ tipo: 0, str: campo.texto }); }, 3);
    U.boton(c, U.botonTexto('User', 50, 'bigFont', 'GJ_button_01.png', 30, 0.4), W / 2 + 200, H - 45, () => { U.soltarFoco(); OL.porUsuario(campo.texto); }, 3);
    // categorías como el juego
    const cats = [['Most Downloaded', 1, 'GJ_sDownloadIcon_001.png'], ['Most Liked', 2, 'GJ_sLikeIcon_001.png'], ['Trending', 3, 'GJ_sTrendingIcon_001.png'], ['Recent', 4, 'GJ_sRecentIcon_001.png'],
      ['Magic', 7, 'GJ_sMagicIcon_001.png'], ['Awarded', 11, 'GJ_sStarsIcon_001.png'], ['Featured', 6, 'GJ_featuredIcon_001.png'], ['Hall Of Fame', 16, 'GJ_sModIcon_001.png'], ['Sent', 27, 'GJ_sFollowedIcon_001.png'], ['Friends', 13, 'GJ_sFriendsIcon_001.png']];
    const ancho = Math.min(150, (W - 120) / 3);
    cats.forEach(([t, tipo, ic], i) => {
      const b = U.botonTexto(t, ancho, 'bigFont', 'GJ_button_01.png', 28, 0.45);
      if (GD.T.m(ic)) { const s = new Sprite(ic); s.escala = 0.55; s.pos(12, 14); b.agregar(s); b.lbl.x += 6; }
      U.boton(c, b, W / 2 + ((i % 3) - 1) * (ancho + 8), H - 105 - Math.floor(i / 3) * 34, () => OL.lista({ tipo, str: '' }));
    });
    // filtros de dificultad y largo
    const difs = [['na', -1, 'diffIcon_00_btn_001.png'], ['easy', 1, 'diffIcon_01_btn_001.png'], ['normal', 2, 'diffIcon_02_btn_001.png'], ['hard', 3, 'diffIcon_03_btn_001.png'], ['harder', 4, 'diffIcon_04_btn_001.png'], ['insane', 5, 'diffIcon_05_btn_001.png'], ['demon', -2, 'diffIcon_06_btn_001.png'], ['auto', -3, 'diffIcon_auto_btn_001.png']];
    const F = OL.filtros, filaD = 70;
    difs.forEach(([n, v, f], i) => {
      const s = new Sprite(f); s.escala = 0.6; const on = F.dif.includes(v); s.color(on ? [255, 255, 255] : [100, 100, 100]);
      U.boton(c, s, W / 2 + (i - 3.5) * 40 - 40, filaD, () => { const k = F.dif.indexOf(v); if (k >= 0) F.dif.splice(k, 1); else F.dif.push(v); s.color(F.dif.includes(v) ? [255, 255, 255] : [100, 100, 100]); GD.G.escribir('filtros', F); });
    });
    OL.LARGOS.forEach((t, i) => {
      const l = U.texto(c, t, W / 2 + (i - 2.5) * 52 - 40, 32, 'bigFont', 0.45); const on = () => F.largo.includes(i); l.color(on() ? [255, 255, 255] : [110, 110, 110]);
      U.boton(c, new Nodo(), l.x, l.y, () => { const k = F.largo.indexOf(i); if (k >= 0) F.largo.splice(k, 1); else F.largo.push(i); l.color(on() ? [255, 255, 255] : [110, 110, 110]); GD.G.escribir('filtros', F); }).w = 48;
    });
    U.boton(c, 'GJ_plusBtn_001.png', W - 50, 50, () => OL.masFiltros(), 3, 0.8);
    c.botonAtras(() => { U.soltarFoco(); D.cambiar(GD.Menus.creador()); });
  };
  c.atras = () => D.cambiar(GD.Menus.creador());
  return c;
};
OL.masFiltros = function () {
  const pop = new U.Popup(400, 260), k = pop.caja, F = OL.filtros; pop.titulo('Advanced Search');
  [['noCompletados', 'Uncompleted'], ['completados', 'Completed'], ['destacado', 'Featured'], ['original', 'Original'], ['dosJ', '2-Player'], ['monedas', 'Coins'], ['epico', 'Epic'], ['estrella', 'Rated'], ['sinEstrella', 'No Star']].forEach(([kk, t], i) => {
    const x = -150 + (i % 3) * 120, y = 70 - Math.floor(i / 3) * 40;
    U.casilla(k, x, y, F[kk], v => { F[kk] = v; GD.G.escribir('filtros', F); }, 0.6); U.texto(k, t, x + 16, y, 'bigFont', 0.4).anc(0, 0.5);
  });
  U.texto(k, 'Song ID', -60, -55, 'goldFont', 0.5);
  const campo = new U.Campo('0', 100, 28, 'bigFont', 9, '0123456789'); campo.texto = F.cancion ? String(F.cancion) : ''; campo.pos(40, -55); k.agregar(campo);
  U.boton(k, new Nodo(), 40, -55, () => campo.enfocar()).w = 100;
  campo.alListo = v => { F.cancion = parseInt(v || '0', 10) || 0; GD.G.escribir('filtros', F); };
  U.boton(k, U.botonTexto('OK', 60), 0, -100, () => { U.soltarFoco(); pop.cerrar(); });
  pop.mostrar();
};
OL.paramsFiltros = function (q) {
  const F = OL.filtros, p = {};
  if (F.dif.length) { const demon = F.dif.includes(-2); const ds = F.dif.filter(x => x !== -2); if (demon) p.diff = '-2'; else p.diff = ds.join(','); }
  if (F.largo.length) p.len = F.largo.join(',');
  if (F.noCompletados) p.uncompleted = 1; if (F.completados) p.onlyCompleted = 1;
  if ((F.noCompletados || F.completados)) p.completedLevels = '(' + Object.keys(P.progreso).filter(k => k[0] === 'o' && P.progreso[k].hecho).map(k => k.slice(1)).join(',') + ')';
  if (F.destacado) p.featured = 1; if (F.original) p.original = 1; if (F.dosJ) p.twoPlayer = 1; if (F.monedas) p.coins = 1; if (F.epico) p.epic = 1; if (F.estrella) p.star = 1; if (F.sinEstrella) p.noStar = 1;
  if (F.cancion) { p.song = F.cancion; p.customSong = 1; }
  return Object.assign(p, q);
};
OL.porUsuario = async function (nombre) {
  if (!nombre) return;
  try { const t = await OL.pedir('getGJUsers20', { str: nombre, page: 0 }); const u = OL.claves(t.split('#')[0].split('|')[0]); OL.lista({ tipo: 5, str: u[2], titulo: u[1] }); }
  catch (e) { U.alerta('Search', 'User not found.'); }
};

// ---------------- lista de niveles (LevelBrowserLayer) ----------------
// q: {tipo, str, titulo, ids (lista de ids para map packs / gauntlets), locales (array de niveles ya leídos)}
OL.listaEscena = function (q) {
  const c = new U.Capa(), W = D.ancho, H = D.alto; let pagina = q.pagina || 0;
  c.alCrear = () => {
    c.fondoDegradado([0, 102, 255]); c.esquinas();
    c.titulo = U.texto(c, q.titulo || OL.tituloTipo(q), W / 2, H - 22, 'goldFont', 0.75, 2);
    const marco = U.cajaOscura(Math.min(W - 120, 440), 230, 100); marco.pos(W / 2 - marco.w / 2, 35); c.agregar(marco);
    c.lista = new U.Lista(marco.w - 10, 220, 74); c.lista.pos(marco.x + 5, 40); c.agregar(c.lista, 1); U.manejarLista(c, c.lista);
    c.estado = U.texto(c, 'Loading...', W / 2, H / 2, 'goldFont', 0.6, 3);
    c.izq = U.boton(c, 'GJ_arrow_03_001.png', 30, H / 2, () => { if (pagina > 0) { pagina--; c.cargar(); } }, 3, 0.8);
    c.der = U.boton(c, 'GJ_arrow_03_001.png', W - 30, H / 2, () => { pagina++; c.cargar(); }, 3, 0.8); c.der.cont.fx = true;
    c.lblPag = U.texto(c, '', W - 60, H - 20, 'goldFont', 0.45, 2);
    U.boton(c, 'GJ_updateBtn_001.png', W - 30, 30, () => c.cargar(), 3, 0.7);
    c.botonAtras(() => D.cambiar(q.volver ? q.volver() : q.tipo === 'guardados' ? GD.Menus.creador() : OL.buscar()));
    c.cargar();
  };
  c.cargar = async () => {
    c.estado.texto('Loading...'); c.estado.vis = true; c.lista.poner([]);
    try {
      let r;
      if (q.tipo === 'guardados') { const todos = (await GD.G.idbTodo('bajados')).sort((a, b) => (b.guardado || 0) - (a.guardado || 0)); r = { niveles: todos.slice(pagina * 10, pagina * 10 + 10), total: todos.length, desde: pagina * 10 }; }
      else if (q.locales) r = { niveles: q.locales.slice(pagina * 10, pagina * 10 + 10), total: q.locales.length, desde: pagina * 10 };
      else {
        const t = await OL.pedir('getGJLevels21', OL.paramsFiltros({ type: q.ids ? 10 : q.tipo, str: q.ids ? q.ids.join(',') : (q.str || ''), page: pagina, total: 0 }));
        r = OL.leerNiveles(t);
      }
      c.mostrar(r);
    } catch (e) { c.estado.texto(e.message === '-1' ? 'No levels found' : 'Something went wrong...\n(' + e.message + ')'); }
  };
  c.mostrar = r => {
    c.estado.vis = !r.niveles.length; if (!r.niveles.length) c.estado.texto('No levels found');
    c.lista.poner(r.niveles.map(lv => OL.celda(lv, c.lista.w, () => D.cambiar(OL.ficha(lv, () => OL.listaEscena(Object.assign(q, { pagina })))))));
    const hasta = Math.min(r.total || 0, (r.desde || 0) + r.niveles.length);
    c.lblPag.texto(r.total ? `${(r.desde || 0) + 1} to ${hasta} of ${r.total}` : '');
    c.izq.vis = pagina > 0; c.der.vis = r.total ? hasta < r.total : r.niveles.length >= 10;
  };
  c.atras = () => D.cambiar(q.volver ? q.volver() : OL.buscar());
  return c;
};
OL.tituloTipo = q => ({ 0: 'Search', 1: 'Most Downloaded', 2: 'Most Liked', 3: 'Trending', 4: 'Recent', 5: 'User Levels', 6: 'Featured', 7: 'Magic', 11: 'Awarded', 13: 'Friends', 16: 'Hall Of Fame', 27: 'Sent', guardados: 'Saved Levels' })[q.tipo] || 'Levels';
// celda de un nivel en la lista (GJLevelCell)
OL.celda = function (lv, ancho, alVer) {
  const f = new Nodo(); f.w = ancho; f.h = 74;
  const fondo = U.cajaOscura(ancho - 6, 70, 50, 'square02_small.png', 6); fondo.pos(3, 2); f.agregar(fondo);
  U.sprite(f, OL.caraNivel(lv), 30, 45, 0.8);
  if (lv.estrellas) { U.texto(f, String(lv.estrellas), 26, 16, 'bigFont', 0.4).anc(1, 0.5); U.sprite(f, lv.plataforma ? 'GJ_moonsIcon_001.png' : 'GJ_starsIcon_001.png', 36, 16, 0.4); }
  if (lv.destacado || lv.epico) U.sprite(f, lv.epico ? 'GJ_epicCoin_001.png' : 'GJ_featuredCoin_001.png', 30, 45, 0.8).z = -1;
  U.texto(f, lv.nombre, 60, 58, 'bigFont', 0.6).anc(0, 0.5).limitar(ancho - 200, 0.6);
  U.texto(f, 'By ' + lv.creador, 60, 38, 'goldFont', 0.55).anc(0, 0.5).limitar(ancho - 200, 0.55);
  const can = lv.cancion ? (OL.canciones[lv.cancion] || {}).nombre || ('NG ' + lv.cancion) : GD.Editor.NOMBRES_CANCION[lv.cancionOf] || '';
  U.texto(f, can, 60, 22, 'bigFont', 0.35).anc(0, 0.5).color([255, 125, 255]).limitar(ancho - 200, 0.35);
  U.sprite(f, 'GJ_timeIcon_001.png', 66, 7, 0.4); U.texto(f, OL.LARGOS[lv.largo] || '', 74, 7, 'goldFont', 0.35).anc(0, 0.5);
  U.sprite(f, 'GJ_downloadsIcon_001.png', 126, 7, 0.4); U.texto(f, U.num(lv.descargas), 134, 7, 'goldFont', 0.35).anc(0, 0.5);
  U.sprite(f, 'GJ_likesIcon_001.png', 206, 7, 0.4); U.texto(f, U.num(lv.likes), 214, 7, 'goldFont', 0.35).anc(0, 0.5);
  for (let i = 0; i < lv.monedas; i++) U.sprite(f, lv.monedasV ? 'GJ_coinsIcon_001.png' : 'GJ_coinsIcon_gray_001.png', ancho - 110 + i * 14, 18, 0.45);
  U.boton(f, U.botonTexto('View', 66, 'bigFont', 'GJ_button_01.png', 30, 0.55), ancho - 45, 45, alVer);
  return f;
};

// ---------------- ficha del nivel (LevelInfoLayer) ----------------
OL.ficha = function (lv, volver) {
  const c = new U.Capa(), W = D.ancho, H = D.alto;
  c.alCrear = async () => {
    c.fondoDegradado([0, 102, 255]); c.esquinas();
    U.texto(c, lv.nombre, W / 2, H - 25, 'bigFont', 0.8).limitar(W - 160, 0.8);
    U.texto(c, 'By ' + lv.creador, W / 2, H - 50, 'goldFont', 0.65);
    U.sprite(c, OL.caraNivel(lv), W / 2 - 110, H / 2 + 20, 1.1);
    if (lv.destacado || lv.epico) U.sprite(c, lv.epico ? 'GJ_epicCoin_001.png' : 'GJ_featuredCoin_001.png', W / 2 - 110, H / 2 + 20, 1.1, -1);
    if (lv.estrellas) { U.texto(c, String(lv.estrellas), W / 2 - 115, H / 2 - 25, 'bigFont', 0.5).anc(1, 0.5); U.sprite(c, lv.plataforma ? 'GJ_moonsIcon_001.png' : 'GJ_starsIcon_001.png', W / 2 - 100, H / 2 - 25, 0.6); }
    const stats = [['GJ_downloadsIcon_001.png', U.num(lv.descargas)], ['GJ_likesIcon_001.png', U.num(lv.likes)], ['GJ_timeIcon_001.png', OL.LARGOS[lv.largo] || '']];
    stats.forEach(([ic, t], i) => { U.sprite(c, ic, W / 2 + 110, H / 2 + 40 - i * 25, 0.6); U.texto(c, t, W / 2 + 125, H / 2 + 40 - i * 25, 'bigFont', 0.45).anc(0, 0.5); });
    const pr = P.nivel('o' + lv.id);
    GD.Menus.barraProgreso(c, W / 2, 85, pr.normal, [0, 255, 0], 240, 'Normal Mode');
    GD.Menus.barraProgreso(c, W / 2, 50, pr.practica, [0, 255, 255], 240, 'Practice Mode');
    c.estado = U.texto(c, '', W / 2, H / 2 - 50, 'goldFont', 0.5);
    c.play = U.boton(c, 'GJ_playBtn2_001.png', W / 2, H / 2 + 20, () => c.jugar());
    U.boton(c, 'GJ_infoBtn_001.png', W / 2 + 70, H - 45, () => U.alerta(lv.nombre, (lv.desc || '(No description provided)') + `\n\nID: ${lv.id}   Objects: ${lv.objetos || '?'}`), 2, 0.7);
    U.boton(c, 'GJ_duplicateBtn_001.png', W - 35, H / 2, () => c.copiar(), 2, 0.6);
    U.boton(c, 'GJ_deleteBtn_001.png', W - 35, H / 2 - 45, async () => { await GD.G.idbBorrar('bajados', lv.id); U.aviso('Deleted'); }, 2, 0.6);
    const cn = lv.cancion ? await OL.prepararCancion(lv.cancion) : null;
    U.texto(c, cn ? `${cn.nombre} by ${cn.artista}` : (lv.cancion ? 'Song ' + lv.cancion : GD.Editor.NOMBRES_CANCION[lv.cancionOf]), W / 2, 18, 'bigFont', 0.4).color([255, 125, 255]);
    c.botonAtras(() => D.cambiar(volver ? volver() : OL.buscar()));
  };
  c.texto = async () => {
    const g = await GD.G.idbLeer('bajados', lv.id); if (g && g.texto) return g.texto;
    c.estado.texto('Downloading...');
    const t = await OL.pedir('downloadGJLevel22', { levelID: lv.id });
    const o = OL.claves(t.split('#')[0]);
    const txt = await GD.N.descomprimir(o[4]);
    await GD.G.idbPoner('bajados', lv.id, Object.assign({}, lv, OL.nivel(o), { creador: lv.creador, texto: txt, guardado: Date.now() }));
    c.estado.texto('');
    return txt;
  };
  c.jugar = async () => {
    try {
      const txt = await c.texto();
      if (lv.cancion) await OL.prepararCancion(lv.cancion);
      const info = { id: lv.id, nombre: lv.nombre, estrellas: lv.estrellas, plataforma: lv.plataforma, musica: lv.cancion ? OL.rutaCancion(lv.cancion) : GD.Editor.rutaCancion({ oficial: lv.cancionOf }) };
      GD.S.efecto('playSound_01.ogg'); GD.S.pararMusica();
      D.cambiar(await GD.Menus.jugar(txt, info, { volver: () => OL.ficha(lv, volver) }));
    } catch (e) { c.estado.texto('Download failed (' + e.message + ')'); }
  };
  c.copiar = async () => {
    try { const txt = await c.texto(); const n = await GD.Editor.nuevo(); n.texto = txt; n.nombre = lv.nombre + ' (copy)'; n.cancion = lv.cancion ? { ng: lv.cancion } : { oficial: lv.cancionOf }; await GD.Editor.guardar(n); U.aviso('Copied to My Levels'); }
    catch (e) { c.estado.texto('Download failed'); }
  };
  c.atras = () => D.cambiar(volver ? volver() : OL.buscar());
  return c;
};

// ---------------- diario, semanal, evento ----------------
OL.diario = async function (tipo) {
  const t = tipo === 'evento' ? 2 : tipo ? 1 : 0;
  try {
    U.aviso('Loading...');
    const dl = await OL.pedir('downloadGJLevel22', { levelID: [-1, -2, -3][t] });
    const o = OL.claves(dl.split('#')[0]); const lv = OL.nivel(o);
    let creador = '-'; try { const r = await OL.pedir('getGJLevels21', { type: 0, str: String(lv.id), page: 0 }); const l = OL.leerNiveles(r).niveles[0]; if (l) { creador = l.creador; lv.cancion = l.cancion; } } catch (e) { }
    lv.creador = creador;
    await GD.G.idbPoner('bajados', lv.id, Object.assign({}, lv, { texto: await GD.N.descomprimir(o[4]), guardado: Date.now() }));
    D.cambiar(OL.ficha(lv, () => GD.Menus.creador()));
  } catch (e) { U.alerta(['Daily', 'Weekly', 'Event'][t], 'Could not load the level. (' + e.message + ')'); }
};
// ---------------- map packs y gauntlets ----------------
OL.mapPacksEscena = function () {
  const c = new U.Capa(), W = D.ancho, H = D.alto; let pagina = 0;
  c.alCrear = () => {
    c.fondoDegradado([0, 102, 255]); c.esquinas(); U.texto(c, 'Map Packs', W / 2, H - 22, 'goldFont', 0.8);
    const marco = U.cajaOscura(Math.min(W - 120, 420), 230, 100); marco.pos(W / 2 - marco.w / 2, 35); c.agregar(marco);
    c.lista = new U.Lista(marco.w - 10, 220, 60); c.lista.pos(marco.x + 5, 40); c.agregar(c.lista, 1); U.manejarLista(c, c.lista);
    c.estado = U.texto(c, 'Loading...', W / 2, H / 2, 'goldFont', 0.6, 3);
    const der = U.boton(c, 'GJ_arrow_03_001.png', W - 30, H / 2, () => { pagina++; c.cargar(); }, 3, 0.8); der.cont.fx = true;
    U.boton(c, 'GJ_arrow_03_001.png', 30, H / 2, () => { if (pagina) { pagina--; c.cargar(); } }, 3, 0.8);
    c.botonAtras(() => D.cambiar(GD.Menus.creador()));
    c.cargar();
  };
  c.cargar = async () => {
    c.estado.vis = true; c.estado.texto('Loading...'); c.lista.poner([]);
    try {
      const t = await OL.pedir('getGJMapPacks21', { page: pagina });
      const packs = t.split('#')[0].split('|').map(s => OL.claves(s));
      c.lista.poner(packs.map(p => {
        const f = new Nodo(); f.w = c.lista.w; f.h = 60;
        const fondo = U.cajaOscura(f.w - 6, 56, 50, 'square02_small.png', 6); fondo.pos(3, 2); f.agregar(fondo);
        U.sprite(f, `diffIcon_${String(Math.min(10, +p[6] || 0)).padStart(2, '0')}_btn_001.png`, 30, 30, 0.7);
        const col = (p[7] || '255,255,255').split(',').map(Number);
        U.texto(f, p[2], 60, 38, 'bigFont', 0.55).anc(0, 0.5).color(col).limitar(f.w - 170, 0.55);
        U.texto(f, `${p[4]} stars  ${p[5]} coins`, 60, 18, 'goldFont', 0.45).anc(0, 0.5);
        U.boton(f, U.botonTexto('View', 66, 'bigFont', 'GJ_button_01.png', 30, 0.55), f.w - 45, 30, () => D.cambiar(OL.listaEscena({ tipo: 10, ids: p[3].split(','), titulo: p[2], volver: () => OL.mapPacksEscena() })));
        return f;
      }));
      c.estado.vis = false;
    } catch (e) { c.estado.texto('Something went wrong...'); }
  };
  c.atras = () => D.cambiar(GD.Menus.creador());
  return c;
};
OL.mapPacks = () => D.cambiar(OL.mapPacksEscena());
OL.gauntletsEscena = function () {
  const c = new U.Capa(), W = D.ancho, H = D.alto;
  const NOMBRES = { 1: 'Fire', 2: 'Ice', 3: 'Poison', 4: 'Shadow', 5: 'Lava', 6: 'Bonus', 7: 'Chaos', 8: 'Demon', 9: 'Time', 10: 'Crystal', 11: 'Magic', 12: 'Spike', 13: 'Monster', 14: 'Doom', 15: 'Death', 16: 'Forest', 17: 'Rune', 18: 'Force', 19: 'Spooky', 20: 'Dragon', 21: 'Water', 22: 'Haunted', 23: 'Acid', 24: 'Witch', 25: 'Power', 26: 'Potion', 27: 'Snake', 28: 'Toxic', 29: 'Halloween', 30: 'Treasure', 31: 'Ghost', 32: 'Spider', 33: 'Gem', 34: 'Inferno', 35: 'Portal', 36: 'Strange', 37: 'Fantasy', 38: 'Christmas', 39: 'Surprise', 40: 'Mystery', 41: 'Cursed', 42: 'Cyborg', 43: 'Castle', 44: 'Grave', 45: 'Temple', 46: 'World', 47: 'Galaxy', 48: 'Universe', 49: 'Discord', 50: 'Split', 51: 'NCS I', 52: 'NCS II', 53: 'Space', 54: 'Cosmos' };
  c.alCrear = async () => {
    c.fondoDegradado([40, 20, 60]); c.esquinas(); U.texto(c, 'The Gauntlets', W / 2, H - 22, 'goldFont', 0.8);
    c.botonAtras(() => D.cambiar(GD.Menus.creador()));
    const est = U.texto(c, 'Loading...', W / 2, H / 2, 'goldFont', 0.6);
    try {
      const t = await OL.pedir('getGJGauntlets21', { special: 1 });
      const gs = t.split('#')[0].split('|').map(s => OL.claves(s));
      est.vis = false; let pag = 0; const cont = new Nodo(); c.agregar(cont);
      const armar = () => {
        cont.vaciar();
        gs.slice(pag * 3, pag * 3 + 3).forEach((g, i) => {
          const caja = U.cajaOscura(150, 190, 120); U.texto(caja, (NOMBRES[g[1]] || 'Gauntlet ' + g[1]), 75, 165, 'bigFont', 0.55).limitar(140, 0.55); U.texto(caja, 'Gauntlet', 75, 145, 'goldFont', 0.5);
          U.texto(caja, `${g[3].split(',').length} levels`, 75, 25, 'goldFont', 0.45);
          U.boton(cont, caja, W / 2 + (i - 1) * 165, H / 2 - 15, () => D.cambiar(OL.listaEscena({ tipo: 10, ids: g[3].split(','), titulo: (NOMBRES[g[1]] || '') + ' Gauntlet', volver: () => OL.gauntletsEscena() })));
        });
      };
      armar();
      const der = U.boton(c, 'GJ_arrow_03_001.png', W - 30, H / 2, () => { pag = (pag + 1) % Math.ceil(gs.length / 3); armar(); }, 3, 0.8); der.cont.fx = true;
      U.boton(c, 'GJ_arrow_03_001.png', 30, H / 2, () => { pag = (pag - 1 + Math.ceil(gs.length / 3)) % Math.ceil(gs.length / 3); armar(); }, 3, 0.8);
    } catch (e) { est.texto('Something went wrong...'); }
  };
  c.atras = () => D.cambiar(GD.Menus.creador());
  return c;
};
OL.gauntlets = () => D.cambiar(OL.gauntletsEscena());
// listas de niveles (2.2)
OL.listasEscena = function () {
  const c = new U.Capa(), W = D.ancho, H = D.alto; let pagina = 0, tipo = 6;
  c.alCrear = () => {
    c.fondoDegradado([0, 102, 255]); c.esquinas(); c.tit = U.texto(c, 'Lists', W / 2, H - 22, 'goldFont', 0.8);
    const marco = U.cajaOscura(Math.min(W - 120, 420), 220, 100); marco.pos(W / 2 - marco.w / 2, 35); c.agregar(marco);
    c.lista = new U.Lista(marco.w - 10, 210, 60); c.lista.pos(marco.x + 5, 40); c.agregar(c.lista, 1); U.manejarLista(c, c.lista);
    c.estado = U.texto(c, 'Loading...', W / 2, H / 2, 'goldFont', 0.6, 3);
    [['Featured', 6], ['Trending', 3], ['Recent', 4], ['Top', 2]].forEach(([t, v], i) => U.boton(c, U.botonTexto(t, 80, 'bigFont', 'GJ_button_01.png', 24, 0.4), W / 2 + (i - 1.5) * 88, H - 48, () => { tipo = v; pagina = 0; c.cargar(); }, 3));
    const der = U.boton(c, 'GJ_arrow_03_001.png', W - 30, H / 2, () => { pagina++; c.cargar(); }, 3, 0.8); der.cont.fx = true;
    U.boton(c, 'GJ_arrow_03_001.png', 30, H / 2, () => { if (pagina) { pagina--; c.cargar(); } }, 3, 0.8);
    c.botonAtras(() => D.cambiar(GD.Menus.creador()));
    c.cargar();
  };
  c.cargar = async () => {
    c.estado.vis = true; c.estado.texto('Loading...'); c.lista.poner([]);
    try {
      const t = await OL.pedir('getGJLevelLists', { type: tipo, str: '', page: pagina });
      const [ls, cr] = t.split('#'); const creadores = {}; for (const x of (cr || '').split('|')) { const [pid, nom] = x.split(':'); creadores[pid] = nom; }
      c.lista.poner(ls.split('|').map(s => OL.claves(s)).map(l => {
        const f = new Nodo(); f.w = c.lista.w; f.h = 60;
        const fondo = U.cajaOscura(f.w - 6, 56, 50, 'square02_small.png', 6); fondo.pos(3, 2); f.agregar(fondo);
        U.texto(f, l[2] || 'List', 20, 38, 'bigFont', 0.55).anc(0, 0.5).limitar(f.w - 140, 0.55);
        U.texto(f, `By ${creadores[l[49]] || l[50] || '-'}  ·  ${(l[51] || '').split(',').length} levels`, 20, 18, 'goldFont', 0.45).anc(0, 0.5);
        U.boton(f, U.botonTexto('View', 66, 'bigFont', 'GJ_button_01.png', 30, 0.55), f.w - 45, 30, () => D.cambiar(OL.listaEscena({ tipo: 10, ids: (l[51] || '').split(','), titulo: l[2], volver: () => OL.listasEscena() })));
        return f;
      }));
      c.estado.vis = false;
    } catch (e) { c.estado.texto('Something went wrong...'); }
  };
  c.atras = () => D.cambiar(GD.Menus.creador());
  return c;
};
OL.listas = () => D.cambiar(OL.listasEscena());
OL.lista = q => D.cambiar(OL.listaEscena(q));
// ---------------- puntajes (LeaderboardsLayer) ----------------
OL.puntajes = function () {
  const pop = new U.Popup(Math.min(D.ancho - 40, 420), 280), k = pop.caja; pop.titulo('Top 100');
  const lista = new U.Lista(pop.pw - 40, 200, 30); lista.pos(-pop.pw / 2 + 20, -110); k.agregar(lista); U.manejarLista(pop, lista);
  const est = U.texto(k, 'Loading...', 0, 0, 'goldFont', 0.6);
  OL.pedir('getGJScores20', { type: 'top', count: 100 }).then(t => {
    est.vis = false;
    lista.poner(t.split('|').filter(x => x).map(s => OL.claves(s)).map(u => { const f = new Nodo(); f.w = lista.w; f.h = 30; U.texto(f, `${u[6]}. ${u[1]}`, 10, 15, 'bigFont', 0.45).anc(0, 0.5); U.sprite(f, 'GJ_starsIcon_001.png', f.w - 15, 15, 0.45); U.texto(f, U.num(+u[3]), f.w - 28, 15, 'bigFont', 0.4).anc(1, 0.5); return f; }));
  }).catch(() => est.texto('Something went wrong...'));
  pop.cerrarBtn(); pop.mostrar();
};
// ---------------- cuenta y subir niveles ----------------
OL.gjp2 = async pass => { const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(pass + 'mI29fmAnxgTs')); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); };
OL.cuenta = function () {
  const cu = GD.G.leer('cuenta', null);
  const pop = new U.Popup(360, 240), k = pop.caja; pop.titulo(cu ? 'Account: ' + cu.usuario : 'Login');
  if (cu) {
    U.texto(k, 'Logged in as ' + cu.usuario, 0, 30, 'goldFont', 0.6);
    U.boton(k, U.botonTexto('Log Out', 100, 'goldFont', 'GJ_button_06.png', 30, 0.6), 0, -30, () => { GD.G.escribir('cuenta', null); pop.cerrar(); });
  } else {
    const us = new U.Campo('Username', 200, 30, 'bigFont', 20); us.pos(0, 45); k.agregar(us); U.boton(k, new Nodo(), 0, 45, () => us.enfocar()).w = 200;
    const pw = new U.Campo('Password', 200, 30, 'bigFont', 20); pw.pos(0, 5); k.agregar(pw); U.boton(k, new Nodo(), 0, 5, () => pw.enfocar()).w = 200;
    const est = U.texto(k, '', 0, -30, 'chatFont', 0.6);
    U.boton(k, U.botonTexto('Login', 90, 'goldFont', 'GJ_button_01.png', 30, 0.6), 0, -70, async () => {
      U.soltarFoco(); est.texto('Logging in...');
      try {
        const g2 = await OL.gjp2(pw.texto);
        const t = await OL.pedir('accounts/loginGJAccount', { udid: 'S' + Math.floor(Math.random() * 1e9), userName: us.texto, gjp2: g2, secret: 'Wmfv3899gc9', sID: '' });
        const [acc, pid] = t.split(',');
        GD.G.escribir('cuenta', { usuario: us.texto, cuenta: acc, jugador: pid, gjp2: g2 }); est.texto('Logged in!'); setTimeout(() => pop.cerrar(), 600);
      } catch (e) { est.texto(e.message === '-1' ? 'Login failed' : 'Error: ' + e.message); }
    });
  }
  pop.cerrarBtn(); pop.mostrar();
};
OL.subir = async function (n) {
  const cu = GD.G.leer('cuenta', null);
  if (!cu) { U.alerta('Share', 'You need to log in to a Geometry Dash account to upload levels.', 'Cancel', 'Login', null, () => OL.cuenta()); return; }
  if (!n.verificado) { U.alerta('Share', 'You have to verify the level first: complete it in normal mode from the start.'); return; }
  try {
    const comp = await GD.N.comprimir(n.texto);
    const seed2 = await OL.semilla2(comp);
    const p = { accountID: cu.cuenta, gjp2: cu.gjp2, userName: cu.usuario, levelID: n.subido || 0, levelName: n.nombre, levelDesc: GD.N.a64(n.desc || ''), levelVersion: n.version || 1,
      levelLength: 0, audioTrack: n.cancion && !n.cancion.ng ? n.cancion.oficial : 0, auto: 0, password: 0, original: 0, twoPlayer: 0, songID: n.cancion && n.cancion.ng ? n.cancion.ng : 0, objects: n.objetos || 0,
      coins: 0, requestedStars: 0, unlisted: 0, ldm: 0, levelString: comp, seed2, seed: Math.random().toString(36).slice(2, 12) };
    const t = await OL.pedir('uploadGJLevel21', p);
    n.subido = +t; await GD.Editor.guardar(n); U.alerta('Share', 'Level uploaded! ID: ' + t);
  } catch (e) { U.alerta('Share', 'Upload failed (' + e.message + ')'); }
};
// semilla del nivel para subir (como el juego: 50 caracteres repartidos + xor "41274")
OL.semilla2 = async function (s) {
  let r = ''; if (s.length < 50) r = s; else { const paso = Math.floor(s.length / 50); for (let i = 0; i < 50; i++) r += s[i * paso]; }
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(r + 'xI25fpAapCQg'));
  const h = [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
  const k = '41274'; let x = ''; for (let i = 0; i < h.length; i++) x += String.fromCharCode(h.charCodeAt(i) ^ k.charCodeAt(i % k.length));
  return btoa(x).replace(/\+/g, '-').replace(/\//g, '_');
};
})();
