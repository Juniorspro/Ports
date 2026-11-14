// Armas de superpoderes que mueven al jugador desde los ganchos de movimiento de GMod (SetupMove/Move/FinishMove con
// mv:SetVelocity y mv:SetOrigin, o Player:SetVelocity): Sonic, Shadow, Superman, Spider-Man, One Piece, Gojo, Jason...
// Por arma, con el arma en la mano: 1,5 s con el primario, con el secundario, corriendo hacia adelante (Shift: el «boost»
// de Sonic) y saltando con el secundario apretado; en cada uno, cuánto se movió el jugador, su velocidad máxima y cuántas
// veces el Lua le cambió la velocidad o el lugar (GMA.movN). Camina normal a 6 m/s y corriendo a 8,1 m/s: si el arma lo
// lleva más rápido, más alto o lo engancha, se ve acá. Foto al final de cada prueba.
// uso: node sweps_mover.mjs URL_HTML URL_GMA CARPETA_SALIDA lista(id+dep...,...)
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, GMA, OUT, LISTA] = process.argv; fs.mkdirSync(OUT, { recursive: true });
const lista = LISTA.split(',').map((s) => { const [id, ...deps] = s.split(':')[0].split('+'); return { id, deps }; });
const res = [];
for (const L of lista) {
  const s = await abrir(HTML); const { p, ev } = s;
  try {
    await p.setViewportSize({ width: 960, height: 540 });
    await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); DIA.hora = 13; DIA.aplicada = -1; 1`);
    await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 90000 });
    await ev(`window.esperaJuego = (t) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + t || performance.now() - r0 > 25000 ? ok() : setTimeout(f, 20)); f(); }); $('hud').classList.add('oc'); 1`);
    for (const d of [...L.deps, L.id]) await ev(`(async () => { const b = new Uint8Array(await (await fetch('${GMA}/${d}/${d}.gma')).arrayBuffer()); const A = await gmInstalar('${d}', { nombre: '${d}', sinDeps: true }, b); await A.listo; return 1; })()`);
    const armas = await ev(`(GMOD.addons.get('${L.id}').sweps || []).slice(0, 2)`);
    for (const w of armas) {
      const r = await ev(`(async () => { const e0 = GMA.errores.length; GMA.errCuenta = new Map(); gmaSpawnMenu(${JSON.stringify('gmswep:' + w)}); await esperaJuego(2);
        const prueba = async (n, poner, sacar) => { JUG.pos.set(0, JUG.pos.y, 0); JUG.vel.set(0, 0, 0); JUG.yaw = 0; JUG.pitch = 0; await esperaJuego(0.4); const p0 = JUG.pos.clone(), m0 = GMA.movN || 0; let vmax = 0, alto = 0;
          poner(); const t0 = TIEMPO.t, r0 = performance.now(); while (TIEMPO.t < t0 + 1.5 && performance.now() - r0 < 20000) { await new Promise((ok) => setTimeout(ok, 30)); vmax = Math.max(vmax, JUG.vel.len()); alto = Math.max(alto, JUG.pos.y - p0.y); } sacar(); await esperaJuego(0.3);
          return { n, desp: +JUG.pos.distTo(p0).toFixed(2), vmax: +vmax.toFixed(1), alto: +alto.toFixed(2), movN: (GMA.movN || 0) - m0 }; };
        const R = [];
        R.push(await prueba('primario', () => { ENT.disparo = true; }, () => { ENT.disparo = false; }));
        R.push(await prueba('secundario', () => { ENT.disparo2 = true; }, () => { ENT.disparo2 = false; }));
        /* (las teclas de verdad: entrada.js arma ENT.x/y/correr/saltar desde ENT.teclas en cada cuadro) */
        const T = ENT.teclas, pon = (...k) => () => k.forEach((x) => T.add(x)), saca = (...k) => () => k.forEach((x) => T.delete(x));
        R.push(await prueba('correr', pon('KeyW', 'ShiftLeft'), saca('KeyW', 'ShiftLeft')));
        R.push(await prueba('saltar+sec', () => { T.add('Space'); ENT.disparo2 = true; }, () => { T.delete('Space'); ENT.disparo2 = false; }));
        return { w: ${JSON.stringify(w)}, R, err: GMA.errores.slice(e0, e0 + 4).map((x) => String(x).slice(0, 160)) }; })()`);
      await p.screenshot({ path: `${OUT}/${L.id}_${w}_mover.jpg`, type: 'jpeg', quality: 70 });
      res.push({ addon: L.id, ...r }); fs.writeFileSync(OUT + '/mover.json', JSON.stringify(res, null, 1));
      console.log(L.id, w, r.R.map((x) => `${x.n}: ${x.desp} m, ${x.vmax} m/s, alto ${x.alto}, Lua ${x.movN}`).join(' | '), r.err.length ? 'ERR ' + r.err[0] : '');
    }
  } catch (e) { console.log(L.id, 'SE CORTÓ', String(e.message || e).slice(0, 150)); }
  await s.b.close().catch(() => {});
}
process.exit(0);
