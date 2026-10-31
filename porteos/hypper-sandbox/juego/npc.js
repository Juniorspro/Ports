// ---------------- NPC: gente del juego con su actitud (Tool Gun → Actitud; la IA gratis la arma de lo que escribís) ----------------
// Cada NPC es un personaje como los jugadores: camina y choca como vos (la misma cápsula contra el mapa, los props y la
// gente), anima sus pasos, salta lo bajo, rodea lo que no puede saltar y no se tira por un barranco. Su actitud dice qué
// hace: quieto, pasear, seguir, perseguir (y, si es hostil, patea), huir, bailar, guardia (cuida su lugar) o mirar; a quién
// (el jugador más cerca, el que le dio la actitud u otro NPC), a qué velocidad, cuánto pega, qué dice y su vida.
// Escribís cómo querés que actúe ("agresivo que nos persiga corriendo") y al instante lo entiende un lector local
// (palabras clave en varios idiomas); después la IA gratis (tus claves, los modelos libres sin clave o Pollinations) lo
// afina. Los tiros lo lastiman; un golpe fuerte, una patada o la Gravity Gun lo tiran al piso como muñeco de trapo y se
// levanta; muerto queda tirado un rato. La Physics Gun lo levanta (patalea) y lo lanza. En la sala los NPC los mueve su
// dueño y los demás los ven (y les pegan: el golpe le llega al dueño).
const NPC = { lista: [], sig: 1, rem: new Map(), redT: 0, skin: null, act: null, panel: null, max: 24 };
const NPC_MODOS = ['quieto', 'pasear', 'seguir', 'perseguir', 'huir', 'bailar', 'guardia', 'mirar'];
const NPC_OBJ = ['cerca', 'yo', 'npc'];
const NPC_BAILES = ['ChickenDance', 'Techno', 'Twerk', 'Flair', 'Victory', 'Clap', 'Hi', 'Backflip', 'AirSquat', 'rb:Gangnam', 'rb:YMCA', 'rb:HipHop', 'rb:Shuffle', 'rb:Breakdance', 'rb:Boxeo', 'rb:Momia', 'rb:GritoZombi', 'rb:Corazon', 'rb:SaludoGrande', 'rb:Giro360'];
const npcActBase = () => ({ modo: 'pasear', vel: 2, obj: 'cerca', dist: 3, hostil: false, dano: 10, emote: '', decir: [], salta: false, vida: 100, nombre: '', de: '' });
// ---------------- la actitud: revisar lo que venga (de la IA o de la red) ----------------
function npcActNormal(a, base) {
  const o = Object.assign(npcActBase(), base || {}); if (!a || typeof a !== 'object') return o;
  if (NPC_MODOS.includes(a.modo)) o.modo = a.modo;
  if (NPC_OBJ.includes(a.obj)) o.obj = a.obj;
  const n = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : typeof v === 'string' && v.trim() !== '' && isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);
  o.vel = n(a.vel, 0.5, 9, o.vel); o.dist = n(a.dist, 0.8, 40, o.dist); o.dano = n(a.dano, 0, 60, o.dano); o.vida = Math.round(n(a.vida, 1, 2000, o.vida));
  if (typeof a.hostil === 'boolean') o.hostil = a.hostil; if (typeof a.salta === 'boolean') o.salta = a.salta;
  if (typeof a.emote === 'string') o.emote = NPC_BAILES.includes(a.emote) || (typeof emoValido === 'function' && emoValido(a.emote) && a.emote !== 'Patada') ? a.emote : '';
  if (Array.isArray(a.decir)) o.decir = a.decir.filter((x) => typeof x === 'string').map((x) => limpio(x, 80)).filter(Boolean).slice(0, 4);
  else if (typeof a.decir === 'string' && a.decir.trim()) o.decir = [limpio(a.decir, 80)];
  if (typeof a.nombre === 'string') o.nombre = limpio(a.nombre, 24);
  if (typeof a.de === 'string') o.de = a.de.slice(0, 40);
  if (o.modo === 'perseguir' && o.dist > 3) o.dist = 1.2;
  return o;
}
// ---------------- lector local (al instante, sin internet): palabras clave en español, inglés, portugués y otros ----------------
function npcActDeTexto(t, base) {
  const s = ' ' + String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + ' ', a = {}, hay = (re) => re.test(s);
  if (hay(/bail|danc|danz|perrea|twerk|fiesta|party/)) { a.modo = 'bailar'; for (const [re, e] of [[/twerk|perrea/, 'Twerk'], [/techno|electr/, 'Techno'], [/gangnam/, 'rb:Gangnam'], [/ymca/, 'rb:YMCA'], [/hip ?hop|rap/, 'rb:HipHop'], [/shuffle/, 'rb:Shuffle'], [/break/, 'rb:Breakdance'], [/pollo|chicken/, 'ChickenDance']]) if (re.test(s)) { a.emote = e; break; } if (!a.emote) a.emote = 'ChickenDance'; }
  if (hay(/hu[iy]|escap|miedo|asust|cobard|teme|flee|scared|afraid|coward|run away|fog|medo|kabur|takut|逃|怖/)) { a.modo = 'huir'; a.dist = 12; a.vel = 5.5; a.hostil = false; }
  if (hay(/sig[auo]|siguen|acompa|escolt|guardaespald|follow|bodyguard|escort|segu[ie]|ikut|追従|ついて/)) { a.modo = 'seguir'; a.dist = 3; }
  if (hay(/persig|caza|chase|hunt|atrap|catch|persegu|kejar|追いかけ/)) { a.modo = 'perseguir'; a.dist = 1.2; }
  if (hay(/agresiv|ataq|atac|pega|golpe|mata|asesin|enoj|furios|hostil|malo|violent|attack|aggress|kill|angry|hostile|mean|fight|pelea|luta|bata|serang|marah|攻撃|怒/)) { a.hostil = true; a.dano = 12; if (!a.modo || a.modo === 'seguir') a.modo = 'perseguir'; a.dist = 1.2; }
  if (hay(/guard|vigil|proteg|cuid|patrull|defiend|protect|patrol|defend|jaga/)) { a.modo = 'guardia'; a.dist = 7; }
  if (hay(/pase|deambul|vag[ae]|explor|wander|roam|walk around|passe|jalan|散歩/) && !a.modo) a.modo = 'pasear';
  if (hay(/ mira|observ|watch|stare|look at|olha|lihat|見/) && !a.modo) a.modo = 'mirar';
  if (hay(/quiet|parad|para |stop|stay|espera|idle|wait|fica|diam|止ま/) && !a.modo) a.modo = 'quieto';
  if (hay(/amig|amable|buen|pacif|tranqui|friend|nice|kind|peace|gentle|ramah|baik/)) { a.hostil = false; if (!a.modo) a.modo = 'seguir'; }
  if (hay(/corr|rapid|veloz|run|fast|sprint|quick|lari|cepat|走/)) a.vel = hay(/muy rapid|super|sprint|velocisim|very fast/) ? 7.5 : 5.5;
  if (hay(/camin|lent|despacio|walk|slow|calm|anda|pelan/) && !hay(/corr|run|rapid/)) a.vel = 2;
  if (hay(/salt|brinc|jump|hop|pula|lompat|跳/)) a.salta = true;
  if (hay(/ npc|otros npc|other npc|entre ellos|each other|monstruo|zombi/) && (a.modo === 'perseguir' || a.hostil)) a.obj = 'npc';
  if (hay(/ me |a mi|a mí|conmigo| me$|follow me|me sig|sigueme/)) a.obj = 'yo';
  if (hay(/fuerte|mucho dano|brutal|strong|hard|letal|deadly/)) a.dano = 30;
  if (hay(/debil|suave|weak|soft|poco dano/)) a.dano = 5;
  if (hay(/inmortal|invencible|immortal|tanque|tank/)) a.vida = 2000;
  const q = /["“«]([^"”»]{1,80})["”»]/.exec(String(t || '')); if (q) a.decir = [q[1]];
  return npcActNormal(a, base);
}
// ---------------- la IA gratis: tus claves, los modelos libres sin clave (los más rápidos primero) o Pollinations ----------------
const NPC_SIS = 'You set the behavior of an NPC (a person) in a 3D physics sandbox game like Garry\'s Mod. The player describes, in any language, how the NPC must act. Reply ONLY with JSON: ' +
  '{"modo":"quieto|pasear|seguir|perseguir|huir|bailar|guardia|mirar","vel":m/s (walk 2, jog 4, run 5.5, sprint 7.5),"obj":"cerca|yo|npc","dist":meters,"hostil":true|false,"dano":0-50 (damage per kick),"emote":"","decir":["up to 3 short lines the NPC says, max 60 characters, in the player\'s language"],"salta":true|false,"vida":10-1000,"nombre":"short name or empty"}\n' +
  'modo: quieto = stands still; pasear = wanders around; seguir = follows the target and keeps dist; perseguir = chases the target (if hostil it attacks with kicks); huir = runs away when the target is closer than dist; bailar = dances in place (emote); guardia = guards its spot: chases whoever comes closer than dist, then goes back; mirar = stands and stares at the target.\n' +
  'obj: cerca = the nearest player; yo = the player who wrote this ("me", "us", "conmigo"); npc = the nearest other NPC (to fight or follow NPCs).\n' +
  'emote (only for bailar or a gesture): one of ' + NPC_BAILES.join(', ') + '.\n' +
  'Family friendly lines (no slurs, nothing sexual). Examples: "agresivo que nos persiga corriendo" -> {"modo":"perseguir","vel":5.5,"obj":"cerca","dist":1.2,"hostil":true,"dano":12,"emote":"","decir":["¡Te voy a atrapar!","¡No escapás!"],"salta":false,"vida":100,"nombre":""} ' +
  '"a shy guy who follows me and dances" -> {"modo":"seguir","vel":4,"obj":"yo","dist":3,"hostil":false,"dano":0,"emote":"rb:Shuffle","decir":["Hi... can I come with you?"],"salta":false,"vida":100,"nombre":""}';
const iaJSONDe = (t) => { if (typeof t !== 'string') return null; const i = t.indexOf('{'), j = t.lastIndexOf('}'); if (i < 0 || j <= i) return null; try { const o = JSON.parse(t.slice(i, j + 1)); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } };
// pide JSON a la primera IA que conteste (devuelve { o, ia } o null). Usa los mismos descansos que Verity: un modelo que
// dice que no descansa un rato
async function iaJSON(sis, txt, ms) {
  const msgs = [{ role: 'system', content: sis }, { role: 'user', content: txt }], rev = (t) => iaJSONDe(t);
  // tu clave de Google AI Studio
  if (typeof verGemPropia === 'function' && verGemPropia()) for (const m of VERITY_GEMINI) { try { const r = await verGemPedir(m, verityAGemini(msgs, 600, 'low'), ms); const o = r && rev(r.texto); if (o) return { o, ia: 'tu-google' }; } catch (e) {} }
  // tus claves y los libres: los modelos que contestan rápido (sin pensar en voz alta) primero
  const rapido = (m) => (/llama|mistral|nemo|qwen|minimax/i.test(m) ? 0 : 1);
  const lista = [].concat(typeof verPropiasLista === 'function' ? verPropiasLista() : [], VERITY_LIBRES.map((P) => Object.assign({ n: P.id }, P)));
  for (const P of lista) for (const m of P.m.slice().sort((a, b) => rapido(a) - rapido(b))) {
    const k = P.id + '|' + m; if ((VER_DESCANSO.get(k) || 0) > Date.now() || (VER_DESCANSO.get(P.id) || 0) > Date.now()) continue;
    try {
      const r = await fetch(P.u, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, P.clave ? { Authorization: 'Bearer ' + P.clave } : {}),
        body: JSON.stringify({ model: m, messages: msgs, max_tokens: /gpt-oss/.test(m) ? 1500 : 500, temperature: 0.3, ...(/gpt-oss/.test(m) ? { reasoning_effort: 'low' } : {}) }), signal: verTiempo(ms) });
      if (r.status === 401 || r.status === 402 || r.status === 403) { VER_DESCANSO.set(P.id, Date.now() + 3600e3); break; }
      if (!r.ok) { VER_DESCANSO.set(k, Date.now() + Math.min(3600, +r.headers.get('Retry-After') || (r.status === 429 ? 65 : 30)) * 1000); continue; }
      const o = rev(verityTextoAbierto(await r.json())); if (o) return { o, ia: P.id + ' · ' + m };
    } catch (e) { VER_DESCANSO.set(k, Date.now() + 20e3); }
  }
  // el público (uno cada 30 s por conexión)
  try { const o = rev(await verPublicoTexto(msgs, ms * 2)); if (o) return { o, ia: 'pollinations' }; } catch (e) {}
  return null;
}
// ---------------- crear y borrar ----------------
function npcCuerpo(P) {
  const b = new Body(capsuleShape(0.4, 0.5), 80); b.frozen = true; b.persona = P; b.noJug = false; b.noGrab = false; b.npc = P; addBody(b); return b;
}
function npcCrear(skin, p, yaw, act) {
  if (NPC.lista.length >= NPC.max) { aviso(T('npc.max') + ' (' + NPC.max + ')', 2); return null; }
  if (!DATA.chars.includes(skin)) skin = 'Hero';
  const P = crearPersona(skin, 'HatEmpty', { nombre: '' });
  P.npc = true; P.npcId = NPC.sig++; P.act = npcActNormal(act || NPC.act || {}); P.vida = P.act.vida; P.vivo = true;
  P.pos.set(p.x, p.y + 0.96, p.z); P.yaw = yaw || 0; P.vel.set(0, 0, 0); P.suelo = false;
  P.ia = { casa: v3(p.x, p.y + 0.96, p.z), meta: null, metaT: 0, golpeT: 0, golpe: null, decirT: 3 + Math.random() * 5, ragT: 0, salto: 0, trabado: 0, desvio: 0, desvioT: 0, saltoT: 0, vy: 0 };
  P.npcB = npcCuerpo(P); NPC.lista.push(P);
  return P;
}
// uno marcado como NPC sin cerebro (de un mod o de una prueba): se le da uno (quieto) y su cápsula
function npcAdoptar(P) {
  if (P.ia) return;
  P.act = P.act || npcActNormal({ modo: 'quieto' }); P.npcId = P.npcId || NPC.sig++;
  P.ia = { casa: P.pos.clone(), meta: null, metaT: 0, golpeT: 0, golpe: null, decirT: 5, ragT: 0, salto: 0, trabado: 0, desvio: 0, desvioT: 0, saltoT: 0, vy: 0 };
  if (!P.npcB) P.npcB = npcCuerpo(P); if (!NPC.lista.includes(P)) NPC.lista.push(P);
}
function npcQuitar(P) {
  const i = NPC.lista.indexOf(P); if (i >= 0) NPC.lista.splice(i, 1);
  if (P.npcB) removeBody(P.npcB); P.npcB = null; if (P.globo) { P.globo.remove(); P.globo = null; }
  if (PERS.includes(P)) borrarPersona(P);
  if (RED.on && P.npc) publicar('a', { k: 'npcfin', n: P.npcId });
}
function npcTodos() { for (const P of NPC.lista.slice()) npcQuitar(P); }
// ---------------- la gente a la que puede mirar, seguir o perseguir ----------------
function npcGente() {
  const L = [];
  if (JUEGO.estado === 'juego' && JUG.vivo && JUG.cuerpo && !JUG.cuerpo.rag) L.push({ P: JUG.cuerpo, id: RED.ID || 'yo', pos: JUG.pos });
  for (const R2 of RED.remotos.values()) if (R2.P && !R2.P.rag && R2.P.visible !== false) L.push({ P: R2.P, id: R2.id, pos: R2.P.pos });
  return L;
}
function npcObjetivo(P) {
  const a = P.act; let mejor = null, dm = 1e9;
  if (a.obj === 'npc') {
    for (const Q of PERS) { if (Q === P || !(Q.npc || Q.npcRem) || Q.rag || Q.vivo === false) continue; const d = Q.pos.distTo(P.pos); if (d < dm) { dm = d; mejor = { P: Q, pos: Q.pos }; } }
    return mejor;
  }
  const G = npcGente();
  if (a.obj === 'yo' && a.de) { const x = G.find((g) => g.id === a.de); if (x) return x; }
  for (const g of G) { const d = g.pos.distTo(P.pos); if (d < dm) { dm = d; mejor = g; } }
  return mejor;
}
// ---------------- moverse: la cápsula del jugador (la misma función, con los datos del NPC) ----------------
const NPC_ESF = [[-0.5, true], [0, false], [0.5, false]];
function npcMover(P, dt) {
  const J = JUG, s = { pos: J.pos, vel: J.vel, suelo: J.suelo, sueloN: J.sueloN, sobre: J.sobre, pisa: J.pisa, esf: J.esf, vc: J.vehiculoCuerpo };
  const sN = P.ia.sueloN || (P.ia.sueloN = v3(0, 1, 0));
  J.pos = P.pos; J.vel = P.vel; J.sueloN = sN; J.esf = NPC_ESF; J.vehiculoCuerpo = P.npcB;
  try { jugadorMoverChocar(dt); P.suelo = J.suelo; P.ia.pisa = J.pisa; }
  finally { J.pos = s.pos; J.vel = s.vel; J.suelo = s.suelo; J.sueloN = s.sueloN; J.sobre = s.sobre; J.pisa = s.pisa; J.esf = s.esf; J.vehiculoCuerpo = s.vc; }
}
// ¿se puede ir por ahí? (rodilla libre o algo bajo que se salta; sin barranco de más de 4 m)
function npcLibre(P, dir, largo) {
  const ig = P.npcB, rod = v3(P.pos.x, P.pos.y - 0.6, P.pos.z), h = raycast(rod, dir, largo, ig);
  if (h && h.n.y < 0.6) {
    const cab = raycast(v3(P.pos.x, P.pos.y + 0.55, P.pos.z), dir, largo, ig);
    if (!cab && P.suelo) { const alto = raycast(vadd(vadd(rod, vscale(dir, Math.min(largo, h.t + 0.3))), v3(0, 1.25, 0)), v3(0, -1, 0), 1.3, ig); if (alto && alto.n.y > 0.6 && 1.25 - alto.t < 1.05) return 'saltar'; }
    return false;
  }
  const adel = vadd(P.pos, vscale(dir, largo)), piso = pisoBajo(adel, 0.5);
  if (piso === null || P.pos.y - 0.95 - piso > 4) return false;
  return true;
}
// ---------------- cada cuadro ----------------
const _npcF = v3();
function npcPaso(dt) {
  if (!NPC.lista.length && !NPC.rem.size) return;
  for (const P of NPC.lista.slice()) {
    if (!PERS.includes(P)) { npcQuitar(P); continue; }   // (se borró: cambio de mapa, muerto hace rato, la bomba...)
    if (P.pos.y < MUNDO.lo.y - 60) { npcQuitar(P); continue; }
    npcCerebro(P, dt);
  }
  npcRemotosPaso(dt);
  if (RED.on && NPC.lista.length && (NPC.redT -= dt) <= 0) { NPC.redT = 0.15; npcRedMandar(); }
}
function npcCerebro(P, dt) {
  const I = P.ia, a = P.act, b = P.npcB;
  if (P.escena) { if (b) { const hi = P.D.h.Hips, W = hi !== undefined && P.md.W[hi]; if (W) b.pos.set(W[12], P.pos.y, W[14]); b.noJug = true; b.updateWorld(); } npcGloboPaso(P); return; }   // (la cápsula con el cuerpo, sin empujar)   // (haciendo un emote de a dos: lo mueve juntos.js)
  // muerto: tirado (personas.js lo borra a los 8 s); tirado vivo: se levanta solo
  if (P.vivo === false || P.rag) {
    if (b) { b.noRay = b.noPhys = b.noJug = true; }
    if (P.rag && P.vivo !== false && (I.ragT -= dt) <= 0) npcLevantar(P);
    npcGloboPaso(P); return;
  }
  // levantado con la Physics Gun o la Gravity Gun: lo lleva la cápsula, patalea
  if (b && b.held) { P.pos.copy(b.pos); P.vel.copy(b.vel); P.suelo = false; I.llevado = true; P.emote = null; npcGloboPaso(P); return; }
  if (I.llevado) { I.llevado = false; P.vel.copy(b.vel); b.frozen = true; b.vel.set(0, 0, 0); b.ang.set(0, 0, 0); b.q.set(0, 0, 0, 1); if (P.vel.len() > 9) { npcTumbar(P, P.vel.clone(), 0); return; } }
  if (b) { b.noRay = b.noPhys = false; b.noJug = !!(P.jntFin && TIEMPO.t < P.jntFin); }
  const obj = npcObjetivo(P), d = obj ? Math.hypot(obj.pos.x - P.pos.x, obj.pos.z - P.pos.z) : 1e9, hacia = obj ? v3(obj.pos.x - P.pos.x, 0, obj.pos.z - P.pos.z).norm() : null;
  let quiere = null, vel = a.vel, mirar = null;
  I.metaT -= dt; I.golpeT -= dt; I.saltoT -= dt;
  const pasear = (radio, centro) => {
    if (!I.meta || I.metaT <= 0 || Math.hypot(I.meta.x - P.pos.x, I.meta.z - P.pos.z) < 0.8) {
      I.metaT = 4 + Math.random() * 5; const c = centro || P.pos, ang = Math.random() * TAU, r = radio * (0.3 + Math.random() * 0.7);
      I.meta = v3(c.x + Math.sin(ang) * r, c.y, c.z + Math.cos(ang) * r); I.pausa = Math.random() < 0.35 ? 1 + Math.random() * 2 : 0;
    }
    if (I.pausa > 0) { I.pausa -= dt; return null; }
    return v3(I.meta.x - P.pos.x, 0, I.meta.z - P.pos.z).norm();
  };
  switch (a.modo) {
    case 'quieto': if (obj && d < 6) mirar = hacia; break;
    case 'mirar': if (obj) mirar = hacia; break;
    case 'pasear': quiere = pasear(10); vel = Math.min(a.vel, 3); break;
    case 'seguir':
      if (obj && d > a.dist + 0.6) { quiere = hacia; vel = d > a.dist + 8 ? Math.max(a.vel, 5.5) : a.vel; } else if (obj) mirar = hacia;
      break;
    case 'perseguir':
      if (obj && d > Math.max(0.9, a.dist)) quiere = hacia; else if (obj) mirar = hacia;
      if (!obj) { quiere = pasear(10); vel = 2; }
      break;
    case 'huir':
      if (obj && d < a.dist) { const lejos = vscale(hacia, -1); quiere = lejos; } else { quiere = pasear(6); vel = 2; }
      break;
    case 'bailar':
      if (obj && d < 8) mirar = hacia;
      if (!P.emote || P.emote === 'Patada') { const e = a.emote || 'ChickenDance'; if (emoValido(e)) { P.emote = e; P.emoteT = 0; } }
      break;
    case 'guardia': {
      const enCasa = Math.hypot(I.casa.x - P.pos.x, I.casa.z - P.pos.z), cercaCasa = obj && Math.hypot(obj.pos.x - I.casa.x, obj.pos.z - I.casa.z) < a.dist;
      if (cercaCasa) { if (a.hostil && d > 1.1) quiere = hacia; else mirar = hacia; vel = Math.max(a.vel, 4); }
      else if (enCasa > 1) { quiere = v3(I.casa.x - P.pos.x, 0, I.casa.z - P.pos.z).norm(); vel = Math.min(a.vel, 3.5); }
      else if (obj && d < a.dist + 6) mirar = hacia;
      break;
    }
  }
  // pegar: una patada cuando lo tiene al lado (si es hostil y no está bailando)
  if (a.hostil && obj && a.modo !== 'bailar' && a.modo !== 'huir' && d < 1.45 * (P.tam || 1) + 0.2 && I.golpeT <= 0 && Math.abs(obj.pos.y - P.pos.y) < 1.6) {
    I.golpeT = 1.05; I.golpe = { t: 0.2, obj }; I.patT = 0.64; P.emote = 'Patada'; P.emoteT = 0; mirar = hacia; quiere = null; sonar('CB_Swing', P.pos, 0.5, 0.85 + Math.random() * 0.1);
  }
  if (I.golpe && (I.golpe.t -= dt) <= 0) { const g = I.golpe; I.golpe = null; npcPegar(P, g.obj); }
  if (I.patT > 0 && (I.patT -= dt) <= 0 && P.emote === 'Patada') P.emote = null;   // (fuera de la vista no se anima: la patada se termina igual)
  const pateando = I.patT > 0;
  // esquivar: probar la dirección, si no, de a 35° para cada lado; si es bajo, saltarlo
  if (quiere && !pateando) {
    if (I.desvioT > 0) { I.desvioT -= dt; quiere = rotY(quiere, I.desvio); }
    let ok = npcLibre(P, quiere, 1.0);
    if (ok === 'saltar') { if (P.suelo && I.saltoT <= 0) { I.saltoT = 0.7; P.vel.y = Math.sqrt(2 * GRAV * MUNDO.gravedad * 1.1); P.suelo = false; } }
    else if (!ok) {
      let alt = null; for (const g of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) { const q = rotY(quiere, g); if (npcLibre(P, q, 1.0) === true) { alt = q; I.desvio = g; I.desvioT = 0.6; break; } }
      if (alt) quiere = alt; else { quiere = null; I.meta = null; I.metaT = 0; }
    }
    if (quiere && P.emote && P.emote !== 'Patada') P.emote = null;   // (caminando no sigue el baile)
  }
  // trabado (empujando una pared invisible o un prop): salta y se corre para un costado
  const vh = Math.hypot(P.vel.x, P.vel.z);
  if (quiere && vh < 0.35 * Math.min(vel, 2)) { I.trabado += dt; if (I.trabado > 1.2) { I.trabado = 0; I.desvio = Math.random() < 0.5 ? 1.4 : -1.4; I.desvioT = 1; if (P.suelo) P.vel.y = Math.sqrt(2 * GRAV * MUNDO.gravedad * 1.1); } } else I.trabado = 0;
  // saltitos de alegría (si se lo pidieron)
  if (a.salta && P.suelo && I.saltoT <= 0 && Math.random() < dt * 0.5) { I.saltoT = 1.2; P.vel.y = Math.sqrt(2 * GRAV * MUNDO.gravedad * 1.0); P.suelo = false; }
  // la velocidad: como el jugador (acelera en el piso, poco en el aire), y la gravedad
  const vmax = pateando ? 0 : quiere ? vel : 0, acel = P.suelo ? 16 : 5;
  const tx = quiere ? quiere.x * vmax : 0, tz = quiere ? quiere.z * vmax : 0, dvx = tx - P.vel.x, dvz = tz - P.vel.z, dl = Math.hypot(dvx, dvz);
  if (dl > 0) { const k = Math.min(1, acel * dt / dl); P.vel.x += dvx * k; P.vel.z += dvz * k; }
  const g = GRAV * MUNDO.gravedad; if (!P.suelo) P.vel.y -= g * dt; else if (P.vel.y < 0) P.vel.y = -0.5;
  const vyAntes = P.vel.y, eraSuelo = P.suelo;
  npcMover(P, dt);
  if (!P.suelo && eraSuelo && P.vel.y <= 0) { const h = mundoRayo(v3(P.pos.x, P.pos.y - 0.5, P.pos.z), v3(0, -1, 0), 0.8); if (h && h.n.y > 0.6) { P.pos.y -= h.t - 0.45; P.suelo = true; P.vel.y = -0.5; } }
  if (!eraSuelo && P.suelo && vyAntes < -15) { npcTumbar(P, v3(P.vel.x, 2, P.vel.z), 0); return; }   // (cayó de muy alto: queda tirado)
  // hacia dónde mira: adonde camina, o al que mira
  const f = vh > 0.6 && quiere ? quiere : mirar;
  if (f) { const yw = Math.atan2(f.x, f.z); let dy = yw - P.yaw; dy = ((dy + Math.PI) % TAU + TAU) % TAU - Math.PI; P.yaw += dy * Math.min(1, dt * 8); }
  if (b) { b.pos.set(P.pos.x, P.pos.y, P.pos.z); b.q.set(0, 0, 0, 1); b.vel.set(0, 0, 0); b.updateWorld(); }
  // habla: cada tanto, si hay alguien cerca
  if (a.decir.length && (I.decirT -= dt) <= 0) { I.decirT = 7 + Math.random() * 7; if (obj && d < 16) npcDecir(P, a.decir[(Math.random() * a.decir.length) | 0], true); }
  npcGloboPaso(P);
}
const rotY = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return v3(v.x * c + v.z * s, 0, -v.x * s + v.z * c); };
function npcPegar(P, obj) {
  if (!obj || !P.vivo || P.rag) return; const Q = obj.P, d = Math.hypot(obj.pos.x - P.pos.x, obj.pos.z - P.pos.z); if (d > 1.9 * (P.tam || 1) + 0.3) return;
  const dir = v3(obj.pos.x - P.pos.x, 0.25, obj.pos.z - P.pos.z).norm(), dan = P.act.dano;
  if (Q === JUG.cuerpo) { danarJugador(dan, P.pos); JUG.vel.addS(dir, 5); JUG.vel.y += 2; sonar('Melee1', JUG.pos, 0.6); }
  else { danarPersona(Q, dan, Q.pos.clone(), dir); if (Q.npc && Q.vivo !== false && !Q.rag) { Q.vel.addS(dir, 4); Q.vel.y += 1.5; } sonar('Melee1', Q.pos, 0.6); }
}
// ---------------- al piso (muñeco de trapo) y levantarse ----------------
function npcTumbar(P, imp, dan) {
  if (!P || P.rag || (!P.npc && !P.npcRem)) return;
  if (P.npcRem) { npcGolpeRed(P, dan || 0, imp, true); return; }
  npcAdoptar(P);
  P.emote = null; P.vel.copy(imp || v3()); ragdoll(P, imp ? vscale(imp, 0.6) : null, P.pos); P.ia.ragT = 2.6 + Math.random();
  if (P.npcB) { P.npcB.noRay = P.npcB.noPhys = P.npcB.noJug = true; }
}
function npcLevantar(P) {
  const h = P.rag && P.rag.cuerpos.get(P.D.h.Hips), c = h ? h.b.pos.clone() : P.pos.clone();
  ragdollFin(P);
  const piso = pisoBajo(c, 1); P.pos.set(c.x, (piso !== null ? piso : c.y - 0.3) + 0.96, c.z); P.vel.set(0, 0, 0); P.suelo = true;
  if (P.npcB) { P.npcB.noRay = P.npcB.noPhys = P.npcB.noJug = false; P.npcB.pos.copy(P.pos); P.npcB.updateWorld(); }
}
// ---------------- lo que dice: un globito arriba de la cabeza ----------------
function npcDecir(P, t, red) {
  if (!t) return;
  if (!P.globo) { P.globo = document.createElement('div'); P.globo.className = 'npcGlobo'; $('hud').appendChild(P.globo); }
  P.globo.textContent = t; P.globoT = 3.5 + t.length * 0.04;
  if (red && RED.on && P.npc) publicar('a', { k: 'npcdi', n: P.npcId, t: t.slice(0, 80) });
}
function npcGloboPaso(P) {
  const G = P.globo; if (!G) return;
  P.globoT -= TIEMPO.dt || 0.016;
  if (P.globoT <= 0 || !PERS.includes(P)) { G.remove(); P.globo = null; return; }
  const tk = P.tam || 1, cp = vadd(P.pos, v3(0, -0.95 + 2.02 * tk, 0)), cl = cp.distTo(CAM.pos) < 40 && clipDe(cp);
  if (cl) { G.style.display = ''; G.style.transform = `translate(${cl.x}px,${cl.y}px) translate(-50%,-100%)`; } else G.style.display = 'none';
}
// ---------------- la red: el dueño manda a sus NPC; los demás los ven y les pegan ----------------
function npcRedMandar() {
  const l = NPC.lista.map((P) => [P.npcId, P.skinQuiere || P.skin, r3(P.pos.x), r3(P.pos.y), r3(P.pos.z), Math.round(P.yaw * 100) / 100, r3(P.vel.x), r3(P.vel.y), r3(P.vel.z),
    (P.suelo ? 1 : 0) | (P.rag ? 2 : 0) | (P.vivo === false ? 4 : 0), P.emote || '']);
  publicar('a', { k: 'npcs', l });
}
function npcRecibir(d) {
  const de = d.i; if (!de || de === RED.ID) return;
  if (d.k === 'npcs' && Array.isArray(d.l)) {
    for (const x of d.l.slice(0, NPC.max)) {
      if (!Array.isArray(x)) continue;
      const key = de + '/' + (x[0] | 0); let E = NPC.rem.get(key);
      const real = DATA.chars.includes(x[1]) ? x[1] : 'Hero', skin = rbListo(rbDeSkin(real)) ? real : (rbPedir(rbDeSkin(real)), 'Hero');
      if (E && E.skin !== skin) { npcRemQuitar(key, E); E = null; }
      if (!E) {
        const P = crearPersona(skin, 'HatEmpty', { nombre: '' }); P.npcRem = { o: de, n: x[0] | 0 };
        const b = new Body(capsuleShape(0.4, 0.5), 80); b.frozen = true; b.persona = P; b.noJug = false; b.noGrab = true; addBody(b); P.npcB = b;
        E = { P, b, skin, meta: v3(num(x[2], -1e4, 1e4, 0), num(x[3], -1e4, 1e4, 0), num(x[4], -1e4, 1e4, 0)), vel: v3(), yaw: 0, yawM: 0, t: TIEMPO.t, f: 0 };
        P.pos.copy(E.meta); NPC.rem.set(key, E);
      }
      E.meta.set(num(x[2], -1e4, 1e4, 0), num(x[3], -1e4, 1e4, 0), num(x[4], -1e4, 1e4, 0)); E.yawM = num(x[5], -1e3, 1e3, 0);
      E.vel.set(num(x[6], -80, 80, 0), num(x[7], -80, 80, 0), num(x[8], -80, 80, 0)); E.f = x[9] | 0; E.t = TIEMPO.t;
      const em = typeof x[10] === 'string' && emoValido(x[10]) ? x[10] : null;
      if (em && E.P.emote !== em) { E.P.emote = em; E.P.emoteT = 0; if (em === 'Patada') sonar('CB_Swing', E.P.pos, 0.5, 0.9); } else if (!em) E.P.emote = null;
    }
  } else if (d.k === 'npcfin') { const key = de + '/' + (d.n | 0), E = NPC.rem.get(key); if (E) npcRemQuitar(key, E); }
  else if (d.k === 'npcdi') { const E = NPC.rem.get(de + '/' + (d.n | 0)); if (E && typeof d.t === 'string') npcDecir(E.P, limpio(d.t, 80), false); }
  else if (d.k === 'npcdan' && d.to === RED.ID) {
    const P = NPC.lista.find((Q) => Q.npcId === (d.n | 0)); if (!P || P.vivo === false) return;
    const v = Array.isArray(d.v) ? v3(num(d.v[0], -50, 50, 0), num(d.v[1], -50, 50, 0), num(d.v[2], -50, 50, 0)) : v3(0, 0, 1);
    if (d.tumba) npcTumbar(P, v, 0); else danarPersona(P, num(d.d, 0, 9999, 0), P.pos.clone(), v.len() > 1e-4 ? v.clone().norm() : v3(0, 0, 1));
  } else if (d.k === 'npcact' && d.to === RED.ID) {
    const P = NPC.lista.find((Q) => Q.npcId === (d.n | 0)); if (P) { P.act = npcActNormal(d.a, { de: de }); P.act.de = typeof d.a === 'object' && d.a && d.a.obj === 'yo' ? de : P.act.de; P.vida = Math.min(P.vida, P.act.vida); }
  }
}
function npcRemQuitar(key, E) { removeBody(E.b); if (E.P.globo) E.P.globo.remove(); borrarPersona(E.P); NPC.rem.delete(key); }
function npcRemotosPaso(dt) {
  for (const [key, E] of NPC.rem) {
    if (TIEMPO.t - E.t > 4 || !PERS.includes(E.P)) { npcRemQuitar(key, E); continue; }
    const P = E.P, k = 1 - Math.exp(-dt * 12), rag = !!(E.f & 6);
    if (rag && !P.rag) { P.vel.copy(E.vel); ragdoll(P, null); } else if (!rag && P.rag) ragdollFin(P);
    P.vivo = !(E.f & 4);
    if (!P.rag) {
      E.meta.addS(E.vel, dt * 0.5); P.pos.lerpTo(E.meta, k);
      let dy = E.yawM - P.yaw; dy = ((dy + Math.PI) % TAU + TAU) % TAU - Math.PI; P.yaw += dy * k; P.vel.copy(E.vel); P.suelo = !!(E.f & 1);
    }
    E.b.pos.copy(P.pos); E.b.updateWorld(); E.b.noRay = E.b.noPhys = E.b.noJug = rag;
    npcGloboPaso(P);
  }
}
// un golpe a un NPC de otro: se le avisa al dueño (y acá se ve el golpe)
function npcGolpeRed(P, dan, d, tumba) {
  if (!P.npcRem || !RED.on) return;
  publicar('a', { k: 'npcdan', to: P.npcRem.o, n: P.npcRem.n, d: Math.round(dan), v: d ? [r3(d.x), r3(d.y), r3(d.z)] : [0, 0, 0], ...(tumba ? { tumba: 1 } : {}) });
}
// ---------------- la herramienta de la Tool Gun: Actitud ----------------
// Clic sobre un NPC: su actitud (escribís cómo actúa). Clic en el piso: pone un NPC (el personaje y la actitud de la
// última vez). Clic derecho: elegir el personaje y la actitud de los que vas a poner.
function actitudUsar(alt, r) {
  const Pb = r && r.body && (r.body.npc || r.body.persona), P = Pb && (Pb.npc || Pb.npcRem) ? Pb : null;
  if (alt) { npcPanel(null); return; }
  if (P) { npcPanel(P); return; }
  if (!r || r.n.y < 0.5) { aviso(T('npc.apunta'), 1.8); return; }
  const skin = NPC.skin || 'Hero';
  rbAsegurar(rbDeSkin(skin)).then(() => {
    const Q = npcCrear(skin, r.p, Math.atan2(CAM.pos.x - r.p.x, CAM.pos.z - r.p.z), Object.assign({}, NPC.act || {}, { de: RED.ID || 'yo' }));
    if (Q) { efectoChispas(r.p); aviso(T('npc.puesto') + ' · ' + skinNom(skin), 1.6); }
  });
}
function npcPanelCerrar() { const p = $('npcPan'); if (p) p.classList.add('oc'); if (UI.abierto === 'npc') UI.abierto = null; NPC.panel = null; }
const NPC_RAPIDAS = [['agresivo', 'npc.r.agresivo'], ['amigo', 'npc.r.amigo'], ['miedoso', 'npc.r.miedoso'], ['bailarin', 'npc.r.bailarin'], ['guardia', 'npc.r.guardia'], ['paseo', 'npc.r.paseo'], ['quieto', 'npc.r.quieto']];
const NPC_RAPIDA_ACT = { agresivo: { modo: 'perseguir', vel: 5.5, hostil: true, dano: 12, dist: 1.2 }, amigo: { modo: 'seguir', vel: 4, obj: 'yo', dist: 3, hostil: false }, miedoso: { modo: 'huir', vel: 5.5, dist: 12, hostil: false },
  bailarin: { modo: 'bailar', emote: 'ChickenDance', hostil: false }, guardia: { modo: 'guardia', vel: 5, dist: 7, hostil: true, dano: 10 }, paseo: { modo: 'pasear', vel: 2, hostil: false }, quieto: { modo: 'quieto', hostil: false } };
function npcPanel(P) {
  let p = $('npcPan');
  if (!p) {
    p = document.createElement('div'); p.id = 'npcPan'; p.className = 'panel oc'; document.body.appendChild(p);
    p.addEventListener('click', (e) => {
      if (e.target === p) { npcPanelCerrar(); return; }
      const s = e.target.closest('[data-npcs]'); if (s) { NPC.skin = s.dataset.npcs; for (const x of p.querySelectorAll('[data-npcs]')) x.classList.toggle('sel', x === s); return; }
      const q = e.target.closest('[data-npcr]'); if (q) { npcAplicar(npcActNormal(Object.assign({ decir: [] }, NPC_RAPIDA_ACT[q.dataset.npcr]), { de: RED.ID || 'yo' }), T(q.dataset.npct)); return; }
      if (e.target.closest('[data-npcok]')) { npcEscrito(); return; }
      if (e.target.closest('[data-npcborrar]')) { const Q = NPC.panel; if (Q && Q.npc) { npcQuitar(Q); aviso(T('borrado') + ': NPC', 1.2); } npcPanelCerrar(); return; }
      if (e.target.closest('[data-npctodos]')) { npcTodos(); aviso(T('npc.todosBorrados'), 1.5); npcPanelCerrar(); }
    });
    p.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && e.target.id === 'npcTxt' && !e.shiftKey) { e.preventDefault(); npcEscrito(); } });
  }
  const nuevo = !P, act = P ? P.act : NPC.act || npcActBase(), skinSel = P ? P.skinQuiere || P.skin : NPC.skin || 'Hero';
  const desc = npcActDescribir(act);
  p.innerHTML = `<div class="caja npcCaja"><h3>${esc(T(nuevo ? 'npc.titNuevo' : 'npc.tit'))}${P ? ' · ' + esc(skinNom(skinSel)) : ''}</h3>` +
    (nuevo ? `<p>${esc(T('npc.ayudaNuevo'))}</p><div class="npcSkins">${DATA.chars.map((s) => `<button data-npcs="${esc(s)}"${s === skinSel ? ' class="sel"' : ''}><img src="${icono(RETRATO[s] || s)}" alt=""><span>${esc(skinNom(s))}</span></button>`).join('')}</div>` : '') +
    `<p class="npcAhora">${esc(T('npc.ahora'))}: <b>${esc(desc)}</b></p>` +
    `<div class="npcRapidas">${NPC_RAPIDAS.map(([k, t]) => `<button data-npcr="${k}" data-npct="${t}">${esc(T(t))}</button>`).join('')}</div>` +
    `<textarea id="npcTxt" maxlength="300" rows="2" placeholder="${esc(T('npc.escribi'))}"></textarea>` +
    `<div class="npcFila"><button class="npcOk" data-npcok>${esc(T('npc.aplicar'))}</button>${P && P.npc ? `<button class="npcBorrar" data-npcborrar>${esc(T('npc.borrar'))}</button>` : ''}${NPC.lista.length ? `<button class="npcBorrar" data-npctodos>${esc(T('npc.borrarTodos'))} (${NPC.lista.length})</button>` : ''}</div>` +
    `<p class="npcEstado" id="npcEst"></p></div>`;
  cerrarPaneles(); NPC.panel = P; p.classList.remove('oc'); UI.abierto = 'npc'; soltarPuntero();
  setTimeout(() => { const t = $('npcTxt'); if (t && !ENT.tactil) t.focus(); }, 50);
}
function npcActDescribir(a) {
  const m = T('npc.m.' + a.modo) + (a.hostil ? ', ' + T('npc.hostil') : '') + (a.modo !== 'quieto' && a.modo !== 'bailar' && a.modo !== 'mirar' ? ', ' + a.vel.toFixed(1) + ' m/s' : '');
  return m + (a.decir.length ? ' · «' + a.decir[0] + '»' : '');
}
// aplicar una actitud: al NPC del panel (si es de otro, se la mando al dueño) o a los próximos que ponga
function npcAplicar(act, nombre) {
  const P = NPC.panel;
  if (P && P.npc) { const vida = P.vida; P.act = act; P.vida = Math.min(Math.max(vida, 1), act.vida); P.ia.casa = P.pos.clone(); P.emote = null; if (act.decir.length) npcDecir(P, act.decir[0], true); }
  else if (P && P.npcRem && RED.on) publicar('a', { k: 'npcact', to: P.npcRem.o, n: P.npcRem.n, a: act });
  else NPC.act = act;
  const e = $('npcEst'); if (e) e.textContent = (nombre ? nombre + ': ' : '') + npcActDescribir(act);
  const h = document.querySelector('#npcPan .npcAhora b'); if (h) h.textContent = npcActDescribir(act);
  sonar('Click', null, 0.5, 1.3);
}
// lo escrito: al instante el lector local; después la IA lo afina (si el panel cambió de NPC, igual le llega al de antes)
async function npcEscrito() {
  const i = $('npcTxt'), t = i ? i.value.trim().slice(0, 300) : ''; if (!t) return;
  const P = NPC.panel, base = { de: RED.ID || 'yo' }, rapido = npcActDeTexto(t, base);
  npcAplicar(rapido, T('npc.local'));
  const e = $('npcEst'); if (e) e.textContent = T('npc.pensando');
  const r = await iaJSON(NPC_SIS, t, 20000);
  if (!r) { if (e && NPC.panel === P) e.textContent = T('npc.sinIA') + ' · ' + npcActDescribir(rapido); return; }
  const act = npcActNormal(r.o, base); if (act.obj === 'yo') act.de = RED.ID || 'yo';
  const antes = NPC.panel; NPC.panel = P; npcAplicar(act, 'IA'); NPC.panel = antes;
  const e2 = $('npcEst'); if (e2 && antes === P) e2.textContent = 'IA (' + r.ia + '): ' + npcActDescribir(act);
  NPC.ultIA = r.ia;
}
