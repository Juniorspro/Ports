// multijugador con cosas del Workshop (ideas de Discord: «los demás no ven tu modelo custom» y «el server con mapa custom
// sale en Pasto plano»). Ana arma un server en un mapa del Workshop y se pone un modelo de jugador del Workshop; Beto no
// tiene ninguno de los dos addons.
//  1. Beto entra con la lista vieja (la tienda guardaba sólo los mapas del juego: le dice Pasto plano): al conectarse le
//     llega el mapa del anfitrión, lo baja y termina en el mismo mapa que Ana
//  2. Caro entra con la lista nueva (mapa del Workshop y su addon): va directo a ese mapa, sin pasar por Pasto plano
//  3. Beto y Caro ven a Ana con su modelo del Workshop (antes, con el Hero)
//  4. lo que bajaron es de visita: sin su Lua y sin sumarse a sus mods instalados
//  5. sin errores
// (Steam no se usa: el addon se toma de la carpeta y el catálogo es de prueba, con los mismos campos)
// uso: BROKER_DIR=carpeta-con-mc/broker node red_workshop.mjs JX.html URL_CARPETA_GMA [PM=656834283] [MAPA=1751661372] [CARPETA_FOTOS]
import { createRequire } from 'module'; import http from 'http';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad', req = createRequire(S + '/mc/broker/package.json');
const [, , html, G, PM = '656834283', MAPA = '1751661372', D = '/tmp/claude-0/redws'] = process.argv;
import fs from 'fs'; fs.mkdirSync(D, { recursive: true });
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8896, '127.0.0.1', r));
const errs = [], navs = [];
const abrir = async (n) => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'] });
  navs.push(b);
  const p = await (await b.newContext({ viewport: { width: 800, height: 450 } })).newPage();
  p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|mqtt|Failed to load|ERR_|CORS|net::/i.test(m.text())) errs.push(n + ': ' + m.text().slice(0, 160)); });
  await p.goto((/^https?:/.test(html) ? html : 'file://' + html) + '?test&broker=ws://127.0.0.1:8896/mqtt'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  // (Steam de prueba: los .gma de la carpeta y un catálogo con esos dos)
  await p.evaluate(([G, PM, MAPA]) => window.__ev(`(() => { gmBajar = async (wid) => new Uint8Array(await (await fetch('${G}/' + wid + '.gma')).arrayBuffer());
    const C = { L: [], porId: new Map([['${PM}', { id: '${PM}', t: 'Doge Playermodel', img: '', mb: 0.8, tags: ['Model'], d: '' }], ['${MAPA}', { id: '${MAPA}', t: 'TTT Backrooms', img: '', mb: 4, tags: ['map'], d: '' }]]) };
    gmCatalogo = () => Promise.resolve(C); cuentaPedir = () => true; cuentaFaltaPara = () => false; cuPedirAlAbrir.hecho = true; window.__mapas = []; const cm = cargarMapa; cargarMapa = (m, ...r) => { __mapas.push(m); return cm(m, ...r); }; return 1; })()`), [G, PM, MAPA]);
  return p;
};
const ev = (P, s) => P.evaluate((x) => window.__ev(x), s), J = async (P, s) => JSON.parse(await ev(P, `(async () => JSON.stringify(await (${s})))()`));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const hasta = async (P, cond, seg) => { for (let i = 0; i < seg * 2; i++) { if (await J(P, cond).catch(() => false)) return true; await espera(500); } return false; };
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const prep = (P, n) => ev(P, `PREFS.nombre='${n}'; PREFS.lang='es'; PREFS.bienvenida=true; PREFS.tutVisto=true; PREFS.gfx='patata'; GFX.auto=false; aplicarGfx(); audioIniciar(); 1`);
// Ana: instala los dos addons, se pone el modelo y arma el server en el mapa del Workshop
const A = await abrir('Ana'); await prep(A, 'Ana');
const ana = await J(A, `(async () => { for (const id of ['${PM}', '${MAPA}']) { const X = await gmInstalar(id, { nombre: id }, await gmBajar(id)); await X.listo; }
  const pm = gmpLista().find((r) => /doge_player\\.mdl$/.test(r)), mapa = [...GBSP.mapas.keys()].find((k) => GBSP.mapas.get(k).id === '${MAPA}');
  PREFS.skin = 'gmpm:' + pm; return { pm, mapa }; })()`);
await ev(A, `(() => { conectarMultijugador(); crearServidor({ n: 'Prueba WS', pw: '', m: '${ana.mapa}', mo: 'Free', pvp: 0, rpg: 1, nb: 0, mp: 1000, mv: 40 }); return 1; })()`);
const anaListo = await hasta(A, `MUNDO.nombre === '${ana.mapa}' && RED.on && JUEGO.estado === 'juego'`, 120);
const sala = await J(A, `(() => { const s = Object.assign({}, SALA); delete s.clave; return s; })()`);
console.log('Ana:', JSON.stringify({ ...ana, listo: anaListo, sala: { id: sala.id, m: sala.m, mw: sala.mw, du: sala.du } }));
// Beto: la lista vieja (Pasto plano, sin el addon del mapa)
const B = await abrir('Beto'); await prep(B, 'Beto');
await ev(B, `(() => { conectarMultijugador(); entrarSala(${JSON.stringify(Object.assign({}, sala, { m: 'FlatGrass', mw: '' }))}, ''); return 1; })()`);
const bMapa = await hasta(B, `MUNDO.nombre === '${ana.mapa}' && JUEGO.estado === 'juego' && RED.on`, 180);
ok('1. Beto entra con la lista vieja (Pasto plano) y termina en el mapa del Workshop de Ana', bMapa, await J(B, `({ mapa: MUNDO.nombre, pasó: __mapas })`));
// Caro: la lista nueva
const C = await abrir('Caro'); await prep(C, 'Caro');
await ev(C, `(() => { conectarMultijugador(); entrarSala(${JSON.stringify(sala)}, ''); return 1; })()`);
const cMapa = await hasta(C, `MUNDO.nombre === '${ana.mapa}' && JUEGO.estado === 'juego' && RED.on`, 180);
const cPaso = await J(C, `__mapas`);
ok('2. Caro entra con la lista nueva y va directo al mapa del Workshop (sin pasar por Pasto plano)', cMapa && cPaso.length >= 1 && cPaso.every((m) => m === ana.mapa), cPaso);
// los tres juntos, y Ana con su modelo
// (mirando hacia Ana: el modelo se arma cuando se dibuja)
const mirarAna = (P) => ev(P, `(() => { const r = [...RED.remotos.values()].find((x) => x.nombre === 'Ana' || (x.P && x.P.nombre === 'Ana')); if (r && r.P) { JUG.tercera = false; const d = vsub(r.P.pos, JUG.pos); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = 0.1; } return 1; })()`).catch(() => {});
const veAna = async (P) => { for (let i = 0; i < 6; i++) await mirarAna(P).then(() => espera(400)); return hastaVe(P); };
const hastaVe = (P) => hasta(P, `(() => { const r = [...RED.remotos.values()].find((x) => x.nombre === 'Ana' || (x.P && x.P.nombre === 'Ana')); return !!(r && r.skin === 'gmpm:${ana.pm}' && r.P && r.P.gmpRuta === '${ana.pm}' && r.P.gmp && r.P.gmp.def); })()`, 90);
const [bVe, cVe] = await Promise.all([veAna(B), veAna(C)]);
const rem = (P) => J(P, `[...RED.remotos.values()].map((r) => [r.nombre || (r.P && r.P.nombre), r.skin, r.skinReal, !!(r.P && r.P.gmp && r.P.gmp.def)])`);
ok('3. Beto y Caro ven a Ana con su modelo del Workshop (antes la veían con el Hero)', bVe && cVe, { beto: bVe, caro: cVe, remotosB: await rem(B), remotosC: await rem(C), visitasC: await J(C, `[...RED.visitas]`) });
const vis = await J(B, `(() => { const a = ['${PM}', '${MAPA}'].map((id) => { const X = GMOD.addons.get(id); return X ? { id, visita: X.visita, lua: X.lua.length } : { id, falta: true }; }); return { a, enMios: ['${PM}', '${MAPA}'].filter((id) => PREFS.gmod && PREFS.gmod[id]) }; })()`);
ok('4. lo que bajó Beto es de visita: sin su Lua y no aparece entre sus mods instalados', vis.a.every((x) => x.visita === true && x.lua === 0) && !vis.enMios.length, vis);
// una foto desde Beto mirando a Ana
await ev(B, `(() => { const r = [...RED.remotos.values()].find((x) => x.skin === 'gmpm:${ana.pm}'); if (r) { const d = vsub(r.P.pos, JUG.pos); JUG.pos.set(r.P.pos.x - 2.2, r.P.pos.y + 0.2, r.P.pos.z); JUG.yaw = Math.PI / 2; JUG.pitch = 0.15; } document.body.classList.add('ocultarHUD'); return 1; })()`).catch(() => {});
await ev(A, `(() => { JUG.vel.set(0, 0, 0); return 1; })()`).catch(() => {});
await espera(2500); await B.screenshot({ path: D + '/beto_ve_a_ana.png' });
ok('5. sin errores de JS', !errs.length, errs.slice(0, 5));
for (const b of navs) await b.close(); srv.close();
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
process.exit(0);
