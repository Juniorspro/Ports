// ---------------------------------------------------------------------------------------------------------
// Pill Packs (como el addon pk_pills de GMod, de Parakeet; idea de Henderson en el Discord): una pestaña del menú de
// spawn con personajes para TRANSFORMARSE. Elegir uno es pasar a ser ese personaje: su modelo y sus animaciones, la
// cámara en tercera persona (V: primera), su velocidad, su salto, su tamaño (el choque y la altura de los ojos) y su
// vida; una barra de poder con sus habilidades (los animatrónicos: zarpazo, susto con grito, carrera y una propia: la
// cajita musical de Freddy, el teletransporte de Bonnie, Chica que come y la embestida de Foxy) y un nivel que sube con
// lo que hacés (se guarda por personaje). Volver a tu personaje: H, el botón de arriba a la derecha o el menú.
// En una sala los demás te ven como el personaje (el skin va en el estado, red.js) y ven lo que hacés: cada habilidad
// es un hecho 'pill' con lo que hace falta para verla y oírla (el susto, si te agarra cerca, te asusta a vos también).
// Controles: clic = habilidad 1, clic derecho = 2, Shift = 3 (mantener), R = 4; en el celular, botones en el lugar del
// disparo, el secundario, la patada y recargar (los mismos que se mueven en Controles). Los Pill Packs del Workshop
// (los addons de pk_pills): pill_gmod.js.
// ---------------------------------------------------------------------------------------------------------
const PILL = { on: false, id: null, def: null, pod: 100, cd: [0, 0, 0, 0], ant: [false, false, false, false], carrera: false, raizT: 0, guard: null,
  xp: null, xpT: 0, sinRegen: 0, golpe: null, emb: null, distXp: 0, carXp: 0, pasoD: 0, npcMod: new Set(), fx: [], hud: null, ver3: true,
  defs: new Map(), gm: new Map(), sustoT: 0, sustoDe: null, hudK: '', aviT: 0 };
const _pillElegirArma0 = elegirArma;   // (la de siempre: transformado no se cambia de arma, ver abajo)
const PILL_QUIETO = { x: 0, y: 0, saltar: false, agachar: false, correr: false };
const PILL_NIV_MAX = 10;
// ---------------- las habilidades ----------------
// cada una: t (tipo), costo (de poder), cd (espera en segundos) y lo suyo. Las de mantener (carrera) gastan por segundo
const hGolpe = (dan, o) => Object.assign({ t: 'golpe', dan, alc: 1.9, cd: 0.8, costo: 0, clip: 'gm_range_melee', imp: 0.2 }, o);
const hSusto = (o) => Object.assign({ t: 'susto', costo: 35, cd: 6, radio: 10, son: 'fn_grito' }, o);
const hCarrera = (mult, o) => Object.assign({ t: 'carrera', mult, gasto: 18, man: true }, o);
const PILL_FNAF = { cat: 'fnaf', poder: 'fnaf', pasos: ['fn_paso1', 'fn_paso2', 'fn_paso3'], cam: 3.9, paq: 'a_pill', metal: true };
const PILL_TERROR = { cat: 'terror', poder: 'miedo', cam: 3.6 };
const PILL_DBZ = { cat: 'accion', poder: 'ki', cam: 3.4 };
// el plantel propio: los personajes del juego (sus animaciones, con su tamaño) con lo que los hace distintos
const PILL_PROPIOS = [
  Object.assign({ id: 'freddy', skin: 'Freddy', nom: 'Freddy Fazbear', vida: 260, vel: 4.3, salto: 0.75,
    hab: [hGolpe(30), hSusto({ cola: 'fn_risa' }), hCarrera(1.55), { t: 'cajita', costo: 50, cd: 20, radio: 14, dur: 9, son: 'fn_cajita' }] }, PILL_FNAF),
  Object.assign({ id: 'bonnie', skin: 'Bonnie', nom: 'Bonnie', vida: 220, vel: 4.6, salto: 0.85,
    hab: [hGolpe(26, { clip: 'Attack04', imp: 0.24 }), hSusto(), hCarrera(1.6), { t: 'tele', costo: 40, cd: 7, alc: 14, son: 'fn_estatica' }] }, PILL_FNAF),
  Object.assign({ id: 'chica', skin: 'Chica', nom: 'Chica', vida: 220, vel: 4.5, salto: 0.85,
    hab: [hGolpe(26), hSusto(), hCarrera(1.55), { t: 'curar', costo: 40, cd: 14, cura: 70, son: 'fn_ollas' }] }, PILL_FNAF),
  Object.assign({ id: 'foxy', skin: 'Foxy', nom: 'Foxy', vida: 190, vel: 5.1, salto: 1.0,
    hab: [hGolpe(22, { cd: 0.6, clip: 'Attack04', imp: 0.22 }), hSusto(), hCarrera(1.95, { gasto: 22, son: 'fn_foxycorre' }), { t: 'embestida', costo: 30, cd: 4.5, dan: 40, vel: 15, son: 'fn_foxycorre' }] }, PILL_FNAF),
  // terror
  Object.assign({ id: 'zombi', skin: 'Zombi', nom: 'Zombi', vida: 240, vel: 3.1, salto: 0.7, hab: [hGolpe(32, { cd: 1, clip: 'Attack04' }), hSusto({ son: 'VZ_z_muere1', radio: 9 }), hCarrera(1.7)] }, PILL_TERROR),
  Object.assign({ id: 'boiled', skin: 'BoiledOne', nom: 'The Boiled One', vida: 420, vel: 3.4, salto: 0.6, cam: 4.6, hab: [hGolpe(40, { cd: 1.1, alc: 2.6 }), hSusto({ son: 'VZ_z_muere3', radio: 14 }), hCarrera(1.6), { t: 'tele', costo: 45, cd: 9, alc: 18, son: 'VZ_z_dolor4' }] }, PILL_TERROR),
  Object.assign({ id: 'sunman', skin: 'Sunman', nom: 'Sunman', vida: 320, vel: 4.0, salto: 0.9, cam: 4.3, hab: [hGolpe(34, { alc: 2.3 }), hSusto({ son: 'VZ_z_muere2', radio: 12 }), hCarrera(1.6)] }, PILL_TERROR),
  Object.assign({ id: 'bon', skin: 'Bon', nom: 'Bon', vida: 260, vel: 4.2, salto: 0.8, cam: 4, hab: [hGolpe(30), hSusto({ son: 'VZ_r_muere1' }), hCarrera(1.55), { t: 'tele', costo: 40, cd: 8, alc: 14, son: 'VZ_r_dolor1' }] }, PILL_TERROR),
  Object.assign({ id: 'sha', skin: 'Sha', nom: 'Sha', vida: 220, vel: 4.4, salto: 0.9, hab: [hGolpe(26), hSusto({ son: 'VZ_r_muere1' }), hCarrera(1.55)] }, PILL_TERROR),
  Object.assign({ id: 'partygoer', skin: 'Partygoer', nom: 'Partygoer', vida: 220, vel: 4.6, salto: 1.0, hab: [hGolpe(28), hSusto({ son: 'VZ_z_muere1' }), hCarrera(1.8), { t: 'tele', costo: 40, cd: 8, alc: 14, son: 'VZ_z_dolor2' }] }, PILL_TERROR),
  Object.assign({ id: 'bacteria', skin: 'Bacteria', nom: 'Bacteria', vida: 300, vel: 4.8, salto: 1.0, cam: 4.2, hab: [hGolpe(36, { alc: 2.3 }), hSusto({ son: 'VZ_z_muere2', radio: 12 }), hCarrera(2.1, { gasto: 24 }), { t: 'embestida', costo: 30, cd: 5, dan: 45, vel: 16, son: 'VZ_z_dolor5' }] }, PILL_TERROR),
  Object.assign({ id: 'alternate', skin: 'Alternate', nom: 'Alternate', vida: 200, vel: 4.2, salto: 0.9, hab: [hGolpe(24), hSusto({ son: 'VZ_z_muere3' }), hCarrera(1.5), { t: 'tele', costo: 40, cd: 8, alc: 12, son: 'VZ_z_dolor3' }] }, PILL_TERROR),
  Object.assign({ id: 'filbus', skin: 'Filbus', nom: 'Filbus', vida: 210, vel: 4.4, salto: 1.0, hab: [hGolpe(26), hSusto({ son: 'VZ_z_muere1' }), hCarrera(1.6)] }, PILL_TERROR),
  // acción
  Object.assign({ id: 'goku', skin: 'Goku', nom: 'Goku', vida: 260, vel: 6.4, salto: 2.4, hab: [hGolpe(28, { cd: 0.45, clip: 'Attack04', imp: 0.2 }), { t: 'rafaga', costo: 25, cd: 1.2, dan: 45, radio: 2.6 }, hCarrera(1.6, { gasto: 14 }), { t: 'salto', costo: 25, cd: 2, alto: 9 }] }, PILL_DBZ),
  Object.assign({ id: 'vegeta', skin: 'Vegeta', nom: 'Vegeta', vida: 250, vel: 6.4, salto: 2.4, hab: [hGolpe(30, { cd: 0.45, clip: 'Attack04', imp: 0.2 }), { t: 'rafaga', costo: 25, cd: 1.2, dan: 48, radio: 2.6 }, hCarrera(1.6, { gasto: 14 }), { t: 'salto', costo: 25, cd: 2, alto: 9 }] }, PILL_DBZ),
  Object.assign({ id: 'broly', skin: 'Broly', nom: 'Broly', vida: 420, vel: 5.6, salto: 2.0, cam: 3.9, hab: [hGolpe(42, { cd: 0.7, alc: 2.2 }), { t: 'rafaga', costo: 35, cd: 2, dan: 70, radio: 4 }, hCarrera(1.5), { t: 'embestida', costo: 30, cd: 4, dan: 50, vel: 17, son: 'GG_Launch3' }] }, PILL_DBZ),
  Object.assign({ id: 'gohan', skin: 'Gohan', nom: 'Gohan', vida: 230, vel: 6.2, salto: 2.3, hab: [hGolpe(26, { cd: 0.45, clip: 'Attack04', imp: 0.2 }), { t: 'rafaga', costo: 25, cd: 1.2, dan: 44, radio: 2.6 }, hCarrera(1.6, { gasto: 14 }), { t: 'salto', costo: 25, cd: 2, alto: 9 }] }, PILL_DBZ),
  Object.assign({ id: 'piccolo', skin: 'Piccolo', nom: 'Piccolo', vida: 260, vel: 5.8, salto: 2.2, hab: [hGolpe(28, { cd: 0.5 }), { t: 'rafaga', costo: 25, cd: 1.4, dan: 46, radio: 2.6 }, hCarrera(1.55), { t: 'curar', costo: 50, cd: 16, cura: 60, son: 'GG_Pickup' }] }, PILL_DBZ),
  Object.assign({ id: 'ninja', skin: 'Ninja', nom: 'Ninja', vida: 170, vel: 7.0, salto: 2.0, cat: 'accion', poder: 'energia', cam: 3.4, hab: [hGolpe(24, { cd: 0.4, clip: '1HandSwordBackswing', imp: 0.18 }), { t: 'embestida', costo: 25, cd: 3, dan: 34, vel: 18, son: 'Arm_Swing_edited' }, hCarrera(1.5, { gasto: 12 }), { t: 'salto', costo: 20, cd: 1.6, alto: 7 }] }),
  Object.assign({ id: 'robot', skin: 'Robot', nom: 'Robot', vida: 340, vel: 4.6, salto: 1.0, cat: 'accion', poder: 'energia', cam: 3.6, metal: true, hab: [hGolpe(32, { cd: 0.8 }), { t: 'rafaga', costo: 25, cd: 1.6, dan: 40, radio: 2.2, laser: true }, hCarrera(1.6), { t: 'curar', costo: 50, cd: 16, cura: 80, son: 'UI_interruptor' }] }),
  Object.assign({ id: 'v1', skin: 'V1', nom: 'V1', vida: 180, vel: 7.2, salto: 2.0, cat: 'accion', poder: 'energia', cam: 3.4, metal: true, hab: [hGolpe(28, { cd: 0.4, clip: 'Attack04', imp: 0.18 }), { t: 'rafaga', costo: 20, cd: 0.9, dan: 34, radio: 2, laser: true }, hCarrera(1.5, { gasto: 12 }), { t: 'embestida', costo: 20, cd: 2, dan: 30, vel: 20, son: 'GG_Launch1' }] }),
  // más personajes
  Object.assign({ id: 'jake', skin: 'Jake', nom: 'Jake', vida: 150, vel: 4.6, salto: 1.6, cat: 'mas', poder: 'energia', hab: [hGolpe(18, { alc: 1.2 }), hSusto({ son: 'VZ_h_hola1', costo: 20, radio: 6 }), hCarrera(1.6), { t: 'salto', costo: 20, cd: 1.6, alto: 6 }] }),
  Object.assign({ id: 'finn', skin: 'Finn', nom: 'Finn', vida: 160, vel: 5.4, salto: 1.5, cat: 'mas', poder: 'energia', hab: [hGolpe(24, { cd: 0.5, clip: '1HandSwordBackswing', imp: 0.18 }), hSusto({ son: 'VZ_h_hola2', costo: 20, radio: 6 }), hCarrera(1.6), { t: 'salto', costo: 20, cd: 1.6, alto: 6 }] }),
  Object.assign({ id: 'astronauta', skin: 'Astronauta', nom: 'Astronauta', vida: 200, vel: 4.6, salto: 2.6, cat: 'mas', poder: 'energia', hab: [hGolpe(20), hCarrera(1.5), null, { t: 'salto', costo: 20, cd: 1.5, alto: 10 }] }),
  Object.assign({ id: 'pirata', skin: 'Pirata', nom: 'Pirata', vida: 200, vel: 5.2, salto: 1.1, cat: 'mas', poder: 'energia', hab: [hGolpe(28, { cd: 0.55, clip: '1HandSwordBackswing', imp: 0.18 }), hSusto({ son: 'VZ_h_no1', costo: 20, radio: 7 }), hCarrera(1.5), { t: 'embestida', costo: 25, cd: 4, dan: 30, vel: 14, son: 'Arm_Swing_edited' }] }),
  Object.assign({ id: 'rick', skin: 'Rick', nom: 'Rick', vida: 180, vel: 5.4, salto: 1.1, cat: 'mas', poder: 'energia', hab: [hGolpe(18), { t: 'rafaga', costo: 25, cd: 1.4, dan: 36, radio: 2.2, laser: true }, hCarrera(1.5), { t: 'tele', costo: 35, cd: 5, alc: 20, son: 'GG_Launch4' }] }),
];
const PILL_CATS = ['fnaf', 'terror', 'accion', 'mas'];
for (const d of PILL_PROPIOS) PILL.defs.set(d.id, d);
// un Pill por id (los propios y los de los addons: 'gm:<nombre>', pill_gmod.js)
function pillDef(id) { return PILL.defs.get(id) || (typeof pillGmDef === 'function' ? pillGmDef(id) : null) || null; }
const pillSkinDisp = (D) => !D || !D.skin || (typeof gmpEs === 'function' && gmpEs(D.skin)) || (DATA.chars || []).includes(D.skin);
// ---------------- el nivel (se guarda en el aparato, por personaje) ----------------
const pillXpDe = (n) => 50 * (n - 1) * n;   // (lo que hace falta juntado para el nivel n: 100 el 2, 300 el 3, 4500 el 10)
function pillXpLeer() { if (PILL.xp) return PILL.xp; try { PILL.xp = JSON.parse(localStorage.getItem('jx_pills_xp') || '{}') || {}; } catch (e) { PILL.xp = {}; } return PILL.xp; }
function pillXpGuardar() { try { localStorage.setItem('jx_pills_xp', JSON.stringify(pillXpLeer())); } catch (e) {} PILL.xpT = 0; }
function pillNivelDe(id) { const x = +pillXpLeer()[id] || 0; let n = 1; while (n < PILL_NIV_MAX && x >= pillXpDe(n + 1)) n++; return n; }
const pillNivel = () => (PILL.on ? pillNivelDe(PILL.id) : 1);
const pillK = () => 1 + 0.06 * (pillNivel() - 1);   // (el daño y la cura: +6 % por nivel)
const pillPodMax = () => 100 + 10 * (pillNivel() - 1);
const pillVidaMax = () => Math.round((PILL.def ? PILL.def.vida : 100) * (1 + 0.04 * (pillNivel() - 1)));
function pillXp(n) {
  if (!PILL.on || !(n > 0)) return;
  const id = PILL.id, X = pillXpLeer(), antes = pillNivelDe(id); X[id] = (+X[id] || 0) + n; PILL.xpT += n;
  const ahora = pillNivelDe(id);
  if (ahora > antes) {
    // (sube: más vida máxima y más poder; se llena lo que creció)
    const vm = pillVidaMax(); JUG.vida = Math.min(vm, JUG.vida + (vm - JUG.vidaMax)); JUG.vidaMax = vm; PILL.pod = Math.min(pillPodMax(), PILL.pod + 10);
    aviso(T('pill.nivel').replace('{n}', ahora), 2.5); pillSonTonos([523, 659, 784, 1047], 0.09, 0.22);
    for (let i = 0; i < 18; i++) particula(vadd(JUG.pos, v3((Math.random() - 0.5) * 1.2, -0.6 + Math.random() * 2, (Math.random() - 0.5) * 1.2)), v3(0, 1.5 + Math.random(), 0), 0.9, 0.08, [1, 0.85, 0.3, 1], 'chispa', 0.2);
    pillPublicar({ h: 'nivel', n: ahora }); pillXpGuardar(); redSubir();
  } else if (PILL.xpT >= 40) pillXpGuardar();
}
// ---------------- transformarse y volver ----------------
// el tamaño del personaje para el choque, los ojos y la cámara (jugador.js jugadorTam): el de los addons sale de la cabeza
// del modelo respecto de la del Hero (los animatrónicos miden un 11 % más: los ojos a 1,85 m en vez de 1,67)
const _pillTam = new Map();
function pillTamAuto(skin) {
  if (_pillTam.has(skin)) return _pillTam.get(skin);
  let t = tamSkin(skin);
  if (!(DATA.tam && DATA.tam[skin]) && !(typeof gmpEs === 'function' && gmpEs(skin))) {
    try { const D = datosSkin(skin), H = datosSkin('Hero'), a = D.h.Head !== undefined && D.rp[D.h.Head].y, b = H.h.Head !== undefined && H.rp[H.h.Head].y; if (a > 0 && b > 0) { const k = a / b; if (Math.abs(k - 1) > 0.04) t = { k: clamp(k, 0.4, 1.6), ojo: 1, flota: t.flota }; } } catch (e) {}
  }
  _pillTam.set(skin, t); return t;
}
// (personas.js: el cuerpo del jugador transformado; red.js: lo que ven los demás)
function pillSkin() { return PILL.on && PILL.def && JUG.vivo ? PILL.def.skin : null; }
function pillTam() { if (!PILL.on || !PILL.def) return null; const D = PILL.def, t = pillTamAuto(D.skin); return D.tam ? { k: D.tam, ojo: D.ojo || 1 } : t; }
function pillAplicar(id) {
  const D = pillDef(id); if (!D) return false;
  if (JUEGO.estado !== 'juego') return false;
  if (!JUG.vivo) { aviso(T('pill.muerto'), 2); return false; }
  if (JUG.vehiculo) { aviso(T('pill.vehiculo'), 2.5); return false; }
  if (typeof reglaSala === 'function' && typeof NOC !== 'undefined' && NOC.on && ['intro', 'juega', 'apagon', 'perdiendo'].includes(NOC.estado)) { aviso(T('fn.sinCosas'), 2); return false; }   // (la noche de la pizzería: nada de transformarse)
  if (PILL.on && PILL.id === id) { aviso(T('pill.ahora').replace('{n}', D.nom), 1.5); return true; }
  if (D.gm) {
    if (typeof censPermite === 'function' && !censPermite(D.skin)) return false;   // (en un server oficial, nada de un mod censurado)
    if (typeof gmModeloEsperar === 'function' && gmModeloEsperar(D.skin, () => { if (JUEGO.estado === 'juego') pillAplicar(id); })) { aviso(T('pill.bajando'), 2); return true; }   // (su geometría se lee del disco)
  }
  // (el personaje y sus sonidos en paquetes aparte: se bajan y recién ahí se transforma)
  const falta = [];
  if (D.skin && !(typeof gmpEs === 'function' && gmpEs(D.skin)) && !rbListo(rbDeSkin(D.skin))) falta.push(rbDeSkin(D.skin));
  if (D.paq && DATA.rbp && DATA.rbp[D.paq] && !rbListo(D.paq)) falta.push(D.paq);
  if (falta.length) {
    if (PILL.bajando === id) return true; PILL.bajando = id; aviso(T('pill.bajando'), 3);
    rbAsegurarTodos(falta).then((ok) => { PILL.bajando = null; if (!ok) { aviso(T('errRed'), 2.5); return; } if (JUEGO.estado === 'juego') pillAplicar(id); });
    return true;
  }
  if (!PILL.on) PILL.guard = { vel_max: JUG.vel_max, salto: JUG.salto, vida: JUG.vida, vidaMax: JUG.vidaMax, tercera: JUG.tercera, arma: ARM.lista[ARM.i], manos: ARM.lista.includes('Hands') };
  const desde = JUG.pos.clone();
  PILL.on = true; PILL.id = id; PILL.def = D; PILL.cd = [0, 0, 0, 0]; PILL.ant = [true, true, true, true]; PILL.carrera = false; PILL.raizT = 0; PILL.golpe = null; PILL.emb = null; PILL.sinRegen = 0; PILL.pasoD = 0;
  PILL.pod = pillPodMax(); JUG.vidaMax = pillVidaMax(); JUG.vida = JUG.vidaMax;
  // (sin armas: las manos, que no se dibujan en primera persona ni pesan en la postura)
  if (!ARM.lista.includes('Hands')) ARM.lista.push('Hands');
  _pillElegirArma0(ARM.lista.indexOf('Hands')); ARM.barraT = Math.min(ARM.barraT || 0, 0.001);   // (sin la barra de armas: no hay armas)
  JUG.tercera = PILL.ver3; JUG.noclip = false;
  pillStats(); jugadorCuerpoNuevo();
  pillPuf(desde, D); pillSonTonos([392, 523, 784], 0.07, 0.18);
  aviso(T('pill.ahora').replace('{n}', D.nom), 2);
  document.body.classList.add('pillOn'); pillHudArmar(); pillHudUbicar(); pillHudBotones();
  pillPublicar({ h: 'ent' }); redSubir();
  if (typeof modapiEvento === 'function') try { modapiEvento('pill', { id, nom: D.nom }); } catch (e) {}
  return true;
}
// lo del jugador vuelve a ser lo de antes (velocidad, salto, vida máxima, cámara y armas)
function pillSoltar(callado) {
  const G = PILL.guard || {};
  PILL.on = false; PILL.id = null; PILL.def = null; PILL.carrera = false; PILL.golpe = null; PILL.emb = null; PILL.raizT = 0; PILL.guard = null;
  pillXpGuardar(); document.body.classList.remove('pillOn'); pillHudVer(false);
  JUG.vel_max = G.vel_max || 6; JUG.salto = G.salto || 1.1; JUG.vidaMax = G.vidaMax || 0;
  PILL.ver3 = JUG.tercera; JUG.tercera = !!G.tercera;
  if (G.manos === false) { const i = ARM.lista.indexOf('Hands'); if (i >= 0 && ARM.lista.length > 1) ARM.lista.splice(i, 1); }
  if (!callado) { const i = ARM.lista.indexOf(G.arma); _pillElegirArma0(i >= 0 ? i : ARM.lista.length - 1); }   // (al cambiar de mapa las armas se arman de nuevo)
  return G;
}
// volver al personaje de siempre (callado: al cambiar de mapa o salir al menú, que rehacen todo)
function pillFin(callado) {
  if (!PILL.on) return;
  const desde = JUG.pos.clone(), D = PILL.def, G = pillSoltar(callado);
  if (callado) return;
  if (JUG.vivo) JUG.vida = Math.min(G.vida || 100, JUG.vidaMax || 100);
  if (JUG.vivo && JUG.cuerpo && !JUG.cuerpo.rag) { jugadorCuerpoNuevo(); pillPuf(desde, D); pillSonTonos([784, 523, 392], 0.07, 0.18); aviso(T('pill.volviste'), 1.5); }
  pillPublicar({ h: 'sal', id: D ? D.id : 0 }); redSubir();
}
// (personas.js, al armar el cuerpo del jugador transformado)
function pillCuerpo(P) { if (!P || !PILL.def) return; P.pill = PILL.def; if (typeof PILL.def.alCuerpo === 'function') { try { PILL.def.alCuerpo(P); } catch (e) {} } }
// la velocidad y el salto del personaje (con los mods de la partida: velocidad y supersalto siguen valiendo)
function pillStats() {
  const D = PILL.def; if (!D) return;
  const mv = (typeof MODS !== 'undefined' && MODS.velocidad) || 1, ms = (typeof MODS !== 'undefined' && MODS.salto) || 1, h2 = PILL.carrera && D.hab[2];
  JUG.vel_max = D.vel * mv * (h2 ? h2.mult / (ENT.correr ? 1.35 : 1) : D.sinCorrer && ENT.correr ? 1 / 1.35 : 1);   // (correr multiplica por 1,35 en jugador.js)
  JUG.salto = D.salto * ms;
}
// ---------------- cada cuadro ----------------
function pillPaso(dt) {
  pillNpcPaso(); pillFxPaso(dt); pillRemotosPaso(dt); if (typeof pillGmPaso === 'function') pillGmPaso();
  if (PILL.sustoT > 0) pillSustoVista(dt);
  if (!PILL.on) return;
  const D = PILL.def, P = JUG.cuerpo;
  // (muerto como personaje: el muñeco es el del personaje; al reaparecer, el de siempre)
  if (!JUG.vivo) {
    pillSoltar(); redSubir(); return;
  }
  for (let i = 0; i < 4; i++) if (PILL.cd[i] > 0) PILL.cd[i] = Math.max(0, PILL.cd[i] - dt);
  if (PILL.raizT > 0) PILL.raizT -= dt;
  // lo que se aprieta (con un menú abierto, nada)
  const libre = !UI.abierto && !JUG.vehiculo && !(typeof CLIB !== 'undefined' && CLIB.modo) && !NAT.rag && !NAT.scp && !(P && P.rag);
  const ap = [
    libre && !!(ENT.pillA0 || ENT.disparo),
    libre && !!(ENT.pillA1 || ENT.disparo2),
    libre && !!(ENT.pillA2 || (!ENT.tactil && ENT.correr)),
    libre && !!(ENT.pillA3 || ENT.teclas.has('KeyR')),
  ];
  for (let i = 0; i < 4; i++) {
    const h = D.hab[i]; if (!h) { PILL.ant[i] = ap[i]; continue; }
    if (h.man) { if (i === 2) pillCarrera(h, ap[i], dt); }
    else if (ap[i] && (!PILL.ant[i] || h.t === 'golpe' || h.t === 'disparo')) pillUsar(i);
    PILL.ant[i] = ap[i];
  }
  // el poder vuelve solo (más rápido con el nivel), un rato después de gastarlo
  if (PILL.sinRegen > 0) PILL.sinRegen -= dt;
  else if (!PILL.carrera) PILL.pod = Math.min(pillPodMax(), PILL.pod + 9 * (1 + 0.05 * (pillNivel() - 1)) * dt);
  pillStats();
  // el golpe pega en su momento; la embestida lastima a lo que toca mientras dura
  if (PILL.golpe && (PILL.golpe.t -= dt) <= 0) { const g = PILL.golpe; PILL.golpe = null; pillGolpeAplicar(g.h); }
  if (PILL.emb) { PILL.emb.t -= dt; pillEmbestidaPaso(PILL.emb); if (PILL.emb.t <= 0) PILL.emb = null; }
  // pasos de metal (los animatrónicos) y lo que da experiencia andar
  const sp = Math.hypot(JUG.vel.x, JUG.vel.z);
  if ((D.pasos || (D.pasosGm && D.pasosGm.length)) && JUG.suelo && sp > 0.5 && P) { PILL.pasoD += sp * dt; const L = (1.0 + 0.12 * Math.max(0, sp - 2)) * (P.tam || 1); if (PILL.pasoD >= L) { PILL.pasoD -= L; pillPasoSon(D, null, clamp(sp / 9, 0.18, 0.45)); } }
  if (JUG.suelo && sp > 0.5) { PILL.distXp += sp * dt; if (PILL.distXp >= 30) { PILL.distXp -= 30; pillXp(1); } }
  if (PILL.xpT > 0 && (PILL.aviT += dt) > 20) { PILL.aviT = 0; pillXpGuardar(); }
  pillHudPaso(dt);
}
// un paso del personaje (los de metal de los animatrónicos; los del pack, en los de un addon)
function pillPasoSon(D, pos, vol) { if (D.pasos) sonar(azarDe(D.pasos), pos, vol, 0.92 + Math.random() * 0.12); else if (D.pasosGm && D.pasosGm.length && typeof pillGmSonar === 'function') pillGmSonar(azarDe(D.pasosGm), pos, vol); }
// carrera (mantener): más rápido mientras haya poder; sin poder, el correr de siempre
function pillCarrera(h, ap, dt) {
  const mueve = Math.abs(ENT.x) + Math.abs(ENT.y) > 0.1 && JUG.suelo;
  const si = ap && PILL.pod > 0.5 && (mueve || PILL.carrera);
  if (si && !PILL.carrera) { if (PILL.pod < 8) { PILL.ant[2] = true; return; } if (h.son) { sonar(h.son, null, 0.65); pillPublicar({ h: 'son', s: h.son }); } }
  if (si !== PILL.carrera) { PILL.carrera = si; redSubir(); }
  if (si && mueve) { PILL.pod = Math.max(0, PILL.pod - h.gasto * dt); PILL.sinRegen = 0.6; if ((PILL.carXp += dt) >= 2) { PILL.carXp -= 2; pillXp(1); } }
  if (PILL.pod <= 0.5 && PILL.carrera) { PILL.carrera = false; redSubir(); }
}
// una habilidad de un toque: si hay poder y ya pasó la espera
function pillUsar(i) {
  const D = PILL.def, h = D && D.hab[i]; if (!h || !JUG.cuerpo || JUG.cuerpo.rag) return;
  if (PILL.cd[i] > 0 || h.rota) return;
  if (PILL.pod + 1e-6 < (h.costo || 0)) { if (!PILL.ant[i]) { aviso(T('pill.sinPoder'), 1); sonar('UI_niega', null, 0.4); } return; }
  const r = pillHab(h, i);
  if (r === false) return;   // (no se pudo: sin gastar)
  PILL.pod -= h.costo || 0; if (h.costo) PILL.sinRegen = 0.8; PILL.cd[i] = h.cd || 0.5;
}
function pillHab(h, i) {
  switch (h.t) {
    case 'golpe': return pillGolpe(h);
    case 'susto': return pillSusto(h);
    case 'cajita': return pillCajita(h);
    case 'tele': return pillTele(h);
    case 'curar': return pillCurar(h);
    case 'embestida': return pillEmbestida(h);
    case 'salto': return pillSalto(h);
    case 'rafaga': return pillRafaga(h);
    case 'disparo': return pillDisparo(h);
    case 'lua': return typeof pillGmLua === 'function' ? pillGmLua(h, i) : false;
  }
  return false;
}
// ---------------- las habilidades ----------------
const pillAdelante = () => v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw));
const pillYo = () => (typeof RED !== 'undefined' && RED.ID) || 'yo';
// un gesto de la parte de arriba del cuerpo (las piernas siguen), como los de las armas
function pillAccion(P, n, dur) {
  if (!P || !P.hum || !DATA.hu || !n) return;
  const c = humClipNombre('Shooting', n) || humClipNombre('Blend Tree', n) || humClipNombre('Hit', n); if (!c) return;
  if (P.accion) P.hum.clave = '';
  P.accion = { c, t: 0, dur: Math.min(c.d, dur || 0.75), peso: 1, tipo: 'tiro' };
}
function pillGolpe(h) {
  const P = JUG.cuerpo, D = PILL.def;
  // (un Pill de un addon: la animación y el sonido de su pack, si los trae)
  const gm = !!(h.gm && D.gm && typeof pgmAnim === 'function'), an = gm && (pgmAnim(P, D, h.animN > 1 ? 'melee' + (1 + ((Math.random() * h.animN) | 0)) : 'melee') || pgmAnim(P, D, 'melee1'));
  if (!an) pillAccion(P, h.clip, h.dur || 0.7);
  const s = gm && h.sonGm && h.sonGm.length ? azarDe(h.sonGm) : null;
  if (s) pillGmSonar(s, null, 0.8); else sonar('CB_Swing', null, 0.5, (D.metal ? 0.78 : 0.9) + Math.random() * 0.1);
  PILL.golpe = { t: h.imp || 0.2, h };
  pillPublicar({ h: 'golpe', c: h.clip, s: s ? s.slice(0, 120) : 0, a: an ? 1 : 0 });
}
function pillGolpeAplicar(h) {
  const P = JUG.cuerpo; if (!P || !JUG.vivo) return;
  const f = pillAdelante(), tk = P.tam || 1, c = vadd(JUG.pos, v3(f.x * 0.85 * tk, -0.95 + 1.05 * tk, f.z * 0.85 * tk)), R = h.alc * Math.max(0.8, Math.min(1.3, tk));
  const dan = Math.round(h.dan * pillK()); let pego = null, xp = 0;
  for (const Q of PERS) {
    if (Q === P || Q.visible === false) continue;
    const q = v3(Q.pos.x, Q.pos.y - 0.95 + 0.9 * (Q.tam || 1), Q.pos.z), d = vsub(q, JUG.pos); d.y = 0;
    if (q.distTo(c) > R + 0.4 * (Q.tam || 1) || vdot(d, f) < -0.2 || Math.abs(q.y - c.y) > 1.6 * Math.max(1, tk)) continue;
    if (Q.rag) { for (const [, e] of Q.rag.cuerpos) { e.b.wake(); e.b.vel.addS(f, 7); e.b.vel.y += 2.5; } pego = pego || { p: q, carne: true }; continue; }
    const vivia = Q.vivo !== false;
    danarPersona(Q, dan, q, f.clone());
    if (Q.npc && vivia && Q.vivo !== false && dan >= 30 && typeof npcTumbar === 'function') npcTumbar(Q, v3(f.x * 6, 2.5, f.z * 6), 0);
    xp += 8; if (Q.npc && vivia && Q.vivo === false) xp += 25;
    pego = { p: q, carne: true };
  }
  for (const o of OBJS) {
    const b = o.b; if (!b || b.noPhys || b.dead || (b.frozen && !o.remoto)) continue;
    if (b.pos.distTo(c) > R + (b.shape.r || 0.5)) continue;
    const d = vsub(b.pos, JUG.pos); d.y = 0; if (vdot(d, f) < 0) continue;
    if (o.remoto) redReclamar(o);
    const dv = Math.min(11, 900 / Math.max(b.mass, 1)) * pillK();
    b.wake(); b.vel.addS(f, dv); b.vel.y += dv * 0.3; b.ang.addS(vcross(v3(0, 1, 0), f), dv * 0.4);
    danarObjeto(o, dan, b.pos, f); xp += 2;
    pego = pego || { p: b.pos.clone(), carne: false };
  }
  if (pego) {
    const L = pego.carne ? ['CB_Flesh1', 'CB_Flesh2', 'CB_Flesh3'] : ['CB_Impact1', 'CB_Impact2'];
    sonar(azarDe(L), pego.p, 0.9); if (PILL.def.metal) sonar('CB_Impact' + (1 + ((Math.random() * 2) | 0)), pego.p, 0.5, 0.7);
    efectoImpacto(pego.p, vscale(f, -1), pego.carne ? 'cuerpo' : 'golpe'); CAM.temblor = Math.max(CAM.temblor || 0, 0.14);
  }
  if (h.gm) { const L = pego ? h.sonHit : h.sonMiss; if (L && L.length) { const s = azarDe(L); pillGmSonar(s, pego ? pego.p : null, 0.8); pillPublicar({ h: 'son', s: s.slice(0, 120) }); } }
  pillXp(xp);
}
// el susto: el grito y la pose de susto (el emote Scream, que los demás ven por el estado); los NPC de cerca huyen y a
// los jugadores de cerca les llega el susto (pillHecho)
function pillSusto(h) {
  const P = JUG.cuerpo;
  JUG.vel.x = 0; JUG.vel.z = 0; PILL.raizT = 1.1;
  P.emote = 'Scream'; P.emoteT = 0;
  sonar(h.son, null, 0.85); if (h.cola) setTimeout(() => { if (PILL.on) sonar(h.cola, null, 0.6); }, 1300);
  CAM.temblor = Math.max(CAM.temblor || 0, 0.2);
  let n = 0;
  for (const Q of NPC.lista) {
    if (Q.vivo === false || Q.rag || !Q.act) continue;
    if (Q.pos.distTo(JUG.pos) > h.radio) continue;
    pillNpcCambiar(Q, { modo: 'huir', dist: h.radio + 8, vel: 6.5, hostil: false, obj: 'yo', de: pillYo() }, 7);
    humAccion(Q, 'golpe'); sonVoz(Q, 'ayuda', Q.pos); n++;
  }
  if (typeof RED !== 'undefined' && RED.on) for (const R2 of RED.remotos.values()) if (R2.P && !R2.P.rag && R2.P.pos.distTo(JUG.pos) < h.radio) n++;
  pillPublicar({ h: 'susto', s: h.son, r: h.radio, c: h.cola || 0 });
  pillXp(4 + 12 * n);
}
// Freddy: la cajita musical (la canción del apagón de FNAF 1): los NPC de cerca se ponen a bailar mientras suena
function pillCajita(h) {
  sonar(h.son, JUG.pos.clone(), 1);
  let n = 0;
  for (const Q of NPC.lista) {
    if (Q.vivo === false || Q.rag || !Q.act || Q.pos.distTo(JUG.pos) > h.radio) continue;
    pillNpcCambiar(Q, { modo: 'bailar', emote: 'ChickenDance', hostil: false }, h.dur); n++;
  }
  for (let i = 0; i < 10; i++) particula(vadd(JUG.pos, v3((Math.random() - 0.5), 0.6 + Math.random(), (Math.random() - 0.5))), v3((Math.random() - 0.5) * 0.6, 0.8, (Math.random() - 0.5) * 0.6), 2, 0.07, [1, 0.9, 0.5, 1], 'chispa', 0.3);
  pillPublicar({ h: 'cajita', s: h.son, r: h.radio, d: h.dur });
  pillXp(5 + 6 * n);
}
// Bonnie (y otros): aparece donde mira (hasta alc metros, en el piso), con estática
function pillTele(h) {
  const o = miraOjo(), d = miraDir(), hit = raycast(o, d, h.alc, null);
  let p = hit ? vadd(o, vscale(d, Math.max(0, hit.t - 0.7))) : vadd(o, vscale(d, h.alc));
  // (si pegó en una pared, un poco afuera; después el piso de abajo)
  if (hit && hit.n) p = vadd(p, vscale(v3(hit.n.x, 0, hit.n.z), 0.35));
  const g = mundoRayo(vadd(p, v3(0, 0.6, 0)), v3(0, -1, 0), 40); if (!g || g.n.y < 0.5) { aviso(T('pill.sinSuelo'), 1.2); sonar('UI_niega', null, 0.4); return false; }
  const dest = v3(p.x, p.y + 0.6 - g.t + JUG.medio + JUG.radio + 0.02, p.z), desde = JUG.pos.clone();
  if (dest.distTo(desde) < 1.5) return false;
  pillEstatica(desde); JUG.pos.copy(dest); JUG.vel.set(0, 0, 0); JUG.suelo = true; jugadorMoverChocar(0); pillEstatica(dest);
  sonar(h.son, null, 0.8); pillSustoFlash('estatica', 0.35);
  pillPublicar({ h: 'tele', s: h.son, a: [r3(desde.x), r3(desde.y), r3(desde.z)], b: [r3(JUG.pos.x), r3(JUG.pos.y), r3(JUG.pos.z)] }); redSubir();
  pillXp(3);
}
function pillCurar(h) {
  if (JUG.vida >= JUG.vidaMax - 0.5) { aviso(T('pill.lleno'), 1); return false; }
  JUG.vida = Math.min(JUG.vidaMax, JUG.vida + Math.round(h.cura * pillK()));
  sonar(h.son, null, 0.7); pillChispas(JUG.pos, [1, 0.55, 0.3, 1]);
  pillPublicar({ h: 'curar', s: h.son });
  pillXp(3);
}
// Foxy (y otros): sale disparado hacia adelante y lastima a lo que choca
function pillEmbestida(h) {
  const f = pillAdelante(); JUG.vel.x = f.x * h.vel; JUG.vel.z = f.z * h.vel; JUG.vel.y = Math.max(JUG.vel.y, 2.2); JUG.suelo = false;
  PILL.emb = { t: 0.55, h, ya: new Set() }; pillAccion(JUG.cuerpo, 'Attack04', 0.6);
  sonar(h.son, null, 0.75);
  pillPublicar({ h: 'emb', s: h.son });
}
function pillEmbestidaPaso(E) {
  const P = JUG.cuerpo, f = v3(JUG.vel.x, 0, JUG.vel.z); if (!P || f.len() < 2) return; f.norm();
  const tk = P.tam || 1, R = 1.0 * tk + 0.35, dan = Math.round(E.h.dan * pillK()); let xp = 0;
  for (const Q of PERS) {
    if (Q === P || Q.visible === false || E.ya.has(Q)) continue;
    const q = v3(Q.pos.x, Q.pos.y, Q.pos.z); if (Math.hypot(q.x - JUG.pos.x, q.z - JUG.pos.z) > R + 0.4 * (Q.tam || 1) || Math.abs(q.y - JUG.pos.y) > 1.6) continue;
    E.ya.add(Q);
    if (Q.rag) { for (const [, e] of Q.rag.cuerpos) { e.b.wake(); e.b.vel.addS(f, 9); e.b.vel.y += 3; } continue; }
    const vivia = Q.vivo !== false; danarPersona(Q, dan, q, f.clone());
    if ((Q.npc || Q.npcRem) && Q.vivo !== false && typeof npcTumbar === 'function') npcTumbar(Q, v3(f.x * 9, 3.5, f.z * 9), 0);
    xp += 10; if (Q.npc && vivia && Q.vivo === false) xp += 25;
    sonar(azarDe(['CB_Flesh1', 'CB_Flesh2']), q, 0.9); efectoImpacto(q, vscale(f, -1), 'cuerpo'); CAM.temblor = Math.max(CAM.temblor || 0, 0.2);
  }
  for (const o of OBJS) {
    const b = o.b; if (!b || b.noPhys || b.dead || E.ya.has(o) || (b.frozen && !o.remoto)) continue;
    if (b.pos.distTo(JUG.pos) > R + (b.shape.r || 0.5)) continue;
    E.ya.add(o); if (o.remoto) redReclamar(o);
    const dv = Math.min(14, 1200 / Math.max(b.mass, 1)); b.wake(); b.vel.addS(f, dv); b.vel.y += dv * 0.35; danarObjeto(o, dan, b.pos, f); xp += 2;
  }
  pillXp(xp);
}
function pillSalto(h) {
  if (!JUG.suelo && (JUG.tAire || 0) > 0.15) return false;
  const g = GRAV * ((typeof MUNDO !== 'undefined' && MUNDO.gravedad) || 1) * (JUG.grav || 1);
  JUG.vel.y = Math.sqrt(2 * Math.abs(g) * h.alto) * (g < 0 ? -1 : 1); JUG.suelo = false; JUG.tiempoSuelo = 0; JUG.saltoT = TIEMPO.t;
  const f = pillAdelante(), sp = JUG.vel.x * f.x + JUG.vel.z * f.z; if (sp > 1) { JUG.vel.x += f.x * 2; JUG.vel.z += f.z * 2; }
  sonar('Arm_Swing_edited', null, 0.6, 0.7); for (let i = 0; i < 10; i++) particula(vadd(JUG.pos, v3((Math.random() - 0.5) * 0.8, -0.9, (Math.random() - 0.5) * 0.8)), v3((Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2), 0.6, 0.25, [0.85, 0.85, 0.8, 0.5], 'humo');
  pillPublicar({ h: 'salto' });
  pillXp(1);
}
// la ráfaga de ki (o el láser de los robots): un rayo de luz hasta lo que apunta y una explosión chica ahí
function pillRafaga(h) {
  const o = miraOjo(), d = miraDir(), P = JUG.cuerpo, a = vadd(o, vscale(d, 0.7)), hit = raycast(a, d, 90, null), q = hit ? hit.p : vadd(a, vscale(d, 90));
  const mano = pillMano(P) || vadd(JUG.pos, v3(0, 0.45 * (P ? P.tam || 1 : 1), 0));
  pillAccion(P, 'blend_shoot_1', 0.45);
  pillRayo(mano, q, h.laser);
  sonar(h.laser ? 'TG_Fire1' : 'GG_Launch2', null, 0.7, h.laser ? 0.8 : 1.1);
  pillPublicar({ h: 'rafaga', l: h.laser ? 1 : 0, a: [r3(mano.x), r3(mano.y), r3(mano.z)], b: [r3(q.x), r3(q.y), r3(q.z)] });
  if (hit && q.distTo(JUG.pos) > h.radio * 1.45) {
    // (cuántos tenía alrededor: lo que suma experiencia)
    let n = 0; for (const Q of PERS) if (Q !== P && !Q.rag && Q.vivo !== false && Q.visible !== false && Q.pos.distTo(q) < h.radio * 1.5) n++;
    explosion(q, h.radio, h.dan * pillK()); pillXp(2 + 8 * n);
  } else if (hit) { efectoImpacto(q, hit.n || v3(0, 1, 0), 'mundo'); pillXp(1); }
}
// el disparo (los de los addons: pk_pills.common.shoot)
function pillDisparo(h) {
  const o = miraOjo(), d0 = miraDir(), P = JUG.cuerpo, n = Math.max(1, Math.min(12, h.num || 1)); let xp = 0;
  for (let k = 0; k < n; k++) {
    const s = h.disp || 0, d = v3(d0.x + (Math.random() - 0.5) * s, d0.y + (Math.random() - 0.5) * s, d0.z + (Math.random() - 0.5) * s).norm();
    const hit = raycast(vadd(o, vscale(d, 0.6)), d, 300, null), q = hit ? hit.p : vadd(o, vscale(d, 300));
    efectoTraza(pillMano(P) || vadd(o, v3(0, -0.2, 0)), q);
    if (!hit) continue;
    const Q = hit.body && (hit.body.persona || hit.body.npc);
    if (Q && Q !== P) { const vivia = Q.vivo !== false; danarPersona(Q, h.dan * pillK(), q, d.clone()); xp += 4; if (Q.npc && vivia && Q.vivo === false) xp += 25; efectoImpacto(q, vscale(d, -1), 'cuerpo'); }
    else if (hit.body && hit.body.obj) { danarObjeto(hit.body.obj, h.dan, q, d); hit.body.wake && hit.body.wake(); hit.body.vel && hit.body.vel.addS(d, Math.min(6, 300 / Math.max(1, hit.body.mass || 1))); efectoImpacto(q, hit.n || vscale(d, -1), 'mundo'); }
    else efectoImpacto(q, hit.n || vscale(d, -1), 'mundo');
  }
  pillAccion(P, 'blend_shoot_1', 0.3);
  const sd = h.sonL && h.sonL.length ? azarDe(h.sonL) : h.son || null;
  if (sd && typeof pillGmSonar === 'function') pillGmSonar(sd, null); else sonar('pistol2Fire_1', null, 0.6);
  pillPublicar({ h: 'disparo', s: sd ? sd.slice(0, 120) : 0 });
  pillXp(xp);
}
// la mano derecha del cuerpo (de donde salen la ráfaga y los disparos)
function pillMano(P) { if (!P || !P.md || P.D.h.RightHand === undefined) return null; P.md.actualizar(); const W = P.md.W[P.D.h.RightHand]; return v3(W[12], W[13], W[14]); }
// ---------------- los NPC asustados o bailando (vuelven a lo suyo cuando termina) ----------------
function pillNpcCambiar(Q, act, seg) {
  if (!Q.pillAct0) Q.pillAct0 = Q.act;
  Q.act = Object.assign({}, Q.pillAct0, act); Q.pillHasta = TIEMPO.t + seg; if (act.modo === 'huir') Q.emote = null;
  PILL.npcMod.add(Q);
}
function pillNpcPaso() {
  if (!PILL.npcMod.size) return;
  for (const Q of [...PILL.npcMod]) {
    if (Q.borrado || !PERS.includes(Q)) { PILL.npcMod.delete(Q); continue; }
    if (TIEMPO.t < Q.pillHasta) continue;
    if (Q.act && Q.act.modo === 'bailar' && Q.emote === 'ChickenDance') Q.emote = null;
    Q.act = Q.pillAct0; Q.pillAct0 = null; PILL.npcMod.delete(Q);
  }
}
// ---------------- efectos ----------------
function pillPuf(p, D) {
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * TAU, r = 0.25 + Math.random() * 0.5;
    particula(v3(p.x + Math.cos(a) * r, p.y - 0.9 + Math.random() * 2, p.z + Math.sin(a) * r), v3(Math.cos(a) * 1.2, 0.6 + Math.random(), Math.sin(a) * 1.2), 0.9 + Math.random() * 0.5, 0.32, D && D.cat === 'fnaf' ? [0.55, 0.45, 0.6, 0.55] : [0.9, 0.9, 0.95, 0.5], 'humo');
  }
  for (let i = 0; i < 14; i++) particula(v3(p.x, p.y - 0.2 + Math.random() * 1.4, p.z), v3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4), 0.5, 0.06, [1, 0.85, 0.4, 1], 'chispa', 0.2);
}
function pillEstatica(p) { for (let i = 0; i < 22; i++) particula(v3(p.x + (Math.random() - 0.5) * 0.9, p.y - 0.95 + Math.random() * 2.1, p.z + (Math.random() - 0.5) * 0.9), v3((Math.random() - 0.5) * 0.8, Math.random() * 0.8, (Math.random() - 0.5) * 0.8), 0.5 + Math.random() * 0.4, 0.12, Math.random() < 0.5 ? [0.1, 0.1, 0.12, 0.8] : [0.8, 0.8, 0.85, 0.7], 'humo', 0.4); }
function pillChispas(p, c) { for (let i = 0; i < 16; i++) particula(vadd(p, v3((Math.random() - 0.5) * 0.9, -0.5 + Math.random() * 1.6, (Math.random() - 0.5) * 0.9)), v3(0, 0.7 + Math.random(), 0), 1, 0.07, c, 'chispa', 0.25); }
// un rayo de luz que dura un instante (partículas a lo largo, que se apagan solas)
function pillRayo(a, b, laser) {
  const L = a.distTo(b), n = Math.min(60, Math.max(6, Math.round(L * 1.6))), d = vsub(b, a), c = laser ? [1, 0.25, 0.2, 1] : [0.55, 0.85, 1, 1];
  for (let i = 0; i <= n; i++) { const t = i / n; particula(vadd(a, vscale(d, t)), v3(0, 0, 0), 0.22 + 0.1 * Math.random(), laser ? 0.07 : 0.16, c, 'fuego', 0.1); }
  efectoTraza(a, b); PILL.fx.push({ t: 0.2, a: a.clone(), b: b.clone(), c });
}
function pillFxPaso(dt) {
  if (!PILL.fx.length) return;
  for (const F of PILL.fx) { F.t -= dt; if (F.t > 0) efectoTraza(F.a, F.b); }
  PILL.fx = PILL.fx.filter((F) => F.t > 0);
}
// unos tonos chiquitos (transformarse, volver, subir de nivel), hechos acá: sin archivos
function pillSonTonos(fs, paso, vol) {
  if (!AUD.ctx || !PREFS.vol || !AUD.master) return;
  const c = AUD.ctx, t0 = c.currentTime;
  fs.forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(), t = t0 + i * paso; o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + paso * 2.2); o.connect(g); g.connect(AUD.master); o.start(t); o.stop(t + paso * 2.4); });
}
// el susto que te llega (de otro jugador): sacudón, la pantalla en rojo y la cara hacia el que grita
function pillSustoFlash(cl, seg) {
  let e = $('pillSusto'); if (!e) { e = document.createElement('div'); e.id = 'pillSusto'; document.body.appendChild(e); }
  e.className = cl; void e.offsetWidth; e.classList.add('ve'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('ve'), seg * 1000);
}
function pillSustado(desde, son) {
  if (!JUG.vivo || JUG.vehiculo) return;
  PILL.sustoT = 0.45; PILL.sustoDe = desde.clone(); CAM.temblor = Math.max(CAM.temblor || 0, 0.55);
  sonar(son, null, 1); pillSustoFlash('susto', 0.75);
}
function pillSustoVista(dt) {
  PILL.sustoT -= dt; const p = PILL.sustoDe; if (!p || UI.abierto) return;
  // (adelante es (sen yaw, 0, cos yaw): la cara hacia el que grita)
  const meta = Math.atan2(p.x - JUG.pos.x, p.z - JUG.pos.z); let d = meta - JUG.yaw; d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
  JUG.yaw += d * Math.min(1, dt * 14); JUG.pitch += (-0.05 - JUG.pitch) * Math.min(1, dt * 10);
}
// ---------------- en la sala ----------------
function pillPublicar(o) { if (typeof publicar !== 'function' || typeof RED === 'undefined' || !RED.on || (!PILL.id && o.h !== 'sal')) return; o.k = 'pill'; o.id = o.id || PILL.id || 0; o.p = [r3(JUG.pos.x), r3(JUG.pos.y), r3(JUG.pos.z)]; publicar('a', o); }
// lo que va en el estado (red.js): qué personaje, el nivel y si va en carrera (cambia poco: no suma mensajes)
function pillRed() { return PILL.on && PILL.id ? [String(PILL.id).slice(0, 80), pillNivel(), PILL.carrera ? 1 : 0] : 0; }
function pillRemoto(R2, pl) {
  if (!Array.isArray(pl) || typeof pl[0] !== 'string') { R2.pill = null; if (R2.P) R2.P.pill = null; return; }
  const id = pl[0].slice(0, 80), D = pillDef(id);
  R2.pill = { id, D, niv: num(pl[1], 1, PILL_NIV_MAX, 1) | 0, car: !!pl[2] };
  if (R2.P) R2.P.pill = D;
  if (D && D.paq && !rbListo(D.paq)) rbPedir(D.paq);   // (sus sonidos)
}
// los pasos de metal de los animatrónicos de los demás
function pillRemotosPaso(dt) {
  if (typeof RED === 'undefined' || !RED.on) return;
  for (const R2 of RED.remotos.values()) {
    const P = R2.P, D = R2.pill && R2.pill.D; if (!P || !D || !(D.pasos || (D.pasosGm && D.pasosGm.length)) || P.rag || !P.suelo) continue;
    const sp = Math.hypot(P.vel.x, P.vel.z); if (sp < 0.5 || P.pos.distTo(CAM.pos) > 30) continue;
    P.pillPaso = (P.pillPaso || 0) + sp * dt; const L = (1.0 + 0.12 * Math.max(0, sp - 2)) * (P.tam || 1);
    if (P.pillPaso >= L) { P.pillPaso -= L; pillPasoSon(D, v3(P.pos.x, P.pos.y - 0.9, P.pos.z), clamp(sp / 9, 0.25, 0.6)); }
  }
}
// lo que hace el personaje de otro jugador (red.js recibirHecho)
function pillHecho(d, R2) {
  const P = R2 && R2.P, nv = (a) => (Array.isArray(a) ? v3(num(a[0], -1e4, 1e4, 0), num(a[1], -1e4, 1e4, 0), num(a[2], -1e4, 1e4, 0)) : null);
  const p = nv(d.p) || (P ? P.pos.clone() : null); if (!p) return;
  const son = (s) => (typeof s === 'string' && /^[\w.\-/ ]{1,120}$/.test(s) ? s : null);
  const D = typeof d.id === 'string' ? pillDef(d.id.slice(0, 80)) : null;
  const tono = (s, pos, vol, t) => { if (!s) return; if (/^gm:|\//.test(s) && typeof pillGmSonar === 'function') pillGmSonar(s, pos, vol); else sonar(s, pos, vol, t); };
  switch (d.h) {
    case 'ent': case 'sal': pillPuf(p, D); break;
    case 'golpe': if (P && !(d.a && D && D.gm && typeof pgmAnim === 'function' && pgmAnim(P, D, 'melee'))) pillAccion(P, typeof d.c === 'string' ? d.c.slice(0, 40) : 'gm_range_melee', 0.7); if (son(d.s)) tono(son(d.s), p, 0.9); else sonar('CB_Swing', p, 0.6, D && D.metal ? 0.78 : 0.9); break;
    case 'anim': if (P && D && D.gm && typeof pgmAnim === 'function' && typeof d.c === 'string') pgmAnim(P, D, d.c.slice(0, 40)); break;
    case 'susto': {
      const s = son(d.s); tono(s, p, 1);
      if (typeof d.c === 'string') { const c = son(d.c); setTimeout(() => tono(c, p, 0.8), 1300); }
      // (a mí también, si estoy cerca: más cerca o mirándolo, más fuerte)
      const r = num(d.r, 0, 30, 10), dist = JUG.pos.distTo(p);
      if (dist < r && JUG.vivo && !PILL.on) { pillSustado(p, s || 'fn_grito'); }
      break;
    }
    case 'cajita': tono(son(d.s), p, 1); break;
    case 'tele': {
      const a = nv(d.a), b = nv(d.b); if (a) pillEstatica(a); if (b) { pillEstatica(b); if (R2) { R2.pos.copy(b); R2.meta.copy(b); if (P) P.pos.copy(b); } }
      tono(son(d.s), b || p, 0.9); break;
    }
    case 'curar': tono(son(d.s), p, 0.8); pillChispas(p, [1, 0.55, 0.3, 1]); break;
    case 'emb': tono(son(d.s), p, 0.9); if (P) pillAccion(P, 'Attack04', 0.6); break;
    case 'son': tono(son(d.s), p, 0.8); break;
    case 'salto': sonar('Arm_Swing_edited', p, 0.7, 0.7); break;
    case 'rafaga': { const a = nv(d.a), b = nv(d.b); if (a && b && a.distTo(b) < 200) pillRayo(a, b, !!d.l); if (P) pillAccion(P, 'blend_shoot_1', 0.45); sonar(d.l ? 'TG_Fire1' : 'GG_Launch2', p, 0.8, d.l ? 0.8 : 1.1); break; }
    case 'disparo': if (P) pillAccion(P, 'blend_shoot_1', 0.3); tono(son(d.s) || 'pistol2Fire_1', p, 0.8); break;
    case 'nivel': pillChispas(p, [1, 0.85, 0.3, 1]); break;
  }
}
// ---------------- el HUD: vida, poder y nivel (como en la idea: «100 HP», la barra y «Level 1») y las habilidades ----------------
const PILL_ICO = {
  golpe: '<path d="M6 19c2-5 3-9 3-14M11 20c1.5-5 2-9 1.5-14M16 19.5c.5-4.5 0-8-1.5-12M19.5 16.5c-.5-3-1.5-5.5-3-7.5" stroke-width="2.2"/>',
  susto: '<path d="M7 9.5h.01M17 9.5h.01" stroke-width="3.4"/><path d="M8 15.5c1-2.4 2.4-3.6 4-3.6s3 1.2 4 3.6c-1.3 2.3-2.6 3.5-4 3.5s-2.7-1.2-4-3.5z"/><path d="M4.5 5.5l2.5 1.5M19.5 5.5L17 7"/>',
  carrera: '<circle cx="14.5" cy="4.5" r="1.8"/><path d="M8 21l3-6 3 2.5v4.5M5 12.5l3.5-3 4-.5 3 3 3.5.5M11 15l1.5-6"/>',
  cajita: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  tele: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="2.6"/>',
  curar: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  embestida: '<path d="M3 8h8M2 12h10M3 16h8"/><path d="M14 5l7 7-7 7"/>',
  salto: '<path d="M12 20V5M6 11l6-6 6 6"/><path d="M5 21h14"/>',
  rafaga: '<circle cx="15" cy="12" r="4.5"/><path d="M3 9h6M2 12h7M3 15h6"/>',
  disparo: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  lua: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  volver: '<circle cx="12" cy="6" r="2.6"/><path d="M12 9.5v6M8 21l4-5.5 4 5.5M7.5 12.5h9"/><path d="M3 5.5l2-2M3 5.5l2 2M3 5.5h3" stroke-width="1.8"/>',
};
const pillSvg = (n, cl) => `<svg class="pillGli${cl ? ' ' + cl : ''}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PILL_ICO[n] || PILL_ICO.lua}</svg>`;
const PILL_TECLA = ['pill.t.clic', 'pill.t.clicDer', 'Shift', 'R'];
// el ícono de la pestaña: una cápsula como la de pk_pills
const PILL_TAB_ICO = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g transform="rotate(-40 12 12)"><rect x="3" y="8" width="18" height="8" rx="4" fill="#fff"/><path d="M12 8h5a4 4 0 0 1 0 8h-5z" fill="#e8394d"/><rect x="3" y="8" width="18" height="8" rx="4" fill="none" stroke="#2a2a2a" stroke-width="1.2"/><rect x="6" y="9.6" width="4" height="1.6" rx=".8" fill="#fff" opacity=".7"/></g></svg>');
const pillTxtPoder = (D) => T('pill.poder.' + ((D && D.poder) || 'energia'));
function pillHabNom(h) { return h ? T('pill.h.' + (h.n || h.t)) : ''; }
function pillCss() {
  if ($('pillCss')) return;
  const s = document.createElement('style'); s.id = 'pillCss';
  s.textContent = `
#pillHud{position:absolute;left:calc(10px*var(--hk,1));bottom:calc(10px*var(--hk,1));display:flex;align-items:flex-end;gap:calc(8px*var(--hk,1));pointer-events:none;font-family:var(--jxF);z-index:2}
#pillHud.oc,#pillBar.oc,.pillBt.oc{display:none!important}
#pillHud .phIzq{display:flex;flex-direction:column;gap:calc(4px*var(--hk,1));align-items:flex-start}
#pillHud .phHp{background:rgba(10,10,12,.82);border:2px solid #f0f0f0;border-radius:calc(9px*var(--hk,1));color:#fff;font-weight:700;font-size:calc(17px*var(--hk,1));padding:calc(2px*var(--hk,1)) calc(12px*var(--hk,1));letter-spacing:.02em}
#pillHud .phVida{display:flex;gap:calc(3px*var(--hk,1));background:rgba(10,10,12,.82);border:2px solid #f0f0f0;border-radius:calc(7px*var(--hk,1));padding:calc(3px*var(--hk,1))}
#pillHud .phVida i{width:calc(17px*var(--hk,1));height:calc(13px*var(--hk,1));background:#ff6f9c;border-radius:calc(3px*var(--hk,1));transition:background .2s}
#pillHud .phVida i.f{background:rgba(255,111,156,.18)}
#pillHud .phVida i.m{background:linear-gradient(90deg,#ff6f9c var(--p),rgba(255,111,156,.18) var(--p))}
#pillHud .phPod{display:flex;align-items:center;gap:calc(6px*var(--hk,1));background:rgba(10,10,12,.82);border-radius:calc(12px*var(--hk,1));padding:calc(3px*var(--hk,1)) calc(9px*var(--hk,1)) calc(3px*var(--hk,1)) calc(4px*var(--hk,1))}
#pillHud .phPodB{width:calc(104px*var(--hk,1));height:calc(9px*var(--hk,1));border-radius:9px;background:rgba(255,255,255,.14);overflow:hidden}
#pillHud .phPodB i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ffb020,#ffe066);transform-origin:left;transition:transform .12s linear}
#pillHud .phPodB i.bajo{background:linear-gradient(90deg,#ff5a3c,#ff9a3c)}
#pillHud .phPod span{color:#fff;font-weight:700;font-size:calc(13px*var(--hk,1));white-space:nowrap}
#pillHud .phNiv{position:relative;width:calc(46px*var(--hk,1));height:calc(46px*var(--hk,1));border-radius:50%;background:#16161a;border:2px solid #f0f0f0;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;margin-bottom:calc(2px*var(--hk,1))}
#pillHud .phNiv small{font-size:calc(9px*var(--hk,1));font-weight:700;opacity:.9}
#pillHud .phNiv b{font-size:calc(19px*var(--hk,1))}
#pillHud .phNiv svg{position:absolute;inset:-5px;width:calc(100% + 10px);height:calc(100% + 10px);transform:rotate(-90deg)}
#pillHud .phNiv circle{fill:none;stroke:#ff6f9c;stroke-width:3;stroke-linecap:round}
#pillHud .phNom{color:#fff;font-weight:700;font-size:calc(12px*var(--hk,1));text-shadow:0 1px 2px #000;opacity:.92}
body.pillOn #vida,body.pillOn #armaAct,body.pillOn #muni,body.pillOn #barra,body.pillOn #bdisparo,body.pillOn #bdisp2,body.pillOn #brecargar,body.pillOn #bpatada{display:none!important}
#pillBar{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:flex;gap:8px;pointer-events:auto;z-index:2}
body.tactil #pillBar{display:none}
#pillBar .pbH{position:relative;width:62px;height:62px;border-radius:10px;background:rgba(14,16,20,.78);border:2px solid rgba(255,255,255,.28);color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer}
#pillBar .pbH .pillGli{width:30px;height:30px;margin-top:-8px}
#pillBar .pbH b{position:absolute;left:0;right:0;bottom:3px;text-align:center;font:600 9px Roboto,Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 2px}
#pillBar .pbH kbd{position:absolute;top:2px;left:3px;font:700 9px Roboto,Arial,sans-serif;color:#ffd27a}
#pillBar .pbH em{position:absolute;top:2px;right:3px;font:700 9px Roboto,Arial,sans-serif;color:#9fd4ff;font-style:normal}
#pillBar .pbH.no{opacity:.45}
#pillBar .pbH.on{border-color:#ffd27a;box-shadow:0 0 10px rgba(255,210,122,.55)}
#pillBar .pbH.volver{background:rgba(120,30,40,.72)}
.pillCd{position:absolute;inset:0;pointer-events:none;border-radius:inherit;background:conic-gradient(rgba(0,0,0,.62) calc(var(--c,0)*1%),transparent 0)}
.bt-t.pillBt{overflow:visible}
.bt-t.pillBt .pillGli{width:50%;height:50%;color:#fff;filter:drop-shadow(0 1px 1px rgba(0,0,0,.5))}
.bt-t.pillBt.no .pillGli{opacity:.45}
.bt-t.pillBt.on{border-color:#ffd27a;background:rgba(120,90,20,.55)}
.bt-t.pillBt .accTxt{position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:2px;font:600 10px Roboto,Arial,sans-serif;color:#fff;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,.85);pointer-events:none}
.bt-t.pillBt.volver{background:rgba(120,30,40,.6)}
#pillSusto{position:fixed;inset:0;pointer-events:none;z-index:40;opacity:0}
#pillSusto.susto{background:radial-gradient(ellipse at center,rgba(0,0,0,0) 22%,rgba(150,0,0,.55) 62%,rgba(0,0,0,.92) 100%)}
#pillSusto.estatica{background:repeating-linear-gradient(0deg,rgba(255,255,255,.10) 0 2px,rgba(0,0,0,.22) 2px 4px)}
#pillSusto.ve{animation:pillSusto .75s ease-out forwards}
#pillSusto.estatica.ve{animation:pillEst .35s steps(5) forwards}
@keyframes pillSusto{0%{opacity:0}8%{opacity:1}55%{opacity:.85}100%{opacity:0}}
@keyframes pillEst{0%{opacity:.9}100%{opacity:0}}
#spawn .grilla .it.pillIt{position:relative}
#spawn .grilla .it.pillIt img{object-fit:contain}
#spawn .grilla .it.pillIt.sel{border-color:var(--jxA);box-shadow:0 0 0 1px var(--jxA) inset}
#spawn .grilla .it.pillIt .pillNv{position:absolute;top:6px;right:6px;background:rgba(0,0,0,.72);color:#ffd27a;font:700 11px Roboto,Arial,sans-serif;padding:1px 4px}
#spawn .grilla .it.pillIt .pillSin{position:absolute;top:6px;left:6px;background:rgba(160,40,40,.85);color:#fff;font:700 11px Roboto,Arial,sans-serif;padding:1px 4px}
#spawn .grilla .pillInfo{width:100%;color:#d8dade;font:13px/1.35 Roboto,Arial,sans-serif;padding:2px 4px 6px}
#spawn .pie .pillPie{flex:1;min-width:0;white-space:normal;line-height:1.2;color:#e6e7ea}
#spawn .pie .pillVolverBt{display:inline-flex;align-items:center;width:auto;min-height:40px;margin:0;padding:3px 12px;font-size:13px;background:#a8283a;color:#fff;white-space:nowrap;border-radius:0}
`;
  document.head.appendChild(s);
}
// los elementos del HUD (una vez)
function pillHudArmar() {
  pillCss(); if (PILL.hud) return PILL.hud;
  const hud = $('hud'), tac = $('tactil'); if (!hud) return null;
  const H = document.createElement('div'); H.id = 'pillHud'; H.className = 'oc';
  H.innerHTML = '<div class="phIzq"><div class="phNom" id="phNom"></div><div class="phHp"><span id="phHpN">100</span> HP</div><div class="phVida" id="phVida"></div><div class="phPod"><div class="phPodB"><i id="phPodI"></i></div><span id="phPodN"></span></div></div>' +
    '<div class="phNiv"><svg viewBox="0 0 36 36"><circle id="phNivC" cx="18" cy="18" r="16.5" pathLength="100" stroke-dasharray="0 100"/></svg><small id="phNivT"></small><b id="phNivN">1</b></div>';
  hud.appendChild(H);
  const B = document.createElement('div'); B.id = 'pillBar'; B.className = 'oc'; hud.appendChild(B);
  const bts = [];
  for (let i = 0; i < 5; i++) {
    const b = document.createElement('div'); b.className = 'bt-t pillBt oc' + (i === 4 ? ' volver' : ''); b.id = 'bpill' + i;
    b.dataset.btn = i === 4 ? 'pillVolver' : 'pillA' + i; if (i < 4) b.dataset.mantener = '';
    b.innerHTML = `${pillSvg(i === 4 ? 'volver' : 'lua')}<i class="pillCd"></i><span class="accTxt"></span>`;
    if (tac) { tac.appendChild(b); if (typeof botonTactil === 'function') botonTactil(b); }
    bts.push(b);
  }
  return (PILL.hud = { H, B, bts, seg: -1, vida: -1, pod: -1, niv: -1, xpk: -1, cds: [], est: [], nom: '' });
}
function pillHudVer(si) { const U = PILL.hud; if (!U) return; U.H.classList.toggle('oc', !si); U.B.classList.toggle('oc', !si); for (const b of U.bts) b.classList.toggle('oc', !si); }
// los botones y la barra según el personaje (al transformarse)
function pillHudBotones() {
  const U = pillHudArmar(); if (!U) return; const D = PILL.def; if (!D) return;
  U.nom = ''; U.vida = U.pod = U.niv = U.xpk = U.seg = -1; U.cds = []; U.est = []; U.veh = false;
  let barra = '';
  for (let i = 0; i < 4; i++) {
    const h = D.hab[i], b = U.bts[i];
    b.classList.toggle('oc', !h);
    if (h) { b.querySelector('svg').outerHTML = pillSvg(PILL_HAB_ICO[h.t] || 'lua'); b.querySelector('.accTxt').textContent = pillHabNom(h); }
    const k = PILL_TECLA[i], kt = /^pill\./.test(k) ? T(k) : k;
    barra += h ? `<div class="pbH" data-i="${i}" title="${esc(pillHabNom(h))} (${esc(kt)})">${pillSvg(PILL_HAB_ICO[h.t] || 'lua')}<kbd>${esc(kt)}</kbd>${h.costo ? `<em>${h.costo}</em>` : h.man ? `<em>${h.gasto}/s</em>` : ''}<b>${esc(pillHabNom(h))}</b><i class="pillCd"></i></div>` : '';
  }
  barra += `<div class="pbH volver" data-i="4" title="${esc(T('pill.volver'))} (H)">${pillSvg('volver')}<kbd>H</kbd><b>${esc(T('pill.volverC'))}</b></div>`;
  U.B.innerHTML = barra;
  for (const e of U.B.querySelectorAll('.pbH')) e.onclick = (ev) => { ev.stopPropagation(); const i = +e.dataset.i; if (i === 4) pillFin(); else if (PILL.def && PILL.def.hab[i] && !PILL.def.hab[i].man) pillUsar(i); };
  U.bts[4].querySelector('.accTxt').textContent = T('pill.volverC');
  $('phNivT').textContent = T('pill.level'); $('phPodN').textContent = pillTxtPoder(D); $('phNom').textContent = D.nom;
  pillHudVer(true); pillHudUbicar(); pillHudPaso(0);
}
const PILL_HAB_ICO = { golpe: 'golpe', susto: 'susto', carrera: 'carrera', cajita: 'cajita', tele: 'tele', curar: 'curar', embestida: 'embestida', salto: 'salto', rafaga: 'rafaga', disparo: 'disparo', lua: 'lua' };
// en el celular, cada botón va donde está el del pulgar derecho que reemplaza (el disparo, el secundario, la patada,
// recargar y el arma), con su tamaño: si el jugador los movió en Controles, los suyos también van ahí
const PILL_LUGAR = ['bdisparo', 'bdisp2', 'bpatada', 'brecargar', 'armaAct'];
function pillHudUbicar() {
  const U = PILL.hud; if (!U) return;
  for (let i = 0; i < 5; i++) {
    const r = $(PILL_LUGAR[i]), b = U.bts[i]; if (!r || !b) continue;
    const s = r.style; if (!s.left) continue;
    // (el arma de arriba a la derecha es un rectángulo: volver va en un círculo de su alto, en el mismo centro)
    if (i === 4) { const w = parseFloat(s.width) || 60, h = parseFloat(s.height) || w, t = Math.min(w, h); Object.assign(b.style, { left: parseFloat(s.left) + (w - t) / 2 + 'px', top: parseFloat(s.top) + (h - t) / 2 + 'px', width: t + 'px', height: t + 'px', right: 'auto', bottom: 'auto' }); }
    else Object.assign(b.style, { left: s.left, top: s.top, width: s.width, height: s.height, right: 'auto', bottom: 'auto' });
  }
  // (en el celular la vida y el poder van arriba de la palanca de caminar, no encima: donde la haya puesto el jugador)
  const H = U.H; H.style.bottom = '';
  if (ENT.tactil && !H.classList.contains('oc')) {
    const pal = $('palanca'), pr = pal && pal.getClientRects().length ? pal.getBoundingClientRect() : null, hr = H.getBoundingClientRect(), base = H.offsetParent && H.offsetParent.getBoundingClientRect();
    if (pr && base && hr.left < pr.right && pr.left < hr.right && hr.bottom > pr.top) H.style.bottom = Math.max(0, base.bottom - pr.top + 4) + 'px';
  }
}
// cada cuadro, sólo lo que cambió (escribir lo mismo en la página la vuelve a pintar: en un celular con la placa justa eso
// se nota, ver red.js redEstadoUI)
function pillHudPaso() {
  const U = PILL.hud, D = PILL.def; if (!U || !D) return;
  const veh = !!JUG.vehiculo; if (veh !== U.veh) { U.veh = veh; for (let i = 0; i < 4; i++) U.bts[i].classList.toggle('oc', veh || !D.hab[i]); U.B.classList.toggle('oc', veh); }
  const vm = Math.max(1, JUG.vidaMax || 100), v = Math.max(0, Math.round(JUG.vida));
  if (v !== U.vida) { U.vida = v; $('phHpN').textContent = v; }
  // (la vida en cuadritos, como en la idea: uno cada 10 % y el último a medias)
  const seg = Math.round(clamp(v / vm, 0, 1) * 100);
  if (seg !== U.seg) {
    U.seg = seg; const n = 10, el = $('phVida'); if (el.children.length !== n) el.innerHTML = '<i></i>'.repeat(n);
    for (let i = 0; i < n; i++) { const c = el.children[i], q = clamp(seg / 10 - i, 0, 1); c.className = q >= 0.999 ? '' : q <= 0.001 ? 'f' : 'm'; if (q > 0.001 && q < 0.999) c.style.setProperty('--p', Math.round(q * 100) + '%'); }
  }
  const pm = pillPodMax(), pk = Math.round(clamp(PILL.pod / pm, 0, 1) * 200);
  if (pk !== U.pod) { U.pod = pk; const i = $('phPodI'); i.style.transform = `scaleX(${(pk / 200).toFixed(3)})`; i.classList.toggle('bajo', pk < 50); }
  const niv = pillNivel(), x = +pillXpLeer()[PILL.id] || 0, xa = pillXpDe(niv), xb = pillXpDe(niv + 1), xk = niv >= PILL_NIV_MAX ? 100 : Math.round(clamp((x - xa) / Math.max(1, xb - xa), 0, 1) * 100);
  if (niv !== U.niv) { U.niv = niv; $('phNivN').textContent = niv; }
  if (xk !== U.xpk) { U.xpk = xk; $('phNivC').setAttribute('stroke-dasharray', xk + ' 100'); }
  // las esperas y lo que no alcanza (de a 5 %)
  for (let i = 0; i < 4; i++) {
    const h = D.hab[i]; if (!h) continue;
    const c = h.cd ? Math.round(clamp(PILL.cd[i] / h.cd, 0, 1) * 20) * 5 : 0, no = !!h.rota || (h.costo || 0) > PILL.pod + 1e-6 || !!(h.man && PILL.pod < 8 && !PILL.carrera), on = !!(h.man && PILL.carrera), est = (no ? 1 : 0) | (on ? 2 : 0);
    if (c !== U.cds[i]) { U.cds[i] = c; U.bts[i].querySelector('.pillCd').style.setProperty('--c', c); const e = U.B.querySelector(`.pbH[data-i="${i}"] .pillCd`); if (e) e.style.setProperty('--c', c); }
    if (est !== U.est[i]) { U.est[i] = est; U.bts[i].classList.toggle('no', no); U.bts[i].classList.toggle('on', on); const e = U.B.querySelector(`.pbH[data-i="${i}"]`); if (e) { e.classList.toggle('no', no); e.classList.toggle('on', on); } }
  }
}
// (los controles se vuelven a ubicar: los míos con ellos)
const _pillHudDisponer0 = hudDisponer;
hudDisponer = function () { const r = _pillHudDisponer0.apply(this, arguments); try { if (PILL.hud) pillHudUbicar(); } catch (e) {} return r; };
// ---------------- la pestaña Pill Packs del menú de spawn (al lado de GMod) ----------------
function pillSubs() {
  const todos = [], cats = new Map();
  for (const D of PILL_PROPIOS) { if (!pillSkinDisp(D)) continue; todos.push('pill:' + D.id); if (!cats.has(D.cat)) cats.set(D.cat, []); cats.get(D.cat).push('pill:' + D.id); }
  const subs = [{ n: T('pill.cat.todos'), it: todos }];
  for (const c of PILL_CATS) if (cats.has(c)) subs.push({ n: T('pill.cat.' + c), it: cats.get(c) });
  // (los de los addons de pk_pills, uno por pack, con el nombre del pack como en GMod)
  if (typeof pillGmPacks === 'function') for (const [n, L] of pillGmPacks()) { subs.push({ n, it: L.map((x) => 'pill:' + x) }); todos.push(...L.map((x) => 'pill:' + x)); }
  return subs;
}
function pillTab() {
  if (typeof DATA === 'undefined' || !DATA || !DATA.menu) return;
  const sel = DATA.menu[UI.tab];
  let i = DATA.menu.findIndex((c) => c.pill); const C = i >= 0 ? DATA.menu[i] : { n: 'PillPacks', pill: true, sub: [], icUrl: PILL_TAB_ICO };
  if (i >= 0) DATA.menu.splice(i, 1);
  let j = DATA.menu.findIndex((c) => c.n === 'GMod'); if (j < 0) j = DATA.menu.findIndex((c) => c.n === 'Weapons');
  DATA.menu.splice(j >= 0 ? j + 1 : DATA.menu.length, 0, C);
  C.sub = pillSubs();
  if (sel) { const k = DATA.menu.indexOf(sel); if (k >= 0) UI.tab = k; }
}
const _pillSpawnTabs0 = spawnTabs;
spawnTabs = function () { try { pillTab(); } catch (e) { console.warn('pill tab', e); } return _pillSpawnTabs0.apply(this, arguments); };
const pillRetrato = (D) => (D.gm && typeof pillGmIcono === 'function' ? pillGmIcono(D) : { src: retrato(D.skin) });
function pillGrilla(C, subs) {
  const gr = $('grilla'); gr.innerHTML = ''; const q = (UI.q || '').trim().toLowerCase();
  $('cats').querySelectorAll('.cat').forEach((d, i) => d.classList.toggle('sel', !q && i === UI.sub));
  const lista = [];
  if (q) { for (const s of subs) for (const it of s.it) { const D = pillDef(it.slice(5)); if (D && (D.nom + ' ' + it).toLowerCase().includes(q) && !lista.includes(it)) lista.push(it); } }
  else { const S = subs[UI.sub] || subs[0]; if (S) lista.push(...S.it); }
  if (!q && UI.sub === 0) { const inf = document.createElement('div'); inf.className = 'pillInfo'; inf.textContent = T('pill.info'); gr.appendChild(inf); }
  for (const it of lista.slice(0, 400)) {
    const id = it.slice(5), D = pillDef(id); if (!D) continue;
    const d = document.createElement('div'); d.className = 'it pillIt' + (PILL.on && PILL.id === id ? ' sel' : ''); d.dataset.pill = id;
    const niv = pillNivelDe(id);
    const ic = pillRetrato(D);
    d.innerHTML = `<img src="${esc(ic.src)}"${ic.gm ? ` data-gm="${esc(ic.gm)}"` : ''} loading="lazy" alt=""><span dir="auto">${esc(D.nom)}</span>${niv > 1 ? `<em class="pillNv">${esc(T('pill.nv'))} ${niv}</em>` : ''}${D.sinHab ? `<em class="pillSin">${esc(T('pill.basico'))}</em>` : ''}`;
    d.title = D.nom + (D.hab ? ' · ' + D.hab.filter(Boolean).map(pillHabNom).join(', ') : '');
    d.onclick = () => spawnElegir(C.n, it);
    gr.appendChild(d);
  }
  if (!lista.length) gr.innerHTML += `<div class="spVacio">${esc(T('sinRes'))}</div>`;
  // (los íconos de un pack que estaban en el disco: llegan enseguida y se vuelve a dibujar, una vez)
  if (typeof PGM !== 'undefined' && PGM.icoPend) { PGM.icoPend = false; if (!pillGrilla.t) pillGrilla.t = setTimeout(() => { pillGrilla.t = 0; if (UI.abierto === 'spawn' && DATA.menu[UI.tab] && DATA.menu[UI.tab].pill) pillGrilla(C, subs); }, 700); }
}
const _pillGrilla0 = spawnGrilla;
spawnGrilla = function (C, subs) { if (C && C.pill) return pillGrilla(C, subs); return _pillGrilla0.apply(this, arguments); };
const _pillDibujar0 = spawnDibujar;
spawnDibujar = function () {
  const r = _pillDibujar0.apply(this, arguments);
  const C = DATA.menu[UI.tab]; if (C && C.pill) pillPie();
  return r;
};
function pillPie() {
  const pie = $('pie'); if (!pie) return;
  if (PILL.on && PILL.def) {
    pie.innerHTML = `<span class="pillPie">${esc(T('pill.sos').replace('{n}', PILL.def.nom).replace('{l}', pillNivel()))}</span><button class="boton pillVolverBt" id="pillVolverBt">${esc(T('pill.volver'))} (H)</button>`;
    $('pillVolverBt').onclick = () => { pillFin(); cerrarPaneles(); };
  } else pie.innerHTML = `<span class="pillPie">${esc(T('pill.pie'))}</span>`;
}
const _pillElegir0 = spawnElegir;
spawnElegir = function (tab, nombre) {
  if (typeof nombre === 'string' && nombre.startsWith('pill:')) { if (JUEGO.estado === 'juego' && pillAplicar(nombre.slice(5))) cerrarPaneles(); return; }
  return _pillElegir0.apply(this, arguments);
};
const _pillPropNom0 = propNom;
propNom = function (it) { if (typeof it === 'string' && it.startsWith('pill:')) { const D = pillDef(it.slice(5)); return D ? D.nom : it; } return _pillPropNom0.apply(this, arguments); };
// ---------------- lo que no se hace transformado ----------------
// (las armas: el clic es la habilidad 1 y el secundario la 2; la rueda, los números y el botón del arma no cambian de arma)
const _pillArmasPaso0 = armasPaso;
armasPaso = function (dt) {
  if (!PILL.on) return _pillArmasPaso0.apply(this, arguments);
  const a = ENT.disparo, b = ENT.disparo2; ENT.disparo = false; ENT.disparo2 = false; ENT.rueda = 0;
  try { return _pillArmasPaso0.apply(this, arguments); } finally { ENT.disparo = a; ENT.disparo2 = b; }
};
elegirArma = function (i) { if (PILL.on) return; return _pillElegirArma0.apply(this, arguments); };
const _pillDarArma0 = darArma;
darArma = function (n) { if (PILL.on) { aviso(T('pill.sinArmas'), 2.5); return; } return _pillDarArma0.apply(this, arguments); };
// (la mano de la cámara no se dibuja: el personaje no tiene arma)
const _pillVista0 = dibujarVista;
dibujarVista = function () { if (PILL.on) return false; return _pillVista0.apply(this, arguments); };
// (quieto mientras grita)
const _pillJugPaso0 = jugadorPaso;
jugadorPaso = function (dt, ent) { if (PILL.on && PILL.raizT > 0 && ent) ent = PILL_QUIETO; return _pillJugPaso0.call(this, dt, ent); };
// (R es la habilidad 4, no recargar; el número del arma no cambia nada; volver con el botón)
const _pillPulsos0 = atenderPulsos;
atenderPulsos = function () {
  if (ENT.pulsos.length) {
    if (ENT.pulsos.includes('pillVolver')) { if (PILL.on && JUEGO.estado === 'juego') pillFin(); }
    if (PILL.on) ENT.pulsos = ENT.pulsos.filter((k) => !(k === 'recargar' || k === 'siguienteArma' || /^arma\d$/.test(k)));
    ENT.pulsos = ENT.pulsos.filter((k) => k !== 'pillVolver');
  }
  return _pillPulsos0.apply(this, arguments);
};
// la cámara en tercera persona, a la distancia del personaje (los grandes, más lejos)
const _pillCam0 = jugadorCamara, _pillPiv = v3(), _pillArr = v3(0, 1, 0);
jugadorCamara = function (out) {
  const r = _pillCam0.apply(this, arguments), J = JUG;
  if (PILL.on && PILL.def && !J.vehiculo && J.vivo && J.tercera && !((J.emo3K || 0) > 0.001)) {
    // (desde un poco arriba de los ojos, como la cámara de pk_pills: se ve por encima de la cabeza adónde se apunta; bajo un
    // techo, hasta donde entre)
    const d0 = PILL.def.cam || 3.4, dir = vscale(J.adelante, -1), sube0 = 0.3 * clamp(J.tam || 1, 0.5, 1.6), t = mundoRayo(J.ojoPos, _pillArr, sube0 + 0.25), sube = t ? Math.max(0, t.t - 0.25) : sube0;
    _pillPiv.set(J.ojoPos.x, J.ojoPos.y + sube, J.ojoPos.z);
    const h = mundoRayo(_pillPiv, dir, d0 + 0.3), L = h ? Math.max(0.3, h.t - 0.3) : d0;
    out.pos.copy(_pillPiv).addS(dir, L);
  }
  return r;
};
// H: volver a tu personaje (en un vehículo es la bocina, y con el Cíclope su rayo)
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyH' || e.repeat || !PILL.on || JUEGO.estado !== 'juego' || UI.abierto || JUG.vehiculo || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
  if (typeof cicHay === 'function' && cicHay()) return;
  pillFin();
});
// los textos
Object.assign(IDI3, {
  'spt.PillPacks': ['Pill Packs', 'Pill Packs', 'Pill Packs', 'Pill Packs', 'Pill Packs', 'Pill Packs', 'ピルパック', 'Pill Packs', 'Pill Packs', 'حزم الحبوب', 'Пилл-паки', 'Піл-паки', 'Pill Packs', 'Pill Packs'],
  'pill.cat.todos': ['Todos', 'All', 'Todos', 'Semua', 'Semua', 'Lahat', 'すべて', 'ทั้งหมด', 'Tümü', 'الكل', 'Все', 'Усі', 'Tous', 'Alle'],
  'pill.cat.fnaf': ['FNAF', 'FNAF', 'FNAF'],
  'pill.cat.terror': ['Terror', 'Horror', 'Terror', 'Horor', 'Seram', 'Katatakutan', 'ホラー', 'สยองขวัญ', 'Korku', 'رعب', 'Ужасы', 'Жахи', 'Horreur', 'Horror'],
  'pill.cat.accion': ['Acción', 'Action', 'Ação', 'Aksi', 'Aksi', 'Aksiyon', 'アクション', 'แอ็กชัน', 'Aksiyon', 'أكشن', 'Экшен', 'Екшн', 'Action', 'Action'],
  'pill.cat.mas': ['Más personajes', 'More characters', 'Mais personagens', 'Karakter lain', 'Watak lain', 'Iba pang karakter', 'その他のキャラ', 'ตัวละครอื่น', 'Diğer karakterler', 'شخصيات أخرى', 'Другие персонажи', 'Інші персонажі', 'Autres personnages', 'Weitere Figuren'],
  'pill.info': ['Elegí uno y te transformás: su cuerpo, su forma de moverte, su vida y sus habilidades (barra de poder). Volvés a tu personaje con H o con el botón.',
    'Pick one and you transform: its body, how it moves, its health and its abilities (power bar). Go back to your character with H or the button.',
    'Escolha um e você se transforma: o corpo, o jeito de se mover, a vida e as habilidades (barra de poder). Volte ao seu personagem com H ou com o botão.'],
  'pill.pie': ['Elegí un personaje para transformarte.', 'Pick a character to transform into.', 'Escolha um personagem para se transformar.'],
  'pill.sos': ['Sos {n} · nivel {l}', 'You are {n} · level {l}', 'Você é {n} · nível {l}'],
  'pill.ahora': ['Ahora sos {n}', 'You are now {n}', 'Agora você é {n}'],
  'pill.volviste': ['Volviste a tu personaje', 'Back to your character', 'Você voltou ao seu personagem'],
  'pill.volver': ['Volver a tu personaje', 'Back to your character', 'Voltar ao seu personagem'],
  'pill.volverC': ['Volver', 'Back', 'Voltar'],
  'pill.bajando': ['Bajando el personaje…', 'Downloading the character…', 'Baixando o personagem…'],
  'pill.muerto': ['No podés transformarte muerto', 'You can\'t transform while dead', 'Não dá para se transformar morto'],
  'pill.vehiculo': ['Bajate del vehículo para transformarte', 'Get out of the vehicle to transform', 'Saia do veículo para se transformar'],
  'pill.sinPoder': ['Te falta poder', 'Not enough power', 'Falta poder'],
  'pill.lleno': ['Ya tenés toda la vida', 'Your health is already full', 'A vida já está cheia'],
  'pill.sinSuelo': ['No hay piso ahí', 'No floor there', 'Não tem chão aí'],
  'pill.sinArmas': ['Transformado no usás armas: volvé a tu personaje (H)', 'No weapons while transformed: go back to your character (H)', 'Transformado não usa armas: volte ao seu personagem (H)'],
  'pill.nivel': ['¡Nivel {n}!', 'Level {n}!', 'Nível {n}!'],
  'pill.level': ['Nivel', 'Level', 'Nível'],
  'pill.nv': ['Nv', 'Lv', 'Nv'],
  'pill.basico': ['básico', 'basic', 'básico'],
  'pill.poder.fnaf': ['FNAF Power', 'FNAF Power', 'FNAF Power'],
  'pill.poder.miedo': ['Miedo', 'Fear', 'Medo'],
  'pill.poder.ki': ['Ki', 'Ki', 'Ki'],
  'pill.poder.energia': ['Energía', 'Energy', 'Energia'],
  'pill.t.clic': ['Clic', 'Click', 'Clique'],
  'pill.t.clicDer': ['Clic der.', 'R-click', 'Clique dir.'],
  'pill.h.golpe': ['Zarpazo', 'Swipe', 'Garrada'],
  'pill.h.espada': ['Espadazo', 'Slash', 'Espadada'],
  'pill.h.pinia': ['Piña', 'Punch', 'Soco'],
  'pill.h.susto': ['Susto', 'Scare', 'Susto'],
  'pill.h.carrera': ['Carrera', 'Sprint', 'Corrida'],
  'pill.h.cajita': ['Cajita musical', 'Music box', 'Caixinha de música'],
  'pill.h.tele': ['Teletransporte', 'Teleport', 'Teletransporte'],
  'pill.h.curar': ['¡A comer!', 'Let\'s eat!', 'Hora de comer!'],
  'pill.h.embestida': ['Embestida', 'Lunge', 'Investida'],
  'pill.h.salto': ['Supersalto', 'Super jump', 'Super salto'],
  'pill.h.rafaga': ['Ráfaga', 'Blast', 'Rajada'],
  'pill.h.disparo': ['Disparo', 'Shoot', 'Tiro'],
  'pill.h.lua': ['Habilidad', 'Ability', 'Habilidade'],
});
// (el golpe del Pirata, Finn y el Ninja es con espada; el de los que no tienen garras, una piña)
for (const id of ['pirata', 'finn', 'ninja']) { const D = PILL.defs.get(id); if (D && D.hab[0]) D.hab[0].n = 'espada'; }
for (const id of ['goku', 'vegeta', 'broly', 'gohan', 'piccolo', 'robot', 'v1', 'jake', 'astronauta', 'rick', 'alternate', 'filbus', 'partygoer']) { const D = PILL.defs.get(id); if (D && D.hab[0]) D.hab[0].n = 'pinia'; }
