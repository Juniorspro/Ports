// las fotos del menú de los 8 mapas propios (los que reemplazan a los de Hyper Sandbox): una toma linda de cada uno, en
// calidad Alta, de 400 × 225, a herramientas/fotos_mapas_hs/<mapa>.webp (después herramientas/mapas_hs.py las mete en el
// paquete con el nombre de las de antes). Uso: node pruebas/fotos_mapas_hs.mjs URL_HTML [mapa,mapa...]; con CARGA=1, las de
// la pantalla de carga (herramientas/fotos_mapas_hs/carga, 1280 × 720)
import { abrir } from './base.mjs';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const AQUI = path.dirname(fileURLToPath(import.meta.url)), D = path.join(AQUI, '..', 'herramientas', 'fotos_mapas_hs'); fs.mkdirSync(D, { recursive: true });
const TOMAS = {   // [dónde está la cámara, adónde mira, hora]
  FlatGrass: [[-34, 9, -40], [0, 3, 30], 16.5], Desert: [[96, 22, -110], [36, 2, -16], 17.2], DesertV2: [[-160, 62, 22], [80, 4, 18], 16.8],
  City: [[-170, 75, -170], [-20, 0, -20], 16.2], Base: [[-110, 42, -205], [10, 0, 60], 15.8], BaseV2: [[330, 38, -140], [140, 0, 40], 16.4],
  Mars: [[-12, 7, -14], [22, 3, 18], 15.5], Space: [[-80, 45, -95], [0, 12, 40], 12],
};
const { b, p, ev } = await abrir(process.argv[2], false);
await p.setViewportSize({ width: 1280, height: 720 });
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'alto'; PREFS.resDin = false; PREFS.res = 100; aplicarGfx(); 1`);
for (const m of (process.argv[3] || Object.keys(TOMAS).join(',')).split(',')) {
  const [c, a, h] = TOMAS[m];
  await ev(`(() => { inicioMostrar(false); empezarPartida('${m}'); return 1; })()`);
  await p.waitForFunction((mm) => window.__ev(`JUEGO.estado === 'juego' && MUNDO.nombre === '${mm}' && !!JUG.suelo`), m, { timeout: 180000 });
  await ev(`(() => { cerrarPaneles(); DBG.sinVista = true; DIA.ciclo = false; DIA.hora = ${h}; DIA.aplicada = -1; document.querySelectorAll('body > *:not(#cv)').forEach((e) => e.style.visibility = 'hidden');
    const pp = v3(${c}), dd = vsub(v3(${a}), pp).norm(); DBG.cam = { p: pp, q: Quat.euler(Math.atan2(dd.x, dd.z), -Math.asin(clamp(dd.y, -1, 1)), 0) }; return 1; })()`);
  await p.waitForTimeout(3500);
  const png = await p.screenshot({ type: 'png' });
  if (process.env.CARGA) { fs.mkdirSync(path.join(D, 'carga'), { recursive: true }); fs.writeFileSync(path.join(D, 'carga', m + '.png'), png); }   // (CARGA=1: también el fondo de la pantalla de carga, 1280 × 720)
  else fs.writeFileSync(path.join(D, m + '.png'), png);
  console.log('foto', m);
  await ev(`DBG.cam = null; DBG.sinVista = false; 1`);
}
await b.close();
