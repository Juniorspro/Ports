// piano gigante y radio (mods nativos)
import { abrir } from './base.mjs';
const HTML = process.argv[2], SALIDA = (process.argv[3] || '.') + '/';
const D = SALIDA;
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto=false; PREFS.mods = {piano:true, radio:true}; inicioMostrar(true); RB.mapaPartida=null; RB.mapaCom=null; RB.horaPartida='normal'; inicioMostrar(false); empezarPartida('FlatGrass')`);
await p.waitForTimeout(4000);
console.log('mods en el menú MOD:', await ev(`[...NAT.mods].join(',')`));
await ev(`window.__notas = []; const _nt = notaTocar; notaTocar = function(hz){ window.__notas.push(Math.round(hz)); };`).catch((e) => console.log('no se pudo envolver notaTocar', e.message));
await ev(`JUG.pos.set(0, 1.6, 0); JUG.yaw = 0; JUG.pitch = 0.3; natAccion('piano')`);
await p.waitForTimeout(800);
const info = JSON.parse(await ev(`const e = ENTS.lista.find(x=>x.t==='piano'); JSON.stringify({p:e.p, W:e.W, L:e.L, n:e.teclas.length, y:pisoBajo(v3(e.p.x, 10, e.p.z+2),0)})`));
console.log('piano', JSON.stringify(info));
// caminar en tercera persona sobre las teclas, de punta a punta
await ev(`JUG.tercera = true; JUG.yaw = -Math.PI/2; const e = ENTS.lista.find(x=>x.t==='piano'); const s = entW(e, e.W/2 - 0.5, 0.35 + 1, e.L*0.3); JUG.pos.copy(s); JUG.vel.set(0,0,0)`);
await ev(`ENT.teclas.add('KeyW')`);
for (let i = 0; i < 10; i++) { await p.waitForTimeout(900); if (i === 2) await p.screenshot({ path: D + 'p1_piano.png' }); }
await ev(`ENT.teclas.delete('KeyW')`);
console.log('notas:', await ev(`JSON.stringify(window.__notas)`));
// vista de arriba del piano
await ev(`const e = ENTS.lista.find(x=>x.t==='piano'); JUG.tercera=false; JUG.noclip = true; JUG.pos.copy(entW(e, 0, 9, -7)); JUG.yaw = e.yaw; JUG.pitch = 0.75`);
await p.waitForTimeout(1200); await p.screenshot({ path: D + 'p2_piano_arriba.png' });
// un auto que pasa por arriba también toca
await ev(`window.__notas = []; JUG.noclip=false; const e = ENTS.lista.find(x=>x.t==='piano'); const o = crearObjeto('Sedan', entW(e, -e.W/2 - 4, 0.6, e.L*0.5), Quat.axis(0,1,0, e.yaw + Math.PI/2)); o.b.vel.copy(e.q.rot(v3(14,0,0)));`);
await p.waitForTimeout(3500);
console.log('notas del auto:', await ev(`JSON.stringify(window.__notas)`));
// radio
await ev(`JUG.noclip=false; JUG.pos.set(30, 1.6, 30); JUG.vel.set(0,0,0); JUG.yaw = 0; JUG.pitch = 0.25; natAccion('radio')`);
await p.waitForTimeout(800);
console.log('radio panel:', await ev(`JSON.stringify({abierto: UI.abierto, visible: !$('radioPan').classList.contains('oc'), q: $('radioQ').placeholder})`));
await p.waitForTimeout(5000);
console.log('resultados:', await ev(`JSON.stringify({n: RADIO.res.length, primero: RADIO.res[0]})`));
await p.screenshot({ path: D + 'p3_radio_panel.png' });
const n = Number(await ev(`RADIO.res.length`));
if (n) { await p.click('[data-ra="poner:0"]'); await p.waitForTimeout(4000); }
await p.waitForTimeout(6000);
console.log('radio suena (emisora en 3D):', await ev(`(() => { const e = radioMia(), S = EST.son.get(e); return JSON.stringify({vid: e.vid, suena: !!S, listo: S && S.listo, ventanitaYT: !!YT.ifr}); })()`));
await ev(`radioCerrar()`); await p.waitForTimeout(1500);
await p.screenshot({ path: D + 'p4_radio.png' });
// alejarse: baja el volumen y se corta
await ev(`JUG.pos.set(30, 1.6, 55)`); await p.waitForTimeout(1200); console.log('ganancia a 25 m:', await ev(`(() => { const S = EST.son.get(radioMia()); return S ? S.F.g.gain.value.toFixed(3) : 'sin sonido'; })()`));
await ev(`JUG.pos.set(30, 1.6, 120)`); await p.waitForTimeout(1500); console.log('a 90 m se corta:', await ev(`String(!EST.son.has(radioMia()))`));
console.log('errores:', err.filter((e) => !/WebSocket|mqtt/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
await b.close();
