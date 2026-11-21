// Panel (bug 4ube7k9g): «El mod de Doudou Pet no funciona bien, cuando lo agarras se bugea y no puedes hacer muchas cosas
// con él». Doudou Pet (Workshop 3807567165): el gatito se agarra manteniendo apretada la E mirándolo de cerca; en brazos,
// el click izquierdo lo acaricia, el derecho (o la R) lo baja, y caminar lo lleva. Mide cada paso y junta los errores de
// Lua y de JS. uso: node doudou_agarrar.mjs URL_HTML [CARPETA]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/doudou_agarrar'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
const ins = await ev(`(async () => { const A = await gmInstalar('3807567165', { nombre: 'doudou' }); if (A && A.listo) await A.listo; await new Promise((r) => setTimeout(r, 1500)); return { err: (A.luaErr || []).slice(0, 3) }; })()`);
ok('Doudou Pet se instala sin errores de Lua', !ins.err.length, ins.err);
const e0 = await ev(`GMA.errores.length`);
await ev(`spawnElegir('ents', 'gment:doudou_pet'); 1`); await p.waitForTimeout(5000);
// (el gatito, y el jugador a 1,2 m mirándolo)
const gato = `[...GMA.ents.values()].find((e) => e.clase === 'doudou_pet' && e.vivo)`;
const mirar = `(() => { const g = ${gato}; if (!g) return null; const q = gmaEntPos(g).add(v3(0, 0.15, 0)), o = vadd(JUG.pos, v3(0, 0.66, 0)), d = vsub(q, o); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); return +d.len().toFixed(2); })()`;
const hay = await ev(`!!${gato}`); ok('el gatito aparece', hay);
await ev(`(() => { const g = ${gato}, q = gmaEntPos(g), d = vsub(JUG.pos, q); d.y = 0; if (d.len() < 0.1) d.set(1, 0, 0); d.norm(); const p = vadd(q, vscale(d, 1.2)); JUG.pos.set(p.x, q.y + 0.97, p.z); JUG.vel.set(0, 0, 0); return 1; })()`);
await p.waitForTimeout(600);
await ev(`elegirArma(ARM.lista.indexOf('PhysicsGun')); 1`); await p.waitForTimeout(400);
// mantener la E mirándolo
// (primero mirarlo: el mod cuenta la E sólo si al apretarla ya lo estás mirando)
let dist = null; for (let i = 0; i < 5; i++) { dist = await ev(mirar); await p.waitForTimeout(100); }
await ev(`ENT.teclas.add('KeyE'); 1`);
for (let i = 0; i < 25; i++) { dist = await ev(mirar); await p.waitForTimeout(100); }
await ev(`ENT.teclas.delete('KeyE'); 1`); await p.waitForTimeout(1500);
let st = await ev(`(() => { const g = ${gato}; return { armas: ARM.lista.filter((a) => /doudou/.test(a)), actual: ARM.lista[ARM.i], lleva: !!(g && g.tabla.get('carriedBy')), luaActiva: GMA.jug && GMA.swep ? GMA.swep.clase : null }; })()`);
await p.screenshot({ path: D + '/1_en_brazos.png' });
await ev(`JUG.pitch = 0; 1`); await p.waitForTimeout(500); await p.screenshot({ path: D + '/1b_en_brazos_derecho.png' }); await ev(`JUG.pitch = 0.35; 1`); await p.waitForTimeout(500); await p.screenshot({ path: D + '/1c_en_brazos_abajo.png' });
ok('manteniendo la E lo agarra: queda en brazos con el arma de cargarlo en la mano', st.lleva && st.actual === 'gm:weapon_doudou_carry', { dist, ...st });
// acariciarlo (click izquierdo)
await ev(`ENT.disparo = true; 1`); await p.waitForTimeout(400); await ev(`ENT.disparo = false; 1`); await p.waitForTimeout(1200);
await p.screenshot({ path: D + '/2_caricia.png' });
st = await ev(`(() => { const g = ${gato}; return { lleva: !!(g && g.tabla.get('carriedBy')), actual: ARM.lista[ARM.i] }; })()`);
ok('click izquierdo: lo acaricia y sigue en brazos', st.lleva && st.actual === 'gm:weapon_doudou_carry', st);
// caminar con él
const p0 = await ev(`[JUG.pos.x, JUG.pos.z]`); await ev(`ENT.teclas.add('KeyW'); 1`); await p.waitForTimeout(1500); await ev(`ENT.teclas.delete('KeyW'); 1`); await p.waitForTimeout(500);
st = await ev(`(() => { const g = ${gato}, q = g ? gmaEntPos(g) : null; return { anduvo: +Math.hypot(JUG.pos.x - ${p0[0]}, JUG.pos.z - ${p0[1]}).toFixed(2), cerca: q ? +Math.hypot(q.x - JUG.pos.x, q.z - JUG.pos.z).toFixed(2) : null, lleva: !!(g && g.tabla.get('carriedBy')) }; })()`);
await p.screenshot({ path: D + '/3_caminando.png' });
ok('caminando lo lleva (el gato va con el jugador)', st.anduvo > 1 && st.lleva && st.cerca !== null && st.cerca < 1, st);
// bajarlo (click derecho)
await ev(`ENT.disparo2 = true; ENT.teclas.add('Mouse2'); 1`); await p.waitForTimeout(400); await ev(`ENT.disparo2 = false; ENT.teclas.delete('Mouse2'); 1`); await p.waitForTimeout(2500);
st = await ev(`(() => { const g = ${gato}; return { lleva: !!(g && g.tabla.get('carriedBy')), armas: ARM.lista.filter((a) => /doudou_carry/.test(a)), actual: ARM.lista[ARM.i], suelo: g ? +(gmaEntPos(g).y).toFixed(2) : null }; })()`);
await p.screenshot({ path: D + '/4_bajado.png' });
ok('click derecho: lo baja, se va el arma de cargarlo y vuelve la de antes (la Physics Gun)', !st.lleva && !st.armas.length && st.actual === 'PhysicsGun', st);
// otra vez, y bajarlo con la R
await ev(`(() => { const g = ${gato}, q = gmaEntPos(g), d = vsub(JUG.pos, q); d.y = 0; d.norm(); const p = vadd(q, vscale(d, 1.2)); JUG.pos.set(p.x, q.y + 0.97, p.z); JUG.vel.set(0, 0, 0); return 1; })()`); await p.waitForTimeout(400);
for (let i = 0; i < 5; i++) { await ev(mirar); await p.waitForTimeout(100); }
await ev(`ENT.teclas.add('KeyE'); 1`); for (let i = 0; i < 25; i++) { await ev(mirar); await p.waitForTimeout(100); } await ev(`ENT.teclas.delete('KeyE'); 1`); await p.waitForTimeout(1500);
const otra = await ev(`(() => { const g = ${gato}; return !!(g && g.tabla.get('carriedBy')); })()`);
await ev(`ENT.teclas.add('KeyR'); 1`); await p.waitForTimeout(300); await ev(`ENT.teclas.delete('KeyR'); 1`); await p.waitForTimeout(2500);
st = await ev(`(() => { const g = ${gato}; return { lleva: !!(g && g.tabla.get('carriedBy')), actual: ARM.lista[ARM.i] }; })()`);
ok('se puede volver a agarrar, y la R también lo baja', otra && !st.lleva && st.actual !== 'gm:weapon_doudou_carry', { otra, ...st });
const lua = await ev(`GMA.errores.slice(${e0})`);
ok('sin errores de Lua en todo el recorrido', !lua.length, lua.slice(0, 6));
const js = err.filter((x) => !/favicon|ERR_|net::|404|409|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !js.length, js.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
