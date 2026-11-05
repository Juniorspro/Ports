// Agacharse y escaleras (pedido del Discord, Liminal Hotel: «el personaje se agacha muy poco como para entrar aquí» y
// «cuesta muchísimo subir las escaleras, además se buguea a la hora de saltar»). En gm_construct, con cajas fijas que
// chocan como las del mapa, manejando al jugador con el teclado (W adelante, Ctrl agacharse, Espacio saltar):
//  1. un techo a 1,25 m: parado no pasa; agachado sí (como en GMod el cuerpo agachado mide la mitad: 0,95 m) y los ojos
//     quedan por debajo del techo;
//  2. si suelta agacharse debajo del techo, sigue agachado (no se mete en el techo) y al salir se para solo;
//  3. una escalera de 8 escalones de 20 cm (8 unidades de Source) y otra de 40 cm (16): llega arriba caminando, a más del
//     70 % de la velocidad en llano, con el pie apoyado casi siempre, y la cámara sube pareja (cuadro a cuadro: si el cuerpo
//     sube a escalones —se aparta más de 3 cm de una subida pareja— la cámara se aparta al menos un 25 % menos; si no,
//     menos de 3 cm);
//  4. en la escalera se puede saltar;
//  5. sin errores de JS.
// uso: node agacharse_escalones.mjs URL_HTML
import { abrir } from './base.mjs';
const [, , HTML] = process.argv;
const caso = (n, ok, info) => { console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 700)); return ok; };
const { b, p, ev, err: errJS } = await abrir(HTML, false, null);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(1500);
// (un lugar llano y despejado: el piso de ahí, y todo hacia +x)
const X0 = -20, Z0 = 10;
// (un piso plano propio, alto en el cielo: el de gm_construct no es parejo)
const piso = 60;
await ev(`(() => { cerrarPaneles(); cajaFija(v3(${X0} + 10, ${piso} - 0.5, ${Z0} + 6), [22, 0.5, 14]); return 1; })()`);
const poner = (x, z) => ev(`(() => { JUG.noclip = false; JUG.pos.set(${x}, ${piso} + 0.951, ${z}); JUG.vel.set(0, 0, 0); JUG.yaw = Math.PI / 2; JUG.pitch = 0; JUG.agCol = false; return 1; })()`);
const muestra = () => ev(`({ x: JUG.pos.x, y: JUG.pos.y - ${piso} - 0.95, ojo: JUG.ojoPos.y - ${piso}, suelo: JUG.suelo, ag: !!JUG.agCol, vy: JUG.vel.y })`);
async function caminar(ms, teclas) {
  for (const k of teclas) await p.keyboard.down(k);
  const L = [], t0 = Date.now(); while (Date.now() - t0 < ms) { L.push(await muestra()); await p.waitForTimeout(60); }
  for (const k of teclas) await p.keyboard.up(k);
  return L;
}
let bien = 0, tot = 0;
// 1 y 2: el techo bajo
const XT = X0 + 3;
await ev(`(() => { window.__techo = cajaFija(v3(${XT}, ${piso} + 1.35, ${Z0}), [1.5, 0.1, 2]); return 1; })()`);
await poner(X0, Z0); await p.waitForTimeout(300);
const parado = await caminar(2500, ['w']);
const maxParado = Math.max(...parado.map((s) => s.x));
await poner(X0, Z0); await p.waitForTimeout(300);
await p.keyboard.down('Control');
const ag = await caminar(3000, ['w']);
const debajo = ag.filter((s) => Math.abs(s.x - XT) < 1.2);
await p.keyboard.up('Control');
// (suelta agacharse debajo del techo: se queda agachado; después sale caminando)
await ev(`(() => { JUG.pos.x = ${XT}; JUG.vel.set(0, 0, 0); return 1; })()`); await p.waitForTimeout(400);
const suelto = await muestra();
const sale = await caminar(2500, ['w']);
const afuera = sale[sale.length - 1];
tot++; if (caso('1. techo a 1,25 m: parado no pasa, agachado sí y los ojos quedan debajo', maxParado < XT - 1.5 + 0.05 && debajo.length > 2 && Math.max(...debajo.map((s) => s.ojo)) < 1.25 - 0.05, { piso, maxParado: +maxParado.toFixed(2), bordeTecho: XT - 1.5, agachadoLlego: +Math.max(...ag.map((s) => s.x)).toFixed(2), ojoDebajo: debajo.length ? +Math.max(...debajo.map((s) => s.ojo)).toFixed(2) : null })) bien++;
tot++; if (caso('2. debajo del techo, al soltar sigue agachado; al salir se para solo', suelto.ag && suelto.ojo < 1.2 && afuera.x > XT + 1.5 + 0.4 && !afuera.ag && afuera.ojo > 1.5, { suelto, afuera })) bien++;
await ev(`(() => { cajaQuitar(window.__techo); return 1; })()`);
// 3 y 4: escaleras de 20 y 40 cm
async function escalera(h, z) {
  const n = 8, d = 0.36, x1 = X0 + 2;
  // (cada escalón es una caja desde el piso hasta su altura, del escalón i hasta el final: así no quedan huecos debajo)
  await ev(`(() => { window.__esc = []; for (let i = 0; i < ${n}; i++) { const x0 = ${x1} + ${d} * i, x1 = ${x1} + ${d} * ${n} + 2, top = ${piso} + ${h} * (i + 1); window.__esc.push(cajaFija(v3((x0 + x1) / 2, (${piso} - 0.5 + top) / 2, ${z}), [(x1 - x0) / 2, (top - ${piso} + 0.5) / 2, 1.5])); } return 1; })()`);
  await poner(X0, z); await p.waitForTimeout(300);
  // (la altura de los ojos en cada cuadro, grabada adentro del juego: las muestras de afuera van cada 60–80 ms, más
  // espaciadas que los escalones, y mezclaban el ritmo de la escalera con los tirones)
  await ev(`(() => { window.__rec = []; window.__recOn = true; const f = () => { if (!window.__recOn) return; window.__rec.push([JUG.pos.x, JUG.pos.y - ${piso} - 0.95, JUG.ojoPos.y - ${piso}]); requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`);
  const L = await caminar(4500, ['w']);
  const R = await ev(`(() => { window.__recOn = false; return window.__rec; })()`);
  const arriba = h * n, llego = L.findIndex((s) => s.y > arriba - 0.05);
  const subiendo = L.filter((s) => s.x > x1 - 0.3 && s.y < arriba - 0.05);
  // (cuánto se aparta de una subida pareja —la recta que mejor sigue la subida según se avanza—, el cuerpo y la cámara: el
  // cuerpo sube a escalones; la cámara tiene que suavizarlos. Sólo sobre la escalera: al final se cae al piso)
  const sub = R.filter((r) => r[0] > x1 + 0.2 && r[0] < x1 + d * (n - 1) && r[1] < arriba - 0.05);
  const resto = (k) => { const n = sub.length; if (n < 4) return 0; const xs = sub.map((r) => r[0]), ys = sub.map((r) => r[k]); const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; } const m = sxy / sxx; let q = 0; for (let i = 0; i < n; i++) q += (ys[i] - (my + m * (xs[i] - mx))) ** 2; return Math.sqrt(q / n); };
  const cuerpoRms = resto(1), camRms = resto(2), salto = cuerpoRms ? camRms / cuerpoRms : 0;
  if (process.env.DBG) console.log('traza ' + h + ': ' + L.filter((s) => s.x > x1 - 0.6 && s.x < x1 + 3.5).map((s) => [s.x.toFixed(2), s.y.toFixed(2), s.suelo ? 'S' : '-', s.vy.toFixed(1)].join(' ')).join(' | '));
  // (la velocidad: lo recorrido en x mientras sube, por el tiempo; en llano, 6 m/s)
  const tSub = subiendo.length * 0.06 || 1, dx = subiendo.length ? subiendo[subiendo.length - 1].x - subiendo[0].x : 0;
  // saltar a mitad de la escalera, subiéndola
  await poner(X0, z); await p.waitForTimeout(300);
  await p.keyboard.down('w'); await p.waitForTimeout(480); await p.keyboard.down(' ');
  const S = []; for (let i = 0; i < 10; i++) { S.push(await muestra()); await p.waitForTimeout(40); }
  await p.keyboard.up(' '); await p.keyboard.up('w');
  await ev(`(() => { for (const c of window.__esc) cajaQuitar(c); return 1; })()`);
  return { h, llego: llego >= 0, tLlegoMs: llego >= 0 ? llego * 60 : null, alto: +Math.max(...L.map((s) => s.y)).toFixed(2), vel: +(dx / tSub).toFixed(2), apoyado: subiendo.length ? +(subiendo.filter((s) => s.suelo).length / subiendo.length).toFixed(2) : 0, camaraVsCuerpo: +salto.toFixed(2), cuerpoRmsCm: +(cuerpoRms * 100).toFixed(1), camaraRmsCm: +(camRms * 100).toFixed(1), cuadros: sub.length, salto: Math.max(...S.map((s) => s.vy)) > 2 };
}
const e20 = await escalera(0.2, Z0 + 6), e40 = await escalera(0.4, Z0 + 12);
tot++; if (caso('3. escaleras de 20 y 40 cm: llega arriba caminando, rápido, apoyado y con la cámara suave', [e20, e40].every((e) => e.llego && e.vel > 6 * 0.7 && e.apoyado > 0.6 && (e.cuerpoRmsCm < 3 ? e.camaraRmsCm < 3 : e.camaraVsCuerpo <= 0.75)), { e20, e40 })) bien++;
tot++; if (caso('4. en la escalera se puede saltar', e20.salto && e40.salto, { e20: e20.salto, e40: e40.salto })) bien++;
const err = errJS.filter((e) => !/Failed to load resource|net::ERR|404|CORS|Access to fetch|WebSocket|willReadFrequently/i.test(e));
tot++; if (caso('5. sin errores de JS', !err.length, { err: err.slice(0, 5) })) bien++;
console.log('RESUMEN ' + bien + '/' + tot);
await b.close();
process.exit(bien === tot ? 0 : 1);
