// ---------------- correr el Lua de los addons montados (como GMod) y engancharlo al juego ----------------
// Orden de GMod: lua/autorun (los dos lados) y autorun/server, autorun/client; después las armas (lua/weapons), las
// entidades (lua/entities) y los efectos (lua/effects, sólo cliente). Cada clase puede ser un archivo suelto o una
// carpeta con init.lua (server), cl_init.lua (cliente) y shared.lua (si falta alguno de los otros dos).
// Desmontar un addon reinicia el Lua entero y vuelve a cargar los que quedan (GMod tampoco descarga addons en vivo).

// type() y TypeID() como en GMod (Vector, Angle, Entity, Player...)
function gmaTipos(R, G, def) {
  const tipo0 = G.get('type');
  const meta = (v) => (v instanceof LuaTable ? v.mt : v && typeof v === 'object' ? v.__mt : null);
  const nombre = (v) => {
    if (v instanceof LEnt) return v.tipo === 'jug' ? 'Player' : v.tipo === 'arma' ? 'Weapon' : v.tipo === 'npc' ? 'NPC' : 'Entity';
    if (v instanceof LVec) return 'Vector'; if (v instanceof LAng) return 'Angle';
    const m = meta(v); if (!(m instanceof LuaTable)) return null;
    if (v instanceof LuaTable) return m.get('MetaName') === 'Panel' ? 'Panel' : null;
    if (m === GMA.mtPhy) return 'PhysObj'; if (m === GMA.mtDmg) return 'CTakeDamageInfo'; if (m === GMA.mtEfecto) return 'CEffectData'; if (m === GMA.mtCvar) return 'ConVar'; if (m === GMA.mtMat) return 'IMaterial'; if (m === GMA.mtSnd) return 'CSoundPatch';
    const n = m.get('MetaName'); return typeof n === 'string' ? n : null;
  };
  GMA.tipoNombre = nombre;
  def(G, 'type', (v) => nombre(v) || tipo0(v));
  const IDS = { nil: 0, boolean: 1, number: 3, string: 4, table: 5, function: 6, userdata: 7, thread: 8, Entity: 9, Player: 9, Weapon: 9, NPC: 9, Vehicle: 9, NextBot: 9, Vector: 10, Angle: 11, PhysObj: 12, CTakeDamageInfo: 15, CEffectData: 16, IMaterial: 21, Panel: 22, ConVar: 27, VMatrix: 29, CSoundPatch: 30 };
  def(G, 'TypeID', (v) => IDS[nombre(v) || tipo0(v)] ?? 7);
}

// correr algo con el lado (server/cliente) puesto
function gmaEnLado(ctx, f) {
  const c0 = GMA.ctx; GMA.ctx = ctx; gmaLado(ctx);
  try { return f(); } finally { GMA.ctx = c0; gmaLado(c0); }
}
const gmaBytes = (A, r) => (A && A.G.archivos.get(r)) || gmArchivo(r);

// los hooks agregados mientras se cargaba un addon que GMod ya habría corrido (Initialize, InitPostEntity, PlayerSpawn...)
function gmaHooksNuevos(antes, ev, ...a) {
  const H = GMA.hooks.get(ev); if (!H) return;
  const viejos = antes.get(ev) || new Map();
  for (const [id, h] of [...H]) for (const c of 'SC') { const f = h[c]; if (f && viejos.get(id) && viejos.get(id)[c] === f) continue; if (f) gmLlamar(f, c, ...a); }
}

function gmLuaMontar(A) {
  if (!A || !A.lua || !A.lua.length) return;
  const t0 = performance.now();
  gmaIniciar(); const R = GMA.R, G = R.G;
  GMA.activo = true; GMA.addonActual = A; A.luaErr = []; A.sents = []; A.sweps = []; A.efectos = []; A.herramientas = []; A.listas = {};
  const antes = new Map([...GMA.hooks].map(([ev, H]) => [ev, new Map([...H].map(([id, h]) => [id, { S: h.S, C: h.C }]))]));
  const L = A.lua.slice().sort(), corrido = new Set();
  // (como en GMod, los archivos de todos los addons comparten las rutas: si dos traen el mismo lua/autorun/x.lua o la
  // misma clase —dos versiones de la base de los aviones WAC—, vale el del primero montado y corre una sola vez; antes
  // corrían las dos versiones y se pisaban: la cámara de WAC tiraba error en cada cuadro)
  const RC = GMA.rutasCorridas || (GMA.rutasCorridas = new Map());
  const ajena = (r) => { const x = RC.get(r); return x !== undefined && x !== A.id; };
  const correr = (ctx, r) => { if (ajena(r)) return; const b = GMOD.arch.get(r) || gmaBytes(A, r); if (!b) return; corrido.add(r); RC.set(r, A.id); gmaEnLado(ctx, () => gmaCorrer(r, b)); };
  try {
    // 1) autorun
    for (const r of L) if (/^lua\/autorun\/[^/]+\.lua$/.test(r)) { correr('S', r); correr('C', r); }
    for (const r of L) if (/^lua\/autorun\/server\/[^/]+\.lua$/.test(r)) correr('S', r);
    for (const r of L) if (/^lua\/autorun\/client\/[^/]+\.lua$/.test(r)) correr('C', r);
    // 2) clases: armas, entidades y efectos
    const grupos = new Map();
    for (const r of L) {
      // (también las de un modo de juego: gamemodes/<modo>/entities/weapons|entities|effects, como en GMod)
      let m = r.match(/^(?:lua|gamemodes\/[^/]+\/entities)\/(weapons|entities|effects)\/([^/]+)\.lua$/), g;
      if (m) { g = grupos.get(m[1] + '/' + m[2]) || { tipo: m[1], nombre: m[2] }; g.solo = r; grupos.set(m[1] + '/' + m[2], g); continue; }
      m = r.match(/^(?:lua|gamemodes\/[^/]+\/entities)\/(weapons|entities|effects)\/([^/]+)\/(init|cl_init|shared)\.lua$/);
      if (m) { g = grupos.get(m[1] + '/' + m[2]) || { tipo: m[1], nombre: m[2] }; g[m[3]] = r; grupos.set(m[1] + '/' + m[2], g); continue; }
      m = r.match(/^lua\/weapons\/gmod_tool\/stools\/([^/]+)\.lua$/);
      if (m) A.herramientas.push({ nombre: m[1], r });
    }
    for (const tipo of ['weapons', 'entities', 'effects']) {
      for (const g of [...grupos.values()].filter((x) => x.tipo === tipo).sort((a, b) => (a.nombre < b.nombre ? -1 : 1))) {
        if (g.nombre === 'gmod_tool' && tipo === 'weapons') continue;   // (la Tool Gun es la del juego; las herramientas van aparte)
        if ([g.solo, g.init, g.shared, g.cl_init].some((r) => r && ajena(r))) continue;   // (la misma clase ya la trajo otro addon)
        const nombre = g.nombre.toLowerCase(), v = tipo === 'weapons' ? 'SWEP' : tipo === 'entities' ? 'ENT' : 'EFFECT';
        for (const ctx of tipo === 'effects' ? ['C'] : ['S', 'C']) {
          // (los efectos en carpeta van en lua/effects/<nombre>/init.lua, que en GMod es del cliente)
          const r = g.solo || (tipo === 'effects' ? g.init || g.cl_init || g.shared : ctx === 'S' ? g.init || g.shared : g.cl_init || g.shared); if (!r) continue;
          gmaEnLado(ctx, () => {
            const T = new LuaTable(); T.set('Folder', tipo + '/' + g.nombre);
            if (tipo === 'weapons') { T.set('Primary', new LuaTable()); T.set('Secondary', new LuaTable()); }
            const prev = G.get(v), cc0 = GMA.cargandoClase; G.set(v, T); GMA.cargandoClase = v;
            try { correr(ctx, r); } finally { GMA.cargandoClase = cc0; }
            const T2 = G.get(v) instanceof LuaTable ? G.get(v) : T; G.set(v, prev);
            if (tipo === 'weapons') gmaRegistrar('arma', nombre, T2);
            else if (tipo === 'entities') gmaRegistrar('ent', nombre, T2);
            else { T2.set('ClassName', nombre); if (!T2.mt && G.get('__EFFECT_BASE') instanceof LuaTable) { const m = new LuaTable(); m.set('__index', G.get('__EFFECT_BASE')); T2.mt = m; } GMA.efectos.set(nombre, T2); A.efectos.push(nombre); }
          });
        }
      }
    }
    // 3) herramientas de la Tool Gun: se cargan (para que no rompan) y quedan anotadas
    for (const h of A.herramientas) gmaEnLado('S', () => { const T = new LuaTable(); T.set('Mode', h.nombre); T.set('ClientConVar', new LuaTable()); T.set('ServerConVar', new LuaTable()); G.set('TOOL', T); correr('S', h.r); h.t = G.get('TOOL'); G.set('TOOL', undefined);
      // (como en GMod: TOOL.ClientConVar.x y TOOL.ServerConVar.x son variables "<herramienta>_x" con su valor por defecto;
      // otras partes del addon las leen, como el color de la hoja de la Lightsaber)
      if (h.t instanceof LuaTable) for (const k of ['ClientConVar', 'ServerConVar']) { const t = h.t.get(k); if (t instanceof LuaTable) for (const c of t.claves()) if (typeof c === 'string') gmaCvar(h.nombre + '_' + c, String(t.get(c) ?? '')); } });
    if (typeof gmbHerRegistrar === 'function') gmbHerRegistrar(A);
    // 4) las bases que se registraron después de sus hijas
    gmaEnlazarTodo();
    // 5) lo que GMod corre al arrancar, para los hooks nuevos de este addon
    if (typeof JUEGO !== 'undefined') {
      for (const ev of ['PreGamemodeLoaded', 'OnGamemodeLoaded', 'PostGamemodeLoaded', 'Initialize', 'InitPostEntity']) gmaHooksNuevos(antes, ev);
      if (JUEGO.estado === 'juego') { gmaHooksNuevos(antes, 'PlayerInitialSpawn', GMA.jug, false); gmaHooksNuevos(antes, 'PlayerSpawn', GMA.jug, false); gmaHooksNuevos(antes, 'PlayerLoadout', GMA.jug); }
    }
  } finally { GMA.addonActual = null; }
  // lo que va al menú de props: las entidades y armas que se pueden poner
  for (const [n, c] of GMA.clases) if (c.addon === A && gmaSpawneable(c)) A.sents.push(n);
  for (const [n, c] of GMA.armas) if (c.addon === A && gmaSpawneable(c, true)) A.sweps.push(n);
  A.sents.sort(); A.sweps.sort();
  A.luaCorridos = corrido.size; A.luaMs = Math.round(performance.now() - t0);
  const falt = new Set();
  for (const r of L) { const b = gmaBytes(A, r); if (!b) continue; const s = new TextDecoder('latin1').decode(b);
    for (const m of s.matchAll(/["'](models\/[^"'\n]{1,120}?\.mdl)["']/gi)) { const p = m[1].toLowerCase().replace(/\\/g, '/'); if (gmArchivo0(p) || (typeof GML !== 'undefined' && GML.datos.has(p)) || (typeof gmlTiene === 'function' && gmlTiene(p)) || DATA.pfPorNombre[p.replace(/^.*\//, '').replace(/\.mdl$/, '')]) continue; falt.add(p); if (falt.size >= 60) break; } }
  A.faltanModelos = [...falt];
  if (typeof gmMenu === 'function') gmMenu();
}
// (las armas de TTT no dicen Spawnable —en TTT se compran—: acá se sacan del menú como las demás)
const gmaEsTTT = (t) => { const b = String(t.get('Base') || ''); return b === 'weapon_tttbase' || b === 'weapon_tttbasegrenade' || (t.get('CanBuy') !== undefined && t.get('Kind') !== undefined); };
const gmaSpawneable = (c, arma) => { const t = c.C || c.S; if (!t) return false; const s = t.get('Spawnable'), a = t.get('AdminSpawnable'); return R_T(s) || (s === undefined && R_T(a)) || (!!arma && s === undefined && gmaEsTTT(t)); };
function gmaEnlazarTodo() {
  for (const [M, tipo] of [[GMA.armas, 'arma'], [GMA.clases, 'ent']]) for (const c of M.values()) for (const ctx of ['S', 'C']) {
    const t = c[ctx]; if (t && !(t.get('BaseClass') instanceof LuaTable)) gmaEnLado(ctx, () => gmaEnlazarBase(t, tipo));
  }
}

// desmontar: el Lua de cero con los addons que quedan
function gmLuaDesmontar() { gmaReiniciar(); for (const A of GMOD.addons.values()) gmLuaMontar(A); }
function gmaReiniciar() {
  if (typeof JUG !== 'undefined') JUG.congelado = false;   // (lo que congeló el Lua anterior no queda pegado)
  if (typeof gmbHerQuitarTodas === 'function') gmbHerQuitarTodas();
  for (const e of [...GMA.ents.values()]) if (e.tipo === 'ent' && e.o && !e.o.borrado && e.clase !== 'prop_physics') { try { borrarObjeto(e.o); } catch (x) {} }
  if (GMA.armasJug && typeof ARM !== 'undefined') for (const c of [...GMA.armasJug.keys()]) gmaQuitarArma(c);
  if (GMA.hud) GMA.hud.g.clearRect(0, 0, GMA.hud.c.width, GMA.hud.c.height);
  Object.assign(GMA, { R: null, modo: null, ctx: 'S', hooks: new Map(), timers: new Map(), tSimples: [], net: { S: new Map(), C: new Map() }, ents: new Map(), clases: new Map(), armas: new Map(), efectos: new Map(), cvars: new Map(), fuentes: new Map(), cargados: new Set(), entPorObj: new WeakMap(), hijos: new Set(), rutasCorridas: new Map(), asiento: null, jug: null, mundo: null, swep: null, armasJug: null, netCola: [], partCola: [], efVivos: [], bases: null, mats: null, glob: null, activo: false, teclasAnt: 0, jugVivo: undefined });
}

// ---------------- cada cuadro ----------------
function gmLuaPaso(dt) {
  if (GMA.R && GMA.activo && typeof JUEGO !== 'undefined' && JUEGO.estado === 'juego') {
    const t0 = performance.now();
    try { gmaPaso(dt); } catch (e) { gmaErr('paso: ' + ((e && e.message) || e)); }
    try { if (typeof gmrPartPaso === 'function') gmrPartPaso(dt); } catch (e) { gmaErr('partículas: ' + ((e && e.message) || e)); }
    const ms = performance.now() - t0; GMA.ms = GMA.ms === undefined ? ms : GMA.ms * 0.95 + ms * 0.05;
  }
  if (PH.hits.length) PH.hits.length = 0;   // (los choques fuertes de este cuadro: los usa PhysicsCollide; si no, se tiran)
}
function gmaPaso(dt) {
  const R = GMA.R, t = TIEMPO.t; R.cuadro = (R.cuadro || 0) + 1;
  if (typeof gmnbPaso === 'function') { try { gmnbPaso(dt); } catch (e) { gmaErr('nextbot: ' + ((e && e.message) || e)); } }
  try { gmaArmasSuelo(); } catch (e) {}
  { const pj = GMA.jug && GMA.jug.punch; if (pj) { const k = Math.max(0, 1 - dt * 9); pj.p *= k; pj.y *= k; pj.r *= k; } }   // (el golpe de la vista vuelve a cero)
  // timers (uno por cuadro como mucho cada uno; 0 repeticiones = para siempre)
  for (const [id, T] of [...GMA.timers]) {
    if (T.pausa || t < T.t) continue;
    T.t = t + T.d;
    if (T.r > 0 && --T.r === 0) GMA.timers.delete(id);
    gmLlamar(T.f, T.ctx);
  }
  if (GMA.tSimples.length) {
    const L = GMA.tSimples; GMA.tSimples = []; const quedan = [];
    for (const x of L) { if (t < x.t) { quedan.push(x); continue; } if (x.js) { try { x.f(); } catch (e) { gmaErr(String(e)); } } else gmLlamar(x.f, x.ctx, ...(x.args || [])); }
    GMA.tSimples = quedan.concat(GMA.tSimples);
  }
  // mensajes de red (en una partida sola: del server al cliente y al revés en el mismo cuadro)
  if (GMA.netCola && GMA.netCola.length) { const Q = GMA.netCola; GMA.netCola = []; for (const m of Q) GMA.netEntregar(m); }
  // el jugador: aparecer, morir, teclas
  const vivo = !!JUG.vivo;
  if (GMA.jugVivo === undefined) GMA.jugVivo = vivo;
  else if (vivo !== GMA.jugVivo) {
    GMA.jugVivo = vivo;
    // (con un modo de juego: se aparece sin las armas del sandbox y su PlayerSpawn da las suyas; morir callado es KillSilent)
    if (vivo) { gmaPuntosAparicion(); if (GMA.modo && !GMA.modo.sandbox) gmmSinArmas(); gmaHook('PlayerSpawn', 'S', GMA.jug, false); if (!GMA.modo) gmaHook('PlayerLoadout', 'S', GMA.jug); }
    else if (GMA.muerteMuda) { GMA.muerteMuda = false; gmaHook('PlayerSilentDeath', 'S', GMA.jug); }
    else { gmaHook('DoPlayerDeath', 'S', GMA.jug, GMA.mundo, gmaDmgInfo(100)); gmaHook('PlayerDeath', 'S', GMA.jug, GMA.mundo, GMA.mundo); if (GMA.modo) aviso(T('gm.reaparecer'), 3); }
  }
  // (muerto con un modo de juego: el modo decide cuándo se reaparece, como en GMod)
  if (!vivo && GMA.modo && !GMA.modo.muerteRota) { GMA.ultErr = false; gmaHook('PlayerDeathThink', 'S', GMA.jug); if (GMA.ultErr) GMA.modo.muerteRota = true; }
  if (GMA.modo) gmmBarraPaso();
  const k = UI.abierto ? 0 : gmaTeclas(), k0 = GMA.teclasAnt || 0;
  GMA.tecAnt = k0;   // (las del cuadro anterior: KeyPressed/KeyReleased del Lua comparan contra éstas)
  if (k !== k0) { for (let b = 1; b <= 16777216; b *= 2) { if ((k & b) && !(k0 & b)) gmaHook('KeyPress', 'SC', GMA.jug, b); else if (!(k & b) && (k0 & b)) gmaHook('KeyRelease', 'SC', GMA.jug, b); } GMA.teclasAnt = k; }
  // (PlayerButtonDown/Up con el número de KEY_ o MOUSE_: las habilidades de muchos addons —"G para...", "F para..."—
  // van por acá, también desde los botones que el mod agrega a la pantalla)
  { const bs = gmaBotones(), b0 = GMA.botAnt || new Set(), nuevos = [];
    for (const n of bs) if (!b0.has(n)) { nuevos.push(n); gmaHook('PlayerButtonDown', 'SC', GMA.jug, n); }
    for (const n of b0) if (!bs.has(n)) gmaHook('PlayerButtonUp', 'SC', GMA.jug, n);
    GMA.botNuevos = nuevos; GMA.botAnt = bs; }
  // hooks de todos los cuadros
  gmaHook('Tick', 'SC'); gmaHook('Think', 'SC'); gmaHook('PlayerTick', 'S', GMA.jug, null); gmaHook('PlayerPostThink', 'S', GMA.jug);
  // armas de los addons
  gmaSwepPaso();
  // choques fuertes → PhysicsCollide
  if (PH.hits.length) for (const h of PH.hits.slice(0, 64)) for (const [a, b] of [[h.b, h.o], [h.o, h.b]]) {
    const e = a && a.obj && GMA.entPorObj.get(a.obj); if (!e || !e.vivo || !claseTabla(e.clase, 'S')) continue;
    const d = new LuaTable(), otra = b && b.obj ? entDeObj(b.obj) : GMA.mundo;
    // (DeltaTime: el tiempo desde el choque anterior de esa entidad, como en GMod; las bombas del Nuke Pack sólo
    // explotan con más de 0.15 s y muchos addons lo usan para no repetir sonidos. El primero cuenta desde que apareció.)
    const dtC = Math.min(1e3, TIEMPO.t - (e.ultChoque ?? e.nace ?? -1e3)); e.ultChoque = TIEMPO.t;
    d.set('HitPos', GMA.V(h.p)); d.set('HitEntity', otra); d.set('Speed', h.v / GS); d.set('HitSpeed', GMA.Vd(vscale(a.vel, 1 / GS))); d.set('OurOldVelocity', GMA.Vd(vscale(a.vel, 1 / GS))); d.set('OurNewVelocity', GMA.Vd(vscale(a.vel, 1 / GS)));
    d.set('TheirOldVelocity', GMA.Vd(b ? vscale(b.vel, 1 / GS) : v3())); d.set('TheirNewVelocity', GMA.Vd(b ? vscale(b.vel, 1 / GS) : v3())); d.set('HitNormal', GMA.Vd(b ? vsub(b.pos, a.pos).norm() : v3(0, -1, 0))); d.set('DeltaTime', dtC);
    d.set('PhysObject', ENT_PHY(e)); d.set('HitObject', otra.tipo === 'ent' ? ENT_PHY(otra) : ENT_PHY(GMA.mundo)); d.set('OurOldAngularVelocity', GMA.nv(0, 0, 0)); d.set('TheirOldAngularVelocity', GMA.nv(0, 0, 0));
    metodo(e, 'PhysicsCollide', 'S', d, ENT_PHY(e));
  }
  // entidades de los addons: las que el juego borró (explosión, limpiar), Think del server (5 por segundo o lo que pida NextThink) y del cliente.
  // Presupuesto: si el Lua viene costando más de lo que aguanta la calidad elegida (3 ms en Patata y Bajo, 6 ms en las
  // demás, promedio móvil), el Think de cliente de las entidades a más de 25 m va por turnos (cada 2 o 4 cuadros); las
  // cercanas, siempre. El del server ya va 5 veces por segundo (o cuando pide NextThink).
  const tope = GFX.nombre === 'patata' || GFX.nombre === 'bajo' ? 3 : 6, salto = GMA.ms > tope * 2 ? 4 : GMA.ms > tope ? 2 : 1, cam = R.cuadro;
  GMA.salto = salto;
  for (const e of [...GMA.ents.values()]) {
    if (!e.vivo || !e.creado || e.tipo !== 'ent') continue;
    if (e.o && e.o.borrado) { gmaQuitar(e); continue; }
    const c = GMA.clases.get(e.clase); if (!c) continue;
    if (t >= (e.proxS || 0)) { e.prox = undefined; const r = metodo(e, 'Think', 'S'); e.proxS = r[0] === true ? (e.prox ?? t) : t + 0.2; }
    if (c.C && c.C !== c.S) {
      if (salto > 1 && (cam + (e.id | 0)) % salto) { const p = e.o ? e.o.b.pos : e.pos; if (p && (p.x - CAM.pos.x) ** 2 + (p.y - CAM.pos.y) ** 2 + (p.z - CAM.pos.z) ** 2 > 625) continue; }
      metodo(e, 'Think', 'C');
    }
  }
  // las pegadas con SetParent (y las soldadas) van con su padre; el asiento de un addon, si el jugador se bajó
  gmaHijosPaso(); gmaAsientoPaso();
  // efectos de los addons con Think (hasta que devuelve false; 10 s como mucho)
  if (typeof gmrEfectosPaso === 'function') gmrEfectosPaso();
  // partículas de ParticleEmitter
  if (GMA.partCola && GMA.partCola.length) {
    const Q = GMA.partCola; GMA.partCola = [];
    for (const q of Q.slice(-200)) { const c = q.c || [255, 255, 255]; particula(q.p, q.v || v3(), Math.max(0.05, Math.min(8, q.vida || 1)), Math.max(0.01, ((q.t0 ?? 10) * GS) / 2), [c[0] / 255, c[1] / 255, c[2] / 255, Math.max(0, Math.min(1, (q.a0 ?? 255) / 255))], /smoke|dust|fire|flame/.test(q.mat) ? 'humo' : 'chispa', Math.max(-1, Math.min(10, (q.t1 ?? 0) / Math.max(0.01, q.t0 ?? 10) - 1))); }
  }
}
const ENT_PHY = (e) => GMA.metas.Entity.get('GetPhysicsObject')(e);

// ---------------- la HUD de los addons (HUDPaint y DrawHUD del arma) ----------------
function gmaHUDPaso() {
  if (!GMA.R || !GMA.activo) return;
  const w = GMA.swep, hayArma = !!(w && w.vivo && claseTabla(w.clase, 'C'));
  // (los hooks de la pantalla de este cuadro: los efectos —RenderScreenspaceEffects, con DrawColorModify y
  // DrawMaterialOverlay—, la HUD y lo que va encima de todo; los de un mod apagado en el panel GMod no cuentan)
  const hay = (ev) => { const H = GMA.hooks.get(ev); return !!(H && [...H.values()].some((h) => h.C && !(h.a && GMA.apagados.has(h.a)))); };
  const hayEf = hay('RenderScreenspaceEffects'), hayHooks = hayEf || hay('HUDPaint') || hay('PostDrawHUD') || hay('DrawOverlay') || !!GMA.modo;
  GMA.pp = null;
  if (!hayHooks && !hayArma && !GMA.hudSucio) { gmaPPAplicar(null); return; }
  // (todos los cuadros, a 60; en Patata y Bajo la densidad de la pantalla hasta 1,5 en vez de 2, y el lienzo se esconde
  // cuando en el cuadro no se dibujó nada, así el celular no compone una capa transparente del tamaño de la pantalla)
  const flojo = GFX.nombre === 'patata' || GFX.nombre === 'bajo';
  const g = GMA.hudCtx(), c = GMA.hud.c, dpr = Math.min(flojo ? 1.5 : 2, devicePixelRatio || 1), W = VW(), Hh = VH();
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(Hh * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(Hh * dpr); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); GMA.hudSucio = false;
  if (JUEGO.estado !== 'juego' || (!hayHooks && !hayArma)) { c.style.display = 'none'; gmaPPAplicar(null); return; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); GMA.dibujoHUD = true; GMA.hudSucio = true; GMA.hudN = 0;
  const t0 = performance.now();
  try {
    if (hayEf) gmaHook('RenderScreenspaceEffects', 'C');
    if (hayHooks) { gmaHook('HUDPaint', 'C'); gmaHook('PostDrawHUD', 'C'); }
    if (hayArma && JUG.vivo) metodo(w, 'DrawHUD', 'C');
    if (hayHooks) gmaHook('DrawOverlay', 'C');
  } finally { GMA.dibujoHUD = false; g.globalAlpha = 1; const ver = GMA.hudN > 0 ? '' : 'none'; if (c.style.display !== ver) c.style.display = ver; gmaPPAplicar(GMA.pp); }
  const ms = performance.now() - t0; GMA.msHUD = GMA.msHUD === undefined ? ms : GMA.msHUD * 0.95 + ms * 0.05;
}

// DrawColorModify de los addons, sobre la imagen del juego y debajo de la HUD: el contraste (que en GMod multiplica) y la
// saturación con un filtro del lienzo; lo que suma (color y brillo) con una capa encima que suma, y lo que resta, con
// una que multiplica. Sólo se toca el estilo cuando cambia (un cuadro sin el efecto lo saca)
function gmaPPAplicar(pp) {
  const cv = typeof R !== 'undefined' && R.cv; if (!cv) return;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const f = pp ? `brightness(${r3(Math.max(0, pp.con))}) saturate(${r3(Math.max(0, pp.col))})` : '';
  if (GMA.ppF !== f) { GMA.ppF = f; cv.style.filter = f; }
  let capa = GMA.ppCapa;
  const suma = pp ? pp.add.map((a) => Math.max(0, a + pp.bri)) : [0, 0, 0], resta = pp ? pp.add.map((a) => Math.max(0, -(a + pp.bri))) : [0, 0, 0];
  const k = suma.concat(resta).map(r3).join(',');
  if (GMA.ppK === k) return; GMA.ppK = k;
  if (!capa) {
    let ant = cv; capa = GMA.ppCapa = [0, 1].map((i) => { const d = document.createElement('div'); d.className = 'gmPP'; d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1;display:none;mix-blend-mode:' + (i ? 'multiply' : 'plus-lighter'); ant.after(d); ant = d; return d; });
  }
  const c255 = (x) => Math.round(Math.min(1, x) * 255);
  capa[0].style.display = suma.some((x) => x > 0.002) ? '' : 'none'; capa[0].style.background = `rgb(${suma.map(c255).join(',')})`;
  capa[1].style.display = resta.some((x) => x > 0.002) ? '' : 'none'; capa[1].style.background = `rgb(${resta.map((x) => c255(1 - x)).join(',')})`;
}

// ---------------- menú de props: entidades (gment:) y armas (gmswep:) de los addons ----------------
function gmaClaseDe(it) { const m = /^gm(ent|swep):(.+)$/.exec(it); if (!m) return null; const c = (m[1] === 'ent' ? GMA.clases : GMA.armas).get(m[2]); return c ? { tipo: m[1], n: m[2], c, t: c.C || c.S } : null; }
function gmaNomClase(it) {
  const x = gmaClaseDe(it); if (!x) return it.replace(/^gm(ent|swep):/, '');
  let n = x.t.get('PrintName'); if (typeof n !== 'string' || !n.trim()) return x.n;
  if (n.startsWith('#')) { const L = GMA.R && GMA.R.G.get('language'); const f = L instanceof LuaTable && L.get('GetPhrase'); if (typeof f === 'function') { try { n = String(GMA.R.c(f, 'GetPhrase', n)[0]); } catch (e) {} } }
  return n;
}
// el ícono: el de la clase (materials/entities/<clase>.png o vgui/entities/<clase>), si no el de su modelo, si no la G
function gmaIconoClase(it) {
  const x = gmaClaseDe(it); if (!x) return { src: GM_ICO };
  const k = 'ico:' + it; if (GMOD.iconos.has(k)) return { src: GMOD.iconos.get(k) };
  const n = x.n, io = x.t.get('IconOverride');
  const cands = [typeof io === 'string' ? 'materials/' + io.toLowerCase().replace(/^materials\//, '') : null, 'materials/entities/' + n + '.png', 'materials/vgui/entities/' + n + '.png', 'materials/entities/' + n + '.jpg'].filter(Boolean);
  for (const r of cands) { const b = gmArchivo(r); if (b) { const u = URL.createObjectURL(new Blob([b], { type: /\.jpe?g$/.test(r) ? 'image/jpeg' : 'image/png' })); GMOD.iconos.set(k, u); return { src: u }; } }
  for (const r of ['materials/vgui/entities/' + n, 'materials/entities/' + n]) {
    // (de un addon guardado en el navegador: si todavía no se leyó, se pide y el ícono sale la próxima vez)
    const vtYa = (q) => { const x = gmVtfYa(q, 128); if (!x && GMPZ.idx.has(q)) gmPzVtf(q, 128); return x; };
    let vt = vtYa(r + '.vtf');
    if (!vt) { const vm = gmArchivo(r + '.vmt'); if (vm) { try { const v = GMF.vmt(vm); if (v && v.base) vt = vtYa('materials/' + v.base + '.vtf'); } catch (e) {} } }
    if (vt) { try { const T = GMF.vtf(vt, 128), px = GMF.vtfRGBA(T), cv = document.createElement('canvas'); cv.width = T.w; cv.height = T.h; cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px.buffer, px.byteOffset, px.length), T.w, T.h), 0, 0); const u = cv.toDataURL(); GMOD.iconos.set(k, u); return { src: u }; } catch (e) {} }
  }
  const mod = buscarEnClase(x.t, x.tipo === 'swep' ? 'WorldModel' : 'Model');
  const m = typeof mod === 'string' ? mod.toLowerCase().replace(/\\/g, '/') : '';
  if (m && gmArchivo(m)) return { src: gmIcono('gm:' + m), gm: 'gm:' + m };
  return { src: GM_ICO };
}
// tocar uno en el menú: el arma a la mano; la entidad delante del jugador con su SpawnFunction (como en GMod)
function gmaSpawnMenu(it) {
  if (typeof censPermite === 'function' && !censPermite(it)) return;
  const x = gmaClaseDe(it); if (!x || !GMA.R) return null;
  if (x.tipo === 'swep') { const r = gmaHook('PlayerGiveSWEP', 'S', GMA.jug, x.n, x.t); if (r[0] === false) return null; const w = gmaDarArma(x.n); gmaHook('PlayerSpawnedSWEP', 'S', GMA.jug, w); return w; }
  const r0 = gmaHook('PlayerSpawnSENT', 'S', GMA.jug, x.n); if (r0[0] === false) return null;
  const tr = gmaTraza(CAM.pos.clone(), CAM.fwd.clone(), 4096 * GS, null);
  if (!tr.get('Hit')) { const f = v3(CAM.fwd.x, 0, CAM.fwd.z).norm(), p = vadd(v3(JUG.pos.x, JUG.pos.y - (JUG.medio || 0.9), JUG.pos.z), vscale(f, 4)); tr.set('Hit', true); tr.set('HitWorld', true); tr.set('HitPos', GMA.V(p)); tr.set('HitNormal', GMA.nv(0, 0, 1)); tr.set('Fraction', 0.01); tr.set('Entity', GMA.mundo); }
  const S = claseTabla(x.n, 'S'), sf = S && buscarEnClase(S, 'SpawnFunction');
  let e = null;
  // (algunos addons viejos usan la global ClassName adentro de SpawnFunction: se pone mientras corre)
  if (typeof sf === 'function') { const G = GMA.R.G, c0 = G.get('ClassName'); G.set('ClassName', x.n); try { e = gmLlamar(sf, 'S', S, GMA.jug, tr, x.n)[0]; } finally { G.set('ClassName', c0); } }
  if (!(e instanceof LEnt)) return null;
  e.creador = GMA.jug;
  if (e.modelo && GMA.modelosFaltan && GMA.modelosFaltan.has(String(e.modelo).toLowerCase())) aviso(T('gm.falta').replace('{m}', String(e.modelo).replace(/^.*\//, '')), 4);
  gmaHook('PlayerSpawnedSENT', 'S', GMA.jug, e);
  return e;
}
if (typeof module !== 'undefined') module.exports = { gmLuaMontar, gmLuaDesmontar, gmLuaPaso, gmaHUDPaso, gmaTipos, gmaEnLado, gmaReiniciar, gmaSpawnMenu, gmaNomClase, gmaIconoClase, gmaClaseDe };
