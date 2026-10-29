// mega rampa: un auto baja desde arriba y se registra cada cuadro (posición, velocidad, cabeceo, ruedas apoyadas, contactos)
import { abrir } from './base.mjs';
const HTML = process.argv[2], SALIDA = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto=false; inicioMostrar(true); RB.mapaPartida = OFICIALES_MAPAS[0]; RB.mapaCom='megarampa'; RB.horaPartida='normal'; inicioMostrar(false); empezarPartida('FlatGrass')`);
await p.waitForTimeout(3000);
// arranca ya abajo en la recta empinada, a 45 m/s
await ev(`const e = ENTS.lista.find(x=>x.t==='rampa'); window.__R = e; const o = crearObjeto('Sedan', vadd(e.arriba, v3(0, 0.3, 12)), new Quat()); o.b.vel.set(0,0,8); JUG.pos.copy(vadd(o.b.pos, v3(2,0,0))); subirVehiculo(o); JUG.fpVeh=false; ENT.teclas.add('KeyW');
  window.__o = o; window.__rec = [];`);
await p.waitForTimeout(11500); for (let i = 0; i < 300; i++) { await p.waitForTimeout(60); await ev(`const e = window.__R, o = window.__o, L = entLocal(e, o.b.pos), fw = o.b.q.rot(v3(0,0,1)), cs = PH.contacts.filter(c => c.A === o.b || c.B === o.b);
  window.__rec.push([R.cuadro, +TIEMPO.t.toFixed(2), +L.x.toFixed(2), +L.z.toFixed(1), +(L.y - e.H).toFixed(2), +o.b.vel.len().toFixed(1), +(Math.atan2(-fw.y, Math.hypot(fw.x, fw.z))*57.3).toFixed(0), o.veh.ruedas.filter(w=>w.toca).length, cs.length, cs.length ? +Math.max(...cs.map(c=>c.depth)).toFixed(2) : 0, cs.map(c => c.B && c.B.tri !== undefined ? 't' + (c.B.propio?'p':'m') : c.B && c.B.estatico ? 'caja' : 'o').join('').slice(0,12), JUG.vehiculo ? 'dentro' : 'FUERA', JUG.vivo ? 'vivo' : 'MUERTO', o.veh.roto ? 'ROTO' : '', o.veh.vida|0]); 0`); }
const r = JSON.parse(await ev(`JSON.stringify(window.__rec)`));
console.log('n', r.length, 'fallo', await ev(`String(window.__fallo || '')`)); console.log('cuadro t x z y v cabeceo ruedas contactos hondo tipos');
for (const x of r.filter((x) => x[3] > 145 && x[3] < 240)) console.log(x.join(' '));
console.log('perfil curva:', await ev(`JSON.stringify(window.__R.perfil.filter(q=>q.z>150 && q.z<170).map(q=>[+q.z.toFixed(1), +q.y.toFixed(1), +(q.ang*57.3).toFixed(0)]))`));
console.log('errores:', err.filter((e) => !/WebSocket|mqtt/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
await b.close();
