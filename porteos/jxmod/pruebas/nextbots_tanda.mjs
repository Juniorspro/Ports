// Nextbots populares del Workshop, uno por uno, como los pone un jugador (Discord, Gumball: «Los nextbots ahora tienen más
// bugs: no se mueven si no son de DrGBase, no matan, y algunas veces tienen errores de modelos» y «o te ignoran»). Sirve
// para comparar armados (la 3.1, la 3.2 y la de ahora) en las mismas condiciones. Para cada uno:
//  - se pone desde el menú (spawnElegir 'gmnpc:CLASE') a 14 m adelante del jugador, en FlatGrass, lejos de los puntos de
//    aparición (la protección de aparición de la base de Sanic no cuenta);
//  - modelo: una foto antes y otra después de ponerlo, desde la cámara del jugador: cuántos píxeles cambian (0 = no se ve),
//    si su modelo cayó en la caja de reemplazo (el modelo no estaba) o en la pose de referencia (sin secuencia);
//  - persigue: la distancia mínima al jugador y en qué segundo llega a 2,5 m; te ignora: no se acerca ni 2 m en 12 s;
//  - velocidad real: la del cuerpo (lo que avanza cada 0,5 s) mientras está a más de 3 m, la mediana y el máximo, y la
//    que pide su Lua (DesiredSpeed);
//  - mata: con el daño de verdad, en qué segundo baja la vida y en cuál se muere el jugador (quieto, como en GMod);
//  - errores de Lua (GMA.errores) y de JS desde que se puso.
// Cada addon se instala solo (con sus dependencias) en una página nueva; los resultados van en JSON a la salida y a
// CARPETA/tanda.json, con las fotos (CARPETA/<id>.png: de cerca, al aparecer).
// uso: node nextbots_tanda.mjs URL_HTML [URL_CARPETA_GMA] [CARPETA]   (IDS=id,id… CPU=4: el procesador 4 veces más lento,
// como un celular; MAPA=FlatGrass; TODOS=1: todos los addons juntos en una sola página, como quien tiene muchos)
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, G = new URL('/gma', HTML).href, D = '/tmp/claude-0/nextbots_tanda'] = process.argv;
fs.mkdirSync(D, { recursive: true });
// [id del Workshop, grupo, dependencias, clase (si no, la primera de su lista de NPC)]
const LISTA = [
  ['174117071', 'sanic'], ['2803406998', 'sanic'], ['1635295969', 'sanic'], ['1639300664', 'sanic'], ['648137007', 'sanic'], ['1261582571', 'sanic'],
  ['2794401258', '2d'], ['2849603714', '2d'], ['2848740486', '2d'], ['2878840758', '2d'], ['2707765453', '2d'], ['2816110955', '2d'], ['2849614620', '2d'], ['2685280648', '2d'],
  ['367531149', '3d'], ['779759026', '3d'], ['802061240', '3d'], ['303783338', '3d'], ['2944078031', '3d'], ['2017592860', '3d'],
  ['1560118657', 'drg', [], 'npc_drg_zombie'], ['1997453273', 'drg', ['1560118657']], ['2501837429', 'drg', ['1560118657']], ['2000677049', 'drg', ['1560118657']], ['3505279804', 'drg', ['1560118657']],
  ['522764555', 'vj', ['131759821']],
];
const IDS = process.env.IDS ? process.env.IDS.split(',') : LISTA.map((x) => x[0]);
const CPU = +process.env.CPU || 1, MAPA = process.env.MAPA || 'FlatGrass', SEG = +process.env.SEG || 30;
const res = [];
const pagina = async () => {
  const P = await abrir(HTML + (HTML.includes('?') ? '&' : '?') + 'test', false);
  await P.p.setViewportSize({ width: 640, height: 360 });
  await P.ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; idiomaAplicar('es'); GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('${MAPA}'); try { cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); } catch (e) {} 1`);
  await P.p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
  await P.p.waitForTimeout(1500);
  if (CPU > 1) { const c = await P.p.context().newCDPSession(P.p); await c.send('Emulation.setCPUThrottlingRate', { rate: CPU }); }
  return P;
};
const instalar = (ev, id) => ev(`(async () => { if (GMOD.addons.has('${id}')) return { ya: 1 }; const u = new Uint8Array(await (await fetch(${JSON.stringify(G)} + '/${id}.gma')).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, u); await A.listo; await new Promise((r) => setTimeout(r, 500)); return { npcs: [...((A.listas && A.listas.NPC) || new Map()).keys()], err: (A.luaErr || []).slice(0, 3) }; })()`);
// un lugar lejos de los puntos de aparición, con piso
const LUGAR = `(() => { const S = MUNDO.spawns || []; for (const [x, z] of [[30, -20], [-30, -20], [30, 20], [-30, 20], [0, -40], [45, 0]]) { if (S.some((s) => Math.hypot(s.x - x, s.z - z) < 12 || Math.hypot(s.x - x, s.z - z - 14) < 12)) continue; const h = mundoRayo(v3(x, 60, z), v3(0, -1, 0), 200), h2 = mundoRayo(v3(x, 60, z + 14), v3(0, -1, 0), 200); if (h && h2 && Math.abs(h.t - h2.t) < 0.5) return [x, 60 - h.t, z]; } return null; })()`;
async function probar(P, id, grupo, cls) {
  const { p, ev, err } = P;
  const L = await ev(LUGAR); if (!L) return { id, cls, error: 'sin lugar' };
  const [X, Y, Z] = L;
  // (limpio, quieto, mirando a +z un poco para abajo: el rayo del menú pega en el piso a 14 m)
  await ev(`(() => { for (const e of [...GMA.ents.values()]) if (e.nb) gmaQuitar(e); npcTodos(); JUG.pos.set(${X}, ${Y} + JUG.medio + 0.02, ${Z}); JUG.vel.set(0, 0, 0); JUG.yaw = 0; JUG.vida = 100; JUG.vivo = true; JUG.noclip = false; return 1; })()`);
  await p.waitForTimeout(700);
  await ev(`(() => { const ojo = CAM.pos.y - ${Y}; JUG.pitch = Math.atan2(ojo, 14); return 1; })()`);
  await p.waitForTimeout(500);
  const foto0 = await p.screenshot();
  const n0 = await ev(`GMA.errores.length`), js0 = err.length;
  // (quieto mientras se saca la foto: su Lua y su locomoción esperan; se dibuja igual)
  await ev(`(() => { if (!window.__nbp0) { window.__nbp0 = gmnbPaso; gmnbPaso = (dt) => { if (!window.__nbQuieto) window.__nbp0(dt); }; } window.__nbQuieto = true; return 1; })()`);
  const puso = await ev(`(() => { const antes = new Set(GMA.ents.keys()), np = NPC.lista.length; spawnElegir('GMod', 'gmnpc:${cls}'); const e = [...GMA.ents.values()].find((x) => !antes.has(x.id) && x.nb); window.__nbP = e || null; window.__npcP = NPC.lista.length > np ? NPC.lista[NPC.lista.length - 1] : null; return e ? { nb: 1, clase: e.clase, modelo: e.modelo || '' } : window.__npcP ? { npc: 1 } : null; })()`);
  if (!puso) return { id, grupo, cls, error: 'no se puso' };
  // (la foto a los 1,5 s, con el nextbot todavía quieto —para ver si se ve y con qué—; después se suelta y en el mismo
  // momento el jugador se va 30 m para atrás: el nextbot tiene que correr ~44 m, y ahí se mide su velocidad. Las muestras
  // se toman en la página, cada 50 ms con el reloj del juego: no dependen de lo que tarda la prueba en preguntar)
  await p.waitForTimeout(1500);
  const foto1 = await p.screenshot(), fotoT = 1.5;
  await ev(`(() => { const e = window.__nbP, P = window.__npcP, M = (window.__nbM = []);
    const f = () => { let q = null, st = {}; if (e) { q = gmaEntPos(e); const L = e.loco ? e.loco.st : null; st = { v0: L ? +(L.vel0 * GS).toFixed(2) : null, sec: e.nbSec ? e.nbSec.i : -1, def: typeof gmnbDef === 'function' ? !!gmnbDef(e) : null, obj: e.o ? e.o.nombre : null, bv: !!e.vivo, falta: !!(e.modelo && GMA.modelosFaltan && GMA.modelosFaltan.has(String(e.modelo).startsWith('models/') ? e.modelo : 'models/' + e.modelo)) }; } else if (P) { q = P.pos; st = { bv: P.vida > 0 }; }
      M.push({ t: TIEMPO.t, j: [JUG.pos.x, JUG.pos.z], b: q ? [q.x, q.z] : null, vida: JUG.vida, vivo: JUG.vivo, ...st }); };
    JUG.pos.z -= 30; JUG.vel.set(0, 0, 0); window.__nbQuieto = false;
    f(); clearInterval(window.__nbI); window.__nbI = setInterval(f, 50); return 1; })()`);
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < SEG * Math.max(1, CPU)) {
    const f = await ev(`(() => { const M = window.__nbM, u = M[M.length - 1]; return { t: u.t - M[0].t, muerto: !u.vivo || u.vida <= 0 }; })()`);
    if (f.muerto || f.t > SEG) break;
    await p.waitForTimeout(400);
  }
  await p.waitForTimeout(200);
  const muestras = await ev(`(() => { clearInterval(window.__nbI); return window.__nbM; })()`);
  // análisis
  const t00 = muestras[0].t, dist = (s) => (s.b ? Math.hypot(s.b[0] - s.j[0], s.b[1] - s.j[1]) : null);
  const M2 = muestras;
  const ds = M2.map(dist).filter((x) => x !== null), d0 = ds[0], dmin = Math.min(...ds);
  const llega = M2.find((s) => dist(s) !== null && dist(s) < 2.5), tLlega = llega ? +(llega.t - M2[0].t).toFixed(1) : null;
  const vels = []; for (let i = 0, j = 0; i < M2.length; i++) { while (j < i && M2[i].t - M2[j].t > 0.5) j++; const a = M2[j], b = M2[i]; if (b.t - a.t < 0.4 || !a.b || !b.b || dist(a) < 3 || dist(b) < 3) continue; vels.push(Math.hypot(b.b[0] - a.b[0], b.b[1] - a.b[1]) / (b.t - a.t)); }
  vels.sort((a, b) => a - b); const med = vels.length ? vels[vels.length >> 1] : 0, mx = vels.length ? vels[vels.length - 1] : 0;
  const ultima = muestras[muestras.length - 1];
  const dano = muestras.find((s) => s.vida < 100 || !s.vivo), muerteS = muestras.find((s) => !s.vivo || s.vida <= 0);
  const primerDano = dano ? dano.t - t00 : null, muerte = muerteS ? muerteS.t - t00 : null;
  const i12 = M2.findIndex((s) => s.t - M2[0].t > 12), ignora = !llega && !muerte && d0 - Math.min(...ds.slice(0, i12 > 0 ? i12 : ds.length)) < 2;
  // (quieto: el tiempo más largo sin moverse 0,5 m mientras lo persigue, a más de 3 m)
  let quieto = 0; for (let i = 0, j = 0; i < M2.length; i++) { const a = M2[j], b = M2[i]; if (!a.b || !b.b || dist(b) < 3 || dist(a) < 3) { j = i; continue; } if (Math.hypot(b.b[0] - a.b[0], b.b[1] - a.b[1]) > 0.5) j = i; else quieto = Math.max(quieto, b.t - a.t); }
  const luaErr = await ev(`GMA.errores.slice(${n0})`), jsErr = err.slice(js0).filter((x) => !/favicon|ERR_|net::|404|409|WebSocket|mqtt|wss:|GPU stall|swiftshader|WebGL/i.test(x));
  // los píxeles que cambiaron entre las dos fotos (con su recorte, para la hoja)
  let px = null;
  if (foto1) {
    fs.writeFileSync(D + '/' + id + '_a.png', foto0); fs.writeFileSync(D + '/' + id + '.png', foto1);
    px = await ev(`(async () => { const c = async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const k = document.createElement('canvas'); k.width = i.width; k.height = i.height; const x = k.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
      const a = await c(${JSON.stringify(foto0.toString('base64'))}), b = await c(${JSON.stringify(foto1.toString('base64'))}); let n = 0; for (let k = 0; k < a.length; k += 4) if (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]) > 60) n++; return n; })()`);
  }
  return { id, grupo, cls, nb: !!puso.nb, modelo: puso.modelo, obj: ultima.obj, def: ultima.def, sec: ultima.sec, falta: ultima.falta, px, fotoT: +fotoT.toFixed(1),
    d0: +(d0 || 0).toFixed(1), dmin: +dmin.toFixed(1), tLlega, velMed: +med.toFixed(2), velMax: +mx.toFixed(2), velPide: ultima.v0, primerDano: primerDano === null ? null : +primerDano.toFixed(1), vidaMin: Math.min(...muestras.map((s) => s.vida)), muerte: muerte === null ? null : +muerte.toFixed(1), ignora, quieto: +quieto.toFixed(1),
    luaErr: luaErr.slice(0, 4).map((x) => String(x).slice(0, 160)), nLua: luaErr.length, jsErr: jsErr.slice(0, 3) };
}
const clases = {};
if (process.env.TODOS) {
  const P = await pagina();
  for (const id of IDS) { const x = LISTA.find((y) => y[0] === id) || [id, '?', []]; for (const d of x[2] || []) await instalar(P.ev, d); const r = await instalar(P.ev, id); clases[id] = x[3] || (r.npcs || [])[0]; }
  for (const id of IDS) { const x = LISTA.find((y) => y[0] === id) || [id, '?']; const r = clases[id] ? await probar(P, id, x[1], clases[id]) : { id, error: 'sin clase' }; console.log(JSON.stringify(r)); res.push(r); }
  await P.b.close();
} else {
  for (const id of IDS) {
    const x = LISTA.find((y) => y[0] === id) || [id, '?', []];
    const P = await pagina();
    try {
      for (const d of x[2] || []) await instalar(P.ev, d);
      const r0 = await instalar(P.ev, id), cls = x[3] || (r0.npcs || [])[0];
      const r = cls ? await probar(P, id, x[1], cls) : { id, error: 'sin clase', inst: r0 };
      console.log(JSON.stringify(r)); res.push(r);
    } catch (e) { console.log(JSON.stringify({ id, error: String(e.message || e).slice(0, 200) })); res.push({ id, error: String(e.message || e).slice(0, 200) }); }
    await P.b.close();
  }
}
fs.writeFileSync(D + '/tanda.json', JSON.stringify(res, null, 1));
// resumen: aparece (se ve), persigue, velocidad, mata, ignora, errores
console.log('\nid          grupo clase                  se ve(px) llega(s) vel m/s med/máx (pide)  quieto(s) daño/muerte(s) ignora lua/js');
for (const r of res) {
  if (r.error) { console.log(r.id.padEnd(12), 'ERROR', r.error); continue; }
  console.log(r.id.padEnd(12), (r.grupo || '').padEnd(5), String(r.cls).slice(0, 22).padEnd(22), String(r.px).padStart(8), String(r.tLlega ?? '-').padStart(8), (r.velMed + '/' + r.velMax + ' (' + r.velPide + ')').padStart(22), String(r.quieto).padStart(9), ((r.primerDano ?? '-') + '/' + (r.muerte ?? '-')).padStart(14), String(r.ignora).padStart(6), ' ' + r.nLua + '/' + r.jsErr.length, r.falta ? 'MODELO FALTA' : '');
}
process.exit(0);
