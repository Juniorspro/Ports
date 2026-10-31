// los personajes nuevos (Rick, Rick Prime, Finn y Jake) junto al Hero: alto de verdad (la malla con su piel, no los
// huesos), pies en el piso (la suela contra el piso, igual que el Hero), parados y caminando; fotos en fila de frente y
// de costado y de cada uno de cerca. Jugando con Jake: la cámara a la altura de sus ojos y su cuerpo bajito (pasa por
// abajo de algo a 1,2 m); y de otro jugador Jake, la cápsula: un tiro por arriba de su cabeza no le pega.
// uso: node skins_nuevos.mjs HTML CARPETA
import { abrir } from './base.mjs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(HTML);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'alto'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); DIA.hora = 12; DIA.aplicada = -1; 1`);
await p.waitForTimeout(3000);
const SK = ['Hero', 'Rick', 'RickPrime', 'Finn', 'Jake'];
ok('están en la lista con retrato y tamaño', await ev(`${JSON.stringify(SK.slice(1))}.every((s) => DATA.chars.includes(s) && DATA.ico[RETRATO[s]])`), await ev(`DATA.tam`));
// la malla con su piel en el mundo: punto más alto y más bajo
await ev(`window.__malla = (P) => { const md = P.md; md.sucio = true; md.actualizar(); let lo = 1e9, hi = -1e9;
  for (const pz of md.pieles) { const x = md.A[pz.i], d = DATA.ms[x.m], c = mallaCPU(x.m), H = pz.h, B = binDe(d), dv = new DataView(B.buffer, B.byteOffset);
    for (let v = 0; v < d.v; v += 3) { let y = 0; const o = d.sk + v * 8;
      for (let k = 0; k < 4; k++) { const bi = dv.getUint8(o + k), w = dv.getUint8(o + 4 + k) / 255; if (!w) continue; const B = bi * 12 + 4;
        y += w * (H[B] * c.P[v * 3] + H[B + 1] * c.P[v * 3 + 1] + H[B + 2] * c.P[v * 3 + 2] + H[B + 3]); }
      lo = Math.min(lo, y); hi = Math.max(hi, y); } }
  return [lo, hi]; }; 1`);
const fila = await ev(`(() => {
  $('hud').classList.add('oc'); JUG.noclip = true; JUG.tercera = false; ARM.v = null;
  const piso = pisoBajo(v3(JUG.pos.x, JUG.pos.y + 2, JUG.pos.z), 10); window.__piso = piso; window.__fila = [];
  const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), d = v3(f.z, 0, -f.x), out = {};
  ${JSON.stringify(SK)}.forEach((s, i) => { const P = crearPersona(s, 'HatEmpty', { nombre: '' }); P.npc = true; P.t = 0; if (P.hum) P.hum.t = 0; window.__fila.push(P);   // (todos en la misma fase de la animación)
    P.pos.set(JUG.pos.x + f.x * 4 + d.x * (i - 2) * 1.15, piso + 0.95, JUG.pos.z + f.z * 4 + d.z * (i - 2) * 1.15); P.yaw = JUG.yaw + Math.PI; P.vel.set(0, 0, 0); P.suelo = true;
    for (let k = 0; k < 40; k++) animarPersona(P, 1 / 30); ubicarPersona(P); aterrizarPies(P); piesIK(P, 1 / 30);
    const [lo, hi] = window.__malla(P); out[s] = { alto: +(hi - lo).toFixed(3), suela: +((lo - piso) * 100).toFixed(1), tam: P.tam }; });
  return out; })()`);
console.log(JSON.stringify(fila));
const H = fila.Hero.alto;
ok('Jake bajito (0,40-0,48 del Hero)', fila.Jake.alto / H > 0.4 && fila.Jake.alto / H < 0.48, +(fila.Jake.alto / H).toFixed(3));
ok('Finn de nene (0,76-0,84 del Hero)', fila.Finn.alto / H > 0.76 && fila.Finn.alto / H < 0.84, +(fila.Finn.alto / H).toFixed(3));
ok('Rick y Rick Prime altos (≥ 0,98 del Hero)', fila.Rick.alto / H >= 0.98 && fila.RickPrime.alto / H >= 0.98, [+(fila.Rick.alto / H).toFixed(3), +(fila.RickPrime.alto / H).toFixed(3)]);
// (todos los personajes del juego hunden la suela unos cm: la raíz va 5 cm abajo de la cápsula; se compara con el Hero)
// (cada calzado es distinto: se pide que ninguna flote y que no se hunda más que el Hero)
ok('suelas apoyadas: ninguna flota ni se hunde más que el Hero (+2 cm)', SK.every((s) => fila[s].suela <= 0.5 && fila[s].suela >= fila.Hero.suela - 2), SK.map((s) => fila[s].suela));
// caminando: la suela más baja de cada cuadro (que no se hunda ni flote) durante 2 s
const camina = await ev(`(() => { const out = {}; for (const P of window.__fila) { P.vel.set(Math.sin(P.yaw) * 3, 0, Math.cos(P.yaw) * 3); let mn = 1e9, mx = -1e9;
  for (let k = 0; k < 60; k++) { animarPersona(P, 1 / 30); ubicarPersona(P); aterrizarPies(P); piesIK(P, 1 / 30); if (k > 10) { const [lo] = window.__malla(P); mn = Math.min(mn, lo); mx = Math.max(mx, lo); } }
  P.vel.set(0, 0, 0); for (let k = 0; k < 30; k++) { animarPersona(P, 1 / 30); ubicarPersona(P); aterrizarPies(P); piesIK(P, 1 / 30); }
  out[P.skin] = [+((mn - window.__piso) * 100).toFixed(1), +((mx - window.__piso) * 100).toFixed(1)]; } return out; })()`);
ok('caminando: la suela más baja nunca flota ni se hunde más que la del Hero (+3 cm)', Object.entries(camina).every(([s, [a, c]]) => a >= camina.Hero[0] - 3 && c <= 0.5), camina);
// fotos de la fila: de frente y de costado (cámara de pruebas)
const mirar = (pp, t) => `(() => { const p = v3(${pp}), t = v3(${t}), f = vsub(t, p).norm(); let q = Quat.euler(Math.atan2(f.x, f.z), Math.asin(f.y));
  if (q.rot(v3(0, 0, 1)).distTo(f) > 0.01) q = Quat.euler(Math.atan2(f.x, f.z), -Math.asin(f.y)); DBG.cam = { p, q }; return 1; })()`;
const c = await ev(`(() => { const P = window.__fila[2]; return [P.pos.x, window.__piso, P.pos.z, JUG.yaw]; })()`);
const vista = async (nom, ang, dist, alto, mira, cx = c[0], cz = c[2]) => { const a = c[3] + ang; await ev(mirar(`${cx + Math.sin(a) * dist}, ${c[1] + alto}, ${cz + Math.cos(a) * dist}`, `${cx}, ${c[1] + mira}, ${cz}`)); await p.waitForTimeout(500); await p.screenshot({ path: D + nom + '.jpg', type: 'jpeg', quality: 85 }); };
await vista('fila_frente', Math.PI, 5.2, 1.1, 0.95);   // (miran hacia el jugador)
await vista('fila_costado', 0.75, 5.6, 1.2, 0.95);
for (let i = 1; i < SK.length; i++) { const q = await ev(`[window.__fila[${i}].pos.x, window.__fila[${i}].pos.z]`), h = fila[SK[i]].alto; await vista('cerca_' + SK[i], 0.35, 0.9 + h * 1.0, h * 0.62, h * 0.5, q[0], q[1]); await vista('atras_' + SK[i], Math.PI - 0.5, 0.9 + h * 1.0, h * 0.62, h * 0.5, q[0], q[1]); }
await ev(`DBG.cam = null; for (const P of window.__fila) borrarPersona(P); 1`);
// jugando con Jake: la cámara y el cuerpo (con gráficos bajos: con los altos el navegador de prueba va lento y la física
// avanza a la mitad del reloj; se espera en tiempo del juego hasta que pise)
const espera = `window.__esperar = async (s, cond) => { const t0 = TIEMPO.t; while (TIEMPO.t < t0 + s && !(cond && cond())) await new Promise((r) => setTimeout(r, 30)); }; 1`;
await ev(espera);
const yo = await ev(`(async () => { PREFS.gfx = 'patata'; aplicarGfx(); JUG.noclip = false; PREFS.skin = 'Jake'; jugadorCuerpoNuevo(); await window.__esperar(4, () => JUG.suelo && Math.abs(JUG.vel.y) < 1); await window.__esperar(0.5);
  return { esf: JUG.esf.map((e) => e[0]), ojo: +JUG.ojoAlto.toFixed(3), tam: JUG.tam }; })()`);
const ojo = await ev(`(() => { const piso = pisoBajo(v3(JUG.pos.x, JUG.pos.y + 0.5, JUG.pos.z), 5); return { ojo: +(JUG.ojoPos.y - piso).toFixed(3), suelo: JUG.suelo }; })()`);
ok('jugando con Jake: ojos a su altura (0,6-0,75 m) y cuerpo de una esfera', ojo.ojo > 0.6 && ojo.ojo < 0.75 && yo.esf.length === 1, { ...yo, ...ojo });
await ev(`PREFS.gfx = 'alto'; aplicarGfx(); $('hud').classList.remove('oc'); JUG.tercera = false; JUG.pitch = 0.1; 1`); await p.waitForTimeout(900); await p.screenshot({ path: D + 'jake_1p.jpg', type: 'jpeg', quality: 85 });
await ev(`JUG.tercera = true; JUG.pitch = 0.15; 1`); await p.waitForTimeout(1200); await p.screenshot({ path: D + 'jake_3p.jpg', type: 'jpeg', quality: 85 });
await ev(`PREFS.gfx = 'patata'; aplicarGfx(); JUG.tercera = false; 1`);
// pasa por abajo de una tabla a 1,2 m (con el Hero no)
const bajo = await ev(`(async () => {
  const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), piso = pisoBajo(v3(JUG.pos.x, JUG.pos.y + 0.5, JUG.pos.z), 5);
  const c = v3(JUG.pos.x + f.x * 3, piso + 1.2 + 0.1, JUG.pos.z + f.z * 3);
  const tb = new Body(boxShape(1.5, 0.1, 1.5), 0); tb.pos.copy(c); tb.q.copy(Quat.axis(0, 1, 0, JUG.yaw)); tb.updateWorld(); addBody(tb); window.__tabla = tb;
  const prueba = async (skin) => { PREFS.skin = skin; jugadorCuerpoNuevo(); JUG.pos.set(c.x - f.x * 3, piso + 0.95, c.z - f.z * 3); JUG.vel.set(0, 0, 0);
    await window.__esperar(0.3); ENT.teclas.add('KeyW'); await window.__esperar(1.4); ENT.teclas.delete('KeyW');
    return +vdot(vsub(JUG.pos, v3(c.x - f.x * 3, 0, c.z - f.z * 3)), f).toFixed(2); };
  const jake = await prueba('Jake'), hero = await prueba('Hero'); removeBody(tb); PREFS.skin = 'Jake'; jugadorCuerpoNuevo(); return { jake, hero }; })()`);
ok('Jake pasa por abajo de una tabla a 1,2 m y el Hero no', bajo.jake > 4 && bajo.hero < 2.4, bajo);
// otro jugador con Jake: su cápsula
const rem = await ev(`(() => { const piso = window.__piso, f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), x = JUG.pos.x + f.x * 5, z = JUG.pos.z + f.z * 5;
  recibirEstado({ i: 'prueba', n: 'Remoto', k: 'Jake', h: 'HatEmpty', p: [x, piso + 0.95, z], v: [0, 0, 0], y: 0, t: 0, f: 5, a: null });
  const R2 = RED.remotos.get('prueba'); R2.pos.copy(R2.meta); remotoPaso(R2, 1 / 30);
  const lado = v3(f.z, 0, -f.x), tiro = (h) => { const o = v3(x - lado.x * 3, piso + h, z - lado.z * 3), hh = raycast(o, lado, 6, null); return !!(hh && hh.body === R2.b); };
  const r = { cap: [+R2.b.shape.r.toFixed(2), +R2.b.shape.hh.toFixed(2)], a04: tiro(0.4), a07: tiro(0.7), a12: tiro(1.2), a16: tiro(1.6) };
  quitarRemoto(R2); RED.remotos.delete('prueba'); return r; })()`);
ok('otro jugador Jake: le pega a 0,4 y 0,7 m, no a 1,2 ni 1,6 m', rem.a04 && rem.a07 && !rem.a12 && !rem.a16, rem);
ok('sin errores', !err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).length, err.slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
