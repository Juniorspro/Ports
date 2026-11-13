// ---------------------------------------------------------------------------------------------------------
// Los Pill Packs del Workshop (los addons hechos para pk_pills, «Parakeet's Pill Pack»): sus personajes aparecen en la
// pestaña Pill Packs con su nombre, su ícono (materials/pills/<nombre>.png) y su modelo, agrupados por pack como en GMod.
// En GMod esos addons hacen require("pk_pills") y registran cada personaje con pk_pills.register(nombre, { printName,
// model, health, moveSpeed, jumpPower, camera, anims, sounds, attack, attack2, reload... }). Acá el módulo pk_pills es
// propio (el de verdad arma al personaje con entidades del motor de Source que acá no existen): junta lo registrado, con
// la herencia de «parent», y de cada personaje de tipo «ply» (los que caminan) sale un Pill del juego:
//  · el modelo como cuerpo (gmod_pm.js: con esqueleto de Valve, las animaciones del juego; si no, sus secuencias: las
//    de anims.default —idle, walk, run, crouch, jump— y las de un toque que pida su Lua);
//  · vida, velocidad (walk/run de Source a m/s), salto y distancia de la cámara;
//  · los ataques: pk_pills.common.melee es el golpe (daño, alcance, espera y sus sonidos) y pk_pills.common.shoot el
//    disparo; una función propia del addon (attack, attack2, reload) se corre con el jugador y una entidad que hace de
//    «pill» (PillSound, PillAnim, PillLoopSound, GetPuppet...): lo que use del motor que acá no hay, falla sin romper;
//  · sus sonidos (pasos, golpes) salen del addon.
// Los de tipo «phys» (los que se manejan como un objeto: helicópteros, minas) no se pueden usar y no se listan.
// ---------------------------------------------------------------------------------------------------------
const PGM = { formas: new Map(), packs: [], pack: null, defs: new Map(), ent: null, icos: new Map(), loops: new Map(), fallos: new Set(), M: null };
const pgmRuta = (m) => { let r = String(m || '').toLowerCase().replace(/\\/g, '/'); if (r && !r.startsWith('models/')) r = 'models/' + r; return r; };
// copiar y mezclar tablas de Lua como table.Copy y table.Merge (la herencia de «parent» de pk_pills)
function pgmCopiar(t, visto) {
  if (!(t instanceof LuaTable)) return t; visto = visto || new Map(); if (visto.has(t)) return visto.get(t);
  const c = new LuaTable(); visto.set(t, c); for (const k of t.claves()) c.set(k, pgmCopiar(t.get(k), visto)); c.mt = t.mt; return c;
}
function pgmMezclar(dst, src) {
  for (const k of src.claves()) { const v = src.get(k), d = dst.get(k); if (v instanceof LuaTable && d instanceof LuaTable) pgmMezclar(d, v); else dst.set(k, v); }
  return dst;
}
// la tabla de un personaje con lo de sus padres (una vez)
function pgmForma(n, prof) {
  const F = PGM.formas.get(n); if (!F) return null; if (F.m) return F.m;
  const p = F.t.get('parent');
  if (typeof p === 'string' && p !== n && (prof || 0) < 12) { const P = pgmForma(p, (prof || 0) + 1); if (P) { F.m = pgmMezclar(pgmCopiar(P), F.t); F.m.set('parent', undefined); return F.m; } }
  return (F.m = F.t);
}
// una lista de Lua (o un texto solo) como arreglo de textos
function pgmLista(v) { if (typeof v === 'string') return v ? [v] : []; if (!(v instanceof LuaTable)) return []; const L = []; for (const k of v.claves()) { const x = v.get(k); if (typeof x === 'string' && x) L.push(x); } return L; }
const pgmNum = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
// ---------------- el módulo pk_pills propio ----------------
function pillGmInstalar(R) {
  const G = R.G, M = new LuaTable(), def = (t, n, f) => t.set(n, f);
  PGM.formas = new Map(); PGM.packs = []; PGM.pack = null; PGM.defs = new Map(); PGM.M = M; PGM.fallos = new Set();
  if (PGM.ent) { PGM.ent.vivo = false; PGM.ent = null; }
  // (el autorun corre del lado del servidor y del cliente: el mismo pack del mismo addon se arma una sola vez)
  def(M, 'packStart', (name, id, icon) => {
    const n = typeof name === 'string' && name.trim() ? name.trim().slice(0, 40) : 'Pills', i = String(id || ''), a = GMA.addonActual || null;
    PGM.pack = PGM.packs.find((p) => p.n === n && p.id === i && p.addon === a) || null;
    if (!PGM.pack) { PGM.pack = { n, id: i, items: [], addon: a }; PGM.packs.push(PGM.pack); }
  });
  def(M, 'packRequireGame', () => {}); def(M, 'hasPack', (n) => PGM.packs.some((p) => p.id.toLowerCase() === String(n).toLowerCase())); def(M, 'getPacks', () => PGM.packs.map((p) => p.id).join(' '));
  def(M, 'register', (name, t) => {
    if (typeof name !== 'string' || !(t instanceof LuaTable)) return;
    t.set('name', name);
    if (!PGM.pack) { PGM.pack = { n: (GMA.addonActual && GMA.addonActual.nombre) || 'Pills', id: 'pills', items: [], addon: GMA.addonActual || null }; PGM.packs.push(PGM.pack); }
    PGM.formas.set(name, { t, m: null, pack: PGM.pack, addon: GMA.addonActual || PGM.pack.addon || null });
    if (!PGM.pack.items.includes(name)) PGM.pack.items.push(name);
    PGM.defs.delete('gm:' + name);
  });
  def(M, 'getPillTable', (n) => pgmForma(String(n)) || undefined); def(M, 'getFormCount', () => PGM.formas.size);
  def(M, 'getRandomForm', () => { const L = [...PGM.formas.keys()]; return L[(Math.random() * L.length) | 0]; });
  // (lo que arma el motor de pk_pills: quién usa qué. Acá, el personaje del jugador)
  def(M, 'getMappedEnt', (ply) => (ply === GMA.jug && PILL.on && PILL.def && PILL.def.gm ? pgmEnt() : undefined));
  def(M, 'mapEnt', () => {}); def(M, 'unmapEnt', () => {});
  def(M, 'apply', (ply, name) => { if (ply === GMA.jug && typeof name === 'string' && pillGmDef('gm:' + name)) { pillAplicar('gm:' + name); return pgmEnt(); } });
  def(M, 'restore', (ply) => { if (ply === GMA.jug && PILL.on) { pillFin(); return true; } return false; });
  for (const n of ['registerDrive', 'registerVox', 'setAiTeam', 'handeDeathCommon', 'registerAttachment']) def(M, n, () => {});
  def(M, 'getAiTeam', () => undefined); def(M, 'getDrive', () => undefined);
  const H = new LuaTable(); def(M, 'helpers', H);
  def(H, 'makeList', (str, n1, n2) => { if (n2 === undefined) { n2 = n1; n1 = 1; } const L = new LuaTable(); for (let i = +n1 || 1; i <= (+n2 || 0); i++) L.set(L.len() + 1, String(str).split('#').join(String(i))); return L; });
  // (los ataques comunes: se reconocen por la función; llamados a mano por el Lua de un addon, hacen lo mismo)
  const C = new LuaTable(); def(M, 'common', C);
  PGM.melee = (ply, ent, tbl) => { if (ply === GMA.jug && PILL.on && tbl instanceof LuaTable) pillGolpe(pgmHabGolpe(tbl, PILL.def.gmT)); };
  PGM.shoot = (ply, ent, tbl) => { if (ply === GMA.jug && PILL.on && tbl instanceof LuaTable) pillDisparo(pgmHabDisparo(tbl, PILL.def.gmT)); };
  def(C, 'melee', PGM.melee); def(C, 'shoot', PGM.shoot);
  const cv = new LuaTable(); def(M, 'convars', cv);
  def(M, '_restricted', new LuaTable());
  G.set('pk_pills', M);
  // require("pk_pills"): el propio (el de verdad, si el pack base está instalado, no se corre)
  const req0 = G.get('require');
  G.set('require', (n) => { if (String(n).toLowerCase() === 'pk_pills') { if (GMA.requeridos) GMA.requeridos.set('pk_pills', true); return true; } return typeof req0 === 'function' ? req0(n) : undefined; });
}
// (cada vez que arranca el Lua de los addons: gmaIniciar arma el entorno de cero)
const _pgmIniciar0 = gmaIniciar;
gmaIniciar = function () {
  const nuevo = !GMA.R, R = _pgmIniciar0.apply(this, arguments);
  if (nuevo && GMA.R) { try { pillGmInstalar(GMA.R); } catch (e) { console.warn('pk_pills', e); } }
  return R;
};
// ---------------- de la tabla de pk_pills al Pill del juego ----------------
function pgmHabGolpe(a, F) {
  const snd = F && F.get('sounds'), S = (k) => (snd instanceof LuaTable ? pgmLista(snd.get(k)) : []);
  return { t: 'golpe', gm: true, dan: clamp(pgmNum(a.get('dmg'), 25), 1, 100000), alc: clamp(pgmNum(a.get('range'), 40) * GM_S + 0.9, 1.3, 4.5), cd: clamp(pgmNum(a.get('delay'), 0.5), 0.1, 1.5) + 0.3, costo: 0, clip: 'gm_range_melee', imp: clamp(pgmNum(a.get('delay'), 0.2), 0.1, 1.5),   // (como common.melee: el golpe llega «delay» segundos después)
    sonGm: S('melee'), sonHit: S('melee_hit'), sonMiss: S('melee_miss'), animN: pgmNum(a.get('animCount'), 0) | 0 };
}
function pgmHabDisparo(a, F) {
  const snd = F && F.get('sounds'), S = (k) => (snd instanceof LuaTable ? pgmLista(snd.get(k)) : []);
  return { t: 'disparo', gm: true, dan: clamp(pgmNum(a.get('damage'), 10), 1, 100000), num: clamp(pgmNum(a.get('num'), 1) | 0, 1, 12), disp: clamp(pgmNum(a.get('spread'), 0.01), 0, 0.5), cd: clamp(pgmNum(a.get('delay'), 0.15), 0.05, 10), costo: 0,
    son: azarDe(S('shoot')) || '', sonL: S('shoot') };
}
// (F: la tabla del personaje; el nombre del botón es una clave de texto, n, que se traduce al dibujarlo)
function pgmHab(a, F, nom) {
  if (typeof a === 'function') return { t: 'lua', gm: true, f: a, costo: 0, cd: 1, n: nom };
  if (!(a instanceof LuaTable)) return null;
  const f = a.get('func'); if (typeof f !== 'function') return null;
  if (f === PGM.melee) return pgmHabGolpe(a, F);
  if (f === PGM.shoot) return pgmHabDisparo(a, F);
  return { t: 'lua', gm: true, f, costo: 0, cd: clamp(pgmNum(a.get('delay'), 0.5), 0.1, 10), n: nom, tbl: a };
}
// el modelo de un personaje (el suyo o, si lo elige entre varios —options—, el primero)
function pgmModelo(T) {
  let m = T.get('model');
  if (typeof m !== 'string') { const o = T.get('options'); if (typeof o === 'function') { try { const L = gmLlamar(o, 'S')[0]; const x = L instanceof LuaTable ? L.get(1) : null; if (x instanceof LuaTable) m = x.get('model'); } catch (e) {} } }
  return typeof m === 'string' && /\.mdl$/i.test(m) ? pgmRuta(m) : null;
}
const pgmVivo = () => !!(GMA.R && PGM.M && GMA.R.G.get('pk_pills') === PGM.M);   // (el Lua de ahora es el que registró lo que hay)
function pillGmDef(id) {
  if (typeof id !== 'string' || !id.startsWith('gm:') || !PGM.formas.size || !pgmVivo()) return null;
  if (PGM.defs.has(id)) return PGM.defs.get(id);
  const n = id.slice(3), F = PGM.formas.get(n), T = F && pgmForma(n); let D = null;
  if (T && typeof T.get('printName') === 'string' && (T.get('type') === undefined || T.get('type') === 'ply')) {
    const ruta = pgmModelo(T);
    if (ruta && gmExiste(ruta)) {
      const mv = T.get('moveSpeed'), walk = clamp(pgmNum(mv instanceof LuaTable ? mv.get('walk') : undefined, 200), 20, 800), run = clamp(pgmNum(mv instanceof LuaTable ? mv.get('run') : undefined, walk), walk, 1200);
      const cam = T.get('camera'), dist = pgmNum(cam instanceof LuaTable ? cam.get('dist') : undefined, 100), snd = T.get('sounds'), an = T.get('anims');
      // la velocidad respecto del jugador de GMod (camina a 200 unidades/s, el de acá a 6 m/s): Foxy del pack de FNaF (300)
      // camina a 9 m/s y Freddy (180), al mínimo, 6, lo que camina el jugador (antes iban a 0,0254 m por unidad: 4,6 y
      // 7,6, más lentos que uno). Todos tienen carrera: la del pack si corre más de lo que camina (como mínimo ×1,5) y si
      // no ×1,5, siempre por encima de 9 m/s, más que el correr del jugador (8,1)
      const vel = clamp(walk * PILL_VEL_JUG / 200, PILL_VEL_JUG, 15), mult = clamp(Math.max(run > walk * 1.1 ? run / walk : 1.5, 1.5, 9 / vel), 1.5, Math.max(1.5, 18 / vel));
      const hab = [pgmHab(T.get('attack'), T, 'lua1'), pgmHab(T.get('attack2'), T, 'lua2'), { t: 'carrera', mult, gasto: 14, man: true }, pgmHab(T.get('reload'), T, 'lua3')];
      // el salto: el de pk_pills (jumpPower; sin él, el de GMod: 200 = 1,1 m, lo del jugador); con jumpPower = 0 el pack
      // no deja saltar (el de FNaF): acá sí, según el tamaño del modelo (pillSaltoDe, salto 0)
      const jp = pgmNum(T.get('jumpPower'), 200);
      D = { id, gm: true, gmN: n, gmT: T, R: GMA.R, nom: String(T.get('printName')).slice(0, 40), skin: 'gmpm:' + ruta, ruta, cat: 'gm', poder: /fnaf|freddy/i.test(F.pack.n + ' ' + F.pack.id) ? 'fnaf' : 'energia', pack: F.pack.n,   // (los de FNaF, con la barra «FNAF Power» como en la idea)
         addon: F.addon,
        vida: clamp(Math.round(pgmNum(T.get('health'), 100)), 1, 999999), vel, salto: jp > 0 ? clamp(1.1 * jp / 200, 0.3, 12) : 0, cam: clamp(dist * GM_S + 1.2, 2.2, 9),
        hab, sinHab: !hab.some((h) => h && h.t !== 'carrera'), pasosGm: snd instanceof LuaTable ? pgmLista(snd.get('step')) : [],
        anims: an instanceof LuaTable && an.get('default') instanceof LuaTable ? an.get('default') : null, alCuerpo: pgmCuerpo };
    }
  }
  PGM.defs.set(id, D); return D;
}
// los packs con sus personajes que se pueden usar (para la pestaña)
function pillGmPacks() {
  const L = []; if (!pgmVivo()) return L;
  for (const p of PGM.packs) {
    if (p.addon && p.addon.cens && typeof censOficial === 'function' && censOficial()) continue;   // (en un server oficial, nada de un mod censurado)
    const it = p.items.filter((n) => !!pillGmDef('gm:' + n)).sort((a, b) => pillGmDef('gm:' + a).nom.localeCompare(pillGmDef('gm:' + b).nom, undefined, { numeric: true, sensitivity: 'base' })).map((n) => 'gm:' + n);
    if (it.length) { const x = L.find((y) => y[0] === p.n); if (x) x[1].push(...it.filter((i) => !x[1].includes(i))); else L.push([p.n, it]); }
  }
  return L;
}
// el ícono: el .png del pack (materials/pills/<nombre>.png, como en GMod) o el modelo dibujado
function pillGmIcono(D) {
  const r = 'materials/pills/' + D.gmN.toLowerCase() + '.png';
  if (PGM.icos.has(r)) return { src: PGM.icos.get(r) };
  const b = gmExiste(r) ? gmArchivo(r) : null;
  if (b && b.length > 8 && b[0] === 0x89 && b[1] === 0x50) { const u = URL.createObjectURL(new Blob([b], { type: 'image/png' })); PGM.icos.set(r, u); return { src: u }; }
  if (gmExiste(r)) { PGM.icoPend = true; }   // (está en el disco: llega enseguida; la grilla se vuelve a dibujar)
  return { src: gmIcono('gm:' + D.ruta), gm: 'gm:' + D.ruta };
}
// ---------------- el cuerpo: las secuencias del modelo que dice el pack ----------------
function pgmCuerpo(P) { P.pillUna = null; P.pillSecs = null; }
function pgmSec(M, nombre, mov) {
  if (typeof nombre !== 'string' || !M || !M.secuencias) return -1;
  const k = nombre.toLowerCase(), i = M.secuencias.findIndex((q) => String(q.n || '').toLowerCase() === k); if (i < 0) return -1;
  let ia = -1; try { ia = GMF.animDe(M, i, mov ? { move_x: 1, move_y: 0 } : null); } catch (e) { return -1; }
  const A2 = ia >= 0 && M.anims[ia]; return A2 && A2.nf > 0 && (A2.bloque === 0 || A2.src || (M.bloques && M.bloques[A2.bloque])) ? ia : -1;
}
function pgmSecs(D, def) {
  const c = def.pillSecs || (def.pillSecs = new Map()); if (c.has(D.id)) return c.get(D.id);
  const a = D.anims, M = def.M, S0 = def.secs || {}, g = (k, mov) => (a ? pgmSec(M, a.get(k), mov) : -1), o = (x, y) => (x >= 0 ? x : y);
  const S = { quieto: o(g('idle'), S0.quieto), camina: o(g('walk', true), S0.camina), corre: o(o(g('run', true), g('walk', true)), S0.corre), agachado: o(g('crouch'), S0.agachado), salta: o(o(g('glide'), g('jump')), S0.salta) };
  c.set(D.id, S); return S;
}
const _pgmPropio0 = gmpPropio;
gmpPropio = function (P) {
  const D = P.pill, G = P.gmp, def = G && G.def;
  if (!D || !D.gm || !def || !def.secs) return _pgmPropio0.apply(this, arguments);
  const s0 = def.secs; let S = pgmSecs(D, def);
  // (una animación de un toque —el golpe, lo que pida su Lua—: hasta que termina)
  const U = P.pillUna;
  if (U) { const An = def.M.anims[U.ia], dur = An ? Math.max(0.1, (An.nf - 1) / (An.fps > 0 ? An.fps : 30)) : 0; if (!An || TIEMPO.t - U.t0 >= dur) P.pillUna = null; else S = { quieto: U.ia, camina: U.ia, corre: U.ia, agachado: U.ia, salta: U.ia }; }
  def.secs = S; try { return _pgmPropio0.apply(this, arguments); } finally { def.secs = s0; }
};
// tocar una animación del pack en el cuerpo (si el modelo se mueve con sus secuencias; con esqueleto de Valve, el gesto del juego)
function pgmAnim(P, D, nombre) {
  if (!P || !D) return false;
  const G = P.gmp, def = G && G.def, a = D.anims, sq = a && typeof nombre === 'string' ? a.get(nombre) : null;
  if (def && def.secs && typeof sq === 'string') { const ia = pgmSec(def.M, sq, false); if (ia >= 0) { P.pillUna = { ia, t0: TIEMPO.t }; G.sec = -2; return true; } }
  return false;
}
// ---------------- los sonidos del addon ----------------
function pillGmSonar(s, pos, vol) {
  if (typeof s !== 'string' || !s || typeof gmSonido !== 'function') return;
  let n = null; try { n = gmSonido(s.replace(/^gm:/, '')); } catch (e) { return; } if (!n) return;
  const v = vol === undefined ? 0.8 : vol, P = pos ? v3(pos.x, pos.y, pos.z) : null, t0 = performance.now();
  if (AUD.ctx && audioBuf(n)) sonar(n, P, v);
  else if (AUD.ctx) audioBuf(n, () => { if (performance.now() - t0 < 600) sonar(n, P, v); });   // (la primera vez se decodifica: suena si llega enseguida)
}
// ---------------- la entidad que hace de «pill» para el Lua del addon ----------------
function pgmEnt() {
  const D = PILL.def; if (!D || !D.gm || !GMA.R) return undefined;
  if (PGM.ent && PGM.ent.vivo && PGM.ent.pillId === D.id) { PGM.ent.P = JUG.cuerpo; return PGM.ent; }
  if (PGM.ent) PGM.ent.vivo = false;
  const e = new LEnt('jx_pill', 'ent'), T = e.tabla; e.pillId = D.id; e.P = JUG.cuerpo; e.creado = true; e.modelo = D.ruta;
  const snd = D.gmT.get('sounds'), lista = (k) => (snd instanceof LuaTable ? pgmLista(snd.get(k)) : []);
  T.set('formTable', D.gmT); T.set('active', true);
  T.set('PillSound', (s, k) => { const L = lista(String(k)); if (!L.length) return; const x = azarDe(L); pillGmSonar(x, null, 0.8); pillPublicar({ h: 'son', s: x.slice(0, 120) }); });
  T.set('PillAnim', (s, k) => { if (pgmAnim(JUG.cuerpo, D, String(k))) pillPublicar({ h: 'anim', c: String(k).slice(0, 40) }); });
  T.set('PillAnimTick', (s, k) => { if (!JUG.cuerpo || !JUG.cuerpo.pillUna) pgmAnim(JUG.cuerpo, D, String(k)); });
  T.set('PillGesture', (s, k) => { if (!pgmAnim(JUG.cuerpo, D, String(k))) pillAccion(JUG.cuerpo, 'gm_range_melee', 0.6); });
  T.set('PillLoopSound', (s, k) => { const L = lista(String(k)); if (L.length) PGM.loops.set(String(k), L[0]); });
  T.set('PillLoopStop', (s, k) => { PGM.loops.delete(String(k)); }); T.set('PillLoopStopAll', () => { PGM.loops.clear(); });
  T.set('GetPuppet', () => e); T.set('GetPillUser', () => GMA.jug); T.set('GetPillForm', () => D.gmN); T.set('GetPillAimEnt', () => e); T.set('PillFilterCam', () => {});
  T.set('SetPillForm', () => {}); T.set('SetPillUser', () => {}); T.set('PillDie', () => { if (PILL.on) pillFin(); });
  return (PGM.ent = e);
}
// una función del addon (attack, attack2, reload) con el jugador y su «pill»
function pillGmLua(h) {
  const e = pgmEnt(); if (!e || typeof h.f !== 'function' || !GMA.R) return false;
  const R = GMA.R, c0 = GMA.ctx; GMA.ctx = 'S'; gmaLado('S'); const n0 = R.n; R.n = 0;
  try { R.c(h.f, 'pill', GMA.jug, e, h.tbl); }
  catch (er) {
    // (usa algo del motor de Source que acá no hay: se avisa una vez y esa habilidad queda apagada)
    const k = PILL.id + '|' + (h.n || ''); if (!PGM.fallos.has(k)) { PGM.fallos.add(k); try { console.info('[Pill Packs] ' + PILL.def.nom + ': ' + R.msgErr(er)); } catch (x) {} aviso(T('pill.gmNo'), 2.5); }
    h.rota = true; return false;
  } finally { GMA.ctx = c0; gmaLado(c0); R.n = n0; }
  return true;
}
// cada cuadro: los bucles de sonido que pidió el Lua y el tamaño según el modelo (cuando ya se leyó)
function pillGmPaso() {
  const D = PILL.on && PILL.def && PILL.def.gm ? PILL.def : null;
  if (!D) { if (PGM.loops.size) PGM.loops.clear(); if (PGM.ent) { PGM.ent.vivo = false; PGM.ent = null; } return; }
  // (se sacó o se volvió a cargar el addon: el personaje de ahora, o se vuelve a ser uno mismo)
  if (D.R !== GMA.R) { const N = pillGmDef(D.id); if (N) { PILL.def = N; pillHudBotones(); } else pillFin(); return; }
  for (const [k, s] of PGM.loops) { let n = null; try { n = gmSonido(s); } catch (e) {} if (n && audioBuf(n)) bucle('pill_' + k, n, JUG.pos, 0.6, 1); }
  const P = JUG.cuerpo;
  if (P && P.gmp && !D.tamOk) { D.tamOk = true; const t = pillGmTam(D, P.gmp.def); if (t) { D.tam = t.k; D.ojo = 1; if (Math.abs((JUG.tam || 1) - t.k) > 0.03) { jugadorTam(t.k, 1); P.tam = t.k; } } }
}
// el alto del modelo (lo más alto de su malla sobre sus pies) respecto del personaje de siempre (1,9 m)
function pillGmTam(D, def) {
  if (!def || !def.arb) return null; let hi = -Infinity;
  for (const n of def.arb) if (n.m !== undefined) { const d = DATA.ms[n.m]; if (d && d.mn && d.sc) hi = Math.max(hi, d.mn[1] + d.sc[1]); }
  if (!isFinite(hi)) return null; const alto = hi - (def.piso || 0); if (!(alto > 0.2)) return null;
  return { k: clamp(alto / 1.9, 0.4, 1.6) };
}
// (al instalar o sacar un addon se rehace el menú: la pestaña toma los packs nuevos)
Object.assign(IDI3, {
  'pill.h.lua1': ['Ataque', 'Attack', 'Ataque'], 'pill.h.lua2': ['Ataque 2', 'Attack 2', 'Ataque 2'], 'pill.h.lua3': ['Especial', 'Special', 'Especial'],
  'pill.gmNo': ['Esa habilidad del addon usa cosas de GMod que acá no hay', 'That addon ability needs GMod features that are missing here', 'Essa habilidade do addon usa coisas do GMod que não existem aqui'],
});
