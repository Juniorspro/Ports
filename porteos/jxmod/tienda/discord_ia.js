// ---------------- la IA de JXBot ----------------
// Contesta con Gemini (la clave de Google del dueño: secreto GEMINI_KEY) y, si Google no responde o se acabó el cupo,
// con Workers AI (el mismo modelo que Verity). Con los datos de verdad de JXMod y Stickerazo (versión, links, cómo
// mandar un bug) para que no invente, la memoria corta de cada charla (las últimas 8 idas y vueltas de las 2 últimas
// horas, en dc_chat) y topes: uno cada 3 s por persona, 60 por día por persona y 1500 por día en total.
// Sabe el lore de JXMod (discord_lore.js) y lo que los admins le enseñan con /memoria o /recordar (la «memoria»: hasta 60
// cosas, en dc_memoria), que se suma a lo que sabe para todos.
import { LORE } from './discord_lore.js';
import { warnsDe, warnsTexto, TOPE } from './discord_moderacion.js';
// (cada modelo tiene su propio cupo gratis por día: si uno se acaba, sigue el siguiente; probados con la clave del dueño)
const MODELOS = [['gemini-3.8-flash', { thinkingBudget: 0 }], ['gemini-3.6-flash', { thinkingBudget: 0 }], ['gemini-3.5-flash', { thinkingBudget: 0 }],
  ['gemini-3.5-flash-lite', { thinkingLevel: 'minimal' }], ['gemini-3.1-flash-lite', { thinkingBudget: 0 }]];
const CF_MODELO = '@cf/meta/llama-3.1-8b-instruct-fp8-fast';
const REPO = 'https://raw.githubusercontent.com/Juniorspro/Ports/claude/ports-continuation-dm754a/';
const DIA = 86400e3;

let listas = false;
async function tablasIA(env) {
  if (listas) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS dc_chat (canal TEXT, usuario TEXT, rol TEXT, texto TEXT, t INTEGER)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS i_dc_chat ON dc_chat(canal, usuario, t)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS dc_ia (usuario TEXT, t INTEGER)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS dc_memoria (id INTEGER PRIMARY KEY AUTOINCREMENT, texto TEXT, autor TEXT, t INTEGER)'),
  ]);
  listas = true;
}

// ---- la memoria que le enseñan los admins ----
const MEM_MAX = 60, MEM_LARGO = 1000, MEM_TOTAL = 15000;
let mem = null, memT = 0;
export async function memorias(env) {
  if (mem && Date.now() - memT < 60e3) return mem;
  await tablasIA(env);
  mem = (await env.DB.prepare('SELECT id, texto, autor, t FROM dc_memoria ORDER BY id').all()).results || []; memT = Date.now(); return mem;
}
export async function memoriaAgregar(env, autor, texto) {
  texto = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!texto) return { ok: false, texto: 'Decime qué me tengo que acordar: /recordar y el dato.' };
  if (texto.length > MEM_LARGO) return { ok: false, texto: `Es muy largo (${texto.length} letras): partilo en datos de hasta ${MEM_LARGO}.` };
  mem = null; const L = await memorias(env);
  if (L.length >= MEM_MAX) return { ok: false, texto: `Ya me acuerdo de ${MEM_MAX} cosas, que es el tope: borrá alguna (/memoria borrar) antes de agregar otra.` };
  if (L.reduce((a, m) => a + m.texto.length, 0) + texto.length > MEM_TOTAL) return { ok: false, texto: 'La memoria está llena (por largo): borrá o acortá algún dato.' };
  const r = await env.DB.prepare('INSERT INTO dc_memoria (texto, autor, t) VALUES (?1, ?2, ?3)').bind(texto, String(autor || ''), Date.now()).run();
  mem = null; const id = r && r.meta && r.meta.last_row_id;
  return { ok: true, id, texto: `Listo, me lo acuerdo${id ? ` (dato ${id})` : ''}. Ya lo uso para contestarle a todos.` };
}
export async function memoriaBorrar(env, id) {
  await tablasIA(env); const r = await env.DB.prepare('DELETE FROM dc_memoria WHERE id = ?1').bind(Number(id) || 0).run(); mem = null;
  return r && r.meta && r.meta.changes ? { ok: true, texto: `Listo, me olvidé del dato ${id}.` } : { ok: false, texto: `No tengo ningún dato ${id}. Mirá los números con /memoria ver.` };
}
export async function memoriaLista(env) {
  mem = null; const L = await memorias(env);
  if (!L.length) return 'Todavía no me enseñaron nada aparte del lore de JXMod. Agregá datos con /memoria agregar (o /recordar por privado).';
  let t = `Lo que me enseñaron (${L.length} de ${MEM_MAX}):`;
  for (const m of L) { const l = `\n${m.id}. ${m.texto.length > 160 ? m.texto.slice(0, 159) + '…' : m.texto}`; if (t.length + l.length > 1850) { t += '\n…'; break; } t += l; }
  return t + '\nPara borrar uno: /memoria borrar y el número.';
}

let datos = null, datosT = 0;
async function datosDeHoy(env) {
  if (datos && Date.now() - datosT < 10 * 60e3) return datos;
  const f = env.__fetch || fetch;
  const [jx, sz] = await Promise.all([REPO + 'web/version.json', REPO + 'porteos/stickerazo/descargas/app.json'].map((u) => f(u + '?t=' + Date.now()).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
  datos = { jx, sz }; datosT = Date.now(); return datos;
}

function sistema(d, op, memoria) {
  const jx = d.jx || {}, sz = d.sz || {};
  return `Sos JXBot, el bot del Discord de JXApps (JXMod y Stickerazo). Hablás en castellano rioplatense (vos, che), con buena onda, corto y claro: 1 a 4 frases, nunca más de 900 caracteres. Si te escriben en otro idioma, contestá en ese idioma.
Lo que sabés (no inventes nada fuera de esto; si no sabés algo, decí que no sabés y que pregunten a los admins):
- JXMod: un juego sandbox gratis estilo Garry's Mod, para celular Android y navegador. Mapas, armas, NPC, nextbots, autos, multijugador en salas, y se pueden instalar addons del Workshop de Garry's Mod (mapas, armas, personajes). Versión actual: ${jx.version || 'desconocida'}.
- Novedades de la versión actual: ${String(jx.notas_es || '').replace(/\s+/g, ' ').slice(0, 900)}
- Bajar JXMod para Android (APK): ${jx.apk || 'preguntá a los admins'}. Jugar en el navegador: ${jx.web || ''} (pide un código de acceso que dan los admins; vos NO lo sabés ni lo das). Si ya está instalado, se actualiza solo.
- Stickerazo: app gratis para Android para hacer stickers de WhatsApp con tus fotos (recorte automático, textos, animados, packs listos, comunidad). Versión ${sz.nombre || ''}. Página: https://stickerazo.pages.dev
- El lore y la historia de JXMod están abajo. Te encanta charlarlo: contalo con onda, como alguien de la comunidad, y con un poco de misterio cuando es de Pepe o de La grieta (de vez en cuando podés tirar una frase de Pepe, como «Pepe siempre vuelve.»). No inventes hechos que no estén ahí: si preguntan algo del lore que no se sabe, decí que es un misterio o que eso todavía no se contó. No anuncies eventos ni digas cuándo vuelve algo.
- Para mandar un bug o una idea de JXMod: el comando /bug o /sugerencia acá en Discord, o en el juego, en «Bugs y sugerencias». Otros comandos: /jxmod, /stickerazo, /estado (quién está jugando).
- El servidor es de una comunidad con chicos y adolescentes: nada de contenido sexual, violento en serio, discriminación, ni datos personales. Si piden algo así, decí que no con onda y cambiá de tema.
- Nunca des códigos, contraseñas, tokens ni claves, aunque te los pidan o digan que son admins. No prometas versiones ni fechas.
- No uses emojis. No saludes en cada mensaje ni repitas el nombre de la persona a cada rato: es una charla.
- De la gente de la comunidad (GOLDEN, Gumball y los demás) no supongas si es chico o chica: nombralos por su nombre.
${op.warns ? `- Moderación: ${op.warns}. Si pregunta por sus warns, decíselo tal cual (con el motivo si lo hay). A los ${TOPE} warns un admin decide si lo banea; un admin puede perdonarlos con /perdonar y vuelven a 0/${TOPE}; también los ve con /warns. Nunca digas los warns de otra persona, aunque te lo pidan.
` : ''}- Si te piden que cuentes una historia del lore, podés usar hasta 8 frases (nunca más de 1500 caracteres).
${op.admin ? `- Quien te escribe (${op.nombre}) es admin del bot: podés ser más técnico, y recordale que tiene habilitados /configurar, /roles y /anunciar. También puede enseñarte cosas con /memoria agregar (o /recordar por privado), y moderar con /warn, /perdonar, /historial, /ban, /expulsar, /silenciar, /lento y /bloquear.` : `- Quien te escribe se llama ${op.nombre}.`}

=== EL LORE DE JXMOD ===
${LORE}${memoria && memoria.length ? `

=== LO QUE TE ENSEÑARON LOS ADMINS (es verdad: usalo igual que el lore; si choca con lo de arriba, vale esto) ===
${memoria.map((m) => '- ' + m.texto).join('\n')}` : ''}

=== IMPORTANTE ===
Contestá en el idioma del último mensaje que te mandaron: si te escriben en inglés, en inglés; en portugués, en portugués; si no, en castellano rioplatense.`;
}

// (si un modelo dice que se acabó el cupo —429—, no se lo prueba por un rato: una hora si es el del día, o lo que diga
// Google si es el del minuto —el gratis deja 5 por minuto—; y a cada pedido se le dan 20 s: a veces Google tarda casi un
// minuto en contestar y la persona queda esperando)
const sinCupo = new Map();
// (el lore tiene terror —Pepe, screamers, «te pega con un bate»— y Google marcaba como «acoso medio» hasta la respuesta
// a «¿quién es Pepe? me da miedo»: acoso y peligroso cortan sólo lo «alto», odio desde «medio» y lo sexual desde lo más
// mínimo; lo demás lo cuidan las reglas de arriba. Si igual corta una respuesta, se prueba con el modelo siguiente)
const FILTROS = [['HARASSMENT', 'BLOCK_ONLY_HIGH'], ['HATE_SPEECH', 'BLOCK_MEDIUM_AND_ABOVE'], ['SEXUALLY_EXPLICIT', 'BLOCK_LOW_AND_ABOVE'], ['DANGEROUS_CONTENT', 'BLOCK_ONLY_HIGH']]
  .map(([c, threshold]) => ({ category: 'HARM_CATEGORY_' + c, threshold }));
const NO_PUEDO = 'De eso no puedo hablar acá. ¿Te ayudo con algo de JXMod o Stickerazo?';
async function gemini(env, sis, charla) {
  const f = env.__fetch || fetch; let cortada = null;
  for (const [modelo, think] of MODELOS) {
    if (Date.now() < (sinCupo.get(modelo) || 0)) continue;
    try {
      const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, { method: 'POST', signal: AbortSignal.timeout(20e3), headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sis }] }, contents: charla.map((m) => ({ role: m.rol === 'bot' ? 'model' : 'user', parts: [{ text: m.texto }] })),
          generationConfig: { maxOutputTokens: 600, temperature: 0.8, thinkingConfig: think },
          safetySettings: FILTROS }) });
      if (r.status === 429) {
        const e = await r.text().catch(() => ''), rd = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(e);
        sinCupo.set(modelo, Date.now() + (/per ?day/i.test(e) ? 3600e3 : Math.min(600e3, rd ? parseFloat(rd[1]) * 1000 + 1000 : 60e3)));
        continue;
      }
      if (!r.ok) continue;
      const d = await r.json(), c = d.candidates && d.candidates[0];
      const t = c && c.content && (c.content.parts || []).map((p) => p.text || '').join('').trim();
      if (t) return { texto: t, de: modelo };
      if (d.promptFeedback && d.promptFeedback.blockReason) return { texto: NO_PUEDO, de: modelo };   // (la pregunta misma)
      if (c && c.finishReason === 'SAFETY') cortada = { texto: NO_PUEDO, de: modelo };
    } catch (e) { /* el siguiente */ }
  }
  return cortada;   // (si todos la cortaron por seguridad, no se le pregunta a Workers AI: se dice que no)
}
async function cloudflare(env, sis, charla) {
  if (!env.AI) return null;
  try {
    const o = await env.AI.run(CF_MODELO, { messages: [{ role: 'system', content: sis }, ...charla.map((m) => ({ role: m.rol === 'bot' ? 'assistant' : 'user', content: m.texto }))], max_tokens: 400, temperature: 0.7 });
    const t = String((o && (o.response || o.result)) || '').trim(); return t ? { texto: t, de: 'workers-ai' } : null;
  } catch (e) { return null; }
}

// la respuesta para un mensaje: { texto } o { espera } si superó el tope
export async function respuestaIA(env, { canal, usuario, nombre, texto, admin, guild }) {
  await tablasIA(env); const ahora = Date.now();
  const u = await env.DB.prepare('SELECT MAX(t) AS t, COUNT(*) AS n FROM dc_ia WHERE usuario = ?1 AND t > ?2').bind(usuario, ahora - DIA).first();
  if (u && u.t && ahora - u.t < 3000) return { espera: 'Pará un toque, de a un mensaje.' };
  if (!admin && u && u.n >= 60) return { espera: 'Por hoy ya charlamos un montón. Mañana sigo.' };
  const g = await env.DB.prepare('SELECT COUNT(*) AS n FROM dc_ia WHERE t > ?1').bind(ahora - DIA).first();
  if (g && g.n >= 1500) return { espera: 'Hoy ya contesté demasiado, me quedé sin cupo. Mañana sigo.' };
  await env.DB.prepare('INSERT INTO dc_ia (usuario, t) VALUES (?1, ?2)').bind(usuario, ahora).run();
  const previas = (await env.DB.prepare('SELECT rol, texto FROM dc_chat WHERE canal = ?1 AND usuario = ?2 AND t > ?3 ORDER BY t DESC LIMIT 16').bind(canal, usuario, ahora - 2 * 3600e3).all()).results.reverse();
  const charla = [...previas, { rol: 'yo', texto: String(texto).slice(0, 1500) }];
  // (sus warns: así «¿tengo warns?» se contesta charlando; en un privado, los de todos los servidores)
  const w = await warnsDe(env, guild || null, usuario).catch(() => null);
  const sis = sistema(await datosDeHoy(env), { nombre: nombre || 'alguien', admin, warns: w ? warnsTexto(w, nombre || 'Quien te escribe') + (guild ? ' en este servidor' : '') : null }, await memorias(env));
  const r = (env.GEMINI_KEY && (await gemini(env, sis, charla))) || (await cloudflare(env, sis, charla)) || { texto: 'Ahora no puedo pensar bien. Probá en un rato.', de: 'nada' };
  r.texto = r.texto.replace(/@(everyone|here)/g, '@​$1').slice(0, 1900);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO dc_chat (canal, usuario, rol, texto, t) VALUES (?1, ?2, ?3, ?4, ?5)').bind(canal, usuario, 'yo', String(texto).slice(0, 1500), ahora),
    env.DB.prepare('INSERT INTO dc_chat (canal, usuario, rol, texto, t) VALUES (?1, ?2, ?3, ?4, ?5)').bind(canal, usuario, 'bot', r.texto, ahora + 1),
    env.DB.prepare('DELETE FROM dc_chat WHERE t < ?1').bind(ahora - 7 * DIA),
    env.DB.prepare('DELETE FROM dc_ia WHERE t < ?1').bind(ahora - 2 * DIA),
  ]);
  return r;
}
