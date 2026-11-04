// Arranque: lienzo, datos, hojas de sprites y fuentes; después el menú (o lo que pida la URL).
'use strict';
GD.HOJAS_INICIO = ['GJ_GameSheet', 'GJ_GameSheet02', 'GJ_GameSheet03', 'GJ_GameSheet04', 'GJ_GameSheetGlow', 'GJ_LaunchSheet', 'GJ_ParticleSheet', 'GJ_GameSheetEditor'];
GD.FUENTES_INICIO = ['bigFont', 'goldFont', 'chatFont'];
GD.cargarFuente = async function (n) {
  const F = GD.datos.fuentes[n]; if (!F) return;
  F.tx = await GD.T.textura(F.page.replace(/(-hd)?\.png$/, '')); GD.fuentes[n] = F;
};
// hojas que no están al empezar se piden cuando hacen falta
GD.cargarHoja = async function (n) {
  const h = GD.datos.hojas[n]; if (h === undefined) return null;
  const tx = await GD.T.textura(n);
  if (h) GD.T.registrar(n, tx, h); else GD.T.marcoTextura(n, tx);
  return tx;
};
GD.arrancar = async function () {
  const c = GD.D.canvas = document.getElementById('lienzo');
  GD.R.init(c); GD.S.init(); GD.D.instalarToques(c); GD.D.medir();
  const PQ = window.GD_PAQUETES || {};
  GD.CANCIONES_LOCALES = window.GD_CANCIONES_LOCALES || [];
  // 1) lo justo para la pantalla de carga del juego (LoadingLayer)
  await GD.cargarPaquete(PQ.arranque);
  GD.datos = JSON.parse(await GD.paq['arranque.json'].text());
  await Promise.all(Object.keys(GD.datos.hojas).map(GD.cargarHoja));
  await Promise.all(Object.keys(GD.datos.fuentes).map(GD.cargarFuente));
  const carga = GD.pantallaCarga(); GD.D.cambiar(carga, 0);
  requestAnimationFrame(GD.D.ciclo);
  const tapa = document.getElementById('tapa'); if (tapa) tapa.remove();
  try { parent.postMessage({ type: 'game:ready' }, '*'); } catch (e) { }
  // 2) el resto, con la barra de la pantalla de carga
  const idx = await GD.cargarPaquete(PQ.inicio, k => carga.avance(k * 0.75));
  const json = async r => JSON.parse(await GD.paq[r].text());
  GD.datos = await json('datos.json'); GD.O.cargarTabla(await json('objetos.json'));
  GD.iconos = GD.cargarPaquete(PQ.iconos);
  const fuentesTex = new Set(Object.values(GD.datos.fuentes).map(f => f.page.replace(/(-hd)?\.png$/, '')));
  const hojas = Object.keys(idx).filter(r => r.startsWith('tex/')).map(r => r.slice(4, -5)).filter(n => !fuentesTex.has(n) && !GD.T.tex[n]);
  let hechas = 0;
  await Promise.all(hojas.map(n => GD.cargarHoja(n).then(() => carga.avance(0.75 + 0.2 * (++hechas) / hojas.length))));
  await GD.iconos; carga.avance(1);
  const q = new URLSearchParams(location.search);
  GD.D.cambiar(await GD.inicio(q), 0);
  GD.listo = true;
};
// pantalla de carga como la del juego: fondo, logo, barra y un consejo
GD.pantallaCarga = function () {
  const { U, D, Sprite } = GD, c = new U.Capa(), W = D.ancho, H = D.alto;
  const TIPS = ['Tip: You can download all the songs from the level select page!', 'Tip: Hold to keep jumping!', 'Tip: Practice mode lets you place checkpoints.',
    'Tip: Collect secret coins to unlock new icons!', 'Tip: You can share your levels online!', 'Tip: Change your icon in the icon kit!'];
  c.fondoDegradado([0, 102, 255]);
  U.sprite(c, 'GJ_logo_001.png', W / 2, H / 2 + 50);
  U.sprite(c, 'RobTopLogoBig_001.png', W / 2, H / 2 - 30, 0.6);
  const barra = U.sprite(c, 'slidergroove.png', W / 2, 40);
  const lleno = new Sprite('sliderBar.png'); lleno.anc(0, 0); lleno.pos(4, 4); lleno.repX = barra.w - 8; lleno.recorte = 0; barra.agregar(lleno, -1);
  U.texto(c, TIPS[Math.floor(Math.random() * TIPS.length)], W / 2, 18, 'goldFont', 0.45).limitar(W - 40, 0.45);
  const lbl = U.texto(c, 'Loading resources', W / 2, 62, 'goldFont', 0.6);
  c.avance = k => { lleno.recorte = Math.max(0.0001, Math.min(1, k)); lbl.texto(k >= 1 ? 'Loading...' : 'Loading resources'); };
  return c;
};
// qué mostrar primero: el menú, o (para probar) un nivel directo
GD.inicio = async function (q) {
  if (q.get('nivel')) {
    const id = q.get('nivel');
    return GD.Menus ? GD.Menus.partidaOficial(id, { practica: q.get('practica') === '1', silencio: q.get('silencio') === '1', noclip: q.get('noclip') === '1', desdeX: +q.get('x') || 0, desdeY: +q.get('y') || 0 }) : null;
  }
  if (q.get('editor')) { const n = await GD.Editor.nuevo(); if (q.get('editor') !== 'nuevo') { n.texto = await GD.N.descomprimir(GD.datos.niveles[q.get('editor')]); } return GD.Editor.abrir(n); }
  if (q.get('pantalla')) { const f = GD.Menus[q.get('pantalla')]; if (f) return f(); }
  return GD.Menus.menu();
};
window.addEventListener('load', () => GD.arrancar().catch(e => { console.error(e); const t = document.getElementById('tapa'); if (t) t.textContent = 'Error: ' + e.message; }));
