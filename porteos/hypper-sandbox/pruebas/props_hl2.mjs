// los props de Half-Life 2 (Props → HL2) y los recipientes de agua: cada uno aparece, apoya en el piso con la malla (ni
// flota ni se hunde más de 3 cm), queda quieto, tiene ícono y nombre; los explosivos explotan a los tiros; en el lago lo
// pesado (bloque, sierra, carrito) se hunde y lo liviano (sandía, barril, caja) flota; foto de todos en fila.
// uso: node props_hl2.mjs HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(HTML);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'alto'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); DIA.hora = 12; DIA.aplicada = -1; 1`);
await p.waitForTimeout(2500);
const L = await ev(`(() => { const P = DATA.menu.find((c) => c.n === 'Props'); return ['HL2', 'Agua'].map((n) => (P.sub.find((s) => s.n === n) || { it: [] }).it); })()`);
const TODOS = [...L[0], ...L[1]];
ok('Props → HL2 tiene 15 y Props → Agua 4, cada uno con ícono y nombre traducido', L[0].length === 15 && L[1].length === 4 &&
  await ev(`${JSON.stringify(TODOS)}.every((n) => DATA.ico[n] && DATA.pfPorNombre[n] && T('pr.' + n) !== 'pr.' + n)`), L);
// en fila delante del jugador, sin chocar entre ellos; 4 s de física
const r = await ev(`(() => { $('hud').classList.add('oc'); const L = ${JSON.stringify(TODOS)}, f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), d = v3(f.z, 0, -f.x), out = {}; window.__o = [];
  L.forEach((n, i) => { const fila = i < 10 ? 0 : 1, j = fila ? i - 10 : i, c = v3(JUG.pos.x + f.x * (7 + fila * 4) + d.x * (j - 4.5) * 2.6, JUG.pos.y + 2, JUG.pos.z + f.z * (7 + fila * 4) + d.z * (j - 4.5) * 2.6);
    const piso = pisoBajo(c, 10), o = crearObjeto(n, v3(c.x, piso, c.z), Quat.axis(0, 1, 0, JUG.yaw + Math.PI)); o.piso = piso; window.__o.push(o); });
  for (let i = 0; i < 240; i++) { aguaFisica(1 / 60); physStep(1 / 60); }
  for (const o of window.__o) {
    objetoMatriz(o); o.md.actualizar(); let lo = 1e9;
    for (let i = 0; i < o.md.A.length; i++) { const x = o.md.A[i]; if (!o.md.ver[i] || x.m === undefined || x.m < 0) continue; const P = mallaCPU(x.m).P, W = o.md.W[i];
      for (let k = 0; k < P.length; k += 3) lo = Math.min(lo, W[1] * P[k] + W[5] * P[k + 1] + W[9] * P[k + 2] + W[13]); }
    out[o.nombre] = { apoyo: +((lo - o.piso) * 100).toFixed(1), v: +(o.b.vel.len() + o.b.ang.len()).toFixed(3), quieto: o.b.sleep, tipo: o.tipo }; }
  return out; })()`);
const malos = Object.entries(r).filter(([, x]) => Math.abs(x.apoyo) > 3);
ok('todos apoyan en el piso con la malla (±3 cm)', !malos.length, malos.length ? Object.fromEntries(malos) : Object.fromEntries(Object.entries(r).map(([k, x]) => [k, x.apoyo])));
const mov = Object.entries(r).filter(([, x]) => x.v > 0.05);
ok('a los 4 s están quietos', !mov.length, mov.length ? Object.fromEntries(mov) : 'todos');
ok('el barril rojo, el bidón de nafta y la garrafa son explosivos', ['BarrilExplosivo', 'BidonNafta', 'Garrafa'].every((n) => r[n] && r[n].tipo === 'explota'), ['BarrilExplosivo', 'BidonNafta', 'Garrafa'].map((n) => r[n] && r[n].tipo));
await ev(`JUG.pitch = 0.32; 1`); await p.waitForTimeout(900);
await p.screenshot({ path: D + 'props_hl2.png' });
// los explosivos: dos tiros y explota (se borra y hace la explosión)
const ex = await ev(`(async () => { const o = window.__o.find((x) => x.nombre === 'BarrilExplosivo'); let exp = 0; const f = explosion; explosion = function () { exp++; return f.apply(this, arguments); };
  for (let i = 0; i < 2; i++) danarObjeto(o, 25); await new Promise((ok) => setTimeout(ok, 300)); explosion = f; return { explosiones: exp, borrado: !OBJS.includes(o) }; })()`);
ok('el barril explosivo explota a los tiros', ex.explosiones >= 1 && ex.borrado, ex);
// en el lago de gm_construct
await ev(`empezarPartida('RB_Construct'); 1`); await p.waitForTimeout(2500);
const ag = await ev(`(() => { const v = AGUA.vols[0], out = {}; const L = ['Sandia', 'Barril', 'CajaMadera', 'Neumatico', 'Ladrillo', 'Sierra', 'Carrito', 'Radiador'];
  const os = L.map((n, i) => crearObjeto(n, v3(86 + i * 3.2, v.y1 + 1, -49.6), new Quat()));
  for (let i = 0; i < 600; i++) { aguaFisica(1 / 60); physStep(1 / 60); }
  os.forEach((o) => { out[o.nombre] = +(o.b.pos.y - v.y1).toFixed(2); borrarObjeto(o, true); }); return out; })()`);
ok('en el agua lo liviano flota (sandía, barril, caja, neumático: centro a menos de 0,5 m de la superficie)', ['Sandia', 'Barril', 'CajaMadera', 'Neumatico'].every((n) => ag[n] > -0.5), ag);
ok('y lo pesado se hunde (bloque, sierra, carrito, radiador: más de 2 m abajo)', ['Ladrillo', 'Sierra', 'Carrito', 'Radiador'].every((n) => ag[n] < -2), ag);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::/.test(e)).slice(0, 5));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
