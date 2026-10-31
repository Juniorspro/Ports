// los personajes de Doctor Nowhere junto al Hero: alto de verdad (la malla con su piel), pies (o patas de silla) en el
// piso parados y caminando, fotos en fila y de cada uno de cerca. The Boiled One flota: no camina (las piernas no se
// mueven), se inclina hacia donde va y se despega del piso un poco. Jugando con uno alto (Sunman): choca como el Hero
// (pasa por una puerta de 2,05 m), los ojos a su altura al aire libre y abajo de la viga al pasar, sin saltos.
// uso: node skins_dn.mjs HTML CARPETA [SKINS separados por coma]
import { abrir } from './base.mjs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(HTML);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'alto'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); DIA.hora = 12; DIA.aplicada = -1; 1`);
await p.waitForTimeout(3000);
const TODOS = (process.argv[4] || 'Jeppy,UncleJeppy,Sunman,Filbus,BoiledOne').split(',');
const SK = ['Hero', ...(await ev(`${JSON.stringify(TODOS)}.filter((s) => DATA.chars.includes(s))`))];
// alto esperado respecto del Hero (canon: Jeppy 1,68 m; los demás altos) ±5 % (la animación de quieto lo mueve unos %)
const ALTO = { Jeppy: 0.884, UncleJeppy: 1.16, Sunman: 1.37, Filbus: 0.945, BoiledOne: 1.53, Bon: 1.2, Sha: 1.04, Alternate: 0.95, Partygoer: 1.05, Bacteria: 1.32 };   // (Filbus: sin --alto, la medida de su modelo)
ok('están en la lista con retrato y nombre', await ev(`${JSON.stringify(SK.slice(1))}.every((s) => DATA.ico[RETRATO[s]] && skinNom(s))`), SK.map((s) => s));
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
  const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), d = v3(f.z, 0, -f.x), out = {}, n = ${SK.length};
  ${JSON.stringify(SK)}.forEach((s, i) => { const P = crearPersona(s, 'HatEmpty', { nombre: '' }); P.npc = true; P.t = 0; if (P.hum) P.hum.t = 0; window.__fila.push(P);
    P.pos.set(JUG.pos.x + f.x * 6 + d.x * (i - (n - 1) / 2) * 1.3, piso + 0.95, JUG.pos.z + f.z * 6 + d.z * (i - (n - 1) / 2) * 1.3); P.yaw = JUG.yaw + Math.PI; P.vel.set(0, 0, 0); P.suelo = true;
    // (150 cuadros: el apoyo de los pies se asienta de a poco)
    for (let k = 0; k < 150; k++) { animarPersona(P, 1 / 30); ubicarPersona(P); aterrizarPies(P); piesIK(P, 1 / 30); }
    const [lo, hi] = window.__malla(P); out[s] = { alto: +(hi - lo).toFixed(3), suela: +((lo - piso) * 100).toFixed(1), tam: P.tam, flota: P.flota }; });
  return out; })()`);
console.log(JSON.stringify(fila));
const H = fila.Hero.alto;
for (const s of SK.slice(1)) ok(s + ': alto ' + ALTO[s] + ' del Hero (±5 %)', Math.abs(fila[s].alto / H / ALTO[s] - 1) < 0.05, +(fila[s].alto / H).toFixed(3) + ' · ' + (fila[s].alto * 1.9 / H).toFixed(2) + ' m');
ok('parados: nada flota ni se hunde más que el Hero (+2 cm)', SK.every((s) => fila[s].suela <= 0.5 && fila[s].suela >= fila.Hero.suela - 2), SK.map((s) => fila[s].suela));
// caminando (los que flotan, deslizándose): la suela más baja de cada cuadro y, en los que flotan, que las piernas no se muevan
const camina = await ev(`(() => { const out = {}; for (const P of window.__fila) { P.vel.set(Math.sin(P.yaw) * 3, 0, Math.cos(P.yaw) * 3); let mn = 1e9, mx = -1e9, inc = 0;
  const iL = P.D.h['LeftUpLeg'] ?? P.D.h[Object.keys(P.D.h).find((k) => /LeftUpLeg$/.test(k))], r0 = []; let dl = 0;
  for (let k = 0; k < 60; k++) { animarPersona(P, 1 / 30); ubicarPersona(P); aterrizarPies(P); piesIK(P, 1 / 30); if (k > 20) { const [lo] = window.__malla(P); mn = Math.min(mn, lo); mx = Math.max(mx, lo);
      if (P.flota) { inc = Math.max(inc, P.hum.flInc || 0); } if (iL !== undefined) { const r = P.md.r[iL]; if (r0.length) dl = Math.max(dl, Math.abs(r[0] * r0[0] + r[1] * r0[1] + r[2] * r0[2] + r[3] * r0[3])); else r0.push(...r); } } }
  P.vel.set(0, 0, 0); for (let k = 0; k < 150; k++) { animarPersona(P, 1 / 30); ubicarPersona(P); aterrizarPies(P); piesIK(P, 1 / 30); }
  const [lo2] = window.__malla(P);
  out[P.skin] = { suela: [+((mn - window.__piso) * 100).toFixed(1), +((mx - window.__piso) * 100).toFixed(1)], inclina: +(inc * 180 / Math.PI).toFixed(1), quieto: +((lo2 - window.__piso) * 100).toFixed(1), alto: +(((P.hum && P.hum.flAlto) || 0) * 100).toFixed(2) }; } return out; })()`);
console.log(JSON.stringify(camina));
const caminan = SK.filter((s) => !fila[s].flota), flotan = SK.filter((s) => fila[s].flota);
// (los de pies finitos, Sunman con las puntas y Filbus con las patas de silla, levantan lo más bajo hasta 3 cm por un instante
// entre paso y paso)
ok('caminando: lo más bajo no se hunde más que el Hero (+3 cm) ni se levanta más de 3,5 cm', caminan.every((s) => camina[s].suela[0] >= camina.Hero.suela[0] - 3 && camina[s].suela[1] <= 3.5), caminan.map((s) => [s, camina[s].suela]));
if (flotan.length) {
  // (respecto de cómo apoya parado; la animación de quieto mueve la cadera unos cm, como en el Hero)
  ok('los que flotan: deslizándose se despegan 2-9 cm de donde apoyan parados y se inclinan 5-10°', flotan.every((s) => camina[s].suela[0] - fila[s].suela > 2 && camina[s].suela[1] - fila[s].suela < 9 && camina[s].inclina >= 5 && camina[s].inclina <= 10), flotan.map((s) => [s, camina[s], fila[s].suela]));
  ok('los que flotan: al frenar vuelven a apoyarse (sin despegue y a ±4 cm de parados)', flotan.every((s) => camina[s].alto < 0.5 && Math.abs(camina[s].quieto - fila[s].suela) < 4), flotan.map((s) => [s, camina[s].quieto, fila[s].suela, camina[s].alto]));
}
const mirar = (pp, t) => `(() => { const p = v3(${pp}), t = v3(${t}), f = vsub(t, p).norm(); let q = Quat.euler(Math.atan2(f.x, f.z), Math.asin(f.y));
  if (q.rot(v3(0, 0, 1)).distTo(f) > 0.01) q = Quat.euler(Math.atan2(f.x, f.z), -Math.asin(f.y)); DBG.cam = { p, q }; return 1; })()`;
const c = await ev(`(() => { const a = window.__fila[0].pos, b = window.__fila[window.__fila.length - 1].pos; return [(a.x + b.x) / 2, window.__piso, (a.z + b.z) / 2, JUG.yaw]; })()`);
const vista = async (nom, ang, dist, alto, mira, cx = c[0], cz = c[2]) => { const a = c[3] + ang; await ev(mirar(`${cx + Math.sin(a) * dist}, ${c[1] + alto}, ${cz + Math.cos(a) * dist}`, `${cx}, ${c[1] + mira}, ${cz}`)); await p.waitForTimeout(500); await p.screenshot({ path: D + nom + '.jpg', type: 'jpeg', quality: 85 }); };
await vista('dn_fila_frente', Math.PI, 7.5, 1.4, 1.3);
await vista('dn_fila_costado', 0.75, 8, 1.5, 1.3);
for (let i = 1; i < SK.length; i++) { const q = await ev(`[window.__fila[${i}].pos.x, window.__fila[${i}].pos.z]`), h = fila[SK[i]].alto; await vista('dn_cerca_' + SK[i], 0.35, 0.9 + h * 1.0, h * 0.62, h * 0.5, q[0], q[1]); await vista('dn_atras_' + SK[i], Math.PI - 0.5, 0.9 + h * 1.0, h * 0.62, h * 0.5, q[0], q[1]); }
// con un arma (la postura de GMod): de cerca, de 3/4
for (let i = 1; i < SK.length; i++) { await ev(`(() => { const P = window.__fila[${i}]; P.arma = 'Smg'; for (let k = 0; k < 40; k++) animarPersona(P, 1 / 30); ubicarPersona(P); aterrizarPies(P); piesIK(P, 1 / 30); return 1; })()`);
  const q = await ev(`[window.__fila[${i}].pos.x, window.__fila[${i}].pos.z]`), h = fila[SK[i]].alto; await vista('dn_arma_' + SK[i], 0.7, 0.9 + h * 0.9, h * 0.7, h * 0.6, q[0], q[1]); }
await ev(`DBG.cam = null; for (const P of window.__fila) borrarPersona(P); 1`);
// jugando con Sunman (alto): pasa por una puerta de 2,05 m y los ojos bajan al pasar, sin saltos
if (SK.includes('Sunman')) {
  await ev(`window.__esperar = async (s, cond) => { const t0 = TIEMPO.t; while (TIEMPO.t < t0 + s && !(cond && cond())) await new Promise((r) => setTimeout(r, 30)); }; 1`);
  const yo = await ev(`(async () => { PREFS.gfx = 'patata'; aplicarGfx(); JUG.noclip = false; PREFS.skin = 'Sunman'; jugadorCuerpoNuevo(); await window.__esperar(4, () => JUG.suelo && Math.abs(JUG.vel.y) < 1); await window.__esperar(0.5);
    const piso = pisoBajo(v3(JUG.pos.x, JUG.pos.y + 0.5, JUG.pos.z), 5); return { esf: JUG.esf.map((e) => e[0]), ojo: +(JUG.ojoPos.y - piso).toFixed(3), tam: JUG.tam }; })()`);
  ok('jugando con Sunman: ojos a su altura (2,1-2,4 m) y el cuerpo como el del Hero', yo.ojo > 2.1 && yo.ojo < 2.4 && Math.max(...yo.esf) <= 0.5 + 1e-6, yo);
  const puerta = await ev(`(async () => {
    const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), piso = pisoBajo(v3(JUG.pos.x, JUG.pos.y + 0.5, JUG.pos.z), 5);
    const c = v3(JUG.pos.x + f.x * 3, piso + 2.05 + 0.1, JUG.pos.z + f.z * 3);
    const viga = new Body(boxShape(1.5, 0.1, 0.4), 0); viga.pos.copy(c); viga.q.copy(Quat.axis(0, 1, 0, JUG.yaw)); viga.updateWorld(); addBody(viga);
    const ojos = []; JUG.pos.set(c.x - f.x * 3, piso + 0.95, c.z - f.z * 3); JUG.vel.set(0, 0, 0); await window.__esperar(0.3);
    // (alto de los ojos con el tiempo del juego: la velocidad a la que bajan, en m/s, no depende de cuántos cuadros haga el navegador)
    ENT.teclas.add('KeyW'); const t0 = TIEMPO.t; while (TIEMPO.t < t0 + 1.6) { ojos.push([TIEMPO.t, JUG.ojoPos.y - piso]); await new Promise((r) => setTimeout(r, 30)); } ENT.teclas.delete('KeyW');
    removeBody(viga); let vel = 0; for (let i = 1; i < ojos.length; i++) { const dt = ojos[i][0] - ojos[i - 1][0]; if (dt > 0.005) vel = Math.max(vel, Math.abs(ojos[i][1] - ojos[i - 1][1]) / dt); }
    return { paso: +vdot(vsub(JUG.pos, v3(c.x - f.x * 3, 0, c.z - f.z * 3)), f).toFixed(2), min: +Math.min(...ojos.map((o) => o[1])).toFixed(2), vel: +vel.toFixed(2) }; })()`);
  ok('Sunman pasa por una puerta de 2,05 m', puerta.paso > 4, puerta);
  ok('al pasar los ojos quedan abajo de la viga (< 1,95 m) y bajan sin saltos (a menos de 2,6 m/s)', puerta.min < 1.95 && puerta.vel < 2.6, puerta);
}
ok('sin errores', !err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).length, err.slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
