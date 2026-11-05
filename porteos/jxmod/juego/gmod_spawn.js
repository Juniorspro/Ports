// ---------------- NPCs y vehículos de los addons (list.Set "NPC" y "Vehicles"), como en el menú de GMod ----------------
// Un addon de NPCs (list.Set("NPC", ...)) trae su clase, su modelo, su vida y sus armas; uno de autos (list.Set("Vehicles",
// ...)) trae el modelo y el script del vehículo (scripts/vehicles/*.txt: radio de las ruedas, masa, motor). Acá:
// - NPC con una clase del motor (npc_citizen, npc_metropolice, npc_combine_s, zombis...): es un NPC del juego (camina,
//   choca, se cae como muñeco, recibe tiros) con el modelo del addon puesto como en gmod_pm.js, y una actitud según la
//   clase (los combine y los zombis persiguen y pegan; los ciudadanos pasean). Con una clase propia del addon (nextbots,
//   entidades): se crea esa entidad con su Lua (ents.Create, Spawn, Activate).
// - Vehículo: el .mdl partido en carrocería y ruedas (cada vértice va con el hueso que más lo mueve: los Wheel_* son
//   ruedas), con las ruedas del juego (suspensión y agarre) donde el modelo tiene sus enganches wheel_fl/fr/rl/rr, el
//   asiento a la altura de vehicle_driver_eyes y la masa y el radio de las ruedas del script. Los vehículos de Source
//   miran a +Y en su modelo: se giran para que miren a +Z como los del juego.
const gmLista = (n, k) => { for (const A of GMOD.addons.values()) { const M = A.listas && A.listas[n]; if (M && M.has(k)) return M.get(k); } return null; };
const gmListaNombre = (n, k) => { const v = gmLista(n, k), s = v && v.get('Name'); return typeof s === 'string' && s.trim() ? s : k; };
const _lstr = (v, k) => { const x = v && v.get(k); return typeof x === 'string' ? x : ''; };
// el número de un "clave" "valor" del script del vehículo (el primero que aparece)
const _kv = (s, k) => { const m = new RegExp('"' + k + '"\\s+"([-0-9.]+)', 'i').exec(s); return m ? +m[1] : NaN; };
function gmvehPrefab(key) {
  const nombre = 'gmveh:' + key; if (DATA.pfPorNombre[nombre]) return nombre;
  const v = gmLista('Vehicles', key); if (!v) return null;
  const ruta = _lstr(v, 'Model').toLowerCase().replace(/\\/g, '/'); if (!ruta || !gmArchivo(ruta)) return null;
  const base = gmPrefab('gm:' + ruta); if (!base) return null;   // (choques y masa del .phy, como un prop)
  const raiz0 = DATA.pf[DATA.pfPorNombre[base]][0];
  let M; try { M = gmLeerModelo(ruta); } catch (e) { if (!e.pendiente) gmErr('vehículo ' + ruta, e); return null; }   // (pendiente: el menú lo pone cuando llega)
  const kv = v.get('KeyValues'), sc = kv instanceof LuaTable ? String(kv.get('vehiclescript') || '').toLowerCase().replace(/\\/g, '/') : '';
  const sb = sc && gmArchivo(sc), S = sb ? new TextDecoder('latin1').decode(sb) : '';
  // los huesos en reposo (en Source) y los enganches
  const H = M.huesos, Rw = [], Tw = [];
  H.forEach((h, i) => { const R = _q2m(h.q), t = h.pos; if (h.pa < 0) { Rw.push(R); Tw.push(t.slice()); } else { const Rp = Rw[h.pa], Tp = Tw[h.pa]; Rw.push(_m3mul(Rp, R)); Tw.push([0, 1, 2].map((c) => Tp[c] + Rp[c][0] * t[0] + Rp[c][1] * t[1] + Rp[c][2] * t[2])); } });
  const adj = (re) => { const a = M.adjuntos.find((x) => re.test(x.n)); if (!a) return null; const m = a.m, l = [m[3], m[7], m[11]]; if (a.hueso < 0) return l; const R = Rw[a.hueso], T = Tw[a.hueso]; return [0, 1, 2].map((c) => T[c] + R[c][0] * l[0] + R[c][1] * l[1] + R[c][2] * l[2]); };
  const pj = (p) => [p[1] * GM_S, p[2] * GM_S, p[0] * GM_S];   // (Source → ejes de los props del juego)
  // de qué rueda es cada hueso (los Wheel_* y lo que cuelga de ellos)
  const rueda = H.map(() => -1), ruedas = [];
  H.forEach((h, i) => { if (/wheel/i.test(h.n) && !/steer/i.test(h.n)) { rueda[i] = ruedas.length; ruedas.push({ h: i, n: h.n.toLowerCase().replace(/^.*wheel_?/, '') }); } else if (h.pa >= 0 && rueda[h.pa] >= 0) rueda[i] = rueda[h.pa]; });
  const V = M.v, n = V.n, Uc = gmUVcorr(M), piel = M.pieles[0] || [];
  const deVert = (k) => { let b = V.hb[k * 3], w = V.w[k * 3]; for (let c = 1; c < 3; c++) if (V.w[k * 3 + c] > w) { w = V.w[k * 3 + c]; b = V.hb[k * 3 + c]; } return rueda[b]; };
  const partes = [{ tris: new Map(), cen: [0, 0, 0] }, ...ruedas.map(() => ({ tris: new Map(), cen: null }))];
  for (const m of M.mallas) {
    if (m.modelo !== 0) continue;
    const ti = piel[m.mat] !== undefined ? piel[m.mat] : m.mat, mat = gmMaterial(M.texturas[ti] || M.texturas[m.mat] || 'error', M.carpetas), T = m.tris;
    for (let t = 0; t + 2 < T.length; t += 3) { const g = partes[1 + deVert(T[t])]; const L = g.tris.get(mat.mi) || []; g.tris.set(mat.mi, L); L.push(T[t], T[t + 2], T[t + 1]); if (mat.dos) L.push(T[t], T[t + 1], T[t + 2]); }
  }
  // el centro de cada rueda: su enganche wheel_xx (si no, el centro de su malla)
  ruedas.forEach((r, i) => {
    const a = adj(new RegExp('^wheel_?' + r.n + '$', 'i'));
    if (a) r.c = a; else { let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], hay = false; for (const L of partes[1 + i].tris.values()) for (const k of L) { hay = true; for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], V.pos[k * 3 + c]); mx[c] = Math.max(mx[c], V.pos[k * 3 + c]); } } r.c = hay ? mn.map((x, c) => (x + mx[c]) / 2) : Tw[r.h]; }
  });
  // una malla por parte (la de cada rueda con el centro de la rueda en su 0)
  const malla = (g, c, etiqueta) => {
    if (!g.tris.size) return null;
    const usados = new Map(), P = [], Nn = [], U = [], porMat = [];
    for (const [mi, L] of g.tris) { const I = []; for (const k of L) { let j = usados.get(k); if (j === undefined) { j = usados.size; usados.set(k, j); const p = pj([V.pos[k * 3] - c[0], V.pos[k * 3 + 1] - c[1], V.pos[k * 3 + 2] - c[2]]); P.push(...p); Nn.push(V.nor[k * 3 + 1], V.nor[k * 3 + 2], V.nor[k * 3]); U.push(V.uv[k * 2] - Uc[k * 2], 1 - (V.uv[k * 2 + 1] - Uc[k * 2 + 1])); } I.push(j); } porMat.push([mi, I]); }
    return { mi: gmMallaNueva('GMVEH_' + etiqueta, new Float32Array(P), new Float32Array(Nn), new Float32Array(U), porMat.map((x) => x[1]), true), mats: porMat.map((x) => x[0]) };
  };
  const masa = clamp(_kv(S, 'MassOverride') > 0 ? _kv(S, 'MassOverride') : raiz0.rb.m, 50, 50000);
  const radio = (_kv(S, 'Radius') > 0 ? _kv(S, 'Radius') : 15) * GM_S, nr = Math.max(1, ruedas.length), sd = 0.18;
  const sp = masa * 9.8 / nr / (sd * 0.5), da = 0.25 * 2 * Math.sqrt(sp * masa / nr) / 1.8;
  const cuerpo = malla(partes[0], [0, 0, 0], ruta); if (!cuerpo) return null;
  // (el choque: el casco de la carrocería; el .phy de muchos autos no coincide con su malla y el auto quedaba en el aire)
  const arb = [{ n: nombre, p: [0, 0, 0], r: [0, -Math.SQRT1_2, 0, Math.SQRT1_2], s: [1, 1, 1], pa: -1, col: [{ k: 'm', m: cuerpo.mi, cv: 2, tr: 0 }], rb: Object.assign({}, raiz0.rb, { m: masa }), mb: ['Vehicle', 'SCC_Drivetrain'], gm: ruta }];
  arb.push({ n: 'Carroceria', p: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], pa: 0, m: cuerpo.mi, mt: cuerpo.mats });
  ruedas.forEach((r, i) => {
    const g = malla(partes[1 + i], r.c, ruta + '#' + r.n);
    if (g) arb.push({ n: 'wheel_' + r.n, p: pj(r.c), r: [0, 0, 0, 1], s: [1, 1, 1], pa: 0, m: g.mi, mt: g.mats });
    arb.push({ n: 'WC_' + r.n, p: pj(r.c), r: [0, 0, 0, 1], s: [1, 1, 1], pa: 0, wc: { c: [0, 0, 0], r: radio, sd, sp, da } });
  });
  // (sin ruedas, como los botes, las lanchas y el airboat: cuatro apoyos que no se ven en las puntas de abajo del casco)
  if (!ruedas.length) {
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let k = 0; k < n; k++) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], V.pos[k * 3 + c]); mx[c] = Math.max(mx[c], V.pos[k * 3 + c]); }
    const r = Math.max(0.15, Math.min(0.5, (mx[2] - mn[2]) * GM_S * 0.15)), cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2, ax = (mx[0] - mn[0]) * 0.35, ay = (mx[1] - mn[1]) * 0.35;
    for (const [sx, sy, nn] of [[-1, 1, 'fl'], [1, 1, 'fr'], [-1, -1, 'rl'], [1, -1, 'rr']]) { const p = pj([cx + sx * ax, cy + sy * ay, mn[2] + r / GM_S]); arb.push({ n: 'WC_' + nn, p, r: [0, 0, 0, 1], s: [1, 1, 1], pa: 0, wc: { c: [0, 0, 0], r, sd, sp, da } }); }
  }
  const ojos = adj(/^vehicle_driver_eyes$/i);
  if (ojos) { const p = pj(ojos); p[1] -= 0.75; arb.push({ n: 'SitPoint', p, r: [0, 0, 0, 1], s: [1, 1, 1], pa: 0 }); }
  else { const d = DATA.ms[cuerpo.mi]; if (d && d.mn) arb.push({ n: 'SitPoint', p: [d.mn[0] + d.sc[0] / 2, d.mn[1] + d.sc[1] * 0.55, d.mn[2] + d.sc[2] / 2], r: [0, 0, 0, 1], s: [1, 1, 1], pa: 0 }); }   // (sin enganche del conductor: en el medio)
  const k = nombre + '#gm'; DATA.pf[k] = arb; DATA.pfPorNombre[nombre] = k;
  return nombre;
}
// ---------------- NPCs ----------------
const GM_NPC_HOSTIL = /combine|metropolice|police|zombi|zombie|antlion|headcrab|hunter|strider|manhack|scanner|poison|fastzombie|vortigaunt_hostile|gunship|soldier|elite|stalker/i;
// los modelos de las clases de HL2 cuando el addon no pone uno
const GM_NPC_MODELO = { npc_citizen: 'models/humans/group01/male_07.mdl', npc_metropolice: 'models/police.mdl', npc_combine_s: 'models/combine_soldier.mdl', npc_zombie: 'models/zombie/classic.mdl', npc_fastzombie: 'models/zombie/fast.mdl', npc_alyx: 'models/alyx.mdl', npc_barney: 'models/barney.mdl', npc_kleiner: 'models/kleiner.mdl', npc_breen: 'models/breen.mdl', npc_eli: 'models/eli.mdl', npc_gman: 'models/gman.mdl', npc_monk: 'models/monk.mdl', npc_mossman: 'models/mossman.mdl', npc_antlion: 'models/antlion.mdl', npc_headcrab: 'models/headcrabclassic.mdl', npc_vortigaunt: 'models/vortigaunt.mdl' };
function gmnpcCrear(key) {
  const v = gmLista('NPC', key); if (!v) return null;
  const cls = _lstr(v, 'Class') || key, mod = (_lstr(v, 'Model') || GM_NPC_MODELO[cls] || '').toLowerCase().replace(/\\/g, '/');
  // (donde apunta, como en GMod; si no hay nada cerca, 4 m adelante)
  const tr = gmaTraza(CAM.pos.clone(), CAM.fwd.clone(), 30, null), hp = tr.get('Hit') && tr.get('HitPos'), p = hp instanceof LVec ? vG(hp) : vadd(v3(JUG.pos.x, JUG.pos.y - (JUG.medio || 0.9), JUG.pos.z), vscale(v3(CAM.fwd.x, 0, CAM.fwd.z).norm(), 4)), yaw = JUG.yaw + Math.PI;
  // un NPC de VJ Base (o un SNPC que vive de la IA del motor de Source: horarios, tareas, caminos): esa IA acá no está y
  // quedaba duro y quieto; se pone como NPC del juego con lo que dice su Lua (modelo, vida, daño, amigo o enemigo)
  const sn = GMA.clases && GMA.clases.has(cls) && gmnpcSNPC(cls);
  if (sn) {
    if (sn.mod && !gmArchivo(sn.mod) && typeof gmlPedir === 'function') gmlPedir(sn.mod);
    const act = sn.hostil ? { modo: 'perseguir', vel: sn.vel, obj: 'cerca', dist: sn.dist, hostil: true, dano: sn.dano, vida: sn.vida } : { modo: 'pasear', vel: 1.6, vida: sn.vida };
    const P = npcCrear(sn.mod ? 'gmpm:' + sn.mod : 'Hero', v3(p.x, p.y, p.z), yaw, act); if (!P) return null;
    P.gmNpc = { key, cls, snpc: true }; return P;
  }
  // una clase del addon (nextbot, entidad con IA propia): esa entidad con su Lua
  if (GMA.clases && GMA.clases.has(cls)) {
    const f = GMA.R && GMA.R.G.get('__gmCrearNPC'); if (typeof f !== 'function') return null;
    const e = gmLlamar(f, 'S', cls, GMA.V(p), mod || undefined)[0]; if (e instanceof LEnt) { e.creador = GMA.jug; gmaHook('PlayerSpawnedNPC', 'S', GMA.jug, e); } return e || null;
  }
  // una clase del motor: un NPC del juego con el modelo del addon
  if (!mod || !gmArchivo(mod)) { if (mod && typeof gmlPedir === 'function') gmlPedir(mod); }
  const hostil = GM_NPC_HOSTIL.test(cls) || GM_NPC_HOSTIL.test(key), vida = +v.get('Health') > 0 ? +v.get('Health') : hostil ? 60 : 100;
  const act = hostil ? { modo: 'perseguir', vel: 3, obj: 'cerca', dist: 1.2, hostil: true, dano: 8, vida } : { modo: 'pasear', vel: 1.6, vida };
  const P = npcCrear(mod ? 'gmpm:' + mod : 'Hero', v3(p.x, p.y, p.z), yaw, act); if (!P) return null;
  P.gmNpc = { key, cls };
  return P;
}
// ¿la clase es un NPC de VJ Base o un SNPC del motor (base_ai)? lo que el NPC del juego necesita de su Lua: el modelo (VJ
// pone una lista: uno), la vida (StartHealth), el daño cuerpo a cuerpo y si es amigo (VJ_NPC_Class con
// CLASS_PLAYER_ALLY o Behavior pasivo) o enemigo
function gmnpcSNPC(cls) {
  let t = claseTabla(cls, 'S'); if (!t) return null;
  let base = '', n = 0;
  for (let u = t; u && n < 20; n++) { const b = u.get('Base'); if (typeof b !== 'string') break; base = b; if (/^npc_vj_(creature|human|tank)/.test(b) || b === 'base_ai') break; const x = claseTabla(b, 'S'); u = x; }
  const tipo = buscarEnClase(t, 'Type');
  if (!(/^npc_vj_(creature|human|tank)/.test(base) || base === 'base_ai' || tipo === 'ai')) return null;
  let mod = buscarEnClase(t, 'Model'); if (mod instanceof LuaTable) mod = mod.get(1 + Math.floor(Math.random() * Math.max(1, mod.a.length))) || mod.get(1);
  mod = typeof mod === 'string' ? mod.toLowerCase().replace(/\\/g, '/') : '';
  const num = (k, d) => { const v = +buscarEnClase(t, k); return Number.isFinite(v) && v > 0 ? v : d; };
  const clases = buscarEnClase(t, 'VJ_NPC_Class'), lista = clases instanceof LuaTable ? clases.a.map(String) : [];
  const beh = buscarEnClase(t, 'Behavior');   // (VJ_BEHAVIOR_AGGRESSIVE 1, NEUTRAL 2, PASSIVE 3, PASSIVE_NATURE 4)
  const amigo = lista.some((c) => /PLAYER_ALLY/i.test(c)) || beh === 3 || beh === 4 || buscarEnClase(t, 'PlayerFriendly') === true;
  const melee = buscarEnClase(t, 'HasMeleeAttack') !== false;
  return { mod, vida: Math.min(5000, num('StartHealth', 100)), dano: melee ? Math.min(200, num('MeleeAttackDamage', 10)) : 6, dist: 1.2, vel: 3, hostil: !amigo, base };   // (se para a pegar a 1,2 m: el MeleeAttackDistance de VJ es desde dónde arranca el golpe, hasta 500 unidades, y a esa distancia no llegaba nunca)
}
// cualquier modelo de personaje de un addon (los que se pueden usar de jugador) puesto como NPC: anda, pasea y reacciona
// como los NPC del juego, con ese modelo (el esqueleto de GMod llevado al del juego, como al ponérselo uno)
function gmnpcModelo(ruta) {
  if (!gmArchivo(ruta)) { if (typeof gmlPedir === 'function') gmlPedir(ruta); return null; }
  const tr = gmaTraza(CAM.pos.clone(), CAM.fwd.clone(), 30, null), hp = tr.get('Hit') && tr.get('HitPos'), p = hp instanceof LVec ? vG(hp) : vadd(v3(JUG.pos.x, JUG.pos.y - (JUG.medio || 0.9), JUG.pos.z), vscale(v3(CAM.fwd.x, 0, CAM.fwd.z).norm(), 4)), yaw = JUG.yaw + Math.PI;
  const P = npcCrear('gmpm:' + ruta, v3(p.x, p.y, p.z), yaw, { modo: 'pasear', vel: 1.6, vida: 100 }); if (!P) return null;
  P.gmNpc = { key: ruta, cls: 'npc_citizen' };
  return P;
}
// un muñeco de trapo con el modelo de un personaje (como un prop_ragdoll de GMod): adelante, cae con sus huesos, se lo
// agarra y se lo lleva con la Physics Gun o la Gravity Gun, los golpes lo empujan y no se levanta nunca. Se quita con el
// tacho (como los NPC). Sirve para los modelos de jugador de los addons y para los props con esqueleto humano
function gmragModelo(ruta) {
  if (!gmArchivo(ruta)) { if (typeof gmlPedir === 'function') gmlPedir(ruta); return null; }
  const tr = gmaTraza(CAM.pos.clone(), CAM.fwd.clone(), 30, null), hp = tr.get('Hit') && tr.get('HitPos'), p = hp instanceof LVec ? vG(hp) : vadd(v3(JUG.pos.x, JUG.pos.y - (JUG.medio || 0.9), JUG.pos.z), vscale(v3(CAM.fwd.x, 0, CAM.fwd.z).norm(), 2.5));
  const yaw = Math.atan2(JUG.pos.x - p.x, JUG.pos.z - p.z);
  const P = npcCrear('gmpm:' + ruta, v3(p.x, p.y + 0.15, p.z), yaw, { modo: 'quieto', vida: 100 }); if (!P) return null;
  P.muneco = true; P.gmNpc = { key: ruta, cls: 'prop_ragdoll' };
  if (typeof npcTumbar === 'function') npcTumbar(P, v3(0, 0, 0)); else ragdoll(P, null, P.pos);
  if (P.ia) P.ia.ragT = 1e9;
  return P;
}
// ¿un modelo con esqueleto humano de Valve y física de muñeco (varias piezas en el .phy)? → se pone como muñeco
function gmEsMuneco(ruta) {
  if (!gmArchivo(ruta)) return false;
  const phy = gmArchivo(ruta.replace(/\.mdl$/i, '.phy'));
  let piezas = 0; try { if (phy && phy.byteLength >= 12) piezas = new DataView(phy.buffer, phy.byteOffset, phy.byteLength).getInt32(8, true); } catch (e) {}
  if (piezas < 2) return false;
  const d = typeof gmpDef === 'function' ? gmpDef(ruta) : null; return !!(d && d.porMix && d.porMix.Hips !== undefined);
}
if (typeof module !== 'undefined') module.exports = { gmvehPrefab, gmnpcCrear, gmnpcModelo, gmragModelo, gmEsMuneco, gmLista };
