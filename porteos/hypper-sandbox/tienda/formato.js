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
function rbPrm(o) {
  const prm = {}; for (const [k, v] of Object.entries(o && typeof o === 'object' ? o : {}).slice(0, 24)) {
    if (!/^[a-zA-Z0-9_]{1,24}$/.test(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) prm[k] = v; else if (typeof v === 'boolean') prm[k] = v;
    else if (typeof v === 'string') prm[k] = rbTexto(v, 300); else if (Array.isArray(v)) prm[k] = v.slice(0, 64).map((y) => (typeof y === 'number' && Number.isFinite(y) ? y : rbTexto(y, 60)));
  }
  return prm;
}
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
      return { t: x.t, p, yaw: rbNum(x.yaw, -10, 10, 0), prm: rbPrm(x.prm) };
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
export const VERITY_ACC = ['seguir', 'quieta', 'ven', 'libre', 'bailar', 'saltar', 'girar', 'rodar', 'rebotar', 'dormir', 'amor', 'mareo', 'poner', 'construir', 'hora', 'musica', 'video', 'emote', 'luz', 'explorar', 'limpiar', 'crear'];
export const VERITY_EMO = ['feliz', 'neutral', 'sorpresa', 'triste', 'enojada', 'pensando', 'miedo', 'risa', 'picara', 'siniestra', 'enamorada', 'dormida', 'mareada', 'emocionada'];
export const VERITY_OBRAS = ['casa', 'torre', 'muro', 'escalera', 'piramide', 'fuerte', 'puente'];
export const VERITY_EVENTOS = ['hola', 'muerte', 'noche', 'dia', 'obra', 'auto', 'explosion', 'charla', 'pensamiento', 'jugador', 'hecho', 'agarrada', 'tirada', 'congelada', 'disparo'];
export const VERITY_VOCES = ['es', 'en', 'fr', 'ja', 'zh', 'ko']; // (las que tiene MeloTTS; las demás: la voz del navegador)
// los servers donde Verity piensa y habla con Gemini para todos (los tres primeros oficiales); fuera de ahí, el que
// tenga el permiso del dueño (código secreto) o su propia clave de Google AI Studio
export const VERITY_PREMIUM = ['f_Desert_1', 'f_DesertV2_1', 'f_FlatGrass_1'];
export const VERITY_GEMINI = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest'], VERITY_GEMINI_VOZ = 'gemini-3.8-flash-lite-tts';
// los mensajes (formato chat) → el pedido de Gemini, en JSON
// las IAs que el dueño ofrece a todos con sus claves (en la tienda, como secretos) para elegir en el menú de Verity, y
// las que cada uno puede usar con su propia clave; "gratis" son los modelos públicos sin clave (desde tu conexión)
export const VERITY_IAS = ['auto', 'gemini', 'deepseek', 'gratis', 'mias'];
export const VERITY_LIBRES = [
  { id: 'ovh', u: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions', m: ['gpt-oss-120b', 'Meta-Llama-3_3-70B-Instruct', 'Qwen3.5-397B-A17B', 'Mistral-Small-3.2-24B-Instruct-2506', 'gpt-oss-20b'] },
  { id: 'llm7', u: 'https://api.llm7.io/v1/chat/completions', m: ['minimax-m2.7', 'gpt-oss:20b', 'mistral-Nemo-Instruct-2407', 'codestral-latest'] },
];
export const VERITY_CLAVES = {
  deepseek: { n: 'DeepSeek', u: 'https://api.deepseek.com/chat/completions', m: ['deepseek-flash', 'deepseek-v4-pro'], mc: ['deepseek-v4-pro', 'deepseek-flash'], web: 'https://platform.deepseek.com/api_keys' },
  groq: { n: 'Groq', u: 'https://api.groq.com/openai/v1/chat/completions', m: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'], web: 'https://console.groq.com/keys' },
  openrouter: { n: 'OpenRouter', u: 'https://openrouter.ai/api/v1/chat/completions', m: ['openai/gpt-oss-120b:free', 'meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat-v3-0324:free'], web: 'https://openrouter.ai/keys', sinJSON: true },
  mistral: { n: 'Mistral', u: 'https://api.mistral.ai/v1/chat/completions', m: ['mistral-medium-latest', 'mistral-small-latest'], web: 'https://console.mistral.ai/api-keys' },
  cerebras: { n: 'Cerebras', u: 'https://api.cerebras.ai/v1/chat/completions', m: ['gpt-oss-120b', 'llama-3.3-70b'], web: 'https://cloud.cerebras.ai' },
};
// un pedido estilo OpenAI (los gratis y los de clave): el cuerpo, con pensamiento alto si el modelo lo admite
export const verityAbierto = (modelo, msgs, max, crear, json) => ({ model: modelo, messages: msgs, max_tokens: max, temperature: 0.8,
  ...(crear && /gpt-oss/.test(modelo) ? { reasoning_effort: 'high' } : {}), ...(json ? { response_format: { type: 'json_object' } } : {}) });
// el texto que devolvió (los que piensan en voz alta lo traen aparte; si no hay "content", nada)
export const verityTextoAbierto = (d) => { const m = d && d.choices && d.choices[0] && d.choices[0].message; return m && typeof m.content === 'string' && m.content.trim() ? m.content : null; };
// nivel: cuánto piensa ('high' = lo que haga falta; el largo máximo de la respuesta incluye lo que piensa)
export function verityAGemini(msgs, max, nivel) {
  const sys = msgs.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  return { systemInstruction: { parts: [{ text: sys }] }, contents: msgs.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: max || 500, temperature: 0.8, ...(nivel ? { thinkingConfig: { thinkingLevel: nivel } } : {}) } };
}
// lo que se le pide a la voz de Gemini (el tono va en la frase: no lo lee)
export const verityVozGemini = (t, noche) => ({ contents: [{ parts: [{ text: (noche ? 'Whisper slowly, mysterious and a little eerie: ' : 'Say it like a cheerful, playful young girl: ') + t }] }],
  generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Leda' } } } } });
// la respuesta de audio de Gemini → WAV (a veces viene WAV, a veces PCM de 16 bits crudo con la frecuencia en el tipo)
export function verityWav(b64, tipo) {
  const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  if (/wav/i.test(tipo || '') || (u[0] === 82 && u[1] === 73 && u[2] === 70 && u[3] === 70)) return u;
  const sr = +((/rate=(\d+)/.exec(tipo || '') || [])[1] || 24000), out = new Uint8Array(44 + u.length), o = new DataView(out.buffer), txt = (q, t) => { for (let i = 0; i < 4; i++) out[q + i] = t.charCodeAt(i); };
  txt(0, 'RIFF'); o.setUint32(4, 36 + u.length, true); txt(8, 'WAVE'); txt(12, 'fmt '); o.setUint32(16, 16, true); o.setUint16(20, 1, true); o.setUint16(22, 1, true);
  o.setUint32(24, sr, true); o.setUint32(28, sr * 2, true); o.setUint16(32, 2, true); o.setUint16(34, 16, true); txt(36, 'data'); o.setUint32(40, u.length, true); out.set(u, 44);
  return out;
}
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
    '{"a":"luz","si":true} turn your light on or off; {"a":"explorar"} go explore and look at things; {"a":"limpiar"} delete what you built; ' +
    '{"a":"crear","tipo":"mod|mapa|anim","q":"detailed description in English of what to make"} you CREATE something new for the game (it takes a moment, you are great at it): "mod" = a new mod or game mechanic (gravity, speed, super jump, weapons, slow motion, or code: minigames, buttons, things that rain or explode, timers, powers), "mapa" = a custom build placed in the world (a big castle, a city block, a parkour or obstacle course, an arena, a racetrack with ramps and lights), "anim" = a new emote animation (a dance, a gesture, a move) made in the animation editor. Add "cambiar":true when the player wants to change the last thing you created (then q says what to change).\n' +
    'Only add actions the player asks for in their last message (never on your own, never "quieta" or "seguir" unless asked). Requests to actions: follow me = seguir; stay/wait here = quieta; come here = ven; do whatever you want/go play = libre; dance = bailar; jump = saltar; spin = girar; roll = rodar; bounce = rebotar; sleep/nap = dormir; spawn/put/give me X = poner; build = construir (only those 7 simple things; anything else to build = crear mapa); make/create/invent a mod, a mechanic, a minigame or a power = crear mod; make/design a map, a level, a parkour, an obstacle course, an arena = crear mapa; make/create a dance, an animation or an emote = crear anim; night/day/time = hora; play music/a song = musica; a video = video; clean up/delete what you made = limpiar; go explore = explorar. ' +
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
// el JSON que devuelve un modelo, aunque venga roto (claves sin comillas, comas de más, cortado por el largo)
const rbLeer = (s) => { try { const x = JSON.parse(s); return x && typeof x === 'object' ? x : null; } catch (e) { return null; } };
const rbArreglo = (s) => s.replace(/([{,]\s*)([a-zA-Z_]+)\s*:/g, '$1"$2":').replace(/,\s*([}\]])/g, '$1');
// (cortado a la mitad de una lista larga: se queda hasta el último elemento entero y se cierra lo que quedó abierto)
function rbCerrar(s) {
  const pila = []; let enTxt = false, esc = false, corte = -1, resto = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (enTxt) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') enTxt = false; continue; }
    if (c === '"') enTxt = true;
    else if (c === '{' || c === '[') pila.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') { pila.pop(); if (!pila.length) return s.slice(0, i + 1); corte = i + 1; resto = pila.slice().reverse().join(''); }
  }
  return corte > 0 ? s.slice(0, corte) + resto : null;
}
function rbJSON(txt) {
  if (typeof txt !== 'string' || !txt.trim()) return null;
  const i = txt.indexOf('{'), j = txt.lastIndexOf('}'), crudo = i >= 0 && j > i ? txt.slice(i, j + 1) : '';
  let o = crudo ? rbLeer(crudo) || rbLeer(rbArreglo(crudo)) : null;
  if (!o && i >= 0) for (const fin of ['}', ']}', '"}', '"]}', '}]}', '}]]}', ']]}']) if ((o = rbLeer(rbArreglo(txt.slice(i).trim() + fin)))) break;
  if (!o && i >= 0) { const c = rbCerrar(txt.slice(i)); if (c) o = rbLeer(c) || rbLeer(rbArreglo(c)); }
  return o;
}
export function verityRespuesta(txt) {
  if (typeof txt !== 'string' || !txt.trim()) return null;
  const leer = rbLeer;
  let o = rbJSON(txt);
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
    if (x.a === 'crear') { a.tipo = VERITY_CREA.includes(x.tipo) ? x.tipo : 'mod'; a.q = rbTexto(x.q, 400); if (!a.q) return null; if (x.cambiar) a.cambiar = true; }
    return a;
  }).filter(Boolean).slice(0, 3);
  return { decir, emocion: VERITY_EMO.includes(o.emocion) ? o.emocion : 'neutral', acciones, recordar: rbTexto(o.recordar, 100) };
}

// ---------------- Verity crea: mods (con mecánicas en código), cosas en el mundo y animaciones ----------------
// Un pedido aparte del de charlar (más largo, con un modelo mejor) que contesta un JSON; todo se revisa: el mod pasa por
// validarRB (su código corre aislado como el de cualquier mod), lo del mundo con nombres y lugares acotados (el juego
// además revisa que cada prop exista) y la animación son direcciones de brazos y piernas, codos, rodillas y giros del
// cuerpo, que el juego pasa a huesos en el editor de animaciones.
export const VERITY_CREA = ['mod', 'mapa', 'anim'];
export const VERITY_GEMINI_CREA = ['gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite'];
const VERITY_ICOS = ['mod', 'energia', 'luna', 'salto', 'veloz', 'balas', 'dios', 'lenta', 'boom', 'fuego', 'cohete', 'alien', 'robot', 'dino', 'auto', 'arma', 'bomba', 'iman', 'tornado',
  'hielo', 'corona', 'fiesta', 'volar', 'ragdoll', 'planeta', 'shuriken', 'luz', 'meta', 'teleport', 'musica', 'piano', 'radio', 'rampa', 'impulso', 'cartel', 'zona_muerte', 'ciclope', 'emote'];
const VERITY_ENT = 'luz {"color":"#rrggbb","r":1-80 radius,"i":0.05-6 intensity}; cartel {"texto":"...","color":"#rrggbb"} a sign; rampa {"alto":10-600,"ancho":6-80,"ang":15-80} a huge stunt ramp; ' +
  'impulso {"f":0-200 up force,"d":0-200 forward force} a jump pad; meta {"texto":"..."} a finish line; teleport {"a":[x,y,z] destination} ; zona_muerte {"s":[sx,sy,sz] size} kills whoever enters; piano {}; radio {}; pantalla {} a big video screen';
const VERITY_API = 'The code runs alone in a sandboxed iframe: no access to the page, window.parent, storage or network (never use fetch, document, eval, import or require). It talks to the game only through the global object rb:\n' +
  'rb.estado = {jugador:{pos:[x,y,z],vel:[x,y,z],yaw,pitch,vida,vivo,suelo,vehiculo,nombre},mundo:{nombre,gravedad,hora},t} (refreshed 15 times per second; y is up; the player looks along [Math.sin(yaw),0,Math.cos(yaw)]);\n' +
  "rb.on('inicio',fn) once when the mod starts; rb.on('tick',fn({dt,t})) 15 times per second; rb.on('boton',fn({id})) when the player taps one of your buttons; rb.on('tecla',fn({code})) key pressed (KeyboardEvent.code like 'KeyG'); rb.on('muerte',fn) the player died; rb.on('fin',fn) the mod was turned off;\n" +
  "rb.aviso(text,seconds) a message on screen; rb.boton(id,'ico:ICON' or short text) adds a button to the MOD menu (always add buttons for mechanics on phones, keys are optional extras); rb.quitarBoton(id);\n" +
  'rb.jugador({vel_max,salto,vida,pos:[x,y,z],vel:[x,y,z],yaw,tercera}) changes the player (normal values: vel_max 6, salto 1.1, vida 100; vel launches the player); rb.mundo({gravedad,hora,ciclo}) (gravedad multiplier, 1 = normal; hora 0-24; ciclo true/false day cycle);\n' +
  'await rb.crear(PROP,[x,y,z],{yaw,congelado}) -> id or null (at most 3000; congelado true = frozen in the air); rb.borrar(id); rb.mover(id,{pos,vel,congelado}) (props only); await rb.objetos() -> [{id,n,p,mio}];\n' +
  "rb.explosion([x,y,z],radius,damage); rb.arma(WEAPON) gives a weapon; rb.nota(hz,seconds,[x,y,z] or null,volume 0-2,'piano'|'organo'|'campana') plays a note;\n" +
  'await rb.rayo([x,y,z],[dx,dy,dz],maxDistance) -> {t,p,n,id} or null; await rb.guardar(key,value); await rb.leer(key) (saved between games);\n' +
  'await rb.entidad(TYPE,[x,y,z],{params},yaw) -> id; rb.quitarEntidad(id); TYPE: ' + VERITY_ENT + "; rb.nativo('volar'|'ragdoll'|'scp',true|false) flying, ragdoll body, play as the SCP creature.\n" +
  'Write plain modern JavaScript, keep state in variables, check for null results, keep it light (no busy loops, few objects per tick, delete what you spawn when it is no longer needed and on fin).';
function verityCrearPrompt(tipo, l, props, armas) {
  const lengua = VERITY_LENGUAS[l] || 'English';
  const ini = `You are Verity, the AI helper of RezoBox, a physics sandbox game like Garry's Mod (props, vehicles, weapons, ragdolls, mods, multiplayer). The player asked you to create something. Be creative and generous: make it fun, complete and polished, more than the bare minimum. "decir" and "descripcion" are in ${lengua} (or the language of the request), short and fun. Family friendly. Reply ONLY with JSON.\n`;
  const lp = props.length ? props.join(', ') : 'Crate, Box2, Barrel, Cone';
  if (tipo === 'mod') return ini +
    'Create a NEW MOD: {"decir":"one short sentence telling the player what you made and how to use it","nombre":"short title 3-40 chars","descripcion":"1-2 sentences","icono":"ICON","efectos":{"gravedad":1,"velocidad":1,"salto":1,"tiempo":1,"explosion":1,"municionInfinita":false,"invencible":false,"hora":null,"armas":[]},"codigo":"JavaScript"}\n' +
    `ICON one of: ${VERITY_ICOS.join(', ')}.\n` +
    'efectos are simple multipliers, 1 = unchanged (gravedad 0.2 = moon, velocidad 2 = twice as fast, salto 3 = super jump, tiempo 0.5 = slow motion, explosion 3 = bigger explosions); hora 0-24 or null; ' +
    `armas: weapons to give, from: ${(armas.length ? armas : ['Pistol', 'Akm', 'Shotgun', 'Sniper']).join(', ')}.\n` +
    '"codigo": the new mechanic as JavaScript ("" if the effects alone do it). ' + VERITY_API + `\nPROP names for rb.crear: ${lp}.\n` +
    'Example of codigo: let t=0,ids=[];rb.on(\'inicio\',()=>{rb.aviso(\'Crate rain!\',3);rb.boton(\'jet\',\'ico:cohete\');});rb.on(\'boton\',b=>{if(b.id===\'jet\'){const j=rb.estado.jugador;rb.jugador({vel:[j.vel[0],18,j.vel[2]]});}});' +
    'rb.on(\'tick\',async e=>{t+=e.dt;if(t<4)return;t=0;const p=rb.estado.jugador.pos,id=await rb.crear(\'Crate\',[p[0]+Math.random()*8-4,p[1]+15,p[2]+Math.random()*8-4]);if(id){ids.push(id);if(ids.length>25)rb.borrar(ids.shift());}});rb.on(\'fin\',()=>ids.forEach(rb.borrar));';
  if (tipo === 'mapa') return ini +
    'Create a BUILD placed in the world (a structure, scene, level part, parkour, arena...): {"decir":"one short sentence","nombre":"short title","objetos":[{"n":"PROP","p":[x,y,z],"yaw":degrees,"f":1}],"entidades":[{"t":"TYPE","p":[x,y,z],"yaw":degrees,"prm":{}}]}\n' +
    'Coordinates in meters from the build point on the ground: x = right, y = up, z = forward (away from the player, who stands at about [0,0,-4]). p is where the BOTTOM CENTER of the prop goes. ' +
    'Use the sizes (width x height x depth, meters, at yaw 0) to stack and line props up exactly without gaps or overlaps: a prop on top of another goes at y = the height of the one below; yaw 90 swaps width and depth. ' +
    '"f":1 freezes the prop in place (use it for anything built), "f":0 leaves it loose with physics. Take your time and make it big and detailed when it fits: up to 600 objects and 40 entities, everything within 90 m.\n' +
    `PROPS (name WxHxD): ${lp}.\nENTITY TYPES (prm): ${VERITY_ENT}; teleport "a" is relative to the build point too.`;
  return ini +
    'Create a NEW EMOTE ANIMATION for a humanoid character as keyframes: {"decir":"one short sentence","nombre":"short title","cat":"baile|gesto|accion","dur":seconds 1-60,"loop":true,"claves":[KEY,...]}\n' +
    'KEY = {"t":seconds,"brazoD":[x,y,z],"brazoI":[x,y,z],"codoD":deg,"codoI":deg,"piernaD":[x,y,z],"piernaI":[x,y,z],"rodillaD":deg,"rodillaI":deg,"torso":[fwd,side,turn],"cabeza":[down,side,turn],"cuerpo":[fwd,side,turn],"cadera":[right,up,forward]}. ' +
    'D = the character\'s right side, I = its left side. A field you leave out keeps its value from the previous key (the first key starts from the standing pose).\n' +
    'brazo / pierna = the direction the upper arm / thigh points, in the character\'s own frame: x = outward (away from the body, toward that limb\'s side), y = up, z = forward. Standing: brazo [0.15,-1,0], pierna [0,-1,0]; arm out to the side [1,0,0]; arm forward [0,0,1]; arm up [0.2,1,0]; arm across the chest [-0.6,0,0.8]; knee up or kick forward: pierna [0,-0.2,1].\n' +
    'codo (elbow) / rodilla (knee) = bend in degrees, 0 straight to 150 fully bent (elbow bends the hand forward/up, knee bends the foot backward).\n' +
    'torso / cabeza = degrees [bend forward + or back -, lean to its right + or left -, turn to its right + or left -] (torso up to 60, cabeza up to 50); cuerpo = the same for the whole body around the hips (for a spin use turn 0, 90, 180, 270, 360 on successive keys). ' +
    'cadera = hip offset in meters [right, up (-0.4 = crouch, +0.3 = hop), forward].\n' +
    'Use as many keys as the move needs (usually 8-60) with t increasing from 0 to dur; for loops the last key (t = dur) repeats the first. Make it expressive and rhythmic, with clear, natural poses and no limb going through the body.';
}
// el pedido del juego → los mensajes (null si no sirve). d: { tipo, q, l, props: [[nombre, ancho, alto, fondo]], armas, prev }
export function verityCrearMensajes(d) {
  if (!d || typeof d !== 'object' || !VERITY_CREA.includes(d.tipo)) return null;
  const l = typeof d.l === 'string' && VERITY_LENGUAS[d.l] ? d.l : 'en', q = rbTexto(d.q, 600); if (!q) return null;
  const props = (Array.isArray(d.props) ? d.props : []).slice(0, 240).filter((p) => Array.isArray(p) && NOMBRE_RB.test(String(p[0])))
    .map((p) => (d.tipo === 'mapa' ? `${p[0]} ${[1, 2, 3].map((i) => rbNum(p[i], 0, 99, 1).toFixed(1)).join('x')}` : String(p[0])));
  const prev = typeof d.prev === 'string' ? d.prev.replace(/[\u0000-\u0008\u000b-\u001f<>]/g, ' ').slice(0, 9000) : '';
  return [{ role: 'system', content: verityCrearPrompt(d.tipo, l, props, rbNombres(d.armas, 60)) },
    { role: 'user', content: (prev ? `[the current version, change it as asked and return the whole JSON] ${prev}\n` : '') + q }];
}
// lo que contestó → { tipo, decir, mod | mapa | anim } (null si no sirve)
export function verityCreacion(tipo, txt) {
  const o = rbJSON(typeof txt === 'string' ? txt.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '') : '');
  if (!o || !VERITY_CREA.includes(tipo)) return null;
  const decir = rbTexto(o.decir, 280), nombre = rbTexto(o.nombre, 40);
  if (tipo === 'mod') {
    const e = o.efectos && typeof o.efectos === 'object' ? o.efectos : {};
    let codigo = typeof o.codigo === 'string' ? o.codigo.replace(/^\s*```(?:js|javascript)?\s*/i, '').replace(/```\s*$/, '').trim().slice(0, 200000) : '';
    const m = validarRB({ formato: 'rezobox-mod', nombre: nombre.length >= 3 ? nombre : 'Verity mod', autor: 'Verity', descripcion: o.descripcion, etiquetas: ['diversion'],
      icono: 'ico:' + (VERITY_ICOS.includes(o.icono) ? o.icono : 'mod'), efectos: { ...e, aparecer: [] }, codigo, tipo: 'juego' });
    return typeof m === 'string' ? null : { tipo, decir, mod: m };
  }
  if (tipo === 'mapa') {
    const objetos = (Array.isArray(o.objetos) ? o.objetos : []).slice(0, 700).map((x) => {
      if (!x || !NOMBRE_RB.test(String(x.n || ''))) return null; const p = rbVec(x.p, 3, 1e3); if (!p) return null;
      return { n: String(x.n), p: [rbNum(p[0], -100, 100, 0), rbNum(p[1], -5, 150, 0), rbNum(p[2], -100, 100, 0)], yaw: rbNum(x.yaw, -720, 720, 0), f: x.f === 0 || x.f === false ? 0 : 1 };
    }).filter(Boolean);
    const entidades = (Array.isArray(o.entidades) ? o.entidades : []).slice(0, 50).map((x) => {
      if (!x || !ENTIDADES_RB.includes(x.t)) return null; const p = rbVec(x.p, 3, 1e3); if (!p) return null;
      return { t: x.t, p: [rbNum(p[0], -100, 100, 0), rbNum(p[1], -5, 150, 0), rbNum(p[2], -100, 100, 0)], yaw: rbNum(x.yaw, -720, 720, 0), prm: rbPrm(x.prm) };
    }).filter(Boolean);
    return objetos.length || entidades.length ? { tipo, decir, mapa: { nombre, objetos, entidades } } : null;
  }
  const dur = rbNum(o.dur, 0.5, 60, 3), dir = (v) => { const a = rbVec(v, 3, 5); if (!a) return null; const L = Math.hypot(a[0], a[1], a[2]); return L > 0.05 ? a.map((x) => Math.round(x / L * 1000) / 1000) : null; };
  const ang = (v, lim, giro) => { const a = rbVec(v, 3, 1e4); return a ? [rbNum(a[0], -lim, lim, 0), rbNum(a[1], -lim, lim, 0), rbNum(a[2], -(giro || lim), giro || lim, 0)] : null; };
  const vistos = new Map();
  for (const k of (Array.isArray(o.claves) ? o.claves : []).slice(0, 200)) {
    if (!k || typeof k !== 'object') continue; const c = { t: Math.round(rbNum(k.t, 0, dur, 0) * 20) / 20 };
    for (const n of ['brazoD', 'brazoI', 'piernaD', 'piernaI']) { const d = dir(k[n]); if (d) c[n] = d; }
    for (const n of ['codoD', 'codoI', 'rodillaD', 'rodillaI']) if (k[n] != null && Number.isFinite(+k[n])) c[n] = rbNum(k[n], 0, 160, 0);
    const to = ang(k.torso, 75), ca = ang(k.cabeza, 70), cu = ang(k.cuerpo, 180, 1080), h = rbVec(k.cadera, 3, 1.5);
    if (to) c.torso = to; if (ca) c.cabeza = ca; if (cu) c.cuerpo = cu; if (h) c.cadera = h;
    vistos.set(c.t, c);
  }
  const claves = [...vistos.values()].sort((a, b) => a.t - b.t);
  return claves.length >= 2 ? { tipo, decir, anim: { nombre, cat: CATS_ANIM_RB.includes(o.cat) ? o.cat : 'baile', dur, loop: o.loop !== false, claves } } : null;
}
