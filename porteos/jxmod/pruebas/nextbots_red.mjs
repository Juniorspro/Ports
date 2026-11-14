// Nextbots de GMod en multijugador (Discord, Gumball: «no se mueven», «no matan», «te ignoran»). Ana y Beto en el server
// oficial de FlatGrass, sin PvP. Ana pone nextbots de sus addons; Beto:
//  A. sin el addon (se baja de visita, sólo sus archivos): ve el Walter (una imagen), el SCP-049 (3D, animado) y Doro (de
//     DrGBase) de Ana sobre el camino que hacen en el juego de Ana (≥ 90 % de las muestras a ≤ 1 m de su camino del
//     último segundo) con ≤ 0,75 s de atraso —se dibuja entre dos muestras, como a los jugadores— si los dos van a 10
//     cuadros por segundo o más (con menos, cada cuadro lo corre más de un metro y sólo se informa), y moviéndose
//     (recorre ≥ 80 % de lo que recorre en el de Ana hasta lo último que llegó a ver); en su pantalla se ven;
//  B. el nextbot de Ana lo persigue y lo mata aunque Ana esté lejos (≥ 25 m) y sin PvP: a Beto le baja la vida hasta 0;
//  C. con el addon instalado, Beto ve el de Ana con el Lua del addon (la imagen de su DrawTranslucent) y también lo mata;
//  D. lo de Ana no se mete en el mundo de Beto: ninguna copia quieta del modelo (la de antes, cada 8 s, en la pose de
//     referencia) y en el de Ana sus nextbots no se le van a Beto como «props»;
//  E. sin errores de Lua ni de JS (también con el guante del infinito de Ana, que mira a los jugadores que reciben daño).
// uso: BROKER_DIR=carpeta-con-mc/broker node nextbots_red.mjs URL_HTML [URL_CARPETA_GMA] [CARPETA_FOTOS]
import { createRequire } from 'module'; import http from 'http'; import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad', req = createRequire(S + '/mc/broker/package.json');
const [, , HTML, G = new URL('/gma', process.argv[2]).href, D = '/tmp/claude-0/nextbots_red'] = process.argv;
fs.mkdirSync(D, { recursive: true });
const PUERTO = +(process.env.PUERTO || 18974);
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(PUERTO, '127.0.0.1', r));
const navs = [], errs = [];
const abrir = async (n) => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] }); navs.push(b);
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  // (sin los addons que la gente votó en el server oficial de verdad: sólo lo de la prueba)
  await ctx.route('**/api/gmod/sala/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"l":[]}' }));
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|mqtt|Failed to load|ERR_|favicon|404|409/i.test(m.text())) errs.push(n + ': ' + m.text().slice(0, 160)); });
  await p.goto(HTML + (HTML.includes('?') ? '&' : '?') + 'test&broker=ws://127.0.0.1:' + PUERTO + '/mqtt'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); return p;
};
const ev = (P, s) => P.evaluate((x) => window.__ev(x), s), J = async (P, s) => JSON.parse(await ev(P, `JSON.stringify(${s})`));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const hasta = async (P, cond, seg) => { for (let i = 0; i < seg * 4; i++) { if (await J(P, cond)) return true; await espera(250); } return false; };
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const entrar = (P, n) => ev(P, `PREFS.nombre='${n}'; PREFS.lang='es'; PREFS.bienvenida=true; PREFS.tutVisto=true; PREFS.gfx='patata'; GFX.auto=false; aplicarGfx(); audioIniciar(); inicioMostrar(false); conectarMultijugador(); entrarSala(SALAS_OF.find((s) => s.m === 'FlatGrass')); try { cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); } catch (e) {} 1`);
// (los .gma salen de la carpeta de prueba, no de Steam: también los que se bajan de visita)
const gmaLocal = (P) => ev(P, `(() => { window.__gmBajar0 = gmBajar; gmBajar = async (w) => { const r = await fetch(${JSON.stringify(G)} + '/' + w + '.gma'); if (!r.ok) throw new Error('no ' + w); return new Uint8Array(await r.arrayBuffer()); }; gmCatalogo = async () => ({ porId: new Map([['1635295969', { id: '1635295969', t: 'Walter', mb: 2.4 }], ['779759026', { id: '779759026', t: 'SCP-049', mb: 17 }], ['3505279804', { id: '3505279804', t: 'Doro', mb: 9.2 }]]) }); return 1; })()`);
const instalar = (P, id) => ev(P, `(async () => { const u = new Uint8Array(await (await fetch(${JSON.stringify(G)} + '/${id}.gma')).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, u); await A.listo; return [...((A.listas && A.listas.NPC) || new Map()).keys()]; })()`);
const A = await abrir('Ana'); await entrar(A, 'Ana');
const B = await abrir('Beto'); await entrar(B, 'Beto');
ok('los dos en FlatGrass y se ven', await hasta(A, `MUNDO.nombre === 'FlatGrass' && RED.remotos.size === 1 && JUG.suelo`, 60) && await hasta(B, `MUNDO.nombre === 'FlatGrass' && RED.remotos.size === 1 && JUG.suelo`, 60));
await gmaLocal(A); await gmaLocal(B);
for (const P of [A, B]) await ev(P, `SALA.pvp = 0; 1`);   // (sin PvP: el golpe de un nextbot igual llega)
ok('Ana instala Walter (imagen) y el SCP-049 (3D)', (await instalar(A, '1635295969')).includes('npc_walter') && (await instalar(A, '779759026')).includes('npc_scp_049'));
// (y un addon que mira a los jugadores cuando reciben daño —el guante del infinito, votado en el server oficial de verdad—:
// con Beto como jugador de Lua para los nextbots de Ana, su EntityTakeDamage no tiene que fallar)
await instalar(A, '1382102057');
// (Ana lejos, a un costado; Beto quieto a 20 m de donde aparece el nextbot, lejos de los puntos de aparición)
const PISO = await J(A, `(() => { const h = mundoRayo(v3(30, 60, 0), v3(0, -1, 0), 200); return 60 - h.t; })()`);
await ev(A, `JUG.pos.set(60, ${PISO} + JUG.medio + 0.05, -30); JUG.vel.set(0, 0, 0); 1`);
// (si un nextbot recién lo mató, primero que reaparezca solo —si no, reaparecía después en el punto de aparición, donde
// los de la base de Sanic no persiguen, como en GMod—)
const ponerBeto = async () => { await hasta(B, `JUG.vivo && JUG.vida > 0`, 20); await espera(500); return ev(B, `(() => { JUG.vida = 100; JUG.pos.set(30, ${PISO} + JUG.medio + 0.05, -25); JUG.vel.set(0, 0, 0); JUG.yaw = 0; JUG.pitch = 0.05; return 1; })()`); };
await ponerBeto(); await espera(2500);
const fotoBeto = async (n) => { const b = await B.screenshot(); fs.writeFileSync(D + '/' + n + '.png', b); return b; };
// píxeles que cambian entre dos fotos de Beto
const difPx = async (a, b) => ev(B, `(async () => { const c = async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const k = document.createElement('canvas'); k.width = i.width; k.height = i.height; const x = k.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
  const a = await c(${JSON.stringify(a.toString('base64'))}), b = await c(${JSON.stringify(b.toString('base64'))}); let n = 0; for (let k = 0; k < a.length; k += 4) if (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]) > 60) n++; return n; })()`);
// un nextbot de Ana a 20 m de Beto, mirándolo (los de DrGBase sólo ven lo que tienen adelante), quieto un momento
// (ai_disabled) para la foto y después suelto
async function probar(cls, nombre, conAddon) {
  // (Ana viva y lejos —un nextbot de antes la pudo haber matado: reaparece en el punto de aparición—)
  await ponerBeto(); await ev(A, `(() => { for (const e of [...GMA.ents.values()]) if (e.nb) gmaQuitar(e); return 1; })()`); await hasta(A, `JUG.vivo`, 15);
  await ev(A, `(() => { JUG.vida = 100; JUG.pos.set(60, ${PISO} + JUG.medio + 0.05, -30); JUG.vel.set(0, 0, 0); return 1; })()`); await espera(1200);
  const f0 = await fotoBeto(nombre + '_antes');
  const id = await J(A, `(() => { gmaCvar('ai_disabled', '0'); gmaCvarPoner('ai_disabled', '1'); const d = vS(v3(0, 0, -20)), yaw = Math.atan2(d.y, d.x) * 180 / Math.PI; const e = gmLlamar(GMA.R.G.get('__gmCrearNPC'), 'S', '${cls}', GMA.V(v3(30, ${PISO}, -5)), undefined, yaw)[0]; return e ? e.id : null; })()`);
  ok(`${nombre}: Ana lo pone`, !!id);
  const vio = await hasta(B, `[...GMA.ents.values()].some((e) => e.nbRem && e.nbRem.clase === '${cls}' && e.vivo && (e.o ? !!gmnbDef(e) : ${conAddon} || !!(e.nbRem.spr && gmaMaterial(e.nbRem.spr[0]).ok)))`, 25);   // (la imagen, cuando llegó su textura)
  await espera(1500);
  const f1 = await fotoBeto(nombre + '_quieto'), px = await difPx(f0, f1);
  ok(`${nombre}: Beto lo ve aparecer (${conAddon ? 'con' : 'sin'} el addon)`, vio && px > 300, { vio, px });
  // suelto: lo persigue
  await ev(A, `gmaCvarPoner('ai_disabled', '0'); 1`);
  // (cada página anota cada 50 ms, con la hora de la máquina: el de Ana en su juego y lo que ve Beto)
  const reloj = 'performance.timeOrigin + performance.now()';
  await ev(A, `(() => { const M = (window.__nbA = []); clearInterval(window.__nbAI); window.__nbAI = setInterval(() => { const e = GMA.ents.get(${id}); if (e && e.vivo) { const p = gmaEntPos(e); M.push([${reloj}, p.x, p.z]); } }, 50); return 1; })()`);
  await ev(B, `(() => { const M = (window.__nbB = []); clearInterval(window.__nbBI); window.__nbBI = setInterval(() => { const e = [...GMA.ents.values()].find((x) => x.nbRem && x.nbRem.clase === '${cls}' && x.vivo), s = e && e.nbSec; M.push([${reloj}, e ? gmaEntPos(e).x : null, e ? gmaEntPos(e).z : null, s ? s.i : -1, s ? s.t : 0, JUG.vida, JUG.vivo ? 1 : 0]); }, 50); return 1; })()`);
  // (hasta 40 s del juego de Ana —con la máquina cargada su juego va más lento que el reloj—, 3 minutos como mucho)
  const t0 = Date.now(), tA0 = await J(A, 'TIEMPO.t'); let murio = false, fotoC = false, n = 0;
  while (Date.now() - t0 < 180000 && (n++ % 8 || (await J(A, 'TIEMPO.t')) - tA0 < 40)) {
    const b = await J(B, `(() => ({ vida: JUG.vida, vivo: JUG.vivo }))()`);
    if (!fotoC && Date.now() - t0 > 1500) { fotoC = true; await fotoBeto(nombre + '_corre'); }
    if (!b.vivo || b.vida <= 0) { murio = true; break; }
    await espera(250);
  }
  const MA = await J(A, `(() => { clearInterval(window.__nbAI); return window.__nbA; })()`), MB = await J(B, `(() => { clearInterval(window.__nbBI); return window.__nbB; })()`);
  // (dónde lo tenía Ana en un momento: entre las dos muestras de ese momento)
  const enA = (t) => { for (let i = 1; i < MA.length; i++) if (MA[i][0] >= t) { const a = MA[i - 1], b = MA[i], f = Math.max(0, Math.min(1, (t - a[0]) / Math.max(1, b[0] - a[0]))); return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; } return null; };
  const vB = MB.filter((m) => m[1] !== null && m[0] >= MA[0][0] + 600 && m[0] <= MA[MA.length - 1][0]);
  // (lo que se ve: cada posición de Beto contra el camino que hizo en el juego de Ana en el último segundo —¿está sobre su
  // camino o anda por otro lado, saltando o quieto?—, y el atraso que mejor explica lo que ve, que se informa)
  const camino = (t) => MA.filter((a) => a[0] >= t - 1000 && a[0] <= t);
  const aCamino = (m) => { const C = camino(m[0]); let best = Infinity; for (let i = 1; i < C.length; i++) { const a = C[i - 1], b = C[i], dx = b[1] - a[1], dz = b[2] - a[2], L2 = dx * dx + dz * dz, f = L2 > 1e-9 ? Math.max(0, Math.min(1, ((m[1] - a[1]) * dx + (m[2] - a[2]) * dz) / L2)) : 0; best = Math.min(best, Math.hypot(a[1] + dx * f - m[1], a[2] + dz * f - m[2])); } return best; };
  const d = vB.map((m) => aCamino(m)).filter((x) => Number.isFinite(x)), cerca = d.filter((x) => x <= 1).length / Math.max(1, d.length);
  let mejor = null;
  for (let L = 0; L <= 1500; L += 25) { const e = []; for (const m of vB) { const q = enA(m[0] - L); if (q) e.push(Math.hypot(q[0] - m[1], q[1] - m[2])); } if (!e.length) continue; const med = e.reduce((x, y) => x + y, 0) / e.length; if (!mejor || med < mejor.med) mejor = { L, med }; }
  // (lo que recorre en el juego de Ana hasta lo último que Beto llegó a ver, con ese atraso)
  const reco = (L, i1, i2) => { let s = 0; for (let i = 1; i < L.length; i++) if (L[i][i1] !== null && L[i - 1][i1] !== null) s += Math.hypot(L[i][i1] - L[i - 1][i1], L[i][i2] - L[i - 1][i2]); return s; };
  const tFinB = vB.length ? vB[vB.length - 1][0] - (mejor ? mejor.L : 0) : Infinity;
  const ra = reco(MA.filter((a) => a[0] <= tFinB), 1, 2), rb = reco(MB, 1, 2);
  const fps = { Ana: Math.round(await J(A, 'TIEMPO.fps || 0')), Beto: Math.round(await J(B, 'TIEMPO.fps || 0')) };
  ok(`${nombre}: Beto lo ve sobre el camino que hace en el juego de Ana (≤ 1 m) y moviéndose`, (Math.min(fps.Ana, fps.Beto) < 10 || (cerca >= 0.9 && mejor && mejor.L <= 750)) && ra > 3 && rb >= 0.8 * ra, { fps, muestras: d.length, atrasoMs: mejor && mejor.L, cerca: +cerca.toFixed(2), difMed: +(d.reduce((x, y) => x + y, 0) / Math.max(1, d.length)).toFixed(2), difMax: +Math.max(0, ...d).toFixed(2), recorreAna: +ra.toFixed(1), recorreBeto: +rb.toFixed(1) });
  const M = MB.map((m) => ({ sec: m[3], st: m[4] })), anim = new Set(M.map((m) => m.sec)).size, avanza = M.some((m, i) => i && m.st !== M[i - 1].st);
  const vidaMin = Math.min(100, ...MB.map((m) => m[5]));
  if (cls === 'npc_scp_049') ok(`${nombre}: Beto lo ve animado (la secuencia avanza)`, avanza && M.some((m) => m.sec >= 0), { secuencias: anim, avanza });
  ok(`${nombre}: persigue a Beto y lo mata (sin PvP, con Ana a 25 m)`, murio, { vidaMin, seg: +((Date.now() - t0) / 1000).toFixed(1), segJuegoAna: +((await J(A, 'TIEMPO.t')) - tA0).toFixed(1) });
  await hasta(B, `JUG.vivo`, 15);
}
await probar('npc_walter', 'walter_sin_addon', false);
await probar('npc_scp_049', 'scp049_sin_addon', false);
// (uno de DrGBase: Doro, que ve con sus ojos y elige a quién odiar con sus relaciones)
ok('Ana instala DrGBase y Doro', (await instalar(A, '1560118657')).length > 0 && (await instalar(A, '3505279804')).includes('doroxd'));
await probar('doroxd', 'doro_sin_addon', false);
// D. ninguna copia quieta en el mundo de Beto y nada de Ana como prop en el de Ana
const copias = await J(B, `[...RED.objs.values()].filter((o) => /scp_049|walter|doroxd/i.test(o.nombre || "")).length`);
ok('Beto no tiene copias quietas de los nextbots de Ana en su mundo', copias === 0, copias);
// C. Beto con el addon: el de Ana con el Lua del addon
ok('Beto instala Walter', (await instalar(B, '1635295969')).includes('npc_walter'));
await probar('npc_walter', 'walter_con_addon', true);
const conLua = await J(B, `(() => { const e = [...GMA.ents.values()].find((x) => x.nbRem && x.nbRem.clase === 'npc_walter'); return e ? e.clase : null; })()`);
ok('con el addon, Beto lo dibuja con el Lua del addon (su clase, no la imagen suelta)', conLua === 'npc_walter', conLua);
const lua = { A: await J(A, `GMA.errores.slice(-6)`), B: await J(B, `GMA.errores.slice(-6)`) };
ok('sin errores de Lua', !lua.A.length && !lua.B.length, lua);
ok('sin errores de JS', !errs.length, errs.slice(0, 6));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
for (const b of navs) await b.close(); srv.close(); process.exit(0);
