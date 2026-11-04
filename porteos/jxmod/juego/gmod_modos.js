// ---------------- modos de juego (gamemodes) de GMod ----------------
// Un addon puede traer modos de juego: gamemodes/<modo>/<modo>.txt (título, base y "maps": los mapas que son suyos) y
// gamemodes/<modo>/gamemode/ (init.lua del server, cl_init.lua del cliente). Como en GMod, cada modo deriva de otro
// (DeriveGamemode o la "base" del .txt: prop_hunt → fretta → base) y hereda lo que no define (table.Inherit); el juego
// llama sus funciones (GM:PlayerSpawn, GM:Think, GM:HUDPaint...) después de los hooks, como hook.Call.
// Se elige en "Nueva partida" (Automático = el que corresponde al mapa, como los ph_ de Prop Hunt) y arranca con el
// mapa: el Lua vuelve a empezar de cero con el modo puesto. Los equipos (team.SetUp) son de verdad; la pantalla de
// elegir equipo de GMod (vgui) se cambia por una propia, y arriba queda una barrita con el modo, el equipo y el tiempo.
const GMM = { lista: new Map(), elegido: 'auto', actual: null };
const _gmmTd = new TextDecoder('latin1');

// ---- registrar los modos de un addon (al montarlo) ----
function gmmRegistrar(A) {
  const arch = A.G.archivos;
  for (const r of arch.keys()) {
    const m = /^gamemodes\/([^/]+)\/([^/]+)\.txt$/.exec(r); if (!m || m[1] !== m[2]) continue;
    const n = m[1], pre = 'gamemodes/' + n + '/gamemode/';
    const lua = [...arch.keys()].filter((x) => x.startsWith(pre) && x.endsWith('.lua')); if (!lua.length) continue;
    let k = {}; try { const kv = GMF.kv(_gmmTd.decode(arch.get(r))); if (kv && kv.k) k = kv.k; } catch (e) {}
    // (la base: lo que dice DeriveGamemode en su código; si no lo dice, la del .txt)
    let base = null;
    for (const x of lua) { const d = /DeriveGamemode\s*\(\s*["']([^"']+)["']/.exec(_gmmTd.decode(arch.get(x))); if (d) { base = d[1].toLowerCase(); break; } }
    base = base || String(k.base || 'base').toLowerCase();
    let mapas = null; try { if (k.maps) mapas = new RegExp(String(k.maps), 'i'); } catch (e) {}
    const ajustes = k.settings && typeof k.settings === 'object' ? Object.values(k.settings).filter((x) => x && typeof x === 'object' && x.name).map((x) => [String(x.name), String(x.default ?? '0'), String(x.help || x.text || '')]) : [];
    GMM.lista.set(n, { n, titulo: String(k.title || n).slice(0, 60), base, mapas, menu: String(k.menusystem ?? '1') !== '0', id: A.id, ajustes });
  }
}
function gmmQuitar(A) { for (const [n, M] of [...GMM.lista]) if (M.id === A.id) GMM.lista.delete(n); }
// los que se pueden elegir (las bases como fretta no: "menusystem" "0")
const gmmElegibles = () => [...GMM.lista.values()].filter((M) => M.menu);
// el modo de un mapa (por su nombre en el BSP: ph_* → Prop Hunt)
function gmmDeMapa(clave) {
  const nom = (typeof GBSP !== 'undefined' && GBSP.mapas.get(clave) ? GBSP.mapas.get(clave).nombre : String(clave || '')).toLowerCase();
  const M = gmmElegibles().find((x) => x.mapas && x.mapas.test(nom)); return M ? M.n : null;
}

// ---- al empezar una partida: el modo que toca; si cambia (o hay uno puesto), el Lua de cero con el modo ----
function gmmPartida(mapa) {
  const e = GMM.elegido, quiero = e === 'auto' ? gmmDeMapa(mapa) : e !== 'sandbox' && GMM.lista.has(e) ? e : null;
  gmmBarra(false); gmmEquiposCerrar();
  if (!quiero && !GMM.actual) return;
  const est = JUEGO.estado; JUEGO.estado = 'carga';   // (que al volver a montar los addons no se les mande PlayerSpawn: lo hace el modo)
  try {
    gmaReiniciar(); GMM.actual = null;
    for (const A of GMOD.addons.values()) gmLuaMontar(A);
  } finally { JUEGO.estado = est; }
  if (quiero) gmmActivar(quiero);
}

// ---- poner un modo: cargar la cadena de bases de los dos lados, heredar, y arrancar (equipos, Initialize, el jugador) ----
function gmmActivar(n) {
  const M = GMM.lista.get(n); if (!M) return false;
  const R = gmaIniciar(), G = R.G;
  const cadena = []; for (let x = n; x && GMM.lista.has(x) && !cadena.includes(x) && cadena.length < 8; x = GMM.lista.get(x).base) cadena.unshift(x);
  const raiz = GMM.lista.get(cadena[0]).base, sandbox = G.get('GM'), base = G.get('__GM_BASE') instanceof LuaTable ? G.get('__GM_BASE') : sandbox;
  const modo = (GMA.modo = { n, titulo: M.titulo, sandbox: raiz === 'sandbox', t: new Map([['sandbox:S', sandbox], ['sandbox:C', sandbox], ['base:S', base], ['base:C', base]]), S: null, C: null, cargando: true });
  GMA.activo = true; GMM.actual = n;
  // (los "settings" de su .txt son ConVars con su valor por defecto, como las crea GMod al arrancar el modo)
  for (const x of cadena) for (const [cn, d, h] of GMM.lista.get(x).ajustes || []) if (!GMA.cvars.has(cn)) { GMA.cvarAddon = GMM.lista.get(x).id; gmaCvar(cn, d, h); GMA.cvarAddon = null; }
  for (const ctx of ['S', 'C']) {
    let B = modo.sandbox ? sandbox : base;
    for (const x of cadena) {
      const dir = 'gamemodes/' + x + '/gamemode/';
      const T = new LuaTable(); T.set('FolderName', x); T.set('Folder', 'gamemodes/' + x); T.set('Name', GMM.lista.get(x).titulo); T.set('BaseClass', B);
      modo.t.set(x + ':' + ctx, T);
      for (const a of ctx === 'S' ? ['init.lua', 'shared.lua'] : ['cl_init.lua', 'shared.lua']) {
        const b = gmArchivo(dir + a); if (!b) continue;
        gmaEnLado(ctx, () => { G.set('GM', T); G.set('GAMEMODE', T); const d0 = GMA.gmDir; GMA.gmDir = dir; try { gmaCorrer(dir + a, b); } finally { GMA.gmDir = d0; } });
        break;
      }
      // (gamemode.Register de GMod: lo que no definió, de su base; y BaseClass apunta a ella)
      const Bf = T.get('BaseClass') instanceof LuaTable && T.get('BaseClass') !== T ? T.get('BaseClass') : B;
      for (const k of Bf.claves()) if (k !== 'BaseClass' && T.get(k) === undefined) T.set(k, Bf.get(k));
      T.set('BaseClass', Bf);
      (GMA.bases || (GMA.bases = new Map())).set('gamemode_' + x, T);
      B = T;
    }
    modo[ctx] = B;
  }
  modo.cargando = false;
  // (la pantalla de elegir equipo de GMod es vgui, que acá no se dibuja: la propia)
  modo.C.set('ShowTeam', () => { gmmEquiposAbrir(); return E0; });
  G.set('GM', modo.S); G.set('GAMEMODE', modo.S);
  const gm = (ev, ctx, ...a) => { const t = modo[ctx], f = t.get(ev); return typeof f === 'function' ? gmLlamar(f, ctx, t, ...a) : E0; };
  for (const c of ['S', 'C']) gm('CreateTeams', c);
  for (const ev of ['PreGamemodeLoaded', 'OnGamemodeLoaded', 'PostGamemodeLoaded', 'Initialize']) for (const c of ['S', 'C']) gm(ev, c);
  for (const c of ['S', 'C']) gm('InitPostEntity', c);
  // el jugador entra: PlayerInitialSpawn y PlayerSpawn (con los hooks de los addons), sin las armas del sandbox
  if (!modo.sandbox) gmmSinArmas();
  gmaHook('PlayerInitialSpawn', 'S', GMA.jug, false);
  GMA.jugVivo = !!JUG.vivo;
  if (JUG.vivo) gmaHook('PlayerSpawn', 'S', GMA.jug, false);
  gmmBarra(true);
  if (R_T(modo.S.get('TeamBased')) && [1001, 1002, 0].includes(GMA.equipo ?? 1001)) setTimeout(() => { if (GMA.modo === modo) gmmEquiposAbrir(); }, 600);
  return true;
}
const gmmLlamarGM = (ev, ctx, ...a) => { const M = GMA.modo; if (!M || M.cargando) return E0; const t = M[ctx]; const f = t && t.get(ev); return typeof f === 'function' ? gmLlamar(f, ctx, t, ...a) : E0; };
// ¿el modo decide cuándo se reaparece? (si tiene PlayerDeathThink y no falla; igual, a los 5 min muerto se reaparece)
function gmmManejaMuerte() { const M = GMA.modo; return !!(M && !M.cargando && !M.muerteRota && typeof M.S.get('PlayerDeathThink') === 'function' && JUG.muertoT > -300); }
// sin las armas del juego (en GMod se aparece sin nada y el modo da las suyas con PlayerLoadout)
function gmmSinArmas() {
  if (GMA.armasJug) for (const c of [...GMA.armasJug.keys()]) gmaQuitarArma(c);
  if (typeof ARM === 'undefined') return;
  ARM.lista = ['Hands']; ARM.balas = {}; if (typeof elegirArma === 'function') elegirArma(0);
}
// Player:Spawn() del Lua: aparecer ya (en un punto de aparición) y avisar al modo
function gmmAparecer() {
  if (typeof jugadorAparecer !== 'function') return;
  jugadorAparecer(); if (typeof jugadorCuerpoNuevo === 'function') jugadorCuerpoNuevo();
  GMA.jugVivo = true; GMA.obs = 0; if (JUG.noclip && GMA.obsNoclip) { JUG.noclip = false; GMA.obsNoclip = false; }
  if (GMA.modo && !GMA.modo.sandbox) gmmSinArmas();
  gmaHook('PlayerSpawn', 'S', GMA.jug, false); if (!GMA.modo) gmaHook('PlayerLoadout', 'S', GMA.jug);
}

// ---- la API de Lua que cambia con los modos: equipos, frags, espectador, DeriveGamemode, SendLua ----
function gmmApi(R, G, PLY_M, def, tabla, num) {
  const EQ = (GMA.equipos = new Map()), col = (r, g, b) => GMA.color(r, g, b, 255);
  GMA.equipo = undefined; GMA.frags = 0; GMA.muertes = 0; GMA.obs = 0; GMA.obsObj = null;
  const poner = (id, n, c, j) => EQ.set(id, { n: String(n), c: c instanceof LuaTable ? c : col(255, 255, 100), j: j !== false, score: 0, spawns: null, clases: null });
  poner(0, 'Joining/Connecting', col(255, 255, 100), false); poner(1001, 'Unassigned', col(255, 255, 100), false); poner(1002, 'Spectator', col(255, 255, 100), true);
  const jugadores = () => [GMA.jug].filter(Boolean), equipoDe = (p) => (p === GMA.jug ? GMA.equipo ?? 1001 : 1001);
  const team = G.get('team') instanceof LuaTable ? G.get('team') : (G.set('team', new LuaTable()), G.get('team'));
  def(team, 'SetUp', (id, n, c, j) => { poner(num(id, 0), n, c, j); });
  def(team, 'GetName', (id) => (EQ.get(num(id, -1)) ? EQ.get(num(id, -1)).n : ''));
  def(team, 'GetColor', (id) => (EQ.get(num(id, -1)) ? EQ.get(num(id, -1)).c : col(255, 255, 100)));
  def(team, 'Valid', (id) => EQ.has(num(id, -1)));
  def(team, 'Joinable', (id) => !!(EQ.get(num(id, -1)) && EQ.get(num(id, -1)).j));
  def(team, 'NumPlayers', (id) => jugadores().filter((p) => equipoDe(p) === num(id, -1)).length);
  def(team, 'GetPlayers', (id) => R.tab(jugadores().filter((p) => equipoDe(p) === num(id, -1))));
  def(team, 'GetAllTeams', () => { const t = new LuaTable(); for (const [id, e] of EQ) t.set(id, tabla({ Name: e.n, Color: e.c, Score: e.score, Joinable: e.j })); return t; });
  def(team, 'GetScore', (id) => (EQ.get(num(id, -1)) ? EQ.get(num(id, -1)).score : 0));
  def(team, 'SetScore', (id, s) => { const e = EQ.get(num(id, -1)); if (e) e.score = num(s, 0); });
  def(team, 'AddScore', (id, s) => { const e = EQ.get(num(id, -1)); if (e) e.score += num(s, 0); });
  def(team, 'TotalFrags', (id) => (num(id, -1) === equipoDe(GMA.jug) ? GMA.frags : 0));
  def(team, 'TotalDeaths', (id) => (num(id, -1) === equipoDe(GMA.jug) ? GMA.muertes : 0));
  def(team, 'BestAutoJoinTeam', () => { let mejor = 1001, nMejor = Infinity; for (const [id, e] of EQ) { if (!e.j || id <= 0 || id >= 1000) continue; const k = jugadores().filter((p) => equipoDe(p) === id).length; if (k < nMejor) { nMejor = k; mejor = id; } } return mejor; });
  def(team, 'SetSpawnPoint', (id, s) => { const e = EQ.get(num(id, -1)); if (e) e.spawns = s; }); def(team, 'GetSpawnPoint', (id) => (EQ.get(num(id, -1)) && EQ.get(num(id, -1)).spawns) || new LuaTable()); def(team, 'GetSpawnPoints', (id) => new LuaTable());
  def(team, 'SetClass', (id, c) => { const e = EQ.get(num(id, -1)); if (e) e.clases = c instanceof LuaTable ? c : R.tab([c]); }); def(team, 'GetClass', (id) => (EQ.get(num(id, -1)) ? EQ.get(num(id, -1)).clases || undefined : undefined));
  // el jugador
  const P = (k, f) => PLY_M.set(k, f);
  P('Team', (p) => equipoDe(p)); P('SetTeam', (p, t) => { if (p === GMA.jug) { GMA.equipo = num(t, 1001); gmmBarra(!!GMA.modo); } });
  P('Frags', () => GMA.frags); P('Deaths', () => GMA.muertes); P('AddFrags', (p, n) => { GMA.frags += num(n, 0); }); P('AddDeaths', (p, n) => { GMA.muertes += num(n, 0); }); P('SetFrags', (p, n) => { GMA.frags = num(n, 0); }); P('SetDeaths', (p, n) => { GMA.muertes = num(n, 0); });
  P('Spawn', (p) => { if (p === GMA.jug) gmmAparecer(); });
  P('KillSilent', (p) => { if (p !== GMA.jug || !JUG.vivo) return; GMA.muerteMuda = true; if (typeof morirJugador === 'function') morirJugador(true); });
  P('Spectate', (p, m) => { if (p !== GMA.jug) return; GMA.obs = num(m, 0); if (GMA.obs === 6 && !JUG.noclip) { JUG.noclip = true; GMA.obsNoclip = true; } });
  P('UnSpectate', (p) => { if (p !== GMA.jug) return; GMA.obs = 0; GMA.obsObj = null; if (GMA.obsNoclip) { JUG.noclip = false; GMA.obsNoclip = false; } });
  P('GetObserverMode', () => GMA.obs || 0); P('SpectateEntity', (p, e) => { GMA.obsObj = e instanceof LEnt ? e : null; }); P('GetObserverTarget', () => GMA.obsObj || NULL_ENT);
  P('StripWeapons', (p) => { if (p === GMA.jug && GMA.modo && !GMA.modo.sandbox) gmmSinArmas(); });
  P('SendLua', (p, s) => { gmaEnLado('C', () => G.get('RunString')(String(s), 'SendLua')); });
  P('SetObserverMode', (p, m) => { if (p === GMA.jug) GMA.obs = num(m, 0); });
  P('SwitchToDefaultWeapon', (p) => { if (p === GMA.jug && typeof ARM !== 'undefined' && typeof elegirArma === 'function' && ARM.lista.length) elegirArma(0); });
  { const E = GMA.metas && GMA.metas.Entity; if (E) for (const k of ['SendWeaponAnim', 'ClearPoseParameters']) if (E.get(k) === undefined) E.set(k, () => {}); }
  for (const k of ['SetStepSize', 'ClearPoseParameters', 'SetSlowWalkSpeed', 'SetMaxArmor', 'RemoveAllAmmo', 'SetDSP', 'SetAvoidPlayers', 'SetNoCollideWithTeammates', 'SetDuckSpeed', 'SetUnDuckSpeed', 'AllowFlashlight', 'SetCanZoom', 'SetupHands', 'StripAmmo', 'ResetHull', 'SetHull', 'SetHullDuck', 'SetViewOffset', 'SetViewOffsetDucked', 'SetPlayerColor', 'SetWeaponColor', 'CrosshairEnable', 'CrosshairDisable', 'SetNoTarget']) if (PLY_M.get(k) === undefined) P(k, () => {});
  def(G, 'BroadcastLua', (s) => { gmaEnLado('C', () => G.get('RunString')(String(s), 'BroadcastLua')); });
  // DeriveGamemode (mientras se carga un modo): la base de este lado
  def(G, 'DeriveGamemode', (n) => { const M = GMA.modo, T = G.get('GM'); if (!M || !M.cargando || !(T instanceof LuaTable)) return; const b = M.t.get(String(n).toLowerCase() + ':' + GMA.ctx); if (b && b !== T) T.set('BaseClass', b); });
  // baseclass.Get("gamemode_x") (DEFINE_BASECLASS en los modos)
  const bc = G.get('baseclass'); if (bc instanceof LuaTable) { const get0 = bc.get('Get'); def(bc, 'Get', (n) => { const s = String(n); const m = /^gamemode_(.+)$/.exec(s); if (m && GMA.modo) { const t = GMA.modo.t.get(m[1].toLowerCase() + ':' + GMA.ctx); if (t) return t; } return get0(n); }); }
  // game.GetMap(): el nombre del BSP (los del Workshop van con WS_ adelante en la lista)
  const nomMapa = () => { const k = typeof MUNDO !== 'undefined' ? MUNDO.nombre : 'gm_flatgrass'; return typeof GBSP !== 'undefined' && GBSP.mapas.get(k) ? GBSP.mapas.get(k).nombre : k; };
  def(G, 'GetMap', nomMapa); const game = G.get('game'); if (game instanceof LuaTable) def(game, 'GetMap', nomMapa);
}

// ---- elegir equipo (en vez del vgui de GMod) ----
function gmmEquiposAbrir() {
  const M = GMA.modo; if (!M || !GMA.equipos) return;
  const L = [...GMA.equipos].filter(([id, e]) => id > 0 && id < 1000 && e.j); if (!L.length) return;
  let d = document.getElementById('gmmEq');
  if (!d) {
    d = document.createElement('div'); d.id = 'gmmEq'; document.body.appendChild(d);
    d.addEventListener('pointerdown', (e) => e.stopPropagation());
    d.addEventListener('click', (e) => { const b = e.target.closest('[data-eq]'); if (!b) return; const v = b.dataset.eq; gmmEquiposCerrar(); if (v !== 'x') gmmPedirEquipo(v === 'auto' ? null : +v); });
  }
  const c = (e) => { const t = e.c; return t instanceof LuaTable ? `rgb(${t.get('r') | 0},${t.get('g') | 0},${t.get('b') | 0})` : '#fc6'; };
  const cuantos = (id) => ((GMA.equipo ?? 1001) === id ? 1 : 0), esc2 = (s) => String(s).replace(/[&<>"']/g, (x) => '&#' + x.charCodeAt(0) + ';');
  d.innerHTML = `<div class="gmmCaja"><b>${esc2(M.titulo)}</b><small>${esc2(T('gm.equipo'))}</small>
    ${L.map(([id, e]) => `<button data-eq="${id}" style="--c:${c(e)}"><i></i>${esc2(e.n)}<em>${cuantos(id)}</em></button>`).join('')}
    <button data-eq="auto" class="gmmAuto">${esc2(T('gm.equipoAuto'))}</button>${GMA.equipos.get(1002) && GMA.equipos.get(1002).j ? `<button data-eq="1002" class="gmmAuto">${esc2(GMA.equipos.get(1002).n)}</button>` : ''}
    <button data-eq="x" class="gmmX">✕</button></div>`;
  if (UI.abierto && UI.abierto !== 'gmmeq' && typeof cerrarPaneles === 'function') cerrarPaneles();
  d.classList.remove('oc'); UI.abierto = 'gmmeq'; if (typeof soltarPuntero === 'function') soltarPuntero();
}
function gmmEquiposCerrar() { const d = document.getElementById('gmmEq'); if (d) d.classList.add('oc'); if (typeof UI !== 'undefined' && UI.abierto === 'gmmeq') UI.abierto = null; }
function gmmPedirEquipo(id) {
  const M = GMA.modo; if (!M) return;
  if (id === null) { const f = M.S.get('AutoTeam'); if (typeof f === 'function') { gmLlamar(f, 'S', M.S, GMA.jug); gmmBarra(true); return; } id = GMA.R.G.get('team').get('BestAutoJoinTeam')(); if (Array.isArray(id)) id = id[0]; if (typeof id !== 'number') id = 1001; }
  const f = M.S.get('PlayerRequestTeam');
  if (typeof f === 'function') gmLlamar(f, 'S', M.S, GMA.jug, id); else GMA.equipo = id;
  gmmBarra(true);
}

// ---- la barrita de arriba: el modo, tu equipo y el tiempo de la ronda (si el modo lo publica, como los de fretta) ----
function gmmBarra(on) {
  let b = document.getElementById('gmmBarra');
  if (!on || !GMA.modo) { if (b) b.classList.add('oc'); return; }
  if (!b) { b = document.createElement('div'); b.id = 'gmmBarra'; document.body.appendChild(b); b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('click', () => gmmEquiposAbrir()); }
  b.classList.remove('oc'); gmmBarraPaso(true);
}
function gmmBarraPaso(ya) {
  const M = GMA.modo, b = document.getElementById('gmmBarra'); if (!M || !b || b.classList.contains('oc')) return;
  if (!ya && (GMM.tBarra = (GMM.tBarra || 0) + 1) % 15) return;
  const eq = GMA.equipos && GMA.equipos.get(GMA.equipo ?? 1001), g = GMA.glob || new Map();
  let txt = M.titulo; if (eq && R_T(M.S.get('TeamBased'))) txt += ' · ' + eq.n;
  const n = g.get('RoundNumber'); if (typeof n === 'number' && n > 0) txt += ' · ' + T('gm.ronda') + ' ' + n;
  const fin = g.get('RoundEndTime'); if (typeof fin === 'number' && fin > 0 && g.get('InRound') !== false) { const s = Math.max(0, Math.round(fin - TIEMPO.t)); txt += ' · ' + ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0'); }
  const rr = g.get('RRText'); if (typeof rr === 'string' && rr && g.get('InRound') === false) txt += ' · ' + rr;
  if (b.textContent !== txt) b.textContent = txt;
  const c = eq && eq.c instanceof LuaTable ? `rgb(${eq.c.get('r') | 0},${eq.c.get('g') | 0},${eq.c.get('b') | 0})` : '';
  b.style.borderColor = c || '';
}
