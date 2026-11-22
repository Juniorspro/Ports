// Panel (ur9f8srh): «En el mod Suicide Gun (el de la mujer anime), después de usar el arma las manos desaparecen».
// La Suicide Gun (Workshop 3534176154) pone sus brazos de NMRiH en el Initialize del cliente (GetHands():SetModel). Al
// usarla te matás; en GMod al reaparecer te dan armas nuevas (entidades nuevas) y su Initialize vuelve a correr. JXMod te
// deja las armas: ahora se vuelven a crear al reaparecer (gmaArmasRenacer). En Pasto plano:
//  1. sacada: la vista tiene manos (las de NMRiH que puso el Lua);
//  2. disparar: el jugador muere y reaparece con la Suicide Gun en la mano;
//  3. después de reaparecer: siguen las manos (antes, la pistola flotando sola) y el arma es una entidad nueva;
//  4. sin errores de Lua ni de JS.
// uso: node suicide_gun.mjs ARCHIVO.html [CARPETA_CAPTURAS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/suicide_gun'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego'`), null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(2500);
const ins = await ev(`(async () => { const A = await gmInstalar('3534176154', { nombre: 'Suicide Gun' }); if (A && A.listo) await A.listo; await new Promise((r) => setTimeout(r, 1500)); return { err: (A.luaErr || []).slice(0, 3), sweps: A.sweps }; })()`);
const e0 = await ev(`GMA.errores.length`);
await ev(`spawnElegir('armas', 'gmswep:weapon_suicidegun'); 1`); await p.waitForTimeout(3000);
const est = () => ev(`(() => { const v = ARM.v || {}, w = GMA.armasJug && GMA.armasJug.get('weapon_suicidegun'); return { arma: ARM.lista[ARM.i], vivo: JUG.vivo, manosLua: GMA.manosEnt ? GMA.manosEnt.modelo || '' : '', vistaManos: !!v.manos, ent: w ? w.id : null }; })()`);
const a = await est(); await p.screenshot({ path: D + '/1_sacada.png' });
ok('1. sacada: con las manos que pone su Lua', ins.sweps.includes('weapon_suicidegun') && a.arma === 'gm:weapon_suicidegun' && a.vistaManos && /c_obsolete_arms/.test(a.manosLua), { ins, a });
await ev(`ENT.disparo = true; 1`); await p.waitForTimeout(400); await ev(`ENT.disparo = false; 1`);
let murio = false, b2 = null; for (let i = 0; i < 20; i++) { await p.waitForTimeout(500); const x = await est(); if (!x.vivo) murio = true; if (murio && x.vivo) { b2 = x; break; } }
ok('2. disparando se mata y reaparece con la Suicide Gun en la mano', murio && b2 && b2.arma === 'gm:weapon_suicidegun', { murio, b2 });
await p.waitForTimeout(3000); const c = await est(); await p.screenshot({ path: D + '/2_reaparecido.png' });
ok('3. después de reaparecer siguen las manos (y el arma es una entidad nueva)', c.vistaManos && /c_obsolete_arms/.test(c.manosLua) && c.ent !== a.ent, c);
const lua = await ev(`GMA.errores.slice(${e0})`), js = err.filter((x) => !/favicon|ERR_|net::|404|409|WebSocket|mqtt|wss:|CORS|scheme 'file'|Cache/i.test(x));
ok('4. sin errores de Lua ni de JS', !lua.length && !js.length, { lua: lua.slice(0, 4), js: js.slice(0, 4) });
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(0);
