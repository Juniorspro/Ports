// Ajustes → Gráficos → «Motor gráfico»: sólo WebGL 2 (el de entrada) y WebGL 1 (compatible), en el navegador y en la app
// (la app ya no trae otros motores: ni el nativo con V8 ni JXGL). Pasar a WebGL 1 recarga la página, lo deja guardado y
// queda; un jugador de antes con el WebGL 1 guardado (el de entrada viejo) pasa solo a WebGL 2.
// uso: node motores.mjs URL_HTML
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const ver = async (app, elegir) => {
  const { b, p, err, ev } = await abrir(HTML, true, null, async (pg) => {
    // (la app: el puente de la WebView, con lo que ofrece de verdad ahora)
    if (app) await pg.addInitScript(() => { window.JXNativo = { version: () => '2.9', salir: () => {}, abrir: () => {}, memoriaMB: () => 0, almacenPendiente: () => '' }; });
    // (un jugador de antes: tenía guardado el WebGL 1, que era el de entrada; sólo en la primera carga)
    else await pg.addInitScript(() => { try { if (!sessionStorage.getItem('__viejo')) { sessionStorage.setItem('__viejo', '1'); localStorage.setItem('jx_prefs', JSON.stringify({ motor: 'webgl1', bienvenida: true, tutVisto: true })); } } catch (e) { } });
  });
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego'`), null, { timeout: 60000 }); await p.waitForTimeout(800);
  const r = await ev(`(() => { abrirAjustes(); const s = document.getElementById('aM'); return { ops: [...s.options].map((o) => o.value), valor: s.value, motor: R.gl1 ? 'webgl1' : 'webgl2' }; })()`);
  if (elegir) {
    // (si la página se recarga, la marca desaparece)
    await ev(`(() => { window.__marca = 1; document.getElementById('aM').value = ${JSON.stringify(elegir)}; document.getElementById('aOk').click(); return 1; })()`);
    await p.waitForTimeout(3500); await p.waitForFunction(() => !!window.__ev, null, { timeout: 60000 });
    r.recargo = await ev('window.__marca ? 0 : 1'); r.guardado = await ev(`JSON.parse(localStorage.getItem('jx_prefs') || '{}').motor || PREFS.motor`).catch(() => ev('PREFS.motor'));
    r.despues = await ev('PREFS.motor').catch(() => null); r.motorDespues = await ev(`R.gl1 ? 'webgl1' : 'webgl2'`).catch(() => null);
  }
  fs.mkdirSync('/tmp/claude-0/reg', { recursive: true });
  await p.screenshot({ path: '/tmp/claude-0/reg/motores_' + (app ? 'app' : 'web') + '.png' });
  await b.close(); return { r, err: err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket connection to 'wss:/i.test(x)) };
};
const web = await ver(false, 'webgl1'), app = await ver(true, null);
ok('en el navegador: WebGL 2 y WebGL 1, nada más; un jugador de antes con WebGL 1 guardado pasa a WebGL 2', web.r.ops.join() === 'webgl2,webgl1' && web.r.valor === 'webgl2' && web.r.motor === 'webgl2', web.r);
ok('pasar a WebGL 1 recarga, lo deja guardado y queda (no se pasa solo a WebGL 2)', web.r.recargo === 1 && web.r.guardado === 'webgl1' && web.r.despues === 'webgl1' && web.r.motorDespues === 'webgl1', { recargo: web.r.recargo, guardado: web.r.guardado, despues: web.r.despues, motor: web.r.motorDespues });
ok('en la app: también sólo WebGL 2 y WebGL 1 (sin el nativo con V8 ni JXGL), arrancando en WebGL 2', app.r.ops.join() === 'webgl2,webgl1' && app.r.valor === 'webgl2' && app.r.motor === 'webgl2', app.r);
ok('sin errores de JS', !web.err.length && !app.err.length, [...web.err, ...app.err].slice(0, 4));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
