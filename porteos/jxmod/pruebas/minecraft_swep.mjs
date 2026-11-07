// El Minecraft SWEP (Workshop 116592647, Discord: «Compatibilidad con minecraft swep»): clic derecho pone un bloque en la
// grilla de 36,5 unidades (alineada con el cero del mapa), clic izquierdo lo saca. En el Pasto plano los bloques quedaban
// 40 cm en el aire (el piso estaba en z = 20,87 de Source), la mira pasaba por debajo y no se podían apilar ni sacar. Con
// el arma en la mano, en primera persona:
//  1. el cero de Source: en los mapas propios, el piso de la aparición (Pasto plano ≠ 0); en los de GMod, el del mapa (0);
//  2. clic derecho al pasto: un bloque apoyado en el piso (≤ 1 cm) y en la grilla (centro en k·36,5 + 18,25); antes
//     quedaba en el aire (se mide igual con el cero de antes);
//  3. clic derecho a la cara de arriba: otro bloque encima, justo (≤ 1 cm) y en la misma columna;
//  4. clic derecho a una cara del costado: un bloque al lado, en el piso;
//  5. clic izquierdo al bloque de arriba: se saca (y los demás quedan); clic izquierdo al pasto no saca nada;
//  6. el arma se llama «Minecraft SWEP» (el nombre del lado del cliente, como el selector de GMod) y se ve el bloque en la mano;
//  7. las cuentas del Lua siguen bien con el cero nuevo: SetPos(GetPos()) no mueve, LocalToWorld/WorldToLocal, la caja
//     local (OBBMins/OBBMaxs), SetVelocity/GetVelocity sin corrimiento y una traza hacia abajo que da en la cara de arriba;
//  8. sin errores de Lua ni de JS.
// uso: node minecraft_swep.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, G, D = '/tmp/claude-0/minecraft_swep'] = process.argv;
fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 1400) : '')); };
const { b, p, ev, err } = await abrir(HTML + '?test', false);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
await p.waitForTimeout(1500);
// 1: el cero de Source
const cero = await ev(`(() => { const s = MUNDO.spawns[0], piso = pisoBajo(s, 1.5), oy = GMA.oy; gmaOrigenMapa('RB_Construct'); const c = GMA.oy; gmaOrigenMapa('gm_construct'); const w = GMA.oy; gmaOrigenMapa(MUNDO.nombre); return { mapa: MUNDO.nombre, oy: +oy.toFixed(4), piso: +piso.toFixed(4), construct: c, workshop: w, despues: +GMA.oy.toFixed(4) }; })()`);
ok('1. el cero de Source: el piso en el Pasto plano, 0 en los mapas de GMod', cero.oy > 0.1 && Math.abs(cero.oy - cero.piso) < 1e-3 && cero.construct === 0 && cero.workshop === 0 && cero.despues === cero.oy, cero);
const e0 = await ev(`GMA.errores.length`);
const inst = await ev(`(async () => { const u = new Uint8Array(await (await fetch(${JSON.stringify(G)} + '/116592647.gma')).arrayBuffer()); const A = await gmInstalar('116592647', { nombre: 'Minecraft SWEP', sinDeps: true }, u); await A.listo; return { sweps: A.sweps, luaErr: (A.luaErr || []).slice(0, 4) }; })()`);
console.log('instalado', JSON.stringify(inst));
await ev(`(() => { gmaDarArma('minecraft_swep'); elegirArma(ARM.lista.indexOf('gm:minecraft_swep')); JUG.tercera = false; return 1; })()`);
await p.waitForTimeout(1200);
// los bloques: la posición del Lua (Source) y la caja del cuerpo en el juego
const BLOQ = `(() => [...GMA.ents.values()].filter((e) => e.clase === 'minecraft_block' && e.vivo !== false).map((e) => { const q = gmaEntPos(e), s = vS(q), a = e.o && e.o.b && e.o.b.aabb; return { id: e.id, x: +s.x.toFixed(3), y: +s.y.toFixed(3), z: +s.z.toFixed(3), g: [q.x, q.y, q.z].map((v) => +v.toFixed(4)), y0: a ? +a.y0.toFixed(4) : null, y1: a ? +a.y1.toFixed(4) : null, piso: +(pisoBajo(v3(q.x, q.y + 0.05, q.z), 0.04) ?? NaN).toFixed(4) }; }))()`;
const apuntar = (x, y, z) => ev(`(() => { const o = gmaOjo(), d = vsub(v3(${x}, ${y}, ${z}), o); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = Math.atan2(-d.y, Math.hypot(d.x, d.z)); return 1; })()`);
const clic = async (der) => { const k = der ? 'disparo2' : 'disparo'; await ev(`(() => { ENT.${k} = true; return 1; })()`); await p.waitForTimeout(220); await ev(`(() => { ENT.${k} = false; return 1; })()`); await p.waitForTimeout(700); };
const S = await ev(`(() => { const o = gmaOjo(); return { x: o.x, y: o.y, z: o.z, oy: GMA.oy }; })()`);
const GS = 0.0254, H = 36.5 * GS;
// 2 (antes): con el cero de antes (el del mapa), el bloque queda en el aire
await ev(`(() => { GMA.oy = 0; return 1; })()`);
await apuntar(S.x + 1.2, S.oy, S.z + 3.2); await p.waitForTimeout(300); await clic(true);
const antes = await ev(BLOQ);
const aireAntes = antes.length ? +(antes[0].y0 - antes[0].piso).toFixed(3) : null;
await ev(`(() => { for (const e of [...GMA.ents.values()]) if (e.clase === 'minecraft_block') GMA.metas.Entity.get('Remove')(e); GMA.oy = ${S.oy}; return 1; })()`); await p.waitForTimeout(500);
// 2: al pasto
await apuntar(S.x, S.oy, S.z + 3.2); await p.waitForTimeout(300); await clic(true);
const b1 = await ev(BLOQ);
const enGrilla = (B) => [B.x, B.y].every((v) => Math.abs(((v - 18.25) / 36.5) - Math.round((v - 18.25) / 36.5)) < 1e-3) && Math.abs(B.z / 36.5 - Math.round(B.z / 36.5)) < 1e-3;
const A1 = b1[0];
ok('2. clic derecho al pasto: un bloque apoyado en el piso (≤ 1 cm) y en la grilla de 36,5', b1.length === 1 && Math.abs(A1.y0 - A1.piso) <= 0.01 && Math.abs(A1.z) < 0.01 && enGrilla(A1), { bloque: A1, aireCm: A1 ? +((A1.y0 - A1.piso) * 100).toFixed(2) : null, antesAireCm: aireAntes !== null ? +(aireAntes * 100).toFixed(1) : null });
await p.screenshot({ path: `${D}/1_piso.png` });
// 3: arriba
await apuntar(A1.g[0], A1.g[1] + H, A1.g[2]); await p.waitForTimeout(300); await clic(true);
const b2 = await ev(BLOQ), A2 = b2.find((x) => x.id !== A1.id);
ok('3. clic derecho a la cara de arriba: otro bloque encima, justo y en la misma columna', b2.length === 2 && A2 && Math.abs(A2.x - A1.x) < 0.01 && Math.abs(A2.y - A1.y) < 0.01 && Math.abs(A2.z - 36.5) < 0.01 && Math.abs(A2.y0 - A1.y1) <= 0.01, { arriba: A2, abajo: A1 });
// 4: al costado (la cara que mira al jugador)
const lado = await ev(`(() => { const o = gmaOjo(), c = v3(${A1.g[0]}, ${A1.g[1] + H / 2}, ${A1.g[2]}), d = vsub(o, c); d.y = 0; const ax = Math.abs(d.x) > Math.abs(d.z) ? v3(Math.sign(d.x), 0, 0) : v3(0, 0, Math.sign(d.z)); return { x: c.x + ax.x * ${H / 2}, y: c.y - 0.12, z: c.z + ax.z * ${H / 2} }; })()`);
await apuntar(lado.x, lado.y, lado.z); await p.waitForTimeout(300); await clic(true);
const b3 = await ev(BLOQ), A3 = b3.find((x) => x.id !== A1.id && x.id !== A2?.id);
const vecino = A3 && Math.abs(A3.z) < 0.01 && Math.abs(Math.hypot(A3.x - A1.x, A3.y - A1.y) - 36.5) < 0.01;
ok('4. clic derecho a una cara del costado: un bloque al lado, en el piso', b3.length === 3 && vecino && Math.abs(A3.y0 - A3.piso) <= 0.01, { lado: A3 });
await p.screenshot({ path: `${D}/2_tres.png` });
// 5: sacar el de arriba; el pasto no saca nada
await apuntar(A2.g[0], A2.g[1] + H, A2.g[2]); await p.waitForTimeout(300); await clic(false); await p.waitForTimeout(400);
const b4 = await ev(BLOQ);
await apuntar(S.x - 1.5, S.oy, S.z + 2.5); await p.waitForTimeout(300); await clic(false); await p.waitForTimeout(400);
const b5 = await ev(BLOQ);
ok('5. clic izquierdo al bloque de arriba: se saca y los otros quedan; al pasto, no saca nada', b4.length === 2 && !b4.find((x) => x.id === A2.id) && b5.length === 2, { trasSacar: b4.map((x) => x.id), trasPasto: b5.map((x) => x.id) });
await p.screenshot({ path: `${D}/3_sacado.png` });
// 6: el nombre y el bloque en la mano
const mano = await ev(`(() => { const d = DEF_ARMAS['gm:minecraft_swep']; return { nom: d && d.nom, vm: GMA.swep && GMA.swep.vm, actual: ARM.lista[ARM.actual] }; })()`);
ok('6. el arma se llama «Minecraft SWEP» y tiene el bloque como modelo en la mano', mano.nom === 'Minecraft SWEP' && /dirt\.mdl$/i.test(String(mano.vm || '')), mano);
// 7: las cuentas del Lua con el cero nuevo
const cuentas = await ev(`(() => {
  // (lo que devuelve el Lua, por su print)
  const L = (s) => { let out; const s0 = GMA.R.salida; GMA.R.salida = (t) => { out = String(t); }; try { gmaEnLado('S', () => GMA.R.G.get('RunString')('print((function() ' + s + ' end)())', 'prueba')); } finally { GMA.R.salida = s0; } return out; };
  const r = L(\`local e = ents.FindByClass('minecraft_block')[1]; local p = e:GetPos(); e:SetPos(p); local p2 = e:GetPos();
    local lw = e:LocalToWorld(Vector(0, 0, 0)); local wl = e:WorldToLocal(p); local mn, mx = e:OBBMins(), e:OBBMaxs();
    local tr = util.TraceLine({ start = p + Vector(0, 0, 200), endpos = p - Vector(0, 0, 10) });
    return string.format('%.4f|%.4f|%.4f|%.4f|%.4f|%.4f|%.2f,%.2f,%.2f|%.2f,%.2f,%.2f|%.3f|%s', (p2 - p):Length(), (lw - p):Length(), wl:Length(), p.z, tr.HitPos.z, tr.HitPos.z - p.z, mn.x, mn.y, mn.z, mx.x, mx.y, mx.z, 0, tostring(tr.Entity == e))\`);
  const c = crearObjeto('CajaMadera', vadd(JUG.pos, v3(2, 2, 0)), Quat.euler(0, 0)); const le = c ? GMA.entPorObj.get(c) || (typeof entDeObj === 'function' ? entDeObj(c) : null) : null;
  let vel = null; if (le) { GMA.R.G.set('__jxe', le); const v = L('local e = __jxe; e:GetPhysicsObject():SetVelocity(Vector(0, 0, 100)); return tostring(e:GetPhysicsObject():GetVelocity().z) .. "|" .. tostring(e:GetVelocity().z)'); vel = { lua: String(v), juego: +c.b.vel.y.toFixed(4) }; borrarObjeto(c); }
  return { r: String(r), vel };
})()`);
const [mov, lwd, wld, pz, hz, dz, mn, mx, , golpe] = cuentas.r.split('|');
const velLua = cuentas.vel ? cuentas.vel.lua.split('|').map(Number) : [NaN, NaN];
ok('7. las cuentas del Lua siguen bien: SetPos(GetPos), LocalToWorld/WorldToLocal, la caja local, la velocidad y una traza', +mov < 0.01 && +lwd < 0.01 && +wld < 0.01 && Math.abs(+dz - 36.5) < 0.05 && golpe === 'true' && mn === '-18.25,-18.25,0.00' && mx === '18.25,18.25,36.50' && cuentas.vel && Math.abs(cuentas.vel.juego - 2.54) < 0.01 && Math.abs(velLua[0] - 100) < 0.5, { mueve: +mov, lw: +lwd, wl: +wld, pz: +pz, trazaArribaZ: +hz, alto: +dz, mn, mx, golpeaElBloque: golpe, vel: cuentas.vel });
const le2 = await ev(`GMA.errores.slice(${e0}).map((x) => String(x.msg || x).slice(0, 200))`);
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|CORS|shader simplificado|willReadFrequently|\[GMod\]/i.test(x));
ok('8. sin errores de Lua ni de JS', !le2.length && !e.length && !(inst.luaErr || []).length, { lua: le2.slice(0, 4), js: e.slice(0, 4) });
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
