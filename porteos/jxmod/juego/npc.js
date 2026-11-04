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
const NPC_MODOS = ['quieto', 'pasear', 'seguir', 'perseguir', 'huir', 'bailar', 'guardia', 'mirar', 'defender'];
// las armas que puede llevar (idea de Discord: «NPCs agresivos que usen armas y NPCs amigos que te defiendan»). Cada una
// con cómo la usa un NPC: cada cuánto tira, de a cuántos tiros la ráfaga y la pausa, hasta dónde y cuánto se le abre el tiro
const NPC_ARMAS = ['Pistol', 'Revolver', 'Smg', 'Akm', 'Shotgun', 'Crowbar'];
const NPC_TIRO = { Pistol: { cad: 0.55, rafaga: 1, rango: 28, disp: 0.03 }, Revolver: { cad: 1.1, rafaga: 1, rango: 34, disp: 0.02 },
  Smg: { cad: 0.09, rafaga: 5, pausa: 0.9, rango: 22, disp: 0.05 }, Akm: { cad: 0.12, rafaga: 3, pausa: 0.8, rango: 40, disp: 0.028 }, Shotgun: { cad: 1.2, rafaga: 1, rango: 12, disp: 0.07 } };
const NPC_OBJ = ['cerca', 'yo', 'npc'];
const NPC_BAILES = ['ChickenDance', 'Techno', 'Twerk', 'Flair', 'Victory', 'Clap', 'Hi', 'Backflip', 'AirSquat', 'rb:Gangnam', 'rb:YMCA', 'rb:HipHop', 'rb:Shuffle', 'rb:Breakdance', 'rb:Boxeo', 'rb:Momia', 'rb:GritoZombi', 'rb:Corazon', 'rb:SaludoGrande', 'rb:Giro360'];
const npcActBase = () => ({ modo: 'pasear', vel: 2, obj: 'cerca', dist: 3, hostil: false, dano: 10, emote: '', decir: [], salta: false, vida: 100, nombre: '', de: '', arma: '' });
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
  if (typeof a.arma === 'string') o.arma = NPC_ARMAS.includes(a.arma) ? a.arma : '';
  if (o.modo === 'perseguir' && o.dist > 3) o.dist = 1.2;
  if (o.modo === 'defender') { o.hostil = false; if (o.obj === 'npc') o.obj = 'yo'; if (o.dist > 8) o.dist = 3; }   // (defiende a una persona: la sigue de cerca)
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
  if (hay(/guard|vigil|cuid|patrull|patrol|jaga/)) { a.modo = 'guardia'; a.dist = 7; }
  // (que te defienda: te sigue y le tira o le pega a lo que te ataca)
  if (hay(/defiend|defend|proteg|protect|guardaespald|bodyguard|escolt|escort|aliad|ally|cuidame|cuidanos|me cuide|nos cuide|me ayude|nos ayude|help me|de mi lado|my side|lindung|bela/)) { a.modo = 'defender'; a.obj = 'yo'; a.dist = 3; a.hostil = false; }
  // (con arma)
  for (const [re, w] of [[/escopet|shotgun|recortad|espingard|scatter/, 'Shotgun'], [/ ak|ak-?47|akm|rifle|fusil|assault/, 'Akm'], [/smg|metrallet|subfusil|ametrallador|uzi|mp5|machine ?gun|submachine/, 'Smg'],
    [/revolver|revólver|magnum|357/, 'Revolver'], [/palanca|crowbar|barreta|pe de cabra|pata de cabra/, 'Crowbar'], [/pistol|armad|con arma|with a gun|with gun| gun|dispar|tirotea|shoot|balas|armed|senjata|tembak|銃/, 'Pistol']]) if (hay(re)) { a.arma = w; break; }
  if (hay(/pase|deambul|vag[ae]|explor|wander|roam|walk around|passe|jalan|散歩/) && !a.modo) a.modo = 'pasear';
  if (hay(/ mira|observ|watch|stare|look at|olha|lihat|見/) && !a.modo) a.modo = 'mirar';
  if (hay(/quiet|parad|para |stop|stay|espera|idle|wait|fica|diam|止ま/) && !a.modo) a.modo = 'quieto';
  if (hay(/amig|amable|buen|pacif|tranqui|friend|nice|kind|peace|gentle|ramah|baik/)) { a.hostil = false; if (!a.modo) a.modo = a.arma ? 'defender' : 'seguir'; if (a.modo === 'defender') a.obj = 'yo'; }
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
  '{"modo":"quieto|pasear|seguir|perseguir|huir|bailar|guardia|mirar|defender","arma":"|Pistol|Revolver|Smg|Akm|Shotgun|Crowbar","vel":m/s (walk 2, jog 4, run 5.5, sprint 7.5),"obj":"cerca|yo|npc","dist":meters,"hostil":true|false,"dano":0-50 (damage per kick),"emote":"","decir":["up to 3 short lines the NPC says, max 60 characters, in the player\'s language"],"salta":true|false,"vida":10-1000,"nombre":"short name or empty"}\n' +
  'modo: quieto = stands still; pasear = wanders around; seguir = follows the target and keeps dist; perseguir = chases the target (if hostil it attacks with kicks); huir = runs away when the target is closer than dist; bailar = dances in place (emote); guardia = guards its spot: chases whoever comes closer than dist, then goes back; mirar = stands and stares at the target; defender = a bodyguard: follows the player (obj yo) and shoots or hits whoever attacks them (hostile NPCs, attackers).\n' +
  'arma: the weapon it carries and uses ("" = none, kicks if hostile): Pistol, Revolver (strong, slow), Smg (bursts), Akm (rifle), Shotgun (close range), Crowbar (melee). Use one when the player asks for a gun, shooting, an armed or a defending NPC.\n' +
  'obj: cerca = the nearest player; yo = the player who wrote this ("me", "us", "conmigo"); npc = the nearest other NPC (to fight or follow NPCs).\n' +
  'emote (only for bailar or a gesture): one of ' + NPC_BAILES.join(', ') + '.\n' +
  'Family friendly lines (no slurs, nothing sexual). Examples: "agresivo que nos persiga corriendo" -> {"modo":"perseguir","vel":5.5,"obj":"cerca","dist":1.2,"hostil":true,"dano":12,"emote":"","decir":["¡Te voy a atrapar!","¡No escapás!"],"salta":false,"vida":100,"nombre":""} ' +
  '"a shy guy who follows me and dances" -> {"modo":"seguir","vel":4,"obj":"yo","dist":3,"hostil":false,"dano":0,"emote":"rb:Shuffle","decir":["Hi... can I come with you?"],"salta":false,"vida":100,"nombre":""} ' +
  '"un amigo con escopeta que me defienda" -> {"modo":"defender","arma":"Shotgun","vel":5,"obj":"yo","dist":3,"hostil":false,"dano":12,"emote":"","decir":["¡Yo te cubro!"],"salta":false,"vida":200,"nombre":""}';
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
  if (!DATA.chars.includes(skin) && !(typeof gmpEs === 'function' && gmpEs(skin))) skin = 'Hero';   // (o un modelo de un addon de GMod)
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
// ---------------- los bandos: el hostil es «malo», el que te defiende es «bueno» (los de otros, por lo que manda su dueño) ----------------
function npcBando(Q) {
  if (Q.npc && Q.act) return Q.act.hostil ? 'malo' : Q.act.modo === 'defender' ? 'bueno' : '';
  if (Q.npcRem) return Q.npcRem.hostil ? 'malo' : Q.npcRem.bueno ? 'bueno' : '';
  return 'jug';
}
const npcEnPie = (Q) => !!Q && PERS.includes(Q) && !Q.rag && Q.vivo !== false && (Q !== JUG.cuerpo || JUG.vivo);
const npcPosDe = (Q) => (Q === JUG.cuerpo ? JUG.pos : Q.pos);
// el que le pegó hace poco (10 s, a menos de 45 m): a ése se da vuelta
function npcVenganza(P) {
  const v = P.ia && P.ia.venganza; if (!v || TIEMPO.t - v.t > 10 || !npcEnPie(v.P)) return null;
  const pos = npcPosDe(v.P); return pos.distTo(P.pos) < 45 ? { P: v.P, pos } : null;
}
// lo que amenaza al que defiende: el que le pegó al NPC, los hostiles a menos de 30 m de su protegido (o de 18 m de él) y el
// jugador que le pegó a su protegido hace poco (con PvP)
function npcAmenaza(P, prot) {
  const c = prot ? prot.pos : P.pos; let mejor = npcVenganza(P), dm = mejor ? mejor.pos.distTo(P.pos) * 0.7 : 1e9;
  for (const Q of PERS) {
    if (Q === P || !npcEnPie(Q) || npcBando(Q) !== 'malo') continue;
    const dp = Q.pos.distTo(P.pos); if (Q.pos.distTo(c) > 30 && dp > 18) continue;
    if (dp < dm) { dm = dp; mejor = { P: Q, pos: Q.pos }; }
  }
  const ag = NPC.agresor;
  if (ag && TIEMPO.t - ag.t < 8 && prot && prot.id === (RED.ID || 'yo')) {
    const R2 = RED.remotos.get(ag.id); if (R2 && R2.P && npcEnPie(R2.P)) { const dp = R2.P.pos.distTo(P.pos); if (dp < dm && dp < 40) { dm = dp; mejor = { P: R2.P, pos: R2.P.pos, id: ag.id }; } }
  }
  return mejor;
}
// le pegaron (un NPC, con un tiro o una patada): se acuerda de quién
function npcGolpeado(Q, de) { if (Q && Q.npc && Q.ia && de && de !== Q) Q.ia.venganza = { P: de, t: TIEMPO.t }; }
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
    // (con el procesador que no da —TIEMPO.lento—, los que están a más de 15 m de la cámara piensan y se mueven cada dos
    // cuadros y a más de 30 m cada cuatro, con el tiempo juntado; nunca más de 0,1 s de golpe, así no atraviesan paredes)
    const lento = TIEMPO.lento || 0;
    if (lento && P.vivo !== false && !P.rag && !(P.npcB && P.npcB.held)) {
      const dx = P.pos.x - CAM.pos.x, dz = P.pos.z - CAM.pos.z, d2 = dx * dx + dz * dz;
      const cada = Math.min(d2 > 900 ? (lento >= 2 ? 4 : 2) : d2 > 225 ? 2 : 1, Math.max(1, Math.floor(0.1 / Math.max(dt, 1e-3))));
      P.npcDtA = (P.npcDtA || 0) + dt;
      if (cada > 1 && ((P.npcCN = (P.npcCN || P.n1 || 1) + 1) % cada)) continue;
      const dA = P.npcDtA; P.npcDtA = 0; npcCerebro(P, dA); continue;
    }
    P.npcDtA = 0; npcCerebro(P, dt);
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
    // (mientras alguien lo tiene agarrado no se levanta; al soltarlo espera a quedar quieto)
    if (P.rag && P.vivo !== false && !P.muneco) {
      const sost = [...P.rag.cuerpos.values()].some((e) => e.b.held), h = P.rag.cuerpos.get(P.D.h.Hips);
      if (sost) I.ragT = Math.max(I.ragT, 2.2);
      else if ((I.ragT -= dt) <= 0) { if (h && h.b.vel.len() > 1.2) I.ragT = 0.3; else npcLevantar(P); }
    }
    npcGloboPaso(P); return;
  }
  // levantado con la Physics Gun o la Gravity Gun: lo lleva la cápsula, patalea
  if (b && b.held) { P.pos.copy(b.pos); P.vel.copy(b.vel); P.suelo = false; I.llevado = true; P.emote = null; npcGloboPaso(P); return; }
  if (I.llevado) { I.llevado = false; P.vel.copy(b.vel); b.frozen = true; b.vel.set(0, 0, 0); b.ang.set(0, 0, 0); b.q.set(0, 0, 0, 1); if (P.vel.len() > 9) { npcTumbar(P, P.vel.clone(), 0); return; } }
  if (b) { b.noRay = b.noPhys = false; b.noJug = !!(P.jntFin && TIEMPO.t < P.jntFin); }
  // a quién: el hostil, al más cercano (o al que le pegó); el que defiende sigue a su protegido y pelea con lo que lo amenaza
  const def = a.modo === 'defender', ven = a.hostil ? npcVenganza(P) : null;
  const obj = ven || npcObjetivo(P), d = obj ? Math.hypot(obj.pos.x - P.pos.x, obj.pos.z - P.pos.z) : 1e9, hacia = obj ? v3(obj.pos.x - P.pos.x, 0, obj.pos.z - P.pos.z).norm() : null;
  const bl = def ? npcAmenaza(P, obj) : a.hostil && a.modo !== 'bailar' && a.modo !== 'huir' ? obj : null;   // (con quién pelea)
  const T0 = NPC_TIRO[a.arma] && DEF_ARMAS[a.arma] ? NPC_TIRO[a.arma] : null;   // (un arma de fuego)
  if (P.arma !== (a.arma || null)) P.arma = a.arma || null;   // (el arma en la mano: la dibuja personas.js y la postura es la de GMod)
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
    case 'defender':
      if (bl) {
        const db = Math.hypot(bl.pos.x - P.pos.x, bl.pos.z - P.pos.z), hb = v3(bl.pos.x - P.pos.x, 0, bl.pos.z - P.pos.z).norm();
        if (obj && d > 25) { quiere = hacia; vel = Math.max(a.vel, 5.5); }   // (no se va lejos del que defiende)
        else if (T0) { if (db > T0.rango * 0.75 || !I.vis) { quiere = hb; vel = Math.max(a.vel, 4.5); } else mirar = hb; }
        else if (db > 1.1) { quiere = hb; vel = Math.max(a.vel, 5.5); } else mirar = hb;
      } else if (obj && d > a.dist + 0.6) { quiere = hacia; vel = d > a.dist + 8 ? Math.max(a.vel, 5.5) : a.vel; } else if (obj) mirar = hacia;
      break;
    case 'guardia': {
      const enCasa = Math.hypot(I.casa.x - P.pos.x, I.casa.z - P.pos.z), cercaCasa = obj && Math.hypot(obj.pos.x - I.casa.x, obj.pos.z - I.casa.z) < a.dist;
      if (cercaCasa) { if (a.hostil && d > 1.1) quiere = hacia; else mirar = hacia; vel = Math.max(a.vel, 4); }
      else if (enCasa > 1) { quiere = v3(I.casa.x - P.pos.x, 0, I.casa.z - P.pos.z).norm(); vel = Math.min(a.vel, 3.5); }
      else if (obj && d < a.dist + 6) mirar = hacia;
      break;
    }
  }
  // con un arma de fuego: lo tiene a tiro y lo ve → se planta y tira (si no, se acerca como diga su modo)
  const hbl = bl ? v3(bl.pos.x - P.pos.x, 0, bl.pos.z - P.pos.z).norm() : null, dbl = bl ? Math.hypot(bl.pos.x - P.pos.x, bl.pos.z - P.pos.z) : 1e9;
  if (T0 && bl && !def && I.vis && dbl < T0.rango * 0.75) { quiere = null; mirar = hbl; }
  if (T0 && bl) npcFuego(P, bl, dt); else { I.veT = 0; I.vis = false; }
  P.mira = bl && T0 ? clamp(-Math.atan2(bl.pos.y - P.pos.y, Math.max(0.5, dbl)), -0.8, 0.8) : (P.mira || 0) * 0.9;   // (el torso y la cabeza hacia arriba o abajo)
  // pegar: una patada (o un palancazo) cuando lo tiene al lado (si es hostil o defiende, y no tiene un arma de fuego)
  if (bl && !T0 && dbl < 1.45 * (P.tam || 1) + 0.2 && I.golpeT <= 0 && Math.abs(bl.pos.y - P.pos.y) < 1.6) {
    I.golpeT = 1.05; I.golpe = { t: 0.2, obj: bl }; mirar = hbl; quiere = null;
    if (a.arma === 'Crowbar') { I.patT = 0.4; humAccion(P, 'tiro'); sonar('CB_Swing', P.pos, 0.6, 0.95 + Math.random() * 0.1); }
    else { I.patT = 0.64; P.emote = 'Patada'; P.emoteT = 0; sonar('CB_Swing', P.pos, 0.5, 0.85 + Math.random() * 0.1); }
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
  const dir = v3(obj.pos.x - P.pos.x, 0.25, obj.pos.z - P.pos.z).norm(), pal = P.act.arma === 'Crowbar', dan = P.act.dano * (pal ? 2 : 1), son = pal ? azarDe(DEF_ARMAS.Crowbar.sCarne) : 'Melee1';
  if (Q === JUG.cuerpo) { danarJugador(dan, P.pos); JUG.vel.addS(dir, 5); JUG.vel.y += 2; sonar(son, JUG.pos, 0.6); }
  else { danarPersona(Q, dan, Q.pos.clone(), dir); npcGolpeado(Q, P); if (Q.npc && Q.vivo !== false && !Q.rag) { Q.vel.addS(dir, 4); Q.vel.y += 1.5; } sonar(son, Q.pos, 0.6); }
}
// ---------------- los tiros: ve al blanco (sin nada en el medio), reacciona (medio segundo), apunta al pecho y tira con
// su cadencia y sus ráfagas; el tiro se abre más cuanto más lejos (y si camina). Los suyos no: si hay un amigo en el medio
// no tira. El daño, como el del arma pero a menos de la mitad (los NPC no son tan certeros como para bajarte en dos tiros)
function npcVe(P, bl) {
  const o = v3(P.pos.x, P.pos.y + 0.55 * (P.tam || 1), P.pos.z), t = v3(bl.pos.x, bl.pos.y + 0.3, bl.pos.z), dv = vsub(t, o), L = dv.len(); if (L < 0.05) return true;
  const h = raycast(o, vscale(dv, 1 / L), L, P.npcB); if (!h) return true;
  const b = h.body; return !!(b && (b.persona === bl.P || b.npc === bl.P)) || h.t > L - 0.45;
}
// de dónde sale: la mano derecha (si se dibujó hace poco y está con el cuerpo), si no, a la altura del pecho
function npcBoca(P, hacia) {
  const hi = P.D && P.D.h && P.D.h.RightHand, W = hi !== undefined && P.md && P.md.W && P.md.W[hi];
  let o = W ? v3(W[12], W[13], W[14]) : null; if (!o || !isFinite(o.x) || o.distTo(P.pos) > 1.6 * (P.tam || 1)) o = v3(P.pos.x, P.pos.y + 0.45 * (P.tam || 1), P.pos.z);
  if (hacia) { const d = vsub(hacia, o); const L = d.len(); if (L > 0.3) o = vadd(o, vscale(d, 0.25 / L)); }
  return o;
}
function npcAmigoEnMedio(P, o, d, L) {
  if (npcBando(P) !== 'bueno') return false;
  const yo = rayoJugador(o, d, L); if (yo && yo.t < L - 0.5) return true;   // (el jugador al que cuida, en la línea de tiro)
  const h = raycast(o, d, L, P.npcB), Q = h && h.body && (h.body.persona || h.body.npc);
  return !!(Q && h.t < L - 0.5 && npcBando(Q) !== 'malo');
}
function npcFuego(P, bl, dt) {
  const I = P.ia, a = P.act, T0 = NPC_TIRO[a.arma], D = DEF_ARMAS[a.arma]; if (!T0 || !D) return;
  if ((I.visT = (I.visT || 0) - dt) <= 0) { I.visT = 0.15; I.vis = npcVe(P, bl); }
  I.tiroT = (I.tiroT || 0) - dt;
  if (!I.vis) { I.veT = 0; return; }
  I.veT = (I.veT || 0) + dt;
  if (I.veT < 0.5 || I.tiroT > 0 || P.emote) return;
  const dx = bl.pos.x - P.pos.x, dz = bl.pos.z - P.pos.z, dh = Math.hypot(dx, dz); if (dh > T0.rango * 1.25) return;
  let dy = Math.atan2(dx, dz) - P.yaw; dy = ((dy + Math.PI) % TAU + TAU) % TAU - Math.PI; if (Math.abs(dy) > 0.45) return;   // (todavía no lo mira)
  const meta = v3(bl.pos.x, bl.pos.y + 0.3 * ((bl.P && bl.P.tam) || 1), bl.pos.z), o = npcBoca(P, meta), d0 = vsub(meta, o), L0 = d0.len(); d0.norm();
  if (npcAmigoEnMedio(P, o, d0, L0)) { I.tiroT = 0.35; return; }
  const n = D.tipo === 'perdigones' ? 8 : 1, abre = T0.disp * (1 + dh / 13) * (Math.hypot(P.vel.x, P.vel.z) > 1 ? 1.6 : 1), dan = D.dan * clamp(a.dano / 12, 0.25, 3) * 0.45;
  for (let k = 0; k < n; k++) {
    const dir = v3(d0.x + (Math.random() - 0.5) * 2 * abre, d0.y + (Math.random() - 0.5) * 2 * abre, d0.z + (Math.random() - 0.5) * 2 * abre).norm();
    npcBala(P, o, dir, T0.rango * 1.6, dan, bl.P);
  }
  sonar(azarDe(D.sF), o, 0.8); humAccion(P, 'tiro');
  if (T0.rafaga > 1) { I.rafN = (I.rafN || T0.rafaga) - 1; if (I.rafN <= 0) { I.rafN = T0.rafaga; I.tiroT = T0.pausa + Math.random() * 0.3; } else I.tiroT = T0.cad; }
  else I.tiroT = T0.cad * (0.85 + Math.random() * 0.3);
  I.tirosRed = (I.tirosRed || 0) + 1; I.miraRed = meta; NPC.tiros = (NPC.tiros || 0) + 1;
}
function npcBala(P, o, dir, L, dan, blanco) {
  const bueno = npcBando(P) === 'bueno', h = raycast(o, dir, L, P.npcB), yo = !bueno || blanco === JUG.cuerpo ? rayoJugador(o, dir, L) : null;
  let fin;
  if (yo && (!h || yo.t < h.t)) { fin = yo.p; efectoImpacto(yo.p, vscale(dir, -1), 'cuerpo'); danarJugador(dan, P.pos); JUG.vel.addS(dir, Math.min(2, dan * 0.05)); }
  else if (h) {
    fin = h.p; const b = h.body; efectoImpacto(h.p, h.n, b ? 'cuerpo' : 'mundo');
    if (b) {
      b.wake && b.wake(); if (b.dynamic) b.applyVel(vscale(dir, Math.min(6, dan * 0.4 / Math.max(1, b.mass * 0.05))), vsub(h.p, b.pos), 1);
      if (b.obj) danarObjeto(b.obj, dan, h.p, dir);
      const Q = b.persona || b.npc;
      if (Q && Q !== P && (!bueno || Q === blanco || npcBando(Q) === 'malo')) { danarPersona(Q, dan, h.p, dir); npcGolpeado(Q, P); }
    }
  } else fin = vadd(o, vscale(dir, L));
  efectoTraza(o, fin);
}
// ---------------- al piso (muñeco de trapo) y levantarse ----------------
function npcTumbar(P, imp, dan) {
  if (!P || P.rag || (!P.npc && !P.npcRem)) return;
  if (P.npcRem) { npcGolpeRed(P, dan || 0, imp, true); return; }
  npcAdoptar(P);
  P.emote = null; P.vel.copy(imp || v3()); ragdoll(P, imp ? vscale(imp, 0.6) : null, P.pos); P.ia.ragT = 2.6 + Math.random();
  if (P.npcB) { P.npcB.noRay = P.npcB.noPhys = P.npcB.noJug = true; }
}
// agarrado vivo con la Physics Gun o la Gravity Gun: se hace muñeco de trapo (antes lo llevaba la cápsula y hacía la
// animación de saltar en el aire) y se lo lleva de la parte del cuerpo más cercana a donde se apuntó; al soltarlo cae
// y, quieto, se levanta solo. Devuelve el cuerpo a sostener
function npcAgarrarRag(b, punto) {
  const P = b && b.npc; if (!P || !P.npc || P.vivo === false || P.rag) return b;
  npcTumbar(P, null, 0); if (!P.rag) return b;
  let best = null, bd = 1e9; for (const [, e] of P.rag.cuerpos) { const d = e.b.pos.distTo(punto || b.pos); if (d < bd) { bd = d; best = e.b; } }
  P.ia.ragT = 2.2; return best || b;
}
function npcLevantar(P) {
  if (P.muneco) return;   // (los muñecos de trapo se quedan tirados)
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
    (P.suelo ? 1 : 0) | (P.rag ? 2 : 0) | (P.vivo === false ? 4 : 0) | (P.act.hostil ? 8 : 0) | (P.act.modo === 'defender' ? 16 : 0), P.emote || '',
    P.arma || '', Math.min(9, P.ia.tirosRed || 0), P.ia.tirosRed && P.ia.miraRed ? [r3(P.ia.miraRed.x), r3(P.ia.miraRed.y), r3(P.ia.miraRed.z)] : 0]);
  for (const P of NPC.lista) P.ia.tirosRed = 0;   // (los tiros desde el último envío: los demás los ven salir)
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
      E.P.npcRem.hostil = !!(E.f & 8); E.P.npcRem.bueno = !!(E.f & 16);
      E.P.arma = NPC_ARMAS.includes(x[11]) ? x[11] : null;
      if (E.P.arma && NPC_TIRO[E.P.arma] && (x[12] | 0) > 0 && Array.isArray(x[13])) { E.tiros = Math.min(12, (E.tiros || 0) + (x[12] | 0)); E.mira = v3(num(x[13][0], -1e4, 1e4, 0), num(x[13][1], -1e4, 1e4, 0), num(x[13][2], -1e4, 1e4, 0)); }
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
    // (los tiros que hizo: se ven salir, con su ruido y su traza, a su cadencia; el daño lo pone su dueño)
    if (E.tiros > 0 && E.mira && !rag && (E.tiroT = (E.tiroT || 0) - dt) <= 0) {
      const D = DEF_ARMAS[P.arma], T0 = NPC_TIRO[P.arma]; E.tiros--; E.tiroT = Math.max(0.06, T0 ? T0.cad : 0.3);
      if (D) { const o = npcBoca(P, E.mira), dv = vsub(E.mira, o), L = dv.len(); if (L > 0.3) { const h = raycast(o, dv.norm(), L + 2, E.b); efectoTraza(o, h ? h.p : E.mira); if (h) efectoImpacto(h.p, h.n, h.body ? 'cuerpo' : 'mundo'); } sonar(azarDe(D.sF), o, 0.8); humAccion(P, 'tiro'); }
    }
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
const NPC_RAPIDAS = [['agresivo', 'npc.r.agresivo'], ['armado', 'npc.r.armado'], ['defensor', 'npc.r.defensor'], ['amigo', 'npc.r.amigo'], ['miedoso', 'npc.r.miedoso'], ['bailarin', 'npc.r.bailarin'], ['guardia', 'npc.r.guardia'], ['paseo', 'npc.r.paseo'], ['quieto', 'npc.r.quieto']];
const NPC_RAPIDA_ACT = { agresivo: { modo: 'perseguir', vel: 5.5, hostil: true, dano: 12, dist: 1.2 }, armado: { modo: 'perseguir', vel: 4, hostil: true, dano: 12, dist: 1.2, arma: 'Pistol' },
  defensor: { modo: 'defender', vel: 5, obj: 'yo', dist: 3, hostil: false, dano: 12, arma: 'Smg', vida: 200 }, amigo: { modo: 'seguir', vel: 4, obj: 'yo', dist: 3, hostil: false }, miedoso: { modo: 'huir', vel: 5.5, dist: 12, hostil: false },
  bailarin: { modo: 'bailar', emote: 'ChickenDance', hostil: false }, guardia: { modo: 'guardia', vel: 5, dist: 7, hostil: true, dano: 10 }, paseo: { modo: 'pasear', vel: 2, hostil: false }, quieto: { modo: 'quieto', hostil: false } };
function npcPanel(P) {
  let p = $('npcPan');
  if (!p) {
    p = document.createElement('div'); p.id = 'npcPan'; p.className = 'panel oc'; document.body.appendChild(p);
    p.addEventListener('click', (e) => {
      if (e.target === p) { npcPanelCerrar(); return; }
      const s = e.target.closest('[data-npcs]'); if (s) { NPC.skin = s.dataset.npcs; for (const x of p.querySelectorAll('[data-npcs]')) x.classList.toggle('sel', x === s); return; }
      const q = e.target.closest('[data-npcr]'); if (q) { npcAplicar(npcActNormal(Object.assign({ decir: [] }, NPC_RAPIDA_ACT[q.dataset.npcr]), { de: RED.ID || 'yo' }), T(q.dataset.npct)); return; }
      const w = e.target.closest('[data-npca]');
      if (w) { const base = (NPC.panel && NPC.panel.act) || NPC.act || npcActBase(); npcAplicar(npcActNormal(Object.assign({}, base, { arma: w.dataset.npca })), T('npc.arma')); for (const x of p.querySelectorAll('[data-npca]')) x.classList.toggle('sel', x === w); return; }
      if (e.target.closest('[data-npcok]')) { npcEscrito(); return; }
      if (e.target.closest('[data-npcborrar]')) { const Q = NPC.panel; if (Q && Q.npc) { npcQuitar(Q); aviso(T('borrado') + ': NPC', 1.2); } npcPanelCerrar(); return; }
      if (e.target.closest('[data-npctodos]')) { npcTodos(); aviso(T('npc.todosBorrados'), 1.5); npcPanelCerrar(); }
    });
    p.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && e.target.id === 'npcTxt' && !e.shiftKey) { e.preventDefault(); npcEscrito(); } });
  }
  const nuevo = !P, act = P ? P.act : NPC.act || npcActBase(), skinSel = P ? P.skinQuiere || P.skin : NPC.skin || 'Hero';
  const desc = npcActDescribir(act);
  p.innerHTML = `<div class="caja npcCaja"><h3>${esc(T(nuevo ? 'npc.titNuevo' : 'npc.tit'))}${P ? ' · ' + esc(skinNom(skinSel)) : ''}</h3>` +
    (nuevo ? `<p>${esc(T('npc.ayudaNuevo'))}</p><div class="npcSkins">${DATA.chars.map((s) => `<button data-npcs="${esc(s)}"${s === skinSel ? ' class="sel"' : ''}><img src="${retrato(s)}" alt=""><span>${esc(skinNom(s))}</span></button>`).join('')}</div>` : '') +
    `<p class="npcAhora">${esc(T('npc.ahora'))}: <b>${esc(desc)}</b></p>` +
    `<div class="npcRapidas">${NPC_RAPIDAS.map(([k, t]) => `<button data-npcr="${k}" data-npct="${t}">${esc(T(t))}</button>`).join('')}</div>` +
    `<div class="npcArmas"><span>${esc(T('npc.arma'))}</span>${[''].concat(NPC_ARMAS).map((w) => `<button data-npca="${w}"${(act.arma || '') === w ? ' class="sel"' : ''}>${esc(w ? npcArmaNom(w) : T('npc.sinArma'))}</button>`).join('')}</div>` +
    `<textarea id="npcTxt" maxlength="300" rows="2" placeholder="${esc(T('npc.escribi'))}"></textarea>` +
    `<div class="npcFila"><button class="npcOk" data-npcok>${esc(T('npc.aplicar'))}</button>${P && P.npc ? `<button class="npcBorrar" data-npcborrar>${esc(T('npc.borrar'))}</button>` : ''}${NPC.lista.length ? `<button class="npcBorrar" data-npctodos>${esc(T('npc.borrarTodos'))} (${NPC.lista.length})</button>` : ''}</div>` +
    `<p class="npcEstado" id="npcEst"></p></div>`;
  cerrarPaneles(); NPC.panel = P; p.classList.remove('oc'); UI.abierto = 'npc'; soltarPuntero();
  setTimeout(() => { const t = $('npcTxt'); if (t && !ENT.tactil) t.focus(); }, 50);
}
const npcArmaNom = (w) => (DEF_ARMAS[w] && DEF_ARMAS[w].nom) || w;   // (como en la barra de armas)
function npcActDescribir(a) {
  const m = T('npc.m.' + a.modo) + (a.hostil ? ', ' + T('npc.hostil') : '') + (a.arma ? ', ' + npcArmaNom(a.arma) : '') + (a.modo !== 'quieto' && a.modo !== 'bailar' && a.modo !== 'mirar' ? ', ' + a.vel.toFixed(1) + ' m/s' : '');
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
