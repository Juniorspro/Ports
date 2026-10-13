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
  const barra = document.getElementById('carga');
  const paso = (k, t) => { if (barra) barra.style.width = (k * 100) + '%'; };
  const PQ = window.GD_PAQUETES || {};
  GD.CANCIONES_LOCALES = window.GD_CANCIONES_LOCALES || [];
  const idx = await GD.cargarPaquete(PQ.inicio, k => paso(k * 0.7));
  const json = async r => JSON.parse(await GD.paq[r].text());
  GD.datos = await json('datos.json'); GD.O.cargarTabla(await json('objetos.json'));
  GD.iconos = GD.cargarPaquete(PQ.iconos); // los íconos llegan mientras tanto
  // todas las hojas del paquete (las fuentes se registran aparte)
  const fuentesTex = new Set(Object.values(GD.datos.fuentes).map(f => f.page.replace(/(-hd)?\.png$/, '')));
  const hojas = Object.keys(idx).filter(r => r.startsWith('tex/')).map(r => r.slice(4, -5)).filter(n => !fuentesTex.has(n));
  let hechas = 0;
  await Promise.all(hojas.map(n => GD.cargarHoja(n).then(() => paso(0.7 + 0.25 * (++hechas) / hojas.length))));
  await Promise.all(GD.FUENTES_INICIO.map(GD.cargarFuente));
  await GD.iconos;
  paso(1);
  const q = new URLSearchParams(location.search);
  GD.D.cambiar(await GD.inicio(q), 0);
  requestAnimationFrame(GD.D.ciclo);
  const tapa = document.getElementById('tapa'); if (tapa) tapa.remove();
  try { parent.postMessage({ type: 'game:ready' }, '*'); } catch (e) { }
  GD.listo = true;
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
