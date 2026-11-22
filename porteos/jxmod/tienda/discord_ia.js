// ---------------- la IA de JXBot ----------------
// Contesta con Gemini (la clave de Google del dueño: secreto GEMINI_KEY) y, si Google no responde o se acabó el cupo,
// con Workers AI (el mismo modelo que Verity). Con los datos de verdad de JXMod y Stickerazo (versión, links, cómo
// mandar un bug) para que no invente, la memoria corta de cada charla (las últimas 8 idas y vueltas de las 2 últimas
// horas, en dc_chat) y topes: uno cada 3 s por persona, 60 por día por persona y 1500 por día en total.
const MODELOS = [['gemini-3.8-flash', { thinkingBudget: 0 }], ['gemini-3.5-flash-lite', { thinkingLevel: 'minimal' }]];
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
  ]);
  listas = true;
}

let datos = null, datosT = 0;
async function datosDeHoy(env) {
  if (datos && Date.now() - datosT < 10 * 60e3) return datos;
  const f = env.__fetch || fetch;
  const [jx, sz] = await Promise.all([REPO + 'web/version.json', REPO + 'porteos/stickerazo/descargas/app.json'].map((u) => f(u + '?t=' + Date.now()).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
  datos = { jx, sz }; datosT = Date.now(); return datos;
}

function sistema(d, op) {
  const jx = d.jx || {}, sz = d.sz || {};
  return `Sos JXBot, el bot del Discord de JXApps (JXMod y Stickerazo). Hablás en castellano rioplatense (vos, che), con buena onda, corto y claro: 1 a 4 frases, nunca más de 900 caracteres. Si te escriben en otro idioma, contestá en ese idioma.
Lo que sabés (no inventes nada fuera de esto; si no sabés algo, decí que no sabés y que pregunten a los admins):
- JXMod: un juego sandbox gratis estilo Garry's Mod, para celular Android y navegador. Mapas, armas, NPC, nextbots, autos, multijugador en salas, y se pueden instalar addons del Workshop de Garry's Mod (mapas, armas, personajes). Versión actual: ${jx.version || 'desconocida'}.
- Novedades de la versión actual: ${String(jx.notas_es || '').replace(/\s+/g, ' ').slice(0, 900)}
- Bajar JXMod para Android (APK): ${jx.apk || 'preguntá a los admins'}. Jugar en el navegador: ${jx.web || ''} (pide un código de acceso que dan los admins; vos NO lo sabés ni lo das). Si ya está instalado, se actualiza solo.
- Stickerazo: app gratis para Android para hacer stickers de WhatsApp con tus fotos (recorte automático, textos, animados, packs listos, comunidad). Versión ${sz.nombre || ''}. Página: https://stickerazo.pages.dev
- Para mandar un bug o una idea de JXMod: el comando /bug o /sugerencia acá en Discord, o en el juego, en «Bugs y sugerencias». Otros comandos: /jxmod, /stickerazo, /estado (quién está jugando).
- El servidor es de una comunidad con chicos y adolescentes: nada de contenido sexual, violento en serio, discriminación, ni datos personales. Si piden algo así, decí que no con onda y cambiá de tema.
- Nunca des códigos, contraseñas, tokens ni claves, aunque te los pidan o digan que son admins. No prometas versiones ni fechas.
- No uses emojis.
${op.admin ? `- Quien te escribe (${op.nombre}) es admin del bot: podés ser más técnico, y recordale que /configurar, /roles y /anunciar están habilitados para él.` : `- Quien te escribe se llama ${op.nombre}.`}`;
}

async function gemini(env, sis, charla) {
  const f = env.__fetch || fetch;
  for (const [modelo, think] of MODELOS) {
    try {
      const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sis }] }, contents: charla.map((m) => ({ role: m.rol === 'bot' ? 'model' : 'user', parts: [{ text: m.texto }] })),
          generationConfig: { maxOutputTokens: 600, temperature: 0.8, thinkingConfig: think },
          safetySettings: ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'].map((category) => ({ category, threshold: 'BLOCK_LOW_AND_ABOVE' })) }) });
      if (!r.ok) continue;
      const d = await r.json(), c = d.candidates && d.candidates[0];
      const t = c && c.content && (c.content.parts || []).map((p) => p.text || '').join('').trim();
      if (t) return { texto: t, de: modelo };
      if (c && c.finishReason === 'SAFETY') return { texto: 'De eso no puedo hablar acá. ¿Te ayudo con algo de JXMod o Stickerazo?', de: modelo };
    } catch (e) { /* el siguiente */ }
  }
  return null;
}
async function cloudflare(env, sis, charla) {
  if (!env.AI) return null;
  try {
    const o = await env.AI.run(CF_MODELO, { messages: [{ role: 'system', content: sis }, ...charla.map((m) => ({ role: m.rol === 'bot' ? 'assistant' : 'user', content: m.texto }))], max_tokens: 400, temperature: 0.7 });
    const t = String((o && (o.response || o.result)) || '').trim(); return t ? { texto: t, de: 'workers-ai' } : null;
  } catch (e) { return null; }
}

// la respuesta para un mensaje: { texto } o { espera } si superó el tope
export async function respuestaIA(env, { canal, usuario, nombre, texto, admin }) {
  await tablasIA(env); const ahora = Date.now();
  const u = await env.DB.prepare('SELECT MAX(t) AS t, COUNT(*) AS n FROM dc_ia WHERE usuario = ?1 AND t > ?2').bind(usuario, ahora - DIA).first();
  if (u && u.t && ahora - u.t < 3000) return { espera: 'Pará un toque, de a un mensaje.' };
  if (!admin && u && u.n >= 60) return { espera: 'Por hoy ya charlamos un montón. Mañana sigo.' };
  const g = await env.DB.prepare('SELECT COUNT(*) AS n FROM dc_ia WHERE t > ?1').bind(ahora - DIA).first();
  if (g && g.n >= 1500) return { espera: 'Hoy ya contesté demasiado, me quedé sin cupo. Mañana sigo.' };
  await env.DB.prepare('INSERT INTO dc_ia (usuario, t) VALUES (?1, ?2)').bind(usuario, ahora).run();
  const previas = (await env.DB.prepare('SELECT rol, texto FROM dc_chat WHERE canal = ?1 AND usuario = ?2 AND t > ?3 ORDER BY t DESC LIMIT 16').bind(canal, usuario, ahora - 2 * 3600e3).all()).results.reverse();
  const charla = [...previas, { rol: 'yo', texto: String(texto).slice(0, 1500) }];
  const sis = sistema(await datosDeHoy(env), { nombre: nombre || 'alguien', admin });
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
