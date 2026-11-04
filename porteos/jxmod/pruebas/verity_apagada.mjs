// Verity desactivada: no está entre los mods oficiales, no aparece jugando solo (aunque el mod viejo quede prendido) ni
// en un server, no se ve la de otro jugador, no escucha el micrófono y sus botones no se ven; sin errores.
// uso: node verity_apagada.mjs URL_HTML
import { abrir } from './base.mjs';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(process.argv[2], true);
ok('Verity no está entre los mods oficiales', await ev(`!OFICIALES.some((m) => m.id === 'verity')`));
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
const solo = await ev(`(async () => { if (typeof NAT !== 'undefined') NAT.mods.add('verity'); await new Promise((r) => setTimeout(r, 1500)); return { on: VER.on, oido: !!OIDO.r, quiere: oidoQuiere(), boton: !!(VER.bt && VER.bt.offsetParent) }; })()`);
ok('jugando solo (con el mod viejo prendido) no aparece, no escucha y no hay botón', !solo.on && !solo.oido && !solo.quiere && !solo.boton, solo);
const sala = await ev(`(async () => { const s0 = typeof SALA !== 'undefined' ? SALA : undefined; try { SALA = { id: 'prueba' }; } catch (e) {} await new Promise((r) => setTimeout(r, 1200));
  verRemoto({ id: 'x9', pos: v3(JUG.pos.x + 2, JUG.pos.y, JUG.pos.z) }, [JUG.pos.x + 2, JUG.pos.y + 1, JUG.pos.z, 0, 0, 0, 1]); await new Promise((r) => setTimeout(r, 400));
  const r = { on: VER.on, rem: VER.rem.size, oido: !!OIDO.r }; try { SALA = s0; } catch (e) {} return r; })()`);
ok('en un server tampoco: ni la del server ni la de otro jugador', !sala.on && sala.rem === 0 && !sala.oido, sala);
const bts = await ev(`(async () => { return { ea: [...document.querySelectorAll('[data-ea="verity"],[data-cr="verity"]')].filter((x) => x.offsetParent).length }; })()`);
ok('sin botones de Verity a la vista', bts.ea === 0, bts);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores', !e2.length, e2.slice(0, 4));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
