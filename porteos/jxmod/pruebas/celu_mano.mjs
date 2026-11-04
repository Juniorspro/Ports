// el celular como arma del mod oficial "Celular" (viene prendido): está en la barra de armas; O lo saca y lo guarda
// (vuelve al arma de antes); en primera persona se ve en la mano (no a pantalla completa: 50-62 % del alto en la compu,
// 60-72 % en el celular, y ahí sin tapar los botones de la derecha) con la pantalla del celular pegada justo encima del
// celular 3D (las esquinas a ≤ 2 px); la mano lo sostiene de verdad: los nudillos detrás de la espalda (palma apoyada),
// ningún dedo atraviesa el celular (≤ 3 mm) ni queda delante de la pantalla, y el pulgar en el canto derecho; tocar una
// app la abre (táctil) y en la compu clic para usarlo (aparece el puntero), clic en una app la abre y Esc vuelve a mirar;
// se puede caminar con el celular en la mano; en tercera persona va chico en la esquina y el personaje lo tiene en la
// mano (también uno de la sala); cambiar de arma lo guarda; apagando el mod se va de la barra y el botón; la pose se
// calcula una vez (cuesta < 0,3 ms por cuadro); sin errores.
// uso: node celu_mano.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const D = (process.argv[3] || '.') + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
for (const celu of [false, true]) {
  const tag = celu ? 'celu' : 'pc';
  const { b, p, err, ev } = await abrir(process.argv[2], celu);
  await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 15000 });
  const m0 = await ev(`({ mod: !!(OFICIALES.find((m) => m.id === 'celular') && PREFS.mods.celular), arma: ARM.lista.includes('Celular'), boton: [...document.querySelectorAll('[data-btn=celular]')].some((x) => x.style.display !== 'none'), antes: ARM.lista[ARM.i] })`);
  ok(`${tag}: el mod Celular viene prendido y da el arma (en la barra) y el botón`, m0.mod && m0.arma && m0.boton, m0);
  await ev(`pulso('celular'); 1`); await p.waitForTimeout(900);
  const g = await ev(`(() => {
    const v = CELM.vm, md = v.md, h = v.h, P = CELM.pose; md.actualizar(); const H = innerHeight, Q = CELM.quad;
    const loc = (i) => { const d = vsub(celmPos(md, i), P.c); return [vdot(d, P.r), vdot(d, P.u), vdot(d, P.n)]; };
    // las esquinas del elemento (con la transformación) contra las de la pantalla 3D
    const el = $('celular'), rc = el.getBoundingClientRect(), bx = [Math.min(...Q.map((q) => q[0])), Math.min(...Q.map((q) => q[1])), Math.max(...Q.map((q) => q[0])), Math.max(...Q.map((q) => q[1]))];
    const difEsq = Math.max(Math.abs(rc.left - bx[0]), Math.abs(rc.top - bx[1]), Math.abs(rc.right - bx[2]), Math.abs(rc.bottom - bx[3]));
    const alto = Math.max(Q[3][1] - Q[0][1], Q[2][1] - Q[1][1]) / H;
    // los dedos: ninguna articulación dentro del celular (más su grosor: 3 mm de tolerancia) ni delante de la pantalla
    const W2 = CELM_W / 2, H2 = CELM_H / 2, D2 = CELM_D / 2; let dentro = 0, delante = [], peor = -1;
    for (const D of ['Index', 'Middle', 'Ring', 'Pinky']) for (const k of [2, 3, 4]) {
      const [x, y, z] = loc(h['RightHand' + D + k]), r = 0.008;
      if (Math.abs(x) < W2 && Math.abs(y) < H2) { const pen = z + r + D2; if (pen > peor) peor = pen; if (pen > 0.003) dentro++; if (z > D2) delante.push(D + k); }
    }
    const nud = loc(h.RightHandMiddle1), pul = loc(h.RightHandThumb4 !== undefined ? h.RightHandThumb4 : h.RightHandThumb3);
    // los botones de la derecha (táctil): que el celular no los tape
    const bt = [...document.querySelectorAll('#hud button, .btn, [data-btn]')].filter((x) => x.offsetParent && x.getBoundingClientRect().width > 10).map((x) => x.getBoundingClientRect());
    const tapa = bt.filter((r2) => !(r2.right < rc.left || r2.left > rc.right || r2.bottom < rc.top || r2.top > rc.bottom)).length;
    return { arma: ARM.lista[ARM.i], clase: el.className, difEsq: +difEsq.toFixed(1), alto: +alto.toFixed(3), dentro, peorMm: +(peor * 1000).toFixed(1), delante, nud: nud.map((x) => +(x * 100).toFixed(1)), pul: pul.map((x) => +(x * 100).toFixed(1)), tapa, dedos: CELM.dedos };
  })()`);
  await p.screenshot({ path: D + 'celu_mano_' + tag + '.png' });
  ok(`${tag}: O lo saca: en la mano en primera persona, la pantalla pegada al celular 3D (≤ 2 px)`, g.arma === 'Celular' && /mano/.test(g.clase) && !/tercera/.test(g.clase) && g.difEsq <= 2, g);
  ok(`${tag}: no a pantalla completa (${celu ? '60-72' : '50-62'} % del alto)${celu ? ' y sin tapar los botones' : ''}`, g.alto >= (celu ? 0.6 : 0.5) && g.alto <= (celu ? 0.72 : 0.62) && (!celu || g.tapa === 0), g);
  ok(`${tag}: la mano lo sostiene: nudillos detrás (palma apoyada), ningún dedo lo atraviesa (≤ 3 mm) ni queda delante de la pantalla, pulgar en el canto derecho`,
    g.nud[2] < -0.4 && g.nud[2] > -3 && Math.abs(g.nud[0]) < 3.6 && g.dentro === 0 && g.delante.length === 0 && g.pul[0] > 3.6 && g.pul[0] < 5.5 && Math.abs(g.pul[2]) < 1.2, g);
  // tocar / hacer clic en una app
  const centro = await ev(`(() => { const a = document.querySelector('#celular .celApp[data-cel="app|props"]'), r = a.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  if (celu) { await p.touchscreen.tap(centro[0], centro[1]); }
  else {
    await ev(`ENT.bloqueado = true; ENT.disparo = true; 1`); await p.waitForTimeout(300);
    const f = await ev(`({ foco: CELM.foco, ui: UI.abierto })`);
    ok('pc: clic con el celular en la mano: modo usar (puntero libre, sin pausa)', f.foco && f.ui === 'celular', f);
    await p.mouse.click(centro[0], centro[1]);
  }
  await p.waitForTimeout(400);
  const app = await ev(`({ app: CEL.app, txt: document.querySelector('#celular .celCont').textContent.slice(0, 40) })`);
  ok(`${tag}: ${celu ? 'tocar' : 'clic en'} la app Objetos la abre en el celular de la mano`, app.app === 'props', app);
  await p.screenshot({ path: D + 'celu_mano_app_' + tag + '.png' });
  if (!celu) { await ev(`pulso('pausa'); 1`); await p.waitForTimeout(300); const f2 = await ev(`({ foco: CELM.foco, ui: UI.abierto, pausa: !$('pausa').classList.contains('oc'), sigue: ARM.lista[ARM.i] })`); ok('pc: Esc deja de usarlo (vuelve a mirar) sin guardarlo ni abrir la pausa', !f2.foco && !f2.ui && !f2.pausa && f2.sigue === 'Celular', f2); }
  // caminar con el celular en la mano
  const cam = await ev(`(async () => { const p0 = JUG.pos.clone(); ENT.teclas.add('KeyW'); if (ENT.tactil) ENT.joy = { x: 0, y: 1 }; await new Promise((r) => setTimeout(r, 1200)); ENT.teclas.delete('KeyW'); if (ENT.tactil) ENT.joy = null; return { anduvo: +Math.hypot(JUG.pos.x - p0.x, JUG.pos.z - p0.z).toFixed(2), sigue: ARM.lista[ARM.i], ve: $('celular').classList.contains('arriba') }; })()`);
  ok(`${tag}: se camina con el celular en la mano (y sigue ahí)`, cam.anduvo > 1 && cam.sigue === 'Celular' && cam.ve, cam);
  // costo por cuadro
  const costo = await ev(`(() => { const t0 = performance.now(); for (let i = 0; i < 200; i++) { CELM.dibujado = false; celmVistaDibujar(); itemsLimpiar && itemsLimpiar(); } return +((performance.now() - t0) / 200).toFixed(3); })()`);
  ok(`${tag}: la mano y el celular cuestan < 0,3 ms por cuadro (la pose se calcula una vez)`, costo < 0.3, costo);
  // tercera persona
  await ev(`JUG.tercera = true; 1`); await p.waitForTimeout(700);
  const t3 = await ev(`(() => { const el = $('celular'), r = el.getBoundingClientRect(); return { clase: el.className, alto: +(r.height / innerHeight).toFixed(2), arma: JUG.cuerpo.arma }; })()`);
  await p.screenshot({ path: D + 'celu_mano_3p_' + tag + '.png' });
  ok(`${tag}: en tercera persona va chico en la esquina (≤ 62 % del alto) y el personaje lo tiene en la mano`, /tercera/.test(t3.clase) && t3.alto <= 0.62 && t3.arma === 'Celular', t3);
  // en tercera persona, con personajes de todos los tamaños: el brazo lo sostiene delante del pecho y ningún dedo lo atraviesa
  if (!celu) {
    const sk3 = await ev(`(async () => { const o = {}; for (const sk of ['Hero', 'Goku', 'Freddy', 'Jake', 'BoiledOne', 'V1', 'SpecialForcesM']) {
      PREFS.skin = sk; jugadorCuerpoNuevo(); await new Promise((r) => setTimeout(r, 500)); const P = JUG.cuerpo, C = P.celu3p; if (!C) { o[sk] = null; continue; }
      const md = P.md, hx = huesosMixamo(P.D); md.actualizar(); let pen = 0;
      for (const D of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']) for (const k of [1, 2, 3, 4]) { const i = hx['RightHand' + D + k]; if (i === undefined) continue; const d = vsub(celmPos(md, i), C.c), x = vdot(d, C.r) / C.t, y = vdot(d, C.u) / C.t, z = vdot(d, C.n) / C.t; if (Math.abs(x) < CELM_W / 2 && Math.abs(y) < CELM_H / 2) pen = Math.max(pen, Math.min(z + 0.008 + CELM_D / 2, CELM_D / 2 + 0.008 - z)); }
      const mano = celmPos(md, P.D.h.RightHand), ojo = celmPos(md, P.D.h.Head), palma = hx.RightHandMiddle1 !== undefined ? mano.distTo(celmPos(md, hx.RightHandMiddle1)) : 0.1 * C.t, alto = (ojo.y - C.c.y) / C.t;
      o[sk] = { pen: +(pen * 1000).toFixed(1), manoCelu: +(mano.distTo(C.c) / palma).toFixed(2), bajoOjos: +alto.toFixed(2) }; }
      PREFS.skin = 'Hero'; jugadorCuerpoNuevo(); return o; })()`);
    ok('pc: en tercera persona, 7 personajes (de Jake a BoiledOne): lo sostiene delante del pecho (20-35 cm bajo los ojos, el centro del celular a ≤ 1,3 veces el largo de la palma de la muñeca) sin dedos que lo atraviesen (≤ 3 mm)', Object.values(sk3).every((x) => x && x.pen <= 3 && x.bajoOjos >= 0.2 && x.bajoOjos <= 0.35 && x.manoCelu <= 1.3), sk3);
  }
  await ev(`JUG.tercera = false; 1`);
  // uno de la sala con el celular
  const red = await ev(`(async () => { RED.on = true; RED.ID = RED.ID || 'yo1'; recibirEstado({ i: 'ana', n: 'Ana', k: 'Hero', h: 'HatEmpty', p: [JUG.pos.x + 2, JUG.pos.y, JUG.pos.z + 2], v: [0, 0, 0], y: 0, t: 0, f: 5, a: 'Celular', e: 0 }); await new Promise((r) => setTimeout(r, 500)); const R2 = RED.remotos.get('ana'); RED.on = false; return { arma: R2 && R2.P.arma }; })()`);
  ok(`${tag}: uno de la sala con el celular se ve con el celular en la mano`, red.arma === 'Celular', red);
  // guardarlo: O vuelve al arma de antes; cambiar de arma lo esconde
  await ev(`pulso('celular'); 1`); await p.waitForTimeout(400);
  const gu = await ev(`({ arma: ARM.lista[ARM.i], ve: $('celular').classList.contains('arriba') && getComputedStyle($('celular')).visibility !== 'hidden' })`);
  ok(`${tag}: O otra vez lo guarda y vuelve al arma de antes`, gu.arma === m0.antes && !gu.ve, { gu, antes: m0.antes });
  // apagar el mod
  await ev(`modAlternar('celular'); 1`); await p.waitForTimeout(500);
  const ap = await ev(`({ arma: ARM.lista.includes('Celular'), boton: [...document.querySelectorAll('[data-btn=celular]')].some((x) => x.style.display !== 'none') })`);
  ok(`${tag}: apagando el mod se va de la barra y el botón`, !ap.arma && !ap.boton, ap);
  ok(`${tag}: sin errores`, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).slice(0, 4));
  await b.close();
}
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
