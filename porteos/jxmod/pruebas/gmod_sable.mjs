// la Lightsaber de GMod (Robotboy655, 111412589): al sacarla pasa a tercera persona (su CalcView), el sable va en la
// mano del personaje (su modelo de mundo pegado a la mano) y la hoja se dibuja desde el Lua (rb655_RenderBlade) saliendo
// del sable; la palanca de primera persona no se ve; la barra de la Fuerza abajo; sin errores. Fotos de PC y celu girado.
// uso: node gmod_sable.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, CARP, DIR = '.'] = process.argv, D = DIR + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
for (const celu of [false, true]) {
  const { b, p, err, ev } = await abrir(HTML, celu);
  await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await p.waitForTimeout(2500);
  const e0 = await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/111412589.gma')).arrayBuffer()); const A = await gmInstalar('111412589', { nombre: 'Lightsabers', sinDeps: true }, b); await A.listo; return (GMA.errores || []).length; })()`);
  const t0 = await ev(`(() => { JUG.tercera = false; gmaDarArma('weapon_lightsaber'); const i = ARM.lista.indexOf('gm:weapon_lightsaber'); elegirArma(i); JUG.yaw = 0.6; JUG.pitch = 0.05; return { i, ter: JUG.tercera }; })()`);
  await p.waitForTimeout(2500);
  const r = await ev(`(() => { const w = GMA.swep; const ruta = w && w.mundoRuta; let hoja = 0; for (const x of GR.L.mundo || []) hoja++;
    const mano = JUG.cuerpo ? (() => { JUG.cuerpo.md.actualizar(); const W = JUG.cuerpo.md.W[JUG.cuerpo.D.h.RightHand]; return v3(W[12], W[13], W[14]); })() : null;
    // (el centro de la malla del sable en el mundo, y dónde nace la hoja según el Lua)
    let centro = null; const A = ruta && GMH.defs.get(ruta); if (A && w.mundoW) { const d = DATA.ms[DATA.pf[DATA.pfPorNombre['gm:' + ruta]][0].m]; const c = d ? v3(d.mn[0] + d.sc[0] / 2, d.mn[1] + d.sc[1] / 2, d.mn[2] + d.sc[2] / 2) : null; if (c) { const M = w.mundoW; centro = v3(M[0] * c.x + M[4] * c.y + M[8] * c.z + M[12], M[1] * c.x + M[5] * c.y + M[9] * c.z + M[13], M[2] * c.x + M[6] * c.y + M[10] * c.z + M[14]); } }
    let base = null; gmaEnLado('C', () => GMA.R.G.get('RunString')('local w = LocalPlayer():GetActiveWeapon() local p, d = w:GetSaberPosAng() __SB = { p, d }'));
    const sb = GMA.R.ovC.get('__SB'); if (sb) { base = vG(sb.get(1)); }
    const cm = (a) => (a && mano ? +(a.distTo(mano) * 100).toFixed(1) : null);
    return { arma: w && w.clase, tercera: !!JUG.tercera, vm: !!(ARM.v && !ARM.v.oculto && !JUG.tercera), ruta, mallaCm: cm(centro), hojaCm: cm(base), primitivas: hoja, camAtras: +Math.hypot(CAM.pos.x - JUG.ojoPos.x, CAM.pos.z - JUG.ojoPos.z).toFixed(2), err: (GMA.errores || []).slice(${e0}, ${e0} + 6), faltan: [...(GMA.faltan || new Map()).keys()].slice(-12) }; })()`);
  const png = await p.screenshot({ path: D + 'sable_' + (celu ? 'celu' : 'pc') + '.png' });
  const tag = celu ? 'celu' : 'pc';
  // (cuántos píxeles tienen el celeste de la hoja: 0, 127, 255 brillando)
  const azul = await ev(`(async () => { const im = new Image(); im.src = 'data:image/png;base64,${png.toString('base64')}'; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 200 && d[i + 2] - d[i] > 150) n++; return n; })()`);
  r.azul = azul;
  ok(`${tag}: con la Lightsaber pasa a tercera persona (cámara ≥ 1,5 m atrás) y no se ve la palanca de primera persona`, r.tercera && !r.vm && r.camAtras >= 1.5, r);
  ok(`${tag}: el sable va en la mano (centro del mango a ≤ 15 cm de la muñeca), la hoja nace en su punta (≤ 30 cm) y se ve celeste (≥ 40 píxeles)`, r.ruta && r.mallaCm !== null && r.mallaCm <= 15 && r.hojaCm !== null && r.hojaCm <= 30 && r.primitivas > 0 && r.azul >= 40, { ruta: r.ruta, mallaCm: r.mallaCm, hojaCm: r.hojaCm, primitivas: r.primitivas, azul: r.azul });
  ok(`${tag}: sin errores de Lua`, !r.err.length, r.err);
  await ev(`DBG.cam = { p: v3(JUG.pos.x + Math.cos(JUG.yaw) * 2.2, JUG.pos.y + 0.6, JUG.pos.z - Math.sin(JUG.yaw) * 2.2), q: Quat.euler(JUG.yaw - Math.PI / 2, 0.1) }; 1`); await p.waitForTimeout(600);
  await p.screenshot({ path: D + 'sable_' + tag + '_costado.png' }); await ev(`DBG.cam = null; 1`);
  // al guardarla vuelve a primera persona
  await ev(`elegirArma(ARM.lista.indexOf('PhysicsGun')); 1`); await p.waitForTimeout(800);
  const v = await ev(`({ tercera: !!JUG.tercera, arma: ARM.lista[ARM.i] })`);
  ok(`${tag}: al cambiar de arma vuelve a primera persona`, !v.tercera, v);
  const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
  ok(`${tag}: sin errores de JS`, !e2.length, e2.slice(0, 5));
  await b.close();
}
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); process.exit(0);
