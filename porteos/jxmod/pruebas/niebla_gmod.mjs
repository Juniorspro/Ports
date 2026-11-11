// La niebla de los mapas de GMod (Discord: «¿por qué tanta neblina?», gm_construct en un celular con una niebla blanca
// espesa pegada al jugador). Un mapa BSP (o uno del juego) en las cinco calidades, en la compu y en un celular horizontal,
// con la cámara real del jugador en el lugar más abierto del mapa mirando para donde se ve más lejos (12° para abajo).
// Por cada punto de una grilla de la mitad de abajo de la pantalla: rayo al mapa, distancia y la niebla con la misma
// cuenta del shader (gl.js: lineal entre el comienzo y el fin, por la densidad máxima; en Ultra con la bruma). Mide qué
// parte del piso que se ve queda «lavada» (niebla > 25 %), la niebla media y la de 10/25/50/100 m, y saca una foto de cada una.
// Pasa si, con la niebla del mapa (env_fog_controller), el color es el del mapa a mediodía (no el blanco del cielo), la
// densidad máxima es la del mapa (fogmaxdensity) y en ningún lado tapa más que eso; y sin errores de JS.
// uso: node niebla_gmod.mjs URL_HTML CARPETA_FOTOS ETIQUETA [MAPA|URL_BSP=RB_Construct]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , URL, DIR, ETQ, MAPA = 'RB_Construct'] = process.argv; fs.mkdirSync(DIR, { recursive: true });
const res = {}; const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
for (const celu of [false, true]) {
  const { b, p, err, ev } = await abrir(URL, celu, null, async (pg) => { await pg.addInitScript(() => { try { localStorage.setItem('jx_prefs', JSON.stringify({ bienvenida: true, gfx: 'bajo', motor: 'webgl2', motorV: 2, fps: false })); } catch (e) {} }); });
  await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); 1`);
  let MK = MAPA;
  if (/\.bsp$/.test(MAPA)) { const nom = MAPA.split('/').pop().replace(/\.bsp$/, ''); MK = await ev(`(async () => { const b = new Uint8Array(await (await fetch('${MAPA}')).arrayBuffer()); const r = 'maps/${nom}.bsp'; GMOD.arch.set(r, b); const k = gbspClave(r); GBSP.mapas.set(k, { id: 'sonda', ruta: r, nombre: '${nom}', addon: 'sonda' }); if (!MAPAS_RB.includes(k)) MAPAS_RB.push(k); empezarPartida(k); return k; })()`); }
  else await ev(`empezarPartida('${MAPA}'); 1`);
  await p.waitForFunction((m) => window.__ev(`MUNDO.nombre === '${m}' && JUEGO.estado === 'juego' && JUG.suelo`), MK, { timeout: 240000, polling: 300 });
  await p.waitForTimeout(2000);
  // el lugar más abierto del mapa (el campo grande de gm_construct): el piso desde donde, a 1,7 m, los rayos horizontales
  // en 16 direcciones llegan más lejos en promedio; se mira hacia donde llega más lejos
  const lug = await ev(`(() => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y1 = -1e9; const T = MUNDO.T; for (let i = 0; i < MUNDO.nt * 9; i += 3) { x0 = Math.min(x0, T[i]); x1 = Math.max(x1, T[i]); y1 = Math.max(y1, T[i + 1]); z0 = Math.min(z0, T[i + 2]); z1 = Math.max(z1, T[i + 2]); }
    const sp = MUNDO.spawns[0], hs = mundoRayo(v3(sp.x, sp.y + 0.5, sp.z), v3(0, -1, 0), 50), YS = sp.y + 0.5 - (hs ? hs.t : 0.5); let mejor = null; const pa = Math.max(4, Math.min(x1 - x0, z1 - z0) / 40);
    for (let x = x0 + pa / 2; x < x1; x += pa) for (let z = z0 + pa / 2; z < z1; z += pa) {
      const h = mundoRayo(v3(x, YS + 5, z), v3(0, -1, 0), 10); if (!h || !h.n || h.n.y < 0.9) continue; const y = YS + 5 - h.t + 1.7; if (Math.abs(y - 1.7 - sp.y) > 4) continue;
      let s = 0, mx = 0, ym = 0; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, d = v3(Math.sin(a), 0, Math.cos(a)), r = mundoRayo(v3(x, y, z), d, 300), t = r ? r.t : 300; s += Math.min(t, 150); if (t > mx) { mx = t; ym = a; } }
      if (!mejor || s > mejor.s) mejor = { s, x, y, z, ym };
    }
    return mejor; })()`);
  console.log('lugar', JSON.stringify(lug));
  for (const q of ['patata', 'bajo', 'medio', 'alto', 'ultra']) {
    await ev(`PREFS.gfx = '${q}'; PREFS.res = PERFILES['${q}'].res; PREFS.lejos = PERFILES['${q}'].lejos; GFX.auto = false; aplicarGfx(); JUG.pos.set(${lug.x}, ${lug.y} - 0.7, ${lug.z}); JUG.vel.set(0,0,0); JUG.yaw = ${lug.ym}; JUG.pitch = -0.21; 1`);
    await p.waitForTimeout(1500);
    await ev(`if (CAM.fwd.x * Math.sin(${lug.ym}) + CAM.fwd.z * Math.cos(${lug.ym}) < 0) JUG.yaw += Math.PI; 1`);
    await p.waitForTimeout(1500);
    const m = await ev(`(() => {
      const N = R.niebla, L = GFX.luz, Mi = M4.inv(R.vpMundo), cam = R.camPos;
      const un = (x, y, z) => { const v = [x, y, z, 1], o = [0, 0, 0, 0]; for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) o[i] += Mi[k * 4 + i] * v[k]; return v3(o[0] / o[3], o[1] / o[3], o[2] / o[3]); };
      const fog = (d, dy) => { let f = Math.min(1, Math.max(0, (d - N.a) / (N.b - N.a))) * (N.m === undefined ? 1 : N.m); if (L >= 3) f = 1 - (1 - f) * Math.exp(-Math.max(0, d - 20) * 0.0006 * Math.exp(-Math.max(dy + 5, 0) * 0.02)); return f; };
      let n = 0, lav = 0, s = 0;
      for (let j = 0; j < 30; j++) for (let i = 0; i < 40; i++) {
        const x = (i + 0.5) / 40 * 2 - 1, y = -((j + 0.5) / 30);
        const a = un(x, y, -1), c = un(x, y, 1), d = vsub(c, a).norm(), h = mundoRayo(cam, d, 2000); if (!h) continue;
        const dist = h.t, f = fog(dist, d.y * dist); n++; s += f; if (f > 0.25) lav++;
      }
      return { gfx: PREFS.gfx, luz: L, lejos: GFX.lejos, a: +N.a.toFixed(1), b: +N.b.toFixed(1), m: N.m === undefined ? 1 : N.m, c: N.c.map((x) => +x.toFixed(2)), fov: +CAM.fov.toFixed(1),
        piso: n, lavado: +(100 * lav / Math.max(1, n)).toFixed(1), media: +(100 * s / Math.max(1, n)).toFixed(1),
        f10: +(100 * fog(10, 0)).toFixed(0), f25: +(100 * fog(25, 0)).toFixed(0), f50: +(100 * fog(50, 0)).toFixed(0), f100: +(100 * fog(100, 0)).toFixed(0), fMax: +(100 * fog(1e5, 0)).toFixed(0),
        mapa: (() => { const aj = DATA.aj[MUNDO.nombre] || {}; return aj.fog && aj.fm === 1 && aj.fe > aj.fs && !(aj.fd > 0) ? { c: aj.fc.slice(0, 3), m: aj.fmax === undefined ? 1 : aj.fmax } : null; })(), hora: DIA.hora };
    })()`);
    const k = (celu ? 'celu' : 'pc') + '_' + q; const { mapa: M, ...vis } = m; res[k] = m; console.log(k, JSON.stringify(vis));
    if (M && Math.abs(m.hora - 12) < 0.01) ok(`${k}: la niebla es la del mapa (color ${M.c.map((x) => x.toFixed(2))}, hasta ${Math.round(M.m * 100)} %) y no tapa más`, m.c.every((x, i) => Math.abs(x - M.c[i]) < 0.011) && m.m === M.m && (m.luz >= 3 || m.fMax <= Math.round(M.m * 100)), { c: m.c, m: m.m, fMax: m.fMax });
    fs.writeFileSync(`${DIR}/niebla_${ETQ}_${k}.png`, await p.screenshot());
  }
  const e2 = err.filter((e) => !/WebSocket|ERR_CONNECTION|404|Failed to load resource/.test(e)); ok((celu ? 'celu' : 'pc') + ': sin errores de JS', !e2.length, e2.slice(0, 5));
  await b.close();
}
fs.writeFileSync(`${DIR}/niebla_${ETQ}.json`, JSON.stringify(res, null, 1));
console.log(R0.every(Boolean) ? `TODO BIEN ${R0.length}/${R0.length}` : `FALLAN ${R0.filter((x) => !x).length}/${R0.length}`);
