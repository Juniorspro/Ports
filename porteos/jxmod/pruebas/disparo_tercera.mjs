// El disparo de las armas de los addons en 3ª persona (Discord: «disparo bugeado»: con la Nyan Gun y la skin del perro,
// en 3ª persona el disparo salía de un lugar raro). En GMod la bala sale de los ojos del jugador (Owner:GetShootPos) y la
// trazadora, de la boca del arma en la mano (GetTracerShootPos → el adjunto del modelo de mundo). Con el perro
// (doge_player, del Workshop) y la Nyan Gun (también del Workshop), en 1ª y en 3ª persona:
//  1. la bala sale de los ojos del personaje (≤ 10 cm), no de la cámara que va atrás;
//  2. en 3ª persona la bala va a lo que está en la mira (el punto del centro de la pantalla, a ≤ 15 cm);
//  3. la trazadora (el arcoíris de la Nyan Gun) sale de la boca del arma: a ≤ 60 cm de la mano derecha y hacia adelante
//     (no de donde se creó el arma ni de la cámara). El perro no tiene mano de Valve: sale adelante del hocico;
//  4. la bomba de gatos (la R) aparece adelante del personaje (a ≤ 1,2 m de los ojos; en GMod, a 0,7 m);
//  5. en 1ª persona sigue igual que antes: la bala sale de la cámara y va derecho;
//  6. sin errores de JS.
// uso: node disparo_tercera.mjs URL_HTML [perro|Hero|otra skin] (con gma/123277559.gma y gma/656834283.gma al lado)
import { abrir } from './base.mjs';
const [, , HTML, SKIN = 'perro'] = process.argv, BASE = HTML.replace(/[^/]*$/, '');
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(3000);
const prep = await ev(`(async () => {
  for (const id of ['656834283', '123277559']) { const A = await gmInstalar(id, { nombre: id }, new Uint8Array(await (await fetch('${BASE}gma/' + id + '.gma')).arrayBuffer())); await A.listo; }
  const pm = gmpLista().find((r) => /doge_player\\.mdl$/.test(r)); PREFS.skin = ${JSON.stringify(SKIN)} === 'perro' ? 'gmpm:' + pm : ${JSON.stringify(SKIN)}; jugadorCuerpoNuevo();
  await new Promise((r) => setTimeout(r, 1500));
  spawnElegir('GMod', 'gmswep:weapon_nyangun'); await new Promise((r) => setTimeout(r, 800));
  return { pm, arma: ARM.lista[ARM.i], swep: !!GMA.swep };
})()`);
console.log('preparado', JSON.stringify(prep));
// (se espía cada bala y cada trazadora: de dónde sale, hacia dónde va; y dónde queda la mano derecha del cuerpo)
await ev(`(() => { window.__tiros = []; const fb = gmaBalas; gmaBalas = (e, bt) => { const s = bt.get('Src'), d = bt.get('Dir'); __tiros.push({ src: s ? vG(s) : null, dir: d ? dG(d).norm() : null, ojo: JUG.ojoPos.clone(), cam: CAM.pos.clone(), fwd: CAM.fwd.clone() }); return fb(e, bt); };
  return 1; })()`);
const disparar = (tercera) => ev(`(async () => {
  JUG.tercera = ${tercera}; JUG.pitch = 0.05; for (let i = 0; i < 40; i++) await new Promise((r) => requestAnimationFrame(r));
  __tiros.length = 0; const efs = []; const ge = gmaEfecto; gmaEfecto = (n, d) => { efs.push(n); return ge(n, d); };
  const t0 = TIEMPO.t;
  ENT.disparo = true; for (let i = 0; i < 6; i++) await new Promise((r) => requestAnimationFrame(r)); ENT.disparo = false;
  for (let i = 0; i < 6; i++) await new Promise((r) => requestAnimationFrame(r));
  gmaEfecto = ge;
  // (la referencia: la mano derecha de Valve; un modelo sin ella, como el perro, lleva el arma adelante de los ojos)
  const P = JUG.cuerpo, Mm = new Float32Array(16), sinMano = !!(P.gmp && P.gmp.propio); gmhManoValve(P, 'Right', Mm); const mano = sinMano ? JUG.ojoPos.clone() : v3(Mm[12], Mm[13], Mm[14]);
  // (la trazadora: el StartPos que le dio GetTracerShootPos, en la tabla del efecto)
  const trz = (GMA.efVivos || []).filter((x) => x.clase === 'rb655_nyan_tracer' && x.t0 >= t0 && x.tablaC && x.tablaC.get('StartPos')).map((x) => vG(x.tablaC.get('StartPos')));
  const h = raycast(CAM.pos, CAM.fwd, 200, null), mira = h ? vadd(CAM.pos, vscale(CAM.fwd, h.t)) : null;
  const t = __tiros[0]; if (!t) return { tiros: 0, efs };
  // (la bala: a qué distancia pasa del punto de la mira)
  let errMira = null; if (mira && t.src && t.dir) { const w = vsub(mira, t.src), k = vdot(w, t.dir); errMira = vsub(w, vscale(t.dir, k)).len(); }
  return { tiros: __tiros.length, efs: [...new Set(efs)], srcOjo: +vsub(t.src, t.ojo).len().toFixed(3), srcCam: +vsub(t.src, t.cam).len().toFixed(3), errMira: errMira === null ? null : +errMira.toFixed(3),
    dirCam: +vdot(t.dir, t.fwd).toFixed(4), trz: trz.length, trzMano: trz.length ? +Math.min(...trz.map((q) => vsub(q, mano).len())).toFixed(3) : null, trzAdel: trz.length ? +vdot(vsub(trz[0], mano).norm(), t.dir).toFixed(2) : null, trzOjo: trz.length ? +vsub(trz[0], t.ojo).len().toFixed(3) : null,
    camOjo: +vsub(t.cam, t.ojo).len().toFixed(2), sinMano };
})()`);
const t3 = await disparar(true), t1 = await disparar(false);
console.log('3ª', JSON.stringify(t3)); console.log('1ª', JSON.stringify(t1));
ok('1. en 3ª persona la bala sale de los ojos del personaje (≤ 10 cm), no de la cámara', t3.tiros > 0 && t3.srcOjo <= 0.1, { srcOjo: t3.srcOjo, srcCam: t3.srcCam, camOjo: t3.camOjo });
ok('2. en 3ª persona la bala va a lo que está en la mira (≤ 15 cm del punto del centro)', t3.errMira !== null && t3.errMira <= 0.15, { errMira: t3.errMira });
ok('3. la trazadora sale de la boca del arma: ≤ 60 cm de la mano derecha (sin mano: de los ojos) y hacia adelante', t3.trz > 0 && t3.trzMano <= 0.6 && t3.trzAdel > 0.5, { trz: t3.trz, trzMano: t3.trzMano, trzAdel: t3.trzAdel, sinMano: t3.sinMano });
// la bomba de gatos (la R: ents.Create en GetShootPos + 28 adelante + 24 a la derecha): dónde aparece, en el mismo cuadro
const bomba = await ev(`(async () => {
  JUG.tercera = true; for (let i = 0; i < 30; i++) await new Promise((r) => requestAnimationFrame(r));
  const vistas = new Set([...GMA.ents.values()].filter((e) => e.clase === 'ent_nyan_bomb')), pos = [];
  const sp = gmaSwepPaso; gmaSwepPaso = (...a) => { const r = sp(...a); for (const e of GMA.ents.values()) if (e.clase === 'ent_nyan_bomb' && !vistas.has(e)) { vistas.add(e); pos.push(+vsub(gmaEntPos(e), JUG.ojoPos).len().toFixed(2)); } return r; };
  ENT.teclas.add('KeyR'); for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r)); ENT.teclas.delete('KeyR');
  for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r)); gmaSwepPaso = sp;
  return { n: pos.length, d: pos.length ? Math.min(...pos) : null };
})()`);
ok('4. la bomba de gatos aparece adelante del personaje (≤ 1,2 m de los ojos)', bomba.n > 0 && bomba.d <= 1.2, bomba);
ok('5. en 1ª persona la bala sale de la cámara y va derecho', t1.tiros > 0 && t1.srcCam <= 0.1 && t1.dirCam >= 0.999, { srcCam: t1.srcCam, dirCam: t1.dirCam });
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|shader simplificado|willReadFrequently|\[GMod\]/i.test(x));
ok('6. sin errores de JS', !e.length, e.slice(0, 4));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
