// qué funciones de GMod que usan los addons todavía no están en el motor: lee el conteo estático (api_uso.py) y, en el
// juego, mira una por una si existe (bibliotecas y globales: en su tabla; métodos: en entidad, jugador, arma, NPC, física,
// Vector, Angle, Color, EffectData, DamageInfo, Material, ConVar, sonido, emisor...). Lista las que faltan, de la que
// usan más addons a la que menos.
// uso: node api_falta.mjs URL_HTML api_uso.json [SALIDA.json]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, USO, SAL = 'api_falta.json'] = process.argv;
const U = JSON.parse(fs.readFileSync(USO, 'utf8')).cuenta;
const { b, p, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
const r = await ev(`(() => {
  const U = ${JSON.stringify(U)}, R = gmaIniciar(), G = R.G, out = { lib: [], glob: [], met: [] };
  for (const [k, n] of Object.entries(U.lib)) { const [l, f] = k.split('.'), t = G.get(l); const v = t instanceof LuaTable ? t.h.get(f) : undefined; if (v === undefined) out.lib.push([k, n]); }
  for (const [k, n] of Object.entries(U.glob)) { if (G.h.get(k) === undefined && !/^[A-Z0-9_]+$/.test(k)) out.glob.push([k, n]); }
  // objetos de muestra, armados en Lua
  const f = R.cargar(\`local e = ents.Create("prop_physics") e:SetModel("models/props_c17/oildrum001.mdl") e:Spawn()
    local w = ents.Create("weapon_pistol") local n = ents.Create("npc_citizen")
    local em = ParticleEmitter(Vector()) local pa = em and em:Add("effects/spark", Vector()) local g = LocalPlayer():Give("weapon_pistol")
    local fr = vgui and vgui.Create and vgui.Create("DFrame") local bt = vgui and vgui.Create and vgui.Create("DButton", fr) local lb = vgui and vgui.Create and vgui.Create("DLabel", fr)
    weapons.Register({ Base = "weapon_base", Primary = {}, Secondary = {} }, "rb_api_swep") local sw = LocalPlayer():Give("rb_api_swep") or ents.Create("rb_api_swep")
    scripted_ents.Register({ Base = "base_anim", Type = "anim" }, "rb_api_sent") local se = ents.Create("rb_api_sent")
    return { sw, se, e, LocalPlayer(), w, n, e:GetPhysicsObject(), Vector(1,2,3), Angle(1,2,3), Color(1,2,3), EffectData(), DamageInfo(), Material("debug/debugwhite"), CreateConVar("rb_prueba_api", "1"), CreateSound(e, "common/null.wav"), em, Matrix(), pa, g, LocalPlayer():GetActiveWeapon(), fr, bt, lb }\`, 'api_falta');
  const objs = R.c(f, 'api_falta')[0], L = []; for (let i = 1; i <= 23; i++) L.push(objs.get(i));
  const idx = (o, m) => { try { return R.ix(o, m); } catch (e) { return undefined; } };
  // (los objetos que aceptan cualquier método, como los paneles de derma, no sirven para saber si uno existe)
  const perm = L.map((o) => o !== undefined && o !== null && idx(o, 'ZzzNoExiste') !== undefined); out.permisivos = perm.map((x, i) => (x ? i + 1 : 0)).filter(Boolean);
  for (let i = 0; i < L.length; i++) if (perm[i]) L[i] = undefined;
  for (const [m, n] of Object.entries(U.met)) {
    let hay = false;
    for (const o of L) { if (o === undefined || o === null) continue; const v = idx(o, m); if (v !== undefined && v !== null) { hay = true; break; } }
    if (!hay) out.met.push([m, n]);
  }
  for (const k of ['lib', 'glob', 'met']) out[k].sort((a, b) => b[1] - a[1]);
  return { ...out, nObjs: L.filter((x) => x !== undefined).length, tipos: L.map((o) => (o === undefined ? 'nil' : o && o.constructor ? o.constructor.name : typeof o)) };
})()`);
fs.writeFileSync(SAL, JSON.stringify(r, null, 1));
console.log('objetos', r.nObjs, r.tipos.join(','), 'permisivos', JSON.stringify(r.permisivos));
for (const k of ['lib', 'glob', 'met']) console.log(k, r[k].length, 'faltan; las más usadas:', r[k].slice(0, 40).map(([x, n]) => x + ' ' + n).join(' · '));
await b.close(); process.exit(0);
