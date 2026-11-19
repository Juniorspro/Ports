// ---------------------------------------------------------------------------------------------------------
// El evento de los 300 (ev300.js): gm_construct de noche. El cuarto del 1.047 (detrás de la puerta del edificio de
// abajo, con «1.047» y «PEPE SIEMPRE VUELVE» pintados arriba y el auto chocado contra la pared de al lado) está cerrado
// con un candado de 10 sellos; cada misión abre uno. Dos tabiques adentro del salón dejan la puerta como única entrada:
// si alguien igual se mete (un bug), lo saca y se reinicia la última misión que hizo. Las misiones:
//   cajas      juntar 10 cajas marcadas en el cuadrado rojo (contador arriba); algunas con truco (arriba de otras, en la
//              pileta, detrás de un alambrado que se pasa agachado, en el techo, arriba del auto)
//   fusibles   tres baterías, a la caja de fusibles de la pared: se prende el poste de luz
//   codigo     cuatro papeles con un número cada uno; el teclado del casillero
//   radio      sintonizar la frecuencia de Pepe (1.047 / 10 = 104.7)
//   simon      repetir la secuencia de las cuatro luces, tres rondas
//   palancas   la posición de las cuatro palancas está pintada adentro, y sólo se ve con la linterna
//   sigilo     sacar el sello del salón oscuro sin que te vea lo que camina adentro
//   llave      la llave que brilla en el fondo de la pileta
//   torre      subir saltando por las plataformas hasta el techo y tocar la campana
//   orden      tocar las cosas con que murió Pepe en el orden del registro (el papel está en el auto)
// Los papeles se leen con usar (el texto entero en grande); las cajas y las baterías se agarran con usar y se tiran con
// el disparo. Al final, adentro: Pepe, «pedir perdón», el screamer y el reinicio (ev3Final*). Y el epílogo.
// ---------------------------------------------------------------------------------------------------------
const EV3_INICIO = [1.6, 13.0];                    // (dónde se despierta: mirando la puerta del 1.047)
const EV3_CUARTO = { x0: -4.4, x1: 7.4, z0: 26.35, z1: 36.1, puerta: [0.1, 3.2] };
const EV3_PUERTA = v3(1.65, 0, 25.95);
// ---------------- las misiones ----------------
const EV3_MIS = [
  { id: 'cajas', centro: [-12, -6], inicio: [-12, 0] },
  { id: 'fusibles', centro: [6.5, 23.5], inicio: [6.5, 21] },
  { id: 'codigo', centro: [30, 21.8], inicio: [30, 19] },
  { id: 'radio', centro: [-22, -40], inicio: [-22, -37] },
  { id: 'simon', centro: [20, -30], inicio: [20, -27] },
  { id: 'palancas', centro: [21.1, 24.5], inicio: [21, 21] },
  { id: 'sigilo', centro: [-15, 30], inicio: [-13, 21.5] },
  { id: 'llave', centro: [60, -22], inicio: [49.5, -14] },
  { id: 'torre', centro: [-16, 23], inicio: [-24, 19] },
  { id: 'orden', centro: [30, -55], inicio: [30, -50] },
];
const ev3M = (id) => EV3_MIS.find((M) => M.id === id);
const ev3Hecha = (id) => EV3.est.hechas.includes(id);
function ev3MisCerca() {
  let mejor = null, dm = 26;
  for (const M of EV3_MIS) { const d = Math.hypot(JUG.pos.x - M.centro[0], JUG.pos.z - M.centro[1]); if (d < dm) { dm = d; mejor = M; } }
  return mejor;
}
// una misión terminada: el sello, guardado
function ev3MisHecha(M, salteada) {
  if (ev3Hecha(M.id)) return;
  EV3.est.hechas.push(M.id); EV3.est.ultima = M.id; ev3Guardar();
  const n = EV3.est.hechas.length;
  ev3Son('sello', 0, 1); ev3Msj(T('ev3.sello') + ' ' + n + '/10' + (salteada ? '' : ''), 3.2);
  setTimeout(() => { if (EV3.fase === 'puzles') ev3Voz(n >= 10 ? 's5' : n >= 8 ? 's4' : ['s1', 's2', 's3'][n % 3], 0.75); }, 900);
  if (M.fin) M.fin();
  if (n >= 10) setTimeout(() => { if (EV3.fase === 'puzles') { ev3Msj(T('ev3.abierto'), 5); ev3PuertaAbrir(); } }, 2600);
}
function ev3MisReiniciar(M, manual) {
  if (manual) { EV3.est.reinicios[M.id] = (EV3.est.reinicios[M.id] || 0) + 1; ev3Guardar(); }
  if (M.reiniciar) M.reiniciar();
  if (manual && M.inicio) { const [x, z] = M.inicio; JUG.pos.set(x, ev3Piso(x, z) + 1.0, z); JUG.vel.set(0, 0, 0); }
}
// ---------------- armar la noche ----------------
function ev3PuzlesArmar() {
  ev3Limpiar(); EV3.est.fase = 'puzles'; ev3Guardar();
  if (!EV3.hora0) EV3.hora0 = performance.now();
  document.body.classList.remove('ev3Quieto', 'ev3SinLint');
  vhsTexto('I', 'PLAY ▶'); vhsTexto('AD', 'NOV. 19 1998'); ev3SellosOsd();
  VHS.dano = 0.32;
  // vos, parado frente a la puerta del 1.047, con la linterna
  const [x, z] = EV3_INICIO; JUG.pos.set(x, ev3Piso(x, z) + 1.0, z); JUG.vel.set(0, 0, 0); JUG.yaw = 0; JUG.pitch = 0.05; JUG.bloqueado = false; JUG.vivo = true;
  if (typeof linternaAlternar === 'function') linternaAlternar(true);
  ev3Bucle('cinta', 'cinta', 0.035); ev3Bucle('grave', 'grave', 0.12);
  // el 1.047: tabiques, la puerta con el candado, lo pintado, el auto chocado, Pepe adentro
  ev3CuartoArmar();
  // los papeles de todos y las misiones
  ev3Papel('ev3.p.inicio', v3(x + 1.2, ev3Piso(x + 1.2, z + 1.5) + 0.02, z + 1.5), v3(0, 1, 0), { piso: true });
  EV3.mis = {};
  for (const M of EV3_MIS) { EV3.mis[M.id] = {}; try { EV3_MIS_ARMAR[M.id](M, ev3Hecha(M.id)); } catch (e) { console.error('ev300', M.id, e); } }
  if (EV3.est.hechas.length >= 10) ev3PuertaAbrir(true);
  // (recién despierto de la cinta: entra de negro, con la cinta trabada un momento)
  VHS.negro = 1; EV3.despierta = 0;
}
function ev3SellosOsd() { vhsTexto('D', T('ev3.sellos') + ' ' + EV3.est.hechas.length + '/10'); }
function ev3PuzlesPaso(dt) {
  // entrar de negro
  if (EV3.despierta !== undefined && EV3.despierta < 3) { EV3.despierta += dt; VHS.negro = clamp(1 - (EV3.despierta - 0.6) / 2, 0, 1); VHS.dano = 0.32 + 0.4 * clamp(1 - EV3.despierta / 3, 0, 1); if (EV3.despierta >= 1.2 && !EV3.msjIni) { EV3.msjIni = true; ev3Msj(T('ev3.objetivo'), 5); } }
  ev3SellosOsd();
  // el bug: adentro del cuarto sin los 10 sellos
  const Cu = EV3_CUARTO, p = JUG.pos;
  if (EV3.est.hechas.length < 10 && p.x > Cu.x0 + 0.2 && p.x < Cu.x1 - 0.2 && p.z > Cu.z0 + 0.25 && p.z < Cu.z1 && p.y < 2) ev3Echar();
  for (const M of EV3_MIS) { const S = EV3.mis[M.id]; if (S && S.paso && !ev3Hecha(M.id)) try { S.paso(dt); } catch (e) { console.error('ev300', M.id, e); S.paso = null; } }
  // (Pepe, adentro: sólo con la puerta abierta y cerca —antes no se ve—; los props del evento a más de 60 m, sin dibujar)
  const pe = EV3.cuarto && EV3.cuarto.pepe; if (pe) pe.ev3Oculto = !(EV3.cuarto.abierta && Math.hypot(p.x - pe.pos.x, p.z - pe.pos.z) < 30);
  if ((EV3.visT = (EV3.visT || 0) - dt) <= 0) { EV3.visT = 0.5; for (const o of EV3.objs) if (o.md && o !== EV3.lleva) o.md.oculto = Math.abs(o.b.pos.x - p.x) + Math.abs(o.b.pos.z - p.z) > 70; }
  if (EV3.puertaT !== undefined) ev3PuertaPaso(dt);
}
// (sacarlo del cuarto y reiniciar la última misión que hizo)
function ev3Echar() {
  const [x, z] = EV3_INICIO; JUG.pos.set(x, ev3Piso(x, z) + 1.0, z); JUG.vel.set(0, 0, 0); JUG.yaw = 0;
  VHS.sacudon = 1; setTimeout(() => { VHS.sacudon = 0; }, 400); ev3Son('mal', 0, 1); ev3Voz('s3', 0.8, 0.85);
  const u = EV3.est.ultima, M = u && ev3M(u);
  if (M && ev3Hecha(u)) {
    EV3.est.hechas = EV3.est.hechas.filter((k) => k !== u); EV3.est.ultima = EV3.est.hechas[EV3.est.hechas.length - 1] || null; ev3Guardar();
    // (la misión vuelve a empezar: sus cosas en su lugar)
    try { if (M.deshacer) M.deshacer(); EV3_MIS_ARMAR[M.id](M, false); } catch (e) { console.error('ev300', e); }
    ev3Msj(T('ev3.echado') + '\n' + T('ev3.m.' + u), 4);
  } else ev3Msj(T('ev3.echado'), 3);
}
// (cada misión se dibuja sólo con la cámara a menos de 50 m —de noche no se ve más lejos—: en un celu flojo dibujar todo el
// mapa a la vez costaba el doble de lo que cuesta el resto)
function ev3PuzlesDibujar() {
  const cp = CAM.pos;
  if (Math.abs(cp.x - EV3_PUERTA.x) + Math.abs(cp.z - EV3_PUERTA.z) < 60) ev3CuartoDibujar();
  for (const M of EV3_MIS) { const S = EV3.mis[M.id]; if (!S || !S.dibujar) continue; const [x, z] = M.centro; if (Math.abs(cp.x - x) + Math.abs(cp.z - z) > (M.lejos || 55)) continue; try { S.dibujar(); } catch (e) { S.dibujar = null; } }
}
// las luces: la del cuarto, la de cada misión que falta (roja) o hecha (verde, más baja), las de cada misión
function ev3PuzlesLuces() {
  const cp = CAM.pos, L = [];
  for (const M of EV3_MIS) {
    const S = EV3.mis[M.id]; if (!S) continue;
    if (S.luces) S.luces(L);
    const [x, z] = M.inicio, d = Math.hypot(cp.x - x, cp.z - z); if (d > 40) continue;
    const ok = ev3Hecha(M.id), y = ev3PisoC(x, z);
    L.push({ p: v3(x, y + 2.2, z), r: 5.5, c: ok ? [0.3, 1.2, 0.4] : [2.2 * (0.8 + 0.2 * Math.sin(EV3.t * 3 + x)), 0.18, 0.15], q: ok ? 2 : 4, d });
  }
  ev3CuartoLuces(L);
  // (el screamer: la cara de Pepe iluminada de frente, que se vea lo deformada)
  if (EV3.fase === 'screamer') L.push({ p: vadd(CAM.pos, v3(0, 0.25, 0)), r: 3.5, c: [5.5, 5, 4.4], q: 99, d: 0 });
  L.sort((a, b) => b.q - a.q || a.d - b.d);
  for (const l of L.slice(0, 3)) luzEspecial(l.p, l.r, l.c, l.dir || null, l.k === undefined ? -2 : l.k, l.q);
}
// (adentro del salón de abajo: tiene cielorraso a 0,8 m —el techo de afuera está a 1,6—; el piso se mide desde abajo de él)
const ev3PisoAdentro = (x, z) => ev3Piso(x, z, -4.5);
const EV3_PISOS = new Map();
function ev3PisoC(x, z) { const k = Math.round(x * 4) + ',' + Math.round(z * 4); let y = EV3_PISOS.get(k); if (y === undefined) { y = ev3Piso(x, z); EV3_PISOS.set(k, y); } return y; }
// ---------------- los papeles ----------------
// (una hoja escrita a mano; la de los números de la misión del código lleva el número grande)
function ev3PapelLienzo(grande) {
  return ev3Lienzo(256, 320, (g, w, h) => {
    g.fillStyle = '#e9e2cf'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(120,90,40,.18)'; for (let i = 0; i < 9; i++) g.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 60, 3 + Math.random() * 6);
    g.strokeStyle = 'rgba(70,90,160,.35)'; g.lineWidth = 2; for (let y = 50; y < h; y += 26) { g.beginPath(); g.moveTo(14, y); g.lineTo(w - 14, y); g.stroke(); }
    g.fillStyle = '#2b2620';
    if (grande) { g.font = "bold 170px " + EV3_MANO; g.textAlign = 'center'; g.fillText(grande, w / 2, 240); g.font = "34px " + EV3_MANO; g.fillText('···', w / 2, 70); }
    else { g.font = "24px " + EV3_MANO; for (let y = 72; y < h - 30; y += 26) { g.fillRect(24, y - 8, 40 + Math.random() * (w - 90), 3); } }
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
  }, null, false);
}
function ev3Papel(clave, p, n, op) {
  op = op || {}; if (!EV3.papelL && !op.grande) EV3.papelL = ev3PapelLienzo();
  const L = op.grande ? ev3PapelLienzo(op.grande) : EV3.papelL;
  const c = op.piso ? vadd(p, v3(0, 0.012, 0)) : p, C = ev3Cartel(L, c, n, 0.3, 0.38, { giro: op.giro || 0, doble: !!op.doble });
  const q = ev3Punto(c, 0.3, T('ev3.leer'), () => ev3NotaAbrir(typeof clave === 'function' ? clave() : T(clave)));
  return { C, q };
}
// ---------------- el cuarto del 1.047 ----------------
function ev3CuartoArmar() {
  const yp = ev3Piso(1.6, 22), Cu = EV3_CUARTO; EV3.cuarto = { yp };
  // los tabiques adentro del salón (de piso a techo), así la puerta es la única entrada
  const base = (typeof matDelJuego === 'function') ? [/concrete/i, /cement/i, /plaster/i].map((r) => matDelJuego(r)).find((i) => i >= 0) : -1;
  EV3.cuarto.mat = ev3Mat('tabique', [0.5, 0.48, 0.45], { de: base === undefined ? -1 : base });
  const B = geoNuevo(), alto = 5.2;
  for (const x of [Cu.x0, Cu.x1]) { geoCaja(B, v3(x, yp + alto / 2, (Cu.z0 + Cu.z1) / 2), [0.15, alto / 2, (Cu.z1 - Cu.z0) / 2 + 0.1], null, 2); ev3Fija(v3(x, yp + alto / 2, (Cu.z0 + Cu.z1) / 2), [0.15, alto / 2, (Cu.z1 - Cu.z0) / 2 + 0.1]); }
  if (EV3.cuarto.malla >= 0) mallaPropiaBorrar(EV3.cuarto.malla);
  EV3.cuarto.malla = mallaPropia(B);
  // la puerta: dos hojas de madera y el bloqueo (mientras falten sellos)
  EV3.cuarto.hojas = [];
  const pz = EV3_PUERTA.z + 0.12;
  for (const [dx, s] of [[-0.62, 1], [0.62, -1]]) { const o = ev3Prop('door_wood', v3(EV3_PUERTA.x + dx, yp + 1.2, pz), new Quat(), { piso: yp }); if (o) { o.ev3P0 = o.b.pos.clone(); o.ev3Q0 = o.b.q.clone(); o.ev3S = s; EV3.cuarto.hojas.push(o); } }
  EV3.cuarto.bloqueo = ev3Fija(v3(EV3_PUERTA.x, yp + 1.6, EV3_PUERTA.z + 0.15), [1.75, 1.6, 0.16]);
  EV3.puertaT = undefined; EV3.cuarto.abierta = false;
  // lo pintado: «1.047» arriba de la puerta y «PEPE SIEMPRE VUELVE» abajo; adentro, las rayitas
  const pint = (txt, tam, ancho) => ev3Lienzo(1024, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.font = `${tam}px Impact, 'Arial Black', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(150,8,8,.92)'; g.shadowColor = 'rgba(90,0,0,.8)'; g.shadowBlur = 8; g.fillText(txt, w / 2, h / 2); g.shadowBlur = 0; for (let i = 0; i < 26; i++) { const x = w * (0.5 - ancho / 2) + Math.random() * w * ancho, y = h / 2 + tam * 0.3; g.fillRect(x, y, 3 + Math.random() * 4, 20 + Math.random() * 70); } }, 'cut', false);
  ev3Cartel(pint('1.047', 210, 0.45), v3(EV3_PUERTA.x, yp + 4.55, 25.94), v3(0, 0, -1), 3.2, 0.8);
  ev3Cartel(pint('PEPE SIEMPRE VUELVE', 120, 0.85), v3(EV3_PUERTA.x, yp + 3.42, 25.94), v3(0, 0, -1), 3.4, 0.85);
  const rayas = ev3Lienzo(1024, 512, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(30,25,22,.85)'; g.lineWidth = 3; let n = 0; for (let y = 20; y < h - 20 && n < 1047; y += 34) for (let x = 14; x < w - 40 && n < 1047; x += 32) { for (let k = 0; k < 4 && n < 1047; k++, n++) { g.beginPath(); g.moveTo(x + k * 6, y); g.lineTo(x + k * 6 + 1, y + 24); g.stroke(); } if (n < 1047) { g.beginPath(); g.moveTo(x - 3, y + 20); g.lineTo(x + 24, y + 4); g.stroke(); n++; } } }, 'cut', false);
  ev3Cartel(rayas, v3(1.5, yp + 2.1, Cu.z1 - 0.02), v3(0, 0, -1), 9, 4.2);
  // el auto chocado contra la pared, al lado de la puerta
  const au = ev3Prop('Sedan', v3(-2.0, yp + 1, 22), new Quat(), {}); EV3.cuarto.auto = au;
  if (au) { const bb = ev3Caja(au); if (bb.max.x - bb.min.x > bb.max.z - bb.min.z) { au.b.q.copy(Quat.axis(0, 1, 0, Math.PI / 2)); au.b.updateWorld && au.b.updateWorld(); }
    const b2 = ev3Caja(au), fr = b2.max.z - au.b.pos.z; au.b.pos.z = 25.95 - fr - 0.05; au.b.pos.y += yp - b2.min.y; au.b.vel.set(0, 0, 0); au.b.updateWorld && au.b.updateWorld();
    try { if (typeof desAbollar === 'function') desAbollar(au, vadd(au.b.pos, au.b.q.rot(v3(0, -0.1, fr))), au.b.q.rot(v3(0, 0, -1)), 0.46, 1.4); if (typeof desDe === 'function') desDe(au); if (au.veh) au.veh.vida = 70; } catch (e) {}
  }
  // Pepe, adentro, de espaldas, mirando la pared de las rayitas
  const pe = crearPersona('Engineer', 'HatEmpty', { nombre: '' }); EV3.pers.push(pe); EV3.cuarto.pepe = pe;
  pe.pos.set(1.6, yp + 0.96, 33.6); pe.yaw = 0; pe.vel.set(0, 0, 0); pe.suelo = true;
  ev3Punto(v3(1.6, yp + 1.2, 33.6), 0.45, T('ev3.perdon'), () => ev3FinalEmpezar(), { activo: () => EV3.cuarto.abierta && EV3.fase === 'puzles' });
  EV3.cuarto.matCad = ev3Mat('cadena', [0.32, 0.32, 0.34], { pbr: [0.35, 1, 0.5] });
  EV3.cuarto.matCand = ev3Mat('candado', [0.55, 0.45, 0.2], { pbr: [0.3, 1, 0.6] });
  EV3.cuarto.matLuzR = ev3Mat('selloR', [0.2, 0.02, 0.02], { em: [6, 0.3, 0.2] });
  EV3.cuarto.matLuzV = ev3Mat('selloV', [0.02, 0.2, 0.05], { em: [0.3, 5, 0.8] });
  // (el registro de las muertes, en el capó del auto: lo usa la misión del orden)
  if (au) ev3Papel('ev3.p.registro', vadd(au.b.pos, v3(0, 0.75, -1.2)), v3(0, 1, 0), { piso: true, giro: 0.3 });
}
function ev3CuartoDibujar() {
  const C = EV3.cuarto; if (!C) return;
  if (C.malla >= 0 && R.mallas[C.malla]) encolar(C.malla, 0, C.mat, IDM, null, null);
  const yp = C.yp, cx = EV3_PUERTA.x, z = EV3_PUERTA.z - 0.08;
  // (cerrado y quieto: las cadenas, el candado y los sellos, armados una vez en mallas —tres dibujos en vez de 48—)
  if (!C.abierta) {
    if (!C.mCad) {
      const L = [], Lc = [];
      for (const [a, b] of [[v3(cx - 1.45, yp + 2.6, z), v3(cx + 1.45, yp + 0.4, z)], [v3(cx - 1.45, yp + 0.4, z), v3(cx + 1.45, yp + 2.6, z)]]) {
        const d = vsub(b, a), Ld = d.len(), n = 18, q = Quat.euler(Math.atan2(d.x, d.z), -Math.asin(clamp(d.y / Ld, -1, 1)));
        for (let i = 0; i < n; i++) L.push([vadd(a, vscale(d, (i + 0.5) / n)), [i % 2 ? 0.02 : 0.05, i % 2 ? 0.05 : 0.02, Ld / n * 1.15], q]);
      }
      const pc = v3(cx, yp + 1.5, z - 0.05); L.push([vadd(pc, v3(0, 0.3, 0)), [0.26, 0.26, 0.05]]); Lc.push([pc, [0.34, 0.36, 0.12]]);
      C.mCad = ev3Malla(L); C.mCand = ev3Malla(Lc);
    }
    const n = EV3.est.hechas.length;
    if (C.selN !== n) { C.selN = n; for (const k of ['mSelV', 'mSelR']) if (C[k] >= 0) { mallaPropiaBorrar(C[k]); EV3.mallas = EV3.mallas.filter((x) => x !== C[k]); } const V = [], Rr = []; for (let i = 0; i < 10; i++) (i < n ? V : Rr).push([v3(cx - 0.72 + i * 0.16, yp + 2.95, z - 0.02), [0.07, 0.07, 0.04]]); C.mSelV = V.length ? ev3Malla(V) : -1; C.mSelR = Rr.length ? ev3Malla(Rr) : -1; }
    ev3MallaDibujar(C.mCad, C.matCad); ev3MallaDibujar(C.mCand, C.matCand); ev3MallaDibujar(C.mSelV, C.matLuzV); ev3MallaDibujar(C.mSelR, C.matLuzR);
    return;
  }
  // las cadenas cruzadas y el candado grande, con los 10 sellos encima (rojo: cerrado; verde: abierto): cayendo al abrir
  if (EV3.puertaT !== undefined && EV3.t - EV3.puertaT < 0.4) {
    const caida = EV3.puertaT !== undefined ? clamp((EV3.t - EV3.puertaT) / 0.4, 0, 1) : 0;
    for (const [a, b] of [[v3(cx - 1.45, yp + 2.6, z), v3(cx + 1.45, yp + 0.4, z)], [v3(cx - 1.45, yp + 0.4, z), v3(cx + 1.45, yp + 2.6, z)]]) {
      const d = vsub(b, a), L = d.len(), n = 18, q = Quat.euler(Math.atan2(d.x, d.z), -Math.asin(clamp(d.y / L, -1, 1)));
      for (let i = 0; i < n; i++) { const p = vadd(a, vscale(d, (i + 0.5) / n)); p.y -= caida * 2; dibujarCaja(p, [i % 2 ? 0.02 : 0.05, i % 2 ? 0.05 : 0.02, L / n * 1.15], q, C.matCad); }
    }
    const pc = v3(cx, yp + 1.5 - caida * 1.4, z - 0.05);
    dibujarCaja(pc, [0.34, 0.36, 0.12], null, C.matCand); dibujarCaja(vadd(pc, v3(0, 0.3, 0)), [0.26, 0.26, 0.05], null, C.matCad);
    const n = EV3.est.hechas.length;
    for (let i = 0; i < 10; i++) dibujarCaja(v3(cx - 0.72 + i * 0.16, yp + 2.95 - caida * 2.5, z - 0.02), [0.07, 0.07, 0.04], null, i < n ? C.matLuzV : C.matLuzR);
  }
}
function ev3CuartoLuces(L) {
  const C = EV3.cuarto; if (!C) return; const cp = CAM.pos;
  // (una roja tenue arriba del candado; adentro, cuando está abierto, la de Pepe)
  const pc = v3(EV3_PUERTA.x, C.yp + 3.3, EV3_PUERTA.z - 1.2);
  L.push({ p: pc, r: 7, c: [2.4, 0.22, 0.18], q: 5, d: pc.distTo(cp) });
  if (C.abierta) { const pp = v3(1.6, C.yp + 3, 32.5); L.push({ p: pp, r: 8, c: [2.6, 0.3, 0.25].map((x) => x * (0.75 + 0.25 * Math.random())), q: 6, d: pp.distTo(cp) }); }
}
// los 10 sellos: se caen las cadenas y se abren las dos hojas
function ev3PuertaAbrir(ya) {
  const C = EV3.cuarto; if (!C || C.abierta) return; C.abierta = true;
  if (C.bloqueo) { cajaQuitar(C.bloqueo); EV3.fijas = EV3.fijas.filter((b) => b !== C.bloqueo); C.bloqueo = null; }
  EV3.puertaT = ya ? EV3.t - 10 : EV3.t; if (!ya) { ev3Son('cadena', 0, 1); setTimeout(() => ev3Son('chirrido', 0, 0.9), 500); }
  ev3PuertaPaso(0);
}
function ev3PuertaPaso() {
  const C = EV3.cuarto; if (!C) return; const k = clamp((EV3.t - EV3.puertaT - 0.5) / 1.6, 0, 1), s = k * k * (3 - 2 * k);
  for (const o of C.hojas) { if (!OBJS.includes(o)) continue; const ang = o.ev3S * 1.45 * s, bis = vadd(o.ev3P0, v3(-o.ev3S * 0.6, 0, 0)), qa = Quat.axis(0, 1, 0, ang); o.b.q.copy(qa.clone().mul(o.ev3Q0)); o.b.pos.copy(vadd(bis, qa.rot(v3(o.ev3S * 0.6, 0, 0)))); o.b.updateWorld && o.b.updateWorld(); }
}
// ---------------- cada misión: lo que pone y lo que hace ----------------
const EV3_MIS_ARMAR = {
  // ===== las cajas =====
  cajas(M, hecha) {
    const S = EV3.mis.cajas = EV3.mis.cajas || {}; const [cx, cz] = M.centro, y = ev3Piso(cx, cz), h = 3.5;
    S.y = y; S.mat = ev3Mat('zonaRoja', [0.3, 0.02, 0.02], { em: [5, 0.25, 0.2] });
    S.cont = S.cont || ev3Lienzo(512, 256, (g, w, hh) => { g.clearRect(0, 0, w, hh); g.font = "150px VCR, 'Courier New', monospace"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = S.n >= 10 ? '#5f5' : '#f33'; g.shadowColor = '#000'; g.shadowBlur = 10; g.fillText((S.n || 0) + '/10', w / 2, hh / 2); }, 'blend', true);
    S.n = hecha ? 10 : 0; S.cont.pintar();
    if (!S.cartel) S.cartel = ev3Cartel(S.cont, v3(cx, y + 3.2, cz), null, 2.4, 1.2);
    if (!S.papeles) {
      S.papeles = true;
      ev3Papel('ev3.p.cajas', v3(cx + h + 0.6, y + 0.02, cz), v3(0, 1, 0), { piso: true });
      ev3Papel('ev3.p.cajasSalta', v3(-28.2, ev3Piso(-28.2, 8.6) + 0.02, 8.6), v3(0, 1, 0), { piso: true });
      ev3Papel('ev3.p.cajasFlota', v3(50.5, ev3Piso(50.5, -20) + 0.02, -20), v3(0, 1, 0), { piso: true });
      ev3Papel('ev3.p.cajasAgacha', v3(-34.6, ev3Piso(-34.6, -4) + 0.02, -1.4), v3(0, 1, 0), { piso: true });
      // (el corral de alambre: tres lados al ras y uno levantado 1,2 m, que se pasa agachado)
      const yc = ev3Piso(-38, -4);
      ev3Prop('ChainlinkSingle', v3(-38, yc + 1.4, -6), new Quat(), { piso: yc });
      ev3Prop('ChainlinkSingle', v3(-38, yc + 1.4, -2), new Quat(), { piso: yc });
      ev3Prop('ChainlinkSingle', v3(-40, yc + 1.4, -4), Quat.axis(0, 1, 0, Math.PI / 2), { piso: yc });
      ev3Prop('ChainlinkSingle', v3(-36, yc + 2.6, -4), Quat.axis(0, 1, 0, Math.PI / 2), { piso: yc + 1.2 });
      // (las cajas apiladas con un escalón)
      const ya = ev3Piso(-30, 10);
      ev3Prop('Crate', v3(-30, ya + 0.6, 10), new Quat(), { piso: ya }); ev3Prop('Crate', v3(-30, ya + 1.6, 10), new Quat(), { piso: ya + 1.02 }); ev3Prop('Crate', v3(-28.9, ya + 0.6, 10), new Quat(), { piso: ya });
    }
    S.cajas = S.cajas || []; for (const o of S.cajas) if (OBJS.includes(o)) borrarObjeto(o, true); S.cajas = [];
    if (hecha) return;
    const roof = ev3Piso(-17, 29, 6), auto = EV3.cuarto && EV3.cuarto.auto, pileta = ev3Pileta(60, -20);
    const L = [[-20, 4], [2, -22], [-32, -16], [16, -4], [-30, 10, ev3Piso(-30, 10) + 2.04], [60, -20, pileta ? pileta.sup : null], [15, 31, ev3PisoAdentro(15, 31)], [-38, -4], [-17, 29, roof], [-2, 22, auto ? ev3Caja(auto).max.y : null]];
    for (const [x, z, yy] of L) {
      const y0 = yy !== undefined && yy !== null ? yy : ev3Piso(x, z), o = ev3Prop('CajaCarton', v3(x, y0 + 0.5, z), Quat.axis(0, 1, 0, Math.random() * 3), { suelto: true, agarra: true, piso: y0 + 0.01 });
      if (!o) continue; o.ev3Orig = o.b.pos.clone(); o.b.frozen = x === 60 ? false : true; if (o.md) o.md.tinte = [1, 0.42, 0.36]; S.cajas.push(o);
    }
    S.paso = (dt) => {
      let n = 0; for (const o of S.cajas) {
        if (!OBJS.includes(o)) continue;
        if (o.b.pos.y < -40) { o.b.pos.copy(o.ev3Orig); o.b.vel.set(0, 0, 0); }
        if (Math.abs(o.b.pos.x - cx) < h && Math.abs(o.b.pos.z - cz) < h && o.b.pos.y < S.y + 2.5 && o !== EV3.lleva) n++;
      }
      if (n !== S.n) { S.n = n; S.cont.pintar(); if (n > 0) ev3Son('tono', 400 + n * 40, 0.6); }
      S.llenoT = n >= 10 ? (S.llenoT || 0) + dt : 0;
      if (S.llenoT > 1.2) ev3MisHecha(M);
    };
    if (!S.borde || !R.mallas[S.borde]) { const L = []; for (const [a, b] of [[[-h, -h], [h, -h]], [[h, -h], [h, h]], [[h, h], [-h, h]], [[-h, h], [-h, -h]]]) { const c = v3(cx + (a[0] + b[0]) / 2, S.y + 0.03, cz + (a[1] + b[1]) / 2), w = Math.abs(b[0] - a[0]) + 0.12, d = Math.abs(b[1] - a[1]) + 0.12; L.push([c, [Math.max(w, 0.12), 0.04, Math.max(d, 0.12)]]); } S.borde = ev3Malla(L); }
    S.dibujar = () => {
      const t = EV3.t; ev3MallaDibujar(S.borde, S.mat);
      // (cada caja con una lucecita roja arriba, que titila: de noche se encuentran)
      if (Math.floor(t * 1.6) % 2 === 0) for (const o of S.cajas) if (OBJS.includes(o) && o !== EV3.lleva) dibujarCaja(vadd(o.b.pos, v3(0, 0.36, 0)), [0.05, 0.05, 0.05], null, S.mat);
    };
    S.luces = (L) => { const p = v3(cx, S.y + 2.6, cz), d = p.distTo(CAM.pos); if (d < 30) L.push({ p, r: 6.5, c: [2.2, 0.2, 0.18], q: 3, d }); };
    M.reiniciar = () => EV3_MIS_ARMAR.cajas(M, false);
    M.fin = () => { S.n = 10; S.cont.pintar(); for (const o of S.cajas) if (OBJS.includes(o)) { o.ev3Agarra = false; } S.paso = null; };
  },
  // ===== los fusibles =====
  fusibles(M, hecha) {
    const S = EV3.mis.fusibles = EV3.mis.fusibles || {}; const fx = 6.5, fz = 25.82, y = ev3Piso(fx, 23); S.y = y;
    S.p = v3(fx, y + 1.45, fz); S.n = hecha ? 3 : 0;
    S.mat = ev3Mat('fusCaja', [0.35, 0.37, 0.36], { pbr: [0.45, 1, 0.5] }); S.matBat = ev3Mat('fusBat', [0.1, 0.1, 0.1]); S.matLuz = ev3Mat('fusLuz', [1, 0.95, 0.8], { em: [8, 7.5, 6] });
    if (!S.poste) { S.poste = ev3Prop('LightPole', v3(fx + 2.6, y + 4.4, 22.6), Quat.axis(0, 1, 0, Math.PI), { piso: y }); ev3Papel('ev3.p.fusibles', v3(fx + 0.75, y + 1.45, fz - 0.02), v3(0, 0, -1)); }
    S.bats = S.bats || []; for (const o of S.bats) if (OBJS.includes(o)) borrarObjeto(o, true); S.bats = [];
    if (!hecha) {
      if (!S.mesa) S.mesa = ev3Prop('Table', v3(24, ev3Piso(24, -12) + 0.6, -12), new Quat(), { piso: ev3Piso(24, -12) });
      for (const [x, z, yy] of [[62, 30, null], [24, -12, ev3Piso(24, -12) + 1.11], [36, -62, null]]) { const y0 = yy !== null ? yy : ev3Piso(x, z); const o = ev3Prop('battery', v3(x, y0 + 0.3, z), Quat.axis(0, 1, 0, Math.random() * 3), { suelto: true, agarra: true, piso: y0 + 0.01 }); if (o) { o.b.frozen = true; o.ev3Bat = true; S.bats.push(o); } }
    }
    if (!S.q) S.q = ev3Punto(S.p, 0.55, () => T('ev3.fusPoner') + ' (' + S.n + '/3)', () => {
      const o = EV3.lleva; if (!o || !o.ev3Bat) { ev3Son('mal', 0, 0.5); return; }
      ev3Soltar(false); borrarObjeto(o, true); S.n++; ev3Son('electrico', 0, 0.7); sonar('Click', null, 0.6);
      if (S.n >= 3) { ev3Son('electrico', 0, 1.2); ev3MisHecha(M); }
    }, { conLleva: true, activo: () => !ev3Hecha('fusibles') });
    S.dibujar = () => {
      dibujarCaja(S.p, [0.62, 0.82, 0.14], null, S.mat);
      for (let i = 0; i < 3; i++) dibujarCaja(vadd(S.p, v3(-0.18 + i * 0.18, -0.05, -0.08)), [0.12, 0.3, 0.05], null, i < S.n ? S.matBat : S.mat);
      if (S.n >= 3 && S.poste && OBJS.includes(S.poste)) dibujarCaja(vadd(S.poste.b.pos, S.poste.b.q.rot(v3(0, 4.2, 1.4))), [0.35, 0.12, 0.6], S.poste.b.q, S.matLuz);
    };
    S.luces = (L) => { if (S.n >= 3 && S.poste) { const p = vadd(S.poste.b.pos, S.poste.b.q.rot(v3(0, 3.9, 1.4))), d = p.distTo(CAM.pos); if (d < 45) L.push({ p, r: 16, c: [4, 3.8, 3.2], q: 3, d }); } };
    M.reiniciar = () => { S.n = 0; EV3_MIS_ARMAR.fusibles(M, false); };
  },
  // ===== el código (los cuatro papeles y el casillero) =====
  codigo(M, hecha) {
    const S = EV3.mis.codigo = EV3.mis.codigo || {}; const [cx, cz] = M.centro, y = ev3Piso(cx, cz); S.y = y;
    S.mat = ev3Mat('teclado', [0.15, 0.15, 0.16], { pbr: [0.5, 1, 0.4] }); S.matV = ev3Mat('tecladoV', [0.02, 0.3, 0.05], { em: [0.3, 4, 0.6] }); S.matR = ev3Mat('tecladoR', [0.3, 0.02, 0.02], { em: [4, 0.2, 0.1] });
    if (!S.puerta) {
      S.puerta = ev3Prop('door_wood', v3(cx, y + 1.2, cz), new Quat(), { piso: y }); if (S.puerta) { S.q0 = S.puerta.b.q.clone(); S.p0 = S.puerta.b.pos.clone(); }
      ev3Prop('WallSmall', v3(cx - 1.3, y + 0.5, cz), Quat.axis(0, 0, 1, Math.PI / 2), { piso: y }); ev3Prop('WallSmall', v3(cx + 1.3, y + 0.5, cz), Quat.axis(0, 0, 1, Math.PI / 2), { piso: y });
      ev3Papel('ev3.p.codigo', v3(cx + 1.05, y + 1.5, cz - 0.2), v3(0, 0, -1));
      // los cuatro números, por el mapa
      for (const [g, x, z, yy, n] of [['1', 4.2, 14.5, null, v3(0, 1, 0)], ['0', 44.5, -40, null, v3(0, 1, 0)], ['4', 19, 35.95, 1.4, v3(0, 0, -1)], ['7', -43.6, -40, 1.5, v3(1, 0, 0)]]) {
        const y0 = z > 26 ? ev3PisoAdentro(x, z - 1) : ev3Piso(x, z); ev3Papel(() => T('ev3.p.num').replace('{n}', g).replace('{o}', T('ev3.ord' + '1047'.indexOf(g))), v3(x, y0 + (yy === null ? 0.02 : yy), z), n, { grande: g, piso: yy === null });
      }
    }
    S.abierta = hecha;
    if (!S.q) S.q = ev3Punto(v3(cx + 0.78, y + 1.25, cz - 0.12), 0.3, T('ev3.teclado'), () => ev3TecladoAbrir((c) => { if (c === '1047') { S.abierta = true; S.abreT = EV3.t; ev3Son('bien', 0, 1); sonar('Click', null, 0.8); ev3MisHecha(M); return true; } ev3Son('mal', 0, 0.8); return false; }), { activo: () => !S.abierta });
    S.paso = null;
    S.dibujar = () => {
      const p = v3(cx + 0.78, y + 1.25, cz - 0.1); dibujarCaja(p, [0.16, 0.24, 0.05], null, S.mat); dibujarCaja(vadd(p, v3(0, 0.08, -0.03)), [0.1, 0.04, 0.01], null, S.abierta ? S.matV : S.matR);
      if (S.puerta && S.abierta) { const k = clamp(((EV3.t - (S.abreT ?? -9)) || 0) / 1.2, 0, 1), a = -1.4 * (S.abreT === undefined ? 1 : k), o = S.puerta, bis = vadd(S.p0, v3(-0.6, 0, 0)), qa = Quat.axis(0, 1, 0, a); o.b.q.copy(qa.clone().mul(S.q0)); o.b.pos.copy(vadd(bis, qa.rot(v3(0.6, 0, 0)))); o.b.updateWorld && o.b.updateWorld(); }
    };
    M.reiniciar = () => {};
    M.deshacer = () => { S.abierta = false; S.abreT = undefined; if (S.puerta) { S.puerta.b.q.copy(S.q0); S.puerta.b.pos.copy(S.p0); S.puerta.b.updateWorld && S.puerta.b.updateWorld(); } };
  },
  // ===== la radio =====
  radio(M, hecha) {
    const S = EV3.mis.radio = EV3.mis.radio || {}; const [cx, cz] = M.centro, y = ev3Piso(cx, cz); S.y = y;
    if (!S.mesa) { S.mesa = ev3Prop('Mesa', v3(cx, y + 0.4, cz), new Quat(), { piso: y }); ev3Papel('ev3.p.radio', v3(cx + 0.45, y + 0.79, cz - 0.1), v3(0, 1, 0), { piso: true, giro: -0.4 }); }
    S.mat = ev3Mat('radio', [0.32, 0.2, 0.12], { pbr: [0.6, 0, 0.1] }); S.matG = ev3Mat('radioG', [0.08, 0.08, 0.08]); S.matD = ev3Mat('radioD', [0.9, 0.7, 0.3], { em: [2.5, 1.8, 0.6] });
    S.p = v3(cx - 0.2, y + 0.92, cz);
    if (!S.q) S.q = ev3Punto(S.p, 0.35, T('ev3.radio'), () => ev3RadioAbrir(S, M), { activo: () => !ev3Hecha('radio') });
    S.dibujar = () => { dibujarCaja(S.p, [0.5, 0.28, 0.16], null, S.mat); dibujarCaja(vadd(S.p, v3(-0.12, 0, -0.085)), [0.18, 0.18, 0.01], null, S.matG); dibujarCaja(vadd(S.p, v3(0.13, 0.05, -0.085)), [0.16, 0.06, 0.01], null, S.matD); dibujarCaja(vadd(S.p, v3(0.16, 0.22, 0)), [0.01, 0.22, 0.01], Quat.axis(0, 0, 1, -0.4), S.matG); };
    M.reiniciar = () => {};
  },
  // ===== Simón (las cuatro luces) =====
  simon(M, hecha) {
    const S = EV3.mis.simon = EV3.mis.simon || {}; const [cx, cz] = M.centro, y = ev3Piso(cx, cz); S.y = y;
    const COL = [[5, 0.3, 0.2], [0.3, 4.5, 0.5], [0.4, 0.8, 5], [5, 4.2, 0.4]], TON = [330, 392, 494, 587];
    S.mats = COL.map((c, i) => [ev3Mat('simA' + i, c.map((x) => x * 0.05)), ev3Mat('simB' + i, c.map((x) => x * 0.12), { em: c })]);
    if (!S.mesa) {
      S.mesa = ev3Prop('Table', v3(cx, y + 0.6, cz), new Quat(), { piso: y }); S.bot = [];
      for (let i = 0; i < 4; i++) { const o = ev3Prop('Button', v3(cx - 0.75 + i * 0.5, y + 1.2, cz), Quat.axis(1, 0, 0, -Math.PI / 2), { piso: y + 1.11 }); S.bot.push(o); }
      ev3Papel('ev3.p.simon', v3(cx + 1.0, y + 1.12, cz + 0.3), v3(0, 1, 0), { piso: true });
    }
    S.ronda = 0; S.seq = []; S.ent = []; S.muestra = -1; S.luz = -1;
    const nueva = () => { S.seq = []; for (let i = 0; i < 4 + S.ronda; i++) S.seq.push((Math.random() * 4) | 0); S.ent = []; };
    const mostrar = () => { S.muestra = 0; S.mT = 0.6; };
    nueva();
    if (!S.qs) {
      S.qs = [ev3Punto(v3(cx, y + 1.6, cz - 0.45), 0.3, T('ev3.simonEsc'), () => { if (S.muestra < 0) mostrar(); }, { activo: () => !ev3Hecha('simon') })];
      for (let i = 0; i < 4; i++) S.qs.push(ev3Punto(v3(cx - 0.75 + i * 0.5, y + 1.18, cz), 0.2, () => T('ev3.simonBt') + ' ' + (i + 1), () => {
        if (S.muestra >= 0 || ev3Hecha('simon')) return; S.luz = i; S.luzT = 0.3; ev3Son('tono', TON[i], 1); S.ent.push(i);
        const k = S.ent.length - 1; if (S.ent[k] !== S.seq[k]) { ev3Son('mal', 0, 0.8); S.ent = []; setTimeout(mostrar, 900); return; }
        if (S.ent.length === S.seq.length) { ev3Son('bien', 0, 0.8); S.ronda++; if (S.ronda >= 3) { ev3MisHecha(M); return; } nueva(); setTimeout(mostrar, 1100); }
      }, { activo: () => !ev3Hecha('simon') }));
    }
    S.paso = (dt) => {
      if (S.luzT > 0 && (S.luzT -= dt) <= 0) S.luz = -1;
      if (S.muestra >= 0 && (S.mT -= dt) <= 0) {
        if (S.muestra >= S.seq.length) { S.muestra = -1; S.luz = -1; return; }
        const i = S.seq[S.muestra]; S.luz = i; S.luzT = 0.38; ev3Son('tono', TON[i], 1); S.muestra++; S.mT = 0.58;
      }
    };
    S.dibujar = () => { for (let i = 0; i < 4; i++) { const p = v3(cx - 0.75 + i * 0.5, y + 1.75, cz - 0.45); dibujarCaja(vadd(p, v3(0, -0.3, 0)), [0.04, 0.6, 0.04], null, S.mats[i][0]); dibujarCaja(p, [0.2, 0.2, 0.2], null, S.mats[i][S.luz === i || ev3Hecha('simon') ? 1 : 0]); } dibujarCaja(v3(cx, y + 1.6, cz - 0.45), [0.12, 0.12, 0.12], null, S.mats[3][0]); };
    S.luces = (L) => { if (S.luz >= 0) { const p = v3(cx - 0.75 + S.luz * 0.5, y + 1.9, cz - 0.2); L.push({ p, r: 4, c: COL[S.luz].map((x) => x * 0.6), q: 7, d: p.distTo(CAM.pos) }); } };
    M.reiniciar = () => { S.ronda = 0; nueva(); S.muestra = -1; };
  },
  // ===== las palancas (lo pintado que sólo ve la linterna) =====
  palancas(M, hecha) {
    const S = EV3.mis.palancas = EV3.mis.palancas || {}; const [cx] = M.centro, cz = 25.84, y = ev3Piso(cx, 23); S.y = y;
    S.meta = [1, 0, 0, 1]; S.pos = hecha ? S.meta.slice() : [0, 1, 1, 0];
    S.mat = ev3Mat('palBase', [0.25, 0.25, 0.26], { pbr: [0.4, 1, 0.5] }); S.matM = ev3Mat('palMango', [0.55, 0.08, 0.06]);
    if (!S.pint) {
      // (lo pintado con pintura que sólo se ve con luz negra: acá, con la linterna apuntándole)
      S.pint = ev3Cartel(ev3Lienzo(1024, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(160,255,200,.95)'; g.shadowColor = 'rgba(120,255,180,.9)'; g.shadowBlur = 18; g.font = "190px 'DejaVu Sans', Arial, sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('▲ ▼ ▼ ▲', w / 2, h / 2 + 6); }, 'blend', true), v3(14.5, ev3PisoAdentro(14.5, 33) + 1.7, 36.05), v3(0, 0, -1), 4, 1);
      S.pint.oculto = true;
      ev3Papel('ev3.p.palancas', v3(cx - 2.1, y + 1.5, cz - 0.03), v3(0, 0, -1));
    }
    if (!S.qs) { S.qs = []; for (let i = 0; i < 4; i++) S.qs.push(ev3Punto(v3(cx - 1.5 + i, y + 1.3, cz - 0.15), 0.28, T('ev3.palanca'), () => {
      if (ev3Hecha('palancas')) return; S.pos[i] = S.pos[i] ? 0 : 1; sonar('UI_interruptor', null, 0.8); ev3Son('tono', S.pos[i] ? 220 : 180, 0.4);
      if (S.pos.every((v, k) => v === S.meta[k])) { ev3Son('bien', 0, 1); ev3MisHecha(M); }
    }, { activo: () => !ev3Hecha('palancas') })); }
    S.paso = () => {
      // (lo pintado: se ve si la linterna está prendida, le apunta y estás a menos de 15 m)
      const P = S.pint, d = vsub(P.c, CAM.pos), L = d.len(); P.oculto = !(LINT.on && L < 15 && vdot(d, CAM.fwd) / L > 0.88);
    };
    if (!S.mBase || !R.mallas[S.mBase]) S.mBase = ev3Malla([0, 1, 2, 3].map((i) => [v3(cx - 1.5 + i, y + 1.3, cz - 0.05), [0.18, 0.34, 0.06]]));
    S.dibujar = () => { ev3MallaDibujar(S.mBase, S.mat); for (let i = 0; i < 4; i++) { const p = v3(cx - 1.5 + i, y + 1.3, cz - 0.05); const a = S.pos[i] ? -0.55 : 0.55, q = Quat.axis(1, 0, 0, a); dibujarCaja(vadd(p, q.rot(v3(0, 0.13, -0.14))), [0.05, 0.05, 0.3], q, S.matM); } };
    M.reiniciar = () => { S.pos = [0, 1, 1, 0]; };
  },
  // ===== el sigilo (el salón oscuro) =====
  sigilo(M, hecha) {
    const S = EV3.mis.sigilo = EV3.mis.sigilo || {}; const y = ev3PisoAdentro(-15, 30); S.y = y;
    const RUTA = [[-7, 28.2], [-24.5, 28.2], [-24.5, 34.6], [-7, 34.6]];
    S.matS = ev3Mat('selloRojo', [0.5, 0.03, 0.03], { em: [2.5, 0.1, 0.08] });
    if (!S.mesa) { S.mesa = ev3Prop('Mesa', v3(-23.6, y + 0.4, 33.9), new Quat(), { piso: y }); ev3Papel('ev3.p.sigilo', v3(-14, ev3Piso(-14, 24) + 1.4, 25.8), v3(0, 0, -1)); }
    if (S.ent && PERS.includes(S.ent)) { borrarPersona(S.ent); EV3.pers = EV3.pers.filter((P) => P !== S.ent); }
    S.ent = null; S.tiene = hecha;
    if (hecha) { S.paso = null; S.dibujar = null; return; }
    const E = crearPersona('Engineer', 'HatEmpty', { nombre: '' }); EV3.pers.push(E); S.ent = E; E.escVis = 1.12; ev3Deformar(E, 0.9);
    S.i = 0; S.alerta = 0; E.pos.set(RUTA[0][0], y + 0.96, RUTA[0][1]); E.suelo = true;
    if (!S.q) S.q = ev3Punto(v3(-23.6, y + 0.95, 33.9), 0.3, T('ev3.selloTomar'), () => { S.tiene = true; ev3Son('sello', 0, 0.6); ev3MisHecha(M); if (S.ent) { const e = S.ent; S.ent = null; setTimeout(() => { if (PERS.includes(e)) borrarPersona(e); }, 300); } }, { activo: () => !ev3Hecha('sigilo') });
    S.paso = (dt) => {
      const E2 = S.ent; if (!E2 || !PERS.includes(E2)) return;
      const yo = JUG.pos, dentro = yo.x < -4.4 && yo.x > -27 && yo.z > 26.2 && yo.z < 36.5;
      // (lejos del salón no camina ni se dibuja: se ve sólo desde adentro o desde las puertas)
      E2.ev3Oculto = !(yo.x < -1 && yo.x > -31 && yo.z > 21 && yo.z < 38); if (E2.ev3Oculto) return;
      let meta;
      if (S.alerta > 0) { meta = [yo.x, yo.z]; S.alerta -= dt; }
      else { meta = RUTA[S.i]; if (Math.hypot(E2.pos.x - meta[0], E2.pos.z - meta[1]) < 0.3) S.i = (S.i + 1) % RUTA.length; }
      const d = v3(meta[0] - E2.pos.x, 0, meta[1] - E2.pos.z), L = Math.hypot(d.x, d.z), v = S.alerta > 0 ? 4.2 : 1.25;
      if (L > 0.05) { E2.vel.set(d.x / L * v, 0, d.z / L * v); E2.pos.x += E2.vel.x * dt; E2.pos.z += E2.vel.z * dt; const yw = Math.atan2(d.x, d.z); let e = yw - E2.yaw; e = Math.atan2(Math.sin(e), Math.cos(e)); E2.yaw += e * Math.min(1, dt * 6); }
      E2.pos.y = S.y + 0.96; E2.suelo = true; if (E2.md) E2.md.tinte = EV3_NEGRO;
      // ¿te ve? (de frente, a menos de 10 m —17 con la linterna prendida—, sin pared en el medio)
      if (dentro && S.alerta <= 0) {
        const o = vadd(E2.pos, v3(0, 0.6, 0)), dd = vsub(vadd(yo, v3(0, 0.5, 0)), o), Ld = dd.len(), fw = v3(Math.sin(E2.yaw), 0, Math.cos(E2.yaw));
        const alcance = LINT.on ? 17 : 10;
        if (Ld < alcance && vdot(dd, fw) / Ld > 0.55 && !mundoRayo(o, vscale(dd, 1 / Ld), Ld - 0.3)) { S.alerta = 6; ev3Son('mal', 0, 1); ev3Voz('s3', 0.9, 0.8); }
      }
      if (S.alerta > 0 && Math.hypot(E2.pos.x - yo.x, E2.pos.z - yo.z) < 1.25) {
        // te agarró: afuera y de nuevo
        VHS.rojo = 1; VHS.sacudon = 1; ev3Son('grito', 0, 0.7); setTimeout(() => { VHS.rojo = 0; VHS.sacudon = 0; }, 450);
        JUG.pos.set(-13, ev3Piso(-13, 21.5) + 1, 21.5); JUG.vel.set(0, 0, 0); JUG.yaw = 0; EV3_MIS_ARMAR.sigilo(M, false);
      }
      if (!dentro && S.alerta > 0) S.alerta = Math.min(S.alerta, 0.5);
    };
    S.dibujar = () => { if (!S.tiene) dibujarCaja(v3(-23.6, S.y + 0.85, 33.9), [0.16, 0.16, 0.05], Quat.axis(0, 1, 0, EV3.t), S.matS); };
    M.reiniciar = () => EV3_MIS_ARMAR.sigilo(M, false);
  },
  // ===== la llave en la pileta =====
  llave(M, hecha) {
    const S = EV3.mis.llave = EV3.mis.llave || {}; const P = ev3Pileta(64, -26) || { sup: -4.4, fondo: -7 }; S.P = P;
    S.mat = ev3Mat('llave', [0.9, 0.75, 0.2], { em: [5, 4, 1], pbr: [0.3, 1, 0.8] });
    S.p = v3(64, P.fondo + 0.12, -26); S.tiene = hecha;
    if (!S.papel) { S.papel = true; ev3Papel('ev3.p.llave', v3(50.2, ev3Piso(50.2, -14) + 0.02, -14), v3(0, 1, 0), { piso: true }); }
    if (!S.q) S.q = ev3Punto(S.p, 0.6, T('ev3.llaveTomar'), () => { S.tiene = true; ev3Son('bien', 0, 1); ev3MisHecha(M); }, { activo: () => !S.tiene });
    S.dibujar = () => { if (S.tiene) return; const q = Quat.axis(0, 1, 0, EV3.t * 1.5); dibujarCaja(S.p, [0.24, 0.05, 0.06], q, S.mat); dibujarCaja(vadd(S.p, q.rot(v3(-0.14, 0, 0))), [0.1, 0.05, 0.12], q, S.mat); };
    S.luces = (L) => { if (!S.tiene) { const d = S.p.distTo(CAM.pos); if (d < 25) L.push({ p: vadd(S.p, v3(0, 0.6, 0)), r: 4, c: [2.5, 2, 0.5], q: 4, d }); } };
    M.reiniciar = () => {};
  },
  // ===== la torre (las plataformas hasta el techo y la campana) =====
  torre(M, hecha) {
    const S = EV3.mis.torre = EV3.mis.torre || {}; const y = ev3Piso(-21, 21); S.y = y;
    S.mat = ev3Mat('plataforma', [0.42, 0.3, 0.18], { de: typeof matDelJuego === 'function' ? matDelJuego(/wood|madera|plank/i) : -1 }); S.matC = ev3Mat('campana', [0.6, 0.45, 0.15], { pbr: [0.3, 1, 0.7] });
    if (!S.plat) {
      S.plat = [];
      const L = [[-24.0, 20.6, 0.6], [-22.4, 20.8, 1.2], [-20.8, 21.2, 1.8], [-19.2, 21.6, 2.4], [-17.6, 22.0, 3.0], [-16.0, 22.5, 3.6], [-14.4, 23.0, 4.2], [-12.8, 23.6, 4.8], [-11.2, 24.3, 5.4]];
      for (const [x, z, h] of L) { const c = v3(x, y + h - 0.12, z); S.plat.push(c); ev3Fija(c, [0.55, 0.12, 0.55]); }
      ev3Papel('ev3.p.torre', v3(-24.6, ev3Piso(-24.6, 19.0) + 0.02, 19.0), v3(0, 1, 0), { piso: true });
    }
    S.roof = ev3Piso(-10, 30, 6); S.pc = v3(-10, S.roof + 1.4, 30);
    if (!S.q) S.q = ev3Punto(S.pc, 0.5, T('ev3.campana'), () => { ev3Son('campana', 0, 1); S.toca = EV3.t; ev3MisHecha(M); }, { activo: () => !ev3Hecha('torre') });
    if (!S.malla || !R.mallas[S.malla]) { const L = []; for (const c of S.plat) { L.push([c, [1.1, 0.24, 1.1]]); L.push([vadd(c, v3(0, -(c.y - S.y) / 2 - 0.1, 0)), [0.12, Math.max(0.05, c.y - S.y - 0.1), 0.12]]); }
      L.push([vadd(S.pc, v3(0, 0.55, 0)), [1.2, 0.08, 0.08]], [vadd(S.pc, v3(-0.55, -0.3, 0)), [0.08, 1.7, 0.08]], [vadd(S.pc, v3(0.55, -0.3, 0)), [0.08, 1.7, 0.08]]); S.malla = ev3Malla(L); }
    S.dibujar = () => {
      ev3MallaDibujar(S.malla, S.mat);
      const sw = S.toca !== undefined ? Math.sin((EV3.t - S.toca) * 9) * Math.exp(-(EV3.t - S.toca) * 1.2) * 0.6 : 0, q = Quat.axis(0, 0, 1, sw);
      dibujarCaja(vadd(S.pc, q.rot(v3(0, 0.12, 0))), [0.36, 0.42, 0.36], q, S.matC);
    };
    M.reiniciar = () => {};
  },
  // ===== el orden de las muertes =====
  orden(M, hecha) {
    const S = EV3.mis.orden = EV3.mis.orden || {}; const [cx, cz] = M.centro, y = ev3Piso(cx, cz); S.y = y;
    // (en el orden del registro: 0.101 ADMIN, 0.388 13 PISOS, 0.612 PARED, 1.045 SEDÁN, 1.046 HELADERA, 1.047 BARRIL)
    S.matV = ev3Mat('velaApagada', [0.85, 0.82, 0.75]); S.matL = ev3Mat('velaLlama', [1, 0.7, 0.3], { em: [6, 3.5, 1] });
    if (!S.cosas) {
      S.cosas = [];
      const L = [['admin', 'PcMonitor', 160], ['13', 'Sign', 120], ['pared', 'WallSmall', 80], ['sedan', 'Sedan', 40], ['heladera', 'Heladera', 0], ['barril', 'BarrilExplosivo', -40]];
      L.forEach(([k, n, ang], i) => {
        const a = ang * Math.PI / 180, r = n === 'Sedan' ? 6.5 : 4.2, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r, yy = ev3Piso(x, z);
        const o = ev3Prop(n, v3(x, yy + 1, z), Quat.axis(0, 1, 0, a + Math.PI), { piso: yy }); const bb = o ? ev3Caja(o) : null;
        const vel = v3(cx + Math.sin(a) * (r - (n === 'Sedan' ? 2.6 : 0.9)), yy, cz + Math.cos(a) * (r - (n === 'Sedan' ? 2.6 : 0.9)));
        const top = bb ? Math.min(bb.max.y, yy + 1.6) : yy + 1;
        const q = ev3Punto(v3(x, (yy + top) / 2 + 0.3, z), n === 'Sedan' ? 1.4 : 0.7, () => T('ev3.tocar') + ' ' + T('ev3.o.' + k), () => ev3OrdenToca(S, M, i), { activo: () => !ev3Hecha('orden') });
        S.cosas.push({ k, o, vela: vel, q });
        if (k === '13') ev3Cartel(ev3Lienzo(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ddd'; g.font = "bold 150px Impact, sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('13', w / 2, h / 2); }, 'cut', false), v3(x, yy + 2.6, z), v3(-Math.sin(a), 0, -Math.cos(a)), 0.7, 0.7, { doble: true });
      });
    }
    S.ok = hecha ? 6 : 0;
    if (!S.mVelas || !R.mallas[S.mVelas]) S.mVelas = ev3Malla(S.cosas.map((c) => [vadd(c.vela, v3(0, 0.14, 0)), [0.07, 0.28, 0.07]]));
    S.dibujar = () => { ev3MallaDibujar(S.mVelas, S.matV); S.cosas.forEach((c, i) => { if (i < S.ok) dibujarCaja(vadd(c.vela, v3(0, 0.33 + 0.02 * Math.sin(EV3.t * 20 + i), 0)), [0.04, 0.08, 0.04], null, S.matL); }); };
    S.luces = (L) => { if (S.ok > 0) { const p = v3(cx, S.y + 1, cz), d = p.distTo(CAM.pos); if (d < 30) L.push({ p, r: 5 + S.ok, c: [2.6, 1.6, 0.6].map((x) => x * (0.85 + 0.15 * Math.random())), q: 3, d }); } };
    M.reiniciar = () => { S.ok = 0; };
  },
};
function ev3OrdenToca(S, M, i) {
  if (ev3Hecha('orden')) return;
  if (i === S.ok) { S.ok++; ev3Son('tono', 300 + S.ok * 70, 0.8); if (S.ok >= 6) { ev3Son('bien', 0, 1); ev3MisHecha(M); } }
  else { S.ok = 0; ev3Son('mal', 0, 0.9); ev3Voz('s3', 0.7, 0.8); }
}
// la pileta: la altura del agua y del fondo en x, z (null si ahí no hay agua)
function ev3Pileta(x, z) {
  if (typeof aguaEn !== 'function') return null;
  let sup = null; for (let y = -12; y <= 2; y += 0.05) { if (aguaEn(x, y, z, 0)) sup = y; else if (sup !== null) break; }
  if (sup === null) return null;
  const f = mundoRayo(v3(x, sup, z), v3(0, -1, 0), 30); return { sup, fondo: f ? sup - f.t : sup - 3 };
}
// ---------------- el teclado y la radio ----------------
function ev3TecladoAbrir(cb) {
  const U = ev3Ui(), P = U.tecla.querySelector('.ev3Pant'), K = U.tecla.querySelector('.ev3Teclas'); let c = '';
  const pintar = () => { P.textContent = (c + '----').slice(0, 4); };
  K.innerHTML = '';
  for (const t of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '◀', '0', 'OK']) {
    const b = document.createElement('button'); b.textContent = t;
    b.onclick = (e) => { e.stopPropagation();
      if (t === '◀') c = c.slice(0, -1); else if (t === 'OK') { if (cb(c)) { setTimeout(() => ev3PanelCerrar(), 500); P.classList.add('bien'); } else { P.classList.add('mal'); setTimeout(() => P.classList.remove('mal'), 500); c = ''; } }
      else if (c.length < 4) { c += t; ev3Son('tono', 900 + (+t) * 30, 0.5); }
      pintar(); };
    K.appendChild(b);
  }
  P.classList.remove('bien', 'mal'); pintar(); ev3PanelAbrir('tecla');
  EV3.teclado = { tecla: (t) => { const b = [...K.children].find((x) => x.textContent === t); if (b) b.onclick({ stopPropagation() {} }); } };
}
function ev3RadioAbrir(S, M) {
  const U = ev3Ui(), R0 = U.radio.querySelector('.ev3Perilla'), F = U.radio.querySelector('.ev3Frec');
  ev3PanelAbrir('radio'); ev3Bucle('radioEst', 'estatica', 0.25);
  const mover = () => {
    const f = +R0.value / 10; F.textContent = f.toFixed(1); const d = Math.abs(f - 104.7);
    ev3Bucle('radioEst', 'estatica', clamp(d / 2, 0.05, 0.3));
    if (d < 0.15 && !S.sonando && !ev3Hecha('radio')) { S.sonando = true; ev3Voz('r1', 1, 0.97); setTimeout(() => { S.sonando = false; if (Math.abs(+R0.value / 10 - 104.7) < 0.25 && !ev3Hecha('radio')) { ev3MisHecha(M); setTimeout(() => ev3PanelCerrar(), 600); } }, ((EV3_VOZ.dur.r1 || 3.8) + 0.3) * 1000); }
  };
  R0.oninput = mover; mover();
  EV3.radioPanel = { poner: (f) => { R0.value = String(Math.round(f * 10)); mover(); } };
}
function ev3RadioCerrar() { ev3BucleParar('radioEst'); }
// ---------------- el final: perdón, Pepe se da vuelta, el screamer y el reinicio ----------------
function ev3FinalEmpezar() {
  const C = EV3.cuarto; if (!C || !C.pepe) return;
  EV3.fase = 'final'; EV3.t = 0; EV3.fin = { t: 0, grito: false, cam: CAM.pos.clone() };
  document.body.classList.add('ev3Quieto'); JUG.bloqueado = true; JUG.vel.set(0, 0, 0); ev3PanelCerrar();
  if (typeof linternaAlternar === 'function') linternaAlternar(false);
  ev3Msj(T('ev3.perdonDijo'), 2.4); ev3Bucle('grave', 'grave', 0.4);
}
function ev3FinalPaso(dt) {
  const F = EV3.fin, pe = EV3.cuarto && EV3.cuarto.pepe; if (!F || !pe) return; F.t += dt; const t = F.t;
  // (Pepe se da vuelta despacio, deformándose; «¿Perdón?» con la voz grave; la luz titila; el screamer)
  if (t > 1.0 && !F.voz) { F.voz = true; ev3Voz('f1', 1.2, 0.92); }
  const k = clamp((t - 1.2) / 2.2, 0, 1); pe.yaw = Math.PI * (k * k * (3 - 2 * k)); ev3Deformar(pe, k); pe.vel.set(0, 0, 0); pe.suelo = true;
  if (t > 3.6 && !F.grito) {
    F.grito = true; EV3.fase = 'screamer'; ev3Son('grito', 0, 1.3); ev3Voz('f1', 1.4, 0.55);
    // (Pepe, de un salto, contra la cámara)
    const d = CAM.fwd; pe.pos.set(CAM.pos.x + d.x * 0.42, CAM.pos.y - 1.32, CAM.pos.z + d.z * 0.42); pe.yaw = Math.atan2(-d.x, -d.z); ev3Deformar(pe, 1); pe.escVis = 1.15;
  }
  if (F.grito) {
    // (la cara, en el medio de la pantalla y a medio metro: se corrige con la cabeza del cuadro anterior)
    const hc = ev3Hueso(pe, 'Head'); if (hc && isFinite(hc.x)) { const meta = vadd(CAM.pos, vscale(CAM.fwd, 0.5)); pe.pos.addS(vsub(meta, hc), 0.6); }
    if (pe.md) pe.md.tinte = null;
    const g = t - 3.6; VHS.sacudon = clamp(1 - g / 1.6, 0.3, 1); VHS.rojo = Math.floor(g * 12) % 3 === 0 ? 0.45 : 0; VHS.blanco = g < 0.07 ? 1 : 0; VHS.dano = 1;
    if (g > 1.5) { VHS.negro = 1; VHS.rojo = 0; VHS.blanco = 0; }
    if (g > 1.6 && !F.reinicio) {
      F.reinicio = true; EV3.est.fase = 'despues'; ev3Guardar(); ev3AudioParar();
      // «el juego se reinicia»: negro, el ruido de la cinta que sale, y de nuevo desde el principio (el menú de siempre)
      ev3Ui().negro.classList.remove('oc'); ev3Son('electrico', 0, 1);
      // (en las pruebas automáticas, sin recargar: al menú)
      setTimeout(() => { if (!(TEST || navigator.webdriver) || Q.has('ev300recarga')) location.reload(); else { ev3Terminar(); EV3.recargado = true; irMenuPrincipal(); } }, 1800);
    }
  }
}
function ev3FinalCamara(Cm) {
  const F = EV3.fin, pe = EV3.cuarto && EV3.cuarto.pepe; if (!F || !pe) return false;
  // (mirando a Pepe, quieto donde lo agarró)
  const h = ev3Hueso(pe, 'Head') || vadd(pe.pos, v3(0, 0.7, 0)), d = vsub(h, Cm.pos);
  if (!F.grito) { const my = Math.atan2(d.x, d.z), mp = -Math.atan2(d.y, Math.hypot(d.x, d.z)), k = Math.min(1, TIEMPO.dt * 3); let e = my - JUG.yaw; e = Math.atan2(Math.sin(e), Math.cos(e)); JUG.yaw += e * k; JUG.pitch += (mp - JUG.pitch) * k; }
  return false;
}
// ---------------- el epílogo: gm_construct de noche, sólo caminar, «ÉL VOLVERÁ» y se cierra ----------------
function ev3EpilogoArmar() {
  ev3Limpiar(); ev3Base(); EV3.hora0 = performance.now(); EV3.t = 0; EV3.epi = { t: 0 };
  document.body.classList.add('ev3SinLint'); document.body.classList.remove('ev3Quieto');
  if (typeof linternaAlternar === 'function') linternaAlternar(false);
  vhsTexto('I', 'PLAY ▶'); vhsTexto('D', ''); vhsTexto('AD', 'NOV. 20 1998'); VHS.dano = 0.5; VHS.negro = 1;
  ev3AudioPreparar(); ev3Bucle('cinta', 'cinta', 0.06); ev3Bucle('grave', 'grave', 0.25);
  const [x, z] = EV3_INICIO; JUG.pos.set(x, ev3Piso(x, z) + 1.0, z - 6); JUG.vel.set(0, 0, 0); JUG.yaw = 0; JUG.pitch = 0;
  // (Pepe, lejos, en el techo del 1.047: aparece un rato)
  const pe = crearPersona('Engineer', 'HatEmpty', { nombre: '' }); EV3.pers.push(pe); EV3.epi.pepe = pe;
  pe.pos.set(1.6, ev3Piso(1.6, 31, 6) + 0.96, 31); pe.yaw = Math.PI; pe.suelo = true; ev3Deformar(pe, 0.7); pe.ev3Oculto = true;
}
function ev3EpilogoPaso(dt) {
  const E = EV3.epi; if (!E) return; E.t += dt; const t = E.t;
  VHS.negro = t < 2.5 ? clamp(1 - (t - 0.5) / 2, 0, 1) : VHS.negro;
  if (E.pepe) { E.pepe.ev3Oculto = !(t > 12 && t < 16.5); if (E.pepe.md) E.pepe.md.tinte = EV3_NEGRO; E.pepe.vel.set(0, 0, 0); E.pepe.suelo = true; }
  if (t > 22 && !E.msj) { E.msj = true; vhsTexto('C', T('ev3.volvera')); ev3Voz('e1', 1, 0.9); VHS.dano = 0.8; }
  if (t > 26) VHS.negro = clamp((t - 26) / 1.5, 0, 1);
  if (t > 28 && !E.fin) {
    E.fin = true; EV3.est.fase = 'hecho'; ev3Guardar(); vhsTexto('C', '');
    // (se cierra el juego: en la app, de verdad; en la web, a negro y de nuevo al menú)
    const prueba = TEST || navigator.webdriver;
    if (window.JXNativo && JXNativo.salir && !prueba) { try { JXNativo.salir(); return; } catch (e) {} }
    ev3Ui().negro.classList.remove('oc');
    setTimeout(() => { if (!prueba) location.reload(); else { ev3Terminar(); irMenuPrincipal(); } }, 1500);
  }
}
function ev3EpilogoLuces() {
  if (!EV3.epi) return; const C = v3(EV3_PUERTA.x, ev3Piso(1.6, 22) + 3.3, EV3_PUERTA.z - 1.2);
  luzEspecial(C, 7, [2.4, 0.22, 0.18], null, -2, 5);
}
