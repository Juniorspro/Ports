// SCP visto de costado y de frente (quieto, caminando, corriendo), y volar de costado
import { abrir } from './base.mjs';
const HTML = process.argv[2], SALIDA = (process.argv[3] || '.') + '/';
const D = SALIDA;
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto=false; PREFS.mods = {volar:true, scp:true}; inicioMostrar(true); RB.mapaPartida=null; RB.mapaCom=null; RB.horaPartida='normal'; inicioMostrar(false); empezarPartida('FlatGrass')`);
await p.waitForTimeout(3500);
// cámara fija al costado del jugador (a 3,5 m), mirando hacia él
const lado = (dx, dy, dz) => ev(`const c = v3(JUG.pos.x + ${dx}, JUG.pos.y + ${dy}, JUG.pos.z + ${dz}), d = vsub(JUG.pos, c).norm(); DBG.cam = { p: c, q: Quat.euler(Math.atan2(d.x, d.z), -Math.asin(d.y)) }`);
await ev(`JUG.pos.set(40, 1.2, 40); JUG.yaw = 0; JUG.vel.set(0,0,0)`); await p.waitForTimeout(1500);
await lado(3.2, 0.6, 0.4); await p.waitForTimeout(700); await p.screenshot({ path: D + 'q1_quieto_costado.png' });
await lado(0.4, 0.5, 3.2); await p.waitForTimeout(700); await p.screenshot({ path: D + 'q2_quieto_frente.png' });
await ev(`ENT.teclas.add('KeyW')`);
for (let i = 0; i < 4; i++) { await p.waitForTimeout(250); await lado(3.4, 0.6, 0.5); }
await p.screenshot({ path: D + 'q3_camina_costado.png' }); await p.waitForTimeout(180); await lado(3.4, 0.6, 0.5); await p.screenshot({ path: D + 'q4_camina_costado2.png' });
await ev(`ENT.teclas.add('ShiftLeft')`); for (let i = 0; i < 6; i++) { await p.waitForTimeout(200); await lado(3.6, 0.7, 1.2); }
await p.screenshot({ path: D + 'q5_corre_costado.png' });
await ev(`ENT.teclas.delete('ShiftLeft'); ENT.teclas.delete('KeyW'); natScp(false); natVolar(true); JUG.pos.y += 3`); await p.waitForTimeout(400);
await ev(`ENT.teclas.add('KeyW')`); for (let i = 0; i < 10; i++) { await p.waitForTimeout(250); await lado(4.5, 0.8, 1.5); }
await p.screenshot({ path: D + 'q6_vuela_costado.png' });
await ev(`ENT.teclas.delete('KeyW')`); for (let i = 0; i < 8; i++) { await p.waitForTimeout(250); await lado(4.5, 0.4, 1.5); }
await p.screenshot({ path: D + 'q7_vuela_frena.png' });
console.log('errores:', err.filter((e) => !/WebSocket|mqtt/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
await b.close();
