// El evento de los 300 miembros (juego/ev300*.js). Por partes (cada una en su navegador, para no pasar los 10 minutos):
//   intro      sin nada guardado arranca solo con ?ev300: la cinta en VHS a pantalla completa, el cuerpo sentado y atado
//              (las manos detrás del respaldo), las cámaras apuntando a la silla, las 15 voces de Pepe decodificadas,
//              los tres recuerdos bajo el agua, la entidad que entra y pega; después gm_construct de noche con los sellos
//              en 0/10 y guardado en «puzles». Fotos en CARPETA.
//   misiones   las 10 misiones resueltas como un jugador (pararse, apuntar y usar; agarrar y llevar las cajas y las
//              baterías; el teclado, la radio, las luces, las palancas —lo pintado sólo con la linterna—, el sigilo —si
//              te ve te saca—, la llave en el fondo de la pileta, la torre —las plataformas se pueden saltar— y el
//              orden —uno mal lo reinicia—). Cada una suma su sello y queda guardada.
//   bug        con sellos hechos, meterse en el cuarto: te saca y se deshace la última misión.
//   final      con los 10 sellos la puerta se abre; «pedir perdón» a Pepe, el screamer y el reinicio (en la prueba, sin
//              recargar: vuelve al menú); después entrar a gm_construct: el epílogo (sólo caminar, «ÉL VOLVERÁ»), y
//              queda «hecho»: la vez siguiente gm_construct es normal.
// uso: node evento300.mjs URL_HTML parte[,parte] [CARPETA=/tmp/claude-0/ev300/prueba]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, PARTES = 'intro,misiones,bug,final', D = '/tmp/claude-0/ev300/prueba'] = process.argv; fs.mkdirSync(D, { recursive: true });
let ok = 0, mal = 0; const chk = (c, m, x) => { if (c) { ok++; console.log('OK    ' + m + (x !== undefined ? ' · ' + JSON.stringify(x) : '')); } else { mal++; console.log('FALLA ' + m + (x !== undefined ? ' · ' + JSON.stringify(x) : '')); } };
const partes = PARTES.split(',');
const conEstado = (est) => async (pg) => { await pg.addInitScript((e) => { try { if (e === null) localStorage.removeItem('jx_ev300'); else localStorage.setItem('jx_ev300', JSON.stringify(e)); } catch (x) {} }, est); };
// (ayudas en la página: ir a un lugar, apuntar a un punto —la cámara recién se mueve al cuadro siguiente— y usar)
const AYUDA = `window.__ir = (x, z, y) => { JUG.pos.set(x, y === undefined ? ev3Piso(x, z) + 1.0 : y, z); JUG.vel.set(0, 0, 0); return 1; };
  window.__mirar = (p) => { const d = vsub(p, vadd(JUG.pos, v3(0, 0.67, 0))); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); return 1; };
  window.__cuadros = (n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok(1) : requestAnimationFrame(f)); requestAnimationFrame(f); });
  window.__usarEn = async (p, desde) => { if (desde) __ir(desde[0], desde[1], desde[2]); await __cuadros(2); __mirar(p); await __cuadros(3); const txt = $('usarTxt').textContent; ev3Usar(); await __cuadros(2); return txt; };
  1`;
const esperar = (p, js, ms) => p.waitForFunction((s) => window.__ev(s), js, { timeout: ms || 60000, polling: 100 });

// ================= la intro =================
if (partes.includes('intro')) {
  const { b, p, ev, err } = await abrir(HTML + (HTML.includes('?') ? '&' : '?') + 'ev300', true, null, conEstado(null));
  await esperar(p, `typeof EV3 !== 'undefined' && EV3.fase === 'intro' && EV3.t > 3`, 120000);
  const a = await ev(`({ vhs: VHS.on, osd: VHS.osd && !VHS.osd.classList.contains('oc'), play: VHS.osdTxt.I, cams: EV3I.cams.filter(Boolean).length, sentado: !!(EV3I.yo && EV3I.yo.sentado && EV3I.cuerpoOk), voces: Object.keys(EV3.aud.buf).length, clase: document.body.classList.contains('ev3Quieto'), tactil: getComputedStyle($('tactil')).display })`);
  chk(a.vhs && a.osd && a.play === 'PLAY ▶', 'la cinta: VHS a pantalla completa con «PLAY ▶»', a);
  chk(a.cams >= 12 && a.sentado, 'el cuarto: cámaras apuntando y el cuerpo sentado en la silla', { cams: a.cams, sentado: a.sentado });
  chk(a.voces === 15, 'las 15 voces de Pepe decodificadas', a.voces);
  chk(a.clase && a.tactil === 'none', 'atado: sin botones', a.tactil);
  // (las manos detrás del respaldo: más atrás que la cadera; el cuello deja girar 75° y no más)
  const m = await ev(`(() => { const P = EV3I.yo, h = ev3Hueso(P, 'Hips'), l = ev3Hueso(P, 'LeftHand'), r = ev3Hueso(P, 'RightHand'); JUG.yaw = 2.5; return { atras: +(h.z - Math.max(l.z, r.z)).toFixed(2) }; })()`);
  await ev(AYUDA); await ev(`__cuadros(3)`);
  const yw = await ev(`+JUG.yaw.toFixed(2)`);
  chk(m.atras > 0.05, 'las manos atadas detrás del respaldo', m);
  chk(Math.abs(yw) <= 1.31, 'el cuello no gira más de 75°', yw);
  await ev(`JUG.yaw = 0; JUG.pitch = 0.95; 1`); await p.waitForTimeout(800); await p.screenshot({ path: D + '/intro_abajo.jpg', quality: 80 });
  await ev(`JUG.yaw = -0.6; JUG.pitch = 0.1; 1`);
  const fotos = [[10.6, 'intro_recuerdo1'], [16.5, 'intro_recuerdo2'], [22.2, 'intro_recuerdo3'], [27.2, 'intro_camaras'], [31.9, 'intro_entidad']];
  const vistos = {};
  for (const [t, n] of fotos) {
    await esperar(p, `EV3.fase !== 'intro' || EV3.t >= ${t}`, 90000);
    vistos[n] = await ev(`({ t: +EV3.t.toFixed(1), agua: +VHS.agua.toFixed(2), fb: EV3I.fb ? EV3I.fb.n : 0, ent: !!EV3I.ent })`);
    await p.screenshot({ path: `${D}/${n}.jpg`, quality: 80 });
  }
  chk(vistos.intro_recuerdo1.fb === 1 && vistos.intro_recuerdo2.fb === 2 && vistos.intro_recuerdo3.fb === 3 && vistos.intro_recuerdo1.agua > 0.5, 'los tres recuerdos, bajo el agua', vistos);
  chk(vistos.intro_entidad.ent, 'la entidad entra', vistos.intro_entidad);
  await esperar(p, `EV3.fase === 'puzles' && EV3.despierta > 3`, 60000);
  const d = await ev(`({ fase: EV3.fase, guardado: JSON.parse(localStorage.getItem('jx_ev300')).fase, sellos: VHS.osdTxt.D, noche: DIA.hora, dist: +Math.hypot(JUG.pos.x - 1.6, JUG.pos.z - 13).toFixed(2), arma: ARM.lista.join(), vista: EV3.sinVista, cuerpo: EV3I.yo, mapa: MUNDO.nombre })`);
  chk(d.fase === 'puzles' && d.guardado === 'puzles' && d.mapa === 'RB_Construct' && d.noche < 5 && d.dist < 1, 'después: gm_construct de noche, frente al 1.047, guardado', d);
  chk(/0\/10/.test(d.sellos) && d.arma === 'Hands' && d.vista, 'los sellos en 0/10, sin armas en la mano', d);
  await p.screenshot({ path: D + '/despertar.jpg', quality: 80 });
  chk(!err.filter((e) => !/WebSocket connection|broker\./.test(e)).length, 'sin errores de JS', err.slice(0, 4));
  await b.close();
}

// ================= las misiones =================
if (partes.includes('misiones')) {
  const { b, p, ev, err } = await abrir(HTML + (HTML.includes('?') ? '&' : '?') + 'ev300', true, null, conEstado({ v: 1, fase: 'puzles', hechas: [], reinicios: {} }));
  await esperar(p, `typeof EV3 !== 'undefined' && EV3.fase === 'puzles' && EV3.despierta > 3`, 120000);
  await ev(AYUDA);
  const hechas = () => ev(`EV3.est.hechas.slice()`);
  // --- cajas: una agarrada y llevada de verdad; las otras nueve, al cuadrado ---
  {
    const r = await ev(`(async () => { const S = EV3.mis.cajas, o = S.cajas[0]; __ir(o.b.pos.x - 1.6, o.b.pos.z); await __cuadros(2); __mirar(o.b.pos); await __cuadros(3); const txt = $('usarTxt').textContent; ev3Usar(); await __cuadros(3); const lleva = EV3.lleva === o;
      // (caminando, la caja va adelante; acá se salta el camino: va con el jugador)
      __ir(-12, -9); JUG.yaw = 0; JUG.pitch = 0.3; o.b.pos.copy(vadd(JUG.pos, v3(0, 0.2, 1.4))); await __cuadros(20); const cerca = o.b.pos.distTo(JUG.pos) < 2.6; ev3Usar(); await __cuadros(20);
      return { txt, lleva, cerca, suelta: !EV3.lleva, n: S.n }; })()`);
    chk(r.lleva && r.cerca && r.suelta && r.n >= 1, 'cajas: se agarra una, se lleva y se suelta en el cuadrado (el contador sube)', r);
    await ev(`(() => { const S = EV3.mis.cajas; S.cajas.forEach((o, i) => { if (i === 0) return; o.b.frozen = false; o.b.pos.set(-14 + (i % 3) * 1.4, S.y + 0.6, -8 + Math.floor(i / 3) * 1.4); o.b.vel.set(0, 0, 0); o.b.wake(); }); return 1; })()`);
    await esperar(p, `EV3.est.hechas.includes('cajas')`, 20000).catch(() => {});
    const h = await hechas(); chk(h.includes('cajas'), 'cajas: con las 10 adentro, el sello', { h, n: await ev(`EV3.mis.cajas.n`) });
  }
  // --- fusibles: las tres baterías, agarradas y puestas en la caja ---
  {
    // (la de abajo de la mesa: agachado, de costado; caminando hasta la caja de fusibles, la batería va con el jugador)
    const r = await ev(`(async () => { const S = EV3.mis.fusibles, L = []; for (const o of S.bats.slice()) { const bajo = false; __ir(o.b.pos.x, o.b.pos.z - (Math.abs(o.b.pos.x - 24) < 1 ? 1.9 : 1.4)); await __cuadros(10); __mirar(o.b.pos); await __cuadros(4); ev3Usar(); await __cuadros(2); ENT.agachar = false; const lleva = EV3.lleva === o; __ir(6.5, 24.3); o.b.pos.copy(vadd(JUG.pos, v3(0, 0.3, 1.2))); await __cuadros(3); __mirar(S.p); await __cuadros(4); const txt = $('usarTxt').textContent; ev3Usar(); await __cuadros(3); L.push([lleva, txt, S.n]); } return L; })()`);
    chk(r.every((x) => x[0]) && r[2][2] === 3, 'fusibles: tres baterías llevadas a la caja', r);
    chk((await hechas()).includes('fusibles'), 'fusibles: el sello (se prende el poste)');
  }
  // --- código ---
  {
    const r = await ev(`(async () => { const S = EV3.mis.codigo, q = S.q; const txt = await __usarEn(q.p, [30.78, 19.6]); const panel = EV3.panel; for (const t of ['1', '2', '3', 'OK']) EV3.teclado.tecla(t); await __cuadros(2); const mal = !EV3.est.hechas.includes('codigo'); for (const t of ['1', '0', '4', '7', 'OK']) EV3.teclado.tecla(t); await __cuadros(30); return { txt, panel, mal, abierta: S.abierta }; })()`);
    chk(r.panel === 'tecla' && r.mal && r.abierta, 'código: el teclado; 123 no abre, 1047 sí', r);
    chk((await hechas()).includes('codigo'), 'código: el sello');
  }
  // --- radio ---
  {
    const r = await ev(`(async () => { const S = EV3.mis.radio; const txt = await __usarEn(S.p, [-22, -37.6]); const panel = EV3.panel; EV3.radioPanel.poner(98.3); await __cuadros(5); const nada = !EV3.est.hechas.includes('radio'); EV3.radioPanel.poner(104.7); return { txt, panel, nada }; })()`);
    await esperar(p, `EV3.est.hechas.includes('radio')`, 15000).catch(() => {});
    chk(r.panel === 'radio' && r.nada && (await hechas()).includes('radio'), 'radio: en 98.3 nada; en 104.7 habla Pepe y el sello', r);
  }
  // --- las luces (Simón): escuchar y repetir, tres rondas ---
  {
    const r = await ev(`(async () => { const S = EV3.mis.simon, L = []; __ir(20, -28.6); await __cuadros(2);
      for (let ronda = 0; ronda < 3; ronda++) { __mirar(S.qs[0].p); await __cuadros(3); ev3Usar(); await new Promise((ok) => { const f = () => (S.muestra < 0 ? ok() : setTimeout(f, 100)); setTimeout(f, 300); });
        const seq = S.seq.slice(); for (const i of seq) { __mirar(S.qs[1 + i].p); await __cuadros(3); ev3Usar(); await __cuadros(2); } L.push([seq.length, S.ronda]); await new Promise((ok) => setTimeout(ok, 1300)); }
      return L; })()`);
    chk(r.length === 3 && r[0][0] === 4 && r[2][0] === 6 && (await hechas()).includes('simon'), 'luces: tres rondas (4, 5 y 6) repetidas y el sello', r);
  }
  // --- palancas: lo pintado sólo con la linterna; después, las cuatro ---
  {
    const v = await ev(`(async () => { const S = EV3.mis.palancas, P = S.pint; __ir(14.5, 29, ev3Piso(14.5, 29, -4.5) + 1); __mirar(P.c); if (LINT.on) linternaAlternar(false); await __cuadros(4); const sin = P.oculto; linternaAlternar(true); await __cuadros(4); const con = P.oculto; return { sinLinterna: sin, conLinterna: con }; })()`);
    await p.screenshot({ path: D + '/palancas_pintado.jpg', quality: 80 });
    chk(v.sinLinterna === true && v.conLinterna === false, 'palancas: lo pintado se ve sólo con la linterna', v);
    const r = await ev(`(async () => { const S = EV3.mis.palancas; __ir(21.1, 23.6); await __cuadros(2); for (let i = 0; i < 4; i++) { __mirar(S.qs[i].p); await __cuadros(3); ev3Usar(); await __cuadros(2); } return S.pos.join(''); })()`);
    chk(r === '1001' && (await hechas()).includes('palancas'), 'palancas: ▲▼▼▲ y el sello', r);
  }
  // --- sigilo: si te ve, te saca; si no, el sello ---
  {
    const r = await ev(`(async () => { const S = EV3.mis.sigilo, E = S.ent; E.pos.set(-15, S.y + 0.96, 28.2); E.yaw = -Math.PI / 2; S.i = 1; __ir(-19, 28.2, S.y + 1); JUG.yaw = Math.PI / 2; let vio = false; for (let i = 0; i < 40 && !vio; i++) { await __cuadros(1); vio = S.alerta > 0 || JUG.pos.z < 26; }
      await new Promise((ok) => { const t0 = performance.now(); const f = () => (JUG.pos.z < 26 || performance.now() - t0 > 8000 ? ok() : setTimeout(f, 100)); f(); });
      const afuera = JUG.pos.z < 26; await __cuadros(3);
      const S2 = EV3.mis.sigilo; S2.ent.pos.set(-7, S2.y + 0.96, 28.2); S2.i = 0; S2.alerta = 0; S2.ent.yaw = Math.PI / 2;
      const txt = await __usarEn(S2.q.p, [-22.6, 32.4, S2.y + 1]); return { vio, afuera, txt }; })()`);
    chk(r.vio && r.afuera, 'sigilo: de frente te ve, te alcanza y te saca', r);
    chk((await hechas()).includes('sigilo'), 'sigilo: sin que te vea, el sello', r.txt);
  }
  // --- la llave en el fondo de la pileta ---
  {
    const r = await ev(`(async () => { const S = EV3.mis.llave; const txt = await __usarEn(S.p, [S.p.x - 1.3, S.p.z, S.p.y + 0.9]); return { txt, agua: !!aguaEn(JUG.pos.x, JUG.pos.y, JUG.pos.z, 0), fondo: +S.P.fondo.toFixed(2), sup: +S.P.sup.toFixed(2) }; })()`);
    chk((await hechas()).includes('llave'), 'llave: en el fondo de la pileta, el sello', r);
  }
  // --- la torre: las plataformas se pueden saltar (≤ 0,6 m más alta y ≤ 1,1 m de hueco) y la campana arriba ---
  {
    const g = await ev(`(() => { const L = EV3.mis.torre.plat; const r = []; for (let i = 1; i < L.length; i++) r.push([+(L[i].y - L[i - 1].y).toFixed(2), +(Math.hypot(L[i].x - L[i - 1].x, L[i].z - L[i - 1].z) - 1.1).toFixed(2)]); return { r, ultima: +(L[L.length - 1].y + 0.12).toFixed(2), techo: +EV3.mis.torre.roof.toFixed(2) }; })()`);
    chk(g.r.every(([dh, hueco]) => dh <= 0.61 && hueco <= 1.1), 'torre: cada plataforma se alcanza saltando (salto de 1,1 m)', g);
    // (subir de verdad a la primera: caminar y saltar)
    const s = await ev(`(async () => { const L = EV3.mis.torre.plat; __ir(L[0].x - 2.0, L[0].z); JUG.yaw = Math.PI / 2; JUG.pitch = 0; await __cuadros(5); ENT.teclas.add('KeyW'); for (let i = 0; i < 40; i++) { if (i === 5) ENT.teclas.add('Space'); if (i === 12) ENT.teclas.delete('Space'); await __cuadros(1); } ENT.teclas.delete('KeyW'); await __cuadros(5); return { y: +JUG.pos.y.toFixed(2), tope: +(L[0].y + 0.12).toFixed(2), arriba: JUG.pos.y > L[0].y + 0.5 && Math.abs(JUG.pos.x - L[0].x) < 0.7 }; })()`);
    chk(s.arriba, 'torre: caminando y saltando (W y espacio) se sube a la primera', s);
    const r = await ev(`(async () => { const S = EV3.mis.torre; const txt = await __usarEn(S.pc, [-10, 28.4, S.roof + 1]); return { txt, borde: [ev3Piso(-27, 20), ev3Piso(-26, 20), ev3Piso(-25, 20), ev3Piso(-24.6, 19)].map((v) => +v.toFixed(1)) }; })()`);
    chk((await hechas()).includes('torre'), 'torre: arriba del techo, la campana y el sello', r);
  }
  // --- el orden de las muertes: uno mal reinicia; en el orden del registro, el sello ---
  {
    const r = await ev(`(async () => { const S = EV3.mis.orden, C = v3(30, 0, -55); const toca = async (i) => { const c = S.cosas[i], d = vsub(C, c.q.p); d.y = 0; d.norm(); const k = c.k === 'sedan' ? 2.6 : 1.7; __ir(c.q.p.x + d.x * k, c.q.p.z + d.z * k); await __cuadros(2); __mirar(c.q.p); await __cuadros(3); const t = $('usarTxt').textContent; ev3Usar(); await __cuadros(2); return t; };
      await toca(0); await toca(1); const antes = S.ok; await toca(4); const tras = S.ok; const L = []; for (let i = 0; i < 6; i++) L.push(await toca(i)); return { antes, tras, L, ok: S.ok }; })()`);
    chk(r.antes === 2 && r.tras === 0 && r.ok === 6, 'orden: uno mal lo reinicia; ADMIN, 13 PISOS, PARED, SEDÁN, HELADERA, BARRIL', r);
    chk((await hechas()).includes('orden'), 'orden: el sello');
  }
  const fin = await ev(`({ h: EV3.est.hechas.length, abierta: EV3.cuarto.abierta, sellos: VHS.osdTxt.D, guardado: JSON.parse(localStorage.getItem('jx_ev300')).hechas.length })`);
  chk(fin.h === 10 && fin.guardado === 10 && /10\/10/.test(fin.sellos), 'los 10 sellos, guardados', fin);
  await p.waitForTimeout(3500);
  const ab = await ev(`({ abierta: EV3.cuarto.abierta, bloqueo: !!EV3.cuarto.bloqueo })`);
  chk(ab.abierta && !ab.bloqueo, 'con los 10: se abre la puerta del 1.047', ab);
  await ev(`(() => { __ir(1.6, 23.5); __mirar(v3(1.6, -2.2, 33)); return 1; })()`); await p.waitForTimeout(1500); await p.screenshot({ path: D + '/puerta_abierta.jpg', quality: 80 });
  chk(!err.filter((e) => !/WebSocket connection|broker\./.test(e)).length, 'sin errores de JS', err.slice(0, 4));
  await b.close();
}

// ================= el bug: meterse al cuarto sin los 10 =================
if (partes.includes('bug')) {
  const { b, p, ev, err } = await abrir(HTML + (HTML.includes('?') ? '&' : '?') + 'ev300', true, null, conEstado({ v: 1, fase: 'puzles', hechas: ['radio', 'codigo'], ultima: 'codigo', reinicios: {} }));
  await esperar(p, `typeof EV3 !== 'undefined' && EV3.fase === 'puzles' && EV3.despierta > 3`, 120000);
  await ev(AYUDA);
  const a = await ev(`({ abierta: EV3.mis.codigo.abierta, h: EV3.est.hechas.slice() })`);
  await ev(`(async () => { __ir(1.6, 31, ev3Piso(1.6, 31, -4.5) + 1); await __cuadros(6); return 1; })()`);
  await p.waitForTimeout(400);
  const r = await ev(`({ z: +JUG.pos.z.toFixed(1), h: EV3.est.hechas.slice(), abierta: EV3.mis.codigo.abierta, guardado: JSON.parse(localStorage.getItem('jx_ev300')).hechas })`);
  chk(a.abierta && r.z < 20, 'adentro del cuarto sin los 10: te saca', r);
  chk(r.h.join() === 'radio' && r.guardado.join() === 'radio' && r.abierta === false, 'y se reinicia la última misión (el código: la puerta vuelve a cerrarse)', r);
  // (los otros caminos: por la pared de al lado no se pasa —los tabiques y la puerta chocan—)
  const c = await ev(`(() => { const yp = ev3Piso(1.6, 22); const h1 = mundoRayo(v3(1.6, yp + 1, 24), v3(0, 0, 1), 6), h2 = raycast(v3(-8, yp + 1, 31), v3(1, 0, 0), 8, null), h3 = raycast(v3(12, yp + 1, 31), v3(-1, 0, 0), 8, null); return { puerta: !!raycast(v3(1.6, yp + 1, 24), v3(0, 0, 1), 6, null), tabiqueIzq: !!h2, tabiqueDer: !!h3 }; })()`);
  chk(c.puerta && c.tabiqueIzq && c.tabiqueDer, 'la puerta y los dos tabiques del cuarto chocan', c);
  chk(!err.filter((e) => !/WebSocket connection|broker\./.test(e)).length, 'sin errores de JS', err.slice(0, 4));
  await b.close();
}

// ================= el final y el epílogo =================
if (partes.includes('final')) {
  const todas = ['cajas', 'fusibles', 'codigo', 'radio', 'simon', 'palancas', 'sigilo', 'llave', 'torre', 'orden'];
  const { b, p, ev, err } = await abrir(HTML + (HTML.includes('?') ? '&' : '?') + 'ev300', true, null, conEstado({ v: 1, fase: 'puzles', hechas: todas, ultima: 'orden', reinicios: {} }));
  await esperar(p, `typeof EV3 !== 'undefined' && EV3.fase === 'puzles' && EV3.despierta > 3`, 120000);
  await ev(AYUDA);
  const a = await ev(`({ abierta: EV3.cuarto.abierta })`);
  chk(a.abierta, 'con los 10 guardados, la puerta ya está abierta', a);
  const txt = await ev(`(async () => { const pe = EV3.cuarto.pepe; return await __usarEn(vadd(pe.pos, v3(0, 0.25, 0)), [1.6, 31.4, ev3Piso(1.6, 31, -4.5) + 1]); })()`);
  chk(/perd|sorry|desculpa/i.test(txt), 'adentro: «pedir perdón» a Pepe', txt);
  await p.screenshot({ path: D + '/perdon.jpg', quality: 80 });
  await esperar(p, `EV3.fase === 'screamer'`, 15000).catch(() => {});
  await p.waitForTimeout(250); await p.screenshot({ path: D + '/screamer.jpg', quality: 80 });
  const s = await ev(`({ fase: EV3.fase, rojo: VHS.rojo, pepeCerca: +EV3.cuarto.pepe.pos.distTo(CAM.pos).toFixed(2) })`);
  chk(s.fase === 'screamer' && s.pepeCerca < 1.6, 'el screamer: Pepe deformado en la cara', s);
  await esperar(p, `JUEGO.estado === 'principal'`, 20000).catch(() => {});
  const m = await ev(`({ estado: JUEGO.estado, fase: EV3.fase, guardado: JSON.parse(localStorage.getItem('jx_ev300')).fase, vhs: VHS.on, clase: document.body.classList.contains('ev3') })`);
  chk(m.estado === 'principal' && m.guardado === 'despues' && !m.vhs && !m.clase, 'se reinicia: el menú de siempre, guardado «después»', m);
  // a otro mapa: normal
  await ev(`(() => { inicioMostrar(false); empezarPartida('FlatGrass'); return 1; })()`);
  await esperar(p, `JUEGO.estado === 'juego' && MUNDO.nombre === 'FlatGrass' && !!JUG.suelo`, 90000);
  await p.waitForTimeout(800);
  const o = await ev(`({ fase: EV3.fase, vhs: VHS.on })`);
  chk(!o.fase && !o.vhs, 'en otro mapa, nada del evento', o);
  // gm_construct: el epílogo
  await ev(`(() => { irMenuPrincipal(); inicioMostrar(false); empezarPartida('RB_Construct'); return 1; })()`);
  await esperar(p, `EV3.fase === 'epilogo' && EV3.epi && EV3.epi.t > 3`, 90000);
  const e = await ev(`({ vhs: VHS.on, noche: DIA.hora, usar: getComputedStyle($('busar')).display, lint: getComputedStyle($('blinterna')).display, pausa: getComputedStyle($('arribaIz')).display, mueve: getComputedStyle($('palanca')).display })`);
  chk(e.vhs && e.noche < 5 && e.usar === 'none' && e.lint === 'none' && e.pausa === 'none' && e.mueve !== 'none', 'epílogo: de noche, en VHS, sólo caminar (ni pausa)', e);
  await esperar(p, `EV3.epi && EV3.epi.msj`, 40000);
  await p.waitForTimeout(600); await p.screenshot({ path: D + '/volvera.jpg', quality: 80 });
  chk(/VOLVER|RETURN|VOLTAR/.test(await ev(`VHS.osdTxt.C`)), '«ÉL VOLVERÁ»');
  await esperar(p, `JUEGO.estado === 'principal'`, 20000).catch(() => {});
  const h = await ev(`({ estado: JUEGO.estado, guardado: JSON.parse(localStorage.getItem('jx_ev300')).fase, vhs: VHS.on })`);
  chk(h.estado === 'principal' && h.guardado === 'hecho' && !h.vhs, 'se cierra el juego (en la prueba: al menú) y queda «hecho»', h);
  await ev(`(() => { inicioMostrar(false); empezarPartida('RB_Construct'); return 1; })()`);
  await esperar(p, `JUEGO.estado === 'juego' && MUNDO.nombre === 'RB_Construct' && !!JUG.suelo`, 90000);
  await p.waitForTimeout(1000);
  const n = await ev(`({ fase: EV3.fase, vhs: VHS.on })`);
  chk(!n.fase && !n.vhs, 'después, gm_construct normal', n);
  chk(!err.filter((x) => !/WebSocket connection|broker\./.test(x)).length, 'sin errores de JS', err.slice(0, 4));
  await b.close();
}
console.log(`RESUMEN evento300 ${ok}/${ok + mal}`);
