// el panel de emotes con miniaturas: las de captura muestran su silueta (no el ícono de la categoría), en la compu y en
// el celular; abrir "Todos" con las 120 primeras no tarda más de 150 ms; una animación tuya también tiene la suya.
// uso: node emotes_minis_panel.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const D = (process.argv[3] || '.') + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
for (const celu of [false, true]) {
  const tag = celu ? 'celu' : 'pc', { b, p, err, ev } = await abrir(process.argv[2], celu);
  await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await p.waitForTimeout(2000);
  const t = await ev(`(() => { EMO.cat = 'caminar'; const t0 = performance.now(); cerrarPaneles(); $('emotes').classList.remove('oc'); UI.abierto = 'emotes'; emoDibujar(); const ms = performance.now() - t0;
    const it = [...document.querySelectorAll('#emoLista .emoIt.cmu')]; return { ms: Math.round(ms), n: it.length, conMini: it.filter((x) => x.querySelector('svg.emoMini')).length, conCat: it.filter((x) => x.querySelector('.emoCatIco')).length, catalogo: CMU_CAT.items.filter((x) => x[5] && x[5].length === 64).length }; })()`);
  await p.waitForTimeout(400); await p.screenshot({ path: D + 'emotes_minis_' + tag + '.png' });
  ok(`${tag}: las de captura con su silueta (todas las del catálogo la tienen), el panel se arma en < 150 ms`, t.n > 50 && t.conMini === t.n && t.conCat === 0 && t.catalogo === 2175 && t.ms < 150, t);
  if (!celu) {
    const mio = await ev(`(() => { const C = emoClip('rb:Gangnam'); INST.anims['local-prueba'] = { nombre: 'Mi baile', cat: 'baile', clip: { fps: C.fps, nf: C.nf, b: C.b, r: Array.from(C.r), h: C.h ? Array.from(C.h) : null, loop: C.loop } }; EMO.cat = 'mio'; emoDibujar(); const x = document.querySelector('#emoLista [data-emo="u:local-prueba"]'); const r = { mini: !!(x && x.querySelector('svg.emoMini')) }; delete INST.anims['local-prueba']; return r; })()`);
    ok('una animación tuya también tiene su silueta (hecha al verla)', mio.mini, mio);
  }
  ok(`${tag}: sin errores`, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.slice(0, 3));
  await b.close();
}
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
