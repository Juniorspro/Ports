// Nuke Pack 4 (Workshop 106565409): la bomba atómica en un barril se arma con Usar y explota al chocar fuerte
// (PhysicsCollide con Speed > 600 y DeltaTime > 0.15, como en GMod); la explosión (sent_nuke) tiene que verse,
// dejar la radiación y no tirar errores de Lua.
// uso: node gmod_nuke.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const G = process.argv[3], D = (process.argv[4] || '.') + '/';
const { b, p, err, ev } = await abrir(process.argv[2], false);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 60000 });
await ev(`window.esperaJuego = (s) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + s || performance.now() - r0 > 30000 ? ok() : setTimeout(f, 30)); f(); }); 1`);
const ins = await ev(`(async () => { const A = await gmInstalar('106565409', { nombre: 'Nuke Pack 4' }, new Uint8Array(await (await fetch('${G}/106565409.gma')).arrayBuffer())); await A.listo; return { sents: A.sents.length, luaErr: (A.luaErr || []).slice(0, 3) }; })()`);
ok('instala', ins.sents > 10, ins);
// clases creadas (ents.Create) desde ahora
await ev(`(() => { const vistas = new Set(GMA.ents.keys()), todas = new Set(); window.__nuevas = () => [...todas]; window.__e0 = GMA.errores.length;
  setInterval(() => { for (const e of GMA.ents.values()) if (!vistas.has(e.id)) todas.add(e.clase); }, 50); return 1; })()`);
const s = await ev(`(async () => { JUG.pitch = 0.15; gmaSpawnMenu('gment:barrel_sent_atomic_bomb'); await esperaJuego(1);
  const e = [...GMA.ents.values()].filter((x) => x.clase === 'barrel_sent_atomic_bomb').pop(); if (!e) return { e: 'no está' };
  gmaUsar(e, GMA.jug); await esperaJuego(0.3);
  const b = e.o && e.o.b; if (!b) return { e: 'sin cuerpo' };
  b.pos.y += 14; b.vel.set(0, -30, 0); b.wake(); window.__tb = TIEMPO.t;
  return { pos: +b.pos.y.toFixed(1) }; })()`).catch((e) => ({ e: String(e) }));
ok('barril puesto y lanzado', !s.e, s);
let vio = 0;
for (const t of [0.8, 2.5, 5]) {
  await ev(`esperaJuego(${t} - (TIEMPO.t - window.__tb))`);
  const x = await ev(`({ nuevas: window.__nuevas(), parts: GR.parts.length + PART.l.length, prim: GR.nv })`);
  vio = Math.max(vio, x.parts); console.log('  t=' + t, JSON.stringify(x).slice(0, 300));
  await p.screenshot({ path: D + 'nuke_' + t + '.png' });
}
const fin = await ev(`({ nuevas: window.__nuevas(), errs: GMA.errores.slice(window.__e0).slice(0, 6) })`);
ok('explotó (sent_nuke o su radiación)', fin.nuevas.some((c) => /sent_nuke/.test(c)), fin.nuevas.slice(0, 12));
ok('se ve la explosión (partículas)', vio > 50, vio);
ok('sin errores de Lua', !fin.errs.length, fin.errs);
console.log(R.every(Boolean) ? 'TODO BIEN ' + R.length + '/' + R.length : 'FALLAN ' + R.filter((x) => !x).length + '/' + R.length);
await b.close();
