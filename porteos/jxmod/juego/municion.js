// ---------------- Munición: cajas en la pestaña Armas y, si se quiere, munición limitada como en GMod ----------------
// Bugs y sugerencias q55n3p6u: «munición, que aparezca en la sección de armas». En Armas → Munición están las cajas de
// Half-Life 2 (las de GMod: pistola, SMG, rifle de pulso, escopeta, .357, ballesta, cohetes, granadas de SMG, granadas y el
// cajón con todo): se ponen delante y se agarran pasando por encima. Abajo, «Munición limitada (como en GMod)»: apagada —lo
// de siempre, la reserva es infinita y las cajas sólo llenan el cargador— o prendida: cada tipo tiene su reserva (empieza
// con un poco, se gasta al recargar, las cajas la llenan, al reaparecer vuelve a lo del principio), para las armas del
// juego y para las de los addons de GMod (GetAmmoCount, GiveAmmo, RemoveAmmo, SetAmmo, Ammo1, DefaultReload, game.GetAmmoID).
const MUN = { res: new Map(), cajas: new Set() };
// [tipo, modelo de la caja, cuánto da, con cuánto se empieza]
const MUN_TIPOS = [
  ['pistol', 'models/items/boxsrounds.mdl', 20, 60], ['smg1', 'models/items/boxmrounds.mdl', 45, 90], ['ar2', 'models/items/combine_rifle_cartridge01.mdl', 20, 60],
  ['buckshot', 'models/items/boxbuckshot.mdl', 20, 16], ['357', 'models/items/357ammo.mdl', 6, 12], ['xbowbolt', 'models/items/crossbowrounds.mdl', 6, 5],
  ['rpg_round', 'models/weapons/w_missile_closed.mdl', 1, 2], ['smg1_grenade', 'models/items/ar2_grenade.mdl', 1, 1], ['grenade', 'models/items/grenadeammo.mdl', 1, 2],
  ['todo', 'models/items/ammocrate_smg1.mdl', 0, 0]];
const MUN_MAX = 9999;   // (gmod_maxammo de GMod)
// los ids de GMod (game.GetAmmoID): los de HL2 en su orden; los de los addons (game.AddAmmoType) se agregan al final
const MUN_IDS = ['AR2', 'AR2AltFire', 'Pistol', 'SMG1', '357', 'XBowBolt', 'Buckshot', 'RPG_Round', 'SMG1_Grenade', 'Grenade', 'slam', 'AlyxGun', 'SniperRound', 'SniperPenetratedRound', 'Thumper', 'Gravity', 'Battery', 'GaussEnergy', 'CombineCannon', 'AirboatGun', 'StriderMinigun', 'HelicopterGun', 'StriderMinigunDirect', 'CombineHeavyCannon'];
// las armas del juego: qué munición usan
const MUN_NATIVAS = { Pistol: 'pistol', Revolver: '357', Smg: 'smg1', Akm: 'ar2', Sniper: 'ar2', Shotgun: 'buckshot', RPG: 'rpg_round', Crossbow: 'xbowbolt' };
const munLimitada = () => !!(typeof PREFS !== 'undefined' && PREFS.municionLimitada);
// el nombre de un tipo (lo que viene del Lua: un id, un nombre con mayúsculas) → la clave
function munTipo(t) {
  if (typeof t === 'number') return t >= 1 && t <= MUN_IDS.length ? MUN_IDS[t - 1].toLowerCase() : null;
  const s = String(t == null ? '' : t).trim().toLowerCase(); return s && s !== 'none' ? s : null;
}
function munId(t) { const s = munTipo(t); if (!s) return -1; const i = MUN_IDS.findIndex((x) => x.toLowerCase() === s); if (i >= 0) return i + 1; MUN_IDS.push(String(t)); return MUN_IDS.length; }
// cuánto queda: con la munición limitada apagada, como siempre (999 para los addons, infinito para el juego)
function munCuenta(t) { const s = munTipo(t); if (!s) return 0; return munLimitada() ? MUN.res.get(s) || 0 : 999; }
function munDar(t, n) { const s = munTipo(t); if (!s || !(n > 0)) return 0; const a = MUN.res.get(s) || 0, b = Math.min(MUN_MAX, a + Math.round(n)); MUN.res.set(s, b); munHud(); return b - a; }
function munQuitar(t, n) { const s = munTipo(t); if (!s || !(n > 0)) return; MUN.res.set(s, Math.max(0, (MUN.res.get(s) || 0) - Math.round(n))); munHud(); }
function munPoner(t, n) { const s = munTipo(t); if (!s) return; MUN.res.set(s, Math.max(0, Math.min(MUN_MAX, Math.round(+n || 0)))); munHud(); }
// al empezar y al reaparecer: lo del principio
function munReiniciar() { MUN.res.clear(); for (const [t, , , ini] of MUN_TIPOS) if (ini) MUN.res.set(t, ini); munHud(); }
const munHud = () => { if (typeof hudArma === 'function' && typeof JUEGO !== 'undefined' && JUEGO.estado === 'juego') try { hudArma(); } catch (e) {} };
// las armas del juego: la reserva de la que está en la mano (null: infinita)
function munNativa(n) { const t = MUN_NATIVAS[n] || (DEF_ARMAS[n] && DEF_ARMAS[n].car > 0 ? 'smg1' : null); return t; }
function munReservaNativa(n) { const t = munNativa(n); return t && munLimitada() ? MUN.res.get(t) || 0 : null; }
// recargar un arma del juego: lo que entra en el cargador, de la reserva (sin límite, lleno)
function munRecargaNativa(n, balas, car) {
  if (!munLimitada()) return car;
  const t = munNativa(n); if (!t) return car;
  const r = MUN.res.get(t) || 0, toma = Math.min(car - balas, r); MUN.res.set(t, r - toma); return balas + toma;
}

// ---------------- las cajas ----------------
// en la pestaña Armas: la categoría Munición (ui.js) con «mun:<tipo>»
const munItems = () => MUN_TIPOS.map(([t]) => 'mun:' + t);
const munModeloDe = (it) => { const x = MUN_TIPOS.find((m) => 'mun:' + m[0] === it); return x ? x[1] : null; };
function munNombre(it) { const t = String(it).slice(4); const k = 'mun.t_' + t, s = T(k); return s === k ? t : s; }
// (al abrir la categoría: los diez modelos con sus materiales y texturas, de una; después se redibujan sus íconos —antes
// salían grises, dibujados sin la textura que todavía no había llegado—)
function munPrecargar() {
  if (MUN.precarga || typeof gmlIniciar !== 'function') return MUN.precarga;
  MUN.precarga = (async () => {
    await gmlIniciar();
    for (const [, r] of MUN_TIPOS) { const base = r.slice(0, -4); for (const x of [r, base + '.vvd', base + '.dx90.vtx', base + '.phy']) if (gmlTiene(x)) gmlPedir(x); }
    clearTimeout(GML.timer); await gmlPedirAhora();
    for (const [, r] of MUN_TIPOS) GMOD.iconos.delete('gm:' + r);
    if (typeof UI !== 'undefined' && UI.abierto === 'spawn' && DATA.menu[UI.tab] && DATA.menu[UI.tab].n === 'Weapons') spawnDibujar();
  })().catch(() => {});
  return MUN.precarga;
}
// ponerla: el modelo de la caja de HL2 (de la biblioteca de GMod: se baja si hace falta) delante, como un prop
async function munPoner1(it) {
  const r = munModeloDe(it); if (!r || typeof JUEGO === 'undefined' || JUEGO.estado !== 'juego') return null;
  if (!gmArchivo(r) || !gmArchivo(r.slice(0, -4) + '.vvd')) {
    if (typeof gmlIniciar === 'function') await gmlIniciar();
    const base = r.slice(0, -4), L = [r, base + '.vvd', base + '.dx90.vtx', base + '.phy'].filter((x) => gmlTiene(x));
    for (const x of L) gmlPedir(x); clearTimeout(GML.timer); await gmlPedirAhora();
  }
  const o = spawnDelante('gm:' + r, { congelado: false });
  if (o) { o.mun = it.slice(4); MUN.cajas.add(o); }
  return o;
}
// cada cuadro: pasar por encima de una caja propia la agarra (las de los demás, ellos)
function munPaso() {
  if (!MUN.cajas.size || typeof JUG === 'undefined' || !JUG.vivo) return;
  for (const o of MUN.cajas) {
    if (!OBJS.includes(o)) { MUN.cajas.delete(o); continue; }
    if (o.remoto || vsub(o.b.pos, JUG.pos).len() > 1.4) continue;
    if (munAgarrar(o.mun)) { MUN.cajas.delete(o); borrarObjeto(o); }
  }
}
// lo que da una caja: a la reserva de su tipo (el cajón, a todas) y, si el arma en la mano es de ese tipo, el cargador lleno
function munAgarrar(t) {
  const tipos = t === 'todo' ? MUN_TIPOS.filter((m) => m[2] > 0) : MUN_TIPOS.filter((m) => m[0] === t);
  let dio = 0;
  if (munLimitada()) for (const [k, , n] of tipos) dio += munDar(k, t === 'todo' ? n * 3 : n);
  // (el cargador del arma en la mano: la del juego o la de un addon)
  const n = ARM.lista[ARM.i], D = DEF_ARMAS[n];
  if (D && D.car > 0 && D.tipo !== 'gmswep' && (t === 'todo' || munNativa(n) === t) && ARM.balas[n] < D.car) {
    ARM.balas[n] = munLimitada() ? munRecargaNativa(n, ARM.balas[n], D.car) : D.car; dio++;
  }
  if (!munLimitada() && !dio) { dio = 1; }   // (sin límite, la caja se agarra igual: el sonido y el cartel)
  if (!dio) return false;
  if (typeof gmsnEmitir === 'function' && typeof GMA !== 'undefined' && GMA.jug && GMA.R) { try { gmsnEmitir(GMA.jug, 'items/ammo_pickup.wav', 70, 100, 1); } catch (e) { sonar('Click', null, 0.6, 0.9); } }
  else sonar('Click', null, 0.6, 0.9);
  aviso(T('mun.agarraste').replace('{m}', munNombre('mun:' + t)), 1.6);
  munHud();
  return true;
}
if (typeof module !== 'undefined') module.exports = { MUN, munTipo, munId, munCuenta, munDar, munQuitar, munPoner, munReiniciar, munRecargaNativa };
