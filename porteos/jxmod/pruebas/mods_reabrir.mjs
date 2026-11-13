// Discord (Gumball): «se borran varios mods de gmod y ponen que son scripts». Se instalan addons de verdad por la cola
// (como desde la tienda: packs de armas, la TFA Base con su pack, M9K...) y se cierra y se vuelve a abrir el juego varias
// veces con el mismo perfil del navegador. Después de cada vuelta, por addon: sigue instalado, está montado, qué dice su
// tarjeta del panel GMod (Armas · 21, Base... o «Script») y cuántas armas trae. Vueltas (PASOS, separadas por coma):
//   bien   cerrar la pestaña y volver a abrir;
//   golpe  matar el proceso del navegador en un momento en que la página está ocupada montando los mods al arrancar;
//   lua    el juego se cierra mal mientras corre el Lua de un pack (el proceso muerto con la caja negra diciendo
//          «corriendo el Lua del mod …», como cuando el sistema cierra la app por memoria en pleno arranque);
//   blob   con el juego cerrado se pierde el archivo guardado del .gma más grande (el navegador lo borró o quedó a medias);
//   recargar  «Volver a cargarlo» en la página del pack que quedó sin cargar.
// Casos:
//   1. al instalar, cada tarjeta dice lo que es (la TFA Base, «Base»; ninguna «Script»);
//   ·  después de cada vuelta, todos siguen instalados y montados, con el tipo de la primera vez, y con sus armas salvo el
//      que quedó sin cargar a propósito (dos cierres seguidos en su Lua), que igual dice «Armas … sin cargar»;
//   ·  mientras arranca (antes de que corra su Lua) la tarjeta ya dice lo que es;
//   ·  sin errores de JS.
// uso: node mods_reabrir.mjs URL_HTML URL_GMA PERFIL [compu|celu] [ids separados por coma] [cupoMB]
//   URL_GMA: carpeta servida con <id>/<id>.gma; PERFIL: carpeta nueva para el perfil del navegador (se borra al empezar)
//   celu: pantalla de celular, 2 GB de memoria, procesador ×4 más lento y, con cupoMB, poco lugar para guardar
//   ANTES=1: sólo informa (no falla) — para medir la versión vieja
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import fs from 'fs';
import { execSync } from 'child_process';
const [, , HTML, GMA, PERFIL, MODO = 'compu', LISTA, CUPO] = process.argv;
const CELU = MODO === 'celu';
// (la TFA Base tiene número de Workshop más alto que el pack que la usa: así el orden de la lista no es el de instalación)
const IDS = (LISTA || '123277559,673698301,116592647,417856423,1076729422,128089118').split(',');
const REQ = { 1076729422: ['2840031720'] };
const TODOS = [...new Set([...IDS, ...IDS.flatMap((i) => REQ[i] || [])])];
const PACK = IDS.includes('1076729422') ? '1076729422' : IDS[IDS.length - 1];   // (el que se cierra mal corriendo su Lua)
const PASOS = (process.env.PASOS || 'bien,golpe,lua,lua2,recargar,blob,bien').split(',');
fs.rmSync(PERFIL, { recursive: true, force: true }); fs.mkdirSync(PERFIL, { recursive: true });
const origen = new URL(HTML).origin;
const caso = (n, ok, info) => { console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + (info !== undefined ? ' · ' + JSON.stringify(info).slice(0, 900) : '')); return ok; };
const errJS = [];
let ctx = null, p = null, bajadas = 0, colgando = 0;
async function abrir(q) {
  ctx = await chromium.launchPersistentContext(PERFIL, {
    executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'],
    ...(CELU ? { viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } }),
  });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  await ctx.route('**/api/gmod/**', async (r) => {
    const u = r.request().url(), m = /gmod\/(\w+)\/?(\d*)/.exec(u) || [];
    if (/detalles\?ids=0/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"items":[]}' });
    if (m[1] === 'requiere') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ids: REQ[m[2]] || [] }) });
    return r.fulfill({ status: 404, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' });
  });
  // (lo que la tienda daría como archivo directo sale de la carpeta local: por la red de la página, no por el canal de
  // las pruebas —un .gma de 134 MB no entra—; se cuentan las bajadas)
  await ctx.exposeBinding('__bajada', () => { bajadas++; });
  await ctx.exposeBinding('__colgando', () => { colgando = Date.now(); });
  await ctx.addInitScript((a) => { const f0 = window.fetch; window.fetch = function (u, o) { const m = /\/api\/gmod\/archivo\/(\d+)/.exec(String((u && u.url) || u)); if (m && a.ids.includes(m[1])) { try { window.__bajada(); } catch (e) {} return f0.call(this, a.gma + '/' + m[1] + '/' + m[1] + '.gma', o); } return f0.apply(this, arguments); }; }, { ids: TODOS, gma: GMA });
  if (CELU) await ctx.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 2, configurable: true }); } catch (e) {} });
  p = ctx.pages()[0] || (await ctx.newPage());
  p.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
  const cdp = await ctx.newCDPSession(p);
  if (CUPO) await cdp.send('Storage.overrideQuotaForOrigin', { origin: origen, quotaSize: +CUPO * 1048576 });
  if (CELU) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });   // (un procesador de celular)
  await p.goto(HTML + (q || ''));
  await p.waitForFunction(() => window.__listo, null, { timeout: 300000 });
}
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
const esperar = async (cond, ms, cada) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await ev(cond)) return Date.now() - t0; } catch (e) {} await p.waitForTimeout(cada || 500); } return -1; };
// (todo montado y con su Lua corrido —o sin cargar a propósito—, sin nada en la cola)
const LISTO = `!GMOD.arrancando && !(typeof GMC !== 'undefined' && GMC.l.some((x) => x.estado === 'espera' || x.estado === 'bajando')) && Object.keys(PREFS.gmod || {}).every((id) => { const A = GMOD.addons.get(id); return A && (A.luaCorridos !== undefined || A.trabado || !A.lua.length); })`;
const ESTADO = `(() => { const o = {}; for (const id of ${JSON.stringify(TODOS)}) { const A = GMOD.addons.get(id), P = PREFS.gmod && PREFS.gmod[id], t = A && typeof gmbTipo === 'function' ? gmbTipo(A) : null;
  o[id] = { inst: !!P, mont: !!A, tipo: t ? t.k : null, n: t ? t.n : 0, est: (t && t.estado) || '', txt: t ? gmbTipoTxt(t) : '', armas: A ? (A.sweps || []).length : 0, sinCargar: !!(A && A.trabado), errLua: A ? (A.luaErr || []).length : 0, sinGuardar: !!(P && P.sinGuardar) }; }
  return { addons: o, aviso: [...document.querySelectorAll('#cnVen p')].map((x) => x.textContent).filter((x) => !/Copialo/.test(x)).join(' | '), cierre: CIERRE.nuevo, pasoAnt: (CN_ANT && CN_ANT.paso) || '', seguro: CN.l.filter((x) => / seguro /.test(x)).map((x) => x.slice(9)), sosp: localStorage.getItem('rb_gm_sospechas'), rebajados: GMOD.errores.filter((x) => /se vuelve a bajar|arranque/.test(x)) }; })()`;
const entrar = async () => { await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; guardarPrefs(); GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await p.waitForTimeout(1500); };
const cerrarBien = async () => { try { await p.close({ runBeforeUnload: true }); } catch (e) {} try { await ctx.close(); } catch (e) {} };
// (de golpe: el proceso del navegador muerto, sin pagehide ni nada; como la app cerrada por el sistema)
const matar = async () => { try { execSync(`pkill -9 -f -- '--user-data-dir=${PERFIL}'`); } catch (e) {} try { await ctx.close(); } catch (e) {} await new Promise((r) => setTimeout(r, 1500)); for (const f of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) fs.rmSync(PERFIL + '/' + f, { force: true }); };
const corto = (x) => `${x.inst ? '' : 'NO-INSTALADO '}${x.mont ? '' : 'NO-MONTADO '}${x.tipo}${x.n ? ':' + x.n : ''}${x.est ? ' (' + x.est + ')' : ''}${x.armas ? ' armas ' + x.armas : ''}${x.errLua ? ' err' + x.errLua : ''}${x.sinGuardar ? ' SIN-GUARDAR' : ''}`;
const resumen = (e) => Object.fromEntries(Object.entries(e.addons).map(([id, x]) => [id, corto(x)]));
let bien = 0, tot = 0; const vueltas = [];
// 0) instalar por la cola, como desde la tienda
await abrir(''); await entrar();
const t0 = Date.now();
await ev(`(() => { for (const id of ${JSON.stringify(IDS)}) gmcPoner(id, { nombre: 'mod ' + id }); return 1; })()`);
const ti = await esperar(LISTO, 1200000);
const e0 = await ev(ESTADO);
console.log('instalados en', Math.round((Date.now() - t0) / 1000), 's', ti < 0 ? '(NO TERMINÓ)' : '', JSON.stringify(resumen(e0)));
if (CUPO) { const g = Object.entries(e0.addons).filter(([, x]) => x.sinGuardar).map(([id]) => id); console.log('sin lugar para guardar:', g.length ? g.join(', ') : 'ninguno'); }
const esperado = (id) => (id === '2840031720' ? 'base' : 'armas');
tot++; if (caso('1. al instalar, cada tarjeta dice lo que es (TFA Base: «Base»; las demás, armas; ninguna «Script»)', TODOS.every((id) => e0.addons[id].tipo === esperado(id)), resumen(e0))) bien++;
await p.waitForTimeout(2500);
let trabadas = 0, enCuarentena = false;   // (cierres seguidos en el Lua del pack; si quedó sin cargar, hasta «recargar»)
for (let i = 0; i < PASOS.length; i++) {
  const paso = PASOS[i]; let info = '';
  if (paso === 'recargar') {
    await ev(`(() => { gmbAbrir('${PACK}'); gmbAccion('cargar:${PACK}'); return 1; })()`); await p.waitForTimeout(3000);
  } else {
    await cerrarBien();
    if (paso === 'blob') {
      // (el archivo del .gma más grande guardado por el navegador se pierde)
      const base = PERFIL + '/Default/IndexedDB', dir = fs.existsSync(base) ? fs.readdirSync(base).find((d) => /\.blob$/.test(d)) : null, L = [];
      const rec = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const r = d + '/' + f.name; if (f.isDirectory()) rec(r); else L.push([r, fs.statSync(r).size]); } };
      if (dir) rec(base + '/' + dir);
      L.sort((a, b) => b[1] - a[1]); if (L[0]) { fs.rmSync(L[0][0]); info = 'se perdió un archivo de ' + Math.round(L[0][1] / 1048576) + ' MB'; } else info = 'no había archivos guardados aparte';
    }
    bajadas = 0;
    await abrir('');
    if (paso === 'golpe') {
      // (se mata cuando la página está ocupada —más de 250 ms sin contestar— después de empezar a montar los instalados)
      await esperar(`CN.l.some((x) => / paso montando el mod /.test(x))`, 90000, 100);
      let ocupado = false; const tA = Date.now();
      while (Date.now() - tA < 60000 && !ocupado) {
        const r = await Promise.race([ev(`1`).then(() => 'libre', () => 'libre'), new Promise((ok) => setTimeout(() => ok('ocupado'), 250))]);
        if (r === 'ocupado') ocupado = true; else await new Promise((ok) => setTimeout(ok, 30));
      }
      info = 'muerto ' + (ocupado ? 'con la página ocupada a los ' + ((Date.now() - tA) / 1000).toFixed(1) + ' s' : 'sin verla ocupada');
      await matar(); bajadas = 0; await abrir('');
    } else if (paso === 'lua' || paso === 'lua2') {
      // (el pack se queda corriendo su Lua —la caja negra lo dice— y el juego muere ahí: lo que pasa en un celular sin
      // memoria. La página queda ocupada, como un Lua que no termina, y a los 68 s se mata el proceso: el navegador guarda
      // el localStorage en el disco a lo sumo una vez por minuto —medido: lo escrito 5 s antes de matarlo se pierde—.
      // lua2: dos veces seguidas, sin que el Lua del pack llegue a terminar entre medio)
      trabadas = 0;
      for (let k = 0; k < (paso === 'lua2' ? 2 : 1); k++) {
        await esperar(`GMOD.addons.has('${PACK}')`, 120000, 50);
        colgando = 0;
        const colgar = p.evaluate((pk) => window.__ev(`(() => { const A = GMOD.addons.get('${pk}'); if (A.luaCorridos !== undefined) return 'su Lua ya había corrido';
          CN.paso = 'corriendo el Lua del mod ' + A.nombre; CN.addon = A.id; cnGuardar(true); localStorage.setItem('rb_vivo', String(Date.now())); window.__colgando(); const t = Date.now(); while (Date.now() - t < 75000); return 'colgado'; })()`), PACK).catch(() => 'muerto');
        const r = await Promise.race([colgar, (async () => { const t = Date.now(); while (!colgando && Date.now() - t < 120000) await new Promise((ok) => setTimeout(ok, 50)); if (!colgando) return 'no llegó a colgarse'; await new Promise((ok) => setTimeout(ok, 68000)); return 'colgado'; })()]);
        if (r !== 'colgado') info += '(' + r + ') ';
        await matar(); bajadas = 0; await abrir(''); trabadas++;
      }
      info += trabadas + ' cierre(s) mal seguido(s) en el Lua de ' + PACK;
    }
    if (paso !== 'lua' && paso !== 'lua2') trabadas = 0;
    // (las tarjetas apenas se montan, antes de que corra su Lua)
    await entrar();
    await esperar(`${JSON.stringify(TODOS)}.every((id) => GMOD.addons.has(id))`, 300000, 100);
    vueltas.push(['temprano ' + paso, await ev(ESTADO)]);
  }
  const tl = await esperar(LISTO, 400000); await p.waitForTimeout(1500);
  if (/^lua/.test(paso) && trabadas >= 2) enCuarentena = true; if (paso === 'recargar') enCuarentena = false;
  const e = await ev(ESTADO); vueltas.push([paso, e, info, bajadas, trabadas, enCuarentena]);
  console.log(`vuelta ${i + 1} (${paso}${info ? ': ' + info : ''}):`, tl < 0 ? '(NO TERMINÓ DE MONTAR)' : '', JSON.stringify(resumen(e)), e.aviso ? 'AVISO: ' + e.aviso : '', bajadas ? 'BAJADOS DE NUEVO: ' + bajadas : '', e.cierre ? '[cerrado mal; último paso: «' + e.pasoAnt + '»]' : '', process.env.DEPURAR ? JSON.stringify({ seguro: e.seguro, sosp: e.sosp }) : '');
}
for (const [como, e, info, baj, trab, cuar] of vueltas) {
  if (/^temprano/.test(como)) {
    const mal = TODOS.filter((id) => e.addons[id].mont && e.addons[id].tipo !== e0.addons[id].tipo);
    tot++; if (caso(`· arrancando después de «${como.replace('temprano ', '')}»: las tarjetas ya dicen lo que es antes de que corra su Lua`, !mal.length, Object.fromEntries(mal.map((id) => [id, corto(e.addons[id]) + ' (después: ' + corto(e0.addons[id]) + ')'])))) bien++;
    continue;
  }
  const mal = [];
  for (const id of TODOS) {
    const a = e0.addons[id], b = e.addons[id], quieto = id === PACK && cuar;
    if (!b.inst || !b.mont || b.tipo !== a.tipo || (!quieto && (b.armas < a.armas || b.sinCargar)) || (quieto && b.est !== 'sinCargar')) mal.push(id + ': ' + corto(b) + ' (antes ' + corto(a) + ')');
  }
  const txt = { bien: 'cerrado bien', golpe: 'cerrado de golpe mientras monta', lua: 'cerrado mal en el Lua del pack, 1 vez: se vuelve a probar', lua2: 'cerrado mal en el Lua del pack, 2 veces seguidas: queda sin cargar, con su tipo', blob: 'se perdió lo guardado del más grande: se vuelve a bajar solo', recargar: '«Volver a cargarlo»' }[como] || como;
  tot++; if (caso(`· al volver a abrir (${txt}) los ${TODOS.length} siguen instalados, montados, con su tipo y sus armas`, !mal.length, mal.length ? mal : (info || '') + (baj ? ' · bajados de nuevo: ' + baj : ''))) bien++;
}
const err = errJS.filter((e) => !/WebSocket|net::|Failed to load|mqtt|aborted a request/i.test(e));
tot++; if (caso('· sin errores de JS', !err.length, err.slice(0, 5))) bien++;
console.log('RESUMEN ' + bien + '/' + tot);
await cerrarBien();
fs.rmSync(PERFIL, { recursive: true, force: true });
process.exit(bien === tot || process.env.ANTES ? 0 : 1);
