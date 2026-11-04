// lo que se baja de la tienda de GMod se abre al toque desde su ficha: un mapa con «Jugar» (entra a ese mapa), un pack de
// armas con «Probar» (arranca una partida y abre el panel GMod en ese addon) y un personaje con «Ponérmelo».
// uso: node gmod_abrir.mjs URL_HTML URL_CARPETA_GMA [MAPA=1751661372] [ARMAS=128089118] [PJ=158326196]
import { abrir } from './base.mjs';
const [, , HTML, CARP, MAPA = '1751661372', ARMAS = '128089118', PJ = '158326196'] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML, true);
await ev(`PREFS.bienvenida = true; inicioPanel(null); 1`); await p.waitForTimeout(500);
for (const id of [MAPA, ARMAS, PJ]) await ev(`(async () => { const A = await gmInstalar('${id}', { nombre: 'addon ${id}', sinDeps: true }, new Uint8Array(await (await fetch('${CARP}/${id}.gma')).arrayBuffer())); await A.listo; return 1; })()`);
// (la tienda → GMod → Instalados → la ficha del addon)
const ficha = async (id) => { await ev(`(async () => { RB.t.tab = 'gmod'; RB.t.vista = 'instalados'; RB.t.ficha = null; inicioMostrar(true); inicioPanel('tienda'); return 1; })()`); await p.waitForTimeout(1500);
  await ev(`(() => { const it = RB.t.items.find((x) => String(x.id) === '${id}'); if (!it) RB.t.items.push({ id: '${id}', t: 'addon ${id}' }); RB.t.ficha = '${id}'; gmTiendaDibujar(); return 1; })()`); await p.waitForTimeout(300);
  return ev(`[...document.querySelectorAll('.rbFichaAcc [data-rb]')].map((x) => x.dataset.rb.split(':')[0])`); };
const fm = await ficha(MAPA);
ok('la ficha de un mapa instalado tiene «Jugar»', fm.includes('jugarGm'), fm);
await p.screenshot({ path: 'abrir_ficha_mapa.png' });
await ev(`(() => { document.querySelector('.rbFichaAcc [data-rb^="jugarGm:"]').click(); return 1; })()`);
const enMapa = await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && /^WS_/.test(MUNDO.nombre) && !document.getElementById('rbCarga')?.offsetParent`), null, { timeout: 120000 }).then(() => true, () => false);
ok('«Jugar» entra directo a ese mapa', enMapa, await ev(`({ estado: JUEGO.estado, mapa: MUNDO.nombre })`));
await ev(`irMenuPrincipal(); 1`); await p.waitForTimeout(800);
const fa = await ficha(ARMAS);
ok('la ficha de un pack de armas tiene «Probar»', fa.includes('probarGm'), fa);
await ev(`(() => { document.querySelector('.rbFichaAcc [data-rb^="probarGm:"]').click(); return 1; })()`);
const panel = await p.waitForFunction((id) => window.__ev(`JUEGO.estado === 'juego' && typeof GMB !== 'undefined' && GMB.abierto && GMB.sel === '${id}'`), ARMAS, { timeout: 120000 }).then(() => true, () => false);
ok('«Probar» arranca una partida y abre el panel GMod en ese addon', panel, await ev(`({ estado: JUEGO.estado, abierto: typeof GMB !== 'undefined' && !!GMB.abierto, sel: typeof GMB !== 'undefined' ? GMB.sel : null })`));
await p.screenshot({ path: 'abrir_probar.png' });
await ev(`if (typeof gmbCerrar === 'function') gmbCerrar(); irMenuPrincipal(); 1`); await p.waitForTimeout(800);
const fp = await ficha(PJ);
ok('la ficha de un personaje tiene «Ponérmelo»', fp.includes('pmGm'), fp);
await ev(`(() => { document.querySelector('.rbFichaAcc [data-rb^="pmGm:"]').click(); return 1; })()`); await p.waitForTimeout(400);
const skin = await ev(`PREFS.skin`);
ok('«Ponérmelo» te lo pone de personaje', /^gmpm:.*mark7/.test(skin), skin);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x)); ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
