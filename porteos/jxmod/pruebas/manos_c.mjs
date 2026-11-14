// «C_Arms compatibles»: las armas c_ de los addons (UseHands) con las manos del modelo de jugador que tenés puesto, como
// gmod_hands de GMod. Por cada arma y personaje, cuadro a cuadro de sacar, quieto, disparar y recargar (manos_c_medir.js):
//  1. tiene manos, y son las que corresponden: las que registró el addon del modelo de jugador (AddValidHands), las de
//     ciudadano si no registró, y las de ciudadano teñidas con sus colores para los personajes del juego e importados
//  2. los huesos de las manos coinciden con la referencia hecha con la matemática de Source (bonemerge + los huesos
//     procedurales de muñeca y cúbito, DoQuatInterpBone): ≤ 0,01 unidades y ≤ 0,1°, y la piel ≤ 0,05 cm
//  3. la palma y la empuñadura: la distancia de cada cuadro igual a la de la referencia (≤ 0,05 cm); se anotan el hueco
//     más grande entre la mano y el arma y el salto más grande de la mano entre dos cuadros
//  4. una «v_» que ya trae brazos y dice UseHands no lleva otras manos encima; la c_ espejada (ViewModelFlip) y la de una
//     sola mano (Physics Gun c_) también pasan 2
//  5. los personajes del juego: color de mangas y manos medido de su malla; sin errores de Lua
//  6. costo: procesador por cuadro con y sin manos, y dibujos y triángulos de más
// uso: node manos_c.mjs URL_HTML URL_GMA CARPETA_FOTOS [compu|celu]   (URL_GMA: carpeta servida con <id>/<id>.gma)
//   ARMAS="id:clase,..." PMS="Hero,gm:139247091,..." para elegir; CUADROS=60 cuadros por animación como mucho
import { abrir } from './base.mjs';
import fs from 'fs'; import path from 'path'; import zlib from 'zlib';
const [, , HTML, G, D = '/tmp/claude-0/carms', MODO = 'compu'] = process.argv; fs.mkdirSync(D, { recursive: true });
const celu = MODO === 'celu', AQUI = path.dirname(new URL(import.meta.url).pathname);
// (armas c_ de addons populares; la última tanda son las de prueba que arma esta misma prueba: c_ espejada, c_ de una mano, v_)
const ARMAS = (process.env.ARMAS || '123277559:weapon_nyangun,124648402:orbital_friendship_cannon,104607228:weapon_extinguisher,827320827:weapon_catgun,' +
  '1382102057:infinitygauntlet,307451675:enchanted_hand,419153126:weapon_hpmstick,1335202125:weapon_waterballoon,329001415:weapon_ai_scanner,' +
  '247650447:weapon_laserpistol,253343405:weapon_tnukerocket,167016569:weapon_shrinkray,1226709998:weapon_tacticalnuke,764395035:weapon_rpw_binoculars,' +
  '410645074:parkourmod,887833744:csgo_karambit,prueba:carms_ak_espejo,prueba:carms_physgun,prueba:carms_v_pistola').split(',').map((x) => x.split(':'));
// (personajes: del juego, de addons con manos propias y sin ellas)
const PMS = (process.env.PMS || 'Hero,gm:139247091,gm:310559057,gm:452065494,gm:656834283,gm:485879458,gm:674702181,gm:572267883,gm:183901628,gm:227312918,gm:348376962,gm:1371823037,Goku,Freddy,Jake,Robot').split(',');
const CUADROS = +(process.env.CUADROS || 60);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 600) : '')); };
// el .gma de prueba (GMAD): tres SWEPs con UseHands
function gmaPrueba() {
  const swep = (nom, vm, flip) => Buffer.from(`SWEP.PrintName = "${nom}"\nSWEP.Category = "Prueba de manos"\nSWEP.Spawnable = true\nSWEP.ViewModel = "${vm}"\nSWEP.WorldModel = "models/weapons/w_rif_ak47.mdl"\nSWEP.ViewModelFOV = 62\nSWEP.ViewModelFlip = ${flip}\nSWEP.UseHands = true\nSWEP.HoldType = "ar2"\nSWEP.Primary.ClipSize = 30\nSWEP.Primary.DefaultClip = 30\nSWEP.Primary.Automatic = true\nSWEP.Primary.Ammo = "SMG1"\nSWEP.Secondary.ClipSize = -1\nSWEP.Secondary.DefaultClip = -1\nSWEP.Secondary.Ammo = "none"\nfunction SWEP:PrimaryAttack()\n  if not self:CanPrimaryAttack() then return end\n  self:SendWeaponAnim(ACT_VM_PRIMARYATTACK)\n  self:TakePrimaryAmmo(1)\n  self:SetNextPrimaryFire(CurTime() + 0.12)\nend\nfunction SWEP:Reload()\n  self:DefaultReload(ACT_VM_RELOAD)\nend\n`);
  const F = [['lua/weapons/carms_ak_espejo.lua', swep('AK espejada', 'models/weapons/cstrike/c_rif_ak47.mdl', true)], ['lua/weapons/carms_physgun.lua', swep('Physics Gun c_', 'models/weapons/c_superphyscannon.mdl', false)], ['lua/weapons/carms_v_pistola.lua', swep('Pistola v_', 'models/weapons/v_pistol.mdl', false)]];
  const u32 = (x) => { const b = Buffer.alloc(4); b.writeUInt32LE(x >>> 0); return b; }, i64 = (x) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(x)); return b; };
  const L = [Buffer.from('GMAD'), Buffer.from([3]), i64(0), i64(Math.floor(Date.now() / 1000)), Buffer.from('\0Prueba de manos\0{"type":"weapon"}\0JXMod\0'), u32(1)];
  F.forEach(([r, d], i) => L.push(u32(i + 1), Buffer.from(r + '\0'), i64(d.length), u32(zlib.crc32 ? zlib.crc32(d) : 0)));
  L.push(u32(0)); for (const [, d] of F) L.push(d); const b = Buffer.concat(L); return Buffer.concat([b, u32(zlib.crc32 ? zlib.crc32(b) : 0)]);
}
const PRUEBA = gmaPrueba().toString('base64'), MEDIR = fs.readFileSync(AQUI + '/manos_c_medir.js', 'utf8');
let s = null, n = 0;
const nueva = async () => {
  if (s) await s.b.close().catch(() => {});
  s = await abrir(HTML, celu); n = 0;
  await s.ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); DIA.hora = 13; DIA.aplicada = -1; 1`);
  await s.p.waitForTimeout(1500); await s.p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 90000 });
  await s.ev(`window.esperaJuego = (t) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + t || performance.now() - r0 > 25000 ? ok() : setTimeout(f, 20)); f(); }); $('hud').classList.add('oc'); 1`);
  await s.ev(MEDIR + '; 1');
};
const inst = (id) => s.ev(`(async () => { if (GMOD.addons.has('${id}')) return 1;
  const b = '${id}' === 'prueba' ? Uint8Array.from(atob('${PRUEBA}'), (c) => c.charCodeAt(0)) : new Uint8Array(await (await fetch('${G}/${id}/${id}.gma')).arrayBuffer());
  const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, b); await A.listo; await esperaJuego(0.3); return 1; })()`);
// el modelo de jugador: el del addon (lo que registró con AddValidModel, o su .mdl de models/player) y las manos que le
// tocan según lo que registró con AddValidHands (leído de su Lua acá, aparte del juego)
const ponerPM = async (pm) => {
  if (!pm.startsWith('gm:')) return { modelo: await s.ev(`(() => { PREFS.skin = '${pm}'; jugadorCuerpoNuevo(); return '${pm}'; })()`), esperadas: 'models/weapons/c_arms_citizen.mdl', tinte: true };
  const id = pm.slice(3); await inst(id);
  return s.ev(`(() => { const A = GMOD.addons.get('${id}'); const L = gmpLista().filter((r) => A.G.archivos.has(r));
    const nom = [...(GMA.pmodels || new Map())].map(([n, x]) => [n, gmvRutaMdl(x)]).find(([n, r]) => L.includes(r)), m = nom ? nom[1] : L[0];
    PREFS.skin = 'gmpm:' + m; jugadorCuerpoNuevo();
    // (las de su nombre; si no, las que el addon registró para ese modelo con otro nombre o con el del archivo)
    const alias = [...(GMA.pmodels || new Map())].filter(([n, x]) => gmvRutaMdl(x) === m).map(([n]) => n.toLowerCase()).concat(m.replace(/^.*\\//, '').replace(/\\.mdl$/, ''));
    let esperadas = 'models/weapons/c_arms_citizen.mdl', exacta = false; const tx = new TextDecoder('latin1');
    for (const [r, b] of A.G.archivos) if (/\\.lua$/.test(r)) for (const x of tx.decode(b).matchAll(/AddValidHands\\s*\\(\\s*["']([^"']+)["']\\s*,\\s*["']([^"']+)["']/g)) {
      if (nom && x[1] === gmvPmNombre(m)) { esperadas = gmvRutaMdl(x[2]); exacta = true; } else if (!exacta && alias.includes(x[1].toLowerCase())) esperadas = gmvRutaMdl(x[2]); }
    return { modelo: m, esperadas }; })()`);
};
const res = [];
for (const pm of PMS) {
  // (con Hero, todas las armas; con los demás personajes, tres: dos manos en un fusil, un extintor y sólo manos)
  const lista = pm === 'Hero' ? ARMAS : ARMAS.filter(([a]) => ['123277559', '104607228', '1382102057'].includes(a));
  for (const [aid, clase] of lista) {
    if (!s || n >= 6) await nueva(); n++;
    const r = { pm, addon: aid, clase };
    try {
      await inst(aid); Object.assign(r, await ponerPM(pm));
      await s.ev(`(async () => { window.__e0 = GMA.errores.length; JUG.tercera = false; JUG.yaw = 0; JUG.pitch = 0.05; JUG.pos.set(0, JUG.pos.y, 0); JUG.vel.set(0, 0, 0); gmaSpawnMenu('gmswep:${clase}'); await esperaJuego(2.5);
        for (let i = 0; i < 40 && GMA.swep && TIEMPO.t < (GMA.swep.nextP || 0); i++) await esperaJuego(0.2);
        for (let i = 0; i < 60 && !(ARM.v && ARM.v.manos && (!ARM.v.manos.tinte || GMVT.col.get(ARM.v.manos.tinte))); i++) await esperaJuego(0.25); return 1; })()`);
      r.vista = await s.ev(`(() => { const v = ARM.v; return v ? { ruta: v.ruta, manos: v.manos ? v.manos.model : null, proc: v.manos ? v.manos.proc.length : 0, tinte: v.manos && v.manos.tinte ? GMVT.col.get(v.manos.tinte) || null : null } : null; })()`);
      const nom = (pm + '_' + clase).replace(/[^\w.-]+/g, '_') + (celu ? '_celu' : '');
      await s.p.screenshot({ path: `${D}/${nom}_quieta.jpg`, type: 'jpeg', quality: 82 });
      await s.ev(`(async () => { ENT.disparo = true; await esperaJuego(0.12); return 1; })()`); await s.p.screenshot({ path: `${D}/${nom}_fuego.jpg`, type: 'jpeg', quality: 82 });
      await s.ev(`(async () => { ENT.disparo = false; await esperaJuego(0.6); const w = GMA.swep; if (w && w.clip1 !== undefined) w.clip1 = Math.max(0, (w.clip1 | 0) - 3); recargar(); await esperaJuego(0.45); return 1; })()`);
      await s.p.screenshot({ path: `${D}/${nom}_recarga.jpg`, type: 'jpeg', quality: 82 });
      await s.ev(`esperaJuego(1.5)`);
      r.medida = JSON.parse(await s.ev(`JSON.stringify(ARM.v && ARM.v.manos ? __carms.medir(${CUADROS}) : { e: 'sin manos' })`));
      if (pm === 'Hero' && aid === '123277559') r.costo = await s.ev(`__carms.costo(6)`);
      r.errLua = await s.ev(`GMA.errores.slice(window.__e0).slice(0, 4).map((x) => String(x.msg || x).slice(0, 160))`);
    } catch (e) { r.fallo = String(e.message || e).slice(0, 300); try { await nueva(); } catch (e2) {} }
    res.push(r); fs.writeFileSync(D + '/manos_c.json', JSON.stringify(res, null, 1));
  }
}
if (s) await s.b.close();
// ---- los criterios ----
const anims = (r) => (r.medida && r.medida.anims ? Object.values(r.medida.anims) : []);
const mx = (r, k) => Math.max(0, ...anims(r).map((a) => a[k]));
const conManos = res.filter((r) => r.clase !== 'carms_v_pistola');
ok('1. las armas c_ tienen manos (y son las del personaje)', conManos.every((r) => r.vista && r.vista.manos && r.vista.manos === r.esperadas), conManos.filter((r) => !(r.vista && r.vista.manos === r.esperadas)).map((r) => [r.pm, r.clase, r.vista && r.vista.manos, r.esperadas, r.fallo]));
ok('2. huesos ≤ 0,01 u y ≤ 0,1°, piel ≤ 0,05 cm contra Source, en todos los cuadros', conManos.every((r) => anims(r).length && mx(r, 'huesoErr') <= 0.01 && mx(r, 'huesoGrados') <= 0.1 && mx(r, 'verticeErrCm') <= 0.05),
  conManos.map((r) => [r.pm, r.clase, mx(r, 'huesoErr'), mx(r, 'huesoGrados'), mx(r, 'verticeErrCm'), mx(r, 'antesErrCm')]).filter((x) => x[2] > 0.01 || x[3] > 0.1 || x[4] > 0.05));
console.log('antes (3.2: el antepasado con la pose de enlace propia), cm de piel corrida como mucho:', Math.max(0, ...conManos.map((r) => mx(r, 'antesErrCm'))));
ok('3. la palma y la empuñadura como en Source (≤ 0,05 cm en cada cuadro)', conManos.every((r) => mx(r, 'difRefCm') <= 0.05), conManos.map((r) => [r.clase, mx(r, 'difRefCm'), mx(r, 'huecoMaxR'), mx(r, 'saltoMaxCmR')]));
const vp = res.find((r) => r.clase === 'carms_v_pistola');
ok('4. la v_ con brazos no lleva otras manos', vp && vp.vista && !vp.vista.manos, vp && vp.vista);
const propios = res.filter((r) => r.tinte && r.clase !== 'carms_v_pistola');
ok('5. personajes del juego: manos teñidas con sus colores', propios.every((r) => r.vista && r.vista.tinte && r.vista.tinte.mangas && r.vista.tinte.manos), propios.map((r) => [r.pm, r.vista && r.vista.tinte]));
ok('5b. sin errores de Lua', res.every((r) => !(r.errLua || []).length && !r.fallo), res.filter((r) => (r.errLua || []).length || r.fallo).map((r) => [r.pm, r.clase, r.errLua, r.fallo]));
const c = res.find((r) => r.costo); if (c) console.log('costo', JSON.stringify(c.costo));
console.log(R.every(Boolean) ? 'TODO BIEN ' + R.length + '/' + R.length : 'FALLAN ' + R.filter((x) => !x).length + '/' + R.length);
