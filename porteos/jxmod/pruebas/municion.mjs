// Munición (municion.js; Bugs y sugerencias q55n3p6u: «munición, que aparezca en la sección de armas»):
//  1. Armas → Munición tiene las 10 cajas de HL2 (con su dibujo) y abajo «Munición limitada (como en GMod)», apagada;
//  2. apagada: la pistola muestra «12 | ∞»; una caja de pistola puesta delante se agarra pasando por encima (se va) y
//     llena el cargador;
//  3. prendida: la reserva empieza en 60 y se ve («12 | 60»); recargar con 7 en el cargador gasta 5 de la reserva; sin
//     reserva no recarga;
//  4. la caja de pistola suma 20 a la reserva;
//  5. los addons de GMod ven la misma reserva: Player:GetAmmoCount("Pistol"), GiveAmmo, game.GetAmmoID("SMG1") = 4;
//  6. al reaparecer vuelve a lo del principio;
//  7. sin errores de JS. Fotos: la pestaña, la caja puesta.
// uso: node municion.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/municion'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const { b, p, err, ev } = await abrir(HTML + '?test');
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.lang = 'es'; PREFS.municionLimitada = false; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 }); await p.waitForTimeout(1200);
await ev(`(async () => { if (typeof gmlIniciar === 'function') await gmlIniciar(); return 1; })()`);
const st1 = await ev(`(() => { UI.tab = DATA.menu.findIndex((c) => c.n === 'Weapons'); abrirSpawn(); const subs = spawnSubs(DATA.menu[UI.tab]); UI.sub = subs.findIndex((s) => s.mun); spawnDibujar(); const S = subs[UI.sub];
  return { cat: spawnCatNom(S), n: S.it.length, tiles: [...document.querySelectorAll('#grilla .it span')].map((x) => x.textContent).slice(0, 10), chk: !!$('chMun'), on: $('chMun') && $('chMun').checked, pie: $('pie').textContent }; })()`);
await p.waitForTimeout(2500); await p.screenshot({ path: D + '/1_pestana.png' });
ok('1. Armas → Munición con las 10 cajas y la casilla de munición limitada (apagada)', st1.cat === 'Munición' && st1.n === 10 && st1.tiles.length === 10 && st1.chk && !st1.on && /Munición limitada/.test(st1.pie), st1);
// 2: apagada
await ev(`(() => { cerrarPaneles(); darArma('Pistol'); return 1; })()`); await p.waitForTimeout(800);
const hud0 = await ev(`$('muni').textContent`);
await ev(`(() => { ARM.balas.Pistol = 3; JUG.yaw = 0; JUG.pitch = 0.5; return 1; })()`); await p.waitForTimeout(300);
const caja = await ev(`(async () => { const o = await munPoner1('mun:pistol'); return o ? { n: o.nombre, d: +vsub(o.b.pos, JUG.pos).len().toFixed(2) } : null; })()`);
await p.waitForTimeout(1200); await p.screenshot({ path: D + '/2_caja.png' });
const ag = await ev(`(async () => { const o = [...MUN.cajas][0]; if (!o) return { sin: true }; JUG.pos.set(o.b.pos.x, JUG.pos.y, o.b.pos.z); for (let k = 0; k < 20 && OBJS.includes(o); k++) await new Promise((r) => setTimeout(r, 150)); return { quedo: OBJS.includes(o), balas: ARM.balas.Pistol, hud: $('muni').textContent }; })()`);
ok('2. sin límite: «12 | ∞»; la caja se pone y se agarra pasando por encima, y llena el cargador', hud0 === '12 | ∞' && caja && /boxsrounds/.test(caja.n) && !ag.quedo && ag.balas === 12, { hud0, caja, ag });
// 3: prendida (con la casilla, como el jugador)
await ev(`(() => { UI.tab = DATA.menu.findIndex((c) => c.n === 'Weapons'); abrirSpawn(); UI.sub = spawnSubs(DATA.menu[UI.tab]).findIndex((s) => s.mun); spawnDibujar(); const m = $('chMun'); m.checked = true; m.onchange(); cerrarPaneles(); return 1; })()`);
const r3 = await ev(`(async () => { const h1 = $('muni').textContent; ARM.balas.Pistol = 7; recargar(); for (let k = 0; k < 60 && ARM.recargando > 0; k++) await new Promise((r) => setTimeout(r, 100)); const a = { h1, balas: ARM.balas.Pistol, res: MUN.res.get('pistol'), hud: $('muni').textContent };
  MUN.res.set('pistol', 0); ARM.balas.Pistol = 2; recargar(); a.recargaSin = ARM.recargando > 0; a.balasSin = ARM.balas.Pistol; return a; })()`);
ok('3. con límite: empieza en 60, recargar gasta de la reserva y sin reserva no recarga', r3.h1 === '12 | 60' && r3.balas === 12 && r3.res === 55 && r3.hud === '12 | 55' && !r3.recargaSin && r3.balasSin === 2, r3);
// 4: la caja suma
const r4 = await ev(`(async () => { ARM.balas.Pistol = 12; JUG.yaw = 0; JUG.pitch = 0.5; await new Promise((r) => setTimeout(r, 300)); const o = await munPoner1('mun:pistol'); if (!o) return null; JUG.pos.set(o.b.pos.x, JUG.pos.y, o.b.pos.z); for (let k = 0; k < 20 && OBJS.includes(o); k++) await new Promise((r) => setTimeout(r, 150)); return { quedo: OBJS.includes(o), res: MUN.res.get('pistol') }; })()`);
ok('4. la caja de pistola suma 20 a la reserva', r4 && !r4.quedo && r4.res === 20, r4);
// 5: lo ven los addons (Lua)
const lua = await ev(`(() => { if (!GMA.R) gmaIniciar(); const R = GMA.R; try { const f = luaCompilar('local p = LocalPlayer() or Entity(1) local a = p:GetAmmoCount("Pistol") local g = p:GiveAmmo(10, "Pistol") return a .. "|" .. p:GetAmmoCount("Pistol") .. "|" .. game.GetAmmoID("SMG1") .. "|" .. p:GetAmmoCount(game.GetAmmoID("Pistol"))', 'prueba.lua', R); return String(gmaEnLado('S', () => R.c(f, 'prueba'))[0]); } catch (x) { return 'ERR ' + x.message; } })()`);
ok('5. los addons ven la misma reserva (GetAmmoCount, GiveAmmo, game.GetAmmoID)', lua === '20|30|4|30', lua);
// 6: reaparecer
const r6 = await ev(`(() => { jugadorAparecer(); return MUN.res.get('pistol'); })()`);
ok('6. al reaparecer vuelve a lo del principio', r6 === 60, r6);
await ev(`(() => { PREFS.municionLimitada = false; guardarPrefs(); return 1; })()`);
const errJs = err.filter((x) => !/WebSocket connection to|Failed to load resource/.test(x));
ok('7. sin errores de JS', !errJs.length, errJs.slice(0, 4));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await b.close();
process.exit(R.every(Boolean) ? 0 : 1);
