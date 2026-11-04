// WebGL 2: la misma escena quieta (gm_construct al mediodía, sin gente, la cámara fija) con distintas variantes de la URL,
// para comparar las fotos (que una optimización no cambie la imagen) y lo que cuesta cada una. Variantes separadas por
// coma; cada una es lo que se agrega a la URL (vacía = como sale). Las fotos van a CARPETA/ab_<n>.png.
// uso: node webgl2_ab.mjs URL_HTML "variante1,variante2" [calidad=alto] [CARPETA=/tmp/claude-0/ab] [vistas=3]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, VARS = ',&hdr16=1', CAL = 'alto', D = '/tmp/claude-0/ab', NV = '3'] = process.argv; fs.mkdirSync(D, { recursive: true });
// vistas: el cielo de frente (degradé, donde se notaría el banding), el mapa con sombras y el piso de cerca
const VISTAS = [[0, -0.25], [2.2, 0.05], [4.0, 0.45]].slice(0, +NV);
const res = []; let fijo = null;   // (la aparición es al azar: todas las variantes van al lugar de la primera)
for (const [n, v] of VARS.split(',').entries()) {
  // (una variante que empieza con @ es otro HTML entero, por ejemplo la versión de antes)
  const base = v.startsWith('@') ? v.slice(1) : HTML, url = base + (base.includes('?') ? '' : '?') + '&gl=2' + (v.startsWith('@') ? '' : v);
  const { b, p, ev, err } = await abrir(url, true, null);
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = ${JSON.stringify(CAL)}; PREFS.resDin = false; const q = PERFILES[PREFS.gfx]; PREFS.res = q.res; PREFS.lejos = q.lejos; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
  await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
  await ev(`(() => { cerrarPaneles(); DIA.hora = 13; DIA.ciclo = false; diaAplicar && diaAplicar(); document.body.classList.add('ocultarHUD'); for (const e of document.querySelectorAll('#hud, #tactil, .hud, #mira')) e.style.visibility = 'hidden'; return 1; })()`);
  if (!fijo) fijo = await ev(`[JUG.pos.x, JUG.pos.y, JUG.pos.z]`);
  else await ev(`(() => { JUG.pos.set(${fijo.join(',')}); JUG.vel.set(0, 0, 0); return 1; })()`);
  await p.waitForTimeout(4000);
  const info = await ev(`({ motor: R.gl1 ? 'webgl1' : 'webgl2', hdr: PO.fh ? (PO.fh[0] === R.gl.R11F_G11F_B10F ? 'R11F_G11F_B10F' : 'RGBA16F') : PO.hdr ? 'RGBA16F' : 'sin', lienzo: R.cv.width + 'x' + R.cv.height, post: !!PO.ok, ao: !!R.conAO })`);
  const fotos = [];
  for (const [k, [yaw, pitch]] of VISTAS.entries()) {
    await ev(`(() => { JUG.yaw = ${yaw}; JUG.pitch = ${pitch}; return 1; })()`);
    await p.waitForTimeout(2500);
    const f = `${D}/ab_${n}_${k}.png`; await p.locator('#cv').screenshot({ path: f }); fotos.push(f);
  }
  res.push({ variante: v || '(como sale)', ...info, fotos, errores: err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket/i.test(x)).slice(0, 3) });
  await b.close();
}
console.log(JSON.stringify(res, null, 1));
