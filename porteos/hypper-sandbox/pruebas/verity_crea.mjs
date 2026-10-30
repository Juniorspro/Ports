// Verity crea: (A) sin red, que lo que arma quede bien: las poses de la animación medidas en el muñeco del editor con
// varios personajes (brazos arriba, al costado, adelante, codos, rodillas, torso, giro del cuerpo, cadera, simetría),
// la construcción (apilada sin huecos, a la derecha de verdad, entidades) y el mod (instalado, prendido, su código y
// su botón; "cambiar" lo reemplaza); (B) con una clave de Gemini (GEMINI=archivo): desde la charla, desde su panel, en
// el editor de animaciones y en el creador de mapas; (C) la tienda (worker.js de verdad, TIENDA_SIM) crea con Gemini en
// un server premium y con Workers AI fuera de ellos.
// uso: [GEMINI=archivo] [TIENDA_SIM=carpeta] node verity_crea.mjs Hypper.html carpeta
import { abrir } from './base.mjs';
import fs from 'fs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/', G = process.env.GEMINI ? fs.readFileSync(process.env.GEMINI, 'utf8').trim() : '', SIM = process.env.TIENDA_SIM;
let fallas = 0; const ok = (c, t, x) => { if (!c) fallas++; console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (x !== undefined ? ' · ' + JSON.stringify(x) : '')); };
const { b, p, ev, err } = await abrir(HTML, false, [], (pg) => pg.addInitScript(() => { window.webkitSpeechRecognition = window.SpeechRecognition = undefined; }));
const espera = (ms) => p.waitForTimeout(ms);
const tienda = []; await p.route(/\/api\/verity\/crear$/, (r) => { tienda.push(1); r.fulfill({ status: 404, body: '{}' }); }); // (la tienda de verdad se prueba en C)
await ev(`PREFS.bienvenida = true; GFX.auto=false; PREFS.resDin=false; PREFS.lang='es'; PREFS.nombre='Juni'; PREFS.verGem = ''; PREFS.verTk = ''; localStorage.removeItem('rb_verity'); PREFS.mods = {verity: true}; inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await espera(6000); await ev(`audioIniciar(); 1`);

// ---------------- A1: la animación, medida ----------------
// (en el muñeco del editor: el marco del personaje parado y las posiciones de cada hueso con una pose)
await ev(`window.__pose = (S) => {
  const P = EDA.P, md = P.md, idx = (n) => edaI(n), pos = (n) => { const M = md.W[idx(n)]; return v3(M[12], M[13], M[14]); };
  const aplicar = (po) => { EDA_HUESOS.forEach((n, k) => { const i = EDA.idx[k], v = po.q[n]; if (i >= 0 && v) for (let c = 0; c < 4; c++) md.r[i][c] = v[c]; }); const p = md.p[idx('Hips')]; for (let c = 0; c < 3; c++) p[c] = po.h[c]; md.sucio = true; md.actualizar(); };
  aplicar(EDA.base);
  const R = vsub(pos('RightArm'), pos('LeftArm')); R.y = 0; R.norm(); const U = v3(0, 1, 0); let F = vcross(R, U).norm();
  const pies = vsub(pos('RightToeBase'), pos('RightFoot')); pies.y = 0; if (vdot(F, pies) < 0) F = vscale(F, -1);
  const H = ['Hips', 'Spine', 'Neck', 'Head', 'RightArm', 'RightForeArm', 'RightHand', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightUpLeg', 'RightLeg', 'RightFoot', 'LeftUpLeg', 'LeftLeg', 'LeftFoot'];
  const base = Object.fromEntries(H.map((n) => [n, pos(n)])), headQ0 = m4quat(md.W[idx('Head')]);
  const K = verAnimClaves({ dur: 1, loop: false, claves: [Object.assign({ t: 0 }, S), { t: 1 }] }); if (!K) return null;
  aplicar(K[0]);
  const ahora = Object.fromEntries(H.map((n) => [n, pos(n)])), headQ = m4quat(md.W[idx('Head')]);
  const loc = (v, o) => { const d = vsub(v, o); return [vdot(d, R), vdot(d, U), vdot(d, F)]; };
  const r = { R: [R.x, R.z], F: [F.x, F.z], base: {}, ahora: {}, headAng: 2 * Math.acos(Math.min(1, Math.abs(headQ0.x * headQ.x + headQ0.y * headQ.y + headQ0.z * headQ.z + headQ0.w * headQ.w))) * 180 / Math.PI, finito: K.every((k) => Object.values(k.q).every((v) => v.every(Number.isFinite))) };
  for (const n of H) { r.base[n] = loc(base[n], base.Hips); r.ahora[n] = loc(ahora[n], base.Hips); }
  aplicar(EDA.base); return r;
}; 1`);
const angulo = (a, b, c) => { const u = [0, 1, 2].map((i) => b[i] - a[i]), v = [0, 1, 2].map((i) => c[i] - b[i]), d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2]; return Math.acos(d / Math.hypot(...u) / Math.hypot(...v)) * 180 / Math.PI; };
const sub = (a, b) => [0, 1, 2].map((i) => a[i] - b[i]), largo = (v) => Math.hypot(...v), r2 = (v) => +v.toFixed(3);
const skins = ['Hero', 'Goku', 'Robot', 'Ninja'];
for (const sk of skins) {
  await ev(`if (EDA.on) edaCerrar(); PREFS.skin = '${sk}'; JUG.skinMod = null; edaAbrir(); 1`); await espera(800);
  const m = async (S) => JSON.parse(await ev(`JSON.stringify(__pose(${JSON.stringify(S)}))`));
  const res = [];
  const chk = (c, t, x) => res.push([c, t, x]);
  // brazos arriba
  let r = await m({ brazoD: [0.2, 1, 0], brazoI: [0.2, 1, 0] }); const A = r.ahora;
  chk(r.finito && A.RightHand[1] > A.Head[1] + 0.1 && A.LeftHand[1] > A.Head[1] + 0.1 && A.RightHand[0] > 0 && A.LeftHand[0] < 0, 'brazos arriba: las manos sobre la cabeza y cada una de su lado', { manoD: A.RightHand.map(r2), cabeza: r2(A.Head[1]) });
  // brazos al costado (cruz): a la altura del hombro, lejos y simétricos
  r = await m({ brazoD: [1, 0, 0], brazoI: [1, 0, 0] }); let B = r.ahora;
  const apunta = (o, f, d) => { const v = sub(f, o); return Math.acos((v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / Math.hypot(...v) / Math.hypot(...d)) * 180 / Math.PI; };
  const eD = apunta(B.RightArm, B.RightHand, [1, 0, 0]), eI = apunta(B.LeftArm, B.LeftHand, [-1, 0, 0]);
  chk(eD < 5 && eI < 5 && Math.abs(B.RightHand[1] - B.RightArm[1]) < 0.05 && Math.abs(B.LeftHand[1] - B.LeftArm[1]) < 0.05, 'brazos en cruz: cada brazo apunta a su costado (≤ 5°) con la mano a la altura del hombro (≤ 5 cm)', { eD: r2(eD), eI: r2(eI) });
  r = await m({ brazoD: [0.5, 0.5, 0.7] }); B = r.ahora; const eDiag = apunta(B.RightArm, B.RightHand, [0.5, 0.5, 0.7]);
  chk(eDiag < 5, 'brazo en diagonal (afuera, arriba y adelante): apunta ahí (≤ 5°)', { error: r2(eDiag) });
  // brazo adelante
  r = await m({ brazoD: [0, 0, 1] }); B = r.ahora; const brazo = largo(sub(B.RightHand, B.RightArm));
  chk(B.RightHand[2] - B.RightArm[2] > 0.85 * brazo && Math.abs(B.RightHand[1] - B.RightArm[1]) < 0.08 && Math.abs(B.RightHand[0] - B.RightArm[0]) < 0.08, 'brazo adelante: la mano derecho adelante del hombro', { adelante: r2(B.RightHand[2] - B.RightArm[2]), largo: r2(brazo) });
  // codo a 90 con el brazo abajo: la mano va adelante; con el brazo adelante: la mano sube
  // (codos y rodillas: el ángulo entre el hueso de arriba y el de abajo, 0 = derecho)
  r = await m({ codoD: 90 }); B = r.ahora; let ang = angulo(B.RightArm, B.RightForeArm, B.RightHand);
  chk(Math.abs(ang - 90) < 3 && B.RightHand[2] - B.RightForeArm[2] > 0.15, 'codo a 90°: dobla 90° (±3) y la mano va adelante', { dobla: r2(ang), adelante: r2(B.RightHand[2] - B.RightForeArm[2]) });
  r = await m({ brazoD: [1, 0, 0], codoD: 0 }); B = r.ahora; ang = angulo(B.RightArm, B.RightForeArm, B.RightHand);
  chk(ang < 2, 'codo en 0: el brazo queda derecho (≤ 2°)', { dobla: r2(ang) });
  r = await m({ brazoD: [0, 0, 1], codoD: 90 }); B = r.ahora;
  chk(B.RightHand[1] - B.RightForeArm[1] > 0.8 * largo(sub(B.RightHand, B.RightForeArm)), 'brazo adelante y codo a 90°: el antebrazo sube', { sube: r2(B.RightHand[1] - B.RightForeArm[1]) });
  // pierna adelante y rodilla
  r = await m({ piernaD: [0, -0.2, 1] }); B = r.ahora;
  chk(B.RightFoot[2] - B.RightUpLeg[2] > 0.5 && B.LeftFoot[2] < 0.15, 'patada: el pie derecho adelante (y el izquierdo en su lugar)', { pie: r2(B.RightFoot[2] - B.RightUpLeg[2]) });
  r = await m({ rodillaI: 90 }); B = r.ahora; ang = angulo(B.LeftUpLeg, B.LeftLeg, B.LeftFoot);
  chk(Math.abs(ang - 90) < 3 && B.LeftFoot[2] - B.LeftLeg[2] < -0.2, 'rodilla a 90°: dobla 90° (±3) y el pie va para atrás', { dobla: r2(ang), atras: r2(B.LeftFoot[2] - B.LeftLeg[2]) });
  r = await m({ torso: [30, 0, 0], brazoD: [0, 0, 1] }); B = r.ahora; const eT = apunta(B.RightArm, B.RightHand, [0, -Math.sin(30 * Math.PI / 180), Math.cos(30 * Math.PI / 180)]);
  chk(eT < 5, 'inclinado 30° con el brazo "adelante": el brazo sigue al pecho (≤ 5°)', { error: r2(eT) });
  // torso adelante 30°, giro del torso 45° a su derecha, todo el cuerpo 90°, de costado
  r = await m({ torso: [30, 0, 0] }); B = r.ahora; const esp = sub(B.Neck, B.Spine), esp0 = sub(r.base.Neck, r.base.Spine);
  const incl = Math.atan2(esp[2], esp[1]) * 180 / Math.PI - Math.atan2(esp0[2], esp0[1]) * 180 / Math.PI;
  chk(Math.abs(incl - 30) < 2 && Math.abs(B.Hips[1]) < 0.01, 'torso adelante 30°: la espalda se inclina 30° (±2) sin mover la cadera', { inclina: r2(incl) });
  r = await m({ torso: [0, 0, 45] }); B = r.ahora; const hom = sub(B.RightArm, B.LeftArm), giro = Math.atan2(-hom[2], hom[0]) * 180 / Math.PI;
  chk(Math.abs(giro - 45) < 6, 'torso gira 45° a su derecha (el hombro derecho va para atrás)', { giro: r2(giro) });
  r = await m({ cuerpo: [0, 0, 90] }); B = r.ahora; const h2 = sub(B.RightArm, B.LeftArm), g2 = Math.atan2(-h2[2], h2[0]) * 180 / Math.PI, pie = sub(B.RightFoot, B.LeftFoot), gp = Math.atan2(-pie[2], pie[0]) * 180 / Math.PI;
  chk(Math.abs(g2 - 90) < 6 && Math.abs(gp - 90) < 12, 'todo el cuerpo 90°: hombros y pies giran juntos', { hombros: r2(g2), pies: r2(gp) });
  r = await m({ cuerpo: [0, 20, 0] }); B = r.ahora;
  chk(B.Head[0] > 0.12, 'todo el cuerpo inclinado a su derecha: la cabeza va a la derecha', { cabezaX: r2(B.Head[0]) });
  r = await m({ cabeza: [30, 0, 0] });
  chk(Math.abs(r.headAng - 30) < 4, 'cabeza 30°: gira 30° (±4) entre cuello y cabeza', { gira: r2(r.headAng) });
  // cadera
  r = await m({ cadera: [0.2, -0.3, 0] }); B = r.ahora;
  chk(Math.abs(B.Hips[1] + 0.3) < 0.02 && Math.abs(B.Hips[0] - 0.2) < 0.02, 'cadera: baja 30 cm y se corre 20 cm a la derecha (±2 cm)', { cadera: B.Hips.map(r2) });
  // brazo cruzado sobre el pecho (de abajo a la izquierda): la mano termina del otro lado y adelante
  r = await m({ brazoD: [-0.6, 0, 0.8] }); B = r.ahora;
  chk(B.RightHand[0] < B.RightArm[0] - 0.2 && B.RightHand[2] > 0.2, 'brazo cruzado: la mano derecha pasa hacia la izquierda, por delante', { mano: B.RightHand.map(r2) });
  const bien = res.filter((x) => x[0]).length;
  ok(bien === res.length, `poses medidas con ${sk}: ${bien}/${res.length}`, res.filter((x) => !x[0]).map((x) => [x[1], x[2]]));
}
// una animación entera (como la que devuelve el modelo): claves en el editor, que siga desde la anterior, giro y loop
await ev(`if (EDA.on) edaCerrar(); PREFS.skin = 'Hero'; 1`);
const ANIM = { nombre: 'Robot prueba', cat: 'baile', dur: 4, loop: true, claves: [{ t: 0, brazoD: [0.15, -1, 0], codoD: 90, codoI: 90 }, { t: 1, brazoD: [0.2, 1, 0], cuerpo: [0, 0, 90] }, { t: 2, brazoI: [0.2, 1, 0], cuerpo: [0, 0, 180], cadera: [0, -0.2, 0] }, { t: 3, cuerpo: [0, 0, 270], torso: [15, 0, 0] }] };
const a1 = JSON.parse(await ev(`(() => { const ok = verCrearAnim(${JSON.stringify(ANIM)}); return JSON.stringify({ ok, on: EDA.on, n: EDA.keys.length, dur: EDA.dur, ult: EDA.keys[EDA.keys.length - 1].t, play: EDA.play, nom: EDA.nombre, igual: JSON.stringify(EDA.keys[0].q) === JSON.stringify(EDA.keys[EDA.keys.length - 1].q) }); })()`));
ok(a1.ok && a1.on && a1.n === 5 && a1.ult === 4 && a1.play && a1.igual && a1.nom === 'Robot prueba', 'la animación queda en el editor (4 claves + la última igual a la primera, reproduciendo)', a1);
const sigue = JSON.parse(await ev(`(() => { const k = EDA.keys, b = EDA.base, ang = (x, y) => +(2 * Math.acos(Math.min(1, Math.abs(x[0] * y[0] + x[1] * y[1] + x[2] * y[2] + x[3] * y[3]))) * 180 / Math.PI).toFixed(2);
  return JSON.stringify({ codo01: ang(k[0].q.RightForeArm, k[1].q.RightForeArm), codoBase: ang(k[1].q.RightForeArm, b.q.RightForeArm), brazo12: ang(k[1].q.RightArm, k[2].q.RightArm) }); })()`));
ok(sigue.codo01 < 0.5 && sigue.codoBase > 60 && sigue.brazo12 < 0.5, 'lo que una clave no dice sigue de la anterior (el codo doblado, el brazo arriba aunque gire el cuerpo)', sigue);
for (const [i, t] of [[1, 0.5], [2, 1.5], [3, 2.5]]) { await ev(`EDA.play = false; EDA.t = ${t}; 1`); await espera(250); await p.screenshot({ path: D + `c_anim_${i}.png` }); }
await ev(`edaCerrar(); 1`);

// ---------------- A2: la construcción ----------------
await ev(`JUG.yaw = 0.7; JUG.pitch = -0.1; 1`); await espera(400);
const caja = JSON.parse(await ev(`JSON.stringify(verCaja('Crate'))`));
const [W, H] = caja.s;
const n0 = Number(await ev(`OBJS.length`));
await ev(`verCrearMapa({ nombre: 'prueba', objetos: [{ n: 'Crate', p: [0, 0, 0], yaw: 0, f: 1 }, { n: 'Crate', p: [0, ${H}, 0], yaw: 0, f: 1 }, { n: 'crate', p: [${W}, 0, 0], yaw: 0, f: 1 }, { n: 'NoExiste', p: [5, 0, 0], yaw: 0, f: 1 }], entidades: [{ t: 'luz', p: [0, 0, 3], yaw: 0, prm: { color: '#ff3300', r: 12, i: 2 } }] }); 1`);
await espera(1500);
const mp = JSON.parse(await ev(`(() => {
  const L0 = OBJS.slice(${n0}), alta = L0.reduce((m, o) => (o.b.pos.y > m.b.pos.y ? o : m)), bajas = L0.filter((o) => o !== alta), dh = (o) => Math.hypot(o.b.pos.x - alta.b.pos.x, o.b.pos.z - alta.b.pos.z);
  bajas.sort((a, b) => dh(a) - dh(b)); const L = [bajas[0], alta, bajas[1]], c = verCaja('Crate'), vp = R.vpMundo, scr = (v) => { const w = vp[3] * v.x + vp[7] * v.y + vp[11] * v.z + vp[15]; return (vp[0] * v.x + vp[4] * v.y + vp[8] * v.z + vp[12]) / w; };
  const fondo = L.map((o) => o.b.pos.y + c.a[1]), arriba = L.map((o) => o.b.pos.y + c.b[1]);
  const piso = pisoBajo(v3(L[0].b.pos.x, L[0].b.pos.y + 3, L[0].b.pos.z), 10);
  const d = vsub(L[2].b.pos, L[0].b.pos);
  return JSON.stringify({ n: L.length, piso: +(fondo[0] - piso).toFixed(3), apilado: +(fondo[1] - arriba[0]).toFixed(3), lado: +(Math.hypot(d.x, d.z) - c.s[0]).toFixed(3), derecha: scr(L[2].b.pos) > scr(L[0].b.pos), frio: L.every((o) => o.b.frozen), luz: ENTS.lista.some((e) => e.t === 'luz' && e.prm.color === '#ff3300') });
})()`));
ok(mp.n === 3 && Math.abs(mp.piso) < 0.03 && Math.abs(mp.apilado) < 0.02 && Math.abs(mp.lado) < 0.02 && mp.derecha && mp.frio && mp.luz, 'construcción: apoyada en el piso, apilada y al lado sin huecos (≤ 2 cm), lo de "x" queda a la derecha en pantalla, congelada, con su luz; lo que no existe no se pone', mp);
await p.screenshot({ path: D + 'c_mapa.png' });
await ev(`verAcciones([{ a: 'limpiar' }]); for (const e of ENTS.lista.filter((x) => x.t === 'luz')) entidadQuitar(e); 1`);

// ---------------- A3: el mod ----------------
const s0 = Number(await ev(`JUG.salto`));
await ev(`verCrearMod(validarRB({ formato: 'rezobox-mod', nombre: 'Prueba V', autor: 'Verity', efectos: { salto: 2 }, codigo: "rb.on('inicio',()=>{rb.boton('b1','ico:cohete');});" }), false); 1`); await espera(1500);
const md1 = JSON.parse(await ev(`JSON.stringify({ id: VCR.ult.id, inst: !!INST.mods[VCR.ult.id], act: !!modsFuente()[VCR.ult.id], ids: SMOD.ids.has(VCR.ult.id), salto: JUG.salto, cod: MODAPI.mods.some((M) => M.id === VCR.ult.id), boton: [...MODAPI.botones.keys()].some((k) => k.startsWith(VCR.ult.id + ':b1')), guardado: !!JSON.parse(localStorage.getItem('rb_instalados')).mods[VCR.ult.id] })`));
ok(md1.inst && md1.act && md1.ids && Math.abs(md1.salto - s0 * 2) < 1e-6 && md1.cod && md1.boton && md1.guardado, 'el mod queda instalado y prendido: su efecto (salto ×2), su código aislado y su botón en el menú MOD', md1);
await ev(`verCrearMod(validarRB({ formato: 'rezobox-mod', nombre: 'Prueba V2', autor: 'Verity', efectos: { salto: 3 }, codigo: "rb.on('inicio',()=>{rb.boton('b2','ico:fuego');});" }), true); 1`); await espera(1500);
const md2 = JSON.parse(await ev(`JSON.stringify({ id: VCR.ult.id, salto: JUG.salto, b2: [...MODAPI.botones.keys()].some((k) => k.endsWith(':b2')), b1: [...MODAPI.botones.keys()].some((k) => k.endsWith(':b1')), n: Object.values(INST.mods).filter((m) => /^Prueba V/.test(m.nombre)).length })`));
ok(md2.id === md1.id && Math.abs(md2.salto - s0 * 3) < 1e-6 && md2.b2 && !md2.b1 && md2.n === 1, '"cambiar": reemplaza el mismo mod (otro efecto y su código nuevo, sin el botón viejo)', md2);
await ev(`delete INST.mods[VCR.ult.id]; delete modsFuente()[VCR.ult.id]; smAplicar(false); VCR.ult = null; 1`);

// ---------------- A4: el pedido en pantalla (panel, editor, creador) ----------------
await ev(`verPanel(true); 1`); await espera(300);
const fila = JSON.parse(await ev(`JSON.stringify([...VER.pan.querySelectorAll('.verCreaFila button')].map((b) => b.textContent))`));
await ev(`VER.pan.querySelector('[data-v="crea:mapa"]').click(); 1`); await espera(300);
const dlg = JSON.parse(await ev(`JSON.stringify({ vis: !$('verCrea').classList.contains('oc'), t: $('verCrea').querySelector('b').textContent, ph: $('verCreaIn').placeholder, mejor: $('verCrea').querySelector('.verCreaMejor').textContent, ui: UI.abierto })`));
ok(fila.length === 3 && dlg.vis && /constru/i.test(dlg.t) && /castillo/i.test(dlg.ph) && /Gemini/.test(dlg.mejor) && dlg.ui === 'verCrea', 'su panel tiene "Crear mod / Construir / Animación" y abre el pedido', { fila, dlg });
await p.screenshot({ path: D + 'c_pedido.png' });
await ev(`$('verCrea').click(); verPanel(false); edaAbrir(); 1`); await espera(600);
await ev(`EDA.el.querySelector('[data-ea=verity]').click(); 1`); await espera(300);
const dEda = JSON.parse(await ev(`JSON.stringify({ vis: !$('verCrea').classList.contains('oc'), tipo: VCR.tipo, eda: EDA.on, ui: UI.abierto })`));
await ev(`$('verCrea').querySelector('[data-c=cerrar]').click(); 1`);
const ui2 = await ev(`UI.abierto`);
ok(dEda.vis && dEda.tipo === 'anim' && dEda.eda && ui2 === 'eda', 'en el editor de animaciones: botón Verity → pedido de animación, y al cerrar se vuelve al editor', { dEda, ui2 });
await ev(`edaCerrar(); 1`);

// ---------------- B: con Gemini de verdad ----------------
if (G) {
  await p.unroute(/\/api\/verity\/crear$/);
  await ev(`PREFS.verGem = ${JSON.stringify(G)}; 1`);
  const nm = Number(await ev(`Object.keys(INST.mods).length`));
  const t0 = Date.now();
  await ev(`verPreguntar('Verity, creame un mod donde salto altísimo y cada 5 segundos aparece una pelota cerca mío', '', '', 'yo'); 1`);
  for (let i = 0; i < 100 && (await ev(`VER.pensando`)); i++) await espera(300);
  const acc = JSON.parse(await ev(`JSON.stringify(VER.hist.slice(-1)[0])`));
  for (let i = 0; i < 600 && (await ev(`VCR.ocupado`)); i++) await espera(300);
  const b1 = JSON.parse(await ev(`(() => { const L = Object.values(INST.mods); const m = L[L.length - 1]; return JSON.stringify({ n: L.length, nombre: m && m.nombre, act: !!(m && modsFuente()[m.id]), salto: m && m.efectos.salto, cod: !!(m && m.codigo), dijo: VER.hist.slice(-1)[0] }); })()`));
  ok(b1.n === nm + 1 && b1.act, 'desde la charla: "creame un mod..." → lo crea, lo instala y lo prende', { accion: acc && acc[2], ...b1, seg: Math.round((Date.now() - t0) / 1000) });
  await espera(7000);
  const pel = Number(await ev(`OBJS.filter((o) => /pelota|ball/i.test(o.nombre)).length`));
  ok(pel > 0, 'y su código anda (aparecen pelotas)', { pelotas: pel });
  await p.screenshot({ path: D + 'c_b_mod.png' });
  await ev(`for (const m of Object.values(INST.mods)) if (m.autor === 'Verity') { delete modsFuente()[m.id]; delete INST.mods[m.id]; } smAplicar(false); for (const o of OBJS.slice()) if (/pelota|ball/i.test(o.nombre)) borrarObjeto(o); 1`);
  // animación desde el editor
  await ev(`edaAbrir(); 1`); await espera(600);
  await ev(`EDA.el.querySelector('[data-ea=verity]').click(); $('verCreaIn').value = 'un baile de robot con los brazos que suben y bajan, un giro completo y una sentadilla'; $('verCrea').querySelector('[data-c=ok]').click(); 1`);
  const t1 = Date.now(); await espera(500);
  for (let i = 0; i < 600 && (await ev(`VCR.ocupado`)); i++) await espera(300);
  const b2 = JSON.parse(await ev(`JSON.stringify({ n: EDA.keys.length, dur: EDA.dur, nom: EDA.nombre, play: EDA.play, finitas: EDA.keys.every((k) => Object.values(k.q).every((v) => v.every(Number.isFinite))) })`));
  ok(b2.n >= 5 && b2.finitas && b2.play, 'en el editor: Verity arma la animación y queda reproduciéndose', { ...b2, seg: Math.round((Date.now() - t1) / 1000) });
  for (const t of [0.15, 0.4, 0.65, 0.9]) { await ev(`EDA.play = false; EDA.t = EDA.dur * ${t}; 1`); await espera(250); await p.screenshot({ path: D + `c_b_anim_${Math.round(t * 100)}.png` }); }
  await ev(`EDA.cambio = false; edaCerrar(); 1`);
  // construcción en el creador de mapas
  await ev(`creadorEmpezar('FlatGrass'); 1`); await espera(7000);
  await ev(`JUG.pitch = -0.35; 1`); await espera(300);
  const nc = Number(await ev(`OBJS.length`));
  await ev(`CREA.bar.querySelector('[data-cr=verity]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); $('verCreaIn').value = 'una torre de vigilancia con escalera y dos faroles en la entrada'; $('verCrea').querySelector('[data-c=ok]').click(); 1`);
  const t2 = Date.now(); await espera(500);
  for (let i = 0; i < 600 && (await ev(`VCR.ocupado || !!VCR.obra`)); i++) await espera(300);
  const b3 = JSON.parse(await ev(`JSON.stringify({ n: OBJS.length - ${nc}, crea: CREA.on, guarda: creadorDatos ? 1 : 0 })`));
  ok(b3.n >= 6 && b3.crea, 'en el creador de mapas: Verity construye donde mirás (y queda en el mapa)', { ...b3, seg: Math.round((Date.now() - t2) / 1000) });
  await ev(`JUG.pitch = -0.2; 1`); await espera(500); await p.screenshot({ path: D + 'c_b_mapa.png' });
  await ev(`PREFS.verGem = ''; 1`);
}

// ---------------- C: la tienda crea (worker.js de verdad) ----------------
if (SIM) {
  const T = fs.readFileSync(SIM + '/token', 'utf8').trim(), A = fs.readFileSync(SIM + '/cuenta', 'utf8').trim(), GK = fs.readFileSync(SIM + '/gemini', 'utf8').trim(), filas = new Map();
  const DB = { prepare(sql) { const st = { args: [], bind(...a) { st.args = a; return st; }, async run() { return {}; },
    async first() { if (/RETURNING c, v/.test(sql)) { const k = st.args[0] + '|' + st.args[1], f = filas.get(k) || { c: 0, v: 0 }; f.c += st.args[2]; f.v += st.args[3]; filas.set(k, f); return f; } if (/RETURNING c/.test(sql)) { const k = st.args[0] + '|' + st.args[1], f = filas.get(k) || { c: 0, v: 0 }; f.c += 1; filas.set(k, f); return { c: f.c }; } return null; } }; return st; } };
  const AI = { async run(m, inp) { const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${A}/ai/run/${m}`, { method: 'POST', headers: { Authorization: 'Bearer ' + T, 'Content-Type': 'application/json' }, body: JSON.stringify(inp) }); const d = await r.json(); if (!d.success) throw new Error(JSON.stringify(d.errors)); return d.result; } };
  globalThis.caches = { default: { async match() {}, async put() {} } };
  const Wk = (await import('../tienda/worker.js')).default;
  const pedir = async (cuerpo, env) => { const t0 = Date.now(), r = await Wk.fetch(new Request('https://x.dev/api/verity/crear', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' }, body: JSON.stringify(cuerpo) }), env, { waitUntil() {} }); return { st: r.status, d: await r.json(), seg: Math.round((Date.now() - t0) / 1000) }; };
  const props = [['Crate', 1.2, 1.2, 1.2], ['Box2', 0.8, 0.8, 0.8], ['Barrel', 0.7, 1.1, 0.7]];
  let x = await pedir({ tipo: 'mod', q: 'super velocidad y un botón que me lanza al cielo', l: 'es', props, armas: ['Pistol'], salaId: 'f_Desert_1' }, { DB, AI, GEMINI_KEY: GK });
  ok(x.st === 200 && x.d.f === 'gemini' && x.d.mod && x.d.mod.codigo, 'la tienda: crea el mod con Gemini (pensando a fondo)', { st: x.st, f: x.d.f, nombre: x.d.mod && x.d.mod.nombre, seg: x.seg });
  x = await pedir({ tipo: 'mapa', q: 'una pirámide de cajas', l: 'es', props, salaId: '' }, { DB, AI, GEMINI_KEY: GK });
  ok(x.st === 200 && x.d.f === 'gemini' && x.d.mapa && x.d.mapa.objetos.length >= 4, 'en cualquier server (no sólo los premium): también Gemini, para todos', { st: x.st, f: x.d.f, n: x.d.mapa && x.d.mapa.objetos.length, seg: x.seg });
  x = await pedir({ tipo: 'mapa', q: 'una pirámide de cajas', l: 'es', props, sinCF: 1 }, { DB, AI });
  ok(x.st === 503, 'sin Gemini y con "sinCF": la tienda no usa el modelo chico (el juego prueba antes los gratis grandes)', x.st);
  x = await pedir({ tipo: 'mapa', q: 'una pirámide de cajas', l: 'es', props }, { DB, AI });
  ok(x.st === 200 && x.d.f === 'cf' && x.d.mapa && x.d.mapa.objetos.length >= 4, 'y si no, Workers AI arma una construcción simple', { st: x.st, f: x.d.f, n: x.d.mapa && x.d.mapa.objetos.length, seg: x.seg });
  x = await pedir({ tipo: 'anim', q: 'saludar con la mano', l: 'es', salaId: '' }, { DB, AI });
  ok(x.st === 200 && x.d.anim && x.d.anim.claves.length >= 2, 'y una animación simple', { st: x.st, f: x.d.f, n: x.d.anim && x.d.anim.claves.length, seg: x.seg });
  x = await pedir({ tipo: 'nada', q: 'x' }, { DB, AI });
  ok(x.st === 400, 'un pedido que no sirve: 400', x.st);
}
const malos = err.filter((e) => !/favicon|404|net::|Failed to load resource|AudioContext|youtube|WebGL|GPU stall|pollinations/i.test(e));
ok(malos.length === 0, 'sin errores en la consola', malos.slice(0, 6));
console.log(fallas ? `FALLAS: ${fallas}` : 'TODO OK');
await b.close(); process.exit(fallas ? 1 : 0);
