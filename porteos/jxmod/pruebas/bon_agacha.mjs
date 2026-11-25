// Bon the rabbit «a veces se agacha donde no debe» (panel 3ydzqpjd). «[DrGBase] [Gentoi] Bon The Rabbit NEXTBOT» (Workshop
// 3541699236): su IA se agacha si una traza desde los pies hacia arriba (util.TraceLine, filter = self) toca algo a menos
// de 72 unidades —«techo bajo»— o si la caja de parado (TraceHull hasta 72) choca adelante y la de agachado (hasta 36) no.
//  1. Bon aparece sin errores;
//  2. en campo abierto (FlatGrass, sin nada arriba) la traza hacia arriba desde sus pies no toca nada (antes tocaba el
//     mismo piso del que sale: los triángulos del mapa se tocaban por los dos lados y desde t = 0);
//  3. en 12 s caminando hacia el jugador por el campo abierto no se agacha nunca;
//  4. una traza de caja (TraceHull) a la altura del pecho choca con una tabla alta que la de los pies no toca (la caja se
//     mira en su centro y arriba, no sólo en el piso);
//  5. sin errores de Lua ni de JS.
// uso: node bon_agacha.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/bon_agacha'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const { b, p, err, ev } = await abrir(HTML + '?test', !!process.env.CELU);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
const lua = (src) => ev(`(() => { const R = GMA.R; try { const f = luaCompilar(${JSON.stringify(src)}, 'prueba.lua', R); return JSON.stringify(gmaEnLado('S', () => R.c(f, 'prueba'))[0]); } catch (x) { return JSON.stringify('ERR ' + x.message); } })()`).then((r) => JSON.parse(r));
const inst = await ev(`(async () => { const A = await gmInstalar('3541699236', { nombre: 'bon' }); if (A && A.listo) await A.listo; await new Promise((r) => setTimeout(r, 1500)); return { ok: !!A, npc: [...((A.listas && A.listas.NPC) || new Map()).keys()] }; })()`);
const e0 = await ev(`GMA.errores.length`);
const cls = inst.npc.find((c) => /bon/i.test(c)) || inst.npc[0];
await ev(`(() => { JUG.pos.set(0, JUG.pos.y, 0); JUG.yaw = 0; JUG.pitch = 0.1; gmnpcCrear(${JSON.stringify(cls)}); return 1; })()`);
await p.waitForTimeout(3000);
const BON = `[...GMA.ents.values()].find((x) => x.clase === ${JSON.stringify(cls)} && x.vivo !== false)`;
const est = await ev(`(() => { const e = ${BON}; return e ? { id: e.id, nb: !!e.nb } : null; })()`);
ok('1. Bon aparece', !!est, { inst, cls, est });
const tr = await lua(`local b for _, e in ipairs(ents.GetAll()) do if e:GetClass() == ${JSON.stringify(cls)} then b = e end end
  if not IsValid(b) then return 'sin bon' end
  local s = b:GetPos() local t = util.TraceLine({ start = s, endpos = s + Vector(0, 0, 100), filter = b })
  return util.TableToJSON({ hit = t.Hit, alto = (t.HitPos - s).z, ent = tostring(t.Entity), z = s.z })`).then((x) => { try { return JSON.parse(x); } catch (e) { return x; } });
ok('2. en campo abierto, la traza hacia arriba desde sus pies no toca nada', tr && tr.hit === false, tr);
// 3: el jugador a 14 m; mientras camina hacia él, cada 300 ms: ¿agachado?
await ev(`(() => { const e = ${BON}, q = gmaEntPos(e); JUG.pos.set(q.x, JUG.pos.y, q.z + 14); JUG.vel.set(0, 0, 0); return 1; })()`);
let agachado = 0, muestras = 0; const pos0 = await ev(`(() => { const q = gmaEntPos(${BON}); return [q.x, q.z]; })()`);
for (let i = 0; i < 40; i++) {
  const r = await lua(`for _, e in ipairs(ents.GetAll()) do if e:GetClass() == ${JSON.stringify(cls)} then return e:GetNW2Bool('IsCrouching', false) end end return nil`);
  muestras++; if (r === true) agachado++;
  if (i === 20) await p.screenshot({ path: D + '/1_camina.png' });
  await p.waitForTimeout(300);
}
const pos1 = await ev(`(() => { const q = gmaEntPos(${BON}); return [q.x, q.z]; })()`);
ok('3. caminando por el campo abierto no se agacha nunca', agachado === 0, { agachado, muestras, se_movio: +Math.hypot(pos1[0] - pos0[0], pos1[1] - pos0[1]).toFixed(2) });
// 4: una tabla alta (caja fija a 40-60 unidades del piso, adelante): la caja de parado la toca, la de agachado no
const r4 = await lua(`local s = Vector(0, 0, 0) local tr0 = util.TraceLine({ start = Vector(0, 0, 1000), endpos = Vector(0, 0, -1000) }) s = tr0.HitPos + Vector(0, 0, 1)
  local p = ents.Create('prop_physics') p:SetModel('models/props_junk/wood_crate001a.mdl') p:SetPos(s + Vector(60, 0, 70)) p:Spawn()
  local ph = p:GetPhysicsObject() if IsValid(ph) then ph:EnableMotion(false) end
  local fin = s + Vector(120, 0, 0)
  local a = util.TraceHull({ start = s, endpos = fin, mins = Vector(-10, -10, 0), maxs = Vector(10, 10, 72) })
  local c = util.TraceHull({ start = s, endpos = fin, mins = Vector(-10, -10, 0), maxs = Vector(10, 10, 36) })
  local f = a.Fraction p:Remove()
  return util.TableToJSON({ parado = a.Hit, agachado = c.Hit, frac = f })`).then((x) => { try { return JSON.parse(x); } catch (e) { return x; } });
ok('4. la caja de parado choca con una tabla alta que la de agachado no toca', r4 && r4.parado === true && r4.agachado === false, r4);
const e1 = await ev(`GMA.errores.slice(${e0})`), errJs = err.filter((x) => !/WebSocket connection to|Failed to load resource/.test(x));
ok('5. sin errores de Lua ni de JS', !e1.length && !errJs.length, { lua: e1.slice(0, 4), js: errJs.slice(0, 4) });
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await b.close();
process.exit(R.every(Boolean) ? 0 : 1);
