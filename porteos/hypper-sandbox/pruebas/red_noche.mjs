// la noche en la pizzería en una sala: Ana y Beto entran al server oficial del mapa. Uno solo maneja la noche y los dos ven
// lo mismo (hora, energía, animatrónicos); Beto (que no la maneja) cierra una puerta y prende la linterna y Ana lo ve. A Beto
// lo agarran: el susto le sale a él y después pasa a espectador (no se ve ni choca; sigue a Ana, cámara libre, cámaras).
// Agarran a Ana: Game Over para los dos y la noche otra vez sola a los 8 s, con Beto de vuelta en la oficina. Al irse el
// que maneja, el otro sigue la noche desde donde estaba.
// uso: BROKER_DIR=carpeta-con-mc/broker node red_noche.mjs Hypper.html
import { createRequire } from 'module'; import http from 'http';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad', req = createRequire(S + '/mc/broker/package.json');
const html = process.argv[2];
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8898, '127.0.0.1', r));
const navs = [], errs = [];
const abrir = async (n) => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] }); navs.push(b);
  const p = await (await b.newContext({ viewport: { width: 800, height: 450 } })).newPage();
  p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|mqtt|Failed to load|ERR_/i.test(m.text())) errs.push(n + ': ' + m.text().slice(0, 160)); });
  await p.goto('file://' + html + '?test&broker=ws://127.0.0.1:8898/mqtt'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); return p;
};
const ev = (P, s) => P.evaluate((x) => window.__ev(x), s), J = async (P, s) => JSON.parse(await ev(P, `JSON.stringify(${s})`));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const hasta = async (P, cond, seg) => { for (let i = 0; i < seg * 2; i++) { if (await J(P, cond)) return true; await espera(500); } return false; };
const entrar = (P, n) => ev(P, `PREFS.nombre='${n}'; PREFS.lang='es'; PREFS.bienvenida=true; PREFS.gfx='patata'; GFX.auto=false; aplicarGfx(); audioIniciar(); inicioMostrar(false); conectarMultijugador(); entrarSala(SALAS_OF.find((s) => s.m === 'RB_Pizzeria')); 1`);
const A = await abrir('Ana'), B = await abrir('Beto');
await entrar(A, 'Ana'); await espera(4000); await entrar(B, 'Beto');
let ok = 0, mal = 0; const chk = (c, t) => { console.log((c ? 'OK  ' : 'MAL ') + t); c ? ok++ : mal++; };
for (let i = 0; i < 60; i++) { await espera(1000); const [a, b] = [await J(A, `{on: NOC.on, red: RED.on, n: RED.remotos.size}`), await J(B, `{on: NOC.on, red: RED.on, n: RED.remotos.size}`)]; if (a.on && b.on && a.n && b.n) break; }
await espera(6000);
const est = async (P) => J(P, `{id: RED.ID, ctl: NOC.ctl, estado: NOC.estado, noche: NOC.noche, hora: +NOC.hora.toFixed(3), poder: +NOC.poder.toFixed(1), puerta: NOC.puerta, a: NOC.anim.map(x => [+x.pos.x.toFixed(1), +x.pos.z.toFixed(1)]), fuera: [...NOC.fuera], susto: !!NOC.susto, esp: NOC.esp && NOC.esp.modo, menu: !NOC.ui.menu.classList.contains('oc')}`);
let a = await est(A), b = await est(B);
console.log('Ana', JSON.stringify(a)); console.log('Beto', JSON.stringify(b));
chk(a.ctl !== b.ctl, 'uno solo maneja la noche (Ana ' + a.ctl + ', Beto ' + b.ctl + ')');
chk(!a.menu && !b.menu && a.noche === 1 && ['intro', 'juega'].includes(a.estado) && a.estado === b.estado, 'en una sala no hay menú: arranca la noche 1 para los dos (' + a.estado + ')');
const [M, O] = a.ctl ? [A, B] : [B, A], mId = a.ctl ? a.id : b.id, oId = a.ctl ? b.id : a.id, nM = a.ctl ? 'Ana' : 'Beto', nO = a.ctl ? 'Beto' : 'Ana', iM = a.ctl ? 0 : 1;
await hasta(M, `NOC.estado === 'juega'`, 30); await espera(2000);
a = await est(M); b = await est(O);
chk(Math.abs(a.hora - b.hora) < 0.02 && Math.abs(a.poder - b.poder) < 1 && a.estado === b.estado, 'misma hora, energía y estado (' + a.hora + '/' + b.hora + ', ' + a.poder + '/' + b.poder + ')');
// los animatrónicos caminan en el que maneja y el otro los ve en el mismo lugar (noche 6: se mueven enseguida)
await ev(M, `nocheEmpezarNoche(6); for (let i = 0; i < 90; i++) { TIEMPO.t += 0.05; nochePaso(0.05); } for (const x of NOC.anim) x.tMov = 0; 1`); await espera(9000);
const am = await J(M, `NOC.anim.map(x => [x.pos.x, x.pos.z, x.sala])`), ao = await J(O, `NOC.anim.map(x => [x.pos.x, x.pos.z, x.sala])`);
const dmax = Math.max(...am.map((p, k) => Math.hypot(p[0] - ao[k][0], p[1] - ao[k][1])));
console.log('animatrónicos (' + nM + '):', am.map((x) => x[2]).join(' '), '| distancia máx. entre los dos:', dmax.toFixed(2), 'm');
chk(dmax < 1.5, 'los animatrónicos están en el mismo lugar para los dos');
chk((await J(O, `NOC.noche`)) === 6, 'la noche nueva (6) le llega al otro');
await ev(M, `NOC.quieta = true; for (const x of NOC.anim) nocheAnimInicio(x); 1`);   // (quietos para lo que sigue)
// el que no maneja cierra la puerta izquierda (pedido por la red) y prende la linterna
await ev(O, `JUG.pos.set(-23.3, 1.4, -1.3); JUG.vel.set(0,0,0); const bt = nocheBotones().find(x => x.que==='puerta' && x.lado==='izq'); const d = vsub(bt.p, vadd(JUG.pos, v3(0, JUG.ojo, 0))); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = Math.asin(-d.y / d.len()); 0`);
await espera(1500); await ev(O, `usar(); nocheLinterna(); 0`); await espera(3000);
await ev(M, `NOC.quieta = false; 1`);
const pm = await J(M, `{p: NOC.puerta.izq, luzRemota: [...RED.remotos.values()].some(r => r.f & 128), esp: R.esp.length}`), po = await J(O, `{p: NOC.puerta.izq, k: +NOC.pk.izq.toFixed(2), caja: +NOC.cuerpoP.izq.pos.y.toFixed(2)}`);
console.log('puerta izq:', nM, JSON.stringify(pm), '|', nO, JSON.stringify(po));
chk(pm.p && po.p && po.k > 0.9 && po.caja < 5, 'la puerta que cerró el otro está cerrada (y choca) en los dos');
chk(pm.luzRemota, 'el que maneja ve la linterna del otro (y le alumbra: ' + pm.esp + ' luces especiales)');
// al que no maneja lo agarran: el susto le sale a él; después, espectador (no se ve ni choca para el otro)
await ev(M, `nocheAgarrar(NOC.anim[1], '${oId}'); 0`); await espera(2500);
const so = await J(O, `{susto: !!NOC.susto, fuera: NOC.fuera.has(RED.ID)}`), sm = await J(M, `{susto: !!NOC.susto, fuera: [...NOC.fuera]}`);
console.log('agarrado:', JSON.stringify(so), '|', nM + ':', JSON.stringify(sm));
chk(so.susto && !sm.susto && sm.fuera.includes(oId), 'el susto le sale sólo al que agarraron');
const enEsp = await hasta(O, `!!NOC.esp`, 40);
const eo = await J(O, `{modo: NOC.esp && NOC.esp.modo, abierto: UI.abierto, siguiendo: NOC.ui.espNom.textContent, bits: nocheBits(), barra: !NOC.ui.esp.classList.contains('oc')}`);
console.log('espectador:', JSON.stringify(eo));
chk(enEsp && eo.modo === 'seguir' && eo.siguiendo === nM && (eo.bits & 256) && eo.barra, 'después del susto pasa a espectador siguiendo a ' + nM);
await espera(3000);
const vm = await J(M, `(() => { const R2 = RED.remotos.get('${oId}'); return { visible: R2.P.visible, noRay: R2.b.noRay, noJug: R2.b.noJug, tag: R2.tag.style.display }; })()`);
chk(!vm.visible && vm.noRay && vm.noJug && vm.tag === 'none', 'para ' + nM + ' el espectador no se ve, no choca y no tiene nombre arriba');
await ev(O, `nocheEspModo('libre'); 1`); await espera(1500); const el = await J(O, `{modo: NOC.esp.modo, noclip: JUG.noclip, abierto: UI.abierto}`);
await ev(O, `nocheEspModo('cams'); 1`); await espera(1500); const ec = await J(O, `{modo: NOC.esp.modo, cam: NOC.cam, abierto: UI.abierto}`);
await ev(O, `nocheTablet(); nocheEspModo('seguir'); 1`); await espera(1000);
chk(el.modo === 'libre' && el.noclip && !el.abierto && ec.modo === 'cams' && ec.cam !== null && ec.abierto === 'fncam', 'espectador: cámara libre (vuela) y las cámaras de seguridad');
// agarran al que queda: Game Over para los dos y la noche otra vez sola (sin botones en la sala)
await ev(M, `nocheAgarrar(NOC.anim[0], '${mId}'); 0`);
const perdio = await hasta(O, `NOC.estado === 'perdio'`, 40);
const go = await J(O, `{go: !NOC.ui.go.classList.contains('oc'), botones: NOC.ui.go.querySelectorAll('button').length, esp: !!NOC.esp}`);
chk(perdio && go.go && !go.botones && !go.esp, 'agarraron a todos: Game Over en los dos (sin botones: la sala sigue sola)');
const otra = await hasta(O, `NOC.estado === 'intro' || NOC.estado === 'juega'`, 60);
await espera(2000);
const r1 = await J(O, `{noche: NOC.noche, hora: NOC.hora, fuera: NOC.fuera.size, esp: !!NOC.esp, oficina: enOficina(JUG.pos), bits: nocheBits()}`);
console.log('otra vez:', JSON.stringify(r1));
chk(otra && r1.noche === 6 && !r1.fuera && !r1.esp && r1.oficina && !(r1.bits & 256), 'la misma noche otra vez sola: nadie afuera, el espectador de vuelta en la oficina');
// se va el que maneja: el otro sigue con la noche desde donde estaba
await ev(M, `NOC.quieta = false; 1`); await hasta(M, `NOC.estado === 'juega'`, 30); await espera(3000);
const h0 = (await est(O)).hora;
await ev(M, `redSalir(); 0`); await navs[iM].close();
for (let i = 0; i < 60 && !(await J(O, 'NOC.ctl')); i++) await espera(1000);
await espera(3000);
const fin = await est(O);
console.log('se fue el que manejaba:', JSON.stringify(fin));
chk(fin.ctl && fin.hora >= h0, 'el que queda maneja la noche y la hora sigue (' + h0 + ' → ' + fin.hora + ')');
console.log('errores:', errs.slice(0, 8).join(' | ') || 'ninguno');
console.log(`resultado: ${ok} bien, ${mal} mal`);
for (const n of navs) await n.close().catch(() => {}); srv.close(); process.exit(0);
