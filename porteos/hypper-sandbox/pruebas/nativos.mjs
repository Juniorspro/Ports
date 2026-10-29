// volar, muñeco de trapo y SCP (mods nativos)
import { abrir } from './base.mjs';
const HTML = process.argv[2], SALIDA = (process.argv[3] || '.') + '/';
const D = SALIDA;
const que = process.argv[4] || 'todo';
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto=false; PREFS.mods = {volar:true, ragdoll:true, scp:true}; inicioMostrar(true); RB.mapaPartida=OFICIALES_MAPAS[0]; RB.mapaCom='megarampa'; RB.horaPartida='normal'; inicioMostrar(false); empezarPartida('FlatGrass')`);
await p.waitForTimeout(4000);
console.log('mods en el menú MOD:', await ev(`[...NAT.mods].join(',')`), 'scp al empezar:', await ev(`String(NAT.scp)`));
if (que === 'todo' || que === 'volar') {
  await ev(`natScp(false); JUG.pos.set(60, 2, 60); JUG.vel.set(0,0,0); JUG.yaw = 0; JUG.pitch = 0; natAccion('volar')`);
  await p.waitForTimeout(500);
  await ev(`ENT.teclas.add('KeyW'); ENT.teclas.add('Space')`); await p.waitForTimeout(1500); await ev(`ENT.teclas.delete('Space')`);
  const L = [];
  for (let i = 0; i < 8; i++) { await p.waitForTimeout(500); L.push(await ev(`const P=JUG.cuerpo, V=P.vuelo; JSON.stringify({y:+JUG.pos.y.toFixed(1), v:+JUG.vel.len().toFixed(1), pitch:V&&+V.px.toFixed(2), roll:V&&+V.rx.toFixed(2), ter:JUG.tercera})`)); if (i === 5) await p.screenshot({ path: D + 'v1_volar.png' }); }
  await ev(`ENT.teclas.add('KeyD'); JUG.yaw -= 0.6`); await p.waitForTimeout(700); await p.screenshot({ path: D + 'v2_volar_dobla.png' }); L.push(await ev(`JSON.stringify({roll:+JUG.cuerpo.vuelo.rx.toFixed(2)})`));
  await ev(`ENT.teclas.delete('KeyD'); ENT.teclas.delete('KeyW')`); await p.waitForTimeout(1500); await p.screenshot({ path: D + 'v3_volar_quieto.png' });
  L.push(await ev(`JSON.stringify({v:+JUG.vel.len().toFixed(1), pitch:+JUG.cuerpo.vuelo.px.toFixed(2)})`));
  console.log('volar:', L.join(' '));
  await ev(`natAccion('volar')`);
}
if (que === 'todo' || que === 'rag') {
  await ev(`JUG.pos.set(70, 2, 70); JUG.vel.set(3,0,0); natAccion('ragdoll')`); await p.waitForTimeout(2500);
  console.log('rag:', await ev(`JSON.stringify({rag: NAT.rag, cuerpo: !!JUG.cuerpo.rag, pos: JUG.pos, tercera: JUG.tercera})`));
  await p.screenshot({ path: D + 'g1_rag.png' });
  // simular que otro jugador me agarra y me lleva para arriba
  await ev(`NAT.jalado = { b: JUG.cuerpo.rag.cuerpos.get(JUG.cuerpo.D.h.Hips).b, p: vadd(JUG.pos, v3(0, 4, 0)), t: TIEMPO.t }`);
  await p.waitForTimeout(300); await ev(`NAT.jalado.t = TIEMPO.t`); await p.waitForTimeout(300);
  console.log('levantado:', await ev(`JSON.stringify({y: +JUG.pos.y.toFixed(2)})`));
  await p.screenshot({ path: D + 'g2_rag_agarrado.png' });
  await ev(`NAT.jalado = null`); await p.waitForTimeout(2000);
  await ev(`natAccion('ragdoll')`); await p.waitForTimeout(800);
  console.log('parado:', await ev(`JSON.stringify({rag: NAT.rag, cuerpoRag: !!JUG.cuerpo.rag, y: +JUG.pos.y.toFixed(2), piso: pisoBajo(JUG.pos.clone(), 0), suelo: JUG.suelo})`));
}
if (que === 'todo' || que === 'scp') {
  await ev(`natScp(true); JUG.pos.set(-25, 2, -264); JUG.vel.set(0,0,0); JUG.yaw = Math.PI/2; JUG.pitch = 0.2`); // al lado de la columna de la plataforma (x=-20, z=-254)
  await p.waitForTimeout(1500); await p.screenshot({ path: D + 's1_scp.png' });
  console.log('scp quieto:', await ev(`JSON.stringify({up:NAT.up, peg:NAT.pegado, y:+JUG.pos.y.toFixed(2), pies: JUG.cuerpo.marcha && JUG.cuerpo.marcha.pies.map(f=>f.p&&+f.p.y.toFixed(2))})`));
  await ev(`JUG.yaw = 0; JUG.pos.set(60, 2, 60)`); await p.waitForTimeout(800);
  await ev(`ENT.teclas.add('KeyW')`); const L = [];
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(500); L.push(await ev(`JSON.stringify({z:+JUG.pos.z.toFixed(1), v:+JUG.vel.len().toFixed(1), peg:NAT.pegado, paso: JUG.cuerpo.marcha.pies.map(f=>+f.t.toFixed(2))})`)); if (i === 3) await p.screenshot({ path: D + 's2_scp_camina.png' }); }
  await ev(`ENT.teclas.add('ShiftLeft')`); for (let i = 0; i < 4; i++) { await p.waitForTimeout(500); L.push(await ev(`JSON.stringify({v:+JUG.vel.len().toFixed(1)})`)); }
  await p.screenshot({ path: D + 's3_scp_corre.png' });
  await ev(`ENT.teclas.delete('ShiftLeft')`);
  console.log('scp camina:', L.join(' '));
  // trepar: ir hacia la columna de la rampa (x=-20.., z=-254) desde el costado
  await ev(`JUG.pos.set(-20 - 6, 1.1, -264); JUG.yaw = Math.PI/2; JUG.pitch = -0.4; JUG.vel.set(0,0,0); NAT.up.set(0,1,0)`); // mira hacia +x
  const C = [];
  for (let i = 0; i < 26; i++) { await p.waitForTimeout(600); C.push(await ev(`JSON.stringify({x:+JUG.pos.x.toFixed(1), y:+JUG.pos.y.toFixed(1), up:[NAT.up.x,NAT.up.y,NAT.up.z].map(v=>+v.toFixed(2)), peg:NAT.pegado})`)); if (i === 7 || i === 14 || i === 22) await p.screenshot({ path: D + `s4_scp_trepa${i}.png` }); }
  console.log('trepar:', C.join(' '));
  await ev(`ENT.teclas.delete('KeyW')`);
}
console.log('errores:', err.filter((e) => !/WebSocket|mqtt/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
await b.close();
