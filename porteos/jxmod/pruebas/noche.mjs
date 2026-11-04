// la noche en la pizzería, solo: menú, intro, la llamada y "Silenciar", noche 1 tranquila, la IA de las noches 4 y 6 (con y
// sin defenderse), energía, Game Over y "Reintentar" (todo de cero), las 6 AM y el progreso guardado. La lógica corre con el
// tiempo simulado (el navegador de prueba dibuja muy lento). Las fotos de la linterna se miden aparte (noche_luz.py).
// uso: node noche.mjs HTML CARPETA
import { abrir } from './base.mjs';
const HTML = process.argv[2], S = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(HTML);
const J = async (s) => JSON.parse(await ev(`JSON.stringify(${s})`));
let ok = 0, mal = 0; const chk = (c, t) => { console.log((c ? 'OK  ' : 'MAL ') + t); c ? ok++ : mal++; };
await ev(`PREFS.bienvenida = true; PREFS.lang = 'es'; PREFS.vol = 80; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); audioIniciar(); inicioMostrar(false); empezarPartida('RB_Pizzeria');
  // tiempo simulado: la noche avanza dt por paso; "defensa" cierra la puerta del lado donde hay alguien en la esquina
  window.__sim = (seg, dt, defensa) => { const n = Math.round(seg / dt); for (let i = 0; i < n; i++) { TIEMPO.t += dt;
    if (defensa && NOC.estado === 'juega') {
      for (const lado of ['izq', 'der']) { const cam = (TIEMPO.t % 8) < 1.2, hay = NOC.anim.some((A) => (A.estado === 'esquina' && (A.k !== 'F' || cam) || (A.k === 'X' && A.estado === 'corre')) && NOC_PUERTA[A.k] === lado); if (hay !== NOC.puerta[lado]) nocheBoton('puerta', lado); }
      // (como un jugador: cada 8 s mira Pirate Cove un segundo, así Foxy no sale)
      const c = (TIEMPO.t % 8) < 1; if (c && NOC.cam === null) { UI.abierto = null; nocheTablet(); nocheCamElegir(2); } else if (!c && NOC.cam !== null) nocheTablet();
    }
    nochePaso(dt); if (window.__alParar && window.__alParar()) break; } return NOC.estado; };
  window.__salas = () => NOC.anim.map((A) => A.sala); 1`);
await p.waitForTimeout(3000);
// ---- el menú (solo) ----
let m = await J(`{on: NOC.on, estado: NOC.estado, abierto: UI.abierto, menu: !NOC.ui.menu.classList.contains('oc'), botones: [...NOC.ui.menu.querySelectorAll('button')].map(b => b.dataset.n), oficina: enOficina(JUG.pos)}`);
console.log('menú', JSON.stringify(m));
chk(m.on && m.estado === 'menu' && m.menu && m.abierto === 'fnmenu' && m.botones.join() === '1', 'al entrar solo: el menú de noches (sólo "Nueva partida" la primera vez)');
chk(m.oficina, 'aparece en la oficina');
await p.screenshot({ path: S + 'n_menu.png' });
await p.click('#fnMenu button[data-n="1"]'); await p.waitForTimeout(500);
m = await J(`{estado: NOC.estado, noche: NOC.noche, tapa: !NOC.ui.tapa.classList.contains('oc'), menu: !NOC.ui.menu.classList.contains('oc'), abierto: UI.abierto}`);
chk(m.estado === 'intro' && m.noche === 1 && m.tapa && !m.menu, 'Nueva partida: noche 1 con la tapa "12:00 AM" ' + JSON.stringify(m));
await ev(`__sim(4.5, 0.05)`);
for (let i = 0; i < 20 && !(await J(`!!NOC.llamada`)); i++) await p.waitForTimeout(500);   // (arranca 1,5 s después, cuando termina de decodificarse)
m = await J(`{estado: NOC.estado, llamada: !!NOC.llamada, boton: !NOC.ui.mudo.classList.contains('oc'), abierto: UI.abierto}`);
console.log('a jugar', JSON.stringify(m));
chk(m.estado === 'juega' && !m.abierto, 'después de la tapa se juega (sin nada abierto)');
chk(m.llamada && m.boton, 'suena la llamada de la noche 1 con el botón "Silenciar llamada"');
await p.click('#fnMudo'); await p.waitForTimeout(300);
m = await J(`{llamada: !!NOC.llamada, mudo: NOC.mudo, boton: !NOC.ui.mudo.classList.contains('oc')}`);
chk(!m.llamada && m.mudo && !m.boton, '"Silenciar llamada" la corta');
// ---- noche 1: hasta las 2 no se mueve nadie (como en FNAF 1: a las 2 se activa Bonnie; a las 3 y 4, Bonnie, Chica y Foxy) ----
await ev(`window.__alParar = () => NOC.hora >= 1.98 || NOC.estado !== 'juega'; __sim(89 * 2, 0.1)`);
m = await J(`{hora: +NOC.hora.toFixed(2), salas: __salas(), niveles: NOC_K.map(nocheNivel)}`);
chk(m.salas.join() === 'escenario,escenario,escenario,pirata' && m.niveles.join() === '0,0,0,0', 'noche 1: hasta las 2 AM nadie se mueve (niveles ' + m.niveles + ')');
// y defendiéndose (cerrar la puerta cuando hay alguien en la esquina) se llega a las 6 con energía
await ev(`window.__alParar = () => NOC.estado !== 'juega'; __sim(89 * 4 + 2, 0.1, true)`);
m = await J(`{estado: NOC.estado, poder: +NOC.poder.toFixed(1), fuera: NOC.fuera.size, max: nochePref('max'), niveles: NOC_K.map(nocheNivel)}`);
console.log('noche 1', JSON.stringify(m));
chk(m.estado === 'gano' && !m.fuera, 'noche 1 defendida: se llega a las 6 AM');
chk(m.poder > 30, 'energía al terminar la noche 1: ' + m.poder + ' %');
chk(m.max === 2, 'progreso guardado: la noche 2 desbloqueada');
await ev(`window.__alParar = null; __sim(10, 0.1)`);
m = await J(`{estado: NOC.estado, noche: NOC.noche}`);
chk(m.estado === 'intro' && m.noche === 2, 'después de las 6 sigue la noche 2');
// ---- noche 4 defendiéndose (cerrar la puerta cuando hay alguien en la esquina): recorren salas y no entran ----
await ev(`nocheEmpezarNoche(4); __sim(4.5, 0.05); window.__vis = NOC.anim.map(() => new Set()); window.__alParar = () => { NOC.anim.forEach((A, i) => __vis[i].add(A.sala)); return NOC.estado !== 'juega'; }; __sim(89 * 6 + 2, 0.1, true)`);
m = await J(`{estado: NOC.estado, poder: +NOC.poder.toFixed(1), hora: +NOC.hora.toFixed(2), vis: __vis.map(s => [...s]), fuera: NOC.fuera.size, golpes: NOC.golpes}`);
console.log('noche 4 defendida', JSON.stringify(m));
chk(m.estado === 'gano' || m.hora >= 5.5, 'noche 4 jugada como en FNAF (puertas cuando hace falta, mirar Pirate Cove): ' + (m.estado === 'gano' ? 'se llega a las 6 con ' + m.poder + ' %' : 'sin energía a las ' + m.hora + ' h') + ' (golpes de Foxy: ' + m.golpes + ')');
chk(m.vis[1].length >= 3 && m.vis[2].length >= 3, 'noche 4: Bonnie y Chica recorren salas (' + m.vis[1].join('/') + ' · ' + m.vis[2].join('/') + ')');
chk(!m.vis.some((s) => s.includes('oficina')) || m.estado === 'apagon' || m.estado === 'perdiendo' || m.estado === 'perdio', 'con las puertas cerradas a tiempo nadie entra (salvo sin energía)');
// ---- noche 6 sin defenderse: alguien entra y agarra; Game Over; Reintentar: todo de cero ----
await ev(`window.__alParar = () => NOC.estado === 'perdio'; nocheEmpezarNoche(6); __sim(4.5, 0.05); __sim(89 * 6, 0.1, false)`);
m = await J(`{estado: NOC.estado, hora: +NOC.hora.toFixed(2), go: !NOC.ui.go.classList.contains('oc'), botones: [...NOC.ui.go.querySelectorAll('button')].map(b => b.dataset.r), abierto: UI.abierto, fuera: NOC.fuera.size}`);
console.log('noche 6 sin defenderse', JSON.stringify(m));
chk(m.estado === 'perdio' && m.go && m.botones.join() === '1,0' && m.abierto === 'fngo', 'noche 6 sin cerrar puertas: te agarran a las ' + m.hora + ' h y sale Game Over con Reintentar y Menú');
await p.waitForTimeout(3000); await p.screenshot({ path: S + 'n_gameover.png' });
await p.click('#fnGo button[data-r="1"]'); await p.waitForTimeout(400);
m = await J(`{estado: NOC.estado, noche: NOC.noche, hora: NOC.hora, poder: NOC.poder, fuera: NOC.fuera.size, salas: __salas(), go: !NOC.ui.go.classList.contains('oc'), abierto: UI.abierto, oficina: enOficina(JUG.pos), puertas: [NOC.puerta.izq, NOC.puerta.der], susto: !!NOC.susto}`);
console.log('reintentar', JSON.stringify(m));
chk(m.estado === 'intro' && m.noche === 6 && m.hora === 0 && m.poder === 100 && !m.fuera && !m.go && !m.susto, 'Reintentar: la misma noche de cero (hora, energía, nadie agarrado)');
chk(m.salas.join() === 'escenario,escenario,escenario,pirata' && m.oficina && !m.puertas[0] && !m.puertas[1], 'Reintentar: animatrónicos en su lugar, vos en la oficina, puertas abiertas');
// ---- botones: no andan con alguien adentro; el apagón ----
await ev(`__sim(4.5, 0.05); NOC.poder = 0.05; window.__alParar = () => NOC.estado !== 'juega'; __sim(2, 0.1)`);
m = await J(`{estado: NOC.estado, puertas: [NOC.puerta.izq, NOC.puerta.der]}`);
chk(m.estado === 'apagon' && !m.puertas[0] && !m.puertas[1], 'sin energía: apagón, puertas abiertas');
await ev(`window.__alParar = () => NOC.estado === 'perdio'; __sim(60, 0.1)`);
m = await J(`{estado: NOC.estado, freddy: NOC.anim[0].sala}`);
chk(m.estado === 'perdio' && m.freddy === 'esqO', 'apagón: viene Freddy por la puerta izquierda con la cajita de música y Game Over');
// ---- menú: Continuar desde la noche guardada ----
await p.click('#fnGo button[data-r="0"]'); await p.waitForTimeout(400);
m = await J(`{estado: NOC.estado, botones: [...NOC.ui.menu.querySelectorAll('button')].map(b => b.dataset.n), abierto: UI.abierto, max: nochePref('max')}`);
chk(m.estado === 'menu' && m.botones.join() === '1,' + Math.min(5, m.max) && m.abierto === 'fnmenu', 'Menú: "Nueva partida" y "Continuar · Noche ' + Math.min(5, m.max) + '" (la más alta ganada: ' + (m.max - 1) + ')');
// ---- Esc con el menú abierto: pausa encima y al cerrarla vuelve el menú ----
const espera = async (cond) => { for (let i = 0; i < 20 && !(await J(cond)); i++) await p.waitForTimeout(250); };   // (a 2 cuadros por segundo)
await ev(`ENT.pulsos.push('pausa'); 0`); await espera(`UI.abierto === 'pausa'`);
const pa = await J(`{abierto: UI.abierto, pausa: !$('pausa').classList.contains('oc')}`);
await ev(`ENT.pulsos.push('pausa'); 0`); await espera(`UI.abierto === 'fnmenu'`);
const pb = await J(`{abierto: UI.abierto, menu: !NOC.ui.menu.classList.contains('oc')}`);
chk(pa.abierto === 'pausa' && pa.pausa && pb.abierto === 'fnmenu' && pb.menu, 'Esc abre la pausa encima del menú de noches y al cerrarla vuelve el menú ' + JSON.stringify([pa, pb]));
// ---- no se pueden poner cosas mientras corre la noche ----
await p.click('#fnMenu button[data-n="1"]'); await ev(`__sim(4.5, 0.05)`);
const puso = await J(`!!spawnDelante('Barrel')`);
chk(!puso, 'durante la noche no se pueden poner props');
console.log('errores:', err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
console.log(`resultado: ${ok} bien, ${mal} mal`);
await b.close();
