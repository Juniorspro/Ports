// multijugador con mods nativos (dos jugadores y uno que llega tarde, broker local): SCP, volar, muñeco agarrado por otro, piano y radio compartidos
import { createRequire } from 'module'; import http from 'http';
import { createRequire as _cr } from 'module'; const { chromium } = _cr(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '.', req = createRequire(S + '/mc/broker/package.json'); // carpeta con mc/broker (aedes + ws)
const html = process.argv[2], D = (process.argv[3] || '.') + '/';
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8897, '127.0.0.1', r));
const navs = [], errs = [];
const abrir = async (n) => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] }); navs.push(b);
  const c = await b.newContext({ viewport: { width: 800, height: 450 } }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160)));
  await p.goto('file://' + html + '?test&broker=ws://127.0.0.1:8897/mqtt'); await p.waitForFunction(() => window.__listo, null, { timeout: 150000 }); return p; };
const ev = (p, c) => p.evaluate((c) => window.__ev(c), c), espera = (ms) => new Promise((r) => setTimeout(r, ms));
const A = await abrir('A'), B = await abrir('B');
for (const [P, n] of [[A, 'Ana'], [B, 'Beto']]) await ev(P, `PREFS.nombre='${n}'; PREFS.bienvenida=true; PREFS.mods = {volar:true, ragdoll:true, scp:true, piano:true, radio:true}; audioIniciar(); inicioMostrar(false); entrarSala(SALAS_OF.find((s) => s.m === 'FlatGrass')); 1`);
await espera(6000);
await ev(B, `natScp(false); JUG.pos.set(10, 1.6, 10); JUG.yaw = Math.PI; 1`);
await ev(A, `JUG.pos.set(10, 1.6, 4); JUG.yaw = 0; JUG.vel.set(0,0,0); 1`);
await espera(2500);
console.log('se ven:', await ev(A, "[...RED.remotos.values()].map(r=>r.nombre).join(',')"), '/', await ev(B, "[...RED.remotos.values()].map(r=>r.nombre).join(',')"));
console.log('A es SCP:', await ev(A, 'NAT.scp'), '· B lo ve en 4 patas:', await ev(B, "(() => { const R2 = [...RED.remotos.values()][0]; return JSON.stringify({cuad: !!R2.P.cuad, marcha: !!R2.P.marcha, up: R2.up && [R2.up.x, R2.up.y, R2.up.z].map(v=>+v.toFixed(2))}); })()"));
await ev(B, `JUG.tercera = false; JUG.pitch = 0.2; 1`); await espera(800); await B.screenshot({ path: D + 'm1_B_ve_scp.png' }); await ev(A, `ENT.teclas.add('KeyW'); 1`); await espera(1500); await B.screenshot({ path: D + 'm1b_B_ve_scp_camina.png' }); await ev(A, `ENT.teclas.delete('KeyW'); JUG.pos.set(10, 1.6, 4); 1`);
// A vuela
await ev(A, `natScp(false); natVolar(true); JUG.yaw = Math.PI/2; ENT.teclas.add('KeyW'); 1`); await espera(2000); await B.screenshot({ path: D + 'm1c_B_ve_volar.png' }); await espera(500);
console.log('B ve volar:', await ev(B, "(() => { const P = [...RED.remotos.values()][0].P; return JSON.stringify({inclin: !!P.inclin, pitch: P.vuelo && +P.vuelo.px.toFixed(2)}); })()"));
await ev(A, `ENT.teclas.delete('KeyW'); natVolar(false); JUG.pos.set(10, 1.6, 4); JUG.vel.set(0,0,0); 1`); await espera(1500);
// A se tira como muñeco; B lo agarra con la pistola de física y lo lleva hacia arriba
await ev(A, `natRag(true); 1`); await espera(2500);
console.log('A rag:', await ev(A, 'JSON.stringify({rag: NAT.rag, cuerpo: !!(JUG.cuerpo && JUG.cuerpo.rag), bits: natBits(), vivo: JUG.vivo, veh: !!JUG.vehiculo, volando: NAT.volando})'), 'B f:', await ev(B, '[...RED.remotos.values()][0].f'));
console.log('B ve muñeco:', await ev(B, "(() => { const R2 = [...RED.remotos.values()][0]; return JSON.stringify({rag: !!R2.P.rag, noRay: R2.b.noRay}); })()"));
const yA0 = await ev(A, 'JUG.pos.y');
await ev(B, `const P = [...RED.remotos.values()][0].P, hb = P.rag.cuerpos.get(P.D.h.Hips).b; ARM.i = ARM.lista.indexOf('PhysicsGun'); ARM.agarre = { b: hb, dist: 4, rl: v3(), qrel: new Quat() }; hb.held = true; JUG.pitch = -0.9; ENT.disparo = true; ARM.fisAnt = true; 1`);
await espera(1500);
console.log('B apunta:', await ev(B, 'JSON.stringify({cam:[CAM.pos.x,CAM.pos.y,CAM.pos.z].map(v=>+v.toFixed(1)), fwd:[CAM.fwd.x,CAM.fwd.y,CAM.fwd.z].map(v=>+v.toFixed(2)), hb: (()=>{const b=ARM.agarre&&ARM.agarre.b; return b?[b.pos.x,b.pos.y,b.pos.z].map(v=>+v.toFixed(1)):null})(), jalo: !!NAT.jalo})'), 'A recibe:', await ev(A, 'JSON.stringify(NAT.jalado ? {p:[NAT.jalado.p.x,NAT.jalado.p.y,NAT.jalado.p.z].map(v=>+v.toFixed(1)), b:[NAT.jalado.b.pos.x,NAT.jalado.b.pos.y,NAT.jalado.b.pos.z].map(v=>+v.toFixed(1)), dt: +(TIEMPO.t - NAT.jalado.t).toFixed(2)} : null)'));
for (let i = 0; i < 6; i++) { await espera(250); console.log('  A:', await ev(A, 'JSON.stringify((() => { const P = JUG.cuerpo, hb = P.rag && P.rag.cuerpos.get(P.D.h.Hips).b; return {hb: hb && [hb.pos.x,hb.pos.y,hb.pos.z].map(v=>+v.toFixed(2)), v: hb && [hb.vel.x,hb.vel.y,hb.vel.z].map(v=>+v.toFixed(1)), dt: NAT.jalado ? +(TIEMPO.t - NAT.jalado.t).toFixed(2) : null, rag: NAT.rag, misma: NAT.jalado ? NAT.jalado.b === hb : null, enPH: hb ? PH.bodies.includes(hb) : null, t: +TIEMPO.t.toFixed(2)}; })())')); }
console.log('A visible:', await ev(A, 'document.visibilityState'), 'B visible:', await ev(B, 'document.visibilityState'), 'A cuadros:', await ev(A, 'R.cuadro'), 'estado A:', await ev(A, 'JUEGO.estado + "/" + UI.abierto + "/" + MODS.tiempo'));
await espera(1000); console.log('A cuadros 1 s después:', await ev(A, 'R.cuadro'), 'B cuadros:', await ev(B, 'R.cuadro'));
console.log('A levantado por B: y', (+yA0).toFixed(2), '→', (+(await ev(A, 'JUG.pos.y'))).toFixed(2), '· jalado:', await ev(A, '!!NAT.jalado'));
await B.screenshot({ path: D + 'm2_B_agarra.png' }); await A.screenshot({ path: D + 'm3_A_agarrado.png' });
await ev(B, `ENT.disparo = false; 1`); await espera(1500);
console.log('suelto:', await ev(A, '!!NAT.jalado'));
await ev(A, `natRag(false); 1`); await espera(1000);
// A pone un piano y una radio; B los tiene que ver
await ev(A, `JUG.pos.set(0, 1.6, -20); JUG.yaw = 0; natAccion('piano'); 1`); await espera(800);
await ev(A, `JUG.pos.set(20, 1.6, -20); natAccion('radio'); radioPoner(RADIO.e, 'dQw4w9WgXcQ', 0, 'Prueba', true); radioCerrar(); 1`); await espera(2500);
console.log('B ve entidades de A:', await ev(B, "JSON.stringify(ENTS.lista.map(e => [e.t, e.dueno !== 'yo', e.vid || '']))"));
// una tercera persona que entra tarde también las recibe (por el mundo guardado)
const C = await abrir('C'); await ev(C, `PREFS.nombre='Caro'; PREFS.bienvenida=true; PREFS.mods = {}; entrarSala(SALAS_OF.find((s) => s.m === 'FlatGrass')); 1`); await espera(14000);
console.log('C remotos:', await ev(C, "[...RED.remotos.values()].map(r=>r.nombre).join(',')"), 'C objs remotos:', await ev(C, 'RED.objs.size'), 'A publica e:', await ev(A, 'JSON.stringify(entidadesMias().map(x=>x.d.t))'));
console.log('C (llegó tarde) ve:', await ev(C, "JSON.stringify(ENTS.lista.map(e => [e.t, e.vid || '']))"));
// A se va: las entidades de A desaparecen para B
await ev(A, `irMenuPrincipal(); 1`); await espera(3000);
console.log('A se fue; B ve:', await ev(B, "JSON.stringify(ENTS.lista.map(e => e.t))"));
console.log('errores:', errs.join(' | ') || 'ninguno');
for (const x of navs) await x.close(); srv.close(); process.exit(0);
