// sonidos de lo que hace el jugador (los de HL2 de GMod 10): saltar (el paso), caer (golpe sordo; de muy alto, el quejido),
// cambiar de arma (el clic), usar sin nada adelante (el de negar), arrancar a correr (el traje), y los pasos propios
// más fuertes que antes; sin errores.
// uso: node sonidos_accion.mjs URL_HTML
import { abrir } from './base.mjs';
const { b, p, err, ev } = await abrir(process.argv[2]);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
await ev(`window.__s = []; const f0 = sonar; sonar = function (n, pos, vol) { window.__s.push([n, +(vol || 0).toFixed(2)]); return f0.apply(this, arguments); }; 1`);
const E = (o) => `Object.assign({ x: 0, y: 0, saltar: false, agachar: false, correr: false }, ${JSON.stringify(o)})`;
const r = await ev(`(() => { const out = {}, toma = () => { const s = window.__s.slice(); window.__s.length = 0; return s; };
  for (let i = 0; i < 30; i++) jugadorPaso(1 / 60, ${E({})}); toma();
  JUG.tiempoSuelo = 1; jugadorPaso(1 / 60, ${E({ saltar: true })}); out.salto = toma();
  JUG.pos.y += 4; JUG.vel.set(0, 0, 0); JUG.suelo = false; for (let i = 0; i < 120 && !JUG.suelo; i++) jugadorPaso(1 / 60, ${E({})}); out.cae4 = toma();
  JUG.pos.y += 12; JUG.vel.set(0, 0, 0); JUG.suelo = false; for (let i = 0; i < 240 && !JUG.suelo; i++) jugadorPaso(1 / 60, ${E({})}); out.cae12 = toma();
  elegirArma((ARM.i + 1) % ARM.lista.length); out.arma = toma();
  JUG.pitch = -1.2; usar(); out.usar = toma(); JUG.pitch = 0;
  for (let i = 0; i < 20; i++) jugadorPaso(1 / 60, ${E({ y: 1, correr: true })}); out.correr = toma();
  return out; })()`);
ok('saltar suena (el paso del piso)', r.salto.some(([n]) => /^PS_/.test(n)), r.salto);
ok('caer de 4 m: golpe sordo; de 12 m: también el quejido de la caída', r.cae4.some(([n]) => /^PL_golpe/.test(n)) && !r.cae4.some(([n]) => /^PL_caida/.test(n)) && r.cae12.some(([n]) => /^PL_caida/.test(n)), { cae4: r.cae4, cae12: r.cae12 });
ok('cambiar de arma suena', r.arma.length > 0, r.arma);
ok('usar sin nada adelante: el sonido de negar', r.usar.some(([n]) => n === 'UI_niega'), r.usar);
ok('arrancar a correr: el traje (una vez)', r.correr.filter(([n]) => n === 'PL_correr').length === 1, r.correr);
const listos = await ev(`['PL_caida1', 'PL_golpe1', 'UI_arma', 'UI_niega', 'PL_correr', 'IT_linterna'].map((n) => !!PK.parte('a:' + n))`);
ok('los sonidos nuevos están en el juego', listos.every(Boolean), listos);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
