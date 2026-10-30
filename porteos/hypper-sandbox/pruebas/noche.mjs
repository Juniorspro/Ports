// la noche en la pizzería: animatrónicos, puertas (que choquen), luces, cámaras, linterna, apagón, susto y las 6
// uso: node noche.mjs HTML CARPETA [calidad]
import { abrir } from './base.mjs';
const HTML = process.argv[2], S = (process.argv[3] || '.') + '/', CAL = process.argv[4] || 'medio';
const { b, p, err, ev } = await abrir(HTML);
const foto = async (n) => { await p.waitForTimeout(900); await p.screenshot({ path: S + 'n_' + n + '.png' }); };
const J = async (s) => JSON.parse(await ev(`JSON.stringify(${s})`));
await ev(`PREFS.bienvenida = true; GFX.auto=false; PREFS.calidad='${CAL}'; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Pizzeria')`);
await p.waitForTimeout(3000);
console.log('arranque', await J(`{on: NOC.on, ctl: NOC.ctl, estado: NOC.estado, anims: NOC.anim.map(a => [a.nom, a.nodo, a.clip, a.nb]), armas: ARM.lista, puertas: Object.keys(NOC.mdP).filter(k => NOC.mdP[k]), botones: nocheBotones().map(x => x.que + '_' + x.lado)}`));
// los cuatro en el escenario y en la cueva, vistos desde el comedor
await ev(`JUG.noclip = true; JUG.pos.set(1.5, 1.6, 0); JUG.yaw = Math.PI/2; JUG.pitch = 0.05; NOC.linterna = true; 0`); await foto('escenario');
await ev(`NOC.linterna = false; JUG.pos.set(-1.5, 1.6, -4); JUG.yaw = Math.PI; JUG.pitch = 0.05; 0`); await foto('cueva');
// la oficina: puerta izquierda cerrada, luz derecha prendida y Bonnie en la esquina derecha
await ev(`JUG.noclip = false; JUG.pos.set(-23.4, 1.4, 0); JUG.vel.set(0,0,0); JUG.yaw = Math.PI/2 - 0.6; JUG.pitch = 0.05; NOC.estado='juega'; NOC.quieta = true; 0`); await p.waitForTimeout(800);
await ev(`nocheBoton('puerta','izq'); nocheBoton('luz','der'); const B = NOC.anim[1]; nocheAnimA(B, 'nd'); B.yaw = Math.PI; B.estado='quieto'; 0`);
await p.waitForTimeout(1600);
console.log('oficina', await J(`{pk: NOC.pk, puerta: NOC.puerta, luz: NOC.luz, uso: nocheUso(), poder: +NOC.poder.toFixed(2), cuerpo: NOC.cuerpoP.izq.pos.y.toFixed(2)}`));
await ev(`JUG.yaw = 0.05; JUG.pitch = 0.1; 0`); await foto('puerta_der_luz');
await ev(`JUG.yaw = Math.PI - 0.05; JUG.pitch = 0.1; 0`); await foto('puerta_izq_cerrada');
// la puerta cerrada choca: caminar hacia ella desde adentro no la atraviesa
await ev(`JUG.pos.set(-22.4, 1.4, -1.2); JUG.vel.set(0,0,0); JUG.yaw = Math.PI; ENT.teclas.add('KeyW'); 0`); await p.waitForTimeout(1800); await ev(`ENT.teclas.delete('KeyW'); 0`);
console.log('choque puerta cerrada: z =', await J(`+JUG.pos.z.toFixed(2)`), '(la puerta está en -2.13)');
await ev(`nocheBoton('puerta','izq'); 0`); await p.waitForTimeout(800);
await ev(`JUG.pos.set(-22.4, 1.4, -1.2); JUG.vel.set(0,0,0); JUG.yaw = Math.PI; ENT.teclas.add('KeyW'); 0`); await p.waitForTimeout(1800); await ev(`ENT.teclas.delete('KeyW'); 0`);
console.log('puerta abierta: z =', await J(`+JUG.pos.z.toFixed(2)`));
// apuntar a un botón y usar con E
await ev(`JUG.pos.set(-23.3, 1.4, -1.3); JUG.vel.set(0,0,0); const bt = nocheBotones().find(x => x.que==='puerta' && x.lado==='izq'); const d = vsub(bt.p, vadd(JUG.pos, v3(0, JUG.ojo, 0))); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = Math.asin(-d.y / d.len()); 0`);
await p.waitForTimeout(500);
console.log('apuntando', await J(`{txt: $('usarTxt').textContent, ap: (nocheApuntado()||{}).que}`));
await ev(`usar(); 0`); await p.waitForTimeout(300); console.log('después de E', await J(`NOC.puerta`)); await ev(`nocheBoton('puerta','izq'); nocheBoton('luz','der'); 0`);
// cámaras: cada una
await ev(`nocheTablet(); 0`);
for (let i = 0; i < 10; i++) { await ev(`nocheCamElegir(${i}); 0`); await foto('cam' + i); }
console.log('cámara', await J(`{cam: NOC.cam, abierto: UI.abierto, mirando: NOC.mirando}`));
await ev(`nocheTablet(); 0`); await p.waitForTimeout(400);
console.log('cámaras cerradas', await J(`{cam: NOC.cam, abierto: UI.abierto}`));
// linterna en el pasillo oscuro
await ev(`JUG.noclip = true; JUG.pos.set(-12, 1.6, -3); JUG.yaw = Math.PI/2; JUG.pitch = 0.1; NOC.linterna = false; 0`); await foto('pasillo_sin');
await ev(`nocheLinterna(); 0`); await foto('pasillo_linterna');
// la IA: caminan solos (noche alta para que se muevan rápido)
await ev(`NOC.quieta = false; NOC.linterna = false; JUG.noclip = false; JUG.pos.set(-23.4, 1.4, 0); NOC.noche = 6; for (const A of NOC.anim) A.tMov = 0; 0`);
for (let i = 0; i < 6; i++) { await p.waitForTimeout(2500); console.log('t', i, await J(`NOC.anim.map(a => a.nom[0] + ':' + a.nodo + '/' + a.estado + '/' + a.clip)`)); }
// susto
await ev(`NOC.quieta = true; JUG.yaw = Math.PI/2; JUG.pitch = 0; nocheSusto('Freddy'); 0`); await p.waitForTimeout(500); await p.screenshot({ path: S + 'n_susto.png' });
await p.waitForTimeout(2600); await p.screenshot({ path: S + 'n_estatica.png' });
await p.waitForTimeout(3000); console.log('después del susto', await J(`{susto: !!NOC.susto, abierto: UI.abierto}`));
// apagón
await ev(`NOC.quieta = false; NOC.fuera.clear(); NOC.estado='juega'; NOC.poder = 0.05; for (const A of NOC.anim) { nocheAnimA(A, A.ruta[0]); A.estado='quieto'; } 0`); await p.waitForTimeout(5000);
console.log('apagón', await J(`{estado: NOC.estado, freddy: NOC.anim[0].nodo, puertas: NOC.puerta}`));
await ev(`JUG.pos.set(-23.4, 1.4, 0); JUG.yaw = Math.PI - 0.3; 0`); await foto('apagon');
// las 6
await ev(`NOC.susto = null; NOC.ui.susto.classList.add('oc'); UI.abierto = null; NOC.estado='juega'; NOC.poder=50; NOC.fuera.clear(); NOC.hora = 5.995; 0`); await p.waitForTimeout(2000);
console.log('6 AM', await J(`{estado: NOC.estado, noche: NOC.noche, cartel: NOC.ui.cartel.textContent}`)); await foto('6am');
console.log('errores:', err.filter((e) => !/WebSocket|mqtt/i.test(e)).slice(0, 10).join(' | ') || 'ninguno');
await b.close();
