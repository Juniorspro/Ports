// ---------------------------------------------------------------------------------------------------------
// La versión personal del dueño (JXP: armar.py con PERSONAL=1, la app com.jxmod.app.personal; no se publica): el menú
// de Garry's Mod con sus datos de verdad. Pedido: «el menú de GMod sea uno renovado… meterle todos los datos de GMod
// real adentro, porque esta versión será mía nomás para aprender».
// Los datos van adentro del APK, en rb/jxp/ (los saca herramientas/gmod_personal.mjs del contenido base de GMod):
//  - menu.json: los spawnlists de fábrica de GMod (settings/spawnlist_default) con su árbol y sólo los modelos que
//    existen en el contenido base;
//  - lua/: el Lua de GMod que llena las listas del menú (base_npcs.lua, base_vehicles.lua, game_hl2.lua) y loc/: sus
//    nombres en inglés. Se montan como un addon más, «Garry's Mod», antes que los del Workshop: las pestañas NPCs,
//    Vehículos y Armas se llenan con lo mismo que GMod;
//  - iconos/: el spawnicon de cada modelo, y ui/: los iconitos de 16 px de GMod (pestañas y carpetas).
// El menú de props (menú Q) toma la forma del de GMod: pestañas Spawnlists, Weapons, Entities, NPCs y Vehicles con sus
// íconos, a la izquierda el árbol (los spawnlists de GMod, después los addons y las cosas de JXMod) y la grilla de
// spawnicons; el estilo, claro como el de GMod (body.jxp, en template.html).
// ---------------------------------------------------------------------------------------------------------
const JXPM = { base: 'rb/jxp/', menu: null, iconos: new Set(), listo: null };
// (pestañas: el nombre y el ícono de GMod, y su orden: Spawnlists, Weapons, Entities, NPCs, Vehicles…)
const JXP_TABS = { Props: ['Spawnlists', 'application_view_tile'], Weapons: ['Weapons', 'gun'], Entities: ['Entities', 'bricks'], NPCs: ['NPCs', 'monkey'], Vehicles: ['Vehicles', 'car'], PillPacks: ['Pill Packs', 'user'], Addons: ['Addons', 'plugin'], Tools: ['Tools', 'wrench'], Host: ['Server', 'world'] };
const JXP_ORDEN = ['Props', 'Weapons', 'Entities', 'NPCs', 'Vehicles', 'PillPacks', 'Addons', 'Tools', 'Host'];
const jxpUi = (n) => JXPM.base + 'ui/' + n;
if (JXP && typeof document !== 'undefined') { const pon = () => document.body && document.body.classList.add('jxp'); if (document.body) pon(); else addEventListener('DOMContentLoaded', pon); }
function jxpIniciar() {
  if (!JXP) return Promise.resolve(null);
  if (JXPM.listo) return JXPM.listo;
  return (JXPM.listo = (async () => {
    const traer = async (r, json) => { const x = await fetch(JXPM.base + r); if (!x.ok) throw new Error(r + ' ' + x.status); return json ? x.json() : new Uint8Array(await x.arrayBuffer()); };
    JXPM.menu = await traer('menu.json', true);
    for (const l of JXPM.menu.listas) l.m.forEach((m, i) => { if (l.i[i]) JXPM.iconos.add(m); });
    JXPM.ent = new Set(JXPM.menu.ent || []);
    // el Lua de GMod (y sus nombres) como el addon base «Garry's Mod»
    const archivos = new Map();
    for (const f of JXPM.menu.lua) archivos.set('lua/autorun/' + f, await traer('lua/' + f));
    for (const f of JXPM.menu.loc) archivos.set('resource/localization/en/' + f, await traer('loc/' + f));
    if (typeof gmMontar === 'function' && !GMOD.addons.has('gmod')) { const A = gmMontar('gmod', { nombre: "Garry's Mod", archivos }, { nombre: "Garry's Mod", base: true }); A.base = true; if (A.listo) await A.listo; }
    jxpMenu();
    return JXPM.menu;
  })().catch((e) => { if (typeof gmErr === 'function') gmErr('versión personal', e); JXPM.listo = null; return null; }));
}
// el spawnicon de GMod de un modelo (gm:models/…), si viene adentro
function jxpIcono(nombre) {
  if (!JXP || !JXPM.iconos.size) return null;
  const m = String(nombre).replace(/^gm:/, '').toLowerCase();
  return JXPM.iconos.has(m) ? JXPM.base + 'iconos/' + m.replace(/\.mdl$/, '.png') : null;
}
// las categorías de la pestaña Spawnlists: los spawnlists de GMod en su árbol (hijas con sangría)
function jxpSubs() {
  if (!JXP || !JXPM.menu) return [];
  const L = JXPM.menu.listas, out = [], hijos = (id) => L.filter((l) => l.padre === id);
  const poner = (l, nivel) => { out.push({ n: l.n, jxp: true, nivel, ico: jxpUi(String(l.ic || 'icon16/page.png').replace(/^icon16\//, 'icon16/').replace(/^games\/16\//, 'games/16/')), it: l.m.map((m) => 'gm:' + m) }); for (const h of hijos(l.id)) poner(h, nivel + 1); };
  for (const l of hijos(0)) poner(l, 0);
  // (y lo de los addons instalados, como «Browse › Addons» del spawnmenu de GMod: uno por addon —la pestaña GMod de la
  // versión de todos va acá adentro—)
  const GT = DATA.menu.find((c) => c.n === 'GMod'), G = ((GT && GT.sub) || []).filter((s) => s.it && s.it.length);   // (la pestaña GMod queda escondida: spawnTabs)
  if (G.length) { out.push({ n: 'Addons', jxp: true, nivel: 0, ico: jxpUi('icon16/plugin.png'), it: G.flatMap((s) => s.it) }); for (const s of G) out.push(Object.assign({}, s, { jxp: true, nivel: 1, ico: jxpUi('icon16/folder_brick.png') })); }
  return out;
}
// las pestañas con el orden, los nombres y los íconos de GMod (cada vez que se arman: las de NPCs y Pill Packs se agregan
// solas después)
function jxpOrden() {
  if (!JXP || typeof DATA === 'undefined' || !DATA || !DATA.menu) return;
  const sel = DATA.menu[UI.tab] && DATA.menu[UI.tab].n, pos = (c) => JXP_ORDEN.indexOf(c.n) + 1 || 99;
  if (!DATA.menu.some((c) => c.n === 'Addons')) DATA.menu.push({ n: 'Addons', sub: [], jxp: true });   // (los addons, como en GMod y GDroid)
  DATA.menu.sort((a, b) => pos(a) - pos(b));
  for (const c of DATA.menu) { const t = JXP_TABS[c.n]; if (t) c.icUrl = jxpUi('icon16/' + t[1] + '.png'); }
  if (sel) UI.tab = Math.max(0, DATA.menu.findIndex((c) => c.n === sel));
  // (en NPCs, primero los de GMod por categoría y los personajes de JXMod al final)
  const N = DATA.menu.find((c) => c.npcs); if (N && N.sub.length > 1 && N.sub[0].n === T('sp.npcJuego')) N.sub.push(N.sub.shift());
}
// las listas del Lua de GMod en sus pestañas
function jxpMenu() {
  if (!JXP || typeof DATA === 'undefined' || !DATA || !DATA.menu) return;
  // (las armas de HL2 de la lista de GMod —game_hl2.lua— en la pestaña Weapons, con su categoría)
  const W = DATA.menu.find((c) => c.n === 'Weapons'), A = typeof GMOD !== 'undefined' && GMOD.addons.get('gmod');
  if (W && A && A.listas && A.listas.Weapon && typeof HL2_ARMAS !== 'undefined') {
    const cats = new Map();
    for (const [k, v] of A.listas.Weapon) { const n = HL2_ARMAS[k]; if (!n || !DEF_ARMAS[n]) continue; const c0 = v && v.get ? v.get('Category') : null, c = typeof c0 === 'string' && c0.trim() ? gmFraseSi(c0.trim()) : 'Half-Life 2'; if (!cats.has(c)) cats.set(c, []); if (!cats.get(c).includes(n)) cats.get(c).push(n); }
    W.sub = [...[...cats].map(([n, it]) => ({ n, jxp: true, ico: jxpUi('games/16/hl2.png'), it })), ...W.sub.filter((s) => !s.jxp)];
  }
  // (los vehículos de base_vehicles.lua —Jeep, Airboat, Jalopy, las sillas— en Vehicles, por su categoría)
  const V = DATA.menu.find((c) => c.n === 'Vehicles');
  if (V && A && A.listas && A.listas.Vehicles) {
    const cats = new Map();
    for (const [k, v] of A.listas.Vehicles) { const c0 = v && v.get ? v.get('Category') : null, c = typeof c0 === 'string' && c0.trim() ? gmFraseSi(c0.trim()) : 'Half-Life 2'; if (!cats.has(c)) cats.set(c, []); cats.get(c).push('gmveh:' + k); }
    V.sub = [...[...cats].map(([n, it]) => ({ n, jxp: true, ico: jxpUi(/half-life/i.test(n) ? 'games/16/hl2.png' : 'icon16/car.png'), it })), ...V.sub.filter((s) => !s.jxp)];
  }
  if (typeof spawnTabs === 'function' && $('tabs')) spawnTabs();
}
// el ícono de GMod de un NPC o un vehículo de las listas (materials/entities/<clave o clase>.png), si viene adentro
function jxpIcoEnt(it) {
  if (!JXP || !JXPM.ent || !JXPM.ent.size) return null;
  const m = /^gm(npc|veh):(.+)$/.exec(it); if (!m) return null;
  const v = gmLista(m[1] === 'npc' ? 'NPC' : 'Vehicles', m[2]), c = v && v.get ? v.get('Class') : null;
  for (const k of [m[2], c]) if (typeof k === 'string' && JXPM.ent.has(k.toLowerCase())) return jxpUi('entities/' + k.toLowerCase() + '.png');
  return null;
}
const jxpTabNom = (c) => (JXP && JXP_TABS[c.n] ? JXP_TABS[c.n][0] : null);
// un modelo de los spawnlists que todavía no se bajó del contenido base: se baja con sus partes (.vvd, .vtx, .phy y, de
// segundo y tercer nivel, sus materiales y texturas) y se pone al llegar, como gmModeloEsperar con los de un addon
const JXP_ESPERA = new Map();
function jxpModeloEsperar(nombre, fn) {
  if (!JXP || !/^gm:models\/.+\.mdl$/.test(nombre) || typeof gmlTiene !== 'function') return false;
  const r = nombre.slice(3), b = r.slice(0, -4);
  const partes = [r, b + '.vvd', b + '.dx90.vtx', b + '.dx80.vtx', b + '.sw.vtx', b + '.phy'].filter((x) => !gmArchivo0(x) && !GML.datos.has(x) && gmlTiene(x));
  if (!partes.length || !partes.some((x) => /\.(mdl|vvd|dx90\.vtx)$/.test(x))) return false;
  let p = JXP_ESPERA.get(r);
  if (!p) {
    p = (async () => {
      await gmlTraer(partes); let L = partes; const todo = [...partes];
      for (let k = 0; k < 2; k++) { const s = new Set(); for (const x of L) { const u = GML.datos.get(x); if (u && /\.(vmt|mdl)$/.test(x)) gmlRefs(x, u, s); } L = [...s].filter((x) => !GML.datos.has(x) && gmlTiene(x)); if (!L.length) break; await gmlTraer(L); todo.push(...L); }
      gmlLlegaron(todo);
    })().catch((e) => gmErr('spawnlist ' + r, e)).finally(() => JXP_ESPERA.delete(r));
    JXP_ESPERA.set(r, p);
  }
  p.then(() => { if (gmArchivo(r)) fn(); });
  return true;
}

// ---------------- los emotes: los de GMod y los del Workshop ----------------
// (pedido: «borrarás los emotes y pondrás emotes de la workshop»). Cada emote es una secuencia de un .mdl de animaciones
// de GMod: las taunts y los gestos del jugador de GMod (models/m_anm.mdl, del contenido base: los de «act dance», «act
// robot»…) o las de un pack de emotes del Workshop instalado. Se pasa al esqueleto del personaje con el mismo cálculo del
// bonemerge (gmanRetarget: el giro de cada hueso de Valve respecto de su reposo, llevado al del personaje) y queda como un
// emote más (los giros locales de sus huesos de Mixamo y el movimiento de la cadera, emoAplicar), con id «w:modelo#secuencia».
const JXP_TAUNTS = [['taunt_dance', 'Dance'], ['taunt_robot', 'Robot'], ['taunt_muscle', 'Muscle'], ['taunt_laugh', 'Laugh'], ['taunt_cheer', 'Cheer'], ['taunt_persistence', 'Pers'], ['taunt_zombie', 'Zombie'],
  ['gesture_wave', 'Wave'], ['gesture_bow', 'Bow'], ['gesture_salute', 'Salute'], ['gesture_agree', 'Agree'], ['gesture_disagree', 'Disagree'], ['gesture_becon', 'Becon'], ['gesture_signal_forward', 'Forward'], ['gesture_signal_halt', 'Halt'], ['gesture_signal_group', 'Group']];
const JXP_ANM = 'models/m_anm.mdl';
const JXP_EMO = { cargas: new Map(), packs: new Map() };
// (las partes del .mdl —y sus .ani— del contenido base o del addon, hasta que el modelo se puede leer)
async function jxpModeloListo(ruta, ms) {
  const b = ruta.slice(0, -4), partes = [ruta, b + '.ani', b + '.vvd', b + '.dx90.vtx'];
  if (typeof gmlTiene === 'function') { const L = partes.filter((x) => !gmArchivo0(x) && !GML.datos.has(x) && gmlTiene(x)); if (L.length) await gmlTraer(L); }
  for (let t = 0; t < (ms || 20000); t += 200) {
    const d = gmanDef(ruta); if (d && d.M && gmAniCargar(d.M) && !(d.M.incFaltan && d.M.incFaltan.size && !(typeof gmIncluidosReintentar === 'function' && gmIncluidosReintentar(d.M)))) return d;   // (con sus animaciones de afuera —el .ani— y los modelos que incluye)
    if (GMAN.defs.has(ruta) && GMAN.defs.get(ruta) === null) return null;
    for (const x of partes) gmArchivo(x);   // (los de un addon guardado en el disco: se leen)
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}
function jxpEmoHacer(id) {
  const m = /^w:(models\/.+\.mdl)#(.+)$/.exec(id); if (!m) return null;
  const d = gmanDef(m[1]); if (!d || !d.M) return null;
  const M = d.M, buscar = (n) => M.secuencias.findIndex((s) => s.n.toLowerCase() === n.toLowerCase()), si0 = buscar(m[2]); if (si0 < 0) return null;
  // (las taunts y los gestos de GMod son secuencias vacías —delta, todo en cero— que suman capas: los datos de verdad
  // están en «<nombre>_base» o «<nombre>_original»; se toma la primera que tenga cuadros enteros)
  const vacia = (k) => { const x = M.anims[M.secuencias[k].anim]; return !x || !!(x.flags & 0x24); };
  let si = si0; if (vacia(si0)) for (const x of [m[2] + '_base', m[2] + '_original', m[2] + '_base_layer']) { const k = buscar(x); if (k >= 0 && !vacia(k)) { si = k; break; } }
  const S = M.secuencias[si]; let ai = S.anim; if (!M.anims[ai] && S.grid && GMF.animDe) ai = GMF.animDe(M, si);
  const A = M.anims[ai]; if (!A || !(A.nf > 1) || !gmAniCargar(M)) return null;   // (sin sus cuadros todavía —el .ani está llegando—: nada, y no queda guardado quieto)
  const pr = gmanPerfil(d, 'Hero'); if (!pr) return null;
  const A0 = M.anims[M.secuencias[si0].anim], fpsA = A0 && A0.fps > 0 ? A0.fps : A.fps > 0 ? A.fps : 30, dur = (A.nf - 1) / fpsA, fps = 20, nf = Math.max(2, Math.round(dur * fps) + 1);
  const hs = [...pr.deVB.keys()].sort((a, b) => a - b), nb = hs.length, nombres = hs.map((h) => /^mixamorig\d*:(.*)$/.exec(pr.sub[h].n)[1]);
  const R = new Int16Array(nf * nb * 4), H = new Int16Array(nf * 3), W = Array.from({ length: d.nb + 1 }, () => new Float32Array(16)), raiz = M4.id(), G = {};
  const L = new Float32Array(16), P = [0, 0, 0], Q = [0, 0, 0, 1], U = [1, 1, 1], prev = new Float32Array(nb * 4);
  const hi = pr.porNom.Hips, pa = pr.pa[hi], jPel = pr.deVB.get(hi), vRest = d.restW[jPel], qPa = pa >= 0 ? pr.rQ[pa].conj() : new Quat(), sPa = pa >= 0 ? pr.rS[pa] : 1;
  // (las animaciones de Valve miran 90° girado respecto de la pose de referencia de sus huesos —medido con idle_all_01 de
  // m_anm.mdl: la pelvis gira −93° alrededor de la vertical—: se endereza toda la animación, si no el personaje hacía el
  // emote de costado)
  m4trs([0, 0, 0], [0, -Math.SQRT1_2, 0, Math.SQRT1_2], [1, 1, 1], W[0]);
  const fpsD = A.fps > 0 ? A.fps : 30;
  for (let f = 0; f < nf; f++) {
    const st = { anim: ai, t: Math.min((A.nf - 1) / fpsD, (f / fps) * (fpsA / fpsD)), loop: false }, C = gmanCuadros(d, st); if (!C) return null;   // (al ritmo de la secuencia con nombre)
    for (let b = 0; b < d.nb; b++) { gmanLocal(d, st, b, P, Q, C ? C.w : 0, C && C.pa, C && C.pb); m4trs(P, Q, U, L); m4mul(W[d.padres[b] >= 0 ? 1 + d.padres[b] : 0], L, W[1 + b]); }
    gmanRetarget(pr, d, W, raiz, G);
    for (let k = 0; k < nb; k++) {
      const h = hs[k], p = pr.pa[h], q = p >= 0 ? G.Q[p].conj().mul(G.Q[h]).norm() : G.Q[h].clone(), o = (f * nb + k) * 4;
      if (f && q.x * prev[k * 4] + q.y * prev[k * 4 + 1] + q.z * prev[k * 4 + 2] + q.w * prev[k * 4 + 3] < 0) { q.x = -q.x; q.y = -q.y; q.z = -q.z; q.w = -q.w; }
      prev[k * 4] = q.x; prev[k * 4 + 1] = q.y; prev[k * 4 + 2] = q.z; prev[k * 4 + 3] = q.w;
      R[o] = Math.round(q.x * 32767); R[o + 1] = Math.round(q.y * 32767); R[o + 2] = Math.round(q.z * 32767); R[o + 3] = Math.round(q.w * 32767);
    }
    // (la cadera: lo que se mueve la pelvis de Valve respecto de su reposo, a la altura del personaje y en los ejes del padre de su cadera)
    const w = W[jPel], dv = pr.ry.rot(v3(w[12] - vRest[12], w[13] - vRest[13], w[14] - vRest[14])).scale(1 / pr.k), dl = qPa.rot(dv).scale(1 / sPa);
    H[f * 3] = Math.max(-32000, Math.min(32000, Math.round(dl.x * 1000))); H[f * 3 + 1] = Math.max(-32000, Math.min(32000, Math.round(dl.y * 1000))); H[f * 3 + 2] = Math.max(-32000, Math.min(32000, Math.round(dl.z * 1000)));
  }
  const t = JXP_TAUNTS.find((x) => x[0] === S.n.toLowerCase());
  return { id, n: t ? t[1] : S.n, fps, nf, b: nombres, r: R, h: H, loop: !!S.loop && !/^gesture_|^taunt_/.test(S.n), d: (nf - 1) / fps };
}
// (el clip de un emote del Workshop: si su modelo ya está leído, se arma al toque; si no, null y se pide)
function jxpEmoClip(id) {
  if (EMO.clips[id]) return EMO.clips[id];
  const c = jxpEmoHacer(id); if (c) EMO.clips[id] = c; else jxpEmoCargar(id);
  return c;
}
function jxpEmoCargar(id) {
  if (EMO.clips[id]) return Promise.resolve(EMO.clips[id]);
  if (JXP_EMO.cargas.has(id)) return JXP_EMO.cargas.get(id);
  const m = /^w:(models\/.+\.mdl)#/.exec(id); if (!m) return Promise.resolve(null);
  const p = jxpModeloListo(m[1]).then((d) => { JXP_EMO.cargas.delete(id); if (!d) return null; const c = jxpEmoHacer(id); if (c) EMO.clips[id] = c; return c; }).catch((e) => { JXP_EMO.cargas.delete(id); gmErr('emote ' + id, e); return null; });
  JXP_EMO.cargas.set(id, p); return p;
}
// (los packs de emotes del Workshop que se ofrecen: animaciones en el esqueleto de Valve, de los más bajados)
const JXP_EMO_WS = ['1655743290', '2615656036', '3567487307', '3576055105', '1310909460', '2274808442', '757604550'];
const JXP_EMO_CATS = ['todos', 'fav', 'rec', 'gmod', 'workshop'];
const JXP_EMO_NOM = { gmod: "Garry's Mod", workshop: 'Workshop' };
// (los .mdl de un addon que son de animaciones: sin malla —sin .vvd— o con «anim», «taunt», «dance» o «emote» en el nombre)
function jxpEmoModelos(A) {
  const rutas = [...A.G.archivos.keys(), ...(A.G.perezosos ? A.G.perezosos.keys() : [])], hay = new Set(rutas);
  return rutas.filter((r) => /^models\/.+\.mdl$/.test(r) && (!hay.has(r.slice(0, -4) + '.vvd') || /anim|taunt|dance|emote|gesture|wos|actmod/i.test(r)));
}
const JXP_EMO_FUERA = /^(idle|walk|run|cwalk|crouch|jump|swim|sit|aimlayer|reload|range_|attack|flinch|death|ragdoll|reference|menu_|zombie_)|_layer$|_original$|_base$|(^|_)(pose|lookat|aim|delta)(_|$)/i;
// (las secuencias de los packs instalados: se leen una vez por addon, en segundo plano, y el panel se vuelve a dibujar)
function jxpEmoPacks() {
  const out = [];
  for (const A of (typeof GMOD !== 'undefined' ? GMOD.addons.values() : [])) {
    if (!A.G || A.meta.base) continue;
    let K = JXP_EMO.packs.get(A.id);
    if (!K) { const mods = jxpEmoModelos(A); if (!mods.length) continue; K = { A, items: [], listo: false }; JXP_EMO.packs.set(A.id, K); jxpEmoLeerPack(K, mods); }
    for (const it of K.items) out.push(it);
  }
  return out;
}
async function jxpEmoLeerPack(K, mods) {
  for (const r of mods.slice(0, 40)) {
    const d = await jxpModeloListo(r, 15000); if (!d || !d.M || !d.porNombre.has('valvebiped.bip01_pelvis')) continue;
    for (const s of d.M.secuencias) {
      const A = d.M.anims[s.anim]; if (!A || A.nf < 12 || JXP_EMO_FUERA.test(s.n)) continue;
      const id = 'w:' + r + '#' + s.n; if (K.items.some((x) => x.id === id)) continue;
      const n = s.n.replace(/^(?:(?:wos|am4|am|f|fn|act|emote|taunt|anim)_)+/i, '').replace(/_/g, ' ').trim() || s.n;
      K.items.push({ id, n: n.charAt(0).toUpperCase() + n.slice(1), cat: 'workshop', pack: K.A.nombre });
    }
  }
  // (y se arman ya, de a poco, para que se vean sus siluetas)
  for (const it of K.items) { jxpEmoClip(it.id); await new Promise((r) => setTimeout(r, 0)); }
  K.listo = true;
  if (typeof UI !== 'undefined' && UI.abierto === 'emotes' && typeof emoDibujar === 'function') emoDibujar();
}
function jxpEmoLista() {
  const mini = (id) => EMO.minis[id] || (EMO.clips[id] ? (EMO.minis[id] = emoMini(EMO.clips[id])) : null);
  const l = JXP_TAUNTS.map(([s, n]) => { const id = 'w:' + JXP_ANM + '#' + s; return { id, n, cat: 'gmod', mini: mini(id) }; });
  for (const it of jxpEmoPacks()) l.push(Object.assign(it, { mini: mini(it.id) }));
  return l;
}
// (al abrir los emotes: las taunts de GMod se arman en segundo plano, para que se vean sus siluetas)
function jxpEmoPrecargar() {
  if (!JXP || JXP_EMO.pre) return; JXP_EMO.pre = true;
  (async () => { for (const [s] of JXP_TAUNTS) await jxpEmoCargar('w:' + JXP_ANM + '#' + s); if (UI.abierto === 'emotes') emoDibujar(); })().catch(() => {});
}
// la sección Workshop: los emotes de los packs instalados y los packs para instalar (con lo que pesan)
function jxpEmoWorkshop(el, L) {
  const S = JXP_EMO.ws || (JXP_EMO.ws = { items: null, cargando: false });
  if (!S.items && !S.cargando) {
    S.cargando = true;
    fetch(TIENDA_URL + 'gmod/detalles?ids=' + JXP_EMO_WS.join(',')).then((r) => r.json()).then((d) => { S.items = d.items || []; }).catch(() => { S.items = []; }).finally(() => { S.cargando = false; if (UI.abierto === 'emotes' && EMO.cat === 'workshop') emoDibujar(); });
  }
  const inst = (id) => GMOD.addons.has(String(id)) || (PREFS.gmod && PREFS.gmod[id]);
  const leyendo = [...JXP_EMO.packs.values()].some((K) => !K.listo);
  const packs = (S.items || []).filter((x) => !inst(x.id)).map((x) => `<div class="emoIt jxpPack">${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : emoIcoCat('baile')}<b dir="auto" title="${esc(x.t)}">${esc(x.t)}</b><small>${x.mb} MB</small><button class="emoInst" data-jxpws="${esc(x.id)}" data-jxpn="${esc(x.t)}" data-jxpimg="${esc(x.img || '')}">${glifo('bajar')} ${esc(T('instalar'))}</button></div>`).join('');
  el.innerHTML = L.map(emoTarjeta).join('') + (leyendo ? `<div class="emoVacio" style="grid-column:1/-1">${esc(T('cargando'))}</div>` : '') + (packs ? `<div class="jxpTit" style="grid-column:1/-1">Workshop</div>${packs}` : S.cargando ? `<div class="emoVacio" style="grid-column:1/-1">${esc(T('cargando'))}</div>` : '');
  el.querySelectorAll('[data-jxpws]').forEach((b) => { b.onclick = (ev) => { ev.stopPropagation(); b.disabled = true; b.innerHTML = esc(T('cargando')); if (typeof gmcPoner === 'function') gmcPoner(b.dataset.jxpws, { nombre: b.dataset.jxpn, img: b.dataset.jxpimg, sinDeps: true }); else gmInstalar(b.dataset.jxpws, { nombre: b.dataset.jxpn, img: b.dataset.jxpimg, sinDeps: true }).then(() => emoDibujar()); }; });
}

// ---------------- los addons, como en GMod y en GDroid ----------------
// (pedido: «buscar cómo se ponen mods en GMod y en GDroid e imitarlo… y mods packs donde se detecten todos los mods
// necesarios para usar un mod de la Workshop»). En GMod se entra a la página del Workshop y se toca «Suscribirse» (con los
// «Required items» Steam pregunta si se suscribe también a esos) y en el menú Addons se prenden y se apagan; en GDroid se
// pega el link o el número del Workshop («Download from Steam») o se copian los .gma a la carpeta addons, y hay una lista
// para prender y apagar. Acá, en la pestaña Addons del menú Q: se pega el link o el número (de un addon o de una
// colección, o varios), se arma el «mod pack» —el addon, lo que pide su página (y lo que piden esos, hasta 4 niveles) y,
// en una colección, todos sus addons con lo suyo—, se ve cuánto pesa y se instala todo en orden (lo que se pide primero);
// las bases que usa el Lua y no están marcadas (TFA, ArcCW, VJ…) las agrega solo la instalación (gmDependencias).
const JXP_ADD = { sel: 0, q: '', pack: null, busy: false, msg: '' };
const jxpIco = (n) => `<img class="jxpI" src="${esc(jxpUi('icon16/' + n + '.png'))}" alt="">`;
// (los números de un texto: links del Workshop —?id=…— o números sueltos)
function jxpIds(t) {
  const s = String(t || ''), ids = [...s.matchAll(/[?&]id=(\d{3,12})/g)].map((m) => m[1]);
  for (const m of s.replace(/https?:\/\/\S+/g, ' ').matchAll(/\b(\d{6,12})\b/g)) ids.push(m[1]);
  return [...new Set(ids)];
}
async function jxpColeccion(id) {
  try { const r = await fetch(TIENDA_URL + 'gmod/coleccion/' + id); if (r.ok) { const d = await r.json(); return d.es ? d.hijos : null; } } catch (e) {}
  try {   // (si la tienda todavía no tiene la ruta: la API de Steam por el puente)
    const r = await gmPedir('https://api.steampowered.com/ISteamRemoteStorage/GetCollectionDetails/v1/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'collectioncount=1&publishedfileids[0]=' + id });
    const x = ((await r.json()).response || {}).collectiondetails, c = x && x[0];
    return c && c.result === 1 && c.children && c.children.length ? c.children.map((h) => ({ id: String(h.publishedfileid), col: h.filetype === 2 })) : null;
  } catch (e) { return null; }
}
async function jxpDetalles(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 100) { try { const d = await (await fetch(TIENDA_URL + 'gmod/detalles?ids=' + ids.slice(i, i + 100).join(','))).json(); for (const x of d.items || []) out.set(String(x.id), x); } catch (e) {} }
  return out;
}
// el mod pack: cada uno con por qué está (pedido, de la colección, requerido por…) y a qué profundidad
async function jxpPackArmar(texto, avisar) {
  const ids = jxpIds(texto); if (!ids.length) return null;
  const L = new Map(), cola = [];
  for (const id of ids) {
    avisar('Viendo si ' + id + ' es una colección…');
    const hijos = await jxpColeccion(id);
    if (hijos) {
      const col = { id, tipo: 'col', prof: -1, hijos: [] }; L.set(id, col);
      for (const h of hijos) {
        if (h.col) { const nietos = (await jxpColeccion(h.id)) || []; for (const n of nietos) if (!n.col) { cola.push({ id: n.id, prof: 0, tipo: 'item', de: h.id }); col.hijos.push(n.id); } }
        else { cola.push({ id: h.id, prof: 0, tipo: 'item', de: id }); col.hijos.push(h.id); }
      }
    } else cola.push({ id, prof: 0, tipo: 'item' });
  }
  for (let n = 0; cola.length && L.size < 400; n++) {
    const x = cola.shift(); const id = GM_REEMPLAZO[x.id] || x.id;
    const ya = L.get(id); if (ya) { if (ya.tipo !== 'col' && x.prof > ya.prof) ya.prof = x.prof; continue; }
    L.set(id, Object.assign({}, x, { id }));
    if (x.prof >= 4) continue;
    avisar('Buscando lo que necesita cada uno… (' + L.size + ')');
    const req = (await gmRequeridos(id).catch(() => null)) || [];
    for (const r of req) cola.push({ id: GM_REEMPLAZO[r] || r, prof: x.prof + 1, tipo: 'req', de: id });
  }
  avisar('Leyendo nombres y tamaños…');
  const todos = [...L.values()].filter((x) => x.tipo !== 'col'), det = await jxpDetalles(todos.map((x) => x.id));
  for (const x of todos) { const d = det.get(x.id); x.n = d ? d.t : (PREFS.gmod && PREFS.gmod[x.id] && PREFS.gmod[x.id].n) || x.id; x.img = d ? d.img : ''; x.mb = d ? +d.mb || 0 : 0; x.ok = !!d; }
  for (const c of [...L.values()].filter((x) => x.tipo === 'col')) { const d = await jxpDetalles([c.id]); const x = d.get(c.id); c.n = x ? x.t : 'Colección ' + c.id; }
  // (orden de instalación: lo más pedido primero —las bases y las texturas—, después lo que las usa)
  const orden = todos.slice().sort((a, b) => b.prof - a.prof);
  return { ids, cols: [...L.values()].filter((x) => x.tipo === 'col'), items: orden };
}
const jxpInstalado = (id) => (typeof GMOD !== 'undefined' && GMOD.addons.has(String(id))) || !!(PREFS.gmod && PREFS.gmod[id]);
async function jxpPackInstalar() {
  const P = JXP_ADD.pack; if (!P || JXP_ADD.busy) return;
  const faltan = P.items.filter((x) => x.ok && !jxpInstalado(x.id)); if (!faltan.length) return;
  JXP_ADD.busy = true;
  for (const x of faltan) {
    x.estado = 'bajando'; jxpAddRedibujar();
    // (de a uno y en orden: el Lua de cada uno corre después del de lo que pide, como en GMod)
    try { await gmcPoner(x.id, { nombre: x.n, img: x.img }); x.estado = 'listo'; } catch (e) { x.estado = 'error'; gmErr('mod pack ' + x.id, e); }
    jxpAddRedibujar();
  }
  JXP_ADD.busy = false; jxpAddRedibujar();
  if (typeof aviso === 'function') aviso('Mod pack instalado: ' + faltan.filter((x) => x.estado === 'listo').length + ' de ' + faltan.length, 4);
}
function jxpAddRedibujar() { if (typeof UI !== 'undefined' && UI.abierto === 'spawn' && DATA.menu[UI.tab] && DATA.menu[UI.tab].n === 'Addons') spawnDibujar(); }
// la pestaña Addons del menú Q
function jxpAddonsDibujar(C, cl, gr, pie) {
  const inst = Object.keys(PREFS.gmod || {}), secs = [['Instalados (' + inst.length + ')', 'plugin'], ['Del Workshop', 'world_add']];
  secs.forEach(([n, ic], i) => { const d = document.createElement('div'); d.className = 'cat' + (JXP_ADD.sel === i ? ' sel' : ''); d.innerHTML = `<img class="catIco" src="${esc(jxpUi('icon16/' + ic + '.png'))}" alt=""><span>${esc(n)}</span>`; d.onclick = () => { JXP_ADD.sel = i; spawnDibujar(); }; cl.appendChild(d); });
  gr.classList.add('jxpAddG'); pie.innerHTML = '';
  if (JXP_ADD.sel === 0) {
    const q = JXP_ADD.q.toLowerCase(), L = inst.filter((id) => !q || String((PREFS.gmod[id] || {}).n || id).toLowerCase().includes(q)).sort((a, b) => (+PREFS.gmod[b].t || 0) - (+PREFS.gmod[a].t || 0));
    gr.innerHTML = `<div class="jxpBarra"><input id="jxpQ" placeholder="Buscar en los instalados" value="${esc(JXP_ADD.q)}"><button class="jxpB" data-a="on">${jxpIco('tick')}Activar todos</button><button class="jxpB" data-a="off">${jxpIco('cross')}Desactivar todos</button><label class="jxpB">${jxpIco('package_add')}Importar .gma<input type="file" accept=".gma,.bin" hidden></label></div>`
      + (L.length ? L.map((id) => { const P = PREFS.gmod[id], on = gmHabilitado(id), A = GMOD.addons.get(id); return `<div class="jxpFila${on ? '' : ' off'}"><input type="checkbox" data-on="${esc(id)}"${on ? ' checked' : ''}>${P.img ? `<img class="jxpMini" src="${esc(P.img)}" alt="" loading="lazy">` : jxpIco(on ? 'plugin' : 'plugin_disabled')}<b title="${esc(id)}">${esc(P.n || id)}</b><small>${[P.mbG ? P.mbG.toFixed(1) + ' MB' : '', ...(A ? [(A.sweps || []).length && A.sweps.length + ' armas', A.listas && A.listas.NPC && A.listas.NPC.size && A.listas.NPC.size + ' NPCs', (A.sents || []).length && A.sents.length + ' entidades', A.props && A.props.length && A.props.length + ' modelos'] : [on ? '' : 'apagado'])].filter(Boolean).join(' · ')}</small><button class="jxpB jxpX" data-del="${esc(id)}" title="Quitar">${jxpIco('delete')}</button></div>`; }).join('')
        : `<div class="jxpVacio">No hay addons instalados. En «Del Workshop» pegá el link de un addon o de una colección.</div>`);
    const qi = gr.querySelector('#jxpQ'); qi.oninput = () => { JXP_ADD.q = qi.value; const p = qi.selectionStart; spawnDibujar(); const n = $('jxpQ'); if (n) { n.focus(); n.setSelectionRange(p, p); } }; qi.onkeydown = (e) => e.stopPropagation();
    gr.querySelectorAll('[data-on]').forEach((c) => { c.onchange = async () => { c.disabled = true; await gmHabilitar(c.dataset.on, c.checked); spawnDibujar(); }; });
    gr.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => { if (!b.dataset.conf) { b.dataset.conf = 1; b.innerHTML = '¿Quitar?'; return; } gmQuitar(b.dataset.del); JXP_ADD.packs = null; spawnDibujar(); }; });
    gr.querySelectorAll('[data-a]').forEach((b) => { b.onclick = async () => { b.disabled = true; await gmHabilitarTodos(b.dataset.a === 'on', (i, n) => { b.textContent = i + '/' + n; }); spawnDibujar(); }; });
    const f = gr.querySelector('input[type=file]'); f.onchange = async () => { const a = f.files && f.files[0]; if (!a) return; aviso('Importando ' + a.name + '…', 3); try { await gmImportarArchivo(a); aviso('Instalado: ' + a.name, 3); } catch (e) { aviso('No se pudo leer ese .gma', 3); } spawnDibujar(); };
    return;
  }
  // del Workshop: pegar el link o el número, y el mod pack
  const P = JXP_ADD.pack;
  let h = `<div class="jxpBarra"><input id="jxpLink" placeholder="Pegá el link o el número del Workshop (addon o colección; varios, separados)" value="${esc(JXP_ADD.texto || '')}"><button class="jxpB jxpAzul" id="jxpBuscar"${JXP_ADD.busy ? ' disabled' : ''}>${jxpIco('magnifier')}Buscar</button><button class="jxpB" id="jxpPegar">${jxpIco('page_white_zip')}Pegar</button></div>`;
  h += `<div class="jxpAyuda">Como «Suscribirse» en GMod y «Download from Steam» en GDroid: se detecta todo lo que necesita (los «Required items» de su página, lo que piden esos, y en una colección todos sus addons) y se instala en orden.${JXP_ADD.msg ? `<br><b>${esc(JXP_ADD.msg)}</b>` : ''}</div>`;
  if (P) {
    const faltan = P.items.filter((x) => x.ok && !jxpInstalado(x.id)), mb = faltan.reduce((s, x) => s + x.mb, 0), noHay = P.items.filter((x) => !x.ok);
    for (const c of P.cols) h += `<div class="jxpTitulo">${jxpIco('folder')}Colección: ${esc(c.n)} (${c.hijos.length} addons)</div>`;
    h += `<div class="jxpTitulo">${jxpIco('package')}Mod pack: ${P.items.length} addon${P.items.length === 1 ? '' : 's'}${faltan.length ? ` · faltan ${faltan.length} (${mb.toFixed(1)} MB)` : ' · ya está todo instalado'}</div>`;
    h += P.items.slice().reverse().map((x) => { const ya = jxpInstalado(x.id), est = x.estado === 'bajando' ? 'Bajando…' : x.estado === 'error' ? 'Falló' : ya ? 'Instalado' : !x.ok ? 'No disponible' : 'Falta';
      const por = x.tipo === 'req' ? 'Lo necesita ' + (P.items.find((y) => y.id === x.de) || {}).n : x.de && P.cols.some((c) => c.id === x.de) ? 'De la colección' : 'Pedido';
      return `<div class="jxpFila${ya ? '' : ' falta'}" style="padding-left:${6 + Math.min(4, x.prof) * 16}px">${x.img ? `<img class="jxpMini" src="${esc(x.img)}" alt="" loading="lazy">` : jxpIco('plugin')}<b title="${esc(x.id)}">${esc(x.n)}</b><small>${esc(por)} · ${x.mb.toFixed(1)} MB</small><span class="jxpEst ${ya ? 'si' : x.estado === 'error' || !x.ok ? 'mal' : ''}">${est}</span></div>`; }).join('');
    if (noHay.length) h += `<div class="jxpAyuda">${noHay.length} no se pudieron leer (borrados del Workshop o privados): se saltean.</div>`;
    if (faltan.length) h += `<div class="jxpBarra"><button class="jxpB jxpAzul jxpGrande" id="jxpInstalar"${JXP_ADD.busy ? ' disabled' : ''}>${jxpIco('package_go')}${JXP_ADD.busy ? 'Instalando…' : `Instalar todo (${faltan.length} · ${mb.toFixed(1)} MB)`}</button></div>`;
  }
  gr.innerHTML = h;
  const inp = gr.querySelector('#jxpLink'); inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') gr.querySelector('#jxpBuscar').click(); }; inp.oninput = () => { JXP_ADD.texto = inp.value; };
  gr.querySelector('#jxpPegar').onclick = async () => { try { const t = await navigator.clipboard.readText(); if (t) { JXP_ADD.texto = t; inp.value = t; } } catch (e) { inp.focus(); } };
  gr.querySelector('#jxpBuscar').onclick = async () => {
    JXP_ADD.texto = inp.value; if (!jxpIds(inp.value).length) { JXP_ADD.msg = 'No encontré ningún número del Workshop en eso.'; spawnDibujar(); return; }
    JXP_ADD.busy = true; JXP_ADD.pack = null;
    try { JXP_ADD.pack = await jxpPackArmar(inp.value, (t) => { JXP_ADD.msg = t; jxpAddRedibujar(); }); JXP_ADD.msg = ''; } catch (e) { JXP_ADD.msg = 'No se pudo leer el Workshop (¿hay internet?).'; }
    JXP_ADD.busy = false; jxpAddRedibujar();
  };
  const bi = gr.querySelector('#jxpInstalar'); if (bi) bi.onclick = () => jxpPackInstalar();
}

// ---------------- el agua de Half-Life 2 ----------------
// (pedido: «quiero el agua real del Half-Life 2, sí o sí»). El agua de los mapas se dibuja con un material de agua de HL2
// del contenido base: su mapa de normales (dos capas que corren cruzadas, como su $bumptransform), el color de su niebla
// —lo que se ve a través del agua, oscuro y verdoso— y lo turbia que es ($fogend), con el Fresnel y el reflejo de la
// escena que ya tenía el juego, corrido por esas normales (gl.js, uAguaH). Debajo del agua, la niebla es de ese color.
// gm_construct usa la suya (gm_construct/water); los demás, la de la costa de HL2 (nature/water_coast01)
const JXP_AGUA = { RB_Construct: 'gm_construct/water' }, JXP_AGUA_DEF = 'nature/water_coast01';
function jxpVmt(t) {
  const o = {}; for (const m of String(t).matchAll(/"([$%][\w?]+|srgb\?\$\w+)"\s+"?([^"\r\n]*)"?/gi)) { const k = m[1].toLowerCase(); if (!(k in o)) o[k] = m[2].trim(); }
  return o;
}
const jxpColor = (s) => { const m = /[{[]\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(s || ''); if (!m) return null; const c = [+m[1], +m[2], +m[3]]; return /^\s*\{/.test(s) ? c.map((x) => x / 255) : c; };
async function jxpAguaHL2(mapa) {
  AGUA.hl2 = null; if (!JXP || !AGUA.vols.length || typeof gmlTiene !== 'function' || !R.gl || R.gl1) return;   // (WebGL 2: el agua de HL2 usa dos texturas más)
  const n = ++JXPM.aguaN;
  try {
    await Promise.all([typeof gmlIniciar === 'function' ? gmlIniciar() : null, typeof gbsIniciar === 'function' ? gbsIniciar() : null]);   // (el contenido base: su índice llega solo la primera vez)
    if (n !== JXPM.aguaN) return;
    let nom = JXP_AGUA[mapa] || JXP_AGUA_DEF, ruta = 'materials/' + nom + '.vmt';
    if (!gmlTiene(ruta)) { nom = JXP_AGUA_DEF; ruta = 'materials/' + nom + '.vmt'; }
    await gmlTraer([ruta]); const b = gmArchivo(ruta); if (!b) return;
    const V = jxpVmt(new TextDecoder('latin1').decode(b));
    const nr = 'materials/' + String(V.$normalmap || 'dev/water_normal').toLowerCase().replace(/\\/g, '/').replace(/\.vtf$/, '') + '.vtf';
    if (gmlTiene(nr)) await gmlTraer([nr]); const u = gmArchivo(nr); if (!u || n !== JXPM.aguaN) return;
    const T = GMF.vtf(u, 512), px = GMF.vtfRGBA(T), tex = gmTexGL(px, T.w, T.h, false);
    const fs = jxpColor(V['srgb?$fogcolor']) || jxpColor(V.$fogcolor) || [0.08, 0.19, 0.2], fin = +V.$fogend || 400;
    const lin = fs.map((c) => Math.pow(c, 2.2)), turbia = clamp(1.05 - fin / 1500, 0.55, 0.92);
    // (cuánto corren las olas la imagen del fondo y la del reflejo: los del material —$refractamount, $reflectamount—; el mapa
    // de normales del agua de GMod inclina poco, 0,04 de promedio, y con 0,09 fijo las olitas casi no se veían)
    const refr = clamp(+V.$refractamount || 0.5, 0.1, 1.5), rfl = clamp(+V.$reflectamount || 0.4, 0.05, 1.5);
    AGUA.hl2 = { tex, tw: T.w, th: T.h, tpx: px, nom, normal: nr, fog: [lin[0], lin[1], lin[2], turbia], esc: 0.38, fuerza: 0.55, dist: rfl * 0.5, refr, s: [0.021, 0.016, -0.018, 0.024], bajo: fs.map((c) => Math.min(1, c * 1.5)), largo: Math.max(1.5, fin * GM_S / 2.5), prof: jxpAguaFondo() };
  } catch (e) { gmErr('agua de HL2', e); }
}
JXPM.aguaN = 0;
// lo hondo del agua más grande del mapa, medido una vez: una grilla de 64 × 64 rayos para abajo desde la superficie hasta el
// fondo (el mapa), en una textura chica (0..1 de la profundidad más honda). Con eso el sombreador sabe cuánta agua hay
// debajo de cada punto (en la WebGL que lo deja: 16 unidades de textura)
function jxpAguaFondo() {
  if (!R.gl || R.gl1) return null;
  const W = AGUA.vols.filter((v) => v.mapa).sort((a, b) => b.hx * b.hz - a.hx * a.hz)[0]; if (!W) return null;
  const N = 64, D = Math.max(0.5, W.y1 - W.y0), x0 = W.ax0, z0 = W.az0, w = W.ax1 - W.ax0, h = W.az1 - W.az0, px = new Uint8Array(N * N * 4), abajo = v3(0, -1, 0);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = x0 + (i + 0.5) / N * w, z = z0 + (j + 0.5) / N * h, hit = raycast(v3(x, W.y1 + 0.05, z), abajo, D + 1, null);
    const p = hit ? Math.max(0, hit.t - 0.05) : D, o = (j * N + i) * 4; px[o] = Math.round(clamp(p / D, 0, 1) * 255); px[o + 3] = 255;
  }
  const gl = R.gl, tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { tex, px, n: N, x0, z0, w, h, D };
}

// ---------------- JX Motor: el cuadro que se dibuja, para el motor nativo en Rust (porteos/jxmod/motor) ----------------
// (pedido: «el porteo a un motor de Android en Rust… gráficos altos, sombras y reflejos en un celular de 1 GB»). Medido: con el
// procesador frenado ×6 la lógica del juego usa menos del 5 % del cuadro y el resto es dibujar; por eso el motor nativo
// empieza por el dibujo. Esto arma un «JXE1» con lo que el juego ya tiene listo para la placa en ese cuadro: las mallas tal
// como están en el paquete (posición en 16 bits, normal en 8, UV en media precisión, UV de la luz horneada), los
// materiales, las texturas leídas de la placa (hasta 256 px), las luces horneadas de los mapas, lo que se dibuja (malla,
// parte, material y matriz), la cámara, el sol, la niebla y el agua de HL2. Por ahora sin lo que tiene huesos.
// Formato: 'JXE1', u32 largo del JSON, el JSON y los datos (cada bloque alineado a 4)
function jxmCapturar(max) { return new Promise((ok, mal) => { R.captura = () => { try { ok(jxmArmar(max || 256)); } catch (e) { mal(e); } }; }); }
function jxmArmar(TMAX) {
  const gl = R.gl, todos = [...R.cola, ...R.colaT], items = todos.filter((p) => !p.h && !p.vista && p.m && p.mt), blobs = []; let off = 0;
  const poner = (u8) => { const o = off; blobs.push(u8); off += u8.length; const pad = (4 - (off % 4)) % 4; if (pad) { blobs.push(new Uint8Array(pad)); off += pad; } return o; };
  const mallas = [], mPor = new Map(), mats = [], matPor = new Map(), texs = [], tPor = new Map(), lms = [], lmPor = new Map();
  const leerTex = (glt, w0, h0) => {
    let lv = 0, w = w0, h = h0; while (Math.max(w, h) > TMAX) { lv++; w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); }
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    for (const nivel of lv ? [lv, 0] : [0]) {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, glt, nivel);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) continue;
      const W = nivel ? w : w0, H = nivel ? h : h0, px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); return { w: W, h: H, px };
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); return null;
  };
  const tex = (ti) => {
    if (ti === undefined || ti === null || ti < 0) return -1; if (tPor.has(ti)) return tPor.get(ti);
    const t = R.tex[ti], D = DATA.tx[ti]; let k = -1;
    if (t && t.gl && D && D.w) { const L = leerTex(t.gl, D.w, D.h); if (L) { k = texs.length; texs.push({ n: D.n || '', w: L.w, h: L.h, a: D.a ? 1 : 0, o: poner(L.px) }); } }
    tPor.set(ti, k); return k;
  };
  const lm = (k) => { if (k === null || k === undefined) return -1; if (lmPor.has(k)) return lmPor.get(k); const A = DATA.aj[k] && DATA.aj[k].lm; let i = -1; if (A) { i = lms.length; lms.push({ w: A.w, h: A.h, o: poner(A.px.slice ? A.px.slice() : new Uint8Array(A.px)) }); } lmPor.set(k, i); return i; };
  const malla = (m) => {
    if (mPor.has(m.idx)) return mPor.get(m.idx);
    const d = m.d, B = binDe(d); let n = 0; for (const s of d.sub) n = Math.max(n, s[0] + s[1]);
    const r = { v: d.v, mn: d.mn, sc: d.sc, i32: d.i32 ? 1 : 0, ni: n, vo: poner(B.slice(d.o, d.o + d.v * 14)), io: poner(B.slice(d.i, d.i + n * (d.i32 ? 4 : 2))), lo: d.lm !== undefined ? poner(B.slice(d.lm, d.lm + d.v * 4)) : -1, lm: m.lm ? lm(m.lm) : -1 };
    const k = mallas.length; mallas.push(r); mPor.set(m.idx, k); return k;
  };
  const mat = (mt) => {
    if (matPor.has(mt)) return matPor.get(mt);
    // (t2: la segunda textura que se mezcla por vértice —displacements de Source—; terr: el terreno con control y tres capas)
    const terr = mt.terr ? mt.terr.t.map((x) => (x ? [tex(x[0]), x[1], x[2]] : [-1, 1, 1])) : null;
    const k = mats.length; mats.push({ t2: mt.mez !== undefined ? tex(mt.mez) : -1, terr, c: Array.from(mt.c || [1, 1, 1, 1]), st: Array.from(mt.st || [1, 1, 0, 0]), t: tex(mt.tex), blend: mt.blend ? 1 : 0, cut: mt.cut ? 1 : 0, unlit: mt.unlit ? 1 : 0, add: mt.add ? 1 : 0, agua: mt.agua ? 1 : 0, em: Array.from(mt.em || [0, 0, 0]) });
    matPor.set(mt, k); return k;
  };
  const out = items.map((p) => ({ m: malla(p.m), s0: p.s0, sn: p.sn, mat: mat(p.mt), M: Array.from(p.M), est: p.est ? 1 : 0 }));
  const H = AGUA.hl2; let agua = null;
  if (H && H.tex) {
    // (con su tamaño de verdad: leída como 256 una de 128 quedaba con tres cuartos en negro y el agua con manchas)
    const nt = H.tpx ? { w: H.tw, h: H.th, px: H.tpx } : leerTex(H.tex, H.tw || 256, H.th || 256);
    agua = { fog: H.fog, esc: H.esc, fuerza: H.fuerza, dist: H.dist, s: H.s, largo: H.largo, normal: nt ? { w: nt.w, h: nt.h, o: poner(nt.px) } : null };
    if (H.prof) { const p = H.prof.px ? { w: H.prof.n, h: H.prof.n, px: H.prof.px } : leerTex(H.prof.tex, 64, 64); agua.prof = { x0: H.prof.x0, z0: H.prof.z0, w: H.prof.w, h: H.prof.h, D: H.prof.D, tex: p ? { w: p.w, h: p.h, o: poner(p.px) } : null }; }
    const W = AGUA.vols.find((v) => v.mapa); if (W) agua.y = W.y1;
  }
  const L = { sol: [R.sol.x, R.sol.y, R.sol.z], solC: Array.from(R.solCol || [1, 1, 1]), ambS: Array.from(R.ambS || [0.4, 0.45, 0.5]), ambG: Array.from(R.ambG || [0.3, 0.3, 0.3]), nie: { c: Array.from(R.niebla.c), a: R.niebla.a, b: R.niebla.b }, expo: R.expo || 1 };
  const J = { v: 1, mapa: MUNDO.nombre, w: R.cv.width, h: R.cv.height, cam: { vp: Array.from(R.vp), pos: [CAM.pos.x, CAM.pos.y, CAM.pos.z] }, luz: L, mallas, mats, texs, lms, items: out, agua, sinHuesos: todos.length - items.length };
  const js = new TextEncoder().encode(JSON.stringify(J)), cab = new Uint8Array(8); cab.set([74, 88, 69, 49]); new DataView(cab.buffer).setUint32(4, js.length, true);
  const tot = new Uint8Array(8 + js.length + off); tot.set(cab); tot.set(js, 8); let o = 8 + js.length; for (const b of blobs) { tot.set(b, o); o += b.length; }
  return tot;
}

// ---------------- JX Motor en vivo: el mundo lo dibuja el motor nativo y WebGL sólo lo de encima ----------------
// En la APK personal con el motor (Ajustes → «Motor nativo»), cada cuadro el juego le manda a JX Motor (Rust, GLES 3, en una
// superficie atrás del WebView transparente):
//  - lo nuevo, una sola vez: mallas (como están en el paquete, con sus huesos y la UV de la luz horneada), texturas (leídas
//    de la placa hasta JXM.tmax px y borradas de WebGL después: no ocupan memoria dos veces), luces horneadas, materiales
//    y el agua de HL2 (formato JXE1, cada cosa con su número del juego);
//  - el cuadro (JXC1): cámara, sol, cielo, niebla, luces puntuales y especiales, y cada cosa que hay que dibujar —no sólo
//    lo que ve la cámara: el motor recorta solo para la cámara, la sombra del sol y el reflejo del agua— con su matriz, su
//    esfera y sus huesos.
// WebGL deja de dibujar el mundo (ni sombras, ni reflejo, ni lo opaco, ni lo transparente) y dibuja sólo el arma en la mano,
// los efectos, lo que dibuja el Lua y las líneas, sobre fondo transparente.
// Puente: window.JXMotor (Java, Motor.java) con recursos(base64), cuadro(base64), vaciar(); en las pruebas, JXM.grab junta
// todo en una grabación JXG1 que el banco de pruebas (jxm-banco) vuelve a dibujar.
const JXM = { porFirma: new Map(), on: false, grab: null, tmax: 256, mallas: new Set(), texs: new Set(), lms: new Set(), mats: new WeakMap(), matN: 0, agua: null, mapa: null, f: new Float32Array(4096), sinMalla: 0, bytesR: 0, cuadros: 0 };
function jxmPuente() { return JXM.grab || (JXM.prendido && typeof window.JXMotor !== 'undefined' ? window.JXMotor : null); }
// por qué no se puede usar JX Motor acá ("ok" si se puede): lo dice la app (MotorJX.motivo); en el navegador, no está
function jxmMotivo() {
  if (JXM.grab) return 'ok';
  if (typeof window.JXMotor === 'undefined') return 'sólo en la APK personal (acá no está el motor)';
  try { return String(window.JXMotor.motivo ? window.JXMotor.motivo() : window.JXMotor.disponible() ? 'ok' : 'no disponible'); } catch (e) { return String(e); }
}
function jxmDisponible() { try { return !!(JXP && (JXM.grab || (typeof window.JXMotor !== 'undefined' && window.JXMotor.disponible()))); } catch (e) { return false; } }
// la calidad del motor nativo según la del juego (y las texturas: 512 px en Alto y Ultra, 256 en las demás)
function jxmCalidad() {
  const g = PREFS.gfx === 'auto' ? (GFX.nombre || 'medio') : PREFS.gfx, perfil = /ultra|alto/.test(g) ? 'alto' : /medio/.test(g) ? 'celular' : 'bajo';
  JXM.tmax = perfil === 'alto' ? 512 : 256;
  if (!JXM.grab && JXM.prendido) try { window.JXMotor.opciones(perfil, 0); } catch (e) {}
  return perfil;
}
// (un char por byte, sin base64: un tercio menos y sin codificar; se usa si la app lo deja pasar igual —jxmProbarBin—)
// los bytes como texto de un carácter por byte (0 a 255): copiados a 16 bits (en nativo) y leídos como UTF-16; el mismo texto
// que String.fromCharCode byte a byte, 7 veces más rápido (118 KB: 0,09 ms en vez de 0,67)
const JXM_DEC16 = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : null; let jxmU16 = new Uint16Array(0);
function jxmBin(u8) {
  if (JXM_DEC16) { if (jxmU16.length < u8.length) jxmU16 = new Uint16Array(u8.length * 1.5 | 0); const v = jxmU16.subarray(0, u8.length); v.set(u8); return JXM_DEC16.decode(v); }
  let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return s;
}
function jxmProbarBin(B) {
  try {
    if (!B.prueba || !B.cuadroBin) return false;
    const u = new Uint8Array(4096); for (let i = 0; i < u.length; i++) u[i] = (i * 7 + (i >> 8)) & 255;
    const s = jxmBin(u); let h = s.length; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
    return (B.prueba(s) | 0) === h;
  } catch (e) { return false; }
}
function jxmB64(u8) { return btoa(jxmBin(u8)); }
// (la grabación de las pruebas: cada pedazo con su tipo y su largo)
function jxmGrabar() {
  const P = [];
  const poner = (t, u8) => { const c = new Uint8Array(5 + u8.length); c[0] = t.charCodeAt(0); new DataView(c.buffer).setUint32(1, u8.length, true); c.set(u8, 5); P.push(c); };
  const desde = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
  const bin = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));
  JXM.grab = { recursos: (b) => poner('R', desde(b)), cuadro: (b) => poner('C', desde(b)), recursosBin: (s) => poner('R', bin(s)), cuadroBin: (s) => poner('C', bin(s)), vaciar: () => poner('V', new Uint8Array(0)), quitar: (b) => poner('Q', desde(b)), juntar: () => { const u = new Uint8Array(P.reduce((t, c) => t + c.length, 4)); u.set([74, 88, 71, 49]); let o = 4; for (const c of P) { u.set(c, o); o += c.length; } return u; }, pedazos: P };
  JXM.bin = true;   // (la grabación también prueba el camino binario)
  return JXM.grab;
}
// un recurso que el juego ya no usa (tipo 0 mallas, 1 texturas, 2 luces horneadas, 3 materiales): que el motor lo borre
function jxmQuitar(tipo, id) {
  if (tipo === 0) { if (!JXM.mallas.has(id)) return; JXM.mallas.delete(id); }
  const B = jxmPuente(); if (!B || !JXM.on || !B.quitar) return;
  const u = new Uint8Array(9); u[0] = tipo; new DataView(u.buffer).setFloat64(1, id, true); B.quitar(jxmB64(u));
}
function jxmPoner(on) {
  on = !!on && jxmDisponible();
  if (!JXM.grab && typeof window.JXMotor !== 'undefined') {
    if (on && !JXM.prendido) { const r = String(window.JXMotor.prender()); if (r !== 'ok') { aviso('Motor nativo: ' + r); on = false; } else { JXM.prendido = true; JXM.bin = jxmProbarBin(window.JXMotor); } }
    if (!on && JXM.prendido) { window.JXMotor.apagar(); JXM.prendido = false; }
  }
  JXM.on = on; document.body.classList.toggle('jxmNat', on);
  if (on) { jxmCalidad(); jxmVigilar(); }
  jxmReiniciar();
}
// el motor nativo se vigila cada segundo: si dice «error» o en 6 s no dibujó ningún cuadro (la placa no le arma la
// superficie, un sombreador que no compila en ese celular), se apaga solo y el juego vuelve a dibujar todo con WebGL
function jxmVigilar() {
  clearInterval(JXM.vig); JXM.vigT = performance.now();
  JXM.vig = setInterval(() => {
    if (!JXM.on || JXM.grab) { clearInterval(JXM.vig); return; }
    const e = jxmEstado();
    const mal = /^error/.test(e) || (!/^ok/.test(e) && performance.now() - JXM.vigT > 6000 && JUEGO.estado === 'juego' && !document.hidden);
    if (mal) { clearInterval(JXM.vig); jxmPoner(false); PREFS.jxMotor = false; guardarPrefs(); aviso('Motor nativo apagado: ' + e.slice(0, 120)); if (typeof cnAnotar === 'function') cnAnotar('jxmotor', e.slice(0, 300)); }
  }, 1000);
}
// lo que dice el motor nativo (cuadros por segundo, ms, memoria) o su error
function jxmEstado() { try { return JXM.grab ? 'grabando' : JXM.prendido ? String(window.JXMotor.estado()) : 'apagado'; } catch (e) { return String(e); } }
// los Hz de la pantalla ahora / los que pidió la superficie del motor ("120/120"); vacío si la app no lo dice
function jxmHz() { try { return JXM.prendido && window.JXMotor.hz ? String(window.JXMotor.hz()) : ''; } catch (e) { return ''; } }
function jxmReiniciar() {
  JXM.sl = null;   // (los lugares fijos de las cosas: el motor los borra con vaciar)
  JXM.mallas.clear(); JXM.texs.clear(); JXM.lms.clear(); JXM.mats = new WeakMap(); JXM.porFirma = new Map(); JXM.agua = null; JXM.mapa = null; JXM.cieloF = null; JXM.cuboT = null; JXM.marcas = -1;
  const B = jxmPuente(); if (B && JXM.on) B.vaciar();
}
// el material: su número para el motor (uno nuevo si cambió algo: el color de un prop pintado con la herramienta, por ejemplo)
function jxmMatFirma(mt) { const c = mt.c || [1, 1, 1, 1], s = mt.st || [1, 1, 0, 0], e = mt.em || [0, 0, 0]; return [mt.tex, mt.mez, mt.terr ? 1 : 0, mt.fol ? 1 : 0, (mt.pbr || []).join(':'), c[0], c[1], c[2], c[3], s[0], s[1], s[2], s[3], e[0], e[1], e[2], mt.blend ? 1 : 0, mt.cut ? 1 : 0, mt.unlit ? 1 : 0, mt.add ? 1 : 0, mt.agua ? 1 : 0].join(','); }
// lo que todavía no tiene el motor, en un JXE1 (con un tope por cuadro: un mapa entero llega en varios cuadros)
function jxmRecursos(items) {
  const gl = R.gl, blobs = []; let off = 0, tope = 6e6;
  const poner = (u8) => { const o = off; blobs.push(u8); off += u8.length; const pad = (4 - (off % 4)) % 4; if (pad) { blobs.push(new Uint8Array(pad)); off += pad; } return o; };
  const mallas = [], mats = [], texs = [], lms = [];
  const tex = (ti) => {
    if (ti === undefined || ti === null || ti < 0 || JXM.texs.has(ti) || off > tope) return;
    texGL(ti);   // (en modo nativo WebGL no dibuja el mundo: la textura se pide acá)
    const t = R.tex[ti], D = DATA.tx[ti]; if (!t || !t.gl || !D || !D.w) return;   // (todavía no llegó: en otro cuadro)
    let w = D.w, h = D.h, lv = 0; while (Math.max(w, h) > JXM.tmax) { lv++; w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); }
    const fb = JXM.fb || (JXM.fb = gl.createFramebuffer()); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    let px = null;
    for (const nivel of lv ? [lv, 0] : [0]) {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.gl, nivel);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) continue;
      if (!nivel) { w = D.w; h = D.h; }
      px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); break;
    }
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    JXM.texs.add(ti); if (!px) return;
    // (la copia de WebGL ya no hace falta: se borra —en un celular de 1 GB no conviene tenerla dos veces— y, si WebGL la
    // vuelve a necesitar —el arma en la mano—, texGL la decodifica de nuevo)
    gl.deleteTexture(t.gl); t.gl = null; t.jxm = true;
    texs.push({ id: ti, n: D.n || '', w, h, a: D.a ? 1 : 0, o: poner(px) });
  };
  const lm = (k) => { if (k === null || k === undefined || JXM.lms.has(k)) return; const A = DATA.aj[k] && DATA.aj[k].lm; JXM.lms.add(k); if (A) lms.push({ id: k, w: A.w, h: A.h, o: poner(A.px.slice ? A.px.slice() : new Uint8Array(A.px)) }); };
  for (const p of items) {
    const m = p.m, mt = p.mt;
    if (!JXM.mallas.has(m.idx) && off < tope) {
      const d = m.d, B = m.cpu ? null : binDe(d);
      if (m.cpu) {
        // (las mallas armadas en el juego —geo.js, mallaPropia: el rayo de la Physics Gun, accesorios, entidades—, de sus datos)
        mallas.push({ id: m.idx, v: d.v, mn: d.mn, sc: d.sc, i32: d.i32 ? 1 : 0, ni: m.cpu.i.length, vo: poner(m.cpu.v.slice()), io: poner(new Uint8Array(m.cpu.i.buffer.slice(0))), lo: -1, so: -1, lm: -1 });
        JXM.mallas.add(m.idx);
      } else if (B) {
        let n = 0; for (const s of d.sub) n = Math.max(n, s[0] + s[1]);
        if (d.lod) for (const l of d.lod) for (const s of l.sub) n = Math.max(n, s[0] + s[1]);
        mallas.push({ id: m.idx, v: d.v, mn: d.mn, sc: d.sc, i32: d.i32 ? 1 : 0, ni: n, vo: poner(B.slice(d.o, d.o + d.v * 14)), io: poner(B.slice(d.i, d.i + n * (d.i32 ? 4 : 2))), lo: d.lm !== undefined ? poner(B.slice(d.lm, d.lm + d.v * 4)) : -1, so: d.sk !== undefined ? poner(B.slice(d.sk, d.sk + d.v * 8)) : -1, lm: m.lm !== null && m.lm !== undefined ? m.lm : -1 });
        JXM.mallas.add(m.idx); lm(m.lm);
      }
    }
    // (la firma se mira una vez por cuadro por material y, si no cambió en 30 cuadros, cada 30: casi nunca cambian)
    let r = JXM.mats.get(mt); const yaVisto = r && (r.c === JXM.cuadros || (JXM.cuadros - r.c < 30 && r.estable));
    const f = yaVisto ? r.f : jxmMatFirma(mt);
    if (r && !yaVisto) { r.estable = r.f === f; r.c = JXM.cuadros; }
    if (!r || r.f !== f) {
      // (dos materiales iguales —cada caja trae el suyo, con lo mismo— comparten número: así el motor dibuja las copias juntas)
      const ya = JXM.porFirma.get(f);
      if (ya !== undefined) { r = { id: ya, f, c: JXM.cuadros, estable: false }; JXM.mats.set(mt, r); tex(mt.tex); tex(mt.mez); if (mt.terr) for (const x of mt.terr.t) if (x) tex(x[0]); continue; }
      r = { id: ++JXM.matN, f, c: JXM.cuadros, estable: false }; JXM.mats.set(mt, r); JXM.porFirma.set(f, r.id);
      const terr = mt.terr ? mt.terr.t.map((x) => (x ? [x[0], x[1], x[2]] : [-1, 1, 1])) : null;
      mats.push({ id: r.id, t2: mt.mez !== undefined ? mt.mez : -1, terr, c: Array.from(mt.c || [1, 1, 1, 1]), st: Array.from(mt.st || [1, 1, 0, 0]), t: mt.tex !== undefined ? mt.tex : -1, blend: mt.blend ? 1 : 0, cut: mt.cut ? 1 : 0, unlit: mt.unlit && !mt.fol ? 1 : 0, add: mt.add ? 1 : 0, agua: mt.agua ? 1 : 0, em: Array.from(mt.em || [0, 0, 0]), pbr: Array.from(mt.pbr || [0.72, 0, 0.04]), fol: mt.fol ? 1 : 0 });
    }
    tex(mt.tex); tex(mt.mez); if (mt.terr) for (const x of mt.terr.t) if (x) tex(x[0]);
  }
  // el atlas de las partículas (efectosAtlas: 256×256), una vez; se queda también en WebGL (lo usan las nucleares)
  if (!JXM.texs.has(-1000) && PART.tex && PART.tex.atlas) {
    const fb = JXM.fb || (JXM.fb = gl.createFramebuffer()); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, PART.tex.atlas, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) { const px = new Uint8Array(256 * 256 * 4); gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, px); texs.push({ id: -1000, n: 'atlas', w: 256, h: 256, a: 1, o: poner(px) }); }
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    JXM.texs.add(-1000);
  }
  // el agua de HL2 (una vez por mapa)
  let agua = null; const H = AGUA.hl2;
  if (H && H.tpx && JXM.agua !== H) {
    JXM.agua = H;
    agua = { fog: H.fog, esc: H.esc, fuerza: H.fuerza, dist: H.dist, refr: H.refr || 0.5, s: H.s, largo: H.largo, normal: { w: H.tw, h: H.th, o: poner(H.tpx) } };
    if (H.prof && H.prof.px) agua.prof = { x0: H.prof.x0, z0: H.prof.z0, w: H.prof.w, h: H.prof.h, D: H.prof.D, tex: { w: H.prof.n, h: H.prof.n, o: poner(H.prof.px) } };
    const W = AGUA.vols.find((v) => v.mapa); agua.y = W ? W.y1 : 0;
  }
  // el cielo: el degradé del mapa y la caja de GMod (sus seis caras, leídas de WebGL una vez), con el tinte y cuánto se ve
  // como en dibujarCubo (de día la caja, de noche el degradé); se manda de nuevo sólo si cambia
  let cielo = null; const C = R.cielo;
  if (C && C.top) {
    const cubo = C.cubo ? cuboGL(C.cubo) : C.cuboPx ? cuboGLpx(C.cuboPx) : null;   // (en modo nativo nadie más lo pide)
    const B = typeof DIA !== 'undefined' && DIA.base && DIA.base.cielo, lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
    const dia = B ? clamp(lum(C.top) / Math.max(1e-3, lum(B.top)), 0, 1) : 1, tin = B ? [0, 1, 2].map((i) => clamp(C.mid[i] / Math.max(1e-3, B.mid[i]), 0, 1.5)) : [1, 1, 1];
    const par = { top: Array.from(C.top), mid: Array.from(C.mid), bot: Array.from(C.bot), exp: Array.from(C.exp || [0.5, 0.5]), tinte: tin, dia, k: R.cieloK || 1, cubo: cubo ? 1 : 0 };
    const f = JSON.stringify(par);
    if (f !== JXM.cieloF || (cubo && JXM.cuboT !== cubo)) {
      JXM.cieloF = f; cielo = par;
      const L = C.cuboPx ? C.cuboPx.L : C.cubo && DATA.tx[C.cubo[0]] ? DATA.tx[C.cubo[0]].w : 0;
      if (cubo && JXM.cuboT !== cubo && L) {
        const fb = JXM.fb || (JXM.fb = gl.createFramebuffer()); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); const o = [];
        for (let k = 0; k < 6; k++) {
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + k, cubo, 0);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) break;
          const px = new Uint8Array(L * L * 4); gl.readPixels(0, 0, L, L, gl.RGBA, gl.UNSIGNED_BYTE, px); o.push(poner(px));
        }
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (o.length === 6) { cielo.caras = { l: L, o }; JXM.cuboT = cubo; }
      }
    }
  }
  if (!mallas.length && !mats.length && !texs.length && !lms.length && !agua && !cielo) return null;
  const J = { v: 2, mapa: MUNDO.nombre, mallas, mats, texs, lms, agua, cielo };
  const js = new TextEncoder().encode(JSON.stringify(J)), tot = new Uint8Array(8 + js.length + off);
  tot.set([74, 88, 69, 49]); new DataView(tot.buffer).setUint32(4, js.length, true); tot.set(js, 8);
  let o = 8 + js.length; for (const b of blobs) { tot.set(b, o); o += b.length; }
  JXM.bytesR += tot.length;
  return tot;
}
// el cuadro: lo que le llega al motor nativo. Devuelve true si el mundo lo dibuja el motor
function jxmCuadroNativo() {
  const B = jxmPuente(); if (!B) return false;
  if (JXM.mapa !== MUNDO.nombre) { if (JXM.mapa !== null) jxmReiniciar(); JXM.mapa = MUNDO.nombre; }
  const items = []; let ns = 0;
  for (let i = 0; i < R.nItems; i++) { const p = R.items[i]; if (p.vista || !p.m || !p.mt) continue; if (p.m.idx === undefined) { ns++; continue; } items.push(p); }
  JXM.sinMalla = ns;
  const rec = jxmRecursos(items); if (rec) { if (JXM.bin && B.recursosBin) B.recursosBin(jxmBin(rec)); else B.recursos(jxmB64(rec)); }
  // la cabecera: cámara, sol, cielo y suelo, niebla, agua, tiempo y luces
  if (JXM.f.length < 47 + 24 * 12) JXM.f = new Float32Array(4096);
  const F = JXM.f;
  let k = 2; const pon = (a, m) => { for (let i = 0; i < m; i++) F[k++] = a[i]; };
  pon(R.vp, 16); F[k++] = CAM.pos.x; F[k++] = CAM.pos.y; F[k++] = CAM.pos.z;
  F[k++] = R.sol.x; F[k++] = R.sol.y; F[k++] = R.sol.z;
  // (la luz en lineal, la misma que usa WebGL en Alto —R.lin, luzLineal—)
  const Ln = R.lin && R.lin.solCol ? R.lin : null;
  pon(Ln ? Ln.solCol : srgb3(R.solCol || [1, 1, 1]).map((x) => x * 2.6), 3); pon(Ln ? Ln.ambS : srgb3(R.ambS || [0.4, 0.45, 0.5]), 3); pon(Ln ? Ln.ambG : srgb3(R.ambG || [0.3, 0.3, 0.3]), 3); pon(Ln && Ln.nieC ? Ln.nieC : srgb3(R.niebla.c), 3);
  F[k++] = R.niebla.a; F[k++] = R.niebla.b; F[k++] = R.expo || 0.66;
  const W = AGUA.vols.find((v) => v.mapa); F[k++] = W ? W.y1 : NaN; F[k++] = (R.msCuadro / 1000) % 3600;
  const nl = R.nLuces || 0, ne = R.nEsp || 0; F[k++] = nl; F[k++] = ne;
  { const sc = Ln ? Ln.solCol : [1, 1, 1], t = R.nieS || NIE_S1; F[k++] = R.niebla.m === undefined ? 1 : R.niebla.m; F[k++] = sc[0] * t[0]; F[k++] = sc[1] * t[1]; F[k++] = sc[2] * t[2]; }
  for (let i = 0; i < nl; i++) { pon(LUZ_P.subarray(i * 4), 4); pon(LUZ_C.subarray(i * 4), 4); pon(LUZ_D.subarray(i * 4), 4); }
  for (let i = 0; i < ne; i++) { pon(ESP_P.subarray(i * 4), 4); pon(ESP_C.subarray(i * 4), 4); pon(ESP_D.subarray(i * 4), 4); }
  // (las cosas cuya malla todavía no llegó —se cortó por el tope— esperan al cuadro que viene)
  // Cada cosa tiene un lugar fijo en el motor (JXC2): se manda sólo lo que cambió (malla, parte, material, matriz, esfera,
  // banderas), la lista de lo que hay en este cuadro y los huesos. Con 500 cajas quietas, casi nada viaja.
  const S = JXM.sl || (JXM.sl = { porM: new WeakMap(), fijo: new Map(), dat: [], visto: [], libres: [] });
  const fr = JXM.cuadros, U = [], V = [], HH = [];
  for (const p of items) {
    if (!JXM.mallas.has(p.m.idx)) continue;
    const r = JXM.mats.get(p.mt); if (!r) continue;
    // (la identidad de una cosa: su matriz —la de cada nodo de cada objeto es suya y no cambia de arreglo—; la de una parte con
    // huesos, que va con la matriz identidad, el arreglo de huesos de su personaje: si no, dos NPC con el mismo modelo tenían
    // la misma clave y el segundo pedía un lugar nuevo en cada cuadro)
    const due = p.M !== IDM ? p.M : p.h;
    let mapa = S.fijo, clave = p.m.idx * 1048576 + p.s0;
    if (due) { mapa = S.porM.get(due); if (!mapa) { mapa = new Map(); S.porM.set(due, mapa); } }
    let sl = mapa.get(clave);
    if (sl === undefined || S.visto[sl] === fr) {   // (la misma clave dos veces en un cuadro: otro lugar)
      sl = S.libres.length ? S.libres.pop() : S.dat.length; S.dat[sl] = { c: new Float32Array(25).fill(NaN), mapa, clave }; mapa.set(clave, sl);
    }
    S.visto[sl] = fr; V.push(sl);
    // (lo guardado es lo que viajó, en 32 bits: se compara contra eso —el centro y el radio se calculan en 64 y nunca eran
    // iguales a su redondeo: todo parecía cambiar en cada cuadro y viajaba entero—)
    const c = S.dat[sl].c, M = p.M, rr = Math.fround(p.h ? p.r : p.r || -1), fl = p.ns ? 1 : 0, fx = Math.fround(p.cx), fy = Math.fround(p.cy), fz = Math.fround(p.cz);
    let cambio = c[0] !== p.m.idx || c[1] !== p.s0 || c[2] !== p.sn || c[3] !== r.id || c[20] !== fx || c[21] !== fy || c[22] !== fz || c[23] !== rr || c[24] !== fl;
    if (!cambio) for (let i = 0; i < 16; i++) if (c[4 + i] !== Math.fround(M[i])) { cambio = true; break; }
    if (cambio) { c[0] = p.m.idx; c[1] = p.s0; c[2] = p.sn; c[3] = r.id; for (let i = 0; i < 16; i++) c[4 + i] = M[i]; c[20] = p.cx; c[21] = p.cy; c[22] = p.cz; c[23] = rr; c[24] = fl; U.push(sl); }
    if (p.h) HH.push(sl, p);
  }
  // (los lugares que no se usan hace 300 cuadros quedan libres)
  if (fr % 120 === 0) for (let i = 0; i < S.dat.length; i++) { const d = S.dat[i]; if (d && fr - (S.visto[i] || 0) > 300) { d.mapa.delete(d.clave); S.dat[i] = null; S.libres.push(i); } }
  JXM.nU = U.length; JXM.nLug = S.dat.length;   // (cuántas cosas cambiaron en este cuadro y cuántos lugares hay: para medir)
  let nh = 0; for (let i = 1; i < HH.length; i += 2) nh += 2 + Math.min(HH[i].h.nf || HH[i].h.length, 56 * 12);
  const n = k + 3 + U.length * 26 + V.length + nh;
  if (JXM.f.length < n) { const G = new Float32Array(n * 1.5 | 0); G.set(JXM.f.subarray(0, k)); JXM.f = G; }
  const F2 = JXM.f; new Uint32Array(F2.buffer, 0, 1)[0] = 0x3243584a;   // 'JXC2'
  F2[1] = V.length;
  F2[k++] = U.length;
  for (const sl of U) { const c = S.dat[sl].c; F2[k++] = sl; for (let i = 0; i < 25; i++) F2[k++] = c[i]; }
  F2[k++] = V.length; for (const sl of V) F2[k++] = sl;
  // (los huesos van una vez por personaje: sus otras partes dicen de qué lugar copiarlos)
  const hs = JXM.hs || (JXM.hs = new Map()); hs.clear();
  F2[k++] = HH.length / 2;
  for (let i = 0; i < HH.length; i += 2) {
    const sl = HH[i], h = HH[i + 1].h, ya = hs.get(h); F2[k++] = sl;
    if (ya !== undefined) F2[k++] = -(ya + 1); else { const m = Math.min(h.nf || h.length, 56 * 12); F2[k++] = m; F2.set(h.subarray ? h.subarray(0, m) : h.slice(0, m), k); k += m; hs.set(h, sl); }
  }
  // los efectos: las partículas (una fila de 16 números por partícula —la del primer vértice de los 6 de efectos.js—, con la
  // derecha y el arriba de la cámara) y las marcas de frenada cuando cambian
  const ef = [];
  if (PART.l.length) {
    const ex = PART.extra; PART.extra = null;
    PART.captura = (aditivo, D, nv) => { const np = nv / 6, b = new Float32Array(6 + np * PART_F); b[0] = CAM.der.x; b[1] = CAM.der.y; b[2] = CAM.der.z; b[3] = CAM.arr.x; b[4] = CAM.arr.y; b[5] = CAM.arr.z; for (let i = 0; i < np; i++) b.set(D.subarray(i * 6 * PART_F, i * 6 * PART_F + PART_F), 6 + i * PART_F); ef.push([aditivo ? 2 : 1, b]); };
    try { dibujarEfectos(); } finally { PART.captura = null; PART.extra = ex; }
  }
  if (MARCAS.v && JXM.marcas !== MARCAS.ver) { JXM.marcas = MARCAS.ver; ef.push([3, MARCAS.v]); }
  let extra = 0; for (const [, b] of ef) extra += 2 + b.length;
  if (extra) {
    if (JXM.f.length < k + extra) { const G = new Float32Array((k + extra) * 1.5 | 0); G.set(JXM.f.subarray(0, k)); JXM.f = G; }
    const G = JXM.f; for (const [t, b] of ef) { G[k++] = t; G[k++] = b.length; G.set(b, k); k += b.length; }
  }
  const u8 = new Uint8Array(JXM.f.buffer, 0, k * 4);
  if (JXM.bin && B.cuadroBin) B.cuadroBin(jxmBin(u8)); else B.cuadro(jxmB64(u8));
  JXM.bytesC = u8.length;
  JXM.cuadros++;
  return true;
}
// lo que dibujó WebGL encima (el arma, los efectos) con alfa 1 donde quedó profundidad: lo opaco tapa del todo
function jxmAlfa() {
  const gl = R.gl;
  if (!JXM.pa) {
    const vs = '#version 300 es\nvoid main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0; gl_Position = vec4(p, 0.9999, 1.0); }';
    const fs = '#version 300 es\nprecision mediump float; out vec4 o; void main(){ o = vec4(0.0, 0.0, 0.0, 1.0); }';
    const P = gl.createProgram(); for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); gl.attachShader(P, x); }
    gl.linkProgram(P); JXM.pa = P;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, R.cv.width, R.cv.height);
  gl.useProgram(JXM.pa); R.progAct = null; gl.bindVertexArray(null); R.vaoAct = null;
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.GREATER); gl.depthMask(false); gl.disable(gl.BLEND); gl.colorMask(false, false, false, true);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.colorMask(true, true, true, true); gl.depthMask(true); gl.depthFunc(gl.LESS);
}
