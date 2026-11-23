// Corre el multijugador de verdad de la web (juego/red.js, y lo de la red de anfitrion.js y npc.js) en Node, con un
// broker MQTT de mentira en memoria (retenidos, testamentos, comodines) y dos o tres juegos web en la misma sala. De «yo»
// se graba todo lo que entra (los pasos, con sus relojes, y los mensajes que le llegan) y todo lo que hace (conexiones,
// suscripciones, publicaciones, pedidos HTTP, lo que le pasa y cómo ve a los demás): eso es tests/red_web.json, que
// tests/red.rs repite con red.rs y compara (lo publicado, byte por byte).
// Uso: node motor/juego/tests/red_ref.js [SALIDA.json[.gz]]     (por defecto, tests/red_web.json.gz)
//      node motor/juego/tests/red_ref.js --rust PUBLICADO.json   (lo que publicó red.rs en la escena «basica»: se le da a
//        un juego web y se imprime cómo lo ve; red.rs lo compara con cómo ve la web al «yo» de la web)
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const J = path.resolve(__dirname, '../../../juego');
const leer = (f) => fs.readFileSync(path.join(J, f), 'utf8');
// (una función de arriba de un archivo, por su nombre: de una línea o hasta la '}' sola)
function sacar(txt, nombre) {
  const L = txt.split('\n'), i = L.findIndex((l) => l.startsWith('function ' + nombre + '('));
  if (i < 0) throw new Error('no está ' + nombre);
  const cuenta = (s) => (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
  if (cuenta(L[i]) === 0) return L[i];
  let j = i + 1; while (!/^\}\s*$/.test(L[j])) j++;
  return L.slice(i, j + 1).join('\n');
}
const NUC = leer('nucleo.js').split('\n'), n0 = NUC.findIndex((l) => l.startsWith('const clamp')), n1 = NUC.findIndex((l) => l.startsWith('// matrices 4x4'));
const ANF = leer('anfitrion.js'), NPCJ = leer('npc.js');
const NUCLEO = NUC.slice(n0, n1 - 1).join('\n');
const CODIGO = [
  leer('red.js'),
  'const HOST = { ds: false, ultCfg: 0 };',
  ...['soyAnfitrion', 'hostCfg', 'hostPublicar', 'recibirCfg', 'hostPaso', 'hostHecho'].map((n) => sacar(ANF, n)),
  ...['npcRedMandar', 'npcRecibir', 'npcRemQuitar', 'npcRemotosPaso'].map((n) => sacar(NPCJ, n)),
].join('\n');

// ---------------- el mundo: el reloj y el broker ----------------
const W = { real: 1000, epoca: 1.7e12, cli: [], ret: new Map(), cola: [] };
const coincide = (f, t) => { const a = f.split('/'), b = t.split('/'); for (let i = 0; i < a.length; i++) { if (a[i] === '#') return true; if (i >= b.length || (a[i] !== '+' && a[i] !== b[i])) return false; } return a.length === b.length; };
function brokerPub(t, m, retain) {
  if (retain) { if (m === '') W.ret.delete(t); else W.ret.set(t, m); }
  for (const c of W.cli) if (c.vivo && c.subs.some((f) => coincide(f, t))) W.cola.push({ c, t, m, retain: false });
}

// ---------------- un juego web (un contexto aparte, con todo lo que red.js usa) ----------------
const PRELUDIO = `
var window = globalThis; var Q = new URLSearchParams(''); var matchMedia = () => ({ matches: false });
var MAPAS = ['Desert', 'DesertV2', 'FlatGrass', 'City', 'Base', 'BaseV2', 'Mars', 'Space'], MAPAS_RB = ['RB_Llanura', 'RB_Colinas', 'RB_Isla', 'RB_Ciudad', 'RB_Desierto', 'RB_Luna', 'RB_Pizzeria', 'RB_Construct', 'RB_Flatgrass'];
const mapaValido = (m) => typeof m === 'string' && (MAPAS.includes(m) || MAPAS_RB.includes(m));
var TIENDA_URL = 'https://rezobox-tienda.holasoyjuniors365.workers.dev/api/';
var TIEMPO = { t: 0, dt: 0 };
var performance = { now: () => __W.real * 1000 }; Date.now = () => __W.epoca;
let __az = __semilla; Math.random = () => { __az = (__az * 1103515245 + 12345) % 2147483648; return __az / 2147483648; };
const __tienda = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
var sessionStorage = __tienda(), localStorage = __tienda();
var __timers = []; function setTimeout(f) { __timers.push(f); return __timers.length; } function clearTimeout() {}
var __ev = []; var __ops = [];
var mqtt = { connect(url, o) { return __conectar(url, o); } };
function fetch(url, o) {
  o = o || {}; let res, rej; const p = new Promise((a, b) => { res = a; rej = b; });
  const i = __fetch.length + 1; __fetch.push({ res, rej });
  __ops.push(['http', i, o.method || 'GET', url, o.body === undefined ? null : o.body, Object.entries(o.headers || {})]); return p;
}
var __fetch = [];
var PREFS = { nombre: 'Jugador', skin: 'Hero', gorro: 'HatEmpty', gorroAj: 0, acc: 0, mapa: 'RB_Flatgrass' };
var JUG = { pos: v3(), vel: v3(), yaw: 0, pitch: 0, suelo: true, vivo: true, vehiculo: null, asiento: 0, vida: 100, reloj: 0, cuerpo: { emote: null }, radio: 0.4, medio: 0.5, noclip: false, esf: [] };
var ENT = { agachar: false }; var ARM = { lista: ['PhysicsGun'], i: 0 };
var NAT = { scp: false, up: v3(0, 1, 0) }; var __bits = 0;
const natBits = () => __bits & 112, nocheBits = () => __bits & 384, linternaBits = () => 0;
var __mu = 0, __vr = 0, __pl = 0, __ent = [], __kw = 0;
const emuRed = () => __mu, verRedEstado = () => __vr, pillRed = () => __pl, entidadesMias = () => __ent;
const gmAddonDe = () => ({ id: __kw });
var SOC = { yo: { pid: '' } };
var SMOD = { ids: new Set() };
var OBJS = [];
var MUNDO = { nombre: 'RB_Flatgrass', lo: null, hi: null, spawns: [], gravedad: 1 };
var DIA = { hora: 12, ciclo: false, aplicada: 0 };
var JUEGO = { estado: 'juego' }; var GMM = { actual: null };
var CEL = { echados: new Set() }; const celMeEcharon = () => false;
var DATA = { chars: ['Hero', 'Noob', 'Zombie'], hats: ['HatEmpty', 'Cowboy'], pfPorNombre: { Crate: 'Crate#1', Barrel: 'Barrel#1', Melon: 'Melon#1' } };
const DEF_ARMAS = { Pistol: { sF: ['P1'] }, RPG: { sF: ['R1'] }, PhysicsGun: {}, Crowbar: { tipo: 'golpe', alcance: 2, sF: ['C1'] } };
const NPC_ARMAS = ['Pistol', 'RPG'], NPC_TIRO = { Pistol: { cad: 0.3 }, RPG: { cad: 1 } };
var NPC = { lista: [], sig: 1, rem: new Map(), redT: 0, max: 24 };
var PH = { bodies: [] }; var CAM = { pos: v3() }; var R = { vp: new Float32Array(16) }; const VW = () => 800, VH = () => 600;
var RBP = { alListo: [] }; const GRAV = 9.81;
const EMO_ID = /^u:[a-z0-9-]{3,30}$/; const emoValido = (e) => typeof e === 'string' && ['Baile', 'Saludo', 'Patada'].includes(e);
const __nada = () => {}; const rbListo = () => true, rbDeSkin = (s) => s, rbPedir = () => {};
const vozApagar = __nada, vozBotonPoner = __nada, smBotonPoner = __nada, smCerrar = __nada, vozCerrar = __nada, vozSenal = __nada, natRemoto = __nada, natRed = __nada, sonEmote = __nada, sonar = __nada, emoPedir = __nada;
const verRemoto = __nada, verRed = __nada, cicRed = __nada, maqVivoRed = __nada, nukeRed = __nada, maqRed = __nada, memeRed = __nada, chatCambiar = __nada, juntosRed = __nada, bocinaRed = __nada, turboRed = __nada, celEchadoRed = __nada, artRed = __nada, emoRed = __nada, nocheRed = __nada, entidadHecho = __nada;
const efectoImpacto = __nada, efectoTraza = __nada, humAccion = __nada, azarDe = (l) => l[0], esferaFuera = __nada, empujarDeCuerpo = __nada, npcGloboPaso = __nada, npcDecir = (P, t) => __ev.push(['npcdi', P.npcRem ? P.npcRem.o + '/' + P.npcRem.n : null, t]), danarPersona = (P) => __ev.push(['npcdan', P.npcId, 0]), npcTumbar = (P) => __ev.push(['npcdan', P.npcId, 1]), npcActNormal = (a) => a || {};
const removeBody = __nada, addBody = __nada, borrarPersona = __nada, capsuleShape = () => ({}), ragdoll = (P) => { P.rag = true; }, ragdollFin = (P) => { P.rag = false; };
const aviso = __nada, rbAviso = (t) => __ev.push(['aviso', t]), menuAviso = __nada, T = (k) => k, Lc = (a, b) => b, esc = (s) => s, icoHTML = () => '', censurar = (s) => s;
const irMenuPrincipal = () => { __ev.push(['menu']); redSalir(); SALA = null; };
const spawnDibujar = __nada; const guardarPrefs = __nada, inicioMostrar = __nada; var entrarConCarga = (n, m) => __ev.push(['carga', m]); var UI = { abierto: null }; const diaAplicar = __nada;
const smDeOtro = __nada; const entidadesRecibir = (id, e) => __ev.push(['entidades', id, JSON.stringify(e)]); const entidadesDe = __nada;
const maqDeMundo = (o, x) => __ev.push(['maq', o.key, JSON.stringify(x)]);
const maqAlMundo = (o) => o.__maq || 0;
var __npcTiro = false; const npcBoca = (P) => { __npcTiro = true; return P.pos.clone(); };
// (los tiros de otro: el rayo de 300 m de recibirHecho; los de sus NPC: npcBoca; los demás rayos son del lugar donde aparecer)
const raycast = (o, d, L) => { if (__npcTiro || L === 300) __ev.push([__npcTiro ? 'npctiro' : 'tiro', [o.x, o.y, o.z], [d.x, d.y, d.z]]); __npcTiro = false; return null; };
function explosion(p, r, d) { __ev.push(['exp', [p.x, p.y, p.z], r, d, explosion.fuente ? (explosion.fuente.remoto ? explosion.fuente.key : 'propio:' + explosion.fuente.id) : null]); }
const danarJugador = (d) => __ev.push(['dano', d]);
var PERS = { includes: () => true };
const document = { createElement: () => ({ style: {}, remove() {}, innerHTML: '', className: '' }) };
const $ = (id) => (id === 'hud' ? { appendChild() {} } : null);
const chatMostrar = (n, t, id, de) => __ev.push(['chat', n, t, id === undefined ? null : id, de === undefined ? null : de]);
const crearPersona = (skin, gorro, o) => ({ skin, gorro, nombre: o && o.nombre, pos: v3(), vel: v3(), yaw: 0, mira: 0, rag: false, visible: true });
class Body { constructor() { this.pos = v3(); this.q = new Quat(); this.vel = v3(); this.ang = v3(); } updateWorld() {} wake() {} }
function crearObjeto(nombre, p, q, o) {
  const b = new Body(); b.pos.copy(p); b.q.copy(q); b.frozen = !!(o && o.congelado);
  const ob = { id: 0, nombre, b, md: {}, dueno: (o && o.dueno) || 'yo' }; OBJS.push(ob); __ev.push(['obj+', ob.dueno, nombre]); return ob;
}
function borrarObjeto(o, local) {
  if (!local && typeof redBorrar === 'function') redBorrar(o);
  const i = OBJS.indexOf(o); if (i >= 0) OBJS.splice(i, 1);
  if (!o.borrado) __ev.push(o.remoto ? ['obj-', o.key] : ['prop-', o.id]);
  o.borrado = true;
}
`;
function nuevoJuego(nombre, semilla, id) {
  const ctx = { __W: W, __semilla: semilla, console, URLSearchParams };
  // (las promesas de este juego se resuelven al terminar cada llamada: el fetch de mentira contesta en el mismo paso)
  vm.createContext(ctx, { microtaskMode: 'afterEvaluate' });
  ctx.__conectar = (url, o) => {
    const c = { url, o, h: {}, subs: [], vivo: false, con: o.clientId.startsWith('jxmod_v1_l_') ? 'lista' : 'sala', juego: ctx,
      on(ev, f) { (this.h[ev] = this.h[ev] || []).push(f); return this; }, emit(ev, ...a) { for (const f of this.h[ev] || []) f(...a); },
      subscribe(t) { ctx.__ops.push(['sub', this.con, t]); this.subs.push(t); for (const [k, m] of W.ret) if (coincide(t, k)) W.cola.push({ c: this, t: k, m, retain: true }); },
      unsubscribe(t) { ctx.__ops.push(['unsub', this.con, t]); this.subs = this.subs.filter((x) => x !== t); },
      publish(t, m, op) { ctx.__ops.push(['pub', this.con, t, String(m), !!(op && op.retain)]); if (this.vivo) brokerPub(t, String(m), !!(op && op.retain)); },
      end() { ctx.__ops.push(['end', this.con]); this.vivo = false; this.fin = true; } };
    W.cli.push(c);
    ctx.__ops.push(['conn', c.con, url, o.clientId, o.keepalive, o.reconnectPeriod, o.connectTimeout, o.clean, o.will.topic, o.will.payload, o.will.retain]);
    return c;
  };
  vm.runInContext('var window = globalThis; var matchMedia = () => ({ matches: false });\n' + NUCLEO + PRELUDIO + CODIGO + `
    RED.ID = ${JSON.stringify(id)}; PREFS.nombre = ${JSON.stringify(nombre)};
    // (un error en red.js —un stub que falta— se avisa: el manejador de mensajes lo callaría)
    { const rm = redMensaje; redMensaje = (t, m) => { try { rm(t, m); } catch (e) { console.error('ERROR en redMensaje', RED.ID, t, e.stack.split(String.fromCharCode(10)).slice(0, 3).join(' | ')); } }; }
    var __objs = new Map();
    // lo del juego en este cuadro (lo mismo que Local de red.rs)
    function __local(L) {
      if (!L) return;
      const j = L.jug;
      if (j) {
        PREFS.skin = j.skin; PREFS.gorro = j.gorro; PREFS.gorroAj = j.gorro_aj ? JSON.parse(j.gorro_aj) : 0; PREFS.acc = j.acc ? JSON.parse(j.acc) : 0;
        __kw = j.skin_wid || 0; NAT.scp = !!j.arriba; if (j.arriba) NAT.up = v3(...j.arriba); JUG.colorRol = j.color || 0;
        JUG.pos = v3(...j.pos); JUG.yaw = j.yaw; JUG.pitch = j.pitch; JUG.vel = v3(...j.vel); JUG.suelo = j.suelo; ENT.agachar = j.agachado; JUG.vivo = j.vivo; __bits = j.bits;
        ARM.lista = j.arma ? [j.arma] : []; ARM.i = 0; JUG.cuerpo = { emote: j.emote || null }; JUG.vida = j.vida;
        __mu = j.musica ? JSON.parse(j.musica) : 0; __vr = j.verity ? JSON.parse(j.verity) : 0; __pl = j.pill ? JSON.parse(j.pill) : 0;
        JUG.vehiculo = j.vehiculo ? (j.vehiculo[0].startsWith(RED.ID + ':') ? OBJS.find((o) => !o.remoto && o.id === +j.vehiculo[0].slice(RED.ID.length + 1)) : buscarObjeto(j.vehiculo[0])) || null : null; JUG.asiento = j.vehiculo ? j.vehiculo[1] : 0;
        SOC.yo.pid = j.social || ''; JUG.reloj = j.reloj;
      }
      if (L.objs) {
        const vistos = new Set(), lista = [];
        for (const x of L.objs) {
          let o = __objs.get(x.id); if (!o) { o = { id: x.id, nombre: x.nombre, b: new Body(), md: {}, dueno: 'yo' }; __objs.set(x.id, o); }
          // (una mía que simula otro: la mueve red.js —redCedidosPaso—, congelada; el juego no la toca)
          if (!(o.auth && o.auth !== RED.ID)) { o.b.pos.set(...x.pos); o.b.q.set(...x.q); o.b.sleep = x.duerme; o.b.frozen = x.congelado; }
          o.__maq = x.maq ? JSON.parse(x.maq) : 0; o.gmEnt = x.no_mundo ? { nb: 1 } : null;
          vistos.add(x.id); lista.push(o);
        }
        for (const [k, o] of __objs) if (!vistos.has(k)) __objs.delete(k);
        // (las de otros quedan en OBJS, como en el juego)
        OBJS = [...lista, ...OBJS.filter((o) => o.remoto)];
      }
      for (const s of L.simulo || []) { const o = RED.objs.get(s.clave); if (o) { o.b.pos.set(...s.pos); o.b.q.set(...s.q); o.b.sleep = s.duerme; } }
      NPC.lista = (L.npcs || []).map((p) => ({ npcId: p.id, skin: p.skin, pos: v3(...p.pos), yaw: p.yaw, vel: v3(...p.vel), suelo: !!(p.f & 1), rag: !!(p.f & 2), vivo: !(p.f & 4), act: { hostil: !!(p.f & 8), modo: p.f & 16 ? 'defender' : '' }, gmOculto: !!(p.f & 32), emote: p.emote, arma: p.arma, ia: { tirosRed: p.tiros, miraRed: p.mira ? v3(...p.mira) : null } }));
      __ent = L.entidades ? JSON.parse(L.entidades) : []; SMOD.ids = new Set(L.mods ? JSON.parse(L.mods) : []);
    }
    function __paso(dt, L) {
      TIEMPO.t += dt; TIEMPO.dt = dt; __local(L);
      redPaso(dt); hostPaso();
      npcRemotosPaso(dt); if (RED.on && NPC.lista.length && (NPC.redT -= dt) <= 0) { NPC.redT = 0.15; npcRedMandar(); }
    }
    function __timersCorrer() { while (__timers.length) __timers.shift()(); }
    function __cosa(clave) { return clave.startsWith(RED.ID + ':') ? OBJS.find((o) => !o.remoto && o.id === +clave.slice(RED.ID.length + 1)) : RED.objs.get(clave); }
    // cómo veo a los demás y sus cosas (lo que red.rs compara con tolerancia)
    function __estado() {
      const r = (v) => [v.x, v.y, v.z], q4 = (q) => [q.x, q.y, q.z, q.w];
      return {
        on: RED.on, sala: SALA ? SALA.id : null, room: RED.ROOM,
        remotos: [...RED.remotos.values()].map((R2) => ({ id: R2.id, nombre: R2.nombre, pos: r(R2.pos), yaw: R2.yaw, mira: R2.P.mira, vel: r(R2.P.vel), suelo: !!R2.P.suelo, f: R2.f, hp: R2.hp, skin: R2.skin, gorro: R2.gorro, arma: R2.P.arma || null, veh: R2.veh ? [R2.veh.k, R2.veh.a] : null, globo: R2.globo || null })),
        objs: [...RED.objs.values()].filter((o) => !o.borrado).map((o) => ({ clave: o.key, nombre: o.nombre, dueno: o.dueno, auth: o.auth, pos: r(o.b.pos), q: q4(o.b.q), cong: !!o.congReal })),
        cedidos: [...(RED.cedidos || [])].map((o) => ({ id: o.id, pos: r(o.b.pos), q: q4(o.b.q) })),
        auth: OBJS.filter((o) => !o.remoto && o.auth).map((o) => [o.id, o.auth]),
        npcs: [...NPC.rem.entries()].map(([k, E]) => ({ clave: k, pos: r(E.P.pos), yaw: E.P.yaw, f: E.f })),
        lista: listaSalas().map((e) => ({ id: e.S.id, n: e.S.n, j: e.j })),
        cfg: { hora: DIA.hora, ciclo: DIA.ciclo, ds: HOST.ds },
      };
    }
  `, ctx);
  return ctx;
}

// ---------------- las escenas ----------------
// (el estado de mi jugador, como Jugador de red.rs)
const jug = (o) => Object.assign({ skin: 'Hero', skin_wid: null, gorro: 'HatEmpty', gorro_aj: '', acc: '', arriba: null, color: null, pos: [0, 1, 0], yaw: 0, pitch: 0, vel: [0, 0, 0], suelo: true, agachado: false, vivo: true, bits: 0, arma: 'PhysicsGun', emote: null, vida: 100, musica: '', verity: '', pill: '', vehiculo: null, social: null, reloj: 0 }, o);
function escena(nombre, f) {
  W.cli = []; W.ret = new Map(); W.cola = []; W.real = 1000; W.epoca = 1.7e12;
  const E = { nombre, pasos: [], ops: [], ev: [], estados: [], otros: [] };
  const yo = { ctx: null };
  // un paso de «yo»: se graba y se juntan sus ops y lo que le pasó
  const grabar = (p, hacer) => {
    p.real = W.real; p.epoca = W.epoca; const i = E.pasos.length; E.pasos.push(p);
    const c = yo.ctx; c.__ops.length = 0; c.__ev.length = 0;
    hacer(); vm.runInContext('__timersCorrer()', c);
    for (const o of c.__ops) E.ops.push([i, ...o]);
    for (const e of c.__ev) E.ev.push([i, ...e]);
    return i;
  };
  const S = {
    yo(nombre, semilla, id) { yo.ctx = nuevoJuego(nombre, semilla, id); E.id = id; E.jug_nombre = nombre; return yo.ctx; },
    otro(nombre, semilla, id) { return nuevoJuego(nombre, semilla, id); },
    tiempo(dt) { W.real += dt; W.epoca += dt * 1000; },
    // (en el contexto c: si es «yo», se graba)
    hacer(c, p, codigo, args) {
      const correr = () => { c.__args = args; vm.runInContext(codigo, c); };
      if (c === yo.ctx) return grabar(p, correr);
      c.__ops.length = 0; correr(); vm.runInContext('__timersCorrer()', c);
    },
    entrar(c, sala, forma, clave, antes) {
      if (antes) vm.runInContext(`localStorage.setItem('jx_red_lugar', JSON.stringify({ s: ${JSON.stringify(sala.id)}, m: MUNDO.nombre, id: ${JSON.stringify(antes)}, p: [0, 1, 0], y: 0, v: 0, t: Date.now() - 60000 }))`, c);
      S.hacer(c, { k: 'entrar', sala, forma, clave: clave === undefined ? null : clave, antes: antes || null }, `{ const S = __args.sala; let clave = __args.clave === null ? undefined : __args.clave; const mia = salasMias()[S.id]; if (S.pw && clave === undefined && mia && mia.pw) clave = mia.pw; SALA = Object.assign({}, S, { clave: clave || '' }); redEntrar(S.m); }`, { sala, clave });
    },
    // (se conecta: el broker le dice que sí)
    conecta(c, con) {
      const cl = W.cli.filter((x) => x.juego === c && x.con === con && !x.fin).pop(); cl.vivo = true;
      S.hacer(c, { k: 'conecta', con }, `__cli.emit('connect')`, null, c.__cli = cl);
    },
    // (se corta sin despedirse: el broker publica su testamento)
    corta(c, con) {
      const cl = W.cli.filter((x) => x.juego === c && x.con === con && !x.fin).pop(); cl.vivo = false;
      brokerPub(cl.o.will.topic, cl.o.will.payload, cl.o.will.retain);
      S.hacer(c, { k: 'corta', con }, `__cli.emit('close')`, null, c.__cli = cl);
    },
    // (lo que está en camino llega)
    entregar() {
      const cola = W.cola; W.cola = [];
      for (const x of cola) {
        if (!x.c.vivo) continue; const c = x.c.juego; c.__cli = x.c;
        S.hacer(c, { k: 'msg', con: x.c.con, t: x.t, m: x.m }, `__cli.emit('message', __args.t, __args.m)`, { t: x.t, m: x.m });
      }
    },
    paso(c, dt, L) { S.tiempo(dt); S.hacer(c, Object.assign({ k: 'paso', dt }, L), `__paso(__args.dt, __args)`, Object.assign({ dt }, L)); },
    // un cuadro de todos: el tiempo pasa una vez y cada uno da su paso; después llega lo que se mandó
    cuadro(dt, juegos) { S.tiempo(dt); for (const [c, L] of juegos) S.hacer(c, Object.assign({ k: 'paso', dt }, L), `__paso(__args.dt, __args)`, Object.assign({ dt }, L)); S.entregar(); },
    accion(c, p, codigo) { S.hacer(c, p, codigo, p); },
    estado(c) { const i = S.hacer(c, { k: 'estado' }, '__e = __estado()'); E.estados.push([i, c.__e]); },
    // cómo ve otro juego web a «yo»
    vista(c) { vm.runInContext('__e = __estado()', c); E.otros.push([E.pasos.length - 1, c.__e]); },
    // (contesta el pedido HTTP número i —'ultimo': el último—)
    http(c, i, cuerpo) { if (i === 'ultimo') i = vm.runInContext('__fetch.length', c); S.hacer(c, { k: 'http', i, cuerpo }, `__fetch[__args.i - 1].res({ json: async () => JSON.parse(__args.cuerpo) })`, { i, cuerpo }); },
  };
  return f(S).then(() => { const c = yo.ctx; E.mias = vm.runInContext("localStorage.getItem('rb_salas_mias')", c); return E; });
}
const espera = () => new Promise((r) => setImmediate(r));
const SALA_FLAT = { id: 'f_RB_Flatgrass_1', n: 'JXMod Flatgrass', m: 'RB_Flatgrass', mo: 'Free', of: 1, pvp: 1, rpg: 1, nb: 1, mp: 1000, mv: 40 };
const caja = (id, pos, q, o) => Object.assign({ id, nombre: 'Crate', pos, q: q || [0, 0, 0, 1], duerme: false, congelado: false, maq: '', no_mundo: false }, o);

// 1) la básica: entrar a la sala oficial con otro jugador de la web; moverse, poner, mover y borrar cosas, chat, tiros,
// explosiones, daño, reclamar cosas de los dos lados, irse
async function basica(S) {
  const yo = S.yo('Nativo', 11, 'n4t1v0abc'), web = S.otro('Webero', 22, 'w3b0x9zz1');
  S.entrar(web, SALA_FLAT, 'oficial'); S.conecta(web, 'lista'); S.conecta(web, 'sala'); S.entregar();
  // (el de la web ya está y tiene sus cosas)
  const cosasWeb = [caja(1, [5, 0.5, 5]), Object.assign(caja(2, [8, 0.5, 2], [0, 0.3826834, 0, 0.9238795]), { nombre: 'Barrel', congelado: true })];
  for (let k = 0; k < 30; k++) S.cuadro(1 / 30, [[web, { jug: jug({ pos: [3, 1, 3], reloj: 5 + k / 30 }), objs: cosasWeb }]]);
  S.entrar(yo, SALA_FLAT, 'oficial'); S.conecta(yo, 'lista'); S.conecta(yo, 'sala'); S.entregar();
  let mis = [];
  for (let k = 0; k < 150; k++) {
    const t = k / 30;
    // yo camino en círculo; el de la web camina en línea y empuja su caja
    const yoJ = jug({ pos: [Math.cos(t) * 4, 1, Math.sin(t) * 4], yaw: t, pitch: -0.1, vel: [-Math.sin(t) * 4, 0, Math.cos(t) * 4], reloj: 100 + t, arma: k < 60 ? 'PhysicsGun' : 'Pistol', color: '#ff8800' });
    const webJ = jug({ pos: [3 + t * 2, 1, 3], yaw: 1.5, vel: [2, 0, 0], reloj: 6 + t, skin: 'Noob', gorro: 'Cowboy', arma: 'RPG' });
    if (k === 20) { mis = [caja(1, [0, 0.5, 2])]; }
    if (k === 20) S.accion(yo, { k: 'objeto' }, 'redObjeto()');
    if (k > 20 && k < 60) mis = [caja(1, [0, 0.5 + (k - 20) * 0.05, 2], [0, Math.sin((k - 20) * 0.02), 0, Math.cos((k - 20) * 0.02)])];
    if (k >= 60) mis = [caja(1, [0, 2.45, 2], [0, Math.sin(0.78), 0, Math.cos(0.78)], { duerme: true })];
    if (k >= 70 && k <= 120) mis.push(Object.assign(caja(2, [1, 0.5, 1]), { nombre: 'Melon', maq: '["g1","Pong",3,"n4t1v0abc"]' }));
    if (k === 70) S.accion(yo, { k: 'objeto' }, 'redObjeto()');
    const webObjs = [caja(1, [5 + Math.min(t, 2), 0.5, 5], [0, Math.sin(t * 0.1), 0, Math.cos(t * 0.1)], { duerme: t > 2 }), cosasWeb[1]];
    if (k > 115) webObjs.shift();
    if (k > 132) mis = mis.filter((o) => o.id !== 1);
    // (la caja mía que agarró el de la web: la mueve su física)
    const simulo = k >= 90 && k < 110 ? [{ clave: 'n4t1v0abc:1', pos: [0.5 + (k - 90) * 0.1, 2.45, 2], q: [0, Math.sin(0.78 + (k - 90) * 0.05), 0, Math.cos(0.78 + (k - 90) * 0.05)], duerme: false }] : [];
    S.cuadro(1 / 30, [[yo, { jug: yoJ, objs: mis }], [web, { jug: webJ, objs: webObjs, simulo }]]);
    if (k === 40) { S.accion(yo, { k: 'chat', t: 'hola, soy nativo', id: 'm1' }, 'redChat(__args.t, __args.id)'); S.accion(web, { k: 'chat' }, "redChat('hola <b>nativo</b> & cía', 'x9')"); }
    if (k === 50) { S.accion(yo, { k: 'tiro', a: 'Pistol', o: [1.25, 1.6, 0.5], d: [0, 0, 1] }, 'miraOjo = () => v3(...__args.o); miraDir = () => v3(...__args.d); redDisparo(__args.a)'); S.accion(web, { k: 'tiro' }, "miraOjo = () => v3(5, 1.6, 3); miraDir = () => v3(-0.6, 0, 0.8); redDisparo('RPG')"); }
    if (k === 55) S.accion(web, { k: 'dano' }, "redDano({ remoto: 'n4t1v0abc' }, 33.6, v3(0.5, 0.1, -0.8))");
    if (k === 56) S.accion(yo, { k: 'dano', to: 'w3b0x9zz1', d: 12.4, v: [1, 0, 0] }, 'redDano({ remoto: __args.to }, __args.d, v3(...__args.v))');
    if (k === 80) S.accion(yo, { k: 'recarga' }, 'redRecarga()');
    if (k === 90) S.accion(web, { k: 'reclamar' }, "redReclamar(buscarObjeto('n4t1v0abc:1'))");
    if (k === 95) S.accion(yo, { k: 'reclamar', o: 'w3b0x9zz1:2' }, 'redReclamar(__cosa(__args.o))');
    if (k === 100) S.estado(yo);
    if (k === 110) S.accion(yo, { k: 'reclamar', o: 'n4t1v0abc:1' }, 'redReclamar(__cosa(__args.o))');
    if (k === 115) S.accion(web, { k: 'exp' }, "redExplosion(v3(5, 0.5, 5), 6, 100, buscarObjeto('w3b0x9zz1:1'))");
    if (k === 120) { S.accion(yo, { k: 'exp', p: [1, 0.5, 1], r: 4.5, d: 80, o: 'n4t1v0abc:2' }, 'redExplosion(v3(...__args.p), __args.r, __args.d, __cosa(__args.o))'); mis = mis.filter((o) => o.id !== 2); }
    if (k === 125) S.accion(yo, { k: 'borrar', o: 'w3b0x9zz1:2' }, 'borrarObjeto(__cosa(__args.o))');
    if (k === 130) S.accion(web, { k: 'borrar' }, "borrarObjeto(buscarObjeto('n4t1v0abc:1'))");
    if (k % 25 === 0) { S.estado(yo); S.vista(web); }
  }
  S.estado(yo); S.vista(web);
  // el de la web se va bien (chau) y yo me quedo solo; después me voy yo
  S.accion(web, { k: 'salir' }, 'redSalir()'); S.entregar();
  S.cuadro(1 / 30, [[yo, { jug: jug({ reloj: 200 }), objs: [] }]]); S.estado(yo);
  S.accion(yo, { k: 'salir' }, 'redSalir()'); S.entregar(); S.estado(yo);
}

// 2) la interpolación: el otro manda a 10 por segundo con huecos y variación, cae, salta de lugar (un portal); uno de una
// versión vieja (sin rt); y uno que se corta (su testamento borra sus cosas y a los 10 s se va)
async function interpolar(S) {
  const yo = S.yo('Nativo', 33, 'n4t1v0abc');
  const web = S.otro('Rapido', 44, 'r4p1d0001'), viejo = S.otro('Viejo', 55, 'v13j000x1');
  S.entrar(yo, SALA_FLAT, 'oficial'); S.conecta(yo, 'sala'); S.entregar();
  S.entrar(web, SALA_FLAT, 'oficial'); S.conecta(web, 'sala'); S.entregar();
  S.entrar(viejo, SALA_FLAT, 'oficial'); S.conecta(viejo, 'sala'); S.entregar();
  // (el viejo no manda rt: se lo saca antes de publicar)
  vm.runInContext("const __pub0 = publicar; publicar = (c, o, r) => { if (c === 'e') delete o.rt; __pub0(c, o, r); }", viejo);
  let t = 0;
  for (let k = 0; k < 240; k++) {
    const dt = k % 7 === 3 ? 0.05 : 1 / 60; t += dt;
    const x = t < 2 ? t * 5 : t < 2.5 ? 10 : 40 + (t - 2.5) * 3, y = t > 1 && t < 1.8 ? 1 + 4 * (t - 1) - 5 * (t - 1) * (t - 1) : 1;
    S.tiempo(dt);
    S.hacer(yo, { k: 'paso', dt, jug: jug({ pos: [0, 1, 0], reloj: t }), objs: [] }, `__paso(__args.dt, __args)`, { dt, jug: jug({ pos: [0, 1, 0], reloj: t }), objs: [] });
    S.hacer(web, {}, `__paso(__args.dt, __args)`, { dt, jug: jug({ pos: [x, y, 2], vel: [t < 2 ? 5 : 3, 0, 0], suelo: !(t > 1 && t < 1.8), yaw: t, reloj: 50 + t * 0.97 }), objs: [caja(7, [x, 0.5, 4])] });
    if (t < 3) S.hacer(viejo, {}, `__paso(__args.dt, __args)`, { dt, jug: jug({ pos: [-x, 1, -2], vel: [-5, 0, 0], yaw: -t, reloj: 0 }), objs: [caja(3, [-1, 0.5, -1])] });
    // (la red: a veces se atrasa un poco)
    if (k % 11 !== 5) S.entregar();
    if (k === 200) S.corta(viejo, 'sala');
    if (k % 20 === 0) S.estado(yo);
  }
  S.entregar(); S.estado(yo);
  for (let k = 0; k < 12; k++) { S.paso(yo, 1, { jug: jug({ reloj: t + k }), objs: [] }); S.entregar(); }
  S.estado(yo);
}

// 3) la lista de salas: la presencia de otros (en la oficial, en una creada, en una con clave), la tienda, pedirla otra vez
async function lista(S) {
  const yo = S.yo('Nativo', 66, 'n4t1v0abc');
  const a = S.otro('Ana', 77, 'ana000001'), b = S.otro('Beto', 88, 'beto00002');
  S.accion(yo, { k: 'lista' }, 'listaConectar()'); S.conecta(yo, 'lista'); S.entregar();
  const creada = { id: 'k3j4h5g6', n: 'La de Ana', m: 'RB_Construct', mw: '', mo: 'PvP', of: 0, rg: 1, pvp: 1, rpg: 0, nb: 1, mp: 300, mv: 10, pw: 1, ph: 'abc123', du: 'ana000001', dn: 'Ana', vivo: 1.7e12 - 5000 };
  S.entrar(a, creada, 'limpia', 'secreto'); S.conecta(a, 'lista'); S.conecta(a, 'sala'); S.entregar();
  S.entrar(b, SALA_FLAT, 'oficial'); S.conecta(b, 'lista'); S.conecta(b, 'sala'); S.entregar();
  S.estado(yo);
  S.accion(yo, { k: 'salas' }, 'salasCargar()');
  S.http(yo, 'ultimo', JSON.stringify({ ahora: 1.7e12 + 2500, vacia: 600000, salas: [Object.assign({}, creada, { creada: 1.7e12 - 9e5 }), { id: 'vacia001', n: 'Vacía <3', m: 'Inexistente', mo: 'Free', pvp: 0, rpg: 1, nb: 0, mp: 9999, mv: -3, pw: 0, ph: '', du: 'zz', dn: 'Zeta', vivo: 1.7e12 - 1000 }, { id: 'vieja001', n: 'Vieja', m: 'RB_Flatgrass', vivo: 1.7e12 - 7e5 }] }));
  S.estado(yo);
  // (b se va: su presencia se borra)
  S.accion(b, { k: 'salir' }, 'redSalir()'); S.entregar(); S.estado(yo);
  // (una presencia rota, una de otro mapa y una vacía)
  brokerPub('jxmod_v1_l/rot0', '{', true); brokerPub('jxmod_v1_l/xx', JSON.stringify({ s: SALA_FLAT, j: 'Corto', t: 1 }), true);
  brokerPub('jxmod_v1_l/mapa0001', JSON.stringify({ s: { id: 'otra0001', n: '  Otra\u0007 ', m: 'WS_Mapa', mw: '12345', mo: 'Free' }, j: 'Mapero', t: 1.7e9 }), true);
  S.entregar(); S.estado(yo);
  S.accion(yo, { k: 'pedir_lista' }, 'listaPedir()'); S.entregar(); S.estado(yo);
}

// 4) el anfitrión: crea un server con contraseña (la tienda lo guarda), entra, manda su configuración (y cada 20 s), el
// que entra con la contraseña la recibe; echa a uno y limpia el mapa; borra el server
async function anfitrion(S) {
  const yo = S.yo('Nativo', 99, 'n4t1v0abc'), inv = S.otro('Invitado', 111, 'inv1t4d00');
  S.accion(yo, { k: 'lista' }, 'listaConectar()'); S.conecta(yo, 'lista'); S.entregar();
  S.accion(yo, { k: 'crear', c: { n: 'Mi server', pw: 'secreto', m: 'RB_Construct', mo: 'Free', pvp: 0, rpg: 1, nb: 1, mp: 500, mv: 20 } },
    "RBM = {}; RB = { srv: {} }; cuentaPedir = undefined; crearServidor(__args.c)");
  // (la tienda contesta que el id ya está la primera vez y que sí la segunda, con el id que se propuso)
  S.http(yo, 'ultimo', JSON.stringify({ error: 'id usado' }));
  S.http(yo, 'ultimo', '__ID__');
  S.accion(yo, { k: 'empezar' }, "MUNDO.nombre = 'RB_Construct'; redEntrar(SALA.m)");
  S.conecta(yo, 'sala'); S.entregar();
  for (let k = 0; k < 10; k++) S.cuadro(0.1, [[yo, { jug: jug({ reloj: k / 10 }), objs: [caja(1, [0, 0.5, 0])] }]]);
  // el invitado entra con la contraseña
  const sala = vm.runInContext('Object.assign({}, SALA, { clave: undefined, vivo: undefined })', yo);
  delete sala.clave; delete sala.vivo; const salaL = Object.assign({}, sala, { mw: '' });
  S.entrar(inv, salaL, 'limpia', 'secreto'); S.conecta(inv, 'sala'); S.entregar();
  S.accion(yo, { k: 'cfg', hora: 18.0625, ciclo: true, ds: true }, 'DIA.hora = __args.hora; DIA.ciclo = __args.ciclo; HOST.ds = __args.ds; hostPublicar()');
  for (let k = 0; k < 230; k++) S.cuadro(0.1, [[yo, { jug: jug({ reloj: 1 + k / 10 }), objs: [caja(1, [0, 0.5, 0])] }], [inv, { jug: jug({ pos: [2, 1, 2], reloj: k / 10 }), objs: [] }]]);
  S.vista(inv); S.estado(yo);
  S.accion(yo, { k: 'limpiar' }, "publicar('a', { k: 'limpiar' })"); S.entregar();
  S.accion(yo, { k: 'echar', to: 'inv1t4d00' }, "publicar('a', { k: 'kick', to: __args.to })"); S.entregar();
  S.cuadro(0.1, [[yo, { jug: jug({ reloj: 30 }), objs: [caja(1, [0, 0.5, 0])] }]]); S.estado(yo);
  S.accion(yo, { k: 'borrar_srv' }, 'confirm = () => true; borrarServidor(SALA)');
  S.http(yo, 'ultimo', JSON.stringify({ ok: true }));
  S.estado(yo);
}

// 5) de invitado en un server con contraseña: el tema con la clave, la configuración del anfitrión (y su mapa), me echa
async function invitado(S) {
  const host = S.otro('Dueño', 123, 'du3n00001'), yo = S.yo('Nativo', 124, 'n4t1v0abc');
  const sala = { id: 'q1w2e3r4', n: 'Server de Dueño', m: 'RB_Construct', mw: '', mo: 'Free', of: 0, rg: 0, pvp: 0, rpg: 1, nb: 1, mp: 1000, mv: 40, pw: 1, ph: '', du: 'du3n00001', dn: 'Dueño' };
  sala.ph = vm.runInContext("hashTxt('c' + 'q1w2e3r4' + 'clave1')", host);
  vm.runInContext("localStorage.setItem('rb_salas_mias', JSON.stringify({ q1w2e3r4: { clave: 'x', pw: 'clave1', t: Date.now() } })); MUNDO.nombre = 'RB_Construct'", host);
  S.entrar(host, sala, 'limpia'); S.conecta(host, 'sala'); S.entregar();
  S.entrar(yo, sala, 'limpia', 'clave1'); S.conecta(yo, 'sala'); S.entregar();
  for (let k = 0; k < 30; k++) S.cuadro(0.1, [[yo, { jug: jug({ reloj: k / 10 }), objs: [] }], [host, { jug: jug({ reloj: k / 10 }), objs: [] }]]);
  S.estado(yo);
  S.accion(host, { k: 'cfg' }, "DIA.hora = 7.25; HOST.ds = true; SALA.pvp = 1; SALA.mp = 77; hostPublicar()"); S.entregar(); S.estado(yo);
  S.accion(host, { k: 'mapa' }, "MUNDO.nombre = 'RB_Flatgrass'; hostPublicar()"); S.entregar(); S.estado(yo);
  S.accion(host, { k: 'echar' }, "publicar('a', { k: 'kick', to: 'n4t1v0abc' })"); S.entregar(); S.estado(yo);
}

// 6) volver con otro número (se reabrió la app): mando «an» y borro lo de antes; y el caso al revés
async function volver(S) {
  const web = S.otro('Webero', 200, 'w3b0x9zz1');
  S.entrar(web, SALA_FLAT, 'oficial'); S.conecta(web, 'sala'); S.entregar();
  // (yo estuve antes con el número «v13j0n4t1»: dejé mis cosas retenidas)
  const viejo = S.otro('Nativo', 201, 'v13j0n4t1'); S.entrar(viejo, SALA_FLAT, 'oficial'); S.conecta(viejo, 'sala'); S.entregar();
  for (let k = 0; k < 15; k++) S.cuadro(0.1, [[viejo, { jug: jug({ pos: [1, 1, 1], reloj: k / 10 }), objs: [caja(4, [1, 0.5, 1])] }], [web, { jug: jug({ reloj: k / 10 }), objs: [] }]]);
  S.corta(viejo, 'sala'); S.entregar(); W.ret.set('jxmod_v1_f_RB_Flatgrass_1/w/v13j0n4t1', JSON.stringify({ o: [[4, 'Crate', 1, 0.5, 1, 0, 0, 0, 1, 0, 0]], e: [], md: [], i: 'v13j0n4t1' }));
  for (let k = 0; k < 20; k++) S.cuadro(0.1, [[web, { jug: jug({ reloj: 2 + k / 10 }), objs: [] }]]);
  const yo = S.yo('Nativo', 202, 'n4t1v0abc');
  S.entrar(yo, SALA_FLAT, 'oficial', undefined, 'v13j0n4t1'); S.conecta(yo, 'sala'); S.entregar();
  for (let k = 0; k < 230; k++) S.cuadro(0.1, [[yo, { jug: jug({ pos: [1, 1, 1], reloj: k / 10 }), objs: [] }], [web, { jug: jug({ reloj: 4 + k / 10 }), objs: [] }]]);
  S.vista(web); S.estado(yo);
}

// 7) los NPC: los míos viajan cada 0,15 s; los del otro se ven, dicen cosas y se van
async function npcs(S) {
  const yo = S.yo('Nativo', 300, 'n4t1v0abc'), web = S.otro('Webero', 301, 'w3b0x9zz1');
  S.entrar(yo, SALA_FLAT, 'oficial'); S.conecta(yo, 'sala'); S.entregar();
  S.entrar(web, SALA_FLAT, 'oficial'); S.conecta(web, 'sala'); S.entregar();
  const npc = (id, x, f, o) => Object.assign({ id, skin: 'Zombie', pos: [x, 1, 0], yaw: 0.5, vel: [1, 0, 0], f, emote: '', arma: '', tiros: 0, mira: null }, o);
  for (let k = 0; k < 90; k++) {
    const t = k / 30;
    const mios = [npc(1, t, 1), npc(2, -t, 1 | 8, { arma: 'Pistol', tiros: k % 9 === 0 ? 2 : 0, mira: [3, 1.2, 4], emote: k > 60 ? 'Baile' : '' })];
    const suyos = k < 70 ? [npc(5, 10 + t, 1, { skin: 'Noob', yaw: t }), npc(6, 12, k > 40 ? 6 : 1)] : [];
    S.cuadro(1 / 30, [[yo, { jug: jug({ reloj: t }), objs: [], npcs: mios }], [web, { jug: jug({ reloj: t }), objs: [], npcs: suyos }]]);
    if (k === 30) { S.accion(web, { k: 'npcdi' }, "publicar('a', { k: 'npcdi', n: 5, t: 'grrr <b>' })"); S.entregar(); }
    if (k === 50) { S.accion(web, { k: 'npcdan' }, "publicar('a', { k: 'npcdan', to: 'n4t1v0abc', n: 2, d: 25, v: [0, 0, 1], tumba: 1 })"); S.entregar(); }
    if (k === 75) { S.accion(web, { k: 'npcfin' }, "publicar('a', { k: 'npcfin', n: 6 })"); S.entregar(); }
    if (k % 15 === 0) S.estado(yo);
  }
  for (let k = 0; k < 6; k++) S.cuadro(1, [[yo, { jug: jug({ reloj: 3 + k }), objs: [] }]]);
  S.estado(yo);
}

async function principal() {
  const args = process.argv.slice(2);
  if (args[0] === '--rust') return verRust(args[1]);
  const salida = args[0] || path.join(__dirname, 'red_web.json.gz');
  const escenas = [];
  for (const [n, f] of [['basica', basica], ['interpolar', interpolar], ['lista', lista], ['anfitrion', anfitrionCon], ['invitado', invitado], ['volver', volver], ['npcs', npcs]]) escenas.push(await escena(n, f));
  const txt = JSON.stringify({ nota: 'generado con tests/red_ref.js: juego/red.js (y lo de la red de anfitrion.js y npc.js) de la web corriendo en Node', escenas });
  fs.writeFileSync(salida, salida.endsWith('.gz') ? require('zlib').gzipSync(txt + '\n', { level: 9 }) : txt + '\n');
  console.log('escenas:', escenas.map((e) => `${e.nombre}: ${e.pasos.length} pasos, ${e.ops.filter((o) => o[1] === 'pub').length} publicaciones, ${e.estados.length} estados`).join('; '));
  console.log('→', salida, (txt.length / 1024).toFixed(0), 'KB');
}
// (el anfitrión, con el id del server que sale del azar de la web: la respuesta de la tienda lo repite)
async function anfitrionCon(S) {
  const h0 = S.http;
  S.http = (c, i, cuerpo) => {
    if (cuerpo === '__ID__') { const id = vm.runInContext("JSON.parse(__opsHttp[__opsHttp.length - 1][4]).id", c); cuerpo = JSON.stringify({ id, clave: 'cl4v3d3l4t13nd4x', sala: {} }); }
    return h0(c, i, cuerpo);
  };
  // (los pedidos HTTP, para leer el id)
  const y0 = S.yo; S.yo = (...a) => { const c = y0(...a); vm.runInContext("var __opsHttp = []; const __f0 = fetch; fetch = (u, o) => { const p = __f0(u, o); __opsHttp.push(__ops[__ops.length - 1]); return p; }", c); return c; };
  return anfitrion(S);
}

// lo que publicó red.rs, a un juego web: cómo lo ve
async function verRust(archivo) {
  const pubs = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  W.cli = []; W.ret = new Map(); W.cola = [];
  const web = nuevoJuego('Webero', 22, 'w3b0x9zz1');
  vm.runInContext(`SALA = Object.assign({}, ${JSON.stringify(SALA_FLAT)}, { clave: '' }); redEntrar(SALA.m)`, web);
  const cl = W.cli.filter((x) => x.con === 'sala').pop(); cl.vivo = true; cl.emit('connect');
  const vistas = [];
  for (const p of pubs) {
    W.real = p.real; W.epoca = p.epoca;
    if (p.paso) vm.runInContext(`__paso(${p.dt}, { jug: null, objs: [] }); __timersCorrer()`, web);
    if (p.t !== undefined && p.t.startsWith(vm.runInContext('RED.ROOM', web) + '/')) cl.emit('message', p.t, p.m);
    if (p.vista) vistas.push([p.i, vm.runInContext('__estado()', web)]);
  }
  process.stdout.write(JSON.stringify(vistas) + '\n');
}
principal().catch((e) => { console.error(e); process.exit(1); });
