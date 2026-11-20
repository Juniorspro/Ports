// Pepe vuelve (juego/pepe_vuelve.js) y el evento de los 300 apagado:
//  1. el evento ya no arranca (aunque haya quedado guardado a la mitad) y el sorteo da ~26 %;
//  2. con ?pepe=3 aparece a los 3 s de jugar, atrás tuyo, a 13–17 m, oscuro, con la cinta un instante;
//  3. te sigue (se acerca), habla con subtítulo y con un menú abierto se queda quieto;
//  4. si te alejás mucho reaparece atrás tuyo, cerca;
//  5. te alcanza: «Ahora te toca a vos.» y el screamer, la cara en el medio de la pantalla a medio metro;
//  6. después se va: sin Pepe, sin cinta, te podés mover, y no vuelve en ese mapa;
//  7. sin ?pepe, en las pruebas no aparece; sin errores de JS.
// uso: node pepe_vuelve.mjs URL_HTML [CARPETA=/tmp/claude-0/pepe_vuelve]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/pepe_vuelve'] = process.argv; fs.mkdirSync(D, { recursive: true });
let ok = 0, mal = 0; const chk = (c, m, x) => { if (c) ok++; else mal++; console.log((c ? 'OK    ' : 'FALLA ') + m + (x !== undefined ? ' · ' + JSON.stringify(x) : '')); };
const esperar = (p, js, ms) => p.waitForFunction((s) => window.__ev(s), js, { timeout: ms || 60000, polling: 100 });
const guardado = (pg) => pg.addInitScript(() => { try { localStorage.setItem('jx_ev300', JSON.stringify({ v: 1, fase: 'puzles', hechas: ['cajas', 'fusibles'], reinicios: {} })); } catch (e) {} });
{
  const { b, p, ev, err } = await abrir(HTML + (HTML.includes('?') ? '&' : '?') + 'pepe=3', true, null, guardado);
  const e0 = await ev(`({ activo: EV3_ACTIVO, fase: EV3.fase, estado: JUEGO.estado, arranca: ev3Arranque() })`);
  chk(e0.activo === false && !e0.fase && e0.estado === 'principal' && e0.arranca === false, '1. el evento de los 300 ya no arranca (con lo guardado a la mitad, el menú de siempre)', e0);
  const s = await ev(`(() => { let n = 0; for (let i = 0; i < 20000; i++) if (pvTocaHoy()) n++; return +(n / 200).toFixed(1); })()`);
  chk(s > 25 && s < 27, '1. el sorteo: ~26 % de las veces', s + ' %');
  await ev(`idiomaAplicar('es'); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await esperar(p, `JUEGO.estado === 'juego' && !!JUG.suelo`, 120000);
  await ev(`JUG.yaw = 0; JUG.pitch = 0; 1`);
  await esperar(p, `!!PV.f`, 30000);
  const a = await ev(`(() => { const P = PV.f.P, d = v3(P.pos.x - JUG.pos.x, 0, P.pos.z - JUG.pos.z), L = Math.hypot(d.x, d.z), f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); return { L: +L.toFixed(1), atras: +((d.x * f.x + d.z * f.z) / L).toFixed(2), en: PERS.includes(P), negro: !!(P.md && P.md.tinte), vhs: VHS.on, t: +PV.t.toFixed(1), suelo: +(P.pos.y - 0.96 - pisoBajo(v3(P.pos.x, P.pos.y, P.pos.z), 1)).toFixed(2) }; })()`);
  chk(a.en && a.L >= 3 && a.L <= 18.5 && a.atras < -0.5 && a.vhs, '2. aparece de la nada atrás tuyo, con la cinta un instante', a);
  chk(Math.abs(a.suelo) < 0.15, '2. parado en el piso', a.suelo);
  // (darse vuelta para verlo)
  await ev(`(() => { const P = PV.f.P, d = vsub(P.pos, JUG.pos); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = 0.02; return 1; })()`);
  await p.waitForTimeout(700); await p.screenshot({ path: D + '/pepe_aparece.jpg', quality: 80 });
  // 3: se acerca, habla; con un menú abierto se queda quieto
  await esperar(p, `!document.getElementById('pvSub').classList.contains('oc')`, 10000);
  const sub = await ev(`document.getElementById('pvSub').textContent`);
  chk(sub === '¿Me escuchás? Soy yo. Pepe.', '3. habla, con subtítulo', sub);
  const L0 = await ev(`Math.hypot(PV.f.P.pos.x - JUG.pos.x, PV.f.P.pos.z - JUG.pos.z)`); await p.waitForTimeout(2000);
  const L1 = await ev(`Math.hypot(PV.f.P.pos.x - JUG.pos.x, PV.f.P.pos.z - JUG.pos.z)`);
  chk(L1 < L0 - 1.5, '3. te sigue (se acerca)', { antes: +L0.toFixed(1), despues: +L1.toFixed(1) });
  const q = await ev(`(async () => { UI.abierto = 'prueba'; const p0 = PV.f.P.pos.clone(), t0 = PV.f.t; await new Promise((r) => setTimeout(r, 1500)); const m = p0.distTo(PV.f.P.pos), dt = PV.f.t - t0; UI.abierto = null; return { m: +m.toFixed(3), dt: +dt.toFixed(2) }; })()`);
  chk(q.m < 0.01 && q.dt === 0, '3. con un menú abierto se queda quieto (y el reloj no corre)', q);
  // 4: lejos, reaparece atrás tuyo
  const r = await ev(`(async () => { JUG.pos.x += 60; JUG.vel.set(0, 0, 0); await new Promise((r) => setTimeout(r, 700)); const P = PV.f.P; return +Math.hypot(P.pos.x - JUG.pos.x, P.pos.z - JUG.pos.z).toFixed(1); })()`);
  chk(r < 16, '4. si te alejás mucho, reaparece atrás tuyo', r + ' m');
  // 5: te alcanza (quieto, mirándolo), «Ahora te toca a vos.» y el screamer
  await ev(`(() => { const P = PV.f.P, d = vsub(P.pos, JUG.pos); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = 0.05; return 1; })()`);
  await esperar(p, `PV.f && PV.f.dijoFin >= 0`, 45000);
  const fin = await ev(`({ sub: document.getElementById('pvSub').textContent, L: +Math.hypot(PV.f.P.pos.x - JUG.pos.x, PV.f.P.pos.z - JUG.pos.z).toFixed(2), t: +PV.f.t.toFixed(1), vhs: VHS.on })`);
  chk(fin.sub === 'Ahora te toca a vos.' && fin.L < 1.6 && fin.vhs, '5. te alcanza: «Ahora te toca a vos.», en cinta', fin);
  await p.waitForTimeout(500); await p.screenshot({ path: D + '/pepe_cerca.jpg', quality: 80 });
  await esperar(p, `PV.f && PV.f.fase === 'screamer' && PV.f.t > 0.35`, 15000);
  const g = await ev(`(() => { const h = ev3Hueso(PV.f.P, 'Head'), d = vsub(h, CAM.pos), L = d.len(); return { L: +L.toFixed(2), centro: +(d.dot(CAM.fwd) / L).toFixed(3), bloq: JUG.bloqueado, rojoOsac: VHS.sacudon > 0.2, sinBotones: getComputedStyle($("tactil")).visibility === "hidden", sinArma: EV3.sinVista }; })()`);
  chk(g.L > 0.3 && g.L < 0.75 && g.centro > 0.97 && g.bloq && g.rojoOsac && g.sinBotones && g.sinArma, '5. el screamer: la cara en el medio de la pantalla a medio metro', g);
  await p.screenshot({ path: D + '/pepe_screamer.jpg', quality: 80 });
  // 6: se va
  await esperar(p, `!PV.f`, 10000);
  const z = await ev(`({ pepe: PERS.some((P) => P.pvPepe), vhs: VHS.on, bloq: JUG.bloqueado, negro: VHS.negro, sub: document.getElementById('pvSub').classList.contains('oc'), otra: PV.cuando, botones: getComputedStyle($("tactil")).visibility, arma: !EV3.sinVista })`);
  chk(!z.pepe && !z.vhs && !z.bloq && z.negro === 0 && z.sub && z.otra === -1 && z.botones === "visible" && z.arma, '6. después se va: sin Pepe, sin cinta, te movés, y no vuelve en este mapa', z);
  await p.waitForTimeout(400); await p.screenshot({ path: D + '/pepe_despues.jpg', quality: 80 });
  chk(!err.filter((e) => !/WebSocket connection|broker\./.test(e)).length, '7. sin errores de JS', err.slice(0, 4));
  await b.close();
}
{
  const { b, ev, err, p } = await abrir(HTML, true, null, null);
  await ev(`inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await esperar(p, `JUEGO.estado === 'juego' && !!JUG.suelo`, 120000);
  const n = await ev(`({ cuando: PV.cuando, f: !!PV.f })`);
  chk(n.cuando === -1 && !n.f, '7. sin ?pepe, en las pruebas no aparece', n);
  await b.close();
}
console.log('RESUMEN pepe_vuelve ' + ok + '/' + (ok + mal));
