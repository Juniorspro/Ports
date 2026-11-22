// Panel (9dudhdrc): «Botones que no tienen ninguna utilidad» (video con la Plasma Pistol: «recargar» y «apuntar» no hacen
// nada). En el celular, con un arma de un mod, se muestran sólo los que esa arma usa (gmaSwepBotones):
//  1. Plasma Pistol (409515836): munición "" y SecondaryAttack vacío → sin «recargar» ni «apuntar»;
//  2. otras de prueba: lo que diga su Lua (Reload/SecondaryAttack propios y no vacíos, cargador con munición, mira de
//     hierro, o un Think que mira la R o el botón 2) — se imprime cada una para revisarla contra su Lua;
//  3. sin errores de JS.
// uso: node botones_swep.mjs ARCHIVO.html [CARPETA]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/botones_swep'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const { b, p, err, ev } = await abrir(HTML, true);   // (como un celular: táctil)
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego'`), null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(2500); await p.touchscreen.tap(5, 300); await p.waitForTimeout(300);   // (modo táctil, como en el celular)
const ADDONS = (process.env.IDS || '409515836,123277559,1412913313,111861987').split(',');
const res = {};
for (const id of ADDONS) {
  const r = await ev(`(async () => { const A = await gmInstalar('${id}', { nombre: '${id}' }); await A.listo; await new Promise((r) => setTimeout(r, 600)); return (A.sweps || []).slice(0, 4); })()`).catch((e) => ({ error: String(e).slice(0, 120) }));
  if (!Array.isArray(r)) { res[id] = r; continue; }
  res[id] = {};
  for (const cl of r) {
    await ev(`(() => { spawnElegir('armas', 'gmswep:${cl}'); return 1; })()`); await p.waitForTimeout(900);
    res[id][cl] = await ev(`(() => { const bt = gmaSwepBotones('${cl}'), v = (i) => { const e = document.getElementById(i); return !!e && !e.classList.contains('oc') && getComputedStyle(e).display !== 'none'; }; return { bt, recargar: v('brecargar'), apuntar: v('bdisp2') }; })()`);
  }
}
await p.screenshot({ path: D + '/ultima.png' });
console.log(JSON.stringify(res, null, 1));
const pl = res['409515836'] && res['409515836'].weapon_plasmapistol;
ok('1. Plasma Pistol: sin «recargar» ni «apuntar» (los dos no hacían nada)', pl && !pl.recargar && !pl.apuntar && pl.bt && !pl.bt.recargar && !pl.bt.secundario, pl);
const todas = Object.values(res).flatMap((x) => (x && !x.error ? Object.values(x) : []));
ok('2. en las demás, los botones siguen a lo que dice su Lua (se ve el de recargar si recarga y el de apuntar si usa el secundario)', todas.length >= 3 && todas.every((x) => x.bt && x.recargar === !!x.bt.recargar && x.apuntar === !!x.bt.secundario), todas.length);
const js = err.filter((x) => !/favicon|ERR_|net::|404|409|WebSocket|mqtt|wss:|CORS|scheme 'file'|Cache/i.test(x));
ok('3. sin errores de JS', !js.length, js.slice(0, 4));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(0);
