// armas de mods (M9K Assault Rifles, Workshop 128089118): manteniendo el secundario se apunta con la mira (la vista se
// mueve a IronSightsPos y se queda mientras se mantiene), las balas van a donde apunta la cruz (< 2,5° con la mira),
// y al recargar (tecla R o el botón de la pantalla) se ve la animación de recarga de su vista y el cargador se llena al terminar.
// uso: node gmod_mira_recarga.mjs URL_HTML URL_GMA [CARPETA_FOTOS] (ARMA=m9k_ak47)
import { abrir } from './base.mjs';
const G = process.argv[3], D = (process.argv[4] || '.') + '/', ARMA = process.env.ARMA || 'm9k_ak47', ID = process.env.ID || '128089118';
const { b, p, err, ev } = await abrir(process.argv[2], false);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 60000 });
await ev(`window.esperaJuego = (s) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + s || performance.now() - r0 > 30000 ? ok() : setTimeout(f, 20)); f(); }); 1`);
const ins = await ev(`(async () => { const A = await gmInstalar('${ID}', { nombre: '${ID}' }, new Uint8Array(await (await fetch('${G}/${ID}.gma')).arrayBuffer())); await A.listo; return { sweps: A.sweps.length, tiene: A.sweps.includes('${ARMA}') }; })()`);
ok('instala y trae ' + ARMA, ins.tiene, ins);
await ev(`(async () => { window.__e0 = GMA.errores.length; gmaSpawnMenu('gmswep:${ARMA}'); JUG.pitch = 0; await esperaJuego(2); return 1; })()`);
// dónde está la vista respecto de la cámara (en su marco): antes, manteniendo el secundario y al soltarlo
const vista = `(() => { const v = ARM.v; if (!v || !v.md) return null; const m = v.md.raiz, d = v3(m[12] - CAM.pos.x, m[13] - CAM.pos.y, m[14] - CAM.pos.z), qi = CAM.q.clone().conj ? CAM.q.clone().conj() : null; const l = qi ? qi.rot(d) : d; return [+l.x.toFixed(3), +l.y.toFixed(3), +l.z.toFixed(3), +CAM.fov.toFixed(1)]; })()`;
const v0 = await ev(vista);
await ev(`(async () => { ENT.disparo2 = true; await esperaJuego(1.2); return 1; })()`);
const v1 = await ev(vista); await p.screenshot({ path: D + 'mira_' + ARMA + '.png' });
// con la mira puesta: 8 disparos, ángulo entre la bala y la cruz
const ang = await ev(`(async () => { const L = []; const o = gmaBalas; gmaBalas = (e, b) => { try { const d = b.get('Dir'); if (d) { const x = dG(d).norm(); L.push(Math.acos(Math.min(1, vdot(x, CAM.fwd))) * 180 / Math.PI); } } catch (er) {} return o(e, b); };
  for (let i = 0; i < 8; i++) { ENT.disparo = true; await esperaJuego(0.05); ENT.disparo = false; await esperaJuego(0.2); } gmaBalas = o; return L; })()`);
ENT_SOLTAR: await ev(`(async () => { ENT.disparo2 = false; await esperaJuego(0.8); return 1; })()`);
const v2 = await ev(vista);
const dm = v0 && v1 ? Math.hypot(v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]) : 0, dv = v0 && v2 ? Math.hypot(v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]) : 9;
ok('manteniendo el secundario se apunta con la mira (la vista se mueve ≥ 2 cm o baja el FOV)', dm >= 0.02 || (v1 && v0 && v1[3] < v0[3] - 2), { v0, v1 });
ok('al soltarlo vuelve (≤ 1 cm de donde estaba)', dv <= 0.01, { v2 });
const angM = ang.length ? Math.max(...ang) : 99;
ok('las balas salen hacia la cruz (con la mira, < 2,5°)', ang.length >= 4 && angM < 2.5, { n: ang.length, max: +angM.toFixed(2) });
// recarga desde el botón de la pantalla (recargar() = pulso del botón)
const rc = await ev(`(async () => { const w = GMA.swep; if (!w) return { e: 'sin arma' }; const c0 = w.clip1; recargar(); await esperaJuego(0.15);
  const clip = ARM.v && ARM.v.clip ? Object.keys(DATA.anPorNombre).find((k) => DATA.anPorNombre[k] === ARM.v.clip) : null, enRec = !!w.recarga, dur = w.recarga ? +(w.recarga - TIEMPO.t).toFixed(2) : 0;
  await esperaJuego(Math.max(0.5, dur + 0.3)); return { c0, clip, enRec, dur, c1: w.clip1, max: gmaSwepPrim(w, 'ClipSize') }; })()`);
await p.screenshot({ path: D + 'recarga_' + ARMA + '.png' });
ok('recargar (botón) pone la animación de recarga de su vista', rc.enRec && /reload/i.test(rc.clip || ''), rc);
ok('el cargador queda lleno al terminar', rc.c1 === rc.max && rc.c0 < rc.max, rc);
const errs = await ev(`GMA.errores.slice(window.__e0).slice(0, 5)`);
ok('sin errores de Lua', !errs.length, errs);
console.log(R.every(Boolean) ? 'TODO BIEN ' + R.length + '/' + R.length : 'FALLAN ' + R.filter((x) => !x).length + '/' + R.length);
await b.close();
