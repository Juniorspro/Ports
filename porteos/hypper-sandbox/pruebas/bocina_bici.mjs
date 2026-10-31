// bocina y bici con cohete: en un auto, H suena la bocina (dos tonos, sale del auto) mientras se mantiene y avisa a la
// sala al tocar y al soltar; la de otro suena en su auto; la bici con cohete está en Props → Vehículos, es de dos
// ruedas (como la moto), queda parada sobre sus ruedas sin hundirse, a pedal llega a ~13 m/s y con el cohete pasa de 25
// m/s en 3 s sin volcar (fuego y ruido del cohete, y avisa a la sala); su bocina es un timbre; sin errores.
// uso: node bocina_bici.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(process.argv[2]);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 15000 });
await ev(`window.__env = []; window.__p0 = publicar; window.publicar = publicar = (s, d) => { window.__env.push([s, JSON.parse(JSON.stringify(d))]); }; RED.on = true; RED.ID = RED.ID || 'yo1'; audioIniciar && audioIniciar(); 1`);
// auto: H
const auto = await ev(`(async () => { const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); const o = crearObjeto('Sedan', vadd(JUG.pos, vscale(f, 5)), Quat.axis(0, 1, 0, JUG.yaw), {}); await new Promise((r) => setTimeout(r, 800)); subirVehiculo(o);
  await new Promise((r) => setTimeout(r, 300)); ENT.teclas.add('KeyH'); await new Promise((r) => setTimeout(r, 400)); const V = o.veh;
  const durante = { suena: !!V.boc, osc: V.boc ? V.boc.os.length : 0, f: V.boc ? V.boc.os.map((x) => Math.round(x.frequency.value)) : [], tipo: bocTipo(V) };
  ENT.teclas.delete('KeyH'); await new Promise((r) => setTimeout(r, 300)); const despues = !!V.boc;
  const red = window.__env.filter((e) => e[1].k === 'bocina').map((e) => e[1].on); salirVehiculo(); return { durante, despues, red, key: claveObj(o) }; })()`);
ok('auto: H suena la bocina (dos tonos) mientras se mantiene, al soltar se calla; avisa a la sala (1 y 0)', auto.durante.suena && auto.durante.osc === 2 && !auto.despues && auto.red.join() === '1,0', auto);
const otro = await ev(`(async () => { const o = buscarObjeto('${auto.key}'); bocinaRed({ i: 'otro', k: 'bocina', o: '${auto.key}', on: 1 }); await new Promise((r) => setTimeout(r, 200)); const a = !!o.veh.boc; bocinaRed({ i: 'otro', k: 'bocina', o: '${auto.key}', on: 0 }); return { a, b: !!o.veh.boc }; })()`);
ok('la bocina de otro suena en su auto y se calla cuando la suelta', otro.a && !otro.b, otro);
// la bici
const menu = await ev(`(() => { for (const c of DATA.menu) for (const s of c.sub || []) if ((s.it || []).includes('BiciCohete')) return c.n + '/' + s.n; return null; })()`);
const bi = await ev(`(async () => { const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); const o = crearObjeto('BiciCohete', vadd(vadd(JUG.pos, vscale(f, 9)), v3(0, -0.4, 0)), Quat.axis(0, 1, 0, JUG.yaw), {}); window.__bici = o;
  await new Promise((r) => setTimeout(r, 2500)); const V = o.veh, a = o.b.aabb, piso = pisoBajo(v3(o.b.pos.x, o.b.pos.y + 2, o.b.pos.z), 10);
  const up = o.b.q.rot(v3(0, 1, 0)); return { tipo: V && V.tipo, ruedas: V && V.ruedas.length, asientos: V && V.asientos.length, tocan: V && V.ruedas.filter((w) => w.toca).length, cajaSobrePiso: +(a.y0 - piso).toFixed(3), derecha: +up.y.toFixed(3) }; })()`);
ok('la bici con cohete: en Vehículos, dos ruedas que tocan el piso, un asiento, parada y con el cuadro arriba del piso', menu && bi.tipo === 'moto' && bi.ruedas === 2 && bi.tocan === 2 && bi.asientos >= 1 && bi.derecha > 0.97 && bi.cajaSobrePiso > 0.1 && bi.cajaSobrePiso < 0.5, { menu, bi });
await p.screenshot({ path: D + 'bici_parada.png' });
// a pedal
const ped = await ev(`(async () => { const o = window.__bici; subirVehiculo(o); JUG.tercera = true; ENT.teclas.add('KeyW'); const t0 = TIEMPO.t; while (TIEMPO.t - t0 < 6) await new Promise((r) => setTimeout(r, 100)); const f = o.b.q.rot(v3(0, 0, 1)); return { v: +vdot(o.b.vel, f).toFixed(1), up: +o.b.q.rot(v3(0, 1, 0)).y.toFixed(2) }; })()`);
ok('a pedal llega a ~13 m/s (10-14) derecha', ped.v >= 10 && ped.v <= 14.5 && ped.up > 0.85, ped);
// el cohete
const coh = await ev(`(async () => { const o = window.__bici; window.__env.length = 0; ENT.turbo = true; const t0 = TIEMPO.t; let vmax = 0, upmin = 1, fuego = 0;
  while (TIEMPO.t - t0 < 3) { await new Promise((r) => setTimeout(r, 50)); const f = o.b.q.rot(v3(0, 0, 1)); vmax = Math.max(vmax, vdot(o.b.vel, f)); upmin = Math.min(upmin, o.b.q.rot(v3(0, 1, 0)).y); }
  const red = window.__env.filter((e) => e[1].k === 'turbo').map((e) => e[1].on); const ruido = AUD.loops && AUD.loops.has('cohete' + o.id);
  return { vmax: +vmax.toFixed(1), upmin: +upmin.toFixed(2), red, ruido, t: +(TIEMPO.t - t0).toFixed(1) }; })()`);
await p.screenshot({ path: D + 'bici_cohete.png' });
await ev(`ENT.turbo = false; 1`); await p.waitForTimeout(300);
const coh2 = await ev(`window.__env.filter((e) => e[1].k === 'turbo').map((e) => e[1].on)`);
ok('el cohete: pasa los 25 m/s en 3 s sin volcar, con su ruido; avisa a la sala al prender y al apagar', coh.vmax > 25 && coh.upmin > 0.6 && coh.ruido && coh.red[0] === 1 && coh2.includes(0), { coh, coh2 });
const tim = await ev(`(async () => { const o = window.__bici; ENT.teclas.delete('KeyW'); ENT.bocina = true; await new Promise((r) => setTimeout(r, 300)); const V = o.veh, r = { tipo: bocTipo(V), suena: !!V.boc }; ENT.bocina = false; await new Promise((r2) => setTimeout(r2, 200)); r.despues = !!V.boc; return r; })()`);
ok('la bocina de la bici es un timbre', tim.tipo === 'timbre' && tim.suena && !tim.despues, tim);
await ev(`window.publicar = publicar = window.__p0; RED.on = false; 1`);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
