// bombas nucleares: en Props → Nucleares hay más de 100 (cada una con nombre, potencia, país, año, tipo, ícono y modelo);
// E la arma (cuenta de 10 s, 15 en las de megatones, con sirena y el cartel que la nombra) y al final explota y
// desaparece; la onda avanza (no llega de golpe) y empuja (≥ 5 m/s) y lastima todo lo que está dentro de su alcance (2,3
// veces el radio) y nada de lo de afuera; en la bola de fuego se muere; el estruendo suena con la demora del sonido
// (distancia / 340 m/s, ±0,25 s); la de superficie deja radiación que lastima de a poco; la del espacio no toca el piso;
// la subterránea no encandila; en la sala avisa (y la que llega se ve); el dibujo de una de megatones cuesta < 1,5 ms
// por cuadro; sin errores.
// uso: node nucleares.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(process.argv[2]);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 30000 });
const cat = await ev(`(() => { const L = DATA.menu.find((c) => c.n === 'Props').sub.find((s) => s.n === 'Nucleares').it;
  const mal = L.filter((n) => { const nk = nukeDe(n); return !nk || !nk.n || !(nk.kt > 0) || !nk.p || !nk.t || !DATA.ico[n] || propNom(n) !== nk.n; });
  const paises = new Set(L.map((n) => nukeDe(n).p)), tipos = new Set(L.map((n) => nukeDe(n).t)); return { n: L.length, mal, paises: paises.size, tipos: [...tipos], min: Math.min(...L.map((n) => nukeDe(n).kt)), max: Math.max(...L.map((n) => nukeDe(n).kt)) }; })()`);
ok('Props → Nucleares: más de 100, cada una con nombre, potencia, país, año, tipo e ícono', cat.n >= 100 && cat.mal.length === 0 && cat.paises >= 8, cat);
// armar: E y la cuenta
const arm = await ev(`(async () => { const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); const o = crearObjeto('NK_littleboy', vadd(JUG.pos, vadd(vscale(f, 3), v3(0, 0.5, 0))), Quat.axis(0, 1, 0, 0), {});
  await new Promise((r) => setTimeout(r, 1500)); const son = []; const s0 = sonar; window.sonar = sonar = (n, pp, v, t) => { son.push(n); return s0(n, pp, v, t); };
  const d = vsub(o.b.pos, CAM.pos); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = Math.atan2(-d.y, Math.hypot(d.x, d.z)); await new Promise((r) => setTimeout(r, 500));   // (apuntar cuando ya cayó)
  const h = raycast(CAM.pos, CAM.fwd, 4.5, null), apunta = !!(h && h.body && h.body.obj === o);
  usar(); const cuenta = o.nkArm && o.nkArm.t; const o2 = crearObjeto('NK_tsar', vadd(JUG.pos, v3(30, 2, 30)), new Quat(), {}); nukeUsar(o2); const cuentaMt = o2.nkArm && o2.nkArm.t;
  o2.nkArm = null; borrarObjeto(o2, true); window.sonar = sonar = s0; o.nkArm = null; borrarObjeto(o, true);
  return { cuenta, cuentaMt, sirena: son.includes('NK_sirena'), apunta, dist: +o.b.pos.distTo(CAM.pos).toFixed(2), h: h && (h.body ? (h.body.obj ? h.body.obj.nombre : 'cuerpo') : 'mapa') }; })()`);
ok('E la arma: 10 s (15 en las de megatones) con sirena', arm.cuenta === 10 && arm.cuentaMt === 15 && arm.sirena, arm);
// la explosión: la onda, lo que alcanza y lo que no, el sonido
const ex = await ev(`(async () => {
  const nk = nukeDe('NK_littleboy'), Rr = nukeRadio(nk.kt), f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), c = vadd(JUG.pos, vscale(f, Rr * 3.4));
  // cajas a distintas distancias del centro (dentro del alcance, en el borde y afuera)
  const lado = v3(f.z, 0, -f.x), cajas = [0.6, 1.2, 1.9, 2.8, 3.6].map((k) => { const pp = vadd(c, vscale(lado, Rr * k)); const y = pisoBajo(v3(pp.x, pp.y + 30, pp.z), 80); return { k, o: crearObjeto('CajaMadera', v3(pp.x, y + 0.6, pp.z), new Quat(), {}) }; });
  await new Promise((r) => setTimeout(r, 1500));
  const bomba = crearObjeto('NK_littleboy', vadd(c, v3(0, 1, 0)), new Quat(), {}); await new Promise((r) => setTimeout(r, 500));
  const son = []; const s0 = sonar; window.sonar = sonar = (n, pp, v, t) => { if (/^NK_/.test(n)) son.push([n, +(TIEMPO.t - window.__t0).toFixed(2)]); return s0(n, pp, v, t); };
  const env = []; const p0 = publicar; window.publicar = publicar = (s, d) => env.push(d); RED.on = true; RED.ID = RED.ID || 'yo1';
  const t0 = performance.now(); window.__t0 = TIEMPO.t; bomba.nkArm = { t: 0.001, tot: 1, bip: 0 };
  const vel = cajas.map(() => 0), primera = cajas.map(() => -1);
  while ((performance.now() - t0) < 4500) { await new Promise((r) => requestAnimationFrame(r)); cajas.forEach((x, i) => { if (!x.o || !x.o.b) return; const v = x.o.b.vel.len(); if (v > vel[i]) vel[i] = v; if (v > 2 && primera[i] < 0) primera[i] = +(TIEMPO.t - window.__t0).toFixed(2); }); }
  const E = NUK.vivas[NUK.vivas.length - 1], dCam = CAM.pos.distTo(E.p);
  window.sonar = sonar = s0; window.publicar = publicar = p0; RED.on = false;
  return { R: +Rr.toFixed(1), alc: +(E.alc / Rr).toFixed(1), bombaSeFue: !OBJS.includes(bomba), vel: cajas.map((x, i) => [x.k, +vel[i].toFixed(1), primera[i]]), dCam: +dCam.toFixed(0), son, red: env.filter((x) => x.k === 'nk').length, vida: JUG.vida };
})()`);
await p.screenshot({ path: D + 'nk_onda.png' });
const dentro = ex.vel.filter((x) => x[0] < 2.3), afuera = ex.vel.filter((x) => x[0] > 2.3);
ok('explota y la bomba desaparece; avisa a la sala', ex.bombaSeFue && ex.red === 1, ex);
ok('la onda empuja todo lo que está dentro de su alcance (2,3 radios; más fuerte cerca: ≥ 5 m/s en la mitad de adentro, ≥ 1 m/s hasta el borde) y nada de afuera; llega de a poco (lo de más lejos, después)', dentro.every((x) => x[1] >= (x[0] < 1.15 ? 5 : 1)) && dentro.every((x, i) => i === 0 || x[1] < dentro[i - 1][1]) && afuera.every((x) => x[1] < 1) && dentro[1][2] > dentro[0][2], ex.vel);
const est = ex.son.find((x) => !/rumble|despues|sirena/.test(x[0]));
ok('el estruendo suena con la demora del sonido (distancia / 340 m/s ± 0,25 s)', est && Math.abs(est[1] - ex.dCam / 340) <= 0.25, { est, esperado: +(ex.dCam / 340).toFixed(2) });
// en la bola de fuego: muerte; a 1,5 radios: lastima; a 3 radios: nada
const dano = await ev(`(async () => {
  const nk = nukeDe('NK_fatman'), Rr = nukeRadio(nk.kt), out = {};
  for (const k of [3, 1.5, 0.2]) {
    if (!JUG.vivo) { jugadorAparecer(); await new Promise((r) => setTimeout(r, 600)); }
    JUG.vida = 100; const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), c = vadd(JUG.pos, vscale(f, Rr * k));
    nukeExplotar(v3(c.x, JUG.pos.y - 0.9, c.z), 'NK_trinity', false); const t0 = performance.now();
    while (performance.now() - t0 < 2500) await new Promise((r) => requestAnimationFrame(r));
    out[k] = { vida: Math.round(JUG.vida), vivo: JUG.vivo };
  }
  return out; })()`);
ok('a 3 radios no pasa nada; a 1,5 lastima pero se sobrevive; en la bola de fuego (0,2) se muere', dano[3].vida === 100 && dano[1.5].vivo && dano[1.5].vida < 100 && !dano[0.2].vivo, dano);
await ev(`(async () => { if (!JUG.vivo) jugadorAparecer(); await new Promise((r) => setTimeout(r, 800)); JUG.vida = 100; NUK.zonas = []; return 1; })()`);
// la radiación (superficie), el espacio y la subterránea
const tipos = await ev(`(async () => {
  const out = {}; await new Promise((r) => setTimeout(r, 300)); JUG.vida = 100;
  // radiación: una zona encima mío
  NUK.zonas = [{ p: JUG.pos.clone(), r: 30, t: 100 }]; const v0 = JUG.vida, t0 = performance.now(); while (performance.now() - t0 < 3500) await new Promise((r) => requestAnimationFrame(r));
  out.rad = { antes: v0, despues: Math.round(JUG.vida), overlay: +getComputedStyle($('nukRad')).opacity }; NUK.zonas = []; JUG.vida = 100;
  // espacio: no lastima en el piso; subterránea: sin destello
  const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); NUK.flash = 0;
  const Ee = nukeExplotar(vadd(JUG.pos, vscale(f, 20)), 'NK_starfish', false); await new Promise((r) => setTimeout(r, 1500)); out.espacio = { alto: +(Ee.p.y - Ee.piso).toFixed(0), vida: Math.round(JUG.vida) };
  NUK.flash = 0; const Es = nukeExplotar(vadd(JUG.pos, vscale(f, 400)), 'NK_sedan', false); await new Promise((r) => setTimeout(r, 200)); out.subte = { flash: +(NUK.flash || 0).toFixed(2) };
  return out; })()`);
ok('la de superficie deja radiación que lastima de a poco (y se ve el verde)', tipos.rad.despues < tipos.rad.antes && tipos.rad.despues > 50 && tipos.rad.overlay > 0.1, tipos.rad);
ok('la del espacio explota bien arriba (≥ 250 m) y no lastima en el piso; la subterránea no encandila', tipos.espacio.alto >= 250 && tipos.espacio.vida === 100 && tipos.subte.flash === 0, tipos);
// la que llega de la sala
const red = await ev(`(async () => { const n0 = NUK.vivas.length, f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), c = vadd(JUG.pos, vscale(f, 600)); nukeRed({ k: 'nk', i: 'otro', n: 'NK_ivymike', p: [c.x, c.y, c.z] }); return { nuevas: NUK.vivas.length - n0 }; })()`);
ok('la que llega de la sala se ve acá', red.nuevas === 1, red);
// el costo del dibujo con una de megatones (y la foto de lejos), con los carteles: en Bajo (en Medio, Alto y Ultra va con
// volumen —nuclear_vol.js—, que se mide en nuclear_vol.mjs)
await ev(`(() => { PREFS.gfx = 'bajo'; aplicarGfx(); NUK.vivas.length = 0; const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); window.__E = nukeExplotar(vadd(JUG.pos, vscale(f, 900)), 'NK_bravo', false); NUK.flash = 0; JUG.pitch = -0.35; return 1; })()`);
await p.waitForTimeout(9000);
await p.screenshot({ path: D + 'nk_bravo.png' });
const costo = await ev(`(() => { const t0 = performance.now(); for (let i = 0; i < 100; i++) nukeDibujar(); return +((performance.now() - t0) / 100).toFixed(3); })()`);
ok('el dibujo de una de megatones con carteles (en Bajo) cuesta < 1,5 ms por cuadro', costo > 0 && costo < 1.5, costo);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
