// los sonidos de los personajes y del ambiente: cada triángulo del mapa sabe de qué es (pasto en FlatGrass, mezcla en
// gm_construct), los pasos suenan con el piso de abajo y al ritmo del paso (caminando y corriendo), fuerte al caer; las
// voces de dolor y muerte según el personaje (hombre, robot, monstruo), la del emote de saludo; el ambiente de cada mapa
// (viento en el campo y ranas de noche, la ciudad, el zumbido de adentro, nada en la pizzería); todo lo que se nombra existe.
// uso: node sonidos.mjs HTML
import { abrir } from './base.mjs';
const { b, p, err, ev } = await abrir(process.argv[2]);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); DIA.hora = 12; DIA.aplicada = -1; 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && JUG.suelo`), null, { timeout: 15000 }); await p.waitForTimeout(300);   // (que ya esté pisando: al aparecer cae 1,8 m)
await ev(`window.__son = []; const f0 = sonar; sonar = function (n, pos, vol) { window.__son.push([n, !!pos, +(vol || 0).toFixed(2), +TIEMPO.t.toFixed(2)]); return f0.apply(this, arguments); }; 1`);
const sup = async () => ev(`(() => { const h = new Array(SUP.length).fill(0); for (const k of MUNDO.triSup) h[k]++; return Object.fromEntries(SUP.map((s, i) => [s, h[i]]).filter((x) => x[1])); })()`);
const sFG = await ev(`SUP[sonPiso(JUG.pos, true)]`);
ok('FlatGrass: el piso (una caja de pasto) suena a pasto', sFG === 'grass', sFG);
// pasos: caminar 1,4 m/s y correr 6 m/s 4 s cada uno (pasos fijos), contar los de pasto
const pasos = await ev(`(() => { const out = {}; const E = { x: 0, y: 1, saltar: false, agachar: false, correr: false };
  for (const [nom, vmax] of [['camina', 1.4], ['corre', 6]]) { window.__son.length = 0; const v0 = JUG.vel_max; JUG.vel_max = vmax;
    for (let i = 0; i < 240; i++) { jugadorPaso(1 / 60, E); TIEMPO.t += 1 / 60; sonPasos(1 / 60); }
    JUG.vel_max = v0; const L = window.__son.filter((x) => /^PS_/.test(x[0])); out[nom] = { n: L.length, pasto: L.filter((x) => /^PS_grass/.test(x[0])).length, porSeg: +(L.length / 4).toFixed(2), sinPos: L.every((x) => !x[1]) }; }
  // caer de 3 m: un paso fuerte al tocar el piso
  window.__son.length = 0; JUG.pos.y += 3; JUG.vel.set(0, 0, 0); const E0 = { x: 0, y: 0, saltar: false, agachar: false, correr: false };
  for (let i = 0; i < 120; i++) { jugadorPaso(1 / 60, E0); TIEMPO.t += 1 / 60; sonPasos(1 / 60); }
  out.cae = window.__son.filter((x) => /^PS_/.test(x[0])).map((x) => x[2]); return out; })()`);
ok('caminando: pasos de pasto cada ~0,5 s (1,6-2,4 por segundo), los míos sin posición (en la cabeza)', pasos.camina.n === pasos.camina.pasto && pasos.camina.porSeg >= 1.6 && pasos.camina.porSeg <= 2.4 && pasos.camina.sinPos, pasos.camina);
ok('corriendo: más seguidos (3-4,5 por segundo)', pasos.corre.porSeg >= 3 && pasos.corre.porSeg <= 4.5, pasos.corre);
ok('al caer de 3 m suena un paso fuerte (volumen ≥ 0,35) una sola vez', pasos.cae.length === 1 && pasos.cae[0] >= 0.35, pasos.cae);
// voces
const voz = await ev(`(() => { const out = {}; window.__son.length = 0; JUG.vida = 100; danarJugador(10); out.yo = window.__son.map((x) => x[0]);
  for (const s of ['Freddy', 'BoiledOne', 'Hero']) { const P = crearPersona(s, 'HatEmpty', { nombre: '' }); P.npc = true; P.vida = 30; P.vivo = true; P.pos.set(JUG.pos.x + 3, JUG.pos.y, JUG.pos.z);
    window.__son.length = 0; TIEMPO.t += 1; danarPersona(P, 10, P.pos.clone(), v3(1, 0, 0)); const dolor = window.__son.map((x) => x[0]); TIEMPO.t += 1; window.__son.length = 0; danarPersona(P, 50, P.pos.clone(), v3(1, 0, 0));
    const muere = window.__son.map((x) => x[0]); window.__son.length = 0; TIEMPO.t += 1; danarPersona(P, 50, P.pos.clone(), v3(1, 0, 0)); out[s] = { dolor, muere, yaTirado: window.__son.map((x) => x[0]) }; borrarPersona(P); }
  window.__son.length = 0; TIEMPO.t += 1; emote('Hi'); out.hola = window.__son.map((x) => x[0]); JUG.cuerpo.emote = null; return out; })()`);
ok('me pegan: mi voz de dolor (hombre)', voz.yo.length === 1 && /^VZ_h_dolor\d$/.test(voz.yo[0]), voz.yo);
ok('dolor y muerte según el personaje: robot (Freddy), monstruo (The Boiled One), hombre; ya tirado no habla', /^VZ_r_dolor/.test(voz.Freddy.dolor[0]) && /^VZ_r_muere/.test(voz.Freddy.muere[0]) && /^VZ_z_dolor/.test(voz.BoiledOne.dolor[0]) && /^VZ_z_muere/.test(voz.BoiledOne.muere[0]) && /^VZ_h_dolor[789]$/.test(voz.Hero.muere[0]) && ['Freddy', 'BoiledOne', 'Hero'].every((s) => !voz[s].yaTirado.length), voz);
ok('el emote de saludo dice "hola"', voz.hola.some((n) => /^VZ_h_hola\d$/.test(n)), voz.hola);
// ambiente por mapa (de día y de noche)
const amb = {};
for (const [m, h] of [['FlatGrass', 12], ['FlatGrass', 23], ['City', 12], ['Base', 12], ['RB_Pizzeria', 12]]) {
  await ev(`empezarPartida('${m}'); DIA.hora = ${h}; DIA.aplicada = -1; 1`); await p.waitForTimeout(1800);
  amb[m + '@' + h] = await ev(`[...AUD.loops.keys()].filter((k) => /^amb/.test(k)).map((k) => k + ':' + (AUD.loops.get(k).s.buffer ? 'ok' : '-'))`);
}
ok('ambiente: viento en el campo (y ranas de noche), la ciudad, el zumbido de adentro y nada en la pizzería', amb['FlatGrass@12'].join() === 'amb:ok' && amb['FlatGrass@23'].includes('ambN:ok') && amb['City@12'].join() === 'amb:ok' && amb['Base@12'].join() === 'amb:ok' && !amb['RB_Pizzeria@12'].length, amb);
// gm_construct: pisos de varias clases
await ev(`empezarPartida('RB_Construct'); 1`); await p.waitForTimeout(2000);
const sGC = await sup();
ok('gm_construct: el piso tiene varias clases, las de Source (arena en el terreno, hormigón, metal...)', (sGC.sand || 0) > 0 && (sGC.concrete || 0) > 0 && Object.keys(sGC).length >= 3, sGC);
// todo lo que se puede nombrar está en el paquete
const faltan = await ev(`(() => { const L = []; for (const s of SUP) for (let i = 1; i <= 4; i++) L.push('PS_' + s + i);
  for (const c of ['h', 'm']) for (const [t, n] of Object.entries(VOZ_N)) for (let i = 1; i <= n; i++) L.push('VZ_' + c + '_' + t + i);
  for (const [c, o] of Object.entries(VOZ_OTRO)) for (const [t, n] of Object.entries(o)) for (let i = 1; i <= n; i++) L.push('VZ_' + c + '_' + t + i);
  for (const A of Object.values(AMB)) L.push(A.loop); L.push('AM_ranas', 'AM_camion', 'AM_rafaga1', 'AM_rafaga2'); for (let i = 1; i <= 7; i++) L.push('AM_ave' + i); for (let i = 1; i <= 6; i++) L.push('AM_pajaro' + i); for (let i = 1; i <= 8; i++) L.push('AM_bicho' + i);
  return { total: L.length, faltan: L.filter((n) => !DATA.son.includes(n)) }; })()`);
ok('todos los sonidos que se nombran están en el paquete', !faltan.faltan.length, faltan);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::/.test(e)).slice(0, 5));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
