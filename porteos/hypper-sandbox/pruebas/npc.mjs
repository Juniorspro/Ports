// NPC con actitud (Tool Gun → Actitud): ponerlo con la herramienta (queda parado en el piso); el lector local entiende
// frases en varios idiomas; persigue y pega (te baja la vida), huye, sigue, baila, rodea un contenedor para llegar; los
// tiros lo lastiman y lo matan (muñeco); la patada lo tira y se levanta solo; la Physics Gun lo levanta y al soltarlo
// cae; la IA gratis contesta una actitud que sirve; el panel con lo escrito (Enter) cambia la actitud; en la red: un NPC
// de otro aparece, se mueve y el golpe le llega al dueño; 12 NPC persiguiendo cuestan poco por cuadro; sin errores.
// uso: node npc.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(process.argv[2]);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 15000 });
await ev(`JUEGO.dios = false; JUG.vida = 100; 1`);
// 1) ponerlo con la herramienta
const hi = await ev(`DATA.herr.findIndex((h) => h.n === 'Actitud')`);
await ev(`equiparHerramienta(${hi}); JUG.yaw = 0; JUG.pitch = 0.5; 1`); await p.waitForTimeout(400);
await ev(`NPC.act = npcActNormal({ modo: 'quieto' }); herramientaUsar(false); 1`); await p.waitForTimeout(1500);
const pu = await ev(`(() => { const P = NPC.lista[0]; if (!P) return null; const piso = pisoBajo(P.pos, 0.5); return { n: NPC.lista.length, skin: P.skin, suelo: P.suelo, pies: +(P.pos.y - 0.95 - piso).toFixed(3), d: +Math.hypot(P.pos.x - JUG.pos.x, P.pos.z - JUG.pos.z).toFixed(2) }; })()`);
ok('la Tool Gun (Actitud) pone un NPC adelante, parado en el piso', pu && pu.n === 1 && pu.suelo && Math.abs(pu.pies) < 0.08 && pu.d > 1 && pu.d < 8, pu);
// 2) el lector local
const lec = await ev(`(() => { const f = (t) => { const a = npcActDeTexto(t); return [a.modo, a.hostil, a.vel, a.obj, a.emote]; };
  return { a: f('agresivo que nos persiga corriendo'), b: f('aggressive, chase us running'), c: f('que me siga a todos lados'), d: f('tiene miedo y huye'), e: f('baila techno'), g: f('guardia que cuida la puerta'), h: f('follow me') }; })()`);
ok('el lector local entiende frases (es/en): persigue agresivo corriendo, me sigue, huye, baila, guardia', lec.a[0] === 'perseguir' && lec.a[1] && lec.a[2] >= 5 && lec.b[0] === 'perseguir' && lec.b[1] && lec.c[0] === 'seguir' && lec.c[3] === 'yo' && lec.d[0] === 'huir' && lec.e[0] === 'bailar' && lec.e[4] === 'Techno' && lec.g[0] === 'guardia' && lec.h[0] === 'seguir' && lec.h[3] === 'yo', lec);
// 3) persigue y pega
await ev(`(() => { const P = NPC.lista[0]; P.pos.set(JUG.pos.x + 14, JUG.pos.y, JUG.pos.z + 3); P.act = npcActDeTexto('agresivo que nos persiga corriendo', { de: RED.ID || 'yo' }); P.act.dano = 10; JUG.vida = 100; return 1; })()`);
const t0 = await ev(`TIEMPO.t`); await p.waitForTimeout(4500);
const per = await ev(`(() => { const P = NPC.lista[0]; return { d: +Math.hypot(P.pos.x - JUG.pos.x, P.pos.z - JUG.pos.z).toFixed(2), vida: JUG.vida, t: +(TIEMPO.t - ${t0}).toFixed(2) }; })()`);
await p.screenshot({ path: D + 'npc_persigue.png' });
ok('agresivo: llega corriendo desde 14 m y te pega (baja la vida)', per.d < 2.2 && per.vida < 100, per);
await ev(`JUEGO.dios = true; JUG.vida = 100; 1`);
// 4) huye
await ev(`(() => { const P = NPC.lista[0]; P.pos.set(JUG.pos.x + 2, JUG.pos.y, JUG.pos.z + 2); P.vel.set(0, 0, 0); P.act = npcActDeTexto('tiene miedo y huye'); return 1; })()`);
await p.waitForTimeout(3500);
const hu = await ev(`+Math.hypot(NPC.lista[0].pos.x - JUG.pos.x, NPC.lista[0].pos.z - JUG.pos.z).toFixed(2)`);
ok('miedoso: se aleja corriendo (> 10 m en 3,5 s)', hu > 10, hu);
// 5) sigue
await ev(`(() => { const P = NPC.lista[0]; P.act = npcActDeTexto('que me siga', { de: RED.ID || 'yo' }); P.act.de = RED.ID || 'yo'; return 1; })()`);
await p.waitForTimeout(5000);
const si = await ev(`+Math.hypot(NPC.lista[0].pos.x - JUG.pos.x, NPC.lista[0].pos.z - JUG.pos.z).toFixed(2)`);
ok('amigo: vuelve y se queda a tu lado (≤ 4,5 m)', si <= 4.5 && si >= 1.5, si);
// 6) rodea un contenedor
await ev(`(() => { const P = NPC.lista[0]; P.pos.set(JUG.pos.x, JUG.pos.y + 0.2, JUG.pos.z + 16); P.vel.set(0, 0, 0); P.act = npcActNormal({ modo: 'perseguir', vel: 5.5, hostil: false, dist: 1.2 });
  const c = crearObjeto('Container1', v3(JUG.pos.x, JUG.pos.y - 0.9, JUG.pos.z + 8), Quat.axis(0, 1, 0, Math.PI / 2), { congelado: true }); window.__cont = c; return !!c; })()`);
await p.waitForTimeout(9000);
const ro = await ev(`({ d: +Math.hypot(NPC.lista[0].pos.x - JUG.pos.x, NPC.lista[0].pos.z - JUG.pos.z).toFixed(2), cont: !!window.__cont, ancho: window.__cont ? +(window.__cont.b.aabb.x1 - window.__cont.b.aabb.x0).toFixed(1) : 0 })`);
ok('rodea un contenedor que lo tapa para llegar (≤ 2,5 m en 9 s)', ro.d <= 2.5 && ro.cont, ro);
await ev(`if (window.__cont) borrarObjeto(window.__cont); 1`);
// 7) baila
await ev(`(() => { const P = NPC.lista[0]; P.act = npcActDeTexto('baila techno'); return 1; })()`); await p.waitForTimeout(1500);
const ba = await ev(`({ e: NPC.lista[0].emote, v: +Math.hypot(NPC.lista[0].vel.x, NPC.lista[0].vel.z).toFixed(2) })`);
ok('bailarín: baila (el emote pedido) sin moverse', ba.e === 'Techno' && ba.v < 0.3, ba);
// 8) la patada lo tira y se levanta
await ev(`(() => { const P = NPC.lista[0]; P.act = npcActNormal({ modo: 'quieto' }); P.emote = null; const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); P.pos.set(JUG.pos.x + f.x * 1.0, JUG.pos.y, JUG.pos.z + f.z * 1.0); P.vel.set(0, 0, 0); return 1; })()`);
await p.waitForTimeout(300); const tk = await ev(`PAT.t = -9; patear(); TIEMPO.t`); await p.waitForTimeout(500);
const pa1 = await ev(`({ rag: !!NPC.lista[0].rag, vivo: NPC.lista[0].vivo })`);
await p.waitForFunction((t) => window.__ev(`TIEMPO.t - ${t} > 4.6`), tk, { timeout: 60000 });   // (en tiempo del juego: con pocos cuadros por segundo el reloj del juego va más lento)
const pa2 = await ev(`(() => { const P = NPC.lista[0]; const piso = pisoBajo(P.pos, 0.5); return { rag: !!P.rag, vivo: P.vivo, pies: +(P.pos.y - 0.95 - piso).toFixed(2), cuerpoRayo: !P.npcB.noRay }; })()`);
ok('la patada lo tira (muñeco) y a los ~3 s se levanta parado', pa1.rag && pa1.vivo && !pa2.rag && pa2.vivo && Math.abs(pa2.pies) < 0.15 && pa2.cuerpoRayo, { pa1, pa2 });
// 9) la Physics Gun lo levanta y al soltarlo cae
const gi = await ev(`ARM.lista.indexOf('PhysicsGun')`);
await ev(`elegirArma(${gi}); 1`); await p.waitForTimeout(400);
await ev(`(() => { const P = NPC.lista[0]; const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); P.pos.set(JUG.pos.x + f.x * 3, JUG.pos.y, JUG.pos.z + f.z * 3); P.npcB.pos.copy(P.pos); P.npcB.updateWorld(); JUG.pitch = 0.05; return 1; })()`);
await p.waitForTimeout(300);
await ev(`ENT.disparo = true; agarrarFisica(); 1`); await p.waitForTimeout(100);
await ev(`JUG.pitch = -0.5; 1`); await p.waitForTimeout(900);
const gr = await ev(`({ held: !!NPC.lista[0].npcB.held, y: +(NPC.lista[0].pos.y - JUG.pos.y).toFixed(2), suelo: NPC.lista[0].suelo })`);
await p.screenshot({ path: D + 'npc_physgun.png' });
await ev(`ENT.disparo = false; soltarAgarre(false); JUG.pitch = 0.2; 1`); await p.waitForTimeout(2500);
const gr2 = await ev(`(() => { const P = NPC.lista[0]; const piso = pisoBajo(P.pos, 0.5); return { pies: +(P.pos.y - 0.95 - piso).toFixed(2), frozen: P.npcB.frozen, held: P.npcB.held, rag: !!P.rag }; })()`);
ok('la Physics Gun lo levanta (sube > 1 m, colgando) y al soltarlo cae al piso', gr.held && gr.y > 1 && !gr.suelo && gr2.frozen && !gr2.held && (gr2.rag || Math.abs(gr2.pies) < 0.15), { gr, gr2 });
await p.waitForTimeout(3500);
// 10) los tiros lo matan: muñeco
const ti = await ev(`(() => { const P = NPC.lista[0]; if (P.rag) npcLevantar(P); P.vida = 100; danarPersona(P, 30, P.pos.clone(), v3(0, 0, 1)); const v1 = P.vida, r1 = !!P.rag; danarPersona(P, 90, P.pos.clone(), v3(0, 0, 1)); return { v1, r1, vivo: P.vivo, rag: !!P.rag }; })()`);
ok('un tiro lo lastima (sin tirarlo) y otro fuerte lo mata: queda como muñeco', ti.v1 === 70 && !ti.r1 && ti.vivo === false && ti.rag, ti);
// 11) la IA gratis
const ia = await ev(`(async () => { const t0 = performance.now(); const r = await iaJSON(NPC_SIS, 'agresivo que nos persiga corriendo', 20000); if (!r) return null; const a = npcActNormal(r.o); return { ia: r.ia, modo: a.modo, hostil: a.hostil, vel: a.vel, decir: a.decir, ms: Math.round(performance.now() - t0) }; })()`);
ok('la IA gratis contesta una actitud que sirve (persigue, hostil, corriendo)', ia && ia.modo === 'perseguir' && ia.hostil && ia.vel >= 4, ia);
// 12) el panel: escribir y Enter
await ev(`npcCrear('Hero', v3(JUG.pos.x + 3, JUG.pos.y - 0.95, JUG.pos.z + 3), 0, { modo: 'quieto' }); 1`); await p.waitForTimeout(300);
await ev(`npcPanel(NPC.lista[NPC.lista.length - 1]); 1`); await p.waitForTimeout(300);
await p.fill('#npcTxt', 'que baile y diga "hola che"'); await p.press('#npcTxt', 'Enter'); await p.waitForTimeout(400);
const pan = await ev(`(() => { const P = NPC.lista[NPC.lista.length - 1]; return { abierto: UI.abierto, modo: P.act.modo, decir: P.act.decir, globo: !!P.globo }; })()`);
await p.screenshot({ path: D + 'npc_panel.png' });
ok('el panel: lo escrito (Enter) cambia la actitud al instante y dice su frase', pan.abierto === 'npc' && pan.modo === 'bailar' && pan.decir[0] === 'hola che' && pan.globo, pan);
await ev(`cerrarPaneles(); 1`);
// 13) la red (simulada): un NPC de otro aparece y se mueve; el golpe le llega al dueño
const red = await ev(`(async () => { const env = []; const pub0 = publicar; window.publicar = publicar = (s, d) => env.push([s, d]); const on0 = RED.on; RED.on = true; RED.ID = RED.ID || 'yo1';
  const x = JUG.pos.x + 5, z = JUG.pos.z;
  npcRecibir({ i: 'otro', k: 'npcs', l: [[7, 'Hero', x, JUG.pos.y, z, 0, 2, 0, 0, 1, '']] });
  const E = NPC.rem.get('otro/7'); await new Promise((r) => setTimeout(r, 300));
  npcRecibir({ i: 'otro', k: 'npcs', l: [[7, 'Hero', x + 2, JUG.pos.y, z, 1, 2, 0, 0, 1, '']] }); await new Promise((r) => setTimeout(r, 400));
  const px = E.P.pos.x - x; danarPersona(E.P, 25, E.P.pos.clone(), v3(1, 0, 0));
  const dan = env.find((e) => e[1].k === 'npcdan');
  npcRecibir({ i: 'otro', k: 'npcfin', n: 7 }); const quedan = NPC.rem.size;
  RED.on = on0; window.publicar = publicar = pub0;
  return { creado: !!E, px: +px.toFixed(2), dan: dan ? dan[1] : null, quedan, ajenoEnLista: NPC.lista.includes(E.P) }; })()`);
ok('red: el NPC de otro aparece y va hacia donde lo manda su dueño; tu golpe le llega al dueño; al irse se borra', red.creado && red.px > 1.2 && red.dan && red.dan.to === 'otro' && red.dan.n === 7 && red.dan.d === 25 && red.quedan === 0 && !red.ajenoEnLista, red);
// 14) costo: 12 persiguiendo
await ev(`npcTodos(); for (let i = 0; i < 12; i++) npcCrear(i % 2 ? 'Hero' : 'Hero', v3(JUG.pos.x + 20 * Math.cos(i), JUG.pos.y - 0.95, JUG.pos.z + 20 * Math.sin(i)), 0, { modo: 'perseguir', vel: 5, hostil: false, dist: 2 }); 1`);
await p.waitForTimeout(800);
const costo = await ev(`(() => { const N = 120, t0 = performance.now(); for (let i = 0; i < N; i++) npcPaso(1 / 60); return { ms: +((performance.now() - t0) / N).toFixed(3), n: NPC.lista.length }; })()`);
await p.waitForTimeout(2500);
await ev(`JUG.tercera = true; JUG.pitch = 0.35; 1`); await p.waitForTimeout(600);
await p.screenshot({ path: D + 'npc_12.png' });
ok('12 NPC persiguiendo: el cerebro y los choques de todos cuestan < 2 ms por cuadro', costo.ms < 2 && costo.n === 12, costo);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
