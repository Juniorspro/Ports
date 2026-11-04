// ¿Se ve igual que la versión anterior? Misma escena quieta (gm_construct, sin personajes ni props, hora fija, cámara
// fija) en cada calidad y desde dos lugares; guarda CARPETA/<nombre>_<calidad>_<k>.png para comparar con comparar_png.py.
// uso: node captura_igual.mjs URL_HTML NOMBRE [CARPETA] [calidades=bajo,medio,alto,ultra]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, NOM, D = '/tmp/claude-0/igual', CALS = 'bajo,medio,alto,ultra'] = process.argv; fs.mkdirSync(D, { recursive: true });
const VISTAS = [['3.42,-2.72,24.14', 2.2, 0.05], ['-20,-2.5,10', 4.0, 0.15]];
const { b, p, ev } = await abrir(HTML, false, null);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'alto'; PREFS.resDin = false; PREFS.res = 100; PREFS.lejos = PERFILES.alto.lejos; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(2500);
for (const cal of CALS.split(',')) {
  await ev(`(() => { PREFS.gfx = '${cal}'; PREFS.res = PERFILES['${cal}'].res; PREFS.lejos = PERFILES['${cal}'].lejos; aplicarGfx(); cerrarPaneles(); return 1; })()`);
  for (let k = 0; k < VISTAS.length; k++) {
    const [pos, yaw, pitch] = VISTAS[k];
    // (todo quieto: la hora, el tiempo del juego que mueve el agua y las nubes, y el jugador en el aire sin gravedad)
    await ev(`(() => { JUG.noclip = true; JUG.pos.set(${pos}); JUG.vel.set(0, 0, 0); JUG.yaw = ${yaw}; JUG.pitch = ${pitch}; DIA.hora = 13; DIA.ciclo = false; diaAplicar && diaAplicar(); return 1; })()`);
    await p.waitForTimeout(3500);
    await ev(`(() => { TIEMPO.t = 100; MODS.tiempo = 0.000001; JUG.pos.set(${pos}); JUG.vel.set(0, 0, 0); JUG.yaw = ${yaw}; JUG.pitch = ${pitch}; return 1; })()`);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${D}/${NOM}_${cal}_${k}.png` });
    await ev(`MODS.tiempo = 1; 1`);
  }
}
console.log(JSON.stringify({ ok: true, nom: NOM }));
await b.close();
