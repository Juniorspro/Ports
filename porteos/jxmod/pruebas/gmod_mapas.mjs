// mapas del Workshop (maps/*.bsp de un addon): instalar el addon, que su mapa aparezca en la lista, armarlo y jugarlo.
// Por mapa: cuánto tarda en armarse, triángulos de choque, pedazos dibujados, props, apariciones, texturas que faltan;
// el jugador aparece y queda parado en el piso (no cae al vacío) y camina 2 s; fotos desde los ojos y desde arriba.
// uso: node gmod_mapas.mjs URL_HTML URL_CARPETA_GMA IDS(coma) [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, CARP, IDS, DIR = '.'] = process.argv, D = DIR + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
for (const id of IDS.split(',')) {
  const ins = await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${id}.gma')).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, b);
    return { n: A.nombre, mapas: [...GBSP.mapas].filter(([k, x]) => x.id === '${id}').map(([k]) => k), enLista: MAPAS_RB.filter((m) => /^WS_/.test(m)) }; })()`);
  ok(`${id}: sus mapas aparecen en la lista`, ins.mapas.length > 0 && ins.mapas.every((m) => ins.enLista.includes(m)), ins);
  for (const m of ins.mapas) {
    const t0 = Date.now();
    await ev(`empezarPartida(${JSON.stringify(m)}); 1`);
    await p.waitForFunction((k) => window.__ev(`MUNDO.nombre === ${JSON.stringify(k)} && JUEGO.estado === 'juego'`), m, { timeout: 240000 }).catch(() => {});
    const seg = (Date.now() - t0) / 1000;
    await p.waitForTimeout(3000);
    const r = await ev(`(() => { const aj = DATA.aj[${JSON.stringify(m)}] || {}, esc = DATA.esc[${JSON.stringify(m)}] || [];
      let mats = 0, falt = 0; const vis = new Set(); for (const a of esc) for (const x of a) for (const mi of x.mt || []) vis.add(mi);
      for (const mi of vis) { mats++; const t = DATA.mt[mi]; if (t && t.t === GMOD.faltante) falt++; }
      return { nombre: MUNDO.nombre, tris: MUNDO.nt, pedazos: esc.filter((a) => a[0].m !== undefined).length, props: esc.filter((a) => /^gm:/.test(a[0].n)).length, cascos: (aj.cascos || []).length, apar: MUNDO.spawns.length, mats, falt, suelo: JUG.suelo, y: +JUG.pos.y.toFixed(2), lo: +MUNDO.lo.y.toFixed(1), agua: (aj.agua || []).length }; })()`);
    await p.screenshot({ path: D + 'mapa_' + m + '_ojos.png' });
    // (si el modo de juego del mapa pide elegir equipo —Prop Hunt—, como un jugador: el que se mueve al empezar, Props; los
    // cazadores quedan quietos los primeros 30 s, como en el modo)
    await ev(`(() => { const L = [...document.querySelectorAll('#gmmEq:not(.oc) [data-eq]')]; const b = L.find((x) => /prop/i.test(x.textContent)) || L.find((x) => x.dataset.eq === 'auto'); if (b) b.click(); return 1; })()`); await p.waitForTimeout(800);
    // (cambiar de equipo mata y hace reaparecer al jugador, como en GMod; y la "pre-ronda" de Fretta/Prop Hunt deja a todos
    // congelados unos segundos: se espera a que esté vivo y suelto, hasta 20 s de juego)
    await ev(`(async () => { const t0 = TIEMPO.t, r0 = performance.now(); const listo = () => TIEMPO.t - t0 > 2 && JUG.vivo && !JUG.congelado && !UI.abierto; while (!listo() && TIEMPO.t - t0 < 20 && performance.now() - r0 < 60000) await new Promise((r) => setTimeout(r, 100)); return 1; })()`);
    // (camina 2 s para adelante; si aparece mirando a una pared —la aparición mira hacia donde la puso el mapa—, prueba
    // girado 90°, 180° y 270°, como haría un jugador)
    const anda = await ev(`(async () => { const p00 = JUG.pos.clone(); let mejor = 0, giros = 0, p0 = p00;
      const listo = async () => { const t0 = TIEMPO.t, r0 = performance.now(); while (!(JUG.vivo && !JUG.congelado && !UI.abierto) && TIEMPO.t - t0 < 20 && performance.now() - r0 < 60000) await new Promise((r) => setTimeout(r, 100)); };
      for (; giros < 4; giros++) { await listo(); p0 = JUG.pos.clone(); ENT.teclas.add('KeyW'); await new Promise((r) => setTimeout(r, 2000)); ENT.teclas.delete('KeyW'); let t = 0; while (!JUG.suelo && t < 30) { await new Promise((r) => setTimeout(r, 50)); t++; }
        mejor = Math.max(mejor, Math.hypot(JUG.pos.x - p0.x, JUG.pos.z - p0.z)); if (mejor > 1) break; JUG.yaw += Math.PI / 2; }
      return { anduvo: +mejor.toFixed(2), giros, vivo: JUG.vivo, cong: !!JUG.congelado, ui: UI.abierto || null, suelo: JUG.suelo, y: +JUG.pos.y.toFixed(2), dy: +(JUG.pos.y - p00.y).toFixed(2) }; })()`);
    await ev(`DBG.cam = { p: v3(JUG.pos.x, JUG.pos.y + 25, JUG.pos.z - 25), q: Quat.euler(0, 0.75) }; 1`); await p.waitForTimeout(800);
    await p.screenshot({ path: D + 'mapa_' + m + '_arriba.png' });
    // (y el mapa entero, desde arriba del centro)
    await ev(`(() => { const c = vscale(vadd(MUNDO.lo, MUNDO.hi), 0.5), t = Math.max(MUNDO.hi.x - MUNDO.lo.x, MUNDO.hi.z - MUNDO.lo.z); DBG.cam = { p: v3(c.x, MUNDO.hi.y + t * 0.45, c.z - t * 0.55), q: Quat.euler(0, 0.7) }; return 1; })()`); await p.waitForTimeout(1200);
    await p.screenshot({ path: D + 'mapa_' + m + '_todo.png' }); await ev(`DBG.cam = null; 1`);
    ok(`${m}: se arma (${seg.toFixed(1)} s) y se juega: aparece parado en el piso, camina y no se cae`, r.nombre === m && r.tris > 100 && r.apar > 0 && r.suelo && anda.suelo && anda.anduvo > 1 && anda.dy > -3, { ...r, anda });
    ok(`${m}: casi todas las texturas están (faltan ≤ 15 %)`, r.mats > 0 && r.falt / r.mats <= 0.15, { mats: r.mats, falt: r.falt });
  }
}
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
