// lo del Discord después de la 3.8:
//  A. «Editar controles» y «Editar arma en la mano» con la interfaz nueva (GOLDEN: «tienen una interfaz muy antigua»): sin
//     el azul viejo, dentro de la pantalla del celular, la X cierra, las pestañas cambian, en el teclado se ven ≥ 6 acciones
//     enteras, la tecla que espera se ve y la lista no salta al elegir; el arma: las barras rellenan desde el cero y mueven
//     el arma; la barra del editor de botones sin hueco;
//  B. aparecer sobre un piso (Ferrari F40: «no tiene spawn y caés al vacío»): un mapa sin aparición, o con la aparición
//     en el aire, aparece parado sobre un piso de verdad (en FlatGrass y en gm_construct, el de GMod);
//  C. la tele de YouTube en la grabación (Chillguy: «negro con rayas»): en el video va la tapa del video donde está la
//     tele, no negro (necesita internet para la tapa de YouTube);
//  D. sin errores de JS.
// uso: node discord_381.mjs URL_HTML [CARPETA_CAPTURAS]
import { abrir } from './base.mjs';
import fs from 'fs';
const D = (process.argv[3] || '.') + '/'; fs.mkdirSync(D, { recursive: true });
const { b, p, err, ev } = await abrir(process.argv[2], true);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 600) : '')); };
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); DIA.hora = 12; DIA.aplicada = -1; 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
await p.waitForTimeout(800);

// ---------------- A. los paneles ----------------
const azul = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c || ''); return !!m && +m[3] > 150 && +m[3] > +m[1] + 60 && +m[3] > +m[2] + 20; };
await ev(`CTL.tab = 'teclas'; ctlAbrir('pausa'); 1`); await p.waitForTimeout(700);
const t1 = await ev(`(() => { const c = $('ctlCaja'), r = c.getBoundingClientRect(), cu = c.querySelector('.ctlCuerpo'), rc = cu.getBoundingClientRect();
  const filas = [...c.querySelectorAll('.ctlFila')].filter((f) => { const q = f.getBoundingClientRect(); return q.top >= rc.top - 1 && q.bottom <= rc.bottom + 1; }).length;
  const fondos = [...c.querySelectorAll('.boton, .ctlFila, .ctlTab.sel')].map((e) => getComputedStyle(e).backgroundColor);
  return { dentro: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, caja: [Math.round(r.width), Math.round(r.height)], filas, total: c.querySelectorAll('.ctlFila').length,
    fondos: [...new Set(fondos)], tabSel: getComputedStyle(c.querySelector('.ctlTab.sel')).boxShadow, x: !!c.querySelector('.ctlX'), radio: getComputedStyle(c).borderRadius }; })()`);
ok('A1. Controles: dentro de la pantalla, sin el azul viejo, esquinas rectas, con X; en el teclado se ven ≥ 6 acciones enteras', t1.dentro && !t1.fondos.some(azul) && t1.radio === '0px' && t1.x && t1.filas >= 6, t1);
await p.screenshot({ path: D + 'c381_ctl_teclado.png' });
// elegir la tecla de una acción de abajo: la lista no vuelve arriba y la que espera se ve
const t2 = await ev(`(async () => { const cu = $('ctlCaja').querySelector('.ctlCuerpo'); cu.scrollTop = cu.scrollHeight; await new Promise((r) => setTimeout(r, 100)); const antes = cu.scrollTop;
  const L = [...$('ctlCaja').querySelectorAll('[data-ctl^="tecla:"]')], bt = L[L.length - 3]; bt.click(); await new Promise((r) => setTimeout(r, 200));
  const cu2 = $('ctlCaja').querySelector('.ctlCuerpo'), es = $('ctlCaja').querySelector('.esperando'), q = es.getBoundingClientRect(), rc = cu2.getBoundingClientRect();
  return { antes, despues: cu2.scrollTop, ve: q.top >= rc.top - 1 && q.bottom <= rc.bottom + 1, txt: es.textContent, fondo: getComputedStyle(es).backgroundColor }; })()`);
ok('A2. elegir una tecla de abajo: la lista se queda donde estaba y la que espera se ve (amarilla)', t2.antes > 0 && Math.abs(t2.despues - t2.antes) < 40 && t2.ve && !azul(t2.fondo), t2);
await p.screenshot({ path: D + 'c381_ctl_espera.png' });
await p.keyboard.press('KeyK'); await p.waitForTimeout(200);
await ev(`CTL.capturando = null; ctlDibujar('tactil'); 1`); await p.waitForTimeout(600);
const t3 = await ev(`(() => { const c = $('ctlCaja'), r = [...c.querySelectorAll('input.pnR')]; return { barras: r.length, rellenas: r.map((x) => x.style.getPropertyValue('--b')), sel: c.querySelector('.ctlTab.sel').dataset.ctl,
  dentro: (() => { const q = c.getBoundingClientRect(); return q.bottom <= innerHeight && q.top >= 0; })() }; })()`);
ok('A3. la pestaña Pantalla táctil: las dos barras con el relleno hasta su valor, dentro de la pantalla', t3.barras === 2 && t3.rellenas.every((x) => /%$/.test(x) && parseFloat(x) > 0) && t3.sel === 'tab:tactil' && t3.dentro, t3);
await p.screenshot({ path: D + 'c381_ctl_tactil.png' });
await ev(`ctlEditar(); 1`); await p.waitForTimeout(600);
const t4 = await ev(`(() => { const b = document.querySelector('#ctlEd .ctlBarra'), tb = b.querySelector('.ctlTamBox'), r = b.getBoundingClientRect(); return { pista: tb.textContent.trim(), sinSel: tb.classList.contains('sinSel'), vis: getComputedStyle(tb).visibility,
  dentro: r.left >= 0 && r.right <= innerWidth, fondos: [...new Set([...b.querySelectorAll('.boton')].map((e) => getComputedStyle(e).backgroundColor))] }; })()`);
ok('A4. el editor de botones: en lugar del hueco, «Tocá un botón para moverlo»; sin el azul viejo', t4.sinSel && t4.vis === 'visible' && t4.pista === (await ev(`T('ctl.tocaBoton')`)) && !t4.fondos.some(azul) && t4.dentro, t4);
await p.screenshot({ path: D + 'c381_editor.png' });
await ev(`ctlSalirEditor(false); 1`); await p.waitForTimeout(300);
const t5 = await ev(`(() => { const a = !$('ctlPanel').classList.contains('oc'); cerrarPaneles(); return { volvio: a, cerro: $('ctlPanel').classList.contains('oc') && !UI.abierto }; })()`);
ok('A7. cancelar el editor vuelve a Controles; cerrar los paneles (la pausa) cierra Controles (antes quedaba en pantalla)', t5.volvio && t5.cerro, t5);
// el arma en la mano
await ev(`(() => { const i = ARM.lista.indexOf('Pistol'); if (i >= 0) elegirArma(i); return 1; })()`); await p.waitForTimeout(700);
await ev(`(PREFS.armaAj || {}).Pistol = undefined; if (PREFS.armaAj) delete PREFS.armaAj.Pistol; armaAjAbrir(); 1`); await p.waitForTimeout(500);
const a0 = await ev(`(() => { const p = $('armaAjPan'), r = p.getBoundingClientRect(); return { dentro: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, alto: Math.round(r.height), arma: p.querySelector('.aaArma').textContent,
  botones: [...p.querySelectorAll('.aaBot .boton')].map((b) => Math.round(b.getBoundingClientRect().height)), fondos: [...new Set([...p.querySelectorAll('.boton')].map((e) => getComputedStyle(e).backgroundColor))], radio: getComputedStyle(p).borderRadius }; })()`);
// mover «Adelante» a +0,5 (6 cm) como lo haría el dedo: el valor, el relleno desde el centro y lo guardado
await ev(`(() => { const r = $('armaAjPan').querySelector('[data-aa="z"]'); r.value = '0.5'; r.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`); await p.waitForTimeout(200);
const a1 = await ev(`(() => { const r = $('armaAjPan').querySelector('[data-aa="z"]'); return { a: r.style.getPropertyValue('--a'), b: r.style.getPropertyValue('--b'), txt: $('armaAjPan').querySelector('[data-aav="z"]').textContent, guardado: PREFS.armaAj && PREFS.armaAj.Pistol && PREFS.armaAj.Pistol.z }; })()`);
ok('A5. Arma en la mano: abajo y dentro de la pantalla (deja ver el arma), sin el azul viejo, botones ≥ 38 px', a0.dentro && a0.alto < 260 && a0.arma && a0.botones.every((h) => h >= 38) && !a0.fondos.some(azul) && a0.radio === '0px', a0);
ok('A6. mover la barra: el relleno va del centro al valor (50 % → 75 %), dice +6 cm y queda guardado', a1.a === '50.00%' && a1.b === '75.00%' && a1.txt === '+6 cm' && Math.abs(a1.guardado - 0.06) < 1e-6, a1);
await p.screenshot({ path: D + 'c381_arma.png' });
await ev(`if (PREFS.armaAj) delete PREFS.armaAj.Pistol; armaAjCerrar(); 1`);

// ---------------- B. aparecer sobre un piso ----------------
const aparecer = async (que) => ev(`(async () => { ${que}; mundoSpawnsValidar(MUNDO.lo, MUNDO.hi); jugadorAparecer(); const s = MUNDO.spawns[0];
  for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 50));
  return { spawn: s && [+s.x.toFixed(1), +s.y.toFixed(1), +s.z.toFixed(1)], ref: MUNDO.spawnRef, techo: +MUNDO.hi.y.toFixed(1), buscado: !!MUNDO.spawnBuscado, malos: MUNDO.spawnsMalos, suelo: !!JUG.suelo, y: +JUG.pos.y.toFixed(2), vy: +JUG.vel.y.toFixed(2), piso: mundoPisoEn(JUG.pos.x, JUG.pos.y, JUG.pos.z, 5) !== null }; })()`);
const b1 = await aparecer(`MUNDO.spawns = [v3(MUNDO.hi.x + 300, 40, MUNDO.hi.z + 300)]`);
ok('B1. FlatGrass con la aparición en el aire (afuera del mapa): busca un piso a la altura del suelo (±3 m) y queda parado', b1.buscado && b1.malos === 1 && b1.suelo && Math.abs(b1.vy) < 1 && b1.piso && Math.abs(b1.spawn[1]) < 3, b1);
const b2 = await aparecer(`MUNDO.spawns = []`);
ok('B2. FlatGrass sin aparición: busca un piso a la altura del suelo (±3 m) y queda parado', b2.buscado && b2.suelo && Math.abs(b2.vy) < 1 && Math.abs(b2.spawn[1]) < 3, b2);
const b3 = await aparecer(`MUNDO.spawns = [v3(3, 0.1, 4)]`);
ok('B3. una aparición buena se respeta (no se busca otra)', !b3.buscado && b3.malos === 0 && b3.spawn[0] === 3 && b3.spawn[2] === 4 && b3.suelo, b3);
// gm_construct (un mapa de GMod de verdad): sin sus apariciones
await ev(`empezarPartida('RB_Construct'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && MUNDO.nombre === 'RB_Construct' && !!JUG.suelo`), null, { timeout: 180000 }).catch(() => {});
await p.waitForTimeout(800);
const orig = await ev(`MUNDO.spawns.map((s) => [+s.x.toFixed(1), +s.y.toFixed(1), +s.z.toFixed(1)])`);
const b4 = await aparecer(`MUNDO.spawns = []`); b4.orig = orig.slice(0, 2);
ok('B4. gm_construct sin apariciones: aparece parado en el suelo más común del mapa (±1 m; el pasto), lejos del techo del mundo, sin caer', b4.buscado && b4.suelo && Math.abs(b4.vy) < 1 && b4.piso && Math.abs(b4.spawn[1] - b4.ref) <= 1 && b4.spawn[1] < b4.techo - 20, b4);
await ev(`JUG.tercera = false; JUG.pitch = 0; 1`); await p.waitForTimeout(500); await p.screenshot({ path: D + 'c381_construct_sin_spawn.png' });
await ev(`empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && MUNDO.nombre === 'FlatGrass' && !!JUG.suelo`), null, { timeout: 120000 });
await p.waitForTimeout(800);

// ---------------- C. la tele en la grabación ----------------
await ev(`(() => { entidadPonerMod('pantalla', true); radioCerrar(); const e = ENTS.lista.find((x) => x.t === 'pantalla' && x.dueno === 'yo'); e.b.frozen = true; window.__T = e;
  const n = e.b.q.rot(v3(0, 0, -1)); JUG.pos.set(e.b.pos.x + n.x * 4, JUG.pos.y, e.b.pos.z + n.z * 4); JUG.vel.set(0, 0, 0); JUG.yaw = Math.atan2(-n.x, -n.z); JUG.pitch = 0.05;
  radioPoner(e, 'dQw4w9WgXcQ', 0, 'prueba', true); pantTapa('dQw4w9WgXcQ'); return 1; })()`);
let c0 = null; for (let i = 0; i < 25; i++) { await p.waitForTimeout(600); c0 = await ev(`({ vis: !!TELE.pp, tapa: !!(TELE.tapas.get('dQw4w9WgXcQ') || {}).im })`); if (c0.vis && c0.tapa) break; }
await ev(`GRAB.ult = null; window.__grabSinDescarga = 1; PREFS.grab = { cal: '720', fps: 30, hud: true }; grabEmpezar()`);
await p.waitForTimeout(3000);
const c1 = await ev(`(() => { const g = GRAB.g, W = GRAB.W, H = GRAB.H; if (!g || !TELE.pp) return { g: !!g, pp: !!TELE.pp };
  const cv = R.cv, k = Math.min(W / cv.width, H / cv.height), w = cv.width * k, h = cv.height * k, ox = (W - w) / 2, oy = (H - h) / 2, kx = w / TELE.ppW, ky = h / TELE.ppH;
  const P = TELE.pp.map(([x, y]) => [ox + x * kx, oy + y * ky]), cx = P.reduce((a, q) => a + q[0], 0) / 4, cy = P.reduce((a, q) => a + q[1], 0) / 4;
  const d = g.getImageData(Math.round(cx - 20), Math.round(cy - 12), 40, 24).data; let s = 0, cols = new Set(); for (let i = 0; i < d.length; i += 4) { s += d[i] + d[i + 1] + d[i + 2]; cols.add((d[i] >> 5) + ',' + (d[i + 1] >> 5) + ',' + (d[i + 2] >> 5)); }
  return { tapas: GRAB.tapas || 0, brillo: Math.round(s / (d.length / 4) / 3), colores: cols.size, centro: [Math.round(cx), Math.round(cy)], url: GRAB.cv.toDataURL('image/jpeg', 0.85) }; })()`);
if (c1 && c1.url) fs.writeFileSync(D + 'c381_cuadro_grabado.jpg', Buffer.from(c1.url.split(',')[1], 'base64'));
ok('C1. grabando: donde está la tele va la tapa del video (no negro: brillo > 25 y varios colores)', c0.vis && c0.tapa && c1.tapas > 10 && c1.brillo > 25 && c1.colores >= 4, { c0, tapas: c1.tapas, brillo: c1.brillo, colores: c1.colores });
await ev(`grabParar && grabParar(); 1`).catch(() => {});
await p.waitForTimeout(800);

// ---------------- E. la postura, más barata y igual ----------------
const e1 = await ev(`(() => {
  const res = [];
  for (const sk of ['Hero', 'Zombie', 'Gman']) {
    const P = crearPersona(sk, 'HatEmpty', { nombre: 'x' }); P.pos.set(JUG.pos.x + 3, JUG.pos.y, JUG.pos.z); P.vel.set(0, 0, 0); P.suelo = true; P.lejos = true; animarPersona(P, 0.016); P.lejos = false;   // (la pose sin la corrección: de chiquito no se corrige)
    const md = P.md, H = P.hum, r0 = md.r.map((r) => r.slice());
    // (la de antes: girarMundo hueso por hueso)
    const viejo = () => { const h = P.D.h; md.sucio = true; md.actualizar(); const L = md.W[h.LeftArm], R = md.W[h.RightArm]; _hpR.set(R[12] - L[12], 0, R[14] - L[14]); const n = Math.hypot(_hpR.x, _hpR.z); _hpR.x /= n; _hpR.z /= n; _hpF.set(_hpR.z, 0, -_hpR.x);
      const k = H.posK, tor = humPosturaLean(md, h.Hips, h.Neck), dT = Math.min(HUM_POST.max, Math.max(0, tor - HUM_POST.torso)) * k; if (dT > 1e-3) for (const [nom, f] of [['Spine', 0.4], ['Spine1', 0.3], ['Spine2', 0.3]]) girarMundo(P, nom, _hpR, dT * f);
      md.actualizar(); const cab = humPosturaLean(md, h.Neck, h.Head), dC = Math.min(HUM_POST.max, Math.max(0, cab - HUM_POST.cabeza)) * k; if (dC > 1e-3) { girarMundo(P, 'Neck', _hpR, dC); girarMundo(P, 'Head', _hpR, -dC * 0.5); } md.actualizar(); };
    md.sucio = true; md.actualizar(); const Wcrudo = md.W.map((w) => Array.from(w));
    H.posK = 1; md.r.forEach((r, i) => r0[i].forEach((v, j) => (r[j] = v))); viejo(); const Wv = md.W.map((w) => Array.from(w));
    md.r.forEach((r, i) => r0[i].forEach((v, j) => (r[j] = v))); md.sucio = true; let n = 0; const a0 = md.actualizar; md.actualizar = function () { if (this.sucio) n++; return a0.call(this); };
    H.posK = 1; H.postMedir = false; humPostura(P, H, 1); md.actualizar = a0; md.actualizar(); let dif = 0; md.W.forEach((w, i) => { for (let j = 12; j < 15; j++) dif = Math.max(dif, Math.abs(w[j] - Wv[i][j])); });
    const h = P.D.h; res.push({ sk, difMm: +(dif * 1000).toFixed(3), rehace: n, cabeza: [+(humPosturaLean0(r0) * 57.3).toFixed(1), +(humPosturaLean(md, h.Neck, h.Head) * 57.3).toFixed(1)] }); borrarPersona(P);
    function humPosturaLean0() { const W = Wcrudo; return Math.atan2((W[h.Head][12] - W[h.Neck][12]) * _hpF.x + (W[h.Head][14] - W[h.Neck][14]) * _hpF.z, W[h.Head][13] - W[h.Neck][13]); }
  }
  return res; })()`);
ok('E1. la postura da lo mismo que antes (los huesos a < 0,1 mm), corrige la cabeza (de > 25° a ≤ 16°) y rehace el esqueleto como mucho 2 veces por persona, antes hasta 7 (Hero, zombi, Gman)', e1.every((x) => x.difMm < 0.1 && x.rehace <= 2 && x.cabeza[0] > 25 && x.cabeza[1] <= 16), e1);
ok('D. sin errores de JS', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|youtube|ytimg|googlevideo|tienda/i.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|youtube|ytimg|googlevideo/i.test(e)).slice(0, 5));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
