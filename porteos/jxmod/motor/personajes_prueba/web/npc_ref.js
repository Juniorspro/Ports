// la referencia de la web para los NPC: npc.js de verdad (con nucleo.js, fisica.js, mundo.js, jugador.js y geo.js) corrido
// en Node sobre un mundo de prueba hecho de cajas, con el jugador quieto y el azar con semilla (mulberry32, el mismo de
// jxjuego::persona::Azar). Escribe cada cuadro dónde está cada NPC y lo que pasó (daño al jugador, tiros, lo que dice),
// lo mismo que examples/npc_comparar.rs, para compararlos con npc_comparar.py.
// Uso: node npc_ref.js ESCENA.json SALIDA.json
const fs = require('fs'), vm = require('vm'), path = require('path');
const J = path.join(__dirname, '../../../juego/');
const esc = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const nada = () => {};
const elem = () => ({ getContext: () => null, style: {}, classList: { add: nada, remove: nada, toggle: nada }, remove: nada, appendChild: nada, textContent: '' });
const ctx = { console, Math: Object.create(Math), JSON, Float32Array, Float64Array, Uint8Array, Int16Array, Int32Array, Uint16Array, Uint32Array, Map, Set, WeakMap, Object, Array, Number, String, DataView, TextEncoder, Date, isFinite, Promise, Symbol, Error,
  window: {}, document: { getElementById: () => elem(), createElement: elem, addEventListener: nada, querySelector: () => null }, location: { search: '', href: 'file:///x', protocol: 'file:' },
  matchMedia: () => ({ matches: false }), navigator: {}, performance: { now: () => 0 }, localStorage: { getItem: () => null, setItem: nada }, addEventListener: nada, setTimeout: nada, URLSearchParams, WebAssembly };
// (el azar con semilla)
{ let a = esc.semilla >>> 0; ctx.Math.random = () => { let t = a = (a + 0x6D2B79F5) >>> 0; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
vm.createContext(ctx);
for (const f of ['nucleo.js', 'fisica.js', 'mundo.js', 'jugador.js', 'geo.js', 'npc.js']) vm.runInContext(fs.readFileSync(J + f, 'utf8'), ctx, { filename: f });
// lo de armas.js que usa npc.js (DEF_ARMAS con los sonidos de HL2 de armasHL2, azarDe) y rayoJugador de red.js
const sacar = (src, re) => { const L = src.split('\n'), i = L.findIndex((l) => re.test(l)); let j = i + 1; while (!/^\};?\s*$/.test(L[j])) j++; return L.slice(i, j + 1).join('\n'); };
const armas = fs.readFileSync(J + 'armas.js', 'utf8'), red = fs.readFileSync(J + 'red.js', 'utf8');
vm.runInContext(sacar(armas, /^const DEF_ARMAS = \{/) + '\n' + armas.split('\n').find((l) => /^const azarDe =/.test(l)) + '\n' + red.split('\n').find((l) => /^const limpio =/.test(l)) + '\n' + sacar(red, /^function rayoJugador\(/), ctx);
ctx.HL2 = esc.hl2 || {};
vm.runInContext(`
for (const [a, x] of Object.entries(HL2)) if (DEF_ARMAS[a] && x.sF) DEF_ARMAS[a].sF = x.sF;
var DATA = { chars: ['Hero'], emotes: ${JSON.stringify(['Clap', 'Disagree', 'Hi', 'ChickenDance', 'Sitting', 'Scream', 'Kick', 'Victory', 'FightIdle', 'AirSquat', 'Techno', 'Bencao', 'Twerk', 'Flair', 'Backflip'])} };
var TIEMPO = { t: 0, dt: 1 / 60, lento: 0 }, CAM = { pos: v3(0, 0, 0) }, RED = { on: false, ID: null, remotos: new Map() }, JUEGO = { estado: 'juego', dios: false }, CIC = {}, MODS = {}, UI = {};
var PERS = [], EV = [];
var etiquetaMover = () => {}, clipDe = () => null, aviso = () => {}, humAccion = () => {}, sonVoz = () => {};
var emoValido = (e) => typeof e === 'string' && (e === 'Patada' || DATA.emotes.includes(e));
var sonar = (n, p, v, t) => EV.push([+TIEMPO.t.toFixed(4), 'son', n]);
var efectoImpacto = (p, n, k) => EV.push([+TIEMPO.t.toFixed(4), 'imp', k]); var efectoTraza = () => {};
var danarJugador = (dan, de) => { if (!JUG.vivo) return; JUG.vida -= dan; EV.push([+TIEMPO.t.toFixed(4), 'danJ', +dan.toFixed(4)]); };
var ragdoll = (P) => { P.rag = { cuerpos: new Map() }; }, ragdollFin = (P) => { P.rag = null; };
var crearPersona = (skin) => { const P = { skin, pos: v3(), yaw: 0, vel: v3(), suelo: true, emote: null, emoteT: 0, vivo: true, rag: null, vida: 100, tam: 1, mira: 0, D: { h: {} }, md: { W: [] } }; PERS.push(P); return P; };
// (danarPersona de personas.js para los NPC, sin el Lua, la voz ni el gesto)
var danarPersona = (P, dan, pos, d) => { if (P === JUG.cuerpo) { danarJugador(dan, pos); return; } if (P.vivo) { P.vida -= dan; EV.push([+TIEMPO.t.toFixed(4), 'danN', P.npcId, +dan.toFixed(4)]);
  if (P.vida <= 0) { P.vivo = false; P.emote = null; ragdoll(P); P.muertoT = 15; } else if (dan >= 40 && !P.rag) npcTumbar(P, vscale(d.clone().norm(), Math.min(10, dan * 0.15)), dan); } };
`, ctx);
// el mundo: las caras de las cajas (dos triángulos por cara, en el orden de npc_comparar.rs)
vm.runInContext(`(() => {
  const C = ${JSON.stringify(esc.cajas)}, T = [];
  for (const [x0, y0, z0, x1, y1, z1] of C) {
    const q = (a, b, c, d) => T.push(...a, ...b, ...c, ...a, ...c, ...d);
    q([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]); q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
    q([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]); q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]); q([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
  }
  MUNDO.T = new Float32Array(T); MUNDO.nt = MUNDO.T.length / 9; MUNDO.ntMapa = MUNDO.nt; MUNDO.TN = new Float32Array(MUNDO.nt * 3);
  MUNDO.grilla = new Map(); MUNDO.aristasCel = new Map(); MUNDO.sub = new Map(); MUNDO.triCuerpo = []; MUNDO.cajas = [];
  const lo = v3(1e9, 1e9, 1e9), hi = v3(-1e9, -1e9, -1e9), M = MUNDO.T;
  for (let t = 0; t < MUNDO.nt; t++) {
    const o = t * 9, ux = M[o + 3] - M[o], uy = M[o + 4] - M[o + 1], uz = M[o + 5] - M[o + 2], vx = M[o + 6] - M[o], vy = M[o + 7] - M[o + 1], vz = M[o + 8] - M[o + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; MUNDO.TN[t * 3] = nx / l; MUNDO.TN[t * 3 + 1] = ny / l; MUNDO.TN[t * 3 + 2] = nz / l;
    grillaAgregar(Math.min(M[o], M[o + 3], M[o + 6]), Math.min(M[o + 2], M[o + 5], M[o + 8]), Math.max(M[o], M[o + 3], M[o + 6]), Math.max(M[o + 2], M[o + 5], M[o + 8]), t);
    for (let k = 0; k < 3; k++) { lo.x = Math.min(lo.x, M[o + k * 3]); lo.y = Math.min(lo.y, M[o + k * 3 + 1]); lo.z = Math.min(lo.z, M[o + k * 3 + 2]); hi.x = Math.max(hi.x, M[o + k * 3]); hi.y = Math.max(hi.y, M[o + k * 3 + 1]); hi.z = Math.max(hi.z, M[o + k * 3 + 2]); }
  }
  MUNDO.lo.copy(lo); MUNDO.hi.copy(hi); MUNDO.gravedad = 1; PH.gscale = 1;
})()`, ctx);
// el jugador (quieto) y los NPC
ctx.ESC = esc;
const out = vm.runInContext(`(() => {
  const j = ESC.jug || { pos: [0, 0.95, 0] };
  JUG.pos.set(j.pos[0], j.pos[1], j.pos[2]); JUG.vivo = j.vivo !== false; JUG.vida = 1e6; JUG.cuerpo = crearPersona('Hero'); JUG.cuerpo.pos = JUG.pos; JUG.agCol = !!j.agachado;
  CAM.pos.set(j.pos[0], j.pos[1] + 0.7, j.pos[2]);
  const L = ESC.npcs.map((n) => { const a = n.act ? (n.rapida ? Object.assign({ decir: [] }, NPC_RAPIDA_ACT[n.rapida], n.act) : n.act) : (n.rapida ? Object.assign({ decir: [] }, NPC_RAPIDA_ACT[n.rapida]) : {}); const P = npcCrear('Hero', v3(n.p[0], n.p[1], n.p[2]), n.yaw || 0, Object.assign({}, a, { de: 'yo' }));
    // (npcCuerpo deja la cápsula en el origen hasta el primer cuadro: acá va con el NPC, como en el port)
    P.npcB.pos.copy(P.pos); P.npcB.updateWorld(); return P; });
  const dt = Math.fround(ESC.dt || 1 / 60), R = { cuadros: [], ev: EV };   // (el mismo dt que recibe el port, en float)
  const _decir = npcDecir; npcDecir = (P, t, red) => { EV.push([+TIEMPO.t.toFixed(4), 'decir', P.npcId, t]); _decir(P, t, red); };
  for (let k = 0; k < ESC.cuadros; k++) {
    TIEMPO.t += dt; TIEMPO.dt = dt;
    npcPaso(dt);
    R.cuadros.push(L.map((P) => [P.pos.x, P.pos.y, P.pos.z, P.yaw, P.vida, P.emote || '', P.suelo ? 1 : 0]));
  }
  return R; })()`, ctx);
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log('cuadros', out.cuadros.length, 'eventos', out.ev.length);
