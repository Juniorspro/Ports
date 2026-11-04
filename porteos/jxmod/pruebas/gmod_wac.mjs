// los aviones y helicópteros WAC (base 953396297 + aviones 139224513), como un jugador: instalar (sin la base vieja que
// pide el Workshop), poner el A-10, que no tire errores de Lua, que las ruedas y el rotor queden pegados, apuntarle y
// apretar E para subir, acelerar y despegar, bajarse con F; y un helicóptero que sube con espacio.
// uso: node gmod_wac.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, CARP, DIR = '.'] = process.argv, D = DIR + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 60000 });
await ev(`window.esperaJuego = (s) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + s || performance.now() - r0 > 40000 ? ok() : setTimeout(f, 30)); f(); }); 1`);
const ins = await ev(`(async () => { const e0 = GMA.errores.length;
  const bajar = async (id) => new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/' + id + '.gma')).arrayBuffer());
  const B = await gmInstalar('953396297', { nombre: '953396297', sinDeps: true }, await bajar('953396297')); await B.listo;
  const A = await gmInstalar('139224513', { nombre: '139224513' }, await bajar('139224513')); await A.listo;
  return { addons: [...GMOD.addons.keys()], luaErr: [...(A.luaErr || []), ...(B.luaErr || [])].slice(0, 4), errs: GMA.errores.slice(e0, e0 + 4) }; })()`);
ok('instala la base actual y los aviones, sin la base vieja (104990330) ni errores de Lua', !ins.addons.includes('104990330') && !ins.luaErr.length && !ins.errs.length, ins);

// el A-10
const pon = await ev(`(async () => { const e0 = GMA.errores.length; JUG.pitch = 0.15; gmaSpawnMenu('gment:wac_pl_a10'); await esperaJuego(2);
  const e = [...GMA.ents.values()].find((x) => x.clase === 'wac_pl_a10' && x.vivo); window.__a10 = e;
  const hijos = e ? [...GMA.ents.values()].filter((x) => { let y = x, n = 0; while (y && n++ < 8) { y = gmaPadreDe(y); if (y === e) return true; } return false; }) : [];
  const off = (x) => { const q = entQ(e).conj(); const d = q.rot(vsub(gmaEntPos(x), gmaEntPos(e))); return [d.x, d.y, d.z]; };
  window.__off0 = hijos.map(off); window.__hijos = hijos;
  return { ent: !!e, cuerpo: !!(e && e.o), hijos: hijos.length, clases: [...new Set(hijos.map((x) => x.clase))], errs: GMA.errores.slice(e0, e0 + 4) }; })()`);
ok('se pone el A-10 y no tira errores de Lua (la cámara de WAC ya no falla)', pon.ent && pon.cuerpo && !pon.errs.length, pon);
ok('sus piezas (asiento, ruedas, rotor...) van pegadas al avión', pon.hijos >= 3, pon);
const quieto = await ev(`(async () => { await esperaJuego(2); const e = window.__a10; const q = entQ(e).conj();
  let max = 0; window.__hijos.forEach((x, i) => { const d = q.rot(vsub(gmaEntPos(x), gmaEntPos(e))), o = window.__off0[i]; max = Math.max(max, Math.hypot(d.x - o[0], d.y - o[1], d.z - o[2])); });
  return { corrimiento: +max.toFixed(3) }; })()`);
ok('las piezas no se despegan (corrimiento < 2 cm)', quieto.corrimiento < 0.02, quieto);
await p.screenshot({ path: D + 'wac_a10.jpg', type: 'jpeg', quality: 75 });

// subir: pararse al lado de la cabina, mirarla y apretar E (el Use de WAC elige el asiento más cercano a donde se mira)
const sube = await ev(`(async () => { const e = window.__a10, asientos = window.__hijos.filter((x) => x.clase === 'prop_vehicle_prisoner_pod');
  if (!asientos.length) return { asientos: 0 };
  const s = gmaEntPos(asientos[0]), b = e.o.b, der = b.q.rot(v3(1, 0, 0));
  const A = b.aabb, lado = Math.max(2, (A.x1 - A.x0) * 0.15);
  // (desde arriba y al costado de la cabina, mirando el asiento)
  JUG.pos.copy(vadd(s, vadd(vscale(der, 2.2), v3(0, 1.6, 0)))); JUG.vel.set(0, 0, 0); await esperaJuego(0.05);
  for (let k = 0; k < 3; k++) { const ojo = JUG.ojoPos || CAM.pos, d = vsub(s, ojo); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); JUG.pos.copy(vadd(s, vadd(vscale(der, 2.2), v3(0, 1.6, 0)))); JUG.vel.set(0, 0, 0); await esperaJuego(0.05); }
  usar(); await esperaJuego(0.5);
  const V = JUG.vehiculo && JUG.vehiculo.veh;
  const lua = gmaCorrer('dbg.lua', 'local p = LocalPlayer() local v = p:GetVehicle() return tostring(p:InVehicle()) .. " " .. tostring(IsValid(v) and v:GetClass()) .. " " .. tostring(IsValid(v) and v:GetPassenger(0) == p)');
  return { asientos: asientos.length, arriba: JUG.vehiculo === e.o, tipo: V && V.tipo, lua: String(lua) }; })()`);
ok('apuntarle a la cabina y apretar E: subís al avión (tipo avión, el Lua te ve en el asiento)', sube.arriba && sube.tipo === 'avion' && /^true prop_vehicle_prisoner_pod true$/.test(sube.lua), sube);
// despegar: acelerar (espacio) y tirar para arriba al tomar velocidad
const vuela = await ev(`(async () => { if (!JUG.vehiculo) return { sinSubir: true }; const e = window.__a10, b = e.o.b, y0 = b.pos.y, e0 = GMA.errores.length; let vmax = 0, ymax = y0;
  ENT.teclas.add('Space'); const t0 = TIEMPO.t, r0 = performance.now();
  while (TIEMPO.t - t0 < 14 && performance.now() - r0 < 90000) { await new Promise((r) => setTimeout(r, 50)); const v = Math.hypot(b.vel.x, b.vel.z); vmax = Math.max(vmax, v); ymax = Math.max(ymax, b.pos.y); if (v > 26) ENT.teclas.add('KeyS'); }
  ENT.teclas.delete('Space'); ENT.teclas.delete('KeyS');
  return { vmax: +vmax.toFixed(1), sube: +(ymax - y0).toFixed(1), motor: JUG.vehiculo ? +JUG.vehiculo.veh.motor.toFixed(2) : null, errs: GMA.errores.slice(e0, e0 + 4) }; })()`);
await p.screenshot({ path: D + 'wac_a10_vuela.jpg', type: 'jpeg', quality: 75 });
ok('acelerando, el avión toma velocidad (> 20 m/s) y despega (sube > 3 m) sin errores', vuela.vmax > 20 && vuela.sube > 3 && !vuela.errs.length, vuela);
const baja = await ev(`(async () => { salirVehiculo(); await esperaJuego(0.3); const lua = gmaCorrer('dbg.lua', 'local p = LocalPlayer() return tostring(p:InVehicle()) .. " " .. tostring(IsValid(p:GetVehicle()))'); return { veh: !!JUG.vehiculo, lua: String(lua), asiento: !!GMA.asiento }; })()`);
ok('con F te bajás y el Lua se entera (ya no estás en el asiento)', !baja.veh && baja.lua === 'false false' && !baja.asiento, baja);

// un helicóptero: subir y que suba con espacio
const heli = await ev(`(async () => { for (const x of [...GMA.ents.values()]) if (x.clase === 'wac_pl_a10') gmaQuitar(x); await esperaJuego(0.3);
  jugadorAparecer(); await esperaJuego(1.5); const e0 = GMA.errores.length;   // (de vuelta al piso: se bajó del avión en el aire)
  const cl = [...GMA.clases.keys()].find((k) => /^wac_hc_/.test(k) && k !== 'wac_hc_base' && gmaSpawneable(GMA.clases.get(k))); if (!cl) return { cl: null };
  JUG.pitch = 0.15; gmaSpawnMenu('gment:' + cl); await esperaJuego(2);
  const e = [...GMA.ents.values()].find((x) => x.clase === cl && x.vivo); if (!e || !e.o) return { cl, ent: false };
  const asiento = [...GMA.ents.values()].find((x) => x.clase === 'prop_vehicle_prisoner_pod' && x.vivo && (() => { let y = x, n = 0; while (y && n++ < 8) { y = gmaPadreDe(y); if (y === e) return true; } return false; })());
  if (!asiento) return { cl, ent: true, asiento: false };
  await esperaJuego(1.5);   // (que se apoye)
  gmaSubirAsiento(asiento); await esperaJuego(0.3);
  const b = e.o.b, y0 = b.pos.y; ENT.teclas.add('Space'); await esperaJuego(5); ENT.teclas.delete('Space');
  const r = { cl, ent: true, asiento: true, arriba: JUG.vehiculo === e.o, tipo: JUG.vehiculo && JUG.vehiculo.veh.tipo, sube: +(b.pos.y - y0).toFixed(1), errs: GMA.errores.slice(e0, e0 + 4) };
  salirVehiculo(); return r; })()`);
await p.screenshot({ path: D + 'wac_heli.jpg', type: 'jpeg', quality: 75 });
ok('un helicóptero WAC: subís, es helicóptero y con espacio sube (> 3 m en 5 s) sin errores', heli.arriba && heli.tipo === 'heli' && heli.sube > 3 && !heli.errs.length, heli);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
