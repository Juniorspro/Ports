// las skins de Freddy, Bonnie, Chica y Foxy: en un mapa con luz, en tercera persona, quieto, caminando y con un emote
// (fotos para mirar) y medidas: alto del modelo animado, pies en el piso, nada que se estire (huesos con largo raro)
// uso: node skins_fnaf.mjs HTML CARPETA
import { abrir } from './base.mjs';
const HTML = process.argv[2], S = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(HTML);
const J = async (s) => JSON.parse(await ev(`JSON.stringify(${s})`));
await ev(`PREFS.bienvenida = true; PREFS.lang = 'es'; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida(MAPAS[0]); 1`);
await p.waitForTimeout(5000);
console.log('personajes nuevos en la tienda:', await J(`DATA.chars.slice(-4)`));
const cuadros = async (n) => { const m0 = await ev(`R.marca`); for (let i = 0; i < 60 && (await ev(`R.marca`)) < m0 + n; i++) await p.waitForTimeout(200); };
for (const s of ['Hero', 'Freddy', 'Bonnie', 'Chica', 'Foxy']) {
  await ev(`PREFS.skin = '${s}'; jugadorCuerpoNuevo(); JUG.tercera = true; JUG.noclip = false; JUG.vel.set(0, 0, 0); JUG.pitch = 0.12; 1`);
  await cuadros(4); await p.screenshot({ path: S + `skin_${s}_quieto.png` });
  // medidas del cuerpo animado: lo más alto y lo más bajo de los huesos respecto de los pies del jugador
  const m = await J(`(() => { const P = JUG.cuerpo, D = P.D, md = P.md; md.actualizar(); const ys = []; for (const k in D.h) ys.push(md.W[D.h[k]][13]); const piso = JUG.pos.y - 1.2;
    const pie = Math.min(md.W[D.h.LeftFoot][13], md.W[D.h.RightFoot][13]) - piso, cab = md.W[D.h.Head][13] - piso;
    return { skin: P.skin, tobillo: +D.tobillo.toFixed(3), pie: +pie.toFixed(3), cabeza: +cab.toFixed(2) }; })()`);
  console.log('quieto', JSON.stringify(m));
  await ev(`ENT.teclas.add('KeyW'); 1`); await cuadros(6); await p.screenshot({ path: S + `skin_${s}_camina.png` }); await ev(`ENT.teclas.delete('KeyW'); 1`);
  await ev(`emote('Hi'); 1`); await cuadros(6); await p.screenshot({ path: S + `skin_${s}_emote.png` });
  await ev(`JUG.cuerpo.emote = null; JUG.tercera = true; 1`);
}
console.log('errores:', err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).slice(0, 6).join(' | ') || 'ninguno');
await b.close();
