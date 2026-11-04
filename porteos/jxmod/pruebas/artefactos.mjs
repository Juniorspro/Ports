// la catapulta y la bomba de Rick Prime: están en Props → Diversión con su ícono; la catapulta apoya en el piso, el
// brazo queda en el eje con la cuchara atrás; E la dispara: el brazo gira y una caja en la cuchara sale volando hacia
// adelante y arriba (> 8 m), vos también si estás parado en la cuchara; vuelve sola; la bomba: E pide a quién borrar;
// a los 5 s elimina a todos los de ese personaje (NPC) y a nadie más, con pitidos y destello; en la sala los dos pasan
// para todos; sin errores.
// uso: node artefactos.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(process.argv[2]);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); DIA.hora = 12; DIA.aplicada = -1; 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 15000 }); await p.waitForTimeout(300);
const menu = await ev(`(() => { const P = DATA.menu.find((c) => c.n === 'Props'), s = P.sub.find((x) => x.n === 'Diversion'); return { esta: !!s && s.it.includes('Catapulta') && s.it.includes('BombaOmega'), brazoOculto: !P.sub.some((x) => x.it.includes('CatapultaBrazo')), ico: !!DATA.ico.Catapulta && !!DATA.ico.BombaOmega }; })()`);
ok('en Props → Diversión con ícono (el brazo no aparece suelto)', menu.esta && menu.brazoOculto && menu.ico, menu);
// la catapulta adelante, de costado a la cámara
const cat = await ev(`(() => { const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), piso = pisoBajo(v3(JUG.pos.x, JUG.pos.y + 2, JUG.pos.z), 10);
  const o = window.__c = crearObjeto('Catapulta', v3(JUG.pos.x + f.x * 7, piso, JUG.pos.z + f.z * 7), Quat.axis(0, 1, 0, JUG.yaw + Math.PI / 2)); for (let i = 0; i < 120; i++) physStep(1 / 60);
  const c = artCat(o), cu = artCuchara(o, c); return { art: o.art, apoyo: +(o.b.pos.y - piso).toFixed(2), quieta: o.b.vel.len() < 0.05, cuchAlto: +(cu.y - piso).toFixed(2), cuchAtras: +vdot(vsub(cu, o.b.pos), o.b.q.rot(c.f)).toFixed(2) }; })()`);
ok('la catapulta apoya, quieta, con la cuchara atrás (y a 0,5-1,6 m del piso)', cat.art === 'catapulta' && cat.quieta && cat.cuchAtras < -0.5 && cat.cuchAlto > 0.5 && cat.cuchAlto < 1.6, cat);
await ev(`JUG.pitch = 0.15; 1`); await p.waitForTimeout(500); await p.screenshot({ path: D + 'catapulta_reposo.png' });
// una caja en la cuchara, disparar
const tiro = await ev(`(async () => { const o = window.__c, c = artCat(o), cu = artCuchara(o, c); const caja = crearObjeto('Box4', v3(cu.x, cu.y + 0.4, cu.z), new Quat()); for (let i = 0; i < 20; i++) physStep(1 / 60);
  const p0 = caja.b.pos.clone(); artUsar(o); let maxA = 0, vmax = 0;
  for (let i = 0; i < 90; i++) { artPaso(1 / 60); physStep(1 / 60); maxA = Math.max(maxA, c.a); vmax = Math.max(vmax, caja.b.vel.len()); if (i === 6) window.__fotoA = c.a; }
  const f = o.b.q.rot(c.f); let lejos = 0, subio = 0;
  for (let i = 0; i < 240; i++) { artPaso(1 / 60); physStep(1 / 60); lejos = Math.max(lejos, vdot(vsub(caja.b.pos, p0), f)); subio = Math.max(subio, caja.b.pos.y - p0.y); }
  return { vmax: +vmax.toFixed(1), lejos: +lejos.toFixed(1), subio: +subio.toFixed(1), maxA: +maxA.toFixed(2), vuelve: +c.a.toFixed(2) }; })()`);
ok('E dispara: el brazo gira y la caja de la cuchara sale para adelante y arriba (> 8 m)', tiro.vmax > 12 && tiro.lejos > 8 && tiro.maxA > 1.3, tiro);
ok('el brazo vuelve solo a su lugar', Math.abs(tiro.vuelve - (-0.3)) < 0.05, tiro);
// foto en el medio del giro
await ev(`(() => { const c = artCat(window.__c); c.tiro = false; c.a = 0.7; return 1; })()`); await p.waitForTimeout(300); await p.screenshot({ path: D + 'catapulta_giro.png' });
await ev(`(() => { const c = artCat(window.__c); c.a = -0.3; c.t = -9; return 1; })()`);
// vos en la cuchara
const yo = await ev(`(async () => { const o = window.__c, c = artCat(o), cu = artCuchara(o, c); JUG.pos.set(cu.x, cu.y + 1.0, cu.z); JUG.vel.set(0, 0, 0);
  artCatapultaTirar(o, true); for (let i = 0; i < 12; i++) { artPaso(1 / 60); } return { vy: +JUG.vel.y.toFixed(1), vh: +Math.hypot(JUG.vel.x, JUG.vel.z).toFixed(1) }; })()`);
ok('parado en la cuchara, sale volando vos también', yo.vy > 8 && yo.vh > 8, yo);
// la bomba
const om = await ev(`(async () => { const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); JUG.pos.y += 0; const piso = pisoBajo(v3(JUG.pos.x, JUG.pos.y + 2, JUG.pos.z), 10);
  const bo = crearObjeto('BombaOmega', v3(JUG.pos.x - f.x * 4, piso, JUG.pos.z - f.z * 4), new Quat());
  const mk = (s, dx) => { const P = crearPersona(s, 'HatEmpty', { nombre: '' }); P.npc = true; P.vida = 100; P.vivo = true; P.pos.set(JUG.pos.x + dx, JUG.pos.y, JUG.pos.z - f.z * 6); return P; };
  const a1 = mk('Soldier', -2), a2 = mk('Soldier', 2), b1 = mk('Jean', 0);
  artUsar(bo); await new Promise((r) => setTimeout(r, 200)); const panel = UI.abierto, opciones = document.querySelectorAll('#omegaPan [data-om]').length;
  document.querySelector('#omegaPan [data-om="Soldier"]').click(); const armada = ART.omega.has(bo);
  const sonidos = []; const f0 = sonar; sonar = function (n) { sonidos.push(n); return f0.apply(this, arguments); };
  for (let i = 0; i < 60 * 6; i++) artPaso(1 / 60);
  sonar = f0;
  return { panel, opciones, armada, a1: !!a1.rag || !a1.vivo, a2: !!a2.rag || !a2.vivo, b1: !!b1.rag || !b1.vivo, bomba: OBJS.includes(bo), pitidos: sonidos.filter((n) => n === 'UI_blip').length, boom: sonidos.includes('GrenadeExplode'), chat: CHAT[CHAT.length - 1].t }; })()`);
ok('la bomba: E pide a quién borrar (todos los personajes, los de cerca primero)', om.panel === 'omega' && om.opciones >= 40 && om.armada, om);
ok('a los 5 s (con pitidos) borra a todos los Soldier y a nadie más; desaparece', om.a1 && om.a2 && !om.b1 && !om.bomba && om.pitidos >= 4 && om.boom, om);
await p.waitForTimeout(150); await p.screenshot({ path: D + 'omega_destello.png' });
// en la sala
const red = await ev(`(() => { { const c0 = artCat(window.__c); c0.tiro = false; c0.t = -9; } const env = []; RED.on = true; RED.cli = { publish: (t, s) => env.push(JSON.parse(s)) }; const o = window.__c; artCatapultaTirar(o, true); const c = artCat(o); c.tiro = false; c.t = -9;
  RED.on = false; RED.cli = null; artRed({ k: 'catap', o: claveObj(o), i: 'otro' }); return { manda: env.some((x) => x.k === 'catap'), recibe: artCat(o).tiro }; })()`);
ok('en la sala: el disparo viaja y del otro lado también se dispara', red.manda && red.recibe, red);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
