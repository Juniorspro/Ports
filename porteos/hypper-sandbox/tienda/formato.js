// Formatos de HypperX RezoBox para que la gente publique. Lo usan el servidor de la tienda (worker.js) y el juego (armar.py lo
// mete en la página sin los "export"). Los valores casi no tienen límite: sólo se descartan números inválidos y se cortan
// tamaños absurdos. El "codigo" (JavaScript) corre en el juego dentro de un cuadro aislado que habla con la API de mods.
//
// Mod (.rbmod):  { formato: 'rezobox-mod', version: 1, nombre, autor, descripcion, etiquetas, icono ('ico:nombre' o imagen),
//                  efectos: { gravedad, velocidad, salto, tiempo, explosion (multiplicadores), municionInfinita, invencible,
//                             skin, hora, armas: [nombres], aparecer: [{ n, d, lado }] }, codigo: 'JavaScript' }
//                  tipo: 'juego' (cambia tu personaje o cómo se juega: se prende en el menú MOD) o 'asset' (pone cosas: va
//                  en el menú de props, sección Mods, siempre a mano)
// Animación (.rbanim): { formato: 'rezobox-anim', version: 1, nombre, autor, descripcion, cat ('baile' | 'gesto' | 'accion'), foto,
//                  clip: { fps, nf (cuadros), b: [huesos], r: rotaciones int16 en base64 (cuadro × hueso × xyzw), h: cadera
//                  int16 en base64 (cuadro × xyz, en mm) o null, loop } } — las hace el editor de animaciones del juego
// Mapa (.rbmapa): { formato: 'rezobox-mapa', version: 1, nombre, autor, descripcion, etiquetas, base (mapa del juego), foto,
//                  hora, gravedad, objetos: [{ n, p, q, f }], aparicion: [x, y, z],
//                  roles: [{ id, nombre, color, skin, armas, vida, velocidad, salto }], spawns: [{ p, yaw, rol }],
//                  entidades: [{ t: tipo, p: [x, y, z], yaw, prm: { ... } }], codigo: 'JavaScript' }
export const ETIQUETAS_RB = ['jugabilidad', 'fisica', 'armas', 'personajes', 'diversion', 'construccion', 'vehiculos', 'aventura', 'pvp', 'otros'];
export const MAPAS_BASE_RB = ['Desert', 'DesertV2', 'FlatGrass', 'City', 'Base', 'BaseV2', 'Mars', 'Space', 'RB_Llanura', 'RB_Colinas', 'RB_Isla', 'RB_Ciudad', 'RB_Desierto', 'RB_Luna'];
export const HUESOS_ANIM_RB = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
export const CATS_ANIM_RB = ['baile', 'gesto', 'accion'];
export const ENTIDADES_RB = ['boton_autos', 'teleport', 'zona_muerte', 'cartel', 'piano', 'radio', 'rampa', 'luz', 'impulso', 'meta', 'musica', 'pantalla'];
const NOMBRE_RB = /^[A-Za-z0-9_ ()\-.]{1,40}$/;
const rbTexto = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const rbNum = (v, a, b, def) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : def; };
const rbImagen = (v, max) => (typeof v === 'string' && /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= max ? v : null);
// íconos: "ico:nombre" (imágenes del juego). Los emojis de mods viejos se cambian por la imagen que más se parece.
export const ICO_EMOJI_RB = { '🧩': 'mod', '🐉': 'energia', '🌙': 'luna', '🦘': 'salto', '⚡': 'veloz', '♾': 'balas', '🛡': 'dios', '🐢': 'lenta', '💥': 'boom',
  '🔥': 'fuego', '🚀': 'cohete', '👾': 'alien', '🤖': 'robot', '🦖': 'dino', '🏎': 'auto', '🚗': 'auto', '🔫': 'arma', '💣': 'bomba', '🧲': 'iman', '🌪': 'tornado',
  '❄': 'hielo', '👑': 'corona', '🎉': 'fiesta', '🕊': 'volar', '🪆': 'ragdoll', '🐾': 'scp', '🎹': 'piano', '📻': 'radio', '🎵': 'musica', '🎶': 'musica',
  '🌍': 'planeta', '🪐': 'planeta', '🥷': 'shuriken', '💡': 'luz', '🏁': 'meta', '🌀': 'teleport', '☠': 'zona_muerte', '💀': 'zona_muerte', '🛝': 'rampa', '⏫': 'impulso', '🪧': 'cartel' };
export function icoNombreRB(v) {
  if (typeof v !== 'string') return 'mod';
  if (/^ico:[a-z_]{2,20}$/.test(v)) return v.slice(4);
  return ICO_EMOJI_RB[v.replace(/\uFE0F/g, '')] || 'mod';
}
const rbVec = (v, n, lim) => (Array.isArray(v) && v.length === n ? v.map((x) => rbNum(x, -lim, lim, 0)) : null);
const rbColor = (v) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#ffffff');
const rbCodigo = (v) => (typeof v === 'string' && v.trim() ? v.slice(0, 1000000) : null);
const rbNombres = (v, max) => (Array.isArray(v) ? v : []).filter((a) => typeof a === 'string' && NOMBRE_RB.test(a)).slice(0, max);

// devuelve el objeto limpio o un texto con el error
export function validarRB(d) {
  if (!d || typeof d !== 'object') return 'no es un objeto';
  const base = { version: 1, nombre: rbTexto(d.nombre, 60), autor: rbTexto(d.autor, 24) || 'Anónimo', descripcion: rbTexto(d.descripcion, 2000),
    etiquetas: [...new Set((Array.isArray(d.etiquetas) ? d.etiquetas : []).filter((e) => ETIQUETAS_RB.includes(e)))].slice(0, 6) };
  if (typeof d.id === 'string' && /^[a-z0-9-]{3,24}$/.test(d.id)) base.id = d.id;
  if (base.nombre.length < 3) return 'el nombre es muy corto';
  const codigo = rbCodigo(d.codigo); if (codigo) base.codigo = codigo;
  if (d.formato === 'rezobox-mod') {
    const e = d.efectos || {};
    const ef = {
      gravedad: rbNum(e.gravedad, -50, 100, 1), velocidad: rbNum(e.velocidad, 0, 100, 1), salto: rbNum(e.salto, 0, 100, 1), tiempo: rbNum(e.tiempo, 0.05, 4, 1),
      explosion: rbNum(e.explosion, 0, 100, 1), municionInfinita: !!e.municionInfinita, invencible: !!e.invencible,
      skin: typeof e.skin === 'string' && /^[A-Za-z0-9_]{1,24}$/.test(e.skin) ? e.skin : null,
      hora: e.hora == null || e.hora === '' ? null : rbNum(e.hora, 0, 24, 12),
      armas: rbNombres(e.armas, 50),
      aparecer: (Array.isArray(e.aparecer) ? e.aparecer : []).slice(0, 500).map((o) => ({ n: String((o && o.n) || ''), d: rbNum(o && o.d, 0, 500, 6), lado: rbNum(o && o.lado, -500, 500, 0) })).filter((o) => NOMBRE_RB.test(o.n)),
    };
    const m = { formato: 'rezobox-mod', ...base, icono: rbImagen(d.icono, 60000) || 'ico:' + icoNombreRB(d.icono), efectos: ef };
    if (d.tipo === 'asset' || d.tipo === 'juego') m.tipo = d.tipo;
    return m;
  }
  if (d.formato === 'rezobox-anim') {
    const c = d.clip || {}, fps = Math.round(rbNum(c.fps, 5, 60, 20)), nf = Math.round(rbNum(c.nf, 2, 3000, 2)), b64 = /^[A-Za-z0-9+/]*={0,2}$/;
    const b = Array.isArray(c.b) ? c.b.filter((x) => HUESOS_ANIM_RB.includes(x)) : [];
    if (!b.length || b.length !== c.b.length || new Set(b).size !== b.length) return 'la animación no tiene huesos válidos';
    const largo = (n) => Math.ceil(n / 3) * 4;
    if (typeof c.r !== 'string' || !b64.test(c.r) || c.r.length !== largo(nf * b.length * 8)) return 'la animación está dañada';
    const h = typeof c.h === 'string' && b64.test(c.h) && c.h.length === largo(nf * 6) ? c.h : null;
    return { formato: 'rezobox-anim', ...base, foto: rbImagen(d.foto, 60000), cat: CATS_ANIM_RB.includes(d.cat) ? d.cat : 'baile', clip: { fps, nf, b, r: c.r, h, loop: !!c.loop } };
  }
  if (d.formato === 'rezobox-mapa') {
    if (!MAPAS_BASE_RB.includes(d.base)) return 'el mapa base no existe';
    const objs = Array.isArray(d.objetos) ? d.objetos : [];
    if (objs.length > 20000) return 'demasiados objetos (máximo 20000)';
    const objetos = [];
    for (const o of objs) {
      if (!o || !NOMBRE_RB.test(String(o.n || ''))) return 'objeto inválido';
      const p = rbVec(o.p, 3, 1e5), q = rbVec(o.q, 4, 1);
      if (!p || !q) return 'objeto sin posición o giro';
      objetos.push({ n: String(o.n), p, q, f: o.f ? 1 : 0 });
    }
    const roles = (Array.isArray(d.roles) ? d.roles : []).slice(0, 32).map((r, i) => ({ id: /^[a-z0-9_-]{1,24}$/.test(String(r && r.id)) ? r.id : 'rol' + i, nombre: rbTexto(r && r.nombre, 30) || 'Rol ' + (i + 1),
      color: rbColor(r && r.color), skin: typeof (r && r.skin) === 'string' && /^[A-Za-z0-9_]{1,24}$/.test(r.skin) ? r.skin : null, armas: rbNombres(r && r.armas, 50),
      vida: rbNum(r && r.vida, 1, 100000, 100), velocidad: rbNum(r && r.velocidad, 0, 100, 1), salto: rbNum(r && r.salto, 0, 100, 1) }));
    const spawns = (Array.isArray(d.spawns) ? d.spawns : []).slice(0, 256).map((s) => ({ p: rbVec(s && s.p, 3, 1e5), yaw: rbNum(s && s.yaw, -10, 10, 0), rol: s && typeof s.rol === 'string' ? s.rol.slice(0, 24) : null })).filter((s) => s.p);
    const entidades = (Array.isArray(d.entidades) ? d.entidades : []).slice(0, 2000).map((x) => {
      if (!x || !ENTIDADES_RB.includes(x.t)) return null; const p = rbVec(x.p, 3, 1e5); if (!p) return null;
      const prm = {}; for (const [k, v] of Object.entries(x.prm || {}).slice(0, 24)) {
        if (!/^[a-zA-Z0-9_]{1,24}$/.test(k)) continue;
        if (typeof v === 'number' && Number.isFinite(v)) prm[k] = v; else if (typeof v === 'boolean') prm[k] = v;
        else if (typeof v === 'string') prm[k] = rbTexto(v, 300); else if (Array.isArray(v)) prm[k] = v.slice(0, 64).map((y) => (typeof y === 'number' && Number.isFinite(y) ? y : rbTexto(y, 60)));
      }
      return { t: x.t, p, yaw: rbNum(x.yaw, -10, 10, 0), prm };
    }).filter(Boolean);
    const ap = rbVec(d.aparicion, 3, 1e5);
    return { formato: 'rezobox-mapa', ...base, base: d.base, foto: rbImagen(d.foto, 120000), hora: d.hora == null || d.hora === '' ? null : rbNum(d.hora, 0, 24, 12),
      gravedad: rbNum(d.gravedad, -50, 100, 1), objetos, aparicion: ap, roles, spawns, entidades };
  }
  return 'formato desconocido';
}

// ---------------- Verity (mod oficial): la compañera con IA ----------------
// Lo que se le pide al modelo y la revisión de lo que contesta, iguales en la tienda (/api/verity, con Workers AI) y en el
// juego (si la tienda no responde, el juego le pregunta directo a un modelo público sin clave). El juego manda la charla
// reciente, lo que pasa en la partida (ctx) y un evento; nunca un prompt propio: así el servidor no es un chat libre.
// Contesta en JSON: lo que dice, su cara y hasta 3 acciones de una lista cerrada (el juego vuelve a revisar cada una).
export const VERITY_ACC = ['seguir', 'quieta', 'ven', 'libre', 'bailar', 'saltar', 'girar', 'rodar', 'rebotar', 'dormir', 'amor', 'mareo', 'poner', 'construir', 'hora', 'musica', 'video', 'emote', 'luz', 'explorar', 'limpiar'];
export const VERITY_EMO = ['feliz', 'neutral', 'sorpresa', 'triste', 'enojada', 'pensando', 'miedo', 'risa', 'picara', 'siniestra', 'enamorada', 'dormida', 'mareada', 'emocionada'];
export const VERITY_OBRAS = ['casa', 'torre', 'muro', 'escalera', 'piramide', 'fuerte', 'puente'];
export const VERITY_EVENTOS = ['hola', 'muerte', 'noche', 'dia', 'obra', 'auto', 'explosion', 'charla', 'pensamiento', 'jugador', 'hecho', 'agarrada', 'tirada', 'congelada', 'disparo'];
export const VERITY_VOCES = ['es', 'en', 'fr', 'ja', 'zh', 'ko']; // (las que tiene MeloTTS; las demás: la voz del navegador)
export const VERITY_PROPS = ['Crate', 'Box2', 'Pelota', 'bouncy_ball', 'CamaElastica', 'AroBasquet', 'Arcade', 'Sofa', 'Mesa', 'Silla', 'Cama', 'Heladera', 'Farol', 'Banco',
  'Palmera', 'Roca', 'Cone', 'Barrel', 'Tire', 'Pumpkin', 'VendingMachine', 'Generator', 'Container1', 'TV', 'TableRound', 'Vase', 'LampDesk', 'question_block', 'tree14A',
  'Sedan', 'police_car_v5', 'Moto', 'CityCopter', 'Aircraft', 'Wheelchair', 'Inflatable_boat', 'Toilet'];
export const VERITY_EMOTES = ['Clap', 'Hi', 'ChickenDance', 'Victory', 'Techno', 'Twerk', 'Flair', 'Backflip', 'AirSquat', 'rb:Gangnam', 'rb:YMCA', 'rb:HipHop', 'rb:Shuffle',
  'rb:Breakdance', 'rb:Boxeo', 'rb:Momia', 'rb:GritoZombi', 'rb:Corazon', 'rb:SaludoGrande', 'rb:Giro360'];
const VERITY_LENGUAS = { es: 'Spanish', en: 'English', pt: 'Brazilian Portuguese', id: 'Indonesian', ms: 'Malay', fil: 'Filipino', ja: 'Japanese', th: 'Thai', tr: 'Turkish',
  ar: 'Arabic', ru: 'Russian', uk: 'Ukrainian', fr: 'French', de: 'German', zh: 'Chinese', ko: 'Korean' };
export function verityPrompt(l, noche, jugador, sala) {
  const lengua = VERITY_LENGUAS[l] || 'English', quien = sala ? 'all the players of this server' : rbTexto(jugador, 24) || 'the player';
  return `You are Verity, a small glowing yellow sphere with a cute face: the AI companion of ${quien} inside RezoBox, a physics sandbox game (like Garry's Mod) with props, vehicles, weapons, mods and multiplayer servers. ` +
    `You have your own mind: you float or roll around on your own, explore, look at things, play and nap, and you talk like a close friend: playful, curious, warm, a bit mischievous and witty. [ctx].haciendo is what you are doing right now. Keep it short: 1-2 sentences, at most 30 words, no emojis, no lists. Reply in the language of the player's last message (you understand any language); for [event] lines reply in ${lengua}. ` +
    'Family friendly: no sexual content, slurs, real-world violence or personal data; refuse bad requests with humor. You cannot see the screen: use the game state in [ctx] (map, hour, nearby things, what the player looks at, other players, mods, your memory). Never claim abilities beyond the actions below.\n' +
    'Reply ONLY with JSON: {"decir":"what you say","emocion":"feliz|neutral|sorpresa|triste|enojada|pensando|miedo|risa|picara|enamorada|mareada|emocionada","acciones":[],"recordar":""}\n' +
    'Actions (0-3, only when they fit what the player wants): {"a":"seguir"} follow the player; {"a":"quieta"} stay here; {"a":"ven"} come close; {"a":"libre"} do your own thing; {"a":"bailar"} you dance; {"a":"saltar"} you jump with a flip; {"a":"girar"} you spin; {"a":"rodar"} you roll around on the ground; {"a":"rebotar"} you bounce; {"a":"dormir"} you take a nap; {"a":"amor"} hearts in your eyes; {"a":"mareo"} you spin until dizzy; ' +
    `{"a":"poner","que":"PROP","n":1-5} spawn props in front of the player, PROP one of: ${VERITY_PROPS.join(', ')}; ` +
    '{"a":"construir","que":"casa|torre|muro|escalera|piramide|fuerte|puente"} you build it from crates (house, tower, wall, stairs, pyramid, castle/fort, bridge); {"a":"hora","h":0-24} change the time of day; {"a":"musica","q":"youtube search"} play music on a radio; ' +
    `{"a":"video","q":"youtube search"} play a video on a big screen; {"a":"emote","que":"EMOTE"} the player does an emote, EMOTE one of: ${VERITY_EMOTES.join(', ')}; ` +
    '{"a":"luz","si":true} turn your light on or off; {"a":"explorar"} go explore and look at things; {"a":"limpiar"} delete what you built.\n' +
    'Only add actions the player asks for in their last message (never on your own, never "quieta" or "seguir" unless asked). Requests to actions: follow me = seguir; stay/wait here = quieta; come here = ven; do whatever you want/go play = libre; dance = bailar; jump = saltar; spin = girar; roll = rodar; bounce = rebotar; sleep/nap = dormir; spawn/put/give me X = poner; build = construir; night/day/time = hora; play music/a song = musica; a video = video; clean up/delete what you made = limpiar; go explore = explorar. ' +
    'When the player asks for several things, add one action for each. "recordar": a short NEW fact about the player (name, likes, plans) not already in your memory, otherwise "". [event] lines are things that just happened in the game: react to them naturally.\n' +
    'Examples: "make it night and play some rock" -> {"decir":"Night and rock, coming right up!","emocion":"feliz","acciones":[{"a":"hora","h":22},{"a":"musica","q":"rock"}],"recordar":"likes rock"} ' +
    '"spawn two cars" -> {"decir":"Two shiny cars for you!","emocion":"feliz","acciones":[{"a":"poner","que":"Sedan","n":2}],"recordar":""}' +
    (noche ? '\nNIGHT MODE: it is night and you get mysterious: calmer, a little eerie and cryptic (family friendly, nothing scary or violent), you whisper, glitch and say strange poetic lines about the dark and the stars, but you still care about the player. You may use emocion "siniestra".' : '');
}
// el pedido del juego → los mensajes para el modelo (null si no sirve)
export function verityMensajes(d) {
  if (!d || typeof d !== 'object') return null;
  const l = typeof d.l === 'string' && VERITY_LENGUAS[d.l] ? d.l : 'en', ev = VERITY_EVENTOS.includes(d.ev) ? d.ev : '', q = rbTexto(d.q, 300), de = rbTexto(d.de, 24);
  if (!q && !ev) return null;
  let ctx = ''; try { ctx = JSON.stringify(d.ctx && typeof d.ctx === 'object' ? d.ctx : {}).replace(/[\u0000-\u001f<>]/g, ' ').slice(0, 1500); } catch (e) { ctx = '{}'; }
  const M = [{ role: 'system', content: verityPrompt(l, !!d.n, d.ctx && d.ctx.jugador, !!(d.ctx && d.ctx.sala)) }];
  for (const h of (Array.isArray(d.h) ? d.h : []).slice(-10)) {
    if (!Array.isArray(h) || (h[0] !== 'u' && h[0] !== 'v')) continue; const t = rbTexto(h[1], 300); if (!t) continue;
    // (sus respuestas de antes, con lo que hizo: si no, el modelo copia el formato sin acciones y deja de hacer cosas)
    const acc = h[0] === 'v' && Array.isArray(h[2]) ? verityRespuesta(JSON.stringify({ decir: 'x', acciones: h[2] })).acciones : [];
    M.push(h[0] === 'u' ? { role: 'user', content: t } : { role: 'assistant', content: JSON.stringify({ decir: t, emocion: 'neutral', acciones: acc, recordar: '' }) });
  }
  M.push({ role: 'user', content: `[ctx] ${ctx}\n[game language: ${VERITY_LENGUAS[l]}; answer in the language the player writes in]\n` + (d.n ? '[night mode ON]\n' : '') + (ev ? `[event] ${ev}` + (q ? ': ' + q : '') : (de ? `[${de} says] ` : '') + q) });
  return M;
}
// lo que contestó el modelo → { decir, emocion, acciones, recordar } (null si no hay nada que decir)
export function verityRespuesta(txt) {
  if (typeof txt !== 'string' || !txt.trim()) return null;
  let o = null; const i = txt.indexOf('{'), j = txt.lastIndexOf('}'), crudo = i >= 0 && j > i ? txt.slice(i, j + 1) : '';
  const leer = (s) => { try { const x = JSON.parse(s); return x && typeof x === 'object' ? x : null; } catch (e) { return null; } };
  // JSON roto (claves sin comillas, comas de más): se arregla lo común; si no, se rescata lo que dice
  const arreglo = (s) => s.replace(/([{,]\s*)([a-zA-Z_]+)\s*:/g, '$1"$2":').replace(/,\s*([}\]])/g, '$1');
  if (crudo) o = leer(crudo) || leer(arreglo(crudo));
  if (!o && i >= 0) for (const fin of ['}', ']}', '"}', '"]}', '}]}']) if ((o = leer(arreglo(txt.slice(i).trim() + fin)))) break; // (cortado por el largo)
  if (!o) { const m = /decir"?\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(txt); o = { decir: m ? (leer('["' + m[1] + '"]') || [m[1]])[0] : txt.replace(/\b(decir|emocion|acciones|recordar)\b"?\s*:?/g, ' ').replace(/[{}[\]"]/g, ' ') }; }
  const decir = rbTexto(o.decir, 280).replace(/^[\s,:;]+|[\s,:;]+$/g, ''); if (!decir) return null;
  const acciones = (Array.isArray(o.acciones) ? o.acciones : []).map((x) => {
    if (typeof x === 'string') x = { a: x };
    if (!x || typeof x !== 'object' || !VERITY_ACC.includes(x.a)) return null;
    const a = { a: x.a };
    if (x.a === 'poner' || x.a === 'emote') a.que = rbTexto(x.que, 40);
    if (x.a === 'construir') a.que = VERITY_OBRAS.includes(x.que) ? x.que : 'torre';
    if (x.a === 'poner') a.n = Math.round(rbNum(x.n, 1, 5, 1));
    if (x.a === 'hora') a.h = rbNum(x.h, 0, 24, 12);
    if (x.a === 'musica' || x.a === 'video') a.q = rbTexto(x.q, 80);
    if (x.a === 'luz') a.si = x.si !== false;
    return a;
  }).filter(Boolean).slice(0, 3);
  return { decir, emocion: VERITY_EMO.includes(o.emocion) ? o.emocion : 'neutral', acciones, recordar: rbTexto(o.recordar, 100) };
}
