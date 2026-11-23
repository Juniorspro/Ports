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
    AGUA.hl2 = { tex, nom, normal: nr, fog: [lin[0], lin[1], lin[2], turbia], esc: 0.38, fuerza: 0.55, dist: 0.09, s: [0.021, 0.016, -0.018, 0.024], bajo: fs.map((c) => Math.min(1, c * 1.5)), largo: Math.max(1.5, fin * GM_S / 2.5), prof: jxpAguaFondo() };
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
  return { tex, x0, z0, w, h, D };
}
