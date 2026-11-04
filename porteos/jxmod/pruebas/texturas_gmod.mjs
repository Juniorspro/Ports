// cambiar la calidad de textura en Ajustes con un arma de GMod en la mano: el arma no puede quedar blanca. Se cuenta
// cuántas texturas de addons quedan sin textura (eso era el blanco) y se mira la imagen del arma antes y después.
// uso: node texturas_gmod.mjs URL_HTML URL_CARPETA_GMA [ID=123277559 (Nyan Gun)]
import { abrir } from './base.mjs';
const [, , HTML, CARP, ID = '123277559'] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; PREFS.texQ = 'alta'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
const cls = await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${ID}.gma')).arrayBuffer()); const A = await gmInstalar('${ID}', { nombre: 'x', sinDeps: true }, b); await A.listo; return (A.sweps || [])[0]; })()`);
await ev(`gmaSpawnMenu('gmswep:${cls}'); JUG.pitch = 0; 1`); await p.waitForTimeout(3500);
// (la zona del arma, abajo a la derecha: brillo y cuánto color tiene)
const zona = async () => { const s = await p.screenshot({ clip: { x: 760, y: 420, width: 420, height: 280 } }); return s; };
const medir = (png) => ev(`(async () => { const im = await createImageBitmap(new Blob([new Uint8Array(${'['}${'...'}window.__png])], { type: 'image/png' })); return 0; })()`);
const stats = async () => {
  const buf = await zona(); await p.evaluate((a) => { window.__png = a; }, [...buf]);
  return ev(`(async () => { const im = await createImageBitmap(new Blob([new Uint8Array(window.__png)], { type: 'image/png' })), c = new OffscreenCanvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, im.width, im.height).data; let n = 0, blanco = 0, sat = 0;
    for (let i = 0; i < d.length; i += 16) { const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); n++; if (mn > 225) blanco++; sat += mx - mn; }
    return { blanco: +(blanco / n).toFixed(3), color: +(sat / n).toFixed(1) }; })()`);
};
const sinTex = () => ev(`DATA.tx.reduce((n, d, i) => n + (d && d.gm && !R.tex[i] ? 1 : 0), 0)`);
const a0 = await stats(), s0 = await sinTex(); await p.screenshot({ path: 'tex_antes.png' });
// (como el jugador: Ajustes → Calidad de textura → Baja → Listo, con el arma en la mano)
for (const q of ['baja', 'alta']) {
  await ev(`(() => { abrirAjustes('pausa'); document.getElementById('aTq').value = '${q}'; document.getElementById('aOk').click(); cerrarPaneles(); return 1; })()`);
  await p.waitForTimeout(2500);
}
const a1 = await stats(), s1 = await sinTex(); await p.screenshot({ path: 'tex_despues.png' });
ok('después de cambiar la calidad, ninguna textura de addon queda sin textura', s1 === 0, { antes: s0, despues: s1 });
ok('el arma no queda blanca (la zona del arma no se aclara ni pierde el color)', a1.blanco <= a0.blanco + 0.05 && a1.color >= a0.color * 0.7, { antes: a0, despues: a1 });
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
